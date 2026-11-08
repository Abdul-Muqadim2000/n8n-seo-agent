# KI review: performance, cost, safety and blast radius (2026-11-08)

Independent adversarial review, read-only. Frozen snapshot `.claude/worktrees/ki-review` at `1e977e8f`, production base `461445de`.
Read: CLAUDE.md engine rules, DESIGN.md sections 5 / 7 / 8, CONTRACTS.md, R5_DATAFORSEO.md (prices, section 13), `build_ki.py`,
`v5/code/_ki_io.js`, every `v5/code/KI_*.js`, the `_ki.js` keying rules, `dfs_gate.py` + `_dfs_retry.js`, `build_api.py` /
`build_site_tracker.py` / `Admin_Action.js` / `Monitor_Row_*.js` diffs, `_serp_url.js`, the generated workflows (node by node), and the app
(`routes/ki.ts`, `services/ki.ts`, `services/kiData.ts`, `services/runs.ts`, `routes/runs.ts`, `apiV1.ts`, `exports.ts`, `shareLinks.ts`,
`report-delivery.ts`, `cost.ts`, `OrgLayout.tsx`, `CompetitorDrawer.tsx`). Builder reports (W0 / E2 / A1 / OPEN) read only after.

## Verdict

- **Deploy with both sites Off: safe.** No Blocker. Every non-KI node change is accounted for (section 1) and is either the SERP-GOTO kit
  (expected), the new cost-table keys inlined with `_cost_cal.js`, the three `ki_*` monitor columns, Site Admin's appended KI branches, or
  the front-door router. Order: `sync_tables.py` before the import (see 1.4).
