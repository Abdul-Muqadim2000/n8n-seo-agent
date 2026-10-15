# Defect dossiers — app, reporting, cost figures (executor D: findings D-1 … D-20 = R97 … R116)

Written 2026-10-16 for the chat that will fix these defects. I re-checked every symptom read-only against:
- the saved evidence in `n8n/seo-agent/docs/system-review-2026-10-15/files/` (main checkout, git-ignored);
- the live dev database and the n8n Data Tables.

I re-checked every root cause against the source at commit `fbad437` (branch `worktree-agent-acb293ec1c723d072`). Its `app/` tree is
identical to `feature/seo-agent-v4.5` HEAD `c7cea68`. Nothing was run or changed; the only file written is this one.

**Evidence files** (all under `files/`):

| File | What it holds |
|---|---|
| `D-report-details-since-1855.json` | the 24 report rows from 2026-10-15 18:55Z onward, with payloads and file metadata |
| `D-render-results-since-1855.json` | those rows rendered server-side through the app's own `ReportView`, with the visible text |
| `D-reports-since-1855.json` | the report list for the same window |
| `D-delivery-rate-2026-10-15T1914Z.json` | the admin delivery-rate figures, recomputed |
| `ui/phase1-20261015T190412/` | the browser pass: `shots/`, `extra/`, `extra-results.json`, `claimed.json` |

The narrative is in `parts/4_app_reporting.md` on the worktree branch above. The checks that ran the app's own code (`dd/decide.ts`,
`dd/render.tsx`) and the delivery recomputation (`ui/delivery_calc.py`, `ui/missed_split.py`) are in the session scratchpad. They
read `/app` read-only in `node:22-bookworm-slim` with the repo's `tsx`.

Executor C's findings are cited by their part-3 ids (C-1, C-2, C-3, C-4, C-5, C-19, C-20). The only C id I was given a register
number for is **C-18 = R94**.

## Corrections to the register

- **R102 (D-6): High → Medium (proposed).**
  - The wrong "actual" figures sit on four legacy run rows (2026-10-03 and 10-08).
  - Every main-workflow callback since 2026-10-14 carries Claude.
  - The live producer of the same mislabel is R115 (monitor callbacks), which has the same root cause. Fix them together.
- **R105 (D-9): Medium → Low, re-described.**
  - The 54–63-hour delay was historical. The alerts were raised on 2026-10-12/13, before the Slack webhook existed (2026-10-14) and
    before the retry sweep shipped (2026-10-15).
  - The live error path delivered in under 5 s (exec 643).
  - What remains wrong is the record: `channels` on re-sent rows, and row 4's state (C-3).
- **R100 (D-4): numbers updated.** The engine's page reservation is now **$1.40**, not $1.51, because tonight's page run added a second
  calibration value.
- **R104 (D-8): app side only.** Rewritten around what the Pipeline page and the admin page show. The schedule mechanism is R94.
- **No finding is withdrawn.**
- **Root cause left as a hypothesis: R107 (D-11).** Every other root cause is confirmed in code. Three are also confirmed against
  runtime evidence: R110 (the app's own decision code on the real rows), R115 (exec 623's node order), R112 (the stored snapshot row).

---

## High

### R110 (D-14) — Every monitor report is held from delivery and shared under "This run did not produce a report"
- **Severity:** High (unchanged).
- **Feature / run:** report delivery (e-mail, webhook, "Send it now") and share links, for every weekly or monitor report.
  - Tonight: 13 of the 24 reports for Techand Test Co — ai_visibility f18ed579 (exec 623), backlinks b2e07a51 (626), ai_pulse 6f08e9cf
    (630), link_builder b265b4c9 (628), rank_tracker ×8 (632), site_tracker dcad72e6 (634).
  - Whole `reports` table: **79 of 178** rows (ai_growth 7, ai_pulse 7, ai_visibility 8, backlinks 15, link_builder 6, rank_tracker 27,
    site_tracker 9).
- **What the customer sees:**
  - Nothing yet, because every company's delivery is off.
  - With delivery on, each of these reports gets a `held` row with the reason *"This run finished as "progress", not as a completed
    report."* and is named as held in the summary message.
  - "Send it now" is refused with the same reason.
  - A share link opens with the caveat *"This run did not produce a report"* above the first figure.
  - These are exactly the reports a customer forwards: the weekly site report, the AI visibility report, the backlink report.
- **Evidence:**
  - The app's own `deliveryDecision` and `shareCaveat` were run on tonight's rows (`dd/decide.ts`). Example output:
    `{"req":"rr1015-site","stage":"site_tracker","status":"progress","deliver":false,"code":"rejected","reason":"This run finished as
    \"progress\", not as a completed report.","caveat":"This run did not produce a report"}`.
  - Counts from `select stage, status, count(*) from reports group by 1,2`.
  - Part 4 of the part file, table "The 24 reports".
- **Root cause — [confirmed in code]:**
  - **Engine.** Each monitor's final report item sets `status: 'progress'`, and the callback builders pass it through (e.g.
    `v5/code/Build_AI_Callback.js:7-8` keeps `...rest`). Where it is set:
    - `n8n/seo-agent/v5/code/AI_Report.js:133`;
    - `BL_Report.js:140`, `LB_Report.js:94`, `Growth_Report.js:65`, `Pulse_Metrics.js:87`;
    - `Site_Report.js:157`, `Tracker_Report.js:304` and `:442`;
    - `Cadence_Status.js:23`, `Cadence_Note.js:27`.
  - This has been the weekly-report contract since the v4.2 Rank Tracker (REVIEW.md 5c, 2026-10-01: "progress e-mail … and callback").
  - **App.** `ingestCallback` stores `body.status` as the report status (`app/server/src/services/runs.ts:398`).
  - `deliveryDecision` (`app/shared/src/report-delivery.ts:217-218`) holds every status other than `completed`, `ok` or `success`.
  - That check runs **before** the interim-stage check at `:219`. So the started notes, which arrive as `accepted`, are also coded
    `rejected` instead of `interim`, and their share caveat reads "did not produce a report" instead of "The work had only started".
  - **The unit tests assume the wrong contract.** `app/shared/src/report-delivery.test.ts:93-99` builds monitor and started reports
    with `status: 'completed'`, which the engine never sends for these stages.
- **Same cause elsewhere** — every reader of the report status:
  - `app/server/src/services/reportDelivery.ts:158` (`candidateOf`: per-report delivery, summaries, retries).
  - `app/server/src/services/shareLinks.ts:199` (status) and `:209` (caveat).
  - `app/web/src/pages/runs/ReportPage.tsx:63` and `app/web/src/components/reports/simple.tsx:590`. Both react only to `rejected`, so
    they are unaffected.
  - Run completion does **not** read the report status. `runs.ts` uses `MODES[].finalStages`, so neither fix touches it.
