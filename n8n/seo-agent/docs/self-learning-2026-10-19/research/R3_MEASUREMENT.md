# R3 — Measurement science for a weekly per-client self-learning loop

Research date 2026-10-19. Scope: what a weekly loop can honestly judge on three small B2B sites (~300 sessions / month), how
fast, with which test, and what to say when the data is too small to tell. Every external claim has the URL that was opened;
**[unverified]** means the figure comes from a secondary source or from my own knowledge, and the primary source was not read.
**[computed]** means I worked it out here (the formulas are in §6).

---

## 0. What this means in one page

1. **Most outcome questions can't be answered at ~300 sessions a month inside a quarter.** On ~35 Search Console clicks a week
   across the whole site, a before/after rate test with 4 weeks on each side picks up only a **+40% to +70% change** (80% power,
   α 0.05; the wider figure allows for assumed overdispersion φ = 2.5) [computed]. A single page with ~5 clicks a week picks up
   only a multi-fold change. A +20% lift needs ~470 clicks per period under ideal Poisson
   noise and ~1,200 under realistic overdispersion. Split testing in the SearchPilot style is out of reach: SearchPilot asks for
   ~1,000 organic visits **per day** to the tested section.
2. **So, as its main job, the loop should grade the advice, not the traffic.** Grade advice that has a checkable claim: was the
   finding true, was the keyword a fit, did the page get indexed, did the predicted chance band come true, did the timeline
   hold. These are binary or count events with fast feedback, and each one is scored with Wilson intervals, Brier scores and
   beta-binomial posteriors.
3. **Leading indicators are observable in 1–4 weeks:** discovery and indexing (Google's typical figure is ~20 h to discover a URL
   and ~1.5 h to index it, but "weeks to never" for low quality), first impressions, the first query set, and AI-panel
   citations. The ones that predict later results should be **learned per tenant from the loop's own ledger**. No published
   study gives a usable early-to-late conversion rate. The best public anchor (Ahrefs): 40.8% of the pages that ever reach the
   top 10 do it in month 1, and chances "drop considerably" after ~6 months.
4. **Pool across tenants, but only for priors.** With 3 sites, use a beta-binomial / gamma-Poisson hierarchy with a weakly
   informative population prior. Never pool one site's outcomes into another site's verdict.
5. **Every weekly check is a peek.** Use always-valid inference (mSPRT / e-values) for anything that is monitored continuously,
   and control false discoveries across the family of weekly checks (Holm for the few alerts, which is already in place;
   e-BH or BH for the learning ledger).
6. **Known confounders the loop must log:** Google core and spam updates (official dashboard, §2.5), the &num=100 removal of
   Sept 2025 (impressions and position broke from that date), AI Mode inside the "Web" totals since June 2025, the new
   Generative AI report (impressions only, rolled out 2026-08-31), anonymised queries (~47% of clicks [unverified]), and GA4
   thresholding on small user counts.

---

## 1. How long SEO outcomes take

### 1.1 Discovery, crawl, index

