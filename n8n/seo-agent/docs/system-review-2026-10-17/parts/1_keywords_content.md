# Part 1 — Keywords, verdicts, ladders, content and the Reply Reader (executor A)

Live runs on techand.ai (country United Arab Emirates), 2026-10-17. Executor A ran protocol runs 1, 3, 4, 5, 6, 7, 9, 10 and 11, plus
two extra Keyword Checks used to choose the new ladder's keyword (§6). Every API run was sent the way the web app sends it
(`X-Forwarded-For: app:<techand.ai company>`, the company's own callback) through the re-rating toolkit. Executor B ran a technical
audit (739) and a full report (767) of the same site in the same window; executor D drove the app. They are not described here.

| | |
|---|---|
| First call / last execution end | 15:58:46 UTC (Site Admin 736) / 16:22:28 UTC (page run 771) |
| Executions created by this part | 736, 737, 749, 750, 751, 753, 754, 755, 756, 757, 758, 759, 760, 761, 762, 763, 764, 765, 769, 770, 771 — all `success` |
| DataForSEO balance | **$8.022516** at 15:58:37 ("A start", day total $0.092) → **$6.922601** at 16:25:46 ("A end", day total $1.191915). Intermediate reads ($7.590 at 16:02, $7.812 at 16:03, $7.395 at 16:08) moved non-monotonically while tasks were in flight; only the two end points are used. |
| Balance moved in the window | **$1.099915**, shared with executor B. This part's runs report **$0.6274** from their own DataForSEO tasks; B's two ledger rows (739 $0.0954, 767 $0.3770) bring the engine's total to **$1.0998** — $0.0001 from the account's movement. |
| Claude (n8n token counts, `RR claude`) | **$1.0354** over 27 calls: **$0.6787** from `tokenUsage` (measured) + **$0.3567** from `tokenUsageEstimate` only (the three Opus 5.5 streaming calls of page run 771). The engine's own ledger for the same runs: **$1.5984** — see §10 |
| Reports that reached the app | 6: `site_description` (757), `content` "Keyword report: e invoicing software uae" (759), `keyword_strategy` (763), `content` "Keyword report: erp system dubai" (763 → 765), `ladder_plan` "Ladder plan: it consulting dubai" (769), `content` "Page: it consulting dubai" (769 → 771) |

Artefacts (git-ignored `docs/system-review-2026-10-17/files/`): `A-monitors-before.json` / `-after.json`, `A-assess-*.json` (5),
`A-reply-reader.json`, `A-report-*.json` (6), `A-verdict-760-parse.json`, `A-discover-764-strategy.json`, `A-discover-764-result.html`,
`A-kwreport-765-verdict.json`, `A-ladder-770-plan.json`, `A-ladder-770-rows.json` / `-rows-after.json`, `A-ladder-770-cluster-serps.json`
(top-7 of every results page the ladder bought), `A-page-771.md` / `.html`, `A-page-771-qa-round1.json` / `-round2.json`,
`A-ladders-before.json`, `A-ladder-settings-before.json` / `-after.json`, `A-content-log-before.json` / `-after.json`,
`A-seo-pages-before.json`, `A-exec-<id>.json` for every execution above.

---

## Runs

"DataForSEO" = the sum of the costs the run's own DataForSEO tasks reported (each task id once) / its `seo_run_ledger` row
(`dfs_usd`, status). "Claude" = n8n's per-call token counts at list prices (measured = `tokenUsage`, estimate = `tokenUsageEstimate`
only) / the ledger's `ai_usd`.

| # | What | Request | Executions (API → run → spawned) | Start–end UTC | Duration | DataForSEO (tasks / ledger) | Claude (n8n / ledger) | Status |
|---|---|---|---|---|---|---|---|---|
| — | Balance | — | — | 15:58:37 | — | $8.022516 | — | — |
| 1 | Site Admin `monitors`, `link_builder: true` | rr1017-lb-on | 736 → 737 | 15:58:46.5–15:58:47.7 | 1.3 s | 0 | 0 | 200, `affected: 1` |
| 5 | Keyword Check "erp software uae" | toolkit `assess` | 749 | 16:01:09.2–16:01:14.4 | 5.2 s | $0.0241 / $0.0241, row 137 done | $0.0029 measured / $0.002 | 200 |
| 5 | Keyword Check "business central partner uae" | `assess` | 750 | 16:01:14.7–16:01:20.0 | 5.4 s | $0.024 / $0.024, row 138 | $0.0033 / $0.002 | 200 |
| 5 | Keyword Check "dynamics 365 partner uae" | `assess` | 751 | 16:01:20.3–16:01:25.1 | 4.7 s | $0.024 / $0.024, row 139 | $0.0030 / $0.002 | 200 |
| 11 | Reply Reader (a) interested + questions | synthetic | 753 | 16:01:59.7–16:02:07.7 | 8.0 s | 0 | $0.0044 / $0.002 (row 140) | 200, `question` |
| 11 | Reply Reader (b) out-of-office | synthetic | 754 | 16:02:07.7–16:02:12.6 | 4.8 s | 0 | $0.0033 / $0.0013 (row 141) | 200, `out_of_office` |
| 11 | Reply Reader (c) remove me | synthetic | 755 | 16:02:12.6–16:02:15.4 | 2.8 s | 0 | $0.0024 / $0.0012 (row 142) | 200, `unsubscribe` |
| 11 | Reply Reader (d) "we added your link" (real page) | synthetic | 756 | 16:02:15.4–16:02:20.4 | 5.0 s | 0 | $0.0026 / $0.0014 (row 143) | 200, `says_linked`, link `found` |
| 3 | `describe` | rr1017-describe | 757 → 758 | 16:02:42.5–16:03:26.5 | 42.5 s | $0 / $0, row 144 done | $0.0098 / $0.0073 | completed |
| 4 | `verdict` "e invoicing software uae" | rr1017-verdict | 759 → 760 | 16:02:44.0–16:05:01.5 | 2.3 min | $0.0221 / $0.0221, row 145 | $0.1234 / $0.1509 | GO_WITH_CHANGES **52** |
| — | Keyword Check "retail erp software uae" (ladder candidate) | `assess` | 761 | 16:03:19.8–16:03:25.1 | 5.4 s | $0.024 / $0.024, row 146 | $0.0029 / $0.002 | 200 |
| — | Keyword Check "warehouse management system uae" (ladder candidate) | `assess` | 762 | 16:03:40.8–16:03:45.8 | 5.0 s | $0.0241 / $0.0241, row 147 | $0.0032 / $0.002 | 200 |
| 9 | `discover`, `receive: ["Keyword Report"]`, `features: []` | rr1017-discover | 763 → 764 → 765 | 16:03:53.0–16:05:57.4 | 2.1 min | $0.2754 / $0.2754, row 148 | $0.1601 / $0.1906 | completed, 1,168 → 240 → 16 |
| 10 | → keyword report "erp system dubai" (spawned) | 763 | 765 | 16:05:46.6–16:07:56.8 | 2.2 min | $0.0241 / $0.0241, row 149 | $0.0925 / $0.12 | GO_WITH_CHANGES **66** |
| 6 | `ladder` "it consulting dubai", `pages_now` 1 | rr1017-ladder | 769 → 770 → 771 | 16:09:10.8–16:11:46.1 | 2.6 min | $0.1615 / $0.1615, row 151 | $0.1143 / $0.1478 | completed, 4 pages, `lad_mvcldcnv9q1q` |
| 7 | → ladder top page "it consulting dubai" (spawned) | 769 | 771 | 16:11:42.6–16:22:28.1 | 10.8 min | $0.0241 / $0.0241, row 152 | $0.1506 measured + $0.3567 estimate / $0.9659 | completed, **"did not pass the quality check — not ready to publish"** |
| — | Balance | — | — | 16:25:46 | — | $6.922601 | — | — |

The order differs from the protocol's numbering: describe and verdict ran first, then discover, and the ladder keyword was chosen after
discover (§6). No more than three of this part's analyses were in flight at once (describe + verdict + discover at 16:03–16:05; the page
run 771 overlapped only the end of the ladder run). Durations against 2026-10-15 (same protocol numbers): Keyword Check 3.9–5.7 s →
4.7–5.4 s; Reply Reader 2.0–7.4 s → 2.8–8.0 s; describe 56 s → 42.5 s; verdict 2.4 → 2.3 min; discover 2.3 → 2.1 min; keyword report 2.2
→ 2.2 min; ladder 3.6 → 2.6 min; page 13.9 → 10.8 min (no Strategy Brief retry today).

