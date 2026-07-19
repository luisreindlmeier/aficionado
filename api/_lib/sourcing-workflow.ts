import { AsyncLocalStorage } from 'node:async_hooks';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import type { SourcingEvent, TraceStep } from '../../src/app/core/model';
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
// Like the evaluation workflow, SSE transport is decoupled via AsyncLocalStorage
// so the steps stay identical whether they run under the cron (no store, emit is
// a no-op) or under a streamed request from the Radar page.
// ─────────────────────────────────────────────────────────────

export const sourcingEmitter = new AsyncLocalStorage<(e: SourcingEvent) => void>();
const emit = (e: SourcingEvent): void => sourcingEmitter.getStore()?.(e);
const trace = (kind: TraceStep['kind'], label: string, detail?: string): void =>
  emit({ type: 'trace', step: { at: new Date().toISOString(), kind, label, detail } });

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  headline: z.string().optional(),
  github: z.string().optional(),
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
  /** 'agent' when the discovery agent picked the set, 'triage' on the fallback. */
  rankedBy: z.enum(['agent', 'triage']),
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
    emit({ type: 'thesis', id: active?.id, label: active?.label, keywords });
    trace('plan', `Sourcing for "${active?.label ?? 'unnamed thesis'}"`, keywords.join(', '));

    const founders = resolveFounders();
    trace('discover', `Scanning ${founders.length} founders for keyword overlap`);
    const candidates: Candidate[] = founders
      .map((f) => {
        const haystack = `${f.headline} ${f.name}`.toLowerCase();
        const overlap = keywords.filter((k) => haystack.includes(k)).length;
        const match = keywords.length ? overlap / keywords.length : 0;
        const triage = Math.round(clamp(0.5 * f.triage + 50 * match, 0, 100));
        return {
          id: f.id,
          name: f.name,
          headline: f.headline,
          github: f.handles?.github,
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
    let rankedBy: 'agent' | 'triage' = 'triage';

    if (aiEnabled() && candidates.length) {
      trace('rank', 'discovery-analyst ranking the pool against the thesis');
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
        if (ranked.length) {
          surfaced = ranked;
          rankedBy = 'agent';
        }
      } catch (err) {
        // keep the deterministic surfaced set
        trace('rank', 'Agent ranking failed, keeping the triage order', message(err));
      }
    } else {
      trace('rank', 'AI is off, surfacing by deterministic triage');
    }

    for (const c of surfaced) emit({ type: 'candidate', candidate: c });
    trace(
      'rank',
      `${surfaced.length} of ${candidates.length} founders surfaced`,
      rankedBy === 'agent' ? 'ranked by discovery-analyst' : 'ranked by triage',
    );
    return { thesisId, thesisLabel, surfaced, scanned: candidates.length, rankedBy };
  },
});

const persistStep = createStep({
  id: 'persist',
  inputSchema: rankOutSchema,
  outputSchema: persistOutSchema,
  execute: async ({ inputData }) => {
    let persisted = false;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      trace('persist', `Upserting ${inputData.surfaced.length} candidates to the queue`);
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
            headline: c.headline ?? null,
            github: c.github ?? null,
            thesis_id: inputData.thesisId,
            triage: c.triage,
            reason: c.reason ?? null,
            refreshed_at: new Date().toISOString(),
          })),
        );
        persisted = true;
        trace('persist', 'Candidate queue updated');
      } catch (err) {
        persisted = false;
        trace('persist', 'Persist failed, the pass was read-only', message(err));
      }
    } else {
      trace('persist', 'Supabase not configured, the pass was read-only');
    }

    emit({
      type: 'summary',
      scanned: inputData.scanned,
      surfaced: inputData.surfaced.length,
      persisted,
      rankedBy: inputData.rankedBy,
    });
    trace('done', 'Sourcing pass complete');
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
