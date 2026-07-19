import { afterAll, describe, expect, it } from 'vitest';
import type { Metric } from '../src/app/core/metrics';
import type { Band, ConfidenceLevel, SkillVector } from '../src/app/core/model';
import {
  anchorComposites,
  bandOf,
  confidentComposite,
  nearestAnchor,
  overallConfidence,
  percentileOf,
  recomputeComposite,
  redFlagGate,
  routeToHuman,
  harmonizedTeamScore,
} from '../src/app/core/scoring';
import { ANCHORS } from '../src/app/core/data/anchors';
import {
  CALIBRATED_MASCHMEYER_WEIGHTS,
  CASES,
  MASCHMEYER_WEIGHTS,
  type CalibrationCase,
} from './cases';

// ─────────────────────────────────────────────────────────────
// CALIBRATION EVAL. For every known case we run the ACTUAL scoring
// pipeline from src/app/core/scoring.ts with the Maschmeyer weights
// and the real ANCHORS, then assert band / composite-range /
// confidence / exclusions / red-flag cap. A console DRIFT REPORT
// prints expected-vs-actual so a lead can eyeball movement.
// Run: npx vitest run --config eval/vitest.config.ts
// ─────────────────────────────────────────────────────────────

const W = MASCHMEYER_WEIGHTS;
/** anchorComposites() over the real ANCHORS, once, for percentiles + neighbours. */
const ANCHOR_COMPOSITES = anchorComposites(ANCHORS, W);

interface Actual {
  readonly rawComposite: number;
  readonly composite: number;
  readonly capped: boolean;
  readonly capReason?: string;
  readonly excluded: readonly Metric[];
  readonly confidence: ConfidenceLevel;
  readonly band: Band;
  readonly percentile: number;
  readonly neighbor?: string;
  readonly routeToHuman: boolean;
}

/** The deterministic pipeline, wired from the individual scoring functions the
 *  seed generator and the live reducer both use. */
function runCase(c: CalibrationCase): Actual {
  const { value: rawComposite, excluded } = confidentComposite(c.scores, c.confidence, W);
  const gate = redFlagGate(rawComposite, c.redFlags);
  const confidence = overallConfidence(c.confidence);
  const band = bandOf(gate.value, confidence);
  const percentile = percentileOf(gate.value, ANCHOR_COMPOSITES);
  const neighbor = nearestAnchor(gate.value, ANCHORS, W, {
    excludeName: c.name,
    allowFailed: gate.capped,
  });
  return {
    rawComposite,
    composite: gate.value,
    capped: gate.capped,
    capReason: gate.reason,
    excluded,
    confidence,
    band,
    percentile,
    neighbor: neighbor?.display ?? neighbor?.name,
    routeToHuman: routeToHuman(confidence, c.evidenceCount),
  };
}

const RESULTS: readonly { c: CalibrationCase; a: Actual }[] = CASES.map((c) => ({
  c,
  a: runCase(c),
}));

const inRange = (x: number, [lo, hi]: readonly [number, number]) => x >= lo && x <= hi;
const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

/** Every way an actual score can differ from its calibrated expectation. Empty
 *  array == on calibration. Drives both the assertions and the drift report. */
function driftReasons(c: CalibrationCase, a: Actual): string[] {
  const e = c.expected;
  const r: string[] = [];
  if (a.band !== e.band) r.push(`band ${a.band} != ${e.band}`);
  if (!inRange(a.composite, e.composite)) {
    r.push(`composite ${a.composite} outside [${e.composite[0]}-${e.composite[1]}]`);
  }
  if (a.confidence !== e.confidence) r.push(`confidence ${a.confidence} != ${e.confidence}`);
  if (a.capped !== e.capped) r.push(`capped ${a.capped} != ${e.capped}`);
  if (!sameSet(a.excluded, e.excluded)) {
    r.push(`excluded [${a.excluded.join(',')}] != [${e.excluded.join(',')}]`);
  }
  if (e.routeToHuman !== undefined && a.routeToHuman !== e.routeToHuman) {
    r.push(`routeToHuman ${a.routeToHuman} != ${e.routeToHuman}`);
  }
  if (e.percentile && !inRange(a.percentile, e.percentile)) {
    r.push(`percentile ${a.percentile} outside [${e.percentile[0]}-${e.percentile[1]}]`);
  }
  return r;
}

