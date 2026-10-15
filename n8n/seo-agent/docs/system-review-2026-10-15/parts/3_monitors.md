# Part 3 — the monitor wave (executor C), 2026-10-15

What ran: AI visibility (`ai_visibility`), backlinks (full, then a second attempt), the Link Builder (paid, on demand), the AI Pulse,
the Rank Tracker, the Site Tracker, Page Watch, the Content Cadence dry run, the Audit Scheduler (and the technical audit it started),
and one deliberate failure into the alert channel. Read-only: AI Growth (not run, see §11), the schedule history of the ten scheduled
workflows (§12), the alert record (§10). Every analysis was started the way the app starts it (API front door with
`X-Forwarded-For: app:<techand.ai company>` and the company callback) or through the Test Runner for the monitors.

| | |
|---|---|
| First call / last call | 19:29:03 UTC (balance) → 20:00:33 UTC (balance) |
| Executions created | **619–643** (25), every one `success` except **642**, the deliberate failure |
| Test Runner (`SEOagentTestRun1`) | activated **2026-10-15T19:29:17Z**, deactivated **2026-10-15T20:00:26Z**, `active: false` confirmed through the API |
| DataForSEO balance | **$12.735491** (19:29:03, `today_total` 1.056488) → **$11.259354** (20:00:33, `today_total` 2.532625): **$1.476137** for this wave |
| Claude (n8n-reported token counts, list prices) | **$0.1711** measured over 6 calls (exec 623 $0.1033, 628 $0.0326, 634 $0.0352); no estimate-only call |
| In flight at once | never more than 2 of my runs; no ledger row of the day was `reserved` before any start |

Artefacts are in the main repo's git-ignored `n8n/seo-agent/docs/system-review-2026-10-15/files/`, all prefixed `C-` (list at the end).

## Runs

DataForSEO "account" = the balance movement between two probes with nothing else running; "engine" = the run's own figure and its
`seo_run_ledger` row. Claude = `RR claude` (n8n `tokenUsage`, measured) against the engine's own Claude figure.

| # | What | Request id | Executions | Start–end UTC | Duration | DataForSEO: account · engine (ledger row: `dfs_usd` / status) | Claude: measured · engine | Status |
|---|---|---|---|---|---|---|---|---|
| — | balance before | — | — | 19:29:03 | — | $12.735491 | — | — |
| 0 | Test Runner on | — | — | 19:29:17 | — | — | — | active |
| 1a | `ai_visibility` (topics `[]`, competitors cleartax.com, azentio.com) | 619 | 619 → 620 → **623** | 19:29:23–19:35:31 | 6 min 08 s | $0.7814 · $0.7794 measured (row 93: 0.7794 / done) — plus row 90 for the front door: **$0.95 "ESTIMATED" / done** | $0.1033 · $0.0678 | completed, delivered |
| 1b | `backlinks` full | 621 | 621 → 622 → **624** | 19:29:25–19:34:58 | 5 min 33 s | $0 · $0 (row 92: 0 / **refused**) — plus row 91 for the front door: **$0.50 "ESTIMATED" / done** | 0 · 0 | **refused by the engine** — see §2 |
| 1b' | Backlink Monitor again, through the Test Runner, same body the front door forwards | rr1015-bl-retry | 625 → **626** | 19:40:40–19:41:29 | 49 s | $0.3726 · $0.3725 measured (row 94 / done) | 0 · 0 | completed, delivered |
| 2a | Link Builder, paid, on demand | rr1015-lb-paid | 627 → **628** | 19:42:54–19:44:17 | 1 min 23 s | ≈$0.0498 (by difference) · $0.05 "ESTIMATED" (row 96 / done) | $0.0326 · $0.0177 | delivered with PDF |
| 2b | AI Pulse | rr1015-pulse | 629 → **630** | 19:42:55–19:43:46 | 50 s | $0.084 · $0.084 measured (row 95 / done) | 0 · $0.004 "ESTIMATED" | delivered |
| 3a | Rank Tracker | rr1015-rank | 631 → **632** | 19:48:29–19:48:49 | 20 s | $0.12 · $0.12 measured (row 97 / done) | 0 · 0 | 8 reports |
| 3b | Site Tracker (`on_demand`) | rr1015-site | 633 → **634** | 19:48:31–19:49:31 | 61 s | ≈$0.031 (by difference) · $0.01 "ESTIMATED" (row 98 / done) | $0.0352 · $0.03 "ESTIMATED" | delivered |
| 4a | Page Watch | rr1015-watch | 635 → **636** | 19:52:35–19:52:42 | 7 s | $0 · $0 (row 99 / done) | 0 · 0 | no change, no callback |
| 4b | Content Cadence **dry run** | rr1015-cadence-dry | 637 → **638** | 19:52:36–19:52:39 | 3 s | $0 · $0 (row 100 / done) | 0 · 0 | paused on the pile-up guard, wrote nothing |
| 5 | Audit Scheduler on demand → technical audit | rr1015-auditsched | 639 → **640** → **641** | 19:53:26–19:58:50 | 5 min 24 s | $0.0374 · $0.0265 (row 101: 0 / done; row 102: 0.0265 "partly estimated" / done) | 0 · 0 | delivered, health 83 |
| 6 | Error path: Test Runner with a workflow id that does not exist | rr1015-errpath | **642** (error) → **643** (Error Handler) | 19:59:48–19:59:54 | 6 s | $0 | 0 | alert delivered by Slack webhook (HTTP 200) and e-mail (SMTP 250) |
| 7 | Test Runner off | — | — | 20:00:26 | — | — | — | inactive |
| — | balance after | — | — | 20:00:33 | — | $11.259354 | — | — |

Per-window account movement: 19:29:03→19:35:57 **$0.781387** (only 623 spent); →19:42:38 **$0.372636** (626); →19:44:39
**$0.133764** (628 + 630); →19:52:21 **$0.151000** (632 + 634); →19:53:20 **$0** (636, 638); →19:59:00 **$0.037350** (641);
→20:00:33 $0. The ledger rows of this wave add up to **$2.8924**; without the two front-door rows (90, 91) they add up to $1.4424
against $1.4761 that the account moved (finding C-5).

16 reports reached the app's `reports` table for the company (19:29:40–19:58:46): `ai_visibility_started`, `backlinks_started`,
`ai_visibility`, `backlinks` (the second attempt), `ai_pulse`, `link_builder`, `rank_tracker` ×8, `site_tracker`, `site_audit`.
The cadence dry run and Page Watch send no callback by design (dry run; nothing changed). The runs were started against n8n
directly, so the app's `runs` table has no row for them; only the `reports` rows show what the customer would receive.

---

## 1. AI visibility (run 1a, executions 619 → 620 → 623)

**What was asked.** `{"mode":"ai_visibility","keyword":"","topics":[],"competitors":["cleartax.com","azentio.com"]}` plus the
app's head fields (country United Arab Emirates, domain techand.ai, empty e-mail, company callback) — the same body the 2026-10-14
run sent (exec 556), so the two runs are like for like. The front door answered 202 in 1.45 s, `estimated_minutes: 10`.

**What came back** (`files/C-aivis-623-report.txt`, `C-aivis-623-metrics.json`; *AI Plan*, *AI Metrics*, *AI Report* of 623).

- Panel: 8 questions (7 buyer questions by stage — decision 3, awareness 2, consideration 2 — plus the brand question "What is
  techand.ai and what e-invoicing and ERP services does it offer in the UAE?"), stored panel `prompts_max: 8`, no question set aside.
- Engines asked: ChatGPT, Perplexity, Gemini, Claude, Google AI Overview, Google AI Mode (6). An on-demand run is always the "full"
  run (`full_due = on_demand || …`, `v5/code/AI_Plan.js:59`), so Claude and the brand question were asked again, as on 2026-10-14;
  the monthly reuse of Claude is a scheduled-run path and was not exercised.
- Requests: **47**, **1 failed** (Google AI Overview, "Internal SE Server Error.", on the Peppol question), **1 retried, 0 answered**
  on the retry; one more AI Overview request came back with no AI answer. The report's second line says so:
  *"1 of 47 requests failed this run (2.1%), 0 of 1 answered when they were sent again: Google AI Overview — Internal SE Server
  Error.. The rates below count the 33 answers that came back."*
- Two DataForSEO side requests also failed: the LLM-mentions discovery for "erp software uae" (status 50000 "Internal Error" after
  20 s, answered on the retry) and the AI keyword-volume lookup (50000 after 50 s, and again after 50 s on the retry). *Run
  Discovery* took 157 s and the retry 51 s, which is most of the 6-minute run (2.1 minutes on 2026-10-14).
- Headline: *"Tech& was named in 0% of 74 AI answers this week (95% range 0–4.9%), even though all 5 engines asked know the
  brand."* — 74 = 33 answers of this run on the weekly engines + 41 AI Pulse answers (2026-10-14 exec 568 and 2026-10-15 exec 593,
  ChatGPT / Gemini / AI Mode). Pages cited 0% (0–4.9%), share of voice 0% of 193 mentions (0–2%), visibility score 0 (±0, modelled),
  sentiment +60 (3 positive, 2 neutral, 0 negative), brand recognised by 5 of 5 assistants, AI Overview shown on 71.4% of the
  searches and citing the site in 0%. I recomputed the Wilson upper bounds: 0/74 → 4.93%, 0/193 → 1.95%, 0/12 → 24.25%,
  0/11 → 25.9%, 5/5 lower bound 56.6% — all as printed.
