# Indexing & index health: external research (2026-10-29)

External research for the owner's brief (`OWNER_BRIEF.md`). Every source below was opened on **2026-10-29** unless a line says
otherwise. "Not verified" means I could not open a primary source. No code was changed.

## What this changes in the owner's document (corrections and confirmations)

1. **Confirmed:** URL Inspection API quota is **2,000 calls/day and 600/minute per property**, shared by every tool using that property (Sitebulb's docs warn of this). Plan the quota manager per property, not per customer.
2. **Correction:** inspecting a URL **does nothing to get it crawled**. The API returns "only the status of the version in the Google index"; it cannot run a live test and cannot request indexing. There is **no public API for "Request indexing"** (the API has 11 methods; none submits a URL).
3. **Correction:** "check a few hours after publish" buys little. Google's own docs: indexing is "never instant", sitemap processing ~24 h typical (Illyes, Oct 2026, second-hand). Day 1 / 3 / 7 / 14 is the useful cadence.
4. **Correction:** `coverageState` is a **free-text string**, not a documented enum. Map it defensively; the enums Google documents are `verdict`, `robotsTxtState`, `indexingState`, `pageFetchState`, `crawledAs`.
5. **Correction (scope + permission):** sitemap **submit** needs the `webmasters` scope (read-only is not enough) and an **owner** (Sitemaps report help) or **owner/full user** (permissions table). Read-only customers can only be told to add the sitemap to robots.txt.
6. **Correction:** **resubmitting an unchanged sitemap is not a signal**. Google: "let Google follow its regular crawling schedule"; resubmit only after big changes. The ping endpoint is dead (announced 26 Jun 2023, gone ~Dec 2023, now 404).
7. **Confirmed + sharper:** `lastmod` is used only if "consistently and verifiably" accurate; Google's helpful-content questions name **changing dates to look fresh** as a bad sign. Never touch lastmod without a real content change.
8. **Confirmed:** Indexing API = JobPosting / BroadcastEvent-in-VideoObject only; spam-screened; access revoked for abuse. Mueller (May 2026): "inundated by bloggers trying to act like legitimate sites". On **16 Oct 2026** Google removed the approval form from the docs; nothing says the scope widened.
9. **Mostly sound, with caveats:** "a page with impressions is indexed": impressions are credited to the **canonical** URL, data lags 2-3 days, ≤ 50k rows/day/search type, page grouping may drop rows. Use as "was indexed recently" for `type=web`, never "no impressions = not indexed".
10. **Correction (biggest):** "Crawled - not indexed (thin) -> AI rewrite / expansion" is **not** what Google says. Help: "may or may not be indexed in the future; no need to resubmit". Mueller (SOTR #112, 16 Jul 2026): it is often a **site-level quality** judgement; "anyone could have written this". Google has no preferred word count. Expanding text with AI at scale fits the *scaled content abuse* example almost word for word.
11. **Confirmed:** states that are **normal and should be left alone**: alternate page with proper canonical, page with redirect, intentional noindex / robots.txt, 404 for removed pages, duplicates working as intended. Google: "You should not expect all URLs on your site to be indexed".
12. **New:** Splitt/Mueller (Jul 2026): there is **no healthy index ratio**; Google's own developer docs site has ~5% of URLs indexed. The UI must not show "% indexed" as a health score.
13. **Correction:** pruning: Google's core-update doc says **"Deleting content is a last resort"** and warns against quick fixes; "remove/noindex" must stay an approval-only suggestion.
14. **Confirmed:** 301-merge is right for genuinely duplicate/replaced pages; many URLs redirected to one *irrelevant* page (e.g. home) may be treated as **soft 404**. Keep redirects ≥ 1 year.
15. **Confirmed (all six):** dashboard shows March 2026 spam (24-25 Mar), March 2026 core (27 Mar-8 Apr), May 2026 core (21 May-2 Jun), June 2026 spam (24-26 Jun), **August** 2026 spam (18-21 Aug) **and a separate September** 2026 spam (24 Sep-8 Oct).
16. **Different:** the spam policies page *was* last updated 2026-08-28, but that change was the **site reputation policy's EEA enforcement**. "Manipulating generative AI responses" was added on **15 May 2026**. Also missed: back button hijacking (13 Apr 2026, enforced from 15 Jun), Dec 2025 core, Feb 2026 Discover core.
17. **Confirmed feeds:** `https://status.search.google.com/incidents.json` (JSON list), `/products.json`, `/en/feed.atom` (Atom); Search Central blog RSS `https://developers.google.com/search/blog/feed.xml`.
18. **New (June 2026):** Google's page on third-party SEO tools says tools "can't guarantee performance" and warns about vendors implying Google approval. Our copy must say "help Google find and choose", never "get indexed".
19. **Market:** monitors (Screaming Frog, Sitebulb, JetOctopus, Botify) read URL Inspection within the same 2,000/day cap. Nobody found documented "diagnose by cause, then fix with approval" for existing pages. Indexer services (Rapid URL Indexer, Omega, IndexMeNow, Tag Parrot) hide their method.
20. **Not verified:** Indexing Insight's 130/190-day and "86% quality" studies (the vendor's Substack returned 404 today; only a slide deck opened); Illyes' Barcelona timings (second-hand recap); Ahrefs/Semrush index-status integrations (none found).

---

## A. Google APIs: exact facts

### A1. URL Inspection API
- **Endpoint:** `POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`. Body: `inspectionUrl` (required, must be under
  the property), `siteUrl` (required; URL-prefix with trailing `/`, or `sc-domain:example.com`), `languageCode` (optional, default en-US).
  Scopes: `webmasters` **or** `webmasters.readonly`.
  https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect
- **What it can't do:** "Presently only the status of the version in the Google index is available; you cannot test the indexability of a
  live URL." https://developers.google.com/webmaster-tools/v1/inspectionTools.index/inspect
- **Quota:** per site "2000 QPD" and "600 QPM"; per project 10,000,000 QPD / 15,000 QPM.
  https://developers.google.com/webmaster-tools/limits (also the launch post, 31 Jan 2022:
  https://developers.google.com/search/blog/2022/01/url-inspection-api)
- **The quota is shared:** every tool querying the same property draws from the same 2,000; when exhausted, wait 24 h (Sitebulb, 17 Oct 2024).
  https://support.sitebulb.com/en/articles/9857469-url-inspection-report
- **Extra properties = extra quota:** Screaming Frog documents "Use Multiple Properties" to inspect > 2k URLs/day when several properties
  are verified for the domain (e.g. subfolder URL-prefix properties). It is a vendor feature. Google's limit is stated "per site", so it is
  not forbidden. Use only properties the customer already owns; never create accounts to evade limits (the Indexing API explicitly calls
  that abuse). https://www.screamingfrog.co.uk/seo-spider/user-guide/configuration/
- **Response (`UrlInspectionResult`):** `inspectionResultLink`, `indexStatusResult`, `ampResult`, `mobileUsabilityResult` (**deprecated**),
  `richResultsResult`. https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult
- **`IndexStatusInspectionResult` fields:**
  - `verdict`: `VERDICT_UNSPECIFIED`, `PASS`, `PARTIAL` (reserved, no longer used), `FAIL`, `NEUTRAL`
  - `coverageState`: **string** ("Could Google find and index the page"), **no enum documented**
  - `robotsTxtState`: `ROBOTS_TXT_STATE_UNSPECIFIED`, `ALLOWED`, `DISALLOWED`
  - `indexingState`: `INDEXING_STATE_UNSPECIFIED`, `INDEXING_ALLOWED`, `BLOCKED_BY_META_TAG`, `BLOCKED_BY_HTTP_HEADER`,
    `BLOCKED_BY_ROBOTS_TXT` (reserved, no longer used)
  - `pageFetchState`: `PAGE_FETCH_STATE_UNSPECIFIED`, `SUCCESSFUL`, `SOFT_404`, `BLOCKED_ROBOTS_TXT`, `NOT_FOUND`, `ACCESS_DENIED`,
    `SERVER_ERROR`, `REDIRECT_ERROR`, `ACCESS_FORBIDDEN`, `BLOCKED_4XX`, `INTERNAL_CRAWL_ERROR`, `INVALID_URL`
  - `googleCanonical` (absent if not indexed), `userCanonical` (absent if none declared)
  - `lastCrawlTime` (RFC3339; absent if never crawled successfully)
  - `crawledAs`: `CRAWLING_USER_AGENT_UNSPECIFIED`, `DESKTOP`, `MOBILE`
  - `sitemap[]` (sitemaps listing the URL "as known to Google", "may not be exhaustive")
  - `referringUrls[]` (URLs linking to it, "directly or indirectly")
- **`coverageState` strings:** Google documents none. The UI's top-level states are "URL is on Google", "URL is on Google, but has issues",
  "URL is not on Google", "Page is not indexed: URL is unknown to Google"; Google notes "URL is on Google" does not guarantee appearing in
  results. https://support.google.com/webmasters/answer/9012289
  Values our own fixtures captured from live API calls: `Submitted and indexed`, `URL is unknown to Google`, `Duplicate, Google chose
  different canonical than user`, `Discovered - currently not indexed`, `Crawled - currently not indexed`
  (`n8n/seo-agent/harness/fixtures_tracking.js`, `fixtures_ra2.js`). They match the Page indexing report reason names (section B).
  **Rule for the build:** classify with `verdict` + the enums first, use `coverageState` as a label matched case-insensitively with
  hyphen/quote normalisation, and route any unknown string to "unclassified".
- **Does inspection count as "Request indexing"? No.** The UI's "Request indexing" is a separate action with its own daily limit
  ("Live tests and index requests also have separate per-property daily limits"; no number published).
  https://support.google.com/webmasters/answer/9012289
- **Is there an API for "Request indexing"? No.** The Search Console API has 11 methods: searchAnalytics.query; sitemaps delete/get/list/
  submit; sites add/delete/get/list; urlInspection.index.inspect (reference page last updated 2024-07-23). Nothing submits a URL.
  https://developers.google.com/webmaster-tools/v1/api_reference_index
- Google on recrawl requests: "Requesting a crawl does not guarantee that inclusion in search results will happen instantly or even at
  all"; "requesting a recrawl multiple times for the same URL won't get it crawled any faster". For many URLs: submit a sitemap.
  https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl (updated 2025-12-10)

### A2. Sitemaps (Search Console API)
- **submit:** `PUT https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}`, scope **`webmasters` only**.
  https://developers.google.com/webmaster-tools/v1/sitemaps/submit
- **list:** `GET …/sites/{siteUrl}/sitemaps` (optional `sitemapIndex`), scope `webmasters.readonly` or `webmasters`.
  https://developers.google.com/webmaster-tools/v1/sitemaps/list
- **Resource:** `lastSubmitted`, `lastDownloaded`, `isPending`, `isSitemapsIndex`, `errors`, `warnings`, `contents[].submitted`;
  **`contents[].indexed` is "Deprecated; do not use."** https://developers.google.com/webmaster-tools/v1/sitemaps
- **Permission:** the permissions table gives "Submit sitemap" to **Owner and Full user** (not Restricted).
  https://support.google.com/webmasters/answer/2453966. The Sitemaps report help says "You must have owner permissions on a property to
  submit a sitemap using the Sitemaps report", with robots.txt as the alternative. https://support.google.com/webmasters/answer/7451001
  **These two Google pages disagree; test with the customer's real role and fall back to "add it to robots.txt".**
- **Resubmitting:** with no critical updates, "let Google follow its regular crawling schedule"; "If you make big changes to a sitemap,
  you might want to resubmit". Google recrawls sitemaps "at a pace independent of the site crawl schedule". The report shows "Discovered
  pages", not indexed counts; "There is no guarantee that a page URL discovered in a sitemap has been or will be crawled or indexed".
  https://support.google.com/webmasters/answer/7451001
- "Submitting a sitemap is merely a hint." `<priority>` and `<changefreq>` are ignored. Google uses `<lastmod>` "if it's consistently and
  verifiably" accurate; it should reflect the last *significant* update (main content, structured data, links; a copyright year does not
  count). https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap (updated 2026-07-08)
