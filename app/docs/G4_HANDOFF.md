# G4 handoff — integrations + write API (paused 2026-10-18)

Branch `worktree-agent-a05552be562d6b396` (worktree `.claude/worktrees/agent-a05552be562d6b396`). Design: `app/docs/INTEGRATIONS.md`.
API reference: `app/API.md` → "Write API", "Connecting an AI assistant (MCP)", "Integrations (G4)". `feature/seo-agent-v4.5` @ 2aa912a
is already merged in (commit 0553c35); G4's migration is **`0010_g4_integrations`** (after G2's `0009_cms_publishing`).

## State of the 5 items

| # | Item | State | Files |
|---|---|---|---|
| 1 | Write API + MCP run tools | **Server done + tested** | `server/src/services/apiRuns.ts`, `routes/apiV1.ts`, `services/runs.ts` (`createRunWithMeta`, idempotency under the company lock, `findIdempotentRun`), `services/apiKeys.ts` (`creatorMembership`), `shared/src/api-v1.ts` (scopes `run` / `admin`, `IDEMPOTENCY`), `web/.../ApiKeysTab.tsx` (write-scope warning), `web/.../RunDetailPage.tsx` ("via API key") |
| 2 | Outbound webhooks | **Server done + tested** | `services/webhooks.ts` (queue = log, claim, backoff 1/5/30/120/720 min, 410 / 25 failures disable), events derived in `shared/src/integrations.ts` `eventsFor`, hooked in `services/runs.ts` `ingestCallback`, `expireStaleRuns`, `services/engineFailures.ts`; timer in `server/src/index.ts`; routes `routes/integrations.ts` + `/api/v1/webhooks` |
| 3 | Issue trackers | **Server done + tested** | `services/issueTrackers.ts` (Jira REST v3 / Linear GraphQL / Asana; dedupe via `issue_links` placeholder), routes in `routes/integrations.ts` + `/api/v1/issues` |
| 4 | Warehouse / BI export | **Server done + tested; Looker connector NOT started** | `services/exports.ts`, `lib/sigv4.ts`, `lib/googleSa.ts`, `shared/src/integrations.ts` (`EXPORT_TABLES`…), table read API `/api/v1/tables`, `/api/v1/websites/:id/tables/:table`, MCP `get_table`, timer in `index.ts` |
| 5 | Slack / Teams alerts | **Server done** (formats `json` / `slack` / `teams` of item 2, routing = one endpoint per channel) | same as 2 |
| — | Settings page "Integrations" (UI) | **Not started** | — |
| — | Guides for every token | **Not started** | — |
| — | Marketing (features / changelog / pages) | **Not started** | — |
| — | `app/docs/INTEGRATIONS.md` | Done (design); keep in sync | |

SSRF guard: `server/src/lib/netGuard.ts` (`outbound` + `transport` for tests; webhookUrlOk + connect-time `publicLookup` + IP-literal
check). `services/verify.ts` re-exports `isPrivateIp` / `publicLookup` from it, so G2's `services/cms/http.ts` uses the same code.
Secrets sealed with `MAILBOX_KEY` (no new env setting so far).

## Exact next steps

1. **UI** — add tab `integrations` to `web/src/pages/settings/OrgSettingsPage.tsx` `TABS` and a new
   `web/src/pages/settings/_components/IntegrationsTab.tsx` reading `GET /api/orgs/:orgId/integrations` (`IntegrationsOverview`):
   cards (a) Event webhooks: list + add form (name, format json/slack/teams, URL, event checkboxes from `WEBHOOK_EVENT_LABELS`,
   websites), test / enable-disable / rotate secret / delete, show the `whsec_` secret once, delivery log with "Send again"
   (`/webhook-deliveries/:id/redeliver`); (b) Issue trackers: Jira / Linear / Asana connect forms (`trackerConnectSchema`), test,
   disconnect; (c) Data export: S3 (provider select, `STORAGE_PROVIDER_LABELS`) and BigQuery (paste key JSON) forms, tables
   (`EXPORT_TABLES`), schedule, Run now, last runs; (d) Looker Studio + AI assistants: MCP snippets (copy from API.md) and the connector
   link. Hooks in `web/src/lib/queries.ts`. Then a **"Create ticket"** button: `TechnicalPage.tsx` `FindingsTable` (POST
   `/api/orgs/:orgId/issues` with `{ websiteId, source: { type: 'finding', auditId, findingKey: f.key } }`, show `remoteKey` link from
   `GET /issues?siteId=` + refresh) and `_components/recommendations.tsx` (`type: 'recommendation', id`). Shown only when
   `trackers.length`. Brand tokens only; check 390 / 1440, light / dark.
