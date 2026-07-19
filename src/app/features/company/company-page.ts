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
import { FounderRadar, type RadarSeries } from './founder-radar';
import type { Founder, SkillVector, Venture } from '../../core/model';

// Hardcoded test vectors, one per founder, to exercise the complementarity
// radar until real per-founder skill vectors are wired through. Colours follow
// the validated categorical order (blue, aqua, yellow).
const TEST_RADAR: readonly RadarSeries[] = [
  {
    name: 'Luis Reindlmeier',
    color: '#2a78d6',
    vector: { technical: 0.9, commercial: 0.35, domain: 0.62, product: 0.55 },
  },
  {
    name: 'Co-founder (commercial)',
    color: '#1baf7a',
    vector: { technical: 0.3, commercial: 0.86, domain: 0.5, product: 0.82 },
  },
  {
    name: 'Co-founder (domain)',
    color: '#eda100',
    vector: { technical: 0.45, commercial: 0.55, domain: 0.9, product: 0.4 },
  },
];

const SKILL_LABELS: readonly { key: keyof SkillVector; label: string }[] = [
  { key: 'technical', label: 'Technical' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'domain', label: 'Domain' },
  { key: 'product', label: 'Product' },
];

// The Company dossier: everything the Evaluation page shows about a venture as
// context, plus what it can't: every founder side by side, and the harmonized
// team score, a complementarity-first read of the team that is deliberately
// not an average of the individual composites.
@Component({
  selector: 'app-company-page',
  imports: [NgIcon, RouterLink, SectionHeading, FounderRadar],
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
                  <p class="mb-2 text-[12px] font-medium text-muted-foreground">aficionado score</p>
                  <div class="flex items-baseline gap-2">
                    <span
                      class="font-title text-[38px] leading-none tracking-[-0.02em] text-foreground"
                      >{{ d.composite }}</span
                    >
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
                    <span
                      class="size-2 rounded-full"
                      [style.background]="data.bandColor(d.band)"
                    ></span>
                    {{ d.band }}
                  </span>
                  <span class="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span
                      class="size-1.5 rounded-full"
                      [style.background]="confColor(d.confidence)"
                    ></span>
                    confidence {{ d.confidence }}
                  </span>
                </div>
              </div>
              @if (d.routeToHuman) {
                <div
                  class="mt-4 flex items-start gap-2 border-t-[0.5px] border-border pt-4 text-[12px]"
                >
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

          <!-- Skill complementarity radar (hardcoded test vectors) -->
          <app-section-heading title="Skill complementarity" />
          <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
            <p class="mb-4 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
              Each founder's skill vector across the four axes. Where the shapes point in different
              directions, the team complements itself, where they overlap, it doubles up.
            </p>
            <app-founder-radar [series]="radarSeries" />
          </section>

          <!-- Harmonized team score -->
          <app-section-heading title="Team" />
          @if (team(); as t) {
            <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0 max-w-lg">
                  <p class="text-[12px] font-medium text-muted-foreground">Harmonized team score</p>
                  <p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    Not an average of {{ founders().length }} individual scores, an intelligent read
                    of how well this team complements each other: broad skill coverage counts for
                    more than any one founder's number, overlap on the same axis counts for less.
                  </p>
                  @if (avgComposite(); as avg) {
                    <p class="mt-3 text-[12px] text-muted-foreground">
                      Average of individual scores: {{ avg }}.
                      @if (t.score > avg) {
                        Harmonized team score is +{{ t.score - avg }} for complementary coverage.
                      } @else if (t.score < avg) {
                        Harmonized team score is {{ t.score - avg }}, coverage overlaps more than it
                        complements.
                      } @else {
                        Harmonized team score matches the average, coverage is exactly what the
                        founders already carry alone.
                      }
                    </p>
                  }
                </div>
                <div class="flex items-baseline gap-2">
                  <span
                    class="font-title text-[46px] leading-none tracking-[-0.02em] text-foreground"
                    >{{ t.score }}</span
                  >
                  <span class="text-[13px] text-muted-foreground">/ 100</span>
                </div>
              </div>

              <div class="mt-5 grid gap-4 border-t-[0.5px] border-border pt-4 sm:grid-cols-2">
                <div>
                  <p class="mb-3 text-[12px] text-muted-foreground">Combined skill coverage</p>
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
                      <span
                        class="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
                        >{{ pctOf(t.coverage[axis.key]) }}</span
                      >
                    </div>
                  }
                </div>
                <div class="text-[12px]">
                  @if (t.gaps.length) {
                    <p class="mb-1 text-muted-foreground">Gaps</p>
                    <ul class="mb-3 flex flex-col gap-1">
                      @for (g of t.gaps; track g) {
                        <li class="flex items-start gap-2 text-foreground">
                          <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#d97706]"></span
                          >{{ g }}
                        </li>
                      }
                    </ul>
                  }
                  @if (t.redundancies.length) {
                    <p class="mb-1 text-muted-foreground">Redundancies</p>
                    <ul class="flex flex-col gap-1">
                      @for (r of t.redundancies; track r) {
                        <li class="flex items-start gap-2 text-foreground">
                          <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#a3a3a3]"></span
                          >{{ r }}
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
                Solo founder today, there is no team yet to harmonize. Add and evaluate a co-founder
                to see how the team complements each other.
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
                      <div class="mt-3 grid max-w-sm grid-cols-4 gap-2">
                        @for (axis of skillAxes; track axis.key) {
                          <div>
                            <div class="h-1 overflow-hidden rounded-full bg-[#e5e5e5]">
                              <div
                                class="h-full rounded-full bg-foreground"
                                [style.width.%]="pctOf(s.skills[axis.key])"
                              ></div>
                            </div>
                            <span class="mt-1 block text-[10px] text-muted-foreground">{{
                              axis.label
                            }}</span>
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
                        <span
                          class="size-1.5 rounded-full"
                          [style.background]="data.bandColor(s.band)"
                        ></span>
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
  protected readonly radarSeries = TEST_RADAR;

  private readonly ventureId = signal<string | undefined>(undefined);
  protected readonly venture = computed<Venture | undefined>(() =>
    this.data.venture(this.ventureId()),
  );
  protected readonly founders = computed<Founder[]>(() => {
    const v = this.ventureId();
    if (!v) return [];
    return [...this.data.foundersForVenture(v)].sort(
      (a, b) => (b.score?.composite ?? -1) - (a.score?.composite ?? -1),
    );
  });
  protected readonly team = computed(() => this.venture()?.team);

  protected readonly avgComposite = computed<number | undefined>(() => {
    const scored = this.founders()
      .map((f) => f.score?.composite)
      .filter((c): c is number => c != null);
    if (!scored.length) return undefined;
    return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
  });

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

  protected confColor(c: string): string {
    return c === 'high' ? '#16a34a' : c === 'medium' ? '#d97706' : '#dc2626';
  }
}
