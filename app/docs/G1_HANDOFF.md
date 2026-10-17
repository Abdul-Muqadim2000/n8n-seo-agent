# G1 enterprise identity — hand-off (2026-10-18)

Branch `worktree-agent-acb3f285de8c3a4bc` (based on `feature/seo-agent-v4.5`, last merged at 2aa912a). Design and manual:
`app/docs/IDENTITY.md`; endpoints: `app/API.md` (sections "Two-step verification and step-up", "Sessions", "Single sign-on",
"Audit log").

## Done (committed)

| Commit | What |
|---|---|
| 117d24b | 1/5 Two-step verification: TOTP (RFC 6238, own implementation tested on the RFC vectors, codes accepted once), WebAuthn passkeys (`@simplewebauthn/server` 14.0.3 / browser 14.0.0), 10 hashed single-use recovery codes, sign-in second step (`/login/mfa`, 5 tries per challenge), step-up (`403 reauth_required` + one dialog that retries), company policy "require two-step" with whether Google / SSO count, members' MFA column |
| 332fbe6 | 2/5 Audit log: `services/audit.ts` (`audit`, `auditUser`), append-only Postgres trigger, retention purge (daily), filters / paging / formula-safe CSV, Company settings → Audit log; existing routes wired (sign-ins, team, sites, budget, delivery, shares, mailboxes, API keys, platform admin) |
| ea99377 | 3/5 Sessions: "Where you're signed in" (revoke one / all others, by public id), company idle timeout (strictest of the person's companies, refreshed on policy / membership change, hidden-tab polls are not activity) |
| 75f56db | 4/5 SSO: DNS-verified e-mail domains, OIDC (`openid-client` 6.8.8 via an SSRF-guarded fetch) and SAML 2.0 (`@node-saml/node-saml` 5.1.0 + own issuer / recipient / one-use checks, IdP-initiated refused), test sign-in, JIT with default role, enforcement (owner break-glass with MFA, non-SSO sessions ended), `/login/sso`, Company settings → Single sign-on, two guides |
| 4930c78 | 5/5 started: SCIM shared types, token format, filter parser (`shared/src/identity.ts` §5) — nothing server-side yet |
| 986f88d | Merge of `feature/seo-agent-v4.5` 2aa912a; **the G1 schema is one migration `server/drizzle/0010_g1_identity.sql`** (after `0009_cms_publishing`), audit trigger appended by hand at its end — keep that tail if it is ever regenerated |

## Checks (merged tree, 2026-10-18)
- Typecheck clean: shared, server, web.
- Tests: shared **390 passed** (1 skipped, pre-existing); server **386 passed**, 17 skipped (not G1's). G1's own: 53 server tests
  (`test/identity-{totp,mfa,audit,sessions,sso}.test.ts`) + 15 shared (`shared/src/identity.test.ts`).
- Route tests run on **PGlite** (in-process Postgres, every migration applied; `test/helpers/pg.ts`), no container needed. Helpers:
  `test/helpers/client.ts` (cookie jar, CSRF header, a different IP per request), `webauthn.ts` (software authenticator, real
  ES256 signatures), `idp.ts` (mock OIDC issuer with RS256 JWKS / PKCE / client auth; SAML IdP with a generated key + self-signed
  cert signing assertions with xml-crypto).

## Not done
1. **SCIM 2.0 (item 5)** — next steps, in order:
   - Schema (add to `schema.ts`): `memberships.deactivated_at`, `provisioned_by` (owner/invite/jit/scim, default
     `invite`), `scim_external_id`; tables `scim_tokens` (hashed, prefix, revoked), `scim_groups` (org, displayName unique per org,
     externalId, `role` nullable), `scim_group_members`. Then `npm run db:generate` → a new migration after 0010 (or fold into 0010
     if nothing shipped yet).
   - Enforce deactivation: `auth/access.ts orgAccess` (403 `membership_deactivated`), `services/me.ts buildMe`, `auth/session.ts
     userIdleTimeout`, `services/reportDelivery.ts` recipients, `services/sso.ts finishSso` (`sso_deactivated` — the error text
     already exists in `web/src/pages/auth/shared.tsx`); on deactivation delete sessions with `sso_org_id` = that company.
   - `routes/scim.ts` under `/api/scim/v2` (Bearer `scim_…`, `SCIM.perMinute` per token, `application/scim+json` parser, skip
     CSRF + cookie for `/api/scim/` in `app.ts` like `/api/v1`): ServiceProviderConfig / ResourceTypes / Schemas; Users list
     (`parseScimFilter`), get, create (verified domains only; link an existing account; 409 when already a member), put, patch
     (Entra string booleans via `scimBool`; `active`, name, externalId, displayName), delete (remove membership; never the owner);
     Groups list / get / create / put / patch (members add / remove / replace, displayName) / delete; role = highest mapped group
     role, owner untouched. Audit with actor `{ type: 'scim', label: token name }` (actions already in `AUDIT_ACTIONS`).
   - Admin: `GET /api/orgs/:orgId/scim` (`ScimOverview`), token create (step-up, max 2, shown once) / revoke, `PATCH
     …/scim/groups/:id { role }` (step-up). Web: a `ScimCard` at the end of `SsoTab.tsx`, a `scim-provisioning` guide (Okta /
     Entra), and Team tab badges (deactivated, provisioned by).
   - Tests: token auth + cross-company isolation, Okta flow (filter → create → patch active false → orgAccess refused →
     reactivate), Entra PATCH shapes, groups → roles, owner protected, other-domain refused.
2. **Marketing pages** (CLAUDE.md "Business pages follow the product") — not done: `/security` page sections (two-step, SSO,
   sessions, audit log), a `features.ts` entry or additions, a `changelog.ts` line dated 2026-10-17, pricing rows (SSO / audit log
   on Enterprise).
3. Browser pass at 390 / 1440 px light + dark of: login second step, `/login/sso`, Account (two-step, devices), Company settings →
   Security / Single sign-on / Audit log. Not run (no browser here); typecheck only.

## Owner decisions / inputs
- Set `IDENTITY_KEY` in `app/.env` (32 bytes, `openssl rand -hex 32`); without it (and without `MAILBOX_KEY`) authenticator apps and
  OIDC client secrets cannot be stored. Optional `MFA_ISSUER`. `SSO_ALLOW_PRIVATE_HOSTS` stays false outside tests.
- First real IdP connection (Okta / Entra / Google Workspace) — only mocks were available.
- Which plans get SSO / SCIM / audit log (pricing).

## Merge hotspots
`server/src/db/schema.ts`, `server/drizzle/meta/_journal.json` + snapshots (renumber after the newest), `server/src/app.ts` (route
registration, CSRF exemption for the SAML ACS), `server/src/routes/{auth,orgs,sites,runs,linkBuilder,apiV1,admin,me}.ts` (audit
calls), `server/src/auth/{access,session}.ts`, `shared/src/{api,index,guides}.ts`, `web/src/lib/{api,queries}.ts`,
`web/src/router.tsx`, `web/src/main.tsx`, `web/src/pages/settings/{OrgSettingsPage,AccountPage}.tsx`, `web/src/pages/auth/LoginPage.tsx`,
`web/src/components/guide/GuidePanel.tsx`, `web/src/components/layout/OrgLayout.tsx`, root `app/package.json` (`overrides`:
xml-crypto 6.3.2) and `package-lock.json`.