- Comparison: *"compared with 2026-10-14 (8 questions on Google AI Mode, Google AI Overview, ChatGPT, Gemini, Perplexity)"*, every
  delta z = 0 "within sampling noise (… 74 answers now, 74 before)"; `delta_not_compared: ""`, `panel 8 / panel_before 8`. The
  engine set compared is stated and identical on both sides; Claude is left out of the rates on purpose
  (`AI_Metrics.js:46`, "headline figures use the weekly engines (Claude, monthly, appears per engine)").
- Who AI names instead: tallysolutions.com 36 answers (18.7%), zoho.com 32 and oracle.com 32 (16.6% each), microsoft.com 29 (15%),
  cleartax.com 22 (11.4%, "your competitor"), odoo.com 21, sap.com 19, azentio.com 2.
- Market-wide (DataForSEO AI-answer database): microsoft.com 1,897 answers (39.2%) … techand.ai 0. *"Left out of this table:
  "Tech&" (19,579 answers) — "Tech&" is too short a name (4 characters) to match on its own: the index counts it inside other
  companies' names."*
- Brand matching: I searched every answer text of the run for "tech&", "techand" and "tech and": 13 hits, all inside the
  brand-question answers of ChatGPT (5), Gemini (5) and Claude (3) and all about techand.ai; none in a buyer answer, so no other
  company was counted as Tech& in the rates.
- Cited URLs (all from the brand question): `/` 4 (ChatGPT, Gemini, Perplexity, Claude), `/whatwedo` 2, and 1 each for eight
  service / insight pages. The fan-out searches the engines ran are listed per question (10 shown).
- Fact check: *"What AI gets wrong: not checked … nothing on file can judge what the answers claim — fill the business profile
  (city, address, phone, price range) and the next run checks every answer against it. Your country and the services read off your
  website are context, not facts to check a claim against."* (`fact_check: "no_facts"`).
- Crawler access: robots.txt and llms.txt found; 8 of 8 answer bots allowed by robots.txt; the homepage fetch test ran for 4 of them
  (200 each) and "—" for the other 4. I fetched both files: robots.txt 200 (`Allow: /`, three `Disallow`s), llms.txt 200, 10,665
  bytes.
- GA4: 0 AI-assistant visits, 0 key events in 28 days.
- "Do this next" (Claude *AI Brief*, from the computed data): fill the business profile; answer the accredited-provider question;
  write requirement / penalty / Peppol / cost pages; *"Pitch a guest article or comparison mention to wafeq.com, edicomgroup.com and
  aiverix.ae — They are cited 15, 12 and 9 times on your topics"*; get listed on mof.gov.ae / tax.gov.ae "if you qualify"; build an
  "ERP implementation partner in Dubai with e-invoicing" page. Three ready API bodies are printed.
- Side effect: *AI Prospect Rows* upserted 10 `ai_source` prospects (all ten already in the table from earlier runs): mof.gov.ae and
  tax.gov.ae (score 100), wafeq.com, edicomgroup.com
  (100), aiverix.ae, comarch.com (100), flick.network (90), velmontcrest.ae (100), pagero.com (100), europe.thomsonreuters.com (100).

