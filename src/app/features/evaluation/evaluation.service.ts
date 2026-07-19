import { Injectable } from '@angular/core';
import { EvaluationEvent, FounderQuery } from '../../core/connectors/types';

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  /** Streams Proof evaluation events from /api/evaluate as they arrive. */
  async *scoreProof(query: FounderQuery, signal?: AbortSignal): AsyncGenerator<EvaluationEvent> {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Evaluation failed (${res.status})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const line = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        try {
          yield JSON.parse(line.slice(5).trim()) as EvaluationEvent;
        } catch {
          // ignore malformed frames
        }
      }
    }
  }
}
