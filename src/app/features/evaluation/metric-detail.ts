import { Component, computed, HostListener, input, output, signal } from '@angular/core';
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
  heroArrowTopRightOnSquare,
  heroXMark,
  heroExclamationTriangle,
  heroBuildingLibrary,
} from '@ng-icons/heroicons/outline';
import { CONNECTORS } from '../../core/connectors/descriptors';
import type { ConnectorId } from '../../core/connectors/types';
import type { Metric } from '../../core/metrics';
import type { MetricScore, Receipt } from '../../core/model';

export interface MetricDetailView {
  readonly key: Metric;
  readonly color: string;
  readonly caption: string;
  readonly score: MetricScore;
}

interface SourceGroup {
  readonly id: ConnectorId;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
  readonly items: readonly Receipt[];
}

// Brand marks not carried by the icon sets (mirrors data-sources-page).
const brandLinkedin =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 256 256"><path fill="#0a66c2" d="M218.123 218.127h-37.931v-59.403c0-14.165-.253-32.4-19.728-32.4c-19.756 0-22.779 15.434-22.779 31.369v60.43h-37.93V95.967h36.413v16.694h.51a39.91 39.91 0 0 1 35.928-19.733c38.445 0 45.533 25.288 45.533 58.186zM56.955 79.27c-12.157.002-22.014-9.852-22.016-22.009s9.851-22.014 22.008-22.016c12.157-.003 22.014 9.851 22.016 22.008A22.013 22.013 0 0 1 56.955 79.27m18.966 138.858H37.95V95.967h37.97zM237.033.018H18.89C8.58-.098.125 8.161-.001 18.471v219.053c.122 10.315 8.576 18.582 18.89 18.474h218.144c10.336.128 18.823-8.139 18.966-18.474V18.454c-.147-10.33-8.635-18.588-18.966-18.453"/></svg>';
const brandGoogle =
  '<svg xmlns="http://www.w3.org/2000/svg" width="0.98em" height="1em" viewBox="0 0 256 262"><path fill="#4285f4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/><path fill="#34a853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/><path fill="#fbbc05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"/><path fill="#eb4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/></svg>';
const brandEvertrace =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="-0.6 -0.6 25.64 25.64"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12.4857 0.346619H24.0998V11.9566H19.2231C15.5021 11.9566 12.4857 8.94012 12.4857 5.21912V0.346619ZM11.0155 0.346619L6.13883 0.346619C2.41783 0.346619 -0.598633 3.36308 -0.598633 7.08408L-0.598633 11.9566H4.27805C7.99905 11.9566 11.0155 8.94012 11.0155 5.21912V0.346619ZM12.4857 25.0362H24.0998V13.4262H19.2231C15.5021 13.4262 12.4857 16.4427 12.4857 20.1637V25.0362ZM11.0155 25.0362H6.13883C2.41783 25.0362 -0.598633 22.0197 -0.598633 18.2987L-0.598633 13.4262H4.27805C7.99905 13.4262 11.0155 16.4427 11.0155 20.1637V25.0362Z"/></svg>';

const CONNECTOR_META = new Map(
  CONNECTORS.map((c) => [c.id, { name: c.name, color: c.color, icon: c.icon }]),
);

