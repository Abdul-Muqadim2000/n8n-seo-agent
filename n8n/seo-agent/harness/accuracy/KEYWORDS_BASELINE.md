# Keyword business-fit accuracy: the known failures (baseline)

Scenario **KWACC** (`harness/scenarios_kw_accuracy.js`) ratchets on this file. Every row is a case of `keywords.json` where the
generated code disagrees with the human label, measured on 2026-10-21 at `9808e69d`. A disagreement that is not listed here fails
the build; a listed row the code now gets right fails the build too, until the row is deleted, so the list can only shrink. The 95%
bar is not lowered and no label was changed to pass it: it becomes a hard assertion for a path once no `decision` row is left for it.
A refusal without a reason is never listed here (it always fails).

## The set

`keywords.json`: 123 cases, one per (site, keyword), over three real sites with their declared services: techand.ai (the 7 services saved in
the 2026-10-21 paid run: AI consulting, AI and automation, Copilot, Dynamics 365 Finance / Business Central / Sales, e-invoicing; 81 cases, 14 in
Arabic), peppol.org (OpenPeppol, 19) and azdan.com (a NetSuite partner, 23). Each case: `label` in (a page of this site may target it) or
out, `expect` the reason class a careful person gives (other_brand, navigational, government, career, off_topic, too_broad, place_only,
in_topic), a one-line `reason` and a `source` (a file of the paid run, the live site, a site fixture, or judgement on the declared services).
The real leaks and refusals of the run are in it (recommended.json, the full report, the checks, AI Growth and the pulse set-asides, the ladder
pool), plus the hard shapes: short service names, tax next to e-invoicing, ERP for an ERP partner, rival names with and without a colon,
<brand> login / pricing (the same "netsuite pricing" is out for techand.ai and in for azdan.com), jobs / salary / courses, place-only searches.
Labels were written from the evidence before the code was run and were not changed after.

## How it is scored

`score_keywords.js` runs two generated paths offline: **kit** = `code_v4/_fit_gate.js` (the gate every keyword node inlines) with the context
the callers build, plus the case's real results page (`serp`: top domains and questions) where the case has one; **full** = the full report's
*Analyze Keywords* node (its own wrapper included), every keyword offered as a rival's keyword, decision = listed in `site_keywords.refused`
(this path reads no results page per keyword). Out = refusal. Precision / recall are reported for out and for in, and reason agreement
over correct refusals.

`kind`: `decision` the code keeps a keyword labelled out, or refuses one labelled in; `reason` the decision is right but the reason class
the client reads is not the labelled one (place_only agrees with too_broad: the gate has no place class).

## Measured on 2026-10-21

| Path | Cases | Out precision | Out recall | In precision | In recall | Reason agreement | Decision rows | Reason rows |
|---|---|---|---|---|---|---|---|---|
| kit | 123 | 72.2% | 94.2% | 87.9% | 53.7% | 56.9% (37 of 65) | 29 | 28 |
| full | 123 | 71.9% | 92.8% | 85.3% | 53.7% | 62.5% (40 of 64) | 30 | 24 |

The same keyword got a different answer on the two paths for 1 case(s): KW-T51 ai consultant.

## Decision failures by labelled class

| Path | Labelled class | Wrongly refused (label in) | Wrongly kept (label out) |
|---|---|---|---|
| kit | career | 0 | 1 |
| kit | in_topic | 25 | 0 |
| kit | other_brand | 0 | 3 |
| full | career | 0 | 2 |
| full | in_topic | 25 | 0 |
| full | other_brand | 0 | 3 |

What the wrongly refused in_topic cases have in common, for the fixer (by got class): kit navigational 9, off_topic 13, too_broad 3. full navigational 9, off_topic 13, too_broad 3. 

## Reason rows by labelled class (decision right, reason wrong)

