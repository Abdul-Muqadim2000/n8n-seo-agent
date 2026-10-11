# Whole-system live test — techand.ai, 2026-10-11

Real runs on the owner's site (country United Arab Emirates), started 15:56 UTC and finished 16:17 UTC. Every API run was sent the way the
web app sends it: header `X-Forwarded-For: app:<techand.ai company>` and techand.ai's own app callback, so every report arrived in the app's
`reports` table. The monitors (scheduled workflows) were started on demand through the Test Runner. No code, workflow or prompt was changed.
No e-mail went to a third party and no mailbox was connected.

**Spend: about $4.3, against a $15 cap.**

| | Amount | How it was measured |
|---|---|---|
| DataForSEO | **$2.69** | Balance $25.1167 at 15:54 UTC, $22.4270 at 16:17 UTC (probed from inside the n8n container). The runs' own ledgers add up to $2.87. |
| Claude | **≈ $1.56** | Token counts × list prices (Opus 5.5 $4 / $20, Sonnet 5.5 $2 / $10, Haiku 4.5 $1 / $5 per million tokens). The three Opus nodes stream, so they report only an estimate and their thinking tokens may be missing. The guard's own estimates for the same runs come to ≈ $3.0, so the real figure is $1.6–3.0. |

**Headline.** Every mode ran end to end and delivered its report to the app. There were no failed executions, and nothing was refused by
the guards. The two weak points are trust and coherence:
- **Guards and diffs don't count correctly.** The spend and rate guards undercount when runs overlap. The audit diff compares a technical
  audit with a full report.
- **Backlink quality is misjudged.** The backlink check ranks link-farm pages above the one real editorial link.
- **Features disagree with each other.** They don't share the site's canonical host, its existing pages, what is already written, or the
  business's name and address. As a result, written pages pile up, an existing page gets duplicated, and the generated page is full of
  placeholders.

---

## 1. Runs

All times are UTC. "API" is the front door's webhook execution, and "run" is the execution that did the work. Costs: DataForSEO is
measured, and Claude is estimated from token counts (§0).

| # | What | Request id | Executions (API → run) | Start–end | Duration | DataForSEO | Claude | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | Site Admin `monitors` → `link_builder: true` | lt-1011-lb-on | 342 → 343 | 15:56:17–15:56:19 | 2 s | 0 | 0 | ok (affected 1) |
| 2 | Reply Reader published (CLI) and activated (API) | — | — | 15:56 | — | 0 | 0 | ok |
| 3 | `describe` | 344 | 344 → 345 | 15:56:52–15:57:07 | 15 s | 0 | 0.006 | completed |
| 4 | `verdict` "e invoicing software uae" | 346 | 346 → 347 | 15:56:56–15:59:23 | 2.4 min | 0.022 | 0.10 | completed |
| 5 | Keyword Check ×3 (`seo-keyword-assess`) | — | 348, 349, 350 | 15:57:07–15:57:20 | 4.1–4.5 s each | 0.078 | 0.008 | 200 ×3 |
| 6 | `ladder` "erp software uae" (pages_now 1) | 351 | 351 → 352 | 15:57:29–15:59:54 | 2.3 min | 0.124 | 0.19 | completed (Direct plan, 4 pages) |
| 7 | → its main page (rung 4, Service / hub) | 351 | 365 | 15:59:53–16:10:22 | 10.5 min | 0.024 | 0.71 | completed, content score 91 |
| 8 | `audit` technical, 200 pages | 353 | 353 → 354 | 15:57:34–16:01:45 | 4.1 min | 0.09 | 0 | completed, health 80 |
| 9 | `discover` (Keyword Report) | 355 | 355 → 356 | 15:58:06–15:59:53 | 1.7 min | 0.225 | 0.16 | completed |
| 10 | → follow-up keyword report "e invoicing" | 355 | 364 | 15:59:51–16:03:11 | 3.3 min | 0.020 | 0.10 | completed, GO_WITH_CHANGES 68 |
| 11 | Reply Reader ×4 (synthetic replies) | — | 357–360 | 15:58:23–15:58:33 | 1.8–3.4 s each | 0 | 0.010 | 200 ×4 |
| 12 | `ai_visibility` | 361 | 361 → 362 → 363 | 15:59:23–16:02:14 | 2.9 min | 0.778 | 0.11 | delivered |
| 13 | `backlinks` (full, paid) | 366 | 366 → 367 → 368 | 16:00:52–16:01:57 | 65 s | 0.373 | 0.005 | delivered (mode full) |
| 14 | `audit` Full SEO Report | 369 | 369 → 370 | 16:04:52–16:11:06 | 6.2 min | 0.821 | 0.05 | completed, health 68 |
| 15 | Link Builder, paid (`seo-link-builder`) | lt1011-lb-paid | 371 → 372 | 16:05:01–16:06:44 | 1.7 min | 0.050 | 0.05 | delivered, 7 sequences |
| 16 | AI Pulse (Test Runner) | lt1011-pulse | 373 → 374 | 16:05:08–16:06:11 | 63 s | 0.084 | 0 | delivered, 1 alert |
| 17 | AI Growth (Test Runner) | lt1011-growth | 375 → 376 | 16:05:11–16:06:04 | 53 s | 0 | 0.014 | delivered |
| 18 | Rank Tracker (Test Runner) | lt1011-rank | 377 → 378 | 16:07:04–16:07:18 | 14 s | 0.060 | 0 | 3 ladder reports |
| 19 | Content Cadence dry run | lt1011-cadence-dry | 379 → 380 | 16:08:47 | < 1 s | 0 | 0 | planned 2 pages, wrote nothing |
| 20 | Site Tracker (Test Runner) | lt1011-site | 381 → 382 | 16:12:41–16:13:22 | 41 s | 0.031 | 0.03 | delivered |
| 21 | Audit Scheduler (Test Runner) → technical audit | lt1011-auditsched | 383 → 384 → 385 | 16:12:44–16:16:40 | 3.9 min | 0.09 | 0 | completed ("on demand" forces an audit) |

