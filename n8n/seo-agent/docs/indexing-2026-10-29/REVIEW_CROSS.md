# Index coverage: cross-cutting review (2026-10-29)

Reviewer: read-only pass over branch `feature/indexing` (head `d12654a2`; base `71e9d97c` on `feature/seo-agent-v4.5`) against
`DESIGN.md` (the contract), `ENGINE_BUILD.md`, `APP_BUILD.md`, the deploy tooling and `CLAUDE.md`. Nothing was edited, built, deployed
or run against production. Tests were not re-run; the counts quoted are the builders'.

Verdict: the contract holds end to end (names, types, codes, settings round trip, scheduled stage), the policy limits of DESIGN §8 are
respected, and the feature is safe to deploy for today's production (2-3 sites with Search Console). Two things should be fixed before
the client base grows (X1 time-out / quota burn, X2 execution data), four before the client is told "this gets your old pages in"
(X4, X5, X7, X8), and the CLAUDE.md follow-ups (X18) are not done.

---

## 1. End-to-end contract (engine daily run -> client screen)

Trace for one site (devaicon.com, `site_devaicon-com`): `Daily Schedule` 05:15 New York -> `Index Plan` (one item per tracked site with
`index_watch` not off, cap from `seo_monitors.index_daily_cap`) -> run ledger $0 + run guard -> Google events -> GSC property ->
`sitemaps.list` + Search Analytics `page x date` -> sitemap tree (3 rounds) -> `Index Inventory` (merge + plan) -> probe 2 inspections ->
the rest -> our own GETs -> `Index Diagnose` -> `Save Index Pages` (upsert) / `Save Index History` (insert) -> update impact ->
`Save Index Runs` -> `Index Report` -> (Mondays, drop-out, Google news, on demand) `POST Index Report` to the site row's `callback_url`.
App: `GET …/data/indexing` reads the tables by `site_id = n8nSiteId(domain)` (`app/server/src/services/indexing.ts:43-74`), the hook
stores the callback (`runs.ts` `ingestCallback`), recommendations and site tasks read the same tables with their own catch.

| Read by the app | Engine writes | Match |
|---|---|---|
| `seo_index_pages` 46 columns | `ladder_common.py` `INDEX_PAGES_COLS` (= `IX.PAGE_COLS`, asserted by the build) | names and types identical to `app/shared/src/tables.ts:355-363`; booleans (`in_sitemap`, `needs_person`) read with `b()`; JSON strings (`link_from`) parsed with fallbacks |
| `seo_index_history` | `INDEX_HISTORY_COLS` | identical; app filters `site_id` + exact `url` (the stored row URL, so the key matches) |
| `seo_index_runs` | `INDEX_RUNS_COLS` + `sitemaps_json` | identical except `sitemaps_json`, which the app type (`tables.ts:368-374`) does not declare and nothing reads (X5) |
| `seo_google_events` (global) | `GOOGLE_EVENTS_COLS` | identical; kinds / statuses mapped with an "other" fallback (`indexing.ts:541-554`) |
| `seo_update_impact` | `UPDATE_IMPACT_COLS` | identical; `pages_json` keys (`before_clicks`, `before_impr`, `before_pos`, …) read exactly (`indexing.ts:556-586`) |
| `seo_monitors.index_watch` / `index_daily_cap` | Site Admin `Admin_Action.js:69-84` validates, `Monitor_Row_Admin.js:42-43` stores, `Monitor_Row_Track.js:24-27` carries them | app `monitorsBody` sends them only when set (`payload.ts:73-75`); read back in `data.ts:1697-1699`. Only the two upsert nodes that write `seo_monitors` (Site Admin `Set Monitors`, main `Save Monitors (Track)`) are given the columns; the 10 other workflows only gained them in their Ensure schema (verified: no other writer, nothing wipes a stored "off") |
| callback `index_coverage` | `IX_Report.js:27-34`: `{stage, status:'complete', domain, site_id, request_id, summary{…DESIGN §5}, report_markdown, cost:{usd:0}}` + ledger fields | `summaries.ts:209-224`, `integrations.ts` (drop-out alert), `report-delivery.ts:210` (`complete` finished for this stage only), renderer, billing "free" |

