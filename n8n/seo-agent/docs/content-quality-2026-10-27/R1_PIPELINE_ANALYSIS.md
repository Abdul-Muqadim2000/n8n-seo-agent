# R1: why every client page came out "not ready to publish" (pipeline analysis, 2026-10-27)

Read-only analysis of the four production page runs (n8n executions 949, 2195, 2552, 2575 of `SEOagentV4Full01`), decoded per node
and per run index, against the code at HEAD `a11be130` (`n8n/seo-agent/v5/code`, `v5/prompts`, `build_v4.py`). Client page text is
not reproduced here; short snippets only. "Round" = one *Content QA* pass. In all four runs: `qa_max_rounds = 2` (Normalize Input
CONFIG, `build_v4.py:786`), so the pipeline is always Copywriter -> QA 1 -> **one** Editor pass -> QA 2 -> deliver.

Classes used for every final reason:
- **(a)** fixable by the system alone (length, terms, keyword placement, snippet headings, dead links, research the system can do, wording);
- **(b)** needs the client (a fact only the client knows);
- **(c)** false positive or over-strict rule (true and on file, a call to action, advice to the reader, a 1-point miss, a checker bug).

Statements flagged as "about the business that nothing on file supports" are counted one by one and also labelled
**T** true and on file / on the client's own site, **G** generic advice read as a claim, **C** call to action, **I** invented specific.

---

## 1. Summary

| Page (exec) | Final reasons the client got | a | b | c | Dominant root cause |
|---|---|---|---|---|---|
| techand.ai "is microsoft dynamics 365 an erp system", Guide (949) | 2 dead links; 2 writer `[Confirm:]` notes; 13 "unsupported statements"; 3,481 words vs 1,800-3,000; coverage 89% vs 90%; keyword not in first 100 words; keyword used 2 times; "about 10 people" unsourced | 10 | 3 | 7 | The one Editor pass made the page worse on every blocking measure: it obeyed the Critic's "add your migration steps / cite Microsoft Learn" and wrote "We use five steps" (5 new flags) plus 2 guessed URLs that 404; promises flagged in round 1 were hidden from the Editor and wrapped in `[Confirm:]`, which the Editor is told to keep |
| techand.ai "ms 365 erp", Service Page (2195) | 1 statement; 666 words vs 900-2,400; snippet questions without heading | 2 | 0 | 1 | Editor answer cut off mid-word at the 32,768 ceiling (about 30,800 thinking tokens) and it replaced a complete 1,720-word draft; it had also been told to cut a page that was already inside the band down to 1,000 +/-10% |
| devaicon.com "ai in industrial automation", Guide (2552) | 2 statements; 1,079 words vs 1,200-1,600; coverage 71% vs 89%; competitor subtopics missing; snippet question without heading | 4 | 0 | 2 | Same cut-off: the Editor answer stops inside the CTA link (`[Book an industrial AI`); the last 7 sections and the CTA are gone, which is what the length, coverage and snippet reasons measure |
| techand.ai "erp systems in uae", Service Page refresh (2575) | 1 writer note; 2 statements; brand name "Techand" | 1 | 0 | 3 | The edit worked (2,573 -> 1,985 words, coverage 85 -> 100%); what is left is two call-to-action sentences read as promises, a brand check that flags the stored correct form, and a research task the writer left in brackets |
| **All four** | **33 final items** | **17 (52%)** | **3 (9%)** | **13 (39%)** | |

