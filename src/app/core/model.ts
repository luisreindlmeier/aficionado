import type { Metric } from './metrics';
import type { ConnectorId, Signal } from './connectors/types';

// ─────────────────────────────────────────────────────────────
// Founder-first domain model. A FOUNDER carries the score and is
// the thing you click into. A VENTURE is a light grouping object
// that links founders and holds the problem context (for FMF and
// team complementarity). Company data is context on the founder,
// never the primary unit. Isomorphic: no Node or browser deps, so
// the UI, the /api backend, and a future MCP surface all share it.
// ─────────────────────────────────────────────────────────────

export type Band = 'Invest' | 'Watch' | 'Pass';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
/** Kanban tracking stage on the Pipeline page. Every founder starts
 *  'Discovered'; from there they're promoted (automatically by a matching
 *  sourcing pass, or manually) to 'Watch', and finally decided as 'Invest' or
 *  'Pass', the same vocabulary the scoring verdict (Band) already uses
 *  everywhere else in the app. */
export type PipelineStage = 'Discovered' | Band;

/** One atomic evidence receipt: a Signal plus provenance for the UI. */
export interface Receipt extends Signal {
  /** Which feature this evidence supports, e.g. "Shipping finish-rate". */
  readonly feature?: string;
  /** Short human-readable detail or quote shown under the receipt. */
  readonly quote?: string;
  /** Quality weight applied to this evidence (contribution value, network authority). */
  readonly weight?: number;
  /** ISO timestamp of the evidence, when known (drives the trajectory replay). */
  readonly at?: string;
}

/** A single scored feature within a metric (the atomic unit of the recipe). */
export interface Feature {
  readonly key: string;
  readonly label: string;
  /** Raw magnitude before any transform (stars, downloads, followers, ...). */
  readonly raw: number;
  /** Human display of the raw value, e.g. "53,661 stars". */
  readonly display: string;
  /** Z-score against the anchor set after log-scaling + quality-weighting. */
  readonly z: number;
  /** Points this feature contributed to the metric, in 0..100 space. */
  readonly contribution: number;
  readonly receipts: readonly Receipt[];
}

/** The scored outcome for one metric, with its full evidence trail. */
export interface MetricScore {
  readonly metric: Metric;
  readonly score: number; // 0..100
  readonly weight: number; // 0..1, from the active preset
  readonly percentile: number; // vs the anchor set
  readonly confidence: ConfidenceLevel;
  readonly completeness: number; // 0..1 evidence completeness
  readonly agreement: number; // 0..1 cross-source agreement
  readonly rationale: string;
  readonly features: readonly Feature[];
  /** Aggregated evidence receipts for this metric, strongest first (for the card). */
  readonly receipts?: readonly Receipt[];
  /** z-score of this metric against the anchor set (calibration transparency). */
  readonly z?: number;
  /** 'ai' when a model produced the score, 'heuristic' when scored locally. */
  readonly by: 'ai' | 'heuristic';
}

/** Skill-vector coverage used for team complementarity. Each axis 0..1. */
export interface SkillVector {
  readonly technical: number;
  readonly commercial: number;
  readonly domain: number;
  readonly product: number;
}

export interface RedFlag {
  readonly text: string;
  readonly note: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly source?: string;
  readonly url?: string;
}

/** A point on the trajectory replay (commit cadence, ships, Wayback snapshots). */
export interface TrajectoryPoint {
  readonly date: string; // 'YYYY-MM' or ISO
  readonly value: number; // activity magnitude, 0..100
  readonly label?: string;
  readonly kind?: 'commit' | 'ship' | 'snapshot' | 'press' | 'milestone';
  readonly url?: string;
}

/** Founder-market-fit: semantic similarity of the problem vs the footprint. */
export interface Fmf {
  readonly similarity: number; // 0..1
  readonly rationale: string;
  readonly receipts: readonly Receipt[];
}

/** The full computed score for a single founder. */
export interface FounderScore {
  readonly proof: MetricScore;
  readonly gravity: MetricScore;
  readonly trajectory: MetricScore;
  readonly composite: number; // weighted, after the red-flag gate, 0..100
  readonly rawComposite: number; // before the gate
  readonly percentile: number; // composite percentile vs anchors
  readonly band: Band;
  readonly confidence: ConfidenceLevel;
  readonly capped: boolean; // did the red-flag gate lower the score?
  readonly capReason?: string;
  readonly anchorNeighbor?: string; // "sits next to X"
  readonly skills: SkillVector;
}

export interface Handles {
  readonly github?: string;
  readonly x?: string;
  readonly linkedin?: string;
  readonly npm?: string;
  readonly pypi?: string;
  readonly website?: string;
  readonly scholar?: string;
}

/** Change since the last time a watched founder's metrics were checked, e.g.
 *  "+6" on Proof after a new release. Drives the acceleration hints shown on
 *  the Pipeline page's Watch column; absent when nothing has moved. */
export interface ScoreDelta {
  readonly composite: number;
  readonly proof?: number;
  readonly gravity?: number;
  readonly trajectory?: number;
  readonly since: string; // human label, e.g. "since last week"
}

/** First-class entity: carries the score, is what you click into. */
export interface Founder {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly headline: string;
  readonly location?: string;
  readonly handles: Handles;
  readonly ventureId: string;
  // Sourcing (Loop A)
  readonly discoveredAt: string; // ISO
  readonly thesisId: string;
  readonly triage: number; // 0..100 cheap discovery score
  readonly pipeline: PipelineStage;
  readonly scoreDelta?: ScoreDelta;
  // Evaluation (Loop B), present once evaluated
  readonly score?: FounderScore;
  readonly fmf?: Fmf;
  readonly redFlags: readonly RedFlag[];
  readonly trajectory: readonly TrajectoryPoint[];
  readonly evidenceCount: number;
  /** Honest gap note surfaced by the confidence system. */
  readonly note?: string;
}

