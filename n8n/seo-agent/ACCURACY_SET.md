# The accuracy set — measured precision for audit findings and backlink spam labels

**Item G18 of `docs/system-review-2026-10-11/FIX_PLAN.md`.** The 2026-10-11 review spot-checked seven audit findings by hand
and found five of them true, and it found that only 4 of 16 link-farm pages were flagged. Those were one-off checks. This is
the repeatable version: a set of real cases with a human label, checked into the harness, replayed through the real node code
on every harness run, with a number that fails the build when it drops. It has already paid for itself: it found **G18-1**
(a search-results page ranked as a site's best link) and measured **G18-2** (a quarter of the findings shown were not worth
reading), both fixed on 2026-10-13 — see §1 and §6.

| | |
|---|---|
| The set | `harness/accuracy/findings.json` (53 audit cases), `harness/accuracy/links.json` (34 spam cases) |
| The evidence | `harness/accuracy/sites/*.json` — three sites captured with free public fetches on 2026-10-12 |
| The scorer | `harness/accuracy/score.js` — offline, runs the real nodes, no network and no paid API |
| The gate | harness scenario **S49**: precision ≥ 95% for audit findings and for spam labels, every finding labelled, best-link precision 100%, useful precision of the folded list ≥ 95% |
| The capture tool | `harness/accuracy/capture.js` — run by hand, never by the harness |

## 1. Measured on 2026-10-13 (after G18-1 and G18-2; first measured on 2026-10-12, branch tip `297314b`)

| Category | Cases | Precision | Recall | Detail |
|---|---|---|---|---|
| **Audit findings** | 53 | **100%** (30 true, 0 false) | 100% (0 missed) | 13 findings that would be wrong on these sites are correctly suppressed; 10 cases are *cosmetic* |
| **Backlink spam labels** | 34 | **100%** (16 of 16 link-farm sites) | 100% | 18 genuine referring sites, none mislabelled |

Per site: techand.ai 8 findings shown (7 true, 1 cosmetic, 6 suppressed), peppol.org 25 (22 true, 3 cosmetic, 2 suppressed),
azdan.com 7 (1 true, 6 cosmetic, 5 suppressed).

**The second number, reported and not gated: useful precision 75% of everything the audit holds, 95.5% of the list a customer
reads.** Precision asks whether a finding is *true*; useful precision also counts the findings that are true but not worth a
customer's time. Ten of the forty shown are in that class. Since **G18-2** (2026-10-13) the minor band is *folded*: 18 of the
shown findings (9 of those 10 cosmetic ones, and 9 true but lowest-impact ones) are collapsed into one "Minor items (N)" line
in both audit reports and in the app, so the list that is read first is 21 true findings against 1 cosmetic — 95.5%. Nothing
is removed: the folded findings keep their score, their stored row and their place inside that line, which is why precision
and recall are unchanged. Minor items per site: techand.ai 2 findings (3 of the keys shown), peppol.org 2 (9), azdan.com 2
(6) — azdan.com, the near-clean site, goes from 14.3% useful precision to 100%.

For backlinks the same second number is **best-link precision 100%** (was 50% before **G18-1**): techand.ai's best link is
now the OpenPeppol members list alone (SEO value 35). The search-results page `robuta.com/?q=business+impact` is labelled
`scraper`, capped at 5 and kept out of the best-link lists — and still not called spam, so it stays out of the disavow
candidates (§6).

Every number above is printed by S49 and written to `harness/sample-output/accuracy-scores.json` on each run.

## 2. What the set covers

**Audit findings.** Everything the audit decides *from evidence we fetch ourselves*: the canonical host (D6), duplicate meta
tags verified on the homepage (D18), cacheability, security headers, robots.txt, the sitemap, llms.txt, crawler access, and
every page-level rule over a page's own measurements (titles, descriptions, H1s, Open Graph, word count, link counts, URL
shape), plus the four crawl flags that can be justified from the saved evidence. The three sites are techand.ai (the review's
customer site: Next.js on Vercel, apex 308 to www, the three `theme-color` tags, live placeholder text), **peppol.org**
(OpenPeppol: WordPress, www 301 to the apex, an empty `Disallow:`, no llms.txt, ClaudeBot blocked by the CDN, pages with no
description and no H1) and **azdan.com** (a UAE NetSuite partner: Webflow behind Cloudflare, apex 301 to www, a full
llms.txt, every crawler served, nav-heavy pages). Two host patterns, three stacks, one site with real faults, one nearly clean.

