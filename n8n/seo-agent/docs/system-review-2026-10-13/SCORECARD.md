# Scorecard — whole system against the best proven results (2026-10-13)

Independent re-rating after Phases 1–4, session 6A, G5–G8, G18, G25, G30, G33 and the P34 fixes. Scored **only** from the live
evidence in `RESULTS.md` (48 planned executions on techand.ai: 481–515 on 2026-10-12, 517–529 on 2026-10-13, plus the unplanned
Error Handler run 516; $3.79 measured), against the **unchanged** criteria in
`../system-review-2026-10-11/CRITERIA_keywords_content.md` and
`../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md`, in the structure of the 2026-10-11 scorecard.

**Scales (unchanged).** K / C criteria use the 0 / 5 / 10 anchors of `CRITERIA_keywords_content.md` §(c). The 1.x–4C.x criteria use
0 = absent · 2 = manual · 4 = automated but basic · 6 = mid-market parity · 8 = parity with the named leader · 10 = beyond the
leaders and proven live.

**Rules followed** (`../system-review-2026-10-11/FIX_PLAN.md` §5.2): every score cites a run, execution id, file or code location;
a criterion not exercised live is marked **(NL)** and scored only on what code and specs show, never above what the last live
evidence supported; a defect seen live caps its criterion at the level the defect shows; a fix the run did not exercise is not
credited; **capability and correctness are rated, outcomes are reported separately** (§5). No criterion was rewritten.

**How the area numbers are built (so any of them can be re-checked).** Each area is the mean of its criteria — the same criterion
set the 2026-10-11 scorecard used for that area — with the strong-evidence criteria named in §5.2 (K1–K3, K8, K10, C2, C3, C14,
C15, 4B.4) weighted 1.5× and everything else 1×, rounded to the half point. The weighted mean is printed in each area heading.

**Both passes count.** The 2026-10-12 window ran 16 of the 21 protocol runs — the engine's own daily budget guard refused
`discover` and the ladder's page run (execs 499, 500). The completion pass of 2026-10-13 (execs 517–529) ran all five missing runs
with nothing changed, so discovery, content, the full report, AI visibility and backlinks each have live evidence of their own
(`RESULTS.md` §2.11–§2.15, §3.1, §3.2 R10–R16). Where §3.1 still reads "not exercised" (D25a, P2-6, the sister-domain half of D23,
the RDAP path inside D7) no credit is taken.

**Which build.** §2.1–§2.10 and R1–R9 come from the 437-node main workflow; §2.11–§2.15 and R10–R16 from the 448-node build that
added G8's discovery nodes, `Originality Check` (G5) and the image nodes (G30). Code merged after the runs (G12 annotations and
change tests, G29 lineage) is in **neither** build and is scored **(NL)**.

**Version scored.** The 1,011-line `RESULTS.md` of 2026-10-13 (full write-up of both passes). My worktree held the earlier
629-line committed version, which stops at §2.10 / R9; §0 of this scorecard was first written from that copy and has been revised
against the complete one — see §0 below for every criterion that moved and why.

**D#** = defect of 2026-10-11 · **P1/P2/P34/G18-#** = defects of the 2026-10-12 live checks · **R#** = new defect of these runs
(`RESULTS.md` §3.2) · **G#/L#/O#** = `FIX_PLAN.md` register items.

---

## 0. Revision after reading the completion-pass detail

The first pass of this scorecard was written from a copy of `RESULTS.md` that contained the completion runs only as a summary. The
full §2.11–§2.15 and R10–R16 moved twelve criteria, in both directions, and six of the thirteen areas:

