// Generate src/app/core/data/seed.ts from REAL fetched GitHub data + authored,
// grounded per-founder assessments. Scoring transforms mirror core/scoring.ts.
import { readFile, writeFile } from 'node:fs/promises';

const raw = JSON.parse(await readFile(new URL('./founders_raw.json', import.meta.url), 'utf8'));
const byHandle = Object.fromEntries(raw.map((r) => [r.handle, r]));
const npm = JSON.parse(await readFile(new URL('./npm_raw.json', import.meta.url), 'utf8'));

// ── scoring helpers (mirror core/scoring.ts) ──
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const log10p = (x) => Math.log10(Math.max(0, x) + 1);
const curve = (x, cap) => clamp(Math.round((log10p(x) / log10p(cap)) * 100), 2, 99);
const wmean = (pairs) => {
  const ws = pairs.reduce((a, [, w]) => a + w, 0) || 1;
  return Math.round(pairs.reduce((a, [v, w]) => a + v * w, 0) / ws);
};
// Absent-aware weighted mean: a feature with absent=true is DROPPED and its
// weight redistributed. Score on the evidence we actually have.
const wmeanA = (feats) => {
  const use = feats.filter((f) => !f.absent);
  const ws = use.reduce((a, f) => a + f.w, 0) || 1;
  return Math.round(use.reduce((a, f) => a + f.v * f.w, 0) / ws);
};
// ── THE ANCHOR SET (single source of truth). Emitted to anchors.ts AND used
// here for calibration. A realistic distribution: proven megastars at the top,
// a broad middle of early/mid founders, and cautionary tails, so percentiles
// mean something for an early founder like Luis. `display` overrides the name
// in "sits next to ___" for archetype entries. ──
const ANCHORS = [
  // Proven, top of the distribution
  { name:'Patrick Collison', outcome:'success', proof:96, gravity:95, trajectory:84, note:'Stripe, developer-first payments' },
  { name:'Guillermo Rauch', outcome:'success', proof:93, gravity:90, trajectory:82, note:'Vercel, prolific open source' },
  { name:'Tobias Lütke', outcome:'success', proof:90, gravity:88, trajectory:74, note:'Shopify, engineer-founder' },
  { name:'Sid Sijbrandij', outcome:'success', proof:82, gravity:84, trajectory:78, note:'GitLab, open-core' },
  { name:'Mitchell Hashimoto', outcome:'success', proof:95, gravity:82, trajectory:76, note:'HashiCorp, deep infra builder' },
  { name:'Dylan Field', outcome:'success', proof:80, gravity:86, trajectory:80, note:'Figma, design tooling' },
  { name:'Vitalik Buterin', outcome:'success', proof:92, gravity:93, trajectory:82, note:'Ethereum, research-led' },
  { name:'Evan You', outcome:'success', proof:91, gravity:84, trajectory:70, note:'Vue, Vite; solo-to-team OSS' },
  { name:'Sindre Sorhus', outcome:'success', proof:88, gravity:80, trajectory:66, note:'Full-time open source at scale' },
  { name:'Peter Steinberger', outcome:'success', proof:89, gravity:83, trajectory:88, note:'PSPDFKit (Vienna); big second-act momentum' },
  { name:'Anthony Fu', outcome:'success', proof:84, gravity:78, trajectory:79, note:'Vite / Nuxt ecosystem maintainer' },
  { name:'David Cramer', outcome:'success', proof:85, gravity:72, trajectory:68, note:'Sentry, developer tooling' },
  { name:'Clement Delangue', outcome:'success', proof:78, gravity:90, trajectory:84, note:'Hugging Face; community gravity' },
  { name:'Georgi Gerganov', outcome:'success', proof:90, gravity:79, trajectory:92, note:'llama.cpp / ggml; explosive recent slope' },
  { name:'Robert Nishihara', outcome:'success', proof:84, gravity:74, trajectory:76, note:'Anyscale / Ray; research to product' },
  { name:'Paul Copplestone', outcome:'success', proof:80, gravity:75, trajectory:82, note:'Supabase, open-source Firebase' },
  { name:'Zeno Rocha', outcome:'success', proof:74, gravity:76, trajectory:74, note:'Resend; DX + audience' },
  // Commercial / sales-led (Maschmeyer-favoured Gravity), incl. DACH
  { name:'Alexandr Wang', outcome:'success', proof:66, gravity:89, trajectory:85, note:'Scale AI; young, high pull' },
  { name:'Melanie Perkins', outcome:'success', proof:62, gravity:87, trajectory:78, note:'Canva; persistence + distribution' },
  { name:'Daniel Dines', outcome:'success', proof:68, gravity:80, trajectory:70, note:'UiPath; long build then breakout' },
  { name:'Christian Reber', outcome:'success', proof:70, gravity:82, trajectory:74, note:'Pitch / Wunderlist (Berlin)' },
  { name:'Johannes Reck', outcome:'success', proof:60, gravity:84, trajectory:76, note:'GetYourGuide (Berlin)' },
  { name:'Hanno Renner', outcome:'success', proof:64, gravity:81, trajectory:83, note:'Personio (Munich); HR SaaS' },
  { name:'Erik Muttersbach', outcome:'success', proof:82, gravity:70, trajectory:80, note:'Forto (Berlin); technical logistics' },
  { name:'Amjad Masad', outcome:'success', proof:80, gravity:78, trajectory:72, note:'Replit; builder + community' },
  { name:'Aravind Srinivas', outcome:'success', proof:72, gravity:70, trajectory:88, note:'Perplexity; research-to-founder' },
  // Mid, promising (a realistic neighbourhood)
  { name:'Theo Browne', outcome:'mixed', proof:66, gravity:74, trajectory:68, note:'Ping / t3; audience-led' },
  { name:'Lee Robinson', outcome:'success', proof:68, gravity:76, trajectory:66, note:'DX leader; strong distribution' },
  { name:'Travis Fischer', outcome:'mixed', proof:72, gravity:66, trajectory:74, note:'Agentic AI OSS; indie momentum' },
  { name:'Mckay Wrigley', outcome:'mixed', proof:70, gravity:72, trajectory:78, note:'AI apps; ships fast in public' },
  { name:'Shawn Wang', outcome:'success', proof:60, gravity:72, trajectory:64, note:'DX / Latent Space; learn-in-public' },
  { name:'Pim de Witte', outcome:'success', proof:64, gravity:58, trajectory:70, note:'Medal; product-led' },
  { name:'Ian Storm Taylor', outcome:'mixed', proof:78, gravity:62, trajectory:55, note:'Segment / Slate; strong builder' },
  { name:'Emad Mostaque', outcome:'mixed', proof:70, gravity:88, trajectory:60, note:'Stability AI; attention, governance issues' },
  // Early / first-time technical founders (the realistic middle-and-below) — Luis's neighbourhood
  { name:'an early finance-ML founder', display:'an early finance-ML founder', outcome:'success', proof:68, gravity:50, trajectory:76, note:'Quant/ML background, exceptional fit, network still forming; later raised a seed' },
  { name:'an early ML-infra founder', display:'an early ML-infra founder', outcome:'success', proof:66, gravity:48, trajectory:78, note:'Strong build record, thin public network' },
  { name:'a quant-turned-founder', display:'a quant-turned-founder', outcome:'success', proof:64, gravity:46, trajectory:70, note:'Deep domain, early on distribution' },
  { name:'a repeat second-time founder', display:'a repeat second-time founder', outcome:'success', proof:62, gravity:58, trajectory:60, note:'Credible, mid pull, steady' },
  { name:'a research-heavy PhD founder', display:'a research-heavy PhD founder', outcome:'mixed', proof:68, gravity:44, trajectory:60, note:'Papers, slow to ship product' },
  { name:'an indie AI-app founder', display:'an indie AI-app founder', outcome:'mixed', proof:56, gravity:50, trajectory:74, note:'Ships fast in public, unproven at scale' },
  { name:'a technical hackathon winner', display:'a technical hackathon winner', outcome:'mixed', proof:58, gravity:40, trajectory:74, note:'Wins, exceptional fit, not yet scaled' },
  { name:'a promising student founder', display:'a promising student founder', outcome:'success', proof:58, gravity:40, trajectory:76, note:'Early, steep slope, great founder-market-fit' },
  { name:'a solo devtools founder', display:'a solo devtools founder', outcome:'mixed', proof:60, gravity:38, trajectory:66, note:'Shipped real tools, no audience yet' },
  { name:'a domain-expert career-switcher', display:'a domain-expert career-switcher', outcome:'mixed', proof:50, gravity:40, trajectory:56, note:'Deep domain, new to building' },
  { name:'a design-led founder', display:'a design-led founder', outcome:'mixed', proof:48, gravity:54, trajectory:60, note:'Product taste, light engineering' },
  { name:'a bootstrapped SaaS founder', display:'a bootstrapped SaaS founder', outcome:'success', proof:52, gravity:46, trajectory:58, note:'Steady, unflashy, real revenue' },
  { name:'a community-first founder', display:'a community-first founder', outcome:'mixed', proof:44, gravity:62, trajectory:58, note:'Audience ahead of product' },
  { name:'a first-time fintech founder', display:'a first-time fintech founder', outcome:'mixed', proof:55, gravity:42, trajectory:62, note:'Early traction, thin evidence' },
  // Cautionary tails
  { name:'a bootcamp-to-founder', display:'a bootcamp-to-founder', outcome:'failed', proof:40, gravity:30, trajectory:52, note:'Enthusiasm ahead of shipped evidence' },
  { name:'a stalled first-timer', display:'a stalled first-timer', outcome:'failed', proof:40, gravity:34, trajectory:38, note:'Momentum died after v1' },
  { name:'an idea-stage first timer', display:'an idea-stage first timer', outcome:'failed', proof:30, gravity:28, trajectory:42, note:'No shipped proof, low momentum' },
  { name:'an all-pitch no-ship founder', display:'an all-pitch no-ship founder', outcome:'failed', proof:30, gravity:58, trajectory:40, note:'Pitch ahead of proof' },
  { name:'Adam Neumann', outcome:'failed', proof:44, gravity:92, trajectory:50, note:'WeWork; huge gravity, governance red flags' },
  { name:'Elizabeth Holmes', outcome:'failed', proof:20, gravity:90, trajectory:30, note:'Theranos; overclaiming, capped by gate' },
  { name:'Trevor Milton', outcome:'failed', proof:22, gravity:78, trajectory:28, note:'Nikola; overclaiming' },
  { name:'Charlie Javice', outcome:'failed', proof:30, gravity:74, trajectory:34, note:'Frank; fabricated metrics' },
];
const A_PROOF = ANCHORS.map(a=>a.proof);
const A_GRAV  = ANCHORS.map(a=>a.gravity);
const A_TRAJ  = ANCHORS.map(a=>a.trajectory);
const ANCHOR_NAMES = ANCHORS.map(a=>a.display || a.name);
const mean = (xs) => xs.reduce((a,b)=>a+b,0)/xs.length;
const std = (xs) => { const m=mean(xs); return Math.sqrt(xs.reduce((a,b)=>a+(b-m)**2,0)/(xs.length-1))||1; };
const squashZ = (v, col) => (v - mean(col)) / std(col);
const pctl = (v, col) => clamp(Math.round(((col.filter(x=>x<v).length + col.filter(x=>x===v).length/2)/col.length)*100),1,99);

