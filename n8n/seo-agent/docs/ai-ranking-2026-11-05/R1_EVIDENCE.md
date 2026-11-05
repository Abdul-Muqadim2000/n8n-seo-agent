# R1: What causes a brand to be named or cited in AI answers (evidence, 2026-11-05)

This is research only; no code was changed. It builds on `../ai-visibility-2026-10-23/MARKET_RND.md` §4.6 and §6 (source keys M1-M48
there) and on `../../AI_GROWTH_SPEC.md` §1, and it updates both where newer evidence changes the picture (marked **UPDATE**). New
sources use keys E1-E52 (§9). This agent opened every E source on 2026-11-05 unless it is tagged (S), which means only a search snippet
or secondary coverage was read because the page was paywalled or refused.

Tags on claims:
- **PROVEN**: a controlled experiment.
- **CORRELATION**: observational data.
- **VENDOR CLAIM**: a seller's own data or statement, not independently checked.
- **OPINION**: a practitioner's judgement.
- **DOC**: the engine owner's own documentation, which states a rule but measures nothing.

"Lab" means an experiment where the page was already placed in the model's context. A lab result says nothing about whether a page
gets retrieved in the first place.

The two clients are named only by domain: techand.ai (a Microsoft Dynamics / Business Central ERP and e-invoicing partner in the UAE)
and devaicon.com (custom AI and software development). Both are small, regional and low-authority brands.

---

## 0. One-page summary

