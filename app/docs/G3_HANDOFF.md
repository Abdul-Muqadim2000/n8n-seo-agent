# G3 hand-off — server-log and AI-crawler analytics (gap #6): DONE

Design note: `app/docs/LOG_ANALYTICS.md` (threat model, formats, verification sources with URLs, data model, privacy, limits, tests).

## Commits (branch `worktree-agent-aaf7d59acd32d0ae8`)
- `f21270d` server: upload (streamed, gzip, 1 GB) + push endpoint `POST /api/ingest/logs/:siteId` (Cloudflare Logpush, Vercel /
  Fastly / Akamai drains, per-site push key, SHA-256 stored); parsers (combined, W3C/IIS/CloudFront, JSON lines); crawler registry
  (`shared/src/crawlers.ts`) with the vendors' IP lists (dated copy `ranges.snapshot.json` + daily refresh into `bot_ip_ranges`) and
  forward-confirmed DNS; verified / spoofed / claimed / unchecked; rollups; analytics; CSV; read API `GET /api/v1/websites/:id/crawlers`
  + MCP tool `get_crawler_activity`; jobs (worker, retention, refresh, restart recovery).
- `33ecb02` tests (fixtures in the vendors' real formats, parse / verify unit tests, Postgres integration tests incl. 1M lines in 16 s
  with 45 ms max event-loop lag) + raw SQL through drizzle's client (ISO strings / JSON text).
- `7d6d8f7` web: Crawlers page, sidebar entry, route, setup panel, three guides, render tests.
- `9d2613f` docs: LOG_ANALYTICS.md, API.md, README, `.env.example`.
- `8b2704e`, `760ac06` merges of `feature/seo-agent-v4.5` (last: ad8cff1, after 711a6a1). Migration **`0010_crawler_logs`** (after
  upstream `0009_cms_publishing`; `drizzle-kit generate` reports no drift).
- `da01e2e` business site: capability `crawler-analytics` (`features.ts`, `CrawlersMockup`, `VisualKey 'crawlers'`), capability map
  (Measure), platform loop (Track), app path, pricing (Growth list + comparison row, PLACEHOLDER — confirm), in-house solution, security
  page (log data handling), changelog 2026-10-18.
- final commit: browser-pass fixes (headline said "pages" for requests; a 3xx row showed the page's last 200; retention select width),
  screenshots, this note.

## Checks (final)
tsc clean in shared, server, web; `npm test`: shared 407 passed / 1 skipped, server 355 passed / 29 skipped, web 21 passed; crawler DB
suite 12 / 12 on a throwaway Postgres; web build ok.
**Browser pass** (own throwaway stack: Postgres 17 + the app server serving the built web on a private docker network; Playwright
1.55): Crawlers page empty and with data at 1440 and 390, light and dark, the upload dialog at both sizes, the upload flow end to end
(file → read → figures), push key created in the UI and used for a gzip Logpush batch (200; a wrong key 401), a viewer sees no upload or
key buttons — every view: exactly one h1, 0 px horizontal overflow, no console errors. Screenshots: `app/docs/browser-pass/crawlers-*.png`
(the push-key dialog is not committed: it shows a key).

## Notes for the merge / owner
- Shared files touched: `db/schema.ts`, `drizzle/meta`, `app.ts` (`/api/ingest/` skips CSRF and session like `/api/hooks/`), `index.ts`,
  `config.ts`, `routes/apiV1.ts`, `services/apiV1.ts`, `shared/src/index.ts`, `shared/src/guides.ts`, `web/src/lib/queries.ts`,
  `router.tsx`, `OrgLayout.tsx`, marketing `features.ts`, `changelog.ts`, `pricing.ts`, `solutions.ts`, `CapabilityMap.tsx`,
  `CapabilityScreen.tsx`, `FeatureVisual.tsx`, `PlatformPage.tsx`, `SecurityPage.tsx`.
- Found, not fixed: `services/pipeline.ts` reads `seo_pages` with a `domain` filter, but that table has no `domain` column (keyed by
  `site_id` = `n8nSiteId(domain)`), so that read likely always falls into its `.catch(() => [])`. The crawler code reads it by `site_id`.
- Owner: Cloudflare Logpush of HTTP requests needs a Cloudflare Enterprise plan; the spool is local disk (one app server, or sticky
  uploads); outbound HTTPS to the vendors' list URLs for the daily refresh; the Growth-plan placement in pricing is a placeholder.
