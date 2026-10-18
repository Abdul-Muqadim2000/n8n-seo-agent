## What and why

<!-- One functionality per pull request. What changes for a customer, and why. -->

## Checks

- [ ] CI is green (app typecheck / unit tests / build, real-Postgres suites, engine build + lints + harness `0 failed`, both images build)
- [ ] Engine change: edited in `n8n/seo-agent/v5/` or the build scripts, rebuilt with `python3 build_v4.py` (exit code checked), generated files committed
- [ ] New Data Table column: added to `ladder_common.py` (reaches existing tables through `sync_tables.py`)
- [ ] App schema change: migration generated (`npm run db:generate`); form fields / modes changed → `npm run export:payloads` committed
- [ ] Customer-facing change: marketing site updated (`content/features.ts`, `content/changelog.ts`, every page that lists it)
- [ ] No key, token, private key, webhook URL or `.env` in the diff (this repository is public)
- [ ] Live check needed after deploy? Say which, and its cost

## Deploy notes

<!-- New settings (Vercel / API / engine), owner steps, anything that must happen in order. "None" is an answer. -->
