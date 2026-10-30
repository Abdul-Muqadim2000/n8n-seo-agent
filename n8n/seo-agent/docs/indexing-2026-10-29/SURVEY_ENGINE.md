# Indexing & index health: survey of the n8n engine (2026-10-29)

Read-only survey before building the "Indexing & index health" feature (owner brief: `OWNER_BRIEF.md` in this folder). Nothing was
edited, built, deployed or called. Paths are relative to `n8n/seo-agent/` unless they start with `app/` or `deploy/`. Line numbers of
`v5/code/*.js` are the SOURCE files; several nodes are patched further at build time by `build_v4.py` (the patch is cited where it
changes behaviour). Generated workflows (`workflows/*.json`) were read only to confirm wiring.

Contents: 1 URL Inspection · 2 page inventory · 3 Search Analytics per page · 4 submission (sitemaps, Bing, IndexNow) · 5 audit
findings on indexing · 6 refresh / rewrite paths · 7 Google update awareness · 8 autopilot, ledger, lints, harness, deploy ·
9 callbacks · 10 Gaps for the indexing feature · 11 Risks to existing features · 12 What was searched and not found.

---

## 1. Google Search Console URL Inspection

There are exactly **two** callers of `searchconsole.googleapis.com/v1/urlInspection/index:inspect`, plus one shared kit.

### 1.1 The shared kit `v5/code/_page_watch.js` (`PW`, inlined through `/*__PAGE_WATCH__*/`)
- Quota constants, `_page_watch.js:279-282`:
  ```js
  const QUOTA_PER_DAY = 2000;   // per property
  const QUOTA_PER_MINUTE = 600;
  const PER_RUN = 150;          // one weekly Site Tracker run, per property
  const PER_AUDIT = 100;        // one audit (also on demand)
  ```
- `PW.inspectBudget(pages, cap, {used, changed})` (`:288-305`): dedupes by host-agnostic key, orders **never inspected first, then
  oldest `inspect_at`**, weight breaks ties; optional `changed` (B5-8) puts pages we submitted / wrote in the last 7 days first;
  returns `take`, `skipped`, and a customer note. `limit = min(cap, QUOTA_PER_DAY - used)` but **no caller ever passes `used`**
  (grep: only `build_v4.py:3829`, a harness/debug path, passes it) — there is no per-property per-day counter anywhere.
- `PW.inspection(res)` (`:307-345`) maps one API answer to: `verdict` (PASS/…), `indexed` (= verdict PASS), `coverage`
  (= `indexStatusResult.coverageState`, the human string such as "Crawled - currently not indexed"), `indexing_state`, `robots`
  (`robotsTxtState`), `last_crawl`, `google_canonical`, `user_canonical`, `canonical_ok` (host-strict, R59), `canonical_host_only`,
  mobile (retired report => "not checked", R10), rich results. Errors are classified `quota` (`/quota|RESOURCE_EXHAUSTED|429/`),
  `access` (`/permission|403|invalid_grant/`) or `error`, each returned as **"not checked"**, never "not indexed".
  **Not read from the API answer:** `pageFetchState`, `crawledAs`, `sitemap[]`, `referringUrls[]`, `inspectionResultLink`.
- `PW.coverage(inspections)` (`:347-374`): counts checked / indexed / not indexed / `by_state` (per coverageState string) /
  canonical mismatch / not checked, plus the sentence "X of Y key pages are indexed … Z were not checked".

### 1.2 Caller A: the weekly Site Tracker rotation (`SEOagentSiteTrk1`)
- Wiring `build_site_tracker.py:269-275`: *Inspect Requests* → *Any Inspections?* → *Inspect URL* (HTTP POST, credential
  `SEOcredGoogleSvc`, batch 1 item / 150 ms ≈ 400/min, `neverError: true`, retry 3×5 s) → *Parse Inspection* → *Inspect Rows (Site)*
  → *Save Page Watch (Site)* (upsert `seo_page_watch` on `site_id + url`). *Load Page Watch (Site)* (`:187`) feeds the rotation order.
- Which URLs (`Inspect_Requests.js:20-41`), only for sites with `gsc_connected`, only URLs on the site's own host:
  | weight | source |
  |---|---|
  | 100 | home page (`SM.siteUrl(model,'/')`) |
  | 90 | ladder pages that exist/published + pages *Detect Published* found live this week |
  | 70 | menu pages (`model.nav_pages`) |
  | 25-65 | `seo_pages` rows with Search Console impressions (log-scaled) |
  | 50 | `seo_pages` rows from AI Growth (`source` starts `ai`) |
  | 15 | every other `seo_pages` row (sitemap pages etc.) |
  So the rotation already covers **every inventory URL** (up to 2,000 per site, see §2), not only key pages.
- How many: `cap = site.config.max_inspections || PW.PER_RUN` = **150 per site per weekly run** (`Site_Plan.js:20`,
  `Inspect_Requests.js:42-43`). `changed` is **not** passed here (only the audit passes it, `build_v4.py:8815`), so freshly
  published pages are first only because "never inspected" sorts first. Pages that answer 404 (`seo_pages.http_status`) are **not
  filtered out** of the rotation.
- No inspection retry here: *Inspect URL* is `neverError`, so a 4xx/5xx or "Internal error encountered" answer never trips
  `retryOnFail`; it becomes `inspect_error` "not checked" and the stored reading is kept (`Inspect_Rows_Site.js:15-32`). (The audit
  has a retry pass, §1.3; the Site Tracker does not.)
- Stored (`Inspect_Rows_Site.js:12-33`) on the page's `seo_page_watch` row: `inspect_at`, `index_state` (= verdict), `indexed`
  ('yes'/'no'/''), `coverage` (coverageState string), `google_canonical`, `last_crawl`, `mobile`, `rich_results`, `inspect_error`.
  A failed inspection keeps the previous answer; a page the budget did not reach is not written at all (`skipped` rows are dropped).
