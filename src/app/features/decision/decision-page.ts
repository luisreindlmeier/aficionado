import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroUserGroup } from '@ng-icons/heroicons/outline';
import { SectionHeading } from '../../core/ui/section-heading';
import { DataService } from '../../core/data/data.service';
import type { Band, Founder } from '../../core/model';

const BANDS: readonly Band[] = ['Invest', 'Watch', 'Pass'];

@Component({
  selector: 'app-decision-page',
  imports: [RouterLink, NgIcon, SectionHeading],
  viewProviders: [provideIcons({ heroUserGroup })],
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
      <div class="mx-auto w-full max-w-7xl px-6 py-8 md:px-8 md:py-10">
        <header>
          <h1
            class="font-title text-[26px] leading-[1.1] tracking-[-0.01em] text-foreground md:text-[28px]"
          >
            Decision
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Automated verdicts on every evaluated venture, ranked and grouped by band.
            Low-confidence calls route to a human.
          </p>
        </header>

        <div class="mt-6 flex flex-wrap gap-2">
          @for (band of bands; track band) {
            <span
              class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1 text-[12px] text-foreground"
            >
              <span
                class="size-1.5 rounded-full"
                [style.backgroundColor]="data.bandColor(band)"
              ></span>
              {{ band }}
              <span class="text-muted-foreground">{{ rowsFor(band).length }}</span>
            </span>
          }
        </div>

        @for (band of bands; track band) {
          @if (rowsFor(band); as rows) {
            @if (rows.length) {
              <app-section-heading [title]="band" />
              <div class="flex flex-col gap-3">
                @for (row of rows; track row.venture.id) {
                  <a
                    [routerLink]="['/evaluation']"
                    [queryParams]="{ founder: row.founder.id }"
                    class="block rounded-xl border-[0.5px] border-border bg-card p-5 transition-colors hover:bg-accent"
                  >
                    <div class="flex items-start gap-4">
                      <div
                        class="grid size-10 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[13px] font-medium text-foreground"
                      >
                        {{ row.founder.initials }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p class="text-[14px] font-medium text-foreground">
                            {{ row.founder.name }}
                          </p>
                          <span class="text-[12px] text-muted-foreground">
                            {{ row.venture.name }}
                          </span>
                        </div>
                        <p class="mt-0.5 truncate text-[12px] text-muted-foreground">
                          {{ row.venture.tagline }}
                        </p>
                        @if (row.venture.decision; as d) {
                          <p class="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                            {{ d.rationale }}
                          </p>
                        }
                      </div>

                      @if (row.venture.decision; as d) {
                        <div class="flex shrink-0 flex-col items-end gap-2">
                          <span class="font-title text-[22px] leading-none text-foreground">
                            {{ d.composite }}
                          </span>
                          <span
                            class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2.5 py-1 text-[12px] font-medium text-foreground"
                          >
                            <span
                              class="size-1.5 rounded-full"
                              [style.backgroundColor]="data.bandColor(d.band)"
                            ></span>
                            {{ d.band }}
                          </span>
                          <p class="text-[11px] text-muted-foreground">
                            confidence {{ d.confidence }}
                          </p>
                        </div>
                      }
                    </div>

                    @if (row.venture.decision?.routeToHuman) {
                      <div class="mt-3 flex items-start gap-2 border-t-[0.5px] border-border pt-3">
                        <span
                          class="inline-flex shrink-0 items-center gap-1.5 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground"
                        >
                          <ng-icon
                            name="heroUserGroup"
                            size="0.7rem"
                            class="text-muted-foreground"
                          />
                          Route to human
                        </span>
                        <p class="text-[11px] leading-relaxed text-muted-foreground">
                          {{ routeReason(row.founder) }}
                        </p>
                      </div>
                    }
                  </a>
                }
              </div>
            }
          }
        }
      </div>
    </div>
  `,
})
export class DecisionPage {
  protected readonly data = inject(DataService);
  protected readonly bands = BANDS;

  protected rowsFor(band: Band) {
    return this.data
      .decisions()
      .filter((d) => d.venture.decision?.band === band)
      .sort((a, b) => (b.venture.decision?.composite ?? 0) - (a.venture.decision?.composite ?? 0));
  }

  protected routeReason(f: Founder): string {
    if (f.note) return f.note;
    const s = f.score;
    if (s) {
      const low = [s.proof, s.gravity, s.trajectory].find((m) => m.confidence === 'low');
      if (low) return `${low.metric} is unverified, a human should confirm it before deciding.`;
    }
    if (f.evidenceCount < 3) return 'Thin evidence, fewer than three sources connected.';
    return 'Needs a human to confirm before an automated decision.';
  }
}
