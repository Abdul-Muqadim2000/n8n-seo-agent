# Adversarial review of the app side of AI visibility wave 1 + 2 (2026-10-23)

Scope: `git diff 457cb609..2ed297ca -- app/` (73 files, +7480 / -469), on `aivis/integration` @ `2ed297ca`. Read-only review; nothing in the repo
was changed. Scratch tests that prove findings live outside the repo (session scratchpad `rt/quote.review.test.ts`, `rt/date.review.test.ts`,
run by mounting them into `app/shared/review_rt` inside the container).

## Checks run (docker, node:22-bookworm-slim, aivis_nm volume)

| check | result |
|---|---|
| `tsc -p shared/web/server` | clean, all three |
| new / changed test files: shared `ai-compare`, `ai-visibility`, `ai-wave2` | 71 / 71 |
| server `aiPanel`, `aiQuoteF3`, `aiVisibilityF3`, `aiWave2`, `recommendations`, `reportTruth` | 89 / 89 |
| web `aiVisibilityF3`, `aiWave2` | 16 / 16 |
| full suites | shared 652 / 652; server 1402 passed, 46 skipped (DB suites); web 181 / 181 |

The tests pass; the findings below are in what they do not test.

## Summary

| id | severity | one line |
|---|---|---|
| R-A1 | High | On-demand AI quote (= credit check = charge cap) ignores the owner's wave-2 options: 35% under the engine's own figure |
| R-A2 | High | Sentiment is shown as a finished figure: the engine's `validated: false` and its "not yet validated" note are dropped |
| R-A3 | High | A check joined to the open run is stored `failed`, so customers' webhooks / Slack / Teams / API get `run.failed` |
| R-A4 | Medium | AI import replaces every row of (source, day), not the contract key: a second file of the same period wipes the first |
| R-A5 | Medium | AI import dates: D/M/Y assumed, month never validated (`10/22/2026` -> `2026-22-10`); undated files stamped today |
| R-A6 | Medium | Site delete leaves `seo_ai_imports`: the next company that verifies the domain inherits the previous owner's uploads |
| R-A7 | Medium | Deleting an automatic question does not stop it being asked: the engine regenerates it (tombstone removed) |
| R-A8 | Medium | Read cache retains wave-2 answer rows (answer_text, JSON columns) and `units_json` per site with no expiry eviction |
| R-A9 | Medium | Deploy order: Vercel (web, auto on main) and GCP API (manual) break each other's AI page in either order |
| R-A10 | Medium | `imports_json` reader does not match the engine's shape: `from` / `to` always blank (API v1 too); Copilot line never shown |
| R-A11 | Medium | Pulse-engine choice cannot be cleared: an empty list is sent as `''`, which Site Admin treats as "keep" |
| R-A12 | Low | CSV export goes through the Vercel proxy, not `direct` (the app's own rule for large / slow requests) |
| R-A13 | Low | "A file for another website is refused" holds only for files with a URL column (marketing says it always does) |
| R-A14 | Low | Question history draws a per-question rate from 3 answers (the floor everywhere else is 12) |
| R-A15 | Low | On-demand quote falls back to the fixed 8-question table row when the monitors row cannot be read |
| R-A16 | Low | Delete prompts / import: hundreds of sequential n8n calls, partial failure leaves no audit row |
| R-A17 | Low | `aiImportsOverview` reads up to 20,000 rows (80 sequential calls) on every AI page view, and silently truncates |
| R-A18 | Low | csvCell does not neutralise a formula after leading whitespace / newline |
| R-A19 | Low | Bulk select can exceed the 500-id schema max (panel holds up to 2,500 rows) |
| R-A20 | Low | Client-portal AI page: the uploads card 403s and shows "Nothing uploaded yet"; the 'Members and admins' line leaks team roles |
| R-A21 | Low | Copy / small: brand list fallback marks any brand containing the domain label as "You"; orphaned JSDoc in ai-insights.tsx |

Blockers: none found. Multi-tenant scoping of the new read routes, the v1 / MCP routes and CSRF are correct (see "What holds" at the end).

---

## R-A1 (High) The on-demand quote ignores the owner's options, so the charge cap under-bills

**Where.** `app/server/src/services/runs.ts:77-83` (`aiPanelForQuote` builds the panel from `ai_prompts_max` and `ai_engines` only) and
`app/shared/src/cost.ts:216` (`aiPanelOfValues` returns `{ panel, engines }`, dropping `options` even when they are passed);
`app/shared/src/cost.ts:256` (`estimateRunCostParts` calls `estimateAiPanelCost({ panel, engines })`, also without options).

**Why it matters.** W2-E3 §9 (0)-(2) asks for exactly this: pass `aiClaudeWeekly, aiPulseEngines, aiPersonaContext, aiPersonas, aiFanoutCheck,
aiDemandMarket` from the monitors row, and use `aiOnDemandRunCost(panel)` in the breakdown. The engine reserves the options (W2-E3 §6: "the
reservation includes the options"), and `costSync.ts:404` caps the charge at the run's quote. So for a site with options on, the credit check is
too low and the platform absorbs the difference on every on-demand AI check.

**Proof** (scratch test `quote.review.test.ts`): 50 questions, six engines, Claude weekly + persona context (3 roles) + fan-out 100 + market trend:
engine figure `aiOnDemandRunUsd(...)` = **$4.412**; app quote (what `aiPanelForQuote` builds) = **$3.274**; app quote even with the options passed
= $3.274; `estimateRunCostParts` = $3.274. 26% of the run's real cost is never charged; at 200 questions the gap is larger (W2-E3 table: full run
10.68 -> 11.89).

**Fix.** In `aiPanelForQuote` pass the row's `ai_claude_weekly`, `ai_pulse_engines`, `ai_persona_context`, `ai_personas`, `ai_fanout_check`,
`ai_demand_market` to `aiRunPanelOf`; in `aiPanelOfValues` keep `p.options`; in `estimateRunCostParts` use `aiOnDemandRunCost(panel)`. Add the
`cases_options` golden loop W2-E3 §9 (3) gives, plus a server test that a monitors row with options raises the quote.

## R-A2 (High) Sentiment is presented as validated when the engine says it is not

**Where.** `app/shared/src/ai-detail.ts:236-250` (`parseAiSentiment`) and `app/web/src/pages/site/_components/ai-panels2.tsx`
(`SentimentPanel2`); also exposed as `sentiment` in `GET /api/v1/websites/:id/ai-visibility` and MCP `get_ai_visibility`.

**Proof.** The engine (`n8n/seo-agent/v5/code/_ai_sentiment.js:99-135`) writes `validated: KAPPA.model != null && ...` (false today: the model
evaluation was not run, W2-E2 §4), `kappa: { rules_blind_holdout: 0.548, ..., model: null, gate: 0.7, note }` (an object) and a `note` ending "The
model's labels are not yet validated against a hand-labelled set." The reader ignores `validated` and `note`, and `num(x.kappa)` turns the object
into `null`, so the kappa line disappears too. The page then prints "Net sentiment +23, 95% range ..." with by-aspect nets and objections, with no
qualifier. W2-E2 is explicit: "Until its hold-out kappa is written ... `sentiment_json` says `validated: false` and the report says 'not yet
validated'". The app is the one surface that does not.

**Fix.** Read `validated` (default false when absent on a present column) and `note` / `unread_note`; when not validated, show a "Not yet
validated" badge and the note under the figure, and pass `validated` through the API. Read `kappa.model` / `kappa.rules_blind_holdout` from the
object for the method line. Add a test with the engine's real `aggregate()` output.

## R-A3 (High) "Part of the open run" is a failure everywhere outside the run page

**Where.** `app/server/src/services/runs.ts:615` stores the joined check as `status: 'failed'` (+ `lastStage: 'joined_open_run'`);
`app/shared/src/integrations.ts:164` emits `run.failed` whenever a run moves to `failed`, without looking at `lastStage`.

**Scenario.** A customer with a `run.failed` webhook (or the Slack / Teams / Jira / Linear integrations built on events) presses "Run an AI
visibility check" while the weekly run is open. The engine answers `rejected` with `reason: 'open_run'`; the run page correctly says "Part of the
open run", but `emitForCallback` sends `run.failed` with error "Part of the open run (finishes about 09:40 UTC)." to their endpoints. `/api/v1/runs`
and the MCP `list_runs` show `status: "failed"`. WAVE2_CONTRACTS §6: "not a failure".

**Fix.** Either a distinct status (e.g. `completed` with a `joined` flag, or a new terminal status the screens and filters know), or at minimum:
skip `run.failed` in `eventsFor` when `runAfter.lastStage === AI_JOINED_OPEN_RUN` (pass `lastStage` into `runSummary`), and expose
`joinedOpenRun: true` in the v1 run shape. Test: a `rejected` / `open_run` callback emits no `run.failed`.

## R-A4 (Medium) An AI upload deletes every row of its source and day, not its own key

**Where.** `app/server/src/services/aiWave2.ts:242-247`: before inserting, every day in the file is deleted for `(site_id, source, day)`. The
contract (WAVE2_CONTRACTS §5) is an upsert by `(site_id, source, day, url, query)`.

**Scenario.** Bing's AI Performance gives a pages view and a grounding-queries view; Search Console gives Queries, Pages and Dates files. The owner
uploads the Bing pages file (by day), then the Bing queries file for the same days: the second upload deletes every row of the first. The toast says
"N rows from Bing ..." for each; nothing says the earlier file was replaced. The same for a GSC Pages file followed by a Queries file with the same
"last day of the period". The engine's `imports_json.top_urls` then goes empty. (Keeping both would double-count the totals instead, which is
probably why the delete is broad: the replacement rule has to be chosen and said, not implied.)

