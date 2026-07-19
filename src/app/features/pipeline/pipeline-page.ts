import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroChevronDown, heroChevronUp } from '@ng-icons/heroicons/outline';
import { DataService } from '../../core/data/data.service';
import type { Founder } from '../../core/model';

@Component({
  selector: 'app-pipeline-page',
  imports: [RouterLink, NgIcon, NgTemplateOutlet],
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
            A read-only view of what the sourcing and evaluation agents are doing in the
            background: founders move from Discovered to Watch as a sourcing pass matches them,
            then get decided: Invest or Pass. Open any card for its full evaluation.
          </p>
        </header>

        <div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          <!-- Discovered -->
          <section class="flex flex-col gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full" [style.background]="data.bandColor('Discovered')"></span>
                <h2 class="font-title text-[16px] tracking-[-0.01em] text-foreground">Discovered</h2>
                <span class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground">
                  {{ pipeline().Discovered.length }}
                </span>
              </div>
              <p class="mt-0.5 text-[11px] text-muted-foreground">Freshly sourced, not yet triaged.</p>
            </div>
            @for (f of pipeline().Discovered; track f.id) {
              <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ f }" />
            }
            @if (!pipeline().Discovered.length) {
              <p class="rounded-xl border-[0.5px] border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground">
                Nothing here yet.
              </p>
            }
          </section>

          <!-- Watch -->
          <section class="flex flex-col gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full" [style.background]="data.bandColor('Watch')"></span>
                <h2 class="font-title text-[16px] tracking-[-0.01em] text-foreground">Watch</h2>
                <span class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground">
                  {{ pipeline().Watch.length }}
                </span>
              </div>
              <p class="mt-0.5 text-[11px] text-muted-foreground">Flagged by the agent as worth tracking.</p>
            </div>
            @for (f of pipeline().Watch; track f.id) {
              <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ f }" />
            }
            @if (!pipeline().Watch.length) {
              <p class="rounded-xl border-[0.5px] border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground">
                Nothing here yet.
              </p>
            }
          </section>

          <!-- Decided: Invest, then Pass collapsed underneath -->
          <section class="flex flex-col gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full" [style.background]="data.bandColor('Invest')"></span>
                <h2 class="font-title text-[16px] tracking-[-0.01em] text-foreground">Decided</h2>
                <span class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground">
                  {{ pipeline().Invest.length + pipeline().Pass.length }}
                </span>
              </div>
              <p class="mt-0.5 text-[11px] text-muted-foreground">The agent's call, from the live scoring pipeline.</p>
            </div>

            @for (f of pipeline().Invest; track f.id) {
              <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ f }" />
            }
            @if (!pipeline().Invest.length) {
              <p class="rounded-xl border-[0.5px] border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground">
                Nothing here yet.
              </p>
            }

            <button
              type="button"
              (click)="showPassed.set(!showPassed())"
              class="mt-1 inline-flex items-center gap-1.5 self-start text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ng-icon [name]="showPassed() ? 'heroChevronUp' : 'heroChevronDown'" size="0.75rem" />
              Pass ({{ pipeline().Pass.length }})
            </button>
            @if (showPassed()) {
              @for (f of pipeline().Pass; track f.id) {
                <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ f }" />
              } @empty {
                <p class="rounded-xl border-[0.5px] border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground">
                  Nothing sorted out yet.
                </p>
              }
            }
          </section>
        </div>
      </div>
    </div>

    <ng-template #card let-f="f">
      <a
        [routerLink]="['/evaluation']"
        [queryParams]="{ founder: f.id }"
        class="block rounded-xl border-[0.5px] border-border bg-card p-4 transition-colors hover:bg-accent"
      >
        <div class="flex items-start gap-3">
          <div class="grid size-9 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[12px] font-medium text-foreground">
            {{ f.initials }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[13px] font-medium text-foreground">{{ f.name }}</p>
            <p class="truncate text-[12px] text-muted-foreground">{{ f.headline }}</p>
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between">
          @if (f.score; as s) {
            <span class="inline-flex items-center gap-1.5 text-[12px] text-foreground">
              <span class="size-1.5 rounded-full" [style.backgroundColor]="data.bandColor(s.band)"></span>
              {{ s.composite }}
              @if (f.scoreDelta; as d) {
                <span class="text-[11px] font-medium text-[#16a34a]">&uarr;+{{ d.composite }}</span>
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
          <p class="mt-2 text-[11px] leading-relaxed text-[#16a34a]">{{ deltaSummary(d) }}</p>
        }
      </a>
    </ng-template>
  `,
})
export class PipelinePage {
  protected readonly data = inject(DataService);
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
