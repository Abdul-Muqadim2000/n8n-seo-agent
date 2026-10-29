# R2: What makes a new page rank fast and well, and get cited by AI (evidence, October 2026)

Date: 2026-10-29. Scope: the ranking and AI-citation evidence behind the page generator (blog guides, service pages, location pages,
comparison pages, hubs, case studies, AI answer pages, refreshes). Trigger: the techand.ai "ms 365 erp" service page (production
executions 3299 and 3336) that our app graded 92 then 100 "Ready to publish" while the client's reviewer scored it 63/100.

This extends, and does not repeat, `docs/content-quality-2026-10-27/R2_MARKET_RESEARCH.md` §3 (Google's AI-content guidance, word
count, content-score correlations, the GEO paper, title and meta rewrite rates, liability for invented facts). Where that file
already covers a point it is cited as "R2-10-27 §x" and only new evidence is added here.

**Method.** Every source below was opened (Google and Bing pages, the study pages themselves, arXiv). Two sites refused automated
reads (searchengineland.com behind Cloudflare, and one Google blog page rendered only through curl); where a claim rests on a
secondary write-up, that is said. Nothing was paid for, no client page text is reproduced beyond a few words, no code was changed.

**Labels** (same as R2-10-27): **[doc]** a search engine's or AI vendor's own documentation or on-record statement (describes what
the engine says it does); **[evidence]** a primary study with its method published (peer-reviewed, a court record, or a dataset study,
including vendor-run datasets that disclose method and sample); **[vendor claim]** marketing numbers or self-run studies without a
usable method; **[thin]** secondhand, inferred, or not verifiable.

**Evidence grade** (added in this file, for how much weight a rule can put on it):
- **A**: the engine's own documentation or statement, or a controlled / peer-reviewed experiment.
- **B**: a large dataset (roughly 100k+ pages or queries) with disclosed method; correlational unless stated.
- **C**: small samples, agency case data, expert surveys, single uncontrolled experiments.
- **D**: unverified, inferred from names (for example the 2024 leak), or contradicted by other evidence.

---

## 0. Summary for the plan

1. **For a small or mid-authority site, the fastest wins are almost never brand-new pages on new keywords.** Only 1.74% of a random
   1M new URLs reached Google's top 10 within a year (6.11% of non-empty English pages), and 72.9% of top-10 pages are over three
   years old (Ahrefs, May 2025) [evidence, B]. Refreshing a page that already earns impressions moved service pages from an average
   position of 41 to 23 in 90 days against untouched controls that fell (Workshop Digital, 95 pages) [evidence, C]. The plan
   should rank "improve the page that already ranks" above "write a new one" whenever both serve the search.
2. **The page type must match what Google already shows for the search.** Google's systems and raters judge whether a result meets
   the need behind the query; a service page aimed at a search Google answers with explainers is the wrong document, however well
   written. This is exactly the client reviewer's "fit with what ranks 8/20". The evidence here is Google's own framing plus
   practitioner method, not a measured effect size [doc, A for the principle; thin for any percentage].
3. **One search, one page.** Google says pages are not duplicates "just because they happen to appear in the same search results
   page" but advises "Reduce unnecessary duplication and spend your energy on a fantastic page" (Mueller, Sept 2025) [doc, A]; it
   generally shows at most two results per site and dedupes near-identical pages [doc, A]. A new page for a search the site
   already serves splits effort; the page run's own blocker (an existing page for the same search) was right and was dropped.
4. **What ranks and what gets cited overlap less than in 2025.** Only about 38% of AI Overview citations now rank in the top 10 for
   the same query (Ahrefs, March 2026, 863k SERPs), down from 76% in July 2025 [evidence, B]; Google confirms AI Overviews and AI Mode
   "may use a query fan-out technique" [doc, A]. Being the clearest, best-sourced answer to the sub-questions of a topic now matters
   as much as ranking for the head term.
5. **For AI citation, on-page levers are modest and off-page reputation dominates.** Branded web mentions correlate 0.66 to 0.71
   with brand visibility in ChatGPT, AI Mode and AI Overviews, Domain Rating only 0.27 to 0.33 (Ahrefs, 75k brands, Dec 2025)
   [evidence, B]; AI engines show an "overwhelming bias towards Earned media" (Chen et al., arXiv 2509.08919) [evidence, B/C]. On
   the page: clear summaries, Q&A sections, section structure and expertise signals correlate with citation (Semrush, 304k cited
   URLs) [evidence, B]; adding schema produced no citation lift in a difference-in-differences test (Ahrefs, May 2026) [evidence, B].
6. **What gets AI-written pages demoted is lack of added value at scale, not AI itself.** Ahrefs found AI share and rank uncorrelated
   (r = 0.011, 600k pages) [evidence, B]; SE Ranking's 2,000 unedited AI articles on new domains were indexed (71%), earned
   impressions, then all dropped out of the top 100 on 3 Feb 2025 and never returned [evidence, C]. Google's generative-AI page,
   updated 2026-10-01, says to "manually factcheck and review all AI-generated content", including the meta description [doc, A].
   Repeating a phrase "so often that it sounds unnatural" is listed as keyword stuffing in the spam policies [doc, A].
7. **Google's 2026 updates rewarded first-party, official and brand-owned sources** and hit aggregators and UGC (Amsive, 2,076
   domains, March 2026 core update; SISTRIX Germany 134 losers vs 32 winners) [evidence, B/C]. For our customers (service businesses)
   this is good news: pages that carry the business's own first-hand knowledge, process and proof are what the systems favour;
   commodity explainers that summarise other sites are what they demote.

The 15 rules for the page generator are in §8, each with its source and grade.

---

## 1. The landscape in October 2026 (what changed since the 2026-10-27 research)

**Ranking updates (Google Search Status Dashboard, read 2026-10-29)** [doc, A]:

| Update | Start | End |
|---|---|---|
| March 2025 core | 13 Mar 2025 | 26 Mar 2025 |
| June 2025 core | 30 Jun 2025 | 16 Jul 2025 |
| August 2025 spam | 26 Aug 2025 | 21 Sep 2025 |
| December 2025 core | 11 Dec 2025 | 29 Dec 2025 |
| February 2026 Discover core | 5 Feb 2026 | 26 Feb 2026 |
| March 2026 spam | 24 Mar 2026 | 25 Mar 2026 |
| March 2026 core | 27 Mar 2026 | 8 Apr 2026 |
| May 2026 core | 21 May 2026 | 1 Jun 2026 |
| June 2026 spam | 24 Jun 2026 | 26 Jun 2026 |
| August 2026 spam | 18 Aug 2026 | 20 Aug 2026 |
| September 2026 spam | 24 Sep 2026 | about 7-8 Oct 2026 |

Four spam updates in 2026 so far. Google said the June and August 2026 spam updates did not target link spam or site reputation abuse
(secondary reporting of Google's statement, SERoundtable / relevantaudience) [thin]. The September 2026 one was called a normal spam
update with no new policy [thin, secondary]. No core-update blog posts were published for March or May 2026 [thin, secondary].

**Guidance pages touched recently** [doc, A]:
- *Using generative AI content*: last updated **2026-10-01**. "It is critical to manually factcheck and review all AI-generated
  content for accuracy and trustworthiness before publishing"; "generative models don't retrieve facts, but predict a likely sequence
  of words"; the review "also applies to metadata like `<title>` elements, meta description elements, structured data, and alternate
  texts for images"; generating "many pages without adding value for users" may violate the scaled content abuse policy.
- *Creating helpful, reliable, people-first content*: last updated **2026-10-05** (what changed was not identified; the questions
  read on 2026-10-29 are quoted in §3).
- *Spam policies*: last updated **2026-08-28** (scaled content abuse, site reputation, expired domains, doorways, keyword stuffing
  wording in §6).
- *AI features and your website* and the *ranking systems guide*: last updated **2025-12-10**.
- *Sitemaps* 2026-07-08, *Consolidate duplicate URLs* 2026-07-10, *Snippets / meta description* 2026-04-20.

**Bing** rewrote its Webmaster Guidelines (reported 2026-02-27) to cover Copilot and grounding: "Large-scale content generated
without oversight, quality control, or editorial review" may be excluded from indexing; keyword stuffing became "Keyword Stuffing and
Artificially Engineered Language", covering text designed to trigger AI citations; grounding advice is to state facts directly, keep
entity names consistent and focus each URL on a single topic (Search Engine Journal's reading of the guidelines) [doc via secondary, A/B].

**Google on writing for LLMs.** On Search Off the Record (8 Jan 2026), Danny Sullivan on "bite-sized chunks" for LLMs: "So we don't
want you to do that", after checking with engineers; systems improve "to reward content written for humans" (PPC Land transcript
reading) [doc, A]. Mueller (June 2025): "no AI system currently uses llms.txt"; the AI features page says no special files or
schema are needed [doc, A].

---

## 2. Question 1: which page and keyword choices rank fastest for a small or mid-authority site

### 2.1 What the data says about new pages

- **Ahrefs, "How long does it take to rank" (Patrick Stox, 15 May 2025)** [evidence, B]: 1M random URLs first seen Sept 2023; 1.74%
  reached the top 10 within a year (5.7% in 2017). On 2M non-empty English URLs, 6.11%. Of the pages that did reach the top 10,
  **40.82% did so within one month**. Higher-volume terms take longer, lower-volume terms spread more evenly; "94% of the pages
  never actually ranked for high volume keywords at all". 72.9% of top-10 pages are over three years old (59% in 2017); 13.7% are
  under a year old; the average #1 page is five years old. After about six months without a top-10 position, chances are "pretty
  low after that unless you make some changes".
  *Reading for us:* a new page either shows early movement within weeks or usually never makes it; a page that matches demand the
  site can win shows impressions within the first month. Use 30 and 90 days as check points, not "wait a year".
- **SE Ranking, March 2026 core update (100k keywords, 20 niches, New York)** [evidence, B]: 24.1% of top-10 pages left the top 100
  (14.7% after December 2025); 29.7% of the new top-3 URLs had been outside the top 20; domains 15+ years old held 57% of top-10
  slots, domains under a year 0.7%. Big movements happen, but new domains almost never benefit.

### 2.2 Refresh an existing page vs write a new one

- **Workshop Digital, 273 content events, Jan 2024 to mid-2026, 90 days before vs after, untouched control pages** [evidence, C]:
  95 refreshed pages went from 610 to 3,341 organic sessions while controls fell 20.2%. Refreshed **service pages** moved from an
  average position of 41.26 to 23.29 (controls fell 33.4%); blog refreshes moved 43.78 to 38.07. What was done: tighter topical
  focus and merged overlapping ideas, updated statistics and examples, clearer headings and answers near the top, better internal
  links, filler removed, structured data fixed. Caveats: one agency's clients, no significance tests, net-new results not given in
  numbers, near-zero baselines inflate percentages.
- **Seer Interactive, 24 Jul 2026 (7,683 dated pages, 47,097 citations, ChatGPT / Gemini / Perplexity, Mar-Jun 2026)** [evidence, B/C]:
  72% of cited pages were updated within a year but only 42% were first published within a year; more than a quarter of "fresh"
  cited pages were old pages that had been refreshed. Correlational; only two thirds of pages could be dated; four brands.
- **Google** [doc, A]: core-update recovery "could take several months" for systems to learn; "some changes can take effect in a
  few days". Changing dates or adding and removing content just to seem fresh: "(No, it won't)" help.
- The widely quoted "refreshes +268% vs new +22%" figure traces to one agency case study; not used here [thin].

**Conclusion.** When the site already has a page receiving impressions for the search (or its close variants), improving that page
is the faster and safer path. A new page is right when no page on the site serves the intent, and the intent fits the site.

### 2.3 Striking distance

No rigorous study of "positions 11-20 move fastest" was found [thin]. What exists: the Workshop Digital refresh data above (pages
starting around positions 40), Ahrefs' six-month rule, and CTR-curve models. Practitioner consensus (positions about 4-20 with real
impressions are the best refresh targets) is reasonable but should be treated as our heuristic, measured on our own clients'
Search Console data, not as established fact. We already read Search Console query data per site (`_gsc_queries.js`); the evidence
supports using it to choose *which page to improve* before choosing *which page to write*.

### 2.4 Intent and page type

- **Google's framing** [doc, A]: the ranking systems guide describes systems that match concepts in queries to pages (neural
  matching, RankBrain, passage ranking) and dedupe near-identical results; the quality rater guidelines rate results by how well
  they meet the need behind the query, and the September 2025 rater update added AI Overview examples and widened YMYL to
  "Government, Civics & Society" (Search Engine Land coverage, page blocked to our reader; the Google PDF was not opened) [doc via
  secondary].
