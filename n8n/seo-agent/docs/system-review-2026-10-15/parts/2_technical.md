# Part 2 — Technical audit, full SEO report and pre-release check (executor B)

Re-rating of 2026-10-15, site **techand.ai** (United Arab Emirates). Executor B ran three things: a 200-page technical audit and a
200-page Full SEO Report through the API front door exactly as the app sends them, then the synchronous pre-release check twice.
Executor A ran keyword / ladder / content runs in the same window (executions 596–616 that are not listed below are A's).

| | |
|---|---|
| UTC start / end | 19:01:39 (balance probe) → 19:23:03 (balance probe); first request 19:01:52, last execution finished 19:22:52 |
| DataForSEO balance | **$13.707979** at 19:01:39 ("B start") · $13.366549 at 19:07:38 (after run 1) · **$12.735491** at 19:23:03 ("B end"). Moved **−$0.972488** in the window; executor A's runs 598–616 were spending in the same window, so the movement cannot be split per run (see "Cost" in each section). `today_total` went 0.084 → 1.056488, far under the $5.50 stop line. |
| My executions | 594 → **595** (technical audit) · 613 → **614** (Full SEO Report) · **617**, **618** (pre-release check) |
| Artefacts | `/Users/abdul.muqadim/n8n_devaicon/n8n/seo-agent/docs/system-review-2026-10-15/files/B-*` (34 files, git-ignored) and `report-2b58928c-….json`, `report-3fac33ae-….json`, `exec-595.json`, `exec-614.json`, `exec-617.json`, `exec-618.json` |

Bodies sent (minus the callback URL, which the toolkit adds and never prints):

- Run 1: `{"domain":"techand.ai","country":"United Arab Emirates","email":"","business":"","customers":"","mode":"audit","keyword":"","report_type":"Site Audit","crawl_pages":200,"crawl_js":false,"competitors":["cleartax.com","azentio.com"],"label":"rr1015-B-audit"}`.
  The `label` field is not something the app sends; *Normalize Input* of 595 shows it was ignored (no `label` key in its output;
  `audit_level: site_audit`, `crawl_max_pages: 200`, `crawl_js: false`, competitors as sent). Shape checked against
  `harness/fixtures_platform.json` case "audit technical with site competitors" and `app/shared/src/payload.ts` (`case 'audit'`).
- Run 2: the same without `label`, `"report_type":"Full SEO Report"`.
- Pre-release: see §3.

## Runs

| # | What | Request id | Executions (API → run) | Start–end UTC | Duration | DataForSEO: run's own figure · ledger row | Claude (`RR claude`) | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | Technical audit, 200 pages, no JS | 594 | 594 → 595 | 19:01:52.8 – 19:07:29.4 | 5 min 33 s (run) | **$0.0265** (`$0.0054` measured + `$0.0211` crawl estimated) · ledger id 79: `dfs_usd 0.0265`, `dfs_est_usd 0.1125`, `settled_usd 0`, `measured_usd 0.0054`, `estimated_usd 0.0211`, status `done` | none (0 calls) | success; callback at 19:07:23.9; health **83 "Good"**, 30 findings |
| 2 | Full SEO Report, 200 pages, no JS | 613 | 613 → 614 | 19:07:45.7 – 19:15:37.5 | 7 min 51 s (run) | **$0.3936** (`$0.3725` measured + `$0.0211` crawl estimated) · ledger id 87: `dfs_usd 0.3936`, `dfs_est_usd 0.5714`, `settled_usd 0.037`, `measured_usd 0.3932`, `estimated_usd 0.0374`, status `done` | 1 call, Sonnet 5.5, **MEASURED** 11,190 in / 2,456 out = **$0.0469** (engine says $0.0370) | success; callback at 19:15:29.7; health **70 "Needs Improvement"**, 61 findings |
| 3a | Pre-release check, 10 live key pages | 617 | 617 | 19:22:36.0 – 19:22:40.6 | 4.6 s | $0 (no paid call; no ledger row) | none | 200, `verdict: pass`, `exit_code: 0`, `writes: "none"` |
| 3b | Pre-release check, redirect + 404 + page without description | 618 | 618 | 19:22:49.9 – 19:22:52.0 | 2.1 s | $0 | none | 200, `verdict: fail`, `exit_code: 1`, `writes: "none"` |

Durations against 2026-10-14: technical audit 4.6 → 5.5 min, full report 8.8 → 7.9 min, pre-release 3 s → 4.6 s / 2.1 s.
Every node of 595 (123 nodes run) and 614 (197 nodes run) is `success` (`files/B-exec-595-nodes.txt`, `B-exec-614-nodes.txt`).
Slowest nodes: *PageSpeed* 38.9 s (614), *Render Key Pages* 25.9 s (595), *Fetch GBP* 20.6 s (595), *GSC Audit Query* 15.7 s (595),
three 60 s crawl waits.

---

## 1. Technical audit (run 1, exec 595)

### What came back

Headline (node *Build Site Issues*, `files/B-audit-595-site_audit.json`): `health_score 83`, `raw_score 83`, no cap, grade "Good";
`issue_counts {Critical 0, High 4, Medium 9, Low 14, Info 3}` = 30 findings; `pages_crawled 47`; DataForSEO on-page score 93.35.
Category scores: Crawlability & Indexing 73 (weight 22), On-Page 87 (18), Content 75 (13), Performance 72 (15), Security 97 (10),
Images 97 (7), Technical 98 (5), AI Search Readiness 92 (10). Re-computing the score with the engine's own formula
(`Build_Site_Issues.js` §7: category starts at 100, Critical 30 / High 15 / Medium 7 / Low 3 / Info 1 × 0.6–1.0 by share of pages,
×0.7 decay per further finding of the same severity, weighted mean, caps 60/70/85) reproduces **83** exactly.

Customer-facing text (Word report `files/B-audit-595.doc`, text `B-audit-595-doc.txt`; the PDF `B-audit-595.pdf`, 24 pages, is rendered
by Gotenberg from the same HTML — *Prepare PDF Audit* copies the Word binary to `index.html` — so its figures are the same source):

> We crawled 47 pages of techand.ai … We found: Critical 0 · High 4 · Medium 9 · Low 14 · Info 3.
> Fix These First. Ordered by likely impact. "A large share of important pages is not indexed by Google" is first because Google cannot
> index or follow these pages, 16 of 47 crawled pages, an estimated 10 clicks and 1,699 impressions in the last 28 days, High severity —
> impact score 38.6 against 37.1 for "HTML cannot be cached by the CDN (no-store / private)".

The 30 findings in the delivered order (impact score in brackets): 1 High not indexed (38.6) · 2 High CDN no-store (37.1) · 3 Medium
duplicate content, 7 pages (18.5) · 4 Medium render-blocking 45/47 (18.1) · 5 Medium low text-to-HTML 44/47 (17.8) · 6 Medium image
payload > 1 MB 35/47 (15.7) · 7 High orphan pages 6 (11) · 8 High lorem ipsum 1 (7.6) · 9 Low missing CSP (7.4) · 10 Low no Google
Business Profile (7.4) · 11 Medium AI crawlers see a different version of 1 key page (5.6) · 12 Medium no compression 2 (4.3) ·
13 Medium missing canonical 2 (4.3) · 14 Medium missing meta description 1 · 15 Medium brand repeated in title 1 · 16 Low hard to read
24 · 17 Low long URLs 6 · 18 Low shown in Google but never clicked 10 · 19 Low title < 30 characters 12 · 20 Low URLs not SEO-friendly 4 ·
21 Low internal URLs that redirect 2 · 22 Low links pointing to redirects 2 · 23 Low articles with no outbound links 2 · 24–27, 29–30
folded as "Minor items (6)" (light content, alt text, Open Graph, deprecated tags, H1 = title, Twitter card) · 28 Info Core Web
Vitals field data not available. Every finding has non-empty evidence; `evidence_withheld: []`.

**Impact basis.** Every finding carries `impact_traffic` with the property's real totals (`property_totals {clicks 32, impressions
5308}`); site-wide findings use those totals, and page findings whose pages add up to more are capped at them and say so
("Render-blocking … about 32 clicks and 5,308 impressions in the last 28 days (capped at everything the whole website measured in that
period …)"). Page findings on pages outside Search Console's first 10 page rows get a site-average estimate labelled "an estimated …"
(B-7). The method is printed in full (`priority_method`) and the first item's reason is spelled out (`priority_first`, quoted above).

**Crawl coverage.** `site_structure.crawl_coverage`: "Crawled 45 of 45 known URLs (100%; sitemap 45 + 44 pages with Search Console
impressions)", `crawl_limit 200`, `crawl_complete true`, `not_crawled 0`. The headline says 47 pages because the crawl item list
(*Get Crawled Pages*) holds 45 HTML pages plus 2 items with `resource_type: "redirect"`, status 308 (see B-5). The not-crawled check
did not run ("no known URL outside the crawl was read in this run") because nothing was missing. Live: the sitemap lists 45 URLs, all
on `www.techand.ai` (`files/B-live-techand-pages-scan.json` holds my read of all 45).

**JavaScript / render diff.** Five key pages read twice (`rendered_source: render_service`, six figures each). One difference was
found and turned into a scored Medium finding — and it is not a difference (B-4). The crawl ran without JavaScript; the notes say so
("Every page figure in this report was read from the first response…"). No missing-H1 / thin-content finding is raised for a
client-rendered page: techand.ai is server-rendered (raw and rendered word counts equal on all 5 pages, e.g. homepage 1,781 / 1,781),
so the "one finding with the cause" path was not exercised by this site.

**Core Web Vitals.** CrUX API enabled; every template × device answered `no_data`: "the Chrome UX Report has no field data for this
address (too few real-user visits in the last 28 days)" — an Info finding that does not score, and a `not_assessed` line. No lab test
in a technical audit (stated in `not_assessed`).

**Search Console.** Property `sc-domain:techand.ai` (siteFullUser); 28 days 2026-09-15 → 2026-10-12: 32 clicks, 5,308 impressions,
position 25.5; 50 pages and 98 queries with impressions; 2 scraper queries set aside. URL Inspection: `inspection_stats {asked 45,
checked 45, failed 0, failed_first 0, retried 0}` → "29 of 45 key pages are indexed, 16 are not"; 22 recently submitted pages were
inspected first. Mobile usability: "Search Console no longer answers mobile usability … so it was not checked." Submitted sitemap in
Search Console: `https://techand.ai/sitemap.xml` (bare host), 45 URLs, read 2026-10-13.