**Not run:**
- **`published`:** none of the pages the system wrote is live on techand.ai. Reporting another page as published would write false rows to
  the ladder and the content log.
- **`checkin`:** it would overwrite October's check-in with invented answers.
- **`profile` write:** there is no real author or reviewer data. The read shows `seo_profiles` is empty for techand.ai.
- **Case study, local and video page types:** the brief allowed one paid page.
- **The error path:** it e-mails ops.
- **The form path and the app UI:** there is no owner session.
- **A second full report to prove the domain-age cache:** the `age:` rows were written, and checking them was enough.

No temporary workflows were created. The Test Runner is deactivated again; it was inactive before the test.

---

## 2. Findings by feature

### 2.1 Site description and Keyword Check (runs 3, 5)

**What it produced**
- `describe` (15 s): "Tech&", an enterprise digital-transformation and Microsoft partner in the GCC, with 8 services and 10 seed keywords.
  The services list leaves out Business Central, CRM and Power Platform: only the homepage is read.
- Keyword checks (about 4 s each):
  - "erp software uae": 480/mo, KD 3, CPC $13.98, Easy, Direct plan, fit 2.
  - "business central partner uae": no data, Short ladder, **fit 1**.
  - "dynamics 365 partner uae": no data, fit 2.

**Quality:** fast and plausible. The fit score suffers from the homepage-only description (D22).

**Compared with earlier runs:** same as K1 on 2026-10-08.

### 2.2 Keyword verdict (run 4)

**What it produced:** GO_WITH_CHANGES 58 for "e invoicing software uae".
- Volume 40/mo, rising from 0 to 110/mo (+120% quarter on quarter). CPC $13.37, medium competition.
- Top 10 are accredited vendors with 463–1,256 words.
- Sensible risks: accreditation, small volume, an AI Overview, inconsistent mandate dates.

**Quality:** sound, data-led reasoning.

**Compared with earlier runs:** the same keyword scored 55 on 2026-10-03 (3.3 min); now 58 (2.4 min). Stable.

### 2.3 Discovery and its follow-up report (runs 9, 10)

**What it produced**
- 370 keywords → 240 screened by the AI → 123 relevant, 45 clusters, 8 priority keywords. AI search demand was answered.
- Start with "e invoicing" (1,900/mo, KD 0). Then "erp software uae", "erp software in uae", "erp system dubai", "erp software dubai",
  "best erp software in uae".
- The follow-up keyword report for "e invoicing": GO_WITH_CHANGES 68. It calls for a hybrid explainer and service page, and flags dates
  amended by Ministerial Decision 66 of 2026.

