# Defect dossiers — the monitor wave (executor C: findings C-1 … C-20 = R77 … R96)

Written 2026-10-16 for the chat that will fix these defects. Every symptom was re-checked read-only against the saved evidence in
`n8n/seo-agent/docs/system-review-2026-10-15/files/` (main checkout, git-ignored): `exec-619.json` … `exec-643.json`, `C-*.json` /
`C-*.txt`, `report-*.json`. Every root cause was re-read in the source. The main checkout and the worktree branch
`worktree-agent-a840f315c2932b4f4` (based on `5cf2e53`) hold identical copies of every file cited here. The n8n internals were read from
the running container (n8n 2.41.4). Nothing was run, changed, activated or written, except this file and a few read-only helper scripts
in the session scratchpad.

Line numbers are for the files as they are now. "Harness file" = `n8n/seo-agent/harness/code_v4/<file>`, the generated code of the node
that ran. `harness.js` replays a node against a saved execution's runData.

## Corrections to the register

- **R82 (C-6), re-described, still Low.** The audit's missing DataForSEO money is **not** the crawl price; the pro-rata crawl estimate
  ($0.0211) was right. The run's cost list omits the first attempt of *Fetch GBP*, two lookups at $0.0054. The arithmetic now closes:
  $0.0211 + 3 × $0.0054 = $0.0373 against $0.03735 moved. The retry also paid again for a definitive "No Search Results" answer.
- **R92 (C-16), one part re-described.** `seo_ai_pages` does not write every page twice on every run. The bare-host rows are
  **stale rows from 2026-10-10 / 10-11**, written before the canonical host was used; the `www.` rows are current. It is still a
  data defect, because the upsert key does not normalise the host.
- **R93 (C-17), raised from Low to Medium and re-described.** "techandkey com" is not a writing slip.
  - The Link Builder takes the **Search Console query** of each top page as that page's **title**. 13 of its 16 target pages carry a
    search query as their title ("pdf vs e-invoice uae", "uae e invoicing penalties", …).
  - The suggested link text for 7 of this run's 10 pitch jobs is that "title", so the anchor offered is an exact-match keyword. That is
    against the product's own "brand / title / URL, never a keyword" rule.
  - "as a option" stays a Low wording slip inside the same dossier.
- **R96 (C-20): the cause is a hypothesis.** The timing points to the request waiting behind the AI visibility run's DataForSEO calls
  (details in the dossier). Severity unchanged.
- No finding is withdrawn. R77, R78 and R94 stay High.

---

# High

### R77 (C-1) — An app backlinks request is refused by its own front-door run, and the customer is never told

- **Severity:** High (unchanged).
- **Feature / run:** on-demand full backlinks from the app. Executions 621 (API) → 622 (main workflow) → 624 (Backlink Monitor,
  refused).
- **What the customer sees:**
  - One report row, `stage: backlinks_started`, 19:29:41 UTC, title "Backlink check started · techand.ai": *"Your backlink check for
    techand.ai has started: links gained and lost, links to broken pages, spam, unlinked brand mentions and the sites that link to your
    competitors but not to you, with outreach dr…"*.
  - Nothing else ever arrives for request 621.
  - In the app, `expireStaleRuns()` (`app/server/src/services/runs.ts:264-280`) marks such a run failed after
    `greatest(3 hours, eta × 6)` with *"No result arrived from the SEO engine in time. The run may have failed in n8n (ops were
    e-mailed)…"*. Both halves of that are untrue here: the run was refused, and no ops mail is sent for a refusal. This last part is read
    from the code; it was not observed, because the run was started against n8n directly.
