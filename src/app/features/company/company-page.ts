import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroArrowTopRightOnSquare,
  heroCheckCircle,
  heroExclamationTriangle,
  heroUserGroup,
} from '@ng-icons/heroicons/outline';
import { DataService } from '../../core/data/data.service';
import { SectionHeading } from '../../core/ui/section-heading';
import { METRIC_COLORS } from '../../core/metrics';
import type { Metric } from '../../core/metrics';
import type { Founder, SkillVector, TeamAnalysis, Venture } from '../../core/model';

const SKILL_LABELS: readonly { key: keyof SkillVector; label: string }[] = [
  { key: 'technical', label: 'Technical' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'domain', label: 'Domain' },
  { key: 'product', label: 'Product' },
];

// The same three the founder evaluation is built from, in the same order. The
// team is read on these, not on a separate vocabulary.
const METRIC_COLUMNS: readonly Metric[] = ['Proof', 'Gravity', 'Trajectory'];

// The Company dossier: everything the Evaluation page shows about a venture as
// context, plus what it can't: every founder side by side, and the harmonized
// team score, a complementarity-first read of the team that is deliberately
// not an average of the individual composites.
@Component({
  selector: 'app-company-page',
  imports: [NgIcon, RouterLink, SectionHeading],
  viewProviders: [
    provideIcons({
      heroArrowLeft,
      heroArrowTopRightOnSquare,
      heroCheckCircle,
      heroExclamationTriangle,
      heroUserGroup,
    }),
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
    <div class="min-w-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-7xl px-6 py-8 md:px-8 md:py-10">
        <button
          type="button"
          (click)="back()"
          class="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ng-icon name="heroArrowLeft" size="0.75rem" />
          Back
        </button>

        @if (venture(); as v) {
          <!-- Header -->
          <header class="mt-4 flex items-start gap-4">
            <div
              class="grid size-14 shrink-0 place-items-center rounded-lg bg-foreground text-[20px] font-medium text-background"
            >
              {{ v.monogram }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1 class="font-title text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground">
                  {{ v.name }}
                </h1>
                <span
                  class="rounded-full border-[0.5px] border-border px-2.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {{ v.stage }}
                </span>
              </div>
              <p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {{ v.tagline }}
              </p>
              <p class="mt-2 text-[12px] text-muted-foreground">{{ ventureMeta(v) }}</p>
            </div>
            @if (v.website) {
              <a
                [href]="'https://' + v.website"
                target="_blank"
                rel="noopener"
                class="inline-flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {{ v.website }}
                <ng-icon name="heroArrowTopRightOnSquare" size="0.75rem" />
              </a>
            }
          </header>

          <!-- Verdict -->
          @if (v.decision; as d) {
            <app-section-heading title="Verdict" />
            <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <p class="mb-2 text-[12px] font-medium text-muted-foreground">
                    aficionado score
                  </p>
                  <div class="flex items-baseline gap-2">
                    <span class="font-title text-[38px] leading-none tracking-[-0.02em] text-foreground">{{
                      d.composite
                    }}</span>
                    <span class="text-[13px] text-muted-foreground">/ 100</span>
                  </div>
                  <p class="mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
                    {{ d.rationale }}
                  </p>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-2">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2.5 py-1 text-[13px] font-medium text-foreground"
                  >
                    <span class="size-2 rounded-full" [style.background]="data.bandColor(d.band)"></span>
                    {{ d.band }}
                  </span>
                  <span class="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span class="size-1.5 rounded-full" [style.background]="confColor(d.confidence)"></span>
                    confidence {{ d.confidence }}
                  </span>
                </div>
              </div>
              @if (d.routeToHuman) {
                <div class="mt-4 flex items-start gap-2 border-t-[0.5px] border-border pt-4 text-[12px]">
                  <ng-icon
                    name="heroExclamationTriangle"
                    size="0.9rem"
                    class="mt-0.5 shrink-0 text-muted-foreground"
                  />
                  <p class="text-muted-foreground">Routed to a human before this is final.</p>
                </div>
              }
            </section>
          }

          <!-- Harmonized team score -->
          <app-section-heading title="Team" />
          @if (team(); as t) {
            <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0 max-w-lg">
                  <p class="text-[12px] font-medium text-muted-foreground">Harmonized team score</p>
                  <p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    Not an average of {{ founders().length }} individual scores. The team's coverage,
                    the best founder on each metric, runs through the same composite a founder does,
                    so the team row below is directly comparable to the founder rows. Compatibility
                    then multiplies it: how much that coverage beats the founders' average profile.
                  </p>
                  <p class="mt-3 text-[12px] text-muted-foreground">
                    This is the venture's verdict above: with two founders evaluated, the team is
                    the company.
                  </p>
                </div>
                <!-- The score as its arithmetic: base, compatibility multiplier, result -->
                <div class="flex shrink-0 items-baseline gap-3">
                  <div class="text-right">
                    <span class="font-title text-[22px] leading-none text-muted-foreground">{{
                      t.base
                    }}</span>
                    <span class="mt-1 block text-[11px] text-muted-foreground">team</span>
                  </div>
                  <span class="text-[15px] text-muted-foreground">&times;</span>
                  <div class="text-right">
                    <span class="font-title text-[22px] leading-none text-foreground">{{
                      multiplierLabel(t.compatibility)
                    }}</span>
                    <span class="mt-1 block text-[11px] text-muted-foreground">compatibility</span>
                  </div>
                  <span class="text-[15px] text-muted-foreground">=</span>
                  <div class="flex items-baseline gap-2">
                    <span
                      class="font-title text-[46px] leading-none tracking-[-0.02em] text-foreground"
                      >{{ t.score }}</span
                    >
                    <span class="text-[13px] text-muted-foreground">/ 100</span>
                  </div>
                </div>
              </div>

              <!-- Founder x metric matrix, on the same Proof / Gravity /
                   Trajectory the aficionado score is built from -->
              <div class="mt-5 overflow-x-auto border-t-[0.5px] border-border pt-4">
                <table class="w-full min-w-[560px] border-collapse text-left">
                  <thead>
                    <tr>
                      <th class="pb-3 text-[12px] font-normal text-muted-foreground">Founder</th>
                      @for (m of metricColumns; track m) {
                        <th class="pb-3 pl-4 text-[12px] font-normal text-muted-foreground">
                          <span class="flex items-center gap-1.5">
                            <span
                              class="size-1.5 rounded-full"
                              [style.background]="metricColor(m)"
                            ></span>
                            {{ m }}
                          </span>
                        </th>
                      }
                      <th
                        class="pb-3 pl-4 text-right text-[12px] font-normal text-muted-foreground"
                      >
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (member of t.perFounder; track member.founderId) {
                      <tr class="border-t-[0.5px] border-border">
                        <td class="py-3 pr-4">
                          <span class="flex items-center gap-2.5">
                            <span
                              class="grid size-7 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[11px] font-medium text-foreground"
                              >{{ member.initials }}</span
                            >
                            <span class="truncate text-[13px] text-foreground">{{
                              member.name
                            }}</span>
                          </span>
                        </td>
                        @for (m of metricColumns; track m) {
                          <td class="py-3 pl-4">
                            <span class="flex items-center gap-2">
                              <span
                                class="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[#e5e5e5]"
                              >
                                <span
                                  class="block h-full rounded-full"
                                  [style.width.%]="member.metrics[m]"
                                  [style.background]="metricColor(m)"
                                ></span>
                              </span>
                              <span class="text-[12px] tabular-nums text-foreground">{{
                                member.metrics[m]
                              }}</span>
                              @if (leads(t, member.founderId, m)) {
                                <span class="text-[10px] text-muted-foreground">leads</span>
                              }
                            </span>
                          </td>
                        }
                        <td class="py-3 pl-4 text-right">
                          <span class="inline-flex items-center justify-end gap-1.5">
                            <span
                              class="size-1.5 rounded-full"
                              [style.background]="data.bandColor(member.band)"
                            ></span>
                            <span class="font-title text-[17px] leading-none tabular-nums text-foreground">{{
                              member.composite
                            }}</span>
                          </span>
                        </td>
                      </tr>
                    }
                    <!-- Best-of row: one founder carrying a metric carries it
                         for the whole team, so this is a max, not a mean -->
                    <tr class="border-t-[0.5px] border-foreground bg-surface">
                      <td class="rounded-l-lg py-3 pl-3 pr-4">
                        <span class="text-[12px] font-medium text-foreground">Team coverage</span>
                        <span class="mt-0.5 block text-[10px] text-muted-foreground"
                          >best of {{ t.perFounder.length }}</span
                        >
                      </td>
                      @for (m of metricColumns; track m) {
                        <td class="py-3 pl-4">
                          <span class="flex items-center gap-2">
                            <span
                              class="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[#e5e5e5]"
                            >
                              <span
                                class="block h-full rounded-full"
                                [style.width.%]="t.metricCoverage[m]"
                                [style.background]="metricColor(m)"
                              ></span>
                            </span>
                            <span class="font-title text-[17px] leading-none tabular-nums text-foreground">{{
                              t.metricCoverage[m]
                            }}</span>
                          </span>
                        </td>
                      }
                      <td class="rounded-r-lg py-3 pl-4 pr-3 text-right">
                        <span class="font-title text-[22px] leading-none tabular-nums text-foreground">{{
                          t.base
                        }}</span>
                        <span class="mt-0.5 block text-[10px] text-muted-foreground"
                          >same composite</span
                        >
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Compatibility: how well the founders cover for each other -->
              <div
                class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-[0.5px] border-border pt-4"
              >
                <span class="text-[12px] text-muted-foreground">Compatibility</span>
                <span class="font-title text-[20px] leading-none text-foreground">{{
                  multiplierLabel(t.compatibility)
                }}</span>
                <p class="min-w-0 flex-1 text-[12px] text-muted-foreground">
                  Team {{ t.base }} over the founders' average profile {{ t.soloComposite }}.
                  {{ compatibilityRead(t.compatibility) }}
                </p>
              </div>

              @if (t.sharedHistory.length) {
                <ul
                  class="mt-4 flex flex-col gap-1 border-t-[0.5px] border-border pt-4 text-[12px]"
                >
                  @for (h of t.sharedHistory; track h) {
                    <li class="flex items-start gap-2 text-muted-foreground">
                      <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#a3a3a3]"></span>{{ h }}
                    </li>
                  }
                </ul>
              }
            </section>

            <!-- Skill coverage, the layer behind the metrics -->
            <app-section-heading title="Combined skill coverage" />
            <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  @for (axis of skillAxes; track axis.key) {
                    <div class="mb-2.5 flex items-center gap-3">
                      <span class="w-20 shrink-0 text-[12px] text-muted-foreground">{{
                        axis.label
                      }}</span>
                      <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e5e5e5]">
                        <div
                          class="h-full rounded-full bg-foreground"
                          [style.width.%]="pctOf(t.coverage[axis.key])"
                        ></div>
                      </div>
                      <span class="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{{
                        pctOf(t.coverage[axis.key])
                      }}</span>
                    </div>
                  }
                </div>
                <div class="text-[12px]">
                  @if (t.gaps.length) {
                    <p class="mb-1 text-muted-foreground">Gaps</p>
                    <ul class="mb-3 flex flex-col gap-1">
                      @for (g of t.gaps; track g) {
                        <li class="flex items-start gap-2 text-foreground">
                          <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#d97706]"></span>{{ g }}
                        </li>
                      }
                    </ul>
                  }
                  @if (t.redundancies.length) {
                    <p class="mb-1 text-muted-foreground">Redundancies</p>
                    <ul class="flex flex-col gap-1">
                      @for (r of t.redundancies; track r) {
                        <li class="flex items-start gap-2 text-foreground">
                          <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#a3a3a3]"></span>{{ r }}
                        </li>
                      }
                    </ul>
                  }
                  @if (!t.gaps.length && !t.redundancies.length) {
                    <div class="flex items-center gap-2 text-muted-foreground">
                      <ng-icon name="heroCheckCircle" size="1rem" class="text-[#16a34a]" />
                      Full coverage, no overlap. As complementary as this gets.
                    </div>
                  }
                </div>
              </div>
            </section>
          } @else {
            <section
              class="rounded-xl border-[0.5px] border-dashed border-border bg-card p-5 text-center"
            >
              <ng-icon name="heroUserGroup" size="1.1rem" class="text-muted-foreground" />
              <p class="mt-2 text-[13px] text-muted-foreground">
                Solo founder today, there is no team yet to harmonize. Add and evaluate a
                co-founder to see how the team complements each other.
              </p>
            </section>
          }

          <!-- Founders -->
          <app-section-heading [title]="foundersTitle()" />
          <div class="flex flex-col gap-3">
            @for (f of founders(); track f.id) {
              <a
                [routerLink]="['/evaluation']"
                [queryParams]="{ founder: f.id }"
                class="block rounded-xl border-[0.5px] border-border bg-card p-5 transition-colors hover:bg-accent"
              >
                <div class="flex items-start gap-4">
                  <div
                    class="grid size-11 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[13px] font-medium text-foreground"
                  >
                    {{ f.initials }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-[14px] font-medium text-foreground">{{ f.name }}</p>
                    <p class="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                      {{ f.headline }}
                    </p>
                    @if (f.score; as s) {
                      <div class="mt-3 grid max-w-sm grid-cols-3 gap-3">
                        @for (m of metricViews(s); track m.key) {
                          <div>
                            <div class="h-1 overflow-hidden rounded-full bg-[#e5e5e5]">
                              <div
                                class="h-full rounded-full"
                                [style.width.%]="m.score"
                                [style.background]="m.color"
                              ></div>
                            </div>
                            <span
                              class="mt-1 flex items-baseline gap-1.5 text-[10px] text-muted-foreground"
                            >
                              {{ m.key }}
                              <span class="tabular-nums text-foreground">{{ m.score }}</span>
                              @if (m.confidence === 'low') {
                                <span class="text-muted-foreground">unverified</span>
                              }
                            </span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                  @if (f.score; as s) {
                    <div class="flex shrink-0 flex-col items-end gap-1.5">
                      <span class="font-title text-[22px] leading-none text-foreground">{{
                        s.composite
                      }}</span>
                      <span
                        class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] font-medium text-foreground"
                      >
                        <span class="size-1.5 rounded-full" [style.background]="data.bandColor(s.band)"></span>
                        {{ s.band }}
                      </span>
                    </div>
                  } @else {
                    <span class="shrink-0 text-[11px] text-muted-foreground">Queued</span>
                  }
                </div>
              </a>
            }
          </div>
        } @else {
          <p class="mt-6 text-[13px] text-muted-foreground">Company not found.</p>
        }
      </div>
    </div>
  `,
})
export class CompanyPage {
  protected readonly data = inject(DataService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  protected readonly skillAxes = SKILL_LABELS;
  protected readonly metricColumns = METRIC_COLUMNS;

  private readonly ventureId = signal<string | undefined>(undefined);
  protected readonly venture = computed<Venture | undefined>(() => this.data.venture(this.ventureId()));
  protected readonly founders = computed<Founder[]>(() => {
    const v = this.ventureId();
    if (!v) return [];
    return [...this.data.foundersForVenture(v)].sort(
      (a, b) => (b.score?.composite ?? -1) - (a.score?.composite ?? -1),
    );
  });
  protected readonly team = computed(() => this.venture()?.team);

  protected readonly foundersTitle = computed(() =>
    this.founders().length === 1 ? 'Founder' : `Founders (${this.founders().length})`,
  );

  constructor() {
    this.route.paramMap.subscribe((params) => {
      this.ventureId.set(params.get('id') ?? undefined);
    });
  }

  protected back(): void {
    this.location.back();
  }

  protected ventureMeta(v: { industry: string; location?: string; foundedYear?: number }): string {
    return [v.industry, v.location, v.foundedYear ? `Founded ${v.foundedYear}` : null]
      .filter(Boolean)
      .join(', ');
  }

  protected pctOf(x: number): number {
    return Math.round(x * 100);
  }

  protected multiplierLabel(m: number): string {
    return `${m.toFixed(2)}x`;
  }

  protected metricColor(m: Metric): string {
    return METRIC_COLORS[m];
  }

  /** The founder's three metrics in the same order the Evaluation page shows them. */
  protected metricViews(
    s: NonNullable<Founder['score']>,
  ): readonly { key: Metric; score: number; color: string; confidence: string }[] {
    return METRIC_COLUMNS.map((key) => {
      const ms = key === 'Proof' ? s.proof : key === 'Gravity' ? s.gravity : s.trajectory;
      return { key, score: ms.score, color: METRIC_COLORS[key], confidence: ms.confidence };
    });
  }

  /** True when this founder is the single strongest on the metric, so the matrix
   *  can mark who carries it for the team. */
  protected leads(t: TeamAnalysis, founderId: string, m: Metric): boolean {
    const best = t.metricCoverage[m];
    const holders = t.perFounder.filter((p) => p.metrics[m] === best);
    return holders.length === 1 && holders[0].founderId === founderId;
  }

  protected compatibilityRead(c: number): string {
    if (c >= 1.15)
      return 'Each founder is strongest where the others are not, so the team covers meaningfully more ground than any of them alone.';
    if (c >= 1.05) return 'Some genuine complementarity, with partial overlap on the same metrics.';
    return 'Near-identical profiles, the second founder adds little the first did not already bring.';
  }

  protected confColor(c: string): string {
    return c === 'high' ? '#16a34a' : c === 'medium' ? '#d97706' : '#dc2626';
  }
}
