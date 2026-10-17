# Market benchmark — Ascentra against the leaders, October 2026

Written 2026-10-17 for the whole-system rating of 2026-10-17. Research only: nothing here was produced by running Ascentra, and
nothing here scores its live results (other agents do that).

## How to read this

- **Sources.** Every vendor fact carries the URL it came from. Unless a date is given, the page was **opened on 2026-10-17** during
  this pass (by this researcher or by the six research sub-agents working for it). Labels used:
  - **VC** = vendor claim, not independently verified.
  - **(S)** = seen only in a search-result snippet; the page itself could not be opened (403, JS-only or blocked).
  - **(3P)** = third-party source (review site, price tracker, competitor's review). Competitor reviews are named as such.
  - "not found" = searched for and not found; it does **not** mean the product lacks it.
- **moz.com and getstat.com refuse our crawler** ("domains not accessible to our user agent"). Every Moz fact below is (3P). Treat
  Moz as unverified until someone checks moz.com by hand.
- **Ascentra's column is "per docs/specs, not live-verified".** It is read from `CLAUDE.md`, `app/README.md`, `app/API.md`, the
  feature registry (`app/web/src/marketing/content/features.ts`), the changelog (`…/changelog.ts`), the security page
  (`app/web/src/marketing/pages/SecurityPage.tsx`), the pricing content (`…/content/pricing.ts`) and the `n8n/seo-agent/*_SPEC.md`
  files. The latest independent rating of the live system was **5.5 / 10** (2026-10-16, `../system-review-2026-10-15/SCORECARD.md`);
  a capability present in the docs is not evidence that it works.
- **The previous benchmark** (`../system-review-2026-10-14/BENCHMARKS_2026-10-14.md`, `BENCH_AREA1…11_*.md`, 2026-10-14/15) compared
  each area with that area's specialist (Sitebulb, AccuRanker, SEOTesting, Pitchbox, Clearscope…). This pass compares Ascentra with
  the **suites** an enterprise buyer shortlists. Specialist facts from the earlier pass are cited to those files and were not
  re-opened unless stated. §0 lists what changed since.

---

## 0. What changed since the 2026-10-14/15 benchmark

| Item | Earlier statement | Now (2026-10-17) | Source |
|---|---|---|---|
| Ahrefs Patches scope | titles and meta descriptions only; redirects, canonicals, robots, internal links "planned" (BENCH_AREA5) | titles, metas, canonicals, redirects, noindex/nofollow, alt text, internal links; AI drafts; publish / unpublish / rollback; JS snippet or Cloudflare Workers | https://ahrefs.com/patches |
| Ahrefs | no agent layer recorded | "Fix with Agent A" in Site Audit (2026-05-15); **Letaido** agent workspace (2026-08-12; Slack, Notion, HubSpot, WordPress, Linear) | https://ahrefs.com/blog/new-features/ ; https://siliconangle.com/2026/08/12/ahrefs-launches-ai-agent-workspace-letaido-marketers-agencies/ |
| Ahrefs Enterprise price | not recorded | **$1,499/month, annual commitment**, published | https://ahrefs.com/pricing |
| Semrush plans | Pro / Guru / Business $139.95 / $249.95 / $499.95 | restructured 29 Jun–6 Jul 2026: **SEO $139, Starter $199, Pro+ $299, Advanced "Request demo"**; a Free plan added late Sep 2026 | https://www.semrush.com/pricing/ ; https://pricingsaas.com/companies/semrush/diffs/2026W28 ; https://pricingsaas.com/companies/semrush/diffs/2026W40 |
| Semrush agency features | — | **Agency Growth Kit, Client Portal and CRM discontinued**; replaced by My Reports ($10 / $20 white-label per report) and Lead Generation ($90/mo) | https://www.semrush.com/kb/1546-agency-growth-kit-sunsetting |
| Semrush link building | Link Building Tool docs withdrawn (BENCH_AREA11) | tool page now **404**; new **AI PR Toolkit** (journalists, "AI-cited media", pitches sent from your authenticated domain) | https://www.semrush.com/features/link-building/ |
| Adobe LLM Optimizer | — | renamed/merged into **Adobe Brand Visibility** (announced 2026-06-17, GA 2026-08-03), sold jointly with Semrush Enterprise AIO | https://martech.org/adobe-brings-geo-to-cx-enterprise-with-adobe-brand-visibility/ ; https://partners.adobe.com/digitalexperience/activation/guide/semrush-faq |
| Profound | self-serve $99 / $399 gone (BENCH_AREA8) | confirmed: Trial + Enterprise only on the page; **$96M Series C at $1B (2026-02-24)**; **Dynamic Bot Rendering** at the CDN; **SCIM** (2026-08-21); Agents rebuilt around Aim (2026-10-16) | https://www.tryprofound.com/pricing ; https://www.fortune.com/2026/02/24/exclusive-as-ai-threatens-search-profound-raises-96-million-to-help-brands-stay-visible ; https://product.tryprofound.com/changelog |
| Surfer | AI Search Score (2026-10-01) | owned by **Positive Group** since 2025-10-28; **Backlink Marketplace** (paid placements beside AI-cited sources, 2026-01-21); **MCP GA** and **Agent Analytics** beta (2026-10-05) | https://positivegroup.com/news/positive-acquires-surfer ; https://surferseo.com/updates/ai-tracker-marketplace ; https://www.surferseo.com/updates/surfer-mcp-october2026/ |
| Scrunch | not covered | **acquired by Sitecore, June 2026**; AXP serves AI bots a restructured copy at the CDN | https://origin.scrunchai.com/about/ ; https://scrunch.com/platform/agent-experience/ |
| AgencyAnalytics (area-12 leader) | — | now **$20 per client per month** (annual), white-label portal, API, MCP for ChatGPT / Claude; AI Tracker add-on (beta) | https://www.agencyanalytics.com/pricing |
| BrightEdge | not covered | **Site Agents** (Autopilot renamed; internal links + schema change the site autonomously); **Agent Edge** (2026-08-26, Markdown to AI agents at the CDN, AWS Marketplace $10,000/month) | https://www.brightedge.com/site-agents-suite ; https://aws.amazon.com/marketplace/pp/prodview-i2ggufqfujws4 |
| Google Search Console | annotations + branded filter, UI only (BENCH_AREA7) | **"Search Generative AI performance reports"** (AI Overviews / AI Mode impressions) introduced June 2026; API availability not confirmed | https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports (title only; body not readable) ; details (3P): https://evolvagency.io/learn/google-search-console-generative-ai-performance-reports |
| Conductor | Monitoring (ex-ContentKing) | AgentStack (2026-04-20), MCP (2026-07-07), Content API (2026-07-29); **CEO change 2026-09-28** (single trade source) | https://www.conductor.com/docs/platform/release-notes/ ; https://www.martech360.com/news/cxo-moves/conductor-promotes-wei-zheng-to-ceo |

---

## 1. The leaders as of October 2026

**Search Atlas (LinkGraph).** An all-in-one suite built around **OTTO**, the most aggressive "it acts for you" product in the market.
OTTO changes titles, meta, headings, schema, canonicals, alt text, internal links, Open Graph and redirects through a JS pixel
(default), a Cloudflare worker, native CMS connectors (WordPress, HubSpot, Webflow, Shopify, Contentful, Duda) or Git pipelines; it
also writes and publishes content, posts to Google Business Profiles, replies to reviews, builds Google Ads campaigns and distributes
press releases (VC, https://searchatlas.com/otto-seo/). Its pages disagree on the default (autopilot with optional approval vs
"after your team approves", https://searchatlas.com/enterprise/). A competitor's test found **pixel fixes invisible to non-JS and AI
crawlers** (https://altheo.ai/reviews/searchatlas, competitor, Aug 2026). Link building runs through **WILDFIRE, a backlink-exchange
network** (https://help.searchatlas.com/en/articles/11726629-understanding-the-wildfire-link-building-system) — a scheme Google's
link-spam policy names. Data: 5.2B keywords (VC, https://searchatlas.com/keyword-research-tool/), "100T+ backlinks" on its own
comparison page only (VC, unconfirmed). LLM Visibility on 3–5 engines, 100–250 queries. Pricing $99 / $199 / $399 / from $999 a month
with a shared credit pool (https://searchatlas.com/pricing/); third parties report bills 3–4× list
(https://themarketingagency.ca/blog/search-atlas/, 3P). **No SOC 2, SSO, SLA or status page found.** No controlled study of OTTO's
effect exists.

**Ahrefs.** Bootstrapped, Singapore. Still the reference index: 28.7B keywords filtered from 110B, backlink data "updated every
15–30 minutes", 35T historical backlink records (VC, https://ahrefs.com/keywords-explorer, https://ahrefs.com/big-data). In 2026 it
began to **act**: Patches publishes on-page fixes through a JS snippet or Cloudflare Workers with rollback (https://ahrefs.com/patches);
Always-on Audit crawls continuously and auto-submits to IndexNow (https://ahrefs.com/blog/always-on-audit/); Agent A / Letaido run
recurring agent workflows (https://help.ahrefs.com/en/articles/15028902-about-agent-a). **Brand Radar** tracks AI Overviews, AI Mode,
ChatGPT, Perplexity, Gemini, Copilot, Grok and (custom prompts only) Claude, with a "481M+" monthly prompt index and 5–20 daily custom
prompts per plan (https://ahrefs.com/brand-radar). Bot Analytics reads AI-crawler logs via Cloudflare. Rank Tracker is **weekly by
default** (https://help.ahrefs.com/rank-tracker/faqs-and-troubleshooting/how-frequently-do-my-tracked-keywords-get-updated). No outreach
CRM, no white-label. Pricing: Starter $29, Lite $129, Standard $249, Advanced $449, **Enterprise $1,499/month annual**
(https://ahrefs.com/pricing). Security: SAML on Enterprise, SCIM through support, audit log on Enterprise; its FAQ says **SOC 2 "in
progress … not yet complete"** while the Enterprise page claims ISO 27001 (https://ahrefs.com/faq, https://ahrefs.com/enterprise).
No status page or SLA found.

**Semrush (an Adobe product line since 2026-04-28).** Adobe closed the acquisition on 2026-04-28 and placed Semrush inside "Adobe CX
Enterprise" (https://news.adobe.com/news/2026/04/adobe-completes-semrush-acquisition); the customer FAQ promises no immediate changes
(https://www.semrush.com/news/455963-faq-for-customers-adobe-acquires-semrush/). Self-serve is still sold on semrush.com, restructured
in mid-2026 (SEO $139, Starter $199, Pro+ $299, Advanced on demo; https://www.semrush.com/pricing/). Data: 28.7B keywords, 43T+
backlinks / 808M domains, a **317M-prompt AI database** captured "from real requests, not LLM APIs" across 117 regional databases
(VC, https://www.semrush.com/kb/1607-semrush-ai-visibility-data, https://www.semrush.com/features/backlink-analytics/). Strengths:
**Personal Keyword Difficulty**, daily Position Tracking with AI-prompt tracking, cannibalisation (Pro+), Enterprise log-file analysis
and AI-crawler profiles, an MCP server (https://developer.semrush.com/api/basics/semrush-mcp/). It mostly recommends; **acting is
delegated to Adobe Brand Visibility**, whose "Optimize at Edge" serves AI-agent-only changes from the CDN
(https://experienceleague.adobe.com/en/docs/llm-optimizer/using/resources/optimize-at-edge/overview). Security page: PCI DSS L1,
GDPR/CCPA, US data centres — **no public SOC 2 / ISO 27001 claim** (https://www.semrush.com/company/security/); SAML SSO
(https://www.semrush.com/kb/1609-saml-sso). No status page found.

**seoClarity.** Private, Chicago, "3,500+ brands" (VC). The broadest enterprise suite that also acts: unlimited dedicated crawler with
JS rendering, "tested on 48M+ pages" (https://www.seoclarity.net/technical-seo/); **ClarityAutomate** deploys titles, meta,
canonicals, hreflang, schema and internal links through a JS snippet with named approvers, plus an SEO split tester
(https://www.seoclarity.net/seo-automation/pricing); rank tracking in 190+ countries, ZIP/GPS, six engines
(https://www.seoclarity.net/seo-platform-essentials/). **ArcAI** (v3.0, 2026-04-01) tracks nine AI engines from 500 prompts up, with
sentiment, personas, an AI-accuracy check, shopping "share of shelf" and agentic content workflows
(https://www.seoclarity.net/resources/news/seoclarity-launches-arcai-3.0-to-reclaim-brand-narrative-in-ai-search). **LiveWire**
(2026-07-07) exposes everything through API + MCP + Looker/Sheets with "no per-query charges"
(https://www.seoclarity.net/resources/news/seoclarity-launches-livewire-seo-and-aeo-intelligence); BigQuery/Redshift/S3 extracts.
Backlinks are **Majestic's**, merged and re-crawled (S). SOC 2 Type 2, SAML SSO, role permissions, status page
(https://www.seoclarity.net/enterprise-security, https://status.seoclarity.net). Published prices are "representative as of October
11, 2022" ($2,500–$4,500/month, https://www.seoclarity.net/pricing); Vendr median $33,969/yr (https://vendr.com/marketplace/seoclarity).

**Conductor.** Enterprise AEO + SEO, mostly **reports and drafts**: its own FAQ says the Writing Assistant "doesn't publish content,
and it doesn't include built-in approval workflows" (https://www.conductor.com/docs/creator/writing-assistant-faqs.md). Leads on
**24/7 monitoring** (ex-ContentKing, auto IndexNow, CMS API re-crawl on publish; https://www.conductor.com/docs/monitoring/real-time-indexnow.md),
on **AI visibility with a published credit price per engine** (nine engines, ChatGPT 1.0 … AI Mode 0.1 credits, daily/weekly/monthly,
"official APIs" VC; https://www.conductor.com/docs/intelligence/ai-search-faqs.md) and on **contractual reliability**: a 99.5%
quarterly availability SLA with service credits (https://www.conductor.com/legal/service-level-agreement/) and a public status page.
Keyword discovery data is **sourced from Semrush**; it deliberately refuses to publish AI prompt volumes. No backlinks, no link
building, no white-label. SOC 2 Type II, ISO 27001, ISO 42001 (https://www.conductor.com/security/). Prices not published; Vendr median
≈ $49,020/yr (https://www.vendr.com/marketplace/conductor).

**BrightEdge.** Private, quote-only; Vendr median ≈ $50,000/yr (https://vendr.com/marketplace/brightedge). Its 2026 move is from
reporting to **acting**: **Site Agents** change internal links and JSON-LD autonomously ("Agent Mode") and a Publishing Agent pushes
title/meta/H1 into WordPress or Drupal after approval (https://www.brightedge.com/blog/autopilot-to-brightedge-site-agent);
**Agent Edge** serves verified AI agents a Markdown copy at the CDN while humans and Googlebot get the original
(https://www.brightedge.com/agent-edge), listed on AWS at $10,000/month with a 99.9% SLA
(https://aws.amazon.com/marketplace/pp/prodview-i2ggufqfujws4). AI Catalyst / AI Hyper Cube track ChatGPT, Perplexity, AIO, AI Mode and
Gemini with sentiment and personas (https://www.brightedge.com/ai-catalyst); an analyst notes BrightEdge "does not know the exact
prompts" (https://diginomica.com/brightedge-introduces-ai-hyper-cube-help-brands-understand-ai-search-heres-how-it-works). Daily rank
tracking in 68K local markets (2017 release). The strongest certification set found: SOC 2, ISO 27001, 27701, 42001
(https://www.brightedge.com/trust). Read-only MCP (https://www.brightedge.com/brightedge-mcp).

**Botify.** Enterprise technical SEO for very large sites; quote-only, Vendr median ≈ $74,200/yr (https://www.vendr.com/marketplace/botify).
Leads on **crawl + log analysis at scale** (SiteCrawler "no crawl budget limits", LogAnalyzer covering GPTBot, OAI-SearchBot,
ClaudeBot, Claude-SearchBot, Google-Agent; https://www.botify.com/platform/visibility/loganalyzer-feature) and on **deploying changes**:
PageWorkers (JS tag, and **at the edge** since July 2026), SpeedWorkers prerendering (Markdown to AI bots since March 2026), SmartIndex
(Bing/IndexNow push), SplitTesting with control groups (https://www.botify.com/platform/activation/pageworkers,
https://www.botify.com/product-releases/july-2026-release-highlights). AI Visibility (5 engines, scraped logged-out, weekly or daily) is
newer. No keyword database, no SERP rank tracker, no backlinks. SAML on Enterprise, **SCIM explicitly not supported**
(https://support.botify.com/en/articles/9108628-configuring-sso); public uptime 99.98% (https://status.botify.com/); SOC 2 type not
confirmed from Botify itself.

**Profound.** The best-funded AI-visibility specialist ($96M Series C at $1B, Feb 2026; >700 enterprise customers, VC). Nine to ten
engines scraped from consumer front-ends, **daily** (https://www.tryprofound.com/features/answer-engine-insights); **Prompt Volumes**
modelled from a licensed double-opt-in consumer panel (https://www.tryprofound.com/features/prompt-volumes); **Agent Analytics** from
CDN/server logs across nine providers (https://www.tryprofound.com/features/agent-analytics); **Aim** turns weekly opportunities into
Projects run by Agents that draft, refresh and **publish to the CMS after approval** (AEM, Contentful, Sanity, Webflow, WordPress…;
https://www.tryprofound.com/features/aim, https://www.tryprofound.com/integrations); **Dynamic Bot Rendering** serves rendered copies to
chosen AI bots via CloudFront/Cloudflare/Vercel (https://www.tryprofound.com/blog/introducing-dynamic-bot-rendering). No SERP tracking,
no backlinks. SOC 2 Type II, SAML/OIDC, **SCIM**, RBAC (https://www.tryprofound.com/enterprise). Its status page shows repeated
data-quality incidents in Sep–Oct 2026 (https://status.tryprofound.com/). No confidence intervals published.

**SE Ranking.** Mid-market suite that mostly reports: daily rank tracking on Google/Bing/Yahoo/YouTube to ZIP level with 35+ SERP
features and cannibalisation (https://seranking.com/rank-tracker.html); a SERP-overlap Keyword Grouper (S); 2.9T backlinks (VC,
https://seranking.com/backlink-checker.html); AI Search add-on and the separate **SE Visible** (5 engines, daily, 200–1,000 prompts,
$99–$355; https://visible.seranking.com); **Agency Pack** white-label portal from $69/month (https://seranking.com/agency-pack.html);
API on all plans and a remote MCP (https://seranking.com/api/integrations/mcp). Core $129 / Growth $279 (https://seranking.com/subscription.html).
Acquired Planable (Aug 2025). No SOC 2, SSO, SCIM or audit log found (https://trakkr.ai/reviews/seranking-review/enterprise-security, competitor).

**Moz (Ziff Davis) — (3P) only.** Weekly rank tracking and crawls, DA/PA/Spam Score; AI Visibility built up through 2026 (4 engines,
quotas reportedly tripled to 150/300/600 prompts on 2026-10-05; https://pricingsaas.com/companies/moz); **STAT** is the enterprise daily
tracker ("from $720/month for 6,000 keywords", https://www.rankability.com/blog/best-enterprise-rank-trackers/, competitor); Moz Local
syncs listings. Pricing Starter $49 … Large $299 (https://aionx.co/ai-comparisons/moz-pro-pricing-guide/). Not a leader in any area in
2026 except local listings.

**Surfer (Positive Group).** The content-scoring reference: Content Score split into SEO and **AI Search** halves, Auto-Optimize,
plagiarism checker, custom voice and knowledge (https://www.surferseo.com/updates/optimize-for-ai-answers-and-google-august2026/);
AI Tracker on 5 engines with "multiple queries per model per day" averaged (VC, https://surferseo.com/ai-tracker/); MCP GA
(2026-10-05). It tells users to verify facts themselves (https://surferseo.com/surfer-ai/). Sells paid placements beside AI-cited
sources (Backlink Marketplace) with no stated `rel="sponsored"` handling. $49–$299/month (https://surferseo.com/pricing/).

**2026 entrants that lead a capability.**
- **Evertune** — the only AI-visibility vendor publishing a sampling design: **100 samples per prompt per model**, claimed ±1 point
  overall (https://docs.evertune.ai/en/articles/16558380-what-makes-evertune-different); significance sold on the $800 tier
  (https://www.evertune.ai/pricing).
- **Peec AI** — value leader ($80–$420/month, 3P), daily UI scraping, API + MCP + Looker connector, "Actions" with approval
  (2026-10-13), fact-check against your facts (https://peec.ai/changelog, https://docs.peec.ai/).
- **Scrunch (Sitecore)** — AXP: a compressed, restructured page for AI retrieval bots at the CDN (Akamai, Cloudflare, Vercel);
  no content-parity check described (https://scrunch.com/platform/agent-experience/).
- **AthenaHQ** — 11 models on a $295 self-serve tier, Shopify publishing with revenue attribution, audit log and 2-hour SLA on
  Enterprise (https://www.athenahq.ai/pricing).
- **Alli AI** — portfolio-scale on-page deployment by snippet/plugin; pre-rendering for 50+ AI crawlers; $299–$599/month
  (https://www.alliai.com/pricing).
- Also: Bluefish ($43M Series B, 2026-04-14; tracks Amazon Rufus), Gauge (tracks which coding agents pick your product), Otterly and
  Writesonic GEO (low-cost trackers). Sources in the sub-agent notes; mostly (S).

**Area specialists from the previous pass (not re-opened, cited to those files).** Sitebulb 10 and Screaming Frog 24 (crawler + MCP
skills), **Lumar Protect** (CI checks that block a deploy), SEOTesting (time-based and split tests on GSC), AccuRanker (on-demand
ranks, SoV), Clearscope (content inventory and decay), **Pitchbox** (outreach CRM), Hunter (deliverability), **Markup AI** (ex-Acrolinx,
blocks content before publish), Originality.ai (fact checker), Keyword Insights (SERP clustering, top 7 / 40%), **AgencyAnalytics**
(client reporting; price re-verified above). See `../system-review-2026-10-14/BENCH_AREA*.md`.

---

## 2. Capability matrix

Legend: **✔** has it · **partial** has part of it · **✘** not found / not offered · **?** could not be determined. Ascentra's column is
**per docs/specs, not live-verified**. Abbreviations: SA = Search Atlas, sC = seoClarity, Cond = Conductor, BE = BrightEdge,
SER = SE Ranking, Asc = Ascentra. Sources for each cell are in §1 and §3; specific notes are in the cell.

### 2.1 Keywords

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Own keyword database | ✔ 5.2B VC | ✔ 28.7B / 110B | ✔ 28.7B VC | ✔ 30B+ VC | partial (Semrush-sourced) | ✔ size unpublished | ✘ GSC only | ✘ | ✔ "billions", 188 DBs | partial — resells DataForSEO, no own DB |
| 2 | Generic keyword difficulty | ✔ | ✔ backlinks only | ✔ | ✔ | ✘ paid "competition" only | partial (3P) | ✘ | ✘ | ✔ | ✔ |
| 3 | Difficulty personalised to your domain | ✘ | ✘ by design | ✔ PKD | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ "difficulty for your site" |
| 4 | Intent labels | ✔ | ✔ | ✔ | ✔ | ✔ | partial | ✘ | ✔ prompts | ✔ | ✔ |
| 5 | AI prompt volumes | ✘ | ✔ Brand Radar, AI-adjusted volume | ✔ 317M-prompt DB | ✔ Prompt Researcher | ✘ refuses on principle | partial | ✘ | ✔ licensed panel | ✘ | partial — DataForSEO LLM Mentions (ChatGPT data US-English only) |
| 6 | Verdict per keyword with reasons and a plan type | ✘ | ✘ | partial (PKD bands) | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ Direct / Short / Full |
| 7 | Discovery seeded from your own GSC queries | ? | partial | ? | ✔ | ✔ | ✔ | ✔ RealKeywords | ✔ (GSC in Pages) | ? | ✔ |
| 8 | Click-loss-adjusted traffic model (AIO) | ? | ✔ adaptive traffic model | ? | ? | ✘ | ? | ✘ | ✘ | ? | partial (Dec 2025 AIO CTR loss applied) |

### 2.2 Keyword ladders / topic clusters

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 9 | Clustering by shared SERP URLs (method stated) | ? | partial (Parent Topic) | partial (method not found) | ✔ intent + SERP | partial (semantic) | ✘ | ✘ | ✘ | ✔ 1–9 shared top-10 | ✔ top 7 at 40% |
| 10 | Pillar / hub planning | ✔ topical maps | ✘ | ✔ Strategy Builder | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ ladders, hub pages |
| 11 | Topical authority / reach measure | partial | ✘ | ✔ Topical Authority | partial | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ topic radius |
| 12 | Sequenced climb to a hard keyword (rungs, pacing, rank-gated) | partial | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ |
| 13 | Several concurrent plans with overlap / pile-up guards | ? | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ max active, pile-up limit |

### 2.3 Content writing + QA

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 14 | AI long-form writer | ✔ Content Genius | partial (Content Helper; 1 doc/mo) | ✔ Content Toolkit | ✔ Content Fusion | ✔ | ✔ Content Advisor | partial (titles/meta, FAQ) | ✔ Agents | ✔ | ✔ writer + critic + editor |
| 15 | Content score against ranking pages | ✔ | ✔ topic coverage | ✔ | ✔ | ✔ beta | partial (brief check) | ✘ | partial (AEO score) | ✔ | partial (coverage target, readability vs ranking pages) |
| 16 | Brand voice / style guide | ? | ✔ Brand Kits | ✔ | ✔ Content Profiles | ✔ | partial (off-brand tone) | partial | ✔ Context Manager | ✘ 6 presets | ✔ style guide |
| 17 | Grounding in the customer's own facts | ? | ✘ | ✘ | ? | ✔ Knowledge Sources | ✘ | ✘ | ✔ | ✘ | ✔ business profile, case studies |
| 18 | Fact check of its own drafts against cited sources | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ "pair with human fact checking" | ✔ claims + figures vs source |
| 19 | Originality / plagiarism check | ✘ | ✘ | partial (SWA via Copyleaks) | partial | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ |
| 20 | Automated block-before-publish gate | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | partial (bot-delivery QC) | ✘ (human approval only) | ✘ | ✔ not-ready drafts held |
| 21 | E-E-A-T scaffolding (author, reviewer, schema) | ? | ? | ? | ? | ? | ? | ✘ | ? | ✘ | ✔ |
| 22 | Multi-language writing | ? | ? | ? | ✔ 16+ | ? | ? | ✔ 40+ (titles/meta) | ? | ✘ English only | partial (language param; not documented as a feature) |

### 2.4 Content cadence / automation

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 23 | Recurring content production without a prompt | ✔ OTTO | ✘ | ✘ | ✘ | ✘ | ✘ | partial (scheduled PageWorkers) | ✔ Aim weekly | ✘ | ✔ weekly cadence |
| 24 | Publishes to the CMS | ✔ 10+ CMSs | partial (Letaido WP connector) | ✔ WordPress | ✘ | ✘ by design | partial (title/meta/H1) | ✘ | ✔ 10 CMSs, after approval | partial (WP, S) | partial — WordPress draft sub-workflow, inactive; otherwise a package |
| 25 | Content decay detection → refresh | ✔ | ✘ ("Soon") | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ Citation Decay | ✘ | ✔ Poisson test, refresh first |
| 26 | Autonomy levels / approval per action | ✔ | ? | ✘ | ✔ named approvers | ✘ | ✔ Suggest / Approve / Agent | ✔ owner launches | ✔ | ✘ | ✔ Auto / Manual per ladder |
| 27 | Natural-language agent layer | ✔ Atlas Agent | ✔ Agent A / Letaido | partial (MCP connectors) | ✔ agentic workflows | ✔ AgentStack | ✔ Site Agents | ✔ Assist | ✔ Aim | partial (n8n / Make) | ✘ fixed workflows |

### 2.5 Technical audit

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 28 | Crawl size per audit | ✔ ≤1M VC | ✔ credit-based | ✔ 20k–100k; Ent. millions | ✔ unlimited | ✔ any size (Ent.) | ✔ (2017 claim) | ✔ millions | ✘ per-URL only | ✔ ≤1M/project | partial — 200 / 500 / 1,000 pages |
| 29 | JavaScript rendering | ✘ (help FAQ, S) | ✔ | ✔ | ✔ | ✔ add-on | ✔ | ✔ | partial (Bot View) | ✔ | ✔ ≤500 pages |
| 30 | Always-on / continuous monitoring | ✘ weekly | ✔ Always-on Audit | partial (daily) | partial | ✔ 24/7 | ? | ✔ AlertPanel | ✘ | partial | partial — daily key-page watch + monthly audit |
| 31 | Pre-JS vs rendered comparison | ✘ | partial (JS-dependent content issue) | ? | ? | partial | ? | ? | ✔ Bot View | ✘ | ✔ ≤25 pages |
| 32 | Fix list ranked by business impact | ? | partial | ? | ? | ✔ | ? | partial | ✘ | ✘ | ✔ traffic / GA4 key events at risk |
| 33 | Deploys fixes (JS / edge / CMS) | ✔ OTTO | ✔ Patches | partial (via Adobe) | ✔ ClarityAutomate | ✘ | ✔ Site Agents | ✔ PageWorkers | ✔ Pages agent | ✘ | ✘ fix pack files only |
| 34 | Server-side / edge deploy visible to non-JS crawlers | partial (Cloudflare / WP plugin) | ✔ Cloudflare Workers | ✘ | ? | ✘ | partial | ✔ PageWorkers at Edge (beta) | partial (bots only) | ✘ | ✘ |
| 35 | Pre-release / CI check | ✘ | ✘ | ✘ | ✘ (QA env, S) | partial (CMS API re-crawl) | ✘ | ✘ | ✘ | ✘ | ✔ pass/fail + threshold |
| 36 | Server-log analysis (search + AI bots) | ✘ | ✔ Bot Analytics | ✔ Enterprise | ✔ Bot Clarity | ✔ CDN logs | ✔ Agent Insights | ✔ LogAnalyzer | ✔ Agent Analytics | ✘ | ✘ robots.txt / CDN block test only |
| 37 | GSC URL Inspection inside the audit | ? | ? | ? | ? | ? | ? | ? | ✘ | ? | ✔ |
| 38 | IndexNow / Bing submission | ✔ | ✔ | ? | ✔ AI Indexer | ✔ | ? | ✔ SmartIndex | ✔ | ✘ | ✔ |

### 2.6 Rank tracking

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 39 | Frequency | ✔ daily VC | partial — weekly; daily paid | ✔ daily | ✔ weekly / daily | ✔ weekly / daily | ✔ daily | ✘ GSC only | ✘ | ✔ daily | partial — weekly |
| 40 | City / ZIP / GPS locations | ✔ heatmaps | ✔ ZIP | ✔ ZIP | ✔ ZIP / GPS | ✔ 2,700+ | ✔ 68K markets | ✘ | ✘ | ✔ ZIP | partial — country |
| 41 | Mobile and desktop | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ | ✔ | partial — mobile for ≤2 main keywords per ladder |
| 42 | Engines beyond Google | ? | ? | ✘ | ✔ 6 engines | ✔ add-on | ✔ | ✘ | ✘ | ✔ 4 | ✘ |
| 43 | SERP features incl. AI Overviews | ✔ (S) | ✔ 19 | ✔ | ✔ | ✔ | ✔ 28 | ✘ | ✘ | ✔ 35+ | ✔ |
| 44 | Cannibalisation | ? | ✔ | ✔ Pro+ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ |
| 45 | Share of voice | ? | ✔ | ✔ Advanced | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ | ✔ impression-weighted |
| 46 | Own move vs SERP-wide churn; tested alerts | ✘ | ✘ | partial (Sensor) | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ |
| 47 | Tracked keywords per plan | 2k–50k | 750+ | 500–5,000+ | 2,000+ min | 500–60,000+ | ? | — | — | 2k–5k | partial — ladder rungs + 10 live checks/week for the own list |

### 2.7 Site tracking (Search Console / GA4)

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 48 | Search Console | ✔ | ✔ | ✔ | ✔ 16 mo | ✔ daily | ✔ | ✔ bulk export | ✔ | ✔ | ✔ |
| 49 | GA4 | ✔ | partial (import) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| 50 | Adobe Analytics | ✘ | ✘ | ✔ Ent. | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ |
| 51 | Chart annotations | ? | ✘ | ? | ✘ | ✔ | ✔ | ✔ | ✔ | ? | ✔ incl. Google updates |
| 52 | SEO split tests with control groups | ✘ | ✘ | partial (Ent. claim) | ✔ | ✘ | ✘ | ✔ | ✘ | ✘ | partial — after-publish comparison vs rest of site |
| 53 | Discover / News, content groups, brand split | ? | ? | ? | ? | ? | ? | ? | ? | ? | ✔ |
| 54 | Looker Studio connector | ✘ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | partial | ✔ | ✘ |
| 55 | Warehouse export (BigQuery / Snowflake / S3) | ✘ | ✘ | ✘ | ✔ | ✘ (API) | partial | partial | ✘ | ✘ | ✘ |

### 2.8 AI visibility

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 56 | Engines tracked | 3–5 | 8 (Claude custom only) | 4 self-serve; up to 9 Ent. | 9 | 9 | 5+ | 5 | 9–10 | 5 | 7 (ChatGPT, Perplexity, Gemini, Claude, AI Mode, AIO, Copilot opt-in) |
| 57 | Prompt panel size | 100–250 | 5–20 daily (Ent. 83+) | 50–100; "unlimited" Adv. | from 500 | ≤100 per topic, credits | not published | answer budget, ≤10 topics | custom (Ent.) | 100–1,000 | 3–50 |
| 58 | Daily measurement | ? | ✔ custom prompts | ✔ | ✔ option | ✔ | ? | ✔ since Sep 2026 | ✔ | ✔ | partial — daily pulse on 3 engines, weekly / monthly for the rest |
| 59 | Market-wide prompt database | ✘ | ✔ 481M+ | ✔ 317M | partial | ✘ | partial | ✘ | ✔ | partial | partial — DataForSEO LLM Mentions |
| 60 | Citations / cited URLs | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| 61 | Sentiment | ✔ | ✘ not found | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | partial (coming soon) | ✔ Answer Analyst |
| 62 | Confidence intervals / significance tests | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ Wilson ranges, z-tests, Holm |
| 63 | Wrong-claim detection vs the brand's facts | ✘ | ✘ | partial (Adobe "Brand Claims" soon) | ✔ ArcAI Accuracy | ✘ | partial | ✘ | ✔ FactCheck | partial | ✔ |
| 64 | AI referral traffic / revenue from analytics | ? | partial | ? | ? | ✔ (Adobe) | ? | ? | ✔ | ✘ | ✔ GA4 visits, key events, revenue |
| 65 | Personas / multi-region panels | ✘ | ? | ✔ personas | ✔ | ✔ | ✔ | ✘ | ✔ | partial (7 countries) | partial — country only |
| 66 | Query fan-out | ✘ | ✔ | ✔ | ? | ✔ | ? | ✔ | ? | partial | partial — ChatGPT searches read |
| 67 | AI shopping / product cards | ✘ | ✘ | ✔ | ✔ | ✘ | ✘ | ✔ | ✔ | ✘ | ✘ |

### 2.9 AI growth (getting cited)

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 68 | Ranked action list from AI data | ✔ | partial | ✔ AI Insights | ✔ Insights | ✔ beta | ✔ | partial | ✔ Aim | partial | ✔ |
| 69 | Writes AI-answer / refresh pages | ✔ | ✘ | partial | ✔ | ✔ drafts | ✔ drafts | partial | ✔ | ✘ | ✔ via the cadence |
| 70 | AI-readiness check of key pages | ? | ✔ AI Discoverability | ✔ AI-ready audit | ? | ✔ technical AEO | ? | partial | ✔ AEO score | ✘ | ✔ as the AI fetchers see them |
| 71 | Serves an AI-only version at the CDN | ✘ | ✘ | partial (Adobe Optimize at Edge) | partial (Bot Optimizer) | ✘ | ✔ Agent Edge | ✔ SpeedWorkers Markdown | ✔ Dynamic Bot Rendering | ✘ | ✘ |
| 72 | Earned-media targets (pages AI cites without you) | ✔ QUEST | partial (found-not-cited) | ✔ AI PR Toolkit | ✔ Pulse | partial | ✔ named publications | ✘ | ✔ | ✔ "No cited" | ✔ exact pages + drafts |
| 73 | Correction drafts for wrong AI claims | ✘ | ✘ | ✘ | ✔ narrative control | ✘ | partial | ✘ | partial | ✘ | ✔ |
| 74 | Entity / Wikidata | ? | partial (entity matching) | ? | ? | ? | ? | ✘ | ? | ✘ | ✔ monthly Wikidata check |

### 2.10 Backlink monitoring

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 75 | Own backlink index | ✔ "100T+" VC, unconfirmed | ✔ 15–30 min freshness | ✔ 43T VC | ✘ Majestic | ✘ | ✘ Majestic | ✘ | ✘ | ✔ 2.9T VC | ✘ DataForSEO (1.98T live, VC) + free sources |
| 76 | New / lost with reasons | ? | ✔ 8 reasons | ✔ | ✔ | ✘ | partial | ✘ | ✘ | ✔ | ✔ lost = two misses + reason |
| 77 | Own live re-check of every link | ? | ✘ | ✘ | ✔ re-crawl | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ |
| 78 | Merge of several sources (GSC links, Bing, other tools) | ✘ | ✘ | ✘ | ✔ multi-provider | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ 9 sources incl. Common Crawl |
| 79 | Spam / toxicity labelling | ✔ | ✘ not found | ✔ 45+ markers | ? | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ link-farm footprints |
| 80 | Competitor link gap | ? | ✔ Link Intersect | ✔ Backlink Gap | ✔ | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ |

### 2.11 Link building

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 81 | Prospecting | ✔ | ✔ research only | ✔ | ✘ internal links only | ✘ | partial | ✘ | partial (Aim task) | ? | ✔ qualified, scored |
| 82 | Contact discovery | ? | ✘ | ✔ journalists | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ on the prospect's own domain |
| 83 | Outreach sent from the customer's mailbox, sequences | partial (HARO drafts, S) | ✘ | ✔ AI PR Toolkit | ✘ | ✘ | ✘ | ✘ | partial | ✘ | ✔ per docs; **no live send yet** (G16) |
| 84 | Reply handling / CRM | ? | ✘ | partial (coverage tracking) | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ Reply Reader |
| 85 | Link exchange or paid-placement network | ✔ WILDFIRE (policy risk) | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ by design |
| 86 | Press-release distribution | ✔ $25–50/release | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| 87 | Local listings / GBP management | ✔ GBP Galactic | ✔ GBP review replies | ✔ Local add-on | ? | ✘ | partial | ✘ | ✘ | ✔ | partial — listings checklist, GBP lookup |

### 2.12 Reporting & app

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 88 | Scheduled report delivery | ✔ Slack / Teams / ClickUp | ✔ PDF e-mail | ✔ My Reports | ✔ | partial (alerts) | ✔ StoryBuilder | ✔ | ✔ Slack / Teams | ✔ | ✔ e-mail + signed webhook |
| 89 | White-label client portal | ✔ Agency | ✘ | partial (white-label PDF; portal discontinued) | partial (add-on, 3P) | ✘ | ✘ | ✘ | ✘ | ✔ Agency Pack | partial — own logo on share page |
| 90 | Public API | partial (enterprise quote) | ✔ | ✔ units | ✔ no per-query fee | ✔ 3 APIs | ✔ | ✔ REST + BQL | ✔ | ✔ | partial — read-only v1 |
| 91 | MCP server | partial (experimental) | ✔ | ✔ | ✔ 2 | ✔ | ✔ read-only | ✔ | ✔ | ✔ | ✔ read-only + publish check |
| 92 | Slack / Teams native app | ✔ | partial (Letaido) | ✘ | ? | ✔ | ✔ | ✔ | ✔ | ✘ | partial (webhook renders in Slack / Teams) |
| 93 | Jira / Asana / Linear | ✔ ClickUp | ✔ via Letaido | partial (Trello) | ✔ | ✘ | ✘ | ✔ | ? | ✘ | ✘ |
| 94 | Multi-client workspaces | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ Agency mode | ✔ | ✔ multi-company |
| 95 | Unfinished / failed results held back from delivery | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ |

### 2.13 Cost control & reliability

| # | Capability | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | Asc (docs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 96 | Usage metering the customer can read | partial (per-action cost unpublished) | ✔ units, caps per MCP key | ✔ units | partial | ✔ credit price per engine | ✘ | ✔ agent credits | partial | ✔ | ✔ dollars per run |
| 97 | Cost forecast before work + per-tenant caps | ✘ | partial | ✘ | ✘ | ✔ forecast + burn-down | ✘ | partial (allowances) | ✘ | ✘ | ✔ estimate + budget lock + platform cap |
| 98 | Public status page | ✘ | ✘ | ✘ | ✔ | ✔ | ✘ | ✔ 99.98% | ✔ | ✔ | ✘ |
| 99 | Contractual uptime SLA | ✘ | ✘ | partial (unspecified) | partial (no figure) | ✔ 99.5% | ✔ 99.9% (Agent Edge) | ✘ | partial (support SLA) | ✘ | ✘ |
| 100 | Always-on production hosting | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ local Docker on a laptop; schedules have missed fires (R94, D25a) |

---

## 3. Who leads each area in October 2026, and why

1. **Keywords — Semrush, with Ahrefs on value.** Semrush is the only suite with difficulty **personalised to the domain** (PKD:
   https://www.semrush.com/kb/1434-how-is-personal-keyword-difficulty-calculated, S) on a 28.7B database, plus a 317M-prompt AI
   database (https://www.semrush.com/kb/1607-semrush-ai-visibility-data). Ahrefs leads on what a keyword is worth (Traffic Potential,
   Parent Topic, an adaptive traffic model with CTR weights for 15 SERP features; https://ahrefs.com/blog/new-features-july-august-2026/).
   For AI prompt volumes Profound's licensed-panel method is the most defensible description (https://www.tryprofound.com/features/prompt-volumes).
2. **Topic clusters — Semrush for planning; SE Ranking / Keyword Insights for a published method.** Semrush Keyword Strategy Builder
   plans Topics → Pillar → Subpages with Topical Authority. SE Ranking's grouper states its method (shared top-10 URLs, 1–9, soft/hard; S).
   Surfer's rebuilt Topical Map (closed beta 2026-10-05) plans by intent and business context
   (https://www.surferseo.com/updates/topical-map-october2026/). Nobody sequences a climb to one hard keyword the way Ascentra's ladders do.
3. **Content writing + QA — Surfer for scoring; Conductor for governed drafting; nobody gates on facts.** Surfer splits SEO and AI-search
   scoring and adds a plagiarism check; Conductor grounds drafts in the customer's Knowledge Sources and Content Profiles
   (https://www.conductor.com/docs/creator/writing-assistant.md). **No suite in this set refuses a draft for unverified facts**; Markup AI
   blocks for brand/quality and Originality.ai checks facts, both outside the suites (BENCH_AREA3).
4. **Cadence / automation — Profound (Aim) and Search Atlas (OTTO).** Profound turns weekly opportunities into agent projects that draft,
   refresh and publish to ten CMSs after approval, and measures citation decay. OTTO publishes content and changes on autopilot. Both act
   where Ascentra hands over a package.
5. **Technical audit — Botify at enterprise scale; Ahrefs mid-market; Conductor for monitoring; Lumar for CI.** Botify combines unlimited
   JS crawling, log analysis for search and AI bots, and fixes deployed at the edge (PageWorkers at Edge, July 2026). Ahrefs pairs
   Always-on Audit with Patches via Cloudflare Workers. Conductor watches 24/7 with 60 months of change history (VC). Lumar Protect blocks a
   deploy on technical tests (BENCH_AREA5).
6. **Rank tracking — Semrush self-serve; seoClarity / BrightEdge enterprise.** Semrush: daily, ZIP, devices, cannibalisation, AI-prompt
   tracking in the same tool (https://www.semrush.com/features/position-tracking/). seoClarity: 190+ countries, ZIP/GPS, six engines, top
   100 (https://www.seoclarity.net/seo-platform-essentials/). BrightEdge: daily in 68K local markets.
7. **Site tracking — Botify / seoClarity for testing, Conductor for breadth.** Botify ingests GSC Bulk Data Export and runs control-group
   split tests; seoClarity's split tester reports significance (S). Conductor joins GSC daily, GA4 and Adobe Analytics with annotations.
   SEOTesting remains the specialist (BENCH_AREA7).
8. **AI visibility — Profound for coverage and depth; Evertune for statistics.** Profound: up to ten engines daily, prompt volumes, server-log
   agent analytics, shopping. Evertune: 100 samples per prompt per model and published margins of error. Ahrefs Brand Radar leads on a
   market-wide index (481M+ prompts). Conductor leads on cost transparency per engine.
9. **AI growth — Profound, BrightEdge, Botify, Scrunch, Adobe.** The 2026 change is **acting at the CDN**: BrightEdge Agent Edge, Botify
   SpeedWorkers Markdown, Profound Dynamic Bot Rendering, Scrunch AXP and Adobe Optimize at Edge all serve AI agents a different page from
   the one humans see. Only Adobe states it adds no factual content; none of the pages read addresses Google's cloaking policy. Profound
   Aim also drafts publisher pitches.
10. **Backlink monitoring — Ahrefs (index), Semrush (toxicity), seoClarity (verification model).** Ahrefs' freshness and its eight "lost"
    reasons; Semrush's 45+ toxic markers shown per link (BENCH_AREA10); seoClarity merges several providers and re-crawls every link (S) —
    the same model as Ascentra's ledger.
11. **Link building — no suite leads; Pitchbox does.** Among the ten, only Semrush's AI PR Toolkit sends pitches from the customer's domain,
    and Search Atlas "acts" through an exchange network. Pitchbox ($300–$1,200/month) remains the outreach CRM reference (BENCH_AREA11).
12. **Reporting & app — AgencyAnalytics for client reporting; seoClarity and Conductor for data access.** AgencyAnalytics: white-label
    portal, 85+ integrations, MCP, $20/client/month (https://www.agencyanalytics.com/pricing). seoClarity LiveWire: API + MCP + Looker +
    Sheets, no per-query fees, BigQuery/Redshift/S3 extracts. Search Atlas and SE Ranking lead among the suites on white-label portals.
13. **Cost control & reliability — Conductor.** Published credit price per engine, a forecast at set-up and a burn-down per account, a 99.5%
    quarterly SLA with service credits and a termination right below 95%, a public status page, RTO 24 h / RPO < 1 h
    (https://www.conductor.com/legal/service-level-agreement/, https://www.conductor.com/security/). Botify publishes 99.98% measured uptime.

---

## 4. Enterprise-grade requirements checklist

Ascentra's column is **per docs / code, not live-verified**. "✘" for a vendor means not found on public pages.

| Requirement | SA | Ahrefs | Semrush | sC | Cond | BE | Botify | Profound | SER | **Ascentra** |
|---|---|---|---|---|---|---|---|---|---|---|
| **Security & compliance** | | | | | | | | | | |
| SOC 2 Type II | ✘ | ✘ "in progress" | ✘ no public claim | ✔ Type 2 | ✔ | ✔ type unstated | partial (Type 1, 2021, S) | ✔ | ✘ | ✘ |
| ISO 27001 | ✘ | ✔ claim (conflicting) | ✘ | ✘ | ✔ | ✔ (+27701, 42001) | ? | ✘ | ✘ | ✘ |
| Penetration test / bug bounty | ? | ? | ✔ HackerOne | ? | ✔ annual | ✔ annual | ? | partial (vuln. reporting) | ? | ✘ |
| DPA / GDPR terms | ✔ | ✔ pre-signed SCCs | ✔ | ✔ | ✔ | ✔ DPF | ✔ | ? | ✔ | ✘ legal texts marked draft |
| No training on customer data (stated) | ? | ✔ Enterprise opt-out | ? | ✔ | ? | ? | ? | ? | ✔ | ✘ not stated |
| **Identity & governance** | | | | | | | | | | |
| SAML / OIDC SSO | ✘ | ✔ Enterprise | ✔ | ✔ | ✔ | ✔ | ✔ Enterprise | ✔ | ✘ | ✘ Google OAuth only |
| SCIM provisioning | ✘ | partial (via support) | ✘ | ✘ | ✘ (JIT) | ✘ | ✘ explicitly | ✔ | ✘ | ✘ |
| MFA / 2FA | ? | ✔ | ? | ? | ✔ admins | ✔ lockout policy | ? | ? | ? | ✘ not found |
| Roles / permissions | ? | ✔ | ✔ Enterprise | ✔ | ✔ custom RBAC (Ent.) | partial | ✔ | ✔ fine-grained | ✔ per project / feature | partial — 4 fixed roles per company |
| Customer-visible audit log | partial (7-day OTTO webhook log) | ✔ Enterprise | ✘ | ✔ (ArcAI API page) | ✘ internal only | partial (3P) | partial (MCP 31 days) | partial (activity logs) | ✘ | ✘ (API-key last use, delivery log only) |
| Tenant data isolation stated | ? | ? | ? | ✔ | ? | ? | ? | ? | ? | ✔ per company, ownership-verified domains |
| **Scale** | | | | | | | | | | |
| Crawl of large sites | ✔ ≤1M | ✔ | ✔ millions (Ent.) | ✔ 48M+ | ✔ | ✔ | ✔ | ✘ | ✔ ≤1M | ✘ ≤1,000 pages |
| Tracked keywords at enterprise volume | ✔ 50k | ✔ | ✔ 5,000+ | ✔ | ✔ 60k+ | ✔ | — | — | ✔ | ✘ |
| Own data indexes (keywords, links, prompts) | ✔ | ✔ | ✔ | partial (keywords) | ✘ | partial | ✘ | ✔ prompts | ✔ | ✘ resells DataForSEO |
| **Integrations** | | | | | | | | | | |
| GSC + GA4 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Adobe Analytics / AEM | ✘ | ✘ | ✔ | ✔ | ✔ AEM | ✔ | ✔ | ✔ AEM | ✘ | ✘ |
| Looker Studio | ✘ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | partial | ✔ | ✘ |
| BigQuery / Snowflake / S3 | ✘ | ✘ | ✘ | ✔ | ✘ | partial | partial | ✘ | ✘ | ✘ |
| CMS publishing | ✔ 10+ | partial | ✔ WP | ✘ | ✘ | partial | ✘ | ✔ 10 | partial | partial (WordPress draft, inactive) |
| CDN / edge (deploy or logs) | ✔ Cloudflare | ✔ Cloudflare, Vercel, Fastly, CloudFront | partial (Adobe) | ? | ✔ logs | ✔ CloudFront | ✔ 10 log sources, edge deploy | ✔ 9 providers | ✘ | ✘ |
| Slack / Teams | ✔ | partial | ✘ | ? | ✔ | ✔ | ✔ | ✔ | ✘ | partial (webhook) |
| Jira / Asana / Linear | ✔ ClickUp | ✔ Linear | partial | ✔ | ✘ | ✘ | ✔ | ? | ✘ | ✘ |
| API + MCP | partial | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | partial (read-only) |
| **Support & SLA** | | | | | | | | | | |
| Uptime SLA | ✘ | ✘ | partial | partial | ✔ 99.5% | ✔ 99.9% | ✘ | ✘ | ✘ | ✘ |
| Public status page | ✘ | ✘ | ✘ | ✔ | ✔ | ✘ | ✔ | ✔ | ✔ | ✘ |
| Named CSM / account manager | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ? | ✘ (done-for-you packages are placeholders) |
| Disaster recovery stated (RTO / RPO, backups) | ? | ? | ? | ? | ✔ 24 h / <1 h | ? | ? | partial (daily backups, 7 days) | ? | ✘ |
| **Data** | | | | | | | | | | |
| Data residency choice | ✘ | ✘ US | ✘ US | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ (no hosting yet) |
| Bulk export of own data | ? | ✔ | ✔ | ✔ | ✔ API | ✔ | ✔ | ✔ | ✔ | partial (read API, files) |

**Where Ascentra stands on enterprise readiness (per its docs).** The application layer is careful — argon2id, CSRF, strict CSP,
hashed sessions and tokens, ownership verification, per-company isolation, budget locks, read-only scoped API keys
(`app/web/src/marketing/pages/SecurityPage.tsx`, `app/API.md`). What an enterprise procurement checklist asks first is absent: **SAML
SSO, SCIM, MFA, a customer audit log, SOC 2 / ISO 27001, a DPA, an SLA, a status page, a production host, backups/DR**. Its own
security contact is a placeholder (`security@ascentra.example`, `content/site.ts`), and prices and plan limits are marked PLACEHOLDER
(`content/pricing.ts`). Today Ascentra would fail a typical enterprise security questionnaire at the first section regardless of
feature depth; it is positioned, in practice, for SMB and agency buyers.

---

## 5. What Ascentra is missing — ranked

Ranked by how often the gap would stop an enterprise purchase, then by effect on results. Size: S < 1 week, M 1–4 weeks, L 1–3 months,
XL > 3 months or an organisational programme. "Money/data" = depends on spend or on data Ascentra does not own.

| Rank | Gap | What the leader does (source) | Why enterprise buyers care | Size | Money / data |
|---|---|---|---|---|---|
| 1 | **No production hosting, no reliability contract** | Conductor: 99.5% quarterly SLA with credits, status page, RTO 24 h / RPO < 1 h (https://www.conductor.com/legal/service-level-agreement/); Botify 99.98% public uptime (https://status.botify.com/) | Ascentra runs on Docker on a laptop; the weekly loop has missed scheduled fires (R94) and an always-on host is still an owner item (D25a). A buyer cannot rely on "every Monday" without it | M (host + backups + monitoring), L (HA, status page, SLA) | Money: modest (hosting), but an SLA needs on-call people |
| 2 | **Enterprise identity & compliance** — SAML SSO, SCIM, MFA, customer audit log, SOC 2 Type II / ISO 27001, DPA | Profound: SOC 2 Type II, SAML/OIDC, SCIM, RBAC (https://www.tryprofound.com/enterprise); Conductor and BrightEdge: SOC 2 + ISO 27001 + ISO 42001 (https://www.conductor.com/security/, https://www.brightedge.com/trust) | Procurement gate: without SSO and an attestation the vendor is not shortlisted | SSO / MFA / audit log: M; SCIM: S–M; SOC 2 Type II: XL (6–12 months observation) | Money: auditor and tooling; legal review for DPA |
| 3 | **Does not act on the site** — no fix deployment (JS, edge or CMS) | Ahrefs Patches via Cloudflare Workers with rollback (https://ahrefs.com/patches); Botify PageWorkers at Edge (https://www.botify.com/product-releases/july-2026-release-highlights); BrightEdge Site Agents; seoClarity ClarityAutomate; Search Atlas OTTO | Enterprise SEO teams' bottleneck is developer time; the 2026 leaders sell "fixed", Ascentra sells a fix pack | L (edge worker + rollback + approval + verification) | No; needs customer CDN access |
| 4 | **No CMS publishing** | Profound Agents publish to AEM, Contentful, Sanity, Webflow, WordPress after approval (https://www.tryprofound.com/integrations); Search Atlas 10+ CMSs; Semrush WordPress | The weekly cadence produces pages that sit unpublished (the pile-up guard has paused the cadence on that); enterprises run AEM / Contentful, not WordPress | M per CMS (WordPress first, then Contentful / AEM) | No |
| 5 | **Crawl scale and continuous monitoring** — 1,000-page cap, monthly audits | Botify / seoClarity unlimited crawls (48M+ pages tested, VC); Ahrefs Always-on Audit; Conductor 24/7 (https://www.conductor.com/docs/monitoring/monitoring-faqs.md) | Enterprise sites have 10⁵–10⁷ URLs; a 1,000-page sample cannot audit templates, faceted navigation or international sections | L (own crawler or larger provider crawls; incremental monitoring) | Money: crawl cost scales with pages if bought from DataForSEO |
| 6 | **No server-log / AI-crawler analytics** | Botify LogAnalyzer, Profound Agent Analytics (9 CDN/log sources), Ahrefs Bot Analytics (Cloudflare), Conductor CDN logs, Semrush Enterprise logs | The only ground truth on what Googlebot and AI fetchers actually request; every enterprise suite now has it | M (Cloudflare Logpush / S3 ingest + bot verification by IP ranges) | No (customer provides logs); storage cost |
| 7 | **Rank-tracking depth** — weekly, Google only, country level, mobile for ≤2 keywords per ladder, ~10 live checks a week for the own list | Semrush daily / ZIP / devices (https://www.semrush.com/features/position-tracking/); seoClarity 190+ countries, ZIP/GPS, six engines; BrightEdge 68K markets | Enterprises track thousands of keywords by market and device daily; weekly country-level data misses local and mobile reality | M (engine side is cheap to add; volume is the issue) | Money: SERP calls scale linearly with keywords × locations × devices × frequency |
| 8 | **AI-visibility scale** — panel of 3–50 prompts, no personas, no Grok / DeepSeek / Meta, prompt-volume data only for ChatGPT US-English | seoClarity from 500 prompts across 9 engines; SE Visible up to 1,000 prompts daily; Profound licensed prompt volumes in 35 countries; Ahrefs 481M-prompt index | A 20-prompt panel is a sample of one category; enterprise brands run hundreds of prompts by product line, persona and market | M | Money: each answer is paid; market-wide prompt data is a licensed asset Ascentra does not own |
| 9 | **No agent-facing delivery at the edge** (AI-only Markdown / prerender) | BrightEdge Agent Edge (https://www.brightedge.com/agent-edge), Botify SpeedWorkers, Profound Dynamic Bot Rendering, Scrunch AXP, Adobe Optimize at Edge | Large JS-heavy sites are invisible to AI fetchers; buyers are being sold this in 2026. Note the policy risk (serving bots different content than users) — a parity check would be the differentiator | L (and depends on gap 3's edge plumbing) | No; customer CDN access |
| 10 | **Integration ecosystem** — no Looker Studio connector, no BigQuery / Snowflake export, no Adobe Analytics / AEM, no Jira / Asana, no native Slack app | seoClarity LiveWire + BigQuery / Redshift / S3 + Jira / Asana (https://www.seoclarity.net/resources/news/seoclarity-launches-livewire-seo-and-aeo-intelligence); Conductor AEM + Adobe Analytics; Ahrefs Looker connectors | Enterprise SEO data ends up in the company's BI stack and work-tracking tool; without connectors the product is an island | M each (Looker connector and Jira first) | No |
| 11 | **Natural-language agent layer and write API** | Ahrefs Agent A / Letaido, Profound Aim, Conductor AgentStack, Botify Assist + MCP that drafts PageWorkers changes | Teams expect to ask questions and trigger work from Claude / ChatGPT; Ascentra's MCP is read-only and its API cannot start a run | S–M (start-run endpoint behind budget guard), M (agent) | Money: LLM usage |
| 12 | **White-label client portal for agencies** | SE Ranking Agency Pack $69/month (https://seranking.com/agency-pack.html); Search Atlas portals; AgencyAnalytics $20/client | Agencies are Ascentra's realistic first buyers; a logo on a share page is not a portal (custom domain, client logins, branded e-mail) | M | No |
| 13 | **SEO split testing with control groups** | Botify SplitTesting; seoClarity SEO Split Tester (S); SEOTesting (BENCH_AREA7) | The accepted way to prove an SEO change worked at enterprise scale; Ascentra compares a page with the rest of the site after publishing | L (needs gap 3 to change page groups) | No |
| 14 | **Multi-language / multi-market product** | seoClarity Content Fusion 16+ languages; Botify SmartContent 40+; Conductor 2,700+ non-US locations | Global enterprises run dozens of locales; Ascentra defaults `language_code` to English and documents hreflang checks only | M–L | Money: per-market data calls |
| 15 | **E-commerce: AI shopping and product feeds** | Semrush AI Shopping report; seoClarity ArcAI Shopping; Botify AgenticCatalog (GA June 2026); Profound Shopping | Retail is the largest enterprise SEO segment; product visibility in ChatGPT Shopping is a 2026 budget line | M | Money: SERP / shopping data |
| 16 | **Own data indexes** (keyword DB, backlink index, prompt database) | Ahrefs, Semrush, SE Ranking, Search Atlas own them; Profound licenses a consumer panel | Index size and freshness are what buyers compare first; Ascentra inherits DataForSEO's coverage | XL | Yes — this is a data-company business, not a feature |
| 17 | **Local SEO / GBP management** | Search Atlas GBP Galactic (posts, review replies, Q&A; https://searchatlas.com/gbp-galactic/); Ahrefs GBP review management; Moz Local; SE Ranking Local | Multi-location brands need listings and reviews managed, not a checklist | M | Money: listing-network fees if syndication is offered |
| 18 | **Track record and live proof** | Leaders publish customer counts, case studies, analyst placements (e.g. Botify "Strong Performer", Forrester Wave Q3 2025, S) | Ascentra has no external customer, the first live outreach send (G16) has not happened, and its own independent rating is 5.5 / 10 | — (operational) | — |

### Where Ascentra already does something the leaders do not (per docs; treat with scepticism)

These are documented in Ascentra's specs and code; the live system has not been shown to do them reliably (the 2026-10-16 rating found
15 High defects, all since fixed in code, several not yet re-run live). None of these is a reason an enterprise buys; they are reasons
an evaluator might rate its *judgement* above a suite's.

1. **Statistical treatment of AI-visibility rates.** Wilson ranges, z-tested changes and one Holm correction per report
   (`AI_VISIBILITY_SPEC.md`, changelog 2026-10-17). None of the ten products in the matrix publishes an interval or a significance test;
   only Evertune (outside the matrix) publishes margins of error, and sells significance on its $800 tier (https://www.evertune.ai/pricing).
2. **A fact gate on its own drafts.** Claims checked against the business facts, figures checked against the cited source, an originality
   check, and drafts that fail held back from delivery (`features.ts` content entry; `app/API.md` delivery rules). No suite in this set
   checks its own drafts' facts; Surfer tells users to verify facts themselves (https://surferseo.com/surfer-ai/), SE Ranking says to
   "pair with human fact checking" (https://seranking.com/ai-writer.html). Markup AI blocks for brand/quality, not source-checked figures.
3. **A pre-release check for CI** with a severity threshold and a list of intended changes. None of the ten offers one; Lumar Protect
   (outside the set) does.
4. **Keyword verdict + plan type + sequenced ladder.** Semrush personalises difficulty too, so the difficulty half is not unique; the
   sequenced, rank-gated climb with pile-up and overlap guards was not found anywhere.
5. **Link ledger verified by its own fetch, from nine sources including the customer's Search Console sample, "lost" only after two
   misses with a reason.** seoClarity also merges providers and re-crawls every link (S), so this is shared, not unique; the Search
   Console sample and Common Crawl graph were not found elsewhere.
6. **Outreach sent from the customer's own mailbox, with consent rules by country, reply reading and a refusal to buy or exchange
   links.** Semrush's AI PR Toolkit also sends from the customer's domain. The meaningful contrast is with Search Atlas WILDFIRE
   (exchange network) and Surfer's paid-placement marketplace, which carry link-spam policy risk Ascentra avoids by design. **Not yet
   exercised live (G16).**
7. **Cost in dollars per run, estimated before and settled after, with per-company budget locks.** Conductor's published credit price per
   engine with a forecast and burn-down is comparable; most others meter in units without a pre-run estimate.
8. **Results that are not ready are never delivered** (QA-failed drafts, refused plans, unread verdicts). Not found as a stated rule
   anywhere else; it is also a sign of how often the engine's own outputs were wrong in earlier ratings.

---

## 6. Facts in this document that are least certain

1. **Search Atlas:** "100T+ backlinks" appears only on its own comparison page; OTTO's default (autopilot vs approval) contradicts itself
   across two vendor pages; ARR and customer counts conflict between sources ($30M vs $2.9M).
2. **Ahrefs security:** the FAQ says SOC 2 is not certified while the Enterprise page claims ISO 27001; Project Boost prices and daily rank
   tracking via Max are (S); Letaido's subscription requirement conflicts between two Ahrefs pages.
3. **Semrush / Adobe:** no public SOC 2 claim found (aggregators say otherwise); Advanced price is demo-gated ($549 / $455.67 are 3P); Adobe
   Brand Visibility licence terms (per prompt per year, 1,000 deployed optimisations) are (S); whether the Link Building Tool is retired or
   only moved is unconfirmed.
4. **BrightEdge:** Agent Edge's $10,000/month and 99.9% SLA come from one AWS Marketplace listing; the Site Agents launch date is inferred;
   crawl-scale and local-market figures date from 2017.
5. **Moz:** every fact is third-party because moz.com blocks our crawler (AI-prompt quotas 150/300/600 vs 50/100/200; certifications from
   an undated aggregator).
6. **Profound:** Agency Growth pricing ($99 + $399 per workspace) is from a competitor; Dynamic Bot Rendering is dated 2026-09-18 in the
   changelog and 2026-10-11 on the blog.
7. **Botify:** SOC 2 type and ISO 27001 not confirmed from Botify's own pages; 2025–2026 corporate news not fully searched.
8. **seoClarity:** list prices are "representative as of October 11, 2022"; ArcAI default frequency and the Majestic dependency are (S).
9. **Conductor:** the 2026-09-28 CEO change has one trade source; SSO / RBAC plan gating comes from a competitor review.
10. **Vendr price medians** move between Vendr's own page and its snippets (e.g. Conductor $49,020 vs $43,200; Botify $74,200 vs $82,000).

---

## Sources by vendor (all opened 2026-10-17 unless marked)

- **Search Atlas:** https://searchatlas.com/otto-seo/ · https://searchatlas.com/enterprise/ · https://searchatlas.com/pricing/ ·
  https://searchatlas.com/keyword-research-tool/ · https://searchatlas.com/content-genius/ · https://searchatlas.com/site-auditor/ ·
  https://searchatlas.com/llm-visibility/ · https://searchatlas.com/atlas-agent/ · https://searchatlas.com/gbp-galactic/ ·
  https://searchatlas.com/search-atlas-vs-se-ranking/ · https://help.searchatlas.com/en/articles/11726629-understanding-the-wildfire-link-building-system ·
  https://wordpress.org/plugins/metasync/ · https://www.searchenginejournal.com/search-atlas-announces-new-features-for-agencies/557725/ ·
  https://www.citybuzz.co/2026/04/04/search-atlas-updates-address-key-concerns-in-ai-seo-automation/ · (3P) https://altheo.ai/reviews/searchatlas ·
  (3P) https://themarketingagency.ca/blog/search-atlas/ · (3P) https://diyai.io/ai-tools/seo/search-atlas-pricing/
- **Ahrefs:** https://ahrefs.com/pricing · https://ahrefs.com/enterprise · https://ahrefs.com/faq · https://ahrefs.com/keywords-explorer ·
  https://ahrefs.com/big-data · https://ahrefs.com/site-audit · https://ahrefs.com/blog/always-on-audit/ · https://ahrefs.com/patches ·
  https://ahrefs.com/rank-tracker · https://ahrefs.com/brand-radar · https://ahrefs.com/report-builder · https://ahrefs.com/blog/new-features/ ·
  https://ahrefs.com/blog/new-features-february-march-2026/ · https://ahrefs.com/blog/new-features-june-2026/ ·
  https://ahrefs.com/blog/new-features-july-august-2026/ · https://help.ahrefs.com/en/articles/9879434-about-the-new-ai-content-helper ·
  https://help.ahrefs.com/en/articles/15028902-about-agent-a · https://help.ahrefs.com/en/articles/13913559-getting-started-with-ahrefs-mcp ·
  https://siliconangle.com/2026/08/12/ahrefs-launches-ai-agent-workspace-letaido-marketers-agencies/
- **Semrush / Adobe:** https://news.adobe.com/news/2026/04/adobe-completes-semrush-acquisition ·
  https://www.semrush.com/news/455963-faq-for-customers-adobe-acquires-semrush/ · https://www.semrush.com/pricing/ ·
  https://enterprise.semrush.com/ · https://enterprise.semrush.com/solutions/ai-optimization/ · https://www.semrush.com/kb/1607-semrush-ai-visibility-data ·
  https://www.semrush.com/kb/1608-semrush-one · https://www.semrush.com/kb/812-content-toolkit · https://www.semrush.com/kb/31-site-audit ·
  https://www.semrush.com/features/site-audit/ · https://www.semrush.com/features/position-tracking/ · https://www.semrush.com/features/backlink-analytics/ ·
  https://www.semrush.com/features/link-building/ · https://www.semrush.com/kb/1546-agency-growth-kit-sunsetting · https://www.semrush.com/kb/1197-looker-studio-semrush-integration ·
  https://developer.semrush.com/api/basics/semrush-mcp/ · https://www.semrush.com/kb/1609-saml-sso · https://www.semrush.com/company/security/ ·
  https://www.semrush.com/news/releases/product-news/ · https://partners.adobe.com/digitalexperience/activation/guide/semrush-faq ·
  https://partners.adobe.com/digitalexperience/news/2026/07/what-new-adobe-brand-visibility ·
  https://experienceleague.adobe.com/en/docs/llm-optimizer/using/resources/optimize-at-edge/overview ·
  https://martech.org/adobe-brings-geo-to-cx-enterprise-with-adobe-brand-visibility/ · (3P) https://pricingsaas.com/companies/semrush/diffs/2026W28
- **seoClarity:** https://www.seoclarity.net/pricing · https://www.seoclarity.net/technical-seo/ · https://www.seoclarity.net/seo-platform-essentials/ ·
  https://www.seoclarity.net/seo-automation/pricing · https://www.seoclarity.net/ai-seo/pricing · https://www.seoclarity.net/ai-content-writer ·
  https://www.seoclarity.net/research-grid/ · https://www.seoclarity.net/enterprise-security · https://www.seoclarity.net/data-services/arcai-api-ai-search-visibility-data ·
  https://www.seoclarity.net/resources/news/seoclarity-launches-arcai-3.0-to-reclaim-brand-narrative-in-ai-search ·
  https://www.seoclarity.net/resources/news/seoclarity-unveils-the-complete-tech-stack-for-answer-engine-optimization/ ·
  https://www.seoclarity.net/resources/news/seoclarity-launches-livewire-seo-and-aeo-intelligence · https://status.seoclarity.net ·
  (3P) https://vendr.com/marketplace/seoclarity
- **Conductor:** https://www.conductor.com/pricing/ · https://www.conductor.com/security/ · https://www.conductor.com/legal/service-level-agreement/ ·
  https://status.conductor.com/ · https://www.conductor.com/docs/llms.txt and the doc pages cited above (ai-search-faqs, keyword-data-faqs,
  writing-assistant(-faqs), monitoring-faqs, real-time-indexnow, cms-api, tracked-keyword-faqs, log-file-analysis, recommendations, rate-limits,
  mcp-faqs, release-notes) · https://www.conductor.com/lp/aeo-agentstack/ · (3P) https://www.vendr.com/marketplace/conductor ·
  (3P) https://www.martech360.com/news/cxo-moves/conductor-promotes-wei-zheng-to-ceo
- **BrightEdge:** https://www.brightedge.com/trust · https://www.brightedge.com/ai-catalyst · https://www.brightedge.com/agent-edge ·
  https://www.brightedge.com/site-agents-suite · https://www.brightedge.com/blog/autopilot-to-brightedge-site-agent · https://www.brightedge.com/brightedge-mcp ·
  https://www.brightedge.com/products/instant · https://www.brightedge.com/products/content-advisor · https://help.brightedge.com/products/integrations ·
  https://help.brightedge.com/news/press-releases/brightedge-ai-hypercube-brands-ai-search-visibility ·
  https://aws.amazon.com/marketplace/pp/prodview-i2ggufqfujws4 · (3P) https://diginomica.com/brightedge-introduces-ai-hyper-cube-help-brands-understand-ai-search-heres-how-it-works ·
  (3P) https://vendr.com/marketplace/brightedge
- **Botify:** https://www.botify.com/ · https://www.botify.com/platform/activation/pageworkers · https://www.botify.com/platform/ai-readiness/speedworkers ·
  https://www.botify.com/platform/visibility/loganalyzer-feature · https://www.botify.com/platform/visibility/sitecrawler-feature ·
  https://www.botify.com/platform/visibility/realkeywords-feature · https://www.botify.com/platform/activation/smartindex ·
  https://www.botify.com/product-releases (monthly highlights, Mar–Sep 2026) · https://support.botify.com/en/articles/13854591-ai-visibility-faqs ·
  https://support.botify.com/en/articles/9108628-configuring-sso · https://support.botify.com/en/articles/16965529-botify-mcp-faqs ·
  https://support.botify.com/en/articles/16965174-monitoring-agent-credit-consumption · https://status.botify.com/ · (3P) https://www.vendr.com/marketplace/botify
- **Profound:** https://www.tryprofound.com/ · https://www.tryprofound.com/pricing · https://www.tryprofound.com/enterprise ·
  https://www.tryprofound.com/features/answer-engine-insights · https://www.tryprofound.com/features/prompt-volumes · https://www.tryprofound.com/features/agent-analytics ·
  https://www.tryprofound.com/features/aim · https://www.tryprofound.com/features/agents · https://www.tryprofound.com/features/pages ·
  https://www.tryprofound.com/integrations · https://www.tryprofound.com/blog/introducing-dynamic-bot-rendering · https://product.tryprofound.com/changelog ·
  https://status.tryprofound.com/ · https://docs.tryprofound.com/ · https://www.fortune.com/2026/02/24/exclusive-as-ai-threatens-search-profound-raises-96-million-to-help-brands-stay-visible
- **SE Ranking:** https://seranking.com/subscription.html · https://seranking.com/rank-tracker.html · https://seranking.com/keyword-research.html ·
  https://seranking.com/website-audit.html · https://seranking.com/backlink-checker.html · https://seranking.com/ai-writer.html ·
  https://seranking.com/agency-pack.html · https://seranking.com/api/integrations/mcp · https://seranking.com/api/integrations/looker-studio ·
  https://seranking.com/whats-new.html · https://seranking.com/blog/seranking-plans-for-2026/ · https://visible.seranking.com ·
  (3P, competitor) https://trakkr.ai/reviews/seranking-review/enterprise-security
- **Moz (all 3P):** https://pricingsaas.com/companies/moz · https://aionx.co/ai-comparisons/moz-pro-pricing-guide/ · https://bloggerspassion.com/moz-review/ ·
  https://www.rankability.com/blog/best-enterprise-rank-trackers/ · https://growthmethod.com/moz-data-mcp-server/ · https://www.stitchflow.com/scim/moz
- **Surfer:** https://surferseo.com/pricing/ · https://surferseo.com/enterprise/ · https://surferseo.com/ai-tracker/ · https://surferseo.com/surfer-ai/ ·
  https://surferseo.com/content-audit/ · https://surferseo.com/changelog/ · https://www.surferseo.com/updates/surfer-mcp-october2026/ ·
  https://www.surferseo.com/updates/agent-analytics-october2026/ · https://surferseo.com/updates/ai-tracker-marketplace · https://positivegroup.com/news/positive-acquires-surfer
- **Entrants:** https://docs.evertune.ai/en/articles/16558380-what-makes-evertune-different · https://www.evertune.ai/pricing · https://peec.ai/changelog ·
  https://docs.peec.ai/ · https://scrunch.com/pricing · https://scrunch.com/platform/agent-experience/ · https://origin.scrunchai.com/about/ ·
  https://www.athenahq.ai/pricing · https://www.alliai.com/pricing · https://otterly.ai/pricing · https://writesonic.com/pricing · https://www.withgauge.com/
- **Other:** https://www.agencyanalytics.com/pricing · https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports
- **Ascentra (repository):** `CLAUDE.md`; `app/README.md`; `app/API.md`; `app/web/src/marketing/content/features.ts`, `changelog.ts`, `pricing.ts`,
  `site.ts`; `app/web/src/marketing/pages/SecurityPage.tsx`; `n8n/seo-agent/*_SPEC.md`; `n8n/seo-agent/v5/code/Tracker_Plan.js` (mobile limits);
  `n8n/seo-agent/docs/system-review-2026-10-14/BENCH*.md`; `n8n/seo-agent/docs/system-review-2026-10-15/SCORECARD.md`.
