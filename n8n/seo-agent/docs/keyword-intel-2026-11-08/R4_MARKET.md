# R4 - Market leaders and methods for competitor analysis and service-buyer keyword research (2026-11-08)

Author: R4 of the keyword intelligence programme (KI). Read-only research; no code or other file changed.
Scope: (a) competitor analysis for SEO and AI search, (b) keyword research that finds what real buyers type to get a SERVICE
(B2B services and local service businesses: an ERP / Dynamics 365 partner in the UAE, a software development agency).

## 0. How to read this file

Evidence tags used on every claim:
- **[O]** I opened the source this session (WebFetch) and the claim is in it.
- **[S]** seen only in search-result text or a secondary page; the vendor page itself was not opened (blocked or not tried).
- **[U]** could not verify; treat as a hypothesis.
- **[J]** my own judgement or arithmetic, not a source.

All URLs are listed in section 9 with their tag. Vendors' own studies are flagged as such: most "accuracy" claims in this market are
self-run and self-graded.

Verdict on the owner's material (`OWNER_MATERIAL.md`) is in section 7; the recommended method set is section 6.

---

## 1. The leaders, method by method

### 1.1 Semrush (owned by Adobe since 2026-04-28)

- **Ownership.** Adobe completed the acquisition on 28 April 2026; the press release gives no price and promises "continued investment"
  and integration with AEM, Adobe LLM Optimizer, Commerce, AEP, Brand Concierge [O adobe]. Semrush Enterprise AIO is now sold on
  business.adobe.com [S]. (Deal value: secondary sources say $1.9B equity announced Nov 2025; one says $4.5B [U].)
- **How competitors are found.** Per report: Organic competitors = "common keywords in Google's top 20 organic search results";
  Backlink competitors = shared referring domains; Paid = shared paid keywords; AI Visibility competitors = Semrush's AI prompt data
  (ChatGPT, Gemini, AI Overviews, AI Mode); Traffic and Market = clickstream + "proprietary AI algorithms" [O kb/844]. Competition
  Level is a function of each domain's total keywords and the common keywords, so a giant site sharing a small share ranks low [S].
  Domain overlap, not SERP overlap on the client's chosen seeds. No documented handling of platforms / aggregators [O kb/844].
- **Keyword Gap.** Your domain plus up to five competitors (KB) [O kb/28]; the feature page says "your own and 4 others" [S]: the
  limit is inconsistent across Semrush's own pages. Categories, exactly [O kb/28]:
  Shared (all rank), Missing (all competitors rank, you do not), Weak (you rank lower than ALL competitors), Strong (you rank higher
  than all), Untapped (you do not rank, at least one competitor does), Unique (only you), All. Organic = top 100; Paid = top 8 ad
  positions; PLA. Filters: database, device, date, position range, intent, KD band, include/exclude, volume, CPC, competitive density,
  results count. Plan limits: Pro 3,000 requests/day and 10,000 results per report; Guru 5,000 / 30,000; Business 10,000 / 50,000;
  historical data and URL/subfolder comparison only on Guru+ [O kb/28].
- **Keyword Strategy Builder (clustering).** Clusters by "search intent and SERP similarity" into pillar + subpages with a primary and
  secondary keywords per page; up to 5 seeds, up to 10,000 keywords; prioritises pages by relevance to seeds, volume, KD, domain
  diversity and SERP features, and DOWNGRADES pages whose SERPs carry click-eating features (knowledge panels, carousels) [S]. The
  overlap threshold is not published [S].
- **Keyword Difficulty (KD%).** Self-published formula (2021): top-10 analysis of median referring domains, follow/nofollow ratio,
  median Authority Score; keyword features (volume, word count, SERP features, branded); country weighting. Referring domains about
  41% of the weight, Authority Score about 17% [O semrush KD]. Their "most accurate" claim is a self-run correlation study (30,000
  keywords, 4 countries, vs Ahrefs, Mangools, Serpstat, Moz) where "accuracy" = correlation with inputs Semrush chose, not with ranking
  outcomes [O semrush KD] [J: circular].
- **Personal KD (PKD).** "How difficult it will be for the specified domain to reach the top 10"; "proprietary AI algorithm" weighing
  thematic relevance of domain to keyword, topic competition, and your domain's metrics vs the SERP's. Bands: 0-14 very easy, 15-29
  easy, 30-49 possible, 50-69 difficult, 70-84 hard, 85-100 very hard. No formula, no plan stated [O kb/1434].
- **Intent.** Four intents (navigational, informational, commercial, transactional), multi-label allowed; ML model on (1) SERP
  features, (2) intent words in the keyword ("buy", "address", "how"), (3) branded vs non-branded [O kb/1226].
- **Traffic Analytics.** Clickstream + backlink DB + positions run through a neural network; providers undisclosed [S].
- **AI search (AI Visibility Toolkit / Enterprise AIO).** Prompt database of 317M+ prompts and responses built from "AI search
  clickstream data and Google's keyword dataset for AI Overviews", responses "captured from real requests and not via any APIs of
  LLMs", ChatGPT / Gemini / AI Overviews / AI Mode, 117 regional databases, refreshed daily. **AI Volume is topic-level only**: "we
  combine third-party data on real AI interactions with Semrush's machine learning models"; single prompts are "too specific to
  measure" [O kb/1607]. Enterprise AIO added **Query Fan-Out Analysis** (2026-01-15): the Google queries AI systems rely on, who
  ranks for each, where the brand is missing; the page does not say whether the fan-out queries are observed or modelled [O semrush
  news]. Persona-based prompt generation [S].

### 1.2 Ahrefs

- **Competitors ("Organic competitors", formerly Competing domains).** Sites ranking top 10 for the same keywords as the target
  (domain, subdomain, folder or URL), sorted by overlap; Ahrefs itself says it "won't work particularly well if your site is new and
  doesn't rank for many keywords" [S ahrefs blog/academy]. API returns common / competitor / target keyword counts [S].
- **Content Gap.** Keywords "the below targets rank for" that you do not, with a per-competitor overlap heatmap; any/all style
  intersection [S]. Link Intersect has an explicit "intersect N" filter [S].
- **KD.** Only the referring domains of the top-10 organic pages; no on-page factors; non-linear; Ahrefs' own caveats: "not
  foolproof", KD "reflects the average website, not your site", does not judge intent, tools "vary quite substantially" [O ahrefs KD].
  Help centre: KD 10 about 10 RDs, 40 about 56, 60 about 129, 90 about 756 [S].
