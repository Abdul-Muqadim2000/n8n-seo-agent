# Area 8 — AI search visibility (measurement), against the best tool available in October 2026

**Pass run 2026-10-15** under `BENCHMARK_PROGRAM.md`. Score on the books: **7.0** (`../system-review-2026-10-13/SCORECARD.md`) — the
highest in the programme after site tracking and backlinks. It was given **before** R14, D19's retry gate, B-G1 and B-L4 landed, so
it is not a description of what the tracker does today either.

This area is *measurement only*. Acting on AI visibility — Bing / IndexNow, AI-readiness, questions to win, earned media — is area 9
(AI Growth) and is not touched here. Scope for this pass: the **AI Visibility Tracker** (`SEOagentAIVisib1`) and the **AI Pulse**
(`SEOagentAIPulse1`), their shared code, and nothing else.

"What we do" is read from the code and from the **2026-10-14** run (`RESULTS.md` here, executions 556 → 557 → 563 and 567 → 568)
and the **2026-10-13** run (`../system-review-2026-10-13/RESULTS.md`, executions 524 → 526 and 501 → 502). The yardstick is the
frozen `../system-review-2026-10-11/CRITERIA_technical_tracking_reporting_ai_links.md` §4A (4A.1-4A.10). **The CRITERIA file is
untouched.**

Every competitor claim below carries a URL that was **opened in this pass** (listed in §8). Where something could not be verified
without a paid seat it says so, in those words.

---

## 0. Read this first — the rubric names a leader that no longer exists as one, and our own two silences

1. **Semrush is not an independent vendor any more.** Adobe's acquisition has **closed**: Semrush's own customer FAQ, last updated
   **2026-04-28**, states "Adobe has officially acquired Semrush" and "Now that the transaction has closed". The rubric's §4A names
   "Semrush: 25 prompts daily for $99" as a peer. The *product* is still there and the 25-prompt figure is still right, but the
   comparison is now **Adobe Experience Cloud**, not an independent tool. Recorded here beside the old statement, per programme
   rule 1; the CRITERIA file keeps saying Semrush and the scorer keeps using it.
2. **Profound is still the leader and has pulled away** — $180M Series D at $1.8bn on 15 Sep 2026, independent, "over 1,000
   enterprise brands" (its own, unaudited). The rubric is right about who to measure against.
3. **Two things on our own side were found in this pass and are not in any register.** The **AI Pulse pooled seven days of baseline
   into a 99% z-test with no check that those days measured the same thing** — which is exactly the defect B-L4 fixed in the weekly
   tracker *on 2026-10-15*, left in the daily one; and **a pulse morning on which every request failed sent nothing at all**, which
   from the outside is indistinguishable from a quiet morning. Both are fixed in this pass (B8-2, B8-3).

---

## 1. The leader today

