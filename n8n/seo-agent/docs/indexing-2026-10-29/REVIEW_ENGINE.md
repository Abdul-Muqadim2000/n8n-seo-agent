# Index coverage engine: adversarial review (2026-10-29)

Scope: branch `feature/indexing` (worktree `n8n_devaicon-indexing`), engine half only: `build_index_coverage.py`, `v5/code/_index_kit.js`,
`v5/code/IX_*.js`, `ladder_common.py`, `Admin_Action.js` / `Monitor_Row_Admin.js` / `Monitor_Row_Track.js`, `build_catchup.py`, the generated
`workflows/SEO_Agent_Index_Coverage.json`, `harness/scenarios_index.js`. Read-only on source; nothing deployed, no paid API called.

How it was checked: the offline harness in a copy (`ONLY_S='^IX'`: **520 passed, 0 failed**), then throwaway probe scripts that load the
GENERATED kit code from the copy's `harness/code_v4/Index_Diagnose.js` (the way `scenarios_index.js` does) and replay crafted inputs in the
`n8nio/n8n:2.41.4` container's Node. Probe outputs are quoted under each finding. Line numbers are in `v5/code/`.

Severity: High = wrong advice to the client, data loss, production impact or security; Medium; Low. "Suspected" = mechanism read in the code,
trigger not proven offline.

## Findings

### E1 (High) A partly read sitemap tree tells the client to add pages to a sitemap that already lists them
- Where: `_index_kit.js:381` / `:398` (`in_sitemap: sm.read ? !!p._insm : …`), `:412` (search flip to `indexed_not_in_sitemap` when `sm.read`),
  `:305` (`diagnose`: `c.sitemap_read !== false && c.has_sitemap`), `IX_Inventory.js:37` (`read: st.read > 0`), `IX_Diagnose.js:36`.
- Failure: "a failed sitemap read never turns pages into not in the sitemap" holds only when EVERY sitemap fails. One child that times out /
  answers 5xx, a `.gz` child, the 5,000-URL cap (`sitemapAccept:121`), the 50-sitemap cap, or a 4th level of nesting (only 3 rounds) leaves
  `read > 0`, so every page those sitemaps list becomes `in_sitemap = false`: indexed pages get `indexed_not_in_sitemap` (site_fix), unknown pages
  get `not_in_sitemap` (site_fix), `canonical_elsewhere` silently becomes `alternate`, a `redirect` / `not_found` site_fix becomes leave_out.
- Verified (probe P1/P2):
  ```
  one child 503, the other read -> sitemap state: read 2 urls 1 errors [{"url":".../page-sitemap.xml","error":"answered 503"}]
  merged in_sitemap false ; diagnosis {"cause":"indexed_not_in_sitemap","action":"site_fix"} note: "...your sitemap does not list it. Add it to the sitemap..."
  unknown page from the failed child -> {"cause":"not_in_sitemap","action":"site_fix"}
  6,000-URL sitemap: urls kept 5000 capped true ; page 5500 -> in_sitemap false, cause indexed_not_in_sitemap, site_fix
  ```
- Fix: treat `in_sitemap` as known only when the tree was read completely (no errors, not capped, no `next` left after round 3); otherwise keep
  the stored value and never derive `*_not_in_sitemap` from it.

### E2 (High) Our own GET (bot wall, geo redirect) overrides Google's successful crawl with site_fix advice
- Where: `_index_kit.js:295-300` (`diagnose`: any fetch status 401/403/5xx or a redirect replaces a SOFT cause), `readFetch:202-219`,
  UA `SEO-Agent/4.16` from the Doha VM (`build_index_coverage.py` `UA`).
- Failure: Google says "Crawled - currently not indexed" with `pageFetchState: SUCCESSFUL` (Google read the page). A Cloudflare / WAF challenge to
  our unknown bot UA (403 or 503), or a language / geo redirect served to a Qatar IP, becomes the diagnosis and contradicts Google's own reading.
  Bot walls in front of client sites are common.
