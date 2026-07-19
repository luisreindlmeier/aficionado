import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FounderScore } from '../../src/app/core/model';
import type { FounderQuery } from '../../src/app/core/connectors/types';

// Supabase live layer. Writes use the service_role/secret key (bypasses RLS);
// reads fall back to it or the anon key. Every accessor returns null when no
// credentials are set, so the app degrades to the committed seed.

let admin: SupabaseClient | null = null;
let reader: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin ??= createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

export function supabaseReader(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  reader ??= createClient(url, key, { auth: { persistSession: false } });
  return reader;
}

export const supabaseEnabled = (): boolean => supabaseReader() !== null;

export interface DossierRow {
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
  proof: unknown;
  gravity: unknown;
  trajectory: unknown;
  team: unknown;
  team_score: unknown;
}

export interface CandidateRow {
  id: string;
  name: string;
  github: string | null;
  domain: string | null;
  headline: string | null;
  followers: number;
  top_repo: string | null;
  top_stars: number;
  thesis_id: string | null;
  triage: number;
  reason: string | null;
  evaluated: boolean;
}

/** Map an evaluated FounderScore to a cached_dossiers row. */
export function toDossierRow(
  id: string,
  q: FounderQuery,
  score: FounderScore,
  extra: { headline?: string; thesisId?: string; team?: unknown; teamScore?: unknown } = {},
): DossierRow {
  return {
    id,
    name: q.name,
    github: q.github ?? null,
    domain: q.domain ?? null,
    headline: extra.headline ?? null,
    thesis_id: extra.thesisId ?? null,
    composite: score.composite,
    raw_composite: score.rawComposite ?? null,
    band: score.band,
    percentile: score.percentile ?? null,
    confidence: score.confidence ?? null,
    capped: score.capped ?? false,
    cap_reason: score.capReason ?? null,
    proof: score.proof,
    gravity: score.gravity,
    trajectory: score.trajectory,
    team: extra.team ?? null,
    team_score: extra.teamScore ?? null,
  };
}

export async function upsertDossier(row: DossierRow): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;
  const { error } = await db
    .from('cached_dossiers')
    .upsert({ ...row, evaluated_at: new Date().toISOString() });
  return !error;
}

export async function upsertCandidates(rows: CandidateRow[]): Promise<number> {
  const db = supabaseAdmin();
  if (!db || !rows.length) return 0;
  const { error } = await db
    .from('sourcing_candidates')
    .upsert(rows.map((r) => ({ ...r, refreshed_at: new Date().toISOString() })));
  return error ? 0 : rows.length;
}

export async function readDossiers(): Promise<DossierRow[]> {
  const db = supabaseReader();
  if (!db) return [];
  const { data } = await db
    .from('cached_dossiers')
    .select('*')
    .order('composite', { ascending: false });
  return (data as DossierRow[] | null) ?? [];
}

export async function readCandidates(limit = 100): Promise<CandidateRow[]> {
  const db = supabaseReader();
  if (!db) return [];
  const { data } = await db
    .from('sourcing_candidates')
    .select('*')
    .order('triage', { ascending: false })
    .limit(limit);
  return (data as CandidateRow[] | null) ?? [];
}
