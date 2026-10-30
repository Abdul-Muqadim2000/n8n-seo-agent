# R5: measuring page quality so our grade agrees with expert reviewers and independent LLM judges (2026-10-29)

Read-only research and design. No code changed, nothing deployed, no paid API called. It extends
`docs/content-quality-2026-10-27/R1_PIPELINE_ANALYSIS.md` (why pages came out not ready, §3.7 "the delivery labels the page with the first
draft's score") and `R2_MARKET_RESEARCH.md` (§1: every vendor score is advisory; §3.3: content scores correlate weakly with rankings). It
does not repeat them.

Evidence used: production executions 3299 (page run, techand.ai, "ms 365 erp", Service Page, 2026-10-28) and 3336 (Finalize), read from the
saved copies; R1's traces of 949, 2195, 2552 and 2575; the code at HEAD (`v5/code/Content_QA.js`, `Page_Candidates.js`, `_page_fix.js`,
`Finalize_Verdict.js`, `Blog_Package.js`, `v5/prompts/critic.txt`, `_cost_cal.js`); the client reviewer's scores as relayed (63/100 with six
dimension scores). Client page text is not reproduced; short snippets only. Source labels: **[doc]** official documentation, **[evidence]**
peer-reviewed or primary study, **[vendor claim]**, **[thin]** weak or single source. Every source in §9 was opened on 2026-10-29.

---

## 0. The answer in brief

1. **The 92 and the 100 were not LLM flattery. They were arithmetic on the wrong things.** Our grade is six code-measured components
   (structure 25, coverage 25, readability 15, specificity 10, clean language 10, length 15). On the "ms 365 erp" page they scored 25 / 25 /
   15 / 10 / 10 / 7 = 92 on the delivered page and 25 / 25 / 15 / 10 / 10 / 15 = **100** on the final version. None of the six measures
   intent fit, proof, source quality, local accuracy, repetition, padding or publish errors, which is where the reviewer took off 37 points.
   The structure check even gave full marks for a broken meta description, because it tests only `metaDesc.length <= 155` and the 20-character
   "Slug: ms-365-erp-uae" passes (`Content_QA.js:760`).
2. **We already had a judge that agreed with the client.** The Critic (Sonnet 5.5) scored the first draft **66**; the client's reviewer scored
   the published page **63**. Its 12 problems name the same faults the client named: weak market sources (Visionet / Landbase), unsupported
   e-invoicing claims with no Ministry of Finance source, padding sections ("big companies", "agentic ERP"), a thin SAP answer, no proof of
   the partner's own, lists that repeat each other. Its score gates nothing and is shown only as "the first draft's review" (`Page_Candidates.js:91`).
   The cheapest big win is to stop throwing that signal away.
3. **Measure what the reviewer measures.** A 100-point rubric with the reviewer's six dimensions (usefulness 25, fit with what ranks 20, proof
   and trust 15, local accuracy 15, structure and readability 15, ready to publish 10), page-type aware weights, each dimension broken into
   atomic yes/no items, each item owned by code, by a judge, or by both (§3, §4).
4. **Caps, not only points.** A total of weighted items still lets a page with one fatal flaw score 90. Caps fix that: an open blocker caps
   the grade at 59, a verdict under 50 that the client did not accept caps "fit" at 8 of 20, a published page for the same search caps "fit"
   at 6, no official source for a regulated claim caps "local accuracy" at 9 (§3.3). On the techand page the new rubric lands at about **60**,
   not ready (meta blocker), against the reviewer's 63 (§3.5).
5. **Judge with a small panel, not one model, and never the writer's prompt.** Research is consistent: single judges carry position,
   verbosity and self-preference bias [evidence: Zheng 2023; Panickssery 2024], lean lenient [evidence: Thakur 2024-2025], and agree with
   experts only where they could answer themselves unless given references [evidence: Krumdick 2025-2026]. Panels from different families
   beat one large judge and cost less [evidence: Verga 2024]. Binary checklists raise agreement between judges by 0.45 and cut variance
   [evidence: CheckEval, EMNLP 2025]. Absolute scoring is more robust to superficial "distractor" features than pairwise (preferences flip 35%
   vs 9%) [evidence: Tripathi 2025].
6. **Panel design**: Sonnet 5.5 checklist judge + a cross-family judge (GPT-5.4 mini direct API, or Gemini 3.1 Pro) + Haiku 5.5 deterministic-
   style checklist; quotes required and verified in code; majority per item; disagreement shown as a range and escalated to Opus 5.5.
   **About $0.08 per grading, $0.15-0.25 per page** (graded twice, some escalations), against a page run of $1.4-1.9 (R1 §5). DataForSEO's
   LLM Responses endpoints, which we already pay for, **cannot** carry a page: `user_prompt` and each `message_chain` item are capped at 500
   characters [doc]. A cross-family judge needs an OpenAI or Google API key: an owner decision (§5.3).
7. **A gold set from our own pages**: the 12 real versions we hold (949, 2195, 2552, 2575, 3299 drafts / delivered / final / published) with
   independent human labels, the client's 63 as the one external expert label, and ~90 synthetic broken variants made by code from good
   pages (broken meta, spliced sentence, appended answer fragment, the same claim six times, weak source swapped in, official source removed,
   wrong regulatory date, explainer SERP for a service page...). Targets: per-dimension quadratic-weighted kappa >= 0.6, overall MAE <= 8 points
   and Spearman >= 0.7 on real pages, blocker recall >= 95% and false blocks <= 5% on variants, 100% of directional tests (§6).
8. **A harness scenario fails the build** when a directional test fails, blocker recall drops, the replayed panel answers drift past the
   targets, or the "ms 365 erp" final version scores above 70 again. The panel's answers are recorded and replayed offline (the pattern of
   `harness/accuracy/claims_model_answers.json`); a paid re-calibration is a separate, capped script (§6.4).
9. **Label the grade honestly**: "Ready to publish" and the grade are two separate things; the grade shows its six bars, each tagged
   "measured by rules", "judged by 3 independent AI reviewers" or "needs you"; a disagreement shows a range; the grade never shows 100
   (top band "95+"); calibration is claimed only once measured ("matched expert reviewers within N points on M pages"); a first-draft score is
   never shown next to the delivered grade (§7).

---

## 1. What we measure today, and why it said 92 then 100

### 1.1 The score

`Content_QA.js:759-773`:

| Component | Points | How it is measured | On the delivered page (3299) | On the final version (3336) | What the reviewer saw |
|---|---|---|---|---|---|
| structure | 25 | 10 booleans: title <= 60, **meta present and <= 155**, H1, >= 4 H2, quick answer, >= 3 answered question headings, a table, last H2 not FAQ, internal links, keyword count >= 3 with density <= 2% | 25 | 25 | broken meta, two different "five questions" lists, padding sections, a spliced sentence |
| coverage | 25 | share of the term model the page uses, against the best competitor's share | 25 | 25 | "fit with what ranks 8/20": Google shows explainers, not service pages |
| readability | 15 | Flesch against the band of the pages that rank | 15 | 15 | readable, but repetitive |
| specificity | 10 | ratio of specific tokens | 10 | 10 | specifics present, sourced weakly |
| clean language | 10 | 10 minus 2 per banned phrase | 10 | 10 | British spelling (a setting), no complaint about clichés |
| length | 15 | `15 * (1 - |words - target| / target)` | 7 | 15 | not a dimension for the reviewer; Google lists writing to a word count as a warning sign [doc] |
| **total** | 100 | | **92** | **100** | **63** |

Every point the reviewer took off sits outside the six components. The one component that moved between versions is length, the one Google
says not to aim at: writing to a word count is one of its "search engine-first" warning signs, answered "(No, we don't.)" to the idea of a
preferred word count (Search Central, "Creating helpful, reliable, people-first content", updated 2026-10-05 [doc]).

### 1.2 The status

The status is decided separately, by the blocker list (`PF.classify` -> `PF.deliver`, `_page_fix.js:278-325`, `:518-528`):
- the page run delivered `not_ready` with one hard blocker, `duplicate_page` (the client already has a page for the same search);
- the Finalize run re-read the final version with `PF.classify` but its *Originality Check* has no `duplicate_targets` (no site inventory
  in that workflow), so the blocker was not there to carry; `Finalize_Verdict.js` filters only textual items, so nothing re-added it. Status
  `ready`, label "Ready to publish", grade 100, advisory `meta_desc` and `answer_first`;
- the 20-character meta description was an advisory (`meta_desc`, weight 0.25), not a blocker.

### 1.3 The signals we had and did not use

| Signal | Value on "ms 365 erp" | Where it went |
|---|---|---|
| Critic score (Sonnet 5.5, first draft) | **66**, verdict revise, 12 problems (3 high) | shown as `first_draft_review`, gates nothing |
| Keyword verdict | **42/100**, GO_WITH_CHANGES; "a page built only on this 10-search keyword would be a poor use of effort"; change 1: make it a broader Dynamics 365 ERP service page with "ms 365 erp" as a secondary term | not in the grade, not in the status |
| Duplicate page | an existing page for the same search | blocker in the page run, lost in Finalize |
| Source tiers | weak sources counted (`source_quality`), the Critic named two as high severity | an advisory of 0.25 |
| Meta warning | the meta check fired | an advisory of 0.25 |

### 1.4 The reviewer's six dimensions against what we measure

| Reviewer dimension (points) | Client gave | Measured today? | By what |
|---|---|---|---|
| Usefulness (25) | 22 | partly | coverage, specificity (proxies) |
| Fit with what ranks (20) | 8 | **no** | the verdict knows; the grade does not read it |
| Proof and trust (15) | 7 | **no** in the grade | claim check blocks invented claims, nothing scores proof or source quality |
| UAE accuracy (15) | 11 | **no** | no local fact pack, no official-source rule in the grade |
| Structure (15) | 12 | partly | headings and blocks counted; repetition, padding, duplicate lists not measured |
| Ready to publish (10) | 3 | partly, wrongly | meta "present and short" passes a broken meta; no spliced-sentence check; images and spelling not graded |

Conclusion: **two of six dimensions are not measured at all and three are measured by proxies that a broken page can max out.** No judge
calibration can fix a grade that does not look at the right things. §3 fixes what is measured; §5 fixes who judges it.

### 1.5 A finding that shapes the design

Across R1's four runs and 3299, the Critic's score of the first draft (66, 62, 66, 58, 66) sits in the 58-66 band, and the one external expert
label we have is 63. Our code grade on the delivered pages ranged 91-95 (R1 §1: 94, 95, 91, 92; 3299: 92) and 100 on the final version. The LLM critic was the calibrated instrument; the code score was
the inflated one. This is the opposite of the usual fear (LLM self-grading inflation), and it says two things: (a) keep a well-prompted LLM
judge in the loop and connect it to the grade, and (b) the code score must stop rewarding form that a broken page can satisfy. One label is
not a calibration, which is why §6 exists.

---

## 2. Research: what is known about grading text with LLMs (as of October 2026)

### 2.1 Biases a single judge carries

- **Position, verbosity, self-enhancement.** MT-Bench / Chatbot Arena: strong judges reach "over 80% agreement" with human preferences, the
  level humans reach with each other, and carry "position, verbosity, and self-enhancement biases" [evidence: Zheng et al., NeurIPS 2023
  Datasets and Benchmarks].
- **Self-preference is real and linked to self-recognition.** Judges score their own outputs higher than others' of equal human-rated quality;
  the strength of the bias correlates linearly with how well the model recognises its own text [evidence: Panickssery, Bowman, Feng,
  NeurIPS 2024]. A follow-up ties the effect to familiarity: judges rate low-perplexity text higher than humans do, whether or not it is
  their own [evidence: Wataoka et al. 2024, arXiv 2410.21819, from the search summary; abstract not opened, so treat as [thin]].
  For us: Opus writes, Sonnet judges; same family, so the risk applies even though the Critic was not inflated on these pages.
- **Leniency, and percent agreement hides it.** Only the best and largest judges reach reasonable alignment with humans, still below
  human-human agreement, with "a tendency toward leniency", scores up to 5 points off, and judges with high percent agreement that "can still
  assign vastly different scores"; the authors call for "alignment metrics beyond simple percent alignment" [evidence: Thakur et al., v5
  2025-01, v6 2025-08].
- **A judge cannot grade what it does not know.** Without a correct reference, judges agree with human experts "only on questions the judges
  were able to correctly answer themselves"; giving judges expert-written reference answers largely fixes it [evidence: Krumdick et al.,
  "No Free Labels", v4 2026-09-28]. For us: no judge will notice a missing UAE e-invoicing go-live date unless the judge is given the local
  fact pack. Local accuracy must be **reference-guided**.
- **Pairwise is more distractible than absolute scoring.** Pairwise preferences are "more vulnerable to distracted evaluation", biased toward
  assertive, long and sycophantic answers; they flip in about 35% of cases against 9% for absolute scores [evidence: Tripathi, Wadhwa,
  Durrett, Niekum, 2025-04, revised 2025-08]. For a grade shown to a client, absolute checklist scoring; pairwise only where we must pick
  between two drafts of the same page, with both orders run.

### 2.2 Methods that raise agreement with humans