- **Ping endpoint:** "Sitemaps ping endpoint is going away", Gary Illyes, **26 June 2023**: "the endpoint will stop functioning in 6
  months" and returns 404. Reason: "the vast majority of the submissions lead to spam". The post now says "The sitemaps ping endpoint
  deprecation is complete." lastmod must "consistently match reality".
  https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping

### A3. Indexing API (do not use for ordinary pages)
- "The Indexing API can only be used to crawl pages with either JobPosting or BroadcastEvent embedded in a VideoObject." "All
  submissions through the Indexing API undergo rigorous spam detection." Abuse, "including the use of multiple accounts or other means to
  exceed usage quotas", may get access revoked. Needs ownership verified in Search Console. Updated 2026-10-16.
  https://developers.google.com/search/apis/indexing-api/v3/quickstart
- "Our spam policies apply to content submitted with the Indexing API." "Don't circumvent our submission limits, such as by using multiple
  accounts." https://developers.google.com/search/apis/indexing-api/v3/using-api
- Default quota: 200 publish requests/day, 180 getMetadata/min, 380 requests/min across endpoints.
  https://developers.google.com/search/apis/indexing-api/v3/quota-pricing (updated 2026-10-16)
- **16 Oct 2026:** Google removed the approval form and the "request approval and quota" steps from the docs. The changelog says only that
  the quota page was updated "to document the current quota limits … and remove an outdated form". SEJ, 17 Oct 2026:
  https://www.searchenginejournal.com/google-indexing-api-docs-approval-form-removed/593292/ ; changelog:
  https://developers.google.com/search/updates
