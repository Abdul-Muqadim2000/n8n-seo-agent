# Area 5 — Technical audit, against the best tool available in October 2026

**Pass run 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score on the books: **5.0** (`../system-review-2026-10-13/SCORECARD.md`),
which predates the audit fixes **R2 / R10 / R19 / R24** and **R31** — so it is not a description of what the audit does today. What
follows reads the code and the **2026-10-14** run (`RESULTS.md` here, executions 535-581) as "what we do", and the frozen
`../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md` §1 (criteria 1.1-1.14) as the yardstick. The
CRITERIA file is untouched.

Every competitor claim below carries a URL that was **opened in this pass** (listed in §8). Where a thing could not be verified
without a paid seat it says so.

---

## 1. The leader today

**The rubric names Sitebulb / Ahrefs Site Audit. That is still the right pair for the audit itself, but it is no longer the whole
comparison, and the reason is new since the rubric was written.**

| Tool | What it leads on, October 2026 | Verified |
|---|---|---|
| **Sitebulb** (v10.0, 9 Sept 2026) | Hints with severity + explanation; **Response vs Render** across a crawl; and now an **MCP with five packaged Skills** — *What To Fix First*, *What Changed*, *Technical SEO Audit*, *Release Check*, *Dev Handoff* | [release notes](https://sitebulb.com/release-notes), [seo-skills](https://sitebulb.com/mcp/seo-skills/), [MCP limits](https://support.sitebulb.com/en/articles/15957255-what-the-sitebulb-mcp-can-and-can-t-do), [response vs render](https://sitebulb.com/product/response-vs-render) |
| **Ahrefs Site Audit** | **Always-On Audit**: a 24/7 crawl prioritised by organic traffic, inlinks, depth, indexability and **IndexNow** signals, with grouped e-mail alerts every 30 minutes; **Patches** that change a live title or meta description through a JS snippet or a Cloudflare Worker | [AOA](https://ahrefs.com/blog/always-on-audit), [Patches](https://help.ahrefs.com/en/articles/9775727-how-patches-work-in-site-audit) |
| **Screaming Frog** (24.3, 29 June 2026) | 300+ issues across 24 categories, each Issue / Warning / Opportunity **and** a High / Medium / Low priority; **Auto Compare Crawls** with the changes inside the completion e-mail; **Find Uncrawlable Links**; an **MCP server that can run crawls** | [release history](https://www.screamingfrog.co.uk/seo-spider/release-history/), [v24](https://www.screamingfrog.co.uk/seo-spider-24/), [issues](https://www.screamingfrog.co.uk/seo-spider/issues/) |
| **Lumar Protect** | 350+ automated QA tests in CI/CD that **can block a deploy** against a chosen technical-health threshold; template or key pages testable "even hourly" | [protect](https://www.lumar.io/protect/) |
| **Conductor Monitoring** (ex-ContentKing) | 24/7 monitoring with "no crawl delays", a changelog of every page change kept **60 months**, and issues **ranked by business impact** | [monitoring](https://www.conductor.com/platform/website-monitoring/), [intelligent prioritization](https://www.conductor.com/platform/features/intelligent-prioritization/) |

**What changed in 2026, and why it matters to us more than to anyone else.** Both desktop leaders shipped an **agent layer** this
year: Screaming Frog 24.0 (19 May 2026) added an MCP server that runs crawls and exports from natural language, and Sitebulb 10.0
(9 Sept 2026) added an MCP plus five packaged Skills — the first of which, *What To Fix First*, **interviews the user about the
site, then returns three to five issues ranked by impact against effort**. That is the thing we have been building as a workflow
for a year, sold as a skill on top of a crawler. The comparison for this area is therefore no longer "does our crawl find what
their crawl finds" but "**is our automatic judgement better than theirs, and can the customer interrogate it**".

**Two corrections to the rubric's own text** (programme rule 1 — the old statement is kept, the CRITERIA file is unchanged):

- Old: *"Patches: **AI-written** titles and meta descriptions deployed through a JS snippet or a Cloudflare Worker"*.
  New, 2026-10-15: Ahrefs' own Patches article **does not say the content is AI-written** — it describes a drafted value you type or
  import, published through a JS snippet or a Cloudflare worker, limited today to **titles and meta descriptions** (redirects,
  canonicals, robots meta and internal links are listed as planned). Only users with 2FA, in a project with verified ownership, on a
  Project Boost that supports it, can publish.
- Old: *"Sitebulb: 300+ prioritised Hints; Response vs Render on every page"*. New: Response vs Render requires the Chrome crawler
  and the product page describes it at **template level across a crawl**; it does not state that it runs on every crawled page.
  **Not verified** without a paid seat.

---

## 2. What the leaders do, mechanism by mechanism

**Severity and priority.** Screaming Frog publishes the full taxonomy: 24 categories, each item an **Issue** ("should ideally be
fixed"), **Warning** ("not necessarily an issue, but should be checked") or **Opportunity**, plus a **priority** of High / Medium /
Low "based upon potential impact" — and it says in its own documentation that the priorities "are not hard rules and may need
context for a specific site". Conductor goes one step further and scores each finding by **business impact**, naming three inputs —
**page views, conversion rate and internal linking data** — and illustrating it with "a broken canonical on a page with 10 monthly
visits matters far less than the same defect on a top converting landing page". **The weighting itself is not published.**

**Continuous crawling.** Ahrefs' Always-On Audit crawls **24/7 at 1 URL/minute** (10/min on the Pro boost, 30/min on Max), picking
the next URL from organic traffic, internal and external inlinks, URL depth, indexability and **IndexNow** pings; a new error-level
issue produces an e-mail, **grouped and sent every 30 minutes**, with per-category alert rules, a sensitivity setting and a minimum
number of occurrences. A scheduled audit still gathers the primary data; AOA keeps it fresh and does not consume crawl credits.

**Change detection.** Screaming Frog 24.0 lets a scheduled or CLI crawl **auto-compare the last two crawls in a project**, and puts
the issue table *and* the changes between the two crawls **inside the completion e-mail**, so a spike in non-indexable pages or
vanished titles is visible without opening the crawl. Conductor keeps a changelog of every page change for up to **60 months**.

**JavaScript.** Sitebulb's Response vs Render sets the raw server HTML against the rendered HTML and reports what only exists after
rendering — content, links, canonicals, meta robots — as Hints, with the explicit caveat that "differences aren't automatically
problems" because some frameworks load everything during rendering. Screaming Frog 24.0's **Find Uncrawlable Links** names the
other half of the same problem: `<span>` / `<div>` elements with `href`, `<a>` elements using `onclick`, and `javascript:` hrefs —
links Google "may still discover" but which "are not recommended and may not pass link signals the same way".

**Google's own view.** Screaming Frog integrates the **URL Inspection API** at the documented quota of ~2,000 URLs per property per
day, joined to the crawl in the Search Console tab (the per-property quota is also how a large site buys more: verified subfolders
each carry their own).

**CI and release.** Lumar Protect runs 350+ QA tests (SEO including GEO, speed, accessibility) inside the CI/CD pipeline and will
**stop a build** that does not meet a chosen technical-health threshold; the same tests can run on templates or key pages hourly.
Sitebulb's *Release Check* Skill is the lighter version: a watch-list and thresholds you set once, run when a scheduled crawl
finishes, usually answering "all clear", with the suggestion to run it weekly and post to Slack. Its *Dev Handoff* Skill writes
tickets into Jira / Linear / Asana / Monday / ClickUp, each with the issue, why it matters, and **an acceptance criterion that
doubles as the test**.

**What the leader's agent refuses.** The Sitebulb MCP is **read-only**: it cannot start, schedule or change a crawl, it reads only
finished audits in your own account, it returns at most **50 example URLs per issue**, and when a project or audit cannot be found
it "says so rather than guessing". That last line is the bar this programme says to copy, and a competitor has now written it down.

---

## 3. What we do, from the live evidence

All execution ids from the 2026-10-14 run (`RESULTS.md` §2.4) unless stated.

| Mechanism | What we actually produced |
|---|---|
| **Crawl** | DataForSEO on-page, `max_crawl_pages` default **200**, `respect_sitemap: true`, `validate_micromarkup: true`, JavaScript **off by default** (`crawl_js: false`, 500-page cap when on). Exec **550** crawled **47** pages of techand.ai in 4.6 min for a **$0.0900** quote that R31 later settled at **$0.0212** from the pages actually crawled |
| **Checks** | **39 crawler flags** (`Build Site Issues` CATALOG) + **24 custom rules** + 8 domain-level + 4 crawl-summary + duplicate titles / descriptions / non-indexable / redirect chains, + probe findings, + Search Console findings, + render-diff findings. Exec 550 ended at **31 findings / health 83 "Good"**; the full report (exec **565/566**) at **62 findings / health 69** |
| **Coverage (1.1)** | **G24 proven**: "Crawled X of Y known URLs" where known = sitemap ∪ the pages Search Console reports impressions for, with a Medium finding and "every share below is a share of the pages that were crawled" under 90% |
| **Google's index view (1.3)** | URL Inspection of up to **25** key pages in a technical audit, **45** in the full report, choosing the page's own canonical where it names one. Exec 550 is the R19 case: **31 of 45 failed** with "Internal error encountered." and are now re-sent once (`Inspect Retry Plan`), with `checked` / `checked_of` on every finding and the stored row |
| **JavaScript (1.4)** | **G14**: **5 key pages** read twice — a plain GET and a Jina render — comparing title, H1, canonical, robots meta, link count, text length, each labelled with the reading it came from. Exec 551: `rendered_source: "render_service"`, one page differed, producing the only genuinely new finding of that diff |
| **Speed (1.5)** | PSI lab on the homepage (full report) + **CrUX per template and per device** (G7). Exec 566: `api_enabled: true` and an honest *"the Chrome UX Report has no field data for this address"* |
| **Priority (1.6)** | **G26**: severity × share of pages × the clicks and impressions those pages really got in Search Console × placement, in bands — index blockers first, cosmetic never first — with `priority_method` **printed in full in the report** and `priority_first` saying why the top item is top. **R10**: every basis capped at the property's own 28-day totals, with the cap stated |
| **Monitoring (1.7)** | Monthly audit + change-aware Audit Scheduler (exec **577-579**, `run: true, why: "on demand"`, sitemap fingerprint `1eb0as2`), **plus** the daily Page Watch (`_page_watch.js`: status, redirect, noindex, canonical, title, robots.txt fingerprint, free plain GETs) |
| **Pre-release (1.8)** | `POST /webhook/seo-prerelease` (`SEOagentPreRel1`), key-page checks against a staging host or URL list, answering `{ verdict, exit_code, failures, counts }`, writing nothing |
| **Fixes (1.9)** | A zipped **fix pack**: robots.txt, llms.txt, redirects, schema, internal-links.csv |
| **Fix verification (1.10)** | **G11**: "I fixed this" re-checks that one finding on the key pages within a day (`PW.recheck` → fixed / still_open / **not_checked** with the reason), instead of waiting for the next monthly audit |
| **Architecture (1.12)** | Click-depth buckets, sections, orphan pages, sitemap-vs-crawl, and internal-link suggestions with anchors (`Audit Diff`) |
| **Diff (R2 / D2 / R19)** | Like-for-like by `report_type`, `not_compared` for categories this audit type does not weight, and **"not compared: the sample moved"** instead of a delta when the two counts came from samples more than 20% apart |
| **Accuracy (1.14)** | `ACCURACY_SET.md`: **100% precision / 100% recall over 53 labelled findings** on three sites, useful precision 95.5%; harness **S49 fails the build** under 95%. Internal, not published |

**What a customer actually got on 2026-10-13 (exec 497, 47 pages):** health 83 "Good", 30 findings — 4 High (15 of 25 sampled pages
not indexed; HTML not cacheable by the CDN; 6 orphan pages; live lorem-ipsum text), 9 Medium, 14 Low, 3 Info — each with its
evidence line, its impact basis and the `not_assessed` list beside it.

---

## 4. The gap

| # | What the leader does | What we do | Does it change the customer's outcome? | Criterion |
|---|---|---|---|---|
| **G5-1** | **Ahrefs AOA** re-crawls 24/7 and alerts within 30 minutes; **Conductor** claims no crawl delay at all | Monthly audit, a **daily** key-page watch, change-aware scheduling | **Yes, and it is the biggest one.** A page that goes `noindex` on the 3rd is found on the 4th by us and within the hour by them. But it is bounded by **D25a** (an always-on host): on a Mac that sleeps, "daily" is already optimistic | 1.7 |
| **G5-2** | **Sitebulb** compares response vs render across the crawl, at template level | **5 key pages** per audit | Yes on a client-rendered site: 5 pages cannot speak for 200. Sitebulb's own 2024 corpus puts "H1 only after rendering" at **18.3% of pages**, so the blind spot is common | 1.4 (cap 4) |
| **G5-3** | **Ahrefs Patches** pushes a new title or meta description to the live site through a worker or a snippet | A fix-pack **zip** of files to apply by hand | Yes — the gap between "here is the fix" and "it is live" is where SEO work dies. But it needs an owner decision (**G13**, a CMS or a Cloudflare worker) | 1.9 |
| **G5-4** | **Screaming Frog** has 10 hreflang issues and a Hreflang category; **Semrush** has an International SEO report | **No hreflang check at all** — the string does not appear in any audit node | Only for multi-language sites; for those it is a hole, and it is cheap to close on HTML we already fetch | 1.2 |
| **G5-5** | **Lumar Protect** blocks a deploy on a threshold; **Sitebulb Release Check** runs on a schedule and posts to Slack | `seo-prerelease` exists and answers `exit_code`, but there is **no documented CI recipe, no threshold, no "ignore this planned change"** | Yes for a team that ships weekly; it is the difference between a check that exists and a check that runs | 1.8 |
| **G5-6** | **Sitebulb / Screaming Frog MCP**: ask your own crawl a question, get the 3-5 things worth doing, hand off to Jira | Reports and a dashboard. **No read API, no MCP, no ticket hand-off** | Partly. Our fix list already *is* the "what to fix first" answer, with its method printed — but the customer cannot interrogate it or push it into their tracker. Overlaps area 12's G-5 | 1.6 / area 12 |
| **G5-7** | **Conductor** scores by page views **and conversion rate** | Impact uses clicks and impressions; **no conversion or revenue input**, although GA4 is connected for AI referrals | Some. For a lead-generation site, impressions are a weak proxy for value | 1.6 |
| **G5-8** | **Ahrefs AOA** prioritises re-crawl by **IndexNow** pings | We **operate** IndexNow for the customer (v4.12) but never feed it back into what to re-check | Small, but it is free signal we already hold | 1.7 |
| **G5-9** | Crawl the whole site (leaders) | 200 pages by default, 1,000 maximum, with coverage stated | Mostly honest already (G24). A site over 1,000 pages is capped and **the known URLs we did not reach are counted but never looked at** | 1.1 (cap 4) |
| **G5-10** | **Botify / Lumar**: log-file analysis | None | **No** for our customers — see §5(c) | 1.11 |

### Where the leaders are wrong, or simply have nothing, and we are right

1. **Cause versus symptom.** No tool checked joins a crawl-wide symptom to the rendering that causes it. Sitebulb reports both
   (Hints for the crawl, Hints for Response vs Render) and leaves the reader to connect them. Until today so did we — that is what
   this pass fixed (§6).
2. **Saying what the number was measured on.** Nobody publishes a "the sample moved, so this is not compared" behaviour (R19), nor
   a cap of an impact basis at the property's own totals (R10). Screaming Frog's documentation goes as far as "priorities are not
   hard rules"; ours prints the whole weighting in the report.
3. **A published method.** Conductor's business-impact score names three inputs and no weights. Ours prints `priority_method` in
   full, in every audit, to the customer.
4. **Refusing on evidence that failed.** A URL inspection that errored is "not checked" with the reason and never "fine"
   (`PW.coverage`, R19). The leaders' documentation describes no equivalent.
5. **Measured accuracy.** 100% precision over a 53-case labelled set, enforced in CI by the harness. **No vendor publishes a
   precision figure at all** — the frozen criterion 1.14 already says so with **(U)**.

---

## 5. What to build

### (a) In reach now

| # | Item | Size | Status |
|---|---|---|---|
| **a1** | **One cause, not five symptoms** — join a crawl-wide finding to the rendering that causes it where the render check proved it | M | **Built in this pass** (§6, B5-2) |
| **a2** | **The links nothing can follow** (Screaming Frog parity), from HTML already fetched, named with the orphan pages they explain | S | **Built in this pass** (§6, B5-1) |
| **a3** | **Say that the crawl read the first response** | S | **Built in this pass** (§6, B5-3) |
| **a4** | **hreflang validation** on the key pages already read twice: valid language / region codes, self-reference, `x-default`, absolute URLs, return tags among the pages we hold — **silent when the site declares no hreflang**, so a single-language site gains no noise | S | Register row **B5-4** |
| **a5** | **Look at the known URLs the crawl never reached**: a free plain GET of up to 25 of them (status, noindex, canonical, title) so "not crawled" becomes a statement instead of a count. Reuses the `Fetch Raw Pages` shape | M | Register row **B5-5** |
| **a6** | **Response vs render beyond 5 pages, free**: when the audit crawl runs **with** JavaScript, the crawl is already the rendered reading of every page — pair it with a free raw GET of up to 25 pages instead of a paid render. Today `fromCrawl()` is only a fallback for the 5 | M | Register row **B5-6** |
| **a7** | **A CI recipe for `seo-prerelease`**: a documented GitHub Action / shell snippet, a **threshold** (`fail_on`), and an "expected change" list so a planned release does not fail the build — the Lumar / Release Check shape on a workflow that already exists and already answers `exit_code` | S–M | Register row **B5-7** |
| **a8** | **Feed IndexNow and the published-page log into the next re-check**: a page we submitted or wrote this week is the page most likely to have changed | S | Register row **B5-8** |

### (b) Needs money or an owner decision

| # | Item | Cost | Who decides |
|---|---|---|---|
| **b1** | **Continuous monitoring (1.7).** Even hourly key-page checks need a host that is awake. **D25a** | ~$20-40/month VPS | Owner |
| **b2** | **Deploying a fix, not shipping a file (1.9).** Ahrefs' two mechanisms are a JS snippet and a Cloudflare worker; ours would be the CMS of **G13**, or a worker the customer installs. Both change what we are allowed to touch on a customer's site | $0 in software; a real product decision | Owner (**G13**) |
| **b3** | **A bigger crawl than 1,000 pages.** DataForSEO is priced per page; the cap is money, not code. The coverage line already tells the truth, so this is a per-customer setting, not a defect | ≈ $0.0005/page measured (exec 550: $0.0212 for 47 pages) | Owner, per site |
| **b4** | **Conversion / revenue in the impact weighting (G5-7).** GA4 is connected; attributing revenue to a page needs the customer's key events configured and agreed | $0, needs the customer's GA4 set up | Owner + customer |
| **b5** | **A read API or MCP over our own audit data (G5-6).** Both desktop leaders shipped one in 2026. Overlaps area 12's G-5 and should be built once, for the whole product, not for the audit | M-L | Owner (and area 12 owns it) |

### (c) Deliberately not worth it

| # | Item | Why not |
|---|---|---|
| **c1** | **Log-file analysis (1.11)** | The criterion itself scopes it to sites where crawl budget applies, and Google's own documentation puts that at 1M+ pages changing weekly or 10k+ changing daily. Our customers are 50-500 pages. It would need log shipping from the customer's CDN — a large, invasive integration for a criterion that is **N/A** at our size |
| **c2** | **Chasing a 300+ issue count** | Screaming Frog's 300+ includes 15 AMP issues and 19 PageSpeed opportunities. Our 39 flags + 24 rules + the Search Console, probe and render findings cover what we can act on; adding AMP checks in 2026 would be a number on a page, and every extra rule is more surface for the kind of wrong-cause finding this very pass had to fix |
| **c3** | **Accessibility testing (Lumar's 350+ includes it)** | A different discipline with its own legal exposure. Claiming an accessibility audit we cannot stand behind is worse than not offering one |
| **c4** | **Our own Chromium crawler** | Sitebulb's Chrome crawler is their moat and their cost. We rent rendering (DataForSEO `enable_javascript`, Jina) and pay per page. Building a crawler would be months of work to re-earn what we already buy |
| **c5** | **A health score that competes on being generous** | The score is capped, the cap is only reported when it bit (D24), and the method is printed. Tuning it to look better is the one thing the last three runs punished hardest |

---

## 6. What this pass built

**Build section 65, harness S75** (28 new checks, `4505 → 4533 passed, 0 failed`; build exit 0; nothing deployed).

**B5-2 — one cause, not five symptoms.** The audit crawl runs **without JavaScript by default**, so every page figure it reports is
read from the first response. On a client-rendered site that produced *"Missing H1 heading — add one clear H1 per page"* on pages
whose H1 exists, *"Thin content — expand these pages"* on 600 words no crawler can see, and *"Orphan pages"* on pages the navigation
links to perfectly well: **five findings, five wrong fixes and five deductions for one cause** — which the response-versus-render
check standing beside them had already proved. Now, where the render check proved the figure is written by JavaScript on **at least
half** of the key pages it read twice, the crawl-wide symptom is **joined to the cause**: one finding, the **higher** of the two
severities (so joining can never soften an audit), the crawl's own count and sample, the rendering fix, both titles kept in
`merged_titles`, and `site_audit.render_merge` recording the figure, the symptom and the proof base. One deduction instead of two.
Where the proof covers one page in five, **nothing is joined** — and where the crawl itself rendered JavaScript, nothing is joined
either, because then a missing H1 really is missing.

**B5-1 — the links nothing can follow** (Screaming Frog v24 parity, no new request and no cost): `<a>` with no `href` or a
`javascript:` href that navigates on click, and `div` / `span` / `li` / `button` / `tr` carrying a page address in an `onclick` or a
`data-href`, read out of the HTML already fetched for the render diff. A `<button onclick="submitForm()">` and a real `<a href>` are
never counted. It is reported with **the orphan pages it explains** — the cause our audit used to guess at in prose — and the fix is
a real `<a href>`, not "add internal links".

**B5-3 — the audit says what it read**: *"Every page figure in this report was read from the first response: the crawl did not run
JavaScript… so a heading, a text or a link that a script writes is reported here as missing."*

Files: `v5/code/Render_Diff.js`, build section 65 (`Build Site Issues` 4c, the audit notes, both report builders),
`harness/scenarios_v5.js` S75.

---

## 7. The one change that would most improve the customer's outcome

**Check the key pages continuously instead of daily and the whole site monthly** — the leaders find a `noindex` or a broken canonical
within the hour (Ahrefs AOA, Conductor) while our best is the next morning, and every hour a page is out of Google is traffic the
customer cannot get back; it is one owner decision (**D25a**, an always-on host) away, because the watch itself already exists.

---

## 8. Sources opened for this section

- Screaming Frog — [release history](https://www.screamingfrog.co.uk/seo-spider/release-history/) (24.3, 29 June 2026; 24.0, 19 May 2026; **no v25**), [v24.0 announcement](https://www.screamingfrog.co.uk/seo-spider-24/), [issues](https://www.screamingfrog.co.uk/seo-spider/issues/) (24 categories, "over 300", Issue / Warning / Opportunity + High / Medium / Low priority)
- Sitebulb — [release notes](https://sitebulb.com/release-notes) (v10.0 MCP, 9 Sept 2026; v9.5.0 HTML-over-2MB Hint, 27 Feb 2026), [SEO Skills](https://sitebulb.com/mcp/seo-skills/), [what the MCP can and can't do](https://support.sitebulb.com/en/articles/15957255-what-the-sitebulb-mcp-can-and-can-t-do), [Response vs Render](https://sitebulb.com/product/response-vs-render)
- Ahrefs — [Always-On Audit](https://ahrefs.com/blog/always-on-audit), [how Patches work](https://help.ahrefs.com/en/articles/9775727-how-patches-work-in-site-audit)
- Lumar — [Protect](https://www.lumar.io/protect/)
- Conductor — [website monitoring](https://www.conductor.com/platform/website-monitoring/), [intelligent prioritization](https://www.conductor.com/platform/features/intelligent-prioritization/)
- Already cited by the frozen criteria and **not re-opened** in this pass: [Sitebulb's 2024 JavaScript data](https://sitebulb.com/javascript-seo/2024-report/sitebulb-data/) (H1 only after rendering 18.3%, title modified by JS 8.4%, noindex in response only 4.6%), [Google's crawl-budget guidance](https://developers.google.com/crawling/docs/crawl-budget), [URL Inspection quota](https://developers.google.com/webmaster-tools/limits)

**Not verified** (search results only, no page opened, so not relied on above): Ahrefs' "170+ issues" and health-score formula;
Semrush Site Audit's "140+ checks" and its thematic reports.

---

## 9. Proposed register rows

For `../system-review-2026-10-11/FIX_PLAN.md` §3.14 — the orchestrator moves these in; this agent edited no register.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B5-1 | **Nothing read the links a crawler cannot follow.** A card, a tile or a table row that navigates from a script is not a link, and it is the usual cause of the orphan pages the crawl reports — which the audit named as a symptom and guessed at in prose. Screaming Frog v24 ships this as "Find Uncrawlable Links" | Medium | `v5/code/Render_Diff.js` | read `<a>` with no href / a `javascript:` href, and div / span / li / button / tr carrying an address in `onclick` or `data-href`, out of the HTML already fetched; report with the orphan pages they explain | fixed 2026-10-15 (build section 65, S75); not deployed |
| B5-2 | **Five symptoms, five wrong fixes, five deductions, one cause.** The crawl reads the first response (JavaScript off by default), so on a client-rendered site it reported "Missing H1 heading — add one clear H1 per page", "Thin content — expand these pages" and "Orphan pages" while the render check beside it had already proved a script writes them. Sitebulb's 2024 corpus puts "H1 only after rendering" at 18.3% of pages | **High** (wrong advice, and the score deducted twice for one cause) | `Build Site Issues` §4c (build section 65) | join the crawl-wide symptom to the rendering finding where the render check proved it on ≥ 50% of the key pages read twice: higher severity, the crawl's count, the rendering fix, both titles kept, one deduction | fixed 2026-10-15 (build section 65, S75); not deployed |
| B5-3 | **The audit never said which reading its page figures came from** — a heading a script writes was reported as missing with no word that the crawl did not render | Medium | `Build Site Issues` notes | state it in the audit's own notes, with how many key pages were read both ways | fixed 2026-10-15 (build section 65, S75); not deployed |
| B5-4 | **No hreflang check anywhere in the audit** — the string does not appear in any audit node, while Screaming Frog carries 10 hreflang issues and Semrush an International SEO report. Criterion 1.2 lists hreflang | Medium (only for multi-language sites, and a hole for those) | `Render_Diff` / `Build Site Issues` | validate the hreflang set of the key pages already read: valid codes, self-reference, `x-default`, absolute URLs, return tags among the pages held — **silent when the site declares none** | open — in reach, ~S |
| B5-5 | **The known URLs the crawl never reached are counted and never looked at.** G24 prints "crawled X of Y known URLs"; nothing says what the other Y−X are | Medium | the audit's Search Console chain | a free plain GET of up to 25 of them (status, noindex, canonical, title) so "not crawled" becomes a statement | open — in reach, ~M |
| B5-6 | **Response vs render covers 5 key pages** (criterion 1.4 caps us at 4 for it). Sitebulb compares across a crawl at template level | Medium | `Render_Diff_Targets` / `Render_Diff` | when the crawl runs **with** JavaScript it is already the rendered reading of every page: pair it with a free raw GET of up to 25 pages instead of a paid render (`fromCrawl()` is only a fallback today) | open — in reach, ~M |
| B5-7 | **The pre-release check has no CI recipe, no threshold and no "expected change" list**, so a check that exists is a check nobody runs. Lumar Protect blocks a build on a threshold; Sitebulb's Release Check runs on a schedule and posts to Slack | Medium | `build_api.py` (`SEOagentPreRel1`) + docs | a documented action / shell snippet, a `fail_on` threshold, and a planned-change list so an intentional release does not fail the build | open — in reach, ~S–M |
| B5-8 | **IndexNow and the published-page log are not fed back into what to re-check.** Ahrefs' Always-On Audit prioritises re-crawl by exactly these signals, and we already operate IndexNow for the customer | Low | Page Watch / Audit Scheduler | a page submitted or written this week goes to the front of the watch queue | open — in reach, ~S |
| B5-9 | **Continuous monitoring is bounded by the host, not the code.** The leaders alert within 30 minutes (Ahrefs) or claim no crawl delay (Conductor); our daily watch is already optimistic on a Mac that sleeps | **High** for criterion 1.7, **owner-blocked** | — | **D25a** (an always-on host) first; then raise the key-page watch frequency | open (needs D25a) |
| B5-10 | **A fix is shipped as a zip, not deployed.** Ahrefs Patches publishes a title or meta description through a JS snippet or a Cloudflare worker (titles and descriptions only; redirects, canonicals and robots meta are planned) | Medium | the fix pack | needs **G13** (a CMS) or a customer-installed worker — a product decision about what we may touch on a customer's site | open (owner, with G13) |
| B5-11 | **No read API or MCP over our own audit data.** Both desktop leaders shipped an agent layer in 2026 (Screaming Frog 24.0 May, Sitebulb 10.0 September) — the customer can ask their own crawl questions and push issues into Jira. Overlaps area 12's G-5 | Medium | the app (not the engine) | build once for the whole product, not for the audit | open — overlaps area 12 |
| B5-12 | **Impact weighting has no conversion or revenue input.** Conductor names page views, conversion rate and internal linking; we use clicks and impressions. For a lead-generation site, impressions are a weak proxy for value | Low–Medium | `v5/code/_impact.js` | take GA4 key events per page where the customer has them configured; keep clicks/impressions as the fallback and say which was used | open (needs the customer's GA4 key events) |
