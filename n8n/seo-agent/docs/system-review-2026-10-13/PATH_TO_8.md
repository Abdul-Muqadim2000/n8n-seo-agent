# Path to 8 — what it would take to raise the system from 6/10 to 8/10

Scoping document, 2026-10-14. **Read-only on the product**: nothing was built, deployed, run or paid for to write this.

**Inputs.** `SCORECARD.md` in this folder (the independent re-rating of 2026-10-13, overall **6/10**, area mean **5.92**), the
unchanged rubric in `../system-review-2026-10-11/CRITERIA_keywords_content.md` and
`../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md`, and
`../system-review-2026-10-11/FIX_PLAN.md` §2 / §3.1 / §3.11 / §5.2 / §6. Live evidence: `RESULTS.md` §3.1 and §3.2 (48 executions
on techand.ai, 481–529, $3.79).

**State taken as given** (not re-verified here): as of 2026-10-13 evening, 95 register items are fixed, deployed and pushed; harness
4008 passed / 0 failed; app 366 unit tests (`../../HANDOVER.md` banner). Everything in the register is fixed **except** D25a
(always-on host), G13 (CMS push), G16 (first live send), G20 (bigger AI panel), G17 (time-to-rank calibration) and the twelve **O**
owner items. **No second live run has happened**, so the R1–R16 fixes and G11 / G12 / G14 / G21 / G23 / G27 / G29 / G31 / G32 are
deployed, not proven. This document never treats a deployed fix as proven; where the distinction matters it is marked **(NL)**.

