# Area 7 — Site tracking (Search Console / GA4 / Trends / live checks), against the best available in October 2026

**Pass run 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score on the books: **7.0**
(`../system-review-2026-10-13/SCORECARD.md` §2.7), the joint-highest of the thirteen areas and therefore the one where a feature
list is least useful: what is left is the things the leader does that we do not, and the things we say that the data does not
support. What follows reads the code, the **2026-10-14** run (`RESULTS.md` here, executions 580→581) and the **2026-10-13** run
(`../system-review-2026-10-13/RESULTS.md`, executions 514→515) as "what we do", and the frozen
`../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md` §2 (2.7-2.12) and §3 (3.4, 3.5, 3.11) as the
yardstick. The CRITERIA file is untouched.

Every competitor and Google claim below carries a URL that was **opened in this pass** (listed in §8). Where something could not
be verified first-party it says so.

---

## 0. Read this first — we have been publishing the method of a test we never ran

1. **`change_method` has travelled in every weekly callback since G12 (2026-10-13), describing a page-change test against a
   control group, and `CT.compare` was called by the Link Builder and by nobody else.** The Site Tracker inlines the kit
   (`/*__CHANGE_TEST__*/` in `Site_Metrics.js`) and emits `change_method: CT.method` — a sentence that says "each change is dated
   and read against a control group: the same page's average Google position before and after, minus what the site's OTHER pages
   did over the same weeks" — while computing nothing of the kind. That is INVARIANTS **rule 4** ("nothing is promised until it
   exists") inside the one criterion that scores impact measurement (3.4, "control group or counterfactual", capped at 3 for
   "links only"). It was not in the register, and nobody had asked whether the sentence described anything. Fixed in this pass
   (B7-1): the test runs, with its own windows and five refusals.
2. **The weekly report has asked Search Console for `type: web` and nothing else since v4.3.** `device` and `country` are
   first-party dimensions of the same free endpoint
   ([API reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)); Looker Studio's connector exposes
   both and SEOTesting filters its dashboards by country. A site whose phone clicks halve while desktop holds reads, in our
   report, as one flat site-wide number. Fixed in this pass (B7-2) — four extra free requests.
3. **The brief's reminder about the event registry checks out.** `v5/data/seo_events.json` now holds 11 Google updates, all read
   from the Search Status dashboard (B6-4, today). It matters here because `ST.updateNote` and `AN.marks` — the Site Tracker's
   own alert sentences and chart marks — read that file. The 2026-10-13 report told the owner *"The September 2026 core update
   ran 15–30 September; check that the new gains hold"* (`../system-review-2026-10-13/RESULTS.md` §2.9). Google published no
   update by that name on those dates: what ran was the **September 2026 spam update, 24 Sep – 7 Oct**. That sentence is gone
   with the registry entry that produced it, but it is the clearest example in this area of a confident sentence resting on a
   fact nobody had checked.

---

## 1. The leader today

**The rubric names SEOTesting + Looker Studio. Both are still the right comparison, and SEOTesting has moved a long way since the
rubric was written — including into the annotations the rubric records as "not found" on our side.**

