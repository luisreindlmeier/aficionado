import { Component, input } from '@angular/core';

/**
 * Page section heading: an editorial serif title with a clean divider beneath.
 * Use one per content section so every page reads as clearly divided blocks.
 * Never use the small uppercase eyebrow style for page sections.
 */
@Component({
  selector: 'app-section-heading',
  host: { class: 'mt-8 mb-4 block' },
  template: `
    <h2
      class="border-b-[0.5px] border-border pb-2.5 font-title text-[18px] leading-tight tracking-[-0.01em] text-foreground"
    >
      {{ title() }}
    </h2>
  `,
})
export class SectionHeading {
  readonly title = input.required<string>();
}
