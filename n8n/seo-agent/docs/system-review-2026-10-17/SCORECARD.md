# Scorecard — whole system against the best proven results (2026-10-17)

Independent re-rating, scored **only** from the live evidence of 2026-10-17 (`this_run/RESULTS.md` and its four part files —
executions **736–799** on techand.ai between 15:58 and 20:50 UTC, deployed main workflow of 687 nodes, 24 published workflows;
≈ $3.85 spent), against the **unchanged** criteria in `rubric/CRITERIA_keywords_content.md` and
`rubric/CRITERIA_technical_tracking_reporting_ai_links.md`, in the structure and with the method of `prior/2026-10-15/SCORECARD.md`.
I took no part in building the product or running the test.

**Scales (unchanged).** K / C criteria use the 0 / 5 / 10 anchors of their rows. The 1.x–4C.x criteria use 0 = absent · 2 = manual ·
4 = automated but basic · 6 = mid-market parity · 8 = parity with the named leader · 10 = beyond the leaders and proven live.

**Rules followed** (`SCORER_RULES.md`). Every score cites a run, execution id, file or code location. A criterion the live run did not
exercise is marked **(NL)** and scored on code / specs / the last live evidence, never above the last live score. A defect seen live
caps its criterion at the level it shows. A fix the run did not exercise is not credited. Capability and correctness are rated;
outcomes are reported separately (§4). Honest refusals ("not checked", "could not be read") are credited where a criterion asks for
honesty, not as the capability itself.

**How the area numbers are built** (the 2026-10-13 / 10-15 method). Each area is the mean of **the same criterion set the 2026-10-11
scorecard used for that area**, with K1–K3, K8, K10, C2, C3, C14, C15 and 4B.4 weighted 1.5× and everything else 1×, rounded to the
half point (x.25 and x.75 round up). The weighted mean is printed in every area heading. The overall score is the mean of the thirteen
area scores, printed to the half point and as the raw mean.

**K7** stays scored against the owner's 2026-10-15 re-baseline (≥ 40% shared top-7 URLs), with the old-statement score beside it; both
are 6, so the reading changes nothing in the arithmetic. No other criterion needed a different reading.

**Leaders.** Part A compares with the leaders named in the 2026-10-11 scorecard, as the earlier ratings did. Part B compares with the
October 2026 market from `this_run/MARKET_BENCHMARK.md`.

**IDs.** A-#, B-#, C-#, D-# = findings of this run (parts 1–4). R-# = the 2026-10-15 register. "Score (was)" = this rating
(2026-10-15 rating).

---

# Part A — the comparable score

## 0. What I checked myself in `this_run/files/` and `code/`

At least one load-bearing claim per area, opened in the raw artefact or the code snapshot. **No disagreement between the part files
and the artefacts was found.** Two items are refined below (A-22's composition, R41's absence), neither changes a finding.

| Area | Claim | Artefact | Result |
|---|---|---|---|
| 1 Keywords | no chance band on an unmeasured reach (R49 gone); existing ladder named | `A-assess-erp-software-uae.json` | `chance.band "unmeasured"`, `range [0,0]`, "no estimated chance"; `reach_info {method "size", sample 0, top10 0, cached_at 2026-10-08}`; `existing.ladder_id lad_mv40b6s9h5a8`, "continue that ladder / improve that page" — confirmed |
| 1 Keywords | discover names a different page than Search Console in 17 of 79 rows (A-22) | `A-discover-764-strategy.json` (`keyword_strategy.search_console`) | my recount: 79 unique rows, **17** with `answered_by.url ≠ page` — confirmed. Of the 17, 2 map the listing page `/insights` to an article (defensible) and 3 map `/dynamics-365-project-operations-uae` to an F&O page; **6** send F&O service-page queries to the VAT article. Wording e.g. "you rank #9.6 with /insights/how-microsoft-dynamics-365-finance-operations-supports-uae-vat-compliance — striking distance: improve that page" for a query Search Console credits to `/dynamics-365-finance-and-operations-uae` |
| 1 Keywords | keyword report recommends building a page the site has (A-23); verdict read the page whole | `A-kwreport-765-verdict.json`, `A-verdict-760-parse.json` | 765: `existing_page: null`, "Build a Dynamics 365 Business Central/Finance & Operations ERP service page for Dubai/UAE…"; 760: `words 2137, chars_total 15451, chars_given 15451, cut false, html_read true` — confirmed |
| 1 Keywords | R41 (two traffic figures for one head) | `A-ladder-770-plan.json` | head `traffic_potential 27` = `expected_visits.visits 27` (modelled, no AIO seen); no second head figure — **R41 not reproduced** (not stated in part 1; my check) |
| 2 Ladders | one keyword on two pages (A-8); a 3-of-7 pair split (A-9); 7 active ladders vs cap 2 (A-12) | `A-ladder-770-cluster-serps.json`, `A-ladder-770-rows-after.json`, `A-ladder-settings-after.json` | "it consulting company dubai" vs "it consulting company in dubai": **3 shared** of 7 (hlbhamt.com, digitalagencies.ae, naukrigulf.com); vs the head of row 30: 2. Settings: 7 `active`, 1 `paused`, `_site max_active 2` — confirmed |
| 3 Content | bracket in the body counted as 0 (A-13); quick answer 0 after the editor (A-17); length | `A-page-771.md`, `A-page-771-qa-round2.json` | body holds "[Price band: typical Assess & Envision fee in AED]"; `placeholder_count 0`, `placeholders_in_body []`, `open_brackets []`, `quick_answer_words 0`, `main_content_words 1856` vs `target_word_count 1600`; the coverage digest lists "IT Consultancy Company in Dubai - AGN IT Services LLC" as a subtopic to cover — confirmed |
| 4 Cadence | pile-up pause; failed drafts labelled "needs a fix" | `C-cadence-791-plan.json`, `A-content-log-after.json` | "6 written pages waiting for publication (pile-up guard, limit 3) … (needs a fix: it did not pass the quality check) … publish the ones that passed, and fix the 4"; content log 2 `written`, 4 `not_ready`, 2 `started` — confirmed |
| 5 Technical | the 20-page "AI crawlers see a different version" finding compares our parser with DataForSEO's counts (B-1); host split first; pre-release | `code/engine/v5/code/Render_Diff.js` l.118–128, `B-audit-739-doc.txt`, `B-prerelease-3a…3e.json` | `fromCrawl` takes `internal_links_count + external_links_count` and `content.plain_text_word_count`; the report says "read from both with the same parser" (l.93), raises the finding (l.224) and says "All 11 search and AI crawlers … receive the full page" (l.126). Host split first, reason "Google cannot index or follow these pages" (l.28, l.32 — B-6). Pre-release: pass/0, fail/1, pass/0 with 3 expected + 1 unused, fail/1 with 1 expected, error/2; all `writes "none"` — confirmed |
| 5 / 1 Full report | brand High from one read (B-2); attestation / jobs keywords (B-3) | `B-fullreport-767-doc.txt` | "Site does not rank at the top for its own brand name" High at l.496, "new High" at l.806; keyword gap "uae document attestation", "how to attest documents from mofa", "mofa document attestation"; easy win "finance jobs in uae" — confirmed |
| 6 Rank | "9 of the top 9 places changed"; "facts erp" still listed; mobile | `C-rank-785-reports.txt` | both present (l.19, l.96); seven ladder reports read "no mobile check was bought for this ladder this week" — mobile on **1 of 12** readings — confirmed |
| 7 Site | monitor block no longer diffs across report types; brand split; "techandkey com" as a quick win (C-6) | `C-site-787-report.txt` | backlinks "4 linking sites (all sources) ▲1 · DataForSEO's index: 19" (no ▼ on health); "brand = techand, tech and"; techandkey com in quick wins (l.235), low CTR (l.238), compete-for pairs (l.225) — confirmed |
| 8 AI visibility | denominator, Wilson ranges, Holm | `C-aivis-776-report.txt` | "54 answers to the 7 buyer questions on the 5 weekly engines (34 this run + 20 from the daily pulse)"; "95% range 0–6.6% of 54 answers"; "Holm-adjusted across the 5 tested alerts … 0 cleared it"; uaeasp.ae "site (PR target)" — confirmed; my Wilson upper bound for 0/54 = 6.64% |
| 9 AI growth | dry run, nothing submitted; a rival list as a pitch (C-2); "93x" per page (C-3) | `C-growth-783-report.txt` | "DRY RUN — nothing was submitted: 0 page(s)…"; two different MoF pages "93x" each; "Ask the editor of flick.network to add Tech& to this list" — confirmed |
| 10 Backlinks | 18 farms set aside; own re-check; % of Google's sample; off-topic prospect | `C-bl-777-report.txt` | "18 link(s) from link farms / PBN pages set aside"; "Of the 20 referring pages we could read, 3 still carry the link (15%)"; "Of the 1 sites in Google's own sample … DataForSEO sees 0%"; marketguest.com "Questions Before Buying Property in Malaysia" under competitors' new links — confirmed |
| 11 Link building | competitor still qualified (C-8); overlap rule | `exec-781.json` | erp-dubai.ae `type ai_source`, `status needs_contact`, `fit 0.84`, `checks_json.reasons []`, title "ERPNext Implementation Partner in UAE & Dubai 2026"; the services-overlap reason ("offers 7 of your services") occurs 10 times — confirmed |
| 12 Reporting | 26 reports, 52 renders; delivery decisions; dry run rendered without its note (D-4); "1 fixed" on a method change (D-5) | `ui/D-pass-20261017/render-results.json`, `code/app/shared/src/report-delivery.ts` l.205–209 | 52 renders, 0 fallbacks, 0 errors, 0 overflow; at 1440: 23 `deliver`, 2 `interim`, 1 `not_ready`; ai_growth text contains no "dry" and is `deliver`; audit #25 "1 fixed · 0 new · 21 still open"; `finishedStatus` accepts `progress` on a report stage — confirmed |
| 12 App | onboarding step 6 crash (D-1) | `code/app/web/src/components/site/MonitorSettingsFields.tsx:71`, `web/src/lib/engine-cal.ts`, `web/src/lib/context.tsx:18`, `web/src/router.tsx:101–107` | `useEngineCal()` → `useOrgCtx()` throws "useOrgCtx outside OrgLayout"; `/onboarding/...` routes sit outside the `OrgLayout` element — confirmed |
| 13 Cost & reliability | ledger rows 153–165; schedule fires | `C-run-ledger-window.json`, `spend.jsonl`, `C-schedule-executions.json` | rows sum **$1.4785** (front-door rows 153/154 $0, children `parent:773/775` carry the money); account $6.922601 → $5.432052. Trigger-mode executions ever: Rank Tracker, Site Tracker, AI Growth, Content Cadence, Link Builder, Audit Scheduler **0**; AI Visibility 1, Backlinks 1 (2026-10-12); AI Pulse 6 (last 2026-10-15); Page Watch 4 (last 2026-10-16 15:15) — confirmed |
| Enterprise (Part B) | identity, audit log, compliance, placeholders, crawl cap | `code/app/server/src/auth/*`, `db/schema.ts`, `shared/src/constants.ts:82`, `shared/src/schemas.ts:202–208`, `web/src/marketing/content/site.ts:8–11`, `pricing.ts:25`, `pages/LegalPage.tsx:163`, `server/src/config.ts:60` | argon2id passwords; no SAML / OIDC / SCIM / MFA / TOTP anywhere in `code/app`; 18 tables, none an audit log; roles owner/admin/member/viewer; crawl 50–1,000 pages, JS ≤ 500; contact addresses and prices `PLACEHOLDER`; legal pages "Draft — to be reviewed by counsel"; `SEO_BRAND` default "Dev SEO" |

---

## 1. Headline: **6 / 10** (area mean **5.88**; 2026-10-15: 5.54 → 5.5; 2026-10-13: 5.92 → 6; 2026-10-11: 4.8 → 5)

The 2026-10-16 fix waves were exercised on the same inputs and **most of the 2026-10-15 High defects did not recur**: no chance band from
an unmeasured reach (R49), the verdict reads the client page whole and no longer invents missing dates / tables / author (R38), all 45
inventory rows carry titles and the ladder's "nothing on the site is about this" is true this time (R34), the 20 false "page mismatch"
rows are gone (R35), the host split is reported as a host split (R59), no findings on 308 stubs (R63), the site report no longer diffs a
full report against an audit (R78), the brand split no longer counts "tech" (R89), the app headline follows its own test (R113), the
backlink hero and spam tile name their sources (R112), backlinks was not refused by its own parent (R77), front-door ledger rows no
longer double-count (R81), Claude answers are counted in tokens rather than "[object Object]" (R47 / R80), every report carries a cost
card (R114), the stale alert loop is gone (R79), and the app's delivery rule now accepts finished monitor reports (R110) while holding
the QA-failed draft. Nine areas rose by half a point and four held; none fell.