- **Correct behaviour:**
  - A finished weekly or monitor report is delivered and shared like any finished report.
  - A started note is held as `interim`.
  - **Recommended side: the app rule, not the engine.**
    - The 79 stored rows already carry `progress`; an engine change leaves all of that history held.
    - `progress` is the engine's long-standing contract, which other API callers may read.
  - The change, in `deliveryDecision`:
    1. Check `INTERIM_STAGES` first.
    2. Treat `progress` as finished when the stage is a report stage. That means a `stage` of `AUTOMATIONS` (`app/shared/src/constants.ts:427-520`:
       ai_visibility, ai_pulse, ai_growth, backlinks, link_builder, rank_tracker, site_tracker, content_cadence, site_audit) or any
       `MODES[].finalStages` entry.
    3. Keep refusing `failed`, `rejected` and unknown statuses.
- **Acceptance test:**
  - (a) Offline, in `app/shared/src/report-delivery.test.ts`, add cases with the engine's real statuses:
    - each monitor stage with `status: 'progress'` → `deliver: true`;
    - `ai_visibility_started`, `backlinks_started`, `site_tracker_setup`, `case_study_started` with `status: 'accepted'` → code `interim`;
    - `content` with `status: 'failed'` → still `rejected`;
    - correct the existing cases at `:93-99`;
    - `shareCaveat` of a `site_tracker`/`progress` decision → `null`.
  - (b) Live:
    - Re-run the `decide.ts` check over the 24 rows. All 13 monitor reports must give `deliver: true`, and the QA-failed page 616 must
      stay held `not_ready`.
    - On a test company with a localhost webhook, "Send it now" on a `site_tracker` report must produce a `sent` row.
- **Related:**
  - R111: once delivered, the site report must not carry "publish" advice for drafts.
  - R116: requests refused after they started.
- **Watch out:**
  - Do not fix this by sending `completed` from some monitors only. The app would then face two contracts.
  - If the engine side is changed instead, the 79 historical rows still need the app rule or a migration.
  - Keep a distinct code for the interim case so the share-caveat titles stay right.

### R111 (D-15) — The customer is told to publish pages that failed the quality check
- **Severity:** High (unchanged).
- **Feature / run:**
  - Content run 616 ("ai consulting"; request 609; report 338c4333).
  - 2026-10-14 exec 554 ("azure api management monetization"; request 548).
  - Both were advised for publication by the Site Tracker (634), the Rank Tracker (632) and the cadence dry run (638).
- **What the customer sees:**
  - The page reports themselves say *"Did not pass the quality check — not ready to publish (round 2 of 2) …"*
    (`notReadyToPublish: true`).
  - In the same app, the weekly site report (634) gives as its top action: *"Next step · P1 Publish the written page for "ai
    consulting" (planned URL https://www.techand.ai/ai-consulting/) and report the link with "I published a page"."* It comes with an
    **"I published it"** button.
  - The same report's brief says: *"Publish the three written pages: /ai-consulting/, /service-industry-erp-software/ and
    /azure-api-management-monetization/."*
  - The Rank Tracker reports for ladders 609 and 548 say: *"Write or improve: "ai consulting" (already written — publish it)."* and
    *"… "azure api management monetization" (already written — publish it)."*
  - The cadence (638) says: *"4 written pages waiting for publication (pile-up guard, limit 3) … publish them to continue"*.
- **Evidence:**
  - Rendered text of 634 and of the rank reports for 609 and 548 (`D-render-results-since-1855.json`).
  - The summaries of 338c4333 and of the 2026-10-14 page report for request 548.
  - `seo_content_log` rows 5 and 6: `status: "written"`, and the table has no quality column.
- **Root cause — [confirmed in code]:**
  - **Where the status is written.** `n8n/seo-agent/v5/code/Content_Log_Row.js:16-17,41` writes `status: 'written'` whenever the
    Blog Package holds article HTML or Markdown. It never reads the quality verdict, although the verdict exists at that point:
    - `Content_QA.js:587` (`not_ready = !passed && !rounds_left`);
    - `:600`, `:606` (`quality.publishable`, `content_qa.not_ready`);
    - `Blog_Package.js:179` reads `d.qa_publishable`.
  - **Where the engine turns `written` into "publish it":**
    - `Site_Plan.js:88` (`pending_publish`);
    - `Site_Metrics.js:162-165` (the P1 `publish` action);
    - `Tracker_Report.js:27` (`writtenLog`) and `:160` ("already written — publish it");
    - `Cadence_Plan.js:215-217` (`writtenOf`, the pile-up `waiting` list);
    - `Brief_Input.js:25` (`pages_waiting_for_publish_link`, fed to the Claude site brief).
  - **Where the app does the same:**
    - `app/server/src/services/pipeline.ts:61-66` (`waitingPages`);
    - `app/server/src/services/ladders.ts:240` and `:676-697` (Needs you: "Publish N pages of …" with an "I published it" action);
    - `pipeline.ts:583-590` (growth loop: "N page(s) to publish");
    - `app/server/src/services/recommendations.ts:232-234` (engine `publish` actions become "Report the published URL");
    - the cadence mirror, `app/server/src/services/cadence.ts:27-30`.
- **Same cause elsewhere:**
  - `Publish_Candidates.js:29`, publish detection. Keep it working, so a draft the owner publishes anyway is still found.
  - `AI_Target_Settle.js:33`, `Growth_Plan.js:135` and `LB_Plan.js:93` treat `written` as "a page exists" when choosing AI targets
    and link targets.
  - The rung's `seo_ladders` row goes to `writing`, which `Tracker_Report` also reads.
- **Correct behaviour:**
  - A page that failed its last QA round is recorded as a draft that needs work: `status: 'not_ready'`, or `written` plus a new
    `qa_ready: false` column.
  - Every reader then says "fix and re-run" (with the QA reasons), never "publish".
  - Such a draft is never offered as a link target or an AI target.
  - Decide whether it counts toward the pile-up guard. Recommended: yes, shown as "needs a fix".
  - Publish detection still closes it if it appears live.
- **Acceptance test:**
  - (a) Offline:
    - Harness (`harness/scenarios_v5.js`):
      - *Content_Log_Row* with QA `not_ready` → the draft status;
      - *Site_Metrics* → no `type: 'publish'` action for it;
      - *Tracker_Report* → no "already written — publish it";
      - *Cadence_Plan* → counts it with its label.
    - App (`server/test/cadence.test.ts` and a pipeline test): Needs you gives a "fix" item for a `not_ready` row, not "I published it".
  - (b) Live: the next Site Tracker run on techand.ai has no P1 "Publish … ai consulting", and its brief lists neither draft as a page
    to publish.