The six reports carry `scheduled: true` because the toolkit posts to n8n directly and the app has no run row for them — this is how the
toolkit works, not product behaviour.

---

## 1. Site Admin `monitors` (protocol run 1)

**Asked.** `{"action":"monitors","domain":"techand.ai","monitors":{"link_builder":true},"request_id":"rr1017-lb-on"}`.

**Came back.** 200 in 1.32 s: `{"ok":true,"action":"monitors","site_id":"site_techand-ai","domain":"techand.ai","affected":1,"error":null}`
(736 Admin API → 737 Site Admin).

**Right.** `A-monitors-before.json` vs `A-monitors-after.json` differ only in `updated_at` (2026-10-15T19:02:13.798Z →
2026-10-17T15:58:47.631Z), `request_id` (rr1015-lb-on → rr1017-lb-on) and `updatedAt`. Every other field is unchanged: `link_builder
true`, `ai_prompts_max 8`, six `ai_engines`, `competitors` "cleartax.com, azentio.com", `brand_names` "Techand", `ai_pulse`, `ai_growth`,
`audit_pages 200`.

**Wrong.** Nothing found. **Cost.** None.

---

## 2. Keyword Check ×3 (protocol run 5)

**Asked.** The app's `assessBody()`: keyword, country, domain, `services: []`, and `existing_keywords` — 29 keywords (every ladder keyword
of the domain, including "erp software uae", "dynamics 365 partner uae", "erp software dubai", "erp implementation dubai").

**Came back** (`A-assess-*.json`):

| Keyword | volume | KD | CPC | label | chance | `existing` |
|---|---|---|---|---|---|---|
| erp software uae (749) | 480 | 3 | 12.59 | "Easy for your site · Direct plan · 2-4 months · already one of your keywords" | "no estimated chance (no measured ranking to judge it by)" | ladder `lad_mv40b6s9h5a8` (`ladder_status` "writing", rung 4), page https://www.techand.ai/erp-software-uae/ `written` — "continue that ladder / improve that page rather than starting a second one for the same search" |
| business central partner uae (750) | null | null | null | "Reachable for your site · Short ladder · 4-8 months · no search data" | null, "No estimated chance: DataForSEO has no search volume and no difficulty …" | **null** |
| dynamics 365 partner uae (751) | null | null | null | "Reachable for your site · Short ladder · 4-8 months · already one of your keywords · no search data" | null | ladder `lad_mv4vxu3bq0kl`, `ladder_status` "planned", page https://www.techand.ai/dynamics-365-crm-uae |

All three carry `fit 2`, `alternatives []`, `warnings` (the two no-data keywords: "DataForSEO has no data for this keyword in United Arab
Emirates (volume and difficulty unknown)") and the same `reach_note`: the plan is judged against the site-wide reach 10 "because the reach
stored on 2026-10-08 was kept without the keywords behind it … treat the months and the chance below as the optimistic case". For
"erp software uae" the chance text now reads "No estimated chance: the reach this plan is judged against rests on no measured ranking …
Base rate (Ahrefs, 2025): only 1.74% of new pages reach Google's top 10 within a year".

**What the customer sees.** Synchronous; no `reports` row. The form shows the answer above.

**Right.** On 2026-10-15 (exec 598) the same keyword was shown "estimated chance good (50-70%, uncalibrated)" from the same unmeasured
reach; today no band is printed. On 2026-10-15 (598, 600) neither answer mentioned the existing ladders; today both "erp software uae" and
"dynamics 365 partner uae" say "already one of your keywords", name the ladder and the page, and advise against a second page. Volume,
KD and CPC match `Run Assess Requests` (task status 20000).

**Wrong.** **A-1**: "business central partner uae" returns `existing: null` although the site has a live page whose H1 is "Certified
Microsoft Dynamics 365 Business Central Partner in UAE" (https://www.techand.ai/dynamics-365-business-central-uae, title "Business Central
ERP Solutions in UAE | Tech&", fetched 16:0x UTC; also in `seo_pages` with that title). **A-2** (Low): for "dynamics 365 partner uae" the
answer says `ladder_status: "planned"`; that ladder's `seo_ladder_settings` row is `paused`. The ledger books the Haiku fit call at a fixed
$0.002 against $0.0029–0.0033 reported by n8n (§10).

The two candidate checks (761, 762, §6): "retail erp software uae" → no search data, and `existing` = ladder `lad_mv40b6s9h5a8` with
`how: "the same search"` as "erp software uae" — a text-similarity judgement; no results page was read to support "the same search" (not
verified either way). "warehouse management system uae" → volume 10, DataForSEO intent "navigational", `fit 1`.

**Gap to the leader.** Semrush's Personal KD / MarketMuse's Personalized Difficulty compare the site's topical authority with the SERP;
here every check rests on one site-size reach (10) cached on 2026-10-08 with no keywords behind it, and two of three keywords have no
difficulty at all. The existing-page match reads the ladder table, not the site's page inventory (A-1).

**Cost.** DataForSEO $0.0721 for the three = ledger rows 137–139. Claude $0.0092 measured by n8n; ledger $0.006.

---

## 3. Reply Reader ×4 (protocol run 11)

**Asked.** The four 2026-10-15 bodies, unchanged except `received_at` (2026-10-17T16:05:00Z): `business` "techand.ai", `signer` "Test
Sender, Partnerships, Tech&", no facts / profile. Every `reply_from` is on example.com; (a)–(c) use example.com / example.org pages; (d)
uses https://peppol.org/members/full-members-list/, which links to techand.ai (fetched 16:01 UTC: `<a href="https://techand.ai/">`).

| Case | class | summary | return / referral | needs_you | suggested reply | link check |
|---|---|---|---|---|---|---|
| (a) 753 | `question` | "Editor interested in adding us but asks: Peppol go-lives in UAE, ASP accreditation status, typical implementation costs." | referral_email = **the sender's own address** | true | "To answer your questions: [Owner: how many Peppol go-lives has Tech& completed in the UAE?] [Owner: is Tech& an accredited service provider (ASP) with the Ministry of Finance?] [Owner: what does a typical implementation cost for a mid-size distributor?]" | example.com page `gone` |
| (b) 754 | `out_of_office` | "Auto-reply: out on annual leave until Monday 2 November 2026." | `2026-11-02` / the colleague's desk@ address | false | "" | `gone` |
| (c) 755 | `unsubscribe` | "Recipient declines and requests removal from mailing list." | — | false | "" | `gone` |
| (d) 756 | `says_linked` | "Link added to members list and confirmed live on peppol.org." | — | false | thanks note | **`found`, rel `follow`, anchor `https://techand.ai/`, placement `content`** |

**Right.** All four classes match the replies; no business fact was invented in (a) (each question left as an `[Owner: …]` bracket,
`unverified: []`); the OOO date is parsed to ISO with the colleague captured; the "linked" claim was checked by our own fetch before the
thank-you was drafted. Same classes as 2026-10-15 (601–604). New today: each call writes a ledger row (140–143).

**Wrong.** **A-3** (Low): in (a) `referral_email` is the replier's own address (the reply refers nobody). Ledger rows 140–143 settle
$0.0059 against $0.0127 reported by n8n (−54%) and carry the key `schedule:reply_read` for an app-shaped call (§10).

**Gap to the leader.** Pitchbox / BuzzStream-class tools stop a sequence on a reply; this one also extracts a return date for the sender
to pause on. Whether the app's sender pauses, resumes and suppresses was not exercised (no mailbox may be connected).

**Cost.** Claude Haiku 4.5, all `MEASURED`: 1,859/510, 1,799/304, 1,775/131, 1,746/176 tokens = $0.0127. DataForSEO 0.

---

## 4. `describe` (protocol run 3)

**Asked.** `{"mode":"describe"}`. API 757 → run 758, 42.5 s.

**Came back** (`Build Describe Response`): name "Tech&", summary "A Microsoft-aligned enterprise technology partner delivering AI, cloud,
and business applications solutions to GCC region organizations.", 28 products / services (Dynamics 365 Finance … Azure Synapse
Analytics), 10 audiences, 8 USPs ("20+ years of proven industry experience", "24/7 support availability", …), `location_served` "UAE and
GCC region", meta title "Tech& | Enterprise AI & Cloud Solutions for GCC", 10 seed keywords, 6 `pages_read`, `site_read_failed: false`.

