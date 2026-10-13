# Scorecard — whole system against the best proven results (2026-10-13)

Independent re-rating after Phases 1–4, session 6A, G6, G7, G8, G18 and the P34 fixes. Scored **only** from the live evidence in
`RESULTS.md` (48 executions on techand.ai: 481–516 on 2026-10-12 and 517–529 on 2026-10-13, $3.79), against the **unchanged**
criteria in `../system-review-2026-10-11/CRITERIA_keywords_content.md` and
`../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md`, in the structure of the 2026-10-11 scorecard.

**Scales (unchanged).** K / C criteria use the 0 / 5 / 10 anchors of `CRITERIA_keywords_content.md` §(c). The 1.x–4C.x criteria use
0 = absent · 2 = manual · 4 = automated but basic · 6 = mid-market parity · 8 = parity with the named leader · 10 = beyond the
leaders and proven live.

**Rules followed** (`../system-review-2026-10-11/FIX_PLAN.md` §5.2): every score cites a run, execution id, file or code location;
a criterion not exercised live is marked **(NL)** and scored only on what code and specs show, never above what the last live
evidence supported; a defect seen live caps its criterion at the level the defect shows; a fix the run did not exercise is not
credited; area scores weigh the strong-evidence criteria (K1–K3, K8, K10, C2, C3, C14, C15, 4B.4) higher and are rounded to the
half point; capability and correctness are rated, **outcomes are reported separately** (§4). No criterion was rewritten.

**Both passes count.** The 2026-10-12 window ran 16 of the 21 protocol runs — the engine's own daily budget guard refused
`discover` and the ladder's page run (execs 499, 500). The completion pass of 2026-10-13 (execs 517–529) ran all five missing runs
with nothing changed, so discovery, content, the full report, AI visibility and backlinks **do** have live evidence of their own
here. Where a re-check in `RESULTS.md` §3.1 says "not exercised", no credit is taken for it from this run.

**D#** = defect of 2026-10-11 · **P1/P2/P34/G18-#** = defects of the 2026-10-12 live checks · **R#** = new defect of this run
(`RESULTS.md` §3.2, `FIX_PLAN.md` §3.11) · **G#/L#/O#** = `FIX_PLAN.md` register items.

---

## 1. Summary

| # | Area | 2026-10-11 | **Now** | Compared with | What caps it now |
|---|---|---|---|---|---|
| 1 | Keyword research & verdicts | 5 | **6.5** | Semrush (Personal KD) / Ahrefs | reach is still domain-level with no back-test (K1); one of three keyword checks shipped `fit: null` (R3); FAQPage advice (R7) |
| 2 | Keyword ladders / planning | 4.5 | **6** | MarketMuse / Semrush Strategy Builder | the plan promises a page the guard refused (R1); rung pages carry no word target (R8); topic radius only warns (G32) |
| 3 | Content creation & QA | 5 | **5.5** | Surfer / Clearscope | the page shipped with 12 placeholders **after its own QA failed twice** (R11); author box and facts still bracketed (O1, P2-6) |
| 4 | Content cadence / pipeline | 4.5 | **6** | Clearscope (inventory, decay) | the pile-up count includes a page that does not exist (R1); no CMS push (G13); no style guide (G31) |
| 5 | Technical audit | 4 | **5.5** | Sitebulb / Ahrefs Site Audit | a **High "not mobile-friendly" on every inspected page** from Google's "no data" answer (R10); a "not assessed" finding reported "new" at every audit (R2); no render diff (G14), no pre-release check (G27) |
| 6 | Rank tracking | 3 | **6** | AccuRanker / Semrush Position Tracking | weekly, country-level only; the next step names a page that was never written (R1); no cost of its own (R9) |
| 7 | Site tracking (GSC / GA4 / Trends) | 5 | **7** | SEOTesting + Looker Studio | chart annotations and change tests built but not deployed (G12, NL); no cost ledger (R9) |
| 8 | AI visibility (incl. pulse) | 6.5 | **7** | Profound / Semrush AI Toolkit | 7 of 8 questions asked (O8), far from a 100-prompt panel (G20); the fact check cannot run at all (empty profile, O1) |
| 9 | AI growth | 5 | **6.5** | Profound Actions / AthenaHQ | IndexNow key file still missing (O6); nothing submitted to Bing; no win measured |
| 10 | Backlink monitoring | 5 | **7.5** | Ahrefs (+ Linkody re-checks) | no % of Google's own sample until the Search Console export is uploaded (O7, 4B.1); mentions path still (NL) |
| 11 | Link building | 6 | **6.5** | Pitchbox / Respona | a competitor ranked #1 for our head keyword passed as a prospect (R4); two stale "listed" rows reported as fact (P34-2); `pickTarget` chose a 25%-match page; nothing has ever been sent (G16, O4) |
| 12 | Reporting & app | 4.5 | **5** | AgencyAnalytics / Semrush My Reports | three reports state a page that does not exist (R1); a false "new" finding (R2); no annotations deployed (G12), no sharing (G15); UI not exercised (NL) |
| 13 | Cost control & reliability | 4 | **5** | Semrush / Ahrefs (server-side limits) | the guard covers 2 of 10 workflows and AI spend only (R9); **no ops alert has ever been delivered** (R5, R6); Mac-hosted schedules (D25a); Claude spend still part estimate (G23) |
| | **Overall** | **5** | **6** | | area mean **6.15** (was 4.8) |

