import { Component, computed, input } from '@angular/core';
import type { SkillVector } from '../../core/model';

export interface RadarSeries {
  readonly name: string;
  readonly color: string;
  readonly vector: SkillVector;
}

interface Axis {
  readonly key: keyof SkillVector;
  readonly label: string;
  readonly ux: number;
  readonly uy: number;
  readonly lx: number;
  readonly ly: number;
  readonly anchor: 'start' | 'middle' | 'end';
}

interface Vertex {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly value: number;
}

interface Plotted {
  readonly name: string;
  readonly color: string;
  readonly points: string;
  readonly vertices: readonly Vertex[];
}

const CX = 145;
const CY = 120;
const R = 82;

// Four skill axes, laid out clockwise from the top. Unit vectors and label
// offsets are precomputed so the template stays declarative.
const AXES: readonly Axis[] = [
  { key: 'technical', label: 'Technical', ux: 0, uy: -1, lx: 0, ly: -14, anchor: 'middle' },
  { key: 'commercial', label: 'Commercial', ux: 1, uy: 0, lx: 16, ly: 4, anchor: 'start' },
  { key: 'domain', label: 'Domain', ux: 0, uy: 1, lx: 0, ly: 20, anchor: 'middle' },
  { key: 'product', label: 'Product', ux: -1, uy: 0, lx: -16, ly: 4, anchor: 'end' },
];

// Overlaid skill-vector radar: one filled polygon per founder across the four
// axes, so complementary coverage (each founder peaking where the others dip)
// reads at a glance. Grid and axes are recessive; identity is carried by the
// legend, never colour alone.
@Component({
  selector: 'app-founder-radar',
  template: `
    <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      <svg [attr.viewBox]="'0 0 320 250'" class="w-full max-w-[300px] shrink-0">
        <!-- rings -->
        @for (ring of rings; track ring) {
          <circle
            [attr.cx]="cx"
            [attr.cy]="cy"
            [attr.r]="ring"
            fill="none"
            stroke="#e5e5e5"
            stroke-width="1"
          />
        }
        <!-- spokes -->
        @for (a of axes; track a.key) {
          <line
            [attr.x1]="cx"
            [attr.y1]="cy"
            [attr.x2]="cx + a.ux * radius"
            [attr.y2]="cy + a.uy * radius"
            stroke="#e5e5e5"
            stroke-width="1"
          />
        }
        <!-- founder polygons -->
        @for (s of plotted(); track s.name) {
          <polygon
            [attr.points]="s.points"
            [attr.fill]="s.color"
            fill-opacity="0.12"
            [attr.stroke]="s.color"
            stroke-width="2"
            stroke-linejoin="round"
          />
        }
        @for (s of plotted(); track s.name) {
          @for (v of s.vertices; track v.label) {
            <circle [attr.cx]="v.x" [attr.cy]="v.y" r="3" [attr.fill]="s.color">
              <title>{{ s.name }}, {{ v.label }}: {{ v.value }}</title>
            </circle>
          }
        }
        <!-- axis labels -->
        @for (a of axes; track a.key) {
          <text
            [attr.x]="cx + a.ux * radius + a.lx"
            [attr.y]="cy + a.uy * radius + a.ly"
            [attr.text-anchor]="a.anchor"
            font-size="11"
            fill="#737373"
          >
            {{ a.label }}
          </text>
        }
      </svg>

      <div class="min-w-0 flex-1">
        <ul class="flex flex-col gap-2">
          @for (s of series(); track s.name) {
            <li class="flex items-center gap-2 text-[13px] text-foreground">
              <span class="size-2.5 shrink-0 rounded-full" [style.background]="s.color"></span>
              {{ s.name }}
            </li>
          }
        </ul>
        <div class="mt-4 border-t-[0.5px] border-border pt-3">
          <p class="text-[12px] text-muted-foreground">{{ takeaway() }}</p>
        </div>
      </div>
    </div>
  `,
})
export class FounderRadar {
  readonly series = input.required<readonly RadarSeries[]>();

  protected readonly cx = CX;
  protected readonly cy = CY;
  protected readonly radius = R;
  protected readonly axes = AXES;
  protected readonly rings = [R * 0.25, R * 0.5, R * 0.75, R];

  protected readonly plotted = computed<Plotted[]>(() =>
    this.series().map((s) => {
      const vertices = AXES.map((a) => {
        const v = clamp01(s.vector[a.key]);
        return {
          x: CX + a.ux * R * v,
          y: CY + a.uy * R * v,
          label: a.label,
          value: Math.round(v * 100),
        };
      });
      return {
        name: s.name,
        color: s.color,
        points: vertices.map((p) => `${round(p.x)},${round(p.y)}`).join(' '),
        vertices,
      };
    }),
  );

  // A plain-language read of complementarity: where the combined team is strong
  // (someone covers the axis) and where every founder is weak (a real gap).
  protected readonly takeaway = computed<string>(() => {
    const series = this.series();
    if (series.length < 2) return 'Add a co-founder to see how the vectors complement each other.';
    const covered: string[] = [];
    const gaps: string[] = [];
    for (const a of AXES) {
      const best = Math.max(...series.map((s) => clamp01(s.vector[a.key])));
      if (best >= 0.7) covered.push(a.label);
      else if (best < 0.45) gaps.push(a.label);
    }
    const parts: string[] = [];
    if (covered.length) parts.push(`Covered by someone strong: ${covered.join(', ')}.`);
    if (gaps.length) parts.push(`Still thin across the team: ${gaps.join(', ')}.`);
    if (!parts.length) return 'Even coverage across all four axes, no obvious gap or overlap.';
    return parts.join(' ');
  });
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round(x: number): number {
  return Math.round(x * 10) / 10;
}
