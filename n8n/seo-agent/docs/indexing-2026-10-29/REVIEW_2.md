# Index coverage: second review, after fix wave 1 (2026-10-29)

Scope: branch `feature/indexing` at `cd71b3d7` (worktree `n8n_devaicon-indexing`). This pass checks the High and Medium findings of
REVIEW_ENGINE.md (E1-E13), REVIEW_APP.md (A1-A16) and REVIEW_CROSS.md (X1-X8, X10, X14-X17) against the fixers' claims in ENGINE_BUILD.md
and APP_BUILD.md ("Fix wave 1"), then hunts for defects the wave introduced. It was read only: no source was edited, nothing was deployed
or committed, no paid API was called.

## How it was checked
- **Suites, on copies of the tree**, run before the Docker daemon stopped answering at about 22:39 PKT:
  - Engine harness in `n8nio/n8n:2.41.4`: **13788 passed, 0 failed**.
  - App: typecheck of shared, server and web clean; shared **921** passed; server **1539** passed, 46 skipped; web **269** passed.
- **Engine probes** used the GENERATED code (`harness/code_v4`), run with a host Node 22 (`~/.local/node-v22.11.0-darwin-arm64`). The new
  probes are in `/private/tmp/claude-502/-Users-abdul-muqadim-n8n-devaicon/a0ce06bc-4438-458f-9708-21ff7d5faf28/scratchpad/r2/probes/`:
  - `lib.js` runs a real generated Code node (`Index_Diagnose.js`, `Page_Fetch_Requests.js`) with mocked upstream nodes and a pinned clock.
  - `n1b.js` and `n1c.js` simulate several days of merge, plan, fetch and diagnose for a URL move.
  - `n2_fixseen.js`, `n3_sitefix.js` and `n4_links.js` cover re-inspection over 70 days.
  - `n5_ask.js` checks the weekly limit on "ask Google".
  - `e_all.js` spot-checks E1-E16.
  - The first reviewers' probes `probes/p1-p6.js` were run again.
- **App probes.** The daemon hang stopped the vitest probes, so the app half was traced by hand at file:line (the subagent report folded
  in below). Four of its claims were confirmed directly:
  - N-app-1 and N-app-8: `app/shared/src/indexing.ts` loaded in host Node 24 with type stripping (`scratchpad/r2/tsprobe/p.ts`).
  - N-app-3, N-app-5 and N-app-7: by reading the code.
  - The written vitest probes are ready to run: `scratchpad/r2/appprobe/app/{shared/src,server/test}/zz_probe*.test.ts`.
- **Independence**, `git diff feature/seo-agent-v4.5...HEAD -- n8n/seo-agent/workflows/` compared node by node against the merge base
  `71e9d97c`:
  - The new `SEO_Agent_Index_Coverage.json`.
  - 10 workflows change only their `Ensure Monitors Table` column list (+`index_watch`, `index_daily_cap`).
  - Site Admin changes `Admin Action`, `Monitor Row (Admin)`, `Set Monitors` and its Ensure node.
  - The main v4 workflow changes `Monitor Row (Track)`, `Save Monitors (Track)` and its Ensure node.
  - The Schedule Catch-up changes `Catch-up Targets`, `Catch-up Plan` and `Note` (the schedule table now lists `SEOagentIndexCv1`).
  - Connections and settings are identical in every changed workflow, and nothing else changed. **Independence: OK.**

## 1. Verdict per reviewed finding