**What "8" means here.** The rubric's scale is explicit: `4 = automated but basic · 6 = mid-market parity · 8 = parity with the
named leader · 10 = beyond the leaders and proven live` (CRITERIA_technical… header). So every "reach 8" below means *match the
named leader on that criterion*, not "be good at it".

---

## Headline finding

**An overall 8 is not blocked by engineering. It is blocked by six owner decisions, three of which cost recurring money, and by
one input that no decision can buy: months of the system's own published-page outcomes.**

Three results, each reproducible from the numbers in §1:

| Scenario | Area mean | Overall |
|---|---|---|
| Today (`SCORECARD.md` §1) | 5.92 | **6** |
| The second live run alone, if every deployed fix passes | 6.92 | **7** |
| Every buildable item done, **owner does nothing** | **7.46** | **7** |
| Every buildable item **and** every owner item **and** the recurring spends | 7.885 | **8** |

The third row is the finding. With every tranche in §3 built and nothing left for engineering to do, the mean lands at **7.46** —
**0.04 short of the 7.5 that would round to 8**. The last 0.5 of area points is bought entirely by the owner: filling the business
profile (O1 / O2), connecting a mailbox and approving one send (O4 / G16), enabling the Chrome UX Report API, uploading the
IndexNow key and the Search Console links export (O6 / O7), naming a CMS (G13), paying for an always-on host (D25a) and paying for
a 100-prompt AI panel (G20 / O8). None of those is a build problem; all of them have been open since 2026-10-11.

And even with all of it, **three areas are hard-capped at 7.5 for 2026** — keyword research, keyword ladders and AI growth —
because K1, K10, C9, 4A.9 and 4C.9 are anchored on the system's own tracked outcomes (G17) and nothing the system has written is
published yet (`SCORECARD.md` §4: "Published pages: none"). So the 8 has to come from ten of thirteen areas reaching leader parity
with almost no slack: the full-ceiling mean of 7.885 clears the defensible 7.75 bar by 0.135, which is **1.75 area points** — at
most three more half-point misses across those ten areas before the rating rests on a rounding rule.

---

## 1. The arithmetic of the target

### 1.1 Where the score comes from

`SCORECARD.md` states the construction: each area is the mean of its criteria, with the strong-evidence criteria
(**K1–K3, K8, K10, C2, C3, C14, C15, 4B.4**) weighted **1.5×** and everything else 1×, rounded to the half point; the overall is
the nearest whole number of the thirteen area scores' mean (precedent: `FIX_PLAN.md` §6 records mean 4.80 → overall 5 and mean 5.92
→ overall 6).

I rebuilt all thirteen area means from the criterion scores printed in `SCORECARD.md` §2.1–§2.13 under that rule. **All thirteen
reproduce exactly** (KW 6.24→6, LAD 5.57→5.5, CON 5.86→6, CAD 5.71→5.5, TECH 4.77→5, RANK 5.75→6, SITE 6.83→7, AIV 6.86→7,
AIG 6.40→6.5, BL 7.07→7, LB 6.44→6.5, REP 4.30→4.5, OPS 4.40→4.5). The weighting and the rounding are therefore safe to plan
against, and every projection below is computed the same way.

### 1.2 Today's position and the target

| # | Area | Now | Criteria at 8 today | Criteria below 8 today |
|---|---|---|---|---|
| 1 | Keyword research & verdicts | 6 | 1 (K6) | 9 |
| 2 | Keyword ladders / planning | 5.5 | 0 | 6 |
| 3 | Content creation & QA | 6 | 0 | 13 |
| 4 | Content cadence / pipeline | 5.5 | 0 | 7 |
| 5 | Technical audit | 5 | 0 | 13 |
| 6 | Rank tracking | 6 | 0 | 8 |
| 7 | Site tracking | 7 | 2 (2.7, 2.11) | 4 |
| 8 | AI visibility | 7 | 4 (4A.3, 4A.4, 4A.6, 4A.8) | 3 |
| 9 | AI growth | 6.5 | 0 | 5 |
| 10 | Backlink monitoring | 7 | 3 (4B.2, 4B.3, 4B.4) | 4 |
| 11 | Link building | 6.5 | 2 (4C.1, 4C.7) | 7 |
| 12 | Reporting & app | 4.5 | 0 | 10 |
| 13 | Cost control & reliability | 4.5 | 0 | 5 |
| | **Total / mean** | **77.0 / 5.92** | **12** | **94** |

(106 criterion slots in all; K8, K10, K12 and K13 are each scored in two areas, and 1.11 is n/a for a site this size.)

- **Bar for an overall 8** (the convention actually used): area mean ≥ **7.5**, i.e. a total of **97.5** against today's **77.0** —
  **+20.5 area points**.
- **Bar for a defensible, non-boundary 8** (mean ≥ 7.75, so the rating does not hang on a rounding rule): total **100.75** —
  **+23.75 area points**.

For scale: the entire 2026-10-11 fix plan — 95 items, four phases plus session 6A and most of Phase 5, 21 live runs, roughly 2,300
new harness assertions — moved the mean **4.80 → 5.92, i.e. +1.12** (`FIX_PLAN.md` §6). Reaching 7.5 needs **+1.58 more**, and the
cheap part is spent: that cycle cleared wrong numbers and wrong advice, which is what the 4→6 band is made of. What remains is
depth parity with named leaders, which is where the paid sources, the recurring spend and the elapsed time live.

### 1.3 How many areas must reach 8

+20.5 points over 13 areas is **+1.58 per area on average** — there is no combination in which "a few areas reach 8" produces an
overall 8. Working from the per-criterion ceilings in §2 and §4, the full-ceiling distribution is:

| Areas at **8** (10) | Areas at **7.5** (3) |
|---|---|
| Content, Cadence, Technical audit, Rank tracking, Site tracking, AI visibility, Backlinks, Link building, Reporting & app, Cost control & reliability | **Keyword research** (K1 ≤ 7, K10 ≤ 6), **Keyword ladders** (K10 ≤ 6), **AI growth** (4A.9 ≤ 6) |

Mean **7.885 → overall 8**. The three 7.5s are not laziness in the plan; they are arithmetic consequences of G17, shown in §4.

**Is an 8 arithmetically impossible while an area stays at its ceiling?** No — but only just, and only for these three. The test:

- **Keywords and ladders capped at 7.5 by G17:** survivable. K1 and K10 are both weighted 1.5× and both appear in two areas, which
  is why they cost two areas half a point each rather than one. Total cost: 1.0 point of the 1.75 of slack.
- **AI growth capped at 7.5 by 4A.9:** survivable. Cost 0.5.
- **A fourth area at 7.5:** mean 7.846. A **fifth**: 7.808. A **sixth**: 7.769 — still over 7.75 by 0.019. A **seventh**: 7.731,
  which clears only the rounding boundary and no longer the defensible bar. In practice: **after the three hard caps, at most three
  further areas may miss 8.**
- **One area at 7.0** costs the same as two half-point misses: three caps + one area at 7.0 + nine at 8 gives 7.808, which still
  clears 7.75 — but it then permits only one further half-point miss anywhere else. Two areas at 7.0 would leave 7.73.
- The area that decides it is **reporting & app**. At its current 4.5 it is 3.5 points below its ceiling — more than the entire
  slack of the plan twice over. An overall 8 with reporting left anywhere below 8 requires every other area including the three
  capped ones to beat its ceiling, which §4 shows they cannot. **Reporting & app at 8 is a precondition, not an option.**

---

## 2. Per area: the gap to 8

Legend for the last column: **(a)** already fixed, only needs the live run to prove it · **(b)** needs the owner (the decision or
action is named) · **(c)** new work, with a size (**S** < 2 h · **M** ≤ 1 day · **L** > 1 day, the `FIX_PLAN.md` §3.1 scale) and its
dependency. Current scores and evidence are `SCORECARD.md` §2.x; execution ids are from `RESULTS.md`.

### 2.1 Keyword research & verdicts — 6 → ceiling 7.5

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| K1 | 5 | MarketMuse (Topic Authority = the site's breadth and depth **on the topic** plus its search performance) | Difficulty against our authority *in that topic*; and the 10-anchor's predicted-vs-actual top-10 back-test | Topic-level authority from `seo_pages` + the measured Search Console rows, replacing the domain-level 75th-percentile KD (exec 495, cached 2026-10-08) | **(c) M**; the back-test half is blocked by G17 → ceiling 7 |
| K2 | 7 | Ahrefs Traffic Potential | — (we calibrate against measured impressions, which the leader does not) | Only the label: 36 keywords are calibrated but none of the 15 *shown* carries the "measured" tag (`RESULTS.md` §3.2 closing note), so every printed figure reads "modelled" | **(c) S** then **(a)** |
| K3 | 6 | the rubric's own 2025 CTR data (AIO −58%, 58.5% zero-click) | Per-keyword discounts for snippet / local / video, not one curve | Extend the single curve in `v5/code/_rank_serp.js:17-23` to a per-feature discount using the SERP features G6 already reads | **(c) M** |
| K4 | 6 | Ahrefs "pick intent" / Semrush SERP summary | The **dominant top-10 page type decides** the intent and a mismatch is flagged | Make the measured page-type majority override the Claude label; 15 live checks of a 16 cap today (exec 518) | **(c) S/M** |
| K5 | 5 | Google topic-focus guidance; HubSpot's 76–81% loss | — | R13 is fixed (`fitTopic`, 25% bar, harness S59) but the live report still offered "character ai" 110,000/mo and "mh enterprises uae" (exec 523) | **(a)** |
| K7 | 7 | Keyword Insights (≥ 3–4 shared top-10 URLs; 3 = broad, 5 = strict) | SERP overlap on **every** cluster — ours covers 5 of 43 because only 15 keywords get a live SERP (exec 518) | Raise the live-SERP cap per discovery run | **(c) S** + recurring DataForSEO spend (~$0.002/check) |
| K8 | 6 | Google site diversity | — | R12 is fixed (`page_mismatch` label, harness S59) but the live run printed "no page of yours answers this search" on 11 of 25 rows naming the ranking page (exec 518) | **(a)** |
| K9 | 7 | — | — | R7 is fixed (`verdict.txt` asks for an FAQ *section*, not FAQPage) | **(a)** |
| K10 | 6 | — (10 = re-fit from **the product's own** tracked outcomes) | A probability per plan type calibrated on our own results, not Ahrefs' 1.74% base rate | G17: ≥ 20 of our own pages published and tracked to an outcome | **(b)** + months → **ceiling 6**, see §4 |

### 2.2 Keyword ladders / planning — 5.5 → ceiling 7.5

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| K9 (plan) | 6 | Semrush Keyword Strategy Builder | Not promise a page the guard then refuses | R1 is fixed (the refused run no longer leaves a `writing` row); `fix_phantom_pages.py` is **written and not run** | **(a)** + **(b)** run the repair script |
| K8 | 6 | Google site diversity | — | as 2.1 | **(a)** |
| K10 | 6 | — | — | G17 | **(b)** + months → ceiling 6 |
| K11 | 5 | MarketMuse content plans; Zyppy (40–44 internal links ≈ 4× clicks) | A link map **verified live** plus gaps against a competitor topical map | R15 is fixed (`ladder_target_url` travels, both planned links reach `links_to_add_when_published`); "verified live" needs a published page (O9); the competitor topical map does not exist | **(a)** + **(b) O9** + **(c) M** for the topical map |
| K12 | 6 | Google helpful-content; HubSpot | A topic-radius **check**, not only a warning | G32 `_radius.js` is built and draws in reach / stretch / out of reach, "shown never enforced" | **(a)** |
| K13 | 4 | — (10 = won / stuck states that **re-plan automatically**) | Automatic re-planning instead of a recommendation | G32 `_replan.js` + R16 `fitStored` are built; `fix_brand_rungs.py --brand facts.ae` is **written and not run**, so rung 2 of `lad_mv40b6s9h5a8` is still "facts erp" `planned` and still in the Rank Tracker's delivered report (exec 505) | **(a)** + **(b)** run the script |

### 2.3 Content creation & QA — 6 → ceiling 8

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| C1 | 7 | Surfer (≥ 50% of terms, then length stops mattering); MarketMuse | Hit the target, not just set it: G33 set 68% from cubesoftware.com and QA measured the draft at **40%** and shipped it (exec 521) | Make the coverage target a gate like the placeholder count, not a report line | **(c) S** |
| C2 | 5 | Google "original information" | Original data / experience / proof — ours printed 11 × `[Price]` and "[Number] years of industry experience" (exec 521) | Business facts on file, then a proof-item check in QA | **(b) O1 / O2** + **(c) S** |
| C3 | 7 | Surfer Facts; Writer claim detection | Re-check every claim **at refresh**, not only at first write | Run the G4 claim checker on the refresh path too | **(c) M** |
| C4 | 4 | Google Who/How/Why | A credentialed author, an author page, Person schema, a YMYL reviewer — `seo_profiles` is empty so the page shipped `author: null` with no author box (exec 521) | Fill the profile; P2-6's gate has still never had anything to count | **(b) O1** |
| C5 | 7 | Semrush SEO Writing Assistant (Copyleaks) | An **external** plagiarism index; ours compares only the 8 pages the run already read (2,762 shingles, 0.1% overlap, $0 — exec 521) | A paid similarity API behind the existing `Originality Check` node | **(c) S** + **(b)** a subscription (≈ $20–40 / month) |
| C6 | 6 | rater guidelines on filler | Repetition and generic-sentence checks reported per section — ours ran but was not itemised (exec 521) | Itemise the checks in the QA output so they can be scored | **(c) S** |
| C7 | 7 | Semrush Readability | — | Code and prior evidence only; this run did not itemise it **(NL)** | **(a)** |
| C8 | 4 | Surfer / Ahrefs AI Content Helper (the SERP's min–max word count) | Length judged by coverage inside a SERP range; ours shipped 2,891 against a 2,200 target (+31%) and its two counters disagreed (2,891 vs 2,727) | R8 and P2-7 are fixed (a rung row now carries the median length of its topic's ranking pages); one counter, and a min–max range instead of a point target | **(a)** + **(c) S** |
| C9 | 3 | Surfer (publishes its score↔rank correlation) | A QA score **shown to correlate with outcomes** | R11 is fixed (a run that exhausts `qa_max_rounds` still failing is labelled "not ready to publish", `publishable: false`, `-DRAFT`, with the **last** round's counts). The honesty half is (a); the validation half needs G17 | **(a)** then **(b)** + months → ceiling 6 |
| C10 | 7 | Zyppy title data | The check on the **live URL** | URL Inspection of 45 pages already runs (exec 523); the live publish check needs a page that is actually live | **(b) O9** |
| C11 | 6 | Google structured-data rules | Schema matched to page type **and visible content** across more page types — ours emits `Service` + `BreadcrumbList`, `faq_count 0` (exec 521, G2 working) | Widen page-type schema coverage and validate against the rich-result rules | **(c) S** |
| C12 | 6 | Zyppy (≥ 1 exact-match anchor ≈ 5× traffic); HubSpot clusters | **Inbound** links verified from relevant live pages | R15 is fixed; verification needs published pages | **(a)** + **(b) O9** + **(c) S** |
| C13 | 7 | Google Images guidance | **Original** visuals — ours are generated cards (3 WebP, 20–38 KB, exec 521, G30), never checked on a live page | Data visuals built from the run's own measured numbers | **(c) M** + **(b) O9** |

### 2.4 Content cadence / pipeline — 5.5 → ceiling 8

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| C14 | 7 | Clearscope Content Inventory | — (the guard is louder than the leaders': exec 506 paused itself naming every waiting keyword) | R1's refusal path | **(a)** |
| C15 | 6 | Clearscope decay alerts; HubSpot +106% | A **scheduled substantive refresh** with facts re-checked, not just a decay action | A refresh schedule driven by `seo_content_log` + the C3 re-check | **(c) M** |
| C16 | 5 | Koala / Byword (one-click CMS publish) | CMS draft push, automatic detection, per-page outcomes — ours detects (6 candidates, 0 live, exec 515) and pushes nothing (G13) | A CMS target the owner names, then the push behind Manual approval | **(b) G13** + **(c) M** |
| C17 | 5 | Jasper / Writer brand voice; Semrush tone | A **stored** style guide, applied and checked | G31 is built (6 `style_*` columns in `seo_profiles`, applied in three prompts, checked in QA) and the owner's guide is unfilled | **(a)** + **(b) O1** |
| K8 / K12 / K13 | 6 / 6 / 4 | — | — | as 2.1 and 2.2 | **(a)** |

### 2.5 Technical audit — 5 → ceiling 8

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| 1.1 | 6 | Screaming Frog / Botify (up to 100 URLs/s) | Whole-site or ≥ 100k URLs; ours caps at 200–1,000 (45 of 45 crawled with the figure shown, exec 523) | Raise the crawl ceiling and demonstrate it on a large site | **(c) M** |
| 1.2 | 5 | Sitebulb / Screaming Frog, on a labelled fixture set | — | R10 is fixed (`VERDICT_UNSPECIFIED` now reads "not checked"; no non-Info finding ships with empty evidence) | **(a)** |
| 1.3 | 7 | Ahrefs / Screaming Frog URL Inspection | The **Pages report trended** and **removals detected** — ours is a monthly check-in | Trend the Pages report from stored rows and diff for removals | **(c) M** |
| 1.4 | 4 | **Sitebulb Response vs Render on every page** | The diff on every page; G14 does 5 key pages, deployed after the runs | Widen past 5 pages | **(a)** + **(c) S** |
| 1.5 | 4 | Semrush CWV report / Screaming Frog CrUX | CrUX p75 per template, mobile + desktop, **trended** — ours prints `crux.available false, reason "api_off"` (exec 523) | Enable the Chrome UX Report API; the trend then needs a few weeks of readings | **(b)** + weeks |
| 1.6 | 5 | the rubric's own anchor (severity × affected clicks) | A basis that is not invented: ours ranked a false High #2 of 60 on "720 clicks and 22,860 impressions" against 38 / 5,295 measured | R10's `_impact.js` cap (every basis capped at the property's measured 28-day totals, and it says when it capped) | **(a)** |
| 1.7 | 4 | Conductor / ContentKing (24/7, alerts in minutes); Ahrefs Always-on Audit | Key pages watched daily — G11's Page Watch (`SEOagentPageWch1`, 41 nodes, daily 05:45, $0) was deployed the morning **after** the runs | Nothing to build | **(a)** |
| 1.8 | 0 | **Lumar Protect (350+ tests in CI that can block a deploy)** | A gate in CI; G27 built the endpoint (`POST /webhook/seo-prerelease`, verdict + exit code) but nothing consumes it | Prove the endpoint live, then the owner wires it into their deploy for the "blocks a bad deploy" half | **(a)** + **(b)** |
| 1.9 | 6 | **Ahrefs Patches / Botify PageWorkers** (fixes deployed via a JS snippet or Cloudflare Worker, then checked live) | One-click deployment; ours ships a zip (verified byte-identical to the live robots.txt, exec 523) | A snippet or Worker on the customer's site | **(c) L** + **(b)** CDN/DNS access → **ceiling 6**, see §4 |
| 1.10 | 4 | Ahrefs Always-on Audit | Items that close themselves within days | G11's "I fixed this" re-check, deployed after the runs | **(a)** |
| 1.12 | 7 | — | Anchors alongside the suggestions | We have click depth, 6 orphans, `internal-links.csv` (execs 497, 523) | **(c) S** |
| 1.13 | 6 | Google rich-result rules | — | R2 is fixed (`Audit_Diff` filters both sides through the audit type's categories); the technical-audit path still reported Schema "new" every time (exec 513) | **(a)** |
| 1.14 | 4 | the rubric's own internal criterion (precision ≥ 95% on a labelled set of **sites**, published) | A set that includes unhealthy sites: `ACCURACY_SET.md` reports 100% / 100% over 53 + 34 cases but on three healthy sites, so the Critical end is unmeasured — and R10 was a live High with empty evidence against that 100% | R10 live-proven, plus labelled cases from a broken site | **(a)** + **(c) M** |

### 2.6 Rank tracking — 6 → ceiling 8

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| 2.1 | 5 | **AccuRanker (daily + on-demand refresh)** | Daily readings, a customer-triggered refresh, and an automatic re-check after a publish or fix | Daily schedule + an on-demand endpoint; G11 supplies the after-a-fix half | **(c) M** + recurring spend (15 keywords ≈ $0.03/day ≈ $0.9/site/month) |
| 2.2 | 6 | SE Ranking (stores a cached SERP as proof) | Retention stated to the customer; the snapshot is already stored per reading (`_rank_serp.js`, exec 505) | Print the retention window in the report | **(c) S** |
| 2.3 | 7 | Semrush / Ahrefs (mobile + desktop) | Both devices on **every** keyword, not only the main ones (rubric R2: only 13% hold the same position) | Widen the device loop | **(c) S** + spend (doubles the checks) |
| 2.4 | 4 | Semrush (ZIP) / Whitespark (225-point geo-grid) | City and ZIP level; ours is country only | City-level location codes | **(c) M** + spend; geo-grids are not pursued (see §4) |
| 2.5 | 7 | **Ahrefs (19 SERP feature types)** | 15+ feature types; G6 gives six families from the SERP already paid for (exec 505) | Parse the remaining feature types out of the same response | **(c) M**, $0 extra |
| 2.6 | 7 | Semrush / Ahrefs share of voice | Share of voice **trended** | Chart the stored history (the method text is already quoted and labelled modelled) | **(c) S** |
| 2.13 | 6 | **Semrush (20 competitors per project)** | 10–20 tracked competitors with movers; ours reads positions opportunistically (cleartax.com #16, exec 505) | A competitor list per ladder with movers | **(c) S/M** + spend |
| 2.14 | 4 | the rubric's anchor (cost per keyword per month shown and capped) | A published, capped per-keyword cost; this workflow carried **no ledger row at all** (R9) | R9 is fixed (reserve and settle in the monitors, DataForSEO estimate beside the AI estimate), then publish $/keyword/month | **(a)** + **(c) S** |

### 2.7 Site tracking — 7 → ceiling 8

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| 2.8 | 7 | SEOTesting + Looker Studio | Revenue **per landing page** | Join GA4 revenue to the landing page in the weekly brief | **(c) S** |
| 2.9 | 6 | the rubric's anchor (every tracked page within 2,000/day) | The weekly tracker's own inspection count reported — the full report does 45 of 45 (exec 523) but the tracker does not say | Report the count; G25's rotation already exists | **(c) S** |
| 2.10 | 7 | Semrush diagnostics | **Movers** alongside striking distance / CTR gaps / decay / cannibalisation, each already actioned (exec 515) | Add the movers table | **(c) S** |
| 2.12 | 5 | Search Console's own annotations (added late 2025) + the num=100 break | Automatic annotations on charts; the core update is called out in prose only | G12 is built (`v5/data/seo_events.json`, 7 Google updates + the Sep-2025 num=100 break) and is **in neither build** that ran | **(a)** |

### 2.8 AI visibility — 7 → ceiling 8

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| 4A.1 | 4 | **Profound (100 prompts × 3 engines daily)**; Semrush (25/day, 213–261M prompt database) | A panel of ≥ 100 prompts; ours stores 8 and asked 7 (exec 502). And the market index printed a false owner row (19,579 citing answers from a 4-character name match, under its own "0 AI answers cite you", exec 526) | R14 is fixed (`you` comes from the domain row only). The panel is G20 + O8 | **(a)** + **(b)** money + **(c) M** |
| 4A.2 | 7 | the rubric's anchor (≥ 6 engines, localised) | Full localisation: 6 engines and 47 requests ran (exec 526); Claude cannot be localised — its endpoint refuses `web_search_country_iso_code` with 40501 | Nothing available; the last point is vendor-blocked | **(a)**, then vendor-capped |
| 4A.5 | 5 | Gartner 2026-03 (accuracy checks mandatory) | Wrong claims checked against a fact base; ours switched itself **off** honestly (`fact_check "no_facts"`, exec 526) | Fill the business profile | **(b) O1** |

### 2.9 AI growth — 6.5 → ceiling 7.5

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| Readiness | 7 | Profound Actions / AthenaHQ | — (12 pages scored, average 78/100, on raw HTML, exec 511) | Score the signals currently left out | **(c) S** |
| 4A.7 | 6 | the rubric's anchor (every fan-out search covered by a section) | Every fan-out search covered; ours queued 5 of 7 questions (exec 511) | Map every fan-out search to a section | **(c) M** |
| 4A.9 | 6 | **Profound Actions** (actions → pages → outreach → "won" measured) | A measured win; `drafts_written 0, handed_over 9` and nothing published | Published pages, then weeks of AI sampling | **(b) O9** + months → **ceiling 6**, see §4 |
| 4A.10 | 6 | — (ours already beats the named leaders here) | Anything actually submitted: Bing connected with "0 URLs to submit", IndexNow `key_missing` because the file 404s | Upload the key file to `/e474f67e21841570c3de6d7624391652.txt` | **(b) O6** |
| Drafts | 7 | — | — | Everything routes through the Link Builder's gates (L2) | **(a)** |

### 2.10 Backlink monitoring — 7 → ceiling 8

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| 4B.1 | 6 | **Ahrefs (35T records)** | The criterion's own anchor: **the % of Google's own sample found**. Per-source coverage with reasons is already reported (exec 529) | Upload the Search Console "Latest links" export in the app | **(b) O7** |
| 4B.5 | 7 | Ahrefs / Google spam policy | Alerts on **keyword-anchor spikes**, not counts | An anchor-distribution spike test | **(c) S** |
| 4B.6 | 7 | Ahrefs link gap / Majestic | — (39 of 42 gap domains refused `off_topic` with a reason, exec 529) | The sister-domain half of D23 is still unexercised | **(a)** + **(c) S** |
| 4B.7 | 5 | the rubric's anchor (mentions as first-class data tied to AI visibility; r 0.66–0.71 vs 0.22 for links) | Mentions matched on the **brand**, not the domain: the report is headed "Backlinks: techand.ai" with 0 occurrences of "Tech&" and `brand_names` is `["techand.ai"]` alone (exec 529, P34-6 residual) | Carry the brand names into this workflow's matcher and heading | **(c) S** + **(a)** |

### 2.11 Link building — 6.5 → ceiling 8

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| 4C.2 | 5 | Pitchbox / Respona | Refuse a competitor by **domain**: `flick.network`, found at **#1 for our own head keyword by this run's own Rank Tracker**, passed as a `ready` prospect (exec 508) | R4 is fixed (`_outreach_kit.rivalOf` refuses a declared or SERP rival) | **(a)** |
| 4C.3 | 7 | Pitchbox × Backlinko (a second contact at the site: +93% replies) | — (up to 3 contacts, all on the prospect's own domain, exec 508) | Guarantee the second contact where one exists | **(c) S** |
| 4C.4 | 7 | Muck Rack / Featured (human pitches picked 1 in 3, AI 1 in 10) | A draft **edited by a person**; all 8 are held waiting for exactly that (exec 508) | The owner edits and approves one batch | **(b) O1 / O4** |
| 4C.5 | 7 | Hunter (3 messages 6.8% vs 1 at 3.3%); Instantly (bounces < 2%) | A measured send: ≤ 49/day, bounces < 2%. Ours is proven offline only (GreenMail 31/31) | One approved live send | **(b) G16 / O4** |
| 4C.6 | 5 | Pitchbox / Respona | A connected mailbox with SPF / DKIM / DMARC — the machinery and the consent gates exist, **no mailbox is connected** | Connect the mailbox (and the OAuth client ids in `app/.env` for L4) | **(b) O4** |
| 4C.8 | 5 | the rubric's anchor (brand / title anchors aimed at hub pages) | A target that matches: `pickTarget` chose "Dynamics 365 cloud migration" (25% match) for a Peppol guide | Raise `pickTarget`'s topic-match floor | **(c) S** |
| 4C.9 | 6 | the rubric's anchor (t0 = first seen live, control group, reads at 6 / 10 / 16 weeks) | Readings at 6 / 10 / 16 weeks; the graded wording and control group already exist | A won link, then 16 weeks | **(b)** + months → **ceiling 6**, see §4 |

### 2.12 Reporting & app — 4.5 → ceiling 8 (detailed in §5.1)

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| 3.1 | 7 | AgencyAnalytics / Semrush My Reports | — (organic + AI revenue with a brand split, before rankings, exec 515) | — | **(a)** |
| 3.2 | 4 | the rubric's anchor (AI text grounded in data, **no invented numbers**) | Four delivered reports each contradict their own data (R10, R11, R12, R14) | All four fixed; needs the run to prove it | **(a)** |
| 3.3 | 4 | the rubric's anchor (impact × confidence × effort across audit, tracking, AI and links) | **One** queue; ours is one list per module plus contradictions inside single documents | A cross-module queue ranked by impact × confidence × effort | **(c) M** |
| 3.4 | 3 | **SearchPilot** (server-side split tests, neural counterfactual, credible intervals); SEOTesting = the 6 anchor | Any test beyond links: G12's `_change_test.js` is in neither build | G12 live → 6; matched page-bucket control tests on our own Search Console data → 8 | **(a)** then **(c) L** |
| 3.5 | 2 | Search Console annotations; the num=100 break | Automatic annotations; ours is prose | G12 | **(a)** |
| 3.6 | 7 | Looker Studio (free native connectors); Ahrefs Report Builder (15+ widgets, scheduled hourly–quarterly) | An **API / Looker connector**; we have dashboard, PDF, Word, HTML, Markdown, CSV (24 reports delivered) | A read API or Looker community connector | **(c) M** |
| 3.7 | 2 | **AgencyAnalytics (white-label portal on a custom domain)**; Semrush client portal | White-label and a client portal; ours is a viewer role | G15 (expiring share links, migration 0004) live → ~6; white-label branding + portal → 8 | **(a)** then **(c) M/L** |
| 3.9 | 3 | the rubric's anchor (severity, de-duplication, e-mail / Slack / webhook, quiet unless real) | Delivery: all 3 `seo_ops_alerts` rows read `delivered: "pending"`, SMTP could not resolve, no webhook URL is set | R5 / R6 are fixed (the alert keeps its node and message; `delivered` and `channels` are written back). Needs `SEO_ALERT_WEBHOOK_URL` | **(a)** + **(b)** |
| 3.11 | 6 | the rubric's anchor (source, date range, sample on every number) | Full lineage; G29 (`_lineage.js`) is in neither build | — | **(a)** |
| 3.12 | 5 | AgencyAnalytics (80+ integrations); the criterion's own list is GSC, GA4, GBP, Bing, **CMS**, **ads** | CMS and ads; we have GSC, GA4, Bing, GBP, Gotenberg, CrUX off, WordPress off | G13 (CMS) + a Google Ads connector | **(b) G13** + **(c) M** |
| UI | — | — | **(NL)** no app page was exercised in either window (no owner session) | The §5.2 Playwright sweep in an owner session | **(b)** + **(a)** |

### 2.13 Cost control & reliability — 4.5 → ceiling 8 (detailed in §5.2)

| Crit | Now | Leader | What the leader does that we do not | What it takes | Class |
|---|---|---|---|---|---|
| Guards | 6 | Semrush / Ahrefs (server-side limits per account) | Cover **every** workflow: the ledger saw the main workflow and the Keyword Check only, counted AI estimates only, and both audits carried `est_usd: 0` while spending $0.09 each (R9) | R9 is fixed (reserve and settle in the monitors, DataForSEO estimate + measured on settle) | **(a)** |
| 3.10 | 4 | the rubric's anchor (estimate, budgets, **actual vs estimate reconciled**, reuse) | Reconciliation that holds: `ai_visibility` reserved $0.06 and cost $0.79 (13×), backlinks $0.04 → $0.37, the page $1.23 → $0.46; the ledger settles at the **estimate** ($2.26) against $2.88 spent | G23 is fixed (`_cost_cal.js` prices streaming calls from characters + thinking budget, labelled estimated). Needs one Anthropic Console cost export to close the loop | **(a)** + **(b)** |
| 2.14 | 4 | the rubric's anchor | A per-run cost from every workflow: three report none at all, and the full report's own figure is $0.058 above the measured balance delta | as Guards, plus 2.6's $/keyword/month | **(a)** + **(c) S** |
| 3.8 | 5 | the rubric's anchor (delivery rate ≥ 99% **measured**) | A measured delivery rate on a host that does not stop: G21 is built (`delivery.ts`, 17 tests) but 90 days of history on a sleeping Mac cannot produce 99% | An always-on host (D25a), then a month of schedules | **(b)** money + a month |
| Ops | 3 | Conductor / ContentKing alerting | An alert that arrives: **no ops alert has ever been recorded as delivered** (R6); the one real alert lost its node, message and execution id (R5); `ENOTFOUND smtp.gmail.com`; still Mac-hosted and the container restarted again (D25a) | R5 / R6 fixed; `SEO_ALERT_WEBHOOK_URL` set; an always-on host | **(a)** + **(b)** ×2 |

---

## 3. The ranked plan

Ordered by score gained per unit of effort. Hours are engineering estimates calibrated against the first cycle (95 items ≈ three
multi-agent working days); money is measured spend where a precedent exists (`RESULTS.md` §0: 21 runs = $3.79) and an estimate
otherwise. **Every tranche's gain is only realised once a live run proves it** — the scorer's rules forbid crediting a fix the run
did not exercise (`FIX_PLAN.md` §5.2) — so re-rating cost is carried explicitly.

| # | Tranche | Lifts | Expected gain (area points) | Money | Hours | Depends on |
|---|---|---|---|---|---|---|
| **T0** | **The owner's free list** — enable the Chrome UX Report API; fill the business profile + facts + style guide (O1/O2); set `SEO_ALERT_WEBHOOK_URL`; upload the IndexNow key file (O6); upload the Search Console links export (O7); answer the October check-in (O5); publish or discard the 6 written pages (O9); run `fix_phantom_pages.py` and `fix_brand_rungs.py --brand facts.ae` | CON, AIV, AIG, BL, TECH, OPS, CAD, LAD | +0.5 each on CON / AIV / BL; unblocks C4, C10, C12, 4A.5, 4A.10, 4B.1, 1.5, 3.9, Ops. Nothing scores until T1 | **$0** | owner ≈ 2–3 h; us ≈ 1 h to verify | nothing — **this is the critical path** |
| **T1** | **The second live run** (`FIX_PLAN.md` §5.2: the 21 runs plus `published`, the check-in, a profile-backed content run, a second full report, the error path, and the owner-session Playwright sweep), then `RESULTS.md`, then an independent scorer | all 13 | **+13.0 total → mean 5.92 → 6.92, overall 6 → 7.** Biggest: OPS +2.5, TECH +2.0, REP +2.0, LAD +1.5, CAD +1.5, KW +1.0. Zero: RANK, AIG | **$4–6** (last run $3.79 against a $4.3 budget, $15 hard cap) | ≈ 1 d to run, ≈ 1 d to write up, ≈ 0.5 d to score | T0 first, or T0's items score nothing; `apply_env.py` before the run |
| **T2** | **Reporting depth** (§5.1): the cross-module queue (3.3), a read API / Looker connector (3.6), white-label + client portal (3.7), the Google Ads connector (3.12) | REP | REP +1.0 → **7.5** on its own; → **8** only once G13 lands (3.12 is load-bearing: 3.12 = 6 holds the area at 7.5, see §5.1) and the webhook is set. §1.3 shows this 8 is a precondition | $0 | 4–6 d | T1 proving 3.2 / 3.5 / 3.11; **G13 + `SEO_ALERT_WEBHOOK_URL` for the last half-point** |
| **T3** | **Operations to parity** (§5.2): the always-on host (D25a), a month of schedules for G21, the Anthropic Console cost export, $/keyword/month | OPS | OPS +1.0 → 8 (Ops cannot pass 5 without the webhook, so T0 is part of this) | ≈ **$30/month** host | 1–2 d build + **1 month elapsed** | owner's hosting decision + `SEO_ALERT_WEBHOOK_URL` |
| **T4** | **Rank + site tracking depth**: daily + on-demand ranks (2.1), mobile everywhere (2.3), city level (2.4), the remaining SERP feature types (2.5, $0 extra), trended share of voice (2.6), tracked competitors (2.13), the small site-tracking items (2.8–2.10) | RANK, SITE | RANK +2.0 → 8; SITE +0.5 → 8 | ≈ **$2–5 / site / month** DataForSEO | 3–4 d | — |
| **T5** | **Content + keyword depth**: coverage as a gate (C1), claim re-check at refresh (C3), the external similarity index (C5), itemised AI-pattern checks (C6), one word counter + SERP min–max (C8), wider schema (C11), data visuals (C13), per-feature CTR discounts (K3), page type decides (K4), more live SERPs (K7), topic-level authority (K1) | CON, KW, LAD, CAD | CON +1.5 → 8; KW +0.5 → 7.5 (ceiling); LAD +0.5 → 7.5 (ceiling); CAD +0.5 | ≈ **$20–40/month** similarity API + SERP spend | 5–7 d | T0's O1/O2 for C2/C4 |
| **T6** | **Owner-money items**: the 100-prompt AI panel (G20/O8), the CMS push (G13), the mailbox + first approved send (O4/G16), the owner wiring G27 into CI | AIV, CAD, LB, TECH | AIV +0.5 → 8; CAD +0.5 → 8; LB +1.0 → 8; TECH +0.5 → 8 | ≈ **$25–50 / site / month** panel; rest $0 | 2–3 d | six owner decisions |
| **T7** | **Technical audit depth**: one-click fix deployment (1.9, needs the owner's CDN), the Pages report trended + removals (1.3), a broken site in the accuracy set (1.14), the crawl ceiling (1.1), render diff beyond 5 pages (1.4) | TECH | TECH holds 8; buys back slack for §1.3's "no more than two misses" | $0 | 4–5 d | owner's CDN/DNS for 1.9 |
| **T8** | **Re-ratings** after T2+T3, after T4+T5, after T6+T7 | all | the gains above only exist once scored | **$12–18** (3 × $4–6) | 3 × 2.5 d | each tranche |

**Totals: roughly 20–28 engineering days, $16–24 of run money, about $60–90 / month recurring, and six owner decisions — three of
which spend money.**

### What the live run alone is worth

T1 on its own, assuming every deployed-but-unproven fix passes and the owner has done nothing:

| Area | Now | After T1 | Δ | What the run converts |
|---|---|---|---|---|
| Cost control & reliability | 4.5 | **7.0** | **+2.5** | R9 (ledger in every workflow), G23 (`_cost_cal.js`), R5/R6 (alert keeps its content, `delivered` written back), G21 |
| Technical audit | 5 | **7.0** | **+2.0** | R10 (no High from "no data"; impact basis capped), R2, G11 (daily watch + fix re-check), G14 (render diff), G27 |
| Reporting & app | 4.5 | **6.5** | **+2.0** | R10/R11/R12/R14 out of delivered reports, G12 (annotations, change tests), G29 (lineage), G15 (share links) |
| Keyword ladders | 5.5 | **7.0** | **+1.5** | R15 (ladder URL and planned links), R16 + G32 (`fitStored`, `_replan.js`), R1 |
| Content cadence | 5.5 | **7.0** | **+1.5** | R1's refusal path, G31 (style guide) |
| Keyword research | 6 | **7.0** | **+1.0** | R13 (`fitTopic` on every bucket), R12, R7, K2's label |
| Content creation & QA | 6 | **6.5** | **+0.5** | R11 (a failed gate is labelled and `publishable: false`), C8's clamp, C1, C7 |
| Site tracking | 7 | **7.5** | **+0.5** | G12, 2.9's count |
| AI visibility | 7 | **7.5** | **+0.5** | R14 (no false owner row) |
| Backlinks | 7 | **7.5** | **+0.5** | P34-6 residual, 4B.6 |
| Link building | 6.5 | **7.0** | **+0.5** | R4 (`rivalOf`) |
| Rank tracking | 6 | 6.0 | **0** | R9 lifts 2.14 but 2.1 / 2.4 need T4 |
| AI growth | 6.5 | 6.5 | **0** | everything left is O6 / O9 / months |
| **Overall** | **6** | **7** | **+13.0 total, mean +1.0** | |

So **the live run is worth one whole point of the two needed**, for $4–6 and about 2.5 days — by far the best ratio in the plan,
and it is the only tranche that is pure proof rather than new work. Two cautions, both from precedent: the last re-rating found
**16 new defects** in 21 runs (`FIX_PLAN.md` §3.11), so expect a haircut of a few half-points from R17-and-onwards — overall 7 is
the realistic result and 6.5 the floor; and the build merged since the last deploy must be applied first (`RESUME.md`: run
`apply_env.py`), or the run measures a workflow that is not the one being scored.

---

## 4. What cannot reach 8 this year, and why

### 4.1 Blocked by months of the system's own data (G17)

G17 is "calibration from 20+ live pages", effort **L**, status **open**, and its precondition is not engineering: **nothing the
system has written is published** (`SCORECARD.md` §4 — six written pages waiting, the ladder's other four target URLs answer
308 → 404, the cadence paused itself). Even once pages go live, the rubric's own data says the clock is long: only **1.74%** of new
pages reach the top 10 within a year, and 40.8% of those that do take a month (Ahrefs, 1.3M keywords).

| Criterion | Anchor that needs own outcomes | Ceiling 2026 | Areas it caps |
|---|---|---|---|
| **K10** calibrated timelines | "probabilities per plan type, **re-fit from the product's own tracked outcomes**" | **6** | Keywords **and** Ladders (weighted 1.5× in both) |
| **K1** personalised difficulty | "topic-level authority, with **predicted vs actual top-10 rates back-tested**" | **7** (topic authority is buildable; the back-test is not) | Keywords (weighted 1.5×) |
| **C9** validated QA | "critic + gate + editor, **with the score shown to correlate with outcomes**" | **6** | Content |
| **4A.9** AI action loop | "actions → pages → outreach → **'won' measured**" | **6** | AI growth |
| **4C.9** link impact | "control group; **reads at 6 / 10 / 16 weeks**" | **6** | Link building |

**Effect:** Keywords **7.5**, Ladders **7.5**, AI growth **7.5** — three of the thirteen, costing 1.5 of the 1.75 points of slack.
Content and Link building survive at 8 because C9 at 6 and 4C.9 at 6 are each one criterion among 13 and 9 respectively.

**Does a 7.5 in these three still allow an overall 8?** Yes, and that is checked in §1.3: with the other ten at 8 the mean is
7.885, clearing the defensible 7.75 bar. But it consumes almost all the slack, so no fourth area may drop below 7.5 and none may
sit at 7.

### 4.2 Blocked by a paid source we do not buy

| Criterion | The paid thing | Cost | Ceiling without it | Worth buying? |
|---|---|---|---|---|
| **C5** originality | An external plagiarism index (Semrush uses Copyleaks). Ours compares only the pages the run already read — 2,762 shingles, 0.1% overlap, $0 (exec 521) | ≈ $20–40 / month | **7** | Yes — it is the cheapest single point in the plan and C5 is named in the rubric as one of the two clearest gaps against Surfer / Semrush-class tools |
| **4A.1** panel | A 100-prompt panel across 6 engines. The measured curve is $4.32/site/month at 8 questions, $9.40 at 20 | ≈ $25–50 / site / month | **6** | Owner's call. Without it AI visibility caps at 7.5, which costs 0.5 of the slack |
| **2.1 / 2.3 / 2.4 / 2.13** rank depth | Daily readings, both devices on every keyword, city level, 10–20 competitors | ≈ $2–5 / site / month (15 keywords daily ≈ $0.9) | 2.1 = **5**, 2.4 = **4** | Yes — it is cheap, and rank tracking is one of the ten areas that must reach 8 |

### 4.3 Blocked by something only the owner can do

Each of these has been open since 2026-10-11 and each blocks a criterion outright, not partially:

| Owner item | Criterion held down | Ceiling without it |
|---|---|---|
| **O1 / O2** profile, facts, style guide | C4 (author box: the page shipped `author: null`), C2, 4A.5 (`fact_check "no_facts"`), C17, and 8 held outreach drafts | C4 **4**, C2 **5**, 4A.5 **5** → Content **7**, AI visibility **7.5** |
| **O4 + G16** mailbox and one approved send | 4C.5, 4C.6 — nothing has ever been sent | 4C.6 **5** → Link building **7.5** |
| **G13** name a CMS | C16, and 3.12's CMS half | C16 **5** → Cadence **7.5**, Reporting **7.5** |
| **Chrome UX Report API** | 1.5 (`crux.available false, reason "api_off"`) | 1.5 **4** → Technical **7.5** |
| **O6** IndexNow key file | 4A.10 (`key_missing`, the file 404s) | 4A.10 **6** |
| **O7** Search Console links export | 4B.1 — the criterion's own anchor is the % of Google's sample found | 4B.1 **6** → Backlinks **7.5** |
| **O9** publish or discard the written pages | C10, C12, C16, K11's live link check, 4A.9, and G17's whole clock | several |
| **`SEO_ALERT_WEBHOOK_URL`** | 3.9, Ops — no alert has ever been delivered | Ops **5** → Cost & reliability **7** |

**This is the headline, in arithmetic:** with every buildable tranche T2–T7 complete and none of these done, the mean is **7.46**
and the overall is **7** — 0.04 below even the rounding boundary.

### 4.4 Blocked by hosting

**D25a** (always-on host) is the only register item classed **L / ops** and still open. It blocks **3.8** (a delivery rate of ≥ 99%
cannot be measured where the host restarts — the container restarted again before the last write-up) and caps **Ops**. It also
quietly threatens everything else: the AI Pulse missed 2026-10-10 and 2026-10-11 on the current host. Cost is small (≈ $30/month)
and the work is S/M, but it is an owner decision, and **3.8 additionally needs a month of elapsed schedules after the move**.
Without it, Cost control & reliability caps at **7** — and §1.3 shows no area may sit at 7.

### 4.5 Deliberately not pursued

- **3.12 integrations** at 10 means AgencyAnalytics' 80+. The criterion's own named list is six (GSC, GA4, GBP, Bing, CMS, ads), so
  **8 is reachable** with G13 plus a Google Ads connector; building toward 80 is not rewarded proportionally and is not in the plan.
- **2.4 geo-grids** (Whitespark / Local Falcon, 225 points) are the 10-anchor for local businesses. City-level reaches 8; grids are
  not worth the spend for this customer base.
- **1.9 one-click fix deployment** (Ahrefs Patches / Botify PageWorkers) needs a snippet or Cloudflare Worker on the customer's
  site. Classed **L + owner access** and placed last (T7): technical audit reaches 8 without it, via 1.8's CI gate.
- **3.4 at 10** (SearchPilot's server-side split tests with a neural counterfactual) needs the customer's serving
  infrastructure. 8 — matched page-bucket control tests on our own Search Console data — is reachable and is in T2/T7.

---

## 5. The two weakest areas in detail

These are the two areas that did not move at all in the first cycle (REP 4.5 → 4.5, OPS 4.0 → 4.5, `FIX_PLAN.md` §6) and, per
§1.3, the two where an overall 8 is won or lost: reporting must reach 8 as a precondition, and cost & reliability may not sit at 7.
Only work the rubric rewards is listed.

### 5.1 Reporting & app: 4.5 → 8 (mean 4.30; ten criteria, six of them at 4 or below)

**What the named leaders do, feature by feature** (CRITERIA_technical… §3(a)):

- **AgencyAnalytics** — 80+ integrations; **white-label portal on a custom domain**; scheduled PDFs; AI Summary.
- **Semrush My Reports** — drag-and-drop PDF combining Semrush + GA + GSC + GBP; daily / weekly / monthly schedule; white-label;
  **client portal**.
- **Ahrefs Report Builder** — 15+ widgets including AI share of voice; PDF scheduled hourly to quarterly; 50 recipients.
- **Looker Studio** — free, native Search Console / GA4 connectors, templates, blending, **third-party connectors**.
- **SEOTesting** — time-based tests on Search Console data, **backdatable**; split tests **with a control group**; content decay.
- **SearchPilot** — server-side split tests on matched page buckets; neural-network counterfactual; credible intervals; a
  "ready to test" check.

**What we have, and what is actually wrong.** Formats are already strong (3.6 = 7: 24 reports in the app with Word / PDF / HTML /
Markdown / meta.json, three WebP images, a 7-file fix pack and CSV), and outcomes-first is near parity (3.1 = 7: organic and AI
revenue with a brand / non-brand split, shown before rankings, exec 515). The area scores 4.5 for one reason the scorecard states
twice: **four delivered reports assert what their own data denies** — R10's "about 720 clicks and 22,860 impressions" against a
measured 38 / 5,295; R14's 19,579 citing answers beside "0 AI answers cite you"; R12's "no page of yours answers this search" next
to the page ranking #6.2; R11's "Quality check: 6 item(s) to review" when round 2 counted 12 and failed. That is 3.2 = 4 and
3.3 = 4. Everything else is a missing feature: no annotations (3.5 = 2), no sharing (3.7 = 2), no alert delivery (3.9 = 3), impact
measured for links only (3.4 = 3).

**What a focused tranche must build:**

| Criterion | Now → 8 | The work | Size |
|---|---|---|---|
| 3.2 narrative | 4 → 8 | Nothing to build. R10, R11, R12, R14 are all fixed (harness S59); the live run must show four clean documents | **(a)** |
| 3.3 one queue | 4 → 8 | A **single** queue across audit, tracking, AI and links, ranked by **impact × confidence × effort** — the rubric is explicit that one list per module is a 5. The inputs exist (`_impact.js` caps the basis, G26 orders the audit, G29 names the source) and are not merged | **(c) M** |
| 3.4 impact measurement | 3 → 6 → 8 | G12's `_change_test.js` deployed and proven gets to the SEOTesting anchor (6). For 8: matched page-bucket tests — pick a control set of our own pages by pre-period impressions, date every change, read at fixed horizons, report credible intervals, keep the graded wording ("likely helped", never "caused") | **(a)** then **(c) L** |
| 3.5 annotations | 2 → 8 | G12's dated registry (`v5/data/seo_events.json`: 7 Google updates + the Sep-2025 num=100 break) plotted automatically, with publishes, fixes and data breaks. Built; in neither build that ran | **(a)** |
| 3.6 formats | 7 → 8 | The one format the leaders have and we do not: a **read API or Looker community connector** over the existing report tables | **(c) M** |
| 3.7 client sharing | 2 → 6 → 8 | G15's expiring, revocable share link (migration 0004, 14 days default, rate-limited) proven live gets to ~6. For 8: **white-label** (customer logo and colours on the report and the shared page) and a **client portal** view that lists a company's reports without an app account | **(a)** then **(c) M/L** |
| 3.9 alert routing | 3 → 8 | R5 / R6 are fixed (the alert keeps its node, message and execution id; `delivered` and `channels` are written back). It cannot score until `SEO_ALERT_WEBHOOK_URL` is set — SMTP fails with `ENOTFOUND smtp.gmail.com`, so the webhook is the only live channel | **(a)** + **(b)** |
| 3.11 lineage | 6 → 8 | G29's `_lineage.js` + `app/shared/src/lineage.ts` deployed — source, period, sample and basis beside every figure group plus a "Where these numbers come from" table. Built; in neither build | **(a)** |
| 3.12 integrations | 5 → 8 | The criterion's own list is GSC, GA4, GBP, Bing, **CMS**, **ads**. We have four plus Gotenberg; CrUX is off and WordPress is off. Needs G13's CMS push and a **Google Ads** connector | **(b) G13** + **(c) M** |
| UI | (NL) | The app has **never been exercised live** in either window — no owner session, no page loaded. §5.2's protocol already asks for a Playwright sweep at desktop and 390 px in an owner session; without it the app side of this area stays unscored | **(b)** + **(a)** |

**Projection:** T1 alone takes REP to **6.5** (3.2 → 8, 3.5 → 8, 3.11 → 8, 3.7 → 6, 3.4 → 6, 3.1 → 8). T2's four builds plus the
webhook take it to **8.0** — but only with 3.12 at 8: the same ten criteria with **3.12 = 6** mean 7.60 → **7.5**, while 3.12 = 8
means 7.80 → **8.0**. So **this area's 8 — and therefore, by §1.3, the overall 8 — hangs on the owner naming a CMS (G13)** plus a
Google Ads connector. **No criterion here is blocked by months of data or by a paid data source.** It is the largest reachable gain
in the plan, +3.5 area points.

### 5.2 Cost control & reliability: 4.5 → 8 (mean 4.40; five criteria, three at 4 or below)

**What the named leader does.** The rubric names **Semrush / Ahrefs (server-side limits)**: a limit enforced by the service for the
account, which the customer cannot exceed and does not have to reason about. The supporting criteria are the general ones —
3.10 (estimate before the run, budgets, **actual vs estimate reconciled**, reuse of stored data), 2.14 (cost shown and capped),
3.8 (every automation visible, failures flagged in minutes, retries, **delivery rate ≥ 99% measured**) — plus the ops expectation
of Conductor / ContentKing-class alerting.

**What we have.** Genuinely ahead of the leaders in two places: a **reservation before every run** and **balances measured before
and after each run**. D1 is fixed and provable — per-run `seo_run_ledger` reservations counted across concurrent runs refused two
customer-facing runs at "$5.74 of $6", which only adds up if the mid-flight $0.58 reservation counts (execs 499, 500); all 47 rows
settle; 11 stale reservations were released. Caching works: `whois_requests 0`, three domain ages from `seo_cache`, **$0** against
the baseline's $0.36 (exec 523, D7).

**What is wrong, specifically:**

1. **The guard watched 2 of 10 workflows and counted the wrong currency.** It covered the main workflow and the Keyword Check only,
   counted AI estimates only, and both audits carried `est_usd: 0` while spending $0.09 each (R9). The monitors spent DataForSEO
   money unguarded.
2. **The estimates miss the money by up to 13×, and the ledger settles at the estimate.** `ai_visibility` reserved $0.06 and cost
   $0.79; backlinks $0.04 → $0.37; the page $1.23 → $0.46. The ledger closed the window at **$2.26** against **$2.88** actually
   spent. Three Opus streaming nodes report only `tokenUsageEstimate`, so $0.438 of the Claude figure is an estimate (G23).
3. **No ops alert has ever been delivered.** All three `seo_ops_alerts` rows read `delivered: "pending"`; the one real alert lost its
   node, message and execution id (R5); the e-mail failed with `ENOTFOUND smtp.gmail.com`; `SEO_ALERT_WEBHOOK_URL` is unset (R6).
4. **The host stops.** Still Mac-hosted; the container restarted again before the last write-up; the AI Pulse missed 2026-10-10 and
   2026-10-11 (D25a). A ≥ 99% delivery rate is not measurable on it.

**What a focused tranche must build:**

| Criterion | Now → 8 | The work | Size |
|---|---|---|---|
| Guards | 6 → 8 | Nothing to build. R9 is fixed — a ledger row reserved and settled in the monitors too, with a DataForSEO estimate beside the AI estimate and the measured amount on settle. Needs the live run across all ten workflows | **(a)** |
| 3.10 reconciliation | 4 → 8 | G23's `_cost_cal.js` prices every Claude call from prompt / answer characters and the thinking budget, so streaming nodes are counted and labelled estimated, and a settled row keeps the measured figure. To close it: **one Anthropic Console cost export** reconciled monthly, and the per-mode estimates brought inside a stated band (the 13× miss is what caps this, not the measurement) | **(a)** + **(b)** + **(c) S** for the band |
| 2.14 cost | 4 → 8 | Every workflow reports its own cost (R9), plus the rubric's own anchor: **cost per keyword per month, shown and capped** — which needs T4's rank work to have a per-keyword denominator | **(a)** + **(c) S** |
| 3.8 reliability | 5 → 8 | G21 is built (`delivery.ts`, 17 unit tests): delivered / settled per week for app runs and the nine schedules, missed schedules against the schedule clock with a 90-minute grace, the alert rate per channel, a 99% target, and what cannot be measured said in words. It needs an **always-on host** and then **a month of schedules** to produce a number worth printing | **(b)** money + a month |
| Ops | 3 → 8 | R5 / R6 are fixed. Needs `SEO_ALERT_WEBHOOK_URL` set (free, and the only working channel while SMTP is broken) and the host moved (D25a) so an alert exists to deliver | **(a)** + **(b)** ×2 |

**Projection:** T1 alone takes OPS to **7.0** (Guards → 8, 3.10 → 7, 2.14 → 7, 3.8 → 7, Ops → 5 — Ops stays low because no webhook
URL is set). T3 takes it to **8.0** once the host moves, a month of schedules has run and the Anthropic export is reconciled.
**Nothing here is blocked by a paid data source or by months of ranking data** — it needs ≈ $30/month of hosting, one environment
variable, one file download and one month of elapsed time. It is the cheapest 3.5 points in the plan, and the only one with
calendar time baked in, which is why T3 should start the day the host is approved rather than waiting for T2.

---

## 6. Summary

| | Mean | Overall | What it needs |
|---|---|---|---|
| Today | 5.92 | 6 | — |
| + T1 live run | 6.92 | **7** | $4–6, 2.5 days, T0 first |
| + T2–T5, T7 (all buildable work) | 7.46 | **7** | 20–28 days, ≈ $60/month recurring |
| + T0 and T6 (every owner item and spend) | 7.885 | **8** | six owner decisions, three of them money |
| Ceiling with G17 (months of own outcomes) | 8.00 | 8 | not reachable in 2026 — all thirteen areas at leader parity |

Three areas are capped at 7.5 for 2026 by G17 and the outcome criteria (keywords, ladders, AI growth). The other ten must all
reach leader parity, which leaves at most two further half-point misses. Reporting & app at 8 is a precondition. **The engineering
ceiling is 7.46; the owner's list is what buys the 8.**
