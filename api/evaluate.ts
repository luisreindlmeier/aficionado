import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Metric } from '../src/app/core/metrics';
import type {
  EvalEvent,
  FounderScore,
  MetricScore,
  RedFlag,
  SkillVector,
  TraceStep,
} from '../src/app/core/model';
import type { FounderQuery, Signal } from '../src/app/core/connectors/types';
import { METRIC_CONNECTORS, RUNNERS } from './_lib/connectors';
import { reduceMetric } from './_lib/metrics';
import { ANCHORS } from '../src/app/core/data/anchors';
import {
  DEFAULT_PRESET,
  anchorComposites,
  bandOf,
  confidentComposite,
  nearestAnchor,
  overallConfidence,
  percentileOf,
  redFlagGate,
} from '../src/app/core/scoring';

export const config = { maxDuration: 60 };

const METRICS: Metric[] = ['Proof', 'Gravity', 'Trajectory'];

// LOOP B: on-demand evaluation. Streams EvalEvent frames as SSE so the UI can
// render the "brain at work" trace, each connector and signal as it lands, a
// MetricScore per metric, then the deterministic FounderScore. Body is a
// FounderQuery: { name, github?, npm?, pypi?, x?, linkedin?, domain?, keywords? }.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {};
  const query: FounderQuery = {
    name: body.name || '',
    github: body.github,
    npm: body.npm,
    pypi: body.pypi,
    x: body.x,
    linkedin: body.linkedin,
    domain: body.domain,
    keywords: body.keywords,
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const send = (event: EvalEvent): void => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const trace = (kind: TraceStep['kind'], label: string, extra: Partial<TraceStep> = {}): void => {
    send({ type: 'trace', step: { at: new Date().toISOString(), kind, label, ...extra } });
  };

  try {
    trace('plan', `Planning evaluation of ${query.name || 'founder'} across Proof, Gravity, Trajectory`);

    const weights = DEFAULT_PRESET.weights;
    const scores: Partial<Record<Metric, MetricScore>> = {};

    for (const metric of METRICS) {
      const connectors = (METRIC_CONNECTORS[metric] || []).filter((id) => RUNNERS[id]);
      send({ type: 'phase', metric, connectors });
      trace('fetch', `Fetching ${metric} signals from ${connectors.length} sources`, { metric });

      const collected: Signal[] = [];
      await Promise.all(
        connectors.map(async (id) => {
          const run = RUNNERS[id];
          if (!run) return;
          send({ type: 'connector', metric, connector: id, status: 'running' });
          try {
            const result = await run(query);
            for (const signal of result.signals) {
              if (signal.metric !== metric) continue; // a source may feed several metrics
              collected.push(signal);
              send({ type: 'signal', signal });
            }
            send({ type: 'connector', metric, connector: id, status: 'done', note: result.note });
          } catch (err) {
            send({ type: 'connector', metric, connector: id, status: 'error', note: message(err) });
          }
        }),
      );

      trace('extract', `Extracting ${metric} features from ${collected.length} signals`, { metric });
      const score = await reduceMetric(metric, collected, weights[metric]);
      scores[metric] = score;
      send({ type: 'metric', score });
    }

    // Deterministic reducer: pure math, no LLM, so the composite is reproducible.
    const proof = scores.Proof as MetricScore;
    const gravity = scores.Gravity as MetricScore;
    const trajectory = scores.Trajectory as MetricScore;

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
    const { value: rawComposite } = confidentComposite(metricScores, confidences, weights);

    const redFlags: RedFlag[] = []; // no live red-flag source yet; gate is a no-op
    trace('gate', 'Applying the red-flag gate');
    const gate = redFlagGate(rawComposite, redFlags);
    const confidence = overallConfidence(confidences);
    const band = bandOf(gate.value, confidence);

    trace('calibrate', 'Calibrating against the anchor set');
    const percentile = percentileOf(gate.value, anchorComposites(ANCHORS, weights));
    const neighbor = nearestAnchor(gate.value, ANCHORS, weights, {
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
    send({ type: 'final', score: final });
    trace('done', 'Evaluation complete');
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: message(err) });
  } finally {
    res.end();
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
