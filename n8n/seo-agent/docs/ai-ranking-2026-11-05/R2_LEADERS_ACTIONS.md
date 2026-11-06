# R2: what the leaders DO to move AI answers, and how well it works (2026-11-05)

Research only. No code changed. Part of the AI-ranking R&D (`README.md`). Builds on `../ai-visibility-2026-10-23/MARKET_RND.md`
(measurement, 2026-10-23) and `../../AI_GROWTH_SPEC.md` (what we built to act). This file is about **acting**: how each leader chooses
what to do, what it generates or executes, and how it proves the effect. It ends with a capability matrix (us against each leader and the
best-in-class bar), the best end-to-end action pipeline we can assemble, and where we can lead.

## How to read this

- Every external claim carries a source key, for example [PF2]. Keys resolve to URLs in §10. **All sources were opened on 2026-11-05**
  unless marked "(via MARKET_RND, opened 2026-10-23)" or "(search result only)". A search-result-only source means the page itself did
  not open or was not opened; the claim came from the search engine's summary of it.
- Each claim carries a tag:
  - **[V] VERIFIED**: seen in the vendor's own product documentation, help centre, changelog or feature page describing a shipped
    feature, or in an independent primary source (paper, platform documentation). For vendor pages, VERIFIED means "the vendor
    documents this feature", not "the feature works as claimed".
  - **[VC] VENDOR CLAIM**: an outcome or capability the vendor asserts (press release, case study, marketing copy) without evidence we
    could check.
  - **[U] UNVERIFIED**: a third-party blog, review, aggregator or search snippet. A lead, not a fact. Competitor-written reviews are
    named as such.
- "Not found" means searched for and not found. It does not prove a product lacks the feature.
- Alaventra's column comes from the repo (`AI_GROWTH_SPEC.md`, `../ai-visibility-2026-10-23/RESUME.md` and its `fixes/W2-E2.md`,
  `fixes/W2-E3.md`, `CLAUDE.md` status). "Built" means merged and deployed; it does not mean verified live on our two clients. R5
  (`R5_SYSTEM_SURVEY.md`) checks the code paths; this file does not.
- No client data beyond the two domain names (techand.ai, devaicon.com). The repo is public.

---

## 1. Summary

1. **Every leader now sells "actions", and they converge on one loop**: find a gap per question, rank it, generate a brief or a page,
   publish through a CMS after human approval, then re-measure. Profound (Aim + Agents), Peec (Actions + Peec Agent, 2026-10-22),
   Gauge (Action Center), AirOps (Quill + Offsite), Conductor (Actions + AgentStack, 2026-11-03), AthenaHQ (Action Center + ACE),
   Writesonic (Action Center + Outreach Agent), Yext (Scout + agent harness), seoClarity (ArcAI 3.0 agentic workflow).
2. **Nobody publishes the scoring formula** behind "high impact". The best documented is Gauge: gap between your visibility and demand,
   weighted by tracked prompts and search volume, zero-visibility topics first, with the competitor sources that win shown on the card
   [GG1, V]. Semrush and Adobe attach a projected traffic or growth figure to each opportunity [SE1, V; AD5, U].
3. **Off-site work is targeted but rarely executed.** Leaders name the third-party pages, publications, Reddit threads and listicles AI
   cites (BrightEdge, Writesonic, Peec, Gauge, Adobe, AirOps Offsite) and at most draft outreach. None documents sending outreach from the
   client's mailbox and then verifying that the page now names the client. We do both (built, owner approval first).
4. **Impact proof is weak everywhere.** The best is Gauge (actual impact compared with the projection on the card, and auto-completion
   when a newly cited page matches an open action) [GG1, V] and Adobe (re-runs prompts about two weeks after an edge deploy) [AD4, via
   MARKET_RND]. Peec's Impact page only places status markers on a trend chart [PE1, V]. **No leader uses control questions.** An
   independent natural experiment found a 1.82x effect that did not survive a placebo test (p = 0.16) and concludes that headline AEO
   multiples "likely substantially overstate the causal effect" [EX2, V].
5. **Case studies**: we collected 35+ published lifts. None has a control group, most have no stated baseline sample, and every one is
   published by the vendor or an agency selling the service. The actions behind the biggest lifts are mundane: a small number of new
   comparison / "best X" / Q&A pages aimed at the exact prompts, plus refreshes. Two are B2B services firms (1840 & Company, NoGood).
6. **The strongest independent evidence for a pipeline design** is a stage model on 34,960 prompt-engine observations: when the
   brand's own domain is in the engine's retrieval path, mention rates jump from about 3% to 49-58%; with a branded fan-out search as
   well, to 91-100%. A brand that was not named last run and has no exposure now is named only 1.6-1.9% of the time [EX1, V
   (observational preprint)]. **Getting into the retrieval set for the fan-out searches comes first**; content polish without exposure
   does little. Both our clients are in that cold-start state.
7. **Agent-facing surfaces are mostly hype for a B2B services company in 2026**: llms.txt is not read (97% of files get zero requests;
   Google says no AI text files are needed) [EX11, V; EX12, U], NLWeb has stalled [EX14, V/U], a brand MCP server has no measured
   visibility effect [EX13, U], and OpenAI's agentic checkout was scaled back to discovery and retailer apps [EX15, U]. What matters is
   being crawlable as raw HTML by the answer bots, being indexed where each engine retrieves (Google, Bing, Brave), and being present on
   the pages they read (directories, reviews, lists, LinkedIn, Reddit).
8. **Risks the leaders sell into**: self-ranked "best X" lists are cited but the author is left out 69% (June) then 83% (September) of the
   time, and Google demoted such subfolders in early 2026 [EX5, U]; Google's spam policy was reported extended to "manipulating generative
   AI responses" on 2026-05-15 [EX10, U]; agent-only pages served at the CDN (Scrunch AXP, Adobe Optimize at Edge, Profound Dynamic Bot
   Rendering, BrightEdge Agent Edge) are close to cloaking unless parity is enforced, and only Adobe documents a parity rule [AD1, V].

---

## 2. Action features by vendor

For each: **chooses** (how it decides what to do), **does** (what it generates or executes), **proves** (how it shows impact).

### 2.1 AI-visibility specialists

**Profound** (raised $180M Series D in Sep 2026, per MARKET_RND [PF13 there])
- Chooses: **Aim** (launched 2026-07-02 [PF7, U; PF9, U]) is an always-on background agent. "Each week, AI Marketer surfaces a ranked
  list of opportunities": visibility gaps, sentiment drops on key topics, rising prompt volumes in categories you do not own, falling
  benchmarks against competitors, content gaps against your sitemap. Inputs: Answer Engine Insights, prompt volumes, agent analytics,
  fact-check, benchmarks, your knowledge bases and sitemaps, connected apps. Each opportunity carries its data and Aim's reasoning
  [PF2, V]. The ranking method is not published [PF2, V]. Agents "query 16 reasoning models and Profound's user prompt data" before
  drafting and pick the content format most likely to be cited from the top-cited pages [PF1, VC].
- Does: Aim turns an accepted opportunity into a Project with an execution brief and tasks, then builds a ready-to-run Agent [PF2, V].
  Agents write articles, structured FAQs, refreshes of pages with declining AI citation rates, competitive briefs, and publish to the
  CMS after a human approval step [PF1, V]. Agent triggers: schedule, app events, web-change monitors, Profound data thresholds such as
  a Visibility Score drop [PF3, V]. **Dynamic Bot Rendering** serves AI bots a fully rendered page at the CDN (CloudFront, Cloudflare,
  Vercel), with "Bot View" comparing bot and human views [PF8, U]. No outreach, Reddit or schema template is documented [PF3, V].
- Proves: Aim "tracks actions during execution and reports results" (visibility rank, score, citation share) [PF2, V]; a "closed loop"
  learns which content types earn citations [PF1, VC]. No control method.

