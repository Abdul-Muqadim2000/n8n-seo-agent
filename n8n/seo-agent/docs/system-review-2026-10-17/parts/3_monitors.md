# Part 3 — the monitor wave (executor C), 2026-10-17

What ran: AI visibility (`ai_visibility`, app-shaped), backlinks (full, app-shaped, started in the same second as AI visibility so the
2026-10-15 refusal could recur), the Link Builder (paid, on demand), the AI Pulse, **AI Growth with `dry_run: true`** (its first live
run in a re-rating), the Rank Tracker, the Site Tracker, Page Watch, the Content Cadence dry run, the Audit Scheduler (and the technical
audit it started), and one deliberate failure into the alert channels. Read-only: the schedule record of every scheduled workflow, the
catch-up workflow's first failed execution (728), the Console Alerts IMAP deactivations (Error Handler 723, 729–731, 797), the alert
table and the run ledger of the window. Analyses went through the API front door exactly as the app sends them
(`X-Forwarded-For: app:<techand.ai company>`, the company callback); monitors through the Test Runner (`SEOagentTestRun1`).

The wave ran in two sittings: 16:27–16:54 UTC (every monitor run), then — after a session limit stopped me at about 18:30 UTC — 20:33–20:36
UTC (the error-path test and the read-only record). No monitor was run twice.

