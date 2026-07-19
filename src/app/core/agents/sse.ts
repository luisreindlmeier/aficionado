/** Read a `text/event-stream` response as a typed async iterable of frames.
 *  Both agent loops stream the same way (one JSON payload per `data:` frame),
 *  so the parsing lives here once. Malformed frames are skipped rather than
 *  killing the stream: a dropped frame costs one trace line, not the run. */
export async function* readSse<T>(res: Response): AsyncGenerator<T> {
  if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status})`);
  // A dev server with no /api handler answers unknown routes with index.html at
  // 200, which would otherwise parse as an empty stream and read as a pass that
  // found nothing. Demand the real content type so callers can fall back.
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('text/event-stream')) {
    throw new Error('No streaming backend available');
  }

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
        yield JSON.parse(line.slice(5).trim()) as T;
      } catch {
        // ignore malformed frames
      }
    }
  }
}