**Peec AI** ($20M ARR on 2026-11-02 [PE3, U]; Peec Agent 2026-10-22 [PE2, U])
- Chooses: **Actions** in four groups: fix how AI reads your site; improve your own pages; get mentioned elsewhere (placements on
  third-party sources AI already relies on); fix wrong claims. Each action has a **Relative impact** (Very low to Very high) on one scale
  across all types; formula not given. Evidence on each card: citation counts, topic, page type, period ("Competitor comparison pages
  were cited in 14 conversations about CRM software in the last 30 days"), competitor evidence and their sources. Source types: Your
  pages, Editorial, UGC, Wikis & references, Other [PE1, V].
- Does: brief (suggested structure), checklist, expected outcome; statuses New / Planned / In progress / Done / Declined / Expired;
  correction actions "Correct owned content" and "Request source correction" [PE1, V]. Peec Agent: 25+ connectors, 30 skills, asks for
  approval before changes by default [PE2, U]. Peec does not publish for you (MARKET_RND, PE9).
- Proves: **Impact** page: brand trend (visibility, sentiment, position, share of voice) with amber / green day markers when actions
  start / finish [PE1, V]. A before/after picture, no control.

**AthenaHQ**
- Chooses: "every recommendation is mapped to the passages and sources that AI models actually pull from"; on-page and off-page fixes
  [AT1, V]. **ACE** (Athena Citation Engine) is listed as an Enterprise feature; described elsewhere as predicting citation probability
  [AT1, V (listing only); AT2, U; AT3, U (competitor review)].
- Does: content optimization agent with "self-learning", Athena AI agent, "citation source analysis and link building" in its managed
  offering, publishing via Shopify / Webflow / Framer [AT1, V].
- Proves: GA4 and Search Console joins, ROI dashboards [AT1, V]. Case figures in §3.

**Scrunch** (acquired by Sitecore, mid-2026 [SR2, U])
- Chooses: monitoring product separate from AXP.
- Does: **AXP** sits at the CDN, detects AI agent traffic by platform and purpose (training, search indexing, live retrieval), and serves
  restructured, summarised HTML at the same URLs; humans and Googlebot see the normal site. Managed deploys on Cloudflare Snippets,
  Akamai EdgeWorkers, CloudFront Functions. Argues it is not cloaking because the intent is the same; **no parity check is described**
  [SR1, V, article dated 2026-07-07]. No measured outcome given [SR1, V].

**Evertune**
- Chooses: an Insights Agent "ranks the highest-impact moves, and then launches them"; content opportunities ranked by prompt volume
  and visibility gap [EV1, VC].
- Does: Content Studio (strategy to briefs and assets, optimise existing pages, site audit for bot access / HTML quality /
  extractability); **affiliate partners** to get mentioned on sources AI cites; an **Ads Agent** that buys ChatGPT ads on conversations
  where the brand is weak and retargets after the chat [EV1, V].
- Proves: AI Brand Score over time, sampled up to 100 times per model [EV1, V]; no per-action method.

**Bluefish** ($68M raised [BF2, U])
- Chooses: Agentic Campaigns with objectives (visibility, favourability, safety, accuracy) and recommendations tied to pages, products,
  audiences and channels (June 2026) [BF2, U].
- Does: **Paid Media Briefs** (2026-10-26): ad targeting, creative and landing pages on Google and ChatGPT aimed at gaps in AI answers;
  sponsored publisher content, creators, UGC and retail media are roadmap [BF1, V]. Content generation is disputed between reviews [BF2, U].
- Proves: "measures the overall impact", no method [BF1, V].

**Goodie AI** (run by the founder of the NoGood agency)
- Chooses / does: Optimization Hub (semantic text edits, structured data), AEO Content Writer for short Q&A pages, daily source tracking
  of how engines respond to new content, WordPress publishing [GO1, V; MARKET_RND GO1, GO6].
- Proves: AI-referral funnel attribution in the NoGood case [GO1, VC].

**Brandlight** ($30M Series A, Feb 2026 [BL2, U])
- Chooses: source influence (which domains feed answers), share of voice, sentiment, "narrative consistency" [BL1, U].
- Does: reviewers say it monitors well but does not help fix [BL2, U (review by a rival tool's site)]. Its own research showed API
  answers differ from UI answers [MARKET_RND M15].

**Gauge**
- Chooses: prompts run daily; gaps become dated batches of actions; **opportunity score weights the gap between where you appear and
  where demand is**; top priorities are usually topics with zero visibility, many tracked prompts and real search volume. Each card shows
  topic visibility, tracked prompts, monthly answers, keyword volume and the competitor sources already winning, with a "Why we suggest
  this" panel [GG1, V].
- Does: four action types: **low mention rate fixes** (AI cites your page but does not name your brand: "usually the fastest win"),
  content gaps, structural improvements (9-criteria page health), influential citation opportunities (high-authority sources AI uses
  that do not mention you). Accepted actions become tasks for a person or Gauge's agent; the agent runs brief, research, outline, draft,
  review, then publishes to Webflow / Framer / Sanity or opens a **pull request** for repo-based blogs; you approve brief and outline
  [GG1, V]. Growth plan: 18 articles a month [GG2, V].
- Proves: completed work moves to an Evaluation tab; after enough time Gauge compares actual impact with the **projected impact on the
  card**; if a newly cited page matches an open content action, the action is marked complete automatically [GG1, V]. Best documented
  verification among the specialists, still without controls.

**AirOps**
- Chooses: Insights / Page360 joins Search Console, GA4 and AI citation data with filters "Almost Page One", "Weak AEO", "Declining
  Citations", "Citation Rate Decline" [AO5, U]. Its own study: retrieval rank is the strongest predictor of citation (58.4% citation at
  retrieval rank 1 vs 14.2% at rank 10) [AO6, via MARKET_RND M7, vendor study].
- Does: **Quill** (2026-05-13): an agent that monitors content across AI platforms, finds gaps or stale information, drafts updates or new
  pages for human approval [AO2, U; AO3, U]. **Offsite** (2026-06-11): extends work to third-party sources [AO4, U; AO5, U].
- Proves: "ties moves to pipeline and revenue", method not given [AO1, V]. "Up to 130% citation-rate gains within weeks" [AO4, VC].

**Writesonic GEO**
- Chooses: Action Center with impact (medium / high) and effort per action, three categories: technical fixes, external mention
  acquisition, content visibility [WS1, V]. Ranks opportunities "by citation impact" [WS2, U].
- Does: Content Agent rewrites pages with FAQ blocks and comparison tables; **Outreach Agent** surfaces Reddit threads, YouTube videos and
  high-authority listicles citing competitors and drafts outreach [WS2, U]. WordPress publishing (MARKET_RND WS14).
- Proves: resolved vs unresolved items beside the visibility trend; "results typically appear within 2-4 weeks" [WS1, VC].

**Otterly**
- Chooses / does: GEO audit (25+ factors, five areas starting with robots and crawlers) with prioritised fix lists [OT1, U]; sits mostly
  on the monitoring side [OT1, U].
- Proves: published the most transparent small experiment of the year (date refresh, §3.2) [OT2, V].

**Daydream** ($15M Series A, Apr 2026 [DD1, U])
- An AI-native agency: SEO agents plus human growth leads; programmatic SEO at scale; tracks AI answers [DD1, U]. Case: Sunset to 27K
  monthly organic visitors in 6 months (organic, not AI) [DD2, U].

### 2.2 Suites

**Semrush Enterprise AIO (Adobe)**: **forecasting** (2025-12-11) ranks prompt gaps by projected impact (traffic, reach, mentions),
"directional indicators" [SE1, V]; one set of briefs and recommendations shared between Enterprise SEO and AIO [SE2, U]; fan-out queries
with who ranks for each (MARKET_RND SE6). No documented execution beyond briefs.

**Adobe LLM Optimizer**: **Optimize at Edge** deploys, at the CDN and only to agentic traffic (ChatGPT, Perplexity, Claude): Recover
Content Visibility (pre-render), Enrich Product Detail Pages, Add Table of Contents, Add LLM-Friendly Summaries, Add Relevant FAQs,
Simplify Complex Content, Add Multimedia Transcript Summaries. **Parity rule**: summaries and FAQs only reorganise existing page content;
if the source page changes (by `Last-Modified`) the optimisation pauses for human review, and without that header it is skipped;
one-click rollback [AD1, V]. Each opportunity carries a projected traffic value [AD5, U]. Off-site: identifies Reddit, Quora, Wikipedia,
YouTube opportunities and recommends link building and forum engagement [AD2, U]. Impact engine re-runs prompts about two weeks after a
deploy [AD4, via MARKET_RND]. Outcomes on adobe.com itself: Firefly citations 5x in a week, +200% visibility on another page, +41%
LLM-referred traffic [AD3, VC (customer zero)].

**Ahrefs Brand Radar**: diagnostics, not execution: cited pages with AI bot visits and AI traffic (last 90 days); prompt-based AIO / AI
Mode indexes; "Fix with Agent A" sends Site Audit issues to an agent [AH1, V, post dated 2026-06-26]. Brand Performance chart and
per-platform indexes as add-ons (24 Oct) [AH2, U]. "Found but not cited" (MARKET_RND AH4). No outreach or AI content workflow found.

**Conductor** (2026-11-03): **Recommendation Share** (a KPI for how strongly AI favours you over competitors), **Custom Market Index**
(prompt selection from real demand), **Conductor Actions** ("system of record" flagging content, technical and third-party-citation
opportunities and tracking what works), AEO Writing Assistant, **AgentStack** (MCP server + API across the lifecycle) [CO1, VC (press
release via a syndication site)]. Earlier, Recommendations were in beta with a one-click hand-off to the Writing Assistant [CO2, U
(competitor)].

**BrightEdge AI Catalyst**: for each question, which page holds the citation and how yours compares (citations, ranking keywords,
estimated traffic); a same-day brief on quality, depth, structure; **names the social platforms, publications and contributors that earn
citations on your topics** as outreach targets; prompts by buyer stage and audience (practitioner vs decision maker); alerts when a
competitor takes over an answer [BE1, V]. Agent Edge serves Markdown to verified agents (MARKET_RND BE2). Does not publish.

**seoClarity ArcAI 3.0** (2026-04-01): Accuracy & Narrative Control (find wrong claims, fix through owned content); Agentic Content
Workflow (briefs with brand voice and governance); Prompt Research Automation prioritising gaps where competitors outperform, from
clickstream [SC1, V]. No off-site.

**Botify**: PageWorkers implements, tests and reverts optimisations for bots from the platform; Template Assist (Mar 2026) [BO1, U].
Outcomes quoted are organic SEO, not AI [BO2, U].

**Yext Scout**: location-level visibility across AI and classic search, listings accuracy, reviews; an agent harness acts on listings,
reviews (responses), social, intent pages, with paid media via Flamel.ai; for brand-level queries agents read the **top 20 cited sources**
and draft a brief and article [YX1, V, recap dated 2026-10-08]. Scout MCP and API (May 2026) [YX3, U]. Claim: Yext's own AI visibility
+76% overall, +147% unbranded, and third to first for "agentic marketing" in two weeks with two pieces of content [YX1, VC, no method].

---

## 3. Case studies with numbers, and how much to believe them

### 3.1 Vendor and agency case studies

Credibility scale: **Low** = vendor-published, no sample, no baseline method, no control. **Low-Med** = baseline and timeframe stated,
still vendor-published and uncontrolled. Nothing reached Medium.

| # | Who / vendor | Result | Time | Actions behind it | Credibility |
|---|---|---|---|---|---|
| 1 | Ramp / Profound [PF5] | AI visibility 3.2% to 22.2%; rank 19th to 8th in AP software; 300+ citations to two pages | "within a month" (chart spans ~2.5 months) | Two segment pages (AP software for small / large businesses) + a "Top 6 AP automation software" list + an explainer, chosen because engines cited comparison content | Low-Med. Text says baseline 3.2%, chart says 12.2%. No prompt count, no control [VC] |
| 2 | 1840 & Company (remote staffing, a services firm) / Profound [PF6] | 0% to 6% (2 weeks) to 11% (1 month); "top 5" | 1 month | **One** blog post "10 Best Agencies for Remote Staffing" with the brand at the top, short FAQs; competitors Toptal ~74%, Upwork ~29% | Low. Undefined metric, no engines or prompt set named. Self-ranked list, the tactic §3.2 row 4 shows decaying [VC] |
| 3 | OpusClip / Profound [PF4] | +45% visibility, #1 citation share | 30 days | Not stated | Low [VC] |
| 4 | Airbyte / Profound [PF4] | Visibility 3x | 1 week | Not stated | Low [VC] |
| 5 | Hone / Profound [PF1][PF4] | Visibility +800%, "#1 AI-cited source" | Not stated | AI-optimised content workflows | Low [VC] |
| 6 | Ramp, MongoDB (+50%), CRS (20x), Plaid (+300% referrals), Arizona College (+51% conversions), Alchemy (7x signups), Aleph (+82% traffic), Omnilux (3x revenue), GR0 client ($1K to $100K/month) / Profound [PF4] | as listed | Not stated | Mostly "Profound" or "Profound Agents" | Low [VC]. 22 stories, 3 give a timeframe |
| 7 | NoGood (growth agency, a services firm) / Goodie [GO1] | AI-referred visits +335%; 48 leads from AI in Q1; top of ChatGPT and Gemini agency answers | 5 months | Q&A pages with client success stories and logos, semantic edits, structured data, a dedicated funnel for AI visitors | Low. No numeric visibility baseline; vendor and client share a founder [VC] |
| 8 | Dermalogica +127% AI conversions; SteelSeries 3.2x; Rathbones +106% citations / Goodie [U] | as listed | 6 months (SteelSeries) | Not stated | Low; a review notes no methodology [U] |
| 9 | Grüns SOV 2.0% to 12.6%; Verito 6x SOV; Lago +50% demos, 11x AIO impressions; Popl +38% MoM leads / AthenaHQ [AT1] | as listed | 60 days (Grüns, Verito) | Not stated | Low [VC] |
| 10 | Standard Metrics 9% to 24% of answers; Eco 5x visibility; "10%+ month-over-month" for brief users / Gauge [GG1] | as listed | <2 weeks; 4 weeks | Content-gap recommendations | Low [VC] |
| 11 | PostHog 41x LLM traffic; Braintrust 18x visibility / Gauge [GG2] | as listed | Not stated | Not attributed | Low [VC] |
| 12 | Halo Collar AI Brand Score 67 to 91, #5 to #1 in ChatGPT's base model / Evertune [EV1] | as listed | 2 months | 15 AI-optimised articles, 10 now cited [EV2, U] | Low [VC] |
| 13 | Adobe.com (customer zero) / Adobe LLM Optimizer [AD3] | Firefly citations 5x; +200% visibility on a page; +41% LLM traffic | 1 week | Edge optimisations (summaries, FAQs, pre-render) | Low; the vendor on its own site [VC] |
| 14 | Yext itself / Scout [YX1] | +76% visibility, +147% unbranded; 3rd to 1st on one topic | 2 weeks (the topic) | Two pieces of content | Low; no baseline, no method [VC] |
| 15 | AirOps customers [AO4] | up to +130% citation rate | "within weeks" | Quill refreshes | Low; event recap [VC] |
| 16 | Otterly users (G2 review) [OT1] | +22% positive mentions | Not stated | Acting on recommendations | Anecdote [U] |

**What the lifts have in common.** Where actions are stated, they are: a few new pages aimed exactly at the tracked prompts (segment pages,
comparisons, lists, Q&A), refreshes, and FAQ / summary structure. Big percentages come from tiny baselines (0% to 11%, 3.2% to 22.2%).
None separates the action from the platform's own growth, which [EX2] shows is the larger part of raw growth (ChatGPT referrals rose 5.7x
on treated pages but 3.5x on untreated ones).

### 3.2 Independent or semi-independent tests (better evidence, still small)

| # | Study | Design | Result | Credibility |
|---|---|---|---|---|
| 1 | Natural experiment on ChatGPT referrals [EX2] | One domain; a bundle of AEO changes on a set of pages, untreated pages on the same domain as control; interrupted time series | Level increase 1.82x (95% CI 1.31-2.54) on treated vs control; **placebo-in-time p = 0.16**; Google clicks unharmed | Medium. Preprint, one site, effect suggestive [V] |
| 2 | Stage model of brand visibility [EX1] | 34,960 unbranded prompt-engine observations, 75 projects, 2,854 prompts, GPT and Gemini, Jun-Sep 2026; chronological model, holdout AUC 0.94-0.96 | Mention rate 2.8% / 3.8% with no exposure; **49.0% / 58.4% with own-domain exposure in retrieval**; 91.4% / 100% with branded fan-out too; persistence: after a non-mention and no exposure, 1.6% / 1.9% next run | Medium. Observational, one monitoring vendor's data [V] |
| 3 | Visible date refresh [OT2] | 10 pages had only the visible "Last updated" date changed, 2 controls; 320 prompts, 7 engines, 30 days each side | Citations +31.5% vs controls -10.6%; ChatGPT 37 to 293, Claude +983, Perplexity +674; AI Mode -20%, Gemini -37% | Low-Med. Two controls, pre-trend present, vendor's own site. Authors advise real updates, not date changes [V] |
| 4 | Self-promotional "best X" lists [EX5] | 100 B2B "best software" queries in AIO, June; re-run September; 11,025-query follow-up | Brand's own list cited but the brand **not recommended 69% (224 of 323), then 83%**; self-ranked lists fell from 44% to 24% of cited listicles Jul-Oct 2026; subfolders with such lists lost 30-50% organic visibility in Jan 2026 | Low-Med. One researcher plus secondary write-ups [U] |
| 5 | llms.txt controlled test [EX4] | 5 sites with, 5 without, 6 weeks, 4 engines | ChatGPT +0.4 points (noise); Perplexity reported significant (p = 0.04) | Low. Small; blog [U] |
| 6 | Review profiles and AI citation [EX6] | 804,491 answers, 1,926 brands, 4 engines, March 2026; brands matched on Ahrefs metrics | Median citation rate 1% with no Trustpilot profile vs 53.5% with 1-13 reviews; about +25 points more with an active profile; 99.5% of Trustpilot citations came through organic rankings | Low-Med. Correlational, Trustpilot-centred, consumer-heavy; B2B not reported apart [V] |
| 7 | Who AI recommends for software vendors [EX7] | 48 buyer questions x 3 runs, ChatGPT / Claude / Perplexity, 2026-08-25, plus an Oct snapshot | ChatGPT names consulting giants (sources accenture.com, deloitte.com, clutch.co); Perplexity cites linkedin.com (26 of 48), reddit.com (18), clutch.co (13); the author appeared in 0 of 38 generic ChatGPT answers | Low. Author is a vendor in the results [U] |
| 8 | What assistants read when asked to pick an agency [EX8] | 10 questions, 4 assistants, July 2026, raw data CC BY 4.0 | Directories 31% of sources (clutch.co most read); 74% of sites read by one assistant only; 7% source agreement between assistants; repeat-run consistency ChatGPT 32%, Perplexity 72% | Low-Med. Small, but open data [V] |

**Which actions are supported, ranked by evidence strength for a B2B services brand:**
1. **Be in the retrieval set** for the fan-out searches (rank in Google / Bing / Brave for them; be cited on the pages that rank) [EX1,
   AO6, MARKET_RND M18]. Strongest.
2. **Earned presence on the pages assistants read**: directories (Clutch for services), review profiles, comparison lists written by
   others, LinkedIn, Reddit / forums [EX6, EX7, EX8; MARKET_RND M21, M43]. Correlational but consistent across studies.
3. **Pages that answer the exact buyer questions** (segment pages, honest comparisons, Q&A with proof such as client stories) [PF5, GO1].
   Case-study level only.
4. **Real freshness** [OT2; MARKET_RND M23, M24]. Small experiments.
5. **Structure** (answer first, FAQs, summaries) helps extraction once retrieved [AD1 concept; MARKET_RND M25]. Lab effect.
6. Self-ranked lists, llms.txt, schema: **do not count on them** [EX5, EX4, EX12; MARKET_RND M44].

---

## 4. Agent-facing surfaces: what matters for a services company in 2026

| Surface | State, Nov 2026 | For a B2B services company (techand.ai, devaicon.com) |
|---|---|---|
| **llms.txt / llms-full.txt** | Adoption 4,088 to 36,120 sites in a year (Originality.ai) but 97% of files got zero requests in May 2026 and AI retrieval bots were 1.1% of what requests arrived (Ahrefs, 137k domains) [EX12, U]. Google: "You don't need to create new machine readable files, AI text files, or markup to appear in these features" [EX11, V]. No major assistant has committed to reading it [EX12, U] | **Hype.** Keep it as a free nicety in the fix pack; never score it or promise an effect. Our current weight 0 is right |
| **Raw-HTML readability for answer bots** | ChatGPT, Claude, Perplexity fetchers do not run JavaScript (MARKET_RND / AI_GROWTH_SPEC); Adobe's first edge opportunity is "Recover Content Visibility" (pre-render) [AD1, V]; Profound and Scrunch sell the same at the CDN [PF8, U; SR1, V] | **Matters.** Fix at the origin (server render or static), which avoids cloaking. Our readiness check already reads raw HTML |
| **Agent-only pages at the CDN** (AXP, Optimize at Edge, Dynamic Bot Rendering, Agent Edge) | Shipping at four vendors; parity documented only by Adobe (summaries reorganise existing content; pause on source change) [AD1, V]. Google: dynamic rendering is a temporary workaround, not best practice [search result only] | **Risky; not needed** for small services sites that can fix the page itself. If ever built: parity diff required |
| **MCP server for the brand** | 10,000+ MCP servers exist; visibility tools ship MCP for reading their data; no measured effect of a brand MCP server on recommendations [EX13, U]. Peec, Profound, Conductor, Yext, AirOps all have MCP / API for their own data | **Hype for discovery.** Useful only if customers need a connected tool. Our own MCP (read + start runs) is parity, not a lever |
| **NLWeb (/ask)** | Reference implementation never tagged a release; Tripadvisor and O'Reilly in production, others announced; trend "receding" [EX14, V/U]; no measured assistant use [EX14, V] | **Hype.** Ignore |
| **OpenAI Agentic Commerce Protocol, apps in ChatGPT** | Instant Checkout scaled back 2026-03-24; ACP now mainly feeds product discovery; transactions moved to retailer apps (Walmart, Instacart, Target, Expedia, Booking) [EX15, U]. Google's UCP for AI Mode and Gemini (Jan 2026) [EX15, U] | **Not relevant** to B2B services. Revisit only for e-commerce clients |
| **Index submission where each engine retrieves** | Copilot uses Bing; Claude uses Brave; Gemini / AIO / AI Mode use Google; Perplexity its own index (AI_GROWTH_SPEC table). Bing AI Performance and Search Console's AI report have no API (MARKET_RND) | **Matters.** Bing SubmitUrlBatch + IndexNow (built, no leader has it); Brave has no submission API (search result only, not verified) |
| **Directories, reviews, partner listings** | Assistants read directories for 31% of agency-hiring sources; Clutch most read [EX8, V]; Clutch is among ChatGPT's and Perplexity's sources for software vendors [EX7, U]; review profiles correlate with citation [EX6, V] | **Matters most** for services. For techand.ai: Microsoft partner listings; for devaicon.com: Clutch / GoodFirms / G2 and reviews |
| **Google Business Profile / local data** | Yext's core; agent responses to reviews [YX1, V] | **Secondary** for two firms that sell regionally, not walk-in |
| **ChatGPT ads** | Evertune Ads Agent [EV1, V]; Bluefish Paid Media Briefs [BF1, V]; ChatGPT ads about a $1B run rate (per Bluefish) [BF1, VC] | **A real, paid lever** that sits outside organic. Optional, owner decision, labelled as paid |

---

## 5. Agencies' published GEO processes

Little of this is published in detail; what is published converges on the same four moves (owned answer pages, technical access,
earned presence, measurement).

| Agency | Published process | Cadence / price | Evidence |
|---|---|---|---|
| **iPullRank** ("Relevance Engineering") | Six stages: Strategic Planning (joint business + activation plans); **Content Engineering** (relevance and content audits find which passages AI can retrieve and what is missing); Solutions Engineering (technical access and parsing); **Conversation Engineering** (link building, digital PR, community participation aimed at the sources AI cites); Creative (content on a credits model); Measurement Engineering (citation share, passage retrieval) [AG2, U (third-party teardown of iPullRank's 2026-07-16 post)]. Service page lists an AI search visibility review covering query fan-out and passage performance, a measurement plan, content engineering [AG1, V] | Not stated | No method or outcome published beyond "$5B+ in organic results" [AG1, VC] |
| **Grow and Convert** | (1) bottom-of-funnel owned pages that rank on Google, which exposes the brand to LLMs; (2) the **client** picks the topics to track; (3) human-written articles from interviews with product and sales experts; (4) link building and an optional **citation outreach** add-on: find "which articles are appearing most often in AI search citations for topics of interest" and ask those publishers to include the brand; (5) conversions per page, first and last touch [AG3, V] | Monthly content and reporting; $10k / month; "6+ months minimum" [AG3, V] | No GEO metric published [AG3, V] |
| **First Page Sage** | Six elements of GEO, visible ones: list creation and optimisation, online review management, social sentiment monitoring; Google / Bing rankings strongly influence AI recommendations; awards, accreditations, company size, usage statistics shape order [AG4, U (search result only)] | Not found | A 2024 study of 11,128 ChatGPT queries [AG4, U] |
| **Seer Interactive** | No process document found. Publishes studies: recency, AIO impact (5.47M queries, 53 brands), review profiles (§3.2 row 6) [AG5, U; EX6, V] | n/a | Studies, not a playbook |
| **NoGood** (agency behind Goodie) | Q&A content with client success stories and logos, semantic and schema edits, an AI-visitor funnel [GO1, V] | n/a | §3.1 row 7 |
| **Siege Media, Omniscient Digital** | No primary process page found. Third-party listings: Siege offers GEO with digital PR, data journalism and Reddit work; Omniscient runs B2B "growth pods" combining SEO, GEO and off-page distribution [AG6, U] | n/a | None |

**The weekly agency loop, as far as it can be reconstructed:** re-run the client's chosen prompts; read which pages AI cited for the ones
lost; for each lost prompt either write / refresh an owned page or pitch the cited third-party page (list owner, publication, community);
fix access issues; report citations, share and conversions monthly. People do the pitching, PR and community work.

---

## 6. Capability matrix: Alaventra against the leaders

Cells: **Y** documented, **P** partial, **N** not found, **D** deliberately not built. Tags on leader cells follow §2's sources.
"Bar" is the best documented implementation, which is what we must beat, not match.

| # | Capability | Alaventra today | Profound | Peec | Gauge | AirOps | Writesonic | AthenaHQ | Adobe LLMO / Semrush AIO | Conductor | BrightEdge | Yext | Best-in-class bar today |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Per-question diagnosis of WHY a question is lost (not retrieved / retrieved not cited / cited not named) | P: retrieved-not-cited and source types built 2026-10-23; fan-out ranking gap built, **default off** (`ai_fanout_check` 0); no single per-question cause | P (gaps, no stages) | P (evidence per card) | P (low-mention-rate type = cited not named) | P (filters) | N | P ("passages and sources AI pulls from") | P (fan-out who-ranks, Semrush) | N | P (who holds the citation, vs your page) | N | BrightEdge + Gauge: who holds the citation, how your page compares, and "cited but not named" as its own action type. **Nobody classifies each lost question into a funnel stage** |
| 2 | Opportunity scoring | Y: value = AI search volume x buyer stage x competitors named x engines lost; max 6 queued (AI_GROWTH_SPEC §2.4) | P (ranked, method hidden) | P (Relative impact, one scale, formula hidden) | Y (gap vs demand, zero-visibility topics first, why panel) | N | P (impact + effort) | P (ACE predicts citation probability, Enterprise) | Y (projected traffic / growth per gap) | P | P | N | Gauge's gap x demand with evidence + Semrush / Adobe projected impact. None publishes the formula or its accuracy |
| 3 | Source / domain gap: which third-party pages AI cites for my questions | Y: exact pages cited in answers that did not name us, who they name, contact (AI Growth §2.5); 2 per site a week | P | Y (competitor sources, source types) | Y (influential citation opportunities) | Y (Offsite) | Y (Reddit / YouTube / listicles citing competitors) | Y | Y (Reddit, Quora, Wikipedia, YouTube) | P | Y (publications, platforms, contributors) | Y (top 20 cited sources per query) | Writesonic + BrightEdge: per competitor, every thread / video / list / publication citing them |
| 4 | Owned content generation (answer pages, refreshes) | Y: AI page of the week (`ai_pages_month` default 2, max 1 a week), refresh of the ranking page, or the ladder page; fan-out sections; answer first | Y (Agents) | P (briefs only) | Y (18 articles a month) | Y (Quill) | Y | Y | P (briefs; edge summaries / FAQs) | Y (Writing Assistant) | P (briefs) | Y (brief + article) | Profound / Gauge / AirOps: brief-research-outline-draft-review agents, approval gates, volume |
| 5 | Publishing | Y: WordPress, Webflow, Contentful, signed webhook (CMS publishing 2026-10-18) | Y (CMS) | N | Y (Webflow, Framer, Sanity, **pull request**) | Y | Y (WordPress) | Y (Shopify, Webflow, Framer) | Y (edge) | P | N | Y (pages, listings) | Gauge's pull request for repo-based sites + CMS connectors |
| 6 | Outreach to cited third-party pages | Y: drafts by the Link Builder, sent **from the client's own mailbox after approval**, follow-ups, reply reader, consent rules; "won" only when the page names the client | N | P (placement action, no send) | N (target only) | P (Offsite) | P (drafts) | P (link building in managed service) | P (recommends) | N | N (targets only) | N | **Us.** Leaders stop at the draft or the target list |
| 7 | Community playbooks (Reddit, Quora, YouTube, forums) | P: "forum: answer as yourself, disclosed; video / social: publish" as an action kind; no thread finder, no YouTube plan | N | P (UGC sources) | N | N | Y (finds threads, drafts) | N | P (recommends forum engagement) | N | P (social platforms named) | Y (social publishing) | Writesonic's thread / video finder with drafts. Nobody verifies a disclosed, genuine contribution |
| 8 | Directory, review-site and partner-listing programme | P: listings checklist (G2, Capterra, TrustRadius, Clutch, Crunchbase, LinkedIn, MoF list, OpenPeppol, marketplaces), "missing / present / unknown"; no review asks | N | N | N | N | N | N | N | N | N | Y (listings + review responses, location level) | Yext for locations. **No one runs a B2B services directory + review programme** |
| 9 | Accuracy: wrong claims and corrections | P: checked against the business profile, correction drafts; idle when no profile (both clients) | Y (FactCheck) | Y (correct owned / request source correction) | N | N | N | P (crisis tools) | N | N | N | N | Peec's two correction types incl. asking the source to correct |
| 10 | Technical access for answer bots | Y: raw-HTML readiness (12 pages a week), AI crawler robots check, site tasks "Steps on your website" verified by us | P (Dynamic Bot Rendering) | Y | Y (9-criteria health) | N | Y | N | Y (edge pre-render, parity rule, rollback) | P | P | N | Adobe: fix at the edge with parity and rollback. Ours fixes at the origin and verifies |
| 11 | Index submission per engine | Y: Bing SubmitUrlBatch, Bing crawl state, IndexNow (key file checked) | N | N | N | N | N | N | N | N | N | N | **Us, alone** |
| 12 | Entity / knowledge base | P: Wikidata check monthly; no creation | N | N | N | N | N | N | P (Wikipedia correction suggested) | N | N | P (knowledge graph for listings) | Nobody creates or verifies entities end to end |
| 13 | Paid AI placements | N | N | N | N | N | N | N | N | N | N | Y (Flamel paid media) | Evertune Ads Agent, Bluefish Paid Media Briefs |
| 14 | Always-on agent that proposes work weekly with reasoning | P: AI Growth runs weekly and ranks actions; no memo, no "why it changed" | Y (Aim) | Y (Peec Agent) | P | Y (Quill) | N | P | P | Y (AgentStack) | N | Y (harness) | Profound Aim: weekly ranked opportunities, memo of likely causes, project with briefs, agent built for it |
| 15 | Impact of an action (verification) | Y: did-it-work, treated questions vs matched control questions, difference in differences with a range, "likely helped / can't tell" (built 2026-10-23, W2-E2 §5) | P (results tracked) | P (markers on a trend) | Y (actual vs projected; auto-complete when the page gets cited) | P | P | P | P (re-run prompts ~2 weeks after deploy) | P (Actions tracks what works) | N | N | Gauge (projection vs actual) + Adobe (re-run). **No leader uses controls; we do** |
| 16 | Learning: which levers work, fed back into scoring | N: verdicts stored, not fed back | P ("closed loop", no method) | N | N | N | N | P ("self-learning" agent) | N | P | N | N | Profound's claimed loop. Nothing published |
| 17 | Statistical honesty in action reports (ranges, refusals) | Y: Wilson / clustered ranges, refusal across changed panels, n shown (MARKET_RND §2.1) | N | N | N | N | N | P (SE via API) | N ("directional") | N | N | N | **Us** |
| 18 | Safety rules on tactics (no self-ranking, no cloaking, no paid citation placement) | Y: refuses self-ranking listicles, AI-only CDN pages, prompt injection, ChatGPT ads (AI_GROWTH_SPEC §1) | N (case 1840 used a self-ranked list) | P (published a study of self-promotional lists) | N | N | N | N | P (parity rule at the edge) | N | N | N | Us, plus Adobe's parity rule |
| 19 | Owner approval before anything leaves | Y: approve each draft (default), nothing sent without it; CMS publish on owner choice | Y | Y | Y (brief, outline) | Y | ? | ? | Y (deploy / rollback) | ? | n/a | Y (logged, human in loop) | Parity across the field |
| 20 | Cost per action and per win, shown before and after | P: cost per run and per page shown before you pay; no cost per won question | N | N | N | N | N | N | N | N | N | N | Nobody. Open lead |

---

## 7. The best-of-breed ACTION pipeline

Built from the strongest documented pieces, adapted to a B2B services brand that starts near zero (both clients). Automation level per
step: **AUTO** (software does it fully), **APPROVE** (software prepares, the client approves, software executes), **HUMAN** (a person must
do it; software finds, drafts, tracks and verifies).

### Stage 1. Diagnose each question (AUTO)

For every tracked question and engine, place it in one funnel stage, using data we already buy:
1. **Not retrieved**: our domain is in neither the engine's retrieved results (`search_results` of the ChatGPT scraper, fan-out result
   pages) nor the top 10 for the fan-out searches. Evidence that this is the gate: [EX1] (exposure moves mention rates from ~3% to
   49-58%), [AO6] (citation odds fall with retrieval rank).
2. **Retrieved, not cited**: our page was read but another page was cited. Compare the two pages (answer position, coverage of the
   question, freshness, proof), as BrightEdge does per question [BE1].
3. **Cited, not named**: our page is a source but the answer does not name us (Gauge's "fastest win" [GG1]). Usually the page does not
   state who we are and what we do in the passage that gets quoted.
4. **Named, not first / negative / wrong**: position, sentiment, accuracy problems.
5. **Off-domain gap**: competitors are named via third-party pages (lists, directories, reviews, Reddit, LinkedIn) that do not
   mention us. Source types from the 2026-10-23 work.

Output per question: stage, the evidence (the competing URL, the fan-out searches and who ranks), and the engines affected. Leaders show
evidence per card; none documents a stage per question (matrix row 1).

### Stage 2. Choose levers (AUTO scoring, APPROVE the plan)

Map stage to levers, then score: **expected gain = P(lever moves the stage) x value of the question**. Value = demand (range from
several proxies, MARKET_RND gap 9) x buyer stage x engines lost (ours today). P starts from a published prior per lever and stage and is
then **learned from our own verified outcomes** (Stage 5). Effort and cost per lever are shown next to the gain, as Writesonic shows
effort [WS1].

| Stage | Levers, in order |
|---|---|
| Not retrieved | rank for the fan-out searches (new page or section per search); Bing / IndexNow submission; fix raw-HTML access; get onto the pages that rank for those searches (outreach) |
| Retrieved, not cited | refresh the page against the cited competitor page: answer first, cover the question, real update, proof (figures with sources, client cases) |
| Cited, not named | put the brand name and what it does in the quoted passage, author and organisation clear; a short "who we are" answer near the top |
| Named, low / wrong | correct owned pages; ask the source to correct (Peec's second correction type [PE1]); add proof |
| Off-domain gap | directory profiles and reviews (Clutch, G2, Trustpilot, partner directories); ask list owners to evaluate us; contribute data or quotes to cited articles; disclosed community answers |

Guardrails (refuse and say why): self-ranked "best X" lists [EX5], agent-only CDN pages without parity [AD1], paid citation placement
and coordinated page networks [EX10], prompt injection (AI_GROWTH_SPEC §1), questions failing the fit gate (MARKET_RND §2.1 item 6).

### Stage 3. Generate and execute

| Work | Level | Who leads today |
|---|---|---|
| Briefs, drafts of new answer pages and refreshes, fan-out sections | AUTO draft, **APPROVE** publish | Profound, Gauge, AirOps |
| Publishing (CMS, pull request) | APPROVE (or AUTO if the owner opts in) | Gauge (PR), Profound |
| "Cited, not named" passage fixes | APPROVE (small edit; can be a site task the client applies) | Gauge |
| Technical fixes (render, robots, crawler access) | HUMAN on the client's site, AUTO verification (our site tasks) | Adobe (edge) |
| Bing / IndexNow submission | AUTO | Us only |
| Outreach to list owners, publications, cited articles | AUTO find + draft, **APPROVE** each send, AUTO follow-ups and reply reading | Us (send + verify) |
| Directory profiles and review asks to past clients | **HUMAN** (the client creates profiles and asks customers); AUTO checklist, templates, verification of presence and review count | Yext (locations) |
| Community (Reddit, Quora, LinkedIn, YouTube) | **HUMAN**, disclosed, as the client; AUTO thread finder and draft | Writesonic (finder) |
| Digital PR, data studies, expert quotes | **HUMAN**; AUTO targets and pitch drafts | Agencies |
| Corrections at third-party sources | APPROVE the request, HUMAN where the source needs a person | Peec |
| Paid ChatGPT / Google placements | APPROVE, budget set by the owner, labelled paid | Evertune, Bluefish |

### Stage 4. Verify (AUTO)

1. **Did the action happen?** The page is live and readable as raw HTML; the outreach page now names the client; the directory profile
   exists; the review count rose (we already verify "won" this way for outreach and site tasks).
2. **Did the stage move?** Re-run the action's questions on a fixed schedule after it (Adobe re-runs at ~2 weeks [AD4]); check whether
   our page entered the retrieved set or the citations (Gauge auto-completes on a new citation [GG1]).
3. **Did it cause a lift?** Treated vs matched control questions, difference in differences with a range, placebo-in-time check before
   claiming a win [EX2]; print "likely helped / can't tell", never "caused" (ours, built).

### Stage 5. Learn (AUTO)

Store each action's verdict with its lever, stage, engine, question type and cost. Update P(lever moves the stage) per lever x stage x
engine (a simple Bayesian update, pooled across sites with each site's own data weighted up). Use it in Stage 2 next week. Report "what
worked for you" and the **cost per won question**. Profound claims a closed loop [PF1, VC]; no one publishes how it learns or how
accurate its projections are; Gauge at least compares projection with outcome [GG1].

### Weekly rhythm

Monday: measure (existing), diagnose, score, propose (with a short memo of what changed and why, as Aim does [PF2]). Owner approves the
plan and each send / publish. Through the week: drafts, sends, follow-ups, submissions. Two and four weeks after each action: verify.
Monthly: learning update, entity and directory review.

---

## 8. Where we can lead

Owner rule: better than the leaders, not equal. Each item below is something **no leader does well**, with the evidence that it matters.

1. **Per-question stage diagnosis (retrieval, citation, naming) that drives the lever.** No leader classifies each lost question into a
   funnel stage (matrix row 1). Evidence it matters: exposure in the retrieval path is the dominant predictor of being named (2.8% to
   49.0% on GPT, 3.8% to 58.4% on Gemini) [EX1]; citation odds fall from 58.4% at retrieval rank 1 to 14.2% at rank 10 [AO6]. A cold-start
   brand (both clients) needs retrieval levers before content polish, and today's tools do not tell it so. We hold most inputs already
   (retrieved-not-cited, fan-out gap, source types); the fan-out check is off by default.

2. **Impact with controls, as the default verdict on every action.** Leaders show before/after or compare with their own projection;
   none uses control questions (matrix row 15). Evidence: the only controlled field study found headline multiples overstate the effect
   and its 1.82x lift failed a placebo test [EX2]; the date-refresh test shows pre-trends that a before/after reading would credit to the
   action [OT2]. We built difference in differences on matched control questions; leading means running it on every action, adding the
   placebo check, and refusing "win" claims that fail it.

3. **A learning loop with a published method.** Profound and AthenaHQ claim "self-learning" with no method (matrix row 16). Evidence it
   matters: lever effects differ sharply by engine (the same date refresh: ChatGPT +692%, Gemini -37% [OT2]) and by category; a fixed
   playbook cannot be right for both a Dynamics partner in the UAE and a custom-software firm. Lead: per-lever, per-engine effect
   estimates learned from our verified outcomes, shown with ranges, used in scoring, and the projection's accuracy reported.

4. **Off-site work carried through to the result.** Leaders stop at a target list or a draft (matrix rows 3, 6, 7). Evidence it matters:
   earned media is about 84% of AI citations and branded mentions correlate 0.664 with AI brand mentions vs 0.218 for links
   (MARKET_RND M21, M43); assistants read directories for 31% of agency-hiring sources [EX8]. We already send from the client's mailbox
   after approval and mark "won" only when the page names the client. Lead: extend the same send-and-verify loop to list owners, cited
   articles, directory profiles and review counts, and attribute each win to the questions it moved.

5. **A B2B services directory and review programme.** Only Yext runs listings and reviews, and only for locations (matrix row 8).
   Evidence: review profiles correlate with citation (1% to 53.5% median citation rate) [EX6]; Clutch is among the most-read sources when
   assistants pick software vendors or agencies [EX7, EX8]. Lead: per client, the directories that the engines actually read for its
   questions (from our own citation data, not a fixed list), the profile and review steps as verified site tasks, and the review asks as
   approved e-mails to past clients.

6. **Indexing where each engine retrieves.** Still nobody else submits to Bing / IndexNow or checks the crawl state (matrix row 11). It
   is the cheapest retrieval lever and it fits the evidence in item 1. Lead: tie submission to the fan-out searches a page targets and
   verify it with the retrieved-set check.

7. **Safe tactics by rule, with the reason shown.** Leaders sell or showcase tactics that are decaying or near policy lines: a self-ranked
   list in a flagship case [PF6] while such lists lose the recommendation 69-83% of the time and lost 30-50% organic visibility [EX5];
   agent-only pages at the CDN with parity documented by only one vendor [AD1, SR1]. Lead: refuse those, explain why, and keep the
   client's Google rankings safe while working on AI (the owner's "nothing breaks" rule extends to clients).

8. **Cost per won question.** No leader shows the cost of an action or a win (matrix row 20). We already price every run before it
   starts. Lead: cost per action and per verified win, by lever, so a client sees which levers pay.

9. **Already ours, keep it** (MARKET_RND §2.1): statistical ranges and refusals across changed panels, the fit gate on questions,
   owner approval before anything is sent, verified crawler identity.

### What we lack against the leaders (to close, not to lead)

- An **always-on proposal memo**: "this changed, likely because, here is the plan" (Profound Aim [PF2]).
- **"Cited, not named" as its own action** with a passage fix (Gauge [GG1]).
- **Projected impact per action** in traffic or leads, and its accuracy (Semrush, Adobe, Gauge [SE1, AD5, GG1]).
- **Volume and depth of owned content**: one AI page a week at most vs 18 articles a month at Gauge [GG2]; agent passes (brief, research,
  outline, draft, review) with approval at brief and outline [GG1].
- **Pull-request publishing** for repo-based sites (Gauge [GG1]); devaicon.com-style sites built from code need it.
- **Community thread / video finder** with drafts (Writesonic [WS2]).
- **Correction requests to third-party sources** (Peec [PE1]).
- **Competitor's cited-source inventory** per competitor (Writesonic, Yext top 20 [WS2, YX1]).
- **Paid AI placements** (Evertune, Bluefish [EV1, BF1]): an owner decision, not a gap to close by default.
- **Fan-out check on by default** for sites in cold start (ours is built, off by default).

---

## 9. Least certain points in this file

1. Peec Agent and AirOps Quill details come from search summaries of press releases that returned 403.
2. Conductor's 2026-11-03 suite is from a syndicated press release; no product docs opened.
3. AthenaHQ ACE's mechanism and plan tier are not documented on its site; reviews conflict.
4. Google's 2026-05-15 spam-policy wording on generative AI was not read on Google's own page.
5. First Page Sage's six GEO elements: only three seen, via a search snippet.
6. Siege Media and Omniscient Digital processes: no primary source found.
7. The stage model [EX1] and the natural experiment [EX2] are preprints, read as abstracts; neither is peer reviewed.
8. Alaventra's column is from repo documents, not a code read or live run (R5 covers code; R4 covers production outcomes).

---

## 10. Sources (opened 2026-11-05 unless marked)

**Profound**
- PF1 https://www.tryprofound.com/features/agents
- PF2 https://www.tryprofound.com/features/aim
- PF3 https://docs.tryprofound.com/agents/about (redirected from help.tryprofound.com)
- PF4 https://www.tryprofound.com/customers
- PF5 https://www.tryprofound.com/customers/ramp
- PF6 https://www.tryprofound.com/customers/1840-co-answer-engine-optimization-case-study
- PF7 https://www.globenewswire.com/news-release/2026/07/02/3321345/0/en/profound-launches-aim-to-transform-ai-search-data-into-marketing-execution.html (search result only)
- PF8 https://www.tryprofound.com/blog/introducing-dynamic-bot-rendering (search result only)
- PF9 https://debriefing.io/intel/profound-aim-ai-search-marketing-execution-agent (3P)

**Peec AI**
- PE1 https://docs.peec.ai/actions.md
- PE2 https://www.globenewswire.com/news-release/2026/10/22/3386740/0/en/peec-ai-launches-peec-agent-and-expands-actions-so-marketing-teams-can-act-on-what-ai-search-says-about-their-brand.html (403; search result only)
- PE3 https://www.globenewswire.com/news-release/2026/11/02/3393511/0/en/peec-ai-doubles-revenue-in-six-months-to-hit-20m-arr.html (search result only)

**AthenaHQ**
- AT1 https://www.athenahq.ai/
- AT2 https://industry-lens.com/reports/signal-spotlight-athenahq (search result only, 3P)
- AT3 https://trakkr.ai/reviews/athenahq-review (search result only, 3P competitor)

**Scrunch**
- SR1 https://helpcenter.scrunchai.com/en/articles/13656392-agent-experience-platform-axp
- SR2 https://www.stackmatix.com/blog/scrunch-review (search result only, 3P)

**Evertune**
- EV1 https://www.evertune.ai/
- EV2 https://ampifire.com/blog/evertune-ai-reviews-pricing-is-this-geo-platform-legit/ (search result only, 3P)

**Bluefish**
- BF1 https://www.bluefishai.com/blog/bluefish-expands-agentic-marketing-platform-into-paid-media-to-unite-the-ai-marketing-funnel
- BF2 https://meev.ai/reviews/bluefish-ai (search result only, 3P)

**Goodie**
- GO1 https://higoodie.com/case-studies/nogood/

**Brandlight**
- BL1 https://www.brandlight.ai/solutions (search result only)
- BL2 https://surferstack.com/guides/the-complete-brandlight-ai-review-in-2026-features-pricing-real-limitations-and-better-alternatives (search result only, 3P)

**Gauge**
- GG1 https://www.withgauge.com/features/action-center/
- GG2 https://www.withgauge.com

**Daydream**
- DD1 https://www.citybiz.co/article/828296/daydream-raises-15m-to-build-ai-native-seo-aeo-agency/ (search result only)
- DD2 https://www.casestudies.com/company/daydream/case-study/sunset-customer-case-study (search result only)

**AirOps**
- AO1 https://www.airops.com/
- AO2 https://www.businesswire.com/news/home/20260513093119/en/AirOps-Launches-Quill-The-AI-Agent-Lead-That-Monitors-Updates-and-Drafts-Content-So-Brands-Stay-Visible-in-AI-Search (403; search result only)
- AO3 https://siliconangle.com/2026/05/13/exclusive-airops-targets-emerging-ai-search-market-autonomous-content-optimization-agent/ (search result only)
- AO4 https://www.airops.com/blog/airops-next-2026-recap (search result only)
- AO5 https://mentionagent.ai/blog/airops-review/ (search result only, 3P)
- AO6 https://www.airops.com/report/the-fan-out-effect-what-happens-between-a-query-and-a-citation (via MARKET_RND M7, opened 2026-10-23; vendor study)

**Writesonic**
- WS1 https://writesonic.com/blog/geo-action-center (published 2025-07-15, updated 2026-03-21)
- WS2 https://tooliverse.ai/tools/writesonic (search result only, 3P)

**Otterly**
- OT1 https://help.otterly.ai/what-does-the-geo-audit-do and https://rankability.com/blog/otterly-ai-review/ (search results only)
- OT2 https://otterly.ai/blog/publication-date-ai-citations-experiment/ (updated 2026-09-24)

**Semrush / Adobe**
- SE1 https://www.semrush.com/news/439224-semrush-enterprise-ai-optimization-adds-new-ai-search-forecasting-capabilities/ (dated 2025-12-11)
- SE2 https://www.semrush.com/news/459685-semrush-for-enterprise-unifies-content-optimization-capabilities-across-seo-and-ai-search/ (search result only)
- AD1 https://experienceleague.adobe.com/en/docs/llm-optimizer/using/resources/optimize-at-edge/overview
- AD2 https://business.adobe.com/products/llm-optimizer/optimize-your-brand.html (search result only)
- AD3 https://deepsmith.ai/blog/adobe-llm-optimizer-review and https://aureatelabs.com/blog/adobe-llm-optimizer/ (search results only, 3P)
- AD4 MARKET_RND AD6 (Adobe impact engine re-runs prompts ~2 weeks after a deploy; opened 2026-10-23)
- AD5 https://experienceleague.adobe.com/en/slides/llm-optimizer-overview (search result only)

**Ahrefs**
- AH1 https://ahrefs.com/blog/new-features-may-2026/ (dated 2026-06-26)
- AH2 https://releasebot.io/updates/ahrefs (search result only, aggregator)

**Conductor**
- CO1 https://www.financialcontent.com/article/bizwire-2026-11-3-conductor-launches-new-aeo-product-suite-empowering-brands-to-win-ai-recommendations
- CO2 https://www.tryprofound.com/articles/profound-vs-conductor (search result only, competitor)

**BrightEdge**
- BE1 https://www.brightedge.com/ai-catalyst

**seoClarity**
- SC1 https://www.seoclarity.net/resources/news/seoclarity-launches-arcai-3.0-to-reclaim-brand-narrative-in-ai-search (dated 2026-04-01)

**Botify**
- BO1 https://www.botify.com/product-releases/march-2026-release-highlights (search result only)
- BO2 https://crawlraven.com/blog/botify-review (search result only, 3P)

**Yext**
- YX1 https://www.yext.com/blog/yext-envision-2026-recap (dated 2026-10-08)
- YX3 https://www.martech360.com/news/ai-automation/yext-expands-scout-platform-with-mcp-and-api-launch-to-power-the-agentic-marketing-era (search result only)

**Evidence and studies**
- EX1 https://arxiv.org/abs/2609.23162 (preprint, 2026-09-19; abstract read)
- EX2 https://arxiv.org/abs/2606.04362 (preprint, 2026-06-03; abstract read)
- EX4 https://attrifast.com/blog/should-i-publish-llms-txt-honest-test (search result only)
- EX5 https://lilyraynyc.substack.com/p/why-calling-yourself-the-best-could and https://searchengineland.com/google-ai-overviews-cite-self-serving-listicles-recommend-competitors-480573 (search results only)
- EX6 https://www.seerinteractive.com/insights/study-of-800k-ai-responses-how-reviews-shape-brand-presence-in-ai-search (2026-05-14)
- EX7 https://www.hashlogics.com/reports/who-ai-recommends-software-vendors-2026
- EX8 https://greaterthanservices.com/blog/ai-search-study-marketing-agencies (published 2026-08-14, updated 2026-10-28)
- EX10 https://letsdatascience.com/news/google-updates-spam-rules-to-ban-ai-manipulation-f59cc409 (search result only; Google's own page not read)
- EX11 https://developers.google.com/search/docs/appearance/ai-features
- EX12 https://ppc.land/llms-txt-adoption-rises-8-8x-but-97-of-files-get-zero-ai-requests/ (search result only)
- EX13 https://www.searchmaxxed.com/research/mcp-and-ai-search (search result only)
- EX14 https://presenc.ai/research/nlweb-adoption-2026 (status Sep 2026) and https://agentic-readiness.lumar.io/docs/capabilities/nl-web (search result only)
- EX15 https://rye.com/blog/openai-chatgpt-checkout-agentic-commerce and https://www.digitalcommerce360.com/2026/03/24/openai-agentic-commerce-updates-chatgpt-walmart/ (search results only)
- Not opened (403): https://searchengineland.com/geo-experiments-challenge-conventional-ai-visibility-advice-488342

**Agencies**
- AG1 https://ipullrank.com/services/relevance-engineering
- AG2 https://somethinginc.com/blog/relevance-engineering-agency-teardown/ (2026-07-30, 3P teardown)
- AG3 https://www.growandconvert.com/geo-service/
- AG4 https://firstpagesage.com/?p=31263 (search result only)
- AG5 https://www.seerinteractive.com/insights/tag/geo (search result only)
- AG6 https://www.pepper.inc/blog/generative-engine-optimization-agency/ (search result only, 3P)

**Earlier research reused (opened 2026-10-23, keys as in MARKET_RND §6):** M7, M15, M18, M21, M23, M24, M25, M43, M44, PE9, SE6, AH4,
BE2, GO6, WS14, PF13.
