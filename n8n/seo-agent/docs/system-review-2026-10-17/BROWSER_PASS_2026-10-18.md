# Browser pass of the Ascentra web app, 2026-10-18 (Phase D)

Dev stack, branch `feature/seo-agent-v4.5` (migrations 0009-0012). No code was changed, no git write was run, nothing was deployed to n8n, no run was started, nothing was sent to a third party (the only outbound attempt was the CMS connect test to a host that does not resolve).

## Setup

| | |
|---|---|
| Server restart | `docker restart seo-platform-dev-server-1` once at 08:23 UTC. It answered `/api/health` 200 and logged "SEO platform server ready". The log has **no migration line** (migrations are silent); proof they ran: `drizzle.__drizzle_migrations` holds 13 rows (0000-0012) and the new tables exist (`audit_events`, `cms_connections`, `cms_items`, `cms_publishes`, `crawler_*`, `webhook_endpoints`, `webhook_deliveries`). Before that the log showed transient `tsx` watch errors (`#cjs-loader`, missing `tsx/dist/preflight.cjs`) at 08:20 while `node_modules` was being rewritten (the server also restarted itself at 08:19:48); it settled. No n8n or DB container was touched. |
| Web container | Not restarted. After the new dependency `@simplewebauthn/browser` appeared, Vite answered `504 Outdated Optimize Dep` for `react-hook-form` and `@hookform/resolvers/zod` (see issue 2). Fixed by `touch app/web/vite.config.ts` (Vite restarts its own server; mtime only, no content change). |
| Browser | Playwright 1.55.0 in `mcr.microsoft.com/playwright:v1.55.0-noble`, network `seo-platform-dev_default`, `http://web:5173`; 1440x900 and 390x844, light and dark (`colorScheme`), reduced motion. Scripts and state: `/private/tmp/claude-502/-Users-abdul-muqadim-n8n-devaicon/a4583495-2316-42f6-b8e6-d478dfecb004/scratchpad/phaseD/` (`run.sh`, `signup.mjs`, `sweep.mjs`, `interact.mjs`, `bits.mjs`, `mfa*.mjs`, `sweep2.mjs`, `guides.mjs`). |
| Account | New sign-up `rr1018-0827is6@example.org`, company **Rerate 1018 Trading** (`b93dd19d-c5a2-444b-b5ee-391ec3abc18a`), site **`rr1018-0827is6.example.com`** (`986cd027-1914-40a7-ab66-0959bdfe4ceb`). |
| Verification workaround | The host cannot be verified (no DNS). Publishing, Crawlers, API-key site tools and most tool forms are locked until a site is verified, so **after the first sweep I set `sites.verified_at` for this one test site directly in the dev Postgres** (`update sites set verified_at=now(), verification_method='dns' ...`). Everything before that (journey, sweep) saw the locked state; Publishing, Crawlers and the later sweep saw a verified, empty site. |
| Artefacts | `files/ui/phaseD/` (git-ignored): `shots/` (447 visits' screenshots + dialogs), `sweep.json`, `sweep2.json`, `interact-*.json`, `bits-*.json`, `mfa-*.json`, `journey.json`, `guides.json`, `prices.json`, `audit-export.csv`. Secrets (push key, API keys, TOTP secret, QR, recovery codes, webhook secrets) are masked in screenshots (magenta boxes). |

## Result in one paragraph

**447 recorded visits** (every page checked for console errors, failed requests, horizontal overflow, an h1, `undefined`/`NaN`/`[object Object]`, a contrast scan). **Step 6 Tracking renders now** (the 2026-10-17 crash is fixed: "Choose what to track", cost table $12.58 / month, all four combinations). **No crash, no missing h1, no console error that was not an expected 4xx, no failed request that was not an expected refusal.** Four small findings and three observations, no High.

## Visit table

"clean" = h1 present, no console error, no failed request except an intended 4xx, no overflow, no bad words, no visible layout break.

| Area | Page(s) | 1440 light | 1440 dark | 390 light | 390 dark |
|---|---|---|---|---|---|
| Journey (desktop light only, with screenshots) | sign-up, company, website, verify (DNS and meta check, guide), business, profile, **tracking**, launch, finish | clean (13 visits) | - | - | - |
| Onboarding steps by address | company, website, verify, business, profile, launch | clean | clean | clean | clean |
| Onboarding step 6 | **Tracking** | clean | clean | **issue 1** (3 px overflow) | **issue 1** |
| Auth | login, signup | clean | clean | clean | clean |
| Marketing | `/`, `/platform`, `/platform/crawler-analytics`, `/platform/integrations`, `/security`, `/pricing` | clean (pricing: checker note, issue 5) | same | same | same |
| Site dashboard (locked state, unverified) | overview, pipeline, new ladder, recommendations, search, rankings, content, technical, AI visibility, **crawlers**, backlinks, links, alerts | clean | clean | clean | clean |
| Site settings | business, verification, tracking, profile, **publishing**, delete | clean | clean | clean | clean |
| Tools | tools page + 13 forms (verdict, keyword, discover, describe, audit, ladder, track, published, checkin, case_study, profile, ai_visibility, backlinks) | clean | clean | clean | clean |
| Runs / reports | runs, reports | clean | clean | clean | clean |
| Company settings | company, team, usage, delivery, mailboxes, API access, **integrations, security, single sign-on, audit log** | clean | clean | clean | clean |
| Account, admin, 404 | account, admin (not an admin: shows its refusal), 404 | clean | clean | clean | clean |
| Verified-site, after two-step is on | account, security, SSO, audit, API, integrations, team, crawlers, publishing, overview (30 visits, signed in with recovery codes) | (covered by interaction runs below) | clean | clean | clean |
| Interactions (26 steps per combination: tools, publishing connect dialog + submit, crawlers upload dialog + sent + after, push-key dialog, integrations, webhook add, guide, API key create (masked) + write-scope, team invite dialog + created, SSO, guides) | | clean | clean | clean | clean (the "Guides" button step was not reachable at 390 px by the script, see Not covered) |
| Two-step flow (desktop light) | account, TOTP dialog, recovery codes, sessions, sign-out / code sign-in, wrong code, recovery-code sign-in, security tab, audit log, CSV | clean | - | - | - |

Counts by file: sweep 252, sweep2 30, interactions 104, webhook / key / guide extras 36, two-step 10, journey 13, guides 2 = 447.

## What was checked and the result

- **Prices on cards = prices on forms** (`prices.json`, plus the tools page text): verdict about $0.18, keyword discovery from $0.63, describe $0.01, write a page $0.15 report / $1.36 with the page, case study $1.36, site audit $0.09 / full report $0.63, ladder from $1.67 (plan $0.31 + $1.36 per page), AI visibility $1.09, backlinks $0.56 (free sources $0), track my site setup free and the monitors priced $12.58 / month in tracking settings (same $12.58 on onboarding step 6 and launch). Every card number appears unchanged on its form. No mismatch.
- **Website settings -> Publishing**: locked with "Verify ... first" until verified; verified: empty state, **Connect a CMS** dialog (WordPress, fake host `https://rr1018-fake-cms.example.com`) -> card "Needs attention", "The last test failed: rr1018-fake-cms.example.com could not be found (DNS)", Test connection / Remove work. No crash. Connection removed afterwards (0 rows).
- **"Publish to your CMS" panel on a page report**: not testable, a new company has no report (the Reports page shows its empty state).
- **Crawlers**: empty state ("See what Google and the AI crawlers really fetch", Not connected yet), upload dialog with a 6-line synthetic nginx log (Googlebot, GPTBot, ClaudeBot, PerplexityBot from documentation addresses, one Chrome visit) -> "Files and pushes read: nginx.log, Read, Apache / Nginx, 6 lines, 5 crawler requests"; the 5 crawler hits are all correctly labelled **"Pretended to be a crawler"** (not in the vendor's address lists), the human Chrome visit is dropped, Googlebot shows "Mostly unchecked". Push-key dialog opens (key masked); "Switch pushes off" revokes it ("Pushes are switched off").
- **Two-step**: enrolment with a TOTP computed from the shown secret -> "Two-step verification is on", **recovery codes dialog shown** (10 codes, Copy all / Download / I saved them). Sign out, password sign-in lands on "Confirm it is you", the computed code signs in; a wrong code gives 401 with "did not match. Enter the newest code from your app."; a recovery code signs in and raises the "N recovery codes left" warning. Audit log recorded each (TOTP enabled, wrong second-step code x2, signed in, signed out, signed in with a recovery code).
- **Sessions**: "Where you're signed in" lists the sessions with device, "This device" and a Two-step badge (21 rows after this pass: every scripted login is a session).
- **Company Security / Audit log**: Security tab (require two-step, SSO / Google count as two-step, idle timeout, retention 1 year, who has two-step) renders. Audit log shows my actions (sign-ins, API keys created / revoked, event endpoints added / removed, invitations, authenticator enabled, wrong codes, website added, ownership check failed, company created); **Export CSV** downloads `rerate-1018-trading-audit-2026-10-18.csv` (63 rows; columns time, action, description, outcome, actor, target, ip, user_agent, details). The CSV contains only API-key prefixes (the same ones the key list shows), no secrets.
- **Single sign-on tab**: renders (domains, SCIM card); nothing configured.
- **Integrations tab**: renders (Slack / Teams / signed JSON webhooks, Jira / Linear / Asana, data export, Looker Studio, AI assistants (MCP) snippets). Webhook add (format "Signed JSON"): `http://hooks.example.com/x`, `https://127.0.0.1/hook`, `https://169.254.169.254/latest` are **refused** with "Enter an https:// address on a public host"; `https://hooks.example.com/rr1018` is **accepted** (signing secret callout, masked); `http://localhost:9/x` is **accepted** (issue 6). A Slack-format endpoint needs a `hooks.slack.com/services/` address (clear message). After about six creates in a minute the API answered "Too many attempts. Please wait a minute and try again." (a rate limit, not an issue). Guides open ("Add Ascentra to Looker Studio").
- **API keys with scopes**: four scopes (read, check a page before publishing, start analyses + create tickets, manage webhooks + exports); creating with the defaults gives a "copy it now" callout (masked) and a row "read - publish check", expires in 90 days; ticking "start analyses" shows the "This key can change things" warning; revoke works (confirm is a native `window.confirm`). All keys revoked.
- **Team invite**: dialog -> "Invitation ready" with the copyable link (no e-mail is sent, said so on screen), "Open Invitations (1)" with Withdraw. (The invite link was not opened as a second user.)
- **Guides**: the sidebar "Guides" catalogue opens, search "crawler" lists the crawler-log guides and one opens; per-field "Show me how" buttons open the right guide (verification, publishing, crawlers, integrations).

## Issues

| # | Severity | Issue | Screenshot | Steps to reproduce |
|---|---|---|---|---|
| 1 | Low | **Step 6 Tracking at 390 px scrolls sideways by 3 px.** The "Keywords to track" fieldset (and the tag input, hint, "How do I choose these?" button) end at x = 393 on a 390 px viewport. Same in light and dark. | `files/ui/phaseD/shots/ob-tracking-phone-light.png`, `ob-tracking-phone-dark.png` (culprit list in `sweep.json`) | Sign in as the new account, open `/onboarding/<org>/tracking?site=<site>` at 390 px; `document.documentElement.scrollWidth - clientWidth = 3`. |
| 2 | Low (dev stack only) | **Vite answers `504 Outdated Optimize Dep` after a dependency change, so every page shows "A new version is available" and the sign-up form never renders.** Cause: the new dependency `@simplewebauthn/browser` made Vite re-optimise at 08:19:46; the already running Vite kept serving stale `?v=` hashes for `react-hook-form` and `@hookform/resolvers/zod` to fresh browsers too. Cleared by touching `vite.config.ts`. Same family as the 2026-10-17 finding. | none (h1 reads "A new version is available") | With the dev stack up, add a dependency used by the web app without restarting the web container, open `/signup`: two 504s in the console. |
| 3 | Medium | **Security-relevant actions are missing from the audit log.** Connecting / removing a CMS (WordPress credentials), creating / revoking a crawler push key and uploading a server log produce **no audit event** (the shared action list has no `cms.*` / `crawler.*` entries; the CSV after these actions has none), while API keys, event endpoints, invitations and sign-ins are all recorded. Unverified whether intended. | `files/ui/phaseD/shots/m11-audit-log-desktop-light.png`, `audit-export.csv` | Connect a CMS on Website settings -> Publishing, create a push key on Crawlers, then open Company settings -> Audit log: nothing for either. |
| 4 | Low (copy) | **Crawlers hero reads "- of crawler requests were proved to come from the vendor."** with no number when none was proved (all 5 requests were spoofed). The dash replaces the share, the sentence loses its subject. | `files/ui/phaseD/shots/i09-crawlers-after-upload-desktop-light.png` | Upload `nginx.log`-style lines whose addresses are not the vendors' (e.g. 203.0.113.x as Googlebot): hero title "No crawler request in the last 30 days of your logs" with the sub-line starting "-". |
| 5 | Low (unconfirmed) | **Contrast scan flags `/pricing` "Monthly" at 1.07:1** in all four combinations. Probably a false positive of the scanner (the active billing-toggle label sits on a dark fill the scanner's background walk does not see; the screenshot shows light text on a dark pill), not verified at pixel level. | `files/ui/phaseD/shots/m-pricing-desktop-light.png` | Open `/pricing`, run the scan in `lib.mjs` (`CONTRAST`). |
| 6 | Low (design note) | **Webhook endpoints accept `http://localhost:<port>/...`** for the signed-JSON format (documented in `shared/src/report-delivery.ts` as "a developer's own machine"). It is allowed in any environment by that rule, not only when `NODE_ENV` is not production (the CMS and SSO guards are dev-only switches). Delivery is separately guarded at connect time (`lib/netGuard.ts`); a test delivery was not sent. | `files/ui/phaseD/shots/b02-webhook-http-localhost-desktop-light.png` | Integrations -> Add endpoint -> Signed JSON -> address `http://localhost:9/x` -> created with a signing secret. |
| 7 | Low (cosmetic) | **Publishing: the "Connect a CMS" button sits tight under the card description** with almost no space to the card's bottom edge (the card has no body padding below the header when a connection exists). | `files/ui/phaseD/shots/i04-publishing-connect-submit-desktop-light.png` | Connect any CMS, look at the top card on Website settings -> Publishing. |

Not issues, recorded so nobody chases them: 400s from refused webhook addresses, 401 / 400 from the two-step wrong-code and unformatted-recovery-code attempts, "Too many attempts" on the ninth webhook create in a minute, the full-page screenshots showing the sticky sidebar / sticky footer bar in the middle of the page (screenshot artefact).

## Not covered

- A page report's "Publish to your CMS" panel and "Send to colleague / share" on a report (no report in a new company).
- Single sign-on, SCIM, passkeys: SSO only rendered (no IdP configured); passkey add needs a hardware authenticator, not tried.
- Webhook acceptance of `https://hooks.example.com/...` at 390 px and in dark was blocked by the create rate limit during the repeated runs (it was verified at 1440 light). The "Guides" sidebar button was only exercised at 1440 (at 390 px the sidebar is behind the menu and the script did not open it).
- The accepted-invite flow (opening the link as a second user), "Sign out all others", the log retention purge, Delete all log data.

## State left behind

- Test account `rr1018-0827is6@example.org` (password and TOTP secret in the scratch `phaseD/state/state.json` only), **two-step verification ON** (authenticator + 10 recovery codes, **5 used**, 5 left), about 25 sessions.
- Company "Rerate 1018 Trading" `b93dd19d-c5a2-444b-b5ee-391ec3abc18a`, site `rr1018-0827is6.example.com` `986cd027-1914-40a7-ab66-0959bdfe4ceb` **marked verified directly in the dev DB** (`verification_method = dns`); onboarding finished without tracking.
- API keys: 7 created, **all 7 revoked** (0 active). Webhook endpoints: all removed (0). CMS connection: removed (0). Crawler push key: revoked. Crawler log: one upload `nginx.log` (6 lines, 5 crawler requests) stays on the site.
- 5 open team invitations to `rr1018-guest-*@example.org` (links never sent).
- Audit log holds all of the above (63 events).
- Services: `seo-platform-dev-server-1` restarted once; `vite.config.ts` mtime touched (Vite restarted its own server); no n8n container, DB container or workflow touched, no run started, no spend.
