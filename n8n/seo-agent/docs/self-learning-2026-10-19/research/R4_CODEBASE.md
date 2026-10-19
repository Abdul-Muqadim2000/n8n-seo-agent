# R4 — Codebase survey for the self-learning loop (2026-10-19)

Read-only survey of the repo (no edits, no `.env` values read). Paths relative to the repo root; `LC` = `n8n/seo-agent/ladder_common.py`
(single source of Data Table columns), `V5` = `n8n/seo-agent/v5/code/`.

**Summary.** The system already stores almost every *outcome* it needs to grade itself, weekly, keyed by `site_id`/`domain` + keyword /
page / prompt, and most outputs carry ids that join to outcomes (`ladder_id`, `prompt_id`, `target_id`, `prospect_domain|type`,
`audit_id`/`finding_key`, `request_id`). Only two closed loops exist: cost estimates (`_cost_cal.js` + `reconcile_claude_cost.py`) and the
offline, human-labelled audit/spam accuracy gate (S49). Chance bands, plan month ranges, reach rule and the QA bar of 80 are explicitly
*uncalibrated* (G17 open). **No embeddings / vector code; Postgres is stock `postgres:17-alpine` (no pgvector). No stored "dismissed
recommendation" signal. Predicted values (chance, content score, expected visits) are not stored next to their ids in any Data Table.**

## 1. Outputs that make an implicit prediction

- **Keyword verdict / discovery / keyword check** — main workflow (Parse Verdict; `Assess_Response.js:108` carries `chance` /
  `chance_text` / `base_rate`). Not stored in any Data Table (Keyword Check writes only `seo_cache`, `seo_run_ledger`). Persist only in the
  app: `keyword_checks.result` jsonb (site + keyword + country, `app/server/src/db/schema.ts:594-613`) and `reports.payload`
  (`schema.ts:519-538`). Join: keyword text + `runs.requestId` (`schema.ts:481`).
- **Reach / chance bands** (`V5/_reach.js`) — reach = P75 of the difficulty of the site's top-10 keywords with a size floor (`:12`,
  `:49-60`); plan type + months by difficulty: direct 2-4, short 4-8, full 9-15 (`:5-7`); bands good 50-70 / fair 30-50 / low 15-30 / slim
  5-15 (`REACH_CHANCE`, `:21`), labelled "UNCALIBRATED until G17" (`:16-22`, `:37`); "unmeasured" when no measured ranking (R49,
  `:24-36`). Cached `seo_cache` `reach:<site_id>` 30 days (`:82-84`; `LC:327`). Mirrored in `app/shared/src/keywords.ts:66-125` — must
  change together.
- **Ladder plan** (`V5/Ladder_Plan.js`) — reach per ladder topic (`:53`), timeline per rung (`:485-505`); outputs `plan_type`, `months`,
  `months_range`, `chance`, `chance_text`, `time_to_rank_months`, `expected_visits_top3` (`:550`, `:707-711`). Stored: `seo_ladders` one row
  per page (`LC:14-21`: ladder_id, rung, page_no, keyword, page_type, target_url, status, months "a-b", start_date, target_words,
  status_note; `V5/Ladder_Rows.js:11-18`); `seo_ladder_settings` stores plan_type, reach (`LC:312-314`). **Chance band and expected visits
  are not stored in a Data Table** — only in `reports.payload` (stage `ladder_plan`). Join: ladder_id + keyword → `seo_rank_history`,
  `seo_content_log`.
- **Content pages** (`V5/Content_QA.js`) — `content_score` (`:654`), pass bar 80 hard-coded (`:816`, `:843`), editor skip at score ≥ 90 and
  critic ≥ 85 (`:825`), `quality.not_ready` / `not_ready_reasons` / `critic_score` / coverage (`:851-874`). `seo_content_log` (`LC:95-99`)
  stores only status (started / written / not_ready / published), qa_reasons, source, rung, ladder_id, request_id, week, published_url,
  published_at (`V5/Content_Log_Row.js:41-57`). **Content score not stored in a Data Table** — it travels in meta.json + callback, lineage
  "modelled" (`V5/Blog_Package.js:179-191`). FIX_PLAN B3-9: never validated against an outcome (`docs/system-review-2026-10-11/FIX_PLAN.md:1129`).
