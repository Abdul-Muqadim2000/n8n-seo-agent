# Part 4 — the web app: what a customer gets (journey, reports, delivery, sharing, read API, cost figures) and the reliability record

Executor D, fourth whole-system re-rating, 2026-10-17. Areas: **reporting & app** and **cost control & reliability** (criteria in
`../../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md` §3). Parts 1–5 are phase 1 (the app itself);
Part 6 is phase 2 (the reports of executors A, B and C, executions 736–797, as the app stores and renders them) and Part 7 the
reliability record.

## Header

| | |
|---|---|
| What was run | No engine run, no paid call. (1) A new customer's journey in a real browser (Playwright 1.55.0, `mcr.microsoft.com/playwright:v1.55.0-noble` on `seo-platform-dev_default`, `http://web:5173`): sign-up → onboarding (7 steps) → every site page, every tool form, runs, reports, the six company-settings tabs, account, admin, a 404 — at **1440 and 390 px, light and dark**. (2) Interactions: guides, a filled tool form, the invite flow with a second account, delivery settings, every "Start" and sidebar link. (3) The budget refusal through the API. (4) The read API `/api/v1` and MCP with this company's keys, isolation against Techand Test Co's ids, revocation. (5) Report delivery settings, the webhook address guard, "Send a test". (6) Read-only reads of the app's Postgres, the n8n Data Tables, the run ledger and n8n's executions. (7) Phase 2: all 26 Techand Test Co reports since 15:55Z rendered with the app's own `ReportView` in a real browser, and the app's own `deliveryDecision` / `shareCaveat` run on each |
| Scripts | session scratchpad only (`scratchpad/ui/*.mjs`, `scratchpad/api.py`, `scratchpad/apiv1_test.py`); `playwright@1.55.0` installed into a scratch folder and mounted at `/node_modules` (the image has browsers, not the npm package), as on 2026-10-15 |
| UTC | journey 16:01–16:02 (first pass, stopped by the onboarding crash, finding D-1) and 16:02:45; sweep 16:12:21–16:20:10; interactions, API, delivery, budget 20:33–20:40; report rendering 20:41–20:44; reads 20:30–20:50 (the session limit stopped this executor between ≈ 16:25 and 20:33) |
| Environment note | The first sweep (16:03–16:11) returned **"A new version is available"** on every dashboard and company page: Vite's dev server answered `504 (Outdated Optimize Dep)` for `/node_modules/.vite/deps/recharts.js?v=310ed69e` after a burst of HMR edits to the marketing pages that afternoon (its log, 15:24–15:41). The dev web container was restarted (`docker restart seo-platform-dev-web-1`, ≈ 16:11:40) and the sweep rerun; nothing else was changed. A dev-server artefact, not counted as an app finding; the broken sweep is kept as `scratchpad/sweep-broken-vite.json` |
| DataForSEO | none spent by this executor. Read once for the record at 20:47:21Z: **$5.432052**, today's total $2.682464 (the other executors' runs) |
| Executions created | **none** (every API check that could reach n8n was stopped in the app before it: the budget refusal, the publish check with a read-only key, an invalid body and a foreign domain) |
| Artefacts (git-ignored) | `files/ui/D-pass-20261017/` — `shots/` (journey, 212 sweep shots, interactions), `reports/` (52 report renders), `journey.json`, `sweep.json`, `interact.json`, `verify.json`, `render-results.json`; `files/D-api-v1.json`, `files/D-delivery-api.txt`, `files/D-budget-api.txt`, `files/D-ledger-since-1555.txt`, `files/D-execs-720-plus.txt`, `files/D-ops-alerts.json`, `files/D-schedule-fires.txt` |

### Runs table

| # | What | Request id | Executions | Start–end UTC | Duration | DataForSEO | Claude | Status |
|---|---|---|---|---|---|---|---|---|
| UI-1 | sign-up + onboarding, 1440 light | — | none | 16:01:47–16:02:45 | 58 s | 0 | 0 | stopped at step 6: the Tracking step crashes (D-1) |
| UI-2 | onboarding continued from the login (launch step by address, "Finish without tracking") | — | none | ≈ 16:03 | ≈ 40 s | 0 | 0 | done |
| UI-3 | sweep: 53 pages × 1440/390 × light/dark | — | none | 16:12:21–16:20:10 | 7 min 49 s | 0 | 0 | 212 visits, 204 clean, 8 flagged (4 × D-1, 4 × a checker false positive) |
| UI-4 | interactions (guides, forms, invite + second account, delivery, links) | — | none | 20:35:06–≈ 20:37 | ≈ 2 min | 0 | 0 | done |
| API-1 | budget refusal (budget $0.05 → verdict → 402 → budget back to $25) | — | none | ≈ 20:38 | < 1 s | 0 | 0 | refused as designed, no run row |
| API-2 | read API + MCP, isolation, revocation (3 keys, all revoked) | — | none | 20:39:07–20:39:26 | 19 s | 0 | 0 | done |
| API-3 | delivery settings, address guard, "Send a test" to `http://localhost:9` | — | none | ≈ 20:38 | < 10 s | 0 | 0 | done; settings reset to Off |
| R-1 | 26 Techand reports rendered with `ReportView`, 1440 light + 390 dark | — | none | 20:41:08–≈ 20:44 | ≈ 3 min | 0 | 0 | 52 renders, 0 fallbacks |

---

## Part 1 — a new customer's journey in a real browser

### What was asked

A new account `rr1017-owner-<tag>@example.org` ("Rerate Owner", created through the sign-up form), company **"Rerate 1017 Trading"**
(`7bf8e6a6-9831-4500-aeb7-bb2f008d967d`), website **`rr1017-newcustomer.example.com`** (`549aca60-7119-4a35-b731-c0c9e1d7da95`, UAE,
"We sell wholesale office supplies to companies in the UAE…"). The host does not resolve, so the site cannot be verified; every
site-bound page is seen in its locked state. No run form was submitted.

### What came back

**Sign-up and onboarding (1440 light, `shots/j01…j18`).** Home (h1 "You built the product. Now get the traffic."), "Create your
account", Company ("Welcome. Let's set up your company"), Website ("Add your website"), Verify ("Confirm that you own
rr1017-newcustomer.example.com"), Business ("Your business, in your words"), Author & profile ("Who stands behind your content" —
*"Verify rr1017-newcustomer.example.com to save a profile"*, only "Skip for now"), then:

