import { Injectable, computed, signal } from '@angular/core';
import type { Metric } from '../metrics';
import type {
  Band,
  ConfidenceLevel,
  Founder,
  FounderScore,
  Handles,
  MetricScore,
  PipelineStage,
  Receipt,
  SkillVector,
  TeamAnalysis,
  Thesis,
  Venture,
  WeightPreset,
} from '../model';
import {
  DEFAULT_PRESET,
  WEIGHT_PRESETS,
  bandOf,
  clamp,
  harmonizedTeamScore,
  log10p,
  recomputeComposite,
} from '../scoring';
import { ANCHORS } from './anchors';
import { SEED_FOUNDERS, SEED_VENTURES, THESES } from './seed';

/** The verdict line for a venture whose score comes from its team. */
function teamRationale(team: Pick<TeamAnalysis, 'score' | 'confidence' | 'compatibility'>): string {
  const lift = team.compatibility > 1.05;
  const shape = lift
    ? 'the founders cover ground each other does not'
    : 'the founders largely duplicate each other';
  return team.confidence === 'low'
    ? `Team reads at ${team.score}, but too little of it is verified to act on.`
    : `Team reads at ${team.score} on ${team.confidence} confidence, ${shape}.`;
}

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

const PIPELINE_STAGES: readonly PipelineStage[] = ['Discovered', 'Watch', 'Invest', 'Pass'];

const ZERO_SKILLS: SkillVector = { technical: 0, commercial: 0, domain: 0, product: 0 };

/** A cached_dossiers row as served by /api/founders. */
interface LiveDossier {
  id: string;
  name: string;
  github: string | null;
  domain: string | null;
  headline: string | null;
  thesis_id: string | null;
  composite: number;
  raw_composite: number | null;
  band: string;
  percentile: number | null;
  confidence: string | null;
  capped: boolean;
  cap_reason: string | null;
  proof: MetricScore;
  gravity: MetricScore;
  trajectory: MetricScore;
  team: readonly { name: string; skills: SkillVector }[] | null;
}

const pipelineFor = (band: string): PipelineStage =>
  band === 'Invest' || band === 'Watch' || band === 'Pass' ? (band as PipelineStage) : 'Discovered';

/** Map a live Supabase dossier onto the raw-seed founder shape the pipeline uses,
 *  so the rest of DataService (weight re-compute, filters) works unchanged. */
function mapDossier(r: LiveDossier): Founder & { discoveredOffsetMins: number } {
  const initials =
    r.name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || '??';
  const handles: Handles = {
    ...(r.github ? { github: r.github } : {}),
    ...(r.domain ? { website: r.domain } : {}),
  };
  const evidenceCount = [r.proof, r.gravity, r.trajectory].reduce(
    (n, m) => n + (m?.receipts?.length ?? 0),
    0,
  );
  const score: FounderScore = {
    proof: r.proof,
    gravity: r.gravity,
    trajectory: r.trajectory,
    composite: r.composite,
    rawComposite: r.raw_composite ?? r.composite,
    percentile: r.percentile ?? 50,
    band: (r.band as Band) ?? 'Pass',
    confidence: (r.confidence as ConfidenceLevel) ?? 'medium',
    capped: r.capped ?? false,
    capReason: r.cap_reason ?? undefined,
    skills: r.team?.[0]?.skills ?? ZERO_SKILLS,
  };
  return {
    id: r.id,
    name: r.name,
    initials,
    headline: r.headline ?? '',
    handles,
    ventureId: r.id,
    discoveredAt: '',
    discoveredOffsetMins: 5,
    thesisId: r.thesis_id ?? 'all',
    triage: Math.round(r.composite),
    pipeline: pipelineFor(r.band),
    score,
    redFlags: [],
    trajectory: [],
    evidenceCount,
  };
}

@Injectable({ providedIn: 'root' })
export class DataService {
  /** Session base time; discovery times are computed relative to it. */
  private readonly base = Date.now();

