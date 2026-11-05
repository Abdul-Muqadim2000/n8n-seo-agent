# AI ranking R&D: getting clients named and cited by AI assistants (started 2026-11-05)

Owner's ask (2026-11-05): we have done a lot of AI-visibility work on two production clients (techand.ai, devaicon.com), but there is
no good outcome. Do a full R&D on the internet (best algorithms, third-party integrations we need), survey our system and its results,
then build and review the best enterprise-grade AI-ranking algorithm. Multiple agents for research, survey, implementation and review.

The 2026-10-23 upgrade made measurement strong (`../ai-visibility-2026-10-23/`). This programme is about the levers that MOVE the
result, and proving the lift.

## Phases
| Phase | Agents / output | State |
|---|---|---|
| 1. Research + survey (parallel) | R1 `R1_EVIDENCE.md` (what causes inclusion, effect sizes, lift methods); R2 `R2_LEADERS_ACTIONS.md` (what leaders do to move outcomes); R3 `R3_INTEGRATIONS.md` (third-party APIs, cost, MUST/SHOULD); R4 `R4_PROD_OUTCOMES_SUMMARY.md` (+ private full report in `~/seo-agent-secrets/ai-ranking-2026-11-05/`; why no outcome on the two clients); R5 `R5_SYSTEM_SURVEY.md` (the act loop in code, gaps) | DONE 2026-11-06 |
| 2. Design | `DESIGN.md`: the algorithm (per-question diagnosis, lever choice, execution, verification, learning), contracts per work package, evaluation plan | DONE 2026-11-06, awaiting owner decisions |
| 3. Implement (waves, worktrees) | `fixes/*.md` per package | |
| 4. Review (independent) | `REVIEW_*.md` | |
| 5. Fix round, full checks, deploy with the owner | `RESUME.md` | |

**Owner rules (2026-11-05, second message):**
1. **Nothing else may break: production has live users.** Every package is additive and behind a per-site setting (default off until verified). Existing tables get new columns only (no renames or drops, via `ladder_common.py` + `sync_tables.py`). Existing callbacks, report stages and API fields keep their shape. Before merging, run the full harness and the app suites, and node-diff the engine against production. Shadow mode first: the new algorithm computes and logs its choices next to the current logic before it drives anything. Each site is switched on separately and can be rolled back with one setting. Deploy outside the cycle windows, with a backup.
2. **Better than the industry leaders, not equal to them.** The design carries a matrix of us against each leader (R2) per capability and states where we will lead, with the evidence. "Equal" is not a goal.

Rules: client data stays in the private folder (repo is public); no paid calls without the owner's yes; engine deploys follow the
merge-main + node-diff rule; tutorials go to the backlog (owner rule 2026-10-30); marketing pages follow shipped capabilities only.