- **Step 6 "Tracking" does not render.** The page is *"Something went wrong — useOrgCtx outside OrgLayout — Back to home"*
  (`shots/j11-ob-tracking-desktop-light.png`). Console: `Error: useOrgCtx outside OrgLayout at useOrgCtx (src/lib/context.tsx:8)
  at useEngineCal (src/lib/engine-cal.ts:9) at MonitorSettingsFields (src/components/site/MonitorSettingsFields.tsx…)`. It fails the
  same way on a reload and at 1440/390 × light/dark (4 of 4 sweep visits). "Back to home" sends the signed-in customer back into
  onboarding at the step they are on (`j16` lands on step 5, "Who stands behind your content"); its "Skip for now" leads to step 6
  again. The only ways past it are "Save and exit" or typing the launch step's address — **finding D-1**.
- The launch step reached by its address ("Review and start", `j17`) works: the monitors summary, *"Estimated cost $12.58 / month for
  weekly tracking, monitors and blog posts"*, "Run a technical audit now — About 20 minutes, about **$0.09**", "Take an AI visibility
  baseline now — About 10 minutes, about $1.09", *"Starting now costs about $1.18 · $25.00 left in this month's budget of $25.00"*,
  "Verify … to start tracking", "Start tracking" disabled. Its side progress shows **"Done: Tracking"** for the step that never
  rendered. "Finish without tracking" lands on the site overview.

**Verification ("Check now", `verify.json`, `shots/v1…v2`).**
- DNS: *"Not verified yet — Could not read the DNS records of rr1017-newcustomer.example.com (ENOTFOUND)."*
- Meta tag: *"Not verified yet — We could not open https://rr1017-newcustomer.example.com/ (ENOTFOUND), so we could not look for the
  seo-agent-verification meta tag. Check that the address is right and the site is online, then try again."* On 2026-10-15 the same
  check said the tag "was not found on the homepage".
- At 390 px the record table stacks Type / Host / Value with the value wrapped on two lines (`cropv1`, `shots/v1-…-phone-light.png`);
  on 2026-10-15 it wrapped two characters per line.
- The locked card on every site page reads *"Dashboards, tracking and site checks open once ownership is confirmed: prove it
  with a DNS record or a meta tag. Connecting your Search Console data comes after that."* (2026-10-15: it offered the service-account
  route the server refuses.)

**The sweep (`sweep.json`, 212 visits).** Pages: home, pricing, login, signup (signed out); the 7 onboarding steps; overview,
pipeline, new ladder, recommendations, search, rankings, content, technical, AI visibility, backlinks, link building, alerts, the 5
site-settings tabs; tools + all 13 tool forms; runs, reports; company, team, usage, delivery, mailboxes, API access; account; admin; a
404. Result at 1440 and 390, light and dark:

| | Count |
|---|---|
| Visits | 212 (53 × 4) |
| Console errors | 4 visits — all the Tracking step (D-1) |
| Failed requests (≥ 400 or network) | 0 (the admin page's expected 403 excluded) |
| Horizontal overflow at 390 px | **0** (2026-10-15: 3 px on the tools page) |
| Pages without an `h1` | 0 |
| "undefined" / "NaN" / "[object Object]" in visible text | 0 |
| Contrast < AA | 4 visits, all the pricing page's "Monthly" toggle (ratio 1.07): a **checker false positive** — the label is white on the ink pill (`shots/pricing-monthly-toggle.png`); the checker read the wrong background |

**Interactions (`interact.json`, `shots/i01…i16`, `starts.mjs` output).**
- **Guides.** The sidebar "Guides" opens the catalogue (sections down to "About your business": business profile, business facts,
  style guide…; mailbox guides). Verification settings → "Show me how" opens "Add the DNS record…" with the site's own host and value,
  provider tabs, "If it does not work" (DNS Checker / `dig TXT … +short`), "Copy all steps", "Send to a colleague", "Check now". Its
  "Next, or instead" offers **"Prove the website is yours with your Google account"**, a method this installation does not offer
  (`/api/auth/providers` has `google: false`; the verify step shows only DNS and meta) — D-9.
- **Every "Start" and every link works.** The three "Start" tiles open Keyword discovery / Keyword verdict / Write a page;
  "Verify … first" opens Website settings → Verification; "Open in website settings" opens the profile tab; all 17 sidebar links reach
  a page whose `h1` matches the link.
- **Invite flow.** Team → "Invite people" → e-mail + role Member → "Create invitation": *"Invitation ready — We sent an invitation to
  rr1017-member-…@example.org as member. If e-mail is not set up on this server, or it does not arrive, send them this link
  yourself:"* + the link. This server has no SMTP and the account page says *"This platform sends no e-mails: every result and
  invitation link is shown here"* — nothing was sent (D-10). Opened signed out (390 dark): *"Join Rerate 1017 Trading — Rerate Owner
  invited … as member — Create an account to join / I already have an account"*. Sign-up from it joined the company at once; the
  page then said only *"This invitation was already accepted."* with no way on (`i08`–`i10`, D-11). Team shows "Members (2)", the
  member's role selectable (Admin / Member / Viewer), "Open invitations (0)". As member: API access → *"Only owners and admins manage
  API keys"*; Report delivery readable, its controls hidden.
- **Tool form, filled (`i04`, `i05`).** Verdict "office supplies uae", UAE: *"Estimated cost about $0.18 · Counted against your
  company's monthly budget · Time about 4 min · Monthly budget $0.00 of $25.00 used … $24.82 left after it"*. Write a page: "about
  $1.41".

### Prices on screen (the tools page, the forms, the launch step) against the engine's own figure

`GET /api/orgs/:org/costs` answered `"source": "engine"` (rolling figures from `seo_cache`) with `modes`: verdict **0.1793**, keyword
(with page) **1.4094**, discover 0.7823 (with the report follow-up), describe **0.0073**, audit **0.1125**, ladder 1.7232, case study
**1.4094**, AI visibility 1.09, backlinks 0.56.

| Run | Tools page card | The form's hero and summary | Launch step | Engine (`/costs`) |
|---|---|---|---|---|
| Keyword verdict | **about $0.20** | about $0.18 | — | 0.1793 |
| Describe my website | **about $0.03** | about $0.01 | — | 0.0073 |
| Write a case study | **about $0.84** | about $1.41 | — | 1.4094 |
| Technical audit | $0.11 · full report $0.63 | $0.11 / $0.63 | **about $0.09** | 0.1125 |
| Write a page | $0.15 report · $1.41 with the page | about $1.41 | — | 1.4094 |
| Keyword discovery | from $0.63 | about $0.63 (+$1.41 page, +$0.11 / +$0.63 audit) | — | 0.63 alone |
| Ladder | from $1.66 (plan + 1 page), "~8 min" | about $1.66, plan "about $0.25", "+$1.41" per page, **"about 18 min"** | — | 1.7232 |
| AI visibility / backlinks | $1.09 / $0.56 | $1.09 / $0.56 | $1.09 | 1.09 / 0.56 |

The cards of modes without their own sentence take `info.costUsd`, the shipped table, not the calibration
(`web/src/pages/tools/ToolsPage.tsx:259`: `COST_TEXT[info.id]?.() ?? (info.costUsd > 0 ? \`about ${formatUsd(info.costUsd)}\` …)`);
the onboarding launch step is outside the company layout and shows the shipped $0.09 — D-2.

### Budget refusal (API-1, `files/D-budget-api.txt`)

Budget set to $0.05 (owner), then `POST /api/orgs/:org/runs {mode: verdict, keyword: "office supplies uae", country: UAE}` →
**402** *"This run (about $0.18) would go over your company's monthly budget ($0.00 of $0.05 used). An owner can raise the budget in
Settings → Usage, or ask the platform administrator."*, `code: budget`; `GET …/runs` stayed empty (no row); no n8n execution (the
check runs inside the transaction before `startRun`, `server/src/services/runs.ts`). Budget put back to $25.