  /** Live dossiers from /api/founders (Supabase). Empty until loaded, or when the
   *  API is absent (plain `ng serve`) / offline, in which case the seed is used. */
  private readonly liveRows = signal<readonly (Founder & { discoveredOffsetMins: number })[]>([]);

  /** The founder source: live Supabase dossiers when present, else the seed. */
  private readonly source = computed(() =>
    this.liveRows().length ? this.liveRows() : SEED_FOUNDERS,
  );

  constructor() {
    void this.loadLive();
  }

  private async loadLive(): Promise<void> {
    try {
      const res = await fetch('/api/founders');
      if (!res.ok) return;
      const json = (await res.json()) as { dossiers?: LiveDossier[] };
      const rows = (json.dossiers ?? []).filter((d) => d?.proof).map(mapDossier);
      if (rows.length) this.liveRows.set(rows);
    } catch {
      /* no API or offline -> keep the committed seed */
    }
  }

  readonly theses = signal<readonly Thesis[]>(THESES);

  /** Ventures with their decision's `decidedAt` filled from the seed's offset,
   *  the same "always reads as freshly timestamped" trick used for founders.
   *  A venture routed to a human never gets a `decidedAt`, regardless of the
   *  seed offset: routeToHuman is what "still pending" actually means. `team`
   *  is computed live from the current founder pool rather than trusted from
   *  the seed, so it always reflects who is actually evaluated on the venture
   *  today (undefined below two founders, there is no team to harmonize). */
  readonly ventures = computed<readonly Venture[]>(() => {
    const founders = this.founders();
    return SEED_VENTURES.map((v) => {
      const withDecision: Venture =
        v.decision && !v.decision.routeToHuman && v.decidedOffsetMins != null
          ? {
              ...v,
              decision: {
                ...v.decision,
                decidedAt: new Date(this.base - v.decidedOffsetMins * 60_000).toISOString(),
              },
            }
          : (v as Venture);
      const team = harmonizedTeamScore(
        founders
          .filter((f) => f.ventureId === v.id && f.score)
          .map((f) => ({
            founderId: f.id,
            name: f.name,
            initials: f.initials,
            skills: f.score!.skills,
            composite: f.score!.composite,
            band: f.score!.band,
            metrics: {
              Proof: f.score!.proof.score,
              Gravity: f.score!.gravity.score,
              Trajectory: f.score!.trajectory.score,
            },
            confidences: {
              Proof: f.score!.proof.confidence,
              Gravity: f.score!.gravity.confidence,
              Trajectory: f.score!.trajectory.confidence,
            },
          })),
        this.weights(),
      );
      if (!team) return withDecision;
      // Once a venture has an evaluated team, the team IS the venture's verdict.
      // Anything else leaves two different numbers on the same page claiming to
      // be the aficionado score.
      return {
        ...withDecision,
        team: { ...team, sharedHistory: v.team?.sharedHistory ?? [] },
        decision: {
          ...withDecision.decision,
          composite: team.score,
          band: bandOf(team.score, team.confidence),
          confidence: team.confidence,
          rationale: teamRationale(team),
          routeToHuman: team.confidence === 'low',
        },
      };
    });
  });

  /** Active sourcing thesis for the Radar filter ('all' shows every thesis). */
  readonly activeThesisId = signal<string>('all');

  /** Active weight preset + the live weights it drives. */
  readonly presetId = signal<string>(DEFAULT_PRESET.id);
  readonly weights = signal<Record<Metric, number>>({ ...DEFAULT_PRESET.weights });
  readonly presets = WEIGHT_PRESETS;

  /** Gravity completions from a pasted profile, keyed by founder id. Pasting a
   *  LinkedIn or X profile turns a low-confidence Gravity into a measured one
   *  that the composite then includes (the "add LinkedIn and it re-computes"
   *  moment on the self-demo). */
  private readonly gravityOverrides = signal<Record<string, MetricScore>>({});

  /** Pipeline-stage promotions made by the sourcing agent, keyed by founder id.
   *  Overrides the seed's starting stage without mutating the snapshot; the
   *  Pipeline page is a read-only view of what the agents have decided. */
  private readonly pipelineOverrides = signal<Record<string, PipelineStage>>({});

