import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowPath,
  heroArrowRight,
  heroBolt,
  heroPlus,
  heroSignal,
} from '@ng-icons/heroicons/outline';
import { AgentRunStore } from '../../core/agents/agent-run.store';
import { SourcingService } from '../../core/agents/sourcing.service';
import { DataService } from '../../core/data/data.service';
import { METRIC_COLORS } from '../../core/metrics';
import type { Founder, SourcedCandidate, Thesis, TraceStep } from '../../core/model';
import { AgentActivity, type ActivityLine } from '../../core/ui/agent-activity';
import { SectionHeading } from '../../core/ui/section-heading';
import { ThesisComposer, type ThesisDraft } from './thesis-composer';

// Radar: the always-on sourcing feed. Freshly discovered founders, newest first,
// each already triaged and scored. This is the home page and it sells the
// continuous-sourcing USP: open the app and new founders are already waiting.
@Component({
  selector: 'app-radar-page',
  imports: [RouterLink, NgIcon, ThesisComposer, AgentActivity, SectionHeading],
  viewProviders: [
    provideIcons({ heroArrowPath, heroArrowRight, heroBolt, heroPlus, heroSignal }),
  ],
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
      animation: pulse-dot 1.8s var(--ease-default, ease-in-out) infinite;
    }
  `,
  template: `
    <div class="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div class="mx-auto w-full max-w-7xl px-6 py-8 md:px-8 md:py-10">
        <!-- Header: live sourcing status -->
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <!-- Provenance, not decoration: says whether these founders are live
                 agent output or the committed seed. -->
            <div class="mb-2 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
              @switch (data.dataSource()) {
                @case ('live') {
                  <span class="live-dot size-2 rounded-full bg-[#16a34a]"></span>
                  Live dossiers, evaluated by the agents
                }
                @case ('seed') {
                  <span class="size-2 rounded-full bg-[#a3a3a3]"></span>
                  Reference dataset, no live evaluations yet
                }
                @default {
                  <span class="live-dot size-2 rounded-full bg-[#a3a3a3]"></span>
                  Loading
                }
              }
            </div>
            <h1
              class="font-title text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground md:text-[28px]"
            >
              Radar
            </h1>
            <p class="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Freshly discovered founders, newest first. Each is triaged and scored the moment
              it lands, so the pipeline is never empty.
            </p>
          </div>
          <div class="flex flex-col items-end gap-1 text-[12px] text-muted-foreground">
            <span class="font-title text-[22px] leading-none text-foreground"
              >{{ radar().length }}</span
            >
            <span>founders in view</span>
            @if (queue().length) {
              <span>{{ queue().length }} in the sourcing queue</span>
            }
            <span>last pass {{ lastPass() }}</span>
          </div>
        </header>

        <!-- Thesis filter -->
        <div class="mt-6 flex flex-wrap items-center gap-2">
          <span class="mr-1 text-[12px] text-muted-foreground">Thesis</span>
          <button
            type="button"
            (click)="data.setThesis('all')"
            class="rounded-full border-[0.5px] px-3 py-1 text-[12px] transition-colors"
            [class.border-foreground]="active() === 'all'"
            [class.bg-foreground]="active() === 'all'"
            [class.text-background]="active() === 'all'"
            [class.border-border]="active() !== 'all'"
            [class.text-foreground]="active() !== 'all'"
            [class.hover:bg-accent]="active() !== 'all'"
          >
            All theses
          </button>
          @for (t of data.theses(); track t.id) {
            <button
              type="button"
              (click)="data.setThesis(t.id)"
              [title]="t.description"
              class="rounded-full border-[0.5px] px-3 py-1 text-[12px] transition-colors"
              [class.border-foreground]="active() === t.id"
              [class.bg-foreground]="active() === t.id"
              [class.text-background]="active() === t.id"
              [class.border-border]="active() !== t.id"
              [class.text-foreground]="active() !== t.id"
              [class.hover:bg-accent]="active() !== t.id"
            >
              {{ t.label }}
              @if (data.isRunnerThesis(t.id)) {
                <span class="ml-1 text-[10px] text-muted-foreground">runner</span>
              }
            </button>
          }
          <button
            type="button"
            (click)="showComposer.set(true)"
            class="inline-flex items-center gap-1 rounded-full border-[0.5px] border-dashed border-border px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            <ng-icon name="heroPlus" size="0.75rem" />
            New thesis
          </button>
        </div>

        <!-- Sourcing pass: the real LOOP A workflow, on demand -->
        <section class="mt-5 rounded-xl border-[0.5px] border-border bg-card p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[13px] font-medium text-foreground">Sourcing pass</p>
              <p class="mt-1 max-w-lg text-[12px] leading-relaxed text-muted-foreground">
                The discovery agent scans the pool against the active thesis and ranks genuine
                matches into the queue. Runs unattended every morning; run it now to watch it.
              </p>
            </div>
            <button
              type="button"
              (click)="runSourcing()"
              [disabled]="sourcing()"
              class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <ng-icon
                [name]="sourcing() ? 'heroArrowPath' : 'heroBolt'"
                size="0.9rem"
                [class.animate-spin]="sourcing()"
              />
              {{ sourcing() ? 'Sourcing' : 'Run sourcing pass' }}
            </button>
          </div>

          @if (sourcingError(); as err) {
            <p class="mt-3 text-[12px] text-destructive">{{ err }}</p>
          }

          @if (trace().length || sourcing()) {
            <div class="mt-4">
              <app-agent-activity
                [trace]="trace()"
                [lines]="surfacedLines()"
                [running]="sourcing()"
              />
            </div>
          }

          @if (summary(); as s) {
            <p class="mt-3 border-t-[0.5px] border-border pt-3 text-[12px] text-muted-foreground">
              Scanned {{ s.scanned }} founders, surfaced {{ s.surfaced }}, ranked by
              {{ s.rankedBy === 'agent' ? 'the discovery agent' : 'deterministic triage' }}.
              {{ s.persisted ? 'Written to the candidate queue.' : 'Read-only, nothing persisted.' }}
            </p>
          }
        </section>

        <!-- Feed -->
        <div class="mt-5 flex flex-col gap-3">
          @for (f of radar(); track f.id; let i = $index) {
            <a
              [routerLink]="['/evaluation']"
              [queryParams]="{ founder: f.id }"
              class="group flex items-center gap-4 rounded-xl border-[0.5px] border-border bg-card p-4 transition-colors hover:bg-accent"
            >
              <!-- avatar -->
              <div
                class="grid size-11 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[13px] font-medium text-foreground"
              >
                {{ f.initials }}
              </div>

              <!-- identity -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="truncate text-[14px] font-medium text-foreground">{{ f.name }}</p>
                  @if (i === 0) {
                    <span
                      class="shrink-0 rounded-full border-[0.5px] border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >newest</span
                    >
                  }
                </div>
                <p class="mt-0.5 truncate text-[12px] text-muted-foreground">{{ f.headline }}</p>
                <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span>discovered {{ data.timeAgo(f.discoveredAt) }}</span>
                  @if (thesisLabel(f); as tl) {
                    <span class="text-border">/</span>
                    <span>{{ tl }}</span>
                  }
                  @if (f.location) {
                    <span class="text-border">/</span>
                    <span>{{ f.location }}</span>
                  }
                </div>
              </div>

              <!-- metric micro-bars -->
              @if (f.score; as s) {
                <div class="hidden w-40 shrink-0 flex-col gap-1.5 sm:flex">
                  @for (m of metrics(f); track m.label) {
                    <div class="flex items-center gap-2">
                      <span class="size-1.5 shrink-0 rounded-full" [style.background]="m.color"></span>
                      <div class="h-1 flex-1 overflow-hidden rounded-full bg-[#e5e5e5]">
                        <div class="h-full rounded-full" [style.width.%]="m.score" [style.background]="m.color"></div>
                      </div>
                      <span class="w-5 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{{ m.score }}</span>
                    </div>
                  }
                </div>
              }

              <!-- verdict -->
              <div class="flex w-24 shrink-0 flex-col items-end gap-1">
                @if (f.score; as s) {
                  <span class="font-title text-[26px] leading-none text-foreground">{{ s.composite }}</span>
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground"
                  >
                    <span class="size-1.5 rounded-full" [style.background]="data.bandColor(s.band)"></span>
                    {{ s.band }}
                  </span>
                  <!-- A score the agent never produced must not read like one. -->
                  @if (data.scoredByFallback(f)) {
                    <span
                      class="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                      title="Scored by the local heuristic, not by an agent"
                    >
                      <span class="size-1 rounded-full bg-[#d97706]"></span>
                      fallback
                    </span>
                  }
                } @else {
                  <span class="text-[11px] text-muted-foreground">triaged {{ f.triage }}</span>
                }
              </div>
              <ng-icon
                name="heroArrowRight"
                size="1rem"
                class="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              />
            </a>
          } @empty {
            <div class="rounded-xl border-[0.5px] border-border bg-card p-8 text-center text-[13px] text-muted-foreground">
              No founders under this thesis yet. Run a sourcing pass to fill the queue.
            </div>
          }
        </div>

        <!-- The sourcing agent's backlog: discovered, not yet evaluated. -->
        @if (queue().length) {
          <app-section-heading title="Sourcing queue" />
          <p class="-mt-2 mb-4 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
            {{ queue().length }} founders the discovery agent surfaced that nothing has evaluated
            yet. Each carries the agent's reason for surfacing it. Open one to run a full
            evaluation.
          </p>
          <div class="flex flex-col gap-2">
            @for (c of visibleQueue(); track c.id) {
              <a
                [routerLink]="['/evaluation']"
                [queryParams]="{ founder: c.id }"
                class="group flex items-start gap-4 rounded-xl border-[0.5px] border-border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div
                  class="grid size-9 shrink-0 place-items-center rounded-full border-[0.5px] border-dashed border-border bg-surface text-[11px] font-medium text-muted-foreground"
                >
                  {{ initialsOf(c) }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="truncate text-[13px] font-medium text-foreground">{{ c.name }}</p>
                    @if (c.github) {
                      <span class="text-[11px] text-muted-foreground">&#64;{{ c.github }}</span>
                    }
                    <span
                      class="rounded-full border-[0.5px] border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >not evaluated</span
                    >
                  </div>
                  @if (c.headline) {
                    <p class="mt-0.5 truncate text-[12px] text-muted-foreground">{{ c.headline }}</p>
                  }
                  @if (c.reason) {
                    <p class="mt-1 text-[11px] italic leading-relaxed text-muted-foreground">
                      {{ c.reason }}
                    </p>
                  }
                </div>
                <div class="flex w-16 shrink-0 flex-col items-end">
                  <span class="font-title text-[18px] leading-none text-foreground">{{
                    c.triage
                  }}</span>
                  <span class="mt-0.5 text-[10px] text-muted-foreground">triage</span>
                </div>
              </a>
            }
          </div>
          @if (queue().length > visibleQueue().length) {
            <button
              type="button"
              (click)="showAllQueue.set(true)"
              class="mt-3 text-[12px] text-muted-foreground underline-offset-2 hover:underline"
            >
              Show all {{ queue().length }} queued founders
            </button>
          }
        }
      </div>
    </div>

    @if (showComposer()) {
      <app-thesis-composer (dismiss)="showComposer.set(false)" (create)="onCreateThesis($event)" />
    }
  `,
})
export class RadarPage {
  protected readonly data = inject(DataService);
  private readonly sourcingService = inject(SourcingService);
  private readonly runs = inject(AgentRunStore);

  protected readonly radar = this.data.radarFeed;
  protected readonly active = this.data.activeThesisId;
  protected readonly showComposer = signal(false);
  protected readonly showAllQueue = signal(false);

  // Live sourcing-pass state.
  protected readonly sourcing = signal(false);
  protected readonly trace = signal<readonly TraceStep[]>([]);
  protected readonly surfaced = signal<readonly SourcedCandidate[]>([]);
  protected readonly summary = signal<
    { scanned: number; surfaced: number; persisted: boolean; rankedBy: string } | undefined
  >(undefined);
  protected readonly sourcingError = signal<string | undefined>(undefined);

  /** Surfaced candidates as activity lines, newest last, capped like the
   *  evaluation stream so a long pass cannot push the page around. */
  protected readonly surfacedLines = computed<readonly ActivityLine[]>(() =>
    this.surfaced()
      .slice(-8)
      .map((c) => ({
        label: String(c.triage),
        text: c.reason ? `${c.name}, ${c.reason}` : c.name,
      })),
  );

  protected readonly queue = this.data.unevaluatedCandidates;
  protected readonly visibleQueue = computed(() =>
    this.showAllQueue() ? this.queue() : this.queue().slice(0, 6),
  );

  protected readonly lastPass = computed(() => {
    const feed = this.radar();
    if (!feed.length) return 'just now';
    const freshest = feed.reduce((a, b) => (a.discoveredAt > b.discoveredAt ? a : b));
    return this.data.timeAgo(freshest.discoveredAt);
  });

  protected onCreateThesis(draft: ThesisDraft): void {
    const thesis = this.data.createThesis(draft);
    this.showComposer.set(false);
    void this.runSourcing(thesis);
  }

  protected initialsOf(c: SourcedCandidate): string {
    return (
      c.name
        .split(/\s+/)
        .map((w) => w[0])
        .filter(Boolean)
        .join('')
        .slice(0, 2)
        .toUpperCase() || '??'
    );
  }

  /** Run the real LOOP A workflow and stream it. Falls back to the local
   *  keyword pass when /api is not reachable, so `ng serve` still works. */
  protected async runSourcing(thesis?: Thesis): Promise<void> {
    if (this.sourcing()) return;
    const thesisId = thesis?.id ?? this.active();
    const label = thesis?.label ?? this.data.thesis(thesisId)?.label ?? 'all theses';

    this.sourcing.set(true);
    this.trace.set([]);
    this.surfaced.set([]);
    this.summary.set(undefined);
    this.sourcingError.set(undefined);

    const runId = this.runs.start('thesis-sourcing', label);
    const matched: string[] = [];

    try {
      for await (const ev of this.sourcingService.run(thesisId)) {
        switch (ev.type) {
          case 'trace':
            this.trace.update((t) => [...t, ev.step]);
            this.runs.addTrace(runId, ev.step);
            break;
          case 'candidate':
            this.surfaced.update((s) => [...s, ev.candidate]);
            matched.push(ev.candidate.id);
            break;
          case 'summary':
            this.summary.set(ev);
            break;
          case 'error':
            this.sourcingError.set(ev.message);
            break;
        }
      }
      if (thesisId !== 'all') this.data.applySourcingResult(thesisId, matched);
      const s = this.summary();
      this.runs.finish(runId, s ? `${s.surfaced} of ${s.scanned} surfaced` : undefined);
      // Pick up anything the pass just wrote to the queue.
      void this.data.loadLive();
    } catch (err) {
      this.fallbackPass(thesis, thesisId, runId, err);
    } finally {
      this.sourcing.set(false);
    }
  }

  /** No backend: run the same triage locally and say so, rather than showing a
   *  failed pass on a page whose whole point is that sourcing is always on. */
  private fallbackPass(
    thesis: Thesis | undefined,
    thesisId: string,
    runId: string,
    err: unknown,
  ): void {
    const target = thesis ?? this.data.thesis(thesisId);
    if (!target) {
      const msg = err instanceof Error ? err.message : String(err);
      this.sourcingError.set(msg);
      this.runs.fail(runId, msg);
      return;
    }
    const ids = this.data.localSourcingPass(target);
    this.data.applySourcingResult(target.id, ids);
    this.trace.update((t) => [
      ...t,
      {
        at: new Date().toISOString(),
        kind: 'discover',
        label: 'Backend unavailable, ran the keyword triage locally',
        detail: `${ids.length} matched`,
      },
    ]);
    this.summary.set({
      scanned: this.data.founders().length,
      surfaced: ids.length,
      persisted: false,
      rankedBy: 'triage',
    });
    this.runs.finish(runId, `${ids.length} matched locally`);
  }

  protected metrics(f: Founder): { label: string; score: number; color: string }[] {
    if (!f.score) return [];
    return [
      { label: 'Proof', score: f.score.proof.score, color: METRIC_COLORS.Proof },
      { label: 'Gravity', score: f.score.gravity.score, color: METRIC_COLORS.Gravity },
      { label: 'Trajectory', score: f.score.trajectory.score, color: METRIC_COLORS.Trajectory },
    ];
  }

  protected thesisLabel(f: Founder): string | undefined {
    return this.data.thesis(f.thesisId)?.label;
  }
}
