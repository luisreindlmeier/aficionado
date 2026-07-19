# Scoring

The full math behind the founder score. Every function named here lives in
`src/app/core/scoring.ts` and is called identically by the seed generator, the live Angular
re-rank, and the `/api` backend. The LLM extracts features from evidence; everything below is
deterministic and reproducible.

## The recipe, per metric

```
   1. extract features from evidence         (LLM worker, not in scoring.ts)
   2. log-scale counts        log10p(x)
   3. quality-weight          Proof: contribution value (CVALUE)
                              Gravity: network authority (Klout-style)
   4. z-normalise vs anchors  zScore(x, anchorColumn)
   5. squash to 0..100        squash(z)
   6. weighted composite      compositeOf / confidentComposite
   7. confidence              confidenceOf(completeness, agreement)
   8. red-flag gate + calibrate to a percentile vs anchors
```

Steps 2 to 8 are the deterministic reducer. Step 1, turning messy public evidence into clean
`Feature`s, is the only place a model is involved.

## Step 2, log-scale the counts

Raw counts (stars, downloads, followers) are heavy-tailed: one viral repo can be 1000x a solid
one. Log-scaling makes a 10x difference a constant step, so magnitude matters without letting a
single outlier dominate.

```ts
export function log10p(x: number): number {
  return Math.log10(Math.max(0, x) + 1);
}
```

The `+1` keeps zero well defined (`log10p(0) = 0`) and negative inputs are clamped to 0.

## Step 3, quality-weight

A raw count is democratic; reality is not. A star from a high-authority account is worth more
than a star from a throwaway, and a contribution that matters outweighs a trivial one. So each
feature is quality-weighted before it counts:

- **Proof uses contribution value (CVALUE).** Weight a repo, commit, or package by the value
  it actually adds, not its raw tally. The self-demo shows this: Luis's stars feature is
  labelled "Contribution-weighted stars" with `raw: 15` displayed as "15 adj. stars", the
  adjusted (weighted) count, not the unadjusted one.
- **Gravity uses network authority.** Weight reach by the authority of the people it reaches,
  recursively, so a small audience of strong people beats a large audience of nobody.

Weights ride along on each `Receipt.weight` so the UI can show why a piece of evidence counted
for what it did.

## Step 4, z-normalise against the anchors

Different metrics live on different natural scales, so before combining them each is expressed
in standard-deviation units against the anchor set (`core/data/anchors.ts`, 56 founders).

```ts
export function mean(xs)  // arithmetic mean
export function std(xs)   // sample standard deviation (n - 1), min 1
export function zScore(value, reference) {
  return (value - mean(reference)) / std(reference);
}
```

`ANCHOR_PROOF`, `ANCHOR_GRAVITY`, and `ANCHOR_TRAJECTORY` are the three reference columns.

## Step 5, squash to 0..100

A z-score is turned into a readable 0..100 with a linear squash centred on 50:

```ts
export function squash(z: number): number {
  return clamp(Math.round(50 + 16.7 * z), 2, 99);
}
```

Each standard deviation is worth about 16.7 points, so roughly plus or minus 3 sigma spans the
range. It clamps to `[2, 99]` so nothing ever reads as a fake absolute 0 or 100.

## Step 6, the weighted composite

The three metric scores combine by weight. Two variants exist, and the difference is the whole
point of the confidence system.

Plain weighted mean (weights need not be pre-normalised):

```ts
export function compositeOf(scores, weights) {
  const wsum = METRICS.reduce((a, m) => a + weights[m], 0) || 1;
  const raw  = METRICS.reduce((a, m) => a + scores[m] * weights[m], 0) / wsum;
  return Math.round(raw);
}
```

Confidence-aware composite, which excludes any low-confidence metric and redistributes its
weight across the trusted ones:

```ts
export function confidentComposite(scores, confidences, weights) {
  const trusted  = METRICS.filter((m) => confidences[m] !== 'low');
  const excluded = METRICS.filter((m) => confidences[m] === 'low');
  const use  = trusted.length ? trusted : METRICS;  // never divide by zero
  const wsum = use.reduce((a, m) => a + weights[m], 0) || 1;
  const raw  = use.reduce((a, m) => a + scores[m] * weights[m], 0) / wsum;
  return { value: Math.round(raw), excluded };
}
```

This is what stops a near-zero, unmeasured metric from dragging down a strong founder.

## Step 7, confidence

Confidence is the product of two independent things: how complete the evidence is, and whether
sources agree with each other.

```ts
export function confidenceOf(completeness, agreement) {
  const c = clamp(completeness, 0, 1) * clamp(agreement, 0, 1);
  if (c >= 0.6)  return 'high';
  if (c >= 0.33) return 'medium';
  return 'low';
}
```

Overall confidence never exceeds the confidence of the trusted metrics, and drops a level when
a metric had to be excluded:

```ts
export function overallConfidence(confidences) {
  const trusted = METRICS.filter((m) => confidences[m] !== 'low');
  const base = weakest(...trusted.map((m) => confidences[m]));
  const hasExcluded = trusted.length < METRICS.length;
  if (!hasExcluded) return base;
  return base === 'high' ? 'medium' : 'low';
}
```

Two downstream guards use confidence directly. `bandOf` never emits `Invest` on low
confidence, and `routeToHuman` fires on low confidence or thin evidence:

```ts
export function bandOf(composite, confidence) {
  if (confidence === 'low') return composite >= 50 ? 'Watch' : 'Pass';
  if (composite >= 70) return 'Invest';
  if (composite >= 48) return 'Watch';
  return 'Pass';
}
export function routeToHuman(confidence, evidenceCount) {
  return confidence === 'low' || evidenceCount < 3;
}
```

## Step 8a, the red-flag gate

Coherence and background flags cap the score rather than subtracting from it, so pitch cannot
outrun proof.

```ts
export function redFlagGate(rawComposite, flags) {
  const high   = flags.filter((f) => f.severity === 'high').length;
  const medium = flags.filter((f) => f.severity === 'medium').length;
  let cap = 100;
  if (high   >= 1) cap = Math.min(cap, 55 - (high   - 1) * 10);
  if (medium >= 1) cap = Math.min(cap, 78 - (medium - 1) * 6);
  cap = clamp(cap, 20, 100);
  if (rawComposite <= cap) return { value: rawComposite, capped: false };
  return { value: cap, capped: true, reason: /* ... */ };
}
```

One high-severity flag caps at 55, two at 45, three at 35 (floored at 20). Medium flags cap
more gently from 78. A cap only bites when the raw composite is above it, so low-severity flags
(expected at pre-seed) leave a good score untouched.

## Step 8b, calibrate to a percentile

A number needs a reference population to mean anything. The percentile is the literal share of
anchors below the value:

```ts
export function percentileOf(value, reference) {
  const below = reference.filter((r) => r < value).length;
  const equal = reference.filter((r) => r === value).length;
  return clamp(Math.round(((below + equal / 2) / reference.length) * 100), 1, 99);
}
```

And the "sits next to X" neighbour is the anchor whose composite (at the active weights) is
closest, skipping the founder themselves and, for a clean profile, skipping cautionary tales.
Once the gate has fired, failed anchors become eligible so a capped founder sits next to the
right company:

```ts
export function nearestAnchor(composite, anchors, weights, opts) {
  // min |anchorComposite - composite|, excluding opts.excludeName,
  // and excluding outcome === 'failed' unless opts.allowFailed
}
```

`anchorComposites` computes every anchor's composite at the current weights, so both the
percentile and the neighbour recompute live when the weight preset changes.

## Live re-ranking

`recomputeComposite` wires steps 6 to 8 together and is what the Angular `DataService` calls on
every weight change. Metric scores are weight-independent, so only the composite, band,
percentile, and neighbour move. Dragging the Gravity slider in Settings re-ranks the entire
pipeline through the same reducer the backend uses.

## Team complementarity bonus

For two or more founders, the team bonus rewards broad skill coverage over redundancy. It is
strictly additive and returns 0 for a solo founder (never a penalty).

```ts
export const SKILL_AXES = ['technical', 'commercial', 'domain', 'product'];

export function combineSkills(vectors) {
  // best of each axis across the team (max, not sum)
}
export function teamBonus(vectors) {
  if (vectors.length < 2) return { bonus: 0, gaps: [], redundancies: [] };
  const combined = combineSkills(vectors);
  const covered  = SKILL_AXES.filter((a) => combined[a] >= 0.5);
  const redundancies = SKILL_AXES.filter((a) => vectors.filter((v) => v[a] >= 0.6).length >= 2);
  const coverageBonus     = covered.length * 2.5;               // up to 10 for all four axes
  const redundancyPenalty = Math.max(0, redundancies.length - 1) * 1;
  const bonus = clamp(round((coverageBonus - redundancyPenalty)), 0, 12);
  // ...
}
```

Coverage of all four axes is worth up to 10 points; overlapping strengths past the first cost a
small penalty. The bonus is clamped to 0..12 and added at the venture level.

## Worked example: Luis Reindlmeier / GEDONUS

The self-demo, computed honestly from real GitHub evidence under the Maschmeyer preset
(Proof 0.35, Gravity 0.45, Trajectory 0.20). All values below are the stored snapshot.

### Metric scores

| Metric | Score | Percentile | Completeness | Agreement | Confidence | Calibration z |
| --- | --- | --- | --- | --- | --- | --- |
| Proof | 62 | 36th | 0.85 | 0.85 | high | -0.22 |
| Gravity | 11 | 1st | 0.30 | 0.35 | low | -3.08 |
| Trajectory | 63 | 30th | 0.85 | 0.85 | high | -0.35 |