- **Audit findings** — `seo_audits` (`LC:261-266`: audit_id, report_type, health_score, crawl_js, checks_version); `seo_audit_findings`
  (`LC:267-283`: finding_key, severity, affected_count, checked, impact, impact_basis (`V5/_impact.js:1-30`), evidence, sample_urls,
  check_version, recheck_state / recheck_at / recheck_rule / recheck_note). Join: site_id + finding_key across audit_ids. Diff:
  `V5/Audit_Diff.js:1-20` (same report type; fixed / new / still open).
- **AI visibility panel** — `seo_ai_prompts` (`LC:166-170`: prompt_id, kind, topic, stage, cluster, volume, origin, status incl. refused +
  fit_note, persona, market, pinned). Dedup by Jaccard ≥ 0.6 (`V5/_ai_panel.js:27`, `:73`).
- **AI growth targets** — `seo_ai_targets` (`LC:202-204`: target_id, prompt_id, kind answer|refresh, value, status queued / writing /
  written / won / skipped, written_at, won_at); settle + won/lost in `V5/AI_Target_Settle.js:1-12`, `V5/Growth_Plan.js:111-149` (won can be
  lost again). Weekly roll-up `seo_ai_growth` (`LC:207-209`).
- **Backlink prospects / outreach** — `seo_link_prospects` (`LC:215-219`: score = value × likelihood `V5/_outreach_kit.js:61`, status,
  won_at, verified_at, contacted_at, followup_step, drafted_at); `seo_link_outreach` (`LC:237-241`: score, fit, fit_reason, checks_json,
  sequence_json, target_url). Join: site_id + prospect_domain + type = app `outreach_sequences.prospectDomain/prospectType` (`schema.ts:679-718`).
- **Link / page-change impact** — `seo_link_impact` (`LC:247-254`: t0, weeks, base_position, base_clicks, page_change, control_change,
  effect, verdict, kind link|page_change). Control test `V5/_change_test.js:1-25` (≥ 6 weeks, graded, deliberately weak verdicts).
- **Cadence choices** — `V5/Cadence_Plan.js:1-36`: ladder pages → refresh (decay) → striking distance (pos 4-20) → Trends; won = top-3 in
  each of the last 4 checks; pile-up guard; `decay_per_week` 2. Mirror `app/server/src/services/cadence.ts:18`, `:49`, `:219`. Recorded:
  `seo_content_log.source` (cadence / ai_answer / ai_refresh / striking / trend), `seo_cadence.pages_per_week` (`LC:102`).
- **Stuck-ladder re-plan** — `V5/_replan.js:1-20` proposes improve / easier keyword / reorder / stop, never applies; threshold
  `seo_monitors.stuck_weeks`; only in the Rank Tracker callback (`V5/Tracker_Report.js:240`, `:417`). Acceptance not recorded.
- **App recommendations** — computed per request (`app/server/src/services/recommendations.ts`), deterministic ids
  (`search:striking:<query>` `:180`, `engine:<source>:<type>:<keyword>` `:244`); types `app/shared/src/data.ts:909-935`. **Not stored**;
  only trace is `issue_links.sourceKey = rec:<website>:<id>` when ticketed (`schema.ts:961-987`).
- **Weekly site brief** — `v5/prompts/site_brief.txt`: `actions` (≤ 5) and `watch` (0-3 re-checks next week); only in `reports.payload`.

## 2. Outcome data per site over time

