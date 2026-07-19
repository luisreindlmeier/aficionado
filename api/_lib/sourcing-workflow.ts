import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { THESES } from '../../src/app/core/data/seed';
import { clamp } from '../../src/app/core/scoring';
import { resolveFounders } from './founders';
import { aiEnabled, discoveryAgent } from './mastra';

// ─────────────────────────────────────────────────────────────
// LOOP A as a Mastra workflow: discover -> rank (discovery agent) -> persist.
// discover computes the same deterministic keyword-overlap triage as before; the
// discovery agent then selects/ranks genuine thesis matches (falling back to the
// triage sort when AI is off); persist upserts to the Supabase candidate queue
// when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (no-op otherwise).
// ─────────────────────────────────────────────────────────────

const candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  thesisId: z.string().optional(),
  triage: z.number(),
  onThesis: z.boolean(),
  reason: z.string().optional(),
});
type Candidate = z.infer<typeof candidateSchema>;

const sourcingInputSchema = z.object({ thesisId: z.string().optional() });

const discoverOutSchema = z.object({
  thesisId: z.string().optional(),
  thesisLabel: z.string().optional(),
  keywords: z.array(z.string()),
  candidates: z.array(candidateSchema),
});

const rankOutSchema = z.object({
  thesisId: z.string().optional(),
  thesisLabel: z.string().optional(),
  surfaced: z.array(candidateSchema),
  scanned: z.number(),
});

const persistOutSchema = rankOutSchema.extend({ persisted: z.boolean() });

const discoverStep = createStep({
  id: 'discover',
  inputSchema: sourcingInputSchema,
  outputSchema: discoverOutSchema,
  execute: async ({ inputData }) => {
    const active =
      (inputData.thesisId ? THESES.find((t) => t.id === inputData.thesisId) : undefined) ??
      THESES.find((t) => t.active) ??
      THESES[0];
    const keywords = (active?.keywords ?? []).map((k) => k.toLowerCase());
    const founders = resolveFounders();
    const candidates: Candidate[] = founders
      .map((f) => {
        const haystack = `${f.headline} ${f.name}`.toLowerCase();
        const overlap = keywords.filter((k) => haystack.includes(k)).length;
        const match = keywords.length ? overlap / keywords.length : 0;
        const triage = Math.round(clamp(0.5 * f.triage + 50 * match, 0, 100));
        return {
          id: f.id,
          name: f.name,
          thesisId: f.thesisId,
          triage,
          onThesis: f.thesisId === active?.id,
        };
      })
      .sort((a, b) => b.triage - a.triage);
    return { thesisId: active?.id, thesisLabel: active?.label, keywords, candidates };
  },
});

const rankStep = createStep({
  id: 'rank',
  inputSchema: discoverOutSchema,
  outputSchema: rankOutSchema,
  execute: async ({ inputData }) => {
    const { thesisId, thesisLabel, keywords, candidates } = inputData;
    let surfaced: Candidate[] = candidates.filter((c) => c.onThesis || c.triage >= 60);

    if (aiEnabled() && candidates.length) {
      try {
        const pool = candidates
          .slice(0, 30)
          .map((c) => `${c.id} | ${c.name} | triage ${c.triage}`)
          .join('\n');
        const { object } = await discoveryAgent.generate(
          `Active thesis: ${thesisLabel ?? 'unnamed'} (keywords: ${keywords.join(', ')}).\n` +
            `Candidates (id | name | triage):\n${pool}\n\n` +
            `Return the founders that genuinely match this thesis, strongest first, each with a one-line reason.`,
          {
            structuredOutput: {
              schema: z.object({
                matches: z.array(z.object({ id: z.string(), reason: z.string() })),
              }),
            },
          },
        );
        const byId = new Map(candidates.map((c) => [c.id, c]));
        const ranked = object.matches
          .map((m) => {
            const c = byId.get(m.id);
            return c ? { ...c, reason: m.reason, onThesis: true } : undefined;
          })
          .filter((c) => c !== undefined) as Candidate[];
        if (ranked.length) surfaced = ranked;
      } catch {
        // keep the deterministic surfaced set
      }
    }
    return { thesisId, thesisLabel, surfaced, scanned: candidates.length };
  },
});

const persistStep = createStep({
  id: 'persist',
  inputSchema: rankOutSchema,
  outputSchema: persistOutSchema,
  execute: async ({ inputData }) => {
    let persisted = false;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const specifier = '@supabase/' + 'supabase-js';
        const mod = (await import(specifier)) as {
          createClient: (
            url: string,
            key: string,
          ) => { from: (t: string) => { upsert: (rows: unknown[]) => Promise<unknown> } };
        };
        const supabase = mod.createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
        );
        await supabase.from('sourcing_candidates').upsert(
          inputData.surfaced.map((c) => ({
            id: c.id,
            name: c.name,
            thesis_id: inputData.thesisId,
            triage: c.triage,
            reason: c.reason ?? null,
            refreshed_at: new Date().toISOString(),
          })),
        );
        persisted = true;
      } catch {
        persisted = false;
      }
    }
    return { ...inputData, persisted };
  },
});

export const sourcingWorkflow = createWorkflow({
  id: 'thesis-sourcing',
  inputSchema: sourcingInputSchema,
  outputSchema: persistOutSchema,
})
  .then(discoverStep)
  .then(rankStep)
  .then(persistStep)
  .commit();
