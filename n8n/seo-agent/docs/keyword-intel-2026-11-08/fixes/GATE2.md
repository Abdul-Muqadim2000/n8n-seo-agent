# KI-GATE2: who is searching (2026-11-11)

## Why
The last Trial (2026-11-10, executions 12315 techand.ai and 12317 devaicon.com) let through searches no client would want a page for: Peppol in
Belgium, the Netherlands and Poland ("peppol verplicht nederland", "peppol facture"), exam codes and courses ("mb 300 ...", "... training",
"interview questions"), product documentation ("... user guide pdf", "... ip ranges", "peppol bis billing 3 0"), unrelated subjects ("trade
finance operations", "facilities management services in uae") and, for devaicon, "software developer", SDLC coursework and packaged products
it does not sell ("hrms software in dubai").

## The labelled set (harness/accuracy/ki_gate_2026-11-11.json)
800 searches of those two runs, labelled twice by agents that never saw the filter: labels 1 (Sonnet; it gave each site a default label,
which made some calls inconsistent) and labels 2 (Opus, every search judged on its own). Binary agreement 89.0% (techand) / 93.5% (devaicon).
The final label is labels 2, with one written override: a search naming another country, the Gulf states too, is `other_market`, because
the site is measured on Google UAE and the ladder package locks the market the same way (3 searches). Labels: pass, job (job, course, exam,
coursework), practitioner (someone using the product: docs, files, specs, settings), other_market (another country or language), off_topic,
other_brand, not_a_search. dev = even ids (the rules were tuned on them), hold = odd ids (measured, not read keyword by keyword).

## Result
| | precision of "pass" | right ones kept | wrong ones caught |
|---|---|---|---|
| before, all 800 | 46.6% | 93.5% | 27.8% |
| after, all 800 | 78.5% | 90.7% | 83.3% |
| after, hold-out techand | 79.6% (was 49.7%) | 88.7% (was 92.8%) | 80.5% |
| after, hold-out devaicon | 66.0% (was 45.0%) | 94.1% (was 98.5%) | 73.0% |

What still passes on devaicon is mostly coursework phrased in new ways and other companies named with no tell in the words ("qube
development reviews"). More rules on the same 800 searches would fit them rather than real searches; the honest next test is an independent
label of the next Trial's output.

## The rules (`_ki.js` `whoSearches`, before the topic gate; the shared fit gate's country list in `_fit_gate.js`)
A buyer word (company, partner, services, cost, best, vs, review, support, migration ...) lets a search through to the topic gate, so
"microsoft dynamics partner uae" or "dynamics 365 support services uae" are never caught by a study or a docs word. Then:
- another language (Dutch, French, German, Spanish words) -> other_market; Belgium, Poland, Romania, the Nordics, Switzerland, Austria,
  Portugal, Greece, Czechia, Hungary, Ghana and more US and Indian places -> other_market (`KI_PLACES`, in the KI kit only: the shared fit gate
  was left unchanged so no other path of the engine changes; only SEOagentKIntel1 and the main workflow's KI Pool (Ladder) node differ);
- studying (SDLC, waterfall, manifesto, exam codes, courses, tutorials, definitions, interview questions); strong study words win over the
  weak buyer words ("agile vs waterfall"); "training" only when it is not a model's training or a training platform -> career;
- a job title on its own, places and seniority dropped ("software developer", "finance operations specialist") -> career;
- someone using the product: documentation, files (pdf, ppt, logo, template), specs, code lists, version numbers, settings, an admin's
  how-to ("how to find peppol id"), a task inside the product ("budgeting in d365 finance and operations") unless the task is a service the
  site sells ("e invoicing in dynamics 365") or a scope word ("modules in d365") -> practitioner (new reason, app words added);
- a search for one company (photos, phone number, LinkedIn page), or a top-3 result whose site name the search carries -> other_brand;
- an event or a tender -> off_topic;
- a packaged product of a category the site does not sell, with no build word ("hrms software", "attendance software") -> off_topic; a category
  the services name (CRM, ERP through Dynamics, invoicing through Peppol, an LMS through Open edX) is not;
- a generic English product name counts as the product only with the vendor named: "finance and operations" alone is not Dynamics F&O
  ("trade finance operations"); CRM stays a category the client sells;
- a service name followed by a word that is no buyer, place, audience or scope word ("software development standard") -> career / practitioner.

## Tests
KIG-1 (floors on all 800 and on the hold-out), KIG-2 (21 searches the Trial and the owner named, each with its reason), KIG-3 (20 buyer
searches never caught). KI16 parity (app list of reasons + `practitioner` words), KI26 seed fixture updated (its "pint ae mandatory fields"
is documentation now). Harness 18829 / 0; app shared 1174, web 359, typecheck clean.
