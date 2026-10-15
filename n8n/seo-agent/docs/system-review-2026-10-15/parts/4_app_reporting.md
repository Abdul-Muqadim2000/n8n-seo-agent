# Part 4 — the web app: what a customer gets (reports, dashboards, delivery, sharing, cost figures) and the reliability evidence

Executor D, re-rating of 2026-10-15. Areas: **reporting & app** and **cost control & reliability** (criteria in
`../../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md` §3). Parts 1–3 below; part 4 (the reports of
executions 594 onward) is added after the other executors' runs.

## Header

| | |
|---|---|
| What was run | No n8n run, no paid call. (1) The repo's own browser pass, **phase 1 only** (`app/scripts/browser_pass.mjs phase1`). (2) A supplementary pass written for this re-rating (`scratchpad/ui/extra_pass.mjs`, not in the repo) with **the account phase 1 created**: 24 pages × 1440/375 × light/dark plus 6 interactions. (3) One claimed-domain refusal check (`scratchpad/ui/claimed.mjs`). (4) Read-only reads of the app's Postgres, the n8n public API (executions) and the n8n Data Tables |
| UTC | phase 1 19:04:47–19:05:00; supplementary 19:06:32–19:10:39; claimed-domain ≈ 19:11; reads 19:12–19:25, all on 2026-10-15 |
| DataForSEO balance | not touched by this executor; read once for the record at 19:19:24Z: **$12.735491**, today's spend $1.056488 (other executors' runs) |
| Executions created | **none** |
| Mount adaptation | the Playwright image has the browsers but not the `playwright` npm package, and `app/node_modules` does not hold it either (first attempt: `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'`). `playwright@1.55.0` was installed into a scratch folder and mounted read-only at `/node_modules`; the script was not changed. `SITE_DOMAIN=rr1015-newcustomer.example.com` was passed because the script's default domain `br2-demo.example-shop.com` is already verified by another test company (it would have been refused with 409) |
| Artefacts (git-ignored) | `files/ui/phase1-20261015T190412/` — `shots/` (5 phase-1 PNGs), `extra/` (104 PNGs), `browser-pass.json`, `extra-results.json`, `claimed.json`; `files/D-delivery-rate-2026-10-15T1914Z.json` |

### Runs table

| # | What | Request id | Executions | Start–end UTC | Duration | DataForSEO | Claude | Status |
|---|---|---|---|---|---|---|---|---|
| UI-1 | browser pass phase 1 (sign-up → company → website → verify) | — | none | 19:04:47–19:05:00 | 13 s | 0 | 0 | 5 visits, all checks clean |
| UI-2 | supplementary pass (24 pages × 4 size/theme + 6 interactions) | — | none | 19:06:32–19:10:39 | 4 min 7 s | 0 | 0 | 102 visits, 2 with 3 px overflow |
| UI-3 | add `techand.ai` as a second website of the new company | — | none | ≈ 19:11 | < 5 s | 0 | 0 | refused with 409 as designed, nothing created |

---

## Part 1 — a new customer's journey in a real browser

### What was asked

A new account (`b-r2-pass-lyyls6@example.org`, name "Pass Owner", created by the script through the sign-up form), company
"Northwind Trading" (`15b2c553-d6b8-4682-8519-d8baf5c50707`), website `rr1015-newcustomer.example.com` (`1692173a-…`, country UAE).
No run was started; no run form was submitted. The only server-side actions beyond sign-up / company / website: "Check now" for the
DNS record and for the meta tag on the verify step, and an "Add website" with `techand.ai`.

### What came back — per page, per size

Phase 1 (1440 light only, as the script is written): 5 visits — marketing home, sign-up, onboarding company, onboarding website,
onboarding verify — **0 console errors, 0 failed requests, 0 px overflow, one `h1` each, 0 contrast failures**
(`files/ui/phase1-20261015T190412/browser-pass.json`).

Supplementary pass, every page at **1440 light, 375 light, 1440 dark, 375 dark** (reduced motion on, so scroll reveals render):

| Page | h1 | Console errors | Failed requests | Overflow | Contrast < AA |
|---|---|---|---|---|---|
| marketing home `/` | "Compounding growth in search and AI answers, on autopilot." | 0 | 0 | 0 | 0 |
| `/login`, `/signup` | "Sign in", "Create your account" | 0 | 0 | 0 | 0 |
| onboarding verify / business / profile / tracking / launch | step titles (below) | 0 | 0 | 0 | 0 |
| `/o/:org` (redirects to the site overview), overview, search & traffic, pipeline | "Overview", "Search & traffic", "Pipeline" | 0 | 0 | 0 | 0 |
| `/o/:org/tools` | "Run an analysis" | 0 | 0 | **3 px at 375 (light and dark)** | 0 |
| tool forms: verdict, keyword, discover, audit, ladder, AI visibility, backlinks | the tool names | 0 | 0 | 0 | 0 |
| runs, reports, usage & budget, report delivery | "Runs", "Reports", "Company settings" ×2 | 0 | 0 | 0 | 0 |

Totals: **102 visits, 0 console errors, 0 failed requests, 0 contrast failures, an `h1` on every page, overflow on 2 visits**
(`extra-results.json`). The 3 px are the tool cards (`div.rounded-xl … shadow-card`) whose right edge sits at 378 px in a 375 px
viewport, and a decorative `IMG` at 439 px (`claimed.json` → `wide`).

### What a new customer sees (from the screenshots)

- **Sign-up** (`shots/02-signup-desktop-light.png`): split screen, "Create your account — … It takes about five minutes", three
  capability lines, "Works with Google Search Console, Google Analytics 4, Bing Webmaster Tools and WordPress." No Google sign-in
  button: `GET /api/auth/providers` answers `{"google":false,"emailPassword":true,"email":false,"engineEmails":false,
  "requireEmailVerification":false}`, so no e-mail confirmation is asked for either.
- **Onboarding** — 7 steps (Company, Website, Verify ownership, Business details, Author & profile, Tracking, Launch), progress kept on
  the company. Website step: address, main country, "What you do", "Who your customers are", goal; a "Why we ask" box.
- **Verify ownership for a domain the account does not own** (`shots/05-…`, `extra/x01-…`, `extra/x02-…`): title "Confirm that you own
  rr1015-newcustomer.example.com", two methods offered (DNS record, meta tag), the record with copy buttons, "Continue" disabled, and
  "Skip for now" with *"Until it is verified, dashboards stay locked and tracking cannot start."* After "Check now":
  - DNS: *"Not verified yet — Could not read the DNS records of rr1015-newcustomer.example.com (ENOTFOUND)."* Honest.
  - Meta tag: *"Not verified yet — The seo-agent-verification meta tag was not found on the homepage of
    rr1015-newcustomer.example.com (https). Publish it inside <head> and try again."* The host does not resolve, so the homepage was
    never read; the message names a missing tag instead (finding D-12).
  - Nothing was marked verified; the app stayed locked. Adding `techand.ai` (verified by another company) was refused:
    `POST /api/orgs/…/sites` → **409** `{"error":"techand.ai is already verified by another company on this platform. If it is yours,
    contact the platform administrator.","code":"domain_claimed"}`; the page shows *"techand.ai already belongs to another company —
    … If it is your website, ask the owner of that company to invite you (Company settings → Team)."* No row was created.