const ACC_YEAR = 2026; // "now" for career-age normalisation
function accountAgeYears(iso){ return Math.max(0.5, (new Date('2026-07-19') - new Date(iso)) / (365.25*24*3600*1000)); }

// ── authored, grounded per-founder data (thesis, venture, fmf, skills, flags) ──
// Values are qualitative judgements about REAL people; receipts stay real.
const P = {
  luisreindlmeier: {
    id: 'luis-reindlmeier', thesis: 'dach-ai-fintech', discoveredOffsetMins: 8, status: 'evaluating', pipeline: 'Evaluating',
    headline: 'Building an AI copilot for finance decks, quant-ML background',
    venture: { id:'gedonus', name:'gedonus', monogram:'g', tagline:'AI drafts your slides. You stay in control.',
      problem:'Finance teams (IB, PE, consulting) spend hours building pitchbooks and IC packs by hand, where one wrong number or off-brand slide is expensive.',
      industry:'Fintech / AI productivity', stage:'Pre-seed', location:'Frankfurt, Germany', foundedYear:2025, website:'gedonus.com' },
    starQuality: 1.0, research: 62, downloadsOverride: 0,
    fmf: { sim: 0.93, rationale: 'Bachelor thesis on a transformer-based limit order book for market making sits almost exactly on top of the problem gedonus solves: applying ML to high-stakes finance work. Rare, direct founder-market-fit.' },
    skills: { technical: 0.9, commercial: 0.35, domain: 0.85, product: 0.6 },
    networkAuthority: 8, amplification: 10, accelPress: 22,
    conf: { Proof: ['high'], Gravity: ['low'], Trajectory: ['high'] },
    proofNote: 'Public code is early-career (thesis + hackathons); the product itself is in private pilot, so its adoption is not yet publicly measurable.',
    gravityNote: 'No public X or LinkedIn footprint connected yet. Gravity is provisional and excluded from the composite until a profile is pasted.',
    redFlags: [
      { text:'First-time founder, no prior exit', note:'Expected at pre-seed, not disqualifying', severity:'low' },
      { text:'Product in private pilot; external adoption not yet measurable', note:'Consistent with a launching-pilots stage', severity:'low' },
      { text:'Co-founder not yet evaluated', note:'Team complementarity is provisional until the second founder is added', severity:'low' },
    ],
    fmfReceiptFrom: 'transformer-lob',
  },
  steipete: {
    id:'peter-steinberger', thesis:'dach-ai-fintech', discoveredOffsetMins: 34, status:'decided', pipeline:'Decided',
    headline:'PSPDFKit founder, now building AI agent tooling, Vienna roots',
    venture:{ id:'steipete-agents', name:'Agent tooling', monogram:'A', tagline:'Command-line and editor tooling for coding agents.',
      problem:'Developers running AI coding agents lack fast, native tooling to steer and observe them.', industry:'AI developer tools', stage:'Angel / building', location:'Vienna / remote', foundedYear:2024, website:'steipete.me' },
    starQuality: 0.95, research: 0, fmf:{ sim:0.8, rationale:'A decade shipping PSPDFKit plus a burst of agent-tooling repos lines up tightly with building for AI-native developers.' },
    skills:{ technical:0.95, commercial:0.7, domain:0.85, product:0.8 }, networkAuthority:86, amplification:78, accelPress:70,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['high'] },
    redFlags:[{ text:'Serial founder energy across many repos', note:'Focus risk, not a coherence flag', severity:'low' }],
  },
  rauchg: {
    id:'guillermo-rauch', thesis:'ai-devtools', discoveredOffsetMins: 72, status:'decided', pipeline:'Decided',
    headline:'Vercel founder/CEO, prolific open-source builder',
    venture:{ id:'vercel', name:'Vercel', monogram:'V', tagline:'Frontend cloud and the Next.js framework.', problem:'Shipping fast, reliable web apps is hard to operate.', industry:'Developer infrastructure', stage:'Growth', location:'San Francisco', foundedYear:2015, website:'vercel.com' },
    starQuality:0.9, research:0, fmf:{ sim:0.82, rationale:'Socket.io, mongoose and years of OSS precede Vercel; the builder and the product are the same person.' },
    skills:{ technical:0.9, commercial:0.85, domain:0.85, product:0.9 }, networkAuthority:92, amplification:88, accelPress:88,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['high'] }, redFlags:[],
  },
  yyx990803: {
    id:'evan-you', thesis:'oss-maintainers', discoveredOffsetMins: 118, status:'watching', pipeline:'Watch',
    headline:'Vue and Vite creator, now building VoidZero',
    venture:{ id:'voidzero', name:'VoidZero', monogram:'V', tagline:'A unified, high-performance JavaScript toolchain.', problem:'JS tooling is fragmented and slow.', industry:'Developer tools', stage:'Seed', location:'Singapore', foundedYear:2024, website:'voidzero.dev' },
    starQuality:0.9, research:0, fmf:{ sim:0.9, rationale:'Created Vue and Vite; VoidZero is the commercial continuation of exactly that toolchain work.' },
    skills:{ technical:0.95, commercial:0.6, domain:0.9, product:0.85 }, networkAuthority:88, amplification:80, accelPress:80,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['medium'] }, redFlags:[],
  },
  sindresorhus: {
    id:'sindre-sorhus', thesis:'oss-maintainers', discoveredOffsetMins: 155, status:'watching', pipeline:'Watch',
    headline:'Full-time open-source maintainer at massive scale',
    venture:{ id:'sindre-oss', name:'Open-source infrastructure', monogram:'S', tagline:'Thousands of npm packages the ecosystem depends on.', problem:'The JS ecosystem needs reliable small building blocks.', industry:'Open source', stage:'Independent', location:'Oslo', foundedYear:2013, website:'sindresorhus.com' },
    starQuality:0.45, research:0, fmf:{ sim:0.7, rationale:'Unmatched shipping record, though much star-weight is curated lists rather than product code.' },
    skills:{ technical:0.95, commercial:0.3, domain:0.7, product:0.6 }, networkAuthority:82, amplification:74, accelPress:55,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['medium'] },
    redFlags:[{ text:'Much star-weight is awesome-lists, not shipped product', note:'Contribution-value weighting discounts this', severity:'low' }],
  },
  antfu: {
    id:'anthony-fu', thesis:'ai-devtools', discoveredOffsetMins: 203, status:'watching', pipeline:'Watch',
    headline:'Vite / Nuxt core team, tireless tooling maintainer',
    venture:{ id:'antfu-oss', name:'Nuxt / Vite ecosystem', monogram:'A', tagline:'Core tooling and DX for modern frontends.', problem:'Frontend DX needs constant maintenance and invention.', industry:'Developer tools', stage:'Independent', location:'Remote', foundedYear:2020, website:'antfu.me' },
    starQuality:0.85, research:0, fmf:{ sim:0.8, rationale:'Deep, consistent ownership of Vite/Nuxt tooling.' },
    skills:{ technical:0.92, commercial:0.4, domain:0.8, product:0.75 }, networkAuthority:80, amplification:76, accelPress:60,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['high'] }, redFlags:[],
  },
  shadcn: {
    id:'shadcn', thesis:'ai-devtools', discoveredOffsetMins: 240, status:'watching', pipeline:'Watch',
    headline:'Creator of shadcn/ui, redefining component distribution',
    venture:{ id:'shadcn-ui', name:'shadcn/ui', monogram:'S', tagline:'Copy-paste components and the registry model.', problem:'Component libraries are hard to own and customise.', industry:'Developer tools', stage:'Open source / at Vercel', location:'Remote', foundedYear:2023, website:'ui.shadcn.com' },
    starQuality:0.9, research:0, fmf:{ sim:0.85, rationale:'Invented a distribution model now copied across the ecosystem.' },
    skills:{ technical:0.85, commercial:0.55, domain:0.8, product:0.9 }, networkAuthority:78, amplification:82, accelPress:68,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['high'] }, redFlags:[],
  },
  mckaywrigley: {
    id:'mckay-wrigley', thesis:'ai-devtools', discoveredOffsetMins: 290, status:'discovered', pipeline:'Watch',
    headline:'Ships AI apps in public daily, education-first',
    venture:{ id:'takeoff', name:'Takeoff', monogram:'T', tagline:'Learn to build with AI, in public.', problem:'Developers need to learn AI building fast.', industry:'AI education / tools', stage:'Early', location:'USA', foundedYear:2023, website:'jointakeoff.com' },
    starQuality:0.8, research:0, fmf:{ sim:0.82, rationale:'Chatbot-UI and a steady stream of AI apps map directly to teaching AI building.' },
    skills:{ technical:0.85, commercial:0.6, domain:0.75, product:0.8 }, networkAuthority:72, amplification:80, accelPress:55,
    conf:{ Proof:['high'], Gravity:['medium'], Trajectory:['high'] }, redFlags:[],
  },
  'transitive-bullshit': {
    id:'travis-fischer', thesis:'ai-devtools', discoveredOffsetMins: 340, status:'discovered', pipeline:'Watch',
    headline:'Building Agentic, open-source AI agent stdlib',
    venture:{ id:'agentic', name:'Agentic', monogram:'A', tagline:'An AI agent standard library and toolset.', problem:'Wiring tools into LLM agents is repetitive and brittle.', industry:'AI infrastructure', stage:'Seed', location:'USA', foundedYear:2023, website:'agentic.so' },
    starQuality:0.88, research:0, fmf:{ sim:0.86, rationale:'Agentic (18k stars) is the direct commercial line from years of TS/AI OSS.' },
    skills:{ technical:0.9, commercial:0.5, domain:0.8, product:0.75 }, networkAuthority:66, amplification:70, accelPress:52,
    conf:{ Proof:['high'], Gravity:['medium'], Trajectory:['high'] }, redFlags:[],
  },
  leerob: {
    id:'lee-robinson', thesis:'ai-devtools', discoveredOffsetMins: 410, status:'discovered', pipeline:'Watch',
    headline:'Developer-experience leader, huge distribution',
    venture:{ id:'leerob-next', name:'Developer experience', monogram:'L', tagline:'Teaching and tooling for shipping on the web.', problem:'Web devs need clear paths to production.', industry:'Developer tools / media', stage:'Exploring', location:'Des Moines, IA', foundedYear:2014, website:'leerob.com' },
    starQuality:0.85, research:0, fmf:{ sim:0.72, rationale:'Years leading DX at Vercel; strong distribution, venture still forming.' },
    skills:{ technical:0.8, commercial:0.75, domain:0.75, product:0.8 }, networkAuthority:76, amplification:78, accelPress:60,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['medium'] }, redFlags:[],
  },
  jaredpalmer: {
    id:'jared-palmer', thesis:'ai-devtools', discoveredOffsetMins: 520, status:'discovered', pipeline:'Watch',
    headline:'Formik and Turborepo creator, acquired by Vercel',
    venture:{ id:'jared-next', name:'Next venture', monogram:'J', tagline:'Serial DX founder between acts.', problem:'Monorepo and build tooling at scale.', industry:'Developer tools', stage:'Exploring', location:'New York, NY', foundedYear:2013, website:'jaredpalmer.com' },
    starQuality:0.85, research:0, fmf:{ sim:0.75, rationale:'Formik + Turborepo (acquired) prove repeated 0-to-1 tooling.' },
    skills:{ technical:0.85, commercial:0.7, domain:0.8, product:0.8 }, networkAuthority:74, amplification:70, accelPress:66,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['medium'] }, redFlags:[],
  },
};

