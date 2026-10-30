# Index coverage: engine build (2026-10-29)

Branch `ix/engine`. Built against `DESIGN.md` §1-§5 and §7. Nothing deployed, no paid API called, nothing pushed. The app half is built
separately against the same contract; what it must know is in "For the app" and "Contract changes".

## 1. What was built

| Part | Where |
|---|---|
| Five tables + two `seo_monitors` columns + `LEDGER_EST['index_coverage']` ($0) | `ladder_common.py` (`INDEX_PAGES_*`, `INDEX_HISTORY_*`, `INDEX_RUNS_*`, `GOOGLE_EVENTS_*`, `UPDATE_IMPACT_*`; `MONITORS_COLS` + `index_watch`, `index_daily_cap`) |
| The kit `IX` (pure functions, inlined after `PW`) | `v5/code/_index_kit.js` |
| The node code (19 files) | `v5/code/IX_*.js` |
| The workflow `SEOagentIndexCv1` "SEO Agent — Index Coverage" (103 nodes) | `build_index_coverage.py` -> `workflows/SEO_Agent_Index_Coverage.json`; run by `build_v4.py` after `build_monitors.py`, before the catch-up is built |
| Site Admin `monitors`: `index_watch`, `index_daily_cap` | `v5/code/Admin_Action.js` (validation), `v5/code/Monitor_Row_Admin.js` (stored) |
| "Track my site" carries the two columns as stored | `v5/code/Monitor_Row_Track.js` (the upsert writes every column it is given; a column left out would be emptied by every save) |
| Schedule Catch-up replays it | `build_catchup.py` `EXPECTED` (+ `build_v4.py` `_CYCLE_DAILY98`) |
| Ledger / gate counts | `build_v4.py` section 55 (`checked55 == 14`) and section 64 (`len(out64) == 14`) |
| Callback POST on the not-idempotent list | `retry_lint.py` `ALLOW['POST Index Report']` |
| Deploy | `deploy_manifest.json`: `workflows` + `publish` |
| Harness | `harness/scenarios_index.js` (IX1-IX12), `harness/fixtures_index/` (the real `incidents.json` and spam-policies page of 2026-10-29, scripts removed), `harness/index_wiring.json` (written by the build); 10 existing assertions that hard-code "the scheduled workflows" / "the two daily crons" updated to include it |

### The workflow, in order (every external call is behind the run ledger's reservation and the run guard)
1. **Doors**: `Daily Schedule` (05:15 every day, n8n's clock = America/New_York; free slot: Page Watch 05:45, AI Pulse 06:30, catch-up :07/:22/:37/:52,
   dispatcher every 5 min) and `Manual Run` (`{ domain | site_id, callback_url?, request_id?, cap? }`; feeds the same first node, so the catch-up can start it).
2. **Own tables** (`Ensure …`) and **loads**: `seo_sites`, `seo_monitors`, `seo_pages`, `seo_page_watch`, `seo_content_log` (published rows only),
   `seo_index_pages`, `seo_index_runs` (last 2 days), `seo_google_events`, `seo_update_impact`.
3. `Index Plan`: tracked websites (not paused) whose `index_watch` is not off; the cap (`index_daily_cap`, empty = 300, 20-1,200) and what earlier runs of
   today already inspected; `quota_hit` when a run of today hit Google's quota.
4. **Run ledger** (`ledger_mainline`, `no_dfs`): $0 reservation `schedule:index_coverage`, the concurrency gate (`Run Allowed? (Index)`), the refusal
   path, the settle, the alert-retry sweep; the callback waits for the settle (`Ledger Join` / `Callback Ledger (Index)`).
5. **Google's news, once a run**: `Fetch Google Incidents` (status.search.google.com/incidents.json) + `Fetch Spam Policies` -> `Google Events` (parse,
   new/changed rows, started / completed today, the policy fingerprint, the freeze) -> `Save Google Events` (upsert `event_id`, changed rows only).
6. `GSC Sites (Index)` + `Index Sites`: the property per website (stored hint, `sc-domain:`, URL prefix); no access = reported, never inspected.
7. `GSC Sitemaps List` (sitemaps.list) and `GSC Pages Query` (Search Analytics, `page × date`, 90 days, one request, 25,000 rows).
8. **Sitemap tree**, three rounds (`Sitemap Requests n` -> `Fetch Sitemaps n` -> `Sitemap Read n`): robots.txt, `/sitemap.xml`, the submitted sitemaps;
   then the robots `Sitemap:` lines and index children. ≤ 50 sitemaps / 5,000 addresses a site; `.gz` named as not read.
9. `Index Inventory`: merge (stored rows keep their URL; every other source on the canonical host, host-agnostic keys, own host only, assets dropped),
   lanes, evidence without quota (impressions in the last 28 days of data; a Site Tracker inspection of the last 3 days reused), the plan inside the cap.
10. **Inspections**: `Index Probe Requests` (2 per site) -> `Inspect URL (Probe)`; `Index Inspect Requests` (the rest, minus sites whose probe answered
    quota / no access) -> `Inspect URL (Index)`. Batch 1, 150 ms apart.
11. **Our own reads** (≤ 60 a site a day, pages Google does not have): `Fetch Page (Index)` (no redirect follow) -> `Fetch Hop Requests` ->
    `Fetch Page (Final)` (redirects followed, for 3xx only).
12. `Index Diagnose`: one cause / action / state / sentence per page, history, drop-outs, needs-a-person, link suggestions, the changed rows.
13. Saves: `Save Index Pages` (upsert `site_id + url`, changed rows only), `Save Index History` (insert).
14. **Update impact**: `Update Impact Requests` (2 Search Analytics reads per finished core / spam update and site, ≤ 2 updates) -> `GSC Impact Query` ->
    `Update Impact Rows` -> `Save Update Impact` (upsert `site_id + event_id`).
