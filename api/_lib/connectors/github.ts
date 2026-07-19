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
interface GhEvent {
  type: string;
  created_at: string;
}

// GitHub feeds three metrics from one user:
//   Proof      shipping evidence (repos, stars, top repo)
//   Gravity    follower count as reach
//   Trajectory recent push cadence + account-age slope (repos per year)
export async function runGithub(query: FounderQuery): Promise<ConnectorResult> {
  const login = query.github?.trim().replace(/^@/, '');
  if (!login) return { signals: [], note: 'No GitHub handle provided' };

  const userRes = await fetch(`${GH}/users/${encodeURIComponent(login)}`, { headers: headers() });
  if (userRes.status === 404) return { signals: [], note: `No GitHub user @${login}` };
  if (!userRes.ok) throw new Error(`GitHub user request failed (${userRes.status})`);
  const user = (await userRes.json()) as {
    public_repos?: number;
    followers?: number;
    html_url: string;
    created_at?: string;
  };
  const url = user.html_url;
  const followers = user.followers ?? 0;

  const reposRes = await fetch(
    `${GH}/users/${encodeURIComponent(login)}/repos?per_page=100&sort=pushed`,
    { headers: headers() },
  );
  const repos = reposRes.ok ? ((await reposRes.json()) as GhRepo[]) : [];
  const owned = repos.filter((r) => !r.fork);
  const repoCount = user.public_repos ?? owned.length;
  const stars = owned.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const top = [...owned].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))[0];

  const signals: Signal[] = [
    {
      connector: 'github',
      metric: 'Proof',
      text: `${repoCount} public repos, ${followers} followers`,
      value: repoCount,
      url,
    },
  ];
  if (stars > 0) {
    signals.push({
      connector: 'github',
      metric: 'Proof',
      text: `${stars.toLocaleString('en-US')} stars across owned repos`,
      value: stars,
      url,
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

  // Gravity: reach is who follows the founder.
  signals.push({
    connector: 'github',
    metric: 'Gravity',
    text: `${followers.toLocaleString('en-US')} GitHub followers`,
    value: followers,
    url,
  });

  // Trajectory: recent public push cadence.
  let pushes = 0;
  let lastActive = '';
  try {
    const evRes = await fetch(
      `${GH}/users/${encodeURIComponent(login)}/events/public?per_page=100`,
      { headers: headers() },
    );
    if (evRes.ok) {
      const events = (await evRes.json()) as GhEvent[];
      pushes = events.filter((e) => e.type === 'PushEvent').length;
      lastActive = events[0]?.created_at?.slice(0, 10) ?? '';
    }
  } catch {
    // ignore events failure; cadence stays 0
  }
  signals.push({
    connector: 'github',
    metric: 'Trajectory',
    text: `${pushes} recent public pushes${lastActive ? `, last active ${lastActive}` : ''}`,
    value: pushes,
    url,
  });

  // Trajectory: account-age slope (repos per year since joining).
  if (user.created_at) {
    const joined = new Date(user.created_at);
    const years = Math.max(0.1, (Date.now() - joined.getTime()) / (365.25 * 24 * 3600 * 1000));
    const perYear = Math.round((repoCount / years) * 10) / 10;
    signals.push({
      connector: 'github',
      metric: 'Trajectory',
      text: `${repoCount} repos over ${years.toFixed(1)} yrs since joining (${joined.getFullYear()})`,
      value: perYear,
      url,
    });
  }

  return { signals };
}
