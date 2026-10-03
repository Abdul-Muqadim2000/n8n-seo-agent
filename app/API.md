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

## Dashboards (verified sites only; 403 otherwise)
| Method | Path | Returns |
|---|---|---|
| GET | /api/orgs/:orgId/sites/:siteId/data/overview | `OverviewData` |
| GET | …/data/search | `SearchData` |
| GET | …/data/rankings | `RankingsData` |
| GET | …/data/content | `ContentData` |
| GET | …/data/technical?auditId= | `TechnicalData` |
| GET | …/data/ai | `AiData` |
| GET | …/data/backlinks | `BacklinksData` |
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

A `ladder` run may carry app-only `ladderPrefs: { mode?: 'auto' | 'manual', first?: boolean }` (the "New keyword ladder" flow; admins
only — a member's are dropped; never sent to n8n). When the run's `ladder_plan` callback arrives with pages planned (`planned` not
false, a valid `ladder_id` whose rows exist), they are applied through the ladder settings: `mode` as `PATCH …/ladders/:id`,
`first: true` moves the new ladder to priority 1 and the others keep their order behind it (one upsert per ladder). Refused plans
(`planned: false`: duplicate or not realistic) change nothing.

A `keyword` run with a website and `receiveContent` is logged in n8n's `seo_content_log` (the Content Cadence skips the keyword for
90 days); when the keyword is a planned page of one of the website's ladders and no `ladder` is given, the server attaches that
ladder page (`ladder` fields, ladder links, row marked `writing`), as "Write now" on the Pipeline page does.

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
| POST | /api/admin/users/reset-link | `{ email }` | `{ url, expiresInHours, name }` — a password reset link to hand over (no e-mails on the platform) |
