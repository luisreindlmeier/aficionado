import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroClipboardDocumentCheck } from '@ng-icons/heroicons/outline';
import { SectionHeading } from '../../core/ui/section-heading';
import { DataService } from '../../core/data/data.service';
import type { Founder, RedFlag } from '../../core/model';

function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

@Component({
  selector: 'app-diligence-page',
  imports: [RouterLink, NgIcon, SectionHeading],
  viewProviders: [provideIcons({ heroClipboardDocumentCheck })],
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
            Diligence
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            A quiet background pass before any human handoff. Consistency checks and open questions,
            nothing that overrides the score.
          </p>
        </header>

        @if (founder(); as f) {
          <section class="mt-6 flex items-center gap-3">
            <div
              class="grid size-11 shrink-0 place-items-center rounded-full border-[0.5px] border-border bg-surface text-[13px] font-medium text-muted-foreground"
            >
              {{ f.initials }}
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-[15px] font-medium text-foreground">{{ f.name }}</h2>
              <p class="truncate text-[12px] text-muted-foreground">{{ f.headline }}</p>
            </div>
            <a
              [routerLink]="['/evaluation']"
              [queryParams]="{ founder: f.id }"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1 text-[12px] text-foreground transition-colors hover:bg-accent"
            >
              <ng-icon
                name="heroClipboardDocumentCheck"
                size="0.75rem"
                class="text-muted-foreground"
              />
              Full evaluation
            </a>
          </section>

          <app-section-heading title="Background checklist" />
          <section
            class="divide-y-[0.5px] divide-border rounded-xl border-[0.5px] border-border bg-card px-5"
          >
            @for (item of greenChecks(f); track item) {
              <div class="flex items-start gap-3 py-3">
                <span
                  class="mt-1.5 size-1.5 shrink-0 rounded-full"
                  [style.backgroundColor]="green"
                ></span>
                <p class="text-[13px] text-muted-foreground">{{ item }}</p>
              </div>
            }

            @for (flag of f.redFlags; track flag.text) {
              <div class="flex items-start gap-3 py-3">
                <span
                  class="mt-1.5 size-1.5 shrink-0 rounded-full"
                  [style.backgroundColor]="flagColor(flag.severity)"
                ></span>
                <div class="min-w-0 flex-1">
                  <p class="text-[13px] text-foreground">{{ flag.text }}</p>
                  <p class="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                    {{ flag.note }}
                  </p>
                </div>
                <span class="shrink-0 text-[11px] capitalize text-muted-foreground">
                  {{ flag.severity }}
                </span>
              </div>
            }
          </section>

          <app-section-heading title="Human handoff brief" />
          <section class="rounded-xl border-[0.5px] border-border bg-card p-5">
            <dl class="flex flex-col gap-3 text-[13px]">
              <div class="flex flex-col gap-1 sm:flex-row sm:gap-3">
                <dt class="w-32 shrink-0 text-muted-foreground">Founder</dt>
                <dd class="text-foreground">{{ founderLine(f) }}</dd>
              </div>
              <div class="flex flex-col gap-1 sm:flex-row sm:gap-3">
                <dt class="w-32 shrink-0 text-muted-foreground">Venture</dt>
                <dd class="text-foreground">{{ ventureLine(f) }}</dd>
              </div>
              <div class="flex flex-col gap-1 sm:flex-row sm:gap-3">
                <dt class="w-32 shrink-0 text-muted-foreground">Score</dt>
                <dd class="text-foreground">{{ scoreLine(f) }}</dd>
              </div>
              <div class="flex flex-col gap-1 sm:flex-row sm:gap-3">
                <dt class="w-32 shrink-0 text-muted-foreground">Verified</dt>
                <dd class="text-foreground">{{ verifiedLine(f) }}</dd>
              </div>
              <div class="flex flex-col gap-1 sm:flex-row sm:gap-3">
                <dt class="w-32 shrink-0 text-muted-foreground">Needs a human</dt>
                <dd class="text-foreground">{{ needsHumanLine(f) }}</dd>
              </div>
            </dl>
          </section>
        } @else {
          <p class="mt-8 text-[13px] text-muted-foreground">No founder selected for diligence.</p>
        }
      </div>
    </div>
  `,
})
export class DiligencePage {
  protected readonly data = inject(DataService);
  private readonly route = inject(ActivatedRoute);
  protected readonly green = '#16a34a';

  private readonly selectedId = signal<string | undefined>(undefined);
  protected readonly founder = computed<Founder | undefined>(
    () => this.data.founder(this.selectedId() ?? '') ?? this.data.hero(),
  );

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const id = params.get('founder');
      this.selectedId.set(id && this.data.founder(id) ? id : undefined);
    });
  }

  protected greenChecks(f: Founder): string[] {
    const checks: string[] = [];
    if (f.handles.github) {
      checks.push(`Public identity consistent across GitHub (@${f.handles.github})`);
    }
    checks.push('No contradictory claims found across connected sources');
    checks.push('Shipping history verifiable from public repositories');
    if (f.score) {
      checks.push('Score derived only from verifiable public evidence');
    }
    return checks;
  }

  protected flagColor(severity: RedFlag['severity']): string {
    return severity === 'high' ? '#dc2626' : '#d97706';
  }

  protected founderLine(f: Founder): string {
    return f.location ? `${f.name}, ${f.location}` : f.name;
  }

  protected ventureLine(f: Founder): string {
    const venture = this.data.venture(f.ventureId);
    if (!venture) return 'Not linked to a venture yet';
    return `${venture.name}, ${venture.tagline}`;
  }

  protected scoreLine(f: Founder): string {
    const s = f.score;
    if (!s) return 'Not scored yet';
    return `composite ${s.composite}, ${s.band} band, ${s.confidence} confidence`;
  }

  protected verifiedLine(f: Founder): string {
    const s = f.score;
    if (!s) return 'No metric is verified with confidence yet.';
    const verified = [s.proof, s.trajectory, s.gravity]
      .filter((m) => m.confidence !== 'low')
      .map((m) => m.metric);
    if (!verified.length) return 'No metric is verified with confidence yet.';
    return `${joinAnd(verified)} verified from public evidence.`;
  }

  protected needsHumanLine(f: Founder): string {
    const parts: string[] = [];
    const s = f.score;
    if (s) {
      for (const m of [s.proof, s.gravity, s.trajectory]) {
        if (m.confidence === 'low') {
          parts.push(`paste a LinkedIn or X profile to verify ${m.metric}`);
        }
      }
    }
    if (f.redFlags.some((r) => /co-?founder/i.test(r.text))) {
      parts.push('confirm the co-founder');
    }
    if (!parts.length) parts.push('spot-check the evidence before deciding');
    return `${capitalize(joinAnd(parts))}.`;
  }
}
