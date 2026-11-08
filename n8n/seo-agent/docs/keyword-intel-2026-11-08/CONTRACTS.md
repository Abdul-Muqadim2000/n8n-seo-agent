# KI contracts (W0). Every wave codes against this file; a change goes through the orchestrator.

Rule version `ki-1`. Market key = `<ISO2>-<lang>` (e.g. `AE-en`). Every stored or reported number has a sibling basis:
`basis` in `measured | provider_estimate | modelled | inferred`, plus `source` and `fetched_at` (ISO UTC). JSON columns are strings.

## 1. Per-site switch (seo_monitors, Site Admin `monitors`)
New columns: `ki_mode` string (`''`/`off` = Off, `trial`, `on`), `ki_refresh` boolean (monthly refresh in the cycle when On; empty = yes),
`ki_max_competitors` number (1-5, empty = 5). Site Admin `monitors` validates and writes them; "Track my site" carries them as stored
(never resets them). Kill switch: `seo_cache` key `ki:kill` value `1` (any read error = killed, fails closed).
Engine refuses a KI run (callback `status: refused`, reason) when killed or `ki_mode` not in (`trial`,`on`). Off = every existing path
byte-identical. Trial = runs allowed (app lets only platform admins start them and see results), NO consumer reads KI tables.
On = runs + consumers (W2) read KI tables.

## 2. Tables (`ladder_common.py`, synced by `sync_tables.py`, never by Ensure nodes)
`seo_ki_runs` (KI_RUNS): site_id, domain, run_id, request_id, kind (`competitors`|`keyword_research`), market, location_code,
language_code, mode (`trial`|`on`), rule_version, started_at, finished_at, status (`ok`|`partial`|`failed`|`refused`), reason,
sections_json ([{key, state: ok|partial|missing|skipped, reason, rows}]), counts_json, cost_dfs_usd, cost_claude_usd, config_json.

`seo_ki_competitors` (KI_COMP), one row per site x market x comp_domain: site_id, domain, market, comp_domain, class
(`direct`|`adjacent`|`principal`|`directory`|`publisher_list`|`platform`|`government`|`job_board`|`media`), class_basis
(`rule`|`page`|`llm`|`declared`|`user`), class_confidence, scored (bool), score, score_low, score_high, serp_share, topic_sim,
geo_match, ai_share, size_tag (`peer`|`leader`|`smaller`|`out_of_reach`|`unknown`), seeds_seen, seeds_total, reasons_json,
evidence_json ([{seed, position, url}] max 20), declared (bool), status (`candidate`|`chosen`|`watch`|`dismissed`), status_by
(`auto`|`user`|`declared`), first_seen, last_seen, misses, profile_json ({etv, keywords, refdomains, top_pages:[{url, etv, keywords,
page_type}], brand_share, pace_per_month, basis map, fetched_at}), run_id, updated_at.
A `user` status is never changed by a run. A domain leaves (status `watch` -> kept, `candidate` -> removed) only after misses >= 2.

`seo_ki_keywords` (KI_KW), one row per site x market x kw_key: site_id, domain, market, keyword, kw_key, sources_json
([{source, fetched_at, detail}]; source in `gsc|paa|related|forum|autocomplete|labs_ideas|labs_suggestions|labs_related|competitor|gap|
tracked|ladder|seed`), source_count, volume, volume_basis, volume_source, cpc, kd, trend_json, gsc_impressions, gsc_clicks,
gsc_position, gsc_page, intent (`commercial`|`transactional`|`informational`|`navigational`), stage (`hire`|`compare`|`solution`|
`problem`|`info`), stage_evidence_json, intent_confidence, needs_review (bool), gate (`pass`|`fail`), gate_reason, fit, demand, win,
value, gap, score, score_low, score_high, low_confidence (bool), verdict (`go`|`months`|`hard`|`gated`), cluster_id, is_head (bool),
cluster_size, cluster_demand, serp_read_at, top10_json ([{url, host, type, pos}]), page_action (`new`|`refresh`|`list`|`none`),
page_url, cannibal_json, competitors_json ([{domain, position, url}]), striking (bool), run_id, fetched_at, updated_at.