### Where it is right

- No console error, failed request, overflow or missing `h1` on any page except the crashing step, at both widths and both themes.
- The ownership gate holds; both verification failures say what actually happened, in plain words.
- Every external ask carries a guide with the site's own values; invite, role change and the member's restrictions work.
- The budget check refuses before anything is stored or sent, with the run's own figure in the message.

### Where it is wrong

D-1, D-2, D-9, D-10, D-11 (Findings).

### The gap to the leader (3.7 AgencyAnalytics; 3.6 Semrush / Ahrefs)

The leaders' client portals carry the agency's brand on a custom domain with client logins and scheduled PDF delivery to many
recipients; here the signed-in app is Ascentra-branded, a new customer's onboarding cannot pass its own tracking step, and the app
server cannot send e-mail at all in this installation.

---

## Part 2 — the techand.ai company in the app

**No session was possible.** The company's only member is `owner@example.org` ("Test Owner", created 2026-10-02 22:18Z). No repo
script, seed or smoke test creates that account with a known password: `smoke.py`, `api_v1_check.py` and `browser_pass.mjs` create
their own `*-<tag>@example.org` accounts and delete them; `owner@example.org` occurs only in a unit-test stub
(`app/server/test/autoStart.test.ts:133`) and the toolkit's comment. No password was reset, no session or membership inserted.
Everything about the company below is read from the database, read-only — and its reports were rendered in a browser **without a
session** by loading the app's own `ReportView` from the dev server with the stored rows (Part 6).

What the company has (read 20:30–20:50Z): budget **$25**; **9 runs** in October, the newest a failed check-in of 2026-10-15
(*"The SEO engine is not configured (SEO_API_KEY missing)"*); **0 API keys**; **0 share links** (all 10 share links on the platform
belong to the 2026-10-15 test company, all revoked); `delivery_settings` **`{}`** (delivery off) — as for every company on the
platform; **`report_deliveries`: 0 rows on the whole platform**, ever. Every re-rating run since 2026-10-13 was started straight at the
engine (the toolkit, as the app would), so none has a run row; their reports are stored `scheduled: true`.

