import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroDocumentMagnifyingGlass,
  heroExclamationTriangle,
  heroUserGroup,
} from '@ng-icons/heroicons/outline';
import { SectionHeading } from '../../core/ui/section-heading';
import { DataService } from '../../core/data/data.service';
import type { Band, Founder, Venture } from '../../core/model';

const BANDS: readonly Band[] = ['Invest', 'Watch', 'Pass'];

type SortMode = 'recent' | 'score';
const SORT_OPTIONS: readonly { id: SortMode; label: string }[] = [
  { id: 'recent', label: 'Most recent' },
  { id: 'score', label: 'Highest score' },
];

interface Row {
  readonly venture: Venture;
  readonly founder: Founder;
}

// Decision: the audit log of every automated verdict, not another filtered
// re-listing of the Pipeline. Pipeline answers "where is this founder in the
// funnel"; Decision answers "what did the model conclude, when, and why
// should I trust it". Thin-evidence calls sit apart under Pending until a
// human confirms them, rather than being logged as decided.
@Component({
  selector: 'app-decision-page',
  imports: [RouterLink, NgIcon, SectionHeading, NgTemplateOutlet],
  viewProviders: [
    provideIcons({ heroDocumentMagnifyingGlass, heroExclamationTriangle, heroUserGroup }),
  ],
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
            Decision
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            The automated verdict for every evaluated founder, with the confidence and evidence
            behind each call. Thin evidence routes to a human before anything is logged as
            decided.
          </p>
        </header>

        <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              (click)="bandFilter.set('all')"
              class="rounded-full border-[0.5px] px-3 py-1 text-[12px] transition-colors"
              [class]="
                bandFilter() === 'all'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-foreground hover:bg-accent'
              "
            >
              All <span [class.text-muted-foreground]="bandFilter() !== 'all'">{{
                data.decisions().length
              }}</span>
            </button>
            @for (band of bands; track band) {
              <button
                type="button"
                (click)="bandFilter.set(band)"
                class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] px-3 py-1 text-[12px] transition-colors"
                [class]="
                  bandFilter() === band
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-foreground hover:bg-accent'
                "
              >
                <span class="size-1.5 rounded-full" [style.background]="data.bandColor(band)"></span>
                {{ band }} <span [class.text-muted-foreground]="bandFilter() !== band">{{
                  countFor(band)
                }}</span>
              </button>
            }
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[12px] text-muted-foreground">Sort</span>
            @for (opt of sortOptions; track opt.id) {
              <button
                type="button"
                (click)="sortBy.set(opt.id)"
                class="rounded-full border-[0.5px] px-2.5 py-1 text-[12px] transition-colors"
                [class]="
                  sortBy() === opt.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:bg-accent'
                "
              >
                {{ opt.label }}
              </button>
            }
          </div>
        </div>

        @if (pending().length) {
          <app-section-heading title="Pending human review" />
          <p class="-mt-2 mb-4 text-[12px] leading-relaxed text-muted-foreground">
            A verdict has been computed, but evidence is too thin to log it as decided.
          </p>
          <div class="flex flex-col gap-3">
            @for (row of pending(); track row.venture.id) {
              <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ row }" />
            }
          </div>
        }

        <app-section-heading title="Decided" />
        <div class="flex flex-col gap-3">
          @for (row of decided(); track row.venture.id) {
            <ng-container [ngTemplateOutlet]="card" [ngTemplateOutletContext]="{ row }" />
          } @empty {
            <p
              class="rounded-xl border-[0.5px] border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground"
            >
              No decisions match this filter yet.
            </p>
          }
        </div>
      </div>
    </div>

    <ng-template #card let-row="row">
      <div class="rounded-xl border-[0.5px] border-border bg-card p-5">
        <a
          [routerLink]="['/evaluation']"
          [queryParams]="{ founder: row.founder.id }"
          class="block transition-opacity hover:opacity-80"
        >
          <div class="flex items-start gap-4">
            <div
              class="grid size-10 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[13px] font-medium text-foreground"
            >
              {{ row.founder.initials }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p class="text-[14px] font-medium text-foreground">{{ row.founder.name }}</p>
                <span class="text-[12px] text-muted-foreground">{{ row.venture.name }}</span>
              </div>
              <p class="mt-0.5 truncate text-[12px] text-muted-foreground">
                {{ row.venture.tagline }}
              </p>
              @if (row.venture.decision; as d) {
                <p class="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  {{ d.rationale }}
                </p>
              }
            </div>

            @if (row.venture.decision; as d) {
              <div class="flex shrink-0 flex-col items-end gap-2">
                <span class="font-title text-[22px] leading-none text-foreground">
                  {{ d.composite }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2.5 py-1 text-[12px] font-medium text-foreground"
                >
                  <span class="size-1.5 rounded-full" [style.backgroundColor]="data.bandColor(d.band)"></span>
                  {{ d.band }}
                </span>
                <p class="text-[11px] text-muted-foreground">
                  {{ d.decidedAt ? 'decided ' + data.timeAgo(d.decidedAt) : 'confidence ' + d.confidence }}
                </p>
              </div>
            }
          </div>
        </a>

        <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t-[0.5px] border-border pt-3">
            <div class="flex flex-wrap items-center gap-2">
              @if (row.venture.decision?.routeToHuman) {
                <span
                  class="inline-flex shrink-0 items-center gap-1.5 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground"
                >
                  <ng-icon name="heroUserGroup" size="0.7rem" class="text-muted-foreground" />
                  Route to human
                </span>
                <p class="text-[11px] leading-relaxed text-muted-foreground">
                  {{ routeReason(row.founder) }}
                </p>
              } @else if (row.founder.redFlags.length) {
                <span
                  class="inline-flex shrink-0 items-center gap-1.5 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground"
                >
                  <ng-icon
                    name="heroExclamationTriangle"
                    size="0.7rem"
                    class="text-muted-foreground"
                  />
                  {{ row.founder.redFlags.length }} flag{{ row.founder.redFlags.length === 1 ? '' : 's' }}
                </span>
              }
            </div>
            <a
              [routerLink]="['/diligence']"
              [queryParams]="{ founder: row.founder.id }"
              class="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ng-icon name="heroDocumentMagnifyingGlass" size="0.7rem" />
              Diligence
            </a>
        </div>
      </div>
    </ng-template>
  `,
})
export class DecisionPage {
  protected readonly data = inject(DataService);
  protected readonly bands = BANDS;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly bandFilter = signal<'all' | Band>('all');
  protected readonly sortBy = signal<SortMode>('recent');

  private readonly filtered = computed<Row[]>(() => {
    const bf = this.bandFilter();
    return this.data
      .decisions()
      .filter((d) => bf === 'all' || d.venture.decision?.band === bf);
  });

  protected readonly pending = computed<Row[]>(() =>
    this.filtered().filter((d) => d.venture.decision && !d.venture.decision.decidedAt),
  );

  protected readonly decided = computed<Row[]>(() => {
    const list = this.filtered().filter((d) => d.venture.decision?.decidedAt);
    if (this.sortBy() === 'score') {
      return [...list].sort(
        (a, b) => (b.venture.decision?.composite ?? 0) - (a.venture.decision?.composite ?? 0),
      );
    }
    return [...list].sort((a, b) =>
      (b.venture.decision?.decidedAt ?? '').localeCompare(a.venture.decision?.decidedAt ?? ''),
    );
  });

  protected countFor(band: Band): number {
    return this.data.decisions().filter((d) => d.venture.decision?.band === band).length;
  }

  protected routeReason(f: Founder): string {
    if (f.note) return f.note;
    const s = f.score;
    if (s) {
      const low = [s.proof, s.gravity, s.trajectory].find((m) => m.confidence === 'low');
      if (low) return `${low.metric} is unverified, a human should confirm it before deciding.`;
    }
    if (f.evidenceCount < 3) return 'Thin evidence, fewer than three sources connected.';
    return 'Needs a human to confirm before an automated decision.';
  }
}
