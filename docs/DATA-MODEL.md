# Data model

The model is founder-first and isomorphic. It lives in `src/app/core/model.ts` with no Node or
browser dependencies, so the Angular UI, the `/api` backend, and a future MCP surface share it
byte for byte. A `Founder` is the first-class scored entity and the thing you click into; a
`Venture` is a light grouping object that carries the problem context. The evaluation object is
the founder; the decision object is the venture.

## Entity map

```
   Thesis
     |  drives sourcing (Loop A)
     v
   Founder  >------ ventureId ------>  Venture
     |  (evaluated, Loop B)              |
     |                                   +-- VentureDecision   (aggregated from founders)
     |                                   +-- TeamAnalysis      (skill coverage + bonus)
     |                                   +-- founderIds[]       (back-reference)
     |
     +-- FounderScore
     |     +-- proof:      MetricScore
     |     +-- gravity:    MetricScore
     |     +-- trajectory: MetricScore
     |     |     +-- features:  Feature[]
     |     |     |     +-- receipts: Receipt[]   (Signal + feature, quote, weight, at)
     |     |     +-- receipts:  Receipt[]        (aggregated, strongest first)
     |     +-- composite, rawComposite, percentile, band, confidence,
     |     |   capped, capReason, anchorNeighbor
     |     +-- skills:   SkillVector
     |
     +-- fmf:         Fmf              (founder-market-fit similarity + receipts)
     +-- redFlags:    RedFlag[]
     +-- trajectory:  TrajectoryPoint[]  (the replay timeline)
     +-- handles:     Handles
     +-- note:        string           (honest gap note from the confidence system)

   AnchorFounder[]   calibration reference set (not linked, a fixed population)
   WeightPreset[]    tunable metric weights (Maschmeyer, Balanced, Builder, Momentum)
   EvalEvent         streamed evaluation contract (Loop B), carries TraceStep
```

## Core entities

### Founder

The first-class scored entity. Carries identity, sourcing fields (Loop A), and evaluation
fields (Loop B, present once evaluated).

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `name`, `initials`, `headline` | string | identity |
| `location` | string? | |
| `handles` | `Handles` | github, x, linkedin, npm, pypi, website, scholar |
| `ventureId` | string | link to the grouping `Venture` |
| `discoveredAt` | ISO string | filled at load from an offset so the Radar reads live |
| `thesisId` | string | which sourcing thesis surfaced them |
| `triage` | number 0..100 | cheap discovery score (Loop A) |
| `status` | `discovered` \| `watching` \| `evaluating` \| `decided` | lifecycle |
| `pipeline` | `Watch` \| `Evaluating` \| `Decided` | kanban stage |
| `score` | `FounderScore?` | present once evaluated |
| `fmf` | `Fmf?` | founder-market-fit |
| `redFlags` | `RedFlag[]` | |
| `trajectory` | `TrajectoryPoint[]` | replay timeline |
| `evidenceCount` | number | feeds `routeToHuman` |
| `note` | string? | honest gap note surfaced by the confidence system |

### Venture

A light grouping object. It links founders and holds the problem statement used for
founder-market-fit and team complementarity. It is not the scored unit.

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `name`, `monogram`, `tagline` | string | identity |
| `problem` | string | problem statement, used for FMF + complementarity |
| `stage`, `industry` | string | |
| `location`, `foundedYear`, `website` | optional | |
| `founderIds` | string[] | the founders in this venture |
| `decision` | `VentureDecision?` | the decision object |
| `team` | `TeamAnalysis?` | team bonus + coverage |

### FounderScore

The full computed score. Metric scores are weight-independent; the composite and everything
below it are recomputed from the active weight preset (`recomputeComposite`).

| Field | Type | Notes |
| --- | --- | --- |
| `proof`, `gravity`, `trajectory` | `MetricScore` | the three metrics |
| `composite` | number | weighted, after the red-flag gate |
| `rawComposite` | number | before the gate |
| `percentile` | number | composite percentile vs anchors |
| `band` | `Invest` \| `Watch` \| `Pass` | |
| `confidence` | `high` \| `medium` \| `low` | overall |
| `capped` | boolean | did the gate lower the score |
| `capReason` | string? | why |
| `anchorNeighbor` | string? | "sits next to X" |
| `skills` | `SkillVector` | technical, commercial, domain, product |

### MetricScore

One metric's outcome with its full evidence trail.

