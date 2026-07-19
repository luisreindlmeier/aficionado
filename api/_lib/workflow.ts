import { AsyncLocalStorage } from 'node:async_hooks';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import type { Metric } from '../../src/app/core/metrics';
import type {
  EvalEvent,
  FounderScore,
  MetricScore,
  RedFlag,
  SkillVector,
  TraceStep,
} from '../../src/app/core/model';
import type { FounderQuery, Signal } from '../../src/app/core/connectors/types';
import { METRIC_CONNECTORS, RUNNERS } from './connectors';
import { reduceMetric } from './metrics';
import { ANCHORS } from '../../src/app/core/data/anchors';
import {
  DEFAULT_PRESET,
  anchorComposites,
  bandOf,
  confidentComposite,
  nearestAnchor,
  overallConfidence,
  percentileOf,
  redFlagGate,
} from '../../src/app/core/scoring';
import { aiEnabled, criticAgent } from './mastra';

// ─────────────────────────────────────────────────────────────
// DURABLE EVALUATION WORKFLOW (Mastra). Replaces the inline /api/evaluate loop:
//   ingest -> [proof | gravity | trajectory] in parallel -> reduce (+critic gate)
// The metric steps run the same connectors + reduceMetric (the per-metric agents)
// as before, so the numbers are identical. The reducer, red-flag gate and
// calibration are the SAME deterministic scoring functions. New: a critic agent
// contributes red flags to the (unchanged) redFlagGate.
// SSE frames are streamed to the request's emitter via AsyncLocalStorage, so the
// steps stay decoupled from the transport and every existing UI event is kept.
// ─────────────────────────────────────────────────────────────

export const emitter = new AsyncLocalStorage<(e: EvalEvent) => void>();
const emit = (e: EvalEvent): void => emitter.getStore()?.(e);
const trace = (kind: TraceStep['kind'], label: string, extra: Partial<TraceStep> = {}): void =>
  emit({ type: 'trace', step: { at: new Date().toISOString(), kind, label, ...extra } });

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const WEIGHTS = DEFAULT_PRESET.weights;