Cause / action codes: the engine's 23 causes (`_index_kit.js:221-226`) = the app's 22 (`app/shared/src/indexing.ts:14-37`) **plus
`unclassified`**, which the app does not know and shows in an "Other" group whose copy contradicts the row's note (X6). Actions identical
(`indexing.ts:8`). States identical.

Settings round trip: the app's exported body ("index coverage: switched off, 500 checks a day", `harness/fixtures_platform_admin.json:176`)
is replayed by harness `W2FIX-3` (`scenarios_w2fix.js:79-94`) through `Admin Validate` -> `Admin Action` -> `Monitor Row (Admin)` and
asserts both columns stored with the exact column set. Good. Before the engine is deployed, the OLD Site Admin drops the two keys silently
(its `Monitor Row (Admin)` builds explicit columns), so the app must not go first (X12).

**Scheduled stage: decided.** The app did add `index_coverage` to both scheduled-stage lists (`app/shared/src/constants.ts:320`,
`app/server/src/services/runs.ts:649`); what it left out is `AUTOMATIONS` / `SCHEDULES` (`constants.ts:468`, `:596`), i.e. the Pipeline
"Always on" list and the platform admin's missed-fire count. Decision:
- keep it in `SCHEDULED_STAGES` (required: the Monday callback reuses the tracking-setup run's `request_id`; without it the report
  would be attached to that run as its own work and its cost counted to it, `runs.ts:652-661`, `:743`);
- keep it out of `AUTOMATIONS` (it has no cycle job and no "Run now" mode);
- add an `INDEX_COVERAGE_SCHEDULE` to `SCHEDULES` (like `PAGE_WATCH_SCHEDULE`, `constants.ts:584-594`) **right after** the engine deploy,
  with `since` = the workflow's `createdAt` on production. `loadDeliveryReport` passes no `created` map (`delivery.ts:360`), so `since` is
  the only thing that stops pre-deploy fires being counted as missed; that is exactly the app builder's worry, and `since` answers it.
  The engine side (catch-up `EXPECTED`, `_CYCLE_DAILY98`) is already right. (X10)

## 2. Findings