**Quality:** good picks with buyer value. No float CPCs in the PDF or Word file (the 2026-10-09 fix holds). Problems (D20):
- **Overlap with an existing ladder:** the top pick "e invoicing" overlaps the existing ladder head "e invoicing in uae", with no warning.
- **Contradictory card:** the card's "why" says "AI Overview present" while its own live check found none.
- **Duplicate domains** in "Who ranks now".
- **Float CPCs** are still in the callback JSON.

**Compared with earlier runs:** 2026-10-01: 624 → 126 relevant, $0.22, 2.0 min. Now 370 → 123, $0.225, 1.7 min. Same.

### 2.4 Keyword ladder and its page (runs 6, 7)

**The plan:** "erp software uae", Easy, Direct plan, 2–4 months.
- Main page written first.
- Rung 1: "best erp software in dubai" (140/mo, KD 8).
- Rung 2: "erp software dubai" (390/mo, KD 11) and **"facts erp"** (260/mo, KD 19), a competitor's brand (FACTS ERP / facts.ae) planned
  as a blog post (D8).
- The volume analysis is honest: "880 plateau looks inflated, plan on 100–300".
- Ladder settings row registered (Auto, priority 3).

**The page** (`files/erp-software-uae.{md,html,meta.json}` plus the PDF and Word files)

*Strengths*
- Strong structure: an answer block, a Microsoft-partner disclosure and a vendor-neutral 8-platform table.
- Decision rules by company size, a UAE compliance checklist (VAT, Corporate Tax, WPS, PINT AE through an ASP) and an 8-phase timeline
  with go-live gates.
- 6 real internal links to Tech&'s service pages. Schema: Service, ItemList, BreadcrumbList, FAQPage. Three-image plan.
- Title 52 characters, meta description 136.
- The critic (72, "revise") was precise. Content QA scored 84 → editor → 91 and passed.

*Weaknesses*
- **Placeholders (D10):**
  - Not publishable as written: **30 × [Price] and 20 × [Timeline]**. Cost and timeline were the angle the brief chose (the "content gap"),
    but the business never supplied the data.
  - [Office address], [Phone number], [Email address] and "[Your Business Name]" in the schema, although the homepage schema states Tech&,
    the DAFZA address and the phone number.
- **Length (D10):** 3,952 words (meta; 3,844 in the main content plus a 530-word FAQ). The ladder verdict asked for about 2,100. The brief
  set 3,100 because the page type was free text: "Service Page (ERP implementation UAE, with comparison and cost sections built in)".
- **Links and hosts:**
  - Links to 3 unwritten pages, twice each. "Guides in this series" uses lowercase keyword strings as anchors ("Facts erp") (D9).
  - Internal links mix techand.ai and www.techand.ai (D15).
  - A Statista link keeps `?srsltid=`. A weak source (trangotech.com) is cited 3 times.
- **Wrong correction:** the critic called Tech&'s real "Assess & Envision / Run & Optimise" stages "invented", because the site
  description never reads /whatwedo/.

**Compared with earlier runs**

| | 2026-10-01 | 2026-10-02 | 2026-10-08 | Now |
|---|---|---|---|---|
| Duration | 10.3 min | 13.9 min | 9.2 min | 10.5 min |
| Content score | 85 | 85 | 88 | 91 (best so far) |
| Words | 2,458 | 1,635 | — | 3,952 |

The length overrun first seen on 2026-10-01 is back.

### 2.5 Technical audit, full SEO report and Audit Scheduler (runs 8, 14, 21)

**What it produced**
- Technical audit: health 80. 5 High, 10 Medium, 14 Low.
- Full report: health 68. 19 High. Competitor benchmark, keyword gap, authority section, AI review, fix pack (robots.txt, llms.txt,
  3 JSON-LD files, internal-links.csv), Search Console section (37 clicks, 5,212 impressions, 15 of 25 sampled pages not indexed).

**Spot-checks against the live site** (fetched from the n8n container)