---

## 2. Per area

### 2.1 Keyword research & verdicts: 6.5 (was 5)

| Crit. | Score | Evidence |
|---|---|---|
| K1 | 5 | "Reach" is still a domain-level KD percentile, served from a cached 2026-10-08 measurement (exec 495); no back-test of predicted vs actual top-10 rates (G17 open). |
| K2 | 7 | `discover` (exec 518, 662 keywords / 131 relevant) labels every traffic figure **measured or modelled** and calibrates potential against measured Search Console impressions (G8 live; `v5/code/_kw_inputs.js`). Not yet validated against outcomes. |
| K3 | 6 | AI Overview is now a dated observation per keyword, not an assertion (execs 486, 495: "seen in the check at 20:29 UTC … one observation"); the CTR model cuts the organic share to 65% when an AIO shows (`_rank_serp.js:17-23`, Ahrefs 2025). Still one curve for all keywords. |
| K4 | 6 | The verdict reads the live top 10 and competitor word counts (exec 486: 463–1,256 words); live SERP checks in discovery raised 8 → 16 (G8, exec 518). Page type is not derived from the dominant top-10 type. |
| K5 | 7 | The fit gate holds live: no government or other-brand keyword in discovery or the rungs (`refused_keywords []`, exec 495), and the full report refuses to pitch a ministry or a link seller (exec 523, P34-4). **Capped by R3**: exec 488 shipped `fit: null` after `Parser — Keyword Fit` failed twice, and still charged $0.024. |
| K6 | 8 | Seven pulls + competitors + AI demand + **Search Console seeds and striking distance** (exec 518, G8) — the gap the baseline named is closed. |
| K7 | 8 | Clusters are built from shared results pages (≥ 3 shared top-10 URLs) in exec 518 (G8), the convention the leaders use. Not validated against a human clustering. |
| K8 | 7 | The verdict found the site's own live page by slug and said `improve` (exec 486, `existing_page.source "page inventory"`), the Rank Tracker and Site Tracker say "refresh that page, do not publish a second one" (execs 505, 515). The cross-ladder half was verified in the 2026-10-12 check, not here. |
| K9 | 7 | GO_WITH_CHANGES 52 with 16 sourced facts, honest risks ("not shown to be an FTA-accredited ASP") and a clean PDF / Word file (exec 486); a second verdict, 58, in the completion pass (exec 519). Capped by R7 (still asks for FAQPage schema) and by months given without a likelihood. |
| K10 | 6 | Chance bands carry the Ahrefs 2025 base rate and the word **uncalibrated** (execs 495, 519, G3). No re-fit from the product's own tracked outcomes (G17 open). |

**Better than the leaders:** it returns a decision (plan type, months, alternatives, an "improve this page instead" verdict) rather
than metrics, and 662 keywords with Search Console seeds and SERP-overlap clusters cost $0.26 (exec 518).
**What caps the area:** K1 (no personal-topic authority, no back-test), R3, R7.

### 2.2 Keyword ladders / planning: 6 (was 4.5)

| Crit. | Score | Evidence |
|---|---|---|
| K9 (plan) | 6 | Exec 495: Short ladder, 5 pages, reachable-difficulty order, link map, traffic potential ~45 visits/month, feasibility 68, no competitor brand among the rungs (D8 gone). **Capped by R1**: the delivered document says "Written now: 'service industry erp software' … delivered separately", and that page run was refused seconds later. |
| K8 | 7 | As 2.1: the ladder's URLs and the exclusion lists are clean (`excluded_keywords []`, exec 495); the "existing live page" check now runs in the verdict and the trackers. |
| K10 | 6 | As 2.1 (G3 live in the ladder report). |
| K11 | 6 | Every `target_url`, `links_to` and the whole link map use `https://www.techand.ai/…` (exec 495, D15/P2-3 gone). The hub/live-link half (D9) was verified on 2026-10-12, not in this run **(NL here)**; no competitor topical map. |
| K12 | 6 | The cadence enforced the cap live: the new ladder was queued with `reason: "max_active"` (exec 506). Topic radius still warns instead of blocking (G32 open). |
| K13 | 5 | Five ladder-specific next steps, each right for its shape (exec 505, D16 gone). No automatic re-plan of a stuck ladder (G32); one of the five steps describes a page that does not exist (R1). |

**Better than the leaders:** rungs are ordered by difficulty the site can reach, then written and tracked; the leaders stop at the plan.
**What caps the area:** R1, R8 (`target_words: 0` on all four rung rows), G32.

### 2.3 Content creation & QA: 5.5 (was 5)

One content run in scope: exec 521 (12.2 min, 2,891 words, 3 WebP images, $0.52 Claude of which $0.44 is an estimate).