| id | sev | where | scenario | fix (one line) |
|---|---|---|---|---|
| X1 | **High** (latent) | `IX_Plan.js:28-30`; `build_index_coverage.py:81` (batch 1, 150 ms), `:234` (timeout 3600 s); `_catchup.js:42,153,165` | All sites run in ONE execution, inspections strictly sequential (~1.5-2 s each incl. the 150 ms gap), saves only at the end, and no run-wide budget. 7 sites with a backlog at the default 300, or 2 sites at the allowed 1,200, pass 3,600 s. The run is `canceled`, nothing is saved (no `seo_index_runs` row, so `used_today` stays 0), the catch-up treats `canceled` as dead and starts it again up to 3 times: each replay re-spends the same inspections, up to 4x the cap per property per day, which can use the whole 2,000/day URL Inspection quota the Site Tracker and audits share; the open ledger row also holds a run-guard slot for 2 h. | A run-wide inspection budget (e.g. 1,200 per run, sites rotated by oldest run) and write each site's run row + page rows before the next site (or one sub-execution per site); until then cap the UI at 500. |
| X2 | Medium | `build_index_coverage.py:234` (`saveDataSuccessExecution: 'all'`), `:142-144` (page GETs, full HTML), `IX_Pages_Query_Requests.js:9`; `compose.prod.yml:155-158` (14 days), RUNBOOK §2 (20 GB data disk) | Every execution stores the full HTML of up to 60 pages a site, up to 25,000 Search Console rows, every sitemap XML, and the whole page list copied through Inventory / Diagnose / Run Rows / Report. Today ~2-10 MB a run; a 5,000-URL client ~40-60 MB a run, ~0.6-0.8 GB in the 14-day window, held in n8n's 1 GB heap during the run. Do NOT simply set `none`: the catch-up decides "fired" from the execution list (`_catchup.js:165`) and would replay every day. | Fetch pages in a Code node (`this.helpers.httpRequest`) keeping only the parsed signals, pass slim page lists between nodes; or `none` plus a catch-up rule that reads `seo_index_runs`. |
| X3 | Medium | `IX_Pages_Query_Requests.js:9` (`page,date`, `rowLimit 25000`, one request); `_index_kit.js:160`; `IX_Inventory.js:37` | `page x date` over 90 days passes 25,000 rows once ~280 pages have impressions most days. The answer is still `read: true`, so pages cut off get `impressions_28d = 0` / `last_impression_at = ''` written over the stored values, wrong numbers on the Indexing page, and they enter bucket 2 ("indexed page lost all impressions") and spend inspections. Only a run note says so (`IX_Run_Rows.js:24`). | Page with `startRow`, or query `page` only for the 28/14/7-day windows (3 requests); when truncated keep stored evidence for absent pages. |
| X4 | Medium | `IX_Diagnose.js:67`; `app/shared/src/integrations.ts:184-192` | A drop-out is any `indexed -> not_indexed OR excluded`, including intended exclusions (`redirect` leave_out, `alternate`, `noindex_intended`, `low_value`, `not_found` leave_out). A client who 301s an old page gets a same-day callback and a **high** `alert.raised` to Slack / Teams / webhooks "1 page dropped out of Google search". | Count a drop only when the new action is not `leave_out` / `none`, and when the indexed state came from an inspection (or confirm on a second reading). |
| X5 | Medium | DESIGN §8 ("raise a site task when no sitemap is submitted / it has errors"); `IX_Run_Rows.js:20-21,31`; `app/shared/src/tables.ts:368-374` | The engine detects "no sitemap submitted" / "sitemap errors" and writes `sitemaps_json`, but the app neither declares nor reads it; the client sees it only inside the run note. On a young site this is one of the few concrete fixes. | Add `sitemaps_json` to `IndexRunRow`, a site task `indexing:sitemap` with a guide (submit in Search Console, fix errors), done by the next engine reading. |
| X6 | Low | `_index_kit.js:226,250,356`; `app/shared/src/indexing.ts:14-37,592` | `unclassified` (engine addition, ENGINE_BUILD §7.1) falls into the app's "Other" group: "A reading we do not have words for yet … Nothing for now", while the row note says "Check this address in Search Console". | Add `unclassified` to `INDEX_CAUSES` / `INDEX_CAUSE_INFO` / history labels with the engine's sentence. |
| X7 | Medium | `_index_kit.js:295` (a fetch overrides only SOFT causes), `:464-478` (`nextCheck` 7/14/28 d); `IX_Diagnose.js:73` (`needs_person`) | After the client fixes a `noindex` / robots / canonical step, the app's own check marks the step Done, but the engine keeps the old enum cause until its next scheduled inspection (up to 28 days) and nothing brings it forward. The Indexing page still shows "Remove the noindex" under a Done step; `needs_person` can trip on Google's lag. There is no "fixed on your site, waiting for Google" state, which is the owner's "re-verify" ask. | Site Admin action (or app-side flag) that sets `next_check_at = now` for a done step's URLs, and a row state "fixed on site, waiting for Google" when today's fetch contradicts a stored block. |
| X8 | Medium | `RESEARCH.md:72,260` vs `app/shared/src/guides.ts` (no mention) | For old pages Google has not crawled, the one official per-URL nudge a client can use is Search Console's manual "Request indexing" (small daily limit). Research says it is legitimate for a few important canonical pages; no group, step or guide mentions it. | In the `links` / `wait` groups: "for your 3 most important pages, press Request indexing in Search Console", with a guide; still nothing submitted by us. |
| X9 | Medium (deploy) | `deploy_manifest.json:61` (published on deploy); `IX_Plan.js:15-17` (no domain = every site); Manual Run = `executeWorkflowTrigger` passthrough; Test Runner is `never_deploy` | Publishing turns the 05:15 run on for every site with Search Console at 300 a day (empty `index_watch` = on). ENGINE_BUILD §3.4's "first run small with cap 20" has no door on production except the editor; an editor run started from Manual Run WITHOUT pinned `{domain, cap}` is the all-sites run at full cap. | RUNBOOK step: pin `{ "domain": "techand.ai", "cap": 20 }` on Manual Run before executing; deploy at least 2 h before 05:15 New York. |
| X10 | Low | `app/shared/src/constants.ts:596`; `delivery.ts:360`; `deploy/gcp/RUNBOOK.md:248` | The third daily cron is invisible to the platform admin's missed-fire report and the RUNBOOK still says "the two daily crons left". A schedule that silently stops is only caught by the catch-up. | Add `INDEX_COVERAGE_SCHEDULE` to `SCHEDULES` with `since` = prod `createdAt` after deploy; update RUNBOOK §8. |
| X11 | Medium (rollback) | base `app/server/src/services/siteTasks.ts:226` (`kind === 'indexnow' ? … : checkRedirect`) | Rolling the API back leaves `site_tasks` rows of kind `indexing`; the old app checks any unknown kind as a redirect every day and renders it as one. | Rollback step: delete (or set skipped) `site_tasks where kind = 'indexing'` before reverting the API. |
| X12 | Low | old `Monitor_Row_Admin.js` (explicit columns); old `isScheduledCallback` / `finishedStatus` | App before engine: a client's "Indexing off" save is dropped silently by the old Site Admin and the page promises "results after the next daily check". Engine before app on a Monday / drop-out day: the callback is stored as a non-scheduled report of the tracking-setup run, `lastStage` changes, `complete` is not finished, so it is held. Harmless, confusing. | Engine first, API the same day, not on a Monday. |
| X13 | Low | `_index_kit.js:519-520` | First run: an update rolling out, or one that completed recently with no stored row, counts as "news today", so every site gets a same-day callback on day 1. | Treat the first reading of the feed as a baseline (as the policy page already is). |
| X14 | Low | `app/web/src/marketing/content/solutions.ts:87`; `features.ts` index-coverage benefits / facts; changelog 4.5 | "Every page in Google, or a reason why not" reads as an outcome promise; "checked every day" / "You hear when a page drops out … the day we notice it" while indexed pages are re-inspected every 28-56 days (drop-out lag up to 8 weeks unless impressions vanish). Policy otherwise clean: no Indexing API, no sitemap submit, no PUT/PATCH/DELETE (asserted by `build_index_coverage.py`), "Improve this page" is a click-to-approve Write-a-page; the FAQ says "No tool can promise that". Copy grep of the diff: no em dash, curly quote or "…" in customer text (only in code comments / sanitising regexes). | "Every page accounted for: in Google, or the reason why not"; "your site is checked every day, each page on its own schedule". |
| X15 | Low | `app/server/src/services/indexing.ts:35`; `server/src/n8n/client.ts:347` | Each Indexing view reads up to 5,000 rows as 20 n8n API calls (cached 60 s); a 5,000-URL site is ~6-10 MB in an app with a 300 MB heap and a 96 MB read cache. Fine today. | Serve the hero from `seo_index_runs` and page the groups server-side when sites grow. |
| X16 | Low | Site Admin delete removes only `seo_sites` / cycles | `seo_index_*` rows of a deleted website stay and come back if it is re-added (same pattern as `seo_page_watch`). No size problem (see §4). | Delete the site's rows in the five tables on site delete; cap history at 13 months. |
| X17 | Medium (test) | `app/scripts/ix_indexing_fixture.ts` (hand-made rows); `harness/out/index_coverage_techand_*.json` (engine output, unused by the app) | No test feeds the engine's real rows and callback into the app (`indexPageOf`, `buildIndexingData`, `summarize`, `eventsFor`, `finishedStatus`). The other direction exists (`fixtures_platform_admin.json`). APP_BUILD: "Not tested against a real engine". | Export IX8's rows + callback into `app/shared` fixtures and assert the page figures and the stored report. |
| X18 | Medium (process) | `CLAUDE.md` Working rules | Not done: tutorial videos (no index coverage tutorial in `alaventra-sandbox-video/data/tutorials.json` / `references/platform.md`; the sidebar and "Tracking & monitors" settings changed, so settings tutorials are stale), the website tutorials page, the CLAUDE.md status section and workflow table entry, RUNBOOK §8. Done: `app/API.md`, changelog, features registry, guides (81, count fixed), `SITE_TASKS.md`. | Do them in the same piece of work before release. |
| X19 | Low | `_run_guard.js:19` (MAX_OPEN 3); `_cycle.js:706` | The run holds one guard slot for its whole length; with Page Watch (05:45) and AI Pulse (06:30) it can delay a New-York-zone site's 06:00 cycle jobs. | Fine at today's size; X1's budget keeps it short. |
| X20 | Medium (deploy) | `git log origin/main..feature/seo-agent-v4.5` | `feature/indexing` vs `main` touches only this feature (the pre-Wave-0 steps are byte-identical builds). `feature/seo-agent-v4.5` now also holds Wave 0 Batch 1 (`SEO_Agent_v4.json` +635 lines, W0-A/D/F app changes), not released. Merging indexing there first and deploying from it ships Wave 0 too. | Deploy from `feature/indexing` (or main + this PR only). |