| Finding | Live site | Verdict |
|---|---|---|
| Placeholder (lorem ipsum) text is live | Found on /industries | true |
| Orphan /whatwedo/* pages | The site links only to `/whatwedo#ai-automation` fragments | true |
| Missing meta description, and brand twice in the title | /power-platform-analytics-uae: "… \| Tech& \| Tech&" | true |
| HTML not cacheable | `private, no-cache, no-store`; x-vercel-cache MISS | true |
| No Service schema on service pages | /dynamics-365-crm-uae has no Service type | true |
| **www and non-www not consolidated** (High) | techand.ai answers 308 to www.techand.ai, and the canonical is www | **false positive** (D6) |
| **Duplicate meta tags, 45/47 pages** | The only duplicates are 3 `theme-color` tags with light/dark media queries (Next.js) | **false positive** (D18) |

**Quality:** mostly accurate and actionable, with URLs listed per finding. The full report's executive summary ("no verifiable proof:
named clients, case studies, authors") is sharp. Problems:
- **Keyword gap (D4):** it recommends pages for "fta login" (90,500/mo), "fta", "emaratax", "emirates id" and "emirates id status".
- **WHOIS instead of RDAP (D7):** RDAP was never parsed, so WHOIS was paid for all 3 domains ($0.36).
- **Robots fix pack (D17):** it drops the site's Disallow rules for the AI bots.
- **Audit diff (D2):** the Audit Scheduler's technical audit, compared with the full report 20 minutes earlier, says
  **"25 fixed · 1 new, score +12"**. Its "fixed" list includes "The site does not rank in Google's top 10" and "ChatGPT recommends
  other providers".

**Compared with earlier runs:**
- Technical audit: 2026-10-02 A3, 4.7 min, health 70 → now 4.1 min, health 80.
- Full report: 2026-10-01, 8.1 min, $1.02 (WHOIS $0.48) → now 6.2 min, $0.82 (WHOIS $0.36).
- The www false positive has been in every audit since 2026-10-01.

### 2.6 AI visibility, AI Pulse and AI Growth (runs 12, 16, 17)

**AI visibility**
- techand.ai was named in 0 of 88 answers (95% range 0–4.2%). Leaders: tallysolutions.com (23% share), zoho.com, cleartax.com.
- Brand recognised by 4 of 5 assistants ("Dubai Microsoft Dynamics 365 partner … not identified as accredited ASP"), sentiment +25,
  no wrong claims.
- Crawler access 8/8. GA4: 0 AI visits, 82 of 292 sessions organic.
- Claude answered 7/7 (the 2026-10-08 Claude fix works). Cost $0.78.
- **7 of 42 requests errored** with no retry (D19): DataForSEO "Internal SE Server Error" ×5 on AI Mode and AI Overview, ChatGPT
  "no response" ×2.
- A heading, "Tax technology and e-invoicing software", was counted as a competitor brand.
- Cited pages are not normalised: bare host and www, and `#:~:text=` fragments, are counted separately.

**AI Pulse**
- 21/21 answered, 0 named, $0.084.
- One real alert: odoo.com is named in 9 of today's 21 answers.
- Compared with earlier runs: the same $0.084 as 2026-10-08.

**AI Growth**
- 12 key pages scored (average 75; 77 before). 2 pages sent to Bing. IndexNow file still missing on the site.
- 7 questions to win, 3 of them mapped to ladder pages ("one search, one page" works).
- **The drafts are the weak part (D12):**
  - To mof.gov.ae and tax.gov.ae: 3 drafts, while the Link Builder correctly refuses government sites.
  - To competitors: orksync.com (an ERP implementer), suntecgroup.com and flick.network (e-invoicing vendors).
  - They open with "your site is cited in AI answers (Perplexity, Claude …)" and quote nothing from the page.
  - They sign as "techand.ai" / "Techand".
- Source titles are cut at a hyphen ("E", "Best e").
- **Bing submissions and the IndexNow key URL use the bare host** (D15).

### 2.7 Backlinks (run 13, paid full check)

**What it produced**
- 17 referring sites: DataForSEO 16, Common Crawl 1, GA4 3 referrers. Snapshot mode `full`. $0.37, 65 s.
- **peppol.org is live and followed, in the content (own check, GA4 + Common Crawl)**, although DataForSEO no longer lists it. There was
  no false "lost" alert: the v4.10 rule holds.
- 5 "best X" lists that leave techand.ai out: azdan.com, refrens.com, softwaresuggest.com and others. Link gap: mof.gov.ae and uae-asp.ae
  link to both competitors. 60 prospects.

**Quality (D3)**
- "Best links" and "best SEO value" list **15 PBN / link-farm pages** (same `/all/2835/13.html` path, anchor "High Quality Dofollow
  Backlinks DA 50 PA 40 Premium PBN Network Service techand…", casino domains) **above peppol.org**: SEO value 49 vs 35.
- Only 4 of those 16 pages are flagged spammy. The disavow file has 4 domains.
- The other 15 are shown as "at risk", and the Link Builder tracks their "impact".

**Smaller problems (D23)**
- The Ahrefs DR lookup failed on DNS (EAI_AGAIN) and was not retried.
- clear.in (ClearTax's sister domain) and off-topic gap domains (stripe.com, weforum.org, kirkland.com …) are stored as prospects.
- `utm_source=chatgpt.com` is left in URLs.

**Compared with earlier runs:** 2026-10-02 B1: 27 s, $0.20, 13 sites. Now 65 s, $0.37, 17 sites, more sources and our own link check.

### 2.8 Link Builder (paid) and Reply Reader (runs 15, 11)

**Link Builder:** 1.7 min (the earlier free runs took 11+ min or hit the limit). 22 qualified, 21 not a fit, 11 need a contact, 7 drafted.
Government sites were routed to "apply". Off-topic, foreign-language and spam sites were refused, and the writer refused 3 more itself.

The sequences (`files/link-builder-sequences-2026-10-11.txt`, addresses redacted) are close to the spec:

| Spec item | Result |
|---|---|
| Personal first line quoting their page | yes, in most |
| First e-mail length | 85–100 words |
| Links | one |
| SEO jargon ("backlink", "dofollow") | none |
| Follow-ups | 40–55 words; the last asks "who is the right person?" |
| Link text | brand or the page's title |
| Contacts | all on the prospect's own domain |
| Unverifiable claims | marked [Owner: confirm …] |

Problems (D13):
- **Brand name:** written as "techand", not Tech&.
- **Targets:** links mix the bare host and www.
- **Who is pitched:** competitors (bemea.com, sscoglobal.com) and homepages (apideck.com, technologycounter.com).
- **Accredited lists:** the ASP-list pitches ask to be added to accredited-provider lists, although Tech& is not accredited.
- **Prospect noise:** outlook.com and zoominfo.com are listed as broken-link prospects.
- **Two writers:** finline.ae was drafted by both the Link Builder and AI Growth (D12).
- **Listings:** 12 of 16 are "unknown" behind bot walls. OpenPeppol and SaaSHub are missing, LinkedIn is linked. The MoF list flipped from
  "missing" (free run earlier today) to "unknown".

**Reply Reader** (`files/reply-reader-tests-2026-10-11.txt`): 1.8–3.4 s, ≈ $0.0026 per reply.

| Reply | Class | Result |
|---|---|---|
| A question | `question`, needs you | correct |
| An opt-out | `unsubscribe` | correct |
| Out of office | `out_of_office` | return date 2026-10-19 and the referral address read correctly |
| "Done", naming peppol.org's members list | `says_linked` | **link_found true** (follow, content) |

Defect (D14): the suggested answer to the question **invents a business fact**: "we're not directly accredited by the Ministry, but we work
with accredited providers". The facts were empty.

### 2.9 Rank Tracker, Content Cadence and Site Tracker (runs 18, 19, 20)

**Rank Tracker:** 6 SERP checks, $0.06, 14 s, nothing in the top 50. Two wrong next steps (D16):
- **"peppol uae":** "Every rung is in the top 10: write or improve the top page". The ladder has no rungs, and the page is neither
  published nor ranking.
- **"erp software uae":** it says "work on rung 1", but the Direct plan writes the main page first.

**Content Cadence dry run:** Monday would write the ladder page "accredited service provider for e invoicing in uae" (aimed at its AI
question) and the AI page "best e-invoicing software uae". The cadence sees only 2 pages waiting to be published (limit 3). In fact
**4 written pages are unpublished**: the ladder's own pages (2026-10-01 "uae e invoicing penalties" and today's "erp software uae") are
not in `seo_content_log` (D5).

**Site Tracker:** 37 clicks (+147%), Google Search Console and GA4 connected, publish detection ran (45 sitemap URLs, 4 candidates,
none live). The brief is accurate except "peppol uae up 1,200%", taken from a sparse Trends series (D21). It also tells the owner to
publish "uae e invoicing penalties". techand.ai already has
/insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs (2026-08-21, AI-readiness 90/100, which AI Growth knows),
so this would cannibalise it (D11).

---

## 3. Defects, ranked by impact (numbered for the fix session)

**High**

1. **D1. The spend and rate guards undercount under concurrency.**
   - *Evidence:* after 8 app-keyed runs and 3 internal spawns, the main workflow's static data shows
     `rate.total 5`, `app:<company> 3`, `ai_budget.spent_est $0.67`. The guard's own estimates for these runs add up to ≈ $3.0.
   - *Cause:* parallel executions (347/352/354/356 …) overwrite each other's `$getWorkflowStaticData`.
   - *Effect:* the $6/day budget and the 40/day company limit can be bypassed by parallel requests.
2. **D2. The audit diff compares unlike report types.**
   - *Evidence:* the technical audit (exec 385) against the full report 20 minutes earlier (aud_mv40sm450bi) gives "25 fixed · 1 new,
     +12". "Fixed" includes "does not rank in top 10", "ChatGPT recommends other providers" and "keyword gap".
   - *Effect:* it happens every month after an on-demand full report.
3. **D3. Backlinks ranks PBN link-farm pages as the best links.**
   - *Evidence:* "best links" puts 15 PBN pages above peppol.org (SEO value 49 vs 35). Only 4 of 16 identical PBN links are flagged
     spammy, and the disavow file lists 4. The 15 are shown as "at risk" and tracked for impact (exec 368, 372).
4. **D4. The full report's keyword gap recommends government navigational queries.**
   - *Evidence:* "fta login" (90,500/mo), "fta", "emaratax", "emirates id", "emirates id status" (exec 370).
5. **D5. The pile-up guard undercounts unpublished pages.**
   - *Evidence:* pages the ladder writes are not in `seo_content_log`, so the cadence counts 2 waiting while 4 are written and
     unpublished, and plans 2 more for Monday (exec 380).
6. **D6. The audit reports www and non-www as not consolidated, which is false.**
   - *Evidence:* techand.ai answers 308 to www, and the canonical is www. The same report lists the redirect under "what works", and the
     fix points the wrong way. The finding has been in every audit since 2026-10-01 (exec 354, 370, 385).
7. **D7. RDAP results are never parsed, so WHOIS is always paid.**
   - *Evidence:* `RDAP Lookup` returns rdap+json as a string under `data`, and `RDAP Results` reads `r.events`. All 3 domains went to paid
     WHOIS ($0.36), although RDAP had their registration dates (exec 370).
8. **D10. The generated page is not publishable.**
   - *Evidence:* 50 [Price]/[Timeline] placeholders, NAP and schema placeholders although the facts are known from the homepage, and
     3,952 words against a 2,100-word target (exec 365).

**Medium**

9. **D8.** A competitor brand ("facts erp") is planned as a ladder page and written into the main page (exec 352, 365).
10. **D9.** The hub page links twice to 3 unwritten pages while the Direct plan publishes it first. "Guides in this series" uses
    lowercase keyword anchors.
11. **D11.** The system is blind to existing pages. The 2026-10-01 ladder planned "uae e invoicing penalties" although a page on it was
    live since 2026-08-21, and today the Tracker and Site Tracker say "publish it".
12. **D12.** AI Growth drafts go to government sites and competitors, use AI jargon and quote nothing from the page. It is a second writer
    next to the Link Builder (exec 376).
13. **D13.** Link Builder: the brand appears as "techand", competitor and homepage pitches, pitches to accredited lists, outlook.com and
    zoominfo.com as prospects.
14. **D14.** The Reply Reader's suggested answer invents an accreditation statement.
15. **D15.** No shared canonical host. Ladder target URLs, internal links, Bing submissions and the IndexNow key URL use bare techand.ai,
    which 308-redirects; the audit flags "links pointing to redirects".
16. **D16.** The Rank Tracker's next step is wrong for ladders that have only a main page or a Direct plan.
17. **D17.** The fix-pack robots.txt gives the AI bots `Allow: /` and drops /api/, /admin/ and /private/.
18. **D19.** AI visibility: 17% of requests errored with no retry, a generic phrase was counted as a brand, and cited URLs are not
    normalised.

**Low**

19. **D18.** "Duplicate meta tags" is the Next.js `theme-color` set, a false positive.
20. **D20.** Discovery: overlap with an existing ladder, contradictory AI Overview text, duplicate domains, float CPCs in the callback.
21. **D21.** A sparse Trends percentage is quoted in the Site Tracker brief.
22. **D22.** The Keyword Check's topic fit reads only the homepage, so Business Central scored fit 1.
23. **D23.** Ahrefs DR is not retried after a DNS error. Sister and off-topic gap domains are stored as prospects. `utm_source` is left in
    URLs.
24. **D24.** The full report duplicates the author finding, shows a "capped at 85" message when the score is 68, and lists scraper boolean
    queries among the top queries.
25. **D26.** The verdicts state a volatile AI Overview as fact. The plan said "no AI Overview" and the page run a few minutes later said
    "cites 11 domains".

**Operations (not code)**

26. **D25.**
    - *Missed pulse runs:* the AI Pulse schedule (06:30 New York, Tue–Sun) did not fire on 2026-10-10 or 2026-10-11. The earlier fires
      were late (exec 240 at 10:48, exec 261 at 12:36 UTC), which suggests the Mac was asleep or n8n restarted.
    - *Lost ops alert:* the Error Handler's e-mail failed on 2026-10-10 (ECONNREFUSED), and it has no other channel.
    - *Test data in production:* October's Search Console check-in is still the 2026-10-02 test row ("October check-in (test)"), so the
      reminder will not ask the owner.

---

## 4. Owner items surfaced (not defects)

- **No business profile:** every page and draft carries [Author] and [Your name], and the schema has placeholders.
- **No business facts:** the app's `business`, `business_facts` and `cta` fields are empty for techand.ai.
- The IndexNow key file is not uploaded.
- Tech& is not an accredited ASP. The AI answers, AI Growth and Link Builder all depend on how it wants to position itself (partner of an
  accredited provider?).
- 4 written pages wait to be published, and one of them duplicates an existing article (D11).
- The audit's true findings: lorem ipsum on /industries, orphan /whatwedo/* pages, no Service schema, and no meta description plus a
  doubled brand on /power-platform-analytics-uae.

## 5. State left behind

**Changed for the test, left in place**
- Link Builder **on** for techand.ai (`seo_monitors.link_builder = true`).
- Reply Reader **published and active**. No mailbox is connected, so it cannot be called by the app yet. Deactivate it if it was meant
  only for this test.

**Real outputs**
- A new ladder "erp software uae" (`lad_mv40b6s9h5a8`, 4 rows, Auto, priority 3) and its written main page.
- New rows in `seo_link_outreach` (7 drafted), `seo_link_prospects`, `seo_ai_*`, `seo_backlinks`, `seo_audits` and `seo_cache`
  (`age:` and `sitemap:` rows).
- 20 reports in the app.

**Restored:** the Test Runner is deactivated again. Nothing was deleted.

**Not mine:** `SEOagentTmpTest1` ("TMP test — call Backlink Monitor") was already in n8n before the test, inactive.

## 6. Artefacts (`files/`)

| Run | Files |
|---|---|
| Ladder page | `erp-software-uae.{md,html,meta.json}`, `seo-report-and-content-erp-software-uae-2026-10-11.{pdf,doc}` |
| Verdict, ladder plan, discovery | `keyword-verdict-…`, `keyword-ladder-…`, `keyword-ideas-…`, `seo-report-e-invoicing-…` (pdf, doc) |
| Audits | `site-audit-…`, `full-seo-report-…` (pdf, doc), fix pack (`robots.txt`, `llms.txt`, `*.jsonld`, `internal-links.csv`, `README.txt`) |
| Monitors | `ai-visibility-….pdf`, `backlinks-….pdf`, `disavow-candidates-….txt`, `seo-performance-techand.ai-2026-10-08.pdf` (Site Tracker), `ai-pulse.html` |
| Drafts and replies | `link-builder-sequences-2026-10-11.txt`, `ai-growth-drafts-2026-10-11.txt` (contact addresses redacted), `reply-reader-tests-2026-10-11.txt` |

The prospects CSV was not saved: it holds third-party contact addresses, and the repository is public.
