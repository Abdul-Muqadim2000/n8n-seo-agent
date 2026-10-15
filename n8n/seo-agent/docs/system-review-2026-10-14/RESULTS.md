# Second whole-system re-rating — live runs on techand.ai, 2026-10-14

The re-rating protocol of `../system-review-2026-10-11/FIX_PLAN.md` §5.2, run a second time after the 2026-10-13 evening work
(95 fix-plan items, R1–R16, G11/G12/G14/G15/G21/G23/G25/G27/G28/G29/G30/G31/G32/G33, L3–L7). Real runs on the owner's site
(country United Arab Emirates), **started 16:02:38 UTC and finished 16:35:49 UTC** (33 min 11 s, **executions 535–581, 47 in all,
every one `success`**). Every API run was sent the way the web app sends it — header `X-Forwarded-For: app:<techand.ai company>`
and techand.ai's own app callback — so **23 reports landed in the app's `reports` table** between 16:03:23 and 16:35:48. The
monitors were started on demand through the Test Runner, which was **activated at 15:59 UTC and deactivated again at 16:40 UTC**.
No code, workflow or prompt was changed, no temporary workflow was created, no e-mail went to a third party, no page was published
and no mailbox was connected.

The deployed state at run time matched the built source exactly: **main workflow 469 nodes, 21 published workflows**, every
`workflows/*.json` node count equal to the live one (checked through the public API before the first run). The deploy had been
applied at 15:27 UTC the same day, so **this run is the first execution of the G11–G33 / L3–L7 / R1–R16 build**.

## 0. Spend

**Total $3.63 against the $8 hard cap** (budget estimate before the run: $4.0–4.5).

| | Amount | How it was measured |
|---|---|---|
| DataForSEO | **$2.3876** | Balance **$16.235543 at 15:57:45 UTC** and **$13.847929 at 16:40:42 UTC**, probed with `appendix/user_data` from inside the n8n container (`files/spend.json`), nothing else running in between. Two intermediate probes split the run into three windows (below). *The coordinator's independent figure of $2.5636 starts from $16.411543, the balance left by the 2026-10-13 re-rating; the $0.1760 difference is the two scheduled AI Pulse runs of 2026-10-13 10:54 (exec 531) and 2026-10-14 14:51 (exec 534) at $0.084 each, plus the two scheduled Page Watch runs — spend that happened before this run started.* |
| Claude | **$1.2458** | Every `Claude — …` node of executions 535–581 (`files/claude-tokens.json`): 33 model calls. **$0.8520 measured** — 29 Sonnet 5.5 calls (179,871 in / 48,119 out) and 1 Haiku 4.5 call (4,874 / 1,251) report real `tokenUsage`. **$0.3937 estimated** — the three **Opus 5.5 streaming** nodes of the content run (*Strategy Brief*, *Copywriter*, *Editor*, 24,998 in / 14,686 out) report only `tokenUsageEstimate`, as they always do (G23). So about **32% of the Claude figure is an estimate, not a measurement**. |

**Per window** (balance deltas, the only measurement that cannot be argued with):

| Window | UTC | Runs | Balance moved | What the engine's own figures say | Difference |
|---|---|---|---|---|---|
| A | 15:57:45 → 16:18:04 | 1, 3, 4, 5, 11, 6, 8, 9, 7, 10 | **$0.550590** | $0.6145 | **+11.6%** over-stated |
| B | 16:18:04 → 16:30:30 | 12, 13, 15, G27, 14, 16, 18, 19, 17, G11 | **$1.785074** | $1.7034 | −4.6% under-stated |
| C | 16:30:30 → 16:40:42 | 21, 20 | **$0.051950** | $0.0900 | **+73%** over-stated |

That is **R28** below. $1.394 of the $2.388 — 58% — is attributed to no settled ledger row at all, because of **R17**.

---

## 1. Runs

All times UTC, 2026-10-14. "API" is the front door's webhook execution, "run" the execution that did the work. DataForSEO is each
run's own measured figure where it writes one; `(discarded)` marks a figure the run computed and then threw away (R17); `—` means
the run reports no cost at all. Claude is from the per-execution token counts (§0).

| # (protocol) | What | Request id | Executions (API → run) | Start–end | Duration | DataForSEO | Claude | Status |
|---|---|---|---|---|---|---|---|---|
| — | Balance before | — | — | 15:57:45 | — | — | — | $16.235543 |
| 1 | Site Admin `monitors` → `link_builder: true` | rr1014-lb-on | 535 → 536 | 16:02:38–16:02:40 | 2 s | 0 | 0 | ok (affected 1) |
| 3 | `describe` | 537 | 537 → 538 | 16:02:40–16:03:24 | 44 s | 0 | 0.011 | completed, 6 pages read, 28 services, canonical `www.techand.ai` |
| 4 | `verdict` "e invoicing software uae" | 539 | 539 → 540 | 16:02:41–16:04:48 | 2.1 min | 0.0221 | 0.108 | completed, GO_WITH_CHANGES **58**, `improve` the existing URL |
| 5 | Keyword Check ×3 (`seo-keyword-assess`) | rr1014-assess-* | 541, 542, 543 | 16:02:43–16:02:50 | 6.2 / 6.5 / 6.2 s | 0.078 (caller-reported; ledger says 0) | 0.017 | 200 ×3, **all three with `fit: 2`, `fit_known: true`** (R3) |
| 11 | Reply Reader ×4 (synthetic replies) | — | 544–547 | 16:02:44–16:02:51 | 3.0–6.1 s | 0 | 0.025 | 200 ×4, all four classes right |
| 6 | `ladder` "azure cloud migration dubai" (new head, `pages_now` 1) | 548 | 548 → 549 | 16:03:47–16:05:20 | 93 s | 0.1120 | 0.050 | completed (2 pages, `lad_mv8auur8kz49`) — **on a SERP that failed twice (R18, R23)** |
| 8 | `audit` technical, 200 pages | 550 | 550 → 551 | 16:03:49–16:08:22 | 4.6 min | 0.0900 | 0 | completed, health **83 "Good"**, 31 findings — **31 of 45 URL inspections failed (R19)** |
| 9 | `discover` (with "Keyword Report") | 552 | 552 → 553 | 16:03:51–16:05:47 | 1.9 min | 0.2662 | 0.158 | completed, pool 839 → 240 reviewed → 30 relevant |
| 7 | → the ladder's rung-2 page "azure api management monetization" (spawned) | 548 | 554 | 16:05:19–16:14:02 | 8.7 min | 0.0241 | 0.540 (0.394 estimated) | completed, 2,648 words, 3 images, **"did not pass the quality check — not ready to publish"** (R11) |
| 10 | → the follow-up keyword report "erp systems in uae" (spawned) | 552 | 555 | 16:05:41–16:08:49 | 3.1 min | 0.0221 | 0.100 | completed |
| — | Balance | — | — | 16:18:04 | — | — | — | $15.684953 (**−$0.550590**) |
| 12 | `ai_visibility` | 556 | 556 → 557 → 563 | 16:18:25–16:20:31 | 2.1 min | 0.7895 *(discarded)* | 0.101 | completed, 8 questions × 6 engines, **1 of 47 requests failed (2.1%), 2 of 3 retries answered** |
| 13 | `backlinks`, full | 558 | 558 → 559 → 564 | 16:18:27–16:19:21 | 54 s | 0.3728 *(discarded)* | 0.005 | completed, mode `full`, 17 farm links set aside, Google's link sample merged |
| 15 | Link Builder, paid, on demand | rr1014-lb-paid | 560 → 561 | 16:18:29–16:20:00 | 91 s | — | 0.047 | delivered with a **PDF** (L3), 8 qualified, 23 not fit, **9 drafts held** — but a rival pitched (R21) |
| G27 | Pre-release check (`/webhook/seo-prerelease`) | 562 | 562 | 16:18:31–16:18:34 | 3 s | 0 | 0 | **verdict `pass`, exit_code 0, "writes: none"**, 4 pages, 32 checks |
| 14 | `audit` Full SEO Report, 200 pages | 565 | 565 → 566 | 16:21:22–16:30:14 | 8.8 min | 0.4571 | 0.047 | completed, health **69 "Needs Improvement"**, 62 findings, **WHOIS $0 from the cache** (D7) |
| 16 | AI Pulse (Test Runner) | rr1014-pulse | 567 → 568 | 16:21:25–16:22:15 | 50 s | 0.0840 *(discarded)* | 0 | delivered, 21 answers |
| 18 | Rank Tracker (Test Runner) | rr1014-rank | 569 → 570 | 16:21:27–16:21:47 | 20 s | — | 0 | 6 ladder reports, SERP features + share of voice + mobile; **"peppol uae" moved to #47** |
| 19 | Content Cadence dry run | rr1014-cadence-dry | 571 → 572 | 16:21:29–16:21:29 | < 1 s | 0 | 0 | paused itself on the pile-up guard (3 written pages), wrote nothing |
| 17 | AI Growth (Test Runner) | rr1014-growth | 573 → 574 | 16:21:31–16:22:02 | 31 s | — | 0 | delivered, 12 pages scored (avg 77), 2 sent to Bing, 9 handed to the Link Builder |
| G11 | Page Watch (Test Runner) | rr1014-watch | 575 → 576 | 16:21:33–16:21:40 | 7 s | — | 0 | 25 of 45 pages watched, robots hash compared |
| — | Balance | — | — | 16:30:30 | — | — | — | $13.899879 (**−$1.785074**) |
| 21 | Audit Scheduler (Test Runner) → technical audit | rr1014-auditsched | 577 → 578 → 579 | 16:30:55–16:35:49 | 4.9 min | 0.0900 *(discarded)* | 0 | completed ("on demand" forces an audit), health 83 |
| 20 | Site Tracker (Test Runner) | rr1014-site | 580 → 581 | 16:30:58–16:32:03 | 64 s | — | 0.036 | delivered, 526 named queries, GA4 live, statistical alerts + annotations |
| — | Balance after | — | — | 16:40:42 | — | — | — | $13.847929 (**−$0.051950**) |