2. **Guides** (`shared/src/guides.ts`, add area `integrations` to `GuideArea` + `GUIDE_AREAS`): `slack-webhook`, `teams-workflow-webhook`,
   `webhook-signature`, `jira-api-token`, `linear-api-key`, `asana-pat`, `s3-access-keys` (choices AWS IAM / GCS HMAC / R2 token),
   `bigquery-service-account`, `looker-studio-connector`, `mcp-assistant`. Wire with `GuideButton` in the tab. Run `guides.test.ts`.
3. **Looker Studio connector** — `integrations/looker-studio/` at the repo root: `appsscript.json`, `Code.gs` (getAuthType KEY,
   setCredentials / isAuthValid via `GET /api/v1`, getConfig: app URL + website + table, getSchema from `GET /api/v1/tables`,
   getData from `/api/v1/websites/:id/tables/:table?since=&until=` paging `nextCursor`), `README.md` with deployment steps.
4. **Marketing** — `web/src/marketing/content/features.ts` (new capability or extend the API entry: "Integrations: Slack / Teams,
   Jira / Linear / Asana, BigQuery / S3, Looker Studio, API + MCP that can start work"), `content/changelog.ts` line dated
   2026-10-17/18, and every page that lists capabilities (pricing matrix, platform, home).
5. Update `app/.env.example` only if a new setting is added (none yet); add a line to `app/README.md` pointing at INTEGRATIONS.md.
6. Final: `npm run typecheck`, `npm test` (shared + server), `cd web && npx vitest run`, the real-DB suite (below), then a
   non-WIP commit per functionality and the reply per the common brief.

## Checks (last run, after the merge)

- Typecheck shared / server / web: clean before the WIP commit's last edits; re-run (only API.md and test files changed after).
- Shared 328+12+10 tests, server 354 + `apiRuns` 15 + `webhooks` 6 + `vendors` 20 — all passing.
- Real database: `docker network create gap-g4-net; docker run -d --name gap-g4-pg --network gap-g4-net -e POSTGRES_USER=seo
  -e POSTGRES_PASSWORD=seo -e POSTGRES_DB=g4 postgres:17-alpine`, then `docker run --rm --network gap-g4-net -e G4_DB_TEST=1
  -e DATABASE_URL=postgres://seo:seo@gap-g4-pg:5432/g4 -v <worktree>/app:/app -w /app/server node:22-bookworm-slim npx vitest run
  test/integrations.pg.test.ts` → **15 / 15 passed**. The containers `gap-g4-pg` and network `gap-g4-net` are still up: remove them
  at the end (`docker rm -f gap-g4-pg; docker network rm gap-g4-net`).
- Known failing: none. Note for secret scanners: `server/test/vendors.test.ts` contains AWS's **public documentation example**
  credentials (`AKIAIOSFODNN7EXAMPLE`) for the SigV4 test vector — not a real key.

## Merge notes (hotspots)

`server/src/db/schema.ts` (runs columns + the G4 block before `CmsConnectionRow`), migration numbering (`0010`), `server/src/app.ts`
(`integrationRoutes`), `server/src/index.ts` (webhook + export timers), `server/src/lib/errors.ts` (`HttpError.extra`, spread in the
error handler), `shared/src/index.ts` (`./integrations`), `shared/src/api.ts` (`Run.apiKeyName`), `services/runs.ts`
(`createRunWithMeta`, events), `services/verify.ts` (re-export). Still to come: `OrgSettingsPage.tsx`, `queries.ts`, `guides.ts`,
`features.ts`, `changelog.ts`.
