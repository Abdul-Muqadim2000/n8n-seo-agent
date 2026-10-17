# Resume here — re-rating 2026-10-17, its fix wave and the enterprise gap builds

Written 2026-10-17 ≈ 21:55 UTC by the orchestrator, because the usage limit was close. Branch `feature/seo-agent-v4.5` (tip `47ce789` or
later), pushed. Read this, then the newest `*_HANDOFF.md` in each open worktree below.

## 1. Done and on the branch

- **The re-rating** (this folder): `RESULTS.md` (executions 736–799 on techand.ai, $2.59 DataForSEO + $1.26 Claude), `parts/1`–`4`,
  `MARKET_BENCHMARK.md` (Search Atlas, Ahrefs, Semrush/Adobe, seoClarity, Conductor, BrightEdge, Botify, Profound, SE Ranking, Moz, Surfer
  + 5 AI-visibility entrants, sources opened 2026-10-17), `SCORECARD.md` scored by a clean CLI session (scorer package and its rules:
  session scratchpad `scorer/SCORER_RULES.md`): **6 / 10 (area mean 5.88; 2026-10-15 5.54); market position 4.2; enterprise readiness
  1.5**. FIX_PLAN §6 has the row.
- **Fixers merged, rebuilt in the main checkout, harness 6746 passed / 0 failed, app typecheck clean + 376 shared / 333 server
  (17 DB-gated skipped) / 17 web tests, web build OK:**
  F-B (audit + full report: B-1 B-2 B-3 B-4 B-5 B-6 B-7 B-17 + Lows B-11..B-15; new columns `seo_audits.crawl_js` / `checks_version` /
  `not_fixed_json`, `seo_audit_findings.check_version`), F-A3 (keyword research: A-1 A-2 A-4 A-5 A-6 A-7 A-22 A-23 A-24 A-25 A-26),
  F-A1 (ladders: A-8 A-9 A-10 A-11 A-12 A-20 A-21), F-A2 (Content QA: A-13..A-19; placeholder kit engine + `app/shared/src/placeholders.ts`),
  F-D (app: D-1 onboarding crash, D-2 D-3 D-4 D-6 D-9 D-10 D-11 D-12 D-13), G2 (CMS publishing: WordPress / Webflow / Contentful / signed
  webhook, migration 0009, `app/docs/CMS_PUBLISHING.md`).
- **7 of the 8 High findings fixed in code** (C-1 is with F-C). Lows left open by F-B: B-8 B-9 B-10 B-16 B-18.

## 2. NOT deployed — needs the owner

