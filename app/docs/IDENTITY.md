# Identity and governance (G1, 2026-10-17)

Enterprise identity for the Ascentra web app: two-step verification, a customer-visible audit log, session control, single sign-on
(OIDC and SAML 2.0) on verified e-mail domains, and SCIM 2.0 provisioning. Market gap #2 of
`n8n/seo-agent/docs/system-review-2026-10-17/MARKET_BENCHMARK.md` (§4 "Identity & governance": SAML / OIDC SSO, SCIM, MFA, a
customer-visible audit log — all ✘ before this change).

This file is the design and the operating manual. The endpoints are in `app/API.md` ("Identity"); the setup guides the app shows
are in `shared/src/guides.ts` (area `identity`).

## 1. What it protects against (threat model)

| Threat | Control |
|---|---|
| A stolen or reused password | Two-step verification (TOTP, passkeys, recovery codes); a company can require it for every member |
| A one-time code observed and replayed | A TOTP code is accepted once: the last accepted time step is stored and an equal or older step is refused |
| Guessing a 6-digit code | 5 attempts per sign-in challenge (then the challenge is void and the password must be entered again), plus the route rate limit; failures are audited |
| A recovery-code table leaked | 80-bit codes, stored as SHA-256 only, each usable once |
| A TOTP secret table leaked | Secrets are sealed with AES-256-GCM under `IDENTITY_KEY` (falls back to `MAILBOX_KEY`), never stored in clear |
| A walked-away laptop | Company idle timeout (the strictest of the person's companies applies); sign out one device or all others |
| A hijacked session changing security settings | Step-up: security-relevant changes need a second factor (or the password, or a fresh sign-in) within the last 10 minutes |
| A leaver who still has a password | SSO enforcement refuses password and Google sign-in for the company's verified domains; SCIM deactivation removes access on the IdP's next push; enforcing revokes the password sessions already open |
| An IdP outage locking everyone out | Owners keep their password as a break-glass account, and enforcement can only be switched on by an owner who has two-step verification |
| Claiming someone else's domain for SSO | A domain is used only after a DNS TXT record proves control; one company per verified domain |
| A forged or replayed SAML response | Signature checked against the IdP certificate the company uploaded (assertion signature required); audience = our SP entity id; recipient / destination = our ACS URL; `InResponseTo` must match a request we issued (stored server-side, single use); NotBefore / NotOnOrAfter with 2 minutes of clock skew; each assertion id accepted once; IdP-initiated responses are refused |
| A forged OIDC login / login CSRF | Authorization code flow with PKCE, `state` bound to a browser cookie, `nonce` checked in the ID token, issuer and audience checked by `openid-client`; discovery and token calls only to public https hosts (SSRF guard) |
| An IdP asserting an address outside the company | SSO accepts only e-mail addresses on the company's own verified domains |
| A SCIM token leaked | Hashed at rest, shown once, revocable, scoped to one company, rate-limited; SCIM cannot touch the owner, and can provision only addresses on the company's verified domains |
| An admin covering their tracks | The audit log is append-only in the database itself (a trigger refuses UPDATE, and DELETE outside the retention purge) |
| Secrets in the audit log | Events carry ids, labels and before/after of plain settings only — never a password, code, token, secret or key |

## 2. Data model (migration `0011_g1_identity`, with the audit-log trigger appended by hand at its end)

- `users`: `mfa_totp_secret` (sealed), `mfa_totp_pending` (sealed, during enrolment), `mfa_totp_enabled_at`, `mfa_totp_last_step`.
- `mfa_recovery_codes` (user, SHA-256 of the code, used at).
- `webauthn_credentials` (user, credential id, COSE public key, counter, transports, name, last used).
- `auth_flows`: short-lived server-side state of a multi-step sign-in — the password-checked-but-not-yet-second-factor challenge,
  a passkey challenge, an OIDC `state`/`nonce`/PKCE verifier, a SAML request id, a consumed SAML assertion id. The key is the
  SHA-256 of a random token held by the browser (cookie or RelayState); rows expire in minutes.
- `sessions`: `public_id` (what the device list shows — never the session key), `auth_method` (`password` / `google` / `sso`),
  `sso_org_id`, `mfa_at` (when a second factor was verified in this session), `reauth_at` (last step-up), `idle_timeout_minutes`
  (the strictest of the person's companies, refreshed whenever a policy or a membership changes).
- `organizations.security_policy` (jsonb): `requireMfa`, `mfaTrustGoogle` (default false), `mfaTrustSso` (default true),
  `idleTimeoutMinutes` (null = off), `auditRetentionDays` (default 365).
- `memberships`: `deactivated_at` (SCIM), `provisioned_by` (`invite` / `owner` / `jit` / `scim`), `scim_external_id`.
- `sso_domains` (company, domain, TXT token, verified at) — unique per domain once verified.
- `sso_connections` (one per company): protocol, OIDC issuer / client id / sealed client secret, SAML IdP entity id / SSO URL /
  certificates, JIT on/off and default role, enabled, enforced, last test.
- `sso_identities` (connection, IdP subject → user), so a renamed address still finds its person.
- `scim_tokens` (hashed, shown once), `scim_groups` (display name, external id, mapped role), `scim_group_members`.
- `audit_events` (bigint id, company, time, actor type / user / label, action, target type / id / label, outcome, IP, user agent,
  details jsonb). Append-only trigger; purge by retention once a day.

## 3. Sign-in, step by step

1. **Password or Google** proves who the person is. If their e-mail domain is a verified domain of a company that **enforces SSO**
   and they are not an owner of it (break-glass), the attempt is refused with `sso_required` and the SSO address to use.
2. If the person has two-step verification on, no session is created yet: an `mfa_login` flow is opened (5 minutes, 5 tries) and the
   browser holds its token in an http-only cookie. `POST /api/auth/mfa/verify` with a TOTP code, a recovery code or a passkey
   assertion completes it and creates the session with `mfa_at` set.
3. **SSO** (`/login/sso`, or the button the e-mail lookup shows) goes to the company's IdP and back; the address must be on a
   verified domain of that company; the person is matched by IdP subject, then by e-mail; if they are new and JIT is on, an account
   and a membership with the default role are created. The session records `sso` and the company; if the company trusts its IdP for
   two-step verification (`mfaTrustSso`, default on), `mfa_at` is set.
4. **Company requirement**: every company route checks the company's policy. If it requires two-step verification and the session
   has none that counts (`mfa_at`, or Google when `mfaTrustGoogle`, or this company's SSO when `mfaTrustSso`), the answer is
   `403 mfa_enrolment_required` (no factor yet: set one up) or `403 mfa_verification_required` (has one: verify it now). The app
   shows a full-page prompt; nothing of the company is readable until then. The read API's keys are machine credentials and are not
   subject to it.
5. **Step-up** (`403 reauth_required`): enrolling or removing a factor, regenerating recovery codes, changing the security policy,
   SSO or SCIM, creating an API key and deleting the company need a fresh proof within 10 minutes — a second factor if the person has
   one, else the password, else signing in again. The app opens one dialog and retries the request.

## 4. SSO configuration

- **Domains**: claim `example.com`, publish `TXT ascentra-sso=<token>` at `example.com`, press Verify. A domain verified by another
  company cannot be claimed. Removing a domain stops SSO and enforcement for it.
- **OIDC**: issuer URL (discovery at `/.well-known/openid-configuration`), client id, client secret; redirect URI
  `<APP_URL>/api/sso/oidc/callback`; scopes `openid email profile`. The e-mail comes from `email`, else `preferred_username` / `upn`
  when it looks like an address (Entra ID).
- **SAML 2.0**: IdP entity id, IdP SSO URL (HTTP-Redirect binding), IdP signing certificate(s) (two during a rotation). Our SP
  metadata: `<APP_URL>/api/sso/saml/<connection id>/metadata` (entity id `<APP_URL>/api/sso/saml/<connection id>`, ACS
  `<APP_URL>/api/sso/saml/<connection id>/acs`, HTTP-POST, NameID e-mail). Assertions must be signed; encrypted assertions are not
  supported (no SP key is kept).
- **Test connection** runs a real sign-in in test mode: nothing is provisioned and no session is created; the result (address,
  name, subject, whether the domain matches) is stored on the connection. A connection can be enabled only after a passing test,
  and enforced only when enabled, with at least one verified domain, by an owner who has two-step verification.

## 5. SCIM 2.0

Base URL `<APP_URL>/api/scim/v2`, `Authorization: Bearer scim_…` (one company per token, up to 2 live). `Users` (list with
`filter=userName eq "…"` / `externalId eq "…"`, get, create, replace, patch — including Entra's string booleans — and delete) and
`Groups` (list with `displayName eq`, get, create, replace, patch members add / remove / replace, delete); `ServiceProviderConfig`,
`ResourceTypes`, `Schemas`. `active: false` deactivates the membership (access stops at once); `DELETE` removes it. A person's role
is the highest role mapped from their groups (mappings are set in the app), else the connection's default role. The owner is never
changed or removed by SCIM. Only addresses on the company's verified domains are accepted.

## 6. Audit log

One service (`server/src/services/audit.ts`, `audit()` / `auditUser()`) writes every event; routes call it, never the table.
Events: sign-in (success / failure / SSO), sign-out, two-step changes, session revocation, password change, invitations, role
changes, member removal, SCIM provisioning, API keys, websites (add / verify / delete), budget, delivery settings, share links,
mailboxes, security policy, SSO domains and connection, SCIM tokens and group mappings, and audit exports. The owner and admins see
it under Company settings → Audit log, filter by action, person and date, and export CSV (formula-safe). Retention 30 days – 7
years (default 1 year), purged daily.

## 7. Limits and what is deliberately not built

- **One SSO connection per company** (most customers have one IdP). Several domains per company are supported.
- **No IdP-initiated SAML** (the tile in Okta can start an SP-initiated login with the "initiate login URI"); unsolicited responses
  are what replay and login-CSRF attacks use.
- **No encrypted SAML assertions, no signed AuthnRequests, no Single Logout.** Assertions travel over TLS and must be signed.
- **No passwordless passkey sign-in** — passkeys are a second factor here; the first factor is the password, Google or SSO.
- **SCIM**: no `/Bulk`, no `/Me`, no sorting, filters limited to `eq` on `userName`, `externalId`, `emails.value`, `displayName`
  (what Okta and Entra ID send).
- **Audit log is per company**: a sign-in is written to every company the person belongs to; failed sign-ins for unknown
  addresses are not attributable to a company and are not logged there.
- **No SOC 2 / ISO 27001**: those are organisational programmes, not code.
- No real IdP was available while building this: OIDC is tested against a mock issuer and SAML against locally generated keys and
  signed assertions (`server/test/identity-*.test.ts`). The first real Okta / Entra connection is the owner's to make.

## 8. Settings (`app/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `IDENTITY_KEY` | — (falls back to `MAILBOX_KEY`) | 32 bytes (64 hex or base64) sealing TOTP secrets and OIDC client secrets |
| `SSO_ALLOW_PRIVATE_HOSTS` | `false` | let an OIDC issuer resolve to a private address (a Keycloak in the same Docker network, for testing only) |
| `MFA_ISSUER` | `SEO_BRAND` | the name authenticator apps show beside the account |
