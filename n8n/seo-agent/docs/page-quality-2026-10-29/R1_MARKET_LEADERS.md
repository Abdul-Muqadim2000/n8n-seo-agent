# R1 - Market leaders: how the best produce pages that rank and that expert reviewers rate highly

Date: 2026-10-29. Author: research agent, page-quality programme. Input to the enterprise plan for page quality.

Scope: what the leading AI content products and the best content/SEO agencies do, as of October 2026, to produce **pages that rank and
that expert human reviewers and other LLMs rate highly**, for every page type we write (service, location, comparison, hub, case study,
pricing, AI answer, blog guide, refresh), not only blogs.

This file **extends** `docs/content-quality-2026-10-27/R2_MARKET_RESEARCH.md`. R2 already covered: company-facts knowledge bases
(Surfer Brand Knowledge, Jasper IQ, Writer Knowledge Graph, Conductor Knowledge Sources, AirOps Brand Kit, Profound), that every SEO
score in the market is advisory, Writer's claim detection, AirOps / Profound human review nodes, SME-interview tools (Hello Gordon,
dbrief), Google's AI-content and helpful-content guidance, word count and content-score correlation studies, the GEO paper, liability
cases (Air Canada, FTC), and client-input UX. None of that is repeated here except where a new source changes it.

New here: **service and commercial pages**, **proof and E-E-A-T capture**, **how leaders pick what to write first**, **repetition and
padding**, **pre-publish evaluation with human and LLM judges (and how reliable LLM judges really are)**, **refresh**, **time-to-rank
promises**, and **where bulk AI writers failed**. It ends with a ranked "copy this" list and a "do not copy" list.

Labels: **[doc]** vendor or Google documentation, opened; **[vendor claim]** marketing numbers or self-run studies; **[evidence]**
primary or independent source (Google statement of fact, peer-reviewed paper, dataset study with method, regulator, reputable press);
**[survey]** self-reported survey with published sample; **[thin]** little public, secondary only, or method not shown. "Seen in search
results" means the source was located but its page was not opened; treat as weaker.

---

## 0. The answer in one page

1. **The leaders do not have a better writer; they have better gates around the writer.** Every serious 2026 pipeline (AirOps,
   Contently AI Studio, Search Atlas SCHOLAR, Semrush editorial, Frase) scores a draft on **intent match, information gain,
   first-hand proof, named sources, brand rules and factual claims**, then routes the flagged items to a human or a targeted fix.
   Our grade measures structure, coverage, readability and length; it does not measure the five things the techand.ai reviewer marked
   us down on. That is why we said 100 and the reviewer said 63. [doc]
2. **LLM judges are useful only when narrow, evidence-anchored and calibrated.** A 2025 study with professional copy-editors found
   frontier LLM judges agreed with humans on "is this slop" at roughly chance (kappa near 0), flagging 3-8% of texts where humans
   flagged 34% [evidence]. Our own Critic scored the first draft 66, close to the client's 63; the failure was that it gated nothing.
   Use the judge as one input with a rubric of single criteria, a different model family from the writer, and a calibration set of
   human-rated pages; never as the sole gate.
3. **The first decision is whether the page should exist, and in which format.** Ahrefs' "three Cs" (the SERP decides content type,
   format and angle), business potential first, MarketMuse "personalized difficulty", AirOps' refresh-before-create scoring and Ahrefs'
   2025 finding that only 1.74-6.11% of new pages reach the top 10 within a year all point the same way: **do not write a service page
   for a keyword whose results page shows explainers, and do not write a page for a weak keyword without asking**. Refresh or extend the
   page that already exists. [doc + evidence]
4. **Service pages win on a different recipe than blogs.** In the largest expert survey of local ranking factors (Whitespark, Nov 2025)
   "Dedicated page for each service" is the #1 local organic factor and #2 for AI search, while "massive pages of content are no longer
   the way" [survey]. Buyers want price, proof and process; 61% of B2B buyers prefer a rep-free purchase and 69% find the vendor's
   website contradicts the sales team [survey, seen in search results]. A service page is short, specific, provable and consistent with
   the rest of the site.
5. **Proof is the scarce input and it must be verifiable.** Orbit Media's 2026 survey of 1,042 marketers: strong results at an all-time
   low of 13.9%; formal human editing about doubles the odds; original research +50%; working with experts 2.6x; using AI to edit is the
   weakest group [survey]. Google asks "who, how, why" [doc, updated 2026-10-05]. A homepage slogan is not proof; a partner listing URL,
   a named client with permission, a dated number, a named person with a role, a process detail or a price range is.
6. **Every bulk AI writer failure had the same anatomy**: volume without demand or intent, no first-hand information, invented people or
   facts, cloned topic lists, no review. Causal lost an estimated 99.52% of organic traffic after a manual action [evidence, secondary];
   CNET corrected 41 of 77 AI stories [evidence, press]; 1,446 of ~79,000 ad-network sites were deindexed in March 2024, and 86% of a
   175-site sample likely published AI content [vendor study]. Google says the March 2024 work cut low-quality unoriginal results by 45%
   [doc].
7. **Nobody honest promises time to rank.** Google: "No one can guarantee a #1 ranking" [doc, 2026-06-05]. Ahrefs: of the pages that
   reached the top 10, 40.82% did so within a month, and after about six months the odds are "pretty low" without changes [evidence].
   Promise speed of execution and a measured forecast band, never a position.

---

## 1. What the techand.ai case tells us to research

The trigger (2026-10-28) is summarised in the task brief; no client page text is reproduced here. The eight root causes map to eight
market questions:

| # | Our failure (production execs 3299 / 3336) | Market question answered in |
|---|---|---|
| 1 | Claim check ran on the meta description; meta reader crossed a newline (20-char meta) | 6.1 (metadata is QA'd separately, deterministically) |
| 2 | That meta sentence became a client question and was placed in the body | 4.4, 6.1 (ask only about body claims, each tied to a section) |
| 3 | Finalize dropped the page run's blocker (existing page for the same search) and graded 100 | 6.1, 6.4 (the gate state travels with the document) |
| 4 | Our grade ignores repetition, intent fit, proof, source quality, publish errors | 5, 6 (what the leaders score) |
| 5 | Verdict scored the keyword 42/100 ("poor use of effort") and the page was written anyway | 2 (what to write first, and when to ask) |
| 6 | Answers appended as fragments; a homepage slogan offered as proof | 4 (proof capture and placement) |
| 7 | Facts research searched only the generic SERP; local regulatory dates missed | 4.5, 6.2 (regulatory and freshness research) |
| 8 | No Word / HTML / PDF downloads on the final version | 6.1 (delivery is part of the product) |

The reviewer's own rubric (usefulness 25, fit with what ranks 20, proof and trust 15, local accuracy 15, structure 15, ready to publish
10) is close to what the leaders' rubrics measure (section 6.3). That is useful: we can adopt a rubric that a real expert already used
on our output, and calibrate against their score.