| Tool | What it leads on, October 2026 | Verified |
|---|---|---|
| **SEOTesting** | Time-based tests "against a forecast" and **split tests with a control group**; a group builder that balances the two groups on 90 days of Search Console clicks; Content Groups built with RegEx filters; Keyword Cannibalization; Zero-Click Searches; Brand Signals (GSC branded clicks + GA4 direct + **LLM referral sessions**); a daily e-mail on every Search Console update; sitemap and robots.txt monitors; an MCP server and an API | [features](https://seotesting.com/features/), [group configuration tool](https://support.seotesting.com/en/article/split-test-group-configuration-tool-1reabjb/), [changelog](https://app.seotesting.com/home/changelog) |
| **Looker Studio (Search Console connector)** | Two tables, **Site Impression** (web, image, video, news) and **URL Impression** (those plus **discover and googleNews**), one per data source; free; blending; the privacy caveat stated in Google's own words | [Connect to Search Console](https://docs.cloud.google.com/looker/docs/studio/connect-to-search-console) |
| **Search Console itself** | **Custom annotations** (shipped November 2025) and a **branded queries filter** — both in the UI, neither in the API | [custom annotations](https://developers.google.com/search/blog/2025/11/custom-chart-annotations), [branded filter](https://developers.google.com/search/blog/2025/11/search-console-branded-filter), [API reference](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) |

**Three corrections to the rubric's own text** (programme rule 1 — the old statement is kept, the CRITERIA file is unchanged):

- Old (§3 "Now"): *"**Not found:** white-label, share links, **annotations**, a generic test for an SEO change."* New, 2026-10-15:
  annotations exist on both sides now. Google shipped **custom annotations** inside Search Console in November 2025, SEOTesting
  draws **confirmed Google algorithm updates as a red line on every test chart** (changelog 2026-10-05) and added custom
  annotations and site-wide tests to its Brand Signals chart (2026-09-09), with CSV export (2026-04-21). We shipped ours with G12
  on 2026-10-13. The gap that remains is not annotations; it is the **test**.
- Old (§3(a)): *"SEOTesting: Time-based tests on Search Console data (can be backdated); split tests with a control group;
  content decay"*. New: "content decay" is **not a named feature on SEOTesting's own features page** — the nearest thing is
  "Content Insights", which "finds new opportunities and flags declining pages", and no 2026 changelog entry mentions a Content
  Decay report. The decay leader the rubric should be read against for this area is Clearscope, which area 4 already benchmarked
  (B4-1).
- Old (R7): *"Search Console added annotations and a branded-query filter in late 2025."* Confirmed as to existence and date, with
  one consequence the rubric does not record: **neither is in the API**. The Search Analytics endpoint has no annotations
  resource and no branded filter — its only query-side filter is `query` with `contains` / `equals` / `notContains` /
  `notEquals` / `includingRegex` / `excludingRegex`. So a customer's own Search Console annotations cannot be read by us, and
  our brand split (G9, `GQ.brandTest`) is not a convenience: it is the only way to have one at all through an API.

**And one claim the vendor cannot keep straight, recorded rather than relied on.** SEOTesting's changelog of **2026-02-17** says
*"Statistical significance is now generated directly in SEO split test results"*, calculated from the daily click/control
difference. Its own support article says the opposite: it does **not** display "a traditional significance score for split
tests", because a significance calculation over those daily difference points "would not be meaningful or true", and it directs
users to check the two groups' separate time-based tests instead. The article is undated; the changelog entry is dated. Both
pages were open on 2026-10-15. Neither publishes a formula. **This is the "verify the leader" case the brief warned about**, and
the honest conclusion is: the leader runs the comparison and does not publish a tested number for it.

---

## 2. What the leaders do, mechanism by mechanism

**The test.** SEOTesting's split test divides similar pages into a test group and a control group so that "algorithm updates or
seasonal shifts" land on both sides. The group builder is the interesting part, because it is the part that decides whether the
answer means anything: it reads **90 days of Search Console clicks**, sorts URLs by clicks descending and assigns each to
whichever group has the lower total so far ("always adding to the group with the lower total", a greedy subset-sum), never
revisiting an assignment; and it **excludes** pages whose clicks deviate from the mean by more than **two standard deviations**
(`Anomaly`), pages with **zero clicks on more than half of the 90 days** (`LowClicks`), pages with no Search Console data at all,
and pages that arrive after both groups are full. There is no minimum click threshold beyond the zero-click rule.

**The verdict.** Averages of the test group's clicks and the control group's clicks, with the daily difference averaged across
the before and after periods. No published significance test (see §1). A **query filter** can narrow a test to matching queries
(changelog 2026-08-28), and every **confirmed Google update inside a test's control or test period is drawn as a red line with
its name** (2026-10-05) — the leader's answer to "was it my change or was it Google?" is to *show the update*, not to adjust for
it.

**The data it works on.** Search Console, "without limits" on its own feature page, plus GA4 (property selector 2026-06-09, page
views in Content Quality 2026-07-14). Content Groups are built with Search Console filters including RegEx and analysed at group
level. Dashboards filter by country and brand.

**What Looker Studio adds, and what it costs.** It is free, it is Google's own connector, and it is the only one of the three
that can read **Discover** and **Google News** — but only through the URL Impression table, and a single data source can use only
one table, so site-level and URL-level impressions cannot sit in the same source. Google states the privacy limit in its own
words: "To protect user privacy, Search Analytics doesn't show all data", and withheld queries "may aggregate into a single row
with a blank value". It has **no annotations**, no tests, and no opinion: it is a window on the data.

**What nobody does.** Neither tool will tell you that a change *cannot* be judged yet and why. SEOTesting's group builder throws
pages out silently (the exclusion reasons are in the tool, not in the result), and Looker Studio shows whatever the API returns.

---

## 3. What we do, from the live evidence

| Mechanism | What we actually produced |
|---|---|
| **Cadence and cost (2.1 / 2.14)** | Weekly, Monday 09:00 (`SEOagentSiteTrk1`), plus an on-demand `track` run. Exec **580→581** (2026-10-14): the whole site report in **64 s** for **$0.036**; exec **514→515** (2026-10-13): **40 s**, ≈ $0.01. Search Console, GA4, Trends, URL Inspection and publish detection in one run |
| **Search Console depth (2.7)** | Every row, not a sample: 25,000 rows a request and up to 4 pages per kind (G9). Exec 581 read **526 named queries**; exec 515 read **862 rows**. The withheld share is printed — *"28.5% of impressions come from queries Google does not name"* — and brand is split from non-brand (4 brand / 3 non-brand clicks in exec 581), with scraper queries counted apart (`GQ.isScraper`) |
| **GA4 (2.8)** | Organic and AI sessions, key events, revenue per landing page. Live in exec 581 |
| **Index status (2.9)** | Up to **150** URL inspections a week, oldest first, with "not checked" for whatever the budget did not reach (G25). Was ≤ 20 when the 7.0 was given |
| **Diagnostics (2.10)** | Striking distance, CTR gaps, decay (tested and seasonally checked since B4-1 this morning), movers, new and lost queries, page inventory. **No cannibalisation** before this pass |
| **Alerts (2.11)** | Statistical, not fixed: exec 581 printed *"Both rises are statistically real"* for 34 clicks (+79%) and 5,282 impressions (+240%); exec 515 the same for 37 clicks (+147%) and 5,275 impressions (+271%), with z 3.05 and a 95% range of 35–349%. A position move needs 50 impressions in both periods or it is a "Watch" (G28) |
| **Annotations and data breaks (2.12 / 3.5)** | A "What happened in this period" table of pages published, audit fixes, Google updates and the num=100 break, with the sentence that a chart mark is context and not a cause (G12). R20 — the health score chained across unlike report types — was fixed on 2026-10-14 |
| **Lineage (3.11)** | Every block carries source, period, sample and a measured / modelled / not-available label, inline and in a table (G29) |
| **Impact measurement (3.4)** | **Nothing.** `change_method` was shipped; no test was run |
| **The honest limits** | Trends with too little data say so and carry no percentage (D21): *"Trends for e invoicing, erp software uae and dynamics 365 partner uae have too little search data to read"*, `direction: "sparse"`, `change_pct: null` |

**And what the owner could not tell from any of it:** whether the pages they published did anything. Exec 515's first action was
*"Do not publish a new page for 'uae e invoicing penalties'…"* and exec 581's was *"Three written pages are waiting to be
published"* — advice about work not yet done. For work already done, the report had one device-blind site-wide number, a list of
movers, and a method sentence for a test that did not exist.

---

## 4. The gap

| # | What the leader does | What we do | Does it change the customer's outcome? | Criterion |
|---|---|---|---|---|
| **G7-1** | **SEOTesting: a split test with a control group**, built so that updates and seasonality hit both sides | A `change_method` sentence and **no test** | **Yes, and it is the structural one.** Criterion 3.4 is capped at 3 for "links only" and the whole area's purpose is to say whether the work worked | 3.4 (cap 3) |
| **G7-2** | SEOTesting / Looker Studio filter by **country** and **device** | `type: web` only | **Yes.** A mobile-only collapse is invisible inside one site-wide figure, and the split is free | 2.7 |
| **G7-3** | SEOTesting ships a **Keyword Cannibalization** report; Semrush has a tab | Nothing — although the query × page rows have been read in full since G9 | Yes. It is a page splitting its own signals; the evidence was already in the node | 2.10 (named) |
| **G7-4** | Looker Studio's URL Impression table reads **discover** and **googleNews** | `type: 'web'` only | Some, and site-dependent. Discover can be most of a publisher's traffic and none of a B2B site's | 2.7 |
| **G7-5** | SEOTesting: **Content Groups** with RegEx, analysed as a group | Per page and per query only | Some. "How is the blog doing against the service pages" is a question a 500-page site asks and we cannot answer | 2.10 |
| **G7-6** | SEOTesting: a **daily e-mail each time Search Console updates**; Search Console itself serves 24-hour data (`dataState: hourly_all`) | Weekly, on data finalised 3 days back | Some. Our 3-day lag is the right default for a *judgement*; it is the wrong one for "did the fix land" | 2.1 |
| **G7-7** | SEOTesting: **robots.txt and sitemap monitors** with alerts | The audit checks robots.txt monthly; the daily Page Watch (G11) watches key pages | Some — and the daily watch is arguably ahead, since it reads the pages themselves | 2.10 |
| **G7-8** | SEOTesting: **Brand Signals** — GSC branded clicks beside GA4 direct sessions and **LLM referral sessions** on one chart | Brand split (G9) in the weekly report; AI referral sessions in the AI visibility product | Some. The three series exist in two different reports; nobody has put them on one chart | 3.1 |
| **G7-9** | Search Console: **custom annotations** the customer writes themselves | Our marks come from our own stored events only | Minor, and **not buildable**: there is no annotations API. What is buildable is letting the owner's own notes become marks | 3.5 |
| **G7-10** | Search Console bulk export to **BigQuery**: no row cap, kept for ever | 100,000 rows a kind a week, our own archive in `seo_site_metrics` / `seo_query_history` | Minor for sites of this size; it is a Google Cloud bill and a decision | 2.7 (6 = top 500 + history) |

### Where the leaders are weaker, and we are right

1. **A test that cannot be judged says so.** Five refusals, each with its reason and the date it can first be read. SEOTesting's
   group builder drops anomalous and low-click pages inside the tool; the result does not tell the reader which pages were
   dropped or why.
2. **The 95% range carries the control group's own noise.** The rate-ratio form (`ln(cur/prev) − ln(cc/cp)`, SE
   `√(1/cur+1/prev+1/cc+1/cp)`) propagates the control group's sampling error into the interval. A ratio of two percentages does
   not, and that is how a quiet control group becomes a confident claim. Neither leader publishes any formula at all.
3. **A Google update is named, not feared.** It moves the control group too — which is what the control group is for. SEOTesting
   draws the red line and leaves the reader to decide; we say the sentence.
4. **A split Google answered with nothing is not the same as a split Google did not answer.** Both look like an empty table.
   Ours say which they are.
5. **Everything in one 64-second, $0.036 run**, delivered, with lineage on every figure. Looker Studio is a window; SEOTesting is
   Search Console; neither writes you a report that says what to do this week.

---

## 5. What to build

### (a) In reach now

| # | Item | Size | Status |
|---|---|---|---|
| **a1** | **Run the change test we were already describing** — each dated change against the control group of the site's other pages, over its own two windows | M | **Built in this pass** (§6, B7-1) |
| **a2** | **The device and the country split**, free, from the same endpoint | S | **Built in this pass** (§6, B7-2) |
| **a3** | **Cannibalisation from the query × page rows we already read** | S | **Built in this pass** (§6, B7-3) |
| **a4** | **Content groups**: one regex per group on the site's own pages (blog / service / product), reported and tested as a group — SEOTesting's Content Groups, on data we already hold | M | Register row **B7-5** |
| **a5** | **Discover and Google News** as their own search types where the property has them, refusing with "this property has no Discover data" where it does not | S–M | Register row **B7-4** |
| **a6** | **One chart for brand**: branded clicks (we compute them), GA4 direct sessions (we read GA4) and AI referral sessions (the AI product measures them) — three series we already have in two reports | S | Register row **B7-6** |
| **a7** | **The owner's own notes as chart marks**: `seo_console_checkins.notes` and the "I published a page" form already carry dated owner events; Search Console's own annotations cannot be read (no API) and that should be said once rather than implied | S | Register row **B7-7** |
| **a8** | **A fresh-data check after a fix**: `dataState: all` (and the `hour` dimension, which the API now documents) for the three days our 3-day lag hides, labelled preliminary in Google's own words | S | Register row **B7-8** |

### (b) Needs money or an owner decision

| # | Item | Cost | Who decides |
|---|---|---|---|
| **b1** | **Bulk export to BigQuery** (criterion 2.7's "all rows … own archive beyond 16 months"): no row cap, no 16-month limit, and it keeps the data after a property is lost | A Google Cloud project and its storage/query bill; "there is a free usage level" | Owner |
| **b2** | **Daily tracking** (2.1, shared with area 6's b1): Search Console is free, so the cost is **D25a** — a Mac that sleeps is not a daily tracker | the always-on host | Owner |
| **b3** | **A split test the owner designs** (two groups of pages, one change applied to one group): the engine half is the kit built today; the product half is a page where someone picks the groups, and a rule that refuses a test whose groups are not comparable | M–L of app work | Owner (product) |

### (c) Deliberately not worth it

| # | Item | Why not |
|---|---|---|
| **c1** | **Our own forecast model** (SEOTesting's "against a forecast") | A forecast is a model of the same site's past; a control group is a measurement of the same site's present. We have the control group free, and the last three rounds punished modelled numbers hardest |
| **c2** | **A significance score on the daily difference** | The leader itself refuses this and says why: a significance calculation over those points "would not be meaningful or true". Our test is at the window level, where the Poisson rate ratio is defensible |
| **c3** | **Reading the customer's Search Console annotations** | There is no annotations API — only the UI. Building a scraper for a customer's Search Console account is not something to put in a product |
| **c4** | **Tablet as a first-class device** | Google answers it; it is in the rows we now read and will show when it matters. Nothing beyond that is worth a line of report |
| **c5** | **Re-implementing Looker Studio** | It is free, it is Google's, and a customer who wants to slice their own data should be told to connect it. Our job is the judgement, not the pivot table |

---

## 6. What this pass built

**Build section 80, harness S90** (45 new checks, `5038 → 5083 passed, 0 failed`; build exit 0 with
`SEO_BUILD_ALLOW_DEFAULTS=1`, because a git worktree has no `n8n/.env`; **nothing deployed**).

**B7-1 — the test behind the method sentence.** `Site Plan` now dates every change from `seo_content_log.published_at`, computes
**its own two windows** (the 28 complete days after it, the 28 before it) and marks the ones that cannot be read yet with the
date they can first be read. The report's own 28-v-28 cannot test a change made three months ago — both of those periods sit
after it — so `GSC Requests` buys two free page-dimension requests per change over the whole site, which carries the page under
test **and** the control group of every other page measured on exactly the same days. `Parse GSC` reduces each window to the page
and the control group (clicks, impressions, page count, and the control pages' own position moves). `Site Metrics` judges:
clicks with the new `ST.lift` (expected = prev × the control group's ratio, **modelled** and labelled so; the rate ratio with a
95% range that carries the control group's own sampling error) and position with `CT.compare`, the Link Builder's comparison,
which keeps its own "too early" bar at 6 weeks. `change_method` is now the method of the test that ran. Five refusals, because a
lift computed on nothing reads as "no effect": no clicks before, no clicks after, under 20 clicks over both windows together,
fewer than 3 control pages, and a control group under 40 clicks. A Google update inside the window is named and **not** a
refusal.

**B7-2 — the device and the country.** Four small free requests (`device` and `country`, both periods), each value tested with
the same `ST.change` bar as every other alert, a share-of-clicks column, a table in the report and an alert when one device falls
on its own while the rest holds. A split Google did not **answer** is `failed` and unavailable with the reason; a split Google
answered with **no rows** is a measured zero, and says that instead.

**B7-3 — cannibalisation.** From the `['query','page']` rows read since G9 and thrown away since G9: a non-brand search of at
least 50 impressions where a second page of the site holds at least 10% of them. It names the share and position of each page,
the page Google shows most often, and — separately — the page that ranks better when it is shown, which is the case worth acting
on. Brand searches are excluded (several of your pages *should* answer your own name) and so are scraper queries; URLs differing
only by scheme, www, trailing slash or query string are one page. The action merges or differentiates the two pages and never
asks for a third, which would be D11 by another name.

Files: `v5/code/_site_stats.js`, `v5/code/Site_Plan.js`, `v5/code/GSC_Requests.js`, `v5/code/Parse_GSC.js`,
`v5/code/Site_Metrics.js`, `v5/code/Site_Report.js`, `build_v4.py` section 80, `harness/scenarios_v5.js` S90.

---

## 7. The one change that would most improve the customer's outcome

**Tell the owner whether the page they published actually did anything** — which until today the weekly report described in a
method sentence and never measured, so a customer paying for a page a week had no way to tell a page that worked from a month
when the whole site happened to be up.

---

## 8. Sources opened for this section

- SEOTesting — [features](https://seotesting.com/features/) (time-based tests "against a forecast"; split tests that "compare
  test and control groups to isolate true impact"; LLM tests; Keyword Cannibalization; Content Groups with RegEx; sitemap and
  robots.txt monitors; MCP server; rank tracking from Search Console data; daily e-mail on each Search Console update; **no
  mention of annotations or of a Content Decay report**),
  [split test group configuration tool](https://support.seotesting.com/en/article/split-test-group-configuration-tool-1reabjb/)
  (90 days of Search Console clicks, greedy subset-sum balancing, exclusions: >2 standard deviations, zero clicks on more than
  half the days, no GSC data, groups full; no minimum click threshold; no significance method),
  [SEO split testing and statistical significance](https://support.seotesting.com/en/article/seo-split-testing-and-statistical-significance-1ad6ffx/)
  (does **not** display "a traditional significance score for split tests"; a significance calculation on the daily difference
  "would not be meaningful or true"; use the two groups' separate time-based tests),
  [changelog](https://app.seotesting.com/home/changelog) (2026-02-17 "statistical significance is now generated directly in SEO
  split test results" — contradicting the support article; 2026-10-05 Google updates drawn as a red line on test charts;
  2026-09-09 confirmed updates, custom annotations and site-wide tests on the Brand Signals chart; 2026-08-31 Brand Signals;
  2026-08-28 query filter on split and group tests; 2026-08-10 Zero-Click Searches; 2026-04-21 annotations export to CSV)
- Google — [Search Analytics: query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) (dimensions
  `country`, `device`, `page`, `query`, `searchAppearance`, plus `date` and `hour`; `rowLimit` 1–25,000 with `startRow`;
  `dataState` `all` / `final` / `hourly_all`; **no branded filter and no annotations resource**),
  [custom annotations](https://developers.google.com/search/blog/2025/11/custom-chart-annotations) (November 2025; the post's
  body could not be read in this pass — see "not verified" below),
  [branded queries filter](https://developers.google.com/search/blog/2025/11/search-console-branded-filter) (November 2025; body
  not read), [Performance report](https://support.google.com/webmasters/answer/7576553) ("The newest data can be preliminary …
  and might change in the next few hours"; data grouped by Queries, Countries, Devices or Dates is aggregated **by property**,
  data grouped by Pages or Search appearance **by page**),
  [bulk data export](https://support.google.com/webmasters/answer/12917675) ("Data is subject to Google Cloud storage and query
  costs, but there is a free usage level"; data accumulates for ever unless a partition expiration is set)
- Looker Studio — [Connect to Search Console](https://docs.cloud.google.com/looker/docs/studio/connect-to-search-console) (Site
  Impression: web, image, video, news; URL Impression: those plus **discover and googleNews**; "a single data source can only use
  one of these"; "To protect user privacy, Search Analytics doesn't show all data")

**Not verified first-party** (search results only, so not relied on above): the custom-annotation limits widely reported as 120
characters and 200 annotations per property, visible to everyone with property access — the Google blog post's body could not be
read in this pass, only its title and date; the branded filter's March 2026 expansion to all eligible properties and its lack of
retroactivity; SEOTesting's pricing. Where a mechanism needs a paid seat — SEOTesting's test internals beyond its own support
pages — nothing is asserted about it.

---

## 9. Proposed register rows

For `../system-review-2026-10-11/FIX_PLAN.md` §3.14 — the orchestrator moves these in; this agent edited no register.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B7-1 | **The Site Tracker published the method of a test it never ran.** Since G12 it has inlined the change-test kit and shipped `CT.method` as `change_method` in every weekly callback — "each change is dated and read against a control group" — while `CT.compare` was called only by the Link Builder. Criterion 3.4 ("control group or counterfactual") is capped at 3 for links only, and the weekly report could not tell the owner whether a published page did anything. The report's own 28-v-28 cannot test an older change: both periods sit after it | **High** (INVARIANTS rule 4, in the criterion that scores impact measurement) | `v5/code/Site_Plan.js`, `GSC_Requests.js`, `Parse_GSC.js`, `_site_stats.js`, `Site_Metrics.js`, `Site_Report.js` | every dated change gets its own two windows (28 complete days after, 28 before) bought as two free whole-site page requests, so the page and the control group of every other page are measured on the same days; clicks judged with `ST.lift` (rate ratio, 95% range carrying the control group's own noise, expectation labelled modelled), position with `CT.compare`; five refusals; a Google update inside the window named, not refused | fixed 2026-10-15 (build section 80, S90); not deployed |
| B7-2 | **Search Console was asked for `type: web` and nothing else.** `device` and `country` are first-party dimensions of the same free endpoint; Looker Studio exposes both and SEOTesting filters dashboards by country. A site whose phone clicks halved while desktop held read as one flat site-wide figure | Medium–High | `v5/code/GSC_Requests.js`, `Parse_GSC.js`, `Site_Metrics.js`, `Site_Report.js` | four small free requests; each device and country tested with `ST.change`; share-of-clicks column, report table and an alert when one device falls alone; a split Google did not answer is unavailable, one it answered with no rows is a measured zero | fixed 2026-10-15 (build section 80, S90); not deployed |
| B7-3 | **No cannibalisation check** (criterion 2.10 names it; SEOTesting ships a report and Semrush a tab) although the query × page rows have been read in full since G9 and the second page thrown away | Medium | `v5/code/Parse_GSC.js`, `Site_Metrics.js`, `Site_Report.js` | a non-brand search of ≥ 50 impressions with a second page holding ≥ 10% of them, with each page's share and position, the page Google prefers and the page that ranks better when shown; brand and scraper queries excluded; one action that merges or differentiates and never asks for a third page | fixed 2026-10-15 (build section 80, S90); not deployed |
| B7-4 | **Discover and Google News are invisible.** Looker Studio's URL Impression table reads `discover` and `googleNews`; we request `type: 'web'` only, so a property with Discover traffic sees none of it | Medium for publishers, none for most B2B sites | `v5/code/GSC_Requests.js` / `Parse_GSC.js` | request the extra search types where the property has them and refuse with "this property has no Discover data" where it does not — never an empty section | open — in reach, ~S–M |
| B7-5 | **No content groups.** SEOTesting analyses Search Console performance by page or query group built with RegEx filters; a 500-page site cannot ask us "how is the blog doing against the service pages" | Medium | `v5/code/Parse_GSC.js` / `Site_Metrics.js` + the app | one regex per group over the page rows already read, reported and tested as a group with the same statistical bar | open — in reach, ~M |
| B7-6 | **Brand lives in two reports.** SEOTesting's Brand Signals puts branded Search Console clicks, GA4 direct sessions and LLM referral sessions on one chart; we compute all three and show them in two different products | Low–Medium | `v5/code/Site_Metrics.js` / `Site_Report.js` | one series set in the weekly report, with each line's own source and basis | open — in reach, ~S |
| B7-7 | **Search Console's own annotations cannot be read** (there is no annotations API — verified against the API reference), and nothing says so; meanwhile the owner's own dated notes (`seo_console_checkins.notes`, "I published a page") are not chart marks | Low | `v5/code/_annotations.js` / `Site_Metrics.js` | the owner's dated notes become marks; the report says once that Search Console's own annotations stay in Search Console | open — in reach, ~S |
| B7-8 | **The last three days are never shown.** The report reads `dataState: final` ending 3 days back, which is right for a judgement and wrong for "did the fix land"; Search Console serves preliminary data (`dataState: all`, and an `hour` dimension with `hourly_all`) and SEOTesting mails daily on every update | Low–Medium | `v5/code/GSC_Requests.js` / `Site_Report.js` | a short "since the report window" line using preliminary data, labelled in Google's own words ("still being collected and might change"), never mixed into the tested figures | open — in reach, ~S |
| B7-9 | **No bulk export to BigQuery** (criterion 2.7's "all rows (paged API or BigQuery), own archive beyond 16 months"). We page to 100,000 rows a kind and keep our own summaries; the export has no row cap and keeps data for ever | Low for sites of this size | the app + a Google Cloud project | offer it per site; it is a Google Cloud bill ("there is a free usage level") and a partition-expiry decision | open (owner, money) |
| B7-10 | **A split test the owner designs** (two comparable groups of pages, one change applied to one of them) — SEOTesting's core product, and the engine half of it is the kit built today | Medium | the app + `_site_stats.js` | a page to pick the groups, a rule that refuses a test whose groups are not comparable (the leader's own exclusions: anomalous pages, pages with no clicks on most days), and the same refusals as B7-1 | open (owner, product) |
