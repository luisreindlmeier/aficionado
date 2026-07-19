import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Observability, MastraPlatformExporter, SensitiveDataFilter } from '@mastra/observability';
import type { Metric } from '../../src/app/core/metrics';
import { SupabaseMetricsExporter } from './metrics-exporter';
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

// Red-flag critic: a cross-source coherence + authenticity pass over the three
// metric verdicts. It can only ADD red flags (which the deterministic redFlagGate
// may use to cap the score); it never computes the score itself. Conservative by
// design: an empty list is the correct answer when nothing is genuinely wrong.
export const criticAgent = new Agent({
  id: 'red-flag-critic',
  name: 'Red-flag Critic',
  instructions:
    'You are a skeptical diligence critic doing a cross-source coherence and authenticity ' +
    'pass on a founder, given each metric (Proof, Gravity, Trajectory) with its score, ' +
    'rationale and evidence. Surface ONLY genuine red flags: contradictions between claimed ' +
    'and independently measured capability, governance or self-dealing concerns, or ' +
    'authenticity problems (metrics that cannot be reproduced from the evidence). Do NOT ' +
    'flag normal early-stage traits: first-time founder, private pilot, small footprint, ' +
    'thin social reach. Be conservative, an empty list is the correct and common answer. ' +
    'Assign severity low, medium or high; reserve high for a critical coherence or ' +
    'governance flag that should cap an otherwise strong score.',
  model: MODEL,
});

// Sourcing/discovery analyst (Loop A). Given the active thesis and a candidate
// pool, it selects and ranks the founders that genuinely match the thesis. Pure
// reasoning over the provided list; the deterministic triage remains the fallback.
export const discoveryAgent = new Agent({
  id: 'discovery-analyst',
  name: 'Discovery Analyst',
  instructions:
    'You are a sourcing analyst for an early-stage VC thesis. Given the active thesis ' +
    '(label and keywords) and a list of candidate founders (id, name, headline, triage ' +
    'score), select and rank the founders that genuinely match the thesis. Return the ' +
    'strongest matches only, each with a one-line reason grounded in the headline. Be ' +
    'selective, do not pad the list with weak fits.',
  model: MODEL,
});

// Registering the agents here injects the Mastra context (and its observability
// pipeline) into them, so agent.generate(...) and every tool call are traced and
// shipped to the Mastra Platform dashboard when MASTRA_PLATFORM_ACCESS_TOKEN /
// MASTRA_PROJECT_ID are set.
//
// The second exporter keeps a local copy of that same span stream (tokens,
// latency, per-agent and per-tool breakdown) in Supabase, so the app can show
// what the agents cost without sending the user to an external dashboard.
export const mastra = new Mastra({
  agents: { proofAgent, gravityAgent, trajectoryAgent, criticAgent, discoveryAgent },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'aficionado',
        exporters: [new MastraPlatformExporter(), new SupabaseMetricsExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