| Table | Grain / key | Ref |
|---|---|---|
| `seo_rank_history` | ladder_id + keyword + checked_at (weekly Mon 08:00); position, url, device, features_json, competitors_json, snapshot_json, share_of_voice | `LC:23-31` |
| `seo_site_metrics` | site_id + period_end (weekly 28-day rollups + prev / yoy) | `LC:73-76` |
| `seo_query_history` | site_id + period_end + query (+ page, tracked, serp_position) | `LC:77-78` |
| `seo_pages` | site_id + url; clicks, prev / yoy, decay_state, decay_pct, decay_basis | `LC:64-72` |
| `seo_trends` | site + keyword + checked_at | `LC:100-101` |
| `seo_ai_answers` | site + run_id + prompt_id + engine; mentioned, cited, rank, sentiment, cited_urls — pruned 120 days, pulse 21 days | `LC:171-174`; `build_monitors.py:378`, `:439` |
| `seo_ai_visibility` | site + run_id weekly; rates + ranges, segments_json, panel_json; kept | `LC:175-185` |
| `seo_ai_daily` | site + date | `LC:188-191` |
| `seo_backlinks` / `seo_backlink_snapshots` | site + ref_domain (status, first_seen, lost_at, seo_value) / site + checked_at | `LC:223-228`, `210-214` |
| `seo_link_impact` | site + ref_domain/target_url + kind | `LC:247-254` |
| `seo_audits` / `seo_audit_findings` | site + audit_id (monthly) / + finding_key | `LC:261-283` |
| `seo_content_log` | site + keyword (upsert); published status | `LC:95-99` |
| `seo_page_watch` | site + url (daily) | `LC:292-298` |
| `seo_run_ledger` | run_id; est / ai / dfs / measured / estimated usd, cost_mode, dfs_balance(_end) | `LC:343-370` |

App (`app/server/src/db/schema.ts`): `runs` (`:469-516`: mode, input, requestId, estimated / actual / engine cost), `reports`
(`:519-538`: stage, payload, summary, receivedAt; no pruning found), `report_deliveries` (`:765-796`), `outreach_sequences`
(`:679-718`: replyClass, replyAt, wonAt, subjectVariant), `outreach_messages` (`:721-743`), `cost_events` (`:1268-1310`),
`credit_ledger` (`:1234-1260`), `keyword_checks` (`:594-613`), `crawler_hits` / `crawler_daily` / `crawler_page_daily` (`:1144-1214`).
The app reads Data Tables via the n8n public API, 60 s cache, pages of 250 (`app/server/src/n8n/client.ts:175-214`); table-key map
`app/shared/src/tables.ts:300-343`.

## 3. Existing learning / calibration / feedback

- **Cost calibration** — `V5/Cost_Calibration_Row.js:1-29` + `V5/_cost_cal.js:234-340` (ALPHA 0.3, HEADROOM 1.25, CAP); rolling
  `seo_cache` `cost:ai:<mode>` / `cost:dfs:<mode>` + monthly `cost:model:<fam>`; learns only from measured DataForSEO amounts.
  `reconcile_claude_cost.py:1-60` compares the Anthropic Console export, `--apply` writes `cost:factor:claude` (0.2-5.0); manual, monthly.
  **The only self-adjusting loop.**
- **Accuracy set / S49** — `n8n/seo-agent/ACCURACY_SET.md`: 53 audit + 34 spam labelled cases (`harness/accuracy/`, `score.js`), gate
  precision ≥ 95% (`harness/scenarios_v5.js:5863-5877`). Offline, human-labelled, 3 sites; not per client, not weekly.
- **"Uncalibrated" labels** — `_reach.js:16-42`, `app/shared/src/keywords.ts:79-117`; lineage kit `V5/_lineage.js:1-30` (measured /
  modelled / unavailable); content score "modelled" (`Blog_Package.js:188-191`). G17 (`FIX_PLAN.md:691-694`) open.
