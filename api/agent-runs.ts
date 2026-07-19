import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readAgentMetrics, readAgentRuns } from './_lib/agent-runs';
import { supabaseEnabled } from './_lib/supabase';

export const config = { maxDuration: 15 };

// Read model for the Agent Runs page: the recorded history of every workflow
// execution, including the ones nobody watched. Returns empty when Supabase is
// not configured, in which case the page falls back to session-only runs.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
  if (!supabaseEnabled()) {
    res.status(200).json({ source: 'none', runs: [], metrics: null });
    return;
  }
  const limit = Math.min(Number(req.query?.limit) || 50, 200);
  const windowHours = Math.min(Number(req.query?.hours) || 24, 720);
  try {
    const [runs, metrics] = await Promise.all([
      readAgentRuns(limit),
      readAgentMetrics(windowHours),
    ]);
    res.status(200).json({ source: 'supabase', runs, metrics });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
