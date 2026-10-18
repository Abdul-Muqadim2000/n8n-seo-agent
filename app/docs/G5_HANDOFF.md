# G5 white-label client portal for agencies — hand-off

Branch `worktree-agent-aaa2e2a52e09f5be6`, based on `feature/seo-agent-v4.5` (f7ae66e, after G1 + G2 + G3). Design and manual:
`app/docs/WHITE_LABEL.md`; endpoints: `app/API.md` ("Agencies and the client portal").

## Done (committed)

| Part | What |
|---|---|
| 1 server + shared | `shared/src/agency.ts` (kinds, client roles below viewer, `clientWorkspaceRole`, colour tokens at WCAG AA in light + dark, branding / mail / approval schemas, host rules, `clientSafePayload`), roles in `constants.ts`, audit actions (category `agency`); migration `0012_g5_white_label` (organizations kind / parent / branding / portal_mail / client_approval, `portal_domains`, `portal_approvals`); `auth/access.ts` `orgAccess` (inheritance, assignments, client roles, portal-host scoping); services `agency.ts`, `brandOf.ts`, `approvals.ts`, `portalHosts.ts` (host gate, DNS proof, re-check / lapse, TLS ask, hand-off), `portalMail.ts` (sender name, reply-to, custom From via the agency's verified mailbox, links on the portal host), `portalDocs.ts` + `docRebrand.ts` (Word / zip / text rebranded, PDF withheld), `portalShell.ts` (index.html on a portal host); `routes/agency.ts`; changes in orgs (invites, roles, delete rules), runs (reports / files for client roles), sites, data (portal dashboards), sso / scim (client workspaces provision client roles only), cms + link building (client approval required), report delivery (branded sender + links), share links (agency brand, files). Tests: `server/test/agency.test.ts` (19), `portalHosts.test.ts` (11), `portalDocs.test.ts` (7); `shared/src/agency.test.ts` (32). |

## In progress / next

- Web: query hooks + paths added; `lib/portal.tsx` (brand runtime), `Brand.tsx`, `AuthGate.tsx`, `LoginPage.tsx`, loader, settings tabs wired — still to write: `pages/settings/_components/AgencyTabs.tsx` (Branding, Portal address, Client e-mail), `pages/agency/ClientsPage.tsx`, `pages/portal/ApprovalsPage.tsx`, `pages/auth/PortalHandoffPage.tsx`, router entries, `OrgLayout` portal mode + agency nav, report page print view, share page footer, engine-cal guard for client roles.
- Guides (`portal-domain`, `portal-email-auth`), marketing (capability, solution, pricing PLACEHOLDER rows, changelog 2026-10-18), API.md, `.env.example`, README section, web render tests, browser pass.
- Before finishing: merge `feature/seo-agent-v4.5` again; if G4 landed with `0012`, renumber this migration to `0013` (regenerate the snapshot from the merged schema).

## Checks so far

- Typecheck: shared, server clean (web pending the new pages).
- Tests: shared 456 passed; server 451 passed, 29 skipped (incl. the 37 new).

## Owner decisions

- Pricing of the agency plan / per-client seats (rows marked PLACEHOLDER).
- `PORTAL_CNAME_TARGET`, the reverse proxy with on-demand TLS (`WHITE_LABEL.md` §5), `APP_EXTRA_HOSTS`, `PORTAL_STRICT_HOSTS`.
- Whether the engine should print the agency's name into PDFs (an engine change; today the portal withholds the engine PDF from white-label clients and offers the printable page).
