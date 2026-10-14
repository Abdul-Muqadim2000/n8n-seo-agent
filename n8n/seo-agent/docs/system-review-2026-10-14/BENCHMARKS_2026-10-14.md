# Benchmarks, 2026-10-14 — feature by feature against the best tool available

This file is the output of `BENCHMARK_PROGRAM.md`. One section per area. The `../system-review-2026-10-11/CRITERIA_*.md` files
stay frozen; where a criterion's named leader turns out to be stale, the old statement is kept beside the new one with the date and
the reason, and the scorer keeps using the old one until the owner re-baselines.

Every competitor claim below carries a page that was opened. Where a behaviour cannot be established without a paid account the
line says **"not verified, inferred from &lt;source&gt;"** rather than asserting it.

---

# Area 12 — Reporting & the app

**Score today: 4.5 / 10** (`../system-review-2026-10-13/SCORECARD.md` §2.12, mean of ten criteria 4.3). Joint-lowest with cost &
reliability, and per `../system-review-2026-10-13/PATH_TO_8.md` §1.3 the one area that **must** reach 8 or an overall 8 is
arithmetically impossible.

Researched 2026-10-14/15. Evidence for our side is the live run of 2026-10-14 (`RESULTS.md`, executions 535–581, 47 executions,
23 reports delivered to the app, $3.63).

## 1. The leader today

The rubric names **AgencyAnalytics / Semrush My Reports**. One half of that is now wrong.

| | Rubric (2026-10-11) | October 2026 | Source opened |
|---|---|---|---|
| Client portal | "Semrush client portal" | **Retired.** Semrush's own KB: *"Agency Growth Kit (AGK) has been discontinued as a toolkit"* and *"Client Portal, CRM, and LEad Finder have been discontinued"*; it names **no replacement** and tells users to e-mail `agencies@semrush.com` to retrieve Client Portal or CRM data. Cross-toolkit reporting moved to My Reports, priced per report | [semrush.com/kb/1546](https://www.semrush.com/kb/1546-agency-growth-kit-sunsetting) |
| Reporting | "Semrush My Reports" | **Still valid, but it is now a per-report product**, not an agency suite: Base $10/report/month, Pro $20/report/month | [semrush.com/kb/34](https://www.semrush.com/kb/34-my-reports), [kb/1167](https://www.semrush.com/kb/1167-client-portal) |

**So the leader for this area in October 2026 is AgencyAnalytics**, and it is a clearer leader than it was, because the one
competitor that matched it on client access has withdrawn from that part of the market. Four others matter for individual
criteria and are benchmarked below: **Looker Studio** (formats, connectors, delivery reach), **Databox** (alerting),
**SE Ranking** (read-only client seats at the lowest price), **SEOTesting** (annotations and impact tests). **Ahrefs Report
Builder** and **Whatagraph** were checked and are *not* leaders for anything we are missing — see §5(c).

One caution the programme's rule 2 forces: **vendor pages contradict themselves often.** Databox's pricing table disagrees with
its own FAQ; Whatagraph's white-label page ($229/$463 tiers) disagrees with its live pricing page (€999 Max only, and *custom
domain is "No" on Max*); SE Ranking says 30 client seats on one page and 10 on another; Ahrefs' Report Builder plan table shows
scheduling as "—" for Lite while its own footnote includes Lite. None of those contradictions is resolved here; they are flagged
where used.

## 2. What the leader does, mechanism by mechanism

### AgencyAnalytics (the leader)