**47 executions (535–581), all 47 succeeded**, none running or in error afterwards. **23 callbacks reached the app**
(`site_description`, `content` ×3 = the verdict, the page and the keyword report, `ladder_plan`, `site_audit` ×2, `full_report`,
`ai_visibility` + `ai_visibility_started`, `backlinks` + `backlinks_started`, `link_builder`, `ai_pulse`, `ai_growth`,
`rank_tracker` ×6, `site_tracker`). The Keyword Check, Reply Reader and pre-release check are synchronous and have no callback.

Durations against 2026-10-13: describe 32 → 44 s, verdict 2.6 → 2.1 min, ladder 2.3 min → 93 s, content run 12.2 → 8.7 min,
technical audit 3.9 → 4.6 min, discover 1.9 min (same), keyword report 2.5 → 3.1 min, full report 6.9 → 8.8 min,
`ai_visibility` 2.5 → 2.1 min, backlinks 58 → 54 s, Link Builder 89 → 91 s, pulse 81 → 50 s, Rank Tracker 19 → 20 s,
AI Growth 20 → 31 s, Site Tracker 40 → 64 s, Audit Scheduler 4.0 → 4.9 min.

**Protocol runs not exercised, and why:**

| Protocol / §5.2 addition | State | Reason |
|---|---|---|
| 2 (publish + activate the Reply Reader) | n/a | already published and active since 2026-10-11 |
| `published` for a page that is really live | **not exercised** | nothing the system wrote has been published; a `published` row would be false (O9) |
| The October Search Console check-in | **not exercised** | only the owner can answer it; invented answers are forbidden (O5) |
| A `profile` write with real data, then a content run that uses it | **not exercised** | no real author / reviewer / address on file (O1, O2). This also leaves **G31 (style guide)** unexercised: the page run carried `style_guide: null` |
| The error path into the alert channel | **not exercised** | the Slack webhook is baked into the deployed Error Handler (`Alert Channels` CFG, host `hooks.slack.com`), but no workflow failed during the run. Deactivating and re-activating `SEOagentConsole1` through the public API at 16:37 UTC — the IMAP trigger whose credential is missing — did **not** raise an error execution this time, so **R5's trigger-mode fallback and R6's `delivered` write-back have no evidence from this run**. The last `seo_ops_alerts` row (2026-10-13 17:52, exec 532) shows R5's detailed message but still `delivered: "pending"`, `channels: "email,data_table"` — written before this deploy. **G21's delivery rate therefore remains unmeasured.** |
| The app UI in an owner session (Playwright) | **not exercised** | driving the owner's account needs the owner's own session; refused as impersonation, as in the 2026-10-08 and 2026-10-13 runs. **G15 (expiring share links) and the app side of G12 / G21 / L4 / L7 are therefore unexercised** |
| The audit / keyword / backlink modes on two more owner-named sites | **not exercised** | no second site was named |
| A second full report for the domain-age cache (D7) | **done** — run 14 is that second report: `whois_requests: 0`, `looked_up: 0`, all three ages served from `seo_cache` |

---

## 2. Findings by feature

### 2.1 Site description, site model and Keyword Check (runs 3, 5)

`describe` (538, 44 s) read 6 pages, produced 28 services and the canonical host `www.techand.ai`; `seo_pages` holds the 45-page
inventory and `seo_sites` the name "Tech&", the real DAFZA address and phone. **P2-1 and P2-2 hold**: the nav list comes from the
site model and `services_json` is populated (28 entries, re-saved after the description).

The three Keyword Checks all returned `fit: 2` with `fit_known: true` — **R3 is fixed**: on 2026-10-13 one of these same three
keywords shipped `fit: null` from a parser error. Each charged $0.026 and answered in 6.2–6.5 s.

But two of the three ("business central partner uae", "dynamics 365 partner uae") came back with `volume: null, kd: null,
intent: null, cpc: null` — DataForSEO has no data for them in the UAE — and were still labelled **"Reachable for your site ·
Short ladder · 4-8 months"** with "estimated chance fair (30-50%)". The missing data appears only in `warnings`. That is **R26**.

Small residual: in `discover`'s Search Console rows the derived `answered_by.url` is carried straight from Google's bare-host URL
(`https://techand.ai/insights/…`) for `page_mismatch` rows while the `striking` rows use the canonical `www.` form — the same list
mixes hosts. Google's own data is bare-host, but `answered_by` is our field (D15 residual).

### 2.2 Keyword verdict (run 4)

