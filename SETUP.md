# Setup

How to run Aficionado locally, how the free connectors work with zero keys, how to enable the
optional keys, how to deploy, and how to activate Supabase later. The app runs with no
configuration at all; every key below unlocks an extra capability rather than being required.

## Prerequisites

- **Node 22.x.** The repo pins `22.23.0` in `.nvmrc`, and `package.json` requires
  `>=22.22.3`.
- **pnpm.** The lockfile is `pnpm-lock.yaml` and `vercel.json` installs with
  `pnpm install --frozen-lockfile`.
- **Vercel CLI** (only if you want to run the `/api` backend locally): `npm i -g vercel`.

## Local, frontend only (zero config)

This is all you need to see the product. The SPA reads the committed real-data snapshot and
runs the full scoring engine client-side, no keys and no backend.

```bash
nvm use            # selects Node 22.23.0 from .nvmrc
pnpm install
pnpm start         # ng serve -> http://localhost:4200
```

You get the Radar feed, the founder dossiers, the anchor-calibrated scores, and the live
weight re-rank in Settings, all from `src/app/core/data/seed.ts`.

## Local, with the backend

The `/api` functions (the streaming `/api/evaluate` endpoint and the live connectors) are
Vercel Functions. Run them with the Vercel dev server, which serves the SPA and `/api` on one
origin so there are no CORS issues.

```bash
cp .env.example .env.local   # optional keys, see the table below
vercel dev                   # SPA + /api together
```

With no keys in `.env.local`, `/api/evaluate` still works: the live free connectors (GitHub,
npm, PyPI, arXiv) run, and the verdict falls back to the deterministic heuristic in
`api/_lib/proof.ts`. Add keys to unlock the AI verdict and Product Hunt.

## Environment variables

Every variable is optional. Copy `.env.example` to `.env.local` for `vercel dev`. On Vercel,
set them in Project Settings, Environment Variables.

| Variable | What it unlocks | Where to get it | Where it goes |
| --- | --- | --- | --- |
| `AI_GATEWAY_API_KEY` | The AI verdict in `/api/evaluate`. Without it the endpoint returns the deterministic heuristic score instead of an LLM judgement. On Vercel this is injected automatically for linked projects. | Vercel dashboard, AI Gateway, create a key: https://vercel.com/docs/ai-gateway | `.env.local` locally; Project Settings on Vercel. Read in `api/_lib/ai.ts`. |
| `GITHUB_TOKEN` | Raises the GitHub API rate limit from 60/hour (anonymous) to 5000/hour. The GitHub connector works without it. | GitHub, Settings, Developer settings, Personal access tokens, fine-grained, no scopes needed for public data: https://github.com/settings/tokens | `.env.local` or Vercel env. Read in `api/_lib/connectors/github.ts`. |
| `PRODUCT_HUNT_TOKEN` | Enables the Product Hunt connector (launches and upvotes). Without it the connector returns an empty result with a note. | Product Hunt, API dashboard, create an application, developer token: https://api.producthunt.com/v2/oauth/applications | `.env.local` or Vercel env. Read in `api/_lib/connectors/producthunt.ts`. |

The AI Gateway model string is provider-agnostic (`anthropic/claude-sonnet-5` today). Because
access goes through the gateway, switching provider or model is a one-line change and does not
require a new SDK or key type.

## How the free connectors work with zero keys

Four of the five live connectors need no credentials at all. They call public APIs directly
and normalise the response into `Signal`s:

| Connector | Endpoint | Auth |
| --- | --- | --- |
| GitHub | `api.github.com/users/{login}` and `/repos` | none (optional `GITHUB_TOKEN` for higher limits) |
| npm | `registry.npmjs.org` search + `api.npmjs.org/downloads` | none |
| PyPI | `pypistats.org/api/packages/{pkg}/recent` | none |
| arXiv | `export.arxiv.org/api/query` | none |
| Product Hunt | `api.producthunt.com/v2/api/graphql` | `PRODUCT_HUNT_TOKEN` (free) |

Each connector degrades gracefully. A missing handle or a 404 returns an empty
`ConnectorResult` with an explanatory `note`, never a thrown error that would break the
fan-out. This is why the pipeline always produces a result even on a sparse founder.

## Calling the evaluation endpoint

`POST /api/evaluate` streams Server-Sent Events. Example against a local `vercel dev`:

```bash
curl -N -X POST http://localhost:3000/api/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"name":"Luis Reindlmeier","github":"luisreindlmeier"}'
```

The body accepts `name`, `github`, `npm`, `pypi`, `x`, `linkedin`, `domain`, and `keywords`
(use `ph:<username>` in `keywords` to select a Product Hunt maker). The response streams
`connector` status events, `signal` events as evidence lands, and a final `verdict`, then
`done`.

## Deploy to Vercel

The project is configured for Vercel in `vercel.json`:

- `framework: angular`
- `installCommand: pnpm install --frozen-lockfile`
- `buildCommand: pnpm run build`
- `outputDirectory: dist/aficionado/browser`
- an SPA rewrite so every non-`/api` path serves `index.html`

Steps:

```bash
vercel link          # link the repo to a Vercel project (first time)
vercel               # deploy a preview
vercel --prod        # deploy to production
```

Set `AI_GATEWAY_API_KEY` (and optionally `GITHUB_TOKEN`, `PRODUCT_HUNT_TOKEN`) in the project
env before the production deploy if you want AI verdicts and Product Hunt live. The `/api`
functions deploy automatically from the `api/` directory; `api/evaluate.ts` sets
`maxDuration: 60` for the streaming run.

Per the repo workflow, commits to `main` auto-deploy to Vercel.

## Typecheck, lint, build

```bash
pnpm run build                          # production build, also typechecks the Angular app
npx tsc -p api/tsconfig.json --noEmit   # typecheck the /api serverless functions separately
pnpm run lint                           # angular-eslint
pnpm run format                         # prettier --write .
```

The `/api` code has its own `tsconfig.json` (NodeNext, strict) that also includes the shared
`core/connectors` and `core/metrics` sources, so the isomorphic contract is typechecked from
both sides.

## Activating Supabase later

Supabase + pgvector is the designed persistence and Loop A activation layer, documented in
`docs/DATA-MODEL.md`. It is not required to run and is not yet applied (the org sits at the
free-project active limit, see `DECISIONS.md` ADR-004). When you are ready to activate:

1. **Free a project slot.** The org is at the two-active free-project limit, so pause an
   unrelated project or upgrade, then create a new Supabase project.
2. **Enable pgvector.** In the SQL editor: `create extension if not exists vector;`
3. **Apply the schema.** Create the tables from `docs/DATA-MODEL.md` (founders, ventures,
   evidence, scores, candidate_queue, anchors with `vector` embedding columns, fmf_vectors).
4. **Seed it.** Load the anchor set and the snapshot founders so percentiles and the Radar
   have data on day one.
5. **Wire the reader.** Point `DataService` at an `/api`-backed reader instead of `seed.ts`.
   Because every page reads through `DataService` signals, no page component changes.
6. **Set env.** Add `SUPABASE_URL` and a service key to the Vercel project for the `/api`
   reader and the sourcing cron.
7. **Enable Loop A.** Add a cron entry to `vercel.json` pointing at a sourcing function that
   fills `candidate_queue`.

This is intended as a short activation, not a rebuild, because `DataService` was written as
the swap seam from the start.
