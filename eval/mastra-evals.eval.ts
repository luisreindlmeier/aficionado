import { describe, expect, it } from 'vitest';
import { recomputeComposite } from '../src/app/core/scoring';
import { ANCHORS } from '../src/app/core/data/anchors';
import { CASES, MASCHMEYER_WEIGHTS } from './cases';
import { bandCalibrationScorer } from './scorers';

// ─────────────────────────────────────────────────────────────
// STEP 6: the known-founders -> expected-band calibration, ported to a Mastra
// scorer (createScorer, @mastra/core/evals). Each case runs the deterministic
// scoring pipeline (recomputeComposite) and the Mastra band-calibration scorer
// must return 1.0. Runs in CI/build via `pnpm eval`.
// ─────────────────────────────────────────────────────────────

const W = MASCHMEYER_WEIGHTS;

describe('Mastra eval: band-calibration scorer over the calibration set', () => {
  for (const c of CASES) {
    it(`${c.id} scores 1.0 (lands ${c.expected.band})`, async () => {
      const a = recomputeComposite(c.scores, c.confidence, c.redFlags, W, ANCHORS, c.name);
      const result = await bandCalibrationScorer.run({
        input: {
          band: c.expected.band,
          compositeLo: c.expected.composite[0],
          compositeHi: c.expected.composite[1],
          confidence: c.expected.confidence,
          excluded: [...c.expected.excluded],
          capped: c.expected.capped,
        },
        output: {
          band: a.band,
          composite: a.composite,
          confidence: a.confidence,
          excluded: [...a.excluded],
          capped: a.capped,
        },
      });
      expect(result.score).toBe(1);
    });
  }
});
