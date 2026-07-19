import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroArrowTopRightOnSquare } from '@ng-icons/heroicons/outline';

// ─────────────────────────────────────────────────────────────
// Mock data — hardcoded for now, typed so it swaps 1:1 for a
// real API response later. Nothing below this const fetches.
// ─────────────────────────────────────────────────────────────
type Source = 'GitHub' | 'X' | 'LinkedIn' | 'Wayback';

interface Evidence {
  readonly text: string;
  readonly source: Source;
}

interface Metric {
  readonly name: string;
  readonly score: number; // 0–100
  readonly dot: string; // tiny distinguishing dot only
  readonly evidence: readonly Evidence[];
}

interface SocialLink {
  readonly label: 'GitHub' | 'X' | 'LinkedIn';
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
  readonly verdict: Verdict;
  readonly metrics: readonly Metric[]; // order = weight
}

const DOSSIER: FounderDossier = {
  name: 'Lena Vogt',
  initials: 'LV',
  subtitle: 'building dev-tooling for X · Berlin · solo',
  links: [{ label: 'GitHub' }, { label: 'X' }, { label: 'LinkedIn' }],
  verdict: {
    percentile: 78,
    comparison: 'vs anchor set · sits next to Guillermo Rauch',
    status: 'Invest',
    confidence: 'Confidence high · no red flags',
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
};

@Component({
  selector: 'app-evaluation-page',
  imports: [NgIcon],
  viewProviders: [provideIcons({ heroArrowTopRightOnSquare })],
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
        <!-- 1 · Founder header — person is primary, company is context -->
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

        <!-- 2 · Verdict -->
        <section class="mt-6 rounded-xl border-[0.5px] border-border bg-card p-5">
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

        <!-- 3 · Metric cards — stacked, order = weight -->
        <section class="mt-4 flex flex-col gap-4">
          @for (metric of dossier.metrics; track metric.name) {
            <article class="rounded-xl border-[0.5px] border-border bg-card p-5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="size-2 rounded-full" [style.backgroundColor]="metric.dot"></span>
                  <span class="text-[14px] font-medium text-foreground">{{ metric.name }}</span>
                </div>
                <div class="text-[13px] text-muted-foreground">
                  <span class="font-medium text-foreground">{{ metric.score }}</span
                  >/100
                </div>
              </div>

              <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#e5e5e5]">
                <div class="h-full rounded-full bg-[#404040]" [style.width.%]="metric.score"></div>
              </div>

              <div class="mt-4 flex flex-col gap-2.5">
                @for (ev of metric.evidence; track ev.text) {
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-[13px] text-foreground">{{ ev.text }}</span>
                    <div class="flex shrink-0 items-center gap-1.5">
                      <span
                        class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {{ ev.source }}
                      </span>
                      <a class="text-muted-foreground transition-colors hover:text-foreground">
                        <ng-icon name="heroArrowTopRightOnSquare" size="0.85rem" />
                      </a>
                    </div>
                  </div>
                }
              </div>
            </article>
          }
        </section>
      </div>
    </div>
  `,
})
export class EvaluationPage {
  protected readonly dossier = DOSSIER;
}
