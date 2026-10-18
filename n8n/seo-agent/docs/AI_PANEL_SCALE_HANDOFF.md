# G6 — AI question panel at enterprise scale: handoff (kept current)

Agent G6, 2026-10-18. Owner's ask: "expand the AI question panel fully, regardless of price, to get it rated higher; do it and test it."
Branch: the G6 worktree branch, reset onto `feature/seo-agent-v4.5` @ `ccbd3a9`. Nothing deployed; the orchestrator merges, rebuilds
with `n8n/.env` in the main checkout and deploys. **If this file says a part is done, its commit is on the branch.**

Evidence of the gap: `docs/system-review-2026-10-17/MARKET_BENCHMARK.md` §2.8 rows 56–67 and §5 #8; `SCORECARD.md` §3.8 (4A.1 = 5:
"7 buyer questions … Semrush 25 / Profound 100 prompts daily") and Part C row B6; runs 776 (weekly, 49 requests) and 779 (pulse, 21).

## 0. Baseline (before any change)
- `python3 build_v4.py --no-env` exit 0. Harness (throwaway `n8nio/n8n:2.41.4` container, scratchpad copy): **6939 passed, 0 failed**.
- The worktree has no `n8n/.env`, so the build bakes defaults into the generated `workflows/*.json` and `harness/code_v4/`; those
  generated files are **not committed** here (the orchestrator rebuilds in the main checkout). Sources, new fixtures and scenarios are.

## 1. DataForSEO sandbox probe (2026-10-18, from inside `n8n-n8n-1`, credentials by env var, never printed)
Every path under `ai_optimization/<engine>/{llm_responses/models, llm_responses/live, llm_scraper/live/advanced}` for chat_gpt, gemini,
claude, perplexity, grok, deepseek, meta, meta_ai, mistral, copilot, microsoft_copilot, llama, qwen, google_ai_mode; plus
`serp/google/ai_mode`, `serp/bing/organic`, `serp/bing/copilot`, `serp/google/organic` (People-Also-Ask), LLM Mentions and AI Keyword Data.

| Engine / endpoint | Sandbox | Wired |
|---|---|---|
| ChatGPT — `chat_gpt/llm_scraper/live/advanced` (the chatgpt.com interface) | 20000, items chat_gpt_text, sources, fan_out_queries, brand_entities | yes (weekly + pulse), $0.004 |
| ChatGPT API — `chat_gpt/llm_responses/live` (49 models; web search on gpt-5.4-mini, gpt-4.1-mini …) | 20000 with `model_name`; 40501 `max_output_tokens` on o4-mini (reasoning models refuse it) | **new, opt-in** `chatgpt_api`, est. $0.012 |
| Gemini — `gemini/llm_scraper/live/advanced` (gemini.google.com) | 20000, gemini_text | yes, $0.004 |
| Gemini API — `gemini/llm_responses/live` (12 models, gemini-3.5-flash …) | 20000, items/sections/annotations, `money_spent` | **new, opt-in** `gemini_api`, est. $0.02 |
| Claude — `claude/llm_responses/live` (17 models incl. claude-haiku-5-5) | 40404 "No Prepared Data" (sandbox has no dummy answer) | yes (monthly), $0.025 |
| Perplexity — `perplexity/llm_responses/live` (sonar, sonar-pro, sonar-reasoning-pro) | 20000 | yes, $0.006 |
| Google AI Mode — `serp/google/ai_mode/live/advanced` | 20000, ai_overview item | yes, $0.004 |
| Google AI Overview — `serp/google/organic/live/advanced` | 20000; also `people_also_ask` items | yes, $0.002 (also the PAA source) |
| Copilot — `serp/bing/organic/live/advanced` | 20000, organic only in the sandbox | yes (opt-in, unchanged), $0.002 |
| Claude / Perplexity scraper, Grok, DeepSeek, Meta AI, Mistral, Copilot API, Llama, Qwen, `serp/bing/copilot` | **40402 Invalid Path** | not available from our data source |

**Fields that still need ONE live call** (the sandbox validates only some fields — it refused `max_output_tokens` on o4-mini but
accepted `web_search_country_iso_code` for Claude in 2026-10, which the live API refuses): see §7.

## 2. Design (decisions, with the reason)
See `AI_VISIBILITY_SPEC.md` §10 for the full spec. Short form:
1. **Panel 3–500** (`ai_prompts_max`). A site with **no** `seo_monitors` row starts at **50**; a row whose field is empty keeps the old
   default **20**; a stored number is never changed by the engine.