// ── Per-case calibration ─────────────────────────────────────
describe('calibration set (Maschmeyer preset)', () => {
  for (const { c, a } of RESULTS) {
    describe(`${c.id}: ${c.name}`, () => {
      it(`lands in band ${c.expected.band}`, () => {
        expect(a.band).toBe(c.expected.band);
      });
      it(`composite ${a.composite} within [${c.expected.composite[0]}-${c.expected.composite[1]}]`, () => {
        expect(inRange(a.composite, c.expected.composite)).toBe(true);
      });
      it(`reports ${c.expected.confidence} confidence`, () => {
        expect(a.confidence).toBe(c.expected.confidence);
      });
      it(`excludes exactly [${c.expected.excluded.join(',') || '∅'}]`, () => {
        expect(sameSet(a.excluded, c.expected.excluded)).toBe(true);
      });
      it(`red-flag gate ${c.expected.capped ? 'caps' : 'does not cap'}`, () => {
        expect(a.capped).toBe(c.expected.capped);
        if (c.expected.capped) {
          expect(a.composite).toBeLessThan(a.rawComposite);
          expect(a.capReason).toBeTruthy();
          expect(a.band).not.toBe('Invest'); // a capped founder is never an Invest
        }
      });
      if (c.expected.routeToHuman !== undefined) {
        it(`${c.expected.routeToHuman ? 'routes to a human' : 'does not route to a human'}`, () => {
          expect(a.routeToHuman).toBe(c.expected.routeToHuman);
        });
      }
      if (c.expected.percentile) {
        it(`percentile ${a.percentile} within [${c.expected.percentile[0]}-${c.expected.percentile[1]}]`, () => {
          expect(inRange(a.percentile, c.expected.percentile!)).toBe(true);
        });
      }
      it('nearest anchor is defined and never the founder itself', () => {
        expect(a.neighbor).toBeTruthy();
        expect(a.neighbor).not.toBe(c.name);
      });
      it('recomputeComposite() agrees with the wired pipeline', () => {
        const re = recomputeComposite(c.scores, c.confidence, c.redFlags, W, ANCHORS, c.name);
        expect(re.composite).toBe(a.composite);
        expect(re.rawComposite).toBe(a.rawComposite);
        expect(re.band).toBe(a.band);
        expect(re.confidence).toBe(a.confidence);
        expect(re.capped).toBe(a.capped);
        expect(re.percentile).toBe(a.percentile);
        expect(sameSet(re.excluded, a.excluded)).toBe(true);
      });
    });
  }
});

// ── The two headline invariants, called out explicitly ───────
describe('invariants the pitch leans on', () => {
  it('the low-confidence-Gravity founder excludes Gravity and stays Watch/medium (Luis / gedonus)', () => {
    const { c, a } = RESULTS.find((r) => r.c.id === 'luis-gedonus')!;
    expect(a.excluded).toEqual(['Gravity']);
    expect(a.band).toBe('Watch');
    expect(a.confidence).toBe('medium');
    expect(a.routeToHuman).toBe(false);
    // Sanity: this reproduces the shipped dossier number.
    expect(a.composite).toBe(62);
    expect(c.expected.band).toBe('Watch');
  });

  it('the overclaiming founder is capped and never Invest (Holmes-style)', () => {
    const { a } = RESULTS.find((r) => r.c.id === 'holmes-style')!;
    expect(a.capped).toBe(true);
    expect(a.rawComposite).toBeGreaterThanOrEqual(70); // would have been an Invest
    expect(a.composite).toBeLessThanOrEqual(55); // the gate pulled it under
    expect(a.band).not.toBe('Invest');
  });
});

