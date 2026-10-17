# App REST API

All endpoints live under `/api` on the app server (`app/server`). Request and response types are in `app/shared/src` (`api.ts`,
`data.ts`, `schemas.ts`). Sessions are an httpOnly cookie (`sid`); every request that changes something must send the header
`X-Requested-With: fetch` (CSRF guard — the web client's `api()` helper does this). Errors are `{ error, fields?, code? }` with the
HTTP status (400 validation with `fields`, 401 signed out, 402 over budget, 403 role / unverified, 404, 409 conflict, 502 n8n down).

Roles: `viewer` (read) < `member` (start runs) < `admin` (sites, team, site settings) < `owner` (budget, delete company).

## Auth and account
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/auth/providers | | `AuthProviders` |
| POST | /api/auth/signup | `signupSchema` | `Me` (signed in) |
| POST | /api/auth/login | `loginSchema` | `Me` |
| POST | /api/auth/logout | | `{ ok }` |
| POST | /api/auth/forgot | `forgotSchema` | `{ ok }` (always, no account enumeration) |
| POST | /api/auth/reset | `resetSchema` | `{ ok }` (signs out every session) |
| POST | /api/auth/verify-email | `{ token }` | `{ ok }` |
| POST | /api/auth/resend-verification | | `{ ok, sent }` |
| GET | /api/auth/google?next=/path | | 302 to Google, back to `/api/auth/google/callback`, then to `next` (or `/login?error=`) |
| GET | /api/me | | `Me`, or `null` when signed out |
| PATCH | /api/me | `updateMeSchema` | `Me` |
| POST | /api/me/password | `changePasswordSchema` | `{ ok }` |

## Companies and team
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /api/orgs | `createOrgSchema` | `Org` (caller becomes owner) |
| GET | /api/orgs/:orgId | | `Org` |
| PATCH | /api/orgs/:orgId | `updateOrgSchema` (admin) | `Org` |
| DELETE | /api/orgs/:orgId | `{ confirm: <company name> }` (owner) | `{ ok }` (stops tracking of its sites in n8n, deletes the company's data in the app) |
| PATCH | /api/orgs/:orgId/onboarding | `{ step, done? }` (admin) | `Org` |
| PATCH | /api/orgs/:orgId/budget | `{ monthlyBudgetUsd }` (owner) | `Org` |
| GET | /api/orgs/:orgId/usage | | `Usage` |
| GET | /api/orgs/:orgId/delivery | | `{ settings: DeliverySettings, nextAt, mailReady, signingReady, recent: DeliveryRecord[] }` |
| PUT | /api/orgs/:orgId/delivery | `DeliverySettings` (+ `webhook.secret`; owner) | the same shape |
| POST | /api/orgs/:orgId/delivery/test | (owner) | `{ delivered, outcomes: [{ channel, ok, target, error }] }` |
| GET | /api/orgs/:orgId/deliveries?limit= | | `{ deliveries: DeliveryRecord[] }` |
| GET | /api/orgs/:orgId/members | | `{ members: Member[], invitations: Invitation[] }` |
| POST | /api/orgs/:orgId/invitations | `inviteSchema` (admin) | `Invitation` with `inviteUrl` |
| DELETE | /api/orgs/:orgId/invitations/:id | (admin) | `{ ok }` |
| PATCH | /api/orgs/:orgId/members/:userId | `updateMemberSchema` (admin) | `{ ok }` |
| DELETE | /api/orgs/:orgId/members/:userId | (admin, or yourself to leave) | `{ ok }` |
| GET | /api/invitations/:token | | `InvitationPreview` |
| POST | /api/invitations/:token/accept | | `{ orgId }` |

## Websites (sites)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/sites | | `Site[]` |
| POST | /api/orgs/:orgId/sites | `createSiteSchema` (admin) | `Site` (409 when another company verified the domain) |
| GET | /api/orgs/:orgId/sites/:siteId | | `Site` |
| PATCH | /api/orgs/:orgId/sites/:siteId | `updateSiteSchema` (admin) | `Site` |
| DELETE | /api/orgs/:orgId/sites/:siteId | (admin) | `{ ok }` (also stops tracking in n8n) |
| GET | /api/orgs/:orgId/sites/:siteId/verification | | `SiteVerificationInfo` |
| POST | /api/orgs/:orgId/sites/:siteId/verify | `verifySiteSchema` (admin) | `VerifyResult` |
| GET | /api/orgs/:orgId/sites/:siteId/google | | `GoogleConnection` |
| POST | /api/orgs/:orgId/sites/:siteId/admin | `adminActionSchema` (admin, verified site) | `AdminResult` |
| POST | /api/orgs/:orgId/sites/:siteId/ai/indexnow/check | (member, verified site; 20 / 10 min) | `IndexNowCheck` — fetches the site's IndexNow key file (from the latest AI growth run; own host, https) and says whether it is in place |
| POST | /api/orgs/:orgId/sites/:siteId/backlinks/import | `linkImportSchema` `{ csv, fileName? }` (member, verified site; 16 MB, 20 an hour) — v4.10: a Search Console Links export (Latest links / More sample links / Top linking sites) or another tool's backlink CSV, parsed by `shared/src/link-import.ts` into `seo_link_imports` (the same kind replaces the previous upload); 400 with a plain message when the file holds no links to the site | `LinkImportSummary` |

## Dashboards (verified sites only; 403 otherwise)
| Method | Path | Returns |
|---|---|---|
| GET | /api/orgs/:orgId/sites/:siteId/data/overview | `OverviewData` |
| GET | …/data/search | `SearchData` |
| GET | …/data/rankings | `RankingsData` |
| GET | …/data/content | `ContentData` |
| GET | …/data/technical?auditId= | `TechnicalData` |
| GET | …/data/ai | `AiData` (v4.9: `daily` pulse days, `latest.traffic / access / perception / index / stages / clusters`, ranges and score per run; v4.12: `growth` — the AI growth loop's latest run: submissions, key pages, targets, earned media with drafts, entity, actions — and `answers[].citedUrls`) |
| GET | …/data/backlinks | `BacklinksData` (v4.10: `refs` = the link ledger with sources, check status and SEO / referral / brand values; `latest.coverage` per source + Google-sample share; `latest.anchors`, `pages`, `wins`, `relChanged`, `compNew`, `lists`; `imports`; `linkGraph`; prospects with score, contact and follow-up drafts; `report.mentions`, `atRisk`, `reclaim`, `drEnabled`) |
| GET | …/data/alerts | `AlertsData` |
| GET | …/data/settings | `SiteSettingsData` |
| GET | …/data/pipeline | `PipelineData` (automations with next/last run, the blog-topic queue, growth loop, 4-week calendar, recent automatic runs; for the tool-form notices: `running` schedule executions, this site's `activeRuns`, `written` pages, `ladders` with their planned pages) |
| GET | …/data/ladders/:ladderId | `LadderDetail` (one keyword ladder: its card plus every page with its state, position history, run / report, volume / difficulty; the timeline with the coming Mondays; clicks and impressions of its published pages by Search Console period; its plan, rank and page reports; cost so far; 404 when the ladder is not one of this domain's) |
| GET | …/recommendations | `Recommendation[]` |

`PipelineData` fields for the Pipeline home (v4.8, `PIPELINE_FEATURE_SPEC.md` §4.1; rules in `server/src/services/ladders.ts` and `shared/src/ladders.ts`):

| Field | What |
|---|---|
| `ladderCards` | `LadderCard[]` in priority order (settings priority, then oldest first): status (Planning, Writing, Climbing, Won, Paused, Queued beyond 2 active Auto ladders, Stuck, Needs you) with a plain line, page counts by state, main keyword position / change / series, pages in the top 10 / 3, next step with its date, expected months, monthly cost, overlaps with other ladders |
| `needsYou` | `NeedsYouItem[]`, most urgent first: connection (tracking, Search Console, reports delivered elsewhere), pile-up of unpublished pages, pages to publish per ladder (oldest first, opens "I published a page"), failed runs of the last 7 days, ladder plans of the last 7 days that planned nothing (`planned: false`, "See why" opens the run), duplicate / overlapping ladders, the next page of each Manual ladder |
| `thisWeek` | `ThisWeekItem[]`: the schedule runs of the next 7 days in time order (and any running now) with what each touches, e.g. the blog posts with their ladder |
| `summary` | pages published this month, ladder keywords in the top 10, clicks of ladder pages (latest 28-day period), the company's spend this month and its budget |
| `automation` | `SiteAutomation`: the website's defaults (`_site` row of `seo_ladder_settings`; without it Auto, opportunities Auto, no auto-start, 2 active ladders, pile-up at 3); changed with `PATCH …/automation` |
| `autoStartEnabled` | the server runs "Choose keywords for me" (`AUTO_START_LADDERS=true`); false = the setting is stored, nothing starts on its own |
| `detected` | `DetectedPage[]` (Phase 4, newest first, one per address): written pages the weekly site report found live by itself (`site_tracker` callback `detected_published`) — shown as "We found your page live at …" in the recent activity; such a page counts as published in its ladder (timeline event `published` with `detected: true`) even before n8n's rows say so. Empty until the n8n part is deployed |
| `activeRuns` (ladder) | a ladder run whose plan has not arrived: the Pipeline shows a "Planning your ladder …" card and polls every 30 s until the plan (and the ladder's card) is there |
| `ladders[].keywords` | every page keyword of a ladder (the overlap warning on the ladder form) |
| `queue.next` / `queue.later` | what the coming Monday run writes, then the rest of its queue — computed by the app's mirror of the Content Cadence (`server/src/services/cadence.ts`, same rules as `Cadence_Plan.js`): ladder pages of the active Auto ladders in priority order (at most `maxActiveLadders`, main page after its support, Direct plans main page first, won / paused / Manual ladders skipped), then opportunity posts when they are Auto; empty while the pile-up guard holds |
| `queue.suggestions` | opportunity posts while they are Manual (what Auto would write; nothing is written on its own) |
| `queue.paused` | `{ reason: 'pileup', waiting, max }` when the coming run writes nothing because `max` or more pages wait to be published, else `null` |
| `needsYou[].writeNow` | on `approve` items (a Manual ladder's next page): the page with its ladder fields, for the Write now dialog |

The ladder cards' next step and the ladder timeline use the same mirror run Monday by Monday (each run's pages count as written for
the next one, nothing is assumed published), so no page is shown as "written on Monday" unless n8n would write it.

## Keyword ladders and pipeline settings (admin, verified sites; PIPELINE_FEATURE_SPEC.md §6-7)
Written to n8n's `seo_ladder_settings` (one row per ladder, the `_site` row for the website's defaults; created with its columns if
missing); the Content Cadence reads them every Monday. A ladder that is not one of the site's domain is a 404 (nothing written).
| Method | Path | Body | Returns |
|---|---|---|---|
| PATCH | /api/orgs/:orgId/sites/:siteId/ladders/:ladderId | `ladderSettingsSchema`: `{ mode?: 'auto' \| 'manual', status?: 'active' \| 'paused' }` | `LadderCard` (as it is now) |
| PUT | /api/orgs/:orgId/sites/:siteId/ladders/order | `ladderOrderSchema`: `{ ladderIds }`, every ladder of the website once (400 otherwise) | `LadderCard[]` in the new order (priorities 1..n) |
| DELETE | /api/orgs/:orgId/sites/:siteId/ladders/:ladderId | | 204 (its `seo_ladders`, `seo_ladder_settings` and `seo_rank_history` rows; written pages stay in the content log and the reports) |
| PATCH | /api/orgs/:orgId/sites/:siteId/automation | `siteAutomationSchema`: `{ defaultMode?, opportunities?, autoStartLadders?: boolean, maxActiveLadders? (1-5), maxWaiting? (1-10) }` | `SiteAutomation` |

- A ladder row the app creates keeps `mode: ''` unless the person chose one (the website's default mode applies) and `status: 'active'`.
- Priorities: a ladder without a priority that gets a row takes the next number after the existing ones, and so does every ladder
  without a priority ahead of it in the visible order — the order the person sees never jumps.
- `status` is only `active` / `paused` here: `won` comes from the rank tracker (below), `queued` is computed, and `stuck` is never
  written (n8n would stop writing the ladder; it is display-only).

- `autoStartLadders` ("Choose keywords for me", the `_site` row's `auto_start`, off by default): with `AUTO_START_LADDERS=true` the
  server (every 6 hours, `services/autoStart.ts`) starts the next recommended keyword for such a website when fewer active Auto ladders
  with pages left than `maxActiveLadders` are being written (the cadence mirror's cards: not paused / won / queued). The keyword: the
  first of `GET …/keywords/recommended` (latest `keyword_strategy` report, at most 90 days old) that is easy or reachable, not
  `plan_type: none`, overlaps no ladder (main or page keyword), was not off-topic in a keyword check (`fit: 0`) and was never started
  automatically for the website (nor the same search). Not when: tracking is paused, a ladder run is going, the pile-up guard holds,
  one was started automatically less than 7 days ago. The run: `createRun` as the company's owner (the same locked budget check: 402 →
  skipped), mode `ladder` with the website's business fields, 1 page now, no e-mail, title "Started automatically: …", `input.autoStart:
  true`; its reports count as automatic (`scheduled`).

## Link building (v4.13, `n8n/seo-agent/LINK_BUILDER_SPEC.md`)
Pitches go out from the company's own mailbox, after a person approves them (or automatically, within a daily limit the owner sets). A mailbox is connected either with an **app password** (SMTP + IMAP; the password is encrypted with `MAILBOX_KEY` and never returned) or, since L4, with **OAuth**: **Microsoft 365** through Graph (sends *and* reads replies) or **Gmail / Google Workspace** (sends only — reading a Gmail inbox needs Google's `gmail.readonly`, a *restricted* scope that requires a CASA security assessment and app verification, so those replies are read in Gmail itself; the Mailboxes tab says so). The refresh token is encrypted like a password, the access token is renewed before it expires, and both are revoked when the mailbox is disconnected. The OAuth apps belong to this installation (`MS_OAUTH_*`, `GMAIL_OAUTH_*` in `app/.env`); with a pair unset that provider is not offered. The server's jobs (`LINK_BUILDER_JOBS`) send inside each mailbox's window (Monday-Friday, its hours and time zone; warm-up 5 / 10 / then its limit; 4-9 minutes apart), read the inbox every 3 minutes (replies, out-of-office, bounces, opt-outs) and stop a sequence at the first reply. The same inbox pass reads **journalist digests** (HARO / Source of Sources) and writes every open request as a `digest` prospect for each verified website (L5); the SEO engine then qualifies and drafts it like any other prospect. A mailbox connected with OAuth sends through its provider's API, and only Microsoft 365 is read. Errors: `{ error, code }`; 409 codes `no_mailbox`, `no_address`, `suppressed`, `consent_needed`; 503 `no_key`.

| Method | Path | Body / notes | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/mailboxes | member | `MailboxView[]` (today's counts, warm-up cap, DNS check) |
| POST | /api/orgs/:orgId/mailboxes | `mailboxSchema` (admin; 10 an hour): both logins are tested before anything is stored; 400 `mailbox_test_failed` with the server's message | `MailboxView` |
| PATCH | /api/orgs/:orgId/mailboxes/:id | `mailboxPatchSchema` (admin): a changed connection value or password re-tests the logins | `MailboxView` |
| POST | /api/orgs/:orgId/mailboxes/:id/test · /pause · /resume | admin; resume refuses a mailbox in error | `MailboxTestResult` / `{ ok }` |
| DELETE | /api/orgs/:orgId/mailboxes/:id | admin; its open sequences pause; an OAuth mailbox's tokens are revoked (Microsoft has no revocation endpoint for this flow: `note` says where to withdraw the app) | `{ ok, revoked, note }` |
| GET | /api/orgs/:orgId/mailbox-oauth/providers | member: the OAuth providers this installation has an app for, what each can do (`reads`) and, when it has none, why | `MailProviderInfo[]` |
| POST | /api/orgs/:orgId/mailbox-oauth/start | `mailboxOauthStartSchema` `{ provider: ms_graph \| gmail_oauth, label? }` (admin; 20 an hour): sets the round-trip cookies and answers with the provider's consent URL; 503 `no_key` without `MAILBOX_KEY`, 503 `oauth_not_configured` when the provider has no app | `{ url }` |
| GET | /api/mailbox-oauth/callback | the provider's redirect (signed-in admin + the state cookie): stores the mailbox and its encrypted tokens, then redirects to `…/settings/mailboxes?mailbox=connected\|error` | redirect |
| GET · POST · DELETE | /api/orgs/:orgId/suppressions(/:id) | the opt-out list (hash + masked hint); add: member `{ value, kind: email \| domain }`, remove: admin | `SuppressionView[]` / `{ ok }` |
| GET | /api/orgs/:orgId/sites/:siteId/link-building | verified site: drafts (from `seo_link_outreach`), sequences with their messages, numbers, listings, redirects, impact, `subjectAb` (L7: first e-mails and replies per subject style; **no verdict under 30 sends per style** — the counts with "not enough sends yet"), `canSend` | `LinkBuildingData` |
| PATCH | …/link-building/settings | `linkSettingsSchema` (admin; `mode: auto` owner only) | `LinkSettings` |
| POST | …/link-building/approve | `approveSchema` `{ prospectDomain, type, toEmail, steps, consent, mailboxId? }` (member): checks the mailbox, postal address, opt-out list, consent rule (recipient country + address), one conversation per site, 90 days' rest. A step may carry `variant` (`A` \| `B`) and `subjectAlt`: L7 keeps which subject style went out | `{ ok, id }` |
| POST | …/link-building/dismiss | `{ prospectDomain, type }` (member): "not a fit" → the prospect is rejected in n8n | `{ ok }` |
| PATCH | …/link-building/sequences/:id | `{ steps?, toEmail? }` (member): only unsent steps change; the address only before the first e-mail | `{ ok }` |
| POST | …/link-building/sequences/:id/pause · /resume · /cancel | member | `{ ok }` |
| POST | …/link-building/sequences/:id/reply | `{ body }` (member): sent now, in the same thread, from the sequence's mailbox | `{ ok }` |
| POST | …/link-building/sequences/:id/outcome | `{ status: won \| rejected }` (member) | `{ ok }` |
| POST | …/link-building/listings/:listingId | `{ status: submitted \| listed \| ignored \| missing, note? }` (member) → `seo_listings` | `{ ok }` |
| POST | …/link-building/run | `{ freeOnly }` (admin; 6 an hour): "Find opportunities now" → n8n `POST /webhook/seo-link-builder`; the report arrives through the callback (stage `link_builder`) | `{ ok, requestId }` |

## Choosing the keyword of a new ladder (verified sites; PIPELINE_FEATURE_SPEC.md §5)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/sites/:siteId/keywords/recommended | (everyone) | `RecommendedKeywords`: the keywords of the website's latest `keyword_strategy` report (`start_with`, `priority`, `quick_wins`, Now / Next topics of `content_plan`), one per search, best first (easy, reachable, not rated, hard, very hard, not realistic; then the research's order; those a ladder covers last), each with `difficultyForYou`, `planType`, `months`, `label`, `why`, `overlaps` (ladders that cover the search); `stale` after 90 days; `reportId: null` when there is none. Free |
| POST | /api/orgs/:orgId/sites/:siteId/keywords/assess | `keywordAssessSchema`: `{ keyword (2-100), country? }` (member) | `KeywordCheck` (`result`: `KeywordAssessment` — volume, kd, position, reach, `difficultyForYou`, `planType` incl. `none`, `months`, `fit` 0/1/2/null, `navigational`, `alternatives`, `label`; `cached`, `costUsd`) |

The keyword check calls n8n's Keyword Check (`POST {N8N_BASE_URL}/webhook/seo-keyword-assess`, `X-API-Key`, `X-Forwarded-For: app:<company>`,
45 s timeout; body `{ keyword, country (default: the website's), domain, business (the website's, when set), services (its case
studies' services), existing_keywords (its ladders' main and page keywords) }`). It is paid (DataForSEO, about $0.02-0.05), so in order:
1. the same website, keyword and country answered within 7 days → that stored check, `cached: true`, no call, free;
2. under the company's advisory lock: the same keyword being checked → 409; 30 checks a day per company (UTC, failed ones included) →
   429 `check_limit`; the monthly budget with the $0.05 estimate → 402 `budget`; the platform's daily ceiling → 429; then a `pending`
   row in `keyword_checks` holds the estimate in the budget;
3. n8n's answer: 200 → the row is `done` with the reported `cost_usd`; 400 → 400 with `fields.keyword` / `fields.country`; 429 → 429
   `engine_limit`; 404 (workflow off) / 401 / 403 / not reachable → 502 "… Nothing was charged" (row removed); 502 / timeout / an answer
   without a keyword → 502 "… Try again in a few minutes" (row kept as `failed`, cost 0: counted in the daily limit only, DataForSEO may
   have charged part of it).

Keyword checks count in the company's spend everywhere runs do: the budget check of runs and checks (`services/spend.ts`), `GET …/usage`
(`keywordChecks: { checks, usd }`, in `estimatedUsd` and the daily totals), the platform admin list and the platform's daily ceiling.

## Runs, reports, files
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /api/orgs/:orgId/runs | `RunInput` (member; one schema per `mode`, see `RUN_SCHEMAS`) | `Run` (status `accepted`, or `failed` with `error`) |
| GET | /api/orgs/:orgId/runs?siteId=&mode=&status=&cursor=&limit= | | `Page<Run>` |
| GET | /api/orgs/:orgId/runs/:runId | | `{ run: Run, reports: Report[] }` |
| GET | /api/orgs/:orgId/reports?siteId=&stage=&limit=&before= | | `Report[]` |
| GET | /api/orgs/:orgId/reports/:reportId | | `ReportDetail` |
| GET | /api/orgs/:orgId/files/:fileId?download=1 | | the file (inline unless `download=1`) |
| POST | /api/orgs/:orgId/reports/:reportId/deliver | (admin) | `{ delivered, reason, outcomes }` — sends this one report now; a report the run marked not ready is refused with the reason |
| POST | /api/orgs/:orgId/reports/:reportId/shares | `{ days?: 1-90 }` (admin; default 14) | `ShareLink` **plus `url`** — the only time the token is returned |
| GET | /api/orgs/:orgId/reports/:reportId/shares | (admin) | `{ items: ShareLink[], defaultDays, minDays, maxDays }` (no tokens) |
| DELETE | /api/orgs/:orgId/reports/:reportId/shares/:shareId | (admin) | `ShareLink` with `state: 'revoked'` |
| GET | /api/share/:token | no session | `{ report: SharedReport }` |
| GET | /api/share/:token/files/:fileId?download=1 | no session | that report's file (same headers and sandbox as the route above) |

### Report delivery (B-R1, `shared/src/report-delivery.ts`, benchmark area 12 §4 G-1)

Finished reports leave the app on the company's own schedule: `each` (as a report arrives), or a `daily` / `weekly` / `monthly`
summary at a chosen weekday, day of month and UTC hour. Two channels, both at once if asked: **e-mail** (the report's headline
figures in the message, its PDF / Word / zip attached up to 12 MB, and links that open it) and a **webhook** (`POST` of JSON with a
`text` line so Slack, Teams and Discord render it unmapped; with a stored secret every body carries
`X-Ascentra-Signature: sha256=<hmac over "<timestamp>.<body>">` and `X-Ascentra-Timestamp`). The signing secret is sealed with
`MAILBOX_KEY` and **never returned** — the API answers `webhook.hasSecret`; sending `webhook.secret: ''` removes it, leaving the
field out keeps what is stored. Reading the settings needs membership; changing them, and sending a test, need **owner**.

**What is never delivered**, whoever asks and whatever the settings say (`deliveryDecision`, 38 unit tests): a rejected run; a run
whose status is not a completed report; a `*_started` acknowledgement or `site_tracker_setup`; a page the quality gate failed
(`qa_not_ready` / `qa_publishable: false`, R11); a ladder the engine refused to plan (`planned: false`, R22 / R23); and evidence the
engine could not read — `verdict: 'NOT_CHECKED'` (R18), `feasibility.status: 'not_checked'`, `serp_features.unavailable`,
`site_read_failed`. Each of those keeps a `held` row in `report_deliveries` with the reason, is named in the summary message that
went out beside it, and stays readable in the app. `POST …/deliver` runs the same decision: there is no override.

Each report in a delivery can carry a **G15 share link** (30 days) when `shareLinks` is on — the same table, token hash, expiry and
revocation as a link a person creates, created with no `createdBy`, and not created once that report has its ten live links.

The webhook address must be **https on a public host**: private, loopback, link-local and `.internal` / `.local` names are
refused (`webhookUrlOk`), because the server fetches whatever is stored there and must not be usable to reach its own neighbours.
Plain `http` is accepted only for `localhost` / `127.0.0.1`, for a developer testing against their own machine.

`report_deliveries` keeps one row per report per channel (a retry updates it; `attempts`, `nextAttemptAt`), plus a row per summary.
A failed attempt is retried every 10 minutes up to 3 times by the same timer that sends the summaries (every 5 minutes); a summary
is not replayed, because by then its window has moved.

### Cost figures (B-R3, `shared/src/cost.ts`)

One table of per-mode prices, mirroring the engine's calibrated defaults (`n8n/seo-agent/v5/code/_cost_cal.js`). `MODES[].costUsd`
and `estimateRunCost()` both read it, so the mode list, the forms and the budget cannot disagree. **The engine's figure wins**:
`runCostEstimate()` prefers `actualCostUsd` (what the run reported spending), then `engineCostEstimateUsd`
(`run_cost_estimate_usd` on a callback, with `run_cost_estimate_basis`), then the app's table — and every figure is shown with which
of the three it is. `ledgerCost` now counts the model calls (`run_ledger.ai_usd` / `ai_cost.usd`) as well as the search data, and
carries `estimated` when any part of it is the engine's own estimate. The company's monthly spend and `GET …/usage` count a run at
the same `coalesce(actual, engine, app)`, so a finished run stops being held against the budget at what was reserved for it.

### Share links (G15, `shared/src/share.ts`, criterion REP 3.7)
An expiring, revocable, **read-only** link to **one report**, for somebody with no account (the page is `/share/:token`).
A 256-bit token goes in the URL and **only its SHA-256 is stored** (`report_shares`), so a database copy hands out no working links;
the row keeps who created it, its expiry, its revocation and when it was last opened (with a counter the owner sees).
**What a holder of the link can reach:** that one report — its title, stage, website domain, date, whether it was scheduled, its
headline `summary` values, the company's name, and the files of *that* report (a PDF inline, everything else as a sandboxed download,
with exactly the headers the signed-in file route uses). Since B-R2 it also carries `brand` and `caveat`, and nothing else was added:
* `brand: { name, logoUrl, initials }` — **white-label-lite**. The company's own mark at the head of the page and in the browser tab,
  our own reduced to one footer line. It is read from the business profile the company already filled in for the engine
  (`seo_profiles`), and **two fields of that row are used**: `business_name` and `logo_url`. The address, phone, public e-mail,
  opening hours and author biography in the same row are never returned. The name falls back to the company's name in the app; the
  logo must be **https**, on a dotted public host, with no credentials (`shared/src/brand.ts`), or it is `null` and the page draws a
  monogram instead. If the engine cannot be reached the brand falls back to the company name and the page renders as before.
* `caveat: { code, title, detail } | null` — the run's own words when it marked the work unfinished (`not_ready`, `rejected`,
  `refused`, `unavailable`, `interim`), from the same `deliveryDecision` the delivery refuses on (B-R1). A share link is not blocked
  for a draft — an owner may want a colleague to read one — but the reader is told before the first figure. The callback `payload`
  itself is still never exposed.
**What a holder can never reach:** any other report (the token resolves to one report id, and a file whose `report_id` differs is a
404), any list of reports, runs or websites, the callback `payload` or the run's input, the company's id, members, settings, mailboxes
or dashboards, and **no write of any kind** — the only shared routes are these two GETs. Editing the URL does not widen it: a token
must be base64url and 32-128 characters before anything is looked up, a file id must be a uuid, and both routes are rate-limited per
IP (30 and 60 a minute). A wrong, revoked or expired token answers **404** with the same shape of message and no report, so a guess
learns nothing; `code` is `share_invalid` / `share_revoked` / `share_expired` for the page's wording. Creating and revoking need the
**admin** role (a viewer may read a report but not hand it outside the company); at most 10 live links per report.

A `ladder` run may carry app-only `ladderPrefs: { mode?: 'auto' | 'manual', first?: boolean }` (the "New keyword ladder" flow; admins
only — a member's are dropped; never sent to n8n). When the run's `ladder_plan` callback arrives with pages planned (`planned` not
false, a valid `ladder_id` whose rows exist), they are applied through the ladder settings: `mode` as `PATCH …/ladders/:id`,
`first: true` moves the new ladder to priority 1 and the others keep their order behind it (one upsert per ladder). Refused plans
(`planned: false`: duplicate or not realistic) change nothing.

A `keyword` run with a website and `receiveContent` is logged in n8n's `seo_content_log` (the Content Cadence skips the keyword for
90 days); when the keyword is a planned page of one of the website's ladders and no `ladder` is given, the server attaches that
ladder page (`ladder` fields, ladder links, row marked `writing`), as "Write now" on the Pipeline page does.

## Read API v1 — the customer's own data, for scripts, BI tools and agents (B5-11 / area 12 G-5, B3-7)

**Why.** Until v4.18 a company's data could leave the product only as a dashboard, a PDF / Word / Markdown file or a delivered report.
Screaming Frog 24 and Sitebulb 10 (2026) let a customer ask their own crawl questions and push issues into their tracker; SE Ranking
ships an API + MCP. This is the same for every part of the product at once, built once in the app server — never per feature.

**Design rules.**
1. **Read-only.** Every endpoint is a `GET`, except `POST /api/v1/publish-check` (it writes nothing anywhere and costs nothing) and
   the MCP endpoint (whose tools are the same reads). A key can never start a run, spend money, change a setting or list members.
2. **One company per credential, never another.** A key belongs to exactly one company. Every query carries `org_id = <the key's
   company>`; a website, run, report, audit or file of another company answers **404 — the same answer as one that does not exist**.
   Audits and findings live in n8n's Data Tables keyed by *domain*, so they are read only for a website **this company verified**
   (a verified domain belongs to one company, `sites_verified_domain_idx`); an unverified website answers 403 `website_unverified`.
3. **Same data the app shows.** The handlers read where the dashboards read (the app's Postgres for websites / runs / reports /
   files, n8n's `seo_audits` / `seo_audit_findings` filtered by the verified domain), with the dashboards' own rules: the comparison
   audit is the previous one **of the same report type** (R66), a count measured on a sample that moved by more than 20% is "not
   compared" (R19), and a finding that rested on one outside reading is "no longer seen", never "fixed" (R74).
4. **Honest gaps.** A field the engine did not store for that row is `null`, never `0` or `""`: `checked` (stored since R19),
   `evidence` / `sampleUrls` (stored since v4.18 — older audits answer `null`). Every report carries `ready` — the same
   `deliveryDecision` the delivery and the share links use — so a script can tell a QA-failed draft or an unread verdict from
   finished work. Costs carry their basis (`measured` / `engine_estimate` / `app_estimate`) and `partial` (search data only).
5. **Versioned.** Everything is under `/api/v1`; a breaking change gets `/api/v2`, never an edit in place. New fields may appear.

**Authentication.** `Authorization: Bearer asc_<43 characters>` — a **company API key**, created and revoked by an owner or admin in
Company settings → API access. The key is shown **once**; only its SHA-256 is stored (`api_keys.token_hash`), with a display prefix
(`asc_` + 8 characters), its name, scopes (`read`, `publish_check`), creator, optional expiry (30 / 90 / 365 days or none), last use
(written at most once a minute) and revocation. At most 10 live keys per company. An unknown, revoked or expired key answers 401
`api_key_invalid` (one message for all three). A request with a Bearer key is never cookie-authenticated, so it needs no
`X-Requested-With` (a cross-site form cannot set `Authorization`). A signed-in **session** works for the same routes, with
`X-Org-Id: <company id>` (membership checked; any role reads, `publish-check` needs member).

**Limits.** 120 requests a minute per key (or per session), `POST /api/v1/publish-check` 30 per 10 minutes; over it: 429
`rate_limited` with `retry-after`. Lists take `?limit=` (1–100, default 25) and `?cursor=`; they answer `{ items, nextCursor }`, with
`nextCursor: null` on the last page. Cursors are opaque.

| Method | Path | Returns |
|---|---|---|
| GET | /api/v1 | `{ company: { id, name }, auth: 'api_key' \| 'session', key: { id, name, prefix, scopes } \| null, limits, endpoints }` |
| GET | /api/v1/websites | `Page<WebsiteV1>` — `{ id, domain, country, verified, verifiedAt, trackingStatus, createdAt }` |
| GET | /api/v1/websites/:websiteId | `WebsiteV1` |
| GET | /api/v1/websites/:websiteId/audits | `Page<AuditV1>` newest first — `{ id, auditedAt, reportType, healthScore, grade, pagesCrawled, findings, bySeverity, scheduled }` (verified websites) |
| GET | /api/v1/websites/:websiteId/audits/:auditId?severity=high,critical&status=new | `{ audit, comparedWith, findings: FindingV1[] }` — `FindingV1`: `{ key, category, severity, title, affected, checked, evidence, sampleUrls, impact, impactBasis, status: new \| open \| fixed \| no_longer_seen, previousAffected, notCompared, recheck }`, in the audit's own fix-list order |
| GET | /api/v1/runs?websiteId=&status=&mode= | `Page<RunV1>` — `{ id, websiteId, mode, title, status, error, createdAt, completedAt, reportCount, cost: { usd, basis, partial, estimated } }` |
| GET | /api/v1/runs/:runId | `{ run: RunV1 & { input }, reports: ReportV1[] }` |
| GET | /api/v1/reports?websiteId=&stage= | `Page<ReportV1>` — `{ id, runId, websiteId, stage, status, title, summary, receivedAt, scheduled, ready: { ok, code, reason }, files }` |
| GET | /api/v1/reports/:reportId | `ReportV1 & { payload }` (the callback as stored — what the app's report page renders) |
| GET | /api/v1/files/:fileId | the file, with the same headers and sandbox as the app's file route |
| POST | /api/v1/publish-check | B3-7, below (scope `publish_check`) |
| POST | /api/v1/mcp | MCP over Streamable HTTP (JSON answers, no streams; API key only): `initialize`, `tools/list`, `tools/call`, `ping` — tools `list_websites`, `list_audits`, `get_audit`, `list_runs`, `get_run`, `list_reports`, `get_report`, `publish_check`, each calling the handler of the REST route above |

Key management (session only, Company settings → API access):

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/api-keys | (admin) | `{ items: ApiKeyView[], max }` — never a token or its hash |
| POST | /api/orgs/:orgId/api-keys | `apiKeyCreateSchema` `{ name, scopes?, expiresInDays? }` (admin; 20 an hour) | `ApiKeyView` **plus `token`** — the only time it is returned |
| DELETE | /api/orgs/:orgId/api-keys/:keyId | (admin) | `ApiKeyView` with `revokedAt` set (refused from the next request) |

### "Is this page publishable?" (B3-7)
`POST /api/v1/publish-check` (key with scope `publish_check`, or the session) and, for the app's own form (Content → "Check a page
before you publish"), `POST /api/orgs/:orgId/sites/:siteId/publish-check` (member, verified site; the website's domain, country and
business facts are filled in when the body leaves them out). The body (`publishCheckSchema`, `shared/src/api-v1.ts`) is n8n's
Publish Check contract: `markdown` (required, ≥ 50 words, ≤ 200,000 characters; optional `Title:` / `Meta Description:` / `Slug:`
lines above the H1), `keyword` (required, ≤ 120), and optional `domain`, `page_type`, `target_words` (200–10,000), `terms[]` (≤ 60,
a string or `{ term, min_count }`), `competitors[]` (≤ 10 `{ url, content ≤ 30,000, rank?, title? }`), `sources[]` (≤ 20
`{ url, text }`), `internal_links[]`, `business_facts`, `currency`, `country`, `ai_question`, `ai_fanout[]`. `domain` must be one of
the **company's own verified websites** or left out — a check is never run in another company's name.
The app forwards it to `POST {N8N_BASE_URL}/webhook/seo-publish-check` (`X-API-Key`, synchronous, 30 s) — the deterministic half of
the content run's own gate (*Content QA* + *Originality Check*: no model call, no fetch, **no row written, $0**) — and answers n8n's
200 unchanged: `{ ok, publishable, verdict, exit_code 0|1, label, summary, reasons[], content_score, score_bar, score_breakdown,
warnings[], advice[], checks, fixed_markdown, auto_fixes[], schema_types[], not_checked[{ check, reason }], basis, writes: 'none',
cost_usd: 0 }`. n8n's 400 is passed on as 400 `{ ok: false, verdict: 'error', exit_code: 2, error, errors[] }`; n8n down or the
workflow off is 502 `engine_unavailable` ("nothing was checked"). `exit_code` is meant for a CI step: 0 publish, 1 do not, 2 the
request was wrong.

**Not built (on purpose):** a ticket hand-off (Jira / Linear) and a BI connector (a Looker Studio community connector) — both sit on
top of this API and need the owner's choice of tracker / tool; new findings already leave the product through report delivery
(`site_audit` stage, signed webhook).

## n8n → app
`POST /api/hooks/n8n/:hookToken` — every callback of every run and every scheduled report of the company (the token is the
company's `hook_token`; it is sent to n8n as `callback_url`). Body: the n8n callback (`stage`, `request_id`, …); embedded files are
moved to the files table. A `rank_tracker` callback with `won: true` for a ladder of a verified website of the company also sets that
ladder's `seo_ladder_settings` status to `won` (unless it is paused or archived), so the app keeps showing Won after the tracker stops
checking it and the cadence writes no more pages for it. A `ladder_plan` callback of a ladder run with `ladderPrefs` applies them (see
Runs); a `site_tracker` callback with `detected_published: [{ keyword, url, ladder_id, matched_by, source }]` (Phase 4) is stored as
usual and read by the Pipeline (`detected`), the ladder detail and the site-report view ("We found your page live at …").

## Platform admin (e-mails in `PLATFORM_ADMIN_EMAILS`)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/admin/orgs | | `AdminOrg[]` |
| PATCH | /api/admin/orgs/:orgId | `orgBudgetSchema` | `AdminOrg` |
| GET | /api/admin/delivery | | `DeliveryReport` — runs delivered / runs started per week (app runs and the nine schedules), the schedule fires that left no execution behind (D25a) and how every ops alert went out (G21) |
| POST | /api/admin/users/reset-link | `{ email }` | `{ url, expiresInHours, name }` — a password reset link to hand over (no e-mails on the platform) |
