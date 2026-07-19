import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroArrowTopRightOnSquare,
  heroExclamationTriangle,
  heroBolt,
  heroArrowPath,
} from '@ng-icons/heroicons/outline';
import { METRIC_COLORS } from '../../core/metrics';
import { SectionHeading } from '../../core/ui/section-heading';
import { EvaluationService } from './evaluation.service';
import { FounderQuery, MetricVerdict, Signal } from '../../core/connectors/types';

// ─────────────────────────────────────────────────────────────
// Mock data, hardcoded for now, typed so it swaps 1:1 for a
// real API response later. Nothing below this const fetches.
// ─────────────────────────────────────────────────────────────
type Severity = 'low' | 'medium' | 'high';

interface Metric {
  readonly name: string;
  readonly score: number; // 0–100
  readonly dot: string; // accent, drives the donut ring + title colour
  readonly description: string; // one very short line
}

interface SocialLink {
  readonly label: 'GitHub' | 'X' | 'LinkedIn';
}

interface Company {
  readonly name: string;
  readonly monogram: string;
  readonly role: string;
  readonly tagline: string;
  readonly meta: readonly string[];
  readonly url: string;
}

interface RedFlag {
  readonly text: string;
  readonly note: string;
  readonly severity: Severity;
}

interface Verdict {
  readonly percentile: number;
  readonly comparison: string;
  readonly status: string;
  readonly confidence: string;
}

interface FounderDossier {
  readonly name: string;
  readonly initials: string;
  readonly subtitle: string;
  readonly links: readonly SocialLink[];
  readonly company: Company;
  readonly verdict: Verdict;
  readonly metrics: readonly Metric[]; // order = weight
  readonly redFlags: readonly RedFlag[];
}

const DOSSIER: FounderDossier = {
  name: 'Lena Vogt',
  initials: 'LV',
  subtitle: 'building dev-tooling for X, Berlin, solo',
  links: [{ label: 'GitHub' }, { label: 'X' }, { label: 'LinkedIn' }],
  company: {
    name: 'Torque',
    monogram: 'T',
    role: 'Founder',
    tagline: 'Build-graph-aware CI for large monorepos',
    meta: ['Pre-seed', 'Developer tools', 'Berlin', 'Founded 2025'],
    url: 'torque.dev',
  },
  verdict: {
    percentile: 78,
    comparison: 'vs anchor set, sits next to Guillermo Rauch',
    status: 'Invest',
    confidence: 'Confidence high, no critical flags',
  },
  metrics: [
    { name: 'Proof', score: 74, dot: METRIC_COLORS.Proof, description: 'Ability to ship' },
    { name: 'Gravity', score: 68, dot: METRIC_COLORS.Gravity, description: 'Draws people in' },
    {
      name: 'Trajectory',
      score: 81,
      dot: METRIC_COLORS.Trajectory,
      description: 'Momentum over time',
    },
  ],
  redFlags: [
    { text: 'First-time founder, no prior exit', note: 'Common at this stage', severity: 'low' },
    {
      text: 'Crowded category, several well-funded incumbents',
      note: 'Differentiation still unproven',
      severity: 'medium',
    },
    {
      text: 'No disclosed revenue or design partners yet',
      note: 'Expected pre-seed',
      severity: 'low',
    },
  ],
};

