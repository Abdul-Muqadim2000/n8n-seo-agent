# AIR: where it stopped and how to resume (recorded 2026-11-06, owner paused ~20 min)

## Done
- Phase 1 research + survey: R1-R5 (committed 06842add, pushed).
- Phase 2 design: DESIGN.md; owner decisions in README.md (committed 686421a6, pushed).
- W0 contract commit `a89fe1f4` on `air/integration` (harness 16375 / 0; CONTRACTS.md; golden test `harness/air_graph_exec.js`).
  `air/integration` head = `bd4a493b` (W0 + merge of feature/seo-agent-v4.5). Not pushed.

## In flight at the pause: wave 1, four agents, each in its own worktree (branched from bd4a493b)
| Package | Worktree / branch | State at pause | Report when done |
|---|---|---|---|
| P3 defect fixes F-08/37/38/53/81/85 + on-mode guards | `.claude/worktrees/air-p3` / `air/p3` | uncommitted edits (41 files) | `fixes/P3.md` |
| P1 diagnosis kit ARD (panel, stages, source graph) | `.claude/worktrees/air-p1` / `air/p1` | early (3 changed files) | `fixes/P1.md` |
| P2 decision/learning kit ARL (levers, scoring, lift, memo) | `.claude/worktrees/air-p2` / `air/p2` | early (3 changed files) | `fixes/P2.md` |
| P4 shadow plumbing (setting, AI Growth side branch, replay tool) | `.claude/worktrees/air-p4` / `air/p4` | uncommitted edits (44 files) | `fixes/P4.md` |

No commits on any package branch yet. If the agents stopped, resume each by message (their transcripts are kept); if a session is
gone, start a new agent on the same worktree with its DESIGN/CONTRACTS section and tell it to continue from the uncommitted work there.

## Next steps, in order
1. Wait for P1-P4 reports; merge into `air/integration` in order P3 -> P1 -> P2 -> P4; rebuild + full harness after each merge.
2. Wave 2 worktrees from the merged head: P5 integrations (DataForSEO LLM Mentions, fan-out SERP, Bing stats, Brave; NO SerpApi),
   P6 on-mode consumers (cadence reserved slot + cadence.ts mirror, listings, Link Builder, report section, app, marketing, tutorial backlog row).
3. Independent reviews (engine, app, safety/blast radius, statistics), fix round.
4. Shadow replay on the private prod dump ($0), owner sees the shadow comparison.
5. Merge origin/main, node-diff production, backup, deploy with the owner's yes (shadow first, then `on` for both sites together).
Owner to provide: Brave Search API key.

## Update 2026-11-06 (later)
- P2 committed air/p2 (2df56926, 3543aa87; harness 16425/0). P1 committed air/p1 (dbca1ceb, 4f1dd2f6; 16443/0). P4 committed air/p4
  (51b6b214, 6ba112f7; 16411/0; shadow golden test). P1+P2 merged into air/integration (3d107026): 16494 passed, 2 failed = AL14.
- The decay "SOME FAILED" info lines (scenarios_v5.js:710 decaying_old_guide, decay_action) are pre-existing and not counted.
- P4's offline replay of the prod dump: AIR chose 0 actions (gains 0.0001-0.003 < min 0.02), devaicon core panel = 1 question, no
  control arm. Sent back: P1 fixes core panel / arms on real shapes; P2 fixes AL14 + gain scale. Both merge air/p4 for the replay tool.
- P3 still running. Then merge P3 -> P1 -> P2 -> P4 into air/integration, full harness, then wave 2.

## Update 2026-11-06 (wave 1 DONE)
- air/integration = 29af3f00 (pushed to origin): W0 + P1 + P2 + P3 + P4 merged, generated files rebuilt; full harness 16623 / 0.
- Decisions taken on the way: S0/S1 provisional with 0-3 answers when the basis is not answer rates (P1, DESIGN 2.B deviation);
  ARL min-gain replaced by an efficiency floor (P2); commercial refresh may beat the informational own page for the one weekly slot;
  F-08 marks metrics_json instead of bumping rule_version (P3); techand Bing false-S0 fixed (unread list -> null, AP13).
- Replay on the private dump: devaicon 9 actions (Bing step first, own page, 5 list placements, 2 directories, LinkedIn); techand 8-10/week.
- Wave 2 running 2026-11-06 in worktrees air-p5 (integrations) and air-p6 (on-mode consumers + app + marketing + tutorial backlog row).
  Agent ids: P5 ace4794d38b40efd1, P6 a859e0696d74e81bf. Then: merge, full harness + app checks, independent reviews, fix round.
