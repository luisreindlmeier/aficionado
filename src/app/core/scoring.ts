import type { Metric } from './metrics';
import type {
  AnchorFounder,
  Band,
  ConfidenceLevel,
  RedFlag,
  SkillVector,
  TeamAnalysis,
  WeightPreset,
} from './model';

// ─────────────────────────────────────────────────────────────
// Deterministic scoring: the REDUCER. No LLM here. Given features
// (already extracted from evidence) and the anchor set, this math
// is reproducible and identical across the seed generator, the UI,
// and the live /api reducer. The recipe per metric:
//   1) LLM extracts features from raw evidence (elsewhere).
//   2) log-scale count features:        log10(x + 1)
//   3) quality-weight                   (network authority / CVALUE)
//   4) z-normalize vs the ANCHOR SET    z = (x - mean) / std
//   5) squash to 0..100 and weighted-sum -> composite
//   6) confidence = completeness x cross-source agreement
//   7) red-flag gate CAPS the composite
//   8) calibrate to a percentile vs anchors
// ─────────────────────────────────────────────────────────────

export const METRICS: readonly Metric[] = ['Proof', 'Gravity', 'Trajectory'];

/** log-scale a raw count so 10x growth is a constant step. */
export function log10p(x: number): number {
  return Math.log10(Math.max(0, x) + 1);
}

export function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function std(xs: readonly number[]): number {
  if (xs.length < 2) return 1;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v) || 1;
}

/** z-score of value against a reference distribution. */
export function zScore(value: number, reference: readonly number[]): number {
  return (value - mean(reference)) / std(reference);
}

/** Squash a z-score into 0..100. Each standard deviation ~ 16.7 points, so a
 *  value roughly +/-3 sigma from the mean spans the full range. Clamped to
 *  [2, 99] so nothing reads as a fake absolute 0 or 100. */
export function squash(z: number): number {
  return clamp(Math.round(50 + 16.7 * z), 2, 99);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Percentile of a value against the anchor set: share of anchors below it. */
export function percentileOf(value: number, reference: readonly number[]): number {
  if (!reference.length) return 50;
  const below = reference.filter((r) => r < value).length;
  const equal = reference.filter((r) => r === value).length;
  return clamp(Math.round(((below + equal / 2) / reference.length) * 100), 1, 99);
}

/** Score one metric from its anchor column: log-scale is assumed already applied
 *  to `value` and the `anchorValues` (both are 0..100-ish metric magnitudes). */
export function scoreAgainstAnchors(
  value: number,
  anchorValues: readonly number[],
): { score: number; percentile: number; z: number } {
  const z = zScore(value, anchorValues);
  return { score: squash(z), percentile: percentileOf(value, anchorValues), z };
}

/** Confidence = evidence completeness x cross-source agreement, bucketed. */
export function confidenceOf(completeness: number, agreement: number): ConfidenceLevel {
  const c = clamp(completeness, 0, 1) * clamp(agreement, 0, 1);
  if (c >= 0.6) return 'high';
  if (c >= 0.33) return 'medium';
  return 'low';
}

export function weakest(...levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.includes('low')) return 'low';
  if (levels.includes('medium')) return 'medium';
  return 'high';
}

/** Weighted sum of the three metric scores. Weights need not be pre-normalized. */
export function compositeOf(
  scores: Record<Metric, number>,
  weights: Record<Metric, number>,
): number {
  const wsum = METRICS.reduce((a, m) => a + weights[m], 0) || 1;
  const raw = METRICS.reduce((a, m) => a + scores[m] * weights[m], 0) / wsum;
  return Math.round(raw);
}

/** Composite over only the metrics we actually trust. A low-confidence metric
 *  (e.g. Gravity with no social footprint yet) is EXCLUDED and its weight is
 *  redistributed, rather than emitting a number we do not believe and letting
 *  it drag the score down. Mirrors "do not emit a number on thin evidence".
 *  Returns the composite plus which metrics were excluded. */
