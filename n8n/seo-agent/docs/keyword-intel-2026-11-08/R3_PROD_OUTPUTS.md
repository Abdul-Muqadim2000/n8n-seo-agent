# R3: keyword decisions production actually made (read 2026-11-08)

Part of the keyword intelligence programme (KI, `README.md`). Question: were the keywords production recommended, checked,
chose and wrote for its real clients the ones an expert SEO strategist would choose? The owner thinks selection is poor and
lacks competitor and searcher research. Short answer: **he is right, and the evidence is in the stored data.**

## 0. Method, scope, limits

- Production read 2026-11-08 about 00:40 UTC, strictly read-only: SQL on `alaventra-vm-1` with `default_transaction_read_only=on`
  (n8n Data Tables are the `data_table_user_*` tables; the app database for `keyword_checks`, `keyword_proposals`, `runs`,
  `reports`, `sites`, `files`). No write, no workflow run, no restart, no paid call. Four client URLs were fetched once (free
  HTTP status check) to verify a stored status.
- Raw dumps (business data) are in the private folder `~/seo-agent-secrets/keyword-intel-2026-11-08/` (see its `INDEX.txt`).
  This file keeps only keywords, client domains and ids; no personal data, contacts or secrets.
- Real companies: **techand.ai** (Tech&, Microsoft Dynamics 365 partner, Dubai) and **devaicon.com** (Devaicon, AI and software
  house, Sharjah HQ, Multan office). Two more organisations ("techand", "Techand LLC", 2026-10-25) have no website and no keyword
  data. Production data was wiped 2026-10-21, so this covers 2026-10-22 to 2026-11-06: 77 runs, 140 reports, 12 keyword checks,
  15 keyword proposals, 3 keyword discoveries, 5 ladder plans, 15 ladder rungs, 16 content-log rows, 47 AI questions, 45 rank
  readings, 480 Search Console query rows.
- Limits: two weeks is too short to judge rankings fully; Search Console rows are the top ~100 queries per 28-day window;
  DataForSEO volumes are provider estimates. Where I propose better keywords I mark which numbers are stored and which still need
  a check.

## 1. What the clients sell, what they asked, what we told them

### techand.ai (country UAE, goal leads)
- Sells: Dynamics 365 Business Central, Finance & Operations, CRM / Sales, Project Operations; NAV, GP and AX migrations;
  managed support; Copilot Studio agents; Power Platform / Power BI; **UAE e-invoicing (Peppol) and VAT compliance**. Buyers:
  CFOs, finance heads, IT managers of mid-size and large UAE / GCC companies looking for an implementation partner.
- Asked for (typed or picked): `dynamics 365 erp system` (picked from our discovery), `crm service provider in uae`,
  `erp & crm software` (approved proposal), `crm service provider` (typed; replaced the proposal `erp software uae`), page `ms 365 erp`.
- What we told them and did:

| What | Our output | Stored evidence |
|---|---|---|
| Discovery 2026-10-22 (req 934 / exec 935) | Start with `dynamics 365 erp system` (30/mo); priority list of ERP terms; content plan "Now": `erp system dubai`, `erp software uae`, `erp solutions`, `erp warehouse management system`, `top erp systems`; "Later": `erp system` (5,870, a what-is guide), `erp software examples` | report 3602fff8; `search_console.available=false`; reach 10 by "size"; **no Peppol / e-invoicing keyword anywhere** |
| Check `crm service provider in uae` (db229eb9) | "Reachable, Short ladder, 4-8 months, no search data" | Results page: 10 of 10 are lists; `existing: null` although the site has `/dynamics-365-crm-uae` |
| Ladder `dynamics 365 erp system` (req 944) | 4 rungs: `is microsoft dynamics 365 an erp system` (guide), `ms 365 erp`, `microsoft dynamics erp`, the head | all published; 3 of them onto one URL (section 3, F6) |
| Ladder `erp & crm software` (req 2566) | head 20/mo, -75% a year; rung `erp systems in uae` written as an update of the blog post | ladder later removed; feasibility notes say the SERP is "ERP vs CRM explainers" |
| Ladder `crm service provider` (req 7338) | rungs `crm for customers`, `what is a crm company`, `best crm software for customer service`, `crm service module`; head on `/dynamics-365-crm-uae-2` | `crm for customers` verdict AVOID, written and published anyway |