Proof is carried by an exceptional founder-market-fit feature (0.93) and a 100% finish-rate on
a small but real body of work (the `transformer-lob` bachelor thesis, a transformer-based limit
order book for market making). Gravity is thin: 6 GitHub followers and no connected X or
LinkedIn.

### Confidence buckets

```
   Proof:      0.85 x 0.85 = 0.7225  >= 0.60  -> high
   Gravity:    0.30 x 0.35 = 0.105   <  0.33  -> low   (EXCLUDED)
   Trajectory: 0.85 x 0.85 = 0.7225  >= 0.60  -> high
```

### Composite (Gravity excluded)

```
   trusted = { Proof, Trajectory }        (Gravity is low-confidence, dropped)
   wsum    = 0.35 + 0.20 = 0.55
   raw     = (62 x 0.35 + 63 x 0.20) / 0.55
           = (21.7 + 12.6) / 0.55
           = 34.3 / 0.55
           = 62.36
   composite = round(62.36) = 62
```

Had Gravity not been excluded, its score of 11 at weight 0.45 would have crushed the composite
to about 36 and mislabelled a genuinely strong founder a Pass. Exclusion is what makes the
number honest.

### Overall confidence

```
   trusted metrics are both high -> base = high
   a metric (Gravity) was excluded -> knock down one level -> medium
```

### Red-flag gate

All three flags are low severity (first-time founder, product in private pilot, co-founder not
yet evaluated), so `high = 0`, `medium = 0`, `cap = 100`, and `62 <= 100`: not capped.

### Calibration

```
   percentile of 62 vs the anchor composites (Maschmeyer weights) = 37th
   nearest anchor at those weights = "an early finance-ML founder"
     its composite = round(68 x 0.35 + 50 x 0.45 + 76 x 0.20) = round(61.5) = 62
     distance to Luis = 0
```

### Verdict

Composite 62, band **Watch**, confidence medium, 37th percentile, sits next to "an early
finance-ML founder". The dossier flags the Gravity gap in `Founder.note`: "No public X or
LinkedIn footprint connected yet. Gravity is provisional and excluded from the composite until
a profile is pasted." `routeToHuman` is true. The honest headline is "Watch, provisional
pending LinkedIn", which is the correct call for a strong builder with an unverified network.

## The transferred concepts

The metrics are not invented from scratch; each borrows a well-understood idea from network
science and reputation systems and applies it to founders.

### Gravity borrows from Klout

Klout scored social influence from three ideas, which map directly onto Gravity's features
(`reach`, `amplification`, `authority`, `backing`):

- **True Reach** is audience minus bots and inactives, not raw follower count. Gravity's `reach`
  feature ("True reach") is the de-botted audience.
- **Amplification** is how much your activity provokes action in others. Gravity's
  `amplification` feature captures whether attention actually moves.
- **Network Influence** is recursive: you are more influential if the people who engage with
  you are themselves influential. Gravity's `authority` feature ("Network authority") is this
  recursive, PageRank-style weight, and it is the quality-weight applied in step 3.

### Proof borrows from OpenRank, EigenTrust, HITS, and CVALUE

Proof's "Contribution-weighted stars" and repo authority come from recursive-trust and
contribution-value theory:

- **EigenTrust** assigns each node a global trust value that is the weighted sum of the trust
  others place in it, solved as the principal eigenvector of the trust matrix. Applied here, a
  developer's authority is recursively the authority of who stars, depends on, and contributes
  to their work.
- **Hubs and Authorities (HITS)** splits reputation into authorities (endorsed by good hubs)
  and hubs (that point to good authorities). A repo is a strong authority when strong hubs
  depend on or star it.
- **OpenRank** is the EigenTrust-style reputation applied to open-source contribution graphs,
  so a star from a high-authority account counts for more than a star from a fresh account.
  This is exactly the contribution-weighting that turns 15 raw stars into "15 adj. stars".
- **CVALUE (contribution value)** weights a contribution by the value it adds rather than its
  raw count, which is why Proof rewards a maintained, depended-on package over a published-once
  one.

### Founder-market-fit borrows from vector embeddings

Founder-market-fit is a semantic similarity, not a keyword match. Embed the venture's problem
statement and the founder's footprint (repos, papers, bio) into vectors and take their cosine
similarity. For Luis, the `transformer-lob` thesis (applying ML to high-stakes market making)
sits almost on top of the GEDONUS problem (applying ML to high-stakes finance work), giving a
0.93 fit stored as `Fmf.similarity`. On the Supabase activation path this is a `pgvector`
nearest-neighbour query over embedding columns (`fmf_vectors`, `anchors.embedding`); in the
committed snapshot it is the precomputed similarity with its receipts. See
`docs/DATA-MODEL.md`.
