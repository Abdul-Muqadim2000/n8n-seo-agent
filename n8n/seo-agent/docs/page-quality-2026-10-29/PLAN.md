# PLAN: pages that rank customers fastest and pass expert review (2026-10-29)

Lead architect's plan for the page-quality programme. It turns the five research files of this folder and the two of
`docs/content-quality-2026-10-27/` into one build plan for every page type Alaventra writes. Nothing here has been built, deployed or
run with paid APIs. Code anchors are at HEAD `8c0eeb46`, spot-checked on 2026-10-29, then corrected after two reviews
(`REVIEW_CODE.md`, `REVIEW_EVIDENCE.md`); the review decisions are in section 9.

Sources, cited by short name throughout:

| Short name | File |
|---|---|
| R1 | `R1_MARKET_LEADERS.md` (what the leading products and agencies gate on) |
| R2 | `R2_RANKING_EVIDENCE.md` (what ranks fast, what gets cited, the 15 generator rules in §8) |
| R3 | `R3_PAGE_TYPE_PLAYBOOK.md` (decision layer, per-type anatomy and checklists) |
| R4 | `R4_OUR_PIPELINE_AUDIT.md` (defects D1-D8 and gaps G1-G31 with file:line) |
| R5 | `R5_GRADING_AND_EVALS.md` (rubric, caps, judge panel, gold set, build gate) |
| RC | `REVIEW_CODE.md` (code review of this plan: H1-H5, M1-M9, L1-L7) |
| RE | `REVIEW_EVIDENCE.md` (evidence and SEO review of this plan: H1-H7, M1-M11, L1-L4, 16 sources re-opened) |
| CQ-R1 | `docs/content-quality-2026-10-27/R1_PIPELINE_ANALYSIS.md` (why pages came out "not ready"; built as H1-H3) |
| CQ-R2 | `docs/content-quality-2026-10-27/R2_MARKET_RESEARCH.md` (blockers vs advice, client input UX, target states) |

Client page text is not reproduced. The repo is public: every fixture made from executions 3299 / 3336 is anonymised (same structure and
meta lines, rewritten sentences) and committed, as `fixtures_ctfix2_159.json.gz` was; the raw executions stay in a git-ignored folder.

---

## 1. Diagnosis and target

### 1.1 Why we said 92 then 100 and the reviewer said 63

The page was not ruined by the writer. It was ruined before and after the writer, in three layers.

1. **We decided wrong, and did not ask.** The verdict scored "ms 365 erp" 42/100 (10 searches a month, 1 modelled visit) and said a
   page on it alone is "a poor use of effort", but `Verdict Router` stops only on `AVOID` (`build_v4.py:1111-1117`), so it was written
   [R4 D5]. The site's own coverage (the keyword is rung 2 of an existing ladder, beside a published sibling guide) was computed and then
   dropped before the verdict (`Own Coverage (Run)` -> lost at the sitemap nodes) [R4 G1]. The duplicate-page rule that later blocked the
   page (`Originality_Check.js:63-79`) needs only the keyword and the site model, so it could have run before the brief [RE M7]. Google
   showed explainers, a forum, a video and vendor pages, and one local partner service page by hand reading; we wrote a service page
   [R3 §1.5, R4 G3]. A refresh of the existing guide was the right output [R3 §1.5, R2 §2.4].
2. **We wrote with the wrong inputs and the wrong instructions.** The only facts search was the keyword with every country name stripped
   plus "statistics" (`build_v4.py:843-848`), so the UAE e-invoicing go-live (1 January 2027 for revenue of AED 50m and above; accredited
   service provider appointed by 30 October 2026, per KPMG's 22 July 2026 summary, which cites no decision number; reported as an
   extension of an original 31 July 2026 date [RE source 1, thin]) never reached the brief [R4 D7, R3 §2.3]. 9 of 10 facts were weak
   sources and two weak market figures went live after the Critic flagged them [R4 G9]. Three prompt lines cause the padding and the
   repetition: `strategy_brief.txt:91` turns every People Also Ask question into a section ("agentic ERP", "big companies"),
   `copywriter.txt:61` makes every FAQ a heading, and `copywriter.txt:72` asks for the keyword in the H1, the first sentence, two H2s and
   the last section [R3 §0.4, R4 G12, G13, RE H1]. No step owns "say each thing once", so one point appeared six times.
3. **We measured the wrong things and lost the state we had.** Our grade is structure 25, coverage 25, readability 15, specificity 10,
   clean language 10, length 15 (`Content_QA.js:761-772`). None of these measures intent fit, proof, source quality, local accuracy,
   repetition or publish errors, which is where the reviewer took 37 points off; the only component that moved 92 -> 100 was length,
   the one Google says not to aim at [R5 §1.1]. The meta description was claim-checked, emptied and then misread as
   "Slug: ms-365-erp-uae" by a regex that crossed a newline [R4 D1]; the same reader bug sits in three files (`Content_QA.js:154`,
   `Blog_Package.js:13`, `Build_WP_Draft.js:5`) [RC H4]. Finalize re-checked the final version against itself (empty context, its own word
   count as target) and dropped the page run's hard blocker (a page for the same search already exists) [R4 D3]. Answers were appended
   as fragments and a homepage slogan was offered as proof [R4 D6].

**The signal that was right was thrown away.** The Critic (Sonnet) scored the first draft 66; the reviewer scored the published page 63.
Across five runs the Critic's first-draft scores sat at 58-66 while our code grade said 91-100 [R5 §1.5]. That is n = 1 against an
external expert [RE M4], so it is a lead, not a calibration; but the LLM judge pointed the right way and the code score did not.

**What the market does differently.** The leaders do not have a better writer; they have gates around it: intent fit, information gain,
first-hand proof, named sources, factual claims, with state that travels to the end and a human approval [R1 §0.1, §6.1]. Nobody scores
proof, source quality or local accuracy in public, and nobody publishes agreement with expert reviewers [R5 §2.5]. Doing both is a
differentiator, not parity.

**What ranks fast for our customers** (small and mid-authority B2B and local businesses): improving a page that already earns impressions
beats writing a new one; only 1.74% of new URLs (6.11% of non-empty English pages) reach the top 10 within a year, 40.82% of those within
a month [R2 §2.1, Ahrefs May 2025, evidence, re-checked RE source 2]. One agency's refresh of 95 pages on **its own B2B site** moved
refreshed service pages from position 41 to 23 in 90 days while untouched pages fell (service controls -33.4%) [RE source 3, M6: one
site, analysed with an LLM, grade C-]; we use it as a direction, never as a number to quote to customers. The page type must match what
Google already shows [R2 §2.4, R3 §1]. One search, one page; Google generally shows at most two listings from one site [R2 §5, RE
source 8]. For AI citation, on-page levers are modest; branded mentions dominate (correlation 0.66-0.71 vs domain rating 0.27-0.33,
75k brands [RE source 10]), so the page plan and the Link Builder / AI Growth work are one system.

**Wave 0 must fix causes, not only this case.** Scored on the interim formula first drafted here, the same page without its duplicate URL
and with "Write it anyway" would have graded 83-92 and been "Ready" [RE §3.3]. The trigger case was stopped only by two accidents (a low
verdict score and a duplicate URL). So Wave 0 also changes the three prompt lines, makes weak-only figures a rewrite, uses a blind Critic
re-read as an interim gate, ties "Ready" to dimension floors, and keeps the fit cap after an acknowledgement (section 3).

### 1.2 Targets (measurable)

Every target has a measurement, a source of truth and the wave that should move it. Thresholds marked *our choice* are design choices to
be recalibrated on our own data after three months; none is a promise to a customer. **Gating** targets fail a wave; **reported**
targets are measured and published to the owner but never gate, because they need months of data or can be gamed by the decide layer
itself [RE L1, M5].

| # | Target | Measure | Value | Source of truth | Kind | Wave |
|---|---|---|---|---|---|---|
| T1 | Our grade agrees with experts | MAE vs adjudicated human labels, **hold-out clients** (split by client) | <= 8 points | gold set, `GRADE_PANEL_EVAL.md` [R5 §6.3, RE M4] | gating | 2 |
| T2 | No inflation | mean signed error vs humans, hold-out clients | within +/- 3 | same | gating | 2 |
| T3 | Rank order agrees | Spearman rho, overall | >= 0.7 | same | reported until n >= 30 | 2 |
| T4 | Dimension agreement | quadratic-weighted kappa per dimension | >= 0.6 | same | reported until n >= 30 | 2-6 |
| T5 | Blockers fire when they should | recall on synthetic broken variants | >= 95% | harness `S-GRADE` | gating | 0, 2 |
| T6 | Blockers do not fire when they should not | false blocks on clean bases and human-ready pages | <= 5% | harness `S-GRADE` | gating | 2 |
| T7 | Never "Ready" on a bad page | pages labelled Ready that humans score < 70 | 0 | live-run sample + client labels | gating | 0-2 |
| T8 | The techand regression stays fixed | anonymised 3336 final version; and the same with `qa_blocking` emptied and the verdict acknowledged | grade <= 70 and not ready; without blockers: grade <= 72 and not "Ready" (a dimension floor fails) | harness pins | gating | 0 |
| T9 | Pages experts rate highly | independent re-rating session score of delivered pages (R5 rubric) | median >= 75, P10 >= 65 | re-rating §5.4 | gating at the re-rating | 4 |
| T10 | Pages experts rate highly | external human reviewers, live-run sample | mean >= 75 | external reviewers | gating at the re-rating | 4 |
| T11 | We do not write what should not exist | written pages the re-rater says should have been held, merged or re-typed | 0 in the sample | re-rating | gating | 1 |
| T12 | Useful output, not homework | pages the client accepted **and** the reviewer scores >= 70 on the sample | >= 60% *our choice* | page review + re-rating sample [RE M5] | reported | 3-4 |
| T13 | Money not wasted | Claude spent on pages later blocked as duplicate or wrong type, **paired with** duplicate-detection recall >= 90% on the gold set | $0 and >= 90% | run ledger + gold set [RE M5] | gating | 0-1 |
| T14 | Fast discovery | new pages indexed within 14 days | >= 90% *our choice* | URL Inspection read 7/14/30 days | reported | 5 |
| T15 | Early traction | new pages with impressions within 30 days, **with the hold rate beside it** | >= 80% *our choice* | Search Console | reported | 5 |
| T16 | Time to first top-20 | median days from publish, **with the hold rate and the outcome of offered alternatives beside it** | <= 90 days *our choice* | Rank Tracker | reported | 5 |
| T17 | Time to first top-10 | share reaching top 10 within 180 days, hold rate beside it | >= 20% *our choice* (web baseline 6.11% in a year [R2 §2.1]) | Rank Tracker | reported | 5 |
| T18 | Refreshes work | median position gain at 90 days vs a **randomised hold-back** (one in four eligible refresh candidates waits 90 days) | >= 10 positions *our choice*, no external anchor [RE M6] | Rank Tracker | reported | 5 |

T14-T18 need a baseline first: Wave 5 measures the pages already published (techand.ai has several) before the targets are fixed. The
randomised hold-back for T18 exists because refresh triggers pick decaying or striking-distance pages, which drift back toward their mean
on their own [RE M5]. Promising "page one in N weeks" is not supported by any data and Google calls guarantees a red flag [R1 §8, R2 §4];
we promise execution speed, checks and measured bands.

---

## 2. The target pipeline

Fifteen stages. For each: what it does, what changes against today, the files, and the research behind it. The wave column says when.

```
decide -> research -> proof -> brief (per type) -> write -> deterministic checks -> judge -> targeted fixes
       -> honest grade -> client review / finalize -> publish -> live-page check -> index -> measure -> refresh
```

**Build-file note [RC H5].** *Parse Verdict*, *Parse Brief*, *Parse Analysis* and *Normalize Input* are v3 export nodes changed only by
anchored `patch()` calls in `build_v4.py` (Parse Verdict alone at `:867`, `:2774-2776`, `:3232-3234`, `:5457-5485`, `:8095-8097`). There
is no `v5/code/Parse_Verdict.js` today. A pre-Wave-0 orchestrator commit extracts *Parse Verdict* to `v5/code/Parse_Verdict.js` with
`setcode()` and re-anchors the patch groups (section 3.0). Every reference to `Parse_Verdict.js` below means that extracted file. Every
other change to a v3 node is a **new numbered build section appended at the end of `build_v4.py`**, never an edit of an earlier
section in place.

### 2.1 Decide: should we write at all, update or new, which page type

Output: one **decision record** per request, before any Opus call:
`{action: write_new | refresh <url> | merge_into <url> | section_in <url> | hold, page_type, target_keyword, confidence, reasons[], alternatives[]}`.

