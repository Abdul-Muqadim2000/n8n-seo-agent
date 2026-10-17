# Integrations — write API, event webhooks, issue trackers, warehouse export (G4, 2026-10-17)

**Gap.** `n8n/seo-agent/docs/system-review-2026-10-17/MARKET_BENCHMARK.md` §5 rows 10 and 11: Ascentra's data ended in the app (no
Looker Studio connector, no BigQuery / S3 export, no Jira / Asana / Linear, no Slack app) and its API and MCP were read-only, while
seoClarity (LiveWire + BigQuery / Redshift / S3 + Jira / Asana), Conductor (AgentStack, MCP, Content API), Ahrefs (Looker connectors,
Agent A + MCP) and Profound let a team trigger work from an assistant and land the data in its own BI stack and tracker.

This note is the design; `app/API.md` holds the endpoint reference. Everything below is built in the app server (`app/server`); the
n8n engine is unchanged — every integration reads what the app already stores or reads from n8n, and every run still enters the engine
through the one front door the forms use.

## 1. What is built

| # | Capability | Where |
|---|---|---|
| 1 | **Write API + MCP run tools** — start any analysis a form can start, with the forms' validation, budget check, company lock, duplicate warnings and rate limit; `Idempotency-Key`; key **scopes** `read` / `publish_check` / `run` / `admin`; MCP tools `list_modes`, `preview_run`, `start_run`, `get_run` beside the read tools | `services/apiRuns.ts`, `routes/apiV1.ts`, `shared/src/api-v1.ts` |
| 2 | **Event webhooks** — several endpoints per company, each subscribed to event types and websites, HMAC-signed JSON (or Slack / Teams formatted), retries with backoff, a delivery log, the SSRF guard | `services/webhooks.ts`, `shared/src/integrations.ts` |
| 3 | **Issue trackers** — push an audit finding or a recommendation to **Jira Cloud**, **Linear** or **Asana** as one ticket with the evidence, example URLs and the fix; the remote key is stored; status read back on refresh; one finding = one ticket | `services/issueTrackers.ts` |
| 4 | **Warehouse / BI export** — scheduled (or on demand) export of six tables as NDJSON or CSV to **S3-compatible storage** (AWS S3, Google Cloud Storage interoperability, Cloudflare R2, any SigV4 store) and to **BigQuery** (load jobs, service-account JSON); one documented schema per table, readable through the API as well; a **Looker Studio community connector** in `integrations/looker-studio/` | `services/exports.ts`, `lib/sigv4.ts`, `lib/googleSa.ts` |
| 5 | **Slack / Microsoft Teams** — an event endpoint whose format is Slack (incoming webhook) or Teams (Workflows webhook); channel routing = one endpoint per channel, each with its own event types | same as 2 |

The settings page **Company settings → Integrations** connects, tests and disconnects every one of them, with a "Show me how" guide for
every token the person must fetch (`shared/src/guides.ts`, area `integrations`). The technical page and the recommendations page carry a
**Create ticket** action once a tracker is connected.

## 2. Threat model and failure modes

