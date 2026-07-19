export type Metric = 'Proof' | 'Gravity' | 'Trajectory';

/** Distinct but understated colours for the three evaluation metrics. Shared app-wide. */
export const METRIC_COLORS: Readonly<Record<Metric, string>> = {
  Proof: '#0d9488', // teal
  Gravity: '#7c3aed', // violet
  Trajectory: '#2563eb', // blue
};
