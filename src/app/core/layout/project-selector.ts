import { Component, HostListener, computed, ElementRef, inject, signal } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { Logo } from '../brand/logo';

/** Top-left project / deal switcher. Functional shell, no real data yet. */
@Component({
  selector: 'app-project-selector',
  imports: [NgIcon, Logo],
  template: `
    <div class="relative">
      <button
        type="button"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        aria-haspopup="menu"
        class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
      >
        <span
          class="grid size-6 shrink-0 place-items-center rounded-md bg-foreground text-background"
        >
          <app-logo [wordmark]="false" [size]="13" />
        </span>
        <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{{
          current()
        }}</span>
        <ng-icon name="heroChevronUpDown" class="shrink-0 text-muted-foreground" />
      </button>

      @if (open()) {
        <div
          role="menu"
          class="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-md border border-border bg-popover shadow-elevated"
        >
          <!-- selected deal: larger centered avatar + name -->
          <div class="flex flex-col items-center gap-2 px-4 pt-4 pb-3">
            <span class="grid size-12 place-items-center rounded-xl bg-foreground text-background">
              <app-logo [wordmark]="false" [size]="26" />
            </span>
            <span class="text-[14px] font-medium text-foreground">{{ current() }}</span>
          </div>

          <div class="border-t border-border"></div>

          <!-- other deals -->
          <div class="px-1 py-1">
            @for (p of otherDeals(); track p) {
              <button
                type="button"
                role="menuitem"
                (click)="select(p)"
                class="flex w-full items-center gap-2.5 rounded-sm px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-accent"
              >
                <ng-icon name="heroFolderOpen" class="text-muted-foreground" />
                <span class="truncate">{{ p }}</span>
              </button>
            }
          </div>

          <div class="border-t border-border"></div>

          <!-- actions -->
          <div class="px-1 py-1">
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2.5 rounded-sm px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-accent"
            >
              <ng-icon name="heroPlus" class="text-muted-foreground" />
              New project
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2.5 rounded-sm px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-accent"
            >
              <ng-icon name="heroCog6Tooth" class="text-muted-foreground" />
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2.5 rounded-sm px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-accent"
            >
              <ng-icon name="heroArrowRightOnRectangle" class="text-muted-foreground" />
              Sign out
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProjectSelector {
  private readonly host = inject(ElementRef);

  protected readonly open = signal(false);
  protected readonly projects = ['Project Atlas', 'Project Lighthouse', 'Project Cobalt'];
  protected readonly current = signal('Project Atlas');
  protected readonly otherDeals = computed(() => this.projects.filter((p) => p !== this.current()));

  protected toggle(): void {
    this.open.update((v) => !v);
  }
  protected close(): void {
    this.open.set(false);
  }
  protected select(p: string): void {
    this.current.set(p);
    this.close();
  }

  // Close on outside click or Escape (clean best-practice flyout dismissal).
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }
}