- **User feedback that exists** — "Not a fit" on outreach drafts → `POST /link-building/dismiss` → engine prospect `rejected`
  (`app/server/src/routes/linkBuilder.ts:233-240`, `app/web/src/lib/queries.ts:589-595`); the engine only *excludes* it
  (`V5/BL_Plan.js:46`), learns nothing. Portal approvals (`portal_approvals`, approved / changes_requested + decisionNote;
  `schema.ts:367-390`, `services/approvals.ts:123-134`). Ladder settings (`services/ladderSettings.ts:205-240`). Panel manager
  (`ai_prompts` admin action, `routes/sites.ts:349-353`). "I fixed this" on a finding → `recheck_state` (`routes/data.ts:48`). Subject-line
  A/B rates displayed only (`V5/_ab.js:1-15`, `app/shared/src/outreach.ts`). Reply classes (`outreach_sequences.replyClass`).
- **seo_cache** — age, desc, sitemap, ai_brands, ai_index, indexnow, watch, reach (+ reach_ranked, reach_overview), cost, model, catchup,
  idem, gsc (`LC:301-304`, `:327`). `ai_brands:<site>` is the only other "learned" per-site state (Answer Analyst).
- **Not found:** grading of verdicts / chance bands / month ranges; stored predicted values; recommendation dismissal; re-plan acceptance;
  feedback into prompts; per-client learned parameters.

## 4. Per-site settings and how runs read them

- `seo_sites` (`LC:49-60`): site model (canonical_host, brand_names, competitors, business_facts, cta, content_groups_json) via
  `V5/_site_model.js` (`SM`).
- `seo_monitors` (`LC:158-165`): monitor flags, ai_prompts_max, stuck_weeks, ai_personas, ai_markets, ai_pulse_mode…; read via
  `V5/_monitor_sites.js:1-12` (empty = on / default).
- `seo_ladder_settings` (`LC:312-314`): per ladder + `_site` defaults row (mode, max_active, max_waiting, opportunities, auto_start).
- `seo_profiles` (`LC:134-144`) incl. `style_*`, inlined via `V5/_style_guide.js` (`ST.block` / `ST.check`) into Brief Context, Content
  QA, Profile Delivery (`build_v4.py:4612-4630`). `seo_cadence.pages_per_week`. App `sites` (`schema.ts:431-467`: tone, cta,
  businessFacts, competitors, keywords, blogsPerWeek, linkSettings).
- Changes: Site Admin actions cadence / unpublish / prospect / ai_prompts / content_groups / monitors / pause (`V5/Admin_Action.js:13-39`)
  via `routes/sites.ts:335-360` → `n8n/client.ts:114`; the app also writes Data Tables directly (`upsertRow` / `updateRows`,
  `client.ts:257-342`).
- **Prompts** — `v5/prompts/*.txt` are n8n expressions over `$json` (`build_v4.py:769-774`). Writing context from `V5/Brief_Context.js`
  (profile, `eeat_context`, `proof_context`, role / style, `:151-158`) → `strategy_brief.txt`, `copywriter.txt`, `editor.txt`
  (`copywriter.txt:17-33` reads `{{ $json.eeat_context }}`, `proof_context`, `content_brief.voice_rules`). Weekly brief gets
  `{{ $json.facts }}` (`site_brief.txt:22`). **Injection points:** a field on Brief Context / Brief Input / AI Brief Input + one
  `{{ $json.<field> }}` line in the prompt. Behind an agent node read `$('Node').first().json`.

## 5. Schedules, catch-up, weekly report, app rendering

Instance timezone `GENERIC_TIMEZONE` (America/New_York; `deploy/gcp/compose.prod.yml`, `LC:515`). Page Watch daily 05:45; AI Pulse 06:30
Tue-Sun; AI Visibility Mon 07:00; Backlinks 07:30; Rank Tracker 08:00; Site Tracker 09:00; AI Growth 09:30; Content Cadence 10:00; Link
Builder 11:00; Audit Scheduler 1st 06:00; Catch-up `7,22,37,52 * * * *`.

- Catch-up: `build_catchup.py:1-46`, `V5/_catchup.js`; records `catchup:<wf>:<due>` before starting; `EXPECTED` hard-codes 10 workflow ids
  (`:42-43`); app mirror `AUTOMATIONS` / `SCHEDULES` (`app/shared/src/constants.ts:434`, `:550`, `:562`) → `services/delivery.ts`.
