# Supabase (pre-staged, optional)

The app runs fully on the committed real-data snapshot (`src/app/core/data/seed.ts`),
so Supabase is not required to demo. This directory is the durable system-of-record and
the pgvector store for founder-market-fit, ready to activate in a couple of minutes.

Why it is not already live: the connected Supabase org is at its 2 active free-project
limit, so a project could not be created autonomously without pausing an unrelated one.
Everything else is done.

## What is here

- `migrations/0001_init.sql` — the full founder-first schema: theses, ventures, founders,
  scores, evidence, trajectory_points, candidate_queue, anchors (with a pgvector embedding
  column) and fmf_vectors. Row level security is on, with public read on the dossier tables.
- `seed-data.json` — the real discovered founders, ventures, theses and the 56 anchor
  calibration rows, exported from the same generator that builds the app snapshot.
- `../scripts/seed-supabase.mjs` — idempotent loader that fills the schema from that JSON.

## Activate (about 2 minutes)

1. In the Supabase dashboard, pause one unused project (or upgrade), then create a new
   project named `aficionado`.
2. Apply the schema. Either paste `migrations/0001_init.sql` into the SQL editor and run it,
   or with the CLI: `supabase link --project-ref <ref>` then `supabase db push`.
3. Seed the real data:
   ```bash
   pnpm add @supabase/supabase-js
   SUPABASE_URL=https://<ref>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
   node scripts/seed-supabase.mjs
   ```
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Vercel project env. The
   `/api/radar`, `/api/founder` and `/api/sourcing` routes already pick Supabase up when
   those variables are present, and the sourcing cron (see `vercel.json`) will refresh the
   candidate queue every three hours.

After step 3 the database holds the discovered founders and their full dossiers; after step
4 the deployed app reads them live and keeps refreshing overnight.