| Field | Type | Notes |
| --- | --- | --- |
| `metric` | `Metric` | Proof, Gravity, or Trajectory |
| `score` | number 0..100 | |
| `weight` | number 0..1 | from the active preset |
| `percentile` | number | vs the anchor column |
| `confidence` | `ConfidenceLevel` | |
| `completeness` | number 0..1 | evidence completeness |
| `agreement` | number 0..1 | cross-source agreement |
| `rationale` | string | |
| `features` | `Feature[]` | the atomic scored units |
| `receipts` | `Receipt[]?` | aggregated, strongest first |
| `z` | number? | calibration z vs the anchor column |
| `by` | `ai` \| `heuristic` | who produced the score |

### Feature

A single scored feature within a metric, the atomic unit of the recipe.

| Field | Type | Notes |
| --- | --- | --- |
| `key`, `label` | string | e.g. `stars`, "Contribution-weighted stars" |
| `raw` | number | magnitude before transforms |
| `display` | string | human display, e.g. "15 adj. stars" |
| `z` | number | z-score vs anchors after log-scale + quality-weight |
| `contribution` | number | points contributed, 0..100 space |
| `receipts` | `Receipt[]` | the evidence for this feature |

### Receipt

An atomic evidence receipt: a `Signal` plus provenance for the UI. This is what makes every
number clickable.

| Field | Type | Notes |
| --- | --- | --- |
| ...`Signal` | | `connector`, `metric`, `text`, `value?`, `url?` |
| `feature` | string? | which feature it supports |
| `quote` | string? | short detail or quote |
| `weight` | number? | quality weight applied (CVALUE / authority) |
| `at` | ISO string? | timestamp, drives the trajectory replay |

### RedFlag

| Field | Type | Notes |
| --- | --- | --- |
| `text` | string | the flag |
| `note` | string | context, e.g. "Expected at pre-seed, not disqualifying" |
| `severity` | `low` \| `medium` \| `high` | feeds `redFlagGate` |
| `source`, `url` | optional | provenance |

### TrajectoryPoint

A point on the trajectory replay (commit cadence, ships, Wayback snapshots).

| Field | Type | Notes |
| --- | --- | --- |
| `date` | 'YYYY-MM' or ISO | |
| `value` | number 0..100 | activity magnitude |
| `label` | string? | |
| `kind` | `commit` \| `ship` \| `snapshot` \| `press` \| `milestone` | |
| `url` | string? | |

### SkillVector and TeamAnalysis

`SkillVector` is four axes each 0..1: `technical`, `commercial`, `domain`, `product`.
`TeamAnalysis` combines them across a venture's founders.

| TeamAnalysis field | Type | Notes |
| --- | --- | --- |
| `coverage` | `SkillVector` | combined (max per axis) |
| `bonus` | number 0..12 | added to the venture composite, never negative |
| `gaps` | string[] | thin axes |
| `redundancies` | string[] | overlapping strengths |
| `sharedHistory` | string[] | prior shared work |
| `perFounder` | array | each founder's `SkillVector` |

### Fmf and VentureDecision

`Fmf` is `{ similarity: 0..1, rationale, receipts }`, the semantic problem-versus-footprint fit.
`VentureDecision` is `{ band, composite, confidence, rationale, routeToHuman, decidedAt? }`, the
venture-level decision aggregated from its founders.

### Thesis

A sourcing thesis (Loop A): `{ id, label, description, keywords[], active }`. The shipped
snapshot has three, with "Technical AI and fintech founders, DACH" active.

### AnchorFounder

A member of the calibration set (not linked to the live graph, a fixed reference population).
`{ name, display?, outcome: success | mixed | failed, proof, gravity, trajectory, note }`. The
snapshot ships 56: 35 success, 13 mixed, 8 failed, of which 18 are labelled archetypes
("an early finance-ML founder") for natural neighbour phrasing.

### Streaming contracts

`EvalEvent` (in `model.ts`) is the designed Loop B streaming union: `trace` (a `TraceStep`
with kinds `plan`, `fetch`, `extract`, `reduce`, `gate`, `calibrate`, `done`), `phase`,
`connector`, `signal`, `metric`, `final`, `done`, `error`. `EvaluationEvent` (in
`connectors/types.ts`) is the narrower contract the current `/api/evaluate` emits for the Proof
phase. Both are shared by the backend and the Evaluation page so they stay in lockstep.

## Relationships

- A `Founder` belongs to exactly one `Venture` via `ventureId`; a `Venture` lists its founders
  in `founderIds` (a solo venture has one).
- A `Founder` has zero or one `FounderScore`; the score has exactly three `MetricScore`s, each
  with many `Feature`s, each with many `Receipt`s.
- A `Venture` has zero or one `VentureDecision` and zero or one `TeamAnalysis`, both aggregated
  from its founders.
