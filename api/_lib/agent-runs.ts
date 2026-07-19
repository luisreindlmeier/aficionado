import type { TraceStep } from '../../src/app/core/model';
import type { ConnectorId } from '../../src/app/core/connectors/types';
import { TOKEN_BEARING_SPAN, drainSpans, pricingConfigured, summarize } from './metrics-exporter';
import { supabaseAdmin, supabaseReader } from './supabase';

// ─────────────────────────────────────────────────────────────
// Agent run history, recorded server-side. The work that matters most happens
// unattended (the hourly GitHub Action, the daily cron), so recording only what
// a browser tab streamed would leave the Agent Runs page permanently empty.
// Every accessor no-ops without credentials, like the rest of the live layer.
// ─────────────────────────────────────────────────────────────

export type RunWorkflow = 'founder-evaluation' | 'thesis-sourcing';
export type RunTrigger = 'ui' | 'cron' | 'action';

export interface AgentRunRow {
  id: string;
  workflow: RunWorkflow;
  subject: string;
  trigger: RunTrigger;
  status: 'running' | 'ok' | 'error';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  tools: string[];
  trace: TraceStep[];
  summary: string | null;
  error: string | null;
}

/** A run being recorded. Collects trace and tools in memory, then writes once at
 *  the end: a workflow should never pay a database round trip per trace line,
 *  and a half-written run is less useful than none. */
export class RunRecorder {
  readonly id: string;
  private readonly startedAt = new Date();
  private readonly trace: TraceStep[] = [];
  private readonly tools = new Set<string>();

