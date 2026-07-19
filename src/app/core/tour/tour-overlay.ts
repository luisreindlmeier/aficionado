import {
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroAcademicCap } from '@ng-icons/heroicons/outline';
import { TourService } from './tour.service';

interface Box {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

const PAD = 8; // spotlight breathing room around the target
const GAP = 14; // distance between spotlight and tooltip
const CARD_W = 340;
const MARGIN = 16; // viewport edge margin

/**
 * The onboarding overlay: dims the page, cuts a spotlight over the current
 * step's `[data-tour]` element, and floats a tooltip beside it. Positioning is
 * measured from the live DOM and re-runs on step change and resize.
 */
@Component({
  selector: 'app-tour-overlay',
  imports: [NgIcon],
  viewProviders: [provideIcons({ heroAcademicCap })],
  styles: `
    .spot {
      position: absolute;
      border-radius: 12px;
      box-shadow: 0 0 0 9999px rgba(17, 17, 17, 0.55);
      outline: 2px solid rgba(255, 255, 255, 0.9);
      transition:
        top 0.22s cubic-bezier(0.4, 0, 0.2, 1),
        left 0.22s cubic-bezier(0.4, 0, 0.2, 1),
        width 0.22s cubic-bezier(0.4, 0, 0.2, 1),
        height 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @media (prefers-reduced-motion: reduce) {
      .spot {
        transition: none;
      }
    }
  `,
  template: `
    @if (tour.active() && tour.step(); as s) {
      <div class="fixed inset-0 z-[120]">
        <!-- click blocker; full dim only while we have not located the target yet -->
        <div class="absolute inset-0" [class.bg-black/50]="!box()"></div>

        @if (box(); as b) {
          <div
            class="spot"
            [style.top.px]="b.top"
            [style.left.px]="b.left"
            [style.width.px]="b.width"
            [style.height.px]="b.height"
          ></div>
        }

        <div
          #card
          class="absolute w-[340px] max-w-[calc(100vw-32px)] rounded-xl border border-border bg-popover p-4 shadow-elevated"
          [style.top.px]="cardTop()"
          [style.left.px]="cardLeft()"
        >
          <div class="mb-2 flex items-center justify-between">
            <span
              class="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground"
            >
              <ng-icon name="heroAcademicCap" class="text-muted-foreground" />
              Step {{ tour.index() + 1 }} of {{ tour.steps.length }}
            </span>
            <button
              type="button"
              (click)="tour.finish()"
              class="text-[12px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Skip
            </button>
          </div>

          <h3 class="font-title text-[15px] leading-snug text-foreground">{{ s.title }}</h3>
          <p class="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{{ s.body }}</p>

          <!-- progress dots -->
          <div class="mt-3.5 flex items-center gap-1.5">
            @for (dot of tour.steps; track $index) {
              <span
                class="h-1.5 rounded-full transition-all"
                [class.w-4]="$index === tour.index()"
                [class.bg-foreground]="$index === tour.index()"
                [class.w-1.5]="$index !== tour.index()"
                [class.bg-border]="$index !== tour.index()"
              ></span>
            }
          </div>

          <div class="mt-3 flex items-center justify-end gap-2">
            @if (!tour.isFirst()) {
              <button
                type="button"
                (click)="tour.prev()"
                class="inline-flex h-8 items-center rounded-md border border-border px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                Back
              </button>
            }
            <button
              type="button"
              (click)="tour.next()"
              class="inline-flex h-8 items-center rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90"
            >
              {{ tour.isLast() ? 'Done' : 'Next' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TourOverlay {
  protected readonly tour = inject(TourService);

  protected readonly box = signal<Box | null>(null);
  protected readonly cardTop = signal(MARGIN);
  protected readonly cardLeft = signal(MARGIN);

  private readonly card = viewChild<ElementRef<HTMLDivElement>>('card');
  private targetRect: DOMRect | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Re-place whenever the active step changes.
    effect(() => {
      if (this.tour.active()) {
        this.tour.index();
        this.box.set(null);
        this.targetRect = null;
        this.schedulePlace(0);
      } else {
        this.clearTimer();
      }
    });
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (this.tour.active()) this.schedulePlace(0);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.tour.active()) this.tour.finish();
  }

  /** Poll for the target element (the page may still be routing in), then measure. */
  private schedulePlace(attempt: number): void {
    this.clearTimer();
    this.timer = setTimeout(
      () => {
        const step = this.tour.step();
        if (!step) return;
        const el = document.querySelector<HTMLElement>(`[data-tour="${step.selector}"]`);
        if (!el) {
          if (attempt < 20) this.schedulePlace(attempt + 1);
          return;
        }
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
        // Let the scroll settle, then measure from the real DOM.
        this.timer = setTimeout(() => this.measure(el), 60);
      },
      attempt === 0 ? 60 : 90,
    );
  }

  private measure(el: HTMLElement): void {
    const r = el.getBoundingClientRect();
    this.targetRect = r;
    this.box.set({
      top: Math.max(r.top - PAD, MARGIN / 2),
      left: Math.max(r.left - PAD, MARGIN / 2),
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    });
    // Card size is known only after it renders; place on the next frame.
    requestAnimationFrame(() => this.placeCard());
  }

  private placeCard(): void {
    const r = this.targetRect;
    if (!r) return;
    const cardEl = this.card()?.nativeElement;
    const cardH = cardEl?.offsetHeight ?? 180;
    const cardW = cardEl?.offsetWidth ?? CARD_W;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = r.bottom + GAP;
    if (top + cardH > vh - MARGIN) {
      const above = r.top - cardH - GAP;
      top = above >= MARGIN ? above : Math.max(MARGIN, vh - cardH - MARGIN);
    }
    const left = Math.min(Math.max(r.left, MARGIN), vw - cardW - MARGIN);

    this.cardTop.set(Math.round(top));
    this.cardLeft.set(Math.round(left));
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
