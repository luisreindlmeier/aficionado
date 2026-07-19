import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import {
  Observability,
  MastraPlatformExporter,
  SensitiveDataFilter,
} from '@mastra/observability';

// Single OpenAI model for every agent. Provider-string form: Mastra resolves the
// OpenAI provider and reads OPENAI_API_KEY. Swap this one constant to change models.
export const MODEL = 'openai/gpt-5.5';

// True when the model key is present. Without it the callers fall back to the
// deterministic heuristic instead of invoking an agent.
export const aiEnabled = (): boolean => Boolean(process.env.OPENAI_API_KEY);

export const proofScorer = new Agent({
  id: 'proof-scorer',
  name: 'Proof Scorer',
  instructions:
    'You score a startup founder\'s "Proof" metric: how strongly they have demonstrated ' +
    'the ability to build and ship real things. 0 = no evidence, 100 = exceptional, ' +
    'top-percentile builder. Weigh reach and adoption (stars, downloads, upvotes, citations) ' +
    'over raw counts. Be calibrated and skeptical.',
  model: MODEL,
});

export const metricScorer = new Agent({
  id: 'metric-scorer',
  name: 'Metric Scorer',
  instructions:
    'You are a calibrated, skeptical venture analyst scoring a founder metric from evidence ' +
    'signals. 0 = no evidence, 100 = exceptional, top-percentile. Weigh reach and adoption ' +
    'over raw counts. Extract calibrated features, a rationale, and the strongest evidence.',
  model: MODEL,
});

// Registering the agents here injects the Mastra context (and its observability
// pipeline) into them, so agent.generate(...) calls are traced and shipped to the
// Mastra Platform dashboard when MASTRA_PLATFORM_ACCESS_TOKEN / MASTRA_PROJECT_ID are set.
export const mastra = new Mastra({
  agents: { proofScorer, metricScorer },
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