- 2026-11-06: P5 merged (air/integration = 77c82704, harness 16656/0; Brave key needed as SEO_BRAVE_API_KEY; ~$0.64/site/month all on;
  3 response shapes need one live call). Engine reviews started on frozen snapshot `.claude/worktrees/air-review` (77c82704):
  Review A algorithm + statistics (a4cdd02a5a010c78d) -> REVIEW_A_ALGO_STATS.md; Review B safety/cost/blast radius
  (a56ca15be7129fd72) -> REVIEW_B_SAFETY.md. P6 (a859e0696d74e81bf) still building; app review after it merges.
- 2026-11-06: reviews done (uncommitted in main checkout, copied into fix worktrees): REVIEW_A_ALGO_STATS.md (1 Blocker RA-1 learning
  never runs, 8 High), REVIEW_B_SAFETY.md (1 High RB-1 F-53 fake week delta, 6 Medium). Fix round running from 77c82704:
  FX-A (acac706011f2eaaad, worktree air-fxa: kits + AI_Rank_Plan) and FX-B (afe5aaef65d737be0, worktree air-fxb: P3 files, gate,
  kill switch fail-closed, target rows, golden coverage). RB-3 belongs to P6. Then merge P6 + FX-A + FX-B, full checks, app review.
- 2026-11-06: P6 merged (air/integration = e1987a72; P6 alone: harness 17133/0, app typecheck + shared 1101 / server 1833 / web 311 +
  build). Review C (on-mode + app + marketing + leader claims, a3acefa97c25b5ef4) on snapshot air-review @ e1987a72 ->
  REVIEW_C_ONMODE_APP.md. Known leftovers: Link Builder ignores the kill switch; optional air:* recommendations + autopilot cost row not
  built; no browser pass yet. FX-A / FX-B branch from 77c82704 (no P6) -> merge after.
- 2026-11-06: e1987a72 full harness 17166/0. Review C done (14: 5 High) -> FX-C (a7be24c75448387de, worktree air-fxc from e1987a72).
  Decisions: only platform admins set On/Trial until the owner ends the trial; steps needing an address get a URL field; customers see
  the weekly note in plain language with credits (raw memo admin-only); marketing says "rolling out". Three fixers now: FX-A, FX-B, FX-C.
  Then: merge all three, full harness + app checks, browser pass, prod replay for the owner, merge origin/main, node-diff prod, deploy (owner yes).
- 2026-11-06: FX-A merged (all RA-1..18; replay unchanged action counts) and FX-C merged (all RC-1..14; harness 17282/0 on its branch,
  app shared 1124 / server 1942 / web 315 + build). air/integration = d610aa4f (not yet full-tested as a whole). Tutorial backlog row pushed.
  Open: FX-B still running (+ AIRF rule version air-1 -> air-2); FX-A follow-up: engine side of client_url verification (L07, L11-L15, L17).
  OWNER DECISION to ask: two old cadence bugs (page rewritten twice in one run, page lost on retry) are fixed only for On sites to keep
  off/trial byte-identical; fixing them for every site is a separate, tested change.

## State 2026-11-06 (end of build + fix round): air/integration = 395bafa5, pushed
- Contains W0, P1-P6, FX-A (+FX-A2 client_url verification), FX-B (+AIRF air-2), FX-C. Engine harness 17387/0 (FX-A2 run; 17381/0 at
  307cd0c1); app typecheck clean, shared 1124 / server 1942 (46 skipped) / web 315, web build OK (mount the WHOLE repo for app tests:
  parity tests read ../n8n). origin/main differs only by the PR #57 merge commit.
- Final offline replay (private replay_final/, 0 network, 0 writes outside AIR): devaicon 0 / 5 / 9 actions, techand 8 / 10 / 9.
  Mix: editorial-list placements (L08) dominate, ranking-page refresh (L06), LinkedIn (L12), directories (L09), earned mention (L11),
  registry (L10), cited-not-named fix (L07), protect (L16). No Bing step offline because the dump has no Bing site list (unknown, not
  false, by design AP13); in production devaicon gets L03. Detectable effect: ~19-22 pts for site-level, ~35-37 pts for one-question steps.
- Left: browser pass of new app screens; owner decisions (deploy yes, Brave key, one live call each for 3 response shapes, whether to fix
  the two old cadence bugs for every site); then merge origin/main, node-diff prod, backup, deploy engine (sync_tables first) -> API -> web,
  sites in shadow; 4 weekly shadow cycles; then On for both.

## DEPLOYED 2026-11-06 ~11:40 UTC (owner's yes): both sites in trial (shadow)
- Release 15c7b1a2 on feature/seo-agent-v4.5 (= air/integration). Final checks: harness 17410 / 0; app typecheck clean, shared 1125,
  server 1964 (46 skipped), web 317, web build OK.
