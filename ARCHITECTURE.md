# Architecture

Aficionado is two loops built around one deterministic scoring core. Loop A sources founders
in the background. Loop B evaluates a founder on demand and streams the result. Both loops
read and write the same founder-first model and reduce evidence to a score through the same
pure-math function, so a number is reproducible whether it was computed by the overnight seed
generator, by the live UI as you drag a weight slider, or by the serverless backend.

This document covers the two loops, the fan-out / fan-in with a deterministic reducer, the
connector contract, the scoring pipeline, calibration, confidence gating, the red-flag gate,
streaming and observability, the data model, and the optional Supabase layer.

Where an area is designed but not yet wired, it says so. See the "What is real vs pre-staged"
table in `README.md` for the summary.

## Design principles

- **One reducer, three call sites.** All scoring math lives in `src/app/core/scoring.ts`. The
  seed generator, the Angular `DataService`, and the `/api` backend all call it. There is no
  second implementation to drift.
- **Isomorphic contracts.** `core/model.ts` and `core/connectors/types.ts` have no Node or
  browser dependencies, so the UI, the backend, and a future MCP surface share the same
  types byte for byte.
- **Deterministic where it matters.** The LLM extracts and judges. The math that turns
  features into a score, gates it, and calibrates it is pure and reproducible. Randomness
  never touches the number you show an investor.
- **Evidence first.** Every displayed number carries `Receipt`s down to a URL. A score with
  no receipts is a bug.
- **Honest uncertainty.** Low-confidence metrics are excluded, thin profiles route to a
  human, and coherence flags cap the score. The system would rather say "we do not know yet"
  than emit a confident wrong number.

## System overview

```
   +-------------------------------------------------------------+
   |                     ANGULAR 22 SPA (static)                 |
   |  Radar  Pipeline  Watchlist  Evaluation  Decision  Settings |
   |  Data Sources                                               |
   |                                                             |
   |   DataService (signals) <---- seed.ts (committed snapshot)  |
   |        |                                                    |
   |        | recomputeComposite() on weight change (live)       |
   |        v                                                    |
   |   scoring.ts  (shared reducer, isomorphic)                  |
   +----------------------------|--------------------------------+
                                | fetch (SSE)
                                v
   +-------------------------------------------------------------+
   |            VERCEL FUNCTIONS  /api  (Node, server-only)      |
   |                                                             |
   |   /api/evaluate  --- fan-out connectors --> stream signals  |
   |        |                                                    |
   |        +-- ai.ts (Vercel AI Gateway)  or  proof.ts (heur.)  |
   |        |                                                    |
   |   _lib/connectors/*  run(query) -> ConnectorResult          |
   |        github  npm  pypi  arxiv  producthunt                |
   +----------------------------|--------------------------------+
                                | HTTPS
                                v
        Public APIs:  api.github.com  registry.npmjs.org
        pypistats.org  export.arxiv.org  api.producthunt.com

   Optional activation layer (designed, DataService abstracts it):
        Supabase Postgres + pgvector  <---  Vercel Cron (Loop A)
```

## The Mastra workflow system

Both loops run as durable Mastra workflows (`@mastra/core`). The design is one
registry, tools, scoped agents, a durable workflow and a deterministic reducer:

- **Connectors as tools** (`api/_lib/tools.ts`): every live connector runtime is wrapped
  as a Mastra `createTool` with a typed founder-identity input and signal output. The
  same `CONNECTORS` descriptor registry that renders the Data-sources UI names the tools,
  and `METRIC_TOOLS` groups them per metric. One source of truth, two surfaces.
- **Agents** (`api/_lib/mastra.ts`): three metric agents (`proofAgent`, `gravityAgent`,
  `trajectoryAgent`), each carrying ONLY its metric's tools; a conservative red-flag
  `criticAgent`; and a `discoveryAgent` for sourcing. Every agent uses OpenAI `gpt-5.5`
  through one `MODEL` constant. All are registered on the Mastra instance, whose
  Observability config ships agent + tool spans to the Mastra Platform dashboard.
