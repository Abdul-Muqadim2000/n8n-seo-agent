# QUEUE: keyword research reads results pages through DataForSEO's normal-priority queue (2026-11-11)

## Why
Since 2026-10-30 DataForSEO's live Google results give every organic result as a `google.com/goto` redirect (SERP_GOTO.md). The site
behind it is recovered from the breadcrumb (SU), but the page address is not, so no two searches could ever be seen sharing a page and
keyword research formed no groups. Measured on the last Trial (execution 12317, devaicon.com): 517 results on 60 pages, **0 exact
addresses** (412 host only, 105 a breadcrumb path).

## Probe (production engine container, 2026-11-11, $0.018)
Ten UAE searches posted twice with `task_post` and collected with `task_get/advanced`:

| Queue | Ready after | Organic results with a redirect | Price per page |
|---|---|---|---|
| normal priority (`priority: 1`) | 86-118 s (10 of 10) | 0 of 89 | $0.0006 |
| high priority (`priority: 2`) | 18-36 s (10 of 10) | 89 of 89 | $0.0012 |

High priority is answered like live and is useless for this. Normal priority gives every exact page.

## What changed
- `_ki_io.js`: `rq.serpPost` (normal priority, the keyword as `tag`, $0.0006), `taskGet`, `collectRound` (20000 + result = ready; 40601 /
  40602 or a failed request = asked again next round; anything else = failed, read live), `exactEnough` (at least half of the top-10
  organic results with their own address). `serpReadings` takes this run's answers before an inexact cache reading when the caller asks
  for exact pages (`need_exact`); the competitors path is unchanged (cache first).
- `KI_Research_SERP_Requests.js`: a stored reading of today counts only when exact; every other top-M page is posted to the queue.
- New nodes: `Research SERP Tasks` -> `Any SERP Tasks?` -> 5 rounds of `Wait For SERP Tasks (n)` (60 s, under n8n's 65-second in-memory
  limit) -> `Get SERP Tasks (n)` (free GET, fixed task_get url, node retry 3 x 5 s) -> `SERP Tasks Check (n)` -> `SERP Tasks Pending (n)?`;
  then `Research SERP Fallback` -> gated `Run Research SERPs Live` (what the queue did not return, read live: scored, not grouped) ->
  `Research SERP Picture` (queue answers, then live, then the old live shape if a caller still sends it). New section
  `results_pages_exact` says how many pages were read without exact addresses ("grouping the searches" in the app).
- `retry_lint.is_free_dfs`: a DataForSEO node whose own fixed url is `/task_get/` or `/tasks_ready` bills nothing and may keep the node
  retry; an expression url is still judged paid. The five rounds are on the in-200 baseline with their reason.
- Found by KIQ-3 and fixed: `KI_Run_Row.js` named the paid answer steps by hand, so the live fallback's money would have been missing from
  the run's cost ($0.2955 reported for $0.4155 spent in the test). The build now refuses a gated Answers node the run row does not name.

## Cost and time
Up to 60 pages: $0.036 instead of $0.12. A page the queue never returns costs $0.0026 (post + live). The run waits about 2 minutes more
(one or two rounds); at most 5 minutes before the fallback. The app's stuck-run watcher treats a waiting execution as alive; the keyword
research estimate of 12 minutes is unchanged.

## Tests
Harness **18819 passed, 0 failed**. KIQ-1..6 (scenarios_ki_e2.js): wiring; the collection classes; normal priority + tag; the queue path
end to end (posted once, collected in round 1, every page exact, groups form, money: queue answers $0.0006 a page, the task_get that
repeats the task's cost never counted, the run's cost equals its paid answers); every page the queue never returns read live and said so;
late pages collected in rounds 2-4 without a second purchase; a failed round asked again; today's exact readings reused, today's live
readings asked again; the cache keeps the exact reading. KIE2-1 counts updated (16 paid, 8 gates), B-A10 ratchet allows the polls.
