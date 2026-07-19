import { Injectable, computed, signal } from '@angular/core';
import type { Metric } from '../metrics';
import type {
  Band,
  Founder,
  FounderScore,
  PipelineStage,
  Thesis,
  Venture,
  WeightPreset,
} from '../model';
import { DEFAULT_PRESET, WEIGHT_PRESETS, recomputeComposite } from '../scoring';
import { ANCHORS } from './anchors';
import { SEED_FOUNDERS, SEED_VENTURES, THESES } from './seed';

// ─────────────────────────────────────────────────────────────
// The single client-side data layer. Reads the committed real-data
// snapshot (seed.ts) and exposes founders, ventures, theses and the
// live decision list. Discovery timestamps are computed from an
// offset at load time so the Radar always reads as freshly sourced.
// Metric scores are weight-independent; the composite / band /
// percentile are RE-COMPUTED from the active weight preset, so the
// Settings sliders re-rank the whole pipeline live. Swappable for an
// /api-backed source later without touching the pages.
// ─────────────────────────────────────────────────────────────

const PIPELINE_STAGES: readonly PipelineStage[] = ['Watch', 'Evaluating', 'Decided'];

@Injectable({ providedIn: 'root' })
export class DataService {
  /** Session base time; discovery times are computed relative to it. */
  private readonly base = Date.now();

  readonly theses = signal<readonly Thesis[]>(THESES);
  readonly ventures = signal<readonly Venture[]>(SEED_VENTURES);

  /** Active sourcing thesis for the Radar filter ('all' shows every thesis). */
  readonly activeThesisId = signal<string>('all');

  /** Active weight preset + the live weights it drives. */
  readonly presetId = signal<string>(DEFAULT_PRESET.id);
  readonly weights = signal<Record<Metric, number>>({ ...DEFAULT_PRESET.weights });
  readonly presets = WEIGHT_PRESETS;

  /** Founders with discovery timestamps filled and scores recomputed live. */
  readonly founders = computed<readonly Founder[]>(() => {
    const w = this.weights();
    return SEED_FOUNDERS.map((f) => {
      const discoveredAt = new Date(this.base - f.discoveredOffsetMins * 60_000).toISOString();
      if (!f.score) return { ...f, discoveredAt } as Founder;
      const r = recomputeComposite(
        { Proof: f.score.proof.score, Gravity: f.score.gravity.score, Trajectory: f.score.trajectory.score },
        { Proof: f.score.proof.confidence, Gravity: f.score.gravity.confidence, Trajectory: f.score.trajectory.confidence },
        f.redFlags,
        w,
        ANCHORS,
        f.name,
      );
      const score: FounderScore = {
        ...f.score,
        proof: { ...f.score.proof, weight: w.Proof },
        gravity: { ...f.score.gravity, weight: w.Gravity },
        trajectory: { ...f.score.trajectory, weight: w.Trajectory },
        composite: r.composite,
        rawComposite: r.rawComposite,
        percentile: r.percentile,
        band: r.band,
        confidence: r.confidence,
        capped: r.capped,
        capReason: r.capReason,
        anchorNeighbor: r.anchorNeighbor ?? f.score.anchorNeighbor,
      };
      return { ...f, discoveredAt, score } as Founder;
    });
  });

  /** The Radar feed: filtered by the active thesis, freshest first. */
  readonly radarFeed = computed<readonly Founder[]>(() => {
    const t = this.activeThesisId();
    const list = this.founders().filter((f) => t === 'all' || f.thesisId === t);
    return [...list].sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));
  });

  /** Founders grouped by pipeline stage, for the kanban. */
  readonly pipeline = computed<Record<PipelineStage, Founder[]>>(() => {
    const groups: Record<PipelineStage, Founder[]> = { Watch: [], Evaluating: [], Decided: [] };
    for (const f of this.founders()) {
      const stage = f.pipeline ?? 'Watch';
      groups[stage].push(f);
    }
    return groups;
  });

  readonly pipelineStages = PIPELINE_STAGES;

  /** Ventures with a decision, paired with their primary founder, for Decision. */
  readonly decisions = computed(() => {
    const founders = this.founders();
    return this.ventures()
      .map((v) => {
        const founder = founders.find((f) => f.ventureId === v.id);
        return founder ? { venture: v, founder } : null;
      })
      .filter((x): x is { venture: Venture; founder: Founder } => x !== null)
      .sort((a, b) => (b.founder.score?.composite ?? 0) - (a.founder.score?.composite ?? 0));
  });

  /** Convenience: the self-demo hero. */
  readonly hero = computed(() => this.founder('luis-reindlmeier'));

  founder(id: string): Founder | undefined {
    return this.founders().find((f) => f.id === id);
  }

  venture(id: string | undefined): Venture | undefined {
    return id ? this.ventures().find((v) => v.id === id) : undefined;
  }

  foundersForVenture(ventureId: string): Founder[] {
    return this.founders().filter((f) => f.ventureId === ventureId);
  }

  thesis(id: string): Thesis | undefined {
    return this.theses().find((t) => t.id === id);
  }

  setThesis(id: string): void {
    this.activeThesisId.set(id);
  }

  setPreset(id: string): void {
    const preset = WEIGHT_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    this.presetId.set(id);
    this.weights.set({ ...preset.weights });
  }

  setWeight(metric: Metric, value: number): void {
    this.presetId.set('custom');
    this.weights.update((w) => ({ ...w, [metric]: value }));
  }

  activePreset(): WeightPreset | { id: string; label: string } {
    return WEIGHT_PRESETS.find((p) => p.id === this.presetId()) ?? { id: 'custom', label: 'Custom' };
  }

  /** Human "time ago" for discovery timestamps. */
  timeAgo(iso: string): string {
    const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    return `${days}d ago`;
  }

  bandColor(band: Band | undefined): string {
    switch (band) {
      case 'Invest':
        return '#16a34a';
      case 'Watch':
        return '#d97706';
      case 'Pass':
        return '#a3a3a3';
      default:
        return '#a3a3a3';
    }
  }
}
