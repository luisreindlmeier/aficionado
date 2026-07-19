import type {
  ConnectorResult,
  FounderQuery,
  Signal,
} from '../../../src/app/core/connectors/types';

// Proof: Python package adoption via download volume (pypistats.org, no auth).
export async function runPypi(query: FounderQuery): Promise<ConnectorResult> {
  const pkg = query.pypi?.trim();
  if (!pkg) return { signals: [], note: 'No PyPI package provided' };

  const res = await fetch(
    `https://pypistats.org/api/packages/${encodeURIComponent(pkg.toLowerCase())}/recent`,
    { headers: { 'User-Agent': 'aficionado-connector' } },
  );
  if (res.status === 404) return { signals: [], note: `No PyPI package ${pkg}` };
  if (!res.ok) throw new Error(`pypistats request failed (${res.status})`);
  const data = (await res.json()) as { data?: { last_month?: number } };
  const month = data.data?.last_month ?? 0;

  const signals: Signal[] = [
    {
      connector: 'pypi',
      metric: 'Proof',
      text: `PyPI ${pkg}: ${Number(month).toLocaleString('en-US')} downloads last month`,
      value: month,
      url: `https://pypi.org/project/${pkg}/`,
    },
  ];
  return { signals };
}
