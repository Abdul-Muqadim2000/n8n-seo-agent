# Business claims accuracy: the known failures (baseline)

Scenario **CLACC** (`harness/scenarios_claims_accuracy.js`) ratchets on this file. Every row is a case of `claims.json` where the
generated code disagrees with the human label, measured on 2026-10-22 at `a6756696`. A disagreement that is not listed here fails
the build; a listed row the code now gets right fails the build too, until the row is deleted, so the list can only shrink. The bars
(precision >= 95% and recall >= 90% for unsupported claims, false flags on supported claims <= 3%) are not lowered and no label was
changed to pass them: they become hard assertions for a path once no row is left for it.

## The set

`claims.json`: 144 sentences, one case each, over three sites with the text each one has on file (`sites[].facts`, what Content QA
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

**Hold-out**: a case is hold-out when the first byte of sha1(sentence + site) mod 10 is under 3 (43 of 144, `holdout: true` in the file,
checked by CLACC). The fixer tunes on the 101 dev cases only and reports both halves; the numbers below were measured once, before any fix.

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

The two paths agree on every case. The 11 promises of the 2026-10-21 page are all flagged in their section, and every generic
sentence, piece of advice, call to action and cited figure passes (0 of 35). What fails: 20 unsupported claims missed and 2 true
statements flagged, by category: billing 5 missed, timeline 4, experience 4 missed + 1 false flag, deliverable 3, guarantee 2,
credential 1, partnership 1, process 1 false flag. All 5 unsupported Arabic sentences are missed (no Arabic pattern). The shapes:
a subject that is not "we / our team / <name>" (passive lines, "our <service> costs", "every <name> implementation takes"), verbs the
list does not hold ("have delivered", "gets", "certifies", "costs"), list items with no verb, partner tiers and counts outside the
lists, and paraphrases of true facts matched word for word.

## Rows

| Path | Case | Kind | Site | Label | Category | Sentence | Got: why |
|---|---|---|---|---|---|---|---|
| kit | CL-T23 | false_flag | techand.ai | supported_claim | experience (hold-out) | We provide round-the-clock support for the systems we run for you. | flagged promise:deliverable: the words "round", "clock", "systems", "run" sit on no single fact sentence, so a paraphrase of "24/7 support" reads as unsupported (synonyms and numbers written in words are not matched) |
| kit | CL-T41 | missed | techand.ai | unsupported_claim | billing (hold-out) | Our fixed-price readiness assessment costs AED 25,000. | not flagged: subject "Our fixed-price readiness assessment" is not a business subject (§9d knows "our prices / fees", not "our <service>"), and "costs" is not a commitment verb |
| kit | CL-T48 | missed | techand.ai | unsupported_claim | timeline | Your team gets a 90-day hypercare period after go-live. | not flagged: "Your team gets": the offer pattern knows "get", not "gets" |
| kit | CL-T51 | missed | techand.ai | unsupported_claim | experience | We have delivered more than 150 Dynamics 365 projects for GCC clients. | not flagged: "We have delivered": "have" is not an allowed helper before the verb; §9d reads "365 projects" as the count and finds "365" in "Dynamics 365" |
| kit | CL-T57 | missed | techand.ai | unsupported_claim | timeline (hold-out) | A typical Copilot rollout with us takes six to eight weeks from kickoff to go-live. | not flagged: subject "A typical Copilot rollout with us": no we / name subject, so a duration nobody states is not read |
| kit | CL-T58 | missed | techand.ai | unsupported_claim | deliverable | Monthly health checks and a quarterly roadmap review are part of the service. | not flagged: passive with no subject ("are part of the service") |
| kit | CL-T59 | missed | techand.ai | unsupported_claim | billing (hold-out) | Training is included at no extra cost. | not flagged: passive billing line with no subject ("Training is included at no extra cost") |
| kit | CL-T61 | missed | techand.ai | unsupported_claim | deliverable | A written data governance policy for your Copilot rollout | not flagged: a list item with no verb under "What you get from Tech&": only verb patterns are read |
| kit | CL-T62 | missed | techand.ai | unsupported_claim | experience (hold-out) | Every Tech& consultant has worked inside a bank or a government entity. | not flagged: "Every Tech& consultant has worked": the name is not followed by a verb and "has worked" is not a commitment verb |
| kit | CL-A05 | missed | techand.ai | unsupported_claim | guarantee | نضمن استرداد أموالك إذا لم يعمل النموذج التجريبي خلال ستة أسابيع. | not flagged: Arabic: every pattern is English, an Arabic sentence is never read |
| kit | CL-A06 | missed | techand.ai | unsupported_claim | credential | نحن حاصلون على شهادة ISO 27001 لمركز التنفيذ لدينا. | not flagged: Arabic: every pattern is English, an Arabic sentence is never read |
| kit | CL-A07 | missed | techand.ai | unsupported_claim | billing | تبلغ رسوم تقييم الجاهزية لدينا 25,000 درهم. | not flagged: Arabic: every pattern is English, an Arabic sentence is never read |
| kit | CL-A08 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | ستحصل على دليل تشغيل ولوحات متابعة بعد الإطلاق. | not flagged: Arabic: every pattern is English, an Arabic sentence is never read |
| kit | CL-P07 | false_flag | peppol.org | supported_claim | process (hold-out) | Any organisation can apply for membership of OpenPeppol through the members page. | flagged terms:credential: §9d reads "membership of" as a credential; the fact says "apply for membership" in a sentence without the case's other words |
| kit | CL-P09 | missed | peppol.org | unsupported_claim | timeline | OpenPeppol certifies every access point provider within 10 working days. | not flagged: "OpenPeppol certifies": "certifies" is not a commitment verb and §9d needs "certified" or a partner tier |
| kit | CL-P10 | missed | peppol.org | unsupported_claim | billing (hold-out) | Membership costs EUR 2,500 a year for service providers. | not flagged: subject "Membership" with "costs": no business subject, so a price nobody states is not read |
| kit | CL-P16 | missed | peppol.org | unsupported_claim | experience | We have more than 1,000 members in 50 countries. | not flagged: "We have more than 1,000 members": "have" is not a commitment verb; §9d counts years / clients / staff, not members or countries |
| kit | CL-Z13 | missed | azdan.com | unsupported_claim | partnership (hold-out) | Azdan is Oracle's only Platinum NetSuite partner in Egypt. | not flagged: "Azdan is ... only Platinum ... partner": the partner tier list has no "platinum" and "is" is not a commitment verb |
| kit | CL-Z15 | missed | azdan.com | unsupported_claim | billing | Our fixed fee starts at USD 15,000 for a single subsidiary. | not flagged: subject "Our fixed fee": §9d knows "our fees", not "our fixed fee"; a starting price is not read |
| kit | CL-Z19 | missed | azdan.com | unsupported_claim | experience | Our consultants have migrated more than 500 companies from SAP Business One. | not flagged: "Our consultants have migrated": "have" is not an allowed helper; §9d counts "companies" nowhere |
| kit | CL-Z21 | missed | azdan.com | unsupported_claim | timeline | Every Azdan implementation takes eight weeks from kickoff to go-live. | not flagged: subject "Every Azdan implementation": no we / name + verb, so a duration nobody states is not read |
| kit | CL-Z28 | missed | azdan.com | unsupported_claim | guarantee | نقدم ضمانًا لمدة عامين على كل عملية تنفيذ. | not flagged: Arabic: every pattern is English, an Arabic sentence is never read |
| qa | CL-T23 | false_flag | techand.ai | supported_claim | experience (hold-out) | We provide round-the-clock support for the systems we run for you. | flagged promise:deliverable: the words "round", "clock", "systems", "run" sit on no single fact sentence, so a paraphrase of "24/7 support" reads as unsupported (synonyms and numbers written in words are not matched) |
| qa | CL-T41 | missed | techand.ai | unsupported_claim | billing (hold-out) | Our fixed-price readiness assessment costs AED 25,000. | not flagged: subject "Our fixed-price readiness assessment" is not a business subject (§9d knows "our prices / fees", not "our <service>"), and "costs" is not a commitment verb |
| qa | CL-T48 | missed | techand.ai | unsupported_claim | timeline | Your team gets a 90-day hypercare period after go-live. | not flagged: "Your team gets": the offer pattern knows "get", not "gets" |
| qa | CL-T51 | missed | techand.ai | unsupported_claim | experience | We have delivered more than 150 Dynamics 365 projects for GCC clients. | not flagged: "We have delivered": "have" is not an allowed helper before the verb; §9d reads "365 projects" as the count and finds "365" in "Dynamics 365" |
| qa | CL-T57 | missed | techand.ai | unsupported_claim | timeline (hold-out) | A typical Copilot rollout with us takes six to eight weeks from kickoff to go-live. | not flagged: subject "A typical Copilot rollout with us": no we / name subject, so a duration nobody states is not read |
| qa | CL-T58 | missed | techand.ai | unsupported_claim | deliverable | Monthly health checks and a quarterly roadmap review are part of the service. | not flagged: passive with no subject ("are part of the service") |
| qa | CL-T59 | missed | techand.ai | unsupported_claim | billing (hold-out) | Training is included at no extra cost. | not flagged: passive billing line with no subject ("Training is included at no extra cost") |
| qa | CL-T61 | missed | techand.ai | unsupported_claim | deliverable | A written data governance policy for your Copilot rollout | not flagged: a list item with no verb under "What you get from Tech&": only verb patterns are read |
| qa | CL-T62 | missed | techand.ai | unsupported_claim | experience (hold-out) | Every Tech& consultant has worked inside a bank or a government entity. | not flagged: "Every Tech& consultant has worked": the name is not followed by a verb and "has worked" is not a commitment verb |
| qa | CL-A05 | missed | techand.ai | unsupported_claim | guarantee | نضمن استرداد أموالك إذا لم يعمل النموذج التجريبي خلال ستة أسابيع. | not flagged: Arabic: every pattern is English, an Arabic sentence is never read |
| qa | CL-A06 | missed | techand.ai | unsupported_claim | credential | نحن حاصلون على شهادة ISO 27001 لمركز التنفيذ لدينا. | not flagged: Arabic: every pattern is English, an Arabic sentence is never read |
| qa | CL-A07 | missed | techand.ai | unsupported_claim | billing | تبلغ رسوم تقييم الجاهزية لدينا 25,000 درهم. | not flagged: Arabic: every pattern is English, an Arabic sentence is never read |
| qa | CL-A08 | missed | techand.ai | unsupported_claim | deliverable (hold-out) | ستحصل على دليل تشغيل ولوحات متابعة بعد الإطلاق. | not flagged: Arabic: every pattern is English, an Arabic sentence is never read |
| qa | CL-P07 | false_flag | peppol.org | supported_claim | process (hold-out) | Any organisation can apply for membership of OpenPeppol through the members page. | flagged terms:credential: §9d reads "membership of" as a credential; the fact says "apply for membership" in a sentence without the case's other words |
| qa | CL-P09 | missed | peppol.org | unsupported_claim | timeline | OpenPeppol certifies every access point provider within 10 working days. | not flagged: "OpenPeppol certifies": "certifies" is not a commitment verb and §9d needs "certified" or a partner tier |
| qa | CL-P10 | missed | peppol.org | unsupported_claim | billing (hold-out) | Membership costs EUR 2,500 a year for service providers. | not flagged: subject "Membership" with "costs": no business subject, so a price nobody states is not read |
| qa | CL-P16 | missed | peppol.org | unsupported_claim | experience | We have more than 1,000 members in 50 countries. | not flagged: "We have more than 1,000 members": "have" is not a commitment verb; §9d counts years / clients / staff, not members or countries |
| qa | CL-Z13 | missed | azdan.com | unsupported_claim | partnership (hold-out) | Azdan is Oracle's only Platinum NetSuite partner in Egypt. | not flagged: "Azdan is ... only Platinum ... partner": the partner tier list has no "platinum" and "is" is not a commitment verb |
| qa | CL-Z15 | missed | azdan.com | unsupported_claim | billing | Our fixed fee starts at USD 15,000 for a single subsidiary. | not flagged: subject "Our fixed fee": §9d knows "our fees", not "our fixed fee"; a starting price is not read |
| qa | CL-Z19 | missed | azdan.com | unsupported_claim | experience | Our consultants have migrated more than 500 companies from SAP Business One. | not flagged: "Our consultants have migrated": "have" is not an allowed helper; §9d counts "companies" nowhere |
| qa | CL-Z21 | missed | azdan.com | unsupported_claim | timeline | Every Azdan implementation takes eight weeks from kickoff to go-live. | not flagged: subject "Every Azdan implementation": no we / name + verb, so a duration nobody states is not read |
| qa | CL-Z28 | missed | azdan.com | unsupported_claim | guarantee | نقدم ضمانًا لمدة عامين على كل عملية تنفيذ. | not flagged: Arabic: every pattern is English, an Arabic sentence is never read |
