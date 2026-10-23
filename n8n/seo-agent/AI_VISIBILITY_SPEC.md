# AI search visibility v4.9: from 6/10 to best in class

> **G6 (2026-10-18): the panel at enterprise scale — up to 500 questions by buyer role and market, split runs, the rotating daily sample, segments with ranges, two more engines — is §10.**
>
> **v4.12 (2026-10-10):** the weekly loop that *acts* on these measurements — Bing / IndexNow, AI-readiness, questions to win, earned media — is in `AI_GROWTH_SPEC.md`.

Built on 2026-10-08 at the user's request: "make it the best in this category". A comparison scored our AI visibility tracker **6/10** against 8–9/10 for Semrush Enterprise and Ahrefs Brand Radar. The reason it gave: "they track far more questions, more often, and tie them to revenue. We ask about 8 questions a week across 6 AI engines."

This file covers the research, the design, how things are measured, the costs, the data, the tests and what is still open. The v4.5 monitor design is in `MONITORS_FEATURE_SPEC.md` §1–2; this file replaces its AI part where the two differ.

## 1. What the leaders do (research of 2026-10-08)

| Tool | Questions | How often | Notable |
|---|---|---|---|
| Semrush AI Toolkit / Enterprise AIO (Adobe since 2026-04) | 25 tracked daily ($99); database of 213–261M prompts | daily (toolkit) | Sentiment, brand narratives, inaccuracy monitoring, query fan-out, AI-bot log analysis, GA4 / Adobe Analytics |
| Ahrefs Brand Radar | about 462M prompts/month (from People Also Ask + keyword fan-out); custom prompts | daily, weekly or monthly per engine | "Estimated impressions" = mentions × search volume; bot analytics through Cloudflare; AI traffic per cited page |
| Profound | 100 prompts × 3 engines daily ($399) | daily | Prompt volumes from consumer panels; FactCheck (accuracy); agent analytics from CDN logs |
| Peec AI | 50–350 prompts | daily | Sentiment, share of voice, owned vs earned opportunities, robots check of 40+ bots |
| Scrunch / AthenaHQ / Evertune | 350–100k prompts | daily to monthly | Personas, funnel stages, hallucination checks, 100 samples per prompt (Evertune) |
| GA4 (May 2026) | — | — | Native "AI Assistant" channel, medium `ai-assistant` |

**Table stakes:** 6+ engines, 25–100+ prompts sampled daily, mention rate / share of voice / position / sentiment / citations, competitor benchmarks, robots / crawler checks, recommendations.

**What earns 9–10/10:**
- Two layers: a tracked panel plus a market database with real demand.
- Statistical rigour: many samples and confidence intervals.
- Revenue joined to the answers.
- Accuracy checks against a fact base.
- Fan-out analysis.
- An action loop.

Answers vary a lot between asks (SparkToro: the same brand list less than 1% of the time). So **report mention rate with a range, not rank, and alert only beyond the noise**.

Sources: the research notes of this session (Semrush KB 1493, ahrefs.com/blog/brand-radar-methodology, tryprofound.com/blog/is-once-a-day-enough, peec.ai, evertune.ai/platform/methodology, docs.dataforseo.com/v3/ai_optimization).

## 2. What v4.9 does