What the numbers say:
- **Nothing in the final reasons needed the client.** The 3 class-(b) items are three soft first-person stances in run 949 ("When
  Business Central, or no new ERP at all, is enough, we say so", a VAT-testing step, a support-ownership stance). Each could be
  deleted by the system without loss. The genuine client questions (Microsoft partner designation, reviewer job title, a publishable
  case study) appeared as round-1 placeholders and the Editor deleted them, so they never reached the client as questions.
- **Across both rounds 33 distinct sentences were flagged as unsupported promises: T 11 (33%), G 9 (27%), C 4 (12%), I 9 (27%).**
  73% were not invented claims. Of the 9 invented ones, 4 were written because the Strategy Brief told the writer to write them
  (experience notes / CTA), 2 because the Editor followed the Critic.
- **The Editor pass made 3 of 4 pages worse** (2 cut off, 1 regressed on coverage, keyword, claims and links). Only 2575 improved.
- **In 2 of 4 runs the client received half a page** (2195: the last 10 of 21 headed sections missing, the CTA among them; 2552: the last 7 of 17 headed
  sections and the CTA missing) while a complete Copywriter draft existed in the same execution.
- **"Rates itself low"**: the delivered PDF prints "Editorial Review Score 66/100 - revise" (`build_v4.py:894`), which is the Critic's
  score of the Copywriter's first draft. The Critic runs once; rounds 1 and 2 carry the identical score (66, 62, 66, 58), so the score
  never describes the page that was delivered.

---

## 2. Per-page traces

Common to all four: Strategy Brief (Opus 5.5) -> Copywriter (Opus 5.5, streaming, adaptive thinking, ceiling 32,768) -> Critic
(Sonnet 5.5, 12 problems every time, verdict `revise`) -> Promise Candidates (rules only: `promise_check.method = "rules"`, the
Haiku judge is off, `_promise_judge.js:16` `ENABLED_DEFAULT = false`) -> Content QA 1 -> Outbound Link Check -> Originality Check ->
Needs Revision? (true) -> Editor (Opus 5.5, ceiling 32,768) -> QA 2 -> Needs Revision? (false: `qa_round 2 = qa_max_rounds`) ->
delivered `not_ready`. Stop reason in all four: the rounds cap.

### 2.1 Exec 949, techand.ai, "is microsoft dynamics 365 an erp system" (Guide, ladder rung 2, 2026-10-22)

**Brief.** Target 2,900 words (outline sums to 2,900), band 1,800-3,000 from 5 ranking guides (median 2,898, middle half
1,752-3,223, clamped to the page-type ceiling 3,000; the #2 result has 4,044 words). 23 terms to use, coverage target 90% (best page
iesgp.com 92%, average 69%). 8 H2s, 5 objections, 3 information-gain items. Evidence plan: 5 sources, **all weak** (randgroup,
visionet UK guide, coherentmi, 6sense, msdynamicsworld). Experience notes told the writer to say that "before recommending a product
we run business discovery, gap-fit analysis and an ROI assessment in our Assess and Envision phase" and to add two `[Author insight:]`
brackets. The outline has a section "How we assess your Dynamics 365 ERP fit".

**Copywriter.** 3,534 words (+22% on target, +18% over the band top), complete. Keyword 4 times, in the first 100 words. Coverage 93%.
Quick answer after 134 words (limit 120). 3 placeholders ([Date], reviewer title, partner designation), 2 `[Author insight:]`.
QA 1 flagged 7 promise sentences and marked 6 of them `[Confirm: ...]` in the text.

**Critic.** 66, revise, 12 problems (4 high, 5 medium). Asked, among others: drop the weak market figures, "Cite Microsoft Learn",
"Add steps: inventory, extension re-write, report mapping, a parallel run", "Add a short banking-specific scenario", "Make [the exit
check] a visible box with 4-5 checkable bullets".

**QA 1** (fail, `editor_needed`): too long by 534; answer-first; 8 Critic warnings; brand "Techand" (false positive, section 3.5).

**Editor was told** (prompt 40,650 chars): "THE FIRST THING TO DO: CUT 534 words ... Do not add a single word"; 11 numbered problems, 8 of which
are Critic items that ask to add content; 12 Critic revision instructions (4 "add/expand", 4 "cut/remove"); LENGTH RULE "within 10%
of 2,900"; and the draft with 6 `[Confirm: ...]` promise markers, while `editor.txt:39` and `:44` say to keep `[Confirm: ...]` and
`[Author insight: ...]` markers. The promise list itself is **not** among the problems (Content QA puts promises in `auto_fixes` and
`not_ready_reasons`, never in `warnings`, and the editor prompt prints only `warnings`).

**Editor did**: 3,534 -> 3,481 words (-53 of the 534 asked). Removed the placeholders and author insights, moved the Quick answer up
(134 -> 61 words). Added "### Regulated banks and multi-site manufacturers", "### How to test our advice", and under "What makes a
legacy migration harder or easier" wrote "We use five steps:" followed by the Critic's five generic migration steps. Replaced weak
sources with 6 Microsoft Learn links and an MoF link, 2 of them guessed: `.../migration/migrate-dynamics-gp` and
`mof.gov.ae/en/public-finance/tax/e-invoicing/` (both 404). Left two writer notes about Microsoft's product ("Arabic interface ...
may be standard", "Ask Microsoft whether ... hosted in a UAE region"). Complete answer (not cut).

**QA 2** vs QA 1: coverage 93 -> 89%, keyword 4 -> 2, first-100-words lost, promises 7 -> 13, dead links 0 -> 2, new unsourced
"about 10 people (our rule of thumb)". Content score 97 -> 94. Delivered as not ready.

**Final reasons classified (20 items).**

