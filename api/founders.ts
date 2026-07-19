import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readCandidates, readDossiers, supabaseEnabled } from './_lib/supabase';

export const config = { maxDuration: 15 };

// Read model for the dashboard: the live-evaluated dossiers + the discovery queue
// from Supabase. When Supabase is not configured, returns empty so the frontend
// falls back to the committed seed.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  if (!supabaseEnabled()) {
    res.status(200).json({ source: 'none', dossiers: [], candidates: [] });
    return;
  }
  try {
    const [dossiers, candidates] = await Promise.all([readDossiers(), readCandidates()]);
    res.status(200).json({
      source: 'supabase',
      dossiers,
      candidates,
      at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
