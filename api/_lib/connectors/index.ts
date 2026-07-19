import type {
  ConnectorId,
  ConnectorResult,
  FounderQuery,
} from '../../../src/app/core/connectors/types';
import type { Metric } from '../../../src/app/core/metrics';
import { runGithub } from './github';
import { runNpm } from './npm';
import { runPypi } from './pypi';
import { runArxiv } from './arxiv';
import { runProductHunt } from './producthunt';
import { runWayback } from './wayback';
import { runSemanticScholar } from './semanticscholar';
import { runOpenAlex } from './openalex';
import { runStackExchange } from './stackexchange';

export type RunFn = (query: FounderQuery) => Promise<ConnectorResult>;

// Connectors with a live backend implementation today. Adding a source here
// (plus a descriptor with `live: true`) makes it both AI-callable and visible.
export const RUNNERS: Partial<Record<ConnectorId, RunFn>> = {
  github: runGithub,
  npm: runNpm,
  pypi: runPypi,
  arxiv: runArxiv,
  producthunt: runProductHunt,
  wayback: runWayback,
  semanticscholar: runSemanticScholar,
  openalex: runOpenAlex,
  stackexchange: runStackExchange,
};

// Live connectors grouped by the metric they feed. GitHub feeds all three:
// its signals carry their own `metric`, so a phase only keeps the ones it asked
// for. A connector may appear under more than one metric.
export const METRIC_CONNECTORS: Record<Metric, ConnectorId[]> = {
  Proof: ['github', 'npm', 'pypi', 'arxiv', 'semanticscholar', 'openalex', 'stackexchange'],
  Gravity: ['github', 'openalex'],
  Trajectory: ['github', 'wayback'],
};

/** Live connectors that feed the Proof metric (legacy alias for METRIC_CONNECTORS.Proof). */
export const PROOF_CONNECTORS: ConnectorId[] = METRIC_CONNECTORS.Proof;