| Reason | Class | Why |
|---|---|---|
| 2 links 404 | a | Guessed by the Editor; the link check already proposes a replacement for one |
| 2 writer notes on Microsoft's Arabic support and UAE hosting | a | Vendor facts the system can look up (Microsoft Learn localisation, Azure UAE regions); not a client fact |
| 5 migration steps under "We use five steps:" | a | Generic best practice put in the business's voice by the Editor on the Critic's instruction; rewording as advice clears them |
| "AED and multi-currency. Ask how AED base currency ..." | c (G) | A buyer checklist item, nothing about the business |
| "Before we recommend either product, we run business discovery ... in our Assess and Envision phase" | c (T) | Linked to the client's own page `/whatwedo/assess-envision`; the Brief instructed it |
| "We are a Microsoft partner, so weigh our view of SAP ..." | c (T) | "Microsoft partner" is in the business facts (support 33%: the rule needs 50% of content words) |
| "Run and Optimise: tuning processes and reports after go-live" | c (T) | The client's site has `/whatwedo/run-optimize`; only its title is in the corpus |
| "We will confirm whether Business Central or F&SCM suits your entities ..." | c (C) | The CTA; "Contact is by consultation request" is on file |
| "In those projects, we check that every VAT code feeds the correct return figure and test the provider connection ..." | b (I) | Invented process detail on a true service |
| "When Business Central, or no new ERP at all, is enough, we say so" | b (I) | Invented stance |
| "We treat support ownership as part of the product decision" | b (I) | Invented stance (soft) |
| 3,481 words vs 1,800-3,000 | c | The band was clamped to 3,000 below the middle-half top (3,223); #2 ranks with 4,044 |
| Coverage 89% vs 90% | c | One term short of a target set at the best competitor; the term list contains one-word terms ("management", "data", "platform") |
| Keyword not in first 100 words | a | Lost in the edit; deterministic fix |
| Keyword used 2 times | a | Lost in the edit (was 4); a 7-word question keyword |
| "about 10 people" | a | An invented rule of thumb; delete |

Also failing but not shown (the reason list keeps 4 warnings): brand "Techand" (c, checker bug) and 2 competitor subtopics (a).

### 2.2 Exec 2195, techand.ai, "ms 365 erp" (Service Page, weekly Content Cadence, 2026-10-25)

**Brief.** Target 1,000 words; band 900-2,400 is the **page-type** fallback (only 1 ranking service page). 20 terms, coverage target
77% (best 76%). Evidence plan: 2 sources, both weak (a Globe and Mail syndicated stock article, a gated Microsoft landing page with a
locale parameter). CTA written by the Brief: "we review your current systems ... then send you a written edition recommendation and
scope outline" (not on file). An H2 "How Tech& (legal name: Techand systems LLC) delivers ..." and 2 `[Author insight:]` prompts.

**Copywriter.** 1,720 words (+72% on target, inside the band), complete, 21 headed sections, ends on the CTA link. 6 keyword uses,
coverage 88%. 5 promises (4 T: helps pick the edition, multi-entity and global rollouts = `/whatwedo/global-rollouts`, review and
recommend, configure and migrate; 1 I: the written recommendation from the Brief's CTA). 2 placeholders + 2 author insights.

**Critic.** 62, revise, 12 problems. Revision instructions: "Expand the three delivery phases with the client inputs and an
indicative team time commitment per phase, flagged for confirmation where unverified" (asks for new client-specific content and
brackets), "Rewrite the SAP section with concrete decision rules", "Add a short 'will we outgrow Business Central?' passage", "Add
Microsoft Learn and Ministry of Finance links", plus cuts.

**QA 1** (fail): snippet heading; 7 Critic warnings; brand (false positive); duplicate-page warning (another page targets the same
search). Length was fine, so no CUT instruction.

**Editor was told**: 11 problems; 12 revision instructions (5 "add/expand"); and "Target word count: 1000 (the draft currently has
1720) ... LENGTH RULE: must land within 10% of the target ... Never exceed the target by more than 10%" (`editor.txt:12-13`), i.e.
cut a page that QA accepted to at most 1,100 words while adding five passages.

**Editor did**: 277.9 s, answer cut mid-word ("Does the add-on cover gratu") at the 32,768 ceiling, about 30,800 tokens of thinking
and 1,992 of answer (`docs/llm-limits-2026-10-27/LIMITS.md`). Sections kept were shortened by about half (e.g. 148 -> 48, 202 -> 83
words), then the last 10 headed sections, the CTA among them, were missing. The cut answer replaced the complete draft.

**QA 2**: 666 words (short), snippet questions for the two lost sections, 1 promise. Content score 89 -> 95 (the score rose on half a
page). Delivered as not ready; the client published a hand-finished version on 2026-10-26.

**Final reasons classified (3).** "Tech& ... explains which edition suits UAE firms" c (T/G); 666 words a (cut-off); snippet
questions a (cut-off).

### 2.3 Exec 2552, devaicon.com, "ai in industrial automation" (Guide, ladder rung 2, country Pakistan, 2026-10-26)

