# R3 - Page type playbook: what Google wants, what ranks and converts, and how to judge it

Date: 2026-10-29. Scope: every page type Alaventra writes or should write for B2B and local businesses. Trigger: the techand.ai
"ms 365 erp" service page (production executions 3299 page run, 3336 finalize) that our app graded 92 then 100 and the client's
reviewer graded 63.

This extends, and does not repeat, `docs/content-quality-2026-10-27/R1_PIPELINE_ANALYSIS.md` (why pages failed the gate) and
`R2_MARKET_RESEARCH.md` (what the market does from draft to publishable page; Google's AI-content, helpful-content and spam guidance;
word count and content-score evidence; GEO paper; client-input UX). R2's sources are cited here only where a page type needs them.

Labels: **[doc]** Google or vendor documentation, opened; **[evidence]** primary or independent study with a published method;
**[vendor study]** a study by a company that sells something related (method published, interest declared); **[vendor claim]**
marketing figures; **[example]** a real page opened on 2026-10-29 and described (structure only, no copied text); **[thin]** little or
nothing found, or read only through a secondary summary; **[ours]** read from our own code or production data.

Rules kept: no client page text beyond short snippets, no secrets, no code changed, no paid API run. Search results in this document come
from a US web search tool (not the UAE results page) plus our own saved production SERP for "ms 365 erp" (DataForSEO, UAE, 2026-10-28).

---

## 0. The short version

1. **The page type is a decision made from the results page, not a label the plan starts with.** Google ranks the kind of page that
   satisfies the dominant reading of a query. Our ladder and cadence default to "Service Page" (`Ladder_Plan.js:139`,
   `Cadence_Plan.js:360`), and the one detector we have (`KWI.serpPageTypes`, `_kw_inputs.js:281`) only writes a note. "ms 365 erp"
   showed 0 local partner service pages, 4 explainers or discussions, 1 video and 4 vendor pages in its first 10 organic results, no
   ads, and an AI Overview. A new service page was the wrong type before a word was written. [ours]
2. **Before "which type", ask "new page or update".** Top-10 pages are old: only 1.74% of new pages reach the top 10 within a year and
   the average #1 page is 5 years old (Ahrefs, May 2025) [evidence]. Google shows at most two listings from one site [doc] and asks
   sites to consolidate duplicates [doc]. techand already had a guide on the same question ranking #32 and a Business Central page on
   the same search. The right output was a refresh of the guide, not a third URL.
3. **Each type has a small set of things it cannot do without**, and most of them are client facts: a service page without verified
   proof, a location page without local substance, a case study without numbers, a pricing page without a price are the weak
   versions every competitor already has. When the client facts are missing, the system asks before writing or writes a different
   type. It never fills the gap with a homepage slogan.
4. **People Also Ask and related searches are evidence of intent, not an outline.** The padding sections the reviewer named ("agentic
   ERP", "which big companies use Dynamics 365", a Salesforce comparison) are, word for word, the four People Also Ask questions of
   that SERP. Our brief rule "reuse the People Also Ask questions" turned another interpretation's questions into sections. A PAA
   question goes into a page only when it fits the page's type and buyer. [ours]
5. **FAQ rich results are gone** (deprecated 2026-05-07, documentation removed 2026-06-15) [doc]; HowTo rich results went in 2023
   [doc, via secondary]; Service has no rich result; a business's own review stars are ineligible [doc]. Schema per type is about
   accurate description and entity links, never a promised SERP feature. Google says AI Overviews and AI Mode need no special schema
   or files [doc].
6. **Length follows the type and the pages of the same type that rank**, never one band for all. Google has no preferred word count
   [doc]. A service page band measured on explainers is wrong by construction.
7. **Grade each page against its type's checklist with critical items that cap the score.** Section 4 gives a universal block and
   8-12 items per type. Under that rubric the "ms 365 erp" page fails two critical items (intent fit, cannibalisation) and could not
   score above 50, whatever its readability.

---

## 1. The decision layer: from keyword to page type

### 1.1 What the results page says, and how to read it automatically

Google's own rater guidelines rate a result by how well it meets the **dominant** interpretation of a query (what most users mean),
then common, then minor ones; a very helpful result for a minor interpretation is rated low because few users want it [thin: read
through secondary summaries of the 2023-2025 guidelines; the official PDF could not be parsed here]. Ahrefs' "3 Cs" (content type,
format, angle of the top results) is the working version of the same idea [doc, Ahrefs, 2024-10-11]. The SERP is the measurement of
the dominant interpretation; the job is to read it the same way every time.

Signals, from strongest to weakest, all available from the SERP reading we already buy (DataForSEO `serp/google/organic`, $0.002 a
page, cached per search per day) [ours]:

| Signal | What it says | How to compute |
|---|---|---|
| Shape of the top 10 organic results | The type Google chose | Title + URL classifier (extend `KWI.serpPageTypes`, section 1.2). Count per shape; dominant = largest share |
| Who ranks | Whether a business like the client can rank at all | Share of results that are the product vendor (microsoft.com for Dynamics), government, Wikipedia, directories, forums, video |
| Ads present | Commercial value | `item_types` includes `paid`; none on "ms 365 erp" [ours] |
| Local pack / map | Local intent | `local_pack` or `maps` item type |
| AI Overview | Informational answer expected; clicks reduced | `ai_overview` item type; Seer measured 0.61% organic CTR on informational queries with an AI Overview vs 1.62% without (Sept 2025, 3,119 queries, 42 organisations) [vendor study] |
| People Also Ask | The questions of the dominant and common readings | `people_also_ask` items; classify each question's intent before any reuse |
| Related searches | Confused or navigational demand | `related_searches`; "ms 365 erp download" says some searchers want software, not a partner [ours] |
| Provider `main_intent` | A model's label | DataForSEO keyword intent; weakest signal, a tie-breaker only |
| The client's own Search Console | Which page Google already associates with the query | Query -> page rows in `seo_query_history`; a page with impressions is the update candidate |

### 1.2 Shapes the classifier must know

`KWI.serpPageTypes` knows 9 shapes today: government, comparison or list, forum, directory, pricing, guide, service or product,
homepage, other [ours, `_kw_inputs.js:258-268`]. To choose among the 13 types below it needs these as well:

| Shape to add | Test (title / URL / domain) |
|---|---|
| Vendor or brand official page | domain is the product's maker (a configurable list per topic: microsoft.com, sap.com, oracle.com...) or the query contains the domain's brand |
| Reference / encyclopedia | wikipedia.org, investopedia.com, britannica.com, techtarget.com/definition |
| Glossary / definition | `/glossary/`, `/definition/`, `/what-is-`, title "What is X" with a short page |
| Video | youtube.com, vimeo.com, video carousel item |
| Case study | `/case-stud`, `/customers/`, `/success-stor`, title "case study" |
| Location page | `/locations/`, `/branches/`, city or area name in title + a business name, local pack present |
| News | news domains, `top_stories` item type |

And it must report the **share** and a **confidence**: a dominant shape with at least 5 of 10 results is a clear SERP; 3-4 is a lean;
anything less is mixed.

### 1.3 Decision rules (in order)

1. **Value gate.** If the verdict scored the keyword under 50, or the volume is under 20 a month with no Search Console impressions,
   do not write a page on it alone. Offer: a section in an existing page, a supporting keyword for a stronger page, or "write it
   anyway" with the verdict shown. (The owner's 2026-10-28 instruction "ask before writing a page for a keyword the verdict scored
   under 50" is this rule.) [ours]
