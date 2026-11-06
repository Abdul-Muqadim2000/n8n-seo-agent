# R3: Integrations for AI ranking (2026-11-05)

Status: DONE 2026-11-05 (research only; nothing built, no paid call made).

Question from the owner: which third-party integrations do we need so clients get named and cited by ChatGPT, Google AI Overviews / AI Mode, Gemini, Perplexity, Copilot and Claude, and so we can prove it?

Rules for this file: every outside fact carries its URL and the date it was opened (all opened 2026-11-05 unless noted). VERIFIED = read on the vendor's own docs or blog. UNVERIFIED = third-party write-up or not confirmed on the vendor's page. No secret values; only whether a key is set in the local `n8n/.env`.

## 1. What we already integrate (from the code, 2026-11-05)

Paths are relative to `n8n/seo-agent/` unless they start with `app/`.

### 1.1 Answer engines and AI data (DataForSEO, one login, keys set)

| Endpoint | File | Feeds |
|---|---|---|
| `ai_optimization/chat_gpt/llm_scraper/live/advanced` | `v5/code/AI_Requests.js` | ChatGPT product answers (weekly run + daily AI Pulse), cited URLs, brand list, fan-out searches |
| `ai_optimization/chat_gpt/llm_responses/live` | `AI_Requests.js`, `_ai_w2e3.js` | opt-in "ChatGPT API" engine (what an app built on the model answers) |
| `ai_optimization/gemini/llm_scraper/live/advanced` | `AI_Requests.js` | Gemini product answers (weekly + pulse) |
| `ai_optimization/gemini/llm_responses/live` | `AI_Requests.js` | opt-in "Gemini API" engine |
| `ai_optimization/perplexity/llm_responses/live` | `AI_Requests.js` | Perplexity answers, localised with `web_search_country_iso_code` |
| `ai_optimization/claude/llm_responses/live` | `AI_Requests.js` | Claude answers, monthly (the field above is refused, so the country goes in the wording) |
| `serp/google/ai_mode/live/advanced` | `AI_Requests.js` | Google AI Mode answers (weekly + pulse) |
| `serp/google/organic/live/advanced` (AI Overview block) | `AI_Requests.js` and the rank / SERP kits | AI Overviews presence and citations |
| `serp/bing/organic/live/advanced` | `AI_Requests.js` | opt-in "Copilot" engine: the Copilot Search summary when Bing shows one (0 of 10 live in 2026-10) |
| `ai_optimization/llm_mentions/search_mentions/live` | `AI_Requests.js`, `Discovery_Requests.js` | real questions from the AI-answer database for the panel; "questions citing you" |
| `ai_optimization/llm_mentions/multi_target_metrics/live`, `top_mentioned_domains`, `top_mentioned_brands`, `timeseries_new_lost`, `historical` | `AI_Requests.js` | monthly market-wide share vs competitors (ChatGPT data US-English only) |
| `ai_optimization/ai_keyword_data/keywords_search_volume/live` | `Discovery_Requests.js`, `build_v4.py` | AI search volume per panel question |

### 1.2 Search engines, indexing, first-party data

| Integration | File | Feeds | Key in local `.env` |
|---|---|---|---|
| Google Search Console API (searchanalytics, sitemaps, URL Inspection) | `GSC_Requests.js`, `GSC_Audit_Requests.js`, `IX_*_Requests.js`, `build_index_coverage.py` | queries / pages, long question queries for the AI panel, index coverage, sitemap state | service account set |
| GA4 Data API | `GA4_Requests.js`, `Referral_Requests.js`, `Traffic_Requests.js`, `GA4_Audit_Plan.js` | AI referral visits / key events / revenue per assistant; referral links | service account set |
| Bing Webmaster API (`GetUserSites`, `GetUrlInfo`, `GetLinkCounts`, `GetUrlLinks`, `SubmitUrlBatch`, `GetUrlSubmissionQuota`) | `Bing_*.js`, `Growth_Bing_*.js`, `AI_Readiness.js` | Copilot-side index state of key pages, URL submission, inbound links | `SEO_BING_WEBMASTER_API_KEY` set |
| IndexNow (`api.indexnow.org/indexnow`) | `Growth_IndexNow_Submit.js`, `Growth_IndexNow_Keys.js` | push new / changed URLs to Bing, Yandex, Seznam, Naver | key per site, no secret |
| Google Search Status Dashboard feed | `IX_Google_Events.js`, `_index_kit.js` | freeze / explain during core and spam updates | none |
| PageSpeed Insights + Chrome UX Report | `CrUX_Requests.js`, audit nodes | speed findings | `SEO_PAGESPEED_API_KEY` set |
| Jina Reader (`r.jina.ai`) | `_reader.js`, `Render_Requests.js`, `Render_Diff_Targets.js` | page text, render diff (what a non-JS AI fetcher sees) | `SEO_JINA_API_KEY` set |
| SearXNG (self-hosted metasearch) | `LB_Source_Requests.js`, `Source_Requests.js`, `Locate_Requests.js`, `_regulatory.js` and others | mentions, "best X" lists, `site:` lookups | none (container) |
| Anthropic Messages API | Claude nodes in every workflow | Answer Analyst, writers, critics, Reply Reader | `SEO_ANTHROPIC_API_KEY` set |

