import { BaseExporter } from '@mastra/observability';
import { TracingEventType, type AnyExportedSpan, type TracingEvent } from '@mastra/core/observability';

// ─────────────────────────────────────────────────────────────
// Mastra telemetry, tapped in-process.
//
// Mastra already traces every agent call and tool call and ships it to the
// Mastra Platform dashboard. This exporter subscribes to the SAME span stream
// and keeps a local copy, so cost, token usage and per-connector latency can be
// shown in the app instead of only in an external tool.
//
// Spans are buffered in memory and drained explicitly rather than written as
// they arrive. Both execution models make this safe: a serverless invocation
// handles exactly one run and drains before it returns, and the hourly script
// drains after each founder. A per-span write would mean a database round trip
// inside the agent's hot path.
// ─────────────────────────────────────────────────────────────

export interface SpanRecord {
  id: string;
  trace_id: string;
  parent_span_id: string | null;
  type: string;
  name: string;
  entity_id: string | null;
  entity_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  model: string | null;
  provider: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  reasoning_tokens: number | null;
  cost_usd: number | null;
  error: string | null;
}

/** Per-million-token prices, read from env. Cost is left null when these are
 *  unset: Mastra bundles a pricing table but does not export it, and inventing
 *  a rate would put a fabricated unit economic in front of an investor. */
function pricing(): { input: number; output: number; cached: number } | null {
  const input = Number(process.env.MODEL_PRICE_INPUT_PER_M);
  const output = Number(process.env.MODEL_PRICE_OUTPUT_PER_M);
  if (!Number.isFinite(input) || !Number.isFinite(output) || (!input && !output)) return null;
  const cached = Number(process.env.MODEL_PRICE_CACHED_INPUT_PER_M);
  return { input, output, cached: Number.isFinite(cached) ? cached : input };
}

function costOf(rec: SpanRecord): number | null {
  const p = pricing();
  if (!p) return null;
  const cached = rec.cache_read_tokens ?? 0;
  // Cached input is billed at the cheaper rate, so it must not be counted twice.
  const freshInput = Math.max(0, (rec.input_tokens ?? 0) - cached);
  const usd =
    (freshInput / 1_000_000) * p.input +
    (cached / 1_000_000) * p.cached +
    ((rec.output_tokens ?? 0) / 1_000_000) * p.output;
  return Number(usd.toFixed(6));
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Token counts, folding in `internalUsage`: Mastra rolls usage from hidden
 *  descendant spans onto the nearest exported ancestor, so the visible `usage`
 *  alone undercounts. */
function usageOf(attrs: Record<string, unknown>): {
  input: number | null;
  output: number | null;
  cached: number | null;
  reasoning: number | null;
} {
  const sum = (a: number | null, b: number | null): number | null =>
    a === null && b === null ? null : (a ?? 0) + (b ?? 0);

  const read = (u: unknown) => {
    const usage = (u ?? {}) as Record<string, unknown>;
    const inDetails = (usage['inputDetails'] ?? {}) as Record<string, unknown>;
    const outDetails = (usage['outputDetails'] ?? {}) as Record<string, unknown>;
    return {
      input: num(usage['inputTokens']),
      output: num(usage['outputTokens']),
      cached: num(inDetails['cacheRead']),
      reasoning: num(outDetails['reasoning']),
    };
  };

  const a = read(attrs['usage']);
  const b = read(attrs['internalUsage']);
  return {
    input: sum(a.input, b.input),
    output: sum(a.output, b.output),
    cached: sum(a.cached, b.cached),
    reasoning: sum(a.reasoning, b.reasoning),
  };
}

function toRecord(span: AnyExportedSpan): SpanRecord {
  const attrs = (span.attributes ?? {}) as Record<string, unknown>;
  const usage = usageOf(attrs);
  const started = span.startTime instanceof Date ? span.startTime : new Date(span.startTime);
  const ended = span.endTime ? (span.endTime instanceof Date ? span.endTime : new Date(span.endTime)) : null;

  const rec: SpanRecord = {
    id: span.id,
    trace_id: span.traceId,
    parent_span_id: span.parentSpanId ?? null,
    type: String(span.type),
    name: span.name,
    entity_id: span.entityId ?? null,
    entity_name: span.entityName ?? null,
    started_at: started.toISOString(),
    ended_at: ended ? ended.toISOString() : null,
    duration_ms: ended ? ended.getTime() - started.getTime() : null,
    model: str(attrs['model']),
    provider: str(attrs['provider']),
    input_tokens: usage.input,
    output_tokens: usage.output,
    cache_read_tokens: usage.cached,
    reasoning_tokens: usage.reasoning,
    cost_usd: null,
    error: span.errorInfo?.message ?? null,
  };
  rec.cost_usd = costOf(rec);
  return rec;
}

// Module-level buffer, capped so a pathological run cannot exhaust memory.
const MAX_BUFFERED = 2000;
let buffer: SpanRecord[] = [];
let dropped = 0;

export class SupabaseMetricsExporter extends BaseExporter {
  name = 'aficionado-metrics';

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Only completed spans carry a duration and final usage.
    if (event.type !== TracingEventType.SPAN_ENDED) return;
    if (buffer.length >= MAX_BUFFERED) {
      dropped++;
      return;
    }
    try {
      buffer.push(toRecord(event.exportedSpan));
    } catch {
      // Telemetry must never break the run that produced it.
    }
  }
}

/** Take everything buffered since the last drain and clear it. */
export function drainSpans(): SpanRecord[] {
  const out = buffer;
  buffer = [];
  if (dropped) {
    console.error(`metrics: dropped ${dropped} spans over the ${MAX_BUFFERED} buffer cap`);
    dropped = 0;
  }
  return out;
}

/** The one span level that owns an LLM call's token usage.
 *
 *  Mastra reports the SAME usage at three nested levels: model_generation (the
 *  call), and its model_step / model_inference children. Summing every span
 *  that carries usage therefore triple counts. Only this type is counted. */
export const TOKEN_BEARING_SPAN = 'model_generation';

/** Aggregate a drained set into the roll-ups stored on the run row. */
export function summarize(spans: readonly SpanRecord[]): {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  model_calls: number;
  tool_calls: number;
} {
  let input = 0;
  let output = 0;
  let cost = 0;
  let costed = false;
  let modelCalls = 0;
  let toolCalls = 0;
  for (const s of spans) {
    if (s.type === TOKEN_BEARING_SPAN) {
      modelCalls++;
      input += s.input_tokens ?? 0;
      output += s.output_tokens ?? 0;
      if (s.cost_usd !== null) {
        cost += s.cost_usd;
        costed = true;
      }
    }
    if (s.type === 'tool_call' || s.type === 'mcp_tool_call') toolCalls++;
  }
  return {
    input_tokens: input,
    output_tokens: output,
    cost_usd: costed ? Number(cost.toFixed(6)) : null,
    model_calls: modelCalls,
    tool_calls: toolCalls,
  };
}

/** True when pricing is configured, so the UI can explain a missing cost. */
export const pricingConfigured = (): boolean => pricing() !== null;
