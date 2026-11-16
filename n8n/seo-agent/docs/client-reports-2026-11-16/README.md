# Client reports 2026-11-16 (devaicon.com, production)

Two reports (`Issues (2).docx`), each investigated on production data first (read-only snapshot of both databases taken 2026-11-16
02:27 PKT + five execution payloads; no paid calls). Investigation, review and verification files are private (client data):
`~/seo-agent-secrets/client-reports-2026-11-16/` (BRIEF, INV1, INV2, CONTRACT_ISSUE1, REVIEW_issue2, REVIEW_issue1_engine,
REVIEW_issue1_app, LIVE_VERIFY, tools/). Built by parallel agents in worktrees (issue 2; issue 1 engine; issue 1 app), merged on
`fix/cr16-integration`, an integration pass, three independent reviews (0 High; every Medium and Low fixed), then deployed.

## Verdicts

| # | Report | Verdict | What we found |
|---|---|---|---|
| 1 | AI visibility says "write a page for this question"; after writing, the tool treats it as another version of the published service page with the same title | **Right** | Three of the four "write a page" buttons (hero Next step, Questions you lose, Recommendations) sent the question's broad panel topic ("ai automation services" = the service page's keyword) instead of the question's own search ("best ai automation services dubai"). The 10 Nov run was then held as "same search", graded against the topic (59, labelled Service Page), and on 13 Nov publish detection recorded the guide as published at the client's moved service page `/services/ai-automation-services-pakistan` (it never was). Since 10 Nov AI pages also skipped one search one page entirely, which let a real duplicate through on techand.ai (an AI guide on the CRM ladder head's search). Related: one content-log row per topic, questions folded into unrelated ladder rungs ("agentic ai development companies uae" -> "ai app development companies"), targets stuck "being written" after their page went live, the client's own AI subjects called "off topic", raw internals on the page (set_aside, run ids, "expected gain ... $9.63"). |
| 2 | Pages delivered "95+/100" grade 84 once published; image checks fail | **Number right, explanation missing; part ours** | The 84 grades the text that is live, and that text is the client's own rewrite: 0 of 161 of our sentences on the agentic page, 11 of 149 (7%) on the governed page (same check, same input type both times; our reader added no site chrome). Of the 14 / 13 points lost, 10 / 9 are the rewrite (readability 62 -> 23 and 59 -> 26, the search phrase twice, the one citation dropped, coverage), 4 per page were our own measuring (the literal "Quick answer:" label, the site's FAQ accordion counted as the last section). Ours too: the final version's HTML dropped image width / height; the publish check counted related-article thumbnails and an avatar as article images (one missing-images cause became six failed checks); the card never said whose text is live. None of the 3 images we delivered is on either page; the governed page uses a Google Images thumbnail. "95+" is how 95-100 is shown (real: 97 and 98). |

## Engine (deployed)

- **191** (live grade): `kept_pct` / kept and delivered sentence counts (only when the read is plausible), the longest sentences, part by
  part `live_parts`, its own basis and one next step "on your website, then Re-check"; on a live page only: a direct answer without the
  label, a template questions section at the end, a table the page really has, the site name in the title and the live meta description
  (read by the publish check) cost nothing; every run: an image link is never a source. Publish check: the article region (the
  `<article>` / `<main>` holding the H1, cards dropped), decorative images apart, one "no images" item, borrowed images named (Google
  Images always; LinkedIn / Google user content only when the site is not built there), our delivered image names looked for after
  normalising CMS suffixes, the article's tables passed to the live grade.
- **192** (AI answer pages): actions and questions carry the question's own search (`_ai_question.js` AQ); a question whose page is
  written gets "publish your page", a live / won / set-aside one no action; one search one page checked on the question's search (a
  same-market owner -> hold with "Improve <path> for this question" first; automatic runs shadow; another market = advice; never against
  the page's own ladder); no verdict fit cap on an AI page; final versions keep `ai_target`; content log source `ai_answer` /
  `ai_refresh` + `planned_slug` / `planned_title` / `planned_h1`; publish detection looks at the written slug and title first, keeps a
  fallback at the old strength, never claims an existing or moved page (whole path compared); one fold rule `LRU.questionPage` (same
  search, or the ladder's main page covered in the website's market; place words are not topic words) in the cadence, AI Growth, settle
  and Parse Verdict; target states settle every week (also when nothing is written; a failed or held run goes back to queued); AI
  Growth's topic share also reads the client's own topics while brand / government / job / vendor refusals see exactly what they saw
  before; reasons as `reason_code` + `reason_args` with plain sentences; prose service entries are not panel topics.