### 1.3 Earned media, entities, links

| Integration | File | Feeds |
|---|---|---|
| DataForSEO Backlinks (`summary`, `backlinks`, `referring_domains`, `anchors`, `domain_pages`, `domain_intersection`, `timeseries_summary`, `bulk_ranks`, `bulk_spam_score`) | `BL_Requests.js`, `Gap_Requests.js`, `Authority_Requests.js`, `Parse_Backlinks.js` | link ledger, gap, authority, spam |
| DataForSEO Content Analysis `search` | `BL_Requests.js` | unlinked brand mentions |
| DataForSEO Business Data `google/my_business_info` | `GBP_Request.js` | Google Business Profile entity check |
| DataForSEO Labs (`competitors_domain` and others), Google Trends | ladder / tracker nodes, `Trends_Requests.js` | competitors, demand |
| Ahrefs free Domain Rating (`api.ahrefs.com/v3/public/domain-rating-free`) | `DR_Requests.js` | DR per linking domain (visible credit required) |
| Common Crawl web graph | `linkgraph/cc_linkgraph.py` | links from 133M domains, harmonic-centrality rank |
| Wikidata API (`www.wikidata.org/w/api.php`) | `Growth_Entity_Requests.js` | entity present / missing |
| Wikipedia | `Source_Requests.js`, `Verify_Requests.js`, `Link_Merge.js` | links and mentions on Wikipedia |
| Hacker News (Algolia API) | `Source_Requests.js` | mentions |
| GDELT DOC 2.0 | `News_Requests.js` | news mentions (credit required) |
| Bluesky `app.bsky.feed.searchPosts` | `LB_Source_Requests.js` | #journorequest journalist requests |
| Wayback CDX | `LB_Source_Requests.js` | our old URLs that now 404 (redirect targets) |
| iTunes Search API | `_podcast.js` | podcast guest targets |
| RDAP (`rdap.org`) | `_rdap.js`, `Age_Lookup_Plan.js` | domain ages |
| Vimeo oEmbed, YouTube page | `build_v4.py` | video details for VideoObject |

### 1.4 In the web app

| Integration | File | Feeds |
|---|---|---|
| Bing AI Performance + Search Console AI CSV upload (manual export, no API) | `app/shared/src/ai-import.ts`, table `seo_ai_imports` | Copilot citations per page and grounding query; Google AI impressions per page |
| Server / CDN log upload and push (combined, W3C, JSON, Cloudflare Logpush `http_requests`), crawler IP-range + reverse-DNS verification | `app/server/src/services/crawlers/*` | AI crawler analytics (GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-SearchBot, Googlebot, Bingbot) |
| CMS publishing (WordPress, Webflow, Contentful, signed webhook) | `app/server/src/services/cms/connectors/*` | publishing pages and refreshes |
| Mailboxes (SMTP / IMAP, Microsoft 365 and Gmail OAuth) | `app/server/src/services/mail*.ts`, `outreachJobs.ts` | outreach for earned media |
| Slack / Teams, Jira / Linear / Asana, S3 / BigQuery, Looker Studio | `app/server/src/services/integrations.ts`, `issueTrackers.ts` | delivery, not ranking |

### 1.5 Considered before and not used (from the specs)
- Reddit (unauthenticated JSON blocked May 2026; OAuth needs approval and a commercial agreement), Google News RSS (non-commercial), Cloudflare Radar ranks (CC BY-NC), Moz / Majestic / Semrush / SE Ranking APIs (no useful free tier), Common Crawl CDX for "who links to X" (cannot answer it). `BACKLINKS_SPEC.md` "Not used, and why".
- Brave Search API (would serve Claude-side checks; not built; `INSTANCE_AI_BRAVE_SEARCH_API_KEY` is empty). `AI_GROWTH_SPEC.md` §7.
- Grok, DeepSeek, Meta AI, Copilot API: no DataForSEO endpoint (40402, probed 2026-10-18). `AI_VISIBILITY_SPEC.md` §10.5.