| Criterion | First pass | Now | Why (new evidence) |
|---|---|---|---|
| K5 business-fit gate | 7 | **5** | R13 (§2.13): §4a's Informational list offers "character ai" 110,000/mo, "google ai" 40,500, "meta ai"; Commercial offers "mh enterprises uae"; the gap keeps "mofa attestation dubai" — the gate is applied to the navigational class only. |
| K8 cannibalisation guard | 7 | **6** | R12 (§2.11): 11 of 25 Search Console rows say "no page of yours answers this search" while naming the live page that earns the impressions (positions 6.2, 9.6). |
| K7 SERP-overlap clustering | 8 | **7** | §2.11: 5 of 43 clusters come from SERP overlap (only the 15 live-checked keywords); the rest stay label-based. |
| K11 cluster architecture | 6 | **5** | R15 (§2.12): the written page's `suggested_url` adds `-uae`, so the ladder row's `target_url`, the link map and the sibling up-links all point at a URL that will never exist; `links_to_add_when_published` is `[]`. |
| K13 outcome loop | 5 | **4** | R16: a pre-fix rung "facts erp" (a competitor's brand) is still `planned` and still printed in the Rank Tracker's delivered report (exec 505). |
| C3 fact verification | 7 (prior-run) | **7 (now live)** | §2.12: `sources_cited` graded 3 primary / 3 vendor / 1 weak, `unverified_statistics []` in the final round, no `utm_*` / `srsltid`. |
| C8 length follows coverage | 5 | **4** | §2.12: target 2,200, delivered 2,891 (+31%); the clamp bound to the verdict's ~2,000, not the ladder's 1,900, and the two word counters disagree (2,891 vs 2,727). |
| 1.6 impact priority | 7 | **5** | R10: the false "not mobile-friendly" High is ranked **second of 60** on an impact basis of "720 clicks and 22,860 impressions" while the whole site measured 38 clicks / 5,295 impressions — the basis is uncapped. |
| 1.13 structured data | 5 | **6** | §2.13: R2 does **not** reproduce on the full-report path (Schema is weighted there, the finding stays under `open`); schema errors on 26 pages found, generated blocks clean. |
| 1.14 measured accuracy | 5 | **4** | R10 again: a High on 100% of pages with **empty evidence** and a fabricated impact basis, in a delivered report, against a labelled set that reports 100% precision. |
| 4A.1 panel + market index | 5 | **4** | R14: the market table's first row credits the owner with 19,579 citing answers and 16.4M AI search volume from a 4-character name match, printed under "Market-wide share 0% — 0 AI answers cite you". |
| 4A.4 metrics | 7 | **8** | §2.14: 8 competitor brands all real domains, **30 of 30** cited URLs distinct with no `www.`, fragment or tracking parameter, AI Overview presence 85.7%, brand recognised 4/4. |
| 4B.7 mentions | 6 (NL) | **5** | §2.15: the backlink report is headed "Backlinks: techand.ai" with **0** occurrences of "Tech&" and `brand_names` is `["techand.ai"]` alone, so mention matching rests on the domain (P34-6 half fixed). |
| 3.2 narrative / no invented numbers | 6 | **4** | Four delivered reports each contain a statement their own data contradicts: R10's impact basis, R14's 19,579, R12's table, and R11's "Quality check: 6 item(s)" when round 2 counted 12 and failed. |
| 3.3 one queue | 5 | **4** | Same four, plus R15: the contradictions are now inside single documents, not only between modules. |
| 3.10 cost reconciliation / 2.14 cost | 5 / 5 | **4 / 4** | §0b and §3.2's closing note: `ai_visibility` reserved $0.06 and cost **$0.79**, backlinks $0.04 → $0.37, the page $1.23 → $0.46; the ledger settles at the estimate ($2.26) against $2.88 spent; the full report's own figure is $0.058 above the balance delta. |

Everything else is unchanged from the first pass. **Area effects:** keywords 6.5 → 6, ladders 6 → 5.5, **content 5.5 → 6** (the only
area that rose: C3 is now live and C1 / C5 / C13 are confirmed with hard numbers), cadence 6 → 5.5, technical audit 5.5 → 5,
backlinks 7.5 → 7, reporting 5 → 4.5, cost & reliability 5 → 4.5. Overall stays **6** (area mean 6.15 → **5.92**).

---

## 1. Summary

| # | Area | 2026-10-11 | **Now** | Compared with | What caps it now |
|---|---|---|---|---|---|
| 1 | Keyword research & verdicts | 5 | **6** | Semrush (Personal KD) / Ahrefs | the fit gate covers intent only, so other brands and consumer AI searches are recommended (R13); discovery contradicts itself on existing pages (R12); `fit: null` shipped (R3) |
| 2 | Keyword ladders / planning | 4.5 | **5.5** | MarketMuse / Semrush Strategy Builder | the written page's URL diverges from the ladder's and the planned links are dropped (R15); a competitor-brand rung is still queued (R16); rung rows have no word target (R8) |
| 3 | Content creation & QA | 5 | **6** | Surfer / Clearscope | 12 placeholders shipped after the gate failed **twice**, reported to the owner as "6 item(s) to review" (R11); +31% over target (C8); no author box at all (O1) |
| 4 | Content cadence / pipeline | 4.5 | **5.5** | Clearscope (inventory, decay) | the refusal path still leaves phantom rows (R1); a stored brand rung would be written (R16); no CMS push (G13), no style guide (G31) |
| 5 | Technical audit | 4 | **5** | Sitebulb / Ahrefs Site Audit | a **High on 100% of pages with empty evidence and a 19×-inflated impact basis** (R10); no render diff (G14), no pre-release check (G27), CrUX still off (G7) |
| 6 | Rank tracking | 3 | **6** | AccuRanker / Semrush Position Tracking | weekly, country-level; it reports a competitor-brand page as a ladder page (R16) and checks a URL the page will not use (R15); no cost of its own (R9) |
| 7 | Site tracking (GSC / GA4 / Trends) | 5 | **7** | SEOTesting + Looker Studio | annotations and change tests built after the runs (G12, NL); index-status sample per weekly run unknown |
| 8 | AI visibility (incl. pulse) | 6.5 | **7** | Profound / Semrush AI Toolkit | the market index credits the owner with 19,579 answers from a name match (R14); 7 of 8 questions asked (O8); the fact check cannot run (O1) |
| 9 | AI growth | 5 | **6.5** | Profound Actions / AthenaHQ | IndexNow key file missing (O6); nothing submitted to Bing; no win measured |
| 10 | Backlink monitoring | 5 | **7** | Ahrefs (+ Linkody re-checks) | no % of Google's own sample until the export is uploaded (O7); brand mentions still matched by domain only (P34-6 residual) |
| 11 | Link building | 6 | **6.5** | Pitchbox / Respona | a competitor ranked #1 for our head keyword passed the gate (R4); two stale "listed" rows reported as fact (P34-2); nothing has ever been sent (G16, O4) |
| 12 | Reporting & app | 4.5 | **4.5** | AgencyAnalytics / Semrush My Reports | four delivered reports state numbers their own data contradicts (R10, R11, R12, R14); no annotations (G12) or sharing (G15); UI not exercised (NL) |
| 13 | Cost control & reliability | 4 | **4.5** | Semrush / Ahrefs (server-side limits) | estimates miss the spend by up to 13× and the ledger settles at the estimate (R9, G23); **no ops alert has ever been delivered** (R5, R6); Mac-hosted (D25a) |
| | **Overall** | **5** | **6** | | area mean **5.92** (was 4.8) |

---

## 2. Per area

### 2.1 Keyword research & verdicts: 6 (was 5) — weighted mean 6.24

| Crit. | Score | Evidence |
|---|---|---|
| K1 | 5 | Still a domain-level KD percentile from a cached 2026-10-08 measurement (exec 495); no back-test of predicted vs actual top-10 rates (G17 open). |
| K2 | 7 | Exec 518: **36 keywords calibrated against measured Search Console impressions, 626 modelled**, with the label on every number and the method printed ("typically 50–70% off for a single keyword"). Caveat recorded in §3.2: none of the 15 keywords actually shown carries the "measured" label. |
| K3 | 6 | Every AI Overview claim is dated and hedged ("seen in the check at 06:49 UTC … one observation", exec 518; D20, D26 gone); the CTR model cuts the organic share to 65% when an AIO shows (`_rank_serp.js:17-23`). One curve for all keywords. |
| K4 | 6 | 15 live SERP checks of a stated cap of 16 (~$0.03) for intent and page type (exec 518). The dominant top-10 page type does not decide, and R13 shows the intent buckets themselves are not filtered for the site. |
| K5 | **5** | Real progress: "Navigational Keywords — No keywords with measurable search volume found" and 40 queries left out of the gap with reasons (exec 523); `refused: []` with no brand or portal query among the 131 relevant keywords (exec 518). **R13 caps it:** the same report's Informational list offers "character ai" (110,000/mo), "google ai" (40,500), "meta ai", the Commercial list "mh enterprises uae", and the gap keeps "mofa attestation dubai" and "how to check emirates id status with passport number" — with a High finding telling the owner to build pages for them. R3 (exec 488 shipped `fit: null` and charged $0.024) sits on top. |
| K6 | 8 | 10 data pulls, 662 keywords, plus **10 Search Console seeds read from 300 stored rows with no new API call** and 16 striking-distance rows labelled as such, with the exclusions accounted for (9 brand, 26 under 10 impressions) — exec 518, G8. |
| K7 | 7 | 5 clusters at ≥ 3 shared top-10 URLs with the "one page per group" rule stated (exec 518). Only 5 of 43 clusters are SERP-based, because only 15 keywords were checked live. |
| K8 | **6** | Strong where it looks: "7 keywords below are already answered by a page you have … two pages for one search split the signals" (exec 518), `existing_page_action "improve"` (exec 486), "refresh that page" (execs 505, 515). **R12 caps it:** 11 of 25 rows in the same discovery report say "no page of yours answers this search" about queries the site ranks #6.2 and #9.6 for, on pages that are in the 45-page inventory and return 200. |
| K9 | 7 | Exec 486: GO_WITH_CHANGES 52 with 16 sourced facts, an honest accreditation risk and a clean PDF; exec 519: verdict 58 with four reasons, competitor word counts and gaps, a dated AI Overview, CPC at 2 dp, `existing_page: null`. Capped by R7 (still asks for FAQPage schema). |
| K10 | 6 | Chance bands with the Ahrefs 2025 base rate and the word **uncalibrated** ("good (50–70%, uncalibrated)", execs 518, 495). No re-fit from own outcomes (G17). |

**Better than the leaders:** a decision rather than metrics, Search Console seeds and SERP-overlap clusters inside a $0.26 run, and
every traffic figure labelled measured or modelled.
**What caps the area:** R13, R12, R3, K1's missing back-test.

### 2.2 Keyword ladders / planning: 5.5 (was 4.5) — weighted mean 5.57

| Crit. | Score | Evidence |
|---|---|---|
| K9 (plan) | 6 | Exec 495: Short ladder, 5 pages, reachable-difficulty order, link map, ~45 visits/month, no competitor brand among the new rungs (D8 gone). Capped by R1: the document promises a page the guard refused seconds later. |
| K8 | 6 | As 2.1 (R12). |
| K10 | 6 | As 2.1. |
| K11 | **5** | Every URL in the plan is on `www.techand.ai` (D15/P2-3 gone) and the written page's 4 internal links all return 200 (exec 521, D9's first half). **R15 caps it:** the page's `suggested_url` is `/service-industry-erp-software-uae/` while the ladder row, its link map, the sibling up-links and the Rank Tracker all use `/service-industry-erp-software/`, and `meta.links_to_add_when_published` is `[]` although the app sent two planned ladder links. |
| K12 | 6 | The cap is enforced live: the new ladder was queued `reason "max_active"` (exec 506). Topic radius warns, never blocks (G32). |
| K13 | **4** | Five ladder-specific next steps, each right for its shape (exec 505, D16 gone). But **R16**: rung 2 of `lad_mv40b6s9h5a8` is still "facts erp" → `/facts-erp/`, `status: planned`, and the Rank Tracker's delivered report lists it — nothing revisits stored rows, and no automatic re-plan exists (G32). |

