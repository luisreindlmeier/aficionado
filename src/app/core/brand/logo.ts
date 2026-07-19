import { Component, computed, input } from '@angular/core';

/**
 * Aficionado brand logo — the graduated dot-matrix "A".
 *
 * The mark is drawn with `fill="currentColor"`, so it inherits the surrounding
 * text color (ink on light surfaces, white on dark ones). Set `[wordmark]="false"`
 * for the bare mark (e.g. an avatar tile). Proportions follow the brand kit
 * (mark : wordmark : gap ≈ 1 : 0.67 : 0.33).
 */
@Component({
  selector: 'app-logo',
  template: `
    <span
      class="inline-flex items-center"
      [style.gap.px]="gap()"
      [attr.role]="wordmark() ? 'img' : null"
      [attr.aria-label]="wordmark() ? 'aficionado' : null"
    >
      <svg
        viewBox="0 0 120 120"
        fill="currentColor"
        [attr.width]="size()"
        [attr.height]="size()"
        [attr.role]="wordmark() ? null : 'img'"
        [attr.aria-label]="wordmark() ? null : 'aficionado'"
        [attr.aria-hidden]="wordmark() ? true : null"
        style="flex:none"
      >
        <circle cx="60" cy="24" r="4" />
        <circle cx="49" cy="48" r="5" />
        <circle cx="71" cy="48" r="5" />
        <circle cx="38" cy="72" r="6.5" />
        <circle cx="60" cy="72" r="6.5" />
        <circle cx="82" cy="72" r="6.5" />
        <circle cx="27" cy="96" r="8" />
        <circle cx="93" cy="96" r="8" />
      </svg>

      @if (wordmark()) {
        <span class="brand-wordmark leading-none" [style.fontSize.px]="wordmarkSize()">aficionado</span>
      }
    </span>
  `,
})
export class Logo {
  /** Mark height in px. The wordmark and gap scale from this. */
  readonly size = input(22);
  /** Whether to render the "aficionado" wordmark next to the mark. */
  readonly wordmark = input(true);

  protected readonly wordmarkSize = computed(() => Math.round(this.size() * 0.67));
  protected readonly gap = computed(() => Math.round(this.size() * 0.33));
}
