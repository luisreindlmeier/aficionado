// Smoke test for the agent metrics read model. Drives /api/agent-runs with a
// mock req/res and prints the aggregates. Run: npx tsx scripts/smoke-metrics.ts
import handler from '../api/agent-runs';

const req = { query: {}, headers: {} } as unknown as Parameters<typeof handler>[0];
const res = {
  setHeader() {},
  status() {
    return res;
  },
  json(x: unknown) {
    const j = x as { runs?: unknown[]; metrics?: unknown };
    console.log('runs returned:', j.runs?.length);
    console.log(JSON.stringify(j.metrics, null, 2));
  },
} as unknown as Parameters<typeof handler>[1];

handler(req, res).catch((e: unknown) => {
  console.error('FAILED', e);
  process.exitCode = 1;
});