- Verified (probe P11):
  ```
  403 challenge -> {"cause":"access_denied","action":"site_fix"} "This page asks for a login or turns visitors away (403), so Google cannot read it. Open it to everyone..."
  503 challenge -> {"cause":"server_error","action":"site_fix"} "Your server answered with an error when this page was read (503)..."
  geo redirect  -> {"cause":"redirect","action":"site_fix"} "This address redirects to www.example.com/ar/guide. List the final address in your sitemap instead."
  ```
- Fix: let a fetch fact override only when Google has no successful fetch of its own (no `lastCrawlTime` / `pageFetchState` not SUCCESSFUL), and
  never from a 403 / 429 / 503 that looks like a challenge (body markers, `cf-mitigated`, `server: cloudflare`); report it as "we could not read it".

### E3 (High) Old pages become "new, wait, that is normal" when the first run did not read the sitemap
- Where: `_index_kit.js:262-268` (`anchorOf`: a sitemap page first seen after `watch_since` is new by sight), `:386-387` (`watch_since` = the
  earliest stored `first_seen_at`, i.e. the first run, whatever it read), `:307-309` (`wait_new`).
- Failure: if day 1's sitemap read failed (timeout, 5xx, `.gz` only) and day 2 reads it, every sitemap page (years old, `lastmod` 2023) is in the
  `new` lane for 30 days; unknown / discovered ones get `wait_new` ("normal in the first weeks"). Same when a client fixes our own
  "add a sitemap" step, or after a partly read tree (E1). `sitemap_lastmod` is ignored.
- Verified (probe P10): `old articles (lastmod 2023): 40 lanes ["new"]` ; a 2023 article "Discovered - currently not indexed" ->
  `{"cause":"wait_new","action":"wait"}` "This page is new and Google has not crawled it yet, which is normal in the first weeks."
- Fix: anchor "new by sight" on the first run whose sitemap tree was fully read (store it), and treat a page whose `lastmod` is older than that
  date as existing.

### E4 (High) The URL we inspect is whichever form the first source had: a trailing-slash variant reads as a drop-out
- Where: `_index_kit.js:376-381` (`merge`: the first source creating a page sets `p.url`; order stored, ours, sitemap, search, inventory; the stored
  URL is then fixed for ever), `key()` is slash/host-agnostic but Google is not; `IX_Diagnose.js:67` (drop-out on any reading).
- Failure: a content-log `published_url` without the trailing slash (`/blog/peppol`) on a site that serves and lists `/blog/peppol/`: the page is
  "indexed" by search evidence (key-agnostic), and 28-56 days later the watch inspection asks Google about `/blog/peppol` -> "Page with redirect"
  or "URL is unknown to Google": state indexed -> excluded / not_indexed, a **drop-out** is recorded and the callback fires the same day, and the
  client is told to "List the final address in your sitemap instead" when the sitemap already does.
- Verified (probe P4): `stored/inspected url: https://www.techand.ai/blog/peppol state indexed evidence search` ; watch inspection ->
  `{"cause":"redirect","action":"site_fix","state":"excluded"}` (drop-out), or `{"cause":"unknown_to_google","action":"links","state":"not_indexed"}`.
