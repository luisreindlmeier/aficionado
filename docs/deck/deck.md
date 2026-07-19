# aficionado, the VC brain

Speaker-friendly deck. Ten slides. The live HTML version is `docs/deck/index.html`
(navigate with arrow keys). Every number below is a real computed score from the app,
not a mockup. Design language: near-white, near-black, Space Grotesk titles, thin borders,
tiny accent dots only (Proof teal, Gravity violet, Trajectory blue, Invest green, Watch amber).

---

## Slide 1 / Title

**aficionado**

An AI operating system for venture capital that makes the founder judgment measurable, automated and explainable.

An automated founder score, 0 to 100, built from public evidence. Every number traces to its source.

- Built for the 100k euro pre-seed decision
- Angular 22 / Vercel / Claude
- Live self-demo inside

> Speaker note: "This is aficionado, built for The VC Brain. In one line: we turn the founder judgment you make by instinct into a calibrated score that shows its work. And later in this deck, the machine is going to evaluate me, live."

---

## Slide 2 / The problem

**At a 100k euro pre-seed check, the founder is the signal. Yet the founder is exactly what VCs still judge by gut.**

- **What gets measured today:** decks, TAM slides, revenue projections, logos. At pre-seed there is barely a company to measure, so these numbers are mostly fiction.
- **What actually predicts the outcome:** the person. Whether they can build, whether the market moves toward them, whether they are accelerating. The one part left un-instrumented.
- **So the decision stays a gut call:** gut calls do not scale across a fund, do not explain themselves in an IC meeting, and quietly encode bias.

You cannot run a fund on instinct alone. You need the instinct, instrumented.

> Speaker note: "At pre-seed the deck is fiction, the person is the whole bet. Everyone agrees on that, and then evaluates the person with a gut feeling that does not scale and cannot be audited. That is the gap."

---

## Slide 3 / The thesis

> "Fuer mich sind immer die Personen wichtiger als das Produkt."
>
> "For me, the people are always more important than the product."

Carsten Maschmeyer, brutkasten interview, 22.10.2024. His stated number one investment criterion is the founder team, not the business plan.

**So we built the machine that judges exactly that.**

> Speaker note: "This is not our opinion, it is yours. People over product, the team as the number one criterion. We took that thesis literally and built the machine that judges exactly that." Then hard cut into the product.

---

## Slide 4 / The score

**One number, 0 to 100. Founder and team only. Public sources only. No questionnaire.**

- **Proof, 35 percent** (teal). Has this person demonstrably built, and do they fit this exact market? GitHub finish-rate, shipped products, package downloads, prior ventures, plus founder-market-fit measured by embedding similarity.
- **Gravity, 45 percent** (violet). Do strong people, capital and attention move toward them? True reach minus bots, amplification, network authority, co-founders and hires, accelerators, press. The attract-and-sell lens.
- **Trajectory, 20 percent** (blue). Which way, how fast, accelerating? Recency-weighted shipping cadence and learning velocity, where a clean pivot counts as positive, normalized for career age.

Weights are tunable. The default is the **Maschmeyer preset**, which leans hardest on Gravity because your thesis puts the most weight on whether the market moves toward the founder. Two or more founders earn a team-complementarity bonus, never a solo penalty.

> Speaker note: "Three metrics. Proof, can they build and do they fit the market. Gravity, does the market move toward them, the attract-and-sell lens. Trajectory, which way and how fast. The default preset is tuned to your thesis and weights Gravity highest, 45 percent."

---

## Slide 5 / Why it is different

**Every number is clickable to its source. That is the whole point.**

- **Evidence receipts.** Every score decomposes into features, every feature into receipts, every receipt links to the live source. No black box, no vibes. Example receipt: `transformer-lob, 9 stars` links to the GitHub repo.
- **Calibrated percentiles.** Every score is z-normalized against a 56-founder anchor set, from Patrick Collison to founders who did not make it. So 62 means "37th percentile, sits next to an early finance-ML founder", not an arbitrary point.
- **Confidence gating.** The system will not emit a number it does not trust. Low confidence means the metric is excluded and routed to a human. A red-flag gate can cap the score outright.

It shows its work, and it tells you what it does not know.

> Speaker note: "This is the USP. Not the score, the receipts. Every number clicks through to the live source, so it is defensible in an IC meeting. It is calibrated against 56 real founders, so a number means something. And it refuses to bluff, low confidence gets flagged and handed to a human."

---

## Slide 6 / Loop A, always on

**It sources founders while you sleep.**

A background thesis, "technical AI and fintech founders, DACH", runs on a cron and fills the Radar with real, discovered founders. Each one is triaged, then queued for a full evaluation. These are live scores from public data.

| Founder | Score | Band | Note |
| --- | --- | --- | --- |
| Anthony Fu | 83 | Invest | Nuxt and Vite ecosystem, core tooling and DX |
| Peter Steinberger | 82 | Invest | PSPDFKit founder, now AI agent tooling, sits next to Sid Sijbrandij |
| Guillermo Rauch | 76 | Invest | Vercel, prolific open source, sits next to David Cramer |
| Evan You | 75 | Invest | Vue and Vite creator, now building VoidZero |
| Luis Reindlmeier | 62 | Watch | gedonus, an AI copilot for finance decks, discovered on the DACH thesis |

