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
