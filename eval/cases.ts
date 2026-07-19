import type { Band, ConfidenceLevel, RedFlag } from '../src/app/core/model';
import type { Metric } from '../src/app/core/metrics';
import { WEIGHT_PRESETS } from '../src/app/core/scoring';

// ─────────────────────────────────────────────────────────────
// The CALIBRATION SET. Each case is a founder profile with KNOWN,
// hand-checked expectations: which band the deterministic scorer
// must land, what composite RANGE is acceptable, the confidence it
// must report, which low-confidence metrics it must exclude, and
// whether the red-flag gate must cap it. We run the ACTUAL scoring
// functions against these and measure drift. Draw from the anchor
// set (data/anchors.ts) plus a few realistic holdouts.
// ─────────────────────────────────────────────────────────────

/** The preset we calibrate against: the shipped Maschmeyer weights. We read the
 *  REAL preset from scoring.ts (not a copy) so a change to the shipped weights
 *  surfaces as drift here instead of being silently absorbed. */
const preset = WEIGHT_PRESETS.find((p) => p.id === 'maschmeyer');
if (!preset) throw new Error('Maschmeyer preset missing from WEIGHT_PRESETS');
export const MASCHMEYER = preset;
export const MASCHMEYER_WEIGHTS: Record<Metric, number> = preset.weights;

/** What the Maschmeyer weights were when this calibration set was authored. A
 *  guard test asserts the shipped preset still equals this; if it changes, every
 *  expected composite below is stale and the drift report will say so loudly. */
export const CALIBRATED_MASCHMEYER_WEIGHTS: Record<Metric, number> = {
  Proof: 0.35,
  Gravity: 0.45,
  Trajectory: 0.2,
};

export interface CalibrationCase {
  readonly id: string;
  readonly name: string;
  /** Why this case exists / what property it pins down. */
  readonly note: string;
  readonly scores: Record<Metric, number>;
  readonly confidence: Record<Metric, ConfidenceLevel>;
  readonly redFlags: readonly RedFlag[];
  readonly evidenceCount: number;
  readonly expected: {
    readonly band: Band;
    /** Inclusive [lo, hi] composite range, after the red-flag gate. */
    readonly composite: readonly [number, number];
    readonly confidence: ConfidenceLevel;
    /** Metrics that must be EXCLUDED from the composite (low confidence). */
    readonly excluded: readonly Metric[];
    /** Must the red-flag gate have capped the raw composite? */
    readonly capped: boolean;
    readonly routeToHuman?: boolean;
    /** Optional inclusive percentile bounds vs the anchor set. */
    readonly percentile?: readonly [number, number];
  };
}

const HIGH: Record<Metric, ConfidenceLevel> = {
  Proof: 'high',
  Gravity: 'high',
  Trajectory: 'high',
};

const lowFlag = (text: string, note: string): RedFlag => ({ text, note, severity: 'low' });

