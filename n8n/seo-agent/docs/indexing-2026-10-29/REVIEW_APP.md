# Index coverage: adversarial review of the web-app half (2026-10-29)

Scope: `git diff feature/seo-agent-v4.5...HEAD -- app/` on `feature/indexing` (head `d12654a2`), against DESIGN.md §2 / §5 / §6 / §7,
ENGINE_BUILD.md "Contract changes", app/docs/SITE_TASKS.md, CONVENTIONS / BRAND / CLAUDE.md rules. Read only: no source edited.

How it was checked: every changed app file read; the engine's `_index_kit.js`, `IX_Diagnose.js`, `IX_Run_Rows.js` read for the contract;
the three suites run in `node:22-bookworm-slim` on a copy of the tree (`git archive` of `app/` + `n8n/seo-agent/`) with probe tests added
to the copy only (not committed):

| suite | result on the copy |
|---|---|
| shared | 53 files, **892 passed** (882 of the branch + 10 probes), 0 failed |
| server | 76 files, **1524 passed** (1521 + 3 probes), 46 skipped, 0 failed |
| web | 29 files, **266 passed** (264 + 2 probes), 0 failed (the guide-count test passes now that the marketing fact is 81) |
| typecheck shared / server / web | clean |

Probe files (scratch copy only): `shared/src/zz_ixprobe.test.ts` (P1-P8), `server/test/zz_ixprobe.test.ts` (S1, S1b, S1c),
`web/test/zz_ixprobe.test.tsx` (W1, W2). Every probe asserts the defective behaviour and **passed**, i.e. the defect is reproduced.

Severity: High = regression / security / wrong statement to the client; Medium; Low. "Suspected" = not reproduced.

## Findings

### High

**A1 (High) A partial or unreadable sitemap marks steps done: "is no longer in your sitemap".**
`app/server/src/services/siteTasks.ts:264-289` (`sitemapUrls`), used by `indexingPageFixed` (`app/shared/src/indexing.ts:854-875`) for
`access_denied`, `not_found`, `redirect`, `canonical_elsewhere`. `sitemapUrls` reads at most 3 robots `Sitemap:` lines + `/sitemap.xml`,
follows only 5 children of an index, cuts each file at 4 MB, does not gunzip `.gz`, and sets `read = true` on any 200 answer (an HTML
page included). Any of these yields a Set that lacks the page, `inSitemap === false`, and the step is **done**.
Scenario: a WordPress index with 7 children (Yoast + WooCommerce is typical), the page is in child 6 and still answers 403 -> "done,
/page6 is no longer in your sitemap". Same for a SPA host that answers `/sitemap.xml` with its `index.html` (200): a page still answering
404 -> done. Verified: S1 and S1b (`{"ok":true,"message":"/page6 is no longer in your sitemap."}`, `"/gone is no longer in your sitemap."`).
Fix: return "sitemap fully read" only when every root and child was an XML urlset / index, none truncated or skipped; otherwise treat
`inSitemap` as unknown (`null`) so only the page's own answer decides.

**A2 (High) The own check calls a page "fixed" on answers that are not fixes (bot walls, 404s, empty bodies).**
`app/shared/src/indexing.ts:847-875`. `server_error`: any status < 500 is fixed, so a WAF 403 or a 404 -> "fixed: /x answers 403".
`access_denied`: any status other than 401/403 is fixed, so 404 and 503 -> fixed. `canonical_elsewhere`: no canonical found = "names
itself as the main version", so a 404 or an empty body -> fixed. `noindex`: a 200 challenge page without a robots meta -> fixed.
Verified: P1, P1b, P2, P2b, S1c (`{"ok":true,"message":"/x answers 403."}` for a server-error step). The 403 case is exactly the "bot wall"
SITE_TASKS warns about. Fix: a page counts as fixed only on a 2xx HTML answer (and for `noindex` / `canonical_elsewhere` only when the
body is the real page, e.g. has `<head>`), with each cause's own rule on top; anything else is "not fixed" or, for 403 / 429 / 503 with a
challenge marker, "could not read" (`reached: false`).

