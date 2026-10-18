# Scorer rules — fourth whole-system re-rating (2026-10-17)

You are an independent scorer. You took no part in building the product or running the test. Everything you need is in this folder:

- `rubric/` — the two frozen criteria files of 2026-10-11 (`CRITERIA_keywords_content.md`, `CRITERIA_technical_tracking_reporting_ai_links.md`). Do not change a criterion. If one must be read differently, keep the old reading's score beside the new one and say why.
- `prior/2026-10-11`, `prior/2026-10-13`, `prior/2026-10-15` — the three earlier scorecards and their results (5 → 6 → 5.5). `prior/2026-10-15/SCORECARD.md` is the structure to follow, and its method section is the method.
- `this_run/RESULTS.md` — the master record of the 2026-10-17 live run (executions 736–799 on techand.ai), `this_run/parts/1`–`4` — the executors' evidence, `this_run/files/` — the raw artefacts (execution JSON, report payloads, delivered documents, screenshots).
- `this_run/MARKET_BENCHMARK.md` — the market as of October 2026, from vendor sources (not from this run).
- `code/` — a snapshot of the engine (`code/engine`: node code `v5/code`, prompts `v5/prompts`, build scripts) and the app (`code/app`) exactly as deployed during the run.

## Part A — the comparable score (same method as 2026-10-11 / 13 / 15)

Score strictly, from evidence only. Every criterion score cites a run, execution id, file or code location. A criterion that was not
exercised live is marked "(NL) not live-verified" and scored only on what code and specs show, never above what the last live evidence
supported. A defect seen live caps its criterion at the level the defect shows. Do not credit a fix that the live run did not exercise.
Capability and correctness are rated, not outcomes (pages ranking, links won, AI mentions); report outcomes separately. Honest refusals
("not checked", "could not be read") are credited where a criterion asks for honesty, not as the capability itself. Compare with the named
leader per area, as in the earlier scorecards.

Use the same scales, the same criterion set per area as the 2026-10-11 scorecard, the same weighting (K1–K3, K8, K10, C2, C3, C14, C15,
4B.4 weigh 1.5×) and round each area to the half point (x.25 / x.75 round up). Overall = mean of the 13 area scores, printed both to the
half point and as the raw mean. Before scoring, open at least one load-bearing artefact per area in `this_run/files/` and record what you
checked (as §0 of the 2026-10-15 scorecard did). Where the parts and the artefacts disagree, the artefact wins; say so.

## Part B — position against the October 2026 market (new; does not change Part A)

The owner asked for a rating "against the best in the market, including Search Atlas, Ahrefs and Semrush". The frozen rubric names
leaders as of 2026-10-11; the market moved since (see `MARKET_BENCHMARK.md` §0). For each of the 13 areas give: the October 2026 leader
(from MARKET_BENCHMARK, with its source), a **market-position score 0–10 on the same anchors** (0 absent · 2 manual · 4 automated but
basic · 6 mid-market parity · 8 parity with the leader · 10 beyond the leaders and proven live) judged from **this run's live evidence**
against what that leader does today, and one line on Search Atlas, Ahrefs and Semrush each where they are relevant to the area. Then an
**enterprise-readiness** section (security / identity / compliance, hosting and reliability, scale, integrations, support) scored 0–10
with reasons, from MARKET_BENCHMARK §4 and the code snapshot. State plainly where the market score differs from the Part A score and why.
Treat MARKET_BENCHMARK's Ascentra column as the vendor's own docs: credit only what this run's evidence or the code shows.

## Part C — what is missing to be the best enterprise-grade product

A ranked list: the gap, the evidence (run / file / market source), the effect on the score (which areas and roughly how much), and
whether it is engineering in reach, needs money / data / a vendor, or is an owner decision. Separate "defects to fix" (wrong outputs seen
live) from "capabilities to build" (absent or below the leader). End with the shortest path to 7 and to 8 overall.

## Output

Write `SCORECARD.md` in this folder: Part A in the 2026-10-15 structure (headline, §0 what you checked, per-area tables with every
criterion's score / was / evidence, outcomes, defects that capped scores), then Part B, then Part C. Neutral, factual, no marketing tone.
Write nothing else.