Usage page the company would see (recomputed with `GET …/usage`'s own rule, `countedRunCost`, on its rows): month 2026-10, budget
$25.00, `estimatedUsd` **$4.58** (runs: track 0.10 + describe 0.03 + verdict 0.20 + backlinks 0.25 + ladder 1.80 + page 1.20 + AI
visibility 0.90 + check-in 0; keyword checks 0.1022), `actualUsd` **$0.00** (every run's actual is "partial"), 8 runs. Against it,
the engine's own ledger recorded **$4.43** for this site between 15:55 and 16:53Z today alone (30 rows; 13 of them under the key
`app:<this company>` = $1.62) — none of it on the company's usage page or in its budget, because it did not come through the app.

---

## Part 3 — the read API `/api/v1` and MCP with a company key (`files/D-api-v1.json`)

Keys created in **Rerate 1017 Trading** only (Company settings → API access, owner session): "rr1017 read" (`read`), "rr1017
read+pc" (`read`, `publish_check`), "rr1017 revoke test" (`read`); 30-day expiry. The token was returned once, kept in memory, never
written to a file.

| Check | Answer |
|---|---|
| List keys | 200 — `id, name, prefix (asc_ + 8), scopes, state, createdAt, createdByName, expiresAt, lastUsedAt` — no token, no hash |
| A member lists / creates keys | **403** *"This needs the admin role or higher"* ×2 |
| `GET /api/v1` | 200 — company id + name, `auth: api_key`, the key's id/name/prefix/scopes, limits, endpoints |
| `GET /websites`, `/websites/:own` | 200 — `{id, domain, country, verified: false, verifiedAt: null, trackingStatus: not_started, createdAt}` |
| `GET /websites/:own/audits` (unverified) | **403** `website_unverified` *"Verify that you own rr1017-newcustomer.example.com in the app before its audits can be read"* |
| `GET /runs`, `/reports?limit=5` | 200 — `{items: [], nextCursor: null}` |
| **Cross-company**: Techand's website, its audits, run, report, file; `/runs?websiteId=` and `/reports?websiteId=` with Techand's site | **404** ×7 — "Website not found" / "Run not found" / "Report not found" / "File not found", the same answer as an id that does not exist |
| Own session + `X-Org-Id: <Techand>` | **404** "Company not found" (own company id: 200) |
| Key → `POST /api/v1/runs` · `POST /api/orgs/:org/runs` · `GET /api/orgs/:org/members` | 404 · **401** · **401** — a key reaches nothing outside `/api/v1` |
| Publish check with a read-only key | **403** `scope_missing` |
| Publish check, `domain: techand.ai` | **400** *"domain must be one of your verified websites (or leave it out)"* |
| Publish check, invalid body | **400** *"Paste the whole page: at least 50 words"*, `keyword` required |
| Rate-limit headers | `x-ratelimit-limit: 120`, `remaining: 118`, `reset: 60` |
| MCP `initialize` | `protocolVersion 2025-06-18`, `serverInfo {name: ascentra, title: "Dev SEO — Rerate 1017 Trading"}`, instructions *"Read-only access to Rerate 1017 Trading's SEO data… Nothing here starts a run or changes a setting."* |
| MCP `tools/list` | 8 tools: `list_websites, list_audits, get_audit, list_runs, get_run, list_reports, get_report, publish_check`, each with an input schema |
| MCP `tools/call` with Techand ids (`get_run`, `get_report`, `list_audits`, `get_audit`) | `isError: true` — "Run not found", "Report not found", "Website not found" ×2 |
| MCP `list_audits` on the own unverified site | `isError: true`, the same unverified sentence |
| MCP `publish_check` with the read-only key | `isError: true` — the scope sentence (nothing reached n8n) |
| MCP with only a session cookie / an unknown key | **401** *"The MCP endpoint takes a company API key…"* / **401** `api_key_invalid` |
| Revocation | `DELETE …/api-keys/:id` → `state: revoked`, `revokedAt` set; the next `GET /websites` and MCP `tools/list` with that key → **401** `api_key_invalid` *"This API key is not valid: it is unknown, revoked or expired"*; `lastUsedAt` recorded |

**Not exercised:** a valid publish check (it starts an n8n execution — outside phase 1's "no engine run"; executor B ran
`SEOagentPubCheck` 745–748, 752); the audit endpoints with data (no verified website in a company this executor owns). All three keys
are revoked; `api_keys` holds 0 live keys on the platform.

**Where it is wrong:** the MCP server names itself **"Dev SEO"** (`SEO_BRAND` default in `server/src/config.ts:60`) to every client
of this installation, not the product name — D-12 (Low).

---

## Part 4 — report delivery and sharing

**What could be exercised (`files/D-delivery-api.txt`, `shots/i14`–`i16`).** Settings default: `frequency off`, e-mail off, webhook
off, `shareLinks: true`, `mailReady: false`, `signingReady: false`, *"No mail account on this server — Nothing can be e-mailed until
one is set up. A webhook works without it."*

| Action | Answer |
|---|---|
| Webhook `https://169.254.169.254/latest`, `https://10.0.0.5/hook`, `http://example.com/hook`, `https://metadata.google.internal/x`, `https://localhost/x` | **400** *"Enter an https:// address on a public host for the webhook"* ×5 |
| Webhook `http://localhost:9/rr1017-test`, weekly | 200, `nextAt: 2026-10-19T08:00Z` |
| Turn e-mail on | **400** *"This server has no mail account set up, so reports cannot be e-mailed yet. Use a webhook, or ask the platform administrator to connect SMTP."* |
| "Send a test" (`POST …/delivery/test`) | 200 `{delivered: false, outcomes: [{channel: webhook, ok: false, target: "localhost:9", error: "fetch failed"}]}` |
| `GET …/deliveries` after the test | `{deliveries: []}` — a test is not logged |
| A member changes the settings | **403** *"This needs the owner role or higher"* |
| Reset | `frequency: off`, webhook off (left that way) |

**What could not be exercised: share links, "Send it now" and a real delivery.** All three need a report in a company this executor
owns. The new company has none and phase 1 starts no engine run; posting a copy of Techand's stored reports into the test company
through its callback hook was **refused by the permission system** ("Sensitive-Source Provenance"), and the attempt was not repeated
in any other way. So no share link was created, opened signed out, revoked or reopened in this run. Instead, Part 6 runs the app's own
`shareCaveat` on every Techand report (what a shared link to it would say), and the code path is unchanged from the 2026-10-15
browser pass of share links. The platform has never delivered a report: `report_deliveries` = 0 rows; every company's delivery is off.

---

## Part 5 — cost figures

- **The forms show the engine's figure.** `GET /costs` → `source: engine`; the forms' heroes and summaries use it (verdict
  $0.18 = 0.1793, page $1.41 = 1.4094). The cards and the launch step still show three shipped figures (D-2).
- **Every report that has a ledger carries a cost card** (on 2026-10-15 the cards showed DataForSEO only) (Part 6): "Run ledger — What this run used: Search data
  (DataForSEO) $x · Model calls (Claude) $y · partly estimated · Total" on site description, verdicts, strategy, audits, ladder, page,
  backlinks, AI visibility, pulse, link builder, AI growth, rank tracker, site report. Every figure equals the engine's ledger row
  (table in Part 6).
- **One run's cost is shown nine times and accumulates on an unrelated run** — D-3. The Rank Tracker (exec 785) checked 9 ladders +
  the watch list for **$0.116** (ledger row 160); each of the 9 `rank_tracker` reports carries the whole run's `run_ledger`
  (`dataforseo_usd: 0.116`) and shows "Total $0.116". One of them belongs to the app run "Ladder: peppol uae" of 2026-10-08
  (`34bb79fe…`, estimated $1.80): `ingestCallback` adds every callback's ledger to its run, so that run's `actual_cost_usd` went
  0.1185 (its plan) → 0.1905 (2026-10-16, +0.072 from exec 715) → **0.3065** (today, +0.116). The run page shows it as the ladder's
  partial actual; the usage page counts the run at `max(0.3065, 1.80)` = 1.80, so the budget is not moved yet.
- **The rank tracker's figure is the account's movement, not its tasks**: `dfs_source: "account"` on 785 (`cost_basis "DataForSEO
  $0.1160 measured"`), measured while executor C's site tracker (787, started 16:44:41) and other runs were in flight — whether it
  contains another run's spend was **not verified**.
- **Platform admin page** (`/admin`): not reachable — *"You do not have access to this page — Platform administration is limited to
  the operators the server names in PLATFORM_ADMIN_EMAILS."* (`PLATFORM_ADMIN_EMAILS` is empty on the dev server).

---

## Part 6 — the reports of this run (phase 2): every Techand Test Co report since 2026-10-17T15:55Z

**Method.** The 26 `reports` rows (and their `files` metadata) were read read-only. Each was rendered in Chromium with the app's own
`ReportView`, providers and CSS loaded from the dev server (`/src/components/reports/index.ts`, `QueryClientProvider`,
`MemoryRouter`, `OrgContext` with Techand's company id), at **1440 light** and **390 dark** — no session, no request to the app's
API, nothing written (`scratchpad/ui/render_reports.mjs`; output `files/ui/D-pass-20261017/render-results.json`, shots
`…/reports/R-<n>-<stage>-<size>-<theme>.png`). On each row the app's own `deliveryDecision` and `shareCaveat`
(`/@fs/app/shared/src/index.ts`) were run. A renderer that throws would show *"This report could not be laid out"*; none did. Because
the runs were started straight at the engine, no report has a run row (except rank tracker 219's), so the app titles a verdict
"Keyword report: …" and puts no run cost on a run page — effects of the test method.

### The 26 reports

| # | Received | Request → exec | Stage · status · title | Summary the list shows | Files | Renders (1440 / 390) | `deliveryDecision` · share caveat |
|---|---|---|---|---|---|---|---|
| 0 | 16:03:26 | 757 → 758 | site_description · completed · "Site description · techand.ai" | name "Tech&", one-line summary | html | 3,880 / 3,878 chars | deliver · none |
| 1 | 16:04:58 | 759 → 760 | content · completed · "Keyword report: e invoicing software uae" (a verdict) | GO_WITH_CHANGES 52, volume 40 | pdf, doc | 3,862 / 3,846 | deliver |
| 2 | 16:05:49 | 763 → 764 | keyword_strategy · completed | 5 priority, 5 quick wins, start "erp system dubai", 1,168 researched | pdf, doc | 10,450 / 10,250 | deliver |
| 3 | 16:06:20 | 738 → 739 | site_audit · completed | health 85 Good, 0/4/7 | pdf, doc + 7 fix-pack | 7,935 / 7,437 | deliver |
| 4 | 16:07:53 | 763 → 765 | content · completed · "Keyword report: erp system dubai" | GO_WITH_CHANGES 66, volume 320, KD 27 | pdf, doc | 3,479 / 3,463 | deliver |
| 5 | 16:11:45 | 769 → 770 | ladder_plan · completed · "Ladder plan: it consulting dubai" | "Easy for your site · Direct plan · 2-4 months", 4 pages, 1 now | pdf, doc | 11,461 / 11,459 | deliver |
| 6 | 16:14:12 | 766 → 767 | full_report · completed | health 70 Needs Improvement, 0/17/18 | pdf, doc + 7 | 8,388 / 7,890 | deliver |
| 7 | 16:22:23 | 769 → 771 | content · completed · "Page: it consulting dubai" | *"Did not pass the quality check — not ready to publish (round 2 of 2): External links to sources not in the evidence plan: u.ae, difc.com, adgm.com — verify each one; Sections far below…"* | 3 webp (kind `other`), pdf, doc, html, md, json | 6,751 / 6,735 | **held `not_ready`** · caveat *"A draft, not finished work"* |
| 8 | 16:29:36 | 772 → 773 | ai_visibility_started · accepted | eta 10 | — | 589 / 587 | **held `interim`** · *"The work had only started"* |
| 9 | 16:29:38 | 774 → 775 | backlinks_started · accepted | eta 5 | — | 521 / 519 | **held `interim`** |
| 10 | 16:30:24 | 774 → 777 | backlinks · progress | 4 referring domains, 20 backlinks, 1 spammy, 60 prospects | pdf, csv, txt | 7,007 / 6,590 | deliver |
| 11 | 16:32:31 | 772 → 776 | ai_visibility · progress | 8 questions, named 0%, cited 0%, score 0 | pdf | 17,044 / 16,035 | deliver |
| 12 | 16:35:31 | rr1017-pulse → 779 | ai_pulse · progress · "AI pulse alert · techand.ai" | 21 samples, 0 alerts | html | 804 / 802 | deliver |
| 13 | 16:38:49 | rr1017-lb-paid → 781 | link_builder · progress | 0 drafted, 2 listings missing | pdf | 1,848 / 1,846 | deliver |
| 14 | 16:42:24 | rr1017-growth-dry → 783 | ai_growth · progress · "AI growth · techand.ai" | 15 earned, 6 targets, avg 81, **submitted 0**, 12 pages | — | 9,014 / 9,012 | **deliver** (a dry run — D-4) |
| 15–23 | 16:44:22 | 785 (9 reports) | rank_tracker · progress · "Rank tracker: peppol uae / erp software uae / dynamics 365 partner uae / e invoicing in uae / azure cloud migration dubai / erp implementation dubai / ai consulting dubai / the keywords you asked us to watch / it consulting dubai" | positions, next step per ladder | — | 2,352–4,051 chars each | deliver ×9 |
| 24 | 16:46:12 | rr1017-site → 787 | site_tracker · progress · "Weekly site report · techand.ai" | 30 clicks, 5,358 impressions, 81 sessions, 12 actions | pdf | 16,821 / 16,341 | deliver |
| 25 | 16:53:52 | rr1017-auditsched → 793 → 794 | site_audit · completed | health 85 Good, 0/4/6 | pdf, doc + 7 | 7,933 / 7,435 | deliver |

**52 renders: 0 fallbacks, 0 console errors, 0 failed requests, 0 px overflow at 390, no "undefined" / "NaN" / "[object Object]".**
**What never arrived:** nothing that was started is missing — the two "started" notes (8, 9) were each followed by their report
(11, 10). Page Watch (789) and the cadence (791) post no report by design.

**The delivery rule on monitor reports.** Every monitor report is still stored `status: progress` (15 of the 26), but
`finishedStatus` accepts `progress` on a report stage (`shared/src/report-delivery.ts:205–209`), so all 15 would be delivered and
shared without a caveat. On 2026-10-15 every one was held *"This run finished as "progress", not as a completed report."* Held today:
the QA-failed page (7, `not_ready`) and the two started notes (`interim`). No report was actually delivered — delivery is off for the
company.

### What the customer reads — the parts that carry the figures

- **Site description (0):** "Tech& — A Microsoft-aligned enterprise technology partner…", 28 products and services, 10 audiences, 8
  selling points, 10 seed keywords, *"Read from 6 pages"*.
- **Verdict (1):** *"Go with changes: "e invoicing software uae""*, 52/100, 40 searches, Difficulty **"Unknown"**, CPC $7.90; Why:
  *"Volume is tiny: 40 searches a month… Searchers are shortlisting a provider ahead of the 30 October 2026 ASP appointment deadline
  and the 1 January 2027 go-live…"* (dates: executor A's part).
- **Strategy (2):** *"Start with "erp system dubai" — 1,168 keywords researched, 16 relevant to your business in 13 topic clusters;
  5 priority keywords and 5 quick wins"*, "More reports are on the way — The keyword report for "erp system dubai" follows as its own
  report" — it did (4).
- **Audits (3, 25):** *"Technical health is 85/100 · Good — 0 critical and 4 high-severity issues…"*; fix first: www/non-www split,
  HTML not cacheable, orphan pages, lorem ipsum live. Report 25, 47 minutes after report 3 on the same site: *"1 fixed · 0 new · 21
  still open (compared with the technical audit of 2026-10-17)"*, "Fixed 1" — the finding *"AI crawlers see a different version of 20
  key page(s)"* (Medium, AI Search Readiness), present at 16:06 with `affected 20`, absent at 16:53; the payload's `no_longer_seen` is
  `[]` — D-5.
- **Full report (6):** *"SEO health is 70/100 · Needs Improvement — 0 critical and 17 high"*, "55 findings", *"5 fixed · 1 new · 46
  still open"*.
- **Ladder (5):** hero badge *"Easy for your site — Direct plan · 2–4 months"* and, in the same hero, tile *"Time to rank ~5 months —
  The writing model's own estimate, not measured — the plan's modelled range and its chance band are below"* — D-6.
- **Page draft (7):** *"The page for "it consulting dubai" is written"*, badge **"Not ready to publish"**, Content score 95/100,
  the four QA reasons in a red callout, file names `…-DRAFT.pdf/.doc`; "Placeholders to fill: None"; three WebP images listed as
  generic "File · it-consulting-dubai-hero.webp" (kind `other`).
- **Backlinks (10):** *"4 sites link to techand.ai — 1 new · 0 lost · 1 spammy · 60 outreach prospects"*; "Linking sites (all
  sources) 4 — DataForSEO's index alone: 19, incl. 18 link-farm links set aside"; "Spam score (the index's) 63% — the index's figure ·
  the 18 link-farm links behind it are set aside, not counted". On 2026-10-15 the same page said "3 sites" in the hero beside
  "Referring domains 18" and "Spam score 63% — High". Today the two figures are named as different sources.
- **AI visibility (11):** *"techand.ai is named in 0% of AI answers — 8 buyer questions asked on 6 AI assistants… 95% range 0%–7% ·
  54 answers · change within noise · 1 request failed"*, "AI knows your brand 5 / 5".
- **Pulse (12):** title "AI pulse alert · techand.ai", hero *"No real change in today's AI answers"*, 0 alerts — D-13 (title).
- **Link building (13):** "Pitches drafted 0 — 8 more without an e-mail address", "Not listed yet 2", *"37 sites were checked and
  left out…"*.
- **AI growth (14):** title *"AI growth: done for you this week"*, *"Pages sent to Bing and IndexNow, key pages checked for AI
  readiness…"*, "Sent to Bing / IndexNow 0 — IndexNow waits for its key file". The payload carries `dry_run: true` and `dry_run_note:
  "DRY RUN — nothing was submitted: 0 page(s) would have been sent to Bing and 0 notified through IndexNow (a test run; the weekly run
  submits)"`; the rendered page contains neither "dry" nor "test run" — D-4.