  constructor(
    private readonly workflow: RunWorkflow,
    private readonly subject: string,
    private readonly trigger: RunTrigger,
  ) {
    // Deterministic enough to be unique per run without pulling in a uuid dep.
    this.id = `${workflow}-${this.startedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  addTrace(step: TraceStep): void {
    this.trace.push(step);
  }

  addTool(tool: ConnectorId | string): void {
    if (tool) this.tools.add(String(tool));
  }

  finish(summary?: string): Promise<void> {
    return this.write('ok', summary, undefined);
  }

  fail(error: string): Promise<void> {
    return this.write('error', undefined, error);
  }

  private async write(
    status: 'ok' | 'error',
    summary: string | undefined,
    error: string | undefined,
  ): Promise<void> {
    const db = supabaseAdmin();
    // Drain regardless of whether we can persist, so a run without credentials
    // does not leave its spans to accumulate into the next one.
    const spans = drainSpans();
    if (!db) return;
    const finishedAt = new Date();
    const totals = summarize(spans);
    try {
      await db.from('agent_runs').upsert({
        id: this.id,
        workflow: this.workflow,
        subject: this.subject.slice(0, 200),
        trigger: this.trigger,
        status,
        started_at: this.startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - this.startedAt.getTime(),
        // Cap the trace: a run's shape is legible from its first lines, and an
        // unbounded jsonb column is how a history table becomes a liability.
        trace: this.trace.slice(0, 60),
        tools: [...this.tools],
        summary: summary ?? null,
        error: error ?? null,
        ...totals,
      });
      if (spans.length) {
        // Dedupe by span id: Postgres rejects an entire upsert batch when the
        // same conflict target appears twice ("cannot affect row a second
        // time"), and Mastra can emit SPAN_ENDED more than once for a span.
        const unique = [...new Map(spans.map((s) => [s.id, s])).values()];
        const { error: spanError } = await db
          .from('agent_spans')
          .upsert(unique.map((s) => ({ ...s, run_id: this.id })));
        if (spanError) console.error('metrics: span write failed:', spanError.message);
      }
    } catch (err) {
      // Recording a run must never break the run itself, but failing silently
      // is how a telemetry table stays mysteriously empty.
      console.error('metrics: run write failed:', err instanceof Error ? err.message : err);
    }
  }
}

export interface AgentMetrics {
  /** Whether cost could be computed at all (model pricing configured). */
  pricingConfigured: boolean;
  windowHours: number;
  runs: number;
  failedRuns: number;
  modelCalls: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costUsd: number | null;
  /** Evaluations completed in the window, for cost per founder. */
  evaluations: number;
  byAgent: { id: string; inputTokens: number; outputTokens: number; costUsd: number | null }[];
  byTool: { id: string; calls: number; avgMs: number; errors: number }[];
}

const EMPTY_METRICS = (windowHours: number): AgentMetrics => ({
  pricingConfigured: pricingConfigured(),
  windowHours,
  runs: 0,
  failedRuns: 0,
  modelCalls: 0,
  toolCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  costUsd: null,
  evaluations: 0,
  byAgent: [],
  byTool: [],
});

/** Aggregate the captured spans over a time window. Done in code rather than
 *  SQL so it works against the plain PostgREST client without a view. */
export async function readAgentMetrics(windowHours = 24): Promise<AgentMetrics> {
  const db = supabaseReader();
  if (!db) return EMPTY_METRICS(windowHours);
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();

  const [{ data: spanRows }, { data: runRows }] = await Promise.all([
    db.from('agent_spans').select('*').gte('started_at', since).limit(10_000),
    db.from('agent_runs').select('workflow,status').gte('started_at', since).limit(5_000),
  ]);

  const spans = (spanRows as SpanRow[] | null) ?? [];
  const runs = (runRows as { workflow: string; status: string }[] | null) ?? [];
  const out = EMPTY_METRICS(windowHours);

  out.runs = runs.length;
  out.failedRuns = runs.filter((r) => r.status === 'error').length;
  out.evaluations = runs.filter(
    (r) => r.workflow === 'founder-evaluation' && r.status === 'ok',
  ).length;

  const agents = new Map<string, { input: number; output: number; cost: number; costed: boolean }>();
  const tools = new Map<string, { calls: number; ms: number; timed: number; errors: number }>();
  let costed = false;
  let cost = 0;

  for (const s of spans) {
    // Tokens are counted at exactly one span level. Mastra repeats the same
    // usage on model_step and model_inference children, so summing every span
    // that carries usage would triple count.
    if (s.type === TOKEN_BEARING_SPAN) {
      out.inputTokens += s.input_tokens ?? 0;
      out.outputTokens += s.output_tokens ?? 0;
      out.cacheReadTokens += s.cache_read_tokens ?? 0;
      if (s.cost_usd != null) {
        cost += Number(s.cost_usd);
        costed = true;
      }
      out.modelCalls++;
      // Model spans hang off the agent span, so attribute by the owning entity.
      const key = s.entity_id || s.entity_name || 'unattributed';
      const a = agents.get(key) ?? { input: 0, output: 0, cost: 0, costed: false };
      a.input += s.input_tokens ?? 0;
      a.output += s.output_tokens ?? 0;
      if (s.cost_usd != null) {
        a.cost += Number(s.cost_usd);
        a.costed = true;
      }
      agents.set(key, a);
    }

    if (s.type === 'tool_call' || s.type === 'mcp_tool_call') {
      out.toolCalls++;
      const key = s.entity_id || s.name || 'tool';
      const t = tools.get(key) ?? { calls: 0, ms: 0, timed: 0, errors: 0 };
      t.calls++;
      if (s.duration_ms != null) {
        t.ms += s.duration_ms;
        t.timed++;
      }
      if (s.error) t.errors++;
      tools.set(key, t);
    }
  }

  out.costUsd = costed ? Number(cost.toFixed(4)) : null;
  out.byAgent = [...agents.entries()]
    .map(([id, a]) => ({
      id,
      inputTokens: a.input,
      outputTokens: a.output,
      costUsd: a.costed ? Number(a.cost.toFixed(4)) : null,
    }))
    .sort((x, y) => y.inputTokens + y.outputTokens - (x.inputTokens + x.outputTokens));
  out.byTool = [...tools.entries()]
    .map(([id, t]) => ({
      id: id.replace(/^connector\./, ''),
      calls: t.calls,
      avgMs: t.timed ? Math.round(t.ms / t.timed) : 0,
      errors: t.errors,
    }))
    .sort((x, y) => y.calls - x.calls);
  return out;
}

interface SpanRow {
  type: string;
  name: string;
  entity_id: string | null;
  entity_name: string | null;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cost_usd: string | number | null;
  error: string | null;
}

export async function readAgentRuns(limit = 50): Promise<AgentRunRow[]> {
  const db = supabaseReader();
  if (!db) return [];
  const { data } = await db
    .from('agent_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  return (data as AgentRunRow[] | null) ?? [];
}