2. **Weekly run asks the whole panel on every enabled engine, chunked across executions**: at most `chunk_requests` (600) requests per
   execution. State `seo_cache` key `ai_run:<site_id>` (kind `ai`): run id, kind, started, chunk number, requests asked / total,
   money so far, execution ids. A chunk saves its answers (`seo_ai_answers`, run_id) and starts the next execution of the same workflow
   (Execute Workflow, `continue_run`, no wait, `parent_run_id` = this execution so the run guard does not see a twin). **Idempotent by
   construction:** the requests of a run are a deterministic list keyed `prompt_id|engine`; a chunk asks only keys with no stored answer
   for that run id, so a resumed or repeated chunk never pays twice. The **last** chunk asks the database views, reads GA4 / crawler
   access and computes the metrics over every stored answer of the run (earlier chunks' rows + its own). Resume: any start of the AI
   Visibility workflow (schedule, catch-up replay, on demand) and the daily AI Pulse resume a run whose state is `running` and silent for
   65 minutes (the tracker's execution limit is 60, so such a part is dead, never slow), instead of starting a new one.
3. **Ledger**: every chunk execution reserves what is **left** of the run (exact estimate − spent), settles its own measured spend; the
   report and the callback carry the whole run (all chunks). The run guard's balance floor refuses a run the account cannot pay, with
   the reason; a run above the hard ceiling (`max_run_usd`) is refused by the plan with the reason.
4. **Pulse = stratified rotating sample** above 50 questions (or when the owner sets `sample`): strata = cluster × persona; slots spread
   round-robin inside each stratum; each question asked **N times a week** (N auto-chosen so the weekly headline half-width ≤ 3 points
   and the median cluster's ≤ 10, printed), every stratum covered every pulse day. `ai_pulse_mode = full` asks the whole panel daily
   (capped at the pulse's request limit per morning, said in the plan when it binds).
5. **Personas and segments**: each question carries persona, stage (funnel), cluster, market (`CC-lang`). Generated per persona ×
   cluster × market from Search Console questions, LLM Mentions `search_mentions`, People-Also-Ask, the site's services / ladders /
   keywords and up to 3 competitors' homepages; deduplicated by meaning (content-word stems, Jaccard ≥ 0.6); every one through the fit
   gate (FITR) — a refused question is **stored** with `status: refused` and its reason, so the panel manager shows it.
6. **Statistics**: rates per engine × cluster × persona × market × stage with Wilson ranges and "too few answers" below 12; changes per
   segment tested and corrected with **Benjamini–Hochberg (q = 0.10)** — a family of dozens to hundreds of segment tests, where Holm's
   family-wise control would make every real move invisible; the **headline alert family keeps Holm** (≤ ~10 tests, an alert must be
   rare). Share of voice per cluster; achievable half-width at the current panel printed; deltas refused across a changed panel
   (size **and** identity: < 80% of the same question ids).
7. **Cost**: one formula `CC.aiPanel` in `_cost_cal.js`; mirrored in `app/shared/src/cost.ts` `estimateAiPanelCost`; one table of
   golden cases `v5/data/ai_panel_cost_cases.json` checked by the harness and (copied by the build to
   `app/shared/src/ai-panel-cost-cases.generated.json`) by the app's tests.

## 3. Progress
| Part | State | Commit |
|---|---|---|
| 0 baseline + probe | done | — |
| 1 scale (500, chunking, resume, rotation, ledger) | done — harness 7058 passed, 0 failed (S200–S205 new) | see git log "G6 part 1" |
| 2 personas / segments / sources / fit gate / owner edits | done — S206–S208 | git log "G6 part 2" |
| 3 engines (ChatGPT API, Gemini API opt-in) | done — S209; harness 7102 passed, 0 failed | git log "G6 part 3" |
| 4 statistics at scale | todo | |
| 5 cost (engine + app, shared cases) | todo | |
| 6 app (panel manager, settings, charts, guides, API/MCP) | todo | |
| 7 marketing | todo | |
| 8 tests (harness + app + browser) | todo | |

## 4. Owner steps after the deploy — raise techand.ai's panel
(filled in when part 5 lands)

## 5. Live acceptance checks
(filled in as parts land)

## 6. Open / not built
- **Found while building part 1 (fixed):** the weekly per-question win rate counted a pulse answer that named the business FIRST (codes
  `M` / `C`) as not named at all (`AI_Metrics.js`: `v === 'm' || v === 'c'`); and `rowsOf()` drops any row carrying `error`, which would
  have re-asked every failed request in every later execution of a split run (S202 caught both: "12 twice").
- n8n keeps ALL Data Tables in 200 MB by default (`N8N_DATA_TABLES_MAX_SIZE_BYTES`, read from n8n 2.41.4's config). Weekly answers are now
  kept 120 days (was 400) and pulse answers 21 (was 35); a 500-question site stores ~6.9 MB of weekly answers a week. **Owner: raise
  `N8N_DATA_TABLES_MAX_SIZE_BYTES` (e.g. 2147483648) in `n8n/.env` before raising any panel above ~150.**
- A part of a split run is resumed after 65 minutes of silence (the tracker's 60-minute limit + 5), by the next start of the tracker or by
  the next pulse morning (Tue–Sun 06:30): the worst case for a broken chain is about a day.
- The pulse never splits a morning across executions: one morning asks at most 900 requests. `full` on a big panel is held to what fits,
  and the plan says so (`sample.capped`, `sample.why`).

## 7. Fields that need one live call
The sandbox answers with dummy data and validates only some fields (it refused `max_output_tokens` on o4-mini, it accepted
`web_search_country_iso_code` for Claude in 2026-10 which the live API refuses). One cheap live call each before switching the engine on:
1. `ai_optimization/chat_gpt/llm_responses/live` with `{ user_prompt, model_name: "gpt-5.4-mini", web_search: true, max_output_tokens: 1200,
   web_search_country_iso_code: "AE" }` — all four fields on this model (the sandbox echoed `web_search: false` and a different model).
   Acceptance: task 20000, `result[0].web_search === true`, `items[0].sections[0].annotations` non-empty; note `task.cost` (the price
   estimate is $0.012 — `AIP.PRICE.chatgpt_api` in `v5/code/_ai_panel.js` and `AI_ENGINE_COST` in the app; correct both if it differs).
2. `ai_optimization/gemini/llm_responses/live` with `{ user_prompt, model_name: "gemini-3.5-flash", web_search: true, max_output_tokens: 1200 }`.
   Same acceptance; price estimate $0.02.
3. `serp/google/organic/live/advanced` for People-also-ask needs no new field (depth 10, the rank tracker's own request); the sandbox
   returned a `people_also_ask` item.
4. The model lists themselves are free: `GET ai_optimization/{chat_gpt,gemini}/llm_responses/models` on the LIVE API confirms
   gpt-5.4-mini / gemini-3.5-flash exist with `web_search_supported: true` (the sandbox listed both).
