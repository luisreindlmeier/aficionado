import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown, heroChevronUp } from '@ng-icons/heroicons/outline';
import { DataService } from '../../core/data/data.service';
import type { Founder, PipelineStage } from '../../core/model';

interface StageMeta {
  readonly stage: PipelineStage;
  readonly label: string;
  readonly hint: string;
  /** Stage a card's primary action button advances a founder to, if any. */
  readonly advanceTo?: PipelineStage;
  readonly advanceLabel?: string;
}

const PRIMARY_STAGES: readonly StageMeta[] = [
  {
    stage: 'Discovered',
    label: 'Discovered',
    hint: 'Freshly sourced, not yet looked at.',
    advanceTo: 'Watch',
    advanceLabel: 'Watch',
  },
  {
    stage: 'Watch',
    label: 'Watch',
    hint: 'Worth keeping an eye on.',
  },
  {
    stage: 'Invest',
    label: 'Decided: Invest',
    hint: 'The call has been made.',
  },
];

@Component({
  selector: 'app-pipeline-page',
  imports: [RouterLink, NgIcon],
  viewProviders: [provideIcons({ heroChevronDown, heroChevronUp })],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
  `,
  template: `
    <div class="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div class="mx-auto w-full max-w-7xl px-6 py-8 md:px-8 md:py-10">
        <header>
          <h1
            class="font-title text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground md:text-[28px]"
          >
            Pipeline
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Founders move from Discovered to Watch, automatically when a sourcing pass matches
            them or manually, and finally get decided: Invest or Pass. Open any card for its
            full evaluation.
          </p>
        </header>

        <div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          @for (meta of stages; track meta.stage) {
            <section class="flex flex-col gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span
                    class="size-2 rounded-full"
                    [style.background]="data.bandColor(meta.stage)"
                  ></span>
                  <h2 class="font-title text-[16px] tracking-[-0.01em] text-foreground">
                    {{ meta.label }}
                  </h2>
                  <span
                    class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground"
                  >
                    {{ pipeline()[meta.stage].length }}
                  </span>
                </div>
                <p class="mt-0.5 text-[11px] text-muted-foreground">{{ meta.hint }}</p>
              </div>

              @for (f of pipeline()[meta.stage]; track f.id) {
                <div class="rounded-xl border-[0.5px] border-border bg-card p-4">
                  <a
                    [routerLink]="['/evaluation']"
                    [queryParams]="{ founder: f.id }"
                    class="block transition-opacity hover:opacity-80"
                  >
                    <div class="flex items-start gap-3">
                      <div
                        class="grid size-9 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[12px] font-medium text-foreground"
                      >
                        {{ f.initials }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-[13px] font-medium text-foreground">
                          {{ f.name }}
                        </p>
                        <p class="truncate text-[12px] text-muted-foreground">{{ f.headline }}</p>
                      </div>
                    </div>

                    <div class="mt-3 flex items-center justify-between">
                      @if (f.score; as s) {
                        <span class="inline-flex items-center gap-1.5 text-[12px] text-foreground">
                          <span
                            class="size-1.5 rounded-full"
                            [style.backgroundColor]="data.bandColor(s.band)"
                          ></span>
                          {{ s.composite }}
                          @if (f.scoreDelta; as d) {
                            <span class="text-[11px] font-medium text-[#16a34a]"
                              >&uarr;+{{ d.composite }}</span
                            >
                          }
                        </span>
                      } @else {
                        <span class="text-[12px] text-muted-foreground">Not scored</span>
                      }
                      <span class="text-[11px] text-muted-foreground">
                        discovered {{ data.timeAgo(f.discoveredAt) }}
                      </span>
                    </div>

                    @if (f.scoreDelta; as d) {
                      <p class="mt-2 text-[11px] leading-relaxed text-[#16a34a]">
                        {{ deltaSummary(d) }}
                      </p>
                    }
                  </a>

                  <div class="mt-3 flex flex-wrap items-center gap-2 border-t-[0.5px] border-border pt-2.5">
                    @if (meta.advanceTo) {
                      <button
                        type="button"
                        (click)="data.setPipelineStage(f.id, meta.advanceTo!)"
                        class="rounded-full border-[0.5px] border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        Move to {{ meta.advanceLabel }}
                      </button>
                    }
                    @if (meta.stage === 'Watch') {
                      <button
                        type="button"
                        (click)="data.setPipelineStage(f.id, 'Invest')"
                        class="rounded-full border-[0.5px] border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                      >
                        Decide: Invest
                      </button>
                      <button
                        type="button"
                        (click)="data.setPipelineStage(f.id, 'Pass')"
                        class="rounded-full border-[0.5px] border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent"
                      >
                        Decide: Pass
                      </button>
                    }
                    @if (meta.stage === 'Invest') {
                      <button
                        type="button"
                        (click)="data.setPipelineStage(f.id, 'Watch')"
                        class="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Reopen
                      </button>
                    }
                  </div>
                </div>
              }

              @if (!pipeline()[meta.stage].length) {
                <p
                  class="rounded-xl border-[0.5px] border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground"
                >
                  Nothing here yet.
                </p>
              }
            </section>
          }
        </div>

        <!-- Decided: Pass, collapsed by default so a healthy pipeline doesn't read as a reject pile -->
        <div class="mt-6 border-t-[0.5px] border-border pt-4">
          <button
            type="button"
            (click)="showPassed.set(!showPassed())"
            class="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ng-icon [name]="showPassed() ? 'heroChevronUp' : 'heroChevronDown'" size="0.8rem" />
            Decided: Pass ({{ pipeline().Pass.length }})
          </button>

          @if (showPassed()) {
            <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              @for (f of pipeline().Pass; track f.id) {
                <a
                  [routerLink]="['/evaluation']"
                  [queryParams]="{ founder: f.id }"
                  class="block rounded-xl border-[0.5px] border-border bg-card p-4 opacity-70 transition-opacity hover:opacity-100"
                >
                  <div class="flex items-start gap-3">
                    <div
                      class="grid size-9 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[12px] font-medium text-foreground"
                    >
                      {{ f.initials }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-[13px] font-medium text-foreground">{{ f.name }}</p>
                      <p class="truncate text-[12px] text-muted-foreground">{{ f.headline }}</p>
                    </div>
                  </div>
                </a>
              } @empty {
                <p
                  class="rounded-xl border-[0.5px] border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground md:col-span-3"
                >
                  Nothing sorted out yet.
                </p>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class PipelinePage {
  protected readonly data = inject(DataService);
  protected readonly stages = PRIMARY_STAGES;
  protected readonly pipeline = this.data.pipeline;
  protected readonly showPassed = signal(false);

  protected deltaSummary(d: NonNullable<Founder['scoreDelta']>): string {
    const parts: string[] = [];
    if (d.proof) parts.push(`Proof +${d.proof}`);
    if (d.gravity) parts.push(`Gravity +${d.gravity}`);
    if (d.trajectory) parts.push(`Trajectory +${d.trajectory}`);
    const detail = parts.length ? parts.join(', ') : `Composite +${d.composite}`;
    return `${detail} (${d.since})`;
  }
}
