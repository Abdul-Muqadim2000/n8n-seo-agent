# Defects to fix — the 2026-10-15 re-rating (R34–R119)

**Written 2026-10-16 for the chat that will fix these defects.** Every defect the third whole-system re-rating found
(`RESULTS.md`, scored 5.5/10 in `SCORECARD.md`) is written down here exactly, in a form a fixer can act on without re-deriving it.

## How this was made exact

1. **Found live** (2026-10-15, executions 594–643) by four executor agents, each quoting the real output (`parts/1`–`4`).
2. **Re-checked by the orchestrator** before acceptance: every original High against the raw execution, the database or the live site.
3. **Re-verified for this document** by the same four agents, read-only, in a second pass. For each defect they re-confirmed the
   symptom from the saved evidence and traced it to a root cause in the code at **file:line**, marked **[confirmed in code]** or
   **[hypothesis]**. They also named every other path that runs the same code, the correct behaviour, and an acceptance test (offline and
   live). Where a finding turned out wrong, overstated or mis-described, it was **corrected or withdrawn**; see "Corrections" below.
4. **Spot-checked again by the orchestrator in the code:** the root causes of R47 / R69 / R80, R53, R42, R66, R77, R79, R110 and
   R111 were read in the source and hold.

**The full entry for each defect is in its dossier** (linked in the index): `defects/A_keywords_content.md` (R34–R58),
`defects/B_technical.md` (R59–R76 and R117–R119), `defects/C_monitors.md` (R77–R96), `defects/D_app_reporting.md` (R97–R116).
Each entry gives: severity, feature and run, **what the customer sees** (quoted), evidence (exec → node → field → value), **root cause
(file:line)**, the same cause elsewhere, correct behaviour, acceptance test, related defects, and **"Watch out"** — what a fixer could
misread. The evidence it cites is in the git-ignored `files/` folder of this review (execution JSON, report payloads); it exists only
on the machine that ran the review.

## Start here (for the fixing chat)

- **Fix by family, not by defect.** Most defects share a root cause with others in their family (table below); a fix on one path of
  several is how three of this week's fixes failed live (R77, R79, R47). Every dossier entry has a "Same cause elsewhere" line — fix all
  of them.
- **Follow the working rules in `/CLAUDE.md`.** Edit `v5/code` / `v5/prompts` / the build scripts, never the generated JSON. Run
  `python3 build_v4.py` and check its exit code. Run the harness to `0 failed`, verified by exact assertion count. Add a harness
  scenario per fix from the dossier's offline acceptance test; the fixtures can be cut from the saved executions. Worktrees build with
  `SEO_BUILD_ALLOW_DEFAULTS=1` and never commit generated trees; rebuild in the main worktree after every merge. Next free build
  section **88**, harness scenario **S98**.
- **A fix is not done until it has run once live.** Every dossier gives the live check. Re-run the affected protocol run after deploy
  (the toolkit is `n8n/seo-agent/rerate_toolkit.py`).
- **Do not restart n8n (deploy) on a Monday between 11:00 and ~16:00 UTC** — a restart discards a weekly run that is due or delayed
  (R94).
- **Scan every staged diff for secrets as its own step, then commit** (the repository is public).
- **Two decisions are already argued in the dossiers.** R110: change the app's delivery rule, not the engine's `progress` status (79
  stored rows and every engine reader depend on it). R77: fix run identity (pass the parent run id, exclude it in the gate), not timing.

## Counts after re-verification

| Severity | Count |
|---|---|
| **High** | **15** — R34, R35, R36, R37, R38, R43, R59, R60, R61, R66, R77, R78, R94, R110, R111 |
| Medium | 39 |
| Low | 28 |
| Withdrawn | 1 — R53 (a ladder row saying `writing` means "written, not live" by design; the real problem is R111) |
| New observations | 3 — R117–R119 (found during re-verification, below) |

## Corrections to the `RESULTS.md` register (§3)

