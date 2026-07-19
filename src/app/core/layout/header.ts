import { Component, inject, output } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { CommandPaletteService } from '../command-palette.service';

@Component({
  selector: 'app-header',
  imports: [NgIcon],
  template: `
    <header class="flex h-16 shrink-0 items-center gap-3 bg-background px-4 md:px-5">
      <button
        type="button"
        (click)="menu.emit()"
        aria-label="Menu"
        class="grid size-8 shrink-0 place-items-center rounded-sm text-foreground hover:bg-accent md:hidden"
      >
        <ng-icon name="heroBars3" />
      </button>

      <!-- search trigger: opens the command palette (also via ⌘K) -->
      <div class="flex flex-1 justify-center">
        <button
          type="button"
          (click)="palette.openPalette()"
          class="flex h-9 w-full max-w-xl items-center gap-2 rounded-md border border-input bg-surface px-3 text-[13px] transition-colors hover:bg-control-hover"
        >
          <ng-icon name="heroMagnifyingGlass" class="shrink-0 text-muted-foreground" />
          <span class="flex-1 text-left text-placeholder">Search…</span>
          <kbd
            class="inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-[11px] font-medium text-muted-foreground"
          >
            ⌘K
          </kbd>
        </button>
      </div>

      <div class="flex shrink-0 items-center gap-0.5">
        @for (a of actions; track a.icon) {
          <button
            type="button"
            [attr.aria-label]="a.label"
            class="grid size-8 place-items-center rounded-sm text-foreground transition-colors hover:bg-accent"
          >
            <ng-icon [name]="a.icon" />
          </button>
        }
        <button
          type="button"
          class="ml-2 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
        >
          <ng-icon name="heroAcademicCap" />
          <span>Tutorial</span>
        </button>
      </div>
    </header>
  `,
})
export class Header {
  protected readonly palette = inject(CommandPaletteService);
  readonly menu = output<void>();
  protected readonly actions = [
    { icon: 'heroQuestionMarkCircle', label: 'Help' },
    { icon: 'heroBell', label: 'Notifications' },
    { icon: 'heroCog6Tooth', label: 'Settings' },
  ];
}