## 2. Candidates (vendor facts, opened 2026-11-05)

### 2.1 Answer engines measured directly

**OpenAI Responses API, `web_search` tool.** VERIFIED. https://developers.openai.com/api/docs/guides/tools-web-search (2026-11-05): answers carry inline `url_citation` annotations (URL, title, position); `include: ["web_search_call.action.sources"]` returns every URL consulted; `user_location` (country, city, region, timezone); `filters.allowed_domains` / `blocked_domains` up to 100; `search_context_size` low / medium / high. The page does not say the API matches the ChatGPT product. Price, https://developers.openai.com/api/docs/pricing (2026-11-05): web search $10 per 1,000 calls, search content tokens billed at model rates; `gpt-5.4-mini` $0.75 / $4.50 per 1M tokens in / out, `gpt-5-mini` $0.25 / $2.00.

**Gemini API, Grounding with Google Search.** VERIFIED. https://aistudio.google.com/docs/pricing (2026-11-05): Gemini 3 and newer: 5,000 free search requests a month shared across models, then $14 per 1,000; default cap 1,500 a day per project; Gemini 2.5: $35 per 1,000 grounded prompts after 1,500 free a day on paid tiers. https://aistudio.google.com/docs/google-search (2026-11-05): returns the search `queries` run, `search_suggestions` HTML, and inline `url_citation` annotations; usage requirements sit in the terms (not read yet).

**Anthropic web search tool.** VERIFIED. https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool (2026-11-05): $10 per 1,000 searches plus tokens; citations always on (`web_search_result_location` with URL, title, up to 150 characters of cited text); `user_location`; allowed / blocked domains; the search provider is not named on the page.

**Perplexity.** Partly VERIFIED. https://docs.perplexity.ai/docs/getting-started/pricing (2026-11-05): Search API $5 per 1,000 requests ($1 Fast). Sonar request fees by context size (about $6 to $14 per 1,000 for Sonar Pro) are from Perplexity doc pages seen in search results, not read in full: UNVERIFIED until read.

**Microsoft: Grounding with Bing Search.** VERIFIED. https://www.microsoft.com/en-us/bing/apis/grounding-pricing (2026-11-05): $14 per 1,000 transactions, 150 per second, 1 million a day; Grounding with Bing Custom Search same price. Only through Azure AI Foundry agents, paid subscriptions only (https://learn.microsoft.com/en-us/azure/foundry-classic/agents/how-to/tools-classic/bing-grounding, seen in search results: UNVERIFIED detail).

**Perplexity Sonar, response shape.** VERIFIED. https://docs.perplexity.ai/docs/sonar/models/sonar-pro (2026-11-05): Sonar answers carry a top-level `citations` list and a `search_results` array (title, URL, date, snippet). That page names no country filter. Our DataForSEO route already passes `web_search_country_iso_code` to Perplexity.

