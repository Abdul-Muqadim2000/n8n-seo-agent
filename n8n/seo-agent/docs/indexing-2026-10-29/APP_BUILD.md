# Index coverage: the web app half (built 2026-10-29, branch `ix/app`)

Built against `DESIGN.md` §2 (tables read), §5 (callback), §6 (app), §7 (safety). Not deployed, not pushed, no paid run. No migration:
settings live in `seo_monitors`, steps reuse `site_tasks` (`kind` / `task_key` are text). Marketing site and tutorials untouched (other
agents). The engine (`SEOagentIndexCv1`) was not touched.

## What was built, where

| Piece | Where |
|---|---|
| Cause catalogue (plain words: what it means / what we do / what you do, action class, guide, step title), page figures from the rows (`buildIndexingData`, pure), paging, history labels, step readings, the app's own check rules (noindex in page or `X-Robots-Tag`, canonical, sitemap, soft 404 words, permanent redirect), recommendation inputs, `improveKeywordOf` | `app/shared/src/indexing.ts` (new, exported from the barrel) |
| Row types + table keys `indexPages`, `indexHistory`, `indexRuns`, `googleEvents`, `updateImpact`; `seo_monitors.index_watch` / `index_daily_cap` | `app/shared/src/tables.ts` |
| Site task kind `indexing`, key `indexing:<cause>` (10 site-fix causes), payload `{cause, urls ≤ 25, total}`, engine reading `by: 'index'`; a page already a `redirect:` step is left out; **exhaustive switches** in `present`, `doneDetail`, `siteTaskPayload` (+ new `siteTaskKindOfKey`; an unknown key is null, never a redirect) | `app/shared/src/site-tasks.ts` |
| Safe fetcher: `getOnce(url, max, { headers: true })` opt-in; `fetchPublicText(url, max, hops, { headers: true })` adds `headers` + `firstStatus`; without the option the answer shape is byte-for-byte the old one | `app/server/src/services/verify.ts` |
| Engine reading for the steps (newest run + `action = site_fix` rows, by engine site id, other-domain rows dropped, failure = null), `checkIndexing` (≤ 10 pages, 4 at a time, sitemap in parallel, robots.txt via the shared matcher), `runSiteTaskCheck` exhaustive switch (unknown kind reads nothing, records nothing), daily tick: other kinds first, indexing at most a third of the 60, `index_coverage` added to `SITE_TASK_STAGES` | `app/server/src/services/siteTasks.ts` |
| Reads for the page (pages capped 5,000, runs 12, events 12, impacts 3; `Promise.allSettled`, "could not read" state), paged URLs, one page's history, recommendation inputs | `app/server/src/services/indexing.ts` (new) |
| Routes `GET …/data/indexing`, `…/data/indexing/pages`, `…/data/indexing/history` (viewer+, verified, per-person rate limits, never throw on an engine failure) | `app/server/src/routes/indexing.ts` (new), registered in `app.ts`; documented in `app/API.md` "Index coverage" |
| Recommendations `ix:site_fix:<cause>` (from the open step, `taskKey`; skipped when an open `tech:*` finding already asks the same fix), `ix:links:*`, `ix:duplicate:*`, `ix:quality:crawled_not_indexed` with **Improve this page** (Write-a-page form, `existingPageUrl`; none while `freeze`); nothing when the check is off or has not run; rule scores | `app/server/src/services/recommendations.ts` (`indexingRecommendations`, loaded in `loadBundle` with its own catch), `app/shared/src/queue.ts` |
| Callback stage `index_coverage`: label, scheduled stage (shared + `runs.ts`), summary values, `status: 'complete'` finished for this stage only, `report.ready` + `alert.raised` on drop-outs, billing label "free", delivery choice, renderer, icon, list line | `shared/constants.ts`, `server/services/runs.ts`, `server/services/summaries.ts`, `shared/report-delivery.ts`, `shared/integrations.ts`, `shared/billing.ts`, `web/pages/settings/_components/DeliveryTab.tsx`, `web/components/reports/indexing.tsx` (new) + `ReportView.tsx`, `meta.tsx`, `ReportSummaryLine.tsx` |
| Settings `indexWatch` / `indexDailyCap` (optional, no default: old bodies unchanged; sent last in Site Admin `monitors`), read back in `monitorsFromRow`, Indexing row in Tracking & monitors (switch + daily checks 20 to 1,200) | `shared/schemas.ts`, `shared/payload.ts`, `server/services/data.ts`, `web/components/site/MonitorSettingsFields.tsx`; `npm run export:payloads` added one Site Admin case to `n8n/seo-agent/harness/fixtures_platform_admin.json` (request bodies `fixtures_platform.json` unchanged) |
| Guides: `index-coverage` + one per site-fix cause (`index-remove-noindex`, `index-robots-blocked`, `index-add-to-sitemap`, `index-not-in-sitemap`, `index-canonical-sitemap`, `index-fix-not-found`, `index-fix-soft-404`, `index-fix-server-error`, `index-fix-access-denied`, `index-sitemap-redirects`); Needs-you `task:indexing:<cause>` and `ix:*` recommendations map to them | `shared/guides.ts`, `shared/guide-links.ts` (`INDEXING_GUIDE`) |
| Indexing page `/sites/:id/indexing`, menu next to Technical health: hero (in search X of Y that should be; need you; not checked yet with days to finish; dropped out), rolling-out banner, New / Existing tabs, groups by action + cause with the three sentences, step link and guide, 5 pages first then all (paged by 25), page details (Google's reading, our visit, canonicals, merge, link suggestions) and history read only on request, Dropped out, Google updates + update impact, settings card; empty / off / could-not-read states | `web/pages/site/IndexingPage.tsx` (new), `web/router.tsx`, `web/components/layout/OrgLayout.tsx`, `web/lib/queries.ts` |
| Docs | `app/API.md` "Index coverage", `app/docs/SITE_TASKS.md` §6 |

Autonomy: checking is on/off per site; site fixes are the client's (we only check them); improvements are a click on "Improve this page"
(the existing Write-a-page form, normal credits), never automatic. The Autopilot settings UI has no per-action mode list (only levels), so
there was nothing to add there and no Auto mode for rewrites exists. Index coverage is not added to `AUTOMATIONS` (like Page Watch): that
list drives the Pipeline schedule and the missed-fire count, which would count fires of a workflow not yet deployed.

## Tests (Docker `node:22-bookworm-slim`, whole repo mounted)

| | before (clean HEAD) | after |
|---|---|---|
| typecheck (shared, server, web) | clean | clean |
| shared | 852 passed, 1 failed (appCopy "Monday" scan timed out at 5 s; 2 parity files did not load in that container) | **882 passed, 0 failed** (52 files) |
| server | 1507 passed, 46 skipped (76 files) | **1521 passed, 46 skipped** (78 files) |
| web | 258 passed (27 files) | **263 passed, 1 failed** (28 files; the failure is the marketing guide count below) |
| web build | ok | ok |

New tests: `shared/src/indexing.test.ts` (22: figures, groups, freeze, paging, cause readings, step derivation incl. newest reading /
reopen / redirect dedupe, `siteTaskKindOfKey` no fall-through, own-check rules, copy rules, guides, settings body, callback status + alert),
`server/test/indexing.test.ts` (11: page reads, viewer / other company / unverified, paging + history + off-site refusal, engine failure =
"could not read" while recommendations and tasks still answer, the noindex step via header then fixed, unreachable = 503 and nothing
recorded, sitemap index via robots.txt, unknown kind, tick fairness, recommendation dedupe vs `tech:*`, freeze, off),
`server/test/verifyHeaders.test.ts` (3: old callers' exact shape, opt-in headers + first hop, host guard), `web/test/indexing.test.tsx` (6:
page with data, rolling out, viewer, unreadable / empty / off, menu order, report renderer).

Test-only change: `server/test/runIdempotency.test.ts` first test given the 30 s timeout its sibling already has (the cold import of the
shared barrel crossed 5 s once under Docker; it passes alone in about 4 s).

Known failing, not mine to fix: `web/test/clientGuides.test.tsx` "the business site counts the guides there really are" expects the
marketing fact `guided-setup.facts[0].value` (70 in `web/src/marketing/content/features.ts`) to equal `GUIDES.length`, now **81**. The
marketing agent must set it to 81 (I was told not to edit the marketing site).

## Browser pass (fixtures, no backend)

`app/scripts/ix_indexing_fixture.ts` (sample rows through `buildIndexingData`, novaand-demo.com) and `app/scripts/ix_indexing_shots.mjs`
(built `web/dist`, every `/api` GET answered from fixtures, non-GET refused): 1440 and 375, light and dark, with and without a core update
rolling out. Result: no console errors, no horizontal overflow, h1 "Indexing" everywhere. Screenshots in `shots/`:
`indexing-{desktop,phone}-{light,dark}.png`, `indexing-{desktop-light,desktop-dark,phone-light}-rolling.png`,
`indexing-details-desktop-light.png`, `indexing-new-tab-desktop-light.png`. The pass found the page far too long (25 rows per group on a
phone): groups now show 5 pages first and none for "left out / give it time", with "Show all".

## Not tested

- Against a real engine: the tables are empty locally and no dev n8n was seeded; column names follow DESIGN §2 exactly. A row the engine
  writes with a code the app does not know shows as "Other".
- The live dev stack (sign-in, real Site Admin save of the two settings) and `app/scripts/smoke.py`.
- The `index_coverage` callback end to end through `/api/hooks/n8n/:token` (covered by unit tests of each touchpoint, not by a posted callback).
- The daily tick on a real website (unit-tested with fetches in memory).

## Contract changes / notes for the engine

- No change to DESIGN.md's tables or callback. The app reads `seo_index_pages` / `seo_index_runs` / `seo_update_impact` / `seo_index_history`
  by `site_id` (= `n8nSiteId(domain)`, like `seo_pages`) and drops rows whose `domain` is another domain's.
- Callback `status: 'complete'` is accepted as a finished report for `index_coverage` only.
- `fixtures_platform_admin.json` now has a case "index coverage: switched off, 500 checks a day": Site Admin `monitors` with
  `index_watch: false, index_daily_cap: 500` must store both columns (harness W2FIX-3 replays it). If the engine branch lands without
  `Monitor_Row_Admin.js` storing them, that harness case fails.
- The steps treat a cause's engine reading as the newest `inspect_at` / `fetch_at` of its `site_fix` rows; please keep those stamps current
  when a page is re-read, or a step fixed by the client stays "to do" until a run no longer lists the page.

## Fix wave 1 (2026-10-29, after REVIEW_APP.md / REVIEW_CROSS.md, per FIX_CONTRACT.md)

Branch `ix/app`, worktree `n8n_devaicon-ix-app`. Not deployed, not pushed. Engine columns read: `seo_index_pages.fix_seen_at` / `ask_google`
and `seo_index_runs.sitemaps_json` (all optional: an engine without them reads exactly as before). New test files:
`shared/src/indexing.fixwave.test.ts`, `shared/src/indexing.contract.test.ts` (+ `shared/src/__fixtures__/index-coverage-techand.json`),
`server/test/indexingClient.test.ts`; new cases appended to `server/test/indexing.test.ts`, `server/test/verifyHeaders.test.ts`,
`web/test/indexing.test.tsx`. Every new case asserts the reviewer's probe in reverse (the probes P1-P8, S1-S1c, W1-W2 passed on the old
code, i.e. reproduced the defect; the new cases fail on it).