What holds the number at 6 is the same family of fault seen from new angles — **the system still does not read one shared picture of the
customer's site and of its own outputs before it advises**: one keyword planned on two pages of the same ladder (A-8, High), a
keyword report telling the owner to build the Business Central / F&O page the site already has (A-23, High), discover naming a page
Search Console does not credit in 17 of 79 rows (A-22, High), the Keyword Check not seeing the live Business Central page (A-1), a 7th
active ladder against a cap of 2 (A-12). Next to it: a new JavaScript comparison that measures two different parsers and reports 20
false "AI crawlers see a different version" pages (B-1, High), a brand finding from one ambiguous SERP read (B-2, High),
government / job / another company's keywords in the full report (B-3, High), and a weekly loop that **has still never run by itself**
(C-1, High: six of ten schedules have never fired from their own trigger; nothing has fired by schedule since the 2026-10-16 deploy).
A new customer cannot pass onboarding step 6 (D-1, High) — outside the frozen criteria, so it does not move Part A, but it weighs in
Part B. Eight High findings this run against fourteen on 2026-10-15.

Raw mean 76.5 / 13 = **5.88**; to the half point **6**.

---

## 2. The 13 areas

| # | Area | **Now** (weighted mean) | 2026-10-15 | Named leader (2026-10-11) | Main reasons (run / exec ids) |
|---|---|---|---|---|---|
| 1 | Keyword research & verdicts | **6** (5.80) | 5.5 | Semrush (Personal KD) / Ahrefs | R49, R38, R35, R41 gone live (749, 760, 764, 770); K8 still fails on three paths (A-22 discover 764, A-23 keyword report 765, A-1 check 750); full report still offers attestation / job / other-company keywords (B-3, 767) |
| 2 | Keyword ladders / planning | **5** (5.07) | 4.5 | MarketMuse / Semrush Strategy Builder | premise true and every rung SERP read (770); but one keyword on two pages (A-8), a 3-of-7 pair split (A-9), an off-fit and a list-intent rung (A-11), 7th active ladder unmentioned (A-12) |
| 3 | Content creation & QA | **6** (5.96) | 6 | Surfer / Clearscope | R37 and R46 gone, `not_ready` stored, delivered honestly as DRAFT (771); but bracket miscount again (A-13), invented statements about the client's terms unflagged (A-15), two 404 links shipped (A-14), competitor's brand headings required (A-16), editor removed the quick answer (A-17) |
| 4 | Content cadence / pipeline | **5** (5.24) | 4.5 | Clearscope (inventory, decay) | guard paused and names the failed drafts as "needs a fix" (791); QA state stored; refresh brief now true (760); ladder path still bypasses both caps (A-12); never fired on schedule (C-1); no CMS push |
| 5 | Technical audit | **5.5** (5.38) | 5 | Sitebulb / Ahrefs Site Audit | host split right, measured page rows, 45/45 inspected, 17 of 20 verifiable findings true (739), pre-release threshold live (740–744); new JS comparison false on 20 pages (B-1), diffs call method changes "fixed" (B-5, C-5) |
| 6 | Rank tracking | **5.5** (5.38) | 5.5 | AccuRanker / Semrush Position Tracking | "top 50" consistent, "publish" only for passed drafts (785); schedule never fired (C-1); mobile 1 of 12; movement against one outlier reading (C-4); cost shown ×9 (D-3) |
| 7 | Site tracking (GSC / GA4 / Trends) | **7** (7.17) | 6.5 | SEOTesting + Looker Studio | R78, R89, R111, R113 gone (787); cannibalisation, content groups, Discover/News, brand series new; another site's navigational query as a quick win (C-6); audit diffs blind to method changes (C-5) |
| 8 | AI visibility (incl. pulse) | **7** (7.00) | 6.5 | Profound / Semrush AI Toolkit | denominator exact, Wilson + Holm recompute, AIO presence over read requests, pulse no longer overwritten (776, 779); vendors still labelled "PR target" (C-2); 7 questions; fact check not run |
| 9 | AI growth (partly NL) | **6** (6.00) | 6 (NL) | Profound Actions / AthenaHQ | first live run (dry run, 783): readiness fetched as 4 AI bots, Bing crawl state measured, nothing submitted; submission path not exercised; a rival's list as a pitch (C-2); counts vs lineage (C-3) |
| 10 | Backlink monitoring | **7.5** (7.33) | 7 | Ahrefs (+ Linkody re-checks) | five sources merged, own re-check, 18 farms set aside, hero and spam tile name their sources (777); real list pages; an off-topic prospect and every prospect aimed at one CRM page (C-10) |
| 11 | Link building | **6.5** (6.67) | 6.5 | Pitchbox / Respona | services-overlap rule refuses three competitors; every quote verified; drafts held (781); five other ERP / e-invoicing sellers still qualified (C-8); nothing ever sent |
| 12 | Reporting & app | **5** (5.00) | 4.5 | AgencyAnalytics / Semrush My Reports | 52 renders clean, monitor reports deliverable, QA-failed draft held, headline follows its test; new self-contradictions in the audit / full report (B-1, B-2, B-4, B-17), modules still disagree (C-7, C-2), dry run would be delivered as real (D-4), nothing ever delivered |
| 13 | Cost control & reliability | **4.5** (4.60) | 4 | Semrush / Ahrefs (server-side limits) | ledger within 0.5% of the account, no double rows, parent gate fixed, budget refusal before any write (API-1); six of ten schedules never fired, none since the deploy, catch-up cancelled (C-1); alerts wait for the network (D-8) |
| | **Overall** | **6** (area mean **5.88**) | **5.5** (5.54) | | 76.5 / 13 |

---

## 3. Per area

