import type { Founder, FounderScore } from '../../src/app/core/model';
import { DEFAULT_PRESET, recomputeComposite } from '../../src/app/core/scoring';
import { ANCHORS } from '../../src/app/core/data/anchors';
import { SEED_FOUNDERS } from '../../src/app/core/data/seed';

// Node-safe resolver over the committed seed (isomorphic, type-only imports).
// Fills discovery timestamps from the stored offset and recomputes the
// weight-dependent parts of each score under DEFAULT_PRESET, mirroring the
// client DataService so /api results match the app.
export function resolveFounders(base = Date.now()): Founder[] {
  const w = DEFAULT_PRESET.weights;
  return SEED_FOUNDERS.map((f) => {
    const discoveredAt = new Date(base - f.discoveredOffsetMins * 60_000).toISOString();
    if (!f.score) return { ...f, discoveredAt } as Founder;
    const r = recomputeComposite(
      {
        Proof: f.score.proof.score,
        Gravity: f.score.gravity.score,
        Trajectory: f.score.trajectory.score,
      },
      {
        Proof: f.score.proof.confidence,
        Gravity: f.score.gravity.confidence,
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
}

export function resolveFounder(id: string, base = Date.now()): Founder | undefined {
  return resolveFounders(base).find((f) => f.id === id);
}