| Id | Was | Now | Why (detail in the dossier) |
|---|---|---|---|
| R43 | Medium | **High** | The refusal "covers 60% … against a target of 90%" compares two different measures: 60% counts terms that reach the brief's minimum count (`Content_QA.js:291-296`), 90% counts terms present at all (`_coverage.js:22-26`). On the competitor's own measure the draft covers all 20 terms. A wrong number shown to the customer as a reason to refuse. |
| R66 | Medium | **High** | The cross-type comparison (`data.ts:731-733` takes the previous audit whatever its type) also drives a High-priority recommendation, "Health score fell from 83 to 70 — New issues appeared…" (`recommendations.ts:257-261`), and the technical page hero. |
| R102 | High | Medium | The search-data-only "actual" figure sits on four legacy run rows (2026-10-03 / 08). The live producer of the same mislabel is R115, with the same root cause (`summaries.ts:215-223` + `cost.ts:186-200`). Fix the two together. |
| R69 | Low | Medium | Not specific to the Content Reviewer: the same counting bug as R47 / R80 (below). |
| R93 | Low | Medium | Not a wording slip. The Link Builder takes each target page's first Search Console query as its "title" (`LB_Plan.js:95`), so 7 of 10 pitches suggest an exact-match keyword as link text, against the product's own "brand / title / URL, never a keyword" rule. |
| R42 | Medium | Low, narrowed | "Sixth active ladder against `max_active: 2`" withdrawn: `max_active` caps what the cadence writes and extra ladders queue by design (`Cadence_Plan.js:141-143`). Remains: an on-demand ladder writes a page past the pile-up limit without saying so. |
| R50 | Medium | Low | The app already warns at the ladder step (`pipeline-notices.ts:210-220`); only the engine's own Keyword Check answer lacks the warning. |
| R105 | Medium | Low, re-described | The 54–63 h delay was historical (raised before the Slack webhook and the retry sweep existed; the live path delivered in under 5 s). Remains: re-sent rows record the wrong `channels`. |
| R39 | Medium | Medium, narrowed | The supply-chain rung stands (`_radius.js:21` drops 2-letter tokens, so "ai" never counts). The "openai consulting" half is withdrawn: the site sells "Azure OpenAI Service" and `Ladder_Pool.js:96` deliberately protects that word. |
| R52 | Low | Low, narrowed | Only the customer-visible "Pages read" titles are wrong (`Site_Pages.js:21`); `site_facts` built from headings is by design (the Critic's whitelist, never shown). |
| R63 | Medium | Medium, re-described | "Internal URLs that redirect" correctly lists the redirecting URLs. The wrong pages are named by "Links pointing to redirects", because the crawler flags `has_links_to_redirects` on the redirect items themselves. |
| R82 | Low | Low, re-described | The crawl estimate was right. The missing money is the first *Fetch GBP* attempt (not in `__LEDGER_NODES`); the same gap exists for *Run Ladder Research* and *Run Reach Requests*. |
| R92 | Low | Low, re-described | The bare-host rows in `seo_ai_pages` are stale rows from 2026-10-10/11, not written twice on every run; the upsert key still does not normalise the host. |
| R100 | Medium | Medium | Figures updated: the engine now reserves $1.40 for a page (a second calibration value since the run). |
| R53 | Low | **Withdrawn** | By design (see Counts). |

## One root cause behind three defects: R47 = R69 = R80

The count step builds the answer it sends to Anthropic's `count_tokens` as `String(output ?? '')` (`build_v4.py:5837`,
`build_v4.py:7492`, `build_monitors.py:150`). For every agent with an output parser `output` is an object, so the counter receives the
literal string `"[object Object]"` and counts the answer as 4–6 tokens, while the ledger labels the figure "measured". **16 agents** are
affected — main workflow 9 (Site Describer, Competitor Analyzer, Strategy Brief, Content Reviewer, Keyword Seeds, Verdict Agent,
Keyword Relevance, Critic, Ladder Keyword Relevance), AI Visibility 3 (Prompt Writer, Answer Analyst, AI Brief), Backlinks 2 (Link
Analyst, Outreach Writer), Link Builder 1 (Outreach Sequence Writer), AI Growth 1 (AI Outreach Writer). Site Brief, Reply Reader and
Keyword Fit are not counted at all. Fix it once, serialising the object; acceptance: on a re-run each node's counted answer is within a
few percent of n8n's own `tokenUsage.completionTokens`.

## Fix order — families that share a root cause