---

## 2. Picking what to write first, and whether to write it at all

### 2.1 What the leaders do

- **Ahrefs, "three Cs" and business potential** [doc, 2022, still the reference]. Look at the SERP for **content type** (blog post,
  landing page, product page), **format** (list, how-to) and **angle** before writing; "search-focused" content matches the dominant
  intent. Prioritise by **business potential** ("how easy it will be to pitch your product while covering a given keyword"), with traffic
  potential and ranking potential alongside. "If the SERP requires a capability you lack... you're unlikely to compete for that
  keyword." <https://ahrefs.com/blog/seo-content-strategy/>
- **Ahrefs AI Content Helper** (help article 2026-09-03) [doc] makes the intent choice explicit in the editor: you "choose a search
  intent to benchmark against", useful "for SERPs with multiple intents", and the score is topic coverage; "Adding related terms or
  term variations or any kind of keyword stuffing will not improve the Content score."
  <https://help.ahrefs.com/en/articles/9879434-about-the-new-ai-content-helper>
- **Grow and Convert, Pain Point SEO** (updated 2026-03-17) [vendor claim]: write bottom-of-funnel first, in this order: category
  keywords ("best crm software"), comparison and alternatives, then jobs-to-be-done; top-of-funnel "rarely if ever". Their numbers
  (own clients): top-of-funnel posts convert 0.03-0.19%, bottom-of-funnel 0.3-4.3%; the comparison post with the most conversions
  targeted a keyword tools showed as **zero volume**. <https://www.growandconvert.com/seo/pain-point-seo/> Lesson for us: search volume
  is a poor filter for service and comparison pages; **buyer intent and fit with what the client sells** are the filter.
- **MarketMuse (Siteimprove)** [doc]: **Personalized Difficulty = Keyword Difficulty minus your Topic Authority**; prioritise "low
  Personalized Difficulty" where "Topic Authority" is high; the content plan says whether to create or update.
  <https://help.marketmuse.com/support/solutions/articles/80001167736-personalized-difficulty-and-topic-authority>
- **Semrush Personal Keyword Difficulty and Topical Authority** [doc, formula not published]: difficulty "for your domain", topical
  authority "compares the thematics of the specified domain and keyword". (Located via search results; help pages
  kb/1433 and kb/1434.)
- **AirOps refresh scoring** (2026-10-13) [doc + vendor claim]: five signals (organic traffic and rankings, AI citation rate, mention
  rate, content age, competitor citation gains); triggers (traffic down 20%+ over a quarter, positions 4-20, high impressions low CTR,
  pages that should be cited but are not); **ICE** score; actions **refresh** (positions 4-30, relevant topic), **rewrite** (below 50 or
  outdated intent), **merge** (pages competing for the same keyword, 301 the rest), **retire**. Refreshing is "about 3x more
  cost-effective" than new content [vendor claim]. <https://www.airops.com/blog/difference-high-effort-low-effort-refresh>
- **Cannibalisation checks**: Ahrefs' method is the Organic keywords report with "Multiple URLs only", plus ranking history for URL
  switching; a "Potential cannibalization" use case was added to its Opportunities report in May 2024 [doc, seen in search results].
  <https://ahrefs.com/blog/keyword-cannibalization>

### 2.2 Evidence on what new pages can achieve

- **Ahrefs, "How long does it take to rank"** (2025-05-15, Patrick Stox) [evidence, dataset]: of ~1M URLs first seen Sept 2023, **1.74%**
  reached the top 10 within a year (5.7% in 2017); a filtered sample of non-empty English pages gives **6.11%**. Of those that did,
  **40.82% got there within one month**; after about six months chances are "pretty low" without content changes. **72.9%** of top-10
  pages are older than three years; the average #1 page is five years old. "94% of the pages never actually ranked for high volume
  keywords at all." <https://ahrefs.com/blog/how-long-does-it-take-to-rank/>
- Reading: a **new** page on a contested head term is a long shot; an **existing** page with history, links and rankings is the better
  bet to improve. That is why the leaders put "update or merge" before "create" in their plans (MarketMuse, AirOps, Ahrefs).

### 2.3 What this means for us

- A keyword verdict under 50, or a SERP whose dominant type does not match the planned page type, should **stop and ask** (or propose the
  matching type, or propose updating the existing page). The market does this through planning tools; nobody writes a page the planning
  layer called a poor use of effort.
- **Content type follows the SERP.** If the top results for "ms 365 erp" are explainers, a service page will not rank there; the right
  answer is an explainer that sells (Grow and Convert's JTBD pattern: "provide helpful advice but also present your product or service as
  a possible solution") or a service page aimed at a different, transactional query.
- **Own-site overlap is a planning check, not a late QA flag.** Ours fired correctly in the page run, then Finalize dropped it. In the
  leaders' flows the overlap decides *merge vs new* before writing.

---

## 3. Service and commercial pages (the gap R2 did not cover)

### 3.1 Evidence on what makes service pages rank

- **Whitespark 2026 Local Search Ranking Factors** (published 2025-11-06, Darren Shaw; expert survey, the industry's standard reference)
  [survey]. Local organic: **#1 "Dedicated Page for Each Service" (210)**, #2 geographic keyword relevance of content (190), #3 quality of
  inbound links (187), #6 internal linking (174), #7 topical relevance across the site (172), #9 site focus on a niche (169). Service-page
  content: "Volume of Quality Content on Service Pages" #17 (154), "Freshness of Content on Service Pages" #31, "Presence of FAQs on
  Service Pages" #60. AI search: **#1 "Presence of Business on Expert Curated Best of and Similar Lists" (179), #2 dedicated page per
  service (170)**; "In AI SEO, mentions (citations) are the new link"; scannable structure #10 for AI. Shaw: "massive pages of content
  are no longer the way"; answer the user's questions up front. <https://whitespark.ca/local-search-ranking-factors/>
- **Google, doorway abuse** (spam policies, updated 2026-08-28) [doc]: "sites or pages are created to rank for specific, similar search
  queries", example "multiple domain names or pages targeted at specific regions or cities that funnel users to one page". Location
  pages must differ in substance, not only in the city name. <https://developers.google.com/search/docs/essentials/spam-policies>
- **Google, writing reviews** (updated 2025-12-10) [doc], the standard for comparison, alternatives and "best X" pages: "Evaluate from a
  user's perspective", "Provide evidence such as visuals, audio, or other links of your own experience", "Share quantitative
  measurements", "Explain what sets something apart from its competitors", "include why you consider it the best, with first-hand
  supporting evidence", "focus on the quality and originality of your reviews, not the length."
  <https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews>
- **Google, AI features** (updated 2025-12-10) [doc]: "There are no additional requirements to appear in AI Overviews or AI Mode, nor
  other special optimizations necessary"; AI Mode may issue "multiple related searches across subtopics and data sources" (query
  fan-out); keep structured data matching visible text and keep Business Profile information current.
  <https://developers.google.com/search/docs/appearance/ai-features>
- **AI retrieval of brand pages** [vendor claim, method not shown]: Peec AI reports that after ChatGPT's GPT-5.6 rollout (Aug 2026)
  listicles fell from 15.47% to 8.19% of retrieved pages and **product pages lead at 16.39%**, driven by fan-out queries with `site:`
  restricted to the brand's own domain, which target "product, feature, and pricing pages".
  <https://docs.peec.ai/research/gpt-56-product-pages-vs-listicles> Earlier studies (Ahrefs via Search Engine Land, seen in search
  results) put "best X" listicles at ~44% of ChatGPT citations for top-of-funnel prompts. Direction: a brand's own service and pricing
  pages are now retrieved directly; they must be readable without JavaScript and say concrete things.
