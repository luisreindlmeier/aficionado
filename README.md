<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/aficionado-mark-inverse.svg">
    <img src="public/brand/aficionado-mark.svg" alt="aficionado" width="72">
  </picture>
  <h1>aficionado</h1>
  <p>Ein KI-Betriebssystem fuer Venture Capital.</p>
</div>

---

aficionado sourct sehr fruehe Gruender aus oeffentlichen Daten, bewertet den
Gruender statt den Pitch und streamt ein belegbares Verdict (Invest / Watch /
Pass), bei dem jede Zahl bis zur Quelle anklickbar ist. Die Agenten sammeln die
Evidenz, deterministische Mathematik faellt die Entscheidung, jedes Verdict ist
reproduzierbar.

## Stack

- **Angular 22** standalone SPA, Signals, zoneless.
- **Tailwind CSS v4** mit semantischen Tokens.
- **Mastra** (`@mastra/core`) Orchestrierung: Connectoren als Tools, drei
  Metrik-Agenten plus Red-Flag-Kritiker, OpenAI mit deterministischem Fallback.
- **Vercel Functions** (Node 22, ESM) fuer das `/api`-Backend.
- **Supabase** (Postgres, RLS, pgvector) fuer Queue und Dossier-Cache, optional.

## Schnellstart

Voraussetzung: Node 22.x (`.nvmrc` pinnt `22.23.0`) und pnpm.

```bash
nvm use
pnpm install
pnpm start        # SPA auf dem Daten-Snapshot, ohne Keys, http://localhost:4200
pnpm build        # Angular-Build inkl. Typecheck -> dist/aficionado/browser
```

Ohne Keys laeuft die App vollstaendig auf dem committeten Real-Data-Snapshot.

## Struktur

`src/app` Angular-SPA und Scoring-Core, `api/` Vercel-Functions, `eval/`
Kalibrierung, `supabase/` Schema, `scripts/` Sourcing-Jobs, `docs/` Details.
Mehr in `ARCHITECTURE.md`, `docs/SCORING.md` und `SETUP.md`.