**The causal chain, as the evidence supports it.** For any engine that searches, a brand is named when two things are true. First, a
page that names it (its own page, or a third party's) is retrieved for the queries the engine runs. Second, that page is chosen from the
retrieved set. The retrieval step dominates:
- When the brand's own domain is in the live retrieval path, its mention rate is 49% (GPT) and 58% (Gemini). Without it, the rate is
  2.8% and 3.8%. Adding branded fan-out queries takes it to 91% and 100% [E20], CORRELATION.
- Prior visibility persists from run to run [E20].
- Rewriting a page that is already retrieved has small, unstable effects: only 3 of 54 settings worked in the main replication [E1, E2].

For answers given without search, the only supported cause is how often the brand appears in the training data, especially next to its
category [E21, E5, E18]. The lag is a model generation: the current Claude models have a June 2026 cutoff [E22].

**No published study shows a white-hat action causing a durable lift across engines** [E2, M27]. Every ranking below is therefore
built from correlation, engine documentation and small experiments. That is why §6 makes per-client lift measurement part of the
algorithm, not a report.

### Ranked levers for small regional B2B services brands (techand.ai, devaicon.com)

| # | Lever | Evidence (strength) | Expected effect | Time to effect | Cost | Who |
|---|---|---|---|---|---|---|
| 1 | **Eligibility.** The AI search bots are allowed (OAI-SearchBot, PerplexityBot, Bingbot, Googlebot, Brave), the key content is in the raw HTML, and the site is indexed in Google, Bing and Brave | DOC [E8, E11, E13]; the AI fetchers run no JavaScript [E23] (CORRELATION, vendor) | A gate: without it the effect is 0 on that engine | ~24 h (robots) to 2 weeks (indexing) | Low | Software detects; a human fixes the site |
| 2 | **Own pages that match the engine's fan-out queries.** Service + city + "best" / "top" / "2026" / "price" / "official", one answer per section, ranked in the index each engine uses | Own-domain exposure: mention rate 2.8% -> 49-58% within the same prompt [E20]; Google page-1 ranking r ~0.65 with mentions [E19]; only 38% of AIO citations come from the top 10, since fan-out reaches beyond it [E9]; 83% of ChatGPT's chosen URLs are absent from Google for the same fan-out query [E14]. All CORRELATION. Traditional ranking beat content tricks in the lab [E1], PROVEN (lab) | Largest effect in reach, but only if the page ranks for the fan-out query | Pickup: AI Mode 36% of new pages cited on day 1, ChatGPT 42% by day 30, on a high-authority site [E24] (VENDOR, no control). Ranking a low-authority page: weeks to months | Medium | Software finds the fan-outs and drafts; a human publishes |
| 3 | **Being named on the third-party pages already cited for the question** ("best ERP partners in Dubai", "top AI development companies in Pakistan", comparisons) | Listicles: 43.8% of cited page types [M46]; 70.8% of B2B SaaS citations [E25]; 21% of citations [E7]. AIO recommendations follow the brands that third parties name; self-ranked lists are cited but the self-promoter is left out 69% of the time [E26]. All CORRELATION | Large per question: it puts the name inside a page that is already retrieved | Days to weeks after the page updates (retrieval engines re-fetch) | Medium (outreach); high if paid | Software finds the pages and drafts; a human sends. Paid placement without disclosure is link spam |
| 4 | **Earned brand mentions in independent media** (regional business press, trade press, partner and customer case studies, podcasts) | Branded web mentions Spearman 0.664 with AIO mentions vs backlinks 0.218 [E18]; GPT cites 69-92% earned media [E5]; referring domains r = +0.32 with Perplexity discovery [E6]. CORRELATION. Muck Rack's "84% earned" mixes in Wikipedia, PubMed and Reddit; journalism alone is about 22-27% [E27, E28] | Moderate for search answers; the only route into no-search answers | Search: weeks. Training data: 6-18 months (the next cutoff plus a release) | High | Mostly human (PR); software finds angles and targets |
| 5 | **LinkedIn articles and posts by named people** | LinkedIn is the #2 cited domain; 14.3% of ChatGPT Search and 13.5% of AI Mode responses cite it; articles of 500-2,000 words are cited most; authors with under 500 followers are cited as often as larger ones [E29]. VENDOR (Semrush with LinkedIn) | Moderate for B2B questions; cheap | Days to weeks | Low | Software drafts; a person posts as themself |
| 6 | **Directory and review profiles** (Clutch, GoodFirms, G2, Microsoft partner directory / AppSource, DesignRush) | Mixed. For SaaS, review platforms are 8.6% of ChatGPT citations, 13.2% at the "best X" evaluation stage [E30], and Perplexity supplies 71% of G2's citations [E25]. For agency-provider questions: 0.5% of links, 1.2% of answers [E31]. Microsoft partner directory / AppSource: no evidence found | Small to moderate; mostly on Perplexity and AIO; counts more where the directory publishes its own "top companies in <city>" lists (OPINION) | Weeks | Low for the profile; reviews need real clients | A human claims the profile; software audits consistency |
| 7 | **Reddit / Quora answers** (disclosed, as the company) | Reddit is the #1 cited domain across five engines in March 2026 [E32]; Reddit presence r = +0.395 with Perplexity discovery [E6]. But ChatGPT's Reddit citations fell 88% from March to September 2026 [E15]. CORRELATION, and volatile | Small and unstable; useful mainly on Perplexity and AIO | Days | Low money, high human time | Human only (spam and disclosure risk) |
| 8 | **YouTube videos** (service explainers, case walkthroughs) | 18.2% of AIO citations that rank outside the top 100 are YouTube; 5.6% of all AIO citations [E9]; ChatGPT's YouTube citations fell 27% [E15]. CORRELATION | Small to moderate on AIO and Perplexity | Weeks | Medium | Human records; software scripts |
| 9 | **Page format** (answer first, specific figures with sources, quotations, tables, a visible "updated" date, the year in the title when the fan-outs carry it) | GEO lab gains of +30-41% on a word-count metric [M25] did not replicate in C-SEO Bench (3 of 54 settings) [E1, E2]. Freshness: cited pages are 25.7% fresher [M23]; 78% of cited pages lose half their share within 14 days [E33]. 44.2% of ChatGPT citations come from the first 30% of the text [E34] (S). "2026" appears in 17.6-22.9% of ChatGPT fan-outs [E15]. CORRELATION / failed lab | Small; it only works once the page is retrieved; the year mainly helps the page match fan-outs | Days after a re-crawl | Low | Software |
| 10 | **Wikipedia / Wikidata** | Wikipedia had 3.4 epochs of weight in GPT-3's training [E35]; 19.7% of ChatGPT citations in one vertical [E5]; ChatGPT's Wikipedia citations fell 80% in 2026 [E15]. Notability needs multiple independent, significant, non-local sources [E36]. Wikidata: no effect evidence found | Large for brands that qualify; **neither client is likely to qualify today** (OPINION) | Months | High | Human only (conflict-of-interest rules) |
| 11 | **Schema, llms.txt** | Google: no special files or schema are needed [E8]; schema has no measurable effect [M44, E9]; llms.txt shows no link to citations [M45] | About 0 | n/a | Low | Keep at weight 0 |
| 12 | **Manipulation** (strategic text, prompt injection, AI-only pages, fake reviews, self-ranked lists) | It works in the lab on fictitious catalogues [E4, E3]; Bing now classes it as abuse [E13]; self-ranked lists hurt organic visibility after Dec 2025 (S) and help competitors [E26] | Negative or banned | n/a | n/a | Never |

**The structural fact behind all of this.** Brand stature dominates:
- Household names appear in 73% of relevant answers, mid-market brands in 44% and niche brands in 11% [E7].
- In a 37,000-run audit, 48-52% of the least-prominent tier (regional players) never surfaced once [E37].
- When products are otherwise identical, the well-known brand wins 100% of the time. A rating edge of under +0.1 stars, placed in the
  context, removes that advantage [E38], PROVEN (lab).

Both clients sit in the bottom tier. For them the first goal is retrieval on narrow, local, high-intent questions they can win, not the
broad category head term.

---

## 1. Retrieval pipelines per engine (as documented in November 2026)

| Engine | Index used | Fan-out | What we know about citation choice | Evidence |
|---|---|---|---|---|
| **Google AI Overviews / AI Mode** | Google's own index. "Indexed and eligible to be shown in Google Search with a snippet" is the only requirement; "no additional technical requirements" | Yes: "issuing multiple related searches across subtopics and data sources". Google publishes no count | Models "identify more supporting web pages". Passage-level selection is a practitioner model, not a Google statement | DOC [E8] |
| **Gemini app / Gemini API grounding** | Google Search | The model decides whether to search ("determines if a Google Search can improve the answer") and writes one or more queries itself | Returns `url_citation` spans | DOC [E39] |
| **ChatGPT search** | OAI-SearchBot crawl plus "third-party search providers" that OpenAI does not fully name. Partly Google results via SerpApi for news, sports and markets, per The Information, Aug 2025 (S) | The query is rewritten into one or more queries. Only 14.4% of logged-out GPT-5.6 responses contained fan-outs, averaging 1.6 queries each (broad prompts) [E15] | Sites that block OAI-SearchBot are not shown; robots changes take ~24 h [E11]. Only 6.82% of chosen URLs are in Google's top 10 for the same fan-out, and 83.39% are absent from Google altogether [E14] (S). Citation overlap with Bing's top 10 is 8.1% [E40]. 84.4% of factual answers cite an official source [E15] | DOC [E11, E12 (S)], VENDOR [E14, E15, E40] |
| **Microsoft Copilot** | Bing | Not documented | The Bing guidelines (rewritten 2026-02-27) treat "grounding results and citations" as eligibility outcomes. NOARCHIVE blocks use in Copilot; NOCACHE limits it to the URL, title and snippet. Prompt injection and "artificially engineered language" are named abuse | DOC via SEJ [E13]; the original Bing post of 2025-10-08 was not opened (S) |
| **Perplexity** | Its own crawler (PerplexityBot) and index, with Vespa as the retrieval engine; index size not confirmed | Not documented | 28.6% overlap with Google's top 10, the highest of the assistants [E40]. G2 earns most of its AI citations here [E25] | DOC (S) [E17], VENDOR [E40] |
| **Claude** | Brave Search: added to Anthropic's subprocessor list in March 2025, and 10 of 10 citations matched Brave in a test | Not documented | Claude ignored a fake brand's own site entirely in Ahrefs' test [E41]. Its cited pages hold their share longest (2.8x ChatGPT's at two months) [E33] | (S) [E16]; Anthropic's current page not opened |

