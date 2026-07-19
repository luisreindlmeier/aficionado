import type {
  ConnectorResult,
  FounderQuery,
  Signal,
} from '../../../src/app/core/connectors/types';

interface S2Author {
  authorId: string;
  name: string;
  paperCount?: number;
  citationCount?: number;
  hIndex?: number;
}

// Proof (research): academic influence via the Semantic Scholar Graph API
// (no key). Takes the best author match for the founder's name.
export async function runSemanticScholar(query: FounderQuery): Promise<ConnectorResult> {
  const name = query.name?.trim();
  if (!name) return { signals: [], note: 'No name provided' };

  const res = await fetch(
    `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(name)}&fields=name,paperCount,citationCount,hIndex&limit=1`,
    { headers: { 'User-Agent': 'aficionado-connector' } },
  );
  if (!res.ok) throw new Error(`Semantic Scholar request failed (${res.status})`);
  const data = (await res.json()) as { data?: S2Author[] };
  const author = data.data?.[0];
  if (!author) return { signals: [], note: `No Semantic Scholar author for ${name}` };

  const url = `https://www.semanticscholar.org/author/${author.authorId}`;
  const signals: Signal[] = [];
  if (author.paperCount) {
    signals.push({
      connector: 'semanticscholar',
      metric: 'Proof',
      text: `${author.paperCount.toLocaleString('en-US')} papers on Semantic Scholar`,
      value: author.paperCount,
      url,
    });
  }
  if (author.citationCount) {
    signals.push({
      connector: 'semanticscholar',
      metric: 'Proof',
      text: `${author.citationCount.toLocaleString('en-US')} total citations`,
      value: author.citationCount,
      url,
    });
  }
  if (author.hIndex) {
    signals.push({
      connector: 'semanticscholar',
      metric: 'Proof',
      text: `h-index ${author.hIndex}`,
      value: author.hIndex,
      url,
    });
  }
  if (!signals.length) return { signals: [], note: `No citation metrics for ${name}` };
  return { signals };
}
