# n8n_devaicon — SEO Agent (n8n)

Enterprise SEO automation built as n8n workflows: keyword research, keyword verdicts, long-form content with QA, technical site audits, full SEO reports, AI-visibility checks. Everything lives in `n8n/seo-agent/`; the stack runs locally with Docker Compose from `n8n/`.

## Read first
- `n8n/seo-agent/REVIEW.md` — findings, every change, the live-test log (section 5c), go-live checklist, roadmap.
- `n8n/seo-agent/LADDER_FEATURE_SPEC.md` — the next feature (keyword ladder: choice step, ladder plan, rank tracker, "rank my site for this keyword" mode).
- `n8n/seo-agent/CHANGES_v3_to_v4.md` — generated list of patches applied by the build.
- `n8n/seo-agent/docs/SEO_Agent_v4.2_Developer_Guide.pdf` (+ .html) — developer guide: every workflow and node explained, build/test/deploy, config, data model, API contract, and the live system test with per-run node traces; regenerate with `python3 build_docs.py` (traces in `docs/runs/`).

## Where things live
| What | Where |
|---|---|
| n8n instance | http://localhost:5678 (project id `wo1WpMiHjdduGvfl`), Docker Compose in `n8n/` (`compose.yml` + `compose.override.yml` adds the Gotenberg PDF service) |
| Workflows in n8n | `SEOagentV4Full01` main ("SEO Agent v4"), `SEOagentAPIentry` API front door, `SEOagentTracker1` Rank Tracker (weekly), `SEOagentWordPres` WordPress publisher (inactive sub-workflow), `SEOagentErrHandl` error handler, `SEOagentCallback` test callback receiver, `SEOagentTestRun1` test runner (testing only), `uMY3xr66Q7aLX9uA` original v3 (untouched) |
| Workflow JSON (source of truth) | `n8n/seo-agent/workflows/*.json` — generated, do not hand-edit |
| Build scripts | `n8n/seo-agent/build_v4.py` (v3 export → v4 JSON, asserted patches; also writes `harness/code_v4/`; runs `build_api.py` and `build_ladder_extras.py` at the end), `build_api.py` (API workflow), `build_ladder_extras.py` (Rank Tracker, WordPress publisher, Test Runner), `ladder_common.py` (Data Table columns) |
| Prompts and new Code nodes | `n8n/seo-agent/v5/prompts/*.txt`, `n8n/seo-agent/v5/code/*.js` (read by `build_v4.py`) |
| Offline test harness | `n8n/seo-agent/harness/` — `scenarios_v5.js` runs every Code node against fixtures in the n8n container's Node (see `harness/README.md`); must end `0 failed` |
| Live samples | `n8n/seo-agent/harness/sample-output/LIVE-*` (real generated page, PDF, Word) |
| Production overlay | `n8n/seo-agent/production/` (Postgres, Redis, workers; not applied) |

## Working rules
- Edit prompts/code in `v5/`, wiring in `build_v4.py`; then `cd n8n/seo-agent && python3 build_v4.py` and **check the exit code** (patches are anchored on exact text and assert; don't pipe the build to `tail` without `pipefail`).
- Run the harness after every change (copy `harness/` into the container as a fresh dir, chown to `node`, run `scenarios_v5.js`).
- Import with `docker exec n8n-n8n-1 n8n import:workflow --input=/tmp/<file>.json --projectId=wo1WpMiHjdduGvfl` (upserts by id; import deactivates, so re-activate through the n8n API `POST /api/v1/workflows/<id>/activate`).
- Script-created Webhook nodes need a `webhookId`; Form "completion" nodes throw in API-started runs (guard with `via_webhook`); n8n forbids Respond-to-Webhook nodes downstream of a Form Trigger (hence the separate API workflow).
- n8n keeps HTTP-node binaries on disk: Code nodes must use `await this.helpers.getBinaryDataBuffer(i, prop)` to get bytes.
- Anthropic node: thinking tokens count against `maxTokensToSample`; set `streaming: true` above ~21k tokens (SDK 10-minute rule); streaming calls report no token usage.
- Never export or print credentials. Credentials live in n8n under fixed ids (`SEOcredDataForSE`, `SEOcredJinaReade`, `SEOcredPageSpeed`, `SEOcredAnthropic`, `SEOcredFormLogin`, `SEOcredApiHeader`, `SEOcredSmtpGmail`); the API caller secret is credential "SEO API Key". The SMTP credential needs a Google App Password (placeholder until provided).
- Spend: `ai_budget_usd` / `ai_budget_period` in *Normalize Input* CONFIG is an estimate-based guard; the Anthropic Console workspace limit is the real cap. DataForSEO balance was $32.6 on 2026-10-01.

## Status (2026-10-01, evening)
Keyword ladder (v4.2) implemented, imported and live: mode "Rank my site for a keyword" / API `mode: ladder`, discovery choice step (form), Rank Tracker workflow (weekly, Data Tables `seo_ladders` / `seo_rank_history` created on first use), WordPress draft sub-workflow (off). Harness: 161 node runs, 0 failed. Full live system test on techand.ai passed: technical audit, keyword discovery, full report, ladder plan ("e invoicing in uae", 9 pages, rows stored) and its first page (content run, 10.3 min, links to the ladder's top page), rank tracker, error handler, e-mail via Gmail SMTP, and the browser form path (verdict download + e-mail, ladder page, validation page, "Choose your keyword" step, audit form with instant "started" page). Live findings fixed: a Form *completion* page ends the execution (follow-ups now run as separate executions, completion last); error workflows must be *published* in n8n 2.x; new nodes need credential slots (asserted in the build). `ai_budget_usd` was raised 3 → 10 at the user's request to finish the test — lower it when the testing phase is over; the per-e-mail limit is 6 runs/day. Next: roadmap item 9 in REVIEW.md (e-mail the user on guard rejections, auto next rung, KD-null handling, discovery tiering, RDAP before WHOIS).