**Brief.** Target 1,520; band 1,200-1,600 from 3 guides (median 1,153). 23 terms, coverage target 89-90% (best 92%, average 66%).
Evidence plan 4 sources (a DataM report listing, a vendor blog, ...). Experience notes instructed: "Write that the team works from
Multan as well as Sharjah, so site visits and readiness reviews in Punjab are practical" and "Describe how an ISO 27001-run team
handles access control, logging and segmentation". CTA: "Devaicon ... returns a scoped pilot plan" (not on file).

**Copywriter.** 2,290 words (+51% on target, +43% over the band), complete, ends on the CTA. Coverage 86%. 4 promises: the ISO 27001
process (I, Brief-instructed), "one controls engineer and one data owner are named to own the pilot" (G), Multan (T), "You get back a
scoped pilot plan" (I, Brief CTA). 1 placeholder (`[Case study: ...]`) + 2 author insights.

**Critic.** 66, revise, 12 problems; asked to add a subsection on running AI without data scientists, 2-3 sentences on cost, a fuller
answer to the "foreign firm" objection, a scale legend for the matrix.

**QA 1** (fail): CUT 690 words; coverage 86 vs 89; 7 competitor subtopics to add ("Importance of Adopting AI ...", "Core Components
...", "AI-Driven Control Subsystems ..."); snippet heading; 7 Critic warnings.

**Editor was told**: cut 690 words, add 4 terms, add the competitor subtopics, add the Critic's passages; LENGTH RULE 1,520 +/-10%.

**Editor did**: added 5 new H3s for the competitor subtopics, shortened the first sections (158 -> 36, 286 -> 24 words), and the answer
stops inside the CTA link (`[Book an industrial AI`). Lost: the business case, the three-phase pilot plan, "what's next" (edge AI,
digital twins), the partner section and the CTA. Counted answer 2,608 tokens against a 32,768 ceiling: the rest was thinking.

**QA 2**: 1,079 words (short), coverage 71% (the lost sections carried "digital twin", "control systems", "real-time" ...), 4
subtopics, snippet question of the lost edge section, 2 promises.

**Final reasons classified (6).** "A controls engineer and data owner are named" c (G: roles the reader's plant names); "We work from
Multan as well as Sharjah ..." c (T: "Offices in Sharjah (UAE) and Multan (Pakistan)" is the first business fact; the rule found 27%
because the sentence adds "site visits ... practical", which the Brief itself wrote); length a, coverage a, subtopics a, snippet a
(all four are the cut-off).

### 2.4 Exec 2575, techand.ai, "erp systems in uae" (Service Page refresh, new ladder "erp & crm software" rung 1, 2026-10-26)

**Upstream defect first.** The rung's target URL is `https://www.techand.ai/insights/is-microsoft-dynamics-365-an-erp-system`, the
URL of the page run 949 wrote (published 2026-10-23). The run "refreshed" that page for a different keyword (21,197 characters of its
text were the existing page). The Critic flagged the slug conflict; QA kept the planned URL by rule (`auto_fixes`). Publishing it
would replace a published page for one search with a page for another (see mismatch audit D1/D3).

**Brief.** Target 1,300, band 900-2,400 (page-type fallback, 1 service page). Evidence plan 2 weak sources (a research listing, an
agency top-10 blog). Experience note: "introduce the self-check as the one our team uses in first consultations". CTA reuses the
client's "Get in-touch with our Experts" and the full brand form.

**Copywriter.** 2,573 words (+98% on target, +7% over the band), complete. Coverage 85% (target 60). 3 promises (partner stance T, the
self-check "in first consultations" I, CTA C). 1 placeholder (partner badge) + 2 author insights; 1 unsourced amount marked.

**Critic.** 58, revise; title over 60 characters "with the legal name pasted into the title", slug conflict, weak sources, placeholders.

**Editor was told**: CUT 173 words to 2,400 **and** LENGTH RULE 1,300 +/-10% (two different targets in one prompt).

**Editor did**: 2,573 -> 1,985 words, coverage 85 -> 100%, snippet heading added, brand mentions 5 -> 1, complete answer. It removed the
placeholders and author insights, and left `[Confirm: link the Microsoft Learn pages on Dynamics 365 data location and UAE
localisation.]`, a research task it could not do without URLs.

**Final reasons classified (4).** Writer note a (research); "Use our five-question rule, then book a consultation with Tech&" c (C);
"Book a consultation and we will test your shortlist against these criteria" c (C, consultation is on file); brand "Techand" c (bug).

---

## 3. Root causes, ranked by how many final failures they explain

Counts are over the 33 final items (section 1) unless stated.

### 3.1 One full-page Editor pass with no safety net (explains 10 final items directly; 3 of 4 pages made worse)

- **Cut-off** (2195, 2552): 6 final items (2 length, 1 coverage, 1 subtopics, 2 snippet) are measurements of a truncated page. The
  ceiling bug is fixed (`llm_limits.py`, 128,000; `Edit_Check.js` / `CK.edit` retries once and otherwise keeps the pre-edit page). That
  guard catches a cut, **not a regression**: run 949's edit was complete and still worse (4 more items: keyword x2, coverage, 404s),
  and it would pass `CK.edit` (98.5% of the input's words).
- **No "keep the better draft" rule.** `Content_QA.js:1004-1007` delivers whatever the last round read. Blocking-issue counts round 1
  -> round 2: 949 up, 2195 up (half a page), 2552 up (half a page), 2575 down. Nothing compares them.
- **One pass only**, by design (`build_v4.py:786`: "one editor pass: live tests showed a second pass inflates length"), with
  `editor_needed` (`Content_QA.js:998`) and `Needs Revision?` (`build_v4.py:2051`) stopping at `qa_round 2`.
- **A full rewrite to fix local issues.** Every edit re-emits the whole page (5,000-23,000 characters) with 11 problems and 12
  instructions; local properties that were fine (keyword in the first 100 words, terms used once, CTA) drift.

### 3.2 Contradictory instructions across Brief, Critic, Editor and QA (behind 949's and 2552's failures, 2195's over-cut)

| Contract | Who says what |
|---|---|
| Length | Brief sets one number (`strategy_brief.txt:96`); Copywriter "within 10% of target" (`copywriter.txt:62`, `:74`); Editor "within 10% of the target" (`editor.txt:13`); QA uses the **band** (`Content_QA.js:641-645`). 2195: QA accepted 1,720 (band 900-2,400) while the Editor was told <= 1,100. 2575: CUT to 2,400 and <= 1,430 in the same prompt. 949: target 2,900 +/-10% allows 3,190, the band stops at 3,000. |
| Adding vs cutting | QA: "CUT n words ... Do not add a single word" while the 8 Critic warnings and 12 instructions mostly ask to add (949: 4 add / 4 cut verbs; 2195: 5/5; 2552: 4/1) and QA itself adds "competitor subtopics" to add (2552: 7). |
| Brackets | Gate: any bracket in the body fails (`Content_QA.js:990`, `body_brackets === 0`). Brief: experience notes "else a bracketed prompt [Author insight: ...]" (`strategy_brief.txt:81`); Copywriter: a bracketed note "stays as a bracketed line" (`copywriter.txt:31`); Editor: "Keep every bracketed [Author insight: ...] line" (`editor.txt:44`) and keep `[Confirm: ...]` (`editor.txt:39`, `:42`); Critic suggests "a bracketed placeholder" as the fix for anything unverifiable (`critic.txt:20`) and in 2195 asked for "[to confirm at scoping]" hours. Every page starts with 2 `[Author insight:]` by construction. |
| Claims in the business's name | QA fails any (`Content_QA.js:990`, `claims_open === 0`). Brief asks for "2-4 first-hand experience passages ... what the business has seen or done" (`strategy_brief.txt:81`); Copywriter "in the business's voice ('In our projects ...')" (`copywriter.txt:31`); Critic's quality bar asks for "steps" and answered objections with no word about the rule (`critic.txt:16-20`) and told 949's Editor to "Add steps"; the Editor is never shown the promise list (3.3). |

The Copywriter also overshoots every target: +22%, +72%, +51%, +98% (mean +61%). The brief asks for 5 objections, 3-4 information-gain
items "covered fully", every FAQ as a heading, snippet targets, a table and "at least two specifics per section" (`copywriter.txt:65`)
inside 1,000-1,520 words. The load does not fit the budget, so the first QA round always opens with a cut.

### 3.3 The promise check: rules-only, a thin corpus, and a loop the Editor cannot close (18 final items, 11 of them c)

- **Precision in production is low.** Of 33 flagged sentences, 11 T + 9 G + 4 C = 24 (73%) are not invented claims. The labelled set
  (`harness/accuracy/CLAIMS_MODEL_EVAL.md`: hold-out precision 100%) has few of these shapes: a phase on the client's own site, advice
  to the reader inside a business section, an invitation that names what the consultation checks, a true fact with an inference
  added ("Multan ... site visits are practical"). The Haiku judge, which has exactly these kinds (`_promise_judge.js:36`:
  `advice_to_reader`, `call_to_action`, `pointer_to_page`), is off and was judged only on that set.
- **The corpus misses the client's own service pages.** `PJ.ownText` (`_promise_judge.js:23-28`) reads the business facts (670 /
  377 characters), the profile, the site model's service list and the 2-3 `client_pages` this run read (homepage plus one or two
  others). techand.ai's inventory lists `/whatwedo/assess-envision`, `/build-implement`, `/run-optimize`, `/managed-services`,
  `/global-rollouts`, but only their titles: 4 of the 11 T flags are on those pages.
