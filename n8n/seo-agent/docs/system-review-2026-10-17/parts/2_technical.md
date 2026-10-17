# Part 2 — Technical audit (JavaScript crawl), Full SEO Report, pre-release check, publish check (executor B)

Fourth whole-system re-rating, 2026-10-17, site **techand.ai** (United Arab Emirates). Executor B ran: a 200-page technical audit with
`crawl_js: true`, a 200-page Full SEO Report (one after the other, not in parallel), five pre-release checks (two as on 2026-10-15, three
with the new threshold / expected-change fields) and five calls to the stand-alone publish check. Executor A ran keyword / ladder runs in
the same window (executions 749–751, 753–765, 769–771 are A's or the Reply Reader's, not mine).

| | |
|---|---|
| UTC start / end | 15:58:38 (balance probe "B start") → 16:14:47 (balance probe "B end"); first request 15:58:49.9, last execution finished 16:14:19.7 |
| DataForSEO balance | **$8.022516** at 15:58:39 ("B start", `today_total` 0.092) · $7.501356 at 16:06:38 (after the audit) · $6.922601 at 16:14:27 (after the full report) · **$6.922601** at 16:14:47 ("B end", `today_total` 1.191915). Moved **−$1.099915** in my window, but executor A's runs spent in the same minutes (see "Cost"). Far under the $4.50 / $3.00 stop lines. |
| My executions | 738 → **739** (technical audit) · 766 → **767** (Full SEO Report) · **740, 741, 742, 743, 744** (pre-release check) · **745, 746, 747, 748, 752** (publish check) |
| Artefacts | `/Users/abdul.muqadim/n8n_devaicon/n8n/seo-agent/docs/system-review-2026-10-17/files/B-*` (git-ignored) plus `exec-739.json`, `exec-767.json`, `report-6b9f795f-….json`, `report-9f125e5a-….json`. Key ones: `B-audit-739-build-site-issues.json`, `B-audit-739-diff.json`, `B-audit-739.doc` + `B-audit-739-doc.txt`, `B-fixpack-739-*`, `B-full-767-build-site-issues.json`, `B-full-767-site_keywords.json`, `B-full-767-diff.json`, `B-fullreport-767.doc` + `-doc.txt`, `B-prerelease-3a…3e*.json`, `B-pc1…pc5.json`, `B-exec-739-nodes.txt`, `B-exec-767-nodes.txt` |

Bodies sent (the toolkit adds the callback URL and never prints it; shape checked against `app/shared/src/payload.ts` `case 'audit'`,
which since 2026-10-16 also sends `ga4_property_id`):

- Run 8: `{"domain":"techand.ai","country":"United Arab Emirates","email":"","business":"","customers":"","mode":"audit","keyword":"","report_type":"Site Audit","crawl_pages":200,"crawl_js":true,"competitors":["cleartax.com","azentio.com"],"ga4_property_id":"543096312"}`
- Run 14: the same with `"report_type":"Full SEO Report","crawl_js":false` (the same `crawl_js` as the 2026-10-15 full report, so the two are comparable).
- Pre-release and publish check: see §3 and §4.

## Runs

| # | What | Request id | Executions (API → run) | Start–end UTC | Duration | DataForSEO: run's own figure · ledger row | Claude (`RR claude`) | Status |
|---|---|---|---|---|---|---|---|---|
| 8 | Technical audit, 200 pages, **JavaScript crawl** | 738 | 738 → 739 | 15:58:49.9 – 16:06:25.1 | 7 min 35 s | **$0.0954** = Fetch GBP $0.0108 measured + crawl $0.0846 estimated (quote **$0.36** for 200 JS pages, 47 crawled × $0.0018) · ledger id 136: `dfs_usd 0.0954`, `dfs_est_usd 0.1125`, `settled_usd 0`, `measured_usd 0.0108`, `estimated_usd 0.0846`, `done` | none (0 calls) | success; callback received 16:06:20.6; health **85 "Good"**, 24 findings |
| 14 | Full SEO Report, 200 pages, no JS | 766 | 766 → 767 | 16:06:42.6 – 16:14:19.7 | 7 min 36 s | **$0.377** = $0.3559 measured + crawl $0.0211 estimated (quote $0.09) · ledger id 150: `dfs_usd 0.377`, `dfs_est_usd 0.5714`, `ai_usd 0.0592`, `settled_usd 0.0592`, `measured_usd 0.3988`, `estimated_usd 0.0374`, `done` | 1 call, Sonnet 5.5, **MEASURED** 11,276 in / 2,258 out = **$0.0451** (engine says $0.0592, B-8) | success; callback received 16:14:12.2; health **70 "Needs Improvement"**, 55 findings |
| PR-a | Pre-release, 10 live key pages | — | 740 | 15:59:23.1 – 15:59:28.1 | 4.99 s | $0, no ledger row | none | 200 `pass`, exit 0 |
| PR-b | Pre-release, bare-host redirect + 404 + page without description | — | 741 | 15:59:28.2 – 15:59:30.3 | 2.21 s | $0 | none | 200 `fail`, exit 1 |
| PR-c | as b + `fail_on: "high"` + `expected` list (3 entries) | — | 742 | 15:59:47.7 – 15:59:50.3 | 2.62 s | $0 | none | 200 `pass`, exit 0 |
| PR-d | as b + `fail_on: "low"` + `expected` for the 404 only | — | 743 | 15:59:50.4 – 15:59:51.8 | 1.38 s | $0 | none | 200 `fail`, exit 1 |
| PR-e | invalid `fail_on` and an unknown check in `expected` | — | 744 | 15:59:51.9 – 15:59:51.9 | 0.08 s | $0 | none | 400 `error`, exit 2 |
| PC-1 | Publish check: a live techand.ai article as Markdown | — | 745 | 16:01:06.3 – 16:01:06.5 | 0.26 s | $0 | none | 200 `not_publishable`, exit 1 |
| PC-2 | PC-1 + a link to a URL that answers 404 | — | 746 | 16:01:06.6 – 16:01:06.7 | 0.19 s | $0 | none | 200 `not_publishable`, exit 1, the 404 link removed |
| PC-3 | a URL instead of Markdown (the 404 URL) | — | 747 | 16:01:06.8 | 0.08 s | $0 | none | 400, exit 2 |
| PC-4 | the 404 page's own text as Markdown | — | 748 | 16:01:06.8 – 16:01:06.9 | 0.08 s | $0 | none | 400, exit 2 |
| PC-5 | PC-1 with the keyword the page actually uses | — | 752 | 16:01:26.6 – 16:01:26.7 | 0.17 s | $0 | none | 200 `not_publishable`, exit 1 |

Every node of 739 (126 node runs) and 767 (194 node runs) is `success` (`B-exec-739-nodes.txt`, `B-exec-767-nodes.txt`). No engine
refusal occurred (the audit finished before the full report started). Durations against 2026-10-15: technical audit 5.5 → 7.6 min (the
JavaScript crawl needed five one-minute crawl waits instead of three), full report 7.9 → 7.6 min. Slowest nodes: *PageSpeed* 42.6 s (767),
*Render Key Pages* 26.5 s (739), *Fetch GBP* 23.2 s (739), *AI SERP* 17.1 s (767), *Content Reviewer* 16.2 s (767), *GSC Audit Query*
15.4 s (739), *Fetch Raw Pages* 13.5 s (739).