**A3 (High) Pages that could not be checked, and pages Google left out for an undocumented reason, are shown as "In search" with a green tick.**
`app/web/src/pages/site/IndexingPage.tsx:191` (`none: 'good'`), `:205` (CheckCircle2 for `none`), `:213`
(`description={INDEX_ACTION_INFO[g.action].label}`), with `app/shared/src/indexing.ts:638-660` grouping every non-indexed row whose
action is `none`. The engine writes action `none` for `not_checked` (state `error`) and for the new `unclassified` cause (state
`not_indexed`). Result: a panel "Could not be checked · In search" with a green check, and "Other · In search · What you do: Nothing for
now" for pages that are not in Google. This is the DESIGN §1 rule "never treat not checked as fine". Verified: P3
(`[["none","not_checked","Could not be checked","In search",…],["none","other","Other","In search","Nothing for now."]]`) and W1 (rendered
text "Could not be checked 1 In search"). Fix: never group `action = none` under the "In search" label; give `state = error` its own
neutral section ("Could not check, we try again tomorrow") and `not_indexed + none` its own warning section.

**A4 (High) A run that could not read Search Console (no access, quota, sitemap) looks like a clean check.**
`app/shared/src/indexing.ts:616-680` and `IndexingPage.tsx:73-113`. The engine writes a run row for a site it could not check (zero
counts, `note` = "Search Console refused access for this property, so pages were not checked." / quota / no sitemap; `IX_Run_Rows.js`).
The app reads `note` (`indexRunOf`) but never shows it; `status` becomes `ok` because a run exists, `checkedAt` = that run, so the page says
"Checked 29 Oct · We know 0 pages · No page needs you right now · Existing pages checked: 0 of 0". The "Search Console not connected" empty
state is reached only when no run exists at all. Same for a site with stored pages: a failed day still stamps "Checked today". Verified: P8
and W2 (rendered text above). Fix: show the newest run's `note` as a warning callout; when the newest run read nothing (failed / no
access) do not use its `run_at` as "checked", and show the Search Console guide state when there are no page rows.

