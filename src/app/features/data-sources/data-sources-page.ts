import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  simpleGithub,
  simpleNpm,
  simplePypi,
  simpleProducthunt,
  simpleInternetarchive,
  simpleArxiv,
  simpleSemanticscholar,
  simpleStackexchange,
  simpleX,
  simpleDevpost,
  simpleCrunchbase,
} from '@ng-icons/simple-icons';
import {
  heroBuildingLibrary,
  heroLightBulb,
  heroBriefcase,
  heroChartBar,
} from '@ng-icons/heroicons/outline';

// ─────────────────────────────────────────────────────────────
// Mock data, hardcoded and typed so it's trivial to edit. Every
// source, the founder metric it feeds, and its connection state.
// `icon` is a real brand glyph (@ng-icons/simple-icons) drawn in
// the brand's official colour via `color`; sources with no real
// brand mark fall back to a neutral heroicon (no `color`).
// Nothing here connects to anything; buttons are visual only.
// ─────────────────────────────────────────────────────────────
type Metric = 'Proof' | 'Gravity' | 'Trajectory';
type Group = 'Connected' | 'Available' | 'Manual input' | 'Not supported';
type Action = 'connected' | 'connect' | 'add-key' | 'paste' | 'unsupported';

interface DataSource {
  readonly name: string;
  readonly icon: string;
  /** Official brand colour; omit for neutral heroicon fallbacks. */
  readonly color?: string;
  readonly group: Group;
  readonly metrics: readonly Metric[];
  readonly note: string;
  readonly action: Action;
}

const SOURCES: readonly DataSource[] = [
  // Connected
  {
    name: 'GitHub',
    icon: 'simpleGithub',
    color: '#181717',
    group: 'Connected',
    metrics: ['Proof', 'Trajectory'],
    note: 'Free, GitHub API',
    action: 'connected',
  },
  {
    name: 'npm downloads',
    icon: 'simpleNpm',
    color: '#CB3837',
    group: 'Connected',
    metrics: ['Proof'],
    note: 'Free, no auth',
    action: 'connected',
  },
  {
    name: 'PyPI stats',
    icon: 'simplePypi',
    color: '#3775A9',
    group: 'Connected',
    metrics: ['Proof'],
    note: 'Free, no auth',
    action: 'connected',
  },
  {
    name: 'Product Hunt',
    icon: 'simpleProducthunt',
    color: '#DA552F',
    group: 'Connected',
    metrics: ['Proof', 'Trajectory'],
    note: 'Free, dev token',
    action: 'connected',
  },
  {
    name: 'Wayback Machine',
    icon: 'simpleInternetarchive',
    color: '#666666',
    group: 'Connected',
    metrics: ['Trajectory'],
    note: 'Free, Internet Archive',
    action: 'connected',
  },
  {
    name: 'arXiv',
    icon: 'simpleArxiv',
    color: '#B31B1B',
    group: 'Connected',
    metrics: ['Proof'],
    note: 'Free, no auth',
    action: 'connected',
  },
  {
    name: 'Semantic Scholar',
    icon: 'simpleSemanticscholar',
    color: '#1857B6',
    group: 'Connected',
    metrics: ['Proof'],
    note: 'Free, no auth',
    action: 'connected',
  },
  {
    name: 'Stack Exchange',
    icon: 'simpleStackexchange',
    color: '#1E5397',
    group: 'Connected',
    metrics: ['Proof'],
    note: 'Free, optional key',
    action: 'connected',
  },
  // Available
  {
    name: 'X (Twitter)',
    icon: 'simpleX',
    color: '#000000',
    group: 'Available',
    metrics: ['Gravity', 'Trajectory'],
    note: 'Third-party API, low cost',
    action: 'add-key',
  },
  {
    name: 'Handelsregister',
    icon: 'heroBuildingLibrary',
    group: 'Available',
    metrics: ['Proof'],
    note: 'Third-party API, free tier',
    action: 'connect',
  },
  {
    name: 'Google Patents',
    icon: 'heroLightBulb',
    group: 'Available',
    metrics: ['Proof'],
    note: 'BigQuery, free tier',
    action: 'connect',
  },
  {
    name: 'Devpost',
    icon: 'simpleDevpost',
    color: '#003E54',
    group: 'Available',
    metrics: ['Proof'],
    note: 'Scrape / RSS',
    action: 'connect',
  },
  // Manual input
  {
    name: 'LinkedIn',
    icon: 'heroBriefcase',
    group: 'Manual input',
    metrics: ['Proof', 'Gravity'],
    note: 'Paste profile (no scraping)',
    action: 'paste',
  },
  // Not supported
  {
    name: 'Crunchbase',
    icon: 'simpleCrunchbase',
    color: '#0288D1',
    group: 'Not supported',
    metrics: [],
    note: 'Enterprise license only',
    action: 'unsupported',
  },
  {
    name: 'Evertrace',
    icon: 'heroChartBar',
    group: 'Not supported',
    metrics: [],
    note: 'Sales-gated',
    action: 'unsupported',
  },
];

