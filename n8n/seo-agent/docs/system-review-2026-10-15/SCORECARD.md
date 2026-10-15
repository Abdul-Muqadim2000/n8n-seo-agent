# Scorecard — whole system against the best proven results (2026-10-15)

Independent re-rating, scored **only** from the live evidence of 2026-10-15 (`this_run/RESULTS.md`, 667 lines, and its four part
files — executions **594–643** on techand.ai between 18:57 and 20:14 UTC, deployed main workflow of 668 nodes, 21 published
workflows; ≈ $3.86 spent), against the **unchanged** criteria in `rubric/CRITERIA_keywords_content.md` and
`rubric/CRITERIA_technical_tracking_reporting_ai_links.md`, in the structure of the 2026-10-11 and 2026-10-13 scorecards.

**Scales (unchanged).** K / C criteria use the 0 / 5 / 10 anchors of their rows. The 1.x–4C.x criteria use 0 = absent · 2 = manual ·
4 = automated but basic · 6 = mid-market parity · 8 = parity with the named leader · 10 = beyond the leaders and proven live.

**Rules followed** (`SCORER_RULES.md`, FIX_PLAN §5.2). Every score cites a run, execution id, file or code location. A criterion the
live run did not exercise is marked **(NL)** and scored on code / specs / the last live evidence, never above the last live score.
A defect seen live caps its criterion at the level it shows. A fix the run did not exercise is not credited. Capability and
correctness are rated; outcomes are reported separately (§3). Honest refusals ("not checked", "could not be read") are credited where
a criterion asks for honesty, but not as the capability itself.

**How the area numbers are built** (the 2026-10-13 method, so the three ratings stay comparable). Each area is the mean of **the same
criterion set the 2026-10-11 scorecard used for that area**, with the strong-evidence criteria (K1–K3, K8, K10, C2, C3, C14, C15,
4B.4) weighted 1.5× and everything else 1×, rounded to the half point (x.25 and x.75 round up, as 5.75 → 6 did on 2026-10-13). The
weighted mean is printed in every area heading. The overall score is the mean of the thirteen area scores.

**K7** was re-baselined by the owner on 2026-10-15 (≥ 40% shared **top-7** URLs). It is scored against the new statement, with the
old-statement score beside it; both are 6, so the re-baseline changes nothing in the arithmetic.

**Leaders.** The named leaders are those of the 2026-10-11 scorecard. I did not re-check them on the web; no change of leader is relied
on anywhere below.