- **Decompose into yes/no questions.** CheckEval turns criteria into "decomposed binary questions"; over 12 evaluator models it raised the
  average agreement across evaluators by 0.45 and reduced score variance [evidence: Lee et al., EMNLP 2025, v3 2025-10-31]. Practitioners
  report the same: binary pass/fail with a written critique beats 1-5 scales, which the author calls not actionable [thin-practitioner: Husain,
  "critique shadowing", 2024-10, updated 2026-09]; Anthropic's eval guidance asks for "detailed, clear rubrics", specific outputs and a grader
  that reasons first [doc: Claude docs, "Develop tests"], and recommends "atomic checks over holistic scores... a separate judge call per
  property" and testing the judge on known negatives [doc: Claude API skill, eval audit guide].
- **Panels of different families.** A panel of three smaller judges from three families (Command R, Haiku, GPT-3.5) beat a single GPT-4
  judge across six datasets, with less intra-model bias, at more than seven times lower cost [evidence: Verga et al., Cohere, 2024].
- **Calibrate the judge to humans.** LLM-Rubric asks rubric questions, keeps the model's probability per answer, and fits a small network
  (judge-specific and shared parameters) to human ratings: RMS error under 0.5 on a 1-4 scale, 2x better than uncalibrated [evidence:
  Hashemi et al., ACL 2024]. Lesson for us: raw judge numbers are not the client's scale; a monotone map fitted on labelled pages is.
- **Abstain when unsure.** Trust or Escalate: estimate the judge's confidence, trust it only above a threshold tuned on a small calibration
  set, escalate to a stronger judge otherwise; a cheap cascade "guarantees over 80% human agreement with almost 80% test coverage" where GPT-4
  alone "almost never" reaches 80% [evidence: Jung, Brahman, Choi, ICLR 2025]. For us: when panel judges disagree, show a range and escalate,
  instead of averaging into a confident number.
- **Use a different model from the writer.** "Generally best practice to evaluate with a different model from the one used to generate the
  evaluated output" [doc: Claude docs, "Develop tests"].

### 2.3 Agreement metrics, and which to use for what

