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

## Trial re-run on production (2026-11-10 23:13 UTC, executions 12607 techand.ai / 12608 devaicon.com, deployed build 347073cb)
Both runs ok in 5.5 minutes ($0.36 / $0.20). Every results page read through the queue with exact addresses (60 of 60 each; 525 of 525
and 512 of 512 results). Groups of 2+ searches: 9 (techand) and 5 (devaicon), none before. Stopped by the new rules: techand 41
practitioner, 20 career, 3 other market; devaicon 51 career, 18 off topic, 11 practitioner. CRM: "best crm service provider in uae" points
at /dynamics-365-crm-uae, nothing at the "-2" copy.

**Precision on what passed, measured honestly.** The runs reused the stored discovery list, so 334 of the 530 passing searches were in the
labelled set and 196 were new (the filter freed room the old run never reached). A fresh independent labeller (Opus, never saw the filter)
labelled the 196 (harness/accuracy/ki_gate_unseen_2026-11-11.json):

| | all that passed, right | the unseen ones, right |
|---|---|---|
| techand.ai | 73.0% (old run 57.0%) | 58.5% (147) |
| devaicon.com | 68.7% (old run 39.7%) | 57.1% (49) |

The word rules do not generalise well enough: the unseen leaks are a long tail (technical Peppol terms: "peppol sml", "peppol protocol",
"peppol test"; ERP coursework: "characteristics of erp", "sap vs erp"; company lists). A definition / investor rule was tried and gave
+1.6 points on techand's unseen set; not shipped on its own.

**Next (proposed, not built): read who the search is for from its own results page.** With the queue a page costs $0.0006, so every
candidate can be read (300 a run = $0.18) instead of the top 60. The results page already says who Google thinks searches it:
documentation hosts (learn.microsoft.com, docs.*, github, community forums), job boards, universities and course sites, vendors and
providers, directories. A search whose top results are mostly documentation or courses is not a buyer's, whatever its words; the word rules
stay as the cheap first pass. Measure on the same two labelled sets (800 + 196 unseen).

## The next step, measured (2026-11-11): read the results page, then judge (fixes/GATE2.md, private evidence in ~/seo-agent-secrets/keyword-intel-2026-11-08/serpintent-2026-11-11/)
All 996 labelled searches were read once through the normal-priority queue (995 pages, 8,421 results, 8 redirects, $0.60).

**1. The results page's shape alone does not separate them.** A share rule (documentation / learning / job pages vs providers and
lists, thresholds swept on the tuning halves only) moved unseen precision by +1 to +2 points: the unseen leaks ("peppol directory",
"sap vs erp", "erp objectives") show mixed or buyer-looking pages. Not shipped.

**2. A model judging each search with its top 5 results does.** One Messages API call per 40 searches, structured JSON output, the
site described only by what production stores (domain, market, its own services list), effort low; run from the production engine
container, no workflow touched ($1.10 for all three variants):

| set | words only (deployed) | Haiku 5.5, words | Haiku 5.5 + top 5 results | Opus 5.5 + top 5 results |
|---|---|---|---|---|
| all 800: precision / recall | 78.5 / 90.7 | 86.9 / 88.2 | 85.4 / 92.9 | **89.5 / 95.3** |
| hold-out 400 | 73.2 / 90.9 | 88.6 / 89.1 | 86.0 / 93.3 | **86.8 / 95.8** |
| unseen 196 (gate passes only) | 58.2 | 83.3 / 87.7 | 83.2 / 95.6 | **89.9 / 93.9** |
| label agreement (7 classes, all 800) | - | 80.1% | 80.3% | 88.1% (labellers agreed 89-94%) |

Caveat: the labels were made by Claude models too (Sonnet, Opus), so part of the agreement can be a shared bias; the next Trial's output
is the real check. Putting the word rules in front of the model lowers recall (all 800: 95.3 -> 88.2) for little precision: in the build
only the sure word rules (another language or country, AVOID, own brand, government / portal) stay in front.

Cost per keyword-research run of ~300 candidates: results pages $0.18 (queue) + Opus 5.5 ~$0.31 or Haiku 5.5 ~$0.01 (measured tokens:
185,535 in / 14,613 out for 996 searches on Opus).