No hardcoding. Luis surfaced on the same thesis as everyone else.

> Speaker note: "Loop A runs on a cron and sources founders overnight. These are all real, from public data. Note the last row, that is me, and I was discovered by the same thesis as everyone else, not typed in. Watch what happens when it evaluates me."

---

## Slide 7 / Loop B, live

**Watch it evaluate its own maker.**

Luis Reindlmeier, co-founder of gedonus, "AI drafts your slides. You stay in control." Discovered on the DACH thesis, then scored on real public evidence only.

- **Proof 62** (teal). 36th percentile, high confidence. Receipt: `transformer-lob`, a transformer-based limit order book for market making, his bachelor thesis. **Founder-market-fit 93 percent**, it sits almost exactly on the problem gedonus solves.
- **Trajectory 63** (blue). 30th percentile, high confidence. Ships continuously, 9 recent public pushes, normalized for a young career.
- **Gravity 11** (violet). **Low confidence, excluded.** No public X or LinkedIn connected yet, so reach is provisional. The system leaves it out of the composite and flags it rather than guessing.

**Verdict: 62 / 100. Watch, provisional. 37th percentile.** Sits next to an early finance-ML founder. Add LinkedIn to complete Gravity and the score re-computes.

The honesty is the pitch. It judged the founder and the fit, not vanity metrics, and told you exactly what it could not see yet. People over product, made mechanical.

> Speaker note: "Here is the honest part, and this is why you should trust it. My Proof is strong because of a real receipt, a transformer-based limit order book from my thesis, 93 percent founder-market-fit for building AI in finance. But my Gravity is low confidence, I have no public LinkedIn or X connected, so the system excludes it and flags it instead of guessing. It judged the founder and the fit, and it admitted what it could not see. That is your thesis, mechanical."

---

## Slide 8 / Under the hood

**Two loops. Streamed where it matters, deterministic where it counts.**

- **Loop A, sourcing.** Always-on Vercel Cron. A thesis fans out to discovery workers, results are triaged and pushed to a candidate queue. This is what put Luis on the Radar. Flow: thesis / discover / triage / queue.
- **Loop B, evaluation.** On-demand and durable. An orchestrator fans out to three metric workers in parallel, then a deterministic reducer, red-flag gate and anchor calibration produce the dossier. Flow: fan-out x3 / reduce / gate / calibrate.

Three design points:

- **The LLM extracts and explains. The math decides.** The reducer is pure and reproducible. The model never invents the number, so the same evidence always yields the same score.
- **The reasoning streams as agent traces, the brain at work.** Real server-sent events render the evaluation as it happens. There is no chatbot.
- **One connector equals a data adapter, an LLM tool and a UI tile.** A single connector registry is the source of truth for both the agent's toolset and the data-sources page. Add a source once, it shows up everywhere.

Stack: Angular 22 (zoneless, signals), Vercel Functions and Cron, Vercel AI Gateway (provider-agnostic, Claude), pgvector for founder-market-fit, 56-founder anchor calibration.

> Speaker note: "Two loops. Sourcing runs always-on. Evaluation fans out to three metric workers in parallel, then a pure-math reducer decides. That last point matters, the LLM extracts and explains but the math decides, so the score is reproducible and the model can never hallucinate a number. And it all streams as agent traces, the brain at work, not a chatbot."

---

## Slide 9 / Why it wins

**It operationalizes your thesis.**

- **Measurable.** The founder judgment you make by instinct, now a calibrated 0 to 100 you can rank, filter and track across the whole pipeline.
- **Explainable.** Every number clicks through to its live source. Defensible in an IC meeting, auditable after the fact, impossible to hand-wave.
- **Honest.** It gates on confidence and flags what it cannot see. It routes the uncertain cases to a human instead of bluffing a number.
- **Your lens.** The default preset weights Gravity highest, the attract-and-sell signal you have said matters most in a founder.

People over product, made mechanical, at the speed and scale of a fund.

> Speaker note: "Four reasons this wins for you specifically. Measurable, explainable, honest, and tuned to your lens with Gravity weighted highest. It is your instinct, instrumented."

---

## Slide 10 / What is next

**From 56 anchors to a living benchmark.**

- **More connectors, deeper Gravity.** LinkedIn, X, Crunchbase, patents and press. Each source deepens Gravity and tightens confidence, so fewer founders land provisional.
- **Portfolio learning.** Feed real outcomes back into the anchor set so the calibration sharpens with every deal the fund does.
- **One click from score to memo.** Turn any dossier into an IC-ready, fully-sourced diligence memo.
- **Persistent, team-wide pipeline.** Supabase and pgvector are pre-staged, a sub-two-minute activation, for shared state across the whole investment team.

**aficionado. The VC brain that judges the founder, shows its work, and admits what it does not know.**

github.com/luisreindlmeier / Luis Reindlmeier, gedonus / The VC Brain, Maschmeyer Group

> Speaker note: "Where this goes: more connectors to deepen Gravity, and a feedback loop where your real outcomes sharpen the calibration over time, so the fund's own history becomes the benchmark. aficionado, the VC brain that judges the founder, shows its work, and admits what it does not know. Thank you."
