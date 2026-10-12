# Phase 3 + Phase 4 live checks — techand.ai, 2026-10-12

Live runs on the owner's site after the Phase 3 / Phase 4 deploy (main workflow 434 nodes, every workflow re-imported 16:45–16:46
UTC). Started 16:57 UTC, finished 19:22 UTC. Every API run was sent the way the web app sends it (header `X-Forwarded-For:
app:<techand.ai company>`, the company's app callback), so every report landed in the app's `reports` table. The Site Tracker and the
AI Growth run were started through the Test Runner (activated 17:02, **deactivated again** 19:22). No code, workflow, prompt or table
column was changed. No outreach e-mail left the machine (the Link Builder only drafts, and every draft was held), no page was
published, no profile / check-in / published row was written, no ladder was created, no Site Admin action was run.

**Spend: ≈ $2.49, against a $3.50 cap** (estimate was ≈ $3.0).

| | Amount | How it was measured |
|---|---|---|
| DataForSEO | **$2.0220** | Balance $20.887764 at 16:57:04 UTC, $18.865792 at 19:22:48 UTC, probed from inside the n8n container. Per step (balance deltas): describe + Keyword Check + the start of discover $0.224, discover to the end $0.036, the keyword-report follow-up + the two cancelled audits + the Site Tracker $0.104, technical audit (retry) $0.032, full report (retry) $0.400, `ai_visibility` $0.803, backlinks full $0.373, Link Builder $0.050, AI Growth $0. |
| Claude | **$0.4640** | Reported token usage of every `Claude — …` node of the 29 executions × the RESULTS §0 prices (Opus $4/$20, Sonnet $2/$10, Haiku $1/$5 per million): 83,986 in / 29,601 out, all Sonnet. **No streaming Opus node ran** in this check (no content run), so this figure has no hidden part. The guard's own estimates for the same runs total $1.24. |

Today's scheduled runs (AI Visibility 11:25, Backlink Monitor 16:19, ≈ $0.244) ran **before** the deploy and are not part of this
figure or of the evidence below.

## 1. Runs

All times UTC. "API" is the front door's webhook execution, "run" the execution that did the work.

| # (RESULTS §1) | What | Executions (API → run) | Start–end | Duration | DataForSEO | Claude | Status |
|---|---|---|---|---|---|---|---|
| — | Balance before | — | 16:57:04 | — | — | — | $20.887764 |
| 3 | `describe` | 452 → 453 | 16:57:09–16:57:52 | 41 s | — | 0.023 | completed, 5 nav pages read, 28 services |
| 5 | Keyword Check "business central partner uae" | 454 | 16:58:45–16:58:57 | 12 s | 0.026 (own ledger) | 0.014 | 200, **fit 2** |
| 9 | `discover` | 455 → 456 | 16:59:14–17:01:00 | 1.8 min | ≈ 0.23 | 0.152 | completed, 695 keywords, 180 relevant |
| 10 | keyword-report follow-up "erp system" (spawned by discover) | 457 | 17:00:58–17:03:01 | 2.1 min | ≈ 0.04 | 0.069 | completed |
| 8 | technical audit, 200 pages (1st try) | 458 → 459 | 17:02:41–18:34:03 | 91 min | ≈ 0.03 | 0 | **cancelled** at the execution timeout (JS task runner stalled 17:30; P34-5) |
| 14 | full SEO report, 200 pages (1st try) | 460 → 461 | 17:02:44–18:33:59 | 91 min | ≈ 0.03 | 0 | **cancelled**, same cause |
| 20 | Site Tracker (Test Runner) | 462 → 463 | 17:02:54–17:30:06 | 27 min | ≈ 0.03 | 0 | completed, 862 Search Console rows, 45 pages |
| — | Error Handler ×2 for the two cancellations | 464, 465 | 18:34:02–18:34:08 | 6 s | — | — | completed, ops mail **accepted** by Gmail this time |
| — | Console Alerts (schedule) | 466 | 18:50:03 | 1 s | — | — | completed |
| 8 | technical audit, 200 pages (retry) | 467 → 468 | 18:51:31–18:55:25 | 3.9 min | 0.032 | 0 | completed, health 83 "Good", 27 findings |
| 14 | full SEO report, 200 pages (retry) | 469 → 470 | 18:55:37–19:06:24 | 10.8 min | 0.400 | 0.049 | completed, health 70, 50 findings |
| 12 | `ai_visibility` | 471 → 472 → 473 | 19:07:19–19:09:48 | 2.5 min | 0.803 | 0.106 | completed, 8 questions × 6 engines |
| 13 | backlinks, full | 474 → 475 → 476 | 19:11:52–19:12:32 | 40 s | 0.373 | 0 | completed, mode `full` |
| 15 | Link Builder, paid, on demand | 477 → 478 | 19:14:35–19:16:29 | 1.9 min | 0.050 | 0.052 | completed, 16 qualified, 6 drafts (all held) |
| 17 | AI Growth (Test Runner) | 479 → 480 | 19:18:18–19:19:01 | 43 s | 0 | 0 | completed, 12 pages scored, 2 sent to Bing |
| — | Balance after | — | 19:22:48 | — | — | — | $18.865792 |

29 executions, **27 succeeded**; the only failures are 459 / 461, both cancelled by the 90-minute execution timeout after the n8n
JavaScript task runner stopped answering (P34-5) — not a defect of the SEO code: re-run one at a time, both finished. 10 callbacks
landed in the app's `reports` table (`site_description`, `keyword_strategy`, `content` = the keyword report, `site_tracker`,
`site_audit`, `full_report`, `ai_visibility_started` + `ai_visibility`, `backlinks_started` + `backlinks`, `link_builder`,
`ai_growth`). No run row exists for them in the app (the runs were sent to n8n directly, as in the Phase 2 check), so the monitor
callbacks are stored with their own `status` (`progress`) — the report rows and files are complete.

