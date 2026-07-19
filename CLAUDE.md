# CLAUDE.md: aficionado (Web app)

Aficionado is an AI-native operating system for venture capital: very-early-stage founder
sourcing (Radar) → evaluation → decision → diligence, fully automated.

This repo is the **app shell** (sidebar, header, footer, project selector, ⌘K command
palette). Product features are not built yet.

## Conventions

- **Angular 22** standalone components, signals, zoneless. Static SPA (no SSR).
- **Tailwind CSS v4** with the semantic tokens defined in `src/styles.css`
  (`bg-background`, `text-muted-foreground`, `border-border`, `rounded-md`, `font-serif`, …).
- Sidebar navigation + page routes come from a single source of truth: `src/app/core/nav.ts`.
- Every page is currently a `PlaceholderPage`; add real feature components under
  `src/app/features/` and wire them in `src/app/app.routes.ts` when building them out.
- **Page width**: every page wraps its content in the standard container
  `mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10` (inside a
  `flex min-w-0 flex-1 flex-col overflow-y-auto` scroll region). Use the available
  width, don't squeeze content into a narrow column.
- **Titles/headings**: use the brand display font via the `.font-title` utility
  (Space Grotesk, `--font-brand`, from the logo kit) for every page title, section heading,
  and hero number. Divide page content into sections with `<app-section-heading title="…">`
  (`src/app/core/ui/section-heading.ts`), a `.font-title` title with a clean divider beneath.
  Never use the small uppercase eyebrow style (`.af-eyebrow`) for page section headings;
  that style is for sidebar/nav labels only.
- **Labels**: badges, pills, and tags are neutral, white background, foreground (black) text,
  thin border (`rounded-full border-[0.5px] border-border text-foreground`). Never fill a
  label with colour. Colour is reserved for data viz (e.g. donut rings) and tiny indicator dots.
- **Punctuation**: never use em dashes (`—`) or the middle-dot separator (`·`) anywhere,
  in UI copy, comments, docs, or commit messages. Use commas, colons, periods, or a plain
  slash (` / `) instead. This applies to all content generated in this repo.
- No unnecessary comments. Keep the shell minimal.

## Data connectors and AI evaluation

- Every data source is a **connector**. The single source of truth is
  `src/app/core/connectors/descriptors.ts` (`CONNECTORS`), which drives the Data
  sources page and the backend. `types.ts` is isomorphic (no Node/browser deps) so the
  UI, the backend, and a future MCP surface all share it. `live: true` means a real
  backend `run()` exists today.
- Backend lives in `/api` (Vercel Functions, Node). `POST /api/evaluate` runs the live
  Proof connectors, streams each `Signal` as SSE, then streams an AI verdict via the
  Vercel AI Gateway (`AI_GATEWAY_API_KEY`), with a deterministic heuristic fallback when
  no key is present. Connector runtimes are server-only under `api/_lib/connectors/`;
  never import them from client code (secrets, CORS).
- Add a source: add its descriptor, then a `run()` in `api/_lib/connectors/` and register
  it in `api/_lib/connectors/index.ts`. It becomes both AI-callable and visible in the UI.
- The Evaluation page triggers `EvaluationService.scoreProof()` and streams signals + the
  score into the dossier. There is no chat UI.
- Env is documented in `.env.example`. Typecheck the backend with
  `npx tsc -p api/tsconfig.json --noEmit`.

## Brand

- The logo is the graduated dot-matrix "A". Single source of truth in the app is
  `<app-logo>` (`src/app/core/brand/logo.ts`): the mark uses `currentColor`, with an
  optional wordmark. Never reintroduce placeholder icons/avatars for the brand.
- Wordmark font is **Space Grotesk 500** (`--font-brand` / `.brand-wordmark`); the mark is
  ink `#111` on light surfaces, white on dark.
- Static brand assets live in `public/`: `favicon.svg` + `favicon-16/32.png`,
  `apple-touch-icon.png`, `icon-192/512.png`, `og-image.png`, `site.webmanifest`, and the
  source marks under `public/brand/`.
