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
import { heroBuildingLibrary, heroChartBar } from '@ng-icons/heroicons/outline';
import { Metric, METRIC_COLORS } from '../../core/metrics';

// Full-colour brand marks not in the icon sets, so they carry their own fills
// (no `color` tint). LinkedIn and Google (Google Patents is a Google product).
const brandLinkedin =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 256 256"><path fill="#0a66c2" d="M218.123 218.127h-37.931v-59.403c0-14.165-.253-32.4-19.728-32.4c-19.756 0-22.779 15.434-22.779 31.369v60.43h-37.93V95.967h36.413v16.694h.51a39.91 39.91 0 0 1 35.928-19.733c38.445 0 45.533 25.288 45.533 58.186zM56.955 79.27c-12.157.002-22.014-9.852-22.016-22.009s9.851-22.014 22.008-22.016c12.157-.003 22.014 9.851 22.016 22.008A22.013 22.013 0 0 1 56.955 79.27m18.966 138.858H37.95V95.967h37.97zM237.033.018H18.89C8.58-.098.125 8.161-.001 18.471v219.053c.122 10.315 8.576 18.582 18.89 18.474h218.144c10.336.128 18.823-8.139 18.966-18.474V18.454c-.147-10.33-8.635-18.588-18.966-18.453"/></svg>';
const brandGoogle =
  '<svg xmlns="http://www.w3.org/2000/svg" width="0.98em" height="1em" viewBox="0 0 256 262"><path fill="#4285f4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/><path fill="#34a853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/><path fill="#fbbc05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"/><path fill="#eb4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/></svg>';

// Mock data, hardcoded and typed so it's trivial to edit. Every
// source, the founder metric it feeds, and its connection state.
// `icon` is a real brand glyph drawn in the brand's official colour
// via `color`; sources with no real brand mark fall back to a
// neutral heroicon (no `color`).
// Nothing here connects to anything; buttons are visual only.
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
    icon: 'brandGoogle',
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
    icon: 'brandLinkedin',
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
      heroChartBar,
      brandLinkedin,
      brandGoogle,
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
                          class="rounded-full border-[0.5px] px-2 py-0.5 text-[11px] font-medium"
                          [style.color]="metricColors[metric]"
                          [style.borderColor]="metricColors[metric] + '40'"
                          [style.backgroundColor]="metricColors[metric] + '14'"
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
  protected readonly metricColors = METRIC_COLORS;

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
