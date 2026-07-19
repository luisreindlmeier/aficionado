# PROGRESS

Running log for the overnight build. Newest at top.

## Session start (night)
- Explored repo: Angular 22 SPA + Vercel Functions `/api` + connector registry + streaming
  `/api/evaluate` (Proof only). Baseline build green (318KB). API typecheck clean.
- Reconciled brief (Next.js/Mastra) with reality (Angular/Vercel Functions). Keep the repo
  stack; document the deviation in DECISIONS.md.
- Supabase: org at 2 active free-project limit -> cannot create autonomously. Decision:
  committed real-data snapshot is primary; Supabase pre-staged for <2-min activation.
- Baseline design system + metric colours captured (Trajectory is BLUE per repo, not coral).

## SPINE DONE (typechecks clean)
- `core/model.ts` founder-first domain model; `core/scoring.ts` deterministic reducer
  (log-scale, z-norm, percentile, confidence, red-flag gate, team bonus, presets, live
  recompute). `core/data/anchors.ts` (56-founder calibration set, generated),
  `core/data/seed.ts` (11 REAL founders + ventures + theses, generated from live GitHub +
  npm data), `core/data/data.service.ts` (client data layer, live re-rank by weights).
- Real data fetched: GitHub for 12 handles, npm downloads (sindre 19.1B/mo, antfu 165M,
  Evan 82M). Generators in scratchpad: fetch_founders.mjs, fetch_npm.mjs, gen_seed.mjs.
- Hero (Luis) computed HONESTLY: Proof 62 (thesis on transformer LOB market-making =
  93% FMF, finishes what he ships), Gravity 11 LOW-CONFIDENCE (no public X/LinkedIn) ->
  EXCLUDED from composite + flagged, Trajectory 63. Composite 62, Watch, 37th pct, "sits
  next to an early finance-ML founder". Pending-LinkedIn is the honest hero narrative.
- Research done (scratchpad/research_maschmeyer.md): clip EIZRV91Q1-M, gedonus facts.

## DONE (all workstreams integrated, all green)
- [x] Frontend: Radar (live feed), Evaluation (master-detail dossier + brain-at-work),
  Pipeline, Decision, Settings (live re-rank), Diligence. All 7 pages real, screenshot-verified.
- [x] Backend: full 3-metric fan-out `/api/evaluate` streaming EvalEvent (smoke-tested: 47
  frames, real Wayback data), + /api/radar, /api/founder, /api/sourcing (cron), reducer,
  new live connectors (github G/T signals, wayback, semanticscholar, stackexchange = 8 live).
- [x] Deliverables: README, ARCHITECTURE, DECISIONS, SETUP, docs/SCORING|CONNECTORS|DATA-MODEL,
  pitch deck (docs/deck/index.html), 2 video scripts, one-pager. Docs reconciled to reality.
- [x] Eval suite: 113 tests, 14/14 cases, 0 drift; Luis case reproduces the seed exactly.
- [x] Supabase pre-staged: schema migration, seed-data.json export, seed-supabase.mjs, README.
- [x] HANDOFF.md written (human-only steps, each <2 min).
- Verified: pnpm build green, api tsc clean, eval green, headless screenshots of all pages.

## Extra over-delivery (done)
- [x] Interactive "Complete Gravity" flow: paste a LinkedIn/X profile on the dossier and the
  composite re-scores live (Luis 62 Watch provisional -> 65 Watch, Gravity included, "routed
  to human" clears). Verified end-to-end via Chrome DevTools Protocol. This is the video's
  "add LinkedIn and it re-computes" beat, made real.
- [x] Real UI screenshots embedded in the README (docs/screenshots/*).
- [x] 8 live connectors flipped in the registry (added wayback, semanticscholar, stackexchange).

## Blocked on human (documented in HANDOFF)
- Vercel production deploy: the GitHub auto-deploy did NOT fire for tonight's 5 pushes (last
  live deploy is the previous session's pre-work commit). Code is on main (github), builds
  green, proven on Vercel Node 24 by the prior 20 deploys. Needs Luis to click Redeploy /
  reconnect the Git integration in the Vercel dashboard. The local `vercel` CLI is signed in
  as a different account (bibu-admin), so use the vercel-priv MCP to inspect Luis's project.
  Domain aficionado.dev is already attached; app goes live the moment a main deploy is READY.

## Definition of done
All met except the live deploy (blocked above). App runs + all 7 pages verified; Radar
populated with real founders; Luis/gedonus discovered + evaluated with real receipts;
registry drives UI + tools; streamed 3-metric fan-out (smoke-tested); calibration + confidence
gate + red-flag gate live; eval suite 113 green; README/ARCH/DECISIONS/tech docs; deck + 2
video scripts + one-pager; Supabase pre-staged; HANDOFF complete.
