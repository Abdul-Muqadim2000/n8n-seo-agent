# F-L handoff — the open Lows and found bugs (re-rating 2026-10-17)

Branch `worktree-agent-a901b598853c34ab7` (merged `feature/seo-agent-v4.5` 7fe504f first). Source only is committed: the generated
`workflows/*.json` and `harness/code_v4/` were built with `--no-env` and are NOT committed — rebuild in the main checkout.
Harness runner used: a throwaway `node:22-bookworm-slim` container per run (`fix-l-harness-<pid>`), never `n8n-n8n-1`.

## Done
| Item | Commit | Proof |
|---|---|---|
| 1 app: pipeline read `seo_pages` by `domain` (no such column) and swallowed the refusal | 54476b6 | `app/server/test/pipelinePages.test.ts` |
| 2 C-9: engine set counts only engines read on both sides; `metrics.rate_period` replaces "the 7 days to" | 701ae41 | SFL1 |

## In progress / not started
- 3 cost (B-8 / A-27 / A-28 / B-9), B-10, B-16, B-18
- 4 Tracker Report scenario C-12 / C-13
- 5 ran-late on Audit Scheduler + Page Watch
- 6 rival prospects (halsimplify.com / tradeshift.com)

## Open (noted, not fixed)
- App `app/shared/src/ai-visibility.ts` `aiSampleRate` still words its measured sample "answers over 7 days" (a weekly projection; the
  metrics row now carries `rate_period` if the app wants to print it).

## Live acceptance after deploy
- 1: Pipeline page of techand.ai — the cadence mirror lists no second page for a search a live `seo_pages` URL answers; server log has no
  "page inventory not read" line.
- 2: next AI visibility run after one where an engine failed every request: `metrics.delta_not_compared` names the engine sets;
  `metrics.rate_period` = "this run on <date> + N daily pulse day(s) since <prev>"; the report lineage prints it.
