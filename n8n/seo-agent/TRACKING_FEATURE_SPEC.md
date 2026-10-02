# Site tracking — feature spec (v4.3, 2026-10-02)

Goal: close the loop after content and ladders are live. Every week the owner sees, from their **own** Google data, what moved, why, and what to do next; the agent turns that into one-click work orders for itself. Rank checks alone (one SERP sample) are not enough: Search Console gives the real average position, impressions and clicks per query, GA4 gives visits and conversions, Trends says whether demand is growing.

## What the tracker reads

| Source | Auth | Cost | What we take |
|---|---|---|---|
| Google Search Console (Search Analytics API) | service account, read-only | free | last 28 complete days vs the 28 before and the same 28 days a year ago: clicks/impressions/CTR/position by day; top 500 query×page rows and top 100 pages for both periods; every tracked keyword as an exact query with its ranking page |
| Search Console URL Inspection API | same | free (2,000/day) | index status of every ladder page (verdict, coverage state, last crawl, canonical) |
| GA4 Data API (+ Admin API for detection) | same service account, Viewer | free | organic vs all-channel sessions / engaged sessions / key events / users for both periods, organic landing pages, organic sessions by day; the property is detected from the web data stream whose URL matches the domain |
| Google Trends (DataForSEO `keywords_data/google_trends/explore/live`) | DataForSEO | $0.011 per keyword (measured) | 12-month interest curve per head term (direction = last 4 weeks vs the year's average, peak), related top / rising searches |
| Google SERP (DataForSEO live, depth 50) | DataForSEO | ~$0.015 per keyword | live position for the site's own tracked keywords (ladder keywords are read from the Rank Tracker's history instead) |

Why a service account and not OAuth: no consent screen, no refresh token that expires after 7 days on an unverified app, one credential for every customer site. The owner adds the service-account e-mail as a user in Search Console (Full) and GA4 (Viewer); the first report tells them exactly that.

## What the tracker computes (Site Metrics)
- KPIs with deltas (period over period, year over year), daily series for later charts.
- Query movers: winners / losers (±30% and ±5 clicks), new (≥20 impressions), lost (≥5 clicks before).
- **Striking distance**: queries at positions 4–20 with ≥30 impressions — the cheapest wins; each becomes an action with a ready-to-send `mode: keyword` API body (`existing_page_url` = the page that already ranks).
- **CTR gaps**: top-10 queries with ≥100 impressions whose CTR is under half the expected rate for the position → title/meta rewrite.
- Page movers and **decaying pages** (clicks −25% with ≥10 clicks before) → refresh.
- Tracked keywords: Search Console average (and previous), live Google check, clicks, impressions, ranking page, 12-week position history.
- Ladder pages: indexed or not, coverage state, last crawl; "not indexed" on a written/existing page is a high alert and a priority-1 action.
- GA4: organic share, landing pages with deltas, key events.
- Trends: rising head terms → content ideas from the rising related searches (`mode: verdict` body); falling → do not over-invest.
- Alerts: clicks or organic sessions down ≥30%, impressions down ≥30%, page not indexed, canonical mismatch, tracked keyword slipped ≥5 places from the top 10, request failures, not connected (setup).
- Ranked actions (max 8) → the AI brief words them for the owner.

## Deliverables
- HTML e-mail: headline + summary (Claude Sonnet 5.5, ~$0.03 per site), alerts, "connect Google" box when needed, KPI tiles, "Do this week" with API bodies and the form link, tracked keywords, ladder index status, striking distance, CTR gaps, movers, pages, traffic, trends, watch list. The same document as a PDF attachment (Gotenberg).
- Callback (`stage: site_tracker`) with the full dataset and the PDF as base64.
- Data Tables: `seo_sites` (registry, upserted), `seo_site_metrics` (one row per site per run), `seo_query_history` (tracked keywords + top 100 queries per run), and `seo_rank_history` rows for the site's own keywords (ladder_id = site id).

## How sites get in
- Form option **"Track my site (rankings & traffic)"** / API `mode: "track"`: domain, country, optional search terms (≤20), optional GA4 property id, e-mail or callback. Registers the site and runs the tracker at once (first report in ~3 minutes), then every Monday 09:00.
- Every domain with a keyword ladder is tracked automatically (e-mail from the ladder), so the ladder's weekly rank e-mail (Monday 08:00) is followed by the performance report.
- Pause by setting `status` to `paused` in `seo_sites` (on-demand runs ignore the pause).

## Decisions
- Cadence weekly; 28-day windows ending 3 days ago (Search Console data is final after ~3 days). Monthly/YoY views come from the same run (year-ago totals) and from the stored history.
- Service account, not OAuth. Read-only scopes: `webmasters.readonly`, `analytics.readonly`.
- The tracker never fails on a missing connection: it runs with what it has (trends, live checks, ladder history) and explains the two connection steps.
- Caps per site per run: 40 tracked keywords, 30 exact-query requests, 20 inspections, 4 trend keywords, 20 live SERP checks; 25 sites per run.
- Everything deterministic is computed in Code nodes; the model only writes the brief. Model failure → the deterministic actions are shown.

