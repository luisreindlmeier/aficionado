import { Injectable, computed, signal } from '@angular/core';
import type { AgentRun, RunTrigger, TraceStep } from '../model';
import type { ConnectorId } from '../connectors/types';

// ─────────────────────────────────────────────────────────────
// The record of what the agents actually did.
//
// Two sources, merged. Persisted runs come from /api/agent-runs and cover the
// work nobody watched: the hourly refresh job, the daily sourcing cron. Session
// runs are the ones streaming right now in this tab, which do not exist in the
// table until they finish. A run in flight here is replaced by its persisted
// row once it lands, matched on id.
// ─────────────────────────────────────────────────────────────

/** An agent_runs row as served by /api/agent-runs. */
interface AgentRunRow {
  id: string;
  workflow: AgentRun['workflow'];
  subject: string;
  trigger: RunTrigger;
  status: AgentRun['status'];
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  tools: string[] | null;
  trace: TraceStep[] | null;
  summary: string | null;
  error: string | null;
}

function mapRow(r: AgentRunRow): AgentRun {
  return {
    id: r.id,
    workflow: r.workflow,
    subject: r.subject,
    trigger: r.trigger ?? 'action',
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at ?? undefined,
    durationMs: r.duration_ms ?? undefined,
    trace: r.trace ?? [],
    tools: (r.tools ?? []) as ConnectorId[],
    summary: r.summary ?? undefined,
    error: r.error ?? undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class AgentRunStore {
  private readonly session = signal<readonly AgentRun[]>([]);
  private readonly persisted = signal<readonly AgentRun[]>([]);

  /** Whether the recorded history could be loaded, so the page can say why it
   *  is empty rather than implying nothing has ever run. */
  readonly historySource = signal<'live' | 'none' | 'loading'>('loading');

  /** Session runs first (they are the freshest), then recorded history, with
   *  any run present in both taken from the session copy. */
  readonly runs = computed<readonly AgentRun[]>(() => {
    const live = this.session();
    const seen = new Set(live.map((r) => r.id));
    return [...live, ...this.persisted().filter((r) => !seen.has(r.id))];
  });

  readonly active = computed(() => this.runs().find((r) => r.status === 'running'));
  readonly count = computed(() => this.runs().length);

  async load(): Promise<void> {
    try {
      const res = await fetch('/api/agent-runs');
      if (!res.ok) {
        this.historySource.set('none');
        return;
      }
      const json = (await res.json()) as { runs?: AgentRunRow[]; source?: string };
      this.persisted.set((json.runs ?? []).map(mapRow));
      this.historySource.set(json.source === 'supabase' ? 'live' : 'none');
    } catch {
      this.historySource.set('none');
    }
  }

  /** Open a session run and return its id. */
  start(workflow: AgentRun['workflow'], subject: string): string {
    const id = `${workflow}-${this.session().length + 1}-${Date.now()}`;
    this.session.update((rs) => [
      {
        id,
        workflow,
        subject,
        trigger: 'ui' as const,
        startedAt: new Date().toISOString(),
        status: 'running' as const,
        trace: [],
        tools: [],
      },
      ...rs,
    ]);
    return id;
  }

  addTrace(id: string, step: TraceStep): void {
    this.patch(id, (r) => ({ ...r, trace: [...r.trace, step] }));
  }

  /** Record a connector tool an agent called. Deduped: the same tool firing for
   *  two metrics is one tool, not two. */
  addTool(id: string, tool: ConnectorId): void {
    this.patch(id, (r) => (r.tools.includes(tool) ? r : { ...r, tools: [...r.tools, tool] }));
  }

  finish(id: string, summary?: string): void {
    this.patch(id, (r) => ({
      ...r,
      status: 'ok',
      summary,
      finishedAt: new Date().toISOString(),
    }));
    void this.load();
  }

  fail(id: string, error: string): void {
    this.patch(id, (r) => ({
      ...r,
      status: 'error',
      error,
      finishedAt: new Date().toISOString(),
    }));
    void this.load();
  }

  /** Wall-clock duration of a run, or undefined while it is still going. */
  durationMs(run: AgentRun): number | undefined {
    if (run.durationMs != null) return run.durationMs;
    if (!run.finishedAt) return undefined;
    return new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  }

  private patch(id: string, fn: (r: AgentRun) => AgentRun): void {
    this.session.update((rs) => rs.map((r) => (r.id === id ? fn(r) : r)));
  }
}