Execution 540, GO_WITH_CHANGES **58**. **P2-5 proven**: `existing_page_action: "improve"` with the matched page
`https://www.techand.ai/insights/top-peppol-e-invoicing-software-features-every-uae-cfo-must-look-for` (`matched_by: "slug"`,
`source: "page inventory"`), and every change is phrased "On the same URL, …". **R7 proven**: the word "FAQPage" appears nowhere
in the verdict; it asks for "an FAQ section with question headings". **D26 / D20 proven**: "An AI Overview **was seen in the
check at 16:03 UTC on 2026-10-14**, citing tax.gov.ae, zoho.com and tallysolutions.com" — an observation with a timestamp, not an
assertion. **G3 proven**: dated, sourced reasoning (the 30 Oct 2026 ASP date, the 1 Jan 2027 mandate, a trend from real monthly
figures). **G33 proven**: a coverage target of 90% against the best-ranking page (youngandright.ae, 22 of 22 terms, 1,357 words)
with the basis spelled out.

### 2.3 Keyword ladder and the page it wrote (runs 6, 7)

This is the weakest run of the set.

`SERP Top 10` and `Facts SERP` both returned DataForSEO `status_code 40101 "Internal SE Server Error."` **inside HTTP 200**, were
billed $0.002 each, and **ran once — no retry** (**R18**). `Keyword Data` returned `items_count: 0`. The keyword pool was
therefore **1 keyword**: `pool_size: 1, ai_reviewed: 1, relevant: 1`. On that basis the run produced a 2-page ladder, a
feasibility verdict of **"winnable", GO_WITH_CHANGES 68**, and spawned a page — the single rung being
**"azure api management monetization"** (volume 10, informational, quarterly trend −100%), which is neither cloud migration nor
UAE (**R23**). The report does say so plainly in its reasons ("The live Google results could not be checked because the data
provider failed… the verdict rests on assumptions about the competition") — the honesty is there, the refusal is not.

The top page got `target_words: 1800` with `target_words_source: "the competitor analysis"`; the rung row got **`target_words: 0`**
and passed `ladder_words: 0` to the page run (**R22**). **R7 holds here too** — "Add an FAQ section with question headings… Add
Service and Breadcrumb schema", no FAQPage.

The page (554, 8.7 min) is the best evidence in the run:

- **R11 proven end to end.** Round 1 reported "needs another editing round"; round 2 exhausted `qa_max_rounds` and reported
  `passed: false, publishable: false, not_ready: true`, label **"did not pass the quality check — not ready to publish"**, with
  the **last** round's counts and six named reasons, the note "The editor had 2 round(s) and the page still fails the checks
  above: it is delivered as a draft to finish by hand". The file name is `…-2026-10-14-**DRAFT**.doc`.
- **R15 proven.** `ladder_target_url` and `content_brief_slug` are both `azure-api-management-monetization`, the slug the ladder
  planned, and the planned ladder link is in `content_links_to_add` (not inserted into the body).
- **G5 proven.** `Originality Check` compared 2,489 eight-word windows against 8 pages (6 competitor, 2 own): highest overlap
  **0%**, with the basis stated.
- **G30 proven.** Three images rendered with alt text, captions and file names.
- **G33 proven.** Coverage 88% against a 90% target and a named best competitor (whizlabs.com, 94%), with the missing terms and
  the missing subtopic listed.
- **D9 / D15 proven.** Every internal link in the body points at a live page on `www.techand.ai`; nothing links to an unwritten
  ladder page.
- **G31 not exercised**: `style_guide: null`, `style_notes: []` — no style guide on file.

Two problems remain in the delivered draft: it is **2,648 words against its own 1,800 target (+47%)** after two editor rounds
(R22's consequence), and it still contains one masked figure in the body — "Microsoft's highest APIM SLA (`[Statistic]`) applies
to Premium deployments" — counted in `placeholder_count: 1` but not named in the reasons the owner reads (**R25**). The 11
remaining brackets are all in the byline / author box / Person schema and are correctly attributed to the empty profile (O1).

### 2.4 Technical audit, Audit Scheduler and the full report (runs 8, 21, 14)

**R10 proven, both halves.** `mobile_bad: 0, mobile_checked: 0, mobile_not_checked: 14`, with the note *"Search Console no longer
answers mobile usability (Google retired the Mobile Usability report), so it was not checked."* No mobile finding appears in
either report. Every finding's impact basis is capped: the Schema finding carries
`impact_traffic: {clicks: 26, impressions: 5282, capped: true, property_totals: {clicks: 34, impressions: 5282}}` and the basis
text says "capped at everything the whole website measured in that period: the pages affected cannot put more at risk".

**R2 proven.** The diff is `site_audit` vs `site_audit` (`report_type` on both sides), 2 days apart, with
**`not_compared: ["Schema"]`** — the finding that used to be reported "new" at every audit is now excluded by category.

**G14 proven.** Five key pages read twice (`rendered_source: "render_service"`), six figures compared per page (title, H1,
canonical, robots, link count, word count). One page differed, and it produced the only genuinely new finding of the diff:
"AI crawlers see a different version of 1 key page(s)" (Medium).

**G26 / G18-2 proven.** The list is ordered by impact with the method printed in full, and **6 minor items are folded into one
line** with "Nothing is left out of the score or of the stored findings".

**G7 / CrUX**: the API is now enabled (`api_enabled: true`) and answers honestly — *"the Chrome UX Report has no field data for
this address (too few real-user visits in the last 28 days)"*, per template and per device, with the reason and what would change
it. The owner's action is done; the site is simply too small for field data.

**G25 / D7 in the full report**: all 45 key pages inspected, `failed: 0`; `Domain Ages` reports `whois_requests: 0, looked_up: 0`
— three ages served from `seo_cache` (D7's second-report path, now proven). **G29 proven**: `lineage` labels every figure with
source, how it was obtained, period, sample and `measured` / `modelled` / `estimated`. **G24 proven**: crawl coverage printed.

Three defects here:

- **R19.** In the technical audit 31 of 45 URL Inspection calls failed with Google's "Internal error encountered." and **were not
  retried**; the audit's whole indexing picture rests on 14 pages. The diff then reports the indexing finding as improved —
  `affected 4` against `affected_before 15` — with no word that the sample shrank from 25 pages to 14. Eighteen minutes later the
  full report inspected all 45 with **0 failures** and found **18 of 45 not indexed**, ranked it first by impact, and said
  "18 of 47 crawled pages". Two reports delivered to the same customer within half an hour say "4 pages" and "18 pages".
- **R24.** The audit reports a Schema finding ranked 8th by impact ("Structured data with errors", 26 of 47 pages) while
  `not_assessed` states "Structured data (schema) and HTML-level checks" was not assessed, and `Schema` is in neither
  `category_scores` nor `weights`. R2's `not_compared` is a third statement about the same category.
- **R28** (below): exec 579 reports `dfs_usd 0.09 measured` for a window in which the balance moved $0.052 in total.

The Audit Scheduler itself behaved: `run: true, why: "on demand"`, sitemap fingerprint refreshed (`1eb0as2`, 45 entries), and the
P34-5 heavy-run guard did not misfire because the two heavy audits were sequenced.

### 2.5 Discovery and the keyword report (runs 9, 10)

**G8 proven.** 300 Search Console rows pulled, 108 considered, with the drop reasons counted (`brand 9, low_impressions 26,
duplicate 157, scraper 0`), 10 seeds taken from real queries, SERP-overlap clusters and a measured reach.

**R12 proven.** Rows whose impressions belong to a live page now carry `answered_by` with `matched_by: "impressions"` and the
label *"the page that gets the impressions does not target this search (you rank #20.4 with it)"* — the exact wording the fix
specified. "No page answers this" is no longer printed for a query the site ranks for.

**R13 proven in the negative, not in the positive.** `by_intent.navigational` is **empty** and `refused: []` — nothing had to be
refused, because the AI relevance pass cut 839 candidates to 30 before the gate. The full report's §4a intent lists, where R13's
original complaint lived, were **empty this run**: `Ranked Keywords` legitimately returned `total: 0` for techand.ai, so the gate
had nothing to run over. R13's acceptance test is therefore only partly exercised.

**G32 proven.** `topic_radius` evaluates each topic against the site's reach with a verdict, a reason and evidence
("difficulty 24 against your reach 10 · you already have a page on it: …/dynamics-365-business-central-uae · 2,290 searches a
month across 6 keyword(s)").

### 2.6 AI visibility, AI Pulse and AI Growth (runs 12, 16, 17)

**D19 / G1 proven on this path.** 47 requests, **1 failure (2.1%)**, `retried: 3, retry_answered: 2`, and the report's own second
line says so: *"1 of 47 requests failed this run (2.1%), 2 of 3 answered when they were sent again: Google AI Mode — Internal SE
Server Error.."* This is the same DataForSEO in-200 error class that the ladder run silently accepted (R18) — the retry gate
exists here and nowhere else.

**R14 proven.** The market table carries `you: null` — the owner's row is gone. On 2026-10-13 it credited the owner with 19,579
citing answers from a 4-character name match beside its own "0 AI answers cite you".

**P34-3 proven.** `fact_check: "no_facts"` with the note *"What AI says about you was not checked: nothing on file can judge what
the answers claim — fill the business profile…"*. **P34-6 proven**: the report says "Tech&" throughout, never "techand.ai".
**G10 remains blocked on the owner**, by design.

Honest reporting elsewhere: mention rate 0% with a 95% Wilson range 0–4.9%, `aio_presence: 100` with `aio_citation_rate: 0`,
brand recognition 4 of 5 engines, sentiment 75, and the cited URLs per question with the engines that cited them.

**AI Growth** delivered 12 pages scored (average 77, "was 78"), 2 pages submitted to Bing, 15 pages AI cites without naming the
owner, **9 handed to the Link Builder "(one writer)"** — D12/D13's single-writer rule holding — and 6 questions queued, one of
them explicitly "written as the keyword ladder page … (one search, one page)". IndexNow still waits for the key file (O6).

### 2.7 Backlinks and Link Builder (runs 13, 15)

**D3 / P1-2 / G18-1 proven.** 17 link-farm links set aside with their domains named, no false "lost" ("every linked page works"),
and the genuine links on top: peppol.org (value 35/25/44, authority 594 · DR 77) and tracxn.com (nofollow, correctly labelled).
**O7 is done and visible**: the source table lists "Google Search Console (upload) — 1 referring site, export of 2026-10-14"
beside DataForSEO, Bing Webmaster ("connected; Bing reports no links to this site yet"), GA4 referrals and the Common Crawl
release, with a coverage comparison between Google's sample and DataForSEO's index. The new Ahrefs key returns DR for both links.

One wrinkle: the 17 farm links are excluded from "best links", "lost" and the referring-site drop, but the anchor-text table still
prints their anchor ("High Quality Dofollow Backlinks DA 50 PA 40 Premium PBN Network Service", 17 referring domains) while the
percentages above it (67% / 33%) are computed without them. Not numbered — the farms are labelled on the same screen — but the
two halves of that block are computed on different sets.

**Link Builder: L3 proven** (a rendered PDF in the callback, `pdf_ready`, `pdf_file_name`). **L5 proven** (podcast sources: one
show found, with episode count and last episode date) — though its evidence quote is broken (**R27**). **P34-1 proven**:
"Pitches drafted this week — **no new pitches this week**", with the 9 held drafts listed separately and each one's hold reason
("needs you: [Your name]", "the first e-mail quotes nothing that is on their page", "only their homepage was found: a front page
has no section a link could be added to"). **L2 / draft-gate proven**: the report states the five checks every pitch passes.
**P34-2 proven**: the listings checklist reports "Not listed yet 2" rather than claiming a "Tech&"-prefix match.

But **R21**: of the 8 qualified prospects (6 `ready`, 2 `needs_contact`; 23 refused as `not_fit`), three sell what the owner
sells — **`invoiceq.com`** (`ae.invoiceq.com` was recorded as a SERP competitor **above** techand.ai for "peppol uae" on
2026-10-12 and again on 2026-10-14, in `seo_rank_history.competitors_json`), `deloitte.com` (same Dynamics/ERP services, 54%
topic match) and `alaan.com` (UAE e-invoicing fintech, 65%). Two of them, `invoiceq.com` and `deloitte.com`, are among the nine
drafted pitches waiting for the owner's edit. `sap.com` was correctly refused as `not_fit`, so the gate works — it just does not
reduce a recorded competitor host to its registrable domain.

**L6 and L7 not exercised**: `asset_ideas: 0` this run, and the subject-line A/B has no sends to compare (G16 is still open).

### 2.8 Rank Tracker (run 18)

**G6 proven in full.** Six ladder reports with, per keyword: the SERP features seen ("AI Overview · PAA"), modelled share of voice
**with its CTR curve and assumptions printed** ("Not measured clicks"), a mobile position checked separately, the competitors
above the site marked when they are on the owner's list, and a timed AI Overview observation
("AI Overview seen in 2 of 2 checks (seen in the check at 16:21 UTC on 2026-10-14…)") naming what it cited.

**D16 proven**: "The main page is live: improve the main page 'peppol uae' — it is https://www.techand.ai/insights/…".
**R1's read path proven**: every unpublished rung is printed as "(not published yet: checked monthly, last …)" and no rank check
was bought for it.

**Real outcome:** "peppol uae" moved from *not in top 50* to **#47**.

**R16 is still present in effect.** `set_aside_pages: []`, and the rung **"facts erp"** — another company's brand — is still
planned and still printed in the "erp software uae" report. The read-path gate exists but does not catch it, exactly as
`fix_brand_rungs.py`'s dry run predicted (facts.ae is not a declared competitor). Nothing has set it aside.

### 2.9 Content Cadence dry run (run 19)

**D5 and R1 proven together.** The cadence paused itself: *"3 written pages waiting for publication (pile-up guard, limit 3):
'erp software uae', 'service industry erp software', 'azure api management monetization' — publish them to continue"*. Those are
**exactly** the three `seo_content_log` rows with `status: "written"` — while `seo_ladders` still shows **6** rows at
`status: "writing"`. R1's rule (count a page written only on a `written` content-log row) is doing the work; the stale ladder rows
have not been repaired, because `fix_phantom_pages.py` has not been run.

The queue behind the pause is correct and ladder-aware (4 upcoming ladder keywords with their rung and head term).

### 2.10 Site Tracker (run 20)

The richest report of the run, and all of it on real Google data now that the service account has Full access.

**G28 proven**: *"Both rises are statistically real."* — 34 clicks (+79%) and 5,282 impressions (+240%) tested, not just printed.
**G9 proven**: brand/non-brand split (4 brand, 3 non-brand clicks), 526 named queries, "28.5% of impressions come from queries
Google does not name". **G29 proven**: every block carries its source, period, sample and measured/modelled label, GA4 property
included. **P2-4 proven**: no "(undefined days)" anywhere. **R1 proven again**: "Three written pages are waiting to be published",
"all other ladder pages are not published yet".
**G12 proven in part**: a "What happened in this period" table marks the September 2026 core update and the audit-fix events, and
states that every dashboard chart carries those dates.

**R20**: that same annotation table chains audit health scores across report types. On 2026-10-11 it prints, as three same-day
events, "Technical audit health 80 → 68 · 24 more findings", "Audit fixes: 24 findings gone — health 68 → 80 · 24 fewer
findings" and "Technical audit health 80 → 80 · the same findings". `seo_audits` shows why: `aud_mv40gi8ky3f` (site_audit, 80),
`aud_mv40sm450bi` (**full**, 68), `aud_mv40zsz7lmm` (site_audit, 80). D2's unlike-report comparison, fixed in the audit's own diff
(R2), survives in the annotation feed.

### 2.11 Guards, ledger, cost and operations (across every run)

**G23 proven where it runs.** Every main-workflow ledger row carries `cost_basis` in plain words and keeps measured and estimated
money apart — e.g. the page run: *"Claude $1.1862 ESTIMATED (… at the Anthropic list prices (3 streaming node(s) report no token
usage: Copywriter, Editor, Strategy Brief)); DataForSEO $0.0241 measured"*; the ai_visibility front-door branch correctly says
*"$0.9500 ESTIMATED (the per-mode reservation: no DataForSEO task reported a cost in this run)"* rather than pretending to
measure. The recalibrated per-mode estimates are visible and closer than before (`cost_estimate_basis: "the shipped estimate for
ladder + describe (no settled run of this mode yet)"`, `run_number_today`, `dfs_budget_used_est_usd`, `ai_budget_used_est_usd`).

**D1 holds**: 23 ledger rows for the day, the daily AI estimate never approached the $6 cap ($2.0 of $6), and no run was refused —
so **R1's refusal path is not exercised** by this run.

**R17 is the big one.** Every one of the nine monitor workflows writes its ledger row at the **end** of the run, as `reserved`,
and never settles it. Exec 568 (AI Pulse) is the proof: `Ledger Settle (Pulse)` ran at 16:22:15.507 and output `{}` (it matched no
row, because none existed), then `Ensure Run Ledger (Pulse)` → `Run Ledger Row (Pulse)` → `Reserve Run Ledger (Pulse)` ran at
16:22:15.532–.584 and inserted row id 68 with `status: "reserved", settled_usd: 0`. The reserve branch *is* wired off `AI Plan`,
but n8n's v1 execution order runs that branch last, after the whole paid pipeline. The consequence is threefold: the budget guard
never sees a monitor run before it spends; the row counts against the daily cap until the 2-hour stale release clears it; and the
measured figures those settle nodes computed — ai_visibility **$0.7895**, backlinks **$0.3728**, pulse **$0.0840**, the scheduled
audit **$0.0900** — are discarded. Today's ledger shows six such orphans (563, 564, 561, 570, 572, 574, 568, 578, 579) plus the
one left by the 14:51 scheduled pulse.

**R9 is therefore only half fixed**: the monitors now *compute* a DataForSEO figure, but the Rank Tracker, Site Tracker, AI Growth
and Link Builder still compute **$0** while spending real money (the Rank Tracker alone wrote 11 new `seo_rank_history` rows, one
paid SERP check each).

**R28**: the per-run "measured" figures do not reconcile with the balance — +11.6% in window A, −4.6% in B, **+73% in C**, and the
Keyword Check settles `dfs_usd: 0` while telling the caller `cost_usd: 0.026`.

**R5 / R6 / G21 not exercised** — see §1's table. `seo_ops_alerts` still has 4 rows, all `delivered: "pending"`,
`channels: "email,data_table"`.

---

## 3. Defect status

### 3.1 The 2026-10-11 defects (D) and the later live defects (P1, P2, G18, P34, R)

| ID | Verdict | Evidence from this run |
|---|---|---|
| D1 guards undercount | **gone** | 23 ledger rows for the day in one shared table, concurrent runs counted; main-workflow rows reserve → settle correctly |
| D2 audit diff of unlike reports | **partly** | the audit's own diff is like-for-like with `not_compared: ["Schema"]` (551) — but the Site Tracker's annotation feed still chains a full report's 68 with technical audits' 80 (**R20**) |
| D3 PBN pages as best links | **gone** | 564: 17 farm links set aside, peppol.org top |
| D4 government navigational queries | **gone** | 553: `by_intent.navigational` empty; 566: no .gov in the gap; 561: no ministry pitch |
| D5 pile-up guard undercounts | **gone** | 572 counted all 3 written pages and paused |
| D6 false "www not consolidated" | **gone** | absent from both audits (551, 566) |
| D7 RDAP / paid WHOIS | **gone** | 566: `whois_requests: 0`, three ages from cache (the second-report path) |
| D8 competitor brand as a rung | **partly** | no new brand rung in 549 — but the stored "facts erp" rung is still planned and printed (**R16**) |
| D9 hub links to unwritten pages | **gone** | 554: every body link is a live page; planned links held in `content_links_to_add` |
| D10 page not publishable | **gone, and now labelled** | 554: 0→1 body placeholder (was 50), real NAP available, and the gate now says the draft is not ready (R11) |
| D11 blind to existing pages | **gone** | 540 `improve` an existing URL; 553 `covered` list; 581 index status per ladder page |
| D12 AI Growth drafts to government / competitors; second writer | **gone** | 574: 9 prospects handed to the Link Builder, "(one writer)", no .gov |
| D13 Link Builder "techand", competitor / homepage / list pitches | **partly** | "Tech&" everywhere, listings honest, `sap.com` refused — but `invoiceq.com`, `alaan.com`, `deloitte.com` are `ready` (**R21**) |
| D14 Reply Reader invents a fact | **gone** | 544–547: all four classes right, `unverified: []`, out-of-office return date parsed to 2026-10-26 |
| D15 no shared canonical host | **gone (one residual)** | `www.techand.ai` in the model, the page body, Bing/IndexNow and the ladder rows; residual: `answered_by` carries Google's bare host in `discover` |
| D16 wrong next step | **gone** | 570: "The main page is live: improve the main page 'peppol uae'" |
| D17 fix-pack robots.txt | **gone** | 566's fix pack (7 files) ships a robots.txt that keeps `Disallow: /api/`, `/admin/`, `/private/`, says "# Changes: none needed" and uses the canonical host |
| D18 `theme-color` as duplicate meta | **gone** | absent from both audits |
| D19 AI request errors, no retry | **gone on the AI path** | 563: 2.1% error rate, 3 retried, 2 answered, disclosed in the report. **Not fixed off that path** (**R18**) |
| D20 discovery: overlap, AI Overview text, float CPCs | **gone** | 553: duplicates counted and dropped; timed AI Overview wording in 540 / 570 |
| D21 sparse Trends % | **gone** | 581's Trends block prints "too little search volume for a trend — " for all four keywords instead of a "+1,200%", and labels the index "a relative index (100 = the peak of the period), not a count of searches" |
| D22 site description reads only the homepage | **gone** | 538: 6 pages read, 28 services, Business Central present |
| D23 Ahrefs DR not retried; off-topic gap domains | **gone** | 564: DR 77 / 79 returned; no sister-domain prospects |
| D24 full report small inconsistencies | **partly** | scraper queries and the duplicate author finding are gone; the two reports of the same hour disagree on indexing (**R19**) |
| D25a missed scheduled runs | **open (owner)** | still Mac-hosted |
| D25b one alert channel | **not exercised** | the Slack URL is baked into the deployed Error Handler, but nothing failed (see §1) |
| D25c test check-in row | **open (owner)** | unchanged |
| D26 AI Overview stated as fact | **gone** | 540 / 570: "was seen in the check at …" |
| P1-1 ledger rows never settle | **partly** | every main-workflow mode settles (`describe`, `backlinks`, `ai_visibility` all `done`) — but every **monitor** row is left `reserved` (**R17**) |
| P1-2 farm pages in "lost" | **gone** | 564: no lost list, no referring-site drop alert |
| P1-3 scraper regex | **gone** | 551: `scraper_queries` 0, drop reasons counted |
| P1-4 brands in §4a opportunities | **not exercised** | §4a was empty (0 ranked keywords for techand.ai) |
| P1-5 raw float CPCs | **gone** | 540 / 553 print rounded CPCs (13.37, 13.98) |
| P2-1 nav list from the wrong node | **gone** | 538: nav pages from the site model |
| P2-2 empty `services_json` | **gone** | 28 services stored |
| P2-3 bare-host URLs | **gone (one residual)** | see D15 |
| P2-4 "(undefined days)" | **gone** | 581: real day counts |
| P2-5 verdict blind to the inventory | **gone** | 540: `improve` the matched URL |
| P2-6 author box invisible to the gate | **gone** | 554: `profile_placeholders: 11` counted and named in the failure reasons |
| P2-7 no word-count target on a page run | **partly** | the clamp works where a target exists — but the rung row carried `target_words: 0` (**R22**) and the page shipped +47% |
| G18-1 search page as the best link | **gone** | 564: peppol.org first, no SERP page in the list |
| G18-2 cosmetic findings reported | **gone** | 551: 6 minor items folded into one line, nothing dropped from the score |
| P34-1 stale drafts counted as new | **gone** | 561: "no new pitches this week", 9 held drafts listed with their reasons |
| P34-2 "Tech&" prefix match on listings | **gone** | 561: "Not listed yet 2", no false "listed" |
| P34-3 fact check on no facts | **gone** | 563: `fact_check: "no_facts"` with the reason |
| P34-4 ministry / link-seller gap pitches | **gone** | 566 and 561: none |
| P34-5 concurrent heavy audits, stuck rows | **partly** | the two heavy audits were sequenced and both finished; `Release Stale Runs` ran in every main-workflow run (`ledger_stale_released: 0`) — but the monitors create new permanently-`reserved` rows (**R17**) |
| P34-6 monitors call the business "techand.ai" | **gone** | 563 and 564 say "Tech&" |
| R1 refused run leaves a phantom page | **partly** | the read path is proven on all three consumers (cadence, Rank Tracker, Site Tracker count only `written` content-log rows). The **refusal path itself was not exercised** — no run was refused — and the 6 stale `writing` ladder rows are still there (`fix_phantom_pages.py` not run) |
| R2 "not assessed" categories reported new | **gone** | `not_compared: ["Schema"]` — though the same report still ships a Schema finding (**R24**) |
| R3 Keyword Check ships `fit: null` | **gone** | all three checks returned `fit: 2`, `fit_known: true` |
| R4 competitor passes as a prospect | **still present** | `invoiceq.com` pitched although `ae.invoiceq.com` is a recorded SERP competitor (**R21**) |
| R5 error handler loses a trigger failure | **not exercised** | no error execution during the run |
| R6 `delivered` never written back | **not exercised** | same; all 4 `seo_ops_alerts` rows still `pending` |
| R7 FAQPage recommended | **gone** | 540 and 549 ask for an FAQ *section*; "FAQPage" appears nowhere |
| R8 rung pages carry no word target | **still present** | rung row `target_words: 0`, spawn `ladder_words: 0` (**R22**) |
| R9 budget guard blind to the monitors | **partly** | the monitors now compute a figure and carry `dfs_est_usd` — but the row is written after the spend and never settled (**R17**), and four monitors still compute $0 |
| R10 "no data" as a High mobile finding; uncapped impact | **gone** | "not checked" with the retirement note; `capped: true` with `property_totals` |
| R11 failed QA shipped silently | **gone** | "did not pass the quality check — not ready to publish", last round's counts, `-DRAFT` file name |
| R12 "no page answers this" about a ranking page | **gone** | `answered_by` + `page_mismatch` with the position |
| R13 brands and off-topic in §4a / the gap | **partly** | `navigational` empty in discovery; §4a was empty this run so the gate had nothing to refuse |
| R14 false owner row in the AI market table | **gone** | `market.you: null` |
| R15 ladder page loses its slug and links | **gone** | planned slug kept, both planned links in `links_to_add_when_published` |
| R16 stored brand rung still planned | **still present** | "facts erp" still planned and printed; `set_aside_pages: []` |

**Score of the re-check.** Of the **28 D items**: 20 gone (two of them with a named residual), 5 partly, 1 not exercised
(D25b), 2 open on the owner (D25a, D25c). Of the **20 later live defects** (P1, P2, G18, P34): 16 gone, 3 partly, 1 not
exercised. Of **R1–R16**: **8 gone, 3 partly, 3 still present** (R4, R8, R16) and **2 not exercised** (R5, R6).

Put together: **44 of the 64 defects on the register are now proven gone by a real execution**, 11 are partly fixed with the
remainder named below, 3 are unchanged, 4 could not be exercised and 2 remain the owner's.

### 3.2 Which of the deployed fixes this run proves

**Proven by a real execution (first time live):** R2, R3, R7, R10, R11, R12, R14, R15 · G5 (originality), G7 (CrUX enabled and
honest), G8 (discovery inputs), G11 (Page Watch), G12 (annotations, in part), G14 (render diff), G23 (measured vs estimated
money), G24, G25 (45 of 45 inspected in the full report), G26, G27 (pre-release check), G28 (statistical alerts), G29 (lineage),
G30 (images rendered), G32 (topic radius), G33 (coverage target) · L2, L3 (PDF), L5 (podcast sources) · and the owner's own
unblocking: the Search Console service account (526 named queries, 45 URL inspections), GA4 (83 organic sessions), the CrUX API,
Bing Webmaster, Ahrefs DR and the Search Console link export (O7).

**Deployed but NOT exercised by this run:** R1's refusal path · R5, R6 and G21 (no failure occurred; the Slack channel is
configured but untested) · G31 (no style guide on file) · G15 and the app-side halves of G12 / G21 / L4 / L7 (no owner session) ·
G13, G16, G17, G20, D25a (open by design) · L6 (no asset ideas this run) · D17, D21, P1-4 (the code paths did not come up) ·
`fix_phantom_pages.py` and `fix_brand_rungs.py` (not run).

### 3.3 New defects (R17 onwards)

| ID | Title | Impact | Where | Fix |
|---|---|---|---|---|
| **R17** | **Every monitor workflow writes its ledger row at the end of the run and never settles it**, so the budget guard never sees a monitor before it spends, the row stays `reserved` until the stale release, and the measured cost the run computed is thrown away. Exec 568: `Settle Run Ledger (Pulse)` at 16:22:15.507 → `{}`, `Reserve Run Ledger (Pulse)` at 16:22:15.584 → a new `reserved` row. Same shape in 563, 564, 561, 570, 572, 574, 578, 579 (every row's `created_at` equals the workflow's stop time). $1.394 of the run's $2.388 is attributed to no settled row | **High** | `build_monitors.py` / `build_site_tracker.py` / `build_ladder_extras.py`: the reserve chain hangs off a node whose other branch is the whole pipeline, and n8n's v1 execution order runs it last | put *Ensure / Row / Reserve Run Ledger* on the **main** path before the first paid call, and wire the settle strictly after it; add a build-time assert that a settle node's start time can never precede its reserve |
| **R18** | **DataForSEO task errors inside HTTP 200 are not retried outside the AI path.** In 549 both `SERP Top 10` and `Facts SERP` returned `status_code 40101 "Internal SE Server Error."`, were billed $0.002 each, ran once, and the ladder was planned, scored "winnable 68" and a page written on an unchecked SERP | **High** | the main workflow's SERP / Labs HTTP nodes; the only in-200 retry gate is `v5/code/AI_Retry_Requests.js`, used by AI Visibility and AI Pulse | generalise the retry gate (re-send the failed tasks once after a pause) to every DataForSEO node; where a retry still fails, mark the run's SERP evidence `unavailable` and refuse to emit a feasibility score that depends on it |
| **R19** | **31 of 45 URL Inspection calls failed ("Internal error encountered.") with no retry**, so the technical audit's indexing picture rests on 14 pages — and the diff reports it as improved (`affected 4` vs `affected_before 15`) without saying the sample shrank from 25 to 14. The full report 18 minutes later inspected all 45 with 0 failures and found 18 of 45 not indexed | **High** | `GSC Audit Requests` / `Parse Inspection` in `build_v4.py` (no retry); `Audit_Diff` (compares counts from unlike samples) | retry a failed inspection once; carry `checked` into the finding and the diff, and when the sample size changes by more than a threshold say so instead of reporting a delta |
| **R20** | **The Site Tracker's annotation feed chains audit health scores across report types**: on 2026-10-11 it prints "Technical audit health 80 → 68 · 24 more findings", "Audit fixes: 24 findings gone — health 68 → 80" and "Technical audit health 80 → 80" as three same-day events, because a full report (68) sits between two technical audits (80). D2 fixed in the audit's own diff, alive here | Medium | `v5/code/_annotations.js` / `Site_Plan.js` — the audit history is read without filtering by `report_type` | filter `seo_audits` by report type before computing a delta, and label an audit-type change instead of reporting it as a score move |
| **R21** | **R4's competitor gate misses a rival on a subdomain.** `ae.invoiceq.com` is in `seo_rank_history.competitors_json` as ranking above techand.ai for "peppol uae" (2026-10-12 and again 2026-10-14), and exec 561 still produced a `ready` brand-anchor pitch asking `invoiceq.com` to link to the homepage — one of the nine drafts now waiting for the owner. `deloitte.com` (54% topic match) and `alaan.com` (65%) are also `ready`; `sap.com` was correctly refused | Medium | `v5/code/_outreach_kit.js` `rivalOf`, `LB_Plan` | reduce every `competitors_json` host to its registrable domain before matching, and treat a prospect page that sells the same service as a rival whether or not it is on the declared list |
| **R22** | **A rung row still carries `target_words: 0`**, so the spawn passes `ladder_words: 0` and P2-7's clamp protects only the top page (which got 1,800 "from the competitor analysis"). The page then shipped **2,648 words against 1,800 (+47%)** after two editor rounds | Medium | `v5/code/Ladder_Plan.js` rung rows; the length clamp in the QA / editor loop | when a rung keyword has no SERP length data, fall back to the top page's target or the competitor average — never 0; make an over-length draft an explicit editor instruction, not only a QA reason |
| **R23** | **A whole ladder was planned, scored and written from one keyword.** `pool_size: 1, ai_reviewed: 1, relevant: 1`; the single rung is "azure api management monetization" (volume 10, informational, trend −100%) under the head "azure cloud migration dubai" — a different topic and no UAE. The verdict was still "winnable / GO_WITH_CHANGES 68" although the keyword data was empty and both SERP calls had failed | Medium | the ladder path in `build_v4.py`; `Ladder_Pool.js` / `Ladder_Plan.js`; `_radius.js` is not applied to rungs | refuse to emit a plan (and to spawn a page) when the pool is below a minimum or the SERP could not be checked; run the topic-radius test on each rung against the head topic, as discovery already does |
| **R24** | **The audit says three different things about schema in one report**: a Medium finding ranked 8th by impact ("Structured data with errors", 26 of 47 pages), `not_assessed: ["Structured data (schema) and HTML-level checks", …]`, and `audit_diff.not_compared: ["Schema"]`. `Schema` is in neither `category_scores` nor `weights` | Low | `Build Site Issues` / `Audit_Row.js` / the audit's category set in `build_v4.py` | pick one: either assess, weight and compare Schema in a technical audit, or do not emit its findings there |
| **R25** | **A masked figure is left in the delivered body and not named to the owner**: "Microsoft's highest APIM SLA (`[Statistic]`) applies to Premium deployments". `placeholder_count: 1` counts it; the failure reasons list only the 11 profile brackets | Low | `v5/code/Content_QA.js` | list body placeholders in `reasons` whenever any remain, not only above `placeholder_max` |
| **R26** | **A Keyword Check with no search data still returns a confident label.** "business central partner uae" and "dynamics 365 partner uae": `volume/kd/intent/cpc` all null, label "Reachable for your site · Short ladder · 4-8 months", chance "fair (30-50%)". Only `warnings` says the data is missing — the same gap R3 closed for `fit` | Low | `v5/code/Assess_Result.js` | carry "no search data" into `label`, and widen or suppress the chance band when volume and difficulty are unknown |
| **R27** | **The podcast source quotes a raw HTML fragment from an unrelated page**: the report prints `They say: "b-0"> Efficient Hiring Process We respect your time by managing streamlined, back-to-back interview schedule…` as the evidence for "Alchemy Uncensored" (29% topic match) | Low | `v5/code/_podcast.js` | strip attribute fragments, and take the quote from the show's own description; raise the topic bar for a show offered to the owner |
| **R28** | **The engine's own "measured" DataForSEO figures do not reconcile with the balance.** Window C (only the scheduled audit and the Site Tracker): balance moved **$0.0520**, exec 579 alone reports `dfs_usd 0.09 measured` (+73%). Window A: per-run figures $0.6145 against $0.5506 moved (+11.6%). The Keyword Check settles `dfs_usd: 0` while telling the caller `cost_usd: 0.026` | Low–Medium | `v5/code/_cost_cal.js`; the crawl path's cost summing; `Assess_Ledger_Row.js` | count a task's `cost` once (a crawl is billed at creation, not on every poll), settle the Keyword Check with the figure it reports to the caller, and reconcile the day's total against `appendix/user_data` instead of summing task costs |

**12 new defects**, three of them High. For comparison: the 2026-10-11 run found 26, the 2026-10-13 run 16.

Two themes run through them. First, **the retry gate for DataForSEO's errors-inside-HTTP-200 exists in exactly one place** and
three different subsystems paid for its absence in the same half hour (R18, R19, and the Google-side equivalent). Second,
**R9/R17: the ledger work was done but wired so that n8n runs it last**, which turns a guard into a bookkeeping artefact — and
it is only visible in a live run, because the harness runs node code, not n8n's branch ordering.

---

## 4. Owner items surfaced (not defects)

| # | Item | What it blocks, as seen this run |
|---|---|---|
| O1 / O2 | **Business profile and business facts for techand.ai** (author, reviewer, address, phone, facts, CTA) | 11 bracketed fields in the delivered page's byline and Person schema; the AI fact check reports `"no_facts"`; 9 Link Builder drafts held at "needs you: [Your name]"; **G31 (style guide) cannot be exercised at all** |
| O9 | **Publish or discard the 3 written pages** ("erp software uae", "service industry erp software", "azure api management monetization") | the Content Cadence has paused itself on the pile-up guard and will write nothing on Monday |
| O6 | **Upload the IndexNow key file** `https://www.techand.ai/e474f67e21841570c3de6d7624391652.txt` | AI Growth repeats "IndexNow waits for its key file"; only Bing submission works |
| O5 | **Answer October's Search Console check-in** | unchanged |
| O3 | **E-invoicing positioning** (MoF accreditation or a named accredited partner) | the verdict lists it as the top risk; the Link Builder's held drafts need it |
| — | **Run `fix_phantom_pages.py`** | 6 `seo_ladders` rows still say `writing` while only 3 content-log rows say `written`; every consumer now ignores them, but the stored data is still wrong |
| — | **Run `fix_brand_rungs.py --apply --brand facts.ae`** (the engine refuses on its own, by design) | "facts erp" is still planned and printed in the Rank Tracker's report (R16) |
| — | **Set up a failure to test the alert channel**, or wait for a real one | `SEO_ALERT_WEBHOOK_URL` is deployed but has never carried a message; G21's delivery rate is still unmeasurable |
| — | **Rotate `SEO_API_KEY` and the app hook token** | both have appeared in subagent tool output in earlier sessions |
| O10 | **Fix the true audit findings** | 4 High findings open: pages not indexed, HTML not cacheable by the CDN, 6 orphan pages, live lorem-ipsum text |
| — | **Decide about CrUX** | the API is enabled and answers correctly; the site has too little Chrome traffic for field data. Nothing to fix |

---

## 5. State left behind

- **Activated and restored:** the Test Runner (`SEOagentTestRun1`) was activated at 15:59 UTC and **deactivated again at 16:40 UTC**
  (confirmed through the public API: `active: false`). `SEOagentConsole1` was deactivated and re-activated once at ~16:37 UTC to
  try to exercise the error path; it is **active** again, as it was before. Nothing else was activated or deactivated.
- **New ladder:** `lad_mv8auur8kz49` — "azure cloud migration dubai", 2 rows (rung 2 "azure api management monetization",
  status `writing`; rung 4 top page, `planned`), settings row created `auto`, priority 6, `active`. **Consider deleting it:**
  R23 means the plan rests on one off-topic keyword, and its rung page did not pass QA.
- **New content:** 1 `seo_content_log` row (`azure api management monetization`, `written`) and the draft itself, delivered to the
  app as `…-DRAFT.doc` / PDF / HTML / Markdown / `meta.json` plus 3 WebP images. **Not published**, and `publishable: false`.
- **Rows written today:** `seo_audits` 3 (two technical at health 83, one full at 69), `seo_audit_findings` 108,
  `seo_ai_answers` 89, `seo_ai_daily` 1, `seo_ai_visibility` 1, `seo_ai_pages` 4, `seo_ai_growth` 1,
  `seo_backlink_snapshots` 1, `seo_backlinks` 1, `seo_link_prospects` 10, `seo_link_outreach` 20, `seo_rank_history` 11,
  `seo_query_history` 126, `seo_site_metrics` 1, `seo_page_watch` 20, `seo_cache` 16, `seo_ladders` 2, `seo_ladder_settings` 1,
  `seo_run_ledger` 22.
- **Ledger rows left `reserved` and unsettled** (R17): execs 561, 563, 564, 568, 570, 572, 574, 578, 579 — plus 534 from the
  morning's scheduled pulse. They will count against the daily cap until `Release Stale Runs` clears them 2 hours after creation.
- **Nine outreach drafts are held** in `seo_link_outreach`, none sent; no mailbox is connected, so nothing can be sent by
  accident.
- **Nothing was published, no WordPress push, no `published` row, no check-in, no e-mail to any third party.**
- 23 new rows in the app's `reports` table for the techand.ai company.

---

## 6. Artefacts (`files/`, git-ignored)

The folder carries its own `.gitignore` (`files/`): run artefacts can hold third-party contact details and the repository is
public. Third-party e-mail addresses are redacted in every saved file; **no prospects CSV was saved**; the company's callback
token is replaced with `<hook-token-redacted>`.

| File | What it is |
|---|---|
| `spend.json` | the four DataForSEO balance probes with timestamps |
| `claude-tokens.json` | every Claude call of executions 535–581 with its token counts and whether the usage was measured or estimated |
| `wave1.json` … `wave5.json` | the five request batches: what was sent and what each endpoint answered |
| `run-ledger-2026-10-14.json` | all 23 ledger rows of the day — the evidence for R17 and R28 |
| `pulse-568-node-order.json` | every node of the AI Pulse with its start time: settle before reserve (R17) |
| `verdict-540-parse.json` | the verdict with its reasons, changes, risks, existing page and coverage target |
| `ladder-549-plan.json`, `ladder-549-rows.json` | the ladder plan, its rungs and the stored rows (R22, R23) |
| `page-554-content-qa.json`, `page-554-package.json`, `page-554.md` | both QA rounds, the delivered package metadata and the page itself (R11, R15, R25, G5, G30, G33) |
| `tech-audit-551-site-audit.json`, `tech-audit-551-gsc.json` | findings, diff, weights, `not_assessed`, render diff, CrUX, and the URL-inspection counts (R10, R19, R24, G14) |
| `full-report-566-summary.json`, `full-report-566-gsc.json`, `full-report-566-domain-ages.json` | the full report's headline, lineage, its 45-of-45 inspection and the cached domain ages (D7, G29) |
| `discover-553-strategy.json` | pool, buckets, refusals, Search Console seeds, topic radius (G8, R12, R13, G32) |
| `ai-visibility-563-metrics.json`, `ai-visibility-563-report.txt` | the metrics block (error rate, market, perception) and the delivered report (D19, R14, P34-3, P34-6) |
| `backlinks-564-report.txt` | the backlink report, including the farm set-aside and the source coverage table |
| `link-builder-561-report.txt` | the week's link report (L3, L5, P34-1, P34-2, R21, R27) |
| `ai-growth-574-report.txt` | the AI growth report |
| `rank-tracker-570-reports.txt` | all six ladder reports (G6, D16, R16) |
| `site-tracker-581-report.txt` | the weekly site report (G9, G12, G28, G29, R20) |
| `cadence-572-plan.json` | the paused cadence plan (D5, R1) |
| `audit-scheduler-578-plan.json`, `page-watch-576-plan.json` | the scheduler's decision and the daily watch plan (G11) |
| `ladders-after.json` | every ladder row after the run |
| `ops-alerts.json` | the four `seo_ops_alerts` rows, all still `delivered: "pending"` |
