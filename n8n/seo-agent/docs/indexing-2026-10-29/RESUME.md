# Index coverage: RESUME (state saved 2026-10-29 13:47 UTC)

Read this first if you are picking the work up. Owner's ask: OWNER_BRIEF.md. Contract: DESIGN.md + FIX_CONTRACT.md.

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

## In progress at save time (fix wave 1)
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