**What the customer sees.** `ai_visibility_started` at 19:29:40 ("about 8 buyer questions are asked to ChatGPT, Perplexity, Gemini,
Claude and Google AI Mode…") and `ai_visibility` at 19:35:29, title "AI visibility report · techand.ai", subject *"[AI visibility]
techand.ai — named in 0% of AI answers · 0 AI visits · 1 alert(s)"*, summary `{questions 8, aiSessions 0, mentionRate 0,
citationRate 0, shareOfVoice 0, visibilityScore 0}` (`files/report-f18ed579-….json`).

**Where it is right.** Every rate carries its sample and a 95% range and the arithmetic checks out; the comparison names its engine
set and panel and refuses nothing it should have compared; the failed request is reported with its engine and reason and the rates
say they count answered requests only; the fact check says plainly that it did not run and why; the 4-character name is kept out of
the market table with the reason; no brand false positive in the answers.

**Where it is wrong.** C-7 (the "pitch" recommendation targets businesses the same report counts as rivals, and eight such domains
are written as link prospects), C-8 (the headline denominators are described wrongly; AI Overview presence counts the failed request as "no
AI Overview"), C-9 (the failed AI-volume lookup is not disclosed), C-4 (Claude cost).

**Gap to the leader** (criteria 4A). Profound asks 100 prompts × 3 engines daily and Semrush 25 prompts daily; this panel is 7 buyer
questions, weekly on 6 engines plus a daily pulse on 3. The accuracy check, which the criteria call mandatory, did not run (no
profile). Copilot is not in the engine set. Revenue per assistant is wired (GA4) but the site has no AI visits to show it.

**Cost.** DataForSEO $0.7794 measured by the run; the account moved $0.7814 between its reservation and its settlement and nothing
else spent in that window (the cost basis nevertheless says 4 other runs were in flight — C-5). Claude: n8n reports 4 Sonnet 5.5
calls, 29,064 in / 4,517 out = **$0.1033**; the engine settled **$0.0678** "measured" (C-4). The front door also wrote ledger row 90
with $0.95 "ESTIMATED" for the same request (C-5).

## 2. Backlinks (run 1b: executions 621 → 622 → 624; second attempt 625 → 626)

**What was asked.** `{"mode":"backlinks","keyword":"","competitors":["cleartax.com","azentio.com"]}` (no `free_only`), the
same body as 2026-10-14 exec 558. 202 in 0.85 s, `estimated_minutes: 5`.

**What came back the first time: the run refused itself.** The main workflow (622) reserved ledger row 91 (`mode: backlinks`,
`status: reserved`) and started the Backlink Monitor (624) without waiting. 624's gate read the open ledger rows at 19:29:38.39,
found row 91 still `reserved`, and refused (*After Run Ledger (BL)*):

> *"The previous backlinks run (execution 622, started 19:29 UTC) is still going. Nothing was charged and nothing was started: this
> run would have read the same data and written the same rows twice. [1 other run(s) in flight (backlinks 19:29); the limit is 3]"*
> — `reason: "same_mode"`.

Execution 622 *is* this request's own front-door run: it started the monitor at 19:29:36.366 and only began writing its own row
`done` at 19:29:38.472 (*Settle Run Ledger*, row 91 `updatedAt` 19:29:38.862) — 81 ms after 624 had read the ledger (19:29:38.391).
The AI visibility request passed the same gate only because its front-door row 90 was already written `done` (19:29:37.850) when 623
read the ledger (19:29:38.471). It is a race of under a second (`v5/code/_run_guard.js`, rule 1 "the same monitor is still running",
compares `mode` only). Row 92 was written `refused` and row 91 was settled `done` with $0.50. No callback followed: the company received `backlinks_started` (19:29:41, *"Your backlink check for
techand.ai has started…"*) and nothing else for request 621. The refused run still took 5 min 33 s, 315 s of it inside *DFS Balance
End (BL)* — a free balance read that DataForSEO itself timed at 0.07 s. (C-1, C-20)

**Second attempt** (my decision, to exercise the area: the Backlink Monitor started through the Test Runner with exactly the body the
front door forwards — `on_demand`, competitors, country, location 2784, `free_only: false`; nothing else was in flight). Execution 626,
49 s, `mode: full` ("monthly report · on-demand run", changes since 2026-10-14). `files/C-bl-626-report.txt`, `C-bl-626-report.json`.

- Sources merged (*Link Merge*): DataForSEO index 1 referring site (only-this-source 1), Bing Webmaster "connected; Bing reports no
  links to this site yet", Google Search Console upload 1 ("export of 2026-10-14", only-this-source 1), GA4 referrals 1 ("not links:
  teams.public.onecdn.static.microsoft"), Common Crawl 1 (release cc-main-2026-jul-aug-sep); union **3** referring sites, social 2.
  *"Of the 1 sites in Google's own sample (Search Console), DataForSEO sees 0%; at least one other source confirms 0%."*
- Own check: *"Of the 19 referring pages we could read, 3 still carry the link (16%), and of the 17 the DataForSEO index reports
  live, 1 are live (6%)."* 19 pages fetched this run, 0 unread.
- Link farms: **17 set aside** ("the same page path on 16 sites (/all/2835/13.html)" or "labelled spam by the Link Analyst"), named,
  "no value, on the disavow candidates for review … Google ignores them unless you get a manual action". No spam alert
  (`spammy: []`); the index's spam score is shown as "63/100 reported by DataForSEO over 19 links".
- Lost: none, "every linked page works"; `important_lost: []`, `at_risk: []`.
- Best links: peppol.org 35 / 25 / 44 (profile, content, authority 594 · DR 77, "✓ on the page"); tracxn.com 21 / 0 / 43 (nofollow,
  540 · DR 79). Same two as 2026-10-14.
- Anchor block: *"web address 50% · image / empty 50% — over 2 referring site(s), with 1 link-farm site(s) left out of both the
  percentages and the table below"* — and the table below lists exactly two rows, both farm anchors: "High Quality Dofollow Backlinks DA
  50 PA 40 Premium PBN Network Service techand." (17 referring domains) and "techand.ai" (1), each marked "link farm, set aside". (C-16)
- "Sites that just linked to a competitor": enterpriseam.com and holod.media (a Russian-language article about moving to Malaysia),
  both → cleartax.com.
- "Best of" lists (8): by their titles, five are competitors' own pages, not lists — "Best Dynamics 365 Business Central Partner in UAE
  – … TMR Consulting", "Microsoft Dynamics 365 Partner in UAE, ERP & CRM Solutions - LITS SERVICES", "Contact Best Microsoft Dynamics
  365 Partner in the UAE | SQIT", "Microsoft Dynamics 365 Partner in Dubai, UAE | QZ Infomatics", "Microsoft Dynamics 365 Solutions &
  Implementations Partner" (iaxdynamics.com home page). One of them was saved as a prospect: qzinfomatics.com, type `list`, score 33,
  detail *"'Microsoft Dynamics 365 Partner in Dubai, UAE | QZ Infomatics' lists cleartax.com, not you"*. I fetched that page: it does
  name ClearTax (in a list of platforms it integrates), and its title is QZ Infomatics' own Dynamics 365 partner page. (C-10)
- Link gap (20 rows): mof.gov.ae *"not pitched: a government site: you get on its lists by applying or being accredited"*; 18 rows
  *"not pitched: off topic for you"* (lounge.ai, stripe.com, weforum.org, gulfnews.com …); one row, uae-asp.ae (authority 25), has no
  note and was saved as a `gap` prospect (score 28).
- Prospects saved by this run: qzinfomatics.com (list 33), azdan.com (list 35, its "Top 20 UAE E-Invoicing ASP" page), enterpriseam.com
  (comp_new 47), holod.media (comp_new 40), uae-asp.ae (gap 28), nationalbonds.ae (gap 33). Pipeline: "new 156 · contacted 0 · won 0".
- Outreach drafts: "No new drafts this month" (the Link Builder is on for the site, so this monitor does not draft). The Link Analyst
  (Claude) did not run.

**What the customer sees.** For request 621: only `backlinks_started`. For the second attempt: `backlinks` at 19:41:27, "Backlink
report · techand.ai", summary `{lost 0, spammy 0, backlinks 19, prospects 60, importantLost 0, referringDomains 3}`, payload with the
PDF (`pdf_ready`).

**Where it is right.** The merge, the farm set-aside, "lost" only after our own fetch, the Google-sample coverage line, the
government gap row refused with its reason, the off-topic gap rows refused, the lineage table — all as on 2026-10-14, on real data.

**Where it is wrong.** C-1 (the customer's request refused by its own parent row, and never told), C-20 (5 minutes to refuse),
C-10 (competitors' pages read as "best of" lists and saved as prospects), C-16 (anchor block).

**Gap to the leader** (4B). Ahrefs reports 35T records and 8 lost reasons; this site's whole picture is 3 referring sites, and the
largest index here (DataForSEO) saw 0% of Google's own sample — the merge is what makes the result usable. Unlinked mentions found
none. Mentions are not tied to the AI-visibility figures in this report.

**Cost.** 626: $0.3725 measured; the account moved $0.372636 in that window. 624: $0. Claude: none. Front-door row 91 settled
$0.50 "ESTIMATED" for a request that spent nothing (C-5).

## 3. Link Builder (run 2a, executions 627 → 628)

**What was asked.** `POST /webhook/seo-link-builder` `{"domain":"techand.ai","request_id":"rr1015-lb-paid"}` + company callback;
202 `link_builder_started`.

**What came back** (`files/C-lb-628-report.txt`, `C-lb-628-report.json`, **`C-lb-628.pdf`** — 6 pages, 111,589 bytes, rendered
in-run; the PDF's text could not be extracted on this machine, its source sections are the same as the HTML).

- *LB Assemble* summary: `qualified 7` (`ready 5`, `needs_contact 2`), `not_fit 22`, `to_draft 10`, podcasts read 5 (all not fit),
  journalist requests 0, redirects 0, listings missing 2 / linked 1, impact reads 0, asset ideas 0.
- Not-fit reasons, for example: wafeq.com *"a competing site of yours (wafeq.com): a site that outranks you for one of your own
  keywords (#1 for "e invoicing software uae"), and a competitor does not link to your page"*; the same rule refused flick.network,
  hlbhamt.com, rvguae.com, taxilla.com and thomsonreuters.com; mof.gov.ae and tax.gov.ae refused (government); zoominfo.com,
  outlook.com safelinks refused.
- Qualified, with our page and link text: goroute.ai (fit 0.56 → `/dynamics-365-cloud-migration-uae`, link text = page title),
  **qzinfomatics.com (fit 0.87 → `/whywith-techand`, title)**, **daxin-global.ae (0.84 → home page, brand)**, nrdoshi.ae (0.33 →
  the "PDF invoices will be illegal" insight, title), lumeafinance.com (broken link, 0.20 → `/insights`, title); needs contact:
  edicomgroup.com (contact form), sharedserviceslink.com (none).
- Contacts: every contact found is on the prospect's own domain (goroute.ai, qzinfomatics.com, daxin-global.ae, nrdoshi.ae,
  lumeafinance.com).
- Writer (Claude *Outreach Sequence Writer*): 10 jobs, **4 drafted, 6 declined** with reasons — qzinfomatics.com *"Their page names
  cleartax.com, a competitor, and the offered page ('techandkey com') does not fit the topic; weak evidence"*, goroute.ai *"an access
  point provider page, effectively a provider's own commercial page"*, lumeafinance.com, lumitech.co, dptc.ae, aiverix.ae. The
  declined rows were written back `not_fit` with `writer: …` reasons.
- Draft gate: all 4 drafts held — daxin-global.ae *"needs you: [Owner: confirm — one-line description of our e-invoicing work.]; needs
  you: [Your name]"*, nrdoshi.ae, invoiceuae.ae, trustbill.ae *"needs you: [Your name]"*. Each draft is a first e-mail plus follow-ups
  at 4 and 8 days, one link, one ask, and a quote from the prospect's page. **I fetched the four pages and found every quoted line**:
  daxin-global.ae ("Before comparing vendors, it helps to be clear on what "compliant" means in practice."), nrdoshi.ae ("Unlike PDF
  invoices, structured electronic invoices can be validated automatically, integrated with ERP systems…"), invoiceuae.ae ("…it's a
  chain of three separate costs, from three separate parties…"), trustbill.ae (title "UAE E-Invoicing Penalties 2027: AED 5,000/mo +
  AED 100/Invoice").
- Who the four are (from their own pages): daxin-global.ae's home page lists "Odoo ERP, Microsoft Dynamics 365, Microsoft Business
  Central, e-invoicing, custom ERP development, AI & process automation" (C-10); invoiceuae.ae and trustbill.ae sell e-invoicing
  software (trustbill.ae's menu: "E-invoicing · Accounting + ERP Integrations · Pricing"); nrdoshi.ae is an accounting / audit firm.
- Listings checklist (16): not listed — "UAE Ministry of Finance — accredited e-invoicing providers" (with the accreditation
  requirements spelled out: "Peppol-certified provider for 2 years, ISO 27001 + 22301, insurance — or appear through your accredited
  partner") and "OpenPeppol certified service providers"; linked — LinkedIn; listed, no link seen — SaaSHub, AlternativeTo; **11 "Not
  checked (the site blocks checks)"** (G2, Capterra, TrustRadius, YouTube, Crunchbase, GoodFirms, AppSource, Product Hunt, Trustpilot,
  Yellow Pages UAE, Dubai Chambers).
- Impact: peppol.org "Too early to tell — read at 6, 10 and 16 weeks after the link went live" (1 week); tracxn.com "Can't tell — the
  page had no search impressions before or after the link" (6 weeks). Control group = "the site's other pages over the same weeks".
- The report states the five checks every pitch passes and that nothing is sent without approval from the customer's own mailbox.

**What the customer sees.** `link_builder` at 19:44:14, "Link building · techand.ai", subject "[Link building] techand.ai — weekly
opportunities", summary `{press 0, drafted 0, redirects 0, impactReads 0, listingsMissing 2}`, PDF attached.

**Where it is right.** Contacts only on the prospect's own domain; every quoted line exists on the prospect's page; a drafted e-mail is
held until a person supplies the missing name; the competing-site rule refused six sites with their keyword and position; the listing
checklist says "not checked" for bot walls instead of "missing"; impact uses a control group and never says "caused".

**Where it is wrong.** C-10 (a site selling the same services is a held draft; a Dynamics 365 partner was qualified `ready` at 0.87),
C-17 (a garbled page name in a decline reason; "as a option" in the daxin draft), C-4 (Claude cost).

**Gap to the leader** (4C). No send, no reply rate, no follow-up timing can be measured (no mailbox connected — deliberately).
Opportunity sources this run: AI-cited pages, resource pages, broken links, competitors' new links, podcasts; journalist requests 0;
qualification is value × likelihood with the paid / exchange and government gates.

**Cost.** The workflow reports no DataForSEO cost of its own: the ledger carries its $0.05 estimate; by difference the account moved
≈$0.0498 for it. Claude: n8n reports 5,714 in / 2,118 out = **$0.0326**; the engine settled $0.0177 (C-4).

## 4. AI Pulse (run 2b, executions 629 → 630) and the scheduled pulse 593

**What came back.** 21 answers = 7 buyer questions × ChatGPT, Gemini, Google AI Mode; 0 errors, 0 retries; named 0% (95% range
0–15.5%), cited 0%, `alerts: []`. Report: *"21 answers from ChatGPT, Gemini, Google AI Mode to your 7 tracked questions. Named in 0%
(95% range 0-15.5%), your pages cited in 0%. … an alert is sent only when a change is beyond that noise…"*
(`files/C-pulse-630-report.txt`). App: `ai_pulse` at 19:43:41, title **"AI pulse alert · techand.ai"**, subject "[AI pulse]
techand.ai — 0 change(s) in today's AI answers", summary `{alerts 0, samples 21, mentionRate 0}`. 10-14 (exec 568): 50 s, 21 answers;
today 50 s, 21 answers.

**Why today's scheduled pulse (exec 593, 11:11 UTC) left no report in the app.** Established from 593's own nodes: *Pulse Metrics*
returned `alerts: []`, `on_demand: false` with the company callback set; *Pulse Alerts* (`build_monitors.py:401`: "Sites with
something to report (an alert, or an on-demand run) … Quiet days send nothing.") returned `{skip: true}`, so *Any Pulse Alerts?*
routed to nothing and no POST was made. The callback did not fail — it was never attempted, by design. The day's figures exist only in
`seo_ai_daily`.

**Side effect of my run.** `seo_ai_daily` keeps one row per site and day; the 2026-10-15 row now holds my 19:42 run
(`checked_at 2026-10-15T19:42:55.988Z`), so the scheduled 11:11 reading of the same day is no longer stored (C-19).

**Cost.** $0.084 measured (21 × $0.004) = account. The ledger also settles **$0.004 Claude "ESTIMATED"** although the pulse has no
Claude node ("the per-mode reservation: this branch priced no model call of its own") (C-6).

## 5. Rank Tracker (run 3a, executions 631 → 632)

**What was checked** (*Tracker Plan*, 12 items): the head keyword of 7 ladders plus, for the newest ladder "ai consulting dubai"
(planned today by executor A), its rungs "ai consulting", "ai consulting firm", "supply chain optimization consulting" — 10 desktop
checks and **2 mobile** checks (that ladder's head and rung 1). 25 unpublished rung pages were deferred ("not published yet: checked
monthly, last 2026-10-01 / 10-11 / 10-12 / 10-14"). The customer's own keywords (app site keywords "e invoicing software uae", "erp
implementation dubai", "peppol uae") were all read without a new purchase: two from this run's ladder checks, "e invoicing software uae"
*"read from the weekly site check of 2026-10-14"*. Every SERP request: `location_code 2784, language_code en, depth 50, device desktop |
mobile`, 12 tasks × $0.01, all 20000.

**What came back** (`files/C-rank-632-reports.txt`, 8 reports): no ladder head or rung in the results read (positions 0 → "not in top
50"). "peppol uae" moved from #47 (2026-10-14) to not in the top 50, reported as *"Drops to look at: peppol uae (#47 → not in top 50;
the whole results page moved that week (9 of the top 9 places changed), so this is not necessarily about your page)"*. Per keyword:
SERP features (AI Overview on all 12; PAA, local pack, video, knowledge graph, Google reviews where present), a modelled share of voice
with its CTR curve and the Ahrefs December-2025 AI-Overview click loss printed, competitors above ("tax.gov.ae (#1), mof.gov.ae (#2),
grantthornton.ae (#3) +7 more", own competitors starred), page movement against the previous reading, the AI Overview sightings with
times ("seen in 3 of 3 checks…"; its cited sources loaded for "e invoicing in uae" only: tax.gov.ae, u.ae, grantthornton.ae, comarch.com,
youtube.com; elsewhere "whether it cites you was not loaded (loading an AI Overview's sources costs extra, so we do not buy it)"), the
mobile reading with its date ("not in top 50 (2026-10-12)" where none was bought this week), and per-report lineage and cost
("Cost $0.1200 (measured: 12 task(s) …) — about $0.043 per keyword per month at a weekly check").

Next step per ladder, quoted: e invoicing in uae — *"Work on rung 1 … "uae e invoicing penalties" (https://www.techand.ai/insights/the-
cost-of-non-compliance-… already answers this search — refresh that page, do not publish a second one), "e invoicing uae fta" (a page run
was started for it but no page was written — it is written again)…"*; peppol uae — *"The main page is live: improve the main page …
https://www.techand.ai/insights/top-peppol-e-invoicing-software-features-every-uae-cfo-must-look-for"*; erp software uae — *"written but
not live yet: publish it at https://www.techand.ai/erp-software-uae/"*; erp implementation dubai — *"service industry erp software"
(already written — publish it)…*; azure cloud migration dubai — publish "azure api management monetization"; ai consulting dubai —
publish "ai consulting"; dynamics 365 partner uae — write "vendor invoice automation dynamics 365". Tracked-keyword report: *"0 in the
top 3, 0 in the top 10, 0 within reach (positions 4-20) … No check was bought for your keyword list this week."*

Positions against Search Console for the same query (from the Site Tracker of the same minute): "peppol uae" — Search Console average
**#10.3** on 3 impressions vs the live check (#47 yesterday, not in top 50 today); the Site Tracker prints it under "Watch" with the
reason "(positions vary by location and device)".

**What the customer sees.** 8 `rank_tracker` reports at 19:48:46, one per ladder ("Rank tracker: peppol uae", …) and "Rank tracker:
the keywords you asked us to watch"; their `request_id`s are the ladders' original requests (219, 428, 494, T4b-ladder-techand, 351,
609, 548) and `rr1014-site`.

**Where it is right.** Customer keywords are tracked beside the ladder rungs and never bought twice; every reading is labelled one
sample, one device, one country; the AI Overview observation is timed and its sources are said to be "not loaded" rather than "not
cited"; the drop is put in the context of the whole page moving; the next step reads the page inventory ("already answers this
search — refresh that page").

**Where it is wrong.** C-11 ("e invoicing in uae" set aside *and* checked *and* given a next step), C-12 (two movement figures for the
same keyword in one run; identical requests 32 s apart disagree), C-14 ("facts erp" still planned), C-15 (subject "top 100" vs body
"top 50").

**Gap to the leader** (criteria 2). Semrush / AccuRanker are daily with on-demand refresh; this is weekly with on-demand through the
API. Mobile was bought for 2 of 12 keywords. Country level only. AI Overview citation is loaded for 1 of 12 keywords. Competitors above
are listed per keyword, but there is no competitor movers view.

**Cost.** $0.12 measured = 12 × $0.01; the account moved $0.151 for 632 + 634 together. Claude: none.

## 6. Site Tracker (run 3b, executions 633 → 634)

**What came back** (`files/C-site-634-report.txt`). Period 2026-09-15 to 2026-10-12 vs the 28 days before. Headline (Claude *Site
Brief*): *"Tech& impressions tripled to 5,308, but clicks (32) are still too few to call a real rise"* — clicks 32 (▲52% from 21, "not
statistically significant, so a thing to watch"), impressions 5,308 (▲224%, "a real change"), CTR 0.6%, average position 25.5 (from
32), organic sessions 84 (▲83%, "real change"), 0 key events. Test: "two-sample Poisson test, 95%".

- Search Console depth: *Parse GSC* `paging` — queries 732 + 143 rows, pages 50 + 28, year-ago 0; `truncated: []`, `rows_read 953`,
  *GSC More Requests* "every Search Console kind returned fewer rows than the page limit". 539 named queries; withheld queries
  *"25 clicks and 1,484 impressions, 28% of all impressions"*.
- Brand split: *"Non-brand … 2 clicks from 500 queries (0%) · brand: 5 clicks from 39 queries (brand = techand, tech)"* — see C-13.
- Cannibalisation: "dynamics 365 finance in uae", two pages (56.3% at #21.9 and 31.3% at #28.3) with an action.
- Decay: *"50 pages tested, 0 really losing traffic, 50 with too few clicks to test (under 40 over both periods)"*.
- GA4: organic 84 of 292 sessions, landing pages listed, property 543096312.
- Trends: all four keywords *"too little search volume for a trend"* (no percentages printed); one rising related search.
- URL Inspection: 45 key pages inspected (*Inspect URL* 45 items, all answered) and written to `seo_page_watch`.
- Publish detection: sitemap read (45 URLs), 8 candidates, none found published (correct — nothing has been published).
- Annotations ("What happened in this period"): the August and September 2026 spam updates, and the audit events per report type —
  *"2026-10-11 | Full SEO report | health 68/100 · the report before it was a technical audit (80/100): different checks, so the two
  scores are not comparable"*; four identical rows "2026-10-12 Technical audit health 83 → 83".
- Monitor summary block: *"Technical audit (2026-10-15) | health 70/100 ▼13 (Needs Improvement)"* and *"Backlinks (2026-10-15, full) |
  18 referring domains ▲18"* — see C-2.
- Tracked keywords: 30 rows (3 of the customer's own, 6 rung-1, 16 rung-2 and 5 ladder heads) with Search Console average beside the
  live check; peppol uae "#10.3" vs "#47 2026-10-14" (the Rank Tracker had read "not in top 50" 32 s earlier in the parallel run).
- "Your pages: index status": /peppol-uae/ *"top | writing | no page was written yet"* — while the Rank Tracker report of the same
  minute says the peppol main page is live at the insight URL (C-16).

**What the customer sees.** `site_tracker` at 19:49:29, "Weekly site report · techand.ai", subject "[SEO weekly] techand.ai — 32 clicks
▲ 52%".

**Where it is right.** Paged and untruncated Search Console, withheld queries reported apart, significance tests on every rise,
"too little search volume" instead of sparse percentages, Search Console vs live position shown side by side with a reason, the
full-vs-technical audit difference stated in the annotation feed.

**Where it is wrong.** C-2 (the summary block compares a full report with a technical audit, and a full backlink snapshot with a
free one), C-13 (brand split), C-16 (duplicate "/" rows in Pages; "10 countrys"; the peppol page status), C-6 (cost).

**Gap to the leader.** Brand / non-brand split exists but is contaminated; no archive beyond Search Console's 16 months; GA4 join and
statistical alerts are in place.

**Cost.** Engine: DataForSEO $0.01 "ESTIMATED (this workflow reports no cost of its own…)", Claude $0.03 "ESTIMATED". By difference
the account moved ≈$0.031 for 634 (two SERP checks at $0.01 plus Google Trends). n8n reports the *Site Brief* call at 12,634 in / 997
out = **$0.0352**.

## 7. Page Watch (run 4a, executions 635 → 636)

25 of 45 known pages watched (home 1, nav 6, search 16, ladder 1, page 1) plus `/robots.txt`; 26 requests, all 200; every page `ok`,
0 changed, 0 not checked; robots.txt 200, hash `73c6cb2b` = previous, `blocks_key_pages: []`; *Watch Alerts* "nothing changed on the
key pages today"; no rechecks requested. Each row carries Google's view from the Site Tracker's inspection 4 minutes earlier: 16
"Submitted and indexed", 3 "Discovered - currently not indexed", 3 "Duplicate, Google chose different canonical than user", 3 "URL is
unknown to Google" — two of which are fragment URLs of the menu (`/industries#bfsi`, `/capabilities#ai`) (C-16). Cost $0. `files/C-watch-636-compare.json`.

