# Phase 2 live checks — techand.ai, 2026-10-12

Live runs on the owner's site after the Phase 2 deploy (main workflow 419 nodes). Started 10:11 UTC, finished 10:35 UTC, before the
Monday schedules (first one 11:00 UTC). Every API run was sent the way the web app sends it (header `X-Forwarded-For: app:<techand.ai
company>` and the company's app callback), so every report landed in the app's `reports` table. The Site Tracker and the Content
Cadence were started through the Test Runner (activated for the test, **deactivated again** at 10:34). No code, workflow, prompt or
table column was changed. No e-mail went to anyone, no page was published, no profile / check-in / published row was written, no
ladder was created.

**Spend: ≈ $0.95, against a $3.00 cap** (estimate was ≈ $1.2).

| | Amount | How it was measured |
|---|---|---|
| DataForSEO | **$0.1454** | Balance $21.277168 at 10:11:48 UTC, $21.131808 at 10:34:47 UTC (probed from inside the n8n container). The runs' own ledgers account for $0.1203 (3 keyword checks $0.0781, page run $0.0201, verdict $0.0221); the residual $0.0251 is the Site Tracker (2 SERP checks + 1 Trends request, no ledger). |
| Claude | **≈ $0.80** | Token counts × the prices used in RESULTS §0 (Opus $4 / $20, Sonnet $2 / $10, Haiku $1 / $5 per million). **$0.311 from reported usage**; the page run's three Opus nodes (Strategy Brief, Copywriter, Editor) stream and report no usage — ≈ $0.49 for a 3,864-word page with one editor pass (thinking tokens may be missing). The guard's own estimate for the same runs is $1.53 (page run $1.23, verdict $0.23, describe $0.06, 3 checks $0.006). |

**Deviation from the plan:** step 6 was run as the app's "Write now" for the **already planned main page of the "erp software uae"
ladder** (`lad_mv40b6s9h5a8`, rung 4) rather than a new page: it is the exact page of the D10 / D9 evidence (`files/erp-software-uae.md`,
50 placeholders, 3,952 words, links to 3 unwritten pages), so the before / after is directly comparable. D11's main case was run as
`verdict` for "uae e invoicing penalties", as the brief asked (no ladder, no page written for it).

## 1. Runs

All times UTC. "API" is the front door's webhook execution, "run" the execution that did the work.

| # (RESULTS §1) | What | Executions (API → run) | Start–end | Duration | DataForSEO | Claude | Status |
|---|---|---|---|---|---|---|---|
| — | Balance before | — | 10:11:48 | — | — | — | $21.277168 |
| 3 | `describe` | 434 → 435 | 10:13:24–10:13:48 | 22 s | 0 | 0.006 | completed, 9 services, 1 page read |
| 5 ×3 | Keyword Check ×3 in parallel ("erp software uae", "business central partner uae", "dynamics 365 partner uae") | 436, 437, 438 | 10:14:20–10:14:27 | 6–7 s each | 0.0781 | 0.009 | 200 ×3; fit 2 / **1** / 2 |
| 20 | Site Tracker (Test Runner) | 439 → 440 | 10:16:32–10:17:51 | 1.3 min | ≈ 0.025 | 0.031 | completed, 45 pages written to `seo_pages`, model written to `seo_sites` |
| 7 | `keyword` + "Write now" for the ladder main page "erp software uae" (rung 4) | 441 → 442 | 10:20:31–10:30:17 | 9.7 min | 0.0201 | 0.163 + ≈ 0.49 | completed, content score 84, QA "2 items to review", 3,864 words, 0 placeholders in the body |
| 4 | `verdict` "uae e invoicing penalties" (a keyword with a live page) | 443 → 444 | 10:20:33–10:22:51 | 2.3 min | 0.0221 | 0.103 | GO_WITH_CHANGES 58, 8 months |
| 19 | Content Cadence dry run (Test Runner), before the page run | 445 → 446 | 10:21:50–10:21:51 | 1 s | 0 | 0 | pile-up, nothing planned |
| 19 | Content Cadence dry run (Test Runner), after the page run | 447 → 448 | 10:34:07–10:34:08 | 1 s | 0 | 0 | pile-up, nothing planned |
| — | Balance after | — | 10:34:47 | — | — | — | $21.131808 |

All 15 executions of the check succeeded (public API, no `status=error`). The only failed execution of the day is 433 (08:02, Error
Handler SMTP "connection cannot be established") — the known D25b, unrelated to this check. 4 callbacks landed in the app's `reports`
table: `site_description` (434), `site_tracker` (439), `content` (443, the verdict's keyword report), `content` (441, "Page: erp
software uae"). The two dry runs deliver nothing on purpose (*Site Notes?* is `report_only && !dry_run`).

## 2. Items

| Item | Result | Evidence |
|---|---|---|
| G19 | **pass**, residual P2-2 | Site Tracker 440 (*Site Model (Site)* `rebuilt: true`, homepage 200) wrote the model into `seo_sites`: `canonical_host` www.techand.ai, `business_name` "Tech&", `logo_url` https://www.techand.ai/logo1.png, `nap_json` (DAFZA street address, Dubai, AE, phone, public e-mail, `source: homepage_schema`), `nav_pages_json` 12 pages, `brand_names` "Techand, Tech&", `competitors` "cleartax.com, azentio.com", `model_updated_at` 2026-10-12T10:16:36Z. The main workflow resolves the same model on demand and caches it (`seo_cache` key `model:site_techand-ai`, *Model Cache Row* / *Save Site Model*) — runs 435, 442, 444 all carry `site_model` with canonical host www. The brief's facts block carries it ("Call the business by this name and write every URL on the canonical host"). Residual: `services_json` is `"[]"` (P2-2). |
| D5 | **pass** | Cadence Plan in **both** dry runs: `nothing_to_do`, `paused_reason: pileup`, `waiting_publish: 5`, `max_waiting: 3`, reason "5 written pages waiting for publication (pile-up guard, limit 3): \"uae e invoicing penalties\", \"e invoicing uae fta\", \"peppol uae\", \"vendor invoice automation dynamics 365\", \"erp software uae\" — publish them to continue" — both Phase 1 leftovers named (the "dynamics 365 partner uae" rung page = "vendor invoice automation dynamics 365", and the "erp software uae" main page), nothing planned for the week. Part 1 of the fix also works: the page run wrote its own `seo_content_log` row (*Content Log Row* → *Save Content Log (Run)*: keyword "erp software uae", `source: app`, `status: written`, ladder_id, rung 4) and the count stayed 5 afterwards, so the log row and the `writing` ladder row are deduplicated by keyword. |
| D9 | **pass** | Page run 442: 8 internal links, **every one a live page** of the 45-page inventory (4 `/insights/…`, `/business-central-implementation-uae`, `/d365-finance-operations-implementation-rollout-uae`, `/nav-gp-migration-to-business-central-uae`, `/contact-us`); none of the 3 planned ladder pages is linked in the HTML or Markdown; no "Guides in this series" block (`hub.cluster_pages: []`, no live cluster page). The planned pages travel in `meta.json` `links_to_add_when_published` (2 entries, note "Not published yet: add this link from this page once the page is live") with title-cased anchors that keep the acronym: "Best ERP Software in Dubai", "ERP Software Dubai". The third ladder link ("facts erp", a competitor brand) was dropped from the hub list. No anchor is all lowercase. URLs in those entries are still bare-host (P2-3). |
| D10 | **pass** on the gates, parts not exercised | Final QA (round 2 after the editor): **0 placeholders** in the body (`placeholder_max: 5`; round 1 had 1), **3,864 words against the brief's 3,100 = +24.6%** (inside ±25%), `business_name` "Tech&", `nap_source: "homepage_schema"`, schema `Service` + `BreadcrumbList` with `provider` Organization name "Tech&", `url`/`logo` on www — no `[Your Business Name]`, no `[Price]`, no `[Timeline]`, no `[Office address]`, no `[Phone number]` anywhere (2026-10-11: 30 × [Price], 20 × [Timeline], "[Your Business Name]" in the schema, 3,952 words). The brief's new angle guard did its job: `angle_rules` "this business has given no price or timeline facts, so the page must NOT be built on what it costs or how long it takes", `brief_adjustments` "Removed 1 information-gain promise(s) that only a price or timeline could keep", "Comparison-table rows no longer ask for figures the business has not given". **Not exercised / caveats:** street address and phone go into the schema only for `role: local` (`Content_QA.js` l.362–371), so a hub page carries no NAP block — the "address / phone in the schema" half of the acceptance line cannot be met by this page type; the author box still ships 11 bracketed fields that the gate does not count (P2-6, root cause O1 / O2); the ±25% is measured against the brief's own 3,100, because a "Write now" run has neither an analysis recommendation nor the ladder verdict's 2,100 target (P2-7). |
| D11 | **pass** for the inventory and the Site Tracker, **fail** for `verdict` (P2-5) | Site Tracker 440 wrote **45 `seo_pages` rows** (*Page Inventory (Site)* → *Page Rows (Site)* → *Save Pages (Site)*), all on www, from the sitemap + Search Console queries — including `https://www.techand.ai/insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs` (with its query rows). The weekly brief now says, priority 2: "**Do not publish a new page for 'uae e invoicing penalties'. Put the newly written text into the existing page instead.**" / why "That page already answers the search; a second URL would split the signals. Currently position 91." / url = the real `/insights/…` URL. No "publish it" for that keyword anywhere in the brief (the three remaining "Publish …" actions are for pages that are written and have no live equivalent). The brief's facts carry `pages_known: 45` and the rule "never tell the owner to publish a new page for a search a page in the list already answers — say to refresh that page". The cadence loads the inventory too (*Load Pages (Cadence)*, 45 rows, `covered_by_live_pages: []` — nothing to drop among the 9 candidates). **But** `verdict` (444) for the same keyword ignores the inventory: `existing_page: null`, `existing_page_url: ""`, the live page is read only as a `related` client page, and the plan is "Build an informational penalty guide …", `recommended_page: "Guide"`; the delivered report never mentions the live page (P2-5). |
| D15 | **pass** in the page, residual P2-3 in meta.json and the tracker | Page 442: **0 bare-host URLs** in the article HTML and Markdown (12 distinct `https://www.techand.ai/…`), the page's own URL in the `Service` and `BreadcrumbList` schema is `https://www.techand.ai/erp-software-uae`, the Organization `url`/`logo`/`@id` are on www; all 45 inventory rows and every URL in the Site Tracker's AI brief are on www; the new ladder row created in Phase 1 stores its target on www. Residual: the delivered `meta.json` carries three bare-host URLs — `suggested_url: https://techand.ai/erp-software-uae/` (the page's own publishing URL), and the two `links_to_add_when_published[].planned_url` / `hub.planned_pages[].url` — and the Site Tracker's deterministic `computed_actions` still quote "planned URL https://techand.ai/e-invoicing-uae-fta/" and 17 bare-host `ladder_pages[].url` (legacy `seo_ladders.target_url` rows). See P2-3. |
| D22 | **fail** | `describe` 435 read the **homepage only**: *Nav Pages Plan* returned `{ skip: true, reason: "no service or section page in the menu" }`, `pages_read` is 1 entry (`kind: homepage`), 0 extra pages fetched (within the "at most 5" cap, but the feature never fired). The services are the same 9 as on 2026-10-11 — Dynamics 365 F&O, M365 Copilot, Azure, Peppol / UAE e-invoicing, VAT compliance, digital transformation, enterprise AI, cloud migration — **still no Business Central, CRM or Power Platform**, although `/dynamics-365-business-central-uae`, `/business-central-implementation-uae`, `/dynamics-365-crm-uae` and `/power-platform-analytics-uae` are live pages (they are in the 45-page inventory and in the homepage's own menu). The Keyword Check consequently scored **"business central partner uae" fit 1** (unchanged), with the warning "the topic check used a stored description written from the homepage only … run \"Describe my website\" to refresh it" — which the describe run 2 minutes earlier could not fix. Cause: P2-1 (wrong nav source) and P2-2 (services never stored). The other two keywords scored fit 2 ("erp software uae" direct plan, reach 10; "dynamics 365 partner uae" short plan). |
| G2 | **pass** | Page 442: no `FAQPage` in the HTML, Markdown or `meta.json`; schema types `Service`, `BreadcrumbList`, `ListItem`, `Organization`; QA `faq_count: 0`, `faq_words: 0`, and the score holds without an FAQ block (`score_breakdown` structure 25, coverage 13, readability 15, specificity 10, clean_language 10, length 11 = `content_score` 84). The 8 brief FAQs survive as question headings with short answers, as intended. |
| G4 | **pass** on the mechanism, residual below | Page 442: **no `utm_*`, `srsltid` or `gclid`** in any link. Source quality works: `sources_cited` has 2 entries, both `tier: weak` (6sense.com, theinsightpartners.com), `weak_sources_unlinked: ["6sense.com"]` and `auto_fixes` "Unlinked 1 repeat citation(s) of a source with no independent authority (one per domain): 6sense.com" — so at most one link per weak domain, and the body otherwise cites primary sources (learn.microsoft.com, help.sap.com, docs.oracle.com, odoo.com/documentation, mof.gov.ae, tax.gov.ae, peppol.org). Figures not found in their source are flagged: QA warning "Unverified statistics that need a linked source or a [Statistic] marker: 24.41%; 10.83%" (the two 6sense market-share figures), which is why `passed: false`. One `[Confirm: 24/7 support hours and SLA terms]` is in the page — a business claim with no owner fact, not a figure. Residual: the flagged figures still ship in the body unbracketed; the only signal is `passed: false` plus the warning (the fix allows "flagged **or** set as `[Confirm: …]`", so this is within the letter of the fix). |

D21 (Phase 3, not due yet) was looked at in passing and is **still open as described**: the brief input carries `direction: "sparse"`
together with `change_pct` 278 / 1225 / 1200 / −100 for the four tracked keywords.

## 3. New defects

- **P2-1 · D22's extra pages are never read: the nav list comes from the wrong source.** *Nav Pages Plan* reads `nav_pages` from
  *Clean Site Text*, which extracts links from the **Jina reader's Markdown** of the homepage — on techand.ai that is a single
  `/insights/…` article link, which the node's own SKIP_PATH rightly drops, so it returns `{ skip: true, reason: "no service or
  section page in the menu" }` and the describer sees the homepage alone. The site model built in the same run already holds the
  **real menu**, from the raw homepage HTML (219 KB, 112 hrefs): `nav_pages_json` with 12 entries including
  `/capabilities/business-applications`, `/capabilities/cloud-services`, `/capabilities/data`, `/industries#…`, `/insights` — of
  which several match the node's SERVICE pattern and would have scored. Where: `v5/code/Nav_Pages_Plan.js` (`const d =
  $input.first().json` → take `SM.pages`/`nav_pages` from the model, i.e. `$('Site Model').first().json.site_model.nav_pages`, not
  *Clean Site Text*'s), and/or `Clean_Site_Text.js` should keep the model's nav list. Evidence: exec 435 *Nav Pages Plan*, *Clean
  Site Text* `nav_pages` (1 entry) vs *Site Model* `nav_pages` (12);
  `files/phase2-live-2026-10-12/d22-nav-pages-evidence-2026-10-12.json`, `homepage-raw-2026-10-12.html`.
- **P2-2 · The site model's `services_json` is always empty.** In the main workflow the model is built and stored (*Site Model* →
  *Model Cache Row* → *Save Site Model*) **before** *Site Describer* / *Parse Description* run, and nothing writes the description's
  `products_or_services` back into the model; the Site Tracker rebuild has no description either. Result: `seo_sites.services_json
  = "[]"`, the cached model's `services: []`, and the AI brief's facts say `services: []`, so the one thing D22 was supposed to
  store is missing even when the describer finds 9 services. Where: `build_v4.py` (the model section — re-save the model after
  *Parse Description*, or feed `extras.services` / `extras.description` into a second `SM.from`), `v5/code/Site_Model.js`,
  `Page_Inventory_Site.js` / `Site_Rows.js` for the tracker side. Evidence: exec 435 *Site Model* `site_model.services`, *Model
  Cache Row* `value`, exec 440 *Site Rows* `services_json`, *Brief Input* `facts.website.services`.
- **P2-3 · Bare-host URLs still reach the owner (D15 residual).** The page run's delivered `meta.json` says to publish at
  `https://techand.ai/erp-software-uae/` (`suggested_url`), and its `links_to_add_when_published[].planned_url` /
  `hub.planned_pages[].url` are bare-host too, while the same page's schema and body links are all on www. Cause:
  `v5/code/Blog_Package.js` l.157 builds `suggested_url: 'https://' + dom + '/' + slug + '/'` and l.167 passes the stored ladder
  `target_url` through `SRC.clean`; **Blog Package is on the `url_lint.py` allow-list**, so the build-time lint never sees it. The
  Site Tracker has the same residual from stored data: `computed_actions` "Publish the written page for \"e invoicing uae fta\"
  (planned URL https://techand.ai/e-invoicing-uae-fta/)" and 17 bare-host `ladder_pages[].url` — 17 of the 18 `seo_ladders` rows
  still hold bare-host targets (only the Phase 1 ladder row is on www). Where: `Blog_Package.js` l.157 / l.167 (use
  `SM.siteUrl(model, '/' + slug + '/')`), remove Blog Package from the lint's allow-list, `Site_Metrics.js` (`computed_actions`,
  `ladder_pages`) and a one-off rewrite of `seo_ladders.target_url` to the canonical host. Evidence:
  `files/phase2-live-2026-10-12/erp-software-uae-2026-10-12.meta.json`, `site-tracker-brief-input-run440-2026-10-12.json`.
- **P2-4 · "(undefined days)" in the weekly site report.** `v5/code/Site_Plan.js` l.50 reads
  `const pending_publish = blogs.filter(…)   // D5: 'started' and 'written' both wait for the owner's publish link.map(b => ({ keyword, started_at, days }))`
  — the inline `//` comment swallows the `.map(…)`, so `pending_publish` keeps the raw content-log rows and `p.days` is `undefined`.
  The delivered report says "Written, waiting for your publish link: e invoicing uae fta (**undefined** days ago), peppol uae
  (**undefined** days ago)" (`Site_Report.js` l.64) and the AI brief gets `pages_waiting_for_publish_link: ["e invoicing uae fta
  (undefined days)", "peppol uae (undefined days)"]` (`Brief_Input.js` l.16). A Phase 2 regression (the same one-line-comment trap
  as the 2026-10-10 lesson); the Cadence's own `pending_publish` is correct (days 11 / 10). Where: `v5/code/Site_Plan.js` l.50 —
  move the comment to the end of the statement. Evidence: exec 440 *Site Plan*, *Site Report* html
  (`files/phase2-live-2026-10-12/site-report-run440-2026-10-12.html`).
- **P2-5 · `verdict` mode is blind to the page inventory.** Run 444 for "uae e invoicing penalties" — a keyword whose page has been
  live since 2026-08-21 — returns `existing_page: null`, `existing_page_url: ""`, and recommends building a **new** page ("Build an
  informational penalty guide with a service CTA block …", `recommended_page: "Guide"`, `page_notes` "hosted as a hybrid
  service-supporting page"). The live page is fetched, but only as `client_pages[].kind: "related"` (1,706 words), and neither the
  Word file nor the app report mentions it: the owner is told to create a second URL for a search their own page answers — the
  exact D11 harm, in a path D11's "where" list does not name. `SM.matchPage` is used in `Cadence_Plan.js`, `Ladder_Plan.js`,
  `Site_Metrics.js`, `Tracker_Report.js`, `Rank_Keywords.js`, `Page_Inventory_Site.js` — not in the verdict path. Where:
  *Collect Client Pages* / `v5/code/Client_Page_Requests.js` (set `existing_page` from `SM.matchPage(model, keyword)` when the
  request gives none) and `v5/prompts/verdict.txt` (a matched page means "improve this URL", never a new page); the ladder-plan half
  of D11's acceptance test was not exercised (no ladder was started). Evidence:
  `files/phase2-live-2026-10-12/verdict-uae-e-invoicing-penalties-2026-10-12.json`,
  `verdict-report-penalties-2026-10-12.json`.
- **P2-6 · The placeholder gate does not see the author box.** Final QA reports `placeholder_count: 0`, yet the delivered HTML
  carries 11 bracketed fields, all in the author box: `[Author Name]` ×3, `[Author Page URL]` ×2, `[Job title]` ×2, `[name]`,
  `[Two-sentence bio: what the author does and for whom]`, `[Credentials and years of experience]`, `[LinkedIn profile]` (`meta.json` marks them honestly:
  `author: { name: "[Author Name]", placeholder: true }`). The root cause is the missing business profile (owner items O1 / O2), but
  QA's 0 hides a page that still cannot be published as-is, which is what D10 set out to prevent. Where: `v5/code/Content_QA.js`
  (count the author / reviewer box that `Blog_Package.js` attaches, or report them in a separate `profile_placeholders` field that
  the gate and the app's report show). Evidence: `files/phase2-live-2026-10-12/content-qa-detail-2026-10-12.json`,
  `erp-software-uae-2026-10-12.html`.
- **P2-7 · A "Write now" / cadence page run has no verdict word-count target.** D10's clamp (item 3) can only use "the analysis'
  recommended count ±10%, or the ladder verdict's target when one is given". In run 442 neither existed — *Parse Analysis* does not
  run in a `force_content` run and `seo_ladders` has no word-count column (`LADDER_COLS` in `ladder_common.py`) — so the agent's own
  3,100 stood (competitor average 2,590 × 1.2), and the page is +84% over the 2,100 the ladder verdict set for this keyword on
  2026-10-11. Where: `Ladder_Plan.js` + `ladder_common.py` (store the verdict's `recommended_word_count` on the ladder row), app
  `runs.ts` `ladderLinks`/write-now body (pass it), *Parse Brief* (clamp to it). Evidence: exec 442 *Parse Brief*
  `content_brief.target_word_count` 3,100, `avg_competitor_words` 2,590, no *Parse Analysis* node run.

Observations (not defects): P1-1 is **fixed** — every run settled its ledger row (`seo_run_ledger` 16–21 all `done`), though
`settled_usd` is still the estimate, not a measured cost ($0.06 for a describe that cost $0.006, $1.23 for a page run whose
reported tokens are $0.163 + three streamed Opus calls). `page_type` normalisation (D10 item 5) happens in `Ladder_Plan.js` and in
the delivered `meta.json` ("Service Page"), but the free text of a pre-fix ladder row travels unchanged through *Normalize Input*
(`page_notes: null`), *Parse Brief* (`page_type` = `page_notes` = the whole sentence) and into the `seo_content_log` row. Search
Console reports techand.ai's pages on the **non-www** host (top pages, new queries), so bare-host URLs in the brief's
`search_console.*` blocks are Google's data, not ours. The cadence dry run delivers no report by design
(*Site Notes?* = `report_only && !dry_run`), so D5's evidence lives in the *Cadence Plan* node output.

## 4. Spend

DataForSEO $0.1454 measured (balance $21.277168 → $21.131808); Claude ≈ $0.80 (reported tokens $0.311 + the page run's three
streamed Opus nodes ≈ $0.49). Total ≈ **$0.95** of the $3.00 cap. The largest items: the page run ($0.02 + ≈ $0.65), the verdict
($0.022 + $0.103), the three keyword checks ($0.078 + $0.009).

## 5. State left behind

- **The "erp software uae" main page was rewritten** (exec 442, content score 84, QA "2 items to review", 3,864 words, 0 body
  placeholders, 11 author-box placeholders) and delivered to the app as a `content` report (request 441). It is **not published**
  anywhere. Its ladder row (`lad_mv40b6s9h5a8` rung 4) keeps status `writing`; a new `seo_content_log` row exists for it
  (`source: app`, `status: written`, week 2026-10-12), so the pile-up count stays 5 and the Monday cadence writes nothing.
- **New data:** 45 rows in `seo_pages` (the first inventory, all on www) and the 12 model columns of techand.ai's `seo_sites` row
  filled for the first time; `seo_cache` rows `model:site_techand-ai` and a refreshed `desc:techand.ai`; `seo_run_ledger` rows
  16–21 (all `done`); a new `seo_site_metrics` row and query / trend rows from the Site Tracker; one `seo_content_log` row; the
  verdict's caches. 4 reports and their files in the app (company "Techand Test Co").
- Test Runner **deactivated** (`active: false`). Nothing else was switched on or off: the Reply Reader stays active and the Link
  Builder stays on for techand.ai (as left on 2026-10-11); the paused `seo_ladder_settings` row of the Phase 1 ladder is untouched.
- Artefacts (git-ignored `files/phase2-live-2026-10-12/`): `keyword-checks-2026-10-12.json`, `describe-run435-2026-10-12.json`,
  `site-model-run435-2026-10-12.json`, `d22-nav-pages-evidence-2026-10-12.json`, `homepage-raw-2026-10-12.html`,
  `site-pages-run440-2026-10-12.json`, `site-tracker-brief-run440-2026-10-12.json`,
  `site-tracker-brief-input-run440-2026-10-12.json`, `site-tracker-metrics-run440-2026-10-12.json`,
  `site-report-run440-2026-10-12.html`, `erp-software-uae-2026-10-12.{html,md,meta.json}`,
  `erp-software-uae-schema-2026-10-12.json`, `content-qa-detail-2026-10-12.json`,
  `content-qa-erp-software-uae-2026-10-12.json`, `verdict-uae-e-invoicing-penalties-2026-10-12.json`,
  `verdict-report-penalties-2026-10-12.json`, `cadence-dryrun-446-2026-10-12.json`, `cadence-dryrun-448-2026-10-12.json`,
  `claude-tokens-2026-10-12.json`, `spend-2026-10-12.json`.
- Not exercised: D11's ladder-plan half (`improve` with the real URL) — starting a ladder was out of scope; D10's NAP block and the
  address / phone in the schema (local pages only); D9's "Guides in this series" with a live cluster page (none is live); D22's
  "at most 5 extra pages" cap (0 pages were fetched); the clamp of the brief against a verdict target (P2-7).
