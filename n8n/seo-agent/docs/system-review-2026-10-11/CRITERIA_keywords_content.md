# Scoring criteria: keywords and content (2026-10-11)

> **One criterion was re-baselined after this file was frozen.** On 2026-10-15 the owner agreed to move **K7** from "≥ 3–4 shared
> top-10 URLs" to "≥ 40% shared top-7 URLs", because Keyword Insights — the source of the shared-URL convention this criterion
> cites — now compares the top 7, "because Google no longer reliably shows 10 traditional links"
> ([docs.keywordinsights.ai](https://docs.keywordinsights.ai/learning-center/the-features/keyword-clustering/), read 2026-10-15,
> evidence in `../system-review-2026-10-14/BENCH_AREA2_ladders.md`). The old statement is kept in the row. Nothing else in this
> file has changed since it was frozen on 2026-10-11, and the 5 → 6 → 8 comparison holds for every other criterion.


Scope: (1) keyword research, difficulty, "should I target this" verdicts, ladders / topic clusters; (2) AI-assisted content, on-page SEO, cadence.

**Evidence tags:** **[G]** Google statement or documentation · **[L]** large study (100k+ pages or a clickstream panel) · **[V]** vendor study or claim · **[A]** anecdote or single case · **[U]** unverified (only a secondary source was seen). Correlations are not causes. "Product today" summarises the product's own docs (LADDER / PIPELINE specs, REVIEW §3b–3k, `v5/prompts`, `Content_QA.js`). It is not a score.

---

## Area 1: Keyword research, difficulty, verdicts, ladders

### (a) What the leading tools do

| Tool | Difficulty method | Other best-in-class features |
|---|---|---|
| **Ahrefs** | KD = weighted, log-scaled referring domains of the top-10 pages ([Academy](https://ahrefs.com/academy/how-to-use-ahrefs/ahrefs-seo-metrics/keyword-and-search-traffic)) | **Traffic Potential** (the #1 page's traffic across all its keywords); **Parent Topic** (groups keywords); intents |
| **Semrush** | KD% from median referring domains (~41% of the weight), Authority Score, follow ratio, SERP features ([whitepaper](https://static.semrush.com/blog/uploads/files/4b/94/4b94a525f86e9610cd80268d200a7236/semrush_keyword_difficulty_2.pdf)) [V]. **Personal KD**: your domain against the SERP's domains, plus topical relevance ([KB 1434](https://de.semrush.com/kb/1434-how-is-personal-keyword-difficulty-calculated)) | **Keyword Strategy Builder**: pillar + subpages, with volume, weighted KD, intent and a SERP summary per page; SERP-based clustering |
| **MarketMuse** | **Personalized Difficulty** = KD − Topic Authority. Topic Authority (−100…+100) = the site's breadth and depth on the topic plus its search performance ([docs](https://docs.marketmuse.com/reference/personalized-difficulty-and-topic-authority/)) | Content plans; topic inventory |
| **Moz** | Difficulty + **Priority** (volume, difficulty, CTR opportunity, importance) | Clicks discounted for SERP features |
| **Keyword Insights** et al. | **SERP-overlap clustering** (shared top-10 URLs; default 40%) + intent ([docs](https://docs.keywordinsights.ai/learning-center/the-features/keyword-clustering/)) | Conventions: 3 shared URLs = broad, 5 = strict, 7 = near-synonyms [V] |
| **Google** | Keyword Planner gives ranges; Search Console gives real impressions and positions | Ground truth for the site's own demand |

### (b) Proven results

- **Time to rank** (Ahrefs, May 2025; 1.3M keywords) [L/V]:
  - Only **1.74%** of new pages reach the top 10 within a year (5.7% in 2017).
  - 40.8% of those that do get there within a month.
  - The average #1 page is 5 years old, and 72.9% of top-10 pages are older than 3 years.
  - Source: [Ahrefs](https://ahrefs.com/blog/how-long-does-it-take-to-rank/). *The product's rules R5 / R6 still cite the 2017 figures.*
- **Keyword difficulty accuracy.** On 50 posts (Brafton, 2018), Pearson r between KD and actual rank was Moz 0.41 and Semrush 0.36; other tools scored lower ([Moz blog](https://cur.at/iYoUVNN?m=web)) [V, small sample]. Generic KD explains about 10–17% of rank variance, which argues for personalising and calibrating it.
- **Search volume accuracy.** Against Search Console on 1,635 sites, the median deviation was 49.5% for Ahrefs and 68.4% for Semrush (Ahrefs, 2022) [V/U, from a [secondary source](https://geotoolbox.ai/blog/semrush-vs-ahrefs)].
- **Long tail.** About 93% of US keywords get under 10 searches a month ([Ahrefs](https://ahrefs.com/blog/long-tail-keywords-research/)) [V].
- **Click loss:**
  - AI Overviews cut position-1 CTR by **58%** (Dec 2025; 34.5% in Apr 2025). Position 2 loses 50.8%, position 10 loses 19.4%. Seer (49–65%) and Authoritas (47.5%) report similar losses ([Ahrefs](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/)) [V, corroborated].
  - 58.5% of US searches end without a click ([SparkToro/Datos 2024](https://searchengineland.com/google-search-zero-click-study-2024-443869)) [L].
- **Topic focus:**
  - Google flags "producing lots of content on many different topics" ([helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), updated 2026-10-05) [G].
  - The 2024 leak names `siteFocusScore` / `siteRadius` ([Wikipedia](https://en.wikipedia.org/wiki/2024_Google_Search_documentation_leak)) (a leak, not confirmed by Google).
  - HubSpot's blog lost an estimated 76–81% of traffic in 2024, mostly on off-topic posts ([SEL](https://searchengineland.com/hubspot-seo-organic-traffic-drop-451096)) [A].
- **Clusters and internal links:**
  - In HubSpot's 2017 test, more interlinking went with better rankings and impressions ([HubSpot](https://research.hubspot.com/topic-clusters-seo)) [A/V].
  - Zyppy (23M links, 1,800 sites): pages with 40–44 internal links averaged **4×** the clicks of pages with 0–4. At least one exact-match anchor went with about **5×** the traffic ([Zyppy](https://zyppy.com/seo/internal-links-study/)) [V, correlation].
  - Google usually shows at most two results per site for a query (2019) [G].

### (c) Criteria (0–10)

| # | Criterion | 0 / 5 / 10 anchors | Evidence | Product today |
|---|---|---|---|---|
| K1 | **Difficulty personalised to the site** | 0 fixed KD bands · 5 adjusted by domain strength · 10 topic-level authority, with predicted vs actual top-10 rates back-tested | Semrush PKD, MarketMuse PD; KD r ≈ 0.4 | "Reach" = 75th-percentile KD of the site's top-10 keywords (domain-level, not per topic); no back-test |
| K2 | **Traffic potential, not raw volume** | 0 volume · 5 volume adjusted for SERP features · 10 #1-page / cluster traffic, calibrated with Search Console | Ahrefs TP; volume error 50–70% | Volume × click loss × CPC × intent × trend; no Search Console calibration |
| K3 | **Current click-loss model** | 0 none · 5 static discounts · 10 per-keyword AIO / snippet / local / video discounts from 2025+ CTR data | AIO −58%; 58.5% zero-click | Discounts exist; rates not checked |
| K4 | **Intent and page type from the live SERP** | 0 guess · 5 API label · 10 the dominant top-10 page type decides, a mismatch is flagged | Ahrefs "pick intent"; Semrush SERP summary | Claude labels; a live SERP only for the 8 priority keywords |
| K5 | **Business-fit gate** | 0 none · 5 AI relevance tag · 10 a scored business value gates the verdict; navigational / other-brand terms refused | Google focus; HubSpot | Relevance and fit scored 0–2; navigational / other-brand refused |
| K6 | **Sources incl. first-party data** | 0 one seed list · 5 several sources + competitors · 10 + Search Console striking distance / impressions with no page, + AI prompt demand, fed into discovery | Search Console = ground truth | 7 pulls + competitors + AI demand; Search Console only in the cadence (roadmap 10) |
| K7 | **Clustering by SERP overlap** | 0 none · 5 token / LLM labels · 10 ≥ 40% shared **top-7** URLs + intent | Convention [V] | Token / AI labels; SERP overlap on the roadmap · **re-baselined 2026-10-15 on the owner's decision (B2-6)** — old statement: "≥ 3–4 shared top-10 URLs" |
| K8 | **Cannibalisation guard** | 0 none · 5 keyword text similarity · 10 SERP overlap + Search Console "two URLs for one query", across ladders, pages and queue | Site diversity [G] | Jaccard ≥ 0.75; sitemap / ranking-URL match; one-character numbers drop out |
| K9 | **Verdict quality** | 0 a score · 5 go / no-go + reasons · 10 + plan, visits and months as ranges, cost, alternatives, reasons traceable to data | — | Verdict, plan type, months, alternatives, "Why this plan" |
| K10 | **Calibrated timelines** | 0 promises · 5 month ranges · 10 probabilities per plan type, re-fit from the product's own tracked outcomes | 1.74% / 40.8% | 2–4 / 4–8 / 9–15 months; 2017 citation; no calibration |
| K11 | **Cluster architecture enforced** | 0 keyword list · 5 pillar + spokes planned · 10 link map checked live + gaps against a competitor topical map | HubSpot; Zyppy | Ladder link map, hub page (TOC / ItemList), live check of the down-links |
| K12 | **Focus and pacing across clusters** | 0 unlimited · 5 a cap · 10 a cap + topic-radius check + priority order | Google; HubSpot | Max 2 active ladders, topic warning (not a block), priority |
| K13 | **Outcome loop** | 0 none · 5 weekly ranks · 10 ranks + Search Console + won / stuck states that re-plan automatically | — | Weekly tracker, Search Console, won / stuck; next rung is recommended only |

---

## Area 2: AI-assisted content, on-page, cadence

### (a) What the leading tools do

| Tool | Scoring and QA | Notable features |
|---|---|---|
| **Surfer** | Content Score 0–100. Surfer's own correlation with rank: 0.18 (2023) → 0.21 (2024) → 0.245–0.284 (1M pages; [Surfer](https://surferseo.com/blog/word-count-does-not-matter-for-seo)) [V] | NLP terms, **Facts**, Topical Map, internal-link suggestions from Search Console, AI Detector / Humanizer, Auto-optimize [V/U] |
| **Clearscope** | Grade from A++ to F on term coverage | Content Inventory (Search Console), **decay alerts**, refresh recommendations ([Clearscope](https://www.clearscope.io/support/content-decay)) |
| **MarketMuse** | Content Score = coverage of a subtopic model, against a target taken from the competitors | Personalized Difficulty, content plans |
| **Ahrefs AI Content Helper** (2024) | Topic coverage for the **intent you pick**; the SERP's minimum / maximum word count | No keyword density |
| **Semrush SEO Writing Assistant** | SEO, **Readability** (Flesch-Kincaid), **Originality** (Copyleaks plagiarism check), **Tone of voice** ([KB 814](https://www.semrush.com/kb/814-seo-writing-assistant)) | Template from the top 10 |
| **Jasper / Writer** | Brand voice, knowledge base, style rules; Writer: own models, compliance, claim detection [U] | Enterprise workflow |
| **Koala / Byword** | Bulk articles from keyword lists, real-time SERP, auto internal links, one-click CMS publish | Built for scale: the risk zone of the scaled-content policy |

### (b) Proven results

**AI content: neutral when edited, failing at scale.**
- Ahrefs (2025; 600k pages): 86.5% of top pages contain some AI text; the correlation of AI share with rank is **0.011** ([SEJ](https://www.searchenginejournal.com/ahrefs-study-finds-no-evidence-google-penalizes-ai-content/550656/)) [L/V].
- Semrush (Dec 2024; 20k articles): AI articles 57% vs human articles 58% in the top 10 ([Semrush](https://www.semrush.com/blog/does-google-penalize-ai-content/)) [V].
- Graphite (2025): 86% of Google results are human-written ([Graphite](https://graphite.io/five-percent/ai-content-and-search)) [V].
- NP Digital (744 articles): human posts got **5.44×** the traffic after 5 months ([NP](https://neilpatel.com/blog/ai-vs-human-content/)) [V].
- SE Ranking (2,000 **unedited** AI articles on 20 new domains): 71% were indexed within 36 days, but only **3%** were still in the top 100 after about 3 months, with no recovery by month 16 ([SE Ranking](https://seranking.com/blog/ai-content-experiment/)) [V].

**What Google enforces** [G]
- The March 2024 updates left **45% less** low-quality, unoriginal content in results ([SEL](https://searchengineland.com/google-march-2024-core-update-rollout-is-now-complete-438713)).
- Scaled content abuse applies "no matter how it's created" ([spam policies](https://developers.google.com/search/docs/essentials/spam-policies)).
- Since Jan 2025, raters give the **lowest** rating to main content that is all or nearly all AI with little added value ([SEL](https://searchengineland.com/google-quality-raters-content-ai-generated-454161)).
- "Appropriate use of AI… is not against our guidelines" ([2023](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content)).
- 2026 updates: spam on Mar 24, Jun 24, Aug 18 and Sep 24; core on Mar 27 and May 21 ([dashboard](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history)).

**Coverage beats length.**
- Google: no preferred word count [G].
- Surfer (1M pages): once a page uses ≥ 50% of the recommended terms, length stops mattering [V].
- Surfer (n = 100): coverage r = 0.17; the best articles reach 0.74 coverage against a SERP average of 0.44 ([Surfer](https://surferseo.com/blog/content-coverage-study)) [V].

**Freshness.**
- Pages that AI assistants cite are 25.7% fresher than organic results (17M citations; [Ahrefs](https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/)) [L/V].
- HubSpot's refreshed posts gained **+106%** organic views ([HubSpot](https://blog.hubspot.com/marketing/historical-blog-seo-conversion-optimization)) [A, older].
- Google warns against changing dates without substantial changes [G].

**Cadence (correlation only).**
- HubSpot (~2015, 13,500 organisations): 16+ posts a month went with about 3.5× the traffic of 0–4 posts [V, old].
- Orbit Media (2025, 808 marketers): those publishing several times a week report "strong results" 37% of the time vs 21% overall; the average post takes 3 h 25 min ([Orbit](https://www.orbitmedia.com/blog/blogger-research/)) [V].

**E-E-A-T.** Google asks for "a byline, where one might be expected", original research and no easily verified factual errors [G]. No independent large study isolates author signals; vendor numbers ("68% of top-3 pages…") are [U].

**Schema:**
- Google's own case studies [G-published, A]: Rotten Tomatoes +25% CTR, Food Network +35% visits, Nestlé +82% CTR ([Google](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)).
- **FAQ rich results stopped showing on 2026-05-07**; HowTo was deprecated in 2023 ([SEJ](https://www.searchenginejournal.com/google-drops-faq-rich-results/574429/)) [G].
- No special markup is needed for AI Overviews / AI Mode ([Google](https://developers.google.com/search/docs/appearance/ai-features), updated 2025-12-10) [G].

**Other.**
- Titles: Google rewrites 61.6% of titles and 99.9% of those over 70 characters ([Zyppy 2022](https://zyppy.com/seo/google-title-rewrites/)) [V].
- AI detectors: OpenAI's classifier caught 26% of AI text with 9% false positives and was withdrawn in 2023 ([OpenAI](https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text)). Use detectors as a soft signal, never as a gate.

### (c) Criteria (0–10)

| # | Criterion | 0 / 5 / 10 anchors | Evidence | Product today |
|---|---|---|---|---|
| C1 | **Brief covers the SERP for the chosen intent** | 0 keyword only · 5 headings and terms · 10 the top 10's subtopics, questions, entities and stats; coverage target ≥ the best competitor (≈ 0.7 vs a 0.44 average) | Surfer, Clearscope, MarketMuse | Term model, questions and stats from competitor pages; coverage = 25 points of the content score |
| C2 | **Information gain** | 0 none · 5 a planned angle · 10 gain items checked in QA, plus original data / experience / proof | Google "original information" | Gain items in the brief, checked by the critic |
| C3 | **Fact verification** | 0 none · 5 numbers need a source · 10 every claim checked against the fetched source text, re-checked at refresh | Google "factual errors" | Verified evidence plan with URLs; unsourced numbers flagged; no claim-by-claim check |
| C4 | **Experience and author (E-E-A-T)** | 0 anonymous · 5 byline · 10 credentialed author + author page + Person schema, a reviewer for YMYL, real experience notes | Google Who / How / Why | Profile, byline, author box, Person / reviewedBy, experience notes, case library (live test with a real profile pending) |
| C5 | **Originality / plagiarism check** | 0 none · 5 manual · 10 automatic similarity against the competitor pages used and the site's own pages, with a threshold (≤ 10–15% overlap; convention) | Semrush (Copyleaks) | **None found** |
| C6 | **AI patterns and filler** | 0 none · 5 banned-phrase list · 10 + repetition / generic-sentence checks + specificity per section; detector only as a soft signal | Rater guidelines on filler | Banned phrases, 2 specifics per section, critic |
| C7 | **Readability, answer first** | 0 none · 5 one Flesch check · 10 targets by audience (B2B Flesch ~30–60, ≤ 20–25-word sentences), active voice, a 40–60-word answer under each question | Convention; no ranking evidence | Flesch, passive %, long sentences, snippet targets |
| C8 | **Length follows coverage** | 0 a fixed count · 5 the SERP median · 10 a SERP min–max range, judged by coverage | Google; Surfer | Brief target ±25%; length = 15 points |
| C9 | **Validated multi-pass QA** | 0 none · 5 a score · 10 critic + deterministic gate + editor, with the score shown to correlate with outcomes | Surfer publishes r | Critic + score + editor; not validated (roadmap item 6) |
| C10 | **On-page basics checked live** | 0 none · 5 in the draft · 10 title ≤ 60–65 characters with the keyword, meta 120–160, one H1, canonical, indexable, checked on the live URL + URL Inspection | Zyppy | Draft QA + live publish check + URL Inspection |
| C11 | **Current, correct schema** | 0 none · 5 generic Article · 10 matched to page type and visible content; nothing that relies on deprecated rich results | Google [G] | Article / Person / Org / LocalBusiness / Service / VideoObject / Breadcrumb / ItemList; **still emits FAQPage and scores an FAQ**: no rich result since 2026-05-07 |
| C12 | **Internal links in and out** | 0 none · 5 outbound only · 10 ≥ 3 contextual inbound links from relevant live pages, varied anchors, hub ↔ spoke, orphan check, all verified | Zyppy; HubSpot | Ladder links; publish check suggests source pages; inbound links not verified |
| C13 | **Images** | 0 none · 5 placeholders · 10 original visuals, alt text, file names, dimensions, WebP / AVIF, og:image, checked live | [Google](https://developers.google.com/search/docs/appearance/google-images) | 3-image plan + live checks; no images produced |
| C14 | **Cadence with scale safety** | 0 mass output · 5 a weekly cap · 10 cadence tied to review capacity, a guard against unpublished drafts piling up, topic focus, every page researched and edited | Spam policy; SE Ranking | 0–3 posts a week, pile-up guard, max 2 ladders, Auto / Manual |
| C15 | **Decay detection and refresh** | 0 none · 5 a drop alert · 10 alert + scheduled substantive refresh (new coverage, facts re-checked); date changed only then | HubSpot; Ahrefs; Google | Decay action in the Site Tracker, AI-refresh picks, rewrite via `existing_page_url` |
| C16 | **Publish and measure loop** | 0 a file · 5 package + a manual "published" step · 10 CMS draft push, automatic detection, index check, per-page outcomes | — | Blog package; WordPress built but off; sitemap detection; URL Inspection |
| C17 | **Brand voice and approval** | 0 none · 5 a tone input · 10 a stored style guide, applied and checked, with approval per page | Jasper, Writer, Semrush | Tone, banned phrases, Manual mode |

**Weighting by strength of evidence:** the highest weight goes to K1, K2 / K3, K8, K10, C2, C3, C14 and C15; the lowest to C7 and C8. The clearest gaps against Surfer / Semrush-class tools are C5 and C9.
