import type {
  ConnectorId,
  ConnectorResult,
  FounderQuery,
} from '../../../src/app/core/connectors/types';
import { runGithub } from './github';
import { runNpm } from './npm';
import { runPypi } from './pypi';
import { runArxiv } from './arxiv';
import { runProductHunt } from './producthunt';

export type RunFn = (query: FounderQuery) => Promise<ConnectorResult>;

// Connectors with a live backend implementation today. Adding a source here
// (plus a descriptor with `live: true`) makes it both AI-callable and visible.
export const RUNNERS: Partial<Record<ConnectorId, RunFn>> = {
  github: runGithub,
  npm: runNpm,
  pypi: runPypi,
  arxiv: runArxiv,
  producthunt: runProductHunt,
};

/** Live connectors that feed the Proof metric. */
export const PROOF_CONNECTORS: ConnectorId[] = ['github', 'npm', 'pypi', 'arxiv', 'producthunt'];
