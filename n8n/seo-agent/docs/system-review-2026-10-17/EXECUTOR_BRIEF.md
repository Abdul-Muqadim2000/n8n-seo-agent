<!-- The common brief every executor agent of the 2026-10-17 re-rating received (kept as the method record). Adapted from the 2026-10-15 brief. -->
# Re-rating 2026-10-17 (fourth whole-system re-rating) — common brief for every EXECUTOR agent (read all of it before your first call)

You are one of several executor agents running the whole-system live re-rating of the SEO Agent (n8n engine + Ascentra web app) on the
owner's real site **techand.ai** (country United Arab Emirates). The owner wants an enterprise-grade live test of every feature: exercise
it the way a paying customer would, capture exactly what it produced (with n8n execution ids), and describe it. **You EXECUTE and RECORD.
You do NOT score.** A separate, independent scorer will read what you write next to the frozen rubric, so what you write must be evidence:
quoted output, ids, numbers, file paths — not opinions about what improved.

## The toolkit (use it for every call — it sends requests exactly as the app does and never prints a secret)

`RR_FILES=/Users/abdul.muqadim/n8n_devaicon/n8n/seo-agent/docs/system-review-2026-10-17/files python3 /Users/abdul.muqadim/n8n_devaicon/n8n/seo-agent/rerate_toolkit.py <command>`
(below: `RR`; ALWAYS set `RR_FILES` as shown, or the artefacts land in the 2026-10-15 folder). Work in the MAIN checkout (no worktree). Run `RR` with no arguments for the full list. The important ones:

- `RR balance "<label>"` — DataForSEO balance and today's spend (also appended to files/spend.jsonl). Run it before your first paid run
  and after your last one.
- `RR start '<json>'` — an analysis through the API front door, as the app sends it (`X-Forwarded-For: app:<company>`, the company's
  callback, domain/country filled). The 202 answer's `request_id` is the API execution id; the run itself is the next
  `SEOagentV4Full01` execution(s). Every start is logged to files/starts.jsonl.
- `RR assess <keyword>` (Keyword Check), `RR reply '<json>'` (Reply Reader), `RR admin '<json>'` (Site Admin),
  `RR linkbuilder '<json>'`, `RR prerelease '<json>'`, `RR testrun <workflowId> '<json>'` (only the monitor executor uses this).
- `RR execs <after_id>` — executions after an id. `RR wait <id> <id> …` — block until finished. `RR exec <id>` — saves the full execution
  to files/exec-<id>.json and prints every node's status / item count / error. `RR node <id> "<Node Name>" [maxchars]` — a node's output.
- `RR claude <id> …` — every Claude call in those executions with model, tokens, **MEASURED** (n8n reported tokenUsage) or **ESTIMATE**
  (tokenUsageEstimate only), priced at the official list prices (Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 4.5 $1/$5 per M tokens).
