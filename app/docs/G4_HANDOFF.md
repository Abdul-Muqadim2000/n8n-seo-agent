# G4 handoff — integrations + write API (finished 2026-10-18)

Branch `worktree-agent-a05552be562d6b396` (worktree `.claude/worktrees/agent-a05552be562d6b396`). Design: `app/docs/INTEGRATIONS.md`.
API reference: `app/API.md` → "Write API", "Connecting an AI assistant (MCP)", "Integrations (G4)". README section "Integrations and the
write API (G4)". `feature/seo-agent-v4.5` @ 0320acb (G3 crawler logs + G1 identity) is merged in; G4's migration is **`0012_g4_integrations`**,
regenerated from the merged schema (journal 0009 → 0010 → 0011 → 0012; a second `drizzle-kit generate` finds nothing). Every admin
action of G4 writes G1's audit log (category "Integrations and API work").

## All five items are done

| # | Item | Server | UI | Tests |
|---|---|---|---|---|
| 1 | Write API + MCP run tools (scopes `run` / `admin`, Idempotency-Key, the forms' checks) | `services/apiRuns.ts`, `routes/apiV1.ts`, `services/runs.ts` `createRunWithMeta` | API access tab (write-scope warning), run page "via API key" | `server/test/apiRuns.test.ts` (15), real-DB suite |
| 2 | Outbound webhooks (events, HMAC, retries, delivery log, SSRF guard) | `services/webhooks.ts`, `lib/netGuard.ts`, events from `shared/src/integrations.ts` `eventsFor` | Integrations → Alerts and events | `shared/src/integrations.test.ts`, `server/test/webhooks.test.ts`, real-DB suite |
| 3 | Jira / Linear / Asana tickets, dedupe, state read back | `services/issueTrackers.ts` | Integrations → Issue trackers; **Create ticket** on Technical findings + Recommendations (`components/site/TicketButton.tsx`) | `server/test/vendors.test.ts`, real-DB suite, `web/test/integrations.test.tsx` |
| 4 | Warehouse export (S3 / GCS / R2, BigQuery) + Looker Studio connector | `services/exports.ts`, `lib/sigv4.ts`, `lib/googleSa.ts`, table read API | Integrations → Data export, Looker Studio, MCP snippets | `vendors.test.ts` (AWS SigV4 vector, BigQuery job flow), `integrations-data.test.ts`, `integrations/looker-studio/test/connector.test.mjs` |
| 5 | Slack / Teams alerts with routing | formats of item 2 | same | same |

Also: 10 setup guides (area `integrations` in `shared/src/guides.ts`), marketing (capability `/platform/integrations` with its own
mockup, changelog 2026-10-18, tools list, plan lists, pricing matrix rows marked PLACEHOLDER, two solutions).

## Checks (2026-10-18)

- After merging G3 + G1 (f40dc22): typecheck shared / server / web clean; shared 448 passed (1 skipped), server 455 passed (44 skipped =
  the real-DB suites with their flags off), web 30 passed, web build OK, Looker connector 15 checks.
- Real database (`G4_DB_TEST=1`, own Postgres, migrations 0000-0012 incl. G1's audit trigger): `test/integrations.pg.test.ts` 16 / 16
  (the 16th checks every G4 write lands in G1's audit log with known actions, the API run naming its key, no secret in the details).
- Browser pass on an own stack (`gap-g4-pg` + `gap-g4-stub` n8n stand-in + `gap-g4-server` + `gap-g4-web`, Playwright 1.55): the
  Integrations tab (as it opens, and with every form open), the Technical page with the Ticket column, Recommendations and
  `/platform/integrations`, each at 1440 and 390 px in light and dark, plus the Slack guide opening and a Create-ticket click —
  **22 visits: no horizontal overflow, an h1 on every page, no WCAG AA contrast failure, no failed request, no console error** except
  the one deliberate 409 of the Create-ticket click (the seeded tracker token was a dummy, so the app said "the stored token cannot be
  read any more — connect the tracker again", the intended failure path). Screenshots stayed in the session scratchpad. The stack was
  removed afterwards.
- Secret scan: only AWS's public documentation example key `AKIAIOSFODNN7EXAMPLE` (SigV4 test vector) appears.

## For the owner

- `MAILBOX_KEY` must be set on the server (already required for mailboxes): without it nothing can be connected and the page says so.
- Prices / plans in `content/pricing.ts` for the new rows are PLACEHOLDER.
- Looker connector: deploy it once per installation (`integrations/looker-studio/README.md`) and serve a PNG of the app icon for its manifest.
- Not built (see INTEGRATIONS.md §8): OAuth 3LO for Jira / Asana, a native Slack app, Snowflake / Redshift loaders, two-way ticket sync.

## Merge hotspots

`server/src/db/schema.ts` (runs columns + the G4 block before `CmsConnectionRow`), migration numbering, `server/src/app.ts`,
`server/src/index.ts` (webhook + export timers), `lib/errors.ts` (`HttpError.extra`), `services/verify.ts` (re-exports netGuard),
`services/runs.ts`, `shared/src/index.ts`, `shared/src/api.ts` (`Run.apiKeyName`), `shared/src/guides.ts` (new area + 10 guides),
`web/src/components/guide/GuidePanel.tsx` (area icon), `OrgSettingsPage.tsx` (tab), `TechnicalPage.tsx`, `RecommendationsPage.tsx`,
`recommendations.tsx`, marketing `features.ts` / `changelog.ts` / `pricing.ts` / `site.ts` / `solutions.ts` / `PlatformPage.tsx` /
`CapabilityMap.tsx` / `CapabilityScreen.tsx` / `FeatureVisual.tsx`.