## 8. Content Cadence dry run (run 4b, executions 637 → 638)

Checked before starting: in `build_site_tracker.py` *Dry Run?* true → *Planned Only* (no-op); *Start Content Runs*, *Save Content Log*,
*Mark Ladder Writing* and the callback hang only off the false branch. Result (*Cadence Plan*, `files/C-cadence-638-plan.json`):
*"4 written pages waiting for publication (pile-up guard, limit 3): "erp software uae", "service industry erp software", "azure api
management monetization", "ai consulting" — publish them to continue"* (`paused_reason: pileup`). On 2026-10-14 it paused on 3; the
fourth is the "ai consulting" page executor A's ladder run wrote today. Queue behind the pause (ladder-aware): "accredited service
provider for e invoicing in uae", "uae e invoicing requirements" (rung 1), "e invoicing uae 2026", "list of asp for e invoicing in uae"
(rung 2), all *"keyword ladder … towards "e invoicing in uae""* (C-11). AI page of the month: 0 of 2 used, next "best e-invoicing
software uae" (an AI answer page). 3 ladders queued behind `max_active`. Nothing written, no run spawned, no callback; ledger row 100 $0.

## 9. Audit Scheduler (run 5, executions 639 → 640 → 641)

*Audit Schedule Plan*: `run: true, why: "on demand"`, sitemap fingerprint `1eb0as2` (45 entries, latest lastmod 2026-10-09)
refreshed in `seo_cache`, body `report_type "Site Audit (technical issues only)"`, 200 pages, no JavaScript. The audit (641, 5 min 21 s)
crawled 47 pages, health **83 "Good"**, 0 critical / 4 high / 9 medium. Diff (`audit_diff`): *"0 fixed · 0 new · 27 still open
(compared with the technical audit of 2026-10-15)"* — previous `aud_mv9wujhkclv`, `report_type site_audit` on both sides, 0 days apart,
`sample_moved 0`, `not_compared []`; the indexing finding *"A large share of important pages is not indexed by Google"* compared 16 of 45
checked against 16 of 45 before. The scheduler's own `last_audit` field picked the full report of 19:15 (health 70), but only to
decide, and on demand it audits regardless. App: `site_audit` at 19:58:46, summary `{healthScore 83, grade Good, scoreDelta 0, …}`.
Cost: engine $0.0265 (GBP lookup $0.0054 measured + crawl $0.0211 "ESTIMATED … $0.00045 a page" for 47 pages); the account moved
**$0.03735** (C-6). `files/C-auditsched-640-plan.json`, `report-f412546c-….json`.

