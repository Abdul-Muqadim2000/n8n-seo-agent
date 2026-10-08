# AI search visibility v4.9: from 6/10 to best in class

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
- **One business, one key.** A brand name joins its domain when the Answer Analyst learned it ("ClearTax" → cleartax.com) or when the name matches the domain label (`brandKey` / `mergeBrands`). Share of voice = your mentions ÷ (yours + the top 8 competitors).
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