**Robots.txt and the fix pack** (`files/B-fixpack-*-595.txt`): robots.txt "Keep /robots.txt as it is (no change needed …)"; the copy
keeps every live line — `Allow: /`, `Disallow: /api/`, `Disallow: /admin/`, `Disallow: /private/`, `Host:` and `Sitemap:` (live file
`files/B-live-robots.txt`). llms.txt (8,394 characters, "A refreshed /llms.txt (you already have one: compare first)"): every link
is a sitemap URL and every title and description comes from that page's own title / H1 / meta description (31 links, each checked
against my fetch of the page); nothing invented. Its grouping
is weak: "## Services" holds one page (Dynamics 365 Managed Services) while 13 service pages sit under "## Pages", and "## Case studies"
holds `/dynamics-365-project-operations-uae`, which is a service page; four capability pages are all titled "Tech& Capabilities" — that
is the site's own H1 on those four pages (checked live). organization.jsonld / localbusiness.jsonld / website.jsonld carry only what
the homepage's own Organization schema states (name, logo `https://www.techand.ai/logo1.png` — answers 200, 61,783 bytes — the phone,
the DAFZA address, one LinkedIn sameAs). internal-links.csv: 10 rows, 8 of them linking the 6 orphan `/whatwedo/*` pages from
`/whatwedo`, the homepage and two service pages, each with an anchor. No redirect map (no broken page).