- **SERP composition** [evidence, partial]: Terakeet's Q1 2025 analysis (Cochran-Mantel-Haenszel over weekly SERPs) finds blogs and
  Wikipedia strongly over-represented on informational queries and review sites on transactional ones; it does not split service pages
  from product pages. <https://engineering.terakeet.com/posts/serp-composition/> No rigorous public study measures service pages vs blog
  posts on commercial keywords [thin]; the practical method everyone uses is to classify the top 10 by type and follow the majority.

### 3.2 What buyers look for on a service page

- **Gartner** (press release 2025-06-25, survey of 632 B2B buyers fielded Aug-Sept 2024) [survey, seen in search results]: **61%**
  prefer a rep-free buying experience; **69%** report inconsistencies between the vendor's website and what sellers say. A later Gartner
  survey (646 buyers, Aug-Sept 2025) gives 67% [survey, secondary]. Implication: the service page is often the whole sales conversation,
  and a claim on it that the client cannot back costs trust.
- **Nielsen Norman Group** [evidence, old: 2006]: price is the prospect's first information need; when exact prices cannot be shown,
  "offer users some representative cases and their prices." <https://www.nngroup.com/articles/show-prices-for-common-scenarios/> Old,
  but no newer finding contradicts it, and the 2026 vendor-side advice (show "from" prices or ranges for project work) repeats it [thin].

### 3.3 What the AI content leaders offer for service and landing pages

| Product | Service / landing page support | What is gated |
|---|---|---|
| **Search Atlas** (Content Genius "Landing Page" mode, OTTO) [doc] | Landing Page mode; SOP requires internal links to **homepage, a service page and contact page**; competitor page compared for word count, entities and structure; OTTO can generate local landing pages from Business Profile data and publish or save as drafts; SCHOLAR re-score before publishing | Nothing hard-blocks; "approval mode" in OTTO (R2) |
| **Profound Agents** [doc] | Template marketplace; a **v0 node** generates and deploys landing pages "using your Profound AEO data"; Webflow sync as drafts | Human Review node (R2) |
| **AirOps** [doc] | Playbooks for any page type; Content Review checks "Dominant SERP format" and "matching the dominant search intent" | Review step; "Nothing changes without your approval" |
| **Surfer, Clearscope, Frase, Ahrefs** [doc] | Page-agnostic editors scored against the top results; Ahrefs lets you pick the intent group to benchmark against | Advisory scores only |
| **Jasper** (Optimization Agent Jan 2026, GEO Agent Jul 2026) [doc, vendor] | Briefs, keyword clusters, flags underperforming content | Brand rules (R2) |

