import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowRight, heroPlus, heroSignal } from '@ng-icons/heroicons/outline';
import { DataService } from '../../core/data/data.service';
import { METRIC_COLORS } from '../../core/metrics';
import type { Founder } from '../../core/model';
import { ThesisComposer, type ThesisDraft } from './thesis-composer';

// Radar: the always-on sourcing feed. Freshly discovered founders, newest first,
// each already triaged and scored. This is the home page and it sells the
// continuous-sourcing USP: open the app and new founders are already waiting.
@Component({
  selector: 'app-radar-page',
  imports: [RouterLink, NgIcon, ThesisComposer],
  viewProviders: [provideIcons({ heroArrowRight, heroPlus, heroSignal })],
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
            <div class="mb-2 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
              <span class="live-dot size-2 rounded-full bg-[#16a34a]"></span>
              Sourcing active
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

        <!-- Sourcing pass status for a runner-created thesis -->
        @if (data.isRunnerThesis(active())) {
          <p class="mt-3 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
            @if (data.sourcingStatus() === 'running') {
              <span class="live-dot size-1.5 rounded-full bg-foreground"></span>
              Running sourcing pass for &ldquo;{{ data.thesis(active())?.label }}&rdquo;...
            } @else {
              <span class="size-1.5 rounded-full bg-[#16a34a]"></span>
              Sourcing pass matched {{ data.matchCountFor(active()) }} founder(s) for &ldquo;{{
                data.thesis(active())?.label
              }}&rdquo;.
            }
          </p>
        }

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
              No founders under this thesis yet. Sourcing is running.
            </div>
          }
        </div>
      </div>
    </div>

    @if (showComposer()) {
      <app-thesis-composer (dismiss)="showComposer.set(false)" (create)="onCreateThesis($event)" />
    }
  `,
})
export class RadarPage {
  protected readonly data = inject(DataService);
  protected readonly radar = this.data.radarFeed;
  protected readonly active = this.data.activeThesisId;
  protected readonly showComposer = signal(false);
  protected readonly lastPass = computed(() => {
    const feed = this.radar();
    if (!feed.length) return 'just now';
    const freshest = feed.reduce((a, b) => (a.discoveredAt > b.discoveredAt ? a : b));
    return this.data.timeAgo(freshest.discoveredAt);
  });

  protected onCreateThesis(draft: ThesisDraft): void {
    this.data.createThesis(draft);
    this.showComposer.set(false);
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