2. **Update before new** (section 1.4). If the site has a page for the same search, the output is a refresh or a merge of that page.
3. **Clear SERP.** If one shape holds 5 or more of 10, write that type. If the client cannot supply what the type needs (section 3),
   say so and offer the nearest type it can supply.
4. **Lean or mixed SERP.** Choose a type only if it has at least 3 of 10 results, fits the business goal, and the client has the proof
   it needs. If two types qualify, prefer the one where the client's own site already has a ranking page, then the commercial one.
5. **Unwinnable shapes.** When 4 or more of the top 10 are the product vendor, government or Wikipedia, a business site is competing
   for the remaining slots; say so in the verdict and lower the expected position, but do not change the type.
6. **Local pack present** means a service + location page or a location page (and the Business Profile) is the target, never a
   guide.
7. **Never two pages for one search.** If the plan would create a page whose main query shares 3 or more of its top 7 results with an
   existing page's main query, it is the same search (the ladder already uses this pair rule) [ours].

### 1.4 Update an existing page or write a new one

Evidence: the average #1 page is 5 years old and only 13.7% of top-10 pages are under a year old; 1.74% of new pages reach the top 10
within a year (6.11% on a cleaner subset) (Ahrefs, May 2025, 1M URLs + 1.3M keywords) [evidence]. Workshop Digital measured 95
refreshes against untouched control pages on its own site, 90 days before and after: blog refreshes +545% sessions and service page
refreshes +312%, while the control pages fell 9-33% (May 2026) [vendor study; one site, percentages on small baselines]. Google:
redirects and `rel=canonical` consolidate signals of similar pages into one [doc, 2026-07-10]; Google generally shows no more than two
listings from one site in the top results [doc, ranking systems guide, 2025-12-10].

Update when any of these is true:
- a page of the site gets Search Console impressions for the query or a close variant (position under 50);
- a page's main query shares 3 or more of its top 7 results with the new query;
- a page already covers the topic but for a different type (a guide for a now-commercial query): change that page's type, keep its URL;
- the new query is a narrower variant of a page's topic (make it a section, not a page).

Write new only when no page passes those tests, the SERP shows a type the site does not have, and the value gate passes.

Merge when two existing pages split one search: keep the stronger URL (links, impressions), move the unique content, 301 the other.

### 1.5 Worked example: "ms 365 erp" (UAE, 2026-10-28) [ours]

First 10 organic results (ranks 2-13; rank 1 was the AI Overview), classified by hand with the shapes above:

| # | Shape | Result (domain, title gist) |
|---|---|---|
| 1 | Service or product (partner) | dynamicssquare.com product page "Microsoft Dynamics ERP Software" |
| 2 | Video | youtube.com, ERP modernisation with Dynamics 365 |
| 3 | Forum | gartner.com peer community, "Is Microsoft Dynamics primarily a CRM or an ERP?" |
| 4 | Directory | erpsoftwareblog.com software listing |
| 5 | Vendor official | microsoft.com (en-my) ERP solutions |
| 6 | Comparison | ravenlabs.com.au, Dynamics 365 vs traditional ERP |
| 7 | Guide | visionet.com, what a Dynamics 365 ERP system is (UK decision makers) |
| 8 | Guide | abouttmc.com blog, reasons to consider Dynamics 365 ERP |
| 9 | Vendor official | microsoft.com (fr-fr) |
| 10 | Vendor resource | esker.com solution summary |

Plus: AI Overview present, no ads, People Also Ask = CRM comparison, "is D365 an ERP", "what is agentic ERP", "which big companies use
Dynamics 365", related search "ms 365 erp download". techand's own guide "Is Microsoft Dynamics 365 an ERP System? UAE Buyer's Guide"
ranked #32 for this query.

Reading: informational or confused intent (guides, forum, comparison, video = 5), vendor pages the client cannot outrank (4), one
partner product page, no UAE result, no commercial signal (no ads, volume 10 a month, verdict 42). Rules 1 and 2 both stop a new page.
The right action was: refresh the existing guide to answer the naming confusion ("Microsoft 365" vs "Dynamics 365") in its first
paragraph, add the UAE e-invoicing dates (section 2.3), link it to the Business Central service page, and use "ms 365 erp" as a
secondary keyword of that guide. Cost: one refresh run instead of a new page, no cannibalisation, no 63/100 page in the client's name.

---

## 2. Rules that apply to every type

### 2.1 Proof ledger: what comes from the client and what can be general

Google: "trust is most important"; pages should show first-hand expertise and original information, and fabricating creator profiles
is deception [doc, helpful content, 2026-10-05]. FTC: AI-written fake testimonials are banned, claims must be substantiated [evidence,
see R2 3.6]. The client's reviewer scored proof 7/15 because the page carried only "Microsoft partner, DAFZA" plus unsupported
"free consultation" and sector claims.

Every statement on a page is one of three kinds, and the writer must know which before it writes:

| Kind | Examples | Source allowed |
|---|---|---|
| Client fact | partner tier, certifications, years, team size, offices, named clients, results, prices, guarantees, free offers, sectors served, process steps "we" follow, response times, languages | client profile, business facts, case studies, the client's own pages (read, not guessed), answers to questions. Never the model |
| Market or product fact | licence prices, product features, regulations, deadlines, statistics | an official or primary source with a date (vendor docs, ministry, regulator, standard); one vendor or agency blog per page at most, never for a compliance figure (already in the brief rules) [ours] |
| Advice | how to choose, what to check, mistakes to avoid | the writer, framed as advice to the reader, never as what the client does unless a client fact says so |

**Slogans are not proof.** A sentence that is an adjective plus the client's name ("Deep UAE & GCC knowledge", "trusted partner",
"tailored solutions") proves nothing to a reader or a rater. Proof is a checkable noun: a named client, a number with a basis, a dated
certification, a link to a case study. The prefilled answer to a proof question must be a proof item from the ledger or empty with
"leave it general", never a homepage hero line. Detection: a candidate proof item with no number, no proper noun other than the
client's own name, and no URL is a slogan.

### 2.2 Intent-filtered People Also Ask and FAQs

FAQ rich results stopped on 2026-05-07 [doc]. Whitespark's 2026 survey ranks "Presence of FAQs on Service Pages" #60 for local organic
and #43 for AI search, far below "dedicated page for each service" (#1 / #2) [vendor study, expert survey]. FAQs still help readers
and answer engines when they are the questions a buyer of this page asks.

Rules:
- classify each PAA question against the page type and buyer (same reading, other reading, other buyer); use only "same reading";
- a question already answered in a section is not repeated as an FAQ;
- at most 3-5 FAQs on a service, location or pricing page; none on a case study; a glossary uses "related terms" instead;
- an FAQ answer must contain something the body does not (a number, a condition, a next step).

Our brief currently asks for "6-8 follow-up questions - reuse the People Also Ask questions" and turns each into a heading
(`strategy_brief.txt:91`). That is the root of the padding on the techand page.

### 2.3 Local and regulatory facts are researched, not hoped for

A page about a regulated activity in a country (tax, e-invoicing, payroll, licensing, health, finance) must carry the country's
current dates and the official source. For UAE e-invoicing on 2026-10-29: Phase 1 (revenue >= AED 50m) must appoint an Accredited
Service Provider by **30 October 2026** and go live **1 January 2027**; Phase 2 (< AED 50m) by 31 March 2027, live 1 July 2027;
government entities live 1 October 2027 (KPMG summary of the Ministry of Finance announcement, 2026-07-22) [doc, secondary; the
ministerial decision text was not opened]. A page for an ERP partner in Dubai published in late October 2026 without these dates is
missing the single most urgent buying reason its readers have.