- **Rank tracker (15–23):** e.g. "e invoicing in uae": *"0 of 9 pages in Google's top 50"*, Gains / Drops *"your pages' own rises,
  beyond the page's churn"*, next step names a page that already answers a search ("refresh that page, do not publish a second one");
  the watch list: peppol uae **46** (previous 48, +2), the rest ">50". The ladder planned today (it consulting dubai) already has its
  tracker report.
- **Site report (24):** headline *"Impressions in Google up 181% — a real change · 30 clicks from Google, within normal variation"*
  (2026-10-15: "Clicks from Google are up 52% to 32" over a test that called it not significant). Its action list says, for each
  QA-failed draft, *"Fix the draft for "it consulting dubai" and run it again — it did not pass the quality check (…). Do not publish
  it as it is."* with "Write this page" (2026-10-15: "Publish the written page for "ai consulting"…").

### Does the same figure agree — report vs engine ledger

| Report | Card on the report (DataForSEO / Claude) | Ledger row (dfs_usd / ai_usd) | Agrees? |
|---|---|---|---|
| 0 site description | $0.000 / $0.007 | 144: 0 / 0.0073 | yes |
| 1 verdict | $0.022 / $0.151 "partly estimated" | 145: 0.0221 / 0.1509 | yes |
| 2 strategy | $0.275 / $0.191 | 148: 0.2754 / 0.1906 | yes |
| 3 audit | $0.095 "partly estimated" (Start Crawl $0.0846) / $0 | 136: 0.0954, estimated 0.0846 | yes |
| 4 keyword report | $0.024 / $0.120 | 149: 0.0241 / 0.12 | yes |
| 5 ladder | $0.162 / $0.148 | 151: 0.1615 / 0.1478 | yes |
| 6 full report | $0.377 / $0.059 | 150: 0.377 / 0.0592 | yes |
| 7 page | $0.024 / $0.966 | 152: 0.0241 / 0.9659 | yes |
| 10 backlinks | $0.372 / $0 | 155 (child 777): 0.3725; 154 (front door 775): 0 | yes |
| 11 AI visibility | $0.789 / $0.112 | 156 (child 776): 0.7892 / 0.1115; 153 (front door): 0 | yes |
| 12 pulse | $0.088 / $0 | 157: 0.088 | yes |
| 13 link builder | $0.050 / $0.030 | 158: 0.0498 / 0.0299 | yes |
| 14 AI growth | $0 / $0 | 159: 0 / 0 | yes |
| 15–23 rank tracker | $0.116 on **each of 9** | 160: 0.116 once | the run's total repeated per ladder (D-3) |
| 24 site report | $0.031 / $0.049 | 161: 0.031 / 0.0491 | yes |
| 25 audit | $0.032 "partly estimated" | 165: 0.032 | yes |