## 2. Items

### Phase 3

| Item | Result | Evidence |
|---|---|---|
| D20 | **pass** | `discover` 456. (a) Ladder coverage: *Build Keyword Strategy* loads the domain's 4 ladders and flags "erp software solutions dubai" → `ladder_covered: {ladder_id lad_mv40b6s9h5a8, head "erp software uae", ladder_keyword "best erp software in dubai", part rung, rung 1, status planned, how "the same search"}`; the same block is in the callback (`ladder_covered`), and 4 more keywords are flagged `covered_by` a live page. (b) AI Overview: every claim comes from the live check — "an AI Overview was seen on 2026-10-12 (they vary between searches)"; "cloud solutions" has `ai_overview` in the Labs `serp_types` but none in the live check, and its "why" makes no AI-Overview claim. (c) "Who ranks now": 5 distinct domains per card, no duplicate in any of the 8 cards. (d) All 21 `cpc` values in the callback are 2 decimals (`8.43`, `13.61`, …). |
| D21 | **pass** | Site Tracker 463: *Parse Trends* returns all four tracked keywords as `direction: "sparse"`, `change_pct: null`; the brief's facts say `"change": "too little search data for a percentage"`; the weekly report contains no percentage for them and **0 occurrences of "undefined"** (P2-4 fixed: "e invoicing uae fta (11 days ago), peppol uae (4 days ago), erp software uae (0 days ago)"). |
| G9 | **pass** | Site Tracker 463 `search_console`: `rows_read: 862` through *GSC More Requests* (paging), 520 queries and 49 pages with impressions; `queries_google_does_not_name` = 29 clicks, 1,590 impressions, **30.1% of all impressions** with the privacy note; `brand_vs_non_brand` brand 37 queries / 4 clicks / 529 impressions vs non-brand 483 / 4 / 3,149, previous non-brand clicks 0; `tool_and_scraper_queries` 5 queries, 7 impressions, excluded from every list. All of it is in the delivered report. Caveat: the brand tokens are `["techand", "tech"]` — the 4-character token comes from "Tech&" (see P34-2). |
| G24 | **pass** | Both reports: "Crawled 45 of 45 known URLs (100%; sitemap 45 + 43 pages with Search Console impressions)"; `site_structure.crawl_coverage` = `{known_urls 45, crawled_known 45, coverage_pct 100, not_crawled 0, crawl_limit 200, crawl_complete true}`. The "under 90%" finding is correctly not raised. |
| G28 | **pass** | Site Tracker 463 `traffic_significance`: clicks 15 → 37 (+147%, 95% range 35–349%, `statistically_real: true`), impressions 1,422 → 5,275 (+271%, 250–293%, real), sessions 46 → 83 (+80%, 26–159%, real); `only_watch: false` on all three; `google_updates_in_period: ["September 2026 core update (2026-09-15 to 2026-09-30)"]` as context; the single alert is an index-status alert, not a percentage. The AI report labels its own changes "no change (within noise)". |
| G7 | **not exercised** (fallback path **passes**) | The Chrome UX Report API is **not enabled** in the PageSpeed key's Google project. *Analyze CrUX* returns `available: false, api_enabled: false, reason "api_off"` for all 3 templates × 2 devices, and both delivered reports print "**Not available: the Chrome UX Report API is not enabled for the Google key this agent uses. Enable the 'Chrome UX Report API' in the Google Cloud project that owns the PageSpeed key (APIs & Services → Library → Chrome UX Report API); no new key or cost is involved.**" with the source line and the thresholds. Nothing failed: the technical audit scored 83 and the full report 70, the only consequence is one Info finding ("Core Web Vitals field data not available"). Per-template p75 values could not be verified — **owner action: enable the API, then re-run one audit**. |
| G26 | **pass** | Both reports open "Fix These First" with "**Ordered by likely impact.** \"A large share of important pages is not indexed by Google\" is first because Google cannot index or follow these pages, 15 of 47 crawled pages, an estimated 11 clicks and 1,615 impressions in the last 28 days, High severity — impact score 37.6 against 37.1 for \"HTML cannot be cached by the CDN (no-store / private)\"." The stored findings are ordered by `impact` (27 rows in the audit, 50 in the full report): index blockers first, cosmetic items (alt text, Open Graph, deprecated HTML, impact 0.9) last; the Methodology section explains the ordering. |
| G18 | **not run live** | A harness measurement (the labelled accuracy set), nothing to exercise in a live run. Its open sub-item G18-1 is covered under D3 below. |