export const CASES: readonly CalibrationCase[] = [
  // ── Clear INVEST: proven founders ────────────────────────────
  {
    id: 'patrick-collison',
    name: 'Patrick Collison',
    note: 'Top-of-set proven founder (Stripe). Anchors the ceiling: Invest, top percentile.',
    scores: { Proof: 96, Gravity: 95, Trajectory: 84 },
    confidence: HIGH,
    redFlags: [],
    evidenceCount: 9,
    expected: {
      band: 'Invest',
      composite: [90, 96],
      confidence: 'high',
      excluded: [],
      capped: false,
      percentile: [90, 99],
    },
  },
  {
    id: 'peter-steinberger',
    name: 'Peter Steinberger',
    note: 'Real seed founder (PSPDFKit → agent tooling). Reproduces the shipped dossier: 82, Invest, high.',
    scores: { Proof: 90, Gravity: 81, Trajectory: 70 },
    confidence: HIGH,
    redFlags: [
      lowFlag('Serial founder energy across many repos', 'Focus risk, not a coherence flag'),
    ],
    evidenceCount: 5,
    expected: {
      band: 'Invest',
      composite: [78, 86],
      confidence: 'high',
      excluded: [],
      capped: false,
    },
  },
  {
    id: 'guillermo-rauch',
    name: 'Guillermo Rauch',
    note: 'Real seed founder (Vercel). High Proof/Gravity, cold Trajectory. Reproduces 76, Invest, high.',
    scores: { Proof: 91, Gravity: 84, Trajectory: 30 },
    confidence: HIGH,
    redFlags: [],
    evidenceCount: 6,
    expected: {
      band: 'Invest',
      composite: [72, 80],
      confidence: 'high',
      excluded: [],
      capped: false,
    },
  },
  {
    id: 'alexandr-wang',
    name: 'Alexandr Wang',
    note: 'Younger, gravity-and-slope led (Scale AI). Invest driven by Gravity under the Maschmeyer lens.',
    scores: { Proof: 66, Gravity: 89, Trajectory: 85 },
    confidence: HIGH,
    redFlags: [],
    evidenceCount: 5,
    expected: {
      band: 'Invest',
      composite: [76, 84],
      confidence: 'high',
      excluded: [],
      capped: false,
    },
  },
  {
    id: 'evan-you',
    name: 'Evan You',
    note: 'Real seed founder (Vue/Vite → VoidZero). MEDIUM confidence still reaches Invest (only LOW is blocked). Reproduces 75, Invest, medium.',
    scores: { Proof: 91, Gravity: 86, Trajectory: 21 },
    confidence: { Proof: 'high', Gravity: 'high', Trajectory: 'medium' },
    redFlags: [],
    evidenceCount: 6,
    expected: {
      band: 'Invest',
      composite: [70, 80],
      confidence: 'medium',
      excluded: [],
      capped: false,
    },
  },

  // ── WATCH: the mid-band ──────────────────────────────────────
  {
    id: 'repeat-second-time',
    name: 'a repeat second-time founder',
    note: 'Credible, mid pull, steady. Clean Watch at high confidence.',
    scores: { Proof: 62, Gravity: 58, Trajectory: 60 },
    confidence: HIGH,
    redFlags: [],
    evidenceCount: 4,
    expected: {
      band: 'Watch',
      composite: [56, 64],
      confidence: 'high',
      excluded: [],
      capped: false,
    },
  },
  {
    id: 'community-first',
    name: 'a community-first founder',
    note: 'Audience ahead of product. Watch, knocked to medium confidence by a medium-confidence Trajectory.',
    scores: { Proof: 44, Gravity: 62, Trajectory: 58 },
    confidence: { Proof: 'high', Gravity: 'high', Trajectory: 'medium' },
    redFlags: [],
    evidenceCount: 4,
    expected: {
      band: 'Watch',
      composite: [50, 60],
      confidence: 'medium',
      excluded: [],
      capped: false,
    },
  },
  {
    id: 'bootstrapped-saas',
    name: 'a bootstrapped SaaS founder',
    note: 'Steady, unflashy, real revenue. Boundary case that must land just inside Watch, not Pass.',
    scores: { Proof: 52, Gravity: 46, Trajectory: 58 },
    confidence: HIGH,
    redFlags: [],
    evidenceCount: 4,
    expected: {
      band: 'Watch',
      composite: [48, 55],
      confidence: 'high',
      excluded: [],
      capped: false,
    },
  },

  // ── The LOW-CONFIDENCE-GRAVITY case: exclude + route to human ─
  {
    id: 'luis-gedonus',
    name: 'Luis Reindlmeier',
    note: 'The flagship confidence case (gedonus). Proof 62 high, Gravity 11 LOW, Trajectory 63 high. Gravity must be EXCLUDED (no social footprint), confidence knocked high→medium, lands Watch 62. Reproduces the shipped dossier exactly.',
    scores: { Proof: 62, Gravity: 11, Trajectory: 63 },
    confidence: { Proof: 'high', Gravity: 'low', Trajectory: 'high' },
    redFlags: [
      lowFlag('First-time founder, no prior exit', 'Expected at pre-seed, not disqualifying'),
      lowFlag(
        'Product in private pilot; external adoption not yet measurable',
        'Consistent with a launching-pilots stage',
      ),
    ],
    evidenceCount: 7,
    expected: {
      band: 'Watch',
      composite: [58, 66],
      confidence: 'medium',
      excluded: ['Gravity'],
      capped: false,
      percentile: [30, 45],
    },
  },

  // ── Clear PASS: idea-stage / thin ────────────────────────────
  {
    id: 'idea-stage-first-timer',
    name: 'an idea-stage first timer',
    note: 'No shipped proof, low momentum (a failed anchor). Anchors the floor: Pass, bottom percentile.',
    scores: { Proof: 30, Gravity: 28, Trajectory: 42 },
    confidence: HIGH,
    redFlags: [],
    evidenceCount: 3,
    expected: {
      band: 'Pass',
      composite: [28, 38],
      confidence: 'high',
      excluded: [],
      capped: false,
      percentile: [1, 10],
    },
  },
  {
    id: 'stalled-first-timer',
    name: 'a stalled first-timer',
    note: 'Momentum died after v1 (a failed anchor). Pass at medium confidence.',
    scores: { Proof: 40, Gravity: 34, Trajectory: 38 },
    confidence: { Proof: 'medium', Gravity: 'medium', Trajectory: 'medium' },
    redFlags: [],
    evidenceCount: 3,
    expected: {
      band: 'Pass',
      composite: [33, 42],
      confidence: 'medium',
      excluded: [],
      capped: false,
    },
  },
  {
    id: 'low-conf-route-to-human',
    name: 'a two-signals-missing holdout',
    note: 'Only Trajectory is trusted; Proof and Gravity are LOW and excluded. Overall confidence collapses to low, so it can NEVER emit Invest and must route to a human. Lands Pass.',
    scores: { Proof: 48, Gravity: 40, Trajectory: 45 },
    confidence: { Proof: 'low', Gravity: 'low', Trajectory: 'medium' },
    redFlags: [],
    evidenceCount: 2,
    expected: {
      band: 'Pass',
      composite: [40, 50],
      confidence: 'low',
      excluded: ['Proof', 'Gravity'],
      capped: false,
      routeToHuman: true,
    },
  },

  // ── The RED-FLAG GATE cases: the cap must bind ───────────────
  {
    id: 'holmes-style',
    name: 'an overclaiming founder (Holmes-style)',
    note: 'High proof-CLAIMS and high gravity would raw-score into Invest (~76), but one critical coherence flag CAPS it to 55. Must be capped, and never Invest.',
    scores: { Proof: 78, Gravity: 88, Trajectory: 45 },
    confidence: HIGH,
    redFlags: [
      {
        text: "Independently reported metrics contradict the founder's public claims",
        note: 'Critical coherence flag: demoed capability could not be reproduced',
        severity: 'high',
      },
    ],
    evidenceCount: 6,
    expected: {
      band: 'Watch',
      composite: [50, 58],
      confidence: 'high',
      excluded: [],
      capped: true,
    },
  },
  {
    id: 'adam-neumann',
    name: 'Adam Neumann',
    note: 'Huge gravity (WeWork) raw-scores to ~67, but a high-severity governance flag caps it to 55. Even overwhelming pull cannot buy an Invest through the gate.',
    scores: { Proof: 44, Gravity: 92, Trajectory: 50 },
    confidence: HIGH,
    redFlags: [
      {
        text: 'Serious governance and self-dealing concerns',
        note: 'Critical background flag on prior venture',
        severity: 'high',
      },
    ],
    evidenceCount: 6,
    expected: {
      band: 'Watch',
      composite: [50, 58],
      confidence: 'high',
      excluded: [],
      capped: true,
    },
  },
];