`apply_env.py` was refused by the permission classifier as a production deploy. The owner runs:
`cd /Users/abdul.muqadim/n8n_devaicon/n8n && python3 seo-agent/apply_env.py` (not Monday 07:00–12:00 New York). It also runs
`sync_tables.py` (F-B's four new columns). The app's migration 0009 runs at the dev server's next start.

## 3. Open agents — all checkpointed, parked on their branches (worktrees under `.claude/worktrees/agent-<id>/`)

State at 2026-10-17 ≈ 22:40 UTC. **Every defect fixer is merged** (F-C last, `47ce789`: all 8 High fixed in code, harness 6861 / 0,
app 377 shared / 334 server / 17 web). The gap builders are parked, each with a handoff note on its branch:

| Agent | Branch | Built and tested | Left (see its handoff note) |
|---|---|---|---|
| G1 identity | `worktree-agent-acb3f285de8c3a4bc` (merged 2aa912a in) | two-step (TOTP, passkeys, recovery codes, step-up, company policy), audit log (DB refuses edits, retention, CSV), sessions + idle timeout, SSO (OIDC + SAML 2.0 on DNS-proven domains, enforce, break-glass); 53 server + 15 shared tests on PGlite | **SCIM 2.0** (started: types, token, filter parser), marketing (`/security`, features, changelog, pricing), browser pass; owner: `IDENTITY_KEY`, a real IdP, which plans include SSO/SCIM/audit log. Note: `app/docs/G1_HANDOFF.md`, design `app/docs/IDENTITY.md` |
| G3 crawler logs | `worktree-agent-aaf7d59acd32d0ae8` (merged 2aa912a in) | upload + push ingest (Logpush / drains), parsers, IP-range + rDNS verification, rollups, Crawlers page, `/api/v1` + MCP tool, 12 DB tests, 1M lines in 16 s | marketing entry, browser pass. Note: `app/docs/G3_HANDOFF.md`, design `app/docs/LOG_ANALYTICS.md` |
| G4 integrations | `worktree-agent-a05552be562d6b396` (merged 2aa912a in) | server side of all 5: runs API + MCP run tools, signed webhooks + Slack/Teams, Jira/Linear/Asana, S3/BigQuery export + table read API; 61 + 15 tests; shared SSRF guard moved to `server/src/lib/netGuard.ts` | Integrations settings UI + "Create ticket" buttons, guides, Looker Studio connector, marketing, non-WIP commits. Note: `app/docs/G4_HANDOFF.md`. Its throwaway `gap-g4-pg` container + `gap-g4-net` may still exist |

**Migration clash to resolve when merging:** G1 `0010_g1_identity.sql` (hand-appended audit-log trigger at the end — keep it), G3
`0010_crawler_logs.sql`, G4 `0010_g4_integrations.sql` — merge one at a time and renumber the next (0011, 0012), regenerating the drizzle
snapshot/journal. Root `package.json` / lock: G1 adds deps + an `overrides` pin of xml-crypto 6.3.2.

**Found by G3, not fixed:** `app/server/src/services/pipeline.ts` reads `seo_pages` filtered by `domain`, but that table is keyed by
`site_id` — the read likely always falls into its `.catch(() => [])`, so the pipeline never sees the page inventory.

**Left open by fixers (Low):** C-9 (`AI_Metrics.js` ~287–296 count only engines that answered on both sides; `AI_Report.js:124` hard-codes
"the 7 days to …"); B-8 B-9 B-10 B-16 B-18; a Tracker Report node-level scenario for C-12/C-13; Audit Scheduler and Page Watch do not carry
the "ran late" notice; halsimplify.com / tradeshift.com still qualify as prospects when nothing names their category.

## 4. How to merge each one (what worked today)

1. `git merge --no-ff worktree-agent-<id>` in the main checkout. If an engine merge conflicts on meaning (two fixes of one finding), abort
   and have the agent merge `feature/seo-agent-v4.5` into its own branch and reconcile (done for F-A1).
2. Engine: `cd n8n/seo-agent && python3 build_v4.py` (exit 0), harness in the n8n container (`harness/README.md`), expect the previous
   count + the agent's new assertions, 0 failed. Commit the regenerated `workflows/`, `harness/code_v4/` with **explicit paths**
   (`git add -u n8n/seo-agent` + new code_v4 files) — another session edits the marketing site in the same checkout; never `git add -u app/`.
3. App: `docker run --rm -v "$PWD":/repo -w /repo/app node:22-bookworm-slim sh -c "npm ci && npx tsc -p {shared,server,web}/tsconfig.json --noEmit && npm test && npx -w web vite build"`.
4. Push; then deploy (§2) and live-check.

## 5. After deploy: live checks (≈ $0.8 DataForSEO; balance $5.43 at 20:36 UTC 2026-10-17)

Each fixer's reply listed its acceptance check; the main ones: a `crawl_js` audit (no "AI crawlers see a different version", paired pages
`not_compared`); a full report (brand from Search Console, no attestation / jobs / other-company keywords); `discover` (Search Console's
page named, naukrigulf skipped, "erp system dubai" Covered); a verdict on "e invoicing software uae" (`secondary_covered`,
`already_on_page`); Keyword Check "business central partner uae" (`existing.page_url`) and "dynamics 365 partner uae" (paused); a ladder
run on techand.ai (held by the limits: no page run); onboarding step 6 in a browser; the AI Growth dry-run report's title.

## 6. Owner decisions waiting

Deploy (§2) · hold every page with an open `[…]` bracket (F-A2 made it the delivery default) · repair app run `34bb79fe…` cost 0.3065 →
0.1185 (D-3) · may members send CMS drafts; ever auto-draft from the cadence (G2) · the extra ladder `lad_mvcldcnv9q1q` (7 active against
a cap of 2) and `lad_mv9wshpdy2jf` · always-on host (C-1's real cure) · SOC 2 / DPA / legal pages · business profile + facts, mailbox,
IndexNow key file · DataForSEO top-up · real WordPress / Webflow / Contentful accounts to verify G2 · "warehouse management" in techand.ai's
services (F-B's gate now refuses it otherwise).
