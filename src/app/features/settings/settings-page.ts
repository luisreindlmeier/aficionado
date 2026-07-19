import { Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroLockClosed } from '@ng-icons/heroicons/outline';
import { SectionHeading } from '../../core/ui/section-heading';
import { DataService } from '../../core/data/data.service';
import { METRIC_COLORS, type Metric } from '../../core/metrics';

interface ApiKeyInfo {
  readonly name: string;
  readonly description: string;
}

const METRICS: readonly Metric[] = ['Proof', 'Gravity', 'Trajectory'];

const API_KEYS: readonly ApiKeyInfo[] = [
  {
    name: 'AI_GATEWAY_API_KEY',
    description:
      'Vercel AI Gateway key that powers live founder scoring. Falls back to a deterministic heuristic when absent.',
  },
  {
    name: 'GITHUB_TOKEN',
    description: 'Raises GitHub API rate limits for the Proof and Trajectory connectors.',
  },
  {
    name: 'PRODUCT_HUNT_TOKEN',
    description: 'Reads launch history and upvotes for the Gravity signal.',
  },
  {
    name: 'X_API_KEY',
    description: 'Pulls follower reach and amplification from X for Gravity.',
  },
  {
    name: 'OPENREGISTER_KEY',
    description: 'Verifies company registration and founding dates via the Handelsregister.',
  },
  {
    name: 'SUPABASE_URL',
    description: 'Project URL for the store that persists founders, ventures and scores.',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    description: 'Server-side Supabase key used to write evaluation results.',
  },
];

@Component({
  selector: 'app-settings-page',
  imports: [NgIcon, SectionHeading],
  viewProviders: [provideIcons({ heroLockClosed })],
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
        <header>
          <h1
            class="font-title text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground md:text-[28px]"
          >
            Settings
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Tune how founders are weighted and scored, and review what the backend is connected to.
          </p>
        </header>

        <!-- (a) Metric weights -->
        <app-section-heading title="Metric weights" />
        <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
          <div class="flex flex-wrap gap-2">
            @for (preset of presets; track preset.id) {
              <button
                type="button"
                (click)="data.setPreset(preset.id)"
                class="rounded-full border-[0.5px] px-3 py-1 text-[12px] font-medium transition-colors"
                [class]="
                  data.presetId() === preset.id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-foreground hover:bg-accent'
                "
              >
                {{ preset.label }}
              </button>
            }
          </div>

          <p class="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            {{ activePresetDescription() }}
          </p>

          <div class="mt-5 flex flex-col gap-4">
            @for (metric of metrics; track metric) {
              <div>
                <div class="flex items-center justify-between">
                  <span class="inline-flex items-center gap-2 text-[13px] text-foreground">
                    <span
                      class="size-2 rounded-full"
                      [style.backgroundColor]="metricColors[metric]"
                    ></span>
                    {{ metric }}
                  </span>
                  <span class="font-title text-[14px] text-foreground">{{ weightPct(metric) }}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  [value]="sliderValue(metric)"
                  (input)="onWeight(metric, $any($event.target).value)"
                  [style.accentColor]="metricColors[metric]"
                  class="mt-2 w-full"
                />
              </div>
            }
          </div>

          <p class="mt-5 border-t-[0.5px] border-border pt-4 text-[12px] leading-relaxed text-muted-foreground">
            Changing weights re-ranks the whole pipeline live. Current top founder:
            <span class="text-foreground">{{ topFounderName() }}</span>.
          </p>
        </section>

        <!-- (b) Sourcing thesis -->
        <app-section-heading title="Sourcing thesis" />
        <section class="flex flex-col gap-2">
          <button
            type="button"
            (click)="data.setThesis('all')"
            class="flex items-start gap-3 rounded-xl border-[0.5px] p-4 text-left transition-colors"
            [class]="
              data.activeThesisId() === 'all'
                ? 'border-foreground bg-surface'
                : 'border-border hover:bg-accent'
            "
          >
            <span
              class="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-[0.5px]"
              [class]="data.activeThesisId() === 'all' ? 'border-foreground' : 'border-input'"
            >
              @if (data.activeThesisId() === 'all') {
                <span class="size-2 rounded-full bg-foreground"></span>
              }
            </span>
            <div class="min-w-0">
              <p class="text-[13px] font-medium text-foreground">All theses</p>
              <p class="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                Show founders sourced under every thesis.
              </p>
            </div>
          </button>

          @for (thesis of data.theses(); track thesis.id) {
            <button
              type="button"
              (click)="data.setThesis(thesis.id)"
              class="flex items-start gap-3 rounded-xl border-[0.5px] p-4 text-left transition-colors"
              [class]="
                data.activeThesisId() === thesis.id
                  ? 'border-foreground bg-surface'
                  : 'border-border hover:bg-accent'
              "
            >
              <span
                class="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-[0.5px]"
                [class]="data.activeThesisId() === thesis.id ? 'border-foreground' : 'border-input'"
              >
                @if (data.activeThesisId() === thesis.id) {
                  <span class="size-2 rounded-full bg-foreground"></span>
                }
              </span>
              <div class="min-w-0">
                <p class="text-[13px] font-medium text-foreground">{{ thesis.label }}</p>
                <p class="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  {{ thesis.description }}
                </p>
                @if (thesis.keywords.length) {
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    @for (keyword of thesis.keywords; track keyword) {
                      <span
                        class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground"
                      >
                        {{ keyword }}
                      </span>
                    }
                  </div>
                }
              </div>
            </button>
          }
        </section>

        <!-- (c) API keys -->
        <app-section-heading title="API keys" />
        <p class="-mt-2 mb-4 text-[12px] leading-relaxed text-muted-foreground">
          Configured server-side and read-only here. Secrets never touch the browser, this is only an
          overview of what the backend expects.
        </p>
        <section class="divide-y-[0.5px] divide-border rounded-xl border-[0.5px] border-border bg-card px-5">
          @for (key of apiKeys; track key.name) {
            <div class="flex items-start justify-between gap-4 py-4">
              <div class="min-w-0 flex-1">
                <p class="font-mono text-[12px] font-medium text-foreground">{{ key.name }}</p>
                <p class="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {{ key.description }}
                </p>
                <p class="mt-1 text-[11px] text-muted-foreground">Set in .env / Vercel</p>
              </div>
              <span
                class="inline-flex shrink-0 items-center gap-1.5 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground"
              >
                <ng-icon name="heroLockClosed" size="0.7rem" class="text-muted-foreground" />
                Server-side
              </span>
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class SettingsPage {
  protected readonly data = inject(DataService);
  protected readonly presets = this.data.presets;
  protected readonly metrics = METRICS;
  protected readonly metricColors = METRIC_COLORS;
  protected readonly apiKeys = API_KEYS;

  protected weightPct(metric: Metric): number {
    const w = this.data.weights();
    const total = w.Proof + w.Gravity + w.Trajectory || 1;
    return Math.round((w[metric] / total) * 100);
  }

  protected sliderValue(metric: Metric): number {
    return Math.round(this.data.weights()[metric] * 100);
  }

  protected onWeight(metric: Metric, value: string): void {
    this.data.setWeight(metric, Number(value) / 100);
  }

  protected activePresetDescription(): string {
    const preset = this.presets.find((p) => p.id === this.data.presetId());
    return preset?.description ?? 'Custom weighting. Drag any metric to shape your own ranking.';
  }

  protected topFounderName(): string {
    return this.data.decisions()[0]?.founder.name ?? 'none yet';
  }
}
