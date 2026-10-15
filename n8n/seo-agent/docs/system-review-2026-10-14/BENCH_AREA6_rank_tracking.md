# Area 6 — Rank tracking, against the best tool available in October 2026

**Pass run 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score on the books: **6.0**
(`../system-review-2026-10-13/SCORECARD.md`), which was given **before most of the rank-tracking work landed** — G6 (the whole
results page from the same call), R16, R18, G28 and B-G3 all post-date or barely pre-date it, so it is not a description of what the
tracker does today. What follows reads the code and the **2026-10-14** run (`RESULTS.md` here, executions 569→570) and the
**2026-10-13** run (`../system-review-2026-10-13/RESULTS.md`, executions 503→505) as "what we do", and the frozen
`../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md` §2 (criteria 2.1-2.14) as the yardstick. The CRITERIA
file is untouched.

Every competitor claim below carries a URL that was **opened in this pass** (listed in §8). Where something could not be verified
without a paid seat it says so.

---

## 0. Read this first — one thing the brief said was fixed is not, and one thing nobody was looking at was wrong

1. **The AI Overview click-loss constant was still the April 2025 figure in this area's own kit.** The brief states that today's
   B1-3 corrected it and that "that constant lives in `_rank_serp.js` too, so check what it is now". It was **still `const
   ORGANIC_LEFT_WITH_AIO = 0.65;`** — B1-3 changed `_kw_inputs.js` only. The share of voice in every rank-tracker report, and in the
   Site Tracker's own SERP reading (`Parse_Site_SERP.js` inlines the same kit), was computed with it. Fixed in this pass (B6-1), and
   with the measured **per-position** table rather than one average, because the loss is 58.0% at #1 and 19.4% at #10 — a flat factor
   applied to every position very nearly cancels out of a *share*, which is why an AI Overview cost the top of page 1 almost nothing
   in our numbers. **`v5/code/Ladder_Pool.js` line 61 still multiplies by `0.65`** — that is area 2's file and this pass did not touch
   it; register row **B6-9**.
2. **Two of the seven Google updates in our dated registry never happened.** `v5/data/seo_events.json` carried a *"June 2026 core
   update"* and a *"September 2026 core update"*, and misdated the December 2025 and March 2026 core updates by weeks. Google's own
   ranking history has no update by either name: it has a **May 2026 core update** (21 May – 1 Jun), a **September 2026 spam update**
   (24 Sep – 7 Oct) and a December 2025 core update starting **11 Dec**, not 2 Dec. That registry is the one place the Rank Tracker's
   chart marks, the Site Tracker's alert sentences (`ST.updateNote`) and the app's charts all read, so an **invented** Google update
   was being handed to customers as the context for a real fall — criterion 2.12's exact subject. Re-read from the Search Status
   dashboard and corrected in this pass (B6-4). Nobody had asked where those dates came from.

Neither was on the brief's "already fixed" list in the form it found them, and the second was not in the register at all.

---

## 1. The leader today

**The rubric names AccuRanker / Semrush Position Tracking. Both are still alive, still leaders, and still the right comparison — but
one of them is changing the very metric the rubric scores us on, this month.**

