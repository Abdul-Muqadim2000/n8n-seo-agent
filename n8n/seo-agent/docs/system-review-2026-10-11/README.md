# System review — 2026-10-11

A live whole-system test of the SEO Agent on techand.ai (21 runs, about $4.3), a strict scoring against the best tools per area (overall
**5 / 10**), and the plan to fix everything it found and re-rate afterwards.

## Files

| File | What it is |
|---|---|
| `FIX_PLAN.md` | **The working document.** It explains how to use the plan, gives the baseline ratings (with empty "After fixes" columns), and holds the issue register: 80 items (D = live defects, G = criteria gaps, L = Link Builder items, O = owner decisions), each with its location, fix and acceptance test. It also sets out the phases and sessions, the re-rating protocol and the scores history. |
| `RESULTS.md` | The live run of 2026-10-11: every run with its execution ids and cost, what each feature produced, spot-checks against the live site, defects D1–D26 with evidence, owner items, and the state left behind. |
| `SCORECARD.md` | Scores per area and per criterion with evidence, what beats the leaders, the prioritised fix list F1–F33, the overall 5 / 10 and the steps to 9. |
| `CRITERIA_keywords_content.md` | Benchmark criteria K1–K13 (keywords, ladders) and C1–C17 (content, cadence): 0 / 5 / 10 anchors, leading tools, proven results with evidence grades. |
| `CRITERIA_technical_tracking_reporting_ai_links.md` | Benchmark criteria 1.1–1.14 (technical audit), 2.1–2.14 (rank and site tracking), 3.1–3.12 (reporting and automation) and 4A–4C (AI visibility, backlinks, link building). |
| `files/` | The run outputs: the ladder page (`erp-software-uae.{md,html,meta.json}`), PDF / Word reports for each mode, the fix pack (`robots.txt`, `llms.txt`, `*.jsonld`, `internal-links.csv`, `README.txt`), the monitor reports, and the outreach drafts and reply tests (third-party contact addresses redacted). The prospects CSV was not saved, because the repository is public. |

## Reading order for a new session

1. `/CLAUDE.md` at the repo root, especially **Working rules** and the latest status. Every fix follows these rules.
2. `FIX_PLAN.md` §1 (How to use this), then §4 (Phases). Pick the first session that still has open items.
3. The item blocks for that session in `FIX_PLAN.md` §3, then the `RESULTS.md` sections their evidence points to. Use `files/` for real
   outputs to build harness fixtures from.
4. `SCORECARD.md` and the two `CRITERIA_*.md` files only when re-scoring (`FIX_PLAN.md` §5), or when you need a criterion's anchors.
