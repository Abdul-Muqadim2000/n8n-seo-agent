# Benchmark area 4 — content cadence / publishing pipeline

**Written 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score at the last rating: **5.5/10**
(`../system-review-2026-10-13/SCORECARD.md` §2.4). Frozen criteria: `../system-review-2026-10-11/CRITERIA_keywords_content.md`
Area 2, criteria **C14 (cadence with scale safety), C15 (decay detection and refresh), C16 (publish and measure loop)**.

> **Read the code, not the 2026-10-13 scorecard.** That 5.5 was given before R1, R13, R15, D5 and G33 landed. Everything in §3 was
> read in the source of `v5/code/Cadence_Plan.js`, `Parse_GSC.js`, `Site_Metrics.js`, `Page_Inventory_Site.js`, `_site_stats.js` and
> `app/server/src/services/cadence.ts` as they stood this morning, and against the two live runs' own output.

> **Contradiction of the brief, at the top.** The brief said the register is a hypothesis and the code is the evidence. Two things
> the brief implied were not what the code said:
> 1. **"Decay detection: be honest about what Search Console data we actually have."** We had more than the brief assumed and were
>    using less. `Site_Plan.js` has computed a **`yoy` range — the same 28 days one year earlier — since v4.3**, and `GSC_Requests.js`
>    already asked for it. It asked for **one row, site-wide totals only** (`req('yoy', {…, rowLimit: 1})`). The per-page year-ago
>    comparison the leader is built on cost **one more free request** and sixteen months of Google's retention were sitting there
>    unused. That is now B4-1 and it is built, not registered.
> 2. **The 2026-10-13 scorecard gave C15 a 6 for "decay and refresh actions live".** The decay *verdict* was live. Nothing in the
>    system could act on it: `decaying_pages` was computed inside one Site Tracker run, printed in the weekly e-mail as a
>    **priority-3** line, and then discarded — it reached no table, and the Content Cadence's four candidate sources
>    (`ladder`, `striking`, `trend`, `ai_answer`/`ai_refresh`) never contained it. C15's own 10-anchor asks for "alert **+ scheduled
>    substantive refresh**". We had the alert and no refresh. Honest score for C15 before today: **4**, not 6.

---

## 1. The leader today — and whether the rubric still names it

The rubric names **Clearscope (inventory, decay)**. It is still the right comparison, and it is still the only one of the four that
publishes the mechanism rather than the outcome.

