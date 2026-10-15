# Benchmark area 10 — backlink monitoring

**Written 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score on the books: **7.0** (`../system-review-2026-10-13/SCORECARD.md`) —
given **before** D3's footprint gate, P1-2, G18-1 and B-L5 landed, so it is not a description of what the monitor does today.
Frozen rubric: `../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md` §4B, criteria **4B.1–4B.7**. That
file is untouched.

Scope: **monitoring** only. Getting links — outreach, sequences, deliverability — is area 11 and is not touched here.

> **Read the code, not the scorecard.** Everything in §3 was read in `v5/code/Parse_Backlinks.js`, `BL_Report.js`,
> `Link_Merge.js`, `BL_Plan.js`, `Verify_Requests.js`, `_link_kit.js` and the generated Backlink Monitor as they stood this
> morning, and against the live reports of execs **529** (2026-10-13, `files/bl-report-529.txt`) and **558 → 564** (2026-10-14,
> `RESULTS.md` §2.7). Every competitor claim carries a URL opened in this pass; the list is in §7.

---

## 1. The leader today — and whether the rubric still names the right one

**The rubric names Ahrefs (+ Linkody re-checks). Both are alive, both are still the right comparison, and they are the right
comparison for two different halves of the area** — Ahrefs for the index, Linkody for the re-check. Nothing has been
discontinued. Two things in the rubric's own evidence did move, and one of its figures could not be verified at all.