/** Light grouping object: links founders and holds the problem context. */
export interface Venture {
  readonly id: string;
  readonly name: string;
  readonly monogram: string;
  readonly tagline: string;
  readonly problem: string; // problem statement, used for FMF + complementarity
  readonly stage: string;
  readonly industry: string;
  readonly location?: string;
  readonly foundedYear?: number;
  readonly website?: string;
  readonly founderIds: readonly string[];
  readonly decision?: VentureDecision;
  readonly team?: TeamAnalysis;
}

/** Decision object, aggregated at the venture level from its founders. */
export interface VentureDecision {
  readonly band: Band;
  readonly composite: number;
  readonly confidence: ConfidenceLevel;
  readonly rationale: string;
  readonly routeToHuman: boolean;
  readonly decidedAt?: string;
}

/** The harmonized team read: not an average of the founders' individual
 *  composites, a complementarity-first score built from how well their skills
 *  cover technical / commercial / domain / product together. Present only
 *  once a venture has two or more evaluated founders; a solo founder has no
 *  team to harmonize yet. */
export interface TeamAnalysis {
  readonly score: number; // 0..100, the harmonized team score: base x compatibility
  /** The founders' AVERAGE profile run through the founder composite, so it is
   *  directly comparable to any individual founder's score. */
  readonly base: number;
  /** The same composite over the team's best-of coverage. What the team reaches
   *  once founders cover each other's weak metrics. */
  readonly coverageComposite: number;
  /** Weakest trusted confidence across the team's covered metrics. */
  readonly confidence: ConfidenceLevel;
  /** Confidence per covered metric, inherited from the founder who carries it. */
  readonly metricConfidence: Readonly<Record<Metric, ConfidenceLevel>>;
  readonly coverage: SkillVector; // combined across founders, max per axis
  readonly gaps: readonly string[];
  readonly redundancies: readonly string[];
  /** Qualitative narrative (e.g. "worked together at X before"), left empty
   *  by the deterministic pass; a future AI pass fills this in. */
  readonly sharedHistory: readonly string[];
  /** Each evaluated founder's skill vector, so the UI can show who covers what
   *  behind the harmonized coverage. */
  readonly perFounder: readonly TeamMember[];
  /** The team's plain mean per metric, the row you can verify by eye. */
  readonly metricAverage: Readonly<Record<Metric, number>>;
  /** Team coverage on the three metrics the aficionado score is built from:
   *  the best founder on Proof, Gravity and Trajectory. */
  readonly metricCoverage: Readonly<Record<Metric, number>>;
  /** Who carries each metric for the team, by initials. */
  readonly metricLiftedBy: Readonly<Record<Metric, string>>;
  /** The multiplier applied to `base`: the team composite over the solo
   *  composite. 1.00 = identical profiles, 1.19 = 19% more ground covered. */
  readonly compatibility: number;
}

/** One evaluated founder's contribution to the team's skill coverage. */
export interface TeamMember {
  readonly founderId: string;
  readonly name: string;
  readonly initials: string;
  readonly skills: SkillVector;
  /** Proof / Gravity / Trajectory, the same three the founder page shows. */
  readonly metrics: Readonly<Record<Metric, number>>;
  /** Per-metric confidence, so the team can inherit a trusted metric from
   *  whichever founder actually has one. */
  readonly confidences: Readonly<Record<Metric, ConfidenceLevel>>;
  readonly composite: number;
  readonly band: Band;
}

export interface Thesis {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly active: boolean;
}

/** A member of the calibration anchor set (some succeeded, some did not). */
export interface AnchorFounder {
  readonly name: string;
  /** Natural phrasing for "sits next to ___" when the anchor is an archetype. */
  readonly display?: string;
  readonly outcome: 'success' | 'mixed' | 'failed';
  readonly proof: number;
  readonly gravity: number;
  readonly trajectory: number;
  readonly note: string;
}

export interface WeightPreset {
  readonly id: string;
  readonly label: string;
  readonly weights: Record<Metric, number>; // sums to 1
  readonly description: string;
}

/** A streamed step of the evaluation, surfaced as the "brain at work". */
export interface TraceStep {
  readonly at: string;
  readonly label: string;
  readonly detail?: string;
  readonly metric?: Metric;
  readonly connector?: ConnectorId;
  readonly kind: 'plan' | 'fetch' | 'extract' | 'reduce' | 'gate' | 'calibrate' | 'done';
}

/** The streaming contract for LOOP B (on-demand evaluation). Server-sent from
 *  /api/evaluate and rendered as the streamed dossier + brain-at-work trace.
 *  Shared by the backend and the Evaluation page so both stay in lockstep. */
export type EvalEvent =
  | { type: 'trace'; step: TraceStep }
  | { type: 'phase'; metric: Metric; connectors: ConnectorId[] }
  | {
      type: 'connector';
      metric: Metric;
      connector: ConnectorId;
      status: 'running' | 'done' | 'error';
      note?: string;
    }
  | { type: 'signal'; signal: Receipt }
  | { type: 'metric'; score: MetricScore }
  | { type: 'final'; score: FounderScore }
  | { type: 'done' }
  | { type: 'error'; message: string };