- **The 50%-of-words support test** fails short true sentences that add any word ("We are a Microsoft partner, so weigh our view of SAP
  ..." = 33%; "We are a Dynamics 365 partner ..." = 0% against "Microsoft partner").
- **The Editor never sees the list.** Promises go to `auto_fixes` and `not_ready_reasons`, not `warnings`; the editor prompt prints
  only warnings (`editor.txt:5`), its rule for claims matches only the wording "Statements about ..." (`editor.txt:36`, the
  `business_claims` warning, not the promise list), and the promises arrive wrapped in `[Confirm: ...]`, which it is told to keep.
  Result: every round-1 promise either survives to delivery or disappears only by accident (rewrite, truncation).
- **The pipeline writes the promises it then refuses.** 4 of the 9 invented sentences were instructed by the Brief (2195 CTA
  deliverable, 2552 ISO process and pilot-plan CTA, 2575 "the one our team uses in first consultations"); 6 of 949's final flags were
  written by the Editor on the Critic's instruction.

### 3.4 Pass/fail is all-or-nothing with no severity (behind every page; 4 final items are c on thresholds alone)

- `passed_copy` requires `warnings.length === 0` (`Content_QA.js:989`). Every Critic problem of medium or high severity becomes a
  warning (`Content_QA.js:726`), and the Critic always returns 12 problems with 3-4 high ("List at most 12 problems ... Score 85+ only
  if you would publish it under your own name", `critic.txt:47`). Round 1 cannot pass while the Critic speaks, and the Critic is not
  re-run, so round 2 is judged without it.
- Hard thresholds with no tolerance: coverage 89 vs 90 fails (949); the target is the best competitor's share, not a range, and the
  term model carries one-word terms ("management", "data", "platform", "offers", "operations", "digital"); keyword exact-match count
  `>= 3` (`Content_QA.js:656`) on a 7-word question keyword; length band clamped at 3,000 under the ranking pages' own middle half
  (949); a page-type band used when only 1 page was measured (2195, 2575).
- Advisory items and blocking items share one list. A 1-point coverage miss, a brand-form false positive and a dead link all mean the
  same "not ready".

### 3.5 The stored brand form, and a brand check that flags it (1 final item; present in every techand.ai round; fixed in none)

- techand.ai's style guide stores `brand_form = "Tech& (legal name: Techand systems LLC)"`, its notes say "Always write the brand as
  Tech&", and `brand_wrong` includes "Techand" and also "Spelling: British English" (a field-splitting leak).
- The prompts obey the stored form: "Write the business name exactly as ... everywhere, including headings, the title and the meta
  description" (`_style_guide.js:70`), and the Brief's client facts repeat it. In every techand.ai draft the count of "legal name"
  equals the count of "Tech&": the parenthesis was written at **every** mention, including the title and an H2 (the 2575 Critic called
  it out).
- `check()` (`_style_guide.js:106-121`) counts each wrong form anywhere in the text, including inside the correct form: "Techand" in
  "(legal name: Techand systems LLC)" is a hit. Writing the brand exactly as instructed fails the check. It is a guaranteed false
  positive for this client.

### 3.6 Sources and research the Editor is asked to produce without the means (2 dead links + 3 writer notes = 5 final items, all a)

Evidence plans held only weak sources (949: 5 of 5 weak; 2195: 2 of 2; 2575: 2 of 2). The Critic, applying its source ladder
(`critic.txt`), asks for Microsoft Learn / Ministry of Finance links; the Editor has no search or fetch, so it guesses URLs (2 of 13
were 404 in 949) or leaves `[Confirm: link the Microsoft Learn pages ...]` (2575) or "[Confirm: Ask Microsoft whether ...]" (949).
These are questions about Microsoft's product, not about the client.

### 3.7 Delivery labels the page with the first draft's score

The Critic score shown in the PDF ("Editorial Review", `build_v4.py:894`) is round 1's on the Copywriter draft (66 / 62 / 66 / 58 in
both rounds); the content score shown in the app (`app/web/src/components/reports/article.tsx:314`) is round 2's (94 / 95 / 91 / 92).
The client sees a failing review score beside a high content score for one page.

---

## 4. What the writer knew about each client

| | techand.ai (949, 2195, 2575) | devaicon.com (2552) |
|---|---|---|
| Business facts | 670 chars: Microsoft partner, DAFZA, UAE + GCC, 20+ years, service list, "contact by consultation request, 24/7 support" | 377 chars: offices Sharjah + Multan, 18+ years / 550+ projects, "5 years / 100+ projects", 95% satisfaction, NPS 81.8, ISO 27001, AWS partner, Clutch awards, 24/7 |
| Profile (NAP) | Full: address, phone, e-mail, hours, 11 service areas | Sharjah address, phone; `business_type` empty |
| Author | "Tech& Technical Team", credentials and bio | name "Devaicon", job title "User", bio "He is a software developer ..." (onboarding data error) |
| Reviewer | Name only (no title, no URL) | None |
| Style guide | Yes, with the bad brand form and a leaked "Spelling: British English" wrong form | None |
| Case studies / proof library | 0 / 0 (`proof_context: "none recorded"`) | 0 / 0 |
| Price / timeline facts | No price facts (angle rules removed price promises) | No price facts |
| Own pages read this run | 2-3 (homepage, `/whatwedo` or an insight page) of 39 inventory rows; service pages by title only | 2 (homepage, an insight) of 27 rows |
| Country | UAE | Pakistan, while the business text says UAE / GCC (mismatch audit M5) |

What was missing and led to invented claims: **how an engagement runs** (what the client gets after a consultation, the phases in the
client's own words, which is on its site but not read), **proof** (no case study, so the Brief's experience notes fell back to
first-person stances and `[Author insight:]` brackets), **credentials detail** (Microsoft partner designation, reviewer title), and
for devaicon the market (Pakistan run, UAE text). The round-1 placeholders name exactly these: partner designation, reviewer job
title and credential, a publishable case study, a partner badge. They are the short list to ask the client, and the current Editor
deletes them instead.

---

## 5. Cost and time

From `Run Ledger Settle` (Claude priced with Opus $4 / $20 and Sonnet $2 / $10 per million in / out, `_cost_cal.js:38-39`).

| Run | Wall time | Claude (recorded) | DataForSEO | Brief | Copywriter | Critic | Editor | Claude in / out tokens |
|---|---|---|---|---|---|---|---|---|
| 949 | 17.5 min | $1.142 | $0.026 | $0.393 | $0.293 | $0.061 | $0.289 | 92,428 / 46,988 |
| 2195 | 17.7 min | $0.850 | $0.016 | $0.351 | $0.207 | $0.047 | $0.142 | 83,736 / 34,025 |
| 2552 | 17.6 min | $0.854 | $0.016 | $0.338 | $0.221 | $0.046 | $0.157 | 76,227 / 34,388 |
| 2575 | 15.5 min | $1.039 | $0.016 | $0.378 | $0.277 | $0.053 | $0.212 | 97,402 / 41,096 |
| Mean | 17.1 min | $0.971 | $0.019 | $0.365 | $0.250 | $0.052 | $0.200 | |

- The recorded figures model Opus thinking at 3,277 tokens a call. Timing in 2195 shows about 13,900 thinking tokens for the
  Copywriter (154.8 s) and about 30,800 for the Editor (277.9 s, at about 118 tokens/s; `LIMITS.md`). Re-priced, that Editor call is
  about $0.69 (not $0.14) and the Copywriter about $0.42 (not $0.21): **a real page run is likely $1.4-1.9 of Claude**, not $0.85-1.14.
- **One QA round today** = Editor (Opus) + Content QA + outbound link fetch + originality (no model): about 4.5-5 minutes and
  $0.14-0.29 recorded, about $0.3-0.7 with real thinking. QA nodes themselves cost $0.
- With the 128,000 ceiling the Editor can now think more; expect a complete full-page edit to take 5-6 minutes. A quality-first
  design with up to 3 edit rounds adds at most about $1-2 and 10-15 minutes to a 17-minute run; targeted section edits (one section
  in, one section out) cost a fraction of a full-page rewrite.

---

## 6. Recommendations (ranked by failures explained; with where to change)

The evidence does not support "ask the client, then regenerate" as the main lever: 3 of 33 final items needed the client, and none
was a hard fact gap. It supports making the pipeline agree with itself, never delivering a worse draft than one it already had, and
grading issues by severity. The client questions are worth asking for E-E-A-T (proof, credentials), not to pass the gate.

1. **Never deliver a worse draft (fixes 3 of 4 regressions).** Score every candidate draft on one blocking-issue count (the same
   function QA uses) and deliver the best one; accept an edit only if that count goes down and no protected property breaks (CTA
   present, keyword in H1 / first 100 words, every section of the outline present, no new dead link). Where: `Content_QA.js` (expose
   the count), `Edit_Check.js` (extend `CK.edit` from "complete" to "not worse"), the delivery after the last round.

2. **Replace the single full rewrite with targeted fix passes.** Run deterministic fixes first (keyword into the first sentence,
   snippet question as a heading, dead link -> the suggested URL or drop the sentence, brand form, delete `[Author insight:]` lines
   with no answer), then edit **only the sections that carry a problem** (section in, section out), up to 3 rounds while the blocking
   count falls. Raise `qa_max_rounds` only together with rule 1. Where: a new kit beside `_draft_qa.js`; `editor.txt`; the
   `Needs Revision?` condition (`build_v4.py:2051`).

3. **One contract for length, brackets and claims, printed in every prompt.**
   - Length: the band, everywhere. Remove "within 10% of the target" from `editor.txt:12-13` and `copywriter.txt:62`, `:74`; give the
     Copywriter section budgets that sum to the band's middle and fewer mandatory items per 1,000 words; never let the Brief's target
     sit at the band's top (949).
   - Brackets: the Brief stops creating `[Author insight:]` prompts (`strategy_brief.txt:81`, `:105`); a missing experience becomes a
     question to the client in the report, not a bracket in the body. Remove the "keep the markers" lines (`editor.txt:39`, `:42`,
     `:44`) and the Critic's "bracketed placeholder" fix (`critic.txt:20`).
   - Claims: one rule in the Brief, Copywriter, Critic and Editor: "describe what the business does only with the facts on file; write
     method and steps as advice to the reader ('a sound migration ...'), never as 'we do'". Stop the Brief writing first-person
     experience notes and CTAs that name deliverables not on file (`strategy_brief.txt:81`, its CTA field). Give the Editor the promise
     list as numbered problems with "rewrite as advice to the reader, or delete", and send the draft **without** QA's `[Confirm:]`
     marks (`Promise_Candidates.js` already strips them; do the same for the Editor input).

4. **Make the promise check accurate before it blocks.** Add the 33 production sentences of these runs to
   `harness/accuracy/claims.json` with labels (11 T, 9 G, 4 C, 9 I); read the client's own service pages (the `/whatwedo/*` and
   `/capabilities/*` inventory rows) into `ownText`; exempt invitations whose only promise is the consultation the facts state;
   re-evaluate the second reader (Haiku or Sonnet) on the new set and switch it on if it lifts G / C / T flags without losing I. Target
   on the production shapes: false flags under 10% of flags. Where: `_claims.js`, `_promise_judge.js:16`, `Collect_Client_Pages.js`.