- Columns (synced on deploy): `seo_content_log.planned_slug`, `planned_title`, `planned_h1`; `seo_ai_targets.reason_code`, `reason_args`.

## App

API deployed; the web went live when the owner merged PR #68 (2026-11-16 05:16 UTC, main 5e533221; Vercel deploy succeeded, the new
AI page buttons, live-grade card and changelog 4.14 / 4.15 verified in the live bundle). The current web works with the new API (every response
change is additive), and the engine's hero action already carries the question's own search.
- Issue 1: one resolver `shared/src/ai-question-action.ts` for every "write a page for this AI question" (hero, Questions you lose, What
  to do next, the AI visibility report, Questions to win, Recommendations, Pipeline Write now); the page owner decided with the engine's
  own rule and stored decision; form notices understand AI runs ("Improve <page> for this question" before "write a second page");
  the hold's `ai_refresh` button; `ai-target-status.ts` (every engine code mapped, tested against the engine's list; raw reasons for
  platform admins only); app-started AI runs logged `ai_answer` / `ai_refresh` and their question marked being written; sentence-like
  services refused for new input only.
- Issue 2: live grade stored with its parts, readability, kept share and the delivered grade (one source); the Content card says whose
  text is live, what lost points and what to change on the website, one images line; final-version HTML keeps image sizes, hero eager.
- Marketing changelog 4.14 (live grades) and 4.15 (AI answer pages); tutorials backlog rows (video-skills eb2a092).

## Checks