Also re-confirmed by these runs: **D2** (the audit diff compares like with like — "compared with the technical audit of
2026-10-12" / "compared with the full SEO report of 2026-10-12"), **D6 / D18** (no "www and non-www" finding anywhere; "No duplicate
meta tags on the homepage (the crawler counted tags that differ only by a media attribute, such as theme-color for light and dark)"
is in *What Works Well*), **D17** (the fix pack's robots.txt says "Changes: none needed", keeps `/api/ /admin/ /private/` and no
longer adds the AI-crawler allow group — diff against the 2026-10-11 artefact), **D24** (4 scraper queries counted separately and
left out of the top queries; **one** author finding, no duplicate titles among the 50; the cap sentence appears only in the
Methodology, no "capped at 85" claim at score 70), **D7** (domain age 0.6 years, from the cache, $0 WHOIS), **D11** (the Site Tracker's
priority-1 action is "Do not publish the new page for 'uae e invoicing penalties' as a second URL: … already answers this search. Use
the new text to refresh that page instead."), **P2-3** (0 bare-host URLs in the tracker: `computed_actions` quote
`https://www.techand.ai/e-invoicing-uae-fta/` and all 18 `ladder_pages[].url` are on www).

### Phase 2 reruns asked for in the brief

| Item | Result | Evidence |
|---|---|---|
| D22 | **pass** (P2-1 and P2-2 fixed) | `describe` 453: *Nav Pages Plan* now reads the **site model's** menu (`nav_source: "site model"`) and returns 5 pages (/industries, /capabilities, /capabilities/cloud-services, /capabilities/business-applications, /capabilities/data), all fetched. 28 services, including **Dynamics 365 Business Central**, Dynamics 365 Sales / Customer Service / Field Service (the CRM apps) and Copilot Studio / AI Builder; the cached model (`seo_cache model:site_techand-ai`) holds all 28, and after the Site Tracker rebuild **`seo_sites.services_json` holds 28 entries** (was `"[]"`). Caveat: `describe` itself writes the services only to the model cache, not to `seo_sites`; the row was filled by the Site Tracker 25 minutes later. |
| Keyword Check | **pass** | "business central partner uae" → **fit 2**, `label "Reachable for your site · Short ladder · 4-8 months"`, `business_source: "stored description"`, reach 10, `plan_type: short`; the 2026-10-12 10:14 run scored fit 1 with the warning about a homepage-only description — that warning is gone. |