- **Measured effect sizes for "format mismatch" do not exist publicly** [thin]. Ahrefs' own method is to read the dominant content
  type of the top results (blog post vs product page vs category page) and match it [vendor, method only]. Numbers such as "match
  60-70% of the top 10" circulate without a source [thin].
- **For local service businesses**, Whitespark's 2026 Local Search Ranking Factors (47 experts, 187 factors, published 6 Nov 2025)
  puts "Dedicated Page for Each Service" first for local organic and second for AI search visibility, and "Website's Degree of Focus
  on a Specific Niche" ninth [evidence, C: expert survey].

*Reading for the ms 365 erp case:* the search returns explainers, monthly demand is about 10 to 100, the site already has a
Business Central service page for the same buyer, and our own verdict scored it 42. Every one of those is a "do not write a new
service page for this" signal. The right outputs were (a) a refresh of the existing service page with an answer section for the
question, or (b) an explainer on the blog if no existing post covered it, linking to the service page.

### 2.5 Topical focus and clusters

- Google warns against "producing lots of content on many different topics in hopes that some of it might perform well" and
  entering "some niche topic area without any real expertise" [doc, A].
- Graphite (Jan 2024, 332 URLs, 12 client domains, proprietary Topical Authority score): higher-score pages reached first
  impressions and clicks faster; numbers only in charts, vendor-run, small [evidence, C].
- Whitespark: niche focus ninth for local organic, ninth for AI visibility [evidence, C].
- The 2024 Content Warehouse leak names attributes such as `siteFocusScore` and `siteRadius`; Google confirmed the documents but
  warned against "out-of-context, outdated, or incomplete information"; weights and use are unknown [thin, D].
- Figures like "clusters rank 3.7x faster" have no traceable source [thin, D].

**Conclusion.** Write inside the topics the site already demonstrates (its services, its market) and link pages into clusters. Our
existing topic-radius and fit-gate machinery points the right way; the evidence is directional (grade C), so use it as a gate on
clearly off-topic pages, not as a precise score.

### 2.6 Where clicks still are (choosing between informational and commercial pages)

- **Pew Research (22 Jul 2025, 900 US adults, 68,879 searches)** [evidence, B]: with an AI summary users clicked a result 8% of the
  time vs 15% without; 1% clicked a link inside the summary. Summaries appeared on 8% of 1-2 word searches, 53% of 10+ word
  searches and 60% of searches starting with who / what / when / why. .gov sources were 6% of summary citations vs 2% of results.
- **Ahrefs (Feb 2026 update, 300k keywords, Dec 2025 data)** [evidence, B]: AI Overviews correlate with a 58% lower CTR for the
  position-1 result (34.5% in the April 2025 version).
- **Seer Interactive (2025-2026, 53 brands)**: informational organic CTR with AI Overviews fell sharply, with a partial rebound by
  early 2026 (figures read only in secondary summaries) [thin].

*Reading:* long question-style informational searches lose most of their clicks to AI answers; the value of an explainer is
increasingly the citation and the brand exposure, while service, comparison and local pages still carry the clicks that convert.
For a service business the plan should weight service, location and comparison pages, and write explainers that answer the
sub-questions AI engines fan out to, with the business's own first-hand content.

---

## 3. Question 2: on-page properties that correlate with ranking and AI citation, and the myths

### 3.1 What Google says the page must do [doc, A]

From *Creating helpful content* (read 2026-10-29): "Does the content provide original information, reporting, research, or
analysis?"; "insightful analysis or interesting information that is beyond the obvious?"; does it avoid "simply copying or
rewriting those sources"; "Does the main heading or page title provide a descriptive, helpful summary of the content?"; "Does the
content have any easily-verified factual errors?"; is it "written or reviewed by an expert or enthusiast who demonstrably knows the
topic well?"; warning signs include "mainly summarizing what others have to say without adding much value" and leaving readers
"feeling like they need to search again". Who / How / Why: authorship self-evident; "AI or automation disclosures are useful for
content where someone might think 'How was this created?'"; "why" is "perhaps the most important question". Trust is the most
important E-E-A-T aspect (R2-10-27 §3.1).

From *Top ways to ensure your content performs well in Google's AI experiences* (Mueller, 21 May 2025): "Focus on making unique,
non-commodity content"; good page experience ("visitors can easily distinguish main content from other content"); technical access
(Googlebot not blocked, HTTP 200, indexable content); preview controls; structured data that matches visible content; images and
video; AI-Overview clicks "are higher quality".

From the *ranking systems guide*: "original content systems" favour original reporting over pages that merely cite it; the
"reviews system" rewards insightful analysis and original research; "reliable information systems" surface authoritative pages.

From *Write high quality reviews* (applies to comparison pages): provide "evidence such as visuals, audio, or other links of your
own experience"; "quantitative measurements"; explain "what sets something apart"; "benefits and drawbacks ... based on your own
original research".

### 3.2 What Bing says helps inclusion in AI answers [doc, A]