- **Evaluation workflow** (`api/_lib/workflow.ts`): `createWorkflow` chains
  ingest → `.parallel([proof, gravity, trajectory])` → reduce → `.commit()`. Each metric
  step runs its agent agentically: the agent calls its own connector tools to gather
  evidence, the tool activity streams into the brain-at-work UI (via an
  `AsyncLocalStorage` emitter), then `reduceMetric` extracts features and the shared
  deterministic math produces the metric score. The reduce step runs the SAME
  `confidentComposite` / `redFlagGate` / `bandOf` / `percentileOf`, plus the critic's red
  flags feeding the (unchanged) gate. `/api/evaluate` just runs this workflow.
- **Sourcing workflow** (`api/_lib/sourcing-workflow.ts`): `discover` (deterministic
  keyword triage) → `rank` (discovery agent selects genuine thesis matches) → `persist`
  (Supabase upsert when creds are set). `/api/sourcing` runs it on a daily cron.
- **Evals** (`eval/scorers.ts`): the calibration set is exposed as a Mastra `createScorer`
  and run over every known founder in CI via `pnpm eval`.

The stability contract is the deterministic calibration eval, not the live LLM pass: the
scoring math is byte-identical to before the migration and Luis / gedonus still lands the
calibrated Watch 62. Live per-metric numbers vary run-to-run because evidence is now
agent-gathered.

## Loop A: sourcing (background)

Loop A keeps the top of the funnel full without a human in the seat. It is designed as a
scheduled background job: a Vercel Cron trigger wakes discovery workers, which expand an
active thesis into candidate founders, run a cheap triage score to reject the obvious noise,
and push survivors onto a candidate queue that seeds the Radar.

```
   LOOP A  SOURCING
   ------------------------------------------------------------
   Vercel Cron
       |
       v
   thesis (Thesis: keywords, description)
       |
       v
   discovery workers  (search public sources for handles matching the thesis)
       |
       v
   cheap triage        (0..100 low-cost score, Founder.triage)
       |   reject < threshold
       v
   candidate queue     (status: 'discovered' -> 'watching')
       |
       v
   Radar feed          (DataService.radarFeed, freshest first)
```

The domain model already carries every field this loop produces: `Founder.thesisId`,
`Founder.triage`, `Founder.discoveredAt`, and `Founder.status` (`discovered` ->
`watching` -> `evaluating` -> `decided`). The theses themselves are first-class
(`Thesis` with `keywords` and an `active` flag); the shipped snapshot has three, with
"Technical AI and fintech founders, DACH" active, which is how Luis / GEDONUS surfaces.

Status today: the Radar is populated from the committed snapshot rather than a live cron.
`vercel.json` does not yet declare a cron, and there is no `/api/sourcing` function. The
model, the triage field, the thesis objects, and the `DataService.radarFeed` computed are all
in place, so activating Loop A is adding the cron function, not reshaping the data.

## Loop B: evaluation (on-demand, streamed)

Loop B is the heart of the product. An orchestrator decomposes the evaluation into three
known metric workers, fans them out in parallel, fans their features back into one
deterministic reducer, gates and calibrates the result, and streams every step to the UI so
the user watches the brain work.

```
   LOOP B  EVALUATION
   ============================================================
   POST /api/evaluate   { name, github?, npm?, pypi?, x?, keywords? }
        |
        v
   orchestrator  (plan: which metrics, which connectors)
        |
        |   fan-out  (Promise.all over metric workers)
        +-----------------+-----------------+
        v                 v                 v
   +---------+       +---------+       +-----------+
   |  PROOF  |       | GRAVITY |       |TRAJECTORY |
   | worker  |       | worker  |       |  worker   |
   +----+----+       +----+----+       +-----+-----+
        | each worker:                        |
        |   1. select connectors by metric[]  |
        |   2. run() connectors as tools      |
        |   3. stream each Signal as it lands  |
        |   4. LLM extracts Features           |
        +-----------------+------------------+
                          |  fan-in
                          v
   +----------------------------------------------------------+
   |   DETERMINISTIC REDUCER   (scoring.ts, pure math)        |
   |   log10p -> quality-weight -> zScore vs anchors ->       |
   |   squash -> weighted composite                           |
   |   confidence = completeness x agreement                  |
   |   confidentComposite: exclude low-confidence metrics     |
   +----------------------------|-----------------------------+
                                v
   redFlagGate(rawComposite, flags)     (coherence/background CAP)
                                |
                                v
   calibrate: percentileOf + nearestAnchor  ("37th pct, next to X")
                                |
                                v
   stream FounderScore as SSE  ->  Evaluation dossier
   ============================================================
```