- **Personal KD.** Ahrefs' own 2026 KD article describes a *personalised* KD built as a **Claude prompt over the Ahrefs MCP**:
  baseline KD + topical authority in the keyword's Parent Topic cluster + your DR vs the SERP + your URL Rating vs the SERP (the
  example came out 9 points under KD) [O ahrefs KD]. That is: Ahrefs ships the inputs, the personal verdict is left to an LLM prompt.
- **Parent Topic and Traffic Potential.** Parent Topic = the query sending the most traffic to the current #1 page; Traffic Potential =
  the organic traffic of that #1 page (all its keywords), reported for the Parent Topic only [O help 2138010] [S academy]. Clusters
  by Parent Topic and Clusters by terms exist; neither is a pairwise SERP-overlap cluster [S].
- **Intent.** "Search intents" column (commercial, transactional, informational...) since Oct 2024; "AI Search Intent / Identify
  intents" on the SERP overview groups the ranking results by intent; intents exist only for keywords with SERP data; AI intent said to
  need Standard plan or higher [S].
- **Brand Radar (AI).** Prompts built from Google People Also Ask + "Fanout" expansion over the keyword DB (28.7B keywords with volume
  out of 110B found); run on free public interfaces of ChatGPT, Perplexity, Gemini, Copilot (monthly, 90-day window), AI Overviews and
  AI Mode (continuous); locale mix mirrors the keyword DB, strongest in English; citations = links in stored answers, mentions = string
  matches, malformed links not filtered; **AI Share of Voice and Estimated Impressions are labelled "modelled"**, raw answers
  "measured" [O brand radar methodology, updated 2026-02-26]. Prompt count on marketing pages: 242M to 475M depending on page [S].
- **AI adjusted volume** (since 2026-08-31): Google volume of the parent keyword x a platform ratio from Ahrefs' traffic panel:
  AIO queries 1.00, AIO prompts 0.20, AI Mode queries 0.10, AI Mode prompts 0.05, ChatGPT 0.115, Gemini 0.011, Perplexity 0.01,
  Copilot 0.0033, Grok 0.000054. Example: 1,296 x 0.115 = 150 [O help 16755865, 2026-09-03]. It is a model anchored on Google
  volume, not a count of prompts.

### 1.3 SE Ranking

- Competitive Research: traffic predicted per URL then summed; CTR model by position + SERP features + branded + intent (neural
  network); self-reported median deviation from GSC 58.1% (was 81.8%) on 7,675 sites (2024-04) [O seranking update]. A 58% median
  error is the vendor's own number [J: a useful honesty benchmark].
- "Missing keywords" vs a competitor; "Competitors' new keywords" insight; AI Search in Competitive Research shows where rivals are
  cited / mentioned in ChatGPT, Gemini, Perplexity, AI Overviews (add-on), up to 20 rivals by plan [S]. AI Mode coverage is listed by a
  third party, not confirmed [U]. API + MCP in all plans per a third party [S].

### 1.4 Moz

- Priority (1-100) combines Volume, Difficulty, Organic CTR and an optional user "My Score" (business value); Organic CTR estimates the
  share of clicks left for organic results after SERP features (e.g. 94 when PAA takes about 6%); Difficulty 1-100 [S, moz.com blocked;
  read via a mirror of the help page and Moz Q&A]. The formula is not published. "My Score" is the only market example of the user's
  own business value entering the score [J].

### 1.5 Similarweb, SpyFu

- Similarweb Keyword Generator: 1B+ keywords from "anonymous behavioral data collected through our contributory network" on Google,
  YouTube, Amazon; "hybrid" volume method; refresh every 72 h claimed; all figures "estimations and extrapolations" [S].
- SpyFu: Kombat compares up to 3 domains (shared / unique / bought-by-rivals-not-you); long PPC ad history (15 or 18 years, sources
  disagree) [S]. Strength is paid history, which is a strong commercial-intent signal for service keywords [J].

### 1.6 Keyword Insights (the clustering reference)

- Compares each keyword's **top 7** results (cut from 10 because Google "no longer reliably shows 10 traditional links"); keywords
  are clustered when they share **40% or more URLs** (configurable 1-7 results); SERP overlap, not NLP; separate NLP strictness for
  topical clusters [O KI docs].
- Intent: "a hybrid machine learning algorithm + LLM", per keyword, then a dominant intent per cluster; intent costs one extra credit;
  200,000 keywords per project [O KI docs].
- Opportunity (needs rank tracking): (CTR at #1 x volume) - (CTR at current position x volume), with AWR CTRs (38% / 13% / 8% for
  positions 1-3) [O KI docs].
- Note: 40% of top 7 = 2.8, i.e. 3 shared URLs [J]. Our engine already uses exactly that for ladders (`Ladder_Clusters.js`: top 7,
  40%, 3 shared) and top-10 / 3 shared elsewhere (`_kw_inputs.js` serpClusters default) [J, repo read].

### 1.7 LowFruits (weak spots)

- A "weak spot" = a low-authority site on page 1 (Moz DA < 20 by default, configurable; DA < 10 filter); forums / UGC were weak spots
  by default and no longer are in newer versions (Reddit / Quora are strong now); SERP difficulty 1-3 from the weak domains on page 1
  [S, lowfruits.io returned 403]. Simple, transparent, and the only vendor that makes "who is weak on page 1" the primary signal [J].

### 1.8 Question tools: AlsoAsked, AnswerThePublic

- AlsoAsked: Google PAA expanded into up to 4 nested levels, live API on Pro, credits; CSV bulk up to 1,000 questions [S].
- AnswerThePublic (NP Digital since 2022): autocomplete "search listening" with alphabet / preposition / question modifiers; sources
  listed by the vendor: Google, Bing, YouTube, TikTok, Amazon (Instagram per a blog) [S].
- Google has no official general autocomplete API; the suggestqueries endpoint is undocumented and Google restricted the unpublished
  API in 2015 [S]. Use a licensed provider (DataForSEO, see R5) rather than the raw endpoint [J].

### 1.9 Surfer, Clearscope

- Content-side tools (term coverage of a page vs the top results). Not keyword discovery; relevant only for the A7 page benchmark
  [J]. Not researched further.

### 1.10 Profound, Peec, Conductor on "prompt volume"

- **Profound Prompt Volumes**: licensed from "double opt-in consumer panel providers" ("millions of active AI assistant users"), "tens
  of millions of real prompts each month", bias-corrected by "probabilistic modeling", no synthetic data, latency < 2 weeks with weekly
  updates; ChatGPT, Gemini, Perplexity; strongest in US, UK and select EU; before Jan 2026 US only; "volume scales inversely with
  specificity" so 2-4 word topics return useful data and full sentences often return very little [O profound FAQ].