## 10. The error path into the alert channel (run 6, executions 642 → 643) and the alert record

**The failure.** Test Runner body `{"workflow":"SEOagentNoSuchWf","request_id":"rr1015-errpath"}` → 202 "started" → *Run Target*
error **"Workflow is not active and cannot be executed."** (execution 642, status `error`, 19:59:49.616). Nothing outside n8n and the
owner's own channels was touched.

**The Error Handler (643, 19:59:49.652–19:59:54.039).** *Alert Record* → `seo_ops_alerts` row **5** ("SEO Agent — Test Runner | Run
Target | workflow is not active…", severity high, `channels: "webhook,email,data_table"`). Channels tried and their answers:

| Channel | Node | Answer |
|---|---|---|
| the owner's Slack webhook | *Post Alert Webhook* (19:59:49.744, 727 ms) | **HTTP 200, body "ok"** |
| the ops e-mail (the mailbox configured in `n8n/.env`) | *Email Ops* (19:59:51.183, 1,743 ms) | **SMTP "250 2.0.0 OK", accepted 1, rejected 0** |
| the data table | *Save Ops Alert* / *Save Alert Delivery* | row 5 written, then updated |

Row 5 after the run: `delivered: "webhook,email"`, `attempts 1`, `attempt_log "1 2026-10-15T19:59:52Z webhook+email delivered: webhook
sent; email accepted by 1 recipient(s)"`. On 2026-10-14 this path was not exercised and every row said `pending`.

**But the same run re-posted an old alert twice.** *Alert Retry Plan* → *Post Alert Retry* ran twice (once behind each delivery branch),
each time re-sending row 4 (Console Alerts IMAP failure of 2026-10-13) to Slack: HTTP 200 at 19:59:50 and 19:59:53 (C-3).

**The alert record, last 14 days** (`files/C-ops-alerts-after-errpath.json`) — 5 rows:

| Row | Alert | First seen | Delivered (as stored) | By |
|---|---|---|---|---|
| 1 | main workflow, *Fetch Page HTML*, execution 461 cancelled at the time-out | 2026-10-12 18:34 | `webhook`, attempt 1, 2026-10-15 09:45 | re-sent by Page Watch 592, ~63 h later |
| 2 | main workflow, *GSC Audit Findings*, execution 459 cancelled at the time-out | 2026-10-12 18:34 | `webhook`, 2026-10-15 09:45 | Page Watch 592 |
| 3 | Console Alerts, "unknown node, no message" | 2026-10-13 03:07 | `webhook`, 2026-10-15 09:45 | Page Watch 592 |
| 4 | Console Alerts, *Mailbox Trigger* deactivated (IMAP connection closed) | 2026-10-13 17:52 | **`failed`, `attempts: null`** ("email failed (getaddrinfo ENOTFOUND smtp.gmail.com)") | — although Slack accepted it **14 times today** (C-3) |
| 5 | Test Runner, this test | 2026-10-15 19:59 | `webhook,email`, attempt 1 | Error Handler 643 |

## 11. AI Growth — not run, read-only

**Not run, on purpose**: its normal run submits pages to Bing Webmaster Tools (and IndexNow when the key file is hosted) and has no
dry-run switch; the owner forbids test submissions. What the record shows:

- Executions (`/executions?workflowId=SEOagentAIGrow1`): 269 (`error`, 2026-10-10 15:19), 273, 277, 286 (2026-10-10), 376 (10-11),
  480, 511 (10-12), 574 (2026-10-14 16:21, the last) — **all `integrated` (on demand), none `trigger`**.
- `seo_ai_growth`: 8 rows, one per run; the last (2026-10-14 16:21): 12 pages checked, average AI-readiness 77, **2 URLs submitted to
  Bing** (`/capabilities/business-applications`, `/dynamics-365-cloud-migration-uae`, quota 100), IndexNow `key_missing`. I fetched the
  key file URL `https://www.techand.ai/e474f67e21841570c3de6d7624391652.txt`: **404**.
- `seo_ai_pages`: 34 rows — the same pages under both `https://techand.ai/…` and `https://www.techand.ai/…` (e.g. `/whatwedo`,
  `/whywith-techand`, the penalties insight each appear twice) (C-16).
- `seo_ai_targets`: 7 — 6 `queued` (two "written as the keyword ladder page … (one search, one page)", four "no page answers it yet"),
  1 `skipped` ("the page is fresh (updated 2026-08-21) and AI-ready (90/100)"). None written.
- Snapshot: `files/C-aigrowth-tables.json`.

## 12. Schedule reliability (read-only)

**The ten crons, confirmed in the build source and in the live workflows** (`files/C-schedules-workflows.json`): AI Visibility weeks/Mon
07:00, Backlinks Mon 07:30, Rank Tracker Mon 08:00, Site Tracker Mon 09:00, AI Growth Mon 09:30, Content Cadence Mon 10:00, Link Builder
Mon 11:00 (all `{field: weeks, weeksInterval: 1, triggerAtDay: [1]}`), Audit Scheduler `0 6 1 * *`, AI Pulse `30 6 * * 0,2-6`, Page Watch
`days, 1, 05:45`. All active; no workflow sets `settings.timezone`; the n8n container has **no `GENERIC_TIMEZONE`** (`printenv` exit 1),
so n8n uses America/New_York — confirmed by the trigger outputs ("Timezone: America/New_York (UTC-04:00)", execs 593, 449, 451).
Due times in UTC: 11:00, 11:30, 12:00, 13:00, 13:30, 14:00, 15:00 on Mondays; 10:00 on the 1st; pulse 10:30; Page Watch 09:45.

**Fires, last 21 days** (2026-09-24 → 2026-10-15 19:29; each workflow from its creation; `files/C-schedule-table.json`):

| Workflow | Due | On time (≤ 5 min) | Late | Missed | Fires (UTC) |
|---|---|---|---|---|---|
| AI Visibility | 2 (10-05, 10-12) | 0 | 1 (26 min) | 1 | 10-12 11:25 (exec 449) |
| Backlinks | 2 | 0 | 1 (4 h 50 min) | 1 | 10-12 16:19 (exec 451) |
| Rank Tracker | 2 | 0 | 0 | **2** | — |
| Site Tracker | 2 | 0 | 0 | **2** | — |
| AI Growth | 1 (10-12) | 0 | 0 | **1** | — |
| Content Cadence | 2 | 0 | 0 | **2** | — |
| Link Builder | 1 (10-12) | 0 | 0 | **1** | — |
| Audit Scheduler | 0 (created 10-02) | — | — | — | — |
| AI Pulse | 7 | 0 | 6 (18, 127, 606, 25, 262, 41 min) | 1 (10-10) | 10-08 10:48, 10-09 12:36, 10-11 20:36, 10-13 10:54, 10-14 14:51, 10-15 11:11 |
| Page Watch | 3 | 2 | 1 (137 min) | 0 | 10-13 09:45, 10-14 12:02, 10-15 09:45 |

The run ledger agrees: every `schedule:*` row since the ledger began (2026-10-12 06:24) belongs to an `integrated` execution except the
pulse and Page Watch `trigger` runs.

**Why — what is established.**
1. *Static data cannot suppress these fires.* The compiled node (`n8n-nodes-base/dist/nodes/Schedule/GenericFunctions.js`, n8n 2.41.4)
   turns a weekly interval of size 1 into the cron `"<s> M H * * 1"` with `recurrence = {activated: false}`, and `recurrenceCheck`
   returns `true` at once when `activated` is false. Every workflow's staticData is `{"recurrenceRules":[null],
   "recurrenceRuleSignatures":[null]}`.
2. *A cron lives in memory and is re-armed at every restart.* `ScheduledTaskManager.register` builds a `CronJob` (cron@4.4.0) whose
   `start()` arms one `setTimeout` for the next occurrence; the 250 ms "missed deadline" threshold applies only when the job is
   started after its time, which a restart never does (it computes the next *future* occurrence). The docker logs (container created
   2026-10-14 15:28) show 13 "Initializing n8n process" lines — the start and 12 restarts — and every "Stopping n8n..." is preceded by
   "Deregistered all crons"; the `workflow_publish_history` table (read-only from the n8n database) dates the deploys of 2026-10-12 at 06:16, 09:16, 09:53, 16:38,
   16:45, 19:30 and 20:20 UTC. A fire that is due but not yet delivered when n8n restarts is not delivered at all.
3. *No execution of any kind ran from 2026-10-04 08:51 to 2026-10-08 00:51 UTC* (`execution_entity` ids 210 → 211), so Monday 2026-10-05
   was missed by the whole instance, not by the schedules; why the instance did not run then is **not established** (the Mac's power
   log does not reach back before 2026-10-09 05:08).

**Why — the timing, a hypothesis that fits almost every fire.** `pmset -g log` (`files/C-pmset-intervals.json`) gives the Mac's wake
and sleep times. If the Linux VM's timers do not advance while the Mac sleeps — Node's `setTimeout` runs on the monotonic clock of a VM
that is paused — each fire is late by the sleep accumulated since the cron was armed. Arming time = the last restart or the previous fire
(`files/C-schedule-simulation.json`):

| Fire | Armed | Predicted (Mac awake time incl. dark wakes) | Observed |
|---|---|---|---|
| Pulse 10-13 | restart 06:20 | 10:54 | **10:54:40** |
| Pulse 10-14 | restart 10-13 17:18 | 14:52 | **14:51:44** |
| Pulse 10-15 | restart 09:14 | 11:11 | **11:11:24** |
| Page Watch 10-14 | restart 10-13 17:18 | 12:02 | **12:02:21** |
| Page Watch 10-13 / 10-15 | Mac awake at 09:45 | 09:45 | **09:45:06 / 09:45:21** |
| AI Visibility 10-12 | restart 09:54 | 11:38 | 11:25:35 (13 min earlier) |
| Backlinks 10-12 | restart 09:54 | 16:33 | 16:19:51 (14 min earlier) |
| Pulse 10-10 | fire 10-09 12:36 | after the 10-10 15:15 deploy restart | **missed** |
| Rank 12:00 / Site 13:00 / Growth 13:30 / Cadence 14:00 / Link Builder 15:00 on 10-12 | restart 09:54 | 17:03 / 19:47 / 20:18 / 20:48 / 21:48 | **missed** — all after the 16:38–16:40 deploy restart, which re-armed them for 2026-10-19 |
| Pulse 10-11 | restart 03:08 | 2026-10-12 09:53 | 2026-10-11 20:36:07 — **not explained** |

Six fires match within a minute, two within 14 minutes (the same direction, consistent with ~13 min of VM run time the power log does not
show as awake), all six misses checked (the 2026-10-10 pulse and the five on 2026-10-12) are predicted, and one fire (2026-10-11 20:36)
contradicts the model. **Established**: the restart discards a
pending fire; the delays coincide with the Mac's sleep. **Hypothesis**: that the VM's monotonic clock stops during sleep (not observed
directly). Implication, also a hypothesis: the crons were last armed at today's 18:43 restart, so any sleep before next Monday delays the
Monday runs by that much, and any deploy before they fire discards them.

## 13. Ledger and reliability across this wave

- Every monitor reserved its ledger row on the main path before spending (*Reserve Run Ledger (…)* runs before the first paid node in
  623, 626, 628, 630, 632, 634, 636, 638, 640) and settled it; **no row of this wave is left `reserved`** (checked at 20:00).
- The new concurrency gate refused one run, and it was the wrong one (C-1).
- Cost figures: measured and right — AI visibility (±$0.002), backlinks (±$0.0001), pulse, Rank Tracker; estimated or wrong — the two
  front-door rows (C-5), Site Tracker, Link Builder, the pulse's Claude, the audit crawl (C-6), every Claude "measured" figure on a
  structured-output node (C-4). Seven of this wave's thirteen cost bases name Keyword Check executions 598–600 (finished 19:02) as
  "in flight" (C-5).
- Alerting: one failure reached Slack and e-mail in under 5 s with the delivery recorded (§10); one old alert is re-sent on every
  monitor run (C-3).

---

## Findings

| # | Finding | Evidence | Severity | What a correct output would be |
|---|---|---|---|---|
| **C-1** | An on-demand **full backlinks check from the app was refused by its own front-door run**, and the customer was never told. | 624 *After Run Ledger (BL)*: `reason "same_mode"`, "The previous backlinks run (execution 622 …) is still going"; 622 is the same request's main-workflow run (ledger row 91 still `reserved` when 624 read the ledger at 19:29:38.391; 622 began writing it `done` at 19:29:38.472, `updatedAt` 19:29:38.862). Reports for request 621: `backlinks_started` only. The AI visibility request passed the same gate because row 90 was written `done` at 19:29:37.850, before 623's read at 19:29:38.471. `_run_guard.js` rule 1 matches on `mode` alone. | **High** | The gate ignores the reservation of the run that started it (or the front door settles before it spawns); a refused on-demand run posts its reason to the customer. |
| **C-2** | The weekly site report's monitor block **compares unlike reports and prints the difference as change**: "Technical audit (2026-10-15) health 70/100 **▼13**" and "Backlinks (2026-10-15, full) 18 referring domains **▲18**". | 634 *Site Report* (`v5/code/Site_Report.js` lines 77–80, `latest2()` takes the two newest rows of any type). `seo_audits`: newest = `aud_mv9x4zz1i6i` **full**, 70; before it `aud_mv9wujhkclv` **site_audit**, 83, both 2026-10-15. `seo_backlink_snapshots`: newest = 2026-10-15 `full`, 18; before it 2026-10-14 17:54 **`free`**, 0. | **High** | "Technical audit 83 (no change)" from the two technical audits, the full report labelled as such; backlinks compared with the last full snapshot (18 → 18) or no delta. |
| **C-3** | **One stale ops alert is re-sent to Slack on every monitor run** — 14 times on 2026-10-15 (12 during this wave), each as "attempt 1 of 10 … this alert has reached nobody" — while its row stays `delivered: failed`, `attempts: null`. | Post Alert Retry in 592, 593, 623, 624, 626, 628, 630, 632, 634, 636, 638, 640 and twice in 643, all HTTP 200; *Save Alert Retry* output `{}` each time. The retry key is trimmed (206 chars, ends "(or a") while the stored key ends "(or a " (207): 626 *Alert Retry Plan* `alert_key` vs `row.alert_key`; the update filter `alert_key eq …` matches no row. The Error Handler runs the retry chain twice per failure (once per delivery branch). | Medium | The retry writes back `attempts`/`delivered` on the row it re-sent, so the alert is sent once and escalates or stops by the plan; one retry pass per Error Handler run. |
| **C-4** | **Claude "measured" cost counts the model's answer as the string "[object Object]"** on structured-output nodes, so the figure labelled measured is 34–46% low. | 623 *Prompt For Count (AI Brief)* `__answer: "[object Object]"`; *Ledger Settle (AI)* `ai_by_node`: AI Brief "count_tokens counted 4830 prompt and **5** answer token(s)" (n8n: 5,609 in / **1,166** out), Answer Analyst "**15** answer token(s) across 3 call(s)" (n8n: 3,351 out). Engine $0.0678 vs $0.1033. 628 Outreach Sequence Writer: 5 answer tokens vs n8n 2,118; $0.0177 vs $0.0326. | Medium | The answer object serialised (JSON) before `count_tokens`, or n8n's own `tokenUsage` used where the node reports it. |
| **C-5** | **The front-door ledger rows double-count monitor runs**, and **seven of this wave's thirteen cost bases name finished runs as "in flight"**. | Row 90 (exec 620) settles $0.95 DataForSEO "ESTIMATED … its figure stays the $0.9500 its own tasks reported" and row 93 (623) $0.7794 measured for the same request; row 91 (622) settles $0.50 for a request that spent $0 (its monitor was refused). The wave's rows sum to $2.8924 against $1.4761 the account moved. The cost bases of rows 90, 91, 96, 98, 99, 100 and 101 (and 623's *Ledger Settle (AI)* `dfs_run.basis`) say "4/5 other run(s) were in flight at the same time (598, 599, 600, …)"; 598–600 are Keyword Check runs that ended at 19:02 (their rows have `settled_at: ""`), and the 624 named by rows 96–101 ended at 19:34. | Medium | One row per request carrying the monitor's measured figure (the front-door row settles $0 or links to the child); overlap judged from runs actually open in the window. |
| **C-6** | **Several monitors' costs are not measured**: Site Tracker DataForSEO $0.01 "ESTIMATED" vs ≈$0.031 moved (2 SERP checks + Trends); Link Builder $0.05 "ESTIMATED"; the AI Pulse settles $0.004 Claude with no Claude node; the audit crawl is priced $0.0211 (47 pages × $0.00045) while the run moved $0.0374 in total. | Rows 96, 98, 95, 102 cost bases; balance windows 19:44:39→19:52:21 ($0.151 for 632 + 634; 632 = $0.12 measured) and 19:53:20→19:59:00 ($0.03735 for 641). | Low | Each workflow reports what its own tasks cost; no Claude charge without a Claude call; the crawl priced at what the account moves for it. |
| **C-7** | AI visibility tells the customer to **"pitch a guest article or comparison mention" to wafeq.com and edicomgroup.com** — businesses the same report counts among those AI recommends instead — and keeps eight such domains as `ai_source` link prospects (re-written by this run; six scored 90–100). | 623 *AI Brief* action 4; 623 *AI Plan* `aliases` maps Wafeq, EDICOM, Comarch, Pagero, Flick Network, Velmont Crest, Aiverix and Thomson Reuters to the saved domains; *AI Prospect Rows* (10 rows). 628 refused wafeq.com as *"a competing site of yours … #1 for "e invoicing software uae""*. Fetched: wafeq.com/en-ae shows "Accredited Service Provider · Accreditation #129932"; edicomgroup.com "As a Pre-Approved Accredited Service Provider (ASP), EDICOM supports enterprises with e-Invoicing in the UAE". | Medium | Pitch targets drawn from cited sources that are not themselves named as alternatives (publishers, associations, directories), or the rival status stated next to the suggestion. |
| **C-8** | The AI visibility **denominators are described wrongly**: "74 answers (8 questions × 6 engines)" and "The rates below count the **33** answers that came back" while 46 of 47 requests answered; the rates leave out Claude's 7 answers and the 5 brand answers (by design) without saying so; the per-engine and per-question tables add up to 81. AI Overview presence counts the failed request as "no AI Overview" (5/7 = 71.4% instead of 5/6). | 623 *AI Metrics*: `asked 35, asked_all 42, requests 47, answered 33, samples 74, pulse_samples 41`; lineage `"sample": "74 answers (8 questions × 6 engines)"`; report "By engine" 21+7+21+7+5+20; `AI_Metrics.js:110` `pct(answered, aio.length)`. | Medium | "74 answers on the 5 weekly engines (33 this run + 41 from the daily pulse), the 7 buyer questions; Claude's 7 answers are shown per engine and not in the headline"; AI Overview presence over the requests that answered. |
| **C-9** | The AI keyword-volume lookup failed twice (DataForSEO status 50000 "Internal Error", 50 s each) and the report does not say so: volumes print "—" and the lineage says "0 questions with a volume". | 623 *Run Discovery* item 3 and *Run Discovery (Retry)* item 2 (`ai_keyword_data/keywords_search_volume/live`); report lineage row 2; the request-failure line counts only the 47 answer requests. | Low | "AI search volume could not be read this run (the provider failed twice)" beside the "—". |
| **C-10** | The link pipeline **treats direct competitors as opportunities**: the Link Builder holds a drafted pitch (blocked only by "[Your name]" and one owner line) to **daxin-global.ae**, whose home page lists Microsoft Dynamics 365, Business Central and e-invoicing services; its gate qualified **qzinfomatics.com** ("Microsoft Dynamics 365 Partner in Dubai, UAE") `ready` at fit 0.87 (the writer declined it, for weak evidence); the Backlink Monitor reads five competitors' own service pages as "best of" lists and saved qzinfomatics.com as a `list` prospect. | 628 *LB Draft QA* verdict n 2; *LB Assemble* outreach rows (qzinfomatics.com `ready`, `fit_reason "topic match 87%"`); 626 `lists` and prospect rows; fetched daxin-global.ae home ("Odoo ERP Microsoft Dynamics 365 Microsoft Business Central E-invoicing Custom ERP Development AI & Process Automation") and qzinfomatics.com pages. The competing-site rule only fires on a site that outranks techand.ai for one of its tracked keywords. | Medium | A site offering the same services in the same country is set aside as a competitor whatever it ranks for; a page titled "<company> … Partner in Dubai" is not a list. |
| **C-11** | **"e invoicing in uae" is set aside and pursued in the same run.** The Rank Tracker report says *"Set aside (planned before the keyword rule existed, no position checked and no page to write): "e invoicing in uae" is not a search this website should target: the results page belongs to government sites"* — yet the head was checked this run (a paid SERP, shown in the table and the SERP block) and the next step is "Work on rung 1 … "e invoicing uae fta" … "accredited service provider for e invoicing in uae"". The cadence dry run queues four of that ladder's rungs as the next pages. | 632 *Tracker Plan* item 0 (keyword "e invoicing in uae", rung 4, desktop) and report 0; 638 *Cadence Plan* `upcoming` (4 rows, "keyword ladder, rung 1/2 towards "e invoicing in uae""). | Medium | Either the head is set aside and the ladder stops (no check, no next step, rungs off the queue) or it is not set aside. |
| **C-12** | **Two "page movement" figures for the same keyword in one run**: "erp implementation dubai" — ladder report "3 of top 8 changed (some)", tracked-keywords report "5 of top 8 changed (high)". Two identical requests 32 s apart (632 stored 19:48:46, 634 stored 19:49:18, both `location 2784, en, desktop, depth 50`) returned different leading results (632: brainsphereit.com #1, euclidz.com #3, erplax.com #4; 634: rvguae.com #1, hlbhamt.com #2, ae.indeed.com #3), so movement between two single readings partly measures call-to-call variation. | 632 reports 4 and 7; `seo_rank_history` rows of 2026-10-14 16:21 / 16:31 and 2026-10-15 19:48:46 / 19:49:18. | Medium | One movement figure per keyword per run against one stated baseline; movement labelled against the variation two readings of the same moment show. |
| **C-13** | **The brand / non-brand split counts "tech" as the brand**: "brand: 5 clicks from 39 queries (brand = techand, tech)" includes "technology and analytics", "technology & data", "tech and software", and the biggest "brand" query is "techandkey com" (308 impressions). | 634 *Parse GSC* `brand_split.names ["techand","tech"]`, `brand.top`. | Medium | Brand terms from the business name and its spellings ("techand", "tech&", "tech and"); generic words never a brand term. |
| **C-14** | The rung **"facts erp"** — the brand of facts.ae, which this run read at **#3** for "erp software uae" — is still planned and printed in the Rank Tracker report and the site report. Same as on 2026-10-14. | 632 report 2 ("2 \| facts erp (not published yet …)"), competitors above "facts.ae (#3)"; 634 tracked keywords "facts erp \| ladder rung 2". | Medium | Set aside as another company's brand. |
| **C-15** | Ladder report subjects say "top page not yet in the **top 100**" while the body says "Google top 50" and every cell "not in top 50" (requests are `depth 50`). | 632 *Tracker Report* subjects and bodies. | Low | One stated depth. |
| **C-16** | Smaller inconsistencies the customer sees: the backlink anchor block says the farm sites are "left out of … the table below" and the table lists only the two farm anchors; the site report's Pages table has two "/" rows (14 and 3 clicks, the www and bare host), "across 10 countrys"; the site report says "/peppol-uae/ … no page was written yet" while the Rank Tracker says the peppol main page is live at the insight URL; Page Watch spends 2 of its 25 slots on menu fragment URLs (`/industries#bfsi`, `/capabilities#ai`), inspected as "URL is unknown to Google"; `seo_ai_pages` stores the same pages under both hosts (34 rows). | 626 report "Anchor texts"; 634 report "Pages", "Clicks by country", "Your pages: index status" vs 632 report 1; 636 *Watch Compare*; `seo_ai_pages`. | Low | Farm anchors out of the table they are out of; hosts merged; one status per page across reports; fragments not watched. |
| **C-17** | Wording defects in Claude output: the writer's decline reason for qzinfomatics.com names "the offered page ('techandkey com')" (not a page of the site; it is a Search Console query); the held daxin draft reads "see us … as a option". | 628 *LB Draft QA* `writer_skip` n 1, verdict n 2 step 0. | Low | The real target URL; grammatical copy. |
| **C-18** | **Five of the ten schedules have never fired on their own**, and the rest fire late: in 21 days Rank Tracker, Site Tracker, AI Growth, Content Cadence and Link Builder 0 fires of 8 due; AI Visibility and Backlinks 1 of 2 each (26 min and 4 h 50 min late); AI Pulse 6 of 7, every one late (18 min – 10 h 6 min); Page Watch 2 of 3 on time. Monday 2026-10-05: no execution of any workflow at all (10-04 08:51 → 10-08 00:51). Mechanism in §12. | `files/C-schedule-table.json`, `C-schedule-simulation.json`, `C-pmset-intervals.json`, `C-schedules-workflows.json`; docker logs; `workflow_publish_history`. | **High** | Each weekly run fires on its Monday within minutes, on a host that does not sleep, and a restart does not discard a due run. |
| **C-19** | A same-day on-demand pulse **replaces the scheduled reading of that day** (one `seo_ai_daily` row per site and day): the 11:11 sample of 2026-10-15 is gone. Quiet scheduled pulses send no callback by design, so the app has no record of them either. | `seo_ai_daily` row 8 `checked_at 2026-10-15T19:42:55.988Z`; 593 *Pulse Alerts* `{skip:true}`. | Low | Each reading kept (or the on-demand reading stored apart). |
| **C-20** | The refused backlinks run took **5 min 33 s to do nothing**: 315 s in *DFS Balance End (BL)*, a free balance read that DataForSEO answered in 0.07 s (`"time": "0.0694 sec."`). | 624 node timings. | Low | The refusal path ends in seconds. |