// A per-metric detail popout: the full score breakdown plus every evidence
// receipt. Sources are selectable logo chips; the history for the active source
// shows below, so many-source metrics stay scannable.
@Component({
  selector: 'app-metric-detail',
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
      heroArrowTopRightOnSquare,
      heroXMark,
      heroExclamationTriangle,
      heroBuildingLibrary,
      brandLinkedin,
      brandGoogle,
      brandEvertrace,
    }),
  ],
  template: `
    <div class="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 md:p-8">
      <button
        type="button"
        aria-label="Close"
        (click)="close.emit()"
        class="fixed inset-0 bg-black/40"
      ></button>

      <div
        role="dialog"
        aria-modal="true"
        class="relative z-10 my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border-[0.5px] border-border bg-popover shadow-elevated"
      >
        <!-- Header -->
        <div class="flex items-start gap-4 border-b-[0.5px] border-border px-6 py-5">
          <div class="relative shrink-0">
            <svg viewBox="0 0 100 100" class="size-20">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e5e5" stroke-width="9" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke-width="9"
                stroke-linecap="round"
                transform="rotate(-90 50 50)"
                [attr.stroke]="v().color"
                [attr.stroke-dasharray]="circ"
                [attr.stroke-dashoffset]="circ * (1 - v().score.score / 100)"
              />
              <text
                x="50"
                y="50"
                text-anchor="middle"
                dominant-baseline="central"
                font-size="30"
                font-weight="600"
                fill="#111"
              >
                {{ v().score.score }}
              </text>
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="font-title text-[20px] leading-tight text-foreground">{{ v().key }}</h2>
            <p class="mt-1 text-[12px] leading-relaxed text-muted-foreground">{{ v().caption }}</p>
            <p class="mt-2 text-[13px] leading-relaxed text-foreground">{{ v().score.rationale }}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            (click)="close.emit()"
            class="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ng-icon name="heroXMark" size="1.1rem" />
          </button>
        </div>

        <div class="flex flex-col gap-6 overflow-y-auto px-6 py-5">
          @if (v().score.confidence === 'low') {
            <div
              class="flex items-start gap-2 rounded-md border-[0.5px] border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
            >
              <ng-icon name="heroExclamationTriangle" size="0.9rem" class="mt-0.5 shrink-0" />
              Low confidence, excluded from the composite until the evidence is verified.
            </div>
          }

          <!-- Score breakdown -->
          <div>
            <p class="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Score breakdown
            </p>
            <div class="flex flex-col gap-2.5">
              @for (ft of v().score.features; track ft.key) {
                <div class="flex items-center gap-3">
                  <span class="w-40 shrink-0 truncate text-[12px] text-foreground" [title]="ft.label">{{
                    ft.label
                  }}</span>
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e5e5e5]">
                    <div
                      class="h-full rounded-full"
                      [style.width.%]="clamp(ft.contribution)"
                      [style.background]="v().color"
                    ></div>
                  </div>
                  <span
                    class="w-24 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground"
                    >{{ ft.display }}</span
                  >
                </div>
              }
            </div>
          </div>

          <!-- Evidence: source chips + active source history -->
          <div>
            <p class="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Evidence by source
            </p>
            @if (groups().length) {
              <div class="flex flex-wrap gap-2">
                @for (g of groups(); track g.id) {
                  <button
                    type="button"
                    (click)="selected.set(g.id)"
                    class="inline-flex items-center gap-2 rounded-full border-[0.5px] px-3 py-1.5 text-[12px] transition-colors"
                    [class]="
                      g.id === activeGroup()?.id
                        ? 'border-foreground bg-accent text-foreground'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    "
                  >
                    <ng-icon [name]="g.icon" size="0.95rem" [style.color]="g.color" />
                    <span>{{ g.name }}</span>
                    <span
                      class="grid size-4 place-items-center rounded-full bg-foreground/10 text-[10px] tabular-nums text-foreground"
                      >{{ g.items.length }}</span
                    >
                  </button>
                }
              </div>

              @if (activeGroup(); as g) {
                <ul
                  class="mt-4 flex flex-col divide-y-[0.5px] divide-border rounded-lg border-[0.5px] border-border"
                >
                  @for (r of g.items; track $index) {
                    <li class="flex items-start gap-3 px-3 py-3">
                      <div class="min-w-0 flex-1">
                        @if (r.feature) {
                          <p class="text-[11px] text-muted-foreground">{{ r.feature }}</p>
                        }
                        <p class="text-[13px] text-foreground">{{ r.text }}</p>
                        @if (r.quote) {
                          <p class="mt-0.5 text-[12px] italic text-muted-foreground">{{ r.quote }}</p>
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
            } @else {
              <p class="text-[13px] text-muted-foreground">
                No public references connected for this dimension yet.
              </p>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class MetricDetail {
  readonly v = input.required<MetricDetailView>();
  readonly close = output<void>();

  protected readonly circ = 2 * Math.PI * 42;
  protected readonly selected = signal<ConnectorId | null>(null);

  protected readonly groups = computed<SourceGroup[]>(() => {
    const receipts = this.v().score.receipts ?? [];
    const map = new Map<ConnectorId, Receipt[]>();
    for (const r of receipts) {
      const arr = map.get(r.connector) ?? [];
      arr.push(r);
      map.set(r.connector, arr);
    }
    return [...map.entries()]
      .map(([id, items]) => {
        const meta = CONNECTOR_META.get(id);
        return {
          id,
          name: meta?.name ?? id,
          color: meta?.color ?? '#a3a3a3',
          icon: meta?.icon ?? 'heroBuildingLibrary',
          items,
        };
      })
      .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  });

  // The selected source, falling back to the largest group when nothing is
  // picked yet or the picked source is not present for this metric.
  protected readonly activeGroup = computed<SourceGroup | null>(() => {
    const gs = this.groups();
    return gs.find((g) => g.id === this.selected()) ?? gs[0] ?? null;
  });

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close.emit();
  }

  protected clamp(x: number): number {
    return Math.max(0, Math.min(100, x));
  }

  protected normalizeUrl(url: string | undefined): string {
    if (!url) return '#';
    return url.startsWith('http') ? url : `https://${url}`;
  }
}