**UPDATE to AI_GROWTH_SPEC §1.** The spec says "ChatGPT: own index + Google results". The evidence now reads differently:
- ChatGPT uses a multi-source mix that rarely matches Google or Bing (6.8-8.1% top-10 overlap) [E14, E40].
- Fan-out happens in only a minority of logged-out answers [E15].
- AIO's overlap with the top 10 halved from 76.1% (July 2025) to 37.9% (March 2026). Ahrefs' hypothesis is fan-out SERPs since
  Gemini 3; its parsing method also changed between the two studies [E9, E10].

The practical rule: optimise for the *fan-out* queries each engine actually runs, which our ChatGPT scraper and AI Mode data already
capture, not for the user's head term.

**How fan-out queries are formed (ChatGPT, Aug-Sep 2026)** [E15]:
- They add the year ("2026" in up to 22.9% of fan-outs), "official" (13.1%), "price" (8.9%), "best", "vs", "reviews" and country names.
- 6.8% use `site:`, mostly on brand sites (75.9% of the most-searched domains).

For B2B services this implies the fan-out for "best Business Central partner in Dubai" will look like "best Business Central partner
Dubai 2026", "<partner> reviews", "<partner> price" and "site:<partner>.com". A brand is helped by an official page that answers price,
scope and proof, and by third-party pages that carry those words (OPINION drawn from E15).

**Volatility per engine** [E15]: from March to September 2026, ChatGPT's citations of Reddit fell 88%, Wikipedia 80% and YouTube 27%,
while licensed publishers rose from 7.5% to 15.8% of citation share and then fell back to 12.5%. Each engine decides largely
independently: cross-engine correlation of how long a page stays cited is 0.03-0.09 [E33]. Source mixes must be re-measured per engine
and month, never assumed.

---

## 2. Parametric (no-search) answers

- **Search is often not used.** In one study, 57.8% of repeated ChatGPT runs did not activate web search [E2 citing M4]. Logged-out
  broad prompts had fan-outs in only 14.4% of cases [E15]. A large share of answers is therefore parametric.
- **What a model knows tracks how often the entity appears in pre-training data.** Kandpal et al. (ICML 2023) report "strong
  correlational and causal relationships" between QA accuracy and the number of relevant pre-training documents. Retrieval reduces this
  dependence [E21], PROVEN for factual QA. Brand recommendation was not tested, but it is the closest causal result.
- **Training data mix.** In GPT-3, Common Crawl was 60% of the mix (0.44 epochs) and Wikipedia 3% (3.4 epochs, so it was seen about
  eight times as often per token) [E35]. Newer mixes are not published.
- **Recognised is not the same as recommended.** Product Hunt startups were recognised by name in 99.4% (ChatGPT) and 94.3%
  (Perplexity) of cases, but surfaced in discovery questions in only 3.32% and 8.29% [E6]. Being known is not enough: the model has to
  associate the brand with the category and the place.
- **Incumbent advantage.** Real brands beat fictional ones 100% of the time at equal specifications across GPT-4o-mini, Claude Sonnet and
  Gemini 3 Flash [E38]. Global brands are associated with positive attributes [E42] (EMNLP 2024). A competing study found little classic
  popularity bias, and found that Google search interest was the strongest predictor of prominence [E43]. Mixed, but none of it favours
  small regional brands.
- **Lag.** The current Claude models have a reliable knowledge cutoff of June 2026 [E22]; Google's model page shows no cutoffs; OpenAI's
  were not verified. A mention earned today can only reach a no-search answer after the next cutoff and the model release that follows,
  typically 6-18 months (OPINION, from the published cutoff vs release gaps).

**Implication.** For techand.ai and devaicon.com, no-search visibility is a 12-month-plus programme of earned mentions that pair the
brand with its category and city (for example "Business Central partner in Dubai"). It cannot be the near-term lever. It should be
measured separately from search answers, which our panel can do by engine and mode.

---

## 3. Academic work 2023-2026

