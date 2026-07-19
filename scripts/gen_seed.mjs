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
// gedonus is a multi-founder venture: both co-founder profiles point at this
// same object, and the venture is emitted once with both founder ids.
const GEDONUS = { id:'gedonus', name:'gedonus', monogram:'g', tagline:'AI drafts your slides. You stay in control.',
  problem:'Finance teams (IB, PE, consulting) spend hours building pitchbooks and IC packs by hand, where one wrong number or off-brand slide is expensive.',
  industry:'Fintech / AI productivity', stage:'Pre-seed', location:'Frankfurt, Germany', foundedYear:2025, website:'gedonus.com',
  sharedHistory:[
    'Registered partners of gedonus GbR since 2025, named together in the Impressum',
    'Both based in Frankfurt, inside the finance-team market they sell into',
    'A third partner, Tim Niklas Sassmannshausen, is not yet evaluated',
  ] };

const P = {
  luisreindlmeier: {
    id: 'luis-reindlmeier', thesis: 'dach-ai-fintech', discoveredOffsetMins: 8, pipeline: 'Discovered',
    headline: 'Building an AI copilot for finance decks, quant-ML background',
    venture: GEDONUS,
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
    ],
    extraReceipts: {
      Proof: [
        { connector:'handelsregister', feature:'Founding record', text:'Registered co-founder and partner of gedonus GbR, Frankfurt', quote:'Named in the gedonus.com Impressum', url:'https://gedonus.com' },
        { connector:'semanticscholar', feature:'Research depth', text:'Bachelor thesis on a transformer-based limit order book, indexed under his Scholar profile' },
      ],
      Trajectory: [
        { connector:'wayback', feature:'Off-platform momentum', text:'gedonus.com captured in the Internet Archive since the 2025 launch', url:'https://web.archive.org/web/2025/https://gedonus.com' },
      ],
    },
    fmfReceiptFrom: 'transformer-lob',
  },
  StevWorks: {
    id: 'stefan-cames', thesis: 'dach-ai-fintech', discoveredOffsetMins: 14, pipeline: 'Discovered',
    headline: 'gedonus co-founder, Deutsche Bank engineering and tech strategy, Frankfurt School Digital Business',
    venture: GEDONUS,
    starQuality: 1.0, research: 30, downloadsOverride: 0,
    fmf: { sim: 0.86, rationale: 'He builds for the room he has sat in: Java and web development plus a tech-strategy internship at Deutsche Bank, a Digital Business degree at Frankfurt School, and an elected Finance and Sponsoring office. gedonus sells slide automation to exactly those finance teams, so the customer, the workflow and the buyer are all first-hand knowledge rather than research.' },
    skills: { technical: 0.55, commercial: 0.8, domain: 0.7, product: 0.6 },
    networkAuthority: 34, amplification: 26, accelPress: 20,
    conf: { Proof: ['medium'], Gravity: ['medium'], Trajectory: ['low'] },
    ratOverride: {
      Proof: 'Real but modest public code: 6 repos over a 7-year account, from a Bundeswettbewerb Informatik submission to a recent MCP server and an agentic-SDLC experiment, all finished rather than abandoned. The weight of his evidence is professional and non-public: Java and web development at Deutsche Bank plus its Tech Strategy team, which does not show up as stars.',
      Gravity: 'A real, verifiable footprint that is early-career rather than thin: elected to the Frankfurt School Student Council 2025 for Finance and Sponsoring, a Deutsche Bank affiliation, a Google Scholar profile and an active LinkedIn presence in both German and English. Institutional credibility ahead of audience; there is no X reach yet.',
      Trajectory: 'GitHub cadence understates him. His public pushes are near zero because the last two years of work, Deutsche Bank engineering, the gedonus product and an event-photography business, are private or off-platform. Momentum is excluded from the composite until a non-code source is connected.',
    },
    note: 'Most of his evidence is off GitHub: Deutsche Bank, Frankfurt School, an elected AStA office and a Google Scholar profile. Trajectory is measured from public code only, so it is excluded from the composite until a non-code source is connected.',
    redFlags: [
      { text:'Public code footprint is early-career and low-star', note:'His production work at Deutsche Bank and on gedonus is private, not absent', severity:'low' },
      { text:'Near-zero public commit cadence in the last 12 months', note:'Consistent with private enterprise and product work', severity:'low' },
      { text:'Runs an event-photography business alongside gedonus', note:'Split attention to watch, not a coherence flag at pre-seed', severity:'low' },
    ],
    extraReceipts: {
      Proof: [
        { connector:'linkedin', feature:'Professional engineering record', text:'Deutsche Bank: Java and web development, plus a Tech Strategy team internship', quote:'Technology delivery combined with IT-transformation strategy' },
        { connector:'handelsregister', feature:'Founding record', text:'Registered co-founder and partner of gedonus GbR, with Luis Reindlmeier and Tim Niklas Sassmannshausen', quote:'Named in the gedonus.com Impressum', url:'https://gedonus.com' },
        { connector:'semanticscholar', feature:'Research depth', text:'Verified Google Scholar profile for student publications and theses' },
      ],
      Gravity: [
        { connector:'linkedin', feature:'Institutional standing', text:'Elected to the Frankfurt School Student Council 2025, office for Finance and Sponsoring', quote:'Elected office, so the standing is voted for rather than claimed' },
        { connector:'linkedin', feature:'Education', text:'BSc Frankfurt School of Finance and Management, focus Digital Business, plus 8 months in the USA' },
      ],
      Trajectory: [
        { connector:'linkedin', feature:'Off-platform momentum', text:'2025: co-founded gedonus GbR, graduated, and took elected office in the same year' },
      ],
    },
    fmfReceiptFeature: 'Professional engineering record',
  },
  steipete: {
    id:'peter-steinberger', thesis:'dach-ai-fintech', discoveredOffsetMins: 34, pipeline:'Invest',
    headline:'PSPDFKit founder, now building AI agent tooling, Vienna roots',
    venture:{ id:'steipete-agents', name:'Agent tooling', monogram:'A', tagline:'Command-line and editor tooling for coding agents.',
      problem:'Developers running AI coding agents lack fast, native tooling to steer and observe them.', industry:'AI developer tools', stage:'Angel / building', location:'Vienna / remote', foundedYear:2024, website:'steipete.me' },
    starQuality: 0.95, research: 0, fmf:{ sim:0.8, rationale:'A decade shipping PSPDFKit plus a burst of agent-tooling repos lines up tightly with building for AI-native developers.' },
    skills:{ technical:0.95, commercial:0.7, domain:0.85, product:0.8 }, networkAuthority:86, amplification:78, accelPress:70,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['high'] },
    redFlags:[{ text:'Serial founder energy across many repos', note:'Focus risk, not a coherence flag', severity:'low' }],
  },
  rauchg: {
    id:'guillermo-rauch', thesis:'ai-devtools', discoveredOffsetMins: 72, pipeline:'Invest',
    headline:'Vercel founder/CEO, prolific open-source builder',
    venture:{ id:'vercel', name:'Vercel', monogram:'V', tagline:'Frontend cloud and the Next.js framework.', problem:'Shipping fast, reliable web apps is hard to operate.', industry:'Developer infrastructure', stage:'Growth', location:'San Francisco', foundedYear:2015, website:'vercel.com' },
    starQuality:0.9, research:0, fmf:{ sim:0.82, rationale:'Socket.io, mongoose and years of OSS precede Vercel; the builder and the product are the same person.' },
    skills:{ technical:0.9, commercial:0.85, domain:0.85, product:0.9 }, networkAuthority:92, amplification:88, accelPress:88,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['high'] }, redFlags:[],
  },
  yyx990803: {
    id:'evan-you', thesis:'oss-maintainers', discoveredOffsetMins: 12960, pipeline:'Watch',
    scoreDelta:{ composite:7, proof:4, trajectory:9, since:'since last week' },
    headline:'Vue and Vite creator, now building VoidZero',
    venture:{ id:'voidzero', name:'VoidZero', monogram:'V', tagline:'A unified, high-performance JavaScript toolchain.', problem:'JS tooling is fragmented and slow.', industry:'Developer tools', stage:'Seed', location:'Singapore', foundedYear:2024, website:'voidzero.dev' },
    starQuality:0.9, research:0, fmf:{ sim:0.9, rationale:'Created Vue and Vite; VoidZero is the commercial continuation of exactly that toolchain work.' },
    skills:{ technical:0.95, commercial:0.6, domain:0.9, product:0.85 }, networkAuthority:88, amplification:80, accelPress:80,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['medium'] }, redFlags:[],
  },
  sindresorhus: {
    id:'sindre-sorhus', thesis:'oss-maintainers', discoveredOffsetMins: 155, pipeline:'Watch',
    headline:'Full-time open-source maintainer at massive scale',
    venture:{ id:'sindre-oss', name:'Open-source infrastructure', monogram:'S', tagline:'Thousands of npm packages the ecosystem depends on.', problem:'The JS ecosystem needs reliable small building blocks.', industry:'Open source', stage:'Independent', location:'Oslo', foundedYear:2013, website:'sindresorhus.com' },
    starQuality:0.45, research:0, fmf:{ sim:0.7, rationale:'Unmatched shipping record, though much star-weight is curated lists rather than product code.' },
    skills:{ technical:0.95, commercial:0.3, domain:0.7, product:0.6 }, networkAuthority:82, amplification:74, accelPress:55,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['medium'] },
    redFlags:[{ text:'Much star-weight is awesome-lists, not shipped product', note:'Contribution-value weighting discounts this', severity:'low' }],
  },
  antfu: {
    id:'anthony-fu', thesis:'ai-devtools', discoveredOffsetMins: 7200, pipeline:'Watch',
    scoreDelta:{ composite:3, gravity:6, since:'since last check' },
    headline:'Vite / Nuxt core team, tireless tooling maintainer',
    venture:{ id:'antfu-oss', name:'Nuxt / Vite ecosystem', monogram:'A', tagline:'Core tooling and DX for modern frontends.', problem:'Frontend DX needs constant maintenance and invention.', industry:'Developer tools', stage:'Independent', location:'Remote', foundedYear:2020, website:'antfu.me' },
    starQuality:0.85, research:0, fmf:{ sim:0.8, rationale:'Deep, consistent ownership of Vite/Nuxt tooling.' },
    skills:{ technical:0.92, commercial:0.4, domain:0.8, product:0.75 }, networkAuthority:80, amplification:76, accelPress:60,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['high'] }, redFlags:[],
  },
  shadcn: {
    id:'shadcn', thesis:'ai-devtools', discoveredOffsetMins: 240, pipeline:'Watch',
    headline:'Creator of shadcn/ui, redefining component distribution',
    venture:{ id:'shadcn-ui', name:'shadcn/ui', monogram:'S', tagline:'Copy-paste components and the registry model.', problem:'Component libraries are hard to own and customise.', industry:'Developer tools', stage:'Open source / at Vercel', location:'Remote', foundedYear:2023, website:'ui.shadcn.com' },
    starQuality:0.9, research:0, fmf:{ sim:0.85, rationale:'Invented a distribution model now copied across the ecosystem.' },
    skills:{ technical:0.85, commercial:0.55, domain:0.8, product:0.9 }, networkAuthority:78, amplification:82, accelPress:68,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['high'] }, redFlags:[],
  },
  mckaywrigley: {
    id:'mckay-wrigley', thesis:'ai-devtools', discoveredOffsetMins: 290, pipeline:'Discovered',
    headline:'Ships AI apps in public daily, education-first',
    venture:{ id:'takeoff', name:'Takeoff', monogram:'T', tagline:'Learn to build with AI, in public.', problem:'Developers need to learn AI building fast.', industry:'AI education / tools', stage:'Early', location:'USA', foundedYear:2023, website:'jointakeoff.com' },
    starQuality:0.8, research:0, fmf:{ sim:0.82, rationale:'Chatbot-UI and a steady stream of AI apps map directly to teaching AI building.' },
    skills:{ technical:0.85, commercial:0.6, domain:0.75, product:0.8 }, networkAuthority:72, amplification:80, accelPress:55,
    conf:{ Proof:['high'], Gravity:['medium'], Trajectory:['high'] }, redFlags:[],
  },
  'transitive-bullshit': {
    id:'travis-fischer', thesis:'ai-devtools', discoveredOffsetMins: 340, pipeline:'Discovered',
    headline:'Building Agentic, open-source AI agent stdlib',
    venture:{ id:'agentic', name:'Agentic', monogram:'A', tagline:'An AI agent standard library and toolset.', problem:'Wiring tools into LLM agents is repetitive and brittle.', industry:'AI infrastructure', stage:'Seed', location:'USA', foundedYear:2023, website:'agentic.so' },
    starQuality:0.88, research:0, fmf:{ sim:0.86, rationale:'Agentic (18k stars) is the direct commercial line from years of TS/AI OSS.' },
    skills:{ technical:0.9, commercial:0.5, domain:0.8, product:0.75 }, networkAuthority:66, amplification:70, accelPress:52,
    conf:{ Proof:['high'], Gravity:['medium'], Trajectory:['high'] }, redFlags:[],
  },
  leerob: {
    id:'lee-robinson', thesis:'ai-devtools', discoveredOffsetMins: 410, pipeline:'Discovered',
    headline:'Developer-experience leader, huge distribution',
    venture:{ id:'leerob-next', name:'Developer experience', monogram:'L', tagline:'Teaching and tooling for shipping on the web.', problem:'Web devs need clear paths to production.', industry:'Developer tools / media', stage:'Exploring', location:'Des Moines, IA', foundedYear:2014, website:'leerob.com' },
    starQuality:0.85, research:0, fmf:{ sim:0.72, rationale:'Years leading DX at Vercel; strong distribution, venture still forming.' },
    skills:{ technical:0.8, commercial:0.75, domain:0.75, product:0.8 }, networkAuthority:76, amplification:78, accelPress:60,
    conf:{ Proof:['high'], Gravity:['high'], Trajectory:['medium'] }, redFlags:[],
  },
  jaredpalmer: {
    id:'jared-palmer', thesis:'ai-devtools', discoveredOffsetMins: 520, pipeline:'Discovered',
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

// How long ago each venture was decided, keyed by venture id. Rendered as a live
// timestamp at runtime; a venture routed to a human never gets one.
const DECIDED_OFFSETS = {
  'steipete-agents': 1440, vercel: 4320, voidzero: 8640, 'sindre-oss': 25, 'antfu-oss': 190,
  'shadcn-ui': 360, takeoff: 11520, agentic: 6000, 'leerob-next': 2880, 'jared-next': 5760,
};

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
  // Reweighted: institutional backing (accelerators, press, capital) is often
  // the strongest early gravity signal, so it is no longer the smallest weight;
  // attention momentum is demoted since raw reach already carries most social pull.
  const gravity = wmean([[fFollow,0.30],[fAuth,0.25],[fAccel,0.30],[fAmp,0.15]]);

  // ── TRAJECTORY features: four distinct facets of momentum, no double-count.
  //    cadence = output right now, acceleration = recent rate vs the lifetime
  //    baseline (a real slope, not a lifetime average), consistency = sustained
  //    output without long dead gaps, recency = how fresh the last ship is. ──
  const recentPush = (d.recentEventTypes?.PushEvent || 0) + (d.recentEventTypes?.PullRequestEvent || 0);
  const daysSince = d.lastActive ? Math.max(0, (new Date('2026-07-19') - new Date(d.lastActive))/(24*3600*1000)) : 365;
  const reposPerYear = shipped / ageYears;
  // Acceleration: creations in the current + previous year against the lifetime
  // per-year baseline. ratio 1 = steady, >1 speeding up, <1 cooling off. This is
  // a genuine slope, unlike the old "career-age slope" which duplicated it.
  const CUR_YEAR = 2026;
  const recentCreates = (d.byYear?.[CUR_YEAR] || 0) + (d.byYear?.[CUR_YEAR - 1] || 0);
  const accelRatio = (recentCreates / 1.7) / Math.max(reposPerYear, 0.15);
  // Consistency: share of years with output across the active span. Needs a
  // two-year span to mean anything; younger founders are left neutral.
  const activeYrs = Object.keys(d.byYear || {}).map(Number);
  const spanYears = activeYrs.length ? Math.max(...activeYrs) - Math.min(...activeYrs) + 1 : 1;
  const activeCount = activeYrs.length;
  const fCadence = clamp(curve(recentPush, 60), 2, 99);
  const fAccelT = clamp(Math.round(50 * Math.min(accelRatio, 2)), 2, 99);
  const fConsistency = spanYears < 2 ? 45 : clamp(Math.round((activeCount / spanYears) * 100), 2, 99);
  const fRecency = clamp(Math.round(100 - daysSince * 1.2), 2, 99);
  const trajectory = wmean([[fCadence,0.30],[fAccelT,0.30],[fConsistency,0.20],[fRecency,0.20]]);

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
  let fmfReceipt = null;
  if (prof.fmfReceiptFrom) { const t=d.topRepos.find(r=>r.name===prof.fmfReceiptFrom); if(t) { fmfReceipt={ connector:'github', metric:'Proof', feature:'Founder-market-fit', text:`${t.name}: ${t.desc||'no description'}`, quote:'Directly on the problem the venture solves', value:t.stars, url:t.url, at:t.created }; proofReceipts.push(fmfReceipt); } }
  if (downloads > 0) { const t=npmTop[0]; proofReceipts.push({ connector:'npm', metric:'Proof', feature:'Real-world adoption', text:`${downloads.toLocaleString('en-US')} npm downloads last month`, quote: t?`led by ${t[0]} at ${Number(t[1]).toLocaleString('en-US')}/mo`:undefined, value:downloads, url:`https://www.npmjs.com/~${handle}` }); }

  const gravReceipts = [];
  gravReceipts.push({ connector:'github', metric:'Gravity', feature:'True reach', text:`${f.followers.toLocaleString('en-US')} GitHub followers`, value:f.followers, url });
  if (confs.Gravity==='low') gravReceipts.push({ connector:'linkedin', metric:'Gravity', feature:'Social footprint', text:'No X or LinkedIn connected yet, reach is provisional', quote: prof.gravityNote });

  const trajReceipts = [];
  trajReceipts.push({ connector:'github', metric:'Trajectory', feature:'Recent cadence', text:`${recentPush} recent public pushes, last active ${d.lastActive?d.lastActive.slice(0,10):'unknown'}`, value:recentPush, url });
  trajReceipts.push({ connector:'github', metric:'Trajectory', feature:'Acceleration', text:`${recentCreates} new repos in the last two years vs a ${reposPerYear.toFixed(1)}/yr lifetime baseline`, value:Math.round(accelRatio*10)/10, url, at:f.created_at });
  trajReceipts.push({ connector:'github', metric:'Trajectory', feature:'Consistency', text:`Shipped public work in ${activeCount} of ${spanYears} year${spanYears===1?'':'s'} since the first repo`, value:activeCount, url });

  // Authored non-GitHub receipts, for founders whose evidence lives off-platform
  // (employment, registry, elected office, publications). Same Receipt shape.
  const extra = (metric) => (prof.extraReceipts?.[metric] || []).map((r) => ({ ...r, metric }));
  proofReceipts.push(...extra('Proof'));
  gravReceipts.push(...extra('Gravity'));
  trajReceipts.push(...extra('Trajectory'));

  // ── trajectory timeline from real repo creation dates ──
  const timeline = [...d.topRepos].filter(r=>r.created).sort((a,b)=> new Date(a.created)-new Date(b.created)).map((r,i,arr)=>({ date:r.created.slice(0,7), value: clamp(30 + i*(60/Math.max(1,arr.length-1)) + (r.stars>50?10:0),10,99), label:`${r.name}${r.stars?` (${r.stars}★)`:''}`, kind:'ship', url:r.url }));

  // ── FMF ──
  // Founder-market-fit evidence is not always a repo: it can be an authored
  // non-GitHub receipt (employment, registry), picked by its feature label.
  if (prof.fmfReceiptFeature) fmfReceipt = proofReceipts.find((r) => r.feature === prof.fmfReceiptFeature) || fmfReceipt;
  const fmf = { similarity: prof.fmf.sim, rationale: prof.fmf.rationale, receipts: [fmfReceipt || proofReceipts[0]] };

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
    { key:'backing', label:'Institutional backing', raw:fAccel, display:fAccel>50?'notable':'early', z:0, contribution:fAccel, receipts:[] },
    { key:'amplification', label:'Attention momentum', raw:fAmp, display:fAmp>50?'strong':'low', z:0, contribution:fAmp, receipts:[] },
  ];
  const trajFeatures = [
    { key:'cadence', label:'Recent cadence', raw:recentPush, display:`${recentPush} pushes`, z:0, contribution:fCadence, receipts:[trajReceipts[0]] },
    { key:'accel', label:'Acceleration', raw:Math.round(accelRatio*10)/10, display:`${accelRatio.toFixed(1)}x vs baseline`, z:0, contribution:fAccelT, receipts:[trajReceipts[1]] },
    { key:'consistency', label:'Consistency', raw:activeCount, display: spanYears<2 ? 'too new to tell' : `${activeCount}/${spanYears} yrs active`, z:0, contribution:fConsistency, receipts:[trajReceipts[2]] },
    { key:'recency', label:'Ship recency', raw:Math.round(daysSince), display:`${Math.round(daysSince)}d ago`, z:0, contribution:fRecency, receipts:[] },
  ];

  // Authored rationale wins where it exists; a founder whose evidence is mostly
  // off-platform needs the template's star-and-follower framing overridden.
  const proofRat = prof.ratOverride?.Proof ?? (confs.Proof==='low' ? prof.proofNote : `Proven builder: ${prof.fmf.sim>0.85?'exceptional':'clear'} founder-market-fit, ${d.stars.toLocaleString('en-US')} stars, finishes what it starts.`);
  const gravRat = prof.ratOverride?.Gravity ?? (confs.Gravity==='low' ? prof.gravityNote : `${f.followers.toLocaleString('en-US')} followers with ${fAuth>70?'high':'growing'} network authority; people and attention move toward them.`);
  const trajRat = prof.ratOverride?.Trajectory ?? `Momentum ${trajectory>75?'is steep':'is positive'}: ${recentPush} recent pushes, ${accelRatio>=1.1?'accelerating':accelRatio<0.9?'cooling':'steady'} against a ${reposPerYear.toFixed(1)}/yr baseline.`;

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
    pipeline: prof.pipeline,
    ...(prof.scoreDelta ? { scoreDelta: prof.scoreDelta } : {}),
    score, fmf, redFlags: prof.redFlags, trajectory: timeline, evidenceCount,
    note: prof.note ?? (confs.Gravity==='low'?prof.gravityNote:undefined),
  });

  const decision = {
    band, composite, confidence: overall,
    rationale: band==='Invest'?`Strong across the metrics we can verify; ${neighbour}-tier on our anchor set.`: band==='Watch'? `Promising on verified evidence${excluded.length?`, but ${excluded.join(' and ')} ${excluded.length>1?'are':'is'} unverified`:''}; revisit as more signal lands.` : 'Below the bar on verifiable founder evidence right now.',
    routeToHuman: overall==='low' || evidenceCount<3 || excluded.length>0,
  };
  // One venture per id. The first founder in P order is the lead and sets the
  // venture's decision; every later co-founder just joins the founder list.
  const existing = ventures.find((v) => v.id === prof.venture.id);
  if (existing) {
    existing.founderIds.push(prof.id);
    existing.members.push({ founderId: prof.id, name: f.name, initials: (f.name||handle).split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase(), skills: prof.skills, metrics: { Proof: proof, Gravity: gravity, Trajectory: trajectory }, confidences: confs, composite, band });
  } else {
    ventures.push({
      ...prof.venture, founderIds:[prof.id], decision,
      ...(DECIDED_OFFSETS[prof.venture.id] != null ? { decidedOffsetMins: DECIDED_OFFSETS[prof.venture.id] } : {}),
      members:[{ founderId: prof.id, name: f.name, initials: (f.name||handle).split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase(), skills: prof.skills, metrics: { Proof: proof, Gravity: gravity, Trajectory: trajectory }, confidences: confs, composite, band }],
    });
  }
}