**Fix.** Key the replacement by the file's kind as well (store `kind` = pages / queries / days, or replace by `(source, day, url != '' , query != '')`
shape), say "replaces your earlier <kind> file for these days" in the response, and have the engine sum one kind per source. Also: the deletes run
before the inserts, so a failed insert chunk (`insertRows` 20 s timeout) leaves the period empty; insert first under a new `import_id`, then delete
the older rows of the same key.

## R-A5 (Medium) Upload dates: day/month swapped or impossible, and undated files stamped today

**Where.** `app/shared/src/link-import.ts:84-85` (`importDate`) reads `a/b/yyyy` as day/month and never validates the month;
`app/shared/src/ai-import.ts:86` uses today when `periodEnd` is blank.

**Proof** (scratch `date.review.test.ts`): a Bing file with `10/22/2026` and `10/05/2026` is stored as days `2026-22-10` (month 22) and
`2026-05-10` (October 5th becomes May 10th); `days` = `{ from: '2026-05-10', to: '2026-22-10' }`. ai-import.ts's own header says the export
format "could not be checked against a real file"; Microsoft exports are commonly M/D/YYYY. A Search Console Queries file uploaded without "Last day
of the period" is stored entirely on today's date, so a 3-month export lands inside the engine's 28-day window as one day.

