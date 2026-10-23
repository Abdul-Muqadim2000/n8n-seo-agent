# R-APP: the app fixes of the AI visibility review (2026-10-23)

Fixer for `REVIEW_APP.md` (committed beside this file). Branch `worktree-agent-a93c48d3840cd88e7`, base `2ed297ca`, with
`aivis/integration @ 3ec58d11` (W2-FIX) merged in at `f5ae89ef` so this branch sits on top of W2-FIX's cost, quote, pilot and Site Admin
body work. App only (`app/shared`, `app/server`, `app/web`, `app/API.md`); nothing in `n8n/` edited except this report and the review
copy. No migration. Not pushed, not deployed.

## Commits

| commit | what |
|---|---|
| `d0d89fff` | R-A2 sentiment: an early reading until validated (+ REVIEW_APP.md) |
| `d1bf890a` | R-A3 a joined check is its own closed state `joined` |
| `f5ae89ef` | merge of `3ec58d11` (W2-FIX, coordinator) |
| `920c006f` | settings: buyer-role context and market trend marked "Preview" (coordinator) |
| `e61ad5be` | R-A4 / R-A5 (+ R-A13, R-A21 delimiter) uploads |
| `5869b19b` | R-A6 / R-A7 / R-A8 (+ R-A16) |
| `250256b7` | R-A10 (+ R-A20) |
| `eb379900` | R-A9 (+ R-A12) deploy order |
| `d36c7766` | engine fix round: `already_measured`, null share of voice / named rate (coordinator) |
| `03d9a4d7` | lows R-A14, R-A18, R-A19, R-A21, JSDoc; changelog lines |
| (this file) | report |

## Checks (node:22-bookworm-slim, whole worktree mounted, volume `aivis_afix_nm`)

- `tsc --noEmit` shared / server / web: clean. `npm run build -w @seo/web`: OK.
- shared **702 passed** (43 files; new `src/ai-review-fixes.test.ts`, 21 cases); server **1422 passed, 46 skipped** (72 files; new
  `test/readCache.test.ts`, more cases in `test/aiWave2.test.ts`, `test/aiVisibilityF3.test.ts`); web **183 passed** (20 files).
- Each fix has a test that fails on the base code (the old reader, outcome, delete, upload or cache behaviour is what the assertion
  rules out), e.g. R-A2 runs the engine's real `_ai_sentiment.js` `aggregate()` and reads its output.

## Per item