// ── team harmonization (mirrors harmonizedTeamScore in core/scoring.ts) ──
// Every team number goes through the SAME composite a founder does, so the team
// row is comparable to the founder rows instead of a second arithmetic.
const METRIC_KEYS = ['Proof','Gravity','Trajectory'];
const TW = { Proof:0.35, Gravity:0.45, Trajectory:0.20 };
const teamComposite = (profile, conf) => {
  const trusted = METRIC_KEYS.filter((k) => conf[k] !== 'low');
  const use = trusted.length ? trusted : METRIC_KEYS;
  const wsum = use.reduce((a,k)=>a+TW[k],0) || 1;
  return Math.round(use.reduce((a,k)=>a+profile[k]*TW[k],0)/wsum);
};
const AXES = ['technical','commercial','domain','product'];
const axisLabel = (a) => a[0].toUpperCase() + a.slice(1);
for (const v of ventures) {
  const members = v.members;
  const shared = v.sharedHistory || [];
  delete v.members;
  delete v.sharedHistory;
  if (members.length < 2) continue;
  const coverage = Object.fromEntries(AXES.map((a) => [a, Math.max(...members.map((m) => m.skills[a]))]));
  const gaps = AXES.filter((a) => coverage[a] < 0.5);
  const redundancies = AXES.filter((a) => members.filter((m) => m.skills[a] >= 0.6).length >= 2);

  // Coverage takes the best TRUSTED founder per metric and inherits their
  // confidence: a co-founder with a real footprint makes the team's Gravity
  // measurable even where the other founder's was excluded.
  // Average is the plain mean, the row you can verify by eye. Coverage takes the
  // best TRUSTED founder per metric and inherits their confidence.
  const metricAvg = {}, metricCov = {}, metricConf = {}, liftedBy = {};
  for (const k of METRIC_KEYS) {
    metricAvg[k] = mean(members.map((m) => m.metrics[k]));
    const trusted = members.filter((m) => m.confidences[k] !== 'low');
    const pool = trusted.length ? trusted : members;
    const best = pool.reduce((a,b) => (b.metrics[k] > a.metrics[k] ? b : a));
    metricCov[k] = best.metrics[k];
    metricConf[k] = best.confidences[k];
    liftedBy[k] = best.initials;
  }
  const base = teamComposite(metricAvg, metricConf);
  const coverageComposite = teamComposite(metricCov, metricConf);
  const compatibility = base > 0 ? Math.round(clamp(coverageComposite / base, 1, 1.5) * 100) / 100 : 1;
  const order = { low:0, medium:1, high:2 };
  const trustedConfs = METRIC_KEYS.filter((k) => metricConf[k] !== 'low').map((k) => metricConf[k]);
  const baseConf = trustedConfs.reduce((a,c) => (order[c] < order[a] ? c : a), 'high');
  const teamConf = trustedConfs.length < METRIC_KEYS.length ? (baseConf === 'high' ? 'medium' : 'low') : baseConf;

  v.team = {
    score: clamp(Math.round(base * compatibility), 1, 99),
    base, coverageComposite, confidence: teamConf, coverage,
    gaps: gaps.map((a) => `${axisLabel(a)} coverage is thin across the team`),
    redundancies: redundancies.map((a) => `Overlap on ${axisLabel(a)}, more than one founder covers it`),
    sharedHistory: shared,
    metricAverage: Object.fromEntries(METRIC_KEYS.map((k) => [k, Math.round(metricAvg[k])])),
    metricCoverage: metricCov,
    metricConfidence: metricConf,
    metricLiftedBy: liftedBy,
    compatibility,
    perFounder: members,
  };
  // The team IS the venture's verdict once there is more than one founder.
  const teamBand = teamConf === 'low' ? (v.team.score >= 50 ? 'Watch' : 'Pass')
    : v.team.score >= 70 ? 'Invest' : v.team.score >= 48 ? 'Watch' : 'Pass';
  v.decision = {
    ...v.decision, composite: v.team.score, band: teamBand, confidence: teamConf,
    rationale: teamConf === 'low'
      ? `Team reads at ${v.team.score}, but too little of it is verified to act on.`
      : `Team reads at ${v.team.score} on ${teamConf} confidence, ${compatibility > 1.05 ? 'the founders cover ground each other does not' : 'the founders largely duplicate each other'}.`,
    routeToHuman: teamConf === 'low',
  };
}

// Deterministic order: the order founders are declared in P (Luis and his
// co-founder first). Not sorted by discoveredOffsetMins, since a founder can be
// re-dated without shuffling the whole list.

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

export const SEED_VENTURES: readonly (Venture & { decidedOffsetMins?: number })[] = ${JSON.stringify(ventures, null, 2)};

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