- **Price and unit.** *"$20 USD per client, per month"*, billed annually, Core plan; volume pricing above 25 clients. ([pricing](https://agencyanalytics.com/pricing), opened 2026-10-14)
- **Client access — the mechanism we most lack.** The pricing comparison table lists **"Client Access Portal"** and **"Unlimited Client Users"** under "All features", alongside "Branded Logo", "Branded Color Scheme", "Client Branding" and **"Custom Domain"**. The Core list calls it a *"white-labeled client portal"*. So an end client gets their own login, on the agency's domain, at no per-seat cost. ([pricing](https://agencyanalytics.com/pricing))
- **What the client sees.** The feature page is thin: *"Give clients branded access to results"*, plus "Client Messaging" (*"Share insights and answer client questions without ever leaving the reporting platform"*), "Embeddable Content" and a *"mobile-friendly, branded interface"*. Whether the client view is interactive beyond date ranges: **not verified, inferred from [agencyanalytics.com/features/client-portal](https://agencyanalytics.com/features/client-portal)**. Their public roadmap still lists *"Report commenting - client users"* as **not launched**, which bounds how much the client can do.
- **Scheduled delivery.** Daily / weekly / biweekly / monthly / quarterly / annually, with a chosen day, recipients typed in with a subject and body, replies routed to the account's admin address, and a one-off "Send Now" plus an approval flow. **Not verified from a page I could open** — `help.agencyanalytics.com` returns 404 to a direct fetch; **inferred from [help.agencyanalytics.com/en/articles/1939768-create-a-scheduled-report](https://help.agencyanalytics.com/en/articles/1939768-create-a-scheduled-report) as summarised in search results**, and consistent with the marketing page's "Automate reporting… deliver polished reports in minutes" ([features/automated-reports](https://agencyanalytics.com/features/automated-reports)).
- **Data sources.** *"Pull client data from 85+ marketing platforms"*; the category filter shows 92. Verified present on the directory: Search Console, Google Analytics, **Bing Webmaster**, Google Ads, Ahrefs, Semrush. **Not on the first of seven pages: Google Business Profile, WordPress or any CMS, Google Sheets, a generic API connector** — the only database listed is Amazon Redshift, plus a "Request an integration" link. ([integrations](https://agencyanalytics.com/integrations))
- **Alerting is weaker than ours.** *"client metrics hit, surpass, or fall below defined thresholds"* — **threshold only, in-app notifications only**; no e-mail, Slack or webhook named, and the page does not say clients receive them. ([features/alerts](https://agencyanalytics.com/features/alerts))
- **Annotations: none found.** No annotation article surfaced on their help centre or site.
- **2026 movement** ([changelog](https://updates.agencyanalytics.com/changelog), entries 2026-09-21 to 2026-10-14): **AI Tracker** (AI search visibility as an add-on — *"One credit tracks one prompt query, on one AI platform, in one location, per week"*, $25 per 250 credits after a 14-day/250-credit trial, [open beta entry](https://updates.agencyanalytics.com/changelog/ai-tracker-is-now-in-open-beta)); **HTML Artifacts** (2026-09-30) — *"turn any conversation with Agency AI into a branded, shareable web page"* with *"a public link, ready to send straight to your clients"* (expiry/revocation **not stated** — not verified, inferred from that entry); MCP that can now write; "Compare row by row on more data sources" (21 more sources, 2026-09-28); number-formatting controls (2026-10-08).

### Looker Studio — the formats and delivery leader (free)

Scheduled e-mail delivery with *"the report attached as a PDF file"* plus a preview and a link; **Google Chat and Slack as
delivery channels** (PDF attachment + link); *"no more than 50 recipient addresses"*; one schedule per report free, **200 with
Pro**; daily maximum free, **hourly with Pro**; custom patterns ("every Tuesday and Thursday"); per-user caps of 200 recipients/day
and 800/month on a personal account. Whether an e-mail recipient needs a Google account is **not stated on the page**.
([cloud.google.com/looker/docs/studio/schedule-automatic-report-delivery](https://docs.cloud.google.com/looker/docs/studio/schedule-automatic-report-delivery?hl=en))

### Databox — the alerting leader

Two alert kinds: a **threshold** alert (*"notifies you when a metric meets a specific condition you define"*, with an evaluation
period and a weekdays-only window) and a **Smart Alert** doing anomaly detection with a 0–99 score — *"The default of 10 flags
about 1% of data points"*. Channels: e-mail, Slack, mobile. **No webhook.** And a deliberate refusal worth noting: *"Metric
notifications go only to users in your Databox account. Use scheduled snapshots or reports for external stakeholders."*
Annotations are **manual only** — *"Annotations let you attach short text notes to specific points on a chart"*, no automatic
external events. White-label is an **$80/month add-on** on top of a plan. Public dashboard links support a password, an IP
allowlist and restricted date ranges for external viewers, but **no expiry**. (Databox help centre and pricing, opened
2026-10-14; the vendor's own pricing table and FAQ disagree on three of the plan prices.)

### SE Ranking — the cheapest real client portal

Two mechanisms: **guest links** from the Growth plan (*"a live, view-only link to your data without using a seat"*) and
**read-only client seats** in the Agency Pack (*"Clients can view dashboards and sections but can't create or change projects"*).
White label — custom colours, logo, a personalised domain *"eliminating any references to SE Ranking"*, your own SMTP — is an
**Agency Pack add-on at +$69/month, annual billing only**, on top of Core $103.20 or Growth $223.20 (annual). The two vendor pages
disagree on whether the pack carries 30 or 10 client seats. Integrations: 18 cards including GA4, Search Console, Google Ads,
**Google Business Profile**, **WordPress**, Looker Studio and **n8n** — but **not Bing Webmaster Tools** (only Bing Places). No
annotations found. (seranking.com pages opened 2026-10-14; `help.seranking.com` returns **403** to a fetch, so report frequencies
and the recipient cap are **not verified**.)

### SEOTesting — the annotations and impact-test leader, at $50/month

- **Annotations, the best of any tool checked.** Four manual types — **page, query, site, content group** — with date, name and description, shown on the graphs, listed in an Annotations section and a **Site Changelog**, and exportable to CSV. And: *"Google core and spam updates are automatically marked on the graphs"* from the date they started or were announced, with a per-website and per-user default and a per-view toggle. Their changelog extends it: *"Confirmed Google algorithm updates now appear on the results charts for all test types, including LLM tests"* (2026-10-05).
- **Expiring share links** ("Magic Links"): *"gives someone direct access to a single test, report, or view… without them needing an SEOTesting account"*, with **1, 7, 30 or 90 days or no expiration**, revocable from a Magic Links report. This is the same shape as our G15.
- **Unlimited free users on every tier** — *"Pricing is only based on the number of sites you want to add"*.
- **No white label. No scheduled PDF or link delivery at all** — only event-driven e-mail (a daily update when new Search Console data arrives, completion e-mails, weekly New Keywords, daily New Pages).
- (support.seotesting.com and seotesting.com/pricing, opened 2026-10-14)

### Google Search Console itself — a new floor under criterion 3.5

Google shipped **custom annotations in the Performance report** on **2025-11-17**: notes of **up to 120 characters** tied to a
date, and *"All annotations are visible to everyone with access to a Search Console property."*
([searchenginejournal.com](https://www.searchenginejournal.com/google-search-console-adds-custom-annotations-to-reports/561274/),
opened; Google's own announcement is at developers.google.com/search/blog/2025/11/custom-chart-annotations, whose body did not
render for a fetch). Third-party reports of a 200-annotation cap and a 500-day retention are **not verified**. The practical
effect: an annotation feature is now table stakes, not a differentiator, and a tool that only replicates Search Console's own
notes earns nothing.

## 3. What we do, with execution ids

All from the 2026-10-14 run unless stated.

| Mechanism | What we actually produced |
|---|---|
| **Delivery** | **23 reports landed in the app's `reports` table** between 16:03:23 and 16:35:48, one per callback stage, each with its files. **No report was e-mailed, posted to Slack or pushed anywhere.** `ENGINE_EMAILS=false`, SMTP fails with `ENOTFOUND smtp.gmail.com`, and the one channel that works (`SEO_ALERT_WEBHOOK_URL`) is for ops alerts, not customer reports. A customer learns a report exists by logging in. |
| **Formats** | PDF, Word (`…-DRAFT.doc`), HTML, Markdown, `meta.json`, CSV, a 7-file fix pack, 3 rendered WebP images (exec 554). **L3 proven**: the Link Builder's week delivered as a rendered **PDF** (`pdf_ready`, `pdf_file_name`, exec 561). |
| **Lineage (G29)** | **Proven live** in the Site Tracker (exec 581): every block carries source, period, sample and a measured/modelled label, GA4 property included; the full report (exec 566) carries the figure-by-figure table. |
| **Annotations (G12)** | **Proven in part** (exec 581): a "What happened in this period" table marks the September 2026 core update and the audit-fix events, and states that every dashboard chart carries those dates. **But R20**: that same feed chains audit health across *unlike report types*, printing "health 80 → 68", "24 findings gone — 68 → 80" and "80 → 80" as three same-day events, because a full report (69) sits between two technical audits (83). |
| **Statistical honesty (G28)** | **Proven** (exec 581): *"Both rises are statistically real"* — 34 clicks (+79%) and 5,282 impressions (+240%) tested, not just printed. Brand/non-brand split 4 / 3 clicks, 526 named queries, and the share of impressions Google will not name stated at 28.5%. |
| **Share links (G15)** | Built and shipped (`app/API.md` §"Share links"): a 256-bit token, **only its SHA-256 stored**, 1–90 days (14 default), revocable, admin-only to create, at most 10 live per report, rate-limited, read-only, scoped to **one** report and its files; a wrong/revoked/expired token answers 404 identically so a guess learns nothing. **Never exercised live** — the app UI has not been driven in any of the three runs (no owner session; driving the owner's account was refused as impersonation). |
| **Alert routing (3.9)** | Severity, de-duplication and a webhook channel exist and the Slack webhook is deployed in the Error Handler. **No alert has ever been recorded as delivered**: all 4 `seo_ops_alerts` rows still read `delivered: "pending"`, `channels: "email,data_table"`. No workflow failed during the run, so R5/R6 have no live evidence. |
| **Integrations (3.12)** | Search Console, GA4, Bing Webmaster, Google Business Profile, Ahrefs DR, Common Crawl, DataForSEO, Gotenberg. **CrUX now enabled and answering** (the site simply has too little Chrome traffic for field data). **No CMS** (WordPress sub-workflow inactive), **no ads connector**. |
| **One queue (3.3)** | Before this pass: one array across seven areas, sorted by a hand-set priority then by category. After this pass: see §6. |

## 4. The gap

| # | What the leader does | What we do | Does it change the customer's outcome? | Criterion |
|---|---|---|---|---|
| G-1 | **AgencyAnalytics**: the report is pushed — scheduled e-mail on six frequencies with a subject and body. **Looker Studio**: PDF by e-mail to 50 recipients, or into Slack / Google Chat | 23 reports appear in a dashboard nobody is told about. No e-mail, no Slack, no webhook for a *report* | **Yes, more than anything else here.** A weekly report nobody opens is worth nothing, and P3 in the frozen criteria is explicit that communication, not performance, drives retention | 3.6, 3.8 |
| G-2 | **AgencyAnalytics**: unlimited client users with their own branded login on a custom domain. **SE Ranking**: read-only client seats + guest links | A viewer role inside our app, plus G15's expiring one-report share link — which **no live run has ever exercised** | Partly. For an agency, decisive. For a direct customer (what we are), the share link covers most of it; the branding does not | 3.7 |
| G-3 | **SEOTesting**: core and spam updates auto-marked on *every* chart, plus four manual annotation types and a Site Changelog | G12's registry marks updates, publishes and fixes — but it is in one table in one report, **and R20 makes it print three contradictory health moves in a row** | Yes. An annotation that is wrong is worse than none: it tells the customer a fix worked when a different report type was being compared | 3.5, 3.3 |
| G-4 | **SEOTesting**: tests on Search Console data, backdatable, with a control group. **SearchPilot**: matched page buckets, counterfactual, credible intervals | Impact is measured for links only; `_change_test.js` (G12) shipped on 2026-10-13 and **was not exercised** by the 2026-10-14 run | Yes — it is the difference between "we did work" and "the work paid" | 3.4 |
| G-5 | **Looker Studio**: free native connectors and a community-connector SDK. **Databox**: custom REST integration, push API, Sheets, SQL, Zapier/Make. **SE Ranking**: API + MCP + **n8n** | Dashboard, PDF, Word, HTML, Markdown, CSV — and **no read API and no connector**. Our data cannot leave the product | Some. A customer who already lives in Looker Studio or a BI tool cannot pull us in | 3.6 |
| G-6 | **AgencyAnalytics** 85–92 sources; the frozen criterion's own list is GSC, GA4, GBP, Bing, **CMS**, **ads** | Four Google/Bing sources + CrUX. **No CMS, no ads** | CMS yes (it is the last step of the content loop); ads marginally — see §5(c) | 3.12 |
| G-7 | **Databox**: threshold **and** anomaly alerts (0–99 score), e-mail + Slack + mobile | Severity, de-duplication, a webhook — and **zero deliveries ever recorded** | Yes. An alerting system with no delivery is not an alerting system | 3.9 |
| G-8 | **AgencyAnalytics**: one priority list per client dashboard; **nobody** benchmarked ranks a to-do list by impact × confidence × effort | One list across seven areas, ordered by a hand-set priority then category | Yes — the order of that list *is* how a customer spends their week | 3.3 |

### Where the leader is wrong and we are right

1. **Webhook alerting.** None of the six tools documents a webhook alert channel; only Databox documents Slack. Ours posts to a webhook. We should not copy their omission.
2. **Alerts to outside stakeholders.** Databox refuses on purpose — *"Metric notifications go only to users in your Databox account."* We should keep the same boundary rather than treating client alerting as a gap.
3. **Expiring share links.** Of the six, **only SEOTesting** has expiry; Databox and Whatagraph offer password + manual revocation and no expiry; Ahrefs gates sharing to Enterprise. G15 — 1–90 days, revocable, SHA-256-only storage, one report per token — is **at or above the best of them**, and is worth saying out loud rather than scoring as a 2.
4. **Saying when a number cannot be trusted.** No tool checked labels a figure "modelled, not measured", caps an impact basis at the property's own totals, or refuses to score on evidence it could not read. Our G3/G7/G28/G29 behaviour has no counterpart in the benchmark set. That is the bar the programme says to copy, and here we set it.
5. **Per-run cost on the report itself.** Every one of our reports states what it cost. None of the six does.

## 5. What to build

### (a) In reach now

| # | Item | Size | Status |
|---|---|---|---|
| **a1** | **One queue ranked by impact × confidence / effort** (3.3: 4 → 8). The single rubric item in this area that was neither built nor blocked. Entirely inside the app, because only the app sees every module — an n8n workflow by construction sees one | S–M | **Built in this pass, §6** |
| **a2** | **R20 — filter the annotation feed by `report_type` before computing an audit delta**, and label a report-type change instead of reporting it as a score move. D2's fix exists in the audit's own diff and was never carried into `_annotations.js` | S | Registered as a defect (`RESULTS.md` §3.3 R20); **engine file, left for the defect owner** to avoid two agents in `_annotations.js` |
| **a3** | **Report delivery that leaves the app** — a per-company webhook (Slack-shaped) and an optional e-mail recipient list, fired on a report callback, with a delivery record so G21 can measure it. The ops-alert path already proves the shape; this is the customer-facing twin | M | Listed |
| **a4** | **White-label-lite on the shared report page**: the company's own name and logo at the head of `/share/:token` and in the report's header, our mark reduced to one footer line. Needs a migration (two columns on `orgs`), an https-only logo URL, and a marketing entry | M | Listed |
| **a5** | **Drive the app in an owner session** (Playwright, 1440 and 375, light and dark) so G15, G12's dashboard half, G21 and the queue have live evidence. The app UI is `(NL)` in **all three** runs — six criteria in this area cannot be scored without it | S (an hour), but needs the owner | Listed — see (b) |

### (b) Needs money or an owner decision

| # | Item | Cost | Who decides |
|---|---|---|---|
| **b1** | **Turn on a channel reports can arrive through.** SMTP has been broken since the first run (`ENOTFOUND smtp.gmail.com`); the alternatives are a Gmail App Password, a transactional sender (Postmark/Resend ≈ $15/month at this volume), or reusing `SEO_ALERT_WEBHOOK_URL` for reports too ($0) | $0–15/month | Owner. **This is the single highest-value decision in the area** |
| **b2** | **An owner session for the Playwright sweep** (a5). Driving the owner's account has been refused as impersonation three times; it needs the owner signed in, or explicit written authorisation | $0, ~1 hour of the owner's time | Owner |
| **b3** | **G13 — name a CMS.** `PATH_TO_8.md` §5.1 shows the arithmetic: with 3.12 at 6 this area means 7.5; at 8 it means 8.0. The criterion's own list includes CMS **and** ads. Our WordPress publisher exists and is inactive | $0 (WordPress) to a few days (headless / PR-based) | Owner names the CMS |
| **b4** | **Always-on host (D25a).** G21's delivery rate cannot reach the leaders' bar on a Mac that sleeps; a report that is scheduled and not sent is the same failure as a report nobody reads | ~$20–40/month VPS | Owner |

### (c) Deliberately not worth it

| # | Item | Why not |
|---|---|---|
| **c1** | **A custom domain for a client portal** (AgencyAnalytics, SE Ranking, Databox at $80/month) | It is an *agency* feature: its value is hiding the vendor from the agency's client. We sell to the business that owns the site. The DNS, the certificate and the per-tenant routing are real operational cost for a benefit our customer does not have |
| **c2** | **A Google Ads connector** (3.12's second half) | Nothing in this system acts on paid search: no mode reads it, no recommendation could use it. Adding it would move one criterion and give a customer a chart they already have in Google Ads. If 3.12 must reach 8, **b3's CMS is the honest half to build** |
| **c3** | **80+ integrations** | AgencyAnalytics' 85–92 are overwhelmingly ad platforms and CRMs for agency dashboards. Breadth here is a sales number, not a capability; the frozen criterion's own list is six sources and we have four plus CrUX |
| **c4** | **Client commenting / messaging inside a report** | The leader has not shipped it either — *"Report commenting - client users"* is still unlaunched on AgencyAnalytics' public roadmap. There is no benchmark to beat and no evidence of demand |
| **c5** | **A drag-and-drop report builder** (Semrush My Reports, Ahrefs Report Builder) | Our reports are written to be read, not assembled; a widget canvas would let a customer build a document that states things the data does not support, which is the one failure mode the last three runs punished hardest |
| **c6** | **Ahrefs Report Builder or Whatagraph as a model** | Neither leads anything we lack. Ahrefs has **no documented white-label at all**, charges $40–80/month per extra seat, gates sharing to Enterprise, and its widgets come only from Site Explorer and Rank Tracker — GSC and GA4 are not report sources. Whatagraph starts at **€999/month**, has **no viewer or client role in its documentation**, and no annotations or alerting |

## 6. What this pass built

**a1 — one queue, ranked by impact × confidence / effort.** `app/shared/src/queue.ts`, used by
`app/server/src/services/recommendations.ts` and the Recommendations and Overview pages.

- **Impact 0–10** from a stated quantity by one of three published rules: monthly clicks on a log scale (500 clicks reads 10, so one head term cannot hide the rest of the list); the technical audit's own G26 impact weight, mapped onto the same shape so the queue never reorders the audit; and percentage points for a rate.
- **Confidence** carries the uncertainty instead of the impact hiding it: `measured` 0.8 (the customer's own Search Console / GA4 / our own fetch), `modelled` 0.5 (an index or a published benchmark), `rule` 0.25 (no quantity — a general rule applied here).
- **Effort** in five bands a person can tell apart, from "a few minutes" to "weeks".
- **Order**: blocking setup first (tracking, report delivery, Search Console, GA4 — *"until they are done, nothing below can be measured on your own data"*), then by `impact × confidence ÷ effort`, then the items nothing has measured yet, in a named band with the reason. Ties fall back to the id so the list does not reshuffle between loads.
- **The refusal, which is the point.** A finding the audit could not weigh (an audit written before G26, or no Search Console) is **not** given a number from its severity label: it reads *"the audit could not weigh it — High severity on 12 page(s), with no traffic figure behind it"* and drops to the bottom band. Every rule-based number lives in one visible table in `queue.ts` and says so on the item itself.
- Measured inputs are attached where the data exists: striking-distance queries (impressions and CTR measured, the uplift benchmark modelled), low-CTR queries, **falling queries (purely measured: the clicks were earned and then were not)**, audit findings via G26, the AI mention rate, and lost backlinks via the index's authority.
- **UI**: a "Worth 3.2 · about an hour" chip with the full sentence behind an InfoTip (*"Worth 3.2 — impact 8/10 (42 clicks a period already lost), 80% confidence (measured on your own data), about an hour of work."*), and a third "Group by: Worth" view that shows the three bands with their notes. Priority and area grouping stay.

**Checks.** App typecheck green (all three workspaces); **shared 192 unit tests** (22 new in `queue.test.ts`), **server 218**
(the old "sorts by priority" test replaced by two that hold the new contract); web build green; `python3 build_v4.py` exit 0
(483 nodes). **No engine file was touched**, so build section 60 and harness scenario S70 are unused by this pass and the harness
stands unchanged at 4277 passed / 0 failed.

**Marketing** (working rules): changelog entry of 2026-10-15 and the `reports` capability's benefits, steps and "Are
recommendations ranked?" FAQ rewritten in customer language.

> **Build-output warning for the next agent:** running `build_v4.py` in a fresh worktree regenerates `workflows/` and
> `harness/code_v4/` with **that machine's `n8n/.env` baked in** — in this worktree it rewrote the ops e-mail address in nine
> files. Run the build to check the exit code, then `git checkout -- n8n/` unless an engine change was actually intended.

## 7. The one change that matters most

**Give the report a way out of the app**: until a Monday report arrives somewhere the customer already is — an inbox, a Slack
channel, a webhook — every other improvement in this area is work the customer has to log in to discover, and all six benchmarked
tools push the report while we wait to be visited.

---

## Sources opened for this section

**AgencyAnalytics** — [pricing](https://agencyanalytics.com/pricing) · [integrations](https://agencyanalytics.com/integrations) ·
[features/alerts](https://agencyanalytics.com/features/alerts) · [features/client-portal](https://agencyanalytics.com/features/client-portal) ·
[features/automated-reports](https://agencyanalytics.com/features/automated-reports) · [changelog](https://updates.agencyanalytics.com/changelog) ·
[AI Tracker open beta](https://updates.agencyanalytics.com/changelog/ai-tracker-is-now-in-open-beta) ·
[HTML Artifacts](https://updates.agencyanalytics.com/changelog/turn-agencyai-answers-and-insights-into-a-shareable-html-artifacts) ·
[feedback/roadmap board](https://updates.agencyanalytics.com/). *404 to a direct fetch:* `agencyanalytics.com/help/*`, `help.agencyanalytics.com/en/articles/*`.

**Semrush** — [kb/34 My Reports](https://www.semrush.com/kb/34-my-reports) · [kb/1167 client portal](https://www.semrush.com/kb/1167-client-portal) ·
[kb/1546 Agency Growth Kit sunsetting](https://www.semrush.com/kb/1546-agency-growth-kit-sunsetting).

**Looker Studio** — [schedule automatic report delivery](https://docs.cloud.google.com/looker/docs/studio/schedule-automatic-report-delivery?hl=en).

**Google Search Console annotations** — [Search Engine Journal, 2025-11-17](https://www.searchenginejournal.com/google-search-console-adds-custom-annotations-to-reports/561274/) ·
[SEO Gets annotations + Google updates](https://seogets.com/features/annotations-google-updates). *Google's own post body did not render for a fetch:* developers.google.com/search/blog/2025/11/custom-chart-annotations.

**Databox, Whatagraph, SE Ranking, Ahrefs, SEOTesting** — the full list of pages opened (≈ 60 URLs, with the 403s and 404s named)
is reproduced in the research appendix below.

### Research appendix — pages opened for the five secondary contenders

Databox: `databox.com/pricing`, `help.databox.com/llms.txt`, `/white-label-your-account`, `/set-up-a-report-notification.md`,
`/set-up-a-dashboard-notification.md`, `/share-a-dashboard.md`, `/annotate-your-charts.md`, `/set-up-a-metric-notification.md`,
`/add-a-user.md`, `/integrations.md`, `databox.com/category/product-updates` (*`databox.com/changelog` → 404*).

Whatagraph: `/pricing`, `/integrations`, `/white-label-reporting-tool`, `help.whatagraph.com/` and the Share, Account & Team,
Organize, Getting Started and IQ collections, articles 6309188, 6254365, 6254352, 6254388, 6254371, 12180729.

SE Ranking: `/`, `/subscription.html`, `/white-label.html`, `/agency-pack.html`, `/seo-reporting-tools.html`,
`/integrations.html`, `/features.html`, `/faq.html`, `/whats-new.html` (*`/prices.html` and `/pricing/` → 404;
`help.seranking.com/hc/en-us` and `/en/faq/reports` → **403***).

Ahrefs: `/pricing` (the Report Builder add-on block truncates at every offset tried), `/report-builder`, `help.ahrefs.com/en/`,
articles 9874844, 914827, 15501968, collections 87862 and 12501057, `ahrefs.com/blog/whats-new-at-ahrefs-april-2022`,
`/blog/features-roundup-past-year`.

SEOTesting: `/pricing/`, `support.seotesting.com/en/`, `seotesting-email-alerts-1rql3vc`,
`how-to-annotate-seotesting-graphs-1h75ssf`, the Reports / General / Integrations / Annotations categories,
`llm-traffic-pages-report-685vci`, `share-a-test-or-report-with-someone-using-a-magic-link-x550x8`, `app.seotesting.com/home/changelog`.
