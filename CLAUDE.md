# CLAUDE.md — aficionado (Web app)

Aficionado is an AI-native operating system for venture capital: very-early-stage founder
sourcing → founder evaluation → investment recommendation → due diligence, fully automated.

This repo is the **app shell** (sidebar, header, footer, project selector, ⌘K command
palette). Product features are not built yet.

## Conventions

- **Angular 22** standalone components, signals, zoneless. Static SPA (no SSR).
- **Tailwind CSS v4** with the semantic tokens defined in `src/styles.css`
  (`bg-background`, `text-muted-foreground`, `border-border`, `rounded-md`, `font-serif`, …).
- Sidebar navigation + page routes come from a single source of truth: `src/app/core/nav.ts`.
- Every page is currently a `PlaceholderPage`; add real feature components under
  `src/app/features/` and wire them in `src/app/app.routes.ts` when building them out.
- No unnecessary comments. Keep the shell minimal.