**Diff against the last audit of the same type** (`files/B-audit-595-diff.json`): previous `aud_mv8f098x5pt`, `site_audit`,
2026-10-14 17:59, health 83, 27 stored findings → `score_delta 0`, "0 fixed · 0 new · 27 still open (compared with the technical audit
of 2026-10-14)", `not_compared: []`, `sample_moved: 0`. The indexing row carries the sample: `affected 16, affected_before 18,
checked 45, checked_before 45, sample_changed false`; "Pages shown in Google but never clicked" 8 → 10. The Word report prints
"A large share of important pages is not indexed by Google — 18 → 16 affected".

**Stored rows**: `seo_audits` id 19 (`aud_mv9wujhkclv`, health 83, findings 27, high 4 / medium 9 / low 14 — consistent);
`seo_audit_findings` 27 rows (the 3 Info findings are not stored), the indexing row with `checked: 45`.

### What the customer sees in the app

`reports` row `2b58928c-580d-44de-b1ee-f09ca99dcc96`: stage `site_audit`, title "Technical audit · techand.ai", summary
`{high 4, grade Good, medium 9, critical 0, scoreDelta 0, healthScore 83}`, `scheduled: true` (the toolkit posts to n8n directly, so the
app has no run row and `runs.ts` marks any callback without a run as scheduled — an artefact of the test method, not of the product).
Payload: `health_score 83`, `top_issues` (the four High titles), `audit_diff`, `search_console`, `site_structure`, `render_diff`, `crux`,
`internal_links`, `fix_pack`, `run_ledger`, `run_cost_estimate_usd 0.11` ("modelled before the run … search data $0.11"), the PDF
(167,157 bytes) and the Word file (65,315 bytes) — byte sizes identical to the files I decoded from the execution. `emailed_to: null`.
The payload carries no findings list; the app's technical page reads `seo_audit_findings`.

### Findings checked against the live site

Fetched 2026-10-15 19:08–19:20 UTC with curl (both hosts where relevant). 30 findings: **17 TRUE, 7 FALSE, 1 misleading, 5 not verifiable**.

| # | Finding (severity) | Verdict | What I saw |
|---|---|---|---|
| 1 | Large share of important pages not indexed (High) | **misleading** | Google's states are what the API returned (I cannot query Search Console myself). But all 16 "not indexed" www paths have impressions **on `https://techand.ai/…`** in the same run's page data (B-1). |
| 2 | HTML cannot be cached by the CDN (High) | TRUE | every one of 45 pages: `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`; `x-vercel-cache: MISS` |
| 3 | Duplicate content, 7 pages (Medium) | not verifiable | no URL named; the crawl items carry no per-page duplicate flag; live: 0 duplicate titles, 0 duplicate descriptions |
| 4 | Render-blocking CSS/JS (Medium) | TRUE | homepage `<head>`: 4 stylesheets, 1 script without async/defer |
| 5 | Low text-to-HTML ratio (Medium) | TRUE | homepage 12,016 text bytes in 219,172 HTML bytes (5.5%) |
| 6 | Image payload > 1 MB (Medium) | TRUE | `/d365-finance-operations-implementation-rollout-uae` references 10 Cloudinary PNGs of 3.3–4.3 MB; HEAD sum 33.36 MB vs the report's 31.8 MB / crawler's 33.30 MB (`B-live-d365-image-sizes.txt`); they are `loading="lazy"`, which the report's wording ("referenced … the real download may be smaller") allows for |
| 7 | Orphan pages, 6 `/whatwedo/*` (High) | TRUE | none of the 45 pages has an `<a href>` to them (`B-live-techand-inbound-links.json`); `/whatwedo` shows them as `<article … role="button" tabindex="0">` cards with no address in the markup. The report does not name that cause. |
| 8 | Lorem ipsum on `/industries` (High) | TRUE | 3 passages in the "Education & Training" section ("Industry Context Lorem ipsum dolor sit amet…") |
| 9 | Missing security headers: CSP (Low) | TRUE | no `content-security-policy` header on any page |
| 10 | No Google Business Profile (Low) | not verifiable | consistent with DataForSEO answering 40102 "No Search Results." for "Tech& Dubai"; the one "techand Dubai" listing is another business ("CECEP Techand Adnan site office") |
| 11 | AI crawlers see a different version of 1 key page (Medium) | **FALSE** | raw H1 `Microsoft&#x27;s Saudi Arabia East Datacenter…` vs rendered `Microsoft's …` — the same text; fetched as GPTBot the raw H1 is the entity form (B-4) |
| 12 | No compression, 2 pages (Medium) | **FALSE** | both URLs are `https://techand.ai/insights/…` 308 redirects (text/plain body); the www pages answer `content-encoding: br` (B-5) |
| 13 | Missing canonical, 2 pages (Medium) | **FALSE** | same two redirect responses; every one of the 45 www pages has a canonical |
| 14 | Missing meta description, `/power-platform-analytics-uae` (Medium) | TRUE | no `name="description"` meta; the only page of 45 without one |
| 15 | Brand repeated in title (Medium) | TRUE | `<title>Power Platform & Analytics Services in UAE \| Tech& \| Tech&` |
| 17 | Long or messy URLs, 6 (Low) | TRUE for 5 | the sixth row is the bare-host redirect of a URL already listed |
| 18 | Pages shown in Google but never clicked, 10 (Low) | TRUE | per the run's Search Console rows; all listed URLs are on the bare host |
| 19 | Title shorter than 30 characters, 12 (Low) | TRUE | exactly 12 live titles under 30 characters (16 to 29) |
| 21–22 | Internal URLs that redirect / links pointing to redirects (Low) | TRUE | `/insights/your-current-pdf-invoices-…` links to `https://techand.ai/`, `https://techand.ai/insights/the-cost-of-non-compliance-…` and `…/upgrading-your-erp-…`; the report lists the redirecting targets, not the page that holds the links |
| 23 | Articles with no outbound links (Low) | **FALSE** | the two redirect responses again; the full report 8 minutes later lists "Sampled articles link to external sources" under what works |
| 24 | Light content `/contact-us` 342 words (Low) | not verifiable | my whole-page count is 602 words including navigation and footer; the crawler's text-only count method is not stated |
| 25 | Image missing alt, 45 pages (Low, minor) | partly true | no `<img>` on any page lacks an `alt` attribute; 45 of 45 pages have at least one `alt=""` — mostly decorative orbs and product icons beside text labels, which the report's own fix says to leave empty; the homepage hero image (`/Hero-img.webp`) is one of them |
| 26 | Missing Open Graph, 2 (Low) | **FALSE** | redirect responses; both www pages have `og:title` and `og:image` |
| 27 | Deprecated HTML tags, 1 (Low) | **FALSE** | the crawl item says `deprecated_tags: ["u"]`; `<u>` is a conforming element in the HTML Living Standard (B-13) |
| 28 | CWV field data not available (Info) | TRUE | consistent with the CrUX answer; not re-queried |
| 29 | H1 identical to title, 2 (Info) | TRUE | both insight pages: title and H1 identical |
| 30 | Missing Twitter card, 2 (Info) | **FALSE** | redirect responses; both www pages have `twitter:card` |

Also checked: `what_works` "One canonical host: https://techand.ai redirects (308) to https://www.techand.ai, and the canonical tags
agree" — the redirect and the tags are true (curl: `https://techand.ai/` → 308 → `https://www.techand.ai/`; `http://techand.ai/` → 308
→ `https://techand.ai/` → 308 → www, a two-hop chain not reported), but Google serves most of the site on the bare host (B-1).
"Every page has an H1" — true (45/45); two H1s repeat across pages and are not reported: "Tech& Capabilities" on 4 capability pages,
and the homepage H1 "Value Driven Innovation through Automation" on `/insights/value-driven-innovation-automation`.

Without the 7 false findings the engine's formula gives **85** instead of 83 (Crawlability 78, Performance 74, Technical 100,
AI Search Readiness 97).

### Compared with 2026-10-14 (exec 551, the same request)

