# Keyword business-fit accuracy: the known failures (baseline)

Scenario **KWACC** (`harness/scenarios_kw_accuracy.js`) ratchets on this file. Every row is a case of `keywords.json` where the
generated code disagrees with the human label, measured on 2026-10-21 at `9808e69d`. A disagreement that is not listed here fails
the build; a listed row the code now gets right fails the build too, until the row is deleted, so the list can only shrink. The 95%
bar is not lowered and no label was changed to pass it: it becomes a hard assertion for a path once no `decision` row is left for it.
A refusal without a reason is never listed here (it always fails).

## The set

`keywords.json`: 137 cases, one per (site, keyword): 123 over three real sites with their declared services: techand.ai (the 7 services saved in
the 2026-10-21 paid run: AI consulting, AI and automation, Copilot, Dynamics 365 Finance / Business Central / Sales, e-invoicing; 81 cases, 14 in
Arabic), peppol.org (OpenPeppol, 19) and azdan.com (a NetSuite partner, 23). Each case: `label` in (a page of this site may target it) or
out, `expect` the reason class a careful person gives (other_brand, navigational, government, career, off_topic, too_broad, place_only,
in_topic), a one-line `reason` and a `source` (a file of the paid run, the live site, a site fixture, or judgement on the declared services).
The real leaks and refusals of the run are in it (recommended.json, the full report, the checks, AI Growth and the pulse set-asides, the ladder
pool), plus the hard shapes: short service names, tax next to e-invoicing, ERP for an ERP partner, rival names with and without a colon,
<brand> login / pricing (the same "netsuite pricing" is out for techand.ai and in for azdan.com), jobs / salary / courses, place-only searches.
Labels were written from the evidence before the code was run and were not changed after. KW-GATE (2026-10-21) added 14 cases (`KW-R01`..`KW-R14`, `"holdout": true`, source "independent review 2026-10-21") with the reviewer's labels: six synthetic sites (a VAT consultancy, a training company, a recruitment agency, an IT firm, an ISO consultancy, a Salesforce partner) and six techand.ai searches of review items 3, 13 and 14. They were scored only after the gate was designed, as hold-out.

## How it is scored

`score_keywords.js` runs two generated paths offline: **kit** = `code_v4/_fit_gate.js` (the gate every keyword node inlines) with the context
the callers build, plus the case's real results page (`serp`: top domains and questions) where the case has one; **full** = the full report's
*Analyze Keywords* node (its own wrapper included), every keyword offered as a rival's keyword, decision = listed in `site_keywords.refused`
(this path reads no results page per keyword). Out = refusal. Precision / recall are reported for out and for in, and reason agreement
over correct refusals.

`kind`: `decision` the code keeps a keyword labelled out, or refuses one labelled in; `reason` the decision is right but the reason class
the client reads is not the labelled one (place_only agrees with too_broad: the gate has no place class).

## Measured

| Path | When | Cases | Out precision | Out recall | In precision | In recall | Reason agreement |
|---|---|---|---|---|---|---|---|
| kit | 9808e69d (KW-ACC) | 123 | 72.2% | 94.2% | 87.9% | 53.7% | 56.9% |
| full | 9808e69d (KW-ACC) | 123 | 71.9% | 92.8% | 85.3% | 53.7% | 62.5% |
| kit | KW-GATE 2026-10-21 | 137 | 95.8% | 98.6% | 98.5% | 95.6% | 91.2% (62 of 68) |
| full | KW-GATE 2026-10-21 | 137 | 95.7% | 97.1% | 97% | 95.6% | 91% (61 of 67) |

KW-GATE split the set before designing anything: a case is hold-out when the first byte of sha1(keyword + site) mod 10 is under 3 (41 of the 123), plus the 14 review cases. The design was iterated on the 82 dev cases only (kit: every dev decision right); the hold-out rows below were looked at once, at the end, and were not tuned to.

The same keyword got a different answer on the two paths for 1 case(s): KW-T51 ai consultant (the full report reads no results page per keyword, so a career search that only its results page reveals passes there).

## Rows

| Path | Case | Kind | Keyword | Site | Label / class | Got | Why (the code's own sentence) |
|---|---|---|---|---|---|---|---|
| kit | KW-T10 | decision | ai for finance operations uae | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): operations. Add it to your services if you do sell it. |
| kit | KW-T52 | reason | software companies in dubai | techand.ai | out / off_topic | too_broad | it has only category or place words, "software", "companies" and "dubai", so nothing in it points to what this website sells |
| kit | KW-T53 | reason | best software companies in dubai | techand.ai | out / off_topic | too_broad | it has only category or place words, "best", "software", "companies" and "dubai", so nothing in it points to what this website sells |
| kit | KW-T54 | reason | top software companies in dubai | techand.ai | out / off_topic | too_broad | it has only category or place words, "top", "software", "companies" and "dubai", so nothing in it points to what this website sells |
| kit | KW-T58 | reason | intelligent software solutions | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): intelligent. Add it to your services if you do sell it. |
| kit | KW-T65 | reason | will marketing jobs be taken over by ai | techand.ai | out / off_topic | career | people looking for work, not buyers of what this website sells |
| kit | KW-T73 | decision | برنامج محاسبة في الإمارات | techand.ai | in / in_topic | too_broad | it has only category or place words, "software", "accounting" and "uae", so nothing in it points to what this website sells (read as "software accounting uae") |
| kit | KW-P09 | decision | peppol authority | peppol.org | in / in_topic | government | a public body, not a topic (authority) |
| kit | KW-P17 | reason | accounting software | peppol.org | out / off_topic | too_broad | it has only category or place words, "accounting" and "software", so nothing in it points to what this website sells |
| kit | KW-P18 | decision | invoice template | peppol.org | out / off_topic | in_topic | kept as a target |
| full | KW-T10 | decision | ai for finance operations uae | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): operations. Add it to your services if you do sell it. |
| full | KW-T51 | decision | ai consultant | techand.ai | out / career | in_topic | kept as a target |
| full | KW-T52 | reason | software companies in dubai | techand.ai | out / off_topic | too_broad | it has only category or place words, "software", "companies" and "dubai", so nothing in it points to what this website sells |
| full | KW-T53 | reason | best software companies in dubai | techand.ai | out / off_topic | too_broad | it has only category or place words, "best", "software", "companies" and "dubai", so nothing in it points to what this website sells |
| full | KW-T54 | reason | top software companies in dubai | techand.ai | out / off_topic | too_broad | it has only category or place words, "top", "software", "companies" and "dubai", so nothing in it points to what this website sells |
| full | KW-T58 | reason | intelligent software solutions | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): intelligent. Add it to your services if you do sell it. |
| full | KW-T65 | reason | will marketing jobs be taken over by ai | techand.ai | out / off_topic | career | people looking for work, not buyers of what this website sells |
| full | KW-T73 | decision | برنامج محاسبة في الإمارات | techand.ai | in / in_topic | too_broad | it has only category or place words, "software", "accounting" and "uae", so nothing in it points to what this website sells (read as "software accounting uae") |
| full | KW-P09 | decision | peppol authority | peppol.org | in / in_topic | government | a public body, not a topic (authority) |
| full | KW-P17 | reason | accounting software | peppol.org | out / off_topic | too_broad | it has only category or place words, "accounting" and "software", so nothing in it points to what this website sells |
| full | KW-P18 | decision | invoice template | peppol.org | out / off_topic | in_topic | kept as a target |