const founderQuerySchema = z.object({
  name: z.string(),
  github: z.string().optional(),
  npm: z.string().optional(),
  pypi: z.string().optional(),
  x: z.string().optional(),
  linkedin: z.string().optional(),
  domain: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

// (a) ingest: resolve the founder identity and open the trace.
const ingestStep = createStep({
  id: 'ingest',
  inputSchema: founderQuerySchema,
  outputSchema: founderQuerySchema,
  execute: async ({ inputData }) => {
    trace(
      'plan',
      `Planning evaluation of ${inputData.name || 'founder'} across Proof, Gravity, Trajectory`,
    );
    return inputData;
  },
});

// (b) one metric step: gather that metric's signals and run its agent via
// reduceMetric. Identical computation to the old inline loop, now a durable step.
function metricStep(metric: Metric) {
  return createStep({
    id: `metric-${metric.toLowerCase()}`,
    inputSchema: founderQuerySchema,
    outputSchema: z.custom<MetricScore>(),
    execute: async ({ inputData }) => {
      const query = inputData as FounderQuery;
      const connectors = (METRIC_CONNECTORS[metric] || []).filter((id) => RUNNERS[id]);
      emit({ type: 'phase', metric, connectors });
      trace('fetch', `Fetching ${metric} signals from ${connectors.length} sources`, { metric });

      const collected: Signal[] = [];
      await Promise.all(
        connectors.map(async (id) => {
          const run = RUNNERS[id];
          if (!run) return;
          emit({ type: 'connector', metric, connector: id, status: 'running' });
          try {
            const result = await run(query);
            for (const signal of result.signals) {
              if (signal.metric !== metric) continue;
              collected.push(signal);
              emit({ type: 'signal', signal });
            }
            emit({ type: 'connector', metric, connector: id, status: 'done', note: result.note });
          } catch (err) {
            emit({ type: 'connector', metric, connector: id, status: 'error', note: message(err) });
          }
        }),
      );

      trace('extract', `Extracting ${metric} features from ${collected.length} signals`, {
        metric,
      });
      const score = await reduceMetric(metric, collected, WEIGHTS[metric]);
      emit({ type: 'metric', score });
      return score;
    },
  });
}

const proofStep = metricStep('Proof');
const gravityStep = metricStep('Gravity');
const trajectoryStep = metricStep('Trajectory');

const criticSchema = z.object({
  redFlags: z.array(
    z.object({
      text: z.string().describe('The concern, one line'),
      note: z.string().describe('Why it matters / the evidence behind it'),
      severity: z.enum(['low', 'medium', 'high']),
    }),
  ),
});

/** Cross-source coherence pass. Returns [] when AI is off, on any error, or when
 *  the critic finds nothing, so a clean founder is scored exactly as before. */
async function runCritic(scores: readonly MetricScore[]): Promise<RedFlag[]> {
  if (!aiEnabled()) return [];
  const brief = scores
    .map((s) => {
      const evidence = (s.receipts ?? [])
        .slice(0, 6)
        .map((r) => `- [${r.connector}] ${r.text}`)
        .join('\n');
      return `${s.metric}: score ${s.score}, confidence ${s.confidence}. ${s.rationale}\n${evidence}`;
    })
    .join('\n\n');
  try {
    const { object } = await criticAgent.generate(
      `Review this founder for genuine red flags only.\n\n${brief}`,
      { structuredOutput: { schema: criticSchema } },
    );
    return (object.redFlags ?? []) as RedFlag[];
  } catch {
    return [];
  }
}

// (c-e) deterministic reducer + critic gate + calibration. Pure scoring math,
// byte-identical to the old handler, so composites/bands/percentiles are unchanged.
const reduceStep = createStep({
  id: 'reduce',
  inputSchema: z.any(),
  outputSchema: z.custom<FounderScore>(),
  execute: async ({ getStepResult, getInitData }) => {
    const proof = getStepResult('metric-proof') as MetricScore;
    const gravity = getStepResult('metric-gravity') as MetricScore;
    const trajectory = getStepResult('metric-trajectory') as MetricScore;
    const query = getInitData() as FounderQuery;

    trace('reduce', 'Reducing metrics to a founder score');
    const metricScores: Record<Metric, number> = {
      Proof: proof.score,
      Gravity: gravity.score,
      Trajectory: trajectory.score,
    };
    const confidences = {
      Proof: proof.confidence,
      Gravity: gravity.confidence,
      Trajectory: trajectory.confidence,
    };
    const { value: rawComposite } = confidentComposite(metricScores, confidences, WEIGHTS);

    const redFlags = await runCritic([proof, gravity, trajectory]);
    trace('gate', 'Applying the red-flag gate');
    const gate = redFlagGate(rawComposite, redFlags);
    const confidence = overallConfidence(confidences);
    const band = bandOf(gate.value, confidence);

    trace('calibrate', 'Calibrating against the anchor set');
    const percentile = percentileOf(gate.value, anchorComposites(ANCHORS, WEIGHTS));
    const neighbor = nearestAnchor(gate.value, ANCHORS, WEIGHTS, {
      excludeName: query.name,
      allowFailed: gate.capped,
    });
    const skills: SkillVector = { technical: 0, commercial: 0, domain: 0, product: 0 };

    const final: FounderScore = {
      proof,
      gravity,
      trajectory,
      composite: gate.value,
      rawComposite,
      percentile,
      band,
      confidence,
      capped: gate.capped,
      capReason: gate.reason,
      anchorNeighbor: neighbor?.display ?? neighbor?.name,
      skills,
    };
    emit({ type: 'final', score: final });
    trace('done', 'Evaluation complete');
    return final;
  },
});

export const evaluationWorkflow = createWorkflow({
  id: 'founder-evaluation',
  inputSchema: founderQuerySchema,
  outputSchema: z.custom<FounderScore>(),
})
  .then(ingestStep)
  .parallel([proofStep, gravityStep, trajectoryStep])
  .then(reduceStep)
  .commit();
