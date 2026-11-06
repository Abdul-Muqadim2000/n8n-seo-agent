# AIR independent review B: safety, money, deploy (2026-11-06)

Reviewer: independent, did not write AIR. Snapshot: commit `77c82704` (worktree `.claude/worktrees/air-review`, read only), compared with
the production base `1a8bfbf0`, docs excluded. No paid call, no production access, nothing committed.

Scope: off / shadow isolation, the P3 behaviour changes that reach every site, money, Data Tables and deploy order, secrets, the n8n
sandbox rules. P6 (on-mode consumers, Cadence reserve, app UI) is not in this snapshot.

## Summary

| Severity | Count | Ids |
|---|---|---|
| Blocker | 0 | |
| High | 1 | RB-1 |
| Medium | 6 | RB-2, RB-3, RB-4, RB-5, RB-6, RB-7 |
| Low | 5 | RB-8, RB-9, RB-10, RB-11, RB-12 |

Bottom line: with every site off or in shadow, the AI Growth workflow is isolated: it runs only the gate and its IF, makes no outside call,
and writes only the five `seo_ai_rank_*` tables. I verified that in the generated JSON and the offline harness. The risk is elsewhere. The
P3 defect fixes change what every client sees, and one of them (F-53) changes share of voice and the rival table without marking the
week as a new baseline (RB-1). F-37 can fill AI Growth's six queued slots with questions the Content Cadence will never write (RB-2). The
engine side of F-38 has no app mirror in this snapshot (RB-3). Money is well guarded. The one weak point is the kill switch, which fails
open when its row cannot be read (RB-4).

## What I ran

- Full harness on a scratch copy (no docs) in a throwaway `n8nio/n8n:2.41.4` container: **16,652 passed, 1 failed**. The one failure is
  CY32 (`deploy_guard.mjs` is copied into the harness by build section 140, and I did not run the build in the copy). That is an
  environment artefact, not a code fault.
- A node-by-node diff of all 30 generated workflows, base against snapshot (script in the session scratchpad). Workflows and nodes that
  changed:
  - AI Growth: +91 nodes. Changed nodes: `Growth Plan`, `Earned Media`, `AI Target Rows`, `Save AI Targets`, `Ledger Settle (Growth)`, and
    two Ensure schemas.
  - AI Visibility: 18 nodes (P3 kits and F-85).
  - AI Pulse and AI Pilot: 4 to 5 nodes each (kits).
  - Content Cadence: `Cadence Plan` (F-38), plus two target updates (schema only, `defineBelow`, values unchanged).
  - Site Admin: `Admin Action`, `Monitor Row (Admin)`, and schemas.
  - Main workflow: `Monitor Row (Track)` and two schemas.
  - Backlink Monitor, Link Builder, Audit Scheduler: the plan node only (the AIRF inline).
  - Cycle Dispatcher, Rank Tracker, Site Tracker: an Ensure schema only.
  - Connections changed only in AI Growth.
- I scanned every generated Code node for a missing or duplicate `const AIRF`. None was found. AI_Rank_Calls.js names AIRF in a comment
  only.
- I read n8n 2.41.4's `DataTable/common/addRow.js` in the image. In auto-map mode it writes only the keys an item carries, so D10 (one
  writer of `core_until`) holds.

---

## RB-1 (High): F-53 changes share of voice and the rival table, but the week is still compared with the last one

