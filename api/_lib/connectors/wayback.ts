import type {
  ConnectorResult,
  FounderQuery,
  Signal,
} from '../../../src/app/core/connectors/types';

// Trajectory: how long a domain has existed on the web and how often it was
// archived (web.archive.org CDX API, no auth). CDX returns rows ascending by
// timestamp, so the first data row is the earliest snapshot.
export async function runWayback(query: FounderQuery): Promise<ConnectorResult> {
  const domain = query.domain?.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain) return { signals: [], note: 'No domain provided' };

  const res = await fetch(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&fl=timestamp&collapse=timestamp:8&limit=2000`,
    { headers: { 'User-Agent': 'aficionado-connector' } },
  );
  if (!res.ok) throw new Error(`Wayback request failed (${res.status})`);
  const rows = (await res.json()) as string[][];
  const stamps = rows.slice(1).map((r) => r[0]).filter(Boolean);
  if (!stamps.length) return { signals: [], note: `No Wayback snapshots for ${domain}` };

  const firstYear = Number(stamps[0].slice(0, 4));
  const years = Math.max(0, new Date().getFullYear() - firstYear);
  const archiveUrl = `https://web.archive.org/web/*/${domain}`;

  const signals: Signal[] = [
    {
      connector: 'wayback',
      metric: 'Trajectory',
      text: `${domain} first archived ${firstYear}${years ? `, ${years} yrs of web history` : ''}`,
      value: years,
      url: archiveUrl,
    },
    {
      connector: 'wayback',
      metric: 'Trajectory',
      text: `${stamps.length.toLocaleString('en-US')} archived snapshots`,
      value: stamps.length,
      url: archiveUrl,
    },
  ];
  return { signals };
}