| Check | Today | Change | Files | Evidence | Wave |
|---|---|---|---|---|---|
| Value gate | `Verdict Router` stops only on AVOID; cadence and ladders send `force_content: true` which bypasses even that | *Parse Verdict* computes `verdict_hold` (boolean) and `hold_reason`; the router reads `$json.verdict_hold`. Hold when `verdict_score < 50` with no `hold_ack`. **Exempt**: page role `case_study`, AI answer pages (`ai_target` set), refresh runs of an own URL (`existing_page_url` set), ladder rungs spawned from a ladder whose head term passed the verdict (`Spawn_Page_Runs.js:28`, `Tracker_Report.js:253`, the app's ladder "Write now" `payload.ts:143`). A null score (`NOT_CHECKED`, `score_withheld`) is "not checked": no hold, reason printed. Automatic sources (cadence) run in **shadow mode** (`would_hold` logged only) for two cadence cycles, then switch on (owner D17) | `Parse_Verdict.js`, `build_v4.py` router, `Cadence_Plan.js` + `cadence.ts` | R4 D5, RC H1, R3 §1.3 rule 1, R2 rule 3 | 0 |
| Duplicate before the brief | the duplicate is found after writing by `Originality_Check.js:63-79` | the same rule (keyword tokens vs site model page titles, H1s and slugs, share >= 75%) moves into a kit `DUP.targets(keyword, model)` called before the brief; a hit holds with "improve <url> instead" and the same hold mechanism, exemptions and shadow mode as the value gate. The late check stays as a safety net | new `v5/code/_dup_targets.js`, `Originality_Check.js` (calls the kit), `Parse_Verdict.js` | RE M7, R4 G4 | 0 |
| Own coverage reaches the verdict | computed by *Own Coverage (Run)*, dropped by the sitemap nodes; `own_coverage_checked: false` | *Parse Verdict* and the Verdict Agent read `$('Own Coverage (Run)').first().json`; `lineage_lint.py` gains a "field reaches its named reader along main" rule | `Parse_Verdict.js`, `verdict.txt:14`, `lineage_lint.py` | R4 G1 | 1 |
| Cannibalisation, full | title tokens only | kit `OWN.cannibal(keyword)` extends `DUP.targets`: own URL with Search Console impressions for the query or a close variant (`seo_query_history`), own URL in the top 30 of the SERP already bought, ladder rungs and drafts (the app's "Check this first" counts `not_ready` drafts). Outcome: refresh / merge / no conflict | new `v5/code/_cannibal.js`, `Own_Coverage_Run.js`, `_verdict_existing.js`, `keywordChecks.ts` | R4 G4, R2 §5 and rule 1, R3 §1.4 | 1 |
| Page type from the SERP | form value or "Service Page" default (`Cadence_Plan.js:360`); `KWI.serpPageTypes` (`_kw_inputs.js:251-300`) runs in the Keyword Check, Keyword Strategy and Ladder nodes only, **not** in the content run; it lumps vendor product pages and software directories into "service or product" | Wave 0 records `serp_shapes` in the content run (no cap). Wave 1 adds the shapes of R3 §1.2 (vendor official, directory, reference, glossary, video, case study, location, news) with a small per-topic vendor domain list and software listing domains as directories; the fit rule counts **provider service pages from businesses comparable to the client**; requested type with <= 3 of 10 comparable pages -> hold and propose the dominant type (>= 5 of 10) or a section in an existing page. Ladders and cadence choose the type instead of noting it. Every SERP rule is tested on the **stored real SERP of 3299** and two other stored SERPs, at the "3 of 10" boundary | `_kw_inputs.js:251-300`, *Parse Analysis* patch (appended section), `Ladder_Plan.js:282-293`, `Cadence_Plan.js:360` + `cadence.ts` | R3 §1.1-1.3, R4 G3, RE H4 [replay: our classifier counts 3 service pages of 10 on 3299's SERP, 1 by hand] | 0 (record), 1 (rule) |
| Update before new | the duplicate is a late blocker that Finalize dropped | a conflict routes the request to **refresh** of that URL (minimal refresh brief block of R3 §3.13, pulled forward from Wave 4), or to **merge** with a 301 proposal, never a silent new page | `_cannibal.js`, `Need Content?` routing (appended section), refresh brief block | R3 §1.4, §3.13, R2 §2.2, R1 §2.1, RE H7 | 1 |
| Structured re-target | verdict advice is free text ("use ms 365 erp as a secondary term") that the brief ignores | verdict returns `target_keyword`, `page_type`, `target_url`, `merge_into`; a difference from the request is a hold; accepted fields drive the brief | `verdict.txt`, `Parse_Verdict.js`, `strategy_brief.txt:5` | R4 G2 | 1 |
| Ladder hygiene | one intent can get four rungs; a form run for a rung loses the ladder | a rung needs its own results page (< 3 of top 7 shared with a sibling) and a demand floor, else it becomes a supporting keyword; a form request matching a rung adopts the rung's fields | `Ladder_Plan.js`, Normalize Input patch (appended section) | R4 G5, G6 | 1 |
| No invented asks | verdict asks for "a budget table from your own projects" with nothing on file | `PF.contract` printed in `verdict.txt`; asks for proof that is not on file become client questions | `verdict.txt`, `Parse_Verdict.js` | R4 G7 | 1 |
| Inbound links | the content run already proposes inbound picks (`meta.inbound_links`; in 3299 the pick was the duplicate guide itself) but nobody acts on them | Wave 1: inbound suggestions exclude pages that serve the same search, are shown in page review and the publish checklist as "add these links when you publish" (no CMS write); Wave 5: CMS update after approval | `meta.inbound_links` producer, page review panel | RE M11, R2 rule 12 | 1, 5 |

### 2.2 Research: facts, local regulation, primary sources

| Check | Today | Change | Files | Evidence | Wave |
|---|---|---|---|---|---|
| Market regulation | none; country names stripped from the one facts query | **Regulatory facts step** (Fix 6). Each fact carries `{date, obligation, subject, threshold, url, paragraph, source_tier, source_date, as_of, supersedes, status: upcoming / passed / in_force}`, the status computed against the publish date; an amendment search ("amended", "extended", "postponed" + topic) runs beside the deadline search and the latest dated source wins. When no official text can be read (PDF in Arabic, script-rendered, bot wall), a **second tier**: two independent secondary sources (Big Four, law firms, government press) that agree, labelled in the page as reported by them; never one secondary source | new `v5/data/regulators.json`, `Regulatory_Plan.js`, `Collect_Regulatory_Facts.js`, appended build section | R4 D7, R3 §2.3, R2 rule 6, RE H5 | 0 |
| Source quality | 9 of 10 facts weak; evidence plan keeps weak market figures | Wave 0: a market, adoption, cost or compliance figure whose only attribution is weak is a soft blocker whose action is "rewrite the sentence without the number" (Fix 3b). Wave 3: *Parse Brief* drops weak-tier sources for those figures; source classes regulator / vendor docs / independent study / aggregator / competitor; a research / press facts query | `_page_fix.js` (`PF.classify`), `Collect_Facts.js`, Parse Brief patch, `_sources.js` | R4 G9, R1 §11 #8, R5 C1, RE H1 | 0, 3 |
| Claim verification queries | bag-of-words queries; chrome-only "evidence" accepted | templates per claim type (product capability -> `site:learn.microsoft.com ...`; regulation -> regulator domains); evidence must be a paragraph with the claim's key terms after stripping navigation | `Page_Source_Plan.js:20-24`, `Page_Source_Candidates.js` | R4 G10 | 3 |
| Client's own site | 3 pages, 1,800 characters each, service pages by title only | read top 4-6 own pages by topic score plus the matching service page; give the brief a digest (claims, dates, phases) and feed the claim corpus | `Collect_Client_Pages.js`, `Brief_Context.js`, `_promise_judge.js` (`PJ.ownText`) | R4 G11, CQ-R1 §3.3 | 3 |
| Length band | page-type fallback when < 3 pages; band from mixed shapes | band measured on same-shape SERP pages only; advice, never a gate | Parse Analysis patch, `Content_QA.js` | R3 §0.6, R5 §3.4, CQ-R2 §3.2 | 4 |

### 2.3 Proof capture from the client: asked before writing when it matters, stored once

| Check | Today | Change | Files | Evidence | Wave |
|---|---|---|---|---|---|
| Proof ledger | statements typed only by the claim check after writing | every statement kind declared before writing: client fact / market or product fact / advice [R3 §2.1]; the brief knows which client facts exist and the writer may not state others | `strategy_brief.txt`, `copywriter.txt`, `Brief_Context.js`, `_page_fix.js` (`PF.contract`) | R3 §2.1, R1 §4.4, CQ-R2 §6.2 | 3 |
| Ask before writing for proof types | questions only after writing | service, location, case study, pricing, comparison and industry pages check the type's proof minimum (R3 §3 (c)) **before** the brief; if missing, one screen of 3-5 prefilled questions with "leave it general" (except case study / location core facts), status `needs_your_facts`; the screen also asks for 2-3 real photos or a process diagram; general types write first and ask "make it stronger" after | new pre-brief readiness node, app `readiness.ts`, `pipeline.ts` (Needs you) | CQ-R2 §6.1, §6.4, R3 §3.1 (c), §3.2 (c), RE M10 | 3 |
| Typed fact store | any "yes" or typed answer becomes a business fact, typos and CTA lines included | normalised typed facts (`category`, `value`, `source`, `date`, `who`); CTA and meta sentences never stored; a proof answer without a project, client, number or link is stored as "no proof yet"; proper nouns checked against the site's own text; the Business details screen lists every fact with its source for review | `app/shared/src/page-review.ts` (`factOf`, `factsForEngine`), `v5/code/_fact_answers.js` (the two change together), `seo_sites.fact_answers_json` | R4 G16 | 3 |
| Slogans are not proof | `PF.prefillOf` accepts any sentence sharing half the words, either direction | Fix 5.4 | `_page_fix.js:469-475`, `Page_Candidates.js:73-75`, `page-review.ts:280-283` | R4 D6, R3 §2.1, R1 §4.4 | 0 |
| E-E-A-T people | team byline, reviewer without title | service, comparison, industry and local pages need a named person with role and profile URL (author or reviewer); a team is Organization, not Person; an **author page generator** writes the profile page when the client has none | `Content_QA.js` schema, readiness, new author page mode | R4 G30, R2 rule 11, RE M10 | 3 |

### 2.4 Brief per page type

| Check | Today | Change | Files | Evidence | Wave |
|---|---|---|---|---|---|
| Padding and repetition causes | `strategy_brief.txt:91` "reuse the People Also Ask questions"; `copywriter.txt:61` every FAQ a heading; `copywriter.txt:72` keyword in H1, first sentence, two H2s and last section | **Wave 0 (Fix 3b)**: PAA questions are evidence of reader needs, not an outline: use only the ones about the same reading of the search, at most 4 question headings on a guide, 3-5 FAQs on service / location / pricing, none on a case study; FAQs are not headings by default; keyword in H1, first sentence and last section (H2s optional); "each point has one home: state it once in its owning section, later sections may link back, not restate" | `strategy_brief.txt:91`, `copywriter.txt:61, 72` | R3 §2.2, R4 G12, G13, RE H1 | 0 |
| PAA classification | none | Wave 4: classify each PAA question (same reading / other reading / other buyer) in code before the brief; the brief assigns each proposition and each list one owning section | `strategy_brief.txt`, Parse Analysis patch | R3 §2.2, R1 §5, R2 rule 8 | 4 |
| Page types | 8 types; comparison, FAQ, glossary, listicle collapse to Guide (`_page_type.js:7-14`) | add Comparison Page, Pricing Page, **Industry / vertical page**, Location Page (distinct from Service + location), Answer Page, Glossary, Listicle, Refresh as real types, in the form, `shared/src/schemas.ts`, `payload.ts` (keep key order), harness S23 | `_page_type.js`, `app/shared/src/schemas.ts`, `payload.ts` | R3 §5.4, RE M10 | 4 |
| Type blocks | blocks for hub, case study, local only (`Brief_Context.js:146-155`) | one block per type from R3 §3 (b) structure, (c) proof minimum, (d) length, (f) linking role, (g) failures | `Brief_Context.js`, `strategy_brief.txt` | R3 §3.1-3.13 | 4 |
| Regulatory facts block | none | REGULATORY FACTS with the rule: a page on a regulated topic states the current timeline from the pack, with its status (upcoming / passed / in force) and source, or says none could be confirmed; dates never come from model memory | `strategy_brief.txt`, `copywriter.txt` (read `$('Collect Regulatory Facts').first().json` in try/catch) | R4 D7, RE H5 | 0 |
| Client questions with slots | `questions_for_client` are `string[]`, fixed by the brief's output schema (`build_v4.py:12610`) | `{question, section, category}`; category decides the home (terms -> CTA; credential -> partner / why-us section; proof -> proof block; detail -> the named section); both string and object items accepted for one release (stored briefs are strings) | appended patch to `_sb151` (`build_v4.py:12610`), `Page_Candidates.js:77`, `_page_fix.js` (`PF.questions`) | R4 D6, RC M4 | 0 |
| Language | English only | owner decision D15 on Arabic or bilingual pages for UAE and KSA clients | - | RE M10 | 4 |

### 2.5 Write

Copywriter (Opus) stays. Changes are in what it is given, not the model: the decision record, the type block, the proof ledger, the
regulatory facts, one home per proposition, the intent-filtered questions. The instructions that create padding and repetition change in
Wave 0 (section 2.4). No `[Author insight:]` brackets (already removed by H1-H3, keep it that way) [CQ-R1 §6 rec 3]. Do not write a
separate "LLM version" or chunked text [R2 §1, rule 7].

### 2.6 Deterministic checks (code, no model)

New kit **`v5/code/_grade.js`** (one rule, inlined by `build_v4.py` into *Content QA*, *Page Candidates* and, through `build_monitors.py`
(`_FIN_KITS`, `:1150`), the Finalize workflow, as `_page_fix.js` is today). Pure regex and token code (no `URL`, no
`Object.defineProperty`, no `structuredClone` in the n8n sandbox) [R4 §6].

**Where each item runs [RC H3].** Content QA runs before *Outbound Link Check*, *Originality Check* and `PF.classify`, so it computes only
the **page-local** items (repetition, list labels, weak-only figures, splices, the verdict band read from *Parse Brief*). Every cap that
depends on blockers or the duplicate page is applied by one function, `GR.cap(grade, cls)`, where the grade object is built:
`Page_Candidates.js:81-84` and `Finalize_Verdict.js:47-48`.

| Item | Rule | Role | Evidence | Wave |
|---|---|---|---|---|
| Meta fields | each of Title / Meta Description / Slug parsed per line with `^(label):[ \t]*(.*)$`; description missing, under 70 characters, multi-line or starting with a field label is rebuilt by `PF.meta` (target 120-155), blocker only if the rebuild fails; advice outside 120-160 | auto-fix / block | R4 D1, R5 F1, R3 §2.5, R2 rule 9, RC H4 | 0 |
| Repetition | sentences sharing >= 60% content words (keyword and brand removed, `_shingle.js` shingles) clustered across sections; a cluster of 3+ outside the Quick answer is a problem; 4+ caps structure at 50% | points + cap | R4 G12, R5 E2, R3 §2.4 | 0 |
| List-label collision | the same label ("five questions") on two different lists; a closing reference to a list that is not unique | points | R5 E3 | 0 |
| Source quality | counted on **in-text attributions** ("according to X", "as reported by X", "X found", "X's report") and on every figure, linked or not; a figure with no tier 1-4 attribution fails; share of attributions from tiers 1-4 >= 60% | points + cap + soft blocker (weak-only market / compliance figure) | R5 C1, R4 G9, RE M2 | 0 (attributions, weak-only), 3 (tier classes) |
| Keyword fit | verdict band (>= 50 full, 30-49 partial, < 30 none, null "not checked" with full points and a note); an acknowledgement changes the status path, **never the points**; unresolved duplicate page. SERP share is recorded only until Wave 1 | points + caps | R5 B1-B3, §3.3, RE H3, H4, RC L5 | 0 |
| Official source for regulated claims | a regulated claim links an official domain from `regulators.json` or the two-source secondary tier; a must-mention fact missing caps accuracy | points + cap | R5 D2, D1, RE H5 | 2 |
| Splice / fragment | sentence starting lower-case, no end punctuation, repeating the last 4 words of the previous one; a sentence inserted by Finalize into a paragraph sharing < 20% of its content words; a heading that ends with a period or is a first-person claim; a first-person business sentence whose content words are absent from its paragraph | block in Finalize; points elsewhere | R5 F3, R4 D6, RE L3 | 0 (Finalize + heading rules), 2 (all versions) |
| Existing gates | cut-off, unsupported client claims, figures not in source, dead links, brackets, originality, brand form | unchanged | CQ-R1 §6 | - |

### 2.7 Judge

Today the Critic (Sonnet) judges the first draft once, works blind (no client pages, `site_description` null) and gates nothing [R4 G14,
R5 §1.3]. Target:

- **Wave 0, interim gate (Fix 3b)**: the Critic prompt re-reads the **delivered candidate** once more (Sonnet, about $0.05), without the
  editor's history; each unresolved high-severity problem is a soft blocker. It shares the steering prompt, so it can be gamed by the
  editor learning it; it is an interim measure until the separate grade judge of Wave 2 [R5 §5.5, RE H1].
- **Critic stays** as the editor's steering tool, now informed (client pages read, `site_urls`, the length band, the claim rule) and with
  rubric lines for repetition, page-type fit, duplicates and local accuracy (`critic.txt`). It reads context via
  `$('Parse Brief').first().json`, never `$json` (an AI Agent node outputs only `{output}`). Wave 2.
- **Wave 2, one grade judge first [RE L1]**: a single reference-guided Sonnet 5.5 checklist judge ("senior SEO editor in {country}")
  that judges only the delivered candidate and the final version and never steers the editor. Haiku for the narrow items (A1, A5, E2
  list, E3, F3 confirm, C5) only if it measurably agrees with Sonnet on the gold set. A second seat (Opus at low effort with a different
  persona) is added only when the gold set shows judge variance or bias; a cross-family seat is Wave 6 and an owner decision.
- **Reference-guided**: the judge gets the page with meta lines, page type, keyword, country, the verdict summary, a SERP digest, business
  and own-site facts, the regulatory fact pack with sources, and the type's checklist. It does **not** get our score, the Critic's
  output, the writer prompts or "confirmed" labels [R5 §5.1].
- **Structured output** per item `{id, result: pass | partial | fail, quote, why}`; partial credit 0 / 0.5 / 1 [RE M3]; no forced tool
  choice and no `temperature` on Opus 5.5 / Sonnet 5.5 [R5 §9, RE source 16]. Confirm the model ids and both API rules with the
  `claude-api` reference and one free `count_tokens` call before W2-C, and check what n8n's Anthropic node sends [RC L3].
- **Quotes verified in code** (normalised substring of the page); an unverifiable quote turns the item into "not shown". A refused
  (`stop_reason: "refusal"`) or unparsable judge answer is "not graded" for its items, never a pass [RE L2].
- Prompt `v5/prompts/grade_j1.txt`; nodes after *Page Candidates* and in Finalize; Haiku 5.5 added to `_cost_cal.js` (it lists Haiku 4.5
  only, line 40) with any unknown id priced `UNKNOWN` until confirmed [R5 §5.2, RC L3].

### 2.8 Targeted fixes

| Check | Today | Change | Files | Evidence | Wave |
|---|---|---|---|---|---|
| Weak-only figures and Critic highs | Critic high problems weigh nothing; weak sources 0.25 | soft blockers with a rewrite action (Fix 3b) | `_page_fix.js` (`PF.classify`) | RE H1 | 0 |
| Candidate rule | length distance against a 2-page band decided the winner | length counts only with >= 3 same-type ranking pages and only outside the band; repetition clusters count | `_page_fix.js:277-346` (`PF.classify`, `PF.better`) | R4 G18 | 2 |
| Per-section accept | one failed edit ends editing; whole edit discarded for one section | a section replaces the old one if its own problems fall and no protected property is lost; a second round when the problem set changed | `Page_Candidates.js:117-118`, `Edit_Check.js` | R4 G19, CQ-R1 §6 rec 2 | 2 |
| Head fields | out of the editor's reach | `PF.meta` deterministic rebuild (Fix 1), a head-only job later | `_page_fix.js` (`PF.fix` step c, `PF.plan`) | R4 G20 | 0 (meta), 2 |
| Sources for edits | editor guesses URLs | edits may cite only URLs fetched and verified by the source step | `Page_Source_Plan.js`, `editor.txt` | CQ-R1 §6 rec 7 | 3 |

### 2.9 Honest grade

Replace the six-component content score with the reviewer's six dimensions (usefulness, fit with what ranks, proof and trust, local
accuracy, structure, ready to publish), each split into items owned by code, a judge or a judge with a reference [R5 §3.1]; page-type
weights [R5 §3.2]; caps [R5 §3.3]; partial credit per judge item.

One rule set, reconciling R3 §4.1, R5 §3.3 and both reviews:
- **Caps are shares of their dimension** so page-type weights cannot break them [RE M1]: verdict < 50: fit <= 40%; same-search page not
  an update: fit <= 30%; requested type with <= 3 of 10 comparable pages (Wave 1): fit <= 50%; regulated claim without an official or
  two-source secondary source: accuracy <= 60%; weak-sourced compliance figure: proof <= 53%; an idea stated 4+ times: structure <= 50%.
  `S-GRADE` tests one page under two type weightings.
- An acknowledgement ("Write it anyway") changes the status path, never a cap [RE H3].
- Any open blocker -> total <= 59 and status `not_ready`.
- A gap only the client can close (proof minimum, local facts) -> total <= 70 and status `needs_your_facts`.
- **Ready needs three things [RE H2]**: no blocker; every dimension at or above 50% of its weight, except fit after an explicit
  acknowledgement (shown as "your choice: low search demand", the cap kept in the number); and, once T1 / T2 hold on hold-out clients,
  a total >= 70. Otherwise "Needs work: <dimension>" with the failing items. Floors are per dimension, so they are not the single-score
  gate section 7.3 rejects.
- Displayed maximum "95+", never 100 (cosmetic; not counted as a fix) [R5 §7 rule 4, RE L4].
- Length leaves the grade (advice only); term coverage and keyword counts move into a few points of usefulness and structure [R5 §3.4].
- **Bands until calibrated [RE M3]**: from Wave 2 the six dimensions show "strong / fair / weak" and no total until
  `GRADE_PANEL_EVAL.md` shows MAE <= 8 on hold-out clients; no isotonic map below 30 labels (identity plus bands). The plan's own rubric
  scored the published page about 43 against the human 63 [RE §3.2]: it deflates, and calibration on about 12 versions from one client
  cannot repair that.

Shown to the client as two separate answers, "Can I publish this?" (blockers and floors) and "How good is it?" (six bars, each tagged
"checked by rules", "judged by an AI reviewer" or "needs your input", ranges where items are partial), tied to one version by a Markdown
hash, "out of date, check again" after any edit, no first-draft score beside it, the same grade in the PDF (`build_v4.py:892`, the Build
Word File content-score patch) and the app [R5 §7, RC L1]. Calibration is claimed only once measured.

Wave 0 ships the interim deterministic version (section 3, Fix 3, with a number on one scale out of 100); Wave 2 ships the full rubric,
the judge and the bands.

### 2.10 Client review and Finalize

| Check | Today | Change | Files | Evidence | Wave |
|---|---|---|---|---|---|
| State travels | Finalize builds an empty context (`Finalize_Parse_Brief.js:97-100`) and ignores the page run's blockers (`Finalize_Verdict.js:23-28`); the app sends none (`page-review.ts:360-399`) | the **page-run context** (section 3.0) travels, split into gating and grading fields: gating fields come from every stored report today; a missing grading field is "not checked: <field>" advice and never blocks Ready; the PRC always comes from the **original** content report (`o.original`), and `finalReportPayload` copies it through | `Finalize_Parse_Brief.js`, `Finalize_Verdict.js`, `page-review.ts` (`finalizeBody`), `pageReview.ts`, Build Webhook Response patch | R4 D3, RC H2, R1 §6.1 | 0 |
| Weaving | `sectionFor` by word overlap; `Finalize_Merge.js:38-41` appends confirmed sentences as paragraphs | slots by question category; the editor rewrites the named host sentence; an appended standalone sentence is refused; an unplaced answer is reported "not placed: tell us where" | `Finalize_Apply.js:46-51, 76-82`, `Finalize_Merge.js:28-42`, `finalize_editor.txt` | R4 D6, R1 §4.4 | 0 |
| Removed claims | a guessed "neutral" sentence (`PF.neutralIn`) became a wrong-place splice | `removed` claims get `neutral: ''`, `in_page: 'left_out'` and an anchor (section id + previous sentence); a "yes" is restored at that anchor only | `Page_Candidates.js:69-71`, `_page_fix.js:477`, `Finalize_Apply.js:65` | R4 G15 | 0 |
| Head answers | a meta claim became body question q4 | questions carry `where`; head claims never become questions; in old reports, Finalize ignores an answer whose `original` equals a head line, so a "yes" is never woven into the body | `_page_fix.js:481`, `Finalize_Apply.js` | R4 D2, RC L2 | 0 |
| Meta on the final version | Finalize never runs `PF.fix`; the app sends the stored broken meta back | `PF.meta` called in `Finalize_Parse_Brief.js` after the head is built; `finalizeBody` drops a description that starts with a field label or is under 70 characters; `pageReview.ts` repairs old reports at read time ("meta description missing: we will write one") | `_page_fix.js`, `Finalize_Parse_Brief.js:84`, `page-review.ts:392`, `pageReview.ts:385` | RC H4 | 0 |
| Publish over a duplicate | no executor for "publish as an update" | Finalize records the decision and sets `target_url` / slug in the meta; the app offers "Rewrite as an update of <url>", which starts a normal keyword run with `existing_page_url`, quoted and charged as a page | `Finalize_Verdict.js`, app page review | RC M8 | 0 |
| Files | Markdown only; no rows in `files` | Fix 7: HTML, Markdown, meta.json and the original images in Wave 0 (app side); PDF through Gotenberg in Wave 0 if it fits the time limits; Word in Wave 2 | `pageReview.ts` (`runFinalize`), `files.ts:94-96` (`extractFiles`), `build_monitors.py` Finalize section | R4 D8, RC M7 | 0, 2 |
| Spelling | stored style guide (British) contradicts the site (13 US vs 3 UK forms) | detect the site's variant from its pages; show a mismatch on the style guide screen and in page review | `_style_guide.js:15, 71-78` | R4 G28 | 3 |

### 2.11 Publish

Today: CMS publishing (WordPress, Webflow, Contentful, signed webhook) and the Publish Check exist. Changes:
- **Schema per type** [R3 §2.6]: no FAQPage (rich result gone since 7 May 2026, documentation removed 15 June 2026 [RE source 4]), no
  HowTo, no self-serving ratings; LocalBusiness only with a real address; Service with `areaServed` otherwise; structured data matches
  visible text. Files: `Content_QA.js` section 16. Wave 4.
- **Internal links in and out**: suggestions shown from Wave 1 (section 2.1); a CMS update of the hub and two related pages after
  approval in Wave 5, descriptive anchors that vary; the new page links to the relevant service page and its primary sources
  [R2 rule 12, §6.1].
- **Dates**: visible "Updated" date on guides, comparison, pricing, listicle and answer pages; `dateModified` only on substantive change
  [R3 §2.7, R2 rule 11]. Wave 4.
- **Volume and purpose guards** [RE M9]: a location page needs a real presence in that place (address, staff, or named projects there)
  or a materially different offer, else hold; per-site monthly caps on new AI-written pages per type and a cap on new AI-written URLs in
  90 days as a share of the site's indexed pages (owner decision D14, *our choice* to tune); every new page names a human reviewer on the
  client side before publish. Wave 4.

### 2.12 Live-page check

The client's developers rebuilt our final version inside their own site (FAQPage markup added, our Service schema dropped, a generic
`og:description`, an answer turned into a banner heading) [RE H6]. Reviewers, other LLMs and Google judge the live page. The Publish Check
fetches the live URL, diffs it against the final version (headings, CTA lines, external links, meta / og tags, JSON-LD types), runs the
deterministic grade items on it and reports the differences to the client. The §5.4 re-rating grades the live page. Wave 2 [RE M8].

### 2.13 Index

Accurate sitemap `lastmod`; IndexNow / Bing submission per published page (the AI Growth machinery exists); robots / CDN access for
Googlebot, Bingbot, OAI-SearchBot (crawler check exists); a URL Inspection read at 7, 14 and 30 days; "crawled, not indexed" reported as a
quality signal, not a resubmit task. The Indexing API is for job postings and livestreams only and is **not** used [R2 §6.2, rule 13].
Requesting indexing stays a manual step for the client (a site task, using the "Steps on your website" flow). Wave 5.

### 2.14 Measure

A page outcome record at 7 / 30 / 90 / 180 days: indexed, impressions, clicks, position, AI citations, against the site's untouched pages
as a control (the Link Builder impact model `seo_link_impact` is the pattern), plus the randomised refresh hold-back for T18. At about six
months without top-10 movement: improve or merge [R2 §4, rule 15]. New table `seo_page_outcomes` through `ladder_common.py` +
`sync_tables.py`. The hold rate and what happened to the alternatives offered for held keywords are reported beside T15-T17. Reports use
the honest language of R1 §8: speed of execution, checks, measured bands, no positions promised. Wave 5.

### 2.15 Refresh

Refresh becomes a first-class type: start from the live page, keep the URL and every section that earns Search Console queries, remove
off-intent sections, update facts and regulatory dates with sources, add missing proof, fold in weaker overlapping pages with a 301
proposal, change summary for the client [R3 §3.13]. The minimal refresh brief block (keep URL, keep earning sections, update facts, change
summary) is pulled forward to Wave 1 so update-vs-new routing has somewhere to go [RE H7]; the full type is Wave 4. Triggers in the
Content Cadence: year-on-year decay (Poisson test exists), striking distance (positions 4-20 with impressions, *our choice*), a regulation
change (`regulators.json` freshness or a fact's status turning `passed`), a SERP type change [R1 §7, R2 §2.3]. `Cadence_Plan.js` and
`app/server/src/services/cadence.ts` change together. Wave 5 (triggers).

---

## 3. Wave 0: the seven owner-approved fixes, done so they fix causes

Scope is the owner's seven items. Fix 3 is widened to "Fix 3 and 3b" because the reviews showed that scoring repetition and weak sources
without removing their causes leaves a 63-quality page "Ready" whenever there is no duplicate URL [RE H1, H2, §3.3]; every 3b item serves
the owner's words "so it can't say 100 on a page like this". Each fix: file:line (HEAD `8c0eeb46`), the fix, the acceptance test.

### 3.0 Orchestrator steps before any agent starts

1. **Extract *Parse Verdict*** to `v5/code/Parse_Verdict.js` with `setcode()`, re-anchoring the patch groups at `build_v4.py:867`,
   `:2774-2776`, `:3232-3234`, `:5457-5485`, `:8095-8097`. Acceptance: the rebuilt workflow JSON is **byte-identical** (node ids are
   `uuid5(workflow:node)` since B-F5), harness count unchanged. One commit [RC H5].
2. **Write the page-run context (PRC) contract** as a note in `harness/README.md` plus an anonymised fixture
   `harness/fixtures/prc_example.json`:
   - **gating** fields, present in every stored content report today (3299's callback carries them): `qa_blocking[]`,
     `meta.originality.duplicate_targets[]`, `verdict` / `score` / `score_withheld`, `meta.page_type`, plus the new `verdict.acknowledged`;
   - **grading** fields, added by a patch to *Build Webhook Response* (W0-B): `length_band`, `coverage_target`, `terms[]`, `facts[]`,
     `sources_cited[]`, `style_guide`, `site_urls[]`, `serp_shapes`, `regulatory_facts[]`, `content_request_id`.
   The app derives gating fields from the stored payload for old and new reports alike; there is no `seo_content_log` fallback (its
   `LOG_COLS` hold none of these) [RC H2].
3. **Free read of the last 30 production page runs**: `verdict_score`, `force_content`, `pipeline_source`, page role, how many would hold
   under section 2.1's rule with its exemptions, how many would hit `DUP.targets` before the brief. Decides the shadow-mode length (D17)
   [RC H1].
4. **Commit anonymised replay fixtures** of 3299 (Page Fix -> Content QA -> Page Candidates -> Blog Package chain) and 3336 (the
   finalize webhook body), and recorded Finalize Editor answers, so every replay runs in CI [RC M9].
5. **Tell techand.ai the e-invoicing timeline by hand today** (section 8): the Phase 1 provider deadline is 30 October 2026, tomorrow
   [RE H5].

### Fix 1. Never run the claim check on the meta description, and fix the meta reader

- **Where**: `_claims.js:304-305` pushes the meta line as a claim item (`kind: 'meta'`); `_page_fix.js:119` `removeAt` on a META line
  removes only the span, leaving `Meta Description:` empty, and `PF.neutralSentence`'s `cta` and `reword` paths can also touch it;
  `Content_QA.js:154` (`metaOf`), `Blog_Package.js:13` (`metaRe`) and `Build_WP_Draft.js:5` use `:\s*(.+)$` with the `m` flag, so `\s*`
  crosses the newline and the value becomes the next line; knock-on at `Blog_Package.js:48, 214, 219, 260` and the Service schema
  description `Content_QA.js:847, 852`. Finalize never runs `PF.fix`, and the app sends the stored broken meta back
  (`page-review.ts:392`, `pageReview.ts:385`, written as a head line at `Finalize_Parse_Brief.js:84`) [R4 D1, G27, RC H4].
- **Fix**:
  1. `_claims.js:304-305`: skip the meta line like `Title:` / `Slug:`. Keep one narrow **field check** (not the claim check): a
     description naming a price, guarantee, timeline or number not on file has that clause dropped deterministically. Google expects
     the description to be reviewed too, so this narrow check stays [R2 rule 9 note, RE source 5].
  2. All three readers: `^(label):[ \t]*(.*)$`; an empty value is empty, never the next line (`_page_fix.js:199` already does this).
  3. `removeAt` and both `neutralSentence` paths never edit a META line.
  4. New kit function `PF.meta(md, ctx)`: a description missing, under 70 characters, multi-line or starting with a field label is
     rebuilt from the brief's `meta_description` if it passes the field check, else from the Quick answer's first sentence trimmed to
     120-155 characters with the keyword. Called from `PF.fix` step c (`_page_fix.js:199-210`) **and** from `Finalize_Parse_Brief.js`
     after the head is built.
  5. `Content_QA.js:761`: replace `metaDesc.length <= 155` with the field rule; a failure `PF.meta` cannot repair is a **publish error**
     (blocking), not a 0.25 advisory [R4 G22].
  6. `PF.questions` (`_page_fix.js:481`): questions carry `where`; a head claim never becomes a client question [R4 D2].
  7. App: `finalizeBody` drops a label-prefixed or under-70-character description; `pageReview.ts` repairs old reports at read time.
- **Acceptance** (harness `S-META`): (a) a draft whose meta ends "then book a consultation with Acme." yields no claim and no question;
  (b) `Meta Description:\nSlug: x` gives `metaOf('Meta Description') === ''` and `PF.meta` writes a 120-155 character description;
  (c) Blog Package and `Build_WP_Draft` on that input keep `slug: x` and no description starts with `Slug:`; (d) the Service schema
  description equals the meta; (e) replay of the anonymised 3299 chain Page Fix -> Content QA -> Page Candidates -> Blog Package gives
  `meta_description_length` 120-155 and no meta question; (f) a finalize starting from the anonymised 3336 body (meta
  "Slug: ms-365-erp-uae") returns a rebuilt description and is not blocked by the meta. App test: `finalizeBody` drops the broken meta.
  Live: next page run, check the package, HTML head and schema.

### Fix 2. The final version keeps every blocker from the page run

- **Where**: `Finalize_Parse_Brief.js:97-100` sets `facts: []`, `term_model: []`, `coverage_target: null`, `competitors: []`,
  `style_guide: null`, `site_description: null`, `target_word_count = ownWords`; `Finalize_Verdict.js:23-28` classifies only the new QA
  result and keeps a textual blocker only if its text is new; `finalizeBody` (`app/shared/src/page-review.ts:360-399`) sends no
  `qa_blocking` [R4 D3].
- **Fix**:
  1. App: `finalizeBody` adds the PRC gating fields derived from the **original** report's stored payload (`o.original`, not `o.base`);
     `finalReportPayload` copies the PRC through so a second finalize sees it.
  2. Engine: a patch to *Build Webhook Response* (appended build section) adds the grading fields to every new content callback.
  3. `Finalize_Parse_Brief.js`: build the QA context from the PRC; never use the page's own word count as target. A missing grading
     field is advice "not checked: <field>" and never blocks Ready; a missing **gating** field cannot produce Ready.
  4. `Finalize_Verdict.js`: every **hard** blocker of the page run stays open until the client resolves it by an explicit decision:
     "Rewrite as an update of <url>" (Finalize records it and sets `target_url` / slug; the app starts a normal keyword run with
     `existing_page_url`, quoted and charged as a page [RC M8]) or, if the owner allows it (D2), "this page differs because ..."
     (recorded and shown; the fit cap stays).
- **Acceptance**: replay the anonymised 3336 with an **old-format** payload (3299's actual keys) -> `not_ready` because of `qa_blocking`,
  not because of "not checked"; length is advice only. Harness: a finalize with grading fields missing returns advice "not checked",
  not `not_ready`; with gating fields missing it never returns `ready`. App tests: `finalizeBody` includes `qa_blocking` when the
  original payload has it; a second finalize carries the PRC. Live: finalize a `not_ready` page without resolving the blocker; it stays
  `not_ready`.

### Fix 3. Count repetition, source quality and keyword fit in the grade, so it cannot say 100 on a page like this

Interim, deterministic, $0. A subset of the Wave 2 rubric, so nothing is thrown away. **One scale, out of 100** [RC H3]:

| Component | Max | Rule | Cap |
|---|---|---|---|
| Structure | 20 | today's structure checks scaled; minus 3 per repetition cluster of 3+ (up to 8), minus 2 per list-label collision (up to 4) | cluster of 4+ -> <= 10 |
| Coverage | 15 | today's term coverage scaled | - |
| Readability | 10 | today's readability scaled | - |
| Specificity | 10 | today's specificity | - |
| Clean language | 10 | today's clean-language checks | - |
| Sources | 15 | share of in-text attributions and figures with a tier 1-4 attribution (`SRC.tier`), x 15; minus 5 per weak-only market, adoption, cost or compliance figure | weak-only compliance figure -> <= 8 |
| Fit | 20 | verdict: >= 50 -> 10, 30-49 -> 4, < 30 -> 0, null -> 10 with "not checked"; no unresolved duplicate -> 10, else 0. SERP shapes recorded, no points yet | verdict < 50 -> <= 8 (also when acknowledged); duplicate unresolved -> <= 6 |
| Length | 0 | advice only | - |

Global: any open blocker -> total <= 59; displayed maximum "95+". **Ready** = no blocker and every component >= 50% of its maximum,
except Fit after an explicit acknowledgement (shown as "your choice"). Hand estimate on the counterfactual (3336 without the duplicate,
verdict acknowledged): about 65 and "Needs work: structure, sources" [RE §3.3]; the harness pin decides.

- **Where**: `Content_QA.js:759-773` (the six components) computes the page-local items; `GR.cap(grade, cls)` applies blocker, duplicate
  and floor rules where the grade object is built (`Page_Candidates.js:81-84`, `Finalize_Verdict.js:47-48`); `serp_shapes` comes from a
  free `KWI.serpPageTypes` call on the SERP top-10 organic list (`_kw_inputs` inlined into *Parse Analysis* by an appended section); the
  PDF line `build_v4.py:892` uses the same grade.
- **Fix**: new kit `v5/code/_grade.js` (inlined by `build_v4.py` and `build_monitors.py` `_FIN_KITS`); the app renders "95+" and the
  floor status (`ReviewPanels.tsx`, `content.tsx`, `article.tsx`).
- **Acceptance**: pin 1: anonymised 3336 final grades <= 70 and not ready (T8); pin 2: the same with `qa_blocking` emptied and the
  verdict acknowledged grades <= 72 and is not "Ready" (a floor fails); a clean well-formed H1-H3 fixture with no `verdict_score` grades
  >= 80 and Ready (fit "not checked") [RC L5]; directional: one idea restated in 6 sections grades at least 3 points lower than its base;
  a weak-only compliance figure grades lower and raises a soft blocker; verdict 42 acknowledged still caps fit at 8; the grade is the
  same under two page-type weightings' caps (shares). App test: a grade of 100 renders "95+".

### Fix 3b. Remove the causes the grade now counts (cheap, in Wave 0)

1. **Prompt lines** (section 2.4): `strategy_brief.txt:91` (PAA as evidence, not outline; at most 4 question headings on a guide, 3-5 FAQs
   on service / location / pricing, none on a case study), `copywriter.txt:61` (FAQs are not headings by default), `copywriter.txt:72`
   (keyword in H1, first sentence and last section; "each point has one home").
2. **Weak-only figures** become soft blockers in `PF.classify` with the action "rewrite the sentence without the number", so the editor
   or the system's neutral rewrite removes them before delivery.
3. **Blind Critic re-read** of the delivered candidate (Sonnet, about $0.05, a new node after *Page Candidates*' final check, appended
   section); each unresolved high-severity problem is a soft blocker. A refused or unparsable answer is "not checked", never a pass.
- **Acceptance**: harness: the prompts no longer contain the three old instructions (build assert); a fixture with a Visionet-style
  weak-only market figure gets a soft blocker and a rewrite job; a recorded Critic answer with one unresolved high problem yields a soft
  blocker; a refused answer yields "not checked". Live: the held-out regulated page run of the Wave 0 live check has no idea stated 4+
  times and no weak-only figure.

### Fix 4. Ask before writing a page for a keyword the verdict scored under 50

- **Where**: `build_v4.py:1111-1117` (`Verdict Router`, `verdict === 'AVOID' && !force_content`); `force_content: true` is set by
  `Cadence_Plan.js:600` (including the AI page of the week), `Spawn_Case_Study_Run.js:7`, `Tracker_Report.js:253`, `Spawn_Page_Runs.js:28`
  and the app's ladder "Write now" (`payload.ts:143`); runs complete only on stage `content` (`app/shared/src/constants.ts:169, 181`
  `finalStages: ['content']`) [R4 D5, RC H1, M1].
- **Fix**:
  1. Engine: *Parse Verdict* computes `verdict_hold` / `hold_reason` (section 2.1 rule, exemptions, null rule; `DUP.targets` hits hold
     too); the router reads the flag. Hold = no brief, no copy, no edit; the cost reservation is settled at the verdict's real cost; the
     callback keeps stage **`content`** and adds `hold: { score, reasons, alternatives }` (up to three: the verdict's re-target, the
     existing page to improve, a better rung). The verdict report itself is still delivered.
  2. `hold_ack: { score }` is a new payload field: `shared/src/schemas.ts` + `payload.ts` (key order kept), `npm run export:payloads`,
     a Normalize Input pass-through patch and harness S23.
  3. Cadence: `Content_Log_Row.js:17` writes `status: 'held'` with the score and reason in `qa_reasons` when the run held (it skips
     today when no page was written); `Cadence_Plan.js` and `cadence.ts` treat `held` as skipped until a `hold_ack` or a 90-day re-check
     (*our choice*), in the same commit; the cadence then takes its next candidate (D1) and never sets `hold_ack`. Shadow mode first for
     automatic sources (D17). No new column [RC M3].
  4. App: the hooks handler completes the run on stage `content` and charges only the actual cost; a renderer for `payload.hold`; a
     Needs you item "Needs your OK: this keyword scored 42" with three actions: "Write it anyway" (re-sends with `hold_ack`; the fit cap
     stays), "Use the recommended target", "Improve the existing page" (a refresh run of that URL). The form states the rule ("a page is
     held for your OK when our verdict scores the keyword under 50"); the score appears only in the hold report, because the Keyword
     Check has no verdict score (`Assess_Response.js:212`) [RC M2].
  5. Every hold is logged; the owner reviews the first 20 before D3 adds volume rules [RE L4].
- **Acceptance**: harness (Code nodes plus build asserts on the IF expression): verdict 42 / GO_WITH_CHANGES from an app form run ->
  `verdict_hold: true`, router false branch to the hold, callback stage `content` with `hold`, reservation settled at verdict cost; with
  `hold_ack` the brief runs; cadence source with `force_content` -> `would_hold` in shadow mode, held after the switch; case study, AI
  page, refresh and an exempt ladder rung are not held; a null score is not held. App tests: a held callback completes the run and
  charges only the actual cost; the hold renders with three actions; "Write it anyway" sends `hold_ack`. Live: verdict-only run on
  "ms 365 erp" (about $0.13) returns a hold.

### Fix 5. Work answers into the right sentence instead of appending them; stop offering homepage slogans as proof

- **Where**: placement `Finalize_Apply.js:46-51` (`sectionFor` by word overlap) and `:76-82`; acceptance `Finalize_Merge.js:30` and
  `:38-41` (appends a confirmed sentence as its own paragraph); prefill `_page_fix.js:469-475` (`prefillOf`, half the words either
  direction, up to 20,000 characters of each client page via `Page_Candidates.js:73-75`); brief questions passed as strings at
  `Page_Candidates.js:77`; brief schema `build_v4.py:12610` (`questions_for_client: string[]`); one click `page-review.ts:280-283`
  (`prefilledAnswer`) and `:286-289` (`factOf`); wrong-place neutral `_page_fix.js:477` (`neutralIn`) via `Page_Candidates.js:69-71`
  [R4 D6, G15, RC M4].
- **Fix**:
  1. **Slots, not similarity**: `questions_for_client` becomes `{question, section, category}` (appended patch to `_sb151`; strings still
     accepted for one release); terms and consultation -> the call to action; credential -> partner / why-us section or author line;
     proof -> the proof block of the decision section; detail -> the named section. Overlap is only a tie-break inside the slot.
  2. **Rewrite the host sentence**: the editor job names the sentence the fact changes (`finalize_editor.txt`); `Finalize_Merge.js`
     refuses an edit where the answer is a standalone sentence at the end of a paragraph whose other sentences share < 20% of its content
     words, and never appends; an unplaced answer is reported "not placed: tell us where".
  3. **Removed claims**: `neutral: ''`, `in_page: 'left_out'`, plus an anchor; a "yes" is restored at that anchor only.
  4. **Prefill rules**: business facts and profile first; a proof prefill must name a project, client or sector plus an outcome, or carry
     a number or a URL; a credential prefill must contain a credential noun; no prefill under 6 words or without a verb; none from listing
     pages (`SM.isListing`) or reading-time / navigation chrome; an adjective phrase plus the client's name is a slogan and is rejected.
  5. "Accept all suggestions" applies only to yes/no claim questions, never to text answers.
  6. Old reports: an answer whose `original` equals a head line is ignored (RC L2).
- **Acceptance**: harness (no Claude): `Finalize_Apply` on the anonymised 3336 names the CTA sentence as host for the "free of charge"
  answer; `Finalize_Merge` with a recorded editor answer that appends a standalone sentence refuses it; q1 / q2 / q3 / q7 have no
  prefill; the restored sector claim sits at its anchor; `prefillOf("Do you have UAE ERP projects with outcomes...", ["Deep UAE & GCC
  knowledge"])` is null; an object and a string `questions_for_client` both work. App test: "Accept all" leaves text questions unanswered.

### Fix 6. Search for local regulatory dates when researching (UAE first, any market by data)

- **Where**: `build_v4.py:843-848` (*Facts SERP*: keyword with every country and city removed + "statistics <year>", depth 20, later
  re-wired by the retry splices at `:2190`, `:5342`, `:7484`) -> `Collect_Facts.js`; no regulator step anywhere;
  `Page_Source_Plan.js:20-24` bag-of-words queries [R4 D7, RC M6].
- **Fix** (any market by data, no code per country):
  1. `v5/data/regulators.json`: market (ISO country) -> topics (VAT, e-invoicing, corporate tax, data residency, payroll / labour,
     licensing, AML, health, finance) -> official domains, the topic's trigger words, a freshness date. First markets: AE (`mof.gov.ae`,
     `tax.gov.ae`, `u.ae`, `uaelegislation.gov.ae`), SA (`zatca.gov.sa`), PK (`fbr.gov.pk`) (D4 for more).
  2. New appended build section, wired Collect Facts -> *Regulatory Plan* -> SearXNG -> read -> *Collect Regulatory Facts* -> Competitor
     Analyzer; *Parse Analysis* still reads *Collect Facts* by name, so its patch at `build_v4.py:849` still matches [RC L6].
  3. *Regulatory Plan* (code): topics from keyword, secondary keywords, business facts' content topics, brief terms and the client's own
     post titles in `site_urls`.
  4. SearXNG (free) per topic: `site:<official domains> <topic> deadline OR timeline OR phase OR "go-live" <year>` and an amendment query
     (`amended OR extended OR postponed`); read the top 2 pages with the existing reader. *Collect Regulatory Facts* extracts dated
     obligations with the fact shape of section 2.2 (`source_date`, `as_of`, `supersedes`, `status`); the latest dated source wins. If no
     official page is readable, the two-source secondary tier; else "none could be confirmed". If SearXNG is down, one DataForSEO SERP
     query per topic ($0.002) through `dfs_gate.splice()`, listed in `__LEDGER_NODES` of every ledger node, passing `gate_lint`, with no
     node-level retry (`retry_lint`). External HTTP nodes: 3 tries / 5 s.
  5. Read the client's top 2 own posts on the topic for consistency, never as the date's source.
  6. The Strategy Brief and Copywriter prompts and Content QA read `$('Collect Regulatory Facts').first().json` explicitly, inside
     try/catch; QA records `regulatory: {required, stated, status, source_tier}` for Wave 2's accuracy items.
- **Acceptance**: harness fixture "ms 365 erp", AE, facts mentioning e-invoicing: the plan holds a `site:mof.gov.ae` e-invoicing query
  and an amendment query; a fixture with an original decision (31 July) and an amendment (30 October) yields the 30 October date with
  `supersedes`; a fact dated before the publish date gets `status: passed`; a market with no map, or a PDF-only official page with no
  agreeing secondary pair, yields "none could be confirmed"; a build assert that the regulatory block reaches the Strategy Brief prompt;
  `retry_lint`, `gate_lint`, `lineage_lint` pass. Live (free): a research-only run on techand.ai; compare the dates by hand with the
  official MoF text and its decision number, not with KPMG's summary, our text or theirs [RE H5].

### Fix 7. Downloads on the final version page

- **Where**: `Finalize_Verdict.js:54-66` returns Markdown, changes, delivery, grade and cost only; `runFinalize`
  (`app/server/src/services/pageReview.ts:524-575`) inserts the report with `payload.html` but no `files` rows; the report view lists
  downloads from `report.files` only (`ReportView.tsx:55-75`) [R4 D8]. The page-run tail cannot be byte-copied into Finalize: *Build Word
  File* reads `$('Check Crawl')`, `$('Claude - Critic')`, `$('Normalize Input')`, `$('Promise Judge')`, `$('Load Cost Calibration')`;
  *Blog Package* and *Image Cards* read `$('Site Model')`; none exists in Finalize [RC M7].
- **Fix**:
  1. App (Wave 0): `runFinalize` runs `extractFiles` (`files.ts:94-96`, already turns payload `html`, `markdown`, `meta` into `.html`,
     `.md`, `.meta.json`) on the final payload and copies the original report's image file rows.
  2. Engine (Wave 0 if it fits): a Finalize-only node after *Finalize Verdict* (reads its body, does not edit the file) renders the final
     HTML to PDF through Gotenberg (`http://gotenberg:3000`, present in `deploy/gcp/compose.prod.yml`), reads the bytes with
     `this.helpers.getBinaryDataBuffer` and returns base64; listed only when rendered. The workflow's own `executionTimeout` is 300 s
     and the app's limit is 5 minutes (`pageReview.ts:73`); 3336 took 23 s.
  3. Word: Wave 2, with a Finalize-only builder.
- **Acceptance**: app test: a finalize result gives the new report HTML, MD, meta.json and the original's images, and the download cards
  render; a PDF card appears only when the engine returned one. Engine harness: the PDF node's output shape with a stub. Live: one
  finalize, check the cards.

### 3.8 Wave 0 agents

Worktree agents, at most three at a time. Agents build in their worktree with `--no-env` for the harness only and never commit generated
workflow JSON from a worktree (a worktree has no `n8n/.env`); the orchestrator rebuilds in the main worktree after every merge and runs
the harness there (throwaway `n8nio/n8n:2.41.4` container with the node wrapper, since the laptop n8n stays stopped). Every change to a
v3 node is a new appended build section owned by one agent.

| Agent | Fix | Files it owns | Tier | Depends on | Must not touch |
|---|---|---|---|---|---|
| W0-A Meta | 1 | `_claims.js`, `Content_QA.js` (readers + structure meta check only), `Blog_Package.js`, `Build_WP_Draft.js`, `_page_fix.js` (`removeAt`, `neutralSentence` guards, `PF.meta`, `PF.fix` c, `PF.questions` `where`), `Finalize_Parse_Brief.js` (the `PF.meta` call only), app `finalizeBody` meta drop + `pageReview.ts` read-time repair | Sonnet | 3.0 | Finalize blockers, grade |
| W0-D Hold | 4 + duplicate before brief | `Parse_Verdict.js` (sole owner in Wave 0), router + `Need Content?` (appended section), new `_dup_targets.js` (+ the call in `Originality_Check.js`), `Content_Log_Row.js`, `Cadence_Plan.js` + `cadence.ts`, `schemas.ts` / `payload.ts` (`hold_ack`), Normalize Input pass-through, S23, hooks handler, hold renderer, Needs you item, form text | Opus | 3.0 | `_page_fix.js`, Finalize files |
| W0-F Regulatory | 6 | `v5/data/regulators.json`, `Regulatory_Plan.js`, `Collect_Regulatory_Facts.js`, its appended build section, `strategy_brief.txt` / `copywriter.txt` (REGULATORY FACTS block only) | Sonnet | 3.0 | `Parse_Verdict.js`, `Content_QA.js` score section, Finalize |
| W0-B Blockers | 2 | `Finalize_Parse_Brief.js` (context), `Finalize_Verdict.js` (blockers, update decision), Build Webhook Response patch (appended section), `page-review.ts` (`finalizeBody` PRC), `pageReview.ts` (request build, `o.original`, `finalReportPayload`) | Opus | A merged | `prefilledAnswer`, `runFinalize` file storage |
| W0-E Weaving | 5 | `Finalize_Apply.js`, `Finalize_Merge.js`, `finalize_editor.txt`, `_page_fix.js` (`prefillOf`, `neutralIn`), `Page_Candidates.js:69-77`, `_sb151` patch (appended section), `page-review.ts` (`prefilledAnswer`, Accept all), `strategy_brief.txt` (`questions_for_client` lines only) | Opus | B merged (shares `page-review.ts`) | `finalizeBody`, `Finalize_Verdict.js` |
| W0-G Files | 7 | `pageReview.ts` (`runFinalize` storage), `ReportView.tsx`, the Finalize-only PDF node in `build_monitors.py` after *Finalize Verdict* (reads its body) | Sonnet | B merged | `Finalize_Verdict.js`, grade |
| W0-H Causes | 3b | `strategy_brief.txt:91`, `copywriter.txt:61, 72`, `_page_fix.js` (`PF.classify` weak-only figures and Critic highs), the Critic re-read node (appended section) | Sonnet | A, E merged | grade object lines |
| W0-C Grade | 3 | new `_grade.js`, `Content_QA.js:759-773`, `GR.cap` calls at `Page_Candidates.js:81-84` and `Finalize_Verdict.js:47-48`, `_kw_inputs` inlining into Parse Analysis (appended section), `_FIN_KITS`, `build_v4.py:892`, app `ReviewPanels.tsx`, `content.tsx`, `article.tsx` | Opus | B, E, G, H merged | prompts, Finalize Apply / Merge |

Batches: **A, D, F** in parallel; then **B**; then **E, G** in parallel; then **H**; then **C**. Merge order A, D, F, B, E, G, H, C;
rebuild and harness after each merge.

Customer-facing in Wave 0: the hold ("Needs your OK"), the final version downloads, the "95+" grade, "Needs work: <dimension>", and the
changed review behaviour. So the same wave updates `app/web/src/marketing/content/changelog.ts` (one line per change, customer language),
the feature entry in `content/features.ts` for content writing, and re-captures every tutorial in the video-skills repo whose screens
change (the page review / final version tutorial, the Needs you list, the Write a page form; find them in `data/tutorials.json`), with
the no-leak scan.

Wave 0 is done when: build exit 0, harness 0 failed, app shared / server / web tests and typecheck pass, the anonymised replays of 3299 /
3336 pass in CI, one commit per fix pushed, and the live check (verdict-only "ms 365 erp" hold + one finalize + one page run on a
held-out regulated keyword, cap $5) passed. Deploy is the owner's (`deploy/gcp/deploy_engine.py` over `deploy/gcp/tunnel.sh`), never on a
Monday morning New York while weekly runs are due. No Data Table column is added in Wave 0 (`held` is a status value).

---

## 4. Waves 1-6

Same rules for every wave: worktree agents, at most three or four in parallel; one functionality per commit; the orchestrator merges one
at a time and rebuilds in the main worktree with the exact harness count; v3 nodes changed only through appended build sections with one
owner per node per wave; Data Table columns only through `ladder_common.py` + `sync_tables.py`; app schema changes with
`npm run db:generate`; form fields in `shared/src/schemas.ts` + `payload.ts` with key order kept, then `npm run export:payloads` and
harness S23; `_fact_answers.js` with `page-review.ts` `factsForEngine`, and `Cadence_Plan.js` with `cadence.ts`, always in the same
commit; marketing registry, changelog and tutorials follow every customer-facing change; deploys are the owner's. Each wave ends with the
3299 / 3336 replays, its own harness scenarios, and one live run on a held-out keyword.

### Wave 1: decide before writing (no page that should not exist)

Goal: T11 and T13. All checks run before the brief, so they save money.

| Agent | Items | Files | Tier | Depends on | Must not touch |
|---|---|---|---|---|---|
| W1-A Lineage | G1 own coverage reaches the verdict; `lineage_lint.py` rule "a field written for a named reader reaches it along main" (walk the graph as build section 55 does) | `verdict.txt:14`, `lineage_lint.py`, the read in `Parse_Verdict.js` | Sonnet | Wave 0 | ladders, cadence |
| W1-D Structured verdict | sole owner of `Parse_Verdict.js` and the router this wave: G2 fields `target_keyword` / `page_type` / `target_url` / `merge_into`; G7 contract; a `HOLD.reasons()` hook that other agents feed | `verdict.txt`, `Parse_Verdict.js`, `strategy_brief.txt:5` | Sonnet | W1-A | ladders |
| W1-B SERP shapes and type decision | R3 §1.2 shapes incl. vendor official and directory, vendor domain list, comparable-provider count, "<= 3 of 10" rule with boundary tests on the stored SERPs of 3299 and two others, fit cap at 50%; ladders and cadence choose the type | `_kw_inputs.js:251-300` (a `typeHold()` producer), `Ladder_Plan.js:282-293`, `Cadence_Plan.js:360` + `cadence.ts` | Opus | W1-D | `_cannibal.js` |
| W1-C Cannibalisation, update-vs-new, minimal refresh | `_cannibal.js` extends `DUP.targets`; routing to refresh / merge; the minimal refresh brief block (R3 §3.13); inbound suggestions excluding same-search pages shown in page review; "Check this first" counts `not_ready` drafts | new `_cannibal.js`, `Own_Coverage_Run.js`, `_verdict_existing.js`, routing (appended section), refresh block, `keywordChecks.ts`, page review inbound panel | Opus | W1-D | type rules |
| W1-E Ladder floors | G5 own-results-page and demand floor per rung; G6 rung adoption by form runs | `Ladder_Plan.js`, Normalize Input patch (appended section) | Sonnet | W1-B merged | verdict |

Order: A, then D, then B and C in parallel (each adds its hold producer in its own file and one call line in `Parse_Verdict.js`, which
the orchestrator merges), then E [RC L4]. Acceptance: replay 3299 holds with "this search is already planned on the site" and lists the
Business Central and F&O pages; the **stored real SERP of 3299** (our classifier: service 3, guide 3, other 3, list 1; one comparable
partner page by hand) plus Service Page -> hold proposing Guide; "ms 365 erp" folds into its ladder sibling as a supporting keyword; a form
request matching a rung adopts the rung; a refresh run keeps the URL. Live: four verdict-only runs (about $0.13 each) and the techand.ai
refresh (L2 of §5.3) once the owner agrees. Customer-facing: the hold reasons and alternatives widen, the inbound link list; marketing
changelog + Needs you tutorial update.

### Wave 2: measure like a reviewer

Goal: T1-T8. Calibrates against humans; the gate leans on synthetic directional tests until 30+ real labels exist [R5 §6.3].

| Agent | Items | Files | Tier | Depends on | Must not touch |
|---|---|---|---|---|---|
| W2-A Gold set | capture the 12 real versions (949, 2195, 2552, 2575, 3299 drafts / delivered / final / published) locally; **15-20 non-Claude pages** (top-3 ranking pages for the held-out keywords, already read in runs, and pages clients wrote themselves); dev / hold-out split **by client**; synthetic variant generator (R5 §6.2, about 100 cases); `S-GRADE` rows; blind label sheet | `harness/accuracy/grade_*.json`, `harness/accuracy/grade_variants.js`, `scenarios_v5.js` | Sonnet | Wave 0 | engine code |
| W2-B Full rubric | `_grade.js` to the R5 §3 rubric: six dimensions, items with partial credit, owners, page-type weights, caps as shares (§2.9), floors, bands until calibrated, splice check on every version, official-source rule | `_grade.js`, `Content_QA.js` score section, `build_v4.py:892` | Opus | W2-A | judge prompt |
| W2-C One judge | the single reference-guided Sonnet checklist judge, structured output with partial credit, quote verification, refusal = not graded, recorded answers with prompt + model hash, `eval_grade_panel.js` (paid, owner-approved, capped), Haiku 5.5 in `_cost_cal.js`; model ids confirmed first | `v5/prompts/grade_j1.txt`, nodes in `build_v4.py` + `build_monitors.py` (appended sections), `harness/accuracy/eval_grade_panel.js`, `_cost_cal.js` | Opus | W2-B | Critic, editor |
| W2-D Candidates and edits | G18 weights, G19 per-section accept, G20 head jobs, G14 informed Critic as steering | `_page_fix.js:277-346`, `Page_Candidates.js`, `Edit_Check.js`, `critic.txt` | Opus | W2-B | grade judge |
| W2-E App grade | two answers, six bars with "who measured it", bands until calibrated, floors, never 100, version hash, "out of date", no first-draft score; Word file on the final version | `ReviewPanels.tsx`, `content.tsx`, `article.tsx`, `page-review.ts`, Finalize Word builder | Sonnet | W2-B | engine grade |
| W2-F Live-page check | Publish Check fetches the live URL, diffs it against the final version, runs the deterministic items on it, reports the differences | Publish Check (`SEOagentPubCheck`), app content page | Sonnet | W2-B | grade weights |

Human labels: **two external SEO raters** who have not seen our grade label the gold set on the R5 rubric (about one day each); the owner
adjudicates only, because the owner built the product and knows its faults [RE M4]; the techand reviewer's 63 with its six dimension
scores is stored as an external label (note which version: the client edited the page); D9 asks the client to score two more pages. A
second judge seat is added only when the gold set shows variance or bias. Calibration run over the gold set with one judge about $3-5.
Marketing: the grade's six dimensions on the content capability page; "matched expert reviewers within N points on M pages" only after
`GRADE_PANEL_EVAL.md` exists [R5 §7 rule 9]. Tutorials: re-capture the page review tutorial.

### Wave 3: research and proof like a local expert

Goal: T9-T10 on proof and accuracy, T12.

| Agent | Items | Files | Tier | Depends on | Must not touch |
|---|---|---|---|---|---|
| W3-A Sources | G9 tier filter in *Parse Brief* (appended section), source classes, research / press facts query; G10 claim-type query templates, paragraph evidence | `Collect_Facts.js`, Parse Brief patch, `_sources.js`, `Page_Source_Plan.js`, `Page_Source_Candidates.js` | Sonnet | Wave 2 | fact store |
| W3-B Own site | G11 read 4-6 own pages + matching service page; facts digest; claim corpus | `Collect_Client_Pages.js`, `Brief_Context.js`, `_promise_judge.js` | Sonnet | - | prompts beyond the context block |
| W3-C Fact store | G16 typed facts, normalisation, CTA / meta never stored, "no proof yet", proper-noun check, Business details screen listing every fact with source | `page-review.ts` (`factOf`, `factsForEngine`), `_fact_answers.js`, app Business details page, `seo_sites` column via `ladder_common.py` if a new shape is needed | Opus | - | Finalize |
| W3-D Proof before writing | proof minimum per type (R3 §3 (c)); pre-brief readiness; `needs_your_facts` status and Needs you screen; "leave it general"; 3-5 prefilled questions; ask for 2-3 real photos or a process diagram; two reminders then the general version (except proof-only types) | new pre-brief node, `readiness.ts`, `pipeline.ts`, web Needs you | Opus | W3-C | grade |
| W3-E Style and E-E-A-T | G28 spelling detection and mismatch note; G30 named person with role for service / comparison / industry / local; **author page generator**; G29 alt text describes content | `_style_guide.js`, `Content_QA.js` schema author block, new author page mode, `Image_Cards.js:104` | Sonnet | - | prompts |
| W3-F Regulator maps | more markets (D4), freshness date and refresh trigger per entry, `regulators.json` validation test, amendment handling on the second market | `v5/data/regulators.json`, harness | Haiku | Wave 0 F | code |

Customer-facing: the proof screen before writing, the Business details facts list, the spelling note, author pages. Marketing: proof
capture as part of the content capability; tutorials: a new tutorial at the end of its series for "Give us your proof once" (never
renumber), re-capture of Business details.

### Wave 4: every page type

Goal: T9-T12 for all types, not only guides and service pages.

| Agent | Items | Files | Tier | Depends on | Must not touch |
|---|---|---|---|---|---|
| W4-A Type registry | new types (D12 order) in `_page_type.js`, form, `schemas.ts`, `payload.ts`, `export:payloads`, harness S23 | `_page_type.js`, `app/shared/src/schemas.ts`, `payload.ts`, web form | Sonnet | Wave 1 B | brief |
| W4-B Brief and writer per type | type blocks (R3 §3 (b)-(g)); PAA classification in code; one owning section per proposition and list; length band per same-type pages; language per D15 | `Brief_Context.js:146-155`, `strategy_brief.txt`, `copywriter.txt`, Parse Analysis patch | Opus | W4-A | grade |
| W4-C Schema and package per type | R3 §2.6: no FAQPage / HowTo, LocalBusiness only with a real address, Article with dates, ItemList descriptive; visible Updated date rules | `Content_QA.js` section 16, `Blog_Package.js` | Sonnet | W4-A | prompts |
| W4-D Location, refresh and volume guards | location pages need a real presence (address, staff, named projects there) or a materially different offer, plus sibling overlap < 30% via `_shingle.js`; per-site monthly caps per type and the 90-day new-URL share (D14); a named client reviewer before publish; full refresh type (R3 §3.13 R1 / R2); hub needs >= 3 live clusters (H1) | new checks in `_grade.js` + pre-brief readiness, refresh brief, `Cadence_Plan.js` + `cadence.ts` | Opus | W4-A, Wave 3 D | type registry |
| W4-E Type checklists in the grade | R3 §3 (h) checklists as type items with critical flags, mapped into the six dimensions; gold variants per type (city-swapped location page, comparison without disclosure, pricing scenario that does not add up) | `_grade.js`, `harness/accuracy/grade_variants.js` | Sonnet | W4-A, Wave 2 B | prompts |

Customer-facing: new page types in Write a page and in the pipeline. Marketing: features registry, platform and solutions pages listing
the page types; pricing if credits per type differ. Tutorials: re-capture Write a page; one new tutorial per new type family if the form
changes materially.

### Wave 5: publish, index, measure, refresh

Goal: T14-T18 measured.

| Agent | Items | Files | Tier | Depends on | Must not touch |
|---|---|---|---|---|---|
| W5-A Links at publish | CMS update of the hub and two related pages after approval, outbound to the service page and primary sources | Publish Check, `app/server/src/services/cms/*` | Sonnet | Wave 4 | grade |
| W5-B Index checks | URL Inspection reads at 7 / 14 / 30 days, IndexNow per published page, "request indexing" as a site task, "crawled, not indexed" as a quality signal | Site Tracker (`build_site_tracker.py`), AI Growth IndexNow kit, `siteTasks.ts` | Sonnet | - | cadence |
| W5-C Outcomes | `seo_page_outcomes` (via `ladder_common.py` + `sync_tables.py`), 7 / 30 / 90 / 180-day records vs control pages, baseline of already published pages, hold rate and alternatives' outcomes beside T15-T17 | Rank Tracker, `ladder_common.py`, app content pages | Opus | - | cadence |
| W5-D Refresh triggers | decay, striking distance, regulation change (fact status or freshness), SERP type change; refresh picks in the cadence; the randomised hold-back (one in four eligible candidates waits 90 days) | `Cadence_Plan.js` + `cadence.ts` (same commit) | Opus | W5-C | outcomes table |
| W5-E Honest expectations | page lifecycle view; expectation copy (execution speed, checks, measured bands, no positions promised) in app and marketing | web content pages, `marketing/content/*` | Sonnet | W5-C | engine |

### Wave 6: calibration, second seat, drift

- Re-calibrate when 10 new labelled pages arrive or the judge model changes, and fit an isotonic map only at >= 30 labels [R5 §6.5, RE
  M3]; weekly sample of 5 production pages re-graded and compared with the stored grade; client edits of delivered pages kept as weak
  labels, client scores as strong ones.
- A second Claude seat if the gold set shows judge variance; a cross-family seat (GPT-5.4 mini or Gemini 3.1 Pro) only if the gold set
  shows a Claude-family bias (mean signed error on Claude-written pages more than 3 points above that on the non-Claude pages) or the
  owner wants the stronger claim; it needs a new vendor credential, a privacy text line and a DPA (D7) [R5 §5.3].
- Coordinate with the deferred self-learning loop (its week-3 client evaluation is due 2026-11-10): the outcome records of Wave 5 are its
  input, not a second system.

### 4.1 Size

| Wave | Sessions (orchestrator) | Agents | Paid live check |
|---|---|---|---|
| 0 | 2 | 8 | <= $5 |
| 1 | 1-2 | 5 | <= $3 (verdict-only runs + one refresh) |
| 2 | 2 | 6 + human labelling (two raters, about 1 day each) | calibration $3-5 |
| 3 | 2 | 6 | <= $6 (two page runs + finalize) |
| 4 | 2 | 5 | covered by §5.3 |
| 5 | 2 | 5 | $0 (free Google APIs) |
| 6 | ongoing | 1-2 | recalibration $3-12 each |

37 agents in total. The plan is deliberately front-loaded: Waves 0-2 fix every defect of the trigger case and make the grade honest;
Waves 3-6 are the depth that gets pages to experts' standard across types.

---

## 5. Evaluation protocol

### 5.1 Gold set

- **Real pages** (the hard core): about 12 versions from 949, 2195, 2552, 2575 and 3299 (Copywriter draft, delivered, final, published)
  [R5 §6.1]. Four of the five cases are techand.ai, two on the same keyword; the dev / hold-out split is **by client**, and T1 / T2 are
  measured on hold-out clients only [RE M4].
- **Contrast pages**: 15-20 non-Claude pages (top-3 ranking pages for the held-out keywords, pages clients wrote themselves), labelled
  blind with the same rubric. A rubric that scores pages Google ranks top 3 under 60 is miscalibrated on proof or local items; the
  contrast group is also what makes the Wave 6 family-bias trigger measurable.
- **Labels**: two external raters on the R5 rubric (items with partial credit and dimension bands) who have not seen our grade; the owner
  adjudicates; disagreements kept as the human ceiling. The techand reviewer's 63 is one external label (store which version it refers
  to).
- **Synthetic variants**: about 15 perturbations x 6-7 bases = about 100 cases, each with the item that must fail and the direction the
  grade must move (broken meta, spliced sentence, appended answer, sentence heading, idea restated 4 / 6 times, duplicate list label,
  padding section, official source swapped for a weak blog, unlinked weak attribution, regulated date changed, removed or superseded,
  passed deadline stated as upcoming, slogan as proof, unsupported free offer, verdict context 25, SERP all explainers for a service
  page, published duplicate, cut at 60%, spelling flip, known negatives) [R5 §6.2]. Wave 4 adds per-type variants.
- **Growth**: every client score or rejection becomes a gold case with consent; every live-run page in §5.3 is labelled.

### 5.2 Offline gates (harness, every build)

`S-GRADE` beside S49, and `S-META`, `S-HOLD`, `S-FINALIZE`, `S-REG` from Wave 0, all on committed anonymised fixtures. Fail the build when:

| Gate | Threshold |
|---|---|
| Directional tests on variants | 100% |
| Blocker recall | >= 95% |
| False blocks on clean bases and human-ready pages | <= 5% |
| Overall MAE vs adjudicated humans, hold-out clients (recorded judge answers) | <= 8 points (from Wave 2; bands shown until met) |
| Mean signed error, hold-out clients | within +/- 3 (from Wave 2) |
| Ready / not-ready agreement with humans | >= 90%, TPR and TNR shown separately |
| Regression pins: anonymised 3336 final; the same without blockers, verdict acknowledged | <= 70 not ready; <= 72 not Ready |
| SERP rules on the stored real SERPs (3299 + two others) at the "3 of 10" boundary | expected decision |
| Recorded judge answers match the current prompt + model hash | else "re-record the judge answers" |

Reported, not gating until n >= 30: Spearman, per-dimension kappa, the human-human ceiling [R5 §6.3-6.4].

### 5.3 Paid live run (after Waves 0-2, again after Wave 4)

Real clients only, with their consent; keywords are held out (never "ms 365 erp" except L1, and not used while writing prompts). Every
keyword first goes through the decide layer: a hold or a re-type is a valid result and counts as a test of T11.

| # | Client | Keyword (proposed) | Expected decision | Why |
|---|---|---|---|---|
| L1 | techand.ai | "ms 365 erp" verdict only | hold | regression of the trigger case |
| L2 | techand.ai | refresh of the existing guide "is microsoft dynamics 365 an erp system" with "ms 365 erp" as secondary | refresh (needs Wave 1) | the R3 §1.5 recommendation; regulated facts with status |
| L3 | techand.ai | "e-invoicing accredited service provider uae" | service page if the SERP has comparable provider pages, else guide | regulatory facts, proof minimum |
| L4 | techand.ai | "business central vs netsuite uae" | comparison (Wave 4) | disclosure, dated prices |
| L5 | devaicon.com | a service keyword from its ladders with verdict >= 50 | service page | second client, second market (Pakistan / UAE) |
| L6 | devaicon.com | a guide keyword with an explainer SERP | guide | information gain, sourcing |
| L7 | either | one location page only with a real presence there | location or held | doorway guard |
| L8 | a third client, if one consents | one page of the type it needs most | per decide layer | a hold-out client for T1 / T2 |

Cost cap: **$25** for the post-Wave-2 run (6-7 pages at about $2.2 + finalizes + verdict-only runs + one judge calibration top-up), **$20**
after Wave 4. DataForSEO balance must be checked first (it binds before the spend guard). Every run is read back node by node as R4 did.

### 5.4 Independent re-rating

As the earlier re-ratings did: a **clean CLI session outside the repo** (no CLAUDE.md, no memory) receives the R5 rubric with the R3
type checklists, each page **as it is live** (or as delivered when not published), its SERP digest and the regulatory fact pack, and
nothing of our grades. It scores every live-run page. In parallel the owner asks two other LLM products the same rubric (as the client
did), and the external raters score the same pages. The report compares our grade vs the independent session vs the other LLMs vs the
humans (MAE, signed error, ready / not ready). **Done** when T1, T2, T7, T9, T10 and T11 hold on the sample. Results go to
`docs/page-quality-2026-10-29/RERATING.md`.

---

## 6. Costs per page and credits

### 6.1 Provider cost

| Item | Today | After (Waves 0-4) | Source |
|---|---|---|---|
| Verdict + research (DataForSEO) | $0.016-0.026 | $0.02-0.05 (regulatory research on SearXNG is free; a DFS fallback is $0.002 a query) | CQ-R1 §5, R4 §6 |
| Verdict (Claude) | about $0.13 | same | R4 D5 |
| Brief (Opus) | $0.34-0.39 recorded | about the same; longer context (type block, proof ledger, regulatory facts) +10-20% | CQ-R1 §5 |
| Copywriter (Opus) | $0.21-0.29 recorded, about $0.42 with real thinking | same | CQ-R1 §5 |
| Critic (Sonnet) | about $0.05 | about $0.06 (informed) + about $0.05 for the blind re-read (Wave 0) | CQ-R1 §5, RE H1 |
| Editor (Opus full rewrite) | $0.14-0.29 recorded, about $0.69 with real thinking | targeted section edits: about $0.2-0.4 | CQ-R1 §5 |
| Grade judge (twice: delivered + final) | $0 | one Sonnet judge about $0.05-0.06 a grading, about $0.10-0.12 a page; about $0.25-0.30 if a second seat is ever added | RE L2 |
| Finalize editor (Sonnet) + files | about $0.05-0.15; no files | same + Gotenberg (local, $0) | R4 §6 |
| **Written page, Claude** | **$0.85-1.14 recorded, $1.4-1.9 real** | **about $1.5-2.1** | |
| **Held keyword** | (written anyway: $1.4-1.9) | **about $0.13** | R4 D5 |

Net: a written page costs about 5-15% more; every held or re-routed keyword saves about $1.3-1.8. If one cadence pick in five is held
(unknown until measured), the average spend per decision falls. The run ledger and `_cost_cal.js` must price Haiku 5.5 before the judge
uses it, and the per-mode estimates must be re-measured from the Wave 0 and Wave 2 live runs (the self-correcting estimates of G23).

### 6.2 Credits shown to customers

Credits are `cost x markup / credit value` = 60 credits per dollar of provider cost (markup 3, $0.05 a credit; `quoteCredits` at
`billing.ts:66`), quoted from `shared/src/cost.ts` and charged on usage **capped at the quote** (`runCredits.ts`). The content estimate
today is $0.84 (`cost.ts:72`: ai 0.8 + dfs 0.04) = 51 credits, while real cost is $1.4-1.9: the cap means we already absorb about $0.6-1.1
a page.

| Run | Quote today | Proposed quote | Credits |
|---|---|---|---|
| Written page | $0.84 (51 credits) | measured $1.9 | about 114 credits |
| Held keyword (verdict + hold) | written anyway | about $0.15 | about 9 credits |
| Final version (finalize with judge and files) | as today | about $0.20 | about 12 credits |

Owner decision D8: raise the content quote to the measured figure (customers see a higher number per page but pay nothing for pages we
refuse to write), keep it and absorb the difference, or show a range. The pricing page and `content/pricing.ts` change with it, and the
form's cost line must explain that a held keyword costs only the check.

---

## 7. Risks, owner decisions, and what we will not do

### 7.1 Risks

| Risk | Where it bites | Mitigation | Evidence |
|---|---|---|---|
| Scaled content abuse | the weekly cadence writing generic pages for keyword lists on clients' domains; glossary and answer pages weekly | the decide layer (hold, type, cannibalisation), proof minimum per type, per-site monthly caps per type and a 90-day new-URL share cap (D14), a named client reviewer per page, never "N pages a month" as the product | R2 §7, rule 14; R1 §9; RE M9 [doc, Google generative AI page 2026-10-01] |
| Doorway pages | location pages with a city swapped | purpose test: a real presence in the place or a materially different offer, else hold; text similarity (< 30% overlap) only as a second check, because an LLM rewrite beats a shingle threshold | R3 §3.2, R2 §5, RE M9 [doc, spam policies 2026-08-28] |
| Hallucinated or stale facts | regulatory dates, product facts, client facts | dates only from official pages read in the run (or two agreeing secondary sources, labelled), never model memory; amendment search, `supersedes`, status vs publish date; judge reference-guided; quote verification; typed fact store | R2 rule 6, R5 §2.1, R4 G16, RE H5 |
| Self-grading inflation and Goodhart | the editor learns the grader; the Wave 0 Critic re-read shares the steering prompt | separate grade judge from Wave 2, never steering the editor; lift check (grade lift between draft and delivered must not exceed the human lift by > 5); length-neutral judge prompts | R5 §5.5 |
| Deflation and small n | rubric scored the published page about 43 vs the human 63; 12 real pages, one client dominant | partial credit, bands until calibrated on hold-out clients, contrast pages, no isotonic map below 30 labels, "not yet calibrated" shown | RE M3, M4, R5 §6.3 |
| Hold on an uncalibrated score | a 10-search B2B commercial term can be worth a page | exemptions, shadow mode for automatic sources, "Write it anyway" one click away, owner review of the first 20 holds | RC H1, RE L4 |
| Fewer pages written | clients see holds instead of pages and think we do less | every hold shows the better action (refresh, merge, other target) with one click; the pipeline counts improved pages as output | R2 §0.1, R3 §1.4 |
| More questions to clients | friction, stalled pages | 3-5 prefilled questions, "leave it general", ask once and store, two reminders then the general version (except proof-only types) | CQ-R2 §4, §6.1 |
| Live page differs from ours | clients' developers rebuild the page | live-page check (Wave 2); re-rating grades the live page | RE H6, M8 |
| Cost overrun | Opus thinking, judge | ledger, Haiku in `_cost_cal.js`, one judge until the gold set justifies more, Sonnet for Finalize | R5 §5.2, RE L1, L2 |
| Finalize latency | 300 s workflow timeout, 5-minute app timeout | files mostly app-side; PDF only when it fits; measure; make Finalize asynchronous (202 then callback) if p95 > 3 minutes | RC M7, R4 §6 |
| Parallel patches on v3 nodes | two agents anchoring on the same node text | extract Parse Verdict before Wave 0; appended sections only; one owner per node per wave | RC H5 |
| Lineage bugs (G1 class) | a new field silently lost between nodes | explicit `$('Node')` reads in try/catch for new fields; build assert that the regulatory block reaches the brief; `lineage_lint.py` extension in Wave 1 | R4 G1, RC M6 |
| n8n sandbox | new kits using blocked APIs | pure regex / token code; harness mimics the sandbox | R4 §6 |
| Public repo | client text in fixtures | anonymised committed fixtures; raw executions git-ignored | R4 §6, RC M9 |
| Cross-family judge privacy | client text sent to another vendor | Claude-only start; owner decision and DPA first | R5 §5.3 |

### 7.2 Owner decisions needed

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| D1 | When the cadence's pick is held: skip that week's slot or take the next candidate? | take the next candidate that passes; never auto-write a held one; re-check a held keyword after 90 days | Wave 0 (W0-D) |
| D2 | Can a client publish over a duplicate-page blocker with a recorded reason, or only as an update of the existing URL? | update of the existing URL by default; a recorded reason allowed, with the fit cap kept and shown | Wave 0 (W0-B) |
| D3 | Hold thresholds beyond score < 50: modelled visits < 5, volume < 20 with no impressions? | decide after the owner reviews the first 20 logged holds | Wave 1 |
| D4 | Markets for regulator maps after AE / SA / PK | add each client's market at onboarding; GB and US next if sales need them | Wave 0 / 3 |
| D5 | Fact store keeps raw wording, a normalised fact, or both? | both, normalised shown for approval | Wave 3 |
| D6 | techand.ai spelling: their style guide says British, their site writes American | ask them before the next page | now |
| D7 | Cross-family judge (OpenAI or Google key, privacy text, DPA) | not before Wave 6 and the gold-set evidence | Wave 6 |
| D8 | Credit quote for a written page (§6.2) | raise to measured cost and charge holds only for the check | Wave 0 |
| D9 | Budget for two external SEO raters (about one day each) and asking techand's reviewer to score two more pages | yes to both | Wave 2 |
| D10 | Self-ranked "best X" lists and "top partners in [city]" pages naming competitors | allowed only with disclosure, equal criteria and owner approval per page | Wave 4 |
| D11 | Service + location pages for service-area businesses with no office in a city | only with a real presence there (staff or named projects) or a materially different offer, else hold | Wave 4 |
| D12 | Order of new page types | Comparison, Pricing, Industry, then Location, Answer; Glossary and Listicle last | Wave 4 |
| D13 | Make Finalize asynchronous if latency grows | yes if p95 > 3 minutes | Wave 0 / 2 |
| D14 | Volume caps per site | at most 2 location pages and 2 glossary or answer pages a month; new AI-written URLs in 90 days at most 10% of the site's indexed pages (*our choice*, tune after Wave 5 data) | Wave 4 |
| D15 | Arabic or bilingual pages for UAE and KSA clients | decide after asking current UAE clients; not before Wave 4 | Wave 4 |
| D16 | Run the techand.ai refresh by hand now, or after Wave 1 | after Wave 1 (the automated path); by hand now only if they want the page this week | now |
| D17 | Shadow-mode length for automatic holds | two cadence cycles, then on, unless the free read of 30 runs (§3.0) shows a hold rate above 40% | Wave 0 |

### 7.3 What we explicitly will not do

From R1 §12, R2 §3.4 and R3, each with the reason on record:
1. Autopilot publishing by default (Google: manual review is critical; every bulk-writer failure lacked review) [R1 §12.1, §9].
2. Sell volume packages ("30 articles a month") as the product [R1 §12.2].
3. Use a single 0-100 score, ours or anyone's, as the gate; the gate is the blocker list plus per-dimension floors [R1 §12.3, CQ-R2 §1,
   RE H2].
4. AI-detector "humanising" loops [R1 §12.4].
5. Self-serving "best X" lists without evidence and disclosure [R1 §12.5, R3 §3.8].
6. City-swapped location pages or one-click local landing pages from Business Profile data [R1 §12.6, R3 §3.2].
7. Clone competitor topic lists or sitemaps [R1 §12.7].
8. Invent or pen-name authors, testimonials, numbers, case results, offers [R1 §12.8, CQ-R2 §3.6].
9. Bump dates without substantive change [R1 §12.9, R2 §3.4].
10. Promise positions or dates to rank [R1 §8, §12.10].
11. Let the writer model grade its own page with the writer's prompt [R1 §12.11, R5 §5.5].
12. Chase a length or term-coverage target that creates sections [R1 §12.12, R5 §3.4].
13. Add FAQPage or HowTo schema, llms.txt, or "schema gets you cited" promises [R3 §0.5, R2 §3.4, RE sources 4 and 11].
14. Write chunked "LLM versions" of pages [R2 §1, rule 7].
15. Use Google's Indexing API for normal pages [R2 §6.2].
16. Send client page text to a second AI vendor without the owner's decision and a DPA [R5 §5.3].
17. Quote the Workshop Digital refresh numbers to customers (one agency's own site) [RE M6].

---

## 8. What to tell techand.ai now

Re-read the live page immediately before sending; this section reflects the capture of 2026-10-28 21:28 [RE H6].

**What went wrong, in one paragraph.** Our system should not have written a new service page for "ms 365 erp": our own check scored the
keyword 42/100, Google shows explainers for that search, and their site already has a guide on the same question and a Business Central
page for the same buyer. We wrote it anyway; our checks then broke the meta description in our version, the final version dropped the
warning that a page for the same search already existed, two of the client's answers were inserted in the wrong place, and our grade
measured form instead of what their reviewer measured. Their reviewer's 63 is fair; we agree with the deductions on fit, proof, local
accuracy, structure and publish readiness.

**A correction to what we told them.** British spelling did not come from a UAE default: their stored style guide says British English,
while their own pages mostly use American spelling [R4 §1.1]. We will ask which they want and set it (D6).

**The e-invoicing timeline, sent by hand today** (it should be on the page and nothing on our side will put it there before tomorrow):
Phase 1, businesses with revenue of AED 50m and above, appoint an accredited service provider by **30 October 2026** and go live on
**1 January 2027**; Phase 2 31 March / 1 July 2027; government entities 1 October 2027. Source: KPMG's summary of 22 July 2026; secondary
reports describe 30 October as an extension of an original 31 July 2026 date under an amended Ministerial Decision. Both points should be
confirmed on the Ministry of Finance's own text before they publish it. From 31 October the page must say the appointment deadline has
passed, not that it is coming.

**Quick fixes on the live page (their side, about 15 minutes):**
1. Remove the sector sentence and the "deep UAE & GCC knowledge" sentence from the "Data hosting" checklist item (our Finalize step put
   them there).
2. Turn the "free of charge" banner heading back into a normal call-to-action line.
3. Set a page-specific `og:description` and `twitter:description` (both carry the site's generic slogan). The meta description itself
   is now a proper sentence on the live page; our page-review screen will keep showing the broken one until the Wave 0 read-time repair
   ships [RC L7].
4. The FAQPage markup they added earns no rich result since 7 May 2026; harmless, optional to keep.
5. We will correct "Microsoft Parter" in their stored business facts (we will not reuse it as a credential).

**What we recommend for the page itself (choose one):**
- **A. Merge into the guide (recommended).** Refresh their existing guide "Is Microsoft Dynamics 365 an ERP System?" (it ranked #32 for this
  search): answer the "Microsoft 365 vs Dynamics 365" naming confusion in its first paragraph, add the e-invoicing timeline above from the
  official source, link it to the Business Central service page, use "ms 365 erp" as a secondary keyword, then 301 the new
  `/ms-365-erp-uae` URL to the guide. One refresh, no self-competition, and it matches what Google shows [R3 §1.5, R2 §2.2, §5].
- **B. Turn it into their Dynamics 365 partner page.** Only if they have no partner page today: re-target it to a service-shaped search
  such as "dynamics 365 partner dubai" (provider pages and directories rank there [R3 §3.2]), keep it short and specific, and give it real
  proof: the Microsoft partner directory listing URL, named clients they may show, one dated outcome, a named lead with a role. Without
  that proof it will score low again, by any reviewer [R3 §3.1 (c)].

**What we fix on our side, and when.** The seven Wave 0 fixes (meta, blockers kept, an honest grade that cannot say 100 on a page like
this and removes the causes of repetition and weak sources, ask before writing under 50, answers woven into the right sentence and no
slogans as proof, local regulatory research, downloads) come first; the decide layer (no page for a search they already serve, page type
from Google's results, a refresh path) follows in Wave 1. We offer the option A refresh free **after Wave 1**, when the refresh path
exists; if they want it this week, we run it by hand with the existing guide as input and say so (D16) [RE H7]. The weak sources the
Critic flagged (Visionet, Landbase) are rewritten out from Wave 0 on new pages; on this page, remove or replace them by hand [RC note on
the eight defects]. We would value their reviewer scoring the refreshed page and one more page on the same six dimensions, so our grade
is calibrated against a real expert (D9). We will not promise a position or a date.

---

## 9. Review decisions

Both reviews were read in full and every disputed anchor was checked at HEAD `8c0eeb46` on 2026-10-29: `v5/code/Parse_Verdict.js` does
not exist and Parse Verdict is patched at `build_v4.py:867, 2774-2776, 3232-3234, 5457-5485, 8095-8097`; the content-score PDF patch is
at `:892`; `KWI.serpPageTypes` is called only by `Assess_Response.js`, `Build_Keyword_Strategy.js` and `Ladder_Clusters.js`;
`force_content: true` is set at `Cadence_Plan.js:600`, `Spawn_Case_Study_Run.js:7`, `Tracker_Report.js:253`, `Spawn_Page_Runs.js:28` and
`payload.ts:143`; `Build_WP_Draft.js:5` has the same newline-crossing regex; `finalStages: ['content']` at `constants.ts:169, 181`;
`Content_Log_Row.js:17` skips when no page was written; `questions_for_client` is `string[]` at `build_v4.py:12610`; Finalize calls
`PF.classify`, `PF.questions` and `PF.deliver` only; `extractFiles` already makes `.html`, `.md`, `.meta.json`; 3299's callback carries
`qa_blocking`, `verdict`, `score`, `score_withheld`, `meta.page_type`, `meta.originality` and `meta.inbound_links` but no band, terms,
facts, sources, style guide or site URLs; the live page capture has a proper meta description and FAQPage JSON-LD.

**Accepted and applied**: RC H1-H5, M1-M9, L1-L7; RE H1-H7, M1-M11, L2-L4. Where each landed is cited inline with its id.

**Partly accepted or rejected**:

| Item | Decision | Why |
|---|---|---|
| RC M6 last point ("a PDF or blocked official page yields none could be confirmed, never a secondary source") | rejected in favour of RE H5's two-source secondary tier | UAE ministries often publish in PDF or Arabic or behind script; dropping the single most useful fact helps no reader. Two independent agreeing secondary sources, labelled as such in the page, keep the claim honest; one secondary source is still refused |
| RE H2 floors "every dimension >= 50%" | accepted with one exception: the fit floor is waived after an explicit acknowledgement (the cap stays in the number) | otherwise every page a client insists on for a low-demand B2B term could never be Ready, which contradicts RE L4 ("a 10-search commercial term can be worth a page") |
| RE M3 "bands instead of a number until calibrated" | accepted from Wave 2; Wave 0 keeps a number | the Wave 0 grade is deterministic and its pins are numeric; bands arrive with the full rubric and judge, whose deflation RE §3.2 measured |
| RE L1 "cut the targets to the eight that gate" | partly accepted: the eight gate (plus T9 / T10 at the re-rating), the rest stay as reported targets | the owner asked for pages that rank fastest; dropping the outcome targets would remove the only measure of that. Marking them reported removes the gaming risk RE M5 describes |
| RE L1 "one judge" | accepted; Haiku narrow items kept only if they agree with Sonnet on the gold set | cheap and narrow; it does not add a shared-bias seat to the total |
| RE M11 "suggestion-only inbound links in Wave 1" | accepted, noting that suggestions already exist (`meta.inbound_links`) | in 3299 the pick was the duplicate guide itself; Wave 1 filters same-search pages and shows them, it does not build them from scratch |
| RE M7 "move the duplicate check before the brief in Wave 0" | accepted, using the existing title-token rule, with the hold's exemptions and shadow mode | the rule needs only the keyword and the site model; its precision is unmeasured, so automatic sources start in shadow mode |
| RE M6 relabel Workshop Digital "in R2" | applied in this plan only | R2 is not owned by this file; its owner should change R2 §2.2 to "one agency's own B2B site, 95 pages, analysed with an LLM, grade C-" |
| RC M7 "defer Word / PDF" | PDF kept in Wave 0 if it fits the time limits; Word deferred to Wave 2 | the owner asked for downloads; HTML, MD, meta.json and images ship regardless, the PDF needs only one Gotenberg node |
| RE H1 (c) Critic re-read as a gate | accepted as an interim Wave 0 gate, with the Goodhart risk recorded | it is the only calibrated-looking signal available before Wave 2; the separate grade judge replaces it as the gate in Wave 2 |
