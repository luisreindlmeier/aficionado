-- aficionado schema: founder-first VC operating system.
-- Pre-staged and runnable. Apply with the Supabase CLI or the SQL editor once a
-- project exists (see supabase/README.md). Nothing here runs automatically; the
-- app ships against the committed seed snapshot until these keys are set.

create extension if not exists vector;

-- Sourcing theses (Loop A) --------------------------------------------------
create table if not exists theses (
  id          text primary key,
  label       text not null,
  description text not null,
  keywords    text[] not null default '{}',
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Ventures: light grouping objects that hold the problem context -------------
create table if not exists ventures (
  id           text primary key,
  name         text not null,
  monogram     text,
  tagline      text,
  problem      text,
  stage        text,
  industry     text,
  location     text,
  founded_year int,
  website      text,
  decision     jsonb,          -- { band, composite, confidence, rationale, routeToHuman }
  team         jsonb,          -- TeamAnalysis (skill coverage, gaps, shared history)
  created_at   timestamptz not null default now()
);

-- Founders: the first-class scored entity -----------------------------------
create table if not exists founders (
  id             text primary key,
  name           text not null,
  initials       text,
  headline       text,
  location       text,
  handles        jsonb not null default '{}',   -- { github, x, linkedin, npm, pypi, website }
  venture_id     text references ventures(id) on delete set null,
  thesis_id      text references theses(id) on delete set null,
  triage         int not null default 0,
  status         text not null default 'discovered',  -- discovered | watching | evaluating | decided
  pipeline       text,                                -- Watch | Evaluating | Decided
  discovered_at  timestamptz not null default now(),
  evidence_count int not null default 0,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists founders_thesis_idx on founders(thesis_id);
create index if not exists founders_status_idx on founders(status);
create index if not exists founders_discovered_idx on founders(discovered_at desc);

-- Scores: one row per evaluation run; the latest is the current dossier ------
create table if not exists scores (
  id            uuid primary key default gen_random_uuid(),
  founder_id    text not null references founders(id) on delete cascade,
  composite     int not null,
  raw_composite int not null,
  percentile    int not null,
  band          text not null,          -- Invest | Watch | Pass
  confidence    text not null,          -- high | medium | low
  capped        boolean not null default false,
  cap_reason    text,
  anchor_neighbor text,
  skills        jsonb,                  -- SkillVector
  proof         jsonb not null,         -- MetricScore
  gravity       jsonb not null,         -- MetricScore
  trajectory    jsonb not null,         -- MetricScore
  weights       jsonb not null,         -- Record<Metric, number> used for this run
  created_at    timestamptz not null default now()
);
create index if not exists scores_founder_idx on scores(founder_id, created_at desc);

-- Evidence receipts: every number is clickable to its source ----------------
create table if not exists evidence (
  id         uuid primary key default gen_random_uuid(),
  founder_id text not null references founders(id) on delete cascade,
  metric     text not null,            -- Proof | Gravity | Trajectory
  connector  text not null,            -- github | npm | pypi | ...
  feature    text,
  text       text not null,
  quote      text,
  value      numeric,
  url        text,
  at         timestamptz,
  weight     numeric,
  created_at timestamptz not null default now()
);
create index if not exists evidence_founder_metric_idx on evidence(founder_id, metric);

-- Trajectory timeline points (commit cadence, ships, Wayback snapshots) ------
create table if not exists trajectory_points (
  id         uuid primary key default gen_random_uuid(),
  founder_id text not null references founders(id) on delete cascade,
  date       text not null,
  value      int not null default 0,
  label      text,
  kind       text,                     -- commit | ship | snapshot | press | milestone
  url        text
);
create index if not exists trajectory_founder_idx on trajectory_points(founder_id);

-- Candidate queue (Loop A output before full evaluation) --------------------
create table if not exists candidate_queue (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  handle        text,
  thesis_id     text references theses(id) on delete set null,
  triage        int not null default 0,
  source        text,                  -- github | article | devpost | alumni | ...
  status        text not null default 'queued',  -- queued | evaluating | promoted | dropped
  payload       jsonb,
  discovered_at timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists candidate_status_idx on candidate_queue(status, discovered_at desc);

-- Calibration anchor set, with an optional embedding for semantic neighbours -
create table if not exists anchors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  display    text,
  outcome    text not null,            -- success | mixed | failed
  proof      int not null,
  gravity    int not null,
  trajectory int not null,
  note       text,
  embedding  vector(1536),
  created_at timestamptz not null default now()
);

-- Founder-market-fit vectors (pgvector): problem vs footprint similarity -----
create table if not exists fmf_vectors (
  founder_id         text primary key references founders(id) on delete cascade,
  problem_embedding  vector(1536),
  footprint_embedding vector(1536),
  similarity         numeric,
  rationale          text,
  created_at         timestamptz not null default now()
);

-- Approximate-nearest-neighbour indexes for the vector columns.
create index if not exists anchors_embedding_idx on anchors using ivfflat (embedding vector_cosine_ops) with (lists = 10);
create index if not exists fmf_footprint_idx on fmf_vectors using ivfflat (footprint_embedding vector_cosine_ops) with (lists = 10);

-- Row level security: the discovered dossiers are public read for the demo,
-- and only the service role (server-side) may write.
alter table theses            enable row level security;
alter table ventures          enable row level security;
alter table founders          enable row level security;
alter table scores            enable row level security;
alter table evidence          enable row level security;
alter table trajectory_points enable row level security;
alter table anchors           enable row level security;
alter table fmf_vectors       enable row level security;
alter table candidate_queue   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['theses','ventures','founders','scores','evidence','trajectory_points','anchors','fmf_vectors']
  loop
    execute format('create policy %I on %I for select using (true);', t || '_read', t);
  end loop;
end $$;
-- candidate_queue stays private (server-side only); no anon policy is created.
