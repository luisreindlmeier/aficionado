import { generateObject } from 'ai';
import { z } from 'zod';
import type { Metric } from '../../src/app/core/metrics';
import type { Feature, MetricScore, Receipt } from '../../src/app/core/model';
import type { Signal } from '../../src/app/core/connectors/types';
import {
  ANCHOR_GRAVITY,
  ANCHOR_PROOF,
  ANCHOR_TRAJECTORY,
} from '../../src/app/core/data/anchors';
import {
  clamp,
  confidenceOf,
  log10p,
  percentileOf,
  squash,
  zScore,
} from '../../src/app/core/scoring';
import { scoreProofHeuristic } from './proof';

// ─────────────────────────────────────────────────────────────
// EXTRACTORS + REDUCER. For one metric and the signals collected for it:
//   1) extract features + rationale + strongest evidence
//        (a) generateObject via the AI Gateway when AI_GATEWAY_API_KEY is set
//        (b) otherwise a deterministic heuristic (Proof keeps its old behaviour)
//   2) turn features into a 0..100 magnitude with the log-scale + squash helpers
//   3) calibrate z + percentile against the anchor column (scoring.ts math)
//   4) confidence = completeness x agreement (confidenceOf)
// No LLM math leaks into the composite: the magnitude is a plain number the
// deterministic reducer can weight reproducibly.
// ─────────────────────────────────────────────────────────────

const COLUMN: Record<Metric, readonly number[]> = {
  Proof: ANCHOR_PROOF,
  Gravity: ANCHOR_GRAVITY,
  Trajectory: ANCHOR_TRAJECTORY,
};

// How many independent sources a metric ideally draws on (drives completeness).
const IDEAL: Record<Metric, number> = { Proof: 3, Gravity: 2, Trajectory: 2 };

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** log-scale a raw magnitude, z against a log baseline, squash to 0..100. */
function logSquash(raw: number, baseLog: number, spreadLog: number): number {
  return squash((log10p(Math.max(0, raw)) - baseLog) / spreadLog);
}

/** Blend feature contributions into a metric magnitude: reward a standout
 *  strength (max) while accounting for breadth (mean). */
function blend(contribs: number[]): number {
  const v = contribs.filter((c) => Number.isFinite(c));
  if (!v.length) return 2;
  const max = Math.max(...v);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  return clamp(Math.round(0.6 * max + 0.4 * avg), 2, 99);
}

function receiptOf(s: Signal, feature: string, quote?: string): Receipt {
  return quote ? { ...s, feature, quote } : { ...s, feature };
}

function feat(
  key: string,
  label: string,
  raw: number,
  display: string,
  contribution: number,
  col: readonly number[],
  receipts: Receipt[],
): Feature {
  return { key, label, raw, display, z: round2(zScore(contribution, col)), contribution, receipts };
}

