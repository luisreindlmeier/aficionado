<div align="center">
  <h1>Aficionado</h1>
</div>

<p align="center"><em>An AI-first operating system for venture capital. Codename Atlas.</em></p>

<p align="center">
  HackNation / Maschmeyer Group challenge, "The VC Brain".
</p>

---

> "There are only good founders, not good companies." Carsten Maschmeyer

Aficionado takes that thesis and makes it measurable, automated, and explainable. It sources
very-early-stage founders from public signals, scores the founder (not the pitch) on three
metrics, and streams an evidence-backed pre-seed verdict where every number is clickable to
its source. No questionnaire. No chatbot. Public data only.

## Why founders, not companies

At pre-seed there is no revenue, no cohort curve, and no defensible moat to underwrite. The
only durable signal is the founder: what they have demonstrably built, whether strong people
and capital move toward them, and how fast they are compounding. So the founder is the
first-class scored entity. A venture is a light grouping object that carries the problem
context (used for founder-market-fit and team complementarity). The thing you evaluate is a
founder. The thing you decide on is a venture.

## The founder score

Three metrics, each 0 to 100, combined into a weighted composite:

| Metric | Weight (default) | What it measures |
| --- | --- | --- |
| Proof | 40% | Demonstrated building plus founder-market-fit. Shipped work, finish-rate, contribution-weighted repo authority, package adoption, research depth, problem fit. |
| Gravity | 40% | Do strong people, capital and attention move toward them. True reach minus bots, amplification, recursive network influence, co-founders, accelerators, grants, press. |
| Trajectory | 20% | Slope, velocity, acceleration. Recency-weighted cadence, learning velocity (a clean pivot reads positive), normalised by career age. |

Weights are tunable and ship with a **Maschmeyer preset** that leans on Gravity (Proof 0.35 /
Gravity 0.45 / Trajectory 0.20), the attract-and-sell lens. Move the Settings sliders and the
whole pipeline re-ranks live.

Four properties make the number trustworthy:

- **Calibration.** Every score is z-normalised against a 56-founder anchor set (real founders
  who succeeded, went mixed, or failed) and turned into a percentile: "37th percentile, sits
  next to an early finance-ML founder".
- **Confidence gating.** Confidence = evidence completeness x cross-source agreement. A
  low-confidence metric is **excluded** from the composite and flagged, not guessed. We do
  not emit a number we do not trust, and thin profiles route to a human.
- **Red-flag gate.** Coherence and background flags (contradictions, overclaiming,
  feedback-resistance) **cap** the score rather than nudging it, so pitch cannot outrun proof.
- **Evidence receipts.** Every number is clickable down to the exact commit, package, paper,
  or launch it came from. This is the core USP.

A **team bonus** rewards skill-vector complementarity for two or more founders and never
penalises a solo founder.

## The two loops

Aficionado is two loops around one shared, deterministic scoring core.

```
                          ATLAS / AFICIONADO
   ============================================================

   LOOP A  SOURCING  (background, scheduled)
   ------------------------------------------------------------
     thesis  ->  discovery  ->  cheap triage  ->  candidate queue
                                                      |
                                                      v  seeds the Radar
   ------------------------------------------------------------

   LOOP B  EVALUATION  (on-demand, durable, streamed)
   ------------------------------------------------------------
     orchestrator
        |
        +--- fan-out (Promise.all) --------------------+
        |                                              |
        v                v                v            |
     [ Proof ]       [ Gravity ]     [ Trajectory ]    | each worker =
      worker           worker          worker          | LLM extract
        |                |               |             | + connectors
        +--------+-------+-------+-------+              | as tools
                 v
        deterministic reducer  (pure math, scoring.ts)
                 |
                 v
        red-flag gate  ->  calibrate vs anchors
                 |
                 v
        stream dossier as SSE EvalEvents  ("the brain at work")
   ============================================================
                 |
                 v
        shared core:  model.ts  +  scoring.ts  +  anchors.ts
```