export function confidentComposite(
  scores: Record<Metric, number>,
  confidences: Record<Metric, ConfidenceLevel>,
  weights: Record<Metric, number>,
): { value: number; excluded: Metric[] } {
  const trusted = METRICS.filter((m) => confidences[m] !== 'low');
  const excluded = METRICS.filter((m) => confidences[m] === 'low');
  const use = trusted.length ? trusted : METRICS; // never divide by zero
  const wsum = use.reduce((a, m) => a + weights[m], 0) || 1;
  const raw = use.reduce((a, m) => a + scores[m] * weights[m], 0) / wsum;
  return { value: Math.round(raw), excluded: trusted.length ? excluded : [] };
}

/** Overall confidence never exceeds the confidence of the trusted metrics, and
 *  is knocked down a level when a metric had to be excluded. */
export function overallConfidence(confidences: Record<Metric, ConfidenceLevel>): ConfidenceLevel {
  const trusted = METRICS.filter((m) => confidences[m] !== 'low');
  const base = weakest(...trusted.map((m) => confidences[m]));
  const hasExcluded = trusted.length < METRICS.length;
  if (!hasExcluded) return base;
  return base === 'high' ? 'medium' : 'low';
}

/** Red-flag gate: a coherence + background cap. Contradictions, overclaiming and
 *  feedback-resistance CAP the final score, they do not just subtract from it. */
export function redFlagGate(
  rawComposite: number,
  flags: readonly RedFlag[],
): { value: number; capped: boolean; reason?: string } {
  const high = flags.filter((f) => f.severity === 'high').length;
  const medium = flags.filter((f) => f.severity === 'medium').length;
  let cap = 100;
  if (high >= 1) cap = Math.min(cap, 55 - (high - 1) * 10);
  if (medium >= 1) cap = Math.min(cap, 78 - (medium - 1) * 6);
  cap = clamp(cap, 20, 100);
  if (rawComposite <= cap) return { value: rawComposite, capped: false };
  const worst = high ? 'a critical' : 'an unresolved';
  return {
    value: cap,
    capped: true,
    reason: `Capped at ${cap} by the red-flag gate (${worst} coherence/background flag).`,
  };
}

/** Decision band. Low confidence never emits an Invest: it routes to a human. */
export function bandOf(composite: number, confidence: ConfidenceLevel): Band {
  if (confidence === 'low') return composite >= 50 ? 'Watch' : 'Pass';
  if (composite >= 70) return 'Invest';
  if (composite >= 48) return 'Watch';
  return 'Pass';
}

/** True when the profile is too thin to emit a number; route to a human. */
export function routeToHuman(confidence: ConfidenceLevel, evidenceCount: number): boolean {
  return confidence === 'low' || evidenceCount < 3;
}

/** Composite of every anchor at the given weights (for percentile + neighbour). */
export function anchorComposites(
  anchors: readonly AnchorFounder[],
  weights: Record<Metric, number>,
): number[] {
  return anchors.map((a) =>
    compositeOf({ Proof: a.proof, Gravity: a.gravity, Trajectory: a.trajectory }, weights),
  );
}

/** Nearest anchor by composite, for the "sits next to X" calibration line. A
 *  clean founder never sits next to a cautionary tale, and never next to itself. */
