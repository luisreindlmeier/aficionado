import {
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CommandPaletteService } from '../command-palette.service';

/** Global command palette opened via ⌘K / Ctrl+K or the header search. */
@Component({
  selector: 'app-command-palette',
  imports: [NgIcon],
  template: `
    @if (palette.open()) {
      <div class="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[14vh]">
        <button
          type="button"
          aria-label="Close"
          class="absolute inset-0 cursor-default bg-black/40"
          (click)="palette.close()"
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
              placeholder="Search…"
              autocomplete="off"
              spellcheck="false"
              class="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-placeholder"
            />
            <button
              type="button"
              class="flex shrink-0 items-center gap-1.5 rounded-md bg-surface px-2.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-control-hover"
            >
              <ng-icon name="heroChatBubbleLeftRight" />
              <span>Ask Assistant</span>
            </button>
          </div>

          <div class="border-t border-border"></div>

          <!-- results -->
          <div class="max-h-[50vh] overflow-y-auto p-2">
            @if (query()) {
              <p class="af-eyebrow px-2.5 py-1.5">Ask Assistant</p>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-md bg-accent px-2.5 py-2 text-left text-[14px] text-foreground"
              >
                <ng-icon name="heroChatBubbleLeftRight" class="shrink-0 text-muted-foreground" />
                <span class="truncate">Can you tell me about “{{ query() }}”?</span>
              </button>
            } @else {
              <p class="px-2.5 py-6 text-center text-[13px] text-muted-foreground">
                Type to search or ask the assistant.
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
                <span>Select</span>
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
  protected readonly query = signal('');
  protected readonly kbd =
    'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface px-1 text-[11px] font-medium text-muted-foreground';

  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  constructor() {
    // focus the input once the modal renders
    effect(() => {
      const input = this.searchInput();
      if (this.palette.open() && input) {
        input.nativeElement.focus();
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.palette.toggle();
    } else if (event.key === 'Escape' && this.palette.open()) {
      this.palette.close();
    }
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