15. `Index Run Rows` -> `Save Index Runs` (one row per site and run).
16. `Index Report` -> (after the settle) `Has Callback (Index)?` -> `POST Index Report` (stage `index_coverage`).

### What the build proves on the generated file (`build_index_coverage.py`, fails the build otherwise)
Every node reachable from the two doors; the manual entry feeds the schedule's first node; no external HTTP node before `Reserve Run Ledger (Index)`;
Data Table writes only to its five tables plus the shared `seo_run_ledger` / `seo_ops_alerts` rows of the ledger chain; no DataForSEO, no Claude, no
PUT / PATCH / DELETE; every Google call on `SEOcredGoogleSvc` (scopes untouched); inspections 150 ms apart; the callback after the settle; `IX.PAGE_COLS`
equals `INDEX_PAGES_COLS`; every `$('…')` a code node reads exists; no code-node name shared with another workflow (the harness files would collide).
Plus the existing lints over all generated workflows (retry, in-200, gate pairs, lineage, state, url, secret scan, ledger order, LLM limits, catch-up).

## 2. Tests (offline)

* Baseline (untouched branch, build exit 0): **12875 passed, 0 failed**.
* After: **13250 passed, 0 failed** (+375: IX1-IX12; every existing check still passes - 10 of them were updated to count the new daily workflow).
  Two builds of the same sources are byte-identical (workflows/ and harness/code_v4/).
  The harness ran in a throwaway `n8nio/n8n:2.41.4` container (`docker run --rm -v <copy>:/s -w /s/harness -e CODE_DIR=/s/harness/code_v4
  -e OUT_DIR=/s/harness/out --entrypoint node n8nio/n8n:2.41.4 scenarios_v5.js`); `ONLY_S='^IX'` runs only this feature's scenarios.
* IX1 every cause of DESIGN §4 (real techand.ai answers for indexed / unknown / discovered / crawled / duplicate), fetch override, plain sentences;
  IX2 plan order and caps; IX3 reuse + search evidence + failed sources keep what was stored; IX4 sitemaps (the real one, an index of 61, a urlset of
  6,000, image locs, CDATA, .gz), hosts, low-value patterns; IX5 link suggestions; IX6 the real dashboard feed, news, freeze, the real policy page
  fingerprint; IX7 update impact (windows, filter, significance, nodes); IX8 techand.ai end to end through every generated code node (exact columns,
  callback shape, report); IX9 callback rule, second run of the day, quota probe, no access, watch off; IX10 drop-out, needs a person, freeze in rows /
  run / callback; IX11 Site Admin validation and storage, Track my site; IX12 wiring of the generated workflow, ledger, catch-up, manifest, retry rule.
* Sample output: `harness/out/index_coverage_techand.md` and `…_rows.json` (OUT_DIR of the run).

### Independence (baseline build vs this build, `workflows/`)
* New: `SEO_Agent_Index_Coverage.json`.
* Behaviour changed, as intended: `SEO_Agent_Site_Admin.json` (nodes `Admin Action`, `Monitor Row (Admin)`), `SEO_Agent_Schedule_Catchup.json`
  (`Catch-up Plan`, `Catch-up Targets`, `Note`: the third daily cron), `SEO_Agent_v4.json` (node `Monitor Row (Track)` only: carries the two new columns).
  Connections and settings of all three unchanged.
* **Schema only** (proved: removing the two new `seo_monitors` columns from their Data Table nodes' column / schema lists gives back the baseline JSON
  byte for byte): AI Growth, AI Pilot, AI Pulse, AI Visibility, Audit Scheduler, Backlink Monitor, Cycle Dispatcher, Link Builder, Rank Tracker,
  Site Tracker. This is what adding a `seo_monitors` column has always done (every builder embeds `MONITORS_COLS` in its Ensure / upsert nodes); it changes
  no behaviour (an Ensure node never alters an existing table; the upserts are auto-mapped and none of those nodes is given the new fields).
* Every other generated workflow byte-identical.

## 3. Deploy (owner, not done here)

1. Deploy window and the deploy guard as usual (`deploy/gcp/RUNBOOK.md`; nothing in flight, no cycle due in 15 minutes).
2. Backup (`deploy/gcp/backup.sh`).
3. `deploy/gcp/tunnel.sh` then `python3 deploy/gcp/deploy_engine.py --apply --create-missing`:
   * `sync_tables.py` runs first (deploy_engine does it before any workflow changes): adds `seo_monitors.index_watch` / `index_daily_cap` (and any future
     column of the five new tables). The five new **tables** are created by the workflow's own Ensure nodes on its first run.
   * `--create-missing` imports `SEOagentIndexCv1` (new on the remote); the manifest publishes it; the catch-up is updated and republished.
4. First run on demand, small: Manual Run `{ "domain": "techand.ai", "cap": 20 }` (through the n8n UI or the test runner), then read
   `seo_index_runs` / `seo_index_pages`. The schedule then runs daily at 05:15 New York.
5. Switch: `seo_monitors.index_watch = false` per site (Site Admin `monitors`), or leave the workflow unpublished.

## 4. What could not be tested offline

* The real n8n runtime: Google's error bodies under `neverError` (the code reads both `{error:{…}}` and n8n's error shape), the text full-response
  shape of `incidents.json` (read as a string and parsed; a JSON-array answer is also accepted), the `run_at gte` Data Table filter, `Intl` for the
  engine's Monday in the Code sandbox (falls back to UTC), the 3-round sitemap reads on large / slow sites, the 3,600 s execution time-out.
* Real quota behaviour: the 2-probe stop is proven on a mocked 429; a quota hit in the middle of the rest of a site's list is answered per call
  ("not checked") and stops the site for the rest of the day through the run note.
* First-run volume: up to `pages_max` (6,000) upserts per site once; techand.ai / devaicon.com are 47 / 29 known pages.
* The app reading the tables and rendering the callback (app half).

