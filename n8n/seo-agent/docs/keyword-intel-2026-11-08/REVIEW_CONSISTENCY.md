# KI review: consistency / completeness (2026-11-08)

Independent, read-only review of the frozen snapshot `.claude/worktrees/ki-review` at `1e977e8f` (production base `461445de`), against
CLAUDE.md working rules, `DESIGN.md`, `CONTRACTS.md` and the fix notes (`fixes/A1.md`, `A2.md`, `E2.md`, `OPEN.md`). Question asked: is KI
present everywhere it must be, absent where it must not be (Off sites, portal, Trial for non-admins), and consistent (labels, verdict
words, credits, striking distance, caps, TTLs)? File:line references are in the snapshot. Known open items O1-O9 of `fixes/OPEN.md` are
not repeated as findings.

Summary: the registries are wired with care (modes, stages, schemas, payload order, front door, watcher, ledger proof, lints, Site Admin,
sync_tables, deploy manifest, guides, marketing registry, changelog, backlog rows). The gaps are in the paths A1 did not filter for
Trial (delivery digest, Overview, runs, credits), two lists every company sees, and a few places where KI brought a second definition of
something (striking distance, gate reasons, verdict wording, "AI judgement").

## 1. Places checked

Status: P = present and consistent, M = missing, I = inconsistent, A = correctly absent, N = not applicable.

