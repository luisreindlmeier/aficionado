import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sourcingWorkflow } from './_lib/sourcing-workflow';

export const config = { maxDuration: 60 };

// LOOP A (daily cron): a sourcing pass for the active thesis, run as a Mastra
// workflow (discover -> discovery agent rank -> persist). Idempotent. Writes to
// the Supabase candidate queue when creds are set, otherwise runs read-only.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST only' });
    return;
  }

  const thesisId = typeof req.query?.thesisId === 'string' ? req.query.thesisId : undefined;

  res.setHeader('Cache-Control', 'no-store');
  try {
    const run = await sourcingWorkflow.createRun();
    const result = await run.start({ inputData: { thesisId } });
    if (result.status !== 'success') {
      res.status(500).json({
        ok: false,
        error: result.status === 'failed' ? message(result.error) : result.status,
      });
      return;
    }
    const out = result.result;
    res.status(200).json({
      ok: true,
      thesis: out.thesisId ? { id: out.thesisId, label: out.thesisLabel } : null,
      scanned: out.scanned,
      surfacedCount: out.surfaced.length,
      surfaced: out.surfaced.slice(0, 10),
      persisted: out.persisted,
      at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: message(err) });
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
