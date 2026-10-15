# Part 1 — Keywords, verdicts, ladders, content and the Reply Reader (executor A)

Live runs on techand.ai (country United Arab Emirates), 2026-10-15. Executor A ran protocol runs 1, 3, 4, 5, 6, 7, 9, 10 and 11.
Every API run was sent the way the web app sends it (`X-Forwarded-For: app:<techand.ai company>`, the company's own callback), through
the re-rating toolkit. Executor B ran two 200-page audits of the same site in the same window (executions 594/595 and 613/614) and the
pre-release checks (617, 618); they are not described here, but their DataForSEO spend overlaps this part's balance window.

| | |
|---|---|
| First call / last execution end | 19:02:13 UTC (Site Admin) / 19:23:05 UTC (page run 616) |
| Executions created by this part | 596, 597, 598, 599, 600, 601, 602, 603, 604, 605, 606, 607, 608, 609, 610, 611, 612, 615, 616 — all `success` |
| DataForSEO balance | **$13.707979** at 19:01:32 (day total $0.084) → $13.614709 at 19:04:49 → $13.587909 at 19:06:00 → **$12.735491** at 19:23:13 (day total **$1.056488**) |
| Balance moved in the window | $0.972488, shared with executor B's audits (ledger: 595 $0.0265, 614 $0.3936). This part's runs report **$0.5306** from their own DataForSEO tasks; A + B ledger = $0.9507, $0.0218 (2.2%) of the window is attributed to no run |
| Claude (n8n token counts, `RR claude`) | **$1.1941** over 26 model calls: $0.6642 from `tokenUsage` (measured) + $0.5299 from `tokenUsageEstimate` only (the four Opus 5.5 streaming calls of run 616). The engine's own ledger for the same runs says $1.2167 — see §10 |
| Reports that reached the app | 6: `site_description` (605), `content` "Keyword report: e invoicing software uae" (607), `keyword_strategy` (611), `ladder_plan` (609), `content` "Keyword report: construction project erp" (611), `content` "Page: ai consulting" (609) |

Artefacts (main repo, git-ignored `docs/system-review-2026-10-15/files/`): `A-monitors-before.json` / `A-monitors-after.json`,
`assess-*.json` (3), `A-reply-reader-601-604.json`, `report-<id>.json` (6), `A-verdict-608-parse.json`,
`A-verdict-608-existing-page-text.json`, `A-verdict-608.pdf`, `A-ladder-610-plan.json`, `A-ladder-610-pool-verdict.json`,
`A-ladder-610-research.json`, `A-ladder-610-relevance.json`, `A-ladder-610-rows.json`, `A-page-616.md`, `A-page-616.html`,
`A-page-616-DRAFT.pdf`, `A-page-616-DRAFT.doc`, `A-page-616-qa-round1.json`, `A-page-616-qa-round2.json`, `A-page-616-facts.json`,
`A-page-616-verdict.json`, `A-discover-612-strategy.json`, `A-discover-612-result.html`, `A-discover-612.pdf`, `A-kwreport-615-verdict.json`,
`exec-<id>.json` for every execution above.

---

## Runs

"DataForSEO" = the sum of the costs the run's own DataForSEO tasks reported (each task id once) / the run's `seo_run_ledger` row
(`dfs_usd`, status). "Claude" = n8n's per-call token counts priced at list prices (measured = `tokenUsage`, estimate =
`tokenUsageEstimate` only) / the ledger's `ai_usd`.

| # | What | Request | Executions (API → run → spawned) | Start–end UTC | Duration | DataForSEO (tasks / ledger) | Claude (n8n / ledger) | Status |
|---|---|---|---|---|---|---|---|---|
| — | Balance | — | — | 19:01:32 | — | $13.707979 | — | — |
| 1 | Site Admin `monitors`, `link_builder: true` | rr1015-lb-on | 596 → 597 | 19:02:13.6–19:02:14.1 | 0.5 s | 0 | 0 | 200, `affected: 1` |
| 5 | Keyword Check "erp software uae" | toolkit `assess` | 598 | 19:02:24.3–19:02:30.0 | 5.7 s | $0.0241 / $0.0241, done | $0.0030 measured / $0.002 "ESTIMATED" | 200 |
| 5 | Keyword Check "business central partner uae" | toolkit `assess` | 599 | 19:02:34.0–19:02:37.9 | 3.9 s | $0.0240 / $0.024, done | $0.0027 / $0.002 | 200 |
| 5 | Keyword Check "dynamics 365 partner uae" | toolkit `assess` | 600 | 19:02:41.7–19:02:46.8 | 5.1 s | $0.0240 / $0.024, done | $0.0030 / $0.002 | 200 |
| 11 | Reply Reader (a) interested + question | synthetic | 601 | 19:04:09.1–19:04:16.6 | 7.4 s | 0 (fetch only) | $0.0042 measured / no ledger row | 200, `question` |
| 11 | Reply Reader (b) out-of-office | synthetic | 602 | 19:04:22.0–19:04:26.3 | 4.3 s | 0 | $0.0036 / no row | 200, `out_of_office` |
| 11 | Reply Reader (c) polite no / remove me | synthetic | 603 | 19:04:30.3–19:04:32.3 | 2.0 s | 0 | $0.0025 / no row | 200, `unsubscribe` |
| 11 | Reply Reader (d) "we added your link" (real page) | synthetic | 604 | 19:04:37.1–19:04:41.4 | 4.3 s | 0 | $0.0027 / no row | 200, `says_linked`, link `found` |
| 3 | `describe` | rr1015-describe | 605 → 606 | 19:04:55.0–19:05:50.8 | 56 s | $0 / $0, done | $0.0117 measured / $0.0039 | completed |
| 4 | `verdict` "e invoicing software uae" | rr1015-verdict | 607 → 608 | 19:05:18.3–19:07:44.1 | 2.4 min | $0.0241 / $0.0241, done | $0.1145 measured / $0.0848 | GO_WITH_CHANGES **58** |
| 6 | `ladder` "ai consulting dubai", `pages_now` 1 | rr1015-ladder | 609 → 610 → 616 | 19:05:34.3–19:09:11.6 | 3.6 min | $0.1404 / $0.1404, done | $0.1167 measured / $0.0882 | completed, 4 pages, `lad_mv9wshpdy2jf` |
| 9 | `discover`, `receive: ["Keyword Report"]`, `features: []` | rr1015-discover | 611 → 612 → 615 | 19:06:00.6–19:08:16.8 | 2.3 min | $0.2478 / $0.2478, done | $0.1648 measured / $0.0653 | completed, 667 → 239 → 104 |
| 10 | → keyword report "construction project erp" (spawned) | 611 | 615 | 19:08:01.8–19:10:16.2 | 2.2 min | $0.0221 / $0.0221, done | $0.0888 measured / $0.0752 | GO_WITH_CHANGES **46** |
| 7 | → ladder page "ai consulting" (spawned) | 609 | 616 | 19:09:08.9–19:23:05.4 | 13.9 min | $0.0241 / $0.0241, done | $0.1461 measured + $0.5299 estimate / $0.8933 | completed, **"did not pass the quality check — not ready to publish"** |
| — | Balance | — | — | 19:23:13 | — | $12.735491 | — | — |

Durations against 2026-10-14 (same protocol numbers): Keyword Check 6.2–6.5 s → 3.9–5.7 s; Reply Reader 3.0–6.1 s → 2.0–7.4 s;
describe 44 s → 56 s; verdict 2.1 → 2.4 min; ladder 93 s → 3.6 min (10 results-page checks were added, §6); page 8.7 → 13.9 min (one
Strategy Brief retry, §7); discover 1.9 → 2.3 min; keyword report 3.1 → 2.2 min.

The `request_id` values sent in the bodies (`rr1015-…`) are not kept: the API front door answers with its own execution id (605, 607,
609, 611), and that id is what the app's `reports.request_id` carries. All six reports carry `scheduled: true`, because the toolkit
posts to n8n directly and the app has no run row for them — this is how the toolkit works, not product behaviour.

---

## 1. Site Admin `monitors` (protocol run 1)

**Asked.** `{"action":"monitors","domain":"techand.ai","monitors":{"link_builder":true},"request_id":"rr1015-lb-on"}` — the body shape
was checked against `harness/code_v4/Admin_Validate.js` and `Monitor_Row_Admin_.js` (given fields replace, others kept).

**Came back.** 200 in 0.58 s: `{"ok":true,"action":"monitors","site_id":"site_techand-ai","domain":"techand.ai","affected":1,"error":null}`.
Executions 596 (Admin API) → 597 (Site Admin).

