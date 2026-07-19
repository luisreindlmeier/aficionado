import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Footer } from './footer';
import { CommandPalette } from './command-palette';
import { TourOverlay } from '../tour/tour-overlay';
import { TourService } from '../tour/tour.service';

/**
 * App layout: sidebar + header + content (header and content share one surface,
 * no divider), with a full-width footer beneath everything. Responsive drawer.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Header, Footer, CommandPalette, TourOverlay],
  template: `
    <div class="flex h-dvh flex-col bg-background text-foreground">
      <div class="flex min-h-0 flex-1">
        <!-- sidebar: in-flow on md+, slide-in drawer on mobile -->
        <div
          class="fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:z-auto md:translate-x-0"
          [class.-translate-x-full]="!sidebarOpen()"
        >
          <app-sidebar (navigate)="closeSidebar()" />
        </div>

        @if (sidebarOpen()) {
          <button
            type="button"
            aria-label="Close menu"
            class="fixed inset-0 z-40 bg-black/30 md:hidden"
            (click)="closeSidebar()"
          ></button>
        }

        <div class="flex min-w-0 flex-1 flex-col">
          <app-header (menu)="toggleSidebar()" />
          <main class="flex flex-1 flex-col overflow-hidden">
            <router-outlet />
          </main>
        </div>
      </div>

      <app-footer />
    </div>

    <app-command-palette />
    <app-tour-overlay />
  `,
})
export class AppShell {
  private readonly tour = inject(TourService);
  protected readonly sidebarOpen = signal(false);

  constructor() {
    // Run the onboarding tour once, on a visitor's first load.
    if (!this.tour.hasSeen()) {
      setTimeout(() => this.tour.start(), 700);
    }
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