| id | sev | verdict | evidence |
|---|---|---|---|
| E1 | High | fixed | `IX.sitemapComplete`. P1 re-run: a page in the failed child keeps `in_sitemap true` and is "indexed", not `indexed_not_in_sitemap`. 6,000-URL sitemap: `complete false`, stored p5500 keeps `in_sitemap true` (e_all.js). IXF1 asserts both. |
| E2 | High | fixed | P5 re-run: a 403 or 503 challenge and a geo redirect leave `crawled_not_indexed / quality`. A 60-day-old crawl plus our 404 gives not_found; a 2-day-old crawl plus our 404 stays crawled_not_indexed. A captcha on a 200 page is not a wall; "Just a moment" on a 200 is blocked. |
| E3 | High | fixed | P4 re-run: 40 old articles are in the `existing` lane, and "discovered, not crawled" maps to `links`, not `wait_new`. |
| E4 | High | **regressed** | Slash, case and www forms now move to the sitemap form (IXF4 passes). The move logic added a new defect: a moved row with no prior reading is never inspected again, and a sitemap that lists the redirecting form deletes the row (N1). |
| E5 | High | fixed | `siteHost` falls back to `home_host`; `inProperty`; "not part of this property" is classed as `access` (IXF5). |
| E6 | High | fixed (shape); see N5 | One execution per website plus a reservation row before the first inspection. `used_today` sums today's rows, including reservations. Replays stay inside the cap (IXF6). A broken chain is not resumed the same day (N5). |
| E7 | Med | fixed | Reused "Alternate" gives `alternate`, or `canonical_elsewhere` when the page is in the sitemap. Reused "Google chose different" gives `google_chose_other` (e_all.js). |
| E8 | Med | fixed | Page dimension, 4 windows, `startRow` paging. A truncated window keeps the stored 12 impressions (e_all.js; IXF8). |
| E9 | Med | fixed | `redirect_error` gives `site_fix / not_indexed` with its own sentence. |
| E10 | Med | **partly** | Children are no longer queued after 5,000 URLs. But round 1 queues up to 49 children of an index before any URL is read, and round 2 fetches all of them at once. P6 re-run: "round 2: children fetched 49 … ≈ 33 MB" (about 500 MB with real 50k-URL children), held in `Fetch Sitemaps 2` output and saved (`saveDataSuccessExecution: all`). Later nodes are slim (`Page Signals`, `slimPrev`). |
| E11 | Med | fixed (one residual risk, N11) | P3 re-run: `\`, userinfo and an odd port all give `own() false`, and nothing is queued. `parseUrl` refuses `[`, decimal / octal / hex IPs, `localhost` and `.internal`. No HTTP node follows redirects; every hop is `IX.safe` on the site's own domain. |
| E12 | Med | fixed | Merge order: ours, sitemap, search, inventory, then stored-only rows. Run note "more than 6,000" (IXF10). |
| E13 | Low | fixed | A 429 per minute is `rate` and retried after 61 s; "per day" is `quota`; a second rate answer counts as the quota (e_all.js; IXF10). |
| A1 | High | partly | `readSitemap` is complete only from a full XML read (`siteTasks.ts:332-381`). One hole is left (N-app-3): an unreadable robots.txt still counts as complete. |
| A2 | High | fixed | `indexingPageFixed` follows decision 3. Walls, challenges and redirects off the site are `unknown`; a click answers 409 `site_unsure`. Tests `indexing.fixwave.test.ts:31-50`. |
| A3 | High | fixed | Display actions `retry` / `review`; `none` is only ever pages in search (shared + web tests). |
| A4 | High | fixed on the page; **not in the report** (N-app-6) | `failed` / `accessLost` / `checkedAt` = the newest run that read the site; the notice callout. |
| A5 | High | **regressed** | The app needs `fix_seen_at > inspect_at`, but the engine keeps the first `fix_seen_at` while it re-inspects daily. From day 1 (or day 0 when inspected in the same run) the page loses its "fixed" state and the step reads "done" with a false sentence (N4 = N-app-1, probed). |
| A6 | High | partly | One read per cause, sorted, 200 max (test at `:377`). A cause whose first 200 rows are all left out loses its cap flag and closes its step (N-app-2). |
| A7 | High | fixed | `site-tasks.ts:203`; test `fixwave:134`. |
| A8 | Med | fixed | A sentence per cause. The engine-done sentence is said falsely only through N4 and N-app-2. |
| A9 | Med | fixed | `indexInSearchLine` is shared by page and report (contract test `:73`). Small gap: the page counts errors as "not checked", the report does not. |
| A10 | Med | fixed | Uses the configured cap. |
| A11 | Med | fixed | Freeze comes from the newest run flag only (`indexing.ts:772`, `server/.../indexing.ts:163-167`). |
| A12 | Med | fixed | `segmentOf`. |
| A13 | Med | fixed | `unclassified` with action `review` and its guide. |
| A14 / X5 | Med | fixed (flaps, N-app-4) | `indexing:sitemap` step, ticked off by the engine only; a click answers 409 `engine_reads_it`. |
| A15 | Med | fixed | `indexingReading` and `indexingForRecs` race all their work against an 8 s timer that is cleared in `finally`; nothing is awaited outside the race. At most 12 n8n calls for steps and 4 for recommendations. The n8n fetches themselves are not aborted. |
| A16 | Med | fixed | `robotsFileState`: 401, 403, 429 or HTML is "could not read". Side effect (Low): a real robots.txt served as `text/html` can never be ticked off by our check. |
| A17 | Med | not fixed (process) | No tutorial yet (RESUME next step 3). |
| X1 | High | fixed (shape); see N5 | As E6. Harness asserts that one site at cap 1,200 fits inside 3,600 s. |
| X2 | Med | partly | As E10: page and sitemap bodies are still saved in the HTTP nodes' execution data. |
| X3 | Med | fixed | As E8. |
| X4 | Med | fixed | A drop-out needs a reading and an action other than `leave_out` / `wait`, and not a move (`IX_Diagnose.js:96`; IXF11). |
| X6 | Low | fixed | As A13. |
| X7 | Med | **regressed** | `fix_seen_at` is set and cleared, but: once it is 7 days old the page is never inspected again (N2); it never expires when Google re-crawls and still sees the cause (N3); the app misreads it (N4). |
| X8 | Med | partly | `ask_google` works on the day it is set. The "at most 5 a week" limit does not hold: 15 different pages were marked in one week (N6). |
| X10 | Low | partly | `INDEX_COVERAGE_SCHEDULE` in `SCHEDULES`, counted from the first run row. Missed fires are over-counted with the per-site execution shape (N-app-5). |
| X14 | Low | partly | Marketing fixed. Four app strings still say "every day" or "we ask Google" (N-app-9). |
| X15 | Low | fixed | Slim read plus `indexedCounts` from the newest good run; reservations and failed runs are skipped. |
| X16 | Low | fixed | The engine prunes history and runs older than 400 days and gone rows. The app deletes a site's rows on site delete (`routes/sites.ts:175-188`), with errors caught. |
| X17 | Med | partly | Real engine rows feed the app (`indexing.contract.test.ts`). The fixture has no `fix_seen_at`, `ask_google`, reservation or `redirect_error` row, which is how N4 slipped through. |

Counts over the 42 ids asked for (E1-E13, A1-A16, X1-X8, X10, X14-X17; X5 shares A14's row, X6 shares A13's):
- **fixed: 30**:
  - E1 E2 E3 E5 E6 E7 E8 E9 E11 E12 E13
  - A2 A3 A7 A8 A9 A10 A11 A12 A13 A14 A15 A16
  - X1 X3 X4 X5 X6 X15 X16
- **partly: 9**: E10 A1 A4 A6 X2 X8 X10 X14 X17.
- **regressed: 3**: E4 (N1), A5 (N4) and X7 (N2 / N3). The defect each one named is gone, but its fix brought in a new High.
- **not fixed: 0**. A17 (tutorials, process; not in the list asked for) is still open.

## 2. New findings

### Engine

**N1 (High). A URL move with no stored row leaves the page "not checked yet" for ever, and a sitemap that lists the redirecting form deletes the row.**
- **Where.** `IX_Diagnose.js:63-70`: on a move with no stored row, the state is set to `unknown`, but `inspect_at`, `verdict` and `coverage`
  from the old address's reading are kept.
- **Why it sticks.** `_index_kit.js:719`: bucket 3 needs `state unknown && !inspect_at`, so the moved row is never planned again.
- **Why it ping-pongs.** `_index_kit.js:646`: `merge` moves every row back to the sitemap's form. Meanwhile `IX_Diagnose.js:63-64` moves it
  to the redirect target (`gMove` from Google's "Page with redirect", or `moved_to` from our fetch). `IX_Diagnose.js:118` then lists BOTH
  addresses for deletion, after `Save Index Pages` has written one of them.
- **Scenario.** The sitemap lists `/a/` and the server 301s `/a/` to `/a` (a common sitemap/server slash mismatch).
- **Verified** (`n1b.js`, `n1c.js`, real generated nodes, page fetches chosen by the real `Page Fetch Requests`).
  - No prior row:
    ```
    day 0 diag moves /a/->/a, stored ["/a","unknown"] ; day 1 merge moves /a->/a/, stored ["/a/","unknown"] ; days 2-5: inspected [] fetched [] (stuck)
    ```
  - An indexed row:
    ```
    day 1 deletes ["/a","/a/"] -> stored [] (row gone) ; day 2 re-created "unknown" ; day 3+ never inspected
    ```
- **Effect.** The client reads "We have not checked this page with Google yet. It is in the queue." for ever. The real advice ("your
  sitemap lists an address that redirects") is never given, `backlog_left` never reaches 0, and history is re-pointed back and forth.
- **Missed by.** IXF4 tests only a stored-row move whose target is also the sitemap form.
- **Fix.** On a move, clear `inspect_at` / `verdict` / `coverage` (or plan bucket 3 on `next_check_at`). Never move away from the sitemap's
  form; report it as the `redirect` site step instead. Never delete the address that was just upserted.

**N2 (High). Every page our fetch reads but Google does not has its next inspection pushed forward on every read. Site-fix pages are never inspected again.**
- **Where.** `IX_Diagnose.js:99` recomputes `next_check_at = IX.nextCheck(row)` (now + 7 / 14 / 28 days) whenever `d` is set. `d` is set
  by a fetch-only diagnosis (`:74-76`, `storedReading` as the basis).
- **Why it never comes due.** Since X7, `IX_Page_Fetch_Requests.js:27` reads site-fix and `fix_seen_at` pages every day (`age > 20 h`),
  and other not-indexed pages every 7 days.
- **Verified.**
  - `n3_sitefix.js`: a `noindex` site-fix page still blocked got **0 inspections in 70 days**. `next_check_at` slid from 2026-11-09 to
    2027-01-17, one day per day, and `checks` stayed 1.
  - `n2_fixseen.js`: a page with `fix_seen_at` is inspected daily for 7 days, then never again (`inspect_at` frozen at 11-09 from day 7 to
    day 69).
  - `n4_links.js`: a `links` page at `checks 2` was inspected once more, then slid by 7 days at every weekly fetch.
- **Effect.**
  - Google's reading of exactly the pages that need the client is frozen.
  - `needs_person` (4 unchanged re-checks, the owner's guardrail) can never trip.
  - A page Google re-indexes after a fix stays "waiting for Google" unless impressions appear.
  - The weekly fetch half existed before the wave; the daily site-fix read is what turns it total.
- **Fix.** Recompute `next_check_at` only when there is a fresh reading (inspection or reuse) or the cause changed. A fetch-only diagnosis
  keeps the stored `next_check_at`.

**N3 (Medium). `fix_seen_at` never expires when Google re-crawls after the fix and still reports the cause.**
- **Where.** `IX_Diagnose.js:88-93`: the first `fix_seen_at` is kept while the cause is the same. There is no comparison with Google's
  `last_crawl`.
- **Verified.** `n2_fixseen.js`: Google re-crawled one day before each inspection and still read the noindex. For 70 days the row stayed
  `action wait`, "Fixed on your site. Waiting for Google to read it again.", `ask_google true`, `needs_person false`.
- **When it happens.** A noindex served only to Googlebot, a CDN variant, or a header our reader is not sent all look fixed to us forever.
- **Fix.** When a fresh inspection's `last_crawl` is newer than `fix_seen_at` and the cause is unchanged, clear `fix_seen_at`. Return the
  row to `site_fix` with "Google read the page after your change and still sees …", and count it toward `needs_person`.

**N4 (High, cross). The engine and the app disagree on `fix_seen_at` (= N-app-1).**
- **Where.**
  - The engine keeps `fix_seen_at` = the first day the fix was seen and re-inspects within a day (`_index_kit.js:739`), so `inspect_at`
    passes it on day 1.
  - On day 0, when the page is inspected in the same run, `inspect_at === fix_seen_at` (both `nowIso`).
  - The app's `fixSeen` (`app/shared/src/indexing.ts:569`) requires `fix > inspected`.
- **Verified** (`tsprobe/p.ts`, real `indexPageOf`):
  ```
  day0 (same run) fix:"" action wait ; day1 fix kept ; day2 (re-inspected, Google lag) fix:"" action wait ; indexingCauseReadings day2 -> []
  ```
- **Effect.** The page shows "Remove the noindex …" under "Give it time". The stored step becomes done with "Google's newest reading
  lists none of these pages with this problem any more", which is false.
- **Fix.** The app treats `action wait && fix_seen_at` as pending whatever `inspect_at` says (the engine clears it). Add fixture rows with
  `inspect_at >= fix_seen_at`.

**N5 (Medium). A broken chain loses the rest of the day, and nothing says so.**
- **Where.** `Start Next Index Part` runs only after `Save Index Runs` (connections). Code nodes have no `onError`. The three Execute
  Workflow nodes are `continueRegularOutput`. The dispatch takes a run-guard slot with the mode-only twin rule
  (`_run_guard.js` `sameSite`, the dispatch has no domain), and `Retry Index Part` retries chain parts only.
- **What breaks the chain.**
  - A time-out, a crash, an n8n restart (a deploy, or **preemption of the spot VM**), or a throw in an unguarded node: every later
    website is skipped until tomorrow.
  - The dispatch itself was the trigger execution and succeeded, so `_catchup.js:165` counts the fire as `fired` and replays nothing.
  - If `Start Next Index Part` fails (for example the workflow is not published), the failure is swallowed and the execution reports
    success.
  - A 05:15 dispatch refused by the run guard (another index run of any site in flight, or 3 analyses open) is not retried, and the day
    is lost silently.
- **Code comment.** `IX_Dispatch_Start.js` says "a time-out or crash loses one website, never the day", which is not what the code does.
- **Fix.**
  - Retry a refused dispatch like a chain part.
  - Let the hourly catch-up (or the next dispatch) restart today's chain for websites with no run row today.
  - Raise an ops alert when a start fails.

**N6 (Low). "Ask Google" is limited to 5 at a time, not 5 a week.**
- **Where.** `_index_kit.js:769-770`: when no page carries the mark, a new five is picked on any day.
- **Verified.** `n5_ask.js`: Mon 5, Wed 5, Fri 5; **15 different pages in one week** when the marked pages get indexed the next day.
- **Fix.** Store the week's picks, for example the `ask_google` mark date, and count against it.

**N7 (Medium; = E10 / X2 partly). An index of large children is still fetched whole in round 2.**
- **Where.** `IX_Sitemap_Requests.js` (round > 1) emits every queued child once the previous round's URL count is under the cap.
- **Effect.** Up to 49 children of 50k URLs (about 10 MB each) land in `Fetch Sitemaps 2`'s output and the saved execution, on a 4 GB VM.
- **Fix.** Queue children of an index only up to the remaining URL budget, assuming about 50,000 URLs each, or fetch children in a capped
  loop.

**N9 (Low). A chain part does not skip a website already checked today.**
- **Where.** `IX_Plan.js` (chain path): only the dispatch filters out sites with a run row today.
- **Effect.** A second dispatch (an editor run with no domain) while a chain is in flight reads every remaining site twice: sitemaps,
  Search Analytics and page reads again, with inspections still bounded by the cap.
- **Fix.** Skip a chain part's site when it has a non-reservation run row today.

**N10 (Low). Duplicate stored rows are not pruned, despite the claim.**
- **Where.** `merge` keeps the first stored row of a key (`_index_kit.js` `storedBy`). Nothing pushes the second to `prune`
  (ENGINE_BUILD X16 says "duplicate rows of one address are pruned").
- **Effect.** After a failed `Delete Index Pages` (`onError continue`), the older row's fields are upserted over the newer one the next day.
- **Fix.** Prune extra rows of a key, keeping the newest `updated_at`.

**N11 (Low, residual SSRF).** The engine never resolves or pins DNS. The client's own verified domain (or `www.`) can point to an internal
address and be fetched on 80 / 443 from the VM (titles and canonicals are stored). The app's fetcher pins DNS through `publicLookup`; the
engine cannot. Mitigation: accept as-is (the owner must verify the domain) or route page reads through the app's fetcher.

**N12 (Medium, engine half of N-app-6).** `IX_Report.js` sends the Monday callback for a run that could not read the site (`d.failed`).
`summary` has no `failed` or note, so the app's report hero shows last check's figures as current and is delivered by mail, Slack and
webhook. Fix: add `failed` and the note to `summary`, and show the warning in the renderer.

**N13 (Low, pre-existing kit).** `PW.signals` reads any `X-Robots-Tag` containing `noindex` as a noindex, including `bingbot: noindex`.
When Google's reading is old and vague, our fetch can then add a wrong "remove the noindex" step, and the fix is never seen. Fix: honour
the user-agent prefix (googlebot or none).

### App (traced by the app sub-review; see "How it was checked")

| id | sev | where | scenario | fix |
|---|---|---|---|---|
| N-app-1 | High | `shared/src/indexing.ts:569,584`, `:938-940`, `site-tasks.ts:225-229` | = N4 (probed). | Pending while `action wait && fix_seen_at`. |
| N-app-2 | High | `server/src/services/siteTasks.ts:139-142`; `shared/src/indexing.ts:935-956` | The per-cause read takes 200 rows by impressions. A `redirect` / `not_found` cause with more than 200 left-out rows above its 3 site-fix rows yields no reading, so the step is `storedDone`, Done, with the false "lists none of these pages" (traced in `zz_probe2` "N-capped-leave-out"). | Filter the read to `site_fix` or `wait` with `fix_seen_at`, and emit an incomplete empty reading for a capped cause. |
| N-app-3 | Med | `siteTasks.ts:327-331` | robots.txt answers 403, HTML or nothing, so `listed = []` and `complete` stays true. `/sitemap.xml` alone is trusted as the whole tree, and "/x is no longer in your sitemap" closes `canonical_elsewhere` steps (confirmed by reading). | `complete = false` unless robots.txt was read as rules or 404 / 410. |
| N-app-4 | Med | `shared/src/site-tasks.ts:211-222` | When the index reading is null (8 s deadline, n8n error, 5 days without a good run), `indexing:sitemap` and engine-done steps fall back to To do. Recommendations re-add `ix:site_fix:sitemap`. | Persist an engine-done result as `lastCheck`, or keep the stored state when the reading is null. |
| N-app-5 | Low (Med at about 10 sites) | `server/src/services/delivery.ts:345` | 150 newest successful executions of `SEOagentIndexCv1`. With 1 dispatch plus N parts plus retries a day they cover about 150/(N+1) days, so older 05:15 fires show as "missed" on the admin report (confirmed by reading). | Page the list, or measure from `seo_index_runs`. |
| N-app-6 | Med | `web/src/components/reports/indexing.tsx` (+ N12) | A failed run's weekly report shows stale figures with no warning. | Show the warning from `summary.failed` and the note. |
| N-app-7 | Med | `siteTasks.ts:400,428-444` | The own check opens 10 URLs and answers `ok: true` ("We opened the first 10 of 30"), so the step is Done for 20 unchecked pages. It can flap when Google re-reads them (confirmed by reading). | Done only when every listed page was checked; otherwise "10 of 30 fixed", kept to do. |
| N-app-8 | Med | `shared/src/indexing.ts:975-988` `headerNoindex` | `max-snippet:-1, noindex`, `max-image-preview:large, noindex` and `unavailable_after: …, noindex` all give **false** (probed), so a noindex step can be marked fixed while the header still blocks. The engine reads them correctly. | Treat a prefix as a crawler name only when it is not a known directive. |
| N-app-9 | Low (copy) | `MonitorSettingsFields.tsx:277` "Every day we ask Google which of your pages…"; `IndexingPage.tsx:136` "the daily check covers every page"; `indexing.ts:282` and changelog "we ask Google about it again within a day or two"; `SiteTasks.tsx` "We check each one ourselves, every day" (not true of the sitemap step) | These break decision 12 and read like requests to Google. No em dash, curly quote, "…", "get indexed", "guarantee", "instant" or "we submit" in any added customer string, engine or app. | Reword. |
| N-app-10 | Low | `siteTasks.ts:355-360` | A `/sitemap.xml` guess answering an HTML app shell with 200 makes every read partial (false negatives only). | Ignore a non-XML answer to the guess. |
| N-app-11 | Low | `readSitemap` via `fetchPublicText` | Sitemap and robots fetches follow redirects to any public host, and the answer is trusted as this site's. | Check `finalUrl` with `onSite`. |
| N-app-12 | Low | `indexing.ts:991-1003` | A relative (`a`) or protocol-relative canonical never matches, so the step is never done by our own check (false negative). | Resolve against the page URL. |

Checked and fine in this pass:
- Reservation rows never count as the latest reading anywhere in the app: page, steps, freeze, sitemap step or recommendations.
- Site deletion deletes index rows by `domain` / engine `site_id`, and an engine-id collision is refused at verification.
- App SSRF:
  - WHATWG parse plus `isIP` refuses decimal, octal, hex and `[::1]`.
  - Userinfo is refused; IDN hosts are punycoded.
  - DNS is pinned per hop, and sitemap children on other hosts are not read.
- Per-item Data Table delete and update with `$json` filters have live precedents in this repo (`Delete Old Cycle Jobs`, many updates).
- `run_at` is a string column, so the reservation is replaced by the upsert on `site_id + run_at`.
- The rate-limit Wait (61 s) stays under n8n's 65 s offload threshold.
- The part-retry Wait (5 min) has a `webhookId`, and each retry is a new execution.

## 3. Ready to deploy?

**Not yet.** The wave fixed most of what it set out to fix (30 of 42 fully, the suites green), but it introduced three defects that give
wrong advice and freeze the engine's reading of exactly the pages that need the client:
1. **N2:** site-fix and `fix_seen_at` pages are never re-inspected.
2. **N1:** URL moves leave pages stuck as "not checked yet", or deleted.
3. **N4 / N-app-1:** "fixed on your site" flips to a false "done".

**N-app-2** (a step closed from a capped read) belongs with them. All four are small, local fixes, each needing a multi-day harness case.
N5 (chain lost on a spot-VM restart), N12 / N-app-6, N-app-3, N-app-7 and N-app-8 should go in the same short wave. The rest are Low, plus
A17 (tutorials). Deploy after that wave and a re-run of these probes.