| Crit. | Score | Evidence |
|---|---|---|
| C1 | 7 | The brief's coverage target is taken from the **best** competitor page, not the average (G33 live, exec 521; `RESULTS.md` §0b headline). Coverage is re-measured in QA. |
| C2 | 5 | Gain items are planned and criticised, but the delivered page still carries 12 owner placeholders (R11) — the same root cause as the baseline's D10: no business facts on file (O1, O2). |
| C3 | 7 | Figures are matched to source text with `[Confirm: …]` for anything unsourced (exec 486: 16 sourced facts with URLs; G4 verified live 2026-10-12). No claim-by-claim re-check at refresh. |
| C4 | 4 | `seo_profiles` is empty for techand.ai and the entity check reports `profile_set: false` (`RESULTS.md` §4); the author box is still bracketed (P2-6, not exercised). Unchanged from the baseline. |
| C5 | 7 | **New:** the draft is checked for copied passages against the competitor and own pages already fetched (G5 live, exec 521; `v5/code/_shingle.js`, 15% threshold). No external plagiarism index (Semrush uses Copyleaks). |
| C6 | 6 | Banned phrases, two specifics per section, critic pass (code; exercised in exec 521 but not itemised in `RESULTS.md`). |
| C7 | 7 | Flesch, passive share, long sentences, answer-first blocks (code; prior live evidence 2026-10-12). **(NL here)** |
| C8 | 5 | 2,891 words delivered with a coverage-based target (G33), but **R8**: the rung rows carry `target_words: 0`, so the ±25% clamp protects only the page the verdict measured. No over-length defect seen this time. |
| C9 | **3** | **R11 caps this hard:** the page's own quality gate **failed it twice and it shipped anyway** with 12 placeholders (exec 521). A gate that is overridden is worse than the baseline's gate that scored 91 on an unpublishable page; still not validated against outcomes (G17). |
| C10 | 7 | Title / meta / H1 / canonical in the draft plus URL Inspection of 25–45 key pages live (execs 497, 523, G25). The live publish check needs a published page **(NL)**. |
| C11 | 6 | No FAQPage in the delivered page (G2, verified 2026-10-12); but the verdict and ladder still *advise* FAQ schema (R7, execs 486, 495). |
| C12 | 6 | Internal links all on the canonical host (exec 495); live-page-only linking verified 2026-10-12 **(NL here)**; inbound links still not verified. |
| C13 | 7 | **New:** three real WebP images were rendered locally and delivered with the package, with planned alt text and file names (G30 live, exec 521, "three real WebP images … rendered on this machine"). Not checked on a live page **(NL)**; not original photography or data visuals. |

**Better than the leaders:** a complete package (HTML, Markdown, meta.json, schema, Open Graph, three rendered images, PDF and Word)
in 12 minutes for about $0.54, with an originality check and a best-competitor coverage target.
**What caps the area:** R11 (the decisive one), C4 / O1, C9 validation.

### 2.4 Content cadence / pipeline: 6 (was 4.5)

| Crit. | Score | Evidence |
|---|---|---|
| C14 | 7 | Exec 506 wrote nothing and said why: "6 written pages waiting for publication (pile-up guard, limit 3)" naming every keyword, `paused_reason "pileup"`, the new ladder queued `max_active`, the AI page of the month identified (D5 gone; the real Monday schedule did the same). **Capped by R1**: one of the six pages does not exist, so the limit is reached by a phantom. |
| C15 | 6 | Decay and refresh actions live: "Put the new written text into the existing article instead" (exec 515). No scheduled substantive-refresh loop with facts re-checked. |
| C16 | 5 | Publish detection ran (6 candidates, 0 live, exec 515) and URL Inspection is in place; CMS push still off (G13 open). |
| C17 | 5 | Manual mode, tone and banned phrases; brand written "Tech&" everywhere (execs 508, 511). No stored style guide (G31 open). |
| K8 / K12 / K13 | 7 / 6 / 5 | As 2.1 and 2.2. |

**Better than the leaders:** the queue is fed by ladders *and* AI questions with "one search, one page" (exec 511: 1 of 7 targets
mapped to the ladder page), and the guard is loud rather than silent.
**What caps the area:** R1, G13, G31.

### 2.5 Technical audit: 5.5 (was 4)

Two technical audits (execs 497, 513) and one full SEO report (exec 523, health 70, 60 findings).