**What the customer sees.** `reports` 495af44a…: stage `site_description`, title "Site description · techand.ai", summary `{name, summary}`
and the description page.

**Right.** The services match the capability pages; "20+ Years" and "24/7 Support" are on the homepage (fetched 16:0x UTC). The site
inventory used by every later run (`seo_pages`, 45 rows, updated 2026-10-16) now carries a title and an H1 for **all 45** pages
(2026-10-15: 25 of 45 had no title) — e.g. `/ai-copilot-advisory-uae` "AI Consulting Copilot Advisory UAE | Tech" (the `&` is stripped
in every stored title: "Tech" for "Tech&").

**Wrong.** **A-4** (Low): `pages_read` titles are the menu link texts, not the pages' titles — `/industries` is listed as "Banking
Financial Services" (live `<title>` "Industries We Serve | Tech&"), `/capabilities/data` as "Data" ("Data & Analytics | Tech&"),
`/capabilities` as "Tech& Capabilities"; the homepage is listed on the bare host `https://techand.ai` (canonical is www); `nav_pages`
still holds one "Read more about How Microsoft 365 Copilot …" link on the bare host; `site_facts` (50 lines) still mixes facts with
section headings ("Industries We Serve", "What We Do", "Insights", "Proven Track Record", "Global Partner") and three article titles.

**Cost.** DataForSEO 0. Claude: n8n Haiku 4,831 in / 984 out = $0.0098; ledger $0.0073 "measured": `Count Prompt` 3,876 tokens, `Count
Answer` 4,567 (= 691 answer tokens). On 2026-10-15 the counted answer was the string "[object Object]" (4 tokens); today the answer is
serialized JSON and counted. The remaining −25% is prompt the counter does not see (3,876 vs 4,831) and 293 output tokens (§10).

---

## 5. `verdict` "e invoicing software uae" (protocol run 4)

**Asked.** `{"mode":"verdict","keyword":"e invoicing software uae"}`. API 759 → run 760, 2.3 min. SERP Top 10, Facts SERP and Keyword Data
all task status 20000 (`verdict_evidence`: `serp "read"`, `keyword_data "read"`, retried 0).

**Came back** (`A-verdict-760-parse.json`): **GO_WITH_CHANGES 52** (2026-10-15: 58). Reasons, quoted:
1. "Volume is tiny: 40 searches a month, with a 12-month trend that swings from 0 (Oct and Nov 2025) to 110 (Aug 2026). …"
2. "Commercial value is high. CPC is $7.90 with MEDIUM ads competition … ahead of the 30 October 2026 ASP appointment deadline and the
   1 January 2027 go-live …"
3. "The top 6 mix strong and weak pages: cleartax.com (2,650 words), mof.gov.ae (the regulator) and complyance.io, but also smartinvoice.ae
   at 192 words and penieltech.com aimed at small businesses. …"
4. "The competitor analysis shows gaps no one fills: a backward-planned timeline from 30 October 2026, a scored vendor scorecard, a cost
   model, and an ASP-versus-ERP decision path. The existing URL is a CFO features guide that can take these on. An AI Overview was seen in
   the check at 16:03 UTC on 2026-10-17 citing taxilla.com, tax.gov.ae, zoho.com and others, but one observation should not decide the
   verdict."

Risks include "Tech& must be honest about its accreditation status. If it is not an ASP accredited under the Ministry of Finance's
e-invoicing framework …". Changes: "Improve the page the site already has for this search (…/insights/top-peppol-e-invoicing-software-
features-every-uae-cfo-must-look-for) … do not publish a second page for this keyword"; on that page add a 40–70-word definition, "a dated
phase table: 30 October 2026, 1 January 2027, and the Phase 2 date", "PINT-AE, the DCTCE five-corner model …, Ministerial Decisions 243 and
244 of 2025, Cabinet Decision 106 of 2025 with a penalties section, and the AED 50 million threshold", a decision rule ASP vs ERP add-on,
a scorecard, a cost model "with no invented prices", "Keep the named author and add a reviewer". `existing_page` matched by slug from the
page inventory, action `improve`. `secondary_keywords`: "UAE e-invoicing requirements", "list of ASP for e-invoicing in UAE", "UAE
e-invoicing deadline", "is e-invoicing mandatory in UAE", "UAE e-invoicing accredited service provider", "PINT-AE e-invoicing UAE",
"Peppol e-invoicing UAE", "e-invoicing Dynamics 365 UAE". Expected visits 6 a month (modelled, AI Overview −52%). Coverage target:
mof.gov.ae (#4) 40% of 25 terms, target 60%, "the best service page among them … (1 of that kind read)".

**What the customer sees.** `reports` 10bac9a1…: stage `content`, title "Keyword report: e invoicing software uae", summary `{"page":"Service
Page","score":52,"volume":40,"hasPage":false,"verdict":"GO_WITH_CHANGES"}`, with the reasons, risks, changes and run ledger.

**Checked against sources.**
- The client page was read whole: `existing_page_digest` `words 2137`, `chars_total 15451`, `chars_given 15451`, `cut false`, `tables 3`
  (with their rows), `dates ["30 October 2026","1 January 2027"]`, `html_read true`. On 2026-10-15 (608) 9,000 characters were read with the
  tables flattened, and the verdict said the page had "no mandate dates … no tables … no author". Today no such statement is made and the
  verdict says "Keep the named author".
- The live page (fetched 16:0x UTC): "PINT", "five-corner"/"5-corner", "243", "244", "106", "Phase 2", "31 March 2027" — none occur, so those
  "add" items are correct. "AED 50 million" **does** occur ("businesses with revenue of AED 50 million or more to 30 October 2026"); the page
  carries a visible byline (Muhammad Aarish, System Architect), BlogPosting with `datePublished` 2026-09-26 and an FAQPage block.
- Ministerial Decisions 243 and 244 of 2025 and Cabinet Decision No. 106 of 2025 (e-invoicing penalties) exist (web search: mof.gov.ae
  "Ministry of Finance announces the issuance of Cabinet Resolution on Administrative Fines Related to Electronic Invoicing System"; the
  MoF PDF "Cabinet Decision No. 106 of 2025"). The AI Overview's Phase 2 dates (31 March 2027 / 1 July 2027) are in the SERP item; not
  checked further.
- Keyword Data: `search_volume 40`, `cpc 7.9`, MEDIUM, monthly 0 (2025-10, 2025-11) … 110 (2026-08) — reasons 1 and 2 match. AI Overview
  `cited_domains` taxilla.com, tax.gov.ae, zoho.com, taxstar.app, alburhanaccountancy.com, tallysolutions.com, flick.network — matches.

**Right.** Every market figure traces to its source; the regulation references are real; the AI Overview is a timestamped observation; the
client page is found, read whole with its tables and dates, and the advice is to improve it on the same URL. "Ministry of Finance" is
named as the accrediting body (2026-10-15 said "FTA-accredited").

**Wrong.** **A-5** (Medium): five of the eight secondary keywords the verdict tells the owner to fold into this page are pages of the
site's own active ladder `lad_mupia2l2c0tp` "e invoicing in uae" (rows 3, 4, 6, 7: "accredited service provider for e invoicing in uae",
"uae e invoicing requirements", "list of asp for e invoicing in uae", "is e invoicing mandatory in uae") or of a written draft
(`seo_content_log` 7 "uae e-invoicing deadline 2027"), and change 3 asks for "a penalties section" on this page while the site has the
article /insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs and the ladder rung "uae e invoicing penalties"
(`writing`). The verdict does not mention the ladder (no "ladder" in any customer-facing field of 760). **A-6** (Low): "add … the AED 50
million threshold" — the page already states it. **A-7** (Low): the coverage target is the regulator's page (mof.gov.ae) as the model for a
vendor's page, and the term list includes fragments "features like" and "businesses the uae".

**Gap to the leader.** Ahrefs' Traffic Potential uses the #1 page's real traffic; here 6 visits are modelled from a 40-search provider
figure. Surfer / Clearscope grade the client page against its topic; this run now reads it fully, but does not check its suggested
secondary keywords against the site's own ladders and pages (A-5).

**Cost.** DataForSEO $0.0221 (Keyword Data $0.0121, SERP $0.006, Facts SERP $0.004) = ledger row 145. Claude: n8n $0.1234 (Competitor
Analyzer 22,582/3,959, Verdict 11,659/1,535, both `MEASURED`); ledger $0.1509 = $0.1182 counted + $0.0327 "thinking no counter can see
… modelled from the effort budget" (1,638 tokens per node). The counted answers (3,909 and 1,484 tokens) match n8n's output tokens within
51 tokens each (§10).