- Before: production == origin/main node by node (32 workflows, 0 differing). Backup gs://alaventra-prod-backups/pg/2026-11-06/{app,n8n}-2026-11-06T113605Z.dump.
- Engine: deploy_engine.py --no-build --apply: sync_tables added 9 columns, 19 workflows updated, 10 unchanged, 28 published; after:
  production == build (0 differing). API: VM repo ff to 15c7b1a2, `up -d --build app`, healthy (db, n8n api + webhook). Web: PR #58 merged -> main 34a580ea (Vercel).
- Both sites: Site Admin `monitors` {ai_rank_mode: shadow} -> read back shadow; ai_visibility / prompts / engines unchanged; paid flags empty (off).
- Next: each weekly AI Growth run computes AIR in shadow at $0 (only seo_ai_rank_* tables); platform-admin trial view in the app. After 4
  cycles: comparison for the owner, then On for both (Site Admin ai_rank_mode on + ai_rank_reserve; paid flags per owner: mentions, fanout_n, brave).
- Owner: SEO_BRAVE_API_KEY into n8n/.env then deploy credentials (deploy_engine --credentials --only-credentials SEOcredBraveApi1 --create-missing).
- Rollback: Site Admin ai_rank_mode '' (off) per site, or seo_cache air:kill = 1; full rollback = previous workflows from origin/main@a8bbd555 + backup.
- 2026-11-06 later: live format checks (owner yes, DataForSEO $0.234, Bing free, Brave skipped): target_metrics with no mention = 0 (not
  null); GetQueryPageStats weekly rows merged per page. Fix f8af02e5 (harness 17412/0) deployed (only AI Rank Fetched changed; prod == build
  after); main = 8325c20d (PR #59). Raw answers private in live_calls/.
- 2026-11-06 (owner: "switch on now, rush it"): both sites set to ai_rank_mode=on, ai_rank_reserve=true, ai_rank_mentions=true,
  ai_rank_fanout_n=20 (Brave off, no key) via Site Admin from inside alaventra-app-1. A run-now operator is pulling AI Growth -> Content
  Cadence -> Link Builder forward through the Cycle Dispatcher (plan in the private RUN_NOW.md, schedule restored after, cap $6).
  Frontend: PR #58 + #59 merged, Vercel status success on main 8325c20d (no PR waiting).
- 2026-11-06 14:00-14:18 UTC, first `on` run (operator; plan + log in the private RUN_NOW.md). Mechanism: the three job rows of each
  site's CURRENT cycle re-opened (`refused`, attempts 1) so the Cycle Dispatcher retried them in order; seo_cycles never written, both
  sites' next cycle and preview unchanged. AI Growth ran for both (air-2, mode on, 0 node errors; 9 and 11 actions; one AIR target each;
  DataForSEO $0.478 in all, Claude $0). Content Cadence NOT run: both AIR targets are L06 `refresh` with an empty page_url (L06 picked by
  `hasPage()` from stage evidence while `pageOf()` found no URL), and Cadence_Plan `aiEligible()` drops a refresh without a URL silently,
  so the reserved slot can never fire for them (one site's row had been an ordinary answer target before). Link Builder ran for both: 0 AIR
  drafts, because AIR's out-gate does not apply the Link Builder's qualification (it picked lists already rejected as competitors / paid
  posts, or already drafted); also two LB false positives (a social network read as a competitor, a software list read as gambling).
  Fixes needed (owner): L06 needs a page URL (fall back to L05, or store the page), the reserved slot should list a dropped AIR target as
  refused, and AIR's placement choice should reuse the Link Builder's qualification.

## 2026-11-07: LIVE1 fixes DEPLOYED (engine + API); re-run of the week waits for an owner permission
- Fixes (branch air/live1, report `fixes/LIVE1.md`): L06 refresh only with a known page address (else L05 new page; the target row carries
  the url); AIR applies the cadence's 60 / 90-day rules before it chooses (both 11-06 refresh pages were ours, 7-9 days old, so the slot
  would still have written nothing); a target the reserved slot cannot write is listed as refused with its reason and the slot falls back
  to the next one (Cadence_Plan.js + cadence.ts); placements go through the Link Builder's stored verdicts, earlier pitches and rules
  (`OK.placementVet`), contact-form-only = manual step, platform pages never pitched; Link Builder false positives fixed (gambling words
  in a form drop-down; a social network as a competitor; new labelled set harness/accuracy/prospects.json 100% / 100%).
- Release 3e91831b on feature/seo-agent-v4.5 (air/live1 ff + merge of origin/main 8325c20d, tree-equal). Checks in the main checkout:
  build exit 0 with no drift, harness **17434 / 0**, app typecheck clean, shared 1125 / server 1974 (46 skipped) / web 317.
