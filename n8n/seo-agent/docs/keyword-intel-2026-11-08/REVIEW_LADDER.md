# Review: the ladder package (branch `ladder/package`, head 7ae27452) - independent, adversarial

Reviewer: separate agent, 2026-11-10. Read-only on code. Base = production = `feature/seo-agent-v4.5`. Scope: the diff in
`n8n/seo-agent/v5`, the build scripts, `ladder_common.py` and `app/`; spot-checks of the generated workflows / `harness/code_v4`;
production evidence `R3_PROD_OUTPUTS.md` and the 2026-11-08 dump (`seo_ladders`, `seo_content_log`, `seo_rank_history`, `seo_pages`,
`seo_sites`, `seo_ladder_settings`). I formed the findings below before reading `fixes/LADDER.md` and `fixes/LADDER_REPAIR_PLAN.md`.

What I ran (scratch copies, nothing written to the repo):
- `ONLY_S=LPK` on a copy of the worktree in a throwaway `n8nio/n8n:2.41.4` container: **415 passed, 0 failed** (matches the builder).
- Node probes of the kit (`_fit_gate.js` + `_ladder_rules.js` + `_publish_rows.js`) on production shapes, and one extra harness probe of
  Parse Verdict (PROBEX below) on the replay the builder uses (`replay_3299.json.gz`).

## Verdict

**Ship after fixes.** No Blocker. Rule 3 (the market lock) is done well: it runs before any paid step and refuses with $0. Rule 6 (KI only for
`on`) fails closed. There are no new paid calls for Off sites: Ladder Requests is unchanged when `KIQ.used` is false (LPK8), and the new loads
are free Data Table reads. `sync_tables` runs before any import (`deploy_engine.py` step 3), so `stage` / `target_why` reach Ladder Rows' auto-mapped insert.
The copy has no AI tells: no em dashes, curly quotes or "..." in the added strings.

Five High findings change behaviour for every Off site in ways that can lose a real publish, close a run that is still alive, stop the
pages the owner said must never be stopped, or move a main keyword off the only page that ranks for it. Fix H1-H5 before deploying.
**Repair plan: do not apply as written.** Section 1 (techand ERP) needs an owner decision and changes. Sections 2-4 are fine with the small
changes listed at the end.

## High

### H1. The stuck-rung watcher closes runs that are queued, not dead (production runs with a concurrency queue)
`app/server/src/services/ladderWatch.ts:60,71`. "Alive" means only a main-workflow execution with status `running` that started no more
than 5 minutes before the rung. Production n8n runs `EXECUTIONS_MODE: regular` with `N8N_CONCURRENCY_PRODUCTION_LIMIT: 4`
(`deploy/gcp/compose.prod.yml:146-152`). Executions over the limit wait in n8n's FIFO queue with status `new`. The `?status=running` listing
does not show them.
Scenario: Monday cycle. Several sites' cadence page runs and monitor runs are queued behind four running executions. A rung goes `writing`
at 09:00 and its page run waits 65 minutes. At 10:05 the watcher sees nothing `running` that started after 08:55, and `LRU.stuck` returns
`stuck: true` (probe: 65 min, limit 60). The watcher sets the ladder row to `failed` with "nothing was written and nothing is charged".
Then the queued run starts and writes the page. Its ledger settles, so costSync charges the client. *Mark Ladder Row Written* matches
only `status: writing`, so the ladder row stays `failed` while the content log says `written`: two tables, two answers (INVARIANTS rule
4). The client is offered "Write it again", which pays for a second page run. The same thing happens when the content-log `started` row
is written more than 5 minutes after the execution starts: a long run that is still running is also closed.
Fix: count `new` / `waiting` executions as alive (n8n API `status=new` and `status=waiting`, or no status filter, then drop the finished
ones). Match on the execution's start or queue time, never on "started after". Do not close while any main-workflow execution of the
same site is queued. When a late `written` arrives for a `failed` row, let *Ladder Row Written* move `failed -> written` and drop the
"nothing is charged" sentence. Add a watcher test with a queued execution.

