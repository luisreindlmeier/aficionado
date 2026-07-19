import type {
  ConnectorResult,
  FounderQuery,
  Signal,
} from '../../../src/app/core/connectors/types';

interface OaAuthor {
  id: string;
  display_name?: string;
  works_count?: number;
  cited_by_count?: number;
  orcid?: string | null;
  summary_stats?: { h_index?: number; i10_index?: number };
}

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Author search matches loosely: querying "Yann LeCun" also returns his
// co-authors, and "John Smith" returns "John Maynard Smith", a different person
// with a 93 h-index. Surname plus first initial is not enough to tell them
// apart, so treat a plausible match as a candidate, not as the answer.
function isPlausible(queried: string, candidate: string): boolean {
  const q = normalize(queried).split(' ').filter(Boolean);
  const c = normalize(candidate).split(' ').filter(Boolean);
  if (!q.length || !c.length) return false;
  if (q[q.length - 1] !== c[c.length - 1]) return false;
  return q[0][0] === c[0][0];
}

// Resolve a name to one author, or to nobody. Several records whose names match
// exactly are one person fragmented across duplicate profiles, not several
// people: OpenAlex lists Karpathy four times and LeCun twice ("Yann LeCun" and
// "Yann Lecun"). Take the richest of those rather than summing, since the
// fragments overlap. Several merely plausible records are different people
// though ("Yann LeCun" also returns his co-author), so refuse those: a founder
// credited with a stranger's citations is worse than a founder with no signal.
function resolveAuthor(name: string, results: OaAuthor[]): OaAuthor | 'ambiguous' | null {
  const strongest = (list: OaAuthor[]): OaAuthor =>
    [...list].sort((a, b) => (b.cited_by_count ?? 0) - (a.cited_by_count ?? 0))[0];

  const exact = results.filter((a) => normalize(a.display_name ?? '') === normalize(name));
  if (exact.length) return strongest(exact);

  const plausible = results.filter((a) => isPlausible(name, a.display_name ?? ''));
  if (plausible.length === 1) return plausible[0];
  if (plausible.length > 1) return 'ambiguous';
  return null;
}

// Proof (research output) and Gravity (citation reach) via OpenAlex. Free, no
// key, no quota. Takes the best author match for the founder's name, but only
// after the name guard above accepts it.
export async function runOpenAlex(query: FounderQuery): Promise<ConnectorResult> {
  const name = query.name?.trim();
  if (!name) return { signals: [], note: 'No name provided' };

  const res = await fetch(
    `https://api.openalex.org/authors?search=${encodeURIComponent(name)}&per_page=5&mailto=aficionado`,
    { headers: { 'User-Agent': 'aficionado-connector' } },
  );
  if (!res.ok) throw new Error(`OpenAlex request failed (${res.status})`);
  const data = (await res.json()) as { results?: OaAuthor[] };

  const resolved = resolveAuthor(name, data.results ?? []);
  if (resolved === 'ambiguous') {
    return { signals: [], note: `OpenAlex name ${name} is ambiguous, not attributed` };
  }
  if (!resolved) return { signals: [], note: `No OpenAlex author matching ${name}` };
  const author = resolved;

  const url = author.id.replace('https://openalex.org/', 'https://openalex.org/authors/');
  const hIndex = author.summary_stats?.h_index;
  const signals: Signal[] = [];

  if (author.works_count) {
    signals.push({
      connector: 'openalex',
      metric: 'Proof',
      text: `${author.works_count.toLocaleString('en-US')} works on OpenAlex`,
      value: author.works_count,
      url,
    });
  }
  if (hIndex) {
    signals.push({
      connector: 'openalex',
      metric: 'Proof',
      text: `h-index ${hIndex}`,
      value: hIndex,
      url,
    });
  }
  if (author.cited_by_count) {
    signals.push({
      connector: 'openalex',
      metric: 'Gravity',
      text: `${author.cited_by_count.toLocaleString('en-US')} citations`,
      value: author.cited_by_count,
      url,
    });
  }

  if (!signals.length) return { signals: [], note: `No OpenAlex metrics for ${name}` };
  return { signals };
}
