import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { SourcingEvent } from '../src/app/core/model';
import { RunRecorder, type RunTrigger } from './_lib/agent-runs';
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

  // Vercel sets this on cron invocations; anything else is a user in the app.
  const trigger: RunTrigger = req.headers['x-vercel-cron'] ? 'cron' : 'ui';

  res.setHeader('Cache-Control', 'no-store');
  if (wantsStream) {
    await streamPass(res, thesisId, trigger);
    return;
  }

  const recorder = new RunRecorder('thesis-sourcing', thesisId ?? 'active thesis', trigger);
  try {
    const out = await runPass(thesisId, recorder);
    await recorder.finish(`${out.surfaced.length} of ${out.scanned} surfaced`);
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
    await recorder.fail(message(err));
    res.status(500).json({ ok: false, error: message(err) });
  }
}

/** Run the workflow, mirroring its trace into the recorder when one is given.
 *  The emitter is already bound by the caller in stream mode; here we tee. */
async function runPass(thesisId: string | undefined, recorder?: RunRecorder) {
  const capture = (e: SourcingEvent): void => {
    if (e.type === 'trace') recorder?.addTrace(e.step);
  };
  const exec = async () => {
    const run = await sourcingWorkflow.createRun();
    const result = await run.start({ inputData: { thesisId } });
    if (result.status !== 'success') {
      throw new Error(result.status === 'failed' ? message(result.error) : result.status);
    }
    return result.result;
  };
  // In JSON mode nothing has bound the emitter, so bind it to the recorder tee.
  return sourcingEmitter.getStore() ? exec() : sourcingEmitter.run(capture, exec);
}

/** Run the pass with an SSE emitter bound for the duration of the workflow. */
async function streamPass(
  res: VercelResponse,
  thesisId: string | undefined,
  trigger: RunTrigger,
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const recorder = new RunRecorder('thesis-sourcing', thesisId ?? 'active thesis', trigger);
  let surfaced = 0;
  let scanned = 0;

  const send = (e: SourcingEvent): void => {
    if (e.type === 'trace') recorder.addTrace(e.step);
    if (e.type === 'summary') {
      surfaced = e.surfaced;
      scanned = e.scanned;
    }
    res.write(`data: ${JSON.stringify(e)}\n\n`);
  };

  try {
    await sourcingEmitter.run(send, () => runPass(thesisId));
    await recorder.finish(`${surfaced} of ${scanned} surfaced`);
  } catch (err) {
    send({ type: 'error', message: message(err) });
    await recorder.fail(message(err));
  } finally {
    send({ type: 'done' });
    res.end();
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