- Reported: *Site Metrics* builds `index_coverage = PW.coverage(...)` (`Site_Metrics.js:408-434`) and per-ladder-page rows
  `inspected / indexed / verdict / coverage / canonical_ok / inspect_error` (`Site_Metrics.js:88-111`); alerts "Page not indexed: <url>"
  (high, or info for a page detected this week) and "Google picked another canonical" (`Site_Metrics.js:138-143`). Goes into the weekly
  site report / PDF and callback stage `site_tracker`.

### 1.3 Caller B: every technical / full audit (main workflow `SEOagentV4Full01`, also the monthly Audit Scheduler)
- Wiring `build_v4.py:1419-1434`: *GSC Audit Plan* → sitemap fetch (+ children) → *GSC Sites (Audit)* → *GSC Audit Requests* →
  *GSC Audit?* → *GSC Audit Query* (same HTTP shape, `neverError`, batch 1/150 ms) + *GSC Sitemaps (Audit)* (GET sitemaps list) →
  *GSC Audit Findings*. Retry (R19, `build_v4.py:5484-5487`): *Inspect Retry Plan* (`Inspect_Retry_Plan.js`) → *Wait Before Inspect
  Retry* → *GSC Audit Query (Retry)* re-sends only `RT.google(...).retryable` failures, max 100; permission/quota not re-sent.
- Which URLs: only **crawled, indexable** pages (status 200, not redirect/broken, canonical self or absent; `GSC_Audit_Plan.js:16`),
  ranked home → click depth → inbound links, inspecting the canonical URL when it is on-domain (`:18-22`). Build patch
  `build_v4.py:3719-3729` replaces the old top-25 with `PW.inspectBudget(ranked, PW.PER_AUDIT)` = **up to 100**, and (`:8798-8815`,
  B5-8) passes `changed` so pages submitted/written this week go first. **Pages that are not indexable in the crawl, and known URLs
  the crawl never reached, are never inspected by the audit.**
- Requests per audit (`GSC_Audit_Requests.js:15-18`): Search Analytics totals, pages (rowLimit 200), queries (rowLimit 100), one
  inspection per sampled URL.
- Not stored per URL: the audit does **not** write `seo_page_watch` (only the Site Tracker and Page Watch write it). Per-URL results live
  only in the audit report / callback (`search_console.index_coverage.pages`, up to 100; `build_v4.py:3763-3769`) and in finding rows
  (`seo_audit_findings`, up to 5 `sample_urls`, `checked` = sample size).
- Findings from inspections (`GSC_Audit_Findings.js:88-104` + patch at `build_v4.py:3756-3760`): "A large share of important pages is not
  indexed by Google" (High, ≥20% of sample) / "Some sampled pages are not indexed" (Medium), "Important pages blocked by robots.txt"
  (High), "Google chose a different canonical URL than the page itself" (Medium), "Indexed pages that are not in the submitted sitemap"
  (Low, ≥3), "Google crawls important pages rarely" (Low, >60 days for ≥50%), mobile (only a FAIL with named issues). The fix text tells
  the customer to "request indexing" by hand in Search Console. `coverage` counts by coverageState string are shown; **no per-cause
  diagnosis or action beyond that text.**

### 1.4 Other inspection-adjacent readers / writers
- `seo_page_watch` (table, `ladder_common.py:373-382`): readers are *Load Page Watch (Site)* (rotation order) and the daily Page Watch
  (`Watch_Rows.js:22` carries the inspection columns forward unchanged), plus the app (`app/server/src/services/pageWatch.ts`, technical
  page, "I fixed this" re-check). **No engine decision (cadence, AI Growth, link builder, audit) reads `indexed` / `coverage`.**
- Publish detection (`Detect_Published.js:1-4`) and "I published a page" (`Publish_Check.js:169`) do NOT inspect; they defer to "the Site
  Tracker's next weekly report says whether Google indexed the page".
- Monthly Search Console check-in (`Parse_Checkin.js:1-2, 16-21`, mode `checkin`): the customer may paste the Pages report export —
  Table.csv (Reason / Source / Validation / Pages), a per-reason URL list (URL, Last crawled) or Chart.csv — stored as
  `seo_console_checkins.coverage_json` / `not_indexed_total` (`ladder_common.py:146`). Manual; the only path that sees the site-wide
  Pages report.
- Console Alerts (`SEOagentConsole1`, IMAP; only published when `SEO_IMAP_PASSWORD` is set — the IMAP credential was never created per
  CLAUDE.md): *Classify Notification* types Search Console mails matching `/not (being )?indexed|indexing issue|page indexing|coverage|
  reasons preventing/` as `kind: 'coverage'`, severity high (`v5/code/Classify_Notification.js`, wired at `build_site_tracker.py:687`). Stored in `seo_console_alerts`, callback stage `console_alert`.

---

## 2. The page inventory

### 2.1 `seo_pages` (`ladder_common.py:76-89`)
Columns: `site_id, url, title, h1, source, lastmod, queries_json, updated_at`, B4 perf `clicks, impressions, position, prev_clicks,
yoy_clicks, decay_state, decay_pct, decay_lost, decay_kind, decay_basis, measured_at`, RV-1 `http_status, status_at`. Upsert key
`site_id + url`. **No index state column** (that lives in `seo_page_watch`). `source` ∈ sitemap / gsc / detected / ai_pages.