- John Mueller on Bluesky (reported 15 May 2026): "The indexing API is inundated by bloggers trying to act like legitimate sites."
  https://www.seroundtable.com/google-indexing-api-inundated-by-bloggers-41329.html (Bluesky post itself not opened)

### A4. Search Analytics API, and whether "impressions = indexed" is sound
- `POST …/sites/{siteUrl}/searchAnalytics/query`; dimensions country, device, page, query, searchAppearance, date, hour; `dataState`
  `final` (default) / `all` (fresh) / `hourly_all`; `rowLimit` 1-25,000 (default 1,000) + `startRow`; `type` web, image, video, news,
  discover, googleNews; `aggregationType` auto / byPage / byProperty / byNewsShowcasePanel; returns "top" rows, not all.
  https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- "a maximum of 50K rows of data per day per search type"; "Data is typically available after 2-3 days"; when grouping by page and/or
  query "our system may drop some data". https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data
- Anonymised queries are those not "issued by more than a few dozen users over a two-to-three month period". They have no row, are
  included in chart totals, and are omitted when a filter is applied (Waisberg, 19 Oct 2022).
  https://developers.google.com/search/blog/2022/10/performance-data-deep-dive
- Load limits: Search Analytics per-site 1,200 QPM; page+query grouping is the most expensive; on "quota exceeded" wait 15 minutes.
  https://developers.google.com/webmaster-tools/limits
- Hourly data in the API since April 2025 (blog index entry "The Search Analytics API now supports hourly data").
  https://developers.google.com/search/blog
- **Attribution:** "Click, impression, and position data for all variations of a page are assigned to the canonical URL", though "in some
  cases data might be assigned to the actual URL". In web results an impression counts if the link is on the results page, even unscrolled.
  https://support.google.com/webmasters/answer/7042828