No product documents a **service-page-specific proof requirement** (for example "a service page needs a price range, a process and one
verifiable proof point or it is not ready"). That is an opening.

### 3.4 Page-type anatomy (synthesis for our plan)

Built from the sources above (Google reviews and doorway guidance, Whitespark, Grow and Convert, Ahrefs three Cs, NN/g, Gartner). The
"must have" column is what an expert reviewer marks down when it is missing; the "kills it" column is what the sources call spam or
low quality.

| Page type | Job | Must have | Kills it |
|---|---|---|---|
| **Service page** | Convert a buyer who already knows the need | One service, one page; who it is for; scope and process steps; price range or representative cases; 1-3 verifiable proof points (partner listing, named client with permission, dated result, certification ID, named lead with role); local specifics if local; FAQ only for real objections; CTA | Written for an informational SERP; padding sections; claims the client cannot back; generic copy that fits any competitor; contradicting other site pages |
| **Location page** | Rank in a city / area | Real local facts (address or service area, local team, local regulations, local examples, local reviews), Business Profile consistency | Same text with the city swapped (doorway abuse) |
| **Comparison / alternatives** | Win buyers choosing between options | First-hand criteria, quantitative comparison, who each option suits, honest pros and cons, why "best" with evidence | Self-serving lists with no evidence; competitor facts not sourced and dated |
| **Pricing / cost page** | Answer "how much" | Ranges, drivers of cost, representative cases, what is included | Invented prices; "contact us" with nothing else |
| **Hub / pillar** | Organise a topic, pass links | Short sections that link to the detailed pages; no repetition of child pages | A long page that duplicates every child page |
| **Case study** | Proof | Real client (or anonymised with permission), problem, approach, numbers with dates, quote with permission | Anything invented (FTC rule on fake testimonials, R2 3.6) |
| **AI answer page** | Be quoted by AI answers | The answer in the first lines, named sources, dated facts, the brand's own specifics | A generic summary of what others say |
| **Blog guide / explainer** | Rank on informational SERPs, feed service pages | Information gain over the top results; first-hand angle; link to the service page | Restating the SERP; repetition; padding to a length target |
| **Refresh** | Recover or extend an existing page | Changed facts, new subtopics, updated date only when substance changed | Date bumps without change (Google helpful-content question) |

---

## 4. Proof and E-E-A-T capture

### 4.1 What Google asks for

- "Creating helpful content" (updated **2026-10-05**) [doc]: "Is it self-evident to your visitors who authored your content?", "Is the
  use of automation, including AI-generation, self-evident to visitors through disclosures or in other ways?", "Why is it being created
  in the first place?", "Did you decide to enter some niche topic area without any real expertise", "Does your content leave readers
  feeling like they need to search again", "Are you changing the date of pages to make them seem fresh when the content has not
  substantially changed?" <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- Quality rater guidelines, **January 2025** [evidence, secondary; Google PDF not opened]: a new section on **"filler"**, low-effort,
  low-relevance material that dominates a page without serving its purpose; Lowest rating where almost all main content is copied or
  paraphrased with no added value, including AI-generated content with "little to no effort, little to no originality, and little to
  no added value". **September 2025** revision was minor (AI Overview examples, YMYL wording incl. government and civics)
  [evidence, secondary]. <https://searchengineland.com/google-updates-search-quality-raters-guidelines-adding-ai-overview-examples-ymyl-definitions-461908>

### 4.2 What predicts results in practice

- **Orbit Media, 13th annual blogger survey (2026, 1,042 content marketers)** [survey]: "strong results" at an all-time low of **13.9%**;
  formal human editing beats the benchmark by "nearly 2X"; the group that uses **AI to edit reports the lowest strong-results rate**; no
  AI use case correlates with performance; publishing **original research +50%** likelihood of strong results; **working with experts
  and influencers 2.6x**, but adoption fell from 25% (2017) to 7%; average time per post 3h20m, down four years in a row.
  <https://www.orbitmedia.com/blog/blogging-statistics/>
  Reading: the market drifted toward faster, AI-edited, expert-free content, and results fell with it. The rare practices that still
  work (expert input, original data, a human editor) are the ones bulk tools skip.

### 4.3 How agencies and publishers capture and check proof

- **Semrush blog editorial standards** (2024-05-06) [doc]: strategist writes a brief; vetted subject experts draft; editors fact-check,
  "Verifying every claim against trusted sources to ensure the information is accurate and current"; managing editor approves only "once
  fully satisfied"; updates are triggered by performance data, "external changes (industry, technology, market, regulation)" and reader
  feedback, and "go through the same editorial process" with new publish dates. <https://www.semrush.com/blog/editorial-standards/>
- **Siege Media** (job postings, 2026) [thin]: editors "thoroughly fact-check copy to ensure all names, statistics, claims, dates, and
  references are accurate and properly sourced." No public process page.
- **Grow and Convert** [vendor doc]: customer interviews (or sales staff as a shortcut) with five open questions: the problem before us,
  what they would use if we did not exist, how they describe us to a friend, top three benefits, what they would search for. "Prioritize
  responses that you get multiple times."
- **Contently AI Studio** [vendor claim]: a Fact Check agent verifies numerical and named-entity claims "against source documents" and
  draws from "regulator filings and the firm's own published material, not the open web"; contradictions "surface in the editor's queue,
  not on publish"; "Human editors approve every claim, every citation, every voice change." <https://contently.com/platform/ai-studio/>
- **Customer-evidence platforms** (UserEvidence and similar) [vendor claim, thin]: structured customer surveys produce attributed
  quotes and statistics with permission; an early-2026 "Proof Recommender" and MCP server are reported. This is the B2B market's answer
  to "where does verifiable proof come from".
- **SME interview tools** (Hello Gordon, dbrief) are covered in R2 4 and 6.4.

### 4.4 What counts as proof (and what does not)

Synthesis from Google's reviews guidance ("first-hand supporting evidence", "quantitative measurements"), Semrush / Siege fact-check
scope, Contently's claim types and the FTC substantiation rule (R2 3.6).

| Counts as proof | Does not count |
|---|---|
| A public listing that can be linked (Microsoft partner directory entry, free-zone licence register, accreditation list) | A homepage slogan ("deep UAE and GCC knowledge") |
| A named client the client may name, or an anonymised case with a real number and date | "Leading", "trusted by many", "expert team" |
| A named person with a role and a verifiable profile | An unnamed "team of consultants" |
| A process detail only a practitioner knows (steps, timelines, tools, what they refuse to do) | Generic steps any competitor could write |
| A price range or representative case | "Free consultation" not confirmed by the client |
| A dated statistic from a primary source (regulator, ministry, vendor documentation) | A statistic from an aggregator blog or a competitor's marketing page |

Placement rule (from editorial practice, not a vendor feature): each proof point belongs to **the section whose claim it supports**;
it is written into that sentence, not appended at the end of a paragraph. Contently's Brand Voice agent shows the shape: each change is
proposed individually, most accepted, some deferred to an editor. Our Finalize appended answers as fragments; the leaders' edit is
sentence-level and reviewable.

### 4.5 Local and regulatory facts

- Semrush lists **regulation** as an explicit refresh trigger [doc]; Contently's fact checker reads regulator filings [vendor claim];
  Google's raters treat government and civic information as YMYL (Sept 2025) [evidence, secondary].
- No content product documents a "local regulator research" step for a country (for example the UAE Ministry of Finance e-invoicing
  timeline) [thin]. The leaders' answer is human: an editor or SME who knows the market. For us this has to be a research step: for a
  regulated topic in a country, search the regulator's own site and the client's own pages for dated requirements before writing, and
  treat a missing deadline as a factual gap, not a style issue.

---

## 5. Avoiding repetition and padding

- **Google**: raters' "filler" section (Jan 2025, above); "length of the content alone doesn't matter" (SEO Starter Guide, R2 3.1).
- **Whitespark** (2025-11-06): "massive pages of content are no longer the way" for service pages [survey].
- **"Measuring AI Slop in Text"** (Shaib, Chakrabarty, Garcia-Olano, Wallace; arXiv 2509.19163, Sept 2025) [evidence, peer-review
  status not confirmed]: three professional copy-editors annotated 250 texts. Taxonomy: information utility (density, relevance),
  information quality (factuality, bias), style (repetition, templatedness, coherence, fluency, verbosity, word complexity, tone). All
  codes predict a "slop" label; the strongest are **relevance, density and tone**; in QA-style text, **factuality and
  repetition/templatedness**. Automatic metrics reach AUPRC ~0.52-0.55 (about double base rate, not reliable). **LLM judges: agreement
  with humans near chance (kappa about 0), flagging 3-8% of texts vs 34% for humans; span recall 0.08-0.12.**
  <https://arxiv.org/html/2509.19163v2>
- **Search Atlas SCHOLAR** [vendor claim]: compares semantic triples on the page with competing pages to find "repetitive coverage" and
  unique gaps; grades "information gain" and "numerical density/precision". No validation published. <https://searchatlas.com/scholar/>
- **AirOps Content Review** [doc]: "Information Gain (20 pts): Net-new knowledge beyond top search results".

What follows for us:
1. **Repetition is countable**: the same claim restated (our "not an ERP" point six times), the same list given twice under one heading
   name. Use deterministic checks (repeated n-grams and sentence-embedding near-duplicates across sections; duplicate list titles), not
   only an LLM opinion. The slop paper shows LLM judges miss most of it.
2. **Dedupe at the outline**: each section owns one claim; the brief records which section owns it; later sections may link back but
   not restate. This is how human editors cut repetition and it is cheaper than fixing prose.
3. **Padding is relevance and density**: a section that does not serve the page's job (for example "big companies" on an SMB service
   page) is removed, not rewritten. Length targets should never create sections.

---

## 6. Evaluating quality before publishing

### 6.1 What the leaders check, and what gates