export function nearestAnchor(
  composite: number,
  anchors: readonly AnchorFounder[],
  weights: Record<Metric, number>,
  opts: { excludeName?: string; allowFailed?: boolean } = {},
): AnchorFounder | undefined {
  let best: AnchorFounder | undefined;
  let bestD = Infinity;
  for (const a of anchors) {
    if (opts.excludeName && a.name === opts.excludeName) continue;
    if (a.outcome === 'failed' && !opts.allowFailed) continue;
    const ac = compositeOf(
      { Proof: a.proof, Gravity: a.gravity, Trajectory: a.trajectory },
      weights,
    );
    const d = Math.abs(ac - composite);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

/** Recompute the weight-dependent parts of a score for live re-ranking (the
 *  Settings sliders). Metric scores are weight-independent; only the composite,
 *  band, percentile and neighbour move. Mirrors the offline seed generator. */
export function recomputeComposite(
  metricScores: Record<Metric, number>,
  confidences: Record<Metric, ConfidenceLevel>,
  redFlags: readonly RedFlag[],
  weights: Record<Metric, number>,
  anchors: readonly AnchorFounder[],
  selfName?: string,
): {
  composite: number;
  rawComposite: number;
  percentile: number;
  band: Band;
  confidence: ConfidenceLevel;
  capped: boolean;
  capReason?: string;
  anchorNeighbor?: string;
  excluded: Metric[];
} {
  const { value: rawComposite, excluded } = confidentComposite(metricScores, confidences, weights);
  const gate = redFlagGate(rawComposite, redFlags);
  const confidence = overallConfidence(confidences);
  const band = bandOf(gate.value, confidence);
  const percentile = percentileOf(gate.value, anchorComposites(anchors, weights));
  const neighbor = nearestAnchor(gate.value, anchors, weights, {
    excludeName: selfName,
    allowFailed: gate.capped,
  });
  return {
    composite: gate.value,
    rawComposite,
    percentile,
    band,
    confidence,
    capped: gate.capped,
    capReason: gate.reason,
    anchorNeighbor: neighbor?.display ?? neighbor?.name,
    excluded,
  };
}

// Team complementarity ─────────────────────────────────────────

export const SKILL_AXES: readonly (keyof SkillVector)[] = [
  'technical',
  'commercial',
  'domain',
  'product',
];

/** Combined coverage = the best of each axis across the team (max, not sum). */
export function combineSkills(vectors: readonly SkillVector[]): SkillVector {
  const pick = (k: keyof SkillVector) => Math.max(0, ...vectors.map((v) => v[k]));
  return {
    technical: pick('technical'),
    commercial: pick('commercial'),
    domain: pick('domain'),
    product: pick('product'),
  };
}

/** What the team pass needs per founder: identity, the three metric scores the
 *  aficionado score is built from, and the skill vector behind them. */
export interface TeamFounderInput {
  readonly founderId: string;
  readonly name: string;
  readonly initials: string;
  readonly skills: SkillVector;
  readonly metrics: Readonly<Record<Metric, number>>;
  readonly confidences: Readonly<Record<Metric, ConfidenceLevel>>;
  readonly composite: number;
  readonly band: Band;
}

/** Harmonized team score, on exactly the same scale as a founder composite.
 *  Every number in the team block is produced by the SAME reducer a founder
 *  goes through: same weights, same confidence rules, same exclusion of a
 *  metric we cannot verify. That is what makes the team row comparable to the
 *  founder rows above it instead of a second, incompatible arithmetic.
 *
 *    average       = the plain mean of the founders on each metric, the row you
 *                    can verify by eye against the rows above it.
 *    base          = that average profile through the founder composite.
 *    coverage      = the best founder on each metric, preferring one we trust.
 *                    One founder carrying a metric carries it for the team,
 *                    including its confidence: a co-founder with a real
 *                    footprint makes the team's Gravity measurable even when the
 *                    other founder's was excluded.
 *    compatibility = coverage composite / base. Exactly the lift the team gets
 *                    from founders covering each other's weak metrics, so
 *                    complementarity is counted once and nowhere else.
 *    score         = base x compatibility
 *
 *  Deterministic for now; a future pass hands this to an agent for a narrative
 *  read grounded in shared history and working style. Solo founders have no team
 *  to harmonize, so this returns undefined below two founders. */
export function harmonizedTeamScore(
  founders: readonly TeamFounderInput[],
  weights: Record<Metric, number>,
): Omit<TeamAnalysis, 'sharedHistory'> | undefined {
  if (founders.length < 2) return undefined;
  const vectors = founders.map((f) => f.skills);
  const coverage = combineSkills(vectors);
  const gaps = SKILL_AXES.filter((a) => coverage[a] < 0.5);
  // Redundancy: two founders both strong on the same axis, covering the same
  // ground. Descriptive only, it does not move the score; overlap is already
  // what pulls compatibility down.
  const redundancies = SKILL_AXES.filter((a) => vectors.filter((v) => v[a] >= 0.6).length >= 2);

  const average = {} as Record<Metric, number>;
  const covered = {} as Record<Metric, number>;
  const confidence = {} as Record<Metric, ConfidenceLevel>;
  const liftedBy = {} as Record<Metric, string>;
  for (const m of METRICS) {
    average[m] = mean(founders.map((f) => f.metrics[m]));
    const trusted = founders.filter((f) => f.confidences[m] !== 'low');
    const pool = trusted.length ? trusted : founders;
    const best = pool.reduce((a, b) => (b.metrics[m] > a.metrics[m] ? b : a));
    covered[m] = best.metrics[m];
    confidence[m] = best.confidences[m];
    liftedBy[m] = best.initials;
  }

  const base = confidentComposite(average, confidence, weights).value;
  const coverageComposite = confidentComposite(covered, confidence, weights).value;
  const compatibility =
    base > 0 ? Math.round(clamp(coverageComposite / base, 1, 1.5) * 100) / 100 : 1;

  return {
    score: clamp(Math.round(base * compatibility), 1, 99),
    base,
    coverageComposite,
    confidence: overallConfidence(confidence),
    coverage,
    gaps: gaps.map((a) => `${axisLabel(a)} coverage is thin across the team`),
    redundancies: redundancies.map(
      (a) => `Overlap on ${axisLabel(a)}, more than one founder covers it`,
    ),
    metricAverage: {
      Proof: Math.round(average.Proof),
      Gravity: Math.round(average.Gravity),
      Trajectory: Math.round(average.Trajectory),
    },
    metricCoverage: covered,
    metricConfidence: confidence,
    metricLiftedBy: liftedBy,
    compatibility,
    perFounder: founders.map((f) => ({
      founderId: f.founderId,
      name: f.name,
      initials: f.initials,
      skills: f.skills,
      metrics: f.metrics,
      confidences: f.confidences,
      composite: f.composite,
      band: f.band,
    })),
  };
}

/** Who leads each metric, for the matrix footer ("Stefan carries Gravity"). */
export function metricLeaders(
  founders: readonly TeamFounderInput[],
): Readonly<Record<Metric, string>> {
  const lead = (m: Metric) =>
    founders.reduce((a, b) => (b.metrics[m] > a.metrics[m] ? b : a)).initials;
  return { Proof: lead('Proof'), Gravity: lead('Gravity'), Trajectory: lead('Trajectory') };
}

function axisLabel(axis: keyof SkillVector): string {
  return `${axis[0].toUpperCase()}${axis.slice(1)}`;
}

// Weight presets ───────────────────────────────────────────────

export const WEIGHT_PRESETS: readonly WeightPreset[] = [
  {
    id: 'maschmeyer',
    label: 'Maschmeyer preset',
    weights: { Proof: 0.35, Gravity: 0.45, Trajectory: 0.2 },
    description:
      'Leans on Gravity, the attract-and-sell lens. People, capital and attention moving toward the founder weigh most, matching a sales-first thesis.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    weights: { Proof: 0.4, Gravity: 0.4, Trajectory: 0.2 },
    description:
      'The default. Equal weight on demonstrated building and on pull, with momentum as the tie-breaker.',
  },
  {
    id: 'builder',
    label: 'Builder-first',
    weights: { Proof: 0.55, Gravity: 0.2, Trajectory: 0.25 },
    description:
      'For deep-tech theses: what they have shipped dominates, network pull matters least.',
  },
  {
    id: 'momentum',
    label: 'Momentum',
    weights: { Proof: 0.3, Gravity: 0.3, Trajectory: 0.4 },
    description: 'For pre-idea and first-time founders: slope over position. Rewards acceleration.',
  },
];

export const DEFAULT_PRESET = WEIGHT_PRESETS[0]; // Maschmeyer preset ships as default