**Right.** The `seo_monitors` row before and after (`A-monitors-before.json` / `A-monitors-after.json`) differs only in `updated_at`,
`request_id` and `updatedAt`: `link_builder` stays `true`, `ai_prompts_max` 8, `ai_engines` (6 engines), `competitors`
"cleartax.com, azentio.com", `brand_names` "Techand", `ai_pages_month` null and `stuck_weeks` null are all unchanged.

**Wrong.** Nothing found. **Cost.** None.

---

## 2. Keyword Check ×3 (protocol run 5)

**Asked.** The app's `assessBody()` through the toolkit: keyword, country, domain, `services: []`, `existing_keywords` (the domain's
ladder keywords, 25 entries — including "erp software uae" and "dynamics 365 partner uae"). Executions 598, 599, 600.

**Came back** (`files/assess-*.json`):

| Keyword | volume | KD | intent | CPC | label | chance | fit |
|---|---|---|---|---|---|---|---|
| erp software uae | 480 | 3 | commercial | 13.98 | "Easy for your site · Direct plan · 2-4 months" | "estimated chance good (50-70%, uncalibrated)" | 2 (`fit_known: true`) |
| business central partner uae | null | null | null | null | "Reachable for your site · Short ladder · 4-8 months · no search data" | `chance: null` | 2 |
| dynamics 365 partner uae | null | null | null | null | "Reachable for your site · Short ladder · 4-8 months · no search data" | `chance: null` | 2 |

For the two keywords without data the answer carries `search_data_known: false`, `difficulty_known: false`, `plan_assumed: true`,
the warning "DataForSEO has no data for this keyword in United Arab Emirates (volume and difficulty unknown)" and the `chance_text`
*"No estimated chance: DataForSEO has no search volume and no difficulty for "business central partner uae" in United Arab Emirates, so
the difficulty this estimate rests on (counted as your reach + 10) was never measured. The plan and the months below rest on that same
assumption."* All three carry the same `reach_note`: the plan is measured against the site-wide reach 10 because "the reach stored on
2026-10-08 was kept without the keywords behind it, so this check has no topic evidence to read … treat the months and the chance below
as the optimistic case" (`reach_info`: `method: "size"`, `sample: 0`, `top10: 0`, `cached_at 2026-10-08T05:53:22Z`).

The figures were checked against the DataForSEO answers in `Run Assess Requests` (598: `search_volume 480`, `keyword_difficulty 3`,
`main_intent "commercial"`, `cpc 13.98`; 599/600: `keyword_overview` `items_count: 0`, `ranked_keywords` `items_count: 0`), all task
status 20000. Fit came from one Haiku call per check (`Keyword Fit` output `{"fit":2,"navigational":false,"alternatives":""}` for 598).

**What the customer sees.** The Keyword Check is synchronous; no `reports` row. The form shows the answer above.

**Right.** Every number matches its source. Where data is missing the label says "· no search data" and no chance band is printed; on
2026-10-14 (execs 541-543, per that day's RESULTS §2.1) the same two keywords were labelled "Reachable for your site · Short ladder · 4-8 months" with
"estimated chance fair (30-50%)" and the missing data appeared only in `warnings`. The ledger carries the DataForSEO money today: on
2026-10-14 the Keyword Check settled `dfs_usd: 0` while answering `cost_usd: 0.026`; today rows 80-82 settle `dfs_usd` 0.0241 / 0.024 /
0.024 = the task costs, and `cost_basis` says "total $0.0261 — the same figure the 200 reported as cost_usd".

**Wrong.** See **A-16** (a "good 50-70%" chance on a site with no measured ranking) and **A-17** (the answer does not mention that two
of the three keywords are heads of existing ladders). Claude in the ledger is the fixed estimate $0.002 per check against $0.0027-0.0030
reported by n8n (§10).

**Gap to the leader.** Semrush's Personal KD and MarketMuse's Personalized Difficulty compare the site's own topical authority with the
SERP; here the reach is a site-size figure cached on 2026-10-08 with no keywords behind it, and the same reach (10) is applied to every
topic. No difficulty figure was produced for 2 of the 3 keywords (DataForSEO has none for UAE); Ahrefs' and Semrush's difficulty is
computed from the ranking pages' links (criteria §(a)), which needs only a results page — none was read for these two, so the check
fell back to "reach + 10".

**Cost.** DataForSEO $0.0721 for the three (two $0.012 tasks each, `keyword_overview` + `ranked_keywords`), equal to the ledger.
Claude $0.0087 measured by n8n, ledger $0.006 (estimate).

---

## 3. Reply Reader ×4 (protocol run 11)

**Asked.** Four synthetic replies in the app's `replyReadBody()` shape (`domain`, `prospect_domain`, `page_url`, `business`
"techand.ai", `signer` "Test Sender, Partnerships, Tech&", `facts` "", `business_facts` "", `profile` {} — techand.ai has no business
facts and no profile on file — `our_subject`, `our_body`, `reply_from`, `reply_subject`, `reply_text`, `received_at`). Every
`reply_from` is a fake @example.com address; (a)-(c) use example.com / example.org pages. Bodies: `files/A-reply-reader-601-604.json`.

| Case | Reply (abridged) | class | summary | return date / referral | needs_you | suggested reply | link check |
|---|---|---|---|---|---|---|---|
| (a) 601 | interested; "how many Peppol go-lives has Tech& completed in the UAE … is Tech& an accredited service provider (ASP) with the Ministry of Finance? … what a typical implementation costs" | `question` | "Interested in adding us, but needs answers on Peppol go-lives, Ministry accreditation, and typical implementation cost." | — | true | "On your questions: [Owner: confirm number of Peppol go-lives completed in UAE, whether we hold Ministry of Finance ASP accreditation, and typical implementation cost for mid-size distributors]." | example.com page `gone` |
| (b) 602 | OOO "will be back in the office on Monday 2 November 2026 … contact my colleague at desk@example.com" | `out_of_office` | "Out of office until 2 November 2026, alternative contact desk@example.com provided" | `2026-11-02` / desk@example.com | false | "" | `gone` |
| (c) 603 | "we do not add vendor links … Please remove me from your mailing list and do not contact me again" | `unsubscribe` | "Recipient declines to add vendor links to guides and requests removal from mailing list." | — | false | "" | `gone` |
| (d) 604 | "your entry on our full members list now links to your website: https://peppol.org/members/full-members-list/" (`prospect_domain` peppol.org) | `says_linked` | "OpenPeppol added techand.ai link to members list. Link verified live." | — | false | thanks note, "We've confirmed the link is now live …" | **`found`, rel `follow`, anchor `https://techand.ai/`, placement `content`** |

