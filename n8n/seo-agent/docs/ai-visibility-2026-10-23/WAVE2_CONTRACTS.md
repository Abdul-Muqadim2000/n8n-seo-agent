# AI visibility wave 2: shared contracts (2026-10-23)

Base: `aivis/integration` @ `8ac79271` (wave 1 merged: F1a entities, F1b numbers + `compare_json`, F2 run safety + ids, F3 app fixes;
harness 11484 / 0). Sources of the work: `MARKET_RND.md` §3.1 (gaps 1–13), the leftovers in `fixes/F1a.md`, `F1b.md`, `F2.md`, `F3.md`.

Every agent builds against these names. All new columns go in `ladder_common.py` (so `sync_tables.py` adds them on deploy); every
JSON column is a string holding JSON; every rate is 0–100; every rate travels with its `n`; an absent field means "older row", never 0.
Defaults for every existing site stay exactly as they are today (cost and behaviour), unless a line below says otherwise.

## 1. Answer rows (`seo_ai_answers`, weekly and pulse) — owner W2-E1
| column | type | meaning |
|---|---|---|
| `answer_text` | string | the answer's full text, normalised whitespace, capped at 12,000 characters (`answer_cut: true` in `detail_json` when cut). The existing excerpt column stays. |
| `cited_json` | string | `[{url, host, entity_id, role, position}]` every source the answer cited, in order (`position` 1-based) |
| `retrieved_json` | string | `[{url, host, entity_id}]` pages the engine retrieved / looked at but did NOT cite (ChatGPT scraper `search_results` minus `sources`; other engines when they return it) |
| `fanout_json` | string | `["query", ...]` the searches the engine ran before answering |
| `products_json` | string | `[{title, merchant, price, currency, url, position, entity_id, own: bool}]` product / shopping cards (ChatGPT `chat_gpt_products`, AI Mode `ai_overview_shopping`) |
| `ads_json` | string | `[{advertiser, url, host, rendered: bool}]` ChatGPT ads |
| `local_json` | string | `[{name, url, host, position, own: bool}]` local-business cards |
| `model` | string | the model / mode the response reports, '' when not reported |

## 2. Visibility row (`seo_ai_visibility`) — new JSON columns
| column | owner | shape |
|---|---|---|
| `urls_json` | W2-E1 | `{own: [{url, cited_n, retrieved_n, cited_rate, answers_n, engines:[...], questions:[ids], rival_cited_instead:[{url, host, n}]}], rivals: [{url, host, entity_id, cited_n}], retrieved_not_cited: [{url, retrieved_n, top_competing:[{url, host, n}]}]}` |
| `sources_json` | W2-E1 | `{types: {own, rival, ugc, reference, editorial, government, directory, other: {n, share}}, domains: [{host, type, cited_n, share, first_seen, last_seen, half_life_days|null}], n}` |
| `shopping_json` | W2-E1 | `{trigger_rate, trigger_n, answers_n, products_n, own_presence_rate, own_avg_position, merchants:[{merchant, share, n}], by_engine:{...}, status: "no shopping results" | "measured"}` |
| `ads_local_json` | W2-E1 | `{ads: {seen_n, answers_n, advertisers:[{name, host, n}]}, local: {seen_n, own_n, answers_n, rivals:[{name, n}]}}` |
| `ci_json` | W2-E2 | `{method: "question-bootstrap" | "design-effect", headline: {metric: {lo, hi, n_answers, n_questions, deff}}, note}` — the intervals the app shows (replaces plain Wilson when present) |
| `sov_json` | W2-E2 | `{set: [entity ids declared], others_share, by_entity: [{id, name, share, n}], denominators: {all_answers, answers_naming_any_brand}, named_of_branded_rate}` |
| `sentiment_json` | W2-E2 | `{net, net_lo, net_hi, n, by_aspect: [{aspect, pos, neg, neu, net, n}], by_rival: [{id, net, n}], objections: [...], method, kappa}` (withheld below n 12) |
| `impact_json` | W2-E2 | `[{action_id, kind, target_questions:[ids], control_questions:[ids], before:{rate,n}, after:{rate,n}, did:{effect, lo, hi}, verdict: "likely helped" | "can't tell" | "likely hurt", window_days}]` |
| `alerts_rules_json` | W2-E2 | `[{rule_id, fired: bool, metric, scope, delta, test, reason}]` evaluated owner rules |
| `fanout_gap_json` | W2-E3 | `{queries: [{query, freq, engines:[...], our_rank|null, our_url|null, target_url|null, top_domains:[...], cited: bool}], checked_n, cost_usd}` |
| `demand_json` | W2-E3 | `{questions: [{prompt_id, proxies: [{source, value, as_of, note}], lo, hi}], market: {historical:[...], new_lost:[...], top_brands:[...]}, note}` |
| `imports_json` | W2-E3 | summary of the owner's Bing AI Performance / Search Console AI uploads for the period |
| `exec_ids` | W2-E3 | string, the n8n execution ids of the run's parts, comma-separated |
| `notes_json` | W2-E3 | `{lost_note, unanalysed_note, market_fallback_n}` |

## 3. Question rows (`seo_ai_prompts`) — owner W2-E3
`last_asked_run` (string), `last_asked_at` (ISO), `asked_n_28d` (number), `refused_at_run` (string, the run whose gate refused it).

## 4. Monitor settings (`seo_monitors`) — accepted by Site Admin `monitors` (W2-E2 adds the engine side)
- `ai_alert_rules_json`: `[{id, metric: named_rate|cited_rate|share_of_voice|visibility_score|avg_position|competitor_share, scope: {engine?, cluster?, persona?, market?, competitor?}, direction: drop|rise|any, threshold_points, enabled}]` — a rule fires only when its own test passes AND |delta| ≥ threshold on a comparable run (`compare_json.comparable`).
- `ai_claude_weekly` (bool, default false), `ai_pulse_engines` (comma list, default '' = today's pulse engines), `ai_persona_context` (bool, default false), `ai_fanout_check` (number of fan-out queries checked a week, default 0 = off; app offers 25/50/100) — W2-E3; all priced in `AIP.cost` and `app/shared/src/ai-panel.ts` with new golden cases in `v5/data/ai_panel_cost_cases.json`.
- `ai_sov_set` (comma list of entity ids; default '' = configured competitors) — W2-E2.

## 5. Owner imports (`seo_ai_imports`, new table) — written by the app (W2-A), read by the engine (W2-E3)
Columns: `site_id, domain, source (bing_ai | gsc_ai), day (YYYY-MM-DD), url, query, impressions, citations, clicks, file_name, imported_at, import_id`.
The app parses the uploaded export (Bing Webmaster "AI Performance" CSV; Search Console performance export filtered to AI Mode / AI Overviews),
refuses a file for another domain, and upserts by `(site_id, source, day, url, query)`.

## 6. App-only (W2-A)
- Callback `reason: 'open_run'` → "part of the open run (finishes about <time>)", not a failure.
- CSV question import sends a `keyword` per question (column optional).
- Every new JSON column above is rendered only when present; older rows show today's view.