## 5. Decisions where DESIGN left room

* **A failed inspection**: a page that already has a reading keeps it (state / cause unchanged, re-checked tomorrow); only a page with no reading becomes
  `error / not_checked`. Never "not indexed", never "fine". The run row counts the failures (`errors`) and says why in `note`.
* **Fetch over a soft reason**: a hard fact our read saw today (404 / 410, 5xx, 401 / 403, noindex, a redirect to another page, a canonical elsewhere)
  replaces a soft coverage reason of an older crawl ("discovered", "crawled", "unknown", unclassified); it never replaces a documented enum.
* **States**: `indexed` (cause '' or `indexed_not_in_sitemap`), `excluded` (noindex*, robots*, canonical_elsewhere, alternate, google_chose_other,
  duplicate_no_canonical, not_found, redirect, low_value), `not_indexed` (the rest), `error` (not_checked), `unknown` (never checked; action `none`).
* `indexed_not_in_sitemap` only when the site has a sitemap that was read this run and the page is not low value.
* **Lanes**: `new` = a page in the content log published in the last 30 days, or a sitemap page first seen AFTER the site's first index run (on the first
  run nothing is new by sight). Once `existing`, always existing.
* **needs_person**: the engine cannot know "the fix was done" (that is the app's site task); it marks an actionable cause (site_fix / links / quality /
  duplicate) after 4 unchanged re-checks (the 5th reading of the same cause). The app can combine it with its task's done state.
