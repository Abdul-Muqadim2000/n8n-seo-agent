# Business claims accuracy: the known failures (baseline)

Scenario **CLACC** (`harness/scenarios_claims_accuracy.js`) ratchets on this file. Every row is a case of `claims.json` where the
generated code disagrees with the human label, measured on 2026-10-22 at `a6756696`. A disagreement that is not listed here fails
the build; a listed row the code now gets right fails the build too, until the row is deleted, so the list can only shrink. The bars
(precision >= 95% and recall >= 90% for unsupported claims, false flags on supported claims <= 3%) are not lowered and no label was
changed to pass them: they become hard assertions for a path once no row is left for it.

## The set

`claims.json`: 160 sentences, one case each, over three sites with the text each one has on file (`sites[].facts`, what Content QA
reads as the business's own text):

- **techand.ai** (95, 11 in Arabic): the facts of the 2026-10-21 paid page run (exec 42, `fixtures_eqa_42.json.gz`: business facts,
  profile, services, the homepage and /whatwedo/ai-automation as read that run). The 38 sentences of the exec 42 page itself (the 11
  promises the content review found, the true statements beside them, the generic sentences, the advice, the calls to action, the
  cited figure) are read inside their real H2 section (`section`, brackets filled in as CLM1 does); the 2026-10-17 billing and scope
  sentences of A-15 (exec 771); and synthetic sentences written for this set: paraphrases of true facts ("over two decades",
  "round-the-clock", "more than 20 years"), FAQ answers, list items, passive lines, credentials, partner tiers, billing, guarantees,
  timelines, offices, staff counts, and a call to action that carries a promise.
- **peppol.org** (21) and **azdan.com** (28, 2 in Arabic): synthetic drafts in each organisation's voice, judged against the
  descriptions and headings of its live pages (`sites/peppol-org.json`, `sites/azdan-com.json`).

Labels: `supported_claim` (about the business, carried by the facts in any wording), `unsupported_claim` (about the business, nothing
on file supports it: the page may not say it until the owner confirms it), `not_a_claim` (generic, advice to the reader, the call to
action, a quote from a source). 49 / 60 / 35. Categories: deliverable, process, billing, scope, guarantee, timeline, credential,
partnership, experience, location_contact, industry, generic, advice, cta, source_quote. Labels were written from the facts before
the code was run on them and were not changed after.

**Hold-out**: a case is hold-out when the first byte of sha1(sentence + site) mod 10 is under 3 (43 of the first 144, `holdout: true` in the file,
checked by CLACC). The fixer tunes on the 101 dev cases only and reports both halves.

**Independent-review group** (CT-FIX, 2026-10-22): 16 sentences `CL-R01`..`CL-R16` (source "independent review 2026-10-22"), the synthetic
cases of the content review (CT_REVIEW.md items 1, 2, 9 and 10: calls to action, guide narration, a third party acting, a quotation, a
worked example, "we" in a relative clause; contractions, passives, an offer under "Our approach", a list item under "Our engagement
includes:"), labelled as the review states them. All of them are hold-out (CLACC checks it): they were never tuned on.

## How it is scored

`score_claims.js` runs two generated paths offline: **kit** = the claims kit as the build inlined it into `code_v4/Content_QA.js`,
called as §9d / §9e call it (`CL.business`, then `CL.commitments` with §9d's sentences skipped); **qa** = the generated *Content QA*
node, one run per case, Parse Brief carrying only that site's facts and business name. Flagged = the case sentence is among the
node's `business_claims` or `business_promises`. Other Content QA mechanisms that may also stop a sentence (the price mask, the
unverified-statistics check) are not counted: this set measures the claims check. `kind`: `missed` an unsupported claim not flagged;
`false_flag` a supported claim or a non-claim flagged.

## Measured

| Path | When | Cases | Precision | Recall | False flags: supported | False flags: not a claim | Dev P / R | Hold-out P / R |
|---|---|---|---|---|---|---|---|---|
| kit | a6756696 (CT-ACC) | 144 | 95.2% | 66.7% (40 of 60) | 4.1% (2 of 49) | 0% (0 of 35) | 100% / 68.3% | 85.7% / 63.2% |
| qa | a6756696 (CT-ACC) | 144 | 95.2% | 66.7% (40 of 60) | 4.1% (2 of 49) | 0% (0 of 35) | 100% / 68.3% | 85.7% / 63.2% |
| kit | 413cae9a + review group (before CT-FIX) | 160 | 76.9% | 60.6% (40 of 66) | 4.1% (2 of 49) | 22.2% (10 of 45) | 100% / 68.3% | 50.0% / 48.0% |
| kit | CT-FIX | 160 | 100% | 95.5% (63 of 66) | 0% (0 of 49) | 0% (0 of 45) | 100% / 100% | 100% / 88.0% |
| qa | CT-FIX | 160 | 100% | 93.9% (62 of 66) | 0% (0 of 49) | 0% (0 of 45) | 100% / 100% | 100% / 84.0% |
| kit | CT-FIX2 (+ live page group, 20 hold-out) | 180 | 100% | 94.5% (69 of 73) | 0% (0 of 56) | 0% (0 of 51) | 100% / 100% | 100% / 87.5% |
| qa | CT-FIX2 (+ live page group, 20 hold-out) | 180 | 100% | 93.2% (68 of 73) | 0% (0 of 56) | 0% (0 of 51) | 100% / 100% | 100% / 84.4% |
| model | CT-FIX2: two stages, stage 2 replayed from `claims_model_answers.json` | 180 | 100% | 94.5% (69 of 73) | 0% (0 of 56) | 0% (0 of 51) | 100% / 100% | 100% / 87.5% |
| kit | H2 before the fix (+ production group, 34 dev) | 214 | 77.5% | 95.2% (79 of 83) | 14.9% (10 of 67) | 20.3% (13 of 64) | 68.9% / 100% | 100% / 87.5% |
| qa | H2 before the fix (+ production group, 34 dev) | 214 | 77.2% | 94% (78 of 83) | 14.9% (10 of 67) | 20.3% (13 of 64) | 68.9% / 100% | 100% / 84.4% |
| kit | H2 | 214 | 95.2% | 95.2% (79 of 83) | 6% (4 of 67) | 0% (0 of 64) | 92.7% / 100% | 100% / 87.5% |
| qa | H2 | 214 | 95.1% | 94% (78 of 83) | 6% (4 of 67) | 0% (0 of 64) | 92.7% / 100% | 100% / 84.4% |
| model | H2 (the production pages have no recorded answer: decided by the rules) | 214 | 95.2% | 95.2% (79 of 83) | 6% (4 of 67) | 0% (0 of 64) | 92.7% / 100% | 100% / 87.5% |

**CT-FIX2 (2026-10-22, the live page of exec 159).** A labelled group of 20 sentences of that page (`CL-L01`..`CL-L20`, source "live page
2026-10-22", its own fact set `techand.ai/live-2026-10-22` = what Content QA read that run) is hold-out as a group. Before CT-FIX2 the
kit got 6 of them wrong on the live run (3 false flags: a true sentence joining two facts with "United Arab Emirates", a mid-page
invitation, a "Read [link]" line; 3 misses: a phase as the subject, a list item under "How we close each gap:", an image caption). After:
6 of 7 promises found, no false flag; the one left (`CL-L07`, "We recommend a go/no-go review ...") is QA's own round-1 promise reworded
by the editor, which Content QA now carries across rounds (scenario CTX3 on the real data) but the one-shot kit cannot see. The `model`
path is the two-stage check (CLAIMS_MODEL_EVAL.md): with the decision policy the evaluation forced (the reader may lift a rule flag only
from an invitation, a pointer, narration or a quotation, or as supported when the fact it names carries the sentence by the rules' own
test, and may add a flag only where the rules did not judge a commitment), it decides exactly as the rules on this set.

**H2 (2026-10-27, the four production pages).** R1_PIPELINE_ANALYSIS.md found that of the 33 distinct sentences Content QA flagged as
unsupported statements about the client on the four production page runs (949, 2195, 2552, 2575), 11 were true (on file or on the
client's own site), 9 generic advice to the reader, 4 calls to action and only 9 invented. They are in the set as `CL-Q01`..`CL-Q34`
(34 sentences: one round-2 sentence joins two round-1 ones, so 10 invented), labelled by R1's class (`prod_class`), each read where it
sat on its page, with two new fact sets: novaand-demo.com's business facts, profile, call to action and its services page `/whatwedo` as
exec 949 read it (every page run reads the services page since H2), and corvane-demo.com's facts and profile. The group is dev (tuned on);
the older hold-out is the clean measure and did not move. On the group: before, 33 of 34 flagged (precision 30.3%: 10 invented, 10 true,
9 advice, 4 calls to action); after, 14 flagged (all 10 invented; 4 true statements a paraphrase away from the services page, rows
below; no advice, no call to action): precision 71.4%, recall 100%. What changed: an instruction to the reader (also as a list item
under "We use five steps:" or after a short label), a buyer or readiness checklist item, an invitation whose only promise is the
conversation, "Get in-touch" with a hyphen, "We will confirm whether ..." in the closing section and "<name> explains which ..." are
not commitments; a whole paragraph of the text on file supports a sentence at 65% of its content words (a phase described in short
sentences); "<fact on file>, so <consequence>" is held on the fact when the head is in the business's voice and the consequence names
no term, number, time or rank. Every invented specific (a process step, a deliverable, a stance, the ISO process) is still flagged.

The two paths now differ on one case, CL-T41 (row below). Arabic (13 cases): recall 0% (0 of 5) before, 80% (4 of 5) after, no false flag either time. The review group alone: before, 10 of 10
non-claims flagged and 0 of 6 promises found; after, 0 of 10 flagged and 4 of 6 found.

CT-FIX changed the design, not the patterns: a commitment is found by its SUBJECT (we / we'll / we have, a sentence that opens with
"our ...", the business's name in subject position, "with us"), and in a section about the business by an offer to the reader, a
passive or cost / duration line, or a list item under a business lead-in; calls to action, narration, quotations, worked examples, third
parties and relative clauses are not commitments. Support holds the same rule as before (one fact, or two adjacent ones, carries half of
its content words) with whole numbers, number words and synonyms normalised, strong qualifiers (only, platinum, leading ...) required on
the fact itself, and Arabic read through a small bilingual lexicon. Two label notes, no label changed: `CL-T56` (a call to action that
promises "a fixed quote within 48 hours", unsupported) and `CL-R04` (a call to action that promises a review "within two business days",
not a claim) differ only in that T56 names a commercial term (a quote); the kit keeps that line, so a call to action that names a price,
quote, fee or guarantee is still a term to confirm.

**W0-A (2026-10-29, docs/page-quality-2026-10-29/PLAN.md Fix 1).** The meta description is no longer read as a statement about the
business (it is search-result copy written from the brief; PF.meta gives it a narrow field check instead). `CL-Q18`, which sits in a
`Meta Description:` line, is therefore no longer flagged on the kit and model paths, as its label says: its two rows were removed.

## Rows

| Path | Case | Kind | Site | Label | Category | Sentence | Got: why |
|---|---|---|---|---|---|---|---|
| kit | CL-A08 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | ستحصل على دليل تشغيل ولوحات متابعة بعد الإطلاق. | not flagged: an offer to the reader ("you will receive") counts only in a section about the business, and the Arabic heading "التشغيل والتحسين" (Run & Optimize) is a phase on file only in English, so the section is not recognised as the business's |
| kit | CL-R13 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | A runbook is delivered at go-live. | not flagged: read as a passive commitment, but with two content words "deliver" alone (half of them) matched a fact; one shared word is too little support for so short a line |
| kit | CL-R14 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | Monitoring dashboards are included in every engagement. | not flagged: read as a passive commitment, but "monitoring" alone (half of two content words) matched a fact; one shared word is too little support for so short a line |
| qa | CL-T41 | missed | techand.ai | unsupported_claim | billing (hold-out) | Our fixed-price readiness assessment costs AED 25,000. | not flagged as a claim on the qa path only: Content QA's price mask runs first and turns "AED 25,000" into [Price] (no price facts on file), and the claims check never reads a sentence that holds a bracket; the page is still held, by the placeholder, but the claim is not named. The kit flags it |
| qa | CL-A08 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | ستحصل على دليل تشغيل ولوحات متابعة بعد الإطلاق. | not flagged: an offer to the reader ("you will receive") counts only in a section about the business, and the Arabic heading "التشغيل والتحسين" (Run & Optimize) is a phase on file only in English, so the section is not recognised as the business's |
| qa | CL-R13 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | A runbook is delivered at go-live. | not flagged: read as a passive commitment, but with two content words "deliver" alone (half of them) matched a fact; one shared word is too little support for so short a line |
| qa | CL-R14 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | Monitoring dashboards are included in every engagement. | not flagged: read as a passive commitment, but "monitoring" alone (half of two content words) matched a fact; one shared word is too little support for so short a line |
| kit | CL-L07 | missed | techand.ai/live-2026-10-22 | unsupported_claim | process (hold-out) | We recommend a go/no-go review at the end of each phase, so a full build is funded only once the ROI case exists. | not flagged: "we recommend" is advice in the rules; on the live run it was the editor's rewording of round 1's flagged promise, which Content QA carries as a promise in round 2 (CTX3), but read alone the sentence has no round before it |
| qa | CL-L07 | missed | techand.ai/live-2026-10-22 | unsupported_claim | process (hold-out) | We recommend a go/no-go review at the end of each phase, so a full build is funded only once the ROI case exists. | not flagged: "we recommend" is advice in the rules; on the live run it was the editor's rewording of round 1's flagged promise, which Content QA carries as a promise in round 2 (CTX3), but read alone the sentence has no round before it |
| model | CL-A08 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | ستحصل على دليل تشغيل ولوحات متابعة بعد الإطلاق. | as on the kit path: its page was left to the rules by the evaluation's spend cap (no recorded answer) |
| model | CL-R13 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | A runbook is delivered at go-live. | as on the kit path: its page was left to the rules by the evaluation's spend cap (no recorded answer) |
| model | CL-R14 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | Monitoring dashboards are included in every engagement. | as on the kit path: its page was left to the rules by the evaluation's spend cap (no recorded answer) |
| model | CL-L07 | missed | techand.ai/live-2026-10-22 | unsupported_claim | process (hold-out) | We recommend a go/no-go review at the end of each phase, so a full build is funded only once the ROI case exists. | as on the kit path (no recorded answer for its page; run 1's reader also left it unflagged) |
| kit | CL-Q19 | false_flag | novaand-demo.com/prod-2026-10-27 | supported_claim | scope | We also deliver multi-entity and global rollouts. | flagged: Global Rollouts is a service on the services page, but "multi-entity" and "deliver" are not in its paragraph (40%) |
| kit | CL-Q20 | false_flag | novaand-demo.com/prod-2026-10-27 | supported_claim | process | We review your processes and recommend an edition. | flagged: the Assess and Shape phase in other words: only "processes" is on file |
| kit | CL-Q21 | false_flag | novaand-demo.com/prod-2026-10-27 | supported_claim | process | We configure the system, set up UAE compliance, migrate data and test. | flagged: Build & Implement in other words: UAE, compliance and migration are on file, configure / data / test are not (50% of the paragraph, 65% needed) |
| qa | CL-Q19 | false_flag | novaand-demo.com/prod-2026-10-27 | supported_claim | scope | We also deliver multi-entity and global rollouts. | flagged: Global Rollouts is a service on the services page, but "multi-entity" and "deliver" are not in its paragraph (40%) |
| qa | CL-Q20 | false_flag | novaand-demo.com/prod-2026-10-27 | supported_claim | process | We review your processes and recommend an edition. | flagged: the Assess and Shape phase in other words: only "processes" is on file |
| qa | CL-Q21 | false_flag | novaand-demo.com/prod-2026-10-27 | supported_claim | process | We configure the system, set up UAE compliance, migrate data and test. | flagged: Build & Implement in other words: UAE, compliance and migration are on file, configure / data / test are not (50% of the paragraph, 65% needed) |
| model | CL-Q19 | false_flag | novaand-demo.com/prod-2026-10-27 | supported_claim | scope | We also deliver multi-entity and global rollouts. | flagged: Global Rollouts is a service on the services page, but "multi-entity" and "deliver" are not in its paragraph (40%) |
| model | CL-Q20 | false_flag | novaand-demo.com/prod-2026-10-27 | supported_claim | process | We review your processes and recommend an edition. | flagged: the Assess and Shape phase in other words: only "processes" is on file |
| model | CL-Q21 | false_flag | novaand-demo.com/prod-2026-10-27 | supported_claim | process | We configure the system, set up UAE compliance, migrate data and test. | flagged: Build & Implement in other words: UAE, compliance and migration are on file, configure / data / test are not (50% of the paragraph, 65% needed) |
