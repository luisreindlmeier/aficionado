// Fetch REAL public GitHub (+ optional npm) data for a curated founder set.
// No auth (60/h limit) — keep call count modest. Saves raw+derived JSON.
import { writeFile } from 'node:fs/promises';

const HANDLES = [
  'luisreindlmeier', // hero
  'steipete',        // Peter Steinberger, Vienna (DACH), PSPDFKit
  'rauchg',          // Guillermo Rauch, Vercel
  'yyx990803',       // Evan You, Vue/Vite
  'sindresorhus',    // Sindre Sorhus, prolific OSS
  'antfu',           // Anthony Fu, Vite/Nuxt ecosystem
  'shadcn',          // shadcn/ui
  'mckaywrigley',    // AI dev tools founder
  'transitive-bullshit', // Travis Fischer, AI tools
  'leerob',          // Lee Robinson
  'pmndrs',          // (org, will 404 as user — tests graceful handling)
  'jaredpalmer',     // Jared Palmer, Formik/Turbo
];

const H = { 'User-Agent': 'aficionado-connector', Accept: 'application/vnd.github+json' };
const gh = (p) => fetch(`https://api.github.com${p}`, { headers: H });

async function j(p) {
  const r = await gh(p);
  const rl = r.headers.get('x-ratelimit-remaining');
  if (!r.ok) return { __error: r.status, __rl: rl };
  const data = await r.json();
  return { data, __rl: rl };
}

const out = [];
for (const h of HANDLES) {
  const user = await j(`/users/${h}`);
  if (user.__error) { out.push({ handle: h, error: user.__error }); console.error(h, 'ERR', user.__error, 'rl', user.__rl); continue; }
  const repos = await j(`/users/${h}/repos?per_page=100&sort=pushed`);
  const events = await j(`/users/${h}/events/public?per_page=100`);
  const u = user.data;
  const rs = Array.isArray(repos.data) ? repos.data : [];
  const owned = rs.filter((r) => !r.fork);
  const stars = owned.reduce((s, r) => s + (r.stargazers_count || 0), 0);
  const forks = owned.reduce((s, r) => s + (r.forks_count || 0), 0);
  const top = [...owned].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0)).slice(0, 6)
    .map((r) => ({ name: r.name, stars: r.stargazers_count, lang: r.language, desc: r.description, pushed: r.pushed_at, created: r.created_at, url: r.html_url, archived: r.archived }));
  // language histogram
  const langs = {};
  for (const r of owned) if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
  // trajectory: repos created per year, recent push recency
  const byYear = {};
  for (const r of owned) { const y = (r.created_at || '').slice(0, 4); if (y) byYear[y] = (byYear[y] || 0) + 1; }
  const evts = Array.isArray(events.data) ? events.data : [];
  const recentEventTypes = {};
  for (const e of evts) recentEventTypes[e.type] = (recentEventTypes[e.type] || 0) + 1;
  const lastActive = evts[0]?.created_at || (owned[0]?.pushed_at ?? null);
  out.push({
    handle: h,
    name: u.name, bio: u.bio, company: u.company, blog: u.blog, location: u.location,
    followers: u.followers, following: u.following, public_repos: u.public_repos,
    created_at: u.created_at, html_url: u.html_url, twitter: u.twitter_username,
    derived: { ownedCount: owned.length, stars, forks, topRepos: top, langs, byYear, recentEventTypes, recentEventCount: evts.length, lastActive },
    __rl: user.__rl,
  });
  console.error(h, 'ok', 'followers', u.followers, 'stars', stars, 'rl', user.__rl);
}
await writeFile(new URL('./founders_raw.json', import.meta.url), JSON.stringify(out, null, 2));
console.error('WROTE', out.length, 'founders');