**Fix.** Validate month 1-12 and day 1-31, and when both readings are possible decide per file (any first number > 12 means D/M, any second > 12
means M/D; ambiguous files ask). Require `periodEnd` on the server for a file without a date column (the form already has the field). Confirm with
one real Bing export before deploy.

## R-A6 (Medium) The owner's uploads stay with the domain after the website is deleted

**Where.** `app/server/src/routes/sites.ts:165` `AI_TABLES_CLEARED_ON_DELETE = ['monitors', 'aiPrompts', 'aiVisibility', 'aiAnswers', 'aiDaily']`
does not include `aiImports`.

**Scenario.** Company A uploads its Bing / Search Console AI exports (queries, page URLs, file names), then deletes the website. Company B verifies
the same domain: the AI page's uploads card (`aiImportsOverview`) shows A's totals, date range and file name, and the engine's `imports_json` /
`demand_json` count A's rows for B. A12's own rationale ("the next company that verified the domain saw them") applies to this table.

**Fix.** Add `aiImports` to the list (its rows carry `domain`), and a test next to the existing A12 one.

## R-A7 (Medium) Deleting an automatic question does not stop it being asked

**Where.** `app/server/src/services/aiWave2.ts:274-284` deletes the prompt row; the confirm dialog (ai-panel.tsx) says "Deleted questions are
removed from the panel and no longer asked."

