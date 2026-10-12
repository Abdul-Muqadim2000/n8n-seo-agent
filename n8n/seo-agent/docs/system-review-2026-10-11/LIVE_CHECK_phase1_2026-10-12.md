# Phase 1 live checks — techand.ai, 2026-10-12

Live runs on the owner's site after the Phase 1 deploy (06:17 UTC). Started 06:24 UTC, finished 06:59 UTC, before the Monday
schedules (first one 11:00 UTC). Every API run was sent the way the web app sends it (header `X-Forwarded-For: app:<techand.ai
company>` and the company's app callback), so every report landed in the app's `reports` table. The Audit Scheduler and the Rank
Tracker were started through the Test Runner (activated for the test and deactivated again). No code, workflow, prompt or table
column was changed. No e-mail went to anyone, no page was published, no profile / check-in / published row was written.

**Spend: ≈ $1.9, against a $3.00 cap** (estimate was ≈ $2.0).

| | Amount | How it was measured |
|---|---|---|
| DataForSEO | **$1.07** | Balance $22.3430 at 06:22 UTC, $21.2772 at 07:00 UTC (probed from inside the n8n container). The runs' own ledgers add up to $1.17 plus ≈ $0.07 for the Rank Tracker's 7 SERP checks (no ledger). |
| Claude | **≈ $0.79** | Token counts × the prices used in RESULTS §0 (Opus $4 / $20, Sonnet $2 / $10, Haiku $1 / $5 per million). $0.49 from reported usage; the page run's three Opus nodes stream and report only estimates (≈ $0.30, thinking tokens may be missing). The guard's own estimates for the same runs come to $2.80. |

**Deviation from the plan:** the brief asked for a ladder with `pages_now: 0` (no page). That value is invalid everywhere (API
400 "pages_now must be 1, 2 or 3", app schema `min(1)`, *Normalize Input* clamps to 1), so the ladder ran with `pages_now: 1` and
wrote its first rung page (+ ≈ $0.46, 12.8 min). The ladder is paused (see §5). FIX_PLAN §5.1 should say `pages_now: 1`.

## 1. Runs

All times UTC. "API" is the front door's webhook execution, "run" the execution that did the work. DataForSEO from the runs'
ledgers (measured total above), Claude from token counts.

| # (RESULTS §1) | What | Executions (API → run) | Start–end | Duration | DataForSEO | Claude | Status |
|---|---|---|---|---|---|---|---|
| 1 | Balance before | — | 06:22:25 | — | — | — | $22.3430 |
| 3 ×8 | `describe` ×8 in parallel (D1) | 394–401 → 402–409 | 06:24:48–06:25:17 | 23–26 s each | 0 | 0.046 (8 × 0.0057) | completed ×8 |
| 8 | `audit` technical, 200 pages | 410 → 411 | 06:26:38–06:30:55 | 4.3 min | 0.090 | 0 | completed, health 83 (raw 83) |
| 14 | `audit` Full SEO Report | 412 → 413 | 06:26:40–06:37:02 | 10.4 min (3 runs in parallel) | 0.455 (no WHOIS line) | 0.051 | completed, health 69 (raw 69) |
| 13 | `backlinks` full | 414 → 415 → 418 | 06:26:40–06:27:27 | 47 s | 0.372 | 0 | delivered, mode full |
| 4 | `verdict` "e invoicing software uae" | 416 → 417 | 06:26:41–06:30:33 | 3.9 min | 0.022 | 0.110 | GO_WITH_CHANGES 58, 8 months |
| 11 | Reply Reader ×4 (empty facts) + 1 (facts) | 419–423 | 06:27:16–06:27:38 | 2–7 s each | 0 | 0.016 | 200 ×5 |
| 21 | Audit Scheduler on demand (Test Runner) → technical audit | 424 → 425 → 427 | 06:38:24–06:42:38 | 4.2 min | 0.090 | 0 | completed, health 83, `scheduled: true` |
| 6 | `ladder` "dynamics 365 partner uae", pages_now 1 | 428 → 429 | 06:42:52–06:46:11 | 3.3 min | 0.119 | 0.130 | Short plan, reach 10, 4–8 months |
| 7 | → its rung-2 page "vendor invoice automation dynamics 365" | 430 | 06:46:10–06:58:58 | 12.8 min | 0.022 | ≈ 0.44 | completed, content score 78, QA "5 items to review", 1,578 words |
| 18 | Rank Tracker (Test Runner) | 431 → 432 | 06:47:20–06:47:38 | 17 s | ≈ 0.07 (7 checks, 11 deferred) | 0 | 4 ladder reports |
| — | Balance after | — | 07:00:13 | — | — | — | $21.2772 |

All 39 executions of the day succeeded (public API, no `status=error`). 20 callbacks landed in the app's `reports` table
(8 site_description, backlinks_started + backlinks, 2 content, 2 site_audit, full_report, ladder_plan, 4 rank_tracker).

## 2. Items

| Item | Result | Evidence |
|---|---|---|
| D1 | **pass**, residual P1-1 | 8 `seo_run_ledger` rows (ids 1–8) for execs 402–409, every run loaded all 8 and reported `run_number_today` 1…8 in row-id order (`ai_budget_used_est_usd` 0.06 … 0.48). Long runs settle: rows 9, 10, 12–15 (411, 413, 417, 427, 429, 430) `done` with `settled_usd` 0 / 0.25 / 0.23 / 0 / 0.58 / 1.20. The "temporary limit of 5 → 3 refused" case needs a config change and was not run (harness S31 covers refusal order). |
| D2 | **pass** | Technical audit 411: "2 fixed · 1 new · 26 still open (compared with the technical audit of 2026-10-11)" (previous `aud_mv40zsz7lmm`, site_audit, 80 → 83). Full report 413: "… (compared with the full SEO report of 2026-10-11)" (previous `aud_mv40sm450bi`, full, 68 → 69), never the technical audit of 06:30. Audit Scheduler's audit 427: "0 fixed · 1 new · 26 still open (compared with the technical audit of 2026-10-12)" (previous `aud_mv4vidibjos` = run 411, 83 → 83), not the full report of 06:36. Rows store `report_type` (site_audit / full / site_audit). |
| D3 | **pass**, residual P1-2 | Exec 418: 15 pages with path `/all/2835/13.html` have `link_type spam`, SEO and brand value 0, reason "link farm: the same page path on 15 sites"; seonix.agency labelled spam by the Link Analyst; alert "16 link(s) from link farms / PBN pages set aside". Disavow candidates: 16 domains. Best links (`values.best_seo`): peppol.org 35 / 25 / 44, only entry; `at_risk []`, `important_lost []`, `wins []`. |
| D4 | **pass** for the gap, residual P1-4 | Exec 413 `site_keywords.keyword_gap` (25): value-added tax, vat, company tax uae, corporate tax uae … e invoicing; `refused` (40): 29 navigational, 10 government, 1 portal — "fta login" (navigational), "fta" / "emirates id" / "emirates id status" (government: "a public body or an identity document, not a topic"), "emaratax" (navigational). Report: "Left out of the gap on purpose: 40 searches for government portals, logins or other companies' brands". |
| D6 | **pass** | 411 / 413 / 427: no "www and non-www" finding (29 / 61 / 29 findings). What works: "One canonical host: https://techand.ai redirects (308) to https://www.techand.ai, and the canonical tags agree". `canonical_host` www.techand.ai. |
| D7 | **pass** (cache path) | 413: *RDAP Lookup*, *RDAP Results*, *Need WHOIS?*, *DataForSEO Whois* not run; *Domain Ages* `looked_up 0, whois_requests 0`, all three ages "whois, stored 2026-10-11" (`seo_cache age:`); run ledger $0.455 with no WHOIS line (2026-10-11: $0.821 incl. $0.36 WHOIS). The RDAP parser itself was not exercised live (every domain was cached); harness S31 covers it. |
| D8 | **pass** (gate not triggered) | Ladder 429: rungs "vendor invoice automation dynamics 365", "dynamics 365 field service features", "dynamics 365 service description", main = existing /dynamics-365-crm-uae; `refused_keywords []`, `excluded_keywords []`. *Ladder Pool* carried 24 other-brand labels (azdan, dynamicsstream, terracez, cynoteck, dynamics.ae, dynatechconsultancy, SAP, Zoho, Tally, ClearTax …) and rightly kept the "dynamics 365 …" keywords (head tokens). No brand keyword was in the 9-keyword pool, so the refusal path only ran in the harness (S34, "facts erp"). |
| D14 | **pass** | Execs 419–423. The accreditation question with empty facts: `class question`, `needs_you true`, suggested reply "[Owner: confirm whether Tech& is accredited with the Ministry of Finance or works through a partner, and provide a 2-line company description] …" — no unbracketed claim; `unverified []` because the model bracketed it itself. Opt-out → unsubscribe; out-of-office → return date 2026-10-19 + referral read; "done" with the peppol.org URL → `says_linked`, `link_found true` (follow, content). With `business_facts` stating the accreditation: "Tech& is an accredited service provider (ASP) for e-invoicing with the UAE Ministry of Finance" unbracketed, only the description request bracketed. |
| D16 | **pass** | Exec 432: "peppol uae" → `publish_top`: "The main page "peppol uae" is written but not live yet: publish it at https://techand.ai/peppol-uae/. Nothing climbs until it is published." "erp software uae" (Direct) → the same publish step "… and its supporting pages wait for it" (no "work on rung 1"). "e invoicing in uae" (full plan, main page planned) → "Work on rung 1 … "uae e invoicing penalties" (already written — publish it) …". New ladder → "Work on rung 2 …", main page live (existing URL). |
| D17 | **pass** | Fix pack robots.txt = the live file (User-Agent *, Allow /, Disallow /api/ /admin/ /private/, Host, Sitemap) plus two comment lines "# Changes: none needed"; README: "Keep /robots.txt as it is (no change needed; this copy only adds a comment on top)". No AI-bot group (nothing blocks those bots). |
| D18 | **pass** | No "Duplicate meta tags" finding in 411 / 413 / 427. What works: "No duplicate meta tags on the homepage (the crawler counted tags that differ only by a media attribute, such as theme-color for light and dark)". DataForSEO still reports `duplicate_meta_tags: ["theme-color"]` per page; ignored. |
| D24 | **partial**, P1-3 | Author finding once ("Articles have no named human author", High; no duplicate titles among 61 findings; the other two mentions are the diff table and the summary list). Cap: `score_cap null`, raw = shown (83 / 69); the only "capped at" text is the methodology note. Scraper queries: **fail** — `scraper_queries.count 0` while 4 of the 10 top queries are scraper queries (see P1-3). |
| D26 | **pass** | Verdict 417: "An AI Overview was seen in the check at 06:27 UTC on 2026-10-12, citing tax.gov.ae and vendor pages. It is one observation …"; digest "AI OVERVIEW: seen in the check at 06:27 UTC … AI Overviews vary between searches, so this is one observation, not a fixed feature of the query". Ladder 429: "… cited in the AI Overview seen in the check at 06:43 UTC on 2026-10-12". "seen in N of M checks" not exercised (one check per run). |
| G3 | **pass** (ladder) | Ladder report: "Estimated chance of reaching the top 10 within 4-8 months: fair (30-50%) — an uncalibrated estimate until this system has measured its own ladders. Base rate (Ahrefs, 2025): only 1.74% of new pages reach Google's top 10 within a year, and 40.8% of those do so within a month"; `chance {band fair, range [30, 50]}`, `base_rate {year 2025, 1.74, 40.8}`. The verdict prompt cites the same 2025 base rate; the verdict report itself shows "Time to rank 8 months" with no base rate or band (observation, below). |

## 3. New defects

- **P1-1 · Short runs never settle their ledger row.** The 8 `describe` rows and the backlinks hand-off row (415) stay `status reserved`, `settled_usd 0`, at their estimates ($0.06 each for describe, real ≈ $0.006; $0.04 for backlinks) after the runs completed. *Settle Run Ledger* is wired only after *Build Word File*, *Build Audit Report*, *Build Full Report*, *Build Keyword File* and *Build Ladder Report*. Effect: the day's used estimate over-counts (8 describes = $0.48 of the $6 budget; safe direction) and those rows never carry a real cost. Where: `build_v4.py` (ledger wiring, §D1): settle after *Build Describe Response* / *Has Callback?*, after the backlinks / AI-visibility hand-offs and the profile / published / check-in / case-study ends. Evidence: `seo_run_ledger` rows 1–8, 11.
- **P1-2 · Link-farm pages still drive the "lost" table and the referring-sites alert.** Exec 418 `lost` holds the 13 cluster pages (reason `link_removed`); the report's "Links lost (confirmed by two checks)" table lists them with "Ask the editor to restore it (draft below)", and the medium alert "Referring sites (all sources) fell from 17 to 4" is the cluster disappearing. `important_lost`, `at_risk`, `wins` and `rel_changed` already exclude `spamSet`. Where: `v5/code/Parse_Backlinks.js` — exclude `spamSet` from `lost` / `reclaim` and from the referring-sites drop alert (or word the alert "13 link-farm pages dropped"). Evidence: exec 418 *Parse Backlinks* `lost`, *BL Report* html; `files/phase1-live-2026-10-12/backlinks-parse-2026-10-12.json`.
- **P1-3 · Scraper-query detection misses the real queries.** 4 of the 10 top Search Console queries in both audits are scraper queries: `"dynamics 365" ("customer" or "client") … -webinar -guide`, `"uae federal tax authority" -site:csc.gov.ae -site:facebook.com …`, `("administrative and financial" or …) and ("cheque" or …)`, `("electronic invoicing" or …) and (…)`. `scraper_queries.count` is 0 and they are printed in the "Top query" table. Cause: `OPERATOR` requires `(^|\s)` before `site:` (so `-site:` fails) and the quoted + `AND|OR` rule is case-sensitive (Search Console lowercases queries). Where: `v5/code/GSC_Audit_Findings.js` l.66–67 — allow `-` before an operator, case-insensitive and/or, and treat parenthesised quoted groups as operators. Evidence: exec 411 / 413 `search_console.top_queries[5..8]`; `files/phase1-live-2026-10-12/site-audit-run410-2026-10-12.txt`.
- **P1-4 · The intent "opportunities" still recommend the government portals and other brands.** The full report's §4a "Keyword Opportunities by Search Intent — Navigational Keywords (people looking for a specific brand or website)" lists fta login (90,500), emaratax, emaratax login, check emirates id status, vat tax login, fta portal, emaratax portal, i d card status, mofa attestation uae, fta uae as "searches to target", and the informational table lists other brands (character ai, google ai, meta ai, blackbox ai, humanize ai, ai mode). The fit gate runs on `keyword_gap` only; `opportunities_by_intent` (and `easy_wins`) are not gated, and the finding "No rankings for navigational searches" counts the same terms. Where: node *Analyze Keywords* (v3 code patched in `build_v4.py`), `opportunities_by_intent`; *Build Full Report* §4a. Evidence: exec 413 `site_keywords.opportunities_by_intent.navigational`; `files/phase1-live-2026-10-12/full-report-run412-2026-10-12.txt`.
- **P1-5 · Raw float CPCs in the full report's Word file.** §4a prints 11 unrounded CPCs (8.84000015258789, 10.789999961853027, 4.170000076293945 …). The keyword-ideas renderer rounds them since 2026-10-09; the intent tables do not. Where: *Build Full Report* (`build_v4.py`). Evidence: the same text file.

Observations (not defects): the diff marks the two retired false positives ("www and non-www …", "Duplicate meta tags …") as "fixed", although the site did not change — a "no longer flagged (check changed)" state would be more honest. The verdict report shows the month count only (8 months), the base rate and chance band appear in ladder reports only. The written rung page again carries 23 placeholders ([Price] ×?, [Timeline], [Microsoft Learn]) and QA did not pass (5 items to review) — D10, Phase 2. The ladder page wrote no `seo_content_log` row — D5, Phase 2. The backlinks run had no Link Analyst call (Claude 0): nothing new to label.

## 4. Spend

DataForSEO $1.07 measured (balance $22.3430 → $21.2772); Claude ≈ $0.79 (reported tokens $0.49 + the page run's streamed Opus
estimates ≈ $0.30). Total ≈ $1.9 of the $3.00 cap. The largest items: the full report ($0.46 + $0.05), the backlinks check ($0.37),
the ladder with its page ($0.14 + ≈ $0.57).

## 5. State left behind

- **New ladder** `lad_mv4vxu3bq0kl` "dynamics 365 partner uae" (Short plan, priority 4, mode auto): 4 rows (rung 2: "vendor invoice
  automation dynamics 365" `writing`, "dynamics 365 field service features", "dynamics 365 service description" planned; rung 4
  main page = the existing /dynamics-365-crm-uae). Its `seo_ladder_settings` row (id 5) is **paused** (set through the Data Table
  API at 06:47 UTC), so the Monday cadence writes nothing for it. The rung-2 page is written (exec 430, content score 78, QA
  5 items, 1,578 words, 23 placeholders) and delivered to the app as a `content` report (request 428); not published anywhere.
- Test Runner **deactivated** (`active: false`). Reply Reader still active and Link Builder still on for techand.ai (as left on
  2026-10-11).
- Data: 3 new `seo_audits` rows (`aud_mv4vidibjos` technical 83, `aud_mv4vq4wm0sx` full 69, `aud_mv4vxfwrhi1` technical 83
  scheduled) and their findings; `seo_run_ledger` 15 rows (9 `reserved`, 6 `done`); a full `seo_backlink_snapshots` row; in
  `seo_backlinks` 13 link-farm rows moved from `at_risk` to `lost` (second miss), 2 still `at_risk`; 7 new `seo_rank_history`
  rows; the verdict / ladder caches. 20 reports and their files in the app (company "Techand Test Co").
- Artefacts (git-ignored `files/phase1-live-2026-10-12/`): `reply-reader-tests-2026-10-12.json`, `backlinks-parse-2026-10-12.json`,
  `disavow-candidates-techand-ai-2026-10-12.txt`, `fix-pack-robots-2026-10-12.txt`, `full-report-keyword-gap-2026-10-12.json`,
  `technical-audit-site-issues-2026-10-12.json`, `full-report-site-issues-2026-10-12.json`, `verdict-e-invoicing-software-uae-2026-10-12.json`,
  `ladder-plan-dynamics-365-partner-uae-2026-10-12.json`, `rank-tracker-2026-10-12.json`, `spend-2026-10-12.json`,
  `vendor-invoice-automation-dynamics-365-2026-10-12.md`, the delivered Word files and their text (`site-audit-run410`,
  `full-report-run412`, `site-audit-scheduler`, `ladder-plan-dynamics`, `verdict-e-invoicing`).
- Not exercised: D1's "temporary limit of 5" refusal (config change), D7's RDAP parser (every domain cached), D8's brand refusal (no
  brand keyword in the pool), D26's "seen in N of M checks" (one check per run), the verdict's base-rate text (ladder only).