On 2026-10-15 the report cards showed DataForSEO only and six monitor renderers showed no cost; today every report with a ledger
shows both parts and which is estimated.

### Findings of this part

D-3, D-4, D-5, D-6, D-13 (Findings).

---

## Part 7 — the reliability record

**Executions 720–799** (`files/D-execs-720-plus.txt`). Every execution of the run (736–794) ended `success`; none `error`; ids 724–727,
732, 733, 768, 795, 796 answer 404 in n8n's API. The rest:

| Exec | Workflow · mode | When (UTC) | What |
|---|---|---|---|
| 728 | Schedule Catch-up · trigger | 09:35:32 → 10:19:36 | **canceled** after 44 min (`Catch-up Entry`, *"The execution was cancelled because it timed out"*) |
| 729 | Error Handler · error | 10:19:36 → 10:19:42 | alert for 728 (ops alert row 6): *"delivered by webhook (sent) and email (accepted by 1 recipient(s))"* |
| 730 | Error Handler · error | 12:22:21 → **12:53:57** | Console Alerts *"Trigger failed at "Mailbox Trigger"… failed at runtime and was deactivated — The IMAP server closed the connection…"*; `Post Alert Webhook` ran **1,879 s**; delivery **failed**: *"webhook failed (getaddrinfo ENOTFOUND hooks.slack.com); email failed (connect ECONNREFUSED 142.251.127.108:465)"* |
| 731 | Error Handler · error | 12:53:53 → 12:54:18 | the same trigger failure again; delivery failed the same way; next attempt 13:24 |
| 797 | Error Handler · error | 18:31:26 → 18:31:49 | the same trigger failure (sighting 5); *"webhook failed (getaddrinfo ENOTFOUND hooks.slack.com); email failed (getaddrinfo ENOTFOUND smtp.gmail.com)"* |
| 798 / 799 | Test Runner · webhook (error) / Error Handler | 20:34:48 / 20:34:50 | *"Workflow is not active and cannot be executed"* (the Test Runner was deactivated after the run); 799 alerted on it (delivered) and its `Post Alert Retry` re-sent row 4 |