Research plan per page (addition to the facts step): for each regulated topic the brief names, search "[topic] [country] deadline",
"[topic] [country] site:[official domains]" (UAE: mof.gov.ae, tax.gov.ae, u.ae), and read the client's own pages on the topic (techand
had a post on the 2027 deadline). Keep the official source first; a consultancy summary only as a second source.

### 2.4 Repetition and padding

The reviewer counted "Microsoft 365 is not an ERP" six times and two different "five questions" lists. A page type's checklist
includes: no proposition stated more than twice (the second time only in a summary or the quick answer), one list per purpose, every
section answers a question this type's reader has. Detection is cheap: sentence pairs with high shingle overlap (`_shingle.js` exists)
or the same subject-verb-object triple; sections whose main nouns are not in the brief's intent are padding candidates.

### 2.5 Meta title and description

Google may use the meta description when it describes the page better than on-page text; there is no length limit, it is truncated to
the device width; it should be unique and descriptive, not a keyword string [doc, 2026-04-20]. So: one or two sentences that say what
the page gives this reader, no claims (never run through the claims rewriter), never shorter than about 70 characters or longer than
about 160 for display. A 20-character "Slug: ..." description is a publish error, not advice.

### 2.6 Schema per type (summary; details in each type)

| Type | Use | Do not use |
|---|---|---|
| All | Organization (site-wide, with `sameAs`), BreadcrumbList, WebPage or Article with author and dates | FAQPage (no SERP feature since 2026-05-07), HowTo (retired), review stars about the business itself (ineligible) [doc] |
| Service | Service (`provider`, `serviceType`, `areaServed`, `offers` only if priced) as description | Product unless it is a product with a price; AggregateRating of the business |
| Service + location, location | LocalBusiness subtype only where there is a real address in that place, one per location with its own `url` [doc, 2026-09-08]; else Service with `areaServed` | LocalBusiness with a virtual or invented address |
| Comparison, listicle, guide, glossary, answer | Article; ItemList for a list (descriptive) ; DefinedTerm for a glossary entry | Review or Product rating on products the client did not review first-hand |
| Pricing | Article; Offer / Product only for the client's actual priced items | `priceRange` invented |
| Case study | Article with `about` the client organisation (if public) | Review markup of the client's own work |

Google: "There's also no special schema.org structured data that you need to add" for AI Overviews or AI Mode; structured data must
match the visible text [doc, 2025-12-10].

### 2.7 Freshness and dates

Google asks: "Are you changing the date of pages to make them seem fresh when the content has not substantially changed?" [doc]. AI
answers lean on recently updated pages: 75% of pages cited by ChatGPT, Gemini and Perplexity for four brands were updated within a
year (Seer, July 2026, 7,683 dated pages, correlational) [vendor study]. Rule: show a visible "Updated" date on guides, comparison,
pricing, listicle and answer pages; change `dateModified` only when facts, prices, dates or sections changed.

---

## 3. Playbook per page type

Each type: (a) SERP signals and mismatch detection, (b) structure, (c) proof and trust, (d) length, (e) schema, (f) internal linking
role, (g) common failures, (h) judge checklist. Checklist items marked **C** are critical: a fail caps the page score (section 4).

---

### 3.1 Service page

Example query: "dynamics 365 business central implementation", "e-invoicing accredited service provider uae".