| Leader | Status checked 2026-10-15 | Source opened |
|---|---|---|
| **Clearscope** | **Alive and priced publicly.** Essentials **$129/month = 50 tracked queries and 50 pages**; Business **$399/month = 300 queries and 300 pages**; Enterprise custom. Extra pages sold in blocks (≈ $25/mo on Essentials, $15 on Business) | [clearscope.io/pricing](https://www.clearscope.io/pricing) |
| Clearscope **Content Inventory** | Per page: an auto-assigned **Target Query** (overridable), a Content Grade, **total impressions, clicks over time and average position for that query**, an **SEO value = GSC clicks × average CPC**, internal-link counts and suggestions, and annotations. Fed by a linked **Search Console** property. It "automatically scan[s] and reevaluate[s] your content **monthly**" and sends a **weekly Monday Alert** e-mail | [clearscope.io/support/getting-started-content-inventory](https://www.clearscope.io/support/getting-started-content-inventory) |
| Clearscope **Content Decay** (view) | Compares a page's clicks over **90 days against the same 90-day window from the previous year**, printed as **"seasonal difference"** and **"seasonal growth"**, beside a **12-month sparkline** so a dip can be told from a decline. **No numeric threshold**: "negative numbers suggest potential decay worth investigating further" | [clearscope.io/support/content-decay](https://www.clearscope.io/support/content-decay) |
| Clearscope **Content Decay** (report) | A second cut: **"Decay is the absolute value of clicks lost between the peak traffic month and the previous full month"**; **Pct = lost ÷ peak**; **"We sort Content Decay by the greatest number of clicks lost"**. No minimum volume, no minimum percentage | [clearscope.io/blog/content-decay-report](https://www.clearscope.io/blog/content-decay-report) |
| Clearscope **Content Views** | Saved filters over the inventory ("monitor content at scale"), with starter views such as **Best Opportunities** (grade below B+), Internal Linking and Technical Issues. Introduced June 2024, starter views August 2024 | [support topic](https://www.clearscope.io/support/topics/content-inventory), [June 2024 updates](https://www.clearscope.io/blog/june-2024-product-updates) |
| **Ahrefs** (the sharpest published *rule*) | Site Explorer → **Top Pages, filtered for declining traffic over 12 months**, with a **KD < 40** filter so pages losing to link authority are skipped. Quarterly: **"flag any pages that have dropped more than 20% in traffic year-over-year"**. Refresh the **top 20% of pages by traffic** first. It separates **"traffic declined with no preceding changes … classic decay"** from a drop that followed an edit, which is a degraded page to compare before and after | [ahrefs.com/blog/content-decay](https://ahrefs.com/blog/content-decay/), [ahrefs.com/blog/fresh-content](https://ahrefs.com/blog/fresh-content/), [ahrefs.com/blog/republishing-content](https://ahrefs.com/blog/republishing-content/) |
| **Semrush** (process, not a tool) | A manual seven-step audit over GSC (last 3 months vs the previous period) and GA4 (90 days). Update triggers: declining traffic, weak E-E-A-T, content gaps, structure — plus **age**: "If a page is older than six months, consider updating it regardless of quality to keep LLMs citing it." Explicitly says to allow for **algorithm updates and seasonality** ("B2B websites typically see a traffic dip during late November and December"), and **"wait at least two months"** before re-measuring a refresh. Audit cadence: quarterly, and after core updates | [semrush.com/blog/content-audit](https://www.semrush.com/blog/content-audit/) |
| **Siteimprove.ai Content Strategy** (what MarketMuse became) | The closest thing to a *refresh-vs-create planner*: it "map[s] your content landscape, show[s] you what to create, refresh, or optimize … what you have, what's working, what's missing", and turns that into "a prioritized plan and briefs". **It publishes no decay mechanism at all** — nothing about declining performance over time or how it would be detected | [siteimprove.com/marketmuse](https://www.siteimprove.com/marketmuse/) |

**Verdict on the rubric: keep Clearscope.** Two notes to carry forward (the CRITERIA files stay frozen — these are the new
statements beside the old ones, per programme rule 1):

- **C15's anchors say "alert + scheduled substantive refresh".** That is still the right bar and it is *above* what Clearscope does:
  Clearscope surfaces the view and you press a button to generate a Draft. Nothing in the market schedules the refresh for you.
- **Clearscope's inventory is licensed per page** — 50 pages at $129/month, 300 at $399. Ours covers every page Search Console
  reports, up to 2,000, at no marginal cost. That is a real advantage and it should be scored as one. *Old statement (2026-10-11):
  Clearscope = Content Inventory + decay alerts. New statement (2026-10-15): Content Inventory capped at 50/300 pages by plan.*

---

## 2. What the leaders do, mechanism by mechanism

1. **An inventory with a time series per page.** Clearscope stores clicks *over time*, impressions and average position per page,
   rescanned monthly, and that store is what every view filters. Decay, striking distance, internal linking and technical issues are
   all saved filters over one table — not four separate reports.
2. **Seasonality is the first control, not an afterthought.** Both of Clearscope's decay cuts avoid a bare period-over-period
   comparison: one is 90 days against the same 90 days a year earlier, the other is peak month against the last full month. Ahrefs'
   published rule is explicitly **year-over-year**. Semrush names the months B2B sites dip in.
3. **Rank by the clicks at stake, not the percentage.** "We sort Content Decay by the greatest number of clicks lost." Ahrefs:
   top 20% of pages by traffic first. A 90% fall on 11 clicks is not the week's work.
4. **Diagnose before prescribing.** Ahrefs separates a decline with no preceding edit (classic decay → refresh) from a decline after
   an edit (degraded → compare before and after), and filters out pages losing to link authority rather than to content.
5. **The view is a worklist.** A Clearscope Draft is generated from the decay view; Siteimprove sells the create/refresh/optimize
   plan as the product. The inventory is where work starts, not where a report ends.
6. **Measure the refresh afterwards.** Semrush: wait at least two months, then re-run the same analysis over the same window.
   Clearscope: page-level annotations record the update so later movement can be read against it.
7. **No thresholds are published, and no significance test exists anywhere.** Clearscope states none; Ahrefs' 20% is a rule of
   thumb. Every one of them will call 10 clicks → 7 a decay. **This is where the leader is weakest, and it is where we can beat it.**

---

## 3. What we do — from the code and the live runs

### 3.1 The cadence itself (C14) — genuinely good, and better than the leaders on safety

`v5/code/Cadence_Plan.js`, exec **572** (2026-10-14, run 19) and exec **506** (2026-10-13, run 19). Both runs did the same thing and
it was the right thing: *"3 written pages waiting for publication (pile-up guard, limit 3): 'erp software uae', 'service industry erp
software', 'azure api management monetization' — publish them to continue"*, with the queue behind the pause intact (4 upcoming
ladder keywords with their rung and head term). Per-ladder Auto/Manual, priority, `max_active`, the main-page gate, the won rule and
the pile-up guard are all in `seo_ladder_settings` and all enforced. R1 holds: only a `written` content-log row counts as a page.
**No leader has a pile-up guard.** C14 is a 7 and deserves it.

### 3.2 Decay (C15) — where the area actually lost its points

The whole rule, as it stood this morning (`Parse_GSC.js:64`):

```js
const decaying = pages.filter(p => p.prev_clicks >= 10 && -p.clicks_delta / p.prev_clicks * 100 >= (cfg.decay_drop_pct || 25))
  .sort((x, y) => x.clicks_delta - y.clicks_delta).slice(0, 10);
```

Three separate problems, each verifiable from the code and the runs:

- **The window cannot tell a decay from a season.** 28 days against the 28 before, and nothing else. `Site_Plan.js` computed a `yoy`
  range and `GSC_Requests.js` asked for it with `rowLimit: 1` — site totals only. The per-page year-ago comparison that both
  Clearscope cuts and Ahrefs' rule are built on was one free request away and was never made.
- **The threshold is the kind of threshold this system spent G28 removing.** `_site_stats.js` opens with the reason: *"28 clicks
  against 20 is a 40% 'fall' that any week could produce by chance (z = −1.18)."* The decay rule's own floor is **10 prior clicks**:
  10 → 7 is a 30% "decay" at **z = −0.73**. The G28 header claims `position()` "replaces the last fixed threshold in the site
  tracking". It did not — `decay_drop_pct` survived it by two days.
- **On the actual customer it could not fire at all.** The Site Tracker of 2026-10-14 (exec **581**) measured **34 clicks site-wide
  over 28 days** (+79%, tested). A page needs 10 prior clicks to be eligible; at most three pages on techand.ai could ever clear
  that, and at that volume the test rejects everything. The weekly report therefore says nothing about decay and cannot say why —
  it prints its hits and is silent about what it checked and refused.

And then the verdict died. `decaying_pages` went into `Site_Metrics.js` as a **priority 3** action (*"Refresh {page}: update facts
and dates…"*, `why: 'Clicks fell from N to M in 28 days.'`) with **no `api_body`** — the striking-distance action beside it ships
`pageBody(...)` so one click writes the page; decay shipped nothing. It reached `seo_pages`? No: `PAGES_COLS` was
`site_id, url, title, h1, source, lastmod, queries_json, updated_at` — **no metric, no history, no judgement**. The Content Cadence
loads `seo_pages` (`Load Pages (Cadence)`) and used it for exactly one thing: D11's "one search, one page" dedupe.

So the loop was: measure → print → forget. C15's 10-anchor is "alert + **scheduled substantive refresh**".

### 3.3 Publish and measure (C16)

`Detect Published` finds pages live from the sitemap and records them (6 candidates, 0 live, exec 515); `URL Inspection` checks
indexing. CMS push is still off (**G13**, owner decision). Nothing re-measures a page after it is refreshed — `seo_link_impact`
does this for a won link and there is no equivalent for a content change, because there was no stored pre-refresh baseline to
measure against.

---

## 4. The gap

| What they do | What we did this morning | Does it matter to the customer? | Criterion |
|---|---|---|---|
| Compare a page with **the same weeks a year earlier** (Clearscope 90d YoY; Ahrefs ">20% YoY") | 28 days vs the 28 before, nothing else — although the `yoy` range existed and was asked for at `rowLimit: 1` | **Yes, badly.** Every seasonal trough is reported as a decline. A B2B site refreshing its December dip is rewriting pages for nothing | C15 |
| No significance test (nobody has one) | A fixed **25% on 10 prior clicks** — 10 → 7 is "decay" at z = −0.73 | **Yes.** We are the only ones who can fix this, and we already own the machinery (`ST.change`) | C15 |
| Rank by **absolute clicks lost** | Already sorted by `clicks_delta` | No gap | C15 |
| Separate "declined with no edit" from "declined after an edit" (Ahrefs) | Not distinguished | Minor — we rarely edit pages outside our own runs | C15 |
| Generate the refresh **from the decay view** (Clearscope Draft; Siteimprove's create/refresh/optimize plan) | A priority-3 e-mail line with no `api_body`; the cadence had no `decay` source and could not have had one — the verdict reached no table | **Yes. This is the area's largest single gap** | C15, C16 |
| A page inventory with **clicks, impressions, position over time** (monthly rescan) | `seo_pages` held url/title/h1/source/lastmod/queries_json only | **Yes** — it is the precondition for everything above | C15 |
| Inventory capped at **50 / 300 pages** by plan | Every page GSC reports, up to 2,000, free | **We are ahead** | — |
| **Re-measure the refresh** after ~2 months (Semrush), annotations on the page (Clearscope) | Nothing | Yes, but it needs a stored baseline first | C15, C16 |
| Peak-month view + 12-month sparkline | We hold no page-level history at all | Moderate — catches slow bleed that 28-vs-28 misses | C15 |
| Push the refresh to the CMS | Built, off | Yes — **G13**, owner's | C16 |
| Age trigger ("older than six months, update it for LLM citation", Semrush) | Not used as a trigger | Low — unvalidated vendor advice, and AI pages already have their own loop | C15 |

---

## 5. What to build

### (a) In reach now — **built in this pass** (build section 67, harness S77)

| Row | What | Size |
|---|---|---|
| **B4-1** | `ST.decay` in `_site_stats.js`: the fall is tested (two-sample Poisson, the machinery G28 already built) **and** checked against the same 28 days a year earlier via a new **free** `pages_yoy` Search Console request. A fall the page also had last year is `seasonal`, never decay. Too little volume is `too_small` **with the clicks it was measured on**. Clicks down while impressions held is `clickthrough` (title and description first); clicks down with impressions is `visibility`. The weekly report now states what it tested and what it refused, so "no decay" can be told from "nothing checked" | M |
| **B4-2** | `seo_pages` carries the measurement and the judgement (`clicks, impressions, position, prev_clicks, yoy_clicks, decay_state, decay_pct, decay_lost, decay_kind, decay_basis, measured_at`), written by the weekly Site Tracker, only when a row really changed. A week Google says nothing about keeps the stored judgement with the date it was measured on — never a stale number wearing today's date | S |
| **B4-3** | The Content Cadence queues a confirmed decaying page as a **refresh of that URL**, ranked by the clicks actually lost, **ahead of striking distance and rising trends** and behind ladder rungs; ≤ 2 a week; never within 60 days of the last refresh of that page; never for `seasonal` / `watch` / `too_small`; never without a search behind it; one page is one piece of work (a striking query on the same page is dropped). Mirrored rule for rule in `app/server/src/services/cadence.ts`, with the same four cases tested on both sides | M |

**Deploy note:** `seo_pages` gains eleven columns, so **`sync_tables.py` must run** (`apply_env.py` does it). Not deployed by this pass.

### (b) Needs money, an owner decision, or months of data

| Row | What | Cost / who decides |
|---|---|---|
| **B4-4** | **Measure the refresh.** B4-2 starts a weekly page-level series today; after ~8 weeks a refreshed page can be tested against its own pre-refresh baseline with `_change_test.js` and the site's other pages as the control, the way `seo_link_impact` already does for a won link. Semrush's own guide says to wait two months, so the measurement cannot be honest sooner | $0, but **needs ~8 weeks of stored rows**. No decision needed — it is a scheduling constraint |
| **B4-5** | **Peak-month decay and a 12-month sparkline** (Clearscope's second cut, which catches a slow bleed that 28-vs-28 misses). Needs a page-level monthly series. B4-2 produces one row a week; 12 usable months arrive in October 2027, or sooner by backfilling from Search Console's 16-month window (≈ 12 extra free requests per site, one-off) | $0 in API cost; **owner decides** whether a one-off backfill of ~12 requests per site per month is worth the Site Tracker's runtime |
| **G13** | **CMS push** — the refresh is written and still has to be pasted in by hand. Already built for WordPress and switched off; everything else needs a decision about which stacks to support | **Owner's, unchanged.** `C16 cannot pass 6 without it` |
| **B4-6** | **Annotate the page when we refresh it** and show it on every chart. `_annotations.js` and `seo_events.json` already mark published pages, audit fixes and Google updates; a refresh is one more event kind. Small, but it belongs with B4-4 and is worthless before it | S, **after B4-4** |

### (c) Deliberately not worth it

| What | Why not |
|---|---|
| **Ahrefs' "declined with no preceding edit vs declined after an edit" split** | It needs a reliable record of every page edit, including ones made outside Ascentra. Page Watch sees content hashes for ≤ 25 pages a week on a rotation — a "no edit" claim built on that would be wrong often enough to mislead, and a wrong diagnosis is worse than none |
| **Ahrefs' KD < 40 filter** (skip pages losing to link authority) | It costs a paid keyword-difficulty lookup per decaying page to *remove* work from the queue. The pages our cadence refreshes are our own pages on our own topics; the filter exists for agencies auditing a 10,000-page site |
| **Semrush's "older than six months → update it for LLM citation"** | No evidence behind it, and it collides with Google's own warning against changing dates without substantial changes. The AI pages already have their own evidence-led loop (`seo_ai_targets`, AI_GROWTH_SPEC) |
| **Clearscope's SEO value = clicks × average CPC** | It needs a paid CPC per target query to produce a number whose only use is sorting — and we already sort by the clicks at stake, which is the thing itself rather than a proxy for it |
| **A Content Grade per inventory page** (Clearscope's A++…F) | It implies re-scoring every page against a live SERP every month: a paid SERP call per page per month, for a letter. Our quality gate runs where it changes an outcome — on the draft, before it is delivered |

---

## 6. The one change that matters most

**A page that is losing traffic now becomes a page that gets rewritten** — the system measured decay honestly enough to put it in an
e-mail and then had no way to act on it, so the customer's best opportunity (recovering clicks a page already earned) was the one
thing the weekly loop never worked on.

---

## 7. Proposed register rows (`FIX_PLAN.md` §3.14 format)

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B4-1 | **A decaying page was a 25% fall on 10 prior clicks, in the one window that cannot tell a decay from a season.** 10 → 7 clicks is "decay" at z = −0.73; `decay_drop_pct` survived the G28 sweep that claimed to remove the last fixed threshold. The `yoy` range existed since v4.3 and was requested at `rowLimit: 1` — site totals only — so the per-page year-ago comparison both Clearscope cuts and Ahrefs' rule are built on was one free request away and never made. On techand.ai (34 clicks site-wide, exec 581) the rule cannot fire at all, and the report cannot say so | **High** (the advice is wrong, and silently) | `v5/code/_site_stats.js`, `Parse_GSC.js`, `GSC_Requests.js`, `Site_Plan.js`, `Site_Report.js`, `Brief_Input.js` | `ST.decay`: two-sample Poisson + a new free `pages_yoy` request; `seasonal` / `watch` / `too_small` reported with their reason; `visibility` vs `clickthrough` named; the report states what it tested and refused | fixed 2026-10-15 (build section 67, S77); **not deployed** |
| B4-2 | **The decay verdict lived for one run and died in an e-mail.** `seo_pages` held no metric, no history and no judgement, so nothing downstream could act on it; `decaying_pages` reached no table | **High** (precondition for every refresh) | `ladder_common.py` `PAGES_COLS`, `v5/code/Page_Inventory_Site.js`, `_site_model.js` | eleven columns on the page row, written weekly only when they changed; a silent week keeps the stored judgement with its own date | fixed 2026-10-15 (build section 67, S77); **not deployed — needs `sync_tables.py`** |
| B4-3 | **Nothing in the system ever wrote a refresh.** The cadence's four sources were ladder / striking / trend / AI; a decaying page reached the owner only as a priority-3 action with no `api_body`, while the striking action beside it shipped a one-click body. C15's 10-anchor asks for a scheduled substantive refresh | **High** (the area's largest gap) | `v5/code/Cadence_Plan.js`, `Site_Metrics.js`, `app/server/src/services/cadence.ts` | a `decay` source ranked by clicks lost, ahead of striking and trend, ≤ 2 a week, 60-day settle, never for a refused state or without a search; the decay action now carries `api_body` | fixed 2026-10-15 (build section 67, S77); **not deployed** |
| B4-4 | **A refresh is never measured.** Semrush's own guide says to wait two months and re-run the same analysis; we had no pre-refresh baseline to re-run it against | Medium | `_change_test.js`, `seo_pages` | B4-2's weekly series is the baseline; after ~8 weeks test the refreshed page against itself with the site's other pages as control, as `seo_link_impact` does for a link | open — **blocked on ~8 weeks of stored rows**, no decision needed |
| B4-5 | **No page-level history, so no peak-month view and no 12-month sparkline** — Clearscope's second decay cut, which catches a slow bleed 28-vs-28 misses | Low–Medium | `Page_Inventory_Site.js` | B4-2 accrues one row a week; a one-off backfill of ~12 free monthly requests per site would give 12 months at once | open — **owner decides** whether the backfill is worth the Site Tracker runtime |
| B4-6 | **A refresh leaves no mark on the charts**, although published pages, audit fixes and Google updates all do | Low | `v5/code/_annotations.js`, `v5/data/seo_events.json` | one more event kind | open — worthless before B4-4 |