### Phase 4

| Item | Result | Evidence |
|---|---|---|
| G1 + D19 | **pass** | `ai_visibility` 473. **Error rate 1 of 47 requests = 2.1%** (< 5%); the retry gate re-sent 4 tasks (*AI Retry Requests*: ai_mode ×3, ai_overview ×1) after a pause and **3 of the 4 answered**; the delivered report says "⚠ 1 of 47 AI requests failed (3 of 4 answered on the retry): Google AI Mode — Internal SE Server Error." and "The rates below count the 34 answers that came back", and `engines[].errors` lists the failure per engine (ai_mode 1, every other engine 0). Brands: all 8 counted competitors map to real domains (cleartax.com, azentio.com, zoho.com, tallysolutions.com, microsoft.com, odoo.com, sap.com, wafeq.com) — no heading or generic phrase. URLs: 263 cited URLs, 194 distinct, **0** with `www.`, a `#` fragment or a tracking parameter. |
| G10 | **partial** (new defect P34-3) | The mechanism is wired: `Analyst_Jobs.js` builds the fact sheet and switches the check off below `min_facts`, and `AI_Metrics.js` reports `not_checked` / `no_facts` with a note. Live, the gate stayed **on**: the sheet carried Country + the 28 services from the site model, so `facts_ok: true`, `fact_check: "checked"`, and the report says "What AI gets wrong: nothing that contradicts your business facts" and "AI describes you correctly, as a Dubai-based Microsoft partner … and no claim was wrong" — although `seo_profiles` is empty, so no city, address, phone or accreditation is on file and the "Dubai-based" claim cannot in fact be judged. The "not checked" wording the brief expected never appeared, and it never said "no wrong claims" in those words. |
| G22 | **pass**, small residual | AI Growth 480 earned media: titles survive whole past hyphens and pipes — "UAE E-Invoicing ASP List 2026: Accredited & Pre-Approved - Finline", "B2B e-Invoicing in the United Arab Emirates (UAE) - EDICOM", "eInvoicing Accredited Service Providers (ASPs) \| Ministry of Finance" (68 and 85 characters). Residual: the `< 8` characters rule still lets through "Peppol E" (exactly 8) and two mid-sentence cuts ("UAE E-Invoicing Penalties Explained: What Non"), and one page has an empty title; `comarch.com` / `pagero.com` / `cleartax.com/ae` fall back to the host, as designed. |
| D23 | **pass** (sister-domain half not exercised) | Backlinks 476: `dr_enabled: true`, `dr_error: ""` — the Ahrefs DR lookup ran through the retry rule (no network error to retry this time). Gap: 42 domains, **39 flagged `off_topic: true`** with a reason, shown in the report as "stripe.com — not pitched: off topic for you: neither its name, its page nor its country ties it to dynamics 365 partner uae" (also libsyn.com and 37 others); only mof.gov.ae, uae-asp.ae and nationalbonds.ae are on topic. No URL carries `utm_*` / `srsltid`. `clear.in` is not in this run's data, so the shared-brand-stem sibling rule was not exercised live. |
| D3 / P1-2 | **pass**; G18-1 **not reproduced** | Backlinks 476: `best_links: 0` and the report's banner "⚠ **17 link(s) from link farms / PBN pages set aside** (no value, on the disavow candidates for review): archive-hu.com, seonix.agency, clifflisting.com …"; `farms[]` names the cluster by its evidence ("the same page path on 16 sites (/all/2835/13.html)", spam 60-70). The "Best links" section lists peppol.org (SEO 35 / visits 25 / brand 44, authority 594 · DR 77, "✓ on the page"). **`robuta.com/?q=business+impact` does not appear anywhere in the run** (DataForSEO no longer reports it), so G18-1's symptom could not be observed; the defect stays unfixed in code. |
| D13 | **pass**; listings defect P34-2 | Link Builder 478: `brand: "Tech&"` (from the site model), `canonical_host: www.techand.ai`, 28 services, `accreditation: ""`. Of 44 prospects, 16 qualified and **28 refused with a reason**: 4 government ("government site: you get on its lists by applying or being accredited, not by a pitch (see the listings checklist)" — mof.gov.ae ×3, tax.gov.ae, u.ae), 14 bare homepages ("only their homepage was found: a front page has no section a link could sit in"), 2 contact databases (zoominfo.com), 1 mailbox provider (outlook.com), **1 competitor** ("a competing provider: their page sells what you sell (50% of your services)"), 1 accredited-provider list ("you get on it by applying"), 3 off topic (0% and 19% match), 1 language, 1 dead link gone. All 9 ready rows point at `https://www.techand.ai/…` (0 bare-host targets) with `anchor_hint` brand or title, never a keyword. The listings half of the acceptance line **fails**: see P34-2. |
| D12 | **partial** (new defect P34-1) | AI Growth 480 with `link_builder` on: *AI Outreach Input* = `{skip: true}` → **no draft was written by AI Growth**, and its earned-media prospects were handed to `seo_link_prospects` as `ai_source` rows whose `detail` names the question AI cites them for; every action text calls the business "**Tech&**". But the report still says "15 page(s) AI cites without naming you, **8 outreach draft(s) written**" and prints the stale 2026-10-02 drafts in the action table, including the pitch to **tax.gov.ae** that opens "I work at techand.ai. Your site appears in AI assistant answers (ChatGPT, Perplexity …)" — the exact D12 wording and recipient class the fix removed from the writer. |
| L2 | **pass** | Link Builder 478 *LB Draft QA*: `checked: 6`, `held: 6` — every draft held as `needs_edit` with the reason "**needs you: [Your name]**" (no author on file: owner items O1 / O2). The drafts themselves meet the other rules: first e-mail 79–87 words (limit 120), exactly one link, on the canonical host, brand written "Tech&", a real quote from the prospect's page, follow-ups after 4 and 8 working days. The writer also skipped one prospect itself with a reason ("Page is the company's own e-invoicing product page, not a list, resource or article that links out; a pitch would be promotional"). |
| L1 | **not exercised** | The MX gate lives in the app's send path (`services/mail.ts` `mxCheck`, called by `linkBuilder.ts` approval and `outreachJobs.ts` `senderTick`), and techand.ai has no mailbox connected — nothing could be approved or sent, and the brief forbids triggering the sender. Independent check of the data the engine produced: all **9** distinct recipient domains of the ready rows resolve an MX record, so the gate would pass them. |