// ── Property / monotonicity tests ────────────────────────────
describe('properties', () => {
  it('the shipped Maschmeyer preset still equals the calibrated weights', () => {
    // If this fails, every expected composite above is calibrated to stale weights.
    expect(MASCHMEYER_WEIGHTS).toEqual(CALIBRATED_MASCHMEYER_WEIGHTS);
  });

  it('raising trusted Gravity never lowers the composite', () => {
    for (const conf of [
      { Proof: 'high', Gravity: 'high', Trajectory: 'high' },
      { Proof: 'low', Gravity: 'high', Trajectory: 'high' }, // Gravity still trusted, Proof excluded
    ] as const) {
      for (const Proof of [10, 40, 70, 95]) {
        for (const Trajectory of [10, 50, 90]) {
          let prev = -1;
          for (let Gravity = 0; Gravity <= 100; Gravity += 5) {
            const { value } = confidentComposite({ Proof, Gravity, Trajectory }, conf, W);
            expect(value).toBeGreaterThanOrEqual(prev);
            prev = value;
          }
        }
      }
    }
  });

  it('a single high-severity flag caps the composite to <= 55 and blocks Invest', () => {
    const flag = [{ text: 'x', note: 'y', severity: 'high' as const }];
    for (let raw = 0; raw <= 99; raw += 3) {
      const gated = redFlagGate(raw, flag);
      expect(gated.value).toBeLessThanOrEqual(55);
      expect(bandOf(gated.value, 'high')).not.toBe('Invest');
    }
  });

  it('low overall confidence never emits Invest', () => {
    for (let x = 0; x <= 100; x += 5) {
      expect(bandOf(x, 'low')).not.toBe('Invest');
    }
  });

  it('percentile vs the anchor set is bounded [1,99] and non-decreasing in composite', () => {
    let prev = -1;
    for (let x = 0; x <= 100; x += 2) {
      const p = percentileOf(x, ANCHOR_COMPOSITES);
      expect(p).toBeGreaterThanOrEqual(1);
      expect(p).toBeLessThanOrEqual(99);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('a clean (uncapped) founder never sits next to a failed anchor', () => {
    const clean = nearestAnchor(72, ANCHORS, W, { allowFailed: false });
    expect(clean?.outcome).not.toBe('failed');
  });

  it('a solo founder has no team to harmonize (returns undefined, never a penalty)', () => {
    const solos: SkillVector[] = [
      { technical: 0.9, commercial: 0.2, domain: 0.2, product: 0.2 },
      { technical: 0.1, commercial: 0.1, domain: 0.1, product: 0.1 },
      { technical: 0.8, commercial: 0.8, domain: 0.8, product: 0.8 },
    ];
    for (const v of solos) {
      expect(harmonizedTeamScore([{ skills: v, composite: 70 }])).toBeUndefined();
    }
  });

  it('a complementary two-founder team beats a redundant one', () => {
    const complementary = harmonizedTeamScore([
      { skills: { technical: 0.9, commercial: 0.2, domain: 0.2, product: 0.8 }, composite: 70 },
      { skills: { technical: 0.2, commercial: 0.9, domain: 0.85, product: 0.2 }, composite: 70 },
    ])!;
    const redundant = harmonizedTeamScore([
      { skills: { technical: 0.9, commercial: 0.2, domain: 0.2, product: 0.2 }, composite: 70 },
      { skills: { technical: 0.85, commercial: 0.2, domain: 0.2, product: 0.2 }, composite: 70 },
    ])!;
    expect(complementary.score).toBeGreaterThan(redundant.score);
    expect(complementary.gaps.length).toBe(0); // full coverage
    expect(redundant.redundancies.length).toBeGreaterThan(0); // overlap flagged
  });
});

// ── Drift summary (single high-level assertion) ──────────────
describe('drift', () => {
  it('no case has drifted from its calibrated expectation', () => {
    const drifted = RESULTS.filter(({ c, a }) => driftReasons(c, a).length > 0).map(({ c, a }) => ({
      id: c.id,
      reasons: driftReasons(c, a),
    }));
    expect(drifted).toEqual([]);
  });
});

// ── Console DRIFT REPORT ─────────────────────────────────────
afterAll(() => {
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  const lines: string[] = [];
  lines.push('');
  lines.push('════════════════════════════════════════════════════════════════════════════');
  lines.push('  CALIBRATION DRIFT REPORT: Maschmeyer preset (Proof .35 / Gravity .45 / Traj .20)');
  lines.push('════════════════════════════════════════════════════════════════════════════');
  lines.push(
    `  ${pad('case', 24)}${pad('expected', 20)}${pad('actual', 20)}${pad('cap', 5)}status`,
  );
  lines.push('  ' + '-'.repeat(74));
  let ok = 0;
  for (const { c, a } of RESULTS) {
    const reasons = driftReasons(c, a);
    if (reasons.length === 0) ok += 1;
    const expected = `${c.expected.band} [${c.expected.composite[0]}-${c.expected.composite[1]}]`;
    const actual = `${a.band} ${a.composite} (${a.confidence[0]})`;
    const status = reasons.length === 0 ? 'PASS' : 'DRIFT: ' + reasons.join('; ');
    lines.push(
      `  ${pad(c.id, 24)}${pad(expected, 20)}${pad(actual, 20)}${pad(a.capped ? 'Y' : '-', 5)}${status}`,
    );
  }
  lines.push('  ' + '-'.repeat(74));
  lines.push(`  ${ok}/${RESULTS.length} cases on calibration, ${RESULTS.length - ok} drifted.`);
  lines.push('════════════════════════════════════════════════════════════════════════════');
  lines.push('');
  console.log(lines.join('\n'));
});