| | |
|---|---|
| First call / last call | 16:27:44 UTC (balance "C start") → 20:36:24 UTC (balance "C end") |
| Executions created | **772–794** (23) and **798–799** (2); every one `success` except **798**, the deliberate failure. Not mine but read: 723, 728, 729, 730, 731, 797 |
| Test Runner (`SEOagentTestRun1`) | **found already active** at 16:27:34 UTC (`active: true`; its last prior use in the n8n event log is 2026-10-16 ≈19:57 UTC, the fix wave's live checks — I did not activate it in the first sitting). Used 16:34–16:48. The orchestrator deactivated it at **20:33:27 UTC**. I re-activated it at **20:34:43 UTC** for the error test only and deactivated it at **20:35:24 UTC**; `RR active` → **`active: false`** confirmed |
| DataForSEO balance | **$6.922601** (16:27:44, `today_total` 1.191915) → **$5.432052** (16:54:13 and 20:36:24, `today_total` 2.682464): **$1.490549** for this wave (share: $2.00) |
| Engine's own DataForSEO figures (ledger rows 153–165) | **$1.4785** — 99.2% of what the account moved; the $0.0121 gap is inside the one window where two runs overlapped (776 + 777) |
| Claude (n8n-reported token counts, list prices) | **$0.1753** measured over 6 calls (exec 776 $0.1041, 781 $0.0241, 787 $0.0471); no estimate-only call. Engine settled **$0.1905** (each row labelled "PARTLY ESTIMATED": the thinking tokens are modelled) |
| In flight at once | at most 2 of my runs (776 + 777); every other paid run ran alone, so its account movement is attributable |

Artefacts: `n8n/seo-agent/docs/system-review-2026-10-17/files/`, prefix `C-` plus the toolkit's `exec-<id>.json` (list at the end).
Note for the orchestrator: four of my early inline reads saved `exec-773/777/781/783.json` into the 2026-10-15 folder (the toolkit's
default when `RR_FILES` is not exported); I moved 773 into the 2026-10-17 folder and deleted the three duplicates. Nothing else there was
touched.

## Runs

"Account" = the DataForSEO balance movement between two probes with only that run in flight; "engine" = the run's own figure and its
`seo_run_ledger` row (`dfs_usd` / status). Claude = `RR claude` (n8n `tokenUsage`, measured) against the engine's own Claude figure.

| # | What | Request id | Executions | Start–end UTC | Duration | DataForSEO: account · engine (ledger row) | Claude: measured · engine | Status |
|---|---|---|---|---|---|---|---|---|
| — | balance before | — | — | 16:27:44 | — | $6.922601 | — | — |
| 12 | `ai_visibility` (topics `[]`, competitors cleartax.com, azentio.com) | 772 | 772 → 773 → **776** | 16:29:14–16:32:31 | 3 min 17 s | $1.1738 for 776 + 777 together · **$0.7892** measured (row 156 `parent:773`, done); front-door row 153 **$0** | $0.1041 · $0.1115 | delivered, PDF |
| 13 | `backlinks` full | 774 | 774 → 775 → **777** | 16:29:16–16:30:24 | 1 min 08 s | (shared, above) · **$0.3725** measured (row 155 `parent:775`, done); front-door row 154 **$0** | 0 · 0 | **ran** (not refused), delivered, PDF |
| 16 | AI Pulse | rr1017-pulse | 778 → **779** | 16:34:00–16:35:32 | 1 min 32 s | **$0.088** · $0.088 measured (row 157) | 0 · **0** | delivered |
| 15 | Link Builder, paid, on demand | rr1017-lb-paid | 780 → **781** | 16:36:27–16:38:50 | 2 min 23 s | **$0.049764** · $0.0498 measured "against the account" (row 158) | $0.0241 · $0.0299 | delivered, PDF |
| 17 | **AI Growth, `dry_run: true`** | rr1017-growth-dry | 782 → **783** | 16:41:29–16:42:24 | 55 s | **$0** · $0 (row 159) | 0 · 0 (writer did not run) | delivered; **nothing submitted** (§5) |
| 18 | Rank Tracker | rr1017-rank | 784 → **785** | 16:43:58–16:44:22 | 24 s | **$0.116** · $0.116 measured (row 160) | 0 · 0 | 9 reports |
| 20 | Site Tracker (`on_demand`) | rr1017-site | 786 → **787** | 16:44:40–16:46:12 | 1 min 32 s | **$0.031** · $0.031 measured (row 161) | $0.0471 · $0.0491 | delivered |
| G11 | Page Watch | rr1017-watch | 788 → **789** | 16:47:17–16:47:25 | 8 s | $0 · $0 (row 162) | 0 · 0 | nothing changed, no callback |
| 19 | Content Cadence **dry run** | rr1017-cadence-dry | 790 → **791** | 16:47:19–16:47:22 | 3 s | $0 · $0 (row 163) | 0 · 0 | paused (pile-up), wrote nothing |
| 21 | Audit Scheduler on demand → technical audit (`crawl_js: false`) | rr1017-auditsched | 792 → **793** → **794** | 16:48:11–16:53:57 | 5 min 46 s | **$0.03195** · $0.032 measured (row 164 $0, row 165 $0.032) | 0 · 0 | delivered, health 85 |
| E | Error path: Test Runner with a workflow id that does not exist | rr1017-errpath | **798** (error) → **799** (Error Handler) | 20:34:48–20:34:53 | 5 s | $0 | 0 | alert delivered (Slack HTTP 200, SMTP 250) |
| — | balance after | — | — | 20:36:24 | — | $5.432052 | — | — |

Per-window account movement (`files/spend.jsonl`, labels "C …"): 16:27:44→16:32:43 **$1.173835** (776 + 777; engine $1.1617);
→16:35:42 **$0.088** (779); →16:38:55 **$0.049764** (781); →16:42:27 **$0** (783); →16:44:40 **$0.116** (785); →16:46:16 **$0.031**
(787); →16:48:11 $0 (789, 791); →16:54:13 **$0.03195** (793 + 794); →20:36:24 $0. On 2026-10-15 the same wave moved $1.476137 and the
engine's rows summed to $2.8924 (front-door rows double-counting); today the rows sum to $1.4785.

**18 reports** reached the app's `reports` table for the company (16:29:36–16:53:52): `ai_visibility_started`, `backlinks_started`,
`backlinks`, `ai_visibility`, `ai_pulse`, `link_builder`, `ai_growth`, `rank_tracker` ×9, `site_tracker` (all `status: progress`) and
`site_audit` (`status: completed`). Every one has `scheduled: true` and no `run_id`, because the runs were started against n8n directly
and the app's `runs` table has no row for them (0 rows since 16:28). By the app's rule (`app/shared/src/report-delivery.ts`
`finishedStatus`: `progress` on a report stage counts as finished; the `_started` stages are interim) all 16 report rows are
deliverable. Nothing was actually delivered: the company's `delivery_settings` is `{}` and `report_deliveries` holds 0 rows.

---

## 1. AI visibility (run 12, executions 772 → 773 → 776)

**What was asked.** `{"mode":"ai_visibility","keyword":"","topics":[],"competitors":["cleartax.com","azentio.com"]}` plus the app's
head fields (country United Arab Emirates, domain techand.ai, empty e-mail, company callback) — the body of 2026-10-15 exec 619. 202 in
1.63 s, `estimated_minutes: 10`, `duplicate: false`.

**What came back** (`files/C-aivis-776-report.txt`, `C-aivis-776-report.json`, `C-aivis-776-metrics.json`).

- Panel 8 (7 buyer questions — decision 3, awareness 2, consideration 2 — and the brand question). Requests **47** = 7 × 5 weekly engines
  + 7 Claude + 5 brand. **1 failed** (Google AI Mode, "Internal SE Server Error." on the requirements question); 4 retried, 3 answered.
- The denominator line, quoted: *"54 answers to the 7 buyer questions on the 5 weekly engines (34 this run + 20 from the daily pulse);
  Claude's 7 answers (asked monthly) are shown per engine and not in the headline; the brand question measures recognition only."* The
  "By engine" table adds up to it: ChatGPT 14 (7 + 7 pulse), Perplexity 7, Gemini 14 (7 + 7), AI Overview 7, AI Mode 12 (6 + 6, 1 failed)
  = 54; Claude 7 shown separately. (On 2026-10-15 the line said "74 answers (8 questions × 6 engines)" and "the 33 answers that came
  back" while the tables added to 81.)
- Headline: *"Tech& was named in 0% of 54 AI answers this week (95% range 0–6.6%), even though all 5 assistants know the brand when asked
  directly."* Cited 0% (0–6.6%), share of voice 0% of 139 mentions (0–2.7%), visibility score 0 (±0, "modelled, not counted"),
  sentiment +100 (5 positive), brand recognised 5 of 5 (56.6–100%), AI Overview shown on 7 of 7 searches read (`aio_basis {requests 7,
  read 7, shown 7, failed 0}`). I recomputed the Wilson bounds: 0/54 → 6.64%, 0/139 → 2.69%, 0/9 → 29.9%, 0/8 → 32.4%, 0/14 → 21.5%,
  0/7 → 35.4%, 0/12 → 24.3%, 5/5 lower 56.6% — all as printed.
- **Holm correction.** Printed: *"Alerts that rest on a test are judged together, Holm-adjusted across the 5 tested alerts of this run at
  5% family-wise: the strongest needed p ≤ 0.01 (|z| ≥ 2.58), each next one a little less; 0 cleared it."* `metrics.multiple_tests`:
  `method holm, alpha 0.05, tests 5`, results ranked by p — cleartax.com share of voice z 0.9 p 0.368 (threshold 0.01), tallysolutions.com
  p 0.542 (0.0125), microsoft.com p 0.928 (0.0167), odoo.com p 0.928 (0.025), and a fifth at 0.05. The thresholds are α/(m−k+1) — the Holm
  sequence, applied as stated.
- **Per-engine tests.** `engine_changes: {}` with `min_engine_samples 12`: the previous run had 7 answers per engine, under the minimum,
  so no engine-level test was possible this run. The report does not print a per-engine change line; nothing claims one.
- Comparison: `delta_basis` *"compared with 2026-10-16 (8 questions on Google AI Mode, Google AI Overview, ChatGPT, Gemini, Perplexity)"*,
  every delta z 0, "54 answers now, 28 before". The previous run (2026-10-16 20:11, exec 722) had **Gemini 0 answered, 8 errors** (its
  stored `engines.gemini`), so the 28 before were four engines — see C-9.
- Who AI names instead: zoho.com 28 (20.1%), tallysolutions.com 28, oracle.com 19, microsoft.com 18, odoo.com 16, cleartax.com 15 (10.8%,
  "your competitor"), wafeq.com 14, azentio.com 1. Market-wide table as on 2026-10-15 (microsoft.com 1,897 answers …; "Tech&" left out as
  a 4-character name).
- **Sources and rivals (new behaviour).** *"Also cited, but these are businesses AI recommends instead of you, so they are not places to
  get featured and are not in your prospect list: tallysolutions.com (25), cleartax.com (16), wafeq.com (12), zoho.com (9), flick.network
  (9), thomsonreuters.com (7), edicomgroup.com (6), taxilla.com (6), avalara.com (5), pagero.com (5)."* The "Do this next" list no longer
  tells the customer to pitch wafeq.com / edicomgroup.com (it did on 2026-10-15). But the "Sources AI relies on" table still labels
  **erp-dubai.ae** ("Elate ERP | ERP Software in Dubai & UAE"), **halsimplify.com** ("HAL ERP - Top ERP System in Saudi") and
  **penieltech.com** ("No.1 IT Company in Dubai") as "site (PR target)", and *AI Prospect Rows* wrote all three as `ai_source` prospects
  (titles fetched today). See C-2.
- "Do this next" (Claude *AI Brief*): rewrite the e-invoicing pages to open with a 40–60 word answer; build a page for "accredited e-invoicing
  service provider in the UAE"; check whether an official MoF / FTA listing applies "and pursue it if it does"; a YouTube explainer and a
  LinkedIn article; fill the business profile. Three ready API bodies with `ai_target`.
- Fact check: *"What AI gets wrong: not checked … nothing on file can judge what the answers claim — fill the business profile …"*
  (no profile on file; same as 2026-10-15). No correction of a wrong AI claim could therefore be produced.
- Crawler access: robots.txt and llms.txt found; 8 of 8 answer bots allowed; homepage fetch test 200 for OAI-SearchBot, ChatGPT-User,
  PerplexityBot, Claude-SearchBot, "—" for the other four.
- AI search volume: `volume_lookup {asked true, read true, keywords 7, stored_positive 0}` — the lookup worked and returned 0 for all 7
  phrasings, so the "—" in the volume column is honest (on 2026-10-15 it failed twice and was not disclosed).
- Brand question: named by ChatGPT, Perplexity, Gemini, Claude ("✓ cited") and AI Mode ("✓ named"); cited pages `/` ×4,
  `/insights/your-current-pdf-invoices-…` ×3, `/insights/the-cost-of-non-compliance-…` ×3 and seven more.

**What the customer sees.** `ai_visibility_started` 16:29:36 and `ai_visibility` 16:32:31, "AI visibility report · techand.ai", subject
*"[AI visibility] techand.ai — named in 0% of AI answers · 0 AI visits · 1 alert(s)"*, summary `{questions 8, aiSessions 0, mentionRate 0,
citationRate 0, shareOfVoice 0, visibilityScore 0}`; PDF attached.

**Where it is right.** The denominator is described exactly and every table adds up to it; every rate carries its sample and a Wilson range
that recomputes; the Holm thresholds follow the stated method; rivals are named as rivals and kept out of "where to get featured" when AI
itself names them; the volume "—" is backed by a successful lookup; the fact check states it did not run and why.

**Where it is wrong.** C-2 (vendors cited as sources still become "PR targets" and prospects), C-9 (comparison basis names an engine that
returned nothing last time; the period label).

**Gap to the leader** (criteria 4A). Profound / Semrush ask far larger panels daily; this panel is 7 buyer questions weekly on 5 engines plus
a 3-engine daily pulse (the panel size is an owner decision). The accuracy check — mandatory in the criteria — has not run on any rating
because no business profile exists. Per-engine change tests exist but cannot fire until each engine holds 12 samples on both sides.

**Cost.** DataForSEO $0.7892 measured by the run; with 777 overlapping, the account moved $1.1738 for both against $1.1617 of engine
figures (1.0% apart; the engine says it "cannot be attributed" and keeps its task figure). Claude: n8n 4 Sonnet calls 30,574 in / 4,291 out
= **$0.1041**; the engine settled $0.1115 ("$0.0951 measured, $0.0164 estimated" — the thinking tokens). `count_tokens` counted the answers
as 1,077 (AI Brief) and 3,014 (Answer Analyst, 3 calls) tokens against n8n's 1,127 and 3,164: the answer is now counted as text, not as
the string "[object Object]" (5 and 15 tokens on 2026-10-15). Front-door row 153 settled **$0** (2026-10-15: $0.95 "ESTIMATED" for the
same request).

## 2. Backlinks (run 13, executions 774 → 775 → 777)

**What was asked.** `{"mode":"backlinks","keyword":"","competitors":["cleartax.com","azentio.com"]}` (no `free_only`), started 2 s after
the AI visibility request — the conditions under which 2026-10-15 exec 624 refused itself. 202 in 1.43 s.

**The gate.** 777's *After Run Ledger (BL)* let it run: the front-door run 775 wrote its row 154 with key `app:<company>`, and the monitor's
own row 155 carries key **`parent:775`** — the gate no longer reads the parent's reservation as "the previous backlinks run is still
going". 777 started at 16:29:30 and finished at 16:30:24 (54 s). *Alert Retry Plan (BL)*: `"no alert is waiting for delivery"`.

**What came back** (`files/C-bl-777-report.txt`, `C-bl-777-report.json`). Mode `full`, "changes since 2026-10-16".

- Sources: DataForSEO index 2 (only-this-source 2), Bing Webmaster 0 ("connected; Bing reports no links to this site yet"), Search
  Console upload 1 ("export of 2026-10-14"), GA4 referrals 1 ("not links: teams.public.onecdn.static.microsoft"), Common Crawl 1;
  **union 4, "+1"** (previous full snapshot 3). Of the merged entries, peppol.org now comes from GA4 + Common Crawl, tracxn.com from the
  Search Console upload; the DataForSEO index carries 18 referring domains of which 18 are link-farm / PBN pages.
- Own check: *"Of the 20 referring pages we could read, 3 still carry the link (15%), and of the 18 the DataForSEO index reports live, 1
  are live (6%)."*
- Link farms: **18 set aside** ("the same page path on 17 sites (/all/2835/13.html)"; seonix.agency "labelled spam by the Link Analyst"),
  alert level `low`. One **new** link this week: techbumppy.com (anchor "High Quality Dofollow Backlinks DA 50 PA 40 Premium PBN Network
  Service techand.ai …", first seen 2026-10-16), shown under "New links" and "Spammy new links" and as a farm `at_risk` (our fetch did not
  find it on the page, `verified: missing`).
- Lost: none ("every linked page works"). Best links: peppol.org 35 / 25 / 44 (594 · DR 77, ✓ on the page), tracxn.com 21 / 0 / 43
  (nofollow, 540 · DR 79). Same two as on 2026-10-15.
- Anchor block: *"web address 50% · image / empty 50% — over the 2 referring site(s) our own check found linking, with 2 link-farm
  site(s) left out of these percentages. The table below is the link index's own anchor list; the 2 anchor(s) in it that link farms use
  … are marked, not counted above."* (On 2026-10-15 it said the farms were left out of the table they filled.)
- "Best of" lists (8): azdan.com "20 Microsoft Dynamics Partners in the GCC" and "Top 20 UAE E-Invoicing ASP", "Top 10 Microsoft Dynamics
  Partners in UAE", complyance.io "Top 5 UAE E-Invoicing Partners …", Refrens, "20 Best e-Invoicing Software in UAE (Oct 2026)",
  pactsoft.ae "Top E-Invoicing Software in UAE for VAT Compliance", penieltech.com "5 Best E-Invoicing Tools in UAE". These are list
  pages by title (on 2026-10-15 five of the eight were competitors' own service pages).
- "Sites that just linked to a competitor": halsimplify.com (an e-invoicing article → cleartax.com) and **marketguest.com** ("Questions
  Before Buying Property in Malaysia: A Buyer's Guide" → cleartax.com, anchor "Malaysian stamp duty guidance").
- Link gap (20): mof.gov.ae refused as government; 18 refused *"off topic for you: neither its name, its page nor its country ties it to
  dynamics 365 partner uae"* — including **gulfnews.com**, a UAE newspaper; uae-asp.ae has no note.
- Prospects written (*Prospect Rows*, 8): azdan.com list 35, complyance.io list 28, pactsoft.ae list 36, penieltech.com list 33,
  halsimplify.com comp_new 39, **marketguest.com comp_new 35**, uae-asp.ae gap 28, nationalbonds.ae gap 33 — **every one with
  `target_url https://www.techand.ai/dynamics-365-crm-uae`**, the only "asset" in *BL Plan* (`assets: [{… kind "hub page"}]`), including
  the four e-invoicing lists. See C-10.
- Outreach drafts: "No new drafts this month" (the Link Builder is on for the site). Link Analyst did not run (0 Claude calls).

**What the customer sees.** `backlinks_started` 16:29:38 (*"Your backlink check for techand.ai has started …"*) and `backlinks` 16:30:24,
"Backlink report · techand.ai", subject "[Backlinks] techand.ai — 4 referring sites", summary `{lost 0, spammy 1, backlinks 20, prospects 60,
importantLost 0, referringDomains 4}`, PDF attached.

**Where it is right.** The request was not refused by its own parent (2026-10-15: refused, customer never told); the farm set-aside,
"lost" only after our own fetch, the anchor block now consistent with its table, list detection now on real list pages.

**Where it is wrong.** C-10 (every prospect pointed at the Dynamics 365 CRM page; an off-topic Malaysian property article saved as a
prospect; a UAE newspaper refused as "not tied to the country").

**Gap to the leader** (4B). Ahrefs-scale index and lost-reason taxonomy; here the whole real picture is 2–3 genuine referring sites, and
DataForSEO's index sees 0% of Google's own sample — the merge across sources is what keeps the result usable.

**Cost.** $0.3725 measured from its tasks (row 155); shared window with 776 above. Front-door row 154 **$0** (2026-10-15: $0.50
"ESTIMATED" for a request that spent nothing).

## 3. AI Pulse (run 16, executions 778 → 779)

21 answers = 7 buyer questions × ChatGPT, Gemini, Google AI Mode; 0 errors, 1 retried. Report (`files/C-pulse-779-report.txt`):
*"21 answers from ChatGPT, Gemini, Google AI Mode to your 7 tracked questions. Named in 0% (95% range 0-15.5%), your pages cited in 0%.
6 of the past 7 days are comparable (readings: 6 of 7); 1 left out (2026-10-16 — answered by ai_mode, chatgpt, today by ai_mode, chatgpt,
gemini)."* — the 2026-10-16 day whose Gemini answers failed is excluded from the like-for-like comparison and the reason is printed.
`alerts: []`; `multiple_tests {method holm, alpha 0.01, tests 0, note "No alert this run rested on a statistical test, so no
multiple-comparison correction was needed."}` (the pulse uses α 0.01, the weekly report 0.05 — stated in each).

Storage: `seo_ai_daily` now has two 2026-10-17 rows — id 10 (`pulse_20261017_techand-ai`, the catch-up's run 735 at 15:10) and id 11
(`pulse_20261017_techand-ai_on_demand_779`). The on-demand reading no longer overwrites the scheduled one (it did on 2026-10-15).

App: `ai_pulse` 16:35:31, title **"AI pulse alert · techand.ai"**, subject "[AI pulse] techand.ai — 0 change(s) in today's AI answers",
summary `{alerts 0, samples 21, mentionRate 0}` (C-14). Cost: $0.088 measured = account; Claude settled **$0** ("this workflow has no
Claude node … nothing is settled against the $0.0040 it reserved") — on 2026-10-15 it settled $0.004 for a call that never ran.

## 4. Link Builder (run 15, executions 780 → 781)

**What was asked.** `POST /webhook/seo-link-builder` `{"domain":"techand.ai","request_id":"rr1017-lb-paid"}` + company callback; 202
`link_builder_started`.

**What came back** (`files/C-lb-781-report.txt`, `C-lb-781-report.json`). *LB Assemble* summary: `qualified 11` (`ready 3`, `needs_contact
8`), `not_fit 37`, `to_draft 4`, podcasts read 5 (all not fit, each with its topic match: 7%, 28%, 7%, 38%, 7% against a 40% bar),
journalist requests 0, redirects 0, listings missing 2 / linked 1.

- **A new "competing provider" rule** refused tronstride.com (*"their own site … offers 7 of your services (\"Intelligent Document
  Processing\", \"Dynamics 365 Finance\" …) with the signals of a vendor selling them (\"free trial\" …)"*), mabbaz.com (9 services) and
  creuto.com (*"their page sells what you sell (52% of your service words, topic match 84%, \"book a call\")"*). The outranks-you rule
  refused e-invoicingsoftware.ae, ebrsoftware.com, youngandright.ae, andersen.com, flick.network, covoro.ai, hlbhamt.com, azdan.com,
  rvguae.com, wafeq.com, each with its keyword and position. Lists of accredited providers refused: *"you get on it by applying with the
  accreditation, and the facts on file do not say you hold one (asking to be added claims it)"* (coreholdsolutions.com, consultsynergy.ae,
  e-invoices.ae, focussoftnet.com). Government, zoominfo.com and outlook.com refused as on 2026-10-15.
- **Still qualified although they sell the same services** (page titles fetched today): **erp-dubai.ae** "ERPNext Implementation Partner in
  UAE & Dubai 2026" (`needs_contact`, fit 0.84), **penieltech.com** "Odoo Implementation in Umm Al Quwain" (`needs_contact`, 0.67),
  **pactsoft.ae** "Top E-Invoicing Software in UAE for VAT Compliance" (PACT Software, which the AI visibility run names among the
  businesses AI recommends instead of Tech& for "How do I choose an ERP implementation partner in Dubai…") (`needs_contact`),
  **halsimplify.com** (HAL ERP) and **tradeshift.com** (`needs_contact`), **complyance.io** (`ready`; the writer declined it, §below). See C-1.
- Writer (Claude *Outreach Sequence Writer*): 4 jobs, **3 drafted, 1 declined** — complyance.io: *"Their page is a ranked list of
  e-invoicing partners that names a competitor (cleartax.com), and Tech& does not hold e-invoicing provider accreditation. Such lists are
  joined by applying, not by a pitch"*.
- Draft gate (*LB Draft QA*): **all 3 held**. turbolens.io — *"needs you: [Owner: confirm — one-line summary of the page]; needs you: [Your
  name]; the first e-mail carries 2 links (one, to your page); the first e-mail links to concur.com.sg, not to your site"*; mazeed.com —
  *"needs you: [Your name]"*; alaan.com — *"needs you: [Your name]; needs you: [Owner: confirm — quote or tip]"*.
- **Quotes verified on the live pages (GET today):** turbolens.io's post links "Source" to the concur.com.sg article, which answers
  **404** — as the draft says; mazeed.com/e-invoicing-in-uae carries *"as your accounting software, your ASP integration partner, or
  both"*; alaan.com's implementation guide carries *"is not a quick plug-and-play exercise"*. Our offered pages exist
  (`/whywith-techand` 200, `/dynamics-365-project-operations-uae` 200, `/dynamics-365-crm-uae`). The pages offered are weak fits: the
  turbolens replacement for an AP-automation source is the "Why Tech&" page; mazeed's e-invoicing readers are offered the **Dynamics 365
  CRM** page.
- Listings checklist (16): MoF accredited providers and OpenPeppol "Not listed" with the accreditation requirements; LinkedIn "Linked";
  SaaSHub / AlternativeTo "Listed (no link seen)"; 11 "Not checked (the site blocks checks)".
- Impact: peppol.org "Too early to tell" (1 week), tracxn.com "Can't tell — the page had no search impressions before or after the link"
  (6 weeks); control group = the site's other pages.

**What the customer sees.** `link_builder` 16:38:49, "Link building · techand.ai", subject "[Link building] techand.ai — weekly
opportunities", summary `{press 0, drafted 0, redirects 0, impactReads 0, listingsMissing 2}`, PDF attached. The report's first panel:
"Pitches ready 0 · 3 more need your edit".

**Where it is right.** Every quoted line exists on the prospect's page; a dead link claimed dead is dead; nothing is sent; every held
draft says exactly what is missing; three direct competitors are now refused by a services-overlap rule with the evidence quoted.

**Where it is wrong.** C-1 (the overlap rule misses ERP / e-invoicing implementers that do not use its vendor signals).

**Gap to the leader** (4C). No mailbox is connected (deliberately), so no send, reply, follow-up or bounce figure exists.

**Cost.** $0.0498 measured "against the account: this run was the only one in flight … the balance fell $0.0498 — its own tasks report
$0.0498, which agrees" (the account moved $0.049764). Claude: n8n 4,033 in / 1,607 out = **$0.0241**; engine $0.0299 (of which $0.0080
modelled thinking).

## 5. AI Growth, `dry_run: true` (run 17, executions 782 → 783) — first live rating

**Checked before starting.** In the live workflow (`GET /api/v1/workflows/SEOagentAIGrow1`, updated 2026-10-17T15:07:35Z, 116 nodes; every
node's parameters equal `workflows/SEO_Agent_AI_Growth.json` except *Alert Retry Plan (Growth)*, which carries the substituted alert
webhook): *Bing Submit Requests* and *IndexNow Requests* read `dry_run` from the *Manual Run* item (or its `body`) and, when true, emit
`{skip: true, dry_run: true, would_submit: […]}` instead of a request; *Any Bing Submit?* and *Any IndexNow?* test
`={{ !$json.skip && !$json.dry_run }}` and are the **only** inputs of *Submit to Bing* and *Submit IndexNow*. The Test Runner forwards
`{headers, body:{…, dry_run: true}}`, which that reader accepts.

**What happened** (`exec-783.json`).
- *Manual Run* body: `{"domain":"techand.ai","request_id":"rr1017-growth-dry","dry_run":true, …}`.
- *Bing Submit Requests* output `[{"skip": true}]` — **no URL to submit at all** (the plan's `submit` list was `[]` and every page
  Bing was asked about has a crawl date), so the dry-run branch itself was not exercised. *Any Bing Submit?* true-branch: 0 items.
- *IndexNow Requests* `[{"skip": true}]` (the key file URL returned an HTML error page, not the key). *Any IndexNow?* true-branch: 0 items.
- **`Submit to Bing` and `Submit IndexNow` do not appear in the execution's run data — neither node ran.** The only Bing calls were
  reads: *Fetch Bing Sites (Growth)* and *Fetch Bing Growth* (17 items: one `GetUrlSubmissionQuota` — DailyQuota 100, MonthlyQuota 1500 —
  and 16 `GetUrlInfo`). Nothing was submitted to Bing or IndexNow.

**What came back** (`files/C-growth-783-report.txt`, `C-growth-783-report.json`).
- *"DRY RUN — nothing was submitted: 0 page(s) would have been sent to Bing and 0 notified through IndexNow (a test run; the weekly run
  submits)"*.
- *"Of 22 page(s) sent in the last 45 days, 18 have since been crawled by Bing and 4 not yet — measured from Bing Webmaster Tools, not from
  the fact that we sent them"*.
- **Readiness fetched as the AI bots:** *Fetch As AI Bots (Growth)* 48 requests = 12 key pages × OAI-SearchBot, ChatGPT-User,
  PerplexityBot, Claude-User user agents — **48 × HTTP 200**. 12 key pages scored, average **81/100** ("was 75"): `/whywith-techand` 70,
  `/dynamics-365-business-central-uae` 72, five service pages 79, three insights 86, the penalties insight 90. Each with one fix, e.g. *"The
  date is only in the metadata: show it on the page ("Last updated: …")"*; robots.txt read "matched by Google's documented rules".
- Earned media: *"15 page(s) AI cites without naming you, 9 handed to the Link Builder (one writer)"*; 12 shown — the FTA page "79x", two
  MoF pages "93x" each, finline.ae 37x, hawksford.com 23x, tallysolutions.com's cost guide "Competitor page 63x — answer the same question
  better on your site", fastlanecareer.com 20x, **flick.network "'Best of' list 13x — Ask the editor of flick.network to add Tech& to this
  list"**, taxstar.app, trustbill.ae, infinite-it.com (title shown as "Peppol E"), marmin.ai. See C-2, C-3.
- Questions queued: 6 (2 "written as the keyword ladder page … (one search, one page)", 4 "no page answers it yet"). Entity: no Wikidata
  item. IndexNow: the key file instruction (the key file still answers with an HTML page, not the key).
- The report explains what a submission reaches (Bing / Copilot; OpenAI documents OAI-SearchBot, not Bing) and that Bing's AI Performance
  report has no API.
- Corrections for wrong AI claims: *Growth Plan* `corrections: []` — nothing to correct without a business profile; the report has no
  corrections section.

**What the customer sees.** `ai_growth` 16:42:24, "AI growth · techand.ai", subject **"[AI growth] techand.ai — done for you this week"**,
summary `{earned 15, targets 6, avgScore 81, submitted 0, pagesChecked 12}`, `status: progress` — a finished, deliverable report by the
app's rule (C-11).

**Where it is right.** Nothing was submitted, and the report says so in its first line; Bing crawl state is read from Bing, not inferred
from the submission; readiness is fetched with the AI fetchers' own user agents; the reach of a submission is stated without
over-claiming.

**Where it is wrong.** C-2 (a rival's list offered as a pitch), C-3 (citation counts against the stated lineage), C-11 (a dry run stored as
a deliverable "done for you" report).

**Gap to the leader** (criteria 4A "acting"). No Copilot citation data (no API, stated); no corrections without a profile; the IndexNow key
file is still not hosted, so same-day notification cannot happen.

**Cost.** $0 DataForSEO, $0 Claude (the outreach writer did not run: the Link Builder owns drafting) — row 159 `done`, `dfs_usd 0`.

## 6. Rank Tracker (run 18, executions 784 → 785)

**What was checked** (*Tracker Plan*, 12 items): the heads of 8 ladders (desktop) plus, for the newest ladder "it consulting dubai"
(planned today by executor A), its three rung-1 keywords and **one mobile** check of its head. Unpublished rung pages deferred to their
monthly check ("not published yet: checked monthly, last 2026-10-01 / 10-11 / 10-12 / 10-14 / 10-15"). 12 tasks, all read, **$0.1160**
"measured: 12 task(s) at what each reported, counted once by task id across both attempts".

**What came back** (`files/C-rank-785-reports.txt` / `.json`, 9 reports). Subjects now say "top 50" (2026-10-15: "top 100" over a top-50
body). Only one tracked page ranks: **peppol uae #46 (was #48)** with `/insights/upgrading-your-erp-for-uae-peppol-pint-ae-compliance-…`.
Everything else "not in top 50". Per keyword: SERP features, modelled share of voice with the Ahrefs December-2025 AI-Overview loss
printed, competitors above, AI Overview sightings with their timestamps ("seen in 4 of 4 checks …"), lineage table.

- **"Outranked" / own move vs SERP churn.** No "outranked" line appears in any report today (no tracked page dropped). Page movement is
  printed per keyword: e invoicing in uae *"the whole results page moved: 9 of the top 9 places changed since the reading of 2026-10-16, 9
  new pages came in"*; erp software uae 9 of 9 (8 new); dynamics 365 partner uae 7 of 9; azure cloud migration dubai 10 of 10; ai
  consulting dubai 1 of 9 ("barely moved"); peppol uae 0 of 10 ("still"); erp implementation dubai **"8 of top 8 changed (noise)"**.
  I read `seo_rank_history` for "e invoicing in uae": today's top ten (tax.gov.ae, mof.gov.ae, grantthornton.ae, edicomgroup.com,
  cleartax.com, tallysolutions.com, pwc.com, hawksford.com, u.ae, marosavat.com) is **identical** to the readings of 2026-10-15 19:48 and
  2026-10-16 00:33; the reading compared against (2026-10-16 19:58, fix-wave exec 715, same request: location 2784, en, desktop, depth 50)
  was a different page (vatcalc.com, covoro.ai, youtube.com …). "9 new pages came in" is a comparison with one outlier reading. See C-4.
- **Cannibalisation** is not reported by the Rank Tracker; it is in the Site Tracker (§7).
- **Share of voice:** 0% for every ladder, "unweighted: none of these N keywords had Search Console impressions … so every keyword
  counts the same"; peppol uae's line reads *"only one of these 1 keywords had Search Console impressions …, too few to weight by"*.
- Next steps, quoted: e invoicing in uae — *"Work on rung 1 … "uae e invoicing penalties" (…the-cost-of-non-compliance… already answers
  this search — refresh that page, do not publish a second one), "e invoicing uae fta" (a page run was started for it but no page was
  written — it is written again) …"*; erp software uae — *"written but not live yet: publish it at https://www.techand.ai/erp-software-uae/"*
  (content log `written`, passed QA); erp implementation dubai — *""service industry erp software" (already written — publish it)"* (also
  `written`); azure cloud migration dubai — *""azure api management monetization" (written, but the draft did not pass the quality check
  (11 bracketed field(s) …) — fix it and run it again; do not publish it as it is)"*; ai consulting dubai — *""ai consulting"
  (https://www.techand.ai/ai-copilot-advisory-uae already answers this search — refresh that page, do not publish a second one)"*; it
  consulting dubai — *"This plan writes the main page first: write the main page "it consulting dubai""*. On 2026-10-15 the same report
  said "publish" for drafts QA had refused; today "publish" appears only for the two `written` pages. See C-7 for the two that disagree
  with the Site Tracker.
- peppol uae: the page that ranks (#46) is the PINT-AE integration guide, while the next step names a different page as *"the page the
  site already has for this search"* (C-13).
- "facts erp" (facts.ae's brand; facts.ae is #3 for "erp software uae" in this run) is still listed as a rung of the erp software uae ladder
  (C-12). The 2026-10-15 "Set aside … e invoicing in uae … the results page belongs to government sites" line does not appear today; the
  ladder is pursued.
- Tracked keywords report: *"3 of 3 read"*, all from results pages already bought ("No check was bought for your keyword list this week").

**What the customer sees.** 9 `rank_tracker` rows at 16:44:22 ("Rank tracker: peppol uae", … "Rank tracker: the keywords you asked us to
watch", "Rank tracker: it consulting dubai").

**Gap to the leader** (criteria 2). Weekly, country-level, desktop with mobile for one keyword this week; AI Overview citations not loaded
for most keywords; no competitor-movers view.

**Cost.** $0.116 measured = account ("only one in flight … $0.1160 — its own tasks report $0.1160, which agrees"). Claude none.

## 7. Site Tracker (run 20, executions 786 → 787)

**What came back** (`files/C-site-787-report.txt`, `C-site-787-report.json`). Period 2026-09-17 to 2026-10-14 vs the 28 days before.
Headline (Claude *Site Brief*): *"Tech& impressions nearly tripled, but only 30 clicks and several key pages are not indexed"* — clicks 30
(+36%, "not statistically significant"), impressions 5,358 (+181%, "a real rise"), position 25 (from 31.3), organic sessions 81 (+84%,
real), 0 key events.

- **Monitor block (the diff basis).** *"Full SEO report (2026-10-17) health 70/100 (Needs Improvement) · 0 critical, 15 high, 15 medium ·
  45 pages crawled"* and *"Technical audit (2026-10-17) health 85/100 (Good) · 0 critical, 4 high, 7 medium · 45 pages crawled"* — two
  separate lines, no delta across report types; backlinks *"4 linking sites (all sources) ▲1 · DataForSEO's index: 19 · 1 new / 0 lost"*
  (union against union). On 2026-10-15 this block printed "health 70/100 ▼13" (full vs technical) and "18 referring domains ▲18" (full vs
  free snapshot).
- **Brand series** (new): branded Search Console clicks 3 → 5 ("95% range -60% to 597%"), GA4 direct sessions 171 → 195, AI-assistant
  referral sessions 0 → 0 — *"shown side by side and never added together"*. Brand split: *"brand: 5 clicks from 6 queries (brand =
  techand, tech and)"* — the 2026-10-15 "tech" contamination is gone. But **"techandkey com"** (411 impressions, #7.8) — a search for a
  different website (techandkey.com, title "TechAndKey - Latest Tech News, Gadget Reviews & Innovations", fetched today) — is correctly
  non-brand and is then recommended: **"Quick wins: striking distance … techandkey com #7.8 … /whywith-techand"**, **"Low click-through
  for the position (rewrite titles) … techandkey com … Expected 4%"**, and listed under "Searches two of your pages compete for". See C-6.
- **Cannibalisation** (new): *"Searches two of your pages compete for"* — techandkey com (/whywith-techand 59.4% vs / 39.9%), tech and
  tech (three pages), dynamics 365 finance in uae (the VAT-compliance insight 59% at #21.9 vs `/dynamics-365-finance-and-operations-uae`
  27.9% at #29.9). The note says *"brand searches are left out"*; "tech and tech" contains the brand phrase "tech and" and is listed.
- **Content groups** (new): Insights 12 pages, clicks 4 → 6, "Watch … (inside normal variation)"; Dynamics 365 services 7 pages, 1 → 8,
  "Watch: up 700% (… 95% range 0% to 6296%)"; all other pages 17 → 16 "No real change"; *"at least 40 clicks across both periods and a
  10% move that survives the significance test"*.
- **Discover / Google News** (new): *"This property has no Discover data: Search Console returned no Discover rows for the last 56 days."*
  and the same for Google News — stated, not shown as zeros.
- Search Console depth: 535 named queries; withheld *"23 clicks and 1,451 impressions, 27.1% of all impressions"*; one scraper query
  (an operator-laden "uae federal tax authority" string) set aside; preliminary 3-day data shown apart.
- Do this week: request indexing for three pages; *"Publish the two finished pages: …/service-industry-erp-software/ and …/erp-software-uae/"*
  (both `written` in the content log); *"Fix the four drafts that failed the quality check and run them again. Do not publish them as they
  are."* — azure api management monetization, it consulting dubai, ai consulting, uae e-invoicing deadline 2027 (all `not_ready` in
  `seo_content_log`); host consolidation; refresh the F&O page (1,895 impressions, 1 click).
- Alerts list: "Page not indexed: …/d365-finance-operations-implementation-rollout-uae" and "…/ai-copilot-advisory-uae" **each printed
  twice**; the index-status table also lists `/d365-…-rollout-uae` and `/insights/top-peppol-…` twice, and shows `/dynamics-365-crm-uae`
  as **"planned"** with "Submitted and indexed" (C-15).
- Annotations: the August and September 2026 spam updates and every audit event up to 2026-10-14, each type compared only with its own
  type ("the report before it was a technical audit (80/100): different checks, so the two scores are not comparable").
- Decay: 44 pages tested, 0 losing, 44 too few clicks. Trends: all four "too little search volume for a trend".

**What the customer sees.** `site_tracker` 16:46:12, "Weekly site report · techand.ai".

**Gap to the leader.** No archive beyond Search Console's 16 months; Search Console's generative-AI performance report is stated as API-less.

**Cost.** DataForSEO $0.031 measured "against the account" (2026-10-15: $0.01 "ESTIMATED" while ≈$0.031 moved). Claude: n8n 16,500 in /
1,415 out = **$0.0471**; engine $0.0491 ($0.0041 modelled).

## 8. Page Watch (G11, executions 788 → 789)

25 of 45 known pages watched (home 1, nav 6, search 16, ladder 1, page 1) + robots.txt; 26 requests, all 200; 0 changed; robots.txt hash
`73c6cb2b` = previous; `alerts: []`, *Watch Alerts* "nothing changed on the key pages today". The menu fragment URLs watched on 2026-10-15
(`/industries#bfsi`, `/capabilities#ai`) are gone from the list. Google's view per page (inspection of 16:45 by the Site Tracker): 17
"Submitted and indexed", 5 "URL is unknown to Google" (`/industries`, `/capabilities`, `/capabilities/cloud-services`,
`/capabilities/data`, **`/whywith-techand`** — the page Search Console credits with 411 impressions in §7, not verified which host Google
holds it under), 2 "Duplicate, Google chose different canonical", 1 "Discovered - currently not indexed". $0, no callback (nothing
changed). `files/C-watch-789-compare.json`.

## 9. Content Cadence dry run (run 19, executions 790 → 791)

Live workflow checked: *Dry Run?* (`!!$json.dry_run`) → *Planned Only*; *Start Content Runs* only on the false branch. In 791 neither
*Start Content Runs* nor *Save Content Log* ran. *Cadence Plan* (`files/C-cadence-791-plan.json`): *"6 written pages waiting for publication
(pile-up guard, limit 3): "erp software uae", "service industry erp software", "azure api management monetization" (needs a fix: it did not
pass the quality check), "ai consulting" (needs a fix …), "uae e-invoicing deadline 2027" (needs a fix …), "it consulting dubai" (needs a
fix …) — publish the ones that passed, and fix the 4 that need a fix and run them again, to continue"*. Queue behind the pause: four rungs
of the e invoicing in uae ladder; four ladders queued behind `max_active` (erp implementation dubai, azure cloud migration dubai, ai
consulting dubai, it consulting dubai). Nothing written, no run spawned, no callback; row 163 $0.

## 10. Audit Scheduler (run 21, executions 792 → 793 → 794)

*Audit Schedule Plan*: `run: true, why: "on demand"`, sitemap fingerprint `1eb0as2` (45 entries, lastmod 2026-10-09) refreshed in
`seo_cache`; body `report_type "Site Audit (technical issues only)"`, `crawl_pages 200`, **`crawl_js: false`**, `ga4_property_id
"543096312"` (now passed by the scheduler). Audit 794 (5 min 44 s): 47 pages crawled (ledger), health **85 "Good"**, 0 critical / 4 high /
6 medium (app summary).

**Diff** (`files/C-audit-794-diff.json`, from the app's `site_audit` payload): *"1 fixed · 0 new · 21 still open (compared with the technical
audit of 2026-10-17)"* — previous = `aud_mvcl9in6c1y`, executor B's audit 739 of 16:06 **with `crawl_js: true`**. The one "fixed" finding
is **"AI crawlers see a different version of 20 key page(s)"** (Medium) — a finding that comes from 739's JavaScript render comparison
(B's part, finding B-1, judged it false). My audit, 48 minutes later, did not crawl with JavaScript; `seo_audits` has no `crawl_js`
column and the diff's `crawl_js` / `basis` fields are `null`, so the change of method is printed as a fix (C-5). Every other open finding
compares like for like (e.g. "www and non-www are split in Google … 15 ← 15, checked 45 ← 45").

On 2026-10-15 (exec 641): health 83, "0 fixed · 0 new · 27 still open" against a technical audit of the same day.

App: `site_audit` 16:53:52, "Technical audit · techand.ai", `status: completed`, summary `{high 4, grade Good, medium 6, critical 0,
scoreDelta 0, healthScore 85}`. Cost: $0.032 measured (crawl + GBP lookup), the account moved $0.03195 for 793 + 794.

## 11. The error path (run E, executions 798 → 799) and the alert record

**The failure.** Test Runner body `{"workflow":"SEOagentNoSuchWf","request_id":"rr1017-errpath"}` → 202 → *Run Target* error **"Workflow
is not active and cannot be executed."** (798, `error`, 20:34:50).

**The Error Handler (799, 20:34:50.266–20:34:53.902).** *Alert Record* found the 2026-10-15 row 5 (same key) and counted a second
sighting. Channels:

| Channel | Node | Answer |
|---|---|---|
| the owner's Slack webhook | *Post Alert Webhook* (633 ms) | **HTTP 200, "ok"** |
| the ops mailbox (configured in `n8n/.env`) | *Email Ops* (2,021 ms) | **SMTP "250 2.0.0 OK", accepted 1, rejected 0** |
| the data table | *Save Ops Alert* / *Save Alert Delivery* | row 5: `delivered "webhook,email"`, `attempts 2`, log line 2 "2026-10-17T20:34:53Z webhook+email delivered" |

**The retry of an older alert — once, and written back.** *Alert Retry Plan* picked row 4 (Console Alerts IMAP deactivation), which had
failed at 18:31 (attempt 5) and was due at 19:01: `attempt 6, severity critical, escalated true`. *Post Alert Retry* ran **once** (HTTP
200) and *Save Alert Retry* wrote it back: row 4 `delivered "webhook"`, `attempts 6`, `next_attempt_at ""`, notes *"delivered by webhook on
attempt 6 (HTTP 200), re-sent by SEO Agent — Error Handler"*. On 2026-10-15 the same alert was re-posted twice per Error Handler run and
on every monitor run (14 times that day) with nothing written back. Today **none of my 11 monitor / audit runs re-sent anything**: every
*Alert Retry Plan* in 776, 777, 779, 781, 783, 785, 787, 789, 791, 793 answered `"no alert is waiting for delivery"` (row 4 had been
delivered at 15:09).

**Error Handler 797 (18:31:26–18:31:49 UTC, nobody started it).** Trigger: `WorkflowActivationError` *"The trigger node "Mailbox Trigger"
failed at runtime and was deactivated"*, cause *"IMAP connection closed unexpectedly"*, workflow `SEOagentConsole1`. Both channels failed:
Slack *"getaddrinfo ENOTFOUND hooks.slack.com"* (10 s), e-mail *"getaddrinfo ENOTFOUND smtp.gmail.com"* (10 s); row 4 → `failed`, sighting
5, attempt 5, `next_attempt_at 19:01:49`. The Mac's power log: woke 18:28:53 UTC (23:28:53 PKT) after a sleep from 18:13, slept again
18:35:39 — DNS was not yet available. The n8n log at 18:31:42: *"Failed to reactivate trigger node "Mailbox Trigger" … getaddrinfo
ENOTFOUND imap.gmail.com"*; no later reactivation line appears in the log. The public API still reports the workflow `active: true`, so
whether the IMAP watcher is listening now is **not established** (C-16).

**The IMAP trigger's record** (Error Handler executions): 723 (2026-10-16 20:47, delivered), 730 (2026-10-17 12:22; *Post Alert Webhook*
took 1,879 s — the Mac slept mid-request — then failed on both channels), 731 (12:53, failed on both: *"getaddrinfo ENOTFOUND
hooks.slack.com"*, *"connect ECONNREFUSED …:465"*), 797 (18:31, failed on both). Each drop logs a failed reactivation with ENOTFOUND
imap.gmail.com. Row 4's log is now: 1 delivered (10-16 00:27) · 2 delivered (10-16 20:48) · 3 failed (10-17 12:54) · 4 delivered by Page
Watch's retry (15:09) · 5 failed (18:31) · 6 delivered by my error test's retry (20:34).

**The alert table after the test** (`files/C-ops-alerts-after-errpath.json`, 6 rows): 1–3 as on 2026-10-15 (delivered); **4** IMAP
deactivation, `delivered webhook`, attempts 6, count 5; **5** Test Runner, `webhook,email`, attempts 2, count 2; **6** Schedule
Catch-up 728 time-out (2026-10-17 10:19, delivered by webhook + e-mail by Error Handler 729).

## 12. Schedule reliability and the catch-up (read-only)

**Fires since 2026-10-01** (`files/C-schedule-executions.json`; mode `trigger` = fired by its own schedule). Rank Tracker, Site Tracker,
AI Growth, Content Cadence, Link Builder, Audit Scheduler: **0 trigger-mode executions ever**. AI Visibility 1 (2026-10-12 11:25),
Backlinks 1 (2026-10-12 16:19). AI Pulse 6 (last 2026-10-15 11:11). Page Watch 4 (last **2026-10-16 15:15**, due 09:45 — 5 h 30 min
late). **Since the 2026-10-16 18:30 deploy no workflow has fired by its own schedule** — the only trigger-mode execution is the catch-up's
own sweep 728. No Monday has passed since the deploy, so the weekly crons have not yet been due.

**What the catch-up did** (`seo_cache` `catchup:*`, `files/C-catchup-records.json` / `-end.json`). Its successful executions are not
kept (`settings.saveDataSuccessExecution: "none"`), so its record is the cache rows:
- `catchup:armed` 2026-10-16 00:24 (first arming; nothing older is replayed).
- AI Pulse due 2026-10-16 10:30 → started at **18:27:52** by the `init` entry (exec 678), *"n8n restarted after it was due, which re-arms
  every schedule for its next time"* — 7 h 58 min late.
- Page Watch due 2026-10-17 09:45 → started **15:09:02** (exec 734, `init` after the 15:07 deploy restart) — 5 h 24 min late.
- AI Pulse due 2026-10-17 10:30 → started **15:10:04** (exec 735) — 4 h 40 min late. Neither due fire of 2026-10-17 had fired on its own
  before the 15:07 restart; the Mac's power log shows it asleep through both due times except brief dark wakes.
- `catchup:last` (last sweep recorded **18:07:04**): 10 schedules read, *"0 start(s)"*; Pulse and Page Watch `caught_up`; the eight weekly
  / monthly ones `out_of_window` — *"the last fire was due 125 h ago; only fires due in the last 36 h are caught up"*. The Monday
  2026-10-12 fires (all missed) are therefore permanently lost. No sweep is recorded for 19:07 or 20:07 (the Mac slept 18:35–20:30 UTC
  apart from dark wakes).

**Why execution 728 was cancelled after 44 minutes.** 728 is the hourly sweep (cron `7 * * * *`), started **09:35:32 UTC** (28 minutes
after its 09:07 due time). Its first node, *Catch-up Entry* — a short Code node — shows an execution time of **2,643,925 ms** and outputs
`now: "2026-10-17T10:19:36.789Z"`; the run was then cancelled with `TimeoutExecutionCancelledError` ("timed out", workflow
`executionTimeout: 900`). The Mac's power log (PKT = UTC+5): a maintenance dark wake ended at 14:35:11 PKT (09:35:11 UTC), sleep until
the next dark wake at **15:19:23 PKT (10:19:23 UTC)**. The node started in the last seconds of a wake, the VM was suspended mid-node,
and when it resumed 44 minutes of wall-clock had passed, more than the 900-second limit. Established by the timestamps; the VM pause
itself is inferred, not observed. The time-out produced alert row 6 (Error Handler 729, delivered).

**The run ledger agrees.** Since 2026-10-16 18:00 every `schedule:*` ledger row belongs to an `integrated` execution (catch-up starts,
fix-wave and re-rating Test Runner starts), none to a `trigger` one. Note: Test Runner starts are keyed `schedule:<mode>` in the ledger
(rows 157–164 of this wave), indistinguishable there from real scheduled fires.

## 13. Ledger and reliability across this wave

- Rows **153–165** (13), every one `done`; **none `reserved`** (a filter on `status = reserved` returns nothing). Front-door rows 153 and
  154 carry $0 and the monitors' rows `parent:773` / `parent:775` carry the money — no double count (2026-10-15: $2.89 of rows against
  $1.48 moved).
- Every paid run alone in its window states `"attributed": true, "alone": true` and agrees with the account to the cent (779, 781, 785,
  787, 794); the overlapping pair states it cannot attribute and keeps its task figures (1.0% under the account).
- Claude: every row labels its figure "PARTLY ESTIMATED" with the measured and modelled parts apart; the engine's $0.1905 is 8.7% above
  n8n's measured $0.1753 because of modelled thinking.
- Alerting: one deliberate failure reached Slack and e-mail in 3.6 s with the delivery recorded; one older due alert retried once and
  written back; no stale alert re-sent by any monitor.

---

## Findings

| # | Finding | Evidence | Severity | What a correct output would be |
|---|---|---|---|---|
| **C-1** | **The weekly loop has still never run by itself.** Six of the ten schedules have no trigger-mode execution since 2026-10-01; since the 2026-10-16 deploy no workflow fired on its own (Page Watch 2026-10-16 15:15 was the last, 5 h 30 min late). The two daily fires due on 2026-10-17 were missed while the Mac slept and were replayed 4 h 40 min / 5 h 24 min late by the catch-up at a deploy restart; the 2026-10-16 pulse 7 h 58 min late. The catch-up replays only fires due in the last 36 h, so the five Monday 2026-10-12 runs stay lost, and its own sweep 728 was cancelled by its 900-s limit after the VM paused mid-node. | `C-schedule-executions.json`; `catchup:*` rows (`C-catchup-records-end.json`); 728 *Catch-up Entry* 2,643,925 ms, `TimeoutExecutionCancelledError`; `pmset -g log` 14:35:11 / 15:19:23 PKT; 678, 734, 735 | **High** | Each fire on time on a host that does not sleep; the catch-up's timeout not counting suspended time; a missed Monday run replayed (or the customer told it was skipped). |
| **C-2** | **Rivals still become pitch targets.** AI Growth tells the customer *"Ask the editor of flick.network to add Tech& to this list"* while the AI visibility run 10 minutes earlier lists flick.network among "businesses AI recommends instead of you" and the Link Builder refuses it as a competing site (#1 for "e invoicing in uae"). AI visibility labels erp-dubai.ae (Elate ERP), halsimplify.com (HAL ERP) and penieltech.com ("IT company in Dubai", Odoo implementer) "site (PR target)" and writes them as `ai_source` prospects. | 783 *Growth Report* earned row; 776 `rival_sources`, *AI Prospect Rows* (10); 781 flick.network `not_fit`; titles fetched 2026-10-17 | Medium | The rival list applied to AI Growth's earned media and to the "PR target" label; a vendor selling the same services is not a PR target. |
| **C-3** | **Earned-media citation counts do not match their lineage.** AI Growth prints the FTA page "79x" and two different MoF pages "93x" each and says the source is "the answers of the last weekly AI-visibility run"; that run (776) counted mof.gov.ae 18 and tax.gov.ae 14 citations. 93 is a per-host total printed per page, over a longer window than stated. | 783 *Growth Plan* `earned[*].citations` (two mof.gov.ae URLs, 93 each); 783 report lineage row; 776 report "Sources AI relies on" | Medium | Per-page counts from the stated run, or the window and host aggregation stated. |
| **C-4** | **Page movement is measured against a single outlier reading.** "e invoicing in uae: the whole results page moved: 9 of the top 9 places changed since the reading of 2026-10-16, 9 new pages came in" — today's top ten equals the readings of 2026-10-15 19:48 and 2026-10-16 00:33 exactly; the reading compared against (2026-10-16 19:58, exec 715, identical request) was a different page. Labels mix "high" and an unexplained "noise" (erp implementation dubai "8 of top 8 changed (noise)"). | 785 report 1 line 19; `seo_rank_history` rows (`C-rankhist-einv.json`); 715 / 785 *Tracker Plan* request bodies | Medium | Movement judged against more than one prior reading (or an outlier flagged), every label defined in the report. |
| **C-5** | **The audit diff reports a "fixed" finding that is a change of crawl method.** Audit 794 (`crawl_js: false`) against executor B's 739 of 48 minutes earlier (`crawl_js: true`): *"1 fixed … AI crawlers see a different version of 20 key page(s)"*. `seo_audits` has no `crawl_js` column; the diff's `crawl_js` and `basis` are `null`. | `C-audit-794-diff.json`; app report `793419f7-…` summary `scoreDelta 0`; `B-audit-739-diff.json` | Medium | Audits with different crawl methods compared only on the checks both ran; the JS-only finding "not compared", not "fixed". |
| **C-6** | **A search for another website is recommended as a quick win.** "techandkey com" (411 impressions; techandkey.com is "TechAndKey - Latest Tech News", fetched) is listed as a striking-distance quick win, a low-CTR "rewrite titles" item for /whywith-techand, and a cannibalisation pair. | 787 report "Quick wins", "Low click-through", "Searches two of your pages compete for"; *Parse GSC* `brand_split.non_brand.top[0]` | Medium | Navigational searches for other sites set aside (like the scraper query) and kept out of quick wins and cannibalisation. |
| **C-7** | **Two reports of the same 3 minutes give contradictory next steps.** "ai consulting": Rank Tracker *"…/ai-copilot-advisory-uae already answers this search — refresh that page, do not publish a second one"*; Site Tracker *"Fix the four drafts that failed the quality check and run them again … ai consulting …"*. "it consulting dubai": Rank Tracker *"write the main page"*; Site Tracker and Cadence: written today, failed QA, fix and run again. | 785 reports 7 and 8 "Next step"; 787 "Do this week"; 791 *Cadence Plan* reason; `A-content-log-after.json` (both `not_ready`) | Medium | One page state per keyword read by every report (written-not-ready → "fix the draft"; or, if an existing page answers, the draft retired). |
| **C-8** | **The link pipeline still qualifies businesses that sell the same services.** The new services-overlap rule refused tronstride.com, mabbaz.com and creuto.com, but erp-dubai.ae ("ERPNext Implementation Partner in UAE & Dubai", fit 0.84), penieltech.com ("Odoo Implementation …"), pactsoft.ae (named by the AI run as an alternative for "ERP implementation partner in Dubai"), halsimplify.com (HAL ERP) and tradeshift.com were qualified `needs_contact`; complyance.io `ready` (the writer declined it). | 781 *LB Assemble* `outreach_rows` (statuses, `checks_json.reasons: []`); pages fetched | Medium | The overlap rule applied to implementation partners and e-invoicing vendors whatever words their page uses. |
| **C-9** | **The AI visibility comparison names an engine that returned nothing last time, and the period label is wrong.** `delta_basis` lists Gemini, but run 722 had Gemini `answered 0, errors 8` (54 answers now vs 28 before, not the same engine set). The lineage says "the 7 days to 2026-10-17" while the pulse rows counted are only those since the previous run (2026-10-16 20:11): 1 pulse day. No number is wrong today (all 0%). | 776 `metrics.delta_basis`, `previous.engines.gemini`, `pulse_basis {days 1}`; `AI_Plan.js:72` (`since = prev.checked_at`), `AI_Report.js:124` | Low | The basis lists only engines that answered on both sides (or refuses the delta); the period printed is the one counted. |
| **C-10** | **Backlink prospects all point at one unrelated page, and one is off topic.** All 8 prospects (four e-invoicing lists included) carry `target_url /dynamics-365-crm-uae`; marketguest.com ("Questions Before Buying Property in Malaysia") saved as a `comp_new` prospect, score 35 (the Link Builder refused it minutes later, "off topic (0% match)"); gulfnews.com refused as "neither its name, its page nor its country ties it" (a UAE paper); uae-asp.ae has no note. | 777 *Prospect Rows*, `BL Plan.assets`, report "Link gap"; 781 marketguest.com `not_fit` | Low | Each prospect matched to the site's page on its topic; the off-topic filter applied before saving. |
| **C-11** | **A dry run is stored as a normal, deliverable report.** AI Growth's dry run lands in the app as `ai_growth`, `status progress`, subject **"[AI growth] techand.ai — done for you this week"**; the payload has `dry_run: true`, but the app's delivery rule has no dry-run hold. The dry-run branch itself was not exercised (nothing to submit). | report `6feb9b2e-…`; `C-growth-783-report.json` `dry_run: true`; `app/shared/src/report-delivery.ts` (no "dry") | Low | A dry run marked as a test in the subject and held from delivery. |
| **C-12** | **"facts erp" (facts.ae's brand) is still listed as a rung.** The Rank Tracker report of erp software uae lists "facts erp (not published yet …)" while facts.ae is #3 for the head; the Site Tracker marks the same rung `set_aside`. | 785 report 3 line 96; 787 index table "/facts-erp/ 2 set_aside" | Low | Set aside in every report once set aside in one. |
| **C-13** | **peppol uae: the ranking page and the "main page" differ, without comment.** #46 is the PINT-AE integration guide; the next step calls `/insights/top-peppol-…` "the page the site already has for this search". | 785 report 2 | Low | The report names the page Google ranks, or flags the split. |
| **C-14** | The on-demand pulse with 0 alerts is titled **"AI pulse alert · techand.ai"** (as on 2026-10-15). | app report `bd663b74-…` | Low | "AI pulse · techand.ai" when there is no alert. |
| **C-15** | Duplicates and a wrong status in the site report: two not-indexed pages each listed twice under Alerts; two pages twice in the index-status table; `/dynamics-365-crm-uae` shown "planned" while "Submitted and indexed". | 787 report "Alerts", "Your pages: index status" | Low | One row per page; a live, indexed page shown as live. |
| **C-16** | **The Search Console mail watcher drops and may not come back.** Its IMAP trigger was deactivated four times in 22 hours (2026-10-16 20:47; 2026-10-17 12:22, 12:53, 18:31); each reactivation attempt is logged as failed (`ENOTFOUND imap.gmail.com`) and no later success is logged, while the API reports the workflow `active: true`. The alerts for three of the four drops failed on both channels at the time (no network on wake) and were delivered later by retries. | Error Handler 723, 730, 731, 797; `docker logs --timestamps` 12:53:47, 12:54:09, 18:31:42; `seo_ops_alerts` row 4 log | Medium | The watcher's real state checked (not the workflow flag) and a failed reactivation retried and alerted. |

## What could not be exercised, and why

- **AI Growth's dry-run branch and any Bing / IndexNow submission** — nothing was due for submission (`submit: []`, every page crawled;
  IndexNow key file not hosted); the gates were read in the live workflow and the submit nodes did not run.
- **Corrections for wrong AI claims and the AI fact check** — no business profile on file (`fact_check` not run, `corrections: []`).
- **Per-engine change tests** — the previous run had 7 answers per engine, under the 12-sample minimum; none could be computed.
- **A weekly schedule firing by itself** — no Monday has passed since the 2026-10-16 deploy (read-only §12).
- **Link Builder sending, replies, follow-ups** — no mailbox connected, deliberately.
- **Delivery of a report out of the app** — the company has no delivery settings; `report_deliveries` is empty.
- **The Backlink Monitor's light weekly watch and a real lost link** — on-demand full run only; nothing lost.
- **Page Watch "I fixed this" re-check** — no finding requested one.
- **The read API / MCP and the stand-alone publish check** — other executors' areas.

## State left behind

- Test Runner **inactive** (my deactivation 20:35:24 UTC, `active: false` confirmed). Nothing else activated or deactivated.
- `seo_run_ledger` rows **153–165**, all `done`, none `reserved`.
- `seo_ops_alerts`: row 5 second sighting (delivered), row 4 attempt 6 (delivered). The owner's Slack received the test alert once and the
  IMAP alert's retry once; the ops mailbox the test alert once.
- `seo_ai_answers` +47 (776) +21 (779); `seo_ai_visibility` +1; `seo_ai_daily` row 11 (on-demand, apart from the scheduled row 10);
  `seo_ai_growth` +1 (row 10, the dry run, `submitted 0`); `seo_ai_pages` / `seo_ai_targets` upserted (22 / 7 rows now).
- `seo_link_prospects` 178 → 186 (upserts by 776, 777, 781); `seo_link_outreach` 179 → 206 rows (781 wrote 48: 38 `not_fit`, 8
  `needs_contact`, 2 `needs_edit`; alaan.com's older row updated) — **no e-mail sent**; `seo_backlinks` upserted (22),
  `seo_backlink_snapshots` +1 (full); `seo_listings`, `seo_link_impact` upserted.
- `seo_rank_history` +12; `seo_query_history`, `seo_site_metrics`, `seo_pages`, `seo_page_watch` upserted; `seo_cache` sitemap fingerprint
  refreshed; `seo_audits` +1 (`site_audit`, 85) with its findings.
- App `reports`: 18 rows (§ Runs). No page written, no ladder created, no content-log row, nothing published, no Bing / IndexNow
  submission, no e-mail to a third party.

## Artefacts (`files/`, git-ignored)

| File | What it is |
|---|---|
| `C-aivis-776-report.txt` / `.json`, `C-aivis-776-metrics.json` | AI visibility report and metrics (Holm, tests, prospects, rivals) |
| `C-bl-777-report.txt` / `.json` | backlink report |
| `C-pulse-779-report.txt`, `C-pulse-779-metrics.json` | the pulse |
| `C-link-outreach-before.json`, `C-lb-781-report.txt` / `.json` | outreach rows before the run; the Link Builder's week |
| `C-ai-growth-before.json`, `C-ai-pages-before.json`, `C-ai-targets-before.json`, `C-growth-783-report.txt` / `.json` | AI Growth before / report |
| `C-rank-785-reports.txt` / `.json`, `C-rankhist-einv.json` | the 9 rank reports; stored readings of "e invoicing in uae" |
| `C-site-787-report.txt` / `.json` | the site report |
| `C-watch-789-compare.json`, `C-cadence-791-plan.json` | Page Watch; cadence dry-run plan |
| `C-exec-794-nodes.txt`, `C-audit-794-diff.json`, `report-793419f7-….json` | the audit and its diff |
| `C-ops-alerts-before.json`, `C-ops-alerts-before-errpath.json`, `C-ops-alerts-after-errpath.json` | alert table snapshots |
| `C-schedule-executions.json`, `C-catchup-records.json`, `C-catchup-records-end.json` | schedule record and catch-up state |
| `C-run-ledger-window.json` | ledger rows 153–165 |
| `exec-723.json`, `exec-728.json` … `exec-731.json`, `exec-773.json`, `exec-776/777/779/781/783/785/787/789/791/793/794.json`, `exec-797/798/799.json` | executions (toolkit) |
| `spend.jsonl`, `starts.jsonl` | balance probes "C …"; every start of this wave |
