# Decisions

Architecture decision records for Aficionado. Each records the context, the decision, the
alternatives we rejected and why, and the consequences we accept. The rejected alternatives
matter as much as the choices: they show the design space was actually explored.

Index:

- ADR-001 Founder-first, not company-first
- ADR-002 Structured fan-out plus a deterministic reducer, not an agent swarm
- ADR-003 Keep Angular + Vercel Functions + AI Gateway, not Next.js + Mastra + Inngest
- ADR-004 Committed real-data snapshot primary, Supabase pre-staged
- ADR-005 Source selection, green free connectors first
- ADR-006 Confidence-driven exclusion and a red-flag gate that caps

---

## ADR-001 Founder-first, not company-first

### Context

The challenge is a 100k pre-seed decision, and the Maschmeyer thesis is explicit: "there are
only good founders, not good companies." At pre-seed there is usually no revenue, no retention
curve, no defensible moat, and often no product. A company-centric data model (the unit is a
startup, founders are attributes) fits later-stage diligence where company metrics exist. It
does not fit the stage we are underwriting, where the company is barely more than a name and
the only durable signal is the person.

### Decision

The `Founder` is the first-class, scored entity and the thing you click into. The `Venture` is
a light grouping object that links founders and holds the problem statement, used only for
founder-market-fit and team complementarity. The evaluation object is the founder; the
decision object is the venture (`VentureDecision`, aggregated from its founders). Company data
is context on the founder, never the primary unit. This is enforced in `core/model.ts`.

### Alternatives considered