Loop B is fan-out / fan-in: the orchestrator runs the three metric workers in parallel, each
worker extracts features with an LLM and pulls evidence through connectors, then a single
**deterministic reducer** (the exact same math in `src/app/core/scoring.ts` that generates
the seed and drives the live UI re-rank) turns features into scores. The red-flag gate and
anchor calibration run last, and the whole thing streams to the UI as it happens.

## The connector registry

Every data source is a **connector**, and one connector is three things at once:

1. a **data adapter** (a server-side `run(query) -> signals`),
2. an **LLM tool** the evaluation agent can call, and
3. a **UI tile** on the Data Sources page.

A single registry, `src/app/core/connectors/descriptors.ts`, is the source of truth that
drives both the UI and the agent toolset. The contract in `connectors/types.ts` is isomorphic
(no Node or browser dependencies) so the Angular UI, the `/api` backend, and a future MCP
surface all share it.

Live and free with zero keys today: **GitHub**, **npm downloads**, **PyPI**, **arXiv**.
Live with a free developer token: **Product Hunt**. Everything else is described honestly with
its real status (available with a key, manual paste per ToS, or not supported).

## The self-demo

The system evaluates its own author, honestly, end to end. Luis Reindlmeier, co-founder of
**GEDONUS** (an AI PowerPoint add-in for finance, tagline "AI drafts your slides. You stay in
control.", Frankfurt, pilot phase), is genuinely discovered under the DACH AI/fintech thesis
and scored from real GitHub evidence:

- **Proof 62.** His bachelor-thesis repo `transformer-lob` (a transformer-based limit order
  book for market making) sits almost exactly on top of the problem GEDONUS solves: 93%
  founder-market-fit, finishes what he ships.
- **Trajectory 63.** Positive, recent, steady cadence normalised for a short career.
- **Gravity 11, low confidence.** No public X or LinkedIn footprint connected yet, so Gravity
  is **excluded** from the composite and flagged rather than dragging the score down.
- **Composite 62, Watch, 37th percentile,** sits next to "an early finance-ML founder". The
  verdict is "Watch, provisional pending LinkedIn".

That honest outcome, a strong-but-incomplete profile that routes to a human instead of
faking certainty, is the point of the demo.

## Screenshots

<!-- TODO: add screenshots before submission -->

- `docs/screenshots/radar.png` Radar, the sourced-founder feed
- `docs/screenshots/evaluation.png` Evaluation dossier with the streamed brain-at-work trace
- `docs/screenshots/decision.png` Decision, the venture-level verdict
- `docs/screenshots/data-sources.png` Data Sources, the connector registry as tiles

## Run it

Requires Node 22.x (see `.nvmrc`) and pnpm.

```bash
nvm use            # Node 22.23.0 from .nvmrc
pnpm install
pnpm start         # dev server with HMR -> http://localhost:4200
```

The SPA runs fully standalone on the committed real-data snapshot, no keys and no backend
required. To exercise the live `/api/evaluate` streaming endpoint locally, run the Vercel
dev server instead, which serves both the SPA and the `/api` functions:

```bash
vercel dev         # SPA + /api on one origin
```

Typecheck and build:

```bash
pnpm run build                          # production build + Angular typecheck -> dist/aficionado/browser
npx tsc -p api/tsconfig.json --noEmit   # typecheck the /api serverless functions
pnpm run lint                           # angular-eslint
pnpm run format                         # prettier
```

Environment variables are all optional (see `.env.example` and `SETUP.md`). With no keys the
backend returns a deterministic heuristic score; with `AI_GATEWAY_API_KEY` it returns an AI
verdict via the Vercel AI Gateway.

## Stack

- **Angular 22**, standalone components, signals, zoneless change detection. Static SPA.
- **Tailwind CSS v4** with semantic tokens.
- **Vercel Functions** in `/api` (Node) for the backend.
- **Vercel AI Gateway** for provider-agnostic model access (`anthropic/claude-sonnet-5`),
  with a deterministic heuristic fallback when no key is present.
- **Committed real-data snapshot** (`src/app/core/data/seed.ts`) as the zero-dependency data
  source, generated from live public APIs.
- **Supabase + pgvector** designed as an optional activation layer (see `DECISIONS.md` and
  `docs/DATA-MODEL.md`), not required to run.

## Project structure

```
aficionado/
├── src/app/
│   ├── core/
│   │   ├── model.ts            # founder-first domain model (isomorphic)
│   │   ├── metrics.ts          # Metric union + metric colours
│   │   ├── scoring.ts          # deterministic reducer: log-scale, z-norm, gate, calibrate
│   │   ├── nav.ts              # single source of truth for sidebar + routes
│   │   ├── connectors/
│   │   │   ├── types.ts        # isomorphic connector contract + Signal + EvaluationEvent
│   │   │   └── descriptors.ts  # CONNECTORS registry: drives UI + agent toolset
│   │   ├── data/
│   │   │   ├── anchors.ts      # 56-founder calibration anchor set
│   │   │   ├── seed.ts         # committed real-data snapshot (founders, ventures, theses)
│   │   │   └── data.service.ts # client data layer, live re-rank by weight preset
│   │   ├── layout/ brand/ ui/  # app shell (header, sidebar, footer, command palette)
│   │   └── command-palette.service.ts
│   └── features/
│       ├── evaluation/         # Evaluation page + EvaluationService (streams /api/evaluate)
│       ├── data-sources/       # Data Sources page (renders the connector registry)
│       └── placeholder-page.ts # fallback for routes still being built on the data spine
├── api/
│   ├── evaluate.ts             # POST -> SSE stream of evaluation events
│   └── _lib/
│       ├── ai.ts               # AI verdict via Vercel AI Gateway
│       ├── proof.ts            # deterministic heuristic fallback
│       └── connectors/         # server-only run() adapters (github, npm, pypi, arxiv, producthunt)
├── docs/                       # SCORING, CONNECTORS, DATA-MODEL (+ deck, video, one-pager)
├── ARCHITECTURE.md  DECISIONS.md  SETUP.md
├── vercel.json  .env.example  .nvmrc
```

## What is real vs pre-staged

Honesty is a feature here, so the same discipline applies to the repo itself.

| Area | Status |
| --- | --- |
| Founder-first model + deterministic scoring engine | Real. `scoring.ts` is the single reducer used by the seed generator, the live UI re-rank, and the backend. |
| 56-founder anchor calibration | Real. Percentiles and the "sits next to X" neighbour are computed against it. |
| Committed real-data snapshot | Real. `seed.ts` numeric receipts (stars, followers, repos, dates, downloads) are fetched from live public APIs. Qualitative judgements are authored. |
| Connector registry drives UI + backend | Real. One registry, one contract. |
| Live connector adapters | Real for GitHub, npm, PyPI, arXiv, Wayback, Semantic Scholar and Stack Exchange (zero keys) plus Product Hunt (free token). The rest are described with honest status. |
| Streamed `/api/evaluate` | Real, full three-metric fan-out. Emits `trace` steps, fans out each metric's connectors in parallel streaming every `signal` as SSE, reduces per metric, then runs the deterministic reducer, red-flag gate and calibration and streams the final `FounderScore`. |
| Full three-metric fan-out streaming (`EvalEvent`/`TraceStep`) | Real. Wired in `api/evaluate.ts` and rendered live as the brain-at-work trace on the Evaluation page. |
| Loop A sourcing cron | Wired. `/api/sourcing` runs on the Vercel cron in `vercel.json` (every 3 hours) and triages founders against the active thesis; it writes to Supabase when that is activated, else returns the pass summary. |
| Supabase + pgvector data layer | Pre-staged. Schema (`supabase/migrations/0001_init.sql`), a real-data export (`supabase/seed-data.json`) and an idempotent loader (`scripts/seed-supabase.mjs`) are in the repo. Activatable in about 2 minutes (`supabase/README.md`); the org sits at the free-project limit so the snapshot is the primary path. |
| AI Gateway with heuristic fallback | Real. Works with or without a key. |

See `ARCHITECTURE.md` for the system in depth, `DECISIONS.md` for why it is built this way,
and `docs/SCORING.md` for the full math.