**Why it fails.** The engine's panel writer (`v5/code/Prompt_Rows.js`) dedupes new questions against the STORED panel and ids are
`AIP.promptId(site_id, prompt)`; a question that was switched off is kept as an `off` row precisely so it is not written again. Deleting the row
removes that tombstone: the next weekly run's writer / template / discovery (deterministic from the same keywords and LLM-mentions data) can write the
same question again as `active`, and it is asked and billed. True for every non-`custom` question, and worse for a question that was already `off`.

**Fix.** Allow delete only for `source === 'custom'` questions, or turn a delete of an automatic one into "switch off" (keep the tombstone), or have
the engine keep a `deleted` status the writer respects. Say which in the dialog.

## R-A8 (Medium) The read cache keeps very large rows per site, indefinitely

**Where.** `app/server/src/n8n/client.ts:194-225`: expired entries stay in the `cache` Map until the same key is read again or 500 keys exist;
`AI_READ_LIMITS` (`services/data.ts:1086`) allows 6,000 answers and 300 visibility rows per read.

**Why it is new.** Wave 2 adds to every answer row `answer_text` (up to 12,000 characters) plus `cited_json`, `retrieved_json`, `products_json`,
`detail_json`, and to every weekly visibility row `units_json` (W2-E2 §2: about 145 KB for a 4,500-answer week). The n8n API returns every
column. At 500 questions x 9 engines one site's latest-run answer read is roughly 25-50 MB of JSON (more as JS strings), and its visibility read
grows ~7.5 MB per year of weekly rows; each AI page, overview, recommendations, export and v1 call reuses or re-fills these keys, and the question
history adds one key of up to 1,500 answers per question opened. All of it stays resident on the 4 GB e2-medium that also runs n8n and Postgres.

**Fix.** Evict expired entries (sweep on write, or an LRU by bytes), do not cache reads above a size, and stop shipping columns nobody reads: the
summary path (`answers: 'summary'`) only needs prompt_id / engine / answered / mentioned / cited (read them without the detail columns, or keep a
compact per-run result row); the visibility read never needs `units_json`.

## R-A9 (Medium) Web and API deploy separately and break each other's AI page

**Where.** `app/server/src/services/data.ts:1207` now returns `answers: []` to the page; the new web reads `/data/ai/answers`,
`/data/ai/imports`, `/data/ai/export`, `/ai/import`, `/ai/prompts/delete`.

**Scenario.** The web is on Vercel and deploys on merge to main; the API on GCP is deployed by hand. New web + old API: the answers section,
uploads card and downloads 404, and the filter bar does nothing. Old API first + old web: the old web's answer explorer and panel results read the
now-empty `answers` (every question shows "no answer"). The engine side also has to be live before the app sends `ai_alert_rules_json`,
`stage: 'shopping'` and `keyword` edits to Site Admin.

**Fix.** Deploy API (and engine) first, keep `answers` populated for one release when the request does not ask for `answers=summary` (the new web
sends that flag), then merge to main. Put the order in the deploy checklist.

## R-A10 (Medium) `imports_json` is read with the wrong shape

**Where.** `app/shared/src/ai-detail.ts:325` reads `from: str(o.from), to: str(o.to)` per source; W2-E3 §4 writes `days: { from, to }` (and
`period` at the top, and a `copilot` block).