Verified as fine (no finding): `sync_tables.py` only POSTs missing columns to existing tables and skips tables that do not exist yet
(new tables come from the workflow's Ensure nodes on the first run); `deploy_engine.py --apply --create-missing` runs `sync_tables.py`
before any workflow change, imports the new id, then publishes; the catch-up does not replay the day of creation
(`_catchup.js:137`, `createdAt > due`) and refuses double starts through the run guard's twin rule (`_run_guard.js:110`, a batch run is
the twin of any run of its mode) and the cap's `used_today`; the run reserves and settles $0 like Page Watch; no app migration; every
new app read is wrapped (`indexing.ts:58-66`, `recommendations.ts` `.catch(() => null)`, `siteTasks.ts` `indexingReading` try/catch),
and a missing table answers `[]` (`client.ts:340-341`).

## 3. Safe deploy sequence and rollback

Preconditions: deploy from `feature/indexing` (X20); not Monday 07:00-16:00 UTC; the deploy guard clear; at least 2 h before the next
05:15 New York fire (X9); a weekday that is not Monday so the first callbacks are not sent before the API knows the stage (X12).

1. **Backup**: `deploy/gcp/backup.sh` (both databases to the bucket); note the run.
2. **Engine dry run**: `deploy/gcp/tunnel.sh`, then `python3 deploy/gcp/deploy_engine.py` - expect exactly: `SEOagentIndexCv1` missing,
   updates to Site Admin, main v4 (Monitor Row Track), Schedule Catch-up and the 10 schema-only workflows; `sync_tables` would add
   `seo_monitors.index_watch`, `index_daily_cap`. Anything else = stop.