### H2. Publish detection loses real publishes (Detect Published drops the content-log row as well)
`n8n/seo-agent/v5/code/Detect_Published.js:48` with `_publish_rows.js:34-40` and `Publish_Candidates.js:52-53`.
(a) `publishedRows` returns a `merged` ladder row and also `url_conflict` for a deliberate merge (probe: `ladder_row.status: merged,
conflict: true`). Detect Published `continue`s on any `url_conflict`, so it never stores either the merged ladder row or the content-log
row. This contradicts the kit's own contract ("the content-log row still records where the page went live").
(b) Publish Candidates clears `existing` for **every** candidate whose existing address is "owned" by another search, including
content-log-only candidates (cadence striking-distance refreshes, AI-page refreshes). A refresh can be matched only by "the sitemap says
that URL changed". With its URL cleared it is never detected.
Scenario: a cadence refresh of `/services/erp` for the query "erp services uae", where a ladder rung of another keyword plans to improve
`/services/erp` (`page_exists: true`). The client publishes it. Monday detection never records it, so the content-log row stays
`written` for ever and counts in the pile-up guard (`_waiting.js`: WAITS). After three such pages the Content Cadence pauses for the
whole site.
Before this package the page was recorded (wrongly as two searches, but the loop went on). Now the site stalls, and the client can do
nothing about it: the page is live.
Fix: in Detect Published always push `log_row` (the content log records what happened). Push `ladder_row` when it is the `merged` row.
Only skip the ladder row on a non-deliberate conflict. In Publish Candidates apply `takenBy` only to candidates with a `ladder` row.

### H3. Rule 4 stops the refresh of the ladder's own live page for its score (the owner's 2026-10-29 priority is not kept)
`n8n/seo-agent/v5/code/Parse_Verdict.js:221,227,232,268-270`. The exemption "a ladder page whose own address is already live is never
stopped for its score" reads `dup.self`. But `dup` is computed only when `!exemptDup`, and every refresh run (`existing_page_url` given
and not found by the run) sets `exemptDup`. So `dup.self` is `[]` and the exemption never fires for the runs it was written for. The
Content Cadence (`Cadence_Plan.js` `existing_page_url: addr.existing`) and the ladder's own spawns pass `existing_page_url` for every
`page_exists` rung.
PROBEX (harness, replay 3299): a cadence run of the CRM main page refreshing its own live `/dynamics-365-crm-uae`, GO_WITH_CHANGES 35, gives
`verdict_hold: true, mode: enforce, ladder_stop.band: clearly_low`. The page is stopped.
Fix: `ladderOwnLive = refresh || (dup.self || []).length > 0`, where `refresh` is the line-221 flag for a ladder page whose
`existing_page_url` equals its `ladder_target_url`. Add PROBEX to LPK6 as a pinned case.