- **Related:** R110 (this advice would go out by e-mail and webhook once R110 is fixed).
- **Watch out:**
  - A new column reaches the live table only through `ladder_common.py` plus `sync_tables.py` (CLAUDE.md).
  - `Cadence_Plan.js` and `cadence.ts` must change together.
  - Rows 3 and 4 (`erp software uae`; `service industry erp software`) were "passed" or "items to review", not failed. They stay
    `written`.

---

## Medium

### R102 (D-6) — Old runs show a search-data-only figure as their complete "actual" cost
- **Severity:** **High → Medium (proposed).**
  - The figure is still on screen (the run page, and the usage page's "measured so far"), but only on four legacy rows: 199, 213, 219
    and 221, from 2026-10-03 and 10-08.
  - Every main-workflow callback since 2026-10-14 carries `run_ledger.ai_usd`: 539, 548, 552, 565, 594, 607, 609, 611 and 613 all do.
  - The live producer of the same mislabel is R115.
- **Feature / run:** run page and usage page for Techand Test Co.
  - Run 221 (Write a page): `actual_cost_usd 0.0221`.
  - Run 199 (verdict): `0.0221`.
  - Run 219 (ladder plus written page): `0.1185`.
  - Run 213 (ai_visibility): `0.5887`.
- **What the customer sees:**
  - On the run page: **"$0.02 · actual"** for a written page, with the info text *"What this run reported spending, from the
    search-data tasks it paid for and the model calls it made."*
  - On the usage page: `actualUsd` **$0.95** "measured so far" for October.
- **Evidence:**
  - `runs` rows 199, 213, 219, 221.
  - Their callbacks' `run_ledger`: `{dataforseo_usd: 0.0221, ai_usd: null}` (199 and 221); `{0.1185, null}` (219).
  - Run 213's callback has `cost_usd 0.5887` and no ledger at all.
- **Root cause — [confirmed in code]:**
  - `app/server/src/services/summaries.ts:215-223` (`ledgerCost`) treats a missing `ai_usd` as 0 and returns `estimated: false`.
  - `app/server/src/services/runs.ts:430` adds that figure to `actual_cost_usd`.
  - `app/shared/src/cost.ts:186-200` (`runCostEstimate`) labels any positive actual as `measured`, with a basis that says the model
    calls are included.
- **Same cause elsewhere:**
  - R115.
  - The usage route `app/server/src/routes/orgs.ts:134-190`.
  - The budget sum `app/server/src/services/spend.ts:24`.
- **Correct behaviour:**
  - A ledger without a Claude part is labelled partial, e.g. "search data only — this run did not report its model calls".
  - Optionally, a one-off flag on the legacy rows.
- **Acceptance test:**
  - (a) Offline:
    - `cost.test.ts`: an actual figure marked partial gets a basis that does not mention model calls.
    - Server test: `ledgerCost({run_ledger:{dataforseo_usd:0.02}})` → partial or estimated.
  - (b) Live: run 221's page shows "search data only".
- **Related:** R115, R114, R100.
- **Watch out:** a technical audit really costs $0 of Claude (`ai_usd: 0`). Distinguish "0 reported" from "not reported", and do not
  flag `ai_usd: 0`.

### R97 (D-1) — The locked dashboard card names a way of proving ownership that does not exist
- **Severity:** Medium (unchanged).
- **Feature / run:** every site page of an unverified website. Seen in the browser pass: company 15b2c553-…, site
  `rr1015-newcustomer.example.com`.
- **What the customer sees:** *"Verify that you own rr1015-newcustomer.example.com — Dashboards, tracking and site checks open once
  ownership is confirmed: give our Google service account access in Search Console (this also connects your data), or add a DNS
  record or a meta tag."*
- **Evidence:**
  - `ui/phase1-20261015T190412/extra/e09-site-overview-desktop-light.png` and `e08-org-home-desktop-dark.png`.
  - `GET /api/auth/providers` returns `"google":false`.
- **Root cause — [confirmed in code]:**
  - The text is hard-coded at `app/web/src/components/layout/SiteLayout.tsx:77`.
  - The server refuses that method: `app/server/src/routes/sites.ts:206-207` answers *"Search Console ownership is checked with your
    own Google account: use "Verify with Google" …"* with code `use_google`.
  - `app/README.md:66-69` and `:283-284` say the service account seeing a property never counts.
  - "Verify with Google" appears only with Google OAuth configured (`app/web/src/components/site/VerificationPanel.tsx:46`). It is not
    configured here.
- **Same cause elsewhere:** R98.
- **Correct behaviour:**
  - The card lists the methods the panel actually offers: "Verify with Google (your own account must own the property)" only when
    `providers.google` is true; otherwise "a DNS record or a meta tag".
  - Adding the service account is described as connecting the data, after verification.
- **Acceptance test:**
  - (a) Offline: a render test of the locked state with `google=false` has no "service account" and does have "DNS record". With
    `google=true` it shows "Verify with Google".
  - (b) Live: the browser-pass screenshot of an unverified site's overview.
- **Related:** R98, R108.
- **Watch out:** the marketing copy is true when OAuth is configured. Change only the in-app copy, and make it conditional.

### R99 (D-3) — The same run shows two different prices on one screen
- **Severity:** Medium (unchanged).
- **Feature / run:** the tool list and the tool forms (browser pass: `extra/e12-tools-*`, `e14-tool-keyword-*`, `e15-tool-discover-*`,
  `e16-tool-audit-*`, `e17-tool-ladder-*`).
- **What the customer sees:**
  - **Ladder form:** the hero and summary say *"about $1.23"*. The page choices say *"1 page +$1.20 / 2 pages +$2.40 / 3 pages
    +$3.60"* and *"The plan itself costs about $0.60"*, which add up to $1.80.
  - **Tools list vs Write-a-page form:** the card says *"$0.40 report · $1.20 with the page"*; the form says *"about $0.84"*.
  - **Audit form:** the hero says *"about $0.09"*; the card under it says *"about $0.10 · 20 min"*. The full-report card says *"about
    $0.90 · 30 min"*; the cost table says $0.63.
  - **Discovery follow-ups:** *"+$1.20"*, *"Technical (+$0.10)"*, *"Full report (+$0.90)"*.
- **Evidence:** the screenshots above, and part 3 of the part file.
- **Root cause — [confirmed in code]:** per-mode prices from the 2026-10-02 table are typed into components, contrary to
  `app/web/CONVENTIONS.md` ("never write a per-mode price into a component"):
  - `app/web/src/pages/tools/ToolsPage.tsx:19-23` (`COST_TEXT`, which overrides `MODES[].costUsd` at `:256`);
  - `app/web/src/pages/tools/_components/forms/site.tsx:119,126`;
  - `…/forms/research.tsx:214,375,381,382`;
  - `…/forms/growth.tsx:82,91` (the `n * 1.2` per page), `:96`;
  - `app/web/src/pages/site/NewLadderPage.tsx:171,204,228,354,467,647`;
  - `app/web/src/pages/site/ContentPage.tsx:496`;
  - `app/web/src/components/site/MonitorSettingsFields.tsx:134`;
  - `app/web/src/pages/site/_components/pipeline/controls.tsx:243`;
  - `app/web/src/pages/site/BacklinksPage.tsx:95`;
  - `app/web/src/pages/site/_components/links/settings.tsx:204`.
- **Same cause elsewhere:** any new copy that types a price. (`NewLadderPage.tsx:45,476` are comments only.)
- **Correct behaviour:**
  - Every price comes from `@seo/shared`: `estimateRunCost`, `keyCost`, `estimateRunCostParts`, `MONITOR_COSTS` — and, after R100,
    from the engine's current figure.
  - One run, one figure.
- **Acceptance test:**
  - (a) Offline:
    - A vitest guard that fails on any `$<digits>.<digits>` literal in `web/src/pages` or `web/src/components` outside comments.
    - `estimateRunCostParts('ladder', {pagesNow: 1})` equals what the ladder form displays.
  - (b) Live: in the browser pass, the card, the hero and each option badge agree for verdict, keyword, discover, audit and ladder.
- **Related:** R100.
- **Watch out:** `links/settings.tsx:204` and `BacklinksPage.tsx:95` show monitor prices. Those belong to `MONITOR_COSTS`
  (`constants.ts:330-345`), not the per-mode table.

### R100 (D-4) — The app's pre-run price is the engine's shipped default, not what the engine actually reserves
- **Severity:** Medium (unchanged; numbers updated).
- **Feature / run:** the pre-run figure on every form and the app's budget check, compared with the engine's reservations on
  2026-10-15.
- **What the customer sees, against what the engine reserved:**

  | Request | App shows | Engine reserved tonight | Engine would reserve now |
  |---|---|---|---|
  | Write a page | about $0.84 | $1.51 (page 616) | **$1.40** |
  | Ladder plan | $0.39 | $0.26 (609) | — |
  | Technical audit | $0.09 | $0.11 (594) | — |
  | Verdict | $0.20 | $0.20 (607) | — |

  The $1.40 comes from `seo_cache` `cost:ai:content` `{n 2, mean 1.0983, recent [1.1862, 0.8933]}`: 1.0983 × 1.25 = 1.3729, plus
  `cost:dfs:content` 0.0301.
- **Evidence:**
  - `run_cost_estimate_usd` and its basis on 7 reports (`D-report-details-since-1855.json`).
  - The `seo_cache` rows of kind `cost`, read on 2026-10-16.
- **Root cause — [confirmed in code]:**
  - `app/shared/src/cost.ts:63-84` (`COST_TABLE`) mirrors the engine's shipped defaults `EST` and `DFS_EST`
    (`n8n/seo-agent/v5/code/_cost_cal.js:178-202`). `estimateRunCost` (`cost.ts:134`) uses only that table.
  - The engine reserves `estOf()` instead (`_cost_cal.js:259-270`): rolling mean × 1.25, floored at the recent maximum, read from the
    `seo_cache` `cost:*` rows.
  - The app never reads those rows; there is no `seo_cache` read in `app/server/src` or `app/shared/src`.
  - So the budget check (`spend.ts` `assertBudget`) holds the table figure, not the engine's.
- **Same cause elsewhere:**
  - `MODES[].costUsd` (through `modeCostUsd`);
  - the tool cards;
  - the budget bar's "$x left after it";
  - the launch step's "Starting now costs about $1.18".
- **Correct behaviour:**
  - The pre-run figure is the engine's current reservation for that request, labelled "estimated by the engine".
  - The table is used only when the engine's rows cannot be read.
  - Port `estOf` and `pick`, or ask the engine. Either way, one formula.
- **Acceptance test:**
  - (a) Offline: with fixture `seo_cache` rows equal to tonight's, the estimate for a page is `1.4030 ± 0.0001` and for a technical
    audit `0.1125`.
  - (b) Live: the Write-a-page form's figure equals the next callback's `run_cost_estimate_usd`.
- **Related:** R99, R101, R102.
- **Watch out:**
  - The engine's calibration is fed by its own Claude figure. Parts 1 and 3 found that figure 15–67% low on structured-output nodes
    (`count_tokens` sees "[object Object]") and estimated from characters on streaming Opus. Fix that measurement in the same pass.
  - `cost:dfs:full` (n 1) and `cost:dfs:crawl` (n 3) were not updated by runs 614, 595 and 641. I did not investigate why.

### R103 (D-7) — The admin delivery rate counts schedules that did not exist yet as missed, and leaves out the tenth schedule
- **Severity:** Medium (unchanged).
- **Feature / run:** platform admin, `GET /api/admin/delivery`, recomputed at 2026-10-15 19:14Z
  (`D-delivery-rate-2026-10-15T1914Z.json`).
- **What the operator sees:**
  - Weeks 2026-09-07, 09-14 and 09-21 read **0.0%**, with 13 missed fires each.
  - Week 09-28 reads **26.3%**, although the only runs that existed were 5 of 5 delivered.
  - **57 of the 72** "missed" fires fall before the workflow was even created.
  - Page Watch (daily 05:45 New York) is absent from the figures.
- **Evidence:** workflow `createdAt` dates from `GET /api/v1/workflows/<id>`:

  | Workflow | Created (UTC) |
  |---|---|
  | Rank Tracker | 2026-10-01 12:06 |
  | Site Tracker | 2026-10-01 22:22 |
  | Content Cadence | 2026-10-01 23:15 |
  | AI Visibility, Backlink Monitor, Audit Scheduler | 2026-10-02 12:32 |
  | AI Pulse | 2026-10-07 22:21 |
  | AI Growth | 2026-10-10 15:14 |
  | Link Builder | 2026-10-11 00:42 |
  | Page Watch | 2026-10-13 06:16 |

  The split was computed by `ui/missed_split.py`.
- **Root cause — [confirmed in code]:**
  - `app/server/src/services/delivery.ts:99-133` (`scheduledWeek`) counts every fire of every automation in the window. It has no
    start date per automation.
  - `AUTOMATIONS` (`app/shared/src/constants.ts:427-520`) lists nine schedules and no Page Watch. `AutomationId` (`:408`) has no
    `page_watch`.
- **Same cause elsewhere:** the Pipeline's automation list (`pipeline.ts:448-…`) also has no Page Watch.
- **Correct behaviour:**
  - Count a schedule only from its workflow's `createdAt`, read from the n8n API.
  - Add Page Watch.
  - Show weeks before a schedule existed as "unmeasured", not 0%.
- **Acceptance test:**
  - (a) Offline, in `server/test/delivery.test.ts`:
    - fires before an automation's creation are not counted;
    - week 09-28 (5 of 5 on demand, every automation created later) gives `overallPct 100`;
    - Page Watch fires are counted.
  - (b) Live: the admin page shows the weeks before 2026-10-01 as "unmeasured".
- **Related:** R104, R94.
- **Watch out:** `scheduledWeek` accepts the nearest execution of **any** mode within ±90 minutes. A Test Runner run would therefore
  hide a missed fire. Count `mode: 'trigger'` executions only.

### R104 (D-8) — App side of the missed schedules: the Pipeline shows on-demand runs as each schedule's "last run"
- **Severity:** Medium.
- **Scope:** the schedule mechanism itself is **R94** (C-18): five weekly workflows have never fired from their cron, restarts discard
  due fires, and the Mac sleeps. This dossier covers only what the app shows.
- **Feature / run:** the website's Pipeline page (each automation with its next and last run), and the platform admin delivery page,
  for techand.ai.
- **What the customer sees** (derived from code; there is no session in that company to take a screenshot):
  - For Rank Tracker, Site Tracker, AI Growth, Link Builder and Content Cadence, a **"last run"** and a **"next run Monday …"** as if
    the schedule worked. n8n holds no `trigger` execution for any of these five.
  - The "last run" is the newest report or data row of any origin — tonight that means the on-demand and Test Runner runs at
    19:41–19:52Z.
  - The AI Pulse's "last run" is a constructed timestamp, `<date>T06:30:00.000Z`. For 2026-10-15 it shows 06:30 UTC, while that day's
    readings came at 11:11Z (scheduled, then replaced) and 19:42Z (on demand).
- **Evidence:** `app/server/src/services/pipeline.ts:408-409`, `:450`, `:457`, `:464`, `:471`, `:478`, `:485`, `:494`, `:501`, `:508`.
- **Root cause — [confirmed in code]:**
  - `pipeline.ts:448-510` builds `lastRunAt` from reports and Data Table rows, whoever produced them.
  - `reportOf` (`:408`) takes the newest report of the stage.
  - `:457` builds the pulse time from the `seo_ai_daily` date plus a fixed `06:30:00.000Z`.
  - `nextRunAt` comes from `nextScheduledRun`, with no evidence the schedule will fire.
- **Same cause elsewhere:** R103 (`scheduledWeek` counts any execution within 90 minutes).
- **Correct behaviour:**
  - "Last run" is the last **scheduled** fire, with its real time.
  - On-demand runs are shown separately.
  - A due window with no fire is shown as "missed on <date>".
- **Acceptance test:**
  - (a) Offline: with only an `integrated` execution on Monday at 19:48, the Rank Tracker automation shows no last run (or a "missed"
    state), not 19:48. The pulse's `lastRunAt` equals its row's `checked_at`.
  - (b) Live: the techand.ai Pipeline shows "missed" for the five schedules until R94 is fixed.
- **Related:** R94, R103.
- **Watch out:** an on-demand pulse replaces the day's `seo_ai_daily` row (C-19). Only the n8n execution mode tells the two apart.

### R108 (D-12) — The meta-tag check says "tag not found, publish it" when it could not read the homepage at all
- **Severity:** Medium (unchanged).
- **Feature / run:** website verification by meta tag, in the browser pass (`rr1015-newcustomer.example.com`, a host that does not
  resolve).
- **What the customer sees:** *"Not verified yet — The seo-agent-verification meta tag was not found on the homepage of
  rr1015-newcustomer.example.com (https). Publish it inside <head> and try again."*
- **Evidence:**
  - `extra/x02-verify-meta-check-desktop-light.png`.
  - By contrast, the DNS check on the same host answered honestly: *"Could not read the DNS records … (ENOTFOUND)"*.
- **Root cause — [confirmed in code]:** `app/server/src/services/verify.ts:88-107` (`verifyMeta`) ends in the same message (`:106`) in
  three different cases:
  1. `fetchPublicText` throws (DNS failure, TLS failure, timeout);
  2. it returns `null` (`:95`);
  3. the page redirects to another host (`:97-98`).
- **Same cause elsewhere:** `fetchPublicText` (`verify.ts:62-…`) is also used by the IndexNow file check (`routes/sites.ts:216-…`).
- **Correct behaviour:** say which case happened:
  - "We could not open https://<domain>/ (<reason>)";
  - "It redirects to <host>; the tag must be on <domain> itself";
  - "The page has no seo-agent-verification tag";
  - "A tag is there with a different code" (this one already exists, `:101`).
- **Acceptance test:**
  - (a) Offline: with `fetchPublicText` mocked to throw `ENOTFOUND`, the message says "could not open" and not "Publish it". With an
    off-host redirect, the message names the redirect.
  - (b) Live: in the browser pass, "Check now" for an unresolvable host shows the "could not open" text.
- **Related:** R97, R98.
- **Watch out:** keep the SSRF guard (public addresses and https only). Do not echo internal addresses in the new messages.

### R112 (D-16) — One backlinks report gives two link counts and two spam verdicts
- **Severity:** Medium (unchanged).
- **Feature / run:** backlinks report b2e07a51 (exec 626) and the monitor block of site report 634.
- **What the customer sees:**
  - In the hero and the report list: *"3 sites link to techand.ai"* (`referringDomains 3`).
  - In the tiles: *"Referring domains 18 · 1 nofollow only"* and *"Spam score 63% — High: many links come from spam sites"*.
  - Further down: *"17 link(s) from link farms / PBN pages set aside"* and "0 spammy".
  - In the site report: *"Backlinks (2026-10-15, full) | 18 referring domains ▲18"*.
- **Evidence:**
  - Payload `summary {referring_domains 18, spam_score 63, referring_domains_nofollow 1}` and `coverage.union 3`.
  - `seo_backlink_snapshots` row 16: `{referring_domains 18, union_domains 3, spam_score 63}`.
  - Rendered text in `D-render-results-since-1855.json`.
- **Root cause — [confirmed in code]:**
  - `app/web/src/components/reports/backlinks.tsx:128` shows DataForSEO's `summary.referring_domains` as "Referring domains", without
    saying whose count it is. `:131` shows the index's `spam_score` with the "High" hint at ≥ 50.
  - The hero (`~:107`) and the list summary (`app/server/src/services/summaries.ts:140`) use the merged count instead.
  - The engine's own report labels the same numbers correctly: `BL_Report.js:39` ("Referring sites (all sources) 3 · DataForSEO
    alone: 18") and `:44` ("Spam score (the index's) 63/100").
  - The site report block reads `seo_backlink_snapshots.referring_domains` (`Site_Report.js:79`).
- **Same cause elsewhere:** `app/server/src/services/data.ts:1049-1051` feeds the Backlinks dashboard tiles. Not checked in a browser.
- **Correct behaviour:**
  - The merged count (3) everywhere.
  - DataForSEO's 18 labelled as the index's count, including the 17 sites set aside.
  - No "High spam" verdict on links already set aside.
  - The site report compares `union_domains` of like snapshots (see also C-2).
- **Acceptance test:**
  - (a) Offline:
    - A render test of `BacklinksReport` with this payload: no unlabelled "Referring domains 18", and no "High" hint once the farms
      account for the spam.
    - Harness: `Site_Report` uses `union_domains`.
  - (b) Live: the next backlinks report shows one count.
- **Related:** C-2.
- **Watch out:** a `free_only` snapshot has `referring_domains 0` and `union_domains 3`. Using the union also removes the false "▲18".

### R113 (D-17) — The site report headline says "up 52%" where its own test says the change is not real
- **Severity:** Medium (unchanged).
- **Feature / run:** site report dcad72e6 (exec 634).
- **What the customer sees:**
  - Hero: *"Clicks from Google are up 52% to 32"*.
  - The brief right under it: *"32 clicks (up 52% from 21, but not statistically significant, so a thing to watch)"*.
  - Subject: *"[SEO weekly] techand.ai — 32 clicks ▲ 52%"*.
- **Evidence:** payload `significance.clicks = {pct 52, ci [-12, 164], real: false, significant: false, watch: true}`, and the rendered
  text.
- **Root cause — [confirmed in code]:**
  - `app/web/src/components/reports/tracker.tsx:21-28` (`clicksHeadline`, called at `:63`) reads only `deltas.clicks_pct`.
  - The engine's subject line (`Site_Report.js:152-154`) does the same.
  - So does the report-list line (`app/web/src/components/reports/ReportSummaryLine.tsx:75`).
- **Same cause elsewhere:** any tile that prints a raw percentage next to a significance verdict.
- **Correct behaviour:**
  - The headline follows the test: lead with the change that is real ("Impressions up 224% — a real change").
  - Clicks read "32, within normal variation" when the change is not real.
  - The subject and the list line follow the same rule.
- **Acceptance test:**
  - (a) Offline:
    - A unit test of the exported `clicksHeadline` with `{pct 52, real:false}`: no "up 52%".
    - Harness: the `Site_Report` subject carries no bare "▲ 52%".
  - (b) Live: the next site report's hero.
- **Related:** R114.
- **Watch out:** `significance` is absent when Search Console is not connected. Keep the current fallback for that case.

### R114 (D-18) — A report page shows only the DataForSEO part of the cost, unlabelled
- **Severity:** Medium (unchanged).
- **Feature / run:** the "Run ledger" card on site_audit, full_report, content, keyword_strategy and ladder_plan reports (tonight: 594,
  607, 611 ×2, 609, 613, rr1015-auditsched). The six monitor renderers have no cost card at all.
- **What the customer sees:**
  - *"Data cost (DataForSEO) $0.026 · 8 API calls · AI steps 0"*, with the tip *"Claude usage is billed by the token and is not
    itemised here."*
  - The full report's $0.037 of Claude, the ladder's $0.0882 and the page run's $0.8933 are not shown.
  - The audit's $0.026 includes a $0.0211 crawl estimate, and nothing says so.
  - The AI visibility, backlinks, pulse, link-building, rank and site reports show no cost at all.
- **Evidence:**
  - The "Run ledger" text per report in `D-render-results-since-1855.json`.
  - The payloads' `run_ledger` objects.
  - Ledger rows 79–102.
- **Root cause — [confirmed in code]:**
  - `app/web/src/components/reports/kit.tsx:279-300` (`LedgerCard`) reads only `dataforseo_usd`. It ignores `ai_usd`,
    `ai_cost_estimated` and `dataforseo_estimated_usd`, and its info text is outdated.
  - The monitor renderers (`ai.tsx`, `backlinks.tsx`, `rank.tsx`, `tracker.tsx`, `linkBuilder.tsx`) render no cost.
- **Same cause elsewhere:**
  - `CONVENTIONS.md` "Cost figures": a figure that does not say whose it is, is a bug.
  - The run page already does this right (`run.tsx:225-…`, `RunDetailPage.tsx:91`).
- **Correct behaviour:**
  - The card shows search data plus Claude, the total, and whose figure each is (measured or estimated; the crawl estimate named).
  - Monitor reports show their cost once R115 is fixed.
- **Acceptance test:**
  - (a) Offline:
    - `LedgerCard` with `{dataforseo_usd 0.0241, ai_usd 0.8933, ai_cost_estimated true}` shows a Claude line and "estimated".
    - With `dataforseo_estimated_usd 0.0211`, the data line reads "partly estimated".
  - (b) Live: the next page report's card.
- **Related:** R115, R102.
- **Watch out:** the share page never exposes the payload (`shareLinks.ts`). Adding cost to a shared page is a separate decision; do
  not do it by accident.

### R115 (D-19) — AI visibility and backlinks runs started from the app would record DataForSEO money alone as their complete "actual" cost
- **Severity:** Medium (unchanged).
- **Feature / run:**
  - The callbacks of the AI Visibility Tracker (623) and the Backlink Monitor (626).
  - Pulse (630), Link Builder (628), Rank Tracker (632), Site Tracker (634) and site description (606) send no cost at all.
- **What the customer sees** (for a run started from the app; tonight's runs had no run row):
  - **"$0.78 · actual"**, with the basis *"… from the search-data tasks it paid for and the model calls it made."*
  - The run's Claude cost (ledger $0.0678; n8n's own count $0.1033, see C-4) is not in that figure.
  - Pulse, link-builder, rank, site and describe runs keep the app's pre-run estimate for ever.
- **Evidence:**
  - Payload 623: `cost_usd 0.7794` and no `run_ledger`. Payload 626: `cost_usd 0.3725`.
  - 628, 630, 632, 634 and 606 carry no cost field.
  - In exec 623, *POST AI Report* started at …928974 and *Ledger Settle (AI)* at …930086, i.e. after it.
- **Root cause — [confirmed in code and in exec 623's node order]:**
  - **Engine.** The monitors send their callback **before** they settle the ledger: in 623, *Build AI Callback* → *POST AI Report* ran
    about 1.1 s before *Load Run Ledger (AI)* → *Ledger Settle (AI)*.
  - So the callback can carry only the report item's `cost_usd`, which is DataForSEO only (`AI_Metrics.js:315`;
    `Build_AI_Callback.js:7-8` passes it through).
  - The other monitor builders are wired the same way (`build_monitors.py:352, 478, 698`; `build_site_tracker.py:294`).
  - `Build_Describe_Response.js` sends no ledger at all.
  - **App.** `ledgerCost` (`summaries.ts:215-223`) turns `cost_usd` alone into `{usd, estimated: false}`, and `cost.ts:186-200` then
    labels it measured.
- **Same cause elsewhere:** R102, R114.
- **Correct behaviour:**
  - Every callback carries `run_ledger` with `dataforseo_usd`, `ai_usd` and the `estimated` flags. Either settle before posting, or
    post a small cost callback after the settle that the app adds to the run.
  - The app labels any figure without a Claude part as partial.
- **Acceptance test:**
  - (a) Offline:
    - Harness: the callback item carries `run_ledger.ai_usd` equal to *Ledger Settle*'s figure, with the node order asserted in the
      build (like build section 55's proof).
    - App: `ledgerCost({cost_usd: 0.7794})` is partial or estimated.
  - (b) Live: an app-started AI visibility run's page shows DataForSEO plus Claude.
- **Related:** R102, R114, C-4, C-5.
- **Watch out:** the front-door ledger rows for these requests (rows 90 and 91: $0.95 and $0.50 "ESTIMATED") are a second figure for
  the same request (C-5). The callback must carry the monitor's settled figure, not the front door's reservation.

### R116 (D-20) — A request the engine refuses after its "started" note leaves the customer waiting for a report that never comes
- **Severity:** Medium (unchanged). The engine side — why it was refused — is C-1.
- **Feature / run:** request 621 (full backlinks check), executions 621 → 622 → 624; report 6f0ab96b (`backlinks_started`).
- **What the customer sees:**
  - *"Backlink check started — … The report arrives at your callback in about 3-5 minutes. About 5 min · The full report appears here
    as soon as it is ready. Ready in ~5 min"* — and nothing after it.
  - A run started from the app would stay "running". Three hours later it would become failed with *"No result arrived from the SEO
    engine in time. The run may have failed in n8n (ops were e-mailed); start it again or check the execution in n8n."*
  - That message is untrue here: no e-mail was sent, because exec 624 ended `success`.
- **Evidence:**
  - Request 621 has only `backlinks_started` in `D-reports-since-1855.json`.
  - Exec 624's status is `success`.
  - Part 3 §2: *After Run Ledger (BL)* refused with `reason "same_mode"`.
- **Root cause — [confirmed in code]:**
  - **Engine.** The monitor gate (`n8n/seo-agent/ladder_common.py:409-427`, `LEDGER_RESUME_JS`) returns a `run_refused` item and posts
    no callback.
  - **App.** The failure watcher reads only failed executions (`app/server/src/services/engineFailures.ts`). The stale-run expiry
    (`app/server/src/services/runs.ts:262-278`) writes a fixed message that assumes a failure and an e-mail.
- **Same cause elsewhere:** every monitor behind `ledger_mainline` can refuse the same way — `heavy_busy`, the open-runs limit, or the
  balance rule (`_run_guard.js:55-…`). Only an on-demand `ai_visibility` or `backlinks` request has a customer run row.
- **Correct behaviour:**
  - An on-demand monitor that is refused posts a callback, e.g. `stage: 'rejected'`, carrying the refusal sentence.
    `RejectedReport` already renders it, and `ingestCallback` (`runs.ts:438-439`) already closes the run on it.
  - The expiry message does not claim an e-mail it cannot know was sent.
- **Acceptance test:**
  - (a) Offline:
    - Harness: for an on-demand item, the refusal branch produces `{stage:'rejected', status:'rejected', error:<refusal>, request_id}`.
    - App: that body sets the run to `failed` with the refusal text.
  - (b) Live: two app-style backlinks requests back to back; the second gets a "rejected" report naming the first.
- **Related:** C-1, C-20.
- **Watch out:** fixing C-1 (the same-mode race) removes tonight's trigger, but not this path. A genuine duplicate request still needs
  its answer.

---

## Low

### R98 (D-2) — In-app copy offers "Search Console" verification where the panel does not
- **Severity:** Low (unchanged).
- **Feature / run:** the onboarding step list, the add-site page and the tool forms (browser pass).
- **What the customer sees:**
  - The onboarding step reads *"Verify ownership — Search Console, DNS or meta tag"* (`shots/05-onboarding-verify-desktop-light.png`).
  - The tool forms say *"Prove ownership once (Search Console, a DNS record or a meta tag) and every tool opens up."*
    (`extra/e16-tool-audit-desktop-light.png`).
  - The verification panel itself offers only "Add a DNS record" and "Add a meta tag".
- **Evidence:** as above; `/api/auth/providers` returns `google:false`.
- **Root cause — [confirmed in code]:** fixed strings that do not depend on `providers.google`:
  - `app/web/src/pages/onboarding/_components/wizard.ts:10`;
  - `app/web/src/pages/settings/AddSitePage.tsx:108,134`;
  - `app/web/src/pages/tools/ToolFormPage.tsx:154`.

  The panel, by contrast, decides at `VerificationPanel.tsx:46`.
- **Same cause elsewhere:** R97. The marketing pages describe the product in general (`pricing.ts:340`, `features.ts:820`,
  `legal.ts:152`, `HomePage.tsx:64`, `HowItWorksPage.tsx:45`); leave them as they are.
- **Correct behaviour:** the list of methods follows `providers.google`.
- **Acceptance test:**
  - (a) Offline: render tests of the three components with `google` false and true.
  - (b) Live: browser pass, phase 1.
- **Related:** R97.
- **Watch out:** `wizard.ts` holds a static constant. Compute the hint where the providers query is available.

### R101 (D-5) — The engine's pre-run estimate for "Describe my website" counts the describe step twice
- **Severity:** Low (unchanged).
- **Feature / run:** report 301ae0cd (request 605, exec 606).
- **What the customer sees:**
  - Nothing tonight, because the run had no run row.
  - A describe run started from the app would show *"$0.06 · estimated by the engine"*, with the basis *"Claude $0.06 (the shipped
    estimate for describe + describe …)"*.
  - The run settled at $0.0039, and the app's table says $0.03.
- **Evidence:** `run_cost_estimate_usd 0.06` and the basis above in the payload; ledger row 83 has `est_usd 0.06`.
- **Root cause — [confirmed in code]:** in `n8n/seo-agent/v5/code/_cost_cal.js:212-222` (`keysFor('ai', …)`):
  - `site_description` maps to `['describe']`;
  - then `need_site_description` pushes `describe` a second time;
  - a describe run keeps that flag set (`Use_Cached_Description.js:13` deliberately leaves it on for `site_description`).
- **Same cause elsewhere:** `pick()` (`:273-…`) doubles the estimate's floor as well. The settle is not affected.
- **Correct behaviour:** add `describe` only for other modes, or de-duplicate the keys.
- **Acceptance test:**
  - (a) Offline: `keysFor('ai', {mode:'site_description', need_site_description:true})` returns `['describe']`; `pick` gives 0.03
    with no calibration.
  - (b) Live: the next describe callback's estimate is 0.03.
- **Related:** R100.
- **Watch out:** for other modes, the extra `describe` key is legitimate. Keep it.

### R105 (D-9) — Ops-alert rows record the wrong delivery channel; the "2–3 days late" was historical
- **Severity:** **Medium → Low (corrected).**
  - Rows 1–2 (raised 2026-10-12 18:34Z) and row 3 (2026-10-13 03:07Z) were raised when e-mail was the only channel, and e-mail failed.
    The Slack webhook was only set on 2026-10-14 (CLAUDE.md, status of 2026-10-14).
  - The retry sweep that later re-sent them shipped on 2026-10-15. It fired on the first workflow run after the deploy (Page Watch
    592, 09:45Z).
  - The live error path tonight (642 → 643) reached Slack (HTTP 200) and e-mail (SMTP 250) in under 5 seconds (part 3 §10).
- **Feature / run:** `seo_ops_alerts` rows 1–4, and the admin page's alert rate, which is computed from them.
- **What the operator sees:**
  - Rows 1–3: `delivered: "webhook"` but `channels: "email,data_table"`.
  - Row 4: `delivered: "failed"`, `attempts: null`, note *"email failed (getaddrinfo ENOTFOUND smtp.gmail.com)"* — although Slack
    accepted it 14 times on 2026-10-15 (C-3).
  - The alert rate shown: **75%**.
- **Evidence:** `alert_rows` in `D-delivery-rate-2026-10-15T1914Z.json`; `files/C-ops-alerts-after-errpath.json`.
- **Root cause — [confirmed in code]:**
  - `n8n/seo-agent/v5/code/Watch_Ops_Delivery.js:22` keeps the stored channel list (`S(r.channels) || 'webhook,data_table'`), not the
    channel that actually carried the alert.
  - Row 4 is the retry-key mismatch described in C-3: the key is trimmed to 206 characters while the stored key has 207, so the update
    matches no row.
- **Same cause elsewhere:**
  - The write-back in the retry kit `v5/code/_alert_retry.js`.
  - `alertDelivery` in `app/server/src/services/delivery.ts`, which counts on `delivered`.
- **Correct behaviour:**
  - `channels` records the channel(s) that carried, or were tried for, the alert.
  - A re-send updates `delivered`, `attempts` and `attempt_log`.
- **Acceptance test:**
  - (a) Offline, harness: *Watch Ops Delivery* with stored channels `email,data_table` and a 2xx webhook answer writes `channels`
    containing `webhook`. Also add the C-3 key case.
  - (b) Live: row 4 reads as delivered with `attempts ≥ 1`.
- **Related:** C-3, R103.
- **Watch out:**
  - There is no latency to fix on the current path.
  - Do not back-date the historical rows.

### R106 (D-10) — On a phone, the DNS record wraps two characters per line
- **Severity:** Low (unchanged).
- **Feature / run:** the verify step and Website settings → verification, at 375 px (browser pass).
- **What the customer sees:** the host and the value as a narrow column. `seo-agent-verification=GsmJ…` breaks into about 30 lines of
  2 characters (`extra/e03-ob-verify-phone-light.png`, `extra/x06-guide-dns-phone-dark.png`).
- **Evidence:** the screenshots above. The page does not overflow, so the automated check passes.
- **Root cause — [confirmed in code]:** `app/web/src/components/site/VerificationPanel.tsx:285-297` (`RecordRow`):
  - the label cell is `w-32` (128 px) and the copy cell `w-24` (96 px), plus padding, in a card about 260 px wide;
  - that leaves the value cell roughly 30 px, with `break-all`.
- **Same cause elsewhere:** every `RecordRow`. The guide panel shows the same values correctly, in full-width copy boxes.
- **Correct behaviour:** below the `sm` breakpoint, stack the label, the value and the copy button, so the value gets the full width.
- **Acceptance test:** (b) Live: in the browser pass at 375 px, the value is at least 200 px wide.
- **Related:** R107.
- **Watch out:** the copy buttons must keep copying the unbroken value.

### R107 (D-11) — The tools page scrolls sideways by 3 px on a phone
- **Severity:** Low (unchanged).
- **Feature / run:** `/o/:org/tools` at 375 px, light and dark (browser pass).
- **What the customer sees:** a 3 px horizontal scroll; the tool cards end at 378 px.
- **Evidence:** `extra-results.json` (`overflowPx: 3`) and `claimed.json` (`wide`: the cards at `right: 378`).
- **Root cause — [hypothesis]:**
  - The cards whose action reads *"Verify rr1015-newcustomer.example.com first"* (`ToolsPage.tsx:278-282`) use a button that is
    `whitespace-nowrap` (`components/ui/button.tsx:11`).
  - In the one-column grid (`ToolsPage.tsx:110`, no `min-w-0`), that label sets the card's minimum width above the track.
  - Consistent with the measurement, but not confirmed by changing the label.
- **Same cause elsewhere:** any button that carries a domain name.
- **Correct behaviour:** no overflow at 375 px with a 40-character domain.
- **Acceptance test:** (b) Live: the browser pass gives `/tools` at 375 px `overflowPx 0` with a long, unverified domain.
- **Related:** R106.
- **Watch out:** confirm the cause in devtools before changing the shared `Button`.

### R109 (D-13) — New customers see another customer's identifiers as placeholder examples
- **Severity:** Low (unchanged).
- **Feature / run:** the onboarding Tracking step, Website settings, the keyword forms, and the GA4 guide.
- **What the customer sees:**
  - The GA4 field's placeholder is **543096312**, techand.ai's real GA4 property.
  - Keyword placeholders read *"e invoicing software uae"*.
  - The brand-name hint reads *"like 'Techand AI'"*.
  - The guide says *"for example `543096312`"*.
- **Evidence:** `extra/e06-ob-tracking-desktop-light.png`.
- **Root cause — [confirmed in code]:** the values are typed into:
  - `app/web/src/components/site/TrackingForm.tsx:133,148`;
  - `GoogleConnectionPanel.tsx:232,257`;
  - `SiteBusinessFields.tsx:257`;
  - `pages/tools/_components/forms/growth.tsx:298`;
  - `pages/site/NewLadderPage.tsx:333`;
  - `app/shared/src/guides.ts:249`.
- **Same cause elsewhere:** `grep -rn "543096312\|e invoicing\|Techand"` over `app/web/src` and `app/shared/src` (excluding tests)
  lists them all.
- **Correct behaviour:** neutral examples, e.g. `123456789`, "accounting software dubai", "'Northwind Trading'".
- **Acceptance test:**
  - (a) Offline: a guard that fails on `543096312` or `techand` anywhere in `app/web/src` or `app/shared/src`, outside tests.
  - (b) Live: a screenshot of the tracking step.
- **Related:** none.
- **Watch out:** `guides.test.ts` checks every placeholder's example. Keep the examples consistent there.
