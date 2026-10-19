# Self-learning loop — adversarial engineering review of PLAN.md v1 (2026-10-19)

Read-only review against the code on `feature/seo-agent-v4.5` (HEAD `be01d3a`). Every claim below was checked in the repo; paths are
relative to the repo root. No `.env` value was read. Severity: **High** = the plan as written does not work or breaks a rule;
**Medium** = works only partly / silently loses data / underestimated; **Low** = wording, naming or a small missing piece.

Bottom line: the direction (a frozen prediction ledger in the app, numeric statistics, a bounded per-site pack, no RAG) is sound and
fits the stack. But five things are wrong in a way that matters: (1) the L1 headline cannot fire under the plan's own prior, (2) the
engine's callbacks are lossy and not every site's schedule reaches the app, so a ledger fed only by callbacks loses predictions
silently, (3) three named hooks do not do what the plan says (Page Watch does no URL Inspection, Publish Check keeps no page text,
`Build_Site_Callback.js` builds nothing), (4) the eval gate has no runtime in production, and (5) P0 "this week" is 6+ sessions. The
cheapest fix to most of it: **derive P0's predictions in the app from the callback payloads it already stores**, with no engine change.

---

## A. Hooks the plan names — verified

### 1. High — Page Watch does not run URL Inspection; the rotation is weekly, in the Site Tracker (§3.2 row "Outcome (engine)", §8)
- Evidence: `n8n/seo-agent/v5/code/Watch_Plan.js:8` (`max_watch_pages: 25`, one raw GET each, no inspection); the inspection rotation
  is `v5/code/Inspect_Requests.js:43` (`PW.inspectBudget(list, cap)`), wired only in the Site Tracker (`build_site_tracker.py:258`,
  weekly Mon 09:00) and in the audit (`build_v4.py:3631`, `PW.PER_AUDIT`). `_page_watch.js` is a *kit* shared by both.
- Problem: "Page Watch's URL Inspection rotation" does not exist. Index outcomes are read once a week, ordered **never inspected first,
  then oldest inspection** (`_page_watch.js:288-297`); weight only breaks ties. A page inspected "not indexed" in week 1 is re-inspected
  only when it is again the oldest — on a 300-page site at 150/run that is every two weeks, so an `index_by` deadline can pass with a
  stale reading. And `seo_page_watch` keeps **one row per site × URL, overwritten** (`ladder_common.py:286-298`: `inspect_at`,
  `index_state`, no history), so "indexed *by* 2026-11-16" cannot be decided when the next inspection lands after the deadline.
- Fix: put advised URLs into `Inspect_Requests.js` (not Watch Plan) with a third ordering key "a prediction is due within 7 days";
  add `first_indexed_at` / `first_seen_unindexed_at` columns to `seo_page_watch` (ladder_common + `sync_tables.py`) written by
  *Inspect Rows (Site)*; score `index_by` from `first_indexed_at`, and as `not_judged:not_inspected` when no inspection fell in
  [deadline − 7 d, deadline + grace].

### 2. High — the publish check keeps no page text, and our draft is not in n8n at all (§3.2 "what they changed before publishing", P0)
- Evidence: `v5/code/Publish_Check.js:31-32` builds `text` and keeps only `words`; its output (`:139`) carries title / H1 / meta /
  word count, not the body. `seo_content_log` stores status, not the draft (`ladder_common.py` CONTENT_LOG cols; R4 §1). Most
  publications are **not** seen by Publish Check at all: the Site Tracker's publish detection fetches the page (`Detect_Published.js:1-4`,
  `max_html_chars: 300000`) and explicitly does *not* run the publish check. The draft text exists only in the app
  (`reports.payload.markdown` / `html` of the `content` callback).
- Problem: "the publish check already fetches the live page: diff it against our draft with `_shingle.js`" cannot be done in the
  engine. Also: the live HTML carries the site's nav/footer chrome (an `edit_ratio` on the whole page is meaningless), client-rendered
  sites return an empty shell to a raw GET (G14), and a refresh of an existing URL is matched only when the sitemap `lastmod` moved.