### H4. Rule 4 enforces a single noisy model score on every Off site with no shadow period (D17 skipped)
`Parse_Verdict.js:269-272` against the `CFG.automatic: 'shadow'` rule at `:204` (D17: automatic holds go to enforce only after two
cadence cycles of shadow logs and the owner's review of the first 20). Before this package a ladder page was exempt from the score hold.
Now one reading under 40, or a model-typed AVOID, stops an automatic ladder page for real. The row goes `stopped` and the cadence writes
only `planned` rows, so the rung stays stopped **for ever** on one reading. The verdict's own documented noise is 52 / 42 / 46 for the
same keyword (`Parse_Verdict.js` W05-B comment, R1 #7). A keyword that truly scores around 44 reads under 40 in a fair share of weeks.
The client is not told: no Needs-you item exists for `stopped` (grep: only `ladders.ts:434` and `climb.tsx` know the state). The stop
shows only if the client opens the ladder detail. The verdict cost is charged each time.
Fix (any of these): (1) stop on AVOID only. Use clearly-low only when a second signal agrees: the plan-time check of that rung, a
previous reading under 40, or little demand. (2) Run the ladder stop in shadow for the D17 window and give the owner the would-stop
list. (3) Add a Needs-you item "A page of your ladder was stopped" with the reason and Write it anyway.

### H5. The main page's blog rule moves the head off the only page that ranks for it (cannibalisation for every new ladder)
`Ladder_Plan.js:712-722` (`head_guard`) and `_ladder_rules.js` `stageOf`. `W_SOLUTION` matches `erp`, `crm`, `system`, `software`,
`platform`, `development`... so nearly every product head is "solution" and the blog rule applies. The guard never looks at
`site_rankings` / Search Console.
Production: techand's head "dynamics 365 erp system" ranks #16 (2026-11-05, `seo_rank_history`) and #26.5 for "dynamics 365 erp" (GSC,
`seo_pages`) with `/insights/is-microsoft-dynamics-365-an-erp-system`. LPK4 shows a re-plan sends the head to a new page
`/dynamics-365-erp-system` (`exists: false`). The new commercial page then targets the exact search the blog ranks for, and nothing
consolidates the two (no 301, no canonical, no title change on the blog).
For every Off site, a new ladder whose head matches a ranking article now writes a competing page. This goes against the owner's rule
that ranking must never drop.
Fix: when the blog address ranks for the head (top 30 in `site_rankings.head` or GSC impressions on that page for the head's cluster),
keep it as the head's improve target. Plan the commercial page as the hire / compare rung that links up, and say so. Otherwise ask the
client: a site task to 301 or retitle the article once the commercial page is live.

## Medium

- **M1. Region keywords refuse a valid market inside the region.** `_ladder_rules.js:147` picks the site's market, else the first
  measurable country. A request that is itself among the named places is refused: "erp software gcc" on a UAE site sent with Saudi Arabia
  is refused in `Ladder_Duplicate_Words.js`, and `market_ack` does not help (named places). In the app, `runs.ts:312` **silently**
  rewrites the client's country to the UAE. Fix: `ok` when `request_iso` is in the named places' ISOs; the app keeps a request that is
  inside the region.
- **M2. `ownerOf` treats a page as owned by any other keyword on file, including its own merged sections and one-off refreshes.**
  `_ladder_rules.js:61-66`. Probe: once a merged / sibling keyword sits on the techand blog address (production state, and row 36 after the
  repair), `ownerOf(blog, "is microsoft dynamics 365 an erp system")` returns the owner "microsoft dynamics erp". The page's real owner is
  then in conflict on its own page. Content-log owners (`Cadence_Plan.js:403`, `cadence.ts` mirror, `Publish_Check.js`
  `ownersPC`) give a page to whatever keyword refreshed it last. A homepage refreshed once for the brand blocks a ladder head that improves
  the homepage, and the cadence writes a new page instead (probe: home owned by "devaicon"). `sameSearch` is word identity, not a
  cluster, so the spec's "one search cluster" is enforced as "one word-set". Fix: owners = ladder rows that are `published` or
  `page_exists` and not `merged` into that URL. Content-log rows count only when they are the page's first publish. Use the ladder's
  `supporting` / SERP cluster for "same search".
- **M3. A held ladder run whose keyword already had a page never reaches `stopped`.** `Content_Log_Row.js:59` skips the content-log row
  for a held run when a prior row is written / not_ready / published. `Ladder_Row_Written.js:18` then needs the saved `held` row, so the
  ladder row stays `writing`. After 60 minutes the watcher closes it as `failed` with "nothing is charged" (the verdict was charged). The
  client sees "Write it again" without `hold_ack`, which runs the check again and stops again: a paid loop. Fix: in Ladder Row Written take
  `PVL.verdict_hold && PVL.hold.ladder_stop` as enough evidence (the hold itself proves nothing was written).
- **M4. `stopped` / `failed` / `merged` rows count as support for the main-page gate.** `Cadence_Plan.js:360-361`, `cadence.ts:689-691`,
  `ladders.ts:504-507`. Ladder Rows now also appends the plan-time stopped rows (`Ladder_Rows.js:8`). A ladder with two of three
  supporting pages stopped keeps its main page gated ("publish half the pages first") until the head ranks top 30. The client cannot publish
  those pages. The app counts `merged` as not live while the engine counts it through `publishedKw`, so the two disagree. Fix: leave stopped
  / failed / set_aside / merged out of `support`, and count merged as live, in all three places.
- **M5. A `stopped` row says "our check advised against this page" whatever stopped it.** `climb.tsx` `pageLine`. The repair plan stops
  rows 48 / 49 for strategy reasons, not a check, so the copy is false there. Fix: show the row's own reason (`p.reason`) first.

## Low

- L1. `copyOf` false positives when the base exists: `/windows-11`, `/top-10`, `/web-3`, `/d365-v9`, `/ai-agents-new`, `/whats-new`
  (probe). `-new` / `-v\d` / bare numbers are risky on real slugs. Keep `-copy`, `-old`, `-backup`, `-draft`, `-\d` only when the
  titles are near-identical.
- L2. `isBlog` misses locale prefixes (`/en/blog/x` is false).
- L3. `stageOf`: `W_HIRE` lacks "consulting" alone ("ai consulting dubai" is `info`); `W_SOLUTION` is so wide that the stage barely
  separates solution from info for product heads (see H5).
- L4. "eu" / "indian" / "jordan" are place words: "eu ai act compliance" on a UAE site is measured in Germany and the app switches it
  silently (M1's switch).
- L5. Rule 2 can add a page to a ladder that was under its cap: one more page run (about $1.4 engine cost) per short / full ladder. It is
  stated in the plan notes but not in the app's start-step cost.
- L6. LPK3 "golden" is a `direct` plan, so it never exercises the rule-2 re-plan or `oneUrl` on short / full plans. Add a short-plan golden.
- L7. `Tracker_Ladder_Marks` may overwrite `stopped` / `failed` with `set_aside`. That is harmless, but state_lint models no ladder
  status transitions for the three new values.
- L8. The watcher reads every site's ladder rows every 15 minutes (`fresh: true, max: 2000`). That is fine at two sites; batch or filter on
  `status=writing` before more clients arrive.

## Answers to the brief's questions (short)

- Off sites, Parse Verdict: yes, it can stop right pages (H3, H4). A stopped page charges only the verdict. The client is told only on the
  ladder detail (no Needs-you item, H4). The override exists ("Write it anyway" sends `holdAck`).
- Publish Check / Detect / Candidates: real publishes can be lost and sites can stall through the pile-up guard (H2). Rank tracking is
  not lost: Tracker Plan tracks rows with `page_exists` or rung 4 whatever their status.
- New statuses vs readers: the cadence skips them (planned only). The gate counts them (M4). The app renders them. No Needs-you item. No
  state_lint transitions (L7).
- Market lock: refuses before paid steps, correct for devaicon. It wrongly refuses an in-region request (M1). No site is refused today
  for a keyword naming no place sent in its own market.
- Watcher: closes queued runs (H1) and sends the wrong state on a late finish (H1, M3).
- Rule 1 matching: host / www / slash / query are handled (`urlKey`). Redirects are not followed. "-2" detection needs the base to exist.
  `/web-2-0-services` does not match, but the L1 cases do.
- Money: nothing new is paid on Off sites. Refusals come before paid steps. Nothing is charged twice, except H1 "Write it again" after a
  false `failed` and M3's loop.
- Columns: synced first on deploy. Ladder Rows feeds exactly the columns plus the two new ones.

## Repair plan verdict (`fixes/LADDER_REPAIR_PLAN.md`)

**Do not apply section 1 as written. Sections 2-4: apply with the changes below, after H1-H3 are fixed and deployed.**

1. techand ERP (`lad_mvjsa7995bsr`):
   - Moving the main page "dynamics 365 erp system" onto `/dynamics-365-business-central-uae` hands one product page (Business Central:
     "microsoft dynamics 365 business central uae" #50.6, "business central dubai" #57.3) a second search. That is the rule-1 defect in
     reverse.
   - It leaves three ERP pages for one cluster: the blog (#16 / #26.5, the one that ranks), `/ms-365-erp-uae` (title "MS 365 ERP in the
     UAE: Dynamics 365 Partner", already a commercial Dynamics 365 ERP page) and the refreshed BC page.
   - Owner decision first. Either keep the head on the blog that ranks and add the partner rung (H5's fix), or make `/ms-365-erp-uae`
     the one commercial ERP page (head improves it, rung 35 merged into it) and leave the BC page to its own searches.
   - Do **not** set content-log 16 to the new status `moved`. No reader knows it, `published_url` stays set so nothing changes for the
     cadence anyway (the plan says the cycle will not write it either way), and the row is a true record of what was published.
   - Re-probe and fix `seo_pages.http_status` (404 on 2026-10-22) for every target page first. Otherwise `SM.isGone` keeps them out
     of matching and duplicate checks, and the page run can treat the target as gone.
   - Rows 34 / 35 / 36 (stage, merged) are fine. Note that after M2 the merged row 36 makes the guide's own address "owned" by
     another search: fix M2 first or leave row 36 `published`.
2. techand CRM (`lad_mw0goinsniv1`): pause, row 47 failed + content log 26 failed, row 46 note, and row 50 head to `/dynamics-365-crm-uae`
   are all right (re-probe the page first: `seo_pages` says 404). Rows 48 / 49: use `set_aside` (an existing status whose meaning, "not a
   search to target", fits) or fix M5 first. `stopped` + "Write it anyway" says our check advised against them, which is not true.
3. devaicon GCC (`lad_mvpd7x01f657`): archive is right; nothing is lost. The two Pakistan pages stay live and their rank history stays.
   Send the owner note.
4. devaicon agentic (`lad_mw28vc20jc4w`): no change. The stage values are right per the kit.
5. General: before-images, a read-back and a Tuesday-Thursday window are good. Nothing in sections 2-4 loses a published page or ranking
   history: the rows keep `ladder_id` + `keyword`, so `seo_rank_history` stays joined.

## Re-review of f7399da4

Diff reviewed: `7ae27452..f7399da4` (84b1c82b engine, 6376f5df app, f7399da4 docs). Re-ran `ONLY_S=LPK` on f7399da4 in a throwaway
`n8nio/n8n:2.41.4`: **449 passed, 0 failed**. Kit probes on production shapes (node). I read the n8n 2.41.4 public-API source in the image
for the watcher question.

### Verdict: **do not ship yet**. One High is still open (H1, now a regression) and one High is new (N1). Both are small fixes. **Repair plan: safe** (see the end).

### Status of the first review's findings

| Item | Status | Evidence |
|---|---|---|
| H1 watcher | **NOT fixed, now worse for running runs** | `ladderWatch.ts` `recentExecutions` = `GET /executions?workflowId=..&limit=100` with **no status filter**. In n8n 2.41.4, `executions.public.controller.js:79` passes `excludeRunning: query.status !== 'running'`. `execution.service.js:457-461` then drops every execution that is active with status `running` from the list. So the watcher now sees queued (`new`) runs but **never sees a running one**. A page run still running 60+ minutes after its rung started (long Opus / retry runs, the 189-minute case) is closed as `failed` while it runs. The first version saw it through `status=running`. The late-finish repair (below) softens the damage, but the client is told "stopped without a result" and offered "Write it again", which pays for a second run. The unit test mocks `running` with statuses, so it cannot catch this. **Fix:** three calls per sweep: `status=running`, `status=new` and `status=waiting` (all cheap; still 3 calls per 15 minutes in total, not per site). Keep the new alive rule. Add a test on the real API contract (a fake n8n that hides running executions when no status is given). |
| H1 late finish | fixed | `Ladder_Row_Written.js` emits two updates (from `writing` and from `failed`). *Mark Ladder Row Written* filters on `status = {{$json.from_status}}` (`build_v4.py` A-20), so only the matching one moves. Side effect, acceptable: when the client already pressed "Write it again" (row `writing`), the first run's late result moves it to `written` while the second run is still going. |
| H2 publish detection | mostly fixed; one new Medium (N2) | Detect Published always stores the content-log row and stores a `merged` ladder row. Publish Candidates applies the address rule only to ladder candidates, so cadence / AI refreshes are matched as before and the pile-up guard no longer trips on them. `unmatched` no longer lists conflicts. They go to `address_notes`, which nothing downstream shows the client (Low). |
| H3 own live page | fixed | `Parse_Verdict.js` `ladderOwnLive` now covers a refresh of its own address. Pinned in LPK6 (the CRM main page at 35: not held; AVOID: recorded, not stopped). |
| H4 noisy score | fixed as decided | Only an explicit AVOID stops. Under 40 is a shadow `ladder_low` record. The Needs-you item is `holdLadderStop` (`pipeline.ts heldPages`, `summaries.ts`). Leftover (Low): Ladder Plan's plan-time stop still treats an old `held` row with "clearly under" as a stop (`Ladder_Plan.js:648`). That row is a person-run score hold the client never overrode, so it is defensible, but it is wider than "AVOID only". Plan-time stops have no Needs-you item, and the run item disappears after 30 days. |
| H5 ranking head | fixed in plan and cadence; new High N1 on the redirect step | `LRU.ranksFor` is used by Ladder Plan (`headRank` with its URL), Cadence Plan and `cadence.ts` (Rank Tracker head position, **url ''**). Parity is Low: Plan requires the ranking URL to be this address, while the cadence accepts a head that ranks with *any* page. The cadence is more lenient, so it can keep a blog address that another page ranks with. Thresholds are shared through LRU, and the mirrors read the same `queries_json`. |
| M1 in-region market | fixed | Probe: "erp software gcc" on a UAE site sent with Saudi Arabia gives `iso SA, ok true`. A Pakistan site with a GCC keyword is still refused. |
| M2 owners | fixed | Merged rows and refreshes (`existing_page_url` set) are no longer owners in all four places. |
| M3 / M4 / M5 | fixed | Ladder stop is its own evidence. Support excludes stopped / failed / set_aside, and merged counts as live (engine, cadence.ts, ladders.ts agree). The stopped line shows its own reason. |
| L1 copy suffixes | fixed, but see N3 | |
| L6 golden | fixed (short-plan golden added) | |

### New findings in the fixes

- **N1 (High): the "moved from" redirect step can tell the client to 301 another rung's live page.** `Ladder_Plan.js` sets
  `g.moved_from = g.was` for every head move. `Ladder_Rows.js` writes "moved from <old>: ..." into the head's `target_why`. Then
  `siteTasks.ts ladderMovesOf` turns any published head with that prefix into an `indexing:merge` pair. Neither it nor
  `indexMergePairs` (`shared/src/indexing.ts:1469`) checks the old address.
  Scenario: a new ladder whose head matched a blog guide that does not rank yet. The plan moves the head and `oneUrl` leaves the guide
  to the rung that matched it (the techand ERP shape: rung 2 "is microsoft dynamics 365 an erp system" on the same address). Once the
  head page is live, "Steps on your website" asks the client to 301 that guide to the head, which deletes a live rung page and its
  rankings.
  Fix: set `moved_from` only for the `copy` reason (a "-2" / "-copy" variant, where a 301 is right). For the blog reason, make no
  redirect step; or, at least, skip it when the old address is another `seo_ladders` row's `target_url`, a content-log page of another
  keyword, or has Search Console impressions for any query.
- **N2 (Medium): Detect Published now records a title-only match on another search's address as that keyword's publish.** When a ladder
  candidate's own address is taken, it can only be matched by slug or title. A title match on the owned address (techand's guide carries
  the head's title) now stores the content-log row `published` at that address. The cadence then counts the head as published
  (`publishedKw`, `recent`) and never writes it, although the client may not have published anything.
  Fix: on `url_conflict`, store the log row only when the match was the candidate's own URL / slug or a deliberate merge. A title-only
  match onto an owned address stays unmatched with its note.
- **N3 (Medium): the copy guard no longer catches production's `-2` case in Ladder Plan.** `copyOf` now refuses a one-digit copy when
  both titles are known and differ. Ladder Plan passes titles (`knownLP`); production's titles are "Dynamics 365 CRM in Dubai & UAE:
  Sales and Service | Tech&" vs "Dynamics 365 CRM Services UAE | Tech". Probe: `copyOf(.../dynamics-365-crm-uae-2)` returns `''` with
  titles and the original with URLs only. Cadence Plan / `cadence.ts` pass URLs only, so a new CRM-style plan aims its head at `-2`
  while the cadence writes onto the original: plan, app and engine disagree. LPK4's fixture uses identical titles, so it passes.
  Fix: compare titles by word overlap (for example 60% of the shorter title, brand and separators dropped), not by equality; or ignore
  titles when the page has no Search Console impressions. Pin LPK4 with the production titles.
- Watcher cost / rate: about 3 n8n API calls per 15 minutes after the H1 fix (now 1), plus one filtered `seo_ladders` read per site
  (`status=writing`, L8 done). Fine. Cross-site "alive" matches: any queued or unfinished main-workflow execution of any site keeps every
  rung open. That is conservative, so it can never wrongly close; on a busy system closing is delayed, which is acceptable. A 100-row
  window can push an older unfinished execution out of view: Low once the per-status calls are used, since `running` / `new` lists are short.

### Repair plan (rewritten) - **safe to apply** after the package with H1 and N1 fixed is deployed

- Section 1 (ERP, safe option): no move and no new page. The guide stays the head's page (it ranks #16). Row 36 is `merged`, which M2
  no longer counts as an owner. Content-log 15 / 16 are unchanged and no new status is introduced. Stale `seo_pages` 404s are
  re-probed and corrected first. Nothing in it loses a page or ranking history.
  One note for the owner before the optional "Write it now": retitling the guide towards "dynamics 365 erp system" changes the page of
  rung 34 ("is microsoft dynamics 365 an erp system", #31.3). That is a choice between the two searches, and it is the owner's.
- Section 2 (CRM): rows 48 / 49 are now `set_aside` (right). Row 47 `failed` waits for a check in n8n that nothing of 2026-11-05 is still
  running or queued (right; check `status=running` and `status=new` separately, for the H1 reason above). Re-probe
  `/dynamics-365-crm-uae` before pointing row 50 at it.
- Sections 3 / 4: unchanged, fine.
