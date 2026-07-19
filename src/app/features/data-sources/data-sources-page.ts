import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroCodeBracket,
  heroArrowDownTray,
  heroCube,
  heroRocketLaunch,
  heroClock,
  heroDocumentText,
  heroAcademicCap,
  heroChatBubbleLeftRight,
  heroHashtag,
  heroBuildingLibrary,
  heroLightBulb,
  heroTrophy,
  heroBriefcase,
  heroBuildingOffice2,
  heroChartBar,
} from '@ng-icons/heroicons/outline';

// ─────────────────────────────────────────────────────────────
// Mock data — hardcoded, typed so it's trivial to edit. Every
// source, the founder metric it feeds, and its connection state.
// Nothing here connects to anything; buttons are visual only.
// ─────────────────────────────────────────────────────────────
type Metric = 'Proof' | 'Gravity' | 'Trajectory';
type Group = 'Connected' | 'Available' | 'Manual input' | 'Not supported';
type Action = 'connected' | 'connect' | 'add-key' | 'paste' | 'unsupported';

interface DataSource {
  readonly name: string;
  readonly icon: string;
  readonly group: Group;
  readonly metrics: readonly Metric[];
  readonly note: string;
  readonly action: Action;
}

const SOURCES: readonly DataSource[] = [
  // Connected
  {
    name: 'GitHub',
    icon: 'heroCodeBracket',
    group: 'Connected',
    metrics: ['Proof', 'Trajectory'],
    note: 'Free · GitHub API',
    action: 'connected',
  },
  {
    name: 'npm downloads',
    icon: 'heroArrowDownTray',
    group: 'Connected',
    metrics: ['Proof'],
    note: 'Free · no auth',
    action: 'connected',
  },
  {
    name: 'PyPI stats',
    icon: 'heroCube',
    group: 'Connected',
    metrics: ['Proof'],
    note: 'Free · no auth',
    action: 'connected',
  },
  {
    name: 'Product Hunt',
    icon: 'heroRocketLaunch',
    group: 'Connected',
    metrics: ['Proof', 'Trajectory'],
    note: 'Free · dev token',
    action: 'connected',
  },
  {
    name: 'Wayback Machine',
    icon: 'heroClock',
    group: 'Connected',
    metrics: ['Trajectory'],
    note: 'Free · Internet Archive',
    action: 'connected',
  },
  {
    name: 'arXiv',
    icon: 'heroDocumentText',
    group: 'Connected',
    metrics: ['Proof'],
    note: 'Free · no auth',
    action: 'connected',
  },
  {
    name: 'Semantic Scholar',
    icon: 'heroAcademicCap',
    group: 'Connected',
    metrics: ['Proof'],
    note: 'Free · no auth',
    action: 'connected',
  },
  {
    name: 'Stack Exchange',
    icon: 'heroChatBubbleLeftRight',
    group: 'Connected',
    metrics: ['Proof'],
    note: 'Free · optional key',
    action: 'connected',
  },
  // Available
  {
    name: 'X (Twitter)',
    icon: 'heroHashtag',
    group: 'Available',
    metrics: ['Gravity', 'Trajectory'],
    note: 'Third-party API · low cost',
    action: 'add-key',
  },
  {
    name: 'Handelsregister',
    icon: 'heroBuildingLibrary',
    group: 'Available',
    metrics: ['Proof'],
    note: 'Third-party API · free tier',
    action: 'connect',
  },
  {
    name: 'Google Patents',
    icon: 'heroLightBulb',
    group: 'Available',
    metrics: ['Proof'],
    note: 'BigQuery · free tier',
    action: 'connect',
  },
  {
    name: 'Devpost',
    icon: 'heroTrophy',
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
    icon: 'heroBuildingOffice2',
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
      heroCodeBracket,
      heroArrowDownTray,
      heroCube,
      heroRocketLaunch,
      heroClock,
      heroDocumentText,
      heroAcademicCap,
      heroChatBubbleLeftRight,
      heroHashtag,
      heroBuildingLibrary,
      heroLightBulb,
      heroTrophy,
      heroBriefcase,
      heroBuildingOffice2,
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
      <div class="mx-auto w-full max-w-2xl px-6 py-8 md:px-8 md:py-10">
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

            <div
              class="mt-3 divide-y-[0.5px] divide-border overflow-hidden rounded-xl border-[0.5px] border-border"
            >
              @for (source of sourcesIn(group); track source.name) {
                <div class="flex items-center gap-4 px-4 py-3.5">
                  <!-- name -->
                  <div class="flex min-w-0 shrink-0 items-center gap-2.5">
                    <ng-icon [name]="source.icon" size="1.05rem" class="text-muted-foreground" />
                    <span class="text-[14px] font-medium text-foreground">{{ source.name }}</span>
                  </div>

                  <!-- metrics -->
                  <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                    @for (metric of source.metrics; track metric) {
                      <span
                        class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {{ metric }}
                      </span>
                    }
                  </div>

                  <!-- access note -->
                  <span class="hidden truncate text-[12px] text-muted-foreground sm:block">
                    {{ source.note }}
                  </span>

                  <!-- status / action -->
                  <div class="ml-auto shrink-0">
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
