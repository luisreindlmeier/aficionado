import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readAgentRuns } from './_lib/agent-runs';
import { supabaseEnabled } from './_lib/supabase';

export const config = { maxDuration: 15 };

// Read model for the Agent Runs page: the recorded history of every workflow
// execution, including the ones nobody watched. Returns empty when Supabase is
// not configured, in which case the page falls back to session-only runs.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
  if (!supabaseEnabled()) {
    res.status(200).json({ source: 'none', runs: [] });
    return;
  }
  const limit = Math.min(Number(req.query?.limit) || 50, 200);
  try {
    res.status(200).json({ source: 'supabase', runs: await readAgentRuns(limit) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
