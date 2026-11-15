# Client report 2026-11-16, issue 1: AI answer pages (engine side)

Branch `fix/ai-answer-engine-1116` (from `feature/seo-agent-v4.5` 3eb8c996). Investigation: INV1 (private, F1-F13). Contract with the app
fixer: CONTRACT_ISSUE1 (private; the changes made here are listed at its end and in section 6 below). Build section **192** checks it on
the generated workflows; harness scenarios **CQ1-CQ8** (`harness/scenarios_client_1116.js`) plus one shared cadence case.

## 1. What the client saw, in one line

devaicon.com clicked "Write the page" for an AI question ("Which companies offer the best AI automation services for businesses in
Dubai?"); the page was written for the panel TOPIC "ai automation services" (the search of its own service page), typed "Service Page",
then recorded as published at that service page, so the form said "You already have a page for ai automation services". The same chain
wrote a real duplicate on techand.ai (an AI guide beside the ladder's own CRM page).

## 2. The rule now

One search, one page stays the rule. An AI answer page is its own search: the question's keyword (`seo_ai_prompts.keyword`), never the
topic. It is a duplicate only when a page of the same market owns that search; then the right move is to improve that page for the
question, said in plain words. A page of another market is advice only (link the two).

## 3. What changed (engine)

| Finding | Where | Change |
|---|---|---|
| F1 / F5 / F13 | `v5/code/AI_Metrics.js` | Every question carries its own `keyword`; `gaps_json` carries `keyword`, `target_status`, `page_url`. The action for a lost question reads the stored AI target and the content log: a page written for it -> "Publish your page" (type `publish`, no `api_body`); live, set aside, kept out or won -> no content action; AI Growth plans a refresh -> "Improve <path> to win the answer", `api_body.existing_page_url` + `ai_target.kind: 'refresh'`; else a new answer page on the question's own search. Page types are form values only ("Comparison Page" -> "Guide"; an /insights/ or /blog/ page refreshed stays a Guide). |
| F2 / F3 | `Parse_Verdict.js`, `Originality_Check.js` | The blanket AI exemption from the duplicate rule is gone. An AI page is checked with `DUP.targets(<question keyword>, pages, { market })`; a keyword ladder's LIVE page also owns the question when the question is that page's search (`LRU.sameQuestion`) or carries every word of the ladder's main keyword (`LRU.coversHead`), e.g. techand's "best crm service provider uae" and the ladder head "crm service provider" at /dynamics-365-crm-uae. Same market -> person-started run held, first alternative `ai_refresh` "Improve <path> for this question" (same AI target, kind refresh, `existing_page_url`); automatic runs shadow (D17) as for every hold. Other market -> advice. The score hold exemption for AI pages stays. Originality Check: the same rule (a same-market owner is a duplicate, other market is advice) with an AI-specific sentence. |
| F10 | `Parse_Verdict.js`, `_grade.js` (`fitOf` / `fit` only) | An AI run keeps the page type it was asked for (the verdict's suggestion goes to `page_notes`). The grade does not cut an AI page's fit for a low verdict while no duplicate is open (a duplicate still caps it). |
| F2 / F10 | `Finalize_Parse_Brief.js`, `build_v4.py` (Build Webhook Response `page_run`) | `page_run.ai_target` is sent with every content callback and the final version is judged with it (Finalize carried `ai_target: null`). |
| F4 | `Content_Log_Row.js`, `Publish_Candidates.js`, `Match_Slugs_Detect.js`, `Detect_Published.js`, `ladder_common.py` | The content-log row keeps the page as written (`planned_slug`, `planned_title`, `planned_h1`). Detection looks for it at its own slug first (95); a title check compares the live title / H1 with the WRITTEN title both ways (80%, brand after "|" left out), the keyword-only rule stays for rows written before. An address whose last segment is the last segment of a page the site already has (published, existing, or another search's page) is that page MOVED and is never claimed (except at the row's own planned address). |
| F6 | `Content_Log_Row.js` | A run with an AI target is `ai_answer` / `ai_refresh` whoever started it (the app opened rows as `app`); a ladder page that also answers a question stays `ladder`. |
| F7 | `_ladder_rules.js` (LRU: `qWords`, `sameQuestion`, `coversHead`), `Cadence_Plan.js`, `app/server/src/services/cadence.ts`, `Growth_Plan.js` | The fold of an AI question into a ladder page needs the same search (question scaffolding such as "best", "top", "which", "recommendations" out, plurals folded, places read as their market) or the ladder's main page when the question carries all of its words. Head words are no longer stripped. Engine and app mirror identical; the shared fixture case `ai_question_not_folded_into_other_search` runs through both. |
| F8 | `AI_Target_Settle.js`, `build_site_tracker.py`, `Growth_Plan.js` | The cadence settles AI targets on its idle branch too (`Settle Idle?` -> `AI Target Settle (Idle)` -> `Settle AI Targets (Idle)`; a dry run or preview settles nothing). Settle: published -> `written` (code `live`, its address), failed -> `queued` at once (`run_failed`), a LADDER page of another search -> `queued`. AI Growth applies the same evidence every week (`settleOf`), and links a queued question to a page written FOR an AI question on its keyword (source `ai_*`, after the question existed). |
| F9 | `Growth_Plan.js` | The topics a question is judged against (inside AI Growth only, D13) add the focus topics of active questions from a ladder / the client's page / the client, the searches of the client's published pages, and its main menu titles (utility pages out). Only topic reasons can change; brand, government, job, portal and market refusals are untouched. The provenance rescue ("asked about your topic X") is SHADOW: recorded on `targets_set_aside[].shadow_rescue`, status unchanged. |
| F5 | `Growth_Plan.js`, `build_monitors.py` (`Load Pages (Growth)`) | AI Growth reads the page inventory. A question is never matched to a page aimed at another market; a page of the same market that owns the question's search makes the target a refresh of that page (`same_search_page`). |
| F11 | `_ai_question.js` (new kit AQ), `Growth_Plan.js`, `AI_Target_Marks.js`, `AI_Target_Settle.js`, `AI_Rank_Plan.js`, `ladder_common.py` | Every `seo_ai_targets` row carries `reason_code` + `reason_args` (JSON: page_url, keyword, date, market, reason). Stored reasons are plain words: no run / target ids, table names, lever ids, dollar figures or long dashes (`AQ.clean`); the AI-ranking reason is "Chosen by AI ranking: improving <page> is the step most likely to get you named here." (lever, gain and cost stay on the AI-ranking action row). |
| F12 | `_ai_focus.js` (+ generated app copy) | A service entry that is a sentence fragment ("we provide ...", "and ...", over 6 words, a sentence break) is not an AI panel topic. |

New kit markers: `/*__AI_QUESTION__*/` (build_monitors `src()`, build_site_tracker `rd()`), and `/*__LADDER_RULES__*/` / `/*__DUP_TARGETS__*/`
now also expand in build_monitors / build_site_tracker. Generated app files refreshed by the build: `app/shared/src/ladder-rules.generated.*`
(LRU types gain `qWords` / `sameQuestion` / `coversHead`) and `app/shared/src/ai-focus.generated.js`.

## 4. New Data Table columns (sync_tables.py adds them on deploy)

- `seo_ai_targets.reason_code` (string), `seo_ai_targets.reason_args` (string, JSON) - placed before the AIR block, which stays last.
- `seo_content_log.planned_slug`, `planned_title`, `planned_h1` (string).

Deploy note: run `sync_tables.py` (deploy_engine does) BEFORE the new AI Growth / cadence runs write rows, or those exact-column writes fail.

## 5. Tests

- Build: `python3 build_v4.py` exit 0; section 192 prints its checks.
- Harness: full run **19716 passed, 0 failed** (baseline 19620 / 0). New: CQ1-CQ8 (each non-control check fails on the base
  commit 3eb8c996: verified by building the base with the new scenario file, 33 failures, 0 aborted in the controls), the shared cadence case
  (fails on base KF2). Updated on purpose: S95 / W0D3 / W0C1 (the old AI exemption and reason texts), AIR golden snapshots
  `ai_growth_off.json` / `ai_growth_off_paths.json` regenerated (only `reason_code` / `reason_args` and the new `Load Pages (Growth)` node
  differ; statuses, keywords and reasons identical; `moved_from_base` kept), `fixtures_air.js` target rows carry the two new columns.
- Accuracy sets: the shared fit gate is unchanged, so KWACC / S49 / KI sets do not move. The three devaicon questions were NOT added to
  `accuracy/keywords.json`: the shared gate (D13) still refuses "ai project engagement models" on services alone (AI Growth passes it with
  its wider topics), so adding them as `in` would register known misses and re-baseline KWACC; that is an owner decision.
- App: `npm run typecheck` (all workspaces) clean; `npm test -w @seo/server` **2163 passed, 46 skipped** (run with the repository mounted: some
  suites read n8n files); `npm test -w @seo/shared` 1291 passed (generated kits parity). `cadenceLevels.test.ts` runs the new shared case (67
  cases) and fails on the base cadence.ts (picks).

## 6. Contract changes (also appended to CONTRACT_ISSUE1 "Changes")

1. `page_run.ai_target` is in every content callback; for the final version to be judged as an AI page the app must send it back:
   add `'ai_target'` to `PRC_GRADING` in `app/shared/src/page-review.ts` (or pass `ai_target` on the finalize body; the engine reads both).
2. Extra reason codes beyond the contract list: `not_for_site` (args.reason brand | government | job | navigational), `unjudged`,
   `suggested`, `draft_failed`, `lost_again`, `ladder_page`, `not_asked`, `off_panel`, `kept_by_you`, `too_few` (reserved). `AQ.reason()` is
   the engine's wording for each.
3. AI visibility actions: a new action type `publish` (no api_body); a refresh action carries `api_body.existing_page_url` and
   `ai_target.kind: 'refresh'`. `page_type` is always a form value.
4. Parse Verdict alternative `ai_refresh`: `{ kind, label: 'Improve <path> for this question', url, keyword, page_type, existing_page_url,
   ai_target: { ...run's ai_target, kind: 'refresh' }, why }`, first in the list; "Write it anyway" stays the app's button (hold_ack).
5. `seo_content_log.planned_slug / planned_title / planned_h1`: the engine fills them when the page is written; the app's opening row may
   leave them empty.

## 7. Behaviour changes for automatic runs

- AI Growth turns a lost question whose search a same-market page owns into a refresh of that page (`same_search_page`), and never matches
  a question to another market's page. The weekly AI page may therefore be a refresh where it was a new page.
- The cadence folds a question into a ladder page only on the same search (or the main page it fully covers): the AI page of the week may be a
  separate answer page where it used to be folded into an unrelated rung.
- A target leaves `writing` on the next cadence run whatever it writes, and in AI Growth every week; a failed run is queued again at once.
- Automatic page runs that still meet a same-market owner are shadow-held (recorded, written), as every automatic hold since D17.

## 8. Production repairs recommended (NOT done; owner approval)

- R1 `seo_content_log` id 60 (devaicon, "ai automation services", request 12467): clear `published_url` / `published_at`, status back to
  `not_ready`, publish note "detected by mistake at the service page /services/ai-automation-services-pakistan"; optionally re-key to
  "best ai automation services dubai", source `ai_answer`, once the app half (form notice) ships.
- R2 `seo_ai_targets`: id 36 (Dubai) -> `written`, request 12467, reason_code `written`; id 41 and id 37 repair themselves on the first AI
  Growth run after deploy (41 -> written / live, 37 -> queued as "another search"), no manual write needed; techand id 23 -> `queued`
  and content_log 61-63 -> `failed` ("the page run stopped at the 1-hour limit") if not already repaired by the writing-slots release.
- R3 techand duplicate (content_log 64, /insights/dynamics-365-crm-uae beside /dynamics-365-crm-uae): tell the client; 301 the guide into
  the ladder page after merging its answer section, or retarget it. No data change without the client's choice.
- R4 old reasons: rows written before this release keep their raw `reason` until AI Growth rewrites them (weekly); the app should prefer
  `reason_code` and fall back on status. An optional one-off: blank `reason` on `writing` rows whose text contains "seo_content_log".
- R5 devaicon services: ask the client for clean service names (F12); the engine now ignores the sentence fragments as topics.
