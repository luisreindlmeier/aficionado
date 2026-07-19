// Smoke test for the LOOP A streaming pipeline. Drives the real /api/sourcing
// handler with a mock req/res in stream mode and prints the SSE frames. Run:
//   npx tsx scripts/smoke-sourcing.ts
import handler from '../api/sourcing';

const req = {
  method: 'GET',
  query: { stream: '1' },
  headers: {},
} as unknown as Parameters<typeof handler>[0];

let frames = 0;
const types: Record<string, number> = {};
const res = {
  setHeader() {},
  flushHeaders() {},
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
        const ev = JSON.parse(line.slice(5).trim()) as { type: string; step?: { label: string } };
        types[ev.type] = (types[ev.type] ?? 0) + 1;
        if (ev.type === 'trace') console.log('  trace:', ev.step?.label);
        else console.log('  ', ev.type, JSON.stringify(ev).slice(0, 120));
      } catch {
        console.log('  (unparseable frame)');
      }
    }
    return true;
  },
  end() {
    console.log(`\n${frames} frames`, types);
  },
} as unknown as Parameters<typeof handler>[1];

handler(req, res).catch((err: unknown) => {
  console.error('failed', err);
  process.exitCode = 1;
});
