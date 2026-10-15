# Third whole-system re-rating — live runs on techand.ai, 2026-10-15

The whole-system re-rating protocol (`../system-review-2026-10-11/FIX_PLAN.md` §5.2), run on the owner's site **techand.ai** (country
United Arab Emirates) on **2026-10-15 between 18:57 and 20:14 UTC**. Every feature was exercised live the way a paying customer would
use it: every analysis was sent the way the web app sends it (`X-Forwarded-For: app:<techand.ai company>` and the company's own
callback), so its report landed in the app's `reports` table; the monitors were started on demand through the Test Runner, which was
active only from **19:29:17 to 20:00:26 UTC**. **Executions 594–643 (50)** — every one `success` except **642**, a deliberate failure
used to test the alert path.

The deployed state matched the source exactly before the first run: main workflow **668 nodes**, **21 published workflows**, every
`workflows/*.json` node count equal to the live one (checked through the n8n public API at 18:50 UTC); nothing running; the last
execution before the run was 593.

**This document is the master record. The full per-run evidence — every request body, quoted output, node-level checks, live-site
checks and cost reconciliation — is in the four part files beside it**, which are part of this record:

| Part | Runs | Written by |
|---|---|---|
| [`parts/1_keywords_content.md`](parts/1_keywords_content.md) | Site Admin, Keyword Check ×3, Reply Reader ×4, describe, verdict, ladder + its page, discover + its keyword report | executor A |
| [`parts/2_technical.md`](parts/2_technical.md) | technical audit, Full SEO Report, pre-release check ×2 | executor B |
| [`parts/3_monitors.md`](parts/3_monitors.md) | AI visibility, backlinks, Link Builder, AI Pulse, Rank Tracker, Site Tracker, Page Watch, Content Cadence dry run, Audit Scheduler, the error path, AI Growth (read-only), schedule history | executor C |
| [`parts/4_app_reporting.md`](parts/4_app_reporting.md) | the web app: a new customer's journey in a browser, the report renderers, delivery and sharing, the cost figures, and every report of this run as the app stored it | executor D |

**How it was run.** Four executor agents, each in its own git worktree, ran and recorded the runs; none scored anything. They were
told to quote real output, check figures against their inputs and against the live site, and write in neutral language. The
orchestrator re-checked every High finding against the executions, the databases or the live site before accepting it (§0b). The
score is given separately, by an independent session that did not take part in the run (`SCORECARD.md`).

**Rules kept.** No outreach e-mail to anyone (no mailbox connected); nothing published; no WordPress push; **no URL submitted to Bing
or IndexNow** (which is why AI Growth was not run, §2.20); no credential printed or stored; no code, workflow, prompt or credential
changed; no temporary workflow; nothing deployed. Third parties received nothing; public pages were read (GET) to check claims.

---

## 0. Spend

**DataForSEO $2.4486 measured from the account; Claude $1.4120 from n8n's own token counts ($0.8821 measured, $0.5299 n8n's
estimate for the four Opus calls of the page run). Total ≈ $3.86.**

| | Amount | How it was measured |
|---|---|---|
| DataForSEO | **$2.448625** | `appendix/user_data` read from inside the n8n container (credentials never printed): **$13.707979 at 18:57:14 UTC** → **$11.259354 at 20:14:05 UTC**, nothing else running. The account's own day total went $0.084 (the scheduled pulse of 11:11) → **$2.532625**, under the $6 line the owner set. Every probe is in `files/spend.jsonl`. |
| Claude | **$1.4120** | Every Claude call of executions 594–643 (33 calls) priced at the official list prices (Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 4.5 $1/$5 per million tokens — checked against Anthropic's model table; the engine's own price table carries the same figures). **$0.8821** from n8n's `tokenUsage` (29 Sonnet / Haiku calls); **$0.5299** from `tokenUsageEstimate` only — the four Opus 5.5 streaming calls of the page run 616 (Strategy Brief ×2, Copywriter, Editor), for which n8n reports no real usage. |

**Per window** (balance deltas, the only figure that cannot be argued with):