| Gap | v4.5 | v4.9 |
|---|---|---|
| **More questions** | 8 questions | A panel of up to **50** (default 20 for new sites), each with a buyer stage, topic cluster, monthly AI search volume and origin. New questions come from **real questions in the AI-answer database** (DataForSEO LLM Mentions, 387M+ prompts) and the site's long / question-shaped **Search Console queries**. A **market-wide index** compares how often answers across the whole database cite you and each competitor, beyond the tracked questions |
| **More often** | weekly, 1 sample | **AI Pulse** every day except Monday (ChatGPT, Gemini, Google AI Mode on the whole panel): about 7 samples per question and engine per week. Every rate comes with its **95% range**, and a change is called real only when a z-test says so |
| **Tied to revenue** | — | **GA4 AI referral traffic**: visits, engaged visits, key events and revenue per assistant (referrer or the `ai-assistant` medium), AI landing pages marked when AI cites them, conversion rate against organic, a 12-week series. Also "estimated answers naming you" (AI search volume × win rate, labelled as an estimate) and the demand behind lost questions |
| Engines | Gemini through the API ($0.035) monthly | **Gemini through the real gemini.google.com scraper** ($0.004) every week. Perplexity localised to the site's country (`web_search_country_iso_code`; Claude's endpoint refuses the field — found live 2026-10-08 — so its questions carry the country in the wording). ChatGPT's own brand list and **fan-out searches** are read |
| Accuracy and sentiment | — | **Answer Analyst** (Claude, weekly) reads the answers that matter: the brands named in order (competitors named without a website count, and learned names map to their domain), sentiment toward the business, and **wrong claims** checked against the business profile. A new wrong claim raises a high alert and an action |
| Crawlers | in the audit's fix pack only | Weekly **AI crawler access**: robots.txt evaluated per bot (answer bots vs training bots, homepage + key pages, Google's matching rules), llms.txt, and the homepage fetched as a browser vs as OAI-SearchBot / ChatGPT-User / PerplexityBot / Claude-SearchBot. This catches a CDN "block AI bots" rule |
| Score | mention rate, citation rate, SoV | Plus the **visibility score** (0–100): named × position weight × linked, weighted by the question's demand on a log scale. Breakdown by stage and topic |
| Actions | content gaps, PR / listing targets | Ranked by value: unblock crawlers > correct wrong claims > lost questions with the most demand (with fan-out searches and ready API bodies) > sources to get onto > entity > citable pages > "answer what AI searches for" |
| Alerts | −15 pts | Weekly alerts:<br>• a significant drop<br>• an engine stops citing you<br>• a competitor gains 10+ points of share<br>• a new wrong claim<br>• negative sentiment<br>• a blocked crawler<br>• AI visits down 30%+<br><br>Daily alerts (pulse, 99% z-test):<br>• a real drop<br>• a business suddenly in 30%+ of answers<br>• the top spot lost on a question after 3 days at #1 |

## 3. Workflows and schedule