### devaicon.com (app country UAE, goal leads)
- Sells: custom AI solutions, automation, agentic AI, custom software, Microsoft enterprise systems (Dynamics 365, Fabric,
  Power Platform), managed IT support; plus a dedicated **Open edX** section (services, hosting, development). Customers: mid-size
  and large organisations "mainly in the UAE and GCC" (banking, public sector, education, tourism, trading, retail).
- Asked for: `open edx provider` (checked 6 times), `software development agency`, `ai automation solutions gcc`,
  `agentic ai development in uae`, and page runs on its own menu labels (`privacy policy`, `engagement models`,
  `strategic consulting & transformation` twice, `banking & financial services technology`, `application & software development`).
- What we told them and did: discoveries 2026-10-23 (req 1258) and 2026-11-04 (req 8453) in **Pakistan**; start with
  `it solutions` then `computer software development companies`; ladders `ai automation services pakistan` and
  `agentic ai development in uae`; 9 pages written or rewritten (section 4).

## 2. Verdicts on the clients' own words

| Client words | Our verdict | Expert judgement |
|---|---|---|
| `crm service provider in uae` | Reachable, short ladder, no data | Right buyer intent, wrong plan. The results page is all lists (bayzat, goodfirms, corporatestack, a LinkedIn top-15): a service page will not rank; the move is getting onto those lists plus one comparison page, and targeting the Microsoft-specific variant (`dynamics 365 crm partner uae`). We did neither; we did not see the client's own CRM page. |
| `crm service provider` (11-03) | Reachable, short ladder (10/mo, results page not read in time) | Weaker than the UAE version (dropped the market word, 10/mo, 7 of 12 months zero). We accepted it and built informational rungs around generic CRM. |
| `dynamics 365 erp system` (picked from us) | Start with it; Reachable | Low value (30/mo) and the results page is mostly "Is Dynamics 365 an ERP or CRM?" guides; our own live check flagged the mismatch (guides 5 of 10, "this plan writes a service page") and we still planned a service page. |
| `open edx provider` | Six checks: "Reachable" four times, "Not realistic" once (be51ddba vs 0de9621b: same keyword, same country UAE, same rules version, same day; `navigational` flipped to true), fit 0 every time | Wrong. Open edX is Devaicon's most distinctive offer (3 pages, its only service query in Search Console is `open edx service provider in india`). Fit 0 came from the business text, which does not mention Open edX, not from the site's own pages. A strategist would build an Open edX cluster (hosting, development, provider) against named specialists, not drop it. |
| `software development agency` | "Easy for your site, Direct plan, 2-4 months" (Pakistan, 720/mo, KD 14) | Not easy: the results are lists (topdevelopers, themanifest) and the site had 66 impressions in 28 days. "Easy" rests on a default reach (F3). |
| `ai automation solutions gcc` | Reachable, ladder in **Pakistan** | Reasonable words with no data; the ladder then turned into `ai automation services pakistan`, the wrong market. |
| `agentic ai development in uae` | Reachable, ladder, results page not read in time | Fair buyer words; the rungs we chose (`ai development companies`, `ai app development companies`) are list searches answered by "top companies" articles, and we wrote service pages for them. |
| `privacy policy` | AVOID (good) | Correct. |
| menu labels (`engagement models`, ...) | GO_WITH_CHANGES, no keyword data | Not keywords. Each should have been mapped to a real query (section 6). |

## 3. Competitors

- **Declared competitors: none** for either client (app `sites.competitors` = [], engine `seo_monitors` has no competitor field set).
- **Discovered** competitors come from one results page for one generic seed, in the delivered keyword document only
  ("one results page only, so this is a thin read"):

