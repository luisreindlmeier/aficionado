# HANDOFF

Everything that could be built overnight is built. This lists only what needs you, Luis.
Each step is under two minutes; all the pre-work (wrappers, config, .env.example, seeded
data, scripts, migrations) is already in place.

## Already done (no action needed)

- App builds and runs; all pages are real: Radar (home), Pipeline, Evaluation, Decision,
  Diligence, Data sources, Settings.
- Radar is populated with 11 real founders discovered from live GitHub + npm data, each
  scored on Proof / Gravity / Trajectory with a composite, band and percentile.
- Your own dossier (Luis Reindlmeier / gedonus) is evaluated end to end with real evidence
  receipts (transformer-lob, hackathon repos, Wayback history of gedonus.com), landing at a
  calibrated 62, Watch, provisional, because Gravity is honestly low-confidence until you
  add a social profile.
- Full three-metric streaming evaluation (`/api/evaluate`), the connector registry, anchor
  calibration, confidence gating, red-flag gate and the eval suite (113 tests green) all run.
- Docs (README, ARCHITECTURE, DECISIONS, SETUP, docs/*), the pitch deck (`docs/deck/index.html`),
  both 60s video scripts (`docs/video/*`) and the one-pager are written.

## What only you can do

### 1. Paste API keys (optional, the free connectors already work with zero keys)

Copy `.env.example` to `.env.local` for local `vercel dev`, and set the same in the Vercel
project settings for production. Every key is optional; the app degrades gracefully.

| Key | Unlocks | Where to get it |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | Real AI feature extraction in the live eval (heuristic fallback otherwise). On Vercel this is injected automatically for the AI Gateway. | Vercel dashboard, AI Gateway |
| `GITHUB_TOKEN` | Raises the GitHub API limit from 60/h to 5000/h | github.com/settings/tokens (no scopes needed) |
| `PRODUCT_HUNT_TOKEN` | The Product Hunt connector | api.producthunt.com/v2/oauth/applications |
| `X_API_KEY` | X/Twitter reach for Gravity (use a cheap third-party like TwitterAPI.io or Sorsa; the official X API has no free tier) | twitterapi.io or sorsa |
| `OPENREGISTER_KEY` | Handelsregister company filings | openregister.de (free tier) |
| `STACK_EXCHANGE_KEY` | Higher Stack Exchange limits (works keyless too) | stackapps.com/apps/oauth/register |

Semantic Scholar and Wayback need no key.

### 2. Add your social profile to complete Gravity (about 1 minute)

Your dossier is Watch, provisional, only because Gravity has no public X or LinkedIn signal
yet. This is the honest confidence gate working, not a bug. To complete it, give the pipeline
a social handle: set `x` and/or `linkedin` in your founder record
(`src/app/core/data/seed.ts`, the `luis-reindlmeier` entry `handles`), or paste your LinkedIn
text once the paste connector is wired. With real reach numbers, Gravity stops being excluded
and your composite moves up toward Invest.

### 3. Activate Supabase (about 2 minutes, optional)

The schema, seed data and loader are pre-staged. Follow `supabase/README.md`: pause one
unused project in your org (it is at the 2 active free-project limit), create a project named
`aficionado`, run `supabase/migrations/0001_init.sql`, then `node scripts/seed-supabase.mjs`
with the project URL and service-role key. Set those two vars in Vercel and the app reads
Supabase live, with the sourcing cron refreshing every 3 hours.

### 4. Record the two videos

Scripts are record-ready in `docs/video/`. For the product video, open on the Carsten
Maschmeyer clip: youtube.com/watch?v=EIZRV91Q1-M, his answer to the first question (roughly
the first 30 to 90 seconds), the line "Fuer mich sind immer die Personen wichtiger als das
Produkt". Scrub to confirm the exact second, since the source did not expose a timestamp.
On-screen quote is cited to brutkasten, 22.10.2024.

### 5. Trigger the production deploy (about 1 minute, needed)

All the work is committed and pushed to `main` (github.com/luisreindlmeier/aficionado). The
code builds green locally and the last 20 auto-deploys built fine on Vercel's Node 24, so it
is deploy-ready. However, the Vercel GitHub auto-deploy did not fire for tonight's pushes
(the last live deploy is the pre-work commit from the previous session, and two fresh pushes
produced no new deployment). This is a Vercel-side webhook or account issue that needs your
dashboard access, not a code problem.

To go live, do any one of these:
- Vercel dashboard, aficionado project, Deployments, open the latest `main` commit and click
  Redeploy. Or click "Create Deployment" from `main`.
- Or Settings, Git, disconnect and reconnect the GitHub repository, then push once more.
- Or from a shell logged into your Vercel account (the local CLI is currently signed in as a
  different account): `vercel --prod` from the repo root.

The domain `aficionado.dev` is already attached, so once a `main` deploy is READY the full
app is live there. Then set the production secrets from step 1 and verify your live
self-evaluation.

## Open notes

- The live "Run live evaluation" button on a dossier streams the raw public-signal pass. It
  is deliberately more conservative than the calibrated dossier (which adds AI
  founder-market-fit and confidence weighting), and the panel says so.
- Data sources page marks each connector's real status from the single connector registry.