| Product | Checks | Weighting / output | Gate |
|---|---|---|---|
| **AirOps Content Review** (docs, 2026) [doc] | **22 checks**: Brand Adherence (writing rules from Brand Kit); **Information Gain** (net-new knowledge, coverage of what top results cover); **Search Intent** (answer completeness, dominant intent, keyword placement); **E-E-A-T** (first-party insights, topic fit with brand expertise, **named sources and source links for third-party claims**, link counts, broken links); Readability (dominant SERP format, sentence/paragraph length, lists, headings) | Score /100: Brand 50, Information Gain 20, E-E-A-T 14, Intent 11.5, Readability 4.5; each flag says what, why, how to fix | Suggestions applied section by section; "Nothing changes without your approval"; 3 review runs per session |
| **Contently AI Studio** [vendor claim] | Six agents: Brand Voice, SEO, QA (grammar, readability, dead links), **Fact Check** (numbers and named entities vs source documents), LLM Optimization (extractable answers), AI Detectability | Per-agent outputs to a review queue | "Nothing ships without sign-off"; contradictions go to the editor |
| **Search Atlas SCHOLAR** [vendor claim] | 12 dimensions incl. **factuality, intent match, information gain, freshness**, entity coverage, numerical precision, "human effort" (lists, tables, images, video, schema) | Composite 0-100 + per-dimension grades | Re-score before publish; no hard gate |
| **Frase** (2026 rebuild) [doc] | SEO score + **GEO score** ("easier to quote": answer near top, entities, citable facts); **Content Guard** monitors decay after publishing and proposes fixes | Two scores side by side | "keep every page under review" or auto; republish waits for approval |
| **Semrush Enterprise, Unified Content Optimization** (2026-05-27) [doc] | Same brief and tools across SEO and AI optimisation; "side-by-side scoring for each channel" | Real-time scores | Not stated |
| **Ahrefs AI Content Helper** (2026-09-03) [doc] | Core-topic coverage against the chosen intent group; title/meta suggestions do not affect score | 0-100 + per-topic | Advisory |
| **AirOps Content Quality steps** [doc] | Detect AI content, scan for plagiarism (Originality.ai) | Scores | Up to the workflow |
| **Writer** (R2) [doc] | Claim detection highlights statistics, quotes, anecdotes for a human | Highlights | Human verifies |

Patterns:
- **Intent fit, information gain, E-E-A-T and named sources are scored by the leaders; we score none of them.** Brand rules are the
  heaviest weight at AirOps (50 of 100), which is the enterprise buyer's main fear.
- **Fixes are proposed per section and accepted individually**, never a whole-page rewrite (AirOps, Contently, Surfer Auto-Optimize in
  R2).
- **The review state is part of the document.** In AirOps, Profound and Frase, a flagged item stays flagged until a person resolves it.
  Our Finalize re-graded from scratch and lost the page run's blocker. No leader re-derives readiness from a smaller check set at the end.
- **Metadata is checked as metadata.** Contently's QA and AirOps' intent checks look at keyword placement; Google's 2026-10-01 guidance
  (R2 3.1) names `<title>`, meta description, structured data and alt text as review items. Nobody runs a business-claims checker on a
  meta description and turns its output into a client question.
- **Delivery is part of the product.** Profound (CMS publishing), Frase (FraseCMS), Surfer (WordPress plugin), AirOps (Webflow /
  WordPress push) all hand over the final version in a usable form. A "final version" with no file or CMS hand-off reads as unfinished.

### 6.2 How reliable LLM judges are (evidence)

- **Zheng et al., MT-Bench / Chatbot Arena** (NeurIPS 2023) [evidence]: GPT-4 as judge reaches "over 80% agreement" with human
  preferences on chat answers, about human-human agreement; documents **position, verbosity and self-enhancement bias**.
  <https://arxiv.org/abs/2306.05685>
- **Panickssery, Bowman, Feng, "LLM Evaluators Recognize and Favor Their Own Generations"** (2024) [evidence, preprint]: models recognise
  their own outputs above chance; self-recognition strength correlates linearly with **self-preference**, with evidence of a causal link.
  <https://arxiv.org/abs/2404.13076>
- **Marioriyad et al., "The Silent Judge"** (NeurIPS 2025 workshop) [evidence]: judges favour responses labelled newer and those
  attributed to experts (Expert > Human > LLM > Unknown) and rarely admit the cue in their justification ("cue acknowledgment is rare").
  <https://arxiv.org/abs/2509.26072>
- **Chen et al., "Benchmarking LLM-as-a-Judge for Long-Form Output Evaluation" (LongJudgeBench)** (EMNLP 2026, v4 2026-08-28)
  [evidence]: judges are "unstable across scenarios" on long-form outputs; rubrics and reference answers help but are "not always
  sufficient"; long-form judging needs document-level checks (organisation, coverage and depth, **cross-section consistency**).
  <https://arxiv.org/abs/2606.01629>
- **Shaib et al., slop** (above): LLM judges near chance on holistic "is this low quality" labels.

Reading for us:
- A single holistic LLM "quality score" will flatter our pages (verbosity bias, self-preference if the judge is the writer's family,
  low recall on slop). Our Critic happened to land near the client (66 vs 63) on that page; that is one data point, not a calibration.
