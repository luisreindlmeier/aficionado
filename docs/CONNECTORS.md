# Connectors

A connector is the core abstraction of Aficionado. One connector is three things at once: a
data adapter, an LLM tool, and a UI tile. A single registry drives all three, so a data source
is described in exactly one place and shows up everywhere it should.

- Registry (isomorphic, drives UI + backend): `src/app/core/connectors/descriptors.ts`
- Contract types (isomorphic): `src/app/core/connectors/types.ts`
- Runtime adapters (server-only): `api/_lib/connectors/*`, registered in
  `api/_lib/connectors/index.ts`

## The contract

### Descriptor, the declarative half

Every source is a `ConnectorDescriptor`. It has no Node or browser dependencies, so the same
object is read by the Angular UI, the serverless backend, and a future MCP surface.

```ts
interface ConnectorDescriptor {
  id: ConnectorId;          // 'github' | 'npm' | 'pypi' | ...
  name: string;             // UI label
  domain: string;           // source domain
  description: string;      // human text, and the LLM tool description
  icon: string;             // ng-icon name (UI only)
  color?: string;           // brand colour (UI only)
  group: 'Connected' | 'Available' | 'Manual input' | 'Not supported';
  auth: 'none' | 'key' | 'manual' | 'unsupported';
  metrics: Metric[];        // which metrics this feeds: Proof | Gravity | Trajectory
  note: string;             // honest status line shown in the UI
  action: 'connected' | 'connect' | 'add-key' | 'paste' | 'unsupported';
  live: boolean;            // true once a real backend run() exists
}
```

### Runtime, the imperative half

A live connector adds a `run()` that takes a `FounderQuery` and returns normalized signals. It
lives under `api/_lib/connectors/` and is server-only (it may read secrets and must never be
imported by client code).

```ts
type RunFn = (query: FounderQuery) => Promise<ConnectorResult>;

interface FounderQuery {
  name: string;
  github?: string; npm?: string; pypi?: string;
  x?: string; linkedin?: string; domain?: string;
  keywords?: readonly string[];   // e.g. 'ph:<username>' selects a Product Hunt maker
}

interface ConnectorResult {
  signals: readonly Signal[];
  note?: string;                  // status when there are no signals, never throws for "not found"
}

interface Signal {               // the normalized evidence unit
  connector: ConnectorId;
  metric: Metric;
  text: string;                  // human-readable evidence line
  value?: number;                // raw magnitude (stars, downloads, followers, ...)
  url?: string;                  // source link, becomes the clickable receipt
}
```

A `Signal` is promoted to a `Receipt` (in `core/model.ts`) for the UI by adding `feature`,
`quote`, `weight`, and `at`. That is how "every number is clickable to its source" works: the
score keeps the receipts that produced it.

## One connector, three roles

```
                      ConnectorDescriptor (one object)
                                 |
          +----------------------+----------------------+
          v                      v                      v
     UI TILE                LLM TOOL               DATA ADAPTER
   Data Sources page     evaluation agent        api/_lib/connectors
   renders from          projects descriptor      run(query) -> signals
   CONNECTORS,           into an AI SDK tool       registered in RUNNERS,
   grouped by `group`,   (name = id,               listed in PROOF_CONNECTORS
   button from `action`  description = description, streamed as SSE
                         input schema from
                         FounderQuery,
                         gated by `metrics[]`)
```

- **UI tile.** The Data Sources page reads `CONNECTORS` directly, groups by `group`, and picks
  the button from `action` (connected, connect, add-key, paste, unsupported). Colour and icon
  are descriptor fields.
- **Data adapter.** `api/_lib/connectors/index.ts` maps each `ConnectorId` to its `run()` in
  `RUNNERS`, and `PROOF_CONNECTORS` lists the ids the evaluation fans out for the Proof phase.
  The endpoint runs them with `Promise.all` and streams each `Signal` as it lands.
- **LLM tool.** Because the descriptor already carries a `description`, a `metrics[]` gate, and
  the shared `FounderQuery` input shape, it projects cleanly into an AI SDK tool definition.
  This is the explicit intent of the isomorphic contract: "a later MCP surface can reuse the
  exact same descriptors and tool shapes." The current backend uses the equivalent, more
  deterministic pattern of running connectors as a pre-fetch fan-out and feeding the collected
  signals to the model, which produces the same evidence with reproducible ordering.

## Selection tiers, green / amber / red

Sources are triaged before they are built (see `DECISIONS.md` ADR-005). The tier maps onto the
registry's real `group`, `auth`, and `live` fields.

- **Green.** Free and terms-clean. Build first. High signal for builder-heavy pre-seed
  founders, whose public proof is mostly code, packages, and research.
- **Amber.** Keyed, paid, or constrained by terms. Add deliberately, represent honestly.
- **Red.** Legally or practically unusable for this product. Skip, but show the status.

## The full source table