Ordered by how much of the score they hold (`SCORECARD.md` §3 "What would have to be true", §6). The scorer's arithmetic: **the 15 High
fixed and seen live ≈ area mean 5.8 → 6**; with the Medium / Low of the same families ≈ 6.2–6.3. Beyond that the owner's items (a
business profile, a connected mailbox, an always-on host, a larger AI panel) and published pages are needed.

| Family | What has to become true | Defects |
|---|---|---|
| F1 | Know the customer's own site before advising | R34, R35, R36, R38, R59, R60, R61, R49, R50, R52, R55, R56, R89 |
| F2 | Outputs carry their own state; modules agree | R111, R78, R66, R87, R41, R67, R74, R92, R112, R113 |
| F3 | Reports reach the customer | R110, R116, R104 |
| F4 | Run identity, guards and schedules | R94, R77, R81, R96, R103 |
| F5 | Alerting | R79, R105 |
| F6 | Cost truth | R47, R69, R80, R82, R68, R70, R54, R57, R46, R100, R101, R102, R114, R115 |
| F7 | One competitor / brand / topic gate for every list | R83, R86, R90, R39, R93 |
| F8 | Content QA reads what it checks | R37, R43, R44, R45 |
| F9 | Technical audit accuracy | R62, R63, R64, R65, R71, R72, R73, R75, R76 |
| F10 | AI visibility and pulse reporting | R84, R85, R95 |
| F11 | Rank tracking and ladder planning | R88, R91, R40, R42, R51, R58, R48 |
| F12 | App screens and copy | R97, R98, R99, R106, R107, R108, R109 |

**Family notes (root causes from the dossiers, short form):**
- **F1:** The page inventory holds titles only for the ≤ 15 pages publish detection fetches each week and for AI Growth's pages
  (`Page_Inventory_Site.js:46-48`, `Match_Slugs_Detect.js:11`), so `SM.matchPage` cannot find the live AI-consulting page (R34).
  Discovery prints "does not target this search" on a literal 75% token match (`_kw_inputs.js:95/100`, R35) and ignores the keyword's
  own Search Console page (`Rank_Keywords.js:66`, R36). The verdict reads the client page cut to 9,000 characters
  (`Collect_Client_Pages.js:13`) and then to 3,500 in the analyzer prompt (`competitor_analyzer.txt:26`), while the dates sit at
  character 6,997; the verdict dropped the analyzer's hedge (R38). The not-indexed finding never checks the other host
  (`GSC_Audit_Findings.js:674`, v5 `:91`), and "one canonical host" is decided from the redirect and the homepage tag alone
  (`Analyze_Probes.js:49`, R59). The full report seeds keywords from H1s sorted by click depth (`build_v4.py:649`), and the fit gate,
  fed only those three seeds, judges nothing under 12 topic words (`_fit_gate.js:74-76`, R60). "No rankings" is stated from
  DataForSEO's database alone (`Competitor_Analysis.js:64-69`, `Analyze_Keywords.js:402-407`, `Build_Full_Report.js:1046`, R61).
- **F2:** `Content_Log_Row.js:41` writes `written` without the QA verdict (`Content_QA.js:587`), and nine readers turn it into "publish
  it" (R111, reader list in the dossier). `latest2()` in `Site_Report.js` and `data.ts:731-733` compare the newest two rows of any type
  (R78, R66).
- **F3:** Nine engine report nodes end with `status: 'progress'` (`AI_Report.js:133`, `BL_Report.js:140`, `LB_Report.js:94`,
  `Growth_Report.js:65`, `Pulse_Metrics.js:87`, `Site_Report.js:157`, `Tracker_Report.js:304/442`, `Cadence_Status.js:23`,
  `Cadence_Note.js:27`). `report-delivery.ts:217-218` holds anything not "completed" and runs before the interim check (`:219`); the
  app's own tests assume `completed` (`report-delivery.test.ts:93-99`) (R110).
- **F4:** `_run_guard.js:68-69` matches a "twin" on `mode` alone. The monitor receives the API's request id (`Monitor_Start.js:4`), not
  its parent's run id, and the front door spawns it before settling its own row (`build_v4.py:1785-1796`) (R77). R94 — established:
  every n8n restart re-arms each cron to its next *future* time, so a due fire not yet delivered is lost (the 2026-10-12 16:38–16:40
  deploys came before five delayed Monday fires). Hypothesis: the Docker VM's timers stop while the Mac sleeps. A product fix is
  possible: a catch-up on n8n's "Instance Started" trigger plus an hourly sweep; the always-on host is the owner's.
