import type {
  ConnectorResult,
  FounderQuery,
  Signal,
} from '../../../src/app/core/connectors/types';

interface GpPatent {
  title?: string;
  inventor?: string;
  assignee?: string;
  priority_date?: string;
  id?: string;
}

interface Hit {
  title: string;
  inventor: string;
  assignee: string;
  priorityDate: string;
  url?: string;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&hellip;/g, '').trim();
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Patent records carry legal names, so the same person appears as "Yann LeCun"
// and "Yann Andre LeCun". Requiring an exact string would drop the middle-name
// filings; ignoring the given name would swallow "David John Smith" under a
// search for "John Smith". Anchoring on the first and last token accepts the
// former and rejects the latter.
function sameInventor(queried: string, candidate: string): boolean {
  const q = normalize(queried).split(' ').filter(Boolean);
  const c = normalize(candidate).split(' ').filter(Boolean);
  if (q.length < 2 || c.length < 2) return false;
  return q[0] === c[0] && q[q.length - 1] === c[c.length - 1];
}

/** patent/US9443141B2/en -> https://patents.google.com/patent/US9443141B2/en */
function patentUrl(id?: string): string | undefined {
  return id ? `https://patents.google.com/${id}` : undefined;
}

// Google Patents' own XHR endpoint: free and unmetered, but undocumented and
// heavily bot-protected. It starts serving 503 "your computer or network may be
// sending automated queries" after roughly a dozen calls from one address, so on
// shared serverless egress it is unlikely to work at all. Best effort only, used
// when no SerpAPI key is configured, and it answers with HTML rather than JSON
// once blocked.
async function googleHits(name: string): Promise<{ total: number; hits: Hit[] } | null> {
  const url = `https://patents.google.com/xhr/query?url=inventor%3D${encodeURIComponent(name.replace(/\s+/g, '+'))}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (aficionado-connector)' } });
  if (!res.ok) return null;
  let data: {
    results?: { total_num_results?: number; cluster?: { result?: { patent?: GpPatent }[] }[] };
  };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return null;
  }
  const results = data.results;
  if (!results) return null;
  const hits: Hit[] = [];
  for (const cluster of results.cluster ?? []) {
    for (const entry of cluster.result ?? []) {
      const p = entry.patent;
      if (!p) continue;
      hits.push({
        title: stripTags(p.title ?? ''),
        inventor: stripTags(p.inventor ?? ''),
        assignee: stripTags(p.assignee ?? ''),
        priorityDate: p.priority_date ?? '',
        url: patentUrl(p.id),
      });
    }
  }
  return { total: results.total_num_results ?? hits.length, hits };
}

// SerpAPI wraps the same index behind a supported contract that absorbs the bot
// protection, so it is the reliable path. Metered: the free plan is a hard 250
// searches per month across every SerpAPI-backed connector, and this runs once
// per evaluation, so patents cost roughly 250 evaluations per month.
async function serpApiHits(name: string): Promise<{ total: number; hits: Hit[] } | null> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://serpapi.com/search.json?engine=google_patents&inventor=${encodeURIComponent(name)}&api_key=${key}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    error?: string;
    search_information?: { total_results?: number };
    organic_results?: GpPatent[];
  };
  // "hasn't returned any results" is a legitimate empty answer, not a failure.
  // Reporting it as a failure would send the caller to a fallback for nothing.
  if (data.error) {
    return /returned any results/i.test(data.error) ? { total: 0, hits: [] } : null;
  }
  const hits: Hit[] = (data.organic_results ?? []).map((p) => ({
    title: stripTags(p.title ?? ''),
    inventor: stripTags(p.inventor ?? ''),
    assignee: stripTags(p.assignee ?? ''),
    priorityDate: p.priority_date ?? '',
    url: patentUrl(p.id),
  }));
  return { total: data.search_information?.total_results ?? hits.length, hits };
}

// Proof: granted patents naming the founder as inventor.
//
// The inventor filter matches substrings, so "John Smith" returns 88,228 patents
// belonging to David John Smith, Jeffrey John Smith and everyone alike. Measure
// how many of the returned inventors actually match the queried name, and only
// trust the total when that precision is high. A common name therefore yields no
// signal rather than tens of thousands of other people's patents.
export async function runGooglePatents(query: FounderQuery): Promise<ConnectorResult> {
  const name = query.name?.trim();
  if (!name) return { signals: [], note: 'No name provided' };

  // SerpAPI first: the free endpoint blocks automated callers, so trying it first
  // would just add a wasted round trip before every lookup.
  const found = (await serpApiHits(name)) ?? (await googleHits(name));
  if (!found) return { signals: [], note: 'Google Patents lookup unavailable' };
  if (!found.total || !found.hits.length) return { signals: [], note: `No patents for ${name}` };

  const mine = found.hits.filter((h) => sameInventor(name, h.inventor));
  const precision = mine.length / found.hits.length;
  if (precision < 0.8) {
    return { signals: [], note: `Patent inventor ${name} is ambiguous, not attributed` };
  }

  const assignees = [...new Set(mine.map((h) => h.assignee).filter(Boolean))];
  const newest = [...mine].sort((a, b) => (b.priorityDate || '').localeCompare(a.priorityDate || ''))[0];
  const url = newest?.url ?? `https://patents.google.com/?inventor=${encodeURIComponent(name)}`;

  const signals: Signal[] = [
    {
      connector: 'googlepatents',
      metric: 'Proof',
      text: `${found.total} ${found.total === 1 ? 'patent' : 'patents'} as named inventor`,
      value: found.total,
      url,
    },
  ];
  if (assignees.length) {
    signals.push({
      connector: 'googlepatents',
      metric: 'Proof',
      text: `Assigned to ${assignees.slice(0, 3).join(', ')}`,
      url,
    });
  }
  if (newest?.title) {
    signals.push({
      connector: 'googlepatents',
      metric: 'Proof',
      text: `Most recent: ${newest.title}${newest.priorityDate ? ` (${newest.priorityDate.slice(0, 4)})` : ''}`,
      url: newest.url,
    });
  }
  return { signals };
}
