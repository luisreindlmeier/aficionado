# Technical video, 60 seconds

Goal: convince an engineering-literate judge that the architecture is deliberate, not a demo
hack. The through-line: the LLM extracts and explains, the math decides, and every decision is
reproducible, streamed and sourced. Tone: precise, fast, no filler. Voiceover can be Luis or a
second technical founder.

## Before you record

- **Screen capture the real pipeline.** Show the two-loop diagram, the fan-out, the SSE agent
  traces streaming into the dossier, a receipt clicking through to a live source, and the
  Settings weight sliders re-ranking the pipeline in real time.
- **Diagram asset.** A clean, near-white architecture diagram with thin borders that matches the
  app. Two lanes: Loop A sourcing on top, Loop B evaluation below.
- **Every number is real.** Scores are live computed values calibrated against the 56-founder
  anchor set. Do not fabricate.

## Timing table

| Time | Visual / shot | On-screen text | Voiceover |
| --- | --- | --- | --- |
| 0.0 to 7.0s | The two-loop diagram draws itself on white. Two lanes label in. | aficionado / two loops, one connector registry | "The problem is known, so we do not need an agent swarm. We decompose it into two loops." |
| 7.0 to 16.0s | Loop A animates left to right: thesis, discovery workers, triage, queue. | Loop A, sourcing / always-on Vercel Cron | "Loop A sources founders on a cron. A thesis fans out to discovery workers, triage scores them, a candidate queue fills. This runs while nobody is watching." |
| 16.0 to 26.0s | Loop B: an orchestrator splits into three parallel metric workers, each pulling connectors as tools. | Loop B, evaluation / fan-out x3, connectors as tools | "Loop B is on-demand and durable. An orchestrator fans out to three metric workers in parallel, Proof, Gravity, Trajectory, each calling data connectors as LLM tools." |
| 26.0 to 36.0s | The three workers collapse into one reducer node, highlighted. A red-flag gate clamps the output. | deterministic reducer / the math decides | "Then they collapse into a deterministic reducer. Pure math, no model in the loop. Same evidence, same score, every time. A red-flag gate can cap it." |
| 36.0 to 45.0s | A pgvector similarity beam between a problem vector and a repo vector, then a percentile marker slides onto a 56-founder distribution. | pgvector founder-market-fit / calibrated vs 56 anchors | "Founder-market-fit is a pgvector similarity between the problem and the founder's footprint. Every score is z-normalized against 56 real anchors, so a percentile actually means something." |
| 45.0 to 54.0s | The dossier fills top to bottom as SSE traces stream in, line by line. A low-confidence metric greys out and tags itself. | streamed agent traces / no chatbot / confidence gating | "The reasoning streams as server-sent agent traces, the brain at work, not a chatbot. And when confidence is low, the metric excludes itself and routes to a human." |
| 54.0 to 60.0s | A single connector card expands into three faces: data adapter, LLM tool, UI tile. Cut to wordmark. | one connector = adapter + tool + tile | "One connector is a data adapter, an LLM tool and a UI tile, from a single registry. aficionado. It shows its work." |

## Shot list

1. **Two-loop diagram, 0 to 7s.** The architecture draws itself. This frames everything, keep it clean.
2. **Loop A sweep, 7 to 16s.** Left-to-right animation of thesis to queue, the cron badge visible.
3. **Fan-out, 16 to 26s.** The orchestrator splitting into three parallel workers is the signature shot, make the parallelism obvious.
4. **Reducer, 26 to 36s.** Three lanes collapse into one highlighted node, the red-flag gate clamps. Emphasize "no model in the loop".
5. **pgvector and calibration, 36 to 45s.** Similarity beam, then the percentile marker landing on the anchor distribution.
6. **Streaming dossier, 45 to 54s.** Real SSE traces filling the dossier, then a metric greying out on low confidence.
7. **Connector registry, 54 to 60s.** One card, three faces. End on the wordmark.

## Notes

- The two load-bearing ideas: **fan-out then a deterministic reducer** (reproducible, no
  hallucinated numbers) and **streamed evidence** (transparent, auditable). If those two land,
  the video worked.
- Keep motion snappy, 150 to 200ms transitions, but never cover a diagram before it is readable.
- Stack to name if you add a closing card: Angular 22 zoneless, Vercel Functions and Cron,
  Vercel AI Gateway (provider-agnostic, Claude), pgvector, 56-founder anchor calibration.
- Roughly 150 words of voiceover, brisk but comfortable for 60 seconds.
- Punctuation and copy rule for any on-screen text: no em dashes, no middle dots, use commas,
  periods or a plain slash.