**Proof** (scratch `quote.review.test.ts`): the engine's documented shape parses to `{ source: 'bing_ai', rows: 3, ..., from: '', to: '' }`.
`GET /api/v1/.../ai-visibility` publishes `imports.sources[].from/to` as empty strings to API clients. `copilot.label` / `citations`, which W2-E3
§9 (4) asks the Copilot tile to print whenever a Bing file exists, is not read or shown anywhere.

**Fix.** Read `o.days.from/to` (fall back to `o.from`), `period`, `copilot`; show the Copilot line on the Copilot engine row / tile with its label.

## R-A11 (Medium) The pulse-engine choice cannot go back to the default

**Where.** `app/shared/src/payload.ts` sends `ai_pulse_engines: []`.join -> `''`; `app/server/src/routes/sites.ts:470-473` sends `' '` for
empty brand names, personas and markets but not for pulse engines; the engine's `Monitor_Row_Admin.js:34` treats `''` as "keep the stored list".

**Scenario.** The owner has `chatgpt` only in the pulse and unticks it: the app sends `''`, the engine keeps `chatgpt`, and the form, reading back
`[]`, now shows the default three engines ticked. What the screen says the pulse asks is not what it asks, and the cost estimate beside it follows
the screen.

**Fix.** Send `' '` for an empty `aiPulseEngines` like the other lists (the engine's `list(' ')` yields `''`, the default).

## R-A12 (Low) The CSV download goes through the Vercel proxy

`app/web/src/lib/queries.ts:489` builds a same-origin URL; `lib/api.ts` says large or slow requests (exports) go to `API_ORIGIN` directly because
the proxy has size and time limits. An answers CSV at 500 questions (answer_text included) is tens of MB and needs up to ~24 sequential n8n reads
when cold. Use `directUrl(...)` for the anchor (top-level navigation carries the parent-domain cookie).

## R-A13 (Low) "A file for another website is refused" is not true for query or date files

`app/shared/src/ai-import.ts:90` checks the domain only when the file has a URL column. A Search Console Queries file or a Bing queries file of any
other property is accepted. Unavoidable for those files, but the marketing line (features.ts: "A file for another website is refused") and the
contract promise more. Say "a pages file for another website is refused", and show the file's top queries in the confirmation so a wrong property
is noticed.

## R-A14 (Low) Per-question rate drawn below the floor

`app/web/src/pages/site/_components/ai-answers.tsx:317` plots a question's named rate when `n >= 3`; everywhere else (`AI_MIN_RATE_SAMPLES` 12,
"too few answers") a rate under 12 answers is not drawn. One question at 3-6 answers a run will look like 0% / 33% / 100% swings (the band is
there, the line dominates). Use the same floor, or draw only the band.

## R-A15 (Low) Quote fallback when the monitors row cannot be read

