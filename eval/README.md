# Calibration eval

A drift harness for the deterministic scorer. It runs the **actual** functions in
`src/app/core/scoring.ts` against a set of **known** founder profiles and asserts that each
one still lands where we calibrated it: the right band, a composite inside a tolerance range,
the right confidence, the right metric exclusions, and the red-flag cap where a cap is due.

The pitch: _"calibrated against known cases, we measure drift."_ If someone re-tunes a weight,
a squash constant, the gate thresholds, or a band cutoff, a case moves out of range or flips
its band and this suite names it in a console drift report.

## What it proves

- **Calibration.** 14 curated cases span the decision surface: clear Invest (proven founders),
  clear Pass (idea-stage / thin evidence), the Watch mid-band, plus the two cases the product
  narrative leans on.
- **The low-confidence-Gravity case** (`luis-gedonus`, the gedonus model: Proof 62 high,
  Gravity 11 low, Trajectory 63 high) must **exclude Gravity** from the composite, knock
  confidence from high to medium, and land Watch 62. This reproduces the shipped dossier
  in `data/seed.ts` exactly.
- **The red-flag gate** (`holmes-style`, `adam-neumann`) must **cap** a would-be Invest and
  drop it below Invest. A critical coherence / governance flag caps the score, it does not
  merely subtract from it.
- **Confidence gating.** Medium confidence can still Invest (`evan-you`, 75 medium). Only
  **low** confidence blocks Invest and routes to a human (`low-conf-route-to-human`).
- **Properties / monotonicity** (no fixed case, checked across a grid):
  - raising trusted Gravity never lowers the composite;
  - a single high-severity flag caps to `<= 55` and blocks Invest for any raw score;
  - low overall confidence never emits Invest;
  - anchor percentile is bounded `[1, 99]` and non-decreasing in composite;
  - a solo founder gets `teamBonus` 0 (never a penalty); a complementary two-founder team
    scores above a redundant one.
- **Integration.** For every case, `recomputeComposite()` (the live re-rank path used by the
  Settings sliders) is asserted to agree with the hand-wired pipeline.
- **A preset guard.** The suite reads the real Maschmeyer preset from `WEIGHT_PRESETS`. A guard
  test asserts those weights still equal the values the set was calibrated against
  (`Proof .35 / Gravity .45 / Trajectory .20`); if the preset changes, the guard fails first so
  you know every expected composite below is stale rather than silently drifting.

## How to run

From the repo root:

```bash
npx vitest run --config eval/vitest.config.ts
```

Watch mode while iterating on the scorer:

```bash
npx vitest --config eval/vitest.config.ts
```

There is no `package.json` script for this (kept out of scope); the command above is the entry
point. The suite prints a `CALIBRATION DRIFT REPORT` table (expected vs actual per case, with a
`n/N cases on calibration` summary) after the run.

## Files

- `cases.ts` — the calibration set: `CASES`, plus the `MASCHMEYER` preset (read from the real
  `WEIGHT_PRESETS`) and `CALIBRATED_MASCHMEYER_WEIGHTS` (the guard).
- `calibration.eval.ts` — the vitest suite: per-case assertions, property tests, the
  `recomputeComposite` cross-check, and the console drift report.
- `vitest.config.ts` — node environment, scoped to `eval/**/*.eval.ts`, root pinned to the
  repo so `../src/app/core/*` imports resolve.

## How to add a case

1. Pick a profile. Draw it from the anchor set (`src/app/core/data/anchors.ts`) or a realistic
   holdout. You need the three metric scores (0..100), a confidence per metric, any red flags,
   and an evidence count.
2. Append an entry to `CASES` in `cases.ts`:

   ```ts
   {
     id: 'my-case',
     name: 'Display Name',            // must not collide with an anchor name you want as neighbour
     note: 'Why this case exists / what it pins down.',
     scores: { Proof: 70, Gravity: 55, Trajectory: 60 },
     confidence: { Proof: 'high', Gravity: 'high', Trajectory: 'high' },
     redFlags: [],                    // e.g. [{ text, note, severity: 'high' }]
     evidenceCount: 5,
     expected: {
       band: 'Watch',
       composite: [58, 66],           // inclusive tolerance range, after the gate
       confidence: 'high',
       excluded: [],                  // metrics the composite must drop (low confidence)
       capped: false,
       // routeToHuman: true,         // optional
       // percentile: [30, 45],       // optional bounds vs the anchor set
     },
   }
   ```

3. To find the true values before writing the range, run the suite once. The drift report
   prints the actual band / composite / confidence for every case, including a new one whose
   `expected` is a first guess. Set the `composite` range a few points either side of the
   printed value so ordinary re-tuning within tolerance stays green but a real regression trips
   it. Then re-run until green.

Confidence, `expected.excluded` and `expected.capped` are exact matches, not ranges: a low
metric must be excluded, and a case marked `capped: true` must actually hit the gate.

## Observations (for the lead)

These came out of building the suite. None are scoring bugs. No code outside `eval/` was
changed; where a mismatch surfaced we adjusted the expectation and noted it here.

1. **The real Elizabeth Holmes anchor is not capped under any shipped preset.** With
   `proof 20, gravity 90, trajectory 30`, the Maschmeyer raw composite is 54, and the cap for a
   single high-severity flag is 55, so `54 <= 55` and the gate does not bind. The gate is a
   **cap, not a subtraction**: it only lowers a score that would otherwise exceed the cap. The
   anchor's own note ("capped by gate") is therefore aspirational for that row under these
   weights, its low Proof already sinks it. That is why the calibration case `holmes-style`
   **models** a high-proof-claims profile (Proof 78) so the cap actually has work to do (raw 76,
   capped to 55). Worth a look if you intended the anchor itself to demonstrate the cap.

2. **One high-severity flag caps to 55, which is Watch, not Pass.** The cap for a single high
   flag is exactly 55 (`bandOf` puts `>= 48` in Watch), so a lone critical flag produces a
   capped **Watch**, never a Pass. A Pass via the gate needs the cap below 48, i.e. two or more
   high flags (cap drops to 45 at two). Both red-flag cases here therefore expect Watch. If the
   intent is that a single critical flag should force Pass, that is a threshold change in
   `redFlagGate` / `bandOf`, out of scope for this suite.

3. **Composite expectations are ranges, on purpose.** The three metric scores are treated as
   inputs (as they are in the seed generator and the live reducer); the eval exercises the
   composite / gate / band / confidence math on top. Ranges of a few points absorb intentional
   re-tuning while still catching a band flip or a regression that moves a case out of its
   window.