5. **Severity, not a single flag.** Split QA output into `blocking` (dead link, cut-off, invented claim of kind I, placeholder in the
   body, originality failure, missing CTA, brand misspelt) and `advisory` (Critic notes, coverage within 5 points of target, subtopics,
   keyword count, length within the ranking pages' own range, style). Only `blocking` decides "not ready". Remove `warnings.length ===
   0` from `passed_copy` (`Content_QA.js:989`). Use a coverage target range (average to best), score terms by phrase, not one-word
   terms, and judge length against the ranking pages' middle half, not a clamp.

6. **Fix the brand form and the brand check.** Split `style_brand_form` into the brand ("Tech&") and an optional legal name, used only
   in the footer / schema `legalName`, never in titles or prose; validate the style-guide fields at save (the leaked "Spelling: British
   English"). In `_style_guide.js:106-117` mask every occurrence of the correct form (and of the legal name) before searching wrong forms.

7. **Give the edit step real sources.** Before an edit that a Critic or QA item asks to source, search and fetch the named official
   pages (Microsoft Learn, mof.gov.ae, tax.gov.ae) and pass only fetched, live URLs; the Editor may cite only those. Turn writer notes
   about third-party products into research tasks for that step, not client notes. Where: a new step before *Editor*, reusing the
   *Facts SERP* / *Refresh Sources* machinery and the link check's suggestions.

8. **Critic: advisory, informed and current.** Tell it the length band, the claim rule and the bracket rule; cap its "add" asks by the
   word budget; run it again on the delivered draft and print that score (or none) in the PDF (`build_v4.py:894`). Its problems feed
   the targeted passes, not the gate.

9. **Ask the client once, then finish without a new run.** From the round-1 placeholders and the I-kind claims, build a short
   question list (in these runs: Microsoft partner designation; reviewer job title and credential; one publishable case study or
   outcome; what the client receives after a consultation; whether the stance sentences are true). Store answers in the business facts
   / profile / proof library (so later pages use them) and apply them with one targeted pass on the stored draft (no new research, no
   new brief).

10. **Upstream guards these runs exposed.** A ladder rung must not target the URL of a published page written for another keyword
    (2575 refreshed 949's page for "erp systems in uae"); validate onboarding author data (devaicon: author "Devaicon", title "User");
    the market mismatch (Pakistan run, UAE text) belongs to mismatch audit M5.

Expected effect on these four runs (by the classification above): with 1 + 2 + 3 + 5 + 6, 949 would have kept its 93% coverage, its
keyword placement and no dead links, with 3 stance sentences to delete; 2195 and 2552 would have delivered the complete Copywriter
drafts with their snippet headings added; 2575 would have passed. The remaining client input would be the E-E-A-T questions of
recommendation 9, which no current page needs to be publishable.
