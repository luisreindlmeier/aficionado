import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SourcingEvent } from '../src/app/core/model';
import { sourcingEmitter, sourcingWorkflow } from './_lib/sourcing-workflow';

export const config = { maxDuration: 60 };

// LOOP A: a sourcing pass for the active thesis, run as a Mastra workflow
// (discover -> discovery agent rank -> persist). Idempotent. Writes to the
// Supabase candidate queue when creds are set, otherwise runs read-only.
//
// Two response modes over the SAME workflow:
//   - default JSON, used by the daily Vercel cron.
//   - `?stream=1` (or Accept: text/event-stream) streams SourcingEvent frames as
//     SSE, so the Radar page can show the pass happening instead of only ever
//     seeing yesterday's result.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST only' });
    return;
  }

  const thesisId = typeof req.query?.thesisId === 'string' ? req.query.thesisId : undefined;
  const wantsStream =
    req.query?.stream === '1' || String(req.headers.accept ?? '').includes('text/event-stream');

  res.setHeader('Cache-Control', 'no-store');
  if (wantsStream) {
    await streamPass(res, thesisId);
    return;
  }

  try {
    const out = await runPass(thesisId);
    res.status(200).json({
      ok: true,
      thesis: out.thesisId ? { id: out.thesisId, label: out.thesisLabel } : null,
      scanned: out.scanned,
      surfacedCount: out.surfaced.length,
      surfaced: out.surfaced.slice(0, 10),
      rankedBy: out.rankedBy,
      persisted: out.persisted,
      at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: message(err) });
  }
}

async function runPass(thesisId: string | undefined) {
  const run = await sourcingWorkflow.createRun();
  const result = await run.start({ inputData: { thesisId } });
  if (result.status !== 'success') {
    throw new Error(result.status === 'failed' ? message(result.error) : result.status);
  }
  return result.result;
}

/** Run the pass with an SSE emitter bound for the duration of the workflow. */
async function streamPass(res: VercelResponse, thesisId: string | undefined): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (e: SourcingEvent): void => {
    res.write(`data: ${JSON.stringify(e)}\n\n`);
  };

  try {
    await sourcingEmitter.run(send, () => runPass(thesisId));
  } catch (err) {
    send({ type: 'error', message: message(err) });
  } finally {
    send({ type: 'done' });
    res.end();
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
