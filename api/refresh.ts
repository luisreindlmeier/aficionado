import type { VercelRequest, VercelResponse } from '@vercel/node';
import { THESES } from '../src/app/core/data/seed';
import { searchGermanFounders } from './_lib/discovery/github-search';
import { evaluationWorkflow } from './_lib/workflow';
import {
  supabaseAdmin,
  toDossierRow,
  upsertCandidates,
  upsertDossier,
  type CandidateRow,
} from './_lib/supabase';

export const config = { maxDuration: 300 };

// Hourly refresh (called by Supabase pg_cron). Discovers net-new founders from
// GitHub, upserts them to the candidate queue, then evaluates a small batch of
// still-unevaluated candidates and caches their dossiers. Bounded so it fits the
// function budget; the queue drains a few founders per hour.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['x-cron-secret'] !== secret && req.query?.secret !== secret) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const db = supabaseAdmin();
  if (!db) {
    res.status(200).json({ ok: false, reason: 'Supabase not configured' });
    return;
  }

  const active = THESES.find((t) => t.active) ?? THESES[0];
  // Focus on GERMAN founders: keywords crossed with German locations in the search.
  const keywords = ['ai', 'machine learning', 'llm', 'fintech', 'developer tools', 'saas'];

  try {
    // 1) discover German founders + upsert candidates
    const found = await searchGermanFounders(keywords, {
      perQuery: process.env.GITHUB_TOKEN ? 10 : 5,
      maxCandidates: 40,
      minFollowers: 15,
    });
    const rows: CandidateRow[] = found.map((f) => ({
      id: f.login,
      name: f.name ?? f.login,
      github: f.login,
      domain: f.domain ?? null,
      headline: f.headline ?? null,
      followers: f.followers,
      top_repo: f.topRepo?.name ?? null,
      top_stars: f.topRepo?.stars ?? 0,
      thesis_id: active?.id ?? null,
      triage: Math.min(99, Math.round(20 + Math.log10(Math.max(1, f.topRepo?.stars ?? 1)) * 12)),
      reason: null,
      evaluated: false,
    }));
    const discovered = await upsertCandidates(rows);

    // 2) evaluate a small batch of unevaluated candidates + cache dossiers
    const { data: pending } = await db
      .from('sourcing_candidates')
      .select('*')
      .eq('evaluated', false)
      .order('triage', { ascending: false })
      .limit(2);

    let evaluated = 0;
    for (const c of (pending as CandidateRow[] | null) ?? []) {
      const run = await evaluationWorkflow.createRun();
      const r = await run.start({
        inputData: { name: c.name, github: c.github ?? undefined, domain: c.domain ?? undefined },
      });
      if (r.status === 'success') {
        await upsertDossier(
          toDossierRow(
            c.id,
            { name: c.name, github: c.github ?? undefined, domain: c.domain ?? undefined },
            r.result,
            { headline: c.headline ?? undefined, thesisId: c.thesis_id ?? undefined },
          ),
        );
        await db.from('sourcing_candidates').update({ evaluated: true }).eq('id', c.id);
        evaluated++;
      }
    }

    res.status(200).json({
      ok: true,
      discovered,
      evaluated,
      thesis: active?.label,
      at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