## 3. New defects

- **P34-1 · AI Growth presents stale pre-fix drafts as this week's work (D12 residual).** With `link_builder` on the run writes no
  draft, but `Growth_Metrics.js` l.50 builds `earned[].draft` from the **stored** prospect row (`row.outreach_body`), not from this
  run's writer output, so the 2026-10-02 bodies come back: `Growth_Report.js` l.11 counts them ("8 outreach draft(s) written") and
  the report prints the pitch to **tax.gov.ae** ("Offering practical input on UAE e-invoicing… I work at techand.ai. Your site
  appears in AI assistant answers…"). The same carrying happens in the Backlink Monitor: run 476 re-wrote `mof.gov.ae` and
  `uae-asp.ae` as `gap` prospects with their old subject "A resource suggestion for your readers" and refreshed `last_seen`, and the
  app marks such a row `drafted: true` and shows the draft (`app/server/src/services/data.ts` l.1123), so the owner is still offered
  a pitch to two government portals. Where: `v5/code/Growth_Metrics.js` (only this run's drafts), `v5/code/Growth_Report.js` (say the
  prospects went to the Link Builder when it is on), `v5/code/Earned_Media.js` / `Parse_Backlinks.js` (clear or retire
  `outreach_subject` / `outreach_body` on a hand-over row), plus a one-off cleanup of the pre-fix rows in `seo_link_prospects`.
  Evidence: `files/phase34-live-2026-10-12/aig-480-earned-media.json`, `growth-report-480.txt`, `bl-476-prospect-rows.json`.
- **P34-2 · "Tech&" collapses to the token "tech", which makes the listings checklist claim listings the site does not have.**
  Listing rows of run 478: `saashub` → **listed** with profile `https://www.saashub.com/tech` — the fetched page (101 KB, title
  "Tech Alternatives - SaaSHub") contains **0** occurrences of "techand" and 20 of "Tech "; `alternativeto` → **listed** with
  `https://alternativeto.net/software/optimizer/`, which answered **403** ("Just a moment…", a bot wall) — a challenge must stay
  "unknown" with the last definite status; `mof_asp` → **listed** although the page actually fetched (321 KB, the real "eInvoicing
  Accredited Service Providers (ASPs)" list) contains **0** "techand", and the 2026-10-11 run correctly reported it "missing". The
  owner is now told they are on the UAE Ministry of Finance accredited-provider list. The same 4-character token reaches the Search
  Console brand split (`brand_names: ["techand", "tech"]`, 37 "brand" queries). Where: `v5/code/LB_Assemble.js` l.162
  (`OK.namesUs` — require a brand token of ≥ 5 characters or the domain, and never a stripped-ampersand form on its own),
  `v5/code/_listings.js` (a 403 / challenge keeps the last definite status), and the brand tokens in `Site_Metrics.js`.
  Evidence: `files/phase34-live-2026-10-12/lb-478-assemble.json` (listing_rows), the three page fetches in exec 478
  (*Fetch LB Pages* items 45/46, *Fetch LB Second* items 83/84).
- **P34-3 · The G10 fact gate passes on facts that cannot judge the claims.** `Analyst_Jobs.js` `CONFIG.min_facts = 2` counts any two
  `CHECKABLE` entries, and Country + "Services on the site" (now filled from the site model) are enough, so with an empty business
  profile the analyst still ran with the check **on** and the report states "nothing that contradicts your business facts" and "AI
  describes you correctly, as a Dubai-based Microsoft partner … and no claim was wrong" — while no city, address, phone or
  accreditation is on file. Where: `v5/code/Analyst_Jobs.js` (require at least one locating fact — city / address / phone — before
  switching the check on, or scope the verdict to the facts actually on the sheet) and the wording in `AI_Report.js` /
  `AI_Brief_Input.js`. Evidence: `files/phase34-live-2026-10-12/aiv-473-analyst-jobs.json`, `aiv-473-metrics.json`,
  `ai-report-473.txt`.
- **P34-4 · The full SEO report's link gap recommends link farms and a ministry.** *Analyze Backlinks* builds `authority.gap`
  straight from DataForSEO's `domain_intersection` with **no spam, topic, government or infrastructure gate** and raises the Medium
  finding "Link opportunities: sites that link to competitors but not to you … Top: mof.gov.ae, uae-asp.ae,
  backlinkcheckers.space, websitebacklinksgenerator.store, authoritylink.shop" with the fix "Reach out to these sites with a listing
  request, partnership or useful resource". The delivered report prints the same table (buyhighda.space, freedofollow.website,
  relevantbacklinks.website, …). The Backlink Monitor, on the same data, flags 39 of 42 as off topic and never pitches them (D3 /
  D4 / D23 all live in `Parse_Backlinks.js` / `_outreach_kit.js`, which this path does not use). Where: the `Analyze Backlinks` code
  in `build_v4.py` — reuse `LK.isScraper` / `LK.isInfra` / the spam score, `_outreach_kit.js`'s 25% topic gate and the government
  rule. Evidence: `files/phase34-live-2026-10-12/full-report-470.txt` ("5. Authority & Backlinks"),
  `full-report-470-payload.json`.
- **P34-5 · Two concurrent 200-page audits were killed by the n8n JavaScript task runner, after 90 idle minutes.** Executions 459 and
  461 (started 2 s apart, together with the Site Tracker) both stopped at 17:30: the runner container logged "Found runner
  unresponsive (1/6)" and "Runner process exited on idle timeout", and n8n logged "No matching task offer for request … (type
  \"javascript\"). Available offer types: [python]". The Code node *GSC Audit Findings* (459) and the HTTP node *Fetch Page HTML*
  (461) then hung for 3,813 s and 3,833 s until the execution timeout cancelled both at 18:34. Re-run one at a time, the same two
  runs finished in 3.9 and 10.8 minutes. Two consequences for the engine: nothing notices a run that stops making progress (90
  minutes of paid crawl data thrown away, the owner's report never arrives until the timeout fires), and the two `seo_run_ledger`
  rows (26, 27) stay `reserved` for ever, so they keep counting against the $6/day budget estimate. Where: the runner settings /
  concurrency in `n8n/compose.yml` (and `EXECUTIONS_TIMEOUT`), plus a progress watchdog or a ledger sweeper for rows whose execution
  is no longer running. Evidence: `docker logs n8n-runners-1` 17:29–18:34, the per-node times of 459 / 461.
- **P34-6 · The AI Visibility Tracker and the Backlink Monitor still do not read the site model's business name.** Both get
  `business_name: ""` and `brand_names: ["techand.ai"]` (AI) / `["techand.ai"]` (BL), because `_monitor_sites.js` takes the name from
  `seo_profiles` only, while AI Growth and the Link Builder read the model and say "Tech&". The delivered AI visibility report
  therefore calls the business "techand.ai" throughout ("AI assistants named techand.ai in 0% of 34 answers"), the analyst's fact
  sheet has no "Business name" line, and brand matching in answers relies on "techand" alone. Where: `v5/code/_monitor_sites.js`
  (merge `seo_sites.business_name` / `canonical_host` into the per-site object, as `Growth_Plan.js` and `LB_Plan.js` do). Evidence:
  `files/phase34-live-2026-10-12/aiv-473-metrics.json`, `bl-476-parse-backlinks.json`, `ai-report-473.txt`.

Observations (not defects): every finished run settled its ledger row (`seo_run_ledger` 22–29, the two cancelled runs excepted); the
Error Handler's ops mail **was delivered** for both cancellations (D25b's SMTP failure is intermittent — the two Console Alerts
failures at 08:02 and 13:03 are the known IMAP-trigger case); `discover` with "Keyword Report" ticked spawns its follow-up run as
designed (exec 457); the Backlink Monitor's "Best links 0" counter sits next to a "Best links" section that lists peppol.org (the
counter counts links above a value threshold); the AI Growth report says "IndexNow waits for its key file" (the owner still has to
upload it).

## 4. Spend

DataForSEO **$2.0220** measured (balance $20.887764 → $18.865792); Claude **$0.4640** from reported token usage (no streaming node ran
in this check). Total ≈ **$2.49** of the $3.50 cap, against an estimate of $3.0. The largest items: `ai_visibility` ($0.803 + $0.106),
the full report ($0.400 + $0.049), backlinks full ($0.373), discover + its keyword-report follow-up ($0.27 + $0.22). The two
cancelled audits wasted ≈ $0.06 of crawl data. Today's pre-deploy scheduled runs (AI Visibility 11:25, Backlink Monitor 16:19,
≈ $0.244) are outside this figure.

