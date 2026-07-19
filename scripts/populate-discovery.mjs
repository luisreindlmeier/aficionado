// One-off + cron-able discovery sweep. Searches GitHub broadly for founders,
// triages them against the thesis keywords, and writes a JSON payload that the
// caller upserts into Supabase sourcing_candidates. Keyless-safe by default;
// set GITHUB_TOKEN to sweep much wider.
import { writeFileSync } from 'node:fs';

const GH = 'https://api.github.com';
const token = process.env.GITHUB_TOKEN;
const headers = {
  'User-Agent': 'aficionado-discovery',
  Accept: 'application/vnd.github+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

// Broad thesis-aligned queries (AI / dev-tools / fintech, incl. DACH angle).
const QUERIES = [
  'ai agent framework',
  'llm application framework',
  'developer tools cli',
  'fintech payments api',
  'vector database',
  'open source saas',
  'rag retrieval augmented',
  'typescript ai sdk',
];

const KEYWORDS = ['ai', 'ml', 'llm', 'agent', 'developer', 'fintech', 'payments', 'data', 'infra', 'sdk'];
const perQuery = token ? 20 : 8;
const maxCandidates = token ? 120 : 40;
const minFollowers = 80;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ghJson(path) {
  try {
    const res = await fetch(`${GH}${path}`, { headers });
    if (res.status === 403) {
      const reset = res.headers.get('x-ratelimit-reset');
      console.error(`  rate-limited; reset at ${reset}`);
      return null;
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const topRepo = new Map();
for (const q of QUERIES) {
  const data = await ghJson(
    `/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perQuery}`,
  );
  let added = 0;
  for (const repo of data?.items ?? []) {
    if (repo.fork || repo.owner?.type !== 'User') continue;
    const cur = topRepo.get(repo.owner.login);
    if (!cur || repo.stargazers_count > cur.stars) {
      topRepo.set(repo.owner.login, { name: repo.name, stars: repo.stargazers_count, url: repo.html_url });
      added++;
    }
  }
  console.error(`query "${q}" -> +${added} owners (total ${topRepo.size})`);
  await sleep(token ? 300 : 6500); // respect keyless 10 searches/min
}

const ranked = [...topRepo.entries()].sort((a, b) => b[1].stars - a[1].stars).slice(0, maxCandidates);
const candidates = [];
for (const [login, repo] of ranked) {
  const user = await ghJson(`/users/${encodeURIComponent(login)}`);
  if (!user || user.type !== 'User') continue;
  const followers = user.followers ?? 0;
  if (followers < minFollowers) continue;
  const hay = `${user.bio ?? ''} ${user.company ?? ''} ${repo.name}`.toLowerCase();
  const overlap = KEYWORDS.filter((k) => hay.includes(k)).length;
  const triage = Math.min(99, Math.round(20 + Math.log10(Math.max(1, repo.stars)) * 12 + overlap * 6));
  const domain = (user.blog || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || null;
  candidates.push({
    id: login,
    name: user.name || login,
    github: login,
    domain,
    headline: (user.bio || user.company || `Builder of ${repo.name}`).slice(0, 200),
    followers,
    top_repo: repo.name,
    top_stars: repo.stars,
    thesis_id: null,
    triage,
    reason: null,
    evaluated: false,
  });
  await sleep(token ? 120 : 1100);
}

candidates.sort((a, b) => b.triage - a.triage);
writeFileSync(process.argv[2] || '/tmp/candidates.json', JSON.stringify(candidates, null, 0));
console.error(`\nDISCOVERED ${candidates.length} candidates, written.`);
console.error(candidates.slice(0, 10).map((c) => `  ${c.name} (@${c.github}) t${c.triage} ${c.top_stars}★`).join('\n'));