- **Verdict on the rule:** sound **one way and time-boxed**: a URL with `type=web` impressions in the last ~28 days was indexed (as a
  canonical) at that time. It is **not** sound the other way: no impressions can mean indexed but never shown, a non-canonical duplicate
  credited to its canonical, rows dropped by limits, or data lag. Mueller says the same in SOTR #112 ("We see that important content also in
  the performance report"). Re-check excluded pages with URL Inspection on a slow cycle; pages can drop out.
- **2025-2026 additions (UI only; nothing new in the API reference):** custom annotations, Branded queries filter (Nov 2025), weekly/monthly
  views, social channels, AI-powered configuration (Dec 2025), Query groups in Insights (Oct 2025), the new Insights report (Jun 2025);
  **Search Generative AI performance reports** (3 Jun 2026; worldwide since 31 Aug 2026), web multimodal reporting (24 Sep 2026; UI filter +
  export; the post does not mention the API). https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports ,
  https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc . **There is no Page indexing / coverage export API.**
- **IndexNow does not reach Google:** participants listed are Amazon, Bing, Naver, Seznam.cz, Yandex, Yep (+ api.indexnow.org); max 10,000
  URLs per POST. https://www.indexnow.org/faq

## B. Each non-indexed state: cause and fix (Google's words)

Source for every row unless noted: Page indexing report help, https://support.google.com/webmasters/answer/7440203 (no update date shown).

| State (report name) | Google's explanation | Google's fix | Leave alone? |
|---|---|---|---|
| Server error (5xx) | server returned a 500-level error | check host status in Crawl Stats; server not down/overloaded/misconfigured; firewalls not blocking Googlebot | no |
| Redirect error | chain too long, loop, URL too long, bad/empty URL in chain | debug the redirect | no |
| URL blocked by robots.txt | blocked by robots.txt | to index: unblock; to keep out: remove the block **and** use noindex | yes if intended |
| URL marked 'noindex' | noindex directive found | remove tag/header, confirm with URL Inspection live test | yes if intended |
| Soft 404 | page looks like an error | real 404 for missing pages, or add content showing the page is valid | no |
| Blocked due to unauthorized request (401) | authorization requested | remove auth or allow verified Googlebot | yes if private |
| Blocked due to access forbidden (403) | Googlebot sends no credentials, so the server is wrong | allow unauthenticated access or verified Googlebot | no |
| URL blocked due to other 4xx issue | other 4xx | debug with URL Inspection | no |
| Not found (404) | 404 | fine for removed pages with no replacement; 301 if moved | **yes** for removed pages |
| Crawled - currently not indexed | crawled, not indexed | "It may or may not be indexed in the future; no need to resubmit this URL for crawling." **No fix given.** | often (see D) |
| Discovered - currently not indexed | found, not crawled yet; Google "rescheduled the crawl" to avoid overloading the site, hence no last crawl date | **No fix given.** | sometimes |
| Alternate page with proper canonical tag | alternate pointing at the indexed canonical | "no action is needed" | **yes** |
| Duplicate without user-selected canonical | duplicate, no canonical declared | working as intended; declare a canonical if Google chose wrong; make content substantially different if it is not a duplicate | usually |
| Duplicate, Google chose different canonical than user | Google indexed the page it considers canonical | compare Google-selected vs user-declared in URL Inspection | depends |
| Page with redirect | non-canonical URL that redirects | none; the target may be indexed | **yes** |
| Indexed, though blocked by robots.txt (warning) | indexed despite the block | to keep out: unblock + noindex | depends |
| Page indexed without content (warning) | Google could not read the content (e.g. cloaking, unsupported format) | inspect the page | no |

- Goal and expectations: "Your goal is to get the canonical version of every important page indexed"; "You should not expect all URLs on
  your site to be indexed, only the canonical pages". The example list is capped at 1,000 URLs. "Indexing is never instant", and it "can
  take some time (up to a few weeks)" before Google crawls some or all of a site. Validate fix takes "up to about two weeks"; do not click
  it again until it succeeds or fails; robots.txt blocks are "probably intentional". (same source)
- Duplicate clusters: "Even after fixing content issues, Google might hold pages in a duplicate cluster for up to two weeks."
  https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting (updated 2026-08-21)
- Canonical signals: redirects and rel=canonical are "strong"; sitemap inclusion is "weak". Do not use robots.txt or noindex for
  canonicalisation; use 301 only when deprecating a duplicate.
  https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls (updated 2026-07-10)
- Crawl budget guide applies to 1M+ pages (weekly changes), 10k+ (daily changes), or sites with a large share of "Discovered - currently
  not indexed". Budget = capacity limit + demand; demand depends on "size, update frequency, page quality, and relevance". "Eliminate
  duplicate content"; soft 404s "will continue to be crawled, and waste your budget"; Google reads sitemaps regularly.
  https://developers.google.com/crawling/docs/crawl-budget (updated 2026-07-22; the page has moved to developers.google.com/crawling)
- Internal links: "Every page you care about should have a link from at least one other page on your site". Only `<a href>` links are
  crawlable. Anchors should be "descriptive, reasonably concise, and relevant". No ideal link count: "if you think it's too much, then it
  probably is". https://developers.google.com/search/docs/crawling-indexing/links-crawlable (updated 2025-12-10)