| Crit. | Score | Evidence |
|---|---|---|
| 1.1 | 6 | "Crawled 45 of 45 known URLs (100%; sitemap 45 + 43 pages with Search Console impressions)" (exec 497, G24) — the coverage figure the cap required. Small site, so no ≥ 100k evidence. |
| 1.2 | 5 | D6 and D18 are gone and verified against the live site (308 to www, `theme-color` pair explained; exec 497 *What Works*). **R10 caps it:** the full report raises a **High** "Pages Google reports as not mobile-friendly" on every inspected page out of Google's "no data" answer — the code maps any non-`PASS`, non-`NEUTRAL` verdict (i.e. `VERDICT_UNSPECIFIED` from the retired mobile-usability API) to `false` (`v5/code/_page_watch.js:244` → `build_v4.py:3617`). |
| 1.3 | 7 | URL Inspection of 25 key pages in the audit and **all 45** in the full report, with verdict, coverage, Google's chosen canonical, last crawl and rich results (execs 497, 523; G25). The Pages report is still a monthly check-in. |
| 1.4 | 4 | Rendering without a response-vs-render diff (G14 open). **(NL)** |
| 1.5 | 4 | CrUX per template is built but **could not be exercised**: both reports print "Not available: the Chrome UX Report API is not enabled …" with the enabling step and still score (exec 497, G7; owner item). **(NL)** |
| 1.6 | 7 | G26 live: "Ordered by likely impact", with the arithmetic ("impact score 37.6 against 37.1"), `impact`/`impact_basis` stored per finding, and 6 cosmetic items folded into one line that still counts in the score (G18-2, execs 497/513). Capped because a false High (R10) enters that ordering in the full report. |
| 1.7 | 4 | Monthly plus a same-type diff. The daily Page Watch (G11) was deployed **after** these runs (`RESULTS.md` §5) — no live evidence. **(NL)** |
| 1.8 | 0 | No staging / CI check (G27 open). |
| 1.9 | 6 | Fix pack with correct robots.txt ("# Changes: none needed", byte-identical Disallows — D17 gone) and placeholder-free Organization / LocalBusiness / WebSite JSON-LD carrying the real DAFZA NAP (exec 497). Files only, no one-click deploy. |
| 1.10 | 4 | Verification is still the next audit; the "I fixed this" re-check shipped after the run **(NL)**. |
| 1.11 | n/a | Small site; T5 does not apply. |
| 1.12 | 7 | Orphans (6), click depth and `internal-links.csv` in the fix pack (exec 497). |
| 1.13 | 5 | Schema is generated and schema errors on 26 of 47 pages are found — but the category is declared "not assessed" by a technical audit, so the finding is in no score and is reported "new" at every audit (R2, exec 513). |
| 1.14 | 5 | `ACCURACY_SET.md`: **100% precision and recall over 53 labelled audit cases** on three sites and 100% / 100% over 34 spam cases, gated at ≥ 95% by harness S49, with useful precision 95.5% — published, but **offline**. R10 is a live High false positive on a check the set does not cover, and the set itself notes the Critical end is unmeasured. |

**Better than the leaders:** index state, entity check, AI-crawler access, impact-ordered priority with a quantified "why first",
the coverage figure and a fix pack in one 4-minute, $0.09 run; honest "not available" instead of a guess.
**What caps the area:** R10 (a High false positive on every page of a delivered report), R2, G14 / G27 / G11 (not live).

### 2.6 Rank tracking: 6 (was 3)