**IDs.** R34–R116 = defects of this run (`RESULTS.md` §3; part ids A-#, B-#, C-#, D-# in the part files). R1–R33, D#, P#, G#, O# =
earlier register items. "Score (was)" = this rating (2026-10-13 rating).

---

## 0. What I checked myself in `this_run/files/`

At least one load-bearing claim per area, opened in the raw artefact. **No disagreement between `RESULTS.md` and the artefacts was
found**; every figure below matched.

| Area | Claim | Artefact | Result |
|---|---|---|---|
| 1 Keywords | "good (50–70%)" chance on a reach with no evidence (R49) | `assess-erp-software-uae.json` | `reach_info {method: "size", sample: 0, top10: 0, cached_at 2026-10-08}`, `chance.band "good"`, `range [50, 70]` — confirmed |
| 1 Keywords | 20 Search Console rows "the page that gets the impressions does not target this search" (R35) | `A-discover-612-strategy.json` | `kinds`: 20 `page_mismatch`, 14 `striking`; e.g. `/dynamics-365-finance-and-operations-uae` at position 6.2 with `answered_by.title ""` — confirmed |
| 1 Keywords | the verdict's text of the customer's page already held the dates it says are missing (R38) | `A-verdict-608-existing-page-text.json` | contains "…30 October 2026, while retaining the 1 January 2027 implementation date" — confirmed |
| 2 Ladders | "Nothing on techand.ai is about 'ai consulting dubai'"; rungs grouped by topic label; rung target 1,900 | `A-ladder-610-plan.json`, `A-ladder-610-rows.json` | all three present (`grouped_by: "topic label (no search Google answers with the same pages)"`, `target_words 1900`) — confirmed |
| 3 Content | QA masks McKinsey's 40% / 27%; source says "Forty percent … up from 27"; `placeholder_count 0` with brackets left; 2,197 vs 1,900 words | `A-page-616-qa-round2.json`, `A-page-616-facts.json`, `A-page-616.md` | `unverified_figures` 40% / 27% (mckinsey.com); facts claim "Forty percent of respondents … up from 27"; `placeholder_count 0` while the body holds `[Confirm: edition year and sample size]`, `[name, role]`, `[date]`; `main_content_words 2197`, `target_word_count 1900` — confirmed |
| 4 Cadence | pile-up pause on 4 pages; the site report tells the owner to publish a draft that failed QA (R111) | `C-cadence-638-plan.json`, `C-site-634-report.json` | "4 written pages waiting for publication (pile-up guard, limit 3)", `paused_reason "pileup"`; action "Publish the written page for 'ai consulting' … report the link with 'I published a page'" — confirmed |
| 5 Technical | the #1 "not indexed" finding is a host split (R59); five findings sit on 308 redirect stubs (R63); the full report says "does not rank in the top 10" beside "Ranks #1 for its brand name" (R61); pre-release pass / fail | `exec-595.json` (*GSC Audit Query*), `B-audit-595-findings.json`, `B-fullreport-614-doc.txt`, `B-prerelease-617/618.json` | my recount of 595's page rows: **techand.ai 37 pages / 5,193 impressions vs www 13 / 522**; `/d365-…-rollout-uae` 330, `/whywith-techand` 292, `/whatwedo` 94 impressions on the bare host while the finding lists the www URLs as not indexed. Compression / canonical / Open Graph findings list only the two `https://techand.ai/insights/…` redirects. Both full-report lines present. 617 `pass`/exit 0, 618 `fail`/exit 1, both `writes: "none"` — confirmed |
| 6 Rank | "e invoicing in uae" set aside yet checked; "top 100" vs "top 50"; "facts erp" still printed; mobile only on one ladder | `C-rank-632-reports.txt` | all present; six ladders read "no mobile check was bought for this ladder this week" — confirmed |
| 7 Site | "health 70/100 ▼13", "18 referring domains ▲18" (R78); "brand = techand, tech" (R89) | `C-site-634-report.txt` | present — confirmed |
| 8 AI visibility | 74 samples = 33 answered + 41 pulse; ranges 0–4.9% / 0–15.5%; pitch rivals (R83) | `C-aivis-623-metrics.json`, `C-aivis-623-report.txt` | `samples 74`, `answered 33`, `asked 35`, `pulse_samples 41`, `requests 47`; my Wilson upper bounds 0/74 = 4.94%, 0/21 = 15.46%; "Pitch a guest article … to wafeq.com, edicomgroup.com and aiverix.ae" — confirmed |
| 9 AI growth | 2 URLs submitted to Bing, IndexNow key missing | `C-aigrowth-tables.json` | `submitted 2`, `indexnow "key_missing"` — confirmed |
| 10 Backlinks | 17 farm links set aside; Google-sample coverage; own re-check | `C-bl-626-report.txt` | "17 link(s) from link farms / PBN pages set aside", "Of the 1 sites in Google's own sample (Search Console), DataForSEO sees 0%", "Of the 19 referring pages we could read, 3 still carry the link" — confirmed |
| 11 Link building | a competitor's draft (daxin-global.ae) held for the owner (R86) | `C-lb-628-report.json` | daxin-global.ae row "needs you: [Owner: confirm …]; needs you: [Your name]" — confirmed (qzinfomatics.com `ready` at 0.87 is not in the report payload; taken from part 3 / exec 628, not re-opened) |
| 12 Reporting | 13 of 24 reports stored `progress` and held by the delivery rule (R110) | `D-report-details-since-1855.json` | 24 rows: 9 `completed`, 2 `accepted` (started notes), **13 `progress`** (rank_tracker 8; ai_visibility, ai_pulse, backlinks, link_builder, site_tracker 1 each) — confirmed |
| 13 Cost & reliability | duplicate front-door ledger rows (R81); stale alert never updated (R79); schedules never fired (R94) | `C-run-ledger-rows-90-102.json`, `C-ops-alerts-after-errpath.json`, `C-schedule-table.json` | ledger rows sum **$2.8924** incl. row 90 $0.95 and row 91 $0.50 beside 93 $0.7794 and 92 `refused`; alert row 4 `failed`, `attempts null`; rows 1–3 last attempt 2026-10-15 09:45 (raised 10-12 / 10-13); row 5 `webhook,email`; Rank Tracker 0 of 2 due fires, AI Visibility 26 min late — confirmed |

Not a contradiction, noted for completeness: `A-page-616-qa-round2.json` also carries a `word_count: 3051` in another object; the
main-content count the QA judged is `main_content_words 2197`, as RESULTS says.

---

## 1. Headline: **5.5 / 10** (area mean **5.54**; 2026-10-13: 5.92 → 6; 2026-10-11: 4.8 → 5)

The run proves a long list of real fixes: the monitors now reserve and settle their ledger rows (R17), DataForSEO errors inside HTTP
200 are retried on the page path (R18), all 45 URL inspections answered (R19), a page that fails its gate is delivered as a labelled
DRAFT instead of silently (R11), the impact basis is capped at the site's real totals (R10), the owner's false market-index row is
gone (R14), rung pages get a word target (R8/R22), real failures now reach Slack and e-mail (R5/R6), and a pre-release check, Page
Watch, a render diff, annotations, lineage and Google-sample backlink coverage all ran live for the first time. But the same evening
produced **14 High defects**, and nine of them are one failure: **the system advises about the customer's site without knowing what
the site already has, or what its own other modules decided** — three new AI-consulting pages planned beside a live AI-consulting page
(R34), 20 pages said not to target searches they plainly target and new pages recommended for searches the site ranks #6.2 for
(R35, R36), a verdict telling the owner their page lacks dates, tables and an author it has (R38), a host split ranked first as "not
indexed … cannot rank" (R59), keyword research seeded from three card headings (R60), "does not rank in the top 10" beside "ranks #1
for its brand" (R61), a full report diffed against a technical audit as "▼13" (R78), and drafts the QA failed sent back to the owner
as "publish it" (R111). On top of that, the schedule record shows **five of ten weekly automations have never fired on their own**
(R94), and the app holds every monitor report as undeliverable (R110). No area rose at area level: five held (content, technical,
backlinks, link building, reporting) and eight fell by half a point or a point. Part of that fall is **better evidence, not a worse
product** — this time the artefacts could be opened, every audit finding was checked against the live site, and the schedule history
was read; the seven false audit findings, the host split, R60 and R49 were all present on 2026-10-14 and are only now seen and scored.
The honest number is **5.5**. (Rounded to the half point, as the area scores are; to the nearest whole point the same mean would read
6, which would hide a fall the criteria show.)

---

## 2. The 13 areas

| # | Area | **Now** (weighted mean) | 2026-10-13 | Named leader | Main reasons (run / exec ids) |
|---|---|---|---|---|---|
| 1 | Keyword research & verdicts | **5.5** (5.60) | 6 | Semrush (Personal KD) / Ahrefs | K8 fails three ways (R34 ladder 610, R35 / R36 discover 612); verdict states false facts about the customer's page (R38, exec 608); full report recommends Google's own product, face-swap AI and a government service (R60, exec 614); "good 50–70%" chance from no evidence (R49, exec 598) |
| 2 | Keyword ladders / planning | **4.5** (4.50) | 5.5 | MarketMuse / Semrush Strategy Builder | plan built on a false premise (R34) and against its own SERP rule (R40); 6th active ladder against a cap of 2, unmentioned (R42); "facts erp" still planned (R90, exec 632); set-aside ladder still queued (R87) |
| 3 | Content creation & QA | **6** (5.96) | 6 | Surfer / Clearscope | R11 fixed live (DRAFT, honest reasons, exec 616); length +16% vs +31%; but QA masks correctly sourced figures and calls them unsupported (R37), miscounts placeholders and editor rounds (R45, R46), and takes its coverage target from a US agency blog's banner (R43, R44) |
| 4 | Content cadence / pipeline | **4.5** (4.65) | 5.5 | Clearscope (inventory, decay) | guard paused correctly (exec 638) but counts QA-failed drafts as "waiting for publication" and the site report says "publish it" (R111); caps bypassed by the ladder path (R42); refresh brief false (R38); no CMS push; Content Cadence never fired on schedule (R94) |
| 5 | Technical audit | **5** (5.08) | 5 | Sitebulb / Ahrefs Site Audit | 45/45 inspected, pre-release check, Page Watch and render diff live (execs 595, 617/618, 636); but #1 finding misreads a host split (R59), 7 of 30 findings false and 1 misleading on the live site (R62, R63, R71), redirect chains never read (R64) |
| 6 | Rank tracking | **5.5** (5.50) | 6 | AccuRanker / Semrush Position Tracking | weekly schedule has never fired (R94); mobile on 2 of 12 readings; AIO citation loaded for 1 of 12 (exec 632); action layer contradicts itself (R87, R90, R111); cost now measured per keyword |
| 7 | Site tracking (GSC / GA4 / Trends) | **6.5** (6.50) | 7 | SEOTesting + Looker Studio | paged untruncated GSC, Poisson tests, annotations live (exec 634); but unlike-report deltas ▼13 / ▲18 (R78), "tech" counted as the brand (R89), "publish" the failed drafts as P1 (R111), app headline ignores its own test (R113) |
| 8 | AI visibility (incl. pulse) | **6.5** (6.71) | 7 | Profound / Semrush AI Toolkit | honest market index (R14 gone), Wilson ranges recompute (exec 623); denominators misdescribed, AIO presence counts a failure (R84); tells the owner to pitch rivals (R83); 7 buyer questions; pulse late 6 of 7 days |
| 9 | AI growth **(NL)** | **6** (6.00) | 6.5 | Profound Actions / AthenaHQ | not run (no dry-run switch); record: 2 URLs to Bing on 10-14, IndexNow key 404, both hosts stored (R92); the earned-media leg leaks rivals (R83, R86); never fired on schedule (R94) |
| 10 | Backlink monitoring | **7** (6.93) | 7 | Ahrefs (+ Linkody re-checks) | five sources merged, % of Google's sample shown, own re-check, 17 farms set aside (exec 626); "3 sites" beside "18 referring domains" and "63% spam High" (R112); competitors' service pages read as lists (R86); the app's own request refused (R77) |
| 11 | Link building | **6.5** (6.56) | 6.5 | Pitchbox / Respona | Reply Reader 4/4 with live link check (execs 601–604); every quoted line real; control-group impact live (exec 628); a competitor still gets a draft and a `ready` row (R86, third rating running); nothing ever sent |
| 12 | Reporting & app | **4.5** (4.50) | 4.5 | AgencyAnalytics / Semrush My Reports | clean browser pass (107 visits, 0 errors); alerts delivered; but more self-contradicting reports (R61, R78, R112, R113), modules contradict each other (R111, R87, R83), every monitor report undeliverable and unshareable (R110), nothing ever delivered to anyone |
| 13 | Cost control & reliability | **4** (4.20) | 4.5 | Semrush / Ahrefs (server-side limits) | ledger reserves and settles everywhere (R17 gone) and DataForSEO lands within 2.3% of the account; but 4 of 19 scheduled fires delivered (R94), the guard refused the customer's own request (R77), duplicate rows (R81), Claude "measured" 15–67% low (R47 / R80), "actual" shows search data only (R102) |
| | **Overall** | **5.5** (area mean **5.54**) | **6** (5.92) | | 72 / 13 |

---

## 3. Per area

### 3.1 Keyword research & verdicts: 5.5 (was 6) — weighted mean 5.60

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| K1 ×1.5 | 5 (5) | Keyword Check 598–600: one site-wide reach of 10, `reach_info {method: "size", sample: 0, top10: 0}` cached 2026-10-08, applied to every topic; the answer says so ("treat the months and the chance below as the optimistic case"). No difficulty is derived from a results page when DataForSEO has none (2 of 3 keywords). No back-test. | Semrush PKD / MarketMuse PD measure authority per topic. |
| K2 ×1.5 | 6 (7) | Verdict 608 models visits from 40 searches/mo with the AI-Overview loss named and sourced; discover 612 shows Search Console impressions per query. **R41**: ladder report 610 gives its head term two traffic figures — `traffic_potential 12` (no click loss) and `expected_visits 6` (after −52%) — and adds the 12 into `traffic_potential_total 57`. | Ahrefs Traffic Potential from the #1 page's real traffic. |
| K3 ×1.5 | 6 (6) | AI Overview detected per keyword on the live SERP and dated ("seen in the check at 19:05 UTC … one observation", 608); click loss "−52%, measured: Ahrefs, 300,000 keywords, December 2025"; the Rank Tracker (632) prints the same curve. One AIO discount; no separate snippet / local / video discounts shown. | Per-feature 2025 CTR discounts. |
| K4 | 7 (6) | Discover 612: 16 priority keywords live-checked; the page type is read from the results and a mismatch flagged ("Comparison or lists are what Google ranks here: 9 of the 9 results read, while this plan writes a service or product page — expect to work harder"). It flags, it does not decide; R36 still recommends new Location / Landing pages. | Ahrefs "pick intent"; Semrush SERP summary. |
| K5 | **4** (5) | Discover's 104 relevant keywords hold no navigational or government term; the ladder refused "meta ai" / "pitch ai" and 19 off-topic ideas (610). But **R60 (High)**, identical on 10-13 (R13) and 10-14: the full report (614) offers "ai mode" (49,500/mo), "blackbox ai", "face swap ai", "mofa attestation dubai", a gap led by "vat" / "trn" / "trade license" (seen in `B-fullreport-614-doc.txt`); **R39**: "openai consulting" and a supply-chain rung on the AI ladder; **R51**: discover's "where to start" is "construction project erp" — off-industry, −73% a year, and its own follow-up (615) says traffic "will be negligible". Leaks on three paths in one run. | A scored business value that gates every list. |
| K6 | 8 (8) | Discover 612: 40 seeds incl. 10 real Search Console queries; pool 667 (ideas, competitors, Search Console 30, suggestions); AI demand; 300 GSC rows → 92 considered with drop reasons. (The full report's seeding from card headings is charged to K5.) | At parity on inputs. |
| K7 | **6** (7) · old statement **6** | **New statement (≥ 40% shared top-7 + intent):** ladder 610 reads all 10 rung SERPs and prints the exact rule ("sharing 3 of their top 7 pages (40%) are one page"), then merges keywords that share at most 1 URL "by topic label" (R40; `grouped_by` in `A-ladder-610-plan.json`) — the measurement is computed and overridden. Discover: `serp_overlap {keywords_compared 16, clustered 2, min_shared_urls 3}` — one SERP cluster, the rest label-based, a second rule in the same run set. **Old statement (≥ 3–4 shared top-10):** discover's 3-URL rule meets it where it runs; the same override applies → 6. | Keyword Insights merges only on overlap. |
| K8 ×1.5 | **4** (6) | Works where it looks: verdict 608 matched the existing e-invoicing article (`existing_page_action "improve"`), discover lists 9 keywords "already answered by a page you have", the Rank Tracker says "already answers this search — refresh that page". Three High failures: **R34** (610: "Nothing on techand.ai is about 'ai consulting dubai'" while `/ai-copilot-advisory-uae` — "AI Consulting & Copilot Advisory UAE" — is live; its inventory row has an empty title, as do 25 of 45); **R35** (20 rows "does not target this search" by literal tokens: "d365" ≠ "dynamics 365"); **R36** (priority #10, #12–#16 recommend new pages for searches the F&O page ranks #6.2 / #9.6 for, without naming it). R50: the Keyword Check is silent that two of its keywords head existing ladders. | Search Console "two URLs for one query" + SERP overlap across pages, ladders and queue. |
| K9 | 6 (7) | Verdict 608: GO_WITH_CHANGES 58, dates right (30 Oct 2026 / 1 Jan 2027), volume, trend, CPC and competitor word counts traced to source, AIO timed and hedged, no FAQPage. **R38 (High)**: "Its visible text has no mandate dates, … no tables, … no author or date" — the page has all three and the text the run read contains the dates. R48: "FTA-accredited ASP" (the Ministry of Finance accredits). Report 615 is candid ("traffic will be negligible"). | Reasons traceable to data, every one. |
| K10 ×1.5 | 5 (6) | Bands carry the Ahrefs 2025 base rate and "uncalibrated"; no band when data is missing (599, 600 — R26 gone). **R49**: "good (50–70%)" in 2–4 months for "erp software uae" from a reach with `sample 0, top10 0`, printed beside "only 1.74% of new pages reach Google's top 10 within a year". No re-fit (no outcomes exist). | Probabilities re-fit from own tracked outcomes. |

**Area:** (5×1.5 + 6×1.5 + 6×1.5 + 7 + 4 + 8 + 6 + 4×1.5 + 6 + 5×1.5) / 12.5 = 70 / 12.5 = **5.60 → 5.5**.

**What would have to be true to score higher.**
- **Next half point (6):** ≥ 71.9 weighted points (+1.9). Fix the existing-page match — inventory rows filled with the live title / H1,
  and query-to-page matching on meaning, not literal tokens — so that R34, R35 and R36 do not reproduce on a re-run: K8 4 → 6 (+3).
- **Next full point (6.5):** ≥ 78.2 (+8.2). The above with K8 → 7 (+4.5), plus the verdict reading the whole page with table structure
  (R38 gone: K9 → 7, +1), one brand / government / topic gate applied to the full report's lists and to rungs (R60, R39: K5 → 6, +2),
  and no chance band without ranked-keyword evidence (R49: K10 → 6, +1.5) → 79 / 12.5 = 6.32.

### 3.2 Keyword ladders / planning: 4.5 (was 5.5) — weighted mean 4.50

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| K9 (plan) | 5 (6) | Ladder 610 is far better *built* than on 10-14: every DataForSEO task 20000, pool 41 → 34 reviewed → 26 relevant, 19 off-topic removed with reasons, navigational refused, rung targets 1,900 words (R8 / R22 gone), the clustering rule and an uncalibrated chance printed. But its premise is false (R34), it merges what its own rule separates (R40), carries an off-topic and an other-brand term (R39), prints two head traffic figures (R41), takes the top page's subtopics from a listicle's competitor entries ("2. Accenture AI & Analytics", R44) and does not say it is the 6th active ladder and the 4th unpublished page (R42). | Strategy Builder / MarketMuse place the existing page in the pillar. |
| K8 ×1.5 | 4 (6) | As 3.1; R34 is this area's own. | |
| K10 ×1.5 | 5 (6) | As 3.1. | |
| K11 | 5 (5) | Link map; the rung page holds its up-link to the unwritten top page in `links_to_add_when_published` and all 7 body links answer 200 (R15 gone). But the cluster is built beside the site's own AI-consulting page instead of around it (R34), and its gaps come from a listicle (R44), not a competitor topical map. | Live link map + competitor topical-map gaps. |
| K12 | **4** (6) | `_site`: `max_active 2`, `max_waiting 3`. Ladder 610 wrote its settings `active` as the **6th** active ladder and spawned a 4th unpublished page, unmentioned (R42). The cadence (638) still queues 3 ladders behind `max_active`, so the cap holds in one consumer only. Topic radius let a supply-chain rung onto an AI ladder (R39). | Cap + topic radius + priority, enforced on every path. |
| K13 | 4 (4) | Next steps read the inventory ("refresh that page", 632) and a set-aside rule now exists. But **R90**: "facts erp" (facts.ae's brand, #3 for "erp software uae" in this very run) is still planned and printed — third rating running; **R87**: "e invoicing in uae" is "set aside … no position checked" while it was checked, given a next step, and its four rungs head the cadence queue; **R111**: "ai consulting" and "azure api management monetization" — both "not ready to publish" — are "already written — publish it". No automatic re-plan. | Won / stuck states that re-plan. |

**Area:** (5 + 4×1.5 + 5×1.5 + 5 + 4 + 4) / 7 = 31.5 / 7 = **4.50 → 4.5**.

**What would have to be true to score higher.**
- **Next half point (5):** ≥ 33.25 (+1.75). The existing-page fix of 3.1 seen in a ladder run (K8 → 5, +1.5) and a ladder request that
  is queued, or says so, when it would exceed `max_active` / `max_waiting` (R42: K12 → 5, +1).
- **Next full point (5.5):** ≥ 36.75 (+5.25). K8 → 6 (+3), K9 → 6 (R34, R40, R41 gone, +1), K12 → 5 (+1), and stored rows that
  follow the rules the report prints — "facts erp" set aside, a set-aside ladder off the queue, failed drafts not "publish it"
  (R90, R87, R111: K13 → 5, +1) → 37.5 / 7 = 5.36.

### 3.3 Content creation & QA: 6 (was 6) — weighted mean 5.96

One page run: exec 616 (13.9 min, rung 1 "ai consulting", 2,197 words, 3 images, DataForSEO $0.0241 + Claude ≈ $0.68 of which $0.53 is
n8n's estimate).

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| C1 | 6 (7) | Coverage target from the best-ranking page (608: 90% of 25 shared terms against cleartax.com; 616: 90% against vendasta.com), re-measured by QA. **R44**: in 616 the "best page" is a US agency-software blog and its promo banner became a section of the draft ("Serving more clients with AI-powered software"); **R43**: "missing" means below a frequency target (strategy ×9 on the page reported missing) — a term count, not coverage. | Surfer / Clearscope coverage for the intent and page type picked. |
| C2 ×1.5 | 5 (5) | A clear angle ("Strategy to Live Pilot"); external figures sourced; numbers labelled "Illustrative example"; alicelabs.ai rates labelled "a single estimate". No original data, experience or proof — nothing on file (`business_facts ""`, no profile, O1 / O2). | Original data / experience / proof checked in QA. |
| C3 ×1.5 | 6 (7) | Figures are matched against the evidence plan's text: Deloitte, McKinsey and alicelabs figures trace to their pages; links outside the plan are flagged (centralbank.ae, difc.com, adgm.com). **R37 (High)**: McKinsey's 40% / 27% masked as `[Confirm: …]` and the owner told "Figures the cited source does not carry", while the run's own evidence reads "Forty percent … up from 27" — the matcher reads digits only, on a cut snippet. Wrong in the cautious direction, but a false statement about a source. No re-check at refresh. | Writer-style claim detection against full fetched text. |
| C4 | 4 (4) **(NL)** | No profile on file: no author box, no Article / Person schema, "Checklist reviewed by [name, role], [date]" in the body. Owner-blocked (O1). On 10-14 the gate counted 11 profile placeholders — the last live evidence. | Credentialed author + author page + Person schema. |
| C5 | 7 (7) | 2,128 eight-word windows against 8 pages (6 competitor, 2 own), highest overlap 0.2%, threshold 15%, $0. The closest own page (`/ai-copilot-advisory-uae`) was not among those compared (the executor's recount: 0 shared windows). No external index. | Semrush SWA checks against the web (Copyleaks). |
| C6 | 6 (6) | Banned phrases, specifics per section, critic (66, "revise") ran; not itemised. R44's banner section is the kind of generic text the critic should have caught. | Repetition / generic-sentence checks itemised. |
| C7 | 7 (7, now live) | Flesch 60.3, passive 9%, 57-word answer block, 17 question headings all answered (616). | Audience targets. |
| C8 | 5 (4) | Rung target 1,900 = median of 5 pages read; delivered **2,197** main-content words (+16%) inside the ±25% clamp — against +31% (10-13) and +47% (10-14). But length and coverage fight: the editor's cut from 2,793 to 2,197 words took coverage from 90% to 60% and failed the page (R43). No SERP min–max range. | SERP min–max judged by coverage. |
| C9 | **5** (3) | Critic + deterministic gate + one editor round; the page is delivered honestly — "did not pass the quality check — not ready to publish (round 2 of 2)", `-DRAFT` files, round-2 reasons (R11 gone, live). But the gate's own figures are wrong: `placeholder_count 0` with five brackets in the body (R45), "the editor had 2 round(s)" when one ran (R46), present terms called missing (R43), sourced figures called unsupported (R37). Not validated against outcomes; other modules override its verdict (R111, charged at C16 / 3.3). | Surfer publishes its score's correlation with rank. |
| C10 | 7 (7) | Title 57 characters with the keyword, meta 153, one H1, canonical. The pre-release check (617 / 618) reads title, H1, canonical and description on live URLs and fails a release with exit 1. The page itself is not live (NL for its own live check). | Checked on the live URL + URL Inspection. |
| C11 | 7 (6) | 616: Service (provider `@id`, `areaServed` UAE) + BreadcrumbList; no FAQPage; the verdict asks for "an FAQ section with question-style headings" and "Service and Organization schema" — FAQPage appears nowhere (R7 gone). Schema `url` `/ai-consulting` vs the ladder's `/ai-consulting/`. | Matched to page type; nothing deprecated. |
| C12 | 6 (6) | 7 body links, all 200 on www; the planned up-link held until its target exists (R15 gone). No inbound links planned or verified; it links sideways to the page it duplicates (R34). | ≥ 3 contextual inbound links, verified. |
| C13 | 7 (7) | Three WebP images (hero 1200×675 20 KB, two diagrams) with alt text, captions and file names. Not verified on a live page; no original photography or data visuals. | Original visuals checked live. |

**Area:** (6 + 5×1.5 + 6×1.5 + 4 + 7 + 6 + 7 + 5 + 5 + 7 + 7 + 6 + 7) / 14 = 83.5 / 14 = **5.96 → 6**.

**What would have to be true to score higher.**
- **Next half point (6.5):** ≥ 87.5 (+4). Figures written in words accepted, and "could not be confirmed from the snippet" instead of
  "the source does not carry" (R37: C3 → 7, +1.5); every bracket counted and named (R45, R46: C9 → 6, +1); the coverage target taken
  from results of the page type being written, with term use reported as "N vs M" (R43, R44: C1 → 7, +1); inbound links proposed
  from named live pages (C12 → 7, +1) → 88 / 14 = 6.29.
- **Next full point (7):** ≥ 94.5 (+11). The above plus the owner's profile and facts in a live content run (C4 → 7, +3; C2 → 7 with
  proof items checked in QA, +3) and length kept inside a SERP range without breaking coverage (C8 → 6, +1) → 95 / 14 = 6.79.

### 3.4 Content cadence / pipeline: 4.5 (was 5.5) — weighted mean 4.65

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| C14 ×1.5 | 6 (7) | Dry run 638 paused itself: "4 written pages waiting for publication (pile-up guard, limit 3) … publish them to continue", nothing written, 3 ladders queued behind `max_active`, the AI page of the month accounted for. But the guard counts two drafts that **failed** QA as pages "waiting for publication" (R111), the ladder path bypassed both caps without a word (R42), and the queue behind the pause is four rungs of a ladder the Rank Tracker says is set aside (R87). | Cadence tied to review capacity on every path. |
| C15 ×1.5 | 5 (6) | Decay tested properly ("50 pages tested, 0 really losing traffic, 50 with too few clicks", 634); refresh actions read the inventory (632); the verdict sends the owner to improve the existing article (608). The refresh brief is false on three counts (R38). No scheduled substantive refresh with facts re-checked. | Clearscope decay alerts + scheduled substantive refresh. |
| C16 | **4** (5) | Publish detection correct (45 sitemap URLs, 8 candidates, none published — 634); an "I published a page" step; WordPress push off (G13). **R111 (High)**: the site report's P1 action is "Publish the written page for 'ai consulting' … report the link with 'I published a page'" for a draft the same system marked not ready; `seo_content_log` stores failed drafts as `written` with no quality state. `published` not exercised (NL). | CMS draft push + automatic detection + per-page outcomes. |
| C17 | 5 (5) | Tone "Professional and direct" and banned phrases applied; `style_guide: null` (no guide on file — G31 not exercisable, NL); Manual / Auto mode; "Tech&" written correctly throughout. | Jasper / Writer stored style guide, checked per page. |
| K8 ×1.5 / K12 / K13 | 4 / 4 / 4 (6 / 6 / 4) | As 3.1 and 3.2. | |

**Area:** (6×1.5 + 5×1.5 + 4 + 5 + 4×1.5 + 4 + 4) / 8.5 = 39.5 / 8.5 = **4.65 → 4.5**. Operational note, scored in 3.13: the Content
Cadence has never fired from its own schedule (0 of 2 Mondays, R94), so the weekly cadence has only ever run when started by hand.

**What would have to be true to score higher.**
- **Next half point (5):** ≥ 40.4 (+0.9). A QA state stored with every written page, so a failed draft is "fix and re-run", never
  "publish it" and never counted as waiting (R111: C16 → 5, +1).
- **Next full point (5.5):** ≥ 44.6 (+5.1). The above, the existing-page fix of 3.1 (K8 → 6, +3) and a refresh brief that states only
  what the page lacks (R38: C15 → 6, +1.5) → 45 / 8.5 = 5.29.

### 3.5 Technical audit: 5 (was 5) — mean 5.08

Technical audits 595 and 641 (health 83, 30 findings), full report 614 (health 70, 61 findings), pre-release checks 617 / 618.

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 1.1 | 6 (6) | "Crawled 45 of 45 known URLs (100%; sitemap 45 + 44 pages with Search Console impressions)", `crawl_complete` (595, 614, 641). Two 308 redirect stubs counted as pages (47; R63). | Screaming Frog / Sitebulb classify redirects. |
| 1.2 | **4** (5) | **R59 (High)**: the first-ranked finding — 16 www pages "not indexed … cannot rank … request indexing" — is a host split: all 16 earn impressions on the bare host in the same run's Search Console rows (my recount: techand.ai 37 pages / 5,193 impressions vs www 13 / 522), Google's chosen canonical is printed with the host stripped, and "One canonical host … the canonical tags agree" sits under what works. **R63**: two 308 responses produce five false findings. **R64**: the redirect-chain reports are requested without the task id ("Task Not Found", also on 10-14), so the two-hop http → bare → www chain goes unreported. | Correct on a labelled fixture set; canonical vs Google's chosen canonical. |
| 1.3 | 6 (7) | 45 of 45 key pages inspected, 0 failed (R19 gone), the sample carried into the finding and the diff. The interpretation misses the host split (R59); the two reports 8 minutes apart print different state counts for 5 pages; the Pages report is not trended. | Every important page + trended Pages report + removals. |
| 1.4 | 5 (4, NL) | Render diff live on 5 key pages (raw vs rendered, six figures each). Its only reported difference is `&#x27;` vs `'`, scored Medium as "AI crawlers see a different version" (R62). | Response vs render on every page (Sitebulb). |
| 1.5 | 4 (4) | CrUX enabled and queried per template × device: "no field data" for this site — honest, Info, unscored. The technical audit runs no lab test; the full report has a homepage lab score only (mobile 90). Delivered = homepage lab (cap 4). | CrUX p75 per template, trended. |
| 1.6 | 5 (5) | Ordered by impact with the basis capped at the property's real totals (32 clicks / 5,308 impressions; R10 gone); cosmetic items folded. The #1 item is R59's misread, and page findings use site-average estimates for pages the run measured ("an estimated 637 impressions" vs 16 measured; R65). | Severity × affected clicks, index blockers first, correctly. |
| 1.7 | **6** (4, NL) | Page Watch live (636): 25 key pages + robots.txt, `noindex` / `canonical` / robots hash compared, Google's index state per page; same-type audit diffs ("0 fixed · 0 new · 27 still open", technical vs technical, 595 and 641). Page Watch alerts only reach the ops webhook, never the customer; 2 of 25 slots are menu fragments (R92); it fired on time 2 of 3 days. | ContentKing / Always-on Audit: alerts within hours. |
| 1.8 | **4** (0) | Pre-release check live: 617 — 10 pages, `pass`, exit 0; 618 — redirect + 404 → `fail`, exit 1; both `writes: "none"`. 8 checks per page; a doubled brand title and live lorem ipsum pass; no candidate-vs-live comparison; staging wording on a production check (R75). | Lumar Protect: 350+ tests that block a deploy. |
| 1.9 | 6 (6) | Fix pack keeps every live robots.txt line; llms.txt and three JSON-LD blocks carry only what the site states. Files only; nothing for the code findings; no Service block although the full report raises "no Service schema" (High, true). | Ahrefs Patches / PageWorkers deploy and re-check. |
| 1.10 | 4 (4) **(NL)** | "I fixed this" re-check not exercised (no request); otherwise the next audit. | Re-checked within days; items close themselves. |
| 1.12 | 7 (7) | 6 orphan `/whatwedo/*` pages (true, checked live), `internal-links.csv` with anchors. The cause (cards without `href`) is not named; repeated H1s across pages unreported. | |
| 1.13 | 6 (6) | The technical audit no longer contradicts itself on schema (R24 gone: `not_assessed`); the full report's "Service pages have no Service schema" is true; generated blocks clean. No Service block generated. | Validated and generated per page type. |
| 1.14 | **3** (4) | Executor B checked all 30 findings of 595 against the live site: **17 true, 7 false, 1 misleading, 5 not verifiable** — 68% precision where verifiable, against a ≥ 95% bar; the offline `ACCURACY_SET` 100% does not survive this site. All 7 false findings were present on 10-14. | ≥ 95% precision on a labelled set, published. |

**Area:** (6 + 4 + 6 + 5 + 4 + 5 + 6 + 4 + 6 + 4 + 7 + 6 + 3) / 13 = 66 / 13 = **5.08 → 5** (1.11 n/a: small site).

**What would have to be true to score higher.**
- **Next half point (5.5):** ≥ 68.25 (+2.25). Redirect items classified as redirects, entities decoded, `<u>` not "deprecated", and the
  host split reported as what it is (R59, R62, R63, R71 gone) — 1.2 → 5 (+1) and live precision ≥ 85% (1.14 → 5, +2) → 69 / 13 = 5.31.
- **Next full point (6):** ≥ 74.75 (+8.75). 1.2 → 6 with redirect chains read (R64), 1.14 → 6 (≥ 90% on a live re-check), 1.3 → 7,
  1.6 → 6 (measured page rows, R65), and a fix re-check seen live (1.10 → 6) → 75 / 13 = 5.77.

### 3.6 Rank tracking: 5.5 (was 6) — mean 5.50

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 2.1 | **4** (5) | Weekly on paper, on demand through the API (632, 20 s). The Rank Tracker's Monday schedule has **never fired** (0 of 2 due, no `trigger` execution ever — `C-schedule-table.json`). Cap: the Mac host, plus restarts that discard due fires (R94). No re-check after a publish or fix. | AccuRanker / Semrush: daily + on-demand. |
| 2.2 | 6 (6) | Depth 50, trimmed SERP stored per reading. **R88**: two identical requests 32 s apart returned different leaders, and one keyword gets two movement figures in one run — movement between single readings partly measures noise, unlabelled. | SE Ranking's cached SERP as proof. |
| 2.3 | 6 (7) | Mobile bought for 2 of 12 readings (the new ladder's head and rung 1); six ladder reports read "no mobile check was bought for this ladder this week". | Mobile and desktop for every keyword. |
| 2.4 | 4 (4) | Country level only. | City / ZIP; geo-grid. |
| 2.5 | 6 (7) | AIO on all 12 readings, PAA, local pack, video, knowledge graph, reviews, timed AIO sightings; whether the AIO cites the site was loaded for 1 of 12 ("not loaded … costs extra") — honest, not delivered. | ≥ 15 feature types, AIO citation per keyword. |
| 2.6 | 7 (7) | Modelled share of voice with its CTR curve and the Ahrefs Dec-2025 click loss printed; not trended. | Trended SOV against competitors. |
| 2.13 | 6 (6) | Competitors above per keyword, own competitors starred; no movers view. | 10–20 competitors with movers. |
| 2.14 | 5 (4) | Cost measured ($0.12 = 12 × $0.01) and "about $0.043 per keyword per month" printed (R9 gone here); monitors sit outside the company budget ("not counted in the budget"); the Site Tracker's two SERP checks are an estimate 3× low (R82). | Shown **and capped** per keyword. |

**Area:** (4 + 6 + 6 + 4 + 6 + 7 + 6 + 5) / 8 = 44 / 8 = **5.50 → 5.5**. Also capping, outside the criteria: the action layer in the
same reports — "e invoicing in uae" set aside and pursued (R87), "facts erp" still printed (R90), "top 100" vs "top 50" (R91), failed
drafts "publish it" (R111).

**What would have to be true to score higher.**
- **Next half point (6):** ≥ 46 (+2). The Monday schedule firing on its own for a few weeks running (2.1 → 5) and mobile bought for
  every ladder head (2.3 → 7) → 46 / 8 = 5.75.
- **Next full point (6.5):** ≥ 50 (+6). The above, AIO citation loaded for every tracked keyword (2.5 → 7), city-level readings for the
  UAE (2.4 → 5), monitors inside a capped budget (2.14 → 6) and a competitor movers view (2.13 → 7).

### 3.7 Site tracking (GSC / GA4 / Trends): 6.5 (was 7) — mean 6.50

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 2.7 | 7 (8) | 953 rows paged, `truncated: []`, withheld queries reported apart (28% of impressions). **R89**: the brand split counts "tech" as the brand ("brand = techand, tech"; "technology and analytics" and "techandkey com" 308 impressions counted as brand). No archive beyond 16 months. | BigQuery export, own archive, clean brand split. |
| 2.8 | 7 (7) | GA4: organic 84 of 292 sessions, landing pages, key events, AI sessions 0 (634, 623). | Revenue per landing page. |
| 2.9 | 7 (6) | 45 of 45 key pages inspected in the weekly run and written to `seo_page_watch` (634); Page Watch carries the state. Two menu-fragment URLs inspected as "unknown to Google" (R92). | Every tracked page within quota. |
| 2.10 | 6 (7) | Striking distance, CTR gaps, Poisson-tested decay, a cannibalisation pair with an action, publish detection. The report's own P1 action tells the owner to publish the QA-failed drafts (R111). | Each diagnostic with a *right* action. |
| 2.11 | 7 (8) | Two-sample Poisson tests on every change ("clicks (32) are still too few to call a real rise"). The app's hero overrides the test: "Clicks from Google are up 52% to 32" (R113). | Statistical thresholds carried to every surface. |
| 2.12 | 5 (5, NL) | Annotations now live: spam updates, audit events labelled by report type ("different checks, so the two scores are not comparable"). Beside them the monitor block prints "Technical audit … health 70/100 **▼13**" (full vs technical) and "18 referring domains **▲18**" (full vs free) — **R78 (High)**, exactly the break the criterion is about. No num=100 note seen. | Breaks annotated and flagged everywhere. |

**Area:** (7 + 7 + 7 + 6 + 7 + 5) / 6 = 39 / 6 = **6.50 → 6.5**.

**What would have to be true to score higher.**
- **Next half point (7):** ≥ 40.5 (+1.5). `latest2()` filtered by report type (R78: 2.12 → 6) and no "publish it" for a failed draft
  (R111: 2.10 → 7) → 41 / 6 = 6.83.
- **Next full point (7.5):** ≥ 43.5 (+4.5). The above with 2.12 → 7 (num=100 and site changes marked), a brand split from the business
  name's spellings only (R89: 2.7 → 8) and the app's headline following the test (R113: 2.11 → 8) → 44 / 6 = 7.33.

### 3.8 AI visibility (incl. pulse): 6.5 (was 7) — mean 6.71

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 4A.1 | 5 (4) | 7 buyer questions + the brand question weekly, 7 daily on the pulse; the market-wide index is back with the owner's false row left out and the reason printed ("'Tech&' is too short a name … to match on its own"; R14 gone). | Semrush 25 / Profound 100 prompts daily; 200M+ prompt databases. |
| 4A.2 | 7 (7) | 6 engines (ChatGPT, Perplexity, Gemini, Claude, AI Overview, AI Mode); 47 requests, 1 failed, retried, disclosed in line 2 (623); pulse 21 of 21 (630). No Copilot. | ≥ 6 localised engines. |
| 4A.3 | 7 (8) | Pulse samples pooled (74 = 33 + 41), Wilson ranges that recompute (mine: 0/74 → 4.94%, 0/21 → 15.46%), every delta "within sampling noise". **R84**: the lineage says "74 answers (8 questions × 6 engines)" and the rates "count the 33 answers that came back" while 46 of 47 answered; Claude's answers leave the rates unannounced; per-engine tables add to 81. **R95**: the on-demand pulse overwrote the day's scheduled reading; the pulse fired late on 6 of 7 days. | Daily samples, ranges, alerts beyond noise. |
| 4A.4 | 7 (8) | Mention, citation, share of voice over 193 mentions, sentiment, cited URLs, AIO presence, competitors by domain; 13 brand hits, all in brand-question answers (no false positive). AIO presence counts a failed request as "no AI Overview" (5/7 = 71.4% instead of 5/6; R84). | Full metric set, correct denominators. |
| 4A.5 | 5 (5) | "What AI gets wrong: not checked … fill the business profile" — honest; nothing is checked (no profile, O1). | Gartner: accuracy checks mandatory. |
| 4A.6 | 8 (8) | GA4 AI visits, key events and revenue wired and read; 0 AI sessions in 28 days. | |
| 4A.8 | 8 (8) | robots.txt and llms.txt read; 8 of 8 answer bots allowed; homepage fetch test for 4 of them (200 each). | |

**Area:** (5 + 7 + 7 + 7 + 5 + 8 + 8) / 7 = 47 / 7 = **6.71 → 6.5**. Also capping: **R83** — the brief tells the owner to "pitch a
guest article or comparison mention to wafeq.com, edicomgroup.com" (businesses the same report lists among those AI recommends instead;
the Link Builder refused wafeq.com as a competitor 13 minutes later) and writes eight such rivals as `ai_source` prospects; **R85** —
the AI search-volume lookup failed twice, undisclosed.

**What would have to be true to score higher.**
- **Next half point (7):** ≥ 47.25 (+0.25). Denominators stated as computed and AIO presence over answered requests (R84: 4A.3 or
  4A.4 → 8) → 48 / 7 = 6.86.
- **Next full point (7.5):** ≥ 50.75 (+3.75). R84 fixed on both (+2), ≥ 20 buyer questions with real demand (4A.1 → 6), and the owner's
  business profile filled so the fact check runs and checks something (4A.5 → 7) → 52 / 7 = 7.43.

### 3.9 AI growth: 6 (was 6.5) — mean 6.00 — **(NL)**

Not run: its normal run submits to Bing (and IndexNow) and has no dry-run switch; the owner forbids test submissions (`RESULTS.md`
§2.20). Scored from its stored record (`C-aigrowth-tables.json`), the code path, and the last live run (2026-10-14, exec 574), capped
there.

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| Readiness | 7 (7) NL | 12 pages scored on raw HTML, average 77 (exec 574); `seo_ai_pages` stores the same pages under both hosts (34 rows; R92). | |
| 4A.7 | 6 (6) NL | Fan-out searches listed per question in 623 (10 shown); 7 targets — 6 queued, 1 skipped as fresh and AI-ready; "one search, one page" mapping to ladders; none written (the cadence is paused). | Each fan-out search covered by a section. |
| 4A.9 | 5 (6) NL | Queue → cadence → one writer (9 handed to the Link Builder on 10-14). The earned-media leg now leaks rivals: 623 writes 8 businesses AI names instead of the owner as `ai_source` prospects scored 90–100 and tells the owner to pitch them (R83). No win measured. | Profound Actions: actions → pages → outreach → "won". |
| 4A.10 | 6 (6) NL | 2 URLs submitted to Bing on 10-14 (`submitted 2`); IndexNow `key_missing`, the key file still answers 404 (O6); Wikidata checked. | Bing / IndexNow + entity check — beyond the leaders when complete. |
| Drafts | 6 (7) NL | Drafts nothing itself; everything goes through the Link Builder, whose gate gave a competitor a held draft this run (R86). | |

**Area:** (7 + 6 + 5 + 6 + 6) / 5 = 30 / 5 = **6.00 → 6**. AI Growth's Monday schedule has never fired (0 of 1, R94); every one of its 8
executions was started by hand.

**What would have to be true to score higher.**
- **Next half point (6.5):** ≥ 31.25 (+1.25). A dry-run switch so it can be exercised live, run once with the IndexNow key file hosted
  (4A.10 → 7) and with rival domains kept out of the `ai_source` prospects (R83: 4A.9 → 6) → 32 / 5 = 6.4.
- **Next full point (7):** ≥ 33.75 (+2.75). The above, the Link Builder's competitor gate holding (R86: Drafts → 7), and a fan-out
  target written and checked on a live page (4A.7 → 7) → 34 / 5 = 6.8.

### 3.10 Backlink monitoring: 7 (was 7) — weighted mean 6.93

Second attempt, exec 626 (the app's own request 621 was refused by its parent run, R77 — scored in 3.13).

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 4B.1 | 7 (6) | DataForSEO 1, Bing 0, Search Console upload 1, GA4 1, Common Crawl 1 → **3** referring sites, and the criterion's own figure: "Of the 1 sites in Google's own sample (Search Console), DataForSEO sees 0%" (O7 done). The same report's tiles print "Referring domains 18" and "Spam score 63% — High" (DataForSEO's counts incl. the 17 farms) beside "3 sites link" (R112). | Several sources merged + % of Google's sample, consistently. |
| 4B.2 | 8 (8) | Own fetch of 19 referring pages: "3 still carry the link (16%) … of the 17 the DataForSEO index reports live, 1 are live (6%)". | Linkody re-checks; Ahrefs 91.7% live. |
| 4B.3 | 8 (8) | `lost []`, "every linked page works", two-miss rule; no real loss to test (partly NL). | 8 lost reasons. |
| 4B.4 ×1.5 | 8 (8) | 17 farm links set aside with per-cluster evidence ("the same page path on 16 sites"); best links peppol.org (DR 77, "✓ on the page") and tracxn.com (nofollow, labelled). | |
| 4B.5 | 6 (7) | Review-only disavow with the cluster named; no alert on counts. But the app tile says "Spam score 63% — High: many links come from spam sites" for links already set aside (R112), and the anchor block says farm anchors are left out of a table that lists only them (R92). | Alerts on keyword-anchor spikes, consistently. |
| 4B.6 | 6 (7) | Government gap row refused with its reason, 18 off-topic gap rows refused. But 5 of 8 "best of" lists are competitors' own service pages and qzinfomatics.com was saved as a `list` prospect (R86); "competitors' new links" include a Russian-language article about moving to Malaysia. | Competitor gap, new links, real "best X" lists. |
| 4B.7 | 5 (5) | "Unlinked mentions: none"; mentions not tied to the AI-visibility figures in the report. | Mentions first-class, tied to AI visibility. |

**Area:** (7 + 8 + 8 + 8×1.5 + 6 + 6 + 5) / 7.5 = 52 / 7.5 = **6.93 → 7**.

**What would have to be true to score higher.**
- **Next half point (7.5):** ≥ 54.4 (+2.4). The merged count everywhere and no "High spam" verdict on set-aside links (R112: 4B.5 → 7,
  4B.1 → 8), and a page titled "<company> … Partner in Dubai" never read as a list (R86: 4B.6 → 7) → 55 / 7.5 = 7.33.
- **Next full point (8):** ≥ 58.1 (+6.1). The above plus unlinked mentions found and tied to AI visibility (4B.7 → 7) and a real lost
  link handled live with its reason (4B.3 / 4B.4 → 9) → 58.5 / 7.5 = 7.8.

### 3.11 Link building: 6.5 (was 6.5) — mean 6.56

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 4C.1 | 8 (8) | AI-cited pages, resource pages, broken links, competitors' new links, podcasts and a 16-item listings checklist; 7 qualified, 22 not fit with reasons, in 83 s (628). | |
| 4C.2 | 5 (5) | Six competing sites refused by keyword and position (wafeq.com "#1 for 'e invoicing software uae'"), government and data brokers refused. **R86**: daxin-global.ae (sells Dynamics 365, Business Central and e-invoicing) has a held draft; qzinfomatics.com (a Dynamics 365 partner in Dubai) is `ready` at fit 0.87 — a competitor through the gate in the third rating running (R4 → R21 → R86). | Value × likelihood; no rivals. |
| 4C.3 | 7 (7) | Every contact on the prospect's own domain. | Second contact at the site. |
| 4C.4 | 7 (7) | Every quoted line exists on the prospect's page (executor fetched all four); one link, one ask; all 4 drafts held for "[Your name]". "as a option" and a garbled page name in a decline reason (R93). | Pitchbox: AI draft edited by a person. |
| 4C.5 | 7 (7) | First e-mail + follow-ups at 4 and 8 days. Reply Reader 601–604: 4 of 4 classes right; out-of-office return parsed to 2026-11-02 with the colleague captured as a referral; unsubscribe recognised; the factual questions left in one `[Owner: confirm …]` bracket — nothing invented. No live send (NL). | Bounce < 2%, ≤ 49 sends / day, measured. |
| 4C.6 | 5 (5) **(NL)** | No mailbox connected (by rule); SPF / DKIM / DMARC and consent machinery not exercised. | Customer's own authenticated mailbox. |
| 4C.7 | 8 (8) | Reply Reader 604 fetched peppol.org's members list and found the link (`rel follow`, placement content) before drafting the thanks. | |
| 4C.8 | 5 (5) | Link text = page title or brand; targets include the home page (daxin), the blog index `/insights` (lumeafinance) and `/whywith-techand` for a Dynamics partner — not hub pages. | Brand / title anchors aimed at hub pages. |
| 4C.9 | 7 (6, NL) | Control-group impact live: peppol.org "Too early to tell — read at 6, 10 and 16 weeks after the link went live"; tracxn.com "Can't tell — the page had no search impressions before or after the link"; never "caused". | |

**Area:** (8 + 5 + 7 + 7 + 7 + 5 + 8 + 5 + 7) / 9 = 59 / 9 = **6.56 → 6.5**.

**What would have to be true to score higher.**
- **Next half point (7):** ≥ 60.75 (+1.75). A site that sells the same services in the same country set aside whatever it ranks for
  (R86: 4C.2 → 7) → 61 / 9 = 6.78.
- **Next full point (7.5):** ≥ 65.25 (+6.25). The above, the owner's mailbox connected and one approved sequence sent, with replies
  stopping it (4C.6 → 7, 4C.5 → 8), and pitches aimed at hub pages (4C.8 → 7) → 66 / 9 = 7.33.

### 3.12 Reporting & app: 4.5 (was 4.5) — mean 4.50

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| 3.1 | 6 (7) | The site report leads with clicks, impressions, sessions and key events; the brand split is contaminated (R89) and the app's headline "Clicks from Google are up 52% to 32" ignores its own non-significant test (R113). | Revenue / leads, brand vs non-brand, before ranks. |
| 3.2 | **3** (4) | Honest wording everywhere ("not checked", "uncalibrated", "within sampling noise", "too little search volume for a trend"), and 23 reports rendered with no "undefined" / "NaN". But more delivered documents contradict themselves than on 10-13: **R61** ("does not rank in Google's top 10 for any keyword", High, third top issue, beside 15 Search Console queries at ≤ 10 and "Ranks #1 for its brand name"), **R78** (▼13, ▲18), **R112** ("3 sites link" vs "Referring domains 18"), **R113**, R84, R41, R88 — and R38 / R35 tell the owner false things about their own pages. | No number its own document contradicts. |
| 3.3 | **3** (4) | Modules disagree within one evening: the page report says "not ready to publish", the site report and Rank Tracker say "publish it" (R111); the Rank Tracker sets the e-invoicing ladder aside, the cadence queues its rungs (R87); AI visibility says pitch wafeq.com, the Link Builder refuses it as a competitor (R83); site report and Rank Tracker disagree on the peppol page (R92); the app's technical page would diff a full report against a technical audit (R66). | One queue: impact × confidence × effort. |
| 3.4 | 3 (3) **(NL)** | Control-group impact for links only; no page / fix change test exercised. | SEOTesting / SearchPilot. |
| 3.5 | **5** (2) | "What happened in this period" annotations live in the site report (Google updates, audit events by report type). Chart annotations in the app not exercised (no session in the company). | Marked on charts automatically. |
| 3.6 | 6 (7) | Dashboard, PDF, Word, HTML, Markdown, images, fix-pack files, CSV, API; all 24 reports landed; 23 rendered server-side with the app's own code, no crash. But scheduled delivery has never sent anything (`report_deliveries` 0 rows ever; delivery off for all 7 companies; no SMTP), and the 13 monitor reports of this run are stored `progress` and held by the delivery rule (R110). | Semrush / Ahrefs scheduled PDFs to 50 recipients. |
| 3.7 | 3 (2) | Share links and a viewer role exist (10 links created and opened 34 times by a test company that day); the customer's mark only on the shared page; no portal or custom domain. **R110 (High)**: a share link to any monitor report opens under "This run did not produce a report" — 79 of 178 reports in the table. | AgencyAnalytics white-label portal. |
| 3.9 | 4 (3) | A real failure reached the owner's Slack (HTTP 200) and the ops mailbox (SMTP 250) within 5 s, recorded `webhook,email` (643; R5 / R6 gone). But one stale alert was re-posted to Slack 14 times that day as "this alert has reached nobody" while its row stays `failed` (R79), and rows 1–3 reached Slack 54–63 h after they were raised (R105). Not quiet. | Severity, de-duplication, quiet unless real. |
| 3.11 | 6 (6) | Lineage rows on every report (source, period, sample, measured / modelled). Some do not match: PageSpeed listed where none ran, "sample 0 keywords" over ~60 printed, ages "as of 2026-10-15" from a 10-11 cache (R73). | Lineage on every number, correct. |
| 3.12 | 6 (5) | Search Console (incl. the links export), GA4, Bing, Business Profile, CrUX, Ahrefs DR, Slack, Gotenberg. WordPress off; Google sign-in not configured. | AgencyAnalytics 80+. |
| UI | — | Not a criterion. A **new customer's** journey in a real browser: 107 visits at 1440 / 375 px, light and dark — 0 console errors, 0 failed requests, 0 contrast failures, an h1 on every page; the ownership gate holds; 27 guides; cost and time on every form. Wrong: R97 (the locked card names a verification method the server refuses), R99 / R100 (two prices for one run; pre-flight vs engine), R108, R109. The owner's company was not exercised (NL). | |

**Area:** (6 + 3 + 3 + 3 + 5 + 6 + 3 + 4 + 6 + 6) / 10 = 45 / 10 = **4.50 → 4.5** (3.8 is counted in 3.13, as in 2026-10-11).

**What would have to be true to score higher.**
- **Next half point (5):** ≥ 47.5 (+2.5). Monitor reports finished as a status the delivery rule accepts, started notes held as interim
  (R110: 3.6 → 7, 3.7 → 4), and no delivered report contradicting its own data on the R61 / R78 / R112 / R113 class (3.2 → 4) →
  48 / 10 = 4.8.
- **Next full point (5.5):** ≥ 52.5 (+7.5). The above, one shared state that every module reads — QA state, set-aside ladders,
  competitor status (R111, R87, R83: 3.3 → 5) — the stale-alert loop fixed (R79: 3.9 → 6) and a page / fix change test seen live
  (3.4 → 5) → 54 / 10 = 5.4.

### 3.13 Cost control & reliability: 4 (was 4.5) — mean 4.20

| Crit. | Score (was) | Evidence | Gap to the leader |
|---|---|---|---|
| Guards | 5 (6) | Every run reserved its ledger row on the main path before the first paid node and settled it; none left `reserved` (R17 gone). But the concurrency gate refused the customer's own backlinks request because its parent's row settled 81 ms too late (**R77, High**; the refusal then took 5 min 33 s and ended `success`, R96); front-door rows duplicate the monitors' rows, so the ledger shows **$2.89 for $1.48 spent** (R81); the app's budget check uses shipped defaults while the engine reserves calibrated figures (R100). | Server-side plan limits. |
| 3.10 | 4 (4) | DataForSEO per run equals its own task costs and lands within 2.2–2.3% of the account per window; the engine reports its own disagreement with the balance. But every Claude figure labelled "measured" counts structured answers as `"[object Object]"` — 15–67% low (R47 / R80); Site Tracker / Link Builder / pulse-Claude are estimates (R82); the app shows search-data-only figures as "actual" (**R102, High**), report pages show DataForSEO only (R114), app-started AI visibility / backlinks would record DataForSEO alone as complete (R115); two prices on one screen (R99). | Estimate, budget, actual vs estimate reconciled. |
| 2.14 | 5 (4) | As 3.6. | |
| 3.8 | **3** (5) | 50 executions, all `success` but the deliberate failure; DataForSEO errors inside HTTP 200 retried on the page path (R18 gone); the failure path delivers. But the delivery rate is now measurable, and low: since each workflow was created, **4 of 19 due scheduled fires ran within 90 minutes**; Rank Tracker, Site Tracker, AI Growth, Content Cadence and Link Builder have **never** fired from their schedule; the pulse was late 6 of 7 days (**R94, High**). Cause: the Mac host sleeps (a hypothesis that fits 8 of 9 timed fires) **and** every n8n restart discards a due fire (established from the compiled Schedule node and the logs) — the second is not a hardware limit. A refused run ends `success`, so the failure watcher sees nothing (R116); the admin delivery-rate page counts 57 of 72 misses from before the workflows existed (R103). | Every automation visible; delivery ≥ 99% measured. |
| Ops | 4 (3) | Alerts now reach Slack and e-mail (R5 / R6 gone). Still Mac-hosted, no `GENERIC_TIMEZONE`, R79's re-send loop, R105's 54–63 h delays, Page Watch alerts never reach the app. | Hosted, always-on, alerted. |

**Area:** (5 + 4 + 5 + 3 + 4) / 5 = 21 / 5 = **4.20 → 4**. Cap due: the always-on host is an owner item not bought (D25a); the
restart behaviour and R77 / R81 are not.

**What would have to be true to score higher.**
- **Next half point (4.5):** ≥ 21.25 (+0.25). Claude counted from n8n's own `tokenUsage` (or the serialized answer) wherever a node
  reports it (R47 / R80: 3.10 → 5) → 22 / 5 = 4.4.
- **Next full point (5):** ≥ 23.75 (+2.75). The above, the guard ignoring its own parent's reservation and one ledger row per request
  (R77, R81: Guards → 6), and a week in which every scheduled fire arrives — an always-on host, or at minimum no deploy restart
  inside a due window and a catch-up for discarded fires (R94: 3.8 → 4) → 24 / 5 = 4.8.

---

## 4. Outcomes (reported, not rated)

- **Rankings: none from the system's work.** No ladder head or rung in the top 50 on any of 12 live readings (632); "peppol uae" fell
  from #47 to outside the top 50 while 9 of the top 9 places changed. Search Console holds 15 queries at an average position ≤ 10,
  mostly brand and long-tail on existing pages; the brand query reads #1.
- **Published pages: none.** Four written pages wait; two of them ("azure api management monetization", "ai consulting") failed their
  own QA and are drafts. The cadence is paused on the pile-up guard.
- **AI answers: named in 0%** of 74 answers (95% range 0–4.9%), pages cited 0% (0–4.9%), share of voice 0% of 193 mentions; brand
  recognised by 5 of 5 assistants; AI Overview on 71.4% of the searches, citing the site in 0%; GA4 shows 0 AI-assistant sessions.
- **Links: none won.** 3 referring sites after the merge of five sources (best links peppol.org, follow, and tracxn.com, nofollow),
  17 farm links set aside; 4 drafts held for the owner's name; no mailbox, nothing ever sent.
- **The site's own search data:** clicks 32 vs 21 (+52%, *not* significant, −12% to +164%), impressions 5,308 (+224%, a real change),
  average position 25.5 (from 32), organic sessions 84 (+83%, a real change) — not attributable to this system; nothing it wrote is
  live.
- **The site's real indexing problem** is now visible in the data even though the audit misreads it: Google serves most of the site
  on the bare host (37 pages / 5,193 impressions vs 13 / 522 on www), and the sitemap submitted to Search Console is the bare-host one.
- **Cost of the re-rating:** ≈ $3.86 (DataForSEO $2.4486 measured from the account; Claude $1.412, of which $0.53 is n8n's estimate for
  four Opus streaming calls) for 50 executions — about the same as 2026-10-13's $3.79.

---

## 5. What this rating cannot prove, and the ceiling it implies

- **Outcomes of published pages** — nothing is published. K10 (calibration from own outcomes), K13 (won / stuck re-planning), C9
  (QA validated against outcomes), C16 (per-page outcomes), 4C.9's reads and 4A.9's "won" cannot rise above a capability score until
  pages are live and measured for weeks.
- **The weekly loop on a host that does not sleep** — the run used on-demand starts; on this host 5 of 10 schedules have never fired.
  2.1, 3.8 and Ops are capped by that (D25a, owner item), and partly by the restart behaviour, which is not.
- **The owner's data** — no business profile, facts, reviewer or style guide: C2, C4, C17, 4A.5 and every draft's "[Your name]" stop
  there. **No mailbox**: 4C.5 / 4C.6 sending and reply handling in the app (the Reply Reader itself ran live).
- **The app inside the owner's company** (dashboards with data, chart annotations, share links of techand.ai's reports, "Send it
  now"), and **report delivery** to a person (delivery off, no SMTP): 3.5–3.7 are scored on the new-customer pass and the database.
- **AI Growth's current code path** (not run), **WordPress push** (off), **"I fixed this" re-check** (not requested), **a second and
  third site** (none named — the "3+ sites" requirement of the 2026-10-11 "To reach 9" list is still unmet).

**Ceiling.** If every criterion capped only by those items were lifted to the level its built capability suggests (C2, C4, C16, C17,
4A.5, 4C.5, 4C.6, 2.1, 3.6, 3.7, 3.8, 1.10, by one to three points each), seven areas would gain half a point to a point (≈ +4 area
points) and the overall mean would rise by about 0.3 — to ≈ 5.85, i.e. **6**. Everything above that on this evidence is held down by
**correctness**, not by missing purchases or missing outcomes: the advice the system gives about the site it is looking at. Above 8
needs measured outcomes — a published page that ranks, a link won, an AI answer that names the site — and none exists yet.

---

## 6. The single thing between this system and the next overall point

**One correct picture of the customer's own site — and of the system's own outputs — read by every path before it advises.** Nine of
this run's fourteen High defects are that one gap seen from different modules: the page inventory holds no title for 25 of 45 pages,
so the ladder plans three new AI-consulting pages beside a live one (R34); query-to-page matching is literal, so discovery says 20 pages
do not target their own searches and recommends new pages for searches the site ranks #6.2 for (R35, R36); the verdict reads 9,000
flattened characters and tells the owner their article lacks the dates, tables and author it has (R38); the audit strips the host from
Google's canonical and ranks a bare-host / www split first as "not indexed — cannot rank" (R59); the full report seeds its keyword
research from three card headings instead of the site model and the configured keywords (R60), and trusts a third-party index over
the Search Console rows in the same document (R61); and the outputs do not carry their own state — QA failure, report type,
set-aside status — so the site report says "▼13" across unlike reports (R78) and tells the owner to publish drafts the QA refused
(R111). Fixing that family — proven in a re-run, not in code — moves keywords, ladders and cadence by up to a point and technical
audit, site tracking and reporting by about half a point each (≈ +4 to +4.5 area points: mean ≈ 5.85, back to **6**). From there,
**6.5** needs the rest of this run's High items as well: monitor reports the app can deliver and share (R110), schedules that fire
(R94), one competitor gate shared by AI visibility, backlinks and the Link Builder (R83, R86), and a QA that reads the numbers it
checks (R37, R45). Everything else on the register is smaller than the site-picture gap.

---

**Overall: 5.5 / 10 — area mean 5.54 (72 / 13).** Per area: keyword research & verdicts **5.5** · keyword ladders **4.5** · content
creation & QA **6** · content cadence **4.5** · technical audit **5** · rank tracking **5.5** · site tracking **6.5** · AI visibility
**6.5** · AI growth **6** (NL) · backlink monitoring **7** · link building **6.5** · reporting & app **4.5** · cost control &
reliability **4**.
