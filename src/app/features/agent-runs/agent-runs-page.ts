import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown, heroChevronRight, heroCpuChip } from '@ng-icons/heroicons/outline';
import { AgentRunStore } from '../../core/agents/agent-run.store';
import { DataService } from '../../core/data/data.service';
import { CONNECTORS } from '../../core/connectors/descriptors';
import type { AgentRun } from '../../core/model';
import { AgentActivity } from '../../core/ui/agent-activity';
import { SectionHeading } from '../../core/ui/section-heading';

const WORKFLOW_LABELS: Record<AgentRun['workflow'], string> = {
  'founder-evaluation': 'Founder evaluation',
  'thesis-sourcing': 'Thesis sourcing',
};

/** The agents that make up each workflow, so the page can show what the system
 *  is composed of even before anything has run. Mirrors api/_lib/mastra.ts. */
const WORKFLOW_AGENTS: Record<AgentRun['workflow'], readonly { id: string; role: string }[]> = {
  'founder-evaluation': [
    { id: 'proof-agent', role: 'Gathers and scores what the founder has demonstrably built' },
    { id: 'gravity-agent', role: 'Gathers and scores who moves toward them' },
    { id: 'trajectory-agent', role: 'Gathers and scores slope over time' },
    { id: 'red-flag-critic', role: 'Cross-source coherence pass, can only add red flags' },
  ],
  'thesis-sourcing': [
    { id: 'discovery-analyst', role: 'Ranks the discovered pool against the active thesis' },
  ],
};