| Workflow | When | What |
|---|---|---|
| **AI Visibility Tracker** `SEOagentAIVisib1` (81 nodes) | Monday 07:00 + on demand | Plan → discovery and volumes (LLM Mentions `search_mentions`, AI Keyword Data) → Prompt Writer → GA4 AI reports → crawler access → engines (ChatGPT, Gemini, Perplexity, AI Mode, AI Overview weekly; Claude, the brand question, `multi_target_metrics` + `search_mentions` for the domain and the market view monthly) → parse → Answer Analyst → metrics (with the week's pulse days) → rows, prospects, learned names (`seo_cache` `ai_brands:`), answer retention (400 days) → Claude brief → report + PDF + callback `ai_visibility` |
| **AI Pulse** `SEOagentAIPulse1` (36 nodes) | 06:30 Tue–Sun + on demand | The panel on ChatGPT, Gemini and Google AI Mode → one `seo_ai_daily` row per site and day + answer rows (`run_kind` pulse, kept 35 days) → e-mail / callback `ai_pulse` **only when something really changed** (or on demand) |

Both workflows share *AI Requests* and *Parse AI Answers*: same node names, same code. Harness files for the pulse carry the `Pulse__` prefix.

## 4. How it is measured

- **Rates** are counted over the past 7 days: this run's answers on the weekly engines plus the pulse answers since the last weekly run. The brand question and Claude (monthly) are excluded from the headline.
  - Each rate has a 95% **Wilson** interval (`v5/code/_ai_stats.js`).
  - Week-over-week changes are **two-proportion z-tested**: significant means |z| ≥ 1.96 and at least 5 points. Rows from before v4.9 have no sample count, so the old −15 points rule is used for them.
  - Daily pulse alerts use z ≥ 2.58, at least 20 answers today and 40 in the baseline.
- **Visibility score.** Each answer is scored, then the scores are averaged with weights:
  - Rank weight when named: rank 1 = 1, 2 = 0.8, 3 = 0.65, 4–5 = 0.5, >5 = 0.35; named outside a list = 0.6.
  - The rank weight is multiplied by 1 when the answer also cites you, and by 0.85 when it does not.
  - An answer that cites you without naming you scores 0.4.
  - The average weight per question is 1 + log10(1 + AI search volume) / 2.
- **One business, one key.** A brand name joins its domain when the Answer Analyst learned it ("ClearTax" → cleartax.com) or when the name matches the domain label (`brandKey` / `mergeBrands`). Share of voice = your mentions ÷ (yours + every competitor named; until 2026-10-23 the top 8 only).
- **F1b (2026-10-23, rule `aivis-2026-10-23`; `docs/ai-visibility-2026-10-23/fixes/F1b.md`).** One reading of every answer and one
  definition of every figure, for the headline, every engine, every segment, every competitor and the daily pulse (`_ai_stats.js` AVM):
  - **Named** = the answer names the business in its text. An answer that only links one of its pages is **cited**, not named ("Named in"
    counted both before). `mention_rate` holds the named rate from this rule on; `named_rate` is the same figure by its own name.
  - **Visibility score**: the weights above are now what the code does (a citation alone scored 0.6, the documented 0.4 was unreachable).
    The place is the 1-based position among the businesses the answer names (the business and its competitors only); named with no known
    place = 0.6.
  - **Share of voice** = your mentions ÷ (yours + **every** competitor named), over the answers whose competitors were recorded (the top-8
    cut is gone: it made the figure depend on the display table). Its range and its change test are taken over **answers** (ratio
    estimator, linearised standard error), never as if each mention were an independent trial. Segment share of voice uses the same
    answers on both sides, so for any one dimension the segments add back to the headline (`sov_self`, `sov_mentions` in `segments_json`).
  - **Position**: mean place when named (`avg_position`, needs 12 placed answers, else "too few answers"), **named first** = answers that
    name you first ÷ all answers (`first_rate`), **position-weighted visibility** = mean over answers of the place weight ×100 (1st 100,
    2nd 80, 3rd 65, 4-5th 50, lower 35, named with no place 60, not named 0; `pos_visibility`, needs 12 answers). Per engine, per segment
    and per competitor, each with its sample size.
  - **Window**: a pulse morning counts in exactly one weekly row: (the previous row's `checked_at`, this run's start]. A split run's row
    keeps its first part's start. The window and the plain period (`rate_period`) are stored in the row.
  - **Comparison** (`compare_json`, the app reads it instead of subtracting two rows): comparable only with the same measurement rule,
    the same engine set, at least 80% of the question ids in common and a panel size within 20%. Named and cited rates: two-proportion
    z-test; share of voice, the score and the place: z on the two runs' standard errors. Under 12 answers on either side: no verdict.
    A row of another rule starts a new baseline ("measurement rule changed").
  - Pulse readings of another rule, or without the per-answer record (`detail_json`), are left out of the week and named.
- **Share among tracked rivals (AI-answer database)** (E21: was labelled "Market-wide share"): the share among your domain and at most 8
  tracked rivals, not the whole market.
- **Market-wide index.** `multi_target_metrics` over your domain and the competitors' domains on Google AI Overview data in the site's country, plus ChatGPT data for US-English sites (the database holds ChatGPT for 2840/en only). It is shown with mentions and AI search volume. A business-name target counts unlinked mentions separately.
- **Revenue.** GA4 Data API with a `sessionSource` PARTIAL_REGEXP over the assistant hosts, OR `sessionMedium = ai-assistant`.
  - Visits from AI Overviews / AI Mode stay in Organic Search and cannot be separated.
  - Revenue is GA4 `totalRevenue` (purchases); without e-commerce, key events are the value.

## 5. Costs per site per month (DataForSEO + Claude, `estimateAiVisibilityCost` in `app/shared/src/constants.ts`)

| Panel | Weekly run | Monthly full run | Daily pulse | Total | v4.5 (8 questions) |
|---|---|---|---|---|---|
| 8 questions | $1.17 | $0.97 | $2.18 | **$4.32** | ≈ $1.25 |
| 20 questions (new default) | $2.21 | $1.27 | $5.92 | **$9.40** | |
| 50 questions | $4.81 | $2.02 | $15.28 | **$22.10** | |

Notes:
- Prices: ChatGPT / Gemini scraper and AI Mode $0.004, Perplexity $0.006, AI Overview $0.002, Claude $0.025 per question; LLM Mentions $0.10 + $0.001 per row; AI Keyword Data $0.0001 per keyword.
- Turning the pulse off removes its column.
- The weekly run and the pulse ask the panel without its brand question (asked on the month's full run). Measured live on 2026-10-08 at 8 questions: one pulse day $0.084 (21 answers), the on-demand full run $0.59 of DataForSEO plus the Answer Analyst and the brief.
- Run caps: $15 per weekly run, $4 per pulse run, 900 requests, 24 Answer Analyst jobs per run.

## 6. Data

New columns are added to the live tables by `sync_tables.py` (run by `apply_env.py`; columns are listed in `ladder_common.py`):

| Table | New columns |
|---|---|
| `seo_monitors` | `ai_pulse` |
| `seo_ai_prompts` | `stage`, `cluster`, `volume`, `origin`, `updated_at` (saved by upsert on `prompt_id`) |
| `seo_ai_answers` | `run_kind`, `sentiment`, `brands`, `issues`, `fanout` |
| `seo_ai_visibility` | `run_kind`, `samples`, `visibility_score`, `mention_lo` / `mention_hi`, `sentiment_score`, `accuracy_issues`, `ai_sessions` / `ai_conversions` / `ai_revenue`, `index_sov`, `ai_impressions`, `perception_json`, `traffic_json`, `access_json`, `index_json` (with `suggestions`, `fanout`, `demand`), `clusters_json` |

New table **`seo_ai_daily`**: one row per site and day (counts per engine, per question, competitors, sources; no answer text).

F1b (2026-10-23): `seo_ai_visibility` + `rule_version`, `named_rate`, `avg_position`, `first_rate`, `pos_visibility`, `rate_period`,
`compare_json`, `metrics_json`; `seo_ai_daily` + `rule_version`, `sample_mode`, `questions_asked`, `engines_answered`, `partial`,
`avg_position`, `detail_json`, `readable_json`. Rows written before them read as "another rule": never compared, never pooled.

Settings:
- `ai_prompts_max`: 3–50, default 20 when no row exists. Stored values are kept (techand.ai stays at 8 until raised).
- `ai_pulse`: empty = on.
- Both can be set through Site Admin `monitors`, Track my site / API `monitors`, and the app's monitor settings.

## 7. Web app

- **AI visibility page:**
  - Tiles: named (with its range), visibility score, share of voice (+ market-wide), AI visits, pages cited.
  - Trend: weekly, daily (pulse), score, AI Overviews.
  - Panels: what AI visits are worth, how AI describes you (sentiment, words, wrong claims), can AI read your site, by stage / topic.
  - Engine table: 7-day answers + range. Question grid: this week's win rate + demand. Gaps: demand + fan-out.
  - Market-wide index, what AI searched, questions worth tracking (one-click Track).
  - Answers: sentiment, wrong claims, searches.
- **Monitor settings:** questions 3–50, "Daily AI pulse" with its cost, cost split (weekly / monthly vs pulse).
- **Pipeline:** new automation "AI pulse" (daily schedule kind, Tue–Sun 06:30; not drawn in the 4-week calendar).
- **Reports:** v4.9 blocks in the AI visibility report; a renderer for `ai_pulse` alerts.
- **Fixes:**
  - The market-view position was ignored (n8n stores a number).
  - Cited pages now carry their engines.

## 8. Tests

**Harness (1332 node runs and assertions, 0 failed):**
- **S19 rewritten.** It runs the plan, discovery, the panel, GA4, crawler access, real engine answers (+ Gemini scraper / LLM Mentions / AI Keyword Data shapes from DataForSEO's free sandbox, `fixtures_live/sandbox_v49.json`), the Answer Analyst, metrics, rows, report and callback. It then covers a second week with 6 pulse days (significance, carried monthly parts, a GA4 permission error, robots.txt blocking the ChatGPT bots), ad hoc and fallbacks.
- **S27 new.** The pulse: plan, requests, parsing with learned names, the daily row, the three alerts, a quiet day, too few samples, pulse off / on demand, no panel yet, and Site Admin settings.

**App:**
- 175 unit tests, including `shared/src/ai-visibility.test.ts` (cost model, settings, schedule).
- `smoke.py` ALL PASSED.
- Playwright screenshots of the page and settings (desktop + 390 px, no overflow, no page errors).

**Free live checks on techand.ai (2026-10-08):**
- GA4 accepted all four AI-referral reports. 0 AI visits in the window, so the panel shows zeros, not an error.
- The access check found robots.txt and a real llms.txt, and all 8 answer crawlers allowed.

## 9. Open / next

- **Paid live test: done 2026-10-08** (REVIEW §5c V1-V2): on-demand full run $0.59 of DataForSEO in 100 s, one pulse $0.084 in 57 s, both into the app. Found and fixed: Claude's LLM Responses endpoint refuses `web_search_country_iso_code` (40501; the free sandbox accepted it — the sandbox does not validate fields). Claude's answers are first live on the next full run.
- **techand.ai's panel is still 8 questions.** Raise it in Website settings → Tracking & monitors (20 recommended); the next run writes the new questions from real AI searches.
- **Not possible with our data sources:**
  - Copilot, Grok, Meta AI and DeepSeek answers (DataForSEO has no scraper for them).
  - ChatGPT database data outside US-English.
  - Server-log agent analytics (needs the site's CDN logs).
  - Search Console's generative-AI report (no API yet).
  - Shopping / product visibility.
  - Candidates for later: a Cloudflare Logpush import for agent analytics, Bing Webmaster AI Performance CSV import, several markets per site (prompts per language).
- **Multi-site scale.** One weekly execution covers every site. With many sites, the request cap (900) and the 24-job analyst cap apply; a per-site sub-execution is the next step when more than ~15 sites are tracked.

## 10. G6 (2026-10-18): the question panel at enterprise scale

Asked for by the owner after the 2026-10-17 re-rating (area 8 = 7, market position 5; `docs/system-review-2026-10-17/MARKET_BENCHMARK.md`
§5 #8: "a 20-prompt panel is a sample of one category; enterprise brands run hundreds of prompts by product line, persona and market" —
seoClarity from 500 prompts across 9 engines, SE Visible up to 1,000 daily, Profound licensed prompt volumes). Handoff, cost table, owner
steps and live checks: `docs/AI_PANEL_SCALE_HANDOFF.md`. The kit is `v5/code/_ai_panel.js` (AIP); harness S200–S211.

### 10.1 The panel
- **3–500 questions** (`ai_prompts_max`). A website with no `seo_monitors` row starts at **50**; a row whose size is empty keeps the
  v4.9 default **20**; a stored size is never changed by a release (`AIP.panelSize` = `_monitor_sites.js panelMaxOf`, S200).
- Every question carries **persona** (buyer role), **stage** (funnel), **cluster** (topic / product line) and **market** (`CC-lang`).
  Settings `ai_personas` (≤ 6), `ai_markets` (≤ 5, the site's own market always included; a stored question keeps its own market; a
  country outside the 22-country table is asked at DataForSEO location 2000 + ISO numeric — `AIP.locationOf`).
- **Writing** (first execution of a run only): Prompt Jobs splits the gap into **cells** (market × persona, filled towards an equal
  share), ≤ 40 questions a job, ≤ 14 jobs a run (a new 500-question panel in one run). Sources per cell: LLM Mentions
  `search_mentions` (up to 4 topics for a big top-up), **People-also-ask** (`serp/google/organic` per topic and market, $0.002), Search
  Console questions, the site's services / ladders / keywords, and the headings of up to 3 declared competitors' homepages (Jina; topic
  ideas, never names). With no personas on file a panel above 50 is written for four generic buyer roles.
- **Dedupe by meaning**: content-word stems, Jaccard ≥ 0.6, within one market and role (`AIP.dedupe`). **Fit gate** on the search
  phrase AND the wording (`fitGate`, the read path's rule): own brand, another company, a government service, a portal task → stored
  `status: refused` with the gate's sentence in `fit_note` — never asked, shown in the app.
- **Owner**: Site Admin `ai_prompts` — add ≤ 500 (text or `{prompt, persona, cluster, stage, market, pinned}`; the app's CSV import),
  edit in place, **new wording = a new question** (the old one switched off), off / on (a refused one becomes the owner's own), pin / unpin.
  Pinned questions are asked first and survive a smaller panel.

### 10.2 The weekly run, split across executions
- The whole panel on every enabled engine, every week. One run = one `run_id` + a state row `seo_cache` `ai_run:<site_id>` (kind `ai`).
- The run's requests are one deterministic list (questions in panel order × engines in a fixed order). An execution asks only the keys
  (`prompt_id|engine`) no earlier execution of the run stored (`Load AI Run Answers`: run_kind ≠ pulse, last 6.2 days), at most **600 per
  site and 1,200 per execution** (~30 MB of execution data). A failed request (after the in-200 retry) is stored and counted, never asked
  again in the same run.
- **AI Chunk Handoff** writes the state (chunk, asked / total, money spent, unavailable, executions) and, when the run is not finished,
  starts the next execution (**Start Next Chunk**, Execute Workflow, `continue_run` + `parent_run_id` = this execution, no wait). The
  **last** execution reads GA4, crawler access and the database views and **AI Metrics** measures the week over every answer of the run
  (stored + its own), then marks the state `done`.
- **Resume**: a state `running` and silent ≥ 65 minutes (the tracker's 60-minute limit + 5) is resumed by any start of the tracker
  (schedule, catch-up, on demand) and by the pulse every morning (**AI Run Resume** → **Resume AI Run**, after the pulse's own ledger
  row). A start while a part is still running is a twin and does nothing for that site; a state older than 6 days is closed.
- **Ledger**: each execution reserves what is LEFT of the run (`AIP.cost` − spent; `Monitor_Ledger_Row` uses the plan's `est_*_usd`) and
  settles its own measured DataForSEO (`measured='AI Metrics|AI Chunk Handoff'`); a continuation's row is keyed `parent:<execution>`, so
  the run guard never takes it for a twin; the guard refuses a run the account cannot pay for. A run above `max_run_usd` ($150) is refused
  by the plan with the reason. AI Requests' cost cap follows the estimate (×1.25, ≥ the v4.9 caps, ≤ $150).
- Retention: weekly answers 120 days (was 400), pulse answers 21 (was 35) — n8n holds ALL Data Tables in 200 MB by default
  (`N8N_DATA_TABLES_MAX_SIZE_BYTES`, n8n 2.41.4); a 500-question site stores ~6.9 MB of answers a week.

### 10.3 The daily pulse: a stratified rotating sample
- Up to 50 questions (auto): every question every morning, as before. Above (or `ai_pulse_mode: sample`): strata = cluster × persona;
  each question has a slot in its stratum (round-robin, per-stratum offset); it is asked on **N** of the six pulse mornings of every ISO
  week (a pulse-day counter that skips Mondays), so exactly N times a week; every stratum is in every morning (a stratum too small for its
  slots gets one question that morning in turn). N = `ai_pulse_per_week`, or the fewest mornings that bring the weekly headline to ±3
  points and the median cluster to ±8 (95%, p = 0.5), within one morning's 900 requests. `full` asks everything that fits.
- `seo_ai_daily.sample_json` records the morning's sample; the mail says "N of your M questions (a rotating sample …)".

### 10.4 Statistics
- **Segments** per engine, cluster, persona, market, stage and cluster × persona, engine × cluster, market × cluster: this run's
  weekly-engine answers + the pulse answers of the same questions; Wilson 95% range; "too few answers" under 12; share of voice and the
  leading rival per segment (weekly answers).
- **Changes per segment** only against a comparable panel, each with ≥ 12 answers a side and ≤ 20% drift in its question count; the family
  is corrected with **Benjamini–Hochberg (q = 0.10)** — over dozens to hundreds of tests Holm's first step needs p ≤ 0.00025 and would hide
  every real move; the headline alert family keeps **Holm** (≤ ~10 tests, each interrupts the owner).
- **Panel identity**: the asked question ids are stored (`panel_json`); under 80% in common there is no delta at all ("a different
  panel, not a different result"), on top of the size and engine-set checks. The measured and achievable half-widths are printed.
- Fixed on the way: a pulse answer naming the business FIRST (`M` / `C`) was not counted as named in the weekly per-question win rate.

### 10.5 Engines (DataForSEO sandbox, probed 2026-10-18 from inside the n8n container)
Working: ChatGPT (LLM scraper + LLM Responses), Gemini (scraper + Responses), Claude (Responses), Perplexity (Responses), Google AI Mode,
AI Overview, Bing (Copilot summary). **No endpoint (40402)**: Grok, DeepSeek, Meta AI, Mistral, Copilot API, Llama, Qwen, Claude and
Perplexity scrapers. New opt-in engines: **ChatGPT API** (`gpt-5.4-mini`, web search, est. $0.012) and **Gemini API**
(`gemini-3.5-flash`, web search, est. $0.02) — what an app or agent built on the models answers. Fields that need one live call:
handoff §7.

### 10.6 Cost: one formula, one table
`AIP.cost` (engine) and `estimateAiPanelCost` (`app/shared/src/ai-panel.ts`) are held to the same 20 golden cases
(`v5/data/ai_panel_cost_cases.json` → harness S211 and `app/shared/src/cost.aipanel.test.ts`; the build refuses a stale table).
Calibrated: 8 questions $4.32 / month with a $0.084 pulse morning (measured live), 20 questions $9.40; 100 → $28.86, 200 → $56.91,
500 → $138.36 a month on the six default engines with the automatic pulse (full table in the handoff §4).

### 10.7 App, API, business site
AI visibility page: segments (bar + 95% whisker on a fixed 0–100 scale, too few answers, BH moves, precision), the panel manager
(filters, CSV import, edit, pin, off / on, suggestions); settings: size up to 500, buyer roles, markets, pulse sampling, the cost and the
precision before saving; guides `ai-buyer-roles`, `ai-markets`, `ai-panel-import`; read API `GET /api/v1/websites/:id/ai-segments` +
MCP `get_ai_visibility_segments`. Business site: the capability, the changelog of 2026-10-18, pricing rows marked PLACEHOLDER.

### 10.8 Not built / open
- Licensed prompt volumes outside DataForSEO's LLM Mentions (ChatGPT data is US-English only; Profound licenses a panel) — a data
  purchase, not a feature.
- A per-morning split of the pulse across executions (one morning asks at most 900 requests; `full` on a big panel is capped and says so).
- Grok / DeepSeek / Meta AI: no DataForSEO endpoint (re-probe when DataForSEO adds one).
- The question-volume lookup still covers the panel's search phrases, ≤ 100 a run.

