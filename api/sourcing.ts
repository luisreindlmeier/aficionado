import type { VercelRequest, VercelResponse } from '@vercel/node';
import { THESES } from '../src/app/core/data/seed';
import { clamp } from '../src/app/core/scoring';
import { resolveFounders } from './_lib/founders';

export const config = { maxDuration: 30 };

// LOOP A (cron): a sourcing pass for the active thesis. Idempotent and
// side-effect-light. Today it "discovers" from the committed seed and computes
// a cheap triage score; later it will write candidates to Supabase.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST only' });
    return;
  }

  const active = THESES.find((t) => t.active) ?? THESES[0];
  const keywords = (active?.keywords ?? []).map((k) => k.toLowerCase());
  const founders = resolveFounders();

  const candidates = founders
    .map((f) => {
      const haystack = `${f.headline} ${f.name}`.toLowerCase();
      const overlap = keywords.filter((k) => haystack.includes(k)).length;
      const match = keywords.length ? overlap / keywords.length : 0;
      const triage = Math.round(clamp(0.5 * f.triage + 50 * match, 0, 100));
      return { id: f.id, name: f.name, thesisId: f.thesisId, triage, onThesis: f.thesisId === active?.id };
    })
    .sort((a, b) => b.triage - a.triage);

  const surfaced = candidates.filter((c) => c.onThesis || c.triage >= 60);

  // Optional Supabase persistence. No hard dependency: the dynamic specifier is
  // non-literal so tsc will not require @supabase/supabase-js, and the try/catch
  // means its absence (or a bad key) never breaks the pass.
  let persisted = false;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const specifier = '@supabase/' + 'supabase-js';
      const mod = (await import(specifier)) as {
        createClient: (url: string, key: string) => { from: (t: string) => { upsert: (rows: unknown[]) => Promise<unknown> } };
      };
      const supabase = mod.createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      // TODO(Loop A): real candidates schema (dedupe on handle, thesis_id, first_seen/refreshed_at).
      await supabase.from('sourcing_candidates').upsert(
        candidates.map((c) => ({ ...c, thesis_id: active?.id, refreshed_at: new Date().toISOString() })),
      );
      persisted = true;
    } catch {
      persisted = false;
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    thesis: active ? { id: active.id, label: active.label } : null,
    scanned: founders.length,
    surfacedCount: surfaced.length,
    refreshedCount: candidates.length,
    surfaced: surfaced.slice(0, 10),
    persisted,
    at: new Date().toISOString(),
  });
}