const THESES = [
  { id:'dach-ai-fintech', label:'Technical AI and fintech founders, DACH', description:'Deep-technical founders in Germany, Austria and Switzerland building AI for finance and productivity.', keywords:['ai','fintech','dach','germany','ml','quant'], active:true },
  { id:'ai-devtools', label:'AI developer-tools founders', description:'Founders building the tooling and infrastructure layer for AI-native software.', keywords:['ai','developer tools','infrastructure','agents'], active:false },
  { id:'oss-maintainers', label:'Open-source maintainers turning founders', description:'High-authority open-source maintainers with the pull to build a company.', keywords:['open source','maintainer','community'], active:false },
];

const conf1 = (arr) => arr[0]; // authored confidence level
// Some GitHub users set location to a literal "undefined"/"null" joke string.
const cleanLoc = (l) => (l && !['undefined', 'null', 'n/a', ''].includes(String(l).trim().toLowerCase()) ? l : undefined);

function receiptsFor(f, prof) {
  const d = f.derived;
  return { d, top: d.topRepos };
}

const founders = [];
const ventures = [];

for (const [handle, prof] of Object.entries(P)) {
  const f = byHandle[handle];
  if (!f || f.error) { console.error('skip', handle); continue; }
  const d = f.derived;
  const ageYears = accountAgeYears(f.created_at);
  const effStars = Math.round(d.stars * prof.starQuality);
  const shipped = d.ownedCount;
  const finishRate = shipped ? clamp(d.topRepos.filter(r=>!r.archived).length / Math.min(shipped, d.topRepos.length || 1), 0, 1) : 0;
  const downloads = prof.downloadsOverride ?? (npm[handle]?.downloads || 0);
  const npmTop = npm[handle]?.top || [];

  // ── PROOF features (absent features are dropped, not scored as ~0) ──
  const fStars = curve(effStars, 60000);
  const fShip = clamp(Math.round(curve(shipped, 40) * 0.6 + (finishRate * 40)), 2, 99);
  const fDown = downloads ? curve(downloads, 5000000) : 0;
  const fResearch = prof.research || 0;
  const fFmf = Math.round(prof.fmf.sim * 100);
  const proof = wmeanA([
    { v: fStars, w: 0.23 },
    { v: fShip, w: 0.25 },
    { v: fDown, w: 0.15, absent: downloads === 0 },
    { v: fResearch, w: 0.12, absent: fResearch <= 2 },
    { v: fFmf, w: 0.25 },
  ]);

  // ── GRAVITY features ──
  const fFollow = clamp(curve(f.followers, 200000) - 6, 2, 99);
  const fAuth = prof.networkAuthority;
  const fAmp = prof.amplification;
  const fAccel = prof.accelPress;
  const gravity = wmean([[fFollow,0.35],[fAuth,0.30],[fAmp,0.20],[fAccel,0.15]]);

  // ── TRAJECTORY features ──
  const recentPush = (d.recentEventTypes?.PushEvent || 0) + (d.recentEventTypes?.PullRequestEvent || 0);
  const daysSince = d.lastActive ? Math.max(0, (new Date('2026-07-19') - new Date(d.lastActive))/(24*3600*1000)) : 365;
  const fCadence = clamp(curve(recentPush, 60) , 2, 99);
  const reposPerYear = shipped / ageYears;
  const fAccelT = clamp(Math.round(curve(reposPerYear, 25) * 0.5 + (ageYears < 4 ? 45 : 20)), 2, 99);
  const fCareerAge = clamp(Math.round((shipped / ageYears) * 8 + (ageYears < 3 ? 40 : 15)), 2, 99);
  const fRecency = clamp(Math.round(100 - daysSince * 1.2), 2, 99);
  const trajectory = wmean([[fCadence,0.30],[fAccelT,0.30],[fCareerAge,0.25],[fRecency,0.15]]);

  // ── confidence per metric ──
  const confs = { Proof: conf1(prof.conf.Proof), Gravity: conf1(prof.conf.Gravity), Trajectory: conf1(prof.conf.Trajectory) };

  // ── composite over trusted metrics, Maschmeyer preset default ──
  const W = { Proof:0.35, Gravity:0.45, Trajectory:0.20 };
  const scores = { Proof: proof, Gravity: gravity, Trajectory: trajectory };
  const trusted = ['Proof','Gravity','Trajectory'].filter(m=>confs[m] !== 'low');
  const excluded = ['Proof','Gravity','Trajectory'].filter(m=>confs[m] === 'low');
  const useM = trusted.length ? trusted : ['Proof','Gravity','Trajectory'];
  const wsum = useM.reduce((a,m)=>a+W[m],0);
  const rawComposite = Math.round(useM.reduce((a,m)=>a+scores[m]*W[m],0)/wsum);

  // ── red-flag gate ──
  const high = prof.redFlags.filter(r=>r.severity==='high').length;
  const med = prof.redFlags.filter(r=>r.severity==='medium').length;
  let cap = 100; if (high>=1) cap=Math.min(cap,55-(high-1)*10); if (med>=1) cap=Math.min(cap,78-(med-1)*6); cap=clamp(cap,20,100);
  const capped = rawComposite > cap;
  const composite = capped ? cap : rawComposite;

  // ── overall confidence ──
  const order = { low:0, medium:1, high:2 };
  let baseConf = trusted.map(m=>confs[m]).reduce((a,c)=> order[c]<order[a]?c:a, 'high');
  let overall = excluded.length ? (baseConf==='high'?'medium':'low') : baseConf;

  // ── percentile + neighbour (composite vs anchors, Maschmeyer weights) ──
  const anchorComposites = A_PROOF.map((_,i)=> Math.round((A_PROOF[i]*W.Proof + A_GRAV[i]*W.Gravity + A_TRAJ[i]*W.Trajectory)/(W.Proof+W.Gravity+W.Trajectory)));
  const percentile = pctl(composite, anchorComposites);
  // nearest neighbour name from anchors.ts order
  // ANCHOR_NAMES is defined globally from ANCHORS (single source of truth).
  let nIdx=-1, nD=Infinity; anchorComposites.forEach((c,i)=>{
    if (ANCHORS[i].name === (f.name||handle)) return;           // never yourself
    if (ANCHORS[i].outcome==='failed' && !capped) return;        // clean founders skip cautionary tails
    const dd=Math.abs(c-composite); if(dd<nD){nD=dd;nIdx=i;}
  });
  if (nIdx<0) nIdx = 0;
  const neighbour = ANCHOR_NAMES[nIdx];

  const band = overall==='low' ? (composite>=50?'Watch':'Pass') : (composite>=70?'Invest':composite>=48?'Watch':'Pass');
  const proofZ = squashZ(proof, A_PROOF), gravZ = squashZ(gravity, A_GRAV), trajZ = squashZ(trajectory, A_TRAJ);

  // ── evidence receipts (REAL) ──
  const url = f.html_url;
  const proofReceipts = [];
  proofReceipts.push({ connector:'github', metric:'Proof', feature:'Shipping record', text:`${d.ownedCount} public repos, ${d.stars.toLocaleString('en-US')} stars across owned work`, value:d.stars, url, at:f.created_at });
  if (d.topRepos[0]) { const t=d.topRepos[0]; proofReceipts.push({ connector:'github', metric:'Proof', feature:'Flagship build', text:`${t.name}: ${t.stars.toLocaleString('en-US')} stars${t.lang?', '+t.lang:''}`, quote:t.desc||undefined, value:t.stars, url:t.url, at:t.created }); }
  if (prof.fmfReceiptFrom) { const t=d.topRepos.find(r=>r.name===prof.fmfReceiptFrom); if(t) proofReceipts.push({ connector:'github', metric:'Proof', feature:'Founder-market-fit', text:`${t.name}: ${t.desc||''}`, quote:'Directly on the problem the venture solves', value:t.stars, url:t.url, at:t.created }); }
  if (downloads > 0) { const t=npmTop[0]; proofReceipts.push({ connector:'npm', metric:'Proof', feature:'Real-world adoption', text:`${downloads.toLocaleString('en-US')} npm downloads last month`, quote: t?`led by ${t[0]} at ${Number(t[1]).toLocaleString('en-US')}/mo`:undefined, value:downloads, url:`https://www.npmjs.com/~${handle}` }); }

  const gravReceipts = [];
  gravReceipts.push({ connector:'github', metric:'Gravity', feature:'True reach', text:`${f.followers.toLocaleString('en-US')} GitHub followers`, value:f.followers, url });
  if (confs.Gravity==='low') gravReceipts.push({ connector:'linkedin', metric:'Gravity', feature:'Social footprint', text:'No X or LinkedIn connected yet, reach is provisional', quote: prof.gravityNote });

  const trajReceipts = [];
  trajReceipts.push({ connector:'github', metric:'Trajectory', feature:'Recent cadence', text:`${recentPush} recent public pushes, last active ${d.lastActive?d.lastActive.slice(0,10):'unknown'}`, value:recentPush, url });
  trajReceipts.push({ connector:'github', metric:'Trajectory', feature:'Career-age slope', text:`${shipped} repos over ${ageYears.toFixed(1)} yrs since joining (${f.created_at.slice(0,4)})`, value:Math.round(reposPerYear*10)/10, url, at:f.created_at });

  // ── trajectory timeline from real repo creation dates ──
  const timeline = [...d.topRepos].filter(r=>r.created).sort((a,b)=> new Date(a.created)-new Date(b.created)).map((r,i,arr)=>({ date:r.created.slice(0,7), value: clamp(30 + i*(60/Math.max(1,arr.length-1)) + (r.stars>50?10:0),10,99), label:`${r.name}${r.stars?` (${r.stars}★)`:''}`, kind:'ship', url:r.url }));

  // ── FMF ──
  const fmf = { similarity: prof.fmf.sim, rationale: prof.fmf.rationale, receipts: prof.fmfReceiptFrom ? [proofReceipts[proofReceipts.length-1]] : [proofReceipts[0]] };

  const mkMetric = (metric, score, features, receipts, confidence, z, rationale) => ({
    metric, score, weight: W[metric], percentile: pctl(score, metric==='Proof'?A_PROOF:metric==='Gravity'?A_GRAV:A_TRAJ),
    confidence, completeness: confidence==='high'?0.85:confidence==='medium'?0.6:0.3, agreement: confidence==='high'?0.85:confidence==='medium'?0.6:0.35,
    rationale, by:'heuristic', z: Math.round(z*100)/100, features, receipts,
  });

  const proofFeatures = [
    { key:'stars', label:'Contribution-weighted stars', raw:effStars, display:`${effStars.toLocaleString('en-US')} adj. stars`, z:0, contribution:fStars, receipts:[proofReceipts[0]] },
    { key:'finish', label:'Shipping finish-rate', raw:Math.round(finishRate*100), display:`${Math.round(finishRate*100)}% finished`, z:0, contribution:fShip, receipts:[proofReceipts[1]||proofReceipts[0]] },
    { key:'downloads', label:'Package downloads', raw:downloads, display:downloads?`${downloads.toLocaleString('en-US')}/mo`:'none public', z:0, contribution:fDown, receipts: downloads? [proofReceipts.find(r=>r.connector==='npm')].filter(Boolean) : [] },
    { key:'research', label:'Research depth', raw:fResearch, display:fResearch>10?'notable':'minimal', z:0, contribution:fResearch, receipts:[] },
    { key:'fmf', label:'Founder-market-fit', raw:Math.round(prof.fmf.sim*100), display:`${Math.round(prof.fmf.sim*100)}% match`, z:0, contribution:fFmf, receipts: fmf.receipts },
  ];
  const gravFeatures = [
    { key:'reach', label:'True reach', raw:f.followers, display:`${f.followers.toLocaleString('en-US')} followers`, z:0, contribution:fFollow, receipts:[gravReceipts[0]] },
    { key:'authority', label:'Network authority', raw:fAuth, display:fAuth>50?'high':'thin', z:0, contribution:fAuth, receipts:[] },
    { key:'amplification', label:'Amplification', raw:fAmp, display:fAmp>50?'strong':'low', z:0, contribution:fAmp, receipts:[] },
    { key:'backing', label:'Accelerators / press', raw:fAccel, display:fAccel>50?'notable':'early', z:0, contribution:fAccel, receipts:[] },
  ];
  const trajFeatures = [
    { key:'cadence', label:'Recent cadence', raw:recentPush, display:`${recentPush} pushes`, z:0, contribution:fCadence, receipts:[trajReceipts[0]] },
    { key:'accel', label:'Acceleration', raw:Math.round(reposPerYear*10)/10, display:`${reposPerYear.toFixed(1)} repos/yr`, z:0, contribution:fAccelT, receipts:[trajReceipts[1]] },
    { key:'careerage', label:'Career-age slope', raw:Math.round(ageYears*10)/10, display:`${ageYears.toFixed(1)} yr career`, z:0, contribution:fCareerAge, receipts:[trajReceipts[1]] },
    { key:'recency', label:'Ship recency', raw:Math.round(daysSince), display:`${Math.round(daysSince)}d ago`, z:0, contribution:fRecency, receipts:[] },
  ];

  const proofRat = confs.Proof==='low' ? prof.proofNote : `Proven builder: ${prof.fmf.sim>0.85?'exceptional':'clear'} founder-market-fit, ${d.stars.toLocaleString('en-US')} stars, finishes what it starts.`;
  const gravRat = confs.Gravity==='low' ? prof.gravityNote : `${f.followers.toLocaleString('en-US')} followers with ${fAuth>70?'high':'growing'} network authority; people and attention move toward them.`;
  const trajRat = `Momentum ${trajectory>75?'is steep':'is positive'}: ${recentPush} recent pushes, ${reposPerYear.toFixed(1)} repos/yr, normalised for a ${ageYears.toFixed(1)}-year career.`;

  const score = {
    proof: mkMetric('Proof', proof, proofFeatures, proofReceipts, confs.Proof, proofZ, proofRat),
    gravity: mkMetric('Gravity', gravity, gravFeatures, gravReceipts, confs.Gravity, gravZ, gravRat),
    trajectory: mkMetric('Trajectory', trajectory, trajFeatures, trajReceipts, confs.Trajectory, trajZ, trajRat),
    composite, rawComposite, percentile, band, confidence: overall, capped, capReason: capped?`Capped at ${cap} by the red-flag gate.`:undefined,
    anchorNeighbor: neighbour, skills: prof.skills,
  };
  const evidenceCount = proofReceipts.length + gravReceipts.length + trajReceipts.length;

  founders.push({
    id: prof.id, name: f.name || handle, initials: (f.name||handle).split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase(),
    headline: prof.headline, location: cleanLoc(f.location) || prof.venture.location,
    handles: { github: handle, website: prof.venture.website, x: f.twitter||undefined, npm: undefined },
    ventureId: prof.venture.id, discoveredAt: '', discoveredOffsetMins: prof.discoveredOffsetMins, thesisId: prof.thesis,
    triage: clamp(Math.round((proof*0.4 + trajectory*0.4 + (confs.Gravity==='low'?40:gravity)*0.2)),2,99),
    status: prof.status, pipeline: prof.pipeline, score, fmf, redFlags: prof.redFlags, trajectory: timeline, evidenceCount,
    note: confs.Gravity==='low'?prof.gravityNote:undefined,
  });

  const decision = {
    band, composite, confidence: overall,
    rationale: band==='Invest'?`Strong across the metrics we can verify; ${neighbour}-tier on our anchor set.`: band==='Watch'? `Promising on verified evidence${excluded.length?`, but ${excluded.join(' and ')} ${excluded.length>1?'are':'is'} unverified`:''}; revisit as more signal lands.` : 'Below the bar on verifiable founder evidence right now.',
    routeToHuman: overall==='low' || evidenceCount<3 || excluded.length>0,
  };
  const team = handle==='luisreindlmeier' ? {
    coverage: prof.skills, bonus: 0,
    gaps:['Commercial / go-to-market coverage is thin on the evaluated founder'], redundancies:[],
    sharedHistory:['gedonus co-founders (second founder pending evaluation)'],
    perFounder:[{ founderId: prof.id, name: f.name, skills: prof.skills }],
  } : undefined;

  ventures.push({ ...prof.venture, founderIds:[prof.id], decision, team });
}