---

## 1. Technical audit with a JavaScript crawl (run 8, exec 739)

### What came back

Headline (*Build Site Issues*, `B-audit-739-build-site-issues.json`): `health_score 85`, no cap, grade "Good"; `issue_counts {Critical 0,
High 4, Medium 7, Low 11, Info 2}` = 24 findings; `pages_crawled 45` (the notes: "Only 45 of 47 crawled pages were analysed in detail" —
the other two are the 308 bare-host redirects). Category scores: Crawlability & Indexing 78, On-Page 88, Content 77, Performance 74,
Security 97, Images 97, Technical 100, AI Search Readiness 92. DataForSEO on-page score 93.35.

The customer reads (Word report `B-audit-739.doc`, text `B-audit-739-doc.txt`; 70,969 bytes, identical to the file stored in the app):

> We crawled 45 pages of techand.ai … We found: Critical 0 · High 4 · Medium 7 · Low 11 · Info 2.
> Fix These First. Ordered by likely impact. "www and non-www are split in Google: most pages are shown under https://techand.ai, not
> https://www.techand.ai" is first because Google cannot index or follow these pages, 15 of 45 crawled pages, about 0 clicks and 1,293
> impressions in the last 28 days, High severity — impact score 37 against 37.1 for "HTML cannot be cached by the CDN (no-store / private)".

The 24 findings in delivered order (impact in brackets): 1 High www/non-www split in Google, 15 pages (37) · 2 High CDN no-store (37.1) ·
3 Medium render-blocking 45/45 (17.9) · 4 Medium low text-to-HTML 44/45 (17.7) · 5 Medium image payload > 1 MB 35/45 (16.1) · 6 Medium
**"AI crawlers see a different version of 20 key page(s)"** (10.6, scored) · 7 Low missing CSP (7.4) · 8 Low no Google Business Profile
(7.4) · 9 High orphan pages 6 (6.5) · 10 High lorem ipsum on `/industries` (4.8) · 11 Medium duplicate content, 7 pages named (4.5) ·
12 Medium missing description `/power-platform-analytics-uae` (3.7) · 13 Medium brand repeated in title, same page (3.7) · 14 Low hard to
read 24 (3.6) · 15 Low long URLs 5 (minor) · 16 Low shown in Google but never clicked 11 (2.8) · 17 Low title < 30 characters 12 (2.3) ·
18 Low URLs not SEO-friendly 4 (2.1) · 19 Low internal URLs that redirect 2 · 20 Low links pointing to redirects 2 · 21 Low light content
`/contact-us` 342 words (minor) · 22 Low images missing alt 45 (minor) · 23 Info CWV field data not available · 24 Info H1 = title 2 (minor).
`evidence_withheld: []`; every finding carries evidence and `impact_traffic` with `estimated: false` (the page rows were looked up for
every page: orphans "about 0 clicks and 17 impressions", lorem ipsum "0 / 8", missing description "0 / 91").

**The host split.** The first finding (evidence quoted from the report): "Search Console page rows (28 days): https://techand.ai 37
page(s), 25 clicks, 5,016 impressions (87% of page impressions); https://www.techand.ai 24 page(s), 5 clicks, 743 impressions; Google
chose https://techand.ai as the canonical of 2 inspected page(s) whose own canonical names https://www.techand.ai …; the sitemap submitted
to Search Console is https://techand.ai/sitemap.xml; 15 key page(s) not indexed under https://www.techand.ai are shown under
https://techand.ai (1,293 impressions, 0 clicks); your server redirects (308) https://techand.ai to https://www.techand.ai and the
homepage canonical tag names https://www.techand.ai". Fix: "submit https://www.techand.ai/sitemap.xml … change internal links that still
point at https://techand.ai, keep the redirects … Requesting indexing page by page does not help". The Search Console section prints
"Google shows this site under two addresses …", and "Pages shown in Google but never clicked" adds "9 of them are listed under
https://techand.ai, the other address (see the www and non-www finding)". On 2026-10-15 (exec 595) the same data was delivered as "A large
share of important pages is not indexed by Google … request indexing"; that finding is not in this report.

**URL Inspection:** `inspection_stats {asked 45, checked 45, failed 0, retried 0}`; "30 of 45 key pages are indexed, 15 are not"
(30 submitted and indexed, 10 unknown to Google, 1 crawled not indexed, 2 discovered, 2 Google chose a different canonical).

**JavaScript / response vs render (new).** `render_diff`: `crawl_js true`, `pages_checked 25` = 5 key pages rendered by the render service
+ **20 "paired with the JavaScript crawl"** ("a plain request for the first response against what the crawl saw after its scripts ran").
The 5 rendered pages agree on every figure (homepage links 90/90, words 1,781/1,781; the two "robots" rows are "absent" in both readings).
On all 20 paired pages the **first response has more** links and words than the "after JavaScript" side — e.g. `/security` links 52 vs
29, words 694 vs 439; `/contact-us` 52 vs 29, 598 vs 342; `/whywith-techand` 61 vs 29, 1,139 vs 836 — and that became the scored Medium
"AI crawlers see a different version of 20 key page(s)" with the fix "Server-render at least the title, the main heading, the opening
answer and the in-content links". Checked live and in the code: B-1. Coverage: 25 of the 45 crawled pages were compared, not every page.
`uncrawlable_links {pages_with 0, pages_checked 25}`. **hreflang:** `null` — no techand.ai page declares hreflang (0 of 45 in my fetch), so
the check is silent by design; the hreflang path itself was not exercised.

**GA4 key events in the impact weight (new).** *GA4 Key Events (Audit)* asked GA4 property 543096312 for `keyEvents` by landing page,
Organic Search, 2026-09-19 → 2026-10-16: every row 0 key events (homepage 42 sessions). The report says so: "Weight used: Search Console
clicks and impressions only — GA4 key events were not used: GA4 recorded no key events from organic search in the last 28 days (none
configured, or none happened), so they cannot rank the findings." The weighting path with real key events was therefore not exercised.

**Crawl extras.** *Run Crawl Extras*: 4 × `20000 "Ok."` (duplicate_title, duplicate_description, non_indexable, redirect_chains), each with
0 items. On 2026-10-15 all four answered `40401 "Task Not Found."`.

**CrUX:** API enabled, `no_data` for every template ("too few real-user visits"); an Info line that does not score.

**Fix pack** (`B-fixpack-739-*`): robots.txt "Keep /robots.txt as it is (no change needed …)" with every live line kept; llms.txt 8,394
characters ("you already have one: compare first"); organization / localbusiness / website JSON-LD; internal-links.csv with 12 rows (8 of
them link the 6 orphan `/whatwedo/*` pages, see B-15); README.

**Diff** (`B-audit-739-diff.json`): previous `aud_mvbedr31l1f` (`site_audit`, 2026-10-16 20:05, health 85, 22 findings — that audit
already carried "AI crawlers see a different version of 20 key page(s)", so it was also a JavaScript crawl) → "0 fixed · 0 new · 22 still
open (compared with the technical audit of 2026-10-16)", `score_delta 0`, `not_compared []`, `sample_moved 0`; the host-split row
`affected 15, affected_before 15, checked 45, checked_before 45`. `seo_audits` has no column recording whether a crawl used JavaScript.

