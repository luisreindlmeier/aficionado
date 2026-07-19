// Smoke test for the LOOP B streaming pipeline. Drives the real /api/evaluate
// handler with a mock req/res and prints the SSE frames. Run:
//   npx tsx scripts/smoke-evaluate.ts
import handler from '../api/evaluate';

const req = {
  method: 'POST',
  body: { name: 'Luis Reindlmeier', github: 'luisreindlmeier', domain: 'gedonus.com' },
} as unknown as Parameters<typeof handler>[0];

let frames = 0;
const types: Record<string, number> = {};
const res = {
  setHeader() {},
  status() {
    return res;
  },
  json(x: unknown) {
    console.log('JSON', x);
  },
  write(s: string) {
    for (const line of s.split('\n')) {
      if (!line.startsWith('data:')) continue;
      frames++;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        types[ev.type] = (types[ev.type] || 0) + 1;
        const label =
          ev.type === 'trace'
            ? ev.step?.label
            : ev.type === 'metric'
              ? `${ev.score.metric}=${ev.score.score} (${ev.score.confidence})`
              : ev.type === 'final'
                ? `composite=${ev.score.composite} ${ev.score.band} p${ev.score.percentile}`
                : ev.type === 'signal'
                  ? `${ev.signal.connector}/${ev.signal.metric}: ${ev.signal.text}`
                  : ev.type === 'connector'
                    ? `${ev.connector} ${ev.status}`
                    : ev.type === 'phase'
                      ? `${ev.metric} [${ev.connectors.join(',')}]`
                      : ev.type === 'error'
                        ? ev.message
                        : '';
        console.log(`  ${ev.type.padEnd(9)} ${label ?? ''}`);
      } catch {
        /* ignore */
      }
    }
    return true;
  },
  end() {
    console.log(`\n--- END --- ${frames} frames, types:`, types);
  },
} as unknown as Parameters<typeof handler>[1];

void (async () => {
  await handler(req, res);
})();