| Question | Metric | Why |
|---|---|---|
| Does the overall grade rank pages like the expert? | Spearman rho | rank agreement, robust to scale offsets |
| Is the number itself right? | MAE in points (and the mean signed error, to see inflation) | the client reads the number |
| Does each dimension band agree? | quadratic-weighted Cohen's kappa on 5 bands per dimension | ordinal, chance-corrected; Thakur shows percent agreement overstates |
| Does a blocker fire when it should? | recall (TPR) and specificity (TNR) separately, not accuracy | imbalanced: most pages have few blockers [thin-practitioner: Husain] |
| How good can any grader be here? | inter-human agreement (Krippendorff's alpha or weighted kappa between two human raters) | the ceiling; judges stay below it [evidence: Thakur] |

### 2.4 Google as a rubric source

- **Search Quality Rater Guidelines, version of September 11, 2025** [doc], read from Google's PDF. §3.2: main content quality is judged by
  "effort, originality, and talent or skill", and for informational and YMYL pages "accuracy and consistency with well established expert
  consensus is important". §5.2.2: **filler**, "low-effort content that adds little value and doesn't directly support the purpose of the
  page... can artificially inflate content", rated Low when there is a large amount of it. §4.6.5 / §4.6.6: scaled content abuse and content
  "auto or AI generated... with little to no effort, little to no originality, and little to no added value" is Lowest. Part 3, Needs Met: the
  rating "is based on both the query and the result", which is exactly the reviewer's "fit with what ranks".
- **Creating helpful, people-first content**, updated 2026-10-05 [doc]: the self-assessment questions are a ready checklist
  (paraphrased): does the page add its own information, research or analysis; does it offer more value than the other results for the same
  search; does it have spelling or style problems or look hastily produced; does it contain easily verified factual errors; do the title and
  headings describe the content without exaggeration. Warning signs include writing to a word count, mostly summarising others without adding
  much, and readers having to search again. And: "of these aspects, trust is most important". The "Who, How, Why" section is the proof-and-trust dimension.
- What Google does not give us: weights or a number. The rubric weights below follow the client reviewer's split, which is also how the
  guidelines order importance (trust and purpose first, form last).

### 2.5 How content vendors score drafts (October 2026), beyond R2

| Vendor | What the score measures | Blocks? | Measures proof, accuracy, intent fit? |
|---|---|---|---|
| Ahrefs AI Content Helper | 0-100 "total coverage of all topics present in the top pages", per topic 0-100; pick one search intent from the SERP first [doc, help page 2026-09-03] | no thresholds stated | intent chosen by the user; no proof or accuracy |
| Semrush SEO Writing Assistant | overall score from Readability (Flesch, target = top-10 average), SEO, Originality (plagiarism), Tone of Voice [doc] | no; "Always review AI-generated content before publishing" | no |
| AirOps content review | 0-100: AI Discoverability 50 (information gain, search intent, E-E-A-T, readability) + Brand Adherence 50 [doc] | no fixed threshold; applies fixes after your approval | intent and E-E-A-T named, method not documented |
| Profound AEO Content Scorecard | weighted score of readability, freshness, structure, answerability, machine readability, information density; target zone from competitors [doc] | no gate | no proof or accuracy |
| Surfer, Clearscope, MarketMuse, Frase, Conductor | coverage-type scores (R2 §1) | no | no |

- Ahrefs' own study of five tools' scores against rankings found "weak correlations everywhere" and advises settling intent first [vendor
  claim: Ahrefs, the author's employer sells one of the tools].
- Agency scorecards published online weight E-E-A-T, intent, accuracy, structure and SEO differently from template to template; there is no
  standard [thin: search results for agency rubric templates, none authoritative].
- **Implication**: no vendor grade measures proof, source quality or local accuracy, and none is calibrated against expert reviewers in
  public. A grade that does both, and says how well it agrees with experts, is a differentiator, not a parity item.

---

## 3. The rubric

### 3.1 Dimensions, weights and items (default weights = the reviewer's)

Each item is a yes/no question with an owner: **D** deterministic code, **J** the judge panel, **R** a judge given a reference (verdict,
SERP digest, fact pack, business facts), **D+J** code proposes, judges confirm. Points per dimension are split across its items; a dimension
score is the weighted share of items passed, then the caps of §3.3 apply.

**A. Usefulness (25)** - does the page get the reader to their goal (QRG §3.2, helpful-content "content and quality")
- A1 J: the opening answers the searcher's main question in the first ~100 words (quote it).
- A2 R: the page answers the verdict's must-cover questions and the top "People also ask" questions (list given; quote each answer).
- A3 J: it gives decision help (a rule, criteria, a comparison, a next step) rather than description only.
- A4 J: it contains information gain: at least one thing the top-ranking pages do not say (the SERP digest is given).
- A5 J: every section serves the page's purpose; no section exists only to add words (QRG §5.2.2 filler). Quote any padding section.
- A6 D+J: the call to action fits the page type and the evidence on file (a service page asks for a consultation the facts state).

**B. Fit with what ranks / intent (20)** - Needs Met: the query and the result together
- B1 D: page type matches the dominant result type of the SERP read for this keyword (share of service vs guide vs list pages, from the
  pages already classified in the run; `_page_type.js`).
- B2 D: the keyword verdict score (>= 50 full, 30-49 half, < 30 none) and whether the verdict's "changes" were applied (judge-checked, B4).
- B3 D: no published page of this site already targets the same search (`duplicate_targets`, cannibalisation, `seo_pages`), or the page is
  explicitly written as an update of it.
- B4 R: the page follows the verdict's recommended angle (for 3299: a broader Dynamics 365 ERP service page with "ms 365 erp" as a secondary
  term) or states why not.
- B5 J: a searcher typing this keyword would be satisfied landing here, not sent back to search (helpful-content warning sign).

**C. Proof and trust (15)** - Who, How, Why; "trust is most important"
- C1 D: share of external citations from tiers 1-4 (official, research, major press, vendor docs) >= 60%; no market or compliance figure
  whose only source is tier 5 (the Critic's own ladder, `critic.txt`, made a code check).
- C2 D: every statement about the business is supported by facts on file (the existing claim check; open items here are blockers, §4).
- C3 J: the page shows the business's own proof where the page type needs it (named credential with a verifiable link, a case, a number on
  file); a homepage slogan is not proof ("Deep UAE & GCC knowledge" fails).
- C4 D: author and reviewer shown with role; no placeholder in the author box.
- C5 J: no superlative, guarantee or sector claim beyond what the facts state (the reviewer's "free consultation" and sector examples).

**D. Local and factual accuracy (15)** - QRG §3.2 accuracy; helpful-content "easily-verified factual errors"
- D1 R: every regulated fact in the fact pack that is relevant to the page (dates, thresholds, authorities; for UAE ERP pages, the e-invoicing
  timeline and the Ministry of Finance / FTA sources) is stated correctly or not contradicted; a relevant must-mention fact that is missing
  is a fail. The judge gets the fact pack with its sources; it does not use its own memory for dates.
- D2 D: regulated claims link an official source (`.gov.ae`, `mof.gov.ae`, `tax.gov.ae`, `u.ae` for UAE), and the link is live (outbound link check).
- D3 D: figures match their cited source (the existing `_sources.js` figure check).
- D4 J: product facts about third parties (Microsoft, SAP) are consistent with their documentation in the fact pack; vague or hedged answers
  to a direct comparison question fail (the reviewer's "vague SAP answer").
- D5 D: locale: currency, spelling setting, legal names, country consistent with the site's market (`spelling`, `country`, style guide).

**E. Structure and readability (15)** - incl. repetition and padding
- E1 D: one H1, a logical H2/H3 order, question headings answered in 40-60 words (existing checks, kept, at lower weight).
- E2 D+J: **repetition**: no idea stated more than twice. Code: sentence similarity across sections (shingles over content words, `_shingle.js`
  exists) and repeated 5-grams; judge: list the ideas stated 3+ times with the quotes. On the final "ms 365 erp" page at least four sentences
  restate "Microsoft 365 is the productivity suite"; the reviewer counted six expressions of the point.
- E3 D: no two lists or sections with the same label and different content ("five questions" twice); a closing reference to a list names one
  that exists once.
- E4 D: readability inside the band of the pages that rank (the existing Flesch band).
- E5 J: transitions and order: each section follows from the last; no orphan sentence that belongs elsewhere.

**F. Ready to publish (10)** - helpful-content "spelling or stylistic issues", "hastily produced"
- F1 D: meta description 120-160 characters, a real sentence, does not start with a field label (`Slug:`, `Title:`), contains no line break,
  is not empty after the claim rewrite. **Blocker** when it fails.
- F2 D: title present, <= 60 characters, no legal-name paste, keyword or close variant present.
- F3 D: no sentence fragments or splices: a sentence that starts lower-case, ends without punctuation, repeats the last 4 words of the
  previous sentence, or was inserted by Finalize into a paragraph whose topic words it does not share (the inserted answer is known by
  offset, so this is checkable). **Blocker** for an inserted answer that fails the topic test.
- F4 D: spelling and locale as configured; inconsistent spelling inside one page fails.
- F5 D: images: every image has alt text and a real file; a text-card image is reported (advice, not a fail, until real images exist).
- F6 D: no bracket, no `[Confirm:]`, no cut-off, no dead link, no placeholder (existing soft blockers).

### 3.2 Page-type weights (sum 100)

| Page type | A Useful | B Fit | C Proof | D Accuracy | E Structure | F Ready | Notes |
|---|---|---|---|---|---|---|---|
| Guide / blog (default) | 25 | 20 | 15 | 15 | 15 | 10 | information gain (A4) and answer-first weigh more |
| Service page | 20 | 20 | 25 | 10 | 15 | 10 | C3 proof and C5 claims dominate; B1 checks the SERP rewards service pages at all |
| Local page | 20 | 15 | 15 | 25 | 15 | 10 | D: NAP matches the profile, areas served, local regulation; B: local pack / map results present |
| Comparison / alternatives | 25 | 15 | 15 | 25 | 10 | 10 | D: fairness, each vendor's facts from its docs, dated; disclosure of the writer's own interest (C) |
| Hub / pillar | 20 | 20 | 10 | 10 | 30 | 10 | E: every cluster page linked, no overlap between sections and cluster pages |
| Case study | 15 | 10 | 40 | 15 | 10 | 10 | C: client named or anonymised by agreement, numbers from the client, no invented outcome |
| AI answer page | 25 | 20 | 15 | 20 | 10 | 10 | A1 answer in the first ~200 characters, quotable sentences, dated |
| Refresh of a published page | 25 | 15 | 15 | 20 | 15 | 10 | B3 inverted: must target the same URL; D: dated facts updated |

### 3.3 Caps (what stops "100 on a page like this")

Points reward; caps stop a sum from hiding a fatal flaw. Applied after the items, the lowest cap wins:

| Condition | Cap |
|---|---|
| Any open blocker (§4) | total <= 59, status not ready |
| Keyword verdict < 50 and the client did not choose "write it anyway" | B <= 8 of 20 |
| A published page of the site targets the same search and this page is not an update of it | B <= 6 of 20 |
| SERP shows < 20% pages of this page type in the top 10 | B <= 10 of 20 |
| A regulated claim without an official source, or a must-mention fact missing | D <= 9 of 15 |
| More than half of the citations tier 5, or a compliance figure sourced only to tier 5 | C <= 8 of 15 |
| An idea stated 4+ times | E <= 10 of 15 |
| Judges disagree by more than one band on a dimension | that dimension shown as a range; total shown as a range |
| Any grade | displayed maximum "95+", never 100 (no expert gives 100; §7) |

### 3.4 What leaves the grade

- **Length points go.** Length stays an advisory against the ranking pages' range (R1 rec. 5). Google says it has no preferred word count
  [doc]; the 15 length points were the only component that moved 92 -> 100.
- **Keyword count, density and term coverage** move from 25 + part of 25 to a few points inside A2 / E1. Coverage stays a useful *advice*
  list (R2: weak correlation with rankings).
- **The first-draft Critic score** is no longer shown as a score. The Critic stays as the editor's steering tool; the grade comes from the
  panel on the delivered page.

### 3.5 The techand page under the new rubric (worked estimate, final version 3336)

| Dimension | Estimate | Reason | Reviewer |
|---|---|---|---|
| A Usefulness (20 for a service page) | 17 | clear naming answer, decision table; padding sections (A5) fail | 22 / 25 |
| B Fit (20) | 6 | verdict 42 and not accepted; existing page for the same search; SERP mostly explainers (caps 8, 6, 10: lowest 6) | 8 / 20 |
| C Proof (25) | 11 | weak market sources (C1 fail), slogan as proof (C3 fail), unsupported "free consultation" (C5 fail); partner and DAFZA on file pass | 7 / 15 |
| D Accuracy (10) | 6 | e-invoicing go-live date missing, no MoF source (cap) | 11 / 15 |
| E Structure (15) | 10 | repetition cap (E2), two "five questions" lists (E3) | 12 / 15 |
| F Ready (10) | 2 | meta broken (F1 blocker), spliced sentence (F3 blocker), text-card images (advice) | 3 / 10 |
| **Total** | **52 -> capped at 59 max, shown 52, Not ready** | two blockers | **63** |

With the guide weights instead of service weights the same page lands near 58. Either way: not ready, and within about 10 points of the
reviewer, against 37 points off today. This is a design estimate, not a measurement; §6 is how it gets measured.

---

## 4. Who decides each item, and what it does

| Item | Owner | Role | Exists today? |
|---|---|---|---|
| Cut-off, copied text, duplicate page, brand form, author box placeholder | D | **block** (hard) | yes (`PF.classify`) |
| Unsupported statement about the business, figure not in its source, number without source, bracket, dead link, off-topic section, guarantee, testimonial | D (+ the claim judge when on) | **block** (soft: the system rewrites or removes) | yes |
| F1 meta broken / empty / label / multi-line | D | **block**; fix: regenerate the meta from the H1 + quick answer, then re-check | **new**; today advisory 0.25 and the reader is buggy (`Content_QA.js:154`, `Blog_Package.js:13`: `\s*` crosses the newline) |
| F3 inserted answer that does not fit the paragraph | D (+ J confirm) | **block** in Finalize | **new** |
| Every blocker of the page run (duplicate page, verdict acceptance) | D | carried into Finalize unless resolved | **new**: Finalize drops it today |
| B2 verdict < 50 not accepted by the client | D | **block before writing** (ask), then cap | **new** (another R-doc owns the ask) |
| D1 a must-mention regulated fact contradicted (wrong date or threshold) | R | **block** | **new** |
| D1 a must-mention fact missing | R | cap D, advice "add" | **new** |
| C1 compliance figure sourced only to tier 5 | D | cap C; advice | partly (Critic text only) |
| E2 repetition, E3 duplicate lists | D+J | cap E; advice with quotes | **new** |
| A5 padding sections | J | points; advice with the section names | Critic only |
| B1 page type vs SERP | D | cap B; advice | **new** (data exists in the run) |
| A1-A4, B4-B5, C3, C5, D4, E5 | J / R | points | **new** (Critic covers parts, unscored) |
| F2, F4, F5, E1, E4, coverage, length | D | points or advice | exists, re-weighted |

Rules for the block list: a blocker must be (1) checkable with evidence the client can see, (2) something a reader or Google would hold
against the page, (3) fixable. Judges never add a blocker alone except D1 (a contradicted regulated fact, with the reference quoted); every
other judge finding is points or advice. This keeps false blocks low (target <= 5%, §6).

---

## 5. The judge panel

### 5.1 What the judges see, and what they do not

**Given**: the page as published Markdown (meta lines included); page type; keyword; country; the verdict summary (score, reasons, changes,
exclusions); a SERP digest (top 10 titles, page types, word counts, PAA questions); the business facts and own-site facts; the local fact pack
with sources (dates, thresholds, authorities; reference for D1/D4); the checklist for that page type.
**Not given**: our code score, the Critic's score or problems, the writer prompts, which draft won, any client answer marked as "confirmed"
(the judge decides support from the facts, not from labels). Label deference and anchoring are documented failure modes [doc: Claude API
skill eval audit, "Label deference"].
**Output** (structured output, JSON schema, not free text; forced tool choice is a 400 on Opus 5.5 and Sonnet 5.5 [doc]): per item
`{id, pass: yes|no|n/a, quote, why}`. A "no" on a content item must quote the offending text; a "yes" on A1/A2/C3 must quote the passage.
Code then **verifies every quote is a substring of the page** (normalised); an unverifiable quote turns the item into "not shown" and is
logged as a judge error. This one check removes most hallucinated praise.

### 5.2 Panel members

| Seat | Model | Prompt | Role | Est. cost per grading |
|---|---|---|---|---|
| J1 | Claude Sonnet 5.5, effort medium | checklist, "senior SEO editor in {country}" | all J and R items | ~ $0.05 (7-8k in at $2/M, ~4k out incl. thinking at $10/M) |
| J2 | **a different family**: GPT-5.4 mini ($0.75 / $4.50 per M [doc: OpenAI model page]) or Gemini 3.1 Pro ($2 / $12 per M [doc: Gemini pricing, 2026-10-28]) | the same checklist, its own wording | all J and R items | ~ $0.02 (GPT-5.4 mini) or ~ $0.06 (Gemini 3.1 Pro) |
| J3 | Claude Haiku 5.5 ($0.10 / $0.50 per M [doc]) | binary checklist only, no reasoning text | the narrow items: A1, A5, E2 list, E3, F3 confirm, C5 | ~ $0.003 |
| Escalation | Claude Opus 5.5, effort high | holistic "expert reviewer" with the checklist results of J1-J3 hidden | only dimensions where J1 and J2 disagree by > 1 band | ~ $0.15 when used |

Prices for Claude are the Claude API list prices ($4/$20 Opus 5.5, $2/$10 Sonnet 5.5, $0.10/$0.50 Haiku 5.5, Batch 50% off) [doc: Claude API
skill model table, cached 2026-10-06]; `_cost_cal.js` lists Opus 5.5, Sonnet 5.5 and Haiku 4.5 but **not Haiku 5.5**, so it would be priced as
unknown until added. Gemini 3.5 Flash, which the AI visibility code names, is not on Google's pricing page as of 2026-10-28 (only 3.5
Flash-Lite at $0.30 / $2.50 is) [doc]; third-party lists put 3.5 Flash at $1.50 / $9.00 [thin].

**Per page**: graded twice (the delivered page in the page run; the final version in Finalize), escalation on ~20% of dimensions:
**about $0.15 (Claude + GPT-5.4 mini) to $0.25 (Claude + Gemini Pro)**, or 8-15% of a page run's real Claude spend ($1.4-1.9, R1 §5). The
calibration run over the gold set (~100 cases) costs about $8-12 per full pass.

### 5.3 The cross-family seat: options

| Option | Feasible? | Note |
|---|---|---|
| DataForSEO LLM Responses (chat_gpt / gemini / claude / perplexity), already paid | **no for whole pages** | `user_prompt` "up to 500 characters", `system_message` 500, `message_chain` max 10 items of 500 [doc]; a page is 12-20k characters. Usable only for short items (judge one meta description, one paragraph) |
| OpenAI API key (GPT-5.4 mini or larger) | yes | new credential, new vendor in the data path (client page text leaves to OpenAI): an owner decision, plus a line in the privacy text |
| Google Gemini API key | yes | same considerations |
| Claude only (fallback) | yes | J2 becomes Claude Opus 5.5 at effort low with a different persona and prompt; family bias stays; rely on checklist + quote verification + calibration; label the grade "reviewed by 3 AI reviewers (one model family)" |

Recommendation: start with **Claude-only** (no new vendor, can ship in the next build), measure on the gold set, then add one cross-family seat
if the gold set shows a family bias (mean signed error > +3 points on Claude-written pages against humans) or the owner wants the stronger
claim. The literature says panels of different families are better [evidence: Verga]; our own data (Critic 66 vs expert 63) says the Claude
judge is already close on this kind of page. Measure before paying for the claim.

### 5.4 Aggregation

1. Per item: majority of the judges that answered (J1, J2, plus J3 on its items). Ties go to the stricter answer only for D1 and C-items
   (trust), to the lenient one elsewhere.
2. Per dimension: weighted share of items passed -> raw score; then the caps (§3.3); then the **calibration map**: a monotone (isotonic)
   map per dimension fitted on the gold set's human labels (the LLM-Rubric idea without a neural network: we will have dozens of labels, not
   thousands). Until fitted, the map is the identity and the grade is labelled "not yet calibrated".
3. Confidence: a dimension is "uncertain" when J1 and J2 differ by more than one band (5 bands per dimension), or > 25% of its items had an
   unverifiable quote. Uncertain dimensions are escalated once (Opus); if still split, shown as a range (Trust or Escalate, [evidence]).
4. Total = sum of dimensions, shown as a point when no dimension is uncertain, as a range otherwise.

### 5.5 Stopping self-grading inflation (Goodhart included)

- The writer (Opus) never grades its own page with the writer's prompt; the grade panel has its own prompts and at least one seat from another
  family or, in the Claude-only start, another model and persona.
- The Editor is steered by the Critic and by QA findings, **not** by the panel prompt. If the Editor were optimised against the grading prompt,
  the grade would rise without the page improving (distractor features, [evidence: Tripathi]). The panel sees only the final candidate.
- Length-neutral instruction in every judge prompt ("do not reward length; a padded section is a fail"), plus A5 / E2 items that penalise
  padding, against verbosity bias [evidence: Zheng; doc: eval audit].
- Quote verification in code (5.1).
- Lift check in the gold set: for each real page we hold both the Copywriter draft and the delivered version; the grade's lift between them
  must not exceed the human raters' lift by more than 5 points on average. That is the direct measure of "our edits inflate our own grade".
- Drift: the recorded panel answers are replayed on every build (§6.4); a weekly sample of 5 production pages is re-graded and compared with
  the stored grade; a change in model version requires a re-calibration run before it is used for client grades.
- Pairwise only inside *Page Candidates* (two drafts of the same page), both orders, with "tie" allowed; never for the client-facing grade.

---

## 6. The gold set and the build gate

### 6.1 Real pages (the hard core)

| Case | Versions held | Known faults (from R1 / this run) |
|---|---|---|
| 949 techand.ai "is microsoft dynamics 365 an erp system" (Guide) | Copywriter draft, delivered | Editor made it worse; 2 dead guessed links; invented process lines |
| 2195 techand.ai "ms 365 erp" (Service) | Copywriter draft (complete), delivered (half page) | cut-off |
| 2552 devaicon.com "ai in industrial automation" (Guide) | Copywriter draft, delivered (cut) | cut-off, market mismatch |
| 2575 techand.ai "erp systems in uae" (Service refresh) | delivered | refreshed another keyword's URL |
| 3299 techand.ai "ms 365 erp" (Service) | Copywriter draft, delivered, Finalize 3336 final, the client-published page | everything in the client review |

That is about 12 versions. 949-2575 are not saved locally in this session; the run reports and the n8n API (read-only) hold them
(`capture_runs.py`, `harness/accuracy/capture.js` pattern). Only the meta lines, headings and the measured fields go into the repo; page text
stays in a git-ignored local fixture, as `docs/system-review-2026-10-11/files/` does (public repo).

**Labels.** Two raters label each version independently on the §3 rubric (items and dimension bands): the owner and one external SEO editor
who has not seen our grade. Disagreements are adjudicated and kept (they give the human ceiling). The client's reviewer's 63 with its six
dimension scores is stored as the one external expert label on the published page; ask the client whether they would score two more pages,
since outside labels are worth more than ours. Every future client score or rejection becomes a gold case (with consent; text kept local).

### 6.2 Synthetic broken variants (made by code, labelled by construction)

From each good base (the 3 complete Copywriter drafts and 2 clean delivered pages; plus 2 fresh pages from later runs), apply one
perturbation at a time. Each variant carries the item(s) that must fail and the direction the grade must move:

| Perturbation | Must fail | Expected |
|---|---|---|
| meta replaced by `Slug: x` / empty / two lines / 20 chars | F1 | blocker, not ready |
| one sentence moved into an unrelated paragraph | F3, E5 | blocker (if inserted by Finalize), E down |
| a client answer appended as a fragment to an unrelated paragraph | F3 | blocker |
| one idea restated in 4 / 6 sections | E2 | E capped, total down >= 3 |
| a second list with the same label and different items | E3 | E down |
| an off-purpose section added ("big companies that use X") | A5 | A down |
| official source swapped for a weak blog | C1, D2 | C, D down |
| a regulated date changed by one year | D1 | blocker |
| the regulated date removed | D1 (missing) | D capped |
| a homepage slogan placed as the proof line | C3 | C down |
| "free consultation" added with nothing on file | C5 / C2 | blocker (claim) |
| verdict context switched to 25 and not accepted | B2 | B capped |
| SERP digest switched to all explainers for a service page | B1 | B capped |
| a published duplicate page added to the inventory | B3 | blocker + B cap |
| page cut at 60% | F6 cut-off | blocker |
| spelling flipped mid-page | F4 | F down |
| known negatives: empty page; a page for another keyword; "I don't know" | many | grade < 20, not ready [doc: eval audit] |

About 15 perturbations x 6-7 bases = ~100 cases. They are cheap, exact, and they test the deterministic layer fully and the judges'
sensitivity.

### 6.3 Targets

| Measure | On | Target | Gate |
|---|---|---|---|
| Directional tests (grade of variant < base; named item fails) | synthetic | **100%** | build fails |
| Blocker recall (TPR) | synthetic blockers | >= 95% | build fails |
| False blocks (1 - TNR) | clean bases + real pages labelled ready | <= 5% | build fails |
| Overall MAE vs adjudicated human | real pages | <= 8 points | build fails on the recorded answers |
| Mean signed error (inflation) | real pages | within +/- 3 points | build fails |
| Spearman rho, overall | real pages | >= 0.7 | reported (n too small to gate at first) |
| Quadratic-weighted kappa per dimension | real pages | >= 0.6 | reported, gate once n >= 30 |
| Ready / not-ready agreement with humans | real pages | >= 90%, TPR and TNR shown separately | build fails |
| Regression pin: "ms 365 erp" final version (3336) | real | grade <= 70 and not ready | build fails |
| Human-human ceiling (two raters) | real pages | reported beside every judge figure | none |

Honesty about n: with ~12 real versions a 95% interval on MAE is wide (several points). That is why the synthetic directional tests and
blocker recall carry the gate from day one, and kappa joins the gate only when 30+ real labelled versions exist (§6.5).

### 6.4 The harness scenario (offline, every build)

`S-GRADE` in `harness/scenarios_v5.js`, beside S49:
1. Runs the deterministic grader (the new kit inlined in *Content QA* / *Page Candidates* / *Finalize Verdict*) over every gold case.
2. Replays the **recorded** panel answers (`harness/accuracy/grade_panel_answers.json`, the shape of `claims_model_answers.json`) through the
   real aggregation code: quote verification, majority, caps, calibration map.
3. Checks every row of §6.3 marked "build fails", prints the reported rows, and prints the human ceiling.
4. A change to a judge prompt or model invalidates the recorded answers (a hash of prompt + model id is stored with them): the scenario fails
   with "re-record the panel answers" until the paid script runs.

`harness/accuracy/eval_grade_panel.js` (paid, owner-approved, spend cap per run, key from `n8n/.env` via `env_settings.load_env()`, never
printed, as `eval_claims_model.js` does) calls the judges on the gold set, writes the answers and `GRADE_PANEL_EVAL.md` (per-dimension kappa,
MAE, signed error, TPR/TNR, by dev / hold-out split; the hold-out is never read while writing prompts, and the report says so if it was, as
`CLAIMS_MODEL_EVAL.md` already does).

### 6.5 After launch

- Every client edit of a delivered page is a weak label (the diff: what they cut, what they added, what they fixed); every client score is a
  strong one. Both feed the gold set monthly.
- A lagging outcome metric, reported and never used to tune the grade alone: impressions and position of graded pages after 8-12 weeks
  (Search Console, `seo_rank_history`). R2 §3.3 warns correlations will be weak and confounded.
- Re-calibrate (isotonic map) when 10 new labelled pages arrive or a judge model changes.

---

## 7. How the grade is shown to the client

Rules (each one answers something the client saw):
1. **Two answers, never merged.** "Can I publish this?" (Ready / Ready with questions / Not ready, from blockers only) and "How good is it?"
   (the grade). Today "Ready to publish" sat beside 100 while the page had a broken meta.
2. **Six bars, not one number first.** Usefulness, Fit with what ranks, Proof and trust, Accuracy for {country}, Structure, Ready to publish,
   each with points of its page-type maximum, and the total under them.
3. **Each bar says who measured it**: "checked by rules", "judged by 3 independent AI reviewers", "needs your input" (e.g. proof only the
   client has). A dimension the panel could not settle shows a range ("Proof: 7-10 of 15, reviewers disagreed").
4. **Never 100.** The top band reads "95+". The literature and the client both say a page is never perfect; a 100 invites the exact
   reaction we got.
5. **State the basis and the calibration, only once measured.** Before calibration: "Grade from our checks and AI reviewers; not yet compared
   with expert reviewers". After: "On {N} pages our grade was within {MAE} points of expert reviewers" (the real numbers from
   `GRADE_PANEL_EVAL.md`, refreshed with each calibration).
