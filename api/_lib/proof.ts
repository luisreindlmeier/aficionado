import type { MetricVerdict, Signal } from '../../src/app/core/connectors/types';

// Deterministic fallback used when the AI Gateway is not configured, so the
// pipeline still returns a real score in local/dev without a model key.
export function scoreProofHeuristic(signals: readonly Signal[]): MetricVerdict {
  const connectors = new Set(signals.map((s) => s.connector));
  const maxValue = signals.reduce((m, s) => Math.max(m, s.value || 0), 0);

  const breadth = connectors.size * 8; // rewards evidence across many sources
  const magnitude = maxValue > 0 ? Math.min(45, Math.round(Math.log10(maxValue + 1) * 12)) : 0;
  const score = Math.max(0, Math.min(100, 15 + breadth + magnitude));

  return {
    metric: 'Proof',
    score,
    rationale: `Scored from ${signals.length} signals across ${connectors.size} sources (heuristic fallback).`,
    evidence: [...signals],
    by: 'heuristic',
  };
}