| Threat / failure | What stops it |
|---|---|
| A key used to spend another company's money or read its data | A key resolves to exactly one company (`authenticateKey`); every query carries that `org_id`; a run is created by the same `createRun` the form uses, which refuses a website of another company and an unverified website. |
| A leaked read key starts paid work | Scopes. `run` and `admin` are separate permissions chosen at key creation (default: `read` + `publish_check`). A key without `run` answers 403 `scope_missing`. |
| A key outlives the person who made it | A run or admin action through a key acts **as the key's creator**, re-checked on every request: the creator must still be a member (`run`: member or above; `admin`: admin or above). Otherwise 403 `key_owner_gone` — revoke the key or make a new one. |
| A script retries a timed-out POST and pays twice | `Idempotency-Key` (1–200 of `A-Za-z0-9_.:-`): the run row stores the key and a SHA-256 of the canonical request; a repeat within 24 h answers the **same run** with `idempotent-replayed: true`; the same key with another body answers 422 `idempotency_mismatch`. The check runs **under the company lock** inside the run's own transaction, so two concurrent repeats cannot both pass. |
| An agent starts the same page twice, or a ladder that competes with one already planned | The forms' duplicate warnings (`pipelineNotices`, shared with the web app) are computed on the server from the same pipeline data. A warning that asks for a tick in the form must be **acknowledged by id** (`acknowledge: ["active:…"]`); otherwise 409 `confirm_needed` with the notices. `dryRun: true` / MCP `preview_run` returns the estimate, the notices and the budget without starting anything. |
| Over budget, platform capacity, too many runs | The same `assertBudget` (402 `budget`, 429 `platform_capacity`) under the same `pg_advisory_xact_lock`; the same 30 starts a minute as the form route, keyed by the API key; the per-key 120 requests a minute; the engine's own 40 runs a day per company. |
| SSRF through a webhook URL, a Jira site URL or a storage endpoint | Two layers. (1) The address must pass `webhookUrlOk` (https, no private / loopback / link-local / `.internal` host — the report-delivery rule), and vendor URLs must match the vendor (`*.atlassian.net`, `hooks.slack.com`, Teams Workflows hosts, the storage endpoints of section 6). (2) Every outbound request connects through `guardedFetch` (`lib/netGuard.ts`), whose DNS lookup refuses a name that resolves to a private address **at connect time** — the address checked is the address connected to, so DNS rebinding cannot slip past the first check. No redirects are followed. |
| Secrets at rest | Tracker tokens, storage keys, the BigQuery service-account JSON, webhook signing secrets and the webhook URLs themselves (a Slack URL *is* a credential) are sealed with AES-256-GCM under `MAILBOX_KEY` (`lib/secretBox.ts`), like mailbox passwords. Without the key nothing is stored (400 `secrets_unavailable`). The API and the UI return only `hasSecret`, the URL's host and the last four characters. Secrets never reach a log line: errors are cut to the vendor's message and the host. |
| A receiver that is down, slow or hostile | 10-second timeout, 64 KB of the answer read at most, 6 attempts at 1 / 5 / 30 / 120 / 720 minutes, then `gave_up`. An endpoint whose last 25 deliveries all failed is switched off with the reason (`disabledReason`); re-enabling it is one click. A hostile receiver learns only what it subscribed to. |
| Forged webhooks | `X-Ascentra-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<body>">` with `X-Ascentra-Timestamp` (ms), the scheme report delivery already uses; receivers reject timestamps older than 5 minutes. Each delivery has a stable `X-Ascentra-Delivery` id for de-duplication on their side; retries carry the same id. |
| A ticket created twice (double click, two people, two trackers) | `issue_links` is unique per company and source (`finding:<website>:<finding key>` or `rec:<website>:<recommendation id>`). The row is inserted **before** the remote call (status `creating`); a second request finds it and answers the existing ticket. A failed remote call deletes the placeholder. |
| A partial or wrong export | Every export writes one object per table per run (never appends to a half-written one) and records rows, bytes and the object name per table in `export_runs`; a table that failed is named with its error while the others still land. BigQuery tables are loaded with `WRITE_TRUNCATE` from a full snapshot, so a re-run replaces instead of duplicating. |
| An export that grows without bound | 200,000 rows per table per run and 100 MB per object; beyond it the table is cut and the run says so (`truncated: true`). |

## 3. Data model (migration `0009_g4_integrations`)

- `runs` + `api_key_id` (which key started it, null for people), `idempotency_key`, `idempotency_hash`; index `(org_id, idempotency_key)`.
- `integrations` — one connector per row: `kind` (`jira` | `linear` | `asana` | `s3` | `bigquery`), `name`, `config` (jsonb, non-secret:
  site URL, project, team, bucket, region, dataset, tables, schedule…), `secret` (sealed), `status` (`ok` | `error` | `untested`),
  `last_error`, `last_checked_at`, `created_by`, `created_at`, `updated_at`; export rows also `last_run_at`, `next_run_at`.
  Unique `(org_id, kind)` for the three trackers (one Jira per company); several storage destinations are allowed.
