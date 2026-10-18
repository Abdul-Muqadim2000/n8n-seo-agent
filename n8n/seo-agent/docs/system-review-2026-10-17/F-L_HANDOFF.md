# F-L handoff — the open Lows and found bugs (re-rating 2026-10-17)

Branch `worktree-agent-a901b598853c34ab7` (merged `feature/seo-agent-v4.5` 7fe504f first). Source only is committed, plus three harness
fixtures/records that are env-independent (`harness/a9_cost_wiring.json`, `harness/fixtures_fl.js`, `harness/fixtures_fl_785.json.gz`,
`harness/accuracy/findings.json` AF-54). The generated `workflows/*.json` and `harness/code_v4/` were built with `--no-env` and are NOT
committed — rebuild in the main checkout. Harness runner: a throwaway `node:22-bookworm-slim` container per run, never `n8n-n8n-1`.

Final: build `--no-env` exit 0; harness **6939 passed, 0 failed** (6855 on the merged tip before this work); app typecheck clean in all
three workspaces, tests shared 413 / server 357 (29 DB-only skipped) / web 21. Generated files left uncommitted on purpose: `workflows/*.json`,
`harness/code_v4/`, `CHANGES_v3_to_v4.md`, `harness/lineage.json`, `harness/env_guard.json`.

## Done
| Item | Commit | Proof |
|---|---|---|
| 1 app: pipeline read `seo_pages` by `domain` (no such column) and swallowed the refusal | 54476b6 | `app/server/test/pipelinePages.test.ts` |
| 2 C-9: engine set counts only engines read on both sides; `metrics.rate_period` replaces "the 7 days to" | 701ae41 | SFL1 |
| 3 B-8 / A-27 / A-28 / B-9: thinking at what n8n saw (non-streaming), count bodies carry the agent's system + parser tool, Keyword Check $0.0033, crawl estimate x pages x JS (engine + app) | dd54a0a | SFL2, `app/shared/src/cost.crawl.test.ts`; S25/S57/S69/S86/S94 updated |
| 3 B-10 / B-16 / B-18: pricing sections shown to the reviewer + "no pricing" rewritten; redirect chain on the homepage variants; bylines over 8 articles, "a team, not a person" | d2897d5 | SFL3 (exec 767's real crawl / probes / articles / reviewer answer), accuracy AF-54 |
| 4 C-12 / C-13 node-level on exec 785's real inputs; found C-12 half done (table label + rung counts) and fixed | 1d6f459 | SFL4 |
| 5 ran-late on the Audit Scheduler (through Normalize Input -> Run Cost (Callback)) and the Page Watch digest + alerts | 2d6cac8 | SFL5 |
| 6 C-8 leftover: RV.storefront — the prospect page's own menu sells the category AND asks for a sale (demo / trial / quote / sales; pricing only as a menu link) | 56fcf36 | SFL6 (exec 781 pages reduced + real MoF / publisher / OpenPeppol / azdan pages); SC4 + D13 unchanged |

## Not started / open
- 6: on exec 781's pages the storefront rule also refuses infinite-it.com ("e-Invoicing Platform" + "Contact Sales") and naqood.ae
  ("e-invoicing" + "ASP" + a Pricing menu link) — both sell e-invoicing; worth a glance in the next live Link Builder run.
- App `app/shared/src/ai-visibility.ts` `aiSampleRate` still words its measured sample "answers over 7 days".
- A-28 remainder: the Reply Reader's answer counted 190 vs n8n 510 output tokens — the tool call's own framing / any text before it is
  not visible to count_tokens (sending the answer as a tool_use block was not tried: untested against the live endpoint).

## Live acceptance after deploy
- 1: Pipeline page of techand.ai: the cadence mirror sees the page inventory; server log has no "page inventory not read" line.
- 2: AI visibility run after one where an engine failed every request: `metrics.delta_not_compared` names the engine sets;
  `metrics.rate_period` = "this run on <date> + N daily pulse day(s) since <prev>"; the report lineage prints it.
- 3 (cost): a full report's Content Reviewer row in `ai_by_node`: think_tokens 64, usd within ~3% of n8n's tokenUsage; Reply Reader
  ledger row: in_tokens ≈ n8n promptTokens (~1,850); a JavaScript audit request: `run_cost_estimate_usd` ≈ $0.36 for 200 pages.
- 3 (B-10/16/18): full report on techand.ai: Low "Redirect chain on the homepage address" (http://techand.ai/ → 308 → 308 www); no
  "No pricing" finding — instead "Pricing sections explain what drives the cost …" (Low) or the reviewer's own correct wording; the author
  finding reads "credited to a team, not a person" with "N of 8 sampled … (8 of the 12 articles the crawl found were read)".
- 4: Rank Tracker "erp software uae": facts erp row labelled "set aside", "Rung 2: 0/1"; "peppol uae" next step names the PINT-AE guide.
- 6: Link Builder on techand.ai: halsimplify.com and tradeshift.com `not_fit` with "a competing provider: its own site menu sells …";
  azdan.com's "Top 20" list and the MoF list still pitchable.
- 5: a catch-up-started Audit Scheduler run: the audit callback has `ran_late`, subject "(ran late — due …)"; a late Page Watch digest
  starts "Ran late:".
