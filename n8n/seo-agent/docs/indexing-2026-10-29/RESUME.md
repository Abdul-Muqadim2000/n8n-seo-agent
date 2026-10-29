# Index coverage: RESUME (state saved 2026-10-29 13:47 UTC, updated 2026-10-29 evening)

Read this first if you are picking the work up. Owner's ask: OWNER_BRIEF.md. Contract: DESIGN.md + FIX_CONTRACT.md.

## ENGINE DEPLOYED 2026-10-29 23:10 UTC (owner said "deploy")
- Backup first: gs://alaventra-prod-backups/pg/2026-10-29/{app,n8n}-2026-10-29T230455Z.dump.
- `deploy_engine.py --no-build --apply --create-missing` from feature/indexing e222cfb0: sync_tables added seo_monitors.index_watch /
  index_daily_cap; 16 workflows updated (verified before: only the documented nodes + the alert-webhook placeholder line differ), 
  SEOagentIndexCv1 imported (createdAt 2026-10-29T23:10:55.505Z, 183 nodes, active, daily 05:15 America/New_York = 09:15 UTC), 28 published.
  Dispatcher mode start, 2 sites (devaicon.com, techand.ai).
- The pinned 20-check Manual Run was NOT possible (it needs the n8n editor UI / owner login): the first run is the scheduled one on
  2026-10-30 09:15 UTC (14:15 PKT), ~115 known pages over 2 sites.
- NOT yet deployed: the API on the VM and the web (PR to main). Plan: after the first run's rows are checked (seo_index_runs,
  seo_index_pages, the $0 ledger row, the watch execution ~50 min later), deploy the API (detached checkout of feature/indexing,
  `up -d --build app`, no migration) then the web via PR feature/indexing -> main. Then merge into feature/seo-agent-v4.5.
- Rollback of the engine part: deactivate SEOagentIndexCv1 through the API (POST /api/v1/workflows/SEOagentIndexCv1/deactivate).

## REMAINING CHECKLIST (owner asked for a reminder after one day, set 2026-10-30)
Index coverage is built, reviewed, fixed and tested. Before clients see it:
1. Browser check of the final Indexing page (fix waves 2 and 3 changed it; last browser pass was after wave 1): 375 / 1440, light / dark,
   mocked states (fix seen, Google still sees it, ask Google, partial sitemap, could not check, update rolling out). ~30 min.
2. Deploy (owner approval): backup, engine from feature/indexing (`deploy_engine.py --apply --create-missing`), pinned manual run
   `{"domain":"techand.ai","cap":20}`, watch execution 50 min later, API on the VM, web via PR to main. Not on a Monday.
3. Production-only checks: self-start per website, Wait nodes, file answers of the HTTP nodes; the first 05:15 run.
4. After deploy: missed-run schedule entry; merge feature/indexing into feature/seo-agent-v4.5 (coordinate with the page-quality session).
   Dry-run merge 2026-10-30: 3 conflicts (app/web/src/marketing/content/changelog.ts, features.ts, n8n/seo-agent/harness/scenarios_v5.js),
   the rest auto-merges; rebuild the generated workflows after the merge (never hand-resolve generated JSON), rerun harness + app suites.
   Merge into main: no conflicts (but main = Vercel auto-deploy: only after the API is on the VM).
DO NOT merge into main or feature/seo-agent-v4.5 before step 2: main auto-deploys the web to clients, and v4.5 is what the other session deploys.
Next feature after deploy (owner approved): opt-in full Search Console access for sitemap submission (~1 day). WordPress auto-fixes: paused.

## TUTORIALS: STOPPED by the owner 2026-10-30 (batched after the app revamp; see ~/Downloads/hiresuite-video-skills/alaventra/TUTORIALS_BACKLOG.md). The block below is history.

## SAVED 2026-10-30 (usage limit): tutorial in progress
- Feature code: complete, all on `feature/indexing` @ 69f35d37 (pushed). Nothing deployed.
- Tutorial (A17) agent was mid-way: demo checkout /Users/abdul.muqadim/n8n_devaicon-demo was moved to feature/indexing 69f35d37 (it was
  on tutorials-sync before; check `git -C /Users/abdul.muqadim/n8n_devaicon-demo log` / reflog to restore its demo-only changes if needed);
  uncommitted edits in ~/Downloads/hiresuite-video-skills: `alaventra/alaventra-video/7-9-choose-what-is-checked-every-week_T/` (scenes.js,
  screens.json): re-capturing 7.9 because the Tracking & monitors settings gained the Indexing card. The new Indexing tutorial is not
  made yet. To resume: read the tutorial brief in this file's "Next steps" 3 + the memory notes alaventra-tutorial-videos /
  tutorial-refilm-2026-10-28, look at `git status` in both repos, continue (do not restart finished films), then commit + push the
  video-skills repo and the website tutorials page on feature/indexing.