- `issue_links` — `org_id`, `site_id`, `integration_id`, `kind`, `source_key` (unique per company), `source_title`, `remote_id`,
  `remote_key`, `remote_url`, `remote_status`, `remote_state` (`todo` | `in_progress` | `done` | `unknown`), `status`
  (`creating` | `created` | `failed`), `created_by`, `created_at`, `synced_at`.
- `webhook_endpoints` — `org_id`, `name`, `format` (`json` | `slack` | `teams`), `url_sealed`, `url_host`, `url_hint` (last 4),
  `secret_sealed` (json only), `events` (jsonb array), `site_ids` (jsonb, empty = all), `enabled`, `disabled_reason`,
  `consecutive_failures`, `created_by`, `created_at`, `last_success_at`, `last_failure_at`.
- `webhook_deliveries` — `org_id`, `endpoint_id`, `event_id`, `event_type`, `payload` (jsonb), `status` (`pending` | `sent` |
  `failed` | `gave_up`), `attempts`, `next_attempt_at`, `last_status_code`, `last_error`, `created_at`, `delivered_at`. Purged after
  30 days.
- `export_runs` — `org_id`, `integration_id`, `trigger` (`schedule` | `manual`), `status` (`running` | `ok` | `partial` | `failed`),
  `tables` (jsonb: per table rows, bytes, object / job id, truncated, error), `started_at`, `finished_at`, `error`.

## 4. Write API

`POST /api/v1/runs` (scope `run`) takes **exactly the body the app's form posts** (`shared/src/schemas.ts` `RUN_SCHEMAS`, chosen by
`mode`), with `websiteId` accepted for `siteId`, plus:

- `acknowledge: string[]` — notice ids the caller accepts (see 409 below);
- `dryRun: boolean` — answer `{ dryRun: true, estimate: { usd, minutes }, notices, budget: { spentUsd, budgetUsd, remainingUsd } }` and
  start nothing.