- 4xx: "All 4xx errors, except 429, are treated the same"; previously used URLs that now return 4xx are dropped "over time", and crawl
  frequency "gradually decreases". https://developers.google.com/search/docs/crawling-indexing/http-network-errors (updated 2026-02-04)

**Normal, leave alone (never "fix"):** alternate with proper canonical; page with redirect; intentional noindex / robots.txt / 401 on
private areas; 404 on removed pages with no replacement; duplicate without user-selected canonical when Google picked the right one;
**any non-canonical URL**. The engine should only act on canonical URLs the customer marks (or we infer) as important.

## C. What the leaders do (2026)

| Product | Index status per URL | Diagnose | Auto-fix | Stated limits / price |
|---|---|---|---|---|
| Screaming Frog SEO Spider | Yes: URL Inspection API during a crawl (summary, coverage, last crawl, crawled as, crawl allowed, page fetch, indexing allowed, user vs Google canonical, rich results…) | crawl data beside it | no | "up to 2,000 URLs per property a day"; "Use Multiple Properties"; licence £199/yr (pricing page; whether the free version includes URL Inspection is not stated) |
| Sitebulb | Yes: URL Inspection report; checks the top 2,000 HTML URLs by internal-link "URL Rank" | charts (coverage, canonical, days since last crawl) | no | stops at the daily quota; Cloud from £95/month (FAQ) |
| JetOctopus | Yes: scheduled GSC inspection **alerts** (indexing / coverage / canonical / robots / days since crawl), several times a day to monthly (article 14 Jul 2023) | with logs + crawl | no | plans ≈ $349-$2,069/month listed; URL inspection limits not stated on pricing |
| Botify | URL Inspection report **per URL, on demand** (support, 2 Nov 2025); PageWorkers = JS tag for "instant and reversible" front-end changes (metadata, content), and claims to improve crawl budget | yes | PageWorkers changes are created/scheduled by teams, not automatic | no public price |
| Conductor Monitoring (ex-ContentKing) | indexability from its own 24/7 monitoring; robots.txt checked every 5 min; GSC integration shows clicks/impressions (index status not stated); "Real-time IndexNow" | alerts | no | not stated |
| Lumar | marketing page shows monitoring/alerts, "Protect" QA, AI dev tickets; **no index-status / URL Inspection found** | – | – | – |
| seoClarity | Bot Clarity = log analysis; **no URL Inspection integration found** | – | – | – |
| Ahrefs, Semrush | Site Audit indexability from **their own crawler**; **no Google index-status integration found** | – | – | – |
| Search Atlas OTTO | pixel/Cloudflare Worker edits titles, schema, canonical, links, content; "submits every changed URL for indexing right away, through Google Search Console Instant Indexing" + IndexNow | yes | **yes (auto)** | Growth $199/mo. **Which Google API sits behind "Instant Indexing" is not documented on the pages I opened; GSC has no public submit API besides sitemaps and the job/livestream-only Indexing API. Treat as a risk pattern we must not copy.** |
| Search Atlas Indexer | "routed through the fastest available indexing provider", automatic resubmission | – | – | providers not named |
| Rapid URL Indexer | "indexing signals", "100% safe"; method not named | – | – | $0.04-0.05/credit, refund if not indexed after 14 days; claims 91% |
| Omega Indexer | "pushes them to Google over a drip-feed"; method not named; aimed at links | – | – | $19/mo for 190 credits; refund if not indexed in 24 h |
| IndexMeNow | "combo spécial avec 3 méthodes", sent several times a day | – | – | €59/60 credits … €999/2,000; re-credited after 10 days |
| Tag Parrot | connect GSC (service account added as user per its own copy); "auto index"; mechanism not documented | – | – | 200-1,000 pages/day by plan, $11-129/mo (il.ly review, updated 24 Jan 2025) |
| IndexCheckr | checker only (two checks per URL, method not stated) + hand-off to indexers | – | – | $0.0075-0.0013 per check |

Sources: https://www.screamingfrog.co.uk/seo-spider/user-guide/configuration/ ; https://www.screamingfrog.co.uk/seo-spider/pricing/ ;
https://support.sitebulb.com/en/articles/9857469-url-inspection-report ; https://sitebulb.com/pricing/ ;
https://jetoctopus.com/how-to-set-up-gsc-inspection-alerts-step-by-step-guide/ ; https://jetoctopus.com/pricing/ ;
https://support.botify.com/en/articles/9585735-url-inspection-report-in-url-details ; https://www.botify.com/platform/activation/pageworkers ;
https://www.conductor.com/docs/monitoring.md ; https://www.lumar.io/platform/analyze/ ; https://searchatlas.com/otto-seo/ ;
https://searchatlas.com/indexer/ ; https://rapidurlindexer.com/ ; https://omegaindexer.com/ ; https://indexmenow.com/ ;
https://il.ly/blog/tagparrot ; https://www.indexcheckr.com/