- **Where:**
  - `n8n/seo-agent/v5/code/_ai_entities.js:142` (`junkName`), `:381` (domains named by the client's own words count as its platform),
    `:390` (`OPEN_PLAT`), `:395` (a name with no business signal becomes `other`).
  - `n8n/seo-agent/v5/code/AI_Metrics.js:450` (`same_rule` checks only `rule_version` and the F-08 marker).
  - `v5/code/_ai_stats.js:24` (`RULE_VERSION` unchanged).
  - `AI_Metrics.js:157-160`: pulse rivals come from each stored morning's `detail.ents`, written under the old rule.
- **Failure scenario:**
  1. The week after the deploy, Parse AI Answers classifies far fewer names as competitors. P3's own measurement on the production answers
     is 2,216 to 1,729 competitor entities, and non-domain competitors fall from 769 to 330.
  2. The client's share of voice and every rival's `competitor_share` are re-normalised.
  3. `same_rule` still says the week is comparable to the previous one, whose stats were counted with the junk included. The report then
     prints a change in share of voice and big moves in the rival table (devaicon's former "top rival", openedx.org, disappears).
  4. That change can also trip an owner alert rule on `share_of_voice` or `competitor_share` (`_ai_measure.js:200` lists both).
  5. For the next four weeks the 28-day window mixes old-rule pulse mornings (stored `ents`) with new-rule weekly answers.
  6. Smaller risks in the same change:
     - `OPEN_PLAT` makes moodle.com and openedx.org never a competitor, for every site. A client who competes with Moodle loses it unless
       the owner lists it.
     - `clientSquash` can turn a rival whose domain is a two-word phrase the client also uses into "platform".
     - P3 itself notes that "a few real names went with them".
- **Fix:**
  - Treat the entity rule like the F1b rule change. Store an `entity_rule: 'f53'` marker in `stats` (and in each pulse `detail`). Refuse
    the share-of-voice, rival and competitor-share deltas, and the alert rules on those metrics, when the earlier week or a pooled morning
    lacks the marker. Say so in plain words: "measurement rule changed: this week starts a new baseline".
  - Alternatively, bump `AVM.RULE_VERSION` with the owner's yes, accepting that the 28-day windows restart.
  - Make `OPEN_PLAT` conditional, like the other platforms (named as an integration target, or in the client's own text), instead of
    global.
- **Verification:** in the harness, run AI Metrics with a previous visibility row whose `stats` was produced by the base commit's
  `_ai_entities.js`, and this week's answers parsed by the new kit. Today `same_rule.comparable` is `true` and `delta.sov` is non-null.
  After the fix, `comparable` is `false` with the reason, and no alert rule on SOV or competitor share fires. Also add a site whose
  configured rival is moodle.com, and one where it is not configured but named as a competitor, and check the role.

## RB-2 (Medium): F-37 queues questions that the Content Cadence will refuse, crowding out writable ones

- **Where:** `n8n/seo-agent/v5/code/Growth_Plan.js:64` (`OWN_PAGE` includes `ladder` and `written`), `:165` (topic rescue), `:206`
  (`status = !tg.ok && !tLive && !ownPage ? 'set_aside' : status0`), `:238` (only `max_targets` = 6 stay queued); `v5/code/Cadence_Plan.js:443-447`
  (the cadence re-gates each target's original keyword and refuses it).
- **Failure scenario:**
  - **Rule 1 (own page) overrides EVERY gate reason, not only topic.** P3.md says a brand, government or portal refusal is never rescued,
    but that holds only for rule 2. Rule 1 keeps a question refused as `other brand`, `job search`, `other market`, `government` or
    `navigational` whenever a page of the client's matches it: a cited page, a ladder page or a written page with word cover 0.6 or more.
    - Such a question becomes `queued` (`status0`) when its page is stale or weak.
    - Example: "Is Odoo better than SAP Business One for UAE SMEs?" with an old client page AI cites.
  - **Rule 2 (rescue) stores the original keyword** unless a synonym was written out. The cadence's global gate refuses it again at
    writing time, as P3 itself notes.
  - Either way the question takes one of the six queued slots. A writable lower-value question is pushed to `skipped` ("lower value than
    the 6 queued questions"). The cadence then lists the kept question as refused, every week.
  - This affects every site, today, with AIR off.
- **Fix:**
  - Keep rule 1 for topic reasons only (`TOPIC_REASONS`), as rule 2 does.
  - A kept or rescued question that the global gate still refuses on its stored keyword gets a new status (for example `kept`, or
    `skipped` with the reason "your page answers it; not written automatically"). It does not count toward `max_targets`.
  - Or pass the rescued text to the cadence (P6's note) so the two agree.
- **Verification:** two harness cases on Growth Plan plus Cadence Plan:
  1. A question refused as `other brand` with a cited client page. Expect `set_aside` or the non-queued state, never `queued`.
  2. Seven queued candidates where one is rescued but refused by the cadence's gate. Expect six writable targets queued, and the rescued
     one not counted.

## RB-3 (Medium): F-38's 60-day rule is in the engine's cadence but not in the app's mirror

- **Where:** `n8n/seo-agent/v5/code/Cadence_Plan.js:430`; `app/server/src/services/cadence.ts:790` (unchanged in this snapshot).
  CLAUDE.md requires the two files to change together.
- **Failure scenario:**
  1. A page the agent published 10 to 59 days ago is the page of a queued AI refresh target.
  2. The engine now skips it, but the app's Pipeline preview ("This week" / AI page of the week) still shows that refresh.
  3. On Monday the engine writes something else. The client sees a promise the engine does not keep.
  4. P3 handed the line to P6, and P6 is not in this snapshot. So shipping P3 alone ships the mismatch.
- **Fix:** add the same line to `cadence.ts` now (content-log rows with `published_url` and a `published_at` less than 60 days old join
  `refreshedRecently`), and add a parity case to the app suite. Or do not deploy P3 without it.
- **Verification:** an app unit test with a content-log row published 20 days ago and a queued refresh target on that URL. Expect no AI
  refresh in the preview, matching AF3's engine case.

## RB-4 (Medium): the kill switch fails open when its row cannot be read

- **Where:**
  - `n8n/seo-agent/ai_rank_wiring.py:83`: `Load AI Rank Cache` has `alwaysOutputData` and `onError: continueRegularOutput`.
  - `v5/code/AI_Rank_Live.js:7`: `AIRF.killed(cacheRows)`.
  - `v5/code/AI_Rank_Requests.js:47-48`: the planner re-checks the same rows.
  - `_ai_rank_flags.js` `killed()`.
- **Failure scenario:**
  1. The owner sets `air:kill = 1` because something is wrong.
  2. On the next run the seo_cache read errors or times out. That is exactly the kind of day a kill switch is used.
  3. The load hands on `[{ error }]`, and `killed()` returns false.
  4. AIR runs. For an `on` site with its flags, the paid reads (LLM Mentions, fan-out SERP, Brave) go out, up to the $0.60 per site and
     run ceiling, and the sink writes happen.
  5. The spend guard elsewhere fails open on purpose (a guard must not block a customer). AIR is an optional add-on, so blocking it blocks
     no customer.
  6. The switch is also only seen when the row's `kind` is `air`, because the load filters on kind. A row inserted by hand with another
     kind is ignored silently.
- **Fix:**
  - In `AI Rank Live`, treat a load that returned an `error` item, or no answer, as killed for paid reads and sink writes: skip with
    "kill switch could not be read".
  - Load by `key = 'air:kill'` OR `kind = 'air'`.
  - Optionally let shadow continue (it pays and changes nothing outside AIR).
- **Verification:** an AP12 variant where `Load AI Rank Cache` throws. Expect no node of the request chain to run and no sink row; then
  the same with a kill row whose kind is `''`.

## RB-5 (Medium): Site Admin already accepts `on`, but the on-mode consumers (P6) are missing, and the AIR target sink can undo a client's choice

- **Where:**
  - `n8n/seo-agent/v5/code/_ai_rank_flags.js:20` (`validate` accepts `on`).
  - `v5/code/Admin_Action.js` (AIR block at the end).
  - `v5/code/AI_Rank_Plan.js:238-247` (target sink).
  - `Cadence_Plan.js:127` (reads every queued target, with no `origin` check).
- **Failure scenario:**
  - **Before P6 lands, anyone with Site Admin access can set `ai_rank_mode: on`** (one API call, no app UI yet). Then:
    1. AIR writes `seo_ai_targets` rows with `origin = ai_rank`.
    2. The unchanged cadence writes them as ordinary AI pages inside the existing monthly AI quota. There is no reserved slot, no protect
       rule and no app mirror, so a Claude page run costs about $1.20.
  - **The AIR target sink reads targets from `Load AI Targets`**, a snapshot taken before this run's `Save AI Targets`. It skips only
    `writing`, `written` and `won`.
    - A target the client set to `skipped` with "kept by you" is re-queued by AIR. So is a target the fit gate set aside this run.
    - The question gets `status: 'queued'` with no fit-gate check on the sink side.
    - This overrides the client's explicit decision.
- **Fix:**
  - Until P6 is merged, make `AIRF.validate` refuse `on` (or require an explicit build flag).
  - In the target sink, also leave alone `skipped` rows whose reason is "kept by you" and `set_aside` rows.
  - Run the fit gate on the sink keyword.
  - Read this run's `Growth Metrics.target_rows`, not only the start-of-run snapshot.
- **Verification:** an AP4 variant with a stored target `{ status: 'skipped', reason: 'kept by you' }` for a question AIR chooses. Expect
  no AIR row for it. And a Site Admin `monitors` call with `ai_rank_mode: 'on'` refused while the P6 flag is absent.

## RB-6 (Medium): the off-mode golden test covers only AI Growth, and its fixture misses the paths P3 changed

- **Where:**
  - `n8n/seo-agent/harness/scenarios_air_golden.js` and `air_golden/ai_growth_off.json`.
  - `harness/air_graph_exec.js:58-71` (the Data Table emulation).
  - fixes/P3.md: "The fixture holds no set-aside or refresh target the F-37 / F-38 fixes reach".
- **What the golden and shadow-golden tests do not look at:**
  1. **Other workflows.** No off-mode before/after snapshot exists for AI Visibility (Parse AI Answers, AI Metrics, AI Report), AI Pulse,
     AI Pilot, the Content Cadence, Site Admin or the main workflow's Track my site. P3 deliberately changed several of them. The only
     record of what moved for every client is the hand-written AF scenarios, so RB-1 and RB-2 passed every check.
  2. **The F-37 and F-38 paths in AI Growth.** The fixture never reaches them, so the golden would stay green even if those paths broke.
  3. **Table schemas.** The in-memory Data Tables accept any column. A write with a column the live table lacks cannot fail offline. D12
     says such a write fails in production: `Save AI Targets`, `Set Monitors` (Site Admin) and `Save Monitors (Track)` all now carry new
     columns.
  4. **Node settings.** HTTP is instant, and `retryOnFail`, batching, timeouts and the workflow's `executionTimeout` (2400 s for AI
     Growth) are ignored.
  5. **Mixed sites and failures.**
     - No golden runs one site off and one in shadow; AP3 runs both in shadow.
     - No test covers a kill-switch read that fails (RB-4), or a second run on the same day (the run row is an `insert` keyed by a
       per-day `run_id`, so a scheduled run and an on-demand run on the same day leave two rows).
- **Fix:**
  - Add a W0-style golden for AI Visibility with every site off, taken at `1a8bfbf0`, and regenerate it in P3's commit with the moved
    lines listed.
  - Extend `fixtures_air` with one set-aside question that has a cited client page and one refresh target with a recent `published_at`.
  - Give `air_graph_exec` an optional strict-schema mode, so a write with an unknown column throws.
- **Verification:** with the new golden in place, revert F-53 in a scratch copy and confirm the AI Visibility golden fails. With strict
  schema on, remove `origin` from the fixture's `seo_ai_targets` columns and confirm AIRG3 fails.

## RB-7 (Medium): F-08 is partial: pooled sources still count retired questions

- **Where:**
  - `n8n/seo-agent/v5/code/AI_Metrics.js:105`: answers are filtered, but each reading keeps its `sources` aggregate.
  - `AI_Metrics.js:235`: `for (const d of PR) for (const [h, n] of Object.entries(d.sources || {}))`.
  - `AI_Metrics.js:555`: `headEng` still reads `d.engines`.
- **Failure scenario:**
  - A pulse morning whose answers were all, or partly, to questions no longer on the panel still adds its cited hosts to "Sources AI
    trusts" and to the rival-as-source counts.
  - The headline engine list can name an engine whose pulse answers were all left out.
  - So the week's headline excludes the old panel while its sources table still shows it: the same mismatch F-08 set out to remove.
  - P3 also documents a remaining comparison gap: a week with no off-panel answers after a week that pooled some is still compared.
- **Fix:**
  - Rebuild the per-reading sources from the kept answers. If per-answer sources are not stored in `detail`, drop the `sources` of any
    reading with off-panel answers and say so in `pulse_basis`.
  - Derive `headEng` from the kept answers.
  - Mark the first week after the deploy as a new baseline whenever the previous row lacks `headline_rule`.
- **Verification:** an AF1 variant where one morning has only off-panel answers citing `old-rival.example`. Expect that host absent from
  the sources table, and that engine absent from the headline engines.

## RB-8 (Low): AIR sits on the critical path before Growth Report

- **Where:**
  - `n8n/seo-agent/build_monitors.py:949`: the AIR branch is between `Save AI Growth` and `Growth Report`.
  - AI Growth settings: `executionTimeout: 2400`.
  - `ai_rank_wiring.py`: the loads include 28 days of `seo_ai_answers` with answer text.
- **Failure scenario:**
  - In shadow, the report email, the `ai_growth` callback and the ledger settle all wait for AIR's five Ensure nodes, twelve loads, the
    plan and eleven builders.
  - AIR's Code nodes fail gracefully: they continue on error, and the runner's 5-minute task timeout becomes an error item. But a
    workflow that passes 2400 s, or a runner crash, loses the existing report and leaves the ledger row unsettled for that client.
  - Nobody has measured AIR's run time in the real n8n runner. The P4 replay used the offline executor.
- **Fix:**
  - Measure on the alvrun stack in shadow (the AI Growth duration with and without AIR) before the live shadow.
  - Better, fork AIR after `Build Growth Callback` in shadow. In on mode its paid reads would then need their own ledger row (mode
    `ai_rank`), or the settle must wait.
- **Verification:** one shadow run on the isolated stack. Compare the AI Growth execution time with the off run, and confirm the callback
  time does not move by more than a few seconds after the fork.

## RB-9 (Low): Brave's spend never reaches the ledger, and the AI Growth reservation ignores AIR's reads

- **Where:** `n8n/seo-agent/v5/code/AI_Rank_Fetched.js:12, 164` (`brave_usd_est`, never in `cost_usd`); the settle reads `cost_usd`
  only (`Ledger_Settle_Growth_.js:874-888`).
- **Failure scenario:**
  - Brave is paid per search above its free credit. The settled row records $0 for it, so the daily spend guard and the admin cost page
    never see it.
  - The `ai_growth` reservation is unchanged, so an `on` run with every flag can spend up to $0.60 a site beyond what it reserved.
  - Both amounts are small, but the project rule is that money is what happened.
- **Fix:**
  - Settle Brave as an estimated line in the ledger (`estimated_usd`, with the basis).
  - Raise the `ai_growth` reservation by the planned AIR spend when a site is `on`. The planner already computes `est`.
- **Verification:** AI3 extended: an on run with Brave on records `estimated_usd` of 0.005 x searches in the ledger row, and the
  reservation exceeds the plan's `est`.

## RB-10 (Low): an unpaired gated call drops its cost and its budget count

- **Where:** `n8n/seo-agent/v5/code/AI_Rank_Fetched.js:35` (`pair` returns no pairs when the request and answer counts differ), `:39`
  (`charge` runs only on pairs).
- **Failure scenario:**
  1. One of the in-200 gate's own nodes fails (`onError` continue) and hands one `{ error }` item for N requests.
  2. Nothing of that call is read, so `cost_usd` misses the first attempt's money, which DataForSEO billed.
  3. The week marker counts no reads, so a second run in the same week pays again, up to `fanout_n`.
- **Fix:** when unpaired, still charge every answer that carries tasks (count once by task id), and count the planned reads against the
  week's budget.
- **Verification:** an AI3 variant where `AI Rank SERP Call Answers` returns one error item for three requests. Expect the reported cost
  in `cost_usd`, and a rerun that plans 0 reads.

## RB-11 (Low): `air:*` markers are never pruned, and every AIR run loads all of them

- **Where:**
  - `n8n/seo-agent/ai_rank_wiring.py:83`: `Load AI Rank Cache` loads every row of kind `air`, for all sites.
  - `AI_Rank_Fetched.js`: the week marker can reach 60 KB.
  - `ai_rank_reset.py`: does not clear `air:week:*`, `air:cc:*` or `air:mentions:*` (P5 notes it).
- **Failure scenario:** one week marker per `on` site per week, for good. Two sites for a year is about 100 rows of up to 60 KB loaded
  into every AIR run, and it grows with each client switched on.
- **Fix:** prune `air:week:*` older than 2 weeks and `air:mentions:*` older than 2 months (a delete node after `Save AI Rank Fetch
  Cache`), and load the kill row separately by key.
- **Verification:** a fixture with 20 stale week markers. Expect 2 left after one on run, and a kill switch that still works.

## RB-12 (Low): F-85 deletes every site's results pages older than 2 days, but AIR plans for 7 days of free reuse

- **Where:** `n8n/seo-agent/build_monitors.py:404-406, 496-499` (load, blank and prune without the site filter);
  `v5/code/AI_Rank_Requests.js` `serp_fresh_days: 7`.
- **Failure scenario:**
  - F-85 itself is correct. Every other reader of `serp:` rows uses today's reading only (`_serp_cache.js` lookup, Keyword Check, ladder),
    so deleting older rows changes nothing for them.
  - AIR's planner treats a Google reading of the last 7 days as free. After each AI Visibility run, nothing older than 2 days is left.
  - So AIR pays for reads it modelled as free. The weekly cap (`fanout_n`) still bounds the money, but the cost table in P5 §5 overstates
    the reuse.
  - The first AI Visibility run after the deploy also blanks and deletes every empty-site-id row accumulated since 2026-10-21, in one
    update and one delete.
- **Fix:** align the two windows (prune at 7 days, or set `serp_fresh_days` to 2). Run the first prune by hand outside a cycle window
  after the deploy.
- **Verification:** count the `kind = serp` rows older than 2 days on production (read only) before the deploy. After the first AI
  Visibility run, confirm the count is 0 and the run took normal time.

---

## Checked and found sound

- **Off mode, AI Growth:**
  - Only `AI Rank Gate` and `Any AI Rank?` run (AIRG2).
  - The gate reads `$('Growth Plan')` and `$('Load Monitors')` only, so it changes nothing upstream.
  - A gate error becomes an `{ error }` item, which the IF sends to `Growth Report`.
  - Every builder returns rows or a single `{ skip }`. None of the five AIR tables, nor the sink tables, has an `error` or `skip` column,
    so no IF splits a builder's items across both branches, and `Growth Report` runs once.
  - The kill-switch row changes nothing while every site is off (AIRG4).
- **The six monitor plans and Site Admin:**
  - AIRF is pure and cannot throw at definition. `settingsOf` maps missing or empty columns to off.
  - No duplicate `const AIRF` exists in any generated node.
  - `settings.rank` is not copied into any callback (AP1).
  - Site Admin validates only the five fields, and only when given. `''` clears, and a missing field keeps the stored value.
  - Track my site carries them as stored.
- **Old rows without the new columns:**
  - `_ai_focus` `held()`: an empty `core_until` is false.
  - `_ai_measure`: `live_at` falls back to `written_at`.
  - Growth Plan and Earned Media: an undefined `origin` is not AIR's.
- **Shadow:**
  - The planner plans only where `AIRF.mayPay` (mode `on`, not killed). Every request node then skips, and `AI Rank Fetched` skips.
  - No AIR Code node calls `httpRequest`, `fetch` or `require`.
  - The sink builders check `AIRF.writesSinks` and the plan builds no sinks in shadow, so the gate is double.
  - Writes go only to the five `seo_ai_rank_*` tables, plus their Ensure nodes.
- **Money:**
  - All paid HTTP nodes in AIR have no node-level retry: `AI Rank Mentions Call` / `(Retry)`, `AI Rank SERP Call` / `(Retry)` with
    `retryOnFail` false, and `AI Rank Brave Call` with none. Only the free Bing and Common Crawl calls retry.
  - Brave joins `_PAID_CREDS55` and retry_lint's N3 rule. Brave is built `false` without the key.
  - DataForSEO cost is counted once by task id across both gate attempts, and the settle reads it (`MEASURED` supports `A|B`). A node
    that did not run is skipped.
  - The weekly `fanout_n` budget, the monthly LLM Mentions marker and the $0.60 per-site per-run ceiling are enforced in the planner.
  - The planner re-checks the kill switch.
- **Deploy:**
  - The new columns come only from `ladder_common.py`.
  - `deploy/gcp/deploy_engine.py:192-196` runs `sync_tables.py` before any workflow is updated, and stops if it fails, which satisfies D12.
  - The five new tables are created by the Ensure nodes, and AP9 shows `sync_tables` lists only the nine new columns.
  - The Cycle Dispatcher waits for a job's blocker to finish (`_cycle.js:655`), so a longer AI Growth delays the Content Cadence; it
    does not race it.
- **The Growth Plan reclaim rule:**
  - `AI Target Rows` writes `origin`, `action_id` and `live_at` as null only on the rows AI Growth itself builds.
  - In on mode, AIR-owned rows are skipped in both loops.
  - The cadence's two target updates are `defineBelow` with unchanged values.
- **Secrets and the public repo:**
  - No key, token or private key appears in the diff. The only match is the replay test's own leak regex.
  - Brave is only a template line in `.env.seo.example`. `sync_credentials.py` creates `SEOcredBraveApi1` only when the variable is
    set, and never prints it.
  - Fixtures use `.example` hosts and public platforms only.
  - techand.ai and devaicon.com appear only in code comments.
  - Not a defect, but worth knowing: some real third-party company names from the private production answers are quoted in
    `_ai_entities.js` comments ("Cubite", "Ravelin (by Sable)").
- **Sandbox rules:**
  - The AIR code has no `URL` constructor, no `structuredClone`, no `Object.defineProperty` or `setPrototypeOf`, and no `/*__` left over
    in the generated code.
  - `$execution.id` is read inside try/catch.
  - Every AIR node reads `AI Rank Plan` explicitly, never `$json`, after a Data Table save.