### 2.2 Who fills it: only the weekly Site Tracker (job 4 of each site's cycle)
- *Page Inventory (Site)* (`Page_Inventory_Site.js`, cap `max_pages: 2000`, `:11`) merges (`:41-58`): the sitemap URLs + lastmod read
  by publish detection; Search Console pages and their queries (from *Parse GSC*, see §3 for the caps); pages detected live; titles/H1 the
  detection fetched; AI Growth key pages (`seo_ai_pages`); everything already stored ("a page that left the sitemap is still live until
  proven otherwise"); this run's `http_status`. Writes only new/changed rows via *Page Rows (Site)* → *Save Pages (Site)*
  (`build_site_tracker.py:293-296`).
- Sitemap reading (publish detection, `build_site_tracker.py:218-224`): `Publish_Candidates.js:51` always reads
  `<canonical host>/sitemap.xml` only (**robots.txt `Sitemap:` lines are not read**); a sitemap index is followed to **at most 5 child
  sitemaps**, newest lastmod first, tag/category/author/image/video last (`Sitemap_Children_Detect.js:4-17`). A large site's older
  child sitemaps are therefore never in the inventory.
- `http_status` (RV-1): *Status Targets (Site)* (`Status_Targets_Site.js:7-31`) reads, with one plain GET following redirects, only
  **Search Console pages that are NOT in the sitemap** (+ known 404/410 rows again), most impressions first, `per_site: 40, per_run: 120,
  recheck_days: 6`. A bot wall / 401/403/429 / no answer is not a status (`Page_Inventory_Site.js:22-24`). **Sitemap pages never get an
  http_status here.**
- `_gone.js` (GONE kit): `isGone` = 404/410 after redirects; `plan()` suggests the closest live page per dead URL; `finding()`,
  `action()`, `files()` (CSV / nginx / .htaccess redirect map). `SM.isGone` / `SM.gonePages` (`_site_model.js:170-173`) make every reader
  skip gone pages (`matchPage` never returns one, `:269`).
- `_site_model.js`: `SM.withPages` (`:327`), `SM.pageRows` (`:353`), `SM.matchPage/pageMatch` (`:307`), `SM.titleGap` (`:320`, R34
  untitled pages named), `SM.pageScore`. The site model itself (canonical host, nav pages, NAP…) is resolved weekly by *Site Model (Site)*.
- Sitemap fingerprints (`seo_cache` key `sitemap:<site_id>`) are written by the **Audit Scheduler** (`Audit_Sched_Plan.js:1-38`): URLs +
  lastmod hashed; decides whether the monthly audit re-crawls (changed / 60+ days / no readable sitemap). They are not a page list.

### 2.3 Other per-page readers that fetch pages
| Node (workflow, schedule) | What it fetches | Stored |
|---|---|---|
| *Detect Published* (Site Tracker, weekly) | sitemap + candidate pages' title/H1 for keyword drafts waiting to be published (`Detect_Published.js:7-53`) | `seo_content_log`, `seo_ladders` (published), inventory titles |
| *Publish Check* (main wf mode `published`; `SEOagentPubCheck` webhook) | one live page: status, noindex (meta + X-Robots-Tag, `Publish_Check.js:37,46`), title, canonical, schema … | content log / ladder row |
| Page Watch (`SEOagentPageWch1`, **daily 05:45**, own cron) | up to `max_watch_pages: 25` key pages per site + robots.txt, raw GET, no redirect follow (`Watch_Plan.js:8`, `build_site_tracker.py:736-740`) | `seo_page_watch` (status, noindex, canonical, title, robots_blocked, changes); alerts page_gone / noindex_added / robots_blocked / canonical_moved … (`_page_watch.js:111-123`) |
| *Not Crawled Targets/Hops/Check* (main wf, every audit) | up to 25 (max 50) known URLs the crawl never reached (sitemap ∪ GSC pages), plain GET, changed-first (`Not_Crawled_Targets.js:1-40`) | findings only: "Live, indexable pages the crawl never reached" (M), "…redirect somewhere else" (L), "…point their canonical at another page" (L), "…are set to noindex"; gone list → Fix Pack redirect map |
| AI Growth readiness (weekly job 5) | ≤40 key pages, ~12 a week (`Growth_Plan.js:18`) | `seo_ai_pages` (status, score, Bing state, submitted_at) |

False friends (searched, unrelated to indexing): `Find_Blocked_Pages.js` / `Blocked_Page_Items.js` = competitor pages that came back
bot-walled (Jina retry); `Own_Coverage_Run.js` = what the site already has on a keyword's topic (verdict path); `_coverage.js` (CVG) =
term coverage of a draft vs competitors.

---

## 3. Search Analytics per page

- Requests (`GSC_Requests.js:10-55`, Site Tracker, weekly): `by_date` (56 days), `yoy` totals, paged (25,000 rows/request, up to
  `max_gsc_pages` 4 = 100k rows per kind; `GSC_More_Requests.js`) `queries_cur` (query×page), `queries_prev`, `pages_cur`, `pages_prev`,
  **`pages_yoy`** (B4-1), device/country, Discover/News, preliminary `recent`, per-change before/after windows, tracked keywords.
  Ranges (`Site_Plan.js:77`): current = 28 final days, previous = the 28 before, yoy = same 28 days 364 days earlier.
- Decay (`Parse_GSC.js:95-113`, `_site_stats.js:81+` `ST.decay`): two-sample Poisson z-test on clicks (min 40 events, min 20%),
  impressions tested too (`kind` visibility vs clickthrough), yoy comparison to call a dip `seasonal`; states decaying / seasonal / watch
  / steady / too_small.
- What survives the run: *Parse GSC* returns `pages: pages.slice(0, 20)`, `queries: queries.slice(0, 100)` and `page_perf` (top **500**
  pages by clicks) (`Parse_GSC.js:109-110, 277`; confirmed in the generated Site Tracker). *Page Inventory* adds to `seo_pages` only the
  top-20 pages and the pages of the top-100 queries, and attaches `page_perf` measurements only to rows already in the inventory
  (`Page_Inventory_Site.js:44-49, 66-79`). So **the full set of URLs with impressions is read each week but not stored**; what is stored
  is a growing partial set (inventory rows accumulate week over week).
- `seo_query_history` (`ladder_common.py:94`, `Query_Rows.js:1`): every tracked keyword + top 100 queries per period, with `page`.
- `seo_site_metrics` (`ladder_common.py:90`): site totals per week (clicks, impressions, prev, yoy, sessions…), no per-page rows.
- Audit side: *GSC Audit Requests* reads only `pages` rowLimit **200** for 28 days (`GSC_Audit_Requests.js:16`); those 200 page keys join
  the sitemap as "known URLs" for crawl coverage (`GSC_Audit_Findings.js:72, 110-117`).
- Answer to "do we know per page which URLs had impressions?": **yes during the Site Tracker run (all rows, up to 100k), but persisted only
  partially** (top 20 + top-100-query pages + perf on existing inventory rows). A "pages with impressions are indexed, exclude them" filter
  would need either a new stored set or a re-read of `pages_cur` in the new workflow (free, Google quota).

---

## 4. Submission: sitemaps, Bing, IndexNow

- **Sitemap submission to Google (`PUT webmasters/v3/sites/{site}/sitemaps/{feedpath}`): not found.** The engine only LISTS submitted
  sitemaps (*GSC Sitemaps (Audit)* GET, `build_v4.py:1428`) and raises "No XML sitemap submitted to Search Console" (High) /
  errors / warnings / "not read for over a month" / pending (`GSC_Audit_Findings.js:50-61`), with "resubmit it in Search Console" as a
  manual fix.
- **OAuth scope:** `sync_credentials.py:20`
  `SCOPES = 'https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly'` for
  `SEOcredGoogleSvc` (also documented in `build_site_tracker.py:341`). The app's own Google client also asks `webmasters.readonly`
  (`app/server/src/services/google.ts:12`, `app/server/src/auth/google.ts:30`). `sitemaps.submit` needs the full
  `https://www.googleapis.com/auth/webmasters` scope, so the current credential **cannot** submit; the service account is added as a
  **Full** user in customer properties (CLAUDE.md), but the token scope is read-only. Changing the scope is a credential change shared by
  every Google call (Site Tracker, audit, GA4) — see Risks.
- **Google Indexing API (`indexing.googleapis.com`): not found** (correct: it is for JobPosting / livestream only).
- **Bing SubmitUrlBatch** (`Growth_Bing_Submit.js`, AI Growth, weekly job 5): URLs = pages published this week (content log), pages
  updated this week (`seo_ai_pages.updated_on`), key pages Bing has not crawled (re-sent after `resubmit_days: 30`), capped by Bing's
  `DailyQuota` and `submit_max: 50` (`Growth_Plan.js:18, 214-218`). Refused: robots.txt blocks Bingbot, or not KNOWN to answer 200 (RV-4;
  404 → "redirect it instead"). `dry_run` sends nothing. Follow-up `GetUrlInfo` on earlier submissions (B9-2).
- **IndexNow** (`Growth_IndexNow_Submit.js`): same `p.submit` list, only when the key file `https://<host>/<key>.txt` answers 200 with
  the key (key per site in `seo_cache indexnow:<site_id>`); refused when robots blocks every AI fetcher. Comments state correctly that
  Google does not take part and a submission is "notified, never indexed".
- So: **nothing in the engine tells Google about a URL** except the customer's own sitemap; the engine never writes or regenerates a
  sitemap, never changes `lastmod`, and the app's site tasks (`app/docs/SITE_TASKS.md`: `indexnow`, `ai_crawlers`, `redirect:<url>`)
  are the only "client does a step on their site, we verify it" loop.

---

## 5. Technical audit findings related to indexing

Where: main workflow, every technical/full audit (on demand, and monthly through the Audit Scheduler as cycle job `audit`, heavy).
Findings are built in *Build Site Issues* (inline code in `build_v4.py`, ~86 KB), *Analyze HTML*, *Analyze Probes*, *GSC Audit
Findings*, *Not Crawled Check*; ordered by `_impact.js` (IMP: severity × share × clicks/impressions × depth; `BLOCKER` regex
`_impact.js:12-14` puts no-longer-answer / noindex / not indexable / robots / broken / canonical issues first); stored one row per scored
finding in `seo_audit_findings` (`Finding_Rows.js`, key = category|title with numbers masked; `ladder_common.py:349-371`: `checked`,
`impact`, `recheck_*`, `evidence`, `sample_urls` ≤5, `check_version`).

| Cause | Finding title(s) (source) |
|---|---|
| noindex | "Crawled pages that are not indexable" (Build Site Issues); "Key pages carry a noindex tag" (Analyze HTML); "Known URLs outside the crawl are set to noindex" (Not Crawled Check); Page Watch `noindex_added` daily alert |
| robots.txt | "Important pages blocked by robots.txt" (GSC Audit Findings, from inspection `robotsTxtState`); Analyze Probes (5xx/blocked robots.txt); Page Watch `robots_blocked` / `robots_changed` |
| canonical | "Missing canonical tag", "Canonical points to a different page / to a redirect / to a broken URL", "Canonical chains", "Recursive canonical tags", "Conflicting canonical / alternate relations" (Build Site Issues); "Google chose a different canonical URL" (GSC); www / non-www split (R59) |
| redirects | "Redirect chains", "Redirect chains (2+ hops)", "Internal URLs that redirect", "Links pointing to redirects", "Meta refresh redirects"; "Known URLs outside the crawl redirect somewhere else" |
| 404 / 5xx | "Broken pages (4xx, 5xx or timeout)"; "Sitemap lists pages that do not return 200"; GONE finding (addresses Google still shows that no longer answer, with redirect targets) |
| orphan / discovery | "Orphan pages (no crawlable internal links)", "Few internal links pointing to the page", "Pages buried deep in the site (3+ clicks)", "Sitemap URLs that no internal link reaches", "Live, indexable pages the crawl never reached", "The crawl covered only part of the site" (G24) |
| sitemap | "Indexable pages missing from the XML sitemap", "Pages Google shows in search are missing from the sitemap", "sitemap.xml could not be read", "The XML sitemap contains no URLs", "No XML sitemap submitted to Search Console", sitemap errors/warnings/stale/pending |
| thin / duplicate | "Thin content (under 300 words)", "Light content (300-500 words)", "Very little text on the page", "Low text-to-HTML ratio", "Pages with duplicate content", "Duplicate page titles / meta descriptions across the site" |
| Google's verdict | "A large share of important pages is not indexed" / "Some sampled pages are not indexed", "Google crawls important pages rarely" |

Fix Pack (`Fix_Pack.js:1-20`): robots.txt edited (not rebuilt), llms.txt, redirect map (CSV + nginx + Apache) incl. gone URLs,
Organization/LocalBusiness schema, `internal-links.csv`, README; zipped; text in `fix_pack` of the callback. Nothing is applied to the
site by the engine. "I fixed this" (`recheck_state = requested`) → daily Page Watch answers only the rules in `PW.RULES`
(`_page_watch.js:167-186`: broken / redirecting / noindex / robots_blocked / title / description / H1 / canonical / http) on ≤25 key
pages; anything needing a crawl or Search Console waits for the next audit.

**Note on the join:** findings and inspection verdicts are never joined per URL into one cause. The "not indexed" finding lists URLs + the
coverageState string; the noindex/canonical/thin findings list their own URLs (≤5 samples stored). There is no URL-level cause record.

---

## 6. Content refresh / rewrite paths

- **Decay refresh** (Content Cadence `SEOagentCadence1`, cycle job 6): `Cadence_Plan.js:368-393` reads `seo_pages.decay_state ===
  'decaying'`, needs a top query for the page, max `decay_per_week: 2`, a page refreshed in the last `decay_refresh_days: 60` is left alone
  (`:94-99`), queued ahead of striking distance/trends. Sources by autopilot level (`:106`): level 1 ladder only; level 2 adds `decay`,
  `striking`, `ai_refresh` (in-topic only); level 3 adds `trend`, `ai_answer`. `Cadence_Plan.js` and `app/server/src/services/cadence.ts`
  must change together (CLAUDE.md).
- **AI refresh** targets (`seo_ai_targets`, AI Growth → cadence, `ai_pages_month` default 2).
- **How an existing page is rewritten:** the content run receives `existing_page_url` (Normalize Input, `build_v4.py:1099-1106,
  12644-12661`); *Client Page Requests* reads the live page; *Refresh Source Plan / Refresh Sources* (`Refresh_Source_Plan.js:1-15`,
  B3-8) fetch the sources the live page cites next to figures so Content QA re-checks them. Gates: Content QA, *Originality Check*
  (8-word shingles vs competitor + own pages read in the run; G5), the page pipeline kit `_page_fix.js` (PF: deterministic fixes,
  BLOCKING vs ADVISORY, section-targeted editor ≤3 rounds, `PF.deliver` ready / ready_with_questions / not_ready), Page Finalize
  (`SEOagentFinalize`, `POST /webhook/seo-page-finalize`, `Finalize_Verdict.js`) for the client's answers.
- **Delivery:** a draft package (article HTML + Markdown + meta.json, PDF/Word) in the content callback and `seo_content_log`
  (`existing_page_url` column). **The engine never writes to the customer's site.** The app's CMS publishing
  (`app/server/src/services/cms/`, connectors WordPress / Webflow / Contentful / signed webhook) can push it: it adopts an existing CMS
  item **by slug** (`service.ts:448-457`, `connectors/wordpress.ts:95`) and refuses to overwrite a live post with a "draft" unless an
  owner/admin chooses "Publish live" (`service.ts:459-464`). **No backup / revision / rollback** of the replaced content was found
  (grep `revision|backup|rollback|snapshot` in `app/server/src/services/cms`: nothing). The WordPress publisher sub-workflow in n8n
  (`SEOagentWordPres`) is inactive.
- So: yes, the engine can produce a rewrite of an EXISTING page today (decay / striking / AI refresh / any `existing_page_url` run);
  delivery is a draft, optionally pushed by the app to a connected CMS by slug; there is no side-by-side diff, no "reason = indexing", no
  before/after performance rollback.

---

## 7. Google update awareness

- Registry `v5/data/seo_events.json` (`_doc`, `updated: 2026-10-15`, 11 `google_updates`, 1 `data_breaks`), hand-maintained from the
  Search Status Dashboard ranking history (the `_doc` names the URL; build asserts it, `build_v4.py:8034-8043`). `seo_events.py` inlines
  it at BUILD time into `_annotations.js` (chart / report marks: *Site Metrics*, *Site Report*, *Tracker Report*, *LB_* nodes,
  *Brief Input*) and `_site_stats.js` (`UPDATES`, `:35`; `updateNote(range)` adds "a Google … update ran inside this period" as context,
  never a cause), and writes `app/shared/src/seo-events.generated.ts` (read by `app/shared/src/annotations.ts`).
- **No watcher** of the Search Status Dashboard, Search Central blog or the spam-policies page: searched `status.search.google`,
  `Search Status`, `incidents.json`, `search-status` in `v5/`, build scripts and `app/server/src` — only the `_doc` string and the build
  assertion. A new update reaches the product only when someone edits the JSON and rebuilds/deploys. Nothing freezes rewrites during an
  update.

---

## 8. Autopilot cycle, ledger, guards, lints, harness, deploy

### 8.1 Cycle Dispatcher (`SEOagentCycleDsp`, `v5/code/_cycle.js` + `Cycle_*.js`, `build_cycle.py`)
- Every website has its own 7-day cycle (`seo_cycles`, `seo_cycle_jobs`; `ladder_common.py:407-418`). Sweep every 5 min
  (`3-58/5 * * * *`) + *Instance Started* + manual *Cycle Run*. Jobs in order (`_cycle.js:27-38`): ai_visibility, backlinks,
  rank_tracker, **site_tracker**, ai_growth, content_cadence, link_builder, audit (heavy, monthly) + `preview` 48 h before. Contract
  mirrored in `app/shared/src/cycles.ts` `CYCLE_JOBS` (harness CY1 + build section 140 compare the two).
- Limits (`_cycle.js:41-60`): `max_starts: 2` per sweep, `max_inflight: 2` all websites together, one job of a website at a time,
  `max_attempts: 3`, `refusal_hours: 24`, `stale_hours: 2`, `max_open: 3`. Record-then-start (row written before the start, read back),
  idempotency key `cyc:<site_id>:<local date>`, ledger key `cycle:<cycle_key>:<job>`; a job is done when that ledger row settles.
- Mode switch (`Cycle_Plan.js:29-37`): `seo_cache` key `cycle:mode` = `{"mode":"start"}` starts jobs; anything else = `plan_only`
  (CLAUDE.md 2026-10-23: production dispatcher was plan_only at that time — check before relying on it).
- The weekly workflows have **no cron** any more (build section 98 fails the build if a Schedule Trigger comes back to them); they start
  through *Manual Run* with the cycle payload. Only AI Pulse (`30 6 * * *`) and Page Watch (05:45 daily) keep crons.

### 8.2 Schedule Catch-up (`SEOagentCatchUp1`, `build_catchup.py`, `_catchup.js`)
Now replays only the two daily crons and watches the dispatcher (alert if inactive / no sweep for 20 min). It discovers schedules from
the GENERATED workflows (`build_catchup.py:95-118`): a workflow with a Schedule Trigger must have exactly one trigger with one rule, one
Execute Workflow Trigger feeding the same first node, an entry in `harness/ledger_wiring.json` (monitors), and read `dry_run` where
listed. **A new workflow with its own cron is picked up automatically and must satisfy all of that.**

### 8.3 Run ledger + run guard
- `seo_run_ledger` (`ladder_common.py:452+`): `run_id, key, mode, est_usd, created_at, status (reserved|done|refused|stale), settled_usd,
  domain, heavy, dfs_usd, ai_usd, measured_usd, estimated_usd, cost_mode, dfs_balance …`.
- Every scheduled workflow carries the chain from `ledger_nodes()` (`build_site_tracker.py:24-60`; monitors in `build_monitors.py`):
  *Ensure Run Ledger (tag)* → *Run Ledger Row* → (*DFS Balance*) → *Reserve Run Ledger* → resume, and *Ledger Settle* → *Settle Run
  Ledger* at every end. `ladder_common.ledger_mainline()` (`:721+`) moves the reserve onto the main path at write time (R17) and needs a
  workflow's Claude nodes (`__AI_NODES__`); `no_dfs` replaces the balance probe for a workflow with no DataForSEO.
- `_run_guard.js` (RG): `STALE_HOURS 2`, `MAX_OPEN 3` other live reservations; refuses a second heavy crawl of the same site; refuses
  when the DataForSEO balance cannot cover the reservation; never refuses a scheduled run for the AI/DFS budget (owner decision);
  parent/child via `parent:<id>` key (R77).
- Build section 55 proves the order (no paid node reachable before *Reserve Run Ledger*) and **hard-codes the count**:
  `assert checked55 == 13` (`build_v4.py:5253`). A new workflow with a ledger chain must update that number and the wiring list.

### 8.4 The four invariant lints (all walk the GENERATED workflows; `docs/system-review-2026-10-14/INVARIANTS.md`)
| Lint | Rule | What a new workflow must do |
|---|---|---|
| `retry_lint.py` | 3: one retry rule | every external `httpRequest` node `retryOnFail: true, maxTries: 3, waitBetweenTries: 5000` (`RETRY`), unless on `ALLOW` (callback POSTs, CMS writes are not idempotent → not retried). `check_in200` ratchet: every DataForSEO node through the in-200 gate (`harness/in200_baseline.json`); a non-DFS error inside HTTP 200 (Google "Internal error") needs a code-level retry like *Inspect Retry Plan* |
| `gate_lint.py` | 2: gate on the way in and out | a Code node that reads `seo_ladders` (fit gate `fitStored(` / `FITR.rungs(`), `seo_backlinks` (`LK.footprints`) or `seo_link_prospects` / `seo_link_outreach` (`OK.sellsSame`) through a loader must call the read gate; baseline `harness/gate_pairs_baseline.json` may not grow |
| `lineage_lint.py` | 1: measured / modelled / not available | a node that composes a customer document carries `_lineage.js` and lets `lineage` travel; findings run through `LN.evidenced` (no empty evidence); deltas guard `report_type` and sample size (R19/R20); scores have a withheld path; readers of `<X> Answers` say "could not be read" |
| `state_lint.py` | 4: nothing promised until it exists / delivered | forward states (`written`, `published`, a future `indexed`/`fixed`?) only with evidence (`publishedRows()` must be handed proof); a `writing`-type state needs a way back with a reason (tables derived from workflows); `delivered` only after judging a status code; no delivery POST `neverError` without `fullResponse`; a workflow that opens a delivery record settles it; verdict fields set together (`harness/rule4_baseline.json` ratchet) |
Also run at build: `url_lint.py` (no `'https://' + domain`), secret scanner (webhooks, `sk-ant-`, `AIza`, private keys), section 98
(no cron on cycle workflows), build exits non-zero on any assert (check the exit code; `--no-env` refused without `n8n/.env`).

### 8.5 Harness
`harness/README.md`: `scenarios_v5.js` (19,727 lines) runs Code nodes in Node against fixtures, mocks `$input`, `$('Node')`,
static data; code from `harness/code_v4/` (regenerated by the builds); per-workflow wiring JSONs (`page_watch_wiring.json`,
`cycle_wiring.json`, `ledger_wiring.json`…); must end `0 failed` (exits 1 on any failure). Per CLAUDE.md the laptop n8n is stopped, so
the harness runs in a throwaway `n8nio/n8n:2.41.4` container. The harness shadows `URL` and mimics the sandbox's no-op
`Object.defineProperty`/`setPrototypeOf` and missing `structuredClone`. Relevant existing scenarios: S26 (publish detection), S40 (page
inventory), S53 (Page Watch + URL Inspection rotation G11/G25), S66 (R18/R19/R24: inspection retry, sample said out loud), CY1 (cycle contract), S126-S129/S150-S152
(catch-up).

### 8.6 Deploy manifest (`deploy_manifest.json`)
Keys `workflows` (files to import), `publish` (ids to activate; 26 today), `publish_when_imap` (`SEOagentConsole1`), `never_deploy`
(`SEOagentCallback`, `SEOagentTestRun1`). Read by `apply_env.py` (local) and `n8n/deploy/release.mjs`; production deploy is
`deploy/gcp/deploy_engine.py` over `tunnel.sh` (runs `sync_tables.py` before PUTting workflows — build asserts that order,
`build_v4.py:12920`). A new workflow must be added to `workflows` and `publish` (sub-workflows called by Execute Workflow must be
published in n8n 2.x), and new Data Table columns must be in `ladder_common.py` (Ensure nodes never add columns).

---

## 9. Callbacks to the app (pages / indexing)

- Delivery: each workflow posts its own JSON to the site's `callback_url` = `<app>/api/hooks/n8n/<company hook token>`
  (`app/server/src/services/runs.ts:711` `ingestCallback`; `stageOf(body)`). Callback POST nodes are on retry_lint's `ALLOW` (not
  retried; the app's failure watcher catches a missing one). Scheduled stages are listed in `app/shared/src/constants.ts:320`
  `SCHEDULED_STAGES` (`site_tracker, rank_tracker, content_cadence, console_alert, ai_visibility, ai_pulse, ai_growth, backlinks,
  link_builder, site_audit`); report rendering per stage; `REPORT_STAGES` / `INTERIM_STAGES` in `shared/src/report-delivery.ts:185-196`.
  `isScheduledCallback` (`runs.ts:652`) also accepts `trigger: 'cycle'` / cycle request ids.
- Stages carrying index data today: `site_tracker` (`Site_Report.js`; `index_coverage`, ladder page index rows, "Page not indexed"
  alerts, inventory/gone/status_check), `site_audit` / audit report (`search_console.index_coverage`, sitemaps, coverage counts,
  findings), `page_watch` (`Watch_Compare.js`; constant `ScheduleId 'page_watch'`, `shared/src/constants.ts:578-588`; alerts typed
  `page_watch` in `shared/src/integrations.ts:175`), `console_alert` (kind `coverage`), `console_checkin`, `published`.
- The app also reads Data Tables directly through the n8n public API: `seo_page_watch` (`app/server/src/services/pageWatch.ts`, types
  `IndexCoverage`, `PageWatch`, `WATCH_STALE_DAYS 2`), and writes `seo_audit_findings.recheck_state`.
- A new workflow therefore needs: a stage name added to `SCHEDULED_STAGES` (or the cycle request id), `STAGE_LABELS`, a renderer, and
  the report-delivery rules; or the app reads a new Data Table through the public API as it does for `seo_page_watch`.

---

## 10. Gaps for the indexing feature

**(a) Find every non-indexed page, old and new**
1. No complete URL universe: the sitemap read stops at `/sitemap.xml` + 5 child sitemaps; robots.txt `Sitemap:` lines are not read;
   the Search Analytics page set is read weekly but only partly stored (top 20 + top-100-query pages + perf on existing rows); the
   crawl reaches ≤200-1000 pages; inventory capped at 2,000/site; no "previously published URLs" list beyond `seo_content_log`.
2. No quota manager across workflows: `PW.inspectBudget` takes `used` but nobody passes it; the Site Tracker spends ≤150/site/week, the
   audit ≤100 per run, independently; there is no daily counter per property, no LIVE/BACKLOG split, no "day 0 / day 3 / day 7"
   schedule for new pages (new pages wait for the next weekly Site Tracker).
3. At 150/week a 2,000-page site takes ~13 weeks per rotation; 404 pages are inspected with the rest (not filtered by `http_status`).
4. The audit never inspects non-indexable or not-crawled URLs, and does not store its inspections per URL.
5. "Pages with impressions are indexed" (owner's exclusion rule) is not computed anywhere.

**(b) Diagnose each cause**
6. `coverageState` is stored as a free string; it is not mapped to a cause enum (Crawled - not indexed / Discovered - not indexed /
   Excluded by noindex / Blocked by robots / Alternate with proper canonical / Duplicate, Google chose different canonical / Not found
   (404) / Soft 404 / Redirect / Server error / Page with redirect / URL is unknown to Google …).
7. `pageFetchState`, `crawledAs`, `sitemap[]`, `referringUrls[]` of the inspection answer are dropped, so "not in any sitemap" and
   "no referring URL (orphan)" cannot be proven per URL from Google's own answer.
8. No per-URL join of Google's verdict with our own evidence (raw fetch status, noindex, canonical, word count, internal inlinks,
   in sitemap, impressions). Those signals exist in different places (Page Watch row ≤25 key pages, audit crawl, `seo_pages`) and
   for different URL subsets.
9. No grouping by root cause / template (path pattern); `content_groups_json` (regex groups per site) exists and could be reused.

**(c) Act per cause**
10. Sitemap resubmission impossible with the current scope (`webmasters.readonly`); no sitemap generation / lastmod.
11. No internal-link insertion on existing pages (only `internal-links.csv` in the Fix Pack and link suggestions in Publish Check).
12. Rewrite exists (decay / AI refresh / `existing_page_url`) but has no `reason: indexing`, no thin/duplicate-specific brief, no
    "merge with 301" or "recommend noindex" path, no approval diff, no backup or rollback of the replaced CMS content.
13. Redirect/robots/noindex fixes are delivered as files (Fix Pack) or app site tasks (`indexnow`, `ai_crawlers`, `redirect:<url>`) —
    the site-task model (client does it, we check, reopen on regression) is the natural carrier but has no indexing kinds.
14. No cooldown per URL, no max-retries → "needs manual review" state, no Auto/Approval/Off per action.

**(d) Re-verify**
15. Re-inspection happens only by rotation order; there is no "re-inspect this URL N days after its fix / resubmission".
    `recheck_state` (G11) only covers raw-fetch rules on ≤25 key pages.

**(e) Watch indexed pages dropping out**
16. Inspection history is not kept: `seo_page_watch` holds only the latest reading (upsert), so "was indexed, now not" is visible only
    if the comparison is made at write time — *Inspect Rows (Site)* does not compare, and no alert is raised on PASS→not PASS for
    non-ladder pages (Site Metrics alerts only on ladder/published pages).
17. No per-page performance-drop watch vs a 28-day baseline beyond decay (decay needs ≥40 click events, so low-traffic pages are
    `too_small`); no impressions-to-zero signal per page.
18. No Search Status Dashboard watcher; `seo_events.json` is manual; no update freeze/compare flow; no "pages that gained are never
    touched" guard on rewrites (decay only picks decaying pages, which partly covers it).

---

## 11. Risks to existing features

1. **URL Inspection quota is per property and shared** by the Site Tracker (≤150/run), every audit (≤100 + retries ≤100, on demand
   several a day), and anything new. Nothing counts across runs. A backlog lane using ~1,400/day must own a shared per-property daily
   counter (e.g. in `seo_cache` or a new table) that the existing callers also respect, or the existing reports will start printing
   "quota used up: not checked" (`_page_watch.js:317-319`).
2. **Per-minute quota (600/property):** each caller runs ~400/min (batch 1 / 150 ms). Two callers on one property at once (an on-demand
   audit during the Site Tracker or a new worker) can exceed 600/min.
3. **`seo_page_watch` has two writers already** (Page Watch daily, Site Tracker weekly) upserting on `site_id + url` with
   carry-forward of the other's columns (`Inspect_Rows_Site.js:17-22`, `Watch_Rows.js:22`). A third writer must carry every column
   forward the same way or it will blank the other's fields; the app reads this table directly. A separate table is safer.
4. **Rotation order:** the Site Tracker orders by `inspect_at`; if a new workflow writes `inspect_at` on the same rows, the weekly
   rotation will skip those URLs (fine) but its weekly report's "X of Y key pages indexed" will then depend on the new workflow.
5. **OAuth scope change** (`webmasters.readonly` → `webmasters`) touches the one credential `SEOcredGoogleSvc` used by the Site
   Tracker, audits, GA4 (scopes are one string, `sync_credentials.py:20`); a typo or a token-cache issue breaks every Google read. It is
   also a write permission on every customer property the account is a Full user of — the security review and the customers' consent
   matter. Consider a second credential for writes.
6. **n8n capacity:** production is a 4 GB spot e2-medium with `N8N_CONCURRENCY_PRODUCTION_LIMIT=4` (`deploy/gcp/compose.prod.yml:152`;
   it does not throttle sub-workflows). The dispatcher keeps `max_inflight: 2` and the run guard `MAX_OPEN: 3`; two 200-page audits at
   once already killed the task runner once (P34-5). A new job must go through the run guard / ledger (and be heavy-aware if it fetches
   many pages), or join the cycle as a job.
7. **Ledger & build asserts:** a new workflow with a ledger chain changes `checked55 == 13` (`build_v4.py:5253`), `ledger_wiring.json`,
   possibly `cycles.ts` + `_cycle.js` JOBS (contract test CY1) and the catch-up's schedule list if it has a cron. A job added to the cycle
   changes every site's week (the dispatcher starts jobs one after the other per site).
8. **Spend:** inspection and sitemap submission are free (Google quota), raw GETs are free; any Claude rewrite or DataForSEO call must
   reserve in the ledger and respect the DataForSEO balance guard. Rewrites must not double-spend with the cadence's decay / AI refresh
   for the same URL (the cadence's 60-day `decay_refresh_days` window reads `seo_content_log.existing_page_url`; a rewrite outside the
   content log would be invisible to it, and vice versa). Pile-up guard (written-unpublished pages) also counts content-log rows.
9. **IndexNow / Bing:** AI Growth already submits new/updated pages weekly with its own rules (only 200-answering, robots-checked).
   A second submitter would double-submit and confuse its `submitted_at` follow-up; reuse its path or its table.
10. **Customer messaging rules:** "not checked" is never "fine" nor "not indexed" (R10/G25); figures carry lineage (rule 1); a
    submission is "notified", never "indexed" (B9-1); a page gone (404) must not be inspected/advised like a live one (RV-1). The
    owner's "no guaranteed indexing" fits these rules.
11. **Dispatcher mode:** with `cycle:mode` = plan_only nothing scheduled starts; a feature that relies on the cycle does nothing in
    production until the owner flips it. Monday 07:00-12:00 New York deploy refusal and "never restart n8n while weekly runs are due"
    still apply to deploys.
12. **CMS writes are not idempotent** (retry_lint ALLOW) and the app has no rollback of a replaced live post: any automated rewrite push
    needs an app-side backup before it can promise one-click rollback.

---

## 12. Searched and not found

| Looked for | Where | Result |
|---|---|---|
| `sitemaps.submit` / `PUT …/sitemaps/` | `v5/code/*.js`, `build_*.py`, `app/server/src` | not found (only GET of the sitemap list) |
| full `auth/webmasters` scope | `sync_credentials.py`, app google services | not found (readonly everywhere) |
| `indexing.googleapis.com` / Indexing API | same | not found |
| a per-property daily inspection counter (`used:` passed to `inspectBudget`) | `v5/code`, builds | not found (only a harness/debug path) |
| inspection history table / PASS→FAIL alert for any page | `ladder_common.py`, Site Tracker, Page Watch | not found (latest reading only; alerts for ladder/published pages) |
| `pageFetchState`, `crawledAs`, `referringUrls`, `inspectionResultLink` | `_page_watch.js`, `GSC_Audit_Findings.js` | not read |
| robots.txt `Sitemap:` discovery | `Publish_Candidates.js`, `GSC_Audit_Plan.js`, `Audit_Sched_Plan.js` | not found (fixed `/sitemap.xml`) |
| Search Status Dashboard watcher | `v5/`, builds, `app/server/src` | not found (manual JSON registry) |
| CMS revision / backup / rollback | `app/server/src/services/cms` | not found |
| internal-link insertion into existing pages | `v5/code`, app CMS | not found (CSV suggestions only) |
| any engine reader of `seo_page_watch.indexed/coverage` for decisions | all generated workflows (Data Table nodes on `seo_page_watch`) | only Site Tracker (rotation order) and Page Watch (carry-forward); app reads it for display |
