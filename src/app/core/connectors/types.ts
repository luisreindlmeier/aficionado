import type { Metric } from '../metrics';

// Shared, isomorphic connector contract. This file has no Node or browser
// dependencies so it can be imported by both the Angular UI (for the Data
// sources page) and the serverless backend (for the AI evaluation agent).
// A later MCP surface can reuse the exact same descriptors and tool shapes.

export type ConnectorId =
  | 'github'
  | 'npm'
  | 'pypi'
  | 'producthunt'
  | 'wayback'
  | 'arxiv'
  | 'semanticscholar'
  | 'stackexchange'
  | 'x'
  | 'handelsregister'
  | 'googlepatents'
  | 'devpost'
  | 'linkedin'
  | 'crunchbase'
  | 'evertrace';

export type Group = 'Connected' | 'Available' | 'Manual input' | 'Not supported';
export type AuthMode = 'none' | 'key' | 'manual' | 'unsupported';
export type ActionKind = 'connected' | 'connect' | 'add-key' | 'paste' | 'unsupported';

/** Everything needed to render a source in the UI and reason about it. */
export interface ConnectorDescriptor {
  readonly id: ConnectorId;
  readonly name: string;
  readonly domain: string;
  readonly description: string;
  readonly icon: string; // ng-icon name (UI only)
  readonly color?: string; // brand colour (UI only)
  readonly group: Group;
  readonly auth: AuthMode;
  readonly metrics: readonly Metric[];
  readonly note: string;
  readonly action: ActionKind;
  /** True once a live backend run() implementation is wired up. */
  readonly live: boolean;
}

/** One atomic piece of evidence a connector produced for a metric. */
export interface Signal {
  readonly connector: ConnectorId;
  readonly metric: Metric;
  readonly text: string; // human-readable evidence line
  readonly value?: number; // optional raw magnitude (stars, downloads, papers, ...)
  readonly url?: string; // source link
}

/** Identifiers handed to connectors to look a founder up. */
export interface FounderQuery {
  readonly name: string;
  readonly github?: string;
  readonly npm?: string;
  readonly pypi?: string;
  readonly x?: string;
  readonly linkedin?: string;
  readonly domain?: string;
  readonly keywords?: readonly string[];
}

/** A connector run result: the signals it found, plus an optional status note. */
export interface ConnectorResult {
  readonly signals: readonly Signal[];
  readonly note?: string;
}

/** The scored outcome for a single metric. */
export interface MetricVerdict {
  readonly metric: Metric;
  readonly score: number; // 0..100
  readonly rationale: string;
  readonly evidence: readonly Signal[];
  /** 'ai' when a model produced the score, 'heuristic' when scored locally. */
  readonly by: 'ai' | 'heuristic';
}

/** Server-sent events streamed from /api/evaluate into the dossier. */
export type EvaluationEvent =
  | { type: 'started'; metric: Metric; connectors: ConnectorId[] }
  | {
      type: 'connector';
      connector: ConnectorId;
      status: 'running' | 'done' | 'error';
      note?: string;
    }
  | { type: 'signal'; signal: Signal }
  | { type: 'verdict'; verdict: MetricVerdict }
  | { type: 'done' }
  | { type: 'error'; message: string };