- After the tutorial: ask the owner to deploy (sequence in CURRENT STATE above).

## CURRENT STATE (2026-10-30) — read this block first
- Fix waves 1-3 merged (wave 3: engine 72ef110e..98f462fc, app 0409a89b..95e32f0d; merges 59676b17, ab25cf1b). REVIEW_3's blockers R1/R2
  fixed with failing-then-passing checks. Docker checks on the merge: harness **13891 / 0**; typecheck clean; shared 952, server 1552
  (+46 skipped), web 275, web build OK. CLAUDE.md status + RUNBOOK updated (c17715fb). Everything pushed on `feature/indexing`.
- Tutorial (A17) being made by an agent at save time: demo checkout /Users/abdul.muqadim/n8n_devaicon-demo, video-skills repo
  ~/Downloads/hiresuite-video-skills; it commits the website tutorials page on feature/indexing. If it stopped: check both repos' git log.
- Then: ask the owner to deploy. Sequence (REVIEW_CROSS §deploy, adjusted): backup (`deploy/gcp/backup.sh`); not on a Monday, ≥ 2 h before
  05:15 New York; `deploy/gcp/tunnel.sh`; from a checkout of `feature/indexing`: `python3 deploy/gcp/deploy_engine.py` (dry run: expect the
  new SEOagentIndexCv1, Site Admin, main v4 Monitor Row (Track), the catch-up, 10 schema-only workflows, 2 new seo_monitors columns), then
  `--apply --create-missing`; pin `{"domain":"techand.ai","cap":20}` on Manual Run once, check seo_index_runs / seo_index_pages, the $0
  ledger row and the watch execution 50 min later; API on the VM from feature/indexing (detached checkout, `up -d --build app`, no
  migration); web via PR feature/indexing -> main (Vercel). Next day watch the 05:15 run. Then merge feature/indexing into
  feature/seo-agent-v4.5 (coordinate with the page-quality session) so later deploys keep it.
- Rollback: deactivate SEOagentIndexCv1 (API) or index_watch=false per site; delete `site_tasks` rows of kind `indexing` BEFORE reverting
  the API image (the old app checks unknown kinds as redirects); revert the PR for the web.

## Where everything is
- Integration branch **`feature/indexing`** (worktree `/Users/abdul.muqadim/n8n_devaicon-indexing`, pushed to GitHub). Head 3abcbcd3 at save time.
- Build worktrees (branches `ix/engine`, `ix/app`, `ix/mkt`): `/Users/abdul.muqadim/n8n_devaicon-ix-engine`, `…-ix-app`, `…-ix-mkt`.
  `n8n/.env` in each is a symlink to `/Users/abdul.muqadim/n8n_devaicon/n8n/.env`.
- Do NOT work in `/Users/abdul.muqadim/n8n_devaicon` (another session merges the page-quality waves into `feature/seo-agent-v4.5` there).
- Nothing deployed. Production untouched (only read-only counts were read at the start).

## Done
1. Survey (SURVEY_ENGINE.md, SURVEY_APP.md), research (RESEARCH.md), design (DESIGN.md). Commit eb98ba93.
2. Build: engine (ix/engine f1fd90ea + 8d3a26ab), app (ix/app 1562fa56), marketing (ix/mkt b861f850); merged into feature/indexing,
   guide count fix 044eeb1e, harness W2FIX-3 update. Checks on the merge: engine harness **13255 passed, 0 failed**; app typecheck clean,
   shared 882, server 1521 (+46 skipped), web 264.
3. Reviews: REVIEW_ENGINE.md (E1-E16), REVIEW_APP.md (A1-A27), REVIEW_CROSS.md (X1-X20 + deploy sequence + rollback). FIX_CONTRACT.md
   (decisions + new columns `fix_seen_at`, `ask_google`). Commit 3abcbcd3.

## Fix wave 1: DONE (2026-10-29 evening)
Engine ix/engine b7f1c201 + ad460974, app ix/app 85b24db5 + 763f8e0e + ff6bc5f0, merged into feature/indexing (c59c8a07, 03ac9fa2), pushed.
Checks on the merge: harness **13788 passed, 0 failed**; typecheck clean; shared 921, server 1539 (+46 skipped), web 269, web build OK.
Per-finding status: ENGINE_BUILD.md and APP_BUILD.md, "Fix wave 1" sections.

## Fix wave 2: DONE (2026-10-30 night)
REVIEW_2.md (30 fixed / 9 partly / 3 regressed + new N1-N13, N-app-1..12). Engine ix/engine 267fae9b..7c34ecce, app ix/app
1c2e998b..e4fa46fa, merged 18746ebc + 64caa7a4, pushed. Checks in Docker: harness **13844 passed, 0 failed**; typecheck clean; shared 938,
server 1549 (+46 skipped), web 274, web build OK. New engine columns fix_failed_at, ask_google_at; callback summary failed/checked/note/figures_from.
Third review (REVIEW_3.md) running at save time: verify wave 2, hunt regressions. Next after it: fix what it confirms, then tutorial + docs, then ask the owner to deploy.