| Tool | Status checked 2026-10-15 | Source opened |
|---|---|---|
| **Ahrefs** | Alive. "The world's largest index of live backlinks, updated with fresh data every 15–30 minutes", "5 M Pages crawled every minute", "494 B Pages in index", "35 T" external-backlink history records. **But its own help page states the limit of that**: "The complete database update — refreshing the info on the whole Internet backlinks — takes about two months", and inside it "some pages will be updated 60 times, others only once, depending on their rating" | [ahrefs.com/big-data](https://ahrefs.com/big-data), [help 78052](https://help.ahrefs.com/en/articles/78052-how-often-is-ahrefs-links-database-updated) |
| **Ahrefs — the eight "lost" reasons** | Alive, and the honest part is the caveat: of its eight reasons, **four say the link may still be there**. "Noindex … the link may still be visible"; "Not canonical anymore … The link may still exist on the page"; "Crawl errors … the link returns if the page is live on a later recrawl"; "Dropped … The link may still exist on the page, but Ahrefs no longer indexes the page". Only "Link removed" and the redirect reasons describe the link itself | [help 920461](https://help.ahrefs.com/en/articles/920461-understanding-link-lost-reasons) |
| **Semrush** | Alive. "a backlink index of more than 43 trillion backlinks" and 390 million referring domains, "The database is refreshed at least hourly". Its retention rule is published: it "keeps its backlink database up-to-date by removing backlinks that haven't been detected in six months" | [semrush.com/analytics/backlinks](https://www.semrush.com/analytics/backlinks/), [the 2021 study](https://www.semrush.com/blog/biggest-backlink-database-study) |
| **Semrush — toxicity** | Alive, and the mechanism is the copyable part: "There are currently 45+ different toxic markers", weighted by "frequency and importance", "machine learning and user feedback" — and **the markers for a given link are shown**: "Hover over the Toxic Score and you will see which exactly Toxic Markers are associated with that specific backlink" | [semrush.com/kb/965](https://www.semrush.com/kb/965-backlink-analytics) |
| **Majestic** | Alive, and it publishes freshness **as a rule with a live date range** — the best practice in the field. Fresh Index: "contains backlinks we've seen in the past 120 days", "updated frequently throughout the day", printed with its own window (17 Jun 2026 → 15 Oct 2026, "Last updated 27 minutes ago", 187,586,974,049 unique URLs crawled). Historic Index: "spans back to 2006", 4.5 T URLs crawled — but its page says **"Last updated 03 May 2024"** | [majestic.com/support/glossary](https://majestic.com/support/glossary) |
| **Linkody** | Alive and cheap: **$14.90–$153.90 a month** for 500–50,000 monitored links, and its FAQ states the cadence plainly — "Linkody checks your links and updates their status every 24h" (new backlinks weekly; Google index status every 14 days). Its homepage sells exactly our Rule-4 promise: "Get alerted when backlinks point to a broken page (404), before the link value is lost" | [linkody.com/en/plans](https://www.linkody.com/en/plans), [linkody.com](https://www.linkody.com/) |
| **DataForSEO (our index)** | 1,981,638,221,669 live backlinks, 183,945,819,165 live pages, "Crawled last 24h: 1202825143" pages and 34,323,463,832 backlinks, "the backlink index is also updated continuously in real-time", "Newly discovered links are made available almost immediately after being crawled" | [dataforseo.com/apis/backlinks-api](https://dataforseo.com/apis/backlinks-api) |
| **Google — what to do about spam links** | Unchanged, and it is the whole of 4B.5: "This is an advanced feature and should only be used with caution", "In most cases, Google can assess which links to trust without additional guidance", and disavow only when the links "have caused a manual action, or likely will cause a manual action" | [Search Console help 2648487](https://support.google.com/webmasters/answer/2648487?hl=en) |
| **The base rate for link loss** | **New since the rubric was written.** Linkody, June 2026, **865,000 monitored backlinks**: "Only 56% of monitored backlinks are still live and correct"; 21% gone within 3 months, 34% within 6, **52% within a year**; average life ≈ 20 months; survival 89% at 3 months, 63% at a year, 31% past 5 years. Anchors: keyword-leaning 56%, branded 18%, naked URL 15%, image/empty 10%, generic 1%; dofollow 77% / nofollow 23%. And its method matches ours: **"Crawl errors (13%) are excluded"** because they may be blocked or timed-out checks rather than dead links | [blog.linkody.com/seo/link-building-statistics-2026-2](https://blog.linkody.com/seo/link-building-statistics-2026-2) |

**Three corrections to the rubric's own evidence** (programme rule 1 — the old statement stays, the CRITERIA file is unchanged):

- **"Ahrefs: 91.7% of reported links still live (The Upper Ranks 2025)" — could not be verified in this pass.** A search for an
  independent 2025–2026 study that re-crawls a fixed set of reported links and reports the share still live found none. The only
  comparable published figure opened is Linkody's own June 2026 study of 865,000 *monitored* links (56% live and correct), which
  measures a different population — links users chose to track, not links an index reports. **Treat 91.7% as unverified**; §5(a)'s
  B10-2 makes our own version of that number measurable per customer, which is the honest answer.
- **"Ahrefs found 49.6% of Semrush's 'live' links dead" — not verified.** The vendor studies that were opened measure *coverage*
  (Semrush 99.48% of domains with data vs Ahrefs 99.14%, Moz 99.03%, Majestic 98.28%, February 2021), not liveness, and they are
  run by one of the parties.
- **"DataForSEO: 1.85T live links, 90-day cycle."** The live-link count is now **1.98T**, and **nothing on DataForSEO's own page
  states a 90-day cycle** — it now says "updated continuously in real-time". Our own code still carries that claim in a comment
  (`v5/code/Verify_Requests.js`: "DataForSEO's full cycle is up to 90 days"). Left as written, flagged as **unverified** (B10-5).

**Index size is the one dimension nobody can compare honestly, and it should be said out loud.** Ahrefs' 35 T is "External
backlinks **history** records"; Semrush's 43 T is "backlinks" with no liveness qualifier; DataForSEO's 1.98 T is explicitly
**live** backlinks; Majestic publishes "unique URLs crawled" and "unique URLs found", a third unit again. These are four different
things with four different denominators, so "we are 20× smaller than Ahrefs" is as unsupportable as "we are at parity". The only
size statement a customer can act on is **coverage against Google's own sample** — and that is the one we already compute and
nobody else offers (see §3).

---

## 2. What the leaders do, mechanism by mechanism

**Freshness is published as a rule, not as an adjective.** Majestic states the window (120 days), the cadence ("frequently
throughout the day"), the live date range and the minutes since the last update, on a public page. Semrush states the retention
rule (dropped after six months undetected) and the refresh ("at least hourly"). Ahrefs states both the headline (15–30 minutes)
*and* the honest limit (a complete refresh takes about two months; a low-rated page may be re-crawled once in that time). Linkody
states the per-link cadence (24 h) and the separate cadences for discovery (weekly) and Google index status (14 days). **In every
case the customer can work out how old the answer in front of them is.**

**Lost links.** The index tools say "lost" and then explain, in a help article, that four of their eight reasons do not mean the
link is gone. Linkody's answer is the other one: it re-fetches every monitored link every 24 hours and reports the page's own
state. Neither re-verifies an index's "lost" claim against the page before showing it to you.

**Spam.** Semrush shows a 0–100 toxicity **with the markers that produced it** on hover — 45+ markers, weighted. Moz publishes
a Spam Score built from a model trained on penalised sites (its own pages could not be fetched from this environment — see §7 —
so nothing here rests on Moz). Google's position is the one that decides what any of it is for: most sites should not disavow at
all, and only after a manual action has happened or is likely.

**What they refuse to do.** None of them tells you a link is gone *from the page* unless something fetched the page. None of them
claims its index is complete. Ahrefs, uniquely, documents the cases where its own word should not be believed — which is the
behaviour to copy, and the behaviour that this area has already been built around since the peppol.org incident.

---

## 3. What we do, from the live evidence

| Surface | Evidence |
|---|---|
| Weekly light watch (Mon 07:30) + monthly full report | exec **529** (2026-10-13, on demand, full, $0.37, `files/bl-report-529.txt`), execs **558 → 559 → 564** (2026-10-14, full, 54 s, $0.3728 measured) |
| `free_only` mode ($0) | `BACKLINKS_SPEC.md` §5c F1–F4 |

**At or above the leaders already** (read in the code, seen in both runs):

- **Every source merged, with the overlap shown** (4B.1). DataForSEO + Bing Webmaster + the Search Console links upload + GA4
  referrals + the Common Crawl graph + Wikipedia + Hacker News + GDELT + web search, keyed by registrable domain with hosting
  platforms kept separate (`LK.refKey`). Exec 564 printed the per-source table, "only this source" per row, and — once O7 was done
  — **the share of Google's own sample each source sees** (`dfs_sees_google`, `all_see_google`). No leader publishes a per-account
  coverage figure against Google's sample, because none of them has the upload.
- **Our own link check, and a loss that needs two misses with a reason** (4B.2 / 4B.3). Up to 220 pages a full run, 60 on a light
  run, fetched free; `LK.verify` reads rel, placement by whole class tokens, noindex, canonical, bot challenge and
  JavaScript-only shells. A bot wall or a JS shell is **"not checked", never lost**. Exec 564: *"every linked page works"*, no
  false "lost", and peppol.org — the link DataForSEO once reported lost while it was live — at the top of best links.
- **The link-farm gate** (4B.5, D3 / P1-2 / G18-1): 17 pages set aside on exec 564 with the reason named, out of best links, out
  of "lost", out of the referring-site drop alert, on the disavow candidates **for review only**, with Google's own position
  quoted. Measured 100% precision / 100% recall over 34 labelled cases (`ACCURACY_SET.md`).
- **Three values per link, with hard gates** (4B.4): SEO / referral / brand, each refusing separately; `free_only` runs say
  "Authority 0 · DR" rather than printing a zero as a measurement.
- **Review-only disavow** (4B.5): exactly Google's published rule, in Google's own terms.
- **Comparisons refuse when the two snapshots are not alike** (B-L5): a `free_only` snapshot is never differenced against a paid
  one, a snapshot whose `mode` nobody recorded is refused rather than assumed paid, and what was not compared is printed where the
  arrow would have been. Verified in the code this morning.

**What was wrong this morning** — four things, and three of them are the same mistake: *a figure in front of a customer that does
not say what it is*.

1. **Freshness was stated nowhere.** The report prints a date ("2026-10-13 · changes since 2026-10-12") and then prints
   everything else as if it described today. Most of it does not: the index's own `last_seen` per link was parsed, stored and
   never read, and `last_seen` on the ledger row is the maximum over every source *and our own fetch*, so it could not have been
   used for this even if someone had tried. Ahrefs needs up to two months to re-crawl the whole web; Majestic prints its window on
   the page; we printed nothing.
2. **Criterion 4B.2's own number was computed by nobody.** The criterion is "≥ 90% of links reported live are live", by our own
   re-check. Exec 529 printed **"Checked on the page 1"** over **"18 checked this run"** — two different denominators, no rate,
   and nothing said what happened to the other 17. `coverage.blocked` was computed in `Parse Backlinks` and **shown to no one** —
   the same shape as B-A6's `run_cost_estimate_usd`.
3. **The anchor block was two sets pretending to be one, and the spam tile graded a number against a band we invented.** The
   percentages came from the ledger; the table came straight from DataForSEO's anchors endpoint with no gate at all, so the farm
   anchor *"High Quality Dofollow Backlinks DA 50 PA 40 Premium PBN Network Service"* (17 referring domains) was printed inside a
   table whose percentages above it had excluded it (noted in `RESULTS.md` 2026-10-14 §2.7, never numbered). The rule of thumb
   under it — "keyword anchors are over 30%" — was a constant with no source. And the headline tile read **"Spam score 63/100 ·
   high"**: the index's own 0–100, graded by our own ≥ 40 threshold, while DataForSEO's documentation defines the field and
   **publishes no bands at all**.
4. **An index's silence was recorded as a loss — and the link it happened to was the one link nobody ever checked.** Two halves,
   each harmless alone:
   - `Parse Backlinks`: a referring site no source had seen for 120 days became `status: 'lost'`, reason `not_seen`, with **no
     page ever fetched**. It never entered `lostNow`, so there was no alert and no row in the lost table — it simply left
     `liveRows`, made the headline referring-site count smaller and fed the drop alert.
   - `Verify Requests`: the check queue filtered `!e.sources.every(s => s === 'wiki' || s === 'hn')`, and **`[].every()` is
     `true`** — so a carried row that *no source reported this run* was dropped from the queue entirely, however valuable it was.
   Together: the rows most likely to go silent were the rows guaranteed never to be looked at, and then the 120-day rule declared
   them lost. That is the peppol.org mistake with the index saying nothing instead of saying "lost". The second half was found by
   the harness while proving the first, and it is visible on the existing S28 fixture: `stablevendors.org`, a link valuable enough
   to be in the light run's budget, had never once been re-checked.

---

## 4. The gap

| # | What the leader does | What we did (before this pass) | Does it change the customer's outcome? | Criterion |
|---|---|---|---|---|
| 1 | Freshness published as a rule and a date range (Majestic), with the honest limit stated (Ahrefs: full refresh ≈ 2 months) | Nothing. The index's own `last_seen` was parsed and never read | **Yes.** "2 referring sites" read as "today" when half the evidence could be two months old | **4B.1** |
| 2 | Linkody re-checks **every** monitored link every 24 h | 220 pages a full run, 60 on a light run, **weekly** — and a valuable link no source reported was never queued at all | Yes, in degree. Our check is deeper (rel, placement, noindex, canonical, JS); theirs is 7× more often | 4B.2 |
| 3 | Index precision inferable only from third-party studies | The inputs existed; the rate did not | **Yes.** It is the one number that says how much of this report is measurement | **4B.2** |
| 4 | Ahrefs names **8** lost reasons and says which four may still be on the page | 4 reasons, each verified by our own fetch; no "redirected away" reason | Partly — **ours are stronger**, because every one of ours was seen on the page. The missing one is a page that now 301s elsewhere | 4B.3 |
| 5 | Semrush shows **which markers** produced a link's toxicity | One opaque 0–100 from the index, graded "high" against our own unpublished threshold, beside 17 links our own check had already set aside with reasons | **Yes.** The screen contradicted itself: "these 17 carry no value" next to a red score computed over them | **4B.5** |
| 6 | Anchor distribution against a real population | A distribution over one set, a table over another, and a 30% threshold with no source | Yes, mildly — it drives an instruction ("ask new links to use your name") | 4B.5 |
| 7 | Nobody calls a link lost without fetching the page | **We did**, after 120 days of index silence, with no alert and a quietly smaller count | **Yes**, and it is this area's founding mistake | **4B.3** |
| 8 | Coverage against Google's own sample | **We do; they do not** | No — **ahead** | 4B.1 |
| 9 | Review-only disavow, farm clusters named with evidence | Done, measured 100%/100% over 34 cases | No — **at or above** | 4B.5 |
| 10 | Unlinked mentions as first-class data | Fetched, verified on the page, scored and fed to prospects | No — **at** | 4B.7 |

---

## 5. What to build

### (a) In reach now — **built in this pass** (build section 79, harness S89)

| Row | What | Size | State |
|---|---|---|---|
| **B10-1** | **The report says how old its own evidence is.** `Link Merge` keeps the index's **own** last sighting per referring site (`dfs_last_seen`, apart from `last_seen`, which every source and our own fetch move); `Parse Backlinks` reduces it to newest / middle / oldest; the report prints one sentence — how old the index's view is, how recently we read the pages ourselves, how many referring sites we have **never** read, and the age of Google's uploaded sample and the Common Crawl release. $0, no new call, no new column (it rides `coverage_json`) | S | **done** |
| **B10-2** | **Criterion 4B.2's number is now measured, and refuses.** `coverage.check` carries fetched / read / unread-**by-reason**, the share of the pages we READ that still carry the link, and the same share restricted to the links the index reports live. A bot wall, a JS-only page or a fetch error counts on **neither** side (Linkody excludes its 13% of crawl errors for the same reason). **Under five readable checks there is no rate at all** — the report prints why instead. The tile is no longer "1" over "18" | M | **done** |
| **B10-3** | **One set for the whole anchor block, and a base rate behind its rule of thumb.** Farms are out of the distribution and the table, counted beside both, and still shown — marked "link farm, set aside". The threshold is judged against the only measured distribution that could be opened (Linkody, 865,000 links, June 2026: keyword 56%, brand 18%, URL 15%, image/empty 10%, generic 1%), printed next to the site's own. The spam tile stops grading the index's 0–100 against a band nobody publishes and says whose number it is and what it was computed over | S | **done** |
| **B10-4** | **An index's silence is no longer a loss, and the silent rows are the ones we go and look at.** 120 days with no source is a loss only when our **own** fetch has already failed on that page; otherwise the row is `at_risk`, keeps its value and its place in the count, is named in the report ("an index that stopped re-crawling a page proves nothing"), and `Verify Requests` raises it to priority **850** — above the valuable rotation, inside a light run's budget. **And the queue no longer drops every row with no source** (`[].every()` is `true`): found by the harness while proving the first half, visible on the existing S28 fixture | M | **done** |

Measured effect on the shape of exec 529's own report: *"Checked on the page **1** · 18 checked this run"* and *"Spam score
**63/100 · high**"* become *"Checked on their page **5 of 7** · 9 fetched · 2 could not be read"*, *"Of the 7 referring pages we
could read, **5 still carry the link (71%)**, and of the 6 the DataForSEO index reports live, 4 are live (67%). 2 page(s) could
not be read (bot wall 1, needs JavaScript 1) and count on neither side"*, *"The link index last saw these links between 2 days ago
and 88 days ago (middle: 14 days ago)"* and *"Spam score (the index's) 63/100 — reported by DataForSEO over 20 links"*.

### (a) In reach now — **not built in this pass**

| Row | What | Size | Why not now |
|---|---|---|---|
| **B10-6** | **A "redirected away" lost reason** (Ahrefs' 301/302 case): the linking page now redirects somewhere that does not link back. Needs the final URL from the fetch (`fullResponse`), which touches the HTTP node and `retry_lint`'s territory | S | A different node and a different lint; it belongs with whoever next touches *Fetch Linking Pages* |
| **B10-7** | **Print the loss base rate beside our own.** 52% of links die within a year (Linkody, 865,000 links): a customer who loses two links in a quarter has no idea whether that is normal. One sentence in the lost section, $0 | S | The lost section was already rewritten twice today; better as its own change with its own fixture |

### (b) Needs money or an owner decision

| Row | What | Cost | Who decides |
|---|---|---|---|
| **B10-8** | **Daily re-checks instead of weekly** (Linkody's 24 h cadence, gap 2). The fetches themselves are **free**; what it needs is a daily schedule, the concurrency gate (B-A9) and an always-on host — it is **D25a** wearing a different hat | $0 in API spend; needs D25a | **Owner** (same decision as D25a) |
| **B10-9** | **A second index for coverage** (Majestic's Fresh Index is the one with a published freshness rule and an API). It would make "% of Google's sample seen" a two-index figure and give a second opinion on a "lost" | Majestic Lite ≈ $50/month list price (**not verified** — its pricing page was not opened in this pass); Ahrefs' API is enterprise-priced | **Owner.** Recommended **no** until a customer asks: our own fetch already beats any second index at the question that matters |
| **B10-10** | **Ahrefs DR for every referring site, not just a sample.** The free endpoint is already wired (`SEOcredAhrefsDR`) and returns DR; wider use needs the owner's reading of the free tier's limits | $0 within the free endpoint, unknown above it | **Owner** |

### (c) Deliberately not worth it

| What | Why not |
|---|---|
| **A spam score of our own, 0–100** | We would be printing a second number that disagrees with the index's, and a band nobody can check. What the customer can act on is the **reason** — "the same page path on 16 sites", "a gambling site" — which we already give, per link, which is more than Semrush's hover shows and far more than a number |
| **Competing on index size** | The published figures are four different units (history records / unspecified / live / URLs crawled) and all are marketing. The comparable measurement is coverage against Google's own sample, which we have and they do not |
| **Automating disavow** | Google: "most sites don't need it", and only after a manual action. Automating it would be automating the one action Google warns can hurt you. Review-only stays |
| **A "link velocity" or "link health" index** | A chained score across months was exactly R20's and B-L5's failure in another area. The per-source counts, the freshness line and the measured rate are each checkable; a composite of them would not be |
| **Alerting on an index's "lost" before our own check** | The founding mistake of this area. The at-risk line exists so the customer sees it a week early without being told something false |

---

## 6. The single change that would most improve the customer's outcome

**Say how old every number is and how much of it we measured ourselves — because a backlink report is one crawler's memory of the
web plus our own fetch, and until today it printed both in the same font with no date on either, while the one link it had already
been wrong about was the reason the whole system verifies anything at all.**

---

## 7. Sources opened in this pass

[ahrefs.com/big-data](https://ahrefs.com/big-data) ·
[help.ahrefs.com 78052 (update frequency)](https://help.ahrefs.com/en/articles/78052-how-often-is-ahrefs-links-database-updated) ·
[help.ahrefs.com 920461 (lost reasons)](https://help.ahrefs.com/en/articles/920461-understanding-link-lost-reasons) ·
[semrush.com/analytics/backlinks](https://www.semrush.com/analytics/backlinks/) ·
[semrush.com/kb/965 (toxicity)](https://www.semrush.com/kb/965-backlink-analytics) ·
[semrush.com/blog/biggest-backlink-database-study](https://www.semrush.com/blog/biggest-backlink-database-study) ·
[majestic.com/support/glossary](https://majestic.com/support/glossary) ·
[linkody.com](https://www.linkody.com/) ·
[linkody.com/en/plans](https://www.linkody.com/en/plans) ·
[blog.linkody.com link-building statistics 2026](https://blog.linkody.com/seo/link-building-statistics-2026-2) ·
[dataforseo.com/apis/backlinks-api](https://dataforseo.com/apis/backlinks-api) ·
[docs.dataforseo.com backlinks summary](https://docs.dataforseo.com/v3/backlinks/summary/live/) ·
[developers.google.com spam policies](https://developers.google.com/search/docs/essentials/spam-policies) ·
[Search Console help: disavow](https://support.google.com/webmasters/answer/2648487?hl=en)

**Could not be opened:** moz.com (blocked from this environment), so **nothing in this document rests on Moz** — its Spam Score is
mentioned only as a thing that exists. **Could not be found:** any independent 2025–2026 study measuring the share of a backlink
index's "live" links that are actually live.

---

## 8. Proposed register rows (for `FIX_PLAN.md` §3.14 — the orchestrator moves these; this file does not edit the register)

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B10-1 | **The report never said how fresh anything was**, while the index behind most of it only ever means "live when I last crawled" — Ahrefs states its own complete refresh "takes about two months", Majestic publishes a 120-day window and its date range, Semrush drops links undetected for six months, Linkody re-checks every 24 h. The index's own `last_seen` was parsed into the entry, stored on the row and read by nothing, and the row's `last_seen` is the maximum over every source *and our own fetch*, so it could not have answered this anyway | Medium (4B.1) | `v5/code/Link_Merge.js`, `Parse_Backlinks.js`, `BL_Report.js`; build §79 | `dfs_last_seen` kept per referring site apart from `last_seen`; `coverage.freshness` carries newest / middle / oldest for the index, our own median / oldest / never-read, and the age of the Search Console upload and the Common Crawl release; the report prints one sentence and the lineage block carries both as `reported` and `measured`. $0, no new call, no new Data Table column | fixed 2026-10-15 (build section 79, S89); not deployed |
| B10-2 | **Criterion 4B.2's own figure was computed by nobody.** The criterion is "≥ 90% of links reported live are live, by our own re-check"; the report printed *"Checked on the page 1"* over *"18 checked this run"* (exec 529, 2026-10-13) — two denominators, no rate, and no word about the other 17 — while `coverage.blocked` was computed in Parse Backlinks and shipped to nobody, the same shape as B-A6 | **High** (it is the number that says how much of the report is measurement) | `v5/code/Parse_Backlinks.js`, `BL_Report.js` | `coverage.check`: fetched / read / unread **by reason**, the share of the pages we read that still carry the link, and the same share over the links the index reports live; bot walls, JS-only pages and fetch errors count on neither side (as Linkody's own study excludes its 13% of crawl errors); **no rate at all under 5 readable checks**, with the reason printed instead | fixed 2026-10-15 (build section 79, S89); not deployed |
| B10-3 | **The anchor block was computed on two different sets, and the spam tile graded the index's number against a band nobody publishes.** A link farm's anchor ("High Quality Dofollow Backlinks DA 50 PA 40 Premium PBN Network Service", 17 referring domains, exec 564) was printed inside a table whose own percentages excluded it; the ">30% keyword anchors" instruction under it was an unsourced constant; and "Spam score 63/100 · **high**" applied our own ≥ 40 threshold to DataForSEO's 0-100, whose documentation defines the field and publishes no bands, on the same screen as 17 links our own check had already set aside | Medium | `v5/code/Parse_Backlinks.js`, `BL_Report.js` | one set for both halves (farms out, counted beside, still shown and marked "link farm, set aside"); the distribution printed against Linkody's measured population of 865,000 monitored backlinks, June 2026, named with its URL; the tile says whose 0-100 it is and over how many links, instead of grading it | fixed 2026-10-15 (build section 79, S89); not deployed |
| B10-4 | **An index's silence was recorded as a lost link, and the rows most likely to go silent were the rows guaranteed never to be checked.** 120 days with no source set `status: 'lost'`, reason `not_seen`, with no page ever fetched, no alert and no row in the lost table — it simply left the referring-site count and fed the drop alert. The other half, found by the harness while proving the first: *Verify Requests* filtered `!e.sources.every(…)` and **`[].every()` is `true`**, so any carried row no source reported this run was dropped from the check queue entirely, however valuable (`stablevendors.org` on the S28 fixture had never been re-checked once) | **High** (this area's founding mistake, in a new place) | `v5/code/Parse_Backlinks.js`, `Verify_Requests.js`, `BL_Report.js` | a silence is a loss only when our own fetch has already failed on that page; otherwise `at_risk`, value and count kept, named in the report with the reason it is not a loss, and raised to priority 850 in the check queue — above the valuable rotation, inside a light run's budget (INVARIANTS rule 2: the status one path writes is read by the other). The queue keeps rows with no source at all | fixed 2026-10-15 (build section 79, S89); not deployed |
| B10-5 | **An unverified vendor claim in our own code and in the rubric**: `Verify_Requests.js` states "DataForSEO's full cycle is up to 90 days" and CRITERIA 4B cites "1.85T live links, 90-day cycle". DataForSEO's own page now says 1.98 T live backlinks and "updated continuously in real-time", and states no cycle length. Also unverified: 4B's "91.7% of reported links still live (The Upper Ranks 2025)" and "Ahrefs found 49.6% of Semrush's live links dead" — no independent 2025-2026 liveness study was found | Low | comment in `v5/code/Verify_Requests.js`; the rubric statement is frozen and must not be edited | ask DataForSEO support for the recrawl cadence in writing, or drop the number from the comment; B10-2 makes our own liveness measurable per site, which is the figure that replaces the unverifiable one | **open** (documentation, ~S) |
| B10-6 | **No "redirected away" lost reason** (Ahrefs' 301/302 case): a linking page that now redirects somewhere that does not link back is reported as "link removed" | Low | *Fetch Linking Pages* / `LK.verify` | keep the final URL from the fetch (`fullResponse`) and report "the page now redirects to X" as its own reason | **open** (in reach, ~S) |
| B10-7 | **The lost section states no base rate**, so a customer losing two links in a quarter cannot tell whether that is normal — 52% of links die within a year (Linkody, 865,000 monitored links, June 2026) | Low | `BL_Report.js` | one sentence beside the lost table, with the study named, as B1-3 does for click loss | **open** (in reach, ~S) |
| B10-8 | **Weekly re-checks against Linkody's 24 h.** The fetches are free; what it needs is a daily schedule, the concurrency gate and a host that is always on | Medium | schedules | daily light re-check of the valuable and at-risk links | **owner decision** — $0 in API spend, but it **is** D25a |
| B10-9 | **No second index.** Majestic is the one with a published freshness rule and an API | Low | `BL Requests` | add Majestic Fresh Index as a source in the merge | **owner decision**: ≈ $50/month list (**not verified**). **Recommended: no** — see §5(c) |
| B10-10 | **Ahrefs DR only for a sample of referring sites**, though the free endpoint is already wired | Low | `DR Requests` | widen once the free tier's limits are read | **owner decision** |
