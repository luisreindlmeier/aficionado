import { Component } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

@Component({
  selector: 'app-footer',
  imports: [NgIcon],
  template: `
    <footer
      class="flex h-14 shrink-0 items-center justify-between border-t border-border bg-surface pl-3 pr-4 text-muted-foreground md:pr-5"
    >
      <!-- left label aligned to the sidebar nav column (pl-3 + px-3 → icon at the nav-icon line) -->
      <button
        type="button"
        class="flex items-center gap-3 rounded-sm px-3 py-1.5 text-[13px] transition-colors hover:bg-accent hover:text-foreground"
      >
        <ng-icon name="heroCommandLine" class="shrink-0" />
        <span>aficionado</span>
      </button>

      <div class="flex items-center gap-0.5">
        @for (a of actions; track a.icon) {
          <button
            type="button"
            [attr.aria-label]="a.label"
            class="grid size-8 place-items-center rounded-sm transition-colors hover:bg-accent hover:text-foreground"
          >
            <ng-icon [name]="a.icon" />
          </button>
        }
      </div>
    </footer>
  `,
})
export class Footer {
  protected readonly actions = [
    { icon: 'heroLifebuoy', label: 'Help' },
    { icon: 'heroSignal', label: 'Status' },
  ];
}