- **Peec Prompt Volume**: a **1-5 relative score** per prompt "relative to your industry", from search trends + "millions of nearly
  real-time conversations" + "external signals"; formula and validation not published [O peec docs].
- **Conductor** (2026-07-08) argues prompt volume is flawed: providers keep logs private, panels / extensions are biased and small,
  "MSV of any prompt = 1"; "unreliable MSV data is worse than no data at all"; use GSC, Trends, Keyword Planner as interest proxies and
  treat prompts qualitatively (how people ask, not how often) [O conductor].
- [J] Conclusion: every AI-prompt volume on the market is either a panel extrapolation (Profound), clickstream + ML at topic level
  (Semrush), Google volume x a traffic ratio (Ahrefs), or a relative score (Peec). None is a count of prompts. None should be shown
  without "modelled" and its source.

### 1.11 Google's own data: Keyword Planner and Search Console

- Keyword Planner: "average number of times people have searched for a keyword **and its close variants**", averaged over 12 months,
  shown for exact match only, "**rounded**" [O google ads 3022575]. Low-spend accounts see bucket ranges (1K-10K etc.) since 2016;
  the spend threshold was never published [S SEL 2016]. Ahrefs' 2021 study of 72,635 keywords (1K-10K band) vs GSC impressions:
  GKP "drastically overestimated" in 54% of cases; Ahrefs roughly right in 60% vs GKP 45% (vendor-run) [S].
- Search Console: anonymised queries are those "not issued by more than a few dozen users over a two-to-three month period"; Ahrefs
  measured 46.77% of clicks anonymised (April 2025, 22B clicks, 887,534 properties; published 2026-02-11); per-site mode 45-80%;
  **long-tail / niche terms are anonymised more**, so small B2B sites lose the most [O ahrefs GSC]. API: max 25,000 rows per request,
  "a maximum of 50K rows of data per day per search type" [O google webmaster how-to]. AI Overviews and AI Mode clicks are included in
  the normal Web search type, not separated [O google ai-features].

---

## 2. Methods that find what people search to BUY a service

Ranked by usefulness for B2B / local services [J], with what is measured and what is modelled.

1. **Search Console query mining (measured, the best source when it exists).** Non-brand queries with impressions; long queries
   (>= 5 words, question words) via regex; queries where the site sits at 8-20 with impressions (striking distance); page-query pairs
   for cannibalisation. Limits: anonymisation hides about half the clicks and more of the long tail on small sites [O ahrefs GSC];
   API 50K rows/day/search type [O]. Value: the only first-party demand signal for zero-volume B2B terms.
2. **SERP-observed signals (measured, dated).** For each candidate: what ranks (provider service pages, vendor product pages,
   "best X" lists, directories such as Clutch / GoodFirms, job boards, government portals, forums), ads count, local pack, PAA,
   related searches. This is how intent and service fit should be decided (section 6.5).
3. **People Also Ask (measured per reading).** Questions Google itself associates; nested 2-4 levels [S alsoasked]. Ahrefs builds its
   whole AI prompt set from PAA [O brand radar]. Cheap and service-relevant ("how much does dynamics 365 implementation cost").
4. **Autocomplete expansion (measured per reading, no volume).** Seed + alphabet, + question words, + service modifiers:
   `{service} {city}`, `{service} company in {city}`, `{service} cost|price|pricing`, `best {service} {city}`, `{product} partner
   {country}`, `{product} vs {alt}`, `{product} alternatives`, `{product} implementation|migration|support`, `{service} for {industry}`.
   Through a licensed API only [J].
5. **Commercial-investigation patterns.** "best X", "X vs Y", "X pricing / cost", "X alternatives", "X reviews". Semrush (2026-10-21,
   400 US commercial keywords, banking / ecommerce / software): AI Overview coverage went from 45.75% (Sep 2025) to 88% (Aug 2026)
   keyword-weighted, 97% volume-weighted; "best X for Y" 96%, reviews about 90%, brand vs brand 86%, alternatives 82%+ [O semrush
   modifiers]. These are exactly the buyer queries, and they are now almost all answered by an AI Overview first [J].
