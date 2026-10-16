# Next wave: the open benchmark rows (FIX_PLAN §3.16) and the last leftovers

Written 2026-10-16 for a NEW chat that orchestrates parallel fixer agents. State at hand-over: branch `feature/seo-agent-v4.5`, tip
`30104ac` or later, pushed, tree clean; harness **6139 passed, 0 failed**; app typecheck clean, 301 shared / 305 server tests; everything
deployed 2026-10-16 18:30 UTC. Every re-rating defect R34–R119 is fixed (FIX_PLAN §3.17 has no open row; `LIVE_CHECK_fixes.md` holds the
live evidence). What is left is **product gaps against the market leaders** (§3.16), not bugs.

## 1. What to build (28 rows in reach — no owner decision needed)

Read each row in full in `docs/system-review-2026-10-11/FIX_PLAN.md` §3.16 (title, impact, where, fix) and its area file
`docs/system-review-2026-10-14/BENCH_AREA<n>_*.md` (the benchmark evidence: what the leader does, sources). The row is the spec.

| Agent | Model | Rows | Area | Notes |
|---|---|---|---|---|
| W3-A technical audit | Sonnet | B5-4 hreflang check, B5-6 response-vs-render on every crawled page when the crawl runs with JS, B5-7 CI recipe + threshold + "expected change" list for the pre-release check, B5-12 GA4 key events per page in the impact weight (fallback: today's weight, said so) | 5 | B5-6 is the largest; keep S49 (accuracy set) honest |
| W3-B content quality | **Opus** | B3-4 readability band from the competitor pages' own Flesch, B3-6 intent alignment (answer position, question headings) for every page type, B3-8 a refresh re-fetches the cited sources and re-checks every figure | 3 (+4 for B3-8) | Content_QA / _sources / _coverage are subtle — first-wave R37 / R43 / R44 live there |
| W3-C rank tracking | **Opus** | B6-6 cannibalisation (both URLs, which one Google prefers), B6-8 a move is the site's own only when it beats the SERP's churn, B6-10 an "outranked" line naming the domain, B6-14 share of voice weighted by Search Console impressions (default; say so) | 6 | Tracker_Plan / Tracker_Report / _rank_serp |
| W3-D site tracking / Search Console | Sonnet | B7-4 Discover + Google News search types, B7-5 content groups (one regex per group), B7-6 brand series in one place, B7-7 the owner's dated notes as chart marks, B7-8 a "since the report window" line for the last 3 days, B3-12 Search Console's generative-AI performance report (if the API exposes it; if not, say so and stop) | 7 (+3) | GSC_Requests / Parse_GSC / Site_Metrics / Site_Report |
| W3-E AI visibility statistics | **Opus** | B8-6 the app shows the per-question range and "too few answers", B8-7 the achievable 95% half-width at the current panel size, B8-8 per-engine change test, B8-9 Holm or Benjamini-Hochberg over the weekly alert rules, B8-10 brand recognition as a count with its denominator | 8 | AI_Metrics / AI_Report / _ai_stats + the app's AI page |
| W3-F AI growth | Sonnet | B9-7 a correction target per wrong claim AI makes, B9-8 readiness fetched a second time as the AI bots, B9-9 one robots.txt matcher kit (AI_Access.js + Growth_Robots.js), B9-10 tell the owner about Bing's AI Performance report; + Growth_Plan.js takes `rival_sources` (leftover from A10) | 9 | AI Growth never submits to Bing / IndexNow in a test: use `dry_run: true` |
| W3-G agent layer | **Opus** | B5-11 a read API (or MCP server) over our own audit data, B3-7 "is this page publishable?" as an endpoint (the deterministic half of the gate) | 12 | Design first, in the app server (auth = the company's API key / session, never cross-company); build once for the product |
| W3-H leftovers + browser pass | Sonnet | see §2 | — | small, one agent |

Rows that are **not** in reach (do not build; list them in the final report as still open): B5-9 (needs D25a), B5-10 (G13), B3-5 (owner:
cost), B3-9 (G17, months of data), B3-11 (O1 / O2), B4-4 (8 weeks of rows), B4-5 / B4-6, B6-11, B6-12, B6-13, B8-11 (G20), B8-12, B7-9,
B7-10, B9-11, B9-12, and the owner decisions B1-8, B1-9, B10-8, B10-9, B10-10, B11-8, B11-9, B11-10.

## 2. Leftovers (W3-H)

- R67's report half: the severity table in Build Full Report / Build Audit Report says when `issue_counts` includes unscored AI-review
  findings ("N AI-review findings are counted here and are not part of the score").
- `v5/code/_page_watch.js` `strip`: decode entities with the shared `v5/code/_entities.js` expression.
- `v5/code/Site_Report.js` `path()`: print the full URL when a page row's host is not the canonical one (`other_host` / `hosts`, R92 part 2).
- `build_v4.py` section 58: the assert expects exactly 4 `serp_rivals: p.serp_rivals` calls in LB Assemble; A10 added a fifth through a
  local alias — make the assert count what is really there.
- App: `app/server/src/routes/admin.ts` ~30 sums only `estimated_cost_usd` (add actual and partial); the usage page shows
  `actualPartialUsd` / `actualPartialRuns` as "search data only"; `run.tsx` `CostLine` uses 3 decimals for partial figures; one line in
  `app/web/CONVENTIONS.md` "Cost figures" about the `partial` source.
- The Reply Reader writes no `seo_run_ledger` row: its Haiku calls are recorded nowhere.
- R107 browser pass: Playwright image `mcr.microsoft.com/playwright:v1.55.0-noble` on the `seo-platform-dev_default` network
  (`http://web:5173`), 375 px: `/tools` with a long unverified domain must not scroll sideways; the verify step's DNS value is ≥ 200 px wide (R106).

## 3. Orchestration rules (every agent's brief must carry these — they are what made the last two waves land)

- **File-ownership map first.** From each row's "Where" and the area file, list the exact files every agent edits; two agents never own
  the same file in one wave. Shared kits belong to exactly one agent. `build_v4.py` / `build_monitors.py` / `build_site_tracker.py` /
  `ladder_common.py` are shared **by named region only**. `Cadence_Plan.js` and `app/server/src/services/cadence.ts` change together.
  If an agent needs a file it does not own, it writes "NEEDS ELSEWHERE" with file:line and the change; the orchestrator routes it.
- **Numbers:** new build sections **112–127** (two per agent: W3-A 112–113, W3-B 114–115, W3-C 116–117, W3-D 118–119, W3-E 120–121,
  W3-F 122–123, W3-G 124–125, W3-H 126–127), placed immediately **before `# 69.`** (69 stays last before `# 9. WRITE`). Harness scenarios
  **S147–S178** (four per agent, same order), appended before `H.report();`, each wrapped in
  `await guard('S<nn> <ids> <name>', …)` so `ONLY_S='^S(147|148)\b'` runs only them.
- **Worktree agents** (`isolation: worktree`): first `git merge feature/seo-agent-v4.5` and prove
  `git merge-base --is-ancestor <tip> HEAD`. Build with `SEO_BUILD_ALLOW_DEFAULTS=1 python3 build_v4.py` (no `n8n/.env` in a worktree),
  check the exit code, all four invariant lints must pass and no `harness/*_baseline.json` may grow.
- **Test once per stage** (owner's request — tokens): write the checks, run only your scenarios on the unfixed build (they must FAIL),
  implement, run your scenarios (PASS), then ONE full run → `0 failed`. Harness:
  `H=/tmp/h_<agent>; docker exec n8n-n8n-1 rm -rf $H && docker cp n8n/seo-agent/harness n8n-n8n-1:$H && docker exec -u root n8n-n8n-1 chown -R node:node $H && docker exec n8n-n8n-1 sh -c "cd $H && CODE_DIR=$H/code_v4 OUT_DIR=$H/out node scenarios_v5.js" | tail -3`.
  Note: S51 P34-5 fails between 00:00 and ~03:00 UTC by design of its fixture — not a regression.
- **App:** `docker run --rm -v "$PWD/app":/app -w /app node:22-bookworm-slim sh -c "npm ci --silent >/dev/null 2>&1; npm run typecheck && npm test"`.
  A schema change → `npm run db:generate` in `server/` (migrations run at server start; the next free number is 0008).
- **Fixtures** from saved executions are in the main checkout's git-ignored `docs/system-review-2026-10-15/files/` (exec-*.json, read in
  place). The repo is **public**: no e-mails, phone numbers, personal names of third parties or keys in fixtures.
- **Commit** path-scoped on the agent's branch, source only — never `workflows/*.json`, `harness/code_v4/**`, `CHANGES_v3_to_v4.md` or
  generated `harness/*.json` (the orchestrator rebuilds in the main worktree and commits those). Secret-scan every staged diff. Agents
  never push, deploy, run `apply_env.py` / `sync_tables.py`, edit CLAUDE.md / FIX_PLAN.md, or make paid / live calls.
- **Every capability added** gets its marketing-site line (`app/web/src/marketing/content/features.ts`, `changelog.ts`, pages that list it)
  per CLAUDE.md "Business pages follow the product" — real, shipped capabilities only.
- **Reply format:** branch + commits + merge-base proof; per row FIXED / PARTIAL / NOT and the file:line changes; the harness checks with
  fails-before / passes-after counts; full harness + build + lint + app counts; NEEDS ELSEWHERE; claims in the row found wrong; what the
  live check after deploy should look at.

## 4. The orchestrator after each agent

Read the diff against the row; merge one branch at a time (append conflicts in `build_v4.py` / `scenarios_v5.js` are both-sides — keep
both after checking the base is empty); rebuild in the MAIN worktree (it has `n8n/.env`), verify the harness by **exact count** (previous
total + the agent's own); commit the rebuild; secret-scan; push. Update FIX_PLAN §3.16 statuses. Launch the next agent when one finishes
(6–7 at once at most). If an agent stops on a spend limit, resume it with SendMessage — it keeps its work.

## 5. Deploy and live checks

`python3 n8n/seo-agent/apply_env.py` (it refuses Monday 07:00–12:00 New York unless `--force-monday`; never deploy while a weekly run is
due). Check `docker info` first — Docker Desktop stopped by itself once on 2026-10-16 (then `cd n8n && docker compose up -d` and
`docker compose -f app/compose.dev.yml up -d`). Live checks with `n8n/seo-agent/rerate_toolkit.py` (targeted runs only; backlinks free mode
is `"free_only": true`, not `"free"`). DataForSEO balance **$9.13** at hand-over: ask the owner before a day's spend passes $6. Also still
owed from the defect waves (owner approval): one page run (≈ $1.40) to see R37 / R43 live.

## 6. Owner items (unchanged; do not build)

D25a always-on host; DataForSEO top-up; techand.ai business profile + style guide + mailbox; IndexNow key file; rotate the keys pasted in
chat; delete or pause ladder `lad_mv9wshpdy2jf`; `count_on_demand` in `build_catchup.py`; the §3.16 owner rows above.
