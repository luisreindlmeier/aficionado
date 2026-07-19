import type {
  ConnectorResult,
  FounderQuery,
  Signal,
} from '../../../src/app/core/connectors/types';

// Proof: research authorship from arXiv (Atom API, no auth). Parses the feed
// with light regex; enough for counts and the most recent title.
export async function runArxiv(query: FounderQuery): Promise<ConnectorResult> {
  const name = query.name?.trim();
  if (!name) return { signals: [], note: 'No name provided' };

  const search = `au:"${name}"`;
  const res = await fetch(
    `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(search)}&max_results=10&sortBy=submittedDate&sortOrder=descending`,
    { headers: { 'User-Agent': 'aficionado-connector' } },
  );
  if (!res.ok) throw new Error(`arXiv request failed (${res.status})`);
  const xml = await res.text();

  const total = Number((xml.match(/<opensearch:totalResults[^>]*>(\d+)</) || [])[1] || 0);
  const titles = [...xml.matchAll(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/g)].map((m) =>
    m[1].replace(/\s+/g, ' ').trim(),
  );
  if (!total && !titles.length) return { signals: [], note: `No arXiv papers for ${name}` };

  const count = total || titles.length;
  const signals: Signal[] = [
    {
      connector: 'arxiv',
      metric: 'Proof',
      text: `${count} arXiv ${count === 1 ? 'paper' : 'papers'} as author`,
      value: count,
      url: `https://arxiv.org/a/${name.toLowerCase().replace(/\s+/g, '_')}`,
    },
  ];
  if (titles[0]) {
    signals.push({ connector: 'arxiv', metric: 'Proof', text: `Recent paper: ${titles[0]}` });
  }
  return { signals };
}
