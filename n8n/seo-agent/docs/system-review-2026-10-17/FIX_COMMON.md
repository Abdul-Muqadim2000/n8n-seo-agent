# Common brief for every DEFECT-FIX agent (re-rating 2026-10-17) — read all of it first

You fix defects that the live re-rating of 2026-10-17 found in the SEO Agent engine (n8n workflows built from `n8n/seo-agent/`).
The evidence is in the main checkout (read-only for you): `/Users/abdul.muqadim/n8n_devaicon/n8n/seo-agent/docs/system-review-2026-10-17/parts/<n>_*.md`
and its git-ignored `files/` (execution JSON `exec-<id>.json`, node outputs, delivered report text). Read your findings there in full,
with their evidence, BEFORE touching code. Previous fix waves and their lessons: `docs/system-review-2026-10-15/DEFECTS.md`,
`LIVE_CHECK_fixes.md`, `docs/system-review-2026-10-11/FIX_PLAN.md` §3.16/§3.17, and `INVARIANTS.md` (rules 1–4 and their lints).

## Where you work
- Your own **git worktree** (isolation). Commit only there, on your branch; do not push. The orchestrator merges, rebuilds in the main
  checkout with `n8n/.env`, runs the harness and deploys after the live runs finish.
- NEVER touch the main checkout's files, the running containers (`n8n-*`, `seo-platform-dev-*`), the n8n instance (no import, no API
  writes, no activate), the Data Tables, `n8n/.env`. No `apply_env.py`, `sync_tables.py`, `fix_*.py --apply`. A re-rating executor is
  still running live runs against the instance.
- Read CLAUDE.md "Working rules" in full (n8n sandbox has no `URL`; Data Table nodes auto-map; AI Agent outputs only `{output}`; inline
  `//` comments; HTTP text responses under `data`; host-agnostic URL comparison; etc.).
- Build: `cd n8n/seo-agent && python3 build_v4.py --no-env; echo exit=$?` (the worktree has no `.env`; the build must exit 0 — patches
  assert on exact text). Harness: per `harness/README.md`, in a throwaway container (e.g. copy `harness/` + built code into a fresh
  `node:22-bookworm-slim` or `n8nio/n8n` container you create with a unique name `fix-<letter>-…`, run `scenarios_v5.js`, remove it).
  It must end `0 failed`; report the exact passed count. Do not use the running `n8n-n8n-1` container.

## Standard
- **Root cause, not symptom.** For each finding: reproduce it offline from the saved execution's real node inputs (the harness can replay
  a node on given input), find the cause at file:line, fix it at the source, and check every other path that computes the same thing
  (the lesson of earlier waves: a fix that lands on one of N paths fails the next rating). Add a harness scenario per finding built from
  the real data of this run, which fails before your fix and passes after.
- Prefer honesty over cleverness: when evidence is insufficient, say "not checked" / "could not be read" with the reason — never invent,
  never score from an unmeasured side.
- Keep the four INVARIANTS lints passing (they run in the build).
- Commit per finding family, path-scoped (`git add <paths>`; include the regenerated `workflows/*.json` and `harness/code_v4/` only if
  the build regenerates them in your worktree — say so), messages ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Scan the diff for secrets first (public repo).

## Reply when done
Branch + commits; per finding: root cause (file:line), fix, the scenario that proves it, and the live acceptance check the orchestrator
should run after deploy (which run, which node, what value); build exit code; harness passed/failed counts; anything left open and why.