For (d) the page was chosen from the backlink ledger (`seo_backlinks` row 2: peppol.org, `from_url`
https://peppol.org/members/full-members-list/, `rel follow`, `verify found` on 2026-10-14). Execution 604's `Fetch Reply Pages` read the
real page (1.2 s) and the result agrees with the ledger.

**Right.** All four classes are what the replies say. Nothing about the business was invented in (a): the go-live count, the
accreditation and the price were all left in one `[Owner: confirm …]` bracket by the model itself, so the claims kit had nothing to wrap
(`unverified: []`). The out-of-office date is parsed to an ISO date and the colleague's address is captured as a referral. The "linked"
claim was verified by our own fetch before the reply was drafted. On 2026-10-14 (544-547) all four classes were also right; the OOO
date parsed there was 2026-10-26.

**Wrong.** Nothing in the classification. The Reply Reader writes no `seo_run_ledger` row, so its Claude cost ($0.0129 for the four
calls) is not recorded by the engine (part of **A-14**).

**Gap to the leader.** The criteria's leaders (Pitchbox / BuzzStream class) stop a sequence on a reply but do not pause follow-ups on an
out-of-office; this reader extracts the return date for the app's sender to pause on. Whether the sender actually pauses and resumes was
not exercised (no mailbox connected — by rule).

**Cost.** Claude Haiku 4.5, all four `MEASURED`: 1,859/469, 1,799/361, 1,775/137, 1,746/187 tokens = $0.0129. DataForSEO 0.

---

## 4. `describe` (protocol run 3)

**Asked.** `{"mode":"describe"}` (domain / country filled by the toolkit). API 605 → run 606, 56 s.

**Came back** (`Build Describe Response`): business name "Tech&", one-line summary "Microsoft-focused enterprise technology partner
delivering digital transformation and AI solutions across GCC industries.", 28 `products_or_services` (Dynamics 365 Finance … Azure
Synapse Analytics), 9 audiences, 7 USPs ("20+ years proven industry experience", "Trusted Microsoft partner", "24/7 support
availability", …), `location_served` "GCC region (UAE and Saudi Arabia focus)", meta title "Enterprise Technology Solutions | Tech&
Microsoft Partner", 10 seed keywords, `pages_read` 6 (homepage + 5 nav pages), `site_read_failed: false`.

**What the customer sees.** `reports` row 301ae0cd…: stage `site_description`, title "Site description · techand.ai", summary
`{"name":"Tech&","summary":"Microsoft-focused enterprise technology partner …"}` and the description page HTML.

**Right.** The 28 services match the capability pages; the claims ("20+ Years", "24/7 Support") are on the homepage
(https://www.techand.ai/ fetched 19:06 UTC). The site model reused the stored canonical host `www.techand.ai` and the DAFZA address.

**Wrong.** **A-19**: the five nav pages are all listed with the title "Tech& | Enterprise Automation & Digital Transformation
Solutions" (the rendered reader's title), while the live HTML titles are "Industries We Serve | Tech&", "Capabilities | Tech&", "Cloud
Services | Tech&", "Business Applications | Tech&", "Data & Analytics | Tech&" (fetched with curl, 19:07 UTC); `site_facts` (50 lines)
mixes real facts with section headings ("Industries We Serve", "What We Do", "Insights", "Proven Track Record") and article titles; and
`nav_pages` holds a single "Read more about How Microsoft 365 Copilot …" link on the bare host `https://techand.ai/insights/…`.

**Cost.** DataForSEO 0. Claude: n8n reports Haiku 4,874 in / 1,368 out = $0.0117; the ledger settled **$0.0039** "measured: Anthropic
/v1/messages/count_tokens counted 3919 prompt and **4 answer token(s)**" — the counted answer was the string `"[object Object]"`
(`Prompt For Count (Site Describer)` → `__answer: "[object Object]"`). See **A-14**.

---

## 5. `verdict` "e invoicing software uae" (protocol run 4)

**Asked.** `{"mode":"verdict","keyword":"e invoicing software uae"}`. API 607 → run 608, 2.4 min. SERP Top 10 (depth 30) task status
20000 at 19:05:47 UTC, Facts SERP 20000, Keyword Data 20000 (`verdict_evidence`: `serp "read"`, `keyword_data "read"`).

**Came back** (`A-verdict-608-parse.json`): **GO_WITH_CHANGES, 58** (not withheld). Reasons, quoted:
1. "Volume is only 40/month on average, but the trend is rising: 110 searches in 2026-08, up from 20 in 2026-02 (+120% quarterly). The
   1 Jan 2027 go-live for AED 50M+ businesses and the 30 Oct 2026 ASP appointment date keep demand building."
2. "CPC is $13.37 with MEDIUM ads competition and commercial intent …"
3. "The SERP is beatable. Of six ranking pages, two vendor pages are very thin (smartinvoice.ae 192 words, tallysolutions.com 330 words)
   and one is a government portal. Only complyance.io has comparison tables (7). cleartax.com (2,650 words) is the only strong guide …"
4. "The existing insights article at the target URL is a CFO-framed Peppol features piece. Its visible text has no mandate dates, no
   PINT-AE or 5-corner explanation, no tables, no lead CTA and no author or date. …"

Risks include "An AI Overview was seen in the check at 19:05 UTC on 2026-10-15, citing nine other sites. AI Overviews vary between
searches, so this is one observation …" and "Tech& must be honest about its accreditation. If it is not an FTA-accredited ASP …".
Changes: improve the existing page `https://www.techand.ai/insights/top-peppol-e-invoicing-software-features-every-uae-cfo-must-look-for`
(`existing_page_action: "improve"`, `matched_by: "slug"`, `source: "page inventory"`), every later change "On that page, …"; an FAQ
section "with question-style headings" and "Service and Organization schema" (no FAQPage). Coverage target: 90% of 25 shared terms,
best page cleartax.com (#1) 96% / 2,650 words / 13 sections, average 67%, 12 subtopics.

**What the customer sees.** `reports` row 44818f6f…: stage `content`, title "Keyword report: e invoicing software uae", summary
`{"page":"Service Page","score":58,"volume":40,"hasPage":false,"verdict":"GO_WITH_CHANGES"}`, files
`keyword-verdict-e-invoicing-software-uae-2026-10-15.doc` and `.pdf` (saved as `A-verdict-608.pdf`), `existing_page`, `keyword_data`
with the 12-month trend, `run_ledger`.

**Checked against sources.**
- Dates: the Ministry of Finance moved the ASP appointment deadline for businesses above AED 50 million from 31 July 2026 to
  **30 October 2026**, implementation date **1 January 2027** unchanged (WAM, "MoF announces targeted amendments to eInvoicing system
  decisions", https://www.wam.ae/en/article/c055277-mof-announces-targeted-amendments-einvoicing; also BDO, Comarch). Correct.
- Volume / trend / CPC: `Keyword Data` → `search_volume 40`, monthly 110 (2026-08) … 20 (2026-02), `search_volume_trend.quarterly 120`,
  `cpc 13.37`, `competition_level MEDIUM`, `keyword_difficulty null`. Correct.
- Competitor pages: `Analyze Competitor Pages` → cleartax 2,650 words, tallysolutions 330, complyance.io 2,659 words / 7 tables,
  mof.gov.ae 734, smartinvoice.ae 192, youngandright.ae 1,357. Correct.
- AI Overview: the SERP's `ai_overview` item references 9 domains (docubay.ae, eandenterprise.com, elitemindz.co, eresourceerp.com,
  flick.network, quickdiceerp.com, quicktax.ac, smart-einvoicing.com, uae.advintekglobal.com). "Nine other sites" is correct.
- The existing page (fetched 19:08 UTC, `files` not kept): the article body says "an amendment that moved the ASP appointment
  deadline for businesses with revenue of AED 50 million or more to 30 October 2026, while retaining the 1 January 2027 implementation
  date"; it holds **3 HTML tables** ("Feature / What It Does / Why CFOs Should Care", "Integration Area / What to Look For / Business
  Benefit", "Evaluation Area / Questions CFOs Should Ask"); a visible byline "Muhammad Aarish — System Architect" after the article; and
  Article schema with `author` Person and `datePublished` 2026-09-26. "PINT" and "5-corner" do not occur — that part is correct. See
  **A-5**.

**Right.** Every market figure traces to its source; the dates are right; the AI Overview is reported as a timestamped observation;
the existing page is found and the advice is to improve it on the same URL; no FAQPage. On 2026-10-14 (540) the same keyword also
scored 58 with the same existing page, and the coverage target was youngandright.ae 22 of 22 terms; today it is cleartax.com 24 of 25.

**Wrong.** **A-5** (High): the reason about the customer's own page is false on three counts (mandate dates, tables, author), and the text the run read
already contained the dates (`existing_page_text`, 9,000 characters = 1,248 of the article's ~2,100 words, contains "30 October" and
"2027"; `client_signals.credentials` contains "Accredited Service Provider (ASP) by 30 October 2026"). **A-15** (Low): "FTA-accredited
ASP" — ASPs are accredited by the Ministry of Finance.

**Gap to the leader.** Ahrefs' Traffic Potential uses the #1 page's real traffic; here visits are modelled from a 40-search provider
estimate. Surfer / Clearscope read the client's page fully when grading it; this run read the first 9,000 characters and flattened tables
to text before telling the owner what the page lacks.

**Cost.** DataForSEO $0.0241 (Keyword Data $0.0121, SERP $0.008, Facts SERP $0.004) = ledger. Claude: n8n $0.1145 (Competitor
Analyzer 17,072 / 4,251, Verdict 10,997 / 1,577, both `MEASURED`); ledger $0.0848, each node "counted … **5 answer token(s)**" plus
1,638 modelled thinking tokens (**A-14**). The pre-run estimate shown in the payload was $0.20.

---

## 6. `ladder` "ai consulting dubai", `pages_now` 1 (protocol run 6)

**Asked.** The app's ladder body: `mode ladder`, `keyword "ai consulting dubai"`, `business ""`, `customers ""`, `business_facts ""`,
`goal "Get leads and enquiries"`, `tone "Professional and direct"`, `cta ""`, `pages_now 1` (the site's own goal / tone / cta from the
app's `sites` row; business facts are empty for this customer). API 609 → run 610 (3.6 min) → spawned page run 616.

**The SERP was read.** Every DataForSEO task of 610 answered 20000: SERP Top 10 (depth 30, 19:06:16 UTC), Facts SERP, Keyword Data,
four research calls ($0.0962) and 10 cluster SERP calls ($0.0200); no task error, no retry needed (`Ladder Cluster Retry` →
`failed: 0`). `data_check`: `pool_size 41`, `minimum_pool 3`, `head_measured true`, `serp_checked true`, `enough true`.

**Came back** (`A-ladder-610-plan.json`; report row 4db246f7…, stage `ladder_plan`, title "Ladder plan: ai consulting dubai", summary
`{"head":"ai consulting dubai","plan":"Reachable for your site · Short ladder · 4-8 months","pages":4,"writeNow":1,"feasibility":"GO_WITH_CHANGES"}`,
files `keyword-ladder-ai-consulting-dubai-2026-10-15.doc` + PDF):

- Head: volume 40, KD null, CPC 8.02, commercial; feasibility **"winnable", GO_WITH_CHANGES 52**, label "Reachable for your site · Short
  ladder · 4-8 months", chance "fair (30-50%, uncalibrated)", `stretch: false`. SERP diversity: 5 sites in the top 5 → no adjustment.
- Pool 41 → 34 reviewed by Claude → 26 relevant; 19 removed as off-topic ("it shares none of the words that matter in "ai consulting
  dubai" ("consult", "dubai")"); 2 refused as navigational: "meta ai" (22,200) and "pitch ai" (70).
- Rungs (stored in `seo_ladders`, `A-ladder-610-rows.json`):

| Rung | Page keyword | Supporting | Volume | KD | Target words (source) | Grouped by | Target URL |
|---|---|---|---|---|---|---|---|
| 1 | ai consulting | — | 170 | 0 | 1,900 (median of 5 pages read) | topic label | /ai-consulting/ — **written in this run (616)** |
| 2 | ai consulting firm | openai consulting | 30 + 10 | null | 1,900 | topic label | /ai-consulting-firm/ |
| 2 | supply chain optimization consulting | supply chain operations / logistics / risk consulting | 10 each | null | 1,900 | topic label | /supply-chain-optimization-consulting/ |
| 4 (top) | ai consulting dubai | generative ai consulting dubai, ai strategy consulting dubai, ai consulting company uae, microsoft copilot consulting dubai, ai consultant cost dubai, ai consulting services uae | 40 | null | 2,300 (competitor analysis) | — | /ai-consulting-dubai/ |

- Notes printed to the owner, quoted: "Nothing on techand.ai is about "ai consulting dubai" yet — no page and no keyword it ranks for —
  so all 4 page(s) in this plan are new and this topic starts from zero." and "The results pages of 10 of the 10 rung keyword(s) were read
  and compared: searches sharing 3 of their top 7 pages (40%) are one page, not two - no two of them share one."
- Head-term traffic: the top page carries `traffic_potential: 12`; the same run's verdict carries `expected_visits.visits: 6`,
  "Click loss applied: an AI Overview (-52% of the clicks, measured: Ahrefs, 300,000 keywords, December 2025 data (published
  2026-02-04))", `model_estimate 15`.
- The verdict's coverage target for the top page: digiscorp.com (#7, a "best AI consulting companies in Dubai" listicle) 96%, with
  subtopics "1. Digis (Best Overall AI Consulting Company)", "2. Accenture AI & Analytics", "3. IBM AI Consulting", "4. PwC Middle East
  AI Solutions", "6. Cognizant AI & Data Science", "9. DataRobot MEA", "10. G42 AI Solutions".
- `ladder_settings`: new row, `mode auto`, `priority 7`, **`status active`**.

**Checked.**
- **The site has a live page on this topic.** https://www.techand.ai/ai-copilot-advisory-uae (in the sitemap and in the run's own
  `seo_pages` inventory, with an empty title) answers 200 with title **"AI Consulting & Copilot Advisory UAE | Tech&"**, H1 **"AI
  Consulting & Copilot Advisory Services in UAE"**, H2s "AI Consulting for Practical Business Outcomes", "What Is AI Consulting &
  Copilot Advisory?", "AI Consulting Across Strategy, Readiness & Governance", FAQ "What is AI consulting?" and "Is AI consulting
  available for businesses in the UAE?" (fetched 19:18 UTC). Two more AI pages are live: /ai-agents-copilot-studio-uae ("AI Agents in
  Dubai on Microsoft Copilot Studio") and /whatwedo/ai-automation. 25 of the inventory's 45 rows carry no title. See **A-1**.
- SERP overlap, top 7, recomputed from the stored answers: the most any two rung keywords share is 1 URL; "ai consulting firm" and
  "openai consulting" share 0; the four supply-chain keywords share at most 1 pairwise. The plan still put them on one page each "by
  topic label (no search Google answers with the same pages)". See **A-7**.
- "openai consulting" SERP: openai.com "OpenAI launches the deployment company", ibm.com/consulting/openai, channeldive.com news on
  OpenAI's consulting venture — a search about another company. "supply chain optimization consulting": consultancy-me.com rankings,
  ibm.com, kpmg.com/ae operations consulting, thehackettgroup.com glossary. The engine's own relevance pass rated
  "supply chain optimization consulting" 1 of 2 (`A-ladder-610-relevance.json`). See **A-6**.
- The verdict's AI Overview claim ("citing kineticcs.com, consultancy-me.com and clutch.co"): the item references clutch.co,
  competenza.ae, kineticcs.com, consultancy-me.com, elchaigroup.com, gcc-marketing.com, google.com, linkedin.com — the three named are
  among them. "None of the five analysed pages gives pricing": the five pages' texts mention "cost" / "pricing" only in other senses
  (dynamic pricing, cost savings). Correct.
- Active ladders after this run: e invoicing in uae, peppol uae, erp software uae, erp implementation dubai, azure cloud migration dubai,
  ai consulting dubai = **6 `active`** (plus dynamics 365 partner uae `paused`) against the `_site` row's `max_active: 2` (and `max_waiting: 3`); and
  `seo_content_log` already held 3 `written`, unpublished pages (erp software uae, service industry erp software, azure api management
  monetization) before this run wrote a fourth. The plan's notes mention neither. See **A-9**.

**Right.** The results page was read (no failure inside HTTP 200), the pool is 41, navigational terms were refused and 19 off-topic ideas
removed with a reason each; rung target words are set (1,900) and passed to the page (`ladder_words 1900`); the rung SERPs were bought,
compared at the 40%-of-top-7 rule and the result is printed; the chance is labelled uncalibrated with the base rate. On 2026-10-14 (549)
the same protocol run had a SERP that failed twice with no retry, a pool of 1 keyword, a "winnable 68" score and a rung target of 0
words.

**Wrong.** **A-1** (High), **A-6**, **A-7**, **A-8** (head traffic 12 vs 6 in one report), **A-9**, **A-11** (listicle brand entries as
the top page's subtopics), **A-21** ($0.006 of cluster checks bought for keywords the relevance pass then rated 0: "transfer pricing
consulting", "supply chain consulting uk", "supply chain consulting meaning").

**Did it refuse when it should?** The data-sufficiency refusal had nothing to refuse (pool 41, SERP read). It did not stop on the
existing AI consulting page, the six active ladders or the pile-up of unpublished pages.

**Gap to the leader.** Semrush's Keyword Strategy Builder and MarketMuse's content plans start from the site's own page inventory and
place an existing page into the pillar; Keyword Insights merges keywords only when their results overlap. This plan missed the site's
own "AI Consulting" page and merged keywords whose results do not overlap.

**Cost.** DataForSEO $0.1404 (research $0.0962, cluster SERP $0.0200 — "measured: 10 results-page call(s) at what each task reported,
counted once by task id" — Keyword Data $0.0121, SERP $0.008, Facts $0.004) = ledger. Claude: n8n $0.1167 (Competitor Analyzer, Verdict,
Ladder Relevance, all `MEASURED`); ledger $0.0882 (answers counted as 5 tokens each, **A-14**). Pre-run estimate $0.26.

---

## 7. The ladder's rung-1 page "ai consulting" (protocol run 7)

**Asked.** Spawned by 610 at 19:09:08 as a keyword run with the ladder fields (`ladder_id lad_mv9wshpdy2jf`, rung 1, head "ai consulting
dubai", `ladder_words 1900`, `force_content`). Execution 616, 13.9 min.

**What ran.** SERP Top 10 20000 (19:09:33). **Facts SERP returned `status_code 40101 "Internal SE Server Error."` inside HTTP 200
(billed $0.002), the run waited 5 s (`Wait Before Facts Retry`) and `Facts SERP (Retry)` answered 20000** at 19:10:57. Competitor
Analyzer, Verdict (GO_WITH_CHANGES 58, `existing_page: null`), Strategy Brief — **the first Opus answer was rejected by the parser
("Model output doesn't fit required format", `Parser — Strategy Brief [0]`) and the brief was asked again** (114 s + 129 s) —
Copywriter, Critic (66, "revise"), Content QA round 1, Originality round 1, Editor (one call, 235 s), Content QA round 2, Originality
round 2, Word + PDF + 3 images, content-log row, callback.

**Came back** (report row 338c4333…, stage `content`, title "Page: ai consulting"; `A-page-616.md` / `.html` / `-DRAFT.pdf` /
`-DRAFT.doc`):
- Title "AI Consulting in the UAE | Strategy to Live Pilot | Tech&" (57 chars), meta description 153 chars, H1 "AI Consulting for UAE
  Enterprises: From Readiness to a Governed, Working Pilot", 8 H2, 17 question headings all answered, 57-word answer block, Flesch
  60.3, passive 9%.
- **Verdict shown: "did not pass the quality check — not ready to publish (round 2 of 2)"**, `qa_publishable: false`,
  `notReadyToPublish: true`, files named `…-2026-10-15-DRAFT.doc/.pdf`. Reasons, quoted: "it covers 60% of the terms the best-ranking
  page covers, against a target of 90%"; "External links to sources not in the evidence plan: centralbank.ae, difc.com, adgm.com —
  verify each one"; "Figures the cited source does not carry (now marked [Confirm: …]): "40%" (mckinsey.com); "27%" (mckinsey.com) —
  quote the source's own number or cite the page that states it"; "Topic coverage 60% against a target of 90% (vendasta.com covers
  90%) — work these terms in where they belong: strategy, technology, consulting firms, consulting services, change management,
  management, customer service, building"; "Subtopics the best competitor page covers and this draft does not: "Acquire and serve 10x
  more clients with AI-powered software", "7. Performance Measurement and Optimization", "How to Tell if an SMB Needs AI Consulting
  Services?", "1. They're Drowning in Data but Lacking Insight" …". Note: "The editor had 2 round(s) and the page still fails the checks
  above: it is delivered as a draft to finish by hand, not as a page to publish as it is."

**Length.** Round 1: 2,793 main-content words against 1,900 (+47%), coverage 90% (target met), content score 93, critic 66. Round 2
(after the editor): **2,197 against 1,900 (+16%)**, coverage **60%**, content score 89. On 2026-10-14 (554) the delivered draft was
2,648 words against 1,800 (+47%).

**Placeholders.** `placeholder_count: 0`, `placeholders_in_body: []`, `placeholders_total: 0`. The delivered body contains five
bracketed items: `[Confirm: 40%]`, `[Confirm: 27%]`, `[Confirm: edition year and sample size]` (Deloitte line) and "*Checklist
reviewed by [name, role], [date].*". Only the two figures are named in the reasons. See **A-12**.

**Facts against sources** (the evidence plan is `A-page-616-facts.json`):
- Deloitte "enhancing insights and decision-making (53%), reducing costs (40%) … client or customer relationships (38%)": the Deloitte
  page states exactly these (2026 report, 3,235 leaders, surveyed Aug-Sep 2025; WebFetch 19:2x UTC). Correct, and the bracket asking
  for the edition and sample size could have been filled from the same page.
- McKinsey "40% … up from 27%": the evidence the run held reads "Forty percent of respondents from large organizations (those with
  annual revenues of more than $1 billion) report scaling AI agents, up from 27 …"; McKinsey's "The state of AI in 2026: On the road to
  ROI" states 40 percent, up from 27 percent (web search, McKinsey PDF listed). The figures are correct and sourced; the QA masked them
  and told the owner the source does not carry them. See **A-4**.
- alicelabs.ai "from $150/hr for independents, $300–$600/hr for boutiques and $1,000+/hr for MBB partners": the live page's TL;DR
  says "$150–$350/hr for independents, $300–$600/hr for boutiques, and $500–$1,000+/hr for MBB firms" (curl, 19:2x UTC). Faithful, and
  the draft labels it "a single estimate, not independent research and not Tech& pricing".
- PwC "superior mix of traditional and results-based pricing, in a third of engagements": in the evidence plan's pwc.com snippet; the
  live pwc.com page answered 403 — not verified live.
- PDPL "Federal Decree-Law No. 45 of 2021 … does not apply in free zones with their own data law, such as DIFC and ADGM": correct.

**Originality.** 2,128 eight-word windows against 8 pages (6 competitor, 2 own: the homepage and /ai-agents-copilot-studio-uae),
highest overlap 0.2% (atilab.io, 11 words "do we have to build with you afterwards no the roadmap"), threshold 15%, passed. The closest
own page, /ai-copilot-advisory-uae, was not among the pages compared (`duplicate_targets: []`); recomputed here, the draft shares 0 of
2,196 eight-word windows with it — no copying, but the same search intent (**A-1**).

**Internal links.** 7 in the body, to /contact-us (×2), /ai-agents-copilot-studio-uae, **/ai-copilot-advisory-uae** (anchor "AI and
Copilot advisory for UAE businesses"), /whatwedo/assess-envision, /power-platform-analytics-uae and /security — every one answers 200 on
www.techand.ai (curl, 19:2x UTC). The planned link up to the unwritten top page is held in `links_to_add_when_published`, not inserted.

**Schema and images.** Service (provider Organization `@id https://www.techand.ai/#organization`, `areaServed` United Arab Emirates, url
`https://www.techand.ai/ai-consulting` — the ladder row's target is `…/ai-consulting/`) and BreadcrumbList; no FAQPage, no Article /
Person (no profile on file). Three WebP images rendered (hero 1200×675 20 KB, scorecard 39 KB, phases 38 KB) with alt text, captions and
file names.

**What the customer sees.** The report row's summary: `{"qa":"Did not pass the quality check — not ready to publish (round 2 of 2): …",
"page":"Service Page","score":58,"volume":170,"hasPage":true,"keyword":"ai consulting","verdict":"GO_WITH_CHANGES","difficulty":0,
"ladderRung":1,"notReadyToPublish":true}`, the article preview, the DRAFT Word / PDF and the three images.

**Right.** The page is not offered as publishable; the reasons the owner reads are the round-2 reasons; the delivered length is
+16% over the target (2026-10-14: +47%) and the rung target was set (2026-10-14: 0 words); every internal link is live; the in-200 SERP error was retried; figures the check could not match to a source are bracketed for the
owner rather than shipped as fact (though two of them were in fact sourced, A-4); the Deloitte, McKinsey and alicelabs figures in the body
trace to their cited pages (PwC not verifiable live), and the remaining numbers are labelled "Illustrative example"; no FAQPage.

**Wrong.** **A-1** (a second page for a search the site already answers), **A-4** (High), **A-10** (the refusal is driven by a frequency
count that reports present words as missing, and the editor's cut moved coverage from 90% to 60%), **A-11** (vendasta.com's ad banner as
a subtopic — the delivered draft has a section "Serving more clients with AI-powered software"), **A-12**, **A-13** ("The editor had 2 round(s)"
— one Editor call ran), **A-20** (ladder row still `writing` while the content log says `written`), **A-24** (the Strategy Brief retry is
not in the cost figure).

**Gap to the leader.** Semrush SEO Writing Assistant checks originality against the web (Copyleaks); this run checks 8 pages it read,
which did not include the closest own page. Surfer / Clearscope compute coverage on the topic and intent picked; this coverage target
came from a US agency-software blog (vendasta.com) for a UAE enterprise service page. Writer's claim detection flags unsupported claims;
this run flags supported ones when the source writes the number in words.

**Cost.** DataForSEO $0.0241 (Keyword Data $0.0121, SERP $0.006, Facts $0.002 failed + $0.004 retry) = ledger. Claude: n8n reports
Sonnet $0.1461 measured (Competitor Analyzer, Verdict, Critic) and Opus $0.5299 from `tokenUsageEstimate` only (Strategy Brief ×2
$0.1628 + $0.1690, Copywriter $0.1071, Editor $0.0910). The ledger settled $0.8933 ("$0.4514 measured, $0.4419 estimated"), with the
Editor priced for **two** rounds ("repeated for the 1 round(s) the counter did not see", $0.4256) and the Strategy Brief for one call
whose answer counted 5 tokens. Pre-run estimate $1.51.

---

## 8. `discover` with the keyword report (protocol runs 9 and 10)

**Asked.** `{"mode":"discover","keyword":"","goal":"Get leads and enquiries","business_facts":"","features":[],"receive":["Keyword Report"]}`.
API 611 → run 612 (2.3 min) → spawned keyword report 615 (2.2 min).

**Came back** (`A-discover-612-strategy.json`, `A-discover-612-result.html`, `A-discover-612.pdf`; report row 0e23e129…, stage
`keyword_strategy`, summary `{"priority":16,"quickWins":1,"startWith":"construction project erp","researched":667}`):
- 40 seeds (10 from Search Console queries, e.g. "pdf vs e-invoice uae", "microsoft dynamics finance and operations implementation
  partner in uae"); pool **667 → 239 screened → 104 relevant** (by source: ideas 562, competitor 72, Search Console 30, suggestions 5,
  related 1; no research failures). On 2026-10-14 (553): 839 → 240 → 30.
- Search Console: 300 rows, 92 considered (dropped: brand 8, low impressions 26, duplicate 0, scraper 0); `refused: []`, `by_intent.navigational: []`.
- "9 keywords below are already answered by a page you have … Refresh those pages instead of writing new ones" and "5 keywords below are
  already covered by a keyword ladder of yours … Let that ladder finish"; priority cards for ladder-covered keywords carry "Already in
  your ladder "erp software uae"".
- "Where to start: "construction project erp" — 70 searches/mo, difficulty —, commercial intent, best page: Service Page. Reachable for
  your site · Short ladder · 4-8 months."
- 16 priority keywords live-checked ($0.032), each with "Who ranks now", page-type read ("Comparison or lists are what Google ranks here:
  9 of the 9 results read, while this plan writes a service or product page - expect to work harder …"), PAA, AI Overview observation.
- Search Console table "Why it is here": 20 rows read "the page that gets the impressions does not target this search (you rank #N with
  it)", 10 rows "you rank #N — striking distance".

**On topic, no brands / government / navigational?** Of the 104 relevant keywords none is navigational or a government term; one names
another company ("sap vs erp", relevance 1). Several are generic or small-business terms for an enterprise partner ("enterprise
resource planning", "erp", "business continuity", "cheapest erp system for small business", "erp samples").

**"Does a page answer this?" checked against the live site** (all fetched 19:2x UTC):
- /dynamics-365-finance-and-operations-uae: title "Dynamics 365 Finance & Operations UAE" (also in the inventory), H1 "Microsoft Dynamics
  365 Finance & Operations Partner in UAE", "D365" ×22, "Dubai" ×4, "support" ×22. Discover labels 18 of its queries — "d365 finance
  dubai", "microsoft d365 finance and operations dubai", "best dynamics 365 finance partner dubai", "d365 finance and operations support
  services uae", "dynamics 365 finance support partner uae", "which dynamics 365 finance partner can help migrate a retail business in
  the uae" (#6.2) … — as "the page that gets the impressions does not target this search".
- /d365-finance-operations-implementation-rollout-uae: H1 "Dynamics 365 Finance & Operations Implementation & Rollout Services" —
  labelled as not targeting "microsoft dynamics finance and operations implementation partner in uae".
- /insights/your-current-pdf-invoices-will-be-illegal-in-the-uae-by-2027-and-how-to-fix-it ("PDF" ×25, "e-invoice" ×16) — labelled as not
  targeting "pdf vs e-invoice uae".
See **A-2**. Six of those same queries then appear as **priority keywords #10 and #12-#16** (#11 is "erp for trading business") with a new page type ("Location Page" /
"Landing Page"), "Reachable for your site · Short ladder · 4-8 months", "Your position: not in top 20", and "Search Console already
measured N impressions for this exact search on your site" — the cards read (#10, #13, #15, #16) do not name the existing page; for #13 Search Console's average
position is **6.2** and for #16 **9.6**. See **A-3**.

**The keyword report (615) — consistency with discover.** "construction project erp": volume 70, CPC 15.14, trend −73% yearly / −57%
quarterly, KD null, "Reachable · Short · 4-8 months, fair (30-50%)" — identical in both. Verdict **GO_WITH_CHANGES 46**: "The head term
alone will not produce meaningful lead volume"; risks "The head term's volume is tiny and falling, so traffic will be negligible", "The
SERP is mostly open-source ERPNext/Odoo and generic vendor results, so only Dynamics 365 Business Central-led content fits the offer.
Free and open-source searchers will not convert"; change "Retarget the page at 'construction ERP UAE' and 'ERP for contractors in
Dubai'". The two SERP reads 53 s apart disagree: discover's card (19:07:49) "Who ranks now: openconstructionerp.com, erpfocus.com,
cmicglobal.ae, euclidz.com, linkedin.com"; the report (19:08:42, same location 2784 / desktop) ranks frappe.io, oracle.com,
projectmanager.com, frappe.io, bouwflow.be in the top 5 — no domain in common in the top 5. Neither output mentions the difference.
Construction is not among the industries techand.ai lists (BFSI, public sector, tourism, trading & manufacturing, retail, professional
services, non-profit). See **A-18**.

**Right.** The pool, screening and refusal counts are reported; Search Console seeds are real queries with impressions; ladder-covered and
page-covered keywords are named at the top with the instruction not to write a second page; every priority keyword was live-checked with
a timestamp and a page-type read; the follow-up's figures match discover's.

**Wrong.** **A-2**, **A-3** (both High), **A-18**, **A-22** (mixed hosts: `page_mismatch` rows carry `https://techand.ai/…`, `striking`
rows `https://www.techand.ai/…`), **A-23** ("dynamics 365 finance vat compliance uae" "answered by" https://www.techand.ai/insights —
the blog index — while the dedicated article /insights/how-microsoft-dynamics-365-finance-operations-supports-uae-vat-compliance exists),
**A-25** (the "Content plan" Now tier and "Build first" list topic "erp software uae" first while its keywords are the same search as the
planned ladder "erp software uae", which the paragraph above tells the owner to let finish). Discovery's SERP clustering uses
`min_shared_urls 3`, `top_n 0`, `min_overlap_pct null` while the ladder uses top 7 / 40% — two rules for the same question in one run
set.

**Gap to the leader.** The criteria's 10-anchor for sources ("Search Console striking distance / impressions with no page") is what
this run tries to do; the leaders that do it (Surfer's internal-link suggestions from Search Console, Clearscope's content inventory)
match a query to the page by its content; this run matches by literal tokens of slug / title, so "d365 … dubai" does not match a page
titled "Dynamics 365 Finance & Operations UAE".

**Cost.** Discover DataForSEO $0.2478 (research $0.1508, competitor keywords $0.0450, candidate SERP $0.0320, AI demand $0.0200) =
ledger; Claude n8n $0.1648 (Keyword Seeds + 3 Keyword Relevance calls, `MEASURED`, 4,207 / 4,534 / 4,245 output tokens), ledger $0.0653
("counted … 15 answer token(s) across 3 call(s)" + modelled thinking). Keyword report DataForSEO $0.0221 = ledger; Claude n8n $0.0888,
ledger $0.0752.

---

## 9. What each report put in front of the customer (`reports`, received_at UTC)

| received | id | stage | title | summary |
|---|---|---|---|---|
| 19:05:46 | 301ae0cd | site_description | Site description · techand.ai | name "Tech&", one-line summary |
| 19:07:38 | 44818f6f | content | Keyword report: e invoicing software uae | Service Page · score 58 · volume 40 · hasPage false · GO_WITH_CHANGES |
| 19:08:07 | 0e23e129 | keyword_strategy | Keyword strategy · techand.ai | priority 16 · quickWins 1 · startWith "construction project erp" · researched 667 |
| 19:09:11 | 4db246f7 | ladder_plan | Ladder plan: ai consulting dubai | "Reachable for your site · Short ladder · 4-8 months" · 4 pages · writeNow 1 · GO_WITH_CHANGES |
| 19:10:12 | aca996c8 | content | Keyword report: construction project erp | Service Page · score 46 · volume 70 · GO_WITH_CHANGES |
| 19:23:00 | 338c4333 | content | Page: ai consulting | "Did not pass the quality check — not ready to publish (round 2 of 2) …" · notReadyToPublish true |

(`hasPage` is the app's "a page was written" flag, `summaries.ts:39` — not "the site has a page".)

---

## 10. Cost across this part — the engine's figures against n8n's

| Exec | DataForSEO tasks | Ledger `dfs_usd` | Claude, n8n (measured / estimate) | Ledger `ai_usd` | Ledger basis (quoted part) |
|---|---|---|---|---|---|
| 598-600 | $0.0721 | $0.0721 | $0.0087 / — | $0.006 | "the Haiku topic-fit call at the list prices" (estimate) |
| 601-604 | 0 | no row | $0.0129 / — | no row | — |
| 606 | 0 | 0 | $0.0117 / — | $0.0039 | "counted 3919 prompt and 4 answer token(s)" |
| 608 | $0.0241 | $0.0241 | $0.1145 / — | $0.0848 | "counted 15823 prompt and 5 answer token(s)" (Competitor Analyzer; real output 4,251) |
| 610 | $0.1404 | $0.1404 | $0.1167 / — | $0.0882 | each node "5 answer token(s)" |
| 612 | $0.2478 | $0.2478 | $0.1648 / — | $0.0653 | "15 answer token(s) across 3 call(s)" (real 12,986) |
| 615 | $0.0221 | $0.0221 | $0.0888 / — | $0.0752 | "5 answer token(s)" |
| 616 | $0.0241 | $0.0241 | $0.1461 / $0.5299 | $0.8933 | Editor "repeated for the 1 round(s) the counter did not see"; Strategy Brief counted once |
| **Total** | **$0.5306** | **$0.5306** | **$0.6642 / $0.5299** | **$1.2167** | |

DataForSEO: every run's ledger equals the sum of its own task costs, each task once (a failed task's $0.002 included). Claude: on the
eight Sonnet / Haiku executions where n8n reports real usage, the ledger is **15-67% below** it ($0.3234 vs $0.5052) because the answer of every
structured agent is counted as 4-15 tokens, and the Keyword Check books a fixed $0.002 estimate (**A-14**); on the page run the ledger is
above n8n's figure, which for the four Opus calls is itself only a `tokenUsageEstimate`, and the ledger prices an Editor round that did
not run (**A-13**) while leaving out the rejected first Strategy Brief call (**A-24**) — neither figure for 616 is a measurement. Day check in the ledger rows: "the account fell $0.7018 between 09:45:25 and 19:09:13 while 10 settled run(s) report
$0.5949 — they do NOT agree ($-0.1069, -15.2%); the account is the figure to believe" (row 89) — the engine reports its own disagreement
with the balance.

---

## Findings

**A-1 · High · The ladder plans three new "AI consulting" service pages and writes one, on a site that has a live "AI Consulting" page.**
Exec 610, `Ladder Plan` note: "Nothing on techand.ai is about "ai consulting dubai" yet — no page and no keyword it ranks for — so all 4
page(s) in this plan are new". The run's own inventory (`Load Pages (Model)`, 45 rows) holds https://www.techand.ai/ai-copilot-advisory-uae
with `title: ""`; the live page's title is "AI Consulting & Copilot Advisory UAE | Tech&", H1 "AI Consulting & Copilot Advisory Services in
UAE" (fetched 19:18 UTC). The plan's pages /ai-consulting/, /ai-consulting-firm/ and /ai-consulting-dubai/ target the same search; the
rung-1 page (616) was written and itself links to /ai-copilot-advisory-uae; 616's verdict has `existing_page: null`; the originality check
did not compare against it. Correct output: match the existing page (by its live title / H1, not the slug), plan the ladder around it
("improve" it as the top or a rung page) and say so.

**A-2 · High · Discover tells the owner that 20 of their pages do not target searches they plainly target.** Exec 612,
`keyword_strategy.search_console.queries`: 20 rows `kinds: ["page_mismatch"]`, "the page that gets the impressions does not target this
search", e.g. "d365 finance dubai", "best dynamics 365 finance partner dubai", "d365 finance and operations support services uae" →
/dynamics-365-finance-and-operations-uae (H1 "Microsoft Dynamics 365 Finance & Operations Partner in UAE"); "microsoft dynamics finance
and operations implementation partner in uae" → /d365-finance-operations-implementation-rollout-uae (H1 "Dynamics 365 Finance &
Operations Implementation & Rollout Services"); "pdf vs e-invoice uae" → the "Your Current PDF Invoices Will Be Illegal in the UAE by
2027" article. Printed in the report's Search Console table. Correct output: "striking distance / low position on the page that targets
it — improve that page", with the match made on the page's title and H1 rather than literal tokens ("d365" ≠ "dynamics 365", "dubai" ≠
"uae").

