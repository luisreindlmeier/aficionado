<div align="center">
  <h1>Aficionado</h1>
</div>

<p align="center"><em>An AI-native OS for venture capital.</em></p>

---

Aficionado is the sourcing-to-diligence operating system for VCs: find founders at the
very earliest stage — before anyone else — then evaluate them, generate an investment
recommendation, and run diligence, end to end and fully automated.

This repository is the **app shell** — sidebar, header, footer, project selector, and a
⌘K command palette. No product features yet.

## Workflow (sidebar)

1. **Sourcing** — surface very-early-stage founders and startups first.
2. **Evaluation** — assess founders and teams.
3. **Recommendation** — produce an investment recommendation.
4. **Diligence** — automated due diligence.

## Stack

- **Angular 22** — standalone, signals, zoneless change detection
- **Static SPA** (client-rendered) — deployed on Vercel
- **Tailwind CSS v4**
- **angular-eslint** + **Prettier** · **TypeScript** (strict) · **Node 22.23** (`.nvmrc`) · **pnpm**

## Getting started

```bash
nvm use            # Node 22.x (.nvmrc)
pnpm install
pnpm start         # dev server → http://localhost:4200
```

## Scripts

| Command | Description |
| ------- | ----------- |
| `pnpm start` | Dev server with HMR |
| `pnpm run build` | Production build → `dist/aficionado/browser` |
| `pnpm run lint` | Lint (angular-eslint) |
| `pnpm run format` | Prettier |

## Structure

```
src/app/
├── core/       # app shell: layout (header, sidebar, footer, command palette), nav
└── features/   # feature pages (placeholder-only for now)
```
