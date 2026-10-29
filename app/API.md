# App REST API

All endpoints live under `/api` on the app server (`app/server`). Request and response types are in `app/shared/src` (`api.ts`,
`data.ts`, `schemas.ts`). Sessions are an httpOnly cookie (`sid`); every request that changes something must send the header
`X-Requested-With: fetch` (CSRF guard — the web client's `api()` helper does this). Errors are `{ error, fields?, code? }` with the
HTTP status (400 validation with `fields`, 401 signed out, 402 not enough credits / over a limit, 403 role / unverified, 404, 409 conflict, 502 n8n down).

Roles: `viewer` (read) < `member` (start runs) < `admin` (sites, team, site settings) < `owner` (credit limits, delete company).

## Auth and account
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/auth/providers | | `AuthProviders` |
| POST | /api/auth/signup | `signupSchema` | `Me` (signed in) |
| POST | /api/auth/login | `loginSchema` | `Me`, or `MfaChallenge` (`{ mfaRequired: true, methods, emailHint }`, no session yet) when two-step verification is on |
| POST | /api/auth/logout | | `{ ok }` |
| POST | /api/auth/forgot | `forgotSchema` | `{ ok }` (always, no account enumeration) |
| POST | /api/auth/reset | `resetSchema` | `{ ok }` (signs out every session) |
| POST | /api/auth/verify-email | `{ token }` | `{ ok }` |
| POST | /api/auth/resend-verification | | `{ ok, sent }` |
| GET | /api/auth/google?next=/path | | 302 to Google, back to `/api/auth/google/callback`, then to `next` (or `/login?error=`; `/login/mfa?next=` when a second step is due) |
| GET | /api/me | | `Me`, or `null` when signed out |
| PATCH | /api/me | `updateMeSchema` | `Me` |
| POST | /api/me/password | `changePasswordSchema` | `{ ok }` |

### Two-step verification and step-up (G1, `app/docs/IDENTITY.md`, `shared/src/identity.ts`)
A sign-in with a second factor is two requests: the password (or Google) answers `MfaChallenge` and sets the http-only cookie
`mfa_flow` (path `/api/auth`, 5 minutes); `POST /api/auth/mfa/verify` completes it. 5 wrong codes void the challenge
(`mfa_flow_locked`). A TOTP code is accepted once. Security-relevant changes answer **`403 reauth_required`** with
`methods: StepUpMethod[]` when the session has no proof of presence in the last 10 minutes; `POST /api/auth/step-up` gives one
(5 failures in 15 minutes sign the session out, `stepup_locked`). A company that requires two-step verification answers every
company route with **`403 mfa_enrolment_required`** (no factor yet) or **`403 mfa_verification_required`** (has one, this session
has not used it — `POST /api/auth/step-up` with a factor clears it).

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/auth/mfa | (cookie `mfa_flow`) | `{ methods, emailHint, next }`; 404 `mfa_flow_missing` |
| POST | /api/auth/mfa/webauthn/options | (cookie) | WebAuthn request options for the person's passkeys |
| POST | /api/auth/mfa/verify | `mfaVerifySchema` (`{ method: 'totp' \| 'recovery', code }` or `{ method: 'webauthn', response }`) | `Me & { next, recoveryCodesLeft }` (session created); 401 `mfa_invalid` / `mfa_flow_locked` |
| POST | /api/auth/mfa/cancel | | `{ ok }` |
| GET | /api/auth/step-up | | `{ methods, validUntil }` |
| POST | /api/auth/step-up/webauthn/options | | WebAuthn request options |
| POST | /api/auth/step-up | `stepUpSchema` (a factor, or `{ method: 'password', password }` for people without one) | `{ ok, validUntil }`; 401 `stepup_invalid` / `stepup_locked` |
| GET | /api/me/mfa | | `MfaStatus` |
| POST | /api/me/mfa/totp/start | (step-up) | `TotpEnrolment` (`secret`, `uri`, `qrSvg`) — the secret is kept sealed as pending |
| POST | /api/me/mfa/totp/confirm | `{ code }` | `MfaStatus & { newRecoveryCodes }` (codes only with the first factor; shown once) |
| DELETE | /api/me/mfa/totp | (step-up) | `MfaStatus`; 400 when it is the last factor and a company requires one |
| POST | /api/me/mfa/recovery-codes | (step-up) | `{ newRecoveryCodes }` (the old ones stop working) |
| POST | /api/me/mfa/passkeys/options | (step-up) | WebAuthn creation options |
| POST | /api/me/mfa/passkeys | `{ name, response }` | `MfaStatus & { newRecoveryCodes }` |
| PATCH | /api/me/mfa/passkeys/:id | `{ name }` | `PasskeyView` |
| DELETE | /api/me/mfa/passkeys/:id | (step-up) | `MfaStatus` |
| GET | /api/orgs/:orgId/security | | `SecurityPolicy` |
| PUT | /api/orgs/:orgId/security | `securityPolicySchema` (admin, step-up; switching `requireMfa` on needs your own factor) | `SecurityPolicy` |

`GET /api/orgs/:orgId/members` adds `mfaEnabled` to each member for owners and admins.

### Sessions (G1)
A session records how it signed in (`password` / `google` / `sso`), whether a second factor was used, its device and IP, and the
strictest idle timeout of the person's companies (`SecurityPolicy.idleTimeoutMinutes`, refreshed whenever a policy or a membership
changes). A session idle past it is deleted on its next request (`401 session_idle`, plus a short-lived `signed_out=idle` cookie
for the sign-in page). Activity is written once a minute; requests with `X-Alaventra-Passive: 1` (the web app's polls from a hidden
tab) do not count.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/me/sessions | | `{ items: SessionView[] }` (this device first; `id` is a public id, never the session key) |
| DELETE | /api/me/sessions/:id | | `{ ok, signedOutHere }`; another person's session is a 404 |
| POST | /api/me/sessions/revoke-others | | `{ ok, revoked }` |

### Single sign-on (G1, `server/src/services/sso.ts`, `app/docs/IDENTITY.md` §4)
One connection per company, OIDC (`openid-client`: discovery, code + PKCE + nonce) or SAML 2.0 (`@node-saml/node-saml`: signed
assertions, audience, `InResponseTo` from requests we issued, 2 minutes of clock skew; plus our own issuer, recipient and one-use
assertion checks; IdP-initiated answers are refused). It serves addresses on the company's **DNS-verified** domains only. Owners and
admins configure it; changes need a step-up; making it required is the owner's, needs their own two-step verification, and signs out
every non-owner session on those domains opened without it. Changing the identity provider switches the connection off until a
test passes again.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/sso | (admin) | `SsoOverview` (`domains`, `connection` — never the client secret, `sp` — the values to give the IdP, `secretsReady`) |
| POST | /api/orgs/:orgId/sso/domains | `{ domain }` (admin, step-up; no public mail providers) | `SsoDomainView` with the TXT value; 409 when another company verified it |
| POST | /api/orgs/:orgId/sso/domains/:id/verify | (admin) | `{ domain, verified, message }` (looks for `TXT alaventra-sso=<token>` at the domain) |
| DELETE | /api/orgs/:orgId/sso/domains/:id | (admin, step-up) | `{ ok }` |
| PUT | /api/orgs/:orgId/sso/connection | `ssoConnectionSchema` (admin, step-up; client secret / certificates omitted = keep) | `SsoConnectionView` |
| PATCH | /api/orgs/:orgId/sso/connection | `{ enabled?, enforced? }` (admin, step-up; `enforced` owner only) | `SsoConnectionView`; 400 until a test passed / a domain is verified |
| DELETE | /api/orgs/:orgId/sso/connection | (admin, step-up; owner when enforced) | `{ ok }` |
| POST | /api/orgs/:orgId/sso/connection/test | (admin) | `{ url }` — open it: a real sign-in in test mode, back to `/o/:orgId/settings/sso?test=ok\|failed` |
| POST | /api/sso/discover | `{ email }` | `{ sso, orgName?, url? }` |
| GET | /api/sso/start?email=&next= | | 302 to the identity provider (cookie `sso_flow`, 10 minutes) |
| GET | /api/sso/oidc/callback | (from the IdP) | 302 to `next`, `/login/mfa` or `/login?error=sso_*` |
| POST | /api/sso/saml/:connId/acs | form `SAMLResponse`, `RelayState` (no CSRF header: the IdP posts it) | the same redirects |
| GET | /api/sso/saml/:connId/metadata | | SP metadata XML |

When a company **requires** SSO, `POST /api/auth/login` and `/api/auth/signup` for an address on its domains answer
`403 { code: 'sso_required', ssoUrl }` before any password is checked (owners excepted), and Google sign-in returns
`/login?error=sso_required`. First sign-ins create the account and membership with the default role when JIT is on; the IdP's
`sub` / NameID is remembered so a renamed address finds the same person. If the company does not count its IdP as a second step
(`mfaTrustSso: false`), people with their own factor get the second step (`/login/mfa`).

### SCIM 2.0 provisioning (G1, `server/src/services/scim.ts`, `app/docs/IDENTITY.md` §5)
Base URL `/api/scim/v2`, `Authorization: Bearer scim_…` (one company per token; hashed at rest; 600 requests a minute per token;
never a cookie, no CSRF header). Answers are `application/scim+json`; errors are SCIM errors (`status`, `scimType`, `detail`).
Only addresses on the company's verified SSO domains are provisioned; an existing account with that address is linked, not
duplicated. `active: false` deactivates the membership (every company route answers `403 membership_deactivated`, the company
disappears from `/api/me`, the sessions its IdP opened end); `DELETE` removes the membership (the account stays). The owner is never
deactivated, removed or re-roled. A person's role is the highest role mapped from their groups; with no mapped group, people SCIM
created take the SSO connection's default role and invited people keep theirs.

| Method | Path | Notes |
|---|---|---|
| GET | /ServiceProviderConfig, /ResourceTypes, /Schemas | discovery |
| GET | /Users?filter=&startIndex=&count= | `eq` on `userName`, `externalId`, `emails.value`, `id`; count ≤ 200 |
| POST | /Users | 201; 409 `uniqueness` when already a member; 400 off-domain |
| GET / PUT / PATCH / DELETE | /Users/:id | PATCH: Okta `{ op: replace, value: { active } }`, Entra paths (`active` as "False", `name.givenName`, `emails[type eq "work"].value`, `externalId`); unknown attributes ignored |
| GET | /Groups?filter=&excludedAttributes=members | `eq` on `displayName`, `externalId`, `id` |
| POST | /Groups | members must be members of the company |
| GET / PUT / PATCH / DELETE | /Groups/:id | PATCH members add / remove (`members[value eq "…"]` or a value list) / replace, displayName |

Admin side (session, owners and admins): `GET /api/orgs/:orgId/scim` → `ScimOverview` (base URL, tokens by prefix, groups with
member counts and mapped role, verified domains); `POST …/scim/tokens { name }` (step-up, at most 2 live) → the token once;
`DELETE …/scim/tokens/:id` (step-up); `PATCH …/scim/groups/:id { role: 'admin' | 'member' | 'viewer' | null }` (step-up) re-roles
the group's members at once. `GET /api/orgs/:orgId/members` adds `provisionedBy` and `deactivated`.

