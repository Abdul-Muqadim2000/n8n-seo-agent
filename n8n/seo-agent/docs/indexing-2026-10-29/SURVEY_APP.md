# Survey: the web app before "Indexing & index health" (2026-10-29)

Read-only survey of `app/` (Fastify + Postgres server, React web, shared contracts) for the owner's brief in `OWNER_BRIEF.md`.
Every claim has a file:line (paths relative to the repo root unless they start with `app/`'s workspaces, which are written
`shared/`, `server/`, `web/` = `app/shared/src`, `app/server/src`, `app/web/src`). "Not found" says what was searched.
Nothing was edited, migrated or deployed.

---

## 0. The short picture

- **The app owns nothing about indexing today.** It never calls URL Inspection, Search Analytics or the Sitemaps API itself: its only
  Google calls are `webmasters/v3/sites` (list properties) and the GA4 Admin API (`server/services/google.ts:57,67,91,103`). All index
  data on screen comes from the engine's n8n Data Table **`seo_page_watch`** (key pages only, daily watch + weekly URL Inspection
  rotation), read through `siteRows()` and shown as one card on the Technical page.
- **The natural homes already exist:** "Steps on your website" (`site_tasks`) for anything the client must change on the site,
  Needs you / Recommendations for asks, the Technical page's watch panel for index state, the cadence's `existingPageUrl` refresh path
  plus Page review (with a Compare tab) for rewrites, CMS publishing for pushing a refreshed page.
- **Read-only everywhere on Google:** both the app's and the engine's service account request `webmasters.readonly` +
  `analytics.readonly`, and the customer guide promises "Nothing is ever changed, submitted or removed in your account".
- **CMS can only create/update an article by slug**; no meta robots, canonical, redirects or sitemap; no backup or rollback.

---

## 1. Site tasks ("Steps on your website")

Design doc `app/docs/SITE_TASKS.md` (deployed 2026-10-27, migration 0024). The best fit for indexing steps such as "remove the
noindex", "unblock in robots.txt", "fix the canonical", "add the page to the sitemap", "redirect the dead page".

### 1.1 Storage
- Table `site_tasks`: `server/db/schema.ts:1645-1670`; migration `app/server/drizzle/0024_site_tasks.sql`.
  Columns: `org_id`, `site_id` (both FK cascade), `task_key` (`'indexnow' | 'ai_crawlers' | 'redirect:<host/path>'`, schema.ts:1655),
  `kind` (typed `SiteTaskKind`), `payload` jsonb (what the check needs), `last_check` jsonb (`SiteTaskCheck`), `last_check_at`,
  `done_at`, `miss_at` (two-miss rule), `skipped_at`, `skipped_by`, timestamps. Unique `(site_id, task_key)`; indexes on org and
  `last_check_at` (schema.ts:1669).
- **Only app state is stored.** Done / to-do is decided at read time from the newest of the engine's reading and the app's own check
  (`shared/site-tasks.ts:221-255`, `deriveSiteTasks`).

### 1.2 Kinds and the shared rule (`shared/site-tasks.ts`)
- `SiteTaskKind = 'indexnow' | 'ai_crawlers' | 'redirect'` (line 7); `SiteTaskCheckBy = 'you' | 'daily' | 'weekly' | 'monthly'` (10).
- Inputs from the engine: `SiteTaskInputs` (43-53): `indexnow`, `access`, `reclaim`.
- One "draft" builder per kind: `indexnowDraft` (96), `crawlerDraft` (106), `redirectDrafts` (124, capped by
  `SITE_TASK_MAX_REDIRECTS = 5`, line 67; key from `redirectTaskKey()` 70-79).
- Presentation per kind: `present()` (172-219: title, detail, copy `values`, `guide` id, `guideVars`) and `doneDetail()` (161-170).
- `siteTaskPayload()` (258-267) picks the draft by key: `'indexnow'`, `'ai_crawlers'`, **else redirect**.
- Ordering: to-do warnings, to-do info, done, skipped (252-253). Severity `warning` for reopened tasks or a blocked Googlebot/Bingbot (238).

### 1.3 Server (`server/services/siteTasks.ts`)
- `engineReadings()` (52-91): three small reads: latest `seo_ai_growth` row, newest `seo_ai_visibility` row with `access_json`, latest
  **full** `backlinks` report from the app's own `reports` table (light watch ignored on purpose).
- `materialize()` (137-157): inserts a row per derived task for verified sites (`onConflictDoNothing`), refreshes a to-do task's payload
  when the engine's reading changed, never touches done/skipped values; new rows get an immediate background check (`checkSiteNow`).