Krishna Madhavan (Bing), 8 Oct 2025: there is "no secret strategy"; align title, H1 and description ("Consistent alignment between
title, H1, and description improves both discoverability and confidence signals"); descriptive H2/H3 headings as "chapter titles";
direct questions with short clear answers; one or two sentence answers that stay self-contained out of context; lists and tables
for steps and comparisons; "replace vague claims with measurable facts"; avoid "next-gen" style unanchored claims; do not hide key
answers in tabs or expandable menus, in PDFs or in images; keep crawlability, internal links and backlinks in place.

### 3.3 Dataset evidence on AI citation

| Finding | Source | Label / grade |
|---|---|---|
| Cited vs top-20 pages: clarity and summarization +32.8%, E-E-A-T signals +30.6%, Q&A format +25.5%, section structure +22.9%, structured data elements +21.6%; 7 of 13 parameters showed little or no association; "non-promotional tone" -26.2% (authors say confounded by professional copy) | Semrush, 14 Jan 2026; 11,882 prompts, 304,805 cited URLs vs 921,614 ranking URLs, ChatGPT Search / AI Mode / Perplexity, Jul-Aug 2025 | [evidence, B]; correlational, visible text only |
| LLM engines cite less popular domains than Google / Bing; cited pages more readable (Flesch 24.2 vs 12.3), link out more (outlinks second most important feature), slightly more semantic HTML | Zhang et al., arXiv 2512.09483, Dec 2025; 55,936 queries, 6 LLM engines + Google + Bing, 1.42M citation links | [evidence, B] |
| Cite sources, add quotations, add statistics: +30-40% visibility in generated answers; keyword stuffing no gain or worse | Aggarwal et al., GEO, KDD 2024 (R2-10-27 §3.4) | [evidence, A/B; lab setting] |
| AI search shows an "overwhelming bias towards Earned media" over brand-owned and social; engines differ in freshness and diversity; "big brand bias" | Chen et al., arXiv 2509.08919, Sept 2025 | [evidence, B/C]; abstract-level, no numbers on the abstract page |
| Branded web mentions 0.66-0.71, YouTube mentions about 0.74, branded anchors 0.51-0.63, DR 0.27-0.33, number of site pages 0.19 | Ahrefs, 12 Dec 2025; 75k brands, DR > 40 | [evidence, B]; correlational, big sites only |
| AI assistants cite pages about 25.7% "fresher" than organic results (1,064 vs 1,432 days); ChatGPT the most freshness-biased; AI Overviews about the same as organic | Ahrefs, 28 Jul 2025; about 17M citations | [evidence, B] |
| AI Mode cited fragments: no relationship with vertical position on the page; a recurring pattern of descriptive subheading followed by a clear opening sentence | SALT.agency, Dec 2025; 2,318 URLs (read via secondary write-ups) | [evidence, C; thin on details] |
| Adding JSON-LD: AI Overviews -4.6% (significant, not attributed), AI Mode +2.4% and ChatGPT +2.2% (not distinguishable from zero) vs matched controls | Ahrefs, 11 May 2026; 1,885 treated + about 4,000 control pages, difference-in-differences | [evidence, B] |
| 38% of AI Overview citations rank in the top 10 for the same query (31% at 11-100, 31% outside the top 100); fan-out is the likely cause | Ahrefs, 2 Mar 2026; 863k SERPs, 4M AIO URLs | [evidence, B] |
| ChatGPT / Gemini / Copilot citations: about 12% rank in Google's top 10 for the original prompt; Perplexity 28.6% | Ahrefs, 11 Aug 2025; 15,000 long-tail prompts | [evidence, B]; long-tail only |

### 3.4 Myths (do not build features for these)

| Belief | What the evidence says | Source |
|---|---|---|
| Longer pages rank better / get cited more | Google: no preferred word count; AIO citation vs length Spearman 0.04 | [doc, A]; Ahrefs (R2-10-27 §3.2) [evidence, B] |
| Hitting a content-score / term-frequency target ranks a page | Correlations 0.17-0.30, circular, gameable | R2-10-27 §3.3 [evidence, B] |
| Schema markup gets you cited by AI | No lift in a controlled test; Google says no special schema needed | Ahrefs May 2026 [evidence, B]; AI features page [doc, A] |
| llms.txt helps AI visibility | "no AI system currently uses llms.txt" | Mueller, June 2025 [doc, A] |
| Write separate bite-sized chunks for LLMs | Google: "we don't want you to do that" | Sullivan, Jan 2026 [doc, A] |
| AI-written content is penalised as such | AI share vs rank r = 0.011; Google judges value, not method | Ahrefs Jul 2025 [evidence, B]; Google 2023 / 2026 [doc, A] |
| Bumping the date makes a page fresh | Google: "(No, it won't)"; dates must describe the page's real update | helpful content, publication dates pages [doc, A] |
| "Information gain" is a confirmed ranking signal | Patent exists, never confirmed; On-Page.ai found no originality difference between cited and uncited | R2-10-27 §3.4 [thin] |
| Heading order or keyword in the URL matters | "doesn't matter" / "hardly any effect" | SEO Starter Guide, R2-10-27 §3.1 [doc, A] |
| An answer must sit in the first lines of the page to be cited | Conflicting: SALT found no position effect; a "44% from the first 30% of a page" figure circulates but its source was not found | [thin] |

What is not a myth: an answer stated plainly near the heading that asks it (Bing, SALT, Semrush clarity), descriptive headings,
sourced facts and numbers, readable sentences, visible authorship and real proof.

---

## 4. Question 3: time-to-rank data

| Measure | Value | Source |
|---|---|---|
| Discovery and crawl of a new URL | "a few days to a few weeks"; requesting a recrawl repeatedly "won't get it crawled any faster" | Google, recrawl page, 2025-12-10 [doc, A] |
| Indexing of brand-new AI sites | 70.95% of 2,000 pages indexed within 36 days | SE Ranking, Aug 2025 [evidence, C] |
| New URLs reaching top 10 within a year | 1.74% (all), 6.11% (non-empty English) | Ahrefs, May 2025 [evidence, B] |
| Of those, reaching top 10 within a month | 40.82% | Ahrefs, May 2025 [evidence, B] |
| When to act on a page not in the top 10 | about 6 months | Ahrefs, May 2025 [evidence, B, author judgement] |
| Refresh effect window | measurable within 90 days vs controls | Workshop Digital [evidence, C] |
| Site-level reassessment after quality changes | "several months"; sometimes the next core update | Google, core updates page [doc, A] |
| Unedited AI content on new domains | impressions for about 3 months, then all out of the top 100 | SE Ranking [evidence, C] |
| Age of top-10 pages | 72.9% over 3 years; average #1 is 5 years old | Ahrefs, May 2025 [evidence, B] |

**Operational reading.** Our reports should state expectations in these terms: a new page is indexed within days to weeks; if it is
going to rank it usually shows impressions in the first month; a judgement at 90 days (with the site's other pages as a control, as
the Link Builder impact model already does) is fair; at six months without top-10 movement the page needs a real improvement or a
merge. Promising "page one in N weeks" for a new page on a competitive search is not supported by any data.

---

## 5. Question 4: cannibalisation and duplicate-intent pages

- **Google's position** [doc, A]: Mueller (22 Sept 2025, SEJ): "IMO it's not really 'cannibalization' if it's theoretical";
  several pages in one result "doesn't seem problematic to me just because it's 'more than 1'"; "pages aren't duplicates just because
  they happen to appear in the same search results page"; and "Reduce unnecessary duplication and spend your energy on a fantastic
  page, sure." Earlier (2018 AMA, secondhand): pages targeting the same keywords but different intents are not cannibalisation [thin].
- **Mechanics** [doc, A]: the site diversity system "generally limits top results to two listings from one site"; deduplication
  systems show "only the most relevant of many near-identical results"; for near-duplicates Google picks a canonical itself, and a
  declared canonical is ignored if the pages are not similar; redirects and `rel=canonical` are strong signals, sitemap inclusion weak
  (consolidate-duplicate-URLs page, 2026-07-10). Page Indexing statuses "Duplicate without user-selected canonical" and "Google chose
  different canonical" mean one of the pages will not be served.
- **Doorways** [doc, A]: "Creating substantially similar pages that are closer to search results than a clearly defined, browseable
  hierarchy" and "multiple ... pages targeted at specific regions or cities that funnel users to one page" are doorway abuse. This is
  the line for location pages: each must carry genuinely local content (address, service area facts, local regulations, local
  proof), not a city name swapped into a template.
- **Practice evidence**: Workshop Digital's best refresh actions included "consolidating overlapping ideas" [evidence, C].

**What counts as the same intent (our operational definition, to be measured):** the site already has a URL that (a) receives
Search Console impressions for the target query or a close variant, or (b) shares a large part of its top results with the target
query (our ladder already clusters by shared top-7 URLs at 40%), and (c) is the same page type for the same buyer. When all three
hold, the generator should improve that page, or ask, never silently write a second one. This is what the page run's blocker detected
on 2026-10-28 and what Finalize then discarded.

---

## 6. Question 5: internal linking and indexing speed

### 6.1 Internal links

- **Google** [doc, A] (links page, 2025-12-10): "Every page you care about should have a link from at least one other page on your
  site"; "link to those pages in context"; "There's no magical ideal number of links"; anchor text should be "descriptive,
  reasonably concise, and relevant"; read the anchor alone to test it; "resist the urge to cram every keyword". The AI features page
  lists "Making your content easily findable through internal links on your website" as a best practice for AI Overviews and AI Mode.
- **Zyppy (updated 23 Feb 2026; 23M internal links, 1,800 sites, 520k URLs, joined to Search Console clicks)** [evidence, B,
  correlational]: URLs with 0-4 internal links averaged 2 clicks, 40-44 links about 4x that, with a decline past about 45-50 (mostly
  sitewide navigation); more anchor-text variety correlated with more clicks; pages with at least one exact-match internal anchor had
  "at least five times more traffic". The authors call it "directionally useful", not proof.
- **Whitespark**: "Internal Linking Across Entire Website" sixth for local organic [evidence, C].

**Reading.** A new page should be linked from the hub and from two or more topically related existing pages, in body text, with
descriptive anchors that vary naturally and include the page's main term at least once; it should link out to the relevant service
page and to its primary sources (LLM-cited pages link out more: Zhang et al.).

### 6.2 Getting crawled and indexed

- **Sitemaps** [doc, A] (2026-07-08): "Google uses the `<lastmod>` value if it's consistently and verifiably" accurate; it should be
  the last *significant* update; "Google ignores `<priority>` and `<changefreq>`"; a sitemap is "merely a hint". The ping endpoint
  was retired in 2023.
- **URL Inspection** [doc, A]: request indexing for individual URLs, subject to a quota; repeat requests do not help; "Crawling can
  take anywhere from a few days to a few weeks."
- **"Crawled - currently not indexed"** [doc, A]: "may or may not be indexed in the future", "no need to resubmit". Practitioners
  link it mostly to quality or duplication (Marie Haynes: "in almost every case ... these pages have quality issues") [thin, C].
- **IndexNow** [doc, A]: endpoints for Amazon, Bing, Naver, Seznam, Yandex and Yep; Google is not listed; "Submitting a URL does
  not guarantee immediate indexing". Useful for Bing, and therefore for Copilot and Bing-grounded answers, not for Google.
- **ChatGPT search** [doc, A]: "Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers"; OpenAI
  recommends allowing it. Its documentation does not say whether ChatGPT search uses Bing (unchanged from our 2026-10-15 finding).
- **Google AI features** [doc, A]: allow crawling "in robots.txt, and by any CDN or hosting infrastructure"; "important content is
  available in textual form"; structured data must match visible text.
- **Bing** [doc, A]: key content not in tabs, accordions, PDFs or images.

**Reading.** Our Growth workflow already submits IndexNow and Bing URL batches and checks crawler access; the page flow should add,
per published page: an accurate `lastmod`, links from existing pages at publish time, one URL Inspection request (manual step for the
client or via an owner-approved tool; the Indexing API is officially only for job postings and livestreams, so it must not be used for
normal pages), and a 7-day and 30-day indexing check.

---

## 7. Question 6: what gets AI-written pages demoted

| Pattern | Evidence | Label / grade |
|---|---|---|
| Many pages generated "without adding value for users" | Spam policy, scaled content abuse; first example is generative AI; also "Stitching or combining content from different web pages without adding value" | [doc, A] |
| AI main content with "little to no effort, little to no originality, and little to no added value" | Quality rater guidelines Jan 2025, rated Lowest; "filler" content section added | [doc via secondary, A] |
| No human factcheck, including metadata | Generative-AI page 2026-10-01 | [doc, A] |
| Repetition | Spam policy: "Repeating the same words or phrases so often that it sounds unnatural"; Bing "Artificially Engineered Language" | [doc, A] |
| Commodity summaries | Helpful content: "mainly summarizing what others have to say without adding much value"; May 2025 AI post: "unique, non-commodity content" | [doc, A] |
| Off-topic expansion | Helpful content: "many different topics", "niche topic area without any real expertise" | [doc, A] |
| Fake freshness | Helpful content date questions; publication-dates rules | [doc, A] |
| City pages that differ only by the name | Doorway abuse examples | [doc, A] |
| Unedited AI at volume on weak domains | SE Ranking: indexed, then gone at about 3 months | [evidence, C] |
| Aggregator-style and UGC pages vs first-party sources | Amsive (Lily Ray, 30 Apr 2026, 2,076 domains): "a first-party, official-source correction", gains to the "company that owns the thing"; SISTRIX Germany (10 Apr 2026): 4 losers per winner, official and brand sites up | [evidence, B/C]; SISTRIX measures keyword visibility, not traffic |
| "Unreviewed AI content lost 60-80%" in March 2026 | Circulates without a primary source | [thin, D] |

What the evidence does **not** show: that AI assistance itself is demoted (Ahrefs r = 0.011; 86.5% of top-20 pages contain some AI
text; #1 pages "tend to have slightly less") [evidence, B]. The line is value added, accuracy and human review.

**Mapping to the 2026-10-28 incident.** Six "Microsoft 365 is not an ERP" statements (repetition), two different "five questions"
lists and padding sections (filler), weak secondary sources while no Ministry of Finance source was used (reliability, YMYL-adjacent
regulatory facts), a homepage slogan offered as proof (no first-hand evidence), a 20-character meta description (metadata not
reviewed), and a second page for a search the site already serves (duplication). Each is named in Google's or Bing's own guidance as
a quality or spam signal, and none was counted in our grade.

---

## 8. The 15 rules a page generator must follow

Each rule: what the generator must do, the source, the grade, and (in italics) how the 2026-10-28 incident broke it. "Gate" means
the page must not be marked ready while the rule fails; "ask" means the client decides; thresholds marked *our choice* are design
choices to be calibrated on our own data, not evidence.

1. **One intent, one URL.** Before writing, look for an existing page on the site that already serves the search (Search Console
   impressions for the query or close variants, shared top results, same page type). If one exists, improve it, or ask; never write a
   second page silently. Gate.
   Source: Mueller, SEJ 22 Sept 2025; site diversity and deduplication systems; consolidate-duplicate-URLs page [doc, A].
   *The page run found /dynamics-365-business-central-uae; Finalize dropped the blocker.*

2. **Write the page type that the search already rewards.** Classify the top 10 for the target (service or product page, explainer,
   list or comparison, local page, tool) and write that type, or change the keyword. A service page for an explainer search is a
   wrong document. Gate when the requested type matches less than *our choice* of about a third of the top 10.
   Source: ranking systems guide and rater guidelines on meeting the need [doc, A]; method per Ahrefs [vendor]; effect size [thin].
   *Google shows explainers for "ms 365 erp"; we wrote a service page.*

3. **Spend effort where the site can win.** Prefer improving pages that already earn impressions (striking distance, *our choice*
   positions about 4-20) and specific lower-volume searches inside the site's topics over head terms; when the keyword verdict says
   the search is not worth a page (score under 50, or "poor use of effort"), stop and ask before writing. Ask.
   Source: Ahrefs time-to-rank May 2025 [evidence, B]; Workshop Digital refreshes [evidence, C]; Google core updates page on months
   to reassess [doc, A].
   *Verdict 42/100 and about 10 searches a month; the page was written anyway.*

4. **Stay inside the site's topics and connect pages into clusters.** Refuse topics the business cannot speak to from experience;
   every new page joins a hub with links both ways.
   Source: helpful content "many different topics" and "without any real expertise" [doc, A]; Whitespark niche focus [evidence, C];
   Graphite [evidence, C]; leak attributes [thin].

5. **Add what the top results do not have.** Each page must carry first-party material: the business's own process, numbers,
   prices or ranges, timelines, examples, constraints, local rules and an honest comparison. A summary of other pages is not a page.
   Source: helpful content "original information ... beyond the obvious" [doc, A]; May 2025 "unique, non-commodity content" [doc, A];
   original content and reviews systems [doc, A]; Amsive first-party pattern [evidence, B/C].

6. **Every factual claim verified against a primary or official source, with local regulation researched for the page's market.**
   Dates, thresholds and legal requirements come from the regulator (for UAE e-invoicing, the Ministry of Finance / FTA), not from a
   vendor blog. Research must include the market's regulatory calendar and the client's own site, not only the keyword's results
   page. Gate on any unverified figure or date.
   Source: generative-AI page 2026-10-01 "manually factcheck" [doc, A]; reliable information systems [doc, A]; rater YMYL scope
   "Government, Civics & Society" [doc via secondary]; GEO "cite sources" [evidence, A/B]; Pew .gov share of AI citations [evidence, B].
   *The 1 Jan 2027 go-live for revenue of AED 50m or more was missed; Visionet and Landbase stayed as sources.*

7. **Answer first, under headings that say what they answer, written for people.** Each question-style heading is followed by a
   direct, self-contained one or two sentence answer, then the detail; lists and tables for steps and comparisons; plain readable
   sentences; key content in HTML text, not tabs, images or PDFs. Do not produce a separate "LLM version" or artificially chopped
   chunks.
   Source: Bing 8 Oct 2025 [doc, A]; Sullivan Jan 2026 [doc, A]; Semrush clarity / Q&A / structure [evidence, B]; Zhang et al.
   readability [evidence, B]; SALT [evidence, C].

8. **Say each thing once; no filler.** Count repeated claims and near-duplicate sections and lists; cut sections that do not serve
   the reader's question. Repetition and filler lower the grade and, past *our choice* of threshold (for example the same claim
   three or more times), block the page.
   Source: spam policy keyword stuffing "Repeating the same words or phrases" [doc, A]; rater guidelines "filler" [doc via secondary];
   Bing "Artificially Engineered Language" [doc, A].
   *"Microsoft 365 is not an ERP" six times; two different "five questions" lists.*

9. **Title, H1 and meta description are accurate, aligned and validated as fields.** Write them from the verified page content;
   check them for truth like body text, but validate them as their own fields (single line, no other field's label inside, no
   placeholder, a sensible length such as *our choice* 70-160 characters for the description, unique on the site). A check may flag or
   regenerate them; it must never blank them or move their text into the body. Gate on a broken description.
   Source: generative-AI page: review "also applies to ... meta description elements" [doc, A]; snippet page: unique, summarising
   descriptions [doc, A]; Bing title / H1 / description alignment [doc, A].
   *The claim rewrite emptied the description, the reader regex then picked up "Slug: ...", and the sentence became a client
   question that Finalize placed in the body.*
   Note for the plan: the owner's instruction "never run the claim check on the meta description" fits this rule if it means the
   body-claim rewriter; Google still expects the description to be fact-checked, so keep a field-level accuracy check.

10. **Proof must be real and specific to the client.** Statements about the client (free consultation, sectors served, results,
    certifications) only from the client's verified facts or answers; slogans, taglines and homepage claims are not proof; when no
    proof exists, write without the claim and ask. Client answers are worked into the sentence they belong to, never appended.
    Source: helpful content "trust is most important" and "easily-verified factual errors" [doc, A]; liability cases and FTC rules
    in R2-10-27 §3.6 [evidence, A]; Bing "replace vague claims with measurable facts" [doc, A].
    *Prefilled proof answer was a homepage slogan; "consultation is free" appended to an unrelated paragraph.*

11. **Show who, how and when, truthfully.** Author or reviewer with real credentials (from the business profile), a visible
    published / updated date consistent with structured data, a short note on how the page was made where a reader might ask, and
    date changes only with substantive edits.
    Source: helpful content Who / How / Why [doc, A]; publication-dates page [doc, A].

12. **Link the page in and out at publish time.** At least the hub and two related existing pages link to the new page in body text
    with descriptive anchors (main term at least once, natural variety); the new page links to the relevant service page and to its
    primary sources; no orphan pages.
    Source: Google links page [doc, A]; AI features page [doc, A]; Zyppy [evidence, B]; Zhang et al. outlinks [evidence, B].

13. **Make the page findable by every engine that matters.** Accurate sitemap `lastmod`; IndexNow / Bing submission; one URL
    Inspection request for the page; robots.txt, CDN and firewall allow Googlebot, Bingbot and OAI-SearchBot; check indexing at 7
    and 30 days and report "crawled, not indexed" as a quality signal, not a resubmit task.
    Source: sitemaps, recrawl and Page Indexing pages [doc, A]; IndexNow FAQ [doc, A]; OpenAI bots page [doc, A]; AI features page [doc, A].

14. **No page ships without human review, and volume follows quality.** The client (or an expert reviewer) approves every page
    before publication with the evidence ledger in front of them; the cadence is capped by what the business can genuinely review and
    support with first-party content, never by keyword count; a "ready" label requires every gate above to pass on the final text,
    including the page run's blockers.
    Source: scaled content abuse policy and generative-AI page [doc, A]; Bing "without oversight, quality control, or editorial
    review" [doc, A]; SE Ranking unedited AI collapse [evidence, C].
    *Finalize graded 100/100 Ready after dropping a blocker; the grade ignored repetition, fit and proof.*

15. **Measure at 30 / 90 / 180 days and maintain.** Report impressions and position against the site's other pages as a control;
    at about six months without top-10 movement, improve or merge the page; keep pages that are cited or ranking updated with real
    changes (new figures, new rules, new examples), because AI engines cite recently maintained pages more often. Do not expect
    schema or llms.txt to move citations.
    Source: Ahrefs time-to-rank [evidence, B]; Seer recency Jul 2026 [evidence, B/C]; Ahrefs freshness Jul 2025 [evidence, B];
    Ahrefs schema DiD May 2026 [evidence, B]; Mueller on llms.txt [doc, A].

**Outside the page (not generator rules, but the plan should say so).** For AI citations the strongest correlates are branded web
mentions, YouTube mentions and presence on expert "best of" lists (Ahrefs 75k brands [evidence, B]; Whitespark AI factors
[evidence, C]; Chen et al. earned-media bias [evidence, B/C]). Our Link Builder and AI Growth earned-media work is where that is won;
a perfect page on a brand nobody mentions will still be cited rarely.

---

## 9. How the rules map onto the reported failures

| Failure (2026-10-28 trace) | Rules | Kind |
|---|---|---|
| 1. Meta description emptied by the claim rewrite, then read as "Slug: ..." | 9 | Gate, field validation |
| 2. Meta sentence turned into a client question and placed in the body | 9, 10 | Gate |
| 3. Finalize dropped the existing-page blocker, graded 100 Ready | 1, 14 | Gate carried to the final version |
| 4. Grade ignored repetition, intent fit, proof, source quality | 2, 6, 8, 10, 14 | Grade components + gates |
| 5. Keyword scored 42 was written anyway | 3 | Ask before writing |
| 6. Answers appended as fragments; slogan as proof | 10 | Gate on placement, proof source |
| 7. Local regulatory dates never researched | 6 | Research step + gate |
| 8. No files on the final version | (delivery, not ranking) | Product fix |

---

## 10. Gaps and caveats

- No public study measures the ranking cost of a page-type mismatch; rule 2's threshold must be calibrated on our own clients'
  Search Console outcomes.
- Striking-distance "quick win" claims are practitioner consensus without a controlled study; rule 3's band is our choice.
- AI-citation datasets are vendor-run (Ahrefs, Semrush, Seer) except the arXiv papers; all are correlational except Ahrefs' schema
  difference-in-differences. Several engines change monthly (Gemini 3 since January 2026 per Ahrefs), so re-check in 2027.
- The quality rater guideline PDFs (January and September 2025) were read only through coverage (Search Engine Land blocks our
  reader); the exact wording of "filler" and the YMYL change should be confirmed from Google's PDF before we quote it to customers.
- The *Creating helpful content* page changed on 2026-10-05; what changed was not identified.
- Market-specific evidence for the UAE and the Gulf (Arabic-language SERPs, local AI Overview coverage) was not found; all datasets
  are US, German or global English.
- Ranking and citation are not the client reviewer's score. The reviewer's rubric (usefulness, fit with what ranks, proof and trust,
  local accuracy, structure, ready to publish) lines up with rules 1-14, which is a good sign, but we have no data yet linking our
  grade to reviewer scores or rankings. The plan should collect that pairing.

---

## Sources (opened 2026-10-29 unless noted)

Google [doc]:
- Using generative AI content (updated 2026-10-01): https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- Creating helpful, reliable, people-first content (updated 2026-10-05): https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Spam policies (updated 2026-08-28): https://developers.google.com/search/docs/essentials/spam-policies
- AI features and your website (2025-12-10): https://developers.google.com/search/docs/appearance/ai-features
- Top ways to ensure your content performs well in Google's AI experiences (21 May 2025): https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search
- Ranking systems guide (2025-12-10): https://developers.google.com/search/docs/appearance/ranking-systems-guide
- Core updates and your site (2025-12-10): https://developers.google.com/search/docs/appearance/core-updates
- Search Status Dashboard, ranking incidents: https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history
- Build a sitemap (2026-07-08): https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Ask Google to recrawl (2025-12-10): https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- Page Indexing report help: https://support.google.com/webmasters/answer/7440203
- Indexing API quickstart ("can only be used to crawl pages with either JobPosting or BroadcastEvent embedded in a VideoObject"): https://developers.google.com/search/apis/indexing-api/v3/quickstart
- Link best practices (2025-12-10): https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Consolidate duplicate URLs (2026-07-10): https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Snippets and meta descriptions (2026-04-20): https://developers.google.com/search/docs/appearance/snippet
- Publication dates (2025-12-10): https://developers.google.com/search/docs/appearance/publication-dates
- Write high quality reviews (2025-12-10): https://developers.google.com/search/docs/specialty/ecommerce/write-high-quality-reviews
- Mueller on cannibalization, SEJ 22 Sept 2025: https://www.searchenginejournal.com/google-answers-seo-question-about-keyword-cannibalization/556472/
- Sullivan on chunking, Search Off the Record 8 Jan 2026 (via PPC Land): https://ppc.land/google-warns-against-breaking-content-into-chunks-for-ai/
- 2024 documentation leak and Google's statement: https://en.wikipedia.org/wiki/2024_Google_Search_documentation_leak

Bing, OpenAI, IndexNow [doc]:
- Optimizing your content for inclusion in AI search answers (8 Oct 2025): https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers
- Bing Webmaster Guidelines rewrite (SEJ, 27 Feb 2026): https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/
- OpenAI crawlers: https://developers.openai.com/api/docs/bots
- IndexNow FAQ: https://www.indexnow.org/faq

Studies [evidence]:
- Ahrefs, time to rank (15 May 2025): https://ahrefs.com/blog/how-long-does-it-take-to-rank/
- Ahrefs, 38% of AIO citations from the top 10 (2 Mar 2026): https://ahrefs.com/blog/ai-overview-citations-top-10/
- Ahrefs, AI search overlap (11 Aug 2025): https://ahrefs.com/blog/ai-search-overlap/
- Ahrefs, freshness of AI citations (28 Jul 2025): https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/
- Ahrefs, brand visibility correlations (12 Dec 2025): https://ahrefs.com/blog/ai-brand-visibility-correlations/
- Ahrefs, schema and AI citations (11 May 2026): https://ahrefs.com/blog/schema-ai-citations/
- Ahrefs, AI content and rankings (7 Jul 2025): https://ahrefs.com/blog/ai-generated-content-does-not-hurt-your-google-rankings/
- Ahrefs, AI Overviews reduce clicks, update (Feb 2026; read via search result summaries): https://ahrefs.com/blog/ai-overviews-reduce-clicks-update
- Semrush, content features and AI citation (14 Jan 2026): https://www.semrush.com/blog/content-optimization-ai-search-study
- Pew Research Center, AI summaries and clicks (22 Jul 2025): https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/
- Seer Interactive, content recency and AI visibility (24 Jul 2026): https://www.seerinteractive.com/insights/study-content-recencys-impact-on-ai-visibility-in-2026
- Workshop Digital, 273 content refreshes (May 2026): https://www.workshopdigital.com/blog/content-refresh-analysis/
- SE Ranking, March 2026 vs December 2025 core update: https://seranking.com/blog/google-core-update-march-2026-vs-december-2025/
- SE Ranking AI-content experiment (via PPC Land, 4 Aug 2025): https://ppc.land/se-ranking-study-shows-ai-content-disappears-from-search-after-3-months/
- Amsive, March 2026 core update (Lily Ray, 30 Apr 2026): https://amsive.com/insights/seo/google-march-2026-core-update-winners-losers-analysis/
- SISTRIX Germany, March 2026 core update (SEJ, 10 Apr 2026): https://searchenginejournal.com/google-march-core-update-left-4-losers-for-every-winner-in-germany/571639/
- Zyppy, 23 million internal links (updated 23 Feb 2026): https://zyppy.com/seo/internal-links-study/
- Whitespark, Local Search Ranking Factors 2026 (6 Nov 2025): https://whitespark.ca/local-search-ranking-factors/
- Graphite, topical authority white paper (24 Jan 2024): https://graphite.io/five-percent/topical-authority-white-paper
- Chen et al., Generative Engine Optimization: How to Dominate AI Search, arXiv 2509.08919: https://arxiv.org/abs/2509.08919
- Zhang et al., Source Coverage and Citation Bias in LLM-based vs. Traditional Search Engines, arXiv 2512.09483: https://arxiv.org/html/2512.09483v1
- Aggarwal et al., GEO, KDD 2024 (via R2-10-27): https://arxiv.org/html/2311.09735v3

Secondary only [thin]: SALT.agency AI Mode study (via dev.to / scalevise write-ups); Seer CTR longitudinal study; 2026 spam update
scopes (SERoundtable, relevantaudience); quality rater guideline changes (Search Engine Land, Semrush, ppc.land).
