// Seed a Supabase project with the committed real-data snapshot.
// Idempotent (upserts). Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and
// @supabase/supabase-js. Run after applying supabase/migrations/0001_init.sql:
//   pnpm add @supabase/supabase-js
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-supabase.mjs
import { readFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. See supabase/README.md.');
  process.exit(1);
}

let createClient;
try {
  ({ createClient } = await import('@supabase/supabase-js'));
} catch {
  console.error('Missing dependency. Run: pnpm add @supabase/supabase-js');
  process.exit(1);
}

const data = JSON.parse(await readFile(new URL('../supabase/seed-data.json', import.meta.url), 'utf8'));
const db = createClient(url, key, { auth: { persistSession: false } });
const now = Date.now();

async function upsert(table, rows, onConflict = 'id') {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table}: ${rows.length}`);
}

console.log('Seeding Supabase...');

await upsert('theses', data.theses.map((t) => ({
  id: t.id, label: t.label, description: t.description, keywords: t.keywords, active: t.active,
})));

await upsert('ventures', data.ventures.map((v) => ({
  id: v.id, name: v.name, monogram: v.monogram, tagline: v.tagline, problem: v.problem,
  stage: v.stage, industry: v.industry, location: v.location ?? null, founded_year: v.foundedYear ?? null,
  website: v.website ?? null, decision: v.decision ?? null, team: v.team ?? null,
})));

await upsert('founders', data.founders.map((f) => ({
  id: f.id, name: f.name, initials: f.initials, headline: f.headline, location: f.location ?? null,
  handles: f.handles ?? {}, venture_id: f.ventureId, thesis_id: f.thesisId, triage: f.triage,
  status: f.status, pipeline: f.pipeline ?? null,
  discovered_at: new Date(now - (f.discoveredOffsetMins ?? 0) * 60000).toISOString(),
  evidence_count: f.evidenceCount ?? 0, note: f.note ?? null,
})));

// One current score row per founder + its evidence receipts + trajectory points.
const scores = [], evidence = [], points = [];
for (const f of data.founders) {
  if (!f.score) continue;
  const s = f.score;
  scores.push({
    founder_id: f.id, composite: s.composite, raw_composite: s.rawComposite, percentile: s.percentile,
    band: s.band, confidence: s.confidence, capped: s.capped, cap_reason: s.capReason ?? null,
    anchor_neighbor: s.anchorNeighbor ?? null, skills: s.skills ?? null,
    proof: s.proof, gravity: s.gravity, trajectory: s.trajectory,
    weights: { Proof: s.proof.weight, Gravity: s.gravity.weight, Trajectory: s.trajectory.weight },
  });
  for (const m of [s.proof, s.gravity, s.trajectory]) {
    for (const r of m.receipts ?? []) {
      evidence.push({ founder_id: f.id, metric: r.metric, connector: r.connector, feature: r.feature ?? null,
        text: r.text, quote: r.quote ?? null, value: r.value ?? null, url: r.url ?? null,
        at: r.at ?? null, weight: r.weight ?? null });
    }
  }
  for (const p of f.trajectory ?? []) {
    points.push({ founder_id: f.id, date: p.date, value: p.value, label: p.label ?? null,
      kind: p.kind ?? null, url: p.url ?? null });
  }
}
// Clean re-seed of the child tables (no extra unique constraints needed).
const ids = data.founders.map((f) => f.id);
async function insert(table, rows) {
  if (!rows.length) return;
  const { error } = await db.from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table}: ${rows.length}`);
}
await db.from('evidence').delete().in('founder_id', ids);
await db.from('trajectory_points').delete().in('founder_id', ids);
await db.from('scores').delete().in('founder_id', ids);
await insert('scores', scores);
await insert('evidence', evidence);
await insert('trajectory_points', points);

await db.from('anchors').delete().neq('name', '');
await insert('anchors', data.anchors.map((a) => ({
  name: a.name, display: a.display ?? null, outcome: a.outcome, proof: a.proof, gravity: a.gravity,
  trajectory: a.trajectory, note: a.note,
})));

console.log('Done. Supabase now holds the discovered founders and their dossiers.');