## Implementation
`build_site_tracker.py` → `workflows/SEO_Agent_Site_Tracker.json` (`SEOagentSiteTrk1`, 63 nodes). Code in `v5/code/Site_*.js`, `Resolve_Properties.js`, `GSC_*.js`, `Parse_*.js`, `Stream_Requests.js`, `GA4_Requests.js`, `Inspect_Requests.js`, `Trends_Requests.js`, `Brief_Input.js`, `Build_Site_Callback.js`; prompt `v5/prompts/site_brief.txt`; tables in `ladder_common.py`. Main workflow: `build_v4.py` section 12 (form page, Normalize Input mode `track`, Route Mode output, `Site Row (Track)` → upsert → `Start Site Tracker` → completion / callback); API: `build_api.py`. Harness: `harness/fixtures_tracking.js`, scenario S10 in `scenarios_v5.js` (intake, plan incl. virtual ladder sites and pause, property resolution incl. denied and URL-prefix fallback, every parser, metrics rows with exact columns, report with and without the brief, callback bytes, the not-connected path). Samples: `harness/sample-output/site-tracker-email.html`, `site-tracker-email-not-connected.html`.

## Setup (once per n8n instance)
1. Google Cloud: create a project, enable **Google Search Console API** and **Google Analytics Data API** (+ **Analytics Admin API** for property detection), create a service account, download its JSON key.
2. n8n credential **Google Service Account (SEO Agent)** (id `SEOcredGoogleSvc`): e-mail + private key from the JSON, "Set up for use in HTTP Request node" on, scopes `https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly`. A placeholder with a throwaway key is installed so the workflow runs; replace it.
3. Put the service-account e-mail into `CONFIG.service_account_email` in *Site Plan* (Site Tracker) so the connect instructions name it.
4. Each site owner adds that e-mail in Search Console (Settings → Users and permissions → Full) and GA4 (Admin → Property access management → Viewer).

## Later
- Bing Webmaster Tools (API key) for the second engine; Google Business Profile insights for local sites.
- Charts in the PDF from the stored daily series; a hosted dashboard page per site reading `seo_site_metrics` / `seo_query_history`.
- Feed Search Console striking-distance queries into discovery and ladder planning (queries the site already earns impressions for are the best rung candidates).
- Auto-run the recommended `mode: keyword` improvement when `CONFIG.ladder_auto_next_rung` is on (today recommend-only, like the Rank Tracker).

## Content cadence and published pages (added 2026-10-02)
- **Blog package**: every content run also delivers `<slug>.html`, `<slug>.md` and `<slug>.meta.json` (title, H1, slug, suggested URL, meta description, keywords, headings, links, schema, word count, content score, publish checklist). The owner publishes in any framework.
- **Blogs per week** per site (0-3): "Track my site" field / API `blogs_per_week` → `seo_cadence`; Site Admin `cadence` to change. A site without a cadence row gets nothing written automatically; on-demand runs default to 1 page.
- **Content Cadence workflow** (Monday 10:00): topics in order ladder planned pages → striking-distance queries (strengthen the ranking page) → rising related searches; skips recent / written / brand; logs to `seo_content_log`; marks ladder rows writing; sends a note (this week, coming next, waiting for publish links).
- **"I published a page"**: live publish check, content log + ladder row updated with the real URL, link-from suggestions, then tracked (keyword as "blog", URL inspected) from the next Monday. Site Admin `unpublish` reverts.
- **Why not auto-publish**: the site can be any framework, and unreviewed AI pages published at scale fall under Google's scaled content abuse policy; a human publishes, the agent verifies.

## Search Console in the audit (added 2026-10-02)
Both audit types read `/sitemap.xml` (+3 child sitemaps) and, with the service account, Search Console: submitted sitemaps (errors, warnings, last read), 28-day search snapshot (totals, top pages/queries, pages shown but never clicked), URL inspection of up to 25 key pages (index coverage with reasons, robots blocks, Google-chosen canonicals, rich results). Findings go into *Crawlability & Indexing*; the report gets a "Search Console & Site Structure" section (clicks-from-home distribution, sections, sitemap vs crawl: indexable pages missing from the sitemap, sitemap-only URLs, non-200 sitemap URLs). Without access the audit still runs and lists Search Console under "Not assessed".

## What Search Console does not expose by API, and how it is covered (added 2026-10-02)
Manual actions, security issues, the site-wide Pages (index coverage) report, Core Web Vitals and rich-result issue reports have no API. Two routes: (1) **Console Alerts** — Google e-mails every user of the property; the agent's Gmail address is added as a user and an IMAP watcher turns those mails into typed alerts (critical ones e-mailed to the owner at once with fix steps); (2) **monthly check-in** — form / API `mode: checkin` with two questions and the Pages export upload, reminded in every Monday report until the month is covered. Both land in `seo_console_alerts` / `seo_console_checkins` and in the Monday report and brief.

## Images (added 2026-10-02)
Every page comes with an image plan of three images (hero + two in-body) with placement, purpose, subject, alt text, caption and file name, carried as placeholders in the article HTML/Markdown and as `images` / `featured_image` / `open_graph` in meta.json. The publish check verifies the live images (count, alt text, topic in alt, file names, dimensions, modern format, og:image). The audit already flags missing alt text, missing dimensions and missing social-share tags on existing pages.