| Tool | What it leads on, October 2026 | Verified |
|---|---|---|
| **Profound** | Up to **9 engines** (ChatGPT, Perplexity, Google AI Mode, Gemini, Copilot, DeepSeek, Claude, AI Overviews, Exa), daily, custom panel size on Enterprise; a licensed consumer-conversation corpus behind its prompt volumes; FactCheck; agent analytics from CDN logs. **The only vendor that has measured this signal's variance properly** | [pricing](https://www.tryprofound.com/pricing), [variance study](https://www.tryprofound.com/blog/is-once-a-day-enough), [Series D](https://www.tryprofound.com/newsroom/profound-raises-usd180m-series-d-at-usd1-8b-valuation-to-build-the-ai-platform-for-marketing-teams) |
| **Semrush AI Visibility Toolkit** (Adobe) | **25 prompts per account** standalone (50 / 100 / 200 on Semrush One tiers; +50 for $60/mo); ChatGPT Search, Google AI Mode, Gemini; daily; 220+ countries; sentiment and narratives | [toolkit KB](https://www.semrush.com/kb/1493-ai-visibility-toolkit), [AI search tracking KB](https://www.semrush.com/kb/1503-ai-search-tracking), [Adobe FAQ](https://www.semrush.com/news/455963-faq-for-customers-adobe-acquires-semrush/) |
| **Ahrefs Brand Radar** | **481M+ monthly prompts**, and the only published panel-provenance story in the market: "Every prompt is modeled from real user searches in Ahrefs' keyword database"; 7-8 platforms through their public web interfaces; chatbots monthly on a 90-day rolling window, custom prompts daily | [brand-radar](https://ahrefs.com/brand-radar), [methodology](https://ahrefs.com/blog/brand-radar-methodology/) |
| **Evertune** | **100 samples per prompt**, and the only vendor that publishes **margins of error** | [methodology](https://www.evertune.ai/platform/methodology), [pricing](https://www.evertune.ai/pricing) |
| **AthenaHQ** | 11 models, 60+ countries, credit-priced ("1 credit = 1 AI response"); **the only one that verifiably ties AI visibility to revenue** (GA4 for traffic and conversions, Shopify for revenue) | [athenahq.ai](https://www.athenahq.ai/) |

**Corrections to the rubric's own §4A text** (the old statement is kept; the CRITERIA file is unchanged):

- Old: *"Semrush: 25 prompts daily for $99"*. New, 2026-10-15: the panel size is right, the vendor is not — Adobe closed the
  acquisition and announced it on 2026-04-28. Semrush is an Adobe product line.
- Old: *"Evertune: 100 samples per prompt"*. New: confirmed on Evertune's own methodology page — **and "Statistical significance"
  is marked with a dash on its $60 Starter tier and sold at $800**. Honest error bars are an upsell in this market.
- Old: *"Profound: 100 prompts × 3 engines daily ($399)"*. New: the published self-serve tiers are **gone** from
  tryprofound.com as of 2026-10-15 — the page shows only a free trial (50 prompts, 3 engines, 7 days) and custom Enterprise, with
  an FAQ reference to a credit-based "Agency Growth" plan at no stated price. The $99 / $399 figures survive only in third-party
  reviews dated "as of July 2026". **Not verified: Profound's current self-serve prices.**

---

## 2. What the leaders do, mechanism by mechanism

**Panel size, and where the prompts come from.** Ahrefs is alone in modelling its panel from measured demand — People Also Ask plus
its own keyword database (110bn discovered keywords, 28.7bn with positive volume), expanded by fan-out, and it says so in those
words: it models real-world behaviour "rather than fabricating prompts". Profound licenses real consumer conversations for its
*volumes* but does not state a panel size for them. Gumshoe generates its prompts from **AI-inferred buyer personas** — invented by
a model, not measured. The sizes sold are small: Ahrefs **Lite 5 prompts, Advanced 20** (a "check" is one prompt × one platform ×
one update, so no resampling hides inside the number); Semrush **25**; AthenaHQ Starter's 3,600 credits across 11 models daily is
roughly **11 prompts**.

**Sampling.** Everyone says "daily". Only Evertune resamples: "Each prompt is run up to 100 times on every model you track."
Profound runs each configured prompt **once a day** and has published the experiment that justifies it.

**The variance work, and why it is the most useful document in this market.** Profound ran 753 prompts × 7 US platforms = 5,271
configurations for two weeks (1-14 June 2026) in two parallel arms, 1×/day (~129,000 runs) and 10×/day (~860,000 runs). They model
daily variance as **V(Mₙ) = S/n + D** — within-day sampling variance that shrinks with n, plus day-to-day platform drift that does
not. Published: visibility 78.7% (1×) vs 80.4% (10×), drift floor SD 0.0192, daily SD 0.0219 → 0.0195 — an **11% gain for ten times
the money**. Citation share: daily SD 0.0036 → 0.0021, a 40% gain. Wald SD, drift SE, bootstrap SD and a quadrature total SE are all
tabulated. Their conclusion: "for almost every case, once a day is enough", and — from 2,000 synthetic portfolios — **which prompts
are in the panel matters more than how many times you run them.**

**And none of it reaches the customer.** Profound's v2 visibility endpoint returns `visibility_score`, `share_of_voice` and
`average_position`. **No run count, no denominator, no standard error, no interval.** `total_results` counts report rows, not AI
responses. Their metric definitions page is explicit and good — visibility = runs mentioning your brand ÷ runs mentioning any brand,
with brand-free runs excluded from both sides — and **defines no delta and no significance rule anywhere**.

**How a change is reported.** This is the question the area is judged on, and the answer across the market is: with a bare arrow.
Semrush's Diff column is defined, in full, as **"The change in your brand mentions since the last update."** Ahrefs never uses the
words variance, noise, sample size or confidence on its product or methodology page. Peec publishes a formula — "Visibility Score =
(Number of responses mentioning your brand / Total responses) × 100" — and never defines "Total responses". AthenaHQ, Brandlight and
Scrunch publish nothing. The one exception found is **Gumshoe**, whose methodology page states its overall score is "within **±5
percentage points at 95 percent confidence**" — with no sample size, no suppression rule and wider, unquantified intervals on every
slice.

**What happens when the panel changes — and Profound is actively worse than neutral here.** Profound applies the **current**
configuration retroactively to stored answers at request time. Adding, pausing, deleting or retagging a prompt, editing its wording,
or excluding a brand all **change historical numbers**; deleting a prompt removes its past answers from reports and the API;
"Reports reflect the current configuration only. An older configuration cannot be viewed." A newly added model gets no backfill —
"Data begins on the first day it runs" — while the cross-model average silently changes denominator. Their remedy is **procedural**:
snapshot your configuration daily and join to the saved copies. The closest thing to a comparability guard anywhere in this market
is an Ahrefs **help article** warning that figures fetched before 31 August 2026 "will not match" after a volume-model change.
**No vendor refuses to render a delta across a changed panel.**

**The independent evidence on the noise itself.** SparkToro × Gumshoe, read at source: 600 volunteers, 12 brand-recommendation
prompts, 3 tools, **2,961 runs**, Nov-Dec 2025. An identical brand list comes back **under 1% of the time** from ChatGPT or Google's
AI; the same list *in the same order* about **1 in 1,000**. Presence is far steadier than rank — ChatGPT mentioned City of Hope in
**69 of 71 responses but ranked it first in only 25**. Their advice: "visibility % across dozens to hundreds of prompts run multiple
times is a reasonable metric"; "any tool that gives a 'ranking position in AI' is full of baloney"; and to buyers, "stop throwing
money at AI tracking products that don't provide stats-backed, publicly-reviewable research … make sure your provider answers the
questions we've surfaced here and shows their math."

**Accuracy and revenue.** Only Profound ships a defined accuracy metric (FactCheck: `accurate / (accurate + inaccurate)`) — and
**how a claim is adjudicated is undocumented**. Only AthenaHQ verifiably ties AI visibility to money. Profound explicitly does not:
no GA4 in its integrations catalogue, and its referrals API returns `visits` and `last_visit` and nothing else.

---

## 3. What we do, from the live evidence

| Mechanism | What we actually produced | Criterion |
|---|---|---|
| **Panel (4A.1)** | 3-50 questions, default 20 for new sites; techand.ai is still on **8 stored / 7 asked** (the brand question is monthly). Questions come from DataForSEO's LLM Mentions `search_mentions` (real questions with AI search volume) and the site's own long / question-shaped Search Console queries — **measured demand, not invented by a model**. Each carries a buyer stage, a topic cluster, a monthly AI search volume and its origin. Gated on the read path since B-G1 | 4A.1 |
| **Market-wide index (4A.1)** | `multi_target_metrics` over your domain and up to 8 competitors across the whole answer database, plus "questions citing you". Since **R14** the owner's row comes from a **domain** match only; exec 556 printed `you: null` rather than crediting 19,579 answers to a 4-character name match | 4A.1 |
| **Engines (4A.2)** | Six: ChatGPT and Gemini through the real web interfaces, Perplexity and Claude through LLM Responses with web search, Google AI Mode, Google AI Overview; Copilot opt-in. Localised per country (Claude only to its listed countries — AE is refused with 40501, found live 2026-10-08, so those questions name the country in the wording) | 4A.2 |
| **Sampling (4A.3)** | Weekly full set + the **AI Pulse** daily Tue-Sun on the three fast engines, so a question is asked about **7 times a week per engine**. Exec 526 counted **54 answers** over 7 questions; exec 502 counted 21 in one morning, 21 answered, 0 errors | 4A.3 |
| **Statistics (4A.3)** | Wilson 95% on the mention rate — exec 526 printed **"mention rate 0% with a 95% Wilson range 0-4.9%"**, exec 502 **"Named in 0% with a 95% range of 0-15.5%"**. Week-over-week two-proportion z-test (≥1.96 and ≥5 points); daily z at 99% with floors of 20 answers today and 40 in the baseline. Since **B-L4** a delta is withheld entirely when the panel size or the engine set moved, with both sizes named | 4A.3 |
| **Metrics (4A.4)** | Mention rate, citation rate, position when named, share of voice, sentiment, **the exact cited URLs** per question with the engines that cited them (exec 526: 30 of 30 distinct, no `www.`, no fragment, no tracking parameter), the visibility score (0-100, position × citation, weighted by the question's AI search volume on a log scale) | 4A.4 |
| **Accuracy (4A.5)** | Answer Analyst (Claude) reads the answers against the business profile. Exec 556 returned `fact_check: "no_facts"` with the note *"What AI says about you was not checked: nothing on file can judge what the answers claim — fill the business profile…"* — **"not checked" is never printed as "nothing wrong"** (G10) | 4A.5 |
| **Revenue (4A.6)** | GA4 Data API: visits, engaged visits, key events and revenue per assistant, AI landing pages marked when AI cites them, 12-week series, conversion rate against organic. It states that AI Overviews / AI Mode arrive as organic and are not in the figure | 4A.6 |
| **Fan-out (4A.7)** | The searches each assistant ran before answering, counted, with the engines and the questions they belong to | 4A.7 |
| **Access (4A.8)** | robots.txt evaluated per bot with Google's matching rules, llms.txt, and the homepage fetched as a browser **and** as each answer crawler — which is what catches a CDN rule. The free live check of 2026-10-08 found robots.txt, a real llms.txt and all 8 answer crawlers allowed on techand.ai | 4A.8 |
| **Failures (rule 3)** | Exec 556: **"1 of 47 requests failed this run (2.1%), 2 of 3 answered when they were sent again: Google AI Mode — Internal SE Server Error."** — printed in the report's second line. D19's 17% silent failure rate is gone | 4A.3 |
| **Cost** | 8 questions ≈ $4.32 / site / month; 20 ≈ $9.40; 50 ≈ $22.10. Measured: the weekly full run **$0.7895** of DataForSEO + $0.101 of Claude in 2.1 minutes (exec 556); one pulse morning **$0.0840** in 50 seconds (exec 568) | — |

### What the owner could *not* tell from any of it

Exec 526's report printed four headline tiles in one row. **One of them had been tested.** "Named in" carried its Wilson range and
its z-test; "Your pages cited", "Share of voice" and the visibility score were subtractions printed in the same type beside it, with
an arrow and no denominator, no interval and no test — the exact shape this whole area is supposed to be better than. And the
subject line, the one line everybody reads before opening anything, printed the points with no word about whether they meant
anything.

---

## 4. The gap

| # | What the leader does | What we do | Does it change the customer's outcome? | Criterion |
|---|---|---|---|---|
| **G8-1** | Nobody puts an interval or a sample size beside a rate — Profound's API returns three floats with no denominator | We did it for **one of four** headline figures; the other three printed bare arrows | **Yes, and it is this area's whole point.** A 5-point move on 41 answers is noise, and it was being shown exactly like a real one | 4A.3 |
| **G8-2** | Nobody refuses a delta across a changed panel; Profound *retroactively rewrites* history when the config changes | The weekly tracker refuses (B-L4). **The daily pulse pooled 7 days of baseline with no check at all** and fired a 99% "a real drop, not sampling noise" | **Yes.** Raising techand.ai's panel from 8 to 20 — which the owner is being asked to do (G20) — would have produced a false daily alarm every morning for a week | 4A.3 |
| **G8-3** | — | A pulse morning on which every request failed **sent nothing**, and looked exactly like a quiet morning | **Yes.** INVARIANTS rule 3: a failure that reaches no human is not handled | 4A.3 |
| **G8-4** | Evertune: one prompt asked once is **±44 points** | A per-question win rate with **no floor**, which then picked the gaps, the top actions and the ready-to-send API bodies. At 8 questions a question can carry one answer and read "0%" | **Yes.** It told the owner to write a page off a single unlucky draw | 4A.1 / 4A.4 |
| **G8-5** | — | `skipped_by_cap` was written by *AI Requests* and **read by nobody**: at 900 requests or $15 the run stops asking and the panel simply looks shorter | Some — it bites at 50 questions and on the $4 pulse cap | 4A.3 |
| **G8-6** | Profound Enterprise: custom panel. Semrush 25. Ahrefs Advanced 20 | **3-50, default 20; techand.ai on 8** | Yes — and it is the **owner's** decision (G20), not a build item. See §5(b) | 4A.1 (cap) |
| **G8-7** | Profound: 9 engines, incl. DeepSeek and Grok. Ahrefs: 7-8 incl. Grok | **6** (+Copilot opt-in). DataForSEO has no scraper for Grok, DeepSeek, Meta AI | Little. The six are the ones with measurable share. It is the provider's limit, not ours | 4A.2 |
| **G8-8** | Ahrefs: 481M+ prompts modelled from real searches; Profound: licensed consumer conversations | DataForSEO LLM Mentions (387M+ real questions) for discovery **and** the market-wide index, plus the site's own Search Console queries | **No — we are level**, and ahead of Gumshoe, whose panel is invented by a model from personas | 4A.1 |
| **G8-9** | Profound: FactCheck with an undocumented adjudication | Claims checked against a **declared fact sheet**, and **"not checked"** when the sheet is empty | **No — we are ahead.** Ours says what it checked against; Profound's does not | 4A.5 |
| **G8-10** | AthenaHQ: GA4 + Shopify revenue attribution | GA4 visits, key events and revenue per assistant, with the AI-Overview blind spot stated | **No — we are level with the only vendor that does it**, and ahead of Profound, which has no GA4 at all | 4A.6 |
| **G8-11** | Evertune: 100 samples per prompt | **~7 per question per engine per week** through the daily pulse | Mixed — see §4's note below. On samples-per-prompt we beat every daily-once vendor; on panel we are small | 4A.1 / 4A.3 |

### The reconciliation that matters, and where it leaves us

Profound and Evertune appear to contradict each other and do not. Profound: "once a day is enough", 10× buys 11% on visibility.
Evertune: one prompt asked once is ±44 points. **They are measuring different things.** Profound's floor is a *753-prompt portfolio*
where n is already enormous and day-to-day platform drift dominates; Evertune's ±44 and ±31 are *single-prompt* and *topic-level*.
Evertune's own table proves the rule from one side — 100 prompts asked **once**: ±9 overall but **±31 at topic level**; asked 100
times: ±1 and ±2 — and Profound's portfolio simulation proves it from the other: which prompts are in the panel matters more than how
often you run them.

**The operative rule: with a large panel, extra samples per prompt are nearly worthless; with a small panel they are the only thing
that saves you.** Our panels are 8 to 50. We are squarely in the regime where one sample a day is **not** defensible — and the AI
Pulse, which asks the whole panel six further mornings a week, is the right architecture for the size of panel we sell. That is a
genuine, defensible advantage over every vendor on this list except Evertune, and it is cheap: a pulse morning cost **$0.0840**
measured (exec 568). It is also why **a per-question rate without a floor was the most dangerous number in the product**: at 8
questions, per-question is exactly the topic-level slice where Evertune measures ±31.

### Where the leaders are weaker, and we are right

1. **A rate carries its sample.** Exec 526 printed "0% with a 95% Wilson range 0-4.9%" over 54 answers. Profound's API cannot
   express that sentence.
2. **A failed request is named, not absorbed.** 1 of 47, 2.1%, with the engine and the provider's message, and the retry counts.
   No leader's documentation describes an equivalent.
3. **"Not checked" is not "nothing wrong".** The fact check refuses when there is no fact sheet, and says what would unblock it.
4. **A reading is never rewritten.** Profound re-labels stored answers under the current configuration and cannot show you an older
   one. Our stored row keeps the panel size and the run kind it was measured with, and B-L4 refuses the comparison instead.
5. **The method travels with the figure.** The visibility score's weights, the CTR-free position weighting, the log-scaled volume
   weight and the engines asked are all printed. Semrush's score is "compared to the median number of mentions for your top industry
   competitors" with no disclosed denominator; its Sensor formula is stated to be proprietary.

---

## 5. What to build

### (a) In reach now

| # | Item | Size | Status |
|---|---|---|---|
| **a1** | **Every headline change tested, or named untested** — citation rate, share of voice and the visibility score, plus the subject line and the competitor-share alert | M | **Built in this pass** (§6, B8-1) |
| **a2** | **The daily pulse's baseline measured the same thing**, or there is no test | M | **Built in this pass** (§6, B8-2) |
| **a3** | **A morning nobody could read always reaches a human**, and the week says how many of its answers came from a partial one | M | **Built in this pass** (§6, B8-3) |
| **a4** | **A per-question rate needs four answers** before it picks a gap, an action or an API body | S | **Built in this pass** (§6, B8-4) |
| **a5** | **What the cost / request cap never asked** | S | **Built in this pass** (§6, B8-5) |
| **a6** | **Per-question Wilson ranges in the app**, not only in the report — the app's question grid reads `win_rate` and now has `win.ci` and `win.enough` available but does not render them | S | Register row **B8-6** |
| **a7** | **A stated precision for the whole run**, in Evertune's and Gumshoe's terms: "this panel and this cadence measure your visibility to ±N points at 95%" on the settings page, so panel size is chosen against what it buys. Every input exists (`samples`, Wilson) | S | Register row **B8-7** |
| **a8** | **Per-engine deltas are still untested.** The "no longer cites any of your pages" alert fires on `cited > 0` then `cited === 0` with no regard for the engine's own sample — 6 answers on Gemini is not evidence it stopped citing you | S | Register row **B8-8** |
| **a9** | **Many alerts, one run.** Nine alert rules fire weekly on the same sample with no multiple-comparison correction; at 95% each, a quiet week raises a false one often. No leader does this either — it is where to be ahead | S-M | Register row **B8-9** |
| **a10** | **Brand recognition is a 2-of-5 majority rule** (`brand.known * 2 >= brand.answered`) raised as a medium alert with no interval over at most 6 engines | S | Register row **B8-10** |

### (b) Needs money or an owner decision

| # | Item | Cost | Who decides |
|---|---|---|---|
| **b1** | **A bigger panel (G20, 4A.1).** 8 → 20 questions takes techand.ai from ≈ $4.32 to ≈ $9.40 a month; 50 is ≈ $22.10. Profound's enterprise panels are custom, Semrush sells 25, Ahrefs Advanced 20 — **at 20 we are already at the market's mid-tier**, and Profound's own simulation says panel composition beats resampling. This is the single highest-value owner decision in the area | +$5.08 (20) or +$17.78 (50) / site / month | **Owner — G20, already open** |
| **b2** | **Copilot on by default (4A.2).** $0.002 a question; Bing shows its summary rarely (0 of 10 live, 2026-10-10), so most answers are "no summary" | ≈ $1.20 / site / month at 20 questions (it is a pulse engine, so ~30 asks a month each) | Owner, per site |
| **b3** | **Sentiment and narrative at Semrush's depth.** We have sentiment per answer and descriptors; "brand narratives" needs a second Claude pass over the answer corpus | ≈ $0.30 / run | Owner |
| **b4** | **Server-log agent analytics** (Profound's CDN-log ingestion, Ahrefs' Cloudflare bot analytics). Needs the customer's CDN logs, which is a product and a pipeline, not a setting | L | Owner (product) |

### (c) Deliberately not worth it

| # | Item | Why not |
|---|---|---|
| **c1** | **100 samples per prompt (Evertune).** 12× the engine spend. Profound's 989,000-response experiment measured the return at **11% on visibility** and 40% on citation share, and its drift floor does not move at all with n. Our daily pulse already gives ~7 samples per question per engine per week, which is where the curve has flattened for a panel of 8-50 | |
| **c2** | **Grok, DeepSeek and Meta AI.** DataForSEO has no scraper for them (AI_VISIBILITY_SPEC §9). Not a build decision | |
| **c3** | **An AI "ranking position" as a headline.** SparkToro's own words: "any tool that gives a 'ranking position in AI' is full of baloney" — the same list in the same order comes back about 1 in 1,000 runs. We keep position only as an input to the visibility score and print "average position when named" with its sample, never as a rank | |
| **c4** | **Our own prompt-volume corpus** (Profound's licensed conversations, Ahrefs' 481M). We rent DataForSEO's 387M-question database for the discovery and the market index; building one needs a data-licensing business | |
| **c5** | **Retroactive re-labelling of stored answers** (Profound's model). It is the comparability defect, not a feature: it silently changes numbers a customer has already read and reported | |

---

## 6. What this pass built

**Build section 81, harness S91** (40 new checks, `5038 → 5078 passed, 0 failed`; build exit 0 with `SEO_BUILD_ALLOW_DEFAULTS=1`,
because a git worktree has no `n8n/.env`; **nothing deployed**). The build section was broken **three ways on purpose** — a changed
constant, a z-test moved above its guard, and the old fixed competitor rule reintroduced — and caught each.

**B8-1 — every headline change is tested, or says it was not.** One shared test (`changeOf` in `_ai_stats.js`) now judges the
mention rate, the citation rate and the share of voice, each on **its own denominator**: the share of voice is a proportion of yours
plus the competitors' mentions, not of the answer count, and the earlier run's competitor counts come from the stored row rather
than from reconstructing them out of a rounded percentage. The citation rate and the share of voice gained the 95% Wilson range they
never had. The visibility score is a **weighted mean**, so Wilson does not apply to it: `scoreBand` gives it the standard error of
that mean over **Kish's effective sample size**, labels it `modelled`, prints a ±N band, and `scoreChange` refuses to call a move a
change when it sits inside that band — judged against *this* run's band, because we do not store the earlier run's and inventing one
would be the defect. The "a competitor gained 10+ points" rule, fixed since v4.9, is z-tested on the same denominator. The subject
line now reads "(+5 pts, within noise)" or "(+37 pts, real change)" or "(not tested)" instead of a bare number.

**B8-2 — the daily pulse's baseline measures the same thing, or there is no test.** `sameBasis` requires the same engines (exactly)
and a comparable number of answers (R19's 20% drift) before a stored morning may join the pooled baseline. Every morning left out is
named with its reason — "answered by chatgpt, gemini, today by ai_mode, chatgpt, gemini", "21 answers that day against 54 today — a
different panel, not a different result" — and with no comparable morning there is **no z-test at all** and the mail says so, rather
than going quiet, which reads as "nothing changed". The pulse plan now records each stored morning's own engine set and panel size,
without which the guard would have nothing to read.

**B8-3 — a morning nobody could read.** `readable` is an evidence block in the shape rule 3 uses: asked, checked, failed, retried,
`unavailable`. A morning on which every request failed is `unavailable` with its counts — never a 0% mention rate — and it **always**
sends, because a failure that reaches no human is not handled. A single silent engine is a medium alert and the day is marked as a
different mix. No statistical drop is drawn from a day that could not be read. On the weekly side, the tracker pools the pulse
mornings into `samples` and `mentioned` and now **says what that sample is made of**: how many answers came from the pulse, which
mornings did not reach every engine, by date, and which engine was silent. (This also paid `Pulse Metrics`'s `refusal` debt on
`lineage_lint.py`'s ratchet, which it leaves for ever.)

**B8-4 — a per-question rate needs four answers.** `rateOf(q.m, q.n, { min: MIN_Q_SAMPLES })` carries the rate, its Wilson range and
whether there were enough answers. A question below the floor is **not** a gap: it picks no action, ships no API body, and is listed
under "Not enough answers to tell yet" with what it would need. The report's answer grid prints "too few" and the reason instead of
a 0% that reads like a result.

**B8-5 — what the cap never asked.** `skipped_by_cap` is read, counted per engine for this site only, printed as "Not everything was
asked", and recorded in the lineage block as evidence nobody gathered (`LN.unknown`, basis `unknown`).

Files: `v5/code/_ai_stats.js`, `v5/code/AI_Metrics.js`, `v5/code/AI_Report.js`, `v5/code/Pulse_Plan.js`,
`v5/code/Pulse_Metrics.js`, `build_v4.py` section 81, `harness/scenarios_v5.js` S91.

---

## 7. The one change that would most improve the customer's outcome

**Raise the panel** — it is the owner's call (G20) and Profound's own 2,000-portfolio simulation says panel composition beats every
other lever, while Evertune's table says 8 questions cannot support a per-topic answer at any sampling rate; at 20 questions, for
$5 more a month, we are at the market's mid-tier with seven times the samples per prompt that any of them run.

---

## 8. Sources opened for this section

- **Profound** — [pricing](https://www.tryprofound.com/pricing) (free trial 50 prompts / 3 engines / 7 days, Enterprise "Up to 9 Answer Engines", daily; no self-serve prices published as of 2026-10-15), [is once a day enough](https://www.tryprofound.com/blog/is-once-a-day-enough) (753 prompts × 7 platforms, ~989,000 responses, V(Mₙ) = S/n + D, 78.7% vs 80.4%, drift floor SD 0.0192, 11% / 40% gains, 2,000 synthetic portfolios), [how metrics are calculated](https://docs.tryprofound.com/cookbook/metrics/how-metrics-are-calculated.md) (definitions; no delta or significance rule), [why past numbers change](https://docs.tryprofound.com/cookbook/metrics/why-past-numbers-change.md) (current config applied retroactively; "An older configuration cannot be viewed"; no backfill for a new model), [query visibility v2](https://docs.tryprofound.com/rest-api/reports/query-visibility-v2.md) (three floats, no denominator, no SE, no interval), [headline and daily](https://docs.tryprofound.com/cookbook/visibility/headline-and-daily.md), [FactCheck v2](https://docs.tryprofound.com/rest-api/reports/query-factcheck-v2.md), [referrals v2](https://docs.tryprofound.com/api-reference/reports/get-referrals-report-v2.md) (`visits`, `last_visit` only), [integrations](https://docs.tryprofound.com/integrations/overview) (no GA4), [prompt volumes](https://help.tryprofound.com/articles/4288109168-prompt-volumes), [Series D](https://www.tryprofound.com/newsroom/profound-raises-usd180m-series-d-at-usd1-8b-valuation-to-build-the-ai-platform-for-marketing-teams)
- **Semrush / Adobe** — [AI Visibility Toolkit](https://www.semrush.com/kb/1493-ai-visibility-toolkit) (25 prompts per account; daily / weekly by module), [AI search tracking](https://www.semrush.com/kb/1503-ai-search-tracking) (ChatGPT Search, AI Mode, Gemini; desktop only; **"The change in your brand mentions since the last update"**; +50 prompts for $60/mo), [Adobe acquisition FAQ, updated 2026-04-28](https://www.semrush.com/news/455963-faq-for-customers-adobe-acquires-semrush/), [AI Traffic](https://www.semrush.com/news/430893-traffic-market-toolkit-expands-with-ai-traffic-and-google-ai-mode/)
- **Ahrefs** — [Brand Radar](https://ahrefs.com/brand-radar) (481M+ monthly prompts; Lite 5 / Advanced 20 prompts; checks = prompt × platform × update), [methodology](https://ahrefs.com/blog/brand-radar-methodology/) ("Every prompt is modeled from real user searches"; public web interfaces; monthly question sets on a 90-day rolling window; "a modeling choice, not a measured relationship"; no mention of variance), [AI adjusted volume](https://help.ahrefs.com/en/articles/16755865-what-is-ai-adjusted-volume-and-how-is-it-calculated) (platform multipliers; figures fetched before 31 Aug 2026 "will not match")
- **Evertune** — [methodology](https://www.evertune.ai/platform/methodology) (100 samples/prompt; one prompt once **±44**, 100 prompts once ±9 overall / **±31 topic**, 100×100 ±1 / ±2; EverPanel 150M conversations; confidence level never stated), [pricing](https://www.evertune.ai/pricing) ("Statistical significance" dashed on $60 Starter, included at $800 Pro)
- **AthenaHQ** — [athenahq.ai](https://www.athenahq.ai/) (11 models, 60+ countries, 1 credit = 1 AI response, GA4 + Shopify revenue attribution)
- **Peec AI** — [peec.ai](https://peec.ai/), [docs](https://docs.peec.ai/), [visibility metric](https://docs.peec.ai/metrics/brand-metrics/visibility) (formula published, "Total responses" never defined), [pricing](https://peec.ai/pricing) (no prices, no numeric limits)
- **Gumshoe** — [gumshoe.ai](https://gumshoe.ai/) ($99 / $299; prompts generated from AI-inferred personas), [methodology](https://gumshoe.ai/resources/gumshoe-methodology) ("within ±5 percentage points at 95 percent confidence"; slices "wider", unquantified)
- **Brandlight** — [brandlight.ai](https://www.brandlight.ai/) (bare percentages, no methodology; Attribution "coming soon")
- **Scrunch** — [scrunchai.com](https://www.scrunchai.com/) (301 → [scrunch.com](https://scrunch.com/); no published mechanism or pricing)
- **The noise itself** — [SparkToro × Gumshoe](https://sparktoro.com/blog/new-research-ais-are-highly-inconsistent-when-recommending-brands-or-products-marketers-should-take-care-when-tracking-ai-visibility/) (600 volunteers, 12 prompts, 2,961 runs; identical list <1%, same order ~1 in 1,000; City of Hope 69/71 mentioned, 25 first; "full of baloney"; "shows their math"), [Search Engine Journal](https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242), [Search Engine Land](https://searchengineland.com/ai-recommendation-lists-rarely-repeat-study-468076)

**Not verified** (stated as such above, and nothing is asserted beyond it): Profound's **current self-serve prices** (the pricing
page shows only a free trial and custom Enterprise; $99 / $399 survive only in a third-party review dated "as of July 2026") and
whether FactCheck adjudicates a claim against anything stated; **Peec AI's prices and every numeric plan limit** (the vendor
publishes none); **Evertune's docs FAQ** (HTTP 401) and the confidence level behind its ± figures, which its own pages never state;
**Ahrefs' and Semrush's samples per prompt per day**; **whether any vendor displays an interval or a sample count inside the
logged-in UI** — all of the above is from public pages and public API docs, and for Profound the API reference is strong negative
evidence, since a UI cannot show what the API does not compute. `zeoradar.com/methodology` returned HTTP 403 and
`measurelayer.com/best-ai-visibility-tools` carries prompt-injected text addressed at summarising models; neither is cited.

---

## 9. Proposed register rows

For `../system-review-2026-10-11/FIX_PLAN.md` §3.14 — the orchestrator moves these in; this agent edited no register.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B8-1 | **Three of the four headline tiles printed an untested arrow beside a tested one.** "Named in" has carried a 95% Wilson range and a two-proportion z-test since v4.9; "Your pages cited", "Share of voice" and the visibility score were bare subtractions in the same row, in the same type, off the same sample (exec 526: 54 answers; exec 556: 47 requests) — and the **subject line** printed the points with no word about the test. This is the one thing the area is scored on, and no competitor does it either: Profound's v2 endpoint returns three floats with no denominator, Semrush defines its change column as "the change in your brand mentions since the last update" | **High** (a change presented as a result, in the headline, on a signal that returns the same answer under 1% of the time) | `v5/code/_ai_stats.js`, `v5/code/AI_Metrics.js`, `v5/code/AI_Report.js` | one shared `changeOf` for all three rates, each on its own denominator (the share of voice on yours + the competitors' mentions, with the earlier counts read from the stored row); Wilson ranges for the citation rate and the share of voice; `scoreBand` (standard error of the weighted mean over Kish's effective n) for the visibility score, labelled modelled, with no change called inside its own band; the competitor-share alert z-tested instead of its fixed 10-point rule; the subject line says real change / within noise / not tested | fixed 2026-10-15 (build section 81, S91); not deployed |
| B8-2 | **The AI Pulse pooled seven days of baseline into a 99% z-test with no check that they measured the same thing.** B-L4 fixed exactly this class in the weekly tracker on 2026-10-15 and left the daily one — so raising techand.ai's panel from 8 questions to 20 (which G20 asks the owner to do), or switching an engine on, would have fired "a real drop, not sampling noise" every morning for a week at a site whose visibility had not moved. No vendor in the market has this guard; Profound is worse than neutral, rewriting stored history under the current configuration | **High** (a false alarm at 99% confidence, caused by our own settings change) | `v5/code/Pulse_Plan.js`, `v5/code/Pulse_Metrics.js`, `v5/code/_ai_stats.js` | the plan records each stored morning's engine set and panel size; `sameBasis` requires the same engines exactly and a comparable answer count (R19's 20% drift); every morning left out is named with its reason; with no comparable morning there is no test and the mail says so | fixed 2026-10-15 (build section 81, S91); not deployed |
| B8-3 | **A pulse morning nobody could read sent nothing, and looked exactly like a quiet one.** The pulse mails only when it has an alert, so a morning on which every request failed was silent — INVARIANTS rule 3's "a failure that reaches no human is not handled". And the weekly run pools those mornings straight into `samples` and `mentioned`, so a morning that reached two of three engines reweighted the week with nothing said | **High** (rule 3) / Medium (the weekly pooling) | `v5/code/Pulse_Metrics.js`, `v5/code/AI_Metrics.js`, `v5/code/AI_Report.js` | `readable` evidence block (asked / checked / failed / retried / `unavailable`); an unreadable morning always sends; a silent engine is a medium alert; no statistical drop from a day that could not be read; the weekly report names the pulse days pooled, which did not reach every engine, by date, and the engine that was silent. Pays `Pulse Metrics`'s `refusal` debt on the lineage ratchet | fixed 2026-10-15 (build section 81, S91); not deployed |
| B8-4 | **A per-question win rate had no sample floor and picked the actions.** With an 8-question panel a question can carry one answer, and "0%" read exactly like a question the business reliably loses — which then became a gap, a top action and a ready-to-send API body telling the owner to write a page. Evertune measures a single prompt asked once at **±44 points**, and the per-topic slice of a 100-prompt panel at ±31 | **High** (advice from one draw) | `v5/code/AI_Metrics.js`, `v5/code/AI_Report.js` | `rateOf` with `MIN_Q_SAMPLES = 4`: below the floor a question is not a gap, picks no action and ships no API body; it is listed as undecided with what it needs, and the grid prints "too few" with the reason | fixed 2026-10-15 (build section 81, S91); not deployed |
| B8-5 | **`skipped_by_cap` was written by *AI Requests* and read by nobody.** At 900 requests or $15 ($4 on the pulse) the run stops asking; every rate is then measured on what was left and the panel simply looked shorter | Low–Medium (bites at 50 questions and on the pulse cap) | `v5/code/AI_Metrics.js`, `v5/code/AI_Report.js` | counted per engine for this site, printed as "Not everything was asked", and recorded in the lineage as evidence nobody gathered | fixed 2026-10-15 (build section 81, S91); not deployed |
| B8-6 | **The app shows a per-question win rate with no range.** `win.ci` and `win.enough` now travel in the callback and the app's question grid still renders the bare percentage | Low–Medium | `app/web` AI visibility page | render the range and the "too few answers" state the engine already sends | open — in reach, ~S (app) |
| B8-7 | **Nothing tells the owner what their panel size buys.** Evertune publishes ±44 / ±9 / ±1 for 1 / 100 / 10,000 samples and Gumshoe publishes ±5pp at 95%; our settings page offers 3-50 questions with a monthly cost and no statement of the precision each buys, so G20 is a decision made blind | Medium (it is the decision that governs the whole area) | `app/web` monitor settings, `app/shared/src/ai-visibility.ts` | print the achievable 95% half-width at each panel size and cadence from the engine's own measured sample; every input exists | open — in reach, ~S |
| B8-8 | **A per-engine change is still untested.** "X no longer cites any of your pages" fires on `cited > 0` then `cited === 0` regardless of that engine's own sample — 6 Gemini answers is not evidence it stopped citing you | Medium | `v5/code/AI_Metrics.js` | run the same `changeOf` per engine with its own sample, and say "too few answers from this engine to tell" below the floor | open — in reach, ~S |
| B8-9 | **Nine alert rules fire weekly on one sample with no multiple-comparison correction.** At 95% each, a quiet week raises a false alert often. No leader corrects for this either, which is exactly where to be ahead | Medium | `v5/code/AI_Metrics.js`, `v5/code/Pulse_Metrics.js` | a Holm or Benjamini-Hochberg adjustment across the tested alerts of one run, with the adjusted threshold stated | open — in reach, ~S–M |
| B8-10 | **Brand recognition is a 2-of-5 majority rule raised as an alert.** `brand.known * 2 >= brand.answered` over at most 6 engines, with no interval, fires "Only N of M AI assistants recognise …" | Low–Medium | `v5/code/AI_Metrics.js` | report it as a count with its denominator and no verdict, or give it the same Wilson treatment as every other rate | open — in reach, ~S |
| B8-11 | **The panel is 8 questions on techand.ai and 20 by default** against Semrush 25, Ahrefs Advanced 20 and Profound's custom enterprise panels. Profound's own 2,000-portfolio simulation found panel composition matters more than resampling, and Evertune's table shows a per-topic answer is out of reach at 8 at any sampling rate | **High** for the area's ceiling | settings (`ai_prompts_max`) | 8 → 20 is +$5.08 / site / month, 50 is +$17.78 | open (**owner — this is G20**) |
| B8-12 | **Copilot is opt-in and off.** $0.002 a question, but Bing showed a summary in 0 of 10 live checks (2026-10-10), so most answers are "no summary" rather than data | Low | settings (`ai_engines`) | ≈ $1.20 / site / month at 20 questions (a pulse engine, ~30 asks a month each); worth it only if Copilot's summary rate rises | open (owner, per site) |