const GROUP_ORDER: readonly Group[] = ['Connected', 'Available', 'Manual input', 'Not supported'];

@Component({
  selector: 'app-data-sources-page',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      simpleGithub,
      simpleNpm,
      simplePypi,
      simpleProducthunt,
      simpleInternetarchive,
      simpleArxiv,
      simpleSemanticscholar,
      simpleStackexchange,
      simpleX,
      simpleDevpost,
      simpleCrunchbase,
      heroBuildingLibrary,
      heroLightBulb,
      heroBriefcase,
      heroChartBar,
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
    <div class="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div class="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
        <header>
          <h1
            class="font-serif text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground md:text-[28px]"
          >
            Data sources
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            What's connected and pulled to score founders.
          </p>
        </header>

        @for (group of groupOrder; track group) {
          <section class="mt-8">
            <h2 class="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              {{ group }}
            </h2>

            <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              @for (source of sourcesIn(group); track source.name) {
                <div
                  class="flex flex-col gap-3 rounded-xl border-[0.5px] border-border bg-card p-4"
                >
                  <!-- brand + name -->
                  <div class="flex items-center gap-2.5">
                    <ng-icon
                      [name]="source.icon"
                      size="1.15rem"
                      class="shrink-0"
                      [class.text-muted-foreground]="!source.color"
                      [style.color]="source.color"
                    />
                    <span class="min-w-0 truncate text-[14px] font-medium text-foreground">
                      {{ source.name }}
                    </span>
                  </div>

                  <!-- metrics -->
                  @if (source.metrics.length) {
                    <div class="flex flex-wrap items-center gap-1.5">
                      @for (metric of source.metrics; track metric) {
                        <span
                          class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {{ metric }}
                        </span>
                      }
                    </div>
                  }

                  <!-- note + status, pinned to the bottom for equal-height tiles -->
                  <div class="mt-auto flex items-center justify-between gap-2 pt-1">
                    <span class="min-w-0 truncate text-[12px] text-muted-foreground">
                      {{ source.note }}
                    </span>
                    <div class="shrink-0">
                      @switch (source.action) {
                        @case ('connected') {
                          <span
                            class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2.5 py-1 text-[12px] text-muted-foreground"
                          >
                            <span class="size-1.5 rounded-full bg-success"></span>
                            Connected
                          </span>
                        }
                        @case ('unsupported') {
                          <span class="text-[12px] text-muted-foreground">Not supported</span>
                        }
                        @default {
                          <button
                            type="button"
                            class="rounded-full border-[0.5px] border-border px-3 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
                          >
                            {{ actionLabel(source.action) }}
                          </button>
                        }
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </section>
        }
      </div>
    </div>
  `,
})
export class DataSourcesPage {
  protected readonly groupOrder = GROUP_ORDER;

  protected sourcesIn(group: Group): readonly DataSource[] {
    return SOURCES.filter((source) => source.group === group);
  }

  protected actionLabel(action: Action): string {
    switch (action) {
      case 'connect':
        return 'Connect';
      case 'add-key':
        return 'Add key';
      case 'paste':
        return 'Paste';
      default:
        return '';
    }
  }
}