| Source | Tier | Metrics | Auth | Group | Live | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| GitHub | Green | Proof, Trajectory | none | Connected | yes | Richest builder signal: repos, stars, followers, contribution history. Optional token raises the rate limit. |
| npm downloads | Green | Proof | none | Connected | yes | Real adoption of published packages (downloads last month). Free, no auth. |
| PyPI | Green | Proof | none | Connected | yes | Python package adoption via download volume. Free, no auth. |
| arXiv | Green | Proof | none | Connected | yes | Research authorship and depth. Free Atom API, no auth. |
| Product Hunt | Green | Proof, Trajectory | key (free) | Connected | yes | Launches and upvotes, a clean shipping and momentum signal. Free developer token. |
| Wayback Machine | Green | Trajectory | none | Connected | no | Time machine for a founder's past sites, powers trajectory replay. Free Internet Archive. Adapter pending. |
| Semantic Scholar | Green | Proof | none | Connected | no | Citations and academic influence with a clean API. Free. Adapter pending. |
| Stack Exchange | Green | Proof | none | Connected | no | Answers, reputation, demonstrated expertise. Free, optional key. Adapter pending. |
| Devpost | Green | Proof | none | Available | no | Hackathon projects and wins, strong for very-early builders. Scrape or RSS. Adapter pending. |
| X (Twitter) | Amber | Gravity, Trajectory | key | Available | no | Reach, amplification, network signal. Official API is priced out of range; a low-cost third-party API covers it. |
| Handelsregister | Amber | Proof | key | Available | no | German company filings and officers, useful in the DACH thesis. Third-party API, free tier. |
| Google Patents | Amber | Proof | key | Available | no | Patent filings and inventorship. Via BigQuery free tier. |
| LinkedIn | Amber | Proof, Gravity | manual | Manual input | no | Career history and professional network. Paste only, no scraping, per ToS. The user brings data they are entitled to. |
| Crunchbase | Red | none | unsupported | Not supported | no | Enterprise license only, and company-centric rather than founder-centric. Shown as not supported. |
| Google Scholar | Red | (not a connector) | unsupported | (omitted) | no | No compliant API and aggressive anti-automation. Deliberately replaced by Semantic Scholar and arXiv. |
| Evertrace | Red | none | unsupported | Not supported | no | Sales-gated founder-detection product. Shown as not supported. |

Five connectors are live today (`RUNNERS`): GitHub, npm, PyPI, arXiv, and Product Hunt. The
green sources marked "adapter pending" are already described and grouped in the UI; they need a
`run()` and a `live: true` flip to go live, no new abstraction.

## Live adapter behaviour

Each live adapter reads only its part of the `FounderQuery`, hits a public API, normalizes the
result into `Signal`s, and degrades gracefully.

| Connector | Endpoint(s) | Reads from query | Emits |
| --- | --- | --- | --- |
| `github` | `api.github.com/users/{login}`, `/users/{login}/repos` | `github` | repo count + followers, total stars across owned repos, top repo |
| `npm` | `registry.npmjs.org/-/v1/search`, `api.npmjs.org/downloads/point/last-month` | `npm` | packages published, downloads last month |
| `pypi` | `pypistats.org/api/packages/{pkg}/recent` | `pypi` | downloads last month for the package |
| `arxiv` | `export.arxiv.org/api/query` | `name` | paper count as author, most recent title |
| `producthunt` | `api.producthunt.com/v2/api/graphql` | `keywords` (`ph:<user>`) | launches + total upvotes, top launch (needs `PRODUCT_HUNT_TOKEN`) |

Graceful degradation is a contract, not an afterthought. A missing handle or a 404 returns
`{ signals: [], note: '...' }` so the fan-out continues and the UI shows why a source was
empty. Only a genuine transport failure throws, and the orchestrator catches it per-connector
and emits a `connector` error event, leaving the other connectors and the final score intact.

## How to add a new source

Three steps, and the source becomes both AI-callable and visible in the UI:

1. **Describe it.** Add a `ConnectorDescriptor` to `CONNECTORS` in `descriptors.ts`. Pick the
   `metrics[]` it feeds, its `group`, `auth`, `action`, and an honest `note`. Set
   `live: false` for now. It appears on the Data Sources page immediately.
2. **Implement `run()`.** Add `api/_lib/connectors/<id>.ts` exporting a
   `run(query: FounderQuery): Promise<ConnectorResult>`. Read only the query fields you need,
   call the source, map the response to `Signal`s with a `url` on each so it becomes a
   clickable receipt, and return `{ signals: [], note }` for the not-found case instead of
   throwing.
3. **Register it.** Add the id to `RUNNERS` in `api/_lib/connectors/index.ts`, add it to
   `PROOF_CONNECTORS` (or the relevant metric list) if it should run in that phase, and flip
   the descriptor to `live: true`.

Because the descriptor is the single source of truth, there is nothing else to wire: the UI
tile, the agent tool projection, and the backend adapter all follow from the same object.
