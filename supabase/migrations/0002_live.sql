-- Live evaluation + discovery layer. Replaces the committed seed as the source of
-- truth for the dashboard: evaluated dossiers are cached here, discovery writes
-- candidates here, and computed founder skills live here. Writes are server-only
-- (Vercel Functions with the service_role key, which bypasses RLS); the frontend
-- reads through /api, so no anon write policy is granted.

-- Evaluated founder dossiers (the live-eval cache). id = github login or slug.
create table if not exists public.cached_dossiers (
  id            text primary key,
  name          text not null,
  github        text,
  domain        text,
  headline      text,
  thesis_id     text,
  composite     int  not null,
  raw_composite int,
  band          text not null,
  percentile    int,
  confidence    text,
  capped        boolean default false,
  cap_reason    text,
  proof         jsonb,
  gravity       jsonb,
  trajectory    jsonb,
  team          jsonb,           -- [{ name, skills:{technical,commercial,domain,product} }]
  team_score    jsonb,           -- harmonizedTeamScore output when a team exists
  evaluated_at  timestamptz not null default now()
);
create index if not exists cached_dossiers_composite_idx on public.cached_dossiers (composite desc);
create index if not exists cached_dossiers_thesis_idx on public.cached_dossiers (thesis_id);

-- Discovery queue: net-new founders surfaced by the discovery agent + github search.
create table if not exists public.sourcing_candidates (
  id            text primary key,   -- github login
  name          text not null,
  github        text,
  domain        text,
  headline      text,
  followers     int default 0,
  top_repo      text,
  top_stars     int default 0,
  thesis_id     text,
  triage        int default 0,
  reason        text,
  evaluated     boolean default false,
  discovered_at timestamptz not null default now(),
  refreshed_at  timestamptz not null default now()
);
create index if not exists sourcing_candidates_triage_idx on public.sourcing_candidates (triage desc);
create index if not exists sourcing_candidates_evaluated_idx on public.sourcing_candidates (evaluated);

-- Row Level Security: lock everything down. Only the service_role (server) writes;
-- the frontend reads via /api, never with a public key, so no public policy is added.
alter table public.cached_dossiers enable row level security;
alter table public.sourcing_candidates enable row level security;
