// Hourly refresh, run by GitHub Actions (Node ESM, so Mastra's ESM deps load
// natively, unlike Vercel's CJS function bundling). Discovers German founders,
// upserts the candidate queue, then evaluates a batch of unevaluated candidates
// and caches their dossiers. Env: OPENAI_API_KEY, GITHUB_TOKEN, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY. BATCH controls how many to evaluate per run.
import { searchGermanFounders } from '../api/_lib/discovery/github-search';
import { RunRecorder } from '../api/_lib/agent-runs';
import { emitter, evaluationWorkflow } from '../api/_lib/workflow';
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
    // Each founder is one recorded run, so the Agent Runs page shows the hourly
    // work rather than only what a browser tab happened to watch.
    const recorder = new RunRecorder('founder-evaluation', c.name, 'action');
    let signals = 0;
    const capture = (e: import('../src/app/core/model').EvalEvent): void => {
      if (e.type === 'trace') recorder.addTrace(e.step);
      if (e.type === 'connector') recorder.addTool(e.connector);
      if (e.type === 'signal') signals++;
    };
    try {
      const r = await emitter.run(capture, async () => {
        const run = await evaluationWorkflow.createRun();
        return run.start({
          inputData: { name: c.name, github: c.github ?? undefined, domain: c.domain ?? undefined },
        });
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
        await recorder.finish(`${r.result.composite} ${r.result.band}, ${signals} signals`);
        console.error(`  [${evaluated}] ${c.name}: ${r.result.composite} ${r.result.band}`);
      } else {
        await recorder.fail(`workflow ${r.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await recorder.fail(msg);
      console.error(`  ERR ${c.name}: ${msg}`);
    }
  }
  console.error(`DONE: discovered ${discovered}, evaluated ${evaluated}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error('FATAL', e instanceof Error ? e.message : e);
  process.exit(1);
});
