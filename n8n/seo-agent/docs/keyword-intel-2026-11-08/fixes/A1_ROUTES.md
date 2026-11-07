# KI A1: route shapes for the web (A2). Fixed 2026-11-08; a change goes through the orchestrator.

Types: `app/shared/src/ki-api.ts` (exported from `@seo/shared`). Every route is under `/api/orgs/:orgId/sites/:siteId/ki`, needs a
signed-in member of the company (viewer or above; client-portal roles get 403), a website that belongs to the company and is verified.

**Visibility.** `visible` = website On, or Trial and the person is a platform admin, and the kill switch (`seo_cache ki:kill`) is not on (a
kill-switch read error counts as on). Every data route below answers **404 "Not found"** when not visible (the same answer as an unknown
website: existence is never leaked). Only `GET .../ki` answers for every website (so the nav can decide); for a non-admin it reports Trial
as `off`.

| Route | Role | Answer |
|---|---|---|
| `GET  .../ki` | viewer | `KiOverview` `{mode, visible, killed? (admins), canSwitch, canAct, maxCompetitors, credits:{competitors, research}, lastRuns: KiRunView[], summary: KiSummary \| null}`. One request per page view: `summary` carries the hero counts (competitors chosen / watch / candidates / listings / confirmed, keywords by verdict / stage, striking, quickWins, questions, clusters, gaps open by type, fetchedAt). |
| `GET  .../ki/competitors[?market&status&class]` | viewer | `KiCompetitorsResponse` `{market, maxCompetitors, chosen, items: KiCompetitorView[]}` (chosen first, then score; listings `directory` / `publisher_list` and `platform` rows are in `items`, filter on `class`). |
| `GET  .../ki/competitors.csv` | viewer | text/csv, columns `KI_COMPETITOR_CSV_COLUMNS` |
| `PATCH .../ki/competitors/:compDomain` `{status: chosen\|watch\|dismissed}` | member | `{ok, compDomain, status, chosen, maxCompetitors}`; **409 `ki_max_competitors`** when choosing one more than the website's limit (default 5); 404 when the domain is not in the list. |
| `GET  .../ki/keywords?stage&verdict&source&cluster&min_volume&brand=brand\|non_brand&q&striking=1&heads=1&questions=1&market&sort&page&page_size&include=serp` | viewer | `KiKeywordsResponse` `{market, total, page, pageSize, pages, sort, items: KiKeywordView[], facets:{verdict, stage, source}}`. `sort` = `score` `volume` `keyword` `position` `demand` `kd` `fetched`, `-` in front = descending (default `-score`); missing values always last. `page_size` default 50, **max 200**. `top10` only with `include=serp`. Unknown filter values are ignored. |
| `GET  .../ki/keywords.csv` (same filters, all pages) | viewer | text/csv, `KI_KEYWORD_CSV_COLUMNS` (verdict words, basis label + fetched_at beside the numbers) |
| `GET  .../ki/gaps?type&status&market&page&page_size` | viewer | `KiGapsResponse` `{market, total, page, pageSize, pages, items: KiGapView[], byType, byStatus}` |
| `GET  .../ki/gaps.csv` | viewer | text/csv, `KI_GAP_CSV_COLUMNS` |
| `PATCH .../ki/gaps/:gapId` `{status: open\|started\|dismissed\|done}` | member | `{ok, gapId, status}`; 404 unknown gap |
| `POST .../ki/questions/approve` `{keys: kw_key[] (1..30)}` | admin (as the AI panel) | `KiQuestionsApproveResult` `{added:[{kwKey, question}], skipped:[{kwKey, reason: not_found\|not_a_question\|gated\|already_on_panel\|panel_full\|duplicate}], panelSize, ownOnPanel}`. No paid run; the questions join the AI panel as the owner's own (Site Admin `ai_prompts` add). |
| `POST .../ki/plan/:actionId/start` | member | **501** `{error, code: 'not_available_yet'}` until W2 |
| `PATCH .../ki/mode` `{mode: off\|trial\|on}` | platform admin only (403 otherwise) | `{ok, mode}` read back from the engine after the write (502 when the engine did not keep it) |

Runs: the existing `POST /api/orgs/:orgId/runs` with `mode: 'competitors' | 'keyword_research'` (W0 schemas). Before the run, show
`credits.competitors` / `credits.research` from `GET .../ki` (or the run form's own quote; both come from the same cost table). A refused or
failed answer ends the run failed, not charged. Reports: stages `ki_competitors` / `ki_research`; their list summary
(`report.summary`) carries `status` (`ok` / `partial`), `partial: true` + `missing` (comma-separated section keys) when partial, `trial: true`
on a Trial run, and the counts (`competitors`, `chosen`, `listings`, `clusters`, `striking`, `questions`, `gaps`, `plan`). A Trial report is
visible to platform admins only and is never delivered by e-mail / webhook.

Errors use the app's usual body `{error, code?}`. Rate limits: lists 240 / min, CSV 30 / 10 min, PATCH 60 / 10 min, approve 30 / 10 min,
mode 20 / 10 min.

**Recommendations / Needs you (On sites only, never Off / Trial).** Recommendation ids `ki:competitors` ("Choose your competitors": the
set has no choice by a person yet) and `ki:quick-wins` ("N quick wins found"), both `action.page` = `competitors` / `keywords`. Needs-you
items with the new kind **`ki`**, ids `ki:competitors` / `ki:quick-wins`, action `{label, page}`. Guide ids (A2 writes the guides, then maps
them: `GUIDE_FOR_RECOMMENDATION['ki:competitors'] = 'ki-choose-competitors'`, `['ki:quick-wins'] = 'ki-read-keyword-research'`, and
`GUIDE_FOR_NEEDS_YOU_KIND.ki` = `'ki-choose-competitors'` + a `ki:quick-wins` refinement in `guideForNeedsYou`): `KI_GUIDE_IDS` in
`ki-api.ts` = `ki-choose-competitors`, `ki-read-keyword-research`, `ki-verdicts`. Until the guides exist, A1 maps kind `ki` to
`choose-first-keyword` (one line in `guide-links.ts`) and gives it an icon in `pipeline/home.tsx` `KIND_ICON` (one line, `Users`).

Page paths A1 assumes for the actions: `competitors`, `keywords` (relative to `/o/:org/sites/:site/`).