### Why fan-out plus a deterministic reducer

The decomposition is known in advance: there are exactly three metrics. That is a structured
problem, not an open-ended one, so it does not need a free-roaming multi-agent swarm arguing
with itself. It needs three parallel extractors and one honest calculator. The workers do the
open-ended part (read messy public evidence, extract clean features). The reducer does the
part that must be trustworthy and identical every time (turn features into a gated, calibrated
number). See `DECISIONS.md` ADR-002 for the cost and reproducibility argument.

The fan-out is a plain `Promise.all`. `api/evaluate.ts` runs each metric's connectors in
parallel, streaming every `signal` as it resolves and a `metric` score per phase, then runs
the deterministic reducer, red-flag gate and calibration and streams the final
`FounderScore`. The full three-worker orchestration and the richer `EvalEvent` trace
described above is what the endpoint ships today, rendered live as the brain-at-work panel.

### The reducer is shared

The exact functions the reducer calls (`log10p`, `zScore`, `squash`, `compositeOf`,
`confidentComposite`, `redFlagGate`, `percentileOf`, `nearestAnchor`) are the same ones the
Angular `DataService.founders` computed calls through `recomputeComposite` every time a
weight changes. Drag the Gravity slider in Settings and the entire pipeline re-ranks live,
using the identical math the backend would use. That is only possible because scoring is a
pure, isomorphic module with no server or DOM dependencies.

## The connector contract

A connector is one object that plays three roles. The descriptor is the declarative half; the
runtime `run()` is the imperative half.

```
   ConnectorDescriptor (core/connectors/descriptors.ts, isomorphic)
   -----------------------------------------------------------------
     id        : ConnectorId          e.g. 'github'
     name      : string               UI label
     domain    : string               source domain
     description: string              also the LLM tool description
     icon,color: string               UI tile only
     group     : Connected | Available | Manual input | Not supported
     auth      : none | key | manual | unsupported
     metrics   : Metric[]             which metrics this feeds
     note      : string               honest status line
     action    : connected | connect | add-key | paste | unsupported
     live      : boolean              true once a run() exists

   Runtime adapter (api/_lib/connectors/*, server-only)
   -----------------------------------------------------------------
     run(query: FounderQuery) -> Promise<ConnectorResult>
       ConnectorResult = { signals: Signal[], note?: string }
       Signal = { connector, metric, text, value?, url? }
```

One descriptor drives three consumers:

1. **UI tile.** The Data Sources page renders straight from `CONNECTORS`, grouped by
   `group`, with the `action` deciding the button (connected, connect, add-key, paste).
2. **Backend adapter.** `api/_lib/connectors/index.ts` maps `ConnectorId` to a `run()` in
   `RUNNERS`. `PROOF_CONNECTORS` lists the ids the evaluation fans out for the Proof phase.
3. **LLM tool.** Because the descriptor already carries a `description`, a `metrics[]` list,
   and the input shape is the shared `FounderQuery`, each descriptor projects cleanly into an
   AI SDK tool definition, which is exactly what the isomorphic contract in `types.ts` was
   built for ("a later MCP surface can reuse the exact same descriptors and tool shapes").

Adding a source is: add a descriptor, add a `run()`, register it in `RUNNERS`. It becomes
AI-callable and visible in the UI in one step. Full details and the source-by-source status
table are in `docs/CONNECTORS.md`.

Live adapters today: `github`, `npm`, `pypi`, `arxiv` (zero keys) and `producthunt` (free
token). They hit `api.github.com`, `registry.npmjs.org` + `api.npmjs.org`, `pypistats.org`,
`export.arxiv.org`, and `api.producthunt.com` respectively, normalise the response into
`Signal`s, and degrade gracefully (a missing handle returns an empty result with a `note`,
never an exception that kills the fan-out).

## The scoring pipeline

Each metric is scored by the same recipe. Feature extraction is done by the LLM worker; steps
2 through 8 are the deterministic reducer. Full math and worked example: `docs/SCORING.md`.

