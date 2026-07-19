-- Agent run history. Every workflow execution records here, whichever surface
-- triggered it: the hourly GitHub Action, the daily Vercel cron, or a user
-- clicking through the app. Without this the Agent Runs page can only show what
-- the current browser session streamed, which is none of the unattended work.

create table if not exists agent_runs (
  id            text primary key,
  workflow      text not null,          -- 'founder-evaluation' | 'thesis-sourcing'
  subject       text not null,          -- the founder or thesis the run was about
  trigger       text not null,          -- 'ui' | 'cron' | 'action'
  status        text not null,          -- 'running' | 'ok' | 'error'
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  duration_ms   integer,
  tools         text[] not null default '{}',
  trace         jsonb  not null default '[]'::jsonb,
  summary       text,
  error         text
);

create index if not exists agent_runs_started_idx on agent_runs (started_at desc);
create index if not exists agent_runs_workflow_idx on agent_runs (workflow, started_at desc);

-- Server-only, like cached_dossiers and sourcing_candidates: reads and writes go
-- through the service role, so RLS is on with no public policy.
alter table agent_runs enable row level security;
