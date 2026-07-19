import { Injectable, signal } from '@angular/core';

/** Shared open/close state for the global command palette (⌘K / Ctrl+K). */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  readonly open = signal(false);

  openPalette(): void {
    this.open.set(true);
  }
  close(): void {
    this.open.set(false);
  }
  toggle(): void {
    this.open.update((v) => !v);
  }
}