**Stored rows**: `seo_audits` id 26 (`aud_mvcl9in6c1y`, 85, findings 22, high 4 / medium 7 / low 11 — consistent with the 22 stored
`seo_audit_findings` rows; the 2 Info findings are not stored).

### What the customer sees in the app

`reports` row `6b9f795f-6e9c-417c-b316-8717f177c5a0`: stage `site_audit`, status `completed`, title "Technical audit · techand.ai",
summary `{high 4, grade Good, medium 7, critical 0, scoreDelta 0, healthScore 85}`, `scheduled: true` (the toolkit posts straight to n8n,
so the app has no run row; an artefact of the method). Payload: `top_issues` (the four High titles), `audit_diff`, `search_console`,
`site_structure`, `render_diff`, `crux`, `fix_pack`, `run_ledger`, `priority_first`, `run_cost_estimate_usd 0.11` ("search data $0.11
(calibrated from this mode's last settled runs …)", see B-9), the Word file (70,969 bytes) and the PDF (175,658 bytes). `emailed_to: null`.

### Findings checked against the live site

Fetched 2026-10-17 16:10–16:25 UTC with curl: all 45 sitemap URLs (headers + HTML; per-page summary in `files/B-live-techand-45-pages-scan.json`), both
hosts for redirects, three pages as GPTBot. **24 findings: 17 true, 1 false, 2 partly true, 4 not verifiable.**

| # | Finding (severity) | Verdict | What I saw |
|---|---|---|---|
| 1 | www / non-www split in Google (High) | TRUE (the Search Console part not verifiable by me) | `https://techand.ai/` → 308 → `https://www.techand.ai/`; `https://techand.ai/sitemap.xml` → 308 → www; all 45 canonicals name `https://www.techand.ai`; `/insights/your-current-pdf-invoices-…` links to three `https://techand.ai/…` URLs. The reason line "Google cannot index or follow these pages" contradicts it (B-6) |
| 2 | CDN no-store (High) | TRUE | 45/45: `cache-control: private, no-cache, no-store, max-age=0, must-revalidate` |
| 3 | Render-blocking (Medium) | TRUE | homepage `<head>`: 4 stylesheets, 1 script without async/defer |
| 4 | Low text-to-HTML (Medium) | TRUE | homepage 12,221 text characters in 219,161 (5.6%) |
| 5 | Image payload > 1 MB (Medium) | TRUE | `/dynamics-365-finance-and-operations-uae`: 18 Cloudinary images, HEAD sum 39,954,933 bytes vs the report's "40.0MB" |
| 6 | AI crawlers see a different version of 20 key pages (Medium, scored) | **FALSE** | GPTBot and a browser user agent receive byte-identical HTML (`/security` 116,953 bytes both, `/contact-us` 108,352, `/whatwedo/assess-envision` 134,062); the "after JavaScript" figures are DataForSEO's own counts (B-1) |
| 7 | Missing CSP (Low) | TRUE | no `content-security-policy` on any of 45 |
| 8 | No Google Business Profile (Low) | not verifiable | evidence "No listing for "Tech& Dubai"" |
| 9 | Orphan pages, 6 `/whatwedo/*` (High) | TRUE | none of the 45 pages has an `<a href>` to any of the six |
| 10 | Lorem ipsum on `/industries` (High) | TRUE | 10 case-insensitive matches of "lorem ipsum" in the HTML |
| 11 | Duplicate content, 7 pages (Medium) | TRUE | the six `/whatwedo/*` pages are 97.6–97.8% identical to `/whatwedo` and 98.9–100% to each other (word-sequence ratio, nav/footer removed) |
| 12 | Missing description `/power-platform-analytics-uae` (Medium) | TRUE | the only page of 45 without one |
| 13 | Brand repeated in title (Medium) | TRUE | `Power Platform & Analytics Services in UAE \| Tech& \| Tech&` |
| 14 | Hard to read, 24 (Low) | not verifiable | method not stated |
| 15 | Long URLs, 5 (Low, minor) | TRUE | exactly 5 URLs over 100 characters (101–134) |
| 16 | Shown in Google, never clicked, 11 (Low) | not verifiable | Search Console rows |
| 17 | Title < 30 characters, 12 (Low) | TRUE | exactly 12 live titles of 16–29 characters |
| 18 | URLs not SEO-friendly, 4 (Low) | partly true | `/whatwedo` and `/whywith-techand` join words without hyphens; `/cookies` is short, lowercase and descriptive; no reason is given per URL (B-14) |
| 19–20 | Internal URLs that redirect / links pointing to redirects (Low) | TRUE | the three bare-host links on `/insights/your-current-pdf-invoices-…`; the report names the targets and says "the crawl does not say which page holds each link" |
| 21 | Light content `/contact-us` 342 words (Low, minor) | not verifiable | 342 is DataForSEO's count; my whole-page count is 602 |
| 22 | Image missing alt, 45 (Low, minor) | partly true | 0 `<img>` without an `alt` attribute; every page has at least one `alt=""` (decorative), which the fix itself says to leave empty |
| 23 | CWV field data not available (Info) | TRUE | consistent with the CrUX answer |
| 24 | H1 = title, 2 (Info, minor) | TRUE | both insight pages: identical title and H1 |

Also checked: "What works" lists "All 11 search and AI crawlers tested (GPTBot, ClaudeBot, PerplexityBot, Googlebot and more) receive
the full page" — true, and in the same report as finding 6. "HTTP correctly redirects to HTTPS" — true, but `http://techand.ai/` →
`https://techand.ai/` → `https://www.techand.ai/` is two hops and is not reported (B-16). Without finding 6, the engine's own formula
gives AI Search Readiness 97 instead of 92 and the overall score stays 85 (84.8 → 85.3).

### Compared with 2026-10-15 (exec 595, no JavaScript)

Health 83 → 85; 30 → 24 findings. Not in today's report: the four findings raised on the two 308 redirect responses (compression,
canonical, Open Graph, Twitter card), "Articles with no outbound links", "Deprecated HTML tags" (`<u>`), the H1-entity render difference,
and "A large share of important pages is not indexed" (replaced by the host-split finding). New: "AI crawlers see a different version of
20 key page(s)" (the JavaScript-crawl pairing). The 2026-10-15 live check found 7 false of 30; today 1 false of 24.

### Where it is wrong

B-1, B-6, B-9, B-14, B-15, B-16 (below).

### Gap to the leader (criteria §1)

- 1.4 JavaScript: Sitebulb / Screaming Frog compare response vs render on every page with one parser on both sides; here 25 of 45 pages,
  and the 20 crawl-paired pages compare our parser with the provider's counts (B-1).
- 1.2 Indexability: the extra crawl reports now answer; the http → https → www chain is still not seen; hreflang silent (none declared).
- 1.3 Google's index view: 45 of 45 inspected, the host split explained with the action; the Pages report is not trended.
- 1.5 Core Web Vitals: CrUX has no data for this site; a technical audit runs no lab test (stated in "Not assessed").
- 1.6 Impact: measured page rows for every finding; GA4 key events asked for and honestly unused (none recorded).
- 1.9 Fixes: a zip of files; nothing for the findings that need code (caching, the doubled brand title, the lorem ipsum, the duplicates).
- 1.14 Accuracy: 1 false, 2 partly true of 24 by my check.

### Cost

Run's own figure **$0.0954** = crawl $0.0846 estimated ("the crawl was quoted $0.3600 for the 200 pages it asked for and crawled 47, so
it is priced at $0.0846 ($0.0018 a page) — ESTIMATED") + *Fetch GBP* 2 tasks $0.0108 measured; the ledger row (id 136) carries the same
figure and is `done`. Counted once by task id from the execution: crawl quote $0.36 + Fetch GBP $0.0108 = $0.3708. On 2026-10-15 the
first GBP lookup was missing from the run cost; today both GBP tasks are in `by_node`. No Claude. The balance cannot be split per run
(see "Cost" of §2 for the window reconciliation). Pre-run estimate shown to the customer: $0.11 (B-9).

---

## 2. Full SEO Report (run 14, exec 767)

### What came back

Headline: `health_score 70`, "Needs Improvement", `issue_counts {Critical 0, High 17, Medium 18, Low 18, Info 2}` = 55 findings, of which
6 come from the Claude content review (`scoring: false`); 45 pages analysed. Category scores: Crawlability 68, On-Page 86, Content 62,
Schema 74, Performance 65, Security 97, Images 90, Technical 93, AI Search Readiness 57, Authority 41. Word report
`B-fullreport-767.doc` (118,085 bytes), text `B-fullreport-767-doc.txt`. The customer reads:

> About the site: Tech& is a Microsoft Dynamics 365, Copilot and AI consultancy based in the UAE. It serves GCC enterprises across
> banking, public sector, hospitality, trading, retail and other sectors.
> The main thing holding this site back: The site makes claims of measurable business impact and Microsoft partnership but shows no proof,
> such as case studies, named experts, reviews or verifiable credentials, and its service pages are generic.
>
> Key Numbers: You vs Competitors — Keywords ranking (top 30) — DataForSEO's database 0 vs 447.5 · Keywords in top 10 — DataForSEO's
> database 0 vs 259 · Queries in Google's top 10 — Search Console, measured (3 for your own name) 20 vs not measured for competitors ·
> Estimated monthly organic visits — DataForSEO's estimate 0 vs 13,898 · Referring domains 19 vs 3,169 · Mobile PageSpeed 91 vs 38.5 ·
> Domain age (years) 0.7 vs 16.4

Top issues: host split · CDN no-store · "Far fewer top-10 rankings than competitors" · "Organic traffic is under 10% of competitors" ·
"Very young domain …" · "Keyword gap: searches competitors win and you do not" · "Far fewer referring domains than competitors".

**Where the sections' numbers come from:**

- *Competitor benchmark* — "Competitors: provided by user". Table: techand.ai 0 keywords / 0 top 10 / 0 visits / 19 referring domains /
  PageSpeed 91 / 0.7 years; cleartax.com **300 / 196** / 27,548 / 2,691 / 48 / 26.8; azentio.com 8 / 7 / 248 / 3,647 / 29 / 5.9. The
  run's *Competitor Analysis* rows hold cleartax.com 886 / 511 and azentio.com 9 / 7, which give the Key Numbers medians 447.5 / 259 (B-17).
  *Find Competitors* and *Fallback SERP* did not run (named competitors; on 2026-10-15 both ran and were discarded).
- *Domain ages* — the cache path **was exercised**: *Age Lookup Plan* `{skip: true}`, *Domain Ages* `whois_requests: 0`, all three ages
  "whois, stored 2026-10-11" (`seo_cache` rows 8–10); the lineage row says "looked up 2026-10-11 and cached". The dates match my RDAP/WHOIS
  check of 2026-10-15 (2026-02-19, 2000-01-01, 2020-11-19).
- *Keywords by search intent* — "Keyword research based on your services: e invoicing software uae, erp implementation dubai, peppol uae"
  (the site's configured keywords; on 2026-10-15 the seeds were three card headings). *Analyze Keywords* refused 100 keywords with a
  reason each (off topic 42, navigational 28, government 21, too broad 6, portal 2, other brand 1: "fta login", "emirates id", "vat",
  "corporate tax uae", "trade license", "trn", "mofa attestation dubai", "attestation", "icv certificate" …). What was delivered: easy wins
  "intelligent software solutions" 1,600, "erp software" 1,000, "erp software in uae" 480, "uae document attestation" 480, "top facilities
  management companies uae" 390, "finance jobs in uae" 390, "hrms software in dubai" 390, "finance manager jobs in uae" 390, "uae
  businesses" 390, "facility management companies in uae" 390; keyword gap "uae document attestation", "dubai business tax", "what is e
  invoicing in uae", "how to attest documents from mofa", "mofa document attestation" (B-3). The section also says: "DataForSEO's ranking
  database holds no top-30 ranking for your site …, but Google's own data (Search Console) shows 50 queries at an average position in the
  top 30 …, 20 of them in the top 10 (3 for your own name)".
- *Authority & backlinks* — 19 referring domains, spam score 63; link opportunities: "1 of 25 domains are worth a pitch. Top:
  uae-asp.ae. 24 are left out (e.g. mof.gov.ae — a government site …; lounge.ai — off topic …; websitepagechecker.website — a spam score
  of 55 …)".
- *Performance* — lab mobile techand.ai 91 (LCP 3.30 s, CLS 0, TBT 120 ms), cleartax.com 48, azentio.com 29; field data none.
- *AI search visibility* — SERP reads "tech&" (brand), "site:techand.ai", "best e invoicing software uae" (category, from the configured
  keywords), "intelligent software solutions" ("top keyword"); ChatGPT "who" answer describes Tech& correctly; ChatGPT and Perplexity
  shortlists for "best e invoicing software uae" name other vendors (ChatGPT: e-numerak.com, getjam.ae, invoiceflow.ae, complyance.io,
  phenixpos.ae, mancalatech.com …; Perplexity: avalara.com, cleartax.com, zoho.com, wafeq.com, edicomgroup.com, deloitte.com …).
- *Content quality & E-E-A-T* — Claude Sonnet review, 6 findings `scoring: false` (case studies, "What We Do pages generic", Microsoft
  partner "shown only as an image, with no verification", no pricing, no leadership, mega-menu text). The prompt text contained 0 hex
  entities (on 2026-10-15 an undecoded `&#x27;` produced a false review finding).
- *Lineage* (16a): health score "modelled, not measured", Search Console measured (5,358 impressions), keyword data "20 keywords in
  section 4 · estimated", backlinks "reported by the source", CrUX "no field data", Lighthouse "3 site(s), one simulated mobile load
  each", domain age "looked up 2026-10-11 and cached". Each row matches what the run did.

**Diff, full vs full** (`B-full-767-diff.json`): previous `aud_mva8x2exzvm` (full, 2026-10-16 00:45, health 70, 51 findings) →
"5 fixed · 1 new · 46 still open", `score_delta 0`. "Fixed": "AI crawlers see a different version of 1 key page(s)", "No compression
(gzip/brotli)", "Missing canonical tag", "Missing Open Graph tags", "Deprecated HTML tags" (B-5). "New": "Site does not rank at the top for
its own brand name" — the data row carries `one_reading: true`; the Word report prints it as "new High" with no such note (B-2).

**URL Inspection**: 45 of 45, 0 failed; the same 30 indexed / 15 not as the audit 8 minutes earlier (on 2026-10-15 the two reports
differed for 5 pages).

**Stored rows**: `seo_audits` id 27 (`aud_mvcljfaglbp`, health 70, `findings 47`, high 15 / medium 15 / low 17) and 47
`seo_audit_findings` rows (High 15, Medium 15, Low 17) — the row and its findings agree (on 2026-10-15: 17/22/19 vs 14/19/18). The report
header says 17 / 18 / 18 / 2 and "7 unscored findings are (6 from the AI review) counted here and are not part of the score" (B-17).

### What the customer sees in the app

`reports` row `9f125e5a-876f-436e-9e31-d7ec5252a040`: stage `full_report`, status `completed`, title "Full SEO report · techand.ai",
summary `{high 17, grade Needs Improvement, medium 18, critical 0, scoreDelta 0, healthScore 70}`, `scheduled: true` (toolkit artefact),
payload with `top_issues`, `audit_diff`, `run_ledger`, `run_cost_estimate_usd 0.63`, the Word file and the PDF. The app's technical page
code (`app/server/src/services/data.ts` `previousOfType`, line 732) picks the previous audit of the same report type; not rendered in a
browser by me (executor D drives the UI).

### Findings checked against the live site (full-report-only items)

| Finding (severity) | Verdict | What I saw |
|---|---|---|
| Far fewer top-10 rankings than competitors (High) | TRUE as worded | the evidence now gives both sources: "DataForSEO's ranking database … 0 vs competitor median 259 …; Search Console (measured …): 20 queries at an average position in Google's top 10 … e.g. "techand" #4.5 …" |
| Organic traffic under 10% of competitors (High) | TRUE per its sources | DataForSEO estimate 0 vs 13,898, with Search Console's 30 clicks printed beside it |
| Very young domain (High) | TRUE | registration 2026-02-19 (cached) |
| Keyword gap (High) | **misleading** | 4 of 5 are document attestation / business tax searches the same run's gate refuses in other forms (B-3) |
| No case studies, client names or testimonials (High, review) | TRUE | no page of 45 contains "case stud" or "testimonial"; `/whywith-techand` says "Trusted by enterprise customers" with no names |
| What We Do pages generic / repeated (High, review) | TRUE | 97–100% identical text (see audit finding 11) |
| ChatGPT recommends other providers (High) | TRUE as data; fix wrong | the providers ChatGPT named are e-invoicing vendors, called "directories and review sites" in the fix (B-7) |
| Perplexity recommends other providers (High) | TRUE | as answered |
| Site does not rank at the top for its own brand name (High) | **FALSE as a High** | one SERP read of "tech&" (results: instagram.com/techandtrendsofficial, techand.it, facebook…); the same report's Search Console: "techand" #4.5, "tech & ai" #2.7 (B-2) |
| Far fewer pages indexed than crawled, "site: estimate 8 vs 47" (High) | **misleading** | the same report: URL Inspection 30 of 45 indexed under www, the host split, 45 pages analysed (B-4) |
| Few sameAs profiles (Medium) | TRUE | one LinkedIn URL in the Organization schema |
| Contact form not in the server-rendered HTML (Medium) | TRUE | `/contact-us` raw HTML: 0 `<form>` |
| Images without width and height (Medium) | TRUE | homepage: 8 of 38 `<img>` lack width+height |
| Microsoft partner status shown only as an image (Medium, review) | TRUE | `alt="Microsoft Partner"` twice on the homepage, no link to a partner profile |
| No pricing, engagement models or timelines (Medium, review) | partly FALSE | `/dynamics-365-cloud-migration-uae` "Pricing in UAE … Migration Cost Factors", `/dynamics-365-finance-and-operations-uae` "Pricing in UAE … Cost Estimation", `/ai-agents-copilot-studio-uae` "Pricing: What Drives the Cost?" — cost factors, no figures (B-10) |
| No leadership or team information (Medium, review) | TRUE | no team / about page among the 45 sitemap URLs; the evidence itself says "The About page itself was not provided" |
| AI Overviews do not cite you (Medium) | TRUE as data | one of the two searches is "intelligent software solutions", another company's name (B-3) |
| Articles have no named human author (High) | TRUE, under-counted | "1 of 2 sampled"; live, 11 of 12 articles' `author` is "Tech& Team" / "Tech& Technology Team", one names a person (B-18) |
| Structured data with errors, 26 of 45 (Medium) | not verifiable | no property named |
| Service pages have no Service schema (High) | TRUE | no page of 45 carries `"@type":"Service"` |
| Homepage H1 does not name the business (Low) | TRUE | "Value Driven Innovation through Automation" |
| Phone number in a link but not shown (Low) | TRUE | `href="tel:8006427676"` with no visible number |
| No speculation rules (Low) | TRUE | 0 of 45 |
| No freshness signal on articles (Medium) | TRUE | 12 of 12 articles: `dateModified` = `datePublished` |
| Few informational rankings (Low) | TRUE as worded | both sources printed |
| Low-difficulty keywords you can target now (Low) | **misleading** | "intelligent software solutions", "uae document attestation", "top facilities management companies uae" (B-3) |

The technical findings repeat with the audit's verdicts, except "AI crawlers see a different version …" which a no-JavaScript full report
does not raise: its "What works" says "Every key page checked (5) serves its title, heading, canonical, robots rule, links and text in the
first response, so crawlers that do not run JavaScript see the same page as Google does", 8 minutes after the audit told the same customer
the opposite for 20 pages (B-1).

### Compared with 2026-10-15 (exec 614)

Health 70 → 70; 61 → 55 findings; High 17 → 17. "The site does not rank in Google's top 10 for any keyword" is gone; "Far fewer top-10
rankings than competitors" prints both sources. The keyword seeds changed from "ai & automation / assess & envision / build & implement"
to the configured keywords; "ai mode", "blackbox ai", "face swap ai", "vat", "trn", "trade license" no longer appear; attestation, tax,
job and facilities-management searches do. The AI question changed from "best ai in cloud company United Arab Emirates" to "best e
invoicing software uae". The brand finding: 2026-10-14 "not in top 20", 2026-10-15 position 1 (listed as "fixed"), today "not in top 20"
again (listed as "new").

### Where it is wrong

B-2, B-3, B-4, B-5, B-6, B-7, B-8, B-10, B-17, B-18.

### Gap to the leader (criteria §1 and §3)

- Keyword gap: Semrush / Ahrefs start from the real overlap with the competitors' rankings; here the gap is five cleartax.com rankings,
  four of them outside what Tech& sells, filtered by a gate that refuses "mofa attestation dubai" but keeps "mofa document attestation".
- Narrative (3.2): the summary is grounded; two High lines (brand, index estimate) rest on one SERP read each while the measured Search
  Console data in the same document says otherwise.
- Lineage (3.11): present and matching on every row checked.
- Formats (3.6): PDF, Word, app payload; no CSV of findings; "Prepared by Dev SEO" on the cover.

### Cost

Run's own figure **$0.377** DataForSEO + **$0.0592** Claude; ledger row id 150 the same (`dfs_usd 0.377`, `ai_usd 0.0592`, `done`).
Counted once by task id from the execution: $0.4459 with the crawl at its $0.09 quote (Ranked Keywords $0.073, Backlink Summary $0.0721,
Ask LLMs $0.0647, Keyword Ideas $0.048, Domain Overview $0.0362, AI SERP $0.026, Backlink Gap $0.0251, Fetch GBP $0.0108, crawl $0.09);
with the crawl at the engine's $0.0211 estimate, **$0.377 — equal to the engine's figure**. Claude: n8n `tokenUsage` 11,276 in / 2,258 out
= $0.0451; the engine reports $0.0592 (B-8). Pre-run estimate shown: $0.63.

**Window reconciliation (both my runs and executor A's).** The account fell **$1.099915** between 15:58:39 and 16:14:47. The ledger
rows of every run that spent in that window (739 $0.0954, 749–751 $0.0721, 760 $0.0221, 761–762 $0.0481, 764 $0.2754, 765 $0.0241, 767
$0.377, 770 $0.1615) sum to **$1.0757**; the difference, $0.0242 (2.2%), is within what run 771 (a page run still `reserved` at 16:14)
could have spent. So the JavaScript crawl priced at $0.0846 (not its $0.36 quote) is consistent with the account, but it cannot be
isolated.

---

## 3. Pre-release check (execs 740–744)

**What it is.** `POST /webhook/seo-prerelease` (workflow `SEOagentPreRel1`), synchronous, reads only. Per page 8 checks (answers 200, no
redirect, no noindex, robots.txt allows, one canonical, title, H1, description). New fields (`v5/code/Prerelease_Validate.js`): `fail_on`
(`any` default, or `low` / `medium` / `high` / `critical`: failures below it come back as `below_threshold`) and `expected` (strings
`"/path"` or `"/path:check"`, or `{path|url, check?, reason?}`; matching failures come back as `expected_changes`, unmatched entries as
`expected_unused`).

**a — 10 live key pages** (same body as 2026-10-15, `base_url https://www.techand.ai`, `live_host www.techand.ai`): `verdict "pass"`,
`exit_code 0`, "10 of 10 page(s) read, 79 check(s) passed, 1 warning(s), 3 not checked", `staging: false`; the warning:
`/power-platform-analytics-uae` "no meta description" (low). The "not checked" reasons now read "this check reads only the pages it is
given (by design, it asks Google nothing): indexing, the canonical Google picked and the rich results are checked by the daily page watch
and the monthly audit" (on 2026-10-15 they spoke of "a staging URL" on this production check). `/power-platform-analytics-uae` passes
"title" with `Power Platform & Analytics Services in UAE | Tech& | Tech&`.

**b — redirect + 404 + no description** (`urls`, `staging: false`): `verdict "fail"`, `exit_code 1`, "3 check(s) failed on 2 of 3
page(s)": the bare-host URL "answers 308 and redirects to https://www.techand.ai/insights/the-cost-of-non-compliance-…" (page_answers and
no_redirect, critical); `/this-page-does-not-exist-rr1017` "answers 404" (critical); the missing description a low warning.

**c — the same three URLs with `fail_on: "high"` and `expected`** `[{path:"/this-page-does-not-exist-rr1017", check:"page_answers",
reason:"page removed in this release"}, {url:"https://techand.ai/insights/the-cost-of-non-compliance-…", reason:"bare host now redirects
to www"}, "/pricing:title"]`: `verdict "pass"`, `exit_code 0`, "3 of 3 page(s) read, 8 check(s) passed, 1 warning(s), 3 expected
change(s) accepted, 3 not checked"; `expected_changes` lists the three failures each with its `expected_reason`; `expected_unused`:
`{path "/pricing", check "title", note "matched no failure: the change did not happen on this page, or the entry is stale"}`. Entries are
matched by path, whatever the host.

**d — `fail_on: "low"`, expected only the 404**: `verdict "fail"`, `exit_code 1`, the two redirect failures listed, the 404 accepted;
the missing description is still only a warning, `below_threshold: []` (B-13).

**e — `fail_on: "severe"`, `expected: ["/:headline"]`**: HTTP 400, `verdict "error"`, `exit_code 2`, `errors`: "fail_on must be one of
any, low, medium, high, critical (given "severe")", "expected: "headline" is not a check (page_answers, no_redirect, indexable,
robots_allows, canonical, title, h1, description)".

Every answer `writes: "none"`. Saved: `B-prerelease-3a-pass.json`, `-3b-fail.json`, `-3c-expected-failon-high.json`, `-3d-failon-low.json`,
`-3e-bad-request.json`. Not exercised: a `below_threshold` failure (techand.ai has no live page with a missing title, H1 or canonical, the
only high-severity checks) and a staging host.

**Where it is right**: a redirect and a 404 fail with exit 1; an intentional change can be declared and is echoed back with its reason; a
stale entry is reported, not silently ignored; bad input is a 400 with exit 2 and every error listed; production wording on a production
check.

**Gap to the leader** (1.8, Lumar Protect 350+ tests that can block a deploy; Sitebulb Release Check): 8 checks per page; the threshold
and the planned-change list now exist; a doubled brand in the title, lorem ipsum and a missing description cannot fail a release, and
nothing compares the candidate with the current live page.

**Cost**: $0; no ledger row.

---

## 4. The publish check outside a content run (execs 745–748, 752)

**What it is** (`app/API.md` "Is this page publishable?", `v5/code/PubCheck_Parse_Brief.js`, `build_api.py` lines 553–595): `POST
/webhook/seo-publish-check`, synchronous, runs the content run's own *Content QA* + *Originality Check* code over **Markdown the caller
sends** (`markdown` and `keyword` required). It takes no URL and fetches nothing, so "a URL that 404s" cannot be checked as a URL; I sent
(1) a live page converted to Markdown, (2) the same with a link to a 404 URL, (3) a URL without Markdown, (4) the 404 page's own text.

**Input.** `https://www.techand.ai/insights/top-peppol-e-invoicing-software-features-every-uae-cfo-must-look-for` fetched with curl and
converted by my own script (title, meta description, slug lines, the live H1, the article's headings / paragraphs / lists; tables were
flattened into paragraphs and the page's H3 section headings kept as `###`), 2,444 words; `keyword "peppol e-invoicing software uae"`,
`domain techand.ai`, `country`, `currency AED`, `internal_links` = the 45 sitemap URLs. No terms, competitors or sources sent.

**PC-1** (0.26 s): `ok true, publishable false, verdict "not_publishable", exit_code 1`, label "did not pass the quality check — not ready
to publish", summary "Not publishable: 5 reason(s) — the content score is 69 of 100 (80 is the bar)". Reasons: the score, "Primary
keyword missing from the meta title", "… from H1", "… not in the first 100 words", "Primary keyword used only 0 time(s)". Warnings also
"Only 1 H2 sections", "Quick answer block missing", "The call to action should be the last section", "Comparison table missing" (an
artefact of my conversion: the live page has 3 tables), "Contains a guarantee claim — please verify" (B-11), "No internal links to existing
pages on the site", "Hard to read (Flesch 20.7 …)", "16 sentences longer than 28 words", "Too generic (0.37 specifics per 100 words)".
`score_breakdown {structure 10, coverage 25, readability 4, specificity 5, clean_language 10, length 15}` (B-12). Auto-fixes: "Marked 1
unsourced amount(s) … as [Confirm: …]" (`[Confirm: AED 50 million]` in the ASP-deadline sentence; no source text was sent) and "Generated
Article + Person + BreadcrumbList schema". `not_checked` lists six items each with its reason (editor review, figures against sources,
topic coverage, originality, length, author box). `writes "none"`, `cost_usd 0`.

**PC-5** (the keyword the page literally uses, "peppol e-invoicing software"): score 71, still `not_publishable`; the remaining keyword
reason is "Primary keyword not in the first 100 words". The keyword rules match the exact phrase: in PC-1 "used only 0 time(s)" on a page
whose title is "Peppol E-Invoicing Software Features UAE CFOs Need".

**PC-2** (link to `https://www.techand.ai/this-page-does-not-exist-rr1017` added): auto-fix "Removed 1 link(s) to pages that do not
exist on techand.ai: https://www.techand.ai/this-page-does-not-exist-rr1017" — decided from the `internal_links` list, not by fetching;
the real link that was added beside it stayed, and "No internal links" disappeared (score 71).

**PC-3** (`{url, keyword, domain}`): 400, exit 2, "markdown is required: the page as Markdown (optional "Title:", "Meta Description:" and
"Slug:" lines above the H1)". **PC-4** (the 404 page's text, 30 words): 400, exit 2, "markdown has fewer than 50 words: there is no page
to judge".

**Where it is right**: free, sub-second, no write; the verdict says exactly which half of the gate ran and lists what it could not judge
with the reason; a link to a page outside the declared site list is removed and named; bad bodies are 400 / exit 2.

**Gap to the leader** (Surfer / Clearscope content editors): they score a URL or a draft against the live SERP's terms; here coverage,
originality and length are judged only when the caller sends terms, competitor text and a target, and the keyword checks are exact-phrase.

**Cost**: $0.

---

## Findings

**B-1 — High. The new response-vs-render comparison reports 20 false "AI crawlers see a different version" pages.** Exec 739
*Render Diff*: for the 20 pages "paired with the JavaScript crawl", the "first response" side is our parser's count of every `<a>` and every
word in the raw HTML, and the "after JavaScript" side is the crawl's `internal_links_count + external_links_count` and
`content.plain_text_word_count` (`v5/code/Render_Diff.js` lines 127–128), while the method text printed to the customer says "Title, main
heading, canonical link, robots meta, links and text length are read from both with the same parser". The raw side is larger on all 20
(e.g. `/security` 52 vs 29 links, 694 vs 439 words) — the opposite of what JavaScript-only content would produce. Live: GPTBot and a browser
receive byte-identical HTML (`/security` 116,953 bytes; my count 57 `<a href>`, 698 words), and the 5 pages the render service did read
agree on every figure. Delivered as a scored Medium (6th, impact 10.6) with "Server-render at least the title, the main heading, the
opening answer and the in-content links" for a server-rendered site, beside "All 11 search and AI crawlers … receive the full page" in the
same report, and contradicted by the full report 8 minutes later ("crawlers that do not run JavaScript see the same page as Google does").
Correct output: compare like with like (count the crawl's rendered HTML with the same parser, or compare only fields both readings define
the same way) and raise nothing here.

**B-2 — High. "Site does not rank at the top for its own brand name" rests on one ambiguous SERP read and contradicts the report's own
Search Console data.** Exec 767 *AI SERP* for "tech&": organic results instagram.com/techandtrendsofficial, technewsworld.com,
facebook.com, techand.it … no techand.ai in 20 → finding (High, AI Search Readiness): "Search "tech&": your position not in top 20". The
same report: "Google's own data (Search Console …): 20 queries in the top 10 (3 for your own name)", e.g. "techand" #4.5, "tech & ai"
#2.7. The finding flips from report to report (2026-10-14 not in top 20; 2026-10-15 position 1, listed "fixed"; today listed "new"); the
diff row carries `one_reading: true`, the Word report does not say so. Correct output: judge the brand from Search Console's brand queries
(and the domain-name query), and never raise a High from one read of an ambiguous query.

**B-3 — High. The full report still offers government services, job searches, another company's name and other industries as keyword
targets, and the gate that refuses them is inconsistent.** Exec 767 `site_keywords` (`B-full-767-site_keywords.json`): keyword gap (a High
finding: "Create or improve a dedicated page for the highest-volume, lowest-difficulty gap keywords first") = "uae document attestation",
"dubai business tax", "what is e invoicing in uae", "how to attest documents from mofa", "mofa document attestation"; easy wins include
"intelligent software solutions" (the SERP's AI Overview cites iss-mea.com, a company of that name), "uae document attestation", "top
facilities management companies uae", "finance jobs in uae", "finance manager jobs in uae", "facility management companies in uae"; the
same run refused "mofa attestation dubai" (government) and "attestation" (off topic). "intelligent software solutions" also became the
fourth AI query, so "Google shows AI Overviews for your key searches and does not cite you" names it as one of "your key searches". Seeds
are the configured keywords and 100 keywords were refused, so the 2026-10-15 lists ("ai mode", "face swap ai", "vat", "trn") are gone.
Correct output: apply the same gate to the gap, the easy wins and the AI query; keep only searches about what Tech& sells (Dynamics 365,
ERP, e-invoicing software, Copilot).

**B-4 — Medium. "Far fewer pages indexed than crawled" (High) contradicts the same report's URL Inspection.** Exec 767: "Google site:
estimate 8 vs 47 crawlable pages … confirm in Search Console" while the report's own URL Inspection says 30 of 45 indexed (and explains the
other 15 as the host split), and its AI section prints "8 URLs vs 45 pages crawled". The audit prints "Pages found by crawling 47" under
"45 pages crawled". Correct output: no High from a `site:` estimate when the URL Inspection of every page is in the same run.

**B-5 — Medium. The full report's diff tells the customer that five problems were fixed when only the engine changed.** Exec 767 diff vs
`aud_mva8x2exzvm` (2026-10-16): "5 fixed · 1 new · 46 still open" — "No compression", "Missing canonical tag", "Missing Open Graph tags",
"Deprecated HTML tags", "AI crawlers see a different version of 1 key page(s)". On 2026-10-15 (execs 595, 614) the same titles were
raised on the two 308 redirect responses, on `<u>` and on an undecoded `&#x27;`, and I verified then that every www page already had
compression, a canonical, Open Graph and a Twitter card; today's live fetch shows the same (45/45 `br`, canonical, `og:title`,
`twitter:card`; `<u>` still on one page). I did not open the 2026-10-16 report's evidence. Nothing on the site changed for these items. Correct output: findings that disappear because a check changed are "no longer
reported (our check changed)", not "fixed".