## What could not be exercised, and why

- **AI Growth** — not run: it submits pages to Bing (and IndexNow when the key file is up) with no dry-run switch; test submissions are
  forbidden. Read-only record in §11.
- **The scheduled monthly reuse of Claude / the brand question in AI visibility** — only on-demand runs ran; an on-demand run is
  always the full run (`AI_Plan.js:59`).
- **The AI fact check** — no business profile on file; the report says so.
- **Link Builder sending, replies, follow-up timing, bounce rate** — no mailbox connected (deliberately); 4 drafts held for the owner.
- **The Backlink Monitor's light weekly watch and its lost-link alert** — only on-demand full runs; nothing was lost.
- **Page Watch "I fixed this" re-check** — no finding had `recheck_state = requested`.
- **The app UI** for these reports — executor D's part; the runs were started against n8n directly, so the app's `runs` table has no
  rows for them.
- **A scheduled (trigger-mode) run of any monitor** — the brief allows on-demand runs only; §12 is the read-only substitute.

## State left behind

- Test Runner **inactive** again (20:00:26 UTC, confirmed). Nothing else activated or deactivated.
- `seo_run_ledger` rows **90–102** (13), none `reserved`; row 92 `refused`.
- `seo_ops_alerts` row **5** (this test, delivered); row 4 still `failed` although re-sent 12 more times by this wave.
- Slack (the owner's channel) received: the test alert once, and the old Console Alerts alert 12 times from this wave's runs; the ops
  mailbox received the test alert once.
- `seo_ai_answers` 47 (623) + 21 (630) written; `seo_ai_visibility` +1; `seo_ai_daily` 2026-10-15 row overwritten by 630;
  `seo_link_prospects` upserted by 623 (10), 626 (6) and 628 (4) — **6 new rows** (enterpriseam.com, holod.media, nrdoshi.ae,
  edicomgroup.com, sharedserviceslink.com, lumeafinance.com), 160 for the site now; `seo_backlinks` upserted (21 rows), `seo_backlink_snapshots` +1 (full); `seo_link_outreach`
  34 rows written (28 `not_fit`, 4 `needs_edit` drafts — none sent, 2 `needs_contact`); `seo_listings` 16 upserted; `seo_link_impact` 2;
  `seo_rank_history` +12 (632) +2 (634); `seo_query_history` +130; `seo_site_metrics` +1; `seo_pages` 45 upserted; `seo_page_watch` 45
  (634) + 25 (636) upserted; `seo_cache` sitemap fingerprint refreshed (640); `seo_audits` +1 (`aud_mv9yorgm14h`, site_audit, 83) with its
  findings.
- App `reports`: 16 rows for the company (§ Runs).
- No page written, no ladder created, no content-log row, nothing published, no Bing / IndexNow submission, no e-mail to a third party.

## Artefacts (`files/`, git-ignored)

| File | What it is |
|---|---|
| `C-aivis-623-report.txt` / `.json`, `C-aivis-623-metrics.json` | AI visibility report (text + payload) and its metrics block |
| `report-f18ed579-….json` | the `ai_visibility` row the app received |
| `C-bl-626-report.txt` / `.json`, `report-b2e07a51-….json` | the backlink report of the second attempt and its app row |
| `exec-624.json` | the refused backlinks run (refusal text, timings) |
| `C-lb-628-report.txt` / `.json`, **`C-lb-628.pdf`** | the Link Builder's week (HTML text, payload, the 6-page PDF) |
| `C-pulse-630-report.txt`, `C-pulse-630-metrics.json` | the on-demand pulse |
| `C-rank-632-reports.txt` / `.json` | all 8 Rank Tracker reports |
| `C-site-634-report.txt` / `.json` | the site report |
| `C-watch-636-compare.json` | Page Watch: every page, robots.txt, Google's inspection per page |
| `C-cadence-638-plan.json` | the dry-run plan (pile-up pause, queue) |
| `C-auditsched-640-plan.json`, `C-audit-641-diff.json`, `report-f412546c-….json` | the scheduler's decision and the audit it started |
| `C-ops-alerts-before-errpath*.json`, `C-ops-alerts-after-errpath.json` | `seo_ops_alerts` before and after the error test |
| `C-run-ledger-rows-90-102.json` | this wave's ledger rows |
| `C-aigrowth-tables.json` | `seo_ai_growth`, `seo_ai_pages`, `seo_ai_targets` (read-only) |
| `C-schedules-workflows.json`, `C-schedule-table.json`, `C-schedule-simulation.json`, `C-pmset-intervals.json` | schedule evidence: triggers, staticData, every execution by mode; due vs fired; the sleep model; the Mac's wake intervals |
| `exec-619.json` … `exec-643.json` | full executions (saved by the toolkit) |
| `spend.jsonl`, `starts.jsonl` | balance probes "C start" … "C end"; every start of this wave |