- **Trial: fix H1 first** (or run Trial only inside the owner's own company). A Trial run is charged to the company it runs in and the run
  itself is visible to that company, while its reports are hidden.
- **On for any client: fix H2 first.** The two plain GETs (homepages, sitemaps) are not the SSRF-guarded reader the design promised and
  have no size cap: one member of one company can make the shared engine fetch anything a redirect points at, or run it out of memory.
- Money is otherwise sound: the plan is held under the quote by construction (competitors max $0.3197 vs $0.35, keyword research max
  $0.8072 vs $0.90), the ledger reserves on the main path and settles at both ends, retries re-send only failed (unbilled) tasks, cache
  hits cost 0, refused / failed runs are charged 0, partial runs are charged what they measured, capped at the quote.

Counts: Blocker 0, High 2, Medium 6, Low 9.

## 1. Blast radius (Off sites)

### 1.1 Generated workflows, 461445de -> 1e977e8f, node by node (20 non-KI workflows changed)

| Change | Where | Verdict |
|---|---|---|
| SU kit (`_serp_url.js`) inlined into every gated `* Answers` node (116 lines, `SU.fixAnswer(a)` on the way out) | every workflow with a DataForSEO gate (main 25 nodes, AI Vis, AI Growth, BL, LB, Tracker, Site Tracker, Keyword Check) | expected (SERP-GOTO); clean answers return the same object |
| SU + `SC` (day cache) and `RS` (`_rank_serp.js`) readers: `SU.fixItems`, `SU.poisoned`, `SU.unresolved`, `url_exact` checks | SERP Cache * nodes, Ladder Clusters / Plan / Cluster Requests, Pick Top 6, Collect Facts, Analyze Competitor Pages, Regulatory SERP Candidates, Parse Positions, Tracker Plan / Report, Cadence Plan, AI Rank Plan / Requests / Fetched, Assess *, AI Plan / Report / Extras / Vis Rows / Prompt State Rows (1-line `url_exact` guard) | expected (SERP-GOTO); see M6 and L1 |
| `_cost_cal.js` +5 lines (EST / DFS_EST `competitors`, `keyword_research`) | every node inlining CC: all `Ledger Settle (*)`, Run Ledger Row / Settle, Rate Limit, Cost Calibration Row, Build * Report / File, Finalize Verdict | inert for other modes (new keys only) |
| Ensure Monitors Table columns + 3 `ki_*` | 11 workflows | inert (createIfNotExists never alters an existing table) |
| `Monitor Row (Admin)` / `Monitor Row (Track)` +ki fields; `Set Monitors` / `Save Monitors (Track)` schema +3 | Site Admin, main | correct: a field not given is kept as stored; Track carries stored values (`Monitor_Row_Track.js:34-38`). These are the only two writers of `seo_monitors` (checked across all workflows) |
| `Admin Action` (+ki validation), `Admin Validate` (+2 actions), `Admin Route` (+2 outputs **appended** at 10 / 11; outputs 0-9 unchanged), 10 new KI nodes, delete chain +4 KI deletes before `Delete Site` | Site Admin, Admin API | correct; the KI deletes are `continueRegularOutput` so a missing table cannot stop a site delete |
| `Quick Validate` (+2 modes, `target`), `Start Which Run?` IF, `Start KI Run` | API front door | correct: `First Or Repeat` spreads Quick Validate (`...q`), so `target` reaches the IF; every non-KI mode takes the false branch to `Start SEO Run` exactly as before; build asserts both starts are after the 202 and the idempotency decision |
| Cycle Dispatcher, Index Coverage, Page Watch, Reply Reader, Content Cadence, Page Finalize, Audit Scheduler, AI Pulse, AI Pilot | only the CC / Ensure / RS lines above | inert |

No other workflow reads `seo_ki_*` or `ki:kill` (only KI and Site Admin), so Trial is "nothing else reads the KI tables" as contracted.

### 1.2 App, Off sites
- Run creation: `assertKiRunAllowed` returns at once for non-KI modes (`services/ki.ts:218`). Cost table: new keys only; the `discover` fix
  (no page quoted) is safe because the discover schema forces `receiveContent` false (`schemas.ts:262`).
- Report delivery / share / API v1 / events: only KI stages are touched (`report-delivery.ts` `trial` hold, `finishedStatus` partial for the
  two KI stages only).
- Nav: `OrgLayout.tsx` now calls `GET .../ki` for every verified website (`useKi`, staleTime 60 s). For an Off site that is one monitors read
  (ReadCache) + `kiCredits` (settings + `estimateCost` x2, engine cost table cached). Not literally "byte-identical" for Off, but harmless;
  a read error hides the links.
- Recommendations / Pipeline: `kiForRecs` runs for every verified site but returns null unless On; any error is null (`recommendations.ts`).

### 1.3 MCP / API v1
`get_table` gains four KI tables, On only, else answered as an unknown table (`kiData.ts:440-441`); company via `siteOf`; reports exclude
Trial in SQL (`apiV1.ts:351`). `list_modes` hides the two modes (`apiRuns.ts:188`). `orgs.ts:153` still lists both modes' prices to every
company (L7).

### 1.4 Deploy order (not a defect, a precondition)
`Set Monitors` (Site Admin) and `Save Monitors (Track)` auto-map the three new columns. Imported before `sync_tables.py` adds them to the
production `seo_monitors`, both writes fail for every website (Site Admin `monitors`, Track my site). `deploy_engine.py` runs the sync first;
keep it that way, and publish `SEOagentKIntel1` in the same deploy as the front door (`deploy_manifest.json` does).

## 2. Money

Estimate vs quote (computed from `KI_Plan.js` and `_ki_io.js` PRICE / CAPS, every results page counted as a miss):

| Run | Fixed part | Profiles / competitor lists | Plan estimate (max) | Engine quote | App quote |
|---|---|---|---|---|---|
| competitors | 20 SERPs 0.040 + serp_competitors 0.018 + bulk TE 31 rows 0.0157 + bulk RD 31 rows 0.0251 + 2 x competitors_domain 0.0288 = 0.1277 | 4 x ranked 0.048 (cap = floor((0.35-0.1277)/0.048)) | **0.3197** | 0.35 | (0.35 + 0.02) x 3 / 0.05 = 23 credits |
| keyword_research | autocomplete 0.020 + ideas / suggestions / related 0.150 + page_intersection 0.072 + overview + intent 0.096 + Ads 0.090 + 60 SERPs 0.120 + TP 0.0192 = 0.5672 | 5 x ranked 0.048 | **0.8072** | 0.90 | (0.90 + 0.04) x 3 / 0.05 = 57 credits |

Every request the run actually builds is bounded by the same caps (Comp Labs `top` <= 31 targets, `cd_rivals` 1 + client 1, profile /
`comp_rk_cap` honoured in `KI_Comp_Profile_Requests.js:13` and `KI_Research_Discover_Requests.js:26`, overview / intent <= `top_n` 300,
SERPs <= `top_m` 60). Ledger: reserve on the main path, paid calls proven after it (`build_ki.py:327-329`), settle from `KI Report` and from
`Refuse KI Limit (KI)`, callback after the settle (R115). The gate retries only failures (`_dfs_retry.js:46-55`: 40102 / empty-with-result
is an answer, never re-sent), and counts both attempts once per task id. Cache hits are 0 (`SC` day cache, `ki:*` TTLs). App: refused /
failed -> `kiNoResultOf` -> run failed, charged 0; partial -> completed, charged the ledger figure, capped at the quote. The engine's
calibration rows (`cost:dfs:*`) are written only by the main workflow's Cost Calibration Row, so the app's KI quote stays the static ceiling.

Residual money risks: H1 (Trial charged to clients), M4 (one tenant can spend the platform's day), M5 (crash leaves spend unsettled),
L5 (Ads 12 / min), and an HTTP timeout (60 s) on a Labs call that DataForSEO did complete would be billed again on retry (rare; still
capped at the app quote).

## 3. Findings

### High

**H1. A Trial run is charged to the client company and the run is visible to it.**
- Where: `app/server/src/services/runs.ts:362,376` (`assertCredits` / `quotedCredits`, the only exemption is D3 `opts.free`);
  `services/ki.ts:217-224` gates who may start, not who pays; `kiReportVisible` is applied to reports only (`routes/runs.ts:99,111,122`).
- Scenario: the owner (platform admin, a member of devaicon's company) starts a Trial Competitors + Keyword research run for devaicon.com
  as planned in DESIGN section 8. 80 credits are locked and charged to devaicon's balance (or the run is refused if devaicon is low on
  credits). devaicon sees "Competitors" / "Keyword research" runs in Runs, on the run detail page (without reports), in Credits activity
  (`billing.ts:464-466` labels usage by mode), in API v1 runs and in the runs export - for results it cannot open. That breaks both
  "nothing is charged for our team's check" and "Trial never leaks".
- Fix: start a Trial KI run like D3's free research (quote 0, platform capacity still checked) and mark it (`input.kiTrial = true`); filter
  such runs out of runs lists, run detail, credit activity, API v1 runs and exports for anyone who is not a platform admin. Test: a Trial
  run leaves the client's balance and every client-visible list unchanged.

**H2. The homepage and sitemap reads are plain GETs with no SSRF guard beyond a host regex and no size cap (blocks On).**
- Where: `build_ki.py:191-195` (`Read Comp Homes`) and `:202-205` (`Read Comp Sitemaps`): `responseFormat: text`, full response, no
  `options.redirect` (n8n follows redirects by default), `timeout: 20000` (an idle-socket timeout), `retryOnFail` 3 x; the only guard is
  `KIW.publicHost` (`_ki_io.js:39-40`), a syntax check on the first host. Bodies are buffered whole and sliced afterwards
  (`KI_Comp_Result.js:26-27`; sitemaps are regex-scanned whole, `:52-55`).
- Who controls the host: any member of the company, through declared competitors (site settings / request `competitors` ->
  `KI_Plan.js:24,28` `declared` -> `chosen` -> `KI_Comp_Sitemap_Requests.js:7` GET `https://<host>/sitemap.xml`); or any site that ranks in
  the client's top 10 (homepages, `KI_Comp_Candidates.js:60-61`).
- Scenarios: (a) a declared competitor serves a multi-GB `sitemap.xml` -> the single n8n process on the 4 GB VM runs out of memory -> every
  running execution of every client dies (cross-tenant outage); (b) the host answers 302 to `http://<docker service>:<port>/...` or to a
  private address: the redirect target is never re-checked, a public name resolving to 10/172/127/169.254 (e.g. `*.nip.io`) also passes
  (blind internal GETs from the engine host); (c) a drip-fed response keeps the socket alive: the run hangs until the 1800 s execution
  timeout, no callback, ledger row left `reserved` (M5); (d) a homepage with thousands of unclosed `<script` tags makes the lazy
  back-referenced regex `<(script|style|noscript|svg)[\s\S]*?<\/\1>` (`KI_Comp_Result.js:27`) quadratic over 400 KB.
- Fix: read homepages through the existing Jina reader path with its W07-A fallback (third-party egress, capped), or keep the HTTP node
  but set `redirect.followRedirects: false`, follow at most 2 redirects in a Code node re-checking `publicHost` and refusing non-https, send
  `Range: bytes=0-399999`, and drop any response over the cap; never fetch a host that appeared in no results page (declared-only hosts get
  no sitemap read); replace the script-strip regex with a linear scan. Acceptance: a 302 to `http://n8n:5678/` and a 1 GB body are both
  refused without downloading.

### Medium

**M1. No concurrency cap on KI runs; one run holds tens of MB in the n8n process.** `KI_Limit.js` counts per day, the run guard refuses only a
twin (same site + kind). Each research answer exists twice in memory and in execution data (the HTTP node output and the `* Answers` copy
made by `SU.fixAnswer`): about 5 x 300 ranked rows (~3.5 KB each, `r5_shapes/labs_ranked_keywords.json`), 500 intersection rows (~3 KB),
60 SERPs, ideas / suggestions / related; roughly 15-25 MB of JSON per research run, several times that as heap, plus every Code node that
reads `$('... Answers').all()` copies it to the task runner. Twenty runs on different sites at once on the production single-process n8n
is a realistic OOM. Fix: in `After Run Ledger (KI)` refuse with "busy, try again in a few minutes" when more than 2 KI runs are open
(the open-runs read already exists); keep only the fields read in the Answers nodes (or a KI-specific compaction step).

**M2. The discovery / serp_competitors caches are keyed on a hash that changes every week, and `ki:*` rows are never pruned.**
`KI_Plan.js:46-47,58,67` and `KI_Research_Discover_Requests.js:18` key `disc` / `sc` on all seeds, and the seeds include the top 50
Search Console queries of the newest 28-day reading. When the weekly reading changes, the 30-day discovery bundle (~$0.15) is re-bought and
a new 100-200 KB `seo_cache` row is written; nothing deletes the old ones, `Load KI Cache` (`build_ki.py:159`) loads every `ki` row of the
site on every run, and Site Admin `delete` removes the four KI tables but not `ki:<site_id>:*` cache rows (`build_site_tracker.py`
`_ADM_KI`). "Repeat run inside the TTL = 0" holds only inside one GSC week. Fix: key `disc` / `sc` on the service seeds (and request seeds)
only; on save, delete `ki:<site>:disc|sc:*` rows older than their TTL; delete `ki:<site_id>:*` on site delete.

**M3. App: unbounded KI cache and 20,000-row reads.** `services/ki.ts:234-239` is a plain `Map` (no size bound, expired entries never swept);
`kiData` (`kiData.ts:136-140`) reads up to 20,000 keyword rows + 5,000 gaps + 2,000 competitors through 250-row pages, sequentially
(`n8n/client.ts:357`): 80+ round trips on every miss, i.e. every minute a page is open, after every KI callback and after every PATCH
(`done()` invalidates). Rows are never pruned in the engine (upsert per `kw_key`; a keyword that left the universe stays with an old
`run_id`), so the table only grows. Multi-instance: invalidation is local (stale up to 60 s; fine on today's single API instance). Fix: bound
the cache by bytes (reuse `ReadCache`), read keywords of the latest run(s) only (filter `run_id` or `updated_at`), prune KI_KW rows not seen
in the last N runs.

**M4. One company can spend the platform's daily search-data budget.** `KI_Limit.js:22,36`: per company 40 runs a day, platform
`dfs_budget_usd` $15. 17 keyword-research runs (different verified sites, or after the cache day turns) reach the budget, and every other
client's scheduled weekly jobs are refused `dfs_budget` for the rest of the day. Pre-existing mechanism, but KI brings the most expensive
on-demand modes. Fix: a per-company, per-kind KI cap (e.g. 3 a day per site; repeats are free anyway) and/or headroom reserved for scheduled
runs.

**M5. A run that crashes, times out or is killed spends money that is never settled and stops counting toward the day's budget.** KI Code
nodes have no `onError`; a throw, the 1800 s execution timeout (H2 c), a restart or a preemption leaves the ledger row `reserved`; after
`run_stale_hours` `KI_Limit.js:17-18` (and the main Rate Limit) treat it as stale and exclude it from the spend sums, and the error workflow
does not settle. The app closes the run failed and charges 0 (correct for the client), but the engine undercounts its own day. Pre-existing
for every monitor; worth fixing before monthly On refreshes. Fix: count stale reserved rows at their estimate in the budget sums, or let
the error handler settle from the gates' `__dfs` evidence.

**M6. SERP-GOTO keys of cut breadcrumbs collapse to the host in the ladder path (Off sites).** `_serp_url.js:111-112`: a `url_partial` result
is keyed `~host/...` with no path, so two different pages of one host (both breadcrumbs cut; 4 of 9 were cut in SERP_GOTO.md's live pair)
count as the same result in `Ladder_Clusters.js:81` / `Ladder_Plan.js` overlap; big hosts (vendors, directories, LinkedIn) then inflate
"3 of 7 shared" and merge searches that share only a site. The KI kit does the opposite and gives a partial result no key
(`_ki.js:170-171`), which is the safe rule. Fix: make `SU.key` return '' for `url_partial` (as `KI.urlKey`), and re-run the ladder
clustering fixtures.

### Low

- **L1** Rank Tracker: with SU a page not found while any organic result is unresolved reads `-1` (`Parse Positions`), and
  `Tracker_Plan.js:132` keeps `-1` on the weekly check instead of the monthly deferral for unpublished pages, so paid checks rise for every
  site if unresolved results are common. Measure on the production dump; if frequent, treat "not found among the resolved results" as 0
  when the unresolved items are all below the deepest resolved position.
- **L2** Trial leak through the run guard: `Refusal Notice (KI)` posts stage `rejected` without `mode: trial`, so a refused Trial attempt is
  an ordinary report the client can read. Add the mode, or have `kiReportVisible` check `body.mode` on `rejected` too.
- **L3** The app does not check the kill switch before a run (`assertKiRunAllowed`): credits are locked and released after the engine's
  `killed` refusal. Check `kiKillSwitch()` there.
- **L4** Balance floor fails open when the balance probe fails (`KI_Limit.js:29,37` `balance > 0`), same as the main Rate Limit.
- **L5** Google Ads 12 requests a minute: one task per research run, but parallel runs (and other Ads callers) are refused, retried after
  5 s as transient, and the section ends `missing`. Serialise Ads tasks or accept the partial.
- **L6** `CompetitorDrawer.tsx:105` renders `href={t.url}` from provider data without a scheme check (React 18 does not block
  `javascript:`). Allow only `^https?://`.
- **L7** `routes/orgs.ts:153` returns the two KI modes' prices to every company (MODE_IDS), visible wherever that price list is shown.
- **L8** `assertKiRunAllowed` reads `rows[0].ki_mode` (`services/ki.ts:207`) while `kiState` matches the row by domain (`kiData.ts:93`);
  they can disagree when the monitors read returns more than one row. Use the same lookup.
- **L9** Public repo: the r5_shapes `offset_token` values are truncated, but one still decodes to `..."aid":2` (first digit of the account
  id). Replace the tokens with a fixed placeholder.

## 4. What was checked and holds

- Kill switch fails closed: engine `KI_Gate.js:13-15` (unreadable = killed; refusal before any spend, no ledger row; build proves the
  refusal path neither spends nor writes, `build_ki.py:331-333`); app `kiKillSwitch` returns true on error.
- Trial / Off visibility: data routes 404 unless On or Trial + platform admin; a non-admin reads Trial as `off`; reports filtered in list,
  detail, run detail, share links, API v1, events and delivery; recommendations / Needs you only for On.
- Isolation: `siteAccess` (org) + `requireVerified` + domain filter on the n8n read and again on the rows (`kiData.ts:128,145-150`); MCP /
  API v1 KI tables On only and per key's company; Site Admin KI writes keyed by site + market (+ the row must exist, max chosen re-checked).
- Roles: viewer reads only; PATCH competitor / gap need member, approve questions admin, mode platform admin only; client portal roles
  refused (`canAct`).
- No model call in the worker (build assertion `build_ki.py:351`); competitor pages and AI answers are reduced to words / host counts and
  never reach a prompt. (W2 consumers will feed keyword strings to page prompts: keep them gated and short.)
- CSV: every cell through `csvCell` (leading `= + - @` neutralised), file name sanitised, streamed in 500-row chunks, 30 per 10 minutes.
- Idempotency: front door 5-minute fingerprint unchanged for KI; the run guard's twin rule runs on the run's own kind; callbacks are
  never retried (no duplicate reports).
- Timing: typical competitors run 1-3 minutes, research 2-5 minutes (batches of 10 SERPs, Labs a few seconds each, one Ads task); the
  worst cases are H2 (c) and the homepage / sitemap retries (3 tries x 20 s per host, batches of 2): about 10 minutes for competitors,
  within the watcher's 3 x ETA but above the 6-minute ETA shown.
- Secrets: no key, token, webhook or private key in the diff (scan of added lines), apart from L9.