**Better than the leaders:** rungs ordered by difficulty the site can reach, then written and tracked.
**What caps the area:** R15, R16, R8 (`target_words: 0` on every rung row), R1.

### 2.3 Content creation & QA: 6 (was 5) — weighted mean 5.86

One content run in scope: exec 521 (12.2 min, 2,891 words, 3 images, $0.0221 search data + ≈ $0.587 Claude, $0.438 of it estimated).

| Crit. | Score | Evidence |
|---|---|---|
| C1 | 7 | `coverage_target` **68% from the best competitor page** (cubesoftware.com, position 5, 9,436 words, 30 sections) with the 6-page average (61%) printed beside it; QA re-measured the draft at 40% of 25 shared terms and named 10 missing terms and 3 missing subtopics (G33 live). The target is right; the output misses it and still ships. |
| C2 | 5 | A real angle with a worked example, but 11 × `[Price]` break its arithmetic and the proof list says "[Number] years of industry experience" — no business facts on file (O1, O2). |
| C3 | 7 | **Now live:** `sources_cited` graded per link (3 primary — tax.gov.ae ×2, peppol.org —, 3 vendor, 1 weak), `unverified_statistics []` in the final round after round 1 flagged "20+ years", "70%", "75%", no `utm_*` / `srsltid` (exec 521, G4). No claim-by-claim re-check at refresh. |
| C4 | 4 | `seo_profiles` is empty, so the page was delivered with **`author: null` and no author box at all** (exec 521); P2-6's gate had nothing to count. Owner-blocked (O1), not a code defect. |
| C5 | 7 | **2,762 eight-word windows** compared against the 8 pages the run already read, `passed: true`, highest overlap **0.1%** (one 10-word passage on the site's own Peppol article), threshold 15%, no extra fetch, $0 (exec 521, G5). No external plagiarism index. |
| C6 | 6 | Banned phrases, two specifics per section, critic pass — exercised in exec 521 but not itemised. |
| C7 | 7 | Flesch, passive share, long sentences, answer-first blocks (code; prior live evidence). **(NL here)** |
| C8 | **4** | The brief's target was **2,200 words**, the page is **2,891** (+31%) by QA's count and 2,727 by `meta.word_count` — the two counters disagree. *Parse Brief* clamped to the verdict's ~2,000, not to the app's `ladder_words: 1900`, which itself is the ladder's **main-page** figure because the rung row is `target_words: 0` (R8, P2-7). |
| C9 | **3** | Content QA ran twice and **failed both times** (`placeholder_count` 6 then 12, max 5, `passed false`, `editor_needed true`) and the page was delivered at `qa_max_rounds` (R11). The owner is told "Quality check: 6 item(s) to review" — round 1's number — and nothing says the gate failed. The machinery of a 5 exists (critic + deterministic gate + editor); it is overridden and misreported. |
| C10 | 7 | Title 51 characters, meta description 137, one H1, canonical on www (exec 521), plus URL Inspection of 45 key pages (exec 523, G25). The live publish check needs a published page **(NL)**. |
| C11 | 6 | `faq_count: 0`, schema `Service` + `BreadcrumbList` only with 15 question headings answered in the body (exec 521, G2). The verdict and ladder still *advise* FAQ schema (R7). |
| C12 | 6 | All 4 internal links return 200, neither unwritten ladder URL is in the body, anchors are sentence-cased phrases (exec 521, D9). Planned links are dropped (R15) and inbound links are still not verified. |
| C13 | 7 | `images_planned 3`, `images_produced 3`: a 1200×675 hero (20 KB) and two 1000×600 diagrams (38 / 37 KB), **WebP from the local Gotenberg container**, with planned file names, alt text, captions and the hero as Open Graph image, all three delivered to the app and named in the publish checklist (G30). Not verified on a live page **(NL)**; no original photography or data visuals. |

**Better than the leaders:** a complete package (HTML, Markdown, meta.json, schema, Open Graph, three rendered images, Word, PDF) in
12 minutes for about $0.61, with a measured originality check, graded sources and a best-competitor coverage target.
**What caps the area:** R11 (the decisive one), C8's length miss, C4 / O1.

### 2.4 Content cadence / pipeline: 5.5 (was 4.5) — weighted mean 5.69

| Crit. | Score | Evidence |
|---|---|---|
| C14 | 7 | Exec 506 wrote nothing and said why: "6 written pages waiting for publication (pile-up guard, limit 3)", every keyword named, the new ladder queued `max_active`, the AI page of the month identified (D5 gone). The count turned out correct once exec 521 wrote the sixth page, but R1's refusal path is still unfixed. |
| C15 | 6 | Decay and refresh actions live ("Put the new written text into the existing article instead", exec 515). No scheduled substantive refresh with facts re-checked. |
| C16 | 5 | Publish detection ran (6 candidates, 0 live, exec 515); the page exists as a document only; CMS push still off (G13). |
| C17 | 5 | Manual mode, tone, banned phrases, "Tech&" everywhere in the drafts (execs 508, 511). No stored style guide (G31). |
| K8 / K12 / K13 | 6 / 6 / 4 | As 2.1 and 2.2 — including R16: the cadence's read path would write a stored competitor-brand rung. |

**Better than the leaders:** the queue is fed by ladders *and* AI questions with "one search, one page", and the guard is loud.
**What caps the area:** R1, R16, G13, G31.

### 2.5 Technical audit: 5 (was 4) — mean 4.77

Two technical audits (execs 497, 513) and one full SEO report (exec 523: health 70, 60 findings, `aud_mv6cf3ru39g`).

| Crit. | Score | Evidence |
|---|---|---|
| 1.1 | 6 | "Crawled 45 of 45 known URLs (100%; sitemap 45 + 43 pages with Search Console impressions)", `crawl_complete true` (execs 497, 523; G24). |
| 1.2 | 5 | D6 and D18 are gone and confirmed against the live site (308 to www, the `theme-color` media pair explained). **R10 caps it:** all 45 inspection answers return `mobileUsabilityResult {verdict: VERDICT_UNSPECIFIED}` — Google retired the report — and the audit raises "Pages Google reports as not mobile-friendly", **High, 45 of 47 pages (100%), with empty evidence** (`v5/code/_page_watch.js:244` maps any non-PASS, non-NEUTRAL verdict to `false`; `build_v4.py:3617` emits the finding). |
| 1.3 | 7 | **45 of 45** key pages inspected with the quota stated, 15 indexed / 30 not with Google's own reason, `canonical_mismatch []`, rich results (exec 523, G25); 25 in the technical audit (exec 497). The Pages report is still a monthly check-in and removals are not detected. |
| 1.4 | 4 | Rendering without a response-vs-render diff (G14 open). **(NL)** |
| 1.5 | 4 | `crux.available false`, `reason "api_off"` for 3 templates × 2 devices; all three reports print "not available" with the enabling step and score anyway (G7, owner item). **(NL)** |
| 1.6 | **5** | The mechanism is right — "Ordered by likely impact" with the arithmetic ("impact score 53.3 … against 41.6"), `impact`/`impact_basis` per finding, 6 cosmetic items folded into one line that still counts (G18-2, G26). But R10's false High is ranked **second of 60** on a basis of "about 720 clicks and 22,860 impressions" when the property measured **38 clicks and 5,295 impressions**: the basis multiplies a site average by the pages affected with no cap. |
| 1.7 | 4 | Monthly plus a same-type diff (D2 gone on both paths: exec 513 `site_audit` vs `site_audit`, exec 523 `full` vs `full`). The daily Page Watch (G11) was deployed after these runs. **(NL)** |
| 1.8 | 0 | No staging / CI check (G27 open). |
| 1.9 | 6 | Fix pack with robots.txt "# Changes: none needed", byte-identical to the live file in the same minute on both paths (`files/robots.txt`, `files/fixpack-robots-523.txt`, D17), and placeholder-free Organization / LocalBusiness / WebSite JSON-LD with the real DAFZA NAP. Files only, no one-click deploy. |
| 1.10 | 4 | Still the next audit; the "I fixed this" re-check shipped after the run. **(NL)** |
| 1.11 | n/a | Small site; T5 does not apply. |
| 1.12 | 7 | 6 orphan pages, click depth, `internal-links.csv` (execs 497, 523). |
| 1.13 | **6** | R2 does **not** reproduce on the full-report path: "Structured data with errors" is stored in both audits and the diff keeps it under `open`, because the full report weights `Schema` (exec 523). The technical audit still reports it "new" every time (R2, exec 513), and schema errors on 26 of 47 pages are real. |
| 1.14 | **4** | `ACCURACY_SET.md` reports 100% precision and recall over 53 labelled audit cases and 34 spam cases, gated at ≥ 95% by harness S49 — published, but **offline**. R10 is a live High on 100% of pages with empty evidence *and* a 19×-inflated impact basis; the set's own caveat is that three healthy sites leave the Critical end unmeasured. |

**Better than the leaders:** index state for every key page, entity check, AI-crawler access, impact-ordered priority with a
quantified "why first", 100% crawl coverage and a verified fix pack in one 4-minute, $0.09 run; honest "not available" for CrUX.
**What caps the area:** R10 (false High + false impact basis), R2, G14 / G27 / G11 (not live), G7 (owner).

### 2.6 Rank tracking: 6 (was 3) — mean 5.75

| Crit. | Score | Evidence |
|---|---|---|
| 2.1 | 5 | Weekly (exec 505, started on demand through the Test Runner); no customer on-demand refresh, no automatic re-check after a publish or fix. |
| 2.2 | 6 | Depth 50, 15 checks, trimmed SERP snapshot stored per reading (`_rank_serp.js`; exec 505). Retention not shown in the report **(partly NL)**. |
| 2.3 | 7 | Desktop **and** mobile for the main keywords, with the reason stated ("only about 13% of sites hold the same position on both devices") — exec 505. Not every keyword on mobile. |
| 2.4 | 4 | Country level only. |
| 2.5 | 7 | Per keyword from the SERP already paid for: AI Overview (shown, cites us, domains, time seen), featured snippet, People Also Ask, local pack, video, shopping (exec 505, G6). Six families against the leaders' 15+. |
| 2.6 | 7 | CTR- and feature-weighted share of voice, labelled **modelled** with its method quoted (exec 505). Not yet trended. |
| 2.13 | 6 | Competitor positions from the same SERP (cleartax.com #16, exec 505); fewer than 10–20 per project. |
| 2.14 | 4 | **R9:** no ledger row and no cost reported; its DataForSEO share (≈ $0.03) had to be apportioned from the balance. |

**Better than the leaders:** every reading carries the ladder action it implies, and the SERP features cost nothing extra.
**What caps the area:** the action layer (R16's brand rung and R15's URL both reach the delivered report), 2.1 / 2.4, R9.

### 2.7 Site tracking: 7 (was 5) — mean 6.83

| Crit. | Score | Evidence |
|---|---|---|
| 2.7 | 8 | 862 Search Console rows paged, anonymised share 30.1%, brand / non-brand split, 5 operator queries excluded (exec 515, G9); the full report adds 28-day totals with 2 scraper queries excluded (exec 523). No archive beyond 16 months. |
| 2.8 | 7 | GA4 organic / AI sessions, key events and revenue; exec 526 confirms GA4 connected with 0 AI-assistant sessions. |
| 2.9 | 6 | Rotation inside the real quota is in place and 45 pages were inspected in the full report (exec 523); the weekly tracker's own count is not reported **(partly NL)**. |
| 2.10 | 7 | Striking distance, CTR gaps, decay and cannibalisation, each with an action, including the existing-URL refresh (exec 515, D11). |
| 2.11 | 8 | z-scores and 95% ranges ("clicks z 3.05, CI 35–349%", `statistically_real`) plus a core-update note (exec 515, G28); sparse series carry no percentage (D21, P2-4). |
| 2.12 | 5 | The September 2026 core update is called out in prose; automatic chart annotations and the num=100 break (G12) are in neither build. **(NL)** |

**Better than the leaders:** Search Console paging, GA4, Trends, publish detection and a statistically careful brief in one
40-second run.
**What caps the area:** G12 (not deployed), no brand archive, R9's missing cost row.

### 2.8 AI visibility (incl. pulse): 7 (was 6.5) — mean 6.86

| Crit. | Score | Evidence |
|---|---|---|
| 4A.1 | **4** | 8 questions stored, **7 asked** (exec 502) against Semrush's 25/day and Profound's 100/day; and the market-wide index — the part that should lift this criterion — prints a false owner row (R14: 19,579 answers, 16.4M AI search volume, from a 4-character name match, directly under "0 AI answers cite you"). G20 open. |
| 4A.2 | 7 | 8 questions × **6 engines**, 47 requests, 33 answers, 54 samples (exec 526); the pulse answered 21 of 21 (exec 502). Claude stays unlocalised by the vendor's own limit. |
| 4A.3 | 8 | Daily samples pooled into the weekly run, 95% Wilson ranges (named in 0%, range 0–15.5%), and one z-tested alert that is a real change (exec 502). |
| 4A.4 | **8** | Mention and citation rate, position, share of voice, sentiment and exact cited URLs: 8 competitor brands **all real domains** (tallysolutions 20.5% … azentio 3%), **30 of 30** cited URLs distinct with no `www.`, fragment or tracking parameter, AI Overview present on 85.7% of searches and citing the site 0%, brand recognised by 4 of 4 assistants (exec 526, D19 fully closed). |
| 4A.5 | 5 | The gate switched itself **off** honestly: `fact_check "no_facts"` and "**What AI gets wrong: not checked** — nothing on file can judge what the answers claim" (exec 526, P34-3). Nothing is actually checked until the owner fills the profile (O1). |
| 4A.6 | 8 | GA4 AI visits, key events and revenue, connected and read in this run (exec 526). |
| 4A.8 | 8 | **8 of 8** answer crawlers allowed, read live in this run (exec 526). |

**Better than the leaders:** Wilson ranges, engine-named error accounting (1 of 47 = 2.1%, 3 retried, 2 answered), an honest
"not checked" instead of a false all-clear, and revenue tied to answers at a fraction of a $99–399 seat.
**What caps the area:** R14, 4A.1's panel size (O8), 4A.5's missing fact base (O1).

### 2.9 AI growth: 6.5 (was 5) — mean 6.4

| Crit. | Score | Evidence |
|---|---|---|
| Readiness | 7 | 12 key pages scored, average 78/100, on raw HTML, with the site model's name and host (exec 511, P34-6). |
| 4A.7 | 6 | 7 questions to win: 5 queued, 1 mapped to the ladder keyword ("one search, one page"), 1 skipped (exec 511). |
| 4A.9 | 6 | Queue → cadence → **one** writer: `drafts_written 0`, `handed_over 9`; government sources get "apply … or cite it on your page" (exec 511, D12, P34-1). No win measured. |
| 4A.10 | 6 | Bing connected with "0 URLs to submit"; IndexNow `key_missing` (O6: the file 404s); Wikidata checked (`found: false`). |
| Drafts | 7 | This workflow drafts nothing and everything goes through the Link Builder's gates (L2). |

**Better than the leaders:** Bing submission, IndexNow and a Wikidata entity check, which the named leaders do not do natively.
**What caps the area:** O6, nothing submitted, no measured win.

### 2.10 Backlink monitoring: 7 (was 5) — weighted mean 7.07

| Crit. | Score | Evidence |
|---|---|---|
| 4B.1 | 6 | Coverage reported **per source with its reason** (DataForSEO 1 referring site, Bing 0 "connected; Bing reports no links yet", Search Console upload 0 "upload the Links export in the app", GA4 1, Common Crawl 1 release `cc-main-2026-jul-aug-sep`, social 2 not counted) — exec 529. The criterion's own anchor, the % of Google's sample found, needs O7. |
| 4B.2 | 8 | Our own check decides, not the index: the one best link carries "✓ on the page", `rel: follow`, placement `content`, DR 77 (exec 529). |
| 4B.3 | 8 | `lost []`, `at_risk []`, `important_lost []`, `rel_changed []` — no false "lost", one low informational alert, and lost requires two misses with a reason (exec 529, P1-2). |
| 4B.4 (heavy) | 8 | **17 farm links set aside** at no value with per-cluster evidence ("the same page path on 16 sites (/all/2835/13.html)"), `best_links` holds only peppol.org, and the baseline's "best link" `robuta.com/?q=business+impact` is a score-0 reclaim prospect (exec 529, D3 + G18-1); `ACCURACY_SET.md` reports best-link precision 100%. |
| 4B.5 | 7 | Review-only disavow with the cluster named; spam labels 100% precision / 100% recall over 34 labelled cases. |
| 4B.6 | 7 | `dr_enabled true`, `dr_error ""`; **39 of 42** gap domains refused `off_topic` with a reason; the three on topic are mof.gov.ae (`no_pitch`), uae-asp.ae, nationalbonds.ae (exec 529, D23). |
| 4B.7 | **5** | P34-6 is only half fixed: the payload carries `business_name "Tech&"` but the delivered report is headed "Backlinks: techand.ai" with **0** occurrences of "Tech&", and `brand_names` is `["techand.ai"]` alone — so mention matching for this workflow rests on the domain (exec 529). |

**Better than the leaders:** a live re-check that overrules the index, per-source coverage with reasons, and farm detection measured
on a labelled set.
**What caps the area:** 4B.7, 4B.1 (owner upload O7), one stored bare-host prospect row.

### 2.11 Link building: 6.5 (was 6) — mean 6.44

| Crit. | Score | Evidence |
|---|---|---|
| 4C.1 | 8 | 15 qualified, 25 refused with quotable reasons, from six-plus sources in 89 s (exec 508). |
| 4C.2 | 5 | Explicit refusals (4 government pages, 14 bare homepages, zoominfo, outlook.com, an accredited list, a competitor product page), and the hand-over is clean: with `link_builder: true` the Backlink Monitor writes **0 of 60** draft bodies and stale rows say the earlier draft "was withdrawn" (exec 529, P34-1). **R4 caps it:** `flick.network`, found at **#1** for the ladder head by this run's own Rank Tracker, is a `ready` prospect and `basware.com` is `needs_contact` — the gate reads the page, not the domain. |
| 4C.3 | 7 | Up to three contacts, all on the prospect's own domain, recipient country recorded (exec 508). |
| 4C.4 | 7 | 79–100-word personal first e-mails quoting the prospect's page, one link, no jargon; **all 8 held** with reasons (exec 508, L2). |
| 4C.5 | 7 | One e-mail plus follow-ups after 4 and 8 working days, stopping on a reply or out-of-office (exec 508; GreenMail 31/31 offline). No live send **(NL)**. |
| 4C.6 | 5 | Mailbox machinery with SPF / DKIM / DMARC and consent gates exists; **no mailbox is connected** (O4, G16). **(NL)** |
| 4C.7 | 8 | The Reply Reader checked our link the moment the "you are listed" reply arrived and found it on `peppol.org/members/full-members-list/`, `rel: follow`, placement `content` (exec 493); D14 gone ("[Owner: confirm whether we are accredited …]", exec 490). |
| 4C.8 | 5 | Brand / title anchors with all 15 targets on the canonical host, but `pickTarget` chose "Dynamics 365 cloud migration" (25% match) for a Peppol guide (§2.6). |
| 4C.9 | 6 | Control-group impact with graded wording ("likely helped" … "can't tell"); the change-test extension (G12) is in neither build. **(NL)** |

Listings (not a criterion): the two that matter are right (MoF, OpenPeppol both missing), but two pre-fix "listed" rows survive and
are reported as fact (SaaSHub 302, AlternativeTo 403 on a free re-check) — P34-2 residual.
**Better than the leaders:** out-of-office handling, a link check triggered by the reply, a draft gate that holds everything needing
the owner, bot-walled listings shown as "unknown".
**What caps the area:** R4, 4C.8, P34-2 residual, and that nothing has ever been sent.

### 2.12 Reporting & app: 4.5 (was 4.5) — mean 4.3

| Crit. | Score | Evidence |
|---|---|---|
| 3.1 | 7 | Organic and AI revenue with a brand / non-brand split, shown before rankings (exec 515, G9). |
| 3.2 | **4** | Real gains: D24 gone (one author finding, no false "capped at 85" at score 70), every CPC at 2 dp and no number over 2 decimals in exec 518's payload (P1-5), dated AI Overview claims, honest "not available" / "not checked" texts. But **four delivered reports state what their own data contradicts**: R10's "720 clicks and 22,860 impressions" against a measured 38 / 5,295; R14's "19,579" beside "0 AI answers cite you"; R12's "no page of yours answers this search" next to the ranking page; R11's "Quality check: 6 item(s) to review" when round 2 counted 12 and failed. |
| 3.3 | **4** | The modules agree on the canonical host, the inventory and one outreach writer, but the contradictions above are now **inside single documents**, and R15 leaves the ladder's stored URL and the page's URL unreconciled. |
| 3.4 | 3 | Impact measurement is links-only; `_change_test.js` (G12) is in neither build. **(NL)** |
| 3.5 | 2 | A core-update note in prose only; no automatic annotations live (G12). **(NL)** |
| 3.6 | 7 | 16 reports in the app from the first window plus 8 from the completion runs, with Word / PDF / HTML / Markdown / meta.json, three WebP images, a 7-file fix pack and CSV. No Looker connector. |
| 3.7 | 2 | Viewer role only (G15 open). |
| 3.8 (counted in 2.13, as in the 2026-10-11 scorecard) | 5 | All 48 planned executions succeeded, retries on every external HTTP node (G1), the failure watcher fired on its own (exec 516), the Test Runner ends inactive. Delivery rate unmeasured (G21); the IMAP trigger failed at runtime. |
| 3.9 | 3 | Severity, de-duplication and a webhook channel exist, but all 3 `seo_ops_alerts` rows are `delivered: "pending"`, no webhook URL is set, and the one real alert lost its node, message and execution id (R5, R6). |
| 3.11 | 6 | Every discovery number carries measured / modelled with its method, the inspection quota is stated, backlink coverage is per source with reasons; the full lineage kit (G29) is in neither build, and R10 / R14 are numbers with no honest basis. **(partly NL)** |
| 3.12 | 5 | Search Console, GA4, Bing, GBP, Gotenberg; CrUX not enabled, WordPress off. |
| UI | — | **(NL)** No owner session; no app page was exercised. |

**Better than the leaders:** every report shows its own cost and every schedule its next and last run.
**What caps the area:** R10 / R11 / R12 / R14 inside delivered reports, G12 / G15 (not live), R6, no UI evidence.

### 2.13 Cost control & reliability: 4.5 (was 4) — mean 4.4

| Crit. | Score | Evidence |
|---|---|---|
| Guards | 6 | **D1 is fixed and provable:** per-run `seo_run_ledger` reservations counted across concurrent runs refused two runs at "$5.74 of $6", which only adds up with the mid-flight $0.58 reservation (execs 499, 500); all 47 rows settle, refusals stay `refused` (P1-1), 11 stale reservations released (P34-5). **R9 caps it:** the ledger covers the main workflow and the Keyword Check only, counts AI estimates only, and both audits carry `est_usd: 0` while spending $0.09 each. |
| 3.10 | **4** | Estimates before every run and caches that work (`whois_requests 0`, three ages from `seo_cache`, **$0** against the baseline's $0.36 — D7, exec 523). But reconciliation now has numbers and they are bad: `ai_visibility` reserved **$0.06**, cost **$0.79** (13×); backlinks $0.04 → $0.37; the page $1.23 → $0.46; the ledger settles at the estimate ($2.26) against $2.88 spent; the $0.438 Opus part is an estimate because streaming nodes report no usage (G23). |
| 2.14 | **4** | DataForSEO measured by balance ($0.5781 + $1.8761); the page and backlink runs match to the cent, the full report's own figure is **$0.058 above** the delta, and three workflows report no cost at all (R9). |
| 3.8 | 5 | As 3.8 above: 48 of 48 planned executions succeeded, retries everywhere, failure watcher live; no delivery rate (G21); the IMAP trigger fails at runtime. |
| Ops | 3 | **R5 / R6:** the one real alert lost its node, message and execution id, its e-mail failed with `ENOTFOUND smtp.gmail.com`, `SEO_ALERT_WEBHOOK_URL` is unset, and **no alert has ever been recorded as delivered**. Still Mac-hosted (D25a; the container restarted again). D25c is fixed (exec 515). |

**Better than the leaders:** a reservation before every run, balances measured before and after each run, and heavy reuse of stored
data.
**What caps the area:** R9 and the 13× estimate miss, R5 / R6, D25a, G21, G23.

---

## 3. What caps the overall score most

1. **R11 — the main deliverable is still not publishable, and the report hides it.** Exec 521 shipped 2,891 words with **12
   placeholders** (11 × `[Price]`, 1 × `[Number]`) after Content QA failed it **twice**, because `qa_max_rounds: 2` was reached; the
   mask was applied to figures the draft itself declares illustrative, breaking the worked example's arithmetic; and the owner is
   told "Quality check: 6 item(s) to review" — round 1's count — with nothing saying the gate failed. This holds C9 at 3 and is why
   D10 is the one 2026-10-11 defect still marked **still present**.
2. **R10 / R12 / R13 / R14 — four delivered reports assert what their own data denies.** A High "not mobile-friendly" on 100% of
   pages from Google's retired field, with empty evidence and an impact basis 19× the site's measured clicks (exec 523); discovery
   saying "no page of yours answers this search" about queries the site ranks #6.2 for (exec 518); the keyword gap recommending
   "character ai" (110,000/mo) and another company's brand to a UAE Microsoft partner (exec 523); and a market-index row crediting
   the owner with 19,579 citing answers under its own "0 AI answers cite you" (exec 526). These cap the technical audit, keywords
   and reporting.
3. **Operations still have no proven way out, and the guard does not watch the money.** No ops alert has ever been delivered (R6),
   the one real alert lost its content (R5), SMTP could not resolve and no webhook is set; the schedules run on a Mac that restarts
   (D25a); and the guard covers 2 of 10 workflows, counting AI estimates that miss the spend by up to 13× (R9, G23) — while the
   estimates it does count refused two customer-facing runs.

Also capping: R15 and R16 (a written page whose URL the ladder does not know, planned links dropped, a competitor-brand rung still
queued and reported), R3, R4, R7, R8, P34-2's stale "listed" rows, and the items built or merged after the runs (G11, G12, G29) or
still open (G13, G14, G15, G20, G27, G31). Owner items block whole features: O1 / O2 (no profile, no facts — the author box, the AI
fact check and 8 drafts all stop there), O4, O6, O7, O8 and the Chrome UX Report API.

---

## 4. Outcomes (reported, not rated)

- **Rankings: none.** 15 SERP checks across 5 ladders, "nothing ranking anywhere" (exec 505).
- **Published pages: none.** Six written pages wait for publication; the written page of exec 521 now really exists as a document
  (`seo_content_log` row 4, `status: "written"`) but carries R11's placeholders, so it cannot go live as delivered. The ladder's
  other four target URLs answer 308 → 404. The cadence stays paused (O9).
- **AI answers: named in 0%** of 54 samples (95% range 0–15.5%), pages cited 0%, AI Overview present on 85.7% of the searches and
  citing the site in 0%; brand recognised by 4 of 4 assistants; GA4 shows 0 AI-assistant sessions (execs 502, 526). Nothing
  submitted to Bing; IndexNow still `key_missing`.
- **Links: none won.** 19 backlinks from 18 referring domains in the index, of which 17 farm links are set aside; one genuine link
  (peppol.org). 15 qualified prospects, 8 drafts, all 8 held, no mailbox connected (execs 508, 529).
- **Index coverage is the site's real problem:** 30 of 45 key pages are not indexed (21 unknown to Google, 6 discovered-not-indexed,
  3 with another canonical) — exec 523.
- **The site's own search data improved** (exec 515): 37 clicks vs 15 (+147%), 5,275 impressions vs 1,422 (+271%), both
  statistically real, average position 31.4 → 26.6, CTR 1.05% → 0.7%. Not attributable to this system — nothing it wrote is live,
  and the September 2026 core update sits inside the window (the report says so itself).
- **Cost of the whole re-rating: $3.79** (DataForSEO $2.454 measured by balance; Claude ≈ $1.33, $0.438 of it an estimate) against a
  $4.3 budget, for 21 runs — cheaper than the baseline's $4.3 for the same suite.

---

## 5. Where the evidence was still not sufficient to score

- **(NL) never exercised in either window:** the app UI (no owner session), `published`, the October check-in, a profile write and a
  content run that uses it, a live outreach send, a second full report (the RDAP path itself is still never reached — the cache
  answers first, D7), D25a's week of schedules, P2-6's author-box gate (the page had no author box to count), the sister-domain half
  of D23, and the "To reach 9" #1 requirement of running on 3+ sites.
- **Built after the runs, so no live evidence:** G12 (annotations, change tests), G29 (lineage) — in neither build; G11's daily Page
  Watch and the "I fixed this" re-check, deployed the same morning but after the runs.
- **`files/` is git-ignored**, so no artefact (PDF, Word, `page-521-content-qa.json`, `full-report-523-url-inspection.json`, the
  ledger JSON) could be opened independently. Two claims were checked against code and both hold: R10's mechanism
  (`v5/code/_page_watch.js:244` maps `VERDICT_UNSPECIFIED` to `false`, `build_v4.py:3617` raises the High finding) and the modelled
  share-of-voice method text (`v5/code/_rank_serp.js:17-23`).
- **No RESULTS-vs-code contradiction found.** Where §3.1 and §3.2 disagree with each other, §3.2 is the narrower statement and was
  used (for example R2 is reported "gone" for the full-report path and reproduced on the technical-audit path; both are scored at
  1.13 / 1.7).
- **Correction to this scorecard's first pass:** it stated that four of the completion runs' new defects were "described nowhere".
  That was wrong — it was written from the 629-line copy of `RESULTS.md`. R12, R13, R14, R15 and R16 are all documented with
  evidence in §3.2, and they are scored above.

---

## 6. Overall rating: 6 / 10 (was 5)

Area mean **5.92** (was 4.8). Twelve of the thirteen areas rose against the baseline and one held — but the two closest to the
customer barely moved: the page the system writes (5 → 6, held down by a gate that is overridden and misreported) and the reporting
that delivers it (4.5 → 4.5, held down by four reports that assert what their own data denies).

What genuinely changed, on live evidence: the guards count concurrent runs and bit when they should (D1); one site model reaches 9 of
the 10 workflows that ran, so the canonical host, the real name, the real NAP and a 45-page inventory are the same everywhere (G19);
the system tells the owner to improve the page it already has (D11); link farms are set aside and the one real link ranks first
(D3 / G18-1); ranks carry SERP features, competitors and a modelled share of voice (G6); discovery seeds itself from Search Console
and clusters by shared results pages (G8); the page is measured for copied passages, given a best-competitor coverage target and
delivered with three rendered WebP images (G5, G33, G30); every key page is inspected inside Google's quota (G25); WHOIS costs
nothing (D7); the robots fix pack is byte-identical to the live file (D17); AI request failures fell from 17% to 2.1% (G1); and where
the system cannot know something it now says "not available", "not checked", "modelled" or "uncalibrated" (G3, G7, G28, P34-3).

Against the named leaders the shape is unchanged: breadth and honesty beat them in places, while depth — daily ranks, render diffs,
CI gates, a 100-prompt panel, sharing, an external plagiarism index, one-click fixes — is still mid-market.

**To reach 7:** never deliver a page its own gate failed (R11) and never state a number the same document contradicts (R10, R12,
R14), gate the keyword lists on brand ownership and topic distance, not intent alone (R13), reconcile the ladder's URL with the page
it writes (R15), clean the stored rows (R16, P34-2), and give the guard every workflow and the real money (R9, G23). **To reach 8+:**
the owner items that block whole features (O1, O4, O6, O7, O8, CrUX), deployed G11 / G12 / G29 / G15, a 100+ prompt panel, and the
first measured outcomes — a published page that ranks, a link won, an AI answer that names the site. None of those outcomes exists
yet.