**B-6 — Medium. The first item's reason contradicts the finding.** Execs 739 and 767 `priority_first` / "Why here": "… is first because
Google cannot index or follow these pages, 15 of 45 crawled pages …" for the host-split finding whose own text says Google shows and ranks
these pages under `https://techand.ai` and "Requesting indexing page by page does not help". Printed in "Fix These First" of both
reports. Correct output: a reason that matches the finding ("Google splits these pages between two addresses").

**B-7 — Medium. The ChatGPT fix tells the customer to get listed on competitors' sites.** Exec 767 finding "ChatGPT recommends other
providers, not you", fix: "Get listed where AI answers draw their sources: the directories and review sites cited (e-numerak.com,
getjam.ae, invoiceflow.ae, complyance.io)". ChatGPT's `cited_sources` are the vendors' own homepages (E-Numerak, jam. by Vostok,
InvoiceFlow, Complyance — e-invoicing products). Correct output: name directories / lists that cite vendors (as the Perplexity fix does:
mof.gov.ae's list, azdan.com, uaeasp.ae) or say ChatGPT cited only the vendors themselves.

**B-8 — Low. The Content Reviewer's Claude cost is over-stated by 31%.** Exec 767: n8n `tokenUsage` 11,276 in / 2,258 out = $0.0451. The
engine: $0.0592 = count_tokens "10392 prompt and 2208 answer token(s)" + "1638 thinking token(s) … modelled from the medium effort budget
($0.0163)". n8n's 2,258 output tokens leave at most 50 for thinking. (On 2026-10-15 the same node was under-stated: the answer counted as
5 tokens.)

