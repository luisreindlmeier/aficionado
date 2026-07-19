import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/data/data.service';

@Component({
  selector: 'app-pipeline-page',
  imports: [RouterLink],
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
            Pipeline
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Founders moving from watch to decision. Open any card to see its evaluation.
          </p>
        </header>

        <div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          @for (stage of stages; track stage) {
            <section class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <h2 class="font-title text-[16px] tracking-[-0.01em] text-foreground">
                  {{ stage }}
                </h2>
                <span
                  class="rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-foreground"
                >
                  {{ pipeline()[stage].length }}
                </span>
              </div>

              @for (f of pipeline()[stage]; track f.id) {
                <a
                  [routerLink]="['/evaluation']"
                  [queryParams]="{ founder: f.id }"
                  class="block rounded-xl border-[0.5px] border-border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <div class="flex items-start gap-3">
                    <div
                      class="grid size-9 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[12px] font-medium text-foreground"
                    >
                      {{ f.initials }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-[13px] font-medium text-foreground">{{ f.name }}</p>
                      <p class="truncate text-[12px] text-muted-foreground">{{ f.headline }}</p>
                    </div>
                  </div>

                  <div class="mt-3 flex items-center justify-between">
                    @if (f.score; as s) {
                      <span class="inline-flex items-center gap-1.5 text-[12px] text-foreground">
                        <span
                          class="size-1.5 rounded-full"
                          [style.backgroundColor]="data.bandColor(s.band)"
                        ></span>
                        {{ s.composite }}
                      </span>
                    } @else {
                      <span class="text-[12px] text-muted-foreground">Not scored</span>
                    }
                    <span class="text-[11px] text-muted-foreground">
                      discovered {{ data.timeAgo(f.discoveredAt) }}
                    </span>
                  </div>
                </a>
              }

              @if (!pipeline()[stage].length) {
                <p
                  class="rounded-xl border-[0.5px] border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground"
                >
                  Nothing here yet.
                </p>
              }
            </section>
          }
        </div>
      </div>
    </div>
  `,
})
export class PipelinePage {
  protected readonly data = inject(DataService);
  protected readonly stages = this.data.pipelineStages;
  protected readonly pipeline = this.data.pipeline;
}
