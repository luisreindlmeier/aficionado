// Smoke test the read endpoints the same way Vercel invokes them.
//   npx tsx scripts/smoke-endpoints.ts
import radar from '../api/radar';
import founder from '../api/founder';
import sourcing from '../api/sourcing';

function mockRes() {
  const res: any = {
    _status: 200,
    _json: null as unknown,
    status(c: number) {
      this._status = c;
      return this;
    },
    setHeader() {},
    json(x: unknown) {
      this._json = x;
      return this;
    },
    end() {},
  };
  return res;
}

void (async () => {
  const r1 = mockRes();
  await radar({ method: 'GET', query: {} } as any, r1 as any);
  const founders = (r1._json as any)?.founders ?? [];
  console.log(`/api/radar -> ${r1._status}, ${founders.length} founders, ${(r1._json as any)?.theses?.length ?? 0} theses`);
  console.log(`  first: ${founders[0]?.name} composite=${founders[0]?.score?.composite} band=${founders[0]?.score?.band}`);

  const r2 = mockRes();
  await founder({ method: 'GET', query: { id: 'luis-reindlmeier' } } as any, r2 as any);
  const f = (r2._json as any)?.founder;
  console.log(`/api/founder?id=luis -> ${r2._status}, ${f?.name}, venture=${(r2._json as any)?.venture?.name}, composite=${f?.score?.composite}`);

  const r3 = mockRes();
  await sourcing({ method: 'GET', query: {} } as any, r3 as any);
  const s = r3._json as any;
  console.log(`/api/sourcing -> ${r3._status}, ok=${s?.ok} scanned=${s?.scanned} surfaced=${s?.surfacedCount} persisted=${s?.persisted}`);
})();