**A-3 · High · Discover recommends new pages for searches the site already ranks for with a dedicated page.** Exec 612 priority #10 and #12-#16
(all `sources: ["search_console"]`): "microsoft dynamics finance and operations implementation partner in uae" (Location Page),
"d365 finance and operations support services dubai", "which dynamics 365 finance partner can help migrate a retail business in the uae"
(Landing Page; Search Console average position **6.2** with /dynamics-365-finance-and-operations-uae), "dynamics 365 finance support partner
uae", "dynamics 365 finance and operations retail partner uae", "dynamics 365 finance and operations pricing dubai" (GSC **9.6**) — each
"Reachable for your site · Short ladder · 4-8 months", "Your position: not in top 20" (the live check), with `covered_by: null`. The
existing page is in the data (`gsc.page`) but the cards read (#10, #13, #15, #16, `A-discover-612-result.html`) do not name it — they say only "Search Console already measured N impressions for this exact search on your site". Correct output: list them under "already answered by a page you have", name the page, and show
Search Console's position beside the live check's.

**A-4 · High · The page's QA masks two correctly sourced figures and tells the owner the source does not carry them.** Exec 616,
`Content QA` round 2: `unverified_figures: [{"figure":"40%","sources":["mckinsey.com"]},{"figure":"27%",…}]`, reason "Figures the cited
source does not carry (now marked [Confirm: …]): "40%" (mckinsey.com); "27%" (mckinsey.com)". The run's own evidence
(`A-page-616-facts.json`, mckinsey.com): "Forty percent of respondents from large organizations (those with annual revenues of more than
$1 billion) report scaling AI agents, up from 27 …"; McKinsey's "The state of AI in 2026: On the road to ROI" states 40 percent, up from
27 percent. The figure check (`v5/code/_sources.js` figure pattern) reads digits with "%" / "percent" and not a number written in words,
and the snippet is cut before "percent". Correct output: accept "Forty percent" as 40%, or report "could not be confirmed from the
snippet" — not "the source does not carry".