| Crit. | Score | Evidence |
|---|---|---|
| 2.1 | 5 | Weekly (exec 505 run on demand through the Test Runner); no customer on-demand refresh and no automatic re-check after a publish. |
| 2.2 | 6 | Depth 50, 15 checks, with a trimmed SERP snapshot stored per reading (`_rank_serp.js`; exec 505 reports the features it read). Snapshot retention not shown in the report **(partly NL)**. |
| 2.3 | 7 | Desktop **and** mobile for the main keywords, with the reason stated ("only about 13% of sites hold the same position on both devices") — exec 505, 15 checks. Mobile is not run for every keyword. |
| 2.4 | 4 | Country level only (United Arab Emirates). |
| 2.5 | 7 | Per keyword from the SERP already paid for: AI Overview (shown, cites us, domains, time seen), featured snippet, People Also Ask with questions, local pack, video, shopping (exec 505, G6). Six families, not the leaders' 15+. |
| 2.6 | 7 | CTR- and feature-weighted share of voice, explicitly **modelled** with its method quoted (exec 505, `_rank_serp.js:17-23`). Not yet trended. |
| 2.13 | 6 | Competitor positions from the same SERP (cleartax.com #16 for "e invoicing in uae", exec 505); fewer than the leaders' 10–20 per project. |
| 2.14 | 5 | **R9**: the Rank Tracker writes no ledger row and reports no cost; its DataForSEO share (≈ $0.03) had to be apportioned from the balance. |

**Better than the leaders:** every reading carries the ladder action it implies, and the features come free from a SERP call the run
had already paid for.
**What caps the area:** 2.1 / 2.4 (weekly, country), R1 (one next step names a page that was never written), R9.

### 2.7 Site tracking: 7 (was 5)

| Crit. | Score | Evidence |
|---|---|---|
| 2.7 | 8 | 862 Search Console rows paged, anonymised share and brand / non-brand split, operator queries excluded (exec 515, G9) — the baseline's "top 500, no split" gap is closed. No archive beyond 16 months. |
| 2.8 | 7 | GA4 organic / AI sessions, key events and revenue (live 2026-10-11/12; the join was not itemised in this run's write-up). **(partly NL)** |
| 2.9 | 6 | URL Inspection rotation inside the real quota is in place (G25) and 45 pages were inspected in the full report (exec 523); the weekly tracker's own inspection count is not reported here **(partly NL)**. |
| 2.10 | 7 | Striking distance, CTR gaps, decay and cannibalisation with an action each, including "do not publish a second page" with the existing URL (exec 515, D11 gone). |
| 2.11 | 8 | Statistical thresholds live: z-scores and 95% ranges ("clicks z 3.05, CI 35–349%", `statistically_real`), plus a core-update note (exec 515, G28). |
| 2.12 | 5 | The September 2026 core update is called out in the brief, but chart annotations and the num=100 break (G12) were built after these runs and are not deployed **(NL)**. |
| 2.14 | 5 | **R9**: no ledger row, no cost of its own (≈ $0.01 apportioned). |
| 2.4 (Trends) | — | D21 gone: four sparse keywords return `direction "sparse"`, `change_pct null`, "too little search data to read"; P2-4 gone (real day counts). |

**Better than the leaders:** Search Console paging, GA4, Trends, publish detection, URL inspection and a statistically careful brief
in one 40-second run.
**What caps the area:** G12 (not deployed), R9, no brand archive.

### 2.8 AI visibility (incl. pulse): 7 (was 6.5)

| Crit. | Score | Evidence |
|---|---|---|
| 4A.1 | 5 | 8 questions stored, **7 asked** (exec 502); up to 50 supported, a 100+ panel is open (G20, O8). Monthly market-wide index unchanged. |
| 4A.2 | 7 | 8 questions × **6 engines** = 47 requests with 1 failure (exec 526); the pulse asked 21 of 21 (exec 502, `error_rate 0`). Claude stays unlocalised by the vendor's own limit. |
| 4A.3 | 8 | Daily samples, 95% Wilson ranges (named in 0%, range 0–15.5%) and one z-tested alert that is a real change ("oracle.com in 10 of today's 21 answers, not named in the past 4 days") — exec 502. |
| 4A.4 | 7 | Mention and citation rate, position, share of voice, sentiment and the exact cited URLs; brand→domain mapping and URL normalisation verified in the 2026-10-12 check (D19). |
| 4A.5 | 5 | **P34-3 is fixed in the honest direction**: exec 526 says its fact check was "not checked" instead of "no claim was wrong". But with `seo_profiles` empty (O1) no answer is actually checked against anything. |
| 4A.6 | 8 | GA4 AI visits, key events and revenue (live 2026-10-08/11; not itemised in this run). **(partly NL)** |
| 4A.8 | 8 | Robots per bot, llms.txt and a CDN block test (live 2026-10-11/12; not re-run here). **(NL here)** |
| G1 | — | The retry gate is live: AI request failures 17% (baseline) → **2.1%** (1 of 47, exec 526) and 0 of 21 in the pulse. |

**Better than the leaders:** Wilson ranges, z-tested alerts and revenue tied to answers at a fraction of a $99–399 seat.
**What caps the area:** 4A.1 (7 questions asked), 4A.5 (no fact base — owner item O1), G20.

### 2.9 AI growth: 6.5 (was 5)

| Crit. | Score | Evidence |
|---|---|---|
| Readiness (spec §2) | 7 | 12 key pages scored, average 78/100, on raw HTML, with the site model's name and host (exec 511, P34-6). Not re-checked on a live page after a fix. |
| 4A.7 | 6 | 7 questions to win, 5 queued, 1 mapped to the ladder keyword ("one search, one page"), 1 skipped (exec 511). |
| 4A.9 | 6 | Queue → cadence → **one** outreach writer: `drafts_written 0`, `handed_over 9` (exec 511, P34-1 and D12 gone); government sources get "apply … or cite it on your page" instead of a pitch. No win measured yet. |
| 4A.10 | 6 | Bing is connected with "0 URLs to submit"; IndexNow reports `key_missing` because the key file is still not on the site (O6); Wikidata checked (`found: false`). |
| Drafts (4C.2 / 4C.4) | 7 | Nothing is drafted by this workflow any more, and nothing leaves the machine without the owner (L2). |
| G22 | — | Source titles are whole again ("UAE E-Invoicing ASP List 2026: Accredited & Pre-Approved - Finline"), exec 511. |

**Better than the leaders:** Bing submission, IndexNow and a Wikidata entity check, none of which the named leaders do natively.
**What caps the area:** O6 (owner), nothing submitted, no measured win.

### 2.10 Backlink monitoring: 7.5 (was 5)

| Crit. | Score | Evidence |
|---|---|---|
| 4B.1 | 6 | Sources merged (DataForSEO + Bing + GA4 + Common Crawl + web search) in the full check (exec 529), but no **% of Google's own sample** until the Search Console export is uploaded (O7). |
| 4B.2 | 8 | Our own re-check decides, not the index (the 2026-10-11/12 evidence on peppol.org); exec 529 puts the one real link on top. |
| 4B.3 | 8 | **No false "lost"** in exec 529, and the scheduled Monday watch set aside all farm links with no false loss; lost requires two misses with a reason. |
| 4B.4 (heavy) | 8 | D3 / G18-1 are closed live: **17 farm links set aside** at value 0 and the one genuine link ranked first (exec 529); `ACCURACY_SET.md` reports best-link precision 100% (was 50%). |
| 4B.5 | 7 | Review-only disavow; spam labels 100% precision / 100% recall over 34 labelled cases; 17 farm links flagged as a cluster (exec 529). |
| 4B.6 | 7 | Competitor gap, competitors' new links and "best X" lists, with off-topic and sister-domain refusals (D23, 2026-10-12). |
| 4B.7 | 6 | Unlinked mentions / GDELT remain code-only in this run. **(NL)** |

**Better than the leaders:** a live re-check that overrules the index, a ledger that merges free sources, and farm-link detection
measured on a labelled set.
**What caps the area:** 4B.1 (owner upload O7), 4B.7 (NL).

### 2.11 Link building: 6.5 (was 6)

| Crit. | Score | Evidence |
|---|---|---|
| 4C.1 | 8 | 15 qualified, 25 refused with quotable reasons, from six-plus sources in 89 s (exec 508). |
| 4C.2 | 5 | Strong, explicit refusals (4 government pages, 14 bare homepages, zoominfo, outlook.com, an accredited list, a competitor product page). **R4 caps it:** `flick.network`, which this run's own Rank Tracker found at **#1** for the ladder head, is a `ready` prospect, and `basware.com` is `needs_contact` — the gate reads the prospect's page, not its domain (`v5/code/_outreach_kit.js`). |
| 4C.3 | 7 | Up to three contacts, all on the prospect's own domain, recipient country recorded (exec 508). |
| 4C.4 | 7 | 79–100-word personal first e-mails quoting the prospect's page, no jargon, one link; **all 8 held** with reasons (L2, exec 508). |
| 4C.5 | 7 | One e-mail plus follow-ups after 4 and 8 working days, stopping on a reply or out-of-office (exec 508 drafts; GreenMail 31/31 offline). No live send **(NL)**. |
| 4C.6 | 5 | Mailbox machinery with SPF / DKIM / DMARC and consent gates exists; **no mailbox is connected** (O4, G16). **(NL)** |
| 4C.7 | 8 | The Reply Reader checked our link the moment the "you are listed" reply arrived and found it on `peppol.org/members/full-members-list/`, `rel: follow`, placement `content` (exec 493). |
| 4C.8 | 5 | Brand / title anchors, all 15 targets on the canonical host — but `pickTarget` chose "Dynamics 365 cloud migration" (25% match) for a Peppol guide (`RESULTS.md` §2.6). |
| 4C.9 | 6 | Control-group impact with graded wording is in place; the change-test extension (G12) is not deployed. **(NL)** |
| Listings | 5 | The two listings that matter are right (MoF and OpenPeppol missing), but **two pre-fix "listed" rows survive and are reported as fact** (SaaSHub 302, AlternativeTo 403 on a free re-check) — P34-2 residual. |
| D14 | — | Gone: the suggested reply says "[Owner: confirm whether we are accredited …]" instead of inventing accreditation (exec 490). |

**Better than the leaders:** out-of-office handling, a link check triggered by the reply itself, a draft gate that holds everything
needing the owner, and bot-walled listings shown as "unknown".
**What caps the area:** R4, P34-2 residual, 4C.8 target choice, and that no sequence has ever been sent (G16, O4).

### 2.12 Reporting & app: 5 (was 4.5)

| Crit. | Score | Evidence |
|---|---|---|
| 3.1 | 7 | Organic and AI revenue plus a brand / non-brand split (exec 515, G9), shown before rankings. |
| 3.2 | 6 | Briefs are computed-data-grounded and statistically careful (exec 515); the delivered verdict / ladder files carry no placeholders or float CPCs. Capped by R1 (a page that does not exist is described as written) and by developer language in the guard's rejection report (`RESULTS.md` §3.2). |
| 3.3 | 5 | The modules now agree on the canonical host, the page inventory and one outreach writer; they still contradict each other on the phantom page (R1) and on the site's LinkedIn profile (fix pack vs listings check, `RESULTS.md` §2.4). |
| 3.4 | 3 | Impact measurement remains links-only; `_change_test.js` (G12) is built but not deployed. **(NL)** |
| 3.5 | 2 | A core-update note appears in prose (exec 515), but no automatic chart annotations are live (G12). **(NL)** |
| 3.6 | 7 | 16 reports in the app across both windows, with Word / PDF / HTML / Markdown / meta.json, three WebP images, a 7-file fix pack and CSV (execs 495–529). No Looker connector. |
| 3.7 | 2 | Viewer role only; expiring share links open (G15). |
| 3.8 | 5 | All 48 planned executions succeeded (35 + 13); the failure watcher fired on its own (exec 516). Delivery rate is still unmeasured (G21) and the one ops e-mail failed. |
| 3.9 | 3 | Severity, de-duplication and a webhook channel exist, but **all 3 `seo_ops_alerts` rows are `delivered: "pending"`**, the webhook URL is unset and the alert's node / message / execution were lost (R5, R6). |
| 3.11 | 6 | Figures now carry "measured or modelled" labels and method notes (execs 505, 515, 518); the full lineage kit (G29) is not deployed. **(NL)** |
| 3.12 | 5 | Search Console, GA4, Bing, GBP, Gotenberg; CrUX not enabled, WordPress off. |
| UI | — | **(NL)** No owner session was run, so no app page was exercised in this review. |

**Better than the leaders:** every report shows its own cost and every schedule its next and last run.
**What caps the area:** R1 / R2 (reports stating things that are not true), G12 / G15 (not live), R6 (nothing delivered), no UI evidence.

### 2.13 Cost control & reliability: 5 (was 4)

| Crit. | Score | Evidence |
|---|---|---|
| Guards | 6 | **D1 is fixed and provable:** per-run `seo_run_ledger` reservations counted across concurrent runs refused two runs at "$5.74 of $6", which only adds up with the mid-flight reservation ($0.58) counted (execs 499, 500); every row settles (P1-1) and 11 stale reservations were released (P34-5, exec 485). **R9 caps it:** the ledger covers only the main workflow and the Keyword Check, counts AI estimates only, and both audits carry `est_usd: 0` while spending $0.09 each. |
| 3.10 | 5 | Estimates before every run, company budgets, caches working (WHOIS **$0** in the full report, D7, exec 523). But reserved-vs-actual is far apart (`ai_visibility` reserved $0.06, cost $0.79), `settled_usd` is still the estimate, and the page run's $0.44 of Claude spend is an estimate because streaming nodes report no usage (G23). |
| 2.14 | 5 | DataForSEO measured by balance ($0.5781 + $1.8761) agrees to the cent for some runs and is $0.058 off for the full report; three workflows report no cost at all (R9). |
| 3.8 | 5 | All 48 planned executions succeeded, retries are now on every external HTTP node (G1: AI failures 2.1%), and the failure watcher works — but the Console Alerts IMAP trigger failed at runtime and was deactivated by n8n, and no delivery rate is measured (G21). |
| Ops | 3 | **R5 / R6:** the one real alert lost its node, message and execution id, its e-mail failed with `ENOTFOUND smtp.gmail.com`, `SEO_ALERT_WEBHOOK_URL` is unset, and **no alert in the table has ever been recorded as delivered**. Still Mac-hosted (D25a open; the container restarted again before the write-up). D25c is fixed (a "(test)" check-in no longer satisfies the month, exec 515). |

**Better than the leaders:** a reservation-based estimate before every run, measured balances before and after, and heavy reuse of
stored data.
**What caps the area:** R9, R5 / R6, D25a, G21, G23.

---

## 3. What caps the overall score most

1. **R11 — the main deliverable still is not publishable.** The one content run of this review (exec 521) shipped 2,891 words with
   **12 placeholders after its own QA gate failed it twice**. The baseline's worst content defect (D10) was a gate that passed a bad
   page; now the gate is right and is ignored. This alone holds C9 at 3 and the content area at 5.5, and it keeps C2 / C4 at
   baseline because the missing business profile (O1, O2) is the root cause.
2. **R1 / R2 / R10 — the system still states things that are not true.** A budget-refused run leaves a ladder row at
   `status: "writing"`, so the ladder plan (exec 495), the Rank Tracker (exec 505) and the Content Cadence (exec 506) all report a
   page that does not exist — and the cadence pauses the whole weekly loop on it. The audit diff reports a "not assessed" finding as
   "new" at every run (R2, exec 513), and the full report raises a **High "not mobile-friendly" on every inspected page** out of
   Google's "no data" answer (R10, exec 523). These cap technical audit, ladders, cadence and reporting.
3. **Operations have no proven channel out.** No ops alert has ever been delivered (R6: 3 rows `delivered: pending`), the one real
   alert lost its content (R5), SMTP could not resolve, no webhook is configured, the schedules still run on a Mac that restarts
   (D25a), and the budget guard watches 2 of 10 workflows and AI money only (R9). Cost control & reliability is the weakest area
   at 5 despite D1 being genuinely fixed.

Also capping, area by area: R3 (a keyword check shipped without its topic fit), R4 (a competitor passed the outreach gate),
P34-2 residual (two stale "listed" rows reported as fact), R7 / R8, G12 / G15 / G13 / G14 / G27 / G20 (built late or still open, not
live), and the owner items that block whole features: O1/O2 (profile and facts), O4 (mailbox), O6 (IndexNow file), O7 (Search Console
links export), O8 (panel size), the Chrome UX Report API (G7).

---

## 4. Outcomes (reported, not rated)

The ratings above are capability and correctness. The outcomes on techand.ai after two weeks of fixes:

- **Rankings: none.** 15 SERP checks across 5 ladders, "nothing ranking anywhere" (exec 505).
- **Published pages: none from this system.** Six written pages wait for publication; the three URLs spot-checked
  (/erp-software-uae, /service-industry-erp-software, /e-invoicing-uae-fta) all return 404, and one of the six was never written
  (R1). The weekly cadence is paused until the owner publishes or discards them (O9).
- **AI answers: named in 0%** of 21 pulse answers (95% range 0–15.5%), pages cited 0% (exec 502); AI Growth readiness averages
  78/100 (exec 511); nothing submitted to Bing, IndexNow still `key_missing`.
- **Links: none won.** 15 qualified prospects, 8 drafted sequences, all 8 held for the owner, no mailbox connected, nothing sent
  (exec 508).
- **The site's own search data improved** (exec 515): 37 clicks vs 15 (+147%) and 5,275 impressions vs 1,422 (+271%) over 28 days,
  both statistically real, average position 31.4 → 26.6, CTR 1.05% → 0.7%. This is the site's trajectory, not an attributed result:
  nothing this system wrote is live, and the September 2026 core update sits inside the window (the report says so itself).
- **Cost of the whole re-rating: $3.79** for 21 runs (DataForSEO $2.454 measured by balance, Claude ≈ $1.33 of which $0.44 is an
  estimate), against a $4.3 budget — materially cheaper than the baseline's $4.3 for the same suite.

---

## 5. Where the evidence was not sufficient to score

- **The completion pass is written up only in summary.** `RESULTS.md` §2 and §3 cover the 2026-10-12 window; execs 517–529 appear
  only in §0b, the §1 table and the headline paragraph. So C1, C5, C8, C13, K2, K6, K7, 4A.*, 4B.* and the full report's findings
  were scored from one or two sentences each, with no per-criterion detail, no stored figures and no spot-checks. Scores for those
  criteria are deliberately conservative.
- **Four of the six new completion-pass defects are undescribed.** The headline says "six new defects … two are serious" and names
  only **R10** and **R11**; `RESULTS.md` §3.2 and `FIX_PLAN.md` §3.11 stop at R9. R12–R15 exist nowhere, so whatever they cap is
  unscored.
- **`files/` is git-ignored**, so no artefact (PDF, Word, meta.json, ledger JSON) could be independently checked. Claims were
  verified only where code could confirm the mechanism — which it did for R10 (`_page_watch.js:244` → `build_v4.py:3617`) and for
  the modelled share-of-voice method (`_rank_serp.js:17-23`).
- **Not exercised at all, so (NL) throughout:** the app UI (no owner session), `published`, the October check-in, a profile write and
  a content run that uses it, a second full report (the RDAP path itself is still unexercised — D7 passed through the cache), a live
  outreach send, and the "To reach 9" #1 requirement of running on 3+ sites. G11, G12, G29 and G30's live-page checks were deployed or
  merged after the runs.
- **RESULTS vs code:** no contradiction found. The two claims I tested against code both hold (R10's mechanism; the share-of-voice
  method text is the code's own string). `RESULTS.md` §3.1 marks several items "not exercised" that the completion pass then
  exercised (D3, D7, D17, P1-2, P34-3, P34-4, G18-1, G5, G30, G33, G8, G25); I scored those from the completion evidence, as the
  protocol requires, and flagged the write-up gap above.

---

## 6. Overall rating: 6 / 10 (was 5)

Area mean **6.15** (was 4.8). Eleven of the thirteen areas moved up, none moved down; the two that barely moved are the two that
matter most to a customer — the page the system writes (5 → 5.5) and the operations that deliver it (4 → 5, 4.5 → 5 for reporting).

What genuinely changed, on live evidence: the guards now count concurrent runs and bit when they should (D1, execs 499/500); one
site model reaches 9 of the 10 workflows that ran, so the canonical host, the business name, the real NAP and a 45-page inventory are
the same everywhere (G19); the system tells the owner to improve the page it already has instead of writing a duplicate (D11, execs
486/505/515); link farms are set aside and the one real link ranks first (D3 / G18-1, exec 529); rank readings now carry SERP
features, competitors and a modelled share of voice (G6, exec 505); discovery seeds itself from Search Console and clusters by shared
results pages (G8, exec 518); the numbers that used to be asserted are now labelled measured, modelled, uncalibrated or "not checked"
(G3, G7, G28, P34-3).

Against the named leaders the picture is unchanged in shape: breadth and honesty beat them in places (Wilson-ranged AI alerts, a link
check that overrules the index, out-of-office handling, cost before every run), while depth — daily ranks, render diffs, CI gates,
100-prompt panels, sharing, a real plagiarism index, one-click fixes — is still mid-market.

**To reach 7:** fix R11 (never ship a page its own gate failed) and R1 (no phantom pages), R10 and R2 (no false High, no false
"new"), R5 / R6 / R9 (an alert that is proven delivered, a guard that covers every workflow and real money), then re-run the content,
audit and full-report paths. **To reach 8+:** the owner items that block whole features (O1, O4, O6, O7, CrUX), deployed G12 / G29 /
G11 / G15, a panel of 100+ prompts, and the first measured outcomes — a published page that ranks, a link won, an AI answer that names
the site. None of those outcomes exists yet.
