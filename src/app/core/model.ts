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
export type FounderStatus = 'discovered' | 'watching' | 'evaluating' | 'decided';
export type PipelineStage = 'Watch' | 'Evaluating' | 'Decided';

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
  readonly status: FounderStatus;
  readonly pipeline?: PipelineStage;
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

/** Team bonus: skill-vector coverage, never a penalty for a solo founder. */
export interface TeamAnalysis {
  readonly coverage: SkillVector; // combined across founders
  readonly bonus: number; // points added to the venture composite, 0..N
  readonly gaps: readonly string[];
  readonly redundancies: readonly string[];
  readonly sharedHistory: readonly string[];
  readonly perFounder: readonly {
    readonly founderId: string;
    readonly name: string;
    readonly skills: SkillVector;
  }[];
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
