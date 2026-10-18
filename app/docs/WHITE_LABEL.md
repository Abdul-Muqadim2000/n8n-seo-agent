# White-label client portal for agencies (gap G5, 2026-10-18)

Market benchmark gap #12 (`n8n/seo-agent/docs/system-review-2026-10-17/MARKET_BENCHMARK.md` §2.12 row 89, §5 row 12): agencies are
the realistic first buyers, and what they buy is a **portal under their own name** — AgencyAnalytics ($20 per client a month:
white-label portal, client logins, custom domain), SE Ranking's Agency Pack ($69 a month: white-label, client seats, own domain) and
Search Atlas client portals. Before this change an agency was one company with several websites, and a share link showed one report
with the client's logo at most (B-R2). This file is the design and the operating manual; the endpoints are in `app/API.md`
("Agencies and the client portal"), the setup guides in `shared/src/guides.ts` (area `agency`).

## 1. What it does

1. **Agency → client workspaces.** An owner turns a company into an **agency**. The agency then creates **client workspaces** — each
   is an ordinary company in the app (its own websites, runs, reports, budget, members, delivery settings, audit log), with a parent.
   Agency staff switch between clients from the sidebar; one table lists every client's websites.
2. **Branding.** The agency sets a product name, a logo (light and dark), one accent colour, a support e-mail and a footer line; a
   client workspace may override the name, the logo and the colour. With **white-label on**, everything a client sees — the portal,
   report pages, share pages, documents the app serves and e-mails the app sends — carries the agency's brand, and no "Alaventra".
   A discreet "Powered by Alaventra" line is a setting, **off by default**.
3. **Client logins.** The agency invites a client's people as **client viewer** (read-only) or **client approver** (also approves
   pages and outreach before they go out). They see a portal of their own websites — dashboards, reports, recommendations,
   approvals — and nothing of the agency or of other clients. Two-step and single-sign-on policies of G1 apply to them.
4. **Custom domain.** The portal can live on the agency's own host (`seo.agency.com`): claimed with a DNS TXT proof and a CNAME to the
   app, resolved by the request's host, with its own cookies; unverified hosts are refused; a released host cannot be taken over.