- Fix: inspect the form Google uses (the search row's URL, else the sitemap's, else Google's canonical), let a later source replace the stored form
  (migrate the row), and do not count a host / slash-only redirect as a drop-out or a site_fix.

### E5 (High, conditional) A www site with an empty `seo_sites.canonical_host` is diagnosed page by page as duplicates / redirects
- Where: `_index_kit.js:43-46` (`siteHost`: bare domain when `canonical_host` is empty), `:49-58` (`norm` moves every www sitemap / search URL to
  the bare host), `:291` (a Google canonical on the other host -> `duplicate_no_canonical` / `google_chose_other`); `IX_Plan.js:32`.
  `canonical_host` is filled only by the main workflow's site model, so a site that never had that run has it empty.
- Failure: every page is inspected at `https://devaicon.com/...` while the site lives on www: Google answers "Page with redirect" (+ www canonical).
- Verified (probe P3):
  ```
  sitemap www URL normalised to https://devaicon.com/services/
  inspection (Page with redirect, googleCanonical www) -> {"cause":"duplicate_no_canonical","action":"duplicate","host_only":true}
     "Google sees this page as a copy of another page (www.devaicon.com/services/). Point it to the main version with a canonical tag..."
  no googleCanonical -> {"cause":"redirect","action":"site_fix"} "This address redirects. List the final address in your sitemap instead."
  ```
  Suspected on top: with a URL-prefix property `https://www.x.com/` (picked by `IX_Sites.js:18`), bare URLs are outside the property; Google's
  403 message ("…the inspected URL is not part of this property") does not match `PW.inspection`'s access regex
  (`/permission|forbidden|403|unauthor|invalid_grant/` is tested on the message only), so the probes do not stop the site and up to the whole cap
  fails every day (`error / not_checked`, re-planned the next day).
- Fix: when `canonical_host` is empty, take the host the sitemap / Search Console rows actually use (majority host), and refuse to diagnose a
  site whose inspected host differs from Google's canonical host for most pages.

### E6 (High) Long runs: nothing is saved until the end, a time-out loses the day, and the catch-up replays it, re-spending the cap
- Where: every site's inspections run sequentially in two HTTP nodes of ONE execution (`Inspect URL (Probe)`, `Inspect URL (Index)`, batch 1, 150 ms),
  `executionTimeout: 3600` (`build_index_coverage.py`); all writes (`Save Index Pages`, `Save Index Runs`) come after all inspections;
  `IX_Plan.js:29-31` counts `used_today` only from SAVED `seo_index_runs` rows; `_catchup.js:42,153,170-174` replays a `canceled` / `crashed`
  scheduled execution (`max_attempts: 3`).
- Failure: at ~1.5-2 s per inspection, the default cap (300) costs 7.5-10 min per site, the max cap (1,200) 30-40 min. About 6 tracked sites at 300,
  or 2 at 1,200, exceed 3,600 s (plus up to 50 sitemaps and 60 page reads a site). The execution is cancelled before any row is saved: no history,
  no run row, so the next run of the day sees `used_today = 0`. The catch-up replays the cancelled fire up to 3 times; each replay inspects the same
  pages again and times out the same way. Up to 4 x cap inspections a day per property (4,800 at 1,200: past Google's shared 2,000, starving the
  Site Tracker and audits), and the backlog never shrinks because nothing is ever stored. The ledger row of a cancelled run also stays `reserved`
  (released only as stale after 2 h).
- Verified: the code paths above (wiring printed from the generated workflow; catch-up DEAD handling read). The per-call latency is an assumption.
- Fix: one site per execution (or a per-site loop that saves its rows and run row before the next site), a run-wide inspection budget sized to the
  time-out, and count inspections in a row written BEFORE inspecting (record-then-spend), so a replay sees them.

### E7 (Medium) A reused Site Tracker reading turns alternates and "Google chose another canonical" into "add a canonical tag"
- Where: `_index_kit.js:174-181` (`reuseOf` sets `user_canonical: ''`), `:291` (any Google canonical that differs -> `duplicate_no_canonical` when
  no user canonical is known), `seo_page_watch` stores no `userCanonical`.
- Verified (probe P5):
  ```
  reused "Alternate page with proper canonical tag" -> {"cause":"duplicate_no_canonical","action":"duplicate"} "...Point it to the main version with a canonical tag..."
  own inspection of the same page                   -> {"cause":"alternate","action":"leave_out"}
  reused "Duplicate, Google chose different canonical than user" -> duplicate_no_canonical (should be google_chose_other)
  ```
- Fix: when a reading has no user canonical (reused), classify from `coverageState` first (alternate / google_chose_other), not from the canonicals.

### E8 (Medium) Search Console's 25,000-row cap on page x date zeroes real impressions and flips "important" pages to "intended"
- Where: `IX_Pages_Query_Requests.js:9` (`dimensions: ['page','date']`, 90 days, `rowLimit: 25000`, one request), `_index_kit.js:394,402-403`
  (`merge`: a page missing from the rows gets `impressions_28d = 0`, `last_impression_at = ''` whenever `sr.read`; `truncated` is only reported).
- Failure: page x day rows pass 25,000 at ~280 pages with daily impressions over 90 days; Google drops the low-click rows first, i.e. exactly the
  pages this feature cares about. Their stored impressions are erased, so `important` (`diagnose:280`) becomes false: `noindex` -> `noindex_intended`,
  `robots_blocked` -> `robots_intended`, `not_found` site_fix -> leave_out ("Nothing to do"); bucket 2 ("lost every impression") also fires falsely.
- Verified (probe P6): `truncated true ; after merge: impressions_28d 0 last_impression_at ""` ; re-inspection of a noindex page that had 12
  impressions -> `{"cause":"noindex_intended","action":"leave_out"}` "…that looks intended. Nothing to do."
- Fix: when truncated, keep stored values for pages absent from the rows (or query `page` only for 28 / 90 days with paging via `startRow`).

### E9 (Medium) A redirect error (loop / too-long chain) is told "normal, nothing to do"
- Where: `_index_kit.js:243` (`^redirect error` -> `redirect`), `:253` (`REDIRECT_ERROR: 'redirect'`), `:316` (`redirect` not in sitemap = leave_out).
  RESEARCH §B: "Redirect error … debug the redirect", not a leave-alone state.
- Verified (probe P7): not in sitemap -> `{"cause":"redirect","action":"leave_out"}` "This address redirects to another page. That is normal. Nothing to do.";
  in sitemap -> "List the final address in your sitemap instead" (there is no working final address).
- Fix: a separate `redirect_error` cause, action site_fix ("fix the redirect chain"), never leave_out.

### E10 (Medium) Unbounded payloads in one execution on a 4 GB VM
- Where: `text_get` has no response-size limit; `sitemapAccept:127-133` keeps queueing / fetching children after the 5,000-URL cap; whole sitemap
  and page HTML bodies stay in `Fetch Sitemaps n` / `Fetch Page (…)` outputs; `merge` copies each stored row into `_prev` (`:378`) and
  `IX_Inventory.js:42` passes all pages on; `saveDataSuccessExecution: 'all'` saves all of it.
- Verified (probes P6b / P8): after the 5,000-URL cap, 49 more children are still fetched (33 MB with 0.67 MB children; a real 50,000-URL child is
  ~10 MB, so ~500 MB); a 5,000-page site: Index Inventory 4.1 MB (run 1) / 10.8 MB (run 2), Diagnose upserts 4.9 MB, Load Index Pages 4.9 MB,
  plus Page Rows / Save output, per site and per day.
- Fix: stop the tree at `urls_max`, cap response size, strip `_prev` / bodies before passing items on (keep only what the next node reads).

### E11 (Medium, security) SSRF: the own-host check is bypassable and redirects go anywhere
- Where: `_index_kit.js:30` (`hostOf` userinfo class `[^@\/?#]*` admits `\`), `:47` (`own`), `sitemapAccept:129-132` and `sitemapRoots:98` and
  `IX_Sitemap_Read.js:24-27` queue the RAW child / robots / Search Console URL (not the normalised one); `Fetch Sitemaps n` and `Fetch Page (Final)`
  follow redirects to any host; no IP-literal / private-range refusal (the app's safe fetcher refuses both).
- Verified (probe P9): `"http://169.254.169.254\@www.example.com/computeMetadata/v1/" -> own(): true | WHATWG URL (axios) requests 169.254.169.254/@www.example.com/…`;
  `"http://127.0.0.1:5678\@example.com/rest/settings" -> own(): true | requests 127.0.0.1:5678/…`; `http://user:pw@www.example.com:6379/x.xml` is fetched
  as is. The queued child is exactly that string. A client page that redirects to an internal address is fetched by `Fetch Page (Final)` and its
  `<title>` / canonical / word count are stored on the client's row (shown in the app). Blind GETs from the production VM; the metadata server
  needs a header, so no credential leak was shown.
- Fix: fetch only `norm()`-rebuilt URLs (https, canonical host, no userinfo / port), refuse `\` and IP literals, and resolve redirects hop by hop
  with the same host rule.

### E12 (Medium) Past 6,000 stored pages, new pages (ours included) are silently dropped for ever
- Where: `_index_kit.js:377` (`if (pages.size >= CFG.pages_max) return null`; stored rows are added first, nothing is ever pruned),
  `IX_Run_Rows.js` notes `sm.capped` (sitemap) but never `d.capped` (`IX_Diagnose.js:87` carries it).
- Failure: a site whose URLs churn reaches 6,000 rows (removed pages stay as `not_found` / leave_out); from then on a page we just published is not
  in the table, gets no new-lane checks, and nothing tells anyone.
- Verified: code read (merge order and cap; no `capped` note).
- Fix: add `ours` / sitemap pages before old stored rows when at the cap, prune long-gone rows, and say "capped" in the run note.

### E13 (Low) A per-minute rate limit is read as "daily quota used up" (suspected wording)
- Where: `_page_watch.js:315` (`/quota|rate limit|RESOURCE_EXHAUSTED|429/` = one class), `IX_Inspect_Requests.js:9`, `IX_Plan.js:31`
  (`/quota/` in today's run note stops every later run of the day), `IX_Run_Rows.js:16`.
- Failure: if the Site Tracker inspects the same property at the same time (combined > 600/min), Google's per-minute 429 stops the site for the day
  and the run note tells the client the DAILY quota was used up.
- Fix: tell the per-minute limit from the per-day one (message text), retry the per-minute one after 60 s.

### E14 (Low) "Not checked" written as a reading of zero for a site without access
- Where: `IX_Diagnose.js:30-33` (no access / failed -> `all: []`), `IX_Run_Rows.js:13,27-29`, `IX_Report.js:20`.
- Failure: the run row says `known 0, indexed 0, backlog_left 0`; the Monday report says "Google has **0 of 0** known pages in its index". The app's
  hero reading the latest run would show a measured zero, not "could not check".
- Fix: no run row (or a row with `failed: true` and nulls) for a site that was not checked; no "0 of 0" sentence.

### E15 (Low) Low-value patterns match real landing pages
- Where: `_index_kit.js:66` (any path segment `search`, `login`, `account`, `register`, `feed`, `checkout`, …), `:306`.
- Failure: `/products/search/` (an enterprise-search product page) "Crawled - currently not indexed" -> `low_value`, "a listing, filter, search or account
  page that does not need to be in Google. Nothing to do."
- Fix: match these only as the first path segment / known CMS paths, and never for a page in the sitemap or one of ours.

### E16 (Low) Update impact reports position 0 for a page with no impressions after the update
- Where: `_index_kit.js:598,607` (missing side = `{c:0,i:0,p:0}`, `after_pos: 0`).
- Fix: `null` position when the page had no impressions in that window.

## Test gaps (what the harness claims vs what it asserts)
- IX3/IX4 assert only a sitemap read that failed COMPLETELY; no partial failure, no 5,000-URL / 50-sitemap / depth-4 case reaching `diagnose` (E1).
- IX1 runs every cause with `canonical_host: 'www.techand.ai'` and inspected URLs already in Google's form; no empty `canonical_host`, no slash /
  host variant of an `ours` URL (E4, E5).
- No case where our fetch disagrees with a SUCCESSFUL Google fetch (E2), no reused reading for an alternate / duplicate (E7), no truncated Search
  Console answer reaching `merge` (E8, only the note is checked), no REDIRECT_ERROR (E9).
- IX6 checks the real `incidents.json`, but the fixture has no rolling-out incident: `parseEvents`' open / rolling-out branch and `started` are only
  tested on hand-made objects.
- Nothing measures run time, payload size or the catch-up replaying a cancelled run (E6, E10). IX12 checks that the catch-up lists the workflow,
  not what a replay spends.
- The lane test (IX2) uses a stored history whose first run read the sitemap; the "first run read nothing" path (E3) is not tested.

## Checked and fine
- Harness in a copy: `ONLY_S='^IX'` 520 passed, 0 failed.
- Independence: against the merge base (`71e9d97c`), the 10 "schema only" workflows differ only by the two `seo_monitors` columns in their Ensure
  nodes' column list (connections and settings identical); Site Admin changes only `Admin Action`, `Monitor Row (Admin)` and its Ensure node; the main
  workflow only `Monitor Row (Track)` and its Ensure node; the catch-up only `Catch-up Plan` / `Catch-up Targets` / `Note`. The build asserts the new
  workflow writes only its five tables plus the shared ledger / ops-alert rows; no DataForSEO, no Claude, no PUT / PATCH / DELETE; every Google call
  on `SEOcredGoogleSvc` with read-only endpoints (sites.list, sitemaps.list, searchAnalytics.query, urlInspection): no new scope.
- Deploy order: `deploy_engine.py` runs `sync_tables.py` before importing, so the two new `seo_monitors` columns exist before `Monitor Row (Track)` /
  `(Admin)` write them.
- Site Admin: `index_watch` accepts only yes/no forms (else refused), `''` keeps the stored value; `index_daily_cap` whole numbers clamped 20-1,200,
  `''` back to the default; Track my site carries both as stored.
- Concurrency: the batch run's ledger row has an empty domain when it covers several sites, so the run guard's `same_mode` rule refuses a manual run
  while it is going; a second run the same day subtracts `used_today` (when the first run saved its row); the trigger's `cap` is honoured only on demand
  and is clamped to 1,200; the catch-up skips the workflow while it is inactive.
- Quota pacing: inspections are batch 1, 150 ms apart (≤ 400/min); a probe answering quota / access stops the site's rest for the day; reused Site
  Tracker readings and search evidence spend nothing and are not counted.
- "Not checked" handling: a failed inspection keeps an earlier reading (re-checked tomorrow), a page with none becomes `error / not_checked`, never
  `not_indexed`; a drop-out needs a real reading (never missing impressions or a failed check).
- DESIGN §4 rows other than E2/E7/E9: PASS / "Submitted and indexed" / impressions -> indexed; enum `pageFetchState` (NOT_FOUND, SOFT_404,
  SERVER_ERROR, ACCESS_DENIED / ACCESS_FORBIDDEN / BLOCKED_4XX, BLOCKED_ROBOTS_TXT), `indexingState` BLOCKED_BY_META_TAG / HTTP_HEADER, `robotsTxtState`
  DISALLOWED read before `coverageState`; intended noindex / robots / alternate / removed 404 are leave_out; `coverageState` matched case- and
  hyphen-insensitively with unknown strings routed to `unclassified`.
- No client sentence says "will be indexed", "guaranteed" or "instant"; no em dashes or curly quotes reach notes or the report.
- Events: the real `incidents.json` fixture parses to 9 events (7 core / spam updates with kinds and dates matching RESEARCH §E; the February 2026
  Discover update and a Serving incident are `other`); a feed that fails changes nothing; the first policy-page reading is a baseline, not news; the freeze
  holds only core / spam rollouts started ≤ 30 days ago.
- Update impact: equal windows, after-window starts the day after the end, capped at Search Console's 3-day lag, ≥ 7 days, recomputed weekly up to
  28 days, only `complete` updates of the last 60 days, ≥ 50 impressions and |z| ≥ 1.96 with a 20% move.
- Upserts: `seo_index_pages` keyed `site_id + url` with exactly `INDEX_PAGES_COLS` (the build asserts the kit's column list); only changed rows are
  written; history only on a state / cause change; runs / events / impact rows carry exactly their table columns.
- Sandbox: no `URL`, `structuredClone`, `defineProperty`, `setPrototypeOf`, `$env` or `$json`-after-agent in the IX code; every `$('Node')` read of a
  node that may not have run is in a try/catch; HTTP text answers are read from `body ?? data`; `Intl` is guarded with a UTC fallback.
- Secrets: the spam-policies fixture (183 KB, scripts removed) and the incidents fixture contain no `AIza…` / API-key / token strings; the build's
  secret scan passes.
- Data Table storage: production sets `N8N_DATA_TABLES_MAX_SIZE_BYTES` to 1 GB (`deploy/gcp/compose.prod.yml:167`); ~5 MB of rows per 5,000-page site
  fits, but `seo_index_history` and `seo_index_runs` have no retention.