- `RR reports [since]` / `RR report <id>` — what landed in the app's `reports` table for the company (this is what the customer sees).
- `RR rows <table> '<filter json>' [limit]` — n8n Data Tables (e.g. `seo_run_ledger`, `seo_ladders`, `seo_audit_findings`, …).
  Filter shape: `{"type":"and","filters":[{"columnName":"domain","condition":"eq","value":"techand.ai"}]}`. `RR ledger [since]` — the
  run ledger (the engine's own spend records).
- Python import also works: `import sys; sys.path.insert(0, '<dir of rr.py>'); import rr` then `rr.node_out(id, name)`, `rr.get_exec(id)`.
- Artefacts go to the git-ignored folder `n8n/seo-agent/docs/system-review-2026-10-17/files/` (set by `RR_FILES`). Prefix your files with your letter (A-…, B-…). Save there anything worth keeping (report payloads, generated pages,
  PDFs/Word files you pull, screenshots). Execution JSON can be large: extract with Python rather than reading whole files.

Where things are (read as needed): engine source `n8n/seo-agent/` (build scripts `build_v4.py`, `build_api.py`, `build_monitors.py`,
`build_site_tracker.py`, `build_ladder_extras.py`; node code `v5/code/*.js`; prompts `v5/prompts/*.txt`; generated per-node code
`harness/code_v4/*.js`), app `app/` (`app/API.md`, `app/shared/src/`, `app/server/src/`, `app/web/src/`). The previous whole-system run
— same protocol, read it for the structure and as the baseline you compare against — is
`n8n/seo-agent/docs/system-review-2026-10-15/RESULTS.md` (executions 594–643) and its `parts/` (your letter's part is the closest model). The rubric your areas will be scored against (read your
areas' criteria so you know what to look at; **do not score**) is in `n8n/seo-agent/docs/system-review-2026-10-11/CRITERIA_keywords_content.md`
and `CRITERIA_technical_tracking_reporting_ai_links.md`.

## Rules that do not bend

- **Never** send outreach e-mail to a real address; never connect a mailbox; never publish to WordPress; never submit a URL to Bing or
  IndexNow as a test (if a run would do so on its own, record that it did and what — do not trigger it deliberately); never print,
  save or quote a credential, API key, hook token or callback URL (the toolkit redacts; do not undo that).
- **No third party may receive anything from you.** Reading public web pages (GET) to verify a claim is fine and encouraged.
- Do **not** deploy, run `apply_env.py`, `build_v4.py`, `sync_tables.py`, or any `fix_*.py` / `release_*.py`; do **not** change any code,
  workflow, prompt, credential or Data Table row (reading is fine); do **not** create workflows; do **not** push; do **not** edit
  `CLAUDE.md` or `FIX_PLAN.md`. Only the monitor executor may activate/deactivate the Test Runner (`SEOagentTestRun1`).
- **Budget.** DataForSEO is the binding constraint (**$8.02** in the account at 15:55 UTC; today's total then $0.092). Before each paid run,
  `RR balance` and check `today_total`; if your run could take today's DataForSEO spend past **$4.50**, or the balance under **$3.00**,
  do NOT start it — stop and report back. Your brief gives your own share. Claude spend is fine.
- **Concurrency.** The engine refuses a *scheduled/monitor* run when 3 or more other analyses are in flight, and refuses a second heavy
  (≥100-page) crawl of the same site while one runs. Your brief tells you what you may run in parallel. A refusal by the engine is
  evidence — record it word for word — but do not cause one on purpose unless your brief says so.
- Change nothing in the app's data except what your brief explicitly allows.

## What you write

1. **Your part file** (path given in your brief). Do NOT run any git command that writes (no add / commit / stash / checkout / reset):
   other agents work in the same checkout at the same time. The orchestrator commits.
2. Structure of the part file:
   - A header: what you ran, UTC start/end, balance before/after your runs (from `RR balance`).
   - **A runs table**: protocol # · what · request id · executions (API → run → spawned) · start–end UTC · duration · DataForSEO (the
     run's own figure + its ledger row: `dfs_usd` / `settled_usd` / status) · Claude (from `RR claude`, measured vs estimate) · status.
   - **One section per run/feature**, descriptive, in this order: *what was asked* (the body, minus secrets) · *what came back* (quote
     the real output — the key fields AND the customer-facing text: titles, verdict lines, reasons, recommendations; enough that a reader
     who cannot open n8n can judge it) · *what the customer sees in the app* (the `reports` row: stage, title, summary; and the payload
     fields the app renders) · *where it is right* · *where it is wrong* (each a numbered finding, see below) · *the gap to the leader*
     named in that area's criteria (what the leader does that this output does not — describe, do not score) · *cost* (DataForSEO and
     Claude for this run, and whether the engine's own figure matches what you measured).
   - **Findings** numbered with your prefix (A-1, A-2 … / B-1 … / C-1 … / D-1 …): what is wrong, the exact evidence (execution id +
     node name + quoted value, or file path), severity (High = wrong advice or wrong number shown to a customer; Medium = misleading or
     missing something the run claims; Low = cosmetic), and what a correct output would have been.
   - **What could not be exercised and why** (one line each).
   - **State left behind** (rows the runs created: ladders, content-log rows, prospects, ledger rows still `reserved`, …).
3. **Language.** Neutral and factual. Do NOT use internal register ids (D…, G…, R…, B-…, P…, L…, O…) and do NOT write "fixed",
   "improved", "now works" — say what happened, with the evidence, and where useful what the 2026-10-14 run did on the same input
   ("on 2026-10-15 (exec 608) the same verdict scored 58; today 61"). Never paste a third party's e-mail address or phone number into
   the part file (write `[contact on prospect's domain]`); never paste the prospects CSV.

## How thorough to be

The owner's words: "Not a smoke test … capture what it actually produced … judge it against the rubric as written … A one-line verdict
is not a result." So for every run go past the engine's own summary:
- Open the node outputs that produced the customer-facing numbers and check them against their inputs (is the figure what the data says?
  is a "could not be read" honest? is anything invented?).
- Verify claims against the real world where it is free: fetch techand.ai's actual pages (and competitors' public pages) to check an
  audit finding, a "page exists", a link, a fact in a draft; use web search to check a dated claim (a regulation date, a Google update).
- Look for the same number disagreeing between two places (report vs app vs Data Table vs e-mail/PDF).
- Note durations, retries, failures inside HTTP 200, and whether every paid call's cost reached the ledger.

**Verify your own claims before you write them.** On the previous run several agent claims were wrong. Every sentence in your part must
trace to an execution id + node, a saved artefact, or a fetched URL you name. If you are not sure, say "not verified" rather than guess.

When you finish, reply to the orchestrator with: the part file path + commit hash, the executions you created (ids), the balance before/
after, your numbered findings in one line each, and anything you could not do.

## What changed since the 2026-10-15 run (so you know what is new and must be looked at)

Every defect R34–R119 the 2026-10-15 run found was fixed in code between 2026-10-16 and 2026-10-17, and a third wave built 28
benchmark rows (`n8n/seo-agent/docs/system-review-2026-10-15/NEXT_WAVE_BENCHMARK_ROWS.md`, `LIVE_CHECK_fixes.md`; FIX_PLAN §3.16/§3.17).
**Do not take any of that as true — the run is the test.** Look specifically at whether the 2026-10-15 run's High findings in your area
still appear on the same inputs (its RESULTS.md §0b and §3 list them), and quote what you see either way. New since then, to exercise
where it is in your area: the read API `/api/v1` + MCP `POST /api/v1/mcp` with per-company API keys (app); the publish check outside a
content run (`POST /webhook/seo-publish-check`, workflow `SEOagentPubCheck`); AI Growth's `dry_run: true` (submits nothing — the
first time AI Growth can be rated live); Holm-corrected AI alerts and per-engine change tests; content groups, Discover / Google News
search types; cannibalisation and own-move vs SERP churn in the Rank Tracker; corrections for wrong AI claims; readiness fetched as the AI
bots; the schedule catch-up workflow `SEOagentCatchUp1` (its first execution 728 on 2026-10-17 was **canceled** after 44 min — read it).
Deployed state checked by the orchestrator at 15:57 UTC: 24 published workflows, main workflow 687 nodes, every `workflows/*.json`
node count equal to the live one; last execution before the run: 735.