### 3.1 Keyword research & verdicts: 6 (was 5.5) — weighted mean 5.80

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| K1 ×1.5 | 5 (5) | Keyword Checks 749–751, 761, 762: one site-wide reach of 10, `reach_info {method "size", sample 0, top10 0}` cached 2026-10-08, the same for every topic, stated ("treat the months … as the optimistic case"). Two of three protocol keywords have no volume and no difficulty at all (750, 751). No back-test. | Semrush PKD / MarketMuse PD per topic. |
| K2 ×1.5 | **7** (6) | Verdict 760: 6 visits a month modelled from 40 searches after the AIO loss, labelled modelled; ladder 770 gives its head one figure (`traffic_potential 27` = `expected_visits 27`, my check — R41 not reproduced); discover shows Search Console impressions per query. No Search Console calibration of the potential. | Ahrefs Traffic Potential from the #1 page's real traffic. |
| K3 ×1.5 | 6 (6) | AIO seen per keyword and timestamped ("seen in the check at 16:03 UTC … one observation should not decide", 760); Rank Tracker prints the Ahrefs Dec-2025 per-position loss. One AIO discount; no separate snippet / local / video discount. A-21: 770 and 771 read the same keyword three minutes apart as "no AI Overview" and "an AI Overview was seen", each labelled a single observation. | Per-feature 2025 CTR discounts. |
| K4 | **6** (7) | Discover 764 live-checked its priority keywords and flags page-type mismatches ("Comparison or lists are what Google ranks here: 7 of the 9 results read … expect to work harder"). But the ladder plans "dubai it consulting companies" (results: "top 25 / top 10 consulting companies" lists) as a Service Page with `page_type_note: null` (A-11) — the mismatch is not flagged on the ladder path. | Ahrefs "pick intent"; Semrush SERP summary. |
| K5 | 4 (4) | Discover's relevance pass removed 224 of 240 (jobs, hospitals, airlines) and the ladder refused 2 navigational and 4 off-topic terms with reasons; the full report refused 100 with reasons and now seeds from the configured keywords (the 2026-10-15 "ai mode" / "face swap ai" lists are gone). But **B-3 (High)**: the full report's keyword gap (a High finding) is "uae document attestation", "dubai business tax", "how to attest documents from mofa", "mofa document attestation"; its easy wins include "finance jobs in uae", "top facilities management companies uae" and "intelligent software solutions" (another company's name, which also became an AI query) — while the same run refuses "mofa attestation dubai". A-11: a rung for local IT support, a service the written page says Tech& does not offer. Leaks on two paths in one run. | A scored business value that gates every list. |
| K6 | **7** (8) | Discover 764: 40 seeds incl. 10 Search Console queries, pool 1,168 (ideas 596, competitors 545, Search Console 19, suggestions 9), AI demand, 300 GSC rows → 97 considered with drop reasons. **A-24**: the competitor set is taken from one results page whose #2 is a job board (naukrigulf.com, "ERP Consultant Jobs in UAE"), so 545 of 1,168 pool keywords came from job / directory sites and 93% of the reviewed pool was irrelevant; a misspelt brand query ("techandf cc") was used as a seed (A-26). | Organic competitors by keyword overlap (Semrush / Ahrefs). |
| K7 | 6 (6) · old statement **6** | **New statement:** ladder 770 bought all 20 rung SERPs, printed the rule ("sharing 3 of their top 7 pages (40%) are one page") and merged one group — but "it consulting company dubai" and "it consulting company in dubai" share 3 of 7 (my recount) and are on different rows, the first labelled "own results page (no other search Google answers with the same pages)" (A-9; compares with the cluster head only), and five of the top page's six supporting keywords were grouped with no results page compared (A-10). **Old statement (≥ 3–4 shared top-10):** the same rule and the same misses → 6. | Keyword Insights merges only on overlap, every pair. |
| K8 ×1.5 | **5** (4) | Works on four paths, live: the Keyword Check names the ladder and page a keyword already heads and advises against a second page (749, 751); the verdict finds the existing e-invoicing article and says improve it (760); the Rank Tracker says "already answers this search — refresh that page" (785); the ladder's "nothing on techand.ai is about it consulting dubai" is true (R34 gone). Fails on three: **A-23 (High)** keyword report 765 "Build a Dynamics 365 Business Central/Finance & Operations ERP service page for Dubai/UAE" with `existing_page: null` while `/dynamics-365-business-central-uae` and `/dynamics-365-finance-and-operations-uae` are live; **A-22 (High)** 17 of 79 discover rows tell the owner "you rank #X with <page>" for a page Search Console does not credit (6 of them send F&O service-page queries to the VAT article); **A-8 (High)** one keyword planned on two pages of one ladder. Also A-1 (the check reads ladders, not the page inventory), A-5 (the verdict folds four planned ladder pages and a written draft into the page it improves), A-25 (discover's "Where to start" sits on two active ERP ladders without a note). | SERP overlap + Search Console "two URLs for one query" across ladders, pages and queue. |
| K9 | 6 (6) | Verdict 760: GO_WITH_CHANGES 52; volume, trend, CPC, competitors and AIO trace to source; the client page read whole (`chars_given 15451`, `cut false`, `tables 3`); regulation references real (Ministerial Decisions 243/244, Cabinet Decision 106 of 2025, checked by executor A); MoF named correctly; "improve … do not publish a second page" — R38 gone, which alone would be 7. Held at 6 by **A-23** (the keyword report 765, also a verdict, recommends building an existing page) and **A-5**; A-6 asks to add the AED 50 million threshold the page states; A-7 takes the coverage model from the regulator's page. | Reasons traceable to data, every one. |
| K10 ×1.5 | **6** (5) | No band where the reach rests on no measured ranking (749: `band "unmeasured"`, "no estimated chance") — R49 gone live; the Ahrefs 2025 base rate (1.74%) printed; ladder "no estimated chance". D-6 (Low): the ladder hero shows "2–4 months" beside "Time to rank ~5 months" (labelled the model's own estimate). No re-fit (no outcomes exist). | Probabilities re-fit from own tracked outcomes. |

**Area:** (5×1.5 + 7×1.5 + 6×1.5 + 6 + 4 + 7 + 6 + 5×1.5 + 6 + 6×1.5) / 12.5 = 72.5 / 12.5 = **5.80 → 6**.

**What would have to be true to score higher.**
- **Next half point (6.5):** ≥ 78.2 weighted points (+5.7). Every keyword path reads the page inventory, the ladders and Search Console's
  own page column — A-1, A-22, A-23, A-25, A-5 do not reproduce on a re-run (K8 → 7, +3; K9 → 7, +1) — and one business-fit gate applied
  to the full report's lists, the ladder's rungs and the competitor choice (B-3, A-11, A-24: K5 → 6, +2) → 78.5 / 12.5 = 6.28.
- **Next full point (7):** ≥ 84.4 (+11.9). The above with K6 → 8 (organic competitors, +1), K4 → 7 (ladder page-type note, +1), K1 → 6
  (reach per topic from the site's own ranked keywords, +1.5) and K3 → 7 (per-feature discounts, +1.5) → 83.5 / 12.5 = 6.68 — still
  short; 7 needs K1 at 7 or outcomes for K10.

### 3.2 Keyword ladders / planning: 5 (was 4.5) — weighted mean 5.07

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| K9 (plan) | 5 (5) | Ladder 770 is built on a true premise (no page or ranking for IT consulting — executor A checked the 45 live pages) and on data: every DataForSEO task 20000, 20 rung SERPs bought ($0.04), pool 32 → 24 → 18, refusals with reasons, rung targets from measured pages (1,600 / 1,200), chance withheld, the pile-up stated with correct counts (5 waiting, 3 need a fix). But **A-8 (High)** one keyword on rows 32 and 33; **A-9** a false "own results page" label; **A-11** "it services dubai" (results: local IT support / MSPs) is a rung while the page this ladder wrote says Tech& does not do office IT; **A-12** the 7th active ladder, unmentioned; A-18 the verdict of 771 calls the keyword "a supporting page" and the ladder makes it the top page. | Strategy Builder / MarketMuse: one keyword, one page, placed in the pillar. |
| K8 ×1.5 | 5 (4) | As 3.1; A-8 is this area's own. | |
| K10 ×1.5 | 6 (5) | As 3.1 (chance withheld; D-6 two durations in the hero). | |
| K11 | 5 (5) | Link map; the top page carries 11 internal links, all 200; rungs link up, the top page links down (`links_to_add_when_published`). The cluster sits on a real gap this time. Its subtopic gaps come from one competitor's page, including that company's own brand headings (A-16), not from a competitor topical map. | Live link map + competitor topical-map gaps. |
| K12 | 4 (4) | `_site max_active 2`, `max_waiting 3`; after 770: **7 active ladders** (`A-ladder-settings-after.json`), unmentioned; the pile-up note "You have 5 pages waiting … this writes page 6" is printed and the page written anyway (771). The cadence (791) does hold four ladders behind `max_active` — the cap holds in one consumer only, as on 2026-10-15 (R42 → A-12). | Cap + topic radius + priority, enforced on every path. |
| K13 | **5** (4) | Next steps read the inventory and the QA state: "publish it" only for the two `written` pages that passed QA, "refresh that page" where a live page answers, failed drafts "fix it and run it again" (785, 787) — R111 gone live; the 2026-10-15 set-aside-yet-queued contradiction (R87) is gone. Held by **C-7** (for "ai consulting" the Rank Tracker says refresh the live page while the Site Tracker says fix the draft; for "it consulting dubai" "write the main page" for a page written and failed that afternoon) and **C-12** ("facts erp", facts.ae's brand, still listed as a rung — fourth rating running — while the Site Tracker marks it `set_aside`). No automatic re-plan. | Won / stuck states that re-plan. |

**Area:** (5 + 5×1.5 + 6×1.5 + 5 + 4 + 5) / 7 = 35.5 / 7 = **5.07 → 5**.

**What would have to be true to score higher.**
- **Next half point (5.5):** ≥ 36.75 (+1.25). A ladder request that is queued, or says so, when it would exceed `max_active` /
  `max_waiting` (A-12: K12 → 5, +1) and one keyword per page across the plan (A-8, A-9: K9 → 6, +1) → 37.5 / 7 = 5.36… → 5.5.
- **Next full point (6):** ≥ 40.25 (+4.75). The above with K12 → 6 (cap enforced on the ladder path and the cadence alike), the
  existing-page fix of 3.1 (K8 → 7, +3) → 41.5 / 7 = 5.93 → 6.

### 3.3 Content creation & QA: 6 (was 6) — weighted mean 5.96

One page run: exec 771 (10.8 min, ladder top page "it consulting dubai", 1,856 main-content words, 3 images, DataForSEO $0.0241 +
Claude $0.1506 measured + $0.3567 n8n estimate).

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| C1 | 6 (6) | Coverage target from the best-ranking service page (agncompu.com #7, 80%), re-measured by QA (88% vs 81%). **A-16**: that page's own brand headings ("IT Consultancy Company in Dubai - AGN IT Services LLC", "Why AGN IT Services LLC Is Best …") are required subtopics and a refusal reason — the same pattern as R44 (vendasta's banner) on 2026-10-15. A-7: the verdict's model page is the regulator's (mof.gov.ae). | Surfer / Clearscope coverage for the intent and page type picked. |
| C2 ×1.5 | 5 (5) | A clear angle ("for Enterprises That Can't Afford to Get It Wrong"); no original data, experience or proof on file (`business_facts ""`, no profile). Where the writer filled that gap itself it invented the client's commercial terms (A-15, charged to C3). | Original data / experience / proof checked in QA. |
| C3 ×1.5 | 6 (6) | R37 gone: no sourced figure masked; the regulatory references (PDPL 45/2021, DIFC DP Law 5/2020, ADGM DPR 2021, Azure UAE regions) are correct. Held by **A-15**: "We charge for advice and delivery. Licences sit on a separate line of the quote … our recommendations do not depend on them", "Tech& does not handle company formation" — statements about the client's business with no source in the run and on none of its 33 non-article pages, not bracketed or listed by the QA; **A-14**: two external links answer 404 while the QA only asks the owner to "verify" three hosts; A-19: the site's own "20+ years" flagged as unverified. Source re-check at refresh not exercised (NL; new page). | Writer-style claim detection against full fetched text and the business's facts. |
| C4 | 4 (4) **(NL)** | No profile on file; no author box; not exercisable. Last live evidence (10-14) caps it. | Credentialed author + author page + Person schema. |
| C5 | 7 (7) | 1,755 eight-word windows against 8 pages (6 competitor, 2 own), highest overlap 0%, threshold 15%, passed, $0. No external index. | Copyleaks-class check against the web. |
| C6 | 6 (6) | Banned phrases, specifics per section, critic (66, "revise"); not itemised. Required competitor-brand subtopics (A-16) are the kind of filler the critic should catch. | Repetition / generic-sentence checks itemised. |
| C7 | 7 (7) | New readability band against the ranking pages (Flesch 55.3 vs competitors 7.2–25.2, labelled advice); round 1 had a 63-word quick answer 85 words in; 13 question headings answered. **A-17**: the editor removed the quick answer and its absence became a refusal reason. | Audience targets kept through every pass. |
| C8 | 5 (5) | Round 2: 1,856 vs 1,600 (+16%) with coverage held at 88% (round 1: +59%). The target is the competitor analysis' figure inside a ±25% clamp; no SERP min–max range. | SERP min–max judged by coverage. |
| C9 | 5 (5) | Critic + deterministic gate + one editor round; delivered honestly — "did not pass the quality check — not ready to publish (round 2 of 2)", `-DRAFT` files, content log row 8 `not_ready`; the round note says 1 round (R46 gone). But **A-13**: `placeholder_count 0`, `open_brackets []` with "[Price band: …]" in the body (my check) — the counter missed brackets on 2026-10-15 too (R45); the gate's refusal rests partly on A-16 and A-17. Not validated against outcomes. | Surfer publishes its score's correlation with rank. |
| C10 | 7 (7) | Title 59 characters with the keyword, meta 144, one H1, canonical. Pre-release live with a severity threshold and an expected-change list (740–744); the stand-alone publish check (745–752) runs the same QA free, sub-second, writes nothing. The page itself is not live (NL for its own live check). | Checked on the live URL + URL Inspection. |
| C11 | 7 (7) | Service + BreadcrumbList; no FAQPage (the verdict's "FAQ section with question-style headings" is content, not schema). | Matched to page type; nothing deprecated. |
| C12 | 6 (6) | 11 body links, all 200; up / down links planned in the ladder. No inbound links from live pages proposed or verified. | ≥ 3 contextual inbound links, verified. |
| C13 | 7 (7) | Three WebP images (hero, comparison diagram, compliance flow) with alt text and file names; not checked on a live page; listed in the app as generic "File" (D-13). | Original visuals checked live. |

**Area:** (6 + 5×1.5 + 6×1.5 + 4 + 7 + 6 + 7 + 5 + 5 + 7 + 7 + 6 + 7) / 14 = 83.5 / 14 = **5.96 → 6**.

**What would have to be true to score higher.**
- **Next half point (6.5):** ≥ 87.5 (+4). Every statement about the client's business bracketed or listed when no fact supports it, and
  every external link fetched and 404s named (A-15, A-14: C3 → 7, +1.5); every bracket counted (A-13: C9 → 6, +1); coverage subtopics
  stripped of the competitor's own name (A-16: C1 → 7, +1); inbound links proposed from named live pages (C12 → 7, +1) → 88 / 14 = 6.29.
- **Next full point (7):** ≥ 94.5 (+11). The above plus the owner's profile and facts in a live content run (C4 → 7, +3; C2 → 7 with proof
  items checked, +3) and length kept inside a SERP range (C8 → 6, +1) → 95 / 14 = 6.79.

### 3.4 Content cadence / pipeline: 5 (was 4.5) — weighted mean 5.24

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| C14 ×1.5 | 6 (6) | Dry run 791 paused itself and names the state of each waiting page: "6 written pages waiting for publication (pile-up guard, limit 3) … (needs a fix: it did not pass the quality check) … publish the ones that passed, and fix the 4 that need a fix" — R111's wording fault gone. Four ladders queued behind `max_active`. But the ladder path bypassed both limits the same afternoon (A-12: 7th active ladder, page 6 written with the pile-up note printed). | Cadence tied to review capacity on every path. |
| C15 ×1.5 | **6** (5) | Decay tested ("44 pages tested, 0 losing, 44 too few clicks", 787); refresh actions read the inventory (785); the refresh brief of 760 now states what the page lacks — PINT-AE, the five-corner model, Decisions 243/244 and 106, a Phase 2 date, none on the live page (checked by executor A) — R38 gone. A-6 asks for one item already there; A-5 folds the site's own ladder keywords into it. The source re-check at refresh did not run (no refresh run; NL). | Clearscope decay alerts + scheduled substantive refresh. |
| C16 | **5** (4) | `seo_content_log` stores `not_ready` with the QA reasons (row 8); "publish it" only for pages that passed (785, 787); publish detection over 45 sitemap URLs. A-20: ladder row `writing` vs content log `not_ready`. WordPress push off; `published` not exercised (NL). | CMS draft push + automatic detection + per-page outcomes. |
| C17 | 5 (5) | Tone "Professional and direct" and banned phrases applied; no style guide on file (NL); Manual / Auto mode. | Stored style guide, checked per page. |
| K8 ×1.5 / K12 / K13 | 5 / 4 / 5 (4 / 4 / 4) | As 3.1 and 3.2. | |

**Area:** (6×1.5 + 6×1.5 + 5 + 5 + 5×1.5 + 4 + 5) / 8.5 = 44.5 / 8.5 = **5.24 → 5** (5.25 would have rounded up). Operational note,
scored in 3.13: the Content Cadence has **0 trigger-mode executions** since it was created (`C-schedule-executions.json`); the weekly
cadence has only ever run when started by hand.

**What would have to be true to score higher.**
- **Next half point (5.5):** ≥ 44.6 (+0.1). Any one point: the ladder path queued behind `max_active` (A-12: K12 → 5, +1) → 45.5 / 8.5 =
  5.35 → 5.5.
- **Next full point (6):** ≥ 48.9 (+4.4). The above with K12 → 6, the existing-page fix of 3.1 (K8 → 7, +3) and one page state carried to
  every report (C-7: K13 → 6, +1) → 51.5 / 8.5 = 6.06.

### 3.5 Technical audit: 5.5 (was 5) — mean 5.38

Technical audit 739 (200 pages asked, JavaScript crawl, health 85, 24 findings), the Audit Scheduler's audit 794 (no JS, health 85),
full report 767 (health 70, 55 findings), pre-release checks 740–744, publish checks 745–752.

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 1.1 | 6 (6) | "Crawled 45 of 45 known URLs", the two 308 bare-host redirects crawled but excluded from analysis ("Only 45 of 47 crawled pages were analysed in detail") — R63 gone. Cap is the 1,000-page limit (`shared/src/schemas.ts:202`); this site has 45. | Whole site, seeded and classified. |
| 1.2 | **5** (4) | R59 gone: the host split is its own finding with the right fix ("submit https://www.techand.ai/sitemap.xml … Requesting indexing page by page does not help"), with Google's chosen canonical read; no findings on 308 stubs; the four crawl-extras reports answer (R64's "Task Not Found" gone). Held by **B-6** (the first item's reason reads "Google cannot index or follow these pages", contradicting the finding) and **B-16** (`http://techand.ai/` → bare → www, two hops, unreported; "HTTP correctly redirects to HTTPS"). hreflang not exercisable (none declared). | Correct on a labelled fixture set; every redirect chain. |
| 1.3 | **7** (6) | 45 of 45 key pages inspected, 0 failed; the 15 "not indexed under www" explained as the host split; the audit and the full report 8 minutes apart agree on 30 / 15 (on 2026-10-15 they differed for 5 pages). The Pages report is not trended; removals not detected. | Every important page + trended Pages report + removals. |
| 1.4 | **4** (5) | Response vs render now on 25 of 45 pages (5 rendered + 20 paired with the JS crawl). **B-1 (High)**: the 20 paired pages compare our parser's raw-HTML count with DataForSEO's `internal_links_count + external_links_count` and `plain_text_word_count` (`Render_Diff.js` l.127–128) while the report says "read from both with the same parser"; the raw side is larger on all 20; GPTBot and a browser receive byte-identical HTML; the finding is scored Medium with "Server-render at least the title …" beside "All 11 search and AI crawlers … receive the full page" in the same report, and contradicted by the full report 8 minutes later. The 5 rendered pages agree correctly. A diff that is wrong on 80% of the pages it reads. | Response vs render on every page with one parser (Sitebulb). |
| 1.5 | 4 (4) | CrUX enabled, `no_data` per template, Info, unscored; the technical audit runs no lab test; the full report has homepage lab scores (91 vs 48 / 29). Cap 4 (homepage / lab only). | CrUX p75 per template, trended. |
| 1.6 | **6** (5) | Every finding carries measured page rows (`estimated: false`: orphans "about 0 clicks and 17 impressions", lorem ipsum "0 / 8") — R65 gone; GA4 key events asked for and honestly not used ("none configured, or none happened"). The index-relevant item is first, but with B-6's wrong reason, and B-1's false finding is scored 6th. | Severity × affected clicks, correctly. |
| 1.7 | **5** (6) | Page Watch 789: 25 pages + robots.txt, 26 × 200, nothing changed, menu fragments gone (R92). Diffs now go wrong in two ways: the full report's "5 fixed" are titles that disappeared because the check changed (**B-5**), and audit 794 calls the JS finding "fixed" 48 minutes after 739 because `seo_audits` does not record `crawl_js` (**C-5 / D-5**, `no_longer_seen []`). Page Watch has not fired on its own since 2026-10-16 15:15 (5 h 30 min late); 2026-10-17's was replayed 5 h 24 min late (C-1). Alerts reach the ops webhook only. | ContentKing / Always-on Audit: alerts within hours, diffs that know what changed. |
| 1.8 | **5** (4) | Pre-release live with the new fields: `fail_on` threshold and an `expected` list with reasons echoed, a stale entry reported (`expected_unused`), bad input a 400 with every error listed; exit codes 0 / 1 / 2; production wording (R75 gone); `writes "none"`. Still 8 checks; a missing description can never fail a release (B-13), nor a doubled brand title or live lorem ipsum; no candidate-vs-live comparison. | Lumar Protect: 350+ tests that block a deploy. |
| 1.9 | 6 (6) | Fix pack keeps every robots.txt line; llms.txt "compare first"; three JSON-LD blocks; `internal-links.csv` — which links the six near-duplicate pages the audit says to consolidate, with two anchors cut mid-word (B-15). No Service block although the full report raises "no Service schema" (High, true). Files only. | Patches / PageWorkers deploy and re-check. |
| 1.10 | 4 (4) **(NL)** | "I fixed this" re-check not requested. | Re-checked within days. |
| 1.12 | 7 (7) | 6 orphan `/whatwedo/*` pages (true, checked live), 7 near-duplicate pages named (true, 97.6–100%). | |
| 1.13 | 6 (6) | "Service pages have no Service schema" true; generated blocks clean; none generated for services. | Validated and generated per page type. |
| 1.14 | **5** (3) | Executor B checked all 24 findings of 739 against the live site: **17 true, 1 false, 2 partly true, 4 not verifiable** — 85% precision where verifiable (17 / 20), against 68% on 2026-10-15; the one false finding covers 20 pages. The full report's own items are lower (by B's table ≈ 19 true of 25 verifiable, with B-2 false as a High and B-3 / B-4 misleading). | ≥ 95% precision on a labelled set, published. |

**Area:** (6 + 5 + 7 + 4 + 4 + 6 + 5 + 5 + 6 + 4 + 7 + 6 + 5) / 13 = 70 / 13 = **5.38 → 5.5** (1.11 n/a: small site).

**What would have to be true to score higher.**
- **Next full point (6):** ≥ 74.75 (+4.75). Like-for-like render comparison (B-1 gone: 1.4 → 6, +2), the crawl method stored and diffs
  saying "no longer reported (our check changed)" (B-5, C-5: 1.7 → 6, +1), the http → bare → www chain reported and B-6's reason fixed
  (1.2 → 6, +1), live precision ≥ 90% (1.14 → 6, +1) → 75 / 13 = 5.77.
- **Next half point after that (6.5):** ≥ 81.25. Fix deployment with a live re-check (1.9 → 8, 1.10 → 6), customer-facing key-page
  alerts (1.7 → 7), CrUX or lab per template (1.5 → 5), a trended Pages report (1.3 → 8).

### 3.6 Rank tracking: 5.5 (was 5.5) — mean 5.38

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 2.1 | 4 (4) | Weekly on paper, on demand through the Test Runner (785, 24 s). The Rank Tracker has **0 trigger-mode executions ever** (`C-schedule-executions.json`); no Monday has passed since the deploy, so the new catch-up is untested for it, and it replays only fires due in the last 36 h (C-1). No re-check after a publish or fix. | AccuRanker / Semrush: daily + on-demand. |
| 2.2 | 6 (6) | Depth 50, trimmed SERP stored per reading; subjects now say "top 50" (R91 gone). **C-4**: "the whole results page moved: 9 of the top 9 places changed … 9 new pages came in" against a single reading (exec 715) that differs from the readings before it, while today's top ten equals the 2026-10-15 and 2026-10-16 00:33 readings exactly; "(noise)" used as a label the report does not define — R88's class. | SE Ranking cached SERP as proof; movement against more than one reading. |
| 2.3 | **5** (6) | Mobile bought for **1 of 12** readings (the new ladder's head); seven ladder reports read "no mobile check was bought for this ladder this week" (on 2026-10-15: 2 of 12). | Mobile and desktop for every keyword. |
| 2.4 | 4 (4) | Country level only. | City / ZIP; geo-grid. |
| 2.5 | 6 (6) | AIO, PAA, local pack, video, knowledge graph and reviews per reading; AIO sightings timestamped ("seen in 4 of 4 checks"); whether the AIO cites the site not loaded for most keywords. | ≥ 15 feature types, AIO citation per keyword. |
| 2.6 | 7 (7) | Modelled share of voice with the CTR curve and the Ahrefs Dec-2025 per-position loss printed; "unweighted" stated when no keyword has impressions; not trended. | Trended SOV against competitors. |
| 2.13 | 6 (6) | Competitors above per keyword, own competitors starred; no movers view. | 10–20 competitors with movers. |
| 2.14 | 5 (5) | $0.116 = 12 × task cost, "counted once by task id", equal to the account's movement. **D-3**: every one of the 9 reports shows "Total $0.116", and the app adds it to an unrelated 2026-10-08 app run's actual (0.1185 → 0.1905 → 0.3065). Monitors sit outside the company budget ($4.43 of ledger rows for the site that afternoon, none on its usage page). | Shown **and capped** per keyword. |

**Area:** (4 + 6 + 5 + 4 + 6 + 7 + 6 + 5) / 8 = 43 / 8 = **5.38 → 5.5**. Also capping, outside the criteria: C-7 (next steps that
contradict the Site Tracker), C-12 ("facts erp" still listed), C-13 (the ranking page and the "main page" differ without comment).

**What would have to be true to score higher.**
- **Next full point (6):** ≥ 46 (+3). Mobile for every ladder head (2.3 → 7, +2) and movement judged against more than one reading
  (C-4: 2.2 → 7, +1) → 46 / 8 = 5.75 → 6.
- **Next half point after that (6.5):** ≥ 50 (+7). The above, the Monday schedule firing on its own for a month on an always-on host
  (2.1 → 5), AIO citations loaded per keyword (2.5 → 7), each report's own cost and monitors inside a capped budget (2.14 → 6), plus
  daily + on-demand (2.1 → 6).

### 3.7 Site tracking (GSC / GA4 / Trends): 7 (was 6.5) — mean 7.17

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 2.7 | **8** (7) | 535 named queries paged; withheld "23 clicks and 1,451 impressions, 27.1% of all impressions" shown apart; one scraper query set aside; preliminary 3-day data apart; brand split "brand = techand, tech and" — the "tech" contamination of 2026-10-15 is gone (R89). No archive beyond 16 months. | BigQuery export, own archive. |
| 2.8 | 7 (7) | GA4: organic 81 of 310 sessions, landing pages, key events (0), AI-assistant sessions (0), direct sessions in the brand series (787). | Revenue per landing page. |
| 2.9 | 7 (7) | 45 of 45 inspected in the audits; the Site Tracker's inspection of 25 key pages feeds Page Watch; menu fragments gone (R92). C-15: two pages listed twice in the index-status table; `/dynamics-365-crm-uae` "planned" while "Submitted and indexed". | Every tracked page within quota. |
| 2.10 | **7** (6) | Striking distance, CTR gaps, Poisson-tested decay, and new: cannibalisation pairs, content groups with a significance rule, Discover / News stated as absent, not as zeros; "Fix the four drafts that failed the quality check … Do not publish them as they are" (R111 gone). **C-6 (Medium)**: "techandkey com" — a navigational search for another website — is the first striking-distance quick win, a "rewrite titles" item and a cannibalisation pair; "tech and tech" is listed as a pair although "brand searches are left out". | Each diagnostic with a right action. |
| 2.11 | **8** (7) | Two-sample Poisson tests on every change ("30 clicks (+36%, not statistically significant)", impressions "a real rise"); the app headline now follows the test — "Impressions in Google up 181% — a real change · 30 clicks from Google, within normal variation" (R113 gone, rendered in `render-results.json`); alerts on Slack + e-mail. | Statistical thresholds carried to every surface. |
| 2.12 | **6** (5) | R78 gone: the monitor block prints the full report and the technical audit on separate lines with no delta, backlinks as union vs union ("4 linking sites (all sources) ▲1 · DataForSEO's index: 19"); annotations name spam updates and audit events by type ("different checks, so the two scores are not comparable"). Held by **C-5 / B-5**: a change of crawl method or of a check is reported as "fixed" in the audit diffs; no num=100 note seen. | Breaks annotated and flagged everywhere. |

**Area:** (8 + 7 + 7 + 7 + 8 + 6) / 6 = 43 / 6 = **7.17 → 7**.

**What would have to be true to score higher.**
- **Next half point (7.5):** ≥ 43.5 (+0.5). Navigational searches for other sites set aside before any diagnostic (C-6: 2.10 → 8, +1)
  → 44 / 6 = 7.33 → 7.5.
- **Next full point (8):** ≥ 46.5 (+3.5). The above, the crawl method stored and method changes annotated (2.12 → 7, +1), an own archive
  beyond 16 months (2.7 → 9, +1) and revenue per landing page where GA4 has it (2.8 → 8, +1) → 47 / 6 = 7.83.

### 3.8 AI visibility (incl. pulse): 7 (was 6.5) — mean 7.00

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 4A.1 | 5 (5) | 7 buyer questions (decision 3, awareness 2, consideration 2) + the brand question weekly; 7 daily on the pulse; the market-wide index with the 4-character name left out and the reason printed; the AI search-volume lookup worked and returned 0 for all 7 phrasings (`stored_positive 0`), so "—" is honest (R85 gone). | Semrush 25 / Profound 100 prompts daily; 200M+ prompt databases. |
| 4A.2 | 7 (7) | ChatGPT, Perplexity, Gemini, AI Overview, AI Mode weekly + Claude monthly; 47 requests, 1 failed (AI Mode), retried, disclosed in line 3 (776); pulse 21 of 21 (779). No Copilot. | ≥ 6 localised engines. |
| 4A.3 | **8** (7) | The denominator is stated as computed — "54 answers … (34 this run + 20 from the daily pulse); Claude's 7 answers … not in the headline" — and the by-engine table adds to it (R84 gone); Wilson ranges recompute (mine: 0/54 → 6.64%); a Holm correction across the run's 5 tested alerts is printed and applied as stated; per-engine tests withheld below 12 samples and not claimed; the on-demand pulse no longer overwrites the scheduled reading (R95 gone; rows 10 and 11). C-9 (Low): the comparison basis lists Gemini, which answered nothing in the previous run, and the period label says 7 days where 1 pulse day was counted. The pulse missed its own schedule on 10-16 and 10-17 (scored in 3.13). | Daily samples, ranges, alerts beyond noise. |
| 4A.4 | **8** (7) | Mention, citation, share of voice over 139 mentions with its range, sentiment, cited URLs, AIO presence over requests read (`aio_basis {requests 7, read 7, shown 7, failed 0}` — R84's failed-request count gone), competitors by domain; rivals named as rivals and kept out of "where to get featured" (R83's "pitch wafeq.com" gone). C-2: vendors cited as sources (erp-dubai.ae, halsimplify.com, penieltech.com) still labelled "site (PR target)" and written as `ai_source` prospects — charged to 4A.9. | Full metric set, correct denominators. |
| 4A.5 | 5 (5) | "What AI gets wrong: not checked … fill the business profile" — honest; nothing checked (no profile). | Accuracy checks mandatory. |
| 4A.6 | 8 (8) | GA4 AI visits, key events and revenue wired and read; 0 AI sessions. | |
| 4A.8 | 8 (8) | robots.txt and llms.txt read; 8 of 8 answer bots allowed; homepage fetch 200 for four bots; AI Growth fetched 12 key pages as four AI user agents (48 × 200). | |

**Area:** (5 + 7 + 8 + 8 + 5 + 8 + 8) / 7 = 49 / 7 = **7.00 → 7**.

**What would have to be true to score higher.**
- **Next half point (7.5):** ≥ 50.75 (+1.75). The owner's business profile filled so the fact check runs and checks something (4A.5 → 7,
  +2) → 51 / 7 = 7.29 → 7.5.
- **Next full point (8):** ≥ 54.25 (+5.25). The above, ≥ 20 buyer questions with real demand and then 100 (4A.1 → 7, +2), Copilot / a
  localised UI engine (4A.2 → 8, +1) → 54 / 7 = 7.71 → 8 needs one more point (e.g. 4A.3 → 9 with daily samples on all engines).

### 3.9 AI growth: 6 (was 6, NL) — mean 6.00 — **partly NL**

First live run in a rating: exec 783 with `dry_run: true`. Executor C confirmed in the live workflow that both submit nodes are gated on
`!$json.skip && !$json.dry_run` and that neither ran. Nothing was due for submission (`submit: []`), so **the dry-run branch and any
submission were not exercised**; 4A.10's submission part stays NL and capped at the last live evidence (10-14).

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| Readiness | 7 (7 NL) | Live: 12 key pages fetched as OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-User (48 × 200), scored average 81 ("was 75"), one fix each ("The date is only in the metadata: show it on the page"). The scores were not checked against the pages by anyone, so held at the last live level. | AEO / AI-discoverability audits. |
| 4A.7 | 6 (6 NL) | 6 questions queued — 2 "written as the keyword ladder page … (one search, one page)", 4 with no page; none written (the cadence is paused). | Each fan-out search covered by a section. |
| 4A.9 | 5 (5 NL) | "15 page(s) AI cites without naming you, 9 handed to the Link Builder (one writer)". **C-2**: "Ask the editor of flick.network to add Tech& to this list" — flick.network is among the businesses AI recommends instead (776) and the Link Builder refuses it as a competing site (781); **C-3**: two different MoF pages "93x" each and the FTA page "79x", with a lineage that says "the last weekly AI-visibility run", which counted mof.gov.ae 18 and tax.gov.ae 14. No win measured. | Actions → pages → outreach → "won". |
| 4A.10 | 6 (6 NL) | "Of 22 page(s) sent in the last 45 days, 18 have since been crawled by Bing and 4 not yet — measured from Bing Webmaster Tools"; Bing quota read; IndexNow key file still answers an HTML page; no Wikidata item. Submission not exercised (NL). | Bing / IndexNow + entity check. |
| Drafts | 6 (6 NL) | Drafts nothing itself; the Link Builder's writer this run declined complyance.io for the right reason and all 3 drafts were held — but its gate still qualifies five same-service sellers (C-8). | |

**Area:** (7 + 6 + 5 + 6 + 6) / 5 = 30 / 5 = **6.00 → 6**. Also, scored in 3.12: the dry run lands in the app as a normal deliverable
report titled "AI growth: done for you this week" with the dry-run note not rendered (C-11 / D-4). AI Growth has 0 trigger-mode
executions since it was created.

**What would have to be true to score higher.**
- **Next half point (6.5):** ≥ 31.25 (+1.25). The AI-visibility rival list applied to AI Growth's earned media and to the "PR target"
  label (C-2: 4A.9 → 6, +1) and per-page citation counts from the stated run (C-3) plus the Link Builder gate of 3.11 (Drafts → 7, +1)
  → 32 / 5 = 6.4 → 6.5.
- **Next full point (7):** ≥ 33.75 (+3.75). The above, a real weekly run with the IndexNow key hosted and submissions checked
  (4A.10 → 7, +1) and a queued question written and checked on a live page (4A.7 → 7, +1) → 34 / 5 = 6.8 → 7.

### 3.10 Backlink monitoring: 7.5 (was 7) — weighted mean 7.33

Exec 777, started 2 s after AI visibility — the 2026-10-15 refusal condition. It ran: its ledger row is keyed `parent:775` (R77 gone).

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 4B.1 | **8** (7) | DataForSEO 2, Bing 0, Search Console upload 1, GA4 1, Common Crawl 1 → union **4** (+1); "Of the 1 sites in Google's own sample … DataForSEO sees 0%". The app hero and tiles now say "Linking sites (all sources) 4 — DataForSEO's index alone: 19, incl. 18 link-farm links set aside" (R112 gone, rendered). | Several sources merged + % of Google's sample, consistently. |
| 4B.2 | 8 (8) | "Of the 20 referring pages we could read, 3 still carry the link (15%), and of the 18 the DataForSEO index reports live, 1 are live (6%)." | Linkody re-checks. |
| 4B.3 | 8 (8) | `lost []`, "every linked page works"; the new farm link techbumppy.com marked `at_risk` / `verified: missing` rather than counted. No real loss to test (partly NL). | 8 lost reasons. |
| 4B.4 ×1.5 | 8 (8) | 18 farm links set aside with the footprint ("the same page path on 17 sites (/all/2835/13.html)"); peppol.org (DR 77, "✓ on the page") and tracxn.com (nofollow, labelled) as the best links. | |
| 4B.5 | **7** (6) | Review-only disavow, alert level `low`; spam tile "the index's figure · the 18 link-farm links behind it are set aside, not counted" (R112); the anchor block now marks the farm anchors in the table it reports (R92 gone). | Alerts on keyword-anchor spikes. |
| 4B.6 | **7** (6) | The 8 "best of" lists are list pages by title (on 2026-10-15 five were competitors' service pages; R86's list half gone); government refused with a reason. **C-10 (Low)**: marketguest.com's Malaysian property article saved as a `comp_new` prospect; gulfnews.com refused as "neither its name, its page nor its country ties it"; every one of the 8 prospects aimed at `/dynamics-365-crm-uae`, including four e-invoicing lists. | Competitor gap, new links, real "best X" lists. |
| 4B.7 | 5 (5) | Unlinked mentions not reported this run; not tied to the AI-visibility figures. | Mentions first-class, tied to AI visibility. |

**Area:** (8 + 8 + 8 + 8×1.5 + 7 + 7 + 5) / 7.5 = 55 / 7.5 = **7.33 → 7.5**.

**What would have to be true to score higher.**
- **Next half point (8):** ≥ 58.1 (+3.1). Unlinked mentions found and tied to AI visibility (4B.7 → 7, +2), each prospect matched to the
  page on its topic and off-topic pages filtered before saving (C-10: 4B.6 → 8, +1), and a real lost link handled live with its reason
  (4B.3 → 9, +1) → 59 / 7.5 = 7.87 → 8.

### 3.11 Link building: 6.5 (was 6.5) — mean 6.67

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 4C.1 | 8 (8) | AI-cited pages, resource pages, broken links (turbolens.io's dead concur.com.sg source), competitors' new links, 5 podcasts read with their topic match, a 16-item listings checklist; 11 qualified, 37 not fit with reasons, in 2 min 23 s (781). | |
| 4C.2 | **6** (5) | New services-overlap rule refused tronstride.com ("offers 7 of your services … with the signals of a vendor"), mabbaz.com and creuto.com with the evidence quoted; the outranks-you rule refused ten more; accredited-provider lists refused honestly ("asking to be added claims it"). No competitor got a draft this time (2026-10-15: daxin-global.ae). But **C-8**: erp-dubai.ae ("ERPNext Implementation Partner in UAE & Dubai 2026", `needs_contact`, fit 0.84, `reasons []` — my check of `exec-781.json`), penieltech.com (Odoo implementer), pactsoft.ae, halsimplify.com (HAL ERP) and tradeshift.com qualified; complyance.io `ready` (the writer declined it). Same-service sellers through the gate, fourth rating running. | Value × likelihood; no rivals. |
| 4C.3 | 7 (7) | Contacts on the prospect's own domain; 8 `needs_contact`. | Second contact at the site. |
| 4C.4 | 7 (7) | Every quoted line exists on the prospect's page (executor C fetched all three); the dead link the draft names is dead; all 3 drafts held with the missing items named ("needs you: [Your name]"; "the first e-mail links to concur.com.sg, not to your site"). | AI draft edited by a person. |
| 4C.5 | 7 (7) | Reply Reader 753–756: 4 of 4 classes right; OOO return parsed to 2026-11-02 with the colleague captured; unsubscribe recognised; questions left as `[Owner: …]`. A-3 (Low): the replier recorded as their own referral. No live send (NL). | Bounce < 2%, ≤ 49 sends / day, measured. |
| 4C.6 | 5 (5) **(NL)** | No mailbox connected (by rule). | Customer's own authenticated mailbox. |
| 4C.7 | 8 (8) | Reply Reader 756 fetched peppol.org's members list and found the link (`rel follow`, placement content) before the thank-you. | |
| 4C.8 | 5 (5) | Link text = page title or brand; targets are weak fits — "Why Tech&" for an AP-automation source, the Dynamics 365 CRM page for e-invoicing readers (781); every backlink prospect aimed at the CRM page (C-10). | Brand / title anchors aimed at hub pages. |
| 4C.9 | 7 (7) | peppol.org "Too early to tell" (1 week), tracxn.com "Can't tell — the page had no search impressions before or after the link"; control group = the site's other pages; never "caused". | |

**Area:** (8 + 6 + 7 + 7 + 7 + 5 + 8 + 5 + 7) / 9 = 60 / 9 = **6.67 → 6.5** (6.75 would have rounded up).

**What would have to be true to score higher.**
- **Next half point (7):** ≥ 60.75 (+0.75). The overlap rule applied to implementation partners and e-invoicing vendors whatever words
  their page uses (C-8: 4C.2 → 7, +1) → 61 / 9 = 6.78 → 7.
- **Next full point (7.5):** ≥ 65.25 (+5.25). The above, the owner's mailbox connected and one approved sequence sent with replies stopping
  it (4C.6 → 7, 4C.5 → 8, +3), and pitches aimed at hub pages on the prospect's topic (4C.8 → 7, +2) → 66 / 9 = 7.33 → 7.5.

### 3.12 Reporting & app: 5 (was 4.5) — mean 5.00

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 3.1 | **7** (6) | The site report leads with clicks, impressions, sessions and key events, a clean brand split and a brand series kept apart from AI referrals (787); the hero follows its test (R113 gone). No revenue (0 key events recorded). | Revenue / leads, brand vs non-brand, before ranks. |
| 3.2 | **4** (3) | The 2026-10-15 class is gone from the monitor reports (R61, R78, R112, R113, R84, R41 not reproduced), and the wording stays honest ("not checked", "within noise", "modelled"). Delivered documents still contradict themselves: **B-1** (audit: "AI crawlers see a different version of 20 key pages" beside "All 11 … crawlers … receive the full page"), **B-2** (full report: "does not rank at the top for its own brand name", High, beside its own Search Console "techand" #4.5, "tech & ai" #2.7), **B-4** (`site:` estimate 8 vs its own URL Inspection 30 of 45), **B-17** (competitor table 300 / 196 vs headline medians from 886 / 511), **C-4**, and "fixed" for unchanged items (**B-5**, **C-5 / D-5**). A-22 tells the owner false things about which of their pages ranks. | No number its own document contradicts. |
| 3.3 | **4** (3) | One shared QA state now read by the cadence, the site report and most rank next steps (R111 gone); R87 gone; AI visibility names rivals as rivals (R83 gone there). Still: **C-7** (Rank Tracker and Site Tracker give opposite next steps for "ai consulting" and "it consulting dubai" within 3 minutes), **C-2** (AI Growth tells the owner to pitch flick.network, a rival the Link Builder refuses; AI visibility labels vendors "PR target"), **C-12** ("facts erp" listed vs `set_aside`), B-1 vs the full report 8 minutes later, A-21 (two verdict scores 52 / 48 three minutes apart). No impact × confidence × effort queue across modules. | One queue: impact × confidence × effort. |
| 3.4 | 3 (3) **(NL)** | Control-group impact for links only; no page / fix change test exercised. | SEOTesting / SearchPilot. |
| 3.5 | 5 (5) | "What happened in this period" annotations in the site report (spam updates, audit events by type). Chart annotations in the app not exercised (no session in the company). | Marked on charts automatically. |
| 3.6 | 6 (6) | Dashboard, PDF, Word, HTML, Markdown, images, fix-pack files, CSV, read API, MCP; 26 reports landed, 52 renders with the app's own `ReportView` — 0 fallbacks, 0 errors, 0 overflow, no "undefined" / "NaN"; the delivery rule now delivers finished monitor reports and holds the QA-failed draft (`not_ready`) and the started notes (`interim`) — R110 gone. Held by **D-4 / C-11 (Medium)**: the AI Growth dry run is `deliver`, titled "done for you this week", its dry-run note not rendered. Scheduled delivery has never sent anything (`report_deliveries` 0 rows ever; no SMTP on the app server; delivery off for every company); "Send a test" fails correctly on an unreachable webhook and the address guard refuses five private / metadata hosts. | Scheduled PDFs to 50 recipients. |
| 3.7 | **4** (3) | Share links and a viewer role exist; the app's `shareCaveat` now leaves finished monitor reports shareable and marks the draft "A draft, not finished work" (R110). No share link was created or opened this run (NL for the live link); no portal or custom domain; the MCP server names itself "Dev SEO" to clients (D-12). | White-label portal. |
| 3.9 | **5** (4) | The deliberate failure (798) reached Slack (HTTP 200) and the ops mailbox (SMTP 250) in 3.6 s, recorded `webhook,email`; an older due alert retried once and written back (R79 gone); no monitor re-sent anything. **D-8**: when DNS is down at the moment of failure both channels fail and the alert waits for another workflow's run (the 18:31 alert reached Slack ≈ 2 h later); C-16: the IMAP mail watcher dropped four times in 22 hours and its reactivation is logged as failed while the workflow reads `active: true`. | Severity, de-duplication, quiet unless real, on its own timer. |
| 3.11 | 6 (6) | Lineage on every report; the full report's rows match what the run did (checked by executor B); C-3 (earned-media counts vs their stated source) and C-9 (period label) do not. | Lineage on every number, correct. |
| 3.12 | 6 (6) | Search Console (incl. links export), GA4, Bing, Business Profile, CrUX, PageSpeed, Slack / webhook, Gotenberg, read API + MCP (8 tools). WordPress off; Google sign-in off on this server. | AgencyAnalytics 80+. |
| UI | — | Not a criterion (as on 2026-10-15). A new customer in a real browser: 212 visits at 1440 / 390 px, light / dark — 0 failed requests, 0 overflow, an h1 everywhere; the ownership gate holds; verification messages honest; budget refusal 402 before anything is stored. **D-1 (High): onboarding step 6 crashes on every load** (`useOrgCtx outside OrgLayout`, confirmed in code); "Back to home" loops back to the step before it. Also D-2, D-9–D-11. | |

**Area:** (7 + 4 + 4 + 3 + 5 + 6 + 4 + 5 + 6 + 6) / 10 = 50 / 10 = **5.00 → 5** (3.8 is counted in 3.13, as in 2026-10-11).

**What would have to be true to score higher.**
- **Next half point (5.5):** ≥ 52.5 (+2.5). The audit and the full report free of the B-1 / B-2 / B-4 / B-17 class and "fixed" only when
  the site changed (3.2 → 5, +1), one page state and one rival list read by every report (C-7, C-2: 3.3 → 5, +1), and a dry run held or
  labelled (D-4: 3.6 → 7, +1) → 53 / 10 = 5.3 → 5.5.
- **Next full point (6):** ≥ 57.5 (+7.5). The above, alerts retried on their own timer (3.9 → 6), a real delivery to a person and a share
  link opened signed out (3.7 → 5), a page / fix change test seen live (3.4 → 5, +2) and chart annotations in the app (3.5 → 6) → 58 / 10.

### 3.13 Cost control & reliability: 4.5 (was 4) — mean 4.60

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| Guards | **6** (5) | Every run reserved and settled its ledger row; none left `reserved` (rows 136–165). The concurrency gate let backlinks run beside its own parent (row 155 `parent:775`; R77 gone). Front-door rows 153 / 154 settle $0 and the children carry the money: rows 153–165 sum $1.4785 against $1.4905 moved on the account (R81 gone). The app's budget check refused a run that would exceed $0.05 with a 402 before any row or execution existed (API-1) and holds the engine's calibrated figure. Held by D-2 (two prices for one run on the tools cards vs the forms) and monitors outside the company budget. | Server-side plan limits. |
| 3.10 | **5** (4) | DataForSEO per run equals its own task costs; the two windows land at −0.01% and −0.8% of the account (−0.5% overall); runs alone in their window state `attributed: true` and agree to the cent. Claude answers are now counted in tokens (R47 / R80 gone); every report card shows both parts and which is estimated (R114 gone). Remaining: modelled thinking puts the Claude ledger 19–30% above n8n's figure on non-streaming nodes (A-27, labelled modelled), short calls under-counted (A-28), the audit estimate ignores the JS crawl (B-9), one tracker run's cost on 9 reports and accumulating on an unrelated run (D-3). | Estimate, budget, actual vs estimate reconciled. |
| 2.14 | 5 (5) | As 3.6. | |
| 3.8 | 3 (3) | Every execution of the run `success` except the deliberate failure. But **C-1 (High)**: Rank Tracker, Site Tracker, AI Growth, Content Cadence, Link Builder and the Audit Scheduler have **never** fired from their own schedule; since the 2026-10-16 deploy **no** workflow has; the pulse missed 10-16 and 10-17 and Page Watch 10-17, replayed 4 h 40 min – 7 h 58 min late by the new catch-up at deploy restarts; the catch-up replays only fires due in the last 36 h (the Monday 2026-10-12 fires are lost) and its own sweep 728 was cancelled by its 900 s limit after the VM was suspended mid-node. The catch-up is new and worked twice; the delivery rate on time is still 0 since the deploy. | Every automation visible; delivery ≥ 99% measured. |
| Ops | 4 (4) | Alerts reach Slack and e-mail; the stale-alert loop is gone. Still Mac-hosted (sleeps; DNS absent on wake — D-8), the IMAP watcher's real state unknown (C-16), the Test Runner found left `active` from the fix wave. | Hosted, always-on, alerted. |

**Area:** (6 + 5 + 5 + 3 + 4) / 5 = 23 / 5 = **4.60 → 4.5**. Cap due: the always-on host is an owner item not bought; the 36-hour
catch-up window, the timeout that counts suspended time and the IMAP reactivation are not.

**What would have to be true to score higher.**
- **Next half point (5):** ≥ 23.75 (+0.75). One price per run on every screen and each report's own cost (D-2, D-3: 3.10 → 6, +1) →
  24 / 5 = 4.8 → 5.
- **Next full point (5.5):** ≥ 26.25 (+3.25). The above and a month in which every scheduled fire arrives — an always-on host, or at
  minimum a catch-up that covers a missed Monday and a timeout that ignores suspended time (3.8 → 5, Ops → 5, +3) → 27 / 5 = 5.4 → 5.5.

---

## 4. Outcomes (reported, not rated)

- **Rankings: none from the system's work.** Of 12 live readings (785) one tracked page is in the top 50 — "peppol uae" **#46** (was #48)
  with the PINT-AE integration guide, a page that predates the system's content. Search Console holds 20 queries at an average position
  ≤ 10 (3 brand), on existing pages.
- **Published pages: none.** Six unpublished pages wait: 2 `written` (passed QA: "erp software uae", "service industry erp software"), 4
  `not_ready` (failed QA, incl. today's "it consulting dubai"). The cadence is paused on the pile-up guard.
- **AI answers: named in 0%** of 54 answers (95% range 0–6.6%), pages cited 0%, share of voice 0% of 139 mentions (0–2.7%); the brand is
  recognised by 5 of 5 assistants; an AI Overview on 7 of 7 searches read, citing the site in none; GA4 shows 0 AI-assistant sessions.
- **Links: none won.** 4 referring sites after the merge of five sources (best: peppol.org, follow; tracxn.com, nofollow); 18 farm links
  set aside; 3 drafts held for the owner's name; no mailbox; nothing ever sent.
- **The site's own search data:** clicks 30 (+36%, not significant), impressions 5,358 (+181%, a real change), average position 25
  (from 31.3), organic sessions 81 (+84%, real), 0 key events — not attributable to this system; nothing it wrote is live.
- **The host split persists:** Search Console shows 37 pages / 5,016 impressions on `https://techand.ai` against 24 / 743 on www (739); the
  audit now reports it correctly and gives the fix.
- **Cost of the re-rating:** ≈ $3.85 (DataForSEO $2.5905 measured from the account; Claude $1.2558 from n8n's token counts, of which
  $0.3567 is n8n's estimate for three Opus streaming calls) for executions 736–799 — the same as 2026-10-15's $3.86.

## 5. Defects that capped scores

| Defect (severity) | Run / file | Criteria capped | Without it |
|---|---|---|---|
| A-22 wrong page named in 17 of 79 Search Console rows (High) | 764, `A-discover-764-strategy.json` | K8, 3.2 | K8 +1–2 |
| A-23 keyword report: build a page the site has (High) | 765 | K8, K9 | K9 7 |
| A-8 / A-9 / A-10 one keyword on two pages; SERP rule applied to the head only (High / Medium) | 770 | K8, K7, K9 (plan) | K9 (plan) 6, K7 7 |
| A-12 7th active ladder, page 6 written past the pile-up limit (Medium) | 770, 771 | K12, C14 | K12 5–6 |
| A-1 / A-5 / A-25 keyword tools that read the ladders but not the pages, or neither (Medium) | 750, 760, 764 | K8, K9 | |
| B-3 attestation / jobs / another company in the full report's keyword lists (High) | 767 | K5 | K5 6 |
| A-24 competitor set from a job-board SERP (Medium) | 764 | K6 | K6 8 |
| A-11 off-fit rung; list-intent rung as a service page (Medium) | 770 | K4, K9 (plan), K5 | K4 7 |
| A-13 / A-14 / A-15 / A-16 / A-17 page QA: bracket miscount, dead links, invented client terms, competitor brand headings, quick answer removed (Medium) | 771 | C1, C3, C7, C9 | C3 7, C9 6, C1 7 |
| B-1 JS comparison of two parsers, 20 false pages (High) | 739, `Render_Diff.js` l.127–128 | 1.4, 1.14, 3.2 | 1.4 6 |
| B-2 brand High from one SERP read (High); B-4; B-17 | 767 | 3.2, 1.14 | 3.2 5 |
| B-5 / C-5 / D-5 "fixed" when the check or the crawl method changed (Medium) | 767, 794 | 1.7, 2.12, 3.2 | 1.7 6, 2.12 7 |
| B-6 / B-16 host-split reason; two-hop redirect unreported (Medium / Low) | 739, 767 | 1.2 | 1.2 6 |
| C-1 the weekly loop never runs by itself (High) | `C-schedule-executions.json`, 728 | 3.8, 2.1, 1.7, Ops | 3.8 5–6 |
| C-2 / C-8 / C-10 rivals and same-service sellers as pitch targets and prospects (Medium / Low) | 776, 781, 783, 777 | 4A.9, 4C.2, Drafts, 4B.6 | 4C.2 7, 4A.9 6 |
| C-4 movement against one outlier reading (Medium) | 785 | 2.2 | 2.2 7 |
| C-6 another website's search as a quick win (Medium) | 787 | 2.10 | 2.10 8 |
| C-7 / C-12 contradictory next steps; "facts erp" (Medium / Low) | 785, 787 | K13, 3.3 | K13 6 |
| D-3 / D-2 cost repeated ×9 and added to an unrelated run; two prices (Medium) | app, 785 | 2.14, 3.10, Guards | 3.10 6 |
| D-4 / C-11 dry run delivered as the week's work (Medium) | 783, `render-results.json` | 3.6 | 3.6 7 |
| D-8 / C-16 alerts wait for the network and for another workflow; IMAP watcher (Medium) | 730, 731, 797 | 3.9, Ops | 3.9 6 |
| D-1 onboarding step 6 crashes for every new customer (High) | `MonitorSettingsFields.tsx:71` | none (outside the frozen criteria) — scored in Part B | |

**What this rating cannot prove.** Outcomes of published pages (nothing published: K10, K13, C9, C16, 4A.9 "won", 4C.9 reads); the weekly
loop on an always-on host (no Monday since the deploy; 2.1, 3.8, Ops); the owner's data (C2, C4, C17, 4A.5 and every "[Your name]"); a
mailbox (4C.5 / 4C.6); the app signed in inside the owner's company and a real delivery or share link (3.5–3.7); AI Growth's submission
path; WordPress push; the "I fixed this" re-check; a second and third site. If every criterion capped only by those items were lifted to
what its built capability suggests (C2, C4, C17, 4A.5, 4C.5, 4C.6, 2.1, 3.6, 3.7, 3.8, 1.10 by one to three points), the mean would rise
by ≈ 0.3 to ≈ 6.2 — still **6**. What holds it below 6.5 is correctness of the advice, not missing purchases.

---

# Part B — position against the October 2026 market

Judged from **this run's live evidence** against what the October 2026 leader does today (`this_run/MARKET_BENCHMARK.md`, sources opened
2026-10-17; vendor claims as the benchmark labels them). Ascentra's own column in the benchmark is its documentation: only what this run
or the code shows is credited. Same anchors: 0 absent · 2 manual · 4 automated but basic · 6 mid-market parity · 8 parity with the
leader · 10 beyond the leaders and proven live.

| # | Area | October 2026 leader (MARKET_BENCHMARK §3) | **Market** | Part A | Difference in one line |
|---|---|---|---|---|---|
| 1 | Keywords | Semrush (PKD on 28.7B keywords, 317M-prompt DB); Ahrefs on value | **5** | 6 | the rubric does not weigh data depth; 2 of 3 protocol keywords had no data at all |
| 2 | Ladders / clusters | Semrush Keyword Strategy Builder; Keyword Insights / SE Ranking for method | **5** | 5 | same |
| 3 | Content + QA | Surfer (scoring), Conductor (grounded drafting) | **5** | 6 | the market buys publishable pages; this run's page failed its own QA and invented client terms |
| 4 | Cadence / automation | Profound Aim, Search Atlas OTTO | **3** | 5 | the leaders publish on a schedule; Ascentra's cadence has never fired by itself or published |
| 5 | Technical audit | Botify (enterprise), Ahrefs (mid-market), Lumar (CI) | **4** | 5.5 | leaders deploy fixes, read logs and crawl millions of URLs; Ascentra does none |
| 6 | Rank tracking | Semrush (self-serve), seoClarity / BrightEdge (enterprise) | **3** | 5.5 | weekly that never fires, country only, mobile 1 of 12, 12 readings |
| 7 | Site tracking | Botify / seoClarity (testing), Conductor (breadth) | **6** | 7 | statistical treatment is ahead; warehouse exports, split tests and Adobe are absent |
| 8 | AI visibility | Profound (coverage), Evertune (statistics), Ahrefs Brand Radar (index) | **5** | 7 | statistics beyond every suite; a 7-question panel against 100–1,000 prompts |
| 9 | AI growth | Profound, BrightEdge, Botify, Scrunch, Adobe (acting at the CDN) | **3** | 6 | nothing submitted, nothing deployed; the 2026 move (edge, CMS) absent |
| 10 | Backlinks | Ahrefs (index), Semrush (toxicity), seoClarity (verification) | **5** | 7.5 | own-link verification at seoClarity's model; competitor research depth is DataForSEO's |
| 11 | Link building | Pitchbox (no suite leads); Semrush AI PR Toolkit sends | **4** | 6.5 | no e-mail has ever been sent |
| 12 | Reporting & app | AgencyAnalytics (client reporting); seoClarity LiveWire (data access) | **3** | 5 | onboarding crashes for every new customer; nothing ever delivered; no portal |
| 13 | Cost & reliability | Conductor (credit price, forecast, 99.5% SLA, status page) | **3** | 4.5 | cost transparency is ahead; reliability contract and hosting are absent |
| | **Mean** | | **4.2** (54 / 13) | 5.9 | |

### B.1 Per area

**1 Keywords — 5.** Leader: Semrush — Personal Keyword Difficulty on a 28.7B database and a 317M-prompt AI database
(semrush.com/kb/1434…, kb/1607…); Ahrefs leads on worth (Traffic Potential, adaptive traffic model with 15 SERP-feature CTR weights,
ahrefs.com/blog/new-features-july-august-2026/). Live: data is DataForSEO's; "business central partner uae" and "dynamics 365 partner
uae" returned no volume and no difficulty (750, 751); difficulty is one site-wide reach (10) with no keywords behind it; the verdict with
reasons, plan type, AIO-adjusted visits and dated sources (760) has no counterpart in the matrix (§2.1 row 6), but discover and the keyword
report misdirect the owner about their own pages (A-22, A-23). *Search Atlas:* 5.2B-keyword DB (VC), no personalised difficulty.
*Ahrefs:* larger index and Traffic Potential; difficulty generic by design. *Semrush:* PKD and the Strategy Builder do on its own data
what Ascentra approximates on bought data.

**2 Ladders / clusters — 5.** Leader: Semrush Keyword Strategy Builder (pillar → subpages with Topical Authority); SE Ranking / Keyword
Insights state their SERP-overlap method. Nobody else sequences a rank-gated climb with pile-up guards (§3.2). Live: 770 bought 20 rung SERPs
and printed the 40%-of-top-7 rule — Keyword Insights' convention — but split a pair at the threshold, put one keyword on two pages and
ignored its own active-ladder cap. *Search Atlas:* topical maps. *Ahrefs:* Parent Topic only. *Semrush:* pillar planning on its own data,
method not published.

**3 Content + QA — 5.** Leader: Surfer (Content Score split into SEO and AI-search halves, plagiarism check, Auto-Optimize; surferseo.com
updates Aug 2026); Conductor grounds drafts in Knowledge Sources. No suite refuses a draft for unverified facts (§3.3). Live: 771 wrote,
critiqued, edited and **held** a draft with honest reasons — a gate the market does not have — but the draft carries invented statements
about the client's pricing model, two 404 links and an uncounted bracket, so the deliverable is a draft to finish by hand. *Search Atlas:*
Content Genius writes and OTTO publishes. *Ahrefs:* AI Content Helper scores coverage for the chosen intent. *Semrush:* Content Toolkit and
SWA (Copyleaks originality).

**4 Cadence / automation — 3.** Leaders: Profound Aim (weekly projects → drafts → publish to ten CMSs after approval, citation decay) and
Search Atlas OTTO (publishes on autopilot). Live: the guard paused correctly (791) and names failed drafts; the cadence has **0
trigger-mode runs** since creation; no CMS push (WordPress sub-workflow inactive); six drafts wait. *Ahrefs:* Letaido WordPress connector
(partial). *Semrush:* WordPress publishing.

**5 Technical audit — 4.** Leaders: Botify (unlimited JS crawl, LogAnalyzer for Google and AI bots, PageWorkers at the edge since July
2026), Ahrefs (Always-on Audit + Patches via Cloudflare Workers with rollback), Lumar Protect for CI. Live: 45/45 crawled and inspected,
host split right, 85% of verifiable findings true, a pre-release check with threshold and expected-change list (none of the ten suites
offers one, §2.5 row 35) — but a 1,000-page cap (`schemas.ts:202`), no logs, no fix deployment, and a new JS comparison wrong on 20 pages.
*Search Atlas:* OTTO deploys by pixel (a competitor's test found the fixes invisible to non-JS / AI crawlers); no JS rendering per its help
(S). *Ahrefs:* Patches now cover titles, metas, canonicals, redirects, noindex, alt text and internal links. *Semrush:* 140+ checks;
enterprise log analysis; acting delegated to Adobe.

**6 Rank tracking — 3.** Leaders: Semrush (daily, ZIP, devices, cannibalisation, AI-prompt tracking), seoClarity (190+ countries,
ZIP/GPS, six engines), BrightEdge (68K local markets). Live: weekly schedule never fired; 12 readings on demand; country level; mobile 1 of
12; own-move-vs-churn reporting is unique in the matrix (§2.6 row 46) but measured against an outlier reading (C-4). *Search Atlas:*
daily with heatmaps (VC). *Ahrefs:* weekly by default — Ascentra's nominal frequency — but Ahrefs' runs. *Semrush:* daily to ZIP.

**7 Site tracking — 6.** Leaders: Botify / seoClarity (GSC bulk export, split tests), Conductor (GSC daily + GA4 + Adobe + annotations),
SEOTesting. Live: 535 queries paged, withheld share shown, Poisson-tested deltas carried to the app headline, brand series, content groups,
cannibalisation, Discover / News stated as absent — statistical treatment ahead of the suites; but no Looker / warehouse export, no split
test, no Adobe Analytics, no archive past 16 months, and a navigational query for another site as the top quick win (C-6). *Search Atlas:*
GSC / GA4 dashboards. *Ahrefs:* GSC import partial. *Semrush:* GSC / GA4 in its reports, Looker connector.

**8 AI visibility — 5.** Leaders: Profound (9–10 engines daily from consumer front-ends, licensed prompt volumes, agent analytics),
Evertune (100 samples per prompt per model), Ahrefs Brand Radar (481M+ prompt index). Live: 6 engines, 7 buyer questions weekly + 21 pulse
answers daily, Wilson ranges and a Holm correction that recompute (no suite in the matrix publishes intervals, §2.8 row 62), honest "not
checked" fact check — on a panel one to two orders of magnitude smaller, no personas, no Copilot. *Search Atlas:* 3–5 engines, 100–250
queries. *Ahrefs:* 8 engines, 5–20 daily custom prompts plus the index. *Semrush:* 317M-prompt DB, daily tracking, up to 9 engines on
enterprise.

**9 AI growth — 3.** Leaders: Profound (Aim publishes; Dynamic Bot Rendering), BrightEdge Agent Edge, Botify SpeedWorkers, Scrunch AXP,
Adobe Optimize at Edge. Live (dry run 783): readiness fetched as four AI bots, Bing crawl state measured (18 of 22), earned-media targets
— one of them a rival's list; **nothing submitted, nothing deployed**, IndexNow key not hosted, no CDN delivery. *Search Atlas:* QUEST
earned media. *Ahrefs:* AI-discoverability audit, found-not-cited (partial). *Semrush:* AI PR Toolkit; acting via Adobe Brand Visibility.

**10 Backlinks — 5.** Leaders: Ahrefs (35T historical records, 15–30 min freshness, 8 lost reasons), Semrush (45+ toxic markers),
seoClarity (multi-provider merge + re-crawl). Live: five sources merged, own fetch of 20 referring pages, 18 farm links set aside with the
footprint, % of Google's sample — the seoClarity verification model, on a site with four real referring sites. Competitor research depth is
DataForSEO's: the gap returned 20 rows, 19 refused. *Search Atlas:* "100T+" (own page only). *Ahrefs:* Link Intersect on the reference
index. *Semrush:* Backlink Gap and per-link toxicity.

**11 Link building — 4.** Leader: Pitchbox; among suites only Semrush's AI PR Toolkit sends from the customer's domain; Search Atlas acts
through the WILDFIRE exchange network (a link-spam policy risk Ascentra avoids by design). Live: 11 qualified / 37 refused with reasons,
quotes verified, 3 drafts held, Reply Reader 4/4 — but no e-mail has ever been sent, so there is no reply, bounce or win figure, and five
same-service sellers are still qualified. *Ahrefs:* research only.

**12 Reporting & app — 3.** Leaders: AgencyAnalytics (white-label portal, 85+ integrations, MCP, $20 per client), seoClarity LiveWire (API
+ MCP + Looker + warehouse). Live: 26 reports render cleanly; read API + MCP with company isolation proven (seven cross-company 404s, MCP
`isError`), scoped and revocable keys; delivery holds unfinished work (unique, §2.12 row 95). Against it: **a new customer cannot finish
onboarding** (D-1), no report has ever been delivered (no SMTP on the app server), no portal, internal names shown to customers ("Dev
SEO", `MS_OAUTH_CLIENT_ID`). *Search Atlas:* white-label portal, Slack / Teams / ClickUp. *Ahrefs:* Report Builder, scheduled PDFs to 50
recipients, no white-label. *Semrush:* My Reports; client portal discontinued in 2026.

**13 Cost & reliability — 3.** Leader: Conductor (published credit price per engine, forecast and burn-down, 99.5% quarterly SLA with
credits, status page, RTO 24 h / RPO < 1 h). Live: a dollar estimate before every run, a 402 budget refusal before any write, a ledger
within 0.5% of the provider's account — ahead of most suites (§2.13 row 97); but a laptop host that sleeps, no fire since the deploy, no
SLA, no status page. *Search Atlas:* shared credit pool, bills reported 3–4× list (3P), no SLA / status page. *Ahrefs:* units with caps per
MCP key, no status page. *Semrush:* units; SLA unspecified.

**Where the market score differs from Part A, and why.** Part A's mean is 5.9; the market mean is 4.2. The frozen rubric rates the
correctness and honesty of what each module computes, where Ascentra is strong (statistics, lineage, refusals, cost reconciliation, a fact
gate). The October 2026 market rates what a product **does for the customer at scale** — publishes, deploys, sends, tracks daily across
markets, runs unattended under a contract — and those are exactly the things this run shows Ascentra not doing (cadence, AI growth,
rank tracking, link building, reliability, reporting: gaps of 1.5–2.5 points). Only site tracking, ladders and backlinks come within a point.

### B.2 Enterprise readiness — **1.5 / 10** (mean 1.7)

From MARKET_BENCHMARK §4 and the code snapshot; nothing here was exercised against an enterprise buyer.

| Dimension | Score | Reasons |
|---|---|---|
| Security & compliance | **2** | Careful application layer: argon2id passwords (`server/src/auth/password.ts`), helmet headers, a CSRF header rule and rate limits (`server/src/app.ts` l.41–75), scoped read-only API keys with revocation, and company isolation proven live (seven cross-company 404s; MCP `isError`). Absent: SOC 2 / ISO 27001, pen test, a signed DPA (legal pages "Draft — to be reviewed by counsel", `LegalPage.tsx:163`), a stated no-training policy; the security contact is a placeholder (`content/site.ts:11`). Leaders: Conductor and BrightEdge SOC 2 + ISO 27001 + ISO 42001; Profound SOC 2 Type II. |
| Identity & governance | **1** | Four fixed roles (`shared/src/constants.ts:82`) enforced live (403s for a member). No SAML / OIDC, SCIM or MFA anywhere in `code/app`; Google sign-in only, and off on this server; no customer audit log (none of the 18 tables in `db/schema.ts`). Leaders: Profound SAML/OIDC + SCIM + RBAC; Ahrefs SAML and audit log on Enterprise. |
| Hosting & reliability | **1** | Docker on a Mac that sleeps: six of ten schedules never fired, none since the deploy, the catch-up's own sweep cancelled after a VM pause, alerts lost when DNS is down on wake (C-1, D-8, C-16). No SLA, status page, backups or DR stated. Leaders: Conductor 99.5% SLA with credits; Botify 99.98% public uptime. |
| Scale | **2** | Crawl 50–1,000 pages, JS ≤ 500 (`shared/src/schemas.ts:202–208`); 12 rank readings a week; a 7-question AI panel; one site rated, no external customer; data resold from DataForSEO. Leaders: seoClarity 48M+ pages, Semrush 5,000+ tracked keywords, Profound 100+ prompts daily. |
| Integrations | **3** | Search Console (incl. links export), GA4, Bing Webmaster, Business Profile, CrUX / PageSpeed, Slack / webhook, Gotenberg, read API + MCP with 8 tools. WordPress off; no Looker Studio, BigQuery / Snowflake, Adobe Analytics / AEM, Jira / Asana, other CMSs, or a write API. |
| Support | **1** | No named CSM; sales / support / partner addresses and prices marked `PLACEHOLDER` (`content/site.ts:8–10`, `content/pricing.ts:25`); no status page; no track record. |

An enterprise security questionnaire would stop at its first section (attestation, SSO, DPA) regardless of feature depth. As it stands the
product fits an SMB or agency pilot run by its own operator, not an enterprise purchase.

---

# Part C — what is missing to be the best enterprise-grade product

Effects are on Part A areas (area points; 13 area points = 1.0 overall) unless marked Part B. "Engineering" = in reach of the team;
"Money / data / vendor" = needs spend, data Ascentra does not own, or a third party; "Owner" = an owner decision or owner-supplied input.

### C.1 Defects to fix (wrong outputs seen live), ranked

| # | Defect | Evidence | Effect on the score | Kind |
|---|---|---|---|---|
| D1 | **Keyword paths do not read one state of the site's pages, ladders and Search Console's page column** | A-23 (765), A-22 (764, 17 of 79), A-8 / A-9 / A-10 (770), A-1 (750), A-5 (760), A-25 (764), A-12 cap bypass (770) | K8 5→7, K9 6→7, K9 (plan) 5→6, K12 4→6, K13 5→6: areas 1 +0.5, 2 +1, 4 +1 (≈ +2.5) | Engineering |
| D2 | **Schedules do not fire; the catch-up loses Mondays and times out on suspended time** | C-1, D-7 (`C-schedule-executions.json`, 728, `catchup:*`), C-16 | 3.8 3→5–6, Ops 4→5–6, 2.1 4→5: area 13 +0.5–1; prerequisite for every outcome criterion | Owner (host) + engineering (catch-up window, timeout, IMAP re-arm) |
| D3 | **Onboarding step 6 crashes for every new customer** | D-1; `MonitorSettingsFields.tsx:71` → `useOrgCtx` outside `OrgLayout` | none in Part A (outside the criteria); Part B area 12 and every trial | Engineering (hours) |
| D4 | **Technical / full-report findings that contradict their own data, and diffs blind to method changes** | B-1 (`Render_Diff.js` l.127–128), B-2, B-4, B-6, B-16, B-17, B-5, C-5 / D-5 (`seo_audits` lacks `crawl_js`) | 1.4 4→6, 1.2 5→6, 1.7 5→6, 1.14 5→6, 2.12 6→7, 3.2 4→5: areas 5 +0.5, 7 +0.25, 12 +0.25 | Engineering |
| D5 | **The business-fit gate is not one gate** | B-3 (767), A-11 (770), A-24 (764), C-6 (787) | K5 4→6, K6 7→8, K4 6→7, 2.10 7→8: areas 1 +0.5 (with D1), 7 +0.25 | Engineering |
| D6 | **One rival / competitor list is not shared by AI visibility, AI growth, backlinks and the Link Builder** | C-2 (776, 783), C-8 (781), C-10 (777), B-7 (767) | 4C.2 6→7, 4A.9 5→6, Drafts 6→7, 4B.6 7→8: areas 11 +0.5, 9 +0.5 | Engineering |
| D7 | **Page QA does not read what it checks** — company claims, links, brackets, its own answer block | A-15, A-14, A-13 (third rating), A-16 (third rating), A-17, A-19 (771) | C3 6→7, C9 5→6, C1 6→7, C7: area 3 +0.25 (+0.5 with B4) | Engineering |
| D8 | **Report state and cost display** | D-4 / C-11 (dry run delivered as real), D-3 (cost ×9, added to an unrelated run), D-2 (two prices), D-8 (alert waits for another workflow), C-14 / D-13 / C-15 (titles, duplicates) | 3.6 6→7, 3.9 5→6, 3.10 5→6, 2.14 5→6: areas 12 +0.25, 13 +0.25 | Engineering |
| D9 | **Rank-tracker movement and next steps** | C-4 (outlier reading), C-7 (opposite next steps), C-12 ("facts erp", fourth rating), C-13 | 2.2 6→7, K13, 3.3 4→5: area 6 +0.25 | Engineering |

### C.2 Capabilities to build (absent or below the leader), ranked

| # | Capability | Evidence (run / file / market source) | Effect on the score | Kind |
|---|---|---|---|---|
| B1 | **Production hosting with monitoring, backups, status page, then an SLA** | C-1, D-8; MARKET_BENCHMARK §5 #1 (Conductor 99.5% SLA, Botify 99.98%) | with D2: area 13 to ≈ 5.5–6; enterprise hosting 1→5 | Owner + money (modest; an SLA needs on-call people) |
| B2 | **Enterprise identity and compliance**: SAML / OIDC SSO, MFA, SCIM, customer audit log, DPA, SOC 2 Type II | `code/app` (none present); §4 / §5 #2 | Part A none; enterprise readiness 1.5 → ≈ 5 | Engineering (SSO / MFA / audit log M) + money / time (SOC 2: 6–12 months) |
| B3 | **Act on the site**: CMS publishing (WordPress on, then Contentful / AEM) and fix deployment with approval, rollback and live re-check | C16 / 1.9 / 1.10 evidence; §5 #3–4 (Ahrefs Patches, Botify PageWorkers at Edge, Profound Aim) | C16 5→7, 1.9 6→8, 1.10 4→6: areas 4 +0.5, 5 +0.5; Part B cadence 3→5, technical 4→5 | Engineering (L) + customer CMS / CDN access |
| B4 | **Owner inputs**: business profile, facts, reviewer, style guide; a connected mailbox and one approved send; the IndexNow key file | C4 / C2 / C17 / 4A.5 / 4C.6 NL; "[Your name]" on every draft | C2 5→7, C4 4→7, C17 5→6, 4A.5 5→7, 4C.6 5→7, 4C.5 7→8, 4A.10 6→7: areas 3 +0.5, 8 +0.5, 11 +0.5, 9 +0.25 (≈ +1.75) | Owner |
| B5 | **Rank-tracking depth**: daily + on demand, mobile for every keyword, city level, AIO citation per keyword, competitor movers | 785 (1 of 12 mobile, country only); §5 #7 | 2.1 →6, 2.3 →7, 2.4 →5, 2.5 →7, 2.13 →7: area 6 +1; Part B 3→5 | Money (SERP calls scale with keywords × locations × devices × frequency) |
| B6 | **AI-visibility scale**: ≥ 20 then ≥ 100 prompts with demand, personas / markets, Copilot, daily on all engines | 776 (7 questions); §5 #8 | 4A.1 5→7, 4A.2 7→8: area 8 +0.5; Part B 5→6 | Money (paid answers; prompt-volume data is licensed) |
| B7 | **Measurement layer**: page / fix change tests with a control, outcomes feeding K10 / C9, unlinked mentions tied to AI visibility | 3.4 NL; 4B.7 5; no published page | 3.4 3→6, 4B.7 5→7: areas 12 +0.25, 10 +0.25; required for 8 | Engineering + time (needs live pages) |
| B8 | **Agency delivery**: SMTP, scheduled delivery to people, white-label share pages / portal on a custom domain, product branding | `report_deliveries` 0 rows ever; D-12; §5 #12 | 3.6 / 3.7 → 7 / 5: area 12 +0.25; Part B 3→5 | Engineering (M) + owner (domain, mail account) |
| B9 | **Crawl scale and log analysis** (beyond 1,000 pages; Cloudflare / S3 logs; Google and AI bots verified) | `schemas.ts:202`; §5 #5–6 | Part A small (1.11 n/a here); Part B technical 4→5; enterprise scale 2→4 | Engineering (M–L) + money (crawl cost) |
| B10 | **Integrations and a write API**: Looker Studio connector, BigQuery export, Jira / Asana, a start-run endpoint behind the budget guard, native Slack | §5 #10–11 | 3.12 6→7: area 12 +0.1; Part B area 12 | Engineering (M each) |
| B11 | **Own or licensed data depth** (keyword DB, link index, prompt volumes) | 750 / 751 with no data; §5 #16 | K1 5→7 needs it: area 1 +0.25; Part B keywords / backlinks +1 | Money / data / vendor (a data business, not a feature) |

### C.3 Combined order (what to do first)

1. **D1** — one state of pages, ladders and Search Console read by every keyword path (largest Part A effect; three of eight Highs).
2. **D3** — the onboarding crash (hours of work; blocks every new customer).
3. **D2 + B1** — schedules that fire on an always-on host, and a catch-up that survives a missed Monday.
4. **D4** — audit / full-report truth and method-aware diffs.
5. **D5** — one business-fit gate for every keyword list.
6. **D6** — one rival list for AI visibility, AI growth, backlinks and the Link Builder.
7. **D7** — page QA that brackets unsupported company claims, fetches every link and counts every bracket.
8. **B4** — the owner's profile, facts, reviewer, mailbox and IndexNow key.
9. **B2** — SSO, MFA, audit log, DPA, then SOC 2 (the enterprise procurement gate).
10. **B3** — publish to the CMS and deploy fixes with approval and rollback.
11. **B5** — daily, mobile, city-level rank tracking.
12. **B6** — an AI panel of 20, then 100 prompts.
13. D8, D9, B8, B7, B10, B9, B11.

### C.4 Shortest path to 7 and to 8 overall

**Now:** 76.5 area points (5.88). **6.5** needs ≥ 81.25; **7** needs ≥ 87.75; **8** needs ≥ 100.75.

**To 6.5 — the defects alone.** D1–D9 fixed **and re-proven in a live re-run** move areas 1 (+0.5), 2 (+1), 4 (+1), 5 (+0.5), 6 (+0.5,
with mobile for every ladder head), 7 (+0.5), 9 (+0.5), 11 (+0.5) and 12 (+0.5): ≈ 82 points, mean **6.31 → 6.5**. All engineering in
reach; nothing to buy.

**To 7 — the defects, the owner items, and a set of builds.** One combination that reaches it (≈ 88 points, mean 6.77):

| Area | Now → target | What moves it |
|---|---|---|
| 1 Keywords | 6 → 6.5 | D1, D5 (K8 7, K9 7, K5 6, K6 8) |
| 2 Ladders | 5 → 6 | D1 (K9 6, K8 7, K12 6, K13 6) |
| 3 Content | 6 → 7 | D7 + B4 (C3 7, C9 6, C1 7, C2 7, C4 7) + inbound links (C12 7) + a SERP length range (C8 6) |
| 4 Cadence | 5 → 6 | D1 + WordPress on (C16 6) + style guide (C17 6) |
| 5 Technical | 5.5 → 6.5 | D4 + fix deployment with live re-check (1.9 8, 1.10 6) + customer key-page alerts (1.7 7) + CrUX / lab per template (1.5 5) + trended Pages report (1.3 8) |
| 6 Rank | 5.5 → 6.5 | D9 + B5 (2.1 6, 2.3 7, 2.5 7) + D8 (2.14 6) |
| 7 Site | 7 → 7.5 | D4, D5 (2.10 8, 2.12 7) |
| 8 AI visibility | 7 → 7.5 | B4 (4A.5 7) + B6 (4A.1 6) |
| 9 AI growth | 6 → 7 | D6 + IndexNow key and a real weekly run (4A.10 7) + a queued question written live (4A.7 7) |
| 10 Backlinks | 7.5 → 8 | B7 mentions (4B.7 7) + D6 / C-10 (4B.6 8) + a lost link handled live (4B.3 9) |
| 11 Link building | 6.5 → 7.5 | D6 (4C.2 7) + B4 mailbox and one approved send (4C.6 7, 4C.5 8) + hub-page targets (4C.8 7) |
| 12 Reporting | 5 → 6 | D4, D8, D9 (3.2 5, 3.3 5, 3.6 7, 3.9 6) + B8 (3.7 5) + B7 change test (3.4 5) + app chart annotations (3.5 6) |
| 13 Cost & reliability | 4.5 → 6 | D2 + B1 + D8 (all five criteria at 6) |

Roughly: the defects are a third of the way, the four owner items (host, profile, mailbox, WordPress) a sixth, and the rest is building
— fix deployment, daily / mobile ranks, a larger AI panel, a change test, working delivery. No step needs an own data index.

**To 8 — not reachable on engineering alone.** It needs ≈ +24 area points over today and ≈ +13 over the 7 path. Criteria that cap at 7–8
until **measured outcomes** exist — K10 re-fit from tracked results, K13 won / stuck re-planning, C9 validated against rank, C16 per-page
outcomes, 3.4 change tests with results, 4A.9 "won", 4C.9 reads at 6 / 10 / 16 weeks, 4B.3 real losses — require published pages and won
links measured over at least a quarter. On top of that, parity builds where the leaders are far ahead: per-topic difficulty on owned or
licensed data (K1), city / ZIP tracking (2.4), a 100-prompt panel (4A.1), a white-label portal (3.7), 80+ integrations (3.12), and evidence
on at least three sites, not one. Earliest credible point: one to two quarters after the 7 path, with pages live and ranking.

---

**Overall: 6 / 10 — area mean 5.88 (76.5 / 13).** Per area: keyword research & verdicts **6** · keyword ladders **5** · content creation &
QA **6** · content cadence **5** · technical audit **5.5** · rank tracking **5.5** · site tracking **7** · AI visibility **7** · AI growth
**6** (partly NL) · backlink monitoring **7.5** · link building **6.5** · reporting & app **5** · cost control & reliability **4.5**.
Market position (Part B): **4.2** mean; enterprise readiness **1.5 / 10**.