Answers: **201** `{ run: RunV1 & { input }, notices }` · **200** the same with `idempotent-replayed: true` · **400** `validation` with
`fields` · **402** `budget` · **403** `scope_missing` / `key_owner_gone` / `website_unverified` · **409** `confirm_needed` `{ notices }` ·
**422** `idempotency_mismatch` · **429** `rate_limited` / `platform_capacity` · **502** the engine refused at the door (the run row is
kept as `failed` with the engine's sentence, exactly as in the app).

A run started by a key appears in the app like any other, attributed to the key's creator, with "via API key <name>" on the run page.
`GET /api/v1/runs/:runId` (scope `read`) is its status and reports; `GET /api/v1/modes` lists the modes with their required fields and
estimates.

**MCP** (`POST /api/v1/mcp`): `list_modes`, `preview_run` (= `dryRun`), `start_run` (scope `run`; arguments `input`, `acknowledge`,
`idempotencyKey`), `get_run`, plus the read tools and `get_table` (section 6). `tools/list` shows only the tools the key may call.
Client snippets for Claude Desktop, Claude Code and ChatGPT connectors are in `app/API.md` "Connecting an AI assistant".

**Webhook / tracker / export management through the API** (scope `admin`): `GET/POST/DELETE /api/v1/webhooks`,
`POST /api/v1/webhooks/:id/test`, `POST /api/v1/exports/:id/run`. Pushing a finding to the tracker is scope `run`:
`POST /api/v1/issues`.

## 5. Events

| Type | When | `data` |
|---|---|---|
| `run.completed` | a run's final report arrived | `run` (RunV1) |
| `run.failed` | the engine refused or failed the run, or it expired | `run`, `error` |
| `report.ready` | a report the delivery rule would send (finished work) | `report` (ReportV1 without payload) |
| `report.held` | a report the run itself marked not ready (QA-failed draft, refused plan, unread verdict) | `report`, `reason` |
| `alert.raised` | a Search Console alert, an AI pulse change, a key-page change, or an `alerts` line on a weekly report | `alerts: [{ level, text }]`, `source` |
| `audit.finding.new` | an audit found issues the previous audit **of the same type** did not have | `audit` (id, type, score), `findings: [{ title, category, severity }]` |
| `rank.changed` | the rank tracker measured a move of 5 places or more | `ladder`, `gains`, `drops: [{ keyword, position, previous, delta }]` |

Envelope: `{ id, type, createdAt, company: { id, name }, website: { id, domain } | null, data }`. Slack gets `{ text, blocks }`
(section + context blocks, a button to the report); Teams gets a Workflows message with one Adaptive Card. Events are derived in the
app from the callbacks it stores (`ingestCallback`), after the report is saved — an event can never lose a callback.

## 6. Export tables

`EXPORT_TABLES` in `shared/src/integrations.ts` is the one schema: names, types (`STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`,
`TIMESTAMP`, `DATE`), descriptions. Every row adds `company_id`, `website_id`, `website_domain`, `exported_at`.

| Table | Source | Grain |
|---|---|---|
| `rank_history` | n8n `seo_rank_history` | one reading of one keyword |
| `site_metrics` | n8n `seo_site_metrics` | one weekly Search Console / GA4 period |
| `audit_findings` | n8n `seo_audit_findings` | one finding of one audit |
| `ai_visibility` | n8n `seo_ai_visibility` | one weekly AI visibility run |
| `backlinks` | n8n `seo_backlinks` | one referring site (the ledger) |
| `runs` | app `runs` | one analysis with its cost |

Object names: `<prefix>/<table>/dt=YYYY-MM-DD/<table>-<export run id>.<ndjson|csv>` (Hive-style partition, a full snapshot each run;
query the newest `dt`). BigQuery: `<dataset>.<prefix><table>`, created if missing with the documented schema, replaced each run.
The same rows are readable at `GET /api/v1/websites/:websiteId/tables/:table` (scope `read`) — which is what the Looker Studio
connector calls.

Storage providers: **AWS S3** (`https://<bucket>.s3.<region>.amazonaws.com`), **Google Cloud Storage** through its S3-compatible XML
API with HMAC keys (`https://storage.googleapis.com`, region `auto`), **Cloudflare R2** (`https://<account>.r2.cloudflarestorage.com`,
region `auto`), or any SigV4 endpoint on a public https host (path-style). Requests are signed with AWS Signature Version 4 in
`lib/sigv4.ts` (checked against AWS's published example signature in the tests).

## 7. Limits

API: 120 requests a minute per key; 30 run starts a minute per key; 40 runs a day per company (engine). Webhooks: 10 endpoints a
company, 6 attempts, 30 days of log. Trackers: one connection per kind, 30 tickets a minute per company, status refresh at most once per
ticket per 5 minutes. Exports: 3 destinations, daily or weekly (UTC hour), "Run now" at most once per 10 minutes per destination,
200,000 rows per table, 100 MB per object.

## 8. Deliberately not built (and why)

- **OAuth 3LO for Jira / Asana, OAuth apps for Slack.** Token-based first, as asked: Atlassian API tokens, Linear personal API keys and
  Asana PATs are what admins hand to integrations today, and an OAuth app needs a registered client per installation (the owner's call,
  like `GMAIL_OAUTH_*`). The connector shapes keep `auth: 'token'` so a 3LO flow can be added beside it.
- **A native Slack app** (slash commands, interactive buttons). Incoming webhooks + Teams Workflows cover "alerts where the team is",
  which is the gap; an app needs a public Slack app listing and a signing-secret endpoint — later, if customers ask.
- **Snowflake / Redshift.** Both read S3 (external stages / `COPY`), so the S3 export with its documented schema covers them without
  a second credential type.
- **Two-way ticket sync** (closing the finding when the ticket closes). The finding is closed by the next audit or by "I fixed this"
  (G11), which checks the site; a ticket marked done proves nothing about the site. The ticket's state is shown beside the finding.
- **Engine changes.** None were needed: events come from callbacks the app already stores.
- **Report delivery's single webhook** is kept as it is (report digests on a schedule); event endpoints are the routing layer beside it.