- Narrow, **single-criterion, evidence-anchored** items work better ("quote every sentence that restates an earlier claim"; "list each
  claim about the client and the source that supports it"; "what type of page are the top 5 results"). Code checks whatever can be
  counted.
- Use a **different model family** from the writer for judging, or a panel; **calibrate** on a labelled set of pages rated by human
  experts (the techand.ai page with its 63 and its category scores is case #1), and report agreement (Cohen's kappa) per criterion, the
  same discipline we already apply to the keyword-fit and promise readers (ACCURACY_SET, harness S49).

### 6.3 A rubric the market and a real reviewer agree on

Mapping the techand.ai reviewer's categories to what the leaders score and to the evidence. Proposed as the basis for our grade (the
plan decides weights and thresholds).

| Criterion | Reviewer weight | Leaders that score it | How to measure |
|---|---|---|---|
| Usefulness / information gain | 25 | AirOps (20), SCHOLAR, Frase GEO | LLM item: what does this page say that the top 5 do not; code: entity / fact coverage vs SERP |
| Fit with what ranks (type, intent, demand, own-site overlap) | 20 | AirOps (intent 11.5, SERP format), Ahrefs intent groups, SCHOLAR | Code: SERP type majority vs our page type; verdict score; overlap with own URLs |
| Proof and trust (first-hand proof, named sources, source quality) | 15 | AirOps E-E-A-T (14), Contently Fact Check, Writer | Code: claim ledger (each client claim has a source; each external figure has a primary source); source-domain class (regulator / vendor doc / aggregator / competitor) |
| Local and factual accuracy (incl. regulatory dates) | 15 | Contently, SCHOLAR factuality | Research step + claim check vs primary sources; required-facts list per topic and market |
| Structure (no repetition, no padding, consistent lists) | 15 | SCHOLAR repetition, LongJudgeBench cross-section consistency | Code: near-duplicate sentences / repeated claims / duplicate list titles; LLM item: sections that do not serve the page's job |
| Ready to publish (meta, links, schema, images, spelling locale, no stray text) | 10 | Contently QA, AirOps broken links, Google review list | Code only: metadata parsed per line, length, presence; broken links; locale setting; splice detection (sentence fragments moved by edits) |

### 6.4 Human review in the leaders' flows

- Every enterprise flow ends with a person (AirOps Human Review, Profound review nodes and docs, Contently "Nothing ships without
  sign-off", Semrush managing editor, Frase "keep every page under review"). The difference between leaders is **how little the person
  has to do**: flagged items with reasons and proposed fixes, not a 2,000-word read (R2 6.6 already proposes our evidence ledger).
- The bulk writers make review optional (SEObot "runs 100% autopilot by default"; Outrank "auto-pilot"), section 8.

---

## 7. Page refresh

- **AirOps** (2026-10-13) [doc + vendor claim]: triggers and ICE scoring (2.1); the low-effort refresh replaces outdated statistics and
  examples, adds missing subtopics, tightens answer blocks, rewrites title and meta, "update the date only when content has changed";
  rewrite / merge / retire for the rest; measure GSC at 2-4 weeks, AI citations at 30-60 days, conversions at 90 days. Claims: pages not
  refreshed for over a year are cited less than half as often; visible last-updated dates earned 1.8x more citations [vendor claim].
- **Clearscope Content Inventory** [thin, third-party reviews]: tracks published pages with GSC clicks, position, grade and decay;
  striking-distance views.
- **Frase Content Guard** [doc]: watches for ranking decay and "proposes the fix for your approval before it republishes to your CMS".
- **Semrush editorial** [doc]: updates triggered by performance, external change (including **regulation**) and feedback; full rewrite or
  minor fix; same editorial process; new publish date.
- **Google** [doc]: do not change dates without substantial change (helpful-content question, 2026-10-05).
- **Ahrefs** [evidence]: after about six months without ranking, chances are "pretty low" without content changes (2.2).

For us: the Site Tracker and Rank Tracker already hold the signals (GSC, positions, AI citations); the plan should route
"existing page for the same search" to **refresh or merge**, which is exactly the blocker Finalize dropped.

---

## 8. What the market promises on time to rank

| Who | Promise | Label |
|---|---|---|
| **Google** ("Do you need an SEO?", updated 2026-06-05) | "No one can guarantee a #1 ranking on Google." "If they guarantee you that their changes will give you first place in search results, find someone else." Ask the SEO "What kind of results do you expect to see, and in what timeframe?" <https://developers.google.com/search/docs/fundamentals/do-i-need-seo> | [doc] |
| Google (2017 video, Maile Ohye) | "in most cases, SEOs need four months to a year to help your business first implement improvements and then see potential benefit" | [evidence, secondary, old] |
| **Ahrefs data** (2025) | 1.74-6.11% of new pages reach top 10 within a year; 40.82% of those within a month | [evidence] |
| **Outrank** | "Grow Organic Traffic on Auto-Pilot", "30 Articles a month generated and published on auto-pilot"; own study: median site reached 2.0x clicks about 7 months in | [vendor claim] <https://www.outrank.so/> |
| **SEObot** | "takes 100% of SEO work out of your way", "runs 100% autopilot by default"; FAQ concedes quality "varies" vs human writers | [vendor claim] <https://seobotai.com/> |
| **Grow and Convert, AirOps, Semrush** | No rank-time promise found; AirOps gives measurement windows (2-4 weeks GSC, 30-60 days AI citations, 90 days conversions) | [doc] |

What we can honestly promise: **speed of execution** (written, checked and handed over within days), **indexing checks** (we already
verify live pages), **a forecast band from our own data** (the ladder's rank history and the site's own reach), and **measurement
windows** like AirOps'. Never a position or a date. A guarantee is also a red flag in Google's own hiring guide, which enterprise buyers
read.

---

## 9. Where the bulk AI writers failed, and why

| Case | What happened | Label |
|---|---|---|
| **Google March 2024 core update + spam policies** | Scaled content abuse policy ("producing content at scale to boost search ranking", by automation, humans or both); site reputation abuse; expired domain abuse. Google reported "45% less low-quality, unoriginal content in search results" after the 2024-04-19 rollout. <https://blog.google/products/search/google-search-update-march-2024/> | [doc] |
| **Manual-action wave, March 2024** | Of ~79,000 sites on Mediavine, Raptive and Ezoic, **1,446 (1.9%)** lost all indexing; in a 175-site sample of deindexed sites, **86%** likely published AI content and **30%** were 95%+ AI (detector-based, ad-network sample). <https://originality.ai/blog/google-march-2024-manual-action-ai-update-list> | [vendor study] |
| **Causal "SEO heist"** | ~1,800 AI articles built from a competitor's sitemap; organic traffic 307,158 to 1,485 (**-99.52%**) "as a result of a Google manual penalty" (Ahrefs estimate, 2024-09-09). <https://ahrefs.com/blog/biggest-traffic-losers/> | [evidence, secondary; penalty not confirmed by Google] |
| **BetterCloud /academy** | -94%, loss concentrated in a since-deleted folder of generic, apparently AI-generated articles; cause "possible" | [thin] |
| **CNET** (Jan 2023) | **41 of 77** AI-assisted stories needed corrections, some major; plagiarism concerns ("not entirely original"). <https://edition.cnn.com/2023/01/25/tech/cnet-ai-tool-news-stories> | [evidence, press] |
| **Sports Illustrated / AdVon** (Nov 2023) | Product reviews under bylines of authors who could not be found; one headshot from an AI-portrait site; partner dropped, articles removed. <https://csmonitor.com/Business/2023/1129/Sports-Illustrated-is-latest-media-to-feel-the-pull-and-sting-of-AI> | [evidence, press] |
| **August 2025 spam update** (completed 2025-09-22) | Targeted scaled content and expired domains; Raptive's network was "relatively flat"; sites with ads-to-content above 25% more likely to fall; SISTRIX saw staggered losses. <https://raptive.com/blog/heres-what-we-learned-from-googles-august-2025-spam-update/> | [evidence, secondary] |
| **Koala-type bulk sites** | Anecdotes of drops and manual actions on unedited bulk publishing; no controlled data | [thin] |
| **2025 manual-action wave (June 2025)** | Reported deindexing of sites with heavy unreviewed AI content; no Google confirmation found | [thin] |

**Why they failed (common anatomy):**
1. **Volume chosen by keyword lists, not by demand or fit** (Causal cloned a sitemap; bulk tools sell "30 articles a month").
2. **No first-hand information or information gain**: restating the SERP, the exact "Lowest" pattern in the rater guidelines.
3. **Invented people and facts** (SI fake authors, CNET errors): trust failures that also became press stories.
4. **No review gate**: autopilot by default.
5. **Pages competing with each other and with the site's real pages** (doorway and cannibalisation patterns).

**Our exposure:** the Content Cadence writes weekly pages per client. If those pages are generic, repetitive or written for keywords the
verdict calls poor, we are building the scaled-content pattern on our clients' domains, with their names on it. The safeguards that
separate us from the failures are the ones in sections 2 to 6, and they must hold for every page, not only the first.

---

## 10. The best agencies' editorial workflow, mapped to our pipeline

Assembled from Semrush's published process, Siege Media's editor scope, Grow and Convert's method, Contently's agent flow and the SME
interview practice (R2). Where our pipeline already has the step, the gap is named.

| Agency step | Who | Our equivalent | Gap shown by the techand.ai run |
|---|---|---|---|
| 1. Pick the topic by business potential and SERP type; check own-site overlap | Strategist | Keyword verdict, ladder, cadence | Verdict 42 and an overlap blocker did not stop the page |
| 2. Customer / SME input: problems, objections, proof, process | Strategist + client | Business profile, facts, case studies, client questions | Proof questions prefilled with a slogan; no regulatory research |
| 3. Brief: angle, sections, the claim each section owns, required facts | Strategist | Strategy Brief (Opus) | No "claim owner" per section, so repetition was not prevented |
| 4. Draft by a writer who knows the subject | Writer | Copywriter (Opus) | - |
| 5. Edit: cut repetition and padding, check intent | Editor | Critic, Editor rounds | Critic's 66 gated nothing; padding sections stayed |
| 6. Fact-check every name, number, date, claim against primary sources | Editor / fact-checker | Claim check, `_sources.js`, Verified Sources | Ran on metadata; weak secondary sources kept after the Critic flagged them |
| 7. SME or client review of claims about the business | Client | Client questions, Finalize | Answers appended as fragments; meta sentence became a body sentence |
| 8. Managing editor approval with the open issues in view | Managing editor | Delivery state, app page review | Finalize re-graded to 100 and dropped the blocker |
| 9. Publish with metadata, schema, images, files | Producer | Blog package, CMS publishing | Broken meta; no downloads on the final version |
| 10. Measure and refresh on performance and external change (incl. regulation) | Strategist | Rank / Site Tracker, cadence refresh | Not reached in this case |

---

## 11. Copy this (ranked)

Ranked by impact on ranking and on expert ratings x strength of evidence x fit with the techand.ai failures.

1. **Decide whether the page should exist before writing it.** SERP type majority must match our page type; the verdict and the
   client's business potential decide; an existing own page for the same search means refresh or merge, not new. Below a verdict
   threshold (the owner proposed 50), ask first. Sources: Ahrefs three Cs and business potential [doc], Ahrefs 2025 time-to-rank data
   [evidence], MarketMuse / AirOps create-vs-update [doc], Grow and Convert [vendor claim]. Fixes failures 3, 5.
2. **Score what experts score: intent fit, information gain, proof with named sources, factual and local accuracy, repetition, publish
   readiness.** Weighted like AirOps Content Review and the reviewer's rubric (6.3), with code doing every countable part. Fixes 4.
3. **Carry the review state through to the end.** A blocker raised anywhere stays open until resolved by a person or a fix; Finalize
   can only close items, never re-derive readiness from fewer checks. AirOps / Profound / Contently pattern [doc]. Fixes 3.
4. **Treat metadata as metadata.** Parse title, meta description and slug per line; check length and presence deterministically; never
   run business-claim checks on them or turn them into client questions. Google's review list [doc]. Fixes 1, 2.
5. **A verifiable-proof standard per page type** (4.4, 3.4): service pages need a price range or representative case, a process, and
   1-3 verifiable proof points; slogans are rejected as proof; every client answer is validated and written into the sentence it
   supports. Google reviews and helpful-content guidance [doc], Orbit 2026 [survey], FTC (R2). Fixes 6.
6. **Calibrated, narrow LLM judges from a different model family**, measured against a human-rated set with kappa per criterion; the
   judge advises, code and the blocker list gate. MT-Bench, self-preference, Silent Judge, LongJudgeBench, slop paper [evidence].
   Fixes 4.
7. **Outline-level dedupe**: each claim owned by one section in the brief; deterministic near-duplicate detection after drafting; padding
   sections removed, not rewritten. Rater "filler" guidance, slop taxonomy [evidence]. Fixes the repetition and padding complaints.
8. **Primary-source research for regulated and local topics**: the regulator's own site and the client's own pages for dated
   requirements; source-domain classes (regulator, vendor documentation, independent study, aggregator, competitor) with aggregators and
   competitors never the sole source of a figure. Semrush "external changes (regulation)", Contently "regulator filings" [doc / vendor].
   Fixes 7 and the "weak sources" complaint.
9. **Section-level fixes accepted individually, with the reason shown** (AirOps "what, why, how to fix"; Contently per-change accept /
   defer) [doc]. Replaces appended fragments and whole-page rewrites.
10. **Short, specific service pages; one service per page; location pages with real local substance.** Whitespark 2026 [survey],
    Google doorway policy [doc].
11. **Refresh as a first-class page type** with AirOps-style triggers and measurement windows; date changes only with substance [doc].
12. **Deliver the final version in usable form**: HTML, Word and PDF downloads and the CMS push we already built; a final version
    without files reads as unfinished (Profound, Frase, Surfer, AirOps publish paths) [doc]. Fixes 8.
13. **Honest time-to-rank language**: execution speed, live and indexing checks, forecast bands from our own rank history, AirOps-style
    measurement windows; no guarantees (Google [doc]).
14. **Feed off-site proof**: "best of" lists and citations are the #1 AI-visibility factor for local businesses (Whitespark [survey]);
    our Link Builder and AI Growth already target them; service pages should link to and be consistent with those listings.

## 12. Do not copy

1. **Autopilot publishing by default** (SEObot, Outrank, OTTO autopilot). Google: manual review is "critical" (R2); the failure cases
   in section 9 all lacked review.
2. **Volume packages sold as the product** ("30 articles a month"). The scaled-content pattern; Orbit 2026 shows the faster, AI-edited,
   expert-free drift coincided with record-low results.
3. **A single 0-100 score as the gate**, from any vendor or our own. Every vendor score is advisory for a reason (R2), and LLM holistic
   scores have low recall on low-quality text (slop paper).
4. **AI-detector "humanising" loops** (Contently's AI Detectability agent, AirOps' Detect AI step). Google judges quality, not
   production method; rewriting to fool detectors spends tokens without adding proof or accuracy. Disclose automation where Google's
   "How" question suggests it instead.
5. **Self-serving "best X" lists that rank the client first without evidence.** Google's reviews guidance asks for first-hand evidence;
   Peec's August 2026 data suggests ChatGPT's newer retrieval already leans away from listicles.
6. **City-swapped location pages and one-click local landing pages from Business Profile data** without local substance (doorway abuse).
7. **Cloning competitor topic lists or sitemaps** (Causal).
8. **Invented or pen-name authors, invented testimonials, invented numbers** (Sports Illustrated, FTC rule).
9. **Date bumps without substantive change** (Google helpful-content question).
10. **Rank-time or position guarantees** (Google's own red flag).
11. **Using the writer model as its own judge** (self-preference bias).
12. **Chasing a length or term-coverage target that creates sections** (Whitespark, Google, Ahrefs studies in R2).

---

## 13. Gaps and caveats

- **Service-page evidence is thinner than blog evidence.** The strongest sources are Google's policies, the Whitespark expert survey
  (opinions of ~50 experts, not measured rankings) and buyer surveys. No public controlled study of service pages vs blog posts on
  commercial queries was found.
- **AI retrieval data is vendor-run** (Peec, Ahrefs via SEL, AirOps freshness claims); methods are often not public and numbers move with
  each model release (Peec: GPT-5.6 halved the listicle share). Treat directions, not percentages, as findings.
- **Vendor feature pages describe intended behaviour, not tested behaviour.** No independent test of AirOps, Contently, SCHOLAR or Frase
  checks was found. Contently's example outputs are illustrative.
- **Agency processes** are rarely published; Semrush's page (2024) is the most complete; Siege Media is inferred from job postings;
  Animalz, Omniscient and Foundation have no public 2026 process page that was found.
- **LLM-judge research** is mostly on chat answers or short QA; the long-form (LongJudgeBench) and slop studies are the closest to our use
  and both say "not reliable alone". Our own calibration set is the only evidence that will settle weights for our pages.
- **Manual-action studies** (Originality.ai) rely on an AI detector and an ad-network sample; Causal's penalty is reported by Ahrefs, not
  confirmed by Google.
- **Gartner** figures were taken from its press release as surfaced in search results (the page returned 403 when opened); the NN/g
  pricing finding is from 2006.
- Not researched here: UAE-specific consumer-protection rules for marketing claims (R2 7 flagged this too); spelling-locale defaults
  (a setting, not a market practice).

---

## Sources (opened unless noted)

Google
- Spam policies (updated 2026-08-28): https://developers.google.com/search/docs/essentials/spam-policies
- Creating helpful content (updated 2026-10-05): https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- How to write reviews (updated 2025-12-10): https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews
- AI features and your website (updated 2025-12-10): https://developers.google.com/search/docs/appearance/ai-features
- Do you need an SEO? (updated 2026-06-05): https://developers.google.com/search/docs/fundamentals/do-i-need-seo
- March 2024 update and spam policies: https://blog.google/products/search/google-search-update-march-2024/
- Rater guidelines Sept 2025 (secondary): https://searchengineland.com/google-updates-search-quality-raters-guidelines-adding-ai-overview-examples-ymyl-definitions-461908

Vendors and agencies
- AirOps Content Review: https://docs.airops.com/actions/grids/run-content-review-on-your-output
- AirOps Content Quality steps: https://docs.airops.com/building-workflows/workflow-steps/content-quality
- AirOps refresh strategy (2026-10-13): https://www.airops.com/blog/difference-high-effort-low-effort-refresh
- Contently AI Studio: https://contently.com/platform/ai-studio/
- Search Atlas SCHOLAR: https://searchatlas.com/scholar/
- Search Atlas landing pages SOP (seen in search results): https://help.searchatlas.com/en/articles/10670727-creating-and-optimizing-landing-pages-with-search-atlas-otto
- Frase content optimisation: https://frase.io/features/content-optimization
- Semrush Unified Content Optimization (2026-05-27): https://www.semrush.com/news/459685-semrush-for-enterprise-unifies-content-optimization-capabilities-across-seo-and-ai-search/
- Semrush editorial standards (2024-05-06): https://www.semrush.com/blog/editorial-standards/
- Ahrefs AI Content Helper (2026-09-03): https://help.ahrefs.com/en/articles/9879434-about-the-new-ai-content-helper
- Ahrefs SEO content strategy (2022): https://ahrefs.com/blog/seo-content-strategy/
- Ahrefs cannibalisation (seen in search results): https://ahrefs.com/blog/keyword-cannibalization
- MarketMuse personalized difficulty (seen in search results): https://help.marketmuse.com/support/solutions/articles/80001167736-personalized-difficulty-and-topic-authority
- Profound agents (seen in search results): https://help.tryprofound.com/articles/9762251986-agents-overview , https://www.tryprofound.com/blog/introducing-the-v0-node-for-profound-agents
- Jasper product updates (seen in search results): https://www.jasper.ai/blog/january-2026-product-update , https://jasper.ai/blog/july-2026-product-update
- Grow and Convert, Pain Point SEO (updated 2026-03-17): https://www.growandconvert.com/seo/pain-point-seo/
- Outrank: https://www.outrank.so/
- SEObot: https://seobotai.com/

Studies and surveys
- Ahrefs, how long to rank (2025-05-15): https://ahrefs.com/blog/how-long-does-it-take-to-rank/
- Ahrefs, biggest traffic losers (2024-09-09): https://ahrefs.com/blog/biggest-traffic-losers/
- Originality.ai, March 2024 manual actions: https://originality.ai/blog/google-march-2024-manual-action-ai-update-list
- Whitespark 2026 Local Search Ranking Factors (2025-11-06): https://whitespark.ca/local-search-ranking-factors/
- Orbit Media blogger survey (2026): https://www.orbitmedia.com/blog/blogging-statistics/
- Terakeet SERP composition (Q1 2025): https://engineering.terakeet.com/posts/serp-composition/
- Peec AI, GPT-5.6 product pages vs listicles (Aug 2026): https://docs.peec.ai/research/gpt-56-product-pages-vs-listicles
- Raptive, August 2025 spam update (seen in search results): https://raptive.com/blog/heres-what-we-learned-from-googles-august-2025-spam-update/
- NN/g, show prices for common scenarios (2006): https://www.nngroup.com/articles/show-prices-for-common-scenarios/
- Gartner press release 2025-06-25 (seen in search results, 403 on open): https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-sales-survey-finds-61-percent-of-b2b-buyers-prefer-a-rep-free-buying-experience
- CNET corrections (CNN, Jan 2023; seen in search results): https://edition.cnn.com/2023/01/25/tech/cnet-ai-tool-news-stories
- Sports Illustrated / AdVon (CS Monitor, Nov 2023; seen in search results): https://csmonitor.com/Business/2023/1129/Sports-Illustrated-is-latest-media-to-feel-the-pull-and-sting-of-AI

LLM-judge and text-quality research
- Zheng et al. 2023, MT-Bench: https://arxiv.org/abs/2306.05685
- Panickssery et al. 2024, self-preference: https://arxiv.org/abs/2404.13076
- Marioriyad et al. 2025, The Silent Judge: https://arxiv.org/abs/2509.26072
- Chen et al. 2026, LongJudgeBench: https://arxiv.org/abs/2606.01629
- Shaib et al. 2025, Measuring AI slop: https://arxiv.org/html/2509.19163v2
