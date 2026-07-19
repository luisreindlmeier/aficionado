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

## Next (parallel)
- [ ] Frontend: Radar + Evaluation (me), Pipeline/Decision/Settings/Diligence (sub)
- [ ] Backend full 3-metric eval + endpoints + connectors (sub)
- [ ] Deliverables: README/ARCH/DECISIONS/tech (sub), deck+video+onepager (sub)
- [ ] Eval suite (sub)
- [ ] Supabase migrations+seed (pre-staged), integrate, build, push, verify, HANDOFF