- `siteTasksOf()` (160-164): what Pipeline, Recommendations and Overview call.
- Checks (180-233): `checkIndexnow` (key file = 200 and only the key), `checkCrawlers` (robots.txt through the shared matcher
  `robotsBlocked`, 5xx = not done, no file = allowed), `checkRedirect` (301/308 to an on-site 200, or the page itself 200; 302/303/307 =
  "almost"). `runSiteTaskCheck()` (225-233) dispatches with a **ternary that falls through to `checkRedirect` for any unknown kind**
  and races a 45 s deadline (`CHECK_DEADLINE_MS`, 40).
- `checkSiteTask()` (247-286): "I've done it, check now"; member+; one reader per site (`inFlight`, 36); an unreachable site returns 503
  and records nothing; writes `audit('site_task.checked')`.
- `skipSiteTask()` (289-305): skip / restore, audited. `checkIndexnowStep()` (308-314): the old AI-page endpoint kept for open tabs.
- Daily job: `dailyCheck()` (321-336): unreachable = only `last_check_at` bumped; a first miss on a done (or engine-done) step sets
  `miss_at` and re-checks in 1 h (`MISS_RECHECK_MS`, 38); second miss reopens. `siteTaskTick()` (361-370, never overlaps) + `tick()`
  (372-421): syncs **5 websites a tick** (longest-ago first), then checks **at most 60 due rows a tick** across all sites, active
  tracking + verified only. `afterSiteTaskCallback()` for stages `ai_growth`, `ai_visibility`, `backlinks` (`SITE_TASK_STAGES`, 424-429),
  called from `ingestCallback` (`server/services/runs.ts` ≈ line 807).
- Timer: every 30 min, `server/index.ts:77-78`; switch `SITE_TASK_JOBS` (`server/config.ts:54-55`, 258).

### 1.4 Routes (`server/routes/siteTasks.ts`)
`GET /api/orgs/:orgId/sites/:siteId/tasks` (viewer, verified, 120/10 min per user); `POST …/tasks/check`, `…/tasks/skip`,
`…/tasks/restore` (member, 30/10 min). Body `{ key }` (a redirect key carries an address). API doc `app/API.md:877`.

### 1.5 Where it is shown
- Pipeline → **Needs you**: `siteTaskNeedsYou()` `server/services/pipeline.ts:288-301` (id `task:<key>`, kind `site_task`, "(needed
  again)" when reopened); merged at pipeline.ts:932; tasks read at 609 (`.catch(() => undefined)` so a failure never breaks the page).
- Pipeline → **"Steps on your website"** panel: `web/components/site/SiteTasks.tsx` (`useSiteTasks` 25, `SiteTaskCheckButton` 58,
  `SiteTaskRow` 77, `SiteTasksPanel` 164), placed at `web/pages/site/PipelinePage.tsx:157-158`; anchors via `siteTaskAnchor`
  (`web/pages/site/_components/pipeline/home.tsx:51,217`). No per-kind code in the web panel (grep for `kind` in SiteTasks.tsx: none).
- **Recommendations**: `recommend(site, x, tasks)` hides done/skipped tasks (`taskOpen`, `server/services/recommendations.ts:141`);
  `ai:indexnow` (199), `ai:crawlers` (203), `bl:reclaim:<url>` with `taskKey: redirectTaskKey(...)` (392).
- Needs-you guide: `GUIDE_FOR_NEEDS_YOU_KIND.site_task` + id refinement in `guideForNeedsYou()` (`shared/guide-links.ts:25, 37-39`).

### 1.6 The safe fetcher (`server/services/verify.ts`, `server/lib/netGuard.ts`)
- `getOnce()` (verify.ts:19-41): node `https.request`, DNS pinned to public addresses (`publicLookup`, netGuard.ts:31), UA
  **`SEO-Agent-Verifier/1.0`**, `accept: text/html`, 10 s timeout, byte cap, returns **status, Location, body only** (no other headers,
  so `X-Robots-Tag` cannot be read today).
- `publicHttpsHost()` (48-59): https only, no user/password, no IP literal, `domainOk`.
- `fetchPublicText()` (62-74): manual redirects, at most 4 hops, every hop re-checked; `fetchPublicOnce()` (77-81): no redirect followed.
- Also `lib/safeFetch.ts` (`guardedFetch`) and `lib/netGuard.ts` (`outboundUrlOk` 63, `OutboundRefused` 58) for other outbound calls.
- Checks only hit the website's own host (`onSite`, siteTasks.ts:176) and `https://<domain>/robots.txt`.