- **F5:** `_ops_alert.js:17-18` cuts the alert key at 160 characters without trimming (row 4's stored key ends in a space, 207
  characters); `_alert_retry.js:24/98/116` trims it (206), so the update matches no row. The Error Handler's *Alert Delivery* has two
  inputs (`build_v4.py:3890-3891`), so the retry runs twice per failure (R79).

## New observations found while re-verifying (R117–R119, not yet in FIX_PLAN)

| Id | Sev. | What | Where |
|---|---|---|---|
| R117 | Low | "Shallow site structure: 100% of crawled pages are within 3 clicks of the homepage" beside a High "Orphan pages" finding: the six orphan pages carry `click_depth 0` because the crawler starts from the sitemap (the same `click_depth 0` puts them first in R60's seeds) | `GSC_Audit_Findings.js:585`, `:731`; exec 595 `depth_buckets` |
| R118 | Medium | "Pages with duplicate content" is scored as a whole-site issue with no page named and ranks third in the fix list (above orphans and the lorem ipsum) | `Build_Site_Issues.js:482-487` (`addCount` sets `scope: 'site'` with no URLs) |
| R119 | unclassified | The technical audit's raw-page fetch sends `User-Agent: Mozilla/5.0 (compatible; SEOAgentAudit/1.0; +https://www.google.com/bot.html)` — Google's bot URL — while the reading is presented as what "a crawler that does not render" sees | *Fetch Raw Pages* (exec 595 workflowData) — **not investigated** |

## Index — every defect

| Id | Part | Severity | Title | Family | Dossier |
|---|---|---|---|---|---|
| R34 | A-1 | **High** | The ladder plans new "AI consulting" pages, and writes one, on a site that already has a live "AI Consulting" page | F1 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R35 | A-2 | **High** | Discovery says 20 pages "do not target" searches they plainly target | F1 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R36 | A-3 | **High** | Discovery recommends new pages for searches the site already ranks for with a dedicated page | F1 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R37 | A-4 | **High** | Page QA masks two correctly sourced figures and tells the owner the source does not carry them | F8 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R38 | A-5 | **High** | The verdict states what the customer's page lacks; three of those statements are false | F1 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R43 | A-10 | **High** | The page is refused at "60% coverage against 90%", but the two numbers are measured differently; on the competitor's measure the draft has 100% | F8 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R59 | B-1 | **High** | The first-ranked audit finding reads "Google serves the bare host" as "pages not indexed" | F1 | [`defects/B_technical.md`](defects/B_technical.md) |
| R60 | B-2 | **High** | Full-report keyword research is seeded from three orphan card headings, and the topic gate never engages | F1 | [`defects/B_technical.md`](defects/B_technical.md) |
| R61 | B-3 | **High** | "The site does not rank in Google's top 10 for any keyword" while the same report's Search Console shows 15 | F1 | [`defects/B_technical.md`](defects/B_technical.md) |
| R66 | B-8 | **High** | The app compares a full report with the technical audit before it: wrong delta, "25 new issues", a High recommendation | F2 | [`defects/B_technical.md`](defects/B_technical.md) |
| R77 | C-1 | **High** | An app backlinks request is refused by its own front-door run, and the customer is never told | F4 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R78 | C-2 | **High** | The weekly site report compares a full report with a technical audit, and a full backlink snapshot with a free one | F2 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R94 | C-18 | **High** | Five of the ten schedules have never fired on their own; the rest fire late; a restart throws a due fire away | F4 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R110 | D-14 | **High** | Every monitor report is held from delivery and shared under "This run did not produce a report" | F3 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R111 | D-15 | **High** | The customer is told to publish pages that failed the quality check | F2 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R39 | A-6 | Medium | An off-topic supply-chain rung on the "ai consulting dubai" ladder, because "ai" is not a word that matters | F7 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R40 | A-7 | Medium | Keywords Google answers with different pages are merged onto one page anyway | F11 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R41 | A-8 | Medium | Two traffic figures for the head term in one ladder report | F2 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R44 | A-11 | Medium | The coverage target and its subtopics come from pages that do not match the page being written | F8 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R45 | A-12 | Medium | Brackets left for the owner are not counted or named | F8 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R47 | A-14 | Medium | The Claude cost ledger counts every structured answer as "[object Object]" (4–6 tokens) and labels it measured | F6 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R49 | A-16 | Medium | A "good (50-70%)" chance is shown for a site whose reach rests on no measured ranking | F1 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R51 | A-18 | Medium | Discovery's "where to start" pick is a keyword in steep decline, which its own follow-up advises against | F11 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R58 | A-25 | Medium | Discovery's content plan puts first a topic its own header says to leave to an existing ladder | F11 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R62 | B-4 | Medium | Hex HTML entities are not decoded: a false "AI crawlers see a different version" finding and a false "unescaped entity" review finding | F9 | [`defects/B_technical.md`](defects/B_technical.md) |
| R63 | B-5 | Medium | Two 308 redirect responses are treated as pages | F9 | [`defects/B_technical.md`](defects/B_technical.md) |
| R64 | B-6 | Medium | The four extra crawl reports are requested without the crawl's task id and never read | F9 | [`defects/B_technical.md`](defects/B_technical.md) |
| R65 | B-7 | Medium | Impact weights use site-average estimates for pages Search Console measured in the same run | F9 | [`defects/B_technical.md`](defects/B_technical.md) |
| R67 | B-9 | Medium | The full report's `seo_audits` row disagrees with its own finding rows | F2 | [`defects/B_technical.md`](defects/B_technical.md) |
| R69 | B-11 | Medium | The token counter counts a structured answer as "[object Object]": 9 Claude nodes' "measured" cost is wrong | F6 | [`defects/B_technical.md`](defects/B_technical.md) |
| R76 | B-18 | Medium | The content review says "no badges" where the homepage shows a Microsoft Partner badge | F9 | [`defects/B_technical.md`](defects/B_technical.md) |
| R79 | C-3 | Medium | One stale ops alert is re-sent to Slack on every monitor run; its row is never updated | F5 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R80 | C-4 | Medium | The Claude cost called "measured" counts every structured answer as the string "[object Object]" | F6 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R81 | C-5 | Medium | Front-door ledger rows double-count monitor runs; finished runs are named "in flight" in cost notes | F4 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R83 | C-7 | Medium | AI visibility tells the customer to pitch businesses that AI names instead of them, and keeps them as link prospects | F7 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R84 | C-8 | Medium | AI visibility describes its denominators wrongly; AI Overview presence counts a failed request | F10 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R86 | C-10 | Medium | Direct competitors are treated as link opportunities (Link Builder and Backlink Monitor) | F7 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R87 | C-11 | Medium | "e invoicing in uae" is set aside and pursued in the same run | F2 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R88 | C-12 | Medium | Two "page movement" figures for one keyword in one run; identical requests seconds apart disagree | F11 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R89 | C-13 | Medium | The brand / non-brand split counts "tech" as the brand | F1 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R90 | C-14 | Medium | "facts erp", another company's brand, is still planned and printed | F7 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R93 | C-17 | Medium | The Link Builder uses a Search Console query as each target page's "title", so the suggested link text is a keyword (severity raised) | F7 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R97 | D-1 | Medium | The locked dashboard card names a way of proving ownership that does not exist | F12 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R99 | D-3 | Medium | The same run shows two different prices on one screen | F12 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R100 | D-4 | Medium | The app's pre-run price is the engine's shipped default, not what the engine actually reserves | F6 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R102 | D-6 | Medium | Old runs show a search-data-only figure as their complete "actual" cost | F6 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R103 | D-7 | Medium | The admin delivery rate counts schedules that did not exist yet as missed, and leaves out the tenth schedule | F4 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R104 | D-8 | Medium | App side of the missed schedules: the Pipeline shows on-demand runs as each schedule's "last run" | F3 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R108 | D-12 | Medium | The meta-tag check says "tag not found, publish it" when it could not read the homepage at all | F12 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R112 | D-16 | Medium | One backlinks report gives two link counts and two spam verdicts | F2 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R113 | D-17 | Medium | The site report headline says "up 52%" where its own test says the change is not real | F2 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R114 | D-18 | Medium | A report page shows only the DataForSEO part of the cost, unlabelled | F6 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R115 | D-19 | Medium | AI visibility and backlinks runs started from the app would record DataForSEO money alone as their complete "actual" cost | F6 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R116 | D-20 | Medium | A request the engine refuses after its "started" note leaves the customer waiting for a report that never comes | F3 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R42 | A-9 | Low | An on-demand ladder writes a page past the pile-up limit without saying so | F11 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R46 | A-13 | Low | "The editor had 2 round(s)" after one editor call, and the ledger prices a second | F6 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R48 | A-15 | Low | The verdict calls an ASP "FTA-accredited"; accreditation is run by the Ministry of Finance | F11 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R50 | A-17 | Low | The Keyword Check's own answer does not mention an existing ladder or page for the keyword | F1 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R52 | A-19 | Low | The description's "Pages read" shows the same wrong title for all five menu pages | F1 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R54 | A-21 | Low | Results pages are bought for keywords the relevance screen then rejects | F6 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R55 | A-22 | Low | Discovery's Search Console rows mix the bare host and `www.` | F1 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R56 | A-23 | Low | "Already answered by" points at the blog index instead of the dedicated article | F1 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R57 | A-24 | Low | A Strategy Brief rejected by its parser is asked again, and the retry is not in the cost | F6 | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
| R68 | B-10 | Low | Run cost misses the first Google Business Profile lookup; a definitive "No Search Results" is retried and paid again | F6 | [`defects/B_technical.md`](defects/B_technical.md) |
| R70 | B-12 | Low | Competitor discovery is paid for and discarded when the request names the competitors | F6 | [`defects/B_technical.md`](defects/B_technical.md) |
| R71 | B-13 | Low | "Deprecated HTML tags" flags `<u>`, a conforming HTML element | F9 | [`defects/B_technical.md`](defects/B_technical.md) |
| R72 | B-14 | Low | "1 of 47 pages (20%)" | F9 | [`defects/B_technical.md`](defects/B_technical.md) |
| R73 | B-15 | Low | Lineage rows that do not match the report | F9 | [`defects/B_technical.md`](defects/B_technical.md) |
| R74 | B-16 | Low | The full-report diff calls a one-day SERP swing "fixed"; its summary misstates why a number is not compared | F2 | [`defects/B_technical.md`](defects/B_technical.md) |
| R75 | B-17 | Low | The pre-release check talks about a staging host on a production check | F9 | [`defects/B_technical.md`](defects/B_technical.md) |
| R82 | C-6 | Low | Several monitor costs are not measured; the audit's cost list misses its first GBP lookups (re-described) | F6 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R85 | C-9 | Low | The AI search-volume lookup failed twice and the report does not say so | F10 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R91 | C-15 | Low | Ladder report subjects say "top 100", the body and the checks say "top 50" | F11 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R92 | C-16 | Low | Smaller inconsistencies the customer sees (one part re-described) | F2 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R95 | C-19 | Low | A same-day on-demand pulse replaces that day's scheduled reading | F10 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R96 | C-20 | Low | A refused run takes 5 min 33 s to do nothing (cause: hypothesis) | F4 | [`defects/C_monitors.md`](defects/C_monitors.md) |
| R98 | D-2 | Low | In-app copy offers "Search Console" verification where the panel does not | F12 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R101 | D-5 | Low | The engine's pre-run estimate for "Describe my website" counts the describe step twice | F6 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R105 | D-9 | Low | Ops-alert rows record the wrong delivery channel; the "2–3 days late" was historical | F5 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R106 | D-10 | Low | On a phone, the DNS record wraps two characters per line | F12 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R107 | D-11 | Low | The tools page scrolls sideways by 3 px on a phone | F12 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R109 | D-13 | Low | New customers see another customer's identifiers as placeholder examples | F12 | [`defects/D_app_reporting.md`](defects/D_app_reporting.md) |
| R53 | A-20 | Withdrawn | Ladder row `writing` while the content log says `written`: by design, not a defect | — | [`defects/A_keywords_content.md`](defects/A_keywords_content.md) |