// deterministic order: Luis first, then by discoveredOffset
founders.sort((a,b)=> a.discoveredOffsetMins - b.discoveredOffsetMins);

// ── emit anchors.ts from the single-source ANCHORS ──
const anchorsBody = `import type { AnchorFounder } from '../model';

// GENERATED by scratchpad/gen_seed.mjs. The calibration ANCHOR SET: known
// founders, some who succeeded and some who did not, spanning the full range
// so percentiles mean something. Every emitted score is z-normalised and turned
// into a percentile against this set ("43rd percentile, sits next to X").
// Curated reference points, not live scores.
export const ANCHORS: readonly AnchorFounder[] = ${JSON.stringify(ANCHORS, null, 2)};

export const ANCHOR_PROOF = ANCHORS.map((a) => a.proof);
export const ANCHOR_GRAVITY = ANCHORS.map((a) => a.gravity);
export const ANCHOR_TRAJECTORY = ANCHORS.map((a) => a.trajectory);
`;
await writeFile(new URL('../src/app/core/data/anchors.ts', import.meta.url), anchorsBody);
console.error('WROTE anchors.ts with', ANCHORS.length, 'anchors');

const header = `// GENERATED by scratchpad/gen_seed.mjs from REAL public GitHub data + grounded
// per-founder assessments. Do not hand-edit; re-run the generator. Every numeric
// receipt (stars, followers, repos, dates) is real; qualitative judgements
// (founder-market-fit, skills, red flags, venture copy) are authored. Timestamps
// are computed at runtime from discoveredOffsetMins so the Radar always reads live.
import type { Founder, Venture, Thesis } from '../model';
`;
const body = `${header}
export const THESES: readonly Thesis[] = ${JSON.stringify(THESES, null, 2)};

export const SEED_VENTURES: readonly Venture[] = ${JSON.stringify(ventures, null, 2)};

export const SEED_FOUNDERS: readonly (Founder & { discoveredOffsetMins: number })[] = ${JSON.stringify(founders, null, 2)};
`;
await writeFile(new URL('../src/app/core/data/seed.ts', import.meta.url), body);
console.error('WROTE seed.ts with', founders.length, 'founders,', ventures.length, 'ventures');

// Plain-JSON export for the Supabase seed script (node-consumable, no TS import).
await writeFile(
  new URL('../supabase/seed-data.json', import.meta.url),
  JSON.stringify({ theses: THESES, ventures, founders, anchors: ANCHORS }, null, 2),
);
console.error('WROTE supabase/seed-data.json');
// quick report
for (const fo of founders) console.error(`${fo.name.padEnd(20)} P=${fo.score.proof.score} G=${fo.score.gravity.score}(${fo.score.gravity.confidence}) T=${fo.score.trajectory.score} => ${fo.score.composite} ${fo.score.band} pct=${fo.score.percentile} ~${fo.score.anchorNeighbor}`);
