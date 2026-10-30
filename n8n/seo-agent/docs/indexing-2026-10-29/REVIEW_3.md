# Index coverage: third review, after fix wave 2 (2026-10-30)

Scope: branch `feature/indexing` at `64caa7a4` (worktree `n8n_devaicon-indexing`). Wave 2 = `3b0a8cab..HEAD` (engine `267fae9b..7c34ecce`,
app `1c2e998b..e4fa46fa`). This pass checks every id of REVIEW_2.md (N1-N13, N-app-1..12, the "partly" and "regressed" rows) against the
claims in ENGINE_BUILD.md / APP_BUILD.md "Fix wave 2", then hunts defects wave 2 brought in. Read only on the source: probes and suites ran
on copies; nothing deployed, committed or pushed (except this file, written, not committed); no paid API.

## How it was checked
- **Suites in Docker, on copies** (scratchpad `r3/`):
  - Engine harness in `n8nio/n8n:2.41.4`: **13844 passed, 0 failed** (exit 0). Matches the claim.
  - App (`node:22-bookworm-slim`, `TZ=UTC`): typecheck shared / server / web clean; shared **938**; server **1549 passed, 46 skipped**;
    web **274**. Matches the claim.
- **Engine probes** run the GENERATED Code nodes (`harness/code_v4`) with mocked upstream nodes and a pinned clock (host Node 22). Folder
  `/private/tmp/claude-502/-Users-abdul-muqadim-n8n-devaicon/a0ce06bc-4438-458f-9708-21ff7d5faf28/scratchpad/r3/probes/`:
  - REVIEW_2's probes re-run unchanged: `n1b.js`, `n1c.js` (N1), `n3_sitefix.js`, `n2_fixseen.js`, `n4_links.js` (N2/N3, 70 days),
    `e_all.js` (E1-E16 spot checks, all still hold).
  - New: `n5_ask2.js` (N6 over 30 days, `ask_google_at` carried as the engine carries it), `fix_real.js` (a real fix over 70 days, three
    variants), `n13.js` (engine X-Robots-Tag / meta readers), `sm_many.js` + `sm_dbg.js` (sitemap trees through `Sitemap Requests n` /
    `Sitemap Read n`, new code vs the `3b0a8cab` code in `r3/old/`), `waitnew.js` (R4, new vs old), `watch_loop.js` (R2, `Index Plan` +
    `Index Watch Plan`). `lib3.js` is the harness's own node runner (binary input + `this.helpers`).
- **App probe**: `r3/appc/app/shared/src/zz_probe3.test.ts` (vitest in Docker): N-app-1, N3 through the steps, N-app-8 headers, N-app-12
  canonicals, the failed-report helpers.
- **n8n 2.41.4 source read in the image** (not inferred): HTTP Request V3 file answer with full response = json `{headers, statusCode,
  statusMessage}` + binary `data`; the task runner's `makeRpcCall` turns a serialized Buffer back into a Buffer (`isSerializedBuffer` /
  `toBuffer`), `this.helpers` is the runner's RPC object, input items reach the runner with their binary metadata; the Data Table `upsert`
  operation answers with the rows it wrote.
- **Independence** (`git diff feature/seo-agent-v4.5...HEAD -- n8n/seo-agent/workflows/`, node by node against the merge base `71e9d97c`):
  the new Index Coverage workflow; 10 workflows change only their `Ensure Monitors Table` node; Site Admin (`Admin Action`, `Monitor Row
  (Admin)`, `Set Monitors`, its Ensure node); v4 (`Monitor Row (Track)`, `Save Monitors (Track)`, its Ensure node); the catch-up (`Catch-up
  Targets`, `Catch-up Plan`, `Note`). Connections and settings identical in all 13. Wave 2 itself changed only
  `SEO_Agent_Index_Coverage.json`. **Independence: OK.** But see "Ready to deploy": `feature/seo-agent-v4.5` moved 26 commits since the
  merge base and overlaps this branch in `SEO_Agent_v4.json`, `SEO_Agent_Link_Builder.json`, `build_v4.py`, harness and app files.