| Work | Finding | Strength |
|---|---|---|
| **GEO** (Aggarwal et al., KDD 2024) [M25, E2] | 10,000 queries, the top 5 Google results placed in context, GPT-3.5. Position-adjusted word count: baseline 19.3, keyword stuffing 17.7, cite sources 24.6, statistics 25.2, quotations 27.2. The famous "+40%" is 19.3 -> 27.2, a word-count share, not clicks or retrieval. The gains are redistributive: the 5th source gains 115.1% while the 1st loses 30.3%. The Perplexity test used uploaded files, not organic retrieval | Lab |
| **C-SEO Bench** (Puerto et al., NeurIPS D&B 2025) [E1, E2] | ~1,900 queries, 16,360 documents. Only 3 of 54 method-domain settings were significantly positive, none in question answering, and several rewrites lowered rank. Moving a document higher in the context beat most rewrites. Gains shrink as more players adopt the tactics (zero-sum) | Lab; **the main failed replication of GEO** |
| **Critical survey of GEO** (July 2026) [E2] | High confidence only that already-retrieved content can change its own citation, and that relevance plus context position decide citation. Low confidence that any white-hat change durably improves discoverability. Very low confidence that citation scores predict revenue | Review |
| **AutoGEO** (Oct 2025) [E44] | Rules mined from engine preferences: each engine has its own, and engine-specific rules beat shared ones. AutoGEO_Mini reports ~21% average gains (S); the exact figures are not in the abstract | Lab |
| **GEO-Bench, ranking manipulation** (May 2026) [E3] | White-hat rewrites matched gradient attacks on 3 of 5 datasets, but the "Authoritative" rewrite scored 0.83 on one dataset and 0.00 on another. Method rankings flip by dataset. Tested on one open 8B model | Lab |
| **Strategic text sequences** (Kumar, Lakkaraju 2024) [E4] | An optimised string raised a fictitious product to the top recommendation; no commercial engine was tested | Lab; now Bing abuse [E13] |
| **Earned-media bias** (Chen et al., Sept 2025) [E5] | Web-enabled GPT cites 69-92% earned media vs Google's 31-54% (software USA: 72.7% vs 45.4%); Claude 81-94% earned. Overlap with Google's top 10 is 20-50%, and for local services far lower (IT support 0.1%, dentists 11.9%). Big brands took 62.2% of mentions vs niche brands' 9.0% | CORRELATION (controlled sampling) |
| **Discovery gap** (Sharma, Jan 2026) [E6] | 99.4% recognised vs 3.3% surfaced. GEO scores were uncorrelated with discovery; referring domains r = +0.32 and Reddit presence r = +0.40 (Perplexity). Advice: "build an SEO foundation first" | CORRELATION |
| **Incumbent advantage** (Chu, Hou, June-Oct 2026) [E38] | The real brand wins at parity (IAI 10.0). A rating edge under +0.1 stars, or authority language (fabricated clinical claims), breaks it. When every brand applies the same GEO, the payoff falls from +0.802 to +0.007, and non-participants get zero recommendations | Lab (commercial models) |
| **Prominence-stratified audit** (May 2026) [E37] | 37,000 runs, 533 brands in 5 tiers: category leaders win 25-41% of the slots they reach, tier 2 converts 37-52%, and 48-52% of tier 4-5 (regional) brands never surface. "No uniform optimization recipe wins" | CORRELATION |
| **Fitted stage model** (Tannenbaum, Sept 2026) [E20] | 34,960 unbranded prompt-engine observations: own-domain exposure 2.8% -> 49.0% (GPT) and 3.8% -> 58.4% (Gemini); with branded fan-out, 91.4% / 100%. Prior mention plus exposure gives 80.5%. Prior history alone predicts with AUC 0.94. The author: "predictive and observational, not causal" | CORRELATION (single platform) |
| **Brand stature** (Ranqo, June 2026) [E7] | Household names 73%, mid-market 44%, niche 11%; listicles ~21% of citations; framing flips 6.7x more often than whether a brand is mentioned at all | VENDOR / CORRELATION |
| **Long-tail knowledge** (Kandpal et al., ICML 2023) [E21] | Accuracy depends on the number of relevant pre-training documents; deletion experiments are causal | PROVEN (factual QA) |
| **Longitudinal attempts** [E2] | One site: ChatGPT referrals rose 5.7x, but untreated pages rose 3.5x too; the controlled multiplier was 1.82 (95% CI 1.31-2.54), and a temporal placebo gave p = 0.16. Pinterest reports +20% traffic vs control, with too little detail to judge | Suggestive only |

**What replicated and what did not.**
- Content rewriting (GEO) did not replicate in the C-SEO Bench setting.
- Its effects are dataset-dependent [E3] and erode under competition [E1, E38].
- What does replicate across papers: context position and relevance decide citation [E2]; big brands are favoured [E5, E7, E37, E38];
  earned and third-party sources are over-represented [E5, E25].

---

## 4. Large empirical studies (correlation vs causation; who is selling)

