// Hourly refresh, run by GitHub Actions (Node ESM, so Mastra's ESM deps load
// natively, unlike Vercel's CJS function bundling). Discovers German founders,
// upserts the candidate queue, then evaluates a batch of unevaluated candidates
// and caches their dossiers. Env: OPENAI_API_KEY, GITHUB_TOKEN, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. BATCH controls how many to evaluate per run.
import { searchGermanFounders } from '../api/_lib/discovery/github-search';
import { evaluationWorkflow } from '../api/_lib/workflow';
import {
  supabaseAdmin,
  toDossierRow,
  upsertCandidates,
  upsertDossier,
  type CandidateRow,
} from '../api/_lib/supabase';

const KEYWORDS = ['ai', 'machine learning', 'llm', 'fintech', 'developer tools', 'saas', 'data', 'robotics'];

async function main(): Promise<void> {
  const db = supabaseAdmin();
  if (!db) {
    console.error('Supabase not configured, aborting.');
    process.exit(1);
  }
  const batch = Number(process.env.BATCH || 20);

  // 1) discover German founders and upsert the queue
  const found = await searchGermanFounders(KEYWORDS, {
    perQuery: 10,
    maxCandidates: 60,
    minFollowers: 15,
  });
  const clean = (s?: string | null): string | null =>
    typeof s === 'string'
      ? s.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 160)
      : null;
  const rows: CandidateRow[] = found.map((f) => ({
    id: f.login,
    name: clean(f.name) || f.login,
    github: f.login,
    domain: f.domain ?? null,
    headline: clean(f.headline),
    followers: f.followers,
    top_repo: f.topRepo?.name ?? null,
    top_stars: f.topRepo?.stars ?? 0,
    thesis_id: 'dach-ai',
    reason: f.location ?? null,
    triage: Math.min(99, Math.round(25 + Math.log10(Math.max(1, f.followers)) * 14)),
    evaluated: false,
  }));
  const discovered = await upsertCandidates(rows);
  console.error(`discovered/upserted ${discovered} German candidates`);

  // 2) evaluate a batch of the strongest unevaluated candidates
  const { data: pending } = await db
    .from('sourcing_candidates')
    .select('*')
    .eq('evaluated', false)
    .order('triage', { ascending: false })
    .limit(batch);

  let evaluated = 0;
  for (const c of (pending as CandidateRow[] | null) ?? []) {
    try {
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
        console.error(`  [${evaluated}] ${c.name}: ${r.result.composite} ${r.result.band}`);
      }
    } catch (err) {
      console.error(`  ERR ${c.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.error(`DONE: discovered ${discovered}, evaluated ${evaluated}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('FATAL', e instanceof Error ? e.message : e);
  process.exit(1);
});
