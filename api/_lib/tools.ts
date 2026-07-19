import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { ConnectorId, FounderQuery } from '../../src/app/core/connectors/types';
import type { Metric } from '../../src/app/core/metrics';
import { CONNECTORS } from '../../src/app/core/connectors/descriptors';
import { METRIC_CONNECTORS, RUNNERS, type RunFn } from './connectors';

// ─────────────────────────────────────────────────────────────
// CONNECTORS AS MASTRA TOOLS. Every live connector (one with a RunFn in
// RUNNERS) is wrapped as a createTool so a metric agent can call it directly.
// The descriptor registry (CONNECTORS) that drives the Data-sources UI is the
// SAME source used here for names/descriptions: one registry, two surfaces.
// Only the scoring math and agents change downstream; the runtimes are reused.
// ─────────────────────────────────────────────────────────────

/** Founder identity a connector needs to look someone up. Mirrors FounderQuery. */
export const founderInputSchema = z.object({
  name: z.string().describe('Founder full name'),
  github: z.string().optional().describe('GitHub username/handle'),
  npm: z.string().optional().describe('npm author/username'),
  pypi: z.string().optional().describe('PyPI author/username'),
  producthunt: z.string().optional().describe('Product Hunt maker username'),
  x: z.string().optional().describe('X / Twitter handle'),
  linkedin: z.string().optional().describe('LinkedIn slug or pasted profile'),
  domain: z.string().optional().describe('Company or personal domain'),
  keywords: z.array(z.string()).optional().describe('Thesis / topic keywords'),
});

/** One atomic piece of evidence a connector produced (mirrors Signal). */
export const signalSchema = z.object({
  connector: z.string().describe('Connector id that produced this signal'),
  metric: z.string().describe('Metric this signal feeds: Proof | Gravity | Trajectory'),
  text: z.string().describe('Human-readable evidence line'),
  value: z.number().optional().describe('Raw magnitude (stars, downloads, papers, ...)'),
  url: z.string().optional().describe('Source link'),
});

/** A connector run result: the signals it found plus an optional status note. */
export const connectorOutputSchema = z.object({
  signals: z.array(signalSchema),
  note: z.string().optional(),
});

const DESCRIPTOR = new Map(CONNECTORS.map((c) => [c.id, c]));

/** Wrap one connector runtime as a Mastra tool. Every tool shares the same
 *  input/output schema, so they all have one concrete type (ConnectorTool). */
function buildTool(id: ConnectorId, run: RunFn) {
  const d = DESCRIPTOR.get(id);
  const label = d?.name ?? id;
  const what = d?.description ?? 'founder evidence signals';
  const where = d?.domain ? ` from ${d.domain}` : '';
  return createTool({
    id: `connector.${id}`,
    description: `${label}: ${what}. Returns founder evidence signals${where}. Pass the founder identity; only the fields this source needs are used.`,
    inputSchema: founderInputSchema,
    outputSchema: connectorOutputSchema,
    execute: async (input) => {
      const result = await run(input as FounderQuery);
      return {
        signals: result.signals.map((s) => ({
          connector: s.connector,
          metric: s.metric,
          text: s.text,
          value: s.value,
          url: s.url,
        })),
        note: result.note,
      };
    },
  });
}

export type ConnectorTool = ReturnType<typeof buildTool>;

/** One tool per live connector, keyed by ConnectorId. Derived from RUNNERS. */
export const CONNECTOR_TOOLS: Record<string, ConnectorTool> = (() => {
  const map: Record<string, ConnectorTool> = {};
  for (const id of Object.keys(RUNNERS) as ConnectorId[]) {
    const run = RUNNERS[id];
    if (run) map[id] = buildTool(id, run);
  }
  return map;
})();

function toolsForMetric(metric: Metric): Record<string, ConnectorTool> {
  const out: Record<string, ConnectorTool> = {};
  for (const id of METRIC_CONNECTORS[metric]) {
    const tool = CONNECTOR_TOOLS[id];
    if (tool) out[id] = tool;
  }
  return out;
}

/** Tools grouped by the metric they feed. Each metric agent gets ONLY its set. */
export const METRIC_TOOLS: Record<Metric, Record<string, ConnectorTool>> = {
  Proof: toolsForMetric('Proof'),
  Gravity: toolsForMetric('Gravity'),
  Trajectory: toolsForMetric('Trajectory'),
};
