import type { FounderQuery } from '../../../src/app/core/connectors/types';

// ─────────────────────────────────────────────────────────────
// REAL founder discovery from GitHub. Given thesis keywords, search top repos,
// take their individual owners (not orgs) as candidate founders, and enrich each
// with profile data. This is net-new discovery, not a lookup of known handles.
// ─────────────────────────────────────────────────────────────

const GH = 'https://api.github.com';

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': 'aficionado-discovery',
    Accept: 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

export interface DiscoveredFounder {
  login: string;
  name?: string;
  headline?: string; // bio, or "<company>" fallback
  company?: string;
  followers: number;
  publicRepos: number;
  domain?: string; // blog / personal site
  location?: string;
  topRepo?: { name: string; stars: number; url: string };
  /** A FounderQuery ready to hand to the evaluation workflow. */
  query: FounderQuery;
}

interface GhRepoOwner {
  login: string;
  type: 'User' | 'Organization';
}
interface GhSearchRepo {
  name: string;
  stargazers_count: number;
  html_url: string;
  owner: GhRepoOwner;
  fork: boolean;
}
interface GhUser {
  login: string;
  name?: string;
  bio?: string;
  company?: string;
  blog?: string;
  location?: string;
  followers?: number;
  public_repos?: number;
  type?: string;
}

async function ghJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${GH}${path}`, { headers: headers() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const cleanDomain = (blog?: string): string | undefined => {
  if (!blog) return undefined;
  const b = blog.trim();
  if (!b) return undefined;
  return b.replace(/^https?:\/\//, '').replace(/\/$/, '') || undefined;
};

/** Search repositories for one query and return the top owners' logins (users only). */
async function ownersForQuery(q: string, perQuery: number): Promise<Map<string, { name: string; stars: number; url: string }>> {
  const owners = new Map<string, { name: string; stars: number; url: string }>();
  const path = `/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perQuery}`;
  const data = await ghJson<{ items?: GhSearchRepo[] }>(path);
  for (const repo of data?.items ?? []) {
    if (repo.fork) continue;
    if (repo.owner?.type !== 'User') continue; // individuals, not orgs
    const existing = owners.get(repo.owner.login);
    if (!existing || repo.stargazers_count > existing.stars) {
      owners.set(repo.owner.login, {
        name: repo.name,
        stars: repo.stargazers_count,
        url: repo.html_url,
      });
    }
  }
  return owners;
}

/**
 * Discover candidate founders from GitHub for a set of thesis keywords.
 * Runs one repo search per query, unions the owners, then enriches each profile.
 * Bounded by maxCandidates so a broad sweep stays within rate limits.
 */
export async function searchFounders(
  queries: readonly string[],
  opts: { perQuery?: number; maxCandidates?: number; minFollowers?: number } = {},
): Promise<DiscoveredFounder[]> {
  const perQuery = opts.perQuery ?? 15;
  const maxCandidates = opts.maxCandidates ?? 40;
  const minFollowers = opts.minFollowers ?? 0;

  // 1) collect owner logins + their best repo across all queries
  const topRepo = new Map<string, { name: string; stars: number; url: string }>();
  for (const q of queries) {
    const owners = await ownersForQuery(q, perQuery);
    for (const [login, repo] of owners) {
      const existing = topRepo.get(login);
      if (!existing || repo.stars > existing.stars) topRepo.set(login, repo);
    }
  }

  // 2) enrich the strongest candidates (by best-repo stars) up to maxCandidates
  const ranked = [...topRepo.entries()].sort((a, b) => b[1].stars - a[1].stars).slice(0, maxCandidates);
  const founders: DiscoveredFounder[] = [];
  for (const [login, repo] of ranked) {
    const user = await ghJson<GhUser>(`/users/${encodeURIComponent(login)}`);
    if (!user || user.type !== 'User') continue;
    const followers = user.followers ?? 0;
    if (followers < minFollowers) continue;
    const domain = cleanDomain(user.blog);
    founders.push({
      login,
      name: user.name ?? login,
      headline: user.bio ?? user.company ?? `Builder of ${repo.name}`,
      company: user.company,
      followers,
      publicRepos: user.public_repos ?? 0,
      domain,
      location: user.location,
      topRepo: repo,
      query: {
        name: user.name ?? login,
        github: login,
        domain,
      },
    });
  }
  return founders;
}
