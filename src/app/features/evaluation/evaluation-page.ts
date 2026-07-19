import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowTopRightOnSquare, heroExclamationTriangle } from '@ng-icons/heroicons/outline';

// ─────────────────────────────────────────────────────────────
// Mock data, hardcoded for now, typed so it swaps 1:1 for a
// real API response later. Nothing below this const fetches.
// ─────────────────────────────────────────────────────────────
type Source = 'GitHub' | 'X' | 'LinkedIn' | 'Wayback';
type Severity = 'low' | 'medium' | 'high';

interface Evidence {
  readonly text: string;
  readonly source: Source;
}

interface Metric {
  readonly name: string;
  readonly score: number; // 0–100
  readonly dot: string; // accent, also drives the donut ring
  readonly evidence: readonly Evidence[];
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
    {
      name: 'Proof',
      score: 74,
      dot: '#14b8a6',
      evidence: [
        { text: 'Shipped 3 products end-to-end', source: 'GitHub' },
        { text: 'Repos starred by senior infra engineers', source: 'GitHub' },
      ],
    },
    {
      name: 'Gravity',
      score: 68,
      dot: '#8b5cf6',
      evidence: [
        { text: 'Followed by 5 notable founders', source: 'X' },
        { text: 'Recruited co-founder: ex-Stripe staff eng', source: 'LinkedIn' },
      ],
    },
    {
      name: 'Trajectory',
      score: 81,
      dot: '#fb7185',
      evidence: [
        { text: 'Shipping cadence 3× in 6 months', source: 'GitHub' },
        { text: 'Clean pivot after v1', source: 'Wayback' },
      ],
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
  imports: [NgIcon],
  viewProviders: [provideIcons({ heroArrowTopRightOnSquare, heroExclamationTriangle })],
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
            <h1 class="font-serif text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground">
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
                <h2 class="text-[15px] font-semibold text-foreground">{{ dossier.company.name }}</h2>
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
              <div class="flex items-baseline gap-1.5">
                <span
                  class="font-serif text-[44px] leading-none tracking-[-0.02em] text-foreground"
                >
                  {{ dossier.verdict.percentile }}
                </span>
                <span class="text-[14px] text-muted-foreground">th percentile</span>
              </div>
              <p class="mt-2 text-[13px] text-muted-foreground">{{ dossier.verdict.comparison }}</p>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-[#16a34a]/25 bg-[#16a34a]/10 px-2.5 py-1 text-[12px] font-medium text-[#15803d]"
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
        <p class="af-eyebrow mt-8 mb-3">Key criteria</p>
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

              <div class="mt-3 flex items-center justify-center gap-2">
                <span class="size-2 rounded-full" [style.backgroundColor]="metric.dot"></span>
                <span class="text-[14px] font-medium text-foreground">{{ metric.name }}</span>
              </div>

              <div class="mt-4 flex flex-col gap-3 border-t-[0.5px] border-border pt-4">
                @for (ev of metric.evidence; track ev.text) {
                  <div>
                    <p class="text-[12px] leading-snug text-foreground">{{ ev.text }}</p>
                    <div class="mt-1 flex items-center gap-1.5">
                      <span
                        class="rounded-full border-[0.5px] border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {{ ev.source }}
                      </span>
                      <a class="text-muted-foreground transition-colors hover:text-foreground">
                        <ng-icon name="heroArrowTopRightOnSquare" size="0.75rem" />
                      </a>
                    </div>
                  </div>
                }
              </div>
            </article>
          }
        </section>

        <!-- 5. Potential red flags -->
        <p class="af-eyebrow mt-8 mb-3">Potential red flags</p>
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
  protected readonly dossier = DOSSIER;
  protected readonly circumference = 2 * Math.PI * 40;

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