| # | Place | Status | Note |
|---|---|---|---|
| 1 | `shared/src/constants.ts` MODE_IDS / MODES (title, eta 6 / 12, siteBound, final + start stages, `hidden`) | P | eta = CONTRACTS 3 and front door `build_api.py:58` |
| 2 | `constants.ts` STAGE_LABELS (4 KI stages) | P / I | labels fine; also feed two unfiltered lists (finding M1) |
| 3 | `constants.ts` LISTED_MODE_IDS, RunsPage tool filter | P | |
| 4 | `constants.ts` SCHEDULED_STAGES, `server/services/runs.ts:758` SCHEDULED_STAGES | A | on demand only until W2 refresh |
| 5 | `shared/src/schemas.ts` RUN_SCHEMAS + union | P | competitors max 5, seeds max 20 x 120 |
| 6 | `shared/src/payload.ts` key order (head, competitors, seeds, ki_force) | P | `seeds` not `keywords` (fuzzy-match rule respected) |
| 7 | `export-payloads.ts` + `harness/fixtures_platform.json` + S23 (`scenarios_v5.js`, target ki) | P | |
| 8 | `shared/src/cost.ts` COST_TABLE / CostKey; `_cost_cal.js` EST + DFS_EST; `ladder_common.py` LEDGER_EST | I | Claude money quoted, none spent (M4) |
| 9 | `cost.ts costKeys('discover')` (R2 H1 fix) + discovery form | P | |
| 10 | `shared/src/tables.ts` TABLES (4) + MonitorsRow ki_* | P | |
| 11 | `ladder_common.py` 4 tables + MONITORS_COLS ki_* + KI_MONITOR_COLS | P | |
| 12 | `sync_tables.py` (iterates every `_TABLE`/`_COLS` pair) | P | |
| 13 | `deploy_manifest.json` workflows + publish + comment (--create-missing, sync_tables) | P | |
| 14 | `build_v4.py` sub-build list + section 55 ledger proof (15 workflows) | P | |
| 15 | `build_catchup.py` EXPECTED, cycle dispatcher, `shared/src/cycles.ts` | A | no schedule |
| 16 | KI workflow settings (errorWorkflow SEOagentErrHandl, timeout 1800 s) | P | timeout < watcher overdue (3 x 12 min) |
| 17 | `retry_lint.py` ALLOW (3 callbacks), `gate_lint.py` pair, `dfs_gate.py` | P | |
| 18 | API front door Quick Validate (modes, domain required, seeds checks, ETA, sticky note) | P | |
| 19 | Site Admin: `Admin_Action.js` actions + ki_* validation, Monitor Row Admin / Track (carry as stored), delete chain (4 KI tables before the site row, asserted) | P | |
| 20 | App site delete `clearKiInEngine` + `invalidateKi`; company delete through `stopInEngine` | P | |
| 21 | Run watcher `engineFailures.ts` WATCHED | P | |
| 22 | `engineFailures.ts` RETRYABLE | A / I | KI excluded while ai_visibility / backlinks are in (L11) |
| 23 | `summaries.ts` summarize (4 stages, trial, partial, missing) + titleFor | P | |
| 24 | `report-delivery.ts` INTERIM_STAGES, finishedStatus partial, HoldCode `trial` | P / I | the `trial` hold is still logged and listed in digests (H1) |
| 25 | `runs.ts` assertKiRunAllowed, noResultOf, invalidateKi, no event for Trial | P | |
| 26 | Reports routes (list / detail / run detail) Trial filter | P | filter applied after `limit` (L13) |
| 27 | Website Overview "Latest reports" (`recommendations.ts overviewData`) | M | Trial report shown to everyone (H1) |
| 28 | Runs list / run detail run row / API v1 list_runs | M | Trial run shown to everyone (H1) |
| 29 | Credits for Trial runs (quote, charge, usage ledger) | M | charged to the client company (H1) |
| 30 | Needs you `failedRuns` | M | failed Trial run shown (H1) |
| 31 | Share links (`shareLinks.ts` refuses Trial) | P | |
| 32 | Webhook / Slack / Teams events (`emitForCallback` skipped for Trial); stage-specific templates (`integrations.ts`) | P / N | generic templates suffice |
| 33 | Delivery stage chooser `DeliveryTab.tsx:39` | I | shown to every company, Off included (M1) |
| 34 | Reports page type filter `ReportsPage.tsx:89` (all STAGE_LABELS) | I | 4 KI stages for every company (M1) |
| 35 | API v1 `list_modes` / `modesV1` hidden modes | P | per-website listing is O2 |
| 36 | API v1 / MCP `get_table` enum + `tableRowsV1` (On only), `EXPORT_TABLES` unchanged | P / A | |
| 37 | API v1 reports exclude Trial (`apiV1.ts reportRows`) | P | |
| 38 | Recommendations `ki:competitors`, `ki:quick-wins` (On only), `queue.ts` RULE_SCORES | P / I | "quick wins" count differs from the page it opens (M2) |
| 39 | Needs-you kind `ki`: `data.ts`, `ladders.ts` KIND_RANK, `home.tsx` KIND_ICON, `guide-links.ts` | P | |
| 40 | Guides `ki-choose-competitors`, `ki-read-keyword-research`, `ki-verdicts`; GUIDE_FOR_RECOMMENDATION; guide count 97 | P | small over-claims (M6, L12) |
| 41 | Guides on every ask (run forms, choose, approve questions, mode card) | P | CONVENTIONS rule met |
| 42 | Audit actions `identity.ts` (4) | P | |
| 43 | Sidebar `SITE_NAV` / `siteNavFor`, router, portal `PORTAL_SITE_PAGES` | P / A | |
| 44 | Portal reports list (On KI reports) | I | "Open Competitors" leads to a 403 page (L6) |
| 45 | Tools page, tool form, run forms (`forms/ki.tsx`) | P / I | KI lands in "More tools" (L2) |
| 46 | Site header "Run an analysis" menu (`kit.tsx:316`), `RUN_LABEL` (`actions.tsx:78`) | A | pages carry their own run button |
| 47 | Report renderers `ReportView.tsx` RENDERERS, `ReportSummaryLine`, `RunDetailPage` NOTICE_STAGES, `run.tsx` MODE_STEPS, `meta.tsx` MODE_ICON | P | |
| 48 | `meta.tsx` STAGE_MODE (report-row icon) | M | falls back to the describe icon (L1) |
| 49 | `billing.ts` FEATURE_LABEL (usage / credits pages), admin `lib.ts` (MODES titles) | M / P | fallback text happens to match (L4) |
| 50 | Website settings `KiModeCard` (platform admins only) | P | |
| 51 | Pipeline page automations, `pipeline-notices.ts` NOTICE_MODES, onboarding, autopilot rows | A | W2 (monthly refresh, consumers) |
| 52 | Engine weekly report / full report KI sections, cadence.ts mirror | A | W2 (O4) |
| 53 | Parity: verdict words, thresholds, stage weights, score / win / comp weights, cluster rule, gate reason codes (`ki_parity.json`, `ki.parity.test.ts`, KI16) | P / I | app has no word for most gate codes (M3) |
| 54 | Caps: chosen max 5 (app, engine CAPS, Site Admin 1-5, marketing "five"), seeds 20, callback top 20 | P | |
| 55 | TTLs: serp 1 d, ranked 7, volume 30, backlinks 7, homepage 14 (+ competitors 30) = DESIGN 7 | P / I | form says "last few days" (L14) |
| 56 | Striking distance (one definition everywhere, DESIGN 3.11) | I | M2 |
| 57 | Verdict words (KI_VERDICTS = fixture = guide = changelog = marketing) | P / I | differs from the existing "website" wording (M5) |
| 58 | Marketing: `features.ts` (new `competitors`, keyword-research benefit + FAQ), changelog 4.10, pricing matrix, solutions, CapabilityMap, APP_PATH, FeatureVisual + mockup | P | "rolling out" everywhere; sample data labelled; no customers / results invented |
| 59 | Marketing: `search-kinds.ts featureSearchKinds`, `PlatformPage.tsx` LOOP_MAP, "all N capabilities" lines, home grid card | M / I | L5, M6 |
| 60 | No AI tells (em dash, curly quotes, ellipsis char, stock phrases) in new UI / guide / marketing strings | P | only the section sign in code comments; one pre-existing em dash in API.md line 689 |
| 61 | Internal names in customer strings | P / I | "estimate from DataForSEO Labs" reaches the number tips (L10); server errors say "SEO engine" (as elsewhere in the app) |
| 62 | Tutorials backlog `~/Downloads/hiresuite-video-skills/alaventra/TUTORIALS_BACKLOG.md` rows 23-25 (committed b9a1623) | P / M | two touched places not listed (L9) |
| 63 | `app/API.md` KI section, MCP line | P / I | L8 |
| 64 | `app/README.md`, `n8n/seo-agent/HANDOVER.md`, developer guide (`build_docs.py`) | M | stale for earlier features too (L8) |
| 65 | CLAUDE.md "Where things live" (not edited, reported) | M | no SEOagentKIntel1, no `seo_ki_*` tables, no `ki_*` monitor columns |
| 66 | `CHANGES_v3_to_v4.md` | P | |