- Fix: the diff runs **in the app**. Engine side: *Detect Published* and *Publish Check* return a bounded `live_main_text` (main content
  only — the same extraction the audit uses —, ≤ 60 KB) on the `site_tracker` / `published` callback. App side: diff against the stored
  draft of the same keyword (`reports` of stage `content`, newest before `published_at`), only draft→live direction (share of our
  8-word shingles kept), plus heading/title/meta diff; a body under ~150 words is `not_judged:not_rendered`. Port `SHG.words/shingles`
  to `app/shared` (mirror asserted by the build, see #24).

### 3. Medium — `Build_Site_Callback.js` builds nothing; the advice lives elsewhere (§3.1 "Engine side", §8)
- Evidence: `v5/code/Build_Site_Callback.js:1-10` is a 10-line pass-through that attaches the PDF. The weekly actions / `watch` come from
  the *Site Brief* agent via `Site_Report.js`; in the main workflow eleven `Build … Response` nodes funnel through one node,
  *Run Cost (Callback)* → *Has Callback?* → *POST Callback* (traced in `workflows/SEO_Agent_v4.json`); each monitor has its own report node
  (`AI_Report`, `BL_Report`, `LB_Report`, `Growth_Report`, `Pulse_Metrics`, `Tracker_Report`, `Cadence_Note`) + `_ledger_cb.js`.
- Fix: list the real emitters (§B below). Use the two existing choke points for the **stamp** (`pack_version`, `predictions_schema`):
  *Run Cost (Callback)* for all eleven main-workflow callbacks and `_ledger_cb.js` for the monitors — one edit each instead of 18.

### 4. Medium — recommendation ids are not stable enough to carry a stored state (§3.2 `recommendation_states`, L5)
- Evidence: `app/server/src/services/recommendations.ts:244` `engine:${source}:${type}:${a.keyword ?? a.action.slice(0, 60)}` — the
  fallback is Claude's action sentence, re-worded every week; `:303` `ai:gap:${g.prompt.slice(0, 80)}` changes when a question is
  edited; aggregate ids (`bl:followup`, `bl:outreach`, `links:approve`, `ai:low`) keep one id while their content changes completely.
  Ids are also not site-scoped (state must be keyed `site_id + id`).
- Problem: a dismissal of an `engine:` item never matches next week's item; a dismissed aggregate hides next month's new prospects.
- Fix: give every recommendation a `kind` (stable family, e.g. `engine:site_tracker:refresh`) and a `subject` (keyword / URL / domain);
  store state on `(site_id, kind, subject)`; aggregates are not dismissable, only snoozable with an expiry; add a unit test that the same
  inputs a week later give the same keys.

### 5. Medium — finding "type" has no stable id (L1, `subject_ref` `site_id:finding_key:audit_id`)
- Evidence: `v5/code/Finding_Rows.js:3` and `Audit_Diff.js:42`: `finding_key = category + '|' + title` with digits replaced. There is no
  check id (no `check_id` / `rule_id` anywhere in `harness/code_v4/`).
- Problem: any copy edit of a finding title (several happened: B-17, R10, R92) silently resets every L1 posterior and splits buckets;
  titles that embed a URL or a host make one bucket per page.
- Fix: add a stable `check_id` to each audit finding (the probe that produced it) and a `seo_audit_findings.check_id` column; bucket L1
  on `check_id`. Until then L1 cannot be built.

### 6. Low — the rest of the named hooks exist as claimed
- `ingestCallback` (`app/server/src/services/runs.ts:484`), `PW.recheck` (`_page_watch.js:194`, rule list `:170-186` — about ten
  raw-HTML rules only), `Audit_Diff.js`, `_shingle.js` (`SHG`), `Brief_Context.js` (fields carry to the Copywriter because *Parse Brief*
  spreads `$('Brief Context')`), `seo_events.json` → `seo_events.py` → `_annotations.js` / `_site_stats.js` /
  `app/shared/src/seo-events.generated.ts`, `LINK_BUILDER_JOBS` (`app/server/src/config.ts:51`, `index.ts:70-74`), admin panel
  (`app/server/src/services/admin/*`, `routes/admin.ts`; not deployed yet per memory). `request_id` is the API front door's execution id,
  **not** the working execution (`services/admin/costSync.ts` header); the working one is `execution_id` on the callback — §3.1 says
  "request_id to the engine execution", fix the wording and store both.

---

## B. Do the predictions reach the app?

### 7. High — callbacks are fire-and-forget: no retry, errors swallowed (§3.1, §5.1 "a failed prediction can never be dropped")
- Evidence: `workflows/SEO_Agent_v4.json` *POST Callback* and `SEO_Agent_Site_Tracker.json` *POST Site Report*: `retryOnFail` unset,
  `onError: continueRegularOutput`, timeout 20 s / 30 s. The app and n8n share one **spot** VM (`deploy/gcp/compose.prod.yml`), so a
  preemption, an app deploy/restart or a slow ingest (PDF + images in one body) drops the callback for good.
- Problem: the ledger's promise "never dropped" is false at the source; coverage falls silently (Rule 1). Adding plain retries would
  duplicate reports *and* predictions, because `reports` has no unique key on the callback (`runs.ts:502-520` always inserts).
- Fix: (a) give every callback an idempotency key (`execution_id + stage + item index`), make `ingestCallback` upsert on it (reports and
  predictions); (b) then turn on 3 tries / 5 s on the POST nodes (retry_lint already wants it for external calls); (c) the weekly job
  reconciles "runs the engine ledger settled (`seo_run_ledger`) with no stored callback" and shows them as `not_recorded` in coverage.

### 8. High — scheduled advice reaches the app only for sites whose n8n rows point at it (§3.1, §6 coverage)
- Evidence: every schedule reads its delivery address from `seo_sites.callback_url` / `seo_ladders.callback_url`
  (`_monitor_sites.js:33-34`, `Watch_Plan.js`, `Cadence_Plan.js:63`). The app sets it only in `routeSiteToApp` (`runs.ts:403-410`), called
  on verification (`routes/sites.ts:81`, but it only *updates* existing rows — none exist before tracking) and when tracking is saved
  (`runs.ts:263`). `services/data.ts:140` (`reportsToThisApp`) and the recommendation `setup:delivery` (`recommendations.ts:138`) exist
  precisely because sites drift away from the app. A site never put on tracking has no schedules at all. Page Watch posts no report to
  the app (only `Post Refusal (Watch)`); its alerts go to the alert channels. `ingestCallback` drops the site link when the callback's
  `domain` is not a site of that company (`runs.ts:496`) — a prediction with `site_id NOT NULL` then cannot be written.
- Fix: P0 acceptance must include, per site, "reports route to this app" (`reportsToThisApp === true`) or the coverage line says "not
  recording: this site's weekly reports do not reach Alaventra"; never fail the callback when a prediction cannot be attached (wrap it like
  `deliverReport`, `runs.ts:556`), log it as `not_recorded`.

