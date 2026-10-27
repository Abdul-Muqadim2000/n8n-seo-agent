# AI search visibility: market R&D, 2026-10-23

Research only. No code was changed. This builds on the 6-day-old benchmark (`../system-review-2026-10-17/MARKET_BENCHMARK.md`
§2.8, §5 #8) and the score it fed (`../system-review-2026-10-17/SCORECARD.md` §3.8: 7/10 internal, 5 against the market).

The question this file answers: what would make Alaventra's AI visibility tracker, question panel and daily AI Pulse the best
enterprise-grade product of its kind, measured against what the leaders actually ship in October 2026.

## How to read this

**External sources.**
- Every external fact carries a source key, for example [PF7]. The keys resolve to exact URLs in §6.
- All external pages were **opened on 2026-10-23** by the six research sub-agents working for this report. The writer did not re-open
  each one.
- Tags on facts:
  - **(VC)** = the vendor's own claim, not independently verified.
  - **(3P)** = a third party; competitor reviews are named as such.
  - **(S)** = seen only in a search snippet, because the page would not open.
- "Not found" means searched for and not found. It does **not** prove the product lacks the feature.
- Where two vendor pages disagree, both are given.

**Alaventra's column.** It comes from the repo, read 2026-10-23:
- `n8n/seo-agent/AI_VISIBILITY_SPEC.md` [AV-SPEC] and `docs/AI_PANEL_SCALE_HANDOFF.md` [AV-G6];
- `AI_GROWTH_SPEC.md` [AV-GROW], `app/docs/LOG_ANALYTICS.md` [AV-LOG], `app/docs/INTEGRATIONS.md` [AV-INT] and `app/API.md` [AV-API];
- the engine code: `v5/code/Parse_AI_Answers.js`, `AI_Metrics.js`, `_ai_stats.js` and `_ai_panel.js` [AV-CODE].

**What is live and what is only built.**
- The 500-question panel (G6) was merged on 2026-10-18 and shipped in the 2026-10-21 production release.
- It has **never run live above 8 questions**: techand.ai is at 8, and the paid run of 2026-10-21 set the panel to 8
  (`../LIVE_RUN_2026-10-21.md`).
- Everything at scale below is therefore built and harness-tested, **not live-verified**.
- The last independent score of this area is 7/10 (SCORECARD §3.8), measured on 7 questions.

**Prices.**
- Per-prompt prices are list prices divided by plan allowances, with the arithmetic shown.
- Plans often bundle other products, so a per-prompt figure is an upper bound of what the tracker alone costs.

---

## 1. Capability matrix

Abbreviations used in the cells:
- **q** = a tracked prompt (question).
- **UI** = answers scraped from the consumer web interface.
- **API** = answers from the model's developer API.
- **AIO** = Google AI Overviews; **AI Mode** = Google AI Mode.

### 1A. Alaventra and the AI-visibility specialists

| # | Capability | **Alaventra today** | Profound | Peec AI | Evertune | Scrunch (Sitecore) | AthenaHQ |
|---|---|---|---|---|---|---|---|
| 1 | Engines and how they are read | 6 by default: ChatGPT (UI scraper), Gemini (UI scraper), Perplexity (API, sonar, country set), AIO and AI Mode (SERP), Claude (API, **monthly**; no UAE localisation). Opt-in: Copilot (Bing results' summary, rarely present: 0/10 live), ChatGPT API and Gemini API (prices are estimates, never called live). No Grok, DeepSeek or Meta AI: DataForSEO has no endpoint for them. Logged-in state not controllable [AV-SPEC §2, §10.5; AV-G6 §1; D1] | Trial: 3 engines. Enterprise: up to 9 (ChatGPT, Perplexity, AI Mode, Gemini, Copilot, DeepSeek, Claude, AIO, Exa). "Front-end results"; logged-in state not found [PF1][PF2]. Exa added 2026-09-04 [PF3] (VC) | Logged-out UI scraping [PE1]. ChatGPT, Perplexity, Gemini, AIO, AI Mode, Claude, Copilot, Grok [PE2]. Added Meta Muse Spark and Naver AI Briefing in Sep–Oct 2026 [PE3] (VC). Perplexity moved to Enterprise only [PE4] (3P) | Two layers: API for what the model knows without search (Gemini, GPT, Claude, Llama, DeepSeek) and consumer apps with search (Gemini, AIO, AI Mode, ChatGPT Search, Perplexity, Copilot) [EV1] (VC) | 9: ChatGPT, Perplexity, AIO, AI Mode, Gemini, Claude, Copilot, Grok, Meta AI. "Browser automation and official platform APIs", chosen per platform [SR1][SR2] (VC) | Essential tier: 5 engines. Starter tier: 11, incl. Grok, DeepSeek, Meta AI, Mistral [AT1]. Collection method not found [AT2] (VC) |
| 2 | Panel size and how prompts are made | 3–500 q (new sites start at 50). Written per role × market from LLM Mentions, People-also-ask, Search Console questions, the site's services and rival headings. Deduplicated by meaning; a fit gate refuses own-brand, rival-brand and government questions and stores them with the reason. Owner CSV import, pin, edit [AV-G6 §2; AV-SPEC §10.1] | Trial 50 (fixed set); Enterprise custom [PF1] | Discovery wizard: profile, markets, topics, distribution (20% branded by default) [PE5]. Starter 50 / Pro 150 / Advanced 350 [PE13] (3P) | Prompts from EverPanel (">150M real conversations"); standard design 100 q in 10 topics [EV2] (VC) | 350 / 700 custom q plus 1,000 / 2,500 industry q [SR3] | Credit-limited, "unlimited prompts". Discovery from site, GSC, social, keyword gaps, competitors [AT1][AT4] |
| 3 | Personas and markets | ≤ 6 buyer roles and ≤ 5 markets (country-language). The persona shapes the **wording only**; no persona context is sent to the engine [AV-SPEC §10.1] | Structured personas: age, company size, seniority, motivations and more. Each persona is a separate prompt. Regions down to city [PF4][PF5] | Location per prompt; language per market; personas used only during discovery [PE5] | Not found | 3–5 personas. The description is passed to ChatGPT, Claude and Grok; other engines get the name only. 88 countries [SR4][SR5] | Personas and locations as run options; multi-region on Enterprise [AT1][AT4] |
| 4 | Sampling: repeats and frequency | Weekly: every q once on each weekly engine. **Pulse** Tue–Sun: ChatGPT, Gemini and AI Mode on every q (≤ 50 q), or a stratified rotating sample of N mornings a week. About 100 answers per q per month at ≤ 50 q (derived: 5 weekly engines × 4.33 + 3 pulse engines × 26). Claude: 1 a month [AV-SPEC §3–4; AV-G6 §2] | Once a day by default; Enterprise can change it [PF2]. Own study: 1×/day is enough at portfolio level [PF6] | Daily; repeats not found. Weekly option costs ⅓ of the credits [PE12] | 100 samples per prompt per model (Pro and up); daily [EV2][EV3] | Daily for a prompt's first 14 days, then every 72 h, plus on demand [SR2] | Weekly (every 1–4 weeks) or monthly; daily not mentioned [AT4] |
| 5 | Statistics shown | 95% Wilson range on every rate. Two-proportion z-tests; Holm correction on headline alerts, Benjamini–Hochberg (q = 0.10) on segments. "Too few" under 12 answers. No delta when under 80% of the panel is shared [AV-SPEC §4, §10.4] | None in the product. A blog study gives standard-error formulas [PF6] | Not found | Margins of error: ±1 point overall, ±2 per topic at 100 × 100. Confidence level and test not stated [EV2] | Nightly "statistically meaningful movement"; test not stated [SR6] | AI Search Value API returns standard error, sample size and drift per topic [AT5] |
| 6 | Mention rate (and its denominator) | Named ÷ answered answers over 7 days (weekly + pulse); Claude and the brand question excluded [AV-SPEC §4] | Runs naming the brand ÷ runs naming **any** brand; no-brand runs excluded; models weighted equally [PF7] | Responses naming the brand ÷ all responses [PE6] | % of responses mentioning the brand [EV4] | Responses naming the brand ÷ all responses [SR7] | Mentions ÷ responses naming ≥ 1 tracked brand [AT6] |
| 7 | Citation rate | Answers citing your domain, plus the cited URLs per answer [AV-CODE Parse_AI_Answers] | Citation share = your citations ÷ all citations [PF7] | Retrieved vs cited [PE7] | Source count, source share, owned source share [EV4] | Responses citing ≥ 1 owned URL ÷ all; citation share of voice [SR7] | Sources vs citations defined [AT2] |
| 8 | Position in the answer | Rank among the businesses the answer names, in order of first mention. Not named = 0; a citation alone is not a rank [AV-CODE Parse_AI_Answers l.68] | Average position over runs that name the brand [PF7] | Average rank; **win rate** = chats where the brand ranks first [PE6] | Average position (no formula) [EV4] | Position score: top 100 / middle 50 / bottom 0; plus first-mention rank [SR7] | avg_position, method not given [AT6] |
| 9 | Share of voice | Yours ÷ (yours + top 8 rivals), with brand names merged into their domains [AV-SPEC §4] | Brand mentions ÷ all brand mentions, once per run [PF7] | Same definition [PE6] | "Share of Answer" [EV4] | Mentions normalised over the competitive set [SR7] | 0–100, formula not given [AT6] |
| 10 | Sentiment | Claude Answer Analyst: positive / neutral / negative plus why; descriptors. **Capped at 24 analyst jobs a run**, so only a subset of answers [AV-SPEC §2–3] | 100 × positive claims ÷ all claims [PF7] | 0–100 tone score; "most fall between 65 and 85" [PE6] | −100 to +100 [EV4] | ML model: positive 100 / mixed 50 / negative 0 [SR7] | 3-class [AT2] |
| 11 | Composite score | Visibility score 0–100 = rank weight × (1 if cited, 0.85 if not), cited-only = 0.4, weighted by log demand; formula published in-repo [AV-SPEC §4] | Not found | Not found | "AI Brand Score", weighted, no formula [EV4] | Not found | AI Search Value in dollars [AT5] |
| 12 | Source analysis (incl. which of the customer's URLs are cited) | Cited domains; your top 10 cited pages with their engines; rival sources; pages AI cites without naming you (handed to AI Growth). **Not done**: source types; retrieved-but-not-cited [AV-CODE AI_Metrics l.188; AV-GROW §2.5] | By domain and page, categories; **Citation Decay** (half-life of cited URLs, 2026-08-14) [PF3][PF12] | Retrieved vs cited; types (Editorial, Corporate, UGC, Reference, Own); URL formats; gap score [PE7] | Strength and opportunity URLs [EV4] | Influence and Winnability score per cited page [SR8] | Source domain / URL analytics, tags [AT2] |
| 13 | Competitor benchmarking | Rivals by domain from answers plus declared rivals; per-segment leader [AV-SPEC §4; AV-API ai-segments] | Leaderboards, over time [PF12] | Gap analysis [PE7] | Rivals found, scored, ranked automatically [EV6] | By competitor × persona × topic × geo [SR13] | Heatmap, competitive landscape [AT1] |
| 14 | Prompt volume | DataForSEO AI search volume (derived from People-also-ask) and LLM Mentions volume. "Estimated answers naming you" labelled an estimate. LLM Mentions' ChatGPT data is US-English only [AV-SPEC §2; D13][D14] | Licensed conversation panel + probabilistic modelling; 35 countries since 2026-08-28; API 2026-09-25 [PF8][PF3] | "Search volumes" on suggested prompts; method not found [PE1] | "Estimated weekly prompts" from EverPanel [EV5] | AI Search Trends from a panel of ">100M consumer AI interactions" [SR9] | Listed; method not found [AT1] |
| 15 | Query fan-out | Read wherever DataForSEO returns it (ChatGPT scraper; LLM Responses); shown on gaps; feeds the writer's sections [AV-CODE Parse_AI_Answers l.31; AV-GROW §2] | Query Fanouts report (API; Prompts tab since 2026-09-25) [PF3] | Query Fanouts page (2026-07-06); Claude fan-outs added 2026-10-13 [PE3] | Not found | Not found | Search queries shown per response, CSV [AT2] |
| 16 | AI shopping / product cards | **None.** The ChatGPT scraper already returns `chat_gpt_products` and AI Mode returns `ai_overview_shopping`; both are fetched and ignored [AV-CODE; D8][D15] | Enterprise: ChatGPT Shopping trigger rate, merchant share, SKU metrics. Perplexity and Gemini "in development" [PF9] | ChatGPT carousel: product visibility, position, win rate; catalogue upload [PE8] | Shopping visibility, trigger rate [EV4] | Share of Shelf, first-position rate, DTC vs third party [SR10] | Carousel cards on ChatGPT, AI Mode, Gemini (Gemini added Oct 2026) [AT7][AT3] |
| 17 | Alerts | Weekly: significant drop, an engine stops citing you, rival +10 points, new wrong claim, negative sentiment, blocked crawler, AI visits −30%. Daily: 99% z, Holm. E-mail, callback, app, Slack / Teams [AV-SPEC §2; AV-INT] | Agent triggers on visibility, sentiment, citations or FactCheck: threshold plus window [PF10] | Not found | Not found | Alerts and scheduled reports [SR13] | "Real-time mention alerts"; Slack PDFs [AT1] |
| 18 | Actions, content, publishing | AI Growth, weekly: ranked actions; questions to win → answer / refresh pages via the cadence; earned media → Link Builder outreach from the customer's own mailbox; Bing SubmitUrlBatch and IndexNow; Wikidata; readiness as the AI fetchers see it. CMS publishing to WordPress / Webflow / Contentful / webhook [AV-GROW; CLAUDE.md 2026-10-18] | AI Marketer / Agents draft with approval; Dynamic Bot Rendering (2026-09-18) [PF3] | Ranked Actions in 4 groups with briefs; Impact page; does not publish [PE9] | Content Studio posts; ad partners (Trade Desk etc.) [EV6] | Content with fact and voice check; does not post; AXP serves AI bots a different page at the CDN [SR11][SR12][SR13] | Brief → draft → publish to 8 CMSs [AT8] |
| 19 | Accuracy / fact check | Wrong claims checked against the business profile; correction drafts. Not run on techand.ai: no profile filled (SCORECARD 4A.5 = 5) [AV-SPEC §2] | FactCheck: 100–200 fact prompts against a knowledge base [PF11] | Fact-checking: contradicted / supported [PE10] | "Fact Checker" (Enterprise) [EV3] | Up to 40 claims per draft against Knowledge Studio [SR11] | Oracle: ≥ 25 knowledge-base facts, inaccuracy rate [AT9] |
| 20 | Crawler / agent analytics | App Crawlers page: upload, Cloudflare Logpush, Vercel, Fastly, Akamai. Bots verified by IP / reverse DNS, impostors counted apart, joined to the page inventory. **Not joined** to AI citations [AV-LOG] | Logs from 12+ sources (CloudFront, Cloudflare, Vercel, Fastly, Akamai, S3…) [PF12] | Crawl insights: logs joined with retrievals and citation rate per URL [PE11] | Bot analytics (Enterprise) [EV3] | Cloudflare, Akamai, Vercel, CloudFront, Fastly, Azure [SR14] | None (readability audit only) [AT11] |
| 21 | Integrations, exports, API, MCP | Read API `/api/v1` incl. `ai-segments`; MCP incl. `get_ai_visibility_segments` and `start_run`; S3 / BigQuery export; Looker Studio connector; signed webhooks; Slack / Teams; Jira / Linear / Asana [AV-API; AV-INT] | REST, SDKs, MCP, Looker, Tableau, CSV [PF12] | API, MCP, Looker [PE2][PE3] | Data MCP; bucket exports (Enterprise) [EV3] | APIs, warehouse loading via API, Looker, MCP, Zapier [SR15] | REST (add-on), MCP, Looker, Power BI [AT10] |
| 22 | Reporting | Weekly report + PDF, app page with segments and ranges, white-label agency portal [AV-SPEC §7; CLAUDE.md] | Dashboards, annotations, CSV (2026-10-09) [PF3] | Exports, public share links [PE3] | Dashboards [EV6] | Scheduled reports, CSV [SR13] | Report builder, public reports [AT1] |
| 23 | Price per prompt-month | **Cost** (DataForSEO + Claude) per [AV-G6 §4]: 20 q $9.40 → $0.47; 50 q $22.37 → $0.45; 100 q $28.86 → $0.29; 500 q $138.36 → $0.28. Customer price under the credits model ≈ 3× cost (internal note, list prices still PLACEHOLDER) → ≈ $0.84–1.41 | Not computable: credit undefined. Agency $99 + $399 per workspace [PF1] (S) | $95 / 50 = $1.90; $245 / 150 = $1.63; $495 / 350 = $1.41 (monthly) [PE4] (3P) | Unverified derivation from calculator: ≈ $0.24–0.36 [EV3] | $300 / 350 = $0.86; $500 / 700 = $0.71 (custom q only; 72 h cadence) [SR3] | $295 for 3,600 responses → $7.38 daily on 3 engines, ≈ $1.06 weekly [AT1] |

### 1B. Suites (SEO platforms with an AI visibility module)

| # | Capability | Semrush AI Toolkit / Enterprise AIO + Adobe Brand Visibility | Ahrefs Brand Radar | Similarweb AI Brand Visibility | Conductor | BrightEdge (AI Catalyst / Hyper Cube) | seoClarity ArcAI |
|---|---|---|---|---|---|---|---|
| 1 | Engines and how | Toolkit: ChatGPT, Gemini, AIO, AI Mode (Perplexity in Brand Performance). Read "from real requests and not via any APIs of LLMs" [SE1][SE2]. Enterprise AIO adds Claude, Perplexity [SE10]. Adobe: ChatGPT, AI Mode, Copilot, Perplexity [AD8] (3P) | AIO, AI Mode, ChatGPT, Perplexity, Gemini, Copilot, Grok (Apr 2026); Claude for custom prompts only. "Free, publicly available web interfaces" [AH1][AH2][AH4] | ChatGPT, AI Mode, Gemini, Perplexity [SW1]. Method not stated | 9: ChatGPT ×2 modes, Claude, Gemini, AI Mode, AIO, Grok, Copilot, Perplexity. **Official APIs**; one response per prompt shared across accounts [CO1] | ChatGPT, Perplexity, AIO, AI Mode, Gemini [BE1]. Method not published [BE6] (3P) | ChatGPT, Perplexity, AI Mode, AIO, Gemini; "NEW": DeepSeek, Claude, Copilot, Grok [SC1]. Method not published |
| 2 | Panel and database | Database: 317M prompts [SE1]. Tracking: 25 ($99) up to 200 or "unlimited" (conflicting pages) [SE2][SE4]. Adobe: ~300M [AD8] | 496M+ prompts a month, from PAA + "semantic fanout" [AH1][AH2]; 30M per platform since Jul–Aug 2026 [AH6]. Custom: 5 / 10 / 20, Enterprise 83+ [AH1] | 150 tracked q on every plan; "normalized from real AI searches" [SW2] | ≤ 100 generated per topic (5–500) from keywords, content, personas [CO1][CO3] | Builds prompts mapped to journey stages; does not know exact prompts (Hyper Cube infers them) [BE1][BE4] | From 500 q; clickstream-based research [SC1][SC4] |
| 3 | Personas and markets | Persona-based generation (2025-12-22) [SE5]; 220+ countries for tracking [SE2] | Locale mirrors the keyword database; personas not found [AH2] | Region and language per campaign [SW3] (S) | 160+ countries, city / state; custom personas; 8 intent classes [CO1][CO2] | "Answers change depending on the asker" [BE1] | Fixed country and language per topic [SC7] (S) |
| 4 | Sampling | Tracking daily; Brand Performance weekly [SE1][SE2] | ChatGPT, Perplexity, Gemini, Copilot **monthly**; AIO and AI Mode continuous; custom prompts daily / weekly / monthly [AH2] | Daily [SW2] | Daily / weekly / monthly; **latest response only, no aggregation** [CO1] | Not published [BE5] | "A sampling methodology", no numbers [SC4] |
| 5 | Statistics | Not found | "Directional indicators" [AH2] | Not found | Not found | Not found | Not found |
| 6–9 | Mention, citation, position, share of voice | Visibility 0–100 vs competitors' median (no formula); citations; average position = citation order; share of voice [SE3]. Adobe: share of voice "incorporates search demand and ranking position" [AD1] | Mentions = string match; citations = linked URLs; share of voice (no formula); average citation position [AH2][AH4] | Visibility rate; brand mention share; brands "in order of recommendation" [SW1][SW2] | Mention once per response; share of voice; **no position** ("no stable position") [CO1] | Presence per engine; share of voice and rank listed without definitions [BE1][BE6] | Visibility, share of voice, "Share of Shelf" [SC3] |
| 10 | Sentiment | Overall + drivers; Adobe per aspect [SE3][AD1] | Only as an agent skill [AH1] | 3-class by topic [SW4] | 1–10 per mention, 9 aspects; per product since 2026-10-02 [CO1][CO5] | 3-class "with reasoning" [BE1] | Yes, method not found [SC3] |
| 11 | Composite / reach | AI Visibility Score; AI Topic Volume [SE3] | **Estimated impressions** = mentions × volume; "AI-adjusted volume" since Jul–Aug 2026 [AH2][AH6] | Prompt visibility and influence scores [SW4] | Coverage [CO1] | Not found | Not found |
| 12 | Sources | Cited pages; Adobe URL details with prompts [SE3][AD5] | Yours / rivals / other; **"found but not cited"**; bot visits and AI traffic on cited pages [AH4][AH5][AH7] | Down to URL; domain influence [SW1] | Top cited pages, page groups, "influential sources" [CO2] | Cited publications, creators [BE1][BE4] | Mentions vs citations; page indexer [SC1] |
| 14 | Prompt volume | AI Topic Volume from third-party AI interaction data [SE3] | AI-adjusted volume [AH6] | Real prompts; method not stated [SW2] | **Refuses**: "not provided", unreliable [CO1][CO10] | Modelled demand [BE4] (3P) | Clickstream [SC4] |
| 15 | Fan-out | Enterprise AIO: fan-out queries + who ranks for each (2026-01-15) [SE6] | Per answer [AH5] | Not found | ChatGPT, Gemini, Claude, Grok; next to every answer since 2026-07-21 [CO1][CO4] | Not found | Not found |
| 16 | Shopping | Enterprise AIO: ChatGPT + AI Mode shopping, products, frequency, position, merchants (2026-03-06) [SE7] | Not found | Not found | MCP template only [CO9] | Not found | ArcAI Shopping, Share of Shelf [SC3] |
| 17 | Alerts | Not found [SE2] | Through the Letaido agent only [AH1] | Not found | Monitoring alerts, Slack / Teams; AI-visibility alerts not found [CO4] | Rival takes over an answer you held [BE1] | Not found |
| 18 | Actions / edge | Adobe **Optimize at Edge**: AI-agent-only HTML at 7 CDNs, preview / deploy / rollback; impact engine re-runs prompts after a deploy (~2 weeks) [AD3][AD6] | Descriptive [AH1] (3P); agent beta [AH7] | Content gaps [SW1] | Recommendations scored 1–10 → Writing Assistant (2026-09-21) [CO6] | **Agent Edge**: Markdown to verified agents; $10,000 / month on AWS [BE2][BE3] | Narrative control, agentic briefs, Jira [SC3] |
| 20 | Crawler analytics | Adobe: CDN logs (Akamai, Cloudflare, CloudFront, Fastly, Imperva); success rate, TTFB [AD4][AD5] | Bot Analytics, Cloudflare only [AH6] | Not found | Log File Analysis: OpenAI ×4, Perplexity ×2, Claude ×3, Meta, Grok, Google-Agent [CO7] | Agent Edge dashboard; server logs [BE2][BE4] | AI bot tracking add-on [SC1] |
| 21 | Integrations | MCP, Claude connector (2026-08-26) [SE8]; Adobe Analytics [AD8] | API v3, Looker, MCP [AH4][AH5] | API, MCP [SW3] | Data API, MCP (Claude, Gemini, ChatGPT), Looker, Adobe Analytics [CO4] | MCP, CSV / PNG [BE1][BE7] | API, MCP [SC2][SC3] |
| 23 | Price per prompt-month | $99 / 25 = $3.96; add-on $60 / 50 = $1.20; Semrush One $199 / 50 = $3.98, $299 / 100 = $2.99 (with the SEO suite) [SE2][SE4] | Custom-prompt packs daily: $50 / 83 ≈ $0.60, $100 / 233 ≈ $0.43, $250 / 833 ≈ $0.30; Claude counts 8× [AH1][AH4] | $99 / 150 = $0.66 (AEO plan) [SW3] | Credits only: 2,500 a year buys ≈ 24 weekly ChatGPT-Search q or ≈ 480 weekly AI Mode q [CO1][CO8] | Quote only [BE7] | Quote only; suite floor from $2,500 / month (2022 prices) [SC2] |

### 1C. Mid-market trackers and new entrants

| # | Capability | Search Atlas | Otterly.ai | Goodie | Writesonic GEO | Gauge | SE Visible | Surfer AI Tracker |
|---|---|---|---|---|---|---|---|---|
| 1 | Engines and how | 3 → 6 by plan (ChatGPT, Gemini, AI Mode; + Copilot, Perplexity, Claude); method not published [SA1] | ChatGPT, AIO, Perplexity, Copilot; add-ons AI Mode, Gemini, Claude. UI, **Claude by API** [OT1][OT4] | Up to 13: incl. Claude, Meta AI, DeepSeek, Grok, Alexa, Sparky [GO1] | "Scrape the actual web interfaces", routed through locations; Enterprise 9 [WS1][WS2] | ChatGPT **logged-out UI**, Claude by API; AI Mode, Copilot; Enterprise adds AIO, Gemini, Perplexity [GG3] | ChatGPT, Gemini, AI Mode, AIO; real browser sessions [SV1] | Gemini, AIO, AI Mode, ChatGPT, Perplexity; "scraping real answers" [SU1] |
| 2 | Panel | 100–250 [SA1] | 15 / 100 / 400; Enterprise 1,000+ [OT1] | 110 / 250 / 500+ [GO1] | 50 / 100 / 200 [WS1] | 600 daily [GG2] | 200 / 450 / 1,000 [SV1] | 25–100 [SU2] |
| 3 | Personas / markets | Country only [SA3] | 60+ markets; personas not found [OT1][OT2] | 2–8+ countries and languages [GO1] | Market = country + language, ≤ 10 [WS6] | Single location (Growth) [GG2] | 7 countries, 5 languages [SV1] | Not found |
| 4 | Sampling | "Real-time", no interval [SA3] | Daily, 1 run [OT4][OT5] | Daily [GO1] | Daily; up to 3 answers per q per day (derived) [WS1] | Daily, 1 per engine (derived: 600 × 30 × 3 = 54,000) [GG2] | Daily, 1 per engine (vendor's example) [SV1] | "Multiple queries per day per model, then average" [SU3] |
| 5 | Statistics | Not found | Trend flag only [OT2] | Index withheld until "statistically stable" [GO4] | Not found | Not found | Not found | Not found |
| 6–11 | Metrics | Visibility, share of voice, first / last position, 3-class sentiment [SA2][SA3] | **Formulas published**: coverage, share of voice, average position, net sentiment, Brand Visibility Index [OT3] | Visibility, share of voice, position rank [GO3] | Visibility, share of voice, position tiers, sentiment, Citation Authority [WS4] | Coverage, citation rate; sentiment Enterprise only [GG4] | Visibility Score = presence + position, per engine, combined (no weights) [SV1] | Mention rate, average position, visibility score [SU1] |
| 12 | Sources | Cited domains with share [SA3] | Citations winners / losers, domain sources [OT2] | Own vs third-party [GO4] | "My Pages Cited"; own / rival / third party [WS4][WS13] | Domains, URLs, your pages, Reddit, YouTube [GG4] | Top domains and URLs by type [SV1] | Top sources; Looker by URL [SU4] |
| 14 | Prompt volume | Not found | "Intent Volume", method not published [OT6] | Claimed (S) | 5 one-time runs [WS1] | Mapped from linked keywords; **says it is not real ChatGPT volume** [GG5] | Not found | Not found |
| 15 | Fan-out | Not found | GEO audit fan-out, add as prompts [OT2] | Listed (S) | Not found | Not found | "Coming soon" [SV1] | Not found |
| 16 | Shopping | Not found | ChatGPT shopping cards (ads paused 2026-09-16) [OT2] | SKU-level on ChatGPT, Rufus / Alexa, AI Mode, Perplexity; revenue per SKU [GO8] | AI Shopping Tracker (Enterprise) [WS10] | Not found (tracks ChatGPT ads) [GG1] | Not found | Not found |
| 17 | Alerts | Negative sentiment; agent posts drops to Slack [SA2] | Not found | Crawler-access alerts [GO7] | 10 metrics, custom thresholds (Enterprise, e-mail) [WS7] | Scheduled Slack / e-mail tasks [GG1] | Not found | None for AI visibility [SU3] |
| 18 | Actions | OTTO, Content Genius [SA2] | Recommendations, GEO audits, annotations [OT1][OT2] | Agents, WordPress publish [GO1][GO6] | Action Center, content score, WordPress [WS12][WS14] | Action Center, 18 articles a month, CMS publish [GG1] | None | Recommendations + content suite [SU3] |
| 20 | Crawler analytics | Not found | Since 2026-08-04: upload, webhook, Cloudflare, WordPress [OT2] | Vercel, Cloudflare, AWS, Akamai, GCP [GO6][GO7] | Cloudflare, WordPress, Vercel, Fastly, CloudFront… [WS8] | Cloudflare Worker, Vercel drains (coding agents) [GG6] | Not found | Not found |
| 21 | Integrations | MCP with 30 LLM-visibility tools [SA5] | API / MCP, Looker [OT1] | MCP; API Enterprise [GO1] | MCP (87 tools), REST, Looker [WS9] | API, MCP, CLI [GG1] | API, CSV [SV1] | API, MCP, Looker [SU2] |
| 23 | Price per prompt-month | $1.99–4.00 (suite included) [SA1] | $1.93 / $1.89 / $1.22; extra $0.99 [OT1] | $2.68 / $4.00 [GO1] | $1.58–2.00 annual [WS1] | $599 / 600 = $1.00 [GG2] | $0.495 / $0.42 / $0.355 [SV1] | $1.64–3.96 (suite included) [SU2] |

### 1D. Other entrants with evidence (short)

- **Bluefish:**
  - "10+ LLMs tracked daily including Alexa for Shopping" [BF1].
  - Personas; an accuracy check with "91% agreement with independent human review" [BF2] (VC).
  - Citation analysis down to the URL [BF2].
  - $43M Series B, 2026-04-14 [BF6] (3P). No public prices.
- **Daydream:** agency plus software; a free dashboard built by its team [DD1]. No public metrics or prices.
- **LLMrefs:**
  - $79 / 500 prompts = $0.158 per prompt-month, weekly.
  - 9 engines incl. Grok and Meta AI; 50+ countries [LR1] (VC).
- **LLM Pulse:** extracts every ChatGPT Shopping carousel product (title, price, rating, merchant) [LP1]; Rufus / Alexa as an add-on [LP2] (VC).
- **Azoma:** Rufus, Walmart Sparky, ChatGPT, AI Mode; SKU-level discoverability, PIM / Merchant Center sync [AZ1] (VC).
- **Pixis Visibility:** $3M ARR within 60 days of launch, announced 2026-10-12 [PX1] (3P relaying the vendor).
- **geoSurge:** $12M seed, 2026-07-03 [GS1] (3P).
- **Profound:** $180M Series D at $1.8B post-money, 2026-09-15 [PF13] (3P relaying Bloomberg).
- **Analysts:**
  - Gartner's first "Market Guide for Answer Engine Visibility Tools" is dated 2026-03-09 (paywalled; quoted by vendors [GT1]).
  - Forrester's "Answer Engine Optimization Technologies Landscape, Q3 2026" is dated 2026-08-28 [FR1]. Its quoted advice: "look under the hood of any platform to understand the data that powers the insights".

### 1E. DataForSEO: what we can buy (it decides what is buildable)

**LLM Responses (developer APIs)** [D1][D2][D4]–[D7]:
- Covers ChatGPT, Claude, Gemini and Perplexity.
- Live price: $0.0006 + the model's price.
- Returns `fan_out_queries` and text-level `annotations`.
- ChatGPT takes `system_message` / `message_chain`, country and city.
- **Claude localises to 36 countries only; AE is not one.**
- **Gemini Responses takes no location.** Perplexity takes a country only on Sonar models.

**LLM Scraper (consumer interfaces)** [D3][D8][D9]:
- **Only ChatGPT and Gemini.** Price: Live $0.004, Priority $0.0024, **Standard $0.0012** (up to 45 min).
- The ChatGPT scraper returns:
  - `search_results` (everything the model retrieved) and `sources` (what it cited);
  - `fan_out_queries` and `brand_entities`;
  - **`chat_gpt_products`** (merchant, price, rating, Google Shopping ids) and **`chat_gpt_ad`**;
  - `chat_gpt_local_businesses`.
- The Gemini scraper returns text, tables and sources only.
- No logged-in option and no device setting is documented.

**Google AI Mode SERP** [D15][D16]:
- Price: $0.004 live / $0.0012 standard.
- Returns **`ai_overview_shopping`** (product, price, seller, marketplace), references and paid items.
- Device setting available.

**AI Overview** [D17]: organic SERP at $0.002 live, plus an async AI Overview for $0.002 more.

**Copilot**: only as Bing organic's `ai_overview` item [D18].

**LLM Mentions** [D10][D11][D12][D20]:
- Price: $0.10 a task + $0.001 a row.
- Data: 280M prompts and answers, 60-day refresh.
- Endpoints added 2026-07-07: `top_mentioned_brands`, `historical` (monthly from 2025-08), `timeseries_new_lost` and Lite versions.
- **ChatGPT data is US-English only.**

**AI search volume** [D13][D14]: derived from People-also-ask counts; $0.01 a task + $0.0001 a keyword.

**Not available** [D19]:
- Grok, DeepSeek, Meta AI, Amazon Rufus / Alexa, a Copilot LLM endpoint, Claude or Perplexity interface scrapers.
- Rate limit raised to 10,000 requests a minute on 2026-10-19.

**Google, Bing, GA4:**
- Search Console's generative-AI report (AIO + AI Mode impressions per page) is **UI + export only, no API** [G1][G2]. AI traffic sits inside "Web" [G3].
- Bing Webmaster **AI Performance** (citations per page across Copilot, public preview since 2026-02-10) has **no documented API** [B1].
- GA4 has a native **"AI Assistant"** channel (medium `ai-assistant`) since 2026-05-13 [GA4a][GA4b].

---

## 2. Where Alaventra leads, and where it trails

### 2.1 Leads (specific, with the evidence; each is "built", most not live at scale)

**1. Uncertainty in the product, and refusals.**
- Every rate carries a 95% Wilson range, and changes are z-tested.
- Two corrections are applied: Holm for headline alerts, Benjamini–Hochberg for segment moves.
- A delta is refused when the panel changed (under 80% of the same questions) [AV-SPEC §4, §10.4].
- **No vendor in 1A–1C shows an interval in the product:**
  - Evertune publishes margins on its methodology page but states no level or test [EV2].
  - AthenaHQ exposes a standard error only through an API [AT5].
  - Scrunch flags "statistically meaningful movement" without naming the test [SR6].
  - Ahrefs calls its numbers "directional" [AH2], and Conductor reports the latest single response [CO1].
- The methodology search found **no AI-visibility source that addresses multiple-comparison correction** (§4 L).
- **This lead is real but has a hole:** the intervals treat answers as independent. See §4.1.

**2. The cost of every engine is published before you pay.**
- Golden-tested cost model, ledger reservation and settlement [AV-G6 §2.7, §4].
- Only Conductor publishes per-engine credits [CO1], and it sells no dollar price.

**3. Measuring revenue from AI.**
- GA4 AI referrals, key events and revenue per assistant [AV-SPEC §4].
- Others now have GA4 too: Peec (2026-09-11) [PE3], Profound [PF3], Goodie [GO6], Adobe through Adobe Analytics [AD8].
- **This is no longer a lead, only parity.**

**4. Acting through Bing and IndexNow, and checking Wikidata.**
- Each week: `SubmitUrlBatch`, the crawl state of each page, IndexNow, and a Wikidata entity check [AV-GROW §2].
- Not found in any vendor researched here.

**5. One loop from a lost question to a won page.**
- A lost question becomes a page to write: an answer page, a refresh, or the ladder page.
- The page writer covers each fan-out search with its own section.
- The pages AI cites without naming you go to outreach, sent from the customer's own mailbox under consent rules.
- "Won" is recorded only when an answer later names the business [AV-GROW §2].
- Others draft pitches or pages: Scrunch Citation Optimization [SR8], Profound inaccuracy drivers → outreach [PF11], AthenaHQ outreach over MCP [AT3], Peec Actions [PE9].
- **None found closes the loop through to sending and re-measuring.**

**6. A fit gate on the panel.**
- Questions that would track a rival's brand, a government service or our own brand are refused and shown with the reason [AV-SPEC §10.1].
- Not found anywhere.
- It matters because several vendors suggest branded prompts by default (Peec: 20% branded [PE5]). Those inflate visibility.

**7. Verified crawler identity.**
- IP and reverse-DNS checks; impostors counted apart; forged forwarding headers handled [AV-LOG §1].
- Vendors list log sources, but none researched here documents spoof handling.
- The bots are published with IP ranges by OpenAI, Anthropic, Perplexity and Google [M33]–[M36].

### 2.2 Trails (specific)

**T1. AI shopping.**
- Shipped by Semrush Enterprise AIO, Profound, Peec, Scrunch, AthenaHQ, Writesonic, Goodie, Evertune, seoClarity, Otterly and LLM Pulse (1A–1D row 16).
- We have none, though the data arrives in responses we already buy [D8][D15].

**T2. Engine breadth and repeats.**
- Grok, DeepSeek, Meta AI, Mistral, Naver, Rufus / Alexa and Exa are covered by Profound, Peec, Scrunch, AthenaHQ, Goodie, seoClarity and Conductor.
- Copilot is a real engine elsewhere; ours is an opt-in Bing summary that appeared 0 times in 10 live tries [AV-GROW §1].
- Perplexity and AIO are read **once a week** and Claude **once a month**. Peec, Profound and SE Visible ask every engine daily; Evertune asks 100 times.

**T3. Retrieved vs cited, and each URL's path from crawl to visit.**
- Peec joins logs, retrievals and citation rate per URL [PE11].
- Ahrefs shows "found but not cited" and bot visits on cited pages [AH4][AH7].
- We store citations and crawler logs separately, and never read the scraper's `search_results` [AV-CODE].

**T4. How sentiment is measured, and how answers describe the brand.**
- Conductor scores 9 aspects per product [CO1][CO5]; Adobe scores per aspect [AD1].
- Otterly added Brand Profiling on 2026-10-21 [OT2]; Peec has Objections [PE3]; AthenaHQ measures brand-trait strength [AT3].
- We classify a capped subset (24 jobs a run) into 3 classes, with no validation set.

**T5. Personas as context.**
- Profound has structured persona attributes [PF4]; Scrunch passes the persona description to the engine [SR4]; Conductor has custom personas [CO1].
- Ours changes the wording only.

**T6. The size of the prompt-demand database.**
- Ahrefs has 496M+ prompts and AI-adjusted volume [AH1][AH6]. Semrush has 317M [SE1].
- Profound and Scrunch license panels [PF8][SR9]; Evertune has EverPanel [EV2].
- We have LLM Mentions (ChatGPT US-English only) plus AI volume derived from People-also-ask [D12][D13].

**T7. Fan-out depth.**
- Semrush Enterprise AIO shows who ranks for each fan-out query [SE6]. Conductor and Peec show it beside every answer [CO4][PE3].
- We read fan-out, but never check whether we rank for those queries.

**T8. Citation decay and source types.**
- Profound measures the half-life of cited URLs [PF3]. Peec and Writesonic classify sources by type [PE7][WS13].

**T9. Measuring the impact of an action.**
- Adobe's Impact Measurement Engine re-runs prompts after a deploy [AD6]. Peec has an Impact page [PE9]. Otterly and Profound annotate the timeline [OT2][PF3].
- We mark targets as won, but run no controlled before/after on prompts.

**T10. Panel scale is untested live.**
- seoClarity starts at 500 q [SC1], SE Visible goes to 1,000 [SV1] and Gauge runs 600 daily [GG2].
- Our 500-question path has never run outside the harness.

---

## 3. Gaps, ranked

Ranked by (effect on the rating and on customers) × (confidence it can be built with our sources) ÷ effort.

Effort sizes: **S** < 1 week, **M** 1–3 weeks, **L** > 3 weeks.

**How costs are worked out:**
- Costs are DataForSEO list prices from §1E, per site per month.
- 4.33 weekly runs a month; 26 pulse mornings.
- A "50 q" panel is used as the reference.
- Claude token costs are **not** priced here: they are to be measured on the first run, as the repo's `count_tokens` path does. No figure is invented.

### 3.1 Buildable gaps

| Rank | Gap | What the leader does | What we would build | Data source / endpoint | Cost per site-month (50 q) | Effort | How it is measured and accepted |
|---|---|---|---|---|---|---|---|
| 1 | **AI shopping and product cards** | Semrush Enterprise AIO: products recommended, frequency, average position, merchants on ChatGPT + AI Mode [SE7]. Profound: shopping trigger rate, merchant share, SKUs [PF9]. Peec: product win rate and catalogue upload [PE8] | Parse `chat_gpt_products` (ChatGPT scraper) and `ai_overview_shopping` (AI Mode), already fetched on every weekly and pulse request. Match to the customer's catalogue (CSV / Merchant Center feed upload, or the site's product URLs) by Google Shopping id, URL host and normalised title. Metrics: shopping trigger rate per question, product presence, carousel position, merchant share, price shown vs the feed price. Wilson ranges like every other rate. Panel generator gains a "shopping" stage for e-commerce sites | `ai_optimization/chat_gpt/llm_scraper/live/advanced` items `chat_gpt_products`; `serp/google/ai_mode/live/advanced` items `ai_overview_shopping` [D8][D15] | **$0 extra** (parsing only); a shopping-heavy panel is the same request count | M | Harness fixture from one live response of each kind. Acceptance: on a retail test site, products named in the carousel are matched with ≥ 95% precision against a hand-labelled set of 100 cards; trigger rate and position carry n and a range; an empty carousel is "no shopping results", never 0% |
| 2 | **Statistics that respect clustering, plus a repeat budget per engine** | Profound's study: changing the prompt mix moves citation share about an order of magnitude more than day-to-day drift [M2]. Evertune samples 100 times per prompt [EV2]. Preprints say: ≥ 7 runs per prompt per day for brand rates [M4]; pick the run count from a pilot [M5] | (a) Intervals from a **bootstrap over questions** (or a design-effect-corrected Wilson), so 7 answers to one question do not count as 7 independent samples. (b) A **28-day rolling window** for segments (preprint: SE 0.033 at 28 days [M4]). (c) A **one-off pilot per site**: 10 questions × 10 repeats per engine → within-question vs between-question variance → the repeats per engine for a target ± (formula in [M5]). (d) Print both denominators: all answers, and answers naming any brand, as Profound does [PF7] | Existing answers; pilot uses the same endpoints at **Standard** queue prices ($0.0012 scraper / AI Mode) | Pilot one-off ≈ 10 × 10 × (2 × $0.0012 + $0.0012 + $0.006 + $0.002) ≈ **$1.16**. Ongoing $0 | M | Simulation test in the harness: synthetic clustered data with known p; 95% intervals cover the truth in 93–97% of 2,000 runs (the current Wilson-on-answers interval is expected to under-cover; measure it). Live: on techand.ai the pilot's recommended repeats are printed per engine |
| 3 | **Each URL's path from crawl to citation to visit** | Peec Crawl insights joins logs with retrievals and citation rate per URL [PE11]. Ahrefs: "found but not cited", bot visits and AI traffic on cited pages [AH4][AH7] | Per own URL: **fetched** by answer bots (crawler logs: ChatGPT-User, Perplexity-User, Claude-User, OAI-SearchBot), **retrieved** (in the ChatGPT scraper's `search_results`), **cited** (`sources` / annotations), **visited** (GA4 AI landing pages), **converted** (key events). Flag "retrieved but not cited" pages with the competing cited URL. Show on the AI page and the Crawlers page | `chat_gpt` scraper `search_results` vs `sources` [D8]; app `crawler_page_daily` [AV-LOG]; GA4 `sessionSource` / `ai-assistant` [GA4a] | **$0** | M (the join crosses app Postgres and n8n Data Tables) | Acceptance: for techand.ai, the 10 most-retrieved own URLs show all five counts with dates. Retrieved ≥ cited on every row. A test log with a spoofed ChatGPT-User line is excluded from "fetched" |
| 4 | **Fan-out coverage and ranking gap** | Semrush Enterprise AIO: the fan-out queries plus the domains ranking for each [SE6]. Conductor: fan-out beside every answer for 4 engines [CO4]. AirOps: retrieval rank is the strongest predictor of citation; 58.4% citation at retrieval rank 1 vs 14.2% at 10 [M7] (vendor study) | (a) Keep fan-out from every engine that returns it; it is already read [AV-CODE]. (b) Weekly: dedupe the panel's fan-out queries, take the top N by frequency, check Google's top 10 for each. (c) Report whether our page ranks, which page should, and hand gaps to the page writer as sections (AI Growth already writes per fan-out search) | `serp/google/organic/live/advanced` per fan-out query; Search Console query join (free) | N = 100 queries × $0.0006 (Standard) × 4.33 = **$0.26**; at Live $0.002 = **$0.87** | S–M | Acceptance: report lists fan-out queries with frequency, our rank (or "not in top 10") and the target page. A query we rank #1 for, but are not cited on, is flagged separately |
| 5 | **Engine depth: daily where it is cheap; Claude weekly; API engines verified; a labelled "model knowledge" layer** | Peec, Profound, SE Visible: every engine daily. Evertune: API layer for model knowledge + app layer with search [EV1]. Brandlight / Genezio: API answers differ strongly from UI answers [M15][M16] (vendor studies) | (a) Add Perplexity and AIO to the pulse (they are read weekly today). (b) Claude weekly, not monthly. (c) Run the 4 one-call live checks for the ChatGPT API / Gemini API engines [AV-G6 §7]. (d) Optional "model knowledge" engines through the vendors' own APIs (xAI Grok, DeepSeek), clearly labelled **API, not the consumer app**, and kept out of the headline rate | `perplexity/llm_responses/live`, `serp/google/organic` AIO, `claude/llm_responses/live` [D2][D5][D7][D17]; xAI / DeepSeek APIs (prices **not verified** here) | (a) 50 × 26 × ($0.006 + $0.002) = **$10.40**. (b) 50 × $0.025 × (4.33 − 1) = **$4.16**. (c) < $0.10 once. (d) not priced | S (a–c), M (d) | Acceptance: the engine table shows ≥ 7 answers per question per week on 5 engines. API engines carry an "API" badge and are excluded from the headline. Live check results recorded with `task.cost` |
| 6 | **Sentiment and perception: complete, aspect-based, validated** | Conductor: 1–10 per mention, 9 aspects, per product [CO1][CO5]. Adobe: per aspect [AD1]. Otterly Brand Profiling (2026-10-21) [OT2]. Peec Objections [PE3]. LLM-judge reliability needs chance-corrected checks [M28] | Classify **every** answer that names the business (drop the 24-job cap for this step, use a small model): polarity, aspects (price, support, integration, trust…), objections, attributes. Majority of 3 runs when the label is borderline [M29]. A **labelled set** of ~200 answer snippets with Cohen's kappa ≥ 0.7 as the release gate, the same pattern as the keyword-fit and promise sets (CLAUDE.md 2026-10-21). Report Net Sentiment (positive − negative) ÷ total with a range [OT3] | Stored answers; Claude API | Claude tokens: **to be measured** (scales with named answers per month) | M | Acceptance: kappa vs the labelled set printed in the harness, build fails below the gate. Aspect table per rival. Sentiment never shown with n < 12 |
| 7 | **Personas as context, not just wording** | Profound: structured persona attributes [PF4]. Scrunch: persona description sent to ChatGPT, Claude, Grok [SR4]. Evidence: a user's revealed identity changes LLM recommendations (p < 0.001) [M10] | For API engines only (the UI scraper cannot take context): send each role as a `system_message` / `message_chain` with the role's attributes. Ask a persona sub-panel (e.g. 10 q × roles) with and without the persona. Show the **persona effect** per role with a two-proportion test | `chat_gpt/llm_responses/live` (`system_message`), Claude, Gemini, Perplexity Responses [D4] | 10 q × 3 roles × 2 arms × $0.012 (ChatGPT API estimate) × 4.33 ≈ **$3.12** | M | Acceptance: report shows the persona effect with ranges and labels it "API answers". A null effect is printed as "no measurable difference", not hidden |
| 8 | **Did an action work? Prompts as test and control** | Adobe re-runs custom prompts about 2 weeks after a deploy [AD6]. Peec Impact page [PE9]. A field experiment with untreated control pages: 1.82× effect but placebo p = 0.16 [M48] | When AI Growth ships an action (a page written or refreshed, an outreach link won, a correction), tag the questions it targets as **treated** and matched untreated questions as **control**. Compare named / cited rates 28 days before vs after (difference in differences with a bootstrap over questions). Print "likely helped / can't tell", never "caused" (the Link Builder impact rule) | Existing answers + `seo_ai_targets` | **$0** | M | Acceptance: harness case with a planted effect detected and a null case reported as "can't tell". Every claimed win in the report carries its control and its interval |
| 9 | **Demand model and market trend** | Ahrefs: estimated impressions with AI-adjusted volume [AH2][AH6]. Profound Prompt Volumes [PF8]. Conductor refuses and uses Trends / GSC as proxies [CO10] | Show demand as a **range from several proxies**, with the method printed: DataForSEO AI volume (from People-also-ask), LLM Mentions `ai_search_volume`, Search Console impressions of matching question queries, and the Google generative-AI CSV (gap 10). Add `historical` and `timeseries_new_lost` for the domain and rivals (monthly) and `top_mentioned_brands` for the market leaderboard | LLM Mentions `historical`, `timeseries_new_lost`, `top_mentioned_brands` [D11][D20]; AI Keyword Data [D14] | ≈ 4 tasks a month × ($0.10 + ~100 rows × $0.001) ≈ **$0.80**; keyword volume ≈ $0.02 | S–M | Acceptance: every volume says which proxy and when; ChatGPT-database figures say "US-English only" when the site is elsewhere. No single "prompt volume" is shown without its basis |
| 10 | **Import Bing AI Performance and Search Console's generative-AI report** | Bing: citations per page across Copilot and partners, grounding queries [B1]. Google: AIO + AI Mode impressions per page [G1]. Neither has an API. No vendor found importing Bing's report | CSV upload (same pattern as the Search Console links import, `seo_link_imports`): per page and day, impressions (Google) and citations (Bing). Join to the per-URL path (gap 3). For **Copilot this becomes our ground truth**, replacing the rarely-present Bing summary. Guide in the app (the guides catalogue) | Owner's exports; `POST …/backlinks/import`-style route | **$0** | S | Acceptance: an uploaded file of each kind parses (fixture from the real export format) and shows per-page rows. A file for another domain is refused. The Copilot tile reads "from Bing Webmaster (your export of <date>)" |
| 11 | Citation decay, freshness, source types | Profound Citation Decay [PF3]; Peec source types [PE7]; freshness evidence [M23][M24] | From stored `cited_urls` (120-day retention): the half-life of each cited URL; whether rivals' cited pages are newer than ours. Rule-based type (own, rival, UGC such as Reddit / YouTube / forums, reference such as Wikipedia, editorial, government), Claude only for the unknown | Stored answers | $0 (+ Claude tokens for unknowns, to be measured) | S | Acceptance: type assigned to ≥ 95% of cited domains on techand.ai, checked against a labelled list of 100 |
| 12 | ChatGPT ads and local-business cards | Gauge tracks ChatGPT ads [GG1]; Otterly paused ads reporting 2026-09-16 [OT2] | Parse `chat_gpt_ad` (`is_rendered`) and `chat_gpt_local_businesses`: who advertises on our questions; local pack presence for local-service sites | Already in the ChatGPT scraper response [D8] | $0 | S | Acceptance: fixture from one live response; "no ads seen" stated with n |
| 13 | Owner-defined alert rules | Writesonic: 10 metrics, thresholds, windows [WS7]. Profound agent triggers [PF10] | Let owners add rules on top of the statistical alerts. A rule fires only when its own test passes; the rule text names the test | Existing metrics | $0 | S | Acceptance: a rule on a noisy segment does not fire on a change inside the range |
| 14 | Cost lever: Standard queue for the weekly run | — (pricing; makes gaps 2, 5 and 14 cheaper) | The weekly run is not time-critical. Post ChatGPT / Gemini scraper and AI Mode tasks to the **Standard** queue ($0.0012, up to 45 min) instead of Live ($0.004), and AIO organic at $0.0006 instead of $0.002. Keep Live for the pulse and on-demand runs | `task_post` / `task_get` for `llm_scraper` and `serp` [D3][D16][D17] | **Saves money.** At 50 q × 4.33 runs, the 3 scraper / AI Mode engines go from $2.60 to $0.78 a month and AIO from $0.43 to $0.13 | M (the async post/get pattern inside the chunked run) | Acceptance: the ledger shows the Standard price per task; a task not ready within the run's window is retried, never billed twice |
| 15 | Big-panel live proof | seoClarity from 500 [SC1], SE Visible to 1,000 [SV1] | Run techand.ai at 100, then 200 (AV-G6 §4–5 owner steps; raise `N8N_DATA_TABLES_MAX_SIZE_BYTES` first) | Existing | $28.86 then $56.91 a month (AV-G6 §4) | S (operational) | AV-G6 §5 acceptance checks 1–3 |

### 3.2 Not buildable (or deliberately not built), and why

| Gap | Who has it | Why not |
|---|---|---|
| Licensed prompt-demand panels (real conversation volumes by country) | Profound [PF8], Evertune EverPanel [EV2], Scrunch [SR9], Semrush clickstream [SE1] | A data purchase, not a feature. No validation of any prompt-volume product was found [M30][M31]. Conductor argues such volumes are below 1% of traffic [CO10]. We show proxies with their basis (gap 9) |
| Consumer-interface answers from Grok, DeepSeek, Meta AI, Claude, Perplexity, Copilot, Naver, Amazon Rufus / Alexa, Walmart Sparky | Peec, Scrunch, Goodie, AthenaHQ, Azoma, LLM Pulse | DataForSEO has no scraper for them [D1][D19]. Running our own browser fleet means infrastructure, anti-bot measures and terms-of-service exposure. The API layer (gap 5d) is the honest substitute, labelled as such. Re-probe DataForSEO quarterly |
| Logged-in, memory-personalised answers | None documents it. Google and OpenAI say memory affects results [M32] | No data source offers it. No controlled study comparing logged-in and logged-out answers was found (§4 B) |
| Search Console and Bing AI data by API | — | No API exists [G1][G2][B1]; CSV import instead (gap 10) |
| ChatGPT database data outside US-English | Ahrefs, Semrush (own databases) | DataForSEO LLM Mentions limit [D12] |
| An own prompt database at 100M+ scale | Ahrefs 496M [AH1], Semrush 317M [SE1] | Data-company scale (crawl + PAA at all locales). Out of reach |
| Ad activation and agentic checkout data | Evertune ad partners [EV6]; Goodie claims checkout traffic [GO8] | Partnerships and merchant data we cannot get. OpenAI's Instant Checkout is reported to be winding down (secondary source) [M42] |
| **AI-only pages served at the CDN** | Adobe Optimize at Edge [AD3], BrightEdge Agent Edge [BE2], Profound Dynamic Bot Rendering [PF3], Scrunch AXP [SR13] | **Buildable but deliberately not built.** Serving bots different content from users is close to cloaking (AV-GROW §1). If built, it needs a content-parity check, which no vendor documents (Adobe pauses on source change [AD3]). An owner decision, not a gap |

---

## 4. Methodology recommendations

### 4.1 Repeats and sampling

**The evidence:**
- Answers are unstable. SparkToro / Gumshoe found the same brand list in "<1 in 100" runs and the same order in about 1 in 1,000 (2,961 runs) [M1]. A 24-hour Jaccard overlap of sources was only 0.23 (ChatGPT) to 0.51 (Gemini) [M4].
- Mention **frequency** is far steadier than **order** [M1].
- Repeats help less than people expect at portfolio level: daily SD 0.0219 at 1×/day vs 0.0195 at 10×/day, an 11% gain, because platform drift sets a floor [M2] (vendor study).
- Per prompt and per brand, they matter: the SE of a per-brand detection rate is 0.370 at 1 run and 0.081 at 7 [M4] (preprint, 32 prompts).
- Reliability varies by engine and topic. G reached 0.96 at 5 runs over 250 questions, yet one Gemini subset stayed at G = 0.27 [M5] (preprint).

**What to do:**
1. **Spend repeats where the variance is: on more questions first, then on repeats.** Prompt-mix variance dominates [M2]. Our 500-question panel is the right lever, and the rotating pulse is the right shape.
2. **Pick repeats per engine from a pilot**, not a constant: n = 4 × residual variance ÷ cell variance [M5]. Gap 2(c) does this.
3. **Count samples over a 28-day rolling window** for segments; keep 7 days for the headline. Preprint figures: SE 0.053 at 21 days, 0.033 at 28 [M4].
4. **Fix our interval.**
   - Today the Wilson interval treats every answer as an independent Bernoulli trial.
   - Answers to the same question are correlated across engines and days, so the true interval is wider.
   - Use a **two-level bootstrap**: questions first, then answers within a question. Profound's study uses one [M2], and the Dice Roll paper prescribes a dependence-preserving bootstrap [M5].
   - Alternatively, inflate the Wilson variance by the design effect 1 + (m − 1)ρ, with ρ estimated from the pilot.
   - Until fixed, our "±3 points at 500 questions" (AV-G6 §4) is probably optimistic. Measure it with the simulation in gap 2.
5. **Keep the refusals.** No delta across a changed panel, no rate under 12 answers, and BH on segments with Holm on the headline. We found no source in this space that corrects for multiple comparisons at all (§1, §L of the methodology research).

### 4.2 Ranking metric (position in the answer)

Rank is the least stable quantity [M1]; SparkToro calls AI ranking "full of baloney", and Conductor provides no position [CO1].

1. **Primary:** **mention rate with its range.**
2. **Secondary, in this order:**
   - **First-mention rate** (Peec's "win rate" [PE6]).
   - **Mean normalised position** = 1 − (rank − 1) ÷ (brands named − 1), averaged over answers that name the business.
     - It scales by list length, which raw rank does not; Scrunch's top / middle / bottom score is a coarse version [SR7].
     - Report it with n and a bootstrap range, never alone.
3. **Keep our visibility score** (rank weight × citation × log demand) as a composite. Document beside it that the weights are a choice, and also show the unweighted mention rate.
   - The GEO paper's Position-Adjusted Word Count weights a source's words by how early they appear [M25]. It suits citations more than brand mentions.
   - Add it only for "how much of the answer is about us" on cited pages.
4. **Denominators.** Print both:
   - named ÷ all answers (ours, Peec);
   - named ÷ answers naming any brand (Profound [PF7], AthenaHQ [AT6]).

   AIO prompts where no AI Overview appeared are excluded from AIO rates, as Otterly does [OT3] and we already do (`aio_basis`).

### 4.3 Share of voice

Two definitions are common:
- **Mention share** = our mentions ÷ all brand mentions, once per answer (Profound, Peec [PF7][PE6]).
- **Market-normalised** share against a fixed rival set (ours: top 8).

Use mention share over **a fixed, declared competitor set plus "others"**, so a new rival does not silently shrink our share. Print the set beside the number. Adobe's demand- and position-weighted share [AD1] can be an optional view, labelled weighted.

### 4.4 Sentiment

- Vendor methods are undocumented (Peec 0–100 with most scores between 65 and 85; Profound share of positive claims) [PE6][PF7].
- LLM judges look consistent while being biased: test-retest above 0.95 coexists with position bias above 0.10, and raw agreement overstates quality by 33–41 points until chance-corrected [M28].
- Sentiment labels are reproducible across runs, and 3–5-run aggregation improves consistency [M29].

**Recommendation:**
- Aspect-based classification on every named answer.
- Majority vote on borderline cases.
- A labelled validation set with Cohen's kappa as the gate.
- Net Sentiment = (positive − negative) ÷ total, with a range [OT3].
- Sentiment shifts with the language of the question (English answers were the most critical) [M12], so compare sentiment only within one market and language.

### 4.5 Engines, interfaces, markets

**Prefer the consumer interface for the headline.**
- UI and API answers share 6–12% of brands [M15].
- On one bank panel they shared 0 fan-out queries and 12.3% of URLs [M16] (vendor studies).
- One preprint found the same run-to-run instability in both [M11].
- **Keep API engines as a labelled, separate layer.** This matches what we do: ChatGPT and Gemini are read through the UI scraper.

**Ask each market in its own language.**
- An English-only audit understates a local champion: recommendation share +0.80 vs +0.15 for multinationals when asked in the home language [M12].
- Exit-IP country alone changes which country's brands are named [M11].
- The `CC-lang` markets support this. Make "the site's market in its own language" a default, not an option, for non-English markets.

**Reasoning mode matters.** ChatGPT Thinking vs Instant shared only 25.6% of cited domains [M14] (vendor study via a secondary source). Record the model or mode each answer came from when the response carries it.

### 4.6 What moves AI answers: use it to rank actions, label it as correlation

| Factor | Evidence | Strength | How to use it |
|---|---|---|---|
| Earned media and brand mentions | Branded web mentions correlate 0.664 with AIO brand mentions, backlinks 0.218 (75k brands) [M43]. Earned media is 84% of AI citations [M21]. LLMs show "an overwhelming bias towards earned media" [M13] | Correlational, strongest | Keeps earned media at the top of AI Growth's ranking |
| "Best X" lists | 43.8% of cited page types; self-promotional lists persist [M46][M47] | Descriptive | Target them through outreach; never self-rank (AV-GROW) |
| Freshness | Cited pages 25.7% fresher [M23]; 65–78% updated within a year [M24] | Correlational | Refresh targets, visible dates |
| Statistics, quotes, cited sources | Up to about 41% on Position-Adjusted Word Count [M25], measured with the source already in context | Lab effect, not shown for discoverability [M27] | The writer's rules; do not promise an effect |
| Schema, llms.txt | AIO −4.6%; AI Mode and ChatGPT not distinguishable from zero [M44]; llms.txt shows no link to citations [M45] | Null | Keep at weight 0 |
| AIO citations vs organic top 10 | 37.9% of cited URLs are in the top 10 [M18]; another vendor says ~17% [M19] | Disputed | Fan-out ranking (gap 4) |

**No reviewed technique shows a stable, longitudinal, cross-platform causal effect** [M27]. That is why gap 8 measures our own actions against control prompts instead of quoting industry studies.

---

## 5. Summary for the owner

**Our strengths:**
- Rigour: ranges, tests, refusals and published formulas.
- The closed loop from a lost question to a won page, with outreach.
- Cost transparency.
- The fit gate.

The interval itself needs the clustering fix (gap 2) before the rigour lead can be defended in front of a statistician.

**Where the market is ahead:**
- AI shopping.
- Engine breadth and daily repeats.
- Each URL's path from crawl to citation to visit.
- Aspect sentiment.
- Persona context.
- Prompt-demand data.

Of these, only the last two engine families (consumer interfaces with no DataForSEO scraper) and licensed demand panels are out of reach. Shopping, the per-URL path, fan-out ranking, ads and local cards use data **we already pay for and discard** [D8][D15].

---

## 6. Sources

All opened 2026-10-23 by the research sub-agents for this report unless tagged (S).

**Alaventra (repo, read 2026-10-23):**
- AV-SPEC `n8n/seo-agent/AI_VISIBILITY_SPEC.md`
- AV-G6 `n8n/seo-agent/docs/AI_PANEL_SCALE_HANDOFF.md`
- AV-GROW `n8n/seo-agent/AI_GROWTH_SPEC.md`
- AV-LOG `app/docs/LOG_ANALYTICS.md`
- AV-INT `app/docs/INTEGRATIONS.md`
- AV-API `app/API.md`
- AV-CODE `n8n/seo-agent/v5/code/{Parse_AI_Answers,AI_Metrics,_ai_stats,_ai_panel}.js`

**Profound:**
- PF1 https://www.tryprofound.com/pricing
- PF2 https://www.tryprofound.com/features/answer-engine-insights/prompt-tracking
- PF3 https://product.tryprofound.com/en/changelog
- PF4 https://docs.tryprofound.com/answer-engine-insights/personas.md
- PF5 https://docs.tryprofound.com/platform-config/analytics-setup.md
- PF6 = M2 https://www.tryprofound.com/blog/is-once-a-day-enough
- PF7 https://docs.tryprofound.com/cookbook/metrics/how-metrics-are-calculated.md
- PF8 https://docs.tryprofound.com/prompt-volumes/about
- PF9 https://docs.tryprofound.com/shopping/about.md
- PF10 https://docs.tryprofound.com/agents/triggers-in-agents.md
- PF11 https://docs.tryprofound.com/answer-engine-insights/factcheck/getting-started
- PF12 https://docs.tryprofound.com/_llms/en/platform-guides.txt
- PF13 https://aiweekly.co/alerts/profound-hits-18b-on-180m-series-d-from-sequoia-kleiner (3P)

**Peec AI:**
- PE1 https://docs.peec.ai
- PE2 https://docs.peec.ai/mcp/introduction.md
- PE3 https://peec.ai/changelog
- PE4 https://pricingsaas.com/companies/peec (3P)
- PE5 https://docs.peec.ai/setting-up-your-prompts.md
- PE6 https://docs.peec.ai/metrics/brand-metrics/visibility.md, …/position.md, …/sentiment.md, …/share-of-voice.md, …/win-rate.md
- PE7 https://docs.peec.ai/understanding-sources.md
- PE8 https://docs.peec.ai/overview.md
- PE9 https://docs.peec.ai/actions.md
- PE10 https://docs.peec.ai/brand-perception-fact-checking.md
- PE11 https://docs.peec.ai/crawl-insights.md
- PE12 https://docs.peec.ai/agencies/understanding_credits.md
- PE13 https://resources.rework.com/tools/aeo-ai-visibility/best-peec-ai-alternatives (3P)

**Evertune:**
- EV1 https://docs.evertune.ai/en/articles/12451590-ai-models-available
- EV2 = M3 https://www.evertune.ai/platform/methodology
- EV3 https://www.evertune.ai/pricing
- EV4 https://docs.evertune.ai/en/articles/12271101-evertune-metrics
- EV5 https://www.evertune.ai/platform/explore
- EV6 https://www.evertune.ai/platform/act
- EV7 https://www.evertune.ai/resources/insights-on-ai/introducing-starter

**Scrunch (Sitecore):**
- SR1 https://helpcenter.scrunchai.com/en/articles/15863866-what-platforms-does-scrunch-monitor
- SR2 https://scrunch.com/faqs/what-methods-does-scrunch-use-to-collect-data-from-ai-platforms
- SR3 https://scrunch.com/pricing
- SR4 https://helpcenter.scrunchai.com/en/articles/13676120-how-personas-are-used-within-scrunch
- SR5 https://helpcenter.scrunchai.com/en/articles/16220604-countries-supported-in-scrunch
- SR6 https://helpcenter.scrunchai.com/en/articles/15879296-understanding-the-signals-tab
- SR7 https://helpcenter.scrunchai.com/en/articles/16823372-scrunch-metrics-reference-explorer-names-and-api-fields
- SR8 https://helpcenter.scrunchai.com/en/articles/17507572-citation-optimization-overview
- SR9 https://helpcenter.scrunchai.com/en/articles/12845019-understanding-the-ai-search-trends-tab-in-scrunch
- SR10 https://helpcenter.scrunchai.com/en/articles/14426466-understanding-the-shopping-tab
- SR11 https://helpcenter.scrunchai.com/en/articles/17464032-review-facts-and-voice
- SR12 https://helpcenter.scrunchai.com/en/articles/17464036-export-and-publish
- SR13 https://scrunch.com/platform/agent-experience/ and https://scrunch.com/ and https://scrunch.com/platform/monitoring-insights/
- SR14 https://helpcenter.scrunchai.com/en/collections/15678483-agent-traffic
- SR15 https://helpcenter.scrunchai.com/en/articles/13165667-loading-scrunch-data-into-your-data-warehouse
- SR16 https://www.sitecore.com/de-de/company/newsroom/press-releases/2026/06/sitecore-acquires-scrunch-to-help-brands-influence-discovery--and-buying-decisions

**AthenaHQ:**
- AT1 https://www.athenahq.ai/pricing (and /platform)
- AT2 https://docs.athenahq.ai/guides/responses.md and …/guides/glossary.md
- AT3 https://docs.athenahq.ai/api-reference/changelog.md
- AT4 https://docs.athenahq.ai/setting-up-prompts.md
- AT5 https://docs.athenahq.ai/api-reference/ai-search-value.md
- AT6 https://docs.athenahq.ai/api-reference/metrics/cumulative-share-of-voice.md and …/cumulative-position.md
- AT7 https://docs.athenahq.ai/guides/shopping.md
- AT8 https://docs.athenahq.ai/integrations.md
- AT9 https://docs.athenahq.ai/oracle.md
- AT10 https://docs.athenahq.ai/api-reference/mcp.md
- AT11 https://docs.athenahq.ai/guides/bot.md

**Semrush / Adobe:**
- SE1 https://www.semrush.com/kb/1607-semrush-ai-visibility-data
- SE2 https://www.semrush.com/kb/1493
- SE3 https://www.semrush.com/kb/1594-ai-seo-metrics
- SE4 https://www.semrush.com/prices/
- SE5 https://www.semrush.com/news/440690-semrush-enterprise-ai-optimization-adds-persona-based-prompt-generation/
- SE6 https://www.semrush.com/news/442193-query-fan-out-analysis-comes-to-semrush-enterprise-ai-optimization-revealing-the-search-signals-behind-ai-responses/
- SE7 https://www.semrush.com/news/449191-enterprise-aio-extends-ai-shopping-report-across-chatgpt-and-google-ai-mode/
- SE8 https://www.semrush.com/news/469301-semrush-launches-official-connector-for-claude-bringing-marketing-intelligence-into-ai-conversations
- SE9 https://www.semrush.com/news/474244-semrush-releases-2026-ai-visibility-index-revealing-its-first-uk-benchmark
- SE10 https://www.semrush.com/news/412006-semrush-enterprise-ai-optimization-goes-ga-why-visibility-in-ai-search-is-no-longer-optional/
- AD1 https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/brand-visibility/brand-visibility-overview
- AD2 https://experienceleague.adobe.com/en/docs/llm-optimizer/using/essentials/quick-start
- AD3 https://experienceleague.adobe.com/en/docs/llm-optimizer/using/resources/optimize-at-edge/overview
- AD4 https://experienceleague.adobe.com/en/docs/brand-visibility/using/log-forwarding/log-forwarding-overview
- AD5 https://experienceleague.adobe.com/en/docs/brand-visibility/using/dashboards/agentic-traffic
- AD6 https://experienceleague.adobe.com/en/docs/brand-visibility/using/essentials/whats-new
- AD7 https://experienceleague.adobe.com/en/docs/brand-visibility/using/essentials/best-practices-topics-prompts
- AD8 https://itbrief.co.uk/story/adobe-launches-tool-to-track-brand-visibility-in-ai (3P)

**Ahrefs:**
- AH1 https://ahrefs.com/brand-radar
- AH2 https://ahrefs.com/blog/brand-radar-methodology
- AH3 https://ahrefs.com/pricing
- AH4 https://ahrefs.com/blog/new-features-apr-2026/
- AH5 https://ahrefs.com/es/blog/novedades-marzo-2026/
- AH6 https://ahrefs.com/es/blog/novedades-julio-agosto-2026/
- AH7 https://ahrefs.com/blog/new-features-may-2026/

**Similarweb:**
- SW1 https://aisearch.similarweb.com/ai-brand-visibility/
- SW2 https://aisearch.similarweb.com/ai-brand-visibility/prompt-analysis/
- SW3 https://aisearch.similarweb.com/
- SW4 https://aisearch.similarweb.com/blog/track-ai-visibility/

**Conductor:**
- CO1 https://www.conductor.com/docs/intelligence/ai-search-faqs.md
- CO2 https://www.conductor.com/docs/intelligence/ai-search-performance.md
- CO3 https://www.conductor.com/docs/intelligence/ai-search-setup.md
- CO4 https://www.conductor.com/docs/platform/release-notes.md
- CO5 https://www.conductor.com/docs/agentstack/changelog.md
- CO6 https://www.conductor.com/docs/intelligence/recommendations.md
- CO7 https://www.conductor.com/docs/monitoring/log-file-analysis.md
- CO8 https://www.conductor.com/pricing/
- CO9 https://www.conductor.com/docs/templates/check-product-visibility-in-ai-shopping.md
- CO10 = M30 https://www.conductor.com/academy/debunking-ai-prompt-volume/

**BrightEdge:**
- BE1 https://www.brightedge.com/ai-catalyst
- BE2 https://www.brightedge.com/agent-edge
- BE3 https://aws.amazon.com/marketplace/pp/prodview-i2ggufqfujws4
- BE4 https://diginomica.com/brightedge-introduces-ai-hyper-cube-help-brands-understand-ai-search-heres-how-it-works (3P)
- BE5 https://trakkr.ai/reviews/brightedge-review/platform-coverage (3P, competitor)
- BE6 https://trakkr.ai/reviews/brightedge-review/data-accuracy (3P, competitor)
- BE7 https://www.brightedge.com/products/product-pricing

**seoClarity:**
- SC1 https://www.seoclarity.net/ai-seo/pricing
- SC2 https://www.seoclarity.net/pricing
- SC3 https://www.seoclarity.net/resources/news/seoclarity-launches-arcai-3.0-to-reclaim-brand-narrative-in-ai-search
- SC4 https://www.seoclarity.net/blog/prompt-tracking-valid
- SC7 https://kb.seoclarity.net/portal/en/kb/articles/how-do-i-change-the-rank-frequency-of-arcai-tracking (S)

**Search Atlas:**
- SA1 https://searchatlas.com/pricing/
- SA2 https://searchatlas.com/llm-visibility/
- SA3 https://searchatlas.com/blog/how-to-use-search-atlas-llm-visibility/
- SA5 https://github.com/Search-Atlas-Group/searchatlas-mcp-server

**Otterly:**
- OT1 https://otterly.ai/pricing
- OT2 https://help.otterly.ai/changelog
- OT3 https://help.otterly.ai/brand-report-kpi-definition
- OT4 https://help.otterly.ai/how-otterlyai-collects-data
- OT5 https://trakkr.ai/reviews/otterly-review/data-accuracy (3P, competitor)
- OT6 https://help.otterly.ai/search-prompt-monitoring

**Goodie:**
- GO1 https://higoodie.com/pricing
- GO3 https://higoodie.com/blog/ai-search-brand-monitoring-guide/
- GO4 https://higoodie.com/ai-visibility-index/methodology/
- GO6 https://higoodie.com/integrations/
- GO7 https://higoodie.com/features/ai-agent-analytics
- GO8 https://higoodie.com/features/agentic-commerce-optimizer and http://higoodie.com/features/agentic-commerce-suite/

**Writesonic:**
- WS1 https://writesonic.com/pricing
- WS2 https://docs.writesonic.com/docs/why-we-monitor-real-ai-platforms-not-just-apis.md
- WS4 https://docs.writesonic.com/docs/ai-search-vocabulary-concepts-very-important.md
- WS6 https://docs.writesonic.com/docs/markets-track-multiple-regions-and-languages.md
- WS7 https://docs.writesonic.com/docs/alerting.md
- WS8 https://docs.writesonic.com/docs/ai-traffic-analytics-setup-and-implementation-guide.md
- WS9 https://apidocs.writesonic.com/mcp/mcp-server
- WS10 https://docs.writesonic.com/changelog/ai-shopping-tracker.md
- WS12 https://writesonic.com/blog/geo-action-center
- WS13 https://docs.writesonic.com/changelog/brand-explorer.md
- WS14 https://docs.writesonic.com/changelog/geo-content-score.md

**Gauge:**
- GG1 https://withgauge.com
- GG2 https://www.withgauge.com/pricing
- GG3 https://docs.withgauge.com/ (navigating/ai-engines.md)
- GG4 …/rankings-visibility.md and citations.md
- GG5 …/prompts.md
- GG6 …/agents/guides/agent-traffic.md

**SE Visible and Surfer:**
- SV1 https://visible.seranking.com
- SU1 https://surfer.ai/ai-tracker
- SU2 https://surfer.ai/pricing/
- SU3 https://docs.surferseo.com/en/articles/11667466-ai-tracker
- SU4 https://docs.surferseo.com/de/articles/12944174-surfer-ai-tracker-x-looker-studio

**Other entrants:**
- BF1 https://www.bluefishai.com
- BF2 https://www.bluefishai.com/products/ai-monitoring-suite
- BF6 https://pulse2.com/bluefish-43-million-series-b-fuels-expansion-of-agentic-marketing-platform/amp/ (3P)
- DD1 https://withdaydream.com
- LR1 https://llmrefs.com/pricing
- LP1 https://llmpulse.ai/features/chatgpt-shopping
- LP2 https://llmpulse.ai/ai-models/amazon-rufus
- AZ1 https://www.azoma.ai
- PX1 https://www.arr.club/pixis/pixis-visibility-hit-3m-arr-within-60-days (3P)
- GS1 https://pulse2.com/geosurge-raises-12-million-seed-round-to-advance-ai-visibility-platform/amp/ (3P)
- GT1 Semrush release on the Gartner Market Guide, 2026-07-07: https://www.semrush.com/news/463886-… (full slug not recorded; Gartner document https://www.gartner.com/en/documents/7559273 returned 403)
- FR1 https://www.evertune.ai/resources/insights-on-ai/evertune-named-a-notable-vendor-in-forresters-answer-engine-optimization-technologies-landscape-q3-2026

**DataForSEO:**
- D1 https://docs.dataforseo.com/v3/ai_optimization/overview/
- D2 https://dataforseo.com/pricing/ai-optimization/llm-responses
- D3 https://dataforseo.com/pricing/ai-optimization/llm-scraper
- D4 https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_responses/live/
- D5 https://docs.dataforseo.com/v3/ai_optimization/claude/llm_responses/live/
- D6 https://docs.dataforseo.com/v3/ai_optimization/gemini/llm_responses/live/
- D7 https://docs.dataforseo.com/v3/ai_optimization/perplexity/llm_responses/live/
- D8 https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced/
- D9 https://docs.dataforseo.com/v3/ai_optimization/gemini/llm_scraper/live/advanced/
- D10 https://dataforseo.com/pricing/ai-optimization/llm-mentions
- D11 https://dataforseo.com/update/extended-llm-mentions-api-release
- D12 https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/search_mentions/live/
- D13 https://dataforseo.com/help-center/how-the-ai-search-volume-metric-works-in-llm-mentions
- D14 https://dataforseo.com/pricing/ai-optimization/ai-keyword-search-volume and https://docs.dataforseo.com/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live/
- D15 https://docs.dataforseo.com/v3/serp/google/ai_mode/live/advanced/
- D16 https://dataforseo.com/pricing/google-serp/google-ai-mode-serp-api
- D17 https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/ and https://dataforseo.com/pricing/google-serp/google-organic-serp-api
- D18 https://dataforseo.com/update/copilot-search-comes-to-bing-serp-api
- D19 https://dataforseo.com/updates/category/ai-optimization-api and https://dataforseo.com/update/api-rate-limit-10000-requests-per-minute
- D20 https://docs.dataforseo.com/v3/ai_optimization/llm_mentions/historical/live/

**Google, Bing, GA4:**
- G1 https://support.google.com/webmasters/answer/16984139?hl=en
- G2 https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- G3 https://developers.google.com/search/docs/appearance/ai-features
- B1 https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- GA4a https://support.google.com/analytics/answer/9164320?hl=en
- GA4b https://support.google.com/analytics/answer/9756891?hl=en

**Methodology (vendor studies marked):**
- M1 https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/ (2026-01-28)
- M2 https://www.tryprofound.com/blog/is-once-a-day-enough (vendor, 2026-07-08)
- M3 https://www.evertune.ai/platform/methodology (vendor)
- M4 https://arxiv.org/html/2604.07585v1 (preprint, 2026-04-08)
- M5 https://arxiv.org/abs/2609.04047 (preprint, v2 2026-10-14; abstract only)
- M6 https://arxiv.org/abs/2603.08924 (preprint; abstract only)
- M7 https://www.airops.com/report/the-fan-out-effect-what-happens-between-a-query-and-a-citation (vendor, 2026-04-13)
- M8 https://ahrefs.com/blog/ai-overviews-vs-ai-mode (vendor)
- M9 https://www.semrush.com/blog/most-cited-domains-ai/ (vendor)
- M10 https://arxiv.org/abs/2410.05613
- M11 https://arxiv.org/abs/2608.30052 (preprint)
- M12 https://arxiv.org/abs/2606.23165 (preprint)
- M13 https://arxiv.org/html/2509.08919v1
- M14 https://www.pinmeto.com/news/chatgpt-thinking-mode-brand-citations-2026/ (secondary write-up of a vendor study)
- M15 https://research.brandlight.ai/ui-vs-api.html (vendor)
- M16 https://genezio.com/research/zero-query-overlaps/ (vendor)
- M17 https://searchenginejournal.com/what-we-can-learn-from-evolving-chatgpt-fan-out-queries/586254
- M18 https://ahrefs.com/blog/ai-overview-citations-top-10 (vendor)
- M19 https://www.brightedge.com/resources/weekly-ai-search-insights/ai-overviews-one-year-presence-size-citing (vendor)
- M20 https://www.tryprofound.com/blog/ai-platform-citation-patterns (vendor)
- M21 https://muckrack.com/blog/what-is-ai-reading-may-2026 (vendor)
- M22 https://www.cjr.org/tow_center/we-compared-eight-ai-search-engines-theyre-all-bad-at-citing-news.php
- M23 https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/ (vendor)
- M24 https://www.seerinteractive.com/insights/study-content-recencys-impact-on-ai-visibility-in-2026 (agency)
- M25 https://arxiv.org/html/2311.09735v3 (GEO, KDD 2024)
- M27 https://arxiv.org/abs/2607.14035 (survey preprint)
- M28 https://arxiv.org/abs/2606.19544 (preprint)
- M29 https://arxiv.org/abs/2503.16974
- M31 https://www.jaeckert-odaniel.com/en/prompt-search-volume-real-data-or-all-guessed/
- M32 https://blog.google/products/search/google-search-ai-mode-update/
- M33 https://developers.openai.com/api/docs/bots
- M34 https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- M35 https://docs.perplexity.ai/guides/bots
- M36 https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent
- M37 https://blog.cloudflare.com/ai-search-crawl-refer-ratio-on-radar/
- M38 https://blog.cloudflare.com/crawlers-click-ai-bots-training/
- M39 https://blog.cloudflare.com/agentic-internet-bot-report/
- M40 https://developers.openai.com/commerce/guides/key-concepts
- M41 https://developers.openai.com/commerce/specs/feed
- M42 https://www.shopifreaks.com/openai-pivots-from-instant-checkout-to-an-app-based-shopping-model-inside-chatgpt/ (secondary)
- M43 https://ahrefs.com/blog/ai-overview-brand-correlation/ (vendor)
- M44 https://ahrefs.com/blog/schema-ai-citations/ (vendor)
- M45 https://seranking.com/blog/llms-txt/ (vendor)
- M46 https://ahrefs.com/blog/best-lists-research/ (vendor)
- M47 https://docs.peec.ai/research/self-promotional-listicles (vendor)
- M48 https://arxiv.org/abs/2606.04362 (preprint)

### Least certain facts in this file

1. **Peec plan sizes and prices** are third-party only [PE4][PE13]; peec.ai/pricing showed no prices.
2. **Evertune's per-prompt price** is an unverified derivation from its calculator. Its model count conflicts across its own pages (9 / 11 / 7).
3. **Semrush prompt allowances** conflict between KB-1493 and the Prices page. The Enterprise AIO database size (261M) is (S).
4. **Profound's Agency price** is (S). Its Series D figure is from a third party relaying Bloomberg.
5. **The Gartner Market Guide's capability list** could not be opened (paywall).
6. **Alaventra:** the ChatGPT API and Gemini API prices are estimates (never called live), and the 500-question path is not live-verified.
7. **Claude token costs** in §3 are deliberately not priced.
8. **The methodology preprints** (M4, M5, M6, M11, M12, M27, M28, M48) are not peer reviewed. M5 and M6 were read as abstracts only.