- **"Show me how" guides** (`extra/x03-guide-dns-desktop-light.png`, `x06-…-phone-dark.png`, `x04-guide-catalogue`): a side panel
  "Add the DNS record that proves the domain is yours", *About 10 minutes · Your domain registrar or DNS provider · Whoever manages
  DNS — often not the same person who edits the website*, 5 steps with the site's own host and value
  (`seo-agent-verification=GsmJ…`), provider tabs (Cloudflare, GoDaddy, Namecheap, Squarespace, cPanel / Plesk, Somewhere else),
  "Copy all steps", "Send to a colleague", "Check now". The catalogue opens from the sidebar: *"Every job Ascentra asks you to do
  somewhere else, step by step, with your own values ready to copy. 27 guides."*
- **Business** ("Your business, in your words"), **Author & profile** ("Who stands behind your content" — *"Verify
  rr1015-newcustomer.example.com to save a profile"*, only "Skip for now"), **Tracking** ("Choose what to track"): keywords, GA4 id,
  competitors, blog posts per week (None / 1 / 2 / 3 a week with "about $4 / $7 / $11 a month"), and the growth monitors **all on by
  default** — AI visibility 20 questions on ChatGPT, Perplexity, Gemini, Claude, AI Overviews, AI Mode, daily pulse, AI growth with 2
  AI answer pages a month, backlink monitor, link builder, monthly audit — with an **"Estimated monthly cost $12.58 / month"** table
  (site report $0.12, AI visibility $3.48, daily pulse $5.92, AI growth $1.81, backlinks $0.81, link builder $0.35, audit $0.09) and
  *"Estimates from live runs. The real cost is usually lower because data that has not changed is reused. Analyses you start yourself
  are billed separately."*
- **Launch** ("Review and start", `extra/e07-…`): the summary of every choice, "Run a technical audit now — About 20 minutes, about
  $0.09", "Take an AI visibility baseline now — About 10 minutes, about $1.09", *"Starting now costs about $1.18 · $25.00 left in this
  month's budget of $25.00"*, and *"Verify rr1015-newcustomer.example.com to start tracking"*; "Start tracking" disabled, "Finish
  without tracking" available.
- **Empty / locked dashboards** (`extra/e09-…`, `e08-…-dark`): every site page shows the same locked card: *"Verify that you own
  rr1015-newcustomer.example.com — Dashboards, tracking and site checks open once ownership is confirmed: give our Google service
  account access in Search Console (this also connects your data), or add a DNS record or a meta tag."* The first of those three ways
  does not verify anything (finding D-1).
- **Tools** ("Run an analysis", `extra/e12-…`): a blue band *"Verify rr1015-newcustomer.example.com to unlock 10 more tools"*; three
  tools open without a website (Keyword discovery "from $0.40 · ~10 min", Keyword verdict "about $0.20 · ~4 min", Write a page
  "$0.40 report · $1.20 with the page · ~10 min"); the rest say "Verify … first". Forms carry a "What you get" hero with cost and time,
  a Summary card (estimated cost, "Counted against your company's monthly budget", time, the budget bar "$0.00 of $25.00 used … $24.80
  left after it"). The figures on the cards and inside the forms disagree (finding D-3).
- **Runs / Reports** — empty states: *"No reports yet — Reports arrive when a run finishes and every week once tracking is on."*
- **Usage & budget** (`extra/e22-…`): Spent this month $0.00 (0% of $25.00 · measured so far $0.00), Left $25.00, Analyses 0,
  *"Monitoring per month $0.00 — Estimate for weekly tracking and monitors of 0 tracked websites; not counted in the budget."*
- **Report delivery** (`extra/e23-…`): How often "Off"; By e-mail with *"No mail account on this server — Nothing can be e-mailed until
  one is set up. A webhook works without it."*; webhook toggle; *"Reports stay in Ascentra until you switch a channel on."*; "What went
  out — Nothing has been sent yet".

### Where it is right

- No console error, failed request or contrast failure on 107 visits across both sizes and both themes; every page has an `h1`.
- The ownership gate holds in the browser and on the server: no dashboard, tracking, profile or site-bound tool opened for an
  unverified domain, a domain verified by another company is refused with a plain message, and both "Check now" failures are shown.
- Every external ask on the path carries a guide that fills in the site's own values.
- Every form states cost and time before the run, and the budget bar shows what the run leaves.

### Where it is wrong

D-1, D-2, D-3, D-10, D-11, D-12, D-13 (see Findings).

### The gap to the leader (criterion 3.7, AgencyAnalytics; 3.6 Semrush My Reports / Ahrefs Report Builder)

The leaders' client portals put the agency's brand on the whole portal on a custom domain, with client logins. Here the customer's
mark appears only on a single shared-report page (`/share/:token`); the app a customer signs into is Ascentra-branded and has no
custom domain. The leaders schedule PDFs to many recipients by default; here every company's delivery is "Off" until an owner switches
it on, and in this installation e-mail is not possible at all (no SMTP).

---

## Part 2 — the report path in code, delivery, sharing, and the delivery-rate figures

### Callback stages the engine sends, and how the app renders them

Stages found in the engine source (`n8n/seo-agent/workflows/*.json`, `v5/code/*.js`) and the app's dispatch
(`app/web/src/components/reports/ReportView.tsx` `RENDERERS`; anything else falls to `GenericReport` in `simple.tsx`, a summary
key/value list plus a collapsible **raw JSON viewer**). "Landed" = rows in the app's `reports` table, all companies / Techand Test Co.

| Stage | Sent by | Renderer | What it shows | Landed (all / techand) |
|---|---|---|---|---|
| `site_description` | main workflow | `DescriptionReport` | the business, products and services, who it is for, what sets it apart, positioning, keywords with "Check this keyword" | 16 / 16 |
| `content` (verdict, keyword report, page) | main | `ContentReport` (+ `ArticleViewer`) | verdict hero, Why, Risks, keyword data, searches per month, secondary keywords, existing page, the page in a sandboxed iframe, SEO checks, E-E-A-T panel, `meta.json` (raw JSON block) | 23 / 19 |
| `keyword_strategy` | main | `KeywordStrategyReport` | priority keywords, quick wins, searches you already appear for, shared results pages, content plan, questions, AI search demand, competitor gaps, sources that did not answer | 7 / 5 |
| `site_audit`, `full_report` | main | `AuditReport` | issues, "Fix these first", since the last audit, fix pack, internal links, Search Console block, unindexed key pages, canonicals, structure, brand and entity check | 13 / 12, 5 / 5 |
| `ladder_plan` | main | `LadderReport` | "Not planned" when refused, why it can work, what it takes, the ladder, requirements, left out, timeline, link map | 7 / 7 |
| `rank_tracker` | Rank Tracker | `RankTrackerReport` | positions, the results pages, gains, drops | 19 / 19 |
| `site_tracker_setup`, `site_tracker` | main, Site Tracker | `TrackerSetupReport`, `SiteTrackerReport` | Search Console / GA4 connection notices, pages waiting to be published, traffic sources, check-in, queries and pages, tracked keywords, ladder pages, landing pages, Trends | 1 / 1, 8 / 8 |
| `ai_visibility_started`, `ai_visibility` | main → AI Visibility | `StartedReport`, `AiVisibilityReport` | the question × assistant grid, by assistant, share of voice, cited pages, sources, lost questions, market view, AI visits' value, how AI describes you, crawler access, by stage, fan-out searches | 5 / 5, 7 / 7 |
| `ai_pulse` | AI Pulse | `AiPulseReport` | by engine | 6 / 6 |
| `ai_growth` | AI Growth | `AiGrowthReport` | wins, what to do next, pages AI cites without you, key pages' readiness, questions to win | 7 / 7 |
| `backlinks_started`, `backlinks` | main → Backlink Monitor | `StartedReport`, `BacklinksReport` | where links were found, best links, wins, links, reclaim, competitors' new links, link gap, unlinked mentions, prospects, disavow | 13 / 13, 14 / 14 |
| `link_builder` | Link Builder | `LinkBuilderReport` | pitches drafted (and those not written), podcasts, linkable assets, listings, redirects, what your links did | 5 / 5 |
| `published` | main | `PublishedReport` | live checks, what Google sees, link to it from | 0 / 0 |
| `profile` | main | `ProfileReport` | author / E-E-A-T, local business, schema preview | 0 / 0 |
| `console_checkin` | main | `CheckinReport` | summary, Pages report, URLs | 1 / 1 |
| `content_cadence` | Content Cadence | `CadenceReport` | coming up next, waiting to be published | 0 / 0 |
| `case_study_started` | main | `StartedReport` | — | 0 / 0 |
| `console_alert` | Console Alerts | `ConsoleAlertReport` | what to do + **"Notification details" raw JSON** | 0 / 0 |
| `rejected` | API / main / Site Admin / Backlink Monitor | `RejectedReport` | "The SEO engine did not run this request", why | 3 / 3 |
| `page_watch` | Page Watch (`v5/code/Watch_Compare.js:54`) | — | **never reaches the app**: the Page Watch workflow has no callback node; its HTTP nodes post only to the ops alert webhook (`Post Watch Alert`, `Post Alert Retry (Watch)`) | 0 / 0 |
| `link_builder_started`, pre-release | Link Builder API, Pre-release | — | synchronous HTTP answers, not callbacks | — |

**No stage that has ever landed falls back to the generic raw-JSON view**; raw JSON appears inside two dedicated renderers (`meta.json`
on a page, "Notification details" on a Search Console alert) and as the crash fallback (`RenderBoundary` → *"This report could not be
laid out"* + `GenericReport`). Whether any of techand.ai's 154 October reports trips that fallback was **not verified**: rendering them
needs a session in that company (see "Could not be exercised").

### Report delivery — what has been delivered to anyone, ever

Read at 19:14–19:22Z from the app's Postgres:

| Fact | Value |
|---|---|
| `report_deliveries` rows, all companies, all time | **0** — no e-mail, no webhook, no "Send it now", no held row, ever |
| `organizations.delivery_settings` | `{}` for all 7 companies (defaults: `frequency: 'off'`, e-mail off, webhook off — `shared/src/report-delivery.ts:88`) |
| Webhook signing secret stored | none for any company (`length(delivery_webhook_secret) > 0` false for all 7; the value itself was not read out) |
| `delivery_last_run_at` | null for all 7 |
| Techand Test Co | **no delivery configured**; 154 reports in October readable in the app only |
| SMTP for the app server | `SEO_SMTP_HOST: ''` in `app/compose.dev.yml:44`; the delivery page says *"No mail account on this server"* |
| Share links (`report_shares`) | 10 in all, all created 2026-10-15 11:33–11:53Z by one test company "Northwind Trading" (`dc266091-…`, the earlier browser pass), all revoked 11:58:35Z, 34 opens in total. **None for Techand Test Co.** None created by a delivery (`created_by` null: 0) |

The code path exists (`server/src/services/reportDelivery.ts`: `deliveryTick` every 5 minutes, `retryTick`, imported in
`server/src/index.ts:8`); the server log since its 17:50:48Z start contains no delivery job line, only four `GET …/delivery` page reads
by this executor's browser. **So the only route by which any report has reached a person is a person opening the app.**

### The platform admin's delivery-rate figures — computed from the same facts

The code is `server/src/services/delivery.ts` (`GET /api/admin/delivery`). It measures three things over 6 whole weeks: on-demand runs
(an app `runs` row that completed with ≥ 1 report = delivered), scheduled fires (the nine `AUTOMATIONS` schedules on n8n's clock —
America/New_York, `GENERIC_TIMEZONE` unset on both the app server and n8n — against n8n's execution history, ±90 min grace), and ops
alerts (`seo_ops_alerts.delivered`). "Delivered" means **the report reached the app**, not that it reached the customer. The admin
page was not opened (no platform-admin session); the same arithmetic was rerun read-only at 19:14:37Z
(`scratchpad/ui/delivery_calc.py` → `files/D-delivery-rate-2026-10-15T1914Z.json`):

| Week (Mon) | On demand: started / delivered / failed | Scheduled: due / delivered / missed | Overall shown |
|---|---|---|---|
| 2026-09-07 | 0 / 0 / 0 | 13 / 0 / 13 | **0.0%** |
| 2026-09-14 | 0 / 0 / 0 | 13 / 0 / 13 | **0.0%** |
| 2026-09-21 | 0 / 0 / 0 | 13 / 0 / 13 | **0.0%** |
| 2026-09-28 | 5 / 5 / 0 | 14 / 0 / 14 | 26.3% |
| 2026-10-05 | 8 / 8 / 0 | 13 / 1 / 12 | 42.9% |
| 2026-10-12 (to date) | 1 / 0 / 1 | 10 / 3 / 7 | 27.3% |
| **Alerts** | 4 rows: 3 `webhook`, 1 `failed` → **75%** | | |

What lies behind those figures:
- **57 of the 72 "missed" fires are dates before the workflow existed** (n8n `GET /api/v1/workflows/<id>` `createdAt`: Rank Tracker
  2026-10-01 12:06Z, Site Tracker 10-01 22:22Z, Content Cadence 10-01 23:15Z, AI Visibility / Backlink Monitor / Audit Scheduler
  10-02 12:32Z, AI Pulse 10-07 22:21Z, AI Growth 10-10 15:14Z, Link Builder 10-11 00:42Z, Page Watch 10-13 06:16Z): all 13 + 13 + 13
  + 14 of the first four weeks and 4 of the week of 10-05 — finding D-7. **Counted only from each workflow's creation, 19 scheduled
  fires were due and 4 ran within 90 minutes** (pulse 10-08 exec 240, AI Visibility 10-12 exec 449, pulse 10-13 exec 531, pulse
  10-15 exec 593); the 15 others are the eight of the week of 10-05 (AI Visibility 10-05, pulse 10-09 / 10-10 / 10-11, Backlink
  Monitor, Rank Tracker, Site Tracker and Content Cadence 10-05) and the seven below. All ten scheduled workflows are `active: true`
  now. `scratchpad/ui/missed_split.py` holds this split.
- Week of 2026-10-12, the three delivered fires: AI Visibility exec 449 (`trigger`, 11:25Z, due 11:00Z), AI Pulse 531 (10:54Z, due
  10:30Z), AI Pulse 593 (11:11Z, due 10:30Z). Missed: Backlink Monitor (exec 451 started **16:19Z**, due 11:30Z — 4 h 49 min late),
  AI Pulse 2026-10-14 (exec 534 at 14:51Z, due 10:30Z), and **Rank Tracker, Site Tracker, AI Growth, Link Builder, Content Cadence —
  n8n holds no `trigger`-mode execution of these five workflows at all**, in any week (`GET /api/v1/executions?workflowId=…`, success
  and error, limit 250). Every execution they have is `integrated` (started by another workflow, e.g. the Test Runner) — finding D-8.
- Page Watch (`SEOagentPageWch1`, daily 05:45 New York, the tenth schedule) is not in `AUTOMATIONS`, so the page does not measure it.
  Its own history: execs 530 (2026-10-13 09:45Z), 533 (2026-10-14 12:02Z, 2 h 17 min late), 592 (2026-10-15 09:45Z).
- On-demand week of 2026-10-12: the single run is the owner's check-in of 2026-10-15 13:55:16Z, failed with *"The SEO engine is not
  configured (SEO_API_KEY missing)"*; the app server was restarted at 17:50:48Z and now has `SEO_API_KEY`, `N8N_API_KEY` and
  `MAILBOX_KEY` set (presence checked, values not read). The re-rating runs of 2026-10-13/14/15 were sent straight to the engine with
  the company's callback, so the app keeps no `runs` row for them and they are in no on-demand figure.
- Alerts (`seo_ops_alerts`): rows 1–2 (main workflow, execs 461/459, raised 2026-10-12T18:34Z) and row 3 (Console Alerts, raised
  2026-10-13T03:07Z) are `delivered: webhook` with *"delivered by webhook on attempt 1 (HTTP 200), re-sent by SEO Agent — Page Watch"*,
  `last_attempt_at` **2026-10-15T09:45:31Z** — 63 h and 54 h after they were raised. Row 4 (Console Alerts *Mailbox Trigger*, raised
  2026-10-13T17:52Z) is `failed`: *"email failed (getaddrinfo ENOTFOUND smtp.gmail.com)"*, `attempts` null, no webhook attempt. All four
  still carry `channels: "email,data_table"` — finding D-9.

**Measured or not:** the arithmetic runs on real rows and real execution history, so the figures are measured — but they measure
"reached the app", 57 of the 72 misses are counted against schedules that did not exist yet, the tenth schedule is not counted, and
none of the 2026-10-13…15 on-demand runs is in them.

### Where it is right

- Every callback stage that has ever reached the app has its own renderer; the generic view is a fallback for unknown stages and
  crashes, and the crash fallback keeps the downloads.
- Delivery refuses not-ready work by rule (`deliveryDecision`), and the delivery page says plainly that nothing has been sent and that
  e-mail is impossible on this server.
- The delivery-rate page computes "missed schedule" from the schedule's own clock against n8n's history — it is the only figure in the
  system that shows the Monday automations not running — and it names its own blind spots in `notes`.

### Where it is wrong

D-7, D-8, D-9 (see Findings).

### The gap to the leader (3.6 / 3.8 / 3.9)

Semrush My Reports and Ahrefs Report Builder send scheduled PDFs (daily to quarterly, up to 50 recipients) and AgencyAnalytics runs a
client portal; here nothing has been sent to anyone and no company has delivery switched on. The leaders run on hosted infrastructure;
here five of the nine measured weekly automations have no scheduled execution in n8n's history, and the delivery rate the page would
show for the current week is 27.3% against its own 99% target.

---

## Part 3 — cost figures the customer sees

### The app's per-mode table vs the engine's

`app/shared/src/cost.ts` `COST_TABLE` is **value-for-value identical** to the engine's shipped defaults in
`n8n/seo-agent/v5/code/_cost_cal.js` (`EST` lines 178–190, `DFS_EST` lines 191–202) for all 17 keys: content 0.80 + 0.04, report
0.16 + 0.04, verdict 0.16 + 0.04, discover 0.24 + 0.34, ladder 0.18 + 0.21, full 0.08 + 0.55, site_audit 0 + 0, crawl 0 + 0.09,
describe 0.03 + 0, ai_visibility 0.14 + 0.95, backlinks 0.06 + 0.50, assess 0 + 0.034, and 0 for track / published / checkin /
profile / case_study.

But the engine does not reserve its shipped defaults once a mode has history: `estOf()` (lines 259–270) takes the rolling mean × 1.25,
never below the recent maximum, from `seo_cache` rows `cost:ai:<mode>` / `cost:dfs:<mode>`. Read at ≈ 19:20Z (these rows are moving
while the other executors run):

| Mode | App pre-flight (`estimateRunCost`) | Engine reserves now (from `seo_cache`) | Engine's figure on today's callback |
|---|---|---|---|
| Write a page (`content`) | **$0.84** | **$1.51** (ai 1.4827 from one row: n = 1, 1.1862 — the 2026-10-14 page run; dfs 0.0301) | — |
| Keyword report (`report`) | $0.20 | $0.145 | 611 content: $0.16 |
| Verdict | $0.20 | $0.156 | 607: $0.20 |
| Discovery | $0.58 | $0.63 | 611 keyword_strategy: $0.72 |
| Ladder plan | $0.39 | $0.25 | 609: $0.26 |
| Full report | $0.63 | $0.63 | 613: $0.63 |
| Technical audit | $0.09 | $0.1125 (crawl n = 3 at 0.09) | 594: $0.11 |
| Describe | $0.03 | $0.0049 (n = 1, 0.0039) | 605: **$0.06** — basis *"the shipped estimate for describe + describe"* (finding D-5) |
| AI visibility / backlinks | $1.09 / $0.56 | same (no calibration rows) | — |

Where the stored content figure comes from: the 2026-10-14 page run's ledger says *"Claude $1.1862 ESTIMATED (… 3 streaming node(s)
report no token usage …)"* (`../system-review-2026-10-14/RESULTS.md` §2.11); the same run's Claude cost measured from the executions
in that file's §1 is **$0.540** (exec 554, of which $0.394 estimated). The engine therefore reserves $1.51 for a page on a Claude
figure 2.2× what that run was measured at, while the app shows the customer $0.84 before the run (finding D-4).

### The figures a customer reads on screen

Beside the table-driven figures, **24 lines of UI copy carry a per-mode price typed into the component**, plus a computed
`n * 1.2` per ladder page (`forms/growth.tsx:91`) — contrary to `app/web/CONVENTIONS.md` → "Cost figures: never write a per-mode
price into a component" — all at the 2026-10-02 figures:

| Where | Shows | The one table says |
|---|---|---|
| `pages/tools/ToolsPage.tsx:19–23` (tool cards) | keyword "$0.40 report · $1.20 with the page", discover "from $0.40", audit "$0.10 · full report $0.90", ladder "from $1.80 (plan + 1 page)", track "$0.10 setup" | 0.20 / 0.84, 0.58 (+0.20 report), 0.09 / 0.63, 1.23, 0 |
| `forms/site.tsx:119,126` (audit form cards) | "about $0.10 · 20 min", "about $0.90 · 30 min" — under a hero that says **$0.09** | 0.09 / 0.63 |
| `forms/growth.tsx:82,96` + page choices (ladder form) | "1 page +$1.20 / 2 pages +$2.40 / 3 pages +$3.60", "The plan itself costs about $0.60" — beside hero and summary **"about $1.23"** (`extra/e17-tool-ladder-desktop-light.png`) | 0.39 + 0.84 per page |
| `forms/research.tsx:214,375,381,382` | "Report only: about $0.40 instead of $1.20", "+$1.20", "Technical (+$0.10)", "Full report (+$0.90)" | 0.20 / 0.84 / 0.09 / 0.63 |
| `site/NewLadderPage.tsx:171,204,228,354,467,647` | discovery "about $0.40", a keyword check "about $0.05", plan "about $0.60", each page "about $1.20" | 0.58, 0.034, 0.39, 0.84 |
| `site/ContentPage.tsx:496`, `MonitorSettingsFields.tsx:134`, `pipeline/controls.tsx:243`, `BacklinksPage.tsx:95` | "$1.20 per post", AI pages "$1.20 each", "a new ladder costs about $1.80", backlinks "about $0.50 a month" | 0.84, 0.84, 1.23, 0.81 (monitor table) |

### Techand Test Co — `runs` rows and the usage page

Company budget: `monthly_budget_usd` **25**. `runs` rows of the **last 7 days** (since 2026-10-08 19:20Z): **one** —

| created | mode | status | estimated | actual | engine estimate | basis | actual_cost_estimated | reports | error |
|---|---|---|---|---|---|---|---|---|---|
| 2026-10-15 13:55:16 | checkin | failed | 0 | — | — | — | false | 0 | "The SEO engine is not configured (SEO_API_KEY missing)" (started by the company's owner account "Test Owner") |

Every other October row is older (2026-10-02 … 08): checkin 191 (0 / —), track 194 (0.10 / —), describe 197 (0.03 / —), verdict 199
(0.20 / **0.0221**), backlinks 200 (0.25 / 0.1964), ai_visibility 213 (0.90 / 0.5887), ladder 219 (1.80 / 0.1185, 5 reports),
keyword 221 (1.20 / **0.0221**). `engine_cost_estimate_usd` and `engine_cost_basis` are null on all nine rows (they predate the
field). The 139 other October reports of the company (the re-rating runs, monitor runs and Test Runner runs) arrived with no run row
and are stored `scheduled: true` (143 of 154 October reports carry `scheduled`).

What `GET /api/orgs/…/usage` returns for the company now (recomputed from `server/src/routes/orgs.ts:134–190` on the same rows):
month 2026-10, budget **$25.00**, `estimatedUsd` **$1.18** (runs 1.0778 + keyword checks 0.1022 [3 checks, 2026-10-08]),
`actualUsd` **$0.95** (0.9478), `remainingUsd` **$23.82**, runs **8**, `monitoringMonthlyUsd` **$11.14** (site report 0.12 + AI
visibility 4.32 at 8 questions / 6 engines / pulse + AI growth 1.81 + backlinks 0.81 + link builder 0.35 + audit 0.09 + 1 blog post a
week 3.64 — "not counted in the budget"). For scale, DataForSEO alone moved from $32.60 on 2026-10-01 to $12.74 tonight, almost all on
this company's site; the usage page counts only runs started from the app.

The "actual" figures of 199 / 221 / 219 are DataForSEO only: their callbacks carried `run_ledger: {dataforseo_usd: 0.0221, ai_usd:
null}` (199, 221) and `{dataforseo_usd: 0.1185, ai_usd: null}` (219). The app shows them as **"actual"** with the basis *"What this run
reported spending, from the search-data tasks it paid for and the model calls it made."* (`shared/src/cost.ts` `runCostEstimate`),
so a written page (221) reads "actual $0.02" (finding D-6). Callbacks since 2026-10-14 do carry Claude: e.g. 539 `{dataforseo_usd:
0.0221, ai_usd: 0.11, ai_cost_estimated: true}`, 548 page `{0.0241, 1.1862, true}`, 613 `{0.3936, 0.037, true,
dataforseo_estimated_usd: 0.0211}`; seven reports of tonight carry `run_cost_estimate_usd` with its basis (above).

### Where it is right

- The app's table and the engine's shipped defaults are one table, and the run page labels which figure it shows (actual / estimated
  by the engine / estimated), with the basis behind an info tip.
- Since 2026-10-14 the callbacks carry Claude and DataForSEO apart, and say when part of it is an estimate; since tonight they carry
  the engine's own pre-run estimate with a sentence of basis.
- The budget counts a finished run at what it cost rather than at its reservation.

### Where it is wrong

D-3, D-4, D-5, D-6 (see Findings). The monitors — $11.14/month on this company, $12.58/month as the default for a new site — are
outside the company budget by design and labelled so ("not counted in the budget").

### The gap to the leader (3.10, 2.14 — Semrush / Ahrefs server-side limits)

The leaders sell set plan limits enforced server-side (keywords, projects, report credits), so the customer's bill does not depend
on an estimate. Here the company budget caps only runs started from the app, at a pre-flight figure that differs from the engine's own
reservation by up to 1.8× (content), while the largest recurring spend (monitors) is shown as an estimate and not capped per company.

---

## Findings

| # | Severity | What is wrong | Evidence | Correct output |
|---|---|---|---|---|
| D-1 | Medium | The locked card on every site page tells an unverified customer that giving the service account access in Search Console confirms ownership. The server refuses that method (`sites.ts` verify: *"Search Console ownership is checked with your own Google account: use 'Verify with Google'…"*, code `use_google`; README: the service account seeing a property never counts), and in this installation no Google method is offered at all (`/api/auth/providers` → `google:false`) | `app/web/src/components/layout/SiteLayout.tsx:77`; `extra/e09-site-overview-desktop-light.png`, `e08-…-dark.png` | name only the ways that exist here: a DNS record or a meta tag (and "Verify with Google" when it is configured) |
| D-2 | Low | The onboarding step hint ("Search Console, DNS or meta tag") and the tool forms' callout ("Prove ownership once (Search Console, a DNS record or a meta tag)") offer a method the verify step does not show in this installation | `shots/05-…`, `extra/e16-tool-audit-desktop-light.png`, `e17-…` | the same two methods the panel offers |
| D-3 | Medium | Two prices for the same run on one screen: ladder form "about $1.23" beside "+$1.20 per page" and "The plan itself costs about $0.60" (= $1.80); tools list "Write a page $0.40 report · $1.20 with the page" while the form says "about $0.84"; audit hero "$0.09" over a card "about $0.10", full report "$0.90" (table $0.63); 24 lines of hard-coded prices plus `n * 1.2` | file:line list in Part 3; `extra/e12-…`, `e14-…`, `e16-…`, `e17-…` | every price from `cost.ts` (`estimateRunCost` / `keyCost`), so one run has one figure |
| D-4 | Medium | The pre-flight figure a customer sees and the budget check use the engine's *shipped defaults*, while the engine reserves its *calibrated* figure: a page $0.84 vs $1.51, a ladder plan $0.39 vs $0.25, an audit $0.09 vs $0.11. The engine's content figure itself rests on one row, $1.1862 "ESTIMATED", for a run measured at $0.540 Claude | `seo_cache` `cost:ai:content` (n 1, 1.1862), `_cost_cal.js:259–270`; `../system-review-2026-10-14/RESULTS.md` §1 (exec 554) and §2.11 | the app shows the engine's current reservation (or says it is the default), and the engine's stored figure reflects the measured cost |
| D-5 | Low | The engine's pre-run estimate for a site description counts the describe key twice: report 605 `run_cost_estimate_usd: 0.06`, basis *"Claude $0.06 (the shipped estimate for describe + describe …)"*; the stored measured describe cost is $0.0039 | app `reports` row request 605; `seo_cache` `cost:ai:describe`; `_cost_cal.js` `keysFor` (`site_description` → `describe`, plus `need_site_description` → `describe`) | $0.03 (one describe) |
| D-6 | High | Runs of 2026-10-03/08 show as **"actual"** a figure that omits Claude: page run 221 "actual $0.0221", verdict 199 $0.0221, ladder 219 $0.1185 (5 reports incl. a written page), with the basis "…and the model calls it made"; the usage page sums them as "measured so far $0.95" | `runs` rows 199/219/221; their `reports.payload.run_ledger` (`ai_usd: null`); `shared/src/cost.ts` `runCostEstimate` | "search data only — model calls not reported for this run" (or the engine's estimate for the Claude part), not "actual" |
| D-7 | Medium | The admin delivery rate counts fires from before each workflow existed as missed — 57 of the 72 "missed" fires in its six weeks, so the weeks of 09-07, 09-14 and 09-21 read 0.0% for schedules that did not exist yet, and 09-28 reads 26.3% where the runs that existed were 5 of 5; the tenth schedule (Page Watch) is not measured | `server/src/services/delivery.ts` `scheduledWeek` (no start date per automation); `AUTOMATIONS` in `shared/src/constants.ts` (nine); recomputation in `files/D-delivery-rate-2026-10-15T1914Z.json` | count a schedule from the day its workflow was first active; include Page Watch |
| D-8 | Medium | Since each workflow was created, 15 of 19 due scheduled fires have no execution within 90 minutes (7 of 10 in the week of 2026-10-12); Rank Tracker, Site Tracker, AI Growth, Link Builder and Content Cadence have **no scheduled (`trigger`) execution in n8n's history at all**, although all are `active: true`; the Backlink Monitor fired 4 h 49 min late on 10-12 (exec 451) and the 2026-10-14 pulse 4 h 21 min late (exec 534). Why the five never fired was not established here | n8n `GET /executions?workflowId=…` (success + error, limit 250), queried 19:14Z | each weekly automation runs at its time every Monday (the delivery page would then show it) |
| D-9 | Medium | Ops alerts reached the webhook 54–63 hours after they were raised (rows 1–3, delivered 2026-10-15T09:45:31Z by a Page Watch re-send); row 4 failed on e-mail (`ENOTFOUND smtp.gmail.com`) with no webhook attempt; `channels` still reads "email,data_table" on rows delivered by webhook | `seo_ops_alerts` rows 1–4 (`first_seen_at`, `last_attempt_at`, `notes`, `attempt_log`) | an alert on the webhook within minutes of the failure, every alert attempted on every channel, `channels` naming the channel used |
| D-10 | Low | At 375 px the DNS record table wraps the host and the value two characters per line (a ~40-line column for `seo-agent-verification=…`) | `extra/e03-ob-verify-phone-light.png`, `x06-guide-dns-phone-dark.png` | value on its own line(s) at full width, as the guide panel already does |
| D-11 | Low | `/o/:org/tools` scrolls sideways by 3 px at 375 px (tool cards end at 378 px) | `extra-results.json` (`e12-tools` phone light/dark `overflowPx: 3`), `claimed.json` `wide` | no horizontal overflow |
| D-12 | Medium | When the homepage cannot be read (here: the host does not resolve), the meta-tag check says the tag *"was not found on the homepage … Publish it inside <head> and try again"* | `server/src/services/verify.ts:92–106` (every fetch error falls through to that message); `extra/x02-verify-meta-check-desktop-light.png` | "We could not open https://<domain>/ (<reason>)", as the DNS check does |
| D-13 | Low | A new customer is shown another customer's identifiers as examples: techand.ai's GA4 property `543096312` as the placeholder of the GA4 field (and in an error message and a guide), its keyword "e invoicing software uae", its brand "Techand AI" | `components/site/TrackingForm.tsx:133,148`, `GoogleConnectionPanel.tsx:232,257`, `SiteBusinessFields.tsx:257`, `shared/src/guides.ts:249`, `forms/growth.tsx:298`, `NewLadderPage.tsx:333`; `extra/e06-ob-tracking-desktop-light.png` | neutral examples |

## What could not be exercised, and why

- **techand.ai's company in a browser** (its dashboards, reports, the run page's cost label, a share link of one of its reports, "Send
  it now"): no session in that company may be obtained (owner's instruction); everything about it here is read from the database.
- **Browser pass phase 2** (dashboards with data, a finished report, a draft, the shared page): it needs the test site marked verified
  by a database edit, which is outside this executor's brief.
- **The platform admin page** (`/admin`, delivery report): no platform-admin session; its figures were recomputed from the same facts.
- **A real report delivery** (e-mail or webhook): every company's delivery is off; switching it on for a company is a change to app data
  outside this brief, and e-mail is impossible on this server (no SMTP).
- **"Verify with Google"**: not configured in this installation (`google:false`).

## State left behind

- App database: one new user (`b-r2-pass-lyyls6@example.org`, "Pass Owner"; 3 sessions), one company "Northwind Trading"
  (`15b2c553-d6b8-4682-8519-d8baf5c50707`, `onboarding_step: launch`, not onboarded), one **unverified** website
  `rr1015-newcustomer.example.com` (`1692173a-36d6-46d8-85ed-dde6f54d3a44`). No run, report, share link, delivery or keyword check.
  The `techand.ai` add was refused; nothing was created for it.
- n8n: nothing (no execution, no Data Table row, no activation).
- Files (git-ignored): `files/ui/phase1-20261015T190412/` and `files/D-delivery-rate-2026-10-15T1914Z.json`. The browser-pass state
  file holds the test account's password as the repo script writes it.

---

## Part 4 — every report that reached the app for Techand Test Co from 18:55:00Z (executions 594–643)

Read-only, 2026-10-15 ≈ 20:40–21:30Z. Sources: the app's `reports` / `files` / `runs` rows (`files/D-report-details-since-1855.json`),
the n8n Data Tables, `seo_run_ledger` rows 79–102, and two checks run on the real rows with the app's own code in a
`node:22-bookworm-slim` container (app mounted read-only, nothing written to the app or n8n):
- **the delivery rule** — `deliveryDecision` (`shared/src/report-delivery.ts`) and `shareCaveat` (`shared/src/share.ts`) on each row
  (`scratchpad/dd/decide.ts`);
- **the renderers** — each row through `ReportView` with `react-dom/server` (`scratchpad/dd/render.tsx`,
  `files/D-render-results-since-1855.json`). A renderer that throws here is one the in-app error boundary would replace with *"This
  report could not be laid out"* and the raw view. (Ring counters render their start value "0" before the figure on a server render;
  that is not in the app.)

**Method note.** All 24 reports came from requests sent straight to the engine with the company's callback, so 23 have **no `runs`
row** and are stored `scheduled: true`; the 24th (`rank_tracker` for request 219) matched the 2026-10-08 ladder run 219, whose
`report_count` went 5 → 6 and `last_stage` → `rank_tracker`. Without a run row the app titles a verdict "Keyword report: …" (607:
its files are `keyword-verdict-e-invoicing-software-uae-…pdf`; `titleFor` only says "Verdict" when the run's mode is `verdict`), puts
no figure on the usage page or the budget, and shows no run cost. Those three effects come from the test method, not from the app.

### The 24 reports

| Received | Request → exec | Stage · title | Summary the list shows | Renders | Delivery rule (`deliveryDecision`) |
|---|---|---|---|---|---|
| 19:05:46 | 605 → 606 | site_description · "Site description · techand.ai" | name "Tech&", one-line summary | yes, 3,652 chars | deliver |
| 19:07:23 | 594 → 595 | site_audit · "Technical audit · techand.ai" | health 83 Good, 0/4/9 | yes | deliver |
| 19:07:38 | 607 → 608 | content · "Keyword report: e invoicing software uae" (a verdict) | GO_WITH_CHANGES 58, volume 40 | yes | deliver |
| 19:08:07 | 611 → 612 | keyword_strategy · "Keyword strategy · techand.ai" | 16 priority, 1 quick win, start with "construction project erp", 667 researched | yes | deliver |
| 19:09:11 | 609 → 610 | ladder_plan · "Ladder plan: ai consulting dubai" | "Reachable for your site · Short ladder · 4-8 months", 4 pages, 1 now | yes | deliver |
| 19:10:12 | 611 → 615 | content · "Keyword report: construction project erp" | GO_WITH_CHANGES 46, volume 70 | yes | deliver |
| 19:15:29 | 613 → 614 | full_report · "Full SEO report · techand.ai" | health 70 Needs Improvement, 0/17/22, +1 | yes | deliver |
| 19:23:00 | 609 → 616 | content · "Page: ai consulting" | *"Did not pass the quality check — not ready to publish (round 2 of 2) …"*, `notReadyToPublish: true`, 8 files | not checked: the preview needs the browser's `DOMParser` | **held** `not_ready` (right) |
| 19:29:40 | 619 → 620 | ai_visibility_started | eta 10 | yes | **held** `rejected`: *"finished as "accepted""* |
| 19:29:41 | 621 → 622 | backlinks_started | eta 5 | yes | **held** `rejected` |
| 19:35:29 | 619 → 623 | ai_visibility · "AI visibility report · techand.ai" | 8 questions, named 0%, cited 0%, SoV 0, score 0 | yes, 16,505 chars | **held** `rejected`: *"finished as "progress""* |
| 19:41:27 | rr1015-bl-retry → 626 | backlinks · "Backlink report · techand.ai" | referringDomains **3**, backlinks 19, 60 prospects | yes | **held** `rejected` |
| 19:43:41 | rr1015-pulse → 630 | ai_pulse | 21 samples, 0 alerts | yes | **held** `rejected` |
| 19:44:14 | rr1015-lb-paid → 628 | link_builder | 0 drafted, 2 listings missing | yes | **held** `rejected` |
| 19:48:46 | 219, 428, 494, T4b-ladder-techand, 351, 609, 548, rr1014-site → 632 | rank_tracker ×8 | per ladder: positions, drops, next step | yes, all 8 | **held** `rejected` ×8 |
| 19:49:29 | rr1015-site → 634 | site_tracker · "Weekly site report · techand.ai" | 32 clicks ▲52%, 5,308 impressions, 84 sessions | yes, 11,098 chars | **held** `rejected` |
| 19:58:46 | rr1015-auditsched → 640 → 641 | site_audit | health 83 Good, 0/4/9 | yes | deliver |

No rendered report contains "undefined", "NaN" or "[object Object]", and none fell to the raw view. **What never arrived:** a
`backlinks` report for request 621 (its monitor, 624, refused itself — engine side in part 3, finding C-1); AI Growth (not run by
design); Page Watch and the cadence dry run (no callback by design).

### Does the same figure agree in the report, the Data Tables and the ledger?

| Figure | Report payload / what the app shows | Data Table | Ledger | Agrees? |
|---|---|---|---|---|
| Technical audits 594 / 641 | health 83, High 4, Medium 9, Low 14, Info 3 ("30 findings") | `seo_audits` 19 / 21: 83, `findings 27`; `seo_audit_findings` 27 rows (Info not stored) | rows 79 / 102 `dfs_usd 0.0265` = the report's card "$0.026" | yes (Info left out of the table by design) |
| Full report 613 | health 70; High 17, Medium 22, Low 19, Info 3 | `seo_audits` 20: 70, `findings 51`, high 17 / medium 22; `seo_audit_findings` **51 rows: High 14, Medium 19, Low 18** | row 87: dfs 0.3936, ai 0.037 | **no** — the app's Technical health page reads `seo_audit_findings`, so it lists 14 high where the report says 17 (also recorded in part 2, executor B) |
| Site report 634 vs audits | "Technical audit (2026-10-15) health 70/100 ▼13" | the 70 is the full report (20), the 83 the technical audit (19) | — | **no** (part 3, C-2) |
| AI visibility 619 | named 0%, 74 answers, score 0 | `seo_ai_visibility` 9: mention 0, samples 74, score 0 | row 93: dfs 0.7794, ai 0.0678; row 90 (front door): dfs **0.95** | report = table; the request has two ledger rows (part 3, C-5) |
| AI Pulse 630 | 21 answers, 0% | `seo_ai_daily` 8: samples 21, mention 0 | row 95: 0.084 | yes |
| Site report 634 | clicks 32, impressions 5,308, sessions 84 | `seo_site_metrics` 8: 32 / 5,308 / 84, position 25.5 | row 98: dfs 0.01 "ESTIMATED" | yes (cost: part 3, C-6) |
| Rank Tracker 632 | 8 reports | `seo_rank_history`: 14 rows since 19:48 (12 desktop + 2 mobile; 2 of them are the site report's checks) | row 97: 0.12 | yes |
| Ladder 609 | 4 pages, 1 written now | `seo_ladders` `lad_mv9wshpdy2jf`: 4 rows (3 planned, 1 writing) | row 85: 0.1404 + 0.0882 | yes |
| Backlinks 626 | list summary **3** referring domains, hero *"3 sites link to techand.ai"*, tile **"Referring domains 18"**, tile **"Spam score 63% — High: many links come from spam sites"**, alert *"17 link(s) from link farms / PBN pages set aside"*, "0 spammy" | `seo_backlink_snapshots` 16: `referring_domains 18`, `union_domains 3`, `spam_score 63` | row 94: 0.3725 | **no** — finding D-16 |
| Content runs 607 / 615 / 616 | card "Data cost (DataForSEO) $0.024 / $0.022 / —" | — | rows 84 / 88 / 89: dfs 0.0241 / 0.0221 / 0.0241, ai 0.0848 / 0.0752 / **0.8933** | DataForSEO yes; the Claude part is not shown (D-18) |
| Draft pages vs the advice | 616: *"not ready to publish"*; 2026-10-14 page 548 likewise | `seo_content_log` 5 and 6: `status: written`, no quality field | — | **no** — finding D-15 |

### What the customer would see for cost

Not one of the 24 reports reaches a run page, so nothing tonight shows a run cost. On the report pages:
- the **Run ledger** card (site_audit, full_report, content, keyword_strategy, ladder_plan) shows *"Data cost (DataForSEO)"* only, with
  the tip *"Claude usage is billed by the token and is not itemised here"* — although each payload's `run_ledger` carries `ai_usd`
  (the page run: $0.8933). The audits show "$0.026" with no word that $0.0211 of it is the crawl estimate; the account moved
  $0.0374 for 641 (part 3, C-6);
- the AI visibility, backlinks, pulse, link-building, rank-tracker and site reports show **no cost at all** (their renderers have no
  ledger card, and four of those six callbacks carry no cost field);
- the started notes and the site description carry no `run_ledger` (606's row 83 settled $0.0039; its `run_cost_estimate_usd` is
  0.06).

Had the same requests come from the app (one run row each), the app would have recorded as *actual*, from `ledgerCost`: verdict
$0.1089, discovery $0.3131 + its keyword report $0.0973, ladder $0.2286 + its page $0.9174, full report $0.4306, technical audit
$0.0265 (all flagged estimated), and **AI visibility $0.7794 and backlinks $0.3725 as measured and complete** — those two are
`cost_usd`, the DataForSEO money only (the AI visibility run's Claude, ledger $0.0678 / n8n $0.1033 per part 3, is not in it); and
**no cost** for pulse, link builder, rank tracker, site tracker or site description, so a run of those modes keeps the app's estimate.
Engine pre-run estimates on tonight's callbacks: 594 $0.11, 607 $0.20, 611 $0.72 + $0.16, 609 $0.26, 613 $0.63, 616 $1.51 (against
the app's pre-flight $0.84 for a page), 605 $0.06.

### What the customer is left with for the refused backlinks request (621)

One report, *"Backlink check started — Your backlink check for techand.ai has started … The report arrives at your callback in about
3-5 minutes. About 5 min · The full report appears here as soon as it is ready. Ready in ~5 min · Compared with cleartax.com
azentio.com"*, and nothing after it. Execution 624 ended `success` (a refusal is not an error), so the app's failure watcher, which
reads failed executions, has nothing to catch. Had the run been started from the app, its row would have stayed `running` and been
expired after 3 hours (`expireStaleRuns`, `greatest(3 h, 6 × eta)`) with *"No result arrived from the SEO engine in time. The run may
have failed in n8n (ops were e-mailed); start it again or check the execution in n8n."* — no ops mail was sent for 624. The front-door
ledger row 91 settled $0.50 for it. Finding D-20.

### Findings (part 4)

| # | Severity | What is wrong | Evidence | Correct output |
|---|---|---|---|---|
| D-14 | High | **No monitor report can be delivered or shared as finished work.** The engine finishes every monitor report with `status: 'progress'` (`v5/code/AI_Report.js:133`, `BL_Report.js:140`, `LB_Report.js:94`, `Growth_Report.js:65`, and `Pulse_Metrics.js`, `Tracker_Report.js`, `Site_Report.js`, `Cadence_Status.js`), the app stores it as the report's status, and `deliveryDecision` holds every status other than completed / ok / success: *"This run finished as "progress", not as a completed report."* A share link to any of them opens under the caveat *"This run did not produce a report"*. Tonight 13 of 24 reports; in the whole table 79 of 178 (ai_growth 7, ai_pulse 7, ai_visibility 8, backlinks 15, link_builder 6, rank_tracker 27, site_tracker 9). The two started notes get code `rejected` too (the status test runs before the interim-stage test), so their caveat also reads "did not produce a report" | `scratchpad/dd/decide.ts` on tonight's rows; `shared/src/report-delivery.ts:217–219`; `select stage, status, count(*) from reports`; no `progress` case in the delivery tests | the weekly reports delivered like any finished report (one agreed "finished" status, or `progress` accepted for final stages); started notes held as `interim` |
| D-15 | High | **The customer is told to publish pages the system marked not ready.** `seo_content_log` keeps both failed drafts as `status: written` with no quality state (row 5 "azure api management monetization", row 6 "ai consulting"), and the modules downstream read that as "written — publish it": the site report's top action *"Next step · P1 Publish the written page for "ai consulting" (planned URL https://www.techand.ai/ai-consulting/) and report the link with "I published a page"."* with an "I published it" button, and its brief *"Publish the three written pages: /ai-consulting/, /service-industry-erp-software/ and /azure-api-management-monetization/"*; the Rank Tracker's next steps (*"ai consulting" (already written — publish it)*, *"azure api management monetization" (already written — publish it)*); the cadence's pile-up count (part 3: "4 written pages waiting for publication … publish them to continue"). The page reports say *"Did not pass the quality check — not ready to publish (round 2 of 2)"* (616 tonight, 548 on 2026-10-14) | report 338c4333 and the 2026-10-14 page report of request 548 (`summary.notReadyToPublish: true`); rendered text of the site report (634) and of the rank reports for 609 / 548; `seo_content_log` rows 5, 6 | "fix and re-run" for a draft that failed QA, not "publish"; a not-ready draft not counted as a page waiting for publication |
| D-16 | Medium | **One backlinks report gives two link counts and two spam verdicts.** Hero and list: *"3 sites link to techand.ai"* (`referringDomains 3`); tile *"Referring domains 18 · 1 nofollow only"*; tile *"Spam score 63% — High: many links come from spam sites"*; below, *"17 link(s) from link farms / PBN pages set aside"* and "0 spammy". The 18 and the 63 are DataForSEO's own summary, which counts the 17 farm sites the report sets aside; the same 18 feeds the site report's "18 referring domains ▲18" | payload `summary {referring_domains 18, spam_score 63}`, `coverage.union 3`; `seo_backlink_snapshots` row 16; `web/src/components/reports/backlinks.tsx:128,131`; rendered text | the merged count (3) everywhere, DataForSEO's 18 labelled as the index's count including the 17 set-aside farm sites, no "High spam" verdict on links already set aside |
| D-17 | Medium | **The site report's headline says what its own test refuses to say.** Hero: *"Clicks from Google are up 52% to 32"*; the payload's `significance.clicks` is `{pct 52, ci [-12, 164], real: false, significant: false}` and the brief under the hero says *"32 clicks (up 52% from 21, but not statistically significant, so a thing to watch)"* | `web/src/components/reports/tracker.tsx:20–28` (`clicksHeadline` reads only the % change); payload of 634; rendered text | a headline that follows the test, e.g. "Impressions up 224% (a real change); clicks 32, within normal variation" |
| D-18 | Medium | **A report page shows only the DataForSEO part of what the run cost, unlabelled.** The Run ledger card prints "Data cost (DataForSEO)" and *"Claude usage is billed by the token and is not itemised here"* although `run_ledger.ai_usd` is in the payload (page 616 $0.8933, ladder $0.0882, strategy $0.0653); the audits' "$0.026" says nothing of the $0.0211 crawl estimate inside it; the six monitor renderers show no cost | `web/src/components/reports/kit.tsx:279–300`; payloads; ledger rows 79–102 | the run's whole cost (search data + Claude) with whose figure it is, as the run page does (`runCostEstimate` + `COST_SOURCE_LABEL`) |
| D-19 | Medium | **For AI visibility and backlinks runs started from the app, the app would record the DataForSEO money alone as the run's complete "actual" cost.** Their callbacks carry `cost_usd` (623: 0.7794; 626: 0.3725) and no `run_ledger`, so `ledgerCost` returns `estimated: false` and the run page would say *"What this run reported spending, from the search-data tasks it paid for and the model calls it made"*; the AI visibility run's Claude (ledger $0.0678, n8n $0.1033) is in neither figure. The pulse, link-builder, rank-tracker, site-report and site-description callbacks carry no cost at all | `server/src/services/summaries.ts:215–223`; `shared/src/cost.ts` `runCostEstimate`; payloads | the monitors' callbacks carry their `run_ledger` (search data + Claude, with `estimated`) like the main workflow's |
| D-20 | Medium | **A request the engine refuses after its "started" note leaves the customer with a promise.** Request 621 got *"Backlink check started … The full report appears here as soon as it is ready. Ready in ~5 min"* and nothing else; 624 ended `success`, so the failure watcher sees nothing; an app-started run would have been expired after 3 h with *"… The run may have failed in n8n (ops were e-mailed) …"*, untrue here (engine side: part 3, C-1) | report 6f0ab96b; execution 624 status; `server/src/services/runs.ts:262–278` | the refusal posted as a callback with its reason, and the run closed with it |

### Could not be exercised (part 4)

- The page report (616) on a server render: its preview needs the browser's `DOMParser`; it was not rendered in a browser either
  (no session in that company).
- The Pipeline's "Needs you" for techand.ai (whether it also offers "publish" for the two drafts): no session; not derived.

### State left behind (part 4)

Nothing: reads only. Files (git-ignored): `files/D-report-details-since-1855.json`, `files/D-reports-since-1855.json`,
`files/D-render-results-since-1855.json`.
