import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import {
  Observability,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability';
import type { Metric } from '../../src/app/core/metrics';
import { METRIC_TOOLS } from './tools';

// Single OpenAI model for every agent. Provider-string form: Mastra resolves the
// OpenAI provider and reads OPENAI_API_KEY. Swap this one constant to change models.
export const MODEL = 'openai/gpt-5.5';

// True when the model key is present. Without it the callers fall back to the
// deterministic heuristic instead of invoking an agent.
export const aiEnabled = (): boolean => Boolean(process.env.OPENAI_API_KEY);

const BASE_INSTRUCTIONS =
  'You are a calibrated, skeptical venture analyst scoring ONE founder metric from ' +
  'evidence signals. 0 = no evidence, 100 = exceptional, top-percentile. Weigh reach ' +
  'and adoption (stars, downloads, upvotes, citations) over raw counts. Extract 3-6 ' +
  'calibrated features, a rationale, and the strongest evidence indexes. When the ' +
  'provided signals are thin you may call your connector tools to gather more evidence, ' +
  'but never invent facts that are not backed by a signal.';

const METRIC_BRIEF: Record<Metric, string> = {
  Proof:
    'Your metric is Proof: demonstrated ability to build and ship real things (shipping ' +
    'record, real-world adoption, research depth).',
  Gravity:
    'Your metric is Gravity: how much people, capital and attention move toward the ' +
    'founder (true reach, network authority, amplification).',
  Trajectory:
    'Your metric is Trajectory: momentum and acceleration (recent shipping cadence, ' +
    'repos per year, longevity of the build history).',
};

// One agent per metric, each carrying ONLY its metric's connector tools. Replaces
// the previous single metricScorer/proofScorer so each metric reasons in isolation.
function metricAgent(metric: Metric): Agent {
  return new Agent({
    id: `${metric.toLowerCase()}-agent`,
    name: `${metric} Agent`,
    instructions: `${BASE_INSTRUCTIONS}\n\n${METRIC_BRIEF[metric]}`,
    model: MODEL,
    tools: METRIC_TOOLS[metric],
  });
}

export const proofAgent = metricAgent('Proof');
export const gravityAgent = metricAgent('Gravity');
export const trajectoryAgent = metricAgent('Trajectory');

export const METRIC_AGENTS: Record<Metric, Agent> = {
  Proof: proofAgent,
  Gravity: gravityAgent,
  Trajectory: trajectoryAgent,
};

// Registering the agents here injects the Mastra context (and its observability
// pipeline) into them, so agent.generate(...) and every tool call are traced and
// shipped to the Mastra Platform dashboard when MASTRA_PLATFORM_ACCESS_TOKEN /
// MASTRA_PROJECT_ID are set.
export const mastra = new Mastra({
  agents: { proofAgent, gravityAgent, trajectoryAgent },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'aficionado',
        exporters: [new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
