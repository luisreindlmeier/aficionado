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
import { heroBuildingLibrary, heroCheck } from '@ng-icons/heroicons/outline';
import { CONNECTORS } from '../../core/connectors/descriptors';
import { ActionKind, ConnectorDescriptor, Group } from '../../core/connectors/types';

// Brand marks not carried by the icon sets, taken from each company's own assets.
// LinkedIn and Google carry their own fills (multi-colour); Evertrace is a
// monochrome glyph drawn in `currentColor`, so it is tinted via `color`.
const brandLinkedin =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 256 256"><path fill="#0a66c2" d="M218.123 218.127h-37.931v-59.403c0-14.165-.253-32.4-19.728-32.4c-19.756 0-22.779 15.434-22.779 31.369v60.43h-37.93V95.967h36.413v16.694h.51a39.91 39.91 0 0 1 35.928-19.733c38.445 0 45.533 25.288 45.533 58.186zM56.955 79.27c-12.157.002-22.014-9.852-22.016-22.009s9.851-22.014 22.008-22.016c12.157-.003 22.014 9.851 22.016 22.008A22.013 22.013 0 0 1 56.955 79.27m18.966 138.858H37.95V95.967h37.97zM237.033.018H18.89C8.58-.098.125 8.161-.001 18.471v219.053c.122 10.315 8.576 18.582 18.89 18.474h218.144c10.336.128 18.823-8.139 18.966-18.474V18.454c-.147-10.33-8.635-18.588-18.966-18.453"/></svg>';
const brandGoogle =
  '<svg xmlns="http://www.w3.org/2000/svg" width="0.98em" height="1em" viewBox="0 0 256 262"><path fill="#4285f4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/><path fill="#34a853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/><path fill="#fbbc05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"/><path fill="#eb4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/></svg>';
const brandEvertrace =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="-0.6 -0.6 25.64 25.64"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12.4857 0.346619H24.0998V11.9566H19.2231C15.5021 11.9566 12.4857 8.94012 12.4857 5.21912V0.346619ZM11.0155 0.346619L6.13883 0.346619C2.41783 0.346619 -0.598633 3.36308 -0.598633 7.08408L-0.598633 11.9566H4.27805C7.99905 11.9566 11.0155 8.94012 11.0155 5.21912V0.346619ZM12.4857 25.0362H24.0998V13.4262H19.2231C15.5021 13.4262 12.4857 16.4427 12.4857 20.1637V25.0362ZM11.0155 25.0362H6.13883C2.41783 25.0362 -0.598633 22.0197 -0.598633 18.2987L-0.598633 13.4262H4.27805C7.99905 13.4262 11.0155 16.4427 11.0155 20.1637V25.0362Z"/></svg>';

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
      heroCheck,
      brandLinkedin,
      brandGoogle,
      brandEvertrace,
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
            class="font-title text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground md:text-[28px]"
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
              @for (source of sourcesIn(group); track source.id) {
                <div
                  class="flex flex-col gap-3 rounded-xl border-[0.5px] border-border bg-card p-4"
                >
                  <!-- header: logo + name/domain, status top-right -->
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex min-w-0 items-center gap-3">
                      <ng-icon
                        [name]="source.icon"
                        size="1.5rem"
                        class="shrink-0"
                        [class.text-muted-foreground]="!source.color"
                        [style.color]="source.color"
                      />
                      <div class="min-w-0">
                        <p class="truncate text-[14px] font-medium text-foreground">
                          {{ source.name }}
                        </p>
                        <p class="truncate text-[12px] text-muted-foreground">
                          {{ source.domain }}
                        </p>
                      </div>
                    </div>

                    <div class="shrink-0">
                      @switch (source.action) {
                        @case ('connected') {
                          <span
                            title="Connected"
                            class="grid size-7 place-items-center rounded-full border border-success/40 text-success"
                          >
                            <ng-icon name="heroCheck" size="0.95rem" />
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

                  <!-- metrics -->
                  @if (source.metrics.length) {
                    <div class="flex flex-wrap items-center gap-1.5">
                      @for (metric of source.metrics; track metric) {
                        <span
                          class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] font-medium text-foreground"
                        >
                          {{ metric }}
                        </span>
                      }
                    </div>
                  }

                  <!-- description + access note -->
                  <div class="mt-auto">
                    <p class="text-[12px] leading-relaxed text-foreground">
                      {{ source.description }}
                    </p>
                    <p class="mt-1 text-[11px] text-muted-foreground">{{ source.note }}</p>
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

  protected sourcesIn(group: Group): readonly ConnectorDescriptor[] {
    return CONNECTORS.filter((source) => source.group === group);
  }

  protected actionLabel(action: ActionKind): string {
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
