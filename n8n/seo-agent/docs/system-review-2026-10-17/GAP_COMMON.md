# Common brief for every GAP agent (enterprise gaps, 2026-10-17) — read all of it first

You build one enterprise capability that Ascentra (multi-company SEO platform: web app in `app/`, engine = n8n workflows in
`n8n/seo-agent/`) is missing against the market leaders. Evidence of the gap: `n8n/seo-agent/docs/system-review-2026-10-17/MARKET_BENCHMARK.md`
(§2 matrix, §4 enterprise checklist, §5 gaps — your gap's row names what the leaders do, with sources). Read `CLAUDE.md` (project rules —
long; read "Working rules" fully), `app/README.md`, `app/API.md`, `app/web/CONVENTIONS.md`, `app/web/brand/BRAND.md` before designing.

## Where you work
- You are in your own **git worktree** (isolation). Work and commit ONLY there, on your worktree branch. Do not push. The orchestrator
  merges into `feature/seo-agent-v4.5` later and rebuilds in the main checkout.
- **A live re-rating is running on the main checkout and the running stacks right now.** NEVER touch: the main checkout's files, the
  running containers (`n8n-*`, `seo-platform-dev-*`: do not restart, exec writes, migrate, or import into them), the n8n instance (no
  import / activate / API writes), the dev Postgres, `n8n/.env`, `app/.env`. Read-only GETs to the running app/n8n are allowed but not
  needed. No `apply_env.py`, no deploy, no `sync_tables.py`.
- Tests: no Node on the Mac — run tools in throwaway containers from your worktree, e.g.
  `docker run --rm -v "$PWD/app":/app -w /app node:22-bookworm-slim sh -c "npm ci && npm -w shared test && npx tsc -p web/tsconfig.json"`.
  If server tests need Postgres, start your **own** throwaway Postgres container on your own docker network with a unique name (prefix
  `gap-<yourletter>-`) and remove it at the end. Schema change → `npm run db:generate` in `server/` (drizzle migration; another agent may
  also add one — name yours clearly; the orchestrator renumbers on merge if needed).
- Engine changes (only if your gap needs them): edit `v5/code` / `v5/prompts` / `build_*.py`; the worktree has no `n8n/.env`, so build
  with `python3 build_v4.py --no-env` and run the harness per `n8n/seo-agent/harness/README.md` in a throwaway `n8nio/n8n` (or node)
  container — must end `0 failed`. Columns go in `ladder_common.py`.

## Standard ("enterprise way")
- Design first: write `app/docs/<CAPABILITY>.md` (or the engine spec) — threat model / failure modes, data model, API, UI, limits, what
  is deliberately not built and why. Then build it fully: server + API docs (`app/API.md`) + UI (brand tokens only, Sora/Geist, works at
  390 px and 1440 px, light and dark, every new "ask" has a guide per `CONVENTIONS.md` "Setup guides") + tests (unit + route tests incl.
  cross-company isolation, roles, CSRF where relevant, failure paths).
- Security: secrets encrypted at rest the way mailboxes are (`MAILBOX_KEY`, AES-256-GCM) or a new key read from `app/.env`
  (document it in `app/.env.example`); never log secrets; SSRF guard on any outbound URL a customer types (reuse the existing guard
  used for delivery webhooks); rate limits; audit every admin action if an audit log exists in your branch.
- Marketing rule (CLAUDE.md "Business pages follow the product"): add the capability to `app/web/src/marketing/content/features.ts`
  (or the right existing entry), one line in `content/changelog.ts` dated 2026-10-17, and every page that lists it. Real shipped
  capability only, customer language.
- Commit per finished functionality on your branch, path-scoped `git add <paths>`; never commit `.env`, `.DS_Store`, `*.pyc`, the brand
  zip. Scan your diff for keys/tokens before each commit (repo is public). Commit messages end with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Typecheck all three workspaces clean, all existing tests still pass, plus yours.

## Reply when done
Branch name + commit hashes; what was built (files); migrations added; tests run with counts; new env settings; what you deliberately
left out; anything the owner must decide or provide (keys, IdP, vendor accounts); merge-conflict hotspots you expect (shared files you
edited: schema.ts, app.ts, features.ts, changelog.ts, router, sidebar).