6. **What lowered it, in the client's words**, each with the quote and the fix: "The point that Microsoft 365 is not an ERP appears 6 times";
   "Only weak sources back the market figures"; "Google shows guides for this search, not service pages".
7. **No stale grades.** A grade belongs to one version (hash of the Markdown). Any edit in the page editor marks it "out of date, check
   again"; the app never shows a grade of a version the check did not read.
8. **No first-draft score** next to the delivered grade (R1 §3.7: 66 in the PDF beside 94 in the app confused clients). The PDF and the app
   show the same grade of the same version.
9. Marketing copy says what is real: "every page is checked by rules and by independent AI reviewers, and we tell you how often our grade
   matched expert reviewers" only after the eval exists; no "100/100" or "publish-ready guaranteed" anywhere (CLAUDE.md, business pages rule).

---

## 8. Where it goes in the build, and in what order

| Step | What | Where | Cost to run |
|---|---|---|---|
| G1 | Fix the meta reader (no newline crossing) in `Content_QA.js:154` and `Blog_Package.js:13`; meta check 120-160 + label test as a blocker with an automatic regenerate; Finalize carries the page run's hard blockers (store them on the report, re-check `duplicate_page` against the stored inventory); drop length points; never show 100 | `Content_QA.js`, `_page_fix.js`, `Finalize_Verdict.js`, `Finalize_Parse_Brief.js`, app `page-review.ts` | $0 |
| G2 | New deterministic items: F3 splice / inserted-answer topic test, E2 repetition (shingles), E3 duplicate lists, C1 tier share, D2 official source for regulated claims, B1 page type vs SERP, B2 verdict, B3 duplicate; the caps of §3.3 | a new kit `_grade.js` (one rule, used by Content QA, Page Candidates and Finalize Verdict, as `_page_fix.js` is today) | $0 |
| G3 | Gold set capture (real versions, local text), synthetic variant generator, two human label passes, `S-GRADE` with deterministic rows only | `harness/accuracy/grade_*.json`, `scenarios_v5.js` | human time ~1 day |
| G4 | Panel (Claude-only start): J1 Sonnet 5.5 + J2 Opus 5.5 low (other persona) + J3 Haiku 5.5, structured output, quote verification, aggregation, escalation; recorded answers; `eval_grade_panel.js`; add Haiku 5.5 to `_cost_cal.js` | new node(s) after *Page Candidates* finalize branch and in Finalize; prompts in `v5/prompts/grade_*.txt` | ~$0.2-0.3 per page; calibration ~$10 |
| G5 | Calibration map from the labels; app UI per §7; PDF uses the same grade | `page-review.ts`, `ReviewPanels.tsx`, `content.tsx`, `build_v4.py:894` | $0 |
| G6 | Optional cross-family seat after the owner's decision (§5.3) | credential + one HTTP node | +$0.02-0.06 per grading |

