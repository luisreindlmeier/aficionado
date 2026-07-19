-- Agent telemetry, captured from Mastra's own tracing pipeline via a custom
-- exporter (api/_lib/metrics-exporter.ts). This is the same span stream that
-- feeds the Mastra Platform dashboard, tapped in-process so the app can show
-- cost and latency without sending the user to an external tool.

create table if not exists agent_spans (
  id                text primary key,   -- Mastra span id
  trace_id          text not null,
  parent_span_id    text,
  run_id            text,               -- our agent_runs.id, when correlated
  type              text not null,      -- model_generation | tool_call | agent_run | ...
  name              text not null,
  entity_id         text,               -- e.g. proof-agent, connector.github
  entity_name       text,
  started_at        timestamptz not null,
  ended_at          timestamptz,
  duration_ms       integer,
  model             text,
  provider          text,
  input_tokens      integer,
  output_tokens     integer,
  cache_read_tokens integer,
  reasoning_tokens  integer,
  -- Null unless model pricing is configured (see .env.example). Never guessed:
  -- a fabricated unit economic is worse than an absent one.
  cost_usd          numeric(12, 6),
  error             text,
  recorded_at       timestamptz not null default now()
);

create index if not exists agent_spans_started_idx on agent_spans (started_at desc);
create index if not exists agent_spans_type_idx    on agent_spans (type, started_at desc);
create index if not exists agent_spans_entity_idx  on agent_spans (entity_id, started_at desc);
create index if not exists agent_spans_run_idx     on agent_spans (run_id);

alter table agent_spans enable row level security;

-- Roll-ups on the run itself, so the run list can show cost without a join.
alter table agent_runs add column if not exists input_tokens  integer;
alter table agent_runs add column if not exists output_tokens integer;
alter table agent_runs add column if not exists cost_usd      numeric(12, 6);
alter table agent_runs add column if not exists model_calls   integer;
alter table agent_runs add column if not exists tool_calls    integer;