**A-5 · High · The verdict states what the customer's own page lacks, and three of its statements are false.** Exec 608,
`verdict_reasons[3]`: "Its visible text has no mandate dates, no PINT-AE or 5-corner explanation, no tables, no lead CTA and no author or
date." The live page states the 30 October 2026 / 1 January 2027 dates, holds 3 HTML tables and a visible byline (Muhammad Aarish,
System Architect) with Article schema `author` and `datePublished` 2026-09-26. The run read 9,000 characters (`existing_page_text`,
1,248 words of ~2,100) with tables flattened, and even that text contains "30 October" and "2027"; `client_signals.credentials` holds
"Accredited Service Provider (ASP) by 30 October 2026". Correct output: read the whole page (or say what was not read), keep table
structure, and state only what the read text supports ("no PINT-AE or 5-corner explanation; no visible date").

**A-6 · Medium · Off-topic and other-brand keywords on the AI-consulting ladder.** Exec 610 rung 2 page "supply chain optimization
consulting" with "supply chain operations / logistics / risk consulting" (10 searches each; the engine's relevance pass rated it 1; SERPs
are IBM, KPMG, Hackett Group, job boards), kept because it shares "consult" with the head ("ai" is not among "the words that matter");
and "openai consulting" (SERP about OpenAI's own consulting company) as supporting keyword of rung 2 "ai consulting firm". Correct output:
a rung must keep the head's topic ("ai") — the supply-chain page off this ladder, "openai consulting" refused as another company's brand.

**A-7 · Medium · Keywords whose results do not overlap are merged onto one page.** Exec 610: the cluster check found no pair sharing 3
of the top 7 (recomputed: max 1), yet rung pages group 4 supply-chain keywords and "ai consulting firm" + "openai consulting" with
`grouped_by: "topic label (no search Google answers with the same pages)"`. Correct output: the measured overlap decides; keywords that
Google answers with different pages stay separate or are dropped.

**A-8 · Medium · Two traffic figures for the same head term in one ladder report.** Exec 610: top page `traffic_potential: 12` (40 × 0.3,
`Ladder_Plan.js:220`, no click loss) and the verdict's `expected_visits.visits: 6` after "an AI Overview (-52% of the clicks …)"; the
report's `traffic_potential_total` (57) includes the 12. Correct output: one figure, with the same click loss the rest of the plan uses.

**A-9 · Medium · A sixth active ladder and a fourth unpublished page, with no word in the plan.** Exec 610 wrote `seo_ladder_settings`
`lad_mv9wshpdy2jf` `status: "active"` while 5 other ladders were `active` and the `_site` row says `max_active: 2`; it spawned 616 while
`seo_content_log` held 3 `written`, unpublished pages and the same `_site` row says `max_waiting: 3`. Correct output: either refuse / queue the ladder or state in the
plan that it exceeds the site's limits.

**A-10 · Medium · The refusal reason reports present words as missing, and the editor's cut caused the failure.** Exec 616 round 1: 2,793
words, coverage 90% (met); the editor cut to 2,197 words; round 2 coverage 60% with "work these terms in …: strategy, technology,
consulting firms, consulting services, change management, management, customer service, building". The delivered page contains strategy
×9, change management ×2, management ×2, consulting services ×2, technology / consulting firms / customer service / building ×1 each;
`term_coverage` shows "missing" means below a frequency target (strategy 7 found vs 8 target, from the round-2 text). Correct output: say
"used N times against M on the best page", and do not let the length cut and the coverage count fail each other.

**A-11 · Medium · Coverage targets and subtopics copied from pages that do not match the page being written.** Exec 616: best page
vendasta.com (a US agency-software blog), subtopic "Acquire and serve 10x more clients with AI-powered software" (its promotional banner)
— the draft gained a section "Serving more clients with AI-powered software". Exec 610: the top page's subtopics come from digiscorp.com's
listicle — "2. Accenture AI & Analytics", "3. IBM AI Consulting", "10. G42 AI Solutions" — for a Service Page. Correct output: take the
target from results of the page type being written, and drop navigation / promo blocks and other companies' entries.

**A-12 · Medium · Placeholders in the delivered page are not counted.** Exec 616 round 2: `placeholder_count: 0`, `placeholders_in_body:
[]`; the body carries `[Confirm: edition year and sample size]` and "*Checklist reviewed by [name, role], [date].*" in addition to the two
`[Confirm: x%]` figures; only the figures are named in the reasons. Correct output: count every bracket left for the owner and list it.

**A-13 · Low · "The editor had 2 round(s)".** Exec 616: `Claude — Editor [0]` / `Editor [0]` ran once (235 s); the QA note says two
rounds, and the ledger prices a second ("repeated for the 1 round(s) the counter did not see", Editor $0.4256). Correct output: "1 editor
round", priced once.

**A-14 · Medium · The Claude cost ledger counts structured answers as a handful of tokens and calls it measured.** Execs 606, 608, 610,
612, 615, 616: `Prompt For Count (…)` sends `__answer: "[object Object]"` to count_tokens (seen in 606 Site Describer, 608 Competitor Analyzer, 612 Keyword Relevance ×3, 616 Critic), so every structured agent's answer counts 4-6
tokens ("counted 3919 prompt and 4 answer token(s)"; real output 1,368 tokens in 606, 4,251 in 608's Competitor Analyzer, 12,986 across
612's three relevance calls). Ledger Claude $0.3234 vs n8n-reported $0.5052 on those runs (−15% to −67% per run: 606 −67%, 612 −60%, 598-600 −31%, 608 −26%, 610 −24%, 615 −15%), each labelled "measured:
… counted the prompt and the answer of every call". The Keyword Check settles a fixed $0.002 estimate per call; the Reply Reader writes no
ledger row ($0.0129 unrecorded). Correct output: count the serialized answer, or label the figure estimated.

**A-15 · Low · "FTA-accredited ASP".** Exec 608, `verdict_risks[2]`: "If it is not an FTA-accredited ASP …". ASPs are accredited by
the Ministry of Finance (the system's own prospect data cites "eInvoicing Accredited Service Providers (ASPs) | Ministry of Finance").
Correct output: "a Ministry of Finance accredited ASP".

**A-16 · Medium · A "good (50-70%)" chance for a site with no measured ranking.** Exec 598: "erp software uae" → "estimated chance good
(50-70%, uncalibrated)", "Easy · Direct · 2-4 months", from `reach 10` with `reach_info: {method: "size", sample: 0, top10: 0}` and
"no topic evidence", printed beside "only 1.74% of new pages reach Google's top 10 within a year". The same band appears in discover for
"best erp software in uae". Correct output: no band (as for the no-data keywords) until the reach rests on ranked keywords, or a band
derived from the stated base rate.

**A-17 · Medium · The Keyword Check does not mention an existing ladder or page for the same keyword.** Execs 598 and 600: "erp software
uae" is the head of active ladder `lad_mv40b6s9h5a8` and has a `written` page in `seo_content_log` (2026-10-12); "dynamics 365 partner uae"
is the head of paused ladder `lad_mv4vxu3bq0kl`. The engine received both as `existing_keywords` (25 sent) and used them only to filter alternatives. Whether the
app's form adds a duplicate warning was not exercised. Correct output: say "you already have a ladder / page for this search".

**A-18 · Medium · Discover's "where to start" pick is a falling keyword its own follow-up advises against, read from a volatile SERP.**
Exec 612 `pipeline_keyword` "construction project erp" (70/month, −73% yearly, −57% quarterly); exec 615 says "traffic will be
negligible" and "Free and open-source searchers will not convert"; construction is not among the site's industries. The two SERP reads
53 s apart share no top-5 domain, and each report presents its own as "who ranks now". Correct output: rank declining terms down, and
say when two reads of the same results page disagree.

**A-19 · Low · `describe` page titles and facts.** Exec 606: the five nav pages listed with one identical title (rendered-reader title)
instead of their HTML titles; `site_facts` mixes section headings and article titles with facts; `nav_pages` holds one "Read more" link on
the bare host. Correct output: the pages' HTML titles; facts only.

**A-20 · Low · Ladder row and content log disagree.** After 616: `seo_ladders` rung 1 "ai consulting" `status: "writing"`;
`seo_content_log` "ai consulting" `status: "written"`. (The 2026-10-14 rung page was left the same way.) Correct output: one state for one
draft, e.g. both "written — not ready".

**A-21 · Low · Results pages bought before the relevance filter.** Exec 610 bought cluster SERPs ($0.002 each) for "transfer pricing
consulting", "supply chain consulting uk" and "supply chain consulting meaning", which `Ladder Keyword Relevance` then rated 0. Correct
output: filter first, then buy.

**A-22 · Low · Mixed hosts in discover's Search Console rows.** Exec 612: `page_mismatch` rows `answered_by.url` on `https://techand.ai/…`,
`striking` rows on `https://www.techand.ai/…` (canonical). Correct output: the canonical host throughout.

**A-23 · Low · "Already answered by" the blog index.** Exec 612 `covered`: "dynamics 365 finance vat compliance uae" →
https://www.techand.ai/insights (`matched_by: "query"`), with "Refresh those pages". The dedicated article
/insights/how-microsoft-dynamics-365-finance-operations-supports-uae-vat-compliance is in the sitemap. Correct output: point at the
article (and flag that Google shows the index for it).

**A-24 · Low · A rejected Strategy Brief is re-asked without a trace in the cost.** Exec 616: `Parser — Strategy Brief [0]` error "Model
output doesn't fit required format", second Opus call (129 s, ~$0.17 by n8n's estimate); the ledger's Strategy Brief line is one call.
Correct output: price both calls and note the retry.

**A-25 · Medium · Discover's content plan puts first a topic its own header says to leave to an existing ladder.** Exec 612: the header
says "best erp software in uae" and "erp software company dubai" are "already covered by a keyword ladder of yours … Let that ladder
finish"; the "Build first" line and the Content plan's **Now** tier then list "erp software uae (Landing Page, 210/mo across 2
keywords)" — those two keywords — first, without the ladder note (the cluster object carries `ladder_covered`). Correct output: carry
the ladder note into the plan tiers or leave the topic out of "Build first".

---

## What could not be exercised, and why

- The app's own run path (form → `runs` row → n8n): the toolkit posts the app's body directly, so the reports carry `scheduled: true`;
  the browser UI was not driven (owner's session needed).
- The Reply Reader's effect in the app (sequence stop, out-of-office pause and resume, suppression): no mailbox may be connected.
- A content run with a business profile or a style guide: none on file (`style_guide: null`, no author / reviewer).
- Publishing / the live publish check for the written page: nothing may be published.
- The PDF / Word deliverables' contents: saved (`A-page-616-DRAFT.pdf`, `.doc`, `A-verdict-608.pdf`, `A-discover-612.pdf`) but not
  rendered — no PDF renderer on this Mac.
- The PwC quotation in the draft: pwc.com answered 403 to a direct fetch; only the search snippet the run held supports it.
- The McKinsey page itself: the direct fetch timed out; the figures were confirmed through a web search that lists McKinsey's own PDF.

## State left behind

- `seo_monitors` (techand.ai): unchanged except `updated_at` 2026-10-15T19:02:13.798Z and `request_id` "rr1015-lb-on"; `link_builder: true`.
- New ladder **`lad_mv9wshpdy2jf`** "ai consulting dubai": 4 `seo_ladders` rows (rung 1 "ai consulting" `writing`; rung 2 "ai consulting
  firm" `planned`; rung 2 "supply chain optimization consulting" `planned`; top "ai consulting dubai" `planned`) and a
  `seo_ladder_settings` row (`auto`, priority 7, **`active`**). Given A-1, A-6 and A-9, **consider pausing or deleting it**: as it stands
  the Content Cadence may write its next rung.
- New `seo_content_log` row "ai consulting" `written` (source `ladder`) — a draft "not ready to publish"; nothing published. The site then
  has 4 written, unpublished pages.
- `seo_run_ledger` rows 80, 81, 82, 83, 84, 85, 86, 88, 89 — all `done`; none left `reserved`.
- Cost-calibration rows written by `Save Cost Calibration` in 606, 608, 610, 612, 615 and 616.
- 6 rows in the app's `reports` table and their files (Word, PDF, 3 WebP images).
- No e-mail sent, no mailbox connected, no WordPress push, no Bing / IndexNow submission, no Test Runner use, no audit or monitor started.