`seo_ki_gaps` (KI_GAPS): gap_id, site_id, domain, market, type (`missing`|`untapped`|`weak`|`striking`|`strong`|`topic`|`page_type`|
`ai_answer`|`listing`|`backlink`), keyword, cluster_id, competitor_domains_json, client_position, evidence_json, sample_note, action
(`new_page`|`refresh`|`list`|`pitch`|`link`|`defend`), action_target, credits, status (`open`|`started`|`dismissed`|`done`), run_id,
created_at, updated_at.

Lints: KI_KW joins `gate_lint` (write: `fitGate` before insert; read: consumers use `KI.readable(row)` which re-checks gate + kill + mode).
KI_COMP joins the competitor pair (`OK.sellsSame` / class check on read). Every reported number passes `lineage_lint`.

## 3. Modes, request, front door
App modes `competitors` and `keyword_research` (shared `RUN_SCHEMAS`), payload head order `mode, keyword(''), country, domain, email,
callback_url, business, customers`, then `competitors` (declared, array of domains), `seeds` (array, max 20), `ki_force` (bool, ignore
TTL reuse). API front door (`build_api.py`) Quick Validate accepts both (domain required), same idempotency and 202, then starts
`SEOagentKIntel1` (Execute Workflow, no wait) instead of the main workflow. ETA: competitors 6 min, keyword_research 12 min.
`SEOagentKIntel1` does its own Normalize (country -> location / language via the engine COUNTRIES table; the site's main market from
`seo_sites`; a different country -> refused with reason `market_mismatch`), company rate limit (same key as the main Rate Limit),
budget + balance guard (Normalize Input CONFIG values), ledger reserve on the main path, settle at every end (build section 55 proof
extended to this workflow), `retry_lint` rules (no node retry on paid multi-item DataForSEO nodes; `_dfs_retry.js` gate).

## 4. Callbacks
`stage: ki_competitors_started` / `ki_research_started` (status accepted), then `stage: ki_competitors` / `ki_research`:
`{stage, status: ok|partial|failed|refused, reason, request_id, run_id, domain, market, mode, rule_version, sections:[{key, state, reason,
rows}], summary:{...counts}, labels:{basis legend}, run_ledger, run_cost_estimate_usd, run_cost_estimate_basis, run_cost_estimate_state}`
plus for competitors: `competitors` (top 20 rows as stored, JSON fields parsed), `listings` (directory / list rows), `platforms`;
for keyword_research: `clusters` (top 50 heads with members count), `striking` (<= 30), `questions` (<= 30, {question, cluster_id,
sources}), `gaps_summary` ({type: count}), `plan` (<= 10 {action_id, kind, title, why, target, credits, gap_id|cluster_id}).
Full rows live in the tables; the app reads them through the n8n public API (filtered by domain, as dashboards do).

## 5. Site Admin actions (SEOagentAdminAPI / Site Admin)
`ki_competitor` {domain, market, comp_domain, status: chosen|watch|dismissed} (status_by user; max chosen = ki_max_competitors, refused
above); `ki_gap` {domain, gap_id, status}; `monitors` gains `ki_mode`, `ki_refresh`, `ki_max_competitors`. Site delete removes KI rows.