**A5 (High) A step the client fixed and we verified is reopened by the engine's re-read of Google's old reading.**
`app/shared/src/site-tasks.ts:171-187` (engine reading `at = c.readAt`) with `indexingCauseReadings` (`indexing.ts:905-920`,
`readAt` = newest of `inspect_at` / `fetch_at`). The engine keeps a documented enum cause (e.g. `BLOCKED_BY_META_TAG` -> `noindex`) until
Google re-inspects (`_index_kit.js:286-300`: today's fetch overrides only soft reasons), but stamps `fetch_at` on its weekly re-fetch
(`IX_Diagnose.js:52`, `fetch_refresh_days: 7`). So after the client removes noindex and "I've done it, check now" says done, the next
engine re-fetch makes `readAt` newer and the step goes back to to-do, marked **reopened / Important**, "Google's newest reading still lists 1
page with this problem". It then flips back on the next daily check. The redirect kind has a guard for exactly this lag (`indexStale`); the
indexing kind has none, and SITE_TASKS says only two misses an hour apart may reopen. Verified: P4 (`todo true Google's newest reading still
lists 1 page with this problem.`). Fix: date the engine reading by `inspect_at` only (Google's reading), and let it reopen a step only when
that inspection is newer than our own successful check (or apply the redirect `indexStale` rule with Google's recrawl lag).

**A6 (High, suspected on real data) More than 1,500 site-fix rows can hide a whole cause and mark its step done.**
`app/server/src/services/siteTasks.ts:108-122`: `indexPages` filtered `action = site_fix`, `max: 1500`, **no sort**. A site with, say,
1,600 `indexed_not_in_sitemap` rows read first and 30 `noindex` rows after them gets no `noindex` reading; `indexingDrafts`
(`site-tasks.ts:189-194`) then reads the stored `indexing:noindex` step as done: "Google's newest reading lists none of these pages with
this problem any more". Totals of the surviving causes are understated too. Verified by reading (the mock in `server/test/indexing.test.ts`
slices by `max` in insertion order the same way); n8n's default order on the real table not observed. Fix: read per cause (one filtered
read each, or counts from the run's `by_cause_json`) and never conclude "none any more" from a read that hit its cap.

**A7 (High) A step whose pages are covered by `redirect:` steps is called done, with a false sentence.**
`app/shared/src/site-tasks.ts:177-194`. When every listed URL of a cause is already a `redirect:` step, `urls` is empty, the cause is not
`live`, and a stored `indexing:not_found` step is read as done by the engine: "Google's newest reading lists none of these pages with this
problem any more" and "Fixed: page not found (404). Google can now read and choose these pages". The pages still answer 404. Same when the
top 25 are all redirect steps but `total` is larger (the rest are never listed). Verified: P5. Fix: keep the cause live (state from the
remaining count) or drop the stored step without a "done" reading; the one-page-one-ask filter must not produce an engine "ok".

### Medium

**A8 (Medium) The done sentence promises what was not checked.** `app/shared/src/site-tasks.ts:217-220`: every done indexing step says
"Google can now read and choose these pages". For `access_denied` / `not_found` / `redirect` / `canonical_elsewhere` done by "no longer in
your sitemap", the page still refuses visitors or 404s; for sitemap causes nothing about readability was checked. Fix: one done sentence
per cause, saying what is true now ("listed in your sitemap", "removed from your sitemap", "answers 200 without noindex").

**A9 (Medium) Two denominators for "pages in Google", and the hero counts unchecked pages as missing.** `IndexingPage.tsx:93` ("Google
has X of your Y pages that should be in search", Y = `shouldBe` = known minus leave-out, `indexing.ts:625`, which includes never-checked
and could-not-check pages) vs `components/reports/indexing.tsx:37` ("Google has X of the Y pages we know", Y = all known including
left-out). On a first week with 4,700 unchecked pages the page says "Google has 300 of your 5,000 pages that should be in search", implying
4,700 are missing. The branch's own web test asserts "1 of your 6" where one of the 6 is unchecked. Fix: Y = checked pages that should be
in search, with "N not checked yet" beside it; use the same figure in the report.

**A10 (Medium) "About N days to check the rest" is wrong after a quota stop, a second run of the day, or re-checks.**
`app/shared/src/indexing.ts:633-635`: `perDay = latest.inspected || dailyCap`. A run that hit the quota after the 2 probes gives
`inspected = 2` -> "about 1,500 days" for 3,000 pages (P6). `inspected` also counts new-lane and re-check inspections, and a manual second
run of the day carries only its own count. `backlog_left` is all lanes (`IX_Run_Rows.js` `backlog_left: sum.unknown`) while the sentence
says "Existing pages checked". Fix: use the daily cap minus the planned non-backlog checks (or the median `inspected` of the last 7 full
runs), and the existing lane's unknown count.

**A11 (Medium) Freeze rule differs between the page and the recommendations.** `indexing.ts:589-617` freezes whenever any core / spam
event is `rolling_out` in the table; the engine stops freezing after 30 days (`freeze_max_days`) and writes `freeze=false` on the run;
`recommendations.ts:493` reads only `run.freeze`. A stale open event: the Recommendations offer "Improve this page" while the Indexing page
hides it and shows "rolling out, wait". Verified: P7. Fix: take the freeze from the newest run only (the engine already applies the rule),
use events only for the banner text.

**A12 (Medium) Contract mismatch: update impact pages are never listed.** `IndexingPage.tsx:411-414` filters `r.state === 'dropped'`; the
engine puts dropped / stable / gained in `segment` and the page's index state in `state` (`_index_kit.js:605-608`). The "pages that lost
ground" list after an update never renders (counts do). The web test fixture uses `state: 'dropped'`, mirroring the bug. Fix: map
`segment` in `updateImpactOf` and filter on it.

**A13 (Medium) Contract change 1 (`unclassified`) not handled.** `INDEX_CAUSES` (`indexing.ts:14-37`) lacks it, so it becomes "Other: A
reading we do not have words for yet. What you do: Nothing for now", while the engine's note tells the client to check the address in
Search Console. Together with A3 it sits under "In search". Fix: add `unclassified` with its own label / action / sentence.

**A14 (Medium) Contract change 2 (`seo_index_runs.sitemaps_json`) ignored.** No app code reads it; DESIGN §8 says the app raises a step
when no sitemap is submitted or it has errors. Nothing is raised and the run note that says so is not shown (A4). Fix: read it, add the
step (or at least the callout).

**A15 (Medium) Pipeline / Overview / Recommendations now wait on a large engine read.** `siteTasks.ts:74,116-128` adds a 1,500-row read
(up to 6 sequential n8n pages, each with a 20 s timeout, no overall cap) to `engineReadings`, awaited by `siteTasksOf` in Pipeline
(`pipeline.ts:609`), Recommendations / Overview (`recommendations.ts:542`, `routes/data.ts:125`). SITE_TASKS §2 promised "three small
reads". On a slow n8n (during an index run writing thousands of upserts) these pages can wait up to ~2 minutes before the catch. The cache
key differs from the Indexing page's 5,000-row read (20 sequential pages), so both are fetched. Suspected impact (not timed). Fix: read the
newest run's `by_cause_json` + 25 URLs per cause, or race the read against a short timeout and treat late as null.

**A16 (Medium, suspected) robots.txt step done on a bot wall.** `siteTasks.ts:308-316`: a robots.txt that answers 403 / 401 or an HTML
page to our fetcher is "not found" -> "robots.txt lets Google read". A WAF that blocks our user agent but serves Googlebot the real file
(with the Disallow) is marked done. Fix: treat 401 / 403 / 429 / HTML as "could not read" (`reached: false`) for the app's check.

**A17 (Medium, process) Tutorials not updated.** CLAUDE.md "Tutorial videos follow the product": a new page, settings row, guide set and
step kind ship with no tutorial in `~/Downloads/hiresuite-video-skills/alaventra` (`tutorials.json` and `references/platform.md` have no
index coverage entry) and no entry in `app/web/src/marketing/content/tutorials.ts`.

### Low

**A18 (Low)** Report renderer `components/reports/indexing.tsx:28-31,92` lists every cause under "What needs doing", including left-out
causes (`low_value`, `alternate`) and `not_checked`, and prints unknown codes raw (`unclassified`). Fix: only need-you causes; label all.

**A19 (Low)** Paged groups: `indexPagesPage` (`indexing.ts:690-700`) does not apply the summary's "skip never-checked" rule, so page 2+ of
an `existing:none:other` group would mix in thousands of "Not checked yet" pages while `g.count` says otherwise; `IndexingPage.tsx:201`
shows page 1 items under "Page 2" while loading or when the read is unreadable.

**A20 (Low)** `invalidateSite(domain)` (runs.ts) matches cache keys by domain; index reads are keyed by `site_id`, so after an
`index_coverage` callback the page and the steps derived in `afterSiteTaskCallback` can be up to 60 s stale.

**A21 (Low)** Engine not deployed yet: the page says "Your first index check is on its way" indefinitely; each read of a missing table
re-lists every data table (`client.ts` `tableId` refreshes on a missing name); the Indexing switch saved before the engine ships is
silently ignored by the old `Monitor_Row_Admin.js` (explicit columns) and reads back as on.

**A22 (Low)** `getOnce` is now exported (`verify.ts:35`) without the `publicHttpsHost` guard; `publicLookup` is skipped for an IP literal,
so a future caller importing it bypasses the SSRF rule. Keep it module-private and test through `fetchPublicText`.

**A23 (Low, copy)** `shared/src/guides.ts:754` customer text contains `href="..."` (three dots). The edited technical-audits FAQ line in
`marketing/content/features.ts` still lists "mobile usability", a field Google retired (pre-existing words on a changed line).

**A24 (Low)** `recommendations.ts:475` suppresses `ix:site_fix:<cause>` when any `tech:*` title merely contains `sitemap`, `redirect`,
`canonical`, `404`: e.g. "Fix redirect chains" hides "Replace redirecting addresses in your sitemap". Match the finding's id / check, not
words in the title.

**A25 (Low)** `checked` (`indexing.ts:627`) counts `state = error` as checked: "Existing pages checked: N of M" includes failed checks.

**A26 (Low, decision)** Companies whose delivery is "all reports" (empty stage list) start receiving the weekly index report, same-day
drop-out reports and `alert.raised` webhooks / Slack posts without opting in (`report-delivery.ts`, `integrations.ts:184-192`).

**A27 (Low)** Tick budget (`siteTasks.ts:541-565`): indexing steps get nothing in a tick where 60 or more other steps are due; and each
indexing check can hold up to 9 x 4 MB sitemap bodies, re-read for every sitemap cause of the same site each day.

## SCHEDULED_STAGES: which builder is right

The branch **does** add `index_coverage` to both lists (`shared/src/constants.ts:320` and `server/src/services/runs.ts:649`); APP_BUILD
says so too. It must be there, as the engine builder says: the callback carries the site row's `request_id` (the tracking setup run), so
`ingestCallback` finds that old run. Without the stage in the server list, `isScheduledCallback` is false (`on_demand` is not `false` on a
daily run), the report is stored `scheduled: false`, its ledger cost is added to the old run, and `costSync` counts it for that run. With
it: scheduled, 0 credits, the old run's status untouched (`runOutcome` only reacts to that mode's final stages). What was deliberately
left out is `AUTOMATIONS` (Pipeline schedule / missed-fire count); that is reasonable until the workflow is deployed, but the Pipeline then
never lists the daily index check.

## Checked and fine

- Routes: viewer and up via `siteAccess` (org-scoped site lookup), `requireVerified`, per-person rate limits (plugin registered with
  `global: false`, same pattern as other routes); another company 403/404, unverified 403 (tested). History refuses off-host URLs; query
  params of the paged route are regex-limited; no route writes.
- Tenancy: rows read by `n8nSiteId(domain)` and filtered by `domain` (`mine`), so a colliding engine id never shows another domain;
  `googleEvents` is global by design.
- XSS: every engine string is rendered as React text; the only engine `href` (Google's notice) is restricted to `https:`; guide vars
  render as text and the rich-text link token accepts only `http(s)` URLs.
- SSRF of the own check: URLs limited to the site's host (and `www.`), https only, credentials and IP literals refused per hop, DNS
  pinned through `publicLookup`, size and 10 s / 45 s caps, one site at a time. (Redirect hops may go to another public host, as for the
  existing redirect check.)
- `getOnce` / `fetchPublicText` change: without the option the answer shape is byte-for-byte the old one (tested in
  `verifyHeaders.test.ts`); old callers unchanged.
- Existing step kinds: `present`, `doneDetail`, `siteTaskPayload`, `runSiteTaskCheck` are exhaustive switches with identical bodies for
  `indexnow`, `ai_crawlers`, `redirect`; the `own` rule change only adds `index`, which a redirect step never carries; existing
  site-task tests pass.
- Failure isolation: `indexingData` / `indexingForRecs` failures are caught (page "could not read", recommendations unaffected; tested);
  missing tables read as empty.
- Settings: zod 20 to 1,200 integers, optional with no default, sent only when set and last in the body; `monitorsFromRow` reads back only
  stored values; harness fixture added for Site Admin.
- Callback: `status: 'complete'` accepted for this stage only; summary keys match DESIGN §5; label, renderer, icon, list line, delivery
  choice, billing label present; `SITE_TASK_STAGES` refreshes the steps.
- Recommendation ids `ix:<action>:<cause>` are unique and do not collide with `tech:*`; rule scores resolve by prefix.
- Copy: no em dash, curly quote or "…" in the new customer strings; no "get indexed", "guaranteed", "instant"; FAQ says nothing is
  submitted to Google and the site is not changed for the client.
- UI: colours only through tokens (no raw colours, no gradients); h1 from `PageHeader`; buttons labelled; long URLs break (`break-all`);
  builder's 375 / dark screenshots show no overflow (not re-shot here).
