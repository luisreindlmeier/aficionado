import { Component, input } from '@angular/core';

/** Intentionally empty page: only the title, wired from the route data. */
@Component({
  selector: 'app-placeholder-page',
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
        <h1
          class="font-title text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground md:text-[28px]"
        >
          {{ title() }}
        </h1>
        <p class="mt-2 text-[14px] leading-relaxed text-muted-foreground">No content yet.</p>
      </div>
    </div>
  `,
})
export class PlaceholderPage {
  readonly title = input<string>('');
}
