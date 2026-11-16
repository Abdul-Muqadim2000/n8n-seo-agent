# AI answer pages: the question's own search, one page per question (client report 2026-11-16, app side)

Branch `fix/ai-answer-app-1116` (from `feature/seo-agent-v4.5` at 3eb8c996). Not deployed. The engine side is `fix/ai-answer-engine-1116`;
the contract between the two is `CONTRACT_ISSUE1.md` (private, client-reports-2026-11-16), its "Changes" section lists what this branch
assumes.

## What the client saw (devaicon.com)

AI visibility said "Win the answer to 'Which companies offer the best AI automation services for businesses in Dubai?'" with "Write the page".
The form opened with the keyword "ai automation services", the search of the client's own service page, and later said "You already have a
page for 'ai automation services' ... live at /services/ai-automation-services-pakistan" under "Written to be the page AI cites". The page
asked for was an answer page for a question; the tool treated it as a second copy of the service page. The AI page also printed internal
text: `set_aside`, "cad_20261113_devaicon-com_2", "seo_content_log row", "AI ranking (L06): ... expected gain 0.0119 over $9.63".

## What changed

| Finding | Change | Files |
|---|---|---|
| F1, F5, F13 | One resolver for every "write a page for this AI question" button: the question's own search (the stored target's, else the panel question's; the topic only when the question has none; an older report action's topic keyword is corrected through the question, found by target id, prompt id or text), a page type the form accepts ("Comparison Page" and the old service-page default become Guide, a refresh keeps its page's type), the AI target always, "Improve the page" for a planned refresh or when a live page of the same market owns the search (the engine's 75% word share, another market's page excluded), and no write button when the question's page is written ("Report it published"), live ("See the page"), being written or won | `shared/src/ai-question-action.ts` (new) |
| F1 | Used by the AI visibility hero's next step, "Questions you lose", "What to do next", "Questions to win" | `web/src/pages/site/AiVisibilityPage.tsx`, `_components/ai-question.tsx` (new), `_components/actions.tsx` (`resolve` prop), `_components/ai-growth.tsx` |
| F1 | Recommendations: `actionFromApiBody` keeps `ai_target` (it was dropped, so "Write the answer page" started a plain page) and maps "Comparison Page" to Guide; the AI report's page actions go through the resolver (nothing recommended for a question whose page exists) | `server/src/services/recommendations.ts` |
| F13 | Pipeline Write now: the AI target through the shared sanitizer, the page type through the shared mapper; "Comparison Page" is a guide | `pipeline/WriteNowDialog.tsx`, `pipeline/common.ts` |
| F2 | Form notice for an AI page (`NoticeInput.aiTarget`, `country`): a page written for THIS question (its run carried the target or the question) -> "You already have a page for this question" with "Improve <page> for this question"; a live page of the same market that owns the question's search -> "Your page <page> already answers searches like this one" with the same offer; "Write a second page anyway" last. Another question of the same topic no longer matches. `usePlan.aiKind = 'refresh'` switches the form's AI target to a refresh. The "Written to be the page AI cites" callout is hidden while such a warning shows | `shared/src/pipeline-notices.ts`, `web/src/pages/tools/_components/forms/research.tsx` |
| F2 | The Pipeline's written pages carry the AI question the app's run carried (`aiTargetId`, `aiQuestion`) and keep an AI page's kind | `server/src/services/pipeline.ts` (`writtenPages`), `server/src/services/ladders.ts` (`SiteRun`) |
| F6 | An app-started AI run is logged `ai_answer` / `ai_refresh` (a ladder page stays `ladder`) and moves its question's target to `writing` with the run's request id (core columns first; `reason_code` / `reason_args` separately, best effort; never a `won` row) | `server/src/services/runs.ts` (`pageSourceFor`, `aiTargetWritingUpdate`) |
| F8, F11 | Questions to win in plain words: the state is derived with the content log (a target still `writing` whose page is live shows Published), badges Queued / Being written / Written / Needs a fix / Waiting for you / Published / Will be tried again / Later / Covered / Not for this website / Kept out by you / Won, one sentence each from a fixed table keyed by `reason_code` (or read from the older sentence); the engine's own text only for platform admins, behind "Engine note (platform admins only)". A question folded into a ladder page for another search is not shown as answered by it | `shared/src/ai-target-status.ts` (new), `server/src/services/data.ts` (`targetStat`, `aiWrittenPages`, `aiRunQuestions`, gaps fields), `web/.../ai-growth.tsx` |
| F11 | AI ranking steps: the engine's scoring line ("cells", "expected gain", money, client time) is dropped for customers, a lever id prefix removed; admins see the raw note behind a disclosure | `shared/src/ai-rank-client.ts` (`aiRankWhyPlain`), `shared/src/ai-rank.ts`, `web/.../ai-rank.tsx` |
| F12 | "What do you sell?": a new entry that reads like a sentence (starts "We / Our / and ...", holds a sentence break, or runs past 12 words) is refused with a plain hint; a list saved before keeps passing the schema and the form names its sentence-like entries to replace | `shared/src/list-entries.ts`, `web/src/components/site/SiteBusinessFields.tsx` |

Data shapes (all optional, older rows and an engine without the fix keep working): `AiData.pagesWritten`, `AiTargetStat.promptId / state /
badge / tone / statePageUrl / viaLadder / hidden / adminReason`, `latest.gaps[].promptId / keyword / topic / kind / targetStatus / pageUrl`,
`report.questions[].keyword`, `PipelineData.written[].aiTargetId / aiQuestion`, `AiTargetRow.reason_code / reason_args`. API.md notes them.

No schema change in `shared/src/schemas.ts` or `payload.ts` (no `export:payloads`, harness S23 unaffected), no migration.

## Tests

- `shared/src/ai-question-action.test.ts` (13): topic -> question keyword on an older action, gap rows, another market's page is not the
  owner, live / writing / written / won / refresh targets, a page the app wrote for the question, the techand ladder-head case, page types,
  the AI target's limits, the prefill passes `keywordInput`.
- `shared/src/ai-target-status.test.ts` (9): targets 41 / 37 / 42 and the AI ranking row as stored on production, reason codes and an unknown
  code, failed and not-ready pages, every status x code x kind renders a clean sentence (no "cad_", "ait_", "seo_", "L06", "$", em dash,
  "...", curly quotes, `set_aside`, "cell(s)", "expected gain"), `aiRankWhyPlain`.
- `shared/src/pipeline-notices.ai.test.ts` (6): the client's screenshot case gives no warning, a page for this question (live / not live),
  the techand owner case with "Improve <page> for this question", a stale topic keyword, the plain rule unchanged for non-AI pages.
- `shared/src/list-entries.test.ts` (+3): sentence-like services refused, real names kept, a saved list still passes the schema.
- `server/test/aiAnswerPages.test.ts` (10): `actionFromApiBody` keeps the AI target, recommendations correct an older topic action and skip
  a live question, `pageSourceFor`, `aiTargetWritingUpdate`, `targetStat` (live, set aside, admin note), `aiWrittenPages`, `writtenPages`.
- `web/test/aiAnswerPages.test.tsx` (3): the Questions to win panel as a client reads it (no banned text, Published, one "Improve the page"),
  the admin disclosure, the AI ranking steps.

## Production data (not done here)

See INV1 "Production data repairs" R1-R5: content log 60 (detected at the service page by mistake) and target 36 / 37 / 41 / techand 23.
With this branch the app shows target 41 as Published already (from content log 66), target 37 as still planned (its page covers another
search), and no longer offers row 60's topic keyword from any button; R1 still matters for the publish detection and the Content page.

## Review fixes (REVIEW_issue1_app.md, on fix/cr16-integration)

| Finding | Verdict | Fix | Test (fails before, passes after) |
|---|---|---|---|
| M1 the AI visibility REPORT's "Write this page" | Confirmed | `components/reports/actions.tsx`: an action whose `api_body` carries `ai_target.question` goes through the resolver with the website's AI data (the AI page's cached `data/ai`) and the report's own question grid; nothing shows until the data is read; "Write this page" / "Improve this page" / "I published it" / "See the page" / a sentence. `prefillFromApiBody` keeps `aiTarget` and maps the type with `aiFormPageType`; `runFromApiBody` maps an AI action's type too. Other entry points checked: `rank.tsx` (ladder next rung, no AI target), `tracker.tsx` (site tracker), `ladders.ts` (ladder plans) | `web/test/aiReportActions.test.tsx` |
| M2 `aiSearchOwner` finds owners the engine would not | Confirmed | The owner is decided by the engine's own rule for AI pages (generated kit): `LRU.sameQuestion` (question scaffolding out, places as their market, "ai" counted) or `LRU.coversHead` for a ladder's main page (`ladderHeads` from the Pipeline's ladders / Rankings, or `ladderHead` on a rung 4 content-log row). Address words never make an owner. A stored target (the engine's decision) is never re-judged by the app | `ai-question-action.test.ts` "review fixes", `pipeline-notices.ai.test.ts` |
| M3 services check refuses real names | Confirmed | Only clear sentences: "we / they / I" with a verb, 8 words or more, a full stop after a lower-case word that ends the entry or starts another sentence | `list-entries.test.ts` |
| L1 failed / stalled `started` row blocks the question; `not_ready` wording | Confirmed | `aiWrittenPages` drops the started row of a failed app run and of a run older than PAGE_IN_FLIGHT_HOURS; resolver: `not_ready` reads "needs a fix", a stale started row is no page | `server/test/aiAnswerPages.test.ts`, `ai-question-action.test.ts` |
| L2 "Write it anyway" of a held refresh run | Confirmed | `holdButtons` sends the run's target as kind `answer` | `web/test/holdLadder.test.tsx` |
| L3 off-host refresh under "Write the answer page" | Confirmed | Rebuilt as a new answer page (Guide, target kind answer, no page) | `server/test/aiAnswerPages.test.ts` |
| L4 not for this website / kept out | Confirmed | Resolver: no button, the target's plain sentence | `ai-question-action.test.ts` |
| Nits | Confirmed | Titles cut at a word with no ellipsis (a cut quote is closed); recommendation ids back to the action's own keyword (tickets are deduplicated by id); notice says "a page for <search>" when the page was written for another question of the same search | `server/test/aiAnswerPages.test.ts`, `pipeline-notices.ai.test.ts` |
