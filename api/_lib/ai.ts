import { generateObject } from 'ai';
import { z } from 'zod';
import type { MetricVerdict, Signal } from '../../src/app/core/connectors/types';

// AI verdict: the model judges the founder's Proof from the gathered signals.
// Uses the Vercel AI Gateway (plain "provider/model" string). Returns null when
// no gateway key is present so the caller can fall back to the heuristic.
export async function scoreProofWithAI(
  name: string,
  signals: readonly Signal[],
): Promise<MetricVerdict | null> {
  if (!process.env.AI_GATEWAY_API_KEY) return null;
  if (!signals.length) return null;

  const schema = z.object({
    score: z.number().min(0).max(100).describe('Proof score: demonstrated ability to build and ship'),
    rationale: z.string().describe('One or two sentences justifying the score'),
    evidenceIndexes: z.array(z.number()).describe('Indexes of the strongest signals, most important first'),
  });

  const list = signals.map((s, i) => `${i}. [${s.connector}] ${s.text}`).join('\n');
  const { object } = await generateObject({
    model: 'anthropic/claude-sonnet-5',
    schema,
    prompt:
      `You score a startup founder's "Proof" metric: how strongly they have demonstrated the ability to build and ship real things. ` +
      `0 = no evidence, 100 = exceptional, top-percentile builder. Weigh reach and adoption (stars, downloads, upvotes, citations) over raw counts. ` +
      `Be calibrated and skeptical.\n\nFounder: ${name}\nSignals:\n${list}`,
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