```
   1. extract features from evidence         (LLM worker)
   2. log-scale counts        log10p(x) = log10(max(0,x) + 1)
   3. quality-weight          Proof: contribution value (CVALUE)
                              Gravity: network authority (Klout-style)
   4. z-normalise vs anchors  zScore(x, anchorColumn)
   5. squash to 0..100        squash(z) = clamp(round(50 + 16.7*z), 2, 99)
   6. weighted composite      compositeOf(scores, weights)
   7. confidence              confidenceOf(completeness, agreement)
                              confidentComposite excludes 'low' metrics
   8. red-flag gate + calibrate
```

Log-scaling first means a 10x difference in raw count is a constant step, so one viral repo
does not blow out the scale. Quality-weighting means a star from a high-authority account is
worth more than a star from a throwaway, and a maintained package outweighs a published-once
one. Z-normalising against the anchor set puts every metric in the same comparable units
before the weighted sum.

## Calibration

A raw 0..100 number means nothing without a reference population. The 56-founder anchor set in
`core/data/anchors.ts` is that reference: real founders spanning success, mixed, and failed
outcomes, plus a set of clearly-labelled archetypes ("an early finance-ML founder") for
natural "sits next to X" phrasing.

Two calibration outputs per score:

- **Percentile.** `percentileOf(value, anchorColumn)` is the share of anchors below the
  value, so "37th percentile" is literal, not a vibe.
- **Nearest neighbour.** `nearestAnchor` finds the anchor whose composite (at the active
  weights) is closest, excluding the founder themselves and, for a clean profile, excluding
  cautionary tales. If the red-flag gate fired, failed anchors become eligible, so a capped
  founder can correctly sit next to a WeWork or a Theranos.

Because the composite depends on weights and the reducer is shared, the percentile and the
neighbour recompute live when you change the preset, keeping calibration honest under any
weighting.

## Confidence gating

Confidence is not decoration; it changes the arithmetic.

```
   per metric:  completeness in 0..1   (how much evidence)
                agreement    in 0..1   (do sources corroborate)
                confidence = confidenceOf(completeness, agreement)
                  c = completeness * agreement
                  c >= 0.60 -> high
                  c >= 0.33 -> medium
                  else      -> low

   composite:   confidentComposite(scores, confidences, weights)
                  trusted = metrics where confidence != 'low'
                  a 'low' metric is EXCLUDED and its weight redistributed
                  across the trusted metrics (never divide by zero)

   overall:     overallConfidence knocks the level down when any metric
                had to be excluded
```

This is the mechanism behind the self-demo. Luis has no public X or LinkedIn, so Gravity
comes back at 11 with low confidence. Rather than let a near-zero Gravity crush a genuinely
strong founder under the Maschmeyer preset (which weights Gravity 0.45), the reducer excludes
Gravity and computes the composite from Proof and Trajectory alone, then flags the gap in
`Founder.note`. The band logic (`bandOf`) refuses to emit "Invest" on low confidence, and
`routeToHuman` fires on low confidence or fewer than three pieces of evidence. The honest
output is "Watch, provisional pending LinkedIn", which is the correct answer.

## The red-flag gate

Coherence and background problems (contradictions, overclaiming, feedback-resistance,
governance issues) are categorically different from a low score. A brilliant builder with a
fatal integrity flag is not a "medium" founder; they are a capped one. So the gate caps, it
does not subtract.

```
   redFlagGate(rawComposite, flags):
     high   = count of severity 'high'
     medium = count of severity 'medium'
     cap = 100
     if high   >= 1:  cap = min(cap, 55 - (high   - 1) * 10)
     if medium >= 1:  cap = min(cap, 78 - (medium - 1) * 6)
     cap = clamp(cap, 20, 100)
     if rawComposite <= cap:  unchanged
     else:                    capped at cap, with a reason string
```

One high-severity flag caps at 55, two at 45, and so on; medium flags cap more gently. In the
anchor set this is exactly why Elizabeth Holmes (Proof 20, Gravity 90) does not score as a
high-gravity founder: the gate pulls the composite down to the cap, and the "sits next to X"
line is allowed to point at the failed archetypes. A clean founder like Luis has only
low-severity flags (first-time founder, pilot not yet measurable, co-founder not yet
evaluated), so his gate does not fire and `capped` is false.

## Streaming and observability, the brain at work

There is no chat box. The interface is the reasoning made visible. The evaluation streams
Server-Sent Events, and the Evaluation page renders them as they arrive: the plan, each
connector starting and finishing, each evidence signal as it lands, each metric as it
resolves, and finally the composite.

