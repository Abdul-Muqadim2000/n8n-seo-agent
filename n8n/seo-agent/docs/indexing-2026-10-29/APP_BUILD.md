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