`app/server/src/services/runs.ts:84` returns `null` on any read error, and `estimateRunCost` then uses the fixed 8-question table row (about $0.95)
for a site that may have 500 questions on 9 engines (tens of dollars). The charge is capped at that quote. Fail closed (refuse to start, "could not
price your panel") instead of under-quoting.

## R-A16 (Low) Sequential n8n calls and partial failure

`deleteAiPrompts` (`aiWave2.ts:277`) issues one DELETE per id (up to 500, 20 s timeout each) from a request that goes through the Vercel proxy;
`importAiReport` one DELETE per day before its inserts. A failure midway throws 502 after some rows are gone and before the audit row is written
(`routes/sites.ts` audits after the service returns). Batch (n8n filters take `or` via several conditions on one id list, or delete by `import_id`),
and audit what was done in a `finally`.

## R-A17 (Low) Upload overview reads the whole table on every page view

`aiWave2.ts:257` reads up to 20,000 `seo_ai_imports` rows (80 sequential 250-row pages) for the card on every AI page load (60 s cache), and when a
site has more rows the totals are silently cut. Aggregate on write (a small per-source summary row) or read only the last 28 / 90 days.

## R-A18 (Low) csvCell and leading whitespace

`app/shared/src/identity.ts:662` neutralises `= + - @ \t \r` only at position 0. Brand names, citations and answer text come from third-party AI
answers; `" =HYPERLINK(...)"` and `"\n=1+1"` pass through unchanged (scratch test output). Most spreadsheet apps treat these as text, some trim
first. Test against `/^\s*[=+\-@]/` as well.

## R-A19 (Low) Bulk selection larger than the schema allows

The panel holds up to 2,500 rows (`AI_READ_LIMITS.prompts`); "Select every question shown" with the All filter can pick more than 500, and both
`ai_prompts` (`AI_PROMPTS_MAX`) and `aiPromptDeleteSchema` (`schemas.ts:696`, max 500) answer 400 with a validation message. Cap the selection at
500 in the UI with a line saying so, or send in chunks.

## R-A20 (Low) Client portal view of the new panels

`AiReportsCard` calls `/data/ai/imports`, which uses `guard` (viewer): a client person gets 403, the card shows "Nothing uploaded yet ..." and
"Members and admins can upload." Hide the card for client roles (the export menu already does this with `role.startsWith('client')`).

## R-A21 (Low) Small

- `ai-answers.tsx` (brand fallback for rows without `entities`): `role: name.includes(domain.split('.')[0]) ? 'self'` marks any brand that contains
  the domain's first label as "You" (domain `ai.com` marks every brand with "ai"). Use `aiIsOwnUrl` / the brand names list.
- `ai-insights.tsx`: the JSDoc "Visibility by buyer stage and topic cluster ..." now sits above `AI_RATIO_MIN_SESSIONS`, not `GroupsPanel`.
- The upload input accepts `.tsv` / `.txt`; `parseCsv` guesses the delimiter from the first line only, and Search Console exports can start with a
  title line (`ai-import.ts:76` expects that), so the guess can be made on the title.
- `periodEnd` is checked only by regex (`2026-02-31` passes).

## Copy and brand

No em dash, curly quote, `…` or stock AI phrase in any added user-facing string (scanned every added line under `app/web/src` and
`app/shared/src`, incl. guides, changelog, features, pricing). No raw colours, gradients or non-token classes in the new components. New inputs carry
labels or `aria-label` (run picker, search, file input, bulk-select checkboxes, rule edit / delete buttons); panels use `Panel` / `SectionHeading`
headings; the filtered view is `aria-live`. No issue found here beyond R-A20.

## What holds (checked, no finding)

- Every new app route goes through `siteAccess` (company + site membership) and `requireVerified`; reads with `client_viewer` where the portal shows
  them and `shown()` strips cost keys; exports and imports overview are refused to client roles; upload is `member`, delete is `admin`, Site Admin
  stays `admin`. CSRF: all new POSTs fall under the global `x-requested-with` hook.
- Every n8n read and delete filters `domain eq` (plus `prompt_id eq` / `run_id eq`); `run` and `promptId` are matched inside the domain's own rows;
  no `like` filter was added. Imports delete by `site_id eq` (the engine-id collision guard keeps that unique).
- `/api/v1` ai-visibility / ai-answers and the MCP tools use `siteOf(ctx)` (company scoped) and `requireVerifiedSite`; client roles cannot obtain a
  session v1 context (orgAccess default `viewer`).
- Credits per AI run come from the ledger by `org_id` and domain; ledger entries carry the event's `occurred_at`, so bucketing by run start is sound.
- Old rows: every wave-2 reader returns null on an absent column and the page keeps today's view; `sources_json` v1 array and v2 object both read;
  shopping "no shopping results" never shows a rate; sentiment withheld under 12 (but see R-A2); deltas come only from `compare` (A1).
- BigQuery export: the added `credits_charged` column is safe with `WRITE_TRUNCATE` + explicit schema; existing columns kept (descriptions fixed to
  0-100).