- **Company-first (rejected).** Unit is the venture, founders hang off it. Rejected because at
  pre-seed the venture object is nearly empty, so the score would be built on the thinnest
  data available while ignoring the richest (the founder's public track record). It also
  quietly re-anchors the whole product on "company quality", which is the exact thesis
  Maschmeyer rejects.
- **Team-as-unit (rejected).** Score the team as an indivisible blob. Rejected because it
  cannot express a solo founder cleanly, it hides which specific founder carries the proof,
  and it makes evidence receipts ambiguous ("whose commit is this"). We instead score each
  founder and add a team bonus on top.

### Consequences

- Founder-market-fit and per-founder skill vectors become natural, because the founder is the
  unit and the venture supplies the problem to fit against.
- The team bonus is additive and never a solo penalty (`teamBonus` returns 0 for one founder).
- Aggregating a venture-level decision from multiple founders is our job, not the model's
  default, which is a small amount of extra logic we accept in exchange for correctness at the
  stage that matters.

---

## ADR-002 Structured fan-out plus a deterministic reducer, not an agent swarm

### Context

"AI-first VC brain" invites a maximalist reading: a crowd of autonomous agents that debate,
critique, and negotiate a verdict. That is expensive, slow, hard to reproduce, and hard to
show an investor, because the same founder can get two different numbers on two runs. But the
evaluation decomposition is not open-ended. It is known in advance and fixed: exactly three
metrics, each backed by a known set of connectors.

### Decision

Decompose along the known structure. An orchestrator fans out to three metric workers in
parallel (a plain `Promise.all`), each worker does the genuinely open-ended part (read messy
public evidence, extract clean `Feature`s with an LLM, pull evidence through connectors as
tools), and then a single **deterministic reducer** in `core/scoring.ts` does the part that
must be trustworthy: turn features into a gated, calibrated score with pure math. The LLM
judges and extracts; it never does the final arithmetic.

### Alternatives considered

- **Free-roaming multi-agent swarm (rejected).** Agents negotiate the score among themselves.
  Rejected on cost, reproducibility, and demonstrability. It echoes the Princeton-style
  finding that a single well-structured agent matches multi-agent systems on quality at
  roughly half the token cost: when the task decomposition is known, orchestration structure
  beats emergent negotiation. A swarm also cannot promise the same founder the same number
  twice, which is disqualifying for an investment tool.
- **One monolithic prompt (rejected).** Feed all evidence to one model and ask for a verdict.
  Rejected because it loses the per-metric streaming trace (the brain-at-work UI), makes the
  math opaque and non-reproducible, and cannot exclude a single low-confidence metric cleanly.
- **A workflow engine for orchestration (rejected here, see ADR-003).** Overkill for a
  three-way parallel fan-out that `Promise.all` expresses in one line.

### Consequences

- The reducer is a pure, isomorphic module reused verbatim by the seed generator, the live UI
  re-rank, and the backend. A number is reproducible by construction.
- Adding a metric or a connector is a structured change (add a worker or a descriptor), not a
  prompt-tuning exercise.
- We give up emergent, surprising agent behaviour. For an auditable investment verdict that is
  a feature, not a loss.

---

## ADR-003 Keep Angular + Vercel Functions + AI Gateway, not Next.js + Mastra + Inngest

> Status: partially superseded by ADR-007. The AI-Gateway orchestration half of this
> decision was reversed: the agents and both loops now run on Mastra durable workflows.
> The Angular + Vercel Functions half still holds (the frontend and hosting are unchanged).

### Context

The brief sketched a stack of Next.js + Mastra (agent framework) + Inngest (durable workflow
engine). The actual repository is an Angular 22 zoneless SPA with a Vercel Functions backend
and a connector registry already in place. A naive reading of the brief would rewrite the app
to match the suggested stack. We had roughly 24 hours.

### Decision

Keep the existing stack and extend it. Angular 22 (standalone, signals, zoneless) for the SPA,
Vercel Functions in `/api` for the backend, and the Vercel AI Gateway for provider-agnostic
model access with a heuristic fallback. The connector registry already embodies the brief's
core abstraction (one source of truth driving both UI and agent tools), so the highest-value
move is to build on it, not to re-platform to reach the same abstraction from scratch.

### Alternatives considered

- **Rewrite to Next.js + Mastra + Inngest (rejected).** Rejected on ship-ability and risk. A
  re-platform spends the entire budget reaching feature parity with what already runs, with
  nothing left for the actual product (scoring, calibration, the self-demo). The stacks are
  substitutable for our needs: Vercel Functions give the serverless runtime, the AI Gateway
  gives provider-agnostic model access and failover, and durability comes from idempotent
  serverless plus a committed snapshot rather than a workflow engine.
- **Add Mastra for agents on top of Angular (rejected).** The fan-out is `Promise.all` over
  three workers; an agent framework adds a dependency and a mental model without removing a
  line of the work we actually have.
- **Add Inngest for durability (rejected for now).** Our evaluation is a bounded, single-shot
  fan-out with a 60-second function budget, made idempotent by pure connectors and a pure
  reducer. Durable multi-step orchestration is worth revisiting only when Loop A runs at scale.

### Consequences

- We shipped product in the time available instead of shipping a migration.
- The AI Gateway keeps us provider-agnostic (`anthropic/claude-sonnet-5` today, swappable via
  the gateway) and lets the whole thing run with no key at all via the heuristic fallback.
- We diverge from the brief's suggested stack on purpose, documented here so the divergence
  reads as a decision, not an oversight.

---

## ADR-004 Committed real-data snapshot primary, Supabase pre-staged

### Context

The product wants a database (Supabase + pgvector) for persistence, embeddings, and Loop A at
scale. Two constraints collided: the org is at the two-active free-project limit (creating a
new project needs a human to pause an unrelated one), and a live demo must be reliable and
zero-dependency, not one cold database or rate limit away from failing on stage.

### Decision

Make a committed real-data snapshot the primary path and pre-stage Supabase as a fast
activation. `src/app/core/data/seed.ts` holds real founders and ventures, its numeric receipts
(stars, followers, repos, dates, downloads) fetched from live public APIs; qualitative
judgements are authored and labelled as such. `DataService` reads the snapshot and is the seam
behind which a Supabase-backed reader can be dropped in without touching any page.

### Alternatives considered

- **Supabase as the live primary path (rejected for the demo).** Blocked by the free-project
  limit and riskier on stage (cold starts, rate limits, network). Reintroduced later as the
  activation target, not the demo dependency.
- **Mock or synthetic data (rejected).** Faster to produce but it would undercut the entire
  premise. The product's credibility is that every number traces to a real public source, so
  the demo data has to be real too.
- **No database at all, ever (rejected).** Fine for the demo, insufficient for Loop A at scale
  and for pgvector founder-market-fit search. Hence pre-staged rather than abandoned.

### Consequences

- The app runs with zero runtime dependencies and is deterministic, which is ideal for a demo
  and for local development.
- Supabase activation is a short, documented step (apply the schema, point `DataService` at an
  `/api` reader), not a rebuild.
- We carry a generator step: the snapshot is regenerated from live APIs rather than hand-
  edited, so the "real numbers" claim stays true.

---

## ADR-005 Source selection, green free connectors first

### Context

There is a long tail of possible data sources, and they differ wildly in cost, terms of
service, and reliability. Chasing all of them burns the budget and risks building on a source
that is legally or practically unusable. We needed a triage rule.

### Decision

Rank sources green / amber / red and build green first. The registry in
`core/connectors/descriptors.ts` encodes this with `group`, `auth`, and `live`.

- **Green, free, build first (live today where marked):** GitHub, npm downloads, PyPI, arXiv
  (all zero-key and live), Product Hunt (free developer token, live), plus Wayback Machine and
  Semantic Scholar (free, described, adapters pending). Devpost and Stack Exchange are also
  free and green.
- **Amber, keyed or constrained, add deliberately:** X via a low-cost third-party API,
  LinkedIn as manual paste only (per ToS, no scraping), Handelsregister via a free-tier
  third-party API, Google Patents via BigQuery's free tier.
- **Red, skip:** Crunchbase (enterprise license only) and Google Scholar (no compliant API,
  aggressive anti-automation). Evertrace is sales-gated and skipped likewise.

### Alternatives considered

- **Crunchbase-first (rejected).** It is the obvious VC data source, but the license is
  enterprise-only and it centres companies, not founders. Marked "Not supported" honestly.
- **Scrape LinkedIn and Google Scholar (rejected).** Both prohibit it and both fight it. We
  represent LinkedIn as a manual paste (the user brings the data they are entitled to) and
  skip Scholar in favour of Semantic Scholar and arXiv, which have clean APIs.
- **X via the official API (rejected on cost).** Priced for this use case at a level that does
  not fit a pre-seed tool; a third-party API covers reach and amplification at low cost, hence
  amber not green.

### Consequences

- The live core runs on free, terms-clean, high-signal sources, which is exactly right for
  builder-heavy pre-seed founders (their public proof is mostly code and packages).
- The UI shows every amber and red source with an honest status line rather than hiding them,
  so the product never overstates its coverage.
- Some Gravity signal is gated behind amber sources, which is the honest reason the self-demo
  founder lands at low-confidence Gravity rather than a fake number.

---

## ADR-006 Confidence-driven exclusion and a red-flag gate that caps

### Context

Two different failure modes corrupt a naive weighted average. First, a metric with almost no
evidence still contributes its (near-zero) score, dragging down a genuinely strong founder,
especially under a preset that weights that metric heavily. Second, an integrity or coherence
problem (overclaiming, fabricated metrics, feedback-resistance) is not a "somewhat lower
score"; a founder with a fatal flag is categorically capped no matter how brilliant the rest
of the profile looks.

### Decision

Two distinct mechanisms in `core/scoring.ts`.

- **Confidence-driven exclusion.** Confidence = completeness x agreement, bucketed by
  `confidenceOf`. `confidentComposite` drops any low-confidence metric and redistributes its
  weight across the trusted metrics, rather than emitting a number we do not believe.
  `overallConfidence` knocks the reported confidence down a level whenever a metric was
  excluded. `bandOf` refuses to emit Invest on low confidence, and `routeToHuman` fires on low
  confidence or fewer than three pieces of evidence.
- **Red-flag gate that caps.** `redFlagGate` computes a cap from flag severity (one high-
  severity flag caps at 55, each additional high knocks off 10; medium flags cap more gently
  from 78) and clamps the composite down to it. A cap is a ceiling, not a subtraction, so
  pitch can never outrun proof.

### Alternatives considered

- **Impute a value for thin metrics (rejected).** Filling in a guessed score fabricates
  certainty, which is the opposite of the product's promise. Exclusion plus a visible flag is
  honest.
- **Subtract points per red flag (rejected).** A linear penalty lets a high enough base score
  swamp a fatal flag, so a charismatic overclaimer could still score "Invest". Capping makes
  the ceiling explicit and lets the "sits next to X" line correctly point at cautionary
  anchors once a founder is capped.
- **Hard-fail on any red flag (rejected).** Too blunt for pre-seed, where low-severity flags
  (first-time founder, product in private pilot) are expected and should not tank a score. The
  gate distinguishes severities and only bites when it should.

### Consequences

- The self-demo works because of this: Luis's low-confidence Gravity is excluded and flagged,
  his composite is computed from Proof and Trajectory, and the verdict is the honest "Watch,
  provisional pending LinkedIn" instead of a Gravity-crushed Pass or a fabricated number.
- Anchors like Elizabeth Holmes and Adam Neumann sit where they should: high raw gravity,
  capped composite, neighboured against failed archetypes.
- The composite arithmetic is more involved than a plain weighted average, but every branch is
  pure, tested by construction against the anchor set, and identical across all three call
  sites.

## ADR-007 Move the whole orchestration onto Mastra durable workflows

### Context

ADR-003 kept model access on the Vercel AI Gateway to avoid re-platforming under a 24h clock.
With the demo working, the goal changed: make the orchestration a real, durable, observable
agent system on Mastra (the framework the brief sketched), without changing what the numbers say.

### Decision

Migrate both loops onto Mastra, incrementally, with the deterministic calibration eval as the
guard rail after every step:

- Connectors become Mastra tools (`api/_lib/tools.ts`) driven by the SAME descriptor registry as
  the Data-sources UI. One registry, two surfaces.
- Three metric agents (`proofAgent`, `gravityAgent`, `trajectoryAgent`), each carrying ONLY its
  metric's tools, replace the single scorer. A conservative red-flag `criticAgent` and a
  `discoveryAgent` round out the set. Every agent runs OpenAI `gpt-5.5` via one `MODEL` constant.
- Evaluation is a durable `createWorkflow`: ingest, then the three agents in parallel (fan-out),
  then a deterministic reducer, a critic gate and calibration. Each agent gathers its own signals
  agentically by calling its tools; the tool activity streams into the brain-at-work UI and every
  agent + tool span exports to the Mastra Platform dashboard.
- Sourcing (Loop A) is a scheduled `createWorkflow` (discover, discovery-agent rank, persist),
  on a daily Vercel cron.
- The calibration set is also exposed as a Mastra scorer (`createScorer`, `pnpm eval`).

Two invariants were fixed up front: the deterministic scoring math (`confidentComposite`,
`redFlagGate`, `bandOf`, `percentileOf`) stays byte-identical, and the calibration eval stays
green (Luis / gedonus = 62). The Vercel AI Gateway path is removed.

### Alternatives considered

- Let each agent emit its metric subscore directly (as the brief's schema suggested). Rejected:
  it would bypass the deterministic `blend` + calibration, changing the numbers. The agents
  extract features; the shared math turns features into scores.
- Change the weights to 40/40/20 (as one plan draft said). Rejected: it moves every calibrated
  composite. Kept the shipped Maschmeyer 35/45/20.
- Keep signals code-fetched (fidelity-first) instead of agentic. Rejected in favour of real
  tool-calling so the traces and the "each tool call" streaming are genuine; the deterministic
  eval, not the live LLM pass, is the stability contract.

### Consequences

- The orchestration is now a durable, traced Mastra workflow system with real agentic tool use.
- Live per-metric numbers vary run-to-run (LLM-gathered evidence); this is expected and bounded
  by the deterministic eval, which never moved.
- The critic can cap a live score; it is prompted to stay conservative and returns no flags for
  normal early-stage founders, so the demo is not falsely capped.
- Open items (see HANDOFF): a real discovery source for net-new founders, Supabase creds for the
  sourcing write path, and registering the workflows for workflow-level span export.
