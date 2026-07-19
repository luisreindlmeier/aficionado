import { Component, input } from '@angular/core';
import type { TraceStep } from '../model';

/** A connector tool and how its call went, as shown in the chip row. */
export interface ToolChip {
  readonly id: string;
  readonly status: 'running' | 'done' | 'error';
}

/** One line of streamed evidence: a signal from a connector, or a candidate
 *  surfaced by the discovery agent. Same shape, same rendering. */
export interface ActivityLine {
  readonly label: string;
  readonly text: string;
}

// ─────────────────────────────────────────────────────────────
// The "brain at work" panel, shared by every agent loop. Both the evaluation
// workflow and the sourcing workflow stream a trace, a set of tool calls and a
// run of evidence lines, so they get one visual language rather than two.
// Presentation only: the caller owns the streaming and passes signals in.
// ─────────────────────────────────────────────────────────────

@Component({
  selector: 'app-agent-activity',
  styles: `
    @keyframes blink {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
    }
    .blink {
      animation: blink 1.2s ease-in-out infinite;
    }
  `,
  template: `
    @if (trace().length || running()) {
      <div
        class="flex flex-col gap-1.5 rounded-lg border-[0.5px] border-border bg-surface p-3 font-mono text-[11px] leading-relaxed"
      >
        @for (t of trace(); track $index) {
          <div class="flex items-start gap-2">
            <span class="shrink-0 text-placeholder">{{ clock(t.at) }}</span>
            <span class="shrink-0" [style.color]="traceColor(t)">{{ traceGlyph(t) }}</span>
            <span class="text-foreground">{{ t.label }}</span>
            @if (t.detail) {
              <span class="text-muted-foreground">{{ t.detail }}</span>
            }
          </div>
        }
        @if (running()) {
          <div class="flex items-center gap-2"><span class="blink text-foreground">▍</span></div>
        }
      </div>
    }

    @if (tools().length) {
      <div class="mt-3 flex flex-wrap gap-1.5">
        @for (c of tools(); track c.id) {
          <span
            class="inline-flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            <span class="size-1.5 rounded-full" [style.background]="statusColor(c.status)"></span>
            {{ c.id }}
          </span>
        }
      </div>
    }

    @if (lines().length) {
      <ul class="mt-3 flex flex-col gap-1 text-[11px]">
        @for (l of lines(); track $index) {
          <li class="flex items-start gap-2">
            <span
              class="mt-0.5 shrink-0 rounded-full border-[0.5px] border-border px-1.5 text-[10px] text-muted-foreground"
              >{{ l.label }}</span
            >
            <span class="text-muted-foreground">{{ l.text }}</span>
          </li>
        }
      </ul>
    }
  `,
})
export class AgentActivity {
  readonly trace = input<readonly TraceStep[]>([]);
  readonly tools = input<readonly ToolChip[]>([]);
  readonly lines = input<readonly ActivityLine[]>([]);
  readonly running = input(false);

  /** Trace timestamps arrive as ISO from the server and as a local clock string
   *  from client-side steps. Render both as HH:MM:SS. */
  protected clock(at: string): string {
    const d = new Date(at);
    return Number.isNaN(d.getTime())
      ? at
      : d.toLocaleTimeString('en-US', { hour12: false });
  }

  protected statusColor(s: string): string {
    return s === 'done' ? '#16a34a' : s === 'error' ? '#dc2626' : '#a3a3a3';
  }

  protected traceColor(t: TraceStep): string {
    if (t.kind === 'done') return '#16a34a';
    if (t.kind === 'gate') return '#d97706';
    return '#737373';
  }

  protected traceGlyph(t: TraceStep): string {
    switch (t.kind) {
      case 'plan':
        return '◆';
      case 'fetch':
        return '↓';
      case 'extract':
        return '✳';
      case 'reduce':
        return 'Σ';
      case 'gate':
        return '⚑';
      case 'calibrate':
        return '⊹';
      case 'discover':
        return '◇';
      case 'rank':
        return '↕';
      case 'persist':
        return '⌸';
      case 'done':
        return '✓';
      default:
        return '▸';
    }
  }
}

/** Shared provenance styling: whether a score came from an agent or the local
 *  heuristic fallback. Used wherever a score is shown. */
export const PROVENANCE = {
  ai: { label: 'agent', color: '#16a34a' },
  heuristic: { label: 'fallback', color: '#d97706' },
} as const;