---

## 6. Choosing the ladder keyword

Read first: `seo_ladders` (29 rows, 7 ladders; heads e invoicing in uae, peppol uae, erp software uae, dynamics 365 partner uae, erp
implementation dubai, azure cloud migration dubai, ai consulting dubai), `seo_ladder_settings` (6 `active`, 1 `paused`; `_site`
`max_active 2`, `max_waiting 3`), `seo_content_log` (7 rows: 2 `written`, 3 `not_ready`, 2 `started`), the live sitemap (45 URLs) and every
page's title / H1 (fetched 16:00 UTC). The site has dedicated pages for Business Central, F&O, CRM, Project Operations, cloud migration,
managed services, Power Platform & analytics, AI consulting / Copilot and AI agents.

Two candidates were checked first and dropped: "retail erp software uae" (no search data; the check calls it the same search as the
existing "erp software uae" ladder) and "warehouse management system uae" (10 searches, fit 1). Discover (§8) was then run, and its
research pool (`A-exec-764.json`, 1,160 keywords with volumes) gave "it consulting dubai" (140 in the ideas data) with several variants at
110–720. **Chosen: "it consulting dubai"** — commercial, UAE demand, Tech& describes itself as "Enterprise Technology Consulting &
Implementation" (describe, 758) and its homepage tagline is "technology consulting for the UAE & GCC region"; no ladder heads or contains
it; no live page targets IT consulting (no page contains "IT consult"; the phrase "technology consulting" appears only in the shared footer
tagline and the homepage meta keywords).

---

## 7. `ladder` "it consulting dubai", `pages_now` 1 (protocol run 6)

**Asked.** `mode ladder`, `keyword "it consulting dubai"`, `business_facts ""`, `goal "Get leads and enquiries"`, `tone "Professional and
direct"`, `cta ""`, `pages_now 1`. API 769 → run 770 (2.6 min) → spawned page run 771.

**The SERP was read.** Every DataForSEO task of 770 answered 20000: SERP Top 10 (16:09:37), Facts SERP, Keyword Data, 4 research calls
($0.0994) and 20 cluster SERP calls ($0.04); no retries. `data_check`: pool 32, head measured, SERP checked, `enough true`.

**Came back** (`A-ladder-770-plan.json`; report 00a0da6c…, stage `ladder_plan`, title "Ladder plan: it consulting dubai", summary
`{"head":"it consulting dubai","plan":"Easy for your site · Direct plan · 2-4 months","pages":4,"writeNow":1,"feasibility":"GO_WITH_CHANGES"}`,
file `keyword-ladder-it-consulting-dubai-2026-10-17.doc`):
- Head: volume 90, KD 0, CPC 11.64, commercial. Feasibility "winnable", **GO_WITH_CHANGES 52**: "Volume is only 90/month and the yearly
  trend is -92% …", "Ranking odds are good. Keyword difficulty is 0 … A 404-word page (alkendiit.ae) ranks #1", "Competitors leave gaps:
  none show pricing or engagement models, none use tables …", "No AI Overview was seen in the check at 16:09 UTC". SERP diversity 6 domains
  in the top 6, no adjustment. Label "Easy for your site · Direct plan · 2-4 months", chance "no estimated chance".
- Pool 32 → 24 reviewed → 18 relevant; 2 refused as navigational ("iconic it consulting services dubai", "yo it consulting dubai"), 4
  off-topic ("it consultancy services", "microsoft dynamics consulting services/companies", "microsoft 365 consulting services").
- Rows stored (`A-ladder-770-rows.json`):

| Row | Rung | Page keyword | Supporting | Volume | Target words | Grouped by | Target URL |
|---|---|---|---|---|---|---|---|
| 33 | 4 (top, written now) | it consulting dubai | it consultancy dubai, it consulting services dubai, it consultants in dubai, **it consulting company dubai**, it strategy consulting uae, digital transformation consulting dubai | 90 | 1,600 (competitor analysis) | — | /it-consulting-dubai/ |
| 30 | 1 | dubai it consulting companies | it consulting company in dubai, it consulting firms in dubai, it consulting services in dubai | 720 (+170) | 1,200 (median of 6 pages) | shared results page | /dubai-it-consulting-companies/ |
| 31 | 1 | it services dubai | — | 320 | 1,200 | "own results page (no other search Google answers with the same pages)" | /it-services-dubai/ |
| 32 | 1 | **it consulting company dubai** | — | 50 | 1,200 | "own results page (no other search Google answers with the same pages)" | /it-consulting-company-dubai/ |

- Notes printed, quoted: "Nothing on techand.ai is about "it consulting dubai" yet — no page and no keyword it ranks for — so all 4 page(s)
  in this plan are new … A search that an existing page already answers is never given a second page."; "The results pages of 20 of the
  20 rung keyword(s) were read and compared: searches sharing 3 of their top 7 pages (40%) are one page, not two - 1 group(s) covering 4
  keyword(s) … $0.04"; "You have 5 pages waiting to be published (limit 3); this writes page 6. 3 of them did not pass the quality check and
  need a fix first. Publish or discard the waiting pages before the next one is written: a pile of unpublished pages ranks nothing."
- `seo_ladder_settings`: new row, `auto`, priority 8, **`active`**.

**Checked.**
- "Nothing on techand.ai is about it": true by the live pages (§6).
- Pile-up count: `seo_content_log` before the run held 2 `written` + 3 `not_ready` = 5 waiting, 3 needing a fix — the note's numbers are
  right. The page was written anyway (771).
- Overlap, recomputed from the 21 stored top-7 lists (`A-ladder-770-cluster-serps.json`): "it consulting company dubai" and "it consulting
  company in dubai" share 3 of 7 (hlbhamt.com/services/it-consulting-services-uae, digitalagencies.ae/it-consultants,
  naukrigulf.com/consulting-companies-in-dubai) — the plan's own threshold — yet the first is a separate rung page "own results page (no
  other search Google answers with the same pages)" while the second sits on row 30. "it consulting company dubai" is also a supporting
  keyword of the top page (row 33). The head's own top 7 shares at most 1 URL with any rung keyword; of the top page's six supporting
  keywords only "it consulting services dubai" had its results page bought (0 shared with the head).
- "it services dubai" results page: bluechipgulf.ae/local-it-support-in-dubai, logicalnetworksolution.com/best-it-support-companies-…,
  itservicedubai.ae, xedos.ae/best-10-it-infrastructure-companies-…, techaiddubai.ae/it-managed-services-dubai — local IT support / MSPs.
  The page written for this ladder (771) itself says "Can an IT consultant manage a complete office IT setup? Some can, but Tech& does not
  … appoint a specialist IT support firm."
- "dubai it consulting companies" (row 30, 720/month) results page: consultancy-me.com "top 25 strategy consulting firms", khaleejtimes.com
  "top 10 IT consulting companies", a LinkedIn listicle, bain.com, naukrigulf.com — list pages; the rung is planned as a Service Page with
  no page-type note (`page_type_note: null`).
- Active ladders after the run: **7** (`A-ladder-settings-after.json`) against `_site` `max_active: 2`; the plan says nothing about it.

**Right.** The results page and 20 rung results pages were read and compared with the stated 40%-of-top-7 rule, the merge is printed with
the shared URLs; navigational and off-topic terms were refused with a reason each; rung target words are set from measured pages (1,600 /
1,200); the chance band is withheld; the pile-up is stated with correct counts; "nothing on the site is about it" is true for this topic.

**Wrong.** **A-8** (High) the same keyword on two planned pages; **A-9** (Medium) "no other search Google answers with the same pages" is
false by the plan's own rule; **A-10** (Medium) supporting keywords of the top page grouped without a results-page comparison; **A-11**
(Medium) a rung for a service the written page says Tech& does not offer, and a list-intent rung planned as a service page; **A-12**
(Medium) a seventh active ladder and a sixth waiting page, cap not mentioned.

**Did it refuse when it should?** Nothing to refuse on data (pool 32, SERP read). It did not hold the page on the pile-up (it stated it)
and did not refuse or queue the ladder on the active-ladder cap.

**Gap to the leader.** Keyword Insights / Semrush Keyword Strategy Builder cluster by SERP overlap and assign each keyword to exactly one
page; here one keyword is assigned to two pages and a pair at the threshold is split.