- **Evidence:**
  - exec 624 → *After Run Ledger (BL)* → `run_refused: true`, `reason: "same_mode"`, `refusal`: *"The previous backlinks run (execution
    622, started 19:29 UTC) is still going. Nothing was charged and nothing was started: this run would have read the same data and
    written the same rows twice."*, `basis: "1 other run(s) in flight (backlinks 19:29); the limit is 3"`, `open: [{mode: backlinks,
    run_id: "622"}]`.
  - `seo_run_ledger` row 91 (`run_id 622`, `key app:<org>`, `mode backlinks`) and row 92 (`run_id 624`, `key schedule:backlinks`,
    `status refused`).
  - Artefacts: `files/exec-622.json`, `files/exec-624.json`, `files/C-run-ledger-rows-90-102.json`.
- **The race, with timestamps (exec 622 and exec 624):**

  | UTC | Execution 622 (main workflow, request 621) | Execution 624 (Backlink Monitor) |
  |---|---|---|
  | 19:29:28.988 | *Reserve Run Ledger* inserts row 91 `reserved` | |
  | 19:29:36.366 | *Start Backlink Monitor* (Execute Workflow, `waitForSubWorkflow: false`) | |
  | 19:29:36.404 | | *Manual Run* |
  | 19:29:38.002 | *Run Ledger Settle* | |
  | 19:29:38.391 | | *Load Open Runs (BL)* reads the ledger: row 91 is `reserved` |
  | 19:29:38.472 | *Settle Run Ledger* starts writing row 91 `done` (`updatedAt` 19:29:38.862) | |
  | 19:29:39.071 | | *After Run Ledger (BL)* refuses |

  In between, 622 runs *Monitor Started* and *DFS Balance End*, and 624 runs ten *Ensure* nodes, eleven *Load* nodes, *BL Plan*,
  *DFS Balance (BL)*, *Run Ledger Row (BL)* and *Reserve Run Ledger (BL)*.
  The AI visibility request one second earlier (620 → 623) passed only because its row 90 was written `done` at 19:29:37.850, before
  623 read the ledger at 19:29:38.471. The outcome depends on timing, not on any rule.
- **Root cause:** [confirmed in code]
  - `n8n/seo-agent/v5/code/_run_guard.js:35-40` (`liveRuns`) keeps every `reserved` row except the run's own `run_id`.
  - `_run_guard.js:68-69` refuses when `live.find(r => S(r.mode) === mode && mode)`. **The parent is matched by `mode` alone.**
  - The front-door row and the monitor row both carry `mode: "backlinks"`:
    - main: `v5/code/Run_Ledger_Row.js:8`, `mode: String(d.mode)`, `run_id: $execution.id` (622);
    - monitor: `v5/code/Monitor_Ledger_Row.js:31`, `key: 'schedule:' + MODE`, `mode: MODE`, `run_id: $execution.id` (624).
  - Nothing tells the child which row is its parent. `v5/code/Monitor_Start.js:4` passes `request_id: d.request_id || $execution.id`.
    That is the API execution id **621**, not the main workflow's own id **622**, which is the parent row's `run_id`. Neither ledger row
    stores a request id.
  - The gate is called from `LEDGER_RESUME_JS`, `n8n/seo-agent/ladder_common.py:409-427` (`RG.gate({ rows, mine, mode: '__MODE__', …
    run_id: String($execution.id) })` at 422).
  - The spawn order is in `n8n/seo-agent/build_v4.py:1785-1796`: *Monitor Start* → *AI Visibility Run?* → *Start AI Visibility* /
    *Start Backlink Monitor* (`waitForSubWorkflow: False`) → *Monitor Started* → … The front door's settle comes after the spawn.
  - The refusal branch has no customer output. *Run Allowed? (…)* false → *Refuse Run Ledger (…)* (`ladder_common.py:563-579`) → then
    only the settle / alert-retry chain. No callback node is reached, so the refusal text never leaves n8n.
- **Same cause elsewhere:**
  - Every API-started monitor whose front-door row has the same `mode` as the monitor row: `ai_visibility` (620 → 623, passed by 0.6
    s) and `backlinks`.
  - Not affected: `track` (Site Tracker mode `site_tracker`), the Link Builder API (`SEOagentLinkBAPI` writes no ledger row, exec 627),
    the Audit Scheduler (mode `audit_schedule` against the audit's `audit`), the Content Cadence (spawns content runs under `cadence:`
    keys).
  - The gate is inlined into all ten scheduled workflows. Rule 1 is correct for two *scheduled* runs of the same monitor; it is wrong
    only for the parent → child pair.
- **Correct behaviour:**
  - The child recognises its parent by identity. The front door passes `parent_run_id: $execution.id` (622) in *Monitor Start*'s
    payload; the gate excludes `run_id === parent_run_id`.
  - Also settle the parent row as handed off: status `done`, $0, plus a field naming the child run, so the money sits on one row (see
    R81).
  - A refusal of an on-demand run posts a callback with the refusal reason, so the app ends the run with that reason instead of waiting
    three hours.
  - A real second backlinks run of the same site, with a different parent, must still be refused.
- **Acceptance test:**
  - (a) Offline: replay harness file `After_Run_Ledger_BL_.js` on `exec-624.json`'s runData, adding `parent_run_id: "622"` to the
    *Manual Run* item.
    - Expect `allowed`.
    - Replay again with an extra `reserved` row `{run_id: "999", mode: "backlinks"}` in *Load Open Runs (BL)*: still refused
      `same_mode`.
    - Same pair for `After_Run_Ledger_AI_.js` on `exec-623.json`.
  - (b) Live: start `backlinks` (full) through the API front door with nothing else running.
    - Expect three executions, a `backlinks` report for that request id, and one ledger row carrying the money.
    - Then start two `backlinks` runs through the Test Runner at the same moment: exactly one is refused, and that refusal reaches the
      company's callback as a report.
- **Related:** R81 (the same front-door row is also counted as $0.50 of spend), R96 (the refused run took 5 min 33 s), R104 (app side of
  scheduled vs on-demand).
- **Watch out:**
  - Do not "fix" this by settling the front-door row earlier or adding a delay. The child would still have no way to tell its parent
    from a genuine twin.
  - `request_id` (621) is the API execution, not the parent row's `run_id` (622). Matching on `request_id` would need it stored on the
    ledger row first.

### R78 (C-2) — The weekly site report compares a full report with a technical audit, and a full backlink snapshot with a free one

- **Severity:** High (unchanged). Two wrong changes are printed to the customer.
- **Feature / run:** Site Tracker on demand, exec 633 → 634. The same block is in every scheduled weekly site report.
- **What the customer sees:** report `site_tracker` 19:49:29, "Weekly site report · techand.ai", section "AI search, backlinks and
  technical health":
  - *"Technical audit (2026-10-15) | health 70/100 ▼13 (Needs Improvement) · 0 critical, 17 high, 22 medium · 47 pages crawled"*
  - *"Backlinks (2026-10-15, full) | 18 referring domains ▲18 · 0 new / 0 lost · spam score 63"*

  Artefact: `files/C-site-634-report.txt`.
- **Evidence:**
  - `seo_audits`: newest row `aud_mv9x4zz1i6i`, `report_type: full`, `health_score 70`, `high 17`, 19:15:18. The row before it is
    `aud_mv9wujhkclv`, `report_type: site_audit`, `health_score 83`, 19:07:10. Both are 2026-10-15.
  - `seo_backlink_snapshots`: newest row 2026-10-15T19:40:42, `mode: full`, `referring_domains 18`. The row before it is
    2026-10-14T17:54:57, `mode: free`, `referring_domains 0`; a free snapshot never reads DataForSEO.
  - So "▼13" is 83 → 70 across report types, and "▲18" is 0 → 18 across snapshot modes. Today's technical audit was 83 and so was the
    one before it. Referring domains were 18 at the last full snapshot (2026-10-14 16:18) and 18 now.
- **Root cause:** [confirmed in code]
  - `n8n/seo-agent/v5/code/Site_Report.js:73`, `latest2(name)`, takes the two newest rows of a table for the site, **of any type /
    mode**.
  - Line 74 applies it to *Load AI Visibility (Site)*, *Load Backlink Snapshots (Site)* and *Load Audits (Site)*.
  - Lines 78-80 print `dp(cur, prev)` between those two rows. Line 80 also labels every audit "Technical audit", whatever its
    `report_type`.
  - Harness file: `Site_Report.js`.
- **Same cause elsewhere:** line 78 compares the two newest `seo_ai_visibility` rows the same way. An on-demand full run (6 engines,
  Claude included) can follow a weekly one. This run showed 0 → 0, so nothing visible. The AI tracker's own report does test like for
  like (`AI_Metrics.js`); this summary does not. The app dashboards were not checked for the same pattern (executor D's area).
- **Correct behaviour:**
  - Audit row: compare the newest `site_audit` with the previous `site_audit` only, and the newest `full` with the previous `full` (or
    print them on separate lines). Label each by its type.
  - Backlinks row: compare `full` / `light` snapshots only with the last snapshot that read the same sources. A `free` snapshot is never
    a baseline for DataForSEO counts; with no like-for-like baseline, print no delta.
  - AI row: compare only rows with the same engine set and panel (the rule `AI_Metrics.js` already uses), or print no delta.
- **Acceptance test:**
  - (a) Offline: replay `Site_Report.js` on `exec-634.json`. Expect "Technical audit (2026-10-15) … health 83/100" with no arrow (83 →
    83). The full report is not shown as "Technical audit", and if shown, it is compared with the 2026-10-14 full report (69 → 70).
    Expect "18 referring domains" with no ▲.
  - (b) Live: one Site Tracker run after a day with a technical audit, a full report and a `free_only` backlink check. No arrow joins two
    different types or modes.
- **Related:** the 2026-10-14 annotation-feed fix for the same cross-type comparison (this block was not covered).
- **Watch out:**
  - Sort order uses `checked_at || audited_at`, compared as strings — fine. Filter by type before taking the two newest rows, not
    after.
  - A site that has only ever had free snapshots must show no delta, not "0".

### R94 (C-18) — Five of the ten schedules have never fired on their own; the rest fire late; a restart throws a due fire away

- **Severity:** High (unchanged).
- **Feature / run:** all ten scheduled workflows. Read-only; no run.
- **What the customer sees:** the weekly reports promised for Monday do not arrive.
  - In the 21 days to 2026-10-15 there were 8 due fires for Rank Tracker, Site Tracker, AI Growth, Content Cadence and Link Builder
    together; 0 fired. Every one of their executions is `integrated`, i.e. started by the Test Runner or another workflow.
  - AI Visibility and Backlinks each fired 1 of 2 (26 min and 4 h 50 min late).
  - The AI Pulse fired 6 of 7, every one late (18 min – 10 h 6 min).
  - Page Watch fired 2 of 3 on time, 1 late (137 min).
- **Evidence:** `files/C-schedule-table.json` (due vs fired, per workflow), `files/C-schedules-workflows.json` (triggers, staticData,
  every execution by mode), `files/C-schedule-simulation.json`, `files/C-pmset-intervals.json`, plus the n8n `workflow_publish_history`
  and `execution_entity` tables (read-only) and the container's docker logs.
  - Crons as deployed: AI Visibility Mon 07:00, Backlinks 07:30, Rank Tracker 08:00, Site Tracker 09:00, AI Growth 09:30, Cadence
    10:00, Link Builder 11:00 (all `{field: weeks, weeksInterval: 1, triggerAtDay: [1]}`); Audit Scheduler `0 6 1 * *`; AI Pulse
    `30 6 * * 0,2-6`; Page Watch `days, 1, 05:45`.
  - `GENERIC_TIMEZONE` is unset (`printenv` exit 1) and no workflow sets `settings.timezone`, so America/New_York applies. Confirmed
    by the trigger output "Timezone: America/New_York (UTC-04:00)" (execs 593, 449, 451).
- **Root cause — established** [confirmed in code / logs]:
  1. **Static data cannot suppress these fires.**
     - n8n `n8n-nodes-base/dist/nodes/Schedule/GenericFunctions.js:265-267`: a weekly interval of size 1 gets `recurrence =
       {activated: false}`.
     - Lines 83-84: `recurrenceCheck` returns true at once when `!recurrence.activated`.
     - Lines 189-192: the cron is `"<s> <m> <h> * * 1"`.
     - Every workflow's staticData is `{"recurrenceRules":[null],"recurrenceRuleSignatures":[null]}`.
  2. **A fire lives only in memory, and a restart re-arms it for the next future time.**
     - `ScheduleTrigger.node.js:532-540` registers the cron on activation.
     - `n8n-core/dist/execution-engine/scheduled-task-manager.js:43-91` builds a `CronJob` (cron@4.4.0).
     - `cron/dist/job.js:158-168`: `start()` computes the timeout to the **next** occurrence and arms one `setTimeout`.
     - The "missed deadline" path (`job.js:210`, threshold 250 ms, line 28) only applies when the computed timeout is negative.
     - A restart never replays a past occurrence. A fire that was due but not yet delivered when n8n stops is lost.
  3. **Restarts are frequent.**
     - The container (created 2026-10-14 15:28) shows 13 "Initializing n8n process" lines: the start plus 12 restarts, each stop
       preceded by "Deregistered all crons".
     - `workflow_publish_history` dates the 2026-10-12 deploys at 06:16, 09:16, 09:53, 16:38, 16:45, 19:30 and 20:20 UTC.
  4. **2026-10-05.** No execution of any workflow ran from 2026-10-04 08:51 to 2026-10-08 00:51 UTC (`execution_entity` ids 210 →
     211). The whole instance was not running. Why is not established: the power log does not reach back that far.
- **Root cause — hypothesis** (strongly supported, not observed directly): **the VM's timers do not advance while the Mac sleeps.**
  Node's `setTimeout` runs on the Linux VM's monotonic clock, and the Docker VM is paused during host sleep. So each fire is late by the
  sleep accumulated since the cron was armed. A model built on that rule, using `pmset -g log` wake intervals and the arming time (last
  restart or last fire), matches the observed fires:

  | Fire | Predicted | Observed |
  |---|---|---|
  | Pulse 2026-10-13 | 10:54 | 10:54:40 |
  | Pulse 2026-10-14 | 14:52 | 14:51:44 |
  | Pulse 2026-10-15 | 11:11 | 11:11:24 |
  | Page Watch 2026-10-14 | 12:02 | 12:02:21 |
  | Page Watch 2026-10-13 / 10-15 | on time | on time |
  | AI Visibility 2026-10-12 | 11:38 | 11:25 |
  | Backlinks 2026-10-12 | 16:33 | 16:19 |

  - It predicts the 2026-10-10 pulse miss.
  - It predicts that the five later Monday fires of 2026-10-12 fell between 17:03 and 21:48, all **after** the 16:38–16:40 deploy
    restart, which re-armed them for 2026-10-19.
  - It does not explain one fire (pulse 2026-10-11 20:36).
- **Same cause elsewhere:** every Schedule Trigger in the instance. The IMAP trigger of Console Alerts is a different mechanism.
- **Correct behaviour:** each weekly run fires within minutes of its due time, and no due run is lost to a restart or to sleep.
- **What a fix inside the product can do:**
  - A **catch-up workflow** started by n8n's own `n8n-nodes-base.n8nTrigger`, event **"Instance Started"** (`value: 'init'`; present
    in this n8n). Add an hourly Schedule sweep as a second entry point, so a fire delayed by sleep is also caught after wake.
    - For each of the ten schedules, compute the most recent due time in the configured timezone.
    - Compare it with that monitor's last run for the site.
    - Start the missed run through its *Manual Run* once, with an idempotency key "<workflow>:<due time>" so restart + sweep cannot
      double-fire.
  - **Deploy guard:** `apply_env.py` restarts n8n. It should warn or refuse inside the Monday window, or start the catch-up right
    after the restart.
  - Set `GENERIC_TIMEZONE` explicitly, so due times are a decision and not a default.
- **What needs the owner:** an always-on host (a sleeping laptop cannot run daily or weekly jobs on time), and a decision on whether an
  on-demand run in the same week counts as that week's scheduled run.
- **Acceptance test:**
  - (a) Offline: unit-test the catch-up planner on `C-schedules-workflows.json`, using the instance clock and a list of last runs. For
    2026-10-12 it must list Rank Tracker, Site Tracker, AI Growth, Cadence and Link Builder as missed, and nothing as missed for a week
    in which each fired.
  - (b) Live: deactivate and re-activate one weekly workflow just after its due time, or restart n8n just after a due time. The
    catch-up starts it once, a second restart does not start it again, and the ledger shows one run.
- **Related:** R104 (the app's Pipeline / admin view of the same misses), R96, R95.
- **Watch out:**
  - `seo_run_ledger` cannot tell a scheduled run from an on-demand one: `Monitor_Ledger_Row.js:31` writes `key: 'schedule:' + MODE`
    for both, and the ledger only begins 2026-10-12 06:24. Use the execution `mode` (`trigger` vs `integrated`) or add a field.
  - The Monday crons fall at 11:00–15:00 UTC (16:00–20:00 in Pakistan), when the owner's Mac was asleep on 2026-10-12.
  - Do not use `recurrenceRules` / staticData to fix this. It is not involved.

---

# Medium

### R79 (C-3) — One stale ops alert is re-sent to Slack on every monitor run; its row is never updated

- **Severity:** Medium (unchanged).
- **Feature / run:** the alert-retry sweep built into the ten scheduled workflows and the Error Handler. This wave: 623, 624, 626, 628,
  630, 632, 634, 636, 638, 640, plus 643 (twice). Earlier: 592, 593.
- **What the customer sees** (the owner's Slack): 14 posts on 2026-10-15 of *"[high] Undelivered alert, attempt 1 of 10 — SEO Agent —
  Console Alerts … The trigger node "Mailbox Trigger" failed at runtime and was deactivated … this alert has reached nobody."*. Every
  post was accepted, HTTP 200 "ok".
- **Evidence:**
  - Each *Post Alert Retry (…)* posted `seo_ops_alerts` row 4, and each *Save Alert Retry (…)* output `{}`.
  - Row 4 is still `delivered: "failed"`, `attempts: null`, `last_attempt_at: null` (`files/C-ops-alerts-after-errpath.json`).
  - Exact keys:
    - stored (row 4): `SEO Agent — Console Alerts | Mailbox Trigger | the trigger node "x" failed at runtime and was deactivated — the
      imap server closed the connection without reporting an error, usually because the server (or a␠`, **207 characters**, ending in a
      space. Its message part is exactly 160 characters and the 160th is the space.
    - re-sent / update filter (exec 626, *Alert Retry Plan (BL)* `alert_key`): the same text without the final space, **206
      characters**.
- **Root cause:** [confirmed in code]
  - The key is built in `n8n/seo-agent/v5/code/_ops_alert.js:17-18`, `keyOf`. It collapses whitespace and then `.slice(0, 160)` the
    message, with **no trim after the slice**. A slice that ends on a space keeps it.
  - Row 4 was upserted with that key by the Error Handler's *Save Ops Alert* (`build_v4.py:2959`, `dt_upsert_params(…, 'alert_key')`).
  - The retry kit reads keys through `S(...)`, which trims (`_alert_retry.js:24`), and returns `alert_key: S(r.alert_key)` (plan line 98,
    settle line 116).
  - The write-back is a Data Table update filtered on `alert_key eq {{ $json.alert_key }}`:
    - monitors: `ladder_common.py:654`;
    - Error Handler: `build_v4.py:6187`.
  - 206 ≠ 207, so the update matches no row. The row never records the attempt, so it is "due" again on the next run of any monitor.
  - Second defect, same file: the dedupe lookup `_ops_alert.js:33-34` compares `S(r.alert_key)` (trimmed) with the untrimmed new key.
    A repeat sighting of such an error is treated as "first time" and notified again. This is read from the code; it was not observed,
    because the IMAP error did not recur.
  - Error Handler double pass [confirmed in code]: *Alert Delivery* has two inputs, one per IF (`build_v4.py:3890-3891`: *Post Alert
    Webhook* / *Send Webhook?* false, and *Email Ops* / *Send Email?* false). It therefore runs twice per failure, and the retry chain
    behind it (`build_v4.py:6193`) runs twice. Exec 643 re-posted row 4 at 19:59:50 and 19:59:53.
- **Same cause elsewhere:** every workflow carrying the sweep — AI Visibility, AI Pulse, Backlinks, Link Builder, Rank Tracker, Site
  Tracker, Content Cadence, Page Watch, Audit Scheduler, AI Growth — and the Error Handler. Any alert whose 160-character message slice
  ends in a space is affected. Rows 1–3 and 5 do not end in a space and were updated correctly.
- **Correct behaviour:**
  - The key is trimmed when built: `keyOf(...).trim()`, or trim the message part after the slice.
  - Lookups and update filters use the same normalised key.
  - Row 4's stored key is migrated, by a one-off read-modify-write through the Data Table API.
  - An alert is re-sent at most once per retry interval and stops at `MAX_ATTEMPTS`.
  - The Error Handler runs the retry sweep once per failure: put a merge before *Alert Delivery*, or run the sweep from one branch only.
- **Acceptance test:**
  - (a) Offline:
    - Replay `Alert_Retry_Plan_BL_.js` → `Alert_Retry_Result_BL_.js` on `exec-626.json`. The `alert_key` handed to *Save Alert Retry
      (BL)* must equal the stored key byte for byte (after the key fix and the row-4 migration).
    - Unit-test `keyOf` with a message whose character 160 is a space.
    - Count *Alert Delivery* executions in an Error Handler replay: 1.
  - (b) Live:
    - Run any monitor twice, 5 minutes apart. Row 4 shows `attempts: 1`, `delivered: webhook` after the first run, and Slack receives
      no second post.
    - Then fail one workflow on purpose (the Test Runner with an unknown workflow id): one Slack post for it, and no re-post of older
      rows within the retry interval.
- **Related:** R105 (D-9, the alert record and the delays, app side).
- **Watch out:**
  - Do not trim only in the retry kit. The stored keys keep their trailing space and the upsert in *Save Ops Alert* would then create a
    second row.
  - Migrate or normalise on read in **one** place.

### R80 (C-4) — The Claude cost called "measured" counts every structured answer as the string "[object Object]"

- **Severity:** Medium (unchanged). Same root cause as **R47 (A-14)**. Fix it once.
- **Feature / run:** every Claude agent with an output parser that sits behind the `count_tokens` chain. Seen in this wave in 623 (AI
  Brief, Answer Analyst ×3) and 628 (Outreach Sequence Writer); in executor A's runs in 606, 608, 610, 612, 614, 615 and 616.
- **What the customer sees:**
  - The run's cost on its ledger row and in the callbacks' cost fields:
    - 623: "Claude $0.0678 PARTLY ESTIMATED: $0.0514 measured, $0.0164 estimated (measured: Anthropic /v1/messages/count_tokens counted
      the prompt and the answer of every call…)";
    - 628: "$0.0177 PARTLY ESTIMATED: $0.0097 measured…".
  - n8n's own token counts at list prices give $0.1033 (623) and $0.0326 (628).
- **Evidence:**
  - Every *Prompt For Count (…)* item of a parser-backed agent carries `__answer: "[object Object]"` (15 characters).
  - *Count Answer* minus *Count Prompt* = 5 tokens (4 for Site Describer), in every case:
    - 606 Site Describer 3919 → 3923;
    - 608 / 610 / 615 / 616 Competitor Analyzer and Verdict Agent;
    - 610 Ladder Keyword Relevance;
    - 612 Keyword Seeds, and Keyword Relevance ×3;
    - 614 Content Reviewer;
    - 616 Strategy Brief and Critic;
    - 623 Answer Analyst ×3 and AI Brief 4830 → 4835;
    - 628 Outreach Sequence Writer 4835 → 4840.
  - The two text agents count correctly: Copywriter (616) 12440 → 18631, Editor (616) 10871 → 16060.
  - Compare 623 *Ledger Settle (AI)* `ai_by_node`, *"AI Brief … counted 4830 prompt and 5 answer token(s)"*, with n8n `tokenUsage` 5,609
    in / 1,166 out. Answer Analyst: "15 answer token(s) across 3 call(s)" against 3,351 out.
- **Root cause:** [confirmed in code] the `__answer` field of the *Prompt For Count (…)* Set node is `String(<agent>.output ?? '')`.
  For an agent with a structured output parser, `output` is an **object**, and `String(object)` is `"[object Object]"`. The expression is
  built in three places:
  - `n8n/seo-agent/build_monitors.py:149-150`: `'value': "={{ String($json.output ?? '') }}"` — the monitors' agents.
  - `n8n/seo-agent/build_v4.py:5836-5837`: `String($('<agent>').first().json.output ?? '')` — section 62, the three streaming Opus
    agents. Strategy Brief has a parser, so it is affected; Copywriter and Editor are text, so they are not.
  - `n8n/seo-agent/build_v4.py:7491-7492`: `String($json.output ?? '')` — section 76, the main workflow's non-streaming agents.
- **Every node that sends a structured answer to the counter** (deployed workflows; read from `workflows/*.json`, by *Prompt For Count*
  and an output parser):
  - main `SEOagentV4Full01`: Site Describer, Competitor Analyzer, Strategy Brief, Content Reviewer, Keyword Seeds, Verdict Agent,
    Keyword Relevance, Critic, Ladder Keyword Relevance;
  - `SEOagentAIVisib1`: Prompt Writer, Answer Analyst, AI Brief;
  - `SEOagentBacklnk1`: Link Analyst, Outreach Writer;
  - `SEOagentLinkBld1`: Outreach Sequence Writer;
  - `SEOagentAIGrow1`: AI Outreach Writer.

  That is 16 agents. Counted correctly (text): Copywriter, Editor. **Not counted at all** (cost is the per-mode reservation): Site Brief
  (`SEOagentSiteTrk1`), Reply Reader (`SEOagentReplyRd1`), Keyword Fit (`SEOagentAssess`). See R82 and R47.
- **Correct behaviour:** count the answer the model actually returned: `typeof o === 'string' ? o : JSON.stringify(o)`. Better still, use
  the raw model text where n8n keeps it. Thinking stays modelled, as now.
- **Acceptance test:**
  - (a) Offline: a build-time assertion that no `__answer` expression applies `String(` to an object-valued `output`. A harness check
    taking 623's AI Brief `output` object, serialising it with the new expression, and requiring non-trivial length (> 1,000
    characters here, 2,957 in this run).
  - (b) Live: one AI visibility run. For AI Brief and Answer Analyst, *Count Answer* − *Count Prompt* is within ±15% of n8n's
    completion tokens minus the modelled thinking. The engine's Claude figure for 623-like runs is within ±15% of the `RR claude`
    figure.
- **Related:** R47 (A-14), R82, R115 (D's cost-label finding on monitor callbacks).
- **Watch out:**
  - `JSON.stringify` of the parsed object is close to, but not identical to, the model's raw text: whitespace, code fences, key order.
    Accept a small error or read the raw generation.
  - Answer Analyst answers once per item. Keep the per-item pairing that *After Count* relies on.

### R81 (C-5) — Front-door ledger rows double-count monitor runs; finished runs are named "in flight" in cost notes

- **Severity:** Medium (unchanged).
- **Feature / run:** the main workflow's ledger rows for on-demand monitors (rows 90, 91) and every settle's account check. This wave:
  rows 90–102.
- **What the customer sees:** cost figures in the ledger, the admin views and the callbacks.
  - Row 90 (exec 620, `ai_visibility`): *"DataForSEO $0.9500 ESTIMATED (the per-mode reservation: this branch carries no ledger of its
    own. 4 other run(s) were in flight at the same time (598, 599, 600, 622), … its figure stays the $0.9500 its own tasks
    reported)"*. Row 93 (623) separately settles $0.7794 measured for the same request.
  - Row 91 (622, `backlinks`): $0.50 "ESTIMATED" for a request whose monitor was refused and spent $0.
  - The wave's 13 rows add up to **$2.8924** against **$1.476137** that the DataForSEO account moved.
  - Rows 90, 91, 96, 98, 99, 100 and 101 (and 623's *Ledger Settle (AI)* `dfs_run.basis`) say 4–5 runs "were in flight at the same
    time": 598, 599 and 600 (Keyword Check runs that finished at 19:02), and 624 (refused at 19:29:39).
- **Evidence:** `files/C-run-ledger-rows-90-102.json`; 624 *Load Run Ledger (BL)* shows rows 80–82 (`mode: assess`, `status: done`,
  `settled_at: ""`).
- **Root cause:** [confirmed in code]
  1. Double count:
     - `n8n/seo-agent/v5/code/Run_Ledger_Settle.js:39-48`: when the branch has no run ledger of its own (the monitor modes hand off to
       another workflow), `dfs.usd` falls back to `row.dfs_est_usd`, the per-mode reservation. Basis line 48: "the per-mode reservation:
       this branch carries no ledger of its own".
     - The child monitor writes its own row (`Monitor_Ledger_Row.js:31`). Nothing links the two rows (see R77).
  2. Phantom "in flight", cause A:
     - `n8n/seo-agent/v5/code/_cost_cal.js:469-476` (`dfsRun`, the `open` filter) treats a `done` row with an empty `settled_at` as
       open for ever (line 475: `return !s || …`).
     - The Keyword Check computes `settled_at` (`v5/code/Assess_Ledger_Settle.js:43`), but its Data Table update *Settle Run Ledger
       (Assess)* (`n8n/seo-agent/build_api.py:361-364`) does not map `settled_at` (or `dfs_source`). Every Assess row keeps
       `settled_at: ""`.
  3. Phantom "in flight", cause B: `_cost_cal.js:473`, `if (String(r.status || '') !== 'done') return true;`, treats a `refused` row
     (624, row 92, `settled_at 19:29:39`) as open for ever too.
  4. Effect: every run that day keeps "the cost its own tasks reported" and never reconciles against the account.
- **Same cause elsewhere:**
  - Every main-workflow branch that hands off to a monitor (`ai_visibility`, `backlinks`).
  - Every settle that calls `CC.dfsRun`: the main workflow, all monitors, the Keyword Check.
  - Every day on which a Keyword Check or a refused run happened.
- **Correct behaviour:**
  - The front-door row of a handed-off run settles $0 with a link to the child row, or is not reserved for DataForSEO at all, so each
    request is counted once.
  - *Settle Run Ledger (Assess)* writes `settled_at`.
  - `dfsRun` treats `refused` and `stale` rows as closed at their `settled_at` (or at `created_at` when empty).
- **Acceptance test:**
  - (a) Offline: replay `Ledger_Settle_LB_.js` on `exec-628.json`. With rows 80–82 carrying a `settled_at` and row 92 treated as closed,
    `overlapped` is empty and `dfs_run.attributed` is true (the account moved $0.1338 for 628 + 630 together, so expect "alone: false"
    only because 630 overlapped).
  - (b) Live: one API `ai_visibility` run alone. Only one ledger row carries DataForSEO money, and the day's rows add up to within 3% of
    the balance movement.
- **Related:** R77 (same parent / child pair), R82, R47.
- **Watch out:**
  - Old Assess rows keep `settled_at: ""`. Either backfill `settled_at = updatedAt` or treat `done` + empty `settled_at` as closed at
    `updatedAt`, otherwise today's history keeps poisoning tomorrow's attribution.

### R83 (C-7) — AI visibility tells the customer to pitch businesses that AI names instead of them, and keeps them as link prospects

- **Severity:** Medium (unchanged).
- **Feature / run:** `ai_visibility`, exec 623.
- **What the customer sees:** report "Do this next" (Claude *AI Brief*, from the engine's actions): *"Pitch a guest article or
  comparison mention to wafeq.com, edicomgroup.com and aiverix.ae. — They are cited 15, 12 and 9 times on your topics."* The engine's own
  action list (*AI Metrics* `actions`, type `pr`) reads: "Get featured on wafeq.com" / edicomgroup.com / aiverix.ae / comarch.com — *"A
  guest article, a comparison mention or a quote there feeds the answers directly."*
- **Evidence:**
  - In this run's answers, wafeq.com is named as a recommended alternative in **10** buyer answers, edicomgroup.com in 7, pagero.com in 5,
    comarch.com and aiverix.ae in 4 each (counted from 623 *Apply Analysis* `competitors`).
  - *AI Prospect Rows* upserted 10 `ai_source` prospects. Eight of them are businesses the run's `aliases` map to brands AI names
    (Wafeq, EDICOM, Aiverix, Comarch, Flick Network, Velmont Crest, Pagero, Thomson Reuters).
  - The Link Builder (628) refused wafeq.com as *"a competing site of yours (wafeq.com): a site that outranks you for one of your own
    keywords (#1 for "e invoicing software uae")"*.
  - Fetched pages: wafeq.com/en-ae "Accredited Service Provider · Accreditation #129932"; edicomgroup.com "As a Pre-Approved
    Accredited Service Provider (ASP), EDICOM supports enterprises with e-Invoicing in the UAE".
  - Artefacts: `files/C-aivis-623-metrics.json`, `files/C-aivis-623-report.json`.
- **Root cause:** [confirmed in code]
  - `n8n/seo-agent/v5/code/AI_Metrics.js:95-96` builds the rival list `comp` from the configured competitors plus every business named in
    ≥ 2 answers, **then cuts it to 8** (`.slice(0, 8)`). This run kept cleartax, azentio, tallysolutions, zoho, oracle, microsoft, odoo,
    sap.
  - Lines 115 and 117 exclude only those 8 from "sources AI cites". wafeq.com (named in 10 answers) and the others fall outside the cut,
    so they become sources with `kind: 'site'` (line 28, `kindOf`).
  - They then become `pr` actions, "Get featured on …" (lines 302-303), and `ai_source` prospects (line 321).
- **Same cause elsewhere:**
  - AI Growth's earned-media list (`v5/code/Earned_Media.js`) and the Link Builder take these prospects as input. The Link Builder's
    own competitor check caught wafeq.com; it would not catch a rival that does not outrank the site on a tracked keyword (see R86).
- **Correct behaviour:**
  - Exclude every domain named as an alternative in ≥ 2 answers (the whole `counts` map, plus every domain in `aliases`) from the
    sources / PR list and from the prospects, whatever is shown in the 8-row "Who AI recommends instead" table.
  - Or keep them but label them "a business AI recommends instead of you", with no pitch verb.
- **Acceptance test:**
  - (a) Offline: replay `AI_Metrics.js` on `exec-623.json`. No `pr` action and no `prospect_rows` entry for wafeq.com, edicomgroup.com,
    aiverix.ae, comarch.com, pagero.com, flick.network, velmontcrest.ae; mof.gov.ae / tax.gov.ae stay `official`.
  - (b) Live: the next AI visibility run's "Do this next" names no business from its own "named instead" counts.
- **Related:** R86, R93.
- **Watch out:**
  - The display table must stay at 8 rows. The **exclusion** set must not be the display set.
  - Thomson Reuters appears as `europe.thomsonreuters.com`; compare by registrable domain.

### R84 (C-8) — AI visibility describes its denominators wrongly; AI Overview presence counts a failed request

- **Severity:** Medium (unchanged).
- **Feature / run:** `ai_visibility`, exec 623.
- **What the customer sees** (`files/C-aivis-623-report.txt`):
  - Header: *"8 buyer questions × 6 AI engines · 74 answers counted (41 from the daily pulse)"*.
  - Alert line: *"1 of 47 requests failed this run (2.1%), 0 of 1 answered when they were sent again … The rates below count the 33
    answers that came back."*
  - Lineage: *"74 answers (8 questions × 6 engines)"*.
  - Tile: *"AI Overview 71.4% of searches show one"*.
- **Evidence:**
  - 623 *AI Metrics*: `asked 35, asked_all 42, requests 47, answered 33, samples 74, pulse_samples 41`.
  - 47 requests = 42 buyer requests (7 × 6) + 5 brand. 46 answered; 1 AI Overview error.
  - The rates leave out Claude's 7 answers by design and the 5 brand answers: 33 = 40 buyer answers − 7 Claude.
  - The per-engine table adds up to 21 + 7 + 21 + 7 + 5 + 20 = **81**, and so do the per-question rows (4 × 12 + 3 × 11).
  - The "8" in "8 buyer questions" includes the brand question.
  - AI Overview: 7 requests, 5 answered, 1 with no AI answer, 1 failed: shown on 5/7 = 71.4%; over the requests that answered, 5/6 =
    83.3%.
- **Root cause:** [confirmed in code]
  - `n8n/seo-agent/v5/code/AI_Metrics.js:44-49`: `R` = buyer requests, `MONTHLY` = Claude, `RC` = R minus monthly engines, `ans` = RC
    answered. Line 86: `samples = ans.length + pulseN`. Line 285: the alert text "The rates below count the ' + ans.length + ' answers
    that came back" (presents a deliberate exclusion as non-return).
  - `v5/code/AI_Report.js:19` (header: `m.questions.length + ' buyer questions × ' + engs.length + ' AI engines'`) and line 109 (lineage
    sample `'answers (' + m.questions.length + ' questions × ' + engs.length + ' engines)'`) use all questions and all engines, while
    the count excludes the brand question and Claude.
  - `AI_Metrics.js:110`: `aio_presence = pct(aio.filter(r => r.answered).length, aio.length)` puts the errored request in the
    denominator.
- **Same cause elsewhere:** the AI Pulse report states its own engines correctly (3 engines, 21 answers). Site Report's AI row prints
  only the rate.
- **Correct behaviour:**
  - Say what the 74 are: "74 answers on the 5 weekly engines to the 7 buyer questions (33 this run + 41 from the daily pulse); Claude's
    7 answers are shown per engine and not in the headline; the brand question measures recognition only".
  - The failure line reads "46 of 47 came back", not "33".
  - AI Overview presence = shown / (requests that returned an answer or an explicit "no AI Overview").
- **Acceptance test:**
  - (a) Offline: replay `AI_Metrics.js` + `AI_Report.js` on `exec-623.json`. Header and lineage say 7 buyer questions and 5 weekly
    engines; the alert says 46 of 47; `aio_presence` = 83.3.
  - (b) Live: the next run's numbers add up on the page — headline sample = sum of the per-engine samples it is computed over.
- **Related:** none.
- **Watch out:**
  - Do not put Claude back into the headline to make the numbers match. The like-for-like comparison with last week depends on the
    weekly engine set. Fix the words, not the denominator.

### R86 (C-10) — Direct competitors are treated as link opportunities (Link Builder and Backlink Monitor)

- **Severity:** Medium (unchanged).
- **Feature / run:** Link Builder exec 628; Backlink Monitor exec 626.
- **What the customer sees:**
  - Link Builder report, "Pitches that need your edit before they go out": *"daxin-global.ae | needs you: [Owner: confirm — one-line
    description of our e-invoicing work.]; needs you: [Your name] | Your UAE-compliant e-invoicing features list"*. It is a held draft
    to a firm whose home page lists "Odoo ERP · Microsoft Dynamics 365 · Microsoft Business Central · E-invoicing · Custom ERP
    Development · AI & Process Automation" — the services Tech& sells.
  - qzinfomatics.com ("Microsoft Dynamics 365 Partner in Dubai, UAE") qualified `ready` at fit 0.87. Claude declined it, for weak
    evidence.
  - Backlink report, "Best of" lists: five of eight are vendors' own pages — "Best Dynamics 365 Business Central Partner in UAE - TMR
    Consulting", "Microsoft Dynamics 365 Partner in UAE, ERP & CRM Solutions" (lits.services), "Contact Best Microsoft Dynamics 365
    Partner in the UAE | SQIT", "Microsoft Dynamics 365 Partner in Dubai, UAE - QZ Infomatics", "Microsoft Dynamics 365 Solutions &
    Implementations Partner" (iaxdynamics.com home).
  - Prospect saved: qzinfomatics.com, type `list`, score 33, *"'Microsoft Dynamics 365 Partner in Dubai, UAE | QZ Infomatics' lists
    cleartax.com, not you"*.
- **Evidence:**
  - 628 *LB Assemble* `outreach_rows` (qzinfomatics.com `status ready`, `fit_reason "topic match 87%"`; daxin-global.ae `ready`, 0.84).
  - 628 *LB Draft QA* `verdicts` (daxin held).
  - 626 `lists` and *Prospect Rows*; 626 *Fetch Sources*, searx query "best dynamics 365 partner uae United Arab Emirates".
  - Pages fetched by the Link Builder itself are in 628's *Fetch LB Pages* / *Fetch LB Second*. Artefacts: `files/C-lb-628-report.json`,
    `files/C-bl-626-report.json`.
- **Root cause:**
  1. Link Builder [confirmed in code]: the competitor test judges **only the prospect page**.
     - `n8n/seo-agent/v5/code/LB_Assemble.js:145` calls `OK.sellsSame({ … title: o.page_title, text: t, terms: sellTerms, url, fit })`
       with the blog / article page's text.
     - `v5/code/_outreach_kit.js:124-156`: `rivalOf` matches only declared competitors and SERP rivals (sites outranking the customer on
       a tracked keyword). `sellsSame` needs ≥ 2 vendor phrases (`VENDOR_RE`, line 98) **and** ≥ 45% of the customer's distinct service
       words on that page (line 153) **and** a vendor title or topic ≥ 0.5.
     - With 30 services (48 distinct stems, `LB_Assemble.js:60`), an article rarely reaches 45%.
     - Reproduced from the HTML the Link Builder fetched (my text extraction; the engine's `LK.text` may differ slightly)
       [hypothesis-level numbers]:

       | Page | Service-word share | Vendor phrases |
       |---|---|---|
       | daxin blog | 0.44 | 3 |
       | qzinfomatics Peppol article | 0.56 | 1 |
       | qzinfomatics `/about`, fetched by the same run for contacts | 0.52 | 3 |

     - The about / home pages are read for contacts but never given to the competitor test.
  2. Backlink Monitor [confirmed in code]: `n8n/seo-agent/v5/code/Link_Merge.js:27`, `LISTY`, decides "this is a best-of list" from
     title + URL.
     - `\b(best|top|leading|…)` has no closing boundary, so "topdynamicspartners.com" matches "top", and a vendor's own SEO title
       "Best … Partner – TMR Consulting" or "Contact Best … | SQIT" matches "best".
     - `\d{1,3}\b.*\b(…solutions…)` reads "Dynamics **365** … Solutions" as "Top 10 … solutions".
     - Lines 90-92 put every match in `list_pages`. `Parse_Backlinks.js:183/355` save a `list` prospect when a "list" names a
       competitor.
- **Same cause elsewhere:**
  - `sellsSame` is also used by `Earned_Media.js:72` (AI Growth), `_draft_qa.js:64` (draft gate, title + URL only) and
    `LB_Assemble.js:91, 173, 194`.
  - `LISTY` feeds every Backlink Monitor full run.
- **Correct behaviour:**
  - A prospect whose own site sells the customer's services in the customer's country is a competitor, whatever the prospect page is.
    Judge the home / about page the run already fetched, and lower the share bar for broad-service customers. Or compare against the
    customer's top services on that topic, not all 30.
  - A "best of" list must look like a list of several vendors on the page itself (e.g. ≥ 3 vendor names or list items), not one word in
    a title. Bound the regex (`\b(best|top|…)\b`) and drop the bare-number branch.
- **Acceptance test:**
  - (a) Offline:
    - Replay `LB_Assemble.js` on `exec-628.json`: daxin-global.ae and qzinfomatics.com come out `not_fit` with a "competing provider"
      reason.
    - Replay `Link_Merge.js` on `exec-626.json`: the TMR, LITS, SQIT, QZ and iaxdynamics results are not `list_pages`; StartBiz "Top 10
      Microsoft Dynamics Partners in UAE" and Azdan "20 Microsoft Dynamics Partners in the GCC" stay.
  - (b) Live: the next Link Builder week holds no draft to a business offering Dynamics 365 / e-invoicing implementation in the UAE.
- **Related:** R83, R93; the 2026-10-14 finding on rivals pitched (same shape).
- **Watch out:**
  - Tech&'s service list is 30 items wide (Azure, AI, Dynamics). A share bar computed over all of them is the problem, not the bar's
    value.
  - Do not exempt `ai_source` from the test: that type is where most of today's rivals came from.

### R87 (C-11) — "e invoicing in uae" is set aside and pursued in the same run

- **Severity:** Medium (unchanged).
- **Feature / run:** Rank Tracker exec 632; Content Cadence dry run exec 638.
- **What the customer sees:**
  - Rank Tracker report "[Keyword ladder] e invoicing in uae": *"Set aside (planned before the keyword rule existed, no position
    checked and no page to write): "e invoicing in uae" is not a search this website should target: the results page belongs to
    government sites (tax.gov.ae, mof.gov.ae) (government) — it was planned before this rule existed, so it is set aside instead of
    written"*.
  - In the same report: "Top | e invoicing in uae | not in top 50", and its results-page block (AI Overview, "tax.gov.ae (#1),
    mof.gov.ae (#2) …").
  - *"Next step: Work on rung 1 … "e invoicing uae fta" (a page run was started for it but no page was written — it is written again),
    "accredited service provider for e invoicing in uae" …"*.
  - Cadence dry run queue: "accredited service provider for e invoicing in uae", "uae e invoicing requirements", "e invoicing uae
    2026", "list of asp for e invoicing in uae" — "keyword ladder, rung 1/2 towards "e invoicing in uae"".
- **Evidence:**
  - 632 *Tracker Plan* item 0: keyword "e invoicing in uae", rung 4, desktop — **a paid check** ($0.01). `set_aside_pages: []`.
  - 632 *Tracker Report* `set_aside`: `{keyword: "e invoicing in uae", reason: "government", dropped: true, seen: "this check"}`.
  - 638 *Cadence Plan* `upcoming`.
  - Artefacts: `files/C-rank-632-reports.txt`, `files/C-cadence-638-plan.json`.
- **Root cause:** [confirmed in code]
  - The head had no stored results page, so `Tracker_Plan.js:74-77` (`fitStored`, no SERP) let it through and bought the check.
  - `Tracker_Report.js:122-135` (`fitAside`) re-judged it on **this run's** results page and set it aside (`seen: 'this check'`).
  - The report text at `Tracker_Report.js:265-267` prints "no position checked and no page to write" for **every** set-aside entry,
    including one set aside after its check.
  - Setting the head aside does not stop the ladder. The next step and `asideKw` only remove the head itself, not its rungs.
  - Nothing writes the set-aside back to `seo_ladders`: the Rank Tracker has no update node for it (`build_ladder_extras.py`).
  - The Content Cadence judges each rung only on its own stored results page (`Cadence_Plan.js:106-115`, `serpFor(l.keyword)`), so the
    rungs stay queued.
- **Same cause elsewhere:** any ladder whose head is set aside after its check (government, navigational, other brand). Rung keywords
  of such a ladder ("e invoicing uae fta", "list of asp for e invoicing in uae") were not judged this run. Their own results pages are
  unread, monthly.
- **Correct behaviour:**
  - The text distinguishes "set aside before checking" from "this check showed the page belongs to government sites".
  - A ladder whose head is set aside is paused (or offered for re-plan) everywhere — report next step, cadence queue, ladder row status —
    with the reason.
- **Acceptance test:**
  - (a) Offline:
    - Replay `Tracker_Report.js` on `exec-632.json`: the e-invoicing report says the head was checked and set aside by this check, and
      the next step does not ask for its rungs.
    - Replay `Cadence_Plan.js` with the ladder's head marked set aside: its rungs are not in `upcoming`.
  - (b) Live: the next Rank Tracker + cadence dry run on techand.ai show the ladder paused with the government reason.
- **Related:** R90 (same gate, other-brand case).
- **Watch out:**
  - The owner may still want pages on e-invoicing; set-aside of the head ≠ dropping the topic. Pausing and offering re-plan
    (`_replan.js` exists) is safer than deleting rows.

### R88 (C-12) — Two "page movement" figures for one keyword in one run; identical requests seconds apart disagree

- **Severity:** Medium (unchanged).
- **Feature / run:** Rank Tracker exec 632 (and Site Tracker 634 for the second reading).
- **What the customer sees:**
  - Ladder report "erp implementation dubai": *"3 of top 8 changed (some)"*.
  - "Tracked keywords" report, same keyword, same run: *"5 of top 8 changed (high)"*.
- **Evidence:**
  - `seo_rank_history` has two readings on 2026-10-14: 16:21:47 (`ladder_id lad_mv5pjt5y4aoa`) and 16:31:51 (`ladder_id
    site_techand-ai`, the Site Tracker).
  - It also has two readings 32 s apart on 2026-10-15: 19:48:46 (632) and 19:49:18 (634).
  - Both requests were `location_code 2784, language_code en, desktop, depth 50`, yet they led with different pages:
    - 632: brainsphereit.com #1, euclidz.com #3, erplax.com #4;
    - 634: rvguae.com #1, hlbhamt.com #2, ae.indeed.com #3.
- **Root cause:** [confirmed in code]
  - The ladder report's baseline is `prevRowOf` (`Tracker_Report.js:66`): same `ladder_id` only, so 10-14 16:21.
  - The tracked-keyword block's baseline is `series` (`Tracker_Report.js:335-336`): any reading of the domain, site rows included, so
    10-14 16:31.
  - The same `RS.churn` (`_rank_serp.js:235`) is applied to different baselines. The disagreement between two identical requests is a
    property of the data source [established from the stored readings]. The "still / some / high" label treats every difference
    between two single readings as movement.
- **Same cause elsewhere:** any keyword that is both a ladder head and a customer keyword (here "erp implementation dubai", "peppol
  uae"). The Site Tracker's own SERP checks add readings with `ladder_id = site_id`.
- **Correct behaviour:**
  - One baseline per keyword per run: the latest earlier desktop reading of that keyword for the site, whichever workflow took it. Both
    reports print the same figure.
  - Movement is labelled against the variation that two readings of the same moment show (32 s apart they differed in their top 3), or
    called "one sample against one sample" without a severity word.
- **Acceptance test:**
  - (a) Offline: replay `Tracker_Report.js` on `exec-632.json`. "erp implementation dubai" shows one movement figure in both blocks.
  - (b) Live: run the Rank Tracker and Site Tracker sequentially; the site report and the tracker report agree on movement for shared
    keywords.
- **Related:** none.
- **Watch out:** the Site Tracker reuses a ladder reading taken the same day (the tracked-keyword report says "read from the weekly site
  check"). Keep that reuse; just compare against one baseline.

### R89 (C-13) — The brand / non-brand split counts "tech" as the brand

- **Severity:** Medium (unchanged).
- **Feature / run:** Site Tracker exec 634.
- **What the customer sees:** *"Non-brand (people who did not search your name): 2 clicks from 500 queries (0%) · brand: 5 clicks from
  39 queries (brand = techand, tech)."* The brand top list includes "techandkey com" (308 impressions, the largest) and "technology
  and analytics" (30); other matched queries include "tech and software" and "technology & data".
- **Evidence:** 634 *Parse GSC* → `brand_split.names: ["techand","tech"]`, `brand.top`. Artefact: `files/C-site-634-report.json`.
- **Root cause:** [confirmed in code]
  - `n8n/seo-agent/v5/code/_gsc_queries.js:15`, `squash`, drops every non-alphanumeric character, so "Tech&" → "tech".
  - Line 19 keeps any key of ≥ 4 characters, so "tech" is kept.
  - Line 25 tests `squash(query).includes(key)`, a substring of the query **with its spaces removed**. "technologyandanalytics" contains
    "tech", and "techandkeycom" contains "techand".
  - Brand names come from the site model / monitors (`Parse_GSC.js:58-59`).
- **Same cause elsewhere:**
  - The Site Brief (Claude) receives this split (`Brief_Input.js:12`).
  - The outreach kit already solved the same problem for "Tech&" (`_outreach_kit.js`, `MIN_NAME_RUN = 5`, the 2026-10-12 listings
    fix). `_gsc_queries.js` did not get it.
- **Correct behaviour:**
  - Match brand forms as whole tokens: "techand", "tech&", "tech and", "techand ai". A short stripped form ("tech") is never a key on its
    own.
  - "techandkey" is a different token. Treat it as non-brand unless the owner lists it.
- **Acceptance test:**
  - (a) Offline: replay `Parse_GSC.js` on `exec-634.json`. "technology and analytics", "technology & data", "tech and software" and
    "techandkey com" are non-brand; "techand" and "tech and" stay brand.
  - (b) Live: the next site report's brand count is the owner-recognisable set.
- **Related:** none.
- **Watch out:** "tech and" (spaced) is probably the brand spoken aloud. Keep it via an explicit form, not via substring of "tech".

### R90 (C-14) — "facts erp", another company's brand, is still planned and printed

- **Severity:** Medium (unchanged).
- **Feature / run:** Rank Tracker exec 632; Site Tracker exec 634.
- **What the customer sees:**
  - Ladder report "erp software uae": *"2 | facts erp (not published yet: checked monthly, last 2026-10-11) | not in top 50"*.
  - In the same report: *"Above you: ebrsoftware.com (#1), azdan.com (#2), facts.ae (#3)"*.
  - Site report tracked keywords: "facts erp | ladder rung 2".
- **Evidence:**
  - `seo_ladders`: `lad_mv40b6s9h5a8`, keyword "facts erp", `status planned`, rung 2.
  - `seo_rank_history` for "facts erp": one row, 2026-10-11T16:07, position 0, **empty `snapshot_json` and `competitors_json`** (taken
    before the SERP columns existed).
  - 632 *Parse Positions* for the head "erp software uae": facts.ae #3.
- **Root cause:** [confirmed in code]
  - The other-brand rule needs evidence the stored rung never gets. `_fit_gate.js:127-137` flags "facts erp" if facts.ae is a declared
    competitor, a results-page domain, or a learned AI brand.
  - `Tracker_Plan.js:45-53` gives `fitStored` only `competitors` (declared: cleartax, azentio), `brands: {}` and `protect` — **no
    `serp_domains`**.
  - The rung is deferred monthly (unpublished), so no new results page is bought until about 2026-11-10.
  - `Tracker_Report.js:122-131` judges a rung only on its **own** results page this run (none).
  - The head's results page, which does show facts.ae #3, is never used for the rungs.
  - The Content Cadence uses the same per-rung evidence (`Cadence_Plan.js:106-115`).
- **Same cause elsewhere:** any rung naming a company that appears on the head's results page or in the learned AI brands, but not in
  the declared competitors.
- **Correct behaviour:**
  - The fit context for a ladder's stored rungs includes the domains on the ladder's own stored results pages (head + rungs, recent)
    and the learned AI brands (`seo_cache` `ai_brands:`), so "facts erp" is set aside with "names another company on the results page:
    facts (facts.ae)".
- **Acceptance test:**
  - (a) Offline: replay `Tracker_Plan.js` on `exec-632.json` with the head's 10-15 snapshot in context. "facts erp" goes to
    `set_aside_pages` with reason "other brand" and no check is planned for it.
  - (b) Live: next Rank Tracker report shows "facts erp" set aside; the cadence never queues it.
- **Related:** R87; the 2026-10-14 finding on the same rung (still present). `fix_brand_rungs.py --apply --brand facts.ae` is the owner's
  one-off for this row only.
- **Watch out:** `protect` holds the ladder heads and services. "erp" is generic and must stay unflagged; only the "facts" label counts,
  and only where a product name sits (`leads()`).

### R93 (C-17) — The Link Builder uses a Search Console query as each target page's "title", so the suggested link text is a keyword (severity raised)

- **Severity:** **Medium** (raised from Low). The register called it a wording slip. Re-inspection shows the target-page titles given to
  the writer are search queries, and the anchor hint "title" therefore means an exact-match keyword anchor.
- **Feature / run:** Link Builder exec 628.
- **What the customer sees:**
  - The writer's decline reason: *"Their page names cleartax.com, a competitor, and the offered page ('techandkey com') does not fit the
    topic; weak evidence."* "techandkey com" is a Search Console query, not a page of the site.
  - In the app: the pitch rows carry `anchor_hint: "title"` with these targets. How the app renders the link text was not checked.
  - Separately, the held daxin draft reads "see us at https://www.techand.ai/ as **a option**" (grammar).
- **Evidence:**
  - 628 *LB Plan* `pages`: 13 of 16 target pages have a query as `title`. Examples:
    - `/whywith-techand` → "techandkey com";
    - the PDF-invoices insight → "pdf vs e-invoice uae";
    - the penalties insight → "uae e invoicing penalties";
    - `/dynamics-365-cloud-migration-uae` → "dynamics 365 cloud migration services in uae";
    - `/insights` → "dynamics 365 finance vat compliance uae".
  - 628 *LB Writer Input* `jobs`: 7 of 10 jobs have `anchor_hint: "title"` with such a `target_title` (nrdoshi.ae, invoiceuae.ae and
    dptc.ae → "pdf vs e-invoice uae"; trustbill.ae → "uae e invoicing penalties"; goroute.ai, lumeafinance.com, qzinfomatics.com).
- **Root cause:** [confirmed in code]
  - `n8n/seo-agent/v5/code/LB_Plan.js:95` adds the top Search Console pages with `addPage(q.page, q.query, q.query, 'page')`: the first
    query row of the page becomes both its **title** and its keyword. The real title is in the page inventory (`seo_pages`, loaded by
    the run) and is not used.
  - `v5/code/LB_Writer_Input.js:10, 25` passes that `title` as `target_title`.
  - `v5/code/_outreach_kit.js:64` sets `anchor: … ? 'brand' : 'title'`.
  - "as a option" is model output (Claude Sonnet, *Outreach Sequence Writer*). The draft gate does not check grammar [confirmed by
    reading `_draft_qa.js`'s checks].
- **Same cause elsewhere:** every Link Builder target taken from Search Console pages. Ladder / AI / log pages get their keyword as
  title (`LB_Plan.js:92-94`), which is also a keyword.
- **Correct behaviour:**
  - A target page's title is the page's real `<title>` / H1, from `seo_pages` or the site model.
  - The anchor hint "title" means that title.
  - Queries stay as the page's evidence ("ranks #7.9 for …"), never as its name.
- **Acceptance test:**
  - (a) Offline: replay `LB_Plan.js` + `LB_Writer_Input.js` on `exec-628.json`. Every `target_title` equals the page title in *Load
    Pages* / the site model (e.g. "Your current PDF invoices will be illegal in the UAE by 2027…"); none equals a query.
  - (b) Live: the next Link Builder week's drafts and pitch rows name pages by their titles.
- **Related:** R86, R83.
- **Watch out:** `/whywith-techand` ranks #7.9 for "techandkey com", which may be another company's brand. Even as evidence, that query
  says nothing about the page's topic, so prefer topical queries.

---

# Low

### R82 (C-6) — Several monitor costs are not measured; the audit's cost list misses its first GBP lookups (re-described)

- **Severity:** Low (unchanged). The audit part is **re-described**: the crawl estimate was right.
- **Feature / run:** Site Tracker 634, Link Builder 628, AI Pulse 630, Audit Scheduler's audit 641.
- **What the customer sees** (ledger rows / cost notes):
  - Site Tracker (row 98): *"DataForSEO $0.0100 ESTIMATED (this workflow reports no cost of its own …)"*. Its tasks reported $0.0310
    (Google Trends $0.011 + 2 SERP checks $0.02), and the account moved ≈ $0.031.
  - Site Tracker Claude: $0.03 "ESTIMATED (the per-mode reservation: 1 model node(s) ran (Site Brief) and this branch prices no call of
    its own)". n8n measured $0.0352.
  - Link Builder (row 96): $0.05 "ESTIMATED". Its *Run LB DFS* tasks reported $0.0498, which matches the account, by coincidence.
  - AI Pulse (row 95): Claude $0.004 "ESTIMATED (the per-mode reservation: this branch priced no model call of its own)". The pulse has
    no Claude node.
  - Audit 641 (row 102): $0.0265 = crawl $0.0211 (estimated) + "Fetch GBP (Retry)" $0.0054. The account moved **$0.03735**.
- **Evidence:**
  - Sums of every DataForSEO response `cost` per node in `exec-634.json`, `exec-628.json` and `exec-641.json`.
  - 641's *Fetch GBP* answered twice: "Tech& Dubai", 40102 "No Search Results", $0.0054; and "techand Dubai", 20000, $0.0054.
  - *Fetch GBP (Retry)* re-sent "Tech& Dubai": 40102 again, $0.0054.
  - $0.0211 + 3 × $0.0054 = $0.0373, against $0.03735 moved.
- **Root cause:** [confirmed in code]
  - Site Tracker, Content Cadence and Page Watch: `n8n/seo-agent/build_site_tracker.py:22-25` (`ledger_nodes` → `monitor_ledger_js(…,
    '')`) wires **no measured node**. `Monitor_Ledger_Settle.js:102` then uses `row.dfs_est_usd`.
  - Link Builder: `build_monitors.py:718`, `L.run_ledger('link_builder', …)` without `measured=`.
  - Pulse Claude: `v5/code/_cost_cal.js:396-409`, `aiRun`. With `checked = 0` (no Claude node) and no priced figure it falls to
    `reserved`. The rule "no model node ran → $0" only fires when the workflow has model nodes.
  - Site Brief: no `count_tokens` chain for that agent (R80 list).
  - Audit: the run's cost list `__LEDGER_NODES` (base list at `build_v4.py:576`; retry names prepended by section 75,
    `build_v4.py:7311-7316`; generated in harness file `Build_Audit_Report.js`) contains **"Fetch GBP (Retry)" but not "Fetch GBP"**.
    The same holds for "Run Ladder Research" and "Run Reach Requests": their *(Retry)* nodes are listed, their first attempts are not.
  - The 40102 retry: `v5/code/_dfs_retry.js:20-21, 46`. "No Search Results." matches neither `TRANSIENT` nor `PERMANENT`, so it is
    retryable and paid again.
- **Same cause elsewhere:** every main-workflow report builder carrying `__LEDGER_NODES` (Build Word File, Build Full Report, Build Audit
  Report, …); ladder runs (Run Ladder Research, Run Reach Requests — executor A's area); every Data-less monitor ledger.
- **Correct behaviour:**
  - Each workflow sums the `cost` its own DataForSEO tasks reported. Site Tracker: SERP Check (Site) + Google Trends. Link Builder: Run
    LB DFS.
  - No Claude charge without a Claude node.
  - Every paid node and its retry are in the cost list, counted once by task id (the existing `__dfsOnce`).
  - 40102 "No Search Results" is a final answer, not retried.
- **Acceptance test:**
  - (a) Offline:
    - Replay `Ledger_Settle_Site_.js` on `exec-634.json`: DataForSEO $0.031 measured.
    - `Ledger_Settle_LB_.js` on `exec-628.json`: $0.0498 measured.
    - `Pulse__…Ledger Settle` on `exec-630.json`: Claude $0.
    - `Build_Audit_Report.js` on `exec-641.json`: `dataforseo_usd` $0.0373 (crawl $0.0211 + GBP $0.0162).
  - (b) Live: one run of each with nothing else spending. Each ledger figure within 3% of the balance movement.
- **Related:** R80, R81, R47, R115.
- **Watch out:** the crawl's pro-rata estimate ($0.00045 a page) matched here. Do not "correct" it upwards from this run's total.

### R85 (C-9) — The AI search-volume lookup failed twice and the report does not say so

- **Severity:** Low (unchanged).
- **Feature / run:** `ai_visibility`, exec 623.
- **What the customer sees:** volumes print "—" everywhere. Lineage: *"AI searches per month per question | the DataForSEO AI-answer
  database | … | 0 questions with a volume | estimated"*. The failure line counts only the 47 answer requests.
- **Evidence:**
  - 623 *Run Discovery* item 3 (`ai_optimization/ai_keyword_data/keywords_search_volume/live`): HTTP 500 wrapping task status 50000
    "Internal Error.", 50.03 s.
  - *Run Discovery (Retry)* item 2: the same, 50.04 s.
  - Together these explain most of the run's 6 minutes (2.1 on 2026-10-14).
- **Root cause:** [confirmed in code]
  - `n8n/seo-agent/v5/code/Prompt_Rows.js:16` skips a failed volume task silently: `if (t.status_code !== 20000) return;`.
  - `AI_Metrics.js:54-57` builds `errors_list` from the answer requests only.
- **Same cause elsewhere:** the LLM-mentions discovery requests share the path (one of them failed and was answered on the retry this
  run).
- **Correct behaviour:** when the volume lookup fails, the report says "AI search volume could not be read this run (DataForSEO failed
  twice)" beside the "—", and the lineage row says "not read" rather than "0 questions with a volume".
- **Acceptance test:**
  - (a) Offline: replay `Prompt_Rows.js` + `AI_Metrics.js` + `AI_Report.js` on `exec-623.json`. The report carries the failure sentence.
  - (b) Live: not needed beyond (a). The provider failure cannot be forced.
- **Related:** R84.
- **Watch out:** the stored question volumes are 0 for all eight questions (*AI Plan* `prompts[].volume: 0`). Make sure "0 stored" and
  "not read" stay distinguishable.

### R91 (C-15) — Ladder report subjects say "top 100", the body and the checks say "top 50"

- **Severity:** Low (unchanged).
- **Feature / run:** Rank Tracker exec 632.
- **What the customer sees:** subject *"[Keyword ladder] e invoicing in uae — techand.ai: top page not yet in the top 100"*; body
  *"Position check … (9 keywords, Google top 50)"* and every cell "not in top 50".
- **Evidence:** 632 *Tracker Report* subjects and HTML; `files/C-rank-632-reports.txt`.
- **Root cause:** [confirmed in code]
  - `n8n/seo-agent/v5/code/Tracker_Report.js:267`: the subject hard-codes `'top page not yet in the top 100'`.
  - The requests are `depth: 50` (`Tracker_Plan.js:57`).
- **Same cause elsewhere:** every ladder report subject.
- **Correct behaviour:** "not yet in the top 50", taken from the depth actually requested.
- **Acceptance test:** (a) replay `Tracker_Report.js` on `exec-632.json`: subjects say "top 50". (b) next live report.
- **Related:** none.
- **Watch out:** DataForSEO's `results` count (90–133) includes SERP features. Do not derive depth from it.

### R92 (C-16) — Smaller inconsistencies the customer sees (one part re-described)

- **Severity:** Low (unchanged).
- **Feature / run:** Backlinks 626, Site Tracker 634, Page Watch 636, AI Growth tables.
- **What the customer sees and the root cause, part by part:**
  1. **Backlink anchor block** — *"web address 50% · image / empty 50% — over 2 referring site(s), with 1 link-farm site(s) left out of
     both the percentages and the table below"*. The table below lists exactly two rows, both farm anchors ("High Quality Dofollow
     Backlinks DA 50 PA 40 Premium PBN Network Service techand." 17 referring domains; "techand.ai" 1), each marked "link farm, set
     aside".
     - [confirmed in code] `v5/code/Parse_Backlinks.js:291-295`: the percentages and `set_aside` come from the ledger's **own-check
       live rows** (3 rows, 1 farm). `top` is DataForSEO's **index** anchor table, with farms only flagged.
     - `BL_Report.js:89` then says the farms are out of the table.
     - Correct: one population. Either drop `farm` rows from `top`, or say "marked" and count the farm domains the table shows (17).
  2. **Pages table has two "/" rows** (14 clicks and 3 clicks) — Search Console returns both `https://techand.ai/` and
     `https://www.techand.ai/` for the domain property.
     - [confirmed in code] `Parse_GSC.js:68` keys pages by full URL; `Site_Report.js:134` prints paths.
     - Correct: merge host variants (the canonical host is in the site model).
  3. **"across 10 countrys"** — [confirmed in code] `Site_Metrics.js:267` pluralises with `unit + 's'`. Correct: "countries".
  4. **Contradictory status of the peppol main page** — site report *"/peppol-uae/ | top | writing | no page was written yet"*; Rank
     Tracker *"The main page is live: improve the main page … /insights/top-peppol-e-invoicing-software-features-every-uae-cfo-must-look-for"*.
     - [confirmed in code] `Site_Metrics.js:84` reads only the ladder row (`status: writing`, no content-log row).
     - `Tracker_Report.js:139-142, 164` match the head to the page inventory (`SM.matchPage`).
     - Correct: one rule in both. A ladder target covered by an existing live page is reported as that page.
  5. **Page Watch watches menu fragments** — `/industries#bfsi` and `/capabilities#ai` take 2 of the 25 slots and are inspected as "URL
     is unknown to Google".
     - [confirmed in code] `Watch_Plan.js:42` takes `model.nav_pages` URLs as they are.
     - Correct: strip `#…` and de-duplicate against the page without the fragment.
  6. **`seo_ai_pages` stores pages under both hosts** — **re-described:** the 17 bare-host rows (`https://techand.ai/…`) were written
     2026-10-10 / 10-11. Every row checked since 2026-10-12 is under `https://www.techand.ai/…`.
     - [confirmed in code] the upsert key is `['site_id', 'url']` (`build_monitors.py:602`) with no host normalisation, so the old rows
       stay.
     - Correct: normalise the URL in the key and drop or merge the stale rows.
- **Evidence:** `files/C-bl-626-report.json` (`anchors`), `files/C-site-634-report.txt`, `files/C-rank-632-reports.txt`,
  `files/C-watch-636-compare.json`, `files/C-aigrowth-tables.json`.
- **Acceptance test:**
  - (a) Replay `Parse_Backlinks.js` / `BL_Report.js` on `exec-626.json`, `Site_Metrics.js` / `Site_Report.js` on `exec-634.json`, and
    `Watch_Plan.js` on `exec-636.json`, each part as above.
  - (b) Next live run of each.
- **Related:** R88 (same peppol keyword).
- **Watch out:** part 4 is two workflows each right by its own data. Decide which source wins (the page inventory is newer and
  observed).

### R95 (C-19) — A same-day on-demand pulse replaces that day's scheduled reading

- **Severity:** Low (unchanged).
- **Feature / run:** AI Pulse exec 630 (on demand) after exec 593 (scheduled, 11:11 UTC).
- **What the customer sees:**
  - `seo_ai_daily` keeps only the 19:42 sample for 2026-10-15 (row 8, `checked_at 2026-10-15T19:42:55.988Z`). The weekly AI figures
    count that day once, with the later sample.
  - The scheduled 11:11 reading sent no callback (*Pulse Alerts* `{skip: true}`, by design: "Quiet days send nothing"), so the app never
    saw it either.
- **Evidence:** `seo_ai_daily` rows; 593 *Pulse Alerts*; `files/C-pulse-630-metrics.json`.
- **Root cause:** [confirmed in code] `n8n/seo-agent/build_monitors.py:399`, *Save AI Daily*, upserts on `['site_id', 'date']`. The
  answers themselves are kept (*Prune Pulse Answers* deletes only `run_kind = pulse` older than 35 days, line 400).
- **Same cause elsewhere:** none.
- **Correct behaviour:**
  - Either an on-demand pulse is stored apart (a `run_kind` column in the key, or its own table), or the day row merges both samples
    (sum of asked / answered / mentioned).
  - The scheduled reading is never lost.
- **Acceptance test:**
  - (a) Replay *AI Daily Rows* for 593 then 630. Two rows, or one merged row with 42 answers.
  - (b) Live: one on-demand pulse on a day the scheduled one ran. Both readings counted in the next weekly AI figure.
- **Related:** R94 (the scheduled pulse is itself late or missing on most days).
- **Watch out:** the weekly AI visibility run reads `seo_ai_daily` as one row per day (`pulse_rows`). A second row per day changes its
  arithmetic; update `AI_Metrics.js`'s pulse summation with it.

### R96 (C-20) — A refused run takes 5 min 33 s to do nothing (cause: hypothesis)

- **Severity:** Low (unchanged).
- **Feature / run:** Backlink Monitor exec 624, refused (R77).
- **What the customer sees:** nothing directly. The run occupies n8n for 5 min 33 s, and *Ledger Settle (BL)* runs only at 19:34:56.
- **Evidence:**
  - 624 *DFS Balance End (BL)* started 19:29:39.952 and finished 19:34:55.021 (315,069 ms).
  - Its response says `"time": "0.0694 sec."`, status 20000.
  - Node settings: `timeout 15000`, `retryOnFail`, `maxTries 3`, `waitBetweenTries 5000`. The node can account for at most ≈ 55 s.
  - Concurrent run 623 sent DataForSEO requests without pause from 19:29:39.389 (*Run Discovery*, 156.8 s) to 19:34:54.631 (*Run AI
    Retries* ends). 624's balance read started 0.6 s after 623's first and ended 0.4 s after 623's last.
- **Root cause:**
  - [hypothesis] the request waited behind 623's DataForSEO calls before it was sent or answered. The per-request 15 s timeout never
    fired, which suggests it sat in a client-side queue (no socket yet) rather than on the wire; a per-account concurrency limit at
    DataForSEO is the alternative. Neither is established.
  - [confirmed in code] the refusal path does not need this call: *Refuse Run Ledger* → *DFS Balance End* → *Load Run Ledger* → *Ledger
    Settle* → *Settle Run Ledger* (`ladder_common.py:563-584`, loose ends wired into the settle). The settle's update filters on
    `status = reserved` (`build_monitors.py:239`, `build_site_tracker.py:31`), which a refused row no longer is, so nothing is written.
    Its output (`dfs_usd 0.45 estimated`, `status done`) is computed and dropped.
- **Same cause elsewhere:**
  - Every refused run of the ten scheduled workflows (same wiring).
  - If the queueing hypothesis holds, any paid or free DataForSEO call made while another run is busy with long DataForSEO requests.
- **Correct behaviour:** a refused run ends straight after *Refuse Run Ledger* (no balance read, no settle), in seconds.
- **Acceptance test:**
  - (a) Offline: a wiring check — from *Refuse Run Ledger (…)* no path reaches a DataForSEO node.
  - (b) Live: two backlinks runs at once. The refused one ends in < 10 s.
  - To test the hypothesis: during a long AI visibility run, time a separate `appendix/user_data` call from inside the container (node
    fetch). If it returns in < 1 s, the queue is n8n-side.
- **Related:** R77, R94.
- **Watch out:** the settle's computed `dfs_usd 0.45` on a refused run is a latent wrong figure, harmless only because the update filter
  misses. Do not "fix" the filter to make it write.