**B-9 — Low. The pre-run cost estimate ignores the JavaScript crawl and the page count.** Exec 739 `run_cost_estimate_usd 0.11` (app
`app/shared/src/cost.ts` line 71: crawl $0.09 whatever the options; no reference to `crawlJs` in `cost.ts` or the engine's estimate). The JavaScript crawl
was quoted $0.36 for 200 pages ($0.0018 a page, 4× the plain crawl). On techand.ai the run cost $0.0954 because only 47 pages exist; on a
site with 200 pages the shown estimate would be about a third of the cost.

**B-10 — Low. The content review says "No pricing, engagement models or timelines" where three service pages have pricing sections.**
Exec 767 (Medium, not scored): "Services … are listed without cost ranges or durations". Live: "Pricing in UAE … Migration Cost Factors"
(`/dynamics-365-cloud-migration-uae`), "Pricing in UAE … Cost Estimation" (`/dynamics-365-finance-and-operations-uae`), "Pricing: What
Drives the Cost?" (`/ai-agents-copilot-studio-uae`). They give cost factors, no figures; the fix's "Add indicative ranges or sizing
factors" is half done already. Correct output: "pricing sections list cost factors but no ranges".

**B-11 — Low. The publish check flags "Contains a guarantee claim" on sentences that deny a guarantee.** Exec 745 warning; the page says
"None of these features should be treated as an automatic guarantee of regulatory compliance" and "does not by itself guarantee
compliance". Rule: `/guarantee/i.test(md) && !prev.business` (`v5/code/Content_QA.js` line 479).

**B-12 — Low. The publish check's content score includes 25 points for coverage it did not measure.** Exec 745 `score_breakdown.coverage
25` while `not_checked` says "no terms were sent …, so topic coverage was not measured and its 25 points were not at stake"; the summary
says "the content score is 69 of 100" with no note that a quarter of it was granted, not measured.

**B-13 — Low. `fail_on: "low"` cannot make a missing meta description block a release.** Exec 743: with `fail_on "low"` the missing
description stays in `warnings`, not `failures` or `below_threshold`; the description check only ever returns `warn`
(`v5/code/Prerelease_Verdict.js`, the `add('description', … 'warn' …)` line), so no setting turns it into a failure.

**B-14 — Low. "URLs are not SEO-friendly" lists `/cookies` and gives no reason per URL.** Exec 739 finding 18: `/cookies`, `/whatwedo`,
`/whywith-techand`, `/insights/your-current-pdf-invoices-…`; why "Dynamic parameters, long paths or non-descriptive URLs …". `/cookies`
has none of those; the long insight URL is already in "Long or messy URLs".

**B-15 — Low. The fix pack links the duplicate pages it is told to consolidate, with truncated anchors.** `B-fixpack-739-internal-links.csv`:
8 of 12 rows add links to the six orphan `/whatwedo/*` pages, while finding 11 says they are near-identical ("Consolidate duplicates with a
canonical tag or a 301 redirect, or make each page substantively different"); two anchors are cut mid-word at 70 characters ("Upgrading
Your ERP for UAE Peppol PINT-AE Compliance: A Technical Inte").

**B-16 — Low. The two-hop redirect from `http://techand.ai/` is not reported.** Live: `http://techand.ai/` → 308 `https://techand.ai/` →
308 `https://www.techand.ai/`. The redirect-chain report answered `20000 Ok.` with 0 items (the crawl starts on https); "What works" says
"HTTP correctly redirects to HTTPS".

**B-17 — Medium. The same competitor figure differs inside the full report.** Exec 767 Word report: the Competitor Benchmark table shows
cleartax.com 300 keywords / 196 top 10 and azentio.com 8 / 7 (whose medians are 154 / 101.5), while the Key Numbers and the High finding
"Far fewer top-10 rankings than competitors" use medians 447.5 / 259, computed from *Competitor Analysis* rows cleartax.com 886 / 511 and
azentio.com 9 / 7 that the table does not show. (The 2026-10-15 report had the same pattern: table 300 / 193, key numbers 472.5 / 266.)
Also: the header line reads "7 unscored findings are (6 from the AI review) counted here and are not part of the score", and the app's
report summary (High 17, Medium 18) differs from the stored rows a list is built from (High 15, Medium 15). Correct output: one source per
figure, the same in the table and the headline.

**B-18 — Low. "Articles have no named human author" is measured on 2 of 12 articles.** Exec 767: "1 of 2 sampled articles". Live: 11 of 12
`/insights/*` articles carry `author: {"@type":"Person","name":"Tech& Team"}` or "Tech& Technology Team"; one names a person. The finding
is right; its count understates it.

---

## What could not be exercised and why

- GA4 key events actually re-ordering the fix list: GA4 recorded 0 organic key events for techand.ai in 28 days.
- The hreflang checks: no techand.ai page declares hreflang (silent path only).
- A client-rendered site: techand.ai is server-rendered, so neither the render service nor the crawl pairing could show real JS-only content.
- Search Console / URL Inspection states themselves: I have no Search Console access; taken as the API returned them.
- A pre-release `below_threshold` result and a staging host: no live techand.ai page fails a high-severity check; no staging host exists.
- The publish check on a URL: the endpoint takes Markdown only (by its contract); the app's `/api/v1/publish-check` with an API key is
  executor D's.
- The PDF text: not extracted; it is rendered from the same HTML as the Word file, whose text I checked.
- The app's technical page in a browser: read from code only (executor D drives the UI).
- What a later no-JavaScript technical audit (executor C's Audit Scheduler) does with today's 20-page JavaScript finding in its diff:
  `seo_audits` does not record `crawl_js`; to be read in C's run.

## State left behind

- `seo_audits`: id 26 (`aud_mvcl9in6c1y`, site_audit, 85, JavaScript crawl) and id 27 (`aud_mvcljfaglbp`, full, 70).
- `seo_audit_findings`: 22 rows (739) + 47 rows (767).
- `seo_run_ledger`: id 136 (739) and id 150 (767), both `done`.
- App `reports`: `6b9f795f-…` (site_audit) and `9f125e5a-…` (full_report), both `completed`, `scheduled: true`, each with a Word file and a PDF.
- `seo_cache`: the full report read the age cache (rows 8–10) and wrote no new age row.
- Pre-release and publish checks wrote nothing (`writes: "none"`; neither workflow has a write node). No e-mail (`emailed_to: null`),
  nothing submitted to Bing or IndexNow, no WordPress push.