- `AnchorFounder`s are a standalone population; percentiles and the neighbour are computed
  against them and are not foreign-keyed to live founders.
- A `Founder` is surfaced by one `Thesis` via `thesisId`.

## The Supabase activation schema

This is the designed persistence and Loop A layer, documented for the short activation path in
`SETUP.md`. It is not yet applied; the committed snapshot in `seed.ts` is the primary runtime
source and `DataService` is the swap seam. When activated, the relational model maps to these
tables, with `pgvector` for the embedding similarity that powers founder-market-fit and anchor
neighbour search.

```sql
create extension if not exists vector;

-- Loop A discovery theses
create table theses (
  id text primary key,
  label text not null,
  description text,
  keywords text[] not null default '{}',
  active boolean not null default false
);

-- light grouping object
create table ventures (
  id text primary key,
  name text not null,
  monogram text,
  tagline text,
  problem text not null,          -- used for FMF + team complementarity
  stage text, industry text, location text,
  founded_year int, website text
);

-- first-class scored entity
create table founders (
  id text primary key,
  name text not null,
  initials text, headline text, location text,
  handles jsonb not null default '{}',   -- github, x, linkedin, npm, pypi, website, scholar
  venture_id text references ventures(id),
  thesis_id text references theses(id),
  discovered_at timestamptz not null default now(),
  triage int,                            -- Loop A cheap score
  status text not null default 'discovered',
  pipeline text,
  evidence_count int not null default 0,
  note text
);

-- Loop A candidate queue (sourcing output before evaluation)
create table candidate_queue (
  id bigserial primary key,
  founder_id text references founders(id),
  thesis_id text references theses(id),
  triage int not null,
  status text not null default 'queued', -- queued | promoted | rejected
  discovered_at timestamptz not null default now()
);

-- one row per evaluated founder (Loop B output), scores + gate + calibration
create table scores (
  founder_id text primary key references founders(id),
  proof jsonb not null,                  -- MetricScore
  gravity jsonb not null,                -- MetricScore
  trajectory jsonb not null,             -- MetricScore
  composite int not null,
  raw_composite int not null,
  percentile int not null,
  band text not null,                    -- Invest | Watch | Pass
  confidence text not null,              -- high | medium | low
  capped boolean not null default false,
  cap_reason text,
  anchor_neighbor text,
  skills jsonb not null,                 -- SkillVector
  evaluated_at timestamptz not null default now()
);

-- atomic evidence receipts, the clickable trail behind every number
create table evidence (
  id bigserial primary key,
  founder_id text references founders(id),
  metric text not null,                  -- Proof | Gravity | Trajectory
  feature text,
  connector text not null,               -- ConnectorId
  text text not null,
  quote text,
  value numeric,
  weight numeric,                        -- CVALUE / network authority
  url text,
  at timestamptz
);

-- calibration reference set, with an embedding for neighbour search
create table anchors (
  name text primary key,
  display text,
  outcome text not null,                 -- success | mixed | failed
  proof int not null, gravity int not null, trajectory int not null,
  note text,
  embedding vector(1536)                 -- optional, for semantic neighbour search
);

-- founder-market-fit vectors: problem vs footprint embeddings
create table fmf_vectors (
  founder_id text primary key references founders(id),
  problem_embedding vector(1536) not null,   -- venture.problem
  footprint_embedding vector(1536) not null, -- repos + papers + bio
  similarity numeric not null,               -- cosine(problem, footprint)
  rationale text
);
create index on fmf_vectors using ivfflat (footprint_embedding vector_cosine_ops);
create index on anchors     using ivfflat (embedding vector_cosine_ops);
```

Notes on the mapping:

- `founders`, `ventures`, `theses` are the relational core; `handles`, and the three
  `MetricScore`s in `scores`, are stored as `jsonb` so the isomorphic TypeScript shapes round-
  trip without a translation layer.
- `evidence` is the normalized form of every `Receipt`, so "clickable to source" is a join,
  not a denormalized blob.
- `candidate_queue` is Loop A's output: discovery writes here, triage filters, and promotion
  moves a founder into evaluation.
- `anchors.embedding` and `fmf_vectors` use `pgvector` so founder-market-fit and the "sits next
  to X" neighbour can be semantic nearest-neighbour queries at scale, matching the precomputed
  `Fmf.similarity` the snapshot ships today.

Activation swaps `DataService` from reading `seed.ts` to reading an `/api` reader over these
tables. Because every page consumes `DataService` signals, no page component changes. See
`DECISIONS.md` ADR-004 and `SETUP.md`.
