import type {
  ConnectorResult,
  FounderQuery,
  Signal,
} from '../../../src/app/core/connectors/types';

interface PhPost {
  name: string;
  votesCount: number;
  url: string;
}
interface PhResponse {
  data?: {
    user?: {
      id?: string;
      username?: string;
      madePosts?: { totalCount: number; edges: { node: PhPost }[] };
    };
  };
}

// Proof: launches and upvotes on Product Hunt. Requires a developer token
// (PRODUCT_HUNT_TOKEN). The maker comes from query.producthunt; a `ph:<username>`
// keyword is still honoured so an agent can target a maker it inferred.
export async function runProductHunt(query: FounderQuery): Promise<ConnectorResult> {
  const token = process.env.PRODUCT_HUNT_TOKEN;
  if (!token) return { signals: [], note: 'Product Hunt token not configured' };

  const username =
    query.producthunt || query.keywords?.find((k) => k.startsWith('ph:'))?.slice(3);
  if (!username) return { signals: [], note: 'No Product Hunt username provided' };

  const gql = `query($u:String!){ user(username:$u){ id username madePosts{ totalCount edges{ node{ name votesCount url } } } } }`;
  const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: gql, variables: { u: username } }),
  });
  if (!res.ok) throw new Error(`Product Hunt request failed (${res.status})`);
  const data = (await res.json()) as PhResponse;
  const posts = data.data?.user?.madePosts;
  if (!posts) return { signals: [], note: `No Product Hunt user ${username}` };

  // The v2 API redacts third-party users: any username other than the token
  // owner comes back as id "0" / "[REDACTED]" with zero posts. Emitting that as
  // "0 launches" would put fabricated Proof evidence in the dossier, so treat it
  // as no data rather than as a zero.
  if (data.data?.user?.id === '0' || data.data?.user?.username === '[REDACTED]') {
    return { signals: [], note: `Product Hunt redacts profile data for ${username}` };
  }
  if (!posts.totalCount) return { signals: [], note: `No Product Hunt launches for ${username}` };

  const nodes = (posts.edges || []).map((e) => e.node);
  const votes = nodes.reduce((sum, n) => sum + (n.votesCount || 0), 0);
  const top = [...nodes].sort((a, b) => (b.votesCount || 0) - (a.votesCount || 0))[0];

  const signals: Signal[] = [
    {
      connector: 'producthunt',
      metric: 'Proof',
      text: `${posts.totalCount} launches, ${votes.toLocaleString('en-US')} total upvotes`,
      value: votes,
      url: top?.url,
    },
  ];
  if (top) {
    signals.push({
      connector: 'producthunt',
      metric: 'Proof',
      text: `Top launch ${top.name} (${top.votesCount.toLocaleString('en-US')} upvotes)`,
      value: top.votesCount,
      url: top.url,
    });
  }
  return { signals };
}