| Study | Date | Finding | Type | Seller's interest |
|---|---|---|---|---|
| Ahrefs, 75K brands [E18] | 2025-05-26 | Spearman with AIO mentions: branded web mentions 0.664, branded anchors 0.527, branded search 0.392, DR 0.326, referring domains 0.295, backlinks 0.218. Brands with DR > 40 only | CORRELATION | Sells Brand Radar |
| Seer Interactive [E19] | 2025-01-07 | 10,000 PAA questions (finance, SaaS) on the GPT-4o API: Google page-1 rankings ~0.65 with mentions, Bing ~0.5-0.6, backlinks weak | CORRELATION | Sells monitoring |
| Ahrefs, AIO vs top 10 [E9, E10] | 2026-03-02 / 2025-07-21 | 37.9% of citations in the top 10 (was 76.1%), 31.0% beyond position 100 | CORRELATION | Ahrefs |
| Ahrefs, assistants vs top 10 [E40] | 2025-08-11 | 15,000 prompts: ChatGPT 8.0% Google / 8.1% Bing top-10 overlap; Perplexity 28.6% | CORRELATION | Ahrefs |
| Ahrefs, ChatGPT fan-out [E15] | 2026-10-12 | 66.6M responses; fan-out in 14.4%; the terms used; citation-mix shifts (above) | CORRELATION | Ahrefs |
| Semrush, new-page pickup [E24] | 2025-12-10 | 81 pages on an Authority-84 blog: AI Mode cites 36% on day 1 and 59% at peak, volatile; ChatGPT 10% on day 1 and 42% on day 30, then sticky; 41-52% never cited. No control | Small experiment | Its own site and tool |
| Profound, citation half-life [E33] | 2026-09-30 | 883K pages on 7 engines: 78% reach half-peak within 14 days; sustained pages have a median ~27-29 days; pages cited by 5+ engines hold 5.7x better | CORRELATION | Profound |
| Semrush + LinkedIn [E29] | 2026-03-10 | 89K LinkedIn URLs: LinkedIn is the #2 domain; articles carry most citations; follower count does not matter much | CORRELATION | LinkedIn co-authored |
| Peec, 30M sources [E32] | 2026-03 | Top cited domains in the US: Reddit, YouTube, LinkedIn, Wikipedia, Forbes, G2. Per-industry leaders differ | CORRELATION | Peec |
| Overthink Group [E25] | 2026-07-14 | 250 niche B2B SaaS categories: 70.8% of citations go to "best/top" titles (51.6% contain "2026"); review sites 8.6%; spam 14.5% in ChatGPT; ~3/4 of top AIO/Gemini domains are vendors vs ~1/4 in ChatGPT/Perplexity | CORRELATION | Agency |
| G2 / Profound [E30] | 2026-02-13 | Review-platform share of ChatGPT citations by stage: discovery 7.4%, evaluation 13.2% | CORRELATION | G2 sells reviews |
| SourceRank [E31] | 2026-10-04 | Agency-provider questions (5 engines, 500 answers): directories 0.5% of links; vendor and agency sites 85.5%; Reddit/LinkedIn/YouTube in 18.2% of answers | CORRELATION | GEO vendor |
| Lily Ray, self-promotional lists [E26] | 2026-06-17 | 80 AIO prompts: 69% of cited self-ranked lists belong to brands that were not recommended | CORRELATION | Consultant |
| Ahrefs, fake-brand test [E41] | 2025-12-10 | Seeded Medium / Reddit / blog narratives were adopted by Perplexity, Gemini, AI Mode, Copilot and Grok within the ~2-month test; ChatGPT kept to the official FAQ (84% citing it); Claude never used the site | Small experiment | Ahrefs |
| Muck Rack, "What is AI reading" [M21, E27, E28] | 2026-05 / 2026-10 (S) | "84% earned"; journalism alone ~27% falling to ~22%; press releases a small share. Critics: the definition includes Wikipedia, PubMed and Reddit, and AIO / AI Mode are excluded | CORRELATION | Sells PR software |

**What I could not open or verify:**
- OpenAI's search help page (403), so the names of its search providers are unconfirmed.
- The Information's SerpApi report (paywalled).
- The original Bing post of 2025-10-08.
- The "87% of SearchGPT citations match Bing" figure: conflicting attributions, no primary source found.
- The full text of Kevin Indig's 44.2% study (paywalled).
- Indig's 5.32M-result listicle study (paywalled).
- Perplexity's index size.
- Brave's current status in Anthropic's own subprocessor list.
- BrightEdge's and Similarweb's 2026 studies (only snippets were seen; not used).
- **No study of the Microsoft partner directory or AppSource as an AI source, and none of Wikidata's effect.**

---

## 5. Levers ranked, in detail

The summary table in §0 is the ranking. These notes cover what it cannot.