## 2. Findings

### High

**H1. Trial is not private: the run, its report and its cost reach the client company through five paths A1 did not filter.**
The contract (CONTRACTS 1) and the marketing ("Each website starts with a private trial run by our team", `marketing/content/changelog.ts:40`,
competitors FAQ "Our team first tries it privately") say Trial results are for platform admins only. A1 hid the reports in the reports
routes, share links, API v1 reports and events, but:
- a. **Report delivery digests list it.** `deliveryDecision` returns hold `trial` (`shared/src/report-delivery.ts:259-260`); the single
  delivery path writes a `held` row to the company's delivery log (`server/src/services/reportDelivery.ts:329-331`), and the digest path
  pushes it into `held` (`reportDelivery.ts:405-410`), which every channel prints: e-mail and Slack "Not sent, Competitors - <domain>:
  This analysis ran in trial for our team only, so it is not sent." (`report-delivery.ts:484`, `:500`), webhook `held[]` with code
  `trial` (`:521`). Any company with delivery on and no stage list gets this after a Trial run.
- b. **Website Overview "Latest reports"** reads `reportsList` unfiltered (`server/src/services/recommendations.ts:596`, `overviewReports`
  `:593`): every member sees the Trial report's title (the click then 404s).
- c. **The run itself** is listed in Runs, run detail and API v1 `list_runs` (`server/src/routes/runs.ts:72`, `services/apiV1.ts:298`):
  mode title "Competitors" / "Keyword research", status, credits.
- d. **Needs you** shows a failed Trial run as "Competitors: did not finish" (`server/src/services/pipeline.ts:380-394`).
- e. **Credits**: a Trial run is quoted and charged to the client company like any run (no platform-admin or Trial exemption in
  `services/runs.ts` or `runCredits.ts`), and shows in the company's usage / credits ledger.