// Agent runs: what the machine did, in the app. The Mastra platform dashboard
// has the full spans; this page answers the question a VC actually asks, which
// is "what has been running, on whose behalf, and what did it touch".
@Component({
  selector: 'app-agent-runs-page',
  imports: [NgIcon, SectionHeading, AgentActivity],
  viewProviders: [provideIcons({ heroChevronDown, heroChevronRight, heroCpuChip })],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    @keyframes pulse-dot {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.35;
      }
    }
    .live-dot {
      animation: pulse-dot 1.8s ease-in-out infinite;
    }
  `,
  template: `
    <div class="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div class="mx-auto w-full max-w-7xl px-6 py-8 md:px-8 md:py-10">
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              class="font-title text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground md:text-[28px]"
            >
              Agent runs
            </h1>
            <p class="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
              Every workflow this session has streamed, with the trace and the connector tools the
              agents actually called.
            </p>
          </div>
          <div class="flex flex-col items-end gap-1 text-[12px] text-muted-foreground">
            <span class="font-title text-[22px] leading-none text-foreground">{{
              runs().length
            }}</span>
            <span>runs this session</span>
          </div>
        </header>

        <!-- What the system is made of, whether or not anything has run yet -->
        <app-section-heading title="Workflows" />
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          @for (w of workflows; track w.id) {
            <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <ng-icon name="heroCpuChip" size="0.95rem" class="text-muted-foreground" />
                  <p class="text-[13px] font-medium text-foreground">{{ w.label }}</p>
                </div>
                <span class="text-[11px] text-muted-foreground">{{ countFor(w.id) }} run(s)</span>
              </div>
              <p class="mt-1 text-[12px] leading-relaxed text-muted-foreground">{{ w.trigger }}</p>
              <ul class="mt-3 flex flex-col gap-2">
                @for (a of w.agents; track a.id) {
                  <li class="flex items-start gap-2">
                    <span
                      class="mt-0.5 shrink-0 rounded-full border-[0.5px] border-border px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                      >{{ a.id }}</span
                    >
                    <span class="text-[12px] leading-relaxed text-muted-foreground">{{
                      a.role
                    }}</span>
                  </li>
                }
              </ul>
            </section>
          }
        </div>

        <!-- Connector tools the agents can reach -->
        <app-section-heading title="Tools available to the agents" />
        <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
          <p class="text-[12px] leading-relaxed text-muted-foreground">
            {{ liveTools().length }} of {{ allTools }} connectors have a live runtime and are
            exposed to the metric agents as callable tools. The rest are descriptors only.
          </p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            @for (t of liveTools(); track t.id) {
              <span
                class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground"
                [title]="t.description"
              >
                <span class="size-1.5 rounded-full" [style.background]="usedColor(t.id)"></span>
                {{ t.name }}
              </span>
            }
          </div>
          @if (usedTools().size) {
            <p class="mt-3 text-[11px] text-muted-foreground">
              Filled dots are tools called during this session.
            </p>
          }
        </section>

        <app-section-heading title="Run history" />
        @if (runs().length) {
          <div class="flex flex-col gap-2">
            @for (r of runs(); track r.id) {
              <section class="rounded-xl border-[0.5px] border-border bg-card">
                <button
                  type="button"
                  (click)="toggle(r.id)"
                  class="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent"
                >
                  <ng-icon
                    [name]="expanded() === r.id ? 'heroChevronDown' : 'heroChevronRight'"
                    size="0.85rem"
                    class="shrink-0 text-muted-foreground"
                  />
                  <span
                    class="size-1.5 shrink-0 rounded-full"
                    [class.live-dot]="r.status === 'running'"
                    [style.background]="statusColor(r.status)"
                  ></span>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-[13px] font-medium text-foreground">{{ label(r) }}</p>
                      <span class="truncate text-[12px] text-muted-foreground">{{ r.subject }}</span>
                    </div>
                    <p class="mt-0.5 text-[11px] text-muted-foreground">
                      {{ clock(r.startedAt) }}
                      @if (duration(r); as d) {
                        <span> / {{ d }}</span>
                      }
                      @if (r.tools.length) {
                        <span> / {{ r.tools.length }} tool(s)</span>
                      }
                      @if (r.summary) {
                        <span> / {{ r.summary }}</span>
                      }
                    </p>
                    @if (r.error) {
                      <p class="mt-0.5 text-[11px] text-destructive">{{ r.error }}</p>
                    }
                  </div>
                  <span class="shrink-0 text-[11px] capitalize text-muted-foreground">{{
                    r.status
                  }}</span>
                </button>

                @if (expanded() === r.id) {
                  <div class="border-t-[0.5px] border-border p-4">
                    <app-agent-activity
                      [trace]="r.trace"
                      [tools]="toolChips(r)"
                      [running]="r.status === 'running'"
                    />
                  </div>
                }
              </section>
            }
          </div>
        } @else {
          <section class="rounded-xl border-[0.5px] border-border bg-card p-8 text-center">
            <p class="text-[13px] text-muted-foreground">
              No runs in this session yet. Run a sourcing pass from Radar, or a live evaluation from
              a dossier.
            </p>
            <p class="mx-auto mt-2 max-w-lg text-[12px] leading-relaxed text-muted-foreground">
              This list is scoped to the current browser session, so scheduled passes that ran
              unattended are not shown here. Their output is what fills the Radar queue.
            </p>
          </section>
        }
      </div>
    </div>
  `,
})
export class AgentRunsPage {
  private readonly store = inject(AgentRunStore);
  protected readonly data = inject(DataService);

  protected readonly runs = this.store.runs;
  protected readonly expanded = signal<string | undefined>(undefined);

  protected readonly workflows = [
    {
      id: 'founder-evaluation' as const,
      label: WORKFLOW_LABELS['founder-evaluation'],
      trigger: 'On demand from a dossier, and by the refresh job for unevaluated candidates.',
      agents: WORKFLOW_AGENTS['founder-evaluation'],
    },
    {
      id: 'thesis-sourcing' as const,
      label: WORKFLOW_LABELS['thesis-sourcing'],
      trigger: 'Daily at 06:00 UTC, and on demand from Radar.',
      agents: WORKFLOW_AGENTS['thesis-sourcing'],
    },
  ];

  protected readonly allTools = CONNECTORS.length;
  protected readonly liveTools = computed(() => CONNECTORS.filter((c) => c.live));

  /** Connector ids touched by any run this session. */
  protected readonly usedTools = computed(
    () => new Set(this.runs().flatMap((r) => r.tools as string[])),
  );

  protected countFor(workflow: AgentRun['workflow']): number {
    return this.runs().filter((r) => r.workflow === workflow).length;
  }

  protected label(r: AgentRun): string {
    return WORKFLOW_LABELS[r.workflow];
  }

  protected toggle(id: string): void {
    this.expanded.update((e) => (e === id ? undefined : id));
  }

  protected toolChips(r: AgentRun): { id: string; status: 'done' }[] {
    return r.tools.map((t) => ({ id: t, status: 'done' as const }));
  }

  protected usedColor(id: string): string {
    return this.usedTools().has(id) ? '#16a34a' : '#e5e5e5';
  }

  protected statusColor(s: AgentRun['status']): string {
    return s === 'ok' ? '#16a34a' : s === 'error' ? '#dc2626' : '#a3a3a3';
  }

  protected clock(at: string): string {
    return new Date(at).toLocaleTimeString('en-US', { hour12: false });
  }

  protected duration(r: AgentRun): string | undefined {
    const ms = this.store.durationMs(r);
    if (ms === undefined) return undefined;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }
}