| Process | Typical | Slow tail | Source |
|---|---|---|---|
| Discovery of a new URL | ~20 h | weeks → never | Illyes, Search Central Live Barcelona, 2 Oct 2026, via ROAST / PPC Land recap — [relevantaudience.com](https://www.relevantaudience.com/seo/google-illyes-timing-data-discovery-indexing-recovery/), [ppc.land](https://ppc.land/google-says-new-pages-take-about-20-hours-to-be-found-some-never-are/) **[secondhand: Google has not published these tables]** |
| Sitemap processing | ~24 h | up to 14 days / never (quality) | same |
| Indexing, end to end | ~1.5 h | months / never (quality) | same |
| Refresh of a known URL | ~30 days | weeks → never | same |
| Canonicalisation change | 1–3 weeks | months | same |
| Structured data update | hours → 1–2 weeks | weeks / never | same |
| Snippet / title update | 1–2 days | weeks → months | same |
| Core update recovery | 3–6 months | 6–12 months (next core update) | same; consistent with Google's own core-update page (below) |
| Mueller: "several hours to several weeks", most good content ~1 week | — | — | [searchengineland.com](https://searchengineland.com/google-on-how-long-it-takes-for-seos-to-be-indexed-and-ranked-349998) **[secondary]** |
| ~16% of valuable, indexable pages on popular sites never indexed (Onely) | — | — | via [SEJ](https://www.searchenginejournal.com/data-suggests-google-indexing-rates-are-improving/) **[unverified]** |

Search Console data itself: fresh data shows up within hours, and the last 24 h are provisional, drawn as a dotted line
([Google, Dec 2024](https://developers.google.com/search/blog/2024/12/recent-data-search-console)). One practitioner measured
~93% of data points final 36 h after the day ([dejanmarketing.com](https://dejanmarketing.com/fresh-gsc/), **[secondary]**). So the
2–3 day lag in the brief is conservative and correct for a Monday job: **treat the last 3 days as provisional and never score on
them.** URL Inspection quota: 2,000 per day and 600 per minute **per property**
([developers.google.com limits](https://developers.google.com/webmaster-tools/limits)). That is far above what a small site needs,
so the loop can inspect every page it advised on every week.

### 1.2 Time to rank

Ahrefs, "How long does it take to rank" (published 15 May 2025, data from Sept/Oct 2023: 1M and 2M URL samples)
([ahrefs.com](https://ahrefs.com/blog/how-long-does-it-take-to-rank/), opened):
- Only **1.74%** of new pages reached the top 10 within a year in the 1M sample. A cleaner 2M sample of English pages with
  content gave **6.11%**. The 2017 figure was 5.7%.
- **40.82%** of the pages that reached the top 10 did so **within 1 month**.
- 72.9% of top-10 pages are older than 3 years, and the average #1 page is 5 years old.
- Ahrefs advises reviewing a page that is not in the top 10 after ~6 months, because the chances drop considerably after that.

Practical reading for us: there are two populations. A page either picks up quickly, often on low-volume long-tail queries, or
it mostly never does. A "fast or never" hazard model fits that shape better than a linear expectation. The 6–12-month figures
on SEO blogs are folklore, not this study.

### 1.3 Core updates and recovery (official)

Google: "We recommend waiting at least a full week after a core update completes before analyzing your site in Search Console,"
then compare the week after with the week before the rollout began. "It could take several months for our systems to learn and
confirm" that content improved; if nothing changes for a few months, the change may only show at the next core update
([developers.google.com/search/updates/core-updates](https://developers.google.com/search/updates/core-updates), opened).

### 1.4 Leading indicators observable in 1–4 weeks

| Indicator | Earliest read | How it is measured | Predictive value (evidence) |
|---|---|---|---|
| Discovered / crawled (URL Inspection `lastCrawlTime`, coverage state) | day 1–7 | URL Inspection API | Necessary, not sufficient. "Weeks to never" for low quality is itself a quality signal (Illyes recap). |
| Indexed (coverage "Submitted and indexed") | week 1–2 | URL Inspection | Necessary. "Crawled – currently not indexed" after 4 weeks is a strong negative signal (Google treats it as a quality call). No public conversion rate. |
| First impression date (per page, Performance API by `page`×`date`) | week 1–3 | GSC | 40.8% of eventual top-10 pages get there in month 1 (Ahrefs), so early visibility is informative. No study gives P(top 10 at 6 mo \| impressions in week 3) → **learn it per tenant.** |
| Number of distinct queries with impressions, and their best position | week 2–6 | GSC | Plausible proxy for topical fit. Anonymisation hides rare queries (below), which hurts long-tail B2B most. |
| Own rank check (DataForSEO) | weekly | SERP | Direct, but a single SERP read is noisy (personalisation, data centre). Use the median of reads, not one read. |
| AI panel mention / citation | weekly (pulse daily) | panel | Very noisy: 40–60% of cited domains change month to month for the same prompt ([Profound](https://tryprofound.com/blog/ai-search-volatility), opened, vendor). Needs aggregation over many answers. Rank → AI Overview citation overlap is weak and getting weaker: 38% of AIO citations rank top 10 (Ahrefs, Mar 2026; was 76% in Jul 2025, method changed) ([SEJ](https://www.searchenginejournal.com/google-ai-overview-citations-from-top-ranking-pages-drop-sharply/568637/), opened). |
| Generative AI impressions (GSC report, pages × date, impressions only) | weekly, once over Google's undisclosed threshold | GSC | New since 2026-08-31 ([support.google.com/webmasters/answer/16984139](https://support.google.com/webmasters/answer/16984139), opened). It is a view of data already counted in the Performance totals — **do not add it to Web totals.** A small site may sit under the threshold. |
| Engagement on new page (GA4 engaged sessions, key events) | week 2–8 | GA4 | Counts are tiny at 300 sessions/month, and GA4 thresholding hides low-user rows when Google signals are on ([optimizesmart](https://optimizesmart.com/blog/fixing-data-threshold-issue-in-google-analytics-4-ga4/), **[secondary]**). Use it as context, not as a graded outcome. |
| Backlink found live (own check) | week 1–4 after placement | ledger | Binary and verifiable. The link's effect on rank is not measurable at this scale. |
| Outreach reply | days | inbox | Binary, fast. Good for grading the pitch and the prospect qualification. |

**Conclusion:** none of the leading indicators has a published predictive rate we can trust for small B2B sites. The loop
should treat each indicator → outcome conversion as a **parameter to be estimated from its own ledger** (e.g. P(impressions in
week 4 | indexed in week 1)). Start from a weak prior and report it as "too few cases yet" until n ≥ ~20 per cell.

---

## 2. Causal attribution in SEO

### 2.1 Page-group split testing (SearchPilot)
- Randomisation is by **page**, not by user, because "a crawler is a single visitor." Pages go into control and variant buckets
  balanced on traffic, variability and seasonality, and a counterfactual model is fitted on the control's live performance
  ([searchpilot.com — the math](https://www.searchpilot.com/resources/blog/the-math-behind-searchpilot-how-seo-a/b-testing-actually-works), opened).
- The model began as CausalImpact (BSTS) and was replaced in 2019 by a neural network ("Split Optimizer"). Results are given as
  credible intervals. SearchPilot notes SEO has "wider credible intervals for the same statistical significance level" than CRO.
- **Requirement:** ~**1,000 organic visits per day** to the tested section, plus many pages on one template. Smaller sections
  "generally" have too little power, except when traffic is very smooth
  ([searchpilot.com — before you begin](https://www.searchpilot.com/resources/blog/before-you-begin-seo-testing), opened).
- SEOTesting (a competitor): split tests need about "50+ organic clicks per day combined", and on small sites results are
  "directional rather than definitive" ([support.seotesting.com](https://support.seotesting.com/en/article/how-much-traffic-does-a-site-need-for-seotesting-1y6jlsq/), opened).

**Feasibility for us:** a 300-session site has ~10 organic sessions a day across the **whole site**, about 1/100 of
SearchPilot's floor for one section. **Page-group split tests are not feasible** for these three clients. They become
feasible only by pooling the *same* change across tenants (§3.2) and across many pages, and even then only for large effects.

### 2.2 CausalImpact / BSTS
Brodersen et al., *Annals of Applied Statistics* 9(1), 2015, 247–274, doi:10.1214/14-AOAS788
([arXiv 1506.00356](https://arxiv.org/abs/1506.00356)). It builds a synthetic counterfactual from control series that the
intervention did not touch, using a diffusion-regression state-space model. What it needs (my reading of the paper and package,
**[unverified detail]**): a pre-period long enough to learn seasonality, typically ≥ 3× the post-period; control series
correlated with the target and unaffected by the change; and a stable relationship between them. On sparse weekly counts
(≤ 10 clicks a week per page) the Gaussian observation model is a poor fit. Aggregate to page groups or the site, or use a
count model. CausalImpact also cannot separate the change from a Google update in the same window. It only assumes the controls
absorb the update, which fails when the update hits the target page type differently.

### 2.3 Difference-in-differences with control pages
Practical form for small sites: treated pages (got the advice) vs. comparable untreated pages on the same site, with weekly
counts and a Poisson / negative-binomial GLM of `clicks ~ page + week + treated×post`. Assumptions: parallel pre-trends (check
4–8 weeks of pre-period, as practitioner guidance suggests
([seotesting / semrush summaries](https://www.semrush.com/blog/seo-a-b-split-testing-101/), **[secondary]**)), and no
spillover. Spillover is common in SEO: internal links and topical authority move the controls too.

### 2.4 Synthetic control
Abadie, *J. Econ. Lit.* 59(2), 2021, 391–425, doi:10.1257/jel.20191450
([NBER copy](https://conference.nber.org/confer/2021/SI2021/Abadie_2021.pdf); the PDF could not be parsed here). The
requirements per secondary summary ([goltc.org](https://goltc.org/publications/synthetic-control-methods/), **[unverified
against the original]**): donors never exposed to the treatment, no anticipation, no interference, and the treated unit's
pre-period inside the convex hull of the donors. Inference by placebo / permutation. With 3 tenants there are at most 2 donors
per site, which is too few. Within a site, the other pages can serve as donors only if they are unaffected by the change.

### 2.5 Confounders the loop must record as dated events

| Event | Dates | Effect on measurement | Source |
|---|---|---|---|
| Core updates | Mar 13–26 2025; Jun 30–Jul 16 2025; Dec 11–29 2025; Mar 27–Apr 8 2026; May 21–Jun 1 2026 | Exclude rollout window + 1 week (Google's own advice); compare like windows | [Google Search Status Dashboard](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history), opened |
| Spam updates | Aug 26–Sep 21 2025; Mar 24–25 2026; Jun 24–26 2026; Aug 18–20 2026; **Sep 24–Oct 7 2026** | Same treatment; the last one ended 12 days ago, so the first baseline weeks of the 3 new clients overlap it | same |
| &num=100 removal | ~Sep 8–15 2025 | Desktop impressions fell and average position "rose" as a reporting artefact; never compare impressions or position across this date | [searchengineland](https://searchengineland.com/google-num100-impact-data-462231) **[secondary, 319-property sample]** |
| AI Mode counted in Web totals | June 2025 | Clicks / impressions / position include AI Mode with no separate segment | [SEJ](https://www.searchenginejournal.com/google-adds-ai-mode-traffic-to-search-console-reports/549089/) **[secondary]** |
| Generative AI report | rolled out 2026-08-31 | New impressions-only series; a view of existing data, never summed with Web | [Google help](https://support.google.com/webmasters/answer/16984139), opened |
| Anonymised queries | always | Queries "not issued by more than a few dozen users over a two-to-three month period" are hidden from tables but counted in totals; Ahrefs measured ~46.8% of clicks anonymised (Apr 2025) | [Google 2022 deep dive](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive) (title confirmed, body not parsed — quote via [seroundtable](https://www.seroundtable.com/google-search-console-anonymizes-tons-of-queries-33735.html)) **[secondary]** |
| Seasonality | B2B: holidays, Ramadan / Eid for UAE clients, fiscal year ends | Use year-over-year windows (16 months of GSC history allows one YoY comparison) or a site-level control | — |
| SERP feature changes | continuous | AI Overview appearance changes CTR at a fixed position; record SERP features with every rank read (the existing `_rank_serp.js` already does) | — |

**Rule for the loop:** a grading window that overlaps a logged event is either excluded or scored "confounded — not judged".
It is never silently attributed to our advice.

---

## 3. Small-data statistics for per-client learning

### 3.1 Conjugate updating
- **Binary outcomes** (finding true, keyword accepted, page indexed by week 4, reply received, AI mention): Beta(α,β) prior →
  posterior Beta(α+k, β+n−k). Report the posterior mean and a 90% credible interval. The Wilson interval already in use is the
  frequentist twin. Keep Wilson for display and the beta posterior for decisions.
- **Count outcomes** (clicks, impressions, citations per week): Gamma(a,b) prior on the rate → posterior Gamma(a+Σy, b+T).
  The predictive distribution is negative binomial, which absorbs overdispersion. **Real weekly SEO counts are overdispersed**
  (query-mix swings, bot impressions, single-day spikes). The Poisson test already used for decay assumes variance = mean.
  Estimate the dispersion φ per site from the 16 months of history and widen the tests by √φ [recommendation].

### 3.2 Empirical Bayes / partial pooling with 3 tenants
- Classic case: Efron & Morris, 18 batters, 45 at-bats each, with shrinkage toward the grand mean (1975). The known failure is the
  "Clemente problem": atypical units get over-shrunk ([NEJSDS](https://nejsds.nestat.org/journal/NEJSDS/article/116/read),
  [arXiv 2506.10114](https://arxiv.org/html/2506.10114v1), opened via search; original paper not retrieved).
- **With 3 tenants the between-tenant variance cannot be estimated** (2 degrees of freedom). Empirical Bayes needs roughly
  ≥ 8–10 groups to estimate the hyperparameters stably **[unverified rule of thumb]**. So:
  - Use a **fixed, weakly informative population prior** that is not fitted: e.g. Beta(2,2) for an unknown rate, or a prior
    centred on our measured accuracy set (ACCURACY_SET.md: audit precision 100% on 53 cases → Beta(≈10,1) for "audit finding is
    true", capped so that one client's evidence can override it within ~10 cases).
  - Pool **advice types**, not clients. Example: "striking-distance refresh → +impressions in 8 weeks" can share a hierarchical
    prior across all refreshes on all 3 sites. Each site's own estimate is still reported separately, with its own n.
  - Move to a fitted hierarchical model (half-normal prior on between-site SD) once there are ≥ 8 tenants.

### 3.3 Sequential testing (the loop peeks every week)
- Johari, Pekelis, Walsh, "Always Valid Inference" ([arXiv 1512.04922](https://arxiv.org/abs/1512.04922), abstract opened):
  ordinary p-values "are wholly unreliable if users endogenously choose sample sizes by continuously monitoring their tests."
  The mSPRT gives always-valid p-values (p_n = min(p_{n−1}, 1/Λ_n)) that hold at any stopping time, and the paper extends this to
  multiple testing in the sequential setting.
- Cost: wider intervals and less power than a fixed-horizon test planned for the same n (secondary summaries). At our sample
  sizes this pushes most verdicts to "not yet". That is the honest answer.
- Simpler alternative for the ledger: **fixed-horizon scoring**. Each prediction states its check date in advance (e.g. week 8)
  and is scored once, at that date. A prediction scored once is not a peek, so plain tests are valid. Use always-valid
  methods only for the continuously monitored alerts (AI Pulse, decay watch).

### 3.4 Many weekly checks → false discoveries
- Alerts (a few per week, action-triggering): **Holm** (FWER), as already used for AI alerts. Correct where one false alert
  costs trust.
- The learning ledger (dozens of "did advice type X work" estimates): control the **FDR**. Use BH if the p-values are
  fixed-horizon. Use **e-BH** if they are e-values from sequential monitoring: e-BH controls FDR under arbitrary dependence
  (Wang & Ramdas 2022), and the online / stopped variants handle hypotheses arriving over time
  ([arXiv 2502.08539](https://arxiv.org/pdf/2502.08539), [arXiv 2407.20683](https://arxiv.org/abs/2407.20683v1), via search).
  A learned rule ("refreshes work for client B") is adopted only when it survives FDR control at q = 0.10.

### 3.5 Minimum detectable effects [computed, §6]

**Count outcomes** (two periods, equal length, 80% power, α 0.05 two-sided, log rate ratio):

| Clicks per period (each side) | MDE, pure Poisson | MDE, overdispersion φ = 2.5 (assumed) |
|---|---|---|
| 20 | ×2.4 (+143%) | ×4.1 |
| 40 | +87% | +169% |
| 80 | +56% | +101% |
| 160 | +37% | +64% |
| 320 | +25% | +42% |

At ~150 GSC clicks a month site-wide, a 4-week vs 4-week comparison has ~150 per side, giving an **MDE of ~+40–65% for the
whole site**. A single page with 5 clicks a week can detect only a **multi-fold** change. Impressions are 10–50× larger counts,
but they are more overdispersed and carry the reporting artefacts in §2.5, so the gain is smaller than the raw counts suggest.

**Proportion outcomes** (n answers per period, e.g. AI mention rate):

| From → to | n per period needed |
|---|---|
| 2% → 10% | 137 |
| 5% → 15% | 140 |
| 10% → 20% | 199 |
| 10% → 30% | 62 |
| 20% → 40% | 81 |

A 20-question panel × 3 engines = 60 answers a week. A realistic AI-mention improvement (5% → 15%) needs **~2–3 weeks pooled
per side**. A 0/60 week has a Wilson upper bound of 6%, and 3/60 gives [1.7%, 13.7%].

### 3.6 Regression to the mean
Every "pick the worst / best" step creates it. Examples: striking-distance keywords chosen *because* they sat at position 11–20
this month; pages chosen for a refresh *because* they dropped; alerts fired *because* a week was extreme. Part of the later
"improvement" is noise returning to the mean. **Mitigations:**
1. Select on a smoothed baseline (median of 4–8 weeks), not one window.
2. Keep an **untreated matched set** from the same selection rule (e.g. 1 in 3 eligible striking-distance keywords is
   deliberately left alone, or kept as "planned later"). Advice is credited only for the difference vs that set. This is the
   cheapest valid control a small site has.
3. Never grade an alert's follow-up on the same series that triggered it without a hold-out.

No SEO-specific study of this was found (search returned none) — it is standard statistics, flagged as my recommendation.

### 3.7 Goodhart's law
Manheim & Garrabrant, "Categorizing Variants of Goodhart's Law" ([arXiv 1803.04585](https://ar5iv.arxiv.org/html/1803.04585), opened):
**regressional** (selecting on a noisy proxy selects the noise), **extremal** (optimisation pushes into states where the proxy
relation breaks), **causal** (the intervention breaks the proxy→goal link), **adversarial** (an agent with other goals games
it). How each applies here:
- *Regressional:* learning "which advice types work" from the noisiest wins (see §3.6).
- *Extremal:* optimising the QA score until drafts satisfy the checker but not readers. Keep a human-rated sample.
- *Causal:* rewarding "pages indexed" leads to pushing thin pages into the index. Count indexed **and** impressed pages.
- *Adversarial / self-grading:* the system grades its own advice. It must not choose its own check date after seeing the data,
  move the target, or drop predictions that failed. **The ledger is append-only, and a prediction's score rule is frozen at
  creation.**
- Cost metric: the loop must never learn "do less to be cheaper" without also scoring the outcomes it gave up.

---

## 4. Grading advice quality rather than traffic

### 4.1 What can be graded fast, and how

| Advice output | Ground truth | Metric | Feedback time |
|---|---|---|---|
| Audit finding | Re-check on the live site (automated), or client / owner label "true / false / won't fix" | Precision (Wilson); recall only from a labelled sample | days |
| Finding fixed → resolved | Next audit's status | Resolution rate; median days to resolve | 1 audit cycle |
| Keyword fit | Client accept / reject in the app | Precision of "fit" verdicts; κ against the client | days |
| Chance / difficulty band ("50–70% chance of top 10 in 6 months") | Rank at the stated date | Brier score, reliability diagram, log score | 3–6 months |
| Timeline ("indexed within 2 weeks", "first impressions by week 4") | URL Inspection / GSC | Hit rate of the stated deadline; survival curve of time-to-event | 1–6 weeks |
| Content QA "publishable" | Indexed + impressions at week 8; client edits; human spot rating | Precision of "publishable"; QA score vs outcome rank correlation | 2–8 weeks |
| Link prospect "likely to reply" | Reply / no reply | Brier on the predicted reply probability | 1–3 weeks |
| AI-readiness score | Later citation in the panel | Calibration of score bands vs citation rate | 4–12 weeks, low power |
| Cost estimate | Measured run cost | Ratio actual / estimate; MAPE | immediate |

### 4.2 Calibration
- **Brier score** = mean (p − y)². Murphy (1973) decomposition: Brier = Reliability − Resolution + Uncertainty
  ([summary, metricgate](https://metricgate.com/blogs/brier-score-explained/), **[secondary]**; Murphy's original not opened).
  Report reliability (miscalibration) and resolution (discrimination) separately, so a forecaster that always says the base
  rate can't look good.
- **Reliability diagrams** with fixed bins are unstable at small n. Use **CORP** (isotonic regression / PAV, consistent and
  reproducible, with uncertainty bands): Dimitriadis, Gneiting, Jordan, *PNAS* 118(8) e2016191118, 2021
  ([PMC7923594](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7923594/), via search; R package `reliabilitydiag`).
- **Sample size:** at p = 0.6 an observed frequency has SE 0.155 with 10 cases, 0.098 with 25 and 0.069 with 50 [computed]. Show
  no calibration claim below ~25 resolved predictions per band. Show **pooled-across-tenants calibration first**: calibration
  is a property of *our* model, so pooling is legitimate there, unlike outcome effects.
- **Recalibration:** once ≥ 50 resolved predictions of a type exist, map the raw band to its observed frequency (isotonic) and
  display the recalibrated chance. Keep the raw one in the ledger.

### 4.3 The prediction ledger (design)

One append-only row per checkable claim, written **when the advice is made**:

| Field | Example |
|---|---|
| `prediction_id`, `site`, `run_id`, `created_at` | `pr_…`, techand.ai, exec 702, 2026-10-19 |
| `advice_type` | `audit_finding`, `keyword_fit`, `rank_chance`, `index_by`, `first_impr_by`, `refresh_lift`, `reply_prob`, `ai_cite`, `cost_est` |
| `subject` | URL / keyword / prospect / finding id |
| `claim` (machine-readable) | `{metric:"top10", op:">=", by:"2027-04-19", p:0.6}` or `{metric:"indexed", by:"2026-11-02"}` |
| `p_stated` / `band` | 0.6 / "50–70%" (null for deterministic claims) |
| `baseline` (frozen) | 8-week median position 14, clicks 3 / week, data window, dispersion φ |
| `control_ref` | matched untreated set id (for effect claims) |
| `check_at` (frozen) | 2026-11-02 (+ `grace_days` for data lag = 3) |
| `score_rule` (frozen) | `binary_hit` / `brier` / `rate_ratio_glm` / `wilson_precision` |
| `min_evidence` (frozen) | e.g. ≥ 40 clicks per side, ≥ 20 cases |
| `confounders` (filled at check) | overlapping core / spam updates, &num change, tracking gaps |
| `outcome`, `scored_at`, `score`, `verdict` | `hit` / `miss` / `not_judged: too_small` / `not_judged: confounded` / `not_judged: not_published` |
| `evidence` | numbers, URLs and query that produced the outcome (lineage rule 1) |

Rules:
1. Never update or delete a row after `created_at`, except to fill the outcome fields once.
2. `not_judged` is a first-class outcome. It counts toward coverage ("we could judge 40% of our advice") and never toward
   accuracy.
3. Advice that the client did not act on gets `not_judged: not_applied`. If the system's advice was ignored and the outcome
   happened anyway, record that as well: it is evidence about the baseline.
4. Weekly job: score every row whose `check_at + grace` has passed, then recompute per-type posteriors and Brier scores, then
   apply FDR control to any proposed "learned rule".

---

## 5. Recommendations per signal

"Earliest week" = weeks after the action (publish, fix, send) when a verdict can first be given. "Minimum evidence" = the floor
below which the verdict is "too small to tell".

| Signal | Earliest week | Minimum evidence before acting | Test / estimator | What to say when too small |
|---|---|---|---|---|
| Audit finding true (re-check / label) | 0–1 | 10 labelled findings per type for a precision claim | Wilson / Beta posterior on precision; per type and severity | "8 of 9 checked findings were real (range 57–98%) — too few to rate this check yet." |
| Finding resolved after fix | next audit (≤ 4) | the finding re-checked once | Binary; Kaplan–Meier for time to resolution | "Not re-checked yet." |
| Page discovered / indexed | 1–2 (deadline 4) | 1 page = 1 binary event; type-level rate after 10 pages | Beta-binomial "indexed by week 4"; survival curve | "Indexed 3 of 4 new pages by week 4; too few pages to set your site's normal rate." |
| First impressions | 2–4 | page in GSC page×date; ≥ 1 impression day | Time-to-event; gamma-Poisson for the rate | "No impressions yet; 40% of pages that ever reach the top 10 get there in month 1 (Ahrefs), so we check again at week 8." |
| Query set breadth | 4–8 | ≥ 10 queries with impressions; note anonymised share | Count, compared with the page's own prior pages | "Most searches for this page are hidden by Google for privacy; not judged." |
| Rank vs predicted chance band | at the stated date (3–6 mo) | ≥ 25 resolved predictions per band for calibration | Brier + CORP reliability, pooled across tenants | "Our 50–70% band has come true 4 of 7 times so far — too few to say it is calibrated." |
| Refresh / on-page change → clicks | 8–12 (outside update windows) | ≥ 80 clicks per side **and** a matched control set; or a ×2 effect | Poisson / NB GLM, DiD vs control; φ from history; fixed horizon | "Clicks went from 12 to 17; a change this small can't be told from noise at your traffic (we'd need about ×2)." |
| Site-level clicks trend | 4-week blocks | ≥ 150 clicks per block; YoY for seasonality | NB rate ratio; core-update windows excluded | "Up 18% vs last month, inside normal variation; not called a gain." |
| Impressions | 4–8 | as clicks, but never across 2025-09 (&num) or an update window | NB rate ratio | "Impressions moved, but Google changed how it counts them; not compared." |
| AI mention / citation rate | 2–4 (pooled weeks) | ≥ 60 answers per side; same panel, same engines (like-for-like) | Wilson + two-proportion z or beta posterior; Holm for alerts; mSPRT if monitored daily | "Named in 2 of 60 answers (1–11%); a real gain from here needs about 2–3 weeks of answers to show." |
| Generative AI impressions (GSC) | 4+ | above Google's threshold; never summed with Web | NB rate ratio | "Google shows no AI impressions for this site yet (below its reporting threshold)." |
| GA4 engagement / key events | 8+ | ≥ 30 key events per side; check the thresholding flag | Beta-binomial on conversion rate | "Too few visits to judge; Google Analytics hides small numbers." |
| Backlink placed → live | 1–4 | 1 link = 1 event | Binary (own two-miss check) | — |
| Backlink → rank effect | not judged at this scale | — | — | "Links help over months; at your size we can't isolate one link's effect." |
| Outreach reply rate | 1–3 | ≥ 30 sends per variant | Beta-binomial; Brier on predicted reply probability | "2 replies from 14 sends — too few to compare pitches." |
| Keyword fit accept rate | days | ≥ 10 labels per site | Wilson precision; κ vs client | "You accepted 6 of 8 suggestions; we'll tune after 10." |
| Content QA → outcome | 8 | ≥ 15 published pages | Spearman QA score vs week-8 impressions, pooled across tenants | "Not enough published pages to link QA scores to results." |
| Cost estimate accuracy | 0 | every run | actual / estimate ratio; median, MAPE | — |

**Learning rule (adopting a per-client policy change):** adopt only when (a) the evidence floor above is met, (b) the estimate
survives FDR control at q = 0.10 across all rules tested that month, (c) the window does not overlap a logged confounder, and
(d) the effect holds against the untreated matched set. Otherwise keep the population prior and say so.

---

## 6. Formulas used [computed]

- **Wilson interval:** centre (p̂ + z²/2n)/(1 + z²/n), half-width z·√(p̂(1−p̂)/n + z²/4n²)/(1 + z²/n), z = 1.96.
  Examples: 18/20 → [0.70, 0.97]; 0/60 → [0, 0.06]; 3/60 → [0.017, 0.137]; 1/8 → [0.02, 0.47].
- **Poisson MDE** (equal periods, N counts per side): detectable ratio = exp((z_{α/2}+z_β)·√(2φ/N)), z = 1.96, z_β = 0.84;
  N for a lift r: 2φ·((z_{α/2}+z_β)/ln(1+r))². With φ = 1: +20% needs 472, +50% needs 95, ×2 needs 33. The φ = 2.5 overdispersion
  is an **assumption**. Measure φ per site from 16 months of weekly GSC data before using these figures.
- **Two proportions:** n = (z_{α/2}√(2p̄q̄) + z_β√(p₁q₁+p₂q₂))² / (p₁−p₂)².
- **Calibration SE:** √(p(1−p)/n) per band.

---

## 7. Sources opened (and status)

- Ahrefs, time to rank (2025, 2023 data) — https://ahrefs.com/blog/how-long-does-it-take-to-rank/ — opened
- Illyes timing tables, Barcelona 2 Oct 2026 (recap) — https://www.relevantaudience.com/seo/google-illyes-timing-data-discovery-indexing-recovery/ ; https://ppc.land/google-says-new-pages-take-about-20-hours-to-be-found-some-never-are/ — opened, secondhand
- Google core updates guidance — https://developers.google.com/search/updates/core-updates — opened
- Google Search Status Dashboard, ranking history — https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history — opened
- Google, recent data in Search Console (Dec 2024) — https://developers.google.com/search/blog/2024/12/recent-data-search-console — via search
- Google, performance data deep dive (2022) — https://developers.google.com/search/blog/2022/10/performance-data-deep-dive — page opened, body not parsed; anonymisation quote via https://www.seroundtable.com/google-search-console-anonymizes-tons-of-queries-33735.html [secondary]
- Google, Generative AI performance report — https://support.google.com/webmasters/answer/16984139 — opened
- Search Console API limits — https://developers.google.com/webmaster-tools/limits — via search
- SearchPilot math / prerequisites — https://www.searchpilot.com/resources/blog/the-math-behind-searchpilot-how-seo-a/b-testing-actually-works ; https://www.searchpilot.com/resources/blog/before-you-begin-seo-testing — opened
- SEOTesting traffic guide — https://support.seotesting.com/en/article/how-much-traffic-does-a-site-need-for-seotesting-1y6jlsq/ — opened
- Brodersen et al. 2015 CausalImpact — https://arxiv.org/abs/1506.00356 — citation verified, full text not read
- Abadie 2021 synthetic controls — https://conference.nber.org/confer/2021/SI2021/Abadie_2021.pdf — fetched, not parseable; requirements via https://goltc.org/publications/synthetic-control-methods/ [secondary]
- Johari, Pekelis, Walsh — https://arxiv.org/abs/1512.04922 — abstract opened
- e-BH / online FDR — https://arxiv.org/pdf/2502.08539 ; https://arxiv.org/abs/2407.20683v1 — via search
- Efron–Morris / Clemente problem — https://nejsds.nestat.org/journal/NEJSDS/article/116/read ; https://arxiv.org/html/2506.10114v1 — via search
- Dimitriadis, Gneiting, Jordan 2021 (CORP) — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7923594/ — via search
- Brier decomposition summary — https://metricgate.com/blogs/brier-score-explained/ — via search [secondary]
- Manheim & Garrabrant, Goodhart variants — https://ar5iv.arxiv.org/html/1803.04585 — opened
- Profound, AI citation drift (vendor) — https://tryprofound.com/blog/ai-search-volatility — opened
- Ahrefs AI Overview citations 38% (Mar 2026) — https://www.searchenginejournal.com/google-ai-overview-citations-from-top-ranking-pages-drop-sharply/568637/ — opened
- &num=100 removal — https://searchengineland.com/google-num100-impact-data-462231 — via search [secondary]
- AI Mode in GSC totals — https://www.searchenginejournal.com/google-adds-ai-mode-traffic-to-search-console-reports/549089/ — via search [secondary]
- GA4 thresholding — https://optimizesmart.com/blog/fixing-data-threshold-issue-in-google-analytics-4-ga4/ — via search [secondary]
- Onely never-indexed 16% — https://www.searchenginejournal.com/data-suggests-google-indexing-rates-are-improving/ — via search [unverified]
