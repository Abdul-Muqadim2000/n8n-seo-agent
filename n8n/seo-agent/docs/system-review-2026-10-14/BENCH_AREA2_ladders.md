# Benchmark area 2 — keyword ladders / topical planning

**Written 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score at the last rating: **5.5/10**
(`../system-review-2026-10-13/SCORECARD.md`). Frozen criteria: `../system-review-2026-10-11/CRITERIA_keywords_content.md`
Area 1, criteria **K1, K7, K8, K9, K10, K11, K12, K13**.

> **Read the code, not the 2026-10-13 scorecard.** That 5.5 was given *before* R15, R16, R21, R22, R23, D5, D8, G32, G33 and P2-7
> landed. Everything in §3 below was verified in the source of `v5/code/Ladder_Plan.js`, `_reach.js`, `_radius.js`, `_fit_gate.js`
> and `Build_Ladder_Report.js` as they stand today, and against the two live runs' own output.

---

## 1. The leader today — and whether the rubric still names it

The rubric names **MarketMuse** and **Semrush Keyword Strategy Builder**. Both still exist in October 2026 and both are still the
right comparison for this area, with two qualifications worth recording.

| Leader | Status checked 2026-10-15 | Source opened |
|---|---|---|
| **MarketMuse** | **Alive, still sold standalone.** Four plans (Free / Optimize / Research / Strategy) with tracked topics, content briefs, strategy documents and a site inventory; **no prices are published** — every paid tier is a "Book a demo" | [marketmuse.com/pricing](https://www.marketmuse.com/pricing/) |
| MarketMuse ownership | Acquired by **Siteimprove**, announced **2024-10-08**. The announcement promises integration and support "through the combined solution" and names no sunset date | [blog.marketmuse.com](https://blog.marketmuse.com/siteimprove-to-acquire-marketmuse/), [siteimprove.com](https://www.siteimprove.com/blog/siteimprove-to-acquire-marketmuse/) |
| MarketMuse inside Siteimprove | The page at `siteimprove.com/marketmuse/` **no longer names MarketMuse at all**: the capability now appears as **"Siteimprove.ai Content Strategy"**, one of four agents, which "maps the content landscape… turns that map into a prioritized plan of what to create, refresh, or optimize" | [siteimprove.com/marketmuse/](https://www.siteimprove.com/marketmuse/) |
| **Semrush Keyword Strategy Builder** | **Alive, renamed, not deprecated.** Formerly *Keyword Manager*; rebuilt around Topics → Pillar pages → Subpages. Up to 5 seeds, up to 10,000 keywords | [semrush.com/kb/1058](https://www.semrush.com/kb/1058-keyword-strategy-builder) |
| Semrush personalisation | PKD comes from a "thematic vector map": "this algorithm meticulously assesses the thematic relevance between a target topic and a domain's core topics" — "the closer the thematic match, the lower the PKD%". Post dated **2024-05-21** | [semrush.com/blog/ai-keyword-research-updates](https://www.semrush.com/blog/ai-keyword-research-updates/) |
| **Keyword Insights** (clustering specialist, named in K7) | Alive. **It now reads the top 7, not the top 10** — "the overlap setting was originally 1-10, it now runs from 1-7 because Google no longer reliably shows 10 traditional links". Default threshold 40% shared URLs | [docs.keywordinsights.ai](https://docs.keywordinsights.ai/learning-center/the-features/keyword-clustering/) |
| **Surfer Topical Map** (the most-cited 2026 alternative) | Alive, and **not a leader on this area's dimension**: it auto-clusters without disclosing the method, refreshes every 14 days, connects Search Console — and says nothing about personalising difficulty to your own domain or about how topics are ranked | [surferseo.com/topical-map](https://surferseo.com/topical-map/) |

**Verdict on the rubric.** Keep both named leaders. Two corrections to carry forward (the CRITERIA files stay frozen — this is the
new statement beside the old one, per programme rule 1):

- **K7's anchor says "≥ 3–4 shared top-10 URLs".** The convention's own author moved to **top 7** because Google no longer reliably
  shows ten traditional results. *Old statement (2026-10-11): shared top-10 URLs. New statement (2026-10-15): shared top-7 URLs,
  default 40% overlap.* The scorer keeps using the old anchor until the owner agrees to re-baseline.
- **MarketMuse is now demo-gated** (no public price) and its capability is being folded into "Siteimprove.ai Content Strategy".
  It is still buyable and still the sharpest published description of topic-level difficulty, so it stays the benchmark — but
  anyone re-checking this in six months should expect the brand to disappear.

---

## 2. What the leaders do, mechanism by mechanism

**MarketMuse — difficulty that belongs to a topic.**
([docs.marketmuse.com](https://docs.marketmuse.com/reference/personalized-difficulty-and-topic-authority/))

1. **Topic Authority**, −100…+100, from the whole site's **breadth and depth on that topic** plus its current and historical search
   performance. The weights are not published.
2. **Personalized Difficulty = Keyword Difficulty − Topic Authority.** The honest edge case is stated outright: *"If you have no
   Topic Authority, then your Personalized Difficulty = Keyword Difficulty."* No authority is never turned into a penalty.
3. **Effort bands decide the shape of the plan**, not just its colour: PD 1–20 → optimise the page you already have if it matches,
   otherwise create one; 20–35 → that page plus one or two supporting pages; 35–50 → that page plus building out the cluster;
   50+ → "you likely lack a cluster and need to build the foundation".
4. **Thresholds are published**: look for topics with a Topic Authority of at least 5–10.
5. A **site inventory** of what already exists on each topic sits under all of it.

**Semrush Keyword Strategy Builder — a plan whose order is stated.**
([semrush.com/kb/1058](https://www.semrush.com/kb/1058-keyword-strategy-builder))

1. Up to 5 seeds → up to 10,000 keywords → **Topics, pillar pages and subpages**; pillars take the broad head terms and link to
   their subpages, subpages take long-tail subtopics and link back.
2. Pages are **ranked on five named factors**: relevance to the seed keywords, search volume, keyword difficulty, **domain
   diversity** and **SERP features**. The weights are not published, but the factors are.
3. Per page it shows the keywords with difficulty and volume, the page's SERP features and its **potential SERP competitors**.
4. **Presets** are editorial strategies made explicit — *Best for Strategy* (≤3 highly relevant, ≤3 low-difficulty/high-volume,
   ≤3 informational-or-commercial per topic), *Quick Conversions* (transactional/commercial only), *More Potential Traffic*.
5. Personalisation is a **thematic vector map**: the distance between a domain's core topics and the target topic lowers PKD.

**Keyword Insights — grouping by what Google actually does.**
([docs.keywordinsights.ai](https://docs.keywordinsights.ai/learning-center/the-features/keyword-clustering/))
Each keyword's **top 7 results** are compared; keywords sharing 40%+ of their URLs form a cluster — explicitly offered as more
accurate than NLP labels. The clusters then answer three product questions: one page or several, which clusters rank badly (a
content gap), and which pages cannibalise each other.

**What they all refuse to do.** None of them promises a ranking date, and MarketMuse states the no-data case as a rule rather than
hiding it. That is the bar the programme says to copy.

---

## 3. What we do, from the live evidence

Both ladder runs of the two re-rating passes, read from their own output:

| Run | Execution | Ladder | What came out |
|---|---|---|---|
| 2026-10-13 run 6 | **494 → 495** | `lad_mv5pjt5y4aoa` "erp implementation dubai" | *Reachable for your site · Short ladder · 4–8 months*, feasibility GO_WITH_CHANGES 68, **5 pages** (4 on rung 2 + the main page), order "supporting pages first", ~45 visits/month potential, chance *fair 30–50%* carrying the Ahrefs 2025 base rate and the word **uncalibrated**, link map up/sideways/down — and **reach 10, from a cached 2026-10-08 measurement** |
| 2026-10-13 run 7 | **520 → 521** | same | the rung-2 page, 2,891 words |
| 2026-10-14 run 6 | **548 → 549** | `lad_mv8auur8kz49` "azure cloud migration dubai" | a 2-page ladder scored "winnable 68" **from a pool of one keyword on a SERP that had failed twice** — the worst run of the set |
| 2026-10-14 run 7 | **554** | same | the rung page, 2,648 words, shipped as a **draft** that failed its quality gate |
| 2026-10-14 run 18 | **569 → 570** | all | 6 ladder reports with SERP features, share of voice and mobile; "peppol uae" at #47 |

**Already closed since those runs (verified in the code today, not assumed):**

- Exec 549's failure mode cannot recur: `Ladder_Plan.js` refuses a plan outright when `pool_size < 3`, when the pool is under 5 and
  the head keyword itself has no volume *and* no difficulty, or when the head SERP could not be read — `feasibility.status` becomes
  `not_checked`, the score is `null`, `write_now` is empty and `Ladder Rows` stores nothing (R23).
- Every rung keyword passes `RAD.headFit` against the head (half of the head's meaningful words), and what is left out is listed
  with its reason in `off_topic_keywords` (R23).
- A rung page's word target is the median length of the pages read on the topic's SERP, then the main page's target, then the
  competitor analysis, then a stated default — **never 0** — and the row says which (R22).
- The fit gate refuses other companies' brands, government and portal queries and navigational searches **twice** (pool and plan),
  with a reason per refusal (D8); a rival on a subdomain is reduced to its registrable domain (R21).
- A planned page keeps its slug and its planned links into the page run (R15); `takenBy` / `dupHead` enforce one search → one page
  across every ladder of the site (K8's own-site half); the pile-up guard counts ladder pages (D5).
- `topic_radius` (`_radius.js`) classifies every topic of the plan *within reach / a stretch / out of reach* with the evidence, and
  is **shown, never enforced** (G32).

**What the code still did, before this pass:**

1. **One reach per website, for every topic.** `_reach.js` computes `reach` as the 75th-percentile difficulty of the site's top-10
   keywords across the *whole domain*, caches it for 30 days under `reach:<site_id>`, and `difficultyForYou()` measures every
   keyword of every ladder against that one number. Run 494 is the proof in one line: *"reach 10 from a cached 2026-10-08
   measurement"* — the 2026-10-08 measurement was taken during e-invoicing research, and it then decided the plan type, the rung
   bands, the month range and the chance band for an **ERP implementation** ladder. This is K1's own wording: *"domain-level, not
   per topic"*.
2. **The plan never counted what the site already had on the topic.** `findExisting` decides improve-vs-new per page (D11), but
   nothing aggregated it: a plan opened with five pages and said nothing about the pages already live on the same topic.
3. **The order was unexplained.** Pages are ordered by rung band (difficulty relative to reach) and, inside a rung, by the
   opportunity sum of their cluster — and neither number was printed anywhere. `write_now` carried the keyword and the URL; "why
   this page first" could only be taken on trust.
4. **Rung clusters are AI topic labels, not shared results pages.** `Ladder_Plan` groups by `topic|page_type` with a cap of 6.
   The SERP-overlap kit **already exists** (`_kw_inputs.js` `KWI.serpClusters`, ≥3 shared top-10 URLs) and discovery uses it
   (`Rank_Keywords.js`, `Build_Keyword_Strategy.js`) — but the ladder's own pulls (`keyword_suggestions`, `related_keywords`,
   `keyword_ideas`, `ranked_keywords`) return `serp_info.serp_item_types` and **no URL list**, and `Ladder_Pool` initialises
   `competitors: []` and never fills it. So the ladder has no per-keyword URLs to cluster on.
5. **Nothing about the SERP's domain diversity** (Semrush's fifth factor) reaches the feasibility verdict; `avg_referring_domains`
   is the only competition signal in the opportunity score.
6. **The timelines are still uncalibrated** and say so (`REACH_CHANCE_NOTE`). That is G17, and it needs months of our own outcomes.

---

## 4. The gap

| # | What the leader does | What we did (before this pass) | Does it change the customer's outcome? | Criterion |
|---|---|---|---|---|
| 1 | Difficulty is personalised **per topic** (MarketMuse PD = KD − Topic Authority; Semrush PKD falls with thematic distance) | One cached reach per **website**, used for every topic — exec 494 planned an ERP ladder against a number measured on e-invoicing | **Yes, directly.** It sets the plan type, the rung bands, the month range and the chance band. A site strong on one topic is told an unrelated topic is equally reachable | **K1** |
| 2 | No authority on a topic → **PD = KD**, stated as a rule | The site reach was applied silently; nothing said which topic it was measured on | **Yes.** An unearned discount read as a measurement | K1 |
| 3 | The plan starts from a **site inventory** of the topic; effort bands begin with "optimise the page you have" | improve-vs-new decided per page, never counted or shown | **Yes.** The owner cannot see whether the plan duplicates work already done | K11 |
| 4 | Pages ranked on **five named factors**, each shown per page | Ordered by rung band then cluster opportunity; neither printed | **Yes, for trust.** An unexplained order is one a customer cannot argue with — or act on | K9, K11 |
| 5 | Clusters from **shared results pages** (top 7, 40%) | Rungs clustered by an AI topic label + page type; the SERP-overlap kit exists but the ladder has no per-keyword URLs | **Yes.** Two searches Google answers with the same pages can still become two pages | **K7** |
| 6 | **Domain diversity** of the SERP as a ranking factor | Not computed; only average referring domains | Marginal. A real signal, but `avg_rd` already carries most of it | K9 |
| 7 | Topics ≥ a published Topic Authority threshold (5–10) | `topic_radius` verdicts (in reach / stretch / far) with the evidence, shown and not enforced | No — **we are at or above the leader here**, because the radius names the evidence | K12 |
| 8 | Nobody promises a ranking date | Month ranges + a chance band labelled **uncalibrated**, with the Ahrefs 2025 base rate quoted | No — **we are ahead**; calibration is G17 and needs our own data | K10 |
| 9 | Cannibalisation across pages and clusters | One search → one page across ladders, plus page matching by slug/title/query | No — at parity on the own-site half; SERP-overlap cannibalisation is gap 5 | K8 |
| 10 | A plan that re-plans itself when it stalls | Stuck ladders produce a re-plan proposal, `applied: false` | No — **we are ahead**: the leaders do not propose a re-plan from tracked outcomes | K13 |

---

## 5. What to build

### (a) In reach now — **built in this pass** (build section 66, harness S76)

| Row | What | Size | State |
|---|---|---|---|
| **B2-1** | `reachTopic()` in the shared reach kit: the reach measured on the ladder's **own topic**, from the `ranked_keywords` pull the run already paid for, filtered with **the same `RAD.headFit` test the rungs use**. It replaces the site reach only with `REACH_CFG.min_top10` (5) on-topic top-10 keywords behind it; below that bar the site reach stays and the plan prints *which* number it used, *which topics* the site reach was really measured on, and *"treat the months and the chance below as the optimistic case."* Absence of on-topic wins never becomes a penalty — MarketMuse's own edge case, kept | M | **done** |
| **B2-2** | `topic_authority.coverage`: the pages the site already has on the topic, the searches it ranks for, its best position, and the plan's own improve-vs-new split — in the plan notes, the callback, and a report section of its own ("What you already have on this topic") | S | **done** |
| **B2-3** | `why` + `why_factors` on every planned page: difficulty against the reach actually used, keyword count, volume, intent, new-or-improve, links-up — in the report table, the callback and `write_now` | S | **done** |

Measured effect on the live shape: with 5 on-topic top-10 keywords at difficulty 8–16 behind it, a head keyword of difficulty 45
moves from *"reachable · short ladder · 4–8 months"* (against a site-wide 35) to *"hard · full ladder · 9–15 months"* (against the
14 the site has actually proved on that topic) — the plan changes, and the reason is printed. Cost: **$0**; every figure comes from
a pull the run already makes.

### (b) Needs money or an owner decision

| Row | What | Cost | Who decides |
|---|---|---|---|
| **B2-4** | **SERP-overlap clustering of the rung keywords** (gap 5, K7, the one place the rubric scores us at 5/10 by design). The kit exists; what is missing is per-keyword URLs. Cheapest route: a Labs `ranked_keywords` pull for the **top 3 competitor domains of the head SERP** (we already know them), which gives each pool keyword the competitor pages ranking for it — the same source discovery clusters on. Direct route: one SERP call per rung keyword, which is exact but priced per keyword | ≈ **$0.03–0.10 per ladder** for the competitor route; ≈ **$0.002 × 20–40 keywords = $0.04–0.08** for the direct route. Either sits inside today's $15/day ceiling, but it is a *new recurring* paid pull on every ladder run | **Owner**: is one page per shared results page worth ~$0.05 a ladder? (The DataForSEO account holds **$13.79** — top it up before any live run either way) |
| **B2-5** | **Domain diversity of the head SERP** as a stated feasibility factor (gap 6, Semrush's fifth factor). The data is already in `competitors_summary`, so the *build* is free — but it changes the feasibility score, and no re-rating should move a score without the owner knowing | $0 to build; changes a scored output | **Owner**: accept a feasibility score that moves when the SERP is owned by few domains |
| **G17** | **Calibrating the chance bands and the month ranges** against our own ladders. Unchanged: it needs months of tracked outcomes, and the text already says "uncalibrated" | $0 | Time, not money |

### (c) Deliberately not worth it

| What | Why not |
|---|---|
| **A −100…+100 "Topic Authority" score of our own** | MarketMuse publishes neither the weights nor a back-test, so a number on that scale would be an unfalsifiable invention. What the customer actually needs from it is the *difficulty they can win on this topic*, which B2-1 measures directly and can show its working for |
| **Topic Authority from "breadth and depth" of site content** (page counts, word counts, subtopic coverage) | We would be scoring ourselves on our own content rather than on results. The ranking evidence (what the site already wins on the topic) is strictly better evidence and is free |
| **Semrush-style presets** (*Quick Conversions*, *More Potential Traffic*…) | The goal (`leads` / `sales` / `traffic` / `brand`) already weights intent in `Ladder_Pool`'s scoring. A second, parallel way of saying the same thing would make two settings that can disagree |
| **A 10,000-keyword plan from 5 seeds** | Volume is not the constraint; the pile-up guard and "max 2 active ladders" exist because *publishing* is. A bigger plan would be a bigger backlog |
| **Clustering with an LLM instead of SERP overlap** | Keyword Insights' own documentation argues shared URLs beat NLP, and we already have the kit. Spending Claude tokens to do it worse is the wrong trade |

---

## 6. The single change that would most improve the customer's outcome

**Measure the difficulty a site can win *on the topic of the ladder it is about to climb*, and say plainly when there is not enough
evidence to measure it — because every other number in the plan (plan type, rung bands, months, chance) is derived from that one
figure, and until today it was a site-wide average cached for thirty days.**

---

## 7. Proposed register rows (for `FIX_PLAN.md` §3.14 — the orchestrator moves these; this file does not edit the register)

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B2-1 | **One reach per website decided every topic's plan.** `_reach.js` caches a single 75th-percentile difficulty per site for 30 days and `difficultyForYou()` measures every ladder against it: exec 494 (`lad_mv5pjt5y4aoa`, "erp implementation dubai", 2026-10-13) was planned against *"reach 10 from a cached 2026-10-08 measurement"* taken during e-invoicing research. The leaders personalise per topic (MarketMuse PD = KD − Topic Authority; Semrush PKD falls with thematic distance to the domain's core topics) | **High** (it sets plan type, rung bands, months and the chance band) | `v5/code/_reach.js`, `v5/code/Ladder_Plan.js` | `reachTopic()` measures the reach on the ladder's own topic from the `ranked` pull already made, with the same `RAD.headFit` test the rungs use; used only with 5+ on-topic top-10 keywords behind it, otherwise the site reach stays and the plan says which number it used and calls itself the optimistic case | fixed 2026-10-15 (build section 66, S76); not deployed |
| B2-2 | **A plan never counted what the site already had on its topic.** `findExisting` decided improve-vs-new per page but nothing aggregated it, so a plan opened with new pages beside pages already live on the same topic. MarketMuse opens from a site inventory and its effort bands start at "optimise the page you have" | Medium | `v5/code/Ladder_Plan.js`, `v5/code/Build_Ladder_Report.js` | `topic_authority.coverage`: pages on the topic, searches ranked for, best position, improve-vs-new split — in the notes, the callback and a report section of its own | fixed 2026-10-15 (build section 66, S76); not deployed |
| B2-3 | **The order of the plan was unexplained.** Pages are ordered by rung band then by the opportunity sum of their cluster, and neither was printed. Semrush names its five ranking factors per page | Medium | `v5/code/Ladder_Plan.js`, `Build_Ladder_Report.js`, `Build_Ladder_Response.js`, `app/web/src/components/reports/ladder.tsx` | `why` + `why_factors` per planned page, into the report, the callback and `write_now` | fixed 2026-10-15 (build section 66, S76); not deployed |
| B2-4 | **Rung keywords are clustered by an AI topic label, not by shared results pages** (K7). `KWI.serpClusters` exists and discovery uses it, but the ladder's pulls return no per-keyword URLs (`Ladder_Pool` initialises `competitors: []` and never fills it), so two searches Google answers with the same pages can become two pages | Medium | `v5/code/Ladder_Requests.js`, `Ladder_Pool.js`, `Ladder_Plan.js` | add a `ranked_keywords` pull for the top 3 competitor domains of the head SERP (≈ $0.03–0.10 a ladder) and feed `KWI.serpClusters` — or one SERP call per rung keyword for exactness | **open — owner decision on the recurring cost** |
| B2-5 | **The SERP's domain diversity never reaches the feasibility verdict** — Semrush's fifth ranking factor. The data is already in `competitors_summary`, so the build is free, but it moves a scored output | Low | `v5/code/Ladder_Plan.js` feasibility | count distinct registrable domains in the head top 10 and carry it into the feasibility reasons | **open — owner decision (it changes a score)** |
| B2-6 | **K7's anchor is out of date.** Keyword Insights, the source of the shared-URL convention, now compares the **top 7** (not 10) "because Google no longer reliably shows 10 traditional links", at a 40% default threshold | Low (rubric accuracy) | `CRITERIA_keywords_content.md` K7 — **frozen**, not to be edited | record the new statement beside the old one here; re-baseline only on the owner's say-so | **open — owner decision (re-baseline)** |

---

## Appendix — how this was checked

- Build: `python3 build_v4.py`, exit **0**, main workflow **503 nodes**.
- Harness: **4541 passed, 0 failed** (baseline before this pass: 4505). New scenario **S76**, 23 assertions, including the kit's own
  edge cases (4 on-topic top-10 keywords is below the bar; a pull that failed is not "zero"; a homepage with no words of its own is
  not "a page about the topic").
- App: `tsc -p web/tsconfig.json` clean, `npm test` green (239 server tests), one changed file
  (`app/web/src/components/reports/ladder.tsx` — the "Why this plan" block now prints the site-wide reach as the site-wide reach and
  the topic sentence beside it).
- **No paid API call was made.** Every competitor claim above carries a page that was opened; where a mechanism cannot be verified
  without a paid account (MarketMuse's Topic Authority weights, Semrush's factor weights) the text says the weights are not
  published rather than guessing them.
- Nothing was deployed. `apply_env.py` was not run.