**Answer engines through scrapers (the consumer product, not the model API).**
- DataForSEO AI Optimization. VERIFIED endpoint list, https://docs.dataforseo.com/v3/ai_optimization/overview/ (2026-11-05): ChatGPT (LLM Responses + LLM Scraper), Gemini (LLM Responses + LLM Scraper), Claude (LLM Responses only), Perplexity (LLM Responses only), AI Keyword Data, LLM Mentions with `search_mentions`, `target_metrics`, `multi_target_metrics`, **`top_mentioned_pages`**, `top_mentioned_domains`, `top_mentioned_brands`, `top_mentioned_brand_categories`, `historical`, `timeseries_delta`, `timeseries_new_lost`, and "Lite" flat versions of five of them. No Copilot, Grok, DeepSeek or Meta AI; no Perplexity or Claude product scraper. Prices, https://dataforseo.com/pricing/ai-optimization (2026-11-05): LLM Responses from $0.0002 per task plus the model cost, LLM Scraper from $0.0012 per results page, AI Keyword Search Volume from $0.01 per task plus $0.0001 per row, LLM Mentions from $0.10 per task plus $0.001 per row (Lite billed the same, per https://dataforseo.com/pricing/ai-optimization/llm-mentions as shown in search results: UNVERIFIED). Our calibrated per-call costs (ChatGPT / Gemini scraper and AI Mode $0.004, Perplexity $0.006, AI Overview $0.002, Claude $0.025) are in `AI_VISIBILITY_SPEC.md` §5. **We do not call `top_mentioned_pages`, `target_metrics` or `top_mentioned_brand_categories` yet.**
- SerpApi. VERIFIED. https://serpapi.com/bing-copilot-api (2026-11-05): a **Bing Copilot API** returning `text_blocks` and `references` (index, title, link, snippet, source), with city-level `location` or lat/lon; cached searches are free. https://serpapi.com/google-ai-mode-api exists (seen in search results). Plans, https://serpapi.com/pricing (2026-11-05): Free 250 searches a month; Starter $25 / 1,000; Developer $75 / 5,000; Production $150 / 15,000 (adds "Legal Shield", up to $2M cover for scraping and parsing search engine data); Big Data $275 / 30,000. The pricing page does not say which APIs each plan includes; SerpApi's FAQ (search result, UNVERIFIED) says all APIs are in all plans.
- Bright Data. UNVERIFIED (brightdata.com did not resolve from this machine on 2026-11-05; facts from Bright Data's own pages as shown in search results): scrapers for ChatGPT, Perplexity, Gemini, Grok, Google AI Mode and Copilot; $1.50 per 1,000 records pay-as-you-go; 5,000 free records a month on the ChatGPT and Perplexity pages. Source pages: https://brightdata.com/products/web-scraper/chatgpt, https://brightdata.com/products/web-scraper/perplexity, https://brightdata.com/blog/ai/best-llm-scrapers.
- Oxylabs. UNVERIFIED (search results of Oxylabs' own pages, not opened): Web Scraper API targets for ChatGPT, ChatGPT Shopping, Perplexity, Gemini and Google AI Mode, from $1.50 per 1,000 results, lower at volume. https://oxylabs.io/products/web-api/scrape/serp/chatgpt, https://oxylabs.io/products/web-api/scrape/serp/google-ai-mode.
- Google AI Mode / AI Overviews: Google offers no API for either answer. Only scrapers (DataForSEO, which we use; SerpApi; Oxylabs).

**Ahrefs Brand Radar API (a competitor's data, sold).** UNVERIFIED (search results of Ahrefs pages): `GET /v3/brand-radar/ai-responses`; Brand Radar indexes $199 a month per platform or $699 for all; Grok added April 2026. https://docs.ahrefs.com/en/api/reference/brand-radar/get-ai-responses, https://ahrefs.com/blog/new-features-apr-2026/.

### 2.1b A terms problem to know about
**Gemini API grounding forbids analysing or storing grounded results.** VERIFIED. https://aistudio.google.com/docs/terms (2026-11-05): grounded results and search suggestions may be shown "only ... to the end user who submitted the prompt"; you may not "copy, store, or implement any click tracking, Link-tracking or other monitoring"; end users and third parties may not "cache, frame, syndicate, resell, analyze, train on, or otherwise learn from" them; using grounding "to extract or collect one or more of these components for another purpose" is a violation (text may be stored up to two years only to evaluate display in your app). A visibility tracker does exactly that. So we must not call Gemini grounding directly as a measurement engine. Our opt-in "Gemini API" engine goes through DataForSEO's `gemini/llm_responses`; whether DataForSEO holds a different licence is unknown: UNVERIFIED, ask DataForSEO in writing before promoting that engine. The Gemini consumer scraper (`gemini/llm_scraper`) is not under these API terms.

### 2.2 First-party AI data

**Bing Webmaster Tools AI Performance.** VERIFIED. https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/ (2026-11-05): public preview since 2026-02-11; on 2026-06-16 added Intents, Topics, Citation Share (share of all citations for a grounding query; no competitor domains) and Compare; covers "Microsoft Copilot, Bing, and select partner AI experiences". No API is mentioned, and the Bing Webmaster API method list (https://learn.microsoft.com/en-us/dotnet/api/microsoft.bing.webmaster.api.interfaces.iwebmasterapi?view=bing-webmaster-dotnet, 2026-11-05) has no AI method. That list does have methods we do not use yet: `GetQueryStats`, `GetPageStats`, `GetQueryPageStats` (Bing search performance), `GetCrawlStats`, `GetCrawlIssues`, `SubmitContent`, `AddSiteRoles` (delegate site access to a user).

**Google Search Console generative AI reports.** VERIFIED. https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports (2026-11-05): launched 2026-06-03, all sites since 2026-08-31; impressions only, by page, country, device, date, for AI Overviews, AI Mode and Discover AI. No API mentioned. https://developers.google.com/webmaster-tools/v1/searchanalytics/query (2026-11-05): `type` accepts discover, googleNews, news, image, video, web: no AI value. https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc (2026-11-05): export is a manual download. Our CSV upload stays the only route.

### 2.2b More first-party AI data (continued)

**GA4 AI Assistant channel.** VERIFIED (search result summary of Google's release notes and help page, both support.google.com): since 2026-05-13 the Default Channel Group has an "AI Assistant" channel; visits get medium `ai-assistant` when the referrer is a known assistant (examples ChatGPT, Gemini, DeepSeek, Copilot, Grok); AI Overviews and AI Mode stay in Organic Search. https://support.google.com/analytics/answer/9164320, https://support.google.com/analytics/answer/9756891. Our `GA4_Requests.js` already accepts medium `ai-assistant` OR a source regex: keep both (the regex catches assistants Google does not list).

**Cloudflare AI Crawl Control + GraphQL Analytics.** VERIFIED. https://developers.cloudflare.com/ai-crawl-control/ (2026-11-05): crawler analytics, allow / block per crawler, robots.txt compliance tracking, pay per crawl (private beta), "available on all plans". https://developers.cloudflare.com/ai-crawl-control/reference/graphql-api/ (2026-11-05): `httpRequestsAdaptiveGroups` per zone at `api.cloudflare.com/client/v4/graphql` with a bearer token; documented queries for crawler requests over time, top crawled paths, AI referral traffic (chatgpt.com, perplexity.ai) and bytes per crawler. Verified bot IDs (`botDetectionIds_hasany`) need Bot Management; the referrer filter is paid plans only; on Free, user-agent filtering only (spoofable). Token scope not stated on that page. Our app ingests Cloudflare Logpush lines already, but Logpush needs a plan that has it; GraphQL works on every plan and needs only a read token from the client.

**Microsoft Clarity AI Visibility.** VERIFIED for bot activity, https://learn.microsoft.com/en-us/clarity/ai-visibility/bot-activity-overview (updated 2026-10-14, opened 2026-11-05): bot operator, AI request share, bot purpose, path requests, from server-side logs through a connected CDN or server (WordPress plugin on by default); Microsoft states bot activity "doesn't indicate that content was retrieved, grounded, cited". Clarity is free (https://clarity.microsoft.com/blog/clarity-connects-agents-llms-people/, dated 2026-11-04, opened 2026-11-05) and adds an Agent Activity dashboard. A Clarity citations dashboard ("My cited pages") exists per Microsoft Q&A and Clarity blog snippets: UNVERIFIED. The Clarity Data Export API allows 10 requests a day per project, up to 3 days, general dimensions only, no AI fields documented (https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api, seen in search results: UNVERIFIED).

### 2.3 Index and crawl

| Service | Facts | Status |
|---|---|---|
| IndexNow | up to 10,000 URLs per POST; key file at the root (or `keyLocation` scoped to its path); 200 = received, 202 = key validation pending, 429 = too often; no published daily quota. https://www.indexnow.org/documentation (2026-11-05) | VERIFIED; we use it |
| Bing URL Submission API | up to 10,000 URLs per domain per day, batch max 500, quota varies by site; Bing recommends IndexNow and says the API "may be deprecated". https://www.bing.com/webmasters/help/URL-Submission-62f2860b (search result of Bing's help page) | UNVERIFIED detail; we use `SubmitUrlBatch` and read `GetUrlSubmissionQuota` |
| Google Indexing API | only pages with `JobPosting` or `BroadcastEvent` in a `VideoObject`. https://developers.google.com/search/apis/indexing-api/v3/quickstart (2026-11-05) | VERIFIED: not usable for client pages |
| Brave Search API | Search $5 per 1,000 with $5 free credit a month, 50 queries/s; Answers $4 per 1,000 plus $5 per 1M tokens; storage rights only "with a plan that includes storage rights". https://brave.com/search/api/ (2026-11-05) | VERIFIED |
| Claude's search provider | Brave was added to Anthropic's subprocessor list on 2025-03-19 (reported); a second web-search subprocessor (turbopuffer) from 2026-05-06 is reported. https://simonwillison.net/2025/Mar/21/anthropic-use-brave/, https://xponent21.com/insights/claude-web-search-brave-turbopuffer/. Anthropic's tool docs name no provider. | UNVERIFIED: do not promise "Brave rank = Claude citation" |
| Exa | search $4 to $7 per 1,000 (more for deep), contents $1 per 1,000 pages, answer $5 per 1,000, $10 free a month. https://exa.ai/pricing (2026-11-05) | VERIFIED; no evidence a major assistant uses it |
| Tavily | 1,000 free credits a month, then $0.008 per credit; basic search 1 credit, advanced 2. https://docs.tavily.com/documentation/api-credits (2026-11-05) | VERIFIED; agent-builder search, not a consumer assistant |
| You.com | not researched in depth | UNVERIFIED |
| Common Crawl index | latest crawl `CC-MAIN-2026-43` (October 2026); free CDX API `https://index.commoncrawl.org/CC-MAIN-2026-43-index?url=<domain>/*&output=json`. https://index.commoncrawl.org/collinfo.json (2026-11-05) | VERIFIED; we use the web graph, not the CDX presence check |

### 2.4 Earned-media and entity surfaces

| Surface | Facts | Status |
|---|---|---|
| Reddit Data API | free for non-commercial use at 100 queries/min per OAuth client; commercial use needs app review and a contract; no public rate card; reports of a "Responsible Builder Policy" requiring approval for all new apps. Third-party only: https://prowlo.com/blog/reddit-data-api, https://data365.co/blog/reddit-api-pricing. Reddit's own domains refuse our fetcher. | UNVERIFIED |
| YouTube Data API v3 | 10,000 units a day per project, `search.list` 1 unit, 100 `search.list` calls default allocation; free. https://developers.google.com/youtube/v3/getting-started (2026-11-05) | VERIFIED |
| Wikipedia / Wikidata | 2026 global limits: 10 req/min for anonymous IP-only clients, 200/min with a compliant User-Agent, more when authenticated (https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits, search result); Wikimedia Enterprise free tier 50,000 on-demand requests a month (https://enterprise.wikimedia.com/pricing/, search result). Our Wikidata node already sends a descriptive User-Agent (`build_monitors.py`, `WIKI_UA`). | UNVERIFIED (Wikimedia pages seen in search results) |
| Crunchbase API | sales-led, priced by use case; Fundamentals / Insights / Predictions packages. https://support.crunchbase.com/hc/en-us/articles/32319290128019-Crunchbase-API-FAQ (search result) | UNVERIFIED |
| G2 | review syndication API with a key from a G2 representative (`data.g2.com`); Developer Portal tokens for G2 customers. https://documentation.g2.com/partners/docs/get-started-with-g2-review-syndication (search result) | UNVERIFIED; needs the client's G2 vendor account |
| Capterra / Gartner Digital Markets | no public vendor API found; listings managed in the vendor portal | UNVERIFIED |
| Clutch / GoodFirms | no API found | UNVERIFIED |
| Trustpilot | API needs a Trustpilot for Business account with the API module add-on; partners use business-user OAuth. https://developers.trustpilot.com/introduction (search result) | UNVERIFIED |
| Google Business Profile API | apply via a form with a Cloud project number; the profile (own or a client's) must be verified 60+ days and list a website; approved = 300 QPM. https://developers.google.com/my-business/content/prereqs (2026-11-05) | VERIFIED |
| Apple Business Connect | API only for Apple-approved partners (Yext, Birdeye, BrightLocal, Yelp ...) with delegated access. https://support.apple.com/guide/business/apple-business-partner-api-access-abcb4226f877/web (search result) | UNVERIFIED |
| Bing Places | no public API found in this search | UNVERIFIED |
| Microsoft AppSource / partner directory | listing work, not an API we would call; already in our listings checklist (`v5/code/_listings.js`) | UNVERIFIED |

### 2.5 PR and journalist requests

| Service | Facts | Status |
|---|---|---|
| HARO (Featured.com) | Featured.com bought HARO from Cision on 2025-04-15, digests resumed 2025-04-22, three a day; reports of a mid-2026 move back to the Connectively name. https://en.wikipedia.org/wiki/Help_a_Reporter_Out, https://buzzstream.com/blog/haro-is-back-podcast/ | UNVERIFIED; no API found. We already parse digests in the client's mailbox (L5) |
| Qwoted | free tier, paid plans sales-led; no API found | UNVERIFIED |
| SourceBottle | free, AU / UK / international requests | UNVERIFIED |
| Help a B2B Writer | nothing found | UNVERIFIED |
| EIN Presswire | about $149 a release (2026 roundups); no API found | UNVERIFIED |
| PR Newswire, Business Wire, GlobeNewswire | sales-led; no public API found | UNVERIFIED |
| Zawya (LSEG, UAE) | press releases by e-mail to the Zawya desk listed on https://www.zawya.com/en/contact-us; no product page or price found | UNVERIFIED |

### 2.6 Content distribution

| Channel | Facts | Status |
|---|---|---|
| Medium | no new integration tokens and no new integrations (Medium help centre, as quoted in search results: https://help.medium.com/hc/en-us/articles/213480228) | UNVERIFIED |
| LinkedIn | Posts API (`/rest/posts`) can post as an organization with `w_organization_social` and a page admin role; long-form articles reportedly not creatable by API. https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/posts-api (search result) | UNVERIFIED |
| Substack | no official public API | UNVERIFIED |
| GitHub | REST API, free with a token | not re-checked (well known) |

### 2.7 Other 2025-2026 launches that serve AI visibility

| Launch | Facts | Status |
|---|---|---|
| ChatGPT merchant product feeds + Agentic Commerce Protocol | merchants apply to share a CSV / JSON feed (nine required fields), daily snapshots, SFTP or API; Shopify and Etsy already covered; shopping US only; ACP is Apache 2.0 and does not list you by itself. https://chatgpt.com/merchants/, https://developers.openai.com/commerce/specs/file-upload/products (search results) | UNVERIFIED; e-commerce clients only |
| Search Console generative AI reports | see §2.2 (UI + manual export) | VERIFIED |
| Bing AI Performance with Citation Share | see §2.2 (UI only) | VERIFIED |
| GA4 AI Assistant channel | see §2.2b | VERIFIED via Google help snippets |
| Clarity Bot Activity / Agent Activity | see §2.2b | VERIFIED in part |

## 3. Ranking and decisions

How to read it: impact = how directly the integration moves a client's inclusion in AI answers (a lever) or proves it (measurement the client trusts); cost = money per site per month at a 20-question panel; effort = build days in our stack. Lever beats measurement when the rest is equal, because R4's question is "why no outcome".

| # | Integration | What it feeds | Cost | Effort | Decision |
|---|---|---|---|---|---|
| 1 | **DataForSEO LLM Mentions `top_mentioned_pages` + `target_metrics` (+ Lite)** | Lever: the exact third-party pages AI answers cite for the client's topic, across the whole database, not only our panel. That is the earned-media target list (the strongest evidenced lever: mentions on other sites). `target_metrics` gives the client's own mention count to prove movement month on month. | $0.10 per task + $0.001 per row: about $0.20 to $0.40 per site per month (two monthly calls, 100 rows) | small: same login, same request kit (`AI_Requests.js`) | **MUST** |
| 2 | **Bing Webmaster API, the methods we skip** (`GetQueryStats`, `GetPageStats`, `GetQueryPageStats`, `GetCrawlIssues`, `GetCrawlStats`; `AddSiteRoles` for onboarding) | Lever + proof for Copilot: Copilot grounds on Bing, so Bing queries / positions per page and Bing crawl issues are the levers for Copilot citation; we read index state and links only today | $0 (key set) | small | **MUST** |
| 3 | **SerpApi Bing Copilot API** | Measurement: the only realistic way to sample Copilot answers with their references (DataForSEO has no Copilot endpoint; its Bing results showed the Copilot summary 0 of 10 times). Copilot is also the one engine with first-party citation data (Bing AI Performance), so our sample can be checked against Microsoft's own numbers: that is how we prove the method. | $0.015 to $0.025 per search; weekly 20 questions = about 86 searches = $1.30 to $2.15 per site per month. Starter $25 / 1,000 (about 11 sites weekly) or Developer $75 / 5,000 (about 58 sites). Not on the daily pulse at first. | medium: one new credential, one request branch, one parser | **MUST** |
| 4 | **First-party AI exports (Bing AI Performance, Search Console generative AI) as a monthly site task**, plus GA4's AI Assistant channel | Proof the client trusts: Google's and Microsoft's own counts of AI impressions / citations per page. No API exists (§2.2), so the upload we built is the route; the gap is that nobody is asked to do it every month. | $0 | small: a recurring site task + guide (`app/shared/src/site-tasks.ts`, guides) | **MUST** |
| 5 | Anthropic `web_search` tool, direct | Measurement for Claude with its own search: cited URLs, cited text and the queries Claude ran (its fan-out), which tells the writer what to cover | $10 per 1,000 searches + tokens: about $0.40 per site per month in search fees at 20 questions monthly, 2 searches each | small (key set) | SHOULD |
| 6 | Cloudflare GraphQL Analytics connector | Lever check: AI crawler hits per page without a log upload, for Cloudflare clients (a blocked or never-fetched page cannot be cited) | $0; client creates a read-only token | medium (app connector, uses the existing crawler tables) | SHOULD |
| 7 | Common Crawl CDX presence check | Lever check: is the client's site in the latest crawl that model builders train on, and how many pages; a missing site points to robots.txt (`CCBot`) or rendering | $0 | small | SHOULD |
| 8 | YouTube Data API | Lever: whether the client has videos for its panel questions; YouTube pages are a common AI citation (UNVERIFIED claim in industry studies; check our own `cited_urls` first) | $0 (Google API key) | small | SHOULD |
| 9 | OpenAI Responses `web_search`, direct | Measurement: `sources` lists every URL consulted, not only cited ones (citation vs consideration gap); our "ChatGPT API" engine today goes through DataForSEO | $10 per 1,000 calls + tokens | small | SHOULD (after #5, only if DataForSEO's response lacks the consulted-sources list) |
| 10 | Brave Search API | Lever check for Claude-side retrieval (is the page in Brave's index, where does it rank) | about 1,000 queries a month free, then $5 per 1,000 | small | SHOULD (cheap; the Brave = Claude link is weaker since 2026 reports of a second provider) |
| 11 | Google Business Profile API | Lever for local clients: profile completeness and posts that Gemini / AI Mode read for local answers; we read GBP through DataForSEO today | $0; approval + client OAuth | medium | LATER (local clients only) |
| 12 | Bright Data AI scrapers (Copilot, Perplexity product, Grok) | Measurement backup / Grok coverage at about $1.50 per 1,000 | small per engine | medium | LATER (verify pages first: UNVERIFIED) |
| 13 | Microsoft Clarity AI Visibility | Free client-side dashboard (bot and agent activity, reported citations); API too thin to read from | $0 | none for us: a guide | LATER (recommend to clients, do not integrate) |
| 14 | ChatGPT merchant feed / ACP, Oxylabs, Ahrefs Brand Radar API, G2 / Trustpilot APIs, LinkedIn Posts API, GitHub | Niche (e-commerce, review-heavy, developer clients) or a bought copy of data we measure ourselves | varies; Brand Radar $199 to $699 a month | medium | LATER |
| 15 | Gemini API grounding, direct | Measurement | $14 per 1,000 after 5,000 free a month | small | **NO**: the terms forbid storing and analysing grounded results (§2.1b) |
| 16 | Google Indexing API | Indexing | $0 | small | **NO**: job postings and livestreams only |
| 17 | Grounding with Bing Search (Azure) | Measurement | $14 per 1,000 | medium | **NO**: an Azure agent tool, not the Copilot product; SerpApi's Copilot route samples the real product |
| 18 | Reddit Data API, Medium, Substack, press wires, Qwoted / SourceBottle / HARO APIs, Exa, Tavily, Crunchbase, Capterra, Clutch, Apple Business Connect | Various | | | **NO** for now: no API, no commercial access, or no tie to an assistant we track. Reddit and the PR platforms stay as human steps; we already see Reddit threads AI cites through `cited_urls` and parse HARO digests in the mailbox |

### 3.1 Why these four are the MUSTs
- #1 and #2 are levers that cost almost nothing and run on keys we already hold. #1 turns "AI cites pages that don't name you" from our 20-question sample into the whole database's view of the topic (ChatGPT data is US-English only in LLM Mentions: `AI_VISIBILITY_SPEC.md` §9; Google AI Overview data covers all locations per DataForSEO's launch note, UNVERIFIED).
- #3 closes the one engine gap that matters for proof: Copilot is where Microsoft gives first-party citation counts, so agreement between our sampled Copilot rate and Bing AI Performance is evidence that our sampling is right everywhere else.
- #4 is the proof a client believes, and it is free; it only needs a monthly ask and the existing upload.

### 3.2 What the owner has to provide

| Item | For | Who |
|---|---|---|
| Yes to spend: DataForSEO `top_mentioned_pages` / `target_metrics` (about $0.40 per site per month) | #1 | owner (no new key; DataForSEO login is set) |
| A SerpApi account and API key (Starter $25 or Developer $75 a month; Production $150 if the owner wants SerpApi's Legal Shield) stored as a new n8n credential through `n8n/.env` + `sync_credentials.py` | #3 | owner |
| Nothing new for Bing (the key is set); each client verifies the site in Bing Webmaster Tools (import from Search Console works) | #2 | client |
| Each client exports Bing AI Performance and Search Console's generative AI report once a month (the app asks) | #4 | client |
| A written answer from DataForSEO on whether its `gemini/llm_responses` route is licensed for analysis | §2.1b | owner (support ticket) |
| For SHOULD items: nothing for #5 (Anthropic key set); a Google API key with YouTube Data API enabled (the PageSpeed project can hold it) for #8; a Brave Search API key for #10 (`INSTANCE_AI_BRAVE_SEARCH_API_KEY` is empty); per client, a Cloudflare read-only API token for #6 | SHOULD | owner / client |

### 3.3 Not to forget
- Every paid call above needs the owner's yes before the first run (programme rule).
- New endpoints' response shapes: probe DataForSEO's sandbox first, then confirm new request fields with one live call (the sandbox does not validate fields: `CLAUDE.md`).
- New paid HTTP nodes must not use n8n node-level retry (re-billing risk; `retry_lint.py`).