- Fix: one predicate in `services/ki.ts` (report or run in Trial, user not platform admin) applied at the source, `reportsList`
  (`services/runs.ts:1007`) and the runs list / detail / API v1 runs query, instead of per route (this also fixes L13); in both delivery
  paths treat code `trial` like `interim` (skip, no log row, not in `held`); filter `failedRuns` the same way; record Trial runs as
  `ref.trial` and do not charge the client company (0 credits with the ledger cost kept for the admin cost pages, or bill an internal
  company). Then correct `app/API.md` ("hidden ... the run" is not true today) and add a harness / server test per path.

### Medium

**M1. Every company, Off included, sees KI in two lists.** The delivery stage chooser lists Competitors and Keyword research
(`web/src/pages/settings/_components/DeliveryTab.tsx:39`) and the Reports "Type" filter lists all STAGE_LABELS, now with the four KI
stages incl. "Competitor research started" (`web/src/pages/runs/ReportsPage.tsx:89`, labels `shared/src/constants.ts:376-380`). Off must
be byte-identical / nothing new (CONTRACTS 1, DESIGN 6 "Off sites see ... nowhere"). Fix: show the KI stages only when a website of the
company is KI-visible to this person (the `useKi` overview already answers per site; or an org-level flag on `GET /api/orgs/:id`), and
leave `_started` stages out of the Reports filter as for the other interim stages.