3. **Engine apply**: `deploy_engine.py --apply --create-missing`.
4. **Verify the engine**: the workflow is active; in the editor (tunnel), pin `{ "domain": "techand.ai", "cap": 20 }` on *Manual Run*
   and execute once (never unpinned); read `seo_index_runs` / `seo_index_pages` through the public API (tables now exist), check the
   run note, the ledger row settled at $0, inspections <= 20.
5. **API**: on the VM, detached checkout of the same commit, `docker compose … up -d --build app`; health check; no migration.
6. **Web**: merge the PR to `main` (Vercel deploys); open the Indexing page of techand.ai and devaicon.com; save the Indexing switch
   once on a test site and read it back.
7. **Next morning**: watch the 05:15 run (duration, inspections per site, quota notes); then add `INDEX_COVERAGE_SCHEDULE` with
   `since` = the workflow's `createdAt` (X10) and update RUNBOOK §8 / CLAUDE.md.

**Rollback**
- Soft: `index_watch = false` per site (Site Admin `monitors`), or `POST /api/v1/workflows/SEOagentIndexCv1/deactivate` (the catch-up
  then reads it as inactive and replays nothing).
- Engine: deactivate as above, then `deploy_engine.py --apply` from the previous commit's checkout (restores Site Admin, main v4,
  catch-up). The two `seo_monitors` columns and the five tables can stay (nothing else reads them) or be dropped through the API.
