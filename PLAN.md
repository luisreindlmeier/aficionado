# PLAN — The VC Brain (aficionado)

HackNation / Maschmeyer Group challenge. Build an AI-first VC OS that makes an
evidence-backed €100k pre-seed decision on FOUNDERS within 24h. Thesis: "there are
only good founders, not good companies" (Maschmeyer). We made that judgment
measurable, automated, and explainable.

## Ground truth (reconciled with the brief)

The brief assumed Next.js + Mastra + Inngest. The REAL repo is different and we KEEP it:

- **Frontend**: Angular 22 (standalone, signals, zoneless), static SPA, Tailwind v4.
- **Backend**: Vercel Functions in `/api` (Node). Provider-agnostic model access via the
  **Vercel AI Gateway** (`anthropic/claude-sonnet-5`), heuristic fallback with no key.
- **Orchestration**: known decomposition -> deterministic fan-out (`Promise.all`) + a
  pure-math reducer. No agent swarm, no workflow engine (see DECISIONS.md, Princeton cost).
- **Connector registry** (`core/connectors/descriptors.ts`) is the single source of truth
  that drives BOTH the Data-sources UI AND the agent toolset. This is the brief's core
  abstraction, already present. We extend it.
- **DB**: Supabase + pgvector is PRE-STAGED (migrations, seed SQL, API integration, cron)
  but NOT created — org is at the 2 active free-project limit; creating one needs Luis to
  pause an unrelated project. Primary data path is a committed REAL-data snapshot
  (`src/app/core/data/seed.ts`) generated tonight from live public APIs. Zero runtime deps.
  Supabase is a <2-min activation documented in HANDOFF.

Design system is LOCKED by the repo (overrides brief where they conflict):
black/white minimal, Space Grotesk titles (`.font-title`), Geist body, thin 0.5px borders,
rounded-xl cards, neutral white labels (no colour fills), metric dots Proof=#0d9488 teal /
Gravity=#7c3aed violet / Trajectory=#2563eb BLUE (repo changed it from coral -> blue),
status green #16a34a. No em dashes, no middle dots. Sentence case.

## The score (100% founder/team, public sources only, no questionnaire)

Three metrics 0-100, tunable weights, Maschmeyer preset:
- **Proof (40%)**: demonstrably built + founder-market-fit. GitHub finish-rate + contribution
  value + recursive repo authority, shipped products, npm/PyPI downloads, prior ventures, FMF
  via embedding similarity (problem vs footprint).
- **Gravity (40%)**: do strong people/capital/attention move toward them. True reach (minus
  bots), amplification, recursive network influence (PageRank-style), co-founder/hires,
  accelerators, grants, press. Log-scale, quality-weight.
- **Trajectory (20%)**: slope/velocity/acceleration, recency-weighted cadence, learning
  velocity (clean pivot = positive), normalized by career age. Wayback as time machine.
- **Team bonus** (2+ founders, never a solo penalty): skill-vector complementarity
  (technical/commercial/domain/product), gaps/redundancy, prior shared history.

Mechanics per metric: extract features -> log-scale -> quality-weight -> z-normalize vs a
~45-founder ANCHOR SET -> weighted sum. CONFIDENCE = completeness x cross-source agreement;
low confidence -> no number, route to human. RED-FLAG GATE caps the score. CALIBRATE to a
percentile vs anchors ("78th percentile, sits next to X"). Every number clickable to source
(evidence receipts) = the USP.

## Architecture: two loops

- **Loop A Sourcing** (background cron): thesis -> discovery workers -> triage -> candidate
  queue. Overnight self-run seeds Radar with real founders incl. Luis/gedonus.
- **Loop B Evaluation** (on-demand, streamed): orchestrator -> fan-out to 3 metric workers
  (LLM extract + connectors as tools) -> deterministic reducer -> red-flag gate -> calibrate
  -> stream dossier. Real SSE traces = the "brain at work" (no chatbot).

## Workstreams

1. SPINE (me): shared model (`core/model.ts`), scoring (`core/scoring.ts`), anchor set,
   REAL data fetch for Luis + seed founders, `core/data/seed.ts`. Everything depends on this.
2. Connectors (sub): Gravity + Trajectory signals, more live sources, graceful degradation.
3. Backend (sub/me): `/api/evaluate` full 3-metric fan-out + reducer + gate + calibrate;
   `/api/radar`, `/api/founder`, `/api/sourcing` (cron); Supabase-optional data layer.
4. Frontend (me + subs): Radar (home), Pipeline, Decision, Evaluation dossier rebuild,
   Settings (weights + presets + keys), Diligence.
5. Deliverables (subs): README, ARCHITECTURE, DECISIONS, tech docs, pitch deck (HTML),
   2 x 60s video scripts, one-pager, SETUP, HANDOFF.
6. Eval suite (sub): known founders -> expected bands; drift check.

## Definition of done

App runs + deployed; Radar populated with real founders; Luis/gedonus discovered +
evaluated with real evidence receipts; all pages functional; registry drives UI + tools;
streamed fan-out eval; anchor calibration + confidence + red-flag gate live; eval suite;
all docs + deck + scripts; HANDOFF lists only human-only steps with pre-work done.