## 5. State left behind

- **New data:** two `seo_audits` rows with 27 and 50 `seo_audit_findings` (technical audit 83 "Good", full report 70 "Needs
  Improvement"); `seo_pages` refreshed (45 rows, all on www) plus new `seo_site_metrics`, query and trend rows; `seo_sites`
  `services_json` filled with 28 services (first time) and the model columns refreshed; `seo_cache` `model:` / `desc:` rows
  refreshed; one `seo_ai_visibility` row (34 samples, mention rate 0, visibility score 0) with 34 `seo_ai_answers`; one
  `seo_backlink_snapshots` row (mode `full`) and refreshed `seo_backlinks` ledger rows; 5 `seo_link_prospects` rows written or
  refreshed (128 in total, including the stale government drafts of P34-1); 44 `seo_link_outreach` rows updated, 6 of them holding a
  `needs_edit` draft; 16 `seo_listings` rows (3 of them the false "listed" of P34-2); 12 `seo_ai_pages` scored (average 78, was 75)
  with 2 pages submitted to Bing; 6 `seo_ai_targets` queued; one `seo_ai_growth` row; `seo_run_ledger` rows 22–29, of which **26 and
  27 stay `reserved`** (the cancelled audits).
- **Nothing was published or sent:** no page published, no outreach e-mail (every draft held), no mailbox connected, no profile,
  check-in or published row, no ladder created, no Site Admin action. Two ops alert e-mails went to the ops address for the two
  cancelled executions.
- Test Runner **deactivated** (`active: false`). Everything else stays as it was: the Reply Reader active, the Link Builder on for
  techand.ai, the Phase 1 ladder's settings row paused.
- **Owner actions found by this check:** enable the **Chrome UX Report API** in the Google project that owns the PageSpeed key (then
  one audit shows the per-template field data, G7); fill the business profile so the Link Builder's 6 held drafts can be sent and so
  the AI fact check has locating facts (O1 / O2); upload the IndexNow key file.
- **Secrets exposed in tool output during this check (rotate when convenient):** the caller secret `SEO_API_KEY` appeared once in an
  execution's webhook headers while reading node data (exec 467), and the techand.ai company id appeared once in a `seo_run_ledger`
  row dump. No file in the repo carries either.
- Artefacts (git-ignored `files/phase34-live-2026-10-12/`): `spend-before.json`, `spend-2026-10-12-phase34.json`,
  `claude-tokens-phase34.json`, `describe-run453.json`, `seo-sites-techand-after-describe.json`, `keyword-check-bc-partner.json`,
  `discover-run456-nodes.json`, `discover-ideas-response-456.json`, `keyword-report-456.txt`,
  `site-tracker-brief-input-463.json`, `site-report-463.html`, `tech-audit-468-report-payload.json`,
  `tech-audit-468-findings.json`, `tech-Build_Audit_Report-468.json`, `tech-Build_Site_Issues-468.json`, `tech-audit-468.html`,
  `tech-audit-468.txt`, `site-audit-techand-ai-2026-10-12.doc`, `fixpack-robots.txt`, `full-report-470-payload.json`,
  `full-report-470-findings.json`, `full-report-470.txt`, `full-seo-report-techand-ai-2026-10-12.doc`, `aiv-473-metrics.json`,
  `aiv-473-questions.json`, `aiv-473-analyst-jobs.json`, `aiv-473-retry.json`, `ai-visibility-report-473.html`,
  `ai-report-473.txt`, `bl-476-parse-backlinks.json`, `bl-476-prospect-rows.json`, `backlinks-report-476.html`,
  `bl-report-476.txt`, `lb-478-assemble.json`, `lb-478-draft-qa.json`, `aig-480-earned-media.json`,
  `aig-480-growth-metrics.json`, `ai-growth-report-480.html`, `growth-report-480.txt`.
- **Not exercised:** G7's CrUX values (API off), G18 (harness only), L1's MX gate (no mailbox), D23's sister-domain rule (no
  `clear.in` in this run's data), G18-1's search-results "best link" (robuta.com is no longer in the link data), and G10's "not
  checked" path (the site model supplied enough facts to switch the check on).