| Tool | What it leads on, October 2026 | Verified |
|---|---|---|
| **Semrush Position Tracking** | Daily, "generally updated daily within 24-48 hours", **no manual refresh** ("Updates are automatic and cannot be scheduled manually"); daily points kept 60 days then weekly for 140 weeks; desktop / mobile / tablet; ZIP-level targeting; up to 20 competitors + a Competitors Discovery tab; a **Cannibalization** tab; a **Sensor** personal volatility score for the campaign's own keywords | [update frequency](https://www.semrush.com/kb/326-how-often-does-the-position-tracker-update-its-data), [Sensor](https://www.semrush.com/kb/652-sensor) |
| **AccuRanker** | On-demand refresh is its whole pitch; **Share of Voice is being replaced in October 2026** (see below); the public **Google Grump** volatility index | [Share of Voice update, 2 July 2026](https://www.accuranker.com/blog/share-of-voice-update/), [Share of Voice help](https://accuranker.com/help/overview/share-of-voice), [Grump](https://accuranker.com/grump) |
| **Ahrefs Rank Tracker** | **Weekly** on its own product page; mobile and desktop; "From country, to city, to ZIP code", 190+ locations; **19 SERP features including AI Overviews**; a target URL per keyword with a warning when it is **outranked**; Share of Voice and Share of Traffic Value | [rank-tracker](https://ahrefs.com/rank-tracker) |

**Three corrections to the rubric's own text** (programme rule 1 — the old statement is kept, the CRITERIA file is unchanged):

- Old (2.a): *"AccuRanker: … share of voice"*. New, 2026-10-15: AccuRanker announced on **2 July 2026** that it is **merging its two
  Share of Voice metrics into one configurable metric**, cutting over in **October**: you pick a CTR model (their ML "dynamic CTR" or
  the static per-rank model, "rank 1 ≈ 31.2% of clicks") **and** a search-volume source (their own AR Search Volume or Google Keyword
  Planner), with a new **Share of Voice %** expressed against the maximum achievable per keyword. Accounts that change nothing default
  to dynamic CTR + AR volume, "which may change the numbers you currently see". **The convention this criterion is scored against is
  moving while the criterion is frozen.**
- Old (2.a): *"AccuRanker … AI Overviews / LLM tracking"* as part of the tracker. New: AI/LLM visibility is a **separate product**,
  AccuLLM, on AccuRanker's own features page — not a column in the rank tracker.
- Old (2.a): *"AccuRanker: Google Grump … "*. The index's published method is **"the average number of rank changes across the top 30
  results for ~1,000,000 high-volume keywords"**, by country and device. A widely repeated third-party figure of *30,000 keywords over
  the top 100* is wrong against AccuRanker's own page — this is the "verify rather than assume" case the brief warned about, and the
  search snippet was the thing that was wrong.

**Also worth recording against 2.1:** Ahrefs' product page states **"Weekly"** as its update frequency, flatly. The rubric's own
"(U)" on "daily on higher plans" stands — nothing on the page claims daily. So on frequency the field is not uniformly daily, and our
weekly cadence is Ahrefs parity, not a generation behind.

---

## 2. What the leaders do, mechanism by mechanism

**Frequency, and the refresh.** Semrush is daily and explicitly **cannot** be refreshed by hand; Ahrefs is weekly; AccuRanker's
differentiator, per every third-party test, is near-instant on-demand updates. The product question is not "daily or weekly" but
**"can the owner re-check a keyword the hour after they changed the page"** — and the two biggest suites say no.

**Device and location.** Ahrefs: mobile and desktop, "from country, to city, to ZIP code", 190+ locations. Semrush: desktop, mobile
and tablet with ZIP-level targeting. Neither treats a device as an extra you buy per keyword; both treat it as a property of the
campaign.

**SERP features.** Ahrefs tracks **19**, AI Overviews among them. Semrush's Sensor additionally tracks SERP-feature *presence* across
categories, countries and devices, so a customer can see a feature appearing market-wide and not only on their own page.

**Share of voice.** The two conventions are different and neither is ours:
- **Ahrefs**: "Total clicks your target receives from all Tracked keywords" ÷ "Total clicks going to all result in the SERP … for all
  Tracked keywords" — a **portfolio** ratio over the whole keyword set, where a head term weighs what its clicks weigh.
- **AccuRanker**: CTR × search volume per keyword, summed; **only positions 1-20 count**; it warns that brand keywords skew it and
  offers per-keyword exclusion; "SoV $" is CPC × SoV.
Both are **volume-weighted**. Both publish the shape of the formula; **neither publishes the CTR curve itself**, and Semrush's Sensor
formula is stated to be proprietary.

**The volatile day.** This is the question the area is judged on, and both leaders answer it the same way: with a **market-wide index
computed on somebody else's keywords**. Semrush's Sensor is "SERP volatility on a scale of 0-10", banded by Semrush itself as
"0-2 low, 2-5 normal, 5-8 high and 8-10 very high", with a **Personal Score** available for a Position Tracking campaign's own
keywords (SEO Toolkit only; its formula is not published). AccuRanker's Grump compares each URL's position among the top 30 with the
previous day across ~1,000,000 keywords and reports a mood, with **no numeric scale and no guidance at all on what to do on a
grumpy day** — its own page does not say.

**What nobody does.** Not one of the three publishes, per tracked keyword, *how much that keyword's own results page changed between
the owner's two readings*. The market index tells you the weather; it does not tell you whether your street flooded.

---

## 3. What we do, from the live evidence

| Mechanism | What we actually produced |
|---|---|
| **Frequency (2.1)** | Weekly, Monday 08:00 (`SEOagentTracker1`), plus *Manual Run*. A **won** ladder (main keyword in the top 3 for four checks) drops to monthly; an unpublished rung that was not in the top 50 drops to every 28 days. Exec **570** (2026-10-14) ran 6 ladder reports in **20 s**; exec **505** (2026-10-13) 5 reports and **15 SERP checks** in 19 s for ≈ $0.03 |
| **Depth and proof (2.2)** | `depth: 50` per check (~$0.015; depth 100 measured at $0.028 and `num=100` is gone, R1). **Every reading stores a snapshot** of the top 10 with URLs and trimmed titles in `seo_rank_history.snapshot_json`, packed under 1,800 characters |
| **Device (2.3)** | Desktop for every tracked keyword; **mobile** for the ladder's main keywords (top rung + page 1), at most 2 a ladder, re-bought after 6 days. Exec 505: 15 checks were desktop **and** mobile. Mobile never enters the desktop series, the won rule or the rungs |
| **Location (2.4)** | `location_code` from the ladder row — **country only** |
| **SERP features (2.5)** | Six, from the answer the check already pays for: AI Overview (shown / cites us / sources loaded / which domains), featured snippet (and whose), People Also Ask with its questions, local pack, video, shopping. Exec 570 printed *"AI Overview seen in 2 of 2 checks (seen in the check at 16:21 UTC on 2026-10-14…)"* with what it cited |
| **Share of voice (2.6)** | Modelled per keyword from a published CTR curve, feature-weighted, with the method printed in the mail — *"Not measured clicks"* (exec 505 printed the whole sentence). Corrected today (B6-1) |
| **Competitors (2.13)** | The top-10 domains with positions, who is above us, and the site's declared competitors' positions from the same answer (exec 505: `cleartax.com #16` for "e invoicing in uae"), with page-1 domains nobody declared kept too, up to 20 |
| **Next step (D16)** | Exec 570: *"The main page is live: improve the main page 'peppol uae' — it is https://www.techand.ai/insights/…"*; exec 505 produced a different, correct step for each of five ladders |
| **Honesty on a failed check (R18 / D26)** | `position: -1` and `share_of_voice: -1` mean **"check again"**, never "does not rank"; every feature flag is `null`; the snapshot stores `unavailable`. Since B-A10 the call is also **re-sent** and the report carries what the week's checks did |
| **Alerts (2.11)** | A fixed rule: a move of **±5 places** is a gain or a drop. No statistical test, no channel, no per-keyword threshold |
| **Cost (2.14)** | The run reserves and settles a `seo_run_ledger` row (R9/R17). Until today **nothing told the customer what the week cost** |
| **The real outcome** | Exec 570: *"peppol uae" moved from not in the top 50 to **#47**.* That is the whole visible result of the week |

**And what the owner could not tell from any of it:** whether #47 was the site climbing or the page being rewritten under it. Exec
570's drops and gains are a keyword, an arrow and two numbers.

---

## 4. The gap

| # | What the leader does | What we do | Does it change the customer's outcome? | Criterion |
|---|---|---|---|---|
| **G6-1** | **AccuRanker**: re-check a keyword on demand, in seconds — the reason people buy it. Semrush explicitly cannot | Weekly, plus a *Manual Run* that only an operator can start. **No customer-facing "check this now"** anywhere in the app | **Yes.** The hour after a page is republished is exactly when the owner wants to look, and the honest answer "a position moves over days, not minutes" is a *reason to offer the check with that caveat*, not a reason to withhold it | 2.1 |
| **G6-2** | Semrush daily | Weekly (monthly for won ladders) | Yes, but it is money and a host: ~$0.015 a keyword a check, and **D25a** (a Mac that sleeps is not a daily tracker) | 2.1 |
| **G6-3** | Ahrefs: country → city → **ZIP**, 190+ locations; Semrush ZIP-level | **Country only** | Yes for any local business — the criterion caps us at 4 for it. DataForSEO sells city location codes; the blocker is the app and the ladder row, not the provider | 2.4 (cap 4) |
| **G6-4** | Ahrefs tracks **19** SERP features | **6** | Some. The six are the ones that take clicks; the missing ones (site links, images, Twitter/X, top stories, knowledge panel, FAQ…) are mostly context, and every one is already in the stored answer | 2.5 |
| **G6-5** | Both leaders treat mobile as a property of the campaign | Mobile for **≤ 2 main keywords per ladder** | Some. Only 13% of sites hold the same position on both devices (R2), so a rung page's desktop position is one most visitors never see. It is $0.015 a keyword a week | 2.3 |
| **G6-6** | Share of voice is **volume-weighted across the whole keyword set** (Ahrefs: clicks to you ÷ clicks to the whole SERP, all tracked keywords; AccuRanker: CTR × volume, positions 1-20) | Per keyword, page 1 only, then an **unweighted arithmetic mean** of the percentages across the ladder's keywords | Yes. A 40% share of a keyword nobody searches counts exactly as much as 4% of the head term. We hold no volume in the tracker — but we hold the site's own **Search Console impressions** per query, which is better than a provider's estimate | 2.6 |
| **G6-7** | Semrush has a **Cannibalization** tab | Nothing in the tracker. The cadence and the pipeline refuse a second page for the same search (D11), which prevents it rather than detecting it | Some — and we have the evidence to detect it free: two of our own URLs in one stored snapshot is cannibalisation, observed | 2.10 |
| **G6-8** | A tracker tracks **whatever keyword list you give it** | `Tracker Plan` reads **`seo_ladders` only**: if a keyword is not a rung of a ladder, the rank tracker does not know it exists | **Yes, and it is the structural one.** A customer who wants 30 keywords watched cannot have them watched. (The Site Tracker does live checks of `seo_sites.keywords` — a different workflow, a different table, a different report; area 7) | 2.1 / 2.13 |
| **G6-9** | Ahrefs: a target URL per keyword and a warning when it is **outranked**; Semrush's Sensor personal score | A **fixed ±5 places** rule, in one weekly e-mail. No channel, no threshold, no "a competitor took your page" | Yes. G28 gave the *Site Tracker* statistical alerts and the rank tracker kept the 2026 rule from v4.2 | 2.11 |
| **G6-10** | Semrush keeps daily points 60 days, then weekly for 140 weeks | Every reading kept for ever in `seo_rank_history`, **with its SERP snapshot** | **No — we are ahead.** SE Ranking's cached SERP is the nearest equivalent and neither Semrush nor Ahrefs publishes one | 2.2 |

### Where the leaders are weaker, and we are right

1. **The volatile day is answered for the keyword, not for the market.** As of this pass, a drop in our report says *"the whole
   results page moved that week (10 of the top 10 places changed), so this is not necessarily about your page"* or *"the rest of the
   results page barely moved (0 of the top 10 places changed), so this move is your page"* — **measured**, from two readings we
   already stored, for that keyword. Semrush and AccuRanker both answer with an index built on other people's keywords.
2. **The CTR model is printed.** Ours travels with the figure, in full, every time ("28/15/11/8/7/5/4/3.5/3/2.5%; … 58.0% of the
   clicks gone at #1 … Not measured clicks"). AccuRanker's is a setting you choose between two models; Semrush's Sensor formula is
   stated to be proprietary.
3. **A reading that failed is not a position.** `-1` is "check again" everywhere — the row, the share of voice, the features, the
   snapshot and now the movement. No leader's documentation describes an equivalent.
4. **An AI Overview is an observation, not a property of the query.** "Seen in 2 of 2 checks, at 16:21 UTC on 2026-10-14 — AI
   Overviews vary between searches", and "whether it cites you was not loaded" instead of "no".
5. **Proof of the reading.** The stored top 10 with URLs is what made this pass's whole measurement possible for free. It is also what
   lets a customer argue with us.

---

## 5. What to build

### (a) In reach now

| # | Item | Size | Status |
|---|---|---|---|
| **a1** | **How much the results page itself moved**, measured per keyword from the two stored snapshots, beside every gain and drop | M | **Built in this pass** (§6, B6-2) |
| **a2** | **The AI Overview click loss, measured position by position** in the share of voice | S | **Built in this pass** (§6, B6-1) |
| **a3** | **The Google update that ran inside the compared window**, named beside the moves | S | **Built in this pass** (§6, B6-3) |
| **a4** | **A registry with no invented Google update**, re-read from the Search Status dashboard | S | **Built in this pass** (§6, B6-4) |
| **a5** | **What the week's checks cost**, and what a keyword costs a month (criterion 2.14) | S | **Built in this pass** (§6, B6-5) |
| **a6** | **Two of our own URLs in one stored snapshot is cannibalisation** — detect it from data already kept, name both pages, and say which one Google prefers today | S | Register row **B6-6** |
| **a7** | **Track a keyword that is not a ladder rung**: let `seo_sites.keywords` (already stored, already in the app's tracking form) feed `Tracker Plan` as a second source, with its own cap and its own cost line | M | Register row **B6-7** |
| **a8** | **A statistical-shaped alert rule to replace "±5 places"**: a move is reported as the site's own only when the page around it held still, as "the page moved" when it did not, and never at all when the previous reading could not be compared. The measurement for it now exists | S–M | Register row **B6-8** |
| **a9** | **`Ladder_Pool.js` still multiplies by 0.65** — the same April 2025 figure, in area 2's file | S | Register row **B6-9** |
| **a10** | **An "outranked" line** (Ahrefs parity): the ladder row already knows its target URL and the snapshot knows who holds the places above it — say *who* took the place, not only that the number fell | S | Register row **B6-10** |

### (b) Needs money or an owner decision

| # | Item | Cost | Who decides |
|---|---|---|---|
| **b1** | **Daily checks (2.1).** ~$0.015 per keyword per check: a 15-keyword ladder is ≈ $0.23 a day, ≈ $7 a month against ≈ $0.60 today — and it needs **D25a**, an always-on host, before "daily" means anything | ≈ $7 / ladder / month + the host | Owner |
| **b2** | **On-demand refresh (G6-1).** The engine side is small (the Manual Run path exists); it is an app button, a rate limit and a cost rule, and it must carry the caveat that a position moves over days | S–M, plus ~$0.015 a press | Owner (product) |
| **b3** | **City / ZIP tracking (2.4).** DataForSEO sells the location codes; the work is in the app, the ladder row and the onboarding question "where do your customers search from" | $0 extra per check, M of work | Owner (product) |
| **b4** | **Mobile for every tracked keyword (2.3).** $0.015 a keyword a week — a 15-keyword ladder goes from ≈ $0.13 to ≈ $0.98 a month for mobile | ≈ $0.85 / ladder / month | Owner, per site |
| **b5** | **Volume-weighted share of voice (G6-6).** Weighting by the site's own Search Console impressions is free but needs `seo_query_history` loaded into the tracker; weighting by provider volume costs a keyword-data call per keyword | $0 (first-party) or ≈ $0.01 / keyword / month | Owner |

### (c) Deliberately not worth it

| # | Item | Why not |
|---|---|---|
| **c1** | **Our own market-wide volatility index** (a Grump / Sensor of our own) | It needs ~1,000,000 keywords checked daily to mean anything. AccuRanker's own page gives no scale and no guidance for acting on it, and Semrush's number is unexplained. The per-keyword measurement we built instead answers the question the owner actually has, costs nothing, and is specific to them |
| **c2** | **Chasing 19 SERP features** | The six we read are the ones that take clicks. The rest would be columns that nobody acts on, and every one is already inside the answer we store, so a future need is a parsing change and not a purchase |
| **c3** | **Top 100 depth** | Google stopped serving `num=100` in September 2025 (R1), so depth 100 is ~1.9× the price (measured $0.028 vs $0.015) for positions 51-100 that a ladder will never act on. Depth 50 with the coverage stated is the honest trade |
| **c4** | **Tablet tracking** (Semrush has it) | No evidence of a tablet-specific result set worth the third reading, and nothing in our customers' data asks for it |
| **c5** | **A proprietary, tuned CTR curve** | The one thing the last three runs punished hardest is a number whose basis is not printed. A published curve we can cite beats a better-fitting one we cannot |

---

## 6. What this pass built

**Build section 78, harness S88** (29 new checks, `4953 → 5010 passed, 0 failed`; build exit 0 with `SEO_BUILD_ALLOW_DEFAULTS=1`,
because a git worktree has no `n8n/.env`; **nothing deployed**).

**B6-2 — the volatile day, answered for this keyword.** `RS.churn` compares this reading's stored top ten with the previous reading's
for the same keyword **and the same device**: how many places changed occupant, how many URLs entered and left, and how far the URLs
present in both moved. Every gain and drop now carries the answer, the results-page table has a **Page movement** column, the ladder
summary counts what moved and what could not be compared, the app gets `serp_change` on each keyword's row, and the figure has its own
lineage row. It is **measured** and free — it comes out of what G6 already stored. The still / some / high labels are named **a stated
rule, not a measurement**, because no tool publishes a per-keyword threshold. Five things make it refuse with a reason instead of
returning a quiet zero — which would read as "it did not move": no earlier reading, a check that could not be read, two readings of
different devices, a snapshot the packer trimmed below the comparable depth, and a keyword nobody bought a check for this week.

**B6-1 — the AI Overview click loss, per position.** `ORGANIC_LEFT_WITH_AIO = 0.65` is gone. `AIO_KEEP` is Ahrefs' December 2025
table (0.420, 0.492, 0.536, 0.612, 0.674, 0.695, 0.703, 0.712, 0.703, 0.806); the pool the overview takes is now summed position by
position and the method string carries the study, its size, its date and its URL. The share of voice totals are conserved, so the
change is in *shape*: an AI Overview now costs the top of page 1 what was measured for it, and the leader of an organic list keeps
about **42%** of the share it holds without one, where the flat factor left it **67%**.

**B6-3 — the window these positions are compared over.** The oldest reading in the report sets the window; a Google update or a data
break inside it is named with its dates and the sentence that it "may be part of the cause, which cannot be proven from these
positions". A week with nothing in it says nothing.

**B6-4 — the registry.** Re-read from Google's Search Status dashboard: two invented updates removed, four real ones added (February
2026 Discover, March 2026 spam, May 2026 core, August 2026 spam), four dates corrected, every name copied as Google writes it, and the
source plus the fact that `end` is derived from Google's published duration recorded in the file itself. The build now refuses a
registry carrying either invented name or an entry not named the way Google names one. The app's generated copy and its test moved
with it.

**B6-5 — the week's bill.** The in-200 gate already read the provider's own cost for exactly these calls and it reached the callback;
the report prints it now, with what a keyword costs a month at this frequency — and when the provider reported no cost, it says that
instead of inventing one.

**Also fixed on the way:** the "Before" column now shows the date of a reading older than ten days, so a won ladder's monthly check and
an unpublished rung's 28-day check stop being read as last week.

Files: `v5/code/_rank_serp.js`, `v5/code/Tracker_Report.js`, `v5/data/seo_events.json`, `build_v4.py` section 78,
`build_ladder_extras.py`, `harness/scenarios_v5.js` S88, `app/shared/src/annotations.test.ts`.

---

## 7. The one change that would most improve the customer's outcome

**Let the tracker watch the keywords the customer actually named, not only the rungs of a ladder** — today a rank tracker that reads
`seo_ladders` and nothing else cannot answer "how am I doing for the thirty searches my business lives on", which is the question
every competing tool is bought to answer; everything else in this area is depth on a tracker that is watching too narrow a list.

---

## 8. Sources opened for this section

- Semrush — [how often Position Tracking updates](https://www.semrush.com/kb/326-how-often-does-the-position-tracker-update-its-data) (daily within 24-48 h, no manual refresh, 60 days of daily points then 140 weeks of weekly), [Sensor](https://www.semrush.com/kb/652-sensor) (0-10, "0-2 low, 2-5 normal, 5-8 high and 8-10 very high", Personal Score from a Position Tracking campaign, proprietary formula)
- AccuRanker — [Share of Voice is changing, 2 July 2026](https://www.accuranker.com/blog/share-of-voice-update/) (two metrics merged into one configurable metric in October; dynamic vs static CTR; AR Search Volume vs Keyword Planner; new Share of Voice %), [Share of Voice help](https://accuranker.com/help/overview/share-of-voice) (CTR × volume, positions 1-20 only, brand-keyword caveat, SoV $), [Google Grump](https://accuranker.com/grump) ("the average number of rank changes across the top 30 results for ~1,000,000 high-volume keywords", by country and device; no scale, no guidance), [features](https://accuranker.com/features/) (AccuLLM is a separate product)
- Ahrefs — [Rank Tracker](https://ahrefs.com/rank-tracker) (weekly; mobile and desktop; "From country, to city, to ZIP code", 190+ locations; 19 SERP features including AI Overviews; outranked warnings; Share of Voice and Share of Traffic Value), [What is Share of Voice and how is it calculated](https://intercom.help/ahrefs/en/articles/2072381-what-is-share-of-voice-sov-and-how-is-it-calculated) (clicks to your target ÷ clicks to all results, over all tracked keywords), [AI Overviews reduce clicks — update](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/) (300,000 keywords, December 2023 vs December 2025, published 2026-02-04; −58.0% at #1, −50.8% at #2, −46.4% at #3 … −19.4% at #10)
- Google — [Search Status Dashboard: ranking updates history](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history) (the first-party list; starts and durations, most recent the September 2026 spam update from 24 Sep 2026)

**Not verified** (search results only, no page opened, so not relied on above): AccuRanker's current pricing and its claimed
on-demand refresh latency; Semrush's 20-competitor limit and its Cannibalization tab's plan gating; Semrush's "98,000 locations".
Where a mechanism needs a paid seat — AccuRanker's dynamic CTR model, Semrush's Sensor formula, the Personal Score — nothing is
asserted about it beyond what the vendor's own page states.

---

## 9. Proposed register rows

For `../system-review-2026-10-11/FIX_PLAN.md` §3.14 — the orchestrator moves these in; this agent edited no register.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B6-1 | **The share of voice still cut every position by 0.65, the April 2025 AI Overview figure**, after B1-3 corrected the keyword research the same day. The current study (Ahrefs, 300,000 keywords, December 2025 data, published 2026-02-04) measures the loss **per position** — 58.0% at #1, 19.4% at #10 — and a flat factor applied to every position all but cancels out of a *share*, so an AI Overview cost the top of page 1 almost nothing in our own numbers. The same kit is inlined into the Site Tracker's SERP reading | **High** (a wrong figure, printed to the customer with its method, in two workflows) | `v5/code/_rank_serp.js` | `AIO_KEEP` per position; the pool the overview takes summed position by position; the method string carries the study, its size, its date and its URL | fixed 2026-10-15 (build section 78, S88); not deployed |
| B6-2 | **Nothing said whether the page itself moved.** Exec 570 printed *"peppol uae (not in top 50 → #47)"* and exec 505 printed its drops the same way: a page that slipped and a page pushed down by a results page rewritten under it were indistinguishable. The leaders answer with a market-wide index on other people's keywords (Semrush Sensor, AccuRanker Grump); the proof for a per-keyword answer was already in `seo_rank_history.snapshot_json` | **High** (the question the area is judged on, unanswered) | `v5/code/_rank_serp.js`, `v5/code/Tracker_Report.js` | `RS.churn` over the two stored readings, same keyword and same device; every gain and drop carries the clause; a Page movement column, a summary count, `serp_change` in the callback and a lineage row; five refusal paths with reasons instead of a zero | fixed 2026-10-15 (build section 78, S88); not deployed |
| B6-3 | **A Google update inside the window the positions are compared over was never named beside the moves.** The marks existed for the chart at the bottom of the mail, over the ladder's whole life; the drops at the top had no context (criterion 2.12) | Medium | `v5/code/Tracker_Report.js` | the oldest compared reading sets the window; updates and data breaks inside it are named with their dates and "cannot be proven from these positions"; silence when there are none | fixed 2026-10-15 (build section 78, S88); not deployed |
| B6-4 | **Two of the seven Google updates in the dated registry never happened**, and four dates were wrong. `v5/data/seo_events.json` carried a "June 2026 core update" and a "September 2026 core update" on dates Google never published, and misdated the December 2025 and March 2026 core updates by weeks. It feeds the Rank Tracker's marks, the Site Tracker's alert sentences and the app's charts, so an invented update was handed to customers as the context for a real fall | **High** (a fabricated external fact, in three products) | `v5/data/seo_events.json`; `app/shared/src/seo-events.generated.ts` and its test | re-read from Google's Search Status dashboard; names copied as Google writes them; the source and the fact that `end` is derived from Google's published duration recorded in the file; the build refuses either invented name or an entry not named as a core / spam / Discover update | fixed 2026-10-15 (build section 78, S88, S43, S56); not deployed |
| B6-5 | **The week's checks were costed for nobody** (criterion 2.14). The in-200 gate reads the provider's own cost for exactly these calls and it reached the callback; nothing printed it | Low–Medium | `v5/code/Tracker_Report.js` | print the week's cost and what a keyword costs a month at this frequency; say so plainly when the provider reported no cost | fixed 2026-10-15 (build section 78, S88); not deployed |
| B6-6 | **No cannibalisation check anywhere in the tracker** (criterion 2.10 names it; Semrush has a tab for it). Two of the site's own URLs in one stored snapshot is cannibalisation, observed, and we already store the snapshot | Medium | `v5/code/_rank_serp.js` / `Tracker_Report.js` | name both URLs and which one Google prefers today, from the reading already kept; silent when only one of the site's pages is on the page | open — in reach, ~S |
| B6-7 | **The rank tracker tracks only ladder rungs.** `Tracker Plan` reads `seo_ladders` and nothing else, so a customer who names thirty keywords in the tracking form cannot have them watched by the tracker that exists for it | **High** for the area's purpose | `v5/code/Tracker_Plan.js` | take `seo_sites.keywords` as a second source with its own cap, its own cost line and the same gates; keep the ladder series untouched | open — in reach, ~M |
| B6-8 | **A move of ±5 places is still a "drop"**, the fixed rule from v4.2. G28 gave the Site Tracker a tested threshold and left the rank tracker's alone; a drop is reported with no regard for whether anything around it moved | Medium | `v5/code/Tracker_Report.js` | report a move as the site's own only when the page around it held still, as the page moving when it did not, and not at all when the previous reading could not be compared — the measurement now exists (B6-2) | open — in reach, ~S–M |
| B6-9 | **`Ladder_Pool.js` line 61 still multiplies the CTR by 0.65** — the same April 2025 AI Overview figure B1-3 and B6-1 removed from the other two kits. It is area 2's file and this pass did not touch it | Medium | `v5/code/Ladder_Pool.js` | use the same measured per-position table (`RS.keepAt` / `KWI.CLICK_LOSS`), so one figure is corrected in one place | open — in reach, ~S (area 2's file) |
| B6-10 | **No "outranked" line.** Ahrefs sets a target URL per keyword and warns when it is outranked; our report says the number fell and not *who* took the place, although the stored snapshot names everybody above us | Low–Medium | `v5/code/Tracker_Report.js` | name the domain that moved above the target URL since the previous reading, from the two stored snapshots | open — in reach, ~S |
| B6-11 | **Country-level tracking only** (criterion 2.4 caps us at 4). Ahrefs goes country → city → ZIP across 190+ locations, Semrush targets by ZIP | Medium for any local business | the app, the ladder row, `Tracker_Plan.js` | DataForSEO sells the city location codes: the work is the onboarding question and the stored setting, not the provider | open (owner, product) |
| B6-12 | **No on-demand re-check for the customer** — AccuRanker's whole pitch, and the two biggest suites cannot do it (Semrush: "Updates are automatic and cannot be scheduled manually") | Medium | the app + the Manual Run path | a button with a rate limit, a cost rule and the caveat that a position moves over days, not minutes | open (owner, product) |
| B6-13 | **Mobile is bought for at most two keywords a ladder.** Only 13% of sites hold the same position on both devices (R2), so every rung page's reported position is one most visitors never see | Medium | `v5/code/Tracker_Plan.js` + the cost setting | a per-site setting: ≈ $0.85 a ladder a month for every tracked keyword on both devices | open (owner, per site) |
| B6-14 | **Share of voice is averaged across keywords unweighted**, so a 40% share of a search nobody makes counts as much as 4% of the head term. Ahrefs and AccuRanker both weight by volume (clicks to you ÷ clicks to the whole SERP; CTR × volume) | Medium | `v5/code/Tracker_Report.js` | weight by the site's own Search Console impressions per query (first-party and free, better than a provider estimate) — needs `seo_query_history` loaded into the tracker; say which weight was used, and say when there is none | open — in reach, ~M (owner decides the weight source) |
