# G3 hand-off — server-log and AI-crawler analytics (gap #6)

Design note: `app/docs/LOG_ANALYTICS.md` (threat model, formats, verification sources with URLs, data model, privacy, limits, tests).

## Done (branch `worktree-agent-aaf7d59acd32d0ae8`)
- `f21270d` server: upload (streamed, gzip, 1 GB) + push endpoint `POST /api/ingest/logs/:siteId` (Cloudflare Logpush, Vercel /
  Fastly / Akamai drains, per-site push key, SHA-256 stored); parsers (combined, W3C/IIS/CloudFront, JSON lines); crawler registry
  (`shared/src/crawlers.ts`) with vendors' IP lists (dated copy `ranges.snapshot.json` + daily refresh into `bot_ip_ranges`) and
  forward-confirmed DNS; verified / spoofed / claimed / unchecked; rollups; analytics; CSV; read API `GET /api/v1/websites/:id/crawlers`
  + MCP tool `get_crawler_activity`; jobs (worker, retention, refresh, restart recovery). Migration `0009_crawler_logs`.
- `33ecb02` tests: fixtures in real formats, parse/verify unit tests, Postgres integration tests (isolation, roles, CSRF, duplicates,
  push, retention, delete, read API, refresh guard, 1M lines in 16 s / 45 ms max event-loop lag); raw SQL sends ISO strings / JSON text
  (drizzle's postgres client refuses Date, array and json params).
- `7d6d8f7` web: Crawlers page + sidebar + route, setup panel, 3 guides (`crawler-logs-upload`, `-cloudflare`, `-drain`), render tests.
- `9d2613f` docs: LOG_ANALYTICS.md, API.md, README, `.env.example` (`CRAWLER_JOBS`, `LOG_SPOOL_DIR`, `BOT_RANGES_REFRESH`).

## Checks (before the 2aa912a merge)
shared 365 passed / 1 skipped; server 338 passed / 12 skipped (the 12 = DB suite, passes 12/12 with `TEST_DATABASE_URL`); web 21
passed; tsc clean in shared, server, web; `npm run build -w @seo/web` ok.
DB tests: `docker run --network gap-g3-net … -e TEST_DATABASE_URL=postgres://seo:seo@gap-g3-pg:5432/seo -e DATABASE_URL=… -e CRAWLER_JOBS=false node:22-bookworm-slim npx vitest run test/crawlerDb.test.ts` (in `server/`). Remove `gap-g3-pg` / `gap-g3-net` when done.

## Not started
- Marketing (CLAUDE.md "Business pages follow the product"): `features.ts` entry `crawler-analytics` (+ a `CrawlersMockup` and
  `VisualKey`), `CapabilityMap` GROUPS, `CapabilityScreen` APP_PATH, `changelog.ts` line dated 2026-10-17, pricing / solutions rows.
- Browser pass at 390 / 1440, light / dark (render tests only so far).

## Merge notes
- Upstream has `0009_cms_publishing`: mine must become `0010_crawler_logs` (delete mine + its snapshot, take upstream journal /
  snapshot, `npx drizzle-kit generate --name crawler_logs` in `server/`).
- Shared files touched: `db/schema.ts` (new tables at the end + `bigint, bigserial, date` imports), `app.ts` (`/api/ingest/` skips CSRF
  and session like `/api/hooks/`; two plugins registered), `index.ts` (startCrawlerJobs), `config.ts` (`crawlers`), `routes/apiV1.ts`,
  `services/apiV1.ts`, `shared/src/index.ts`, `shared/src/guides.ts`, `web/src/lib/queries.ts`, `router.tsx`, `OrgLayout.tsx` (nav).
- Found, not fixed: `services/pipeline.ts` reads `seo_pages` with a `domain` filter, but that table has no `domain` column (it is keyed
  by `site_id` = `n8nSiteId(domain)`), so that read likely always fails into its `.catch(() => [])`. The crawler code reads it by `site_id`.
- Owner: Cloudflare Logpush of HTTP requests needs a Cloudflare Enterprise plan; the spool is local disk (one app server, or sticky
  uploads); outbound HTTPS to the vendors' list URLs for the daily refresh.