**(a) SERP signals.** At least 5 of 10 results are provider service or product pages (URL `/services/`, `/solutions/`, title "X
services", "X partner", "X company"), directories (Clutch, G2, partner directories) or homepages of providers; ads usually present;
PAA about cost, time, choosing a provider. **Mismatch:** 5 or more guides, "what is" titles, forums or video, an AI Overview with a
definition, no ads (the "ms 365 erp" pattern). Whitespark's 2026 survey puts "dedicated page for each service" first for local organic
and second for AI search visibility [vendor study, expert survey, 2025-11-06].

**(b) Structure that ranks and converts.**
Above the fold: H1 naming the service and who it is for (and the place, if local); one or two sentences on the outcome; a primary CTA
plus a low-commitment one; two or three verified proof items beside the CTA (partner tier, named clients, a rating from a third-party
site). Whitespark's advice: "Give them the recipe right at the start" [vendor study].
Then, in this order: the problems it solves and for whom; what is included (scope and deliverables); how it works (steps, with
timelines only if the client gave them); proof (one case study summary with a number, client logos the client may show, a named
testimonial); price approach (packages, ranges or what drives the price; NN/g: when exact prices are unrealistic show prices for
typical scenarios [evidence, NN/g 2006, usability study]; buyers who cannot find a price go to competitors [thin, NN/g via
secondary]); what makes this provider different, stated as checkable facts; 3-5 buyer FAQs (cost, timeline, contract, support,
compliance); related services; final CTA.

Real example [example]: Digital Gravity's "Microsoft Dynamics 365 Partner in Dubai" page (ranks for "dynamics 365 business central
partner dubai"): H1 with the city, a quote form above the fold with a budget slider in AED, a logo banner, product sections, process
steps, industries with named clients, four testimonials, FAQs, about 1,600-1,900 words of body. It also shows the failures to avoid:
FAQs on consultant salaries and certification value (another reader's questions), a "Net-suite" line copied from another page,
"Dynamic 365" misspelt, no UAE regulation mentioned.

**(c) Proof and trust.** From the client, required: at least three proof items of different kinds (credential, named client or case
study, a number with a basis), the service scope, the CTA offer as the client states it (a "free consultation" only if the client
says so). General allowed: product capabilities from vendor docs, regulations from official sources. If fewer than three proof items
exist, the page is still writable but the client is asked first (one screen, prefilled, with "leave it general"), and the grade shows
proof as weak.

**(d) Length.** No preferred word count [doc]. Measure the band on the service and product pages in the SERP only; typical 600-1,500
words of body. Do not inherit a guide's band. A service page that needs 2,500 words to be complete is usually two services.

**(e) Schema.** Service (provider = the Organization, `serviceType`, `areaServed`), BreadcrumbList, Organization. No FAQPage, no
self-serving AggregateRating.

**(f) Internal linking.** A money page: it receives links from guides, the hub, case studies and location pages with descriptive
anchors (Google: descriptive, concise anchor text) [doc, link best practices, via secondary]; it links out to its case studies, the
one or two guides that answer pre-purchase questions, and contact. It is the top rung of a commercial ladder.

**(g) Failures.** Written for an informational query; slogans as proof; claims the client never made; sections for adjacent topics
lifted from PAA; the key distinction repeated; FAQ for another audience; two service pages on one search; city or brand typos; a
generic "why choose us" list.

**(h) Checklist (service page).**

| # | Item | Scale |
|---|---|---|
| S1 C | SERP for the main query is service-shaped (section 1.3 rule 3 or 4 passed) | pass / fail |
| S2 C | No other page of the site targets the same search | pass / fail |
| S3 | H1 and first two sentences name the service, the buyer and the outcome | 0-3 |
| S4 | CTA above the fold, matches what the client offers | 0-3 |
| S5 C | Every claim about the client is in the proof ledger | pass / fail |
| S6 | Proof: 3+ verified items of different kinds, one with a number | 0-3 |
| S7 | Scope and deliverables are concrete (named deliverables, not adjectives) | 0-3 |
| S8 | Price approach present (price, range, scenarios or cost drivers) | 0-3 |
| S9 | Local or regulatory facts current and officially sourced where the service depends on them | 0-3 |
| S10 | No padding section; every section answers this buyer | 0-3 |
| S11 | No proposition repeated more than twice; one list per purpose | 0-3 |
| S12 | 3-5 FAQs, buyer questions only, each adds something the body lacks | 0-3 |

---

### 3.2 Service + location page

Example: "dynamics 365 partner dubai", "e-invoicing consultant abu dhabi".

**(a) SERP signals.** City or area in most titles; local pack or map present; provider pages and local directories (the partner
directory pages of erpresearch.com dominate "dynamics 365 business central partner dubai" in the US-run search) [example]. Mismatch:
no local pack and no city in titles means the place word is not doing work; write the plain service page.

**(b) Structure.** As the service page, plus: H1 with service + place; how the service is delivered there (on-site visits, local team,
languages, time zone, response times); local rules and authorities that change the service (UAE: FTA VAT, e-invoicing phases, WPS
payroll for HR systems, free-zone specifics); local proof (clients in that place the client may name, local projects); areas served
within the place; the verified name, address, phone and hours block if there is an office there; a link to the Business Profile.

**(c) Proof and trust.** Required from the client: at least two local facts that no other location page of the site could carry (an
office, a team member based there, named local clients, a local project). Without them the page is the doorway pattern Google names:
"multiple domain names or pages targeted at specific regions or cities that funnel users to one page" and "substantially similar
pages that are closer to search results than a clearly defined, browseable hierarchy" [doc, spam policies, 2026-08-28].

**(d) Length.** 500-1,200 words. Unique local content matters more than length: Whitespark's #2 local organic factor is "geographic
(city/neighbourhood) keyword relevance of content" [vendor study].

**(e) Schema.** LocalBusiness subtype with the real address, `url` of this page, `geo`, hours, one block per location [doc]; if there
is no office there, Service with `areaServed` naming the place. Never an invented or virtual address (a service-area business may not
list a virtual office unless it is staffed [thin, Google help page via secondary]).

**(f) Internal linking.** Linked from the service page ("We work across ...") and from the location page if one exists; links to the
service page, local case studies and contact. It is the landing page of the Business Profile for that place (Whitespark #4 local
organic: keywords in the Business Profile landing page title) [vendor study].

**(g) Failures.** City-name swap of another page; a list of 30 cities; invented local clients or offices; a map embed as the only local
content; local FAQs that are generic with the city inserted.

**(h) Checklist.** S1-S12 of the service page, with S9 required (not optional), plus:

| # | Item | Scale |
|---|---|---|
| L1 C | Two or more local facts unique to this place, verified | pass / fail |
| L2 C | Shingle overlap with every sibling location page under 30% (body, excluding the address block) | pass / fail |
| L3 | Address block present only if there is a real office there; matches the Business Profile | pass / fail |
| L4 | How the service is delivered in this place is explained | 0-3 |

---

### 3.3 Location / area page

For businesses with several physical sites ("/locations/abu-dhabi") or a service-area business with a page per region.

**(a) SERP signals.** "[service] near me", "[brand] [city]", local pack, map results, directory listings (Yelp, local directories).
Brand + city queries are navigational: the page must exist and be correct, competition is low.

**(b) Structure.** Name, address, phone, hours, map, directions and parking at the top; the services offered at this location with
links to their service pages; the people at this location; photos of this location; third-party reviews of this location (linked, not
marked up); local news or events if real; contact form.

**(c) Proof and trust.** Everything is a client fact. The page is accurate or it is harmful. Must match the Business Profile exactly.

**(d) Length.** 200-700 words. This page answers "where, when, who"; it is not an essay.

**(e) Schema.** LocalBusiness subtype per location with address, `geo` (5 decimals), opening hours, telephone with country code, `url`
of this page [doc].

**(f) Internal linking.** From a locations index and the footer; out to the service + location pages for the services offered there.

**(g) Failures.** Pages for places without a site (doorway); hours or phone that differ from the Business Profile; one generic page
cloned per city.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| A1 C | Real site in this place (address verified by the client) | pass / fail |
| A2 C | NAP and hours identical to the Business Profile | pass / fail |
| A3 | Services at this location listed and linked | 0-3 |
| A4 | Location-specific content (people, photos, directions) | 0-3 |
| A5 | LocalBusiness markup valid and matches the visible text | pass / fail |
| A6 | Overlap with sibling location pages under 30% | pass / fail |
| A7 | Clear primary action (call, directions, book) | 0-3 |
| A8 | No invented reviews or ratings | pass / fail |

---

### 3.4 Comparison page ("X vs Y") and alternatives page

Example: "business central vs netsuite", "netsuite alternatives".

**(a) SERP signals.** Titles with "vs", "versus", "compared", "alternatives", "which is better"; review platforms (G2, Capterra); list
pages. The US-run search for "business central vs netsuite" returned only partner and vendor blogs, most selling one side [example].
Mismatch: a "vs" query whose results are vendor product pages (one brand dominates) is navigational; do not write a neutral
comparison against the brand.

**(b) Structure.** Verdict first: two or three lines saying who should choose which. An at-a-glance table with the decision criteria
(price with "as of" date and source, deployment, best for, limits, integration, support in the client's market). One section per
criterion with evidence. "Choose X if ... / choose Y if ..." scenarios. Switching and migration costs. Disclosure of the publisher's
interest. Updated date. For an alternatives page: the selection criteria, then each option with "best for", a strength, a limit and
price, then a decision guide.

Google's review guidance applies directly: evaluate from the user's perspective, show expertise and first-hand evidence, share
quantitative measurements, explain what sets each apart, cover comparable options and which suits which use, discuss benefits and
drawbacks based on original research, focus on the decision factors [doc, 2025-12-10]. The reviews system "aims to better reward high
quality reviews, content that provides insightful analysis and original research" [doc].

Real example [example]: Dynamics Square's "Business Central vs NetSuite" has a nine-row comparison table with Microsoft list prices
"as of Oct 2026" linked to Microsoft, but about 550 words of body, no author or date, no explicit verdict while its conclusion favours
the product it sells, and no disclosure that it sells it.

**(c) Proof and trust.** Required: the publisher's relationship to each product (partner of one, both, neither); first-hand experience
statements only from the client (implementations done, migrations done). Prices and features from official sources with a date.
Never a negative claim about a competitor product without a source.

**(d) Length.** 1,200-2,500 words. The table carries most of the value; length follows the number of criteria that matter.

**(e) Schema.** Article with author and dates; BreadcrumbList. No Review or Product rating markup unless the client did a first-hand
review, and never on its own product.

**(f) Internal linking.** Bottom-of-funnel guide: links to the service page of the product the client sells (with an honest anchor),
to the pricing page, to migration case studies; receives links from the hub and the product guides.

**(g) Failures.** No verdict ("it depends"); undisclosed bias; feature lists copied from vendor sites; prices without date or source;
comparing on criteria where one product obviously wins only because the publisher chose them.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| X1 C | SERP is comparison-shaped | pass / fail |
| X2 | Verdict in the first 100 words, per buyer situation | 0-3 |
| X3 | Comparison table with 6+ decision criteria | 0-3 |
| X4 C | Every price and limit sourced and dated | pass / fail |
| X5 C | Publisher's interest disclosed | pass / fail |
| X6 | First-hand experience present (client facts) | 0-3 |
| X7 | Both options' drawbacks stated fairly | 0-3 |
| X8 | Scenarios "choose X if / Y if" concrete | 0-3 |
| X9 | Migration or switching section | 0-3 |
| X10 | Visible updated date | pass / fail |

---

### 3.5 Pricing / cost page

Example: "erp implementation cost uae", "business central price aed".

**(a) SERP signals.** "cost", "price", "pricing", "how much" in titles; vendor pricing pages; calculators. If the vendor's own pricing
page holds the top spots, a partner wins with what the vendor does not say: implementation, local currency, total cost.

**(b) Structure.** A direct range or starting price in the first 100 words, with what it covers. A table of cost components (licences,
implementation, data migration, training, support, add-ons). Two or three worked scenarios with line items that add up (NN/g: prices
for common scenarios beat complex calculators for shortlisting) [evidence]. What makes it cost more or less. Hidden or recurring costs.
How to get an exact quote (CTA). Updated date and currency.

Real example [example]: MRPeasy's "ERP Implementation Cost" guide (Dec 2025, named author and reviewer, about 2,500 words) has two
worked scenarios whose line items add up, but the first figure appears well down the page, most rules of thumb are unsourced, and one
scenario contradicts its own stated hardware share. A grader that checks arithmetic and sources would catch all three.

**(c) Proof and trust.** The client's own prices or ranges are client facts and the page's reason to exist; licence prices from the
vendor's official page with the date; market ranges only from a named study. If the client will not publish any number, write a
"cost drivers" guide, label it as such, and do not promise a price in the title.

**(d) Length.** 1,000-2,500 words.

**(e) Schema.** Article; Product with Offer only for items the client actually sells at a stated price.

**(f) Internal linking.** Linked from every service page's price section and from comparison pages; links to the service pages and the
quote form.

**(g) Failures.** No number; unsourced rules of thumb; old licence prices; USD on a UAE page; scenarios that do not add up; a title
that promises prices the page withholds.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| P1 C | A number (price, range or starting point) in the first 100 words, or the title says "cost drivers" | pass / fail |
| P2 C | Client prices are client facts; market figures sourced and dated | pass / fail |
| P3 | Component table | 0-3 |
| P4 | 2+ worked scenarios | 0-3 |
| P5 C | Arithmetic in scenarios and tables is correct | pass / fail |
| P6 | Local currency and tax treatment (VAT) stated | 0-3 |
| P7 | Cost drivers explained | 0-3 |
| P8 | Recurring and hidden costs covered | 0-3 |
| P9 | Visible updated date | pass / fail |

---

### 3.6 Pillar / hub page

Example: "erp in the uae", "e-invoicing uae".

**(a) SERP signals.** A broad head term with mixed intent: guides, government pages, vendor pages, news; many distinct PAA questions;
results with tables of contents. Mismatch: if the head term's SERP is service-shaped, the hub is the service page, and guides hang
under it.

**(b) Structure.** Definition and why it matters to this reader in the first paragraph; a decision framework (what to do, in what
order); one section per cluster page summarising it (120-250 words) and linking to it; a table of contents; a "guides in this series"
block (already built for hubs, `Brief_Context.js:146`) [ours]; a commercial section linking to the relevant service page.

**(c) Proof and trust.** Mostly general, sourced (official first). One or two client experience notes make it ours.

**(d) Length.** 2,000-4,000 words, driven by the number of clusters; each section is a summary, not the cluster page again.

**(e) Schema.** Article or CollectionPage, BreadcrumbList; ItemList of the cluster pages is descriptive only.

**(f) Internal linking.** The centre: links down to every live cluster page and to the service pages; every cluster page links back
up. This is the "clearly defined, browseable hierarchy" Google contrasts with doorways [doc].

**(g) Failures.** Hub written before any cluster exists (it becomes a long guide that cannibalises the future pages); sections that
duplicate cluster pages; links to unpublished pages; a hub on a head term the site has no chance on.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| H1 C | At least 3 live cluster pages exist | pass / fail |
| H2 | Definition and framework in the first screen | 0-3 |
| H3 | Every cluster page linked once with a descriptive anchor | 0-3 |
| H4 | Sections summarise without duplicating cluster pages (overlap < 30%) | pass / fail |
| H5 | Official sources for regulatory facts, dated | 0-3 |
| H6 | Commercial path to the service page | 0-3 |
| H7 | Table of contents and updated date | pass / fail |
| H8 | No section for a topic the business does not serve | 0-3 |

---

### 3.7 Blog guide / how-to

Example: "how to choose an erp partner in uae", "is microsoft dynamics 365 an erp".

**(a) SERP signals.** "how to", "what is", "why", "guide", "checklist" titles; `/blog/`, `/insights/`, `/resources/` URLs; PAA; AI
Overview; video. This is what "ms 365 erp" showed.

**(b) Structure.** Answer first: a 40-60 word direct answer under the H1 (passage ranking identifies relevant passages [doc]; Ahrefs
found no correlation between word count and AI Overview citation, 53.4% of cited pages under 1,000 words [evidence, see R2 3.2]);
then the steps or the explanation, examples, a section of first-hand experience (client facts), sources, and a soft next step to the
service page. Author byline with credentials (Google: "Do pages carry a byline, where one might be expected?") [doc].

**(c) Proof and trust.** General facts sourced, official first for anything regulatory; one or two client experience notes when the
client has them. The GEO study found citing sources, quotations and statistics raised visibility in generative answers by 30-40%
[evidence, see R2 3.4].

**(d) Length.** The band of the guides that rank for the query. Do not pad to a number.

**(e) Schema.** Article (author, `datePublished`, `dateModified`), BreadcrumbList. No HowTo.

**(f) Internal linking.** Feeds the service page and the hub; receives links from related guides; one clear link to the service the
reader will need next.

**(g) Failures.** Long introductions; summarising other pages (Google's "mainly summarizing what others have to say"); stale
statistics; a sales pitch inside every section; a generic FAQ block; missing the local regulatory date.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| G1 C | SERP is guide-shaped | pass / fail |
| G2 | Direct answer in the first 60 words | 0-3 |
| G3 | Covers the questions of the dominant reading; nothing from other readings | 0-3 |
| G4 C | Regulatory and market facts current and sourced (official first) | pass / fail |
| G5 | Something original: client experience, example, data, decision rule | 0-3 |
| G6 | Source quality: no more than one vendor or agency blog, none for compliance figures | 0-3 |
| G7 | No repetition; one list per purpose | 0-3 |
| G8 | Byline with credentials and updated date | pass / fail |
| G9 | One clear next step to the relevant service page | 0-3 |
| G10 C | No other page of the site answers the same search | pass / fail |

---

### 3.8 Listicle / "best X"

Example: "best erp software for small business uae", "top dynamics 365 partners in dubai".

**(a) SERP signals.** "best", "top N", "list of" titles; review platforms; directories. Ahrefs (Dec 2025, 750 ChatGPT prompts):
"best X" blog lists were 43.8% of all page types in the sources, and 169 of 250 "best X software" Google SERPs (67.6%) featured a list
where the publisher ranked itself first [vendor study]. Whitespark ranks "presence on expert curated best-of lists" the #1 factor for
AI search visibility of local businesses [vendor study, expert survey].

**(b) Structure.** Criteria and method first (how options were chosen, what was tested or used). A summary table (option, best for,
price as of date). One block per option: best for, strengths, limits, price, evidence of first-hand use. How to choose. Disclosure of
the publisher's interest.

Google: when recommending something as best, explain why with first-hand evidence; ranked lists must have enough content to stand on
their own [doc, 2025-12-10].

**(c) Proof and trust.** First-hand use is a client fact (we implemented X for N clients); competitor facts from their official pages.
**Self-ranking:** Peec (Dec 2025-Feb 2026, 232,000 citations, 6 AI platforms) found about 11% of listicle citations came from
self-promotional lists (3.6% on ChatGPT, about 10% on AI Mode and Perplexity) and still advised against the tactic for reputational
and algorithmic risk [vendor study]. Ahrefs' own policy after its study: publish few such lists, do not always rank yourself first,
link to alternatives [vendor study]. Our rule: a client may appear in its own list only with disclosure and the same criteria applied
to everyone; "top N partners in [city]" pages naming competitors need sourced facts about each and the owner's approval.

**(d) Length.** 1,500-3,500 words, about 150-300 per option.

**(e) Schema.** Article; ItemList descriptive. No ratings markup on options the client did not review first-hand.

**(f) Internal linking.** Links to the client's service or product page from its own entry; receives links from the hub.

**(g) Failures.** Thin entries rewritten from vendor sites; "we tested" with no test; the client first with no criteria; outdated
prices; competitors described with unsourced weaknesses.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| B1 C | SERP is list-shaped | pass / fail |
| B2 | Method and criteria stated before the list | 0-3 |
| B3 C | Publisher's interest disclosed; same criteria for the client's own entry | pass / fail |
| B4 | Each entry: best for, strength, limit, price with date | 0-3 |
| B5 C | No unsourced claim about a competitor | pass / fail |
| B6 | First-hand evidence for the recommendations | 0-3 |
| B7 | Summary table | pass / fail |
| B8 | How-to-choose section | 0-3 |
| B9 | Updated date visible | pass / fail |

---

### 3.9 Case study

**(a) SERP signals.** Few searches target a case study directly ("[service] case study [industry]", the client's name). Its job is
proof for service pages, conversion, and citations: AI answers about "who implements X in Y" cite pages with named outcomes. No
mismatch test needed; a value test is: does a service page need this proof?

**(b) Structure.** Title = client (or anonymised description) + headline result + service. At-a-glance box (client, industry,
location, service, products, timeline). Challenge; why they chose the business; what was done (steps, timeline); results with numbers,
before and after, with how they were measured; the client's words, verbatim, with name and role; lessons for similar businesses; CTA.
This is what our case study block already asks for (`Brief_Context.js:147`) [ours].

Counter-example [example]: Dynamics Square's NAV 2013 to Business Central case study: an anonymous "US manufacturer", challenges and
benefits as bullet lists, no number, no quote, no timeline, no date, about 400 words. It proves nothing a reader can check.

**(c) Proof and trust.** All client facts, with permission to name. Results with a basis (measured how, over what period). The FTC rule
on fake testimonials and the substantiation doctrine apply to every number and quote [evidence, see R2 3.6].

**(d) Length.** 700-1,500 words.

**(e) Schema.** Article; Organization of the client in `about` or `mentions` when public. No Review markup.

**(f) Internal linking.** Linked from the service page's proof block, the relevant location page and comparison page; links to the
service page and to one related case study.

**(g) Failures.** Anonymous with no numbers; invented or rounded-up results; a features list instead of a story; no date.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| CS1 C | Every fact comes from the case facts the client supplied | pass / fail |
| CS2 | At least one quantified result with a measurement basis | 0-3 |
| CS3 | Before and after stated | 0-3 |
| CS4 | Verbatim quote with name and role (or none) | 0-3 |
| CS5 | At-a-glance box complete | 0-3 |
| CS6 | What was done is specific (steps, timeline, products) | 0-3 |
| CS7 | Transferable lessons for similar readers | 0-3 |
| CS8 | Linked from the matching service page | pass / fail |

---

### 3.10 Glossary / definition page

Example: "what is a cloud erp", "what is an accredited service provider (e-invoicing)".

**(a) SERP signals.** "what is", "meaning", "definition" titles; Wikipedia, vendor glossaries, encyclopedias; nearly always an AI
Overview. Organic clicks are scarce: 0.61% organic CTR for informational queries with an AI Overview in Sept 2025 [vendor study]. A
glossary page's value is the AI citation, the entity coverage of the site and the internal link it sends to a service page, not its
own traffic.

**(b) Structure.** One-sentence definition first (under about 30 words, naming the category and what it does); then how it works, types,
one concrete example, how it applies in the client's market, related terms (linked), and one paragraph that connects it to the
client's service with a link.

Real example [example]: Zone & Co's ERP glossary entry: a one-sentence definition opening, about 180 words of body, related-term
cards and links to its product; no author or date.

**(c) Proof and trust.** General, sourced; one local or practical note from the client is the difference from every other glossary.

**(d) Length.** 300-1,200 words.

**(e) Schema.** Article, optionally DefinedTerm in a DefinedTermSet; BreadcrumbList.

**(f) Internal linking.** Glossary index to entry, entry to related entries and to one service or guide page; guides link the term on
first use.

**(g) Failures.** Long preambles before the definition; hundreds of thin entries generated at once (scaled content abuse: "using
generative AI tools ... to generate many pages without adding value") [doc]; terms outside the client's expertise.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| D1 | Definition in the first sentence, under 30 words | pass / fail |
| D2 | Accurate, sourced for any figure or standard | 0-3 |
| D3 | Example that a buyer in this market recognises | 0-3 |
| D4 | Related terms linked | 0-3 |
| D5 | One link to the relevant service or guide | pass / fail |
| D6 C | Term is within the client's expertise and services | pass / fail |
| D7 | No padding; length within 300-1,200 | 0-3 |
| D8 | Local or practical note from the client | 0-3 |

---

### 3.11 FAQ / answer page for AI search

Alaventra's AI answer pages (`ai_target`, written by the Content Cadence) [ours].

**(a) Signals.** The question appears in the client's AI question panel or People Also Ask; AI answers cite specific pages and do not
name the client; the question has its own demand. A question without its own demand belongs as a section of a service or guide page.

**(b) Structure.** The question as the H1 (or a question H2 on a broader page); a direct answer in the first 40-60 words with named
entities, a number and the source; then the reasoning, a comparison table where options exist, conditions and exceptions, sources,
and a visible updated date. Google: no special requirements or schema for AI Overviews and AI Mode [doc]. GEO study: sources, quotes
and statistics raise generative-answer visibility 30-40% [evidence]. Recency matters to AI citations (Seer: 75% updated within a year)
[vendor study].

**(c) Proof and trust.** General facts sourced; the client named in the answer only where a client fact supports it (the answer is
"who does X in Y" only when the client has proof it does).

**(d) Length.** 400-1,200 words. One question per page.

**(e) Schema.** Article with dates and author. FAQPage gives no Google feature since 2026-05-07 [doc]; skip it.

**(f) Internal linking.** Linked from the related guide or service page; links to the service page and to the source.

**(g) Failures.** A page of 30 thin Q&As; answers that restate the question; self-promotional answers with no support; stale date.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| Q1 C | The question has its own demand (panel, PAA or volume), else it is a section | pass / fail |
| Q2 | Direct answer in the first 60 words, with a number or named entity | 0-3 |
| Q3 C | Facts sourced; client named only with proof | pass / fail |
| Q4 | Conditions and exceptions covered | 0-3 |
| Q5 | Table where options exist | 0-3 |
| Q6 | Updated date and author visible | pass / fail |
| Q7 | No repetition of the answer in later sections | 0-3 |
| Q8 | Link to the relevant service page | pass / fail |

---

### 3.12 Landing page (campaign)

**(a) SERP signals.** Landing pages are built for paid, e-mail or campaign traffic; they rarely rank. If the target query is organic,
build the service page instead. A landing page with the same content and keyword as a service page splits signals; mark it `noindex`
or canonical to the service page.

**(b) Structure.** One offer, one primary CTA, message match with the ad or e-mail, proof next to the CTA, minimal navigation, a
short form. Unbounce's 2024 benchmark (41,000 pages) puts the median conversion rate at 6.6%; a summary reports pages written at a
5th-7th grade reading level converting at 11.1% vs 5.3% at college level [thin: gated, read through MarketingProfs].

**(c) Proof and trust.** All client facts; the offer must be the client's real offer (terms, deadline).

**(d) Length.** 300-1,000 words.

**(e) Schema.** Organization, WebPage; nothing else.

**(f) Internal linking.** None needed; links back to the service page for readers who want more.

**(g) Failures.** Indexed duplicate of a service page; several competing CTAs; an offer the client never made.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| LP1 C | Indexing decided (noindex or canonical if it duplicates a service page) | pass / fail |
| LP2 C | Offer and terms are client facts | pass / fail |
| LP3 | One primary CTA, visible above the fold | 0-3 |
| LP4 | Headline matches the campaign message | 0-3 |
| LP5 | Proof next to the CTA | 0-3 |
| LP6 | Plain language (short sentences, everyday words) | 0-3 |
| LP7 | Form asks only what the next step needs | 0-3 |
| LP8 | No navigation leaks that compete with the CTA | 0-3 |

---

### 3.13 Page refresh (update of an existing page)

**(a) Signals.** Section 1.4. Plus decay: the page lost clicks year on year without a seasonal reason (our Poisson decay test) [ours];
striking distance (positions 4-20 with impressions); a regulation or price on the page changed; the SERP's type changed (rewrite the
type, keep the URL).

**(b) Structure.** Start from the live page, not a blank brief. Keep the URL, the H1 topic and the sections that earn queries in Search
Console (query -> page rows). Then: fix intent alignment (answer first, remove off-intent sections), update facts, prices and
regulatory dates with sources, add the proof the page lacks, fold in the content of weaker overlapping pages (and 301 them), improve
internal links. Workshop Digital's best refreshes were "more focused and easier to skim, not necessarily longer" [vendor study].

**(c) Proof and trust.** As the page's type, plus: every change is listed in a change summary the client sees.

**(d) Length.** Whatever the page's type needs; a refresh is often shorter.

**(e) Schema.** Unchanged type; `dateModified` updated only with a substantive change [doc].

**(f) Internal linking.** Keep every inbound link target; add links from newer pages.

**(g) Failures.** Changing the date only; a full rewrite that drops the passages that ranked; a new URL; deleting content that earns
queries; producing a second page instead of updating the first.

**(h) Checklist.**

| # | Item | Scale |
|---|---|---|
| R1 C | Same URL; no new page created | pass / fail |
| R2 C | Sections earning Search Console queries kept or improved | pass / fail |
| R3 | Off-intent sections removed | 0-3 |
| R4 | Facts, prices and regulatory dates updated with sources | 0-3 |
| R5 | Proof added where the page lacked it | 0-3 |
| R6 | Overlapping pages merged or linked, never duplicated | 0-3 |
| R7 | `dateModified` changed only with a substantive change | pass / fail |
| R8 | Change summary produced for the client | pass / fail |
| R9 | The type's own checklist passes | pass / fail |

---

## 4. The judge: how an LLM applies these checklists so a weak page cannot score 100

### 4.1 Score

1. **Universal block (every page).**

| # | Item | Scale |
|---|---|---|
| U1 C | Page type matches the SERP (section 1.3) | pass / fail |
| U2 C | No other page of the site targets the same search (section 1.4) | pass / fail |
| U3 C | No unsupported claim about the client (proof ledger) | pass / fail |
| U4 C | Publish errors: meta description 70-160 characters and about the page, title present, no spliced or broken sentence, no placeholder, no broken link | pass / fail |
| U5 | Source quality: official first, at most one vendor or agency blog, none for regulatory figures | 0-3 |
| U6 | Repetition: no proposition more than twice, one list per purpose | 0-3 |
| U7 | Padding: every section answers this page's reader | 0-3 |
| U8 | Spelling and terms follow the client's style guide (locale default when none is set, and flagged as such) | 0-3 |

2. **Type block** (section 3).
3. **Score** = points earned / points possible x 100 over the 0-3 items of both blocks.
4. **Caps:** any failed critical item caps the score at 50 and the status at "not ready"; U4 failed caps at 60 (fixable without the
   client); a type-block critical failure that only the client can resolve (proof, local facts) caps at 70 and status "needs your
   facts".
5. **The judge must quote evidence** for every 0 or 1 (the sentence, the heading or the missing element), so the grade is checkable.

### 4.2 Calibration on the techand page

Applied by hand from the trace and the reviewer's notes: U1 fail (explainer SERP), U2 fail (an existing page for the same search, the
page run's own blocker), U3 fail ("free consultation" and sector claims), U4 fail (20-character meta, spliced sentence), U5 1 (two
weak secondary sources kept after the Critic flagged them, no Ministry of Finance link), U6 0 (six repetitions, two different lists),
U7 1 (three PAA sections from another reading), service S6 1 (two proof items, both credentials). Four critical failures: capped at
50, status not ready, with four specific reasons the client would have agreed with. The reviewer gave 63; the Critic's first score was
66 [ours]; our grade said 100. The rubric lands where the humans did.

### 4.3 Calibration set

Before the rubric gates anything, label 30-50 pages (ours from production plus the real examples above) by two people with the same
checklist, measure agreement per item, and keep only items where the LLM judge agrees with the humans at least 85% of the time; the
rest stay advisory. This follows the accuracy-set practice already used for keyword fit and promises (`LIVE_RUN_2026-10-21.md` §7c)
[ours].

---

## 5. What this means for Alaventra (no code changed; where each change would go)

Ranked by how many of the techand failures each one would have prevented, then by reach across clients.

1. **Make the page type a decision.** Extend `KWI.serpPageTypes` (`_kw_inputs.js:251-300`) with the shapes of section 1.2 and a
   confidence; in `Ladder_Plan.js:282-293` and `Cadence_Plan.js` (ladder rungs default `Service Page`, line 360) choose the type from
   the SERP instead of writing a note; in the verdict, `recommended_page` must replace `page_type` when they differ, or the run asks
   the client (today the brief only mentions it, `strategy_brief.txt:6`). Prevents: wrong type (U1).
2. **Update-before-new as a hard stop.** The existing-page detection (`_verdict_existing.js`, Own Coverage) found the conflict and it
   became a blocker that finalize dropped. Turn a match into a refresh run of that URL (section 3.13) or a merge proposal; never a
   new page. Prevents: U2, cannibalisation.
3. **Value gate before writing.** Verdict under 50 or volume under 20 with no impressions: ask, with the cheaper options (section 1.3
   rule 1). Already requested by the owner.
4. **Add the missing types.** `_page_type.js` knows 8 types and maps "comparison", "FAQ", "glossary", "listicle" to `Guide`
   (`_page_type.js:10-14`). Add Comparison Page, Pricing Page, Listicle, Glossary, Answer Page, Location Page and Refresh as real
   types, with the form, the app schemas (`shared/src/schemas.ts`), the brief blocks and Content_QA's schema choice.
5. **Per-type brief and writer blocks.** `Brief_Context.js:146-155` has blocks for hub, case study and local only. Add one per type
   from section 3 (b), and length bands measured on same-type SERP pages only.
6. **Intent-filtered PAA and FAQ.** Replace "6-8 follow-up questions - reuse the People Also Ask questions" (`strategy_brief.txt:91`)
   with section 2.2. Prevents the three padding sections on the techand page.
7. **Proof ledger with a slogan filter**, used by the brief, the client questions and the prefilled answers (section 2.1).
8. **Regulatory research step** for regulated topics, official sources first (section 2.3), plus reading the client's own pages on the
   topic.
9. **Judge with critical caps** (section 4) in Content_QA and in Finalize, fed by the Critic; the Critic's score already tracked the
   humans (66 vs 63).
10. **Doorway guard** for location pages: sibling overlap under 30% and two verified local facts (section 3.2 L1-L2) before writing.
11. **Refresh mode that preserves ranking sections** (section 3.13 R2), reading Search Console query -> page rows.

---

## 6. Open questions for the owner

1. Self-ranked listicles: allow a client in its own "best X" list (with disclosure and equal criteria), or never?
2. "Top partners in [city]" pages name competitors: allowed at all, and with what approval?
3. Thresholds: is "5 of 10 results" the right bar for a clear SERP, and "verdict under 50" the right value gate, before the calibration
   set (section 4.3) gives measured ones?
4. Service-area businesses in the UAE with no office in a city: write service + location pages only with two local facts, or not at
   all?
5. Which new types to expose in the app form first (comparison and pricing look the most valuable for B2B clients)?

---

## 7. Sources (opened 2026-10-29 unless noted)

Google
- Spam policies (doorway abuse, scaled content abuse, site reputation abuse), updated 2026-08-28 [doc]: https://developers.google.com/search/docs/essentials/spam-policies
- Creating helpful, reliable, people-first content, updated 2026-10-05 [doc]: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Write high quality reviews, updated 2025-12-10 [doc]: https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews
- A guide to Google Search ranking systems (reviews, passage ranking, site diversity), updated 2025-12-10 [doc]: https://developers.google.com/search/docs/appearance/ranking-systems-guide
- AI features and your website, updated 2025-12-10 [doc]: https://developers.google.com/search/docs/appearance/ai-features
- Structured data search gallery (25 features, no FAQ or HowTo), updated 2026-10-16 [doc]: https://developers.google.com/search/docs/appearance/structured-data/search-gallery
- FAQ rich result deprecation 2026-05-08 and removal 2026-06-15, read from the Search Central documentation changelog reached through the FAQ page [doc]: https://developers.google.com/search/docs/appearance/structured-data/faqpage
- Review snippet (self-serving reviews ineligible), updated 2026-09-08 [doc]: https://developers.google.com/search/docs/appearance/structured-data/review-snippet
- Local business structured data, updated 2026-09-08 [doc]: https://developers.google.com/search/docs/appearance/structured-data/local-business
- Snippets and meta descriptions, updated 2026-04-20 [doc]: https://developers.google.com/search/docs/appearance/snippet
- Consolidate duplicate URLs, updated 2026-07-10 [doc]: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Business Profile: how Google determines local ranking (relevance, distance, prominence) [doc]: https://support.google.com/business/answer/7091
- Simplifying the search results page (June 2025, seven types phased out; HowTo retired 2023) [doc, via search results and Search Engine Land]: https://developers.google.com/search/blog/2025/06/simplifying-search-results
- Search quality rater guidelines, query interpretations (dominant, common, minor) [thin: secondary summaries; PDF not parsed]: https://static.googleusercontent.com/media/guidelines.raterhub.com/en//searchqualityevaluatorguidelines.pdf
- Link best practices (descriptive anchors) [doc, via secondary summaries]: https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Service-area business and virtual office rule [thin, via secondary]: https://support.google.com/business/answer/3038177

Studies
- Ahrefs, How long does it take to rank in Google (Patrick Stox, 2025-05-15) [evidence]: https://ahrefs.com/blog/how-long-does-it-take-to-rank/
- Ahrefs, Do self-promotional "best" lists boost ChatGPT visibility (Glen Allsopp, 2025-12-04) [vendor study]: https://ahrefs.com/blog/best-lists-research/
- Ahrefs, Search intent and the 3 Cs (updated 2024-10-11) [doc]: https://ahrefs.com/blog/search-intent/
- Peec AI, Self-promotional listicles, 232k citations (Dec 2025-Feb 2026) [vendor study]: https://peec.ai/blog/self-promotional-listicles-analysis-from-232k-citations
- Seer Interactive, AI Overview impact on CTR, Sept 2025 update (published 2025-11-04) [vendor study]: https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-september-2025-update
- Seer Interactive, Content recency and AI visibility (2026-07-24) [vendor study]: https://www.seerinteractive.com/insights/study-content-recencys-impact-on-ai-visibility-in-2026
- Workshop Digital, 273 content refreshes (2026-05-18) [vendor study]: https://www.workshopdigital.com/blog/content-refresh-analysis/
- Whitespark, 2026 Local Search Ranking Factors (2025-11-06) [vendor study, expert survey]: https://whitespark.ca/local-search-ranking-factors
- Nielsen Norman Group, Show prices for common scenarios (Jakob Nielsen, 2006) [evidence, old]: https://www.nngroup.com/articles/show-prices-for-common-scenarios/
- Unbounce 2024 conversion benchmark, via MarketingProfs [thin]: https://www.marketingprofs.com/charts/2024/52374/landing-page-conversion-benchmarks
- KPMG, UAE phased implementation of e-invoicing (2026-07-22) [doc, secondary to the Ministry of Finance]: https://kpmg.com/us/en/taxnewsflash/news/2026/07/tnf-uae-phased-implementation-of-e-invoicing-beginning-january-1-2027.html

Real pages described [example]
- Digital Gravity, Dynamics 365 partner in Dubai (service + location): https://www.digitalgravity.ae/services/microsoft-dynamics-365-partner-in-dubai-uae/
- Dynamics Square, Business Central vs NetSuite (comparison): https://dynamicssquare.com/blog/business-central-vs-netsuite
- MRPeasy, ERP implementation cost (cost page): https://www.mrpeasy.com/blog/erp-implementation-cost/
- Zone & Co, ERP glossary entry (definition): https://zoneandco.com/glossary/erp
- Dynamics Square, NAV 2013 to Business Central case study (weak case study): https://www.dynamicssquare.com/case-studies/nav13-business-central-upgrade/
- Not reachable on 2026-10-29: sap.com "What is ERP" (403), capterra.com best ERP list (403), a Microsoft customer story (404).

Ours
- Production SERP and verdict for "ms 365 erp" (execution 3299, DataForSEO UAE, 2026-10-28), read from the saved execution.
- `v5/code/_page_type.js`, `_kw_inputs.js` (`serpPageTypes`), `Ladder_Plan.js`, `Cadence_Plan.js`, `Brief_Context.js`,
  `Content_QA.js` (schema), `v5/prompts/strategy_brief.txt`, `verdict.txt`, `critic.txt`.
- `docs/content-quality-2026-10-27/R1_PIPELINE_ANALYSIS.md`, `R2_MARKET_RESEARCH.md`.