Harness **20016 passed, 0 failed** (19620 before); app shared 1373, server 2186 (+46 real-database suites skipped: CMS / crawlers /
integrations, not touched), web 400, typecheck, web build. CI on the branch: the same 12 AIR scenarios and the cmsRoutes real-DB suite
fail as on 3eb8c996 (CI builds without the owner's settings; pre-existing).

## Deploy (2026-11-16 ~00:00-00:15 UTC = Sunday evening New York)

Backup `gs://alaventra-prod-backups/pg/2026-11-15/*T235338Z` (n8n 621 MB, app 19 MB). Node diff before: production == the 3eb8c996 build
(0 workflows differ, alert webhook masked). `deploy_engine.py --no-build --apply` from the integration worktree: guard ok, 5 columns, 17
workflows updated, 29 published; after: production == this build (0). API on the VM b84591b8 -> 3b380c5c (`up -d --build app`, healthy,
0 restarts, /api/health 200; rollback image `alaventra-app:rollback-b84591b8`).

## Live verification on production ($0, nothing stored for the client)

App-built live grade requests (the app's own shared code; identical to production executions 13659 / 13698 apart from the request id
and the new fields) sent to the deployed Page Finalize: executions **14697** (agentic) and **14698** (governed) both **88 "Needs work:
readability"** (was 84 / 84), kept 0% (0 of 186) and 6% (10 of 161), readability 3 of 10, live parts and the five longest sentences
returned, the direct-answer and template-FAQ adjustments applied, next step "Change it on your website, then press Re-check", $0 settled.
The publish check (it records the page and reports to the client, so it was run locally with the deployed node code on today's HTML):
agentic one "Images in the article" item (was six failures), naming the LinkedIn background and none of our 3 images; governed 1
content image (was 5), alt passes, 15 of 19, the Google Images thumbnail named. The client's cards show 84 until "Re-check page" is
pressed on each page (free). Nit noted, pre-existing: `_grade.js` basis text ends with a fixed scoring description that reads oddly next
to a live grade.

## Production data repairs (done, read before write, refused on any drift)

- `seo_content_log` 60 (the 10 Nov guide): published at the service page -> `not_ready`, address cleared, plain note.
- `seo_ai_targets` 36 (the Dubai question the guide was written for): `skipped` "the page is fresh" -> `written`, run 12467,
  `draft_failed`.
- Left to the deployed engine (next weekly cycle): devaicon targets 37 / 41, techand target 23 and its stuck content-log rows 61-63.

## Owner items

- techand.ai: the AI guide `/insights/dynamics-365-crm-uae` competes with the CRM ladder head `/dynamics-365-crm-uae`: client chooses
  (301 into the head page after merging its answer section, or retarget the guide to the question's own search).
- devaicon.com: ask for clean service names (one service entry is a prose sentence).
- Client note (devaicon): the two live pages are their own rewrites; the 84 (88 after this fix) grades that text; shortening the longest
  sentences, using the search phrase, citing a source and adding the 3 images we delivered brings it back; the governed page's image is a
  Google Images thumbnail they may not have the right to use. The Dubai guide of 10 Nov was never published: re-make it from AI
  visibility (it now targets the question's own search) or finish the old draft.
- Not added: the devaicon questions to `harness/accuracy/keywords.json` (re-baselines KWACC: owner call).

## Second report of 2026-11-16 (devaicon.com): "I have written this page but it still says not written; published, but the pipeline shows not published"

Checked on production first (read-only snapshot 2026-11-16 13:31 UTC, private: `~/seo-agent-secrets/client-reports-2026-11-16b/`).
The page is "custom ai solutions uae": approved by the client for the 13 Nov cycle (11 Nov 11:53), not written by that run, written by
the client with Write it now (16 Nov 09:20, run 14845), final version 10:21, marked published 11:40 (`seo_content_log` 67, live at
/insights/custom-ai-solutions-uae). The Pipeline's Coming up still showed the finished 13 Nov plan, and that plan judged the approval by
the run's own pages only: **"Approved by you · Not written · Not written in that run."**; the two pages the run did write (both live
since 13 Nov) read only "Written on ...", never published. Reproduced with the real `comingUpView` on the snapshot. The AI visibility
page was already right (its state follows the content log: "Published").

**Verdict: right, ours, three causes.**
1. App: a finished plan never followed its pages. Now (`comingUp.ts` `planPages` / `followResult` / `laterPage` / `planPageLog`) an approval
   the run did not write but the client had written for the same search since the plan was offered is that page (`by: 'you'`, its report,
   "Not written by that run. You had it written on ..."), and every page of the plan carries where and since when it is live (Published
   badge, "It is live at /path since ..."). On the production snapshot: the approval now reads Published with its report, the two run pages
   Published.
2. Engine (`Cadence_Plan.js`, mirror `cadence.ts`): the run had room for 2, took the first two candidates (ladder pages), then held one of
   them by the one-page-one-rewrite rule; the freed slot was lost, so the approval next in line was not written. Picks now fill greedily to
   the budget and a held candidate does not use a slot. Order unchanged (ladder pages, approvals, other automatic items: the
   `approve_outside_budget` rule). An approval held by that rule is reported as `same_page` with the address, not `budget`.
   `air_cadence_cases.json` `air_on_url_once_level3` now expects the third page that takes the freed slot (it recorded the lost slot).
3. Engine: the content_cadence callback (POST Cadence Note) dropped `approved_not_written` although Cadence Note computed it, so a finished
   plan never had the run's reason (184D's reasons never reached the app).

Independent review (no engine finding; app: 1 High, 2 Medium, 6 Low, all fixed): a page written again keeps its old address on the row, so it
is live only when published or published after its start (H1); the client's page is also found through its report when the app reopened an
older row (M2); the plan's own runs are never credited to the client, a later system run reads "written later" (M3); the run-page fallback
is bounded by the plan (L4); `same_page` is checked before `covered_by_live_page` and worded for both holds (L5); `ai_pages.this_week` is
false when the AI page is held (L6); the page read runs alongside the run read (L7); a failed draft reads "needs a fix" (L8).
Checks: harness **20028 passed, 0 failed** (CA1-CA2 `scenarios_client_1116b.js`, AIR P6 AE1/AE2 and KF on both sides); app shared 1373,
server 2199 (`comingUpFollow.test.ts` 13), web 401, typecheck, web build. No data repair needed: the plan's view is derived. Marketing changelog 4.16; tutorials backlog row (video-skills 2f2c602).