Health 83 → 83. 31 → 30 findings: only "Structured data with errors" is gone; `not_assessed` now carries it as "it flagged 26 of 47
crawled pages … schema is not scored, not listed as a finding and not compared here — the full SEO report checks it". URL Inspection:
on 2026-10-14, 31 of 45 inspections failed; today 45 of 45 answered, 0 failed, `checked`/`checked_of` carried into the finding, the
diff and the stored row. The top-5 order is the same. The 7 false findings above were all present on 2026-10-14 under the same titles.

### Where it is wrong

B-1, B-4, B-5, B-6, B-7, B-13, B-14, B-15 (below), B-10 for its cost.

### Gap to the leader (criteria §1)

- Coverage: the whole site is small enough that 45/45 known URLs is complete; Screaming Frog / Sitebulb would classify the two 308
  items as redirects, not pages.
- Indexability: redirect chains and non-indexable reasons come from crawl reports that were never read (B-6); Google's chosen canonical
  is shown per page but with the host stripped, so the host split is invisible.
- Google's index view: 45 of 45 key pages inspected in one run (all the site has); the Pages report is not trended, and the
  interpretation of the result misses the host split.
- JavaScript: Sitebulb compares response vs render on every page; here 5 key pages, and the one difference reported is an entity
  decoding artefact.
- Core Web Vitals: CrUX has no data for this site; a technical audit runs no lab test at all.
- Fixes: Ahrefs Patches / Botify PageWorkers deploy fixes at the edge and re-check them; here a zip of files (robots, llms, three
  schema blocks, internal links), nothing for the High/Medium findings that need code (caching, compression, canonical, the lorem
  ipsum, the doubled brand title).
- Measured accuracy on this run: 7 of 30 findings false, 1 misleading, by my check above.

### Cost

Run's own figure **$0.0265** = crawl estimated $0.0211 (quoted $0.0900 for 200 pages, 47 crawled × $0.00045) + "Fetch GBP (Retry)"
$0.0054 measured; the ledger row (id 79) carries the same $0.0265 and is `done`. The execution's DataForSEO tasks, counted once by task
id (`costs.py` over exec 595): crawl quote $0.0900, *Fetch GBP* 2 tasks $0.0108, *Fetch GBP (Retry)* 1 task $0.0054, 4 crawl-extra
calls $0 (all 40401). With the crawl at the engine's own per-page estimate the run cost $0.0373, so the engine figure misses $0.0108
(B-10). Balance: −$0.341430 between 19:01:39 and 19:07:38, but executor A's assess ×3, keyword, ladder and discover runs spent in the
same six minutes; not attributable. Claude: none. Pre-run estimate shown to the customer: $0.11.

---

## 2. Full SEO Report (run 2, exec 614)

### What came back

Headline: `health_score 70`, grade "Needs Improvement", no cap, `issue_counts {Critical 0, High 17, Medium 22, Low 19, Info 3}` = 61
findings (7 of them from the AI content review, `scoring: false`); 47 pages crawled. Category scores: Crawlability 64, On-Page 85,
Content 61, Schema 74, Performance 64, Security 97, Images 90, Technical 91, AI Search Readiness 61, Authority 40.
Word report `files/B-fullreport-614.doc` (119,497 bytes; text in `B-fullreport-614-doc.txt`), PDF `B-fullreport-614.pdf` (50 pages,
same HTML source). The customer reads:

> About the site: Tech& is a Microsoft Dynamics 365, AI/Copilot and Power Platform consultancy serving enterprises and mid-size firms in
> the UAE and wider GCC … The main thing holding this site back: Tech& makes strong claims about being a Dynamics partner delivering
> measurable business impact but shows no verifiable proof: no case studies, named experts, certifications or client evidence.
>
> Key Numbers: You vs Competitors — Keywords ranking (top 30) 0 vs 472.5 · Keywords in top 10 0 vs 266 · Estimated monthly organic
> visits 0 vs 14,170.5 · Referring domains 18 vs 2,941 · Mobile PageSpeed 90 vs 38.5 · Domain age (years) 0.7 vs 16.4

Top issues in the payload: not indexed · CDN no-store · "The site does not rank in Google's top 10 for any keyword" · "Organic traffic
is under 10% of competitors" · "Very young domain competing with long-established sites" · "Keyword gap: searches competitors win and
you do not" · "Far fewer referring domains than competitors".

**Extra sections and where their numbers come from:**

- *Competitor benchmark* — "Competitors: provided by user" (cleartax.com, azentio.com). techand.ai 0 keywords / 0 top 10 / 0 visits /
  18 referring domains / PageSpeed 90 / 0.7 years; cleartax.com 300 / 193 / 28,083 / 2,465 / 47 / 26.8; azentio.com 9 / 8 / 258 /
  3,417 / 30 / 5.9. The competitor discovery still ran and was paid for (B-12).
