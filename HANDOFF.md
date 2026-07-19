# HANDOFF

The orchestration has been migrated onto Mastra as durable workflows (connectors as
tools, three metric agents, a durable fan-out evaluation workflow with a red-flag
critic gate, agentic tool-calling with live streaming and tracing, a scheduled
sourcing workflow, and the calibration set ported to a Mastra scorer). This lists
only what still needs you, Luis. Everything else is built, verified and pushed.

## Already done (no action needed)

- `/api/evaluate` runs as a Mastra workflow: ingest, then Proof / Gravity / Trajectory
  agents in parallel (each calls its own connector tools), then a deterministic reducer
  and a conservative critic gate, then calibration. Output shape (scores, bands,
  receipts) is unchanged and the brain-at-work stream still fires every event.
- `/api/sourcing` runs as a Mastra workflow (discover, discovery-agent rank, persist) on
  a daily Vercel cron.
- The deterministic invariant held through every step: the calibration eval is green
  (`pnpm eval`, 127 tests) and Luis / gedonus still lands the calibrated Watch 62.
- Model is OpenAI `gpt-5.5` for every agent, via one `MODEL` constant in
  `api/_lib/mastra.ts`. Agent + tool spans export to the Mastra Platform dashboard.
- All work is committed and pushed to the `mastra-workflows` branch.

## What only you can do

### 1. Review and merge the `mastra-workflows` branch (needed to ship)

The migration lives on `mastra-workflows` so it deploys to Vercel preview, not
production, while a second session works on `main`. When you are happy with the preview,
open a PR from `mastra-workflows` into `main` (or fast-forward merge) and let the
auto-deploy ship it to production. Rebase on `main` first, the two lines have only
touched different files so far.

### 2. Verify the Mastra traces in the dashboard (about 1 minute)

Only you can log into Mastra Platform. Run one live evaluation (the "Run live
evaluation" button, or `npx tsx scripts/smoke-evaluate.ts` with the env loaded), then
open Observability in the Mastra dashboard and confirm spans appear for each metric
agent and each connector tool call. I wired the exporter and produced the spans, but I
cannot see your dashboard.

### 3. Rotate the Mastra Platform token (security)

The `MASTRA_PLATFORM_ACCESS_TOKEN` currently in `.env.local` and Vercel is still the one
that was pasted in plaintext earlier, it was never actually rotated. Revoke it in the
Mastra dashboard, generate a new one, and replace it in `.env.local` and via
`vercel env rm/add`. Also add `OPENAI_API_KEY` to the Vercel Preview environment if you
want preview deploys to score with AI (it is currently only on Production + Development).

### 4. Activate Supabase to persist sourcing (optional, about 2 minutes)

The sourcing workflow only writes to the `sourcing_candidates` queue when
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise it runs read-only
(`persisted: false`). Follow `supabase/README.md` to create the project and run
`supabase/migrations/0001_init.sql`, then set those two vars in Vercel. The service-role
key is secret and cannot be provisioned for you. The daily cron (`0 6 * * *`) then keeps
Radar filling; Hobby plans allow one cron run per day, so the schedule is daily by design.

### 5. Add your social profile to complete Gravity (about 1 minute)

Your dossier is Watch, provisional, only because Gravity has no public X or LinkedIn
signal yet. Set `x` and/or `linkedin` on the `luis-reindlmeier` entry in
`src/app/core/data/seed.ts` (or paste your LinkedIn text once that connector is wired).
With real reach, Gravity stops being excluded and the composite moves toward Invest.

### 6. Record the two videos

Scripts are record-ready in `docs/video/`. For the product video, open on the Carsten
Maschmeyer clip (youtube.com/watch?v=EIZRV91Q1-M), the line "Fuer mich sind immer die
Personen wichtiger als das Produkt", cited to brutkasten, 22.10.2024.

## Remaining migration work (not blocking the demo)

- Real founder DISCOVERY: the sourcing discovery agent currently ranks the seed pool by
  thesis fit. A true discovery source (e.g. a GitHub-search tool) would let it find
  net-new founders. Deferred, needs a design decision on the search source.
- Registering the two workflows on the Mastra instance for full workflow-level span
  export (agent + tool spans already export; the workflow was left unregistered to avoid
  a module cycle).

## Open notes

- Live evaluation is deliberately more conservative than the calibrated dossier and the
  panel says so. Its per-metric numbers now vary run-to-run because the metric agents
  gather agentically (the deterministic calibration eval is the stable invariant, not the
  live LLM pass).
- Weights are the shipped Maschmeyer preset (Proof .35 / Gravity .45 / Trajectory .20),
  kept unchanged so every calibrated number stays put.