| Window | UTC | Runs | Account moved | The engine's own ledger rows | Difference |
|---|---|---|---|---|---|
| 1 | 18:57:14 → 19:26:49 | 594–618 (executors A and B) | **$0.972488** | $0.9507 (11 rows, each equal to the sum of its run's own task costs) | −2.2% |
| 2 | 19:26:49 → 20:14:05 | 619–643 (executor C) | **$1.476137** | $1.4424 (the monitors' 11 rows) — but **$2.8924** with the two front-door rows that duplicate them (R81) | −2.3% / +96% |

Finer windows inside window 2, with one run at a time: AI visibility 623 $0.781387 (engine $0.7794), backlinks 626 $0.372636 (engine
$0.3725), Link Builder 628 + pulse 630 $0.133764 (engine $0.05 estimated + $0.084), Rank Tracker 632 + Site Tracker 634 $0.151000 (engine
$0.12 + $0.01 estimated), Audit Scheduler's audit 641 $0.037350 (engine $0.0265). Details: `parts/3_monitors.md` §Runs.

**The engine's Claude figures are lower than n8n's on every structured-output call** (R47 / R80): the count it calls "measured" sends
the literal string `"[object Object]"` to the token counter as the answer, so every structured answer counts 4–6 tokens. On the
eight Sonnet / Haiku executions of window 1 the ledger says $0.3234 where n8n reports $0.5052.

**Balance left: $11.26.** A full protocol run costs about $2.5; the weekly schedules spend roughly $1.5–2 a week on this site when
they fire. No top-up was needed for this run.

---

## 0b. What the orchestrator verified independently

Every High finding was re-checked against the source before it was accepted. None was overturned.

| Claim (part id → register id) | How it was checked | Result |
|---|---|---|
| Five weekly workflows never started from their own schedule (D-8 / C-18 → R104 / R94) | the full n8n execution history (nothing pruned: 574 executions back to id 38, 2026-10-01) grouped by workflow and mode; every workflow's settings (`saveDataSuccessExecution: all`) and trigger; the run ledger's `schedule:*` rows | **Confirmed.** Rank Tracker, Site Tracker, Content Cadence, Link Builder and AI Growth have no `trigger`-mode execution at all; every execution of theirs is `integrated` (Test Runner or another workflow). The ledger agrees. |
| The app's backlinks request was refused by its own parent run (C-1 → R77) | exec 624 *After Run Ledger (BL)* output | **Confirmed**: `reason: "same_mode"`, "The previous backlinks run (execution 622 …) is still going" — 622 is the same request's front-door run. |
| The weekly site report compares a full report with a technical audit (C-2 → R78) | exec 634 output | **Confirmed**: "Technical audit (2026-10-15) … health 70/100 ▼13" and "Backlinks (2026-10-15, full) 18 referring domains ▲18". |
| An old alert is re-sent to the owner's Slack on every run (C-3 → R79) | every *Post Alert Retry* node of executions 594–643; `seo_ops_alerts` | **Confirmed**: 12 re-sends during this run, all HTTP 200; row 4 still `delivered: failed`, `attempts: null`. |
| The engine counts structured Claude answers as ~5 tokens (A-14 / C-4 → R47 / R80) | *Count Prompt* vs *Count Answer* in 608 and 614 | **Confirmed**: Count Answer = Count Prompt + 5 in every case; *Prompt For Count* carries `[object Object]`. |
| The audit's first-ranked "not indexed" finding is a host split (B-1 → R59) | exec 595 *GSC Audit Query* rows; the finding's sample URLs | **Confirmed**: the finding lists `https://www.techand.ai/whatwedo` as not indexed; the same run's Search Console rows give `https://techand.ai/whatwedo` 94 impressions. |
| The full report offers other brands and government services as keywords (B-2 → R60) | the delivered Word text of 614 | **Confirmed**: easy wins "ai mode" 49,500, "blackbox ai", "face swap ai", "mofa attestation dubai"; AI question "best ai in cloud company United Arab Emirates". |
| "Does not rank in Google's top 10 for any keyword" beside "Ranks #1 for its brand name" (B-3 → R61) | the delivered Word text of 614 | **Confirmed**: both lines are in the same report. |
| The ladder says nothing on the site is about AI consulting (A-1 → R34) | the ladder plan JSON; `seo_pages`; the live page | **Confirmed**: plan "Nothing on techand.ai is about …"; `seo_pages` row for `/ai-copilot-advisory-uae` has `title: ""`; live `<title>AI Consulting &amp; Copilot Advisory UAE \| Tech&amp;</title>`. |
| Page QA masks sourced figures (A-4 → R37) | the delivered page; the run's fact evidence | **Confirmed**: the page carries `[Confirm: 40%]` and `[Confirm: 27%]`; the evidence the run held says "Forty percent … up from 27". |
| The verdict says the customer's page has no mandate dates (A-5 → R38) | the text the run read | **Confirmed**: it contains "1 January 2027". |
| Old app runs show a search-data-only figure as "actual" (D-6 → R102) | the app's `runs` table | **Confirmed**: page run 221 "actual" $0.0221, verdict 199 $0.0221, ladder 219 $0.1185. |
| The locked dashboard card names a verification method the server refuses (D-1 → R97) | `SiteLayout.tsx:77`; `routes/sites.ts:207` | **Confirmed.** |
| No monitor report can be delivered or shared as finished work (D-14 → R110) | the app's `reports` rows of this run by stage and status; `app/shared/src/report-delivery.ts` `deliveryDecision` | **Confirmed**: every monitor report of this run is stored `progress` (13 of 24; 79 of 178 in the table) and `deliveryDecision` holds any status other than completed / ok / success: *"This run finished as "progress", not as a completed report."* The status test runs before the interim test, so the "started" notes are held as rejected. |
| The customer is told to publish pages the system marked not ready (D-15 → R111) | the site report payload of 634 | **Confirmed**: *"Publish the written page for "ai consulting" (planned URL https://www.techand.ai/ai-consulting/) and report the link with "I published a page"."*, and the same for "azure api management monetization" — both delivered as "did not pass the quality check — not ready to publish". |

---

## 1. Runs

All times UTC, 2026-10-15. "API" is the front door's execution, "run" the execution that did the work. DataForSEO is the run's own
figure / its `seo_run_ledger` row; Claude is n8n's token count priced at list prices (measured unless marked estimate).

| # (protocol) | What | Executions (API → run → spawned) | Start–end | Duration | DataForSEO | Claude | Status |
|---|---|---|---|---|---|---|---|
| — | Balance before | — | 18:57:14 | — | — | — | $13.707979 |
| 1 | Site Admin `monitors` (keep `link_builder: true`) | 596 → 597 | 19:02:13–19:02:14 | 0.5 s | 0 | 0 | 200, `affected: 1`, no other setting changed |
| 5 | Keyword Check "erp software uae" | 598 | 19:02:24–19:02:30 | 5.7 s | $0.0241 / row 80 | $0.0030 | 200 — volume 480, KD 3 |
| 5 | Keyword Check "business central partner uae" | 599 | 19:02:34–19:02:38 | 3.9 s | $0.0240 / row 81 | $0.0027 | 200 — no search data, no chance band |
| 5 | Keyword Check "dynamics 365 partner uae" | 600 | 19:02:41–19:02:47 | 5.1 s | $0.0240 / row 82 | $0.0030 | 200 — no search data, no chance band |
| 11 | Reply Reader (a) interested + factual questions | 601 | 19:04:09–19:04:17 | 7.4 s | 0 | $0.0042 | `question`, nothing invented |
| 11 | Reply Reader (b) out of office | 602 | 19:04:22–19:04:26 | 4.3 s | 0 | $0.0036 | `out_of_office`, return 2026-11-02 |
| 11 | Reply Reader (c) remove me | 603 | 19:04:30–19:04:32 | 2.0 s | 0 | $0.0025 | `unsubscribe` |
| 11 | Reply Reader (d) "we added your link" (real page) | 604 | 19:04:37–19:04:41 | 4.3 s | 0 | $0.0027 | `says_linked`, link **found** live, follow |
| 8 | Technical audit, 200 pages | 594 → 595 | 19:01:52–19:07:29 | 5 min 33 s | $0.0265 / row 79 | 0 | health **83**, 30 findings |
| 3 | `describe` | 605 → 606 | 19:04:55–19:05:51 | 56 s | 0 / row 83 | $0.0117 | completed, 28 services |
| 4 | `verdict` "e invoicing software uae" | 607 → 608 | 19:05:18–19:07:44 | 2.4 min | $0.0241 / row 84 | $0.1145 | GO_WITH_CHANGES **58**, improve the existing page |
| 6 | `ladder` "ai consulting dubai", `pages_now` 1 | 609 → 610 | 19:05:34–19:09:12 | 3.6 min | $0.1404 / row 85 | $0.1167 | GO_WITH_CHANGES 52, 4 pages, `lad_mv9wshpdy2jf` |
| 9 | `discover` + Keyword Report | 611 → 612 | 19:06:01–19:08:17 | 2.3 min | $0.2478 / row 86 | $0.1648 | pool 667 → 239 → 104 |
| 10 | → keyword report "construction project erp" (spawned) | 615 | 19:08:02–19:10:16 | 2.2 min | $0.0221 / row 88 | $0.0888 | GO_WITH_CHANGES 46 |
| 14 | Full SEO Report, 200 pages | 613 → 614 | 19:07:46–19:15:38 | 7 min 51 s | $0.3936 / row 87 | $0.0469 | health **70**, 61 findings |
| 7 | → the ladder's rung-1 page "ai consulting" (spawned) | 616 | 19:09:09–19:23:05 | 13.9 min | $0.0241 / row 89 | $0.1461 + **$0.5299 estimate** | **"did not pass the quality check — not ready to publish"** |
| G27 | Pre-release check, 10 live key pages | 617 | 19:22:36–19:22:41 | 4.6 s | 0 | 0 | `pass`, exit 0, `writes: none` |
| G27 | Pre-release check, redirect + 404 + no description | 618 | 19:22:50–19:22:52 | 2.1 s | 0 | 0 | `fail`, exit 1, `writes: none` |
| — | Balance | — | 19:26:49 | — | — | — | $12.735491 (−$0.972488) |
| — | Test Runner activated | — | 19:29:17 | — | — | — | — |
| 12 | `ai_visibility` | 619 → 620 → 623 | 19:29:23–19:35:31 | 6 min 08 s | $0.7794 / rows 90 + 93 | $0.1033 | completed, 47 requests, 1 failed |
| 13 | `backlinks`, full | 621 → 622 → 624 | 19:29:25–19:34:58 | 5 min 33 s | $0 / rows 91 + 92 (**refused**) | 0 | **refused by its own parent run** (R77); customer got `backlinks_started` only |
| 13′ | Backlink Monitor again, through the Test Runner, same body | 625 → 626 | 19:40:40–19:41:29 | 49 s | $0.3725 / row 94 | 0 | completed, full report |
| 15 | Link Builder, paid, on demand | 627 → 628 | 19:42:54–19:44:17 | 1 min 23 s | $0.05 estimate / row 96 | $0.0326 | delivered with a 6-page PDF; 4 drafts held |
| 16 | AI Pulse | 629 → 630 | 19:42:55–19:43:46 | 50 s | $0.084 / row 95 | 0 | 21 answers, no alert |
| 18 | Rank Tracker | 631 → 632 | 19:48:29–19:48:49 | 20 s | $0.12 / row 97 | 0 | 8 reports, 12 SERP reads (2 mobile) |
| 20 | Site Tracker (on demand) | 633 → 634 | 19:48:31–19:49:31 | 61 s | $0.01 estimate (≈ $0.031 moved) / row 98 | $0.0352 | delivered |
| G11 | Page Watch | 635 → 636 | 19:52:35–19:52:42 | 7 s | 0 / row 99 | 0 | 25 pages + robots.txt, no change, no callback (by design) |
| 19 | Content Cadence **dry run** | 637 → 638 | 19:52:36–19:52:39 | 3 s | 0 / row 100 | 0 | paused on the pile-up guard (4 unpublished pages), wrote nothing |
| 21 | Audit Scheduler on demand → technical audit | 639 → 640 → 641 | 19:53:26–19:58:50 | 5 min 24 s | $0.0265 (≈ $0.0374 moved) / rows 101 + 102 | 0 | health 83; diff 0 fixed / 0 new / 27 open, same report type |
| — | Error path: Test Runner with a workflow id that does not exist | 642 (error) → 643 (Error Handler) | 19:59:48–19:59:54 | 6 s | 0 | 0 | alert reached Slack (HTTP 200) and the ops mailbox (SMTP 250); recorded `delivered: webhook,email` |
| — | Test Runner deactivated | — | 20:00:26 | — | — | — | `active: false` confirmed |
| — | Balance after | — | 20:14:05 | — | — | — | $11.259354 (−$1.476137) |

**50 executions (594–643)**, all `success` except 642 (the deliberate failure). **24 callbacks reached the app** for the company
(executor D's part 4 lists them with what each carries): `site_description`, `content` ×3 (the verdict, the keyword report, the page),
`keyword_strategy`, `ladder_plan`, `site_audit` ×2, `full_report`, `ai_visibility_started`, `ai_visibility`, `backlinks_started` ×1
(request 621, never followed by a report), `backlinks` (the second attempt), `link_builder`, `ai_pulse`, `rank_tracker` ×8,
`site_tracker`. The Keyword Check, Reply Reader and pre-release check are synchronous; Page Watch and the cadence dry run send no
callback by design.

Durations against 2026-10-14 (same protocol numbers): describe 44 s → 56 s; verdict 2.1 → 2.4 min; ladder 93 s → 3.6 min (10
results-page checks for clustering were added); page 8.7 → 13.9 min (one Strategy Brief retry); discover 1.9 → 2.3 min; technical audit
4.6 → 5.5 min; full report 8.8 → 7.9 min; `ai_visibility` 2.1 → 6.1 min (two DataForSEO side requests failed slowly, R85); Link Builder
91 → 83 s; pulse 50 s = 50 s; Rank Tracker 20 s = 20 s; Site Tracker 64 → 61 s; Audit Scheduler 4.9 → 5.4 min.

### Protocol runs not exercised, and why

| Run | State | Reason |
|---|---|---|
| 17 AI Growth | **not run** | Its normal run submits pages to Bing Webmaster Tools (and IndexNow when the key file is hosted) and it has no dry-run switch; the owner forbids test submissions. Its record was read instead (§2.20): 8 executions, all on demand, none from its schedule; the last (2026-10-14, exec 574) submitted 2 URLs to Bing; the IndexNow key file answers 404. |
| 2 Reply Reader publish / activate | n/a | published and active since 2026-10-11 |
| `published` for a page that is really live | **not exercised** | nothing the system wrote has been published (4 written pages wait); a `published` row would be false |
| The October Search Console check-in | **not exercised** | only the owner can answer it |
| A `profile` write with real data, then a content run that uses it | **not exercised** | no real author / reviewer / address on file; the page run carried `style_guide: null` and no author |
| The app UI inside the techand.ai company | **not exercised** | no session in that company could be obtained: a temporary test login added to it was refused by the permission system and not attempted any other way. The app's handling of this run's reports was read from its database instead (`parts/4_app_reporting.md` part 4), and a **new customer's journey** was driven in a real browser (§2.24) |
| Report delivery (scheduled e-mail / webhook / "Send it now") | **not exercised** | delivery is off for every company and the dev server has no SMTP; `report_deliveries` holds 0 rows ever |
| Audit / keyword / backlink modes on two more owner-named sites | **not exercised** | no second site was named |
| A scheduled (trigger-mode) run of any monitor | **not exercised live** | the run uses on-demand starts; the schedule history was read instead (§2.22) |

---

## 2. Findings by feature

Each section: what was asked, what came back (quoted), where it is right, where it is wrong (register ids, §3), and the gap to the
leader named in the rubric. The part file named in each heading holds the full evidence.

### 2.1 Site Admin and the Keyword Check (runs 1, 5 — `parts/1` §1–§2)

Site Admin `monitors` answered `{"ok":true,"affected":1}`; the `seo_monitors` row before and after differs only in `updated_at` /
`request_id`.

Keyword Checks (synchronous, 3.9–5.7 s): "erp software uae" → volume 480, KD 3, commercial, CPC 13.98, **"Easy for your site · Direct
plan · 2-4 months"**, **"estimated chance good (50-70%, uncalibrated)"**, fit 2. "business central partner uae" and "dynamics 365
partner uae" → DataForSEO has no data for the UAE; the answer is labelled **"Reachable for your site · Short ladder · 4-8 months · no
search data"**, `chance: null`, with *"No estimated chance: DataForSEO has no search volume and no difficulty … so the difficulty this
estimate rests on (counted as your reach + 10) was never measured."* Every number matches its DataForSEO answer; the ledger rows carry
the task costs exactly.

Wrong: a "good 50-70%" band printed for a site whose reach rests on `sample: 0, top10: 0` (R49); the check does not say that two of the
three keywords already head ladders of this site (R50); the reach is one site-wide figure cached on 2026-10-08 and applied to every
topic. Gap: Semrush's Personal KD / MarketMuse's personalised difficulty measure topical authority per topic; here no difficulty exists
for 2 of 3 keywords and none was derived from a results page.

### 2.2 Reply Reader ×4 (run 11 — `parts/1` §3)

All four classes right: (a) `question`, with the factual questions (Peppol go-live count, Ministry accreditation, typical cost) left in
one `[Owner: confirm …]` bracket — nothing invented; (b) `out_of_office`, return date parsed to `2026-11-02`, the colleague captured as a
referral; (c) `unsubscribe`; (d) `says_linked` — the real page `peppol.org/members/full-members-list/` was fetched and the link **found**,
`rel follow`, placement content, before the thank-you was drafted. The Reply Reader writes no ledger row ($0.0129 of Claude unrecorded,
R47). Whether the app's sender pauses on the return date was not exercised (no mailbox).

### 2.3 describe (run 3 — `parts/1` §4)

"Tech&", 28 services that match the capability pages, claims that are on the homepage ("20+ Years", "24/7 Support"), the stored
canonical host and address reused. Wrong: the five nav pages all carry the rendered reader's title instead of their HTML titles, and
`site_facts` mixes section headings and article titles with facts (R52); the ledger settles $0.0039 against $0.0117 because the answer
was counted as 4 tokens (R47).

### 2.4 Keyword verdict "e invoicing software uae" (run 4 — `parts/1` §5)

**GO_WITH_CHANGES 58** (2026-10-14: 58). Reasons quoted: *"Volume is only 40/month on average, but the trend is rising: 110 searches
in 2026-08, up from 20 in 2026-02 (+120% quarterly). The 1 Jan 2027 go-live for AED 50M+ businesses and the 30 Oct 2026 ASP
appointment date keep demand building."*; *"The SERP is beatable. Of six ranking pages, two vendor pages are very thin … Only
complyance.io has comparison tables (7)."* The existing page is found (`existing_page_action: "improve"`, matched by slug from the page
inventory) and every change reads "On that page, …"; an FAQ section "with question-style headings", no FAQPage; *"An AI Overview was
seen in the check at 19:05 UTC on 2026-10-15, citing nine other sites. AI Overviews vary between searches, so this is one
observation."*; coverage target 90% of 25 shared terms against cleartax.com.

Checked: the dates are right (WAM: the Ministry of Finance moved the ASP appointment deadline to 30 October 2026, implementation 1
January 2027); volume, trend, CPC and the competitor pages' word counts match their sources; the AI Overview references exactly nine
domains.

Wrong: **R38 (High)** — *"Its visible text has no mandate dates, no PINT-AE or 5-corner explanation, no tables, no lead CTA and no
author or date."* The live page states both dates, holds 3 HTML tables and a visible byline with Article schema `author`; the 9,000
characters the run read already contained "30 October" and "2027". R48: "FTA-accredited ASP" — ASPs are accredited by the Ministry of
Finance. Gap: Surfer / Clearscope grade the client's page from the whole page; this read the first 9,000 characters with tables
flattened.

### 2.5 Keyword ladder "ai consulting dubai" (run 6 — `parts/1` §6)

Every DataForSEO task answered 20000 (SERP top 10 at depth 30, facts, keyword data, research, 10 cluster SERPs); `pool_size 41`,
`serp_checked true`. 41 → 34 reviewed → 26 relevant; 19 removed as off-topic with a reason each; "meta ai" and "pitch ai" refused as
navigational. Head: volume 40, CPC 8.02, **"winnable", GO_WITH_CHANGES 52**, *"Reachable for your site · Short ladder · 4-8 months"*,
chance "fair (30-50%, uncalibrated)". Rungs: "ai consulting" (170/mo, rung 1, **written in this run**), "ai consulting firm" + "openai
consulting", "supply chain optimization consulting" + three supply-chain variants, and the top page "ai consulting dubai" with six
supporting terms; rung targets 1,900 words (median of 5 pages read), top page 2,300. The clustering rule is printed: *"The results pages
of 10 of the 10 rung keyword(s) were read and compared: searches sharing 3 of their top 7 pages (40%) are one page, not two - no two of
them share one."* On 2026-10-14 the same protocol run planned on a SERP that had failed twice, with a pool of 1 and a rung target of 0
words.

Wrong: **R34 (High)** — *"Nothing on techand.ai is about "ai consulting dubai" yet — no page and no keyword it ranks for — so all 4
page(s) in this plan are new"* while the live page `/ai-copilot-advisory-uae` is titled "AI Consulting & Copilot Advisory UAE" (its
inventory row has an empty title); the plan adds three new AI-consulting pages and the written page links to the existing one. R39:
a supply-chain-consulting rung and "openai consulting" (a search about OpenAI's own consulting arm) on an AI-consulting ladder. R40: the
cluster check found no pair sharing more than 1 of 7 results, yet keywords were merged "by topic label". R41: two traffic figures for
the head term in one report (12 with no click loss; 6 with the −52% AI Overview loss). R42: the ladder was created as the sixth `active`
ladder against the site's `max_active: 2`, and its page became the fourth unpublished page against `max_waiting: 3`; the plan says
neither. R44: subtopics for the top page taken from a listicle's competitor entries ("2. Accenture AI & Analytics", "3. IBM AI
Consulting"). R54: $0.006 of SERPs bought for keywords the relevance pass then rejected. Gap: Semrush Keyword Strategy Builder /
MarketMuse start from the site's own inventory and place the existing page into the pillar; Keyword Insights merges only on SERP overlap.

### 2.6 The ladder's page "ai consulting" (run 7 — `parts/1` §7)

Execution 616, 13.9 min. The Facts SERP returned `40101 "Internal SE Server Error."` **inside HTTP 200**; the run waited 5 s and the
retry answered 20000. The first Strategy Brief was rejected by the parser and asked again (R57). Delivered: title "AI Consulting in the
UAE | Strategy to Live Pilot | Tech&", 8 H2, 17 question headings, Service + BreadcrumbList schema, three rendered WebP images with alt
text; **2,197 words against a 1,900 target (+16%)** (2026-10-14: +47%); 7 internal links, every one live on www.techand.ai;
originality 0.2% highest overlap against 8 pages. **Verdict shown to the customer: "did not pass the quality check — not ready to
publish (round 2 of 2)"**, files named `…-DRAFT.doc/.pdf`, with reasons including *"it covers 60% of the terms the best-ranking page
covers, against a target of 90%"* and *"Figures the cited source does not carry (now marked [Confirm: …]): "40%" (mckinsey.com); "27%"
(mckinsey.com)"*.

Checked against sources: Deloitte's figures exact; McKinsey's 40% / 27% correct ("The state of AI in 2026"); alicelabs.ai's rates
faithful and labelled "a single estimate"; PwC not verifiable live (403).

Wrong: **R37 (High)** — the QA masked two correctly sourced figures and told the owner the source does not carry them (the evidence it
held reads "Forty percent … up from 27"). R43: the coverage refusal reports words present on the page as missing (they are below a
frequency target), and the editor's cut took coverage from 90% to 60%. R44: the coverage target came from a US agency-software blog
(vendasta.com) and its ad banner became a section of the draft ("Serving more clients with AI-powered software"). R45:
`placeholder_count: 0` while five brackets remain. R46: "The editor had 2 round(s)" — one ran, and the ledger prices two. R53: the
ladder row stays `writing` while the content log says `written`. R34 again: a second page for a search the site already answers; the
originality check did not compare against the existing AI-consulting page. Gap: Semrush's writing assistant checks originality against
the web; Writer flags unsupported claims — this flagged supported ones.

### 2.7 Discover and its keyword report (runs 9, 10 — `parts/1` §8)

Pool **667 → 239 screened → 104 relevant** (2026-10-14: 839 → 240 → 30); 40 seeds, 10 of them real Search Console queries; 16 priority
keywords live-checked with a timestamp and a page-type read (*"Comparison or lists are what Google ranks here: 9 of the 9 results read,
while this plan writes a service or product page - expect to work harder"*); ladder-covered keywords named ("Already in your ladder "erp
software uae""); none navigational or governmental.

Wrong: **R35 (High)** — 20 Search Console rows say *"the page that gets the impressions does not target this search"* for pages that
plainly target it ("d365 finance dubai" → the Dynamics 365 Finance & Operations page; "pdf vs e-invoice uae" → the PDF-invoice
article) — matched on literal tokens ("d365" ≠ "dynamics 365"). **R36 (High)** — priority keywords #10 and #12–#16 recommend new
Location / Landing pages for searches an existing page already ranks for (#13 at Search Console position 6.2), labelled "not in top 20"
by the live check, without naming the existing page. R51: the "where to start" pick "construction project erp" falls 73% a year,
construction is not among the site's industries, its own follow-up report says *"traffic will be negligible"*, and two SERP reads 53 s
apart share no top-5 domain. R55: mixed hosts in the Search Console rows. R56: a query "answered by" the blog index instead of its
article. R58: "Build first" lists a topic the same report says to leave to an existing ladder. The follow-up report (GO_WITH_CHANGES 46)
agrees with discover's figures.

### 2.8 Technical audit, 200 pages (run 8 — `parts/2` §1)

**Health 83 "Good"**, 30 findings (High 4, Medium 9, Low 14, Info 3), 47 items crawled; the score reproduces exactly from the engine's
formula. Every finding carries evidence and an impact basis capped at the property's real totals (32 clicks / 5,308 impressions).
Crawl coverage *"Crawled 45 of 45 known URLs (100%; sitemap 45 + 44 pages with Search Console impressions)"*. URL Inspection **45 of
45 answered, 0 failed** (2026-10-14: 31 of 45 failed). Core Web Vitals: CrUX enabled, no field data for this site — an Info line, not a
score. The fix pack keeps every live robots.txt line; llms.txt and the three schema blocks carry only what the site's own pages state.
Diff against the previous **technical** audit: *"0 fixed · 0 new · 27 still open"*, the indexing row with `checked 45, checked_before
45`.

**Live check of all 30 findings against the site** (both hosts): **17 true, 7 false, 1 misleading, 5 not verifiable.** Without the 7
false findings the engine's own formula gives 85.

Wrong: **R59 (High)** — the first-ranked finding, *"A large share of important pages is not indexed by Google … Pages that Google has
not indexed cannot rank at all … request indexing"*, is a host split: all 16 "not indexed" www paths earn impressions on
`https://techand.ai/…` in the same run's Search Console data (1,374 impressions); the property's rows are 37 pages / 5,193 impressions
on the bare host against 13 / 522 on www, and the sitemap submitted to Search Console is the bare-host one — while "what works" says
"One canonical host". R62: `&#x27;` not decoded before comparing → a scored "AI crawlers see a different version" finding that is not a
difference. R63: two 308 redirect responses counted as pages → five false findings (compression, canonical, outbound links, Open Graph,
Twitter card) and a denominator of 47. R64: the four extra crawl reports are requested without the task id and all answer "Task Not
Found" (as on 2026-10-14), so redirect chains are never read. R65: impact uses site-average estimates for pages the run measured
("an estimated 637 impressions" where 16 were measured). R71: `<u>` flagged as deprecated. R72: "1 of 47 pages (20%)". R73: lineage
rows that do not match the report. Gap: Sitebulb / Screaming Frog classify redirects as redirects and compare response vs render on
every page; Ahrefs Patches deploy fixes; here a zip of files and 5 key pages rendered.

### 2.9 Full SEO Report, 200 pages (run 14 — `parts/2` §2)

**Health 70 "Needs Improvement"**, 61 findings (7 from the AI content review, not scored). Competitors as provided (cleartax.com,
azentio.com); domain ages from the cache (`whois_requests: 0`), checked against RDAP; lab PageSpeed mobile 90; 25 link-gap domains
with one pitched (uae-asp.ae) and 24 refused each with a reason; the diff is full vs full (*"1 fixed · 0 new · 51 still open"*).

Wrong: **R60 (High)** — the keyword research is seeded from three generic card headings ("ai & automation", "assess & envision", "build
& implement") and applies no brand / government gate: easy wins "ai mode" (49,500/mo, Google's product), "blackbox ai", "face swap ai",
"mofa attestation dubai"; a gap list led by "vat", "trn", "trade license", "how to check emirates id status with passport number"; and
the AI-visibility question becomes *"best ai in cloud company United Arab Emirates"*, on which two High findings rest — identical to
2026-10-14. **R61 (High)** — *"The site does not rank in Google's top 10 for any keyword"* (High, third in the top issues) while the same
report's Search Console data has 15 queries at average position ≤ 10 and its "what works" says *"Ranks #1 for its brand name"*. R66:
the app's technical page would compare this full report with the technical audit before it (25 findings "new"). R67: the stored audit
row's severity counts (17/22/19) disagree with its 51 stored finding rows (14/19/18). R68: the first Business Profile lookup missing from
the cost. R69: the content reviewer's Claude cost understated (answer counted as 5 tokens). R70: competitor discovery paid for and
discarded. R74: a one-day SERP swing on the brand query called "fixed". R76: the AI review says "no badges" where the homepage shows a
Microsoft Partner badge twice. The two reports delivered 8 minutes apart print different URL Inspection state counts for 5 pages.

### 2.10 Pre-release check (G27 — `parts/2` §3)

`POST /webhook/seo-prerelease`: 10 live key pages → **`pass`, exit 0**, *"10 of 10 page(s) read, 79 check(s) passed, 1 warning(s), 3
not checked"* (the warning: `/power-platform-analytics-uae` has no meta description); a bare-host redirect, an invented 404 and that page
→ **`fail`, exit 1** with the redirect and the 404 as critical failures. Both answered `writes: "none"`; the workflow has no write node.
Wrong: R75 — "not checked" reasons speak of a staging host on a production check. Gap: Lumar Protect runs 350+ tests and compares the
candidate with the live page; here 8 checks per page — a title carrying the brand twice and the lorem ipsum on `/industries` pass.

### 2.11 AI visibility (run 12 — `parts/3` §1)

8 questions (7 buyer + the brand question) × ChatGPT, Perplexity, Gemini, Claude, Google AI Overview, Google AI Mode: **47 requests, 1
failed** (an AI Overview "Internal SE Server Error."), retried once, not answered; disclosed in the report's second line. Headline:
*"Tech& was named in 0% of 74 AI answers this week (95% range 0–4.9%), even though all 5 engines asked know the brand."* — the 74
combine this run's answers with 41 daily-pulse answers; every Wilson range recomputes. The comparison names its engine set and panel
(8 vs 8) and every delta is "within sampling noise". The 4-character name "Tech&" is kept out of the market table with the reason. 13
brand hits, all in brand-question answers about techand.ai — no other company counted. Fact check: *"What AI gets wrong: not checked
… nothing on file can judge what the answers claim — fill the business profile …"*. Crawler access: 8 of 8 answer bots allowed.

Wrong: R83 — the report recommends pitching a guest article to wafeq.com and edicomgroup.com, businesses the same report lists among
those AI recommends instead (the Link Builder refused wafeq.com as a competitor 13 minutes later), and keeps eight such domains as
link prospects. R84 — denominators described wrongly ("74 answers (8 questions × 6 engines)", "the 33 answers that came back" while 46
of 47 answered; tables add up to 81); AI Overview presence counts the failed request as "no AI Overview". R85 — the AI search-volume
lookup failed twice (status 50000) without a word in the report. R80 — Claude cost labelled measured is 34% low. Gap: Profound asks
100 prompts × 3 engines daily, Semrush 25 daily; here 7 buyer questions weekly on 6 engines plus a daily pulse on 3; the fact check the
criteria call mandatory did not run (no profile).

### 2.12 Backlinks, full (run 13 — `parts/3` §2)

**The first attempt was refused by its own parent run (R77, High).** The front-door run 622 reserved a `backlinks` ledger row and
started the Backlink Monitor 624 without waiting; 624's concurrency gate read the ledger 81 ms before 622 settled its row and refused:
*"The previous backlinks run (execution 622, started 19:29 UTC) is still going. Nothing was charged and nothing was started…"* The
customer received `backlinks_started` and nothing else; the refused run still took 5 min 33 s, 315 s of it in a free balance read (R96).
AI visibility passed the same gate only because its parent's row had settled 0.6 s earlier.

**Second attempt** (Test Runner, same body; executor C's decision, recorded as a deviation): 49 s, full report. Sources merged:
DataForSEO 1 referring site, Bing "no links yet", the Search Console upload 1, GA4 referrals 1, Common Crawl 1 → **3 referring sites**;
*"Of the 1 sites in Google's own sample (Search Console), DataForSEO sees 0%"*. Own check: 19 referring pages fetched, *"3 still carry
the link"*. **17 link-farm links set aside** with the reason (the same page path on 16 sites). Lost: none, "every linked page works".
Best links peppol.org (DR 77, "✓ on the page") and tracxn.com. Government gap row refused, 18 off-topic gap rows refused.

Wrong: R86 — five competitors' own service pages ("Microsoft Dynamics 365 Partner in Dubai, UAE | QZ Infomatics") read as "best of"
lists and one saved as a `list` prospect. R92 — the anchor block says farm anchors are left out of the table and the table lists only
them. Gap: Ahrefs reports 35T records and 8 lost reasons; here the whole picture is 3 referring sites, and the merge is what makes it
usable.

### 2.13 Link Builder, paid (run 15 — `parts/3` §3)

7 qualified (5 ready, 2 need a contact), 22 not fit with reasons (six competing sites refused by keyword and position, government sites
refused), 10 to the writer: **4 drafted, 6 declined** with reasons; **all 4 drafts held** (*"needs you: [Your name]"*). Contacts only on
the prospect's own domain. **Every quoted line in the drafts exists on the prospect's page** (fetched). Listings checklist of 16 (MoF
accredited providers and OpenPeppol "not listed", with the requirements spelled out; 11 "Not checked (the site blocks checks)" — never
"missing"). Impact with a control group: peppol.org "Too early to tell", tracxn.com "Can't tell". A 6-page PDF.

Wrong: **R86** — a held draft goes to daxin-global.ae, whose homepage sells Dynamics 365, Business Central and e-invoicing; qzinfomatics.com
(a Dynamics 365 partner in Dubai) was qualified `ready` at fit 0.87 (the writer declined it, for weak evidence). R93 — a garbled page name
in a decline reason; "as a option" in a draft. R80 — Claude cost 46% low. Gap: no send, reply rate or follow-up timing measurable (no
mailbox, by rule).

### 2.14 AI Pulse (run 16 — `parts/3` §4)

21 answers (7 questions × ChatGPT, Gemini, AI Mode), 0 errors, named 0% (95% range 0–15.5%), no alert — the same as 2026-10-14. Why
today's scheduled pulse (exec 593, 11:11) left no report in the app: *Pulse Alerts* returned `{skip: true}` — quiet scheduled days send
nothing, by design. Wrong: R95 — the on-demand run replaced the day's stored scheduled reading (one `seo_ai_daily` row per day); R82 —
$0.004 of Claude settled for a workflow with no Claude node. The scheduled pulse fired late on 6 of 7 days (§2.22).

### 2.15 Rank Tracker (run 18 — `parts/3` §5)

12 SERP reads (10 desktop, 2 mobile, UAE, depth 50): 7 ladder heads plus the new ladder's rungs; **the customer's own keywords tracked
without a second purchase**; SERP features per keyword (AI Overview on all 12), a modelled share of voice with its CTR curve, competitors
above, page movement, timed AI Overview sightings with *"whether it cites you was not loaded"* where its sources were not bought. *"peppol
uae (#47 → not in top 50; the whole results page moved that week (9 of the top 9 places changed), so this is not necessarily about your
page)"*. Next steps read the page inventory (*"… already answers this search — refresh that page, do not publish a second one"*).

Wrong: R87 — "e invoicing in uae" is "set aside … no position checked" in the report while it was checked (paid) and given a next step,
and the cadence queues four of its rungs. R88 — two movement figures for one keyword in one run; two identical requests 32 s apart
returned different top results. R90 — the rung "facts erp" (facts.ae's brand, which ranks #3 for "erp software uae") still planned and
printed, as on 2026-10-14. R91 — subjects say "top 100", bodies "top 50". Gap: AccuRanker / Semrush are daily with on-demand refresh;
here weekly, mobile on 2 of 12, country level only.

### 2.16 Site Tracker (run 20 — `parts/3` §6)

Search Console paged and untruncated (953 rows read, `truncated: []`), withheld queries reported apart (28% of impressions), Poisson
tests on every change (*"clicks (32) are still too few to call a real rise"*), GA4 joined, Trends "too little search volume for a trend"
instead of percentages, a cannibalisation pair with an action, publish detection (none published — correct), annotations including
*"the report before it was a technical audit (80/100): different checks, so the two scores are not comparable"*.

Wrong: **R78 (High)** — the monitor summary block prints *"Technical audit (2026-10-15) … health 70/100 ▼13"* (the full report against
the technical audit) and *"Backlinks (2026-10-15, full) 18 referring domains ▲18"* (a full snapshot against a free one) — `latest2()`
takes the two newest rows of any type. R89 — the brand split counts "tech" as the brand ("technology and analytics", "techandkey com"
308 impressions). R92 — two "/" rows, "10 countrys", and a peppol page status that contradicts the Rank Tracker of the same minute.
R82 — DataForSEO cost an estimate ($0.01 against ≈ $0.031 moved).

### 2.17 Page Watch (G11 — `parts/3` §7)

25 of 45 known pages and robots.txt, all 200, 0 changed, robots hash equal to the previous; each row carries Google's index state from
the Site Tracker's inspection. Wrong: R92 — 2 of the 25 slots are menu fragment URLs (`/industries#bfsi`, `/capabilities#ai`). Page Watch
never reaches the app (it posts only to the ops webhook).

### 2.18 Content Cadence dry run (run 19 — `parts/3` §8)

`dry_run` confirmed in the build before starting (the write / spawn / callback nodes hang only off the non-dry branch). Result: *"4
written pages waiting for publication (pile-up guard, limit 3): "erp software uae", "service industry erp software", "azure api
management monetization", "ai consulting" — publish them to continue"*; nothing written. The fourth page is the one this run's ladder
wrote. The queue behind the pause is four rungs of the ladder the Rank Tracker calls "set aside" (R87).

### 2.19 Audit Scheduler (run 21 — `parts/3` §9)

`run: true, why: "on demand"`, sitemap fingerprint refreshed; the audit (641) health 83; diff *"0 fixed · 0 new · 27 still open
(compared with the technical audit of 2026-10-15)"* — technical vs technical, `sample_moved 0`. R82: the crawl priced $0.0211 while the
account moved $0.0374 for the run.

### 2.20 AI Growth — not run (`parts/3` §11)

Not run, by the owner's rule (it submits to Bing with no dry-run switch). Its record: 8 executions, **all on demand, none from its
schedule**; the last (2026-10-14, exec 574) checked 12 pages (average AI-readiness 77) and submitted 2 URLs to Bing; IndexNow
`key_missing` and the key file URL answers **404**; `seo_ai_targets` 7 (6 queued, 1 skipped as fresh and AI-ready); `seo_ai_pages` holds
the same pages under both hosts (R92).

### 2.21 The error path and the alert record (`parts/3` §10)

A Test Runner start with a non-existent workflow failed (642, *"Workflow is not active and cannot be executed."*); the Error Handler
(643) wrote `seo_ops_alerts` row 5 and delivered it to **the owner's Slack webhook (HTTP 200, "ok")** and **the ops mailbox (SMTP "250
2.0.0 OK", 1 accepted)** within 5 s, and recorded `delivered: "webhook,email"`, `attempt_log` with the attempt.

Wrong: **R79** — the same run re-posted an older alert (row 4, Console Alerts' IMAP failure of 2026-10-13) to Slack twice, and every
monitor run of this test did the same: **12 re-sends during this run, 14 on the day**, each "attempt 1 of 10 … this alert has reached
nobody", while row 4 stays `failed` / `attempts: null` — the retry's update key is trimmed (206 characters) and the stored key ends with a
space (207), so the update matches no row. Every future run will re-send it. Rows 1–3 reached Slack 54–63 hours after they were raised
(a Page Watch re-send), and still carry `channels: "email,data_table"` (R105).

### 2.22 Schedule reliability (read-only — `parts/3` §12, `parts/4` part 2)

**Five of the ten schedules have never fired on their own.** In the full execution history (nothing pruned, back to 2026-10-01):

| Workflow (due, n8n clock America/New_York) | Due since creation | Fired on time | Late | Missed |
|---|---|---|---|---|
| AI Visibility (Mon 07:00) | 2 | 0 | 1 (26 min) | 1 |
| Backlinks (Mon 07:30) | 2 | 0 | 1 (4 h 50 min) | 1 |
| Rank Tracker (Mon 08:00) | 2 | 0 | 0 | **2** |
| Site Tracker (Mon 09:00) | 2 | 0 | 0 | **2** |
| AI Growth (Mon 09:30) | 1 | 0 | 0 | **1** |
| Content Cadence (Mon 10:00) | 2 | 0 | 0 | **2** |
| Link Builder (Mon 11:00) | 1 | 0 | 0 | **1** |
| Audit Scheduler (1st, 06:00) | 0 | — | — | — |
| AI Pulse (06:30 Tue–Sun) | 7 | 0 | 6 (18 min – 10 h 6 min) | 1 |
| Page Watch (daily 05:45) | 3 | 2 | 1 (137 min) | 0 |

No execution of any workflow ran from 2026-10-04 08:51 to 2026-10-08 00:51 UTC (Monday 10-05 missed by the whole instance). **What is
established** (executor C, from n8n 2.41.4's compiled Schedule node and the container's logs): a weekly interval of 1 is a plain cron
(`recurrence.activated: false`) — no stored state can suppress it; a cron is armed in memory and every restart re-arms it for the next
*future* time, so a fire that is due but not yet delivered when n8n restarts is lost — the 2026-10-12 deploy restart at 16:38–16:40 came
before the five delayed Monday fires. **Hypothesis** (fits six fires within a minute, two within 14 minutes and every miss, one
exception): the VM's timers stop while the Mac sleeps, so each fire is late by the sleep since the cron was armed. The app's admin
delivery-rate page is the only figure that shows this, but it counts 57 of its 72 "missed" fires from before the workflows existed and
leaves Page Watch out (R103).

### 2.23 Cost and the run ledger (all parts)

Every run reserved its ledger row on the main path before the first paid node and settled it; **no row was left `reserved`**. Every
DataForSEO figure a run measured equals the sum of its own task costs, each task once (window 1: −2.2% against the account). The engine
reports its own disagreement where it sees one (*"the account fell $0.7018 … while 10 settled run(s) report $0.5949 — they do NOT agree
… the account is the figure to believe"*). Wrong: R47 / R80 — Claude "measured" counts structured answers as the string
`"[object Object]"` (15–67% low); the Keyword Check books a fixed estimate and the Reply Reader no row. R81 — front-door rows duplicate the
monitors' rows ($2.89 of rows for $1.48 spent) and seven cost notes call long-finished runs "in flight". R82 — Site Tracker, Link Builder,
pulse Claude and the audit crawl are estimates or wrong. R68 / R69 — the full report's figures miss a Business Profile lookup and
understate the reviewer.

### 2.24 The web app (`parts/4`)

**A new customer's journey, in a real browser** (the repo's browser pass, phase 1, plus 24 pages × 1440 / 375 px × light / dark and 6
interactions — 107 visits): **0 console errors, 0 failed requests, 0 contrast failures, an h1 on every page**; 3 px of sideways scroll on
`/tools` at 375 px (R107). Sign-up, a 7-step onboarding, verification for a domain the account does not own (DNS: *"Could not read the
DNS records … (ENOTFOUND)"* — honest; meta tag: *"The … meta tag was not found on the homepage … Publish it inside <head>"* for a host
that does not resolve — R108), adding techand.ai refused (*"techand.ai is already verified by another company on this platform"*, 409),
27 "Show me how" guides with the site's own values and provider tabs, every form stating cost and time and the budget it leaves, the
monitors' estimated monthly cost ($12.58 / month for a new site).

Wrong in the app: R97 — the locked card tells an unverified customer that giving the service account Search Console access confirms
ownership; the server refuses that method. R98 — "Search Console, DNS or meta tag" offered where only two exist. R99 — two prices for one
run on one screen (the ladder form "about $1.23" beside "+$1.20 per page" and "plan $0.60"); 24 lines of hard-coded 2026-10-02 prices.
R100 — the pre-flight figure and the budget check use the shipped defaults while the engine reserves its calibrated figure (a page $0.84
vs $1.51). R101 — the describe estimate counts its key twice. **R102 (High)** — three old runs show a search-data-only figure as
"actual" (a written page "actual $0.0221"). R103 — the admin delivery rate counts fires from before each workflow existed. R106 — the
DNS table wraps two characters per line at 375 px. R109 — new customers see techand.ai's GA4 id, keyword and brand as placeholders.

**Reporting and delivery.** Every callback stage that has ever reached the app has its own renderer; none falls back to raw JSON.
**`report_deliveries` holds 0 rows, ever, for any company**: delivery is off for all 7 companies, and the dev server has no SMTP — the
only route by which any report has reached a person is a person opening the app. Share links: 10, all from one test company, all
revoked; none for techand.ai. The usage page counts only runs started from the app: 139 of the company's 154 October reports have no run
row. **This run's 24 reports as the app stored them** (`parts/4` part 4): all 24 landed (19:05:46–19:58:46); 23 were rendered through the
app's own report view server-side with no crash and no "undefined" / "NaN" (the page report 616 needs a browser API and was not
rendered); the audits (83 / 70 / 83), AI visibility (0%, 74 answers), the pulse (21), the site report (32 clicks / 5,308 impressions /
84 sessions), the rank history (14 rows), the ladder (4 rows) and every report's DataForSEO cost card agree with the n8n tables and the
ledger; the full report's "17 high" disagrees with its 14 stored High rows (R67) and the site report's "▼13" is R78.

Wrong: **R110 (High)** — **no monitor report can be delivered or shared as finished work**: the engine ends every monitor report with
`status: "progress"` and the app's delivery rule holds anything not completed (*"This run finished as "progress", not as a completed
report."*); a share link to one opens under *"This run did not produce a report"* — 13 of this run's 24 reports, 79 of the 178 in the
table; the "started" notes are held as rejected instead of interim; no delivery test covers `progress`. **R111 (High)** — **the
customer is told to publish pages the system marked "not ready to publish"**: `seo_content_log` stores the two failed drafts as
`written` with no quality state, so the site report's top action reads *"P1 Publish the written page for "ai consulting" … report the
link with "I published a page""*, the Rank Tracker says *"already written — publish it"*, and the cadence counts them as pages waiting
to be published. R112 — one backlinks report says "3 sites link to techand.ai" beside tiles "Referring domains 18" and "Spam score 63%
High" (DataForSEO's figures including the 17 link-farm sites the same report sets aside as "0 spammy"). R113 — the site report's
headline "Clicks from Google are up 52% to 32" ignores the test the payload carries (not significant, −12% to +164%). R114 — report
pages show only the DataForSEO cost, never the Claude part (e.g. $0.8933 on the page run), and monitor reports show no cost. R115 — for
AI visibility and backlinks started from the app, the app would record the DataForSEO money alone as the complete "actual" cost; pulse,
Link Builder, Rank Tracker, Site Tracker and describe callbacks carry no cost. R116 — the refused backlinks request leaves "Backlink check
started … ready in ~5 min" and nothing more; the refused run ends `success`, so the app's failure watcher sees nothing (the engine side
is R77).

---

## 3. Defects found by this run (R34–R116)

Numbering continues from R33. "Part id" is the id inside the part files. Severity: **High** = wrong advice or a wrong number shown to a
customer, or a feature that does not run; Medium = misleading, or missing something the run claims; Low = cosmetic or cost-only.

| Id | Part id | Sev. | Area | What is wrong (evidence in the part) |
|---|---|---|---|---|
| R34 | A-1 | **High** | ladder / content | Ladder plans 3 new AI-consulting pages and writes one; the site has a live "AI Consulting & Copilot Advisory UAE" page (inventory title empty) |
| R35 | A-2 | **High** | keywords | Discover says 20 pages "do not target this search" for searches they plainly target (literal-token matching) |
| R36 | A-3 | **High** | keywords | Discover recommends new pages for searches an existing page already ranks for (#6.2), without naming it |
| R37 | A-4 | **High** | content | Page QA masks correctly sourced figures (40% / 27%) and tells the owner the source does not carry them |
| R38 | A-5 | **High** | keywords | Verdict says the customer's page has no mandate dates, tables or author; it has all three |
| R39 | A-6 | Medium | ladder | Supply-chain rung and "openai consulting" on an AI-consulting ladder |
| R40 | A-7 | Medium | ladder | Keywords with no SERP overlap merged "by topic label" |
| R41 | A-8 | Medium | ladder | Two traffic figures for the head term in one report (12 vs 6) |
| R42 | A-9 | Medium | ladder / cadence | 6th active ladder against `max_active` 2 and a 4th unpublished page against `max_waiting` 3, unmentioned |
| R43 | A-10 | Medium | content | Coverage refusal reports present words as missing; the editor's cut caused the failure (90% → 60%) |
| R44 | A-11 | Medium | content / ladder | Coverage targets / subtopics from an ad banner and a listicle's competitor entries |
| R45 | A-12 | Medium | content | `placeholder_count: 0` while five brackets remain |
| R46 | A-13 | Low | content | "The editor had 2 round(s)"; one ran, two priced |
| R47 | A-14 | Medium | cost | Claude "measured" counts structured answers as `[object Object]` (4–6 tokens); Keyword Check books a fixed estimate; Reply Reader no ledger row |
| R48 | A-15 | Low | keywords | "FTA-accredited ASP" (ASPs are accredited by the Ministry of Finance) |
| R49 | A-16 | Medium | keywords | "Good 50-70%" chance on a reach with no measured ranking |
| R50 | A-17 | Medium | keywords | Keyword Check silent that the keyword already heads a ladder / has a page |
| R51 | A-18 | Medium | keywords | "Where to start" is a falling, off-industry keyword its own follow-up advises against; two SERP reads 53 s apart disagree, unmentioned |
| R52 | A-19 | Low | site model | describe: wrong nav-page titles, headings mixed into facts |
| R53 | A-20 | Low | content | Ladder row `writing` vs content log `written` |
| R54 | A-21 | Low | cost | SERPs bought before the relevance filter |
| R55 | A-22 | Low | keywords | Mixed hosts in discover's Search Console rows |
| R56 | A-23 | Low | keywords | "Answered by" the blog index instead of its article |
| R57 | A-24 | Low | cost | Rejected Strategy Brief re-asked; not in the cost |
| R58 | A-25 | Medium | keywords | "Build first" puts first a topic the report says to leave to a ladder |
| R59 | B-1 | **High** | technical audit | First-ranked "not indexed … cannot rank" finding is a host split (pages earn impressions on the bare host) |
| R60 | B-2 | **High** | full report | Keyword research from generic headings, no brand / government gate ("ai mode", "blackbox ai", "mofa attestation dubai", "vat", "trn"); AI question off-market |
| R61 | B-3 | **High** | full report | "Does not rank in Google's top 10 for any keyword" vs 15 Search Console queries ≤ 10 and "Ranks #1 for its brand name" |
| R62 | B-4 | Medium | technical audit | Hex entities not decoded → false render-diff finding and false content-review finding |
| R63 | B-5 | Medium | technical audit | Two 308 redirect responses counted as pages → 5 false findings, 47 instead of 45 |
| R64 | B-6 | Medium | technical audit | Extra crawl reports requested without the task id ("Task Not Found"); redirect chains never read |
| R65 | B-7 | Medium | technical audit | Impact uses site-average estimates for pages the run measured |
| R66 | B-8 | Medium | app | App's technical page compares a full report with a technical audit (25 "new") — from code and rows |
| R67 | B-9 | Medium | full report | Stored audit row's severity counts disagree with its stored findings |
| R68 | B-10 | Low | cost | First Business Profile lookup missing from the cost; a definitive "no results" paid twice |
| R69 | B-11 | Low | cost | Content Reviewer's answer counted as 5 tokens |
| R70 | B-12 | Low | cost | Competitor discovery paid and discarded when competitors are named |
| R71 | B-13 | Low | technical audit | `<u>` flagged as deprecated |
| R72 | B-14 | Low | technical audit | "1 of 47 pages (20%)" |
| R73 | B-15 | Low | lineage | Lineage rows that do not match the report |
| R74 | B-16 | Low | full report | One-day SERP swing on the brand query called "fixed" |
| R75 | B-17 | Low | pre-release | Staging wording on a production check |
| R76 | B-18 | Medium | full report | AI review says "no badges" where the homepage shows a Microsoft Partner badge |
| R77 | C-1 | **High** | backlinks / ops | The app's full backlinks request refused by its own parent run's ledger row (a sub-second race); customer left with "started" only |
| R78 | C-2 | **High** | site tracking | Weekly report compares a full report with a technical audit (▼13) and a full backlink snapshot with a free one (▲18) |
| R79 | C-3 | Medium | ops | One stale alert re-sent to the owner's Slack on every run (12 times in this run); its row never updated (key trimmed vs stored with a trailing space); Error Handler runs the retry twice |
| R80 | C-4 | Medium | cost | Same as R47 on the monitor wave: AI visibility 34% low, Link Builder 46% low |
| R81 | C-5 | Medium | cost | Front-door ledger rows duplicate monitor rows ($2.89 for $1.48 spent); finished runs called "in flight" |
| R82 | C-6 | Low | cost | Site Tracker, Link Builder, pulse Claude, audit crawl: estimates or wrong |
| R83 | C-7 | Medium | AI visibility | Recommends pitching businesses AI names instead of the customer; keeps them as link prospects |
| R84 | C-8 | Medium | AI visibility | Denominators described wrongly; AI Overview presence counts a failed request as "no AI Overview" |
| R85 | C-9 | Low | AI visibility | AI volume lookup failed twice, undisclosed |
| R86 | C-10 | Medium | link building / backlinks | Direct competitors treated as link opportunities (a held draft, a `ready` qualification at 0.87, service pages read as lists) |
| R87 | C-11 | Medium | rank tracking / cadence | "e invoicing in uae" set aside and pursued in the same run |
| R88 | C-12 | Medium | rank tracking | Two movement figures for one keyword; identical requests 32 s apart differ, unlabelled |
| R89 | C-13 | Medium | site tracking | Brand split counts "tech" as the brand |
| R90 | C-14 | Medium | ladder / rank tracking | "facts erp" (another company's brand) still planned and printed |
| R91 | C-15 | Low | rank tracking | "top 100" vs "top 50" |
| R92 | C-16 | Low | several | Anchor table, duplicate "/" rows, "countrys", contradictory page status, fragment URLs watched, pages stored under both hosts |
| R93 | C-17 | Low | link building | Wording errors in Claude output |
| R94 | C-18 | **High** | ops | Five of ten schedules never fired on their own; the rest late; restarts discard due fires |
| R95 | C-19 | Low | AI pulse | An on-demand pulse overwrites the day's scheduled reading |
| R96 | C-20 | Low | ops | A refused run takes 5 min 33 s to do nothing |
| R97 | D-1 | Medium | app | Locked card names a verification method the server refuses |
| R98 | D-2 | Low | app | A third verification method offered where two exist |
| R99 | D-3 | Medium | app | Two prices for one run on one screen; 24 hard-coded prices |
| R100 | D-4 | Medium | app / cost | Pre-flight and budget use shipped defaults; the engine reserves its calibrated figure (page $0.84 vs $1.51) |
| R101 | D-5 | Low | cost | Describe estimate counts its key twice |
| R102 | D-6 | **High** | app / cost | Old runs show a search-data-only figure as "actual" (a written page "actual $0.0221") |
| R103 | D-7 | Medium | app / ops | Admin delivery rate counts fires from before each workflow existed; Page Watch not measured |
| R104 | D-8 | — | ops | (the same defect as R94, seen from the app's admin figures) |
| R105 | D-9 | Medium | ops | Alerts reached the webhook 54–63 h late; one failed on e-mail with no webhook attempt; `channels` stale |
| R106 | D-10 | Low | app | DNS table wraps two characters per line at 375 px |
| R107 | D-11 | Low | app | 3 px overflow on `/tools` at 375 px |
| R108 | D-12 | Medium | app | Meta-tag check says "not found, publish it" when the homepage could not be read |
| R109 | D-13 | Low | app | Another customer's GA4 id, keyword and brand as placeholders |
| R110 | D-14 | **High** | reporting | No monitor report can be delivered or shared as finished work: the engine marks them `progress`, the delivery rule holds anything not completed (79 of 178 reports); started notes held as rejected |
| R111 | D-15 | **High** | content / site tracking | The customer is told to publish pages the system marked "not ready to publish" (content log stores them as `written` with no quality state) |
| R112 | D-16 | Medium | backlinks | One report: "3 sites link" beside "Referring domains 18" and "Spam score 63% High" (index figures including the farm sites it set aside) |
| R113 | D-17 | Medium | site tracking | Headline "Clicks up 52% to 32" ignores the payload's own non-significant test |
| R114 | D-18 | Medium | reporting / cost | Report pages show the DataForSEO cost only, never Claude; monitor reports show no cost |
| R115 | D-19 | Medium | cost | App-started AI visibility / backlinks would record DataForSEO alone as the complete "actual" cost; several callbacks carry no cost |
| R116 | D-20 | Medium | reporting | A refused request leaves the customer with "started … ready in ~5 min" and nothing more; the failure watcher sees a `success` |

**Fourteen High** (R34, R35, R36, R37, R38, R59, R60, R61, R77, R78, R94, R102, R110, R111).

---

## 4. What this run cannot prove

- **Outcomes of published pages.** Nothing the system wrote has been published (4 pages wait), so no page's ranking, traffic or links
  can be measured; criteria that score those outcomes have no evidence.
- **The weekly loop on a host that does not sleep.** The run used on-demand starts. The schedule history (§2.22) shows what the loop has
  actually done on this host; how it would behave on an always-on host is not observable here.
- **The app inside the owner's company**, report delivery to a person, share links of techand.ai's reports, and the platform admin page
  (no session; delivery off; no SMTP).
- **Anything that needs the owner's data**: the AI fact check and E-E-A-T bylines (no business profile), the style guide, the
  check-in, outreach sending and replies (no mailbox), Google sign-in / "Verify with Google" (not configured).
- **AI Growth's current code path** (not run, §2.20).
- **Calibration of the chance bands** (no history of the system's own pages to calibrate against).

## 5. State left behind

- **New ladder `lad_mv9wshpdy2jf` "ai consulting dubai"**: 4 `seo_ladders` rows and an `active` `seo_ladder_settings` row; its rung-1
  page is a `written`, not-ready draft in `seo_content_log`. The site now has **4 written, unpublished pages**, so the cadence pauses
  itself on the pile-up guard. Given R34 / R39 / R42 the owner may want to pause or delete this ladder.
- `seo_run_ledger` rows 79–102, none `reserved` (row 92 `refused`); run 595 marked nine 2026-10-14 rows `stale`.
- `seo_audits` +3 (technical ×2, full ×1) with their findings; `seo_ai_answers`, `seo_ai_visibility`, `seo_ai_daily` (the 2026-10-15 row
  now holds the on-demand pulse), `seo_link_prospects` (+6 new, 160 for the site), `seo_link_outreach` (4 held drafts — none sent),
  `seo_backlinks`, `seo_backlink_snapshots` (+1 full), `seo_listings`, `seo_link_impact`, `seo_rank_history` (+14), `seo_query_history`,
  `seo_site_metrics`, `seo_pages`, `seo_page_watch`, `seo_cache` (cost calibration rows, sitemap fingerprint).
- `seo_ops_alerts` row 5 (this run's test alert, delivered); **row 4 is still `failed` and will be re-sent to the owner's Slack by every
  run until the defect R79 is fixed or the row is closed by hand.** The owner's Slack received the test alert once and the old alert 12
  times during this run; the ops mailbox received the test alert once.
- The app: 24 `reports` rows for Techand Test Co (with their PDFs / Word files / images); one new test account, company "Northwind
  Trading" (`15b2c553-…`) and an **unverified** site `rr1015-newcustomer.example.com` from the browser pass.
- The Test Runner is **inactive**. Nothing was published, submitted, sent or deployed.

## 6. Artefacts

Run artefacts are in `files/` (git-ignored: they hold third-party pages and contact details and the repository is public; re-create
them with a live re-run): every execution of the run (`exec-594.json` … `exec-643.json`), every report the app received
(`report-<id>.json`), the written page (`A-page-616.*`), the audits' findings, diffs, fix packs and documents (`B-*`), the monitors'
reports and plans (`C-*`), the schedule evidence (`C-schedule-*.json`, `C-pmset-intervals.json`), the browser pass screenshots
(`ui/`), and the balance probes and every request sent (`spend.jsonl`, `starts.jsonl`).
