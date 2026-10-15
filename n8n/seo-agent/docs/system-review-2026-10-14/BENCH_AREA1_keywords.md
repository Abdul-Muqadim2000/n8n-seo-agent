# Benchmark area 1 — keyword research, difficulty and verdicts

**Written 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score at the last rating: **6/10**
(`../system-review-2026-10-13/SCORECARD.md`). Frozen criteria: `../system-review-2026-10-11/CRITERIA_keywords_content.md`
Area 1, criteria **K1–K6**, plus **K9** where it covers the single-keyword verdict (K7–K13 belong to area 2's ladder pass,
`BENCH_AREA2_ladders.md`).

> **Read the code, not the 2026-10-13 scorecard.** That 6 was given before R3, R12, R13, R26, D4, D22, P1-4 and B2-1 landed.
> Everything in §3 was verified in the source of `v5/code/_reach.js`, `_kw_inputs.js`, `_fit_gate.js`, `Rank_Keywords.js`,
> `Build_Keyword_Strategy.js`, `Assess_*.js` and the `Parse Verdict` node as they stood this morning, and against what the two
> live runs actually emitted.

---

## 1. The leader today — and whether the rubric still names it

The rubric names **Semrush (Personal KD)** and **Ahrefs**. Both are still the right comparison in October 2026, and they are the
right comparison for *different halves of the area*: Semrush is the leader on site-specific difficulty, Ahrefs on what a keyword
is worth. Nothing has been discontinued, which is worth recording because the last two passes each found a named comparison that
had moved.

