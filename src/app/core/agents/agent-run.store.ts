import { Injectable, computed, signal } from '@angular/core';
import type { AgentRun, TraceStep } from '../model';
import type { ConnectorId } from '../connectors/types';

// ─────────────────────────────────────────────────────────────
// The record of what the agents actually did. Every streamed workflow run
// (evaluation and sourcing alike) opens a run here and appends its trace, so
// the Agent runs page can answer "what has the machine been doing" without
// sending the user to the external Mastra tracing dashboard.
//
// Session-scoped on purpose: these are the runs THIS browser watched. Runs the
// cron performed overnight are not here, and the page says so rather than
// implying an empty list means nothing ran.
// ─────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AgentRunStore {
  private readonly runs_ = signal<readonly AgentRun[]>([]);

  readonly runs = this.runs_.asReadonly();
  readonly active = computed(() => this.runs_().find((r) => r.status === 'running'));
  readonly count = computed(() => this.runs_().length);

  /** Open a run and return its id. */
  start(workflow: AgentRun['workflow'], subject: string): string {
    const id = `${workflow}-${this.runs_().length + 1}-${Date.now()}`;
    this.runs_.update((rs) => [
      { id, workflow, subject, startedAt: new Date().toISOString(), status: 'running', trace: [], tools: [] },
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
  }

  fail(id: string, error: string): void {
    this.patch(id, (r) => ({
      ...r,
      status: 'error',
      error,
      finishedAt: new Date().toISOString(),
    }));
  }

  /** Wall-clock duration of a run, or undefined while it is still going. */
  durationMs(run: AgentRun): number | undefined {
    if (!run.finishedAt) return undefined;
    return new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  }

  private patch(id: string, fn: (r: AgentRun) => AgentRun): void {
    this.runs_.update((rs) => rs.map((r) => (r.id === id ? fn(r) : r)));
  }
}