* **seo_ladders is not read**: its rows are keyword rungs, a read path the fit gate guards (gate_lint); every published ladder page is in the content log.
* **Events**: every product of the dashboard is stored (an Indexing / Crawling incident explains a drop that is not the client's fault); kind `other`
  for anything not a core / spam update; only core / spam freeze. A rollout the feed still shows open after 30 days no longer freezes. The policy page's
  first reading is a baseline (dated by its own "Last updated"), never news.
* **Update impact**: equal windows before / after; after starts the day after the end; 7 to 28 days; Search Console's 3-day lag; recomputed at most
  weekly until it covers 28 days; updates finished in the last 60 days only; a page needs 50+ impressions over both windows; dropped / gained = a 20%+
  move with |z| ≥ 1.96 (two-sample Poisson on equal windows).
* **Callback**: Mondays in the engine's zone (America/New_York), the same day for a drop-out, a core / spam rollout that started or finished, or a policy
  page change; always for an on-demand caller (a `callback_url` on the trigger). `summary.events` = core / spam updates and policy changes, newest 6.
  `request_id` = the trigger's, else the site row's (as the other monitors).
* **Low-value patterns**: tag / category / author / archive paths, `/page/N`, search / cart / checkout / login / account / feed, date archives, and query
  parameters `s q search query filter sort orderby order page paged replytocom add-to-cart utm_* fbclid gclid ref sessionid sid` (`?p=` is a WordPress
  post id and is not low value).

## 6. For the app (contract details it must know)

* Tables are written only here; read them with the existing Data Table helper. `link_from` is a JSON string list `[{url, title}]` (≤ 5);
  `dropped_json`, `by_cause_json`, `by_action_json`, `pages_json` are JSON strings. `cause` is '' for a simply indexed page.
* `state = 'error'` is "could not be checked", never "not indexed". A page whose last check failed but has an earlier reading keeps that reading.
* Callback `index_coverage` body: `{ stage, status: 'complete', domain, site_id, request_id, summary, report_markdown, cost: { usd: 0 }, run_ledger,
  ran_late? }` - `summary` exactly DESIGN §5. Needs `SCHEDULED_STAGES` (0 credits), a label and a renderer.
* Site Admin `monitors` accepts `index_watch` (true / false / "on" / "off" / 1 / 0 / yes / no; anything else is refused: "index_watch must be true or false")
  and `index_daily_cap` (a whole number, kept 20-1,200; "" back to the default 300; a non-number or a fraction is refused).

## 7. Contract changes (all additive)

1. **`cause = 'unclassified'`** (action `none`, state `not_indexed`): a `coverageState` string Google does not document (RESEARCH §A says to route
   unknown strings there). The sentence tells the client to check the address in Search Console.
2. **`seo_index_runs.sitemaps_json`** (string, JSON): `{ submitted, submitted_errors, submitted_warnings, pending, read, fetched, urls, capped,
   robots_status, errors: [{url, error}] }` (`submitted` etc. `null` when sitemaps.list could not be read). DESIGN §8 has the app raise a step when no
   sitemap is submitted or it has errors; §2.3 had no field for it.

## 8. Open questions

1. `needs_person` should eventually require the app's site task for that cause to be marked done; today it is time-based (above).
2. The URL Inspection quota is still not counted across workflows (SURVEY_ENGINE risk 1): this workflow keeps its own daily count (`seo_index_runs`),
   the Site Tracker (150 a week) and audits (100 a run) do not read it. The default 300 leaves ample room; a shared counter is a later change.
3. A Google-side "Internal error" inspection answer is not retried within the run (as in the Site Tracker); it is re-checked the next day.
4. Sitemap submission stays out (DESIGN §8): the `sitemaps_json` field lets the app ask the client to submit / fix it.
5. Indexed pages that answer 404 today stay `indexed` (Google's state) until Google drops them; a "gone but still indexed" cause could be added later.

## Fix wave 1 (2026-10-29)

Branch `ix/engine`. Every engine finding of REVIEW_ENGINE.md (E1-E16) and the engine half of REVIEW_CROSS.md, against FIX_CONTRACT.md. Nothing
deployed, no paid API, nothing pushed. Only `workflows/SEO_Agent_Index_Coverage.json` changes among the generated workflows (rebuilt from the
same sources, every other file byte-identical to the integration head); the catch-up did not need to change.

**Harness**: before 13255 passed, 0 failed (integration head). After **13788 passed, 0 failed** (+533: IXF1-IXF12 and the IX updates). New
`harness/scenarios_index_fix.js` (IXF1-IXF12, 60 checks): run against the reviewed code they give **55 failed, 5 passed** (the 5 are controls:
"an old crawl may still be overruled by our 404", "a second per-minute answer is the day's quota", a replay that the old daily sum already
covered, a vacuous slim-row check, the old "discovered" lane result); on the fixed code 60 / 60 pass. IX1-IX12 were updated where the
contract changed (the e2e helper now drives one website per execution, Search Analytics answers per window, a home page and a reservation).

### Shape of the run (X1 / E6 / X2 / E10 / X19)
* `Index Plan` has three ways in: **dispatch** (the 05:15 schedule, the catch-up, or a Manual Run naming no website): the tracked websites
  with the watch on, oldest run first, minus those with a run row today; it reads Google's news once, prunes history / runs older than 400
  days and starts the first website's own execution (`Start Index Part`, Execute Workflow of itself, `waitForSubWorkflow: false`). **Chain
  part** (`ix_chain` + `site_id`): one website; after `Save Index Runs` it starts the next (`Next Index Part`, `parent_run_id` = itself).
  **On demand** (`domain` / `site_id`): one website, callback always.
* One website at a time (plus the dispatch's seconds = at most two executions): two parallel chains would hold two of the run guard's
  three slots and push the AI Pulse / cycle jobs into refusals. A chain part refused for capacity (`same_mode`, `too_many_open`,
  `heavy_busy`) is started again 5 minutes later (`Retry Index Part` -> `Wait (Index Part Retry)` -> `Restart Index Part`, at most 12 times);
  a chain older than 20 h stops; tomorrow's dispatch takes the oldest-checked websites first.
* **Reservation** (E6): after the inventory and before the first URL Inspection, `Index Reservation` -> `Save Index Reservation` inserts the
  site's `seo_index_runs` row (`inspected` = planned count, the pre-run figures, a note "had not finished"). `Save Index Runs` now
  **upserts on `site_id + run_at`**, replacing it. `Index Plan` sums `inspected` of today's rows, so a crash, a time-out, a catch-up replay or a
  manual re-run can never spend past the cap. No saved reservation = no inspection (`Index Probe Requests`).
* Per-site loads are filtered server-side by `site_id` (`Load Index Pages`, `Load Pages`, `Load Page Watch`, `Load Content Log`,
  `Load Update Impact`); the dispatch loads none of them.
* Payloads: `Page Signals` parses every page read into status / redirect / noindex / canonical / words / title; nothing after it carries a
  body. Stored rows travel once (`_prev` is a slim copy + a column fingerprint used by `IX.changed`). The sitemap tree queues no child once
  5,000 addresses are read. Bodies stay only in the HTTP nodes' own saved output (one website, <= 60 pages; `saveDataSuccessExecution` stays
  `all` because the catch-up decides "fired" from the execution list).

### Per finding
| id | status | how | harness |
|---|---|---|---|
| E1 / A1 | fixed | `IX.sitemapComplete` (no error, no cap, no child left, robots.txt read); `merge`: a page found is in the sitemap, a page not found keeps its stored `in_sitemap` unless the read was complete; `diagnose` says `indexed_not_in_sitemap` / `not_in_sitemap` only on a complete read; `sitemaps_json.complete`; the run note says partial | IXF1 |
| E2 | fixed | `readFetch` marks 401 / 403 / 429 / 503, challenge pages (title / cf-chl / incapsula / px markers; captcha words only on an error status) and language redirects as `blocked`; `diagnose` lets our read add a hard fact only over a soft reason when Google has no successful crawl in the last 14 days | IXF2 |
| E3 | fixed | lane decided at first sight and kept: `new` = ours, or first seen in the sitemap after a run whose tree was complete (`prev_complete` from the previous run's `sitemaps_json`) and lastmod not older than that run | IXF3, IX2 |
| E4 | fixed | the URL is the sitemap's form on the canonical host; a stored row on another form moves (`moves`: old row deleted by `Delete Index Pages`, history re-pointed by `Move Index History`); a same-site slash / case / www redirect (our read, or Google's "Page with redirect" to the same key) moves the row, re-inspects it tomorrow, never a drop-out or site step | IXF4 |
| E5 | fixed | `siteHost`: canonical_host, else the home page's final host (round 1 asks the home page; stored as `sitemaps_json.home_host`, reused next run); `IX.inProperty` keeps URL-prefix properties to their prefix (run note counts the rest); "not part of this property" / 403 = `access` | IXF5 |
| E6 | fixed | one execution per website + the reservation row (above) | IXF6 |
| E7 | fixed | a reused reading (no user canonical) is classified from the coverage words; never `duplicate_no_canonical` from canonicals | IXF7 |
| E8 / X3 | fixed | Search Analytics `dimensions: ['page']`, four windows (90 / 28 / 14 / 7 days, ending 3 days back), `startRow` 0 then 25,000 when full (`Pages Query More` / `GSC Pages Query 2`), hard stop 50,000 a window; a truncated window leaves the pages it cut at their stored figures; `last_impression_at` = first day of the newest window with impressions | IXF8, IX3 |
| E9 | fixed | new cause `redirect_error` (enum `REDIRECT_ERROR`, coverage "Redirect error"): action `site_fix`, state `not_indexed`, its own sentence | IXF7, IX1 |
| E10 | fixed | see "Shape of the run" | IXF1, IXF6 |
| E11 | fixed | `IX.parseUrl` (no `\`, userinfo, whitespace, IP literal incl. hex / integer forms, other port, `localhost` / `.local` / `.internal`); everything fetched is rebuilt (`IX.safe`) on the site's own registrable domain; no HTTP node follows redirects (`Fetch Sitemaps n`, `Fetch Page (Index)`, `Fetch Page (Final)`); a hop is ours (`IX.hopOf`) and re-checked | IXF9, IXF6 |
| E12 | fixed | at the 6,000 cap ours, then sitemap, Search Console, inventory, then stored-only rows; the run note says capped | IXF10 |
| E13 | fixed | `readInspection`: a quota / 429 answer naming the day is `quota`, any other is `rate`; a rate answer never stops the site; its pages are asked again after `Wait (Index Rate Limit)` (61 s, 400 ms apart, at most 100); a second rate answer in the run is taken as the day's quota; the plan stops the day only on the note "daily URL Inspection quota" | IXF10 |
| E14 | fixed | a site without access keeps its stored rows; the run row carries their figures, `inspected` 0 and the note "We could not check this website today: ..."; `sitemaps_json.checked: false`; the report never prints "0 of 0" | IXF10 |
| E15 | fixed | search / login / account / feed ... only as the first path segment; tag / category / author / archive / page / date archives in the first or second; never for a page in the sitemap or ours | IXF7, IX4 |
| E16 | fixed | `before_pos` / `after_pos` are `null` for a window with no impressions | IXF7 |
| X1 | fixed | see "Shape of the run" | IXF6 |
| X2 | fixed (bounded) | see "Shape of the run"; the HTTP nodes' own saved output still holds the pages read (one site, <= 60) | IXF6 |
| X4 | fixed | a drop-out needs an indexed page now `not_indexed` / `excluded` with an action other than `leave_out` / `wait`, on a reading, not a move; Google's "Page with redirect" is read before the canonicals (a redirect target is not a duplicate) | IXF11 |
| X7 | fixed | `fix_seen_at` per FIX_CONTRACT (exact positive signal per cause, `IX.fixSeen`; robots.txt evaluated for Googlebot by `IX.robotsAllows`); while set: action `wait`, note "Fixed on your site. Waiting for Google to read it again.", re-inspected after 1 day (7 days once it is a week old), planned right after the new lane; cleared when the cause changes or the problem is seen again; site-fix pages are read daily | IXF11 |
| X8 | fixed | `ask_google` via `IX.askGoogle`: fix seen, our pages not indexed after 7 days, sitemap pages linked from the home page / menu that Google has not crawled or does not know; never `leave_out`, never `quality` during a freeze; chosen on the engine's Monday (or when none is marked), kept while eligible on other days; at most 5 | IXF11 |
| X13 | fixed | the first reading of the dashboard feed is a baseline (no news); a site's first run and updates that started before its first run send no same-day callback | IXF12 |
| X16 | fixed (engine half) | the dispatch deletes `seo_index_history` (`at`) and `seo_index_runs` (`run_at`) older than 400 days; stored rows gone (404 / 410), in no source and untouched for 120 days are pruned (only after a complete sitemap read and an untruncated Search Console read); duplicate rows of one address are pruned; the cap note (E12). Deleting a site's rows on site deletion is the app's | IXF12 |
| X19 | fixed by X1 | one website per execution: a run holds one guard slot for one website's minutes, not the whole batch | - |

### Contract details for the app (beyond FIX_CONTRACT.md)
1. New cause **`redirect_error`** (action `site_fix`, state `not_indexed`; label "Redirect error").
2. Action **`wait`** can carry a site-fix cause: rows with `fix_seen_at` set (group them as "Fixed on your site, waiting for Google").
3. **Reservation rows** in `seo_index_runs`: written before inspecting, replaced by the final row (same `site_id` + `run_at`); a run that
   crashed leaves it with the pre-run figures, its planned `inspected` and the note "...had not finished...". `sitemaps_json` then holds
   `{ reservation: true, complete, home_host }`.
4. `sitemaps_json` gains `complete` (true / false; `null` when not checked), `home_host` and `checked` (false = the site could not be checked:
   `inspected` 0, figures from the last check, the note says why).
5. `pages_json` positions (`before_pos`, `after_pos`) may be `null` = no data.
6. A Manual Run with no website is now the dispatch (it skips websites already checked today); give `{ domain }` for one website.

## Fix wave 2 (2026-10-29)

Branch `ix/engine` at the integration head `3b0a8cab`. The engine findings of REVIEW_2.md (N1-N7, N9-N13) and the engine half of its
"partly" rows (E10, X2, X8, X17). Nothing deployed, no paid API, nothing pushed. Among the generated workflows only
`workflows/SEO_Agent_Index_Coverage.json` changes (156 nodes, was 135); the catch-up did not need to change.

**How it was tested.** Docker did not answer on this machine (another session's containers), so the whole harness ran with the host's
Node 22 (`~/.local/node-v22.11.0-darwin-arm64/bin/node`) in a copy of `n8n/seo-agent`: `cd <copy>/harness && CODE_DIR=<copy>/harness/code_v4
OUT_DIR=<copy>/harness/out node scenarios_v5.js`. Every scenario ran there (none needs an n8n-only module). Integration head on the same
host Node: **13788 passed, 0 failed**. After: see the last line of this section. New `harness/scenarios_index_fix2.js` (IXW1-IXW14): a
website is run DAY AFTER DAY through the generated Code nodes with a pinned clock, the rows each day writes are applied as the Data Table
nodes would (upsert on `site_id + url` over every matching row, delete by url, history re-pointed) and the next day starts from them. Run
alone against the integration head's `code_v4` (`CODE_DIR=<head>/harness/code_v4 node scenarios_index_fix2.js`) it gives **12 passed,
34 failed**: every scenario fails at least one check except IXW11 (N11, a control: no code change). Updated: IX8 (the summary keys, N12),
IX9 (the second run of the day is an on-demand run: a chain part now skips a site done today, N9), IXF4 / IX e2e (the upsert's answer is
mocked, N1), IXF6 (9 fetch nodes), IXF12 (prune entries carry `why`); the two helpers run Page First Reads.

### Per finding
| id | status | how | harness |
|---|---|---|---|
| N1 | fixed | The redirect's final URL wins: a row moved by a same-site slash / case / www redirect (our read's `moved_to`, or Google's "Page with redirect" to the same key) gets the source `final`, and `merge` keeps a `final` row's address while the sitemap lists the other form (the sitemap form maps onto it; no flip-flop). A move clears the reading of the redirecting form (no prior row: state `unknown`, no `inspect_at`, so it is planned as never inspected; a prior row keeps its own reading and gets `next_check_at` = now). Deletes are the NET moves (stored url -> url now; a row moved by the merge and back by the redirect did not move) and never an address that is a row of this run; `Index Delete Rows` and `Index History Moves` act only when the new row is in `Save Index Pages`' answer. | IXW1 (6- and 5-day runs, failed save) |
| N2 | fixed | `next_check_at` is recomputed only after a Google reading (an inspection, or the Site Tracker's reused one), a failed inspection, or a move. A day with only our own read never moves it; a fix newly seen only brings it forward. Site-fix pages read daily, `fix_seen_at` pages and `links` pages are inspected on their schedule again, so `checks` grows and `needs_person` trips. | IXW2 (90 / 40 / 70 days) |
| N3 | fixed | `IX.fixState`: when a Google reading of the SAME cause has `last_crawl` after `fix_seen_at`, the fix expired: `fix_seen_at` cleared, `fix_failed_at` = that crawl, the step is `site_fix` again with the note "Google read this page again on <date>, after the change we saw on your site, and still sees the same problem. It may only be shown to Google's crawler (by a plugin, a CDN or a server rule). ..." No new `fix_seen_at` from the same fixed read while `fix_failed_at` is set; our read seeing the problem again (or Google's reason changing, or the page indexed) clears it, and a later fix is seen again. The re-checks count toward `needs_person`. | IXW3 (15 days) |
| N4 | fixed (engine side) | THE SHARED RULE, enforced in `Index Diagnose`: `fix_seen_at` non-empty = "fixed on your site, waiting for Google" = action `wait`, whatever the order of `fix_seen_at` and `inspect_at` (a page inspected in the same run or later keeps it while Google's crawl is older); the engine alone sets and clears it; cleared when Google reports the cause gone / the page indexed (never on an indexed row) or per N3. The app must read it the same way (`action wait && fix_seen_at` = pending, no `fix > inspected` test). | IXW4, IXW14 |
| N5 | fixed | Done today = a finished `seo_index_runs` row today, or two runs of the day that never finished (their reservations; the site waits for tomorrow). A site whose only row is a crashed run's reservation is taken again, last. The day's WATCH: after every dispatch (05:15, the catch-up, a Manual Run with no site, a watch) `Settle Run Ledger (Index)` -> `Index Watch Plan` -> `Wait (Index Watch)` (50 min; the waiting execution holds no guard slot and n8n keeps it across a restart) -> `Start Index Watch` (this workflow, `ix_watch: { date, n }`). The watch dispatch restarts the chain for the sites not done today; while a chain still runs it is refused by the guard and `Retry Index Part` starts it again 30 minutes later (a refused 05:15 dispatch the same way, instead of losing the day). A watch of another day does nothing; at most 30 a day; each watch starts the list one place further, so a site that always crashes before its reservation cannot hold the others. `Dispatch Start`'s comment now says this. Why 50 minutes: if n8n counted a wait in the 3,600 s execution limit, the dispatch still ends inside it. | IXW5 |
| N6 / X8 | fixed | New column `ask_google_at` (when a page was last newly marked, kept after the mark ends). At most 5 pages carry the mark at once and at most 5 are NEWLY marked per site in any 7 days (rolling); a marked page keeps its mark while it qualifies. The Monday reselect is gone. | IXW6 |
| N7 / E10 / X2 | fixed | Sitemaps: 7 rounds; a round reads a bounded batch (`IX.sitemapBatch`: 2 while nothing is known, then the addresses left under the cap divided by what a sitemap held so far, at most 10), nothing once 5,000 addresses are read; round 1 reads home, robots.txt and 2 roots and queues the other roots; unread items carry over. An index of 49 children of 6,000 addresses now reads 2 children (was 49 at once). Every sitemap and page fetch answers as a FILE (`responseFormat: file`, property `data`; production keeps binaries on disk, `N8N_DEFAULT_BINARY_DATA_MODE=filesystem`), so no body is in the run's saved data; `Sitemap Read n` and the new `Page First Reads` (after `Fetch Page (Index)`) read at most 8 MB / 3 MB of each with `this.helpers.getBinaryDataBuffer` and pass on only what they found; `Page Signals` reads the redirect hops' files the same way. A sitemap longer than 8 MB is read in part and the tree marked capped. | IXW7 |
| N9 | fixed | A chain part whose site is done today (a finished run row) does nothing ("already checked today") and the chain goes on. | IXW9 |
| N10 | fixed | `merge` keeps the NEWEST stored row of an address (`updated_at` / `inspect_at` / `fetch_at`) and prunes an older row on another form of the address by its exact url (`why: duplicate`); two rows with the very same url are never deleted (a delete by url would take both; the upsert writes both). | IXW10 |
| N11 | not changed (documented) | The engine cannot resolve or pin DNS: Code nodes run in the external task runner with no built-in modules allowed (`NODE_FUNCTION_ALLOW_BUILTIN` is not set in `deploy/gcp/compose.prod.yml`, so `require('dns')` fails), and the HTTP Request node has no option that refuses private addresses. What holds: only the site's own registrable domain is fetched, every URL is rebuilt from a strict parse (no userinfo, no backslash, no IP literal in any form, no `localhost` / `.local` / `.internal` / `.arpa`, ports 80 / 443 only), no fetch follows a redirect, and the domain is verified by its owner in the app. Residual risk accepted: a verified domain whose DNS points at an internal address is fetched on 80 / 443 (titles and canonicals stored). The real fix is outside the engine: an egress rule on the VM that denies RFC 1918, loopback and link-local (169.254.0.0/16, the metadata server) to the n8n and runner containers; or a DNS-over-HTTPS lookup (one HTTP node) before the fetches, which catches a static internal record but not rebinding. | IXW11 (control) |
| N12 | fixed | The callback of a run that could not read the website carries `summary.failed: true`, `checked: false`, `note` ("We could not check this website today: ... The figures are from the last check.") and `figures_from: 'last_check'` (a checked run: `failed: false`, `checked: true`, the run's note, `figures_from: 'today'`). The renderer warning is the app's (N-app-6). | IXW12, IX8 |
| N13 | fixed | Our own reader (`IX.xRobotsNoindex`, `IX.metaNoindex`; the shared `PW.signals` is untouched): an X-Robots-Tag rule is noindex only with no crawler named or named `googlebot` (`bingbot: noindex` is not; `max-snippet:-1, noindex` and `unavailable_after: ..., noindex` are); a `robots` or `googlebot` meta tag. | IXW13 (incl. a 3-day run) |
| X17 | engine side done | IXW14 writes `index_coverage_contract_rows.json` (OUT_DIR) from the real nodes: a page fixed on the site and inspected in the same run (`inspect_at >= fix_seen_at`), a fix Google did not take (`fix_failed_at`), an "ask Google" page with `ask_google_at`, a `redirect_error` row and a reservation run row. A copy is `docs/indexing-2026-10-29/contract_rows_wave2.json` for the app's fixture. | IXW14 |

### Contract changes for the app (all additive)
1. **THE SHARED RULE**: `fix_seen_at` non-empty = "Fixed on your site, waiting for Google" (action `wait`), regardless of `inspect_at`. Only the
   engine sets and clears it.
2. New `seo_index_pages` columns (`sync_tables.py` adds them on deploy): `fix_failed_at` (ISO of Google's crawl after the fix that still
   saw the cause; the row is `site_fix` and its note says so) and `ask_google_at` (when the page was last newly marked).
3. `sources` may contain `final` (the row lives where a listed form redirects to).
4. Callback `summary` gains `failed`, `checked`, `note`, `figures_from` ('today' | 'last_check').
5. More executions of `SEOagentIndexCv1` per day (the watch: at most 30, usually 1-3, mode `integrated`). The app's missed-run count
   (N-app-5) should be measured from `seo_index_runs`, not from the execution list.
6. A run row whose `sitemaps_json.reservation` is true and is the only row of its site today means that run did not finish; the site is
   retried by the watch.

### Deploy notes (owner, not done here)
`deploy_engine.py --apply` runs `sync_tables.py` first (the two new columns). The fetch nodes now answer as files: the production
instance already keeps binaries on disk (`N8N_DEFAULT_BINARY_DATA_MODE: filesystem`); n8n prunes them with the executions. First run
small, as before (Manual Run `{ "domain": "techand.ai", "cap": 20 }`), then read one dispatch's watch execution (it waits 50 minutes, then
starts `ix_watch`).

### What could not be tested offline
The HTTP node's file answer under `fullResponse` + `neverError` (read from n8n's HttpRequestV3 source: `statusCode` / `headers` in the JSON,
the body in binary `data`; the Code nodes also accept a text body), the Wait node with an expression amount, and whether n8n counts a
waiting execution's wait in `executionTimeout` (the 50-minute wait is chosen so it does not matter).

**Result**: full harness on the host Node, **13844 passed, 0 failed** (integration head 13788; +56: IXW1-IXW14 with 46 checks, and the
updated IX / IXF checks). Two builds of the same sources are byte-identical (the rebuild after the last source change left no diff).

## Fix wave 3 (2026-10-30)

Branch `ix/engine` at `7777e17d`. The engine findings of REVIEW_3.md: R2-R8 (R1 and R9 are the app's; R5 has an app half). Nothing deployed, no paid
API, nothing pushed. Among the generated workflows only `workflows/SEO_Agent_Index_Coverage.json` changes (183 nodes, was 156); two builds are
byte-identical. New `harness/scenarios_index_fix3.js` (IXR2-IXR8, 47 checks): run against `7777e17d`'s code_v4 and workflow
(`CODE_DIR=<old>/code_v4 WF_FILE=<old>/SEO_Agent_Index_Coverage.json node scenarios_index_fix3.js`) it gives **6 passed, 41 failed** (every
scenario fails; the 6 are controls: a 42-leaf tree, a small file still read, the inventory throwing, a page inspected, two chain cases that
must go on). The reviewer's probes re-run on the new code: `sm_many.js` 46 / 44 / 42 nested leaves all complete (was 840 / 880 addresses,
partial), flat 48 / 49 unchanged; `waitnew.js` day 0 `wait` (was `site_fix`).

### Per finding
| id | status | how | harness |
|---|---|---|---|
| R2 | fixed | New `Index Attempt` -> `Any Attempt?` -> `Save Index Attempt`, right after `Site To Check? (Index)` (after the run guard, before Search Console, the sitemap rounds and anything else that can fail): an unfinished-run row at the run's `site_id` + `run_at`, nothing inspected, `sitemaps_json` `{ reservation: true, attempt: true, chain_id }`. `Save Index Reservation` is now an **upsert** on `site_id + run_at` (was an insert), so the reservation replaces the attempt and the final row replaces both: still one row per run. `Index Plan`'s `doneToday` already counts unfinished rows: after `gave_up_after` (2) the website waits for tomorrow. An attempt row is never "the run before" (E3 lanes, `home_host_prev`). Alerts: the error workflow alerts each failed execution (it is another workflow and stays unchanged here; its 30-minute dedupe does not merge failures 50 minutes apart), so a website that always fails early now raises at most **2** alerts a day (was up to 30). | IXR2 (30 watches: 2 starts) |
| R3 | fixed | `sitemapAccept` gives each queued child its depth; an index read at depth >= 1 (an index of indexes) sets `deep_index`, and `IX.sitemapBatch` then reads `sitemap_batch_deep` (8) unknown-size sitemaps instead of 2, so the rounds spent on indexes do not count against the leaves. The address cap (5,000), the 50-sitemap queue cap and the 10-a-round maximum are unchanged; a root index listed only in robots.txt is depth 0 (still 2 first). `Sitemap Read n` now reads one answer at a time (wave 2 read every answer of the round first and held them all) and reads no more answers once the address cap is reached. | IXR3 (2 x 46, 2 x 47, 3 x 45, 5 x 44, 2 x 42 leaves: complete, <= 10 a round); IXW7 unchanged |
| R4 | fixed | `IX_Diagnose.js`: `else if (row.action === 'wait' && !d) row.action = 'site_fix'` (wave 1's guard restored): a fixed page whose new reading is `wait_new` stays `wait`. | IXR4 |
| R5 (engine) | fixed | `why` is plain words only: an exception in `Index Inventory` / `Index Diagnose` becomes `IX.PLAIN_FAIL` ("something went wrong on our side while reading it"), Google's own error text in `Index Sites` becomes "Search Console did not answer our request for this website"; `IX.plainWhy` guards every place that writes the note (run row, `summary.note`, report). The raw text stays internal: `why_detail` on the Diagnose item, `gsc_error_detail` on the Index Sites item, and `sitemaps_json.error_detail` on the run row. The note no longer contains "inventory failed:" at all, so the app's `indexingNoteText` replacement becomes a no-op (the app half of R5, the duplicated "last check" sentence, is the app's). | IXR5 |
| R6 | fixed (bounded; n8n gives no partial read) | Read from the n8n 2.41.4 image: the runner exposes `getBinaryDataBuffer` / `binaryToString` / `binaryToBuffer` (all whole-file, sent over the RPC as JSON) and `getBinaryStream` (a stream cannot cross the RPC), so a Code node cannot read the first N bytes. What it can do is know the size first: `IX.answerText` reads the binary's `bytes` (written by n8n on every stored file), its `fileSize` text, or the answer's `Content-Length`, and does **not** read a file above the limit (`sitemap_read_bytes` 8 MB, `page_read_bytes` 3 MB). A sitemap above the limit is named in `sitemaps_json.errors` ("larger than we read (8 MB): not read") and the tree is partial (wave 2 read its first 8 MB; that read is what could exhaust the runner); a page above the limit is "could not check" (never an empty 200, which would have read as a page with no noindex). The download itself streams to disk (HTTP Request V3 `useStream` for file answers). | IXR6 (the binary helper is never called above the limit) |
| R7 | fixed | Each self-start (`Start Index Part`, `Start Next Index Part`, `Restart Index Part`, `Start Index Watch`) -> `Load Start Alerts (x)` (this workflow's rows of `seo_ops_alerts`) -> `Index Start Alert (x)`: on an `{ error }` answer one `OA.plan` row (workflow, node, message; a repeat within 30 minutes is the same row and is not re-sent), then the Page Watch pattern: `Save Index Start Alert` -> `Index Start Send` -> `Post Index Start Alert` (`neverError` + `fullResponse`, the shared retry rule) -> `Index Start Delivery` (`AR.posted`, written back; a failure is re-tried by the sweep that ends every scheduled run). Two groups: the starts before the settle go on to `Index Report` on every branch (R31: the run still settles), the two after it end at their own delivery. state_lint C3 is satisfied by the delivery node. | IXR7 |
| R8 | fixed | Every chain part's rows carry the dispatch that started the chain (`sitemaps_json.chain_id`: attempt, reservation and final row). A chain part whose website was already checked today by ANOTHER chain (a final row with another non-empty `chain_id`) returns `stop_chain` and `Next Index Part` starts nothing: the two chains are one again. A website done by the same chain (a restarted part) or on demand (no `chain_id`) is skipped and the chain goes on (N9 unchanged). | IXR8 |

### Contract changes for the app (all additive)
1. **Attempt rows** in `seo_index_runs`: `sitemaps_json.reservation: true` and `attempt: true`, figures 0, `inspected` 0, note "Today's check started
   at HH:MM UTC and had not finished when this row was written; the figures are from the last check." The app already treats any reservation
   row as "the latest check had not finished" and never as a reading; the change it will see is that a run that died early now leaves such a
   row (before it left none). Two unfinished rows today = the website waits for tomorrow.
2. `sitemaps_json` gains `chain_id` (the dispatch's execution id, '' on demand) on every row of a chain part, and `error_detail` (internal, raw
   error text, at most 300 characters) on a run that could not read the website. Neither is for display.
3. A failed run's `note` / `summary.note` no longer contains "inventory failed:" / "diagnosis failed:" or any error text: "We could not check
   this website today: something went wrong on our side while reading it. The figures are from the last check."
4. `sitemaps_json.errors` may contain `{ url, error: 'larger than we read (8 MB): not read' }` (the tree is then `complete: false`).
5. `seo_ops_alerts` may carry rows of workflow "SEO Agent — Index Coverage" with node `Start Index Part` / `Start Next Index Part` /
   `Restart Index Part` / `Start Index Watch`.

### Deploy notes (owner, not done here)
No new table or column (`seo_ops_alerts` and `seo_index_runs` exist). `SEO_ALERT_WEBHOOK_URL` is substituted into the new `Index Start Send` /
`Index Start Delivery` nodes by the same placeholder step as every other alert node (`apply_env.py` / `deploy_engine.py`).

**Result**: full harness in Docker (`n8nio/n8n:2.41.4`), **13891 passed, 0 failed** (wave 2: 13844; +47 = IXR2-IXR8, no existing check changed).