| Path | Labelled class | Got | Rows |
|---|---|---|---|
| kit | career | navigational | 2 |
| kit | career | off_topic | 4 |
| kit | government | navigational | 1 |
| kit | government | off_topic | 3 |
| kit | off_topic | career | 1 |
| kit | off_topic | too_broad | 4 |
| kit | other_brand | off_topic | 11 |
| kit | place_only | off_topic | 2 |
| full | career | navigational | 2 |
| full | career | off_topic | 4 |
| full | government | navigational | 1 |
| full | government | off_topic | 3 |
| full | off_topic | career | 1 |
| full | off_topic | too_broad | 2 |
| full | other_brand | off_topic | 9 |
| full | place_only | off_topic | 2 |

## Rows

| Path | Case | Kind | Keyword | Site | Label / class | Got | Why (the code's own sentence) |
|---|---|---|---|---|---|---|---|
| kit | KW-T10 | decision | ai for finance operations uae | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): operations. Add it to your services if you do sell it. |
| kit | KW-T11 | decision | erp software uae | techand.ai | in / in_topic | too_broad | it has only category or place words, "erp", "software" and "uae", so nothing in it points to what this website sells |
| kit | KW-T12 | decision | best erp software uae | techand.ai | in / in_topic | too_broad | it has only category or place words, "best", "erp", "software" and "uae", so nothing in it points to what this website sells |
| kit | KW-T13 | decision | erp systems in uae | techand.ai | in / in_topic | too_broad | it has only category or place words, "erp", "systems" and "uae", so nothing in it points to what this website sells |
| kit | KW-T14 | decision | vat registration uae | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): registration. Add it to your services if you do sell it. |
| kit | KW-T17 | decision | uae e invoicing mandate 2026 | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): mandate. Add it to your services if you do sell it. |
| kit | KW-T18 | decision | fta e invoicing | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): fta. Add it to your services if you do sell it. |
| kit | KW-T19 | decision | peppol uae | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): peppol. Add it to your services if you do sell it. |
| kit | KW-T27 | reason | ibt: no 1 bpo company in middle east | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): ibt, bpo, middle, east. Add it to your services if you do sell it. |
| kit | KW-T28 | reason | ibt no 1 bpo company in middle east | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): ibt, bpo, middle, east. Add it to your services if you do sell it. |
| kit | KW-T31 | reason | cleartax e invoicing uae | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): cleartax. Add it to your services if you do sell it. |
| kit | KW-T32 | reason | cleartax vs zoho | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): cleartax, zoho. Add it to your services if you do sell it. |
| kit | KW-T34 | reason | odoo pricing uae | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): odoo. Add it to your services if you do sell it. |
| kit | KW-T35 | reason | netsuite pricing | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): netsuite. Add it to your services if you do sell it. |
| kit | KW-T38 | decision | sap implementation dubai | techand.ai | out / other_brand | in_topic | kept as a target |
| kit | KW-T50 | reason | ai course dubai | techand.ai | out / career | off_topic | 0% of its own words match what this website sells (25% is the bar): course. Add it to your services if you do sell it. |
| kit | KW-T52 | reason | software companies in dubai | techand.ai | out / off_topic | too_broad | it has only category or place words, "software", "companies" and "dubai", so nothing in it points to what this website sells |
| kit | KW-T53 | reason | best software companies in dubai | techand.ai | out / off_topic | too_broad | it has only category or place words, "best", "software", "companies" and "dubai", so nothing in it points to what this website sells |
| kit | KW-T54 | reason | top software companies in dubai | techand.ai | out / off_topic | too_broad | it has only category or place words, "top", "software", "companies" and "dubai", so nothing in it points to what this website sells |
| kit | KW-T58 | reason | intelligent software solutions | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): intelligent. Add it to your services if you do sell it. |
| kit | KW-T61 | reason | meta ai | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): meta. Add it to your services if you do sell it. |
| kit | KW-T65 | reason | will marketing jobs be taken over by ai | techand.ai | out / off_topic | career | people looking for work, not buyers of what this website sells |
| kit | KW-T66 | decision | it consultant capgemini | techand.ai | out / other_brand | in_topic | kept as a target |
| kit | KW-T67 | decision | tech consultant deloitte | techand.ai | out / other_brand | in_topic | kept as a target |
| kit | KW-T68 | decision | استشارات الذكاء الاصطناعي في دبي | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): استشارات, الذكاء, الاصطناعي, دبي. Add it to your services if you do sell it. |
| kit | KW-T69 | decision | شركة استشارات ذكاء اصطناعي | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): شركة, استشارات, ذكاء, اصطناعي. Add it to your services if you do sell it. |
| kit | KW-T70 | decision | مايكروسوفت دايناميكس 365 الإمارات | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): مايكروسوفت, دايناميكس, الإمارات. Add it to your services if you do sell it. |
| kit | KW-T71 | decision | الفاتورة الإلكترونية في الإمارات | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): الفاتورة, الإلكترونية, الإمارات. Add it to your services if you do sell it. |
| kit | KW-T72 | decision | نظام الفوترة الإلكترونية الإمارات | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): نظام, الفوترة, الإلكترونية, الإمارات. Add it to your services if you do sell it. |
| kit | KW-T73 | decision | برنامج محاسبة في الإمارات | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): برنامج, محاسبة, الإمارات. Add it to your services if you do sell it. |
| kit | KW-T74 | decision | كوبايلوت مايكروسوفت للشركات | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): كوبايلوت, مايكروسوفت, للشركات. Add it to your services if you do sell it. |
| kit | KW-T75 | reason | وظائف الذكاء الاصطناعي في دبي | techand.ai | out / career | off_topic | 0% of its own words match what this website sells (25% is the bar): وظائف, الذكاء, الاصطناعي, دبي. Add it to your services if you do sell it. |
| kit | KW-T76 | reason | راتب مستشار ذكاء اصطناعي | techand.ai | out / career | off_topic | 0% of its own words match what this website sells (25% is the bar): راتب, مستشار, ذكاء, اصطناعي. Add it to your services if you do sell it. |
| kit | KW-T77 | reason | وظائف محاسب في دبي | techand.ai | out / career | off_topic | 0% of its own words match what this website sells (25% is the bar): وظائف, محاسب, دبي. Add it to your services if you do sell it. |
| kit | KW-T78 | reason | الهيئة الاتحادية للضرائب تسجيل الدخول | techand.ai | out / government | off_topic | 0% of its own words match what this website sells (25% is the bar): الهيئة, الاتحادية, للضرائب, تسجيل. Add it to your services if you do sell it. |
| kit | KW-T79 | reason | تجديد الهوية الإماراتية | techand.ai | out / government | off_topic | 0% of its own words match what this website sells (25% is the bar): تجديد, الهوية, الإماراتية. Add it to your services if you do sell it. |
| kit | KW-T80 | reason | تصديق الشهادات وزارة الخارجية | techand.ai | out / government | off_topic | 0% of its own words match what this website sells (25% is the bar): تصديق, الشهادات, وزارة, الخارجية. Add it to your services if you do sell it. |
| kit | KW-T81 | reason | دبي | techand.ai | out / place_only | off_topic | 0% of its own words match what this website sells (25% is the bar): دبي. Add it to your services if you do sell it. |
| kit | KW-P01 | decision | what is peppol | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| kit | KW-P02 | decision | peppol e invoicing | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| kit | KW-P03 | decision | peppol access point | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| kit | KW-P04 | decision | peppol bis billing 3.0 | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| kit | KW-P05 | decision | peppol network | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| kit | KW-P06 | decision | peppol members | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| kit | KW-P07 | decision | openpeppol membership | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| kit | KW-P08 | decision | peppol uae | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| kit | KW-P09 | decision | peppol authority | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| kit | KW-P10 | decision | e invoicing europe | peppol.org | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): europe. Add it to your services if you do sell it. |
| kit | KW-P12 | reason | storecove pricing | peppol.org | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): storecove. Add it to your services if you do sell it. |
| kit | KW-P14 | reason | peppol jobs | peppol.org | out / career | navigational | names the website itself (peppol) |
| kit | KW-P15 | reason | hmrc vat login | peppol.org | out / government | navigational | a login, portal, status or application task: people want the owner's own site |
| kit | KW-P16 | reason | belgium | peppol.org | out / place_only | off_topic | 0% of its own words match what this website sells (25% is the bar): belgium. Add it to your services if you do sell it. |
| kit | KW-P17 | reason | accounting software | peppol.org | out / off_topic | too_broad | it has only category or place words, "accounting" and "software", so nothing in it points to what this website sells |
| kit | KW-A14 | decision | netsuite certification course | azdan.com | out / career | in_topic | kept as a target |
| kit | KW-A15 | reason | sap business one partner uae | azdan.com | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): sap. Add it to your services if you do sell it. |
| kit | KW-A16 | reason | odoo pricing | azdan.com | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): odoo. Add it to your services if you do sell it. |
| kit | KW-A21 | reason | azdan careers | azdan.com | out / career | navigational | names the website itself (azdan) |
| full | KW-T10 | decision | ai for finance operations uae | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): operations. Add it to your services if you do sell it. |
| full | KW-T11 | decision | erp software uae | techand.ai | in / in_topic | too_broad | it has only category or place words, "erp", "software" and "uae", so nothing in it points to what this website sells |
| full | KW-T12 | decision | best erp software uae | techand.ai | in / in_topic | too_broad | it has only category or place words, "best", "erp", "software" and "uae", so nothing in it points to what this website sells |
| full | KW-T13 | decision | erp systems in uae | techand.ai | in / in_topic | too_broad | it has only category or place words, "erp", "systems" and "uae", so nothing in it points to what this website sells |
| full | KW-T14 | decision | vat registration uae | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): registration. Add it to your services if you do sell it. |
| full | KW-T17 | decision | uae e invoicing mandate 2026 | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): mandate. Add it to your services if you do sell it. |
| full | KW-T18 | decision | fta e invoicing | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): fta. Add it to your services if you do sell it. |
| full | KW-T19 | decision | peppol uae | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): peppol. Add it to your services if you do sell it. |
| full | KW-T31 | reason | cleartax e invoicing uae | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): cleartax. Add it to your services if you do sell it. |
| full | KW-T32 | reason | cleartax vs zoho | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): cleartax, zoho. Add it to your services if you do sell it. |
| full | KW-T34 | reason | odoo pricing uae | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): odoo. Add it to your services if you do sell it. |
| full | KW-T35 | reason | netsuite pricing | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): netsuite. Add it to your services if you do sell it. |
| full | KW-T38 | decision | sap implementation dubai | techand.ai | out / other_brand | in_topic | kept as a target |
| full | KW-T50 | reason | ai course dubai | techand.ai | out / career | off_topic | 0% of its own words match what this website sells (25% is the bar): course. Add it to your services if you do sell it. |
| full | KW-T51 | decision | ai consultant | techand.ai | out / career | in_topic | kept as a target |
| full | KW-T52 | reason | software companies in dubai | techand.ai | out / off_topic | too_broad | it has only category or place words, "software", "companies" and "dubai", so nothing in it points to what this website sells |
| full | KW-T58 | reason | intelligent software solutions | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): intelligent. Add it to your services if you do sell it. |
| full | KW-T61 | reason | meta ai | techand.ai | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): meta. Add it to your services if you do sell it. |
| full | KW-T65 | reason | will marketing jobs be taken over by ai | techand.ai | out / off_topic | career | people looking for work, not buyers of what this website sells |
| full | KW-T66 | decision | it consultant capgemini | techand.ai | out / other_brand | in_topic | kept as a target |
| full | KW-T67 | decision | tech consultant deloitte | techand.ai | out / other_brand | in_topic | kept as a target |
| full | KW-T68 | decision | استشارات الذكاء الاصطناعي في دبي | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): استشارات, الذكاء, الاصطناعي, دبي. Add it to your services if you do sell it. |
| full | KW-T69 | decision | شركة استشارات ذكاء اصطناعي | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): شركة, استشارات, ذكاء, اصطناعي. Add it to your services if you do sell it. |
| full | KW-T70 | decision | مايكروسوفت دايناميكس 365 الإمارات | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): مايكروسوفت, دايناميكس, الإمارات. Add it to your services if you do sell it. |
| full | KW-T71 | decision | الفاتورة الإلكترونية في الإمارات | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): الفاتورة, الإلكترونية, الإمارات. Add it to your services if you do sell it. |
| full | KW-T72 | decision | نظام الفوترة الإلكترونية الإمارات | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): نظام, الفوترة, الإلكترونية, الإمارات. Add it to your services if you do sell it. |
| full | KW-T73 | decision | برنامج محاسبة في الإمارات | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): برنامج, محاسبة, الإمارات. Add it to your services if you do sell it. |
| full | KW-T74 | decision | كوبايلوت مايكروسوفت للشركات | techand.ai | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): كوبايلوت, مايكروسوفت, للشركات. Add it to your services if you do sell it. |
| full | KW-T75 | reason | وظائف الذكاء الاصطناعي في دبي | techand.ai | out / career | off_topic | 0% of its own words match what this website sells (25% is the bar): وظائف, الذكاء, الاصطناعي, دبي. Add it to your services if you do sell it. |
| full | KW-T76 | reason | راتب مستشار ذكاء اصطناعي | techand.ai | out / career | off_topic | 0% of its own words match what this website sells (25% is the bar): راتب, مستشار, ذكاء, اصطناعي. Add it to your services if you do sell it. |
| full | KW-T77 | reason | وظائف محاسب في دبي | techand.ai | out / career | off_topic | 0% of its own words match what this website sells (25% is the bar): وظائف, محاسب, دبي. Add it to your services if you do sell it. |
| full | KW-T78 | reason | الهيئة الاتحادية للضرائب تسجيل الدخول | techand.ai | out / government | off_topic | 0% of its own words match what this website sells (25% is the bar): الهيئة, الاتحادية, للضرائب, تسجيل. Add it to your services if you do sell it. |
| full | KW-T79 | reason | تجديد الهوية الإماراتية | techand.ai | out / government | off_topic | 0% of its own words match what this website sells (25% is the bar): تجديد, الهوية, الإماراتية. Add it to your services if you do sell it. |
| full | KW-T80 | reason | تصديق الشهادات وزارة الخارجية | techand.ai | out / government | off_topic | 0% of its own words match what this website sells (25% is the bar): تصديق, الشهادات, وزارة, الخارجية. Add it to your services if you do sell it. |
| full | KW-T81 | reason | دبي | techand.ai | out / place_only | off_topic | 0% of its own words match what this website sells (25% is the bar): دبي. Add it to your services if you do sell it. |
| full | KW-P01 | decision | what is peppol | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| full | KW-P02 | decision | peppol e invoicing | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| full | KW-P03 | decision | peppol access point | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| full | KW-P04 | decision | peppol bis billing 3.0 | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| full | KW-P05 | decision | peppol network | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| full | KW-P06 | decision | peppol members | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| full | KW-P07 | decision | openpeppol membership | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| full | KW-P08 | decision | peppol uae | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| full | KW-P09 | decision | peppol authority | peppol.org | in / in_topic | navigational | names the website itself (peppol) |
| full | KW-P10 | decision | e invoicing europe | peppol.org | in / in_topic | off_topic | 0% of its own words match what this website sells (25% is the bar): europe. Add it to your services if you do sell it. |
| full | KW-P12 | reason | storecove pricing | peppol.org | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): storecove. Add it to your services if you do sell it. |
| full | KW-P14 | reason | peppol jobs | peppol.org | out / career | navigational | names the website itself (peppol) |
| full | KW-P15 | reason | hmrc vat login | peppol.org | out / government | navigational | a login, portal, status or application task: people want the owner's own site |
| full | KW-P16 | reason | belgium | peppol.org | out / place_only | off_topic | 0% of its own words match what this website sells (25% is the bar): belgium. Add it to your services if you do sell it. |
| full | KW-P17 | reason | accounting software | peppol.org | out / off_topic | too_broad | it has only category or place words, "accounting" and "software", so nothing in it points to what this website sells |
| full | KW-A14 | decision | netsuite certification course | azdan.com | out / career | in_topic | kept as a target |
| full | KW-A15 | reason | sap business one partner uae | azdan.com | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): sap. Add it to your services if you do sell it. |
| full | KW-A16 | reason | odoo pricing | azdan.com | out / other_brand | off_topic | 0% of its own words match what this website sells (25% is the bar): odoo. Add it to your services if you do sell it. |
| full | KW-A21 | reason | azdan careers | azdan.com | out / career | navigational | names the website itself (azdan) |