## 1. Verdict per id

| id | sev (R2) | verdict | evidence |
|---|---|---|---|
| N1 | High | fixed | `n1b.js`: day 0 the row moves /a/ -> /a and is `unknown` with no reading; day 1 it is inspected and indexed; no merge flip back, nothing deleted. `n1c.js` (indexed row): one net move, one delete of /a/, stable after. Deletes wait for the upsert's answer (`IX_Delete_Rows.js`). Note: by FIX_CONTRACT decision 4 the row lives at the final URL, so "your sitemap lists an address that redirects" is never said for a slash / case / www form. |
| N2 | High | fixed | `n3_sitefix.js`: a still-blocked noindex page is inspected on days 4, ~18, ~46 (7/14/28), `checks` grows 1->4, `next_check_at` no longer slides on fetch-only days. `n4_links.js`: same for `links`, `needs_person` trips on day 69. |
| N3 | Med | **partly** | Engine fixed: `n2_fixseen.js` day 2 Google crawled after the fix and still reads noindex -> `fix_seen_at` cleared, `fix_failed_at` set, `site_fix`, the note says so; no new `fix_seen_at` while it stands; `needs_person` by day 69. App: the step is closed again by the app's own daily check every day (R1). |
| N4 / N-app-1 | High | fixed | `zz_probe3` "N-app-1 rerun": day 0 / 1 / 2 (inspect equal, older, newer than `fix_seen_at`) all `wait`, step done "Fixed on your site". Engine: `fix_real.js` keeps `wait` daily until Google's reading changes. |
| N5 | Med | **partly** | The watch works: wired on `Settle Run Ledger (Index)` only (a refused run never settles, so a refusal spawns one retry, never a retry plus a watch); one counter per root, <= 30, ends with the UTC day or when nothing is left; a refused 05:15 dispatch is retried in 30 min. Left: a site that fails before its reservation is re-run by every watch (R2); a failed self-start is still silent (R7). |
| N6 / X8 | Low/Med | fixed | `n5_ask2.js` (30 days, marked pages indexed the next day): new marks only on days 0, 7, 14...; max 5 new in any 7-day window; wave-1 rows with no date get today's date. |
| N7 / E10 / X2 | Med | fixed, with a regression (R3) | IXW7 + `sm_many.js`: an index of 49 large children reads at most 2; flat indexes up to the 49-child queue cap are still read whole. Bodies are files: verified against the HTTP V3 source. New: 3-level trees (index of indexes) with 43-48 leaves are now never complete (R3). The full file still crosses the runner RPC (R6, suspected). |
| N9 | Low | fixed | IXW9 + code: `IX_Plan.js:41` `doneToday` in the chain path. |
| N10 | Low | fixed | IXW10 + code: newest row stands; an older row on another form is pruned; a pruned url that is a row of this run is filtered out (`IX_Diagnose.js` `live`). |
| N11 | Low | not changed (accepted, documented) | ENGINE_BUILD N11. Residual risk stands; egress rule on the VM is the real fix. |
| N12 | Med | fixed | IXW12 + code `IX_Report.js:33`: `failed`, `checked`, `note`, `figures_from`; a failed Monday run does send (`monday` is added to every Diagnose item, `IX_Diagnose.js:159`). Copy: R5. |
| N13 | Low | fixed | `n13.js`: `bingbot: noindex` false, `max-snippet:-1, noindex` true, `googlebot: max-snippet: 20, noindex` true, header arrays per line, `googlebot-news` false; meta robots / googlebot in any attribute order. Same answers as the app's `headerNoindex`. |
| N-app-2 / A6 | High | fixed | `siteTasks.ts:148-164`: reads `site_fix` + `wait` per cause; a capped read gives an incomplete reading (`indexingCauseReadings(..., { read })`). Every site-fix cause maps to action `site_fix` in the engine (`_index_kit.js:431`), so the action filter loses no row. Cost: up to 2 reads per counted cause, 22 + 1 in the worst case (an older run row with no cause counts); not timed, the 8 s deadline + N-app-4 cover a slow read. |
| N-app-3 / A1 | Med/High | fixed | `readSitemap`: complete only when robots.txt is `rules` or `none`; server test passes. |
| N-app-4 | Med | fixed | `materialize` keeps the engine reading on the row only when newer (`engineIndexReading`); server tests pass. |
| N-app-5 / X10 | Low | fixed | `executionsSince` pages by cursor (250 x 40 max) from the oldest week shown. The dispatch now ends ~50 min after 05:15 (the watch wait); the 90 min grace covers it. |
| N-app-6 / A4 | Med/High | fixed | Report title / callout / "(last check)" labels / summary line; page eyebrow. A reservation's notice is `failed: false`, so a run in progress is not shown as "could not check". Copy: R5. |
| N-app-7 | Med | fixed | `partialOutcome`: 10 of 30 opened and fixed answers 409 `site_partial`, nothing recorded (also in the daily check: `!out.reached`). |
| N-app-8 | Med | fixed | `zz_probe3`: the three valued-directive cases now true; `otherbot: noindex` false; `googlebot: nofollow, bingbot: noindex` false. |
| N-app-9 / X14 | Low | fixed | Scan of every added line (engine + app) and of the whole app tree: no "we ask Google", "asks Google about", "we submit", "every page every day", em / en dash, curly quote or "…" in customer strings; tests guard it. |
| N-app-10 | Low | fixed | Guessed /sitemap.xml answering an HTML 200 is skipped; server test. |
| N-app-11 | Low | fixed | robots.txt and every sitemap must end on the site's host (`finalUrl`); server test. |
| N-app-12 | Low | fixed | `zz_probe3`: `a`, `//host/z`, `../a?b=1&amp;c=2` resolve correctly. Edge: R9. |
| E4 | High (regressed in R2) | fixed | = N1. |
| A5 | High (regressed in R2) | fixed | = N4 / N-app-1. |
| X7 | Med (regressed in R2) | **partly** | Engine = N2 + N3 fixed (`fix_real.js`: fix seen day 3, inspected daily days 4-10, then weekly; indexed on Google's crawl; cleared). App: R1. |
| X17 | Med | **partly** | The engine writes `index_coverage_contract_rows.json` (IXW14) and `contract_rows_wave2.json`, but no app test reads it: the app's X17 rows are hand-written (`indexing.fixwave2.test.ts:137-144`) and include no `fix_failed_at` row, which is how R1 slipped through. |
| A17 | Med (process) | not fixed | No Indexing tutorial in `~/Downloads/hiresuite-video-skills/alaventra/alaventra-video/`; RESUME next step 3. |

**Counts over 37 ids** (N1-N7, N9-N13 = 12; N-app-1..12 = 12; E10 A1 A4 A6 X2 X8 X10 X14 X17 = 9; E4 A5 X7 = 3; A17):
- **fixed: 31** (N1 N2 N4 N6 N7 N9 N10 N12 N13; N-app-1..12; E10 A1 A4 A6 X2 X8 X10 X14 E4 A5).
- **partly: 4** (N3, N5, X7, X17).
- **not changed, accepted: 1** (N11). **not fixed: 1** (A17, process). **regressed: 0** (but R3 and R4 are new regressions of wave 2).

## 2. New findings

**R1 (Medium, cross; = N3 / X7 not reaching the client). Google "still sees it after your change" never reaches the step: the app's own daily check closes it again every day.**
- **Where.** Engine: `IX.fixState` sets `fix_failed_at` and puts the row back to `site_fix` (`IX_Diagnose.js` fix block). App: `fix_failed_at` is
  not in `IndexPageRow` (`app/shared/src/tables.ts` has `fix_seen_at` at :364, nothing after); the step's state is the newest of the engine
  reading (`at` = Google's inspection time) and the stored own check (`site-tasks.ts:421`); the daily check (`siteTasks.ts:638-652`) reads
  every stored step with our User-Agent and records `ok: true` because our fetch does not get the noindex.
- **Scenario.** A noindex (or a block) served only to Googlebot (a plugin, a CDN rule). The engine's N3 path works exactly for this case,
  then the app's daily check, run after Google's inspection, says "These pages open without a noindex instruction" and the step is Done
  for good (it reopens for a few hours after each weekly / monthly inspection, then closes again). Recommendations follow the step. The
  Indexing page meanwhile shows the page under "Steps on your website" with the engine's note: the two screens contradict each other.
- **Evidence.** `zz_probe3` "N3 fix_failed_at vs the app daily own check": engine row `action site_fix, fix_failed_at 2026-11-04,
  inspect_at 2026-11-05T10:15`; own check none -> `todo`; own check 2026-11-05T14:00 -> `done | daily | These pages open without a noindex
  instruction...`; 2026-11-06 -> `done`.
- **Fix.** Add `fix_failed_at` to the app's row type; a cause whose open rows carry `fix_failed_at` is never closed by our own fetch (the
  own check may only say "your website looks fixed to us; Google still sees it"), and the step detail quotes the engine's note. Add an
  engine-produced `fix_failed_at` row to the app's contract fixture (X17).

**R2 (Medium). A website that fails before its reservation is started again by every watch, up to 30 times a day, every day.**
- **Where.** `IX_Plan.js:41` `doneToday` counts finished rows and reservations only; the reservation is written after the sitemap rounds and
  Search Analytics (`build_index_coverage.py:164-165`, `Index Reservation` after `Index Inventory`). A run that dies earlier leaves no row,
  so the site is "fresh" again; `IX_Plan.js:59-60` rotates the fresh list, and when it is the only one left every watch starts it first.
- **Scenario.** A Code node failure in the sitemap rounds (no `onError` on Code nodes; e.g. a runner task killed on a very large sitemap,
  see R6, or the 3,600 s limit on a slow site). Each attempt is a failed execution (the error workflow alerts), holds the index run-guard slot
  while it runs, and repeats sitemap and Search Analytics reads, every 50-80 minutes until the 30th watch, then again tomorrow.
- **Evidence.** `watch_loop.js` (generated `Index Plan` + `Index Watch Plan`, b.com and c.com done, a.com with no row today): `watch n=1 ->
  dispatch ["a.com"]`, n=2, n=10, n=29 the same, `n=30 -> "the day was watched 30 times"`.
- **Fix.** Write an attempt marker (or the reservation itself, with the cap planned later) at the start of a chain part, and count it in
  `doneToday` like a reservation (two attempts = left for tomorrow).

**R3 (Medium, regression of N7). A three-level sitemap tree with 43-48 leaf sitemaps was read whole in wave 1 and is now partial every day.**
- **Where.** `_index_kit.js:203-205` `sitemapBatch`: the batch is `sitemap_batch_first` (2) while no `urlset` was read. A root index whose
  children are indexes costs two rounds at batch 2 (round 2 reads 2 sub-indexes, round 3 still `sets 0`, reads 2 leaves), so 7 rounds read
  at most 2 + 2 + 4 x 10 = 42 leaves.
- **Evidence.** `sm_many.js`, same inputs through both builds (root index -> 2 sub-indexes -> N leaves of 20 URLs):
  ```
  NEW 46 leaves: by [0,2,2,10,10,10,10] urls 840 left 4 complete false | 44: left 2 complete false | 42: complete true
  OLD 46 leaves: by [0,2,46] urls 920 complete true                    | 44: complete true          | 42: complete true
  ```
  Flat indexes are unaffected (48 and 49 children still complete); trees above the 50-sitemap queue cap were partial before too.
- **Effect.** `in_sitemap` never turns false and "missing from the sitemap" / `indexed_not_in_sitemap` is never said for such a site,
  silently and permanently (multi-language and large CMS sites use index-of-indexes).
- **Fix.** Size the batch from what is known: an index answer is small, so count indexes read (or use the queue length when it fits under
  `sitemap_batch_max` and the address cap is far), or allow more rounds while only indexes were read.

**R4 (Low, regression). A fixed page whose next Google reading is "new, not crawled yet" is filed as `site_fix` for a day.**
- **Where.** `IX_Diagnose.js:102` `else if (row.action === 'wait') row.action = 'site_fix'`: wave 1 had `&& !d`. A row that carried
  `fix_seen_at` enters the site-fix block even when Google's new reading changed the cause to `wait_new` (action `wait`).
- **Evidence.** `waitnew.js` (a new page blocked by robots.txt, fixed, Google now "Discovered - currently not indexed"): NEW day 0
  `["not_indexed","wait_new","site_fix",...]`, day 1 `wait`; OLD day 0 `wait`.
- **Effect.** For that run the page counts under "Steps on your website" in `by_action` (and a Monday report sent that day says it needs
  the client); no step is created (`wait_new` is not a site-fix cause).
- **Fix.** Restore `&& !d` (or only move `wait` back to `site_fix` when the cause is a site-fix cause).

**R5 (Low, copy). The failed-run note can show a fragment of an internal error, and says "last check" twice.**
- **Where.** `IX_Inventory.js:71` / `IX_Diagnose.js:156` put `e.message` in `why`; `IX_Report.js:33` puts `why` in `summary.note`; the app's
  `indexingNoteText` (`app/shared/src/indexing.ts:677-679`) replaces `inventory failed:[^.]*\.?`, which stops at the first dot of the message.
- **Evidence.** `zz_probe3`: `"... today: inventory failed: TypeError x.y. The figures are from the last check."` -> `"...; we try again on
  the next daily check.y. The figures are from the last check."`. The report callout then adds "The counts in this report are from the
  last check that did", repeating the engine's last sentence.
- **Fix.** Engine: never put an exception message in a customer note (keep it in the run row's internal field). App: replace up to the end
  of the sentence the engine wrote, and drop one of the two "last check" sentences.

**R6 (Low, suspected). The 8 MB / 3 MB read limits do not bound memory: the whole file crosses the task runner as a JSON number array.**
- **Where.** `_index_kit.js:210-217` `answerText` calls `getBinaryDataBuffer` for the whole file, then cuts. In n8n 2.41.4 the RPC answer is
  sent as JSON (`task-requester.js` `handleRpc` -> message; runner `makeRpcCall` -> `toBuffer`), i.e. `{type:'Buffer', data:[...]}`:
  about 3.5 characters of JSON and one array element per byte. The runner has `mem_limit: 512m` (`deploy/gcp/compose.prod.yml:187`).
- **Effect (not run).** A 10 MB sitemap costs on the order of 100+ MB in the runner while it is read; a sitemap near the protocol's 50 MB
  could kill the runner task, which fails the execution before the reservation (R2). Wave 1 carried text, about 1 byte per byte, but
  all bodies of a round at once, so this is a change of shape, not a clear regression.
- **Fix / check.** Check the largest sitemap of each client before deploy, or fetch sitemaps with a response size limit; confirm on the
  dev stack with one 20 MB sitemap.

**R7 (Low; the rest of N5). A self-start that fails is still silent.**
- **Where.** `Start Index Part`, `Start Next Index Part`, `Restart Index Part`, `Start Index Watch` (`build_index_coverage.py:126-214`)
  are `continueRegularOutput` and no node reads their output. A deploy that leaves the workflow unpublished for a moment, or any start
  error, ends the chain or the watch with a "success" execution and no alert. REVIEW_2's third N5 fix (an ops alert) was not done.
- **Fix.** After each start, a Code node that raises an ops alert when the output carries `error`.

**R8 (Low, suspected, by reading). Two chains can run side by side.**
- **Where.** A chain part refused for capacity (`too_many_open` / `heavy_busy`) waits 5 minutes with no reserved index row; a watch that
  arrives in that window passes the guard (`_run_guard.js` `sameSite`) and starts its own chain while the refused part restarts the first.
  The twin rule per site and N9 stop a site from being read twice, so the cost is two index runs at once and doubled refusals, not double
  spending. Not probed end to end.

**R9 (Low). An empty canonical (`href=""`) resolves to `https://host/%22%22`.**
- **Where.** `app/shared/src/indexing.ts:1025`: the first pattern needs one character, the second captures `""` with its quotes, and the
  new WHATWG resolve turns it into a path. False negative only (the step is never closed by our own check for that page).
- **Fix.** Return '' when the captured value is empty or only quotes.

Checked and fine in this pass:
- The watch cannot double: `Index Watch Plan` hangs on the settle, and the refusal path (`Refuse Run Ledger` -> `Refusal Notice`,
  `Retry Index Part`) never reaches the settle (graph walk of the generated workflow). A watch of another day does nothing; a dispatch
  with nothing to do starts no watch. A dispatch refused with `caught_up` is not retried.
- While a chain part is reserved, a watch dispatch (no domain) is a twin of it (`sameSite` with no site) and is refused, then retried in
  30 minutes, never run beside it. A chain part and an on-demand run of the same site refuse each other.
- The catch-up counts a `waiting` 05:15 execution as fired (`DEAD` = crashed / canceled only), so the 50-minute wait triggers no replay.
- The 50-minute wait fits the 3,600 s limit even if n8n counted it (the dispatch itself runs a few minutes); not verified whether n8n
  counts it (left open, as ENGINE_BUILD says).
- Wait nodes with an expression amount have `webhookId`s and `executeOnce`; the amount resolves from the single item (5 / 30 / 50 min).
- File answers: the HTTP V3 shape is as the code expects; `Sitemap Read n`, `Page First Reads` and `Page Signals` read their OWN input's
  binary by the same index (the fetch node is their direct input); no other node reads a fetch node's JSON body.
- `fix_seen_at` / `fix_failed_at` / `ask_google_at` over 70 days (`fix_real.js`, `n2_fixseen.js`, `n5_ask2.js`): a real fix is inspected
  daily for 7 days, then weekly, cleared when Google reads it; a Googlebot-only problem flips to `site_fix` with the note on the first
  crawl after the fix and is never marked fixed again from the same read; `needs_person` can trip; ask marks stay within 5 new per 7 days.
- No path deletes the only row of a page: move deletes wait for the upsert's answer; prune deletes never take a url that is a row of this
  run. One small loss: the history rows of a pruned duplicate's url are not moved (they age out at 400 days).
- Engine vs app contract: `summary.failed` / `checked` / `note` read by the app; `figures_from`, `sources: final` and `ask_google_at` are
  engine-only and harmless to the app; `fix_failed_at` is the gap (R1).
- Copy: every added customer string is clean (see N-app-9); the new engine note for N3 has no forbidden character and makes no promise.

## 3. Ready to deploy?

**Not yet.** Wave 2 closed what it set out to close (31 of 37 fully, 0 regressed, every suite green and matching the claims), but:
1. **R1** gives wrong advice in exactly the case N3 was built for: the step says Done while Google still sees the problem.
2. **R2** can rerun one failing website up to 30 times a day, every day, with an alert each time.
3. **R3** silently turns a working sitemap read into a permanently partial one for three-level trees (fix in the same wave; R4, R5, R9 are one-liners).
4. Before deploying: merge `feature/seo-agent-v4.5` (26 commits past the merge base, overlapping `SEO_Agent_v4.json`, `build_v4.py`, harness and app files), rebuild, rerun both suites and these probes; then A17 (the Indexing tutorial, CLAUDE.md rule).
5. After the deploy: one small Manual Run (`cap: 20`) and read the dispatch's watch execution 50 minutes later, plus one site with a large sitemap (R6).