Two event contracts exist in the codebase:

- `EvaluationEvent` in `connectors/types.ts` is what the current `/api/evaluate` emits:
  `started`, `connector` (running / done / error), `signal`, `verdict`, `done`, `error`.
- `EvalEvent` in `model.ts` is the richer designed contract for the full fan-out: it adds a
  `trace` step (`TraceStep` with kinds `plan`, `fetch`, `extract`, `reduce`, `gate`,
  `calibrate`, `done`), a per-metric `phase`, a `metric` result, and a `final` `FounderScore`.

```
   client                         /api/evaluate
     |  POST { name, github, ... }     |
     |-------------------------------->|
     |                                 |  send started
     |<-- data: {type:'connector',...} |  each connector: running
     |<-- data: {type:'signal',...}    |  each evidence line as it lands
     |<-- data: {type:'connector',...} |  each connector: done
     |                                 |  scoreProofWithAI or heuristic
     |<-- data: {type:'verdict',...}   |  the metric verdict
     |<-- data: {type:'done'}          |
     |                                 |  res.end()
```

The stream doubles as the observability trace: because each connector reports `running` /
`done` / `error` with a `note`, a failed source is visible in the UI instead of silently
missing, and the reason travels with it.

## The data model

The model is founder-first. A `Founder` is the first-class scored entity and the thing you
click into. A `Venture` is a light grouping object that links founders and holds the problem
statement used for founder-market-fit and team complementarity.

```
   Thesis ----< Founder >---- Venture
                  |              |
                  |              +-- VentureDecision  (band, composite, routeToHuman)
                  |              +-- TeamAnalysis      (SkillVector coverage, bonus)
                  |
                  +-- FounderScore
                  |      +-- MetricScore  x3  (Proof, Gravity, Trajectory)
                  |             +-- Feature[]   (raw, z, contribution)
                  |                    +-- Receipt[]  (Signal + feature, quote, weight, at)
                  |      +-- composite, rawComposite, percentile, band,
                  |          confidence, capped, capReason, anchorNeighbor
                  |      +-- SkillVector  (technical, commercial, domain, product)
                  +-- Fmf              (similarity, rationale, receipts)
                  +-- RedFlag[]        (text, note, severity)
                  +-- TrajectoryPoint[] (date, value, kind, url)

   AnchorFounder[]  (calibration reference: proof, gravity, trajectory, outcome)
```

The evaluation object is the `Founder`; the decision object is the `Venture`
(`VentureDecision`, aggregated from its founders). Company data is context on the founder,
never the primary unit. Full field-by-field reference and relationships are in
`docs/DATA-MODEL.md`.

## The Supabase-optional layer

The primary data path is the committed snapshot: `DataService` reads `seed.ts`, fills
discovery timestamps at load, and recomputes composites live. That is zero-dependency and
deterministic, which is exactly what you want for a demo.

Supabase + pgvector is the designed activation layer for persistence and for Loop A at scale.
`DataService` is the seam: every page reads founders, ventures, and decisions through its
signals, so swapping the source from `seed.ts` to an `/api`-backed Supabase reader touches one
service, not the pages. The target schema (founders, ventures, evidence, scores,
candidate_queue, anchors with pgvector embeddings, fmf_vectors) is specified in
`docs/DATA-MODEL.md`.

Status: the schema and activation steps are documented, not yet applied. The org sits at the
free-project active limit, so the snapshot is deliberately the primary path and Supabase is a
short, documented activation rather than a runtime dependency. See `DECISIONS.md` ADR-004.

## Failure modes and degradation

- **No AI key.** `scoreProofWithAI` returns null when `AI_GATEWAY_API_KEY` is absent, and the
  endpoint falls back to `scoreProofHeuristic`, a deterministic score from signal breadth and
  magnitude. The pipeline always returns a real number.
- **No GitHub token.** Connectors still work at the 60/hour anonymous rate limit; a token
  just raises it to 5000/hour.
- **A connector fails.** The fan-out catches per-connector errors and emits a `connector`
  error event with the message; the other connectors and the final score are unaffected.
- **Thin evidence.** Confidence drops, the metric may be excluded, the band cannot be Invest,
  and the profile routes to a human.