### 9. High (design) — the cheapest P0 does not need the engine: derive predictions from the payloads the app already stores (§3.1, §10 P0)
- Evidence: `ingestCallback` stores the whole payload (`runs.ts:510-516`); `services/summaries.ts` already reads per-stage fields
  (verdict, score, health score, findings counts, ladder fields). Every claim the plan lists for P0 is already in a payload: verdict /
  fit (`content`), findings (`site_audit` / `full_report`), chance band + months + expected visits (`ladder_plan`, R4 §1), weekly
  actions + `watch` (`site_tracker`), targets (`ai_growth`), prospect score (`backlinks`, `link_builder`), cost estimate
  (`run_cost_estimate_usd`, every main callback), keyword check chance (`keyword_checks.result`).
- Problem: putting `_predict.js` in ~18 engine builders + `predict_lint.py` + a mirror + an engine deploy (owner-only, refused by the
  classifier, never on a Monday) makes P0 depend on the slowest path. It also makes retro backfill a second implementation.
- Fix: P0 = an app function `predictionsFromReport(stage, payload)` (beside `summarize()`), called in `ingestCallback`, and the same
  function run once over every stored report for the week-0 baseline (`origin: retro`). Engine-side `_predict.js` only later, for claims
  not in any payload today (content score, editor/critic numbers), with `predict_lint` then. One implementation, no engine deploy, and
  the frozen rule table lives in `app/shared/src/learning.ts` only.

### 10. Medium — the "advice-emitting callbacks" list is incomplete and mixes in a synchronous path (§3.1)
Real callback stages (`app/shared/src/constants.ts` MODES / AUTOMATIONS, `ReportView.tsx` RENDERERS) and what is checkable:
| Stage / path | Checkable claim | In plan? |
|---|---|---|
| `content` (verdict) | keyword fit, verdict score, `existing_page` "improve, don't add" | yes |
| `content` (page) | `qa_publishable`, content score (only in meta.json, not stored) | partly |
| `keyword_strategy` | priority / quick-win keywords → fit, first impressions | **no** |
| `site_audit` / `full_report` | each finding real; health score | yes |
| `ladder_plan` | chance band, months range, `expected_visits_top3`, rung targets | yes (rank_band) |
| `rank_tracker` | `_replan` proposals (accepted?), `won` | **no** |
| `site_tracker` | Site Brief `actions` (≤ 5) and **`watch` (0-3 re-checks next week — explicit, dated predictions)**, decay / striking-distance calls | **no** (only "Build_Site_Callback") |
| `content_cadence` | which pages it chose (and the natural control set §5.4) | **no** |
| `ai_visibility` / `ai_pulse` | lost questions, Holm-flagged alerts (alert precision) | partly |
| `ai_growth` | questions to win (`seo_ai_targets` won/lost), readiness scores, IndexNow/Bing submissions → crawled-by | partly |
| `backlinks` | prospect score, "lost = two misses", spam labels | partly |
| `link_builder` | qualification, `pickTarget`, reply likelihood | yes |
| `published` | publish-check ✅/❌ | **no** |
| Keyword Check (`POST /webhook/seo-keyword-assess`) | chance / base rate / plan type | **synchronous** — stored by `services/keywordCheckStore.ts:82`, never through `ingestCallback` |
| Reply Reader | reply class (user can correct it) | synchronous, `outreach_sequences.replyClass` |
| Page Watch | alert precision | no callback at all |
- Fix: adopt this table as the closed `advice_type` list; keyword checks and reply readings write predictions from their own services.

---

## C. Postgres RLS