**Cost.** DataForSEO $0.1615 (research $0.0994, cluster SERP $0.04 — "measured: 20 results-page call(s) … counted once by task id",
Keyword Data $0.0121, SERP $0.006, Facts $0.004) = ledger row 151. Claude: n8n $0.1143 (Competitor Analyzer, Verdict, Ladder Relevance,
all `MEASURED`); ledger $0.1478. Pre-run estimate in the ledger row: $0.1063 AI / $0.1506 DataForSEO.

---

## 8. The ladder's top page "it consulting dubai" (protocol run 7)

**Asked.** Spawned by 770 (`Start Page Runs`, Execute Workflow without waiting) at 16:11:42 as a keyword run with `ladder_id
lad_mvcldcnv9q1q`, `ladder_rung 4`, `ladder_words 1600`, three planned `ladder_links`, `force_content`. Execution 771, 10.8 min. (The
toolkit's `execs` listing hides running executions; 771 was found with `status=running`.)

**What ran.** SERP / Facts / Keyword Data 20000; Competitor Analyzer, Verdict (GO_WITH_CHANGES **48**), Strategy Brief (133 s, no parser
rejection), Copywriter (121 s), Critic (66, "revise"), `Refresh Source Plan` → skipped ("not a refresh: no live page is being improved in
this run"), Content QA round 1, Originality, Editor (one call, 213 s), Content QA round 2, Originality, Word + PDF + 3 images, content-log
row, callback.

**Came back** (report 7543f4d6…, stage `content`, title "Page: it consulting dubai"; `A-page-771.md` / `.html`):
- Title "IT Consulting Dubai: Microsoft, Cloud & AI Advisory | Tech&" (59 chars), meta description 144 chars, H1 "IT Consulting in Dubai
  for Enterprises That Can't Afford to Get It Wrong", 11 H2, 13 question headings all answered, schema Service + BreadcrumbList (no FAQPage),
  11 internal links, 7 external.
- **"did not pass the quality check — not ready to publish (round 2 of 2)"**, `qa_publishable false`, `qa_not_ready true`, Word file
  `…-2026-10-17-DRAFT.doc`. Reasons, quoted: "External links to sources not in the evidence plan: u.ae, difc.com, adgm.com — verify each one";
  "Sections far below their target length: How a Tech& Engagement Runs: Assess, Build, Run (74 words)"; "Quick answer block missing (a
  40-70 word direct answer right after the introduction)"; "Subtopics the best competitor page covers and this draft does not: "IT
  Consultancy Company in Dubai - AGN IT Services LLC", "Why AGN IT Services LLC Is Best IT Consultancy Company in Dubai", "Strategic IT
  Development", "Cloud Transformation Consultancy" — add each one where it belongs … or the page is thinner than the one it has to beat".
  Note: "The editor had 1 round and the page still fails the checks above: it is delivered as a draft to finish by hand".

**Length.** Round 1: 2,546 main-content words vs 1,600 (+59%), coverage 88% vs target 81%, content score 91, Quick answer 63 words,
`answer_first true` (85 words before it). Round 2 (after the editor): **1,856 vs 1,600 (+16%)**, coverage 88%, score 95, **Quick answer 0
words**. The delivered markdown has 2,002 words including the TOC and tables. 2026-10-15 (616): 2,197 vs 1,900 (+16%).

**New QA blocks.**
- *Readability band* (`readability`): "Flesch 55.3 is plainer than the pages that rank (the 6 competitor pages read score Flesch 7.2-25.2
  (median 19.7); the band is 20-35 …) — … Advice, not a blocker." Per-page values listed (alkendiit 44.9, techbehemoths 16.3, acs-dxb −0.4,
  jachoos 25.9, sisgain 4.1, agncompu 23.1). Recomputed here from the `<p>` text of two of them: acs-dxb −5.0, sisgain 2.3 — same order, so
  the band reflects genuinely dense pages. The block is advisory, as labelled.
- *Intent / answer-first* (`intent`): round 1 "words_before_answer 85 … answer_first true"; round 2 "no Quick answer line in the draft, so
  where the answer sits could not be measured (the missing block is its own warning)".
- *Source re-check*: did not run — this is a new page, and the re-check applies only when a live page is refreshed (`Refresh Source Plan`:
  `skip: true`). Not exercised in this part (§11).
- *Originality*: 1,755 eight-word windows against 8 pages (6 competitor, 2 own), highest overlap 0%, threshold 15%, passed.

**Facts and links in the delivered page.**
- Correct: Federal Decree-Law No. 45 of 2021 (PDPL), DIFC Data Protection Law No. 5 of 2020, ADGM Data Protection Regulations 2021, Azure
  regions UAE North (Dubai) / UAE Central (Abu Dhabi) — the Azure geographies page answers 200.