| Leader | Status checked 2026-10-15 | Source opened |
|---|---|---|
| **Semrush — Personal Keyword Difficulty** | **Alive, and it publishes its bands**: Very hard 85–100, Hard 70–84, Difficult 50–69, Possible 30–49, Easy 15–29, Very easy 0–14. "Personal Keyword Difficulty is calculated using our proprietary AI algorithm"; it "assesses the thematic relevance between the domain you've entered and the keyword", the competition level within the topic, and "the metrics of your domain and of competitor domains on the SERP". It needs the domain, because it "evaluates the difficulty of promotion specifically for your domain". **The page says nothing about what it does when there is not enough data** | [semrush.com/kb/1434](https://www.semrush.com/kb/1434-how-is-personal-keyword-difficulty-calculated) |
| Semrush — how PKD is personalised | "We combined Semrush data with LLMs to develop a thematic vector map of every topic and how topics are related to each other"; it measures "the 'distance' between any two topics", and "the closer the thematic match, the lower the PKD%". The same release names **Topical Authority** and **potential SERP positions** ("where your keywords rank now and where they could go"), neither of which it explains. Post dated 2024-05-21 | [semrush.com/blog/ai-keyword-research-updates](https://www.semrush.com/blog/ai-keyword-research-updates/) |
| Semrush — the rule of thumb it publishes | "any keyword with a PKD score below 30% is a great opportunity to consider"; for volume, "at least 100 monthly searches as a general rule of thumb" | [semrush.com/blog/keyword-metrics](https://www.semrush.com/blog/keyword-metrics/) |
| **Ahrefs — Keyword Difficulty** | **Alive, and deliberately NOT personalised.** "We calculate Keyword Difficulty (KD) from the number of backlinks to the top-ranking pages", a weighted average of linking domains on a log scale, and it "doesn't take anything else into account". The product page repeats it: "We calculate the KD score based solely on the average number of backlinks to the top-ranking pages." Its own advice is to study the top 10 by hand for the rest | [ahrefs.com/academy…/keyword-and-search-traffic](https://ahrefs.com/academy/how-to-use-ahrefs/ahrefs-seo-metrics/keyword-and-search-traffic), [ahrefs.com/keywords-explorer](https://ahrefs.com/keywords-explorer) |
| **Ahrefs — Traffic Potential / Parent Topic** | Alive, and still the sharpest answer to "what is this keyword worth": TP is "the sum of organic traffic that the #1 ranking page for your target keyword receives" — the page's whole keyword set, not the one query — and Parent Topic finds the query that sends that page the most traffic, i.e. whether you can win this search by targeting a broader one | [ahrefs.com/keywords-explorer](https://ahrefs.com/keywords-explorer) |
| **MarketMuse — Personalized Difficulty** (named in K1, and area 2's leader) | Alive. "MarketMuse subtracts your Topic Authority from Keyword Difficulty to arrive at your Personalized Difficulty", Topic Authority runs −100…+100, the published threshold is "look for situations where you have a Topic Authority" of at least 5–10, and the empty case is stated as a rule: **"If you have no Topic Authority, then your Personalized Difficulty = Keyword Difficulty"** | [docs.marketmuse.com](https://docs.marketmuse.com/reference/personalized-difficulty-and-topic-authority/) |
| **The click-loss evidence everyone's traffic numbers rest on** | **Updated since our code was written.** Ahrefs, published **2026-02-04** on **December 2025** data, 300,000 keywords (150k with an AI Overview, 150k without, against a December 2023 baseline): position 1 **−58.0%**, 2 −50.8%, 3 −46.4%, 4 −38.8%, 5 −32.6%, 10 −19.4%. The April 2025 study it replaces measured **−34.5%** at the top | [ahrefs.com/blog/ai-overviews-reduce-clicks-update](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/) |

**Verdict on the rubric: keep both names.** Two things to carry forward (the CRITERIA files stay frozen; this is the new statement
beside the old one, per programme rule 1):

- **K3's evidence moved.** The criterion already cites the December 2025 figure, but our *code* was built on the April 2025 one.
  No re-baselining is needed — the rubric was right and the implementation was stale. Fixed here (B1-3).
- **Nobody publishes a formula.** Semrush ("proprietary AI algorithm"), MarketMuse (weights unpublished) and Ahrefs (published,
  but only because it is one input) all decline. What they *do* publish is **the bands, the thresholds and the edge case**. That is
  the copyable part, and it is what we were weakest on.

---

## 2. What the leaders do, mechanism by mechanism

**Semrush — difficulty that belongs to a domain.**
1. A **thematic vector map** places every topic and measures the distance between a domain's core topics and the target topic; the
   closer the match, the lower the PKD. It therefore has an answer for *every* keyword, including ones the domain has no record on.
2. The score is blended with the **competition inside that topic** and with **the metrics of your domain against the domains on
   that results page** — so a strong domain in an unrelated topic is not treated as a strong domain here.
3. **The bands are published** (six of them), and so is the rule of thumb (PKD < 30 is worth considering).
4. Beside PKD it shows **Topical Authority** and a **potential position**, both undocumented.

**MarketMuse — difficulty that belongs to a topic.**
PD = KD − Topic Authority, Topic Authority −100…+100 from the site's breadth, depth and search performance **on that topic**, the
threshold to look for published (5–10), and the empty case stated as a rule rather than hidden: no authority → PD = KD. Effort
bands then decide the shape of the work (1–20 optimise what you have … 50+ build the cluster first).

**Ahrefs — the value of a keyword, measured on a page that already exists.**
KD is deliberately one thing (links to the top-ranking pages) and says so. The decision metric is **Traffic Potential**: the
traffic of the page that ranks #1, across every keyword it ranks for — which is what you would actually get by beating it — plus
**Parent Topic**, which tells you when the right target is a broader query. Global volume, per-country volume, SERP history and
SERP volatility sit beside it.

**What they refuse to do.** None of them turns a thin signal into a confident number: Ahrefs refuses to blend anything into KD,
MarketMuse states its no-data rule, Semrush publishes bands instead of a formula. None of them promises a date.

---

## 3. What we do, from the live evidence

Three customer-facing surfaces, all in this area:

| Surface | Mode | Evidence |
|---|---|---|
| **Keyword Check** (synchronous, ~6 s, ~$0.026 with a stored reach) | `POST /webhook/seo-keyword-assess` | 2026-10-13 execs **487–489**; 2026-10-14 execs **541–543** |
| **Keyword verdict / keyword report** (~2–3 min, ~$0.13) | `verdict` | 2026-10-13 exec **486** and its follow-up **519**; 2026-10-14 exec **540** |
| **Keyword research (discovery)** (~2 min, ~$0.27) | `discover` | 2026-10-13 exec **518** (662 keywords → 131 relevant, 43 clusters, 15 live checks); 2026-10-14 exec **553** (839 → 240 reviewed → 30 relevant) |

**What is already at or above the leaders' level** (verified in code and in those runs):

- **First-party demand as an input, not a read-out (K6).** `KWI.gscSeeds` turns the site's own Search Console queries into research
  seeds — a query with impressions that no live page answers, and a striking-distance query at position 8–20 — and names what it
  dropped. Exec 518: *"10 of your own Search Console searches were used as research seeds … Left out: 9 brand searches, 0 typed by
  SEO tools, 26 under 10 impressions"*, from 300 stored rows, **with no extra API call**. Neither Semrush's nor Ahrefs' keyword
  tool seeds research from your own Search Console (not verified beyond their public documentation, which describes Search Console
  integration in their *reporting* surfaces, not in keyword discovery).
- **A traffic number that says whether it was measured (K2).** `KWI.calibrate` labels every figure `calibrated` (your own measured
  impressions for that exact search, scaled to a month), `modelled` (provider volume through the click loss) or `unknown`. Exec
  518: 36 keywords calibrated, 626 modelled, with the label printed on every card.
- **A business-fit gate (K5).** `_fit_gate.js` refuses another company's brand, a government or portal query and a navigational
  search, with a reason per refusal, on both the pool and the plan. Exec 518: `refused: []` with nothing to refuse — no competitor
  brand and no login query reached the 131 relevant keywords.
- **Honest absence.** R26: a Keyword Check with no volume and no difficulty says *"· no search data"* in the label and suppresses
  the chance band. R18/R23: a results page that failed twice yields `NOT_CHECKED`, no score.

**What was still wrong this morning** — three things, all of them the same mistake in different places: *a number reaching a
customer without saying what it is*.

1. **The keyword report's two headline numbers came out of the language model.** `Parse Verdict` copied
   `expected_monthly_visits_top3` and `time_to_rank_months` out of the Verdict Agent's JSON and shipped them. They reach the
   customer in the Word file and the PDF (*"Expected visits/month at #1-3: 70"*, *"Time to rank: 6 months"*) and, for a ladder, in
   the app's feasibility card (`app/web/src/components/reports/ladder.tsx`: `~6 months`, hint `Visits / month at top 3: 70`).
   Nothing said they were a model's guess. The 2026-10-13 run recorded it as a weakness of exec 486 — *"`time_to_rank_months: 6` is
   given without a likelihood"* — and the same run proves the system can do better **two inches away**: the ladder prints a month
   range with an uncalibrated chance band and the Ahrefs base rate (G3), and discovery prints calibrated-or-modelled on every
   traffic figure (G8). The keyword report, the most-read output of this whole area, had neither.
2. **"Difficulty for your site" was one number per website, for every topic.** `_reach.js` measures the 75th-percentile difficulty
   of the keywords the site ranks top 10 for, caches it 30 days under `reach:<site_id>` — and the cache kept **only the number**.
   So every reader of a stored reach (the Keyword Check, discovery, the ladder) could neither measure a topic nor say what the
   number rested on. Exec 518 labelled all 43 of its clusters against *reach 10*; exec 494 planned an ERP ladder against a reach
   measured on e-invoicing research six days earlier (that half is area 2's B2-1, fixed 2026-10-15 — for the ladder only).
   The keyword *verdict* path had no reach at all: a $0.13 report answered "is this keyword worth it" with no "for whom".
3. **The click-loss model was a year out of date and unsourced.** `KWI.featureLoss` multiplied by **0.65** when a results page had
   an AI Overview — the April 2025 measurement (−34.5%) — while the current study measures −58.0% at position 1. Our estimate is
   explicitly "what a page in the top three would take", so the right factor is the top-three average, **0.483**: every traffic
   potential on an AI Overview results page was **~1.5× too generous**, and the four other feature deductions (0.85 snippet, 0.92
   video, 0.85 local pack, 0.9 shopping) were constants with no source and no label.
4. **The pages Google actually ranks were thrown away (K4).** The live results page is bought for up to 16 priority keywords
   (`live_serp_checks`, ~$0.032 a run), and only the domains, the features and the People Also Ask were kept. The intent and page
   type that decide what we write came from the AI relevance screen's label. K4's own anchor for a 10 is "the dominant top-10 page
   type decides, a mismatch is flagged".

---

## 4. The gap

| # | What the leader does | What we did (before this pass) | Does it change the customer's outcome? | Criterion |
|---|---|---|---|---|
| 1 | Difficulty personalised **per topic / per domain** (MarketMuse PD = KD − Topic Authority; Semrush PKD falls with thematic distance), with published bands | One cached number per website for every topic — and the keyword **verdict** had none at all | **Yes, directly.** It decides the plan type, the months and the chance band, and on the verdict path it decided nothing because it was absent | **K1** |
| 2 | The no-data case is a published rule ("no Topic Authority → PD = KD") | The site-wide number was applied silently; nothing said what it was measured on | **Yes.** An unearned discount read as a measurement | K1 |
| 3 | Ahrefs **Traffic Potential**: the traffic of the page that ranks #1, across all its keywords | Volume × click loss × a top-three share, for the one keyword | Yes, for choosing between keywords — a search with 90 searches on a page that earns 4,000 visits is worth more than its volume says | **K2** |
| 4 | Click-loss discounts from current CTR data | An AI Overview discounted at the April 2025 figure, the rest unsourced constants | **Yes.** Every traffic estimate on an AI Overview page was ~1.5× too high, and nothing said where any factor came from | **K3** |
| 5 | **The dominant page type of the top 10 decides** the intent and the page, and a mismatch is flagged | Intent and page type from the AI label; the ten pages were fetched and discarded | **Yes.** A service page planned for a search Google answers with guides loses before it is written | **K4** |
| 6 | A business-fit gate on relevance | Scored 0–2 with refusals and reasons, on the pool and the plan | No — **at or above the leaders**: neither publishes a refusal rule of this kind | K5 |
| 7 | Search Console as ground truth | Search Console **seeds the research** and calibrates the traffic figure, with the drops counted | No — **ahead** | K6 |
| 8 | Nobody promises a date | The ladder printed a range + uncalibrated chance; **the verdict printed a single model-written month count** | **Yes**, on the verdict path | K9 / K10 |
| 9 | Semrush answers PKD for every keyword, including topics the domain has no record on | Our topic measurement needs 5 on-topic top-10 keywords, so most sites keep the site-wide number | Partly. Ours is evidence-bound and says so; theirs always answers but cannot show its working. **Deliberate difference, stated in §5(c)** | K1 |

---

## 5. What to build

### (a) In reach now — **built in this pass** (build section 77, harness S87)

| Row | What | Size | State |
|---|---|---|---|
| **B1-1** | **The keyword report computes its own two numbers.** `Parse Verdict` now carries `for_you` (difficulty for this site, plan type, months, chance band, and **which reach it was measured against**), `time_to_rank` (the modelled range with its uncalibrated chance and the published base rate; the model's own month count kept beside it as `model_months`) and `expected_visits` (volume through the measured click loss, with its basis in words). A results page that could not be read produces **no** visit figure. The Word file and the PDF print the basis next to every figure; the ladder card's model number is labelled as the model's own | M | **done** |
| **B1-2** | **The reach cache keeps its evidence.** `reachCacheRow` stores the top-10 keywords the number was measured on (≤ 60 triples), `reachCached` hands them back, and the Keyword Check, the keyword report and discovery measure the reach **on the topic asked about** with the same kit and the same bar the ladder uses (`REACH_CFG.min_top10` = 5). Below the bar the site-wide number stays — never a penalty — and the answer names the topics it was really measured on. **$0**: no new call, and a row written before today says it has no evidence rather than reporting zero | M | **done** |
| **B1-3** | **The click loss is the current measurement, and says so.** `KWI.CLICK_LOSS` carries a factor, a basis and a source per feature: AI Overview **0.483** (`measured`, Ahrefs 300,000 keywords, December 2025, with the URL), the other four unchanged and labelled **`stated rule`**. The figure prints what was taken off it and on whose authority. It also found a real defect: `num(null)` is `0`, so a keyword the provider has **no** volume for was reporting *"0 visits a month (modelled)"* instead of "no estimate" — fixed, and the cell now reads "not estimated (no volume measured)" | S | **done** |
| **B1-5** | **What Google ranks decides the page type (K4).** `KWI.serpPageTypes` reads the title and URL of each organic result already fetched and counts the shapes (guide/article, comparison or list, service or product, pricing, government, forum, directory, homepage, other). A kind is "dominant" only at ≥ 50% of at least 4 results read; a disagreement with the planned page type is printed as a mismatch — *"Guide or articles are what Google ranks here: 4 of the 6 results read, while this plan writes a service or product page"* — and never silently overrides the plan. $0 | S | **done** |

Measured effect on the live shape: for "e invoicing software uae" (difficulty 45, 480 searches, an AI Overview on the page) the
keyword report moves from *"Expected visits 70 · Time to rank 6 months"*, both unlabelled, to *"Hard for your site · Full ladder ·
9–15 months · measured on this topic"*, *"70 visits — modelled from the provider's monthly volume, after this results page's click
loss"* and *"9-15 months — modelled, not measured, estimated chance low (15-30%, uncalibrated)"*. The same keyword on a site with
no record on the topic reads *"reachable · 4-8 months"* with the sentence that says the number came from other topics.

### (a) In reach now — **not built in this pass**

| Row | What | Size | Why not now |
|---|---|---|---|
| **B1-6** | **Cluster traffic potential**: the SERP-overlap clusters (K7) already group the searches one page can serve, so the page-level figure is the cluster's volumes through the same click-loss model — the free two-thirds of Ahrefs' Traffic Potential, computed from data we already hold | S | Touches the same report section three rows already rewrote; better as its own change with its own scenario |
| **B1-7** | **Carry `for_you` / `time_to_rank` / `expected_visits` into the app's keyword-report renderer** (the callback already carries them since B1-1; the app shows none of these numbers today, which is why the Word file was the only place they could mislead) | S | App work, and the ladder card's label was the part that could mislead today |

### (b) Needs money or an owner decision

| Row | What | Cost | Who decides |
|---|---|---|---|
| **B1-8** | **Ahrefs-style Traffic Potential**: the traffic the page ranking #1 earns across *all* its keywords, which is what you take by beating it (gap 3). One DataForSEO Labs call per checked keyword against the ranking URL. **Not verified** that the endpoint accepts a URL target — probe the sandbox from inside the container first | ≈ **$0.01 a keyword**; capped at the live-check limit that would be 16 × $0.01 = **$0.16 a discovery run** on top of today's ~$0.27 | **Owner.** It is the single biggest remaining capability gap to Ahrefs, and it is the one that changes *which keyword you pick* |
| **B1-9** | **A thematic distance for topics the site has no record on** (gap 9): Semrush answers PKD for every keyword by measuring the distance between the domain's core topics and the target; ours answers "we cannot measure this topic" and falls back. A Claude call per run could estimate the distance from the site model's services and page inventory | ≈ **$0.002–0.01 a run** (one Haiku call), plus the risk of a number nobody can check | **Owner.** My recommendation is **no**, see (c) |
| **G17** | **Calibrating the chance bands and the month ranges** against our own ladders. Unchanged: it needs months of tracked outcomes, and every text already says "uncalibrated" | $0 | Time, not money |

### (c) Deliberately not worth it

| What | Why not |
|---|---|
| **A Personal KD percentage of our own (0–100, Semrush's scale and bands)** | We would be renaming a number we compute differently. The customer's question is "can my site win this search, and how long" — which is what the reach model answers, with its working shown. A second 0–100 scale next to DataForSEO's own difficulty would make two numbers that disagree |
| **An LLM "thematic distance" to replace the evidence bar (B1-9)** | It would turn "we have not measured this" into a number nobody can check — the exact failure this programme keeps finding. The evidence-bound version refuses in words that are useful ("nothing you rank for is on this topic"), and MarketMuse, the leader on topic-level difficulty, publishes the same refusal as a rule. Offer it to the owner, recommend against it |
| **Semrush's "potential SERP position" prediction** | Undocumented even by them, and it is a forecast of exactly the thing our own outcome loop measures weekly (K13). Predicting it before we have calibrated the simpler claim (G17) would be a second uncalibrated number |
| **Our own search-volume model** | Volume error against Search Console is 50–70% for the leaders (K2's evidence). The honest fix is the calibration we already do where Search Console has data, not a model competing with the provider's |
| **An AI-detector-style "difficulty confidence" score** | Nothing to validate it against; it would be a number about a number |

---

## 6. The single change that would most improve the customer's outcome

**Make every figure in the keyword report a computed figure that names its own basis — because the two numbers a customer actually
acts on ("how many visits is this worth" and "how long will it take") were, until today, whatever the language model typed, printed
beside measured data in the same table and the same font.**

---

## 7. Proposed register rows (for `FIX_PLAN.md` §3.14 — the orchestrator moves these; this file does not edit the register)

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B1-1 | **The keyword report's two headline numbers came out of the language model.** `Parse Verdict` copied `expected_monthly_visits_top3` and `time_to_rank_months` from the Verdict Agent's JSON into the Word file, the PDF and the app's ladder card with no basis of any kind (exec 486, 2026-10-13: *"`time_to_rank_months: 6` is given without a likelihood"*; exec 519's twin), while the same run computes a month range with an uncalibrated chance band (G3) and a calibrated-or-modelled traffic figure (G8) a few nodes away | **High** (the two figures a customer acts on) | `build_v4.py` §77, `Parse Verdict`, `Build Word File`, `Build Ladder Report`, `app/web/src/components/reports/ladder.tsx` | `for_you` (difficulty for this site, plan, months, chance, and which reach it used), `time_to_rank` (modelled range + chance + base rate, the model's own count kept as `model_months`) and `expected_visits` (volume through the measured click loss, basis in words); a results page that could not be read yields no visit figure; every surface prints the basis | fixed 2026-10-15 (build section 77, S87); not deployed |
| B1-2 | **The reach cache kept the number and threw away the evidence**, so every reader of a stored reach (30 days) could neither measure a topic nor say what the number rested on — exec 518 labelled 43 clusters against one *"reach 10"*, and the keyword verdict path had no reach at all | **High** (K1, the area's own criterion) | `v5/code/_reach.js`, `Reach_Discovery.js`, `Rank_Keywords.js`, `Assess_Result.js`, `Assess_Response.js`, `Build_Keyword_Strategy.js` | `reachCacheRow` stores the top-10 keywords behind the number, `reachCached` returns them, and the Keyword Check, the keyword report and discovery measure the reach on the topic asked about with the ladder's own kit and bar; below the bar the site-wide number stays and the answer names the topics it was measured on; a pre-B1-2 row says it has no evidence | fixed 2026-10-15 (build section 77, S87); not deployed |
| B1-3 | **The AI Overview click loss was the April 2025 measurement (0.65)** while the current study — Ahrefs, 300,000 keywords, December 2025 data, published 2026-02-04 — measures −58.0% at position 1, −50.8% at 2, −46.4% at 3; our estimate is for a page in the top three, so every traffic potential on an AI Overview results page was ~1.5× too generous, and the other four deductions were unsourced constants. Found while fixing it: `num(null)` is `0`, so a keyword with **no** provider volume reported *"0 visits (modelled)"* instead of "no estimate" | Medium | `v5/code/_kw_inputs.js`, `Build_Keyword_Strategy.js` | `KWI.CLICK_LOSS` carries factor + basis + source per feature (AI Overview 0.483 `measured` with the study URL, the rest `stated rule`), the note prints what was taken off and on whose authority, an absent volume yields no estimate, and the report names the study instead of printing a multiplier | fixed 2026-10-15 (build section 77, S87); not deployed |
| B1-4 | *(folded into B1-3 — the absent-volume defect found while fixing it; kept as its own line in the fix so a reader can find it)* | — | — | — | fixed 2026-10-15 |
| B1-5 | **The ten pages Google ranks were fetched and discarded** (K4): up to 16 live results pages are bought a run and only their domains, features and People Also Ask were kept, so the intent and page type that decide what we write came from the AI label alone | Medium | `v5/code/_kw_inputs.js` (`serpPageTypes`), `Build_Keyword_Strategy.js` | the shapes of the organic results are counted from the title and URL already fetched; a kind is dominant only at ≥ 50% of ≥ 4 results read; a disagreement with the planned page type is printed as a mismatch and never silently overrides the plan; a results page that was not read says so | fixed 2026-10-15 (build section 77, S87); not deployed |
| B1-6 | **Cluster traffic potential**: the SERP-overlap clusters already say which searches one page serves, so the page-level figure is their volumes through the same click-loss model — the free part of Ahrefs' Traffic Potential | Low | `Build_Keyword_Strategy.js`, `_kw_inputs.js` | sum the cluster's volumes through `featureLoss` and the top-three share, labelled modelled, beside the per-keyword figure | **open** (in reach, ~S) |
| B1-7 | **The app's keyword-report renderer shows none of the new figures** — the callback carries `for_you`, `time_to_rank` and `expected_visits` since B1-1, and the app shows the verdict, the score and the reasons only | Low | `app/web/src/components/reports/` | render the three with their basis, as the Word file does | **open** (in reach, ~S) |
| B1-8 | **No Traffic Potential of the ranking page** (Ahrefs' decision metric): we price a keyword by its own volume, not by what the page that wins it actually earns | Medium | `Priority Keywords` / `Build Keyword Strategy`, one DataForSEO Labs call per checked keyword | one `ranked_keywords`-class call against the #1 URL (**not verified that the endpoint takes a URL target — probe the sandbox first**), capped at the live-check limit | **owner decision**: ≈ $0.01 a keyword, ≈ $0.16 a discovery run |
| B1-9 | **A thematic distance for topics with no record**, so a difficulty can be personalised where evidence is absent (what Semrush's vector map does) | Low | `Rank_Keywords.js` / `_reach.js` | one Haiku call estimating the distance from the site model's services and pages | **owner decision**: ≈ $0.002–0.01 a run. **Recommended: no** — see §5(c) |
