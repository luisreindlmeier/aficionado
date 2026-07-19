import type {
  ConnectorResult,
  FounderQuery,
  Signal,
} from '../../../src/app/core/connectors/types';

const GH = 'https://api.github.com';

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': 'aficionado-connector',
    Accept: 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

interface GhRepo {
  name: string;
  fork: boolean;
  stargazers_count: number;
  html_url: string;
}

// Proof: shipping evidence from public repos, stars and reach.
export async function runGithub(query: FounderQuery): Promise<ConnectorResult> {
  const login = query.github?.trim().replace(/^@/, '');
  if (!login) return { signals: [], note: 'No GitHub handle provided' };

  const userRes = await fetch(`${GH}/users/${encodeURIComponent(login)}`, { headers: headers() });
  if (userRes.status === 404) return { signals: [], note: `No GitHub user @${login}` };
  if (!userRes.ok) throw new Error(`GitHub user request failed (${userRes.status})`);
  const user = (await userRes.json()) as { public_repos?: number; followers?: number; html_url: string };

  const reposRes = await fetch(
    `${GH}/users/${encodeURIComponent(login)}/repos?per_page=100&sort=pushed`,
    { headers: headers() },
  );
  const repos = reposRes.ok ? ((await reposRes.json()) as GhRepo[]) : [];
  const owned = repos.filter((r) => !r.fork);
  const stars = owned.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const top = [...owned].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))[0];

  const signals: Signal[] = [
    {
      connector: 'github',
      metric: 'Proof',
      text: `${user.public_repos ?? owned.length} public repos, ${user.followers ?? 0} followers`,
      value: user.followers,
      url: user.html_url,
    },
  ];
  if (stars > 0) {
    signals.push({
      connector: 'github',
      metric: 'Proof',
      text: `${stars.toLocaleString('en-US')} stars across owned repos`,
      value: stars,
      url: user.html_url,
    });
  }
  if (top && (top.stargazers_count || 0) > 0) {
    signals.push({
      connector: 'github',
      metric: 'Proof',
      text: `Top repo ${top.name} at ${top.stargazers_count.toLocaleString('en-US')} stars`,
      value: top.stargazers_count,
      url: top.html_url,
    });
  }
  return { signals };
}