- `apply_env.py` refuses deploys Mon 07:00-12:00 (`:8-25`).
- Weekly report: Site Tracker Site Plan → … → Site Metrics → rows → Brief Input → Site Brief (Claude) → Site Report → PDF → Build Site
  Callback (`V5/Build_Site_Callback.js`); callbacks POST `/api/hooks/n8n/<token>` (`app/server/src/routes/hooks.ts`) → `ingestCallback`
  (`services/runs.ts`). App digest `deliveryTick` / `sendDigest` (`services/reportDelivery.ts:373-425`), 5-minute timer
  (`server/src/index.ts:60-64`).
- Rendering: `app/web/src/components/reports/ReportView.tsx:28-64` (stage → renderer, e.g. `SiteTrackerReport` `tracker.tsx:25`,
  `RankTrackerReport` `rank.tsx:36`); site pages `app/web/src/pages/site/`; recommendation categories `shared/src/data.ts:909`. A "what we
  learned" section fits as a new stage + renderer, a block in `SiteTrackerReport`, or a new `RecommendationCategory`.

## 6. Infrastructure

- One spot e2-medium (2 shared vCPU, 4 GB), me-central1 (`compose.prod.yml:1-15`, `bootstrap.sh:35`). Limits: n8n 1200 MiB, runners 512,
  Postgres 448, app 384.
- Postgres `postgres:17-alpine` (prod, `app/compose.yml:8`, `app/compose.dev.yml:7`), one instance for `n8n` + `app` DBs. No `CREATE
  EXTENSION` anywhere (initdb.sh, drizzle up to `0014_admin_panel.sql`). **pgvector not available.**
- n8n `n8nio/n8n:${N8N_VERSION:-2.41.4}`, `DB_TYPE: postgresdb`; Data Tables live as `data_table_user_<id>` (`deploy/gcp/migrate_data.py:86`);
  `N8N_DATA_TABLES_MAX_SIZE_BYTES` 1 GiB; regular execution mode, concurrency 4, 14 days of execution history,
  `N8N_BLOCK_ENV_ACCESS_IN_NODE` true.
- **No embeddings / vectors.** Only lexical similarity: Jaccard (`_ai_panel.js:73`, `_reach.js:182`, `app/shared/src/ladders.ts:30-42`),
  IDF weighting (`Growth_Plan.js:104-107`, `_outreach_kit.js:8`), 8-word shingles (`_shingle.js`).

## 7. Rules a new feature must satisfy

- INVARIANTS (`docs/system-review-2026-10-14/INVARIANTS.md`): rule 1 lineage (`lineage_lint.py`), rule 2 gate at write and read
  (`gate_lint.py:43-56`), rule 3 retries incl. errors inside HTTP 200 (`retry_lint.py`, `dfs_gate.py`), rule 4 no forward state without
  evidence, deliveries need a receipt (`state_lint.py`; a `writing` state needs a declared reversal). Also `url_lint.py`, the secret
  scanner (`build_v4.py:5090`), frozen node ids (`LC:911-951`); ratchets only tighten.
- A new scheduled workflow must reserve + settle a ledger row (`monitor_ledger_js`, `ledger_mainline`; mode in `LEDGER_EST`,
  `LC:378-426`, `584-763`) and be added to catch-up `EXPECTED` and the app's `AUTOMATIONS`.
- Process: edit `v5/` + `build_*.py` → `python3 build_v4.py` (check exit code) → new columns in `LC` + `sync_tables.py` → harness (0 failed,
  a scenario per change) → app tsc + tests in `node:22-bookworm-slim`, `npm run db:generate` → keep engine/app mirrors in step
  (`keywords.ts` ↔ `_reach.js`, `cadence.ts` ↔ `Cadence_Plan.js`, `outreach.ts` ↔ `_ab.js`) → marketing entries → deploy is the owner's.
