import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowTopRightOnSquare,
  heroExclamationTriangle,
  heroBolt,
  heroArrowPath,
  heroCheckCircle,
  heroLink,
} from '@ng-icons/heroicons/outline';
import { DataService } from '../../core/data/data.service';
import { EvaluationService } from './evaluation.service';
import { METRIC_COLORS } from '../../core/metrics';
import type { Metric } from '../../core/metrics';
import type {
  EvalEvent,
  Founder,
  MetricScore,
  Receipt,
  TraceStep,
  SkillVector,
} from '../../core/model';
import type { ConnectorId, FounderQuery } from '../../core/connectors/types';

interface MetricView {
  readonly key: Metric;
  readonly color: string;
  readonly score: MetricScore;
  readonly caption: string;
}

const CAPTIONS: Record<Metric, string> = {
  Proof: 'What they have demonstrably built, and how well they fit the problem.',
  Gravity: 'Do strong people, capital and attention move toward them.',
  Trajectory: 'Slope and momentum over time, normalised for career age.',
};

const SKILL_LABELS: readonly { key: keyof SkillVector; label: string }[] = [
  { key: 'technical', label: 'Technical' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'domain', label: 'Domain' },
  { key: 'product', label: 'Product' },
];

// The Evaluation dossier: master-detail. Left = founder list, right = the full
// person-first dossier with a verdict, three metric cards backed by clickable
// evidence receipts, founder-market-fit, team complementarity, a trajectory
// replay, and a live streaming "brain at work" panel driven by /api/evaluate.
@Component({
  selector: 'app-evaluation-page',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      heroArrowTopRightOnSquare,
      heroExclamationTriangle,
      heroBolt,
      heroArrowPath,
      heroCheckCircle,
      heroLink,
    }),
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    @keyframes blink {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
    }
    .blink {
      animation: blink 1.2s ease-in-out infinite;
    }
  `,
  template: `
    <div class="flex min-w-0 flex-1 overflow-hidden">
      <!-- Master: founder list -->
      <aside
        class="hidden w-[248px] shrink-0 flex-col overflow-y-auto border-r-[0.5px] border-border md:flex"
      >
        <div class="border-b-[0.5px] border-border px-4 py-3">
          <p class="font-title text-[14px] text-foreground">Founders</p>
          <p class="mt-0.5 text-[11px] text-muted-foreground">{{ founders().length }} evaluated</p>
        </div>
        @for (f of founders(); track f.id) {
          <button
            type="button"
            (click)="select(f.id)"
            class="flex items-center gap-3 border-b-[0.5px] border-border px-4 py-3 text-left transition-colors"
            [class.bg-accent]="f.id === selectedId()"
            [class.hover:bg-surface]="f.id !== selectedId()"
          >
            <div
              class="grid size-8 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[11px] font-medium text-foreground"
            >
              {{ f.initials }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-medium text-foreground">{{ f.name }}</p>
              <p class="truncate text-[11px] text-muted-foreground">{{ ventureName(f) }}</p>
            </div>
            @if (f.score) {
              <div class="flex shrink-0 items-center gap-1.5">
                <span
                  class="size-1.5 rounded-full"
                  [style.background]="data.bandColor(f.score.band)"
                ></span>
                <span class="text-[12px] tabular-nums text-foreground">{{
                  f.score.composite
                }}</span>
              </div>
            }
          </button>
        }
      </aside>

      <!-- Detail: dossier -->
      <div class="min-w-0 flex-1 overflow-y-auto">
        @if (founder(); as f) {
          <div class="mx-auto w-full max-w-3xl px-6 py-8 md:px-8 md:py-10">
            <!-- 1. Person-first header -->
            <header class="flex items-start gap-4">
              <div
                class="grid size-14 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[15px] font-medium text-foreground"
              >
                {{ f.initials }}
              </div>
              <div class="min-w-0 flex-1">
                <h1 class="font-title text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground">
                  {{ f.name }}
                </h1>
                <p class="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {{ f.headline }}
                  @if (f.location) {
                    , {{ f.location }}
                  }
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  @for (link of links(f); track link.label) {
                    <a
                      [href]="link.url"
                      target="_blank"
                      rel="noopener"
                      class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1 text-[12px] text-foreground transition-colors hover:bg-accent"
                    >
                      {{ link.label }}
                      <ng-icon
                        name="heroArrowTopRightOnSquare"
                        size="0.75rem"
                        class="text-muted-foreground"
                      />
                    </a>
                  }
                </div>
              </div>
            </header>

            <!-- 2. Venture (context) -->
            @if (venture(); as v) {
              <section class="mt-6 rounded-xl border-[0.5px] border-border bg-card p-5">
                <div class="flex items-start gap-4">
                  <div
                    class="grid size-11 shrink-0 place-items-center rounded-lg bg-foreground text-[15px] font-medium text-background"
                  >
                    {{ v.monogram }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h2 class="text-[15px] font-semibold text-foreground">{{ v.name }}</h2>
                      <span
                        class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {{ v.stage }}
                      </span>
                    </div>
                    <p class="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      {{ v.tagline }}
                    </p>
                    <p class="mt-2 text-[12px] text-muted-foreground">
                      {{ ventureMeta(v) }}
                    </p>
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
                </div>
              </section>
            }

            <!-- 3. Verdict -->
            @if (f.score; as s) {
              <section class="mt-4 rounded-xl border-[0.5px] border-border bg-card p-5">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div class="min-w-0">
                    <p class="mb-2 text-[12px] font-medium text-muted-foreground">
                      aficionado score
                    </p>
                    <div class="flex items-baseline gap-2">
                      <span
                        class="font-title text-[46px] leading-none tracking-[-0.02em] text-foreground"
                        >{{ s.composite }}</span
                      >
                      <span class="text-[13px] text-muted-foreground">/ 100</span>
                    </div>
                    <p class="mt-2 text-[13px] text-muted-foreground">
                      {{ ordinal(s.percentile) }} percentile vs the anchor set.
                      @if (s.anchorNeighbor) {
                        Sits next to {{ s.anchorNeighbor }}.
                      }
                    </p>
                  </div>
                  <div class="flex shrink-0 flex-col items-end gap-2">
                    <span
                      class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2.5 py-1 text-[13px] font-medium text-foreground"
                    >
                      <span
                        class="size-2 rounded-full"
                        [style.background]="data.bandColor(s.band)"
                      ></span>
                      {{ s.band }}
                    </span>
                    <span
                      class="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"
                    >
                      <span
                        class="size-1.5 rounded-full"
                        [style.background]="confColor(s.confidence)"
                      ></span>
                      confidence {{ s.confidence }}
                    </span>
                  </div>
                </div>
                @if (routeToHuman(f)) {
                  <div
                    class="mt-4 flex items-start gap-2 border-t-[0.5px] border-border pt-4 text-[12px]"
                  >
                    <ng-icon
                      name="heroExclamationTriangle"
                      size="0.9rem"
                      class="mt-0.5 shrink-0 text-muted-foreground"
                    />
                    <p class="text-muted-foreground">Routed to a human. {{ humanReason(f) }}</p>
                  </div>
                }
                @if (s.capped && s.capReason) {
                  <div class="mt-3 flex items-start gap-2 text-[12px]">
                    <span class="mt-1 size-1.5 shrink-0 rounded-full bg-[#dc2626]"></span>
                    <p class="text-muted-foreground">{{ s.capReason }}</p>
                  </div>
                }
              </section>

              <!-- 4. Brain at work (live streaming) -->
              <section class="mt-4 rounded-xl border-[0.5px] border-border bg-card p-5">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="font-title text-[15px] text-foreground">Brain at work</p>
                    <p class="mt-0.5 max-w-md text-[12px] text-muted-foreground">
                      Run the live pipeline against public sources and watch it think. This is the
                      raw public-signal pass; the dossier above is the calibrated score.
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="runLive(f)"
                    [disabled]="running()"
                    class="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <ng-icon
                      [name]="running() ? 'heroArrowPath' : 'heroBolt'"
                      size="0.9rem"
                      [class.animate-spin]="running()"
                    />
                    {{ running() ? 'Evaluating' : 'Run live evaluation' }}
                  </button>
                </div>

                @if (errorMsg(); as err) {
                  <p class="mt-3 text-[12px] text-destructive">{{ err }}</p>
                }

                @if (trace().length || running()) {
                  <div
                    class="mt-4 flex flex-col gap-1.5 rounded-lg border-[0.5px] border-border bg-surface p-3 font-mono text-[11px] leading-relaxed"
                  >
                    @for (t of trace(); track $index) {
                      <div class="flex items-start gap-2">
                        <span class="shrink-0 text-placeholder">{{ t.at }}</span>
                        <span class="shrink-0" [style.color]="traceColor(t)">{{
                          traceGlyph(t)
                        }}</span>
                        <span class="text-foreground">{{ t.label }}</span>
                        @if (t.detail) {
                          <span class="text-muted-foreground">{{ t.detail }}</span>
                        }
                      </div>
                    }
                    @if (running()) {
                      <div class="flex items-center gap-2">
                        <span class="blink text-foreground">▍</span>
                      </div>
                    }
                  </div>
                }

                @if (liveConnectors().length) {
                  <div class="mt-3 flex flex-wrap gap-1.5">
                    @for (c of liveConnectors(); track c.id) {
                      <span
                        class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        <span
                          class="size-1.5 rounded-full"
                          [style.background]="statusColor(c.status)"
                        ></span>
                        {{ c.id }}
                      </span>
                    }
                  </div>
                }

                @if (liveSignals().length) {
                  <ul class="mt-3 flex flex-col gap-1 text-[11px]">
                    @for (s of liveSignals(); track $index) {
                      <li class="flex items-start gap-2">
                        <span
                          class="mt-0.5 shrink-0 rounded-full border-[0.5px] border-border px-1.5 text-[10px] text-muted-foreground"
                          >{{ s.connector }}</span
                        >
                        <span class="text-muted-foreground">{{ s.text }}</span>
                      </li>
                    }
                  </ul>
                }

                @if (liveDone()) {
                  <p
                    class="mt-3 border-t-[0.5px] border-border pt-3 text-[12px] text-muted-foreground"
                  >
                    Live pass complete. {{ signalCount() }} signals gathered across
                    {{ liveSources() }} public sources just now. The dossier above is the calibrated
                    evaluation, which adds AI founder-market-fit and confidence weighting on top of
                    these raw signals.
                  </p>
                }
              </section>

              <!-- 5. Metric cards -->
              <div class="mt-8 mb-4 block">
                <h2
                  class="border-b-[0.5px] border-border pb-2.5 font-title text-[18px] leading-tight tracking-[-0.01em] text-foreground"
                >
                  Three metrics, with receipts
                </h2>
              </div>
              <div class="flex flex-col gap-4">
                @for (m of metricViews(f); track m.key) {
                  <article class="rounded-xl border-[0.5px] border-border bg-card p-5">
                    <div class="flex items-start gap-5">
                      <!-- donut -->
                      <div class="relative shrink-0">
                        <svg viewBox="0 0 100 100" class="size-24">
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke="#e5e5e5"
                            stroke-width="8"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            fill="none"
                            stroke-width="8"
                            stroke-linecap="round"
                            transform="rotate(-90 50 50)"
                            [attr.stroke]="m.color"
                            [attr.stroke-dasharray]="circ"
                            [attr.stroke-dashoffset]="circ * (1 - m.score.score / 100)"
                          />
                          <text
                            x="50"
                            y="50"
                            text-anchor="middle"
                            dominant-baseline="central"
                            font-size="26"
                            font-weight="600"
                            fill="#111"
                          >
                            {{ m.score.score }}
                          </text>
                        </svg>
                      </div>
                      <!-- head + rationale -->
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span class="size-2 rounded-full" [style.background]="m.color"></span>
                          <h3 class="text-[16px] font-semibold text-foreground">{{ m.key }}</h3>
                          <span
                            class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                            >weight {{ pct(m.score.weight) }}%</span
                          >
                          <span
                            class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                            >{{ ordinal(m.score.percentile) }} pct</span
                          >
                          <span
                            class="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                          >
                            <span
                              class="size-1.5 rounded-full"
                              [style.background]="confColor(m.score.confidence)"
                            ></span>
                            {{ m.score.confidence }} confidence
                          </span>
                        </div>
                        <p class="mt-1 text-[12px] text-muted-foreground">{{ m.caption }}</p>
                        <p class="mt-2 text-[13px] leading-relaxed text-foreground">
                          {{ m.score.rationale }}
                        </p>
                        @if (m.score.confidence === 'low') {
                          <div
                            class="mt-2 inline-flex items-center gap-1.5 rounded-md border-[0.5px] border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground"
                          >
                            <ng-icon name="heroExclamationTriangle" size="0.8rem" />
                            Excluded from the composite until this is verified.
                          </div>
                        }
                      </div>
                    </div>

                    <!-- receipts -->
                    @if (m.score.receipts?.length) {
                      <ul
                        class="mt-4 flex flex-col divide-y-[0.5px] divide-border border-t-[0.5px] border-border"
                      >
                        @for (r of m.score.receipts; track $index) {
                          <li class="flex items-start gap-3 py-3">
                            <span
                              class="mt-0.5 shrink-0 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                              >{{ r.connector }}</span
                            >
                            <div class="min-w-0 flex-1">
                              <p class="text-[13px] text-foreground">{{ r.text }}</p>
                              @if (r.quote) {
                                <p class="mt-0.5 text-[12px] italic text-muted-foreground">
                                  {{ r.quote }}
                                </p>
                              }
                            </div>
                            @if (r.url) {
                              <a
                                [href]="normalizeUrl(r.url)"
                                target="_blank"
                                rel="noopener"
                                class="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                                [title]="r.url"
                              >
                                <ng-icon name="heroArrowTopRightOnSquare" size="0.85rem" />
                              </a>
                            }
                          </li>
                        }
                      </ul>
                    }
                  </article>
                }
              </div>

              <!-- 6. Founder-market-fit -->
              @if (f.fmf; as fmf) {
                <div class="mt-8 mb-4 block">
                  <h2
                    class="border-b-[0.5px] border-border pb-2.5 font-title text-[18px] leading-tight tracking-[-0.01em] text-foreground"
                  >
                    Founder-market-fit
                  </h2>
                </div>
                <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
                  <div class="flex items-start gap-5">
                    <div class="shrink-0 text-center">
                      <div class="font-title text-[40px] leading-none" [style.color]="proofColor">
                        {{ pctOf(fmf.similarity) }}
                      </div>
                      <p class="mt-1 text-[11px] text-muted-foreground">match</p>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-[13px] leading-relaxed text-foreground">{{ fmf.rationale }}</p>
                      @for (r of fmf.receipts; track $index) {
                        <a
                          [href]="normalizeUrl(r.url)"
                          target="_blank"
                          rel="noopener"
                          class="mt-3 flex items-start gap-2 rounded-lg border-[0.5px] border-border bg-surface p-3 transition-colors hover:bg-accent"
                        >
                          <ng-icon
                            name="heroLink"
                            size="0.85rem"
                            class="mt-0.5 shrink-0 text-muted-foreground"
                          />
                          <span class="min-w-0 flex-1 text-[12px] text-foreground">{{
                            r.text
                          }}</span>
                          <ng-icon
                            name="heroArrowTopRightOnSquare"
                            size="0.8rem"
                            class="mt-0.5 shrink-0 text-muted-foreground"
                          />
                        </a>
                      }
                    </div>
                  </div>
                </section>
              }

              <!-- 7. Team complementarity -->
              @if (team(); as t) {
                <div class="mt-8 mb-4 block">
                  <h2
                    class="border-b-[0.5px] border-border pb-2.5 font-title text-[18px] leading-tight tracking-[-0.01em] text-foreground"
                  >
                    Team complementarity
                  </h2>
                </div>
                <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p class="mb-3 text-[12px] text-muted-foreground">Skill coverage</p>
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
                              <span
                                class="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#d97706]"
                              ></span
                              >{{ g }}
                            </li>
                          }
                        </ul>
                      }
                      @if (t.sharedHistory.length) {
                        <p class="mb-1 text-muted-foreground">Shared history</p>
                        <ul class="flex flex-col gap-1">
                          @for (h of t.sharedHistory; track h) {
                            <li class="flex items-start gap-2 text-foreground">
                              <span
                                class="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#16a34a]"
                              ></span
                              >{{ h }}
                            </li>
                          }
                        </ul>
                      }
                    </div>
                  </div>
                  @if (t.bonus > 0) {
                    <p
                      class="mt-4 border-t-[0.5px] border-border pt-3 text-[12px] text-muted-foreground"
                    >
                      Team bonus, +{{ t.bonus }} for complementary coverage.
                    </p>
                  }
                </section>
              }

              <!-- 8. Trajectory replay -->
              @if (f.trajectory.length) {
                <div class="mt-8 mb-4 block">
                  <h2
                    class="border-b-[0.5px] border-border pb-2.5 font-title text-[18px] leading-tight tracking-[-0.01em] text-foreground"
                  >
                    Trajectory replay
                  </h2>
                </div>
                <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
                  <div class="flex items-stretch gap-0 overflow-x-auto pb-1">
                    @for (p of f.trajectory; track $index; let last = $last) {
                      <div class="flex min-w-[120px] flex-1 flex-col">
                        <div class="flex items-center">
                          <span
                            class="size-2.5 shrink-0 rounded-full border-[0.5px]"
                            [style.borderColor]="trajColor"
                            [style.background]="last ? trajColor : 'transparent'"
                          ></span>
                          @if (!last) {
                            <span class="h-[0.5px] flex-1" [style.background]="'#e5e5e5'"></span>
                          }
                        </div>
                        <p class="mt-2 text-[11px] text-muted-foreground">{{ p.date }}</p>
                        <p class="text-[12px] text-foreground">{{ p.label }}</p>
                      </div>
                    }
                  </div>
                </section>
              }

              <!-- 9. Red flags -->
              <div class="mt-8 mb-4 block">
                <h2
                  class="border-b-[0.5px] border-border pb-2.5 font-title text-[18px] leading-tight tracking-[-0.01em] text-foreground"
                >
                  Coherence and red flags
                </h2>
              </div>
              <section class="rounded-xl border-[0.5px] border-border bg-card px-5">
                @if (f.redFlags.length) {
                  <div class="divide-y-[0.5px] divide-border">
                    @for (flag of f.redFlags; track flag.text) {
                      <div class="flex items-start gap-3 py-3.5">
                        <ng-icon
                          name="heroExclamationTriangle"
                          size="0.95rem"
                          class="mt-0.5 shrink-0 text-muted-foreground"
                        />
                        <div class="min-w-0 flex-1">
                          <p class="text-[13px] text-foreground">{{ flag.text }}</p>
                          <p class="mt-0.5 text-[12px] text-muted-foreground">{{ flag.note }}</p>
                        </div>
                        <span
                          class="inline-flex shrink-0 items-center gap-1.5 text-[11px] capitalize text-muted-foreground"
                        >
                          <span
                            class="size-1.5 rounded-full"
                            [style.background]="sevColor(flag.severity)"
                          ></span>
                          {{ flag.severity }}
                        </span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="flex items-center gap-2 py-4 text-[13px] text-muted-foreground">
                    <ng-icon name="heroCheckCircle" size="1rem" class="text-[#16a34a]" />
                    No coherence or background flags found.
                  </div>
                }
              </section>
            } @else {
              <p class="mt-6 text-[13px] text-muted-foreground">
                This founder is queued for evaluation.
              </p>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class EvaluationPage {
  protected readonly data = inject(DataService);
  private readonly evaluation = inject(EvaluationService);
  private readonly route = inject(ActivatedRoute);

  protected readonly circ = 2 * Math.PI * 42;
  protected readonly proofColor = METRIC_COLORS.Proof;
  protected readonly trajColor = METRIC_COLORS.Trajectory;
  protected readonly skillAxes = SKILL_LABELS;

  protected readonly founders = this.data.founders;
  protected readonly selectedId = signal<string>('luis-reindlmeier');
  protected readonly founder = computed<Founder | undefined>(
    () => this.data.founder(this.selectedId()) ?? this.data.hero(),
  );
  protected readonly venture = computed(() => this.data.venture(this.founder()?.ventureId));
  protected readonly team = computed(() => this.venture()?.team);

  // Live streaming state
  protected readonly running = signal(false);
  protected readonly trace = signal<TraceStep[]>([]);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly liveSignals = signal<Receipt[]>([]);
  protected readonly signalCount = signal(0);
  protected readonly liveDone = signal(false);
  private readonly connectorStates = signal<Record<string, string>>({});
  protected readonly liveConnectors = computed(() =>
    Object.entries(this.connectorStates()).map(([id, status]) => ({ id, status })),
  );
  protected readonly liveSources = computed(
    () => new Set(this.liveSignals().map((s) => s.connector)).size,
  );

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const id = params.get('founder');
      if (id && this.data.founder(id)) this.selectedId.set(id);
    });
  }

  protected select(id: string): void {
    this.selectedId.set(id);
    this.resetLive();
  }

  protected metricViews(f: Founder): MetricView[] {
    if (!f.score) return [];
    const s = f.score;
    return [
      {
        key: 'Proof' as Metric,
        color: METRIC_COLORS.Proof,
        score: s.proof,
        caption: CAPTIONS.Proof,
      },
      {
        key: 'Gravity' as Metric,
        color: METRIC_COLORS.Gravity,
        score: s.gravity,
        caption: CAPTIONS.Gravity,
      },
      {
        key: 'Trajectory' as Metric,
        color: METRIC_COLORS.Trajectory,
        score: s.trajectory,
        caption: CAPTIONS.Trajectory,
      },
    ].sort((a, b) => {
      // Trusted metrics first (low-confidence excluded ones last), then by weight.
      const ax = a.score.confidence === 'low' ? 1 : 0;
      const bx = b.score.confidence === 'low' ? 1 : 0;
      return ax - bx || b.score.weight - a.score.weight;
    });
  }

  protected links(f: Founder): { label: string; url: string }[] {
    const out: { label: string; url: string }[] = [];
    if (f.handles.github)
      out.push({ label: 'GitHub', url: `https://github.com/${f.handles.github}` });
    if (f.handles.x) out.push({ label: 'X', url: `https://x.com/${f.handles.x}` });
    if (f.handles.linkedin) out.push({ label: 'LinkedIn', url: f.handles.linkedin });
    if (f.handles.website)
      out.push({ label: f.handles.website, url: `https://${f.handles.website}` });
    return out;
  }

  protected ventureName(f: Founder): string {
    return this.data.venture(f.ventureId)?.name ?? '';
  }

  protected ventureMeta(v: { industry: string; location?: string; foundedYear?: number }): string {
    return [v.industry, v.location, v.foundedYear ? `Founded ${v.foundedYear}` : null]
      .filter(Boolean)
      .join(', ');
  }

  protected routeToHuman(f: Founder): boolean {
    return (
      f.score?.confidence === 'low' || (f.score ? f.score.confidence !== 'high' && !!f.note : false)
    );
  }

  protected humanReason(f: Founder): string {
    return (
      f.note ??
      'Evidence is thin on at least one dimension; a partner should confirm before deciding.'
    );
  }

  protected pct(w: number): number {
    return Math.round(w * 100);
  }
  protected pctOf(x: number): number {
    return Math.round(x * 100);
  }
  protected ordinal(n: number): string {
    const v = n % 100;
    const suffix = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
    return `${n}${suffix}`;
  }

  protected confColor(c: string): string {
    return c === 'high' ? '#16a34a' : c === 'medium' ? '#d97706' : '#dc2626';
  }
  protected sevColor(s: string): string {
    return s === 'high' ? '#dc2626' : s === 'medium' ? '#d97706' : '#a3a3a3';
  }
  protected statusColor(s: string): string {
    return s === 'done' ? '#16a34a' : s === 'error' ? '#dc2626' : '#a3a3a3';
  }
  protected traceColor(t: TraceStep): string {
    if (t.kind === 'done') return '#16a34a';
    if (t.kind === 'gate') return '#d97706';
    return '#737373';
  }
  protected traceGlyph(t: TraceStep): string {
    switch (t.kind) {
      case 'plan':
        return '◆';
      case 'fetch':
        return '↓';
      case 'extract':
        return '✳';
      case 'reduce':
        return 'Σ';
      case 'gate':
        return '⚑';
      case 'calibrate':
        return '⊹';
      case 'done':
        return '✓';
      default:
        return '·';
    }
  }

  protected normalizeUrl(url: string | undefined): string {
    if (!url) return '#';
    return url.startsWith('http') ? url : `https://${url}`;
  }

  private resetLive(): void {
    this.trace.set([]);
    this.connectorStates.set({});
    this.errorMsg.set(null);
    this.liveSignals.set([]);
    this.signalCount.set(0);
    this.liveDone.set(false);
  }

  protected async runLive(f: Founder): Promise<void> {
    if (this.running()) return;
    this.running.set(true);
    this.resetLive();

    const query: FounderQuery = {
      name: f.name,
      github: f.handles.github,
      npm: f.handles.npm,
      pypi: f.handles.pypi,
      x: f.handles.x,
      linkedin: f.handles.linkedin,
      domain: f.handles.website,
    };

    try {
      for await (const ev of this.evaluation.evaluate(query)) {
        this.apply(ev);
      }
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.running.set(false);
    }
  }

  private apply(ev: EvalEvent): void {
    switch (ev.type) {
      case 'trace':
        this.trace.update((t) => [...t, ev.step]);
        break;
      case 'connector':
        this.connectorStates.update((m) => ({ ...m, [ev.connector]: ev.status }));
        break;
      case 'phase':
        this.trace.update((t) => [
          ...t,
          {
            at: now(),
            label: `Fan-out: ${ev.metric}`,
            detail: ev.connectors.join(', '),
            kind: 'fetch',
            metric: ev.metric,
          },
        ]);
        break;
      case 'signal':
        this.liveSignals.update((s) => [...s, ev.signal].slice(-8));
        this.signalCount.update((n) => n + 1);
        break;
      case 'metric':
        // Qualitative only: the live public-signal pass is deliberately more
        // conservative than the calibrated dossier, so we do not surface a
        // competing metric number here.
        this.trace.update((t) => [
          ...t,
          {
            at: now(),
            label: `${ev.score.metric} analysed`,
            detail: `${ev.score.features.length} features`,
            kind: 'reduce',
            metric: ev.score.metric,
          },
        ]);
        break;
      case 'final':
        this.liveDone.set(true);
        this.trace.update((t) => [
          ...t,
          { at: now(), label: 'Reduced, gated and calibrated', kind: 'done' },
        ]);
        break;
      case 'error':
        this.errorMsg.set(ev.message);
        break;
    }
  }
}

function now(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}
