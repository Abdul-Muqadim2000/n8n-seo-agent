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