@Component({
  selector: 'app-evaluation-page',
  imports: [NgIcon, SectionHeading],
  viewProviders: [
    provideIcons({ heroArrowTopRightOnSquare, heroExclamationTriangle, heroBolt, heroArrowPath }),
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
      <div class="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
        <!-- 1. Founder header: person is primary, company is context -->
        <header class="flex items-start gap-4">
          <div
            class="grid size-14 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[15px] font-medium text-foreground"
          >
            {{ dossier.initials }}
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="font-title text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground">
              {{ dossier.name }}
            </h1>
            <p class="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {{ dossier.subtitle }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              @for (link of dossier.links; track link.label) {
                <a
                  class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1 text-[12px] text-foreground transition-colors hover:bg-accent"
                >
                  {{ link.label }}
                  <ng-icon
                    name="heroArrowTopRightOnSquare"
                    size="0.8rem"
                    class="text-muted-foreground"
                  />
                </a>
              }
            </div>
          </div>
        </header>

        <!-- 2. Company: the venture this person is affiliated with -->
        <section class="mt-6 rounded-xl border-[0.5px] border-border bg-card p-5">
          <div class="flex items-start gap-4">
            <div
              class="grid size-11 shrink-0 place-items-center rounded-lg bg-foreground text-[15px] font-medium text-background"
            >
              {{ dossier.company.monogram }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 class="text-[15px] font-semibold text-foreground">
                  {{ dossier.company.name }}
                </h2>
                <span
                  class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {{ dossier.company.role }}
                </span>
              </div>
              <p class="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {{ dossier.company.tagline }}
              </p>
              <p class="mt-2 text-[12px] text-muted-foreground">
                {{ dossier.company.meta.join(', ') }}
              </p>
            </div>
            <a
              class="inline-flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {{ dossier.company.url }}
              <ng-icon name="heroArrowTopRightOnSquare" size="0.8rem" />
            </a>
          </div>
        </section>

        <!-- 3. Overall score -->
        <section class="mt-4 rounded-xl border-[0.5px] border-border bg-card p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="mb-2 text-[12px] font-medium text-muted-foreground">aficionado score</p>
              <div class="flex items-baseline gap-1.5">
                <span
                  class="font-title text-[44px] leading-none tracking-[-0.02em] text-foreground"
                >
                  {{ dossier.verdict.percentile }}
                </span>
                <span class="text-[14px] text-muted-foreground">th percentile</span>
              </div>
              <p class="mt-2 text-[13px] text-muted-foreground">{{ dossier.verdict.comparison }}</p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2.5 py-1 text-[12px] font-medium text-foreground"
              >
                <span class="size-1.5 rounded-full bg-[#16a34a]"></span>
                {{ dossier.verdict.status }}
              </span>
              <p class="text-right text-[12px] text-muted-foreground">
                {{ dossier.verdict.confidence }}
              </p>
            </div>
          </div>
        </section>

        <!-- 4. Key criteria: three donuts side by side, order = weight -->
        <app-section-heading title="Key criteria" />
        <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          @for (metric of dossier.metrics; track metric.name) {
            <article class="flex flex-col rounded-xl border-[0.5px] border-border bg-card p-5">
              <svg viewBox="0 0 100 100" class="mx-auto size-28">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e5e5" stroke-width="9" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke-width="9"
                  stroke-linecap="round"
                  transform="rotate(-90 50 50)"
                  [attr.stroke]="metric.dot"
                  [attr.stroke-dasharray]="circumference"
                  [attr.stroke-dashoffset]="circumference * (1 - metric.score / 100)"
                />
                <text
                  x="50"
                  y="50"
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-size="26"
                  font-weight="600"
                  fill="#111111"
                >
                  {{ metric.score }}
                </text>
              </svg>

              <h3 class="mt-4 text-center text-[17px] font-semibold text-foreground">
                {{ metric.name }}
              </h3>
              <p class="mt-1 text-center text-[12px] text-muted-foreground">
                {{ metric.description }}
              </p>
            </article>
          }
        </section>

        <!-- 4b. Proof, live: AI scores this metric from connected sources -->
        <app-section-heading title="Proof, live from sources" />
        <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
          <div class="flex flex-wrap items-end gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-[11px] text-muted-foreground">GitHub handle</span>
              <input
                [value]="github()"
                (input)="github.set($any($event.target).value)"
                placeholder="e.g. gaearon"
                class="h-8 w-40 rounded-md border-[0.5px] border-input bg-surface px-2 text-[13px] outline-none placeholder:text-placeholder focus:border-ring"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] text-muted-foreground">npm author</span>
              <input
                [value]="npm()"
                (input)="npm.set($any($event.target).value)"
                placeholder="e.g. sindresorhus"
                class="h-8 w-40 rounded-md border-[0.5px] border-input bg-surface px-2 text-[13px] outline-none placeholder:text-placeholder focus:border-ring"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[11px] text-muted-foreground">PyPI package</span>
              <input
                [value]="pypi()"
                (input)="pypi.set($any($event.target).value)"
                placeholder="e.g. httpx"
                class="h-8 w-40 rounded-md border-[0.5px] border-input bg-surface px-2 text-[13px] outline-none placeholder:text-placeholder focus:border-ring"
              />
            </label>
            <button
              type="button"
              (click)="runProof()"
              [disabled]="running()"
              class="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <ng-icon
                [name]="running() ? 'heroArrowPath' : 'heroBolt'"
                size="0.9rem"
                [class.animate-spin]="running()"
              />
              {{ running() ? 'Scoring…' : 'Run AI scoring' }}
            </button>
          </div>

          @if (errorMsg(); as err) {
            <p class="mt-3 text-[12px] text-destructive">{{ err }}</p>
          }

          @if (connectorList().length) {
            <div class="mt-4 flex flex-wrap gap-1.5">
              @for (c of connectorList(); track c.id) {
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  <span
                    class="size-1.5 rounded-full"
                    [style.backgroundColor]="statusColor(c.status)"
                  ></span>
                  {{ c.id }}
                </span>
              }
            </div>
          }

          @if (proofSignals().length) {
            <ul class="mt-4 flex flex-col gap-2 border-t-[0.5px] border-border pt-4">
              @for (s of proofSignals(); track $index) {
                <li class="flex items-start gap-2 text-[13px]">
                  <span
                    class="mt-1.5 size-1.5 shrink-0 rounded-full"
                    [style.backgroundColor]="proofColor"
                  ></span>
                  <span class="text-foreground">{{ s.text }}</span>
                </li>
              }
            </ul>
          }

          @if (verdict(); as v) {
            <div class="mt-4 flex items-center gap-3 border-t-[0.5px] border-border pt-4">
              <span class="font-title text-[32px] leading-none" [style.color]="proofColor">{{
                v.score
              }}</span>
              <div class="min-w-0">
                <p class="text-[13px] text-foreground">{{ v.rationale }}</p>
                <p class="mt-0.5 text-[11px] text-muted-foreground">
                  Scored by {{ v.by === 'ai' ? 'AI (Claude)' : 'heuristic fallback' }}
                </p>
              </div>
            </div>
          }
        </section>

        <!-- 5. Potential red flags -->
        <app-section-heading title="Potential red flags" />
        <section
          class="divide-y-[0.5px] divide-border rounded-xl border-[0.5px] border-border bg-card px-5"
        >
          @for (flag of dossier.redFlags; track flag.text) {
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
                  [style.backgroundColor]="severityColor(flag.severity)"
                ></span>
                {{ flag.severity }}
              </span>
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class EvaluationPage {
  private readonly evaluation = inject(EvaluationService);

  protected readonly dossier = DOSSIER;
  protected readonly circumference = 2 * Math.PI * 40;
  protected readonly proofColor = METRIC_COLORS.Proof;

  // Live Proof scoring state, streamed from /api/evaluate.
  protected readonly github = signal('');
  protected readonly npm = signal('');
  protected readonly pypi = signal('');
  protected readonly running = signal(false);
  protected readonly proofSignals = signal<Signal[]>([]);
  protected readonly verdict = signal<MetricVerdict | null>(null);
  protected readonly errorMsg = signal<string | null>(null);
  private readonly connectorStates = signal<Record<string, string>>({});
  protected readonly connectorList = computed(() =>
    Object.entries(this.connectorStates()).map(([id, status]) => ({ id, status })),
  );

  protected async runProof(): Promise<void> {
    if (this.running()) return;
    this.running.set(true);
    this.proofSignals.set([]);
    this.connectorStates.set({});
    this.verdict.set(null);
    this.errorMsg.set(null);

    const query: FounderQuery = {
      name: this.dossier.name,
      github: this.github().trim() || undefined,
      npm: this.npm().trim() || undefined,
      pypi: this.pypi().trim() || undefined,
    };

    try {
      for await (const event of this.evaluation.scoreProof(query)) {
        switch (event.type) {
          case 'signal':
            this.proofSignals.update((list) => [...list, event.signal]);
            break;
          case 'connector':
            this.connectorStates.update((map) => ({ ...map, [event.connector]: event.status }));
            break;
          case 'verdict':
            this.verdict.set(event.verdict);
            break;
          case 'error':
            this.errorMsg.set(event.message);
            break;
        }
      }
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.running.set(false);
    }
  }

  protected statusColor(status: string): string {
    if (status === 'done') return '#16a34a';
    if (status === 'error') return '#dc2626';
    return '#a3a3a3';
  }

  protected severityColor(severity: Severity): string {
    switch (severity) {
      case 'high':
        return '#dc2626';
      case 'medium':
        return '#d97706';
      default:
        return '#a3a3a3';
    }
  }
}