- Before: production == origin/main node by node (32 workflows, 0 differing); backup gs://alaventra-prod-backups/pg/2026-11-07/{app,n8n}-2026-11-07T175032Z.dump.
- Engine: deploy_engine.py --no-build --apply (guard ok, columns already there, 12 updated, 17 unchanged, 28 published, dispatcher mode
  start); after: production == build (32, 0 differing). API: VM repo ff to 3e91831b, `up -d --build app`, healthy, api 200 (only the
  cadence.ts mirror changed: the Pipeline preview). No web change.
- Offline simulation on the production rows (fixer): techand's reserved slot writes an AIR refresh of /dynamics-365-cloud-migration-uae,
  devaicon's writes a new AIR answer page; placements: techand 17 of 25 list sources pass the vetting, devaicon 33 of 61.
- NOT DONE: the re-run of this week (AI Growth -> Content Cadence -> Link Builder via the RUN_NOW.md mechanism). Re-opening the job rows
  (seo_cycle_jobs PATCH, helper scratchpad cyc.py) was refused by the auto-mode permission classifier on 2026-11-07. Before state saved
  privately in run2/before.json (cycles unchanged: techand next 11-12 01:00Z, devaicon 11-13 01:00Z). Without the re-run the fixed code
  first runs on the normal schedule: techand Thu 2026-11-12, devaicon Fri 2026-11-13 (06:00 Asia/Karachi).
- Left by hand: the old linkedin.com not_fit row (devaicon) in seo_link_outreach (AIR never pitches platform pages anyway).

## 2026-11-12: Brave Search ON for both sites
- Owner gave SEO_BRAVE_API_KEY (free tier: $5 credit a month; AIR caps Brave at 10 searches per site a week, ~90 a month for both
  sites, ~$0.45, inside the credit). Key only in n8n/.env and the n8n credential SEOcredBraveApi1 (never in the repo). Tested from the VM:
  200, 5 results (the office router's DNS does not resolve api.search.brave.com; the VM does).
- Build from a clean worktree at 7cab7bf2 (another session had uncommitted KI edits in the shared checkout): only BRAVE_ON false -> true
  in 7 AI Growth nodes; harness 18880 / 0 (mount app/ at /app: the KI scenarios read app/shared/src/cost.ts). Before: prod == 7cab7bf2
  (33 / 0); backup pg/2026-11-12/*T085834Z; deploy_engine --no-build --apply --credentials --only-credentials SEOcredBraveApi1
  --create-missing (guard ok, 29 published, 1 credential written); after: prod == build (33 / 0). Site Admin monitors ai_rank_brave=true
  for techand.ai and devaicon.com (200 each; read back: mode on, reserve, mentions, fan-out 20, brave true; other fields unchanged).
- First Brave reads: the next AI Growth runs (devaicon Fri 2026-11-13, techand Thu 2026-11-19). Claude's "can it find your page" stage
  moves from unknown to a reading; Brave rank is a hint for Claude, not proof (a second provider was reported in 2026).

## 2026-11-12: first weekly run with the fixes (techand) and the page time limit
- techand's cycle (01:00 UTC) ran every job. AIR worked as designed: the reserved slot took the AIR target "Can an ERP with project
  management features handle..." (answer, page /dynamics-365-project-operations-uae) and started "erp project management uae" next to two
  ordinary pages. All three page runs (13063-13065) were cancelled at the 1-hour limit at 90-100% done (214-246 of ~235-241 node runs):
  on the 4 GB VM one page takes 17-21 min alone, two at once 18 / 33 min (11-10), three at once > 60 min. The extra AIR slot made three.
- Fix AIR-PAGETIME (9b17890a): the main workflow's executionTimeout 3600 -> 7200 (= EXECUTIONS_TIMEOUT_MAX; n8n strips a timeout equal to
  the server default, which is why production showed none); Cadence_Plan in_flight_hours (2) stays >= the limit. Harness 19143 / 0 (one
  timing check, AD10 204 ms vs 200 ms, failed once under load and passed on the rerun at 107 ms). Merged with the KI judge deploy
  (47562ddb) as c4945235; before: prod == merged build (33 / 0); backup pg/2026-11-12/*T132930Z; deploy guard ok, 29 published; after:
  main executionTimeout 7200 on prod, prod == build (33 / 0).
- Not re-run: techand's three pages (they come back next Thursday 11-19, or now with the owner's OK for the job re-open). devaicon's cycle
  runs Fri 2026-11-13 01:00 UTC with the 2 h limit and Brave on.
- Levers if pages are still slow: start a site's pages one after another (the cadence fires them at once with waitForSubWorkflow false;
  waiting changes what AI Target Marks reads, B9-6), saveExecutionProgress off for page runs (each node rewrites the whole run to Postgres,
  ~15 s a node at the end of a page with three running), or a larger VM.