## (old) In progress at the first save (fix wave 1)
- Engine fixer working in `…-ix-engine` on ix/engine (E1-E16, X1-X4, X7, X8, X13, X16). Will append "Fix wave 1" to ENGINE_BUILD.md and commit there.
- App fixer working in `…-ix-app` on ix/app (A1-A27 except A17, X5, X6, X10, X14-X17). Will append "Fix wave 1" to APP_BUILD.md and commit there.
- If a session ended mid-way: check `git -C <worktree> log --oneline feature/indexing..HEAD` and `git status` in each worktree. Uncommitted
  work in a worktree is kept on disk; finish it from the review docs (each finding has file:line + fix), do not start over.

## Next steps
1. When both fixers are done (their "Fix wave 1" sections exist and are committed): merge ix/engine then ix/app into feature/indexing
   (in `…-indexing`), rebuild (`cd n8n/seo-agent && set -o pipefail && python3 build_v4.py`, exit 0, `git status` clean or commit the
   generated files), run the full harness in a copy:
   `S=$(mktemp -d); cp -R n8n/seo-agent/. $S/; rm -rf $S/harness/out; docker run --rm -v $S:/s -w /s/harness -e CODE_DIR=/s/harness/code_v4 -e OUT_DIR=/s/harness/out --entrypoint node n8nio/n8n:2.41.4 scenarios_v5.js | tail -1` -> 0 failed;
   app: `docker run --rm -v "$PWD":/repo -w /repo/app node:22-bookworm-slim sh -c "npm ci --silent >/dev/null 2>&1; npx tsc -p shared/tsconfig.json --noEmit && npx tsc -p server/tsconfig.json --noEmit && npx tsc -p web/tsconfig.json --noEmit; npm test -w shared; npm test -w server; npx vitest run --root web; npm run build -w web"`.
   Commit + secret scan + `git push origin feature/indexing`.
2. Second, shorter review (one agent, engine + app): verify each finding's fix against the code and the new tests; report anything still
   wrong. Fix what it confirms.
3. Tutorial (CLAUDE.md rule, A17/X18): new tutorial for the Indexing page + re-capture tutorials showing the changed sidebar / Tracking &
   monitors settings, in `~/Downloads/hiresuite-video-skills` (skill `alaventra/alaventra-sandbox-video/`), website tutorials page; commit
   + push that repo. See memory alaventra-tutorial-videos / tutorial-refilm-2026-10-28.
4. CLAUDE.md status section + RUNBOOK §8 ("two daily crons" -> three), memory update.
5. Ask the owner before deploying. Deploy sequence and rollback: REVIEW_CROSS.md (deploy from `feature/indexing`, not
   `feature/seo-agent-v4.5`; not on a Monday; engine first with `deploy_engine.py --apply --create-missing`, pinned small manual run
   `{"domain":"techand.ai","cap":20}`, then API on the VM, then web via PR to main).

## Owner decisions still open
- Sitemap submission (needs read-write Search Console scope on the shared credential; guide promises read-only). Default: not built.
- Versioned policy checklist with AI-drafted changes. Default: the watcher only alerts on a spam-policies page change.

## OWNER DECISIONS 2026-10-30: the next builds after Index coverage is deployed
1. **Safe auto-fixes on client pages** (PAUSED by the owner 2026-10-30: do NOT build now; kept here as a note for later; estimate 3-5 days): WordPress first; remove a wrong noindex, fix canonicals, add redirects; backup before every
   change, one-click undo, the client approves each change (approval default). Needs new CMS-connector work (today it only creates /
   updates articles by slug). Steps on your website stay the fallback for sites without a connection.
2. **Search Console access level per website, chosen by the client** (YES, opt-in): an option to give the application FULL access to
   Search Console so it does what Google allows an app to do itself, today: submit / resubmit the sitemap when none is submitted, it has
   errors, or it changed (never an unchanged resubmit loop). Without full access the client gets the step with the guide (as now).
   Needs: a separate credential / scope `https://www.googleapis.com/auth/webmasters` used only for this, the client granting Full user
   to the service account (verify on a real account whether Full user or Owner is required: RESEARCH §A), the setup guide's "nothing is
   ever changed" promise rewritten for the opt-in, marketing + tutorial updates.
   Honest limit told to the owner: even with full access there is NO API for "Request indexing" and nothing can force indexing; the
   Indexing API is for job postings / livestreams only and is never used. "Ask Google to read it" stays a guided client step.
3. Automatic content rewrites: NO (scaled content abuse risk); "Improve this page" stays approval-only.
4. AI-drafted versioned policy checklist: not chosen now (later, small).