**Ops alerts (`seo_ops_alerts`, 6 rows, `files/D-ops-alerts.json`):**

| Row | Alert | First / last seen | Delivered | Attempt log |
|---|---|---|---|---|
| 1–2 | main workflow timeouts, execs 461 / 459 | 2026-10-12 18:34 | webhook (re-sent by Page Watch 2026-10-15 09:45) | unchanged since 2026-10-15 |
| 3 | Console Alerts "unknown node" | 2026-10-13 03:07 | webhook (2026-10-15 09:45) | unchanged |
| 4 | **Console Alerts `Mailbox Trigger`** (critical) | 2026-10-13 17:52 / **2026-10-17 18:31** (5 sightings) | webhook on attempt 6, *"re-sent by SEO Agent — Error Handler"* | 1 10-16 00:27 delivered · 2 10-16 20:48 delivered (webhook + e-mail) · 3 10-17 12:54 **failed** both · 4 10-17 15:09 delivered · 5 10-17 18:31 **failed** both · 6 10-17 ≈ 20:34 delivered |
| 5 | Test Runner `Run Target` | 2026-10-15 19:59 / 2026-10-17 20:34 | webhook + e-mail | 2 attempts, both delivered |
| 6 | Catch-up `Catch-up Entry` timeout | 2026-10-17 10:19 | webhook + e-mail | delivered on attempt 1 |

Reading of it: when the network was up, alerts went out on both channels within seconds (729, 799; n8n's SMTP works — the app's does
not); when DNS failed (12:22–12:54 and 18:31, "ENOTFOUND hooks.slack.com"), the alert waited for the next run of any workflow and the
18:31 alert reached the webhook ≈ 2 h later. The Console Alerts IMAP trigger failed and was deactivated three times today (12:22, 12:53,
18:31); `SEOagentConsole1` reads `active: true` at 20:47.

**Schedules** (`files/D-schedule-fires.txt`, n8n `GET /executions?workflowId=…`, mode `trigger`; rules from `workflows/*.json`: AI
Pulse cron `30 6 * * 0,2-6`, Page Watch daily 05:45, both on America/New_York): the AI Pulse (due 10:30 UTC Tue–Sun) has schedule-started executions on 10-08, 10-09, 10-11, 10-13, 10-14, 10-15 and **none on 10-16 or 10-17**; Page Watch's
last is 10-16 15:15, none on 10-17; Rank Tracker, Site Tracker, Content Cadence, AI Growth, Link Builder and the Audit Scheduler still
have **no** schedule-started execution at all; AI Visibility and the Backlink Monitor one each (10-12). The weekly ones are next due on
Monday 10-19, so today's run says nothing new about them. The one catch-up attempt (728) was canceled (above) — D-7, D-8.

---

## Findings