G1 and G2 alone would have stopped "100 Ready" on the techand page: the meta blocker, the carried duplicate-page blocker, the verdict cap
and the repetition cap all fire without any model call.

---

## 9. Risks and open questions

- **n is small.** Twelve real versions and one external label will not support strong claims; the gate leans on synthetic directional tests
  until 30+ real labels exist. Ask clients for scores; it is the scarcest input.
- **Our own labels can share our blind spots.** The external editor and client labels matter; the owner's labels alone would calibrate the
  grade to the owner.
- **Reference quality bounds D1.** The judge can only check local accuracy against the fact pack; a missing or stale fact pack makes D1
  silently lenient. The fact pack needs its own freshness date and sources (owned by the research R-doc).
- **Cross-family judges send client text to another vendor.** Privacy text, DPA and the owner's decision first.
- **Model updates move judges.** Pin model ids in the prompt hash; re-calibrate on change.
- **API drift**: forced tool choice is a 400 on Opus 5.5 / Sonnet 5.5 and sampling parameters are refused from API version 2026-10-21 [doc]; the
  judge nodes must use structured outputs and send no `temperature`. Check what n8n's Anthropic node sends before G4.
- **Open**: should a client be able to override a cap (e.g. "I want this page even with verdict 42")? Proposed: yes, recorded, and the grade
  then says "written on your request against our advice" rather than lifting the cap.
