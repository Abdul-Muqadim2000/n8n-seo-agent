# KI: paused 2026-11-08 (owner's usage limit). How to resume with nothing lost

## What is live and what is not
- **Live in production:** only the SERP-GOTO hotfix (engine 13 workflows + API at 7e0e3342, deployed 2026-11-07 ~22:20 UTC; backup
  gs://alaventra-prod-backups/pg/2026-11-07/*T221308Z; prod == build node by node after). Web part = PR #61 (owner merges).
- **KI: nothing deployed.** Branch `ki/integration` (worktree `.claude/worktrees/ki-w0`, head 407440c0, NOT pushed): W0 + E1 + E2 +
  A1 + A2 + the final hotfix; harness 18197 / 0 before the last merge, app 1144 / 2021 / 341.

## The four reviews (all done, in this folder)
REVIEW_LOGIC (2 Blocker, 9 High: services truncated + fragments, topic similarity from the seed's own words, Strength constant, provider
pages read as lists, AVOID not loaded, competitor brand searches pass, unknown position = not in top 100, GSC page-5 impressions override
volume, word-share fit gates "peppol access point provider uae", stale rows never superseded), REVIEW_PERF_SAFETY (Trial charged to the
client; homepage / sitemap GET without SSRF / size / redirect guard; no KI concurrency cap; cache key churn; ki:* rows not pruned),
REVIEW_CONSISTENCY (Trial visible in 5 paths; Off sites see KI stages in two filters; three striking definitions; raw gate detail
shown; "AI judgement" label + Claude cost with no model; marketing overpromises), REVIEW_UX (factor tooltip reads the wrong shape;
Gap filter only on the current page; refused run invisible; nothing actionable; pages 12-17k px long on phones).

## Fix rounds, paused mid-work (WIP commits, NOT built or tested as a whole)
| Branch / worktree | Commits | State |
|---|---|---|
| `ki/fxl` / `.claude/worktrees/ki-fxl` (engine) | f4872f92 shared contract (verdict `unknown`, "Hard for your website now", gate reason codes + `gate_detail`, current-row rule, striking definition, basis words, no Claude cost); f212ff53 WIP (101 files) | was fixing REVIEW_LOGIC in the reviewer's order against the offline replay; last action: moving an inline `//` comment that broke a one-line edit |
| `ki/fxa` / `.claude/worktrees/ki-fxa` (app) | dc911eee WIP (26 files: Trial privacy + no charge across runs / billing / delivery / webhooks / exports / share links / API v1, KI routes, KeywordsPage, tools pages, new test `kiTrial.test.ts`) | was in step 1-3 of its brief; last action: replacing a host comparison line |

Private (not in the repo, reads production data): the offline replay tool and its BEFORE baseline in
`~/seo-agent-secrets/keyword-intel-2026-11-08/fxl_replay/` (`replay.js`, `run_ki.js`, `probe.js`, `out/`, `base/` = repo copy it ran on);
the prod dump in `~/seo-agent-secrets/keyword-intel-2026-11-08/data/`; the node-diff scripts `nodediff.py` / `nodediff2.py` (WFDIR=<dir>
to compare production with another build) in the same folder.

## Resume, in order
1. Resume each fixer with its brief (the agent transcripts are kept: SendMessage to the FX-L / FX-A agents of this session, or start a
   new agent on the same worktree with: "continue the fix round from the WIP commit; read fixes/RESUME_FIX_ROUND.md, the four REVIEW_*.md
   and your brief section below; run the build + full harness / app checks once at the end").
   - FX-L brief: fix REVIEW_LOGIC (B1, B2, H1-H9, then Medium/Low), the engine items of REVIEW_PERF_SAFETY and REVIEW_CONSISTENCY;
     acceptance = the private replay on real stored rows (devaicon Open edX passes + real rivals; techand Dynamics partners, Peppol / AX /
     cloud-migration above "what is a crm company", "erp software uae" passes, "crm for customers" gated, competitor brand searches gated,
     no list action for rival company pages, no keyword both missing and strong, verdict mix not all Hard); add messy-input public cases;
     write fixes/FXL.md (before/after).
   - FX-A brief: Trial = 0 credits + admin-only everywhere (one shared check), Off sites see nothing new, UX Highs H1-H5 (factors shape,
     server-side filters, refused/failed notes, every Start links to an existing tool prefilled, short pages on phones), Mediums, the
     consistency items, stale rows ignored via the FX-L current-row rule; merge ki/fxl for the shared constants; re-run the browser pass
     (REVIEW_UX_shots/scripts) and write fixes/FXA.md.
2. Merge ki/fxl then ki/fxa into ki/integration; build (exit 0, no drift), full harness (copy `n8n/seo-agent` WITHOUT docs + `app/shared`;
   `docker run --rm -u root -v <dir>:/r -w /r/n8n/seo-agent/harness -e CODE_DIR=/r/n8n/seo-agent/harness/code_v4 -e OUT_DIR=/r/out
   --entrypoint node n8nio/n8n:2.41.4 scenarios_v5.js`), app checks (node:22-bookworm-slim, whole worktree mounted, deps volume).
3. Re-review (logic on the replay, UX browser pass), then fixes/OPEN.md items O1-O5 (W2 consumers, monthly refresh) or deploy Off first.
4. Deploy (all sites Off): merge origin/main, node-diff production (`nodediff2.py`), backup, `sync_tables.py` runs inside
   `deploy_engine.py --apply --create-missing` (new workflow SEOagentKIntel1), API on the VM, web PR. Trial runs for both sites
   (~$1.30 each) only with the owner's yes; On only with the owner's yes.

## Owner decisions still open
PR #61 merge; the SERP-GOTO data repair + telling techand (fixes/SERP_GOTO.md section 7); K1-K8 in DESIGN.md section 9 (defaults
chosen); verdict words app-wide (K5).