### 1.7 How a new kind (e.g. `indexing`) would be added: what it must satisfy
1. `shared/site-tasks.ts`: extend `SiteTaskKind`; add the engine reading to `SiteTaskInputs`; a draft builder; branches in
   `present()`, `doneDetail()`, `siteTaskPayload()` (**today's else-branch would treat the new key as a redirect**); keep ordering.
2. `server/services/siteTasks.ts`: read the engine's data in `engineReadings()` (keep it a small read: the doc's rule "three small
   reads, not the whole dashboard"); a `checkX()` that only fetches the client's own host through `fetchPublicText/Once`; add it to
   `runSiteTaskCheck()` (**fix the fall-through ternary to an exhaustive switch**); add the callback stage to `SITE_TASK_STAGES` if a new
   engine callback brings readings.
3. Rules from the SITE_TASKS review that a new kind must keep: newest reading decides; unreachable never records; two misses an hour
   apart reopen; a click that gets no answer = 503; 45 s cap; one website at a time; paused sites not checked; reading writes nothing
   unless a value changed; skip / restore audited; guide per task (`guide`, `guideVars`) with a `shared/guides.ts` entry
   (`web/CONVENTIONS.md:31-61`: "a change on the client's own website is a site task, not only a guide").
4. Task volume: one row per key; the tick checks 60 rows / 30 min for **all** kinds and all sites (≈ 2,880 a day platform-wide).
   Per-URL indexing tasks for a large backlog would starve IndexNow / crawler / redirect checks; group by root cause (one task per
   cause with a URL list, like `ai_crawlers` carries a bot list) or cap per site like `SITE_TASK_MAX_REDIRECTS`.
5. A `noindex` / `X-Robots-Tag` / canonical check needs the response headers and an HTML parse: `getOnce` must be extended (return
   headers) without changing current callers.
6. No migration needed for a new kind (`kind`/`task_key` are text, payload jsonb). `SiteTaskCheckBy` would need a value if the engine
   reads it on another cadence (e.g. `'daily'` is already the app's job).
7. Tests: `server/test/siteTasks.test.ts` (PGlite, website in memory, roles, audit, two-miss rule), shared unit tests for the rule.

---

## 2. Autopilot / pipeline

### 2.1 Where modes live
- **Per website (app DB `sites`)**: `trackingStatus` ('not_started' | 'active' | 'paused', schema.ts:475), `autopilotLevel` 1-3
  (494, written to the engine's `_site` row `seo_ladder_settings.autopilot_level`), `autopilotDroppedAt/From` (497-498), `linkSettings`
  `{mode: 'approve' | 'auto', …}` (478), `creditsPausedAt/Reason` (481-483), `blogsPerWeek`, `timezone`, `cycleWeekday`, GSC/GA4 live
  checks `gscCheckedAt/gscReadable`, `ga4CheckedAt/ga4Readable` (464-470).
- **Per ladder (engine table `seo_ladder_settings`)**: columns `shared/tables.ts:314-334` (`mode`, `priority`, `status`, `plan_type`,
  `max_active`, `max_waiting`, `autopilot_level`, …), site defaults row `LADDER_SITE_ROW = '_site'` (337). Written by
  `server/services/ladderSettings.ts` (header 17-28: '' mode = site default; never writes `stuck`; `won` only from the tracker callback).
- **Monitors (engine table `seo_monitors`)**: `monitorSettingsSchema` `shared/schemas.ts:99-146` (`aiVisibility`, `aiPulse`, `aiGrowth`,
  `backlinks`, `linkBuilder`, `auditMonthly`, `auditPages`, `auditJs`, …; wave-2 options optional with no default so old sites keep
  their cost). Sent with Site Admin `monitors` / Track via `monitorsBody()` / `siteAdminMonitorsBody()` (`shared/payload.ts:43, 83`).
- No per-action Off / Approval / Auto switch exists beyond: ladder Auto/Manual, autopilot level, link-builder approve/auto, CMS
  draft (member) vs live (admin + confirm).

### 2.2 Autopilot concept
- `autopilotRuns(site, monitors)` `shared/autopilot.ts:45-48`: what the weekly cycle runs by itself (audit, aiVisibility, backlinks) for
  a verified site with tracking active; read by Recommendations / Overview (`recommendations.ts:525`) so a client is not told to run by
  hand what the cycle does ("auto:*" items are scheduled, not manual).
- `autopilotRows()` (`shared/autopilot.ts:72+`) = the monthly forecast rows (`AutopilotRowId`, line 11) shown on the settings card,
  Credits page and the reserve.
- `gscConnectionState` / `ga4ConnectionState` `shared/gsc-connection.ts:37, 79`: newest of weekly report, the app's live check, the
  engine row. Server wrappers `gscNow` / `ga4Now` `server/services/data.ts:184-189`.
- Cycle: `CYCLE_JOBS` `shared/cycles.ts:6-15` (ai_visibility, backlinks, rank_tracker, site_tracker, ai_growth, content_cadence,
  link_builder, audit) mirrored by the engine's `_cycle.js` ("a change on one side changes the other in the same commit", cycles.ts:1-3).
  `AUTOMATIONS` `shared/constants.ts:465+` (schedule kind, workflow, stage, runNowMode, settingsTab); `SCHEDULED_STAGES` (320).

### 2.3 Pipeline page (`web/pages/site/PipelinePage.tsx`)
Order (80-194): header (Autopilot on / Paused, credits a month, settings, Pause/Resume), SiteWarnings, start-tracking callouts,
`PipelineHero`, `PipelineNextSteps`, **Needs you** + This week (152-155), **Steps on your website** (157-158), Keyword proposals,
Coming up, Ladder cards, Always on, How it works, Your week + Calendar + Recent activity.
- Data: `GET …/data/pipeline` → `pipelineData()` `server/services/pipeline.ts` (≈ 580-991): one large parallel read (cycles,
  `seo_sites`, skips, cache, monitors, proposals, rechecks, published content log, page inventory `sitePageInventory` 558-563, …).
- Growth-loop stages (`PipelineStage[]`, pipeline.ts:840-891): research, plan, write, publish, track, monitor, improve. **No indexing
  stage**; the owner's "Indexing & Verification" stage would be a new entry here plus a type change in `shared/data.ts`.
- Needs-you kinds: `NeedsYouItem` `shared/data.ts:1362-1384` (publish, approve, overlap, duplicate, failed, connection, pileup, keyword,
  proposal, recheck, level, profile, ai_panel, questions, site_task). A new kind does not compile until `GUIDE_FOR_NEEDS_YOU_KIND`
  (`shared/guide-links.ts:10-26`) names its guide and `KIND_ICON` (home.tsx:172-188) has an icon.
- Approvals: (a) `approve` Needs-you items = a Manual ladder's next page (`writeNow`); (b) `queue.suggestions` wait for the client's OK
  (Coming up); (c) agency portal approvals `server/services/approvals.ts` (kinds `'page' | 'outreach'` only, 86; `requireClientApproval`
  147 blocks a live CMS publish / outreach until approved), web `pages/portal/ApprovalsPage.tsx`.

---

## 3. Tracking & monitors page and dashboards

- Website settings tabs: `web/pages/site/SiteSettingsPage.tsx:43-49` (business, verification, **tracking** "Tracking & monitors",
  autopilot, profile, publishing, danger). A per-site indexing on/off + cost line would sit in **tracking** next to the monitors.
- Dashboards (API `app/API.md:251-292`): overview, search, rankings, content, technical, ai, backlinks, alerts, settings, pipeline,
  recommendations; shapes in `server/services/data.ts` (`searchData` 399, `contentData` 739, `technicalData` 841, `alertsData` 1598).
- **How dashboards read n8n**: `server/n8n/client.ts` — `rows(table, {filters, sortBy, max, fresh})` (318-336) over the public API
  `/api/v1/data-tables/<id>/rows` (`fetchRows` 338-357, pages of 250, default max 2000), table ids cached 10 min (`tableId` 275-296), a
  60 s read cache bounded to 96 MB / 24 MB per entry (`ReadCache` 223-273, 286-290), identical in-flight reads shared; **`siteRows()`
  (491-493) adds `domain eq <domain>`** — every table but `seo_pages` (filtered by `site_id`, pipeline.ts:563) and `seo_skips`.
  Writes: `updateRows` / `insertRows` / `deleteRows` / `upsertRow` / `ensureTable` (360-489); `invalidateSite` (495).
- Table names: `TABLES` `shared/tables.ts:351-402`.
- **Existing index data**: `seo_page_watch` (`PageWatchRow` tables.ts:341-349: `inspect_at`, `index_state`, `indexed` 'yes'|'no'|'',
  `coverage`, `google_canonical`, `last_crawl`, `mobile`, `rich_results`, `inspect_error`, plus noindex / canonical / robots_blocked /
  status). Read in `technicalData` (data.ts:848, **max 200 rows**), mapped by `server/services/pageWatch.ts` (`watchedPage` 19-44,
  `watchView` 47-63, `indexCoverage` 66-79: "N of M key pages are in Google's index", quota 2,000/day, `''` never counted as fine).
  Shown on the **Technical page** `WatchPanel` (`web/pages/site/TechnicalPage.tsx:253, 588-670`).
- "I fixed this" for audit findings: `requestRecheck()` pageWatch.ts:111-136 writes `recheck_state: requested` on
  `seo_audit_findings`; route `POST …/technical/findings/recheck` (`server/routes/data.ts:49-54`). The engine's next daily watch answers.
- Monthly Search Console check-in (manual, Pages-report CSV): `seo_console_checkins` (`CheckinRow` tables.ts:90-93 `coverage_json`,
  `not_indexed_total`, `csv_kind`), `alertsData` data.ts:1598-1622, Alerts page `web/pages/site/AlertsPage.tsx:58-89`.
- Page inventory `seo_pages` (`SitePageRow` tables.ts:73-82: url, title, source, lastmod, queries, clicks, decay fields). **The app's
  type lacks `http_status` / `status_at`** that the engine added 2026-10-21 (CLAUDE.md status). No app screen lists the inventory.
- **Where an Indexing card fits**: (a) Technical page next to / replacing the `WatchPanel` coverage tile (same data family, same
  "not checked ≠ fine" rule); (b) a Pipeline card ("New / Existing" tabs per the brief) beside Steps on your website; (c) Overview
  tile. Search page (`SearchPage.tsx`) has no index content (grep `coverage|sitemap`: none).

---

## 4. Recommendations, notifications, delivery, report renderers, new callback stage

- **Recommendations**: `recommend()` `server/services/recommendations.ts:140-447`, ids by family: `setup:*` (166-221), `search:*`
  (230-265), `engine:<source>:<type>:…` (302), `tech:*` (324-351), `ai:*` (199-207, 360-370), `links:*` (211-217), `bl:*` (385-405),
  `content:*` / `keyword:*` (412-426), `rank:*` (433-436). Each scored (`ruleScoreFor` / `scoreOf`, 146-149); `taskKey` links to a site
  task; guides via `GUIDE_FOR_RECOMMENDATION`. Overview data in the same file (≈ 455-540).
- **Notifications**: e-mail to the client is mostly off (`ENGINE_EMAILS=false`, `ACCOUNT_EMAILS=false`, `server/config.ts:104-106`);
  senders in `services/mail.ts`, `billing.ts`, `comingUp.ts`, `autopilot.ts`, `autoStart.ts`, `invoices.ts`, `portalMail.ts`.
  Event webhooks `WEBHOOK_EVENTS` `shared/integrations.ts:24` (run.completed, run.failed, report.ready, report.held, alert.raised,
  audit.finding.new, rank.changed) derived per callback; `alert.raised` already covers Page Watch alerts (integrations.ts:175).
- **Report delivery**: `server/services/reportDelivery.ts` (`deliverReport` 312, `deliveryTick` 373, `retryTick` 427); company choice of
  stages `CHOOSABLE_STAGES` `web/pages/settings/_components/DeliveryTab.tsx:39`; timer index.ts:62.
- **Callback ingest**: `POST /api/hooks/n8n/:token` (`server/routes/hooks.ts`) → `ingestCallback()` `server/services/runs.ts:711-809`:
  stores a `reports` row (title `titleFor`, `summary` from `summarize`, `scheduled` via `isScheduledCallback` 652), patches the run
  (`MODES[mode].finalStages`, ledger cost), then `deliverReport`, `emitForCallback`, ladder won / prefs, `afterCallback` (autopilot),
  `afterSiteTaskCallback` for `SITE_TASK_STAGES`.
- **Adding a callback stage end to end** (touchpoints found by following `ai_growth`):
  1. `server/services/summaries.ts`: `stageOf` (15), `summarize` switch (22-210), `titleFor` (218).
  2. `shared/constants.ts`: `STAGE_LABELS` (322), `SCHEDULED_STAGES` (320) if a schedule sends it, `MODES[…].finalStages/startStages`
     (158+) if a mode starts it, `AUTOMATIONS` (465+) for the Pipeline schedule list.
  3. `shared/cycles.ts` `CYCLE_JOBS` (6-15) if it runs inside the website's cycle (engine `_cycle.js` must change in the same commit).
  4. Web: renderer in `web/components/reports/ReportView.tsx` `RENDERERS` (28), area mapping `reports/meta.tsx` (≈ 86), list line
     `reports/ReportSummaryLine.tsx` (≈ 99), `DeliveryTab.tsx:39`, `pipeline/common.tsx`.
  5. `shared/billing.ts:275` (labels for usage), `shared/integrations.ts` (events), `services/admin/costSync.ts` `attributeLedgerRow`
     (ledger key `cycle:` / `schedule:` / `parent:` / `app:` / domain decides who pays).
  6. Harness S23 + `npm run export:payloads` if a new mode body is sent (README "Where to change what", `app/README.md:417-432`).

---

## 5. CMS publishing (`app/docs/CMS_PUBLISHING.md`, `server/services/cms/`)

- Connectors (`server/services/cms/connectors/`): WordPress (REST + Application Password), Webflow (Data API v2), Contentful (CMA),
  signed webhook. Interface `test / find / push / status` (doc §4).
- **What it can change**: create or update **one article/page per connection × slug** (`cms_items`, doc §5), title, body, excerpt,
  slug, categories/tags, featured image + alt (WordPress), SEO title / meta description / focus keyword only when Yoast / Rank Math expose
  REST fields (else the description goes to the excerpt), JSON-LD only with `unfiltered_html`. `find()` **adopts an existing CMS item with
  the same slug** (`service.ts:448-458`), so an old page could be updated if a rewrite carries its slug.
- **Not found** (grep `canonical|noindex|robots|sitemap|redirect|backup|rollback|revision` in `server/services/cms`: only an HTTP-redirect
  error message, `types.ts:107`): no meta robots, no canonical, no redirects, no sitemap, no unpublish/delete (doc §8), **no backup of the
  previous content and no rollback**.
- Approvals: draft = member; live = admin/owner + `confirmLive: true`; a live item is never replaced by a "draft" (service.ts:459-465:
  updating a live WordPress post is live at once, so it needs Publish live); `cmsReadiness()` blocks QA-failed / bracketed / unchecked
  pages with **no override** (doc §3); agency `requireClientApproval` for live publish (approvals.ts:147). **No automatic publishing**
  (doc §8: "Every send is a person's click").
- Going live tells the engine via mode `published` (free) (service.ts:388).

---

## 6. Google connection and scopes

- App service account (Verification & Google live check, GA4 property list): `SCOPES = webmasters.readonly, analytics.readonly`
  (`server/services/google.ts:12`); calls only `webmasters/v3/sites` (57) and Analytics Admin (91, 103). Permission read from
  `siteEntry.permissionLevel`; `siteUnverifiedUser` ignored (48-59).
- User OAuth "Verify with Google": `openid email profile webmasters.readonly` (`server/auth/google.ts:30`); `gscOwnerCheck` requires
  `siteOwner` (google.ts:66-72).
- Engine credential `SEOcredGoogleSvc`: same two readonly scopes (`n8n/seo-agent/sync_credentials.py:20,32`).
- Customer guide `search-console-access` (`shared/guides.ts:172-208`): add the service account as **Full** user, "not Owner"; text at
  195: *"Full is what lets us read sitemaps and whether your pages are indexed … Nothing is ever changed, submitted or removed in your
  account."* Marketing FAQ repeats read-only for the pre-release check (`web/marketing/content/features.ts:475`).
- **`sitemaps.submit` is not possible today**: it needs the `https://www.googleapis.com/auth/webmasters` (read/write) scope, which
  neither credential requests; the permission level it needs on the property must be confirmed by the research agent against Google's
  docs. Adding it changes a shared credential for every customer and contradicts the guide's promise (copy + consent change, tutorial
  re-film). URL Inspection works with readonly (the engine already uses it).

---

## 7. Content refresh / rewrite of an existing page

- Cadence mirror `server/services/cadence.ts` (must change with the engine's `Cadence_Plan.js`): level 2 auto-writes refreshes of
  EXISTING pages in topic (decay, striking distance with a page, AI refresh; 48-49, `autoFor` 765); decay candidates from `seo_pages`
  `decay_state = 'decaying'` (691-716; `decayPerWeek: 2`, `decayRefreshDays: 60`, 78-80), each carrying `existingPageUrl` and a "why";
  AI refresh targets (781-812); "one search one page" matching (`coverOf` 866-876).
- Coming up / Write now: `existingPageUrl` flows through `comingUp.ts:194`, `WriteNowDialog.tsx`, `shared/payload.ts` to the engine;
  `TopicSource` includes `decay`, `ai_refresh` (comingUp.ts:42). Recommendation `rank:drop` offers "Refresh the page" with
  `existingPageUrl` (recommendations.ts:436).
- Page review (H3) `shared/page-review.ts` (contract, 1-12), `server/services/pageReview.ts`, routes `server/routes/pageReview.ts`
  (answers, accept-prefilled, version edit, finalize (6/min), approve): questions, in-app edit, **Compare tab** vs the delivered
  version (`web/components/reports/review/PageEditor.tsx:37, 111, 136, 233`), "Make the final version" (engine mode `finalize`, charged),
  one-click approve, then CMS / "I published it".
- **Not found**: a side-by-side diff between the *live old page* and the rewrite (Compare is delivered vs edited), and any
  `content_tasks` table or `reason = indexing` (grep `content_tasks|reason.*index` in app: none).

---

## 8. Credits and cost

- One cost table `shared/cost.ts` (mirror of the engine's `_cost_cal.js`, header 5-31); free modes `track`, `published`, `checkin`
  = `{ai: 0, dfs: 0}` (84-86). Customers see credits only (`web/CONVENTIONS.md:64-77`).
- Credits = provider cost × markup ÷ credit value (60 credits per $1 by default) `shared/billing.ts:75-77`; `creditsOfUsd`
  `server/services/admin/settings.ts:14`; rules `app/docs/CREDITS.md` §1: on-demand quoted, held, charged ≤ quote; failed = refunded;
  autopilot charged from the cost sync (every 10 min, ledger attribution `costSync.ts attributeLedgerRow`).
- **A Google-API-only job costs 0 provider dollars → 0 credits** (charges come only from Claude / DataForSEO ledger amounts). A quoted-0
  run absorbs anything it spends (CREDITS.md §1 step 3). An autopilot job would show as a forecast row only if added to
  `autopilotRows()` (`shared/autopilot.ts:72+`, `AutopilotRowId` 11); a free row adds nothing to the reserve.
- Rewrites triggered by indexing are content runs (`modeCostUsd('keyword')`, `MONITOR_COSTS.blogPostEach`, constants.ts:369) and are
  charged like any page; at levels 1-2 they would be suggestions with their price (cadence rule).

---

## 9. Marketing site and tutorials (must change with the feature, per CLAUDE.md working rules)

- Capability registry `web/marketing/content/features.ts` (type 75-102, entries from 105; `technical-audits` 411 already promises
  "Search Console index coverage", the daily key-page watch and URL Inspection with 2,000/day rotation (420-426, 482-483);
  `ai-growth` 665 claims "Get indexed where AI looks" (685)). Either extend `technical-audits` / `site-tracking` or add a new slug
  (then `CapabilityMap.tsx` GROUPS, `CapabilityScreen.tsx` APP_PATH, `capabilityCount`; `web/CONVENTIONS.md:132-163`).
- Changelog `web/marketing/content/changelog.ts` (newest release first; latest `4.4` dated 2026-10-28, line 36+).
- Pricing `web/marketing/content/pricing.ts` (`pricingTiers` 25-95 feature lists, `creditExamples` 164, `servicePackages` 193 includes
  done-for-you audit fixes); solutions `solutions.ts` (`helps`).
- No-AI-tells copy rule (memory + `plainWords` in page-review.ts:22-30).
- Tutorials: web `web/marketing/content/tutorials.ts` + `tutorial-films.ts`, synced by `app/scripts/sync_tutorials.py`; source of truth
  `~/Downloads/hiresuite-video-skills/alaventra/alaventra-sandbox-video/data/tutorials.json` and `references/platform.md` (exist);
  `data/no_leak.json` forbids vendor/table names. Any new panel, button or setting = new tutorial at the end of its series or re-film.

---

## 10. Tests and CI

- Local (no Node on the Mac): `docker run --rm -v "$PWD":/app -w /app node:22-bookworm-slim npm test` / `npm run typecheck` in `app/`
  (`app/README.md:406-415`). Workspace scripts: vitest in shared/server/web, tsc typecheck, `drizzle-kit generate` (`server/package.json`).
- Server tests `app/server/test/` (≈ 85 files) incl. `siteTasks.test.ts` (PGlite + in-memory website, env switches off every job:
  `SITE_TASK_JOBS=false` etc.), `pageWatch.test.ts`, `pipeline*.test.ts`, `recommendations.test.ts`, `callbacks.test.ts`,
  `cadence*.test.ts`, `cmsRoutes.test.ts` (real Postgres). Shared: `guides.test.ts` (copy rules), `site-tasks` and `cms` tests.
- Smoke: `python3 app/scripts/smoke.py` against the dev stack; browser pass `scripts/browser_pass.mjs` (Playwright image).
- CI `.github/workflows/ci.yml`: app job (typecheck incl. Vercel middleware, unit tests, build, payload export current), "real Postgres
  suites" (postgres:17, `crawlerDb`, `integrations.pg`, `cmsRoutes`; noted as failing before 2026-10-28, cmsRoutes 409 vs 400), engine
  job (build_v4.py + harness must end 0 failed + deploy manifest), images job. Also `security.yml`, `images.yml`, `deploy-web.yml`.

---

## 11. Gaps for the indexing feature (what the app lacks)

1. **No index data beyond key pages.** `seo_page_watch` is key pages only, read `max: 200`; no per-URL table for the BACKLOG lane
   (sitemap / inventory / previously published URLs) and no app read of Search Analytics "pages with impressions". `SitePageRow` misses
   `http_status` / `status_at`; no screen lists the inventory.
2. **No "New / Existing" index view**, no counts by cause, no "fix all with this cause", no backlog progress, no cooldown / retry
   bookkeeping (none of `indexing_checks`, `indexing_issues`, `content_tasks` exist; grep: none).
3. **No write access to Google** (readonly scopes on both credentials; guide promises nothing is submitted). Sitemap resubmission would
   need a scope change and new copy; only IndexNow (Bing etc.) is submitted today, by the engine's AI Growth.
4. **No site-side fixes through the CMS** (meta robots, canonical, redirects, sitemap entries, internal links) and **no backup / rollback**
   of an existing CMS item before an update; no automatic publishing by design.
5. **Site tasks cannot read headers** (X-Robots-Tag) or parse `<meta robots>` / canonical; `runSiteTaskCheck` / `siteTaskPayload`
   default to redirect for unknown kinds; capacity is 60 checks / 30 min shared by all kinds.
6. **Pipeline has no indexing stage** (`PipelineStage` ids fixed list) and no per-action Off / Approval / Auto setting model (only ladder
   mode, autopilot level, link-builder mode).
7. **No callback stage, renderer, delivery choice, webhook event or forecast row** for an indexing run (all touchpoints in §4 step list).
8. **No live-page vs rewrite diff** (Compare is delivered vs edited); refresh exists but is driven by decay / AI targets, not index state.
9. **No policy / Google-status watcher** (Search Status Dashboard, core updates) in the app (grep `status dashboard|core update` in
   `app/server/src`: none); the app's chart annotations (`chartAnnotations`, data.ts:369-379) mark only published pages and technical
   audits. A page-level "rewritten vs published" t0 already exists (`changesOf`, data.ts:388-397: a published URL equal to its
   `existing_page_url` counts as `rewritten`), usable for the brief's "rollback if a rewrite performs worse" comparison.
10. Marketing + tutorials have no indexing capability entry; the technical-audits copy already makes index claims that must stay true.

---

## 12. Risks to existing features

1. **Pipeline page latency / failure**: `pipelineData()` is the heaviest read every client opens; it already awaits `siteTasksOf()`
   (which may insert rows and start a background check). New indexing reads there must be small, parallel and wrapped like site tasks
   (`.catch(() => undefined)`, pipeline.ts:609) so a slow n8n read never fails the Pipeline.
2. **Shared `site_tasks` job capacity**: adding many indexing rows starves IndexNow / crawler / redirect checks (60 per tick, 5 site
   syncs per tick, `inFlight` per site); adding a kind without fixing the fall-through would run redirect checks on indexing payloads.
3. **n8n read cache and VM memory**: 96 MB cache, 24 MB per read, 4 GB production VM shared with n8n + Postgres (client.ts:216-222);
   per-URL backlog reads must be paged and capped (precedent: AI answers paged after a tens-of-MB incident).
4. **URL Inspection quota (2,000 / day / property)** is already used by the engine's weekly key-page rotation (pageWatch.ts:66-79,
   features.ts:483); a backlog lane must share one quota manager, not add a second consumer.
5. **Engine contracts mirrored in the app**: `CYCLE_JOBS` ↔ `_cycle.js`, `cadence.ts` ↔ `Cadence_Plan.js` (fixture
   `harness/fixtures/cadence_levels.json`), `cost.ts` ↔ `_cost_cal.js`, request bodies ↔ harness S23. Touching one side alone breaks the
   other; a new cycle job changes every website's cycle order.
6. **Google credential is shared by all customers**: a scope change (for sitemaps.submit) applies to every property at once and makes
   the guide, marketing FAQ and tutorials untrue until updated; keep it out unless the owner decides.
7. **CMS slug adoption** would let a rewrite overwrite an existing live page (admin-gated, but no backup); any indexing rewrite flow
   needs its own backup before reusing `push`.
8. **Recommendations / Needs-you ids** are dedupe keys and guide keys (`add` skips duplicate ids, recommendations.ts:146); new ids must
   not collide with `tech:*` audit findings that already cover noindex / canonical / sitemap issues, or the client sees two asks for one
   problem. Same for the Technical page's existing index tile.
9. **Engine run limits**: app requests are rate-limited per company in n8n (40 / day, CLAUDE.md); on-demand indexing runs would eat
   into the same allowance as analyses.
10. **Callbacks**: `ingestCallback` follow-ups run fire-and-forget; a new stage hooked into `afterCallback` / `SITE_TASK_STAGES` must
    never throw into the stored report path (the existing pattern catches and logs).
11. **Credits**: a job billed through a ledger key that `attributeLedgerRow` cannot attribute falls to `NONE`; one attributed by domain
    becomes schedule spend (costSync.ts). A paid rewrite started by indexing must carry a run/quote or it bypasses the on-demand checks.
12. **Production migrations** run at server start (`server/index.ts` `runMigrations()`): any new table must be additive with cascade FKs
    like 0024, and a `*_JOBS=false` switch for any new background job (precedent `SITE_TASK_JOBS`, `LINK_BUILDER_JOBS`).