- **Open**: the reviewer's 63 is for the client-published page (they edited it). Store which version each label refers to.

---

## Sources (all opened 2026-10-29)

LLM-as-judge research
- Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023 D&B, https://arxiv.org/abs/2306.05685 [evidence]
- Panickssery, Bowman, Feng, "LLM Evaluators Recognize and Favor Their Own Generations", 2024, https://arxiv.org/abs/2404.13076 [evidence]
- Wataoka et al., self-preference and perplexity, 2024, https://arxiv.org/abs/2410.21819 (search summary only) [thin]
- Verga et al., "Replacing Judges with Juries: Evaluating LLM Generations with a Panel of Diverse Models", 2024, https://arxiv.org/abs/2404.18796v2 [evidence]
- Thakur et al., "Judging the Judges: Evaluating Alignment and Vulnerabilities in LLMs-as-Judges", v5 2025-01 / v6 2025-08, https://arxiv.org/abs/2406.12624v5 [evidence]
- Tripathi, Wadhwa, Durrett, Niekum, "Pairwise or Pointwise? Evaluating Feedback Protocols for Bias in LLM-Based Evaluation", 2025, https://arxiv.org/abs/2504.14716 [evidence]
- Lee et al., "CheckEval", EMNLP 2025, v3 2025-10-31, https://arxiv.org/abs/2403.18771 [evidence]
- Jung, Brahman, Choi, "Trust or Escalate: LLM Judges with Provable Guarantees for Human Agreement", ICLR 2025, https://arxiv.org/abs/2407.18370 [evidence]
- Hashemi et al., "LLM-Rubric: A Multidimensional, Calibrated Approach to Automated Evaluation of Natural Language Texts", ACL 2024, https://arxiv.org/abs/2501.00274 [evidence]
- Krumdick et al., "No Free Labels: Limitations of LLM-as-a-Judge Without Human Grounding", v4 2026-09-28, https://arxiv.org/abs/2503.05061 [evidence]
- Husain, "Creating a LLM-as-a-Judge That Drives Business Results", 2024-10-29, modified 2026-09-01, https://hamel.dev/blog/posts/llm-judge/ [thin, practitioner]