| id | fixed how | test |
|---|---|---|
| A1 | `sitemapOf` / `readSitemap` (server `siteTasks.ts`) returns `{urls, complete}`: complete only when every listed sitemap (robots.txt `Sitemap:` lines, /sitemap.xml; a guessed /sitemap.xml may 404) was an XML urlset / index read in full (no truncation: the fetcher's opt-in answer now says `truncated`), children on the same host, at most 12, no index of indexes, no `.gz`, under 50,000 addresses. "Not listed" only from a complete read; otherwise `inSitemap = null` = could not tell. | server `A1: ... 7th child ...`, `A1: ... app shell ...`; shared `A1: a page not found in a sitemap read only in part` |
| A2 | `indexingPageFixed` follows FIX_CONTRACT decision 3 exactly per cause and returns `unknown` for a 401/403/429/503 wall, a challenge page (`challengePage`), a redirect to another website, or no readable page (`realPage`: 200 HTML with head/title/body). `checkIndexing` records nothing on an unknown (daily) and answers 409 `site_unsure` on a click. access_denied and not_found no longer count "left your sitemap" (Google's reading confirms that); copy and guides updated. | shared `A2 / A16` block (5 cases); server `A2: server-error ... 403 firewall`, `A2: a click that cannot tell records nothing (409)` |
| A3 | Two app actions: `retry` (state `error` / `not_checked`, "Could not check, we try again", neutral) and `review` (not in search with action `none`, "Check in Search Console", needs you). `none` is only ever pages in search. | shared `A3 / A13 / X6 / A25`; web `A3` |
| A4 | `IndexRun.failed` (no page, no inspection, a note) and `accessLost`; `checkedAt` = newest run that read the website; `notice` (the engine's sentence, internal error text replaced) shown as a callout; status `failed` when no run ever read the site (own state with the Search Console guide); the hero never says "No page needs you" after a failed run. | shared `A4` (2 cases); web `A4` |
| A5 | A cause's engine reading is dated by Google's `inspect_at` (fetch only for a page never inspected). `fix_seen_at` newer than the inspection makes the page "waiting for Google": the step is done (engine reading ok, "Fixed on your site ...") and never reopened by the older reading; the page shows its own group "Fixed on your site, waiting for Google" and a badge. | shared `A5 / fix_seen_at` (3 cases) |
| A6 | Steps read one cause at a time (by the newest good run's `by_cause_json`, all ten when it is empty), filter `cause`, sorted `impressions_28d:desc`, 200 max; a capped cause is `complete: false` and never concludes done or all-fixed. | server `A6: 1,600 rows of another cause`; shared `A6: a cause read only in part` |
| A7 | A cause whose listed pages are all `redirect:` steps has no indexing step at all (never a done); readings carry 50 candidates so 25 remain after the filter. | shared `A7` |
| A8 | `INDEXING_DONE` per cause says what was checked; pending-Google and engine-done have their own sentence; never "Google can now read and choose". | shared `A8` |
| A9 | One definition: `shouldBe` = pages Google gave a reading of minus those left out on purpose; `indexInSearchLine` is used by the page hero and the report ("Google has X of the Y pages we checked that should be in search (N not checked yet)"). | shared `A9`; contract `A9: the report's headline and the page's`; web updated hero/report cases |
| A10 | `daysToFinish` = existing-lane unchecked pages / the configured daily cap (the run's backlog only when the read is capped); the hero says the pace. | shared `A10` |
| A11 | Freeze = the engine's newest run flag only (page, recommendations, report); events only word the banner. | shared `A11`; server first page test now expects no freeze with a rolling event |
| A12 | `updateImpactOf` maps `segment`; the page filters on it. | shared `A12`; web `A12` |
| A13 / X6 | `unclassified` in `INDEX_CAUSES` with its own words, action `review`, guide `index-request-indexing`; history label follows. | shared `A3 / A13 / X6 / A25`; contract "no Other" |
| A14 / X5 | `IndexRunRow.sitemaps_json`, `IndexRun.sitemaps` (+ `partial`), `indexingSitemapReading`; step `indexing:sitemap` (no sitemap submitted, or errors) ticked off by the engine only (click = 409 `engine_reads_it`); guide `index-submit-sitemap`; recommendation `ix:site_fix:sitemap`; the page shows a callout when the newest run read the sitemap tree only in part. | shared `X5` + `partial sitemap`; server `X5: the sitemap step ...` |
| A15 | The steps' index reading and `indexingForRecs` each have an 8 s deadline (late = no reading, stored steps keep their state); reads are small (runs 5, one 200-row read per counted cause; recs: 50 quality rows, 10 ask-Google rows). | server `A15: ... do not wait for a slow index read` |
| A16 | `robotsFileState`: only a text robots.txt (200) or a 404/410 counts; 401/403/429/503/HTML = could not read (nothing recorded), 500/502/504 = not fixed. Also used for the sitemap read's robots.txt. | shared `A16` cases; server `A16: a robots.txt that answers 403` |
| A18 | Report "What needs doing" lists only causes whose action needs the client; unknown codes read "A reason we do not recognise yet", never raw. | web `A18` |
| A19 | One group rule (`inIndexGroup`, `indexGroupCauseOf`) for the summary and the paged list; page 2+ shows its own rows or a reading / could-not-read line, never page 1's rows. | shared `A19` |
| A20 | `invalidateSite(domain)` also drops reads keyed by `n8nSiteId(domain)`. | server `indexingClient.test.ts` A20 |
| A21 | A table missing from the list is not looked up again for 5 minutes (no full table-list read on every read before the engine's first run); empty-state copy says to check the connection after two days. The "switch saved before the engine ships" part is a deploy-order item (engine first, X12), not code. | server `indexingClient.test.ts` A21 |
| A22 | `getOnce` is module-private again; tests go through `fetchPublicText` / `fetchPublicOnce`. | server `verifyHeaders` A22 |
| A23 | `href="..."` removed from the canonical guide; "mobile usability" removed from the two technical-audit lines of the marketing registry. | shared copy test (existing BANNED scan) + review |
| A24 | `findingAsksSameFix(cause, findingKey)`: every pattern of the cause must match the audit finding's key (category and title), so "Fix redirect chains" no longer hides the sitemap-redirect step. | shared `A24`; server `A24` |
| A25 | `checked` excludes `error`. | shared `A3 / ... / A25` |
| A26 | FIX_CONTRACT decision 10 followed, no change of rule: `index_coverage` goes through the same `deliveryDecisionFor` as the Site Tracker's weekly report (a company that chose stages must choose it); drop-outs raise the same `alert.raised` event as Page Watch. | shared `A26` |
| A27 | A third of each tick is reserved for indexing steps (the other kinds take the rest); one sitemap download per website per 30-minute round (a click reads it fresh), only addresses kept, children 4 at a time. | server `A27: indexing steps get their share`, `A27: ... reads the sitemap once` |
| X8 | `ask_google` read: `IndexingData.askGoogle` (≤ 5, never left out on purpose, never quality during a freeze), panel "Ask Google to read these pages again" with guide `index-request-indexing`; recommendation `ix:ask_google`; never automated. | shared `X8`; server `X8`; web fix-wave case |
| X10 | `INDEX_COVERAGE_SCHEDULE` in `SCHEDULES` (05:15 daily, no built-in `since`); the delivery report reads the first `seo_index_runs` row as its start and leaves the schedule out when there is none (a schedule with no start is never "missed forever"). Not in `AUTOMATIONS`: the Pipeline's automation rows need a per-site status model (on/off, last run, run now) this daily check does not have; the Indexing page shows the last check. RUNBOOK §8 ("daily crons") is the deploy's to update. | shared `X10` |
| X11 | Rollback note in `app/API.md` and `app/docs/SITE_TASKS.md`: delete or skip `site_tasks` rows with `kind = 'indexing'` before reverting the API. | doc |
| X14 | Marketing: "Every page accounted for: in Google, or the reason why not"; tagline / summary / step "looked at every day, each page on its own schedule"; drop-outs "the day our check notices it"; pricing lines without "every day"; changelog 4.5 lines for fixed-on-site, ask Google, the sitemap step; guide count 83. | web `clientGuides` count test |
| X15 | The Indexing view reads the pages not in search (5,000 cap) and the in-search pages missing from the sitemap; the in-search pages with nothing to do come as counts from the newest good run (`indexedCounts`); every figure equals the whole-table answer. Without a good run the whole table is read as before. | shared `X15`; contract `X15: the slim read` |
| X16 | Site deletion deletes the site's rows in `seo_index_pages`, `seo_index_runs`, `seo_update_impact` (by domain) and `seo_index_history` (by engine site id); `seo_google_events` is global and stays. | server `X16` |
| X17 | The FIXED engine's harness (ix/engine ad460974, ONLY_S=^IX in `n8nio/n8n:2.41.4`, 1053 passed) wrote techand.ai's real rows, run row and callback; stored as `shared/src/__fixtures__/index-coverage-techand.json` and fed through `buildIndexingData`, `indexingCauseReadings`, `indexingSitemapReading`, `deriveSiteTasks`, `finishedStatus`, `deliveryDecision`, `eventsFor`. | `shared/src/indexing.contract.test.ts` (8) |

Not fixed here: **A17** (tutorials, another agent's). X4 (drop-outs counting intended exclusions) and X7's engine half are the engine's;
the app reads whatever drop-outs and `fix_seen_at` the engine writes.

### The engine fix wave's contract (ENGINE_BUILD.md "Fix wave 1", ix/engine b7f1c201 / ad460974)

| item | app | test |
|---|---|---|
| `redirect_error` (site_fix, not_indexed) | in `INDEX_CAUSES` / `INDEX_SITE_FIX_CAUSES` / blocking causes; step `indexing:redirect_error` "Fix redirects Google cannot follow", guide `index-fix-redirect-error`, own check = ends on an on-site page that opens (a loop is "no answer" to our 4-hop fetcher: could not tell), done sentence, finding rule | shared `engine fix wave contract` |
| `wait` + site_fix cause + `fix_seen_at` | grouped "Fixed on your site, waiting for Google", counted as pending, the step done and never reopened | shared `A5 / fix_seen_at` |
| reservation rows (`sitemaps_json.reservation`) | never the latest reading, figures, freeze, sitemap reading or step reading; "The latest check had not finished" notice | shared `engine fix wave contract` |
| `sitemaps_json.complete` / `checked` / `home_host` | `complete` decides `partial` (null: inferred); `checked: false` = the run did not read the site: a failed run (its note shown, never "Checked today") | same |
| `before_pos` / `after_pos` null | read as no data (null), never 0 | same |
| Manual Run dispatch | not used by the app (no trigger) | - |

### Checks (Docker `node:22-bookworm-slim`, whole repo mounted)

| | before (head d12654a2, as REVIEW_APP.md ran it) | after (ix/app) |
|---|---|---|
| typecheck shared / server / web | clean | clean |
| shared | 882 passed (53 files) | **921 passed** (54 files) |
| server | 1521 passed, 46 skipped | **1539 passed, 46 skipped** (79 files, 3 skipped) |
| web | 264 passed | **269 passed** (28 files) |
| web build | ok | ok |

`shared/src/appCopy.test.ts` "no string literal promises Monday" timed out at 5 s once in a full run (the known slow scan noted above) and
passed on the rerun. Engine harness for the contract fixture: 1053 passed, 0 failed (IX only, on a copy of ix/engine).

### Browser pass (fixtures, no backend)

`app/scripts/ix_indexing_fixture.ts <out> [rolling | fixwave | failed]` + `app/scripts/ix_indexing_shots.mjs` on the built `web/dist`,
Playwright 1.55: 13 views at 1440 / 375, light / dark. No console error, no horizontal overflow, h1 "Indexing" on every view. New
screenshots in `shots/`: `indexing-{desktop-light,desktop-dark,phone-light,phone-dark}-fixwave.png` (fixed on site, ask Google, a sitemap
read in part, a newest run that could not read Search Console with the figures of the check before, an update rolling out with the engine's
freeze, an unclassified group and a could-not-check group) and `indexing-{desktop-light,phone-dark}-failed.png` (no check has read Search
Console yet); the earlier screenshots were re-taken from the same build.

Commits on ix/app: `85b24db5` (shared + server), `763f8e0e` (page, report, marketing, engine contract), and this document.

## Fix wave 2 (2026-10-29, after REVIEW_2.md)

Branch `ix/app` from `3b0a8cab`, worktree `n8n_devaicon-ix-app`. Not deployed, not pushed. Commits `1c2e998b` (shared + server) and
`c96c8a60` (web + docs). New test files: `shared/src/indexing.fixwave2.test.ts` (17), `server/test/deliveryPaging.test.ts` (2); new cases
appended to `server/test/indexing.test.ts` (8) and `web/test/indexing.test.tsx` (5). Every new case was run against the code of `3b0a8cab`
first and failed there (shared 11 of 17 fail; the other 6 are guards that already held: day 1 of N-app-1, the googlebot and other-bot
header cases, the cleared `fix_seen_at`, a page in search, the reservation; server 10 of 10; web 5 of 5 plus the reworded A4 line).

**The shared rule (with the engine, N4):** a non-empty `fix_seen_at` is "Fixed on your site, waiting for Google", whatever the order of
`inspect_at` and `fix_seen_at`. Only the engine sets and clears it. The app never reopens a step from such rows, and never says "Google's
newest reading lists none of these pages" (that sentence is gone; a step closed by the engine's rows says "The daily index check lists no
page with this problem left to fix on your website", which is what the read shows).

| id | fixed how | test |
|---|---|---|
| N-app-1 (= N4) | `indexPageOf`: `fixSeenAt` = the row's `fix_seen_at` whenever it is set (not for a page in search), never compared with `inspect_at`; the page is `wait`, in the "Fixed on your site, waiting for Google" group, and `indexingCauseReadings` counts it as pending, so the step is done with the pending sentence on day 0, day 1 and day 2 alike. | shared `N-app-1` (6) |
| N-app-2 | Server: a cause is read as its `site_fix` rows and its `wait` rows (filter `action`, 200 each, `impressions_28d:desc`; the `wait` read is skipped when the run's `by_action_json` counts no `wait`). Shared: `indexingCauseReadings(rows, { read, capped })` gives every cause read a reading, so a capped cause with no open row is `complete: false` (the stored step keeps its state) instead of no reading (which read as done). | shared `N-app-2` (2); server `N-app-2: a cause whose most-seen rows are all left out` |
| N-app-3 / A1 | `readSitemap`: complete only when robots.txt was read as rules or answered 404 / 410; a 403, an HTML page, a server error or no answer makes the read partial, so "/x is no longer in your sitemap" is never concluded from /sitemap.xml alone. | server `N-app-3` |
| N-app-4 | `materialize` keeps the engine's index reading that decided an indexing step on the row (`last_check` with `by: 'index'`, `done_at` when ok; only when newer than the row's own reading; `last_check_at` untouched so the own daily check still runs). A null reading (8 s deadline, n8n error, days without a good run) then leaves `indexing:sitemap` and engine-done steps in their last known state. Recommendations follow the steps, so `ix:site_fix:sitemap` no longer comes back. | server `N-app-4` (2: the sitemap step, a pending step) |
| N-app-5 / X10 | `executionsSince(workflow, status, since)` in the n8n client pages `/executions` by `nextCursor` (250 a page, 40 pages at most, `complete: false` past that, with a note in the report) until the oldest week shown; the delivery report uses it for every daily schedule instead of the newest 150 / 50. Only `trigger` executions count as fires (unchanged). On `3b0a8cab` the test's 9-website history showed 26 fires as missed. | server `deliveryPaging` (2) |
| N-app-6 / A4 (+ engine N12) | `indexingReportFailed(summary)` (`failed: true` or `checked: false`) and `indexingNoteText(note)` (internal error text replaced) in shared. Report renderer: title "We could not check <domain> this time", the note, a warning callout, stats labelled "(last check)" or none when there are no figures, "What needs doing" says it is from the last check. Summary values carry `failed`; the summary line says "could not check the website this time". Page: eyebrow "Could not check <day>, last check <day>" and the need line names the check the figures come from. Reads `summary.note`, then `summary.why`, then `payload.note`. | web `N-app-6` (4) |
| N-app-7 | `checkIndexing`: the step's total is `max(total, urls listed, urls opened)`; when it lists more than the 10 we open and all 10 are fixed, the outcome is `partial` ("The first 10 pages of 30 are fixed. We opened 10 of 30; the daily index check reads the other 20 with Google and ticks this step off when none of them still has the problem."): nothing recorded daily, 409 `site_partial` on a click. The robots step does the same. A miss says "(we opened 10 of the 30 pages)". | server `N-app-7` (2) |
| N-app-8 | `headerNoindex` reads a comma list left to right: `name: rule` starts a crawler's rules only when `name` is not a value directive (`max-snippet`, `max-image-preview`, `max-video-preview`, `unavailable_after`); `noindex` / `none` counts for no crawler or googlebot; `bingbot: noindex` or `googlebot-news: noindex` alone is not a noindex; each header line is read on its own. | shared `N-app-8` (3) |
| N-app-9 / X14 | Reworded: Tracking settings "Every day we read Search Console to see which of your pages Google left out of search ... each page is read again on its own schedule"; Indexing page "Every morning we read Search Console for the pages of ..." and "the daily check reads the others too, each page on its own schedule"; `INDEX_FIXED_ON_SITE.weDo` and the changelog line "we look up Google's reading of it again within a day or two"; Steps on your website "We check them for you and tick each one off when it is in place"; the pending done sentence; also `INDEX_COVERAGE_SCHEDULE.summary`, the `index-coverage` guide and the report's "Not checked yet" tip (same phrase). | shared `N-app-9` (2); web `N-app-9` (source scan) |
| N-app-10 | A guessed /sitemap.xml that answers 200 with a web page (an app shell) is skipped like a 404, so it no longer makes the sitemap named in robots.txt partial. | server `N-app-10` |
| N-app-11 | robots.txt and every sitemap must end on the website's own host (`finalUrl`); otherwise the sitemap read is partial, and the robots step answers "could not tell". | server `N-app-11` |
| N-app-12 | `pageCanonicalOf` resolves the href with the WHATWG URL against the page address (relative, `../`, `?q`, protocol-relative, `&amp;`). | shared `N-app-12` (2) |
| A6 | = N-app-2. | |
| X17 | The contract fixture plus engine-fix-wave rows: two `fix_seen_at` rows (`inspect_at` equal to and after it), `ask_google`, a `redirect_error` row and a reservation run, through `buildIndexingData`, `indexingCauseReadings` and `deriveSiteTasks`. | shared `X17` (2) |

Not changed: the engine half of N4 / N12 (the engine fixer's), A17 (tutorials). The steps' index reading now makes up to two reads per
counted cause (one when the run counted no `wait`), still inside the 8 s deadline (A15).

### Checks (host Node 22.11 on a copy of the tree; Docker did not answer `docker info`)

Run with `NODE_OPTIONS=--experimental-require-module` (Node 22.11 needs the flag for `require()` of an ES module, which
`@fastify/static` does; the Docker image's newer Node 22 has it on) and `TZ=UTC` (`web/test/creditsTab.test.tsx` formats a date in the
host's time zone; it fails in PKT on the clean head too). `npm ci` in a scratch copy (the worktree's `node_modules` are Linux builds), the
engine tree linked beside it for the parity tests.

| | before (3b0a8cab, REVIEW_2) | after |
|---|---|---|
| typecheck shared / server / web | clean | clean |
| shared | 921 passed | **938 passed** (55 files) |
| server | 1539 passed, 46 skipped | **1549 passed, 46 skipped** (77 files, 3 skipped) |
| web | 269 passed | **274 passed** (28 files) |
| web build | ok | ok |

Not run: the engine harness (no engine change here), the browser pass (no Docker), `app/scripts/smoke.py` (no dev stack).

## Fix wave 3 (2026-10-30, after REVIEW_3.md)

Branch `ix/app` from `7777e17d`, worktree `n8n_devaicon-ix-app`. Not deployed, not pushed. Commits `0409a89b` (shared + server; also holds
the R5 note text in `indexing.ts`) and `33d0f773` (report renderer, API.md, SITE_TASKS.md). New test file
`shared/src/indexing.fixwave3.test.ts` (14), new fixture `shared/src/__fixtures__/index-coverage-wave2.json` (a copy of the engine's
`contract_rows_wave2.json`, written by IXW14 from the real nodes), new cases in `server/test/indexing.test.ts` (3) and
`web/test/indexing.test.tsx` (1). Run against `7777e17d` first: shared 11 of 14 fail, server 2 of 3, web 1 of 1; the passing ones are
guards (an own check that still finds the problem, the fixture equal to the engine's file, the reservation in the page view, a click that
finds the noindex is recorded).

| id | fixed how | test |
|---|---|---|
| R1 (= N3 / X7 app half) | `IndexPageRow.fix_failed_at` / `ask_google_at`; `indexPageOf` gives `fixFailedAt` (set, and not older than `fix_seen_at`; such a page is `site_fix`, never "fixed on your site"; a newer `fix_seen_at` is a later fix, waiting again). `indexingCauseReadings` counts `googleStillSees` / `googleStillSeesAt` among the open pages; the step's payload carries `googleStillSees`, its engine reading says "Google read N pages again after the change we saw on your website and still sees the problem", and `deriveSiteTasks` lets no reading that calls it done decide it (our own check, or an older engine reading kept on the row): to do, warning. The detail explains it in plain words (the website may show Google something different from what a browser sees, e.g. a noindex, a block or an error sent only to Google by a plugin, a CDN or a server rule) and points to the cause's guide, which gains the answer "Our check finds it fixed, but Google still sees the problem" (URL Inspection, Test live URL) on the 8 cause guides. Server: `googleStillSeesOutcome` turns an own check that finds it fixed (or fixed in part) into "not decided": the daily check records nothing (only `last_check_at` moves, so it no longer flips the step to Done every day) and a click answers 409 `google_still_sees`; an own check that still finds the problem is recorded as usual. | shared `R1` (7); server `fix wave 3` (3, incl. two daily ticks) |
| R5 (app side) | `indexingNoteText` replaces an internal error up to the sentence the engine writes after it (or the end), so `TypeError x.y.` leaves nothing behind, and drops the engine's "The figures are from the last check." / "Nothing has been checked yet."; the screen says where the figures come from once (report header; the callout no longer repeats the note; "What needs doing (last check)"; the page's notice keeps its own "The figures below are from the check of <date>."). | shared `R5` (2); web `fix wave 3` |
| R9 | `pageCanonicalOf`: `href=""` / `href=''` is no canonical (''), never a URL made of the page or the quotes. | shared `R9` |
| X17 | The engine's wave 2 rows (fix_seen_at, fix_failed_at, ask_google + ask_google_at, redirect_error, the reservation run) plus a row with `sources: 'sitemap,final'` through `indexPageOf`, `buildIndexingData`, `indexingCauseReadings`, `deriveSiteTasks`; a parity case fails if the fixture drifts from the engine's file. The app's harness-made techand fixture was not regenerated: this worktree has no generated `harness/code_v4` (the build needs `n8n/.env`). | shared `X17` (4) |

### Checks (Docker `node:22-bookworm-slim`, `TZ=UTC`, whole repo mounted)

| | before (7777e17d, fix wave 2) | after |
|---|---|---|
| typecheck shared / server / web | clean | clean |
| shared | 938 passed | **952 passed** (56 files) |
| server | 1549 passed, 46 skipped | **1552 passed, 46 skipped** (77 files, 3 skipped) |
| web | 274 passed | **275 passed** (28 files) |
| web build | ok | ok |

Not run: the engine harness (no engine change), the browser pass, `app/scripts/smoke.py`. Not done here: the engine half of R5 (keep the
exception out of `why`), R2-R4, R6-R8 (engine), A17 (the Indexing tutorial; the guide's new answer and the step's new wording belong in it).

## Final browser check (2026-10-30, before the production deploy)

Branch `feature/indexing` from `97422c3c`, nothing deployed. `app/scripts/ix_indexing_fixture.ts` gained two states: `final` (fix waves 2
and 3: two pages Google read again after the fix we saw and still sees with the noindex (`fix_failed_at`), a step fixed on the site and
waiting for Google, six pages marked to ask Google about (five shown), the `indexing:sitemap` step from 2 sitemap errors, a newest run
that could not check the website (`checked: false`, an internal error in its note), null positions in an update's impact, an update
rolling out, a redirect error and an unclassified page) and `reserve` (the newest run is a reservation: a check not finished). In `final`
it also writes the Steps on your website (through `deriveSiteTasks`), the Recommendations (through the server's
`indexingRecommendations`) and two `index_coverage` reports (normal and failed). `ix_indexing_shots.mjs final` opens 10 views at 1440 and
375, light and dark (40): the Indexing page in 6 states, the report and the failed report, the Pipeline's Steps on your website and the
Recommendations, plus the details of a page Google still sees after the fix. Per view it records console errors, failed requests (every
other read of those pages is answered from fixtures now: billing, portal context, consistency, settings, coming up, issues), overflow, the
h1, unlabelled buttons and links, low-contrast text, cut-off text and the copy rule (em dash, curly quotes, ellipsis, "we submit" / "we ask
Google" / "we change your site", indexing promises, internal names, raw codes, `undefined` / `NaN` / `null`).

**Result:** 40 views, no console error, no failed request (non-GETs refused by the fixture server, none sent), no horizontal overflow,
one h1 on every view ("Indexing", "Index coverage: novaand-demo.com", "Pipeline", "Recommendations"). The audit's contrast hits are the
blue / ink hero (its colour sits on a layer the script does not read; checked by eye, readable in both themes); its "unlabelled" link is
the logo (an image with alt text) and its "cut-off" texts are screen-reader-only spans and the user name: none is a defect. Screenshots
in `shots/` as `<view>-<size>-<theme>-final.png` (desktop light and phone dark of every view, all four of the fix-wave page and of the
steps, and `indexing-waves-details-desktop-light-final.png`).

**Fixed (wording the screenshots showed wrong; tests fail on `97422c3c`):**

| what | fix | test |
|---|---|---|
| Notices said "from the check of 2026-10-29" and "started 2026-10-29 08:40 UTC" | `indexDayText` (shared): "29 Oct", "29 Oct, 08:40 UTC", in UTC | shared `indexing.final.test.ts` (2) |
| "1 page that were in search before" | "1 page that was" | web `final browser check` |
| A page Google read again after the fix and still sees with the problem looked like any other "Left out" row (only its details said it) | its row says "Google read it again on <day>, after the change we saw, and still sees the problem" | web `final browser check` |
| Step: "Fixed on your site: we saw the change on all 2 pages" | "both pages" | shared |
| Step detail ended "... from these pages. 3 pages." | "It concerns 3 pages." (and "It concerns 1 page.") | shared |
| Report: ISO days on drop-outs and updates; status "changed" (or any unknown code) printed raw | days in words; "policy page changed", unknown = "announced" | web `final browser check` |
| Recommendations header: "Every next step the SEO engine sees" (internal name) | "Every next step we see" | browser audit (no "engine" on any view) |

**Checks** (Docker `node:22-bookworm-slim`, `TZ=UTC`): typecheck shared / server / web clean; shared **960 passed** (57 files); server
**1552 passed, 46 skipped**; web **277 passed** (28 files); web build ok. Not run: `app/scripts/smoke.py`, the engine harness (no engine
change).

**Left:** the "I've done it, check now" button stays on a step Google still sees after the fix (by design, R1: the click answers 409 with a
plain explanation); the step's detail is long on a phone. The tutorials backlog row for these wording changes (7.11, 5.9, the
Recommendations header) is still to add in the video-skills repo.

## Wave 2 (DESIGN_WAVE2)

Branch `ix/app` from `35c24b03`, worktree `n8n_devaicon-ix-app`. DESIGN_WAVE2.md §3 / §4 (app). Not deployed, not pushed, no production
access. No app migration (the new step kind is text in `site_tasks.kind`, the new setting lives in `seo_monitors`). Aligned with the engine's
wave 2 (`ix/engine` ed3dc2a5 / 91296577 / 1630d708, ENGINE_BUILD.md "Wave 2", contract details 1-13) after it landed.

### What, where
| Piece | Where |
|---|---|
| Columns read: `seo_index_pages.linked_by` / `asked_google_at` / `google_read_after_ask_at`, `seo_monitors.index_sitemap_submit`, `seo_index_runs.sitemaps_json.permission` / `permission_full` / `submissions[]` / `list` (all optional) | `shared/src/tables.ts`, `indexRunOf` / `runSitemapsOf` in `shared/src/indexing.ts` |
| The utility list, a mirror of the engine's `IX.UTILITY` (segments, `/security` top level only, job directories; whole segment, any case, any depth, `.html` / `.php` / `.asp` dropped): `INDEX_UTILITY_SEGMENTS`, `INDEX_UTILITY_TOP_ONLY`, `INDEX_JOB_PARENTS`, `isUtilityPage`, `isJobPosting`. Never "Improve this page" (page and recommendations), never asked about, never a link source (job postings too); job postings are NOT utility pages | `shared/src/indexing.ts`; parity test `shared/src/indexing.utility-parity.test.ts` reads `n8n/seo-agent/v5/code/_index_kit.js` (skipped on a tree whose kit has no `UTILITY`; `IX_KIT_PATH` points it elsewhere) |
| §3.1 groups: `linked_waiting` ("Google has not visited these yet": the engine's `wait` on `unknown_to_google` / `discovered_not_crawled`; no step, no suggestions, what helps: links from other websites, asking Google), `canonical_parent` ("Pages that say they are a copy of another page", part of the step `indexing:canonical_elsewhere`), `utility` ("Policy and utility pages: fine to leave out"); the `links` groups link to `indexing:links`; each page row says where it is linked from | `indexGroupCauseOf`, `INDEX_LINKED_WAITING`, `INDEX_CANONICAL_PARENT`, `INDEX_UTILITY_GROUP`, `canonicalOwnTitle`; `web/src/pages/site/IndexingPage.tsx` |
| §3.2 step kind `index_links`, key `indexing:links`: up to 10 (target, source) pairs, kept as listed; own check opens the source pages (own host, safe fetcher, 4 at a time, 45 s cap) and looks for the `<a href>` (`pageLinksTo`); "N of M links found"; unreachable = 503 / nothing daily; wall = 409 `site_unsure`; the engine's reading only closes it (complete read, no page left) or marks pairs listed after the last own check "not checked yet" (to do, never "needed again"); a third of the tick shared with `indexing` (`INDEX_TASK_KINDS`); exhaustive switches; guide `index-add-internal-links`; recommendation `ix:links` (the count-based `ix:links:<cause>` are no longer made: those counts hold already-linked pages) | `shared/src/site-tasks.ts` (`linksDraft`, `presentLinks`, `linkPairsOf`), `server/src/services/siteTasks.ts` (`readIndexing` + links read, `checkLinks`, tick), `server/src/services/recommendations.ts`, `server/src/services/indexing.ts` |
| Canonical to another page with its own title: payload `ownTitle`; the own check closes those pages ONLY when the canonical names the page itself (`indexingPageFixed(..., { ownTitle })`); step and guide extended ("point the canonical tag to the page itself, and add it to your sitemap if it is not there") | `indexingCauseReadings`, `presentIndexing`, guide `index-canonical-sitemap` |
| "I asked Google": `POST …/data/indexing/asked-google` (member+, verified, 30 / 10 min per person, audit `indexing.asked_google`), writes ONLY `asked_google_at` on that page's row through the Data Table `rows/update` (filter `site_id` + `url`, the same client the ladder settings use); 404 / 409 `already_in_search` / 503 (nothing saved); the page then reads "Waiting for Google to read it again", "Google read it again on <day>", the 14-day note, or "not recorded" (below); pages asked about stay listed 45 days with the outcome | `markAskedGoogle` (server `services/indexing.ts`), route in `routes/indexing.ts`, `askGoogleStatus`, `useAskedGoogle`, `AskGooglePanel` |
| Sitemap switch: `indexSitemapSubmit` (schema optional, no default; payload `index_sitemap_submit` last; read back in `monitorsFromRow`; `npm run export:payloads` added the Site Admin case "index coverage: sitemap submission switched on" to `fixtures_platform_admin.json`, request bodies unchanged); "Let Alaventra submit your sitemap to Google" under Indexing in Tracking & monitors with the access line (Full: "We can submit your sitemap"; read-only: warning + guide `search-console-full-access`; not read: "We will know after the next daily check") | `shared/src/schemas.ts`, `shared/src/payload.ts`, `server/src/services/data.ts`, `web/src/components/site/MonitorSettingsFields.tsx` (`SitemapAccessLine`), `SiteSettingsPage.tsx` |
| Indexing page card "Your sitemap in Search Console": the switch, the access, each submission (submitted / refused / not submitted, why in words, the day Search Console listed it and the day Google read it) and "We will submit it on the next daily check" when Search Console lists none | `indexSitemapState`, `SitemapPanel` |
| `indexing:sitemap` step: not raised for a MISSING sitemap when the switch is on and Google reports Full access (`sitemapAuto`); errors in a submitted sitemap stay the client's; its text names the switch as the other way | `indexingDrafts`, `presentIndexing` |
| Report: the pages that need a link are counted from `by_action.links` ("Need a link from another page of yours"), never the two link causes (which count already-linked pages) | `web/src/components/reports/indexing.tsx` |
| Copy: the read-only promise rewritten to "We only read your Search Console, unless you switch on sitemap submission, which lets us submit your sitemap and nothing else." (setup guide `search-console-access`, connection screens `ServiceAccountSteps` / `GoogleConnectionPanel`, marketing Security page steps / FAQ / heading, privacy draft, the index-coverage FAQ); new guides `search-console-full-access`, `index-add-internal-links`; guides `index-request-indexing`, `index-submit-sitemap`, `index-coverage` extended | `shared/src/guides.ts`, `guide-links.ts`, web |
| Marketing: index-coverage registry (benefits, FAQ), changelog 4.6, pricing hint, guided-setup count 86 | `web/src/marketing/content/*`, `SecurityPage.tsx`, `legal.ts` |
| Docs | `app/API.md` (Index coverage, "Wave 2"), `app/docs/SITE_TASKS.md` §7 |

### The engine's app-contract points (coordinator, 2026-10-30) and how each is handled
1. **Write only `asked_google_at`**: `updateRows` (`PATCH rows/update`, filter `site_id` + `url`, data `{ asked_google_at }`), never an upsert. The
   race (an engine run that loaded the row before the write saves it back): the app keeps its own record of every press (the audit log,
   `indexing.asked_google`, last 45 days, read by `askedByApp`); a page whose row does not hold the press (or holds an older one by more than a
   minute) shows **"Not recorded"** with "You told us on <day> that you asked Google, but the daily index check did not keep it. Press I asked
   Google again." and the button is back; a press within a day is not rewritten unless the row lost it. Tests: shared "a press the engine did
   not keep", server "a press an overlapping engine run wrote back".
2. **No own-title flag**: `canonicalOwnTitle` = not in the sitemap OR the note starts "This page tells Google it is a copy of"; such pages go
   to the `canonical_parent` group and the payload `ownTitle` (own check: canonical names the page itself, nothing else).
3. **`IX.UTILITY` mirrored exactly** (also the extension rule); `indexing.utility-parity.test.ts` passes against ix/engine's kit
   (`IX_KIT_PATH`) and bites once the trees are merged.
4. **`{}` = no sitemap, so the `indexing:sitemap` step will appear for such sites**: its title / detail already had both cases (none
   submitted / errors) and now names sitemap submission as the other way; with the switch on and Full access (`permission_full` when sent,
   else `siteOwner` / `siteFullUser`) there is no step, and the Indexing card says "We will submit it on the next daily check; there is
   nothing to do on your side."
5. **Job postings**: never asked about, never a link source, never a utility page (they keep their cause and group).
6. **Re-checks every 3 days for 14 days**: the `index-request-indexing` guide says so; the page shows "Waiting for Google to read it again"
   until the engine's `google_read_after_ask_at`, then the 14-day note.
Also read from the engine's shape: submission statuses `submitted` / `confirmed` / `read` (ok), `denied` / `refused` (refused), `failed`;
`confirmed_at` / `read_at` win over the `list` dates; reason codes `not_listed` / `errors_changed` / `changed` in words (an unknown code is
not shown); a reservation row is never the access reading.

### Tests
New: `shared/src/indexing.wave2.test.ts` (29), `shared/src/indexing.utility-parity.test.ts` (2), `server/test/indexingWave2.test.ts` (11),
`web/test/indexingWave2.test.tsx` (8). Run against a clean copy of `35c24b03` (git archive, `npm ci`): shared 31 of 31 fail, server 11 of
11, web 8 of 8 (the parity test with `IX_KIT_PATH` at ix/engine's kit).

### Checks (Docker `node:22-bookworm-slim`, `TZ=UTC`, the whole repo mounted, `npm ci`)
| | before (35c24b03, fix wave 3 + final check) | after (ix/app, wave 2) |
|---|---|---|
| typecheck shared / server / web | clean | clean |
| shared | 960 passed | **986 passed, 1 skipped** (59 files; the skip is the parity case on this tree, whose engine kit has no `UTILITY` yet; it passes against ix/engine's kit with `IX_KIT_PATH`) |
| server | 1552 passed, 46 skipped | **1563 passed, 46 skipped** (78 files, 3 skipped) |
| web | 277 passed | **285 passed** (29 files) |
| web build | ok | ok |

### Browser pass (fixtures, no backend)
`app/scripts/ix_indexing_fixture.ts <out> wave2 | wave2-restricted` (devaicon.com's shape, anonymised: 9 pages in search, 8 already linked
and not visited, 3 that need a link with one own check "1 of 3 links found", the 7 /industries/* pages naming /industries, /privacy /cookies
/security, an article to improve, two pages to ask Google about (one asked two days ago), one asked and read again, sitemap submission on with
Full access and a submission Google read; then the same with read-only access) and `app/scripts/ix_indexing_shots.mjs wave2` on the built
`web/dist`, Playwright 1.55: 6 views (Indexing x 2, the Pipeline's Steps on your website, Recommendations, Tracking & monitors x 2) at 1440
and 375, light and dark (24). No console error, no horizontal overflow, one h1 on every view. The only failed reads are `/costs` and
`/data/ai` on Website settings (reads the fixture server does not answer; not part of this work). The audit's hits are the known ones of
the final check (the blue hero's contrast read off its layer, the logo link, screen-reader spans) plus "we submit" in the sitemap card when
the switch is on and Google gives Full access, which is the one allowed case; the pass found the card saying "we submit it" with read-only
access too, now "nothing can be submitted until Google gives us Full access". Screenshots in `shots/`: `indexing-wave2-desktop-light.png`,
`indexing-wave2-phone-dark.png`, `indexing-wave2-restricted-desktop-light.png`, `indexing-wave2-waiting-desktop-light.png`,
`steps-wave2-{desktop-light,phone-dark}.png`, `recommendations-wave2-desktop-light.png`, `tracking-wave2-desktop-light.png`,
`tracking-wave2-restricted-{desktop-light,phone-dark}.png`.

### Contract changes / notes for the engine
- No change to DESIGN_WAVE2's columns. The app reads, beyond them, the engine's `sitemaps_json.permission_full`, `submissions[].confirmed_at`
  / `read_at` and the optional `list` / `listed` / `sitemaps` array (`path`, `lastSubmitted`, `lastDownloaded`) as a fallback for the dates.
- The app filters `seo_index_pages` with `asked_google_at gte <ISO>` (a string column) for the pages asked about lately.
- `fixtures_platform_admin.json` gains "index coverage: sitemap submission switched on" (`index_sitemap_submit: true` must be stored; ix/engine's
  `Monitor_Row_Admin.js` does).
- The app never writes anything else to an engine table here; the asked-google write is `rows/update` of one column on one row.

### Not done / left
- Not run: `app/scripts/smoke.py`, a real dev stack, the engine harness (no engine change in this branch), a live sitemap submission.
- Tutorials: a backlog row was added (video-skills repo, commit f573223, not pushed), no filming (owner rule).
- The links step lists only targets the engine could suggest a page for; a page with no suggestion stays on the Indexing page ("Google has not
  found it yet") without a step of its own.
- "I asked Google" accepts any not-in-search page the check knows (the button is only shown for the listed ones).
