import { Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon } from '@ng-icons/core';
import { NAV_GROUPS } from '../nav';
import { ProjectSelector } from './project-selector';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, NgIcon, ProjectSelector],
  template: `
    <aside class="flex h-full w-60 shrink-0 flex-col border-r border-border bg-background">
      <div class="px-3 pt-3 pb-1">
        <app-project-selector />
      </div>

      <nav class="flex-1 overflow-y-auto px-3 pt-5 pb-4">
        @for (group of groups; track group.label ?? 'main'; let first = $first) {
          <div [class.mt-6]="!first">
            @if (group.label) {
              <p class="af-eyebrow px-3 pb-2">
                {{ group.label }}
              </p>
            }
            <ul class="space-y-0.5">
              @for (item of group.items; track item.route) {
                <li>
                  <a
                    [routerLink]="item.route"
                    routerLinkActive
                    ariaCurrentWhenActive="page"
                    (click)="navigate.emit()"
                    [class.text-foreground]="!item.dimmed"
                    [class.text-muted-foreground]="item.dimmed"
                    class="flex items-center gap-3 rounded-sm px-3 py-1.5 text-[13px] transition-colors hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium"
                  >
                    <ng-icon [name]="item.icon" class="shrink-0" />
                    <span>{{ item.label }}</span>
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </nav>
    </aside>
  `,
})
export class Sidebar {
  readonly navigate = output<void>();
  protected readonly groups = NAV_GROUPS;
}