Model and API documentation
- Claude docs, "Create strong empirical evaluations" (grading methods, tips for LLM-based grading), https://platform.claude.com/docs/en/test-and-evaluate/develop-tests [doc]
- Claude API skill (bundled with Claude Code 2.1.311): model prices cached 2026-10-06, eval audit guide (judge biases, calibration, known negatives) [doc]
- DataForSEO, ChatGPT LLM Responses live (500-character `user_prompt`, `system_message`, `message_chain` limits), https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live.md [doc]
- OpenAI, GPT-5.4 mini model page (prices, context, structured outputs), https://developers.openai.com/docs/models/gpt-5.4-mini [doc]
- Google, Gemini API pricing, updated 2026-10-28, https://ai.google.dev/gemini-api/docs/pricing [doc]; Gemini 3.5 Flash price from https://pricepertoken.com/pricing-page/model/google-gemini-3.5-flash [thin]

Google
- Search Quality Evaluator Guidelines, September 11, 2025 (§3.2, §4.6.5, §4.6.6, §5.2.2, Part 3), https://guidelines.raterhub.com/searchqualityevaluatorguidelines.pdf [doc]
- Creating helpful, reliable, people-first content, updated 2026-10-05, https://developers.google.com/search/docs/fundamentals/creating-helpful-content [doc]

Vendors
- Ahrefs, About the new AI Content Helper, https://help.ahrefs.com/en/articles/9879434-about-the-new-ai-content-helper [doc]
- Ahrefs, "Do Higher Content Scores Mean Higher Google Rankings?", https://ahrefs.com/blog/seo-content-score-study/ (via search summary; see R2 §3.3) [vendor claim]
- Semrush, SEO Writing Assistant, https://semrush.com/kb/814-seo-writing-assistant [doc]
- AirOps, Content review, https://docs.airops.com/actions/grids/review-content-in-the-grid/content-review [doc]
- Profound, AEO Content Scorecard, https://docs.tryprofound.com/agents/nodes/content-optimization/aeo-content-scorecard [doc]
- Agency scorecard templates (search results, no authoritative one), e.g. https://resources.averi.ai/templates/content-scoring-rubric-template [thin]