## 6. Kit `v5/code/_ki.js` (pure, deterministic, inlined like other kits; exported as `KI`)
`KI.VERSION`, `KI.CONFIG` (all weights, thresholds, caps, TTLs; overridable by `config_json`), `KI.norm(kw)`, `KI.key(kw)`,
`KI.classifyDomain(host, ctx) -> {class, basis, confidence, reasons}`, `KI.scoreCompetitors(domains, seeds, cfg) -> rows`,
`KI.sizeTag(client, comp)`, `KI.mergeCandidates(sourceLists) -> rows with sources`, `KI.prescore(row, cfg)`,
`KI.pageType(serpItem) -> type`, `KI.stage(top10, keyword, labsIntent) -> {stage, intent, confidence, evidence, needs_review}`,
`KI.cluster(rows, cfg) -> rows with cluster_id / is_head`, `KI.demand(cluster, cfg)`, `KI.win(row, site, cfg)`,
`KI.score(row, cfg) -> {score, low, high, factors:{gate, fit, stageW, demand, win, value, gap}, low_confidence}`,
`KI.verdict(row) -> go|months|hard|gated`, `KI.gaps(client, chosen, keywordRows, extra) -> gap rows`, `KI.pageAction(cluster, site)`,
`KI.plan(clusters, gaps, cfg) -> <= 10 actions`, `KI.readable(row, ctx) -> bool`, `KI.label(basis)`.
App mirror `app/shared/src/ki.ts`: types of every row and callback body above, `KI_VERDICTS` (go: "Go", months: "Takes a few months",
hard: "Hard for your site now", gated: "Not for you") with ONE tone map, `KI_STAGES` labels, `KI_CLASSES` labels, `KI_BASIS` labels
("measured", "estimate from <source>", "our estimate", "AI judgement"), `kiCreditsEstimate(kind)`. Parity fixture
`n8n/seo-agent/harness/fixtures/ki_parity.json` read by a shared test (repo root mounted).

## 7. App routes (server, all behind role + verified ownership + company isolation; JSON + CSV)
`GET  /api/orgs/:orgId/sites/:siteId/ki` -> {mode, visible (On, or Trial + platform admin), lastRuns, credits:{competitors, research}}
`GET  .../ki/competitors` | `.../ki/competitors.csv`; `PATCH .../ki/competitors/:compDomain` {status} (owner/admin/member)
`GET  .../ki/keywords?stage&verdict&source&cluster&min_volume&brand&page&sort` | `.../ki/keywords.csv`
`GET  .../ki/gaps?type&status` | `.../ki/gaps.csv`; `PATCH .../ki/gaps/:gapId` {status}
`POST .../ki/questions/approve` {keys:[kw_key]} -> existing AI panel question add (no paid run)
`POST .../ki/plan/:actionId/start` -> creates the existing pipeline item (W2; 501 until then)
`PATCH .../ki/mode` {mode} platform admins only (as ai rank). Runs: existing `POST` run route with the two modes.
Run watcher: `SEOagentKIntel1` in `WATCHED`. Cost: `cost.ts` + `_cost_cal.js` entries `competitors` 0.35, `keyword_research` 0.90 USD.

## 8. Ownership per agent (one worktree each, branch from `ki/integration` after W0)
- W0: this file's tables + monitor columns, `shared/src/ki.ts` types / words, schemas + payload + export:payloads + S23, front door
  routing, stub `build_ki.py` (refuses "not available yet" unless trial/on), Site Admin fields, cost entries. Harness + app tests green.
- E1 kit: `v5/code/_ki.js`, harness scenario `scenarios_ki.js` (or S-number in scenarios_v5), labelled sets
  `harness/accuracy/ki_domains.json`, `ki_stage.json` (built from the private production data, domains only), parity fixture.
- E2 workflow: `build_ki.py` full worker (requests per R5 shapes, cache, ledger, tables, callbacks), Site Admin KI actions, harness
  replay scenario on fixtures; never edits `_ki.js` (asks the orchestrator).
- A1 app server: routes, services, data reads, CSV, quote / watcher / refund, recommendations + Needs you entries (On only), API v1 /
  MCP `get_table` additions, server tests.
- A2 app web: Competitors + Keyword research pages, verdict component, DataTable filters + CSV, nav (On or Trial-admin only), run forms,
  guides, marketing registry + changelog, discovery-form credit bug fix, tutorial backlog row, web tests.
- W2 (later): consumers in On mode (discovery, setup research, Keyword Check alternatives, ladder pool, cadence + cadence.ts mirror, AI
  panel proposals, Link Builder backlink gap, full + weekly report section), monitoring, cycle job.
