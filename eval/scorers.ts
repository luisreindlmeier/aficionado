import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';

// A Mastra scorer for the calibration set: it scores a founder evaluation 1.0 when
// it lands its calibrated band, composite range, confidence, metric exclusions and
// red-flag cap, and 0 otherwise. Deterministic (no LLM), so it is a stable CI gate.
const metricList = z.array(z.enum(['Proof', 'Gravity', 'Trajectory']));

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

export const bandCalibrationScorer = createScorer({
  id: 'band-calibration',
  description:
    'Scores 1 when a founder evaluation lands its calibrated band, composite range, ' +
    'confidence, metric exclusions and red-flag cap; 0 otherwise.',
  input: z.object({
    band: z.string(),
    compositeLo: z.number(),
    compositeHi: z.number(),
    confidence: z.string(),
    excluded: metricList,
    capped: z.boolean(),
  }),
  output: z.object({
    band: z.string(),
    composite: z.number(),
    confidence: z.string(),
    excluded: metricList,
    capped: z.boolean(),
  }),
}).generateScore(({ run }) => {
  const e = run.input;
  const a = run.output;
  const inRange = a.composite >= e.compositeLo && a.composite <= e.compositeHi;
  const ok =
    a.band === e.band &&
    inRange &&
    a.confidence === e.confidence &&
    sameSet(a.excluded, e.excluded) &&
    a.capped === e.capped;
  return ok ? 1 : 0;
});
