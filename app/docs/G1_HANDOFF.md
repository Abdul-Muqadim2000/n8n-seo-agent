# G1 enterprise identity — hand-off (2026-10-18)

Branch `worktree-agent-acb3f285de8c3a4bc` (based on `feature/seo-agent-v4.5`, last merged at 7fe504f+, after G3). Design and manual:
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

## Migration now
After merging G3 (`0010_crawler_logs`), the whole G1 schema is **`server/drizzle/0011_g1_identity.sql`** (10 tables + columns on
`users`, `sessions`, `organizations`, `memberships`), regenerated from the merged schema; the audit-log trigger is appended by
hand at its end — keep that tail if it is ever regenerated or renumbered.

## Done after the first hand-off (2026-10-18 night)
- **5c43c07 SCIM 2.0** — `services/scim.ts`, `routes/scim.ts` (`/api/scim/v2`, bearer `scim_…` hashed, 2 live, 600/min), Users
  (eq filters, create / link, get, put, patch in Okta and Entra shapes, delete) and Groups (members add / remove / replace),
  groups → roles (highest mapped role wins; owner never changed), `memberships.deactivated_at` enforced in `orgAccess`
  (`403 membership_deactivated`), `/api/me`, idle timeout, report recipients and SSO; deactivation ends the sessions that company's
  IdP opened; admin card in Company settings → Single sign-on, Team badges (SCIM / SSO / Deactivated), guide `scim-provisioning`.
  6 route tests (`test/identity-scim.test.ts`: auth incl. cookie and API-key refusal, Okta life cycle with deprovision, domain and
  owner guards, Entra PATCH shapes, groups → roles, isolation) + 2 shared.
- **cbe0ee0 Marketing** — `/security` (two new groups, sign-in items, role rows, two FAQs), the Enterprise capability, changelog
  2026-10-18, pricing rows (SSO / SCIM on Enterprise marked PLACEHOLDER).
- **Browser pass** — `scripts/g1_browser_pass.mjs` against a throwaway stack (own Postgres + API + Vite, no host ports, no
  secrets, no n8n), Chromium at 1440 and 390, light and dark: **52 visits, 0 console errors, 0 failed requests, 0 overflow, an h1
  on every page, no text under WCAG AA**. Screenshots `docs/browser-pass/g1/*.png`, checks `docs/browser-pass/g1/results.json`.
  Passkey added and used to sign in through Chromium's virtual authenticator; the audit CSV downloaded (23 rows, header checked).
  Prepared in the database, because no IdP and no real DNS exist here: the SSO domain marked verified and the connection marked
  tested and switched on; one owner session aged past the step-up window. Everything else went through the UI or the API.
  The step-up screenshots are full-page captures, so the dialog's backdrop covers only the first screen of the page.

## Not done
- Nothing from the brief is left open in code. A real IdP connection (Okta / Entra / Google) has not been made — only mocks.

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
