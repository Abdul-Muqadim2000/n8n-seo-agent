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
| kit | 413cae9a + review group (before CT-FIX) | 160 | 76.9% | 60.6% (40 of 66) | 4.1% (2 of 49) | 19.6% (10 of 51) | 100% / 68.3% | 50.0% / 48.0% |
| kit | CT-FIX | 160 | 100% | 95.5% (63 of 66) | 0% (0 of 49) | 0% (0 of 51) | 100% / 100% | 100% / 88.0% |
| qa | CT-FIX | 160 | 100% | 95.5% (63 of 66) | 0% (0 of 49) | 0% (0 of 51) | 100% / 100% | 100% / 88.0% |

Arabic (13 cases): recall 0% (0 of 5) before, 80% (4 of 5) after, no false flag either time. The review group alone: before, 10 of 10
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

## Rows

| Path | Case | Kind | Site | Label | Category | Sentence | Got: why |
|---|---|---|---|---|---|---|---|
| kit | CL-A08 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | ستحصل على دليل تشغيل ولوحات متابعة بعد الإطلاق. | not flagged: an offer to the reader ("you will receive") counts only in a section about the business, and the Arabic heading "التشغيل والتحسين" (Run & Optimize) is a phase on file only in English, so the section is not recognised as the business's |
| kit | CL-R13 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | A runbook is delivered at go-live. | not flagged: read as a passive commitment, but with two content words "deliver" alone (half of them) matched a fact; one shared word is too little support for so short a line |
| kit | CL-R14 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | Monitoring dashboards are included in every engagement. | not flagged: read as a passive commitment, but "monitoring" alone (half of two content words) matched a fact; one shared word is too little support for so short a line |
| qa | CL-A08 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | ستحصل على دليل تشغيل ولوحات متابعة بعد الإطلاق. | not flagged: an offer to the reader ("you will receive") counts only in a section about the business, and the Arabic heading "التشغيل والتحسين" (Run & Optimize) is a phase on file only in English, so the section is not recognised as the business's |
| qa | CL-R13 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | A runbook is delivered at go-live. | not flagged: read as a passive commitment, but with two content words "deliver" alone (half of them) matched a fact; one shared word is too little support for so short a line |
| qa | CL-R14 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | Monitoring dashboards are included in every engagement. | not flagged: read as a passive commitment, but "monitoring" alone (half of two content words) matched a fact; one shared word is too little support for so short a line |
