import { Component, computed, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroPlus, heroXMark } from '@ng-icons/heroicons/outline';

export interface ThesisDraft {
  readonly label: string;
  readonly description: string;
  readonly keywords: readonly string[];
}

/** Dialog to configure and launch a new sourcing thesis: what kind of founder to
 *  look for (industry, geography, stage, ...) expressed as free-text plus focus
 *  keywords, then handed off to the runner via the (create) output. */
@Component({
  selector: 'app-thesis-composer',
  imports: [NgIcon],
  viewProviders: [provideIcons({ heroPlus, heroXMark })],
  template: `
    <div class="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[10vh]">
      <button
        type="button"
        aria-label="Close"
        class="absolute inset-0 cursor-default bg-black/40"
        (click)="dismiss.emit()"
      ></button>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="New sourcing thesis"
        class="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover shadow-elevated"
      >
        <div class="flex items-center justify-between px-5 py-4">
          <div>
            <p class="font-title text-[16px] text-foreground">New sourcing thesis</p>
            <p class="mt-0.5 text-[12px] text-muted-foreground">
              Configure what kind of founder to look for, then start a sourcing pass.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            (click)="dismiss.emit()"
            class="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ng-icon name="heroXMark" size="1rem" />
          </button>
        </div>

        <div class="border-t border-border"></div>

        <div class="flex flex-col gap-4 px-5 py-4">
          <div>
            <label for="thesis-label" class="text-[12px] font-medium text-foreground">Label</label>
            <input
              id="thesis-label"
              type="text"
              [value]="label()"
              (input)="label.set($any($event.target).value)"
              placeholder="e.g. Climate-tech founders, Nordics"
              class="mt-1.5 w-full rounded-md border-[0.5px] border-input bg-surface p-2 text-[13px] text-foreground outline-none placeholder:text-placeholder focus:border-ring"
            />
          </div>

          <div>
            <label for="thesis-description" class="text-[12px] font-medium text-foreground"
              >Description</label
            >
            <textarea
              id="thesis-description"
              [value]="description()"
              (input)="description.set($any($event.target).value)"
              rows="2"
              placeholder="What this thesis is looking for, e.g. deep-technical founders building climate hardware or grid software in the Nordics."
              class="mt-1.5 w-full rounded-md border-[0.5px] border-input bg-surface p-2 text-[13px] text-foreground outline-none placeholder:text-placeholder focus:border-ring"
            ></textarea>
          </div>

          <div>
            <label for="thesis-keywords" class="text-[12px] font-medium text-foreground"
              >Focus keywords</label
            >
            <p class="mt-0.5 text-[11px] text-muted-foreground">
              Industry, geography, stage, whatever the runner should match on. Enter or comma to
              add.
            </p>
            <div
              class="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-md border-[0.5px] border-input bg-surface p-2"
            >
              @for (k of keywords(); track k) {
                <span
                  class="inline-flex items-center gap-1 rounded-full border-[0.5px] border-border bg-card px-2 py-0.5 text-[11px] text-foreground"
                >
                  {{ k }}
                  <button
                    type="button"
                    [attr.aria-label]="'Remove ' + k"
                    (click)="removeKeyword(k)"
                    class="text-muted-foreground hover:text-foreground"
                  >
                    <ng-icon name="heroXMark" size="0.65rem" />
                  </button>
                </span>
              }
              <input
                id="thesis-keywords"
                type="text"
                [value]="keywordDraft()"
                (input)="keywordDraft.set($any($event.target).value)"
                (keydown)="onKeywordKeydown($event)"
                (blur)="addKeywordFromDraft()"
                placeholder="climate, nordics, hardware..."
                class="min-w-[8rem] flex-1 bg-transparent p-0.5 text-[12px] text-foreground outline-none placeholder:text-placeholder"
              />
            </div>
          </div>
        </div>

        <div class="border-t border-border"></div>

        <div class="flex items-center justify-end gap-2 px-5 py-3.5">
          <button
            type="button"
            (click)="dismiss.emit()"
            class="inline-flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            [disabled]="!canSubmit()"
            (click)="submit()"
            class="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <ng-icon name="heroPlus" size="0.85rem" />
            Create & run sourcing
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ThesisComposer {
  readonly dismiss = output<void>();
  readonly create = output<ThesisDraft>();

  protected readonly label = signal('');
  protected readonly description = signal('');
  protected readonly keywords = signal<readonly string[]>([]);
  protected readonly keywordDraft = signal('');

  protected readonly canSubmit = computed(
    () =>
      this.label().trim().length > 1 &&
      this.description().trim().length > 4 &&
      this.keywords().length > 0,
  );

  protected onKeywordKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addKeywordFromDraft();
    } else if (event.key === 'Backspace' && !this.keywordDraft() && this.keywords().length) {
      this.keywords.update((ks) => ks.slice(0, -1));
    }
  }

  protected addKeywordFromDraft(): void {
    const raw = this.keywordDraft().trim().toLowerCase().replace(/,+$/, '');
    if (!raw) {
      this.keywordDraft.set('');
      return;
    }
    if (!this.keywords().includes(raw)) {
      this.keywords.update((ks) => [...ks, raw]);
    }
    this.keywordDraft.set('');
  }

  protected removeKeyword(k: string): void {
    this.keywords.update((ks) => ks.filter((x) => x !== k));
  }

  protected submit(): void {
    this.addKeywordFromDraft();
    if (!this.canSubmit()) return;
    this.create.emit({
      label: this.label().trim(),
      description: this.description().trim(),
      keywords: this.keywords(),
    });
  }
}