6. **Problem-aware / jobs-to-be-done queries.** ("e-invoicing deadline uae", "move from tally to business central", "erp for
   trading company dubai"). No tool classifies these as buyer queries; they come from PAA, GSC, competitors' blog keywords and client
   interviews [J]. Semrush: AI Overviews grew 71% on commercial (research-stage) SERPs while falling 5% on transactional ones (Nov 2025 -
   Apr 2026, 600,000 US keywords) [O semrush commercial study]: research-stage service queries are where AI answers now sit [J].
7. **"Near me" and city modifiers.** For local service businesses the local pack and Business Profile dominate; for B2B in the UAE the
   city / emirate modifier ("in dubai", "abu dhabi", "uae") changes the SERP more than "near me" [J, not measured this session].
   Google's AI-features guidance tells sites to keep Business Profile current [O google ai-features].
8. **Competitor ranked keywords and paid keywords.** Domain intersection (organic) and paid history (SpyFu-style): a keyword a
   competitor pays for every month is a proven commercial keyword even at "10 searches" [J].
9. **Community questions.** Reddit only through its Data API under the Responsible Builder Policy: prior approval for all use,
   commercial use needs a separate agreement, about 100 queries per minute per OAuth client [S, reddit page 403; secondary sources].
   Quora has no public API [S]. Recommendation: off by default; use Reddit threads only when they appear in our own SERP / AI-answer
   readings (no scraping) [J].
10. **AI-assistant fan-out queries.** Google confirms AI Overviews / AI Mode "may use" query fan-out ("multiple related searches
    across subtopics and data sources") [O google ai-features]; Google never published how many or how generated [S]. **Observable
    sources**: Gemini API grounding returns `groundingMetadata.webSearchQueries` [S ai.google.dev]; OpenAI Responses API
    `web_search_call` actions "usually (but not always)" carry the queries [S openai docs]. Both are the API, not the consumer app
    [J: label "observed via API"]. Vendor fan-out products (Semrush AIO) do not say if they observe or model [O].
11. **Conversational volume sources.** Section 1.10: all modelled or relative. Use them as ranking hints only, never as counts.
12. **Zero-volume long tail (B2B).** Ahrefs (2022): worth it for trending or lucrative topics; a page ranks for hundreds of variants so
    single-keyword volume undercounts; low volume does not mean easy ("submit domain to search engines" vs its head share a SERP);
    Ahrefs Blog top-5 pages with volume <= 10 averaged 11.3 impressions, < 1% exceeded 100 [O ahrefs zero-volume]. 94.74% (or "almost
    93%") of keywords get <= 10 searches/month [S]. **No controlled study shows B2B zero-volume keywords convert better**: everything
    found is agency opinion or one-client case studies [S, several]. Treat as a hypothesis we can measure ourselves (section 5).

---

## 3. What enterprise buyers expect (seoClarity, BrightEdge, Conductor, Botify)

| Need | What the leaders show (evidence) |
|---|---|
| Competitor sets per market | BrightEdge SOV: market selector (e.g. "United States (EN)"), top 30 domains tracked, 9 named + "Others", weekly [O brightedge]. Conductor: Rank Comparisons up to 4 competitors; Market Share report "surfaces new or emerging competitors" per keyword group [O conductor docs]. seoClarity: "no limits on competitive comparisons" [O seoclarity CI]. |
| Share of voice | BrightEdge: CTR-weighted with "click intent, device behavior and AI Overview presence" factored in, filter All / with AIO / without AIO; formula not published [O]. seoClarity: "Share of Visibility" from pixel depth and the space each SERP feature takes, weighted by volume, sold as the fix for "arbitrary CTR models" [O]. Botify: traffic-based SOV via Semrush data (your traffic / sum of traffic) [S]. Conductor AI: Brand Mentions and Website Citations SOV, branded vs unbranded prompts, Entire market vs Tracked competitors, filters by Intent and Persona, "prompts where a competitor appears and you don't" -> Writing Assistant [O conductor docs]. |
| Alerts | seoClarity: competitor intelligence and alerts "delivered daily"; hourly / daily content monitoring with alerts by change type, page group, severity [O / S]. |
| Governance | Roles, SSO, audit log are table stakes [J]; Alaventra already has them (CLAUDE.md 2026-10-18). |
| Export / API | seoClarity Research Grid API (500M+ keywords, 90+ countries) and Domain Research API "query competitor data across domains at scale" [O seoclarity CI] [S grid API]. Conductor public API; some users report export limits [S]. Semrush export up to 50,000 rows by plan [O kb/28]. SE Ranking API + MCP [S]. |
| Methodology disclosure | Rare. Best example: Ahrefs Brand Radar separates measured (stored answers) from modelled (SOV, impressions) [O]. BrightEdge and seoClarity publish no formula [O]. |
| Price | Demo-only for BrightEdge, seoClarity, Conductor [S]. |

[J] What enterprise teams will ask of us: per-market competitor sets with history; SOV that says which CTR model it uses and that
shows the AIO filter; alerts only on real changes; every number exportable with its basis; an API. We already refuse deltas across
changed panels and print sample sizes in AI visibility; carry the same rule into keyword / competitor SOV.

---

## 4. Evidence on what works (latest numbers with dates)

### 4.1 Keyword difficulty accuracy
- No independent, recent benchmark of KD vs actual rankings was found [S]. The only neutral-sounding number is Moz's 2018 study,
  quoted second-hand by seoClarity: tools' correlations "about 8-12% better than flipping a coin" [O seoclarity KD, citing Moz; the Moz
  original not opened]. Semrush's "most accurate" claim is self-graded (correlation with its own chosen inputs) [O]. Ahrefs says KD
  "reflects the average website, not your site" [O]. seoClarity's difficulty uses Page Strength (content, SERP, volume, links, trends,
  volatility) and is partly site-specific for new pages [O].
- [J] Implication: a generic KD must never be the verdict. A verdict needs the client's own strength vs this SERP, and its real
  outcome should be logged so that our own calibration (a Brier score per band) replaces the claim.

### 4.2 SERP-overlap clustering validity
- No peer-reviewed comparison found. Keyword Insights (vendor) says SERP overlap beat NLP in its own test of 13 tools [S]; a June 2026
  vendor blog claims 87% match to manual for SERP overlap vs 71% for semantic-only, no data published [U]. Recommended thresholds in the
  market disagree: 3-4 of top 10, 4+, 6+, 40% of top 7 [S]. Known weakness: low-volume SERPs are noisy [S].
- [J] SERP overlap is the right primary signal (it is Google's own grouping) but needs: a fixed threshold in config, head-based
  assignment (no chaining), a dated reading per keyword, and a second reading when the decision is on the threshold.

### 4.3 AI Overviews and clicks (most recent first)
- **Seer Interactive, 2026-04-24** (53 brands, 5.47M queries, 2.43B organic impressions, Jan 2025 - Feb 2026): organic CTR with AIO
  shown 2.36% vs 3.82% without (Feb 2026), after a low of 1.31% vs 3.16% (Dec 2025); brand cited in the AIO vs not cited: 0.95% vs
  0.55% (Dec 2025), ratio 1.2x-3.9x over 2025; informational full-year: cited 2.07%, not cited 0.94%, no AIO 3.35%; no B2B split;
  commercial AIO prevalence about 8% in their set [O seer 2026].
- **Ahrefs, 2026-02-04** (300,000 keywords, desktop, GSC aggregate, Dec 2023 vs Dec 2025): position-1 CTR on AIO keywords 0.073 ->
  0.016, against a predicted 0.037 = -58%; informational-only comparison set; correlation, not causation [O ahrefs AIO]. April 2025
  version: -34.5% [S].
- **Pew Research, 2025-07-22** (900 US adults' real browsing, 68,879 searches, March 2025): clicked a traditional result 8% of visits
  with an AI summary vs 15% without; 1% clicked a link inside the summary; session ended 26% vs 16% [O pew].
- **Semrush 2026-07-02 and 2026-10-21**: AIO spreading into commercial-research SERPs (+71% on commercial, -5% on transactional over
  Nov 2025 - Apr 2026); commercial modifiers at 82-96% AIO coverage by Aug 2026 [O both].
- AWR: 74.3% of AIO SERPs end with no organic click (desktop, July 2026) [S].
- [J] For a services buyer journey: comparison and "best X" queries are now mostly answered by an AI Overview; transactional "hire /
  partner / company in city" queries less so. Click-demand must be AIO-adjusted by intent, and being CITED is worth roughly 2x the
  clicks of being ranked and uncited (Seer) [O].

### 4.4 Where "best X" lists drive AI citations
- **Ahrefs (Glen Allsopp), 2025-12-04**: 750 top-of-funnel prompts (250 software, 250 products, 250 agencies incl. SEO, web design,
  marketing), 26,283 source URLs: "best X" blog lists were 43.8% of cited page types on average, > 3x the next (blog posts 14.3%,
  landing pages 10.6%); for agency prompts the recommended agencies' own pages cited were general landing pages 30.4%, own blog lists
  17.2%, homepage 14%; 79.1% of sampled lists updated in 2025; 67.6% of Google SERPs for "best X software" contained a list where the
  author ranked itself first; the author recommends agencies publish honest self-inclusive lists [O ahrefs best lists].
- **Seer, 2026-02-25** (2M+ ChatGPT citations, Nov 2025 - Feb 2026, listicle = URL with "best" or "top"): listicles 16.6% of
  citations, falling (-30% Dec -> Jan vs -22.7% total); growing lists were fresh ("2026"), longer (10-20 options), cited external
  validation or a method, numbered with pros / cons / pricing / "best for"; Wikipedia 3.6% -> 5.9%, Reddit nearly tripled [O seer].
- **G2, 2026-07-22** (1,000+ B2B software buyers): review sites 38% and AI chatbots 37% as top shortlist influence; 82% got software
  recommendations from a chatbot in 24 months [O g2]. Software, not services: use as direction only [J].
- [J] For a service client: the lists and directories AI cites for "best {service} in {city}" are a keyword-research OUTPUT (places to
  be listed, lists to be added to, a list page of our own to write), not just competitors. This is why platforms must be tagged, not
  dropped.

### 4.5 AI traffic value
- Ahrefs (2025-06-16): AI search visitors were 0.5% of visits and 12.1% of sign-ups on ahrefs.com (about 23x), single-site [S].

---

## 5. Where no vendor is good (our chance to lead)

1. **A verdict against the client's own domain, with the reason and the next action.** Semrush PKD and Ahrefs' personal KD give a
   number; Ahrefs leaves the personal score to a Claude prompt [O]. Nobody says "Go: you already rank 14 with /services/d365, refresh
   it" or "Hard for you now: 9 of 10 results have 150+ referring domains, you have 12; do the listing first" with the evidence.
2. **Service-intent fit.** No tool checks that a keyword matches what THIS company sells in THIS market. Semrush intent uses words +
   SERP features + branded [O]; nobody uses the client's service model. Jobs, training, free downloads, government portals and other
   brands leak into every vendor's lists. We already have `_fit_gate.js` and the site model.
3. **Honest uncertainty.** No vendor shows a range on volume, traffic potential or difficulty; even the honest ones only say
   "estimate" (Ahrefs) or publish a 58% median error once (SE Ranking) [O]. We already print Wilson ranges for AI visibility; do the
   same for keyword numbers (Google's rounding, bucket ranges, CTR-curve spread).
4. **Gaps that become actions.** Every gap tool stops at a list (Missing / Weak / Untapped). Conductor's "competitor appears and you
   don't -> Writing Assistant" is the only gap-to-action link found [O]. We can attach the action, the page (new vs refresh), the cost
   in credits and a Start button.
5. **Buyer-journey stage for services.** The 4-intent model has no "problem-aware", "vendor comparison", "vendor selection" stage;
   Conductor filters by persona / intent in AI only [O]. For B2B services the stage decides the page type.
6. **Platforms and aggregators as actions.** Semrush / Ahrefs competitor lists mix Clutch, LinkedIn, Microsoft, Wikipedia with real
   rivals and have no documented handling [O kb/844]. AI citation studies say these lists are what AI cites [O ahrefs, seer].
7. **Small and non-US markets.** Keyword DBs and AI prompt sets are strongest in US / English [O brand radar, profound]; UAE B2B
   volumes are often "0" or rounded. Multi-source evidence counts (GSC, PAA, autocomplete, competitor ranks, paid history, fan-out
   observed) beat a missing volume.
8. **Outcome-calibrated difficulty.** Nobody publishes how often their "easy" keywords actually reached the top 10. We own the loop
   (ladder, rank tracker): log predicted band vs outcome at 90 / 180 days and recalibrate.
9. **Honest AI-prompt demand.** All prompt volumes are modelled (section 1.10). Saying so, and ranking AI questions by evidence
   (PAA, GSC long queries, fan-out observed, competitor citations) instead of invented counts, is a lead [J].

---

## 6. Recommended method set for Alaventra (concrete)

Design rules: every number carries `basis` in {measured, provider_estimate, modelled, inferred} + `source` + `fetched_at` (+ `range`
when modelled); platforms tagged, not scored; nothing pays twice (cache TTLs from the owner note are reasonable); deterministic given
the same inputs.

### 6.1 Competitor discovery (per site x market)

1. **Seeds (service x market).** From the site model: each service x market phrase (`{service} {city|country}`, `{service} company
   {city}`, `{product} partner {country}`, `best {service} {city}`), + non-brand GSC queries with impressions (top 50 by
   impressions, fit-gated), + tracked keywords, + the domain's own ranked keywords (when it has >= 50). Gate every seed with the fit
   gate first (no other brands, no government, no jobs).
2. **SERP competitors on seeds** (measured): for each seed's top 10, credit each domain `w_k x CTR(pos)`, where `w_k` = seed value
   (click demand x intent weight, section 6.4). `SERPshare(d) = sum credits(d) / sum_k w_k x CTR(1)`.
3. **Domain overlap** (provider estimate): competitors_domain / organic competitors on the client domain, ONLY when the client ranks for
   >= 50 keywords (Ahrefs: the method fails for small sites [S]). Weight 0.5 of SERP evidence.
4. **AI-answer competitors** (measured): brands / domains named or cited in the site's AI panel answers for service questions.
5. **Classify every domain** (homepage + 2 service pages, untrusted text, SSRF-guarded): `direct` (same service, same market),
   `adjacent` (overlapping service), `principal` (the product owner, e.g. microsoft.com for a D365 partner: never a competitor),
   `directory` (Clutch, GoodFirms, G2, DesignRush...), `publisher_list` ("best X" list pages), `platform` (Wikipedia, YouTube, Reddit,
   LinkedIn, Quora), `government`, `job_board`. Only direct + adjacent are scored; directories and lists go to "places to be listed /
   lists to join" (Link Builder, AI growth), platforms to "formats that win this SERP".
6. **Score**: `Comp(d) = 0.45 SERPshare + 0.20 TopicSim + 0.15 GeoMatch + 0.20 AIshare` (TopicSim = similarity of their service pages
   to the client's services; GeoMatch = address / phone code / ccTLD / hreflang / city mentions in the market). Size ratio
   (ranked keywords, referring domains vs the client) is a TAG (`peer`, `leader`, `smaller`, `out of reach` when > 20x keywords and
   > 10x referring domains), not a score input, so leaders stay visible.
7. **Output**: top 10-20 with reasons ("in the top 10 for 9 of 14 of your service searches in Dubai"), user picks up to 5, rest =
   watchlist; acceptance as in the owner note (expected competitors in the top 20, platforms tagged). Re-run monthly; alert only on a
   new direct competitor entering the top 10 of >= 3 seeds.

### 6.2 Gap types (all against the chosen set, per market)

Keyword level (reconciled with the provider's intersection totals):
- `missing`: >= 2 chosen competitors in top 10, client not in top 100 (Semrush's "all competitors" is too strict for 5 rivals [J]).
- `untapped`: exactly 1 competitor in top 10, client absent.
- `weak`: client 11-100 while >= 1 competitor in top 10.
- `striking`: client 8-20 in GSC with >= 100 impressions / 28 days (measured beats the provider position).
- `strong` / `unique`: defend list (alerts on loss).
Beyond keywords (no vendor does these as gaps [J]):
- `topic`: a cluster where >= 2 competitors have a ranking page and the client has none (head keyword, winning page, its format).
- `page_type`: competitors have a pricing / cost page, comparison page, city / emirate page, industry page, case study for the
  service; the client does not.
- `serp_feature`: local pack, PAA, video, AIO citation held by a competitor on a service SERP.
- `ai_answer`: a competitor named or cited in AI answers for a service question where the client is not (from the AI panel).
- `listing`: directories / "best X" lists that rank or are cited for the client's service searches and list >= 1 competitor but not
  the client.
- `backlink`: referring domains linking to >= 2 competitors, not the client (to the Link Builder; nothing sent).
Every gap row carries its action (new page / refresh page X / get listed / pitch list / link prospect), credits, and Start.

### 6.3 Clustering rule

- Pre-filter: gates (6.5), dedupe close variants (normalised text), require evidence >= 1 source; cap SERP reads per run (engine
  already caps at 24 for ladders).
- Fetch top-10 organic URLs per keyword (dated, cached 24 h); normalise host-agnostically (www / bare, trailing slash, params).
- **One rule everywhere** (resolve B2-7, two code paths today: top 10 / 3 shared in `serpClusters`, top 7 / 40% in ladders [J, repo]):
  same page if shared >= `T_page` = 3 of the top 10 (default; equals Keyword Insights' 40% of top 7 [O]); same hub if >= `T_hub` = 2.
  The owner's 4 of 10 is stricter than every documented default; keep it as a config value, not the default.
- **Head-based, no chaining**: sort by click demand (6.4) desc; each keyword joins the first head it shares >= T with; otherwise it
  becomes a head. Deterministic tie-break by keyword text. Guarantees the owner's acceptance: identical top 10 never split (identical
  overlaps to every head), zero overlap never merged.
- Borderline (shared == T or T-1): re-read once on another day before merging or splitting (SERP noise on low-volume B2B [S]).
- Head keyword = highest click demand; Traffic Potential (if provider gives it) shown, not used to pick.

### 6.4 Opportunity score (critique of the owner's formula, then the proposal)

**Owner's formula**: `100 x (0.30 TP + 0.20 Fit + 0.20 Intent + 0.15 Reach + 0.15 Weak)`.
Problems [J]:
1. **Additive lets volume buy back a wrong keyword.** Example: "dynamics 365 jobs dubai": TP 1.0, Fit 0.2, Intent 0.1, Reach 0.8,
   Weak 0.8 -> 30 + 4 + 2 + 12 + 12 = **60**. "business central partner abu dhabi": TP 0.1, Fit 1, Intent 1, Reach 0.6, Weak 0.5 ->
   3 + 20 + 20 + 9 + 7.5 = **59.5**. The job query outranks the money query. Fit and intent must gate or multiply.
2. **TP (top page's traffic) is modelled and US-skewed**; for UAE B2B it is 0 or missing for most money keywords; 30% weight on the
   least reliable input. Ahrefs defines TP from the #1 page only [O].
3. **Reach and Weak double-count difficulty** (both are "can we win"); Fit and Intent partly double-count (a jobs query fails both).
4. **No value term** (CPC / deal value). Moz is the only vendor letting the user's business value in ("My Score") [S].
5. **No AIO adjustment, no confidence.** Comparison queries now carry AIOs on 82-96% of SERPs [O]; a score without click loss and
   without a range overstates them.

**Proposal** (all weights / anchors in config, all factors in [0, 1], score monotone non-decreasing in every factor):

```
Gate   = 0 if any hard gate fails (other-brand navigational, government portal, job / training / free-download intent for a
           services site, wrong market, Fit < 0.35); else 1
Score  = 100 x Gate x Fit x StageW x (0.40 Demand + 0.35 Win + 0.15 Value + 0.10 Gap)
```
- **Fit** (inferred + measured): service-model similarity of keyword + its SERP titles (IDF-weighted, as the engine's topic matching)
  x geography match. Continuous above the 0.35 gate.
- **StageW** (journey stage from SERP evidence, 6.5): selection / hire ("{service} company dubai", "{product} partner uae") 1.00;
  comparison ("best", "vs", "alternatives", "pricing", "reviews", "cost") 0.90; solution-aware ("{product} implementation process")
  0.65; problem-aware ("e-invoicing deadline uae") 0.50; general informational 0.30.
- **Demand** (cluster click demand per month): `D = sum over cluster [volume_k x CTR(p*) x (1 - AIOloss(stage) x AIOpresent_k)]`, with
  GSC impressions replacing provider volume where we have them (measured beats estimated); p* = the position the Win model expects
  (default 5); `Demand = min(1, log10(1 + D) / log10(1 + D_ref))`, `D_ref` = 300 clicks/month (config, per market). Zero / missing
  volume with >= 2 independent evidence sources (GSC impressions, PAA, autocomplete, competitor ranking, paid by a competitor,
  observed fan-out) -> floor 0.15, label "evidenced, volume not measured". AIOloss defaults (modelled, config): informational 0.55
  (Ahrefs -58% pos 1 [O]), comparison 0.40 (Seer -38% all queries Feb 2026 [O]; not measured for B2B), selection 0.15, local pack 0.10.
- **Win** (personal difficulty inverted; modelled): `0.35 Strength + 0.25 ExistingRank + 0.20 Topical + 0.20 WeakSpots`.
  Strength = client referring domains / domain strength vs the median of the top 10 (log ratio, clipped); ExistingRank = 1.0 if the
  client already ranks 4-10, 0.8 at 11-20, 0.5 at 21-50, 0 none (GSC first); Topical = share of the client's ranking keywords in the
  same cluster / parent topic (Ahrefs' and Semrush's personal KD use the same idea [O]); WeakSpots = share of top-10 results that are
  thin, stale (> 2 years), off-intent, forum / UGC, or low authority (LowFruits idea [S]). Verdict bands: Win >= 0.6 "Go", 0.35-0.6
  "Takes a few months", < 0.35 "Hard for your site now". Calibrate the bands from our own ladder outcomes (Brier score per band).
- **Value** (provider estimate or owner input): owner-set value per service if given; else CPC: `min(1, log10(1 + CPC) /
  log10(1 + CPC_ref))`, CPC_ref = $15; missing CPC -> 0.5 labelled modelled.
- **Gap** (measured): share of chosen competitors in the top 10, + 0.5 if a competitor is cited in AI answers for the cluster's
  question (cap 1).
- **Confidence**: compute the score at the low and high end of each modelled input (Google bucket / rounding, CTR curve +/- 30%,
  Win +/- 0.15); show "Score 62 (48-71)"; mark "low confidence" when the range is > 25 points; rank by the midpoint, never hide the
  range.

Sanity check on the two examples [J]: the jobs query is gated to 0; the partner query (Fit 1, StageW 1, Demand 0.15 floor, Win 0.55,
Value 0.8, Gap 0.6) scores 100 x (0.06 + 0.19 + 0.12 + 0.06) = **43**, a weak-volume but correct target ranked above any
off-intent volume.

### 6.5 Intent and stage rule (SERP first, words second, LLM last)

1. Classify the top-10 results by page type (provider service page, vendor product page, "best X" list, directory, guide / blog,
   forum, job board, government, news, video) + local pack + ads count (dated reading).
2. Intent distribution = position-weighted share of page types (multi-label). Commercial / selection if >= 40% provider pages or
   directories or >= 3 ads; comparison if >= 30% lists / comparison pages; informational if >= 50% guides / encyclopaedic.
3. Lexical overrides (strong words only): jobs / salary / career / course / certification / free download / login / "what is" in a
   services site -> gate or informational; "near me" / city -> local selection; "vs", "alternatives", "best", "pricing", "cost",
   "reviews" -> comparison.
4. LLM tie-break only when 1-3 disagree, returning label + confidence; confidence < 0.6 -> "needs your review" (owner note B3).
5. Show the evidence: "7 of 10 results are company service pages, 2 directories, 1 list -> people looking to hire".
   (Semrush uses SERP features + words + branded [O]; Keyword Insights ML + LLM [O]; this adds the page-type evidence and the stage.)

### 6.6 Question mining (for content and the AI panel)

- PAA depth 2 on cluster heads (measured), autocomplete question modifiers (measured), GSC long and question queries (measured),
  related searches (measured), competitor FAQ / H2 questions on ranking pages (measured, untrusted text), observed fan-out queries from
  the Gemini grounding API and OpenAI web search API (measured "via API") for the site's top 10 service questions.
- Dedupe by meaning; attach to a cluster; stage-label; questions with service fit and >= 2 sources go to the AI panel ONLY after the
  owner approves (owner note B9). Prompt "volume" shown only as the source's own figure and basis (e.g. "Ahrefs AI adjusted volume:
  modelled from Google volume") or not at all (Conductor's warning [O]).

### 6.7 Labels (one taxonomy, every number)

| basis | examples | shown as |
|---|---|---|
| measured | GSC clicks / impressions / positions, our SERP readings, our AI answers, observed fan-out queries, page fetches | value + date |
| provider_estimate | search volume (Google Ads: rounded, close variants grouped [O]), CPC, provider KD, provider traffic, referring domains | value + provider + date |
| modelled (ours) | click demand, AIO loss, Win, opportunity score, competitor SOV | value + range + "estimated" |
| inferred (LLM) | intent tie-break, page-type when the fetch is ambiguous, topic similarity | label + confidence |

### 6.8 What NOT to build (evidence says low value or not allowed)

- A prompt-volume number of our own (no compliant measured source exists; all are modelled [O]).
- Scraping Reddit / Quora or the raw autocomplete endpoint (terms; [S]).
- A generic KD as a verdict (no evidence it predicts outcomes [O seoclarity citing Moz]).
- Whole-domain traffic estimates as a competitor score input (vendors' own error is large: SE Ranking median 58% vs GSC [O]).

---

## 7. Owner material: claim-by-claim check

| Owner claim | Status |
|---|---|
| Semrush Keyword Gap compares 5 competitors | Partly: KB says up to 5 competitors + you [O]; feature page says you + 4 [S]. Vendor is inconsistent. |
| Keyword Gap has 15+ filters | Not verified; KB lists about 10 filter types [O]. |
| Semrush Backlink Gap, clustering | Backlink Gap exists [S]; Keyword Strategy Builder clusters by intent + SERP similarity, threshold unpublished [S]. |
| Ahrefs Content Gap, Competing Domains, Top Pages, Link Intersect, TP, Parent Topic | Verified (Competing Domains now "Organic competitors") [O/S]. TP is the #1 page's traffic for the Parent Topic only [O]. |
| SE Ranking competitor research incl AIO / AI Mode / Gemini / Perplexity / ChatGPT | Partly: ChatGPT, Gemini, Perplexity, AIO from SE Ranking's own blog [S]; AI Mode only from a third party [U]; add-on. |
| SpyFu PPC, Similarweb traffic | Verified as positioning [S]; data is panel / clickstream estimates [S]. |
| Keyword Insights SERP clustering | Verified: top 7, 40% default [O]. |
| B4 "4+ shared top-10 URLs" | No vendor default found at 4/10; Keyword Insights = 40% of 7 (about 3) [O]; our engine uses 3. Keep 3 as default, 4 as an option. |
| B5 weakness: forums in top 5 = weak | Outdated as a default: LowFruits stopped treating forums as weak by default [S]; Seer shows Reddit's AI citation share nearly tripled [O]. Treat UGC as "beatable only if the intent is a hire / compare". |
| B6 weights 0.30 TP + 0.20 Fit + 0.20 Intent + 0.15 Reach + 0.15 Weak | Replace: section 6.4 (gates + multiplicative fit / stage, value term, AIO-adjusted demand, ranges). |
| B9 AI prompts only after approval; prompt volume only from a named real source | Right; add: every named source is modelled or relative (Profound panel, Semrush clickstream + ML, Ahrefs Google x ratio, Peec 1-5) [O]. |
| "They keep bigger indexes, history, PPC data; our edge is the decision + automation layer" | Agreed and supported: no vendor ties gap -> action -> outcome, none shows ranges, none checks service fit [O/J]. |
| A1 platforms tagged not scored | Agree, plus directories and "best X" lists become listing / outreach actions (they drive AI citations [O ahrefs, seer]). |
| A8 AI SOV with 95% range | Agree; no vendor does it (Brand Radar labels SOV modelled, no range [O]). |

---

## 8. One-paragraph recommendation

Build competitor discovery from the client's own service x market SERPs (not domain overlap), classify every domain (direct,
adjacent, principal, directory, list, platform) and route non-competitors to actions; find buyer keywords from GSC + SERP evidence +
PAA + autocomplete with service modifiers + competitors' ranked and paid keywords + observed fan-out, never from invented prompt
volume; cluster with one head-based SERP-overlap rule (3 of top 10, config); decide intent and journey stage from what actually ranks;
score with hard gates and a multiplicative fit x stage x (demand, win, value, gap) formula with AIO-adjusted demand and a printed range;
attach an action and a price to every gap; and calibrate "Go / takes months / hard now" against our own ladder outcomes. That is
where the market is weakest and where our existing site model, fit gate, reach, ladders and AI panel already give us the parts.

---

## 9. Sources

Opened this session [O]:
- https://news.adobe.com/news/2026/04/adobe-completes-semrush-acquisition
- https://www.semrush.com/kb/28-keyword-gap
- https://de.semrush.com/kb/1434-how-is-personal-keyword-difficulty-calculated
- https://www.semrush.com/kb/1226-how-is-keyword-intent-calculated
- https://www.semrush.com/kb/844-discover-competitors
- https://www.semrush.com/kb/1607-semrush-ai-visibility-data
- https://semrush.com/blog/most-accurate-keyword-difficulty
- https://www.semrush.com/news/442193-query-fan-out-analysis-comes-to-semrush-enterprise-ai-optimization-revealing-the-search-signals-behind-ai-responses/
- https://semrush.com/blog/ai-overviews-commercial-modifiers-study (2026-10-21)
- https://www.semrush.com/blog/ai-overviews-commercial-search-study/ (2026-07-02)
- https://ahrefs.com/blog/keyword-difficulty/
- https://help.ahrefs.com/en/articles/2138010-what-is-the-difference-between-traffic-potential-and-search-volume-in-keywords-explorer
- https://help.ahrefs.com/en/articles/16755865-what-is-ai-adjusted-volume-and-how-is-it-calculated (2026-09-03)
- https://ahrefs.com/blog/brand-radar-methodology/ (updated 2026-02-26)
- https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/ (2026-02-04)
- https://ahrefs.com/blog/best-lists-research/ (2025-12-04)
- https://ahrefs.com/blog/gsc-anonymized-queries/ (2026-02-11)
- https://ahrefs.com/blog/zero-volume-keywords/ (2022-10-21)
- https://docs.keywordinsights.ai/learning-center/the-features/keyword-clustering/
- https://seranking.com/blog/competitive-research-updates/ (2024-04-18)
- https://docs.tryprofound.com/prompt-volumes/faq
- https://docs.peec.ai/metrics/prompt-metrics/prompt-volume
- https://www.conductor.com/blog/debunking-ai-prompt-volume/ (2026-07-08)
- https://www.conductor.com/docs/platform/learning-center/tutorials/platform-investigate-competitors-with-conductor/
- https://help.brightedge.com/products/s3/share-of-voice
- https://www.seoclarity.net/share-of-visibility
- https://www.seoclarity.net/technology/competitive-insights/
- https://www.seoclarity.net/blog/keyword-difficulty (2023-09-21)
- https://www.seerinteractive.com/blog/aio-impact-on-google-ctr-2026-update (2026-04-24)
- https://www.seerinteractive.com/insights/the-listicle-window-is-closing-in-ai-search-30-decline-mom (2026-02-25)
- https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/
- https://company.g2.com/news/buyer-behavior-2026 (2026-07-22)
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data
- https://support.google.com/google-ads/answer/3022575

Seen in search results / secondary pages only [S] (vendor page not opened or blocked):
- https://www.semrush.com/features/domain-vs-domain ; https://www.semrush.com/kb/1058-keyword-strategy-builder (socket error) ;
  https://www.semrush.com/features/keyword-strategy-builder ; https://www.semrush.com/free-tools/competitor-finder/
- https://ahrefs.com/academy/how-to-use-ahrefs/site-explorer/organic-competitors ; https://ahrefs.com/blog/how-to-use-competing-domains ;
  https://help.ahrefs.com/en/articles/9025740-how-to-use-content-gap-to-find-keyword-ideas-from-competitor-websites ;
  https://help.ahrefs.com/en/articles/72265-what-does-kd-stand-for-in-keywords-explorer ;
  https://help.ahrefs.com/en/articles/9459159-where-to-find-all-of-ahrefs-ai-powered-tools-and-features ;
  https://ahrefs.com/academy/how-to-use-ahrefs/keywords-explorer/matching-terms ; https://ahrefs.com/blog/gsc-gkp-search-volume-study/ ;
  https://ahrefs.com/blog/seo-statistics/ ; https://ahrefs.com/blog/ai-search-traffic-conversions-ahrefs/ ; https://ahrefs.com/brand-radar
- https://moz-com.analytics-portals.com/help/keyword-explorer/keyword-metrics/priority (mirror; moz.com blocked) ; Moz Q&A threads
- https://lowfruits.io/ (403) ; https://lowfruits.io/docs/lf-vs-manual-analysis/ (403)
- https://alsoasked.com/llms.txt ; https://answerthepublic.zendesk.com/hc/en-us/articles/7299190956827-How-AnswerThePublic-Collects-Data
- https://support.similarweb.com/hc/en-us/articles/360000956218-Using-Keyword-Generator-Tool ; https://www.spyfu.com/blog/turn-spyfus-ppc-tools-into-true-market-intelligence/
- https://seranking.com/blog/how-to-find-competitors-keywords ; https://seranking.com/blog/5-powerful-tools-spy-competitors/
- https://support.botify.com/en/articles/9108625-semrush-data-in-botify ; https://www.seoclarity.net/blog/release-week/research-grid-api
- https://ai.google.dev/gemini-api/docs/google-search ; https://developers.openai.com/api/docs/guides/tools-web-search
- https://blog.google/products-and-platforms/products/search/google-search-ai-mode-update/ (quoted via secondary pages)
- https://searchengineland.com/google-officially-throttling-keyword-planner-data-low-spending-adwords-accounts-255795 (2016)
- https://www.advancedwebranking.com/seo/organic-ctr ; https://docs.dataforseo.com/v3/dataforseo_labs/google/serp_competitors/live
- Reddit Responsible Builder Policy (support.reddithelp.com returned 403; terms read only via third-party summaries)

Unverified [U]: Semrush deal value; SE Ranking AI Mode in competitor research; "87% vs 71%" clustering test; Moz 2018 "8-12% better
than chance" (second-hand via seoClarity); Reddit commercial pricing; Ahrefs AI Search Intent plan tier.
