import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  EvaluationEvent,
  FounderQuery,
  Signal,
} from '../src/app/core/connectors/types';
import { PROOF_CONNECTORS, RUNNERS } from './_lib/connectors';
import { scoreProofHeuristic } from './_lib/proof';
import { scoreProofWithAI } from './_lib/ai';

export const config = { maxDuration: 60 };

// POST { name, github?, npm?, pypi?, x?, keywords? } -> SSE stream of
// EvaluationEvent. Runs the live Proof connectors, streams each signal as it
// lands, then streams an AI verdict (heuristic fallback when no gateway key).
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {};
  const query: FounderQuery = {
    name: body.name || '',
    github: body.github,
    npm: body.npm,
    pypi: body.pypi,
    x: body.x,
    linkedin: body.linkedin,
    domain: body.domain,
    keywords: body.keywords,
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const send = (event: EvaluationEvent): void => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    send({ type: 'started', metric: 'Proof', connectors: PROOF_CONNECTORS });

    const collected: Signal[] = [];
    await Promise.all(
      PROOF_CONNECTORS.map(async (id) => {
        const run = RUNNERS[id];
        if (!run) return;
        send({ type: 'connector', connector: id, status: 'running' });
        try {
          const result = await run(query);
          for (const signal of result.signals) {
            collected.push(signal);
            send({ type: 'signal', signal });
          }
          send({ type: 'connector', connector: id, status: 'done', note: result.note });
        } catch (err) {
          send({ type: 'connector', connector: id, status: 'error', note: message(err) });
        }
      }),
    );

    let verdict: Awaited<ReturnType<typeof scoreProofWithAI>> = null;
    try {
      verdict = await scoreProofWithAI(query.name, collected);
    } catch {
      verdict = null;
    }
    send({ type: 'verdict', verdict: verdict ?? scoreProofHeuristic(collected) });
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: message(err) });
  } finally {
    res.end();
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