- App: first delete or skip `site_tasks` rows with `kind = 'indexing'` (X11), then redeploy the previous image; stored
  `index_coverage` reports stay and render generically.
- Web: revert the PR on `main`.

## 4. Production load

Assumptions: URL Inspection ~1.5-2 s a call including the 150 ms gap; own GETs 5 at a time, 250 ms apart, 20 s timeout.

| | techand.ai (~85 known) | devaicon.com (~29) | 5,000-URL client |
|---|---|---|---|
| Day 1 inspections | ~25-45 (pages with impressions are indexed by search evidence; the 14 known 404s are not inspected again once seen gone) | ~19 (10 by evidence) | 300 (cap); backlog ~3,500 unknown -> about 12 days |
| Own page reads | <= 60 (not-indexed only), ~10-20 | <= 19 | 60 |
| Run time | ~2-4 min | < 1 min | ~10-12 min alone; X1 beyond ~6 such sites |
| Row writes day 1 | ~85 upserts, ~85 history, 1 run | ~29 / ~29 / 1 | ~5,000 upserts, ~5,000 history (minutes of Data Table writes) |
| Row writes later | pages with impressions change daily (`impressions_28d`), so ~40-50 upserts / day | ~10-20 / day | up to ~2,000 upserts / day |
| Tables after a year | pages ~0.1 MB, history < 0.2 MB, runs ~0.7 MB | smaller | pages ~7.5 MB, history ~5-8 MB (5,000 + 2-4 changes per not-indexed page), runs ~0.7 MB |
| Execution data (14 days kept) | ~2-10 MB a run | ~1-3 MB | ~40-60 MB a run, ~0.6-0.8 GB (X2) |

n8n Data Tables limit on production is 1 GB (`N8N_DATA_TABLES_MAX_SIZE_BYTES`), so the tables themselves are not a concern; the n8n
execution history (X2) and the single-execution time-out (X1) are. Retention: none needed for page rows (bounded by 6,000 a site); keep
history 13 months and runs ~400 days, and delete a site's rows on site delete (X16).

## 5. Owner's asks (OWNER_BRIEF) vs delivered

| # | Ask | Status | Why / note |
|---|---|---|---|
| 1a | One engine, LIVE and BACKLOG lanes | Delivered | `new` (ours / new in sitemap, 30 days) and `existing`; tabs in the app |
| 1b | Backlog from sitemap, crawler, Search Analytics, previously published | Delivered | sitemap tree, `seo_pages` inventory, `sitemaps.list`, Search Analytics 90 days, content log (`seo_ladders` deliberately not read) |
| 1c | Check a few hours after publish | Partly (by design) | day 1/3/7/14/28: inspection reads Google's stored state |
| 1d | Quota manager (~2,000/day, 30% live) + backlog progress in UI | Delivered, simpler | fixed cap 300 (20-1,200) + lane order; "checked N of M, about D days"; not shared with Site Tracker / audits (ENGINE_BUILD §8.2); X1 |
| 2a | Decision engine by cause, group by root cause | Delivered | 23 causes -> 6 action classes, one group per cause, one site task per site-fix cause |
| 2b | Technical fix + resubmit | Partly | fixes are client steps we verify; no resubmit (needs write scope, unchanged resubmit does nothing); sitemap "not submitted" detected but not shown (X5) |
| 2c | Orphan / discovered -> internal links, sitemap lastmod | Partly | concrete link suggestions (<= 5 indexed pages) per page; no lastmod advice; no "Request indexing" hint (X8) |
| 2d | Crawled-not-indexed -> rewrite | Delivered as approval-only | "Improve this page" one at a time, frozen during updates |
| 2e | Duplicates -> merge / canonical; low value -> never force | Delivered (suggestions) | `merge_into` = Google's canonical; `leave_out` for low value |
| 3 | Content module: brief, draft, quality gate, side-by-side diff approval, publish, resubmit, re-verify | Partly | reuses Write-a-page with the existing URL (its gates and credits); no side-by-side diff; no resubmit; re-verify only on the normal re-check schedule (X7) |
| 4 | Autonomy Off / Approval / Auto per action | Partly (by design) | on/off per site; improvements approval-only; site fixes are the client's; no Auto (scaled content abuse risk) |
| 5a | Pipeline stage between technical and backlinks; backlinks wait; GEO on indexed only | Not delivered (DESIGN §8) | would change live features |
| 5b | UI card with New / Existing tabs, counts by cause, "fix all with this cause", weekly report lines | Delivered | Indexing page; one step per cause (<= 25 URLs listed); Monday callback |
| 6 | Guardrails: daily cap, cooldown + max retries -> manual review, official signals only, no guarantee | Delivered | cap, 7/14/28-day re-checks, `needs_person` after 4 unchanged re-checks, no Indexing API; backup / rollback / bulk preview not needed (nothing is changed) |
| 7a | Re-inspect indexed pages weekly, drop-outs back into the engine | Partly | every 28 / 56 days, plus a 7-day re-check when a page lost all impressions for 14 days; drop-out alert too broad (X4) |
| 7b | Per-page performance drop vs 28-day baseline, stale content | Not delivered | only the "lost every impression" signal; decay stays in the Site Tracker |
| 7c | Watch Status Dashboard / Search Central / spam policies | Mostly | dashboard feed + spam-policies fingerprint; Search Central blog not read |
| 7d | Versioned human-approved policy checklist | Not delivered (DESIGN §8) | change alert only |
| 7e | Core update freeze-wait-compare-segment, only dropped pages reviewed, gained never touched | Partly | freeze + before/after per page delivered; no recommendation is raised for the update's dropped pages (only shown on the page) |
| 7f | Roll back a rewrite that performs worse | Not delivered | no rewrite is made by us; nothing measures an approved rewrite afterwards |

