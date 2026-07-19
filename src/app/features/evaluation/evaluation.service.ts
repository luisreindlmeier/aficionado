import { Injectable } from '@angular/core';
import type { EvalEvent } from '../../core/model';
import type { FounderQuery } from '../../core/connectors/types';
import { readSse } from '../../core/agents/sse';

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  /** Streams LOOP B evaluation events from /api/evaluate as they arrive. Each
   *  SSE frame is one EvalEvent (trace, phase, connector, signal, metric, final).
   *  The dossier renders these live as the "brain at work". */
  async *evaluate(query: FounderQuery, signal?: AbortSignal): AsyncGenerator<EvalEvent> {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(query),
      signal,
    });
    yield* readSse<EvalEvent>(res);
  }
}
