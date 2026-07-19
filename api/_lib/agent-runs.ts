import type { TraceStep } from '../../src/app/core/model';
import type { ConnectorId } from '../../src/app/core/connectors/types';
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
    if (!db) return;
    const finishedAt = new Date();
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
      });
    } catch {
      // Recording a run must never break the run itself.
    }
  }
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