| id | fix | where |
|---|---|---|
| **R-A2** High | `parseAiSentiment` reads `validated` (absent on a present column = false; true only when the engine says so and the model's kappa clears its gate), `note`, `unread_note`, and `kappa` as the object it is (`kappa` = the model's, `kappaRules`, `kappaGate`). New `status` (withheld / early_reading / validated) and `label` = "Early reading, not yet validated". Objections are held back (`objections: []`, `objectionsHeld: n`) until validated. The page shows the label as a badge, the engine's note, "N objections were read; listed once the reading is validated", and "agreement ... not measured yet". API v1 `sentiment` and MCP `get_ai_visibility` carry the same fields (one reader). No CSV / warehouse export carries the W2-E2 figure (checked: the answers CSV and BigQuery `sentiment_score` are the older Answer Analyst's per-answer label and score). | `shared/src/ai-detail.ts`, `web/.../ai-panels2.tsx`, `server/src/routes/apiV1.ts` (MCP text), `API.md` |
| **R-A3** High | New run status **`joined`** (`RunStatus`, `RUN_STATUSES`, `RUN_UNCHARGED_STATUSES`, `runClosed`). `runOutcome` closes a `rejected` / `open_run` callback as `joined` (never `failed`); a later rejection leaves it. So `eventsFor` emits no `run.failed` (webhooks, Slack, Teams, Jira / Linear / Asana all ride on it). Not charged: `runCreditsOf` -> not_charged, `costSync` charges 0 and returns anything taken, spend / budget sums and admin counts exclude it like failed. `toRun` / `toRunV1`: `error: null`, the sentence in `note`. `GET /runs/:id` (app and v1) add `joined: {openRunId, expectedFinish, reportId, reportTitle, receivedAt}`: the open run's `ai_visibility` report found by its `run_id` in the payload, so the run page shows "Open its report" once it arrives (polled once a minute until then). Filters (`?status=joined`, runs page, admin) know it; delivery says "part of the run already in progress". | `shared/src/api.ts`, `api-v1.ts`, `ai-trends.ts`, `report-delivery.ts`; `server/src/services/runs.ts` (`runOutcome`, `joinedOpenRunOf`, `runJoinedResult`), `runCredits.ts`, `spend.ts`, `admin/costSync.ts`, `admin/credits.ts`, `routes/admin.ts`, `routes/runs.ts`, `services/apiV1.ts`; web badge, runs list, run page, queries |
| **R-A4** | Upsert by the contract key in two phases: insert under a new `import_id` (a failed chunk takes only this import's rows out again; 502 "Nothing was changed"), then read the stored rows of the days and delete earlier imports' rows with the same (day, url, query): one call per (import, day) when every row of it is superseded, else row by row by the whole key. A Bing pages file and a queries file of the same days both stay; `replaced` is returned, toasted and audited. | `server/src/services/aiWave2.ts` (`importAiReport`, `aiImportKey`) |
| **R-A5** | `aiDateColumn`: the whole column decides; ISO and month names read as they are; numeric dates day-first when a first number > 12, month-first when a second > 12, both = refused, neither = refused unless the owner picks "Dates in the file" (new `dateOrder` in `aiImportSchema` and the form). Every day checked against the calendar (`aiYmd`, `aiIsDay`); future days skipped. A file without dates needs `periodEnd` (a real, non-future day): never today. `importDate` (link imports) also refuses impossible days. | `shared/src/ai-import.ts`, `link-import.ts`, `schemas.ts`; `web/.../ai-panels2.tsx` |
| **R-A6** | `aiImports` added to `AI_TABLES_CLEARED_ON_DELETE`. | `server/src/routes/sites.ts` |
| **R-A7** | A delete keeps a tombstone: `status: 'off'`, `origin: 'deleted'` (`AI_PROMPT_DELETED`), `pinned: false`, a `fit_note` with the date, through `updateRows` by domain AND id. The engine asks no `off` question (AI Plan, Pulse Plan, Pilot Plan) and its writer treats every stored question as existing (F2), so it is never written or asked again. The app hides tombstones (page panel, questions CSV, API v1 counts); re-adding the question as the owner's own revives it (Site Admin `add` writes the same id active with origin custom). Dialog copy says so. | `shared/src/tables.ts`, `server/src/services/aiWave2.ts`, `data.ts`, `routes/sites.ts`, `web/.../ai-panel.tsx` |
| **R-A8** | `ReadCache`: TTL with expired entries swept on every write, LRU by bytes (body size of the n8n reads), 96 MB total (`READ_CACHE_MB`), no single read over a quarter of it cached, 500 entries max. | `server/src/n8n/client.ts` |
| **R-A9** | Either order is safe. New API + old web: `/data/ai` sends every answer unless `answers=summary`. New web + old API: the web always asks for the summary; when `/data/ai/answers` answers 404 the answers section pages the embedded answers with the same shared `aiAnswersPageOf` (moved with `aiScopeSummary` to shared, the server uses it too); the uploads card hides on a 404. Remaining skew, harmless: an old web shows a `joined` run as "Queued" and keeps polling it while that page is open. | `shared/src/ai-trends.ts`, `server/src/routes/data.ts`, `services/aiWave2.ts`, `data.ts`, `web/src/lib/queries.ts`, `web/.../ai-answers.tsx`, `AiVisibilityPage.tsx` |
| **R-A10** | `parseAiImportsSummary` reads the documented shape: `days.from/to` (flat `from/to` still read), `period`, `urls_n`, `queries_n`, `top_urls`, `top_queries`, `files`, `imported_at`, and `copilot`; the top-level objects are never read as sources. The Copilot line ("Copilot, from Bing's own report: N citations ... (label)") sits under the engine table; the uploads card says what the latest run read (period, each source's days and upload date). API v1 `imports` documented. | `shared/src/ai-detail.ts`, `web/.../ai-panels2.tsx`, `AiVisibilityPage.tsx`, `API.md` |
| **R-A11** | Not touched: W2-FIX fixed it (`' '` for an emptied list, `siteAdminMonitorsBody`), merged in at `f5ae89ef`. | |
| R-A12 | The CSV download URL goes to `API_ORIGIN` directly (`directUrl`). | `web/src/lib/queries.ts` |
| R-A13 | A file without pages returns its top 3 queries, shown in the upload toast with "check these are searches for <domain>"; marketing and guide now say "a file whose pages belong to another website is refused". | `ai-import.ts`, `features.ts`, `guides.ts` |
| R-A14 | The question history draws a rate from 12 answers (the band below that), with a line saying so. | `web/.../ai-answers.tsx` |
| R-A15 | Not touched: `aiPanelForQuote` belongs to W2-FIX (runs.ts lines it owns). Still falls back to the table row on a read error. | |
| R-A16 | Prompt deletes run 8 at a time; the route audits what was done (with `failed` and outcome) before answering 502 on a partial failure. The upload is two-phase (R-A4). | `aiWave2.ts`, `routes/sites.ts` |
| R-A17 | Not fixed: the uploads overview still reads up to 20,000 rows (60 s cache, now byte-bounded). Needs a per-source summary row or a day filter the n8n API supports on strings. | |
| R-A18 | `csvCell` also neutralises a formula after leading whitespace or a line break. | `shared/src/identity.ts` |
| R-A19 | Bulk selection capped at 500 (toggle and "select every question shown", with a toast). | `web/.../ai-panel.tsx` |
| R-A20 | The uploads card is not shown to client roles (and its query is not sent). | `web/.../ai-panels2.tsx` |
| R-A21 | Brand fallback: "You" only for the domain or its label as the whole name (`isSelfName`); JSDoc moved back above `GroupsPanel`; CSV delimiter taken from the first line that has one (a title line first); `periodEnd` checked against the calendar. | `ai-answers.tsx`, `ai-insights.tsx`, `link-import.ts`, `ai-import.ts` |

## Coordinator items (mid-task)

- **Preview labels**: "Send each buyer role as context" and the monthly market trend start their description with "Preview: needs a
  one-time check on our side before its figures can be relied on." Both stay off until ticked (optional schema fields, no default).
- **`already_measured`** (engine R-E1): closed like the open run: status `joined`, `lastStage: 'already_measured'`, note "Already measured
  today: showing the stored week. <engine sentence>", no `run.failed`, nothing charged, `joined.openRunId` = `stored_week.run_id` and its
  report linked when the app has it; badge "Already measured"; a completed run ignores it (and its run page keeps showing its own report,
  not the later notice). Delivery holds it with its own reason.
- **Null share of voice / named rate**: `AiRun.mentionRate` / `shareOfVoice`, `AiDay`, the compare side and the overview series are
  `number | null`; `data.ts` reads them with `nn`; a pulse day weights share of voice over the rows that have one; the comparison of a
  null side has no delta and no test; the hero tiles and the overview say "Not measured"; no recommendation is made from a null rate;
  charts leave a gap. The CSV and warehouse exports already pass null through (`coerce`).
- **Sentiment label**: R-A2 above.

## Deploy notes

- Order: either works (R-A9). Preferred: API (and engine) first, then the web. Remove the `/data/ai` full-answers fallback one release later.
- `joined` is a new value in `runs.status` (a text column, no migration). Customers' API clients that switch on status see `joined`
  (documented in `API.md`).
- Nothing here needs `sync_tables.py`.

## For the engine

- The uploads table now keeps a pages file and a queries file of the same days side by side (the contract's key). `imports_json`'s
  per-source totals should sum one kind per source (pages rows: url set, query empty; queries rows: the reverse) or they double count.
- Deleted questions are `off` rows with `origin: 'deleted'`; the AI report's "switched off" counts will include them unless it skips that
  origin.

## Left / not verified

- R-A15, R-A17 (above). The Bing / Search Console export headers and date formats are still assumptions until one real export is uploaded.
- No browser pass of the changed screens (unit-rendered only); the web build passes.
- The `already_measured` handling is built against the engine code in `aivis-integ` (`AI_Plan.js` `tell(..., 'done')`), not run live.