### 11. High — FORCE RLS as written breaks the app's own connection model, admin views and CI (§3.1, §9 "Tenant isolation")
- Evidence: the app connects as one role, `app`, which **owns** the `app` database and runs the migrations
  (`deploy/gcp/postgres/initdb.sh`, `compose.prod.yml:214`), so it owns every table; one global pool, `postgres(..., { max: 10 })`
  (`app/server/src/db/index.ts:10`); requests use the global `db` with no per-request transaction; background work runs on plain
  `setInterval` timers (`server/src/index.ts`). Dev and CI connect as the **superuser** `seo` (`app/compose.dev.yml:9`,
  `.github/workflows/ci.yml:53-63`), and superusers always bypass RLS, FORCE or not. The only `set_config` in the app is the audit
  purge (`services/audit.ts:152-160`).
- Problems: (a) with FORCE, every read/write of a learning table must run inside `db.transaction` with
  `select set_config('app.company_id', $1, true)` (`SET LOCAL` cannot take a bind parameter); (b) a forgotten setting with
  `current_setting(..., true)` returns NULL → **zero rows, no error** — the staff scorecard would silently read "0 predictions" (Rule 1);
  (c) cross-company work — the weekly grading loop, pooled calibration, `/admin` advice quality, company erasure
  (`services/companyDelete.ts`), the read API `/api/v1` and MCP exports — needs a bypass; (d) the isolation test the plan promises would
  pass trivially or fail meaninglessly under the superuser in CI; (e) drizzle-orm 0.45 has `pgPolicy` / `.enableRLS()` but no FORCE: the
  migration needs a hand-written SQL step (`drizzle-kit generate --custom`).
- Fix (realistic): keep FORCE RLS on the new tables, policy
  `company_id = current_setting('app.company_id')::uuid` (no `missing_ok`, so a forgotten setting **throws**); one helper
  `withCompany(orgId, tx => …)` that every learning service must use (a unit test greps `services/learning/` for raw `db.` access);
  cross-company jobs use a second pool on a role `app_staff` with `BYPASSRLS`, created once by the superuser in `initdb.sh` **and** a
  one-off step for the existing prod cluster (initdb only runs on an empty data dir); its use limited to `services/learning/jobs.ts` and
  `services/admin/`; CI creates a NOSUPERUSER role and runs the isolation test under `SET ROLE`. Budget a full session for this alone.

---

## D. Reading outcomes from n8n Data Tables

### 12. Medium — the reader truncates silently at 2,000 rows (§3.3.1)
- Evidence: `app/server/src/n8n/client.ts:241` `const max = q.max ?? 2000;` — the loop stops at `max` and returns what it has; no flag says
  the read was incomplete. Filters are AND-only (no `in`), 250 rows a page, 20 s timeout per page.
- Cost/time estimate: per site ≈ 8 tables (page watch, page outcomes, rank history, audit findings, AI visibility + answers, backlinks,
  link outreach), mostly < 2 pages each → ~20 requests/site, ~1-3 minutes for 10 sites on the shared 2 vCPU. Cheap; the 60 s cache is
  irrelevant (use `fresh: true`). Memory (app 384 MiB) is fine if sites are processed one at a time.
- Fix: a `rowsComplete()` variant that returns `{ rows, complete }`; an incomplete read scores nothing (`not_judged:not_read`, Rule 1/3);
  filter every read by `domain` + `gte` on its date column from the oldest due prediction.