- External links (curl with a browser UA, 16:2x UTC): u.ae data-protection-laws 200; desc.gov.ae 200; azure.microsoft.com 200;
  **https://u.ae/en/information-and-services/business/business-licensing 404**; **https://www.adgm.com/office-of-data-protection 404**;
  difc.com 429 (Vercel checkpoint, not verifiable); centralbank.ae 403 (bot block, not verifiable). Every internal link (/whatwedo/*,
  /capabilities/cloud-services, /ai-copilot-advisory-uae, /industries, /contact-us, the VAT article) answers 200.
- Statements about Tech&'s own business with no source in the run (business facts empty, no profile) and absent from all 33 non-article site
  pages: "**Is Tech& just a Microsoft reseller?** No. We charge for advice and delivery. Licences sit on a separate line of the quote, you
  can buy them through any channel, and our recommendations do not depend on them."; "Can an IT consultant manage a complete office IT
  setup? Some can, but Tech& does not."; "Tech& does not handle company formation." Not listed by the QA.
- Body bracket: "For example, a three-entity group on a legacy ERP pays a fixed **[Price band: typical Assess & Envision fee in AED]**."
  Round 2 reports `placeholder_count 0`, `placeholders_in_body []`, `open_brackets []`, `placeholders_total 0`.
- The run's own verdict (771 `verdict_changes[3]`) says "Skip the consultancy-licence and start-an-IT-company questions, which don't match
  buyer intent"; the page has an H2 "How Much Is a Consultancy Licence in Dubai?". The same verdict says "Treat this as a supporting page"
  (`verdict_changes[4]`); the ladder made it the top page.
- Round 1 flagged "Unverified statistics …: 20+ years"; the homepage states "20+ Years" and describe lists it as a USP.

**What the customer sees.** Report summary `{"qa":"Did not pass the quality check — not ready to publish (round 2 of 2): …","page":"Service
Page","score":48,"volume":90,"hasPage":true,"keyword":"it consulting dubai",…}`, the article preview, the DRAFT Word file and three WebP
images (hero, comparison diagram, compliance flow). `seo_content_log` row 8 "it consulting dubai" `not_ready` with the QA reasons
(2026-10-15's equivalent row was `written`); `seo_ladders` row 33 stays `writing`.

**Right.** The page is not offered as publishable; the owner reads round-2 reasons; length is +16% over target; regulatory references
are correct; no figure was masked as unsourced; every internal link is live; no FAQPage; the editor ran once and the note says 1 round
(2026-10-15: "2 rounds" for one call); the content log records `not_ready`.

**Wrong.** **A-13** (Medium) a bracket left in the body counted as zero placeholders; **A-14** (Medium) two dead external links, the QA
says "verify" without checking; **A-15** (Medium) unsourced statements about the client's commercial terms not flagged; **A-16** (Medium)
another company's self-promotional headings listed as missing subtopics and used as a refusal reason; **A-17** (Medium) the editor removed
the Quick answer that round 1 had, which then became a refusal reason; **A-18** (Low) the page covers a topic its own verdict said to skip;
**A-19** (Low) "20+ years" flagged as unverified; **A-20** (Low) ladder row `writing` vs content log `not_ready`; **A-21** (Low) two
feasibility scores and two AI Overview observations for one keyword three minutes apart (770: 52, "No AI Overview was seen … 16:09"; 771:
48, "An AI Overview was seen in the check at 16:12").

**Gap to the leader.** Surfer / Clearscope build the coverage target from pages of the intended type and topic; here the "best competitor"
is agncompu.com and its own brand headings become required subtopics. Writer-class claim detection flags unsupported claims about the
company; this run flags none of three. Semrush's SEO Writing Assistant checks links; this QA lists hosts to "verify" and ships two 404s.

**Cost.** DataForSEO $0.0241 (Keyword Data $0.0121, SERP $0.008, Facts $0.004) = ledger row 152. Claude: n8n reports Sonnet $0.1506
measured (Competitor Analyzer, Verdict, Critic) and Opus $0.3567 from `tokenUsageEstimate` only (Strategy Brief $0.1739, Copywriter
$0.1018, Editor $0.0809). The ledger settled **$0.9659** ("measured: … count_tokens counted the prompt and the answer of every call …; the
$0.2294 of thinking no counter can see is modelled"): Strategy Brief counted 17,000 prompt / 11,128 answer tokens ($0.3397), Copywriter
13,275 / 5,815 ($0.2349), Editor 10,811 / 4,509 ($0.1990, priced once). The ledger row's pre-run estimate was $1.3785 AI.

---

## 9. `discover` with the keyword report (protocol runs 9 and 10)

**Asked.** `{"mode":"discover","keyword":"","goal":"Get leads and enquiries","business_facts":"","features":[],"receive":["Keyword Report"]}`.
API 763 → run 764 (2.1 min) → spawned keyword report 765 (2.2 min).

**Came back** (`A-discover-764-strategy.json`, `A-discover-764-result.html`; report 4cd87711…, stage `keyword_strategy`, summary
`{"priority":5,"quickWins":5,"startWith":"erp system dubai","researched":1168}`):
- 40 seeds (10 from Search Console, among them "techandf cc", "technology & data", "governed ai vs autonomous ai customer experience
  productivity software"); primary seed "erp implementation partner"; pool **1,168 → 240 reviewed → 16 relevant** (sources: ideas 596,
  competitor 545, Search Console 19, suggestions 9, related 1; no research failures). 2026-10-15 (612): 667 → 239 → 104.
- Competitors whose keywords were pulled: **hlbhamt.com, naukrigulf.com, sscoglobal.com**, taken from the results page for "erp consultants
  dubai" (#1 hlbhamt.com, #2 naukrigulf.com "ERP Consultant Jobs in UAE - 67 Vacancies", #3 ae.indeed.com, #4 sscoglobal.com, #8
  glassdoor.com). 2026-10-15: emirtech.ae, eresourceerp.com, maisonconsulting.com.
- The relevance pass (3 Sonnet calls) rated the 240 reviewed keywords **224 × 0, 11 × 1, 5 × 2**; the 0s are jobs, hospitals, airlines,
  newspapers ("newspaper gulf news", "flydubai careers", "dubai iranian hospital", "naukrigulf", "jobs abu dhabi" …).
- Priority (5, all relevance 2, live-checked): "e invoicing" 1,900 (covered by the e-invoicing features page and ladder "e invoicing in
  uae"), "erp system" 4,400 (covered by ladder "erp implementation dubai" rung "dynamics 365 erp system"), "erp system dubai" 320, "cloud
  solutions" 320, "erp systems in uae" 260. The other 11 relevant keywords: "vat registration uae", "intelligent software solutions",
  "software development company", "it services", "software companies in dubai", "cloud computing", "it management consultancy", "it
  solutions companies in dubai", "e invoicing uae deadline", "vendor management system", "innovative erp" (all relevance 1).
- "Where to start: "erp system dubai" — 320 searches/mo, difficulty 27 · easy, commercial intent, best page: Location Page. Reachable for
  your site · Short ladder · 4-8 months … Comparison or lists are what Google ranks here: 7 of the 9 results read, while this plan writes a
  service or product page - expect to work harder". "Build first: erp implementation uae (Location Page, 580/mo across 2 keywords) · ai and
  copilot solutions (Service Page, 1,600/mo …) · it services dubai (Location Page, 2,110/mo …) · cloud migration infrastructure … ·
  software development …". Content plan "Now" tier: "Erp implementation uae — erp systems in uae, erp system dubai".
- Search Console: 300 rows, 97 considered (dropped: brand 3, low impressions 30, duplicate 170), 79 unique query rows shown: 13
  `striking`, 5 `low_position`, 1 `page_mismatch`, 60 "already answered".

**Checked against the live site and Search Console's own page column.**
- The 2026-10-15 pattern (20 `page_mismatch` rows telling the owner that /dynamics-365-finance-and-operations-uae does not target "d365
  finance dubai" etc.) is gone: those queries are now "answered" / "striking", and the only `page_mismatch` row is "techandf cc" (#1.3 on the
  homepage): "its title and H1 share only 0 of the 2 words … aim that page at it or give the search its own".
- **17 of the 79 rows name a different page than the one Search Console reports for the query** (`answered_by.url` ≠ `page`), e.g.
  "dynamics 365 finance and operations pricing dubai" — Search Console page /dynamics-365-finance-and-operations-uae at #9.6; the report
  says "you rank #9.6 with /insights/how-microsoft-dynamics-365-finance-operations-supports-uae-vat-compliance — striking distance: improve
  that page" (`matched_by: "slug"`). Five more "striking" rows (retail, F&O partner queries, positions 12.5–18.5) and eleven "answered" /
  "low position" rows do the same, pointing at the VAT article or the F&O implementation page (list in finding A-22).
- "erp systems in uae" (priority #5, `ladder_covered: null`, `covered_by: null`) is the search the active ladder "erp software uae" heads;
  "erp system dubai" (#3, the "Where to start") likewise has no ladder note while ladders "erp software uae" (rung "erp software dubai")
  and "erp implementation dubai" exist. "erp system" is matched to ladder "erp implementation dubai"; "e invoicing" is matched to the rung
  "uae e invoicing penalties" ("part of a broader page") rather than the ladder's head.

**The keyword report (765) "erp system dubai".** Volume 320, KD 27, CPC 11.96, trend +143% yearly / −35% quarterly (monthly 590 in
2025-09 → 170 in 2026-08; checked against Keyword Data — correct). **GO_WITH_CHANGES 66**, `existing_page: null`. Change 1: "Build a
Dynamics 365 Business Central/Finance & Operations ERP service page for Dubai/UAE with a 40-70 word definition …". Secondary keywords
"erp software dubai", "erp companies in dubai", "best erp in uae", "vat compliant erp uae", "microsoft dynamics 365 erp dubai", "erp
implementation partner uae", "erp for trading companies dubai", "erp cost in dubai", "erp for small business uae", "**dynamics 365 business
central uae**". The site already has /dynamics-365-business-central-uae ("Business Central ERP Solutions in UAE") and
/dynamics-365-finance-and-operations-uae, a ladder rung "erp software dubai" (planned) and the ladder "erp implementation dubai". Report
b4262bbc…, summary `{"page":"Service Page","score":66,"volume":320,"hasPage":false,"keyword":"erp system dubai",…,"difficulty":27}`. The
discover card and the report agree on volume, KD, CPC and plan.

**Right.** Research had no failures; refusal and drop counts are reported; covered / ladder-covered keywords are named in the header
with the instruction not to write a second page; every priority keyword was live-checked with a page-type read; the 2026-10-15 false
"page_mismatch" rows on the F&O page no longer appear; the follow-up's figures match discover's.

**Wrong.** **A-22** (High) wrong page named in 17 Search Console rows; **A-23** (High) the keyword report recommends building a D365 BC /
F&O service page the site already has; **A-24** (Medium) the competitor set is taken from a job-board results page and 93% of the reviewed
pool is irrelevant; **A-25** (Medium) "Where to start", "Build first" and the "Now" tier put first a topic two active ERP ladders cover,
without the ladder note; **A-26** (Low) a misspelt brand query ("techandf cc") used as a seed and as a "page_mismatch" with "aim that page
at it".

**Gap to the leader.** The criteria's 10-anchor for sources is "Search Console striking distance / impressions with no page, fed into
discovery"; the Search Console rows are now fed in, but the page they point to is chosen by slug / title tokens rather than by the page
Search Console reports. Semrush / Ahrefs pick organic competitors by keyword overlap with the site; here the competitor set is the top
non-excluded domains of one results page.

**Cost.** Discover DataForSEO $0.2754 (research $0.1519, competitor keywords $0.1019, AI demand $0.0116, candidate SERP $0.01) = ledger row
148; Claude n8n $0.1601 (Keyword Seeds + 3 Keyword Relevance, `MEASURED`), ledger $0.1906. Keyword report DataForSEO $0.0241 = row 149;
Claude n8n $0.0925, ledger $0.12.

---

## 10. Cost across this part — the engine's figures against n8n's

| Exec | DataForSEO tasks | Ledger `dfs_usd` | Claude, n8n (measured / estimate) | Ledger `ai_usd` | Difference |
|---|---|---|---|---|---|
| 749-751, 761-762 | $0.1202 | $0.1202 | $0.0153 / — | $0.010 | fixed $0.002 per check (−35%) |
| 753-756 | 0 | 0 (rows 140-143) | $0.0127 / — | $0.0059 | −54% |
| 758 | 0 | 0 | $0.0098 / — | $0.0073 | −25% (prompt counted 3,876 vs 4,831) |
| 760 | $0.0221 | $0.0221 | $0.1234 / — | $0.1509 | +22% (modelled thinking $0.0327) |
| 764 | $0.2754 | $0.2754 | $0.1601 / — | $0.1906 | +19% |
| 765 | $0.0241 | $0.0241 | $0.0925 / — | $0.1200 | +30% |
| 770 | $0.1615 | $0.1615 | $0.1143 / — | $0.1478 | +29% |
| 771 | $0.0241 | $0.0241 | $0.1506 / $0.3567 | $0.9659 | n8n's Opus figures are estimates only |
| **Total** | **$0.6274** | **$0.6274** | **$0.6787 / $0.3567** | **$1.5984** | |

DataForSEO: every run's ledger equals the sum of its own task costs, each task once; with executor B's two rows the engine's total for the
window ($1.0998) equals the account's movement ($1.099915). Claude: the 2026-10-15 "[object Object]" answer count is gone — counted answers
now match n8n's output tokens within ~50 tokens on the Sonnet nodes (760: 3,909 vs 3,959 and 1,484 vs 1,535). On top of the counted figure
the ledger adds 1,638–3,277 "thinking token(s) it cannot see … modelled from the effort budget" per node; n8n's reported output for the
same calls exceeds the counted answer by only ~50 tokens, so on the non-streaming Sonnet nodes the modelled thinking puts the ledger 19–30%
above n8n's figure (**A-27**, Low; whether n8n's `tokenUsage` includes thinking tokens was not verified). The Keyword Check still books a
fixed $0.002, the Reply Reader and describe are counted 25–54% low (**A-28**, Low).

---

## Findings

**A-1 · Medium · The Keyword Check does not see a live page that targets the keyword.** Exec 750 "business central partner uae":
`existing: null`, label "Reachable for your site · Short ladder · 4-8 months · no search data". The site's
https://www.techand.ai/dynamics-365-business-central-uae has H1 "Certified Microsoft Dynamics 365 Business Central Partner in UAE" (live,
and in `seo_pages` with title "Business Central ERP Solutions in UAE | Tech&"). The existing-match reads ladder keywords only. Correct output:
"your page /dynamics-365-business-central-uae already targets this search — improve it".

**A-2 · Low · Ladder status shown as "planned" for a paused ladder.** Exec 751 `existing.ladder_status: "planned"`; `seo_ladder_settings`
`lad_mv4vxu3bq0kl` `status: "paused"`. Correct output: "paused".

**A-3 · Low · The replier recorded as their own referral.** Exec 753 (class `question`): `referral_email` = the `reply_from` address; the
reply names no one else. Correct output: empty referral.

**A-4 · Low · `describe` page titles and facts.** Exec 758 `pages_read`: "/industries" titled "Banking Financial Services" (live "Industries
We Serve | Tech&"), "/capabilities/data" "Data"; homepage on the bare host; `nav_pages` one "Read more" link on the bare host; `site_facts`
includes "Industries We Serve", "What We Do", "Insights", "Proven Track Record" and three article titles. Correct output: the pages' HTML
titles on the canonical host; facts only.

**A-5 · Medium · The verdict folds the site's own ladder pages into the page it says to improve.** Exec 760 `secondary_keywords` include
"UAE e-invoicing requirements", "list of ASP for e-invoicing in UAE", "is e-invoicing mandatory in UAE", "UAE e-invoicing accredited
service provider" — planned pages of active ladder `lad_mupia2l2c0tp` (rows 3, 4, 6, 7) — and "UAE e-invoicing deadline" (content-log
draft 7); change 3 asks for "a penalties section" while the site has the penalties article and the ladder rung "uae e invoicing penalties"
(`writing`). No customer-facing field mentions a ladder. Correct output: name the ladder and the existing articles, and keep their keywords
off this page.

**A-6 · Low · "Add the AED 50 million threshold" to a page that states it.** Exec 760 `verdict_changes[2]`; the live page: "businesses with
revenue of AED 50 million or more to 30 October 2026".

**A-7 · Low · Coverage target from the regulator's page, with fragment terms.** Exec 760 `coverage_target.best` mof.gov.ae (40%, "the best
service page … 1 of that kind read"); terms "features like", "businesses the uae". Correct output: a vendor / provider page as the model;
whole terms only.

**A-8 · High · One keyword planned on two pages of the same ladder.** Exec 770, `seo_ladders` row 32 (rung 1 page "it consulting company
dubai", /it-consulting-company-dubai/) and row 33 (top page, `supporting` includes "it consulting company dubai"); the written top page's
`secondary_keywords` include it too (771). The plan's own note says "A search that an existing page already answers is never given a second
page." Correct output: one page per keyword.

**A-9 · Medium · "No other search Google answers with the same pages" is false by the plan's own rule.** Exec 770 row 32 `grouped_by: "own
results page (no other search Google answers with the same pages)"`; the stored top-7 of "it consulting company dubai" and "it consulting
company in dubai" share 3 URLs (hlbhamt.com/…/it-consulting-services-uae, digitalagencies.ae/it-consultants,
naukrigulf.com/consulting-companies-in-dubai) = the 3-of-7 / 40% rule printed in the notes; the second keyword is on row 30. (The cluster
appears to compare each keyword with the cluster head only: "it consulting company dubai" shares 2 with "dubai it consulting companies".)
Correct output: merge it, or state that it meets the rule with one member but not the head.

**A-10 · Medium · The top page's supporting keywords are grouped without a results-page comparison.** Exec 770 row 33: six supporting
keywords; only "it consulting services dubai" had its results page bought, and it shares 0 of the head's top 7; "it consultancy dubai", "it
consultants in dubai", "it strategy consulting uae", "digital transformation consulting dubai" were not compared. Correct output: compare
them, or label them grouped by topic.

**A-11 · Medium · A rung for a service the business does not sell, and a list-intent rung planned as a service page.** Exec 770 row 31 "it
services dubai" (320/month): its results page is local IT support and managed-IT firms (bluechipgulf.ae local-it-support, "best IT support
companies", techaiddubai.ae managed services); the page the same ladder wrote (771) says "Can an IT consultant manage a complete office IT
setup? Some can, but Tech& does not." Row 30 "dubai it consulting companies" (720/month): results are "top 25 / top 10 consulting
companies" lists, planned as a Service Page with `page_type_note: null`. Correct output: drop or flag the off-fit rung; note the list intent.

**A-12 · Medium · A seventh active ladder and a sixth waiting page.** Exec 770 wrote `seo_ladder_settings` `lad_mvcldcnv9q1q` `active`
(7 active vs `_site` `max_active: 2`) — not mentioned; the pile-up note "You have 5 pages waiting to be published (limit 3); this writes page
6" is printed and the page is written anyway (771). Correct output: refuse or queue, or state both limits and hold the page.

**A-13 · Medium · A bracket in the delivered page is not counted.** Exec 771 round 2: `placeholder_count 0`, `placeholders_in_body []`,
`open_brackets []`; the body contains "[Price band: typical Assess & Envision fee in AED]" (`A-page-771.md`). On 2026-10-15 (616) the same
counter missed "[name, role], [date]". Correct output: count and list every bracket left for the owner.

**A-14 · Medium · Two dead external links; the QA asks the owner to "verify" hosts it did not check.** Exec 771: the page links
https://u.ae/en/information-and-services/business/business-licensing (404) and https://www.adgm.com/office-of-data-protection (404); the QA
reason names only hosts ("u.ae, difc.com, adgm.com — verify each one"). Correct output: fetch each external link and report the 404s by URL.

**A-15 · Medium · Unsourced statements about the client's commercial terms are not flagged.** Exec 771 page: "We charge for advice and
delivery. Licences sit on a separate line of the quote, you can buy them through any channel, and our recommendations do not depend on
them."; "Some can, but Tech& does not [manage a complete office IT setup]"; "Tech& does not handle company formation." Business facts and
profile were empty; none of these occur on the 33 non-article site pages fetched (sitemap, 16:00 UTC). The QA's reasons and `unverified_*` lists are empty of them. Correct
output: bracket them for the owner ("[Confirm: …]") or list them as unverified claims.

**A-16 · Medium · Another company's self-promotional headings required as subtopics, and used as a refusal reason.** Exec 771 round 2
reason: "Subtopics the best competitor page covers and this draft does not: "IT Consultancy Company in Dubai - AGN IT Services LLC", "Why AGN
IT Services LLC Is Best IT Consultancy Company in Dubai" … or the page is thinner than the one it has to beat" (best competitor agncompu.com,
#7). Same pattern on 2026-10-15 (vendasta.com's banner). Correct output: drop headings that name the competitor itself.

**A-17 · Medium · The editor removed the answer block round 1 had, and its absence became a refusal reason.** Exec 771 round 1:
`quick_answer_words 63`, `answer_first true`; round 2 (after the single editor call): `quick_answer_words 0`, reason "Quick answer block
missing". Correct output: keep the block through the cut (the length instruction lists what must stay), or re-check before refusing.

**A-18 · Low · The page covers a topic its own verdict said to skip.** Exec 771 `verdict_changes[3]`: "Skip the consultancy-licence and
start-an-IT-company questions, which don't match buyer intent"; the page has the H2 "How Much Is a Consultancy Licence in Dubai?". The same
verdict calls it "a supporting page"; the ladder made it the top page.

**A-19 · Low · The site's own claim flagged as an unverified statistic.** Exec 771 round 1: "Unverified statistics …: 20+ years"; the
homepage states "20+ Years" and describe (758) lists it.

**A-20 · Low · Ladder row and content log disagree.** After 771: `seo_ladders` row 33 `writing`; `seo_content_log` row 8 `not_ready`.

**A-21 · Low · Two scores and two AI Overview readings for one keyword three minutes apart.** Exec 770 feasibility 52, "No AI Overview was
seen in the check at 16:09 UTC"; exec 771 verdict 48, "An AI Overview was seen in the check at 16:12 UTC". Both are labelled single
observations; the two reports do not mention each other.

**A-22 · High · Discover names the wrong page in 17 of its 79 Search Console rows.** Exec 764 `search_console`: rows where `answered_by.url`
differs from Search Console's own `page` — e.g. "dynamics 365 finance and operations pricing dubai" (Search Console page
/dynamics-365-finance-and-operations-uae, #9.6) → "you rank #9.6 with /insights/how-microsoft-dynamics-365-finance-operations-supports-uae-
vat-compliance — striking distance: improve that page"; also "dynamics 365 finance and operations for retail uae" (#15.4), "microsoft
dynamics 365 finance for retail uae" (#18.5), "dynamics 365 finance support partner uae" (#34.1), "dynamics 365 for finance and operations
warehousing dubai" (#33.4), "d365 finance and operations expert uae" (#37.7) → the VAT article; "dynamics 365 finance and operations retail
partner uae / dubai", "dynamics 365 finance for retail implementation uae", "d365 finance and operations support services dubai / uae",
"f&o implementation uae" → /d365-finance-operations-implementation-rollout-uae; matched by slug or title tokens. The owner is told to
improve a page that does not rank for the query. Correct output: name the page Search Console reports (and, if a better target exists,
say both).

**A-23 · High · The keyword report recommends building a service page the site already has.** Exec 765 `existing_page: null`; change 1
"Build a Dynamics 365 Business Central/Finance & Operations ERP service page for Dubai/UAE"; secondary keyword "dynamics 365 business central
uae" — the slug of the live page /dynamics-365-business-central-uae ("Business Central ERP Solutions in UAE"); also "erp software dubai"
(planned rung of ladder "erp software uae") and "erp implementation partner uae" (ladder "erp implementation dubai"). No mention of either.
Correct output: point at the existing BC / F&O pages and the ladders, or explain why a new page is needed.

**A-24 · Medium · Discover's competitors come from a job-board results page; 93% of the reviewed pool is irrelevant.** Exec 764 `Competitor
Keyword Requests` → hlbhamt.com, **naukrigulf.com**, sscoglobal.com (from "erp consultants dubai", where #2 is "ERP Consultant Jobs in UAE")
— indeed.com and glassdoor.com are excluded, naukrigulf.com is not; competitor keywords 545 of the 1,168 pool; relevance 224 × 0 of 240
reviewed (jobs, hospitals, airlines); 16 relevant (2026-10-15: 104), 11 of them rated 1 ("cloud computing", "software development company",
"vendor management system", "innovative erp"). Correct output: exclude job boards / directories when picking competitors (or use the
site's declared competitors), and say when the pool is mostly off-topic.

**A-25 · Medium · "Where to start", "Build first" and the "Now" tier lead with a topic two active ERP ladders cover.** Exec 764:
"erp system dubai" (Where to start) and "erp systems in uae" (priority #5) carry `ladder_covered: null`; "Build first: erp implementation uae
… 580/mo" and the Now tier list them, while ladders "erp software uae" (head; rung "erp software dubai") and "erp implementation dubai" are
active. The Keyword Check (761) calls "retail erp software uae" "the same search" as "erp software uae"; discover does not connect "erp
systems in uae" to it. Same pattern on 2026-10-15. Correct output: carry the ladder note into those lists.

**A-26 · Low · A misspelt brand query used as a seed and a page-mismatch.** Exec 764: "techandf cc" in `gsc_seeds`; row `page_mismatch`
"aim that page at it or give the search its own".

**A-27 · Low · Modelled thinking puts the Claude ledger 19–30% above n8n's figure on non-streaming nodes.** Execs 760, 764, 765, 770:
ledger $0.1509 / $0.1906 / $0.12 / $0.1478 vs n8n $0.1234 / $0.1601 / $0.0925 / $0.1143; each node adds 1,638 modelled thinking tokens
while n8n's output exceeds the counted answer by ~50 tokens. Labelled "modelled" in the basis. Not verified whether n8n's `tokenUsage`
includes thinking.

**A-28 · Low · Short calls still under-counted.** Keyword Check fixed $0.002 vs $0.0029–0.0033; Reply Reader $0.0059 vs $0.0127 (rows
140–143, key `schedule:reply_read` for an app-shaped call); describe $0.0073 vs $0.0098.

---

## What could not be exercised, and why

- The source re-check of the page QA: it runs only when a live page is refreshed (`Refresh Source Plan`: "not a refresh: no live page is
  being improved in this run"); no protocol run in this part refreshes a page.
- The app's own run path (form → `runs` row → n8n): the toolkit posts the app's body; the reports carry `scheduled: true`. Executor D drove
  the UI.
- The Reply Reader's effect in the app (sequence stop, out-of-office pause, suppression): no mailbox may be connected.
- A content run with a business profile or style guide: none on file.
- Publishing and the live publish check for the written page: nothing may be published.
- difc.com (429 Vercel checkpoint) and centralbank.ae (403) links in the page: not verifiable by GET from here.
- The Word / PDF deliverables were not rendered (no renderer on this Mac); their file names and the report payload were read.
- Whether "retail erp software uae" is really the same search as "erp software uae": no results page was bought for it.

## State left behind

- `seo_monitors` (techand.ai): unchanged except `updated_at` 2026-10-17T15:58:47.631Z and `request_id` "rr1017-lb-on".
- New ladder **`lad_mvcldcnv9q1q`** "it consulting dubai": `seo_ladders` rows 30 ("dubai it consulting companies", `planned`), 31 ("it
  services dubai", `planned`), 32 ("it consulting company dubai", `planned`), 33 (top "it consulting dubai", `writing`); `seo_ladder_settings`
  row `auto`, priority 8, **`active`** — the site now has 7 active ladders. Given A-8, A-11 and A-12, **consider pausing or deleting it**: as
  it stands the Content Cadence may write its rung pages.
- New `seo_content_log` row 8 "it consulting dubai" `not_ready` (source `ladder`) — a draft; nothing published. The site now has 6
  unpublished pages (2 `written`, 4 `not_ready`).
- `seo_run_ledger` rows 137–149, 151, 152 — all `done`; none left `reserved`.
- Cost-calibration rows written by `Save Cost Calibration` in 758, 760, 764, 765, 770, 771.
- 6 rows in the app's `reports` table and their files (two Word files, PDFs, 3 WebP images).
- No e-mail sent, no mailbox connected, no WordPress push, no Bing / IndexNow submission, no Test Runner use.
