import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroMagnifyingGlass,
  heroAcademicCap,
  heroSignal,
  heroRectangleStack,
  heroScale,
  heroClipboardDocumentCheck,
  heroDocumentMagnifyingGlass,
  heroCpuChip,
  heroCircleStack,
  heroCog6Tooth,
  heroArrowUpRight,
} from '@ng-icons/heroicons/outline';
import { CommandPaletteService } from '../command-palette.service';
import { TourService } from '../tour/tour.service';
import { DataService } from '../data/data.service';
import { NAV_GROUPS } from '../nav';

interface Result {
  readonly kind: 'page' | 'founder' | 'action';
  readonly label: string;
  readonly sub: string;
  readonly icon?: string;
  readonly initials?: string;
  readonly run: () => void;
  i: number;
}

interface ResultGroup {
  readonly label: string;
  readonly items: readonly Result[];
}

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** Global command palette (⌘K / Ctrl+K or the header search): search pages and
 *  founders, run quick actions, navigate with the keyboard. */
@Component({
  selector: 'app-command-palette',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      heroMagnifyingGlass,
      heroAcademicCap,
      heroSignal,
      heroRectangleStack,
      heroScale,
      heroClipboardDocumentCheck,
      heroDocumentMagnifyingGlass,
      heroCpuChip,
      heroCircleStack,
      heroCog6Tooth,
      heroArrowUpRight,
    }),
  ],
  template: `
    @if (palette.open()) {
      <div class="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[14vh]">
        <button
          type="button"
          aria-label="Close"
          class="absolute inset-0 cursor-default bg-black/40"
          (click)="close()"
        ></button>

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          class="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-popover shadow-elevated"
        >
          <!-- search input -->
          <div class="flex items-center gap-2.5 px-4 py-3.5">
            <ng-icon name="heroMagnifyingGlass" class="shrink-0 text-muted-foreground" />
            <input
              #searchInput
              type="text"
              [value]="query()"
              (input)="onInput($event)"
              (keydown)="onInputKeydown($event)"
              placeholder="Search pages and founders…"
              autocomplete="off"
              spellcheck="false"
              class="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-placeholder"
            />
          </div>

          <div class="border-t border-border"></div>

          <!-- results -->
          <div class="max-h-[50vh] overflow-y-auto p-2">
            @if (groups().length) {
              @for (g of groups(); track g.label) {
                <p class="af-eyebrow px-2.5 pt-2 pb-1">{{ g.label }}</p>
                @for (it of g.items; track it.label) {
                  <button
                    type="button"
                    (mouseenter)="active.set(it.i)"
                    (click)="run(it)"
                    class="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left"
                    [class.bg-accent]="it.i === active()"
                  >
                    @if (it.initials) {
                      <span
                        class="grid size-6 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[10px] font-medium text-foreground"
                        >{{ it.initials }}</span
                      >
                    } @else {
                      <ng-icon
                        [name]="it.icon ?? 'heroArrowUpRight'"
                        class="shrink-0 text-muted-foreground"
                      />
                    }
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-[14px] text-foreground">{{ it.label }}</span>
                      <span class="block truncate text-[12px] text-muted-foreground">{{
                        it.sub
                      }}</span>
                    </span>
                    @if (it.i === active()) {
                      <span class="shrink-0 text-[11px] text-muted-foreground">↵</span>
                    }
                  </button>
                }
              }
            } @else {
              <p class="px-2.5 py-6 text-center text-[13px] text-muted-foreground">
                No matches for “{{ query() }}”.
              </p>
            }
          </div>

          <div class="border-t border-border"></div>

          <!-- footer: keyboard hints -->
          <div
            class="flex items-center justify-between px-4 py-2.5 text-[12px] text-muted-foreground"
          >
            <div class="flex items-center gap-4">
              <span class="flex items-center gap-1.5">
                <kbd class="{{ kbd }}">↑</kbd>
                <kbd class="{{ kbd }}">↓</kbd>
                <span>Navigate</span>
              </span>
              <span class="flex items-center gap-1.5">
                <kbd class="{{ kbd }}">↵</kbd>
                <span>Open</span>
              </span>
            </div>
            <span class="flex items-center gap-1.5">
              <kbd class="{{ kbd }}">ESC</kbd>
              <span>Close</span>
            </span>
          </div>
        </div>
      </div>
    }
  `,
})
export class CommandPalette {
  protected readonly palette = inject(CommandPaletteService);
  private readonly router = inject(Router);
  private readonly data = inject(DataService);
  private readonly tour = inject(TourService);

  protected readonly query = signal('');
  protected readonly active = signal(0);
  protected readonly kbd =
    'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface px-1 text-[11px] font-medium text-muted-foreground';

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** Grouped results, computed from the query. Each item carries a flat index `i`
   *  so a single active cursor can move across all groups with the keyboard. */
  protected readonly groups = computed<ResultGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    const out: { label: string; items: Result[] }[] = [];

    const pages = NAV_ITEMS.filter((p) => !q || p.label.toLowerCase().includes(q)).map(
      (p) =>
        ({
          kind: 'page',
          label: p.label,
          sub: 'Page',
          icon: p.icon,
          run: () => this.navigate('/' + p.route),
          i: 0,
        }) as Result,
    );
    if (pages.length) out.push({ label: 'Pages', items: pages });

    if (q.length >= 1) {
      const founders = this.data
        .founders()
        .filter((f) => f.name.toLowerCase().includes(q) || f.headline.toLowerCase().includes(q))
        .slice(0, 6)
        .map(
          (f) =>
            ({
              kind: 'founder',
              label: f.name,
              sub: f.headline,
              initials: f.initials,
              run: () => this.openFounder(f.id),
              i: 0,
            }) as Result,
        );
      if (founders.length) out.push({ label: 'Founders', items: founders });
    }

    const actions = [
      {
        kind: 'action',
        label: 'Start the tutorial',
        sub: '3 step tour of Radar, Evaluation and Data sources',
        icon: 'heroAcademicCap',
        run: () => this.startTour(),
        i: 0,
      } as Result,
    ].filter((a) => !q || 'tutorial tour guide help onboarding'.includes(q));
    if (actions.length) out.push({ label: 'Actions', items: actions });

    let i = 0;
    for (const g of out) for (const it of g.items) it.i = i++;
    return out;
  });

  private readonly flat = computed<Result[]>(() => this.groups().flatMap((g) => g.items));

  constructor() {
    // Reset and focus each time the palette opens; clamp the cursor as results change.
    effect(() => {
      const input = this.searchInput();
      if (this.palette.open() && input) input.nativeElement.focus();
    });
    effect(() => {
      const n = this.flat().length;
      if (this.active() > n - 1) this.active.set(Math.max(0, n - 1));
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.palette.toggle();
      if (!this.palette.open()) this.reset();
    } else if (event.key === 'Escape' && this.palette.open()) {
      this.close();
    }
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    const n = this.flat().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.active.set(n ? (this.active() + 1) % n : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.set(n ? (this.active() - 1 + n) % n : 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = this.flat()[this.active()];
      if (item) this.run(item);
    }
  }

  protected run(item: Result): void {
    item.run();
    this.close();
  }

  protected close(): void {
    this.palette.close();
    this.reset();
  }

  private reset(): void {
    this.query.set('');
    this.active.set(0);
  }

  private navigate(url: string): void {
    void this.router.navigateByUrl(url);
  }

  private openFounder(id: string): void {
    void this.router.navigate(['/evaluation'], { queryParams: { founder: id } });
  }

  private startTour(): void {
    this.tour.start();
  }
}
