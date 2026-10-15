# Where this stands, and the prompt for the next session

**Written 2026-10-15, for a session picking this up cold.** Read `/CLAUDE.md` first — its top Status section is the state of play.

## The honest headline

The **benchmark programme is 2 of 13 areas done.** Areas 12 (Reporting & app) and 13 (Cost control & reliability) were taken first
deliberately: `../system-review-2026-10-13/PATH_TO_8.md` §1 proves reporting **must** reach 8 or an overall 8 is arithmetically
impossible. Their findings became the B items in `../system-review-2026-10-11/FIX_PLAN.md` §3.14, and on 2026-10-15 seven of them were
closed. The nine problems that closing them *uncovered* are §3.15.

**Eleven areas have not been benchmarked at all:** technical audit (5), ladders (2), cadence (4), content (3) — those four first, because
the 2026-10-14 live run exposed them most — then keywords (1), rank tracking (6), site tracking (7), AI visibility (8), AI growth (9),
backlinks (10), link building (11).

## Scores, and why engineering alone cannot finish this

| | |
|---|---|
| 2026-10-11 baseline | **5/10** (area mean 4.8) |
| 2026-10-13 first re-rating | **6/10** (area mean 5.92) |
| Ceiling with every buildable item done and **no owner action** | **7.46** against the 7.5 needed |

So **8/10 is unreachable without the owner's items**, and three areas are capped at 7.5 for 2026 whatever is built, because five criteria
score the *outcomes* of our own published pages and nothing is published yet. Do not promise 8 from code.

## The work queue, in order

1. **Deploy.** `python3 n8n/seo-agent/apply_env.py` — blocked on 2026-10-15 by the permission classifier as a production deploy, so it
   needs the owner. Everything merged that day is inert until it runs, and B-A5's three new Data Table columns need the `sync_tables.py`
   it runs. **Nothing below should start before this lands**, or the next batch is written against an engine that is not running it.
2. **Benchmark areas 5, 2, 4, 3**, then the remaining seven. Method: `BENCHMARK_PROGRAM.md` (unchanged). One area per agent, findings to
   `BENCHMARKS_2026-10-14.md`, new work registered in `FIX_PLAN.md`.
3. **The INVARIANTS lints still owed** (`INVARIANTS.md`): Rule 1 (lineage — covers the most defects), Rule 2 (gate pairs), Rule 4 (the
   state machine). Rule 3 is done as a ratchet. These are build-time checks in the style of the ordering proof: they fail the build, they
   cannot be forgotten, they cost nothing per run. **Two fixes have never come back and both are enforced by the build** — that is the
   whole argument for doing these.
4. **Still open:** B-A10 (register R18's gate chains, then gate the 48 ungated DataForSEO nodes, deleting each from
   `harness/in200_baseline.json`); B-R2 (white-label-lite + an owner-session Playwright pass — no run has ever exercised the app UI);
   B-F5 (make the build refuse to write workflows when `n8n/.env` is absent); the Sonnet half of B-F1 (still character-priced); B-B4
   (needs D25a).
5. **Then re-rate**, protocol in `FIX_PLAN.md` §5.2. Budget it against the $15 ceiling and check the DataForSEO balance first.

## Owner items — these decide whether 8 is reachable

D25a (an always-on host), G13 (a CMS), G16 (the first live send), G20 (the AI panel size), G17 (months of its own data), O1–O12.
Plus, live on 2026-10-15: **top up DataForSEO** ($13.79 left, two thirds of what a run spends), **approve the deploy**, and **rotate
everything ever pasted in chat, the service-account key first**.

## Rules that are not negotiable

- Agents **must not** deploy, run `apply_env.py`, make paid live calls, push, or edit `CLAUDE.md` / `FIX_PLAN.md`.
- **Rebuild in the main worktree after every merge.** A worktree has no `n8n/.env` and the build does not fail without it — it bakes
  defaults into ten workflows (B-F5). This is the single most dangerous thing about the agent workflow right now.
- Resolve a merge by **keeping both sides** of build sections and harness scenarios, then `node --check` before running; regenerate the
  generated files (`workflows/*.json`, `CHANGES_v3_to_v4.md`) rather than resolving them by hand.
- The harness needs `CODE_DIR` set or 129 scenarios fail misleadingly:
  `docker exec -u node -w $D -e CODE_DIR=$D/code_v4 n8n-n8n-1 node scenarios_v5.js` — it must end **"0 failed"** (4505 at 2026-10-15).
- The repo is **public**: scan every diff for keys, tokens and webhook URLs before committing.
- **Brief an agent with the goal and the evidence, not with conclusions.** On 2026-10-15 all four agents contradicted their brief on
  something load-bearing, and in two cases the correction was worth more than the fix. Tell them the code wins and that contradictions go
  at the top of their report.

## The prompt to start the next session

> Continue the SEO Agent work in `/Users/abdul.muqadim/n8n_devaicon` (branch `feature/seo-agent-v4.5`).
> Read `CLAUDE.md` first, then `n8n/seo-agent/docs/system-review-2026-10-14/NEXT_SESSION.md` — it holds the state, the queue and the
> rules. Act as orchestrator: agents do the work, in git worktrees, **at most 4 at a time** (the machine is loaded), grouped so no two
> touch the same files.
>
> Goal unchanged: raise the system from its measured 6/10 to **at least 8/10** on the same frozen rubric, with no defect left that gives
> wrong advice or wrong numbers. Be straight with me about what code cannot reach — `PATH_TO_8.md` says the ceiling without my own items
> is 7.46.
>
> Order of work: (1) ask me to approve the deploy before anything else, since nothing merged on 2026-10-15 is live; (2) benchmark areas
> 5, 2, 4 and 3 against the best tools available, per `BENCHMARK_PROGRAM.md`; (3) the Rule 1, 2 and 4 lints from `INVARIANTS.md`;
> (4) B-A10, B-R2, B-F5 and the Sonnet half of B-F1; (5) the re-rating.
>
> Budgets: spend ceilings are **$15 a day** and cost is not the constraint — the result is, benchmarked against the best available. Ask
> me before any paid live run and estimate it first; check the DataForSEO balance before you do (it was $13.79 on 2026-10-15, and it
> binds before the guard does). Never send outreach e-mail to a real address, never publish to WordPress, never print a credential.
>
> Agents must not deploy, must not run `apply_env.py`, must not push, and must not edit `CLAUDE.md` or `FIX_PLAN.md` — you keep those.
> Each agent: fix, add harness scenarios, build with `python3 build_v4.py` and check the exit code, run the harness in the container with
> `CODE_DIR` set until it ends "0 failed", typecheck and test the app if it touched `app/`, commit on its branch, report in under 200
> words with any contradiction of its brief at the top. You rebuild in the main worktree after every merge — a worktree has no
> `n8n/.env` and the build silently bakes defaults without it.