| Run | Seed read | Picked | Problem |
|---|---|---|---|
| techand 10-22 | `erp partner dubai` | brainsphereit.com (#1), skytechdigital.ae (#3), cubezix.com (#5) | Generic ERP sellers of any brand; no Microsoft Dynamics partner, although the Dynamics results we stored name dynamicssquare.com, visionet.com, intwo.cloud, randgroup.com, velosio.com, dynamicsaxis.com, penieltech.com |
| devaicon 10-23 | `software company in uae` | start-tech.ae, carmatec.com, softwarecompany.ae | Generic software houses; nothing on AI automation or Open edX (raccoongang.com, edly.io, edunext.co are on our own Open edX SERP reads) |
| devaicon 11-04 | `software development company uae` | step2gen.com (#18), cezcon.com (#21), skytechdigital.ae (#22) | Positions 18-22; a different set from 12 days earlier |

- What we did with them: their ranked keywords feed "competitor gaps" (techand: 10 ERP terms, all marked "not one of the
  services you listed", F4); devaicon: 0 gaps. They never reached the AI side.
- AI side: `seo_ai_targets.competitors` mixes software vendors (sap.com, oracle.com, netsuite.com) with text fragments taken as
  rivals: "Milestones", "Testing", "Phase 1", "AED 300k-450k", "Procurement", "Operations". google.com is listed as a top
  competitor on 15 of 16 priority keywords of devaicon's 11-04 discovery and on 2026-11-05/06 rank readings.

## 4. Outcomes

| Keyword written | Site | Provider volume | Page / status | Ranking and impressions since |
|---|---|---|---|---|
| is microsoft dynamics 365 an erp system | techand | 10 (0 in 9 of 12 months) | /insights/is-microsoft-dynamics-365-an-erp-system, published 10-23 | the only page that moved: GSC 111 -> 545 impressions (28d), 0 clicks; `dynamics 365 erp system` #12-46, #16 on 11-05 |
| microsoft dynamics erp; dynamics 365 erp system | techand | 70; 30 | **the same URL** as above (refreshes 10-29, 11-02) | same page; `microsoft dynamics erp` #37 then not found |
| ms 365 erp | techand | 10 | /ms-365-erp-uae (new, indexed) | #30-39 via the blog post, then not found; page 56 impressions at #54 |
| erp systems in uae | techand | 260, list SERP | written onto the blog post 10-26 | not tracked |
| crm for customers (AVOID) | techand | 40 | /insights/crm-for-customers 11-06 | no impressions yet |
| ai in industrial automation | devaicon | 10, Pakistan, informational | /insights/ai-in-industrial-automation | 10 impressions at #4.7 (the only devaicon page with any) |
| ai automation services pakistan | devaicon | no data, wrong market | /services/ai-automation-services-pakistan | not found |
| ai development companies; ai app development companies | devaicon | 320; 210, list SERPs | /services/... (waiting for Google) | not found |
| engagement models; application & software development; banking & financial services technology; strategic consulting & transformation (x2) | devaicon | no data (Pakistan) | rewritten at new /services/ URLs, "marked published by you after a warning" | 0 impressions |

Totals: 15 keyword targets, about 970 searches a month by provider estimates, 790 of them on list results pages where a service
page is the wrong type. Devaicon's whole site had 66 impressions in its last 28 days. Techand's site grew 5,758 -> 8,013
impressions (10-19 to 11-02), driven by brand queries and its older Peppol pages, not by our pages.

## 5. Ranked failures, with evidence

**F1. Wrong market for devaicon (High).** 13 devaicon runs were sent with country Pakistan (3 discoveries, 4 checks, ladder 2548,
6 page runs) while the stated customers are UAE / GCC and the app site country is UAE; the engine's business card (`seo_sites.nap_json`)
carries `country_code: PK` for a Sharjah address. Effects: discovery 11-04 (exec 8454) **refused 15 UAE / Dubai keywords as "outside
the market this website is measured in (PK)"** (`software development company in uae` 140/mo, `... in dubai`, `custom software
development company dubai`) and put `software development company in us` (1,600) in its "Now" tier (the market filter catches
"usa" but not "us"); the ladder for `ai automation solutions gcc` became the page `ai automation services pakistan`; the BFSI page
talks about "Pakistani financial institutions"; the AI panel asked about Karachi, Lahore and Islamabad for a week (10-30 to 11-06);
check alternatives invented `custom software development karachi` (no Karachi office). Nothing warned that the market contradicts
the customers on file. (Who set Pakistan, the client or a default, is for R2.)

**F2. Search Console ignored when choosing keywords (High).** techand's discovery ran 13 minutes before Search Console was
connected (`search_console.available=false`) and was never re-run; its list fed the weekly proposals until 11-03. Every ladder
note says "nothing techand.ai ranks for is on this topic" while the site already earns impressions on it. Proven demand on the
11-02 window that no keyword decision used:

| Cluster (techand GSC, 28 days) | Queries | Impressions | Best positions |
|---|---|---|---|
| Peppol / PINT AE / e-invoicing | 21 | 928 | `pdf vs e-invoice uae` 19.6, `uae peppol pint-ae compliance` 20.4, `peppol access point service provider uae` 53.5 |
| D365 Finance & Operations UAE | 17 | 666 | `d365 finance and operations` 20.5, `dynamics 365 finance and operations` 23.4 |
| partner / implementation | 16 | 459 | `microsoft dynamics 365 partner in uae` 73, `dynamics 365 partner in uae` 71 |
| AX / NAV / GP upgrade | 5 | 176 | `dynamics ax dubai` **8.4**, `microsoft dynamics ax abu dhabi` 13.6, `microsoft dynamics ax dubai` 14.7 |
| cloud migration | 5 | 163 | `dynamics 365 cloud migration services in uae` **2.9**, `d365 cloud migration uae` 5.5 |
| CRM (what the ladders chase) | 7 | 17 | none ranking |

Only the cadence's striking-distance rule saw two of these (preview 2026-11-03: `dynamics 365 cloud migration services in uae`
#4, `dynamics ax dubai` #8), and on 11-05 they were pushed to "upcoming" by the new CRM ladder's rung `what is a crm company`.

**F3. "Difficulty for your site" is a constant (High).** All 12 checks, 3 discoveries and 5 ladders used reach 10, `method: size`,
`sample: 0`, `organic_keywords: 0`. 9 of 12 checks had no volume and no difficulty and still printed "Reachable, Short ladder,
4-8 months". The labels read as a judgement but are a default.

**F4. Service list mis-parsed, so fit is wrong (High).** The business text was split on commas: techand's services include
"Microsoft Dynamics 365 consulting and implementation in the UAE and GCC: Busines" and "and UAE e-invoicing (Peppol) and VAT
compliance."; devaicon's "and ongoing managed IT support. Every solution is built around your business nee". Result: for an ERP
implementation partner, `erp software uae` (480, KD 3), `erp system dubai` (320), `erp solutions` and every competitor-gap keyword
came out `service_fit: out`, "not one of the services you listed".

**F5. List results pages answered with service pages (High).** We detect it ("Comparison or lists are what Google ranks here: 10 of
the 10 results read" for `crm service provider in uae`; 5/7 `ai development companies`; 4/7 `ai app development companies`; 4/7
`erp systems in uae`) and write a service page anyway, or (ladder 2566) fold a list query into an informational blog post. The
expert move: get the client onto the lists that rank, and publish one honest selection guide or comparison.

**F6. One URL for four searches (High).** Ladder `lad_mvjsa7995bsr`: rung 2 (guide), rung 3 `microsoft dynamics erp` and the head
`dynamics 365 erp system` were all published to `/insights/is-microsoft-dynamics-365-an-erp-system` (content log 10, 15, 16), and
ladder 2566 aimed `erp systems in uae` at the same URL. QA warned three times "this website already has a page for the same search:
/dynamics-365-business-central-uae". The service head lives on a blog URL whose title is now "Dynamics 365 ERP System: Right App
for UAE Firms".

**F7. Our own verdicts overridden or unstable (Medium).** `crm for customers`: AVOID, score 30 "clearly low", "not held: a page of
your keyword ladder", published 11-06. `application & software development`: 34 "clearly low", written because it is a refresh.
`open edx provider`: Reachable at 07:43 and Not realistic at 14:37 the same day with the same inputs (section 2).

**F8. Menu labels treated as keywords (Medium).** Devaicon's `engagement models`, `strategic consulting & transformation` (twice,
11-02 and 11-05), `banking & financial services technology`, `application & software development`: no search data, written and
finalised (about $1.3 to $1.5 each), then tracked in the Search Console list with 0 impressions. The writer's own "secondary
keywords" for these pages (`software development engagement models`, `digital transformation consulting uae`, `dynamics 365 for
banking`) are better targets than the primaries.

**F9. Rungs drift to generic and informational (Medium).** techand CRM rungs: `what is a crm company`, `best crm software for
customer service`, `crm service module`, `crm for customers`. The partner-buyer phrases (`crm implementation partner uae`,
`dynamics 365 crm partner dubai`) appear only as supporting keywords of the main page, and the main page targets
`/dynamics-365-crm-uae-2`, a duplicate of the live `/dynamics-365-crm-uae` (index coverage: Google chose another canonical). Both CRM
checks returned `existing: null` for that live page. Devaicon's ladder rung `ai in industrial automation` (factories) is not what
Devaicon sells.

**F10. Discovery fills plans with glossary and research terms (Medium).** devaicon: `it solutions` as the start keyword (results
are exact-match brand domains itsolutions-inc.com, itsolutions.com.pk; opportunity 848), `digital solutions`, `tech solutions`,
`adaptive software development` (15,520), SDLC, agile, scrum, programming languages. techand: `erp system` (5,870, meaning),
`erp warehouse management system`, `top erp systems`. For a leads goal these are students and researchers.

**F11. Competitor research is one generic results page (Medium).** Section 3: no Dynamics partner chosen for techand, no AI or
Open edX specialist for devaicon, three different sets in 12 days, positions 18-22 accepted, google.com and text fragments counted
as competitors.

**F12. Stale page facts steer choices (Medium).** 13 techand pages are stored as 404 from one probe (2026-10-22 17:00:21), including
`/dynamics-365-crm-uae`, `/dynamics-365-cloud-migration-uae` and the PINT AE guide; all three answer 200 today. The AI target for
`peppol access point provider uae` was skipped as "no longer lost in the latest AI check" when its question had been retired, not
won (techand was named in no Peppol answer).

## 6. What the right choices would have been

Numbers marked GSC are stored Search Console figures (28 days to 2026-11-02 / 11-03); "stored" are DataForSEO figures already in
our reports; "check" means the volume still needs one free or paid lookup.

**techand.ai, in this order:**
1. **E-invoicing / Peppol hub** (GSC 928 impressions, 21 queries, positions 20-56, no clicks): improve and interlink the PINT AE
   guide and the e-invoicing posts, and add one service page for e-invoicing on Dynamics 365 targeting `peppol access point
   provider uae`, `peppol pint uae`, `uae e-invoicing software`, `e-invoicing dynamics 365 uae` (check). It is a declared service,
   the site's largest non-brand cluster and a dated legal deadline in the UAE.
2. **Striking distance first**: `dynamics 365 cloud migration services in uae` (#2.9), `d365 cloud migration uae` (#5.5),
   `dynamics ax dubai` (#8.4), `microsoft dynamics ax abu dhabi` (#13.6), `microsoft dynamics ax dubai` (#14.7): refresh the
   existing migration and AX-upgrade pages; these are a few positions from page one with buyer intent.
3. **Partner intent**: `microsoft dynamics 365 partner uae / dubai`, `dynamics 365 implementation partner uae` (GSC positions ~70):
   one partner page, plus listings on the directories and "top partner" articles that rank (the same list SERPs we detected).
4. **Finance & Operations UAE** (GSC 666 impressions, #20-56): strengthen the existing F&O page rather than new generic ERP pages.
5. **Cost questions**: `dynamics 365 implementation cost uae` (a long cost query already ranks #8.4 in GSC): one pricing guide.
6. CRM only after these, as `dynamics 365 crm partner uae` / `dynamics 365 sales implementation uae` (check), improving the live
   `/dynamics-365-crm-uae` page, not a `-2` copy.
7. Generic `erp software uae` (480, KD 3, stored) is a fair secondary target only as a list or selection guide, since lists rank.

**devaicon.com:**
1. **Measure in the UAE** (HQ Sharjah, customers UAE / GCC). Candidates already stored: `software development company in uae`
   (140, KD 50), `custom software development company dubai` (40), `ai development companies` UAE (320, KD 11, a list SERP: earn
   list placements; the site has Clutch awards to show).
2. **Open edX as the niche** (global English market, check volumes): `open edx hosting`, `open edx development company`, `open edx
   service provider`, `managed open edx`; rivals to watch: raccoongang.com, edly.io, edunext.co (all on our stored Open edX reads).
3. **AI automation in the UAE**: `ai automation company uae`, `agentic ai development company uae`, `ai agent development dubai`
   (check), one service page each where the results show service pages, list placements where they show lists.
4. **Map each menu page to a real query** instead of its label: engagement models -> `software development engagement models` /
   `dedicated team vs staff augmentation`; consulting -> `digital transformation consulting uae`; BFSI -> `banking software
   development uae` (all check).

## 7. What this means for the design (input for DESIGN.md)

1. One market per site, stated and checked: refuse or warn when the run's country contradicts the customers on file.
2. Search Console first: seed and rank candidates from the site's own queries and pages (clusters, striking distance, page-2 pages),
   re-run discovery when Search Console connects, and let proven demand outrank new ladder rungs.
3. Real reach: measure it from Search Console positions when DataForSEO knows no keyword; say "unknown" instead of "Reachable".
4. Parse services as a list the client confirms, and judge fit against the site's own service pages, not only the business text.
5. Page type follows the results page: lists mean placements plus a selection guide, never a service page by default.
6. One keyword cluster, one URL, enforced at publish time; never point a service head at a blog URL.
7. Competitors: the client's declared rivals plus businesses that rank across many of the site's money keywords, typed (direct
   rival, list / directory, media, vendor), stable across runs, never search engines or text fragments.
8. A verdict of AVOID or "clearly low" stops the page unless the client overrides it explicitly, ladders included.