| # | Severity | What is wrong | Evidence | Correct output |
|---|---|---|---|---|
| D-1 | **High** | **A new customer cannot pass onboarding step 6.** The Tracking step renders *"Something went wrong — useOrgCtx outside OrgLayout"* at 1440/390, light/dark, on every load. `MonitorSettingsFields` calls `useEngineCal()` (added with the price-calibration change), which needs the company layout's context; onboarding is outside it. "Back to home" returns the signed-in customer to their current onboarding step, so "Skip for now" leads back to the crash; the launch step is reachable only by typing its address, and its progress then shows "Done: Tracking" | `shots/j11-ob-tracking-desktop-light.png`, `sweep.json` (`ob-tracking` ×4: console `Error: useOrgCtx outside OrgLayout at useEngineCal (src/lib/engine-cal.ts:9) at MonitorSettingsFields`), `j14`/`j16` (root → step 5), `web/src/lib/engine-cal.ts` `useEngineCal` → `useOrgCtx` | the tracking step renders (calibration read without the company layout, or the shipped table) |
| D-2 | Medium | **Two prices for one run.** Tools cards: verdict "about $0.20" (form $0.18), describe "about $0.03" (form $0.01), case study "about $0.84" (form $1.41); onboarding launch: audit "about $0.09" (tools and form $0.11). Ladder: card "~8 min", form "about 18 min"; `GET /costs` ladder 1.7232 vs the form's "about $1.66" | `sweep.json` (`o-tools`, `t-*`, `ob-launch`); `ToolsPage.tsx:259` (`info.costUsd`, the shipped table); `/costs` answer in Part 1 | every price on screen from the engine's figure, so one run has one figure |
| D-3 | Medium | **One Rank Tracker run's cost is shown as the cost of each of its 9 reports, and accumulates on an unrelated app run.** Exec 785 cost $0.116 (ledger 160); all 9 `rank_tracker` reports show "Run ledger … Total $0.116"; the 2026-10-08 app run "Ladder: peppol uae" (`34bb79fe…`) took it into `actual_cost_usd`: 0.1185 → 0.1905 (10-16) → **0.3065** (10-17), shown as that ladder run's partial actual. The $0.116 itself is `dfs_source: account` measured while other runs were spending (not verified clean) | `render-results.json` #15–23; `reports.payload.run_ledger` of report `0c0d40c4…`; `runs` row `34bb79fe…`; `server/src/services/runs.ts` `ingestCallback` (adds `ledgerCost(body)` to the run) | each ladder's share (or the run total labelled as the whole tracker run once), and a weekly monitor's cost kept off the run that planned the ladder |
| D-4 | Medium | **A dry run reads, and would be delivered, as the week's work.** AI Growth exec 783 (`dry_run: true`): title *"AI growth: done for you this week"*, *"Pages sent to Bing and IndexNow…"*; the payload's `dry_run_note` *"DRY RUN — nothing was submitted…"* is not rendered anywhere; `deliveryDecision` → deliver, no share caveat | report `6feb9b2e…` payload; `render-results.json` #14 (no "dry" in 9,014 chars) | the dry-run note at the top, and the report held from delivery (or delivered with that caveat) |
| D-5 | Medium | **A finding that rested on an outside reading is reported "Fixed" 47 minutes later.** Audit 794 vs 739 on the same site: *"1 fixed · 0 new · 21 still open"*, Fixed: *"AI crawlers see a different version of 20 key page(s)"*; `no_longer_seen: []`. Nothing indicates the site changed in those 47 minutes (not verified on the site) | reports #3 (`6b9f795f…`, 16:06) and #25 (`793419f7…`, 16:53) `audit_diff` | "no longer seen" (as the read API's rule says), not "fixed" |
| D-6 | Low | The ladder hero shows two durations: badge *"Direct plan · 2–4 months"* and tile *"Time to rank ~5 months"* (labelled as the model's own estimate) | report #5 (`00a0da6c…`), `render-results.json` #5 | one duration, or the second visibly subordinate to the plan's range |
| D-7 | Medium | **The daily AI Pulse did not fire on schedule on 10-16 or 10-17**, and Page Watch not on 10-17; six weekly/monthly automations still have no schedule-started execution in n8n's history | `files/D-schedule-fires.txt` | a schedule-started execution every due day |
| D-8 | Medium | **Alerts depend on the network being up at the moment of failure.** Three Console Alerts trigger failures today; two deliveries failed on both channels (`ENOTFOUND hooks.slack.com`, `ENOTFOUND smtp.gmail.com` / `ECONNREFUSED …:465`), one Error Handler run spent 1,879 s in `Post Alert Webhook`, and the 18:31 alert reached the webhook ≈ 2 h later via another workflow's run; the IMAP trigger was deactivated three times | execs 730, 731, 797, 799; `seo_ops_alerts` row 4 `attempt_log` | an alert retried on its own timer within minutes, independent of other workflows running |
| D-9 | Low | The DNS guide's "Next, or instead" offers *"Prove the website is yours with your Google account"*, which this installation does not offer (`google: false`; the verify step shows DNS and meta only) | `shots/i03-verification-guide-desktop-light.png`, `interact.json` | only the methods the installation offers |
| D-10 | Low | The invite dialog says *"We sent an invitation to … as member"* on a server that sends no e-mail (the account page: *"This platform sends no e-mails"*) | `shots/i06-invite-dialog-desktop-light.png` | "Invitation ready — send them this link" when no mail account is set up |
| D-11 | Low | After signing up from an invitation, the invite page shows only *"This invitation was already accepted."* — no link into the company the person just joined | `shots/i08`–`i10` (390 dark) | "You joined Rerate 1017 Trading — Open it" |
| D-12 | Low | Customer-facing text names internal configuration: the MCP server's title is **"Dev SEO — <company>"** (`SEO_BRAND` default); the Mailboxes tab tells a customer *"(MS_OAUTH_CLIENT_ID / MS_OAUTH_CLIENT_SECRET in app/.env)"* | `files/D-api-v1.json` (`mcp initialize`); `sweep.json` `c-mailboxes`; `server/src/services/mailOauth.ts:84` | the product name; "ask your administrator to connect Microsoft 365" |
| D-13 | Low | A pulse report with 0 alerts is titled "AI pulse alert · techand.ai"; the "started" notes tell the customer the report *"arrives at your callback"*; page images are listed as generic "File" (kind `other` for `.webp`) | reports #12, #8, #9, #7 | "AI pulse · techand.ai"; "arrives here"; images shown as images |

## What could not be exercised, and why

- **The techand.ai company in a signed-in browser** (its dashboards, Pipeline "Needs you", run pages, usage page): no known
  credential for its only member (`owner@example.org`); resetting a password or inserting a session is not allowed. Its reports were
  rendered without a session instead (Part 6); its usage figures were recomputed from its rows.
- **Share links, "Send it now", a real delivery:** no report exists in a company this executor owns; posting Techand's stored
  reports into the test company was refused by the permission system and not attempted another way.
- **A valid publish check** through `/api/v1` / MCP: it starts an n8n execution (phase 1 started none).
- **Dashboards with data:** the test domain cannot be verified (it does not resolve).
- **Platform admin page and its delivery-rate figures:** no platform-admin account (`PLATFORM_ADMIN_EMAILS` empty).
- **The page draft's in-app article preview** with its HTML file: the preview fetches the file through the signed-in file route
  (no session); the report's other parts rendered.

## State left behind

- App database: users `rr1017-owner-<tag>@example.org` ("Rerate Owner") and `rr1017-member-<tag>@example.org` ("Rerate Member",
  member); company **"Rerate 1017 Trading"** (`7bf8e6a6-9831-4500-aeb7-bb2f008d967d`, `onboarding_step: done`); one **unverified**
  website `rr1017-newcustomer.example.com` (`549aca60-…`, `tracking_status: not_started`, no keywords, 0 blog posts); delivery settings stored
  explicitly as **Off** (webhook empty); 3 API keys, **all revoked**; 1 accepted invitation; budget $25 (was set to $0.05 for ≈ 1 s).
  No run, report, file, share link, delivery or keyword check.
- The dev web container was restarted once (≈ 16:11:40Z) to clear Vite's stale dependency cache.
- n8n: nothing (no execution, no Data Table row, no activation).
- Files: the git-ignored artefacts listed in the header. The scratch state file with the two test passwords is in the session
  scratchpad, not in the repository.