### 13. Medium — pull vs push: keep the pull for outcomes, but read before the engine prunes (§3.3.1, §3.2)
- Evidence: `seo_ai_answers` is pruned at 120 days and pulse rows at 21 days (`build_monitors.py:378`, `:439`); `seo_page_watch` is
  overwritten (#1); n8n execution history is 14 days.
- Assessment: the Data Tables are the durable record; callbacks are lossy (#7) — so pulling outcomes is *more* reliable than pushing
  them. Pushing is right only for data the engine computes and does not store: the new page×date outcomes (#15) and the live main text
  (#2).
- Fix: outcomes the engine already stores → pull; the new GSC page×date rows → write them to `seo_page_outcomes` **and** do not add a
  push; `ai_cite` predictions must have `check_at` ≤ 21 days for pulse-based evidence, or score from the kept weekly aggregate
  `seo_ai_visibility`; record every outcome's source row and read time in `evidence`.

---

## E. n8n specifics

### 14. High — the eval gate has no production runtime, and its regeneration is not budgeted (§3.6, P2 acceptance)
- Evidence: the harness is a dev tool: `harness/README.md` (docker cp into the n8n container, run `scenarios_v5.js` against
  `code_v4/`, 14 MB); nothing in `deploy/gcp`, `n8n/deploy/Dockerfile` or `app/Dockerfile` ships it. "The site's frozen fixtures (last N
  findings, briefs, keyword suggestions, prospects)" are not captured anywhere (briefs live only in report payloads; executions are kept
  14 days). A "sampled regeneration" of a page is a page run (≈ $0.80–1.40, CLAUDE.md cost notes), not the $0.02–0.05 of §3.5/§9.
  Client fixtures cannot go into `harness/` either: the repo is **public**.
- Fix: split the gate. Numeric learnings (L1, L2, L5, L6, L8, L11): replay in the **app** against the TS mirrors that already exist
  (`keywords.ts` ↔ `_reach.js`, `cadence.ts` ↔ `Cadence_Plan.js`) on fixtures stored in an app table (`learning_eval_fixtures`, RLS);
  check "no gate refusal changed" there. Prompt learnings (L3, L4): no automatic regeneration; activation = approval + the next real run
  shows a diff against the previous version of the same page type, with a one-click rollback; an optional paid regeneration is an
  explicit, ledgered, priced action. Harness scenarios S-learn-* test the *kit*, not a client's pack.

### 15. Medium — the Site Tracker already queries by page; page×date is new but cheap — the dispersion φ is not (§3.2, §3.3.3)
- Evidence: `v5/code/GSC_Requests.js:19-26` (`query×page`, `page` for current / previous / year-ago 28-day windows) — no `date`
  dimension per page; `by_date` (`:17`) covers 56 days site-wide. `seo_site_metrics` holds weekly rows only since tracking started
  (2026-10).
- Problems: "dispersion φ measured from its 16 months of Search Console history" needs a new 16-month `date` request per site (not
  stored today); the page×date filter needs a `dimensionFilterGroups` page regex in GSC's exact URL spelling (www / slash — the
  host-agnostic rule in CLAUDE.md); `dataState: final` lags ~3 days. Quotas are not a concern (searchAnalytics per-site QPM is high; one
  extra request per site per week).
- Fix: two new requests in `GSC_Requests.js` (advised-URL page×date over the last 112 days; site `date` over 16 months, cached monthly in
  `seo_cache`), rows → `seo_page_outcomes` via ladder_common + `sync_tables.py` (an *Ensure* node never adds a column), feed the upsert
  exactly the table columns (CLAUDE.md), and a URL key normalised with `PW.helpers.ukey`.

### 16. Medium — URL Inspection quota is not the constraint; the deadline is (§3.2)
- Evidence: `_page_watch.js:279-282`: 2,000/day/property, Site Tracker 150 per weekly run, audit 100 per run; Page Watch uses none.
- Assessment: adding a few dozen advised URLs costs nothing. On-demand audits on a bad day can take 100 × n of the same property's day
  quota; a quota error is already `not_checked` (`:315-319`).
- Fix: map `not_checked` (quota, access missing, failed) to `not_judged:not_inspected`, never `miss` (Rule 3); see #1 for ordering.

### 17. Medium — the policy pack touches more workflows than "one Data Table get" suggests (§3.4)
- Evidence: Code nodes cannot read Data Tables (R2 §2.4); each consuming workflow needs a new *Load Policy Pack* node, and every consumer
  Code node must read `$('Load Policy Pack')` inside try/catch (a node off the execution path throws). Consumers: main workflow
  (`build_v4.py`: Brief Context, reach / discovery / ladder nodes, Content QA for L4), Keyword Check (`build_api.py`, L2), Content Cadence
  (`build_site_tracker.py`, L2 — and its mirror `app/server/src/services/cadence.ts` must change in the same commit), AI Visibility +
  AI Pulse (`build_monitors.py`, L6), Link Builder + Backlink Monitor (L7), Site Tracker (Site Brief block, L8). That is **6 builders,
  ~8 workflows, ~15-20 Code nodes**, plus the stamp at the two choke points (#3). Multi-site schedules must load *all* packs once and
  pick per site.
- Fix: size P2 accordingly (#25); make L1, L5 and L8 **app-only** (folding a finding type, ordering recommendations, the "normal
  time-to-index" line are display decisions the app already computes) so the engine pack starts with L2, L4, L6, L7 only.

### 18. Medium — learned writing rules will fight Content QA and the editor loop (L4, §3.4 injection)
- Evidence: the injection list (§8) is strategy_brief / copywriter / editor / site_brief. `editor.txt:14` injects
  `content_qa.missing_terms` ("Terms that must appear"), and the style guide is checked in QA (`_style_guide.js` `ST.check`, build
  `build_v4.py:4612-4630`); the Critic (`critic.txt`) sees no learnings.
- Problem: a rule "never say 'e-invoicing solution'" while QA's term list demands it makes the QA rounds oscillate and the page fail
  "not ready" (R11 behaviour) — a learning that makes the system refuse more, invisibly.
- Fix: L4 rules compile into the same structure as the style guide (`style_*` banned / preferred terms) so `ST.check`, the term list, the
  Critic and the Editor all see them; a pack rule that conflicts with a required term is rejected at compile time.

### 19. Medium — the Reflector needs two workflows, a ledger mode, a cost owner and a stage that is never delivered (§3.5)
- Evidence: CLAUDE.md "a workflow started by Execute Workflow before the webhook answered ran no node — answer first, then start" (the
  Link Builder pattern is `SEOagentLinkBAPI` + `SEOagentLinkBld1`); new ledger modes go in `LEDGER_EST` (`ladder_common.py:378`), the
  ledger mainline proof (build section 55) covers a fixed list of workflows, the app mirrors costs in `app/shared/src/cost.ts`, and
  admin `costSync` attributes engine rows by key (`app:<company>`, `parent:`, domain). Delivery: `deliveryDecisionFor`
  (`app/shared/src/report-delivery.ts:286-289`) holds a stage only when the company chose a stage list — with "all stages" a new
  `learn_reflect` callback would be **delivered to the customer as a report**.
- Fix: `SEOagentLearnRAPI` (202) + `SEOagentLearnRf1` (worker), run guard + rate limit, ledger key `app:<company>:<site>`, mode in
  `LEDGER_EST` + `cost.ts`, added to the section-55 list and `deploy_manifest.json`; the proposals come back on a stage that
  `ingestCallback` routes to `learnings` and that `INTERIM_STAGES` / the delivery rules exclude; owner decision: who pays (credits).
  Drop "a Code check discards a proposal that contradicts the business profile" — not decidable in code; keep the deterministic checks
  (cites ≥ 1 existing evidence id, scope in the closed list, length, no gate vocabulary) and rely on the approve tier.

### 20. Low — lints: feasible, with the INVARIANTS lesson applied (§3.1 `predict_lint`, §3.4 `pack_lint`, `gate_lint`)
- `predict_lint` has the shape of `lineage_lint.py` (`_delivers`, `own_code`, `strip_comments`, a self-test); per #9 it belongs to the
  later engine phase. Its first question ("what does it not look at"): callback payloads built in builder-inline code (*Build Webhook
  Response* lives in `build_v4.py`, not `v5/code`) and the monitors' report nodes.
- `pack_lint` ("prompt nodes read learnings only through the kit") is a text check over prompt files + Code nodes — fine.
- "gate_lint gets the pack as a new read path" does not fit: gate_lint checks gate-kit/table pairs; the pack is not a table read by a
  gate. "Gates run after the pack" is an ordering property inside Code nodes — prove it with a harness scenario per gate (a pack that
  up-weights a refused keyword; the refusal must stand), not a lint.
- Frozen node ids (`ladder_common.py:911-951`, uuid5 of workflow:node) are unaffected by new nodes; renaming a node changes its id.

---

## F. Statistics and design inconsistencies

### 21. High — L1 cannot fire in week 1 (or for months) under the plan's own prior (§3.3.3 vs §4 L1)
- Evidence: §3.3.3 starts "finding is real" at **Beta(≈10, 1)**; §4 L1 acts at "3 labels of one type, posterior P(real) < 0.3".
- Arithmetic: after 3 of 3 "not true" the posterior is Beta(10, 4), mean 0.71. P(real) < 0.3 needs 10 / (11 + f) < 0.3 → **f ≥ 23**
  negative labels of one finding type on one site — before the 0.97ᵂ discount makes it slower still.
- Fix: decide which it is. Either L1 is a **preference** ("show folded what you told us you don't care about"), triggered by 3 labels
  with no posterior and never counted as accuracy, or it is a **truth** claim that needs the live re-check and a much weaker prior
  (e.g. Beta(2, 1) per check_id, with the accuracy set only as the staff-level calibration).

### 22. Medium — "won't fix" is not "not true", and some findings must never fold (L1, §5.5)
- Problem: L1 pools "not true" and "won't fix" into P(real); that pollutes the staff accuracy the plan says it keeps. Folding a
  Critical/High indexability finding (noindex, 4xx key page, robots block) is hiding a safety warning, which §4 "never learned" should
  cover.
- Fix: two reason codes, two metrics (truth vs relevance); exclude Critical/High and indexability check_ids from folding; folded
  findings still count in the health score and say so.

### 23. Medium — FDR at q = 0.10 cannot adopt anything that rests on 3–5 observations (§3.3.5 vs L4 "≥ 3 edits", L5 "5 of a kind")
- Arithmetic: the smallest one-sided binomial p-value with n = 3 against a 0.5 null is 0.125 > 0.10 — such a rule can never survive BH,
  even tested alone. With n = 5 it is 0.031, and BH over a month's family raises the bar further.
- Fix: say which learnings are hypothesis tests (cross-site staff rules, L10) and which are bounded, undoable preferences with a floor
  and no test (L1, L2, L4, L5 at site level); state the null for each tested one.

### 24. Medium — confounders are build-time data and scoring is "once": late events can never be applied (§3.3.2, §5.3)
- Evidence: `seo_events.json` is inlined at **build** time into engine kits and the committed `app/shared/src/seo-events.generated.ts`
  (`seo_events.py` docstring), so a new event needs an engine *and* app deploy (owner-only; never on a Monday). `data_breaks` holds one
  entry (`num=100`); the "AI Mode inside Web totals" and "Generative AI report" breaks the plan relies on are **not in the registry**.
  Google posts an update's end only when the rollout finishes (≈2 weeks), i.e. after predictions in that window may already be scored.
- Problems: a prediction scored before the event was entered is never re-judged ("filled once"); applying update windows to *every*
  advice type (binary truth claims like "finding real" or "keyword fits" are not confounded by a spam update) collapses coverage.
- Fix: a runtime table `learning_events` in the app (staff-editable, seeded from the registry; the engine registry stays for charts);
  score effect / rank / traffic claims only after `check_at + grace + 14 d` so a rollout's end is known; allow exactly one re-score from
  a hit/miss to `not_judged:confounded` (logged, never the reverse); apply confounders only to outcome-type claims; add the two missing
  breaks to `seo_events.json`.

### 25. Medium — `index_by` / `first_impr_by` cannot have a frozen `check_at` at creation (§3.1)
- Problem: the advice ("this page will be indexed by week 4") is made when the page is *written*; the anchor is publication, known
  only later — and the Site Tracker's detection dates it to the weekly run, up to 7 days late (`Detect_Published.js`).
- Fix: freeze `{anchor: 'published', offset_days: 28}` at creation; the row is *armed* (check_at set once) when the anchor is observed,
  with the anchor's source and precision in `evidence` (sitemap lastmod if present, else detection date); never published within 90 days
  → `not_judged:not_applied`.

### 26. Medium — L6 automatic rotation breaks the AI visibility trend it feeds (L6)
- Evidence: `v5/code/AI_Metrics.js:351-358`: under **80%** of question ids in common, no delta is computed ("a different panel, not a
  different result"); techand.ai runs an 8-question panel, so rotating 2 questions (25%) disables every week-over-week comparison.
- Fix: rotate at most one question per site per 4 weeks and never more than 10% of the panel per month, or rotate only in the monthly
  full run; show the rotation in the report as the reason a delta is missing; auto tier only for panels ≥ 20.

### 27. Low — retro rows and `not_judged` reasons need two more codes (§3.1, §3.3.2)
- Add `not_judged:not_read` (an outcome table could not be read or was truncated — Rule 3) and `not_judged:not_recorded` (the advice
  never reached the app — #7/#8). Add a unique key `(company_id, source_ref, advice_type, subject_ref)` so a replayed callback or a re-run
  backfill cannot double-insert into an append-only table.

### 28. Low — the statistics module is not "~300 lines" (§3.3)
- The math (Beta, gamma-Poisson, Wilson, Brier + decomposition, PAV/CORP reliability, BH, discounting, drift) is ~400-600 lines with
  tests; the bulk is the per-advice-type **collectors** (≈ 12 types, each with its own outcome join, censoring and evidence) — another
  800-1,500 lines. Plan the work by collector, not by formula.

---

## G. pgvector (P3)

### 29. Medium — compiling pgvector into the alpine image is feasible but drags four pipelines; you probably do not need it (§10 P3, D5)
- Evidence: prod, dev and CI all use stock `postgres:17-alpine` (`compose.prod.yml:60`, `app/compose.dev.yml:7`, `ci.yml:53`); one
  server holds both the `n8n` and `app` databases, so swapping the image restarts the engine's database too; `initdb.sh` runs only on an
  empty data dir; the app migrates as the non-superuser `app`; `backup.sh` dumps both DBs with `pg_dump -Fc` and a restore needs the same
  extension present; `images.yml` builds only `alaventra-api` and `alaventra-engine`.
- Problems: a custom image must be built in CI (not on the 4 GB VM), pushed to GHCR and used by prod, dev **and** the CI service
  container; `CREATE EXTENSION vector` must run as the superuser once per environment (verify whether this pgvector version marks itself
  trusted before relying on the `app` role); the alpine build needs `clang`/`llvm` matching the server's JIT or `with_llvm=no`.
- Fix: at our scale (hundreds of pages per site, exact search per tenant) store embeddings as `real[]`/`bytea` in an RLS table and compute
  cosine similarity in the app (1,000 × 512 dims is ~0.5 M multiply-adds per query). No extension, no image, no restore risk. Revisit
  pgvector only past ~50k vectors per tenant (the threshold R2 itself gives for HNSW).

---

## H. Rules and working rules

### 30. Medium — INVARIANTS / working-rule gaps the plan does not mention
- **Rule 4 (nothing exists until delivered)**: pack activation writes the app row and then the n8n row (`client.ts` `upsertRow`); they are
  not atomic. A pack is `active` only when the n8n row reads back with the same `content_hash`, and a learning is `applied` only once a
  run's callback carries that `pack_version`. `state_lint.py` scans n8n workflows only — the app-side `proposed → approved → active`
  machine needs its own unit test, not "state_lint rule 4".
- **Rule 1**: every score row stores the read's completeness and source (#12); folded findings and coverage print n and range.
- **Rule 2**: L5 "dismissed: already done elsewhere suppresses it" must not suppress `content:fix:*` (R111, a draft that failed QA),
  `setup:delivery`, or any recommendation that exists because a gate refused something.
- **Public repo**: edit diffs, client notes and eval fixtures are client data — never in `harness/`, `docs/` or commits (#14).
- **Mirrors**: existing engine↔app mirrors are proved by `build_v4.py` reading the app file (e.g. `build_v4.py:6700-6702` for
  `cadence.ts`), not by a harness scenario (the harness runs in the n8n container without `app/`). Use the same build-section pattern.
- **Data Table columns** only through `ladder_common.py` + `sync_tables.py`; deploys never Monday 07:00-12:00 New York; engine deploy is
  `deploy/gcp/deploy_engine.py` over the tunnel and is the owner's.
- **Business pages follow the product**: FeedbackControl and "What we learned" are customer-visible → `features.ts`, `changelog.ts` and
  the pages that list capabilities, in the same commits.

### 31. Medium — the app's weekly job needs a persisted due time, not "Sunday 20:00" (§3.3, §8 "no catch-up entry needed")
- Evidence: app jobs are bare `setInterval` timers (`server/src/index.ts:23-110`); the only catch-up-safe one is the delivery tick, which
  stores `organizations.deliveryLastRunAt` and computes the next due time (`services/reportDelivery.ts:373-390`). The VM is spot.
- Fix: `learning_job_runs (job, week, started_at, finished_at, status)`; an hourly tick runs the job when the week's row is missing and
  it is after Sunday 20:00 New York; a run that died mid-way resumes (scoring is idempotent per prediction). "No n8n catch-up entry" is
  true; "no catch-up" is not.

---

## I. Effort and a realistic split

### 32. High — P0 "this week" is 6+ sessions, and part of it waits on an owner-only engine deploy (§10)
- Count for P0 as written: app — schema + hand-written RLS migration + `withCompany` + staff role + CI role (≈ 6 files), ingest hook,
  keyword-check hook, feedback + recommendation-state routes and services (≈ 6), `recommendations.ts` keys (#4), shared `learning.ts` +
  schemas, web `FeedbackControl` + wiring into ~12 renderers/pages (`components/reports/*.tsx`, `pages/site/*.tsx`) + queries, tests
  (server 4-5 files, shared 2); engine — `_predict.js`, edits in ~18 callback builders across 5 builders, `predict_lint.py` + self-test,
  `Inspect_Requests.js` + `seo_page_watch` columns, `GSC_Requests.js` + parser + `seo_page_outcomes` + `sync_tables`, Detect/Publish
  `live_main_text`, harness scenarios; marketing 2-3 files. **≈ 50-60 files.**
- Proposed sessions (one commit + push each, harness / app tests green, marketing where visible):
  1. **App ledger core**: migration 0015 (`learning_predictions`, `learning_signals`), RLS done properly (#11), `predictionsFromReport`
     for `site_audit` / `full_report` / `ladder_plan` / `content` + keyword checks, idempotent, never failing the callback (#7, #9, #27).
  2. **Week-0 baseline**: the same function over every stored report (`origin: retro`), per-site coverage incl. `reportsToThisApp` (#8).
  3. **Feedback**: `FeedbackControl`, feedback API, `recommendation_states` with stable keys (#4); marketing entry.
  4. **Remaining payload types**: `site_tracker` actions + `watch`, `ai_growth`, `backlinks`, `link_builder`, `rank_tracker` replan,
     `published`, `content_cadence` control sets (#10).
  5. **Engine outcomes** (one deploy, not Monday): advised URLs + due-date ordering in *Inspect Requests*, `first_indexed_at` (#1),
     GSC page×date → `seo_page_outcomes` (#15), `check_id` on findings (#5), callback idempotency key + retries (#7).
  6. **Edit diff**: `live_main_text` on `published` / `site_tracker` callbacks + app diff (#2).
  Then P1 ≈ 3 sessions (collectors + math with `rowsComplete`, the page, `/admin` view, `learning_events` + the persisted weekly job),
  P2 ≈ 5-6 sessions (packs + n8n table + kit in 6 builders, Reflector pair, approvals/undo, app-side eval, L2/L4/L6/L7), P3 ≈ 2 without
  pgvector (#29). Realistic calendar: P0 in ~2 weeks, first honest verdicts ~4 weeks after session 1 lands — which still meets the
  plan's "start recording now" goal, because session 1 + 2 alone start the clock and backfill week 0.
