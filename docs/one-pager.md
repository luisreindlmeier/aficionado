# aficionado

**An AI operating system for venture capital that makes the founder judgment measurable, automated and explainable.** Built for The VC Brain, the HackNation challenge from the Maschmeyer Group.

> "For me, the people are always more important than the product." Carsten Maschmeyer, brutkasten, 22.10.2024. We made that judgment mechanical.

## The problem

At a 100k euro pre-seed check, the founder is the signal, and the founder is exactly what VCs still judge by gut. Decks and vanity metrics measure a company that barely exists. Gut calls do not scale across a fund, do not explain themselves in an IC meeting, and quietly encode bias. The one variable that predicts the outcome, the person, is the one left un-instrumented.

## The solution

An automated **founder score, 0 to 100**, on the founder and team only, from public sources only, with no questionnaire. Every number is clickable through to its live source. The system is calibrated, confidence-gated, and honest about what it cannot see.

## How it works

**Three metrics** (Maschmeyer preset, the tunable default):

- **Proof, 35 percent.** Demonstrated building and founder-market-fit. GitHub finish-rate, shipped products, package downloads, prior ventures, plus fit measured by embedding similarity.
- **Gravity, 45 percent.** Do strong people, capital and attention move toward them. True reach minus bots, amplification, network authority, co-founders, accelerators, press. The attract-and-sell lens, weighted highest because it matches the thesis.
- **Trajectory, 20 percent.** Slope, velocity, acceleration. Recency-weighted cadence and learning velocity, normalized for career age.

Each metric is z-normalized against a **56-founder anchor set** (Patrick Collison to founders who did not make it) and turned into a percentile. **Confidence gating** excludes any metric the system does not trust and routes it to a human. A **red-flag gate** can cap the score. Two or more founders earn a team-complementarity bonus.

**Two loops.** Loop A sources founders on an always-on Vercel Cron: thesis, discovery workers, triage, queue. Loop B evaluates on demand: an orchestrator fans out to three metric workers in parallel, a **deterministic reducer** decides (pure math, reproducible, the LLM never invents the number), then the gate and anchor calibration produce a dossier that **streams as agent traces**, the brain at work, no chatbot.

## The self-demo

The system discovered its own maker on the thesis "technical AI and fintech founders, DACH", then scored him on real evidence. **Proof 62** on the receipt of a transformer-based limit order book from his bachelor thesis, **93 percent founder-market-fit** for building AI in finance. **Trajectory 63**, ships continuously. **Gravity 11, low confidence, excluded**, because no public LinkedIn or X is connected yet, and the system says so. Verdict: **62 / 100, Watch, provisional, 37th percentile**, add LinkedIn to complete Gravity. It judged the founder and the fit, not vanity metrics, and admitted what it could not see.

## Why it wins

Measurable, the instinct as a calibrated 0 to 100. Explainable, every number clicks to its source and survives an IC meeting. Honest, it flags low confidence instead of bluffing. And tuned to the thesis, with Gravity, the attract-and-sell lens, weighted highest.

## Tech stack

Angular 22 (standalone, signals, zoneless), Vercel Functions and Cron, Vercel AI Gateway (provider-agnostic, Claude) with a heuristic fallback, pgvector for founder-market-fit, a single connector registry that drives both the agent toolset and the data-sources UI, and a 56-founder anchor set for calibration. Supabase and pgvector persistence are pre-staged for a sub-two-minute activation.

## Team

Luis Reindlmeier, co-founder of **gedonus** ("AI drafts your slides. You stay in control."), Frankfurt. Deep-technical background in quant machine learning for finance. Repo: github.com/luisreindlmeier.