**Spam labels.** The 16 referring sites of the real link farm (one sold page path `/all/2835/13.html`, the anchor "High
Quality Dofollow Backlinks DA 50 PA 40 Premium PBN …", casino and restaurant hosts) against 18 genuine referring sites: the
OpenPeppol members list that really links to techand.ai, its GA4 social referrals, a search engine's results page, and 14
real referring sites of a competitor (the Ministry of Finance's accredited-provider list, a vendor's "Top 20" listicle, a
newspaper, the World Economic Forum, a law firm, a listicle host, a `.club` community, the competitor's own sister domain).
The genuine side is deliberately loaded with the shapes a footprint rule gets wrong: list pages, directories, index spam
scores of 24-28, and names containing "toplists" or "bet".

## 3. How a case is labelled

A case is one decision a customer can check, and the label is the judgement a careful person gives after looking at the
evidence. `finding` is `category|title` for a site-wide finding and `category|title@url` for a finding on one page, because
that is what someone clicking it verifies.

| Label | Meaning | Effect on the score |
|---|---|---|
| `true_positive` | The finding is shown and the claim is true. | counts in precision and recall |
| `false_positive` | The finding would be wrong on this site: it must not be shown. | counts as a false positive **if it is shown**, otherwise as correctly suppressed |
| `cosmetic` | The claim is true, but it is not worth reporting (a 61-character title, a blog index with "too many links"). | left out of precision, counted and listed, and counted in *useful* precision |

For links the labels are `spam` and `genuine`, plus the flag `low_value` for a genuine link that is worth nothing for SEO.

Every case carries a `reason` in plain words and a `source`: a field of the site fixture, a live check with its date, or the
section of `RESULTS.md` / `LIVE_CHECK_phase1_2026-10-12.md` / the execution that produced it. A case with no checkable source
does not belong in the set.

## 4. How to add a case, or a site

**A new finding.** S49 fails with `UNLABELLED` and the finding's key. Look at the site fixture, decide the label, and add a
case to `findings.json` with a reason and a source. A finding can only ship once somebody has judged it — that is the point.

**A new site** (free, a few seconds, no paid API):

```bash
cd n8n/seo-agent/harness
docker cp accuracy/capture.js n8n-n8n-1:/tmp/capture.js
docker exec n8n-n8n-1 node /tmp/capture.js example.com /pricing /about > accuracy/sites/example-com.json
```

The capture performs exactly the audit's own probe plan (apex and www, http and https, redirects not followed; the homepage
twice, robots.txt, sitemap.xml, llms.txt, a Markdown request; the 11 crawler user-agents) plus one GET per page named on the
command line. It stores **only what the audit reads**: statuses, the headers it looks at, the homepage `<head>` with the
`<script>` blocks removed, robots.txt and llms.txt as served, the sitemap's `<loc>` list, each response's measured length, and
the per-page measurements. Third-party page text is not stored, and every stored string goes through an e-mail / telephone
redaction pass, because the repository is public. Then add the file to `findings.json`'s `sites`, run the report
(`docker exec n8n-n8n-1 sh -c 'cd /tmp/harness-3c && CODE_DIR=/tmp/harness-3c/code_v4 OUT_DIR=/tmp/harness-3c/out node accuracy/score.js'`)
and label what it prints.

**Crawl flags.** DataForSEO's own page flags are not captured (they need the paid crawl). Only flags that can be justified
from the saved evidence are set, and each page says why in `checks_from`: `no_description` and `no_h1_tag` are measured on the
fetched HTML, `lorem_ipsum` was seen on the live page, and `duplicate_meta_tags` is set on each homepage so that **our own**
verification of it (D18) is what gets scored. Everything else is left unset, so no finding that depends on the paid crawl
alone can fire — which is also why this set does not measure the crawl's pass-through findings (§5).

## 5. What a failure means

* **Precision below 95%** — the audit (or the ledger) is making a claim a human called wrong. The scenario prints the case id
  and the finding's own evidence. This is the regression gate for D3, D6, D18, P1-2 and G18-1: each of those defects has cases
  here, and re-introducing one fails S49 by name.
* **`UNLABELLED`** — a finding changed its title or a new one appeared. Judge it and add the case.
* **Recall below 100%** — something a human called true is no longer reported. A suppression went too far. The fold (G18-2) is
  not a suppression: a folded finding is still emitted, so recall and precision cannot move because of it. S49 also gates the
  useful precision of the folded list at 95% and that it beats the unfolded number — if a fold ever started hiding true
  findings instead of cosmetic ones, that check would fail while recall stayed at 100%.
* **Best-link precision below 100%** — a link worth nothing is being called one of the site's best (G18-1). Reported with the
  domains, next to the gated numbers.
* The per-site numbers move when a site changes its markup. Re-capture the site, re-read the labels, and say so in the commit:
  the set measures the system against three real sites on a date, not against a frozen mock.

## 6. Where the set is thin, and what it found

Honest limits:

1. **Three sites, all technically healthy.** No broken pages, redirect loops, expired certificate, soft 404, HTTP-only host or
   blocked-by-robots site is represented, so the Critical end of the audit is unmeasured. Precision of 100% is precision over
   *these* cases — a stratified sample of real decisions, not an unbiased estimate of field precision.
2. **The paid crawl's own flags are a pass-through and are not scored** (§4). The 2026-10-11 review checked several of them by
   hand and found them accurate; only `lorem_ipsum` is in the set.
3. **The Search Console findings are not in the set.** Index coverage, the query tables and the scraper-query rule need a live
   Search Console property; S32 / S36 / S43 cover them with fixtures instead.
4. **The Link Analyst's own spam label is represented by one case** (seonix.agency, whose stored label the ledger carries) and
   no case exercises the model itself.
5. **18 genuine link cases, 14 of them without a page URL or anchor**, because that is all DataForSEO's referring-domain data
   gives. They prove the gate never labels a domain spam on an index score alone, but they do not stress the cluster rules.
6. **Nothing here measures severity or priority** — only whether a claim is true.

Found by the set, and fixed on 2026-10-13:

* **G18-1 · A search-results page was ranked as the site's best link.** robuta.com's `/?q=business+impact` page got SEO value
  57, above the OpenPeppol members list at 35, because nothing marked a search-results page of an unknown host as a scraper
  unless the Link Analyst happened to say so (`LK.isScraper` only knew whois / stats / valuation hosts, and `LK.values` caps
  `link_type: 'scraper'` at 5 — the cap was never reached). It was the same mistake D3 fixed for link farms, one step on.
  **Fixed:** `LK.isSearchPage` (`v5/code/_link_kit.js`: a path segment `search` / `suche` / `recherche` / `busca`, a search
  script, or a query key that carries the search term — `?q=`, `?s=`, `?query=`, `?search=`, `?keyword=`, `?term=` …) plus a
  label beside the footprint gate in `v5/code/Parse_Backlinks.js`: such a page becomes `link_type: 'scraper'` when neither the
  host's own name nor its page title matches the site's topics and no analyst or source label exists, so the cap of 5 applies
  and brand value is 0. Two bounds keep a real link safe: an on-topic host keeps its value, and an existing label is never
  overwritten. The footprint gate is untouched, so a search page is never a link farm — it stays genuine, out of the disavow
  candidates and out of the lost / reclaim lists. The "best links" lists also drop every capped type (`spam`, `scraper`): a
  capped 5 is not a best link. *Evidence:* S49's "best links" line (50% → 100%), case `LK-20`.
* **Ten cosmetic findings out of forty shown (useful precision 75%) — now folded.** Three rules produce most of them: "Too
  many links on one page" fires on every nav-heavy page (173 links on a homepage, 353 on a blog index — it counts the
  site-wide menu and footer, not the links inside the content), "Title longer than 60 characters" fires one character over,
  and "Light content (300-500 words)" fires on section index pages whose job is to link onwards. "Duplicate meta tags" counts
  `<meta generator>`, which no search engine reads, and "Long or messy URLs" asks for a rename that would cost a published
  article its rankings. None of them is wrong; all of them cost the reader attention. **Fixed (G18-2):** `IMP.isMinor` /
  `IMP.fold` (`v5/code/_impact.js`) mark the minor band — Low or Info severity, never an index blocker, impact at most 0.9 or
  one of those four measured rules up to impact 3 — and both audit reports collapse them into one "Minor items (N)" line with
  the count and the reason (the Action Plan counts them instead of repeating them, the full report folds per area). The app
  does the same with the same rule over the stored severity and impact (`app/shared/src/findings.ts`, the mirror of
  `_impact.js`), and `minor_count` / `minor_note` travel in the audit callback. Nothing is suppressed: the findings keep their
  penalty in the score and their `seo_audit_findings` row, which is why precision and recall did not move; what changed is
  the useful precision of the list that is read first (75% → 95.5%, §1). The remaining cosmetic finding in the main list is
  peppol.org's Medium "Duplicate meta tags" — a Medium is never folded, and counting `<meta generator>` is its own fix.

Still open from the set: nothing of its own. The three sites' limits above (no Critical end, no paid crawl flags, no Search
Console findings) are what to widen next.

## 7. Re-measuring

S49 runs on every harness run, so the numbers in §1 are re-measured continuously against the stored fixtures. For the
re-rating in `FIX_PLAN.md` §5.2, re-capture the three sites first (§4) so the measurement is against the sites as they are
that day, then copy the per-category numbers from `harness/sample-output/accuracy-scores.json` into the scores history.