### Audit log (G1, `server/src/services/audit.ts`, catalogue `AUDIT_ACTIONS` in `shared/src/identity.ts`)
Append-only per company (a database trigger refuses UPDATE / TRUNCATE and any DELETE but the daily retention purge and the
company's own deletion). Owners and admins only; another company's log is a 404. Each event: `id, at, action, label, category,
outcome, actorType (user / scim / system / platform_admin), actorId, actorLabel, targetType, targetId, targetLabel, ip, userAgent,
details` — details never carry a password, code, token, secret or key (`safeAuditDetails`), and the company never reads a provider
cost or a dollar budget in them (`customerAuditDetails`: keys ending in `Usd` or naming a budget are left out, a
`company.budget_changed` row shows no details; `run.started_via_api` records `quotedCredits`).

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/audit | `category`, `action`, `actor` (user id), `outcome`, `from` / `to` (YYYY-MM-DD, UTC), `before` (cursor), `limit` ≤ 200 | `{ items: AuditEventView[], nextCursor, actors (first page), retentionDays }` |
| GET | /api/orgs/:orgId/audit.csv | the same filters | CSV (UTF-8 with BOM, ≤ 50,000 rows, formula-safe cells); the export is itself an event (`audit.exported`); 10 an hour |

## Companies and team
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /api/orgs | `createOrgSchema` | `Org` (caller becomes owner) |
| GET | /api/orgs/:orgId | | `Org` |
| PATCH | /api/orgs/:orgId | `updateOrgSchema` (admin) | `Org` |
| DELETE | /api/orgs/:orgId | `{ confirm: <company name> }` (owner) | `{ ok }` (stops tracking of its sites in n8n, deletes the company's data in the app) |
| PATCH | /api/orgs/:orgId/onboarding | `{ step, done? }` (admin); `step` is one of `ONBOARDING_STEPS` (shared/src/constants.ts: the wizard's steps in order, `keyword` included, then `done`) | `Org` |
| PATCH | /api/orgs/:orgId/budget | `{ monthlyBudgetUsd }` (**platform admin only**; anyone else 403 "Limits are in Settings → Credits.") | `Org` |
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
| POST | /api/orgs/:orgId/sites | `createSiteSchema` (admin) | `Site` (409 `domain_claimed` when another company verified the domain; 409 `engine_id_taken` when another verified or tracked website's domain differs only in dots and dashes, see "One engine site id" below) |
| GET | /api/orgs/:orgId/sites/:siteId | | `Site` |
| PATCH | /api/orgs/:orgId/sites/:siteId | `updateSiteSchema` (admin) | `Site` |

Keyword-first (2026-10-19): `Site` also carries `timezone` (IANA, `''` = the engine's America/New_York), `services` ("What do you sell?",
up to 30 × 2-80 characters), `cycleWeekday` (0 Sunday - 6, `null` = the weekday tracking started on) and `autopilotLevel` (1 | 2 | 3).
`createSiteSchema` / `updateSiteSchema` accept `timezone` (an unknown zone is a 400) and `services`; both reach the engine with the next
"Track my site" (`mode: 'track'`), which sends them with `tracking_started_at`.
| DELETE | /api/orgs/:orgId/sites/:siteId | (admin) | `{ ok }` (also stops tracking in n8n) |
| GET | /api/orgs/:orgId/sites/:siteId/verification | | `SiteVerificationInfo` |
| POST | /api/orgs/:orgId/sites/:siteId/verify | `verifySiteSchema` (admin) | `VerifyResult`; 409 `engine_id_taken` (as above; a unique index on verified websites settles two verifications at the same moment) |
| GET | /api/orgs/:orgId/sites/:siteId/google | | `GoogleConnection` |
| POST | /api/orgs/:orgId/sites/:siteId/admin | `adminActionSchema` (admin, verified site) | `AdminResult` |
| GET | /api/orgs/:orgId/sites/:siteId/consistency | (viewer) | `{ warnings: Warning[], acknowledged: Warning[] }`: the website's standing warnings (see "Warnings" below) |
| POST | /api/orgs/:orgId/sites/:siteId/consistency/acknowledge | `{ acknowledge: string[] }` (admin) | `{ acknowledged }`: "Continue anyway" on standing warnings, stored on the website (`sites.acknowledged_warnings`), audit `warning.overridden`; 400 when no id is an open warning |
| POST | /api/orgs/:orgId/sites/:siteId/market/sync | (admin, verified; 10 / 10 min) | `{ ok, country }`: the engine measures the website in its main country (Site Admin `market`: `seo_sites` country / location_code / language_code; rank history and past rows stay). 409 `not_tracked` before the first tracking. Audit `site.market_synced` |
| POST | /api/orgs/:orgId/sites/:siteId/ladders/:ladderId/market | (admin, verified; 20 / 10 min) | `{ ok, country }`: the ladder's rows move to the website's main country (history stays). Audit `site.ladder_market_moved` |

**Warnings: Accept or Continue anyway (MKT 2026-10-27, `n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md` §2, `shared/src/consistency.ts`).**
One registry of checks (`CONSISTENCY_CHECKS`) produces `Warning { id, code, severity: money|market|data|cosmetic, tone, title, body,
message, short, confirm?, accept?: { label, change } }`; `change` is `{ kind: 'fields', set }` (resend the request with these fields),
`{ kind: 'call', method, path, body? }` (make this call, then resend) or `{ kind: 'link', tool?, sitePage? }` (the page where the person
corrects it). A write that raises a warning with a `confirm` answers **409 `confirm_needed`** `{ notices, warnings (the same list),
needsAcknowledge }` until each id is either corrected or sent back in `acknowledge` (any body; never a form field). Acknowledged ids are
stored on the run (`input.acknowledged`) or the website, with an audit row `warning.overridden` (codes, ids, values). Where it runs:
every run start (`createRunWithMeta`: the app's `POST /api/orgs/:orgId/runs`, `/api/v1/runs`, MCP `start_run`, proposal approve / swap,
onboarding), `POST .../keywords/assess` (before the paid check), `POST /api/orgs/:orgId/sites` and the site `PATCH` (the description's
markets), `POST .../admin` `ai_prompts` `add` (questions about another market). An automatic start (a level-3 announcement, a research
refresh) never continues past one: the proposal waits for the client with the warning's title as its note. Codes today:
`market.run_country` (M1), `market.engine_drift` / `market.country_change` (M2), `market.ladder_country` (M3), `market.keyword_place` /
`market.keyword_unsupported` (M4), `market.business_text` / `market.domain_ending` / `market.timezone` (M5), `market.research_country`
(M6), `ai.question_place` (M7), `lang.script` (M8) and `pipeline.*` (the forms' duplicate warnings, ids unchanged). A site `PATCH` that
changes the main country of a tracked website moves the engine at once (Site Admin `market`).

The remaining cases (2026-10-27, `shared/src/consistency-more.ts`, same registry, same 409). Runs: `money.new_ladder` (D1: proposal approve
and swap always ask first, with the quote, the ladders it joins and the one it overlaps; Accept sends `ladderMode: "manual"`, which the
approve / swap routes take, members included; never asked of a level-3 automatic start), `money.same_family` (D2: both ladders about ERP,
e-invoicing, CRM or VAT; Accept is a `call` with `instead: true` to `POST .../ladders/:ladderId/keywords`: the call replaces the request,
which is not sent again, and closes the waiting suggestion), `money.page_exists` (D3: a live page of the website already answers the keyword),
`data.page_owned` (D5), `money.watch_dup` (D7, `track`), `pipeline.manual_pages_now` (S6), `content.not_ready` (S8), `data.run_business`
(B1, information), `market.profile_address` (M5, information, `profile`). `POST .../ladders/:ladderId/keywords` (D4): `money.ladder_add_overlap`,
`money.ladder_add_fit`, `money.page_exists`, M4, M8. Settings (`acknowledge` in the body): `POST .../admin` `cadence`
(`pipeline.ladders_stop` S7, `pipeline.writes_nothing` S1, `pipeline.over_pileup` S2, `money.credits_runway` C1) and `monitors`
(`ai.extra_market_same` M7, C1), `PATCH .../automation` (`pipeline.limit_below_active` S3, `pipeline.level3_manual` /
`pipeline.level_drop_system` S4, C1 on a level change), `PATCH .../ladders/:ladderId` (`pipeline.ladder_queued` S5). C1 fires when credits
are enforced and the change leaves under 14 days of credits. Integrations: CMS connection create / `publicUrlTemplate` update
(`data.cms_domain` I1), link-building settings with a new `mailboxId` (`data.mailbox_domain` I2), `POST .../backlinks/import`
(`data.import_other_site` I3), `POST /api/orgs/:orgId/sites` (`data.domain_redirects` I7: one request to `https://<domain>/`, redirects
followed, 5 s; an unreachable address is not judged).

**The AI question panel (G6, 2026-10-18; `n8n/seo-agent/AI_VISIBILITY_SPEC.md` §10).** `action: "ai_prompts"` manages up to 500 questions:
`add` (≤ 500: a question as text, or `{ prompt, persona, cluster, stage: awareness|consideration|decision, market: "SA-en", pinned }` —
what the panel manager's CSV import sends, parsed and checked in the browser by `parseAiPanelCsv`), `edit` (`[{ promptId, prompt?,
persona?, cluster?, stage?, market?, pinned? }]` — new wording is a NEW question and the engine switches the old one off), `remove`
(switch off), `enable` (switch back on; a question the keyword rule refused becomes the owner's own), `pin` / `unpin` (ids or exact
texts, ≤ 500 each). `action: "monitors"` takes `aiPromptsMax` 3–500, `aiPersonas` (≤ 6 buyer roles), `aiMarkets` (≤ 5, `CC-lang`),
`aiPulseMode` (`auto` | `sample` | `full`) and `aiPulsePerWeek` (0 = automatic, 1–6); an empty role or market list is sent to the
engine as a single space so it clears. `GET …/data/ai` adds `segments` (rates per engine / cluster / persona / market / stage and the
cross tables, with `ci`, `enough`, `sov`, `delta` / `significant` from the Benjamini–Hochberg screen) and `panel` (size, setting,
composition, overlap with the previous run, measured and achievable half-widths, executions), and each prompt carries `persona`,
`market`, `pinned` and `fitNote`.
W2-A (2026-10-23, `n8n/seo-agent/docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md` §4): `action: "monitors"` also takes, only when set
(an absent key keeps the engine's default, so no website's cost changes until its owner changes one): `aiClaudeWeekly` (bool),
`aiPulseEngines` (engine keys; empty = today's pulse engines), `aiPersonaContext` (bool, "API answers"), `aiFanoutCheck` (0 \| 25 \| 50
\| 100), `aiSovSet` (≤ 12 entity ids or domains) and `aiAlertRules` (≤ 20 rules `{ id, metric: named_rate \| cited_rate \| share_of_voice
\| visibility_score \| avg_position \| competitor_share, scope: { engine?, cluster?, persona?, market?, competitor? }, direction: drop \| rise
\| any, threshold_points, enabled }`, `aiAlertRulesSchema` in `shared/src/ai-trends.ts`), sent as `ai_claude_weekly`, `ai_pulse_engines`,
`ai_persona_context`, `ai_fanout_check`, `ai_sov_set`, `ai_alert_rules_json`. `action: "ai_prompts"` questions (add and edit) take an
optional `keyword` (the CSV import's keyword column).
| POST | /api/orgs/:orgId/sites/:siteId/ai/indexnow/check | (member, verified site; 20 / 10 min) | `IndexNowCheck` — fetches the site's IndexNow key file (from the latest AI growth run; own host, https) and says whether it is in place. Since 2026-10-28 a member's check is the `indexnow` site task's check (stored, audited); a viewer's answer is not stored |
| POST | /api/orgs/:orgId/sites/:siteId/ai/import | `aiImportSchema` `{ csv, fileName?, source?: '' \| 'bing_ai' \| 'gsc_ai', periodEnd?: 'YYYY-MM-DD', dateOrder?: '' \| 'dmy' \| 'mdy' }` (member, verified site; 16 MB, 20 an hour) — W2-A (2026-10-23): a Bing Webmaster Tools AI Performance export or a Search Console Performance export (Queries / Pages / Dates) filtered to AI features, parsed by `shared/src/ai-import.ts` (columns matched by name; the exact headers are documented there as assumptions), stored in the n8n Data Table `seo_ai_imports` (created with the contract's columns when missing). R-A4: an upsert by site + source + day + url + query in two phases: the new rows go in under a new `import_id` (a failed insert takes only those out again, earlier uploads untouched), then earlier uploads' rows with the same key are removed (`replaced` counts them), so a pages file and a queries file of the same days both stay. R-A5: numeric dates are read day-first or month-first by the whole column, an ambiguous file is refused unless `dateOrder` says which, every day is checked against the calendar, and a file without dates needs `periodEnd` (never today). A file whose page URLs are for another website is a 400 naming it; a file without pages answers its `topQueries` for the owner to check; audit `site.ai_import` (with `replaced`) | `AiImportSummary` |
| POST | /api/orgs/:orgId/sites/:siteId/ai/prompts/delete | `{ ids: string[] }` (admin, verified site; 1–500 ids; 30 / 10 min) — W2-A: deletes questions from the AI panel; only rows of this domain, by domain AND id; stored answers keep their history. R-A7: the row is kept as a tombstone (`status: 'off'`, `origin: 'deleted'`) so the engine's panel writer never writes or asks it again; the app hides tombstones everywhere, and adding the same question as the owner's own brings it back. Audit `site.ai_prompts_deleted` with the count and ids, written even when some writes failed (R-A16: then a 502 says how many were done) | `{ ok, deleted }` |
| POST | /api/orgs/:orgId/sites/:siteId/backlinks/import | `linkImportSchema` `{ csv, fileName? }` (member, verified site; 16 MB, 20 an hour) — v4.10: a Search Console Links export (Latest links / More sample links / Top linking sites) or another tool's backlink CSV, parsed by `shared/src/link-import.ts` into `seo_link_imports` (the same kind replaces the previous upload); 400 with a plain message when the file holds no links to the site | `LinkImportSummary` |

## Crawlers from server logs (gap #6, `docs/LOG_ANALYTICS.md`, `shared/src/crawlers.ts`)
Verified sites only (403 `forbidden` otherwise); another company's website is a 404. Times are UTC days.
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/sites/:siteId/crawlers?days=7\|30\|90 | (viewer) | `CrawlerData` — totals, per-crawler rows (verified / claimed / unchecked / spoofed, statuses, paths, answer time, how it is proved), daily series by kind with impostors apart, coverage against `seo_pages`, crawl budget, new pages, AI fetches for a person, answer times, impostors with their networks, AI crawlers refused, recommendations (`link`: technical / ai / crawler-setup), `setup` (retention, push key prefix and last push, endpoint, header, limits, IP lists with dates and errors) and `ingests` |
| GET | …/crawlers/ingests | (viewer) | `{ items: LogIngestView[] }` (last 50; pushes of the last day only) |
| GET | …/crawlers/export?kind=daily\|pages\|hits&days= | (viewer; 30 / 10 min) | CSV attachment (cells starting with `= + - @` are prefixed with `'`) |
| POST | …/crawlers/upload?name= | raw file body, `application/octet-stream`, plain or gzip (member; 1 GB; 20 an hour) | 202 `LogUploadAccepted` `{ ingest, duplicate: false }` (queued; the worker reads it), 200 with `duplicate: true` for a file already read, 413 too large |
| PUT | …/crawlers/settings | `crawlerSettingsSchema` `{ retentionDays: 7 \| 30 \| 90 }` (admin) | `{ retentionDays }` |
| POST | …/crawlers/push-key | (admin; 10 an hour) | `LogPushKeyCreated` `{ token, prefix, endpoint, header, createdAt }` — the key is returned **once**; a new key replaces the old one |
| DELETE | …/crawlers/push-key | (admin) | `{ ok }` (pushes refused from the next one) |
| DELETE | …/crawlers/data | `{ confirm: <domain> }` (admin) | `{ ok, deleted: { requests, dailyRows, files } }`; 409 while a file is being read |
| POST | /api/ingest/logs/:siteId | header `X-Alaventra-Log-Key: asl_…` (or `Authorization: Bearer asl_…`); NDJSON / JSON array, plain or gzip; no session, no CSRF header; 100 MB; 120 a minute per site | 200 `{ ok, ingestId, duplicate }` (also for a batch already received), 200 `{ ok, empty }` for an empty body, 401 `push_key_invalid` for every refusal (unknown or unverified site, wrong or revoked key), 413 too large |

## Dashboards (verified sites only; 403 otherwise)
| Method | Path | Returns |
|---|---|---|
| GET | /api/orgs/:orgId/sites/:siteId/data/overview | `OverviewData` |
| GET | …/data/search | `SearchData` |
| GET | …/data/rankings | `RankingsData` |
| GET | …/data/content | `ContentData` |
| GET | …/data/technical?auditId= | `TechnicalData` |
| GET | …/data/ai?engine=&cluster=&persona=&market=&stage=&from=&to=&answers=summary | `AiData` (R-A9: `answers=summary` sends `answers: []` (the web pages them through `/data/ai/answers`); without it every answer of the latest run is sent as before, so a web from before the paged answers keeps working; remove after one release. v4.9: `daily` pulse days, `latest.traffic / access / perception / index / stages / clusters`, ranges and score per run; v4.12: `growth` — the AI growth loop's latest run: submissions, key pages, targets, earned media with drafts, entity, actions — and `answers[].citedUrls`). W2-A (2026-10-23): this route no longer sends the answers (`answers: []`); it sends `answerResults` (each question's best result per engine in the latest run) and `answersStored`, and the answers page in from `…/data/ai/answers`. Each run carries `engineRates`, `sov` (`basis` 'set' from `sov_json` or 'all' from `competitors_json`), `ciNamed` / `ciCited` / `ciMethod` (from `ci_json` when stored, else the stored Wilson range); `latest.extras` holds the wave-2 blocks (`urls`, `sources`, `shopping`, `adsLocal`, `ci`, `sov`, `sentiment` withheld under 12, `impact`, `rules`, `fanoutGap`, `demand`, `imports`, `notes`, `execIds`), each null on a row written before it; prompts carry `lastAskedAt` / `lastAskedRun` / `askedN28d` / `refusedAtRun` when the engine stored them. With any filter in the query, `scope` = `{ filter, segment (one dimension set), summary (the latest run's answers in the filter: rates, 95% ranges, enough, top rivals and sources), trend (that segment's rate in every run, from each row's `segments_json`, with `comparable` / `reason`), note }` |
| GET | …/data/ai/answers?run=&engine=&cluster=&persona=&market=&stage=&to=&result=&q=&promptId=&page=&pageSize= | `AiAnswersPage` — W2-A (finishes F3's A10): one page (5–100, default 25) of a run's answers (the latest, the run named, or the newest on or before `to`), each with `detail` (`answerText` when stored, `answerCut`, `citations` in order with `own`, `retrieved` not cited, `fanoutQueries`, `products`, `ads`, `local`, `model`; null fields on older rows) and the question's facets; `summary` = the filtered answers' rates with ranges; `runs` for the run picker; `result` = all \| named \| cited \| absent \| error; 240 a minute. Client portal people read it without cost fields |
| GET | …/data/ai/questions/:promptId | `AiQuestionHistory` — one question's answers on every engine per stored run (newest first; the engine keeps answers about 120 days) and its named rate with a 95% range per run |
| GET | …/data/ai/imports | `{ sources: [{ source, rows, from, to, citations, impressions, clicks, importedAt, fileName }] }` — the AI report uploads so far (not in the client portal) |
| GET | …/data/ai/export?kind=answers\|questions\|sources\|competitors\|pages&<filter> | CSV (`text/csv`, attachment `ai-<kind>-<domain>-<day>.csv`), streamed, built from the same capped reads as the page, columns `AI_EXPORT_COLUMNS` in `shared/src/ai-export.ts`; every cell through `csvCell` (formula injection neutralised); viewer and up, not the client portal; 30 / 10 min |
| GET | …/data/backlinks | `BacklinksData` (v4.10: `refs` = the link ledger with sources, check status and SEO / referral / brand values; `latest.coverage` per source + Google-sample share; `latest.anchors`, `pages`, `wins`, `relChanged`, `compNew`, `lists`; `imports`; `linkGraph`; prospects with score, contact and follow-up drafts; `report.mentions`, `atRisk`, `reclaim`, `drEnabled`) |
| GET | …/data/alerts | `AlertsData` |
| GET | …/data/settings | `SiteSettingsData` |
| GET | …/data/pipeline | `PipelineData` (automations with next/last run, the page queue, growth loop, 4-week calendar, recent automatic runs; for the tool-form notices: `running` schedule executions and cycle jobs, this site's `activeRuns`, `written` pages, `ladders` with their planned pages; keyword-first: `cycle`, `autopilot`) |
| GET | …/data/ladders/:ladderId | `LadderDetail` (one keyword ladder: its card plus every page with its state, position history, run / report, volume / difficulty; the timeline with the coming Mondays; clicks and impressions of its published pages by Search Console period; its plan, rank and page reports; cost so far; 404 when the ladder is not one of this domain's) |
| GET | …/recommendations | `Recommendation[]` |

`PipelineData` fields for the Pipeline home (v4.8, `PIPELINE_FEATURE_SPEC.md` §4.1; rules in `server/src/services/ladders.ts` and `shared/src/ladders.ts`):

| Field | What |
|---|---|
| `ladderCards` | `LadderCard[]` in priority order (settings priority, then oldest first): status (Planning, Writing, Climbing, Won, Paused, Queued beyond 2 active Auto ladders, Stuck, Needs you) with a plain line, page counts by state, main keyword position / change / series, pages in the top 10 / 3, next step with its date, expected months, monthly cost, overlaps with other ladders |
| `needsYou` | `NeedsYouItem[]`, most urgent first: connection (tracking, Search Console, reports delivered elsewhere), pile-up of unpublished pages, pages to publish per ladder (oldest first, opens "I published a page"), failed runs of the last 7 days, ladder plans of the last 7 days that planned nothing (`planned: false`, "See why" opens the run), duplicate / overlapping ladders, the next page of each Manual ladder |
| `thisWeek` | `ThisWeekItem[]`: the schedule runs of the next 7 days in time order (and any running now) with what each touches, e.g. the blog posts with their ladder |
| `summary` | pages published this month, ladder keywords in the top 10, clicks of ladder pages (latest 28-day period), `creditsUsedThisMonth` (credits, autopilot + on-demand); `spendThisMonthUsd` / `budgetUsd` are deprecated (provider cost; `budgetUsd` is 0) and go once no page reads them |
| `automation` | `SiteAutomation`: the website's defaults (`_site` row of `seo_ladder_settings`; without it Auto, opportunities Auto, no auto-start, 2 active ladders, pile-up at 3); changed with `PATCH …/automation` |
| `autoStartEnabled` | keyword proposals are on for the platform (`AUTO_START_LADDERS`, on by default in production, off elsewhere) |
| `cycle` | `SiteCycleView` (below): the website's own weekly cycle, weekday, next due time, the cycle being worked on and the coming cycles |
| `autopilot` | `PipelineAutopilot`: `level` (1-3), `waitingForKeyword` (levels 1-2 with no chosen keyword: nothing is written), `reason` (why the coming cycle writes nothing), `suggestions` (what waits for an OK, each with `itemKey` and `credits`), `refused` (the topic check's refusals with the reason), `dropped` (`{ at, from }` when the auto-pause lowered the level), `notChosen` (ids of Auto ladders whose keyword the client did not choose) |
| `detected` | `DetectedPage[]` (Phase 4, newest first, one per address): written pages the weekly site report found live by itself (`site_tracker` callback `detected_published`) — shown as "We found your page live at …" in the recent activity; such a page counts as published in its ladder (timeline event `published` with `detected: true`) even before n8n's rows say so. Empty until the n8n part is deployed |
| `activeRuns` (ladder) | a ladder run whose plan has not arrived: the Pipeline shows a "Planning your ladder …" card and polls every 30 s until the plan (and the ladder's card) is there |
| `ladders[].keywords` | every page keyword of a ladder (the overlap warning on the ladder form) |
| `queue.next` / `queue.later` | what the website's next cycle writes, then the rest of its queue — computed by the app's mirror of the Content Cadence (`server/src/services/cadence.ts`, same rules as `Cadence_Plan.js`, held to the shared fixture `n8n/seo-agent/harness/fixtures/cadence_levels.json`): ladder pages of the active Auto ladders the client chose, in priority order (at most `maxActiveLadders`, main page after its support, Direct plans main page first, won / paused / Manual ladders skipped), then what the autopilot level writes on its own; nothing before the first chosen keyword at levels 1-2; empty while the pile-up guard holds. Each item has `itemKey`, `auto` and `credits` |
| `queue.suggestions` | what waits for the client's OK, with its price in credits (`aiTarget` carries the question, searches, sources and the companies AI names, for "Write it") |
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
| PATCH | /api/orgs/:orgId/sites/:siteId/automation | `siteAutomationSchema`: `{ autopilotLevel?: 1 \| 2 \| 3, defaultMode?, opportunities?, autoStartLadders?: boolean, maxActiveLadders? (1-5), maxWaiting? (1-10) }` | `SiteAutomation` (with `autopilotLevel`); **503 `engine_not_ready`** when the engine's `seo_ladder_settings` has no `autopilot_level` column yet (nothing is changed, the app's mirror included; the server logs `engine refused autopilot_level: column missing` with the engine's status and message). Deploy order: the engine's `sync_tables.py` (run by `apply_env.py` / the engine release step) must have added the column before this app version serves |
| POST | /api/orgs/:orgId/sites/:siteId/ladders/:ladderId/keywords | `{ keyword }` (2-120 characters) — "Add to my ladder": one more planned supporting page of the ladder (rung 1, after its last page), written by the ladder in turn with its links | `LadderCard`; 404 not one of the website's ladders; 409 `duplicate_keyword` when a page of any ladder of the website is already that search; audited `site.ladder_keyword_added` |

- A ladder row the app creates keeps `mode: ''` unless the person chose one (the website's default mode applies) and `status: 'active'`.
- Priorities: a ladder without a priority that gets a row takes the next number after the existing ones, and so does every ladder
  without a priority ahead of it in the visible order — the order the person sees never jumps.
- `status` is only `active` / `paused` here: `won` comes from the rank tracker (below), `queued` is computed, and `stuck` is never
  written (n8n would stop writing the ladder; it is display-only).

- `autopilotLevel` (keyword-first, plan §5.5): 1 only my keywords, 2 my keywords and keep my pages healthy (default), 3 full autopilot.
  Written to the `_site` row's `autopilot_level` (the engine decides with it) and mirrored on the website; a change is audited
  (`site.autopilot_level_changed`), updates the forecast and moves an open keyword proposal (announced at level 3, a suggestion below).
- `opportunities` and `autoStartLadders` are stored for older screens and decide nothing any more: what runs on its own is the level, and
  keyword proposals (below) replace "Choose keywords for me".

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
| POST | /api/orgs/:orgId/sites/:siteId/keywords/assess | `keywordAssessSchema`: `{ keyword (2-100), country? }` + `acknowledge?` (member; 409 `confirm_needed` for a keyword of another market, another country or another script, before the paid check) | `KeywordCheck` (`result`: `KeywordAssessment` — volume, kd, position, reach, `difficultyForYou`, `planType` incl. `none`, `months`, `fit` 0/1/2/null, `navigational`, `alternatives`, `label`; `cached`, `costUsd`) |

The keyword check calls n8n's Keyword Check (`POST {N8N_BASE_URL}/webhook/seo-keyword-assess`, `X-API-Key`, `X-Forwarded-For: app:<company>`,
45 s timeout; body `{ keyword, country (default: the website's), domain, business (the website's, when set), services (its case
studies' services), existing_keywords (its ladders' main and page keywords) }`). It is paid (DataForSEO, about $0.02-0.05), so in order:
1. the same website, keyword and country answered within 6 hours (`KEYWORD_CHECK.cacheHours`) by the same engine rules (`rules_version`: a hash of the generated fit gate) for the same website context (`context_hash`: business, services, brand names, competitors, ladder keywords) → that stored check, `cached: true`, no call, free;
2. under the company's advisory lock: the same keyword being checked → 409; 30 checks a day per company (UTC, failed ones included) →
   429 `check_limit`; the monthly budget with the $0.05 estimate → 402 `budget`; the platform's daily ceiling → 429; then a `pending`
   row in `keyword_checks` holds the estimate in the budget;
3. n8n's answer: 200 → the row is `done` with the reported `cost_usd`; 400 → 400 with `fields.keyword` / `fields.country`; 429 → 429
   `engine_limit`; 404 (workflow off) / 401 / 403 / not reachable → 502 "… Nothing was charged" (row removed); 502 / timeout / an answer
   without a keyword → 502 "… Try again in a few minutes" (row kept as `failed`, cost 0: counted in the daily limit only, DataForSEO may
   have charged part of it).

Keyword checks count everywhere runs do: the credit check and the company's credits (`services/billing.ts`, settled into the credit
ledger by the cost sync), the platform's dollar guard (`services/spend.ts`), the platform admin list and the platform's daily ceiling.


## The website's cycle, Coming up, keyword proposals, research, feedback (keyword-first, 2026-10-19)

`n8n/seo-agent/docs/SCHEDULING_KEYWORDS_PLAN.md` §4, §5, §14.6; types in `shared/src/cycles.ts` (+ the clock in `shared/src/cycle-clock.ts`);
server `services/cycles.ts`, `comingUp.ts`, `autoStart.ts`, `research.ts`, `autopilot.ts`, routes `routes/autopilot.ts`. Prices are in
credits only (whole credits, rounded up, as runs are quoted); reasons are customer words. Reading: everyone in the company (`viewer` +);
deciding: `member` +; the weekday: `admin` +. Verified websites for every write.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/sites/:siteId/cycle | | `SiteCycleView` |
| PATCH | /api/orgs/:orgId/sites/:siteId/cycle | `cycleWeekdaySchema` `{ weekday: 0-6 }` (admin) | `CycleWeekdayResult` `{ weekday, weekdayName, nextDueAt, timezone }`; 409 `cycle_not_started` before the engine has the website's cycle |
| GET | /api/orgs/:orgId/sites/:siteId/coming-up | | `ComingUpView` |
| POST | /api/orgs/:orgId/sites/:siteId/coming-up/decisions | `comingUpDecisionSchema` `{ itemKey, decision: 'skip' \| 'approve', scope?: 'cycle' \| 'always' }` (member) | `ComingUpDecisionResult` `{ item: ComingUpItem, key }`; 409 `engine_site_conflict` when the engine holds the website's site id for another domain |
| GET | /api/orgs/:orgId/sites/:siteId/keyword-proposals | | `KeywordProposalList` `{ pending, recent, level, enabled }` |
| POST | /api/orgs/:orgId/sites/:siteId/keyword-proposals/:id/approve | (member) | `{ proposal: KeywordProposalView, runId }` |
| POST | /api/orgs/:orgId/sites/:siteId/keyword-proposals/:id/skip | (member) | `{ proposal, next: KeywordProposalView \| null }` |
| POST | /api/orgs/:orgId/sites/:siteId/keyword-proposals/:id/swap | `{ keyword }` (member) | `{ proposal, runId }`; 409 `keyword_not_suitable` with `check` (the `KeywordCheck`, its alternatives) when the typed keyword is not realistic or off topic |
| POST | /api/orgs/:orgId/sites/:siteId/research/start | (member) | `ResearchStartResult` `{ status, runId, startedAt, free, started }`; 409 `research_not_free` with `credits` |
| GET | /api/orgs/:orgId/sites/:siteId/keywords/recommended | | `RecommendedKeywords` plus `status: 'none' \| 'running' \| 'ready'`, `startedAt`, `runId` (the running research) and `freeResearch` (the free research is still available) |
| POST | /api/orgs/:orgId/reports/:reportId/feedback | `contentFeedbackSchema` `{ verdict: 'reject', reason? }` (member) | `ContentFeedbackResult` `{ id, verdict, levelDropped, level }`; 400 when the report is not a written page |

**The cycle** (`GET …/cycle`). Read from the engine's `seo_cycles` row (one per website) and `seo_cycle_jobs` (one per website × cycle ×
job). `known: false` until the engine has the row: the app's own anchor (`sites.trackingStartedAt`) and zone then say when the cycles run
(cycle 0 opened at setup). `status` active | paused | off | not_started; `weekday` / `weekdayName` / `localTime` (06:00) / `monthlyDay`
in the website's `timezone`; `nextDueAt`, `nextPreviewAt` (48 h before; none before cycle 1); `current` and `recent` (`CycleSummary`:
`cycleKey`, local `date`, `monthly`, `cycle0`, `status` running | done | skipped, `jobs`: `CycleJobView[]` in the cycle's order with
`label`, `status` (starting | running | done | skipped | refused | failed | gave_up), `attempts`, `reason` in customer words, `dueAt`,
`startedAt`, `finishedAt`); `upcoming` (`CycleOccurrence[]`: `date`, `at`, `cycle0`, `monthly`, `previewAt`; the first may be due now,
never more than one overdue); `overdue` (more than 24 h late); `canChangeWeekday` (admin +, and only once the engine has the row: `known: true`; before it PATCH answers 409 `cycle_not_started`). A rank-tracking-only website (ladders, no
tracked site) shows its other jobs as skipped with the engine's reason.

**The weekday** (`PATCH …/cycle`) writes ONLY `seo_cycles.cycle_weekday` (the engine recomputes `next_due_at` within 5 minutes with the
same rule) and mirrors it on the website: the next cycle is the chosen weekday at least 3 days after the last one started, at 06:00
local, so two cycles never run days apart. Audited `site.cycle_weekday_changed` (before / after).

**Coming up** (`GET …/coming-up`). The engine's `cycle_preview` callback (48 h before each cycle, nothing written) is kept per cycle
(`cycle_previews`, a re-made plan replaces it). `ComingUpView`: `available` (false before the first plan), `cycleKey`, `cycleDate`,
`scheduledFor`, `receivedAt`, `level`, `pagesPerWeek`, `waitingForKeyword`, `pausedReason` ('' | pileup | site_paused), `reason`,
`items` (written on their own, `auto: true`, and the pages of Manual / not-chosen ladders that wait, `auto: false`), `suggestions`,
`refused`, `autoCredits`, `canDecide`, `closed` (the cycle started: decisions are refused with 409). `ComingUpItem`: `itemKey`,
`keyword`, `source`, `pageType`, `existingPageUrl`, `ladderId`, `rung`, `why`, `auto`, `credits`, `aiTarget` (question, kind, target id,
searches, sources, competitors), `decision` (the newest: a skip beats an approval, as in the engine), `canSkip`, `canApprove`.

**Decisions** write the engine's `seo_skips` (`SkipRow`, key `skipKey(site_id, scope, cycle_key, itemKey)`; the table is created with
its columns if missing): `skip` for this cycle or `always`; `approve` for this cycle only (a needs-OK item is then written in the cycle,
within the pages a week, even before the first keyword; an automatic item cannot be approved: 400). An approval clears an "always skip"
of the same item. The item must be in the plan (400), the plan must exist (404). Audited `site.coming_up_decided`.

**Keyword proposals** (`services/autoStart.ts`; timer every 10 minutes, `AUTO_START_LADDERS`). When a website has room (fewer active Auto
ladders with pages to write than `maxActiveLadders` and none queued: a ladder was won, has no pages left, or there is none yet), the best
recommended keyword (easy or reachable, a plan, no overlap with the ladders, not off topic in a keyword check, never proposed before)
becomes a proposal: at levels 1-2 a suggestion (`startAt: null`) that waits; at level 3 an announcement that starts `PROPOSAL_WAIT_HOURS`
(48) later as `chosen_by: system_announced`, on the owner's behalf, as autopilot spend (an e-mail goes to owners and admins). Research
older than 90 days: level 3 starts a research refresh first (autopilot spend, at most once a week); levels 1-2 get the "Start keyword
research" recommendation. Approve starts it now as `client_picked`; swap checks the typed keyword first (a keyword check, 5 s) and starts
it as `client_typed`; skip means never again for this website and proposes the next one. Never for a paused or credit-paused website,
above `max_active`, or while a ladder run is going (the start waits and says why in `note`). Idempotent by database rules: one open
proposal per website, one proposal per keyword per website, a claim (pending → starting) before any start; a claim with no run after
15 minutes is released (or linked to the run it made). `KeywordProposalView`: `id`, `keyword`, `status` (pending | approved | swapped |
skipped | started | expired | failed), `startAt`, `level`, `why`, `occasion` (room | won | done), `searches`, `difficulty`, `chance`
("Good chance" / "Takes a few months" / "Hard for your website now"), `planType`, `months`, `creditsPerPage`, `runId`, `swappedFor`,
`note`, `createdAt`, `decidedAt`, `decidedBy`. Audited `site.keyword_proposal_decided`.

**Research at setup** (D3). `POST …/research/start` starts the website's keyword research (`mode: discover`, never a page) and it is
free once per website, at setup only: the grant is keyed by the domain (`free_research_grants`), so deleting the website and adding it
again, or adding it in another company, earns no second one; at setup = tracking not started, or started less than 24 h ago. The free
run is quoted at 0 credits (the cost sync never charges a run beyond its quote) and skips the company's own credit and budget checks;
the platform's daily ceiling still applies. The grant is keyed by the **registrable domain** (`registrableDomain`, the engine's rule:
`blog.example.com` and `example.com` share one; a subdomain of a hosting platform such as `a.wixsite.com` is its own; grants stored by
the full domain before 2026-10-20 still count). Only an explicit refusal by the engine (it answered 4xx) gives the grant back; a start
with no answer (the 30 s timeout) or a 5xx keeps it used, because the engine may be running it. Research running → its run
(`started: false`); fresh research on file → `ready`; otherwise 409 `research_not_free` with its price (start it from the keyword
research form, `POST …/runs`). Audited `site.research_started`.

**One engine site id** (`services/engineSite.ts`). The engine stores a website under `site_` + its domain with every non-alphanumeric run
as `-`, so `foo.co.uk` and `foo-co.uk` share `site_foo-co-uk`. The app refuses the second one at create and at verify while the first is
verified or tracked (409 `engine_id_taken`, the other domain never named), and reads or writes an engine row keyed by site id only when it
names this website's domain: `seo_cycles` (a row of another domain is ignored, its weekday never written: the PATCH filter carries the
domain), and the tables with no domain column (`seo_cycle_jobs`, `seo_skips`) only when no `seo_sites` / `seo_cycles` row under the id
names another domain. A `cycle_preview` is kept only with a valid `scheduled_for`, a cycle key of this website and (when it names one) its
domain; the latest plan sorts `scheduled_for DESC NULLS LAST`.

**Proposals that did not start.** An approve, a swap, a due level-3 start or a claim found after a crash whose ladder run the engine did not
take is `failed` with a `note` ("The ladder did not start: the SEO engine did not accept it. It can be proposed again."), never `approved` / `started`; the keyword can
be proposed again until it failed `MAX_FAILED_STARTS` (2) times (the per-keyword unique index skips failed rows, migration 0019). A
level-3 proposal that gets a new start time after a level change is announced again with a new e-mail; the start time is written in the
website's own time zone ("Thursday 22 October at 16:00 (Dubai time)"). Every proposal stores `volume`, `difficultyForYou`, `planType`,
`months`, `why` in `details` (null or '' when the research did not say).

**Deploy order for the F-KW columns (2026-10-20).** Before this app version goes live, the engine's `sync_tables.py` (run by `apply_env.py`
or the engine release step) must have added `seo_ladders.chosen_by`, `seo_ladder_settings.rechecked_at`, `seo_skips.source` and
`seo_skips.ladder_id` (ladder_common.py `LADDER_COLS`, `LADDER_SETTINGS_COLS`, `SKIPS_COLS`). The app writes `rechecked_at` after a passed
fresh check and `source` / `ladder_id` on every "Coming up" approval; n8n refuses a write to a column it does not have, so on an engine
without them a decision answers 502 and a re-check is recorded as failed (and tried again on the next plan) until the columns exist.

**The fresh keyword check of an old plan** (`services/autopilot.ts` `recheckActivated`, plan §5.6, F-KW). A ladder planned more than 60
days ago that never had a page written waits in the Content Cadence for one fresh keyword check. The app runs it for every ladder the
cadence lists in `recheck_ladders` (in a `cycle_preview` or `content_cadence` callback), and for a ladder that was queued in the previous
plan and is written now. A pass writes `rechecked_at` (ISO) on the ladder's `seo_ladder_settings` row, so the next cycle writes its first
page; a fall pauses the ladder and the client is asked (`recheck:<ladderId>` in Needs you). One check per ladder (`ladder_rechecks`); it
runs again only when it failed to run, or when its pass is more than 60 days old. "Coming up" marks those pages `recheck: true` ("Checking
again"; not approvable, the check decides first) and lists `recheckLadders`; its view also carries `approvedNotWritten` (each approval the
cycle does not write, with a customer sentence: `ambiguous` = an older approval that names only a keyword two different pages share) and
`budget` (`pagesPerWeek`, `spent`, `room`, `ladderStartWindow`: ladder starts count from the previous cadence run). A "Coming up" approval
writes the item's `source` and `ladder_id` on its `seo_skips` row, so it approves that page only; a skip names the keyword.
"Not what I wanted" finds the page's content-log row by its request id and keyword (pages of one ladder start share a request id).

**Keyword checks the system starts** (the queued-ladder re-check) act for the company's first active owner (not deactivated, not
suspended), are stored `keyword_checks.automatic = true` (migration 0019) and are filed as the website's autopilot spend (`origin:
schedule`), never the owner's on-demand spend.

**"Not what I wanted"** (`POST /reports/:reportId/feedback`). One rejection per written page (`content_feedback`, unique per report; a
second is answered with the first). A page the autopilot chose on its own (a cadence page, `cad_` run, not a ladder page and not
approved) counts toward the auto-pause: `REJECT_LIMIT` (2) rejections among the last `REJECT_WINDOW` (5) such pages drop the level to 1,
the website records when and from which level (`autopilot.dropped`, a Needs-you item until it is raised again) and owners and admins get
an e-mail. The drop is decided before the rejection is stored and the level is written to the engine first: when the engine refuses the
write the answer is 502 `engine_failed` (or 503 `engine_not_ready`) and nothing is kept, so a retry decides again. Audited
`site.content_rejected` and `site.autopilot_paused`. The nudge: at level 1, 5 published or approved pages offer
level 2 (a Needs-you item, never switched automatically).

**Needs you** (in `PipelineData.needsYou`, kinds added): `keyword` (`keyword:first` "Choose the keyword you want to be found for" while
waiting; `keyword:next` when every ladder is won or has no pages left), `proposal` (`proposal:<id>`), `recheck` (`recheck:<ladderId>`:
a queued ladder planned more than `QUEUED_RECHECK_DAYS` (60) ago got one fresh keyword check when it became active and was paused
because its verdict fell: not realistic now, or off topic), `level` (`level:dropped`, `level:nudge`).

**E-mails** (the account mailer, branded, plain text and HTML, a white-label agency's sender for its clients): the weekly "Coming up"
(once per cycle, to owners and admins: what is written on its own and what waits, in credits), each level-3 announcement, the auto-pause.

## Runs, reports, files
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /api/orgs/:orgId/runs | `RunInput` (member; one schema per `mode`, see `RUN_SCHEMAS`) | `Run` (status `accepted`, or `failed` with `error`) |

Keyword-first fields (§14.5): `track` takes `timezone` (IANA; 400 when unknown) and `services` (replace the stored list); the server adds
`tracking_started_at` (the website's first tracking, kept on every re-save: the anchor of its weekly cycle, which the engine creates
itself; the app never calls the Site Kickoff). `ladder` takes `chosenBy` (`client_typed` default, `client_picked`; `system_announced` only
from the server's announcement) and `ladderMode` (`auto` | `manual`; a Manual ladder writes nothing at start; admins only, defaults to
the flow's `ladderPrefs.mode`). `discover` never asks for a page (`receiveContent` is accepted and stored false).
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
`X-Alaventra-Signature: sha256=<hmac over "<timestamp>.<body>">` and `X-Alaventra-Timestamp`). The signing secret is sealed with
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

### Credits (2026-10-19, `app/docs/CREDITS.md`, `shared/src/billing.ts`)

Customers see **credits**, never what work costs at the providers: no dollar figure of provider cost, no Claude / DataForSEO split and
no engine cost-basis text in any answer of this API, the read / write API v1, MCP, webhooks, exports or audit log. Dollars appear only
in pack prices (`BillingOverview.packs`, purchase requests) and under `/api/admin/*`. Google Ads CPC in keyword data (`cpc`) is
keyword data and stays.

| Method | Path | Who | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/billing | viewer + | `BillingOverview` — balance, held, kept for autopilot, available, status and runway, this month autopilot vs on-demand, per-website forecast, usage by feature / day, lots with expiry, packs, requests, limits |
| GET | /api/orgs/:orgId/billing/activity?origin=all\|autopilot\|on_demand\|account&cursor=&limit= | viewer + | `CreditActivityPage` (`rows: CreditActivityRow[]`, `nextCursor`) |
| GET | /api/orgs/:orgId/billing/activity.csv | admin + | the same rows as CSV |
| PUT | /api/orgs/:orgId/billing/limits | owner | `CreditLimits` `{ onDemandMonthly, autopilotMonthly, reserveForAutopilot }` |
| POST | /api/orgs/:orgId/billing/requests | admin + | `{ packId, note }` → a pack request (at most 3 waiting) |
| DELETE | /api/orgs/:orgId/billing/requests/:id | admin + | cancels a waiting request |
| GET | /api/orgs/:orgId/billing/invoices/:invoiceId/pdf | viewer + | the invoice as a PDF (the company's own only; the list is `BillingOverview.invoices`) |
| GET | /api/orgs/:orgId/costs | viewer + | the cost table plus `creditRate` (credits per unit of its figures) — what the forms turn into quotes |

**A run** (`Run.credits`, `RunV1.credits`, `RunCredits` in `shared/src/api.ts`): `{ quoted, charged, state, capped }` —
`quoted` the whole credits it was quoted at start (`runs.quoted_credits`; an older run is quoted from its estimate, same rounding);
`charged` = −Σ the company's ledger `usage` entries with `ref.runId` = the run (a failed run's `failed:<run id>` return included),
null before any; `capped` when an entry recorded `ref.absorbed` (it used more than its quote and was charged the quote); `state`:
`free` (costs nothing), `held` (submitting / accepted / running — its quote is held), `charged` (completed and charged),
`not_charged` (failed — nothing is charged), `quoted` (finished, the charge not settled yet; the cost sync runs every 10 minutes).
A page of runs reads the ledger once. **Removed from `Run`:** `estimatedCostUsd`, `actualCostUsd`, `engineCostEstimateUsd`,
`engineCostBasis`, `actualCostEstimated`, `actualCostPartial` (the database keeps them; the admin panel's `AdminRunRow` shows them).

**A run's error** as every customer reads it (`Run.error`, `RunV1.error`, webhooks, the runs export, "Needs you"): a text naming a
dollar amount, USD, DataForSEO, Claude, Anthropic or the search-data account (e.g. the engine's `account_low` refusal) reads "This
analysis could not start right now because of a temporary capacity limit. It was not charged. Please try again later."
(`server/src/lib/customerError.ts`); the raw text stays in `runs.error` for the admin panel.

**A report payload** served to a customer (`GET /api/orgs/:orgId/reports/:reportId`, `GET /api/v1/reports/:reportId`) goes through
`customerSafePayload` (`shared/src/agency.ts`): every cost / ledger / budget / price / balance key at any depth (`run_ledger`,
`cost_usd`, `*_usd`, `run_cost_estimate_*`, `cost_basis`, `by_node`, `ai_nodes`, `ai_cost*`, `dataforseo_*`, `dfs_*`) is removed —
`cpc`, `cpc_usd` and `primary_cpc` are kept — and `credits_used` (the run's charged credits; for a schedule's report, the usage entries
of the engine execution that wrote it; null when unknown) and `credits_state` (as above, null when unknown) are added. A client person
gets the same strip without the credits. The stored payload is untouched.

**Dashboards:** `AiRun.credits` and `BacklinkSnapshot.credits` (the run's cost at the platform's credit settings); their `costUsd`
is deprecated and goes once no page reads it. `KeywordCheck.costUsd` is still sent (the web shows it in credits).

**Org:** `monthlyBudgetUsd` is 0 for everyone but a platform admin (it is the platform's own guard in provider cost). `GET
/api/orgs/:orgId/usage` and its `Usage` type were removed (the Credits page replaces them).

### Cost figures (B-R3, `shared/src/cost.ts`)

One table of per-mode prices, mirroring the engine's calibrated defaults (`n8n/seo-agent/v5/code/_cost_cal.js`). `MODES[].costUsd`
and `estimateRunCost()` both read it, so the mode list, the forms and the budget cannot disagree. **The engine's figure wins**:
`runCostEstimate()` prefers `actualCostUsd` (what the run reported spending), then `engineCostEstimateUsd`
(`run_cost_estimate_usd` on a callback, with `run_cost_estimate_basis`), then the app's table — and every figure is shown with which
of the three it is. `ledgerCost` now counts the model calls (`run_ledger.ai_usd` / `ai_cost.usd`) as well as the search data, and
carries `estimated` when any part of it is the engine's own estimate. The platform's dollar guard counts a run at the same
`coalesce(actual, engine, app)`, so a finished run stops being held against it at what was reserved for it. These are provider-cost
figures: the app turns them into credits before a customer sees them (above), and only `/api/admin/*` answers them in dollars.

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
1. **Read-only unless a write permission was chosen.** Every read endpoint is a `GET`; `POST /api/v1/publish-check` writes nothing and
   costs nothing. Since G4 (2026-10-17) a key created with the **`run`** permission can start analyses (`POST /api/v1/runs`) and push
   findings to the company's issue tracker, and one with **`admin`** can manage event webhooks and start exports — "Write API" below.
   A key never changes a setting, lists members or reads another company.
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
(`asc_` + 8 characters), its name, scopes (`read`, `publish_check`, `run`, `admin` — G4), creator, optional expiry (30 / 90 / 365 days or none), last use
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
| GET | /api/v1/websites/:websiteId/ai-visibility?engine=&cluster=&persona=&market=&stage=&from=&to= | W2-A (2026-10-23): the latest AI visibility run (named / cited rates with their 95% ranges and the method, share of voice, score, the comparison with the previous run, credits charged) and each engine, share of voice per brand, and when the run has them: `pages` (cited, retrieved, retrieved but not cited with the page cited instead), `sources` (types, domains, half-life), `shopping`, `adsAndLocal`, `sentiment` (R-A2: `validated`, `status` withheld / early_reading / validated, `label` "Early reading, not yet validated", the engine's `note`, `kappa` (the model's, null until measured); objections only once validated; withheld under 12), `impact` ("likely helped" / "can't tell" / "likely hurt" with control and interval), `rules` (owner alert rules evaluated), `fanoutGaps`, `demand` (each proxy named), `imports` (R-A10: `{period, sources[{source, rows, from, to, citations, impressions, clicks, urlsN, queriesN, topUrls, topQueries, files, importedAt}], copilot: {citations, impressions, urlsN, asOf, label, note} | null, note}`, `from` / `to` = the days present in the uploads); `runs` = every stored run's headline with its range and `comparable` / `reason`; with a filter, `scope` as on the AI page. Never a cost. MCP tool `get_ai_visibility` |
| GET | /api/v1/websites/:websiteId/ai-answers?run=&engine=&cluster=&persona=&market=&stage=&result=&q=&promptId=&page=&pageSize= | W2-A: one page of a run's answers (`AiAnswersPage`, as `…/data/ai/answers`): the whole answer when stored, brands in order, our place, citations in order with ours marked, retrieved-not-cited pages, fan-out searches, product / ad / local cards, the model; the filtered answers' rates with ranges. MCP tool `list_ai_answers` |
| GET | /api/v1/websites/:websiteId/ai-segments?dimension= | G6: the latest weekly AI visibility run per segment — `segments` (dim, key, questions, answers `n`, named `k`, `rate`, 95% `ci`, `enough` at 12+ answers, `sov`, `leader`, `delta`, `significant`), the Benjamini–Hochberg `family`, `moves`, the `panel` it was measured on and the question counts (tracked / refused / off); `dimension` = engine \| cluster \| persona \| market \| stage \| `cluster x persona` \| `engine x cluster` \| `market x cluster`; verified websites only |
| GET | /api/v1/websites/:websiteId/crawlers?days=7\|30\|90 | `CrawlerData` — what search and AI crawlers requested, from the site's own logs (gap #6, `docs/LOG_ANALYTICS.md`): the same answer as the app's Crawlers page; verified websites only (403 `website_unverified`) |
| GET | /api/v1/runs?websiteId=&status=&mode= | `Page<RunV1>` — `{ id, websiteId, mode, title, status, error, createdAt, completedAt, reportCount, credits: RunCredits }` (see "Credits" below; `cost` was removed 2026-10-19) |
| GET | /api/v1/runs/:runId | `{ run: RunV1 & { input }, reports: ReportV1[] }` |
| GET | /api/v1/reports?websiteId=&stage= | `Page<ReportV1>` — `{ id, runId, websiteId, stage, status, title, summary, receivedAt, scheduled, ready: { ok, code, reason }, files }` |
| GET | /api/v1/reports/:reportId | `ReportV1 & { payload }` (the callback as the app's report page renders it: every provider-cost key removed, plus `credits_used` / `credits_state` — see "Credits") |
| GET | /api/v1/files/:fileId | the file, with the same headers and sandbox as the app's file route |
| POST | /api/v1/publish-check | B3-7, below (scope `publish_check`) |
| GET | /api/v1/modes | G4: every mode with `{ mode, title, description, websiteRequired, delivers, estimate: { credits, minutes }, inputSchema }` (the form's schema as JSON Schema; `credits` = a default run's quote) |
| POST | /api/v1/runs | G4: start an analysis (scope `run`) — "Write API" below |
| POST | /api/v1/mcp | MCP over Streamable HTTP (JSON answers, no streams; API key only): `initialize`, `tools/list`, `tools/call`, `ping` — tools `list_websites`, `list_audits`, `get_audit`, `get_crawler_activity`, `get_ai_visibility_segments` (G6), `list_runs`, `get_run`, `list_reports`, `get_report`, `publish_check`, `list_modes`, `get_table`, and with scope `run` `preview_run` / `start_run` (G4), each calling the handler of the REST route above. `tools/list` shows only the tools the key may call |

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
warnings[], advice[], checks, fixed_markdown, auto_fixes[], schema_types[], not_checked[{ check, reason }], basis, writes: 'none' }`
(the engine's `cost_usd` is not passed on; the check uses no credits). n8n's 400 is passed on as 400 `{ ok: false, verdict: 'error', exit_code: 2, error, errors[] }`; n8n down or the
workflow off is 502 `engine_unavailable` ("nothing was checked"). `exit_code` is meant for a CI step: 0 publish, 1 do not, 2 the
request was wrong.

### Write API — start any analysis a form can start (G4, `app/docs/INTEGRATIONS.md` §4)

`POST /api/v1/runs` — a key with the **`run`** permission (or a member's session with `X-Org-Id`). The body is **the body the app's
form posts** (`shared/src/schemas.ts` `RUN_SCHEMAS`, chosen by `mode`; `GET /api/v1/modes` lists every mode's fields as JSON Schema),
with `websiteId` accepted for `siteId` and the website's country filled in when `country` is left out, plus two fields of its own:

- `acknowledge: string[]` — ids of the duplicate warnings the caller accepts;
- `dryRun: true` — answer the quote in credits, the warnings and the credit check, start nothing.

Every start runs the **app's own run path** (`createRunWithMeta`): the company's advisory lock, the credit check (402 `credits` with
`reason` balance / reserve / on_demand_limit; a company without credit enforcement: the platform's own guard, 402 `budget`), the
platform's daily ceiling (429 `platform_capacity`), the engine's front door, the ladder-page and tracking bookkeeping. The forms'
duplicate warnings (`pipelineNotices`: the same run already going, a page already written for the keyword, a ladder for the same
search, the schedule doing it anyway…) are computed on the server from the same pipeline data; one the form asks a person to tick is
**409 `confirm_needed`** until its id is in `acknowledge`. 30 starts a minute per key (the form route's limit), 120 requests a minute.

A key acts as **the person who created it**: the run is theirs (with "via API key <name>" on the run page, `runs.api_key_id`), and it
is refused with 403 `key_owner_gone` once that person is no longer a member (`run`) or an admin (`admin`).

**`Idempotency-Key`** header (1-200 of `A-Za-z0-9_.:-`, e.g. a UUID): a repeat within 24 hours answers the **same run** (200,
`idempotent-replayed: true`) and starts nothing; the same key with a different request is 422 `idempotency_mismatch`. Checked under
the company lock, before the budget, so two concurrent repeats cannot both start.

| Answer | When | Body |
|---|---|---|
| 201 | started | `{ run: RunV1 & { input }, notices }` |
| 200 | `dryRun`, or a replay | `{ dryRun: true, mode, estimate: { credits, minutes }, notices, needsAcknowledge, credits: { enforced, needed, available, held, reserved, enough, reason } }` / the run |
| 400 | `validation` (with `fields`, the forms' messages) | |
| 402 / 429 | `credits` / `budget` / `platform_capacity` / `rate_limited` | |
| 403 | `scope_missing`, `key_owner_gone`, `website_unverified` (`forbidden`) | |
| 404 | the website is not this company's | |
| 409 | `confirm_needed` | `{ notices: Warning[], warnings: Warning[], needsAcknowledge: string[] }` (the duplicate warnings and the market checks, "Warnings" above) |
| 422 | `idempotency_mismatch` | |

The run row exists even when the engine refuses at the door (status `failed` with the engine's sentence), exactly as in the app; poll
`GET /api/v1/runs/:runId` or subscribe to `run.completed` / `run.failed` (event webhooks, below).
R-A3 (2026-10-23): an AI visibility check started while the website's own AI run is open is closed as status **`joined`** (not a
failure: no `run.failed` event, nothing charged, `error: null`, the engine's sentence in `note`); `GET /api/v1/runs/:runId` (and the
app's `GET /api/orgs/:orgId/runs/:runId`) add `joined: {openRunId, expectedFinish, reportId, reportTitle, receivedAt}`, with `reportId`
set once the open run's AI visibility report has arrived. A check the engine answers with the week it already stored (callback reason
`already_measured`: a re-check within 20 hours of a finished week, or a retry of the same cycle job) is closed the same way, with
`lastStage: 'already_measured'`, the note "Already measured today: showing the stored week. ..." and `joined.openRunId` = the stored run.
`?status=joined` filters them. A share of voice or named rate the engine could not measure is `null` everywhere (never 0). Clients that switch on status should treat
`joined` as a closed state.

```bash
KEY=asc_...   # Company settings -> API access, with "Start analyses"
# what would it be quoted in credits, and does it duplicate anything?
curl -s https://app.example.com/api/v1/runs -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"mode":"audit","websiteId":"<website id>","reportType":"site_audit","dryRun":true}'
# start it (safe to retry with the same key)
curl -s https://app.example.com/api/v1/runs -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" -d '{"mode":"audit","websiteId":"<website id>","reportType":"site_audit"}'
# a page for one keyword, accepting the "a page for this keyword is already written" warning by its id
curl -s https://app.example.com/api/v1/runs -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"mode":"keyword","websiteId":"<id>","keyword":"e invoicing uae","receiveContent":true,"acknowledge":["written:e invoicing uae"]}'
curl -s https://app.example.com/api/v1/runs/<run id> -H "Authorization: Bearer $KEY"
```

### Connecting an AI assistant (MCP)

The endpoint is `POST <APP_URL>/api/v1/mcp` with `Authorization: Bearer asc_…`. A read-only key gives the read tools; a key with
`run` adds `preview_run` and `start_run` (whose instructions tell the assistant to preview first and never to acknowledge a warning
the user has not seen).

- **Claude Code**: `claude mcp add --transport http alaventra https://app.example.com/api/v1/mcp --header "Authorization: Bearer asc_..."`
- **Claude Desktop** (`claude_desktop_config.json`, through the `mcp-remote` bridge, which forwards the header):
  ```json
  { "mcpServers": { "alaventra": { "command": "npx",
      "args": ["-y", "mcp-remote", "https://app.example.com/api/v1/mcp", "--header", "Authorization:${ALAVENTRA_AUTH}"],
      "env": { "ALAVENTRA_AUTH": "Bearer asc_..." } } } }
  ```
- **OpenAI (Responses API / Agents SDK)**: `tools: [{ "type": "mcp", "server_label": "alaventra", "server_url": "https://app.example.com/api/v1/mcp",
  "headers": { "Authorization": "Bearer asc_..." }, "require_approval": "always" }]`. ChatGPT's own in-app custom connectors accept
  only OAuth or no authentication, so a company key cannot be pasted there today; use the API, or a read-only key behind your own proxy.

## Integrations (G4, `app/docs/INTEGRATIONS.md`) — Company settings → Integrations

Every route below is **admin** (session, `X-Requested-With: fetch`) unless marked. Secrets (webhook URLs, signing secrets, tracker
tokens, storage keys, service-account JSON) are sealed with AES-256-GCM under `MAILBOX_KEY`; without it every connect answers 400
`secrets_unavailable`. No answer ever carries a secret: `urlHost` + `urlHint` (last 4), `secretHint` ("token …a1b2"), `hasSecret`.
Every outbound request goes through the connect-time SSRF guard (`lib/netGuard.ts`).

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/integrations | | `IntegrationsOverview` `{ secretsReady, appUrl, endpoints, deliveries, integrations, exportRuns, issues }` |

### Event webhooks (signed JSON, Slack, Microsoft Teams)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/orgs/:orgId/webhooks | | `{ items: WebhookEndpointView[], deliveries: WebhookDeliveryView[] }` (the last 50) |
| POST | /api/orgs/:orgId/webhooks | `webhookEndpointSchema` `{ name, format: json \| slack \| teams, url, events[], websiteIds?, enabled? }` (20 an hour) | `{ endpoint, secret }` — `secret` (`whsec_…`, json only) is returned **once** |
| PATCH | /api/orgs/:orgId/webhooks/:id | `{ name?, events?, websiteIds?, enabled? }` | `WebhookEndpointView` (re-enabling clears `disabledReason` and the failure count) |
| DELETE | /api/orgs/:orgId/webhooks/:id | | `{ deleted: true }` (its log goes with it) |
| POST | /api/orgs/:orgId/webhooks/:id/test | | `{ ok, status, error }` — a test event, sent now, not queued |
| POST | /api/orgs/:orgId/webhooks/:id/rotate-secret | | `{ endpoint, secret }` (json only) |
| POST | /api/orgs/:orgId/webhook-deliveries/:id/redeliver | | the delivery after one more attempt (same delivery id) |
| GET / POST | /api/v1/webhooks | key with **`admin`** | the same list / create |
| DELETE | /api/v1/webhooks/:id · POST /api/v1/webhooks/:id/test | key with `admin` | |

Address rules: https on a public host (`webhookUrlOk`); `slack` must be `https://hooks.slack.com/services|workflows|triggers/…`;
`teams` a Workflows address (`*.logic.azure.com`, `*.powerplatform.com`) or an older connector (`*.webhook.office.com`). At most 10
endpoints a company; `websiteIds` must be the company's own (empty = every website).

**Events** (`WEBHOOK_EVENTS`): `run.completed`, `run.failed`, `report.ready`, `report.held`, `alert.raised`, `audit.finding.new`,
`rank.changed` — derived in the app from the callback it just stored (`eventsFor`, `shared/src/integrations.ts`), plus `run.failed`
when the engine refuses at the door, its execution fails, or the run expires. `run.completed` / `run.failed` carry `data.run` =
`{ id, websiteId, mode, title, status, error, createdAt, completedAt, credits: { quoted, charged, state }, url }` — credits, never a
cost (`costUsd` was removed 2026-10-19; `charged` is usually still null on `run.completed`, the charge settles within ~10 minutes), and
the customer's error sentence (see "Credits"). Signed-JSON body (Slack and Teams get their own format, `slackMessage` / `teamsMessage`):

```json
{ "id": "6c0e…", "type": "rank.changed", "createdAt": "2026-10-17T08:00:00.000Z",
  "company": { "id": "…", "name": "Northwind" }, "website": { "id": "…", "domain": "northwind.example" },
  "data": { "ladder": { "id": "lad_…", "head": "e invoicing uae" },
            "gains": [{ "keyword": "peppol uae", "position": 4, "previous": 12, "delta": 8, "url": null }], "drops": [],
            "report": { "id": "…", "title": "…", "stage": "rank_tracker", "url": "https://app…/o/…/reports/…" } } }
```

Headers: `X-Alaventra-Event`, `X-Alaventra-Delivery` (stable across retries — de-duplicate on it), `X-Alaventra-Timestamp` (ms) and, for
signed JSON, `X-Alaventra-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with the endpoint's secret>` — the scheme
report delivery uses. Verify it, and refuse a timestamp older than 5 minutes:

```js
const ok = 'sha256=' + crypto.createHmac('sha256', secret).update(`${req.headers['x-alaventra-timestamp']}.${rawBody}`).digest('hex');
if (!crypto.timingSafeEqual(Buffer.from(ok), Buffer.from(req.headers['x-alaventra-signature'] || ''))) return res.status(401).end();
```

**Delivery.** 10-second timeout; a 2xx is delivered. Otherwise retried after 1, 5, 30, 120 and 720 minutes, then `gave_up`; a 410 is
given up at once and switches the endpoint off ("the address was removed on their side"); 25 failures in a row switch it off with the
reason. The log (`webhook_deliveries`, also the queue) keeps 30 days. **Channel routing** for Slack / Teams = one endpoint per
channel, each with its own events and websites (e.g. `#seo-alerts` ← `alert.raised` + `run.failed`, `#seo-wins` ← `rank.changed`).

## Publishing to the customer's CMS (G2, `app/docs/CMS_PUBLISHING.md`, `shared/src/cms.ts`)
Connections belong to one verified website; secrets are sealed under `MAILBOX_KEY` and never returned (`hasSecret` only).
- `GET /api/orgs/:orgId/sites/:siteId/cms/connections` (viewer) → `{ items: CmsConnectionView[] }`.
- `POST …/cms/connections` (admin, 10/min) — `{ kind: 'wordpress', baseUrl, username, secret, postType?, categories?, tags?, publicUrlTemplate?, label? }`
  | `{ kind: 'webflow', secret, collectionId, fieldMap?, … }` | `{ kind: 'contentful', secret, spaceId, environment?, contentTypeId, fieldMap?, … }`
  | `{ kind: 'webhook', baseUrl, … }` → `{ connection, signingSecret? }` (the webhook's secret, **once**). `baseUrl` must be `https://` on a
  public host (`cmsUrlOk`); every request is pinned to public IPs, redirects are not followed. 400 `secrets_unavailable` without `MAILBOX_KEY`.
  At most 5 per website.
- `PATCH …/cms/connections/:id` (admin) — any field of its own kind; `secret` left out keeps it; `fieldMap` is checked against the fields the
  last test read (`fieldMapProblems`, 400 with `fields.fieldMap`). Changing an address, id or secret sets `status: 'untested'`.
- `DELETE …/cms/connections/:id` (admin) — the items go, the publishing history stays.
- `POST …/cms/connections/:id/test` (admin, 10/min) → `{ ok, message, connection }`; stores the status and what the CMS offers (WordPress user,
  capabilities, Yoast / Rank Math fields; Webflow collection fields; Contentful content type fields and default locale).
- `GET /api/orgs/:orgId/sites/:siteId/cms/state` (viewer) → `{ connections, items, recent }` (Content page).
- `GET /api/orgs/:orgId/reports/:reportId/cms` (viewer) → `CmsReportState`: `readiness` (`draftAllowed`, `liveAllowed`, `blockers[]` with codes
  `not_a_page | not_ready | not_publishable | placeholders | no_title | no_slug | other_domain | no_website`, `warnings`, `liveRefusal`),
  `canDraft` / `canLive` for this person, the connections, this page's items, its history, `publicUrls` per connection.
- `POST /api/orgs/:orgId/reports/:reportId/cms/publish` (member for `mode: 'draft'`; **admin and `confirmLive: true`** for `mode: 'live'` —
  403 / 400 `confirm_live` otherwise; 10/min) `{ connectionId, mode, confirmLive }` → `CmsPublishResult { ok, record, item, engine }`. A blocked page
  answers `ok: false` with `record.status: 'blocked'` and the blockers (nothing reaches the CMS; there is no override). An item already **live**
  in the CMS is refused as a draft (it would change the live page). Re-sending updates the same CMS item (stored per connection × slug; an item
  the CMS already has under the slug is adopted). 409 `cms_busy` while another send of the same item runs. When the page is live the app starts
  the engine's `published` run with the live address (on the website's domain) — `engine.runId`.
- `POST /api/orgs/:orgId/reports/:reportId/cms/refresh` (member) `{ connectionId }` — asks the CMS whether the item is live now; the first time it is,
  the engine's `published` run starts.
- Pipeline: a `publish` Needs-you item says when a draft is already in the CMS and, with a connection, its action is `{ label, reportId }`.

## Site tasks: steps on the client's own website (2026-10-28; `shared/src/site-tasks.ts`, `server/src/services/siteTasks.ts`, `docs/SITE_TASKS.md`)
The changes only the client can make on their website, each with a check the app runs itself (own host and `www.`, https, SSRF guard):
`indexnow` (the key file answers 200 with only the key), `ai_crawlers` (robots.txt, read with the engine's own matcher, lets every AI answer
crawler the engine found blocked read `/` and the key pages; 404 = allowed, 5xx = not done), `redirect:<host/path>` (the broken page another
site links to answers a permanent 301 / 308 to a page of the site that answers 200, or answers 200 itself; a 302 / 307 is not done; read
from the latest FULL backlink report only, and our own fetch beats the index unless the index is more than a week newer). A step's
state (`todo` / `done` / `skipped`, `reopened`) is decided by the **newest reading**: the engine's weekly / monthly run or the app's own check
(`by`: `you`, `daily`, `weekly`, `monthly`). Rows in `site_tasks` (migration 0024) keep the values a check needs, the app's last check, when it
was last done and a skip; a website with no row still shows its steps (derived from the engine's data). Verified websites only (403 otherwise).
- `GET /api/orgs/:orgId/sites/:siteId/tasks` (viewer) → `{ tasks: SiteTask[] }` (to do first, important ones first; then done; then skipped).
  Also in `GET …/data/pipeline` as `siteTasks`, and every step to do is a Needs-you item (`kind: 'site_task'`, id `task:<key>`).
- `POST …/tasks/check` (member, 30 / 10 min per person) `{ key }` → `{ task }`: runs the step's check now, stores it (`by: 'you'`, `who`),
  audit `site_task.checked` (outcome failure when not done). 404 for a key the website does not have, 400 for a skipped step, 503
  `site_unreachable` when the website did not answer at all (nothing is recorded).
- `POST …/tasks/skip` / `POST …/tasks/restore` (member) `{ key }` → `{ task }`; audit `site_task.skipped` / `site_task.restored`.
- Recommendations: `ai:indexnow` and `bl:reclaim:*` are left out once their step is done or skipped and carry `taskKey` while open;
  `ai:crawlers` is new (a blocked AI answer crawler).
- Background (`SITE_TASK_JOBS`, default on, every 30 minutes): stores the steps of up to 5 tracked websites a tick that nobody opened in a
  day (and on every `ai_growth` / `ai_visibility` / `backlinks` callback), then checks up to 60 stored steps whose last check is a day old.
  A website that does not answer changes nothing; a done step found missing is looked at again an hour later and reopened only on the
  second miss.

## Index coverage: which pages Google left out, why, and what to do (2026-10-29; `shared/src/indexing.ts`, `server/src/services/indexing.ts`, `n8n/seo-agent/docs/indexing-2026-10-29/DESIGN.md`)
Read only: the engine's daily index check (`SEOagentIndexCv1`, free, Google data only) writes the n8n Data Tables `seo_index_pages`,
`seo_index_history`, `seo_index_runs`, `seo_google_events` and `seo_update_impact`; the app reads them by the engine's site id (rows of
another domain that shares the id are dropped). Viewer and up, verified websites only (403 otherwise), not in the client portal. A read
that fails answers `status: 'unreadable'` with a sentence, never an error, and never touches another page.
- `GET /api/orgs/:orgId/sites/:siteId/data/indexing` (120 / 10 min per person) → `IndexingData`: `status` (`ok` / `empty` / `failed` = every
  run so far could not read Search Console and no page is known / `unreadable`), `settings` (`on`, `dailyCap`), `checkedAt` (the newest run
  that read the website), `notice` (what the newest run could not read, the engine's own sentence: `{ tone, title, text, failed, accessLost,
  at }` or null), `sitemapPartial` (the newest run read the sitemap tree only in part), `askGoogle` (at most 5 pages the engine marked
  `ask_google`: a manual "Request indexing" in Search Console is the next step; never one left out on purpose), `totals` and `lanes.new` /
  `lanes.existing` (`known`, `indexed`, `shouldBe` = pages Google gave a reading of minus those left out on purpose, `needYou`, `checked`
  (a failed check is not one), `unknown`, `errors`; totals add `backlogLeft` = existing pages not checked yet, `daysToFinish` at the
  configured daily checks), groups' `action` adds `review` (left out for a reason Google does not document) and `retry` (the check failed;
  never "In search"), and a group `cause` `fixed_on_site` (pages with `fix_seen_at`), `groups` (one per lane x action x
  cause: `label`, `meaning`, `weDo`, `youDo`, `guide`, `taskKey` for a site fix, the first 25 `pages`), `dropped`, `runs` (last 12), `events`
  (last 12 of Google's), `rollingOut`, `freeze` (the engine's newest run flag: no rewrite is suggested while it is on), `impacts` (last 3), `capped`
  (more than 5,000 page rows), `pagesRead`.
- `GET …/data/indexing/pages?lane=new|existing&action=…&cause=…&dropped=1&page=1&pageSize=25` (240 / 10 min) → `{ status, items, total, page,
  pageSize }` (same order as the group: most impressions first).
- `GET …/data/indexing/history?url=<an address of this website>` (240 / 10 min) → `{ status, history: [{ at, state, cause, label, evidence,
  coverage }] }` (newest first, 20 at most); 404 for an address of another website.
- Steps on the website: kind `indexing`, key `indexing:<cause>` for each cause only the client can fix (`noindex`, `robots_blocked`,
  `server_error`, `access_denied`, `not_found`, `soft_404`, `canonical_elsewhere`, `redirect`, `not_in_sitemap`, `indexed_not_in_sitemap`); payload
  `{ cause, urls (25 at most, most impressions first), total, pending? }`, plus `indexing:sitemap` (`{ cause: 'sitemap', submitted, errors }`)
  when Search Console lists no sitemap or reports errors (from `seo_index_runs.sitemaps_json`; ticked off by the daily index check only, its
  "check now" answers 409 `engine_reads_it`). Fix wave 1 rules: the engine's reading (`by: 'index'`) is the newest time GOOGLE inspected a
  listed page with that cause (never our weekly re-fetch); pages with `fix_seen_at` newer than Google's reading are waiting for Google, and
  a step whose pages all are is done and never reopened by the older reading; each cause is read on its own, sorted by impressions, capped at
  200, and a capped read never concludes "done"; the reading has an 8 s deadline. The app's own check (at most 10 pages on the website's own
  host) counts a page fixed only on the exact positive signal for its cause (FIX_CONTRACT decision 3), trusts a sitemap's silence only when
  the whole tree was read (a failed, HTML, cut, compressed or off-host sitemap makes it partial), and treats a firewall, a challenge page, an
  off-site redirect, a robots.txt that is not a file, or a partial sitemap as "could not tell": nothing recorded, and a click answers 409
  `site_unsure`. A page that is already a `redirect:` step is left out of the list, and a cause whose pages all are has no step at all. One
  sitemap download per website per check round (30 min cache; a person's click reads it again). The daily tick reserves a third of its 60
  checks for indexing steps; the other kinds take the rest. Fix wave 2: a page with `fix_seen_at` set waits for Google whatever the order of
  `inspect_at` and `fix_seen_at`; each cause is read as its `site_fix` and `wait` rows only; the engine's reading that decided a step is kept
  on the row, so a late or failed index read never sends a step back to "to do"; a step with more pages than the 10 our check opens is
  never done by it ("the first 10 of N are fixed", 409 `site_partial` on a click); robots.txt we could not read makes the sitemap read
  partial; robots.txt or sitemaps that redirect to another host are not trusted.
- Recommendations `ix:<action>:<cause>`: a site fix while its step is to do (not when an audit finding already asks for the same fix, matched on
  the finding's key: `findingAsksSameFix`), `ix:site_fix:sitemap`, `ix:ask_google` (the pages to ask Google about, with the guide
  `index-request-indexing`; never automated), links
  and duplicates with their counts, and pages Google read and left out with **Improve this page** (the Write-a-page form, `mode: 'keyword'`,
  prefilled with the page's address as `existingPageUrl`: the click is the approval, normal credits); none while `freeze`, none when the
  check is off.
- Settings: `indexWatch` (boolean) and `indexDailyCap` (20 to 1,200) in the website's monitor settings, sent to Site Admin `monitors` as
  `index_watch` / `index_daily_cap` (last in the body, only when set; empty in the engine = on, 300 a day).
- Callback stage `index_coverage` (DESIGN.md §5; `status: 'complete'` is read as a finished report): stored as a scheduled report, free
  (0 credits), deliverable (company delivery can choose it), `report.ready`, plus `alert.raised` (`source: 'index_coverage'`) when pages dropped
  out; it also refreshes the website's steps. Delivery follows the same rule as the weekly site report (FIX_CONTRACT decision 10). A run
  that could not check the website sends `summary.failed: true` and / or `summary.checked: false` with `summary.note`: the report then says
  "We could not check <domain> this time", shows the note (internal error text replaced) and labels any counts "(last check)"; the summary
  line says "could not check the website this time".
- Missed fires: the daily schedule is in `SCHEDULES` (`INDEX_COVERAGE_SCHEDULE`, 05:15) for the platform delivery report, counted from the
  first `seo_index_runs` row of any website (before that it is not measured). Only the schedule's own fires count (mode `trigger`), and the
  execution history is paged by n8n's cursor back to the oldest week shown (fix wave 2), so one execution per website a day no longer hides
  older fires. Deleting a website deletes its rows in `seo_index_pages`,
  `seo_index_runs`, `seo_update_impact` and (by the engine site id) `seo_index_history`; `seo_google_events` is global and stays.
- Rollback (X11): before reverting the API to a build without this feature, delete or skip the `site_tasks` rows with `kind = 'indexing'`
  (an older build reads an unknown kind as a redirect step).

## Page review: questions, business details, the editor, the final version, approval (H3, 2026-10-28; `shared/src/page-review.ts`, `server/src/services/pageReview.ts`)
For a written page (a `content` report that carries the page; anything else is 404, as is another company's report). Every write answers the
whole `PageReviewView` (`delivery` with the plain-words headline and the grade of the delivered page, the ranked `questions` with `stored` = the
website already has that fact, `answers`, `delivered`, `clientVersion`, `finalize` with its `quote` and `needed` / `reason`, `approval`, `publish`,
`stage`, `isFinal`, `finalOf`, and `people`: every user id the view carries (`approval.approvedBy`, `clientVersion.savedBy`, each answer's and
stored fact's `by`) mapped to the person's name, else e-mail, else "a team member"; screens print names through `personLabel`, never an id). A final version is a new report with `finalized_from` = the delivered report; both share one review row
(table `page_reviews`, migration 0023). Answers on a final version are kept under `<final report id>/<question id>`.
- `GET /api/orgs/:orgId/reports/:reportId/review` (viewer) → `PageReviewView`. A finalize run with no answer after 15 minutes is failed here (not charged).
- `PUT …/review/answers` (member, 60/min) `{ answers: [{ questionId, decision: 'yes'|'edit'|'remove'|'general'|'answer'|'skip', text? }] }`. Each
  answer is checked with `answerProblem` (400 `validation`, per question, when none could be saved). Every answer but `skip` is also stored as a
  business fact of the website (`sites.fact_answers[fact_key]`, `factOf`), and a tracked verified website gets them at once through Site Admin
  `facts` (`{ action: 'facts', domain, site_id, business_facts, fact_answers: { key: { decision, text } } }`; a failure is logged, the save stands).
  Audited `page.answered`.
- `POST …/review/accept-prefilled` (member) — every open question with a suggestion answered with it (`prefilledAnswer`: a claim kept, a text
  question answered with the suggestion); 400 when none has one.
- `PUT …/review/version` (member, 2 MB) `{ markdown }` — the client's own version: sanitised (`sanitizeMarkdown`: no raw HTML, scripts or unsafe
  link targets), saved with who / when, then checked for free by the engine's Publish Check (`clientVersion.check`, `ran: false` with a note when
  it could not run). Audited `page.edited`. `DELETE …/review/version` goes back to the delivered version (`page.edit_reverted`).
- `POST …/review/finalize` (member, 6/min) `{}` — the final version. 409 `finalize_not_needed` when no answer that changes the page and no client
  version is newer than the last final version, 409 `finalize_running` while one is being made, 402 / 429 like any run (credits, budget, platform
  capacity). Creates a run `mode: 'finalize'` (quoted from the `finalize` row of the cost table), answers at once with `finalize.status: 'running'`,
  then calls the engine (`POST N8N_FINALIZE_PATH`, default `/webhook/seo-page-finalize`, body `FinalizeBody`, 5-minute timeout). On its 200 answer
  the final version is stored as a new `content` report (`finalReportPayload`: the page package with the final Markdown, its safe HTML, the
  engine's status, grade and remaining questions, its own cost in `run_ledger`), the run completes with the engine's cost (charged up to the
  quote by the cost sync) and the client version is cleared (it is part of the final version). Any other answer fails the run (not charged).
- `POST …/review/approve` (member) `{ versionReportId? }` — records who approved which version (default: the final version when there is one,
  else the delivered page) and audits `page.approved`. 409 `not_ready` for a page that is not ready (its first blocking reason) or that the CMS
  rule refuses. Publishing then goes through the CMS routes above or "I published it" on the approved report, unchanged.
- `GET /api/orgs/:orgId/sites/:siteId/facts` (viewer) → `{ facts: FactAnswers }` (Website settings > Business details).
- `PUT /api/orgs/:orgId/sites/:siteId/facts/:factKey` (member) `{ decision: 'yes'|'edit'|'answer'|'remove'|'general', text? }` → `{ facts }`;
  `DELETE …/facts/:factKey` → `{ facts }` (404 when not stored). Synced to the engine as above; audited `facts.changed`.
- Every page run the app starts carries the stored facts after `business` and `business_facts`: `business_facts_kv` (key → text) and
  `stored_fact_keys` (every decided key: the engine never asks them again), and, for a page with an existing address, `existing_page_ours` (true when
  that address is a published page of the engine's content log).
- Pipeline: a `questions` Needs-you item per written page with open questions (not approved or published, the newest page of a keyword, at most 5,
  most impactful first), action `{ label: 'Answer them', reportId }`. Content board: each `ContentItem` of a page with a report carries `review:
  PageReviewSummary` (`stage`, `label`, `questions`, `answered`, `grade`).

## Agencies and the client portal (G5, `app/docs/WHITE_LABEL.md`, `shared/src/agency.ts`)
A **client workspace** is an ordinary company with `kind: 'client'` and its agency as parent; every route of a company works on it.
Roles there come from the agency (owners / admins: every client; members / viewers: clients they were assigned to) and from the
client's own people (`client_approver`, `client_viewer`, ranked **below** viewer, so every route that asks for viewer or more answers
them 403). `GET /api/orgs/:orgId` answers `kind`, `agency` (`{ name }`, plus `id` for agency staff), `brand` (`PortalBrand` when
white-label is on, else null), `clientApproval`; `monthlyBudgetUsd` is 0 for everyone but a platform admin. `GET /api/me` lists client workspaces
only to their client people (staff reach them through the agency) and, on a portal host, only that agency and its clients.
- `POST /api/orgs/:orgId/agency` (owner) → `Org` with `kind: 'agency'`. Audited `agency.enabled`.
- `GET /api/orgs/:orgId/clients` (agency staff) → `{ clients: AgencyClient[] }` (assigned ones only for members / viewers).
- `POST /api/orgs/:orgId/clients` (agency admin, 30/h) `{ name, website? }` → the client workspace (`Org`); no dollar budget is asked
  (the workspace is limited by its credits; the row keeps the platform's default guard). `AgencyClient` carries `creditBalance` and
  `creditsUsedThisMonth` (no `monthlyBudgetUsd` / `spentUsd`). Audited `agency.client_created` with no budget. Deleting one is `DELETE /api/orgs/:clientId` by the **agency's owner**; an agency with clients answers 409
  `agency_has_clients`.
- `GET /api/orgs/:orgId/clients/:clientId/staff` (agency admin) → `{ staff: StaffAccess[] }`; `PUT …/staff/:userId` `{ role: 'admin' |
  'member' | 'viewer' | null }` assigns / removes an agency member (owners and admins reach every client already: 400). Leaving the agency
  removes the person's assignments; a SCIM-deactivated agency membership switches every client off (403 `membership_deactivated`).
- `GET /api/orgs/:orgId/agency/overview` (agency staff) → `{ rows: AgencyOverviewRow[], generatedAt }`: per client website the latest
  health score, rank gains / drops, clicks change, AI visibility, alerts of the last 14 days, approvals waiting, the client workspace's
  credits used this month (`creditsUsedMonth`) and its balance (`creditBalance`) — from the app's own database (no engine call).
  `GET …/agency/overview.csv` (agency admin, 20/min): the same rows, formula-safe (columns `credits_used_month`, `credit_balance`
  replace `spent_usd_month`, `budget_usd_month`), audited `agency.overview_exported`.
- Invitations into a client workspace accept only `client_viewer` / `client_approver`; client roles anywhere else answer 400
  (`inviteRoleProblem`). A white-label client's invitation link and e-mail use the agency's portal host and sender.
- `GET /api/orgs/:orgId/branding` (admin of an agency or client workspace) → `BrandingResponse` (`branding`, the computed `contrast`
  report, the agency's brand for a client). `PUT` — agency: `brandingSchema` (`whiteLabel`, `productName`, `logoUrl`, `logoDarkUrl` —
  https on a public dotted host —, `accent` `#rrggbb`, `supportEmail`, `footerText`, `poweredBy`); client: `clientBrandingSchema`
  (name, logos, accent overrides). Audited `branding.updated` in the agency.
- `PUT /api/orgs/:orgId/client-settings` (admin of a client workspace) `{ clientApproval }`.
- `GET /api/orgs/:orgId/portal/mail` (agency admin) → `PortalMailView`; `PUT` `{ senderName, replyTo, fromMailboxId, dkimSelector }` — a
  `fromMailboxId` (one of the agency's own mailboxes) is accepted only when its domain's SPF passes and a DKIM key is found (400
  `from_not_verified`); `POST …/portal/mail/check` re-runs the check.
- `GET /api/orgs/:orgId/portal/domains` (agency admin) → `{ domains: PortalDomainView[], cnameTarget }`. `POST` `{ host }` (agency admin,
  step-up, 10/h) claims a host with a **new** token (400 for the platform's own hosts and private names; 409 `host_in_use` when another
  company holds it; at most 3). `POST …/:id/verify` checks `TXT _portal-verification.<host>` = `portal-verification=<token>` and the CNAME
  to `PORTAL_CNAME_TARGET` → `{ domain, check }`. `DELETE …/:id` (agency owner, step-up) releases it.
- Approvals (client workspace): `GET /api/orgs/:orgId/approvals` (client viewer and up) → `{ items: ApprovalView[], canDecide }`;
  `GET …/approvals/candidates` (member) → written pages of the last 60 days and outreach drafts; `POST …/approvals` (agency staff, member)
  `{ kind: 'page' | 'outreach', itemId, siteId?, title, note? }` (asking again replaces the open request); `POST …/approvals/:id/decide`
  (**client approver** only) `{ decision: 'approved' | 'changes_requested', note }` (a note is required for changes; 409 once decided);
  `POST …/approvals/:id/withdraw` (member). With `clientApproval` on, `POST …/reports/:id/cms/publish` with `mode: 'live'` and
  `POST …/link-building/approve` answer **409 `client_approval_required`** until the item's latest request is approved.
- Client people reach exactly: the company, its websites, `GET …/sites/:siteId/data/{overview,search,rankings,technical,ai,backlinks}`,
  `GET …/recommendations`, reports and their files, and approvals. Payloads they get have every cost / ledger / budget key removed
  (`clientSafePayload`); in a white-label workspace their files are rebranded (Word, zip, HTML, Markdown, text, CSV, JSON — the engine's
  report brand and ours replaced by the agency's name) and the engine's PDF is not offered (404; the report page prints instead).
- Portal host (no company in the URL): `GET /api/portal/context` → `PortalContext | null`; `GET /api/portal/tls-allow?domain=` → 200 for the
  app's own hosts and verified portal hosts, else 404 (the reverse proxy's on-demand TLS "ask"); `POST /api/portal/handoff` `{ host }` (on the
  app host, signed in, belonging to that agency) → `{ url, expiresInSeconds: 60 }`; `GET /api/portal/handoff/:token` on that host opens the
  session (same method, two-step and SSO company) and redirects to `/`; once only. With `PORTAL_STRICT_HOSTS`, any other host answers 421
  with a plain text body; a lapsed portal host always does.

### Issue trackers — Jira Cloud, Linear, Asana

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /api/orgs/:orgId/integrations/trackers | `trackerConnectSchema`: `{ kind: 'jira', siteUrl: https://<name>.atlassian.net, email, apiToken, projectKey, issueType? }` · `{ kind: 'linear', apiKey: lin_api_…, teamKey }` · `{ kind: 'asana', token, projectGid }` (20 an hour) | `IntegrationView` — connects (or replaces) the company's tracker of that kind **after the vendor confirmed** the token and the project / team / issue type; 400 names what is wrong (e.g. the issue types the project has) |
| POST | /api/orgs/:orgId/integrations/:id/test | | `{ ok, error }` (status kept on the connection) |
| DELETE | /api/orgs/:orgId/integrations/:id | | `{ deleted: true }` (tickets keep their link, the connection goes) |
| GET | /api/orgs/:orgId/issues?siteId= | any role | `{ items: IssueLinkView[], trackers: [{ kind, name, target, status }] }` |
| POST | /api/orgs/:orgId/issues | **member**; `issueCreateSchema` `{ websiteId, kind?, source: { type: 'finding', auditId, findingKey } \| { type: 'recommendation', id } }` (30 a minute per company) | `{ existing, issue: IssueLinkView }` |
| POST | /api/orgs/:orgId/issues/refresh?siteId= | member | `{ refreshed, failed, items }` — reads each ticket's state (at most once per 5 minutes per ticket) |
| GET / POST | /api/v1/issues | key: `read` / **`run`** | the same list / push (201 new, 200 existing) |

The ticket: title `[SEO] <finding>`; the audit and its date, severity and category, pages affected of pages checked, why it matters,
the evidence line, up to 10 example pages, **the fix** (from the audit's own report), the "I fixed this" hint and a link back to the
finding; a recommendation carries its detail, evidence and action. Jira gets it as ADF with labels `alaventra`, `seo`; Linear as
Markdown; Asana as plain notes. **One finding = one ticket**: `issue_links` is unique per (company, `finding:<website>:<finding key>`
or `rec:<website>:<id>`), inserted as `creating` before the vendor call, so two simultaneous pushes reach the vendor once; a failed
vendor call removes the placeholder. States map to `todo` / `in_progress` / `done` (Jira status category, Linear state type, Asana
`completed`). Vendor errors: 502 `tracker_refused` (token; the connection is marked `error`), `tracker_not_found`, `tracker_error`,
`tracker_unreachable`.

### Warehouse / BI export — S3-compatible storage and BigQuery

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /api/orgs/:orgId/integrations/exports | `exportDestinationSchema`: `{ kind: 's3', name, provider: aws \| gcs \| r2 \| other, region, accountId (R2), endpoint (other), bucket, prefix, format: ndjson \| csv, tables[], schedule: daily \| weekly \| off, hour (UTC), weekday, accessKeyId, secretAccessKey }` · `{ kind: 'bigquery', name, projectId, datasetId, location, tablePrefix, tables[], schedule, hour, weekday, serviceAccountJson }` | `IntegrationView` — saved only after a test: S3 writes `<prefix>/_alaventra/dt=…/_alaventra-connection-test.txt`; BigQuery reads the dataset. At most 3 destinations |
| PATCH | /api/orgs/:orgId/integrations/:id | `{ name?, tables?, schedule?, hour?, weekday?, format? }` | `IntegrationView` (the credentials and the target need a new connection) |
| POST | /api/orgs/:orgId/integrations/:id/run | (6 a minute; once per 10 minutes per destination) | `ExportRunView` `{ status: ok \| partial \| failed, tables: [{ table, rows, bytes, object, truncated, error }] }` |
| GET | /api/orgs/:orgId/integrations/:id/runs | | `{ items: ExportRunView[] }` (30) |
| POST | /api/v1/exports/:id/run | key with **`admin`** | the same |
| GET | /api/v1/tables | key `read` | the six tables with their columns (name, type, description) |
| GET | /api/v1/websites/:websiteId/tables/:table?since=&until=&limit=&cursor= | key `read`, verified website | `{ table, columns, items, nextCursor }`, oldest first, `limit` up to 100 (default 100) |

Tables (`EXPORT_TABLES`, `shared/src/integrations.ts` — the one schema; every row adds `company_id`, `website_id`, `website_domain`,
`exported_at`): `rank_history` (n8n `seo_rank_history`), `site_metrics` (`seo_site_metrics`), `audit_findings` (`seo_audit_findings`),
`ai_visibility` (`seo_ai_visibility`; `credits` replaces `cost_usd`), `backlinks` (`seo_backlinks`), `runs` (the app's runs with
their credits: `credits_quoted`, `credits_charged` replace `estimated_cost_usd`, `actual_cost_usd`, `cost_estimated`, `cost_partial`;
`error` as the customer reads it). Values are typed
(`STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`, `TIMESTAMP`, `DATE`); a value the engine did not store is `null`, never 0. Objects:
`<prefix>/<table>/dt=YYYY-MM-DD/<table>-<export run id>.<ndjson|csv>` — a full snapshot per run, read the newest `dt`. CSV is RFC 4180
with a header row; a text cell starting with `= + - @` gets a leading `'` (CSV injection). BigQuery: table `<tablePrefix><table>`,
created with the documented schema, `WRITE_TRUNCATE` each run (a resumable-upload load job of NDJSON, polled until DONE). Requests to
storage are signed with AWS SigV4 (`lib/sigv4.ts`); AWS uses `<bucket>.s3.<region>.amazonaws.com`, the others path-style
(`storage.googleapis.com/<bucket>` with HMAC keys, `<account>.r2.cloudflarestorage.com/<bucket>`, or any public https endpoint).
Limits: 200,000 rows per table per run (`truncated: true` beyond), 100 MB per object. Scheduled exports run from a five-minute
timer (`exportTick`); a failed scheduled export waits for its next time.

**Looker Studio**: the community connector in `integrations/looker-studio/` (Apps Script) reads `GET /api/v1/tables` and the table
route above with a read-only key — deployment steps in its README.

## n8n → app
`POST /api/hooks/n8n/:hookToken` — every callback of every run and every scheduled report of the company (the token is the
company's `hook_token`; it is sent to n8n as `callback_url`). Body: the n8n callback (`stage`, `request_id`, …); embedded files are
moved to the files table. A `rank_tracker` callback with `won: true` for a ladder of a verified website of the company also sets that
ladder's `seo_ladder_settings` status to `won` (unless it is paused or archived), so the app keeps showing Won after the tracker stops
checking it and the cadence writes no more pages for it. A `ladder_plan` callback of a ladder run with `ladderPrefs` applies them (see
Runs); a `site_tracker` callback with `detected_published: [{ keyword, url, ladder_id, matched_by, source }]` (Phase 4) is stored as
usual and read by the Pipeline (`detected`), the ladder detail and the site-report view ("We found your page live at …").

W2-A (2026-10-23, WAVE2_CONTRACTS.md §6): a `rejected` callback with `reason: 'open_run'` (an on-demand AI visibility check that met the
website's open run, engine F2 E17) closes the app run with nothing charged and `lastStage: 'joined_open_run'`; its `error` reads "Part
of the open run (finishes about HH:MM UTC). <the engine's sentence>" (from `open_run.expected_finish`), and the screens show "Part of the
open run", not "Failed" (`aiOpenRunNote`, `AI_JOINED_OPEN_RUN` in `shared/src/ai-trends.ts`).

Keyword-first: every callback of a job of the website's cycle carries `trigger: 'cycle'`, `cycle_key`, `cycle_date` and a request id
`cyc_<site>_<YYYYMMDD>_<job>`; it never matches an app run (even one with the same id) and is stored as a scheduled report of the
website; its ledger row `cycle:<cycle_key>:<job>` is autopilot spend (as `schedule:` rows are). A `cycle_preview` callback (status
`progress`) is kept as the "Coming up" plan and e-mailed once; a `content_cadence` or `cycle_preview` callback whose queued ladder is now
written triggers the re-check above; a won ladder and a `keyword_strategy` callback look for the next keyword; `site_tracker_setup`'s
`cycle.cycle_weekday` is kept on the website.

## Platform admin (e-mails in `PLATFORM_ADMIN_EMAILS`)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /api/admin/orgs | | `AdminOrg[]` |
| PATCH | /api/admin/orgs/:orgId | `orgBudgetSchema` | `AdminOrg` |
| GET | /api/admin/delivery | | `DeliveryReport` — runs delivered / runs started per week (app runs and the nine schedules), the schedule fires that left no execution behind (D25a) and how every ops alert went out (G21) |
| POST | /api/admin/users/reset-link | `{ email }` | `{ url, expiresInHours, name }` — a password reset link to hand over (no e-mails on the platform) |

### Admin panel (`/admin`, 2026-10-18; contract `shared/src/admin.ts`, server `server/src/services/admin/`)
Every route below: platform admins only (verified e-mail on `PLATFORM_ADMIN_EMAILS`; 401 signed out, 403 anybody else), the usual CSRF
header on mutations, and every mutation is written to the admin activity log (`admin_audit`). `period` is one of `month` (calendar
month to date, UTC — the default), `last_month`, `7d`, `30d`, `90d`, `all`; all windows are UTC (`services/admin/period.ts` `periodRange`).
Money words: **cost** = what a company's operations cost us at Claude + DataForSEO (from `cost_events`), **billed** = what the providers
charged the platform, **revenue** = payments recorded with credit grants, **margin** = revenue − cost.

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | /api/admin/overview | `?period` | `AdminOverview` — people, companies, websites, runs, money (all cost incl. unattributed), unattributed cost, credits, daily series, `bills` (`ProviderBill` for anthropic + dataforseo), the engine-ledger sync state, top 5 companies. Invariant: `money.cost.totalUsd` = Σ companies' cost + `unattributed.totalUsd` |
| GET | /api/admin/companies | `adminListQuerySchema` (`?period&q`) | `AdminCompanyRow[]` (most cost first; `q` searches name / slug) |
| GET | /api/admin/companies/:id | `?period` | `AdminCompanyDetail` (members, websites with their cost, cost by mode, daily, the 20 newest runs, the 100 newest credit entries) |
| PATCH | /api/admin/companies/:id | `adminCompanyUpdateSchema` (`monthlyBudgetUsd`, `disabled`, `creditsEnforced`, `name`) | `AdminCompanyDetail`; also written to the company's own audit log (`company.admin_changed`) |
| GET | /api/admin/companies/:id/credits | | `CreditEntry[]` newest first, each with `balanceAfter` |
| POST | /api/admin/companies/:id/credits | `adminCreditSchema` (`kind` grant / adjust / refund, `credits`, `paidUsd` grants only, `note`, `notify` default true) | `CreditEntry`; a grant with `paidUsd > 0` issues an invoice (`ref.invoice`); `ref.notified` = who was e-mailed, or why nobody was |
| GET | /api/admin/companies/:id/invoices | | `InvoiceView[]` newest first |
| GET | /api/admin/invoices/:id/pdf | | the invoice as a PDF |
| POST | /api/admin/invoices/:id/send | | e-mails it again (PDF attached) to the company's owners and admins of today → `InvoiceView`; 409 when nobody could be reached |
| DELETE | /api/admin/companies/:id | `{ confirm: <slug> }` (`adminDeleteCompanySchema`) | `{ ok }` — the same deletion as the owner's (verified websites stop in the engine first; an unreachable engine is logged, the deletion goes on); 409 `agency_has_clients`; its cost history stays as unattributed |
| GET | /api/admin/export/companies.csv | `?period` | `text/csv`: every company with the money and credit columns; text cells that start with `= + - @`, tab or CR are prefixed with `'` |
| GET | /api/admin/users | `?period&q` | `AdminUserRow[]` (cost = runs the person started; schedules belong to the company) |
| POST | /api/admin/users | `adminCreateUserSchema` (`email`, `name`, `orgId` + `role` or `newCompanyName`, `markVerified`) | `AdminCreatedUser` — no password is set: `setPasswordUrl` is a 72-hour reset link to hand over. With `newCompanyName` the person owns the new company (sign-up credits apply). 409 `email_taken` |
| PATCH | /api/admin/users/:id | `adminUpdateUserSchema` (`name`, `suspended`, `markVerified: true`) | `AdminUserRow`. Suspending deletes every session; 400 for your own account, 409 `last_platform_admin` |
| DELETE | /api/admin/users/:id | `{ soleCompanies?: 'delete' \| 'keep' }` (`adminDeleteUserSchema`) | `{ ok, deletedCompanies, keptCompanies }`. 409 `sole_owner` (+ `companies`) while the person is the only owner of a company with other members; 409 `sole_member_companies` (+ `companies`) until the admin chooses what happens to companies the person is the only member of; 400 for yourself |
| POST | /api/admin/users/:id/sessions/revoke | | `{ ok, revoked }` |
| PUT | /api/admin/users/:id/memberships | `adminMembershipSchema` (`orgId`, `role`) | `AdminUserRow` — adds the person or changes the role; 409 `last_owner` when it would leave the company without an owner; client workspaces are refused (their people are managed by the agency) |
| DELETE | /api/admin/users/:id/memberships/:orgId | | `AdminUserRow`; 409 `last_owner` |
| GET | /api/admin/runs | `adminRunsQuerySchema` (`period`, `q`, `orgId`, `status` all / failed / running / done, `origin` all / app / schedule, `cursor`, `limit` ≤ 200) | `AdminRunsPage` — app runs and the engine's own work that belongs to no run (schedules, keyword checks; their `id` is the cost event key, `orgId` `''` / `orgName` "Unattributed" when no company could be tied), newest first; `nextCursor` until the last page |
| POST | /api/admin/costs/sync | `?full=1` re-reads the whole ledger | `AdminCostSyncResult` — runs the cost sync now (it also runs every 10 minutes, reading what settled since the last read minus a day; a full re-read once a day) |
| GET | /api/admin/settings | | `PlatformSettings` |
| PUT | /api/admin/settings | `platformSettingsSchema` (`creditValueUsd`, `markup`, `signupCredits`, `enforceForNewCompanies`) | `PlatformSettings` |
| GET | /api/admin/activity | `?limit` (≤ 500, default 100) | `AdminActivityRow[]` newest first |

**Where the cost comes from** (`services/admin/costSync.ts`): every 10 minutes the server reads the engine's settled `seo_run_ledger`
rows into `cost_events` (one per execution id) and attributes each. A run's `request_id` is the engine front door's execution id, not the
execution that writes the ledger row, so rows are tied to runs through the run's callbacks (each names its `execution_id`; monitors also
`run_ledger.run_id`; scheduled reports that reuse an old run's request id are ignored), then through `request_id`. Order: that run →
its company / website / person; key `parent:<id>` → whatever the parent resolves to; key `app:<company>` → that company (if it existed
by then); else the row's `domain` (or the `site_…` id in an internal key) = a website verified **before** the row settled → its
company; else unattributed. Rows stored before their run's callback arrived are linked on later syncs. App runs the ledger does not
cover (it cannot be read, or nothing ties a row to the run an hour after it finished, not even an unlinked `app:<company>` row that
started in the run's window) count from their own settled `actual_cost_usd`, split by their callbacks' `run_ledger`; keyword checks
count from `keyword_checks` (their engine rows are left out). An engine row and an app figure never both count for one run: the engine
row replaces the app figure and its credits are given back. A row the engine settles again with a different figure (newer
`settled_at`) updates its event and debits the difference. A deleted company's costs stay unattributed for good (`detached_from`), its
credit entries stay with `org_id` null and `org_name`, and its revenue stays in the totals (`AdminOverview.deletedCompanies`).
**Credits:** each cost event of a company debits `creditsFor(cost)` once (unique `ref_key`), from the deploy of migration 0014 on
(`platform_settings.credits_since`) and never for money spent before the company existed; runs and modes show the credits actually
debited. A suspended person's API keys start nothing (403 `key_owner_suspended`), and the API's dry run answers `credits`
(`{ enforced, needed, available, held, enough }`). **Billed:**
Anthropic from the Admin API cost report when `ANTHROPIC_ADMIN_API_KEY` is set; DataForSEO from the fall of the balance between the
engine's readings in the period (+ the live balance when `SEO_DATAFORSEO_LOGIN` / `_PASSWORD` are set); `source: 'unavailable'` with a
sentence otherwise.

**Credit enforcement** (`organizations.credits_enforced`, off by default): a run (form, API, "Choose keywords for me") or a keyword check
whose estimated credits exceed the balance minus what in-flight work holds is refused with **402 `credits`**: "Your company has no credits
left for this run …". A **suspended** account gets **403 `account_suspended`** ("This account is suspended. Contact support.") on every
sign-in (password, Google → `/login?error=account_suspended`, SSO, the second step, portal hand-off) and **401 `account_suspended`** on a
leftover session.