  /** Founders with discovery timestamps filled and scores recomputed live. */
  readonly founders = computed<readonly Founder[]>(() => {
    const w = this.weights();
    const overrides = this.gravityOverrides();
    const stageOverrides = this.pipelineOverrides();
    return this.source().map((f) => {
      const discoveredAt = new Date(this.base - f.discoveredOffsetMins * 60_000).toISOString();
      const pipeline = stageOverrides[f.id] ?? f.pipeline;
      if (!f.score) return { ...f, discoveredAt, pipeline } as Founder;
      const gravity = overrides[f.id] ?? f.score.gravity;
      const r = recomputeComposite(
        {
          Proof: f.score.proof.score,
          Gravity: gravity.score,
          Trajectory: f.score.trajectory.score,
        },
        {
          Proof: f.score.proof.confidence,
          Gravity: gravity.confidence,
          Trajectory: f.score.trajectory.confidence,
        },
        f.redFlags,
        w,
        ANCHORS,
        f.name,
      );
      const score: FounderScore = {
        ...f.score,
        proof: { ...f.score.proof, weight: w.Proof },
        gravity: { ...gravity, weight: w.Gravity },
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
      const note = overrides[f.id] ? undefined : f.note;
      return { ...f, discoveredAt, pipeline, score, note } as Founder;
    });
  });

  /** True once a founder's Gravity has been completed from a pasted profile. */
  gravityCompleted(founderId: string): boolean {
    return founderId in this.gravityOverrides();
  }

  /** Complete Gravity from a pasted profile. Reads a connection or follower
   *  count if present, else estimates from the text, and produces a measured,
   *  medium-confidence Gravity the composite includes. */
  completeGravity(founderId: string, profileText: string): void {
    const text = (profileText || '').trim();
    if (text.length < 12) return;
    const match = text.match(/([\d][\d.,]*)\s*\+?\s*(connections|followers|contacts)/i);
    const reach = match
      ? parseInt(match[1].replace(/[.,]/g, ''), 10)
      : clamp(200 + text.length * 3, 200, 12000);
    const reachScore = clamp(Math.round((log10p(reach) / log10p(200000)) * 100) + 8, 6, 96);
    const senior = /founder|ceo|cto|lead|head of|director|partner|principal/i.test(text);
    const score = clamp(Math.round(reachScore * 0.6 + (senior ? 70 : 45) * 0.4), 6, 96);
    const receipts: Receipt[] = [
      {
        connector: 'linkedin',
        metric: 'Gravity',
        feature: 'True reach',
        text: `${reach.toLocaleString('en-US')} connections from the pasted profile`,
        value: reach,
      },
    ];
    const gravity: MetricScore = {
      metric: 'Gravity',
      score,
      weight: this.weights().Gravity,
      percentile: 50,
      confidence: 'medium' as ConfidenceLevel,
      completeness: 0.7,
      agreement: 0.7,
      rationale:
        'Reach is now measurable from the pasted profile, so Gravity is included in the composite.',
      features: [],
      receipts,
      by: 'heuristic',
    };
    this.gravityOverrides.update((o) => ({ ...o, [founderId]: gravity }));
  }

  resetGravity(founderId: string): void {
    this.gravityOverrides.update((o) => {
      const next = { ...o };
      delete next[founderId];
      return next;
    });
  }

  /** 'running' while a just-created thesis's sourcing pass is scanning the pool. */
  readonly sourcingStatus = signal<'idle' | 'running'>('idle');

  /** Founder ids matched by a user-created thesis's sourcing pass, keyed by thesis id.
   *  Only custom theses get an entry here; the curated seed theses keep their
   *  original, hand-assigned founder.thesisId filtering untouched. */
  private readonly thesisMatches = signal<Record<string, readonly string[]>>({});

  /** True once a thesis has a runner pass associated with it (custom, user-created). */
  isRunnerThesis(id: string | undefined): boolean {
    return !!id && id in this.thesisMatches();
  }

  matchCountFor(id: string): number {
    return this.thesisMatches()[id]?.length ?? 0;
  }

  /** Create a new sourcing thesis from user-specified parameters (label, description,
   *  focus keywords covering industry / geography / stage) and immediately run a
   *  sourcing pass against it, mirroring the triage the Loop A cron (`/api/sourcing`)
   *  runs server-side, applied here against the client-visible founder pool. */
  createThesis(input: { label: string; description: string; keywords: readonly string[] }): Thesis {
    const label = input.label.trim();
    const base = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const existingIds = new Set(this.theses().map((t) => t.id));
    let id = base || 'thesis';
    let n = 2;
    while (existingIds.has(id)) {
      id = `${base}-${n++}`;
    }
    const thesis: Thesis = {
      id,
      label,
      description: input.description.trim(),
      keywords: input.keywords,
      active: true,
    };
    this.theses.update((list) => [...list, thesis]);
    this.runSourcingPass(thesis);
    return thesis;
  }

  /** Simulate a sourcing pass: scan every founder's public-facing text for the
   *  thesis's keywords and surface the overlapping ones. Runs on a short delay so
   *  it reads as a real pass rather than an instant filter. A match is enough
   *  signal for the agent to automatically promote a fresh 'Discovered' founder
   *  onto Watch. */
  private runSourcingPass(thesis: Thesis): void {
    this.sourcingStatus.set('running');
    this.activeThesisId.set(thesis.id);
    const keywords = thesis.keywords.map((k) => k.toLowerCase()).filter(Boolean);
    setTimeout(() => {
      const matches = this.founders().filter((f) => {
        if (!keywords.length) return false;
        const haystack = `${f.name} ${f.headline} ${f.location ?? ''}`.toLowerCase();
        return keywords.some((k) => haystack.includes(k));
      });
      this.thesisMatches.update((m) => ({ ...m, [thesis.id]: matches.map((f) => f.id) }));
      const toPromote = matches.filter((f) => f.pipeline === 'Discovered').map((f) => f.id);
      if (toPromote.length) {
        this.pipelineOverrides.update((o) => {
          const next = { ...o };
          for (const id of toPromote) next[id] = 'Watch';
          return next;
        });
      }
      this.sourcingStatus.set('idle');
    }, 900);
  }

  /** The Radar feed: filtered by the active thesis, freshest first. Custom,
   *  runner-sourced theses filter by their sourcing-pass matches; curated seed
   *  theses keep their hand-assigned founder.thesisId filtering. */
  readonly radarFeed = computed<readonly Founder[]>(() => {
    const t = this.activeThesisId();
    const matches = this.thesisMatches();
    const list = this.founders().filter((f) => {
      if (t === 'all') return true;
      if (t in matches) return matches[t].includes(f.id);
      return f.thesisId === t;
    });
    return [...list].sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));
  });

  /** Founders grouped by pipeline stage, for the kanban. */
  readonly pipeline = computed<Record<PipelineStage, Founder[]>>(() => {
    const groups: Record<PipelineStage, Founder[]> = {
      Discovered: [],
      Watch: [],
      Invest: [],
      Pass: [],
    };
    for (const f of this.founders()) {
      groups[f.pipeline].push(f);
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

  /** When a founder's venture decision was logged, if it has been (undecided /
   *  routed-to-human ventures have no decidedAt yet). */
  decidedAtFor(f: Founder): string | undefined {
    return this.venture(f.ventureId)?.decision?.decidedAt;
  }

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
    return (
      WEIGHT_PRESETS.find((p) => p.id === this.presetId()) ?? { id: 'custom', label: 'Custom' }
    );
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

  /** Color for a Band verdict or a Pipeline stage; both share the same
   *  Invest / Watch / Pass vocabulary, plus the neutral 'Discovered' stage. */
  bandColor(band: PipelineStage | Band | undefined): string {
    switch (band) {
      case 'Invest':
        return '#16a34a';
      case 'Watch':
        return '#d97706';
      case 'Pass':
        return '#a3a3a3';
      case 'Discovered':
        return '#2563eb';
      default:
        return '#a3a3a3';
    }
  }
}