5. **Branded e-mail.** Sender name and reply-to per agency; a custom From (the agency's own mailbox, connected for link building)
   only when the domain's SPF and DKIM verify. Invitations, password e-mails of client people and scheduled report deliveries of
   client workspaces use it.
6. **Agency overview.** Every client's websites in one table — health, rankings movement, clicks change, AI visibility, alerts,
   approvals waiting, spend vs budget — with a CSV export.

## 2. Threat model

| Threat | Control |
|---|---|
| A client reads another client's data, or the agency's | Every data row is already keyed by `org_id` and read through `orgAccess()` / `siteAccess()` (one choke point). A client person has a membership in **their** workspace only; any other company id is a 404. Client roles rank **below viewer** (`client_viewer` −2, `client_approver` −1), so every existing route that asks for `viewer` or more refuses them — the portal opens only the routes listed in §4 (deny by default). Route tests walk every portal route with every role and both directions across tenants. |
| An agency employee keeps access after leaving | Inherited access is computed on every request from the agency membership: removed or SCIM-deactivated there → no client either. Assignments (staff rows in a client) are removed with the agency membership, and are honoured only while the agency membership is active. |
| Agency staff see a client they were not assigned to | Agency **owners and admins** reach every client; **members and viewers** only clients where an admin assigned them (a staff membership row in that client). |
| A client escalates to staff | Client invitations accept only client roles; staff roles in a client come only from an assignment of an existing agency member; a client role can never change roles, invite, see the team, costs, settings, runs, API keys, audit log or delivery settings. |
| Agency margins leak (what the engine costs) | Client roles never reach usage, costs, runs or budget routes; report payloads served to client roles have every cost / ledger / budget key removed (`clientSafePayload`); the portal hides every price. |
| **Custom-domain takeover** (a released host still CNAMEs to us and another tenant claims it) | A claim gets a **new random token** each time, bound to that company, published at `_portal-verification.<host>`; nobody can verify without changing that host's DNS. One verified owner per host (unique index). A host is re-checked every 6 hours; after 3 failed checks in a row (≥ 12 h) it **lapses** and is no longer served; released hosts are deleted, so the old cookies and links die with them. |
| Our app served under somebody else's name (they point their domain at us to phish our login page) | **Strict hosts**: a request whose `Host` is not the app's own host, an extra host the operator listed, or a verified portal host is answered `421 Misdirected Request` with no app content (`PORTAL_STRICT_HOSTS`, on by default when `APP_URL` is https). |
| A certificate issued for a host we do not serve | The operator's on-demand TLS asks `GET /api/portal/tls-allow?domain=<host>` first; it answers 200 only for a verified, not lapsed portal host (and the app's own hosts), else 404. |
| A session cookie shared across tenants' hosts | Cookies are host-only (no `Domain` attribute), so a session on `seo.agency-a.com` is never sent to `seo.agency-b.com` or to the app host. On a portal host every company outside that agency is a 404, and `/api/me` lists only that agency's workspaces. |
| Single sign-on / Google on a custom host (their redirect URIs are registered for the app host only) | The portal host signs in with a password (+ two-step) locally, or **hands off**: sign in on the app host, then `POST /api/portal/handoff` returns a one-use link (60 s, bound to person and host, SHA-256 stored) that opens a session on the portal host carrying the same method, two-step and SSO company — so G1's policies still hold. |
| An open redirect through the portal | Hand-off targets are only verified portal hosts; `next` after sign-in stays a relative path (`safeNext`). |
| CSS injection through a brand colour | Colours are parsed as `#rrggbb` only; tokens are computed from numbers and written by our code; nothing the agency types reaches a stylesheet as text. Logos must be https on a dotted public host (`brandLogoUrl`, B-R2's rule). |
| A brand colour that breaks contrast or dark mode | The accent is adjusted (darkened for light mode, lightened for dark) until text on it and it as text pass **WCAG AA 4.5:1** on page, surface and surface-2 in both modes; the settings page shows what was adjusted and the ratios. |
| A spoofed custom From | Only a mailbox the agency connected (it proved the password / OAuth), and only when its domain publishes SPF **and** a DKIM key (common selectors or the one they name); re-checked before use, falls back to the platform address with the sender name when it fails. |
| A client approves something the agency then changes | An approval names the item (a page report, or one outreach draft by prospect and type); with "client approval required" on, a live CMS publish and an outreach approval of that item are refused until an *approved* decision exists; asking again withdraws the old request. |
| Admin actions without trace | Every agency action is audited (G1 `audit()`): agency mode, client created / deleted, staff assigned, branding, portal domain claimed / verified / lapsed / released, e-mail settings, approvals requested / decided. |

## 3. Data model (migration `0013_g5_white_label`, after G4's `0012_g4_integrations`)

- `organizations.kind` — `standard` (default) | `agency` | `client`; `organizations.parent_org_id` (the agency of a client; restrict
  on delete: an agency with clients cannot be deleted); `organizations.branding` jsonb (`Branding`, shared/src/agency.ts — agency:
  the whole set; client: an override of name / logo / colour); `organizations.portal_mail` jsonb (agency: sender name, reply-to,
  custom From mailbox id and its last check); `organizations.client_approval` boolean (client: approval required before a live
  publish / an outreach send).
- `memberships.role` gains `client_viewer` and `client_approver` (only in client workspaces). A staff role in a client workspace is an
  **assignment** of an agency member. Nobody holds `owner` in a client workspace directly: the agency's owners are its owners.
- `portal_domains` — company (agency), host, TXT token, status `pending` | `verified` | `lapsed`, verified at, last check (at, ok,
  detail), consecutive failures, created by. Unique `(org_id, host)`; unique `host` where status is verified or lapsed.
- `portal_approvals` — client workspace, website, kind `page` | `outreach`, item id (report id, or `prospect|type`), title, status
  `pending` | `approved` | `changes_requested` | `withdrawn`, request note, requested by / at, decision note, decided by / at.
- `auth_flows` (G1) holds the portal hand-off (`kind = portal_handoff`).

## 4. Access matrix

| | Agency owner | Agency admin | Agency member / viewer | Client approver | Client viewer |
|---|---|---|---|---|---|
| Agency settings, branding, domain, e-mail | owner: all; turning agency mode on | ✔ (domain release: owner) | — | — | — |
| Create / delete client | ✔ / ✔ | ✔ / — | — | — | — |
| Assign staff to a client | ✔ | ✔ | — | — | — |
| Client workspace | as owner | as admin | as assigned (member / viewer / admin) | portal | portal |
| Invite client people | ✔ | ✔ | — | — | — |
| Agency overview | all clients | all clients | assigned clients | — | — |
| Portal: websites, dashboards (overview, recommendations, search, rankings, technical, AI, backlinks), reports, files | ✔ | ✔ | ✔ | ✔ | ✔ |
| Approvals: see | ✔ | ✔ | ✔ | ✔ | ✔ |
| Approvals: ask / withdraw | ✔ | ✔ | member ✔ | — | — |
| Approvals: decide | — | — | — | ✔ | — |
| Runs, costs, usage, team, settings, audit, API keys, delivery, mailboxes | as today | as today | as today | — | — |

Portal routes open to client roles (everything else refuses them): `GET /api/orgs/:id`, `GET /api/orgs/:id/sites`, `GET
…/sites/:siteId`, `GET …/sites/:siteId/data/{overview,search,rankings,technical,ai,backlinks}`, `GET …/recommendations`, `GET
/api/orgs/:id/reports`, `GET …/reports/:reportId` (payload without costs), `GET …/files/:fileId` (rebranded, §6), `GET/POST
…/approvals…` (decide: approver).

## 5. Custom domain — what the operator configures

The app does not terminate TLS. In front of it the operator runs a reverse proxy that (1) accepts any host, (2) obtains certificates
**on demand** but asks the app first, (3) passes `Host` (or `X-Forwarded-Host` with `TRUST_PROXY=1`).

Caddy (on-demand TLS):

```
{
  on_demand_tls {
    ask http://app:4000/api/portal/tls-allow
  }
}
https:// {
  tls { on_demand }
  reverse_proxy app:4000
}
```

Settings (`app/.env`): `PORTAL_CNAME_TARGET` — the host agencies point their CNAME at (e.g. `portals.alaventra.app`, itself pointing
at the proxy); `APP_EXTRA_HOSTS` — other hosts the app answers on (comma-separated); `PORTAL_STRICT_HOSTS` — refuse every other host
(default on when `APP_URL` is https). A portal host is verified when **both** hold: `TXT _portal-verification.<host>` = `portal-verification=<token>` (no product name in DNS: clients can read it),
and the host is a CNAME to `PORTAL_CNAME_TARGET` (or, for an apex that cannot CNAME, resolves to the same addresses). Without
`PORTAL_CNAME_TARGET` only the TXT proof is checked and the page says the CNAME is not checked on this installation.

## 6. Documents the app serves to client people

The engine prints its own report brand (`SEO_BRAND`) into the documents it produces. For a client person in a white-label workspace:
Word files have that name replaced by the agency's product name inside the document (headers, footers, body, core properties),
HTML / Markdown / text / CSV / JSON files likewise; **PDF files cannot be rewritten safely** (text is glyph-encoded in compressed
streams), so the portal does not list the engine's PDF and offers **Save as PDF** of the branded report page instead (print layout).
Agency staff always get the original files.

## 7. Limits and what is deliberately not built

- **One level**: agency → clients. A client cannot be an agency; an agency cannot be a client. No reseller tiers.
- **No per-host Google / SSO redirect**: identity providers register one redirect URI; the hand-off covers it.
- **No logo upload**: logos are https URLs (the agency's site or CDN), the same rule as B-R2; no image storage to secure.
- **No engine rebranding of PDFs**: the PDF is replaced by the print view (§6). Passing the agency's name to the engine as the run's
  report brand is an owner decision (it changes the engine's request contract and every scheduled workflow).
- **No custom e-mail domain through our SMTP account**: a custom From goes through the agency's own mailbox; we never send as a
  domain from a server that domain did not authorise.
- **Approvals record decisions; they do not publish.** The agency still presses publish / approve (with the client's approval as a
  precondition when required): publishing is the agency's act and its CMS credentials stay with it.
- **No billing per client seat** — pricing rows are placeholders until the owner decides (`marketing/content/pricing.ts`).
- **No portal analytics** (who opened what) beyond the share links' open counter and the audit log.

## 8. Settings (`app/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `PORTAL_CNAME_TARGET` | — | host agencies CNAME their portal host to; empty = the CNAME is not checked |
| `APP_EXTRA_HOSTS` | — | more hosts the app answers on (e.g. the callback host, a second domain) |
| `PORTAL_STRICT_HOSTS` | on when `APP_URL` is https | refuse requests for any host that is not ours or a verified portal |
| `PORTAL_DOMAIN_CHECK_HOURS` | `6` | how often verified portal hosts are re-checked |