function dedupeReceipts(rs: Receipt[]): Receipt[] {
  const seen = new Set<string>();
  const out: Receipt[] = [];
  for (const r of rs) {
    const k = `${r.connector}|${r.text}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function orderReceipts(features: Feature[]): Receipt[] {
  const all = [...features]
    .sort((a, b) => b.contribution - a.contribution)
    .flatMap((f) => [...f.receipts]);
  return dedupeReceipts(all);
}

// Deterministic feature builders ────────────────────────────────

function proofFeatures(sigs: Signal[], col: readonly number[]): Feature[] {
  const feats: Feature[] = [];
  const stars = sigs
    .filter((s) => /stars/i.test(s.text))
    .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  const starVal = stars?.value ?? 0;
  feats.push(
    feat(
      'stars',
      'Shipping record',
      starVal,
      stars ? `${starVal.toLocaleString('en-US')} stars` : 'no public stars',
      logSquash(starVal, 1.7, 0.9),
      col,
      stars ? [receiptOf(stars, 'Shipping record')] : [],
    ),
  );
  const dl = sigs
    .filter((s) => /downloads/i.test(s.text))
    .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  if (dl) {
    feats.push(
      feat(
        'downloads',
        'Real-world adoption',
        dl.value ?? 0,
        `${(dl.value ?? 0).toLocaleString('en-US')}/mo`,
        logSquash(dl.value ?? 0, 3.0, 1.2),
        col,
        [receiptOf(dl, 'Real-world adoption')],
      ),
    );
  }
  const research = sigs
    .filter((s) => s.connector === 'arxiv' || s.connector === 'semanticscholar')
    .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  if (research) {
    feats.push(
      feat(
        'research',
        'Research depth',
        research.value ?? 0,
        research.text,
        logSquash(research.value ?? 0, 1.0, 1.0),
        col,
        [receiptOf(research, 'Research depth')],
      ),
    );
  }
  const rep = sigs.find((s) => s.connector === 'stackexchange');
  if (rep) {
    feats.push(
      feat(
        'community',
        'Community standing',
        rep.value ?? 0,
        `${(rep.value ?? 0).toLocaleString('en-US')} rep`,
        logSquash(rep.value ?? 0, 3.0, 1.0),
        col,
        [receiptOf(rep, 'Community standing')],
      ),
    );
  }
  return feats;
}

function gravityFeatures(sigs: Signal[], col: readonly number[]): Feature[] {
  const reachSig = sigs
    .filter((s) => /followers/i.test(s.text))
    .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  const reach = reachSig?.value ?? 0;
  const rc = logSquash(reach, 3.0, 1.0);
  const authority = clamp(rc - 6, 2, 99);
  const amplification = clamp(rc - 12, 2, 99);
  return [
    feat(
      'reach',
      'True reach',
      reach,
      reach ? `${reach.toLocaleString('en-US')} followers` : 'no public reach',
      rc,
      col,
      reachSig ? [receiptOf(reachSig, 'True reach')] : [],
    ),
    feat('authority', 'Network authority', Math.round(authority), 'derived from reach', authority, col, []),
    feat('amplification', 'Amplification', Math.round(amplification), 'derived from reach', amplification, col, []),
  ];
}

function trajectoryFeatures(sigs: Signal[], col: readonly number[]): Feature[] {
  const feats: Feature[] = [];
  const cadence = sigs.find((s) => /push/i.test(s.text));
  const pushes = cadence?.value ?? 0;
  feats.push(
    feat(
      'cadence',
      'Recent cadence',
      pushes,
      `${pushes} recent pushes`,
      logSquash(pushes, 1.0, 0.7),
      col,
      cadence ? [receiptOf(cadence, 'Recent cadence')] : [],
    ),
  );
  const accel = sigs.find((s) => /repos over/i.test(s.text));
  if (accel) {
    feats.push(
      feat(
        'accel',
        'Acceleration',
        accel.value ?? 0,
        `${accel.value ?? 0} repos/yr`,
        logSquash(accel.value ?? 0, 0.5, 0.4),
        col,
        [receiptOf(accel, 'Acceleration')],
      ),
    );
  }
  const firstArch = sigs.find((s) => s.connector === 'wayback' && /first archived/i.test(s.text));
  if (firstArch) {
    feats.push(
      feat(
        'longevity',
        'Web longevity',
        firstArch.value ?? 0,
        firstArch.text,
        clamp(Math.round((firstArch.value ?? 0) * 8), 2, 99),
        col,
        [receiptOf(firstArch, 'Web longevity')],
      ),
    );
  }
  const snaps = sigs.find((s) => s.connector === 'wayback' && /snapshots/i.test(s.text));
  if (snaps) {
    feats.push(
      feat(
        'history',
        'Archive footprint',
        snaps.value ?? 0,
        `${(snaps.value ?? 0).toLocaleString('en-US')} snapshots`,
        logSquash(snaps.value ?? 0, 1.5, 1.0),
        col,
        [receiptOf(snaps, 'Archive footprint')],
      ),
    );
  }
  return feats;
}

function gravityRationale(sigs: Signal[]): string {
  const r = sigs
    .filter((s) => /followers/i.test(s.text))
    .sort((a, b) => (b.value || 0) - (a.value || 0))[0];
  if (!r?.value) return 'No public social footprint connected yet, Gravity is provisional (heuristic).';
  return `${r.value.toLocaleString('en-US')} followers, reach is the main pull signal (heuristic).`;
}

function trajectoryRationale(sigs: Signal[]): string {
  const parts: string[] = [];
  const c = sigs.find((s) => /push/i.test(s.text));
  const a = sigs.find((s) => /repos over/i.test(s.text));
  const w = sigs.find((s) => s.connector === 'wayback' && /first archived/i.test(s.text));
  if (c) parts.push(`${c.value ?? 0} recent pushes`);
  if (a) parts.push(`${a.value ?? 0} repos/yr`);
  if (w) parts.push(`${w.value ?? 0} yrs of web history`);
  return parts.length ? `Momentum: ${parts.join(', ')} (heuristic).` : 'Thin momentum signal (heuristic).';
}

// AI extractor ──────────────────────────────────────────────────

interface AiExtract {
  rationale: string;
  features: { key: string; label: string; value: number; display: string }[];
  evidenceIndexes: number[];
}

const PROMPTS: Record<Metric, string> = {
  Proof:
    'Score a founder\'s "Proof": demonstrated ability to build and ship real things (shipping record, real-world adoption, research depth).',
  Gravity:
    'Score a founder\'s "Gravity": how much people, capital and attention move toward them (true reach, network authority, amplification).',
  Trajectory:
    'Score a founder\'s "Trajectory": momentum and acceleration (recent shipping cadence, repos per year, longevity of the build history).',
};

async function extractWithAI(metric: Metric, signals: Signal[]): Promise<AiExtract | null> {
  if (!process.env.AI_GATEWAY_API_KEY || !signals.length) return null;

  const schema = z.object({
    rationale: z.string().describe('One or two calibrated, skeptical sentences justifying the score'),
    features: z
      .array(
        z.object({
          key: z.string().describe('short snake_case id'),
          label: z.string().describe('human label, e.g. "True reach"'),
          value: z.number().min(0).max(100).describe('calibrated 0..100 strength for this feature'),
          display: z.string().describe('short magnitude display, e.g. "16,993 followers"'),
        }),
      )
      .min(1)
      .max(6),
    evidenceIndexes: z.array(z.number()).describe('indexes of the strongest signals, most important first'),
  });

  const list = signals
    .map((s, i) => `${i}. [${s.connector}] ${s.text}${s.value != null ? ` (=${s.value})` : ''}`)
    .join('\n');

  const { object } = await generateObject({
    model: 'anthropic/claude-sonnet-5',
    schema,
    prompt:
      `${PROMPTS[metric]} 0 = no evidence, 100 = exceptional, top-percentile. ` +
      `Weigh reach and adoption over raw counts. Extract 3-6 calibrated features, a rationale, ` +
      `and the strongest evidence indexes.\n\nSignals:\n${list}`,
  });
  return object as AiExtract;
}

// Reducer entrypoint ────────────────────────────────────────────

/** Reduce one metric's signals to a fully-shaped MetricScore. */
export async function reduceMetric(
  metric: Metric,
  signals: Signal[],
  weight: number,
): Promise<MetricScore> {
  const col = COLUMN[metric];
  const connectors = new Set(signals.map((s) => s.connector));
  const completeness = signals.length
    ? clamp(
        0.2 + 0.55 * Math.min(1, connectors.size / IDEAL[metric]) + 0.1 * Math.min(1, signals.length / 3),
        0.15,
        0.95,
      )
    : 0.15;
  const agreement = connectors.size >= 2 ? 0.85 : signals.length ? 0.6 : 0.3;
  const confidence = confidenceOf(completeness, agreement);

  const ai = await extractWithAI(metric, signals).catch(() => null);

  let score: number;
  let rationale: string;
  let features: Feature[];
  let by: 'ai' | 'heuristic';

  if (ai) {
    by = 'ai';
    rationale = ai.rationale;
    features = ai.features.map((f, i) =>
      feat(f.key || `f${i}`, f.label, Math.round(f.value), f.display, clamp(Math.round(f.value), 0, 100), col, []),
    );
    score = blend(features.map((f) => f.contribution));
    const evidence = dedupeReceipts(
      ai.evidenceIndexes
        .map((i) => signals[i])
        .filter((s): s is Signal => Boolean(s))
        .map((s) => receiptOf(s, features[0]?.label ?? metric)),
    );
    if (features[0] && evidence.length) {
      features = [{ ...features[0], receipts: evidence }, ...features.slice(1)];
    }
  } else if (metric === 'Proof') {
    const h = scoreProofHeuristic(signals);
    by = 'heuristic';
    score = h.score;
    rationale = h.rationale;
    features = proofFeatures(signals, col);
  } else {
    by = 'heuristic';
    features = metric === 'Gravity' ? gravityFeatures(signals, col) : trajectoryFeatures(signals, col);
    score = blend(features.map((f) => f.contribution));
    rationale = metric === 'Gravity' ? gravityRationale(signals) : trajectoryRationale(signals);
  }

  return {
    metric,
    score,
    weight,
    percentile: percentileOf(score, col),
    confidence,
    completeness: round2(completeness),
    agreement,
    rationale,
    features,
    receipts: orderReceipts(features),
    z: round2(zScore(score, col)),
    by,
  };
}