- **Who uses the Indexing API against Google's rules?** No vendor I opened *says* it does. The pattern of a service account added to the
  customer's GSC, "auto index", and a daily per-account cap of 200 (= the Indexing API's default quota) matches the Indexing API (Tag
  Parrot; OTTO's "GSC Instant Indexing" is unexplained). That is **inference, not verified**. Mueller's May 2026 remark is aimed at that
  use. The search-engine-side risk is losing API access and spam policies applying to the submitted content (A3). Our rule: **never call
  the Indexing API for non-job, non-livestream pages, never sell "instant indexing", and never integrate a black-box indexer.**
- **Gap we can own:** monitors read status, but none of the pages I opened *diagnoses by cause and then proposes an owner-approved fix*
  for existing pages within the 2,000/day budget. OTTO auto-fixes, but through a script layer with an undocumented "indexing" claim.
- Google on vendors (5 Jun 2026): tools "don't have access to our internal ranking data. They can't guarantee performance"; "Google
  doesn't evaluate third-party services, so be wary of such claims". https://developers.google.com/search/docs/fundamentals/third-party-seo

## D. What actually moves "Crawled / Discovered - not indexed"

- **Google, primary (SOTR episode 112 "How to read the Indexing Report", 16 Jul 2026, transcript PDF read):**
  - Splitt: "discovered - currently not indexed" = "we know they exist, but we haven't actually visited them"; "crawled - currently not
    indexed" = "we visited them and we didn't put them in the index, and that can have all sorts of different reasons".
  - Mueller, asked if it signals quality: "Sometimes. So it's definitely the case if our systems are seriously worried about the quality
    of a website, that they will reduce the number of pages that they index … we'll probably crawl a lot less, we'll index a lot less. And
    then you'll see things like 'crawled not indexed' or 'discovered not indexed.'"
  - Mueller: "It's not that you need to fix this technical issue … when you recognize a bigger pattern like this … and there's no technical
    reason—you almost need to take a step back and think about the quality overall." On AI sites: "Anyone could have written this. This
    tells me nothing." "That's not to say that all AI-generated content is bad."
  - Splitt: "there's so much other stuff that is just as good. So why would we add it to the index?"
  - Mueller: quality is "not just the text"; Google takes "into account the full experience on a page" (ads, interstitials, filler).
  - Splitt: "there's no such thing as a ratio between indexed and non-indexed pages … it doesn't matter." Mueller: Google's developer
    documentation has "something like 5% of the pages … indexed … the important content is all indexed".
  https://search-off-the-record.libsyn.com/how-to-read-the-indexing-report ; transcript via goo.gle/sotr112-transcript
- **Google docs:** the Page indexing help gives no fix for either state, and says no need to resubmit (B). The crawl budget guide ties
  demand to quality and inventory (B). Ranking systems: "Site-wide signals and classifiers are also used". The helpful content system has
  been part of core ranking since March 2024. https://developers.google.com/search/docs/appearance/ranking-systems-guide (updated 2025-12-10)
- **Helpful-content self-assessment (updated 2026-10-05):** "Are you changing the date of pages to make them seem fresh when the content
  has not substantially changed?"; adding or removing a lot of content to seem fresh won't work; "Are you using extensive automation to
  produce content on many topics?"; preferred word count: "No, we don't."
  https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- **Therefore, for the decision engine:**
  - *Discovered, not indexed:* first make sure it is linked from a crawled, indexed page and listed in the sitemap with a true lastmod. A
    single canonical important page can get one manual "Request indexing" by the owner in the UI (the quota is small and unpublished).
    Many pages in this state with no technical cause = a site-quality or crawl-capacity signal: report it as a pattern, not per-URL work.
  - *Crawled, not indexed:* check duplication against the site's own pages and the SERP. Then improve with real, specific information
    (first-hand facts, data, examples) or consolidate (301 / canonical) or accept. **Not** word-count expansion or AI rewrites at scale.
- **Timing numbers:**
  - URL Inspection help: indexing "typically takes only a day or so, but can take much longer in some cases".
    https://support.google.com/webmasters/answer/9012289
  - Gary Illyes, Search Central Live Deep Dive Barcelona, 2 Oct 2026, via a community recap reported by SEJ (4 Oct 2026): discovery
    ~20 h typical (weeks to never); refresh ~30 d; sitemap processing ~24 h (up to 14 days or never); indexing ~1.5 h end to end (months
    or never, for quality); canonical change 1-3 weeks; core update recovery 3-6 months. **Second-hand; slides not published; "typical"
    undefined.** https://www.searchenginejournal.com/google-crawling-indexing-recovery-timing-ranges/
  - Core updates: some changes show "within days" but "it could take several months". Spam updates: improvement "over a period of months".
    https://developers.google.com/search/updates/core-updates ; https://developers.google.com/search/docs/appearance/spam-updates
- **Studies (vendor data, read with care):**
  - IndexCheckr "Insights from 16 Million Pages" (updated 28 Feb 2025): status counts sum to ~14.59M: 37.08% indexed, 61.94% page not
    indexed; average time to index 27.4 days (from when the tool started tracking); 21.29% of 310,705 pages later deindexed (7.97% by day
    30); of 33,930 pages pushed through indexing tools, 29.37% got indexed. The population is heavily backlink/third-party pages, so
    **not representative of a customer's own site**. https://indexcheckr.com/resources/google-indexing
  - Indexing Insight (Adam Gent): slide deck "How Google's Search Index Works" (23 Oct 2025) cites its own studies: "86% of not indexed
    pages are caused by 'quality' issues" (1.4M pages), "not crawled in 130 days … actively removed", a 190-day follow-up (18 sites).
    https://speakerdeck.com/aagent/how-googles-search-index-works . **The Substack articles returned HTTP 404 on 2026-10-29; sample details
    not verified.** Useful as a heuristic: `lastCrawlTime` older than ~130 days on an important page = risk flag.
  - Onely's "16% of valuable pages never indexed": only seen second-hand; **not verified**.
  - Ahrefs and Moz indexing studies: **none found/opened**.

## E. Google Search Status Dashboard and policy feeds

- **Machine-readable, confirmed by fetching:**
  - `https://status.search.google.com/incidents.json`: JSON array (9 entries on 2026-10-29, back to Dec 2025). Per incident: `id`,
    `number`, `begin`, `created`, `end` (ISO 8601 UTC), `modified`, `external_desc` (e.g. "September 2026 spam update"), `updates[]`
    {`created`,`modified`,`when`,`text`,`status`}, `most_recent_update`, `status_impact` (`SERVICE_INFORMATION` / `SERVICE_DISRUPTION`),
    `severity` (`low` / `medium`), `service_key`, `service_name`, `affected_products[]` {`title`,`id`}, `uri`. Update `status` values seen:
    `SERVICE_INFORMATION`, `SERVICE_DISRUPTION`, `AVAILABLE` (= rollout complete / fixed). Schema at `/incidents.schema.json`.
  - `https://status.search.google.com/products.json`: Crawling `QAVfsAEBQ159b2mEWBYF`, Indexing `DRyTdKyPd41QXD2hnncp`, Ranking
    `rGHU1u87FJnkP6W2GwMi`, Serving `pKUD9XkLn3TBLquSpQMD` (schema `/products.schema.json`).
  - Atom: `https://status.search.google.com/en/feed.atom` (also `/feed.atom`). Only the latest entry on 2026-10-29; times in the summary
    are US/Pacific. `/en/feed.rss` = 404. **Poll `incidents.json`, key on `id` + `modified`.** Watch the Indexing and Crawling products too:
    an indexing incident explains a sudden drop that is not the customer's fault.
- **Search Central blog:** RSS 2.0 at `https://developers.google.com/search/blog/feed.xml` (same as `/static/…/feed.xml`; the old
  FeedBurner `feeds.feedburner.com/blogspot/amDG` still mirrors it). About 10 latest items.
- **Documentation changelog:** https://developers.google.com/search/updates (HTML; no feed verified). It names doc changes by date and is
  the best "policy changed" trigger.
- **Owner's list vs the dashboard:**

| Owner's claim | Dashboard / docs | Status |
|---|---|---|
| March 2026 spam update | 2026-03-24 19:00 to 03-25 14:30 UTC | **confirmed** |
| March 2026 core update | 2026-03-27 09:00 UTC to 04-08 13:00 | **confirmed** |
| May 2026 core update | 2026-05-21 15:40 to 06-02 12:40 UTC | **confirmed** |
| June 2026 spam update | 2026-06-24 16:00 to 06-26 17:00 UTC | **confirmed** |
| "August/September 2026 spam" | **two** updates: August 2026 spam 08-18 16:27 to 08-21 08:49; September 2026 spam 09-24 16:15 to 10-08 08:00 UTC | **confirmed, two separate updates** |
| Spam policies page updated 28 Aug 2026 | page "Last updated 2026-08-28"; the change was the site reputation policy's EEA enforcement (blog 28 Aug 2026, effective 30 Aug) | **confirmed date, different content** |
| "Manipulating generative AI responses" added to spam | intro now covers attempts to manipulate "generative AI responses in Google Search"; changelog **15 May 2026** | **confirmed, different date** |
| (not listed) | December 2025 core (12-11 to 12-29); February 2026 Discover core (02-05 to 02-27, US English); Serving incident 2026-02-25 (15 min); back button hijacking policy (blog 13 Apr 2026, enforced from 15 Jun 2026) | **add** |

Sources: incidents.json / products.json / en/feed.atom fetched 2026-10-29; https://developers.google.com/search/updates ;
https://developers.google.com/search/blog/2026/08/update-site-reputation-policy ;
https://developers.google.com/search/blog/2026/04/back-button-hijacking

## F. Spam policies page (https://developers.google.com/search/docs/essentials/spam-policies, last updated 2026-08-28)

- **Sections, in order:** Cloaking; Doorway abuse; Expired domain abuse; Hacked content; Hidden text and link abuse; Keyword stuffing; Link
  spam; Machine-generated traffic; Malicious practices (now with back button hijacking); Misleading functionality; Scaled content abuse;
  Scraping; Site reputation policy; Sneaky redirects; Thin affiliation; User-generated spam; Other practices that can lead to demotion or
  removal (legal removals, personal information removals, policy circumvention, scam and fraud).
- **Intro:** spam is techniques "used to deceive users or manipulate our Search systems", including attempts to manipulate "generative AI
  responses in Google Search". Detection is by "automated systems and, as needed, human review"; violators "may rank lower in results or not
  appear in results at all".
- **Scaled content abuse:** "when many pages are generated for the primary purpose of manipulating search rankings": "large amounts of
  unoriginal content that provides little to no value to users", "no matter how it's created". Examples: "Using generative AI tools or other
  similar tools to generate many pages without adding value for users"; scraping feeds/search results; "automated transformations like
  synonymizing, translating, or other obfuscation techniques"; "Stitching or combining content from different web pages without adding
  value"; multiple sites to hide scale; keyword pages that make no sense.
- **Does it say AI use alone is not a violation?** Not in those words on this page. The test is value ("without adding value"), "no
  matter how it's created". Google's generative-AI guidance (updated 2026-10-01) says generating many pages "without adding value for users"
  may violate scaled content abuse. It tells creators to "manually factcheck and review all AI-generated content for accuracy" and cites
  rater-guideline 4.6.5 / 4.6.6 (little effort / originality / added value). The rater ratings "don't directly influence ranking".
  https://developers.google.com/search/docs/fundamentals/using-gen-ai-content . Mueller (Jul 2026): "not … all AI-generated content is bad".
- **New in 2026:** back button hijacking (13 Apr; enforced 15 Jun); spam reports may lead to manual actions (14 and 23 Apr); generative AI
  responses covered (15 May); site reputation EEA enforcement (28/30 Aug); UGC spam prevention guide updated (26 Oct). Changelog:
  https://developers.google.com/search/updates
- **Spam updates:** "Making changes may help a site improve if our automated systems learn over a period of months"; link-spam gains
  "cannot be regained". https://developers.google.com/search/docs/appearance/spam-updates (updated 2025-12-10)

## G. Risks of bulk changes, pruning, 301-merging

- **Bulk AI rewrites/expansions:** the scaled-content example above, plus "extensive automation to produce content on many topics" and "no
  preferred word count" in the self-assessment, make mass expansion of old pages the riskiest action in the brief. Keep it per page,
  human-approved, fact-checked, and only where the page has a real job. Google asks for disclosure of automation "when it would be
  reasonably expected". (F, D sources)
- **Pages that already perform:** "Avoid major changes to content that's already performing well" (after small drops); avoid "quick fix"
  changes. https://developers.google.com/search/updates/core-updates (updated 2025-12-10) → matches the owner's "pages that gained are never
  touched".
- **Core-update flow:** wait for the dashboard to mark the rollout complete, then "at least a full week after a core update completes
  before analyzing"; compare with the week before the rollout began; for big drops assess the whole site against the self-assessment
  questions. Recovery can take "several months", possibly until the next core update. (same source) → the owner's freeze-wait-compare
  flow is right; set the freeze to end ≥ 7 days after `end` in incidents.json.
- **Pruning (remove / noindex):** "Deleting content is a last resort", only if it can't be salvaged (core updates page). Removing lots of
  old content to look fresh "won't work" (helpful content). Google says non-indexed URLs "can be fine" and no ratio matters (B, D). A
  low-value page that Google already declines to index needs no action; recommend noindex/removal only for pages with no user purpose, by
  approval. Site-wide signals exist, so a large mass of unhelpful pages can weigh on the site (ranking systems guide). That is the only
  argument for pruning, and Google frames it as improve first.
- **noindex for crawl control:** do not use noindex to save crawl; Google still fetches the page (crawl budget guide). Use robots.txt for
  crawl control, noindex for index control, never both on the same URL when you want it de-indexed (Page indexing help).
- **301-merging:** permanent server-side redirects make the target canonical. Use 301 only "when you're sure that the redirect won't be
  reverted". https://developers.google.com/search/docs/crawling-indexing/301-redirects (updated 2026-04-14). Keep redirects "generally at
  least 1 year". Do not redirect "many old URLs to one irrelevant single URL destination, such as the home page" (may become soft 404);
  many-to-one is fine when the target consolidates their content. Expect fluctuation for weeks.
  https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes (updated 2026-08-20)
- **Mass internal links:** no Google rule beyond "if you think it's too much, then it probably is" and descriptive, relevant anchors
  (links-crawlable). Keyword-stuffed anchors would touch the keyword-stuffing policy. **No Google guidance found on "many changes at once"
  for content**; the site-move doc recommends moving small/medium sites at once and large sites in sections to monitor problems. Batching
  with a control group (as the brief's rollback plan implies) is our design choice, not a Google rule.
- **Large removal volumes:** with "a significant volume of removal requests" for a site (legal/personal-information removals), Google may
  "demote other content from the site". This does not apply to a site removing its own pages. (ranking systems guide)

## Not verified / open
- Exact `coverageState` vocabulary (Google publishes none; our fixtures show five values).
- The UI "Request indexing" daily number (unpublished).
- Indexing Insight study details (Substack 404 today); Onely 16%; any Ahrefs/Moz indexing study.
- Illyes' Oct 2026 timing table (community recap only).
- Which Google mechanism Search Atlas "GSC Instant Indexing" and Tag Parrot use (not documented on pages opened).
- Whether a Full user (vs Owner) can submit sitemaps via the API (two Google help pages disagree; test live).
- Whether the docs changelog has a feed.
