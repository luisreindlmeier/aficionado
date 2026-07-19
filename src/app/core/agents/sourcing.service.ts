import { Injectable } from '@angular/core';
import type { SourcingEvent } from '../model';
import { readSse } from './sse';

@Injectable({ providedIn: 'root' })
export class SourcingService {
  /** Streams LOOP A sourcing events from /api/sourcing as they arrive. Same
   *  workflow the daily cron runs, just with the SSE emitter bound, so what the
   *  VC watches here is exactly what happens unattended at 06:00. */
  async *run(thesisId?: string, signal?: AbortSignal): AsyncGenerator<SourcingEvent> {
    const params = new URLSearchParams({ stream: '1' });
    if (thesisId && thesisId !== 'all') params.set('thesisId', thesisId);
    const res = await fetch(`/api/sourcing?${params}`, {
      headers: { Accept: 'text/event-stream' },
      signal,
    });
    yield* readSse<SourcingEvent>(res);
  }
}