1. **Eligibility.**
   - OpenAI excludes sites that block OAI-SearchBot [E11]; Google needs indexing plus snippet eligibility [E8]; Copilot follows Bing's
     meta directives [E13].
   - The AI fetchers do not execute JavaScript; Googlebot and Gemini do [E23] (Vercel / MERJ, Dec 2024, via the vendor's post).
   - Claude needs presence in Brave's index [E16] (S). We cannot submit pages to Brave, but we can check it with Brave's Search API.
2. **Fan-out pages.** This is where software has the most leverage.
   - Read the engine's own fan-out queries for each lost question (ChatGPT scraper, AI Mode).
   - Check whether the client ranks for each one in the right index: Bing for Copilot, Google for AIO / AI Mode / Gemini, Brave for
     Claude, and a ChatGPT / Perplexity citation check, since their indexes are not queryable.
   - Write or refresh one page that answers the set.
   - Google warns against scaled pages made mainly to manipulate rankings (S). One page per intent, not one per fan-out.
3. **Third-party lists.** Of the three ways onto a cited page (get added, get a new list written, write our own), only the first two
   help the client be *recommended* [E26].
   - Comparison pages that name rivals honestly are fine (OPINION).
   - Self-ranked "best X" pages are cited but mostly name the competitors. They also correlate with organic losses after December 2025
     (S, unconfirmed by Google).
4. **Earned mentions.**
   - The strongest correlate in every brand-level study [E18, E5, E6].
   - The causal direction is unproven: big brands get both mentions and AI visibility. But it is the only lever that also feeds
     training data [E21].
   - For regional B2B: Gulf / Pakistan business and trade press, Microsoft partner news, customer case studies published by the
     customer, conference talks, podcasts.
5. **LinkedIn.** Cheap, B2B-specific, and citable from individual members' articles (59% of its ChatGPT and AI Mode citations [E29]).
6. **Directories.** The evidence for SaaS (G2) does not transfer to services. For agency-provider questions directories were nearly
   absent [E31]. Keep profiles complete and consistent (cheap), but do not expect lift. Directories also publish their own "top
   companies in <city>" pages, which are listicles and fall under lever 3 (OPINION).
7. **Reddit.** High share overall but volatile (-88% in ChatGPT in six months [E15]); it is the most manipulable source [E41]. Use it
   only as disclosed, human participation.
8. **YouTube.** It matters for AIO beyond the top 100 [E9]. Medium cost.
9. **Format.** Treat it as hygiene that raises the chance of being picked *after* retrieval. Freshness matters because citations decay
   fast [E33]: a refresh cadence of ~4-8 weeks on the pages that win citations is consistent with the half-life data (OPINION). The
   lab-measured gains of GEO should not be promised [E1, E2].
10. **Wikipedia.** Notability needs multiple independent, significant, reliable secondary sources, and at least one must be regional or
    national. Press releases, directories and routine coverage do not count [E36]. Lever 4 has to come first.
11. **Schema and llms.txt.** Zero. Google says so directly [E8].
12. **Manipulation.** Excluded for ethics and risk. Note the finding that it also erodes under competition [E1, E38].

---

## 6. Measuring lift for one client

**What the literature offers.**
- **Variance is large.** The same brand list appears in fewer than 1 in 100 runs [M1]. Daily source overlap is 34-42% [M4].
  Temperature-0 runs change 9-28% of decisions [E2].
- **Gaps of 5-7 points between domains are usually indistinguishable,** and a move from 8% to 11% cannot be attributed to an
  intervention [E45].
- **Sample sizes depend on the engine.** For a ~5-point interval on citation share: Gemini needs ~40-50 queries, Perplexity ~100,
  SearchGPT 150 or more [E45]. Fix the sample size in advance [E45]; no fixed budget suits every context [E46].
- **Repeats have diminishing returns.** Daily SD fell only from 0.0219 to 0.0195 going from 1 to 10 runs a day [M2]. Per-brand
  detection needs about 7 runs for an SE under 0.10 [M4].
- **Recommended methods:** bootstrap intervals that resample whole queries [E45, E46], content checksums to separate engine noise from
  page changes [E45], and placebo tests [E2].
- **Nobody publishes a full DiD protocol for AI visibility.** Vendors' "A/B tests" compare different prompt sets without controls (S).
  The best published example is the single-site controlled time series in [E2], which failed its placebo.

**Design for one client.**
1. **Unit:** question x engine. **Outcomes**, in order of sensitivity:
   - (a) the client's URL is retrieved or cited;
   - (b) the client is named;
   - (c) the client is recommended first.

   (a) moves first and has the highest base rate [E20], so it is the early indicator.
2. **Holdout questions.** Split the panel into matched treated and holdout questions, stratified by engine, intent and baseline rate.
   Actions target only the treated questions. Where actions spill over (earned media, the site's authority), use a staggered roll-out
   across question clusters instead.
3. **Difference-in-differences on question-level rates.** Use 4 weeks before and 4-6 weeks after; pages are picked up within days to
   30 days [E24], and citations decay within ~2-4 weeks [E33]. Compute a two-level bootstrap (questions, then answers), plus a temporal
   placebo and content checksums.
4. **Minimum detectable effect.** Answers to the same question are correlated, so the effective sample is roughly Q x m / (1 + (m - 1)
   x rho), and it never exceeds Q / rho however many repeats are run. The table assumes m = 28 answers per question per period (4
   engines x 7 runs), 80% power, alpha 0.05 two-sided, and unpaired worst-case variance. A paired design on the same questions cancels
   the stable question effect and should do better: estimate rho and the paired variance from the pilot.

| Baseline rate | Questions per arm | rho 0.3: pre/post MDE | rho 0.3: DiD MDE | rho 0.6: pre/post MDE | rho 0.6: DiD MDE |
|---|---|---|---|---|---|
| 2% | 40 | 5.0 pts | 7.1 pts | 6.9 pts | 9.7 pts |
| 2% | 100 | 3.2 | 4.5 | 4.3 | 6.1 |
| 10% | 40 | 10.7 | 15.2 | 14.7 | 20.8 |
| 10% | 100 | 6.8 | 9.6 | 9.3 | 13.2 |
| 10% | 200 | 4.8 | 6.8 | 6.6 | 9.3 |
| 30% | 100 | 10.4 | 14.6 | 14.2 | 20.1 |

   Read it this way. At techand.ai's 8-question panel, only a very large effect can be proven. **The number of questions, not repeats,
   buys power.** At a zero baseline (devaicon.com named in 0 answers), use an exact test of "first appearances on treated questions
   vs none on the holdout" rather than the normal approximation behind the table.
5. **Pre-register** each action's target questions, outcome and window before acting, so the result cannot be chosen after the fact.
6. **Attribute to the lever, not only the client.** Log every action with its questions. Across clients, pool the per-action effects in
   a hierarchical model, so the system learns which lever works for which question type and engine. This is the evidence the
   literature lacks [E2].

---

## 7. Implications for an algorithm that picks actions per question and per client

1. **Diagnose each lost question along the chain**, using data we already collect or can collect:
   - Does the engine search for it? (In ChatGPT, often not [E15, M4].)
   - What fan-out queries does it run?
   - Which URLs does it cite?
   - Is any client URL among them (exposure)?
   - Do the cited third-party pages name the client or its rivals?

   The failing link chooses the lever:
   - not eligible -> fix eligibility;
   - no client page matches the fan-outs -> write or refresh one, and get it ranked in that engine's index;
   - cited pages are third-party lists without the client -> outreach to be added;
   - cited pages are directories -> profile and reviews;
   - no search (a parametric answer) -> long-run earned mentions;
   - retrieved but not chosen -> format and differentiation (specific figures, proof, ratings [E38]).
2. **Pick winnable questions first.** Regional, low-prominence brands rarely surface on broad questions [E37, E7], so the panel needs
   narrow local high-intent questions ("Business Central partner in Abu Dhabi for e-invoicing", "custom AI development company in
   Lahore"). Score each question by its winnability: how many local rivals are named, and the domain types already cited.
3. **Engine-specific playbooks.**
   - Bing for Copilot.
   - Google for AIO and Gemini.
   - Brave for Claude.
   - For ChatGPT: the official site, licensed publishers, earned media, LinkedIn.
   - For Perplexity: Reddit, YouTube, G2-type sites [E25, E32].

   Re-learn the source mix monthly per engine, because it moves fast [E15].
4. **Rank actions by expected lift x probability x speed / cost,** with priors from §0, then update the priors from our own measured
   lifts (§6). Use exposure (outcome a) as the fast reward signal and mentions (b) as the slow one.
5. **Time model.** Eligibility: days. A new page cited: days to 30 days, if it ranks. Third-party list update: days to weeks.
   Earned-media retrieval: weeks. Parametric: one model generation. Refresh: every 4-8 weeks on winning pages.
6. **Hard exclusions:** self-ranked listicles, undisclosed paid placements, prompt-injection text, AI-only page versions, fake reviews,
   Reddit astroturfing [E13, E26, E41].
7. **Honest promises.** No published technique has a proven durable cross-engine causal effect [E2]. We should sell measured lift on
   pre-registered questions, not GEO scores, which were uncorrelated with discovery [E6].

---

## 8. Three most surprising findings

1. **Overlap with Google's top 10 is collapsing.** AIO citations from the top 10 halved in eight months (76% -> 38%), and 83% of
   ChatGPT's chosen URLs are not in Google at all for the same query [E9, E14]. Rank tracking of head terms says little about AI
   visibility; ranking for the fan-out queries is the lever.
2. **Retrieval exposure is almost the whole game, and it is sticky.** The client's own domain in the retrieval path goes with a jump
   from ~3% to ~50-58% mention rate, and prior visibility predicts future visibility with AUC 0.94 [E20]. Yet even a DA-84 site got
   only 42-59% of new pages cited within 30 days [E24].
3. **The GEO playbook mostly failed replication** (3 of 54 settings [E1]), and **self-ranked "best X" pages get the self-promoter left
   out 69% of the time** while the competitors on the list get named [E26]. The two tactics the market sells most are the weakest or
   counter-productive.

---

## 9. Sources (E keys opened 2026-11-05 unless (S))

**Academic:**
- E1 C-SEO Bench, Puerto et al. https://arxiv.org/abs/2506.11097 (v1 2025-06-06, v3 2025-10-20; NeurIPS D&B 2025; abstract, numbers via E2)
- E2 Critical survey of GEO 2023-2026 https://arxiv.org/html/2607.14035v1 (2026-07-15)
- E3 GEO-Bench, ranking manipulation https://arxiv.org/html/2605.29107v1 (2026-05-27)
- E4 Kumar, Lakkaraju, strategic text sequences https://arxiv.org/abs/2404.07981 (2024-04-11, v2 2024-09-02)
- E5 Chen et al., earned-media bias https://arxiv.org/html/2509.08919v1 (2025-09-10)
- E6 Sharma, the discovery gap https://arxiv.org/abs/2601.00912 (2026-01-01)
- E7 Kumar (Ranqo), GEO at scale https://arxiv.org/abs/2606.20065 (2026-06-18)
- E20 Tannenbaum, fitted stage model https://arxiv.org/abs/2609.23162 (2026-09-19)
- E21 Kandpal et al., long-tail knowledge https://arxiv.org/abs/2211.08411 (ICML 2023)
- E35 Brown et al., GPT-3 (Table 2.2) https://ar5iv.labs.arxiv.org/html/2005.14165 (2020)
- E37 Jack et al., prominence-stratified audit https://arxiv.org/abs/2605.27439 (2026-05-22)
- E38 Chu, Hou, incumbent advantage https://arxiv.org/abs/2606.17443 (2026-06-16, v3 2026-10-10)
- E42 Kamruzzaman et al., global vs local brand bias https://arxiv.org/abs/2406.13997 (EMNLP 2024) (S)
- E43 Brand retrieval and ranking in LLM recommendations https://arxiv.org/pdf/2609.16304 (S)
- E44 Wu et al., AutoGEO https://arxiv.org/abs/2510.11438 (2025-10-13)
- E45 Sielinski, quantifying uncertainty in AI visibility https://arxiv.org/html/2603.08924v2 (v2 2026-06-09)
- E46 Sielinski, rank stability and structural sufficiency https://arxiv.org/abs/2607.10341 (2026-07-11, v2 2026-08-26)

**Engine documentation:**
- E8 Google, AI features and your website https://developers.google.com/search/docs/appearance/ai-features (no date shown)
- E11 OpenAI crawlers https://developers.openai.com/api/docs/bots (no date shown)
- E12 OpenAI, ChatGPT search help https://help.openai.com/en/articles/9237897-chatgpt-search (403; snippet only (S))
- E13 Bing Webmaster Guidelines rewrite, via Search Engine Journal https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/ (2026-02-27)
- E16 Claude uses Brave: https://techcrunch.com/2025/03/21/anthropic-appears-to-be-using-brave-to-power-web-searches-for-its-claude-chatbot/ and https://simonwillison.net/2025/Mar/21/anthropic-use-brave/ (2025-03-21) (S)
- E17 Perplexity: https://docs.perplexity.ai/docs/perplexitybot and https://vespa.ai/perplexity/ (S)
- E22 Anthropic models overview (knowledge cutoffs) https://platform.claude.com/docs/en/about-claude/models/overview (read 2026-11-05)
- E39 Gemini API grounding with Google Search https://aistudio.google.com/docs/google-search (read 2026-11-05)

**Industry studies:**
- E9 Ahrefs, AIO citations vs top 10 (update) https://ahrefs.com/blog/ai-overview-citations-top-10 (2026-03-02)
- E10 Ahrefs, rankings vs AIO citations https://ahrefs.com/blog/search-rankings-ai-citations (2025-07-21)
- E14 Ahrefs, is ChatGPT powered by Google https://ahrefs.com/blog/is-chatgpt-really-powered-by-google (figures via snippet and secondary coverage (S))
- E15 Ahrefs, ChatGPT query fan-out (15M queries) https://ahrefs.com/blog/query-fan-out-chatgpt/ (2026-10-12)
- E18 Ahrefs, 75K-brand correlation https://ahrefs.com/blog/ai-overview-brand-correlation/ (2025-05-26)
- E19 Seer Interactive, what drives brand mentions https://www.seerinteractive.com/insights/what-drives-brand-mentions-in-ai-answers (2025-01-07)
- E23 Vercel / MERJ, the rise of the AI crawler https://vercel.com/blog/the-rise-of-the-ai-crawler (Dec 2024) (S)
- E24 Semrush, how fast AI search cites new content https://www.semrush.com/blog/how-fast-do-ai-search-platforms-cite-new-content/ (2025-12-10)
- E25 Overthink Group, B2B AI citation stats https://overthinkgroup.com/b2b-ai-citation-stats-2026-q2/ (2026-07-14)
- E26 Lily Ray, self-promotional listicles https://lilyraynyc.substack.com/p/why-calling-yourself-the-best-could (2026-06-17)
- E27 Muck Rack October 2026 coverage (journalism 27% -> 22%) https://martechseries.com/content/generative-pulse-earned-media-consistently-drives-ai-citations-holding-at-84/ (S)
- E28 PR Daily, "The 84% myth" https://www.prdaily.com/the-84-myth-why-the-pr-industrys-ai-numbers-are-wrong/ (2026-08-17)
- E29 Semrush + LinkedIn, 89K LinkedIn URLs, via PPC Land https://ppc.land/linkedin-ranks-2-in-ai-citations-what-89k-urls-reveal-about-b2b-visibility/ (study 2026-03-10)
- E30 G2, review platforms by funnel stage https://learn.g2.com/do-software-review-platforms-show-up-more-in-the-bottom-of-the-funnel (2026-02-13)
- E31 SourceRank, do G2 and Clutch help AI citation https://sourcerankai.com/blog/do-g2-and-clutch-reviews-help-ai-citation/ (2026-10-04)
- E32 Peec, most-cited domains in AI search https://docs.peec.ai/research/most-cited-domains-in-ai-search (2026-03)
- E33 Profound, the half-life of an AI citation https://www.tryprofound.com/blog/the-half-life-of-an-ai-citation-is-11-days (2026-09-30)
- E34 Kevin Indig, Growth Memo (44.2% from the first 30%) https://www.growth-memo.com/i/188121887/3-entity-richness (2026-02-16; paywalled (S))
- E36 Wikipedia, notability (organizations and companies) https://en.wikipedia.org/wiki/Wikipedia:Notability_(organizations_and_companies) (read 2026-11-05)
- E40 Ahrefs, AI search overlap https://ahrefs.com/blog/ai-search-overlap/ (2025-08-11)
- E41 Ahrefs, fake-brand misinformation experiment https://ahrefs.com/blog/ai-vs-made-up-brand-experiment/ (2025-12-10)
- E47 Kevin Indig, has Google demoted listicles https://www.growth-memo.com/p/has-google-demoted-listicles (2026-08-24; paywalled, findings not read)

Prior keys reused from MARKET_RND §6: M1 (SparkToro), M2 (Profound repeats), M4 (Schulte et al.), M21 (Muck Rack), M23 (Ahrefs
freshness), M25 (GEO), M27 (survey), M44 (Ahrefs schema), M45 (SE Ranking llms.txt), M46 (Ahrefs best lists).

### Least certain facts in this file
1. ChatGPT's search providers and its use of Google results come from snippets or paywalled reporting only (E12, The Information).
2. E14's 83.39% figure was read through snippets and secondary coverage. Ahrefs' own E15 and E40 are consistent with it.
3. Claude = Brave is from March 2025 (E16); Anthropic's current subprocessor page was not opened.
4. E20, E37, E7 and E45/E46 are single-author or vendor preprints, not peer reviewed. E20's numbers come from one monitoring platform.
5. Every industry study in §4 is a vendor's or an agency's. None has a control group except the tiny E24 / E41 experiments, and E24 has
   none.
6. The MDE table in §6 is my calculation under stated assumptions (rho, m, unpaired). It is a planning aid, not a measured result.
7. Model knowledge cutoffs other than Anthropic's were not verified from primary pages.