- *Domain ages* — `Age Lookup Plan {skip: true}`, `whois_requests: 0`; all three ages served from `seo_cache` ("whois, stored
  2026-10-11"). Checked: WHOIS/RDAP for techand.ai gives registration 2026-02-19T12:02:03Z; cleartax.com 2000-01-01T11:13:34Z;
  azentio.com 2020-11-19 — all three match.
- *Keywords by search intent* — "Keyword research based on your services: ai & automation, assess & envision, build & implement";
  easy wins "ai mode", "ai in cloud", "ai on cloud", "cloud's ai", "blackbox ai", "face swap ai", "magic light ai", "ai photo generator",
  "uae company tax", "mofa attestation dubai"; keyword gap of 25 led by "value-added tax", "vat", "company tax uae", "corporate income
  tax uae", "corporate tax uae" (all cleartax.com rankings) and including "mofa attestation dubai", "trade license", "trn", "icv
  certificate", "attestation", "how to check emirates id status with passport number". 40 keywords were refused, but only those the
  data itself labels navigational ("runway ai", "rockwell automation", …). See B-2.
- *Authority & backlinks* — techand.ai domain rank 0, 19 backlinks, 18 referring domains, 94% followed, spam score 63; link
  opportunities: 25 domains that link to both competitors, 1 pitched (`uae-asp.ae`, an independent directory of MoF-accredited
  e-invoicing providers — its homepage title, fetched), 24 refused with a reason each (*Analyze Backlinks* `authority.gap`: 16 as link
  sellers by their own name, 6 by spam score, `mof.gov.ae` as a government site, `lounge.ai` as off topic).
- *Performance* — lab mobile: techand.ai score 90, LCP 3.30 s, CLS 0.00, TBT 140 ms, server 156 ms; cleartax.com 47; azentio.com 30.
  Field data: none (CrUX). Not re-measured by me.
- *AI search visibility* — 4 SERP reads (`tech&`, `site:techand.ai`, "best ai in cloud company united arab emirates", "ai in cloud")
  and 3 LLM answers. ChatGPT describes the company correctly; for "best ai in cloud company United Arab Emirates" ChatGPT names
  bayzat.tech, nxaara.com, nexait.ai, ae.scc.com, themiddleeast.cloud, oracle.com, apnews.com …, Perplexity names g42.ai, core42.ai,
  presight.ai, inception.ai … — that question comes from the keyword research above (B-2).
- *Content quality & E-E-A-T* — Claude Sonnet content review; 7 findings, `scoring: false`.

**Lineage** (`Build Full Report.lineage`): 7 rows — health score modelled from 47 pages; Search Console measured (5,308 impressions);
keyword data estimated (**"sample 0 keywords"**); backlinks reported ("sample not recorded"); CrUX measured; Lighthouse one sample;
domain age "as of 2026-10-15" (B-15).

**Diff, full vs full** (`files/B-fullreport-614-diff.json`): previous `aud_mv8bsknpagb` (full, 2026-10-14 16:30, health 69) →
`score_delta 1`, "1 fixed · 0 new · 51 still open (compared with the full SEO report of 2026-10-14). 1 finding(s) are not compared as
numbers: they were measured on a different number of pages this time (how many is shown with each)." The item in the diff's `fixed` list is "Site does
not rank at the top for its own brand name" (B-16). The indexing row: `affected 16, affected_before null, sample_changed true,
sample_note "16 now against 18 before, but how many pages each number was measured on was not recorded"`.

**URL Inspection**: 45 of 45, 0 failed, 0 retried; same 16 not indexed, but the states differ from run 1 eight minutes earlier for 5 pages
(`/whatwedo` "Discovered" → "unknown"; `/cookies`, `/security`, `/insights/data-sovereign-asset`,
`/insights/the-cost-of-non-compliance-…` "unknown" → "Discovered"). The two reports delivered to the customer 8 minutes apart therefore
print "11 × URL is unknown to Google … 1 × Discovered" and "8 × URL is unknown … 4 × Discovered".

**Fix pack**: the seven files are byte-identical to run 1's (`files/B-fixpack-*-614.txt`). The report's High "Service pages have no
Service schema" gets no Service block in the pack.

**Stored rows**: `seo_audits` id 20 (`aud_mv9x4zz1i6i`, health 70, `findings 51`, `high 17, medium 22, low 19`); `seo_audit_findings`
51 rows = High 14, Medium 19, Low 18 (B-9).

### What the customer sees in the app

`reports` row `3fac33ae-6120-4c26-896a-a369c1824ce5`: stage `full_report`, title "Full SEO report · techand.ai", summary `{high 17,
grade Needs Improvement, medium 22, critical 0, scoreDelta 1, healthScore 70}`, `scheduled: true` (same toolkit artefact), payload with
`top_issues` (7 titles above), `audit_diff`, `run_cost_estimate_usd 0.63`, PDF 290,173 bytes and Word 119,497 bytes (identical sizes to
the decoded files). The app's technical page compares this report with the technical audit before it (B-8).

### Findings checked against the live site (full-report-only items)

| Finding (severity) | Verdict | What I saw |
|---|---|---|
| The site does not rank in Google's top 10 for any keyword (High) | **FALSE as worded** | the same run's Search Console rows: 15 queries with average position ≤ 10 (techand 4.5, "tech and ai" 2, "copilot is changing business productivity" 2.5, "copilot advisory services" 3.2 …); the report's own what-works line says "Ranks #1 for its brand name" (B-3) |
| Very young domain (High) | TRUE | RDAP registration 2026-02-19 |
| Far fewer pages indexed than crawled: "Google site: estimate 9 vs 47 crawlable pages" (High) | misleading | the same report's URL Inspection says 29 of 45 www pages indexed, and the bare-host versions carry impressions; 47 includes the 2 redirect responses |
| Contact form not in the server-rendered HTML (Medium) | TRUE | `/contact-us` raw HTML: 0 `<form>`, 0 `<input>`, 0 `<textarea>` |
| Images without width and height (Medium) | TRUE | homepage: 8 of 38 `<img>` lack width+height |
| Service pages have no Service schema (High) | TRUE | no page of the 45 carries `"@type":"Service"` (FAQPage, BreadcrumbList, Organization on service pages); the 5 sampled were the orphan `/whatwedo/*` pages |
| Articles have no named human author, "1 of 2 sampled" (High) | TRUE, under-counted | both sampled articles' `author` is `{"@type":"Person","name":"Tech& Team"}`; a third article does name a person |
| No freshness signal, 2 of 2 (Medium) | TRUE | `dateModified` = `datePublished` on both |
| Phone number in a link but not shown (Low) | TRUE | `href="tel:8006427676"` on a "Call Now" button with no visible number, homepage and `/contact-us` |
| No speculation rules (Low) | TRUE | no `speculationrules` script |
| Homepage H1 does not name the business (Low) | TRUE | H1 "Value Driven Innovation through Automation" |
| AI review: "Microsoft partner status claimed but not evidenced … no badges" (High, not scored) | partly FALSE | the homepage shows `<img alt="Microsoft Partner" src="/microsoft-partner.svg">` twice; no Partner Center link found (B-18) |
| AI review: "contact page shows 'Let&#x27;s discuss…' with an unescaped HTML entity" (Medium, not scored) | **FALSE** | the HTML holds `Let&#x27;s`, which a browser shows as "Let's"; the reviewer's input text contains the undecoded entity (B-4) |

29 of the 30 technical findings repeat in this report with the same verdicts as in §1 — the four redirect-stub findings
(compression, canonical, Open Graph, Twitter card), the H1 entity finding and the `<u>` finding included. The one that does not repeat
is "Articles with no outbound links to sources"; this report lists "Sampled articles link to external sources" under what works instead.

### Compared with 2026-10-14 (exec 566)

Health 69 → 70; 62 → 61 findings; High 18 → 17. The only change in the scored set is "Site does not rank at the top for its own brand
name" (2026-10-14 evidence "Search "tech&": your position not in top 20"; today the SERP read gives position 1 and an AI Overview citing
techand.ai). The AI review wording changed run to run ("Encoding artifact and thin contact trust signals" yesterday; "Heavy repeated
mega-menu text and formatting artifacts" and "Contact details are present but limited…" today). The keyword seeds, easy wins, gap list and
AI category question are identical to 2026-10-14's (`ai & automation / assess & envision / build & implement`; "ai mode" … "mofa
attestation dubai"; "best ai in cloud company united arab emirates").

### Where it is wrong

B-1 (again, ranked first), B-2, B-3, B-4, B-5, B-6, B-7, B-8, B-9, B-10, B-11, B-12, B-15, B-16, B-18.

### Gap to the leader (criteria §1 and §3)

- The leaders' keyword gap (Semrush / Ahrefs) starts from the domains' real overlap and the customer's own keyword list; here it starts
  from three generic H1s and ignores the site's configured keywords ("e invoicing software uae", "erp implementation dubai",
  "peppol uae") and the site model's services.
- Narrative (3.2): the summary is grounded in data, but two of its headline numbers ("0 keywords in top 10", "0 visits") are a
  third-party index presented as fact while Search Console says otherwise in the same document.
- Lineage (3.11): present on every figure group, with two wrong sample/period entries.
- Formats (3.6): PDF, Word, app payload; no CSV of findings; "Prepared by Dev SEO" (the engine's brand setting) on the cover.
- One queue (3.3): the report ranks its own findings by impact; the app's technical page orders them by the same stored impact.

### Cost

Run's own figure **$0.3936** DataForSEO + **$0.0370** Claude; ledger row id 87 the same (`dfs_usd 0.3936`, `ai_usd 0.037`,
`settled_usd 0.037`, `done`). Execution tasks counted once by id: $0.4733 with the crawl at its $0.09 quote (Ranked Keywords $0.0731,
Backlink Summary $0.0721, Ask LLMs $0.0646, Keyword Ideas $0.0480, Domain Overview $0.0362, Backlink Gap $0.0251, AI SERP $0.0240,
Find Competitors $0.0120, Fallback SERP $0.0120, Fetch GBP $0.0108, Fetch GBP (Retry) $0.0054, crawl $0.0900); with the crawl at the
engine's estimate, $0.4044 — the engine's $0.3936 misses the same $0.0108 of *Fetch GBP* (B-10). Claude: n8n's own `tokenUsage` for
*Claude — Content Reviewer* is 11,190 in / 2,456 out = **$0.0469** at $2/$10 per M; the engine reports $0.0370 (B-11). The run's own day
reconciliation at settle: "the account fell $0.4774 between 09:45:25 and 19:07:48 while 8 settled run(s) report $0.2067 — they do NOT
agree ($-0.2707, -56.7%)" (`dfs_day_reconciled: false`; executor A's runs were in flight). Pre-run estimate shown: $0.63.

---

## 3. Pre-release check (execs 617, 618)

**What it is.** `POST /webhook/seo-prerelease` (workflow `SEOagentPreRel1`, 6 nodes). Per page: answers 200, does not redirect (redirects
not followed), no `noindex`, robots.txt allows it, one canonical pointing at the page, one title, one H1, a meta description; one
robots.txt fetch per host. Body shape from `build_api.py` / `v5/code/Prerelease_Validate.js`: `{base_url, paths}` or `{urls}`, optional
`live_host`, `staging`.

**3a — what was asked** (as a CI job with no staging host would, pointed at production):
`{"base_url":"https://www.techand.ai","paths":["/","/dynamics-365-business-central-uae","/dynamics-365-finance-and-operations-uae","/dynamics-365-crm-uae","/business-central-implementation-uae","/power-platform-analytics-uae","/contact-us","/insights","/industries","/insights/top-peppol-e-invoicing-software-features-every-uae-cfo-must-look-for"],"live_host":"www.techand.ai"}`

**What came back** (4.69 s): `ok: true, verdict: "pass", exit_code: 0, summary: "10 of 10 page(s) read, 79 check(s) passed, 1 warning(s),
3 not checked"`, `counts {pages 10, checks 80, passed 79, failed 0, warned 1, not_checked 3}`, `writes: "none"`. Warning:
`/power-platform-analytics-uae` "no meta description" (severity low). Not checked, each with a reason: index coverage ("Search Console
can only answer for URLs Google has seen; a staging URL has never been crawled …"), real-user speed, positions.

**3b — what was asked**: `{"urls":["https://techand.ai/insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs","https://www.techand.ai/this-page-does-not-exist-rr1015","https://www.techand.ai/power-platform-analytics-uae"],"live_host":"www.techand.ai","staging":false}`

**What came back** (2.19 s): `verdict: "fail", exit_code: 1`, "3 check(s) failed on 2 of 3 page(s)": the bare-host URL "answers 308 and
redirects to https://www.techand.ai/insights/the-cost-of-non-compliance-…" (two critical failures: page_answers, no_redirect); the
invented path "answers 404" (critical). The missing description stays a warning with `staging: false`.

**Writes**: executions 617 and 618 ran exactly *Prerelease Webhook → Validate → Valid? → Fetch Release Pages → Verdict → Respond*; no
Data Table, sub-workflow or mail node exists in the workflow. Answers saved as `files/B-prerelease-617.json`, `B-prerelease-618.json`.

**Where it is right**: a redirect and a 404 fail the release with a machine-readable exit code; nothing is written; what it cannot see
is listed with a reason. Same result shape as 2026-10-14 (exec 562: pass, exit 0, 4 pages, 32 checks).

**Where it is wrong**: B-17 (staging wording on a production check).

**Gap to the leader** (criterion 1.8, Lumar Protect: 350+ tests that can block a deploy): 8 checks per page. A page whose title carries
the brand twice ("… | Tech& | Tech&") passes "one title", the lorem ipsum on `/industries` passes (not a check), a missing description is
never more than a warning, and nothing compares the candidate with the current live page (a dropped H1 text, a lost internal link or a
changed canonical host would pass as long as one of each exists).

**Cost**: $0; no ledger row.

---

## Findings

**B-1 — High. The first-ranked finding misreads a host split as "not indexed".** Exec 595 *Build Site Issues*
`search_console.index_coverage.pages`: 16 www URLs not indexed (11 "URL is unknown to Google", 3 "Duplicate, Google chose different
canonical than user" with `google_canonical` = the same path on `https://techand.ai/`, 1 discovered, 1 crawled). The same run's
*GSC Audit Query* page rows (28 days) show **all 16 paths with impressions on the bare host** (`/d365-finance-operations-implementation-rollout-uae`
330, `/whywith-techand` 292, `/insights/how-microsoft-dynamics-365-finance-operations-supports-uae-vat-compliance` 194,
`/insights/the-cost-of-non-compliance-…` 180, `/capabilities/data` 95, `/whatwedo` 94 … in all 1,374 impressions, 1 click). By host the
property's page rows are `techand.ai` 37 pages / 28 clicks / 5,193 impressions against `www.techand.ai` 13 / 4 / 522, and the sitemap
submitted in Search Console is `https://techand.ai/sitemap.xml`. The report tells the customer "Pages that Google has not indexed cannot
rank at all … request indexing", lists "One canonical host … the canonical tags agree" under what works, prints Google's canonical in the
URL Inspection table as a bare path identical to the page (host stripped), and lists "/" twice in the top-pages table (14 clicks / 410
and 3 / 153). Same in exec 614 (impact 50.1, first again) and on 2026-10-14 (566: 18 of 45). Correct output: one finding that Google
serves most of the site from `https://techand.ai/…` although every page 308-redirects to www and declares a www canonical, with the
measured split, and the actions that follow (submit the www sitemap, remove the bare-host internal links, watch the move) — not
"cannot rank … request indexing" for pages that are earning impressions.

**B-2 — High. The full report's keyword research and AI question come from three generic headings, and no fit gate is applied.**
Exec 614 *Fallback Queries* / *Analyze Keywords* `site_keywords.seeds = ["ai & automation", "assess & envision", "build & implement"]` —
the H1s of the orphan `/whatwedo/*` cards (`Fallback_Queries.js` takes the H1s of the shallowest pages). Delivered as "Keyword research
based on your services": easy wins "ai mode" (Google's product, 49,500/mo, difficulty 1), "blackbox ai", "face swap ai", "magic light ai",
"ai photo generator", "mofa attestation dubai"; opportunities "character ai", "google ai", "meta ai", "humanize ai", "ai image generator",
"mh enterprises uae"; keyword gap "vat", "value-added tax", "corporate tax uae", "trade license", "trn", "icv certificate", "how to check
emirates id status with passport number". Other brands, a Google product and government services are offered as targets; only
keywords the data itself labels navigational are refused. *AI Queries* then takes the first commercial keyword ("ai in cloud") as the AI
category question, so the High findings "ChatGPT recommends other providers, not you" and "Perplexity recommends other providers, not
you" and the Medium AI Overview finding are measured on "best ai in cloud company United Arab Emirates" — GPU-cloud vendors (g42.ai,
core42.ai, nxaara.com), not Dynamics 365 partners. The site's configured keywords are not used. Identical on 2026-10-14 (exec 566).
Correct output: seeds from the site model's services and the configured keywords, the same brand / government / off-topic refusal the
discovery path applies, and an AI question in the site's own market.

**B-3 — High. "The site does not rank in Google's top 10 for any keyword" contradicts the report's own Search Console data.** Exec 614
finding (High, impact 37.1, third in `top_issues`): "Top-10 rankings in United Arab Emirates: techand.ai 0 vs competitor median 266";
the keyword section says "Your site does not rank in the top 30 for any keyword in United Arab Emirates yet" and the Medium finding "You
rank for 0 informational keywords". The same run's Search Console query rows: 15 queries with average position ≤ 10 (123 impressions,
5 clicks), including "copilot is changing business productivity" at 2.5 (informational); `what_works` says "Ranks #1 for its brand
name". Correct output: "DataForSEO's ranking database holds no keyword for techand.ai; Search Console shows 15 queries in the top 10",
and no High finding built on the database figure alone.

**B-4 — Medium. Hex HTML entities are not decoded before comparing or reviewing text, producing two false findings.** (a) Exec 595/614
*Render Diff*: H1 raw `Microsoft&#x27;s Saudi Arabia East Datacenter …` vs rendered `Microsoft's …` → scored Medium "AI crawlers see a
different version of 1 key page(s)"; the Word report shows both strings side by side. Fetched as GPTBot: the raw H1 is the entity form,
which every HTML parser decodes to the same text. The same finding was reported on 2026-10-14 as the only new finding of that diff.
(b) Exec 614 *Build Content Prompt* text contains `Let&#x27;s discuss how we can help your business` (1 `&#x27;`, 0 `&amp;` — named
entities are decoded, hex ones are not), and the content review reports "contact page shows 'Let&#x27;s discuss …' with an unescaped
HTML entity"; the live page shows "Let's". Correct output: decode all entities on both sides; no finding.

**B-5 — Medium. Page findings are raised on two 308 redirect responses.** Exec 595 *Get Crawled Pages*: 47 items = 45 `html` + 2
`resource_type: "redirect"`, status 308 (`https://techand.ai/insights/the-cost-of-non-compliance-…`, `…/upgrading-your-erp-for-uae-peppol-pint-ae-…`).
They produce "No compression" (Medium), "Missing canonical tag" (Medium), "Articles with no outbound links to sources" (Low), "Missing Open
Graph tags" (Low), "Missing Twitter/X card tags" (Info) and a duplicate row in "Long or messy URLs", and inflate the denominator ("of 47
crawled pages"). Live: the bare URL answers 308 with `content-type: text/plain`; both www pages have a canonical, `og:title`, `og:image`,
`twitter:card` and `content-encoding: br`. What is true is that `/insights/your-current-pdf-invoices-…` links to three bare-host URLs;
"Internal URLs that redirect" names the targets, not that page. Same titles on 2026-10-14. Engine formula without these 5 + B-4a + B-13:
85 instead of 83. Correct output: classify redirect items as redirects, raise one "3 internal links point at the bare host from
/insights/your-current-pdf-invoices-…" finding, and count 45 pages.

**B-6 — Medium. The four extra crawl reports are requested without the task id and never read.** Exec 595 and 614 *Run Crawl Extras*:
4 × `40401 "Task Not Found."`; DataForSEO echoes the request `{"api":"on_page","function":"duplicate_tags","type":"duplicate_title","limit":100}`
with no `id`. *Crawl Extra Requests* sets `id = d.crawl_task_id`, but its input is the raw DataForSEO response, which has no such field.
*Run Crawl Extras Retry Plan*: "nothing can be gained by asking again: Task Not Found." Same on 2026-10-14 (551, 566). The report says
"Some extra crawl reports were unavailable: duplicate_title: Task Not Found.; …", which reads as the provider's problem. Lost: redirect
chains (live `http://techand.ai/` → `https://techand.ai/` → `https://www.techand.ai/`, two hops, not reported) and per-page non-indexable
reasons. Correct output: send the crawl's task id; until then, name the cause as ours.

**B-7 — Medium. Impact weights use site-average estimates for pages the run measured.** `v5/code/_impact.js` `trafficIndex` reads only
`search_console.top_pages`, which `GSC_Audit_Findings.js` cuts to the first 10 of 50 page rows. Exec 595: "Orphan pages … an estimated 4
clicks and 637 impressions" — the run's rows for 5 of the 6 pages total 16 impressions, 0 clicks; lorem ipsum `/industries`
"estimated 1 click and 106 impressions" vs measured 0 / 7; missing description `/power-platform-analytics-uae` "1 / 106" vs 0 / 87;
not indexed "10 clicks and 1,699 impressions" vs 1 / 1,374 measured on the bare host. The labels say "estimated", but the measured rows
were in the same run and the impact order is built on the estimates. Correct output: look pages up in all 50 rows, host-agnostically.

**B-8 — Medium. The app's technical page compares a full report with the technical audit before it.** `app/server/src/services/data.ts`
`technicalData()` takes the latest stored audit and the one before it whatever their `report_type`. With the full report
(`aud_mv9x4zz1i6i`, 19:15) after the technical audit (`aud_mv9wujhkclv`, 19:07), that logic applied to the stored rows marks **25 of
51 findings "new"** (every Authority, Schema, AI and content finding) and "Articles with no outbound links to sources" "fixed", while the
engine's own diff of the same report says "1 fixed · 0 new · 51 still open". Derived from the code and the stored rows; not rendered in a
browser. Correct output: compare with the previous audit of the same report type, as the engine does.

**B-9 — Medium. The full report's stored audit row disagrees with its stored findings.** `seo_audits` id 20: `findings 51`, `high 17,
medium 22, low 19` (sum 58); `seo_audit_findings` for `aud_mv9x4zz1i6i`: 51 rows = High 14, Medium 19, Low 18. The 7 AI-review
findings (`scoring: false`) are in the severity counts but not in the rows. The app's report summary says "high 17"; a list built from
the rows shows 14 High. (Technical audit row 19 is consistent: 27 = 4 + 9 + 14.)

**B-10 — Low. The run cost misses the first Google Business Profile lookup, and a definitive "no results" is paid for twice.** Execs
595 and 614 *Fetch GBP*: 2 tasks × $0.0054 ("Tech& Dubai" → 40102 "No Search Results.", "techand Dubai" → 1 item) are absent from
`run_ledger.by_node`, which lists only "Fetch GBP (Retry)" $0.0054 — the 5-second retry of the same "Tech& Dubai" query, which again
answered 40102. Engine $0.0265 / $0.3936 against $0.0373 / $0.4044 from the execution's own task costs (crawl at the engine's estimate).

**B-11 — Low. The Content Reviewer's Claude cost is under-stated and mislabelled.** n8n `tokenUsage` (exec 614, `RR claude`):
11,190 in / 2,456 out = $0.0469. Engine: $0.0370, "measured" $0.0207 + "modelled" thinking $0.0163, because *Count Prompt* returned
10,306 and *Count Answer* 10,311 — the answer was counted as **5 tokens** and the remaining 1,638 output tokens were attributed to
thinking. `measured_share 55.9`.

**B-12 — Low. Competitor discovery is paid for and discarded when the request names competitors.** Exec 614: *Find Competitors* (Labs,
$0.012) and *Fallback SERP* (3 × $0.004 = $0.012) ran; *Pick Competitors* used `method: "provided by user"` for both competitors, and
*Fallback SERP Answers* feeds only *Pick Competitors* (workflow connections). $0.024 per full report with named competitors.

**B-13 — Low. "Deprecated HTML tags" flags `<u>`.** Exec 595 crawl item for `/insights/your-current-pdf-invoices-…`:
`meta.deprecated_tags: ["u"]`; the page has 2 `<u>` and no obsolete element. `<u>` is a conforming element in the HTML Living
Standard; the advice "Replace deprecated tags with modern HTML/CSS" does not apply. The report names no tag.

**B-14 — Low. "1 of 47 pages (20%)".** Both Word reports, finding "AI crawlers see a different version of 1 key page(s)": "AI Search
Readiness • 1 of 47 pages (20%)". 20% is 1 of the 5 pages checked; 1 of 47 is 2%.

**B-15 — Low. Lineage rows that do not match the report.** Technical audit (595 *Build Audit Report*): "Lighthouse scores and speed
savings | Google PageSpeed Insights | one simulated mobile load per page tested" although no PageSpeed test ran (`not_assessed` says
so), and "Core Web Vitals (real users) | source not recorded" although CrUX was queried and answered. Full report (614): "Searches per
month … sample 0 keywords" while about 60 keywords with volumes are printed; "Domain age … as of 2026-10-15" while the ages were read from
the cache stored 2026-10-11 (`whois_requests 0`).

**B-16 — Low. The full-report diff calls a one-day SERP swing "fixed".** `fixed: [{"title": "Site does not rank at the top for its own brand name", "severity": "High"}]`
— 2026-10-14 (566) read "tech&: your position not in top 20", today position 1, one SERP read each day, nothing changed on the site.
The diff summary also says the indexing finding was "measured on a different number of pages this time", while its own row says the
previous count "was not recorded".

**B-17 — Low. The pre-release check talks about staging on a production check.** Exec 617 (all URLs on `live_host`, so `staging` is
false by the rule in `Prerelease_Validate.js`): `not_checked` reasons "a staging URL has never been crawled" and "the Chrome UX Report has
no real visitors for a staging host"; for live URLs index coverage could be read.

**B-18 — Medium. The content review states "no badges" where the homepage shows a Microsoft Partner badge.** Exec 614 finding
"Microsoft partner status claimed but not evidenced" (High label, not scored): "no badges, Partner Center link, specializations or
certifications are visible in the text". Live homepage: `<img alt="Microsoft Partner" src="/microsoft-partner.svg">` twice; no link to
Microsoft's partner directory found. The review reads text only. Correct output: "a Microsoft Partner logo is shown but nothing links
to a verifiable designation".

---

## What could not be exercised and why

- Search Console / URL Inspection results themselves: I have no Search Console access; Google's states are taken as the API returned them.
- The PDF's text: no PDF text tool on the Mac or in the Gotenberg container; the PDF is rendered from the same HTML as the Word file
  (`Prepare_PDF_Audit.js`), whose text I checked.
- The app's technical page in a browser: not rendered (owner session needed); B-8 is derived from `data.ts` and the stored rows.
- A client-rendered site: techand.ai is server-rendered, so the "one finding with the cause" path for JS-only pages was not exercised.
- PageSpeed lab values and the Google Business Profile result: not re-measured (no paid or keyed call made by me).
- The daily key-page watch re-check after a change on the site: nothing on the site changed between the runs; not in my brief.
- Duplicate content (7 pages): the run names no URL.

## State left behind

- `seo_audits`: id 19 (`aud_mv9wujhkclv`, site_audit, 83) and id 20 (`aud_mv9x4zz1i6i`, full, 70).
- `seo_audit_findings`: 27 rows (595) + 51 rows (614).
- `seo_run_ledger`: id 79 (595) and id 87 (614), both `done`. Run 595's *Release Stale Runs* set 9 rows from 2026-10-14 to `stale`
  (ids 61, 62, 63, 65, 66, 67, 68, 69, 71 — runs 564, 561, 563, 572, 570, 574, 568, 578, 581).
- `seo_cache`: run 614 upserted `cost:ai:full` (`n 2, last 0.037, mean 0.0458`) and `cost:model:sonnet`.
- App `reports`: `2b58928c-…` (site_audit) and `3fac33ae-…` (full_report), both `scheduled: true`, each with a PDF and a Word file.
- Nothing submitted to Bing or IndexNow, no e-mail (`emailed_to: null`), no WordPress push; the pre-release check wrote nothing.