**M2. Striking distance has three definitions inside KI and more around it (DESIGN 3.11: "one definition everywhere").**
Engine: positions 8-20 with >= 100 impressions, >= 30 when the site has < 5,000 (`v5/code/_ki.js:91`, `:720-723`). Web fallback
`kiStrikingOf`: 8-20 with >= 30 for every site (`web/src/lib/ki.ts:455-456`). Recommendation "N quick wins found ... already shows near the
top of Google" counts `striking OR (verdict go AND page_action refresh)` (`shared/src/ki-api.ts:575`, `server/src/services/kiData.ts:371,
398-399`) and opens the "Just off page one" section, which shows a different number. Outside KI: Search & traffic 4-20, impressions > 0
(`web/src/pages/site/_components/QueryExplorer.tsx:21`), Site Tracker 4-20 >= 30 (`v5/code/Parse_GSC.js:64`), discovery 8-20 >= 10
(`v5/code/_kw_inputs.js:21-23`), warehouse column text "8-20" (`shared/src/integrations.ts:524`). Fix now: the web reads `row.striking`
only (no fallback rule); the recommendation counts and names what the page shows (striking only, "N searches just off page one"), or the
page gets a "Quick wins" section with the same rule. Record the app-wide unification with K5 / W2 (owner).

**M3. Gate reasons: the app's words never match what the engine stores.** `KI_Research_Candidates.js:90` stores `gate_reason` as the
engine sentence plus its internal detail (e.g. "too far from what you sell (62% of its own words match ... (35% is the bar))"); the code is
kept only in a non-column field `gate_code`. `KiVerdict.tsx:10-22` maps codes (`career`, `brand`, `market`, `off_service`...) that never
arrive and has no words for `own_brand`, `other_market`, `portal`, `too_broad`, `low_fit`, `avoid`, `empty`; its fallback prints the engine
text with the detail on the Keyword research page. The parity fixture already carries the 12 `gate_reasons` codes. Fix: store the code
(new column `gate_code`, or code in `gate_reason` and the detail in `stage_evidence_json`), give the app one word per fixture code and hold
the two together in `ki.parity.test.ts`.

**M4. "AI judgement" and Claude money for a worker that calls no model.** The basis legend shows `inferred` as "AI judgement"
(`shared/src/ki.ts:144`, `v5/code/_ki_io.js:164`), and `KI.fit` defaults to basis `inferred` from rules; the worker has no Anthropic node
(`LEDGER_EST` ai 0, `ladder_common.py` KI rows; `KI_Plan.js:82` `est_ai_usd: 0`). Yet `cost.ts` quotes ai 0.02 / 0.04 and `_cost_cal.js`
EST says "Claude Haiku only as a tie-break" (`_cost_cal.js:228-230`), so the quote carries model money the run never spends and disagrees
with the ledger reservation. Fix: label `inferred` "our reading of the results" (customer words, no AI claim) until a model is used; set
ai 0 in `_cost_cal.js` EST and `cost.ts` (the parity test keeps them equal), or build the Haiku tie-break DESIGN 2.5 / 3.6 describe.

**M5. Two spellings of one verdict on one marketing page.** Existing setup suggestions say "Hard for your website now"
(`shared/src/cycles.ts:396`, `features.ts:202`, `marketing/pages/HowItWorksPage.tsx:64`, `KeywordChoiceCard.tsx`); KI says "Hard for your
site now" (`shared/src/ki.ts:89`, fixture, `features.ts:204`, changelog). K5 defers the app-wide switch, but the one-word difference is
avoidable now. Fix: one wording in `KI_VERDICTS` + `ki_parity.json` + `_ki.js` (owner picks; "website" matches what customers already see).

**M6. Marketing and guide copy a little ahead of what ships.** Competitors step "Close the gaps: ... the step that closes each gap, priced
in credits before it starts" (`features.ts` competitors `steps[3]`) and guide "Nothing starts without your click"
(`shared/src/guides.ts`, ki-read-keyword-research step 1) while every Start says "Coming soon" (O3, 501). "Every team gets all N
capabilities" (`marketing/pages/SolutionsPage.tsx:68`, `PlatformPage.tsx:13` HERO_FACTS `${features.length} capabilities`) now counts a
capability rolling out to selected websites, and the home grid card (`HomePage.tsx:481-483`, tagline only) does not say "rolling out".
Fix: "shows the step that would close each gap and its credits"; guide "Starting a step from here is coming soon"; count rolling-out
capabilities apart (or add "rolling out" to the tagline / card).

**M7. Two competitor lists with the same name.** Website settings "Competitors" (`seo_monitors.competitors`, used by AI visibility,
backlinks and the rank share of voice) and the Competitors page's chosen set (`seo_ki_competitors`) are separate; choosing on the page does
not change the settings list, and the page's "AI share of voice" (reused `CompetitorsPanel`, marketing "next to your own share") is about
the settings list. The engine reads the settings list in as declared (`KI_Plan.js:24`), so the link is one-way. Fix: one line on the page
and on the settings field ("the competitors you follow here are separate from ..."), named in `ki-choose-competitors`, until W2 decides
whether choosing writes back.

### Low

- **L1** Icons: `meta.tsx` STAGE_MODE has no `ki_*` (`web/src/components/reports/meta.tsx:73-95`), so report rows show the describe icon;
  MODE_ICON uses Search / FileSearch (`meta.tsx:43-44`; FileSearch is the Indexing nav and index_coverage icon), the sidebar Swords /
  Telescope, Needs you Users. Pick one icon per capability.
- **L2** Tools page: the two modes fall into "More tools" (`web/src/pages/tools/ToolsPage.tsx:38-42`, `:74-76`) though their category is
  keywords; add them to the Research goal (filtered by `kiModeOffered` as today).
- **L3** Names: mode "Competitors", marketing "Competitor analysis", started stage "Competitor research started"; the category label
  "Keyword research" (`constants.ts` MODE_CATEGORIES) now equals a mode title, so every keyword tool card says "Keyword research".
- **L4** `shared/src/billing.ts` FEATURE_LABEL (`:263-293`) has no entry; the generic fallback gives the right words by chance. Add both.
- **L5** `marketing/content/search-kinds.ts:73-86` featureSearchKinds has no `competitors` (no SEO / AEO chips on /platform/competitors);
  `PlatformPage.tsx:17-24` LOOP_MAP Research omits it.
- **L6** Portal: On KI reports are in the client portal's reports list, and `components/reports/ki.tsx` offers "Open Competitors" to a page
  client roles get 403 for. Hide the button for client roles (or the stages from the portal list).
- **L7** `kiCreditsEstimate` (`shared/src/ki.ts:72`) is unused and hard-codes the rate; remove it or route it through the org rate.
- **L8** Docs: CLAUDE.md "Where things live" lacks `SEOagentKIntel1`, the four `seo_ki_*` tables and the `ki_*` monitor columns (report
  only); `app/README.md:16` "all 13 modes", HANDOVER.md, developer guide not updated (stale for recent features too); `app/API.md:687`
  `/api/v1/modes` "every mode" (hidden modes are left out) and the KI section's "hidden ... the run" (see H1).
- **L9** Tutorials backlog rows 23-25 exist and are committed; not listed: the Delivery tab and the Reports filter gain KI entries for
  every company (touches the report-delivery tutorial; or goes away with M1), and the two Recommendations / Needs-you items on On sites.
- **L10** Basis words differ: engine callback "estimate from the data provider", app "estimate from <source>" / "our data provider";
  `volume_source: 'DataForSEO Labs'` (`KI_Research_Candidates.js:75`) reaches the number tip as "estimate from DataForSEO Labs". The app
  names DataForSEO elsewhere, but "Labs" is a product name: map it to "keyword data".
- **L11** `engineFailures.ts:89` RETRYABLE leaves the KI modes out, so a run lost to a restart is closed failed and refunded, not started
  again once like ai_visibility / backlinks (safe here: the TTL reuse charges 0 for what was read). Decide and say so in A1.md.
- **L12** Guide `ki-verdicts` trouble "tell us: the rules learn from it": no feedback path exists. Say "tell us and we will look at it".
- **L13** `routes/runs.ts:107-114` filters Trial after `limit`, so a page can hold fewer rows than asked (goes away with the H1 fix).
- **L14** Run form "Read everything fresh: Ignore a reading from the last few days" while volumes and the competitor set live 30 days
  (`_ki.js:102`). Say "a recent reading (up to a month for search volumes)".

## 3. What is consistent (checked, no action)

Mode ids, stage ids, ETAs (6 / 12) app = front door; seeds 20 and competitors 5 at every layer (schema, front door, `KI_Input.js:14`, CAPS,
Site Admin 1-5, marketing "five", guide); TTLs = DESIGN 7; verdict words, Win thresholds, stage weights, score / win / competitor weights
and the 3-of-10 cluster rule held by the parity fixture on both sides; DFS quotes 0.35 / 0.90 equal in `cost.ts`, `_cost_cal.js`,
`LEDGER_EST` and baked into `_ki_io.js` QUOTE; Off refusal at three layers (app 403, front door routing, engine KI Gate) with the same
reason words (`KI_REFUSAL_TEXT`); site delete in engine and app; kill switch fails closed in app and engine; no AI-tell characters or stock
phrases in any new customer string; marketing says "rolling out" on every KI line and invents no customer or result (mockup labelled
"Sample data").

## Re-check of 3a990e62

Read-only, on the frozen snapshot at `3a990e62` (fix rounds FX-L + FX-A, `fixes/FXL.md`, `fixes/FXA.md`), checked in the code, not from the
fix notes. Video repo checked at `71f9a99`.

### Findings of the first pass

| Finding | State | Evidence |
|---|---|---|
| H1 Trial not private | fixed | one check in `server/src/services/ki.ts` (`NOT_KI_TRIAL_RUN` / `NOT_KI_TRIAL_REPORT`, `kiRunConds` / `kiReportConds`); used by the runs list in SQL before the limit (`routes/runs.ts:71`), run and report detail (`:99`, `:124-125`), `reportsList` (`services/runs.ts:1022`, so Overview and Pipeline), `latestReport` (`:1118`), both delivery paths (`reportDelivery.ts:328`, `:401`: skipped, no log row, not in `held`), share links, API v1 runs / reports (`apiV1.ts:298`, `:317`, `:355`), events (`webhooks.ts:314`), month spend (`spend.ts:44`), Pipeline / Needs you (`ladders.ts:936`), exports. Trial runs are quoted 0. The other direct report reads are stage-specific (content, ai_visibility, rejected of a joined run) and cannot return a KI Trial report |
| M1 Off companies see KI stages | fixed | `useOrgKiVisible` gates `DeliveryTab.tsx:41-46` and `ReportsPage.tsx:30-34,93` (started stages never in the filter) |
| M2 striking distance | fixed in KI; app-wide still differs | `KI_STRIKING` (`shared/src/ki.ts:163`) = `_ki.js:91` = fixture; web reads `row.striking` only (`lib/ki.ts:455-456`); the recommendation counts and names the same set ("N searches just off page one", `kiData.ts:429-435`). Outside KI unchanged: Search & traffic 4-20 (`QueryExplorer.tsx:21`), Site Tracker 4-20 (`Parse_GSC.js:64`): owner / K5, now Low |
| M3 gate reasons | fixed | 12 codes identical in the fixture, `KI_GATE_WORDS` (`shared/src/ki.ts`) and `GATE_TEXT` (`_ki.js`); `gate_detail` column in `ladder_common.py`; app view carries words only (`ki-api.ts:446-448`). See N1 for the API v1 exception |
| M4 "AI judgement", Claude money | fixed | `inferred` = "our reading of the results" in app, kit and callback labels; ai 0 in `cost.ts:98-99`, `_cost_cal.js:229-230`, `LEDGER_EST` |
| M5 verdict wording | fixed | "Hard for your website now" in `KI_VERDICTS`, `_ki.js:805`, fixture, guide, marketing, changelog; no "for your site now" left in app / engine / harness. Only the historical backlog row 24 keeps the old words, superseded by row 27 |
| M6 copy ahead of shipped | fixed | gap step "a button that opens the tool" (`features.ts:273`), unbuilt gap kinds "come later" (benefit line), tagline "Rolling out", Solutions "the newest as they roll out"; no "Coming soon" left in KI pages, guides or marketing |
| M7 two competitor lists | fixed | line + link on the Competitors page (`CompetitorsPage.tsx:204`), guide Q&A in `ki-choose-competitors` |
| L1 icons | fixed | Swords / Telescope in MODE_ICON and STAGE_MODE (`meta.tsx:44-45`, `:96-99`) |
| L2 tools grouping | fixed | "Research" for both (`constants.ts:352`, ToolsPage research goal) |
| L3 names | fixed | started stages "Competitors started" / "Keyword research started" |
| L4 billing labels | fixed | `billing.ts:294-295` |
| L5 marketing chips, loop | fixed | `search-kinds.ts:76`, `PlatformPage.tsx:18` |
| L6 portal link | fixed | `components/reports/ki.tsx:20-21` |
| L7 `kiCreditsEstimate` | not fixed (skipped, harmless) | |
| L8 docs | partly | `app/API.md` updated (Trial, quotes, current rows); `app/README.md`, `HANDOVER.md`, developer guide still without KI; CLAUDE.md "Where things live" still lacks `SEOagentKIntel1`, the four `seo_ki_*` tables and the `ki_*` columns (report only) |
| L9 backlog rows | fixed | rows 27-28 (`71f9a99`): fix round, company-wide lists, Trial free and invisible |
| L10 vendor name | fixed | `kiSourceWords` maps "DataForSEO ..." / Labs to "our keyword data" (`shared/src/ki.ts:187-193`) in the page and the CSV |
| L11 RETRYABLE | not fixed (decision recorded in FXA.md) | |
| L12 guide "rules learn" | fixed | "we will look at it" |
| L13 filter after limit | fixed | SQL before the limit |
| L14 form TTL words | fixed | "up to a month for search volumes and the competitor set" |

### New contract items (FX-L) checked

- **Verdict `unknown` "Not judged yet"**: present in `KI_VERDICT_IDS`, `KI_VERDICTS`, `KI_VERDICT_TONE`, fixture verdicts + a boundary case,
  `_ki.js` VERDICT_WORDS, every `Record<KiVerdict, ...>` (counts built from `KI_VERDICT_IDS`, `ki-api.ts:624-673`), the engine's run
  counts (`KI_Research_Result.js:137`), the guide (`KI_VERDICTS.unknown` step). Two places name it only by fallback: the plan's
  `verdict_mult` (`_ki.js:98`, `{ go, months, hard }`: `unknown` gets the 0.4 default, the same weight as Hard) and the marketing /
  changelog sentences that list four verdicts (N4).
- **Gate codes + `gate_detail` never shown raw**: true on the pages and the CSV; not in API v1 (N1).
- **Current-row rule**: `kiCurrentRows` (`kiData.ts:131`) on the pages, counts and CSV; not in API v1 `get_table` (N2).
- **One striking definition**: within KI, yes (above).
- **"your site" in KI copy**: one left, the impressions tip on the Keyword research page (`KeywordsPage.tsx:287`, "How often your site was
  shown"). The engine's `_ki.js:747` / `:915-917` strings say "your site" but are not shown (Win `parts` and the page action `_why` are not
  stored or sent).
- **Changelog**: 4.11 = KI (rolling out), 4.10 = the SERP-goto hotfix, 4.9 = AI ranking: ordered and consistent. But the 4.10 entry lives
  only on `feature/seo-agent-v4.5` and the `ki/*` branches (commit `7e0e3342`); the local `hotfix/serp-goto` branch (tip `c77ddb61`) has
  no 4.10 entry (N3).
- **Tutorial backlog** (`~/Downloads/hiresuite-video-skills/alaventra/TUTORIALS_BACKLOG.md`, `71f9a99`): rows 23-25 (first pass), 26 (SERP
  goto hotfix), 27 (KI fix round: buttons, phone lists, "Not judged yet", "Hard for your website now", confirm before On), 28 (company-wide
  lists, Research group, Trial free and invisible). Complete for the customer-facing changes found here.

### New findings

- **N1 (Medium) API v1 / MCP `get_table` returns KI rows raw.** `kiTableRowsV1` (`server/src/services/kiData.ts`, after
  `export async function kiTableRowsV1`) sends every stored column: `seo_ki_keywords.gate_detail` (the engine's sentence the FX-L contract
  says is never shown), and `seo_ki_runs.cost_dfs_usd` / `cost_claude_usd` / `config_json`: provider cost, while every other customer
  path (API v1 `get_report` via `customerSafePayload`, the KI routes) shows credits only. Fix: a column allow-list per KI table in
  `kiTableRowsV1` (drop `gate_detail`, the two cost columns and `config_json`; add `gate_words` if wanted) and say so in `app/API.md`
  ("rows as stored" today).
- **N2 (Medium) API v1 `get_table` ignores the current-row rule.** The pages, counts and CSV read `kiCurrentRows`; `kiTableRowsV1` pages
  over every stored keyword and gap row, so if the engine's delete failed (the case the safety net exists for) an API client gets rows
  the app no longer shows. Fix: run `ki_keywords` / `ki_gaps` through `kiCurrentRows` with the site's `seo_ki_runs` rows.
- **N3 (Low) the 4.10 changelog line may not ship with the hotfix.** It is on `feature/seo-agent-v4.5` but not on `hotfix/serp-goto`.
  Check which branch the hotfix's web deploy (PR to `main`) is cut from; if it is `hotfix/serp-goto`, cherry-pick `7e0e3342`'s changelog
  hunk there (business pages follow the product), and keep 4.11 for KI.
- **N4 (Low) four verdicts named, five shown.** Changelog 4.11 and the keyword-research benefit / FAQ list "Go", "Takes a few months",
  "Hard for your website now" or "Not for you"; the product also shows "Not judged yet". Add it, or say "one verdict (or 'Not judged yet'
  while the evidence is thin)". Also give `verdict_mult` an explicit `unknown` entry (`_ki.js:98`) so the plan weight is a decision, not a
  fallback.
- **N5 (Low)** `KeywordsPage.tsx:287` "How often your site was shown" -> "your website". Guide `ki-choose-competitors` "what we compare you
  with each month": the monthly refresh is not built (O5, W2); say "each time you run it" until it is.

### High / Medium left

No High. Medium: N1 (API v1 KI tables expose `gate_detail` and provider cost), N2 (API v1 KI tables skip the current-row rule). Owner /
W2 items unchanged: app-wide striking distance and verdict words (K5), L8 docs and CLAUDE.md table.