**Concrete recommendations for old non-indexed pages (young site, 19 of 29 without impressions):** yes per cause - a site step for
noindex / robots / 404 / not in sitemap / canonical, "link to it from these pages" with named pages, "Improve this page" for
crawled-not-indexed, "give it time" for new pages. Missing: the sitemap-submission step (X5), the manual "Request indexing" hint (X8),
a pointer to earning external links (the Link Builder exists), and "links" recommendations are only `low` priority
(`recommendations.ts:512`) although they are the main lever on a young site.

**What devaicon.com would see**
- *Deploy day, before the first run*: the Indexing menu item; an empty state "The first results appear after the next daily check".
- *Day 1 (after ~09:15-10:15 UTC)*: "Google has 10 of your 29 pages that should be in search", "N need you", existing pages checked
  29 of 29; groups by cause for the 19 (most likely discovered / crawled not indexed / unknown to Google), each with what it means,
  what we do, what you do, link suggestions in the page details; site steps for any site-fix cause; `ix:*` recommendations. No report
  e-mail unless a Google update started or finished (X13); the first weekly report Monday 2026-11-02.
- *Day 3*: almost unchanged. Not-indexed pages are re-inspected on day 7; a page that starts getting impressions flips to indexed from
  search data; a step the client fixed is re-checked by the app daily, but the page group keeps Google's old reason (X7).
- *Week 2*: day-7 re-inspection of the 19, a second Monday report, `checks = 2`; history rows only where Google's reason changed;
  "needs a person" only after the 5th unchanged reading (about day 77).

## 6. CLAUDE.md requirements and missing tests

Missing (X18): tutorial(s) and re-captures in the video-skills repo, the website tutorials page, the CLAUDE.md status section and the
workflow / table lists, RUNBOOK §8 "daily crons", and the delivery-rate schedule (X10). Present: `app/API.md`, changelog 4.5,
features registry + pricing + solutions + how it works, guides (81), `app/docs/SITE_TASKS.md`.

Tests that should exist: engine output -> app contract fixture (X17); a multi-site / time-out scenario for the single execution (X1);
drop-out cases for intended exclusions (X4); truncated Search Analytics answer keeps stored evidence (X3); app rendering of
`unclassified` (X6); an app rollback check that old code is not handed `indexing` tasks (X11); a live dev-stack smoke (`smoke.py`) and a
posted `index_coverage` callback through `/api/hooks/n8n/:token` (APP_BUILD "Not tested").
