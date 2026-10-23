# AI visibility upgrade: where it stopped (2026-10-24) and how to resume

Owner's ask (2026-10-23): full audit of AI visibility + the question panel, R&D against the best competitors, improve it with several
agents, then ship it to production well tested so no customer is affected and running pipelines get the latest.

## State: NOTHING DEPLOYED. Work is on branch `aivis/integration` (worktree `.claude/worktrees/aivis-integ`), head `513878c0` (WIP).
- `feature/seo-agent-v4.5` (what production follows) does NOT contain this work yet. Another session kept committing to it on 2026-10-23
  (head was `457cb609` when integration branched); merge it in again before shipping.
- Production (PROD_STATE.md): AI visibility has never run for any site (dispatcher `plan_only`, AI tables empty), 2 sites (techand.ai,
  devaicon.com). Keep the dispatcher off until this ships, so the first real runs use the corrected code.

## Done (each with its report in `fixes/`)
| Step | Report | Result |
|---|---|---|
| Audits | PROD_STATE.md, ENGINE_AUDIT.md (E1-E22), APP_AUDIT.md (A1-A20), MARKET_RND.md | committed `99fdd055` |
| Wave 1 | F1a (entities: competitor precision 51.7 -> 100%, recall 78.9 -> 98.7%), F1b (one SOV, named vs cited, position, compare_json), F2 (never pay twice, Unicode 64-bit ids, save before analyst), F3 (app deltas, quote, panel states) | merged `8ac79271`, harness 11484/0 |
| Wave 2 | WAVE2_CONTRACTS.md; W2-E1 (answer text, citations, retrieved-not-cited, shopping/ads/local, source types), W2-E2 (clustered ranges 95.3% coverage, SOV set, sentiment, did-it-work, alert rules, repeat pilot), W2-E3 (fan-out gap, engine options, demand ranges, imports, ops leftovers), W2-A (app UX: drill-down, trends, filters, CSV, bulk, rules, uploads, API/MCP, marketing) | merged `2ed297ca`, harness 11732/0, app green |
| Review | REVIEW_ENGINE.md (0 blocker, 1 High), REVIEW_APP.md (0 blocker, 3 High) | |
| Fix round | W2-FIX (leftovers + R-A1 quote), R-ENGINE (all engine findings incl. R-E1 paid re-run) | both merged, `513878c0` |

## Left to do, in order
1. **Harness: 11920 passed, 1 failed** at `513878c0`. The failure is a test regex only: `harness/scenarios_w2fix.js` W2FIX-2 first
   check expects the site condition as `site_id <expr containing ManualRun> ... === '%' ? 'like' : 'eq'`; the generated condition string
   has the operator expression in `condition` and the site in `keyValue`. Print `conds(t)` and adjust the regex (the node itself is right:
   SITE_EQ, 70-120 days, `units_json isNotEmpty`, followed by `Trimmed Units (AI)`). Rebuild is not needed for a scenario-only change.
2. **App fix round (agent R-APP)**: worktree branch `worktree-agent-a93c48d3840cd88e7` (based on `2ed297ca`), report
   `fixes/R-APP.md` when done. It fixes REVIEW_APP R-A2..R-A21 plus: `already_measured` and `open_run` as non-failure states, null SOV
   not shown as 0, sentiment "early reading, not validated", persona/market options labelled preview. If its branch is incomplete, check
   `git log` there and finish from its report / REVIEW_APP.md. Merge it into `aivis/integration` (expect conflicts in app/server
   runs.ts / settings with W2-FIX; R-A11 was already fixed by W2-FIX: keep W2-FIX's `siteAdminMonitorsBody`).
3. Merge the latest `feature/seo-agent-v4.5` into `aivis/integration`; rebuild with real settings
   (`cd n8n/seo-agent && python3 build_v4.py`, n8n/.env is symlinked in the worktree); full harness
   (copy n8n/seo-agent without docs to a scratch dir; `docker run --rm -v <dir>:/s -w /s/harness -e CODE_DIR=/s/harness/code_v4 -e
   OUT_DIR=/s/harness/out --entrypoint node n8nio/n8n:2.41.4 scenarios_v5.js` -> 0 failed); app: typecheck 3 workspaces, tests
   (re-run load timeouts alone), `npm run build -w @seo/web`; `npm run export:payloads` if payloads changed (harness S23).
4. Optional, owner approval (paid): `n8n/seo-agent/live_checks_aivis.py --apply` (~$0.38: ChatGPT/Gemini API fields, persona
   system_message, LLM Mentions endpoints) and `harness/accuracy/eval_sentiment_model.js` (~$0.10, sets SENT.KAPPA.model). Until then
   persona context + market trend stay off/preview and sentiment says "early reading, not validated".
5. Commit + push `aivis/integration`, fast-forward `feature/seo-agent-v4.5`, push; `git push origin feature/seo-agent-v4.5:main` (Vercel
   deploys web) ONLY together with the API deploy (REVIEW_APP R-A9: check the fixer made both deploy orders safe).
6. Deploy (window: avoid 09:40-10:40 UTC; nothing in flight per the deploy guard): backup (`deploy/gcp/backup.sh` / RUNBOOK), engine FIRST
   `deploy/gcp/tunnel.sh` + `python3 deploy/gcp/deploy_engine.py --apply --create-missing` (new: SEOagentAIPilot1, SEOagentAIPilAPI;
   sync_tables adds ~40 columns; it DEACTIVATES the unauthenticated test receiver SEOagentCallback), then the API on the VM (pull +
   `up -d --build app`), then web (main). Smoke: app health, AI page loads for both sites, Site Admin `monitors` save round-trip.
7. Owner notes to pass on: `dfs_budget_usd` $15/day now binds large on-demand panels (200 q ~ $10); Sentiment Reader adds ~$0.10/month
   per site at today's panel sizes (bounded 40 calls/run); answer text kept 35 days (pulse 7); then switch the dispatcher to `start`.
8. Update CLAUDE.md status + memory, then a re-rating of area 8 against MARKET_RND.md.
