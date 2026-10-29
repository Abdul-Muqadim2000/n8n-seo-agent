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
