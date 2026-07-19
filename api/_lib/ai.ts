import { z } from 'zod';
import type { MetricVerdict, Signal } from '../../src/app/core/connectors/types';
import { aiEnabled, proofScorer } from './mastra';

// AI verdict: the model judges the founder's Proof from the gathered signals.
// Runs through the Mastra proofScorer agent (OpenAI), so the call is traced to the
// Mastra Platform dashboard. Returns null when no model key is present so the caller
// can fall back to the heuristic.
export async function scoreProofWithAI(
  name: string,
  signals: readonly Signal[],
): Promise<MetricVerdict | null> {
  if (!aiEnabled()) return null;
  if (!signals.length) return null;

  const schema = z.object({
    score: z
      .number()
      .min(0)
      .max(100)
      .describe('Proof score: demonstrated ability to build and ship'),
    rationale: z.string().describe('One or two sentences justifying the score'),
    evidenceIndexes: z
      .array(z.number())
      .describe('Indexes of the strongest signals, most important first'),
  });

  const list = signals.map((s, i) => `${i}. [${s.connector}] ${s.text}`).join('\n');
  const { object } = await proofScorer.generate(`Founder: ${name}\nSignals:\n${list}`, {
    structuredOutput: { schema },
  });

  const evidence = object.evidenceIndexes.map((i) => signals[i]).filter(Boolean);
  return {
    metric: 'Proof',
    score: Math.round(object.score),
    rationale: object.rationale,
    evidence: evidence.length ? evidence : [...signals],
    by: 'ai',
  };
}
