# R5: system survey of the AI acting loop (2026-11-05)

Read-only survey of what the engine and the app do today to get a client NAMED and CITED in AI answers, written before designing the new
AI-ranking algorithm. Every claim has a file:line. Paths are relative to `n8n/seo-agent/` unless they start with `app/`.
Line numbers are from the branch `feature/seo-agent-v4.5` at `1a8bfbf0`.

Nothing here was run against production. Production facts are quoted from CLAUDE.md and the prior docs, and are marked as such.

## 0. Summary in eight lines

1. Measurement is strong: question panel, 5 to 7 engines, daily pulse, entity roles, cluster-robust ranges, share of voice, retrieved-not-cited, fan-out gap and a did-it-work test.
2. Acting is thin. Four levers exist: the AI page of the week, earned-media pitches, Bing / IndexNow submission, and the readiness checks of key pages.
3. Every lever is chosen by a fixed heuristic over the latest run. None of them is chosen by a diagnosis of WHY the client is not named.
4. No per-question diagnosis exists. Retrieved-not-cited is per URL, and only for ChatGPT. Brand-known is site-wide and monthly. The fan-out rank is per search, and off by default.
5. The loop breaks at "written". AI pages are drafts that a person must publish. Wins and did-it-work are timed from `written_at` (the start of the page run), not from publication or a crawl.
6. Earned media is never sent from the AI page (Copy / mailto / Mark as sent). Through the Link Builder it is ranked lowest (likelihood 0.35) and needs a connected mailbox plus approval.
7. Did-it-work exists for two kinds of action only: AI targets and published pages. Its verdicts feed nothing: there is no learning step.
8. The cycle order is already right (AI visibility -> AI growth -> cadence -> link builder, `v5/code/_cycle.js:29-36`). A new algorithm can sit inside AI Growth, beside the old logic, behind a per-site setting, in shadow mode first, without changing any callback, table or app shape.

## 1. The loop as it exists

```
            +-------------------------------------------------------------------------------------------+
            |  each website's weekly cycle (Cycle Dispatcher, _cycle.js:29-36, order fixed):              |
            |  ai_visibility -> backlinks -> rank_tracker -> site_tracker -> ai_growth -> content_cadence  |
            |  -> link_builder -> audit ; AI Pulse daily on the other days                                  |
            +-------------------------------------------------------------------------------------------+

 MEASURE (strong)                    DIAGNOSE (missing)             CHOOSE (heuristic)                EXECUTE (mostly human)
 AI Visibility Tracker  ----------->  per-question: nothing  ---->  Growth_Plan.js                ->  Bing SubmitUrlBatch + IndexNow: AUTOMATIC
  AI_Plan / AI_Requests              per-URL: retrieved_not_cited    targets = latest gaps (<=8)       (needs Bing account / client key file)
  Parse_AI_Answers                     (ChatGPT only)                 earned = cited pages that        AI page: Cadence writes a DRAFT
  AI_Metrics (gaps, actions,         site-wide: brand known            did not name us                  (level 3 auto; level 2 refresh only;
   SOV, impact, fan-out list)          (monthly brand question)       key pages = readiness checks     answer pages only suggested)
 AI Pulse (daily answers)            per-search: fanout_gap           corrections = wrong claims      -> PUBLISH: always a person
 AI Extras (fanout_gap, opt-in)        (off by default)                                               Earned media: draft <=3/week or hand
                                                                                                       to Link Builder; SEND: person
                                                                                                       (mailbox + approval) or Copy/mailto
        ^                                                                                                         |
        |  VERIFY                                                                                                  v
        |  target "won" = named in >=2 answers of last 8 days AND row written (Growth_Plan.js:190-191)
        |  earned "won" = the cited page's text now names us (Earned_Media.js:47,70)
        |  Bing outcome = GetUrlInfo crawl date (Growth_Metrics.js:64-76)
        |  did-it-work = AVX.impact DiD over 28 days for targets + published pages (_ai_measure.js:158-193, 288-297)
        |
        +-- LEARN: nothing. impact_json is shown in the app and never read by a choosing step.
```

## 2. Engine, step by step

### 2.1 Measure

- **The panel.**
  - `_ai_panel.js` (AIP) holds the panel at scale (3 to 500 questions), the cost formula, the request order and the split-run state (header `_ai_panel.js:1-6`).
  - `_ai_focus.js` decides which questions follow the client's focus (ladders, pages, pins). It is inlined into AI_Plan, Prompt_Jobs, Prompt_Rows, Pulse_Plan and AI_Metrics (`_ai_focus.js:1-6`).
  - The focus decides WHAT IS MEASURED. It does not decide what is done.
- **Answers.**
  - `AI_Requests.js:1-6` sends one DataForSEO request per question x engine: ChatGPT and Gemini scrapers, Perplexity / Claude LLM Responses, AI Mode, AI Overview, and Copilot opt-in.
  - `Parse_AI_Answers.js:1-6` writes one `seo_ai_answers` row per answer. It holds mentioned, cited, rank, competitors, sources, `cited_urls` and fan-out queries.
  - `_ai_answer_data.js:1-6, 59-62` adds the full answer text, `cited_json`, `retrieved_json` and `fanout_json`. `retrieved_json` comes from ChatGPT `search_results` only.
- **Entities.** `_ai_entities.js:1-6, 305-309` keeps one entity per business with a role (source / platform / competitor). Only role `competitor` counts as a rival (`Parse_AI_Answers.js:61`).
- **Pulse.** `Pulse_Plan.js:1-4` and `Pulse_Metrics.js:1-4` ask the panel daily on the fast engines and write `seo_ai_daily` plus answer rows. Those rows are kept 35 days (`build_monitors.py:476, 614`).
- **Per-question figures.**
  - Built in `AI_Metrics.js:242-251`: win rate, samples, competitors, sources, fan-out and `cited_urls`.
  - A rate needs at least 4 samples (`MIN_Q_SAMPLES`, `_ai_stats.js:158`).
  - A site rate needs at least 12 (`_ai_stats.js:157`).
- **Gaps.** `AI_Metrics.js:256-257` defines them:

  ```
  lostQ = questions.filter(q => !q.won && q.kind !== 'brand' && q.competitors.length)
  gaps  = lostQ.filter(q => q.decided).slice(0, 8)
  ```

  So a lost question is one where no answer in the run named us AND at least one competitor was named. Sorting is by volume.

  - A question where AI names NOBODY (informational answers) is never a gap.
  - At most 8 gaps exist per run.
- **Fan-out list.** `AI_Metrics.js:295-296` keeps the top 15 searches by frequency. It is used only for one action line (`AI_Metrics.js:628`).
- **Retrieved but not cited.** `_ai_answer_data.js:153-166`, per own URL. It drives one action, "Make AI cite <page>" (`AI_Metrics.js:716-717`).
- **Fan-out ranking gap.**
  - `_ai_w2e3.js:78-96` checks Google's top 10 for the N most frequent fan-out searches.
  - Each search gets a flag (`_ai_w2e3.js:89`): `ranks_not_cited`, `cited`, `ranks` or `not_in_top10`.
  - Opt-in through `ai_fanout_check`, default 0 (`_monitor_sites.js:70`, `AI_Extra_Requests.js:33`).
  - The result goes to `fanout_gap_json`, the report and the app. No acting node reads it.
- **Actions list.**
  - `AI_Metrics.js:614-628, 716-717` is a fixed list in a fixed order:
    - access;
    - gone URLs;
    - accuracy corrections;
    - "Win the answer to" for the top 3 gaps, with a ready API body carrying `ai_target`;
    - source verbs (pr / review / directory);
    - platforms;
    - official lists;
    - entity;
    - "give AI something to cite";
    - fan-out;
    - cite.
  - These are text plus an API body for a person. Nothing runs them.

### 2.2 Diagnose: what exists and what does not

| Signal | Where | Granularity | Used by |
|---|---|---|---|
| Named / cited per answer | `seo_ai_answers` (Parse_AI_Answers.js) | answer | win rates, gaps |
| Retrieved but not cited (own URL read, not cited) | `_ai_answer_data.js:153-166` | own URL, ChatGPT only | one action, app panel |
| Brand known (direct brand question) | `AI_Metrics.js:626` | site, monthly | one "entity" action |
| Fan-out rank flags | `_ai_w2e3.js:89` | search | report only |
| Cited third-party pages | `cited_urls` (Parse_AI_Answers.js header), `Growth_Plan.js:226-241` | answer | earned media |
| Wrong claims | perception_json, `Growth_Plan.js:248-267` | claim | corrections |
| Robots / fetcher refusal | `_ai_access_kit.js`, `Growth_Robots.js`, `AI_Readiness.js` | page | access actions |

**No per-question class exists.** That class would be:
- (a) our page is not retrieved for the question's searches;
- (b) it is retrieved but not cited;
- (c) the brand is not known to the engine;
- (d) the answer names nobody / is not a recommendation question;
- (e) the question's searches are dominated by lists that leave us out.

The data for (a), (b) and (e) is already stored per answer: `retrieved_json`, `cited_json` and `fanout_json` per answer, plus `fanout_gap_json` when it is on. The data for (c) is the monthly brand question. Nothing joins them per question.

### 2.3 Choose: AI Growth (`SEOagentAIGrow1`, `build_monitors.py:840-933`)

- **Trigger and inputs.**
  - Manual Run only, started by the cycle dispatcher or on demand (`build_monitors.py:841`).
  - It ensures 6 tables and loads 13 (`build_monitors.py:842-849`).
  - It loads answers from the last 8 days: weekly runs plus pulse (`build_monitors.py:849`).
- **Sites.** Only sites with `ai_visibility` AND `growth` on (`Growth_Plan.js:24-25`).

**Questions to win: what is picked and how** (`Growth_Plan.js:115-200`)
- **Source.** Only `gaps_json` of the latest visibility row (`Growth_Plan.js:78, 133`), brand questions excluded, at most 10 (in practice at most 8).
- **Keyword.** The prompt's stored keyword, else the gap topic, else the first 5 tokens (`Growth_Plan.js:134`).
- **Fit gate.**
  - `fitGate(keyword, targetCtx)` runs first (`Growth_Plan.js:136`), over topics built from ladder heads, kept rungs and services (`Growth_Plan.js:95-97`).
  - With too little topic evidence, the target is "unjudged" and only suggested (`Growth_Plan.js:137-138, 172`).
- **Page match** (`pageFor`, `Growth_Plan.js:116-124`), in this order:
  1. a page AI already cited for this question;
  2. a Search Console page with IDF-weighted word cover >= 0.7;
  3. a published ladder page with cover >= 0.6;
  4. a page written earlier.

  A match makes `kind = refresh`, otherwise `answer` (`Growth_Plan.js:145`).
- **Same-search ladder page.** A planned ladder page for the same search is noted, so the cadence writes it as the ladder page (`Growth_Plan.js:141-143`).
- **Value.** `100 * (1 + log10(1+volume)/2) * stage_weight * (1 + min(4,competitors)/4) * (1 + absent_engines/7)` (`Growth_Plan.js:147`).
  - It contains no measure of whether we CAN win: no reach, no fan-out rank, no retrieval.
  - It contains no measure of why we lose.
- **Status.**
  - Status is decided at `Growth_Plan.js:166-170`.
  - Up to 6 targets are queued by value; the rest are skipped for the week (`Growth_Plan.js:199-200`).
- **Win.**
  - A row not in this week's gaps is `won` only if it was written and named in at least 2 answers of the last 8 days (`Growth_Plan.js:187-198`). Otherwise it becomes `skipped` or is kept.
  - Every existing target row of the site is rewritten on every run (see the blast radius, §6).
- **Decay.** A page AI cited in at least 2 of the earlier runs and in neither of the last two becomes a "Refresh" action (`Growth_Plan.js:72-77`, `Growth_Metrics.js:136-137`). This is an action line only, not a target.

**Earned media: how targets are picked** (`Growth_Plan.js:220-241`, `Earned_Media.js`)
- **Candidates.**
  - Third-party URLs in `cited_urls` of answers from the last 8 days that did NOT name us (`Growth_Plan.js:226`). Brand questions are excluded.
  - Rank = citations x (1 + engines). At most 2 per host and 30 in all (`Growth_Plan.js:238-241`).
- **Kind classifier.** Regex on host and title (`Growth_Plan.js:40-49`): competitor, encyclopedia, official, forum, video, social, review, list, news, article.
- **Fetch.** The top 10 that are not competitors are fetched (`Growth_Plan.js:294`). The fetch decides:
  - whether the page names us (`mentions_us`, `Earned_Media.js:47`);
  - which competitors it names;
  - the contact e-mail or URL (`Earned_Media.js:49-51`).
- **Rival exclusion.** The rival set is declared competitors + `rival_sources_json` + `ai_brands:` aliases + `RV.providerOf` (anyone selling the same thing) (`Earned_Media.js:38-62`).
- **Value and action.**
  - Value = citations x engines x a kind weight; lists weigh 1.4 (`Earned_Media.js:53`).
  - The action comes from a fixed table by kind (`Earned_Media.js:17-28`).
- **Prospect rows.**
  - Up to 12 rows of type `ai_source` go to `seo_link_prospects`, one per domain (`Earned_Media.js:67-78`).
  - "Won" = the page now names us (`Earned_Media.js:70`).
- **Drafts.**
  - With the Link Builder off, at most 3 drafts per week, through the AI Outreach Writer (`Earned_Media.js:93-94`).
  - With it on, nothing is drafted here; the row is a hand-over (`Earned_Media.js:85`).
  - Gates: bad host, government, homepage-only, sells the same, accredited lists (`Earned_Media.js:86-90`).
- **Link Builder.** It scores `ai_source` with likelihood 0.35, the lowest but one (`LB_Assemble.js:34, 164`). Lists are aimed at an `ai_list` target page (`LB_Assemble.js:161`).
- **What is not used.** The question's value, its volume, its buyer stage, and the number of our gaps that page covers do not enter earned-media ranking.

**Corrections** (`Growth_Plan.js:248-268`, `Earned_Media.js:97-120`)
- A wrong claim with the true fact on file and a cited page that really carries the claim becomes a draft or a Link Builder hand-over.
- Without the fact on file it becomes a "needs your fact" action.

**Key pages, readiness and submission**
- Key pages (`Growth_Plan.js:107-114`):
  - pages AI cited;
  - written pages;
  - ladder pages;
  - the top 10 Search Console pages;
  - the homepage;
  - target pages.
- Up to 12 key pages are audited per week (`Growth_Plan.js:202-205`) by `AI_Readiness.js:1-6`. The checks cover reachability, raw text, the answer in the first ~200 characters, a visible date, question headings, sourced figures and an author.
- Submission (`Growth_Plan.js:214-219`): new or updated pages, and key pages Bing has not crawled, go to Bing SubmitUrlBatch and IndexNow.
  - IndexNow needs the client's key file.
  - Bing needs the site in the Bing Webmaster account.
- Follow-up asks Bing whether submitted pages were crawled (`Growth_Plan.js:210-213`, `Growth_Metrics.js:56-76`).
- Readiness produces ACTIONS only (`Growth_Metrics.js:112-143`). Nothing fixes a page.

**Entity.** A monthly Wikidata lookup (`Growth_Plan.js:275-276`, `Growth_Metrics.js:100-104`) leads to the action "Become a recognised entity" (`Growth_Metrics.js:144`).

### 2.4 Execute: Content Cadence AI page (`Cadence_Plan.js`)

- **Candidates.**
  - Loaded from `seo_ai_targets` rows with status `queued` (`Cadence_Plan.js:127`).
  - The quota is `ai_pages_month` (default 2) and is 0 when ai_visibility or ai_growth is off (`Cadence_Plan.js:139`).
- **Filter** (`Cadence_Plan.js:436-445`). A candidate is dropped when:
  - it is the same search as a ladder page (it is written as that ladder page instead, `Cadence_Plan.js:532`);
  - its keyword was written recently;
  - it is a refresh of a page refreshed within 60 days;
  - the fit gate refuses it;
  - the client skipped it.
- **Order.** In-topic first, then by value (`Cadence_Plan.js:438, 448`).
- **One per week.** One AI page a week, within the month's quota (`Cadence_Plan.js:449`).
- **Autopilot level** (`Cadence_Plan.js:24-40, 452-456, 530-535`). The default level is 2.
  - Level 2: only an in-topic AI REFRESH runs on its own, and it takes a slot of pages per week. An AI ANSWER page (a new page) is only a suggestion.
  - Level 3: the AI page comes on top of the week's pages.
- **Page writer.**
  - `ai_target` reaches `v5/prompts/strategy_brief.txt:53` and `v5/prompts/copywriter.txt:6`.
  - The brief asks for the question in the H1, a 40 to 60 word answer first, one question H2 per fan-out search, a neutral comparison table, sourced figures, and follow-up questions as headings.
  - Content QA measures `ai_ready` (`Content_QA.js:717-742`): quick-answer words and fan-out searches covered.
- **Status.**
  - `AI_Target_Marks.js` sets the target to `writing` at the start of the run (`build_site_tracker.py:551`).
  - `AI_Target_Settle.js` sets it to `written` only on a `written` / `published` content-log row (`AI_Target_Settle.js:34`).
- **Publishing.** Always a person: the app's CMS publish is manual (`app/server/src/services/cms/service.ts:400-410`). The engine sees publication only through the content log, from the "I published a page" call or the Site Tracker's publish detection.

### 2.5 Verify and learn

- **Target won.** `Growth_Plan.js:190-191` requires `written`, not published. A page that is written but never published can never cause a win; a win then is coincidence.
- **Did it work.**
  - `_ai_measure.js:158-193` (`AVX.impact`) tests treated questions against up to 3 matched control questions per treated one, over 28 days before and after.
  - It uses a two-level bootstrap. The verdict is likely helped / likely hurt / can't tell, and it needs at least 12 answers per arm and phase and at least 7 days after.
- **Which actions are tested.** Only (`_ai_measure.js:288-296`):
  - AI targets that are written / won / published, timed at `written_at`, which is the START of the page run;
  - published content-log pages, timed at `published_at` and mapped to questions by keyword substring (`qOfKw`).

  Not tested: earned media sends, earned wins, Bing / IndexNow submissions, readiness fixes, corrections, entity work and Link Builder links.
- **Learning.** None. `impact_json` is written (`AI_Metrics.js:709`) and shown in the app (`app/shared/src/ai-detail.ts:292-304`). No choosing step reads it. The value formula and the earned-media weights are constants.
- **Bing outcome.** The crawl date is measured (`Growth_Metrics.js:64-76`). Nothing links it to citations.

### 2.6 Cycle dispatcher

- `_cycle.js:29-36` fixes the job order: AI visibility first, AI growth fifth, the cadence sixth, the Link Builder seventh. The loop therefore closes inside one cycle.
- The order is a contract with `app/shared/src/cycles.ts:6-17` (harness CY1, build section 140).
- The mode `plan_only` / `start` is read from `seo_cache cycle:mode` (`_cycle.js:716, 734`). Production's current mode was not checked here.

## 3. App: what the client sees, approves, and what is done for them

This section comes from a survey of `app/`.

**Data.**
- `app/server/src/services/data.ts:1149-1162` reads `seo_ai_visibility`, `seo_ai_prompts`, `seo_ai_daily`, `seo_ai_growth`, `seo_ai_pages`, `seo_ai_targets`, `seo_link_prospects` (type `ai_source`), `seo_content_log` and `seo_monitors`.
- `seo_ai_answers` is read only for the latest run (`data.ts:1315`) and the drill-down (`aiWave2.ts:88-92`).
- `toGrowth` (`data.ts:1644-1680`) joins earned pages to their prospect rows. "Written this month" counts content-log rows whose `source` starts with `ai_`.
- The JSON panels are parsed in `app/shared/src/ai-detail.ts:442-460`.

**AI visibility page** (`app/web/src/pages/site/AiVisibilityPage.tsx`):
- the headline and metrics (115-221);
- share of voice (243-271);
- "Your pages in AI answers", including "Read but not cited" (275, `_components/ai-panels2.tsx:107-140`);
- "Did it work?" (276, `ai-panels2.tsx:296-316`);
- "Searches behind the answers", the fan-out gap (277, `ai-panels2.tsx:319-334`);
- "Questions you lose" with a "Write the page" button (571-636);
- "What to do next", from the engine's actions (328);
- the AI growth section (333).

**AI growth section** (`_components/ai-growth.tsx`):
- **IndexNow key.** Copy, then "Check the file" (108-170). This becomes a site task (`app/server/src/services/siteTasks.ts:772-777`).
- **Earned pages.** Copy / "Open in your e-mail" (mailto) / "Mark as sent" / "Not a fit" (173-250).
- **Questions to win.** Each has a "Write it now" button that starts a paid keyword run carrying `aiTarget` (252-296).
- **Readiness per page** (299-325).

**Recommendations** (`app/server/src/services/recommendations.ts`):
- `ai:indexnow` (211), `ai:crawlers` (215), `ai:outreach` (219, "send from your mailbox, mark as sent");
- `ai:low` (375), `ai:gap:<question>` (385-394, only when no AI report was delivered);
- `auto:ai` / `setup:ai` (201-206).

**Cadence mirror.** `app/server/src/services/cadence.ts:786-845` reproduces Cadence_Plan's AI rules for the approval queue: level 2 refresh only, level 3 adds an AI page.

**Done for the client automatically:**
- Bing and IndexNow submission (the engine);
- page drafts written by the cadence (not published);
- Link Builder sequences sent from the client's mailbox, after approval or in automatic mode (`app/server/src/services/linkBuilder.ts:68, 189-224`, `outreachJobs.ts`).

**Left to the client:**
- publishing every page;
- every AI-page earned-media pitch (Copy / mailto);
- review-site profiles, forum replies, videos, Wikidata;
- the IndexNow file and the robots.txt changes.

**Diagnosis in the app.** None per question. There are scattered hints: competitors and sources on lost-question cards, "Read but not cited" per page, "Ranks, not cited" per search, perception and crawler access site-wide.

**Lift in the app.** Only the engine's `impact_json`. The only "won" signals are a target's `won_at`, a prospect's `mentions_us` and the Link building page's `seo_link_impact`.

## 4. Prior audits: what was fixed, what remains

Sources: `docs/ai-visibility-2026-10-23/{ENGINE_AUDIT,APP_AUDIT,REVIEW_ENGINE,RESUME}.md`, `fixes/*.md`, `docs/ai-panel-focus-2026-10-27/RESEARCH_AND_DESIGN.md`.

### Fixed and deployed (2026-10-23 at 84d65d8f; focus 2026-10-27)

- **Entities** (E3 E4 E5 E8 E10 E16, F1a). Confirmed in code at `_ai_entities.js:12, 88, 305-309` and `Parse_AI_Answers.js:61`.
- **Numbers** (E6 E7 E13 E14 E19 E21, F1b). A citation alone weighs 0.4 (`_ai_stats.js:9-12`).
- **Run safety** (E1 E2 E9 E11 E12 E15 E17 E18 E20 E22, F2):
  - never pay twice: `AI_Asking_State.js:18,27`, `AI_Plan.js:76-78,122`;
  - Unicode 64-bit ids: `_ai_panel.js:118`.
- **App findings A1-A20** (F3): A10, A1 step 4 and A7 partly.
- **Review items R-E1..R-E14** (R-ENGINE.md) and **R-A1..R-A21** (R-APP.md, W2-FIX.md).
- **Wave 2:**
  - W2-E1 answer data and retrieved-not-cited;
  - W2-E2 measurement, sentiment and impact;
  - W2-E3 fan-out gap, persona, demand and imports;
  - W2-A app panels.
- **Panel focus.** Built in `_ai_focus.js`, wired at `AI_Plan.js:173,176`, `Pulse_Plan.js:69-71` and `AI_Metrics.js:454,466`. Columns at `ladder_common.py:199,223`. App mirror in `app/shared/src/ai-focus.ts`, with a parity test.

### Open, as the reports say

- **Acting side never audited.** ENGINE_AUDIT's scope was measurement only (ENGINE_AUDIT lines 4-11). How AI Growth picks targets, earned media and AI pages has never been reviewed.
- **Fan-out gap not used for acting.**
  - It is built and off by default.
  - MARKET_RND gap 4 ("hand the gaps to the page writer as sections") is not built.
  - Today the writer only gets the raw fan-out strings through `ai_target.fanout`.
- **Did-it-work gaps.** Corrections are not evaluated (W2-E2 open item 4). Earned links and outreach are not a treatment. No feedback into choice.
- **Fetched-to-visited path not built.** The per-URL path from fetched to visited is open (W2-E1 open item 5, MARKET_RND gap 3), because crawler logs live in app Postgres and GA4 lives in n8n.
- **Paid live checks never run:**
  - `live_checks_aivis.py` (~$0.38);
  - `eval_sentiment_model.js` (~$0.10).
- **Preview options.** `ai_persona_context` and `ai_demand_market` stay preview.
- **Repeat pilot** (`SEOagentAIPilot1`): never run.
- **Data Table capacity.** There is no check of Data Table bytes against the 1 GiB cap.
- **Pulse state.** The pulse does not write the asked state.
- **Owner decisions open:**
  - `dfs_budget_usd` $15 a day;
  - A12 history retention;
  - panel size.
  - AI-only CDN pages were rejected as near-cloaking (MARKET_RND §3.2).
- **Evidence from MARKET_RND §4.6.** Earned mentions and "best X" lists correlate most with AI mentions; schema and llms.txt show none. No reviewed technique has a proven causal effect. Our own did-it-work is therefore the only judge.
- **Production (CLAUDE.md, 2026-11-05).** devaicon.com is named in 0 AI answers. The production AI tables were empty before 2026-10-23.

## 5. Gap table (ranked for "get named and cited")

The size column is a guess: S < 1 day, M 1-3 days, L > 3 days, offline built and harness-tested.

| # | Gap | Where | What is missing or broken | Size |
|---|---|---|---|---|
| 1 | **No per-question diagnosis** | none; inputs at `_ai_answer_data.js:59-62,153-166`, `_ai_w2e3.js:78-96`, `AI_Metrics.js:242-251,626` | Nothing classifies a lost question as: not retrieved, retrieved but not cited, brand not known, nobody named, or list-dominated. Every lever is chosen without knowing which one fits. The stored data (`retrieved_json`, `cited_json`, `fanout_json` per answer) already supports most of the classes. | M (new pure kit + one table) |
| 2 | **Loop breaks at "written"** | `Growth_Plan.js:190-191`, `_ai_measure.js:290-292`, `Cadence_Plan.js:24-40`, `app/server/src/services/cms/service.ts:400-410` | Pages are drafts until a person publishes them. Wins and impact are timed at `written_at`, the start of the run. No check that the page is live, crawled by Bing or readable by the AI fetchers before it counts. At the default level 2, AI answer pages are only suggestions. | M (state `live` from content log + Bing crawl; timing change) plus an owner decision on auto-publish |
| 3 | **Target selection is a fixed heuristic over 8 gaps** | `AI_Metrics.js:256-257`, `Growth_Plan.js:133,147,199-200` | Only questions where a competitor is named and we are not (at least 4 samples). Questions answered with no business are never targets. The value has no winnability (reach, fan-out rank, retrieval) and no expected lift. At most 6 queued. | M |
| 4 | **Fan-out gap not used, off by default** | `_monitor_sites.js:70`, `AI_Extra_Requests.js:33`, `_ai_w2e3.js:89-94` | The searches the engines run, and our Google rank for them, are the most direct retrieval lever. They are reported but never become a target, a refresh section, a ladder rung or a page assignment. | S-M (consume `fanout_gap_json`; cost ~$0.002 per search with the SERP cache) |
| 5 | **No learning; did-it-work covers two action kinds** | `_ai_measure.js:288-297`, `AI_Metrics.js:709` | Earned media, submissions, readiness fixes, corrections and links are not treatments. Verdicts are never read back to weight the next choice. Treatment time is wrong for targets (gap 2). | M |
| 6 | **Earned media rarely reaches a publisher** | `Earned_Media.js:85,93-94`, `LB_Assemble.js:34`, `app/web/.../ai-growth.tsx:173-250` | The AI page offers Copy / mailto only. Through the Link Builder, `ai_source` has likelihood 0.35 and needs a mailbox plus approval. At most 3 drafts a week. Ranking ignores the question's value and how many lost questions a page feeds. | M |
| 7 | **Retrieval seen only on ChatGPT** | `_ai_answer_data.js:59-62` | Perplexity, Gemini, AI Mode and AI Overview give citations but no "read" set. Not-retrieved vs not-cited cannot be told apart there. A proxy (our rank on the fan-out searches, our URL in any answer's sources) is not built. | S-M |
| 8 | **Entity / brand-known work is check-only** | `Growth_Metrics.js:100-104,144`, `AI_Metrics.js:626` | Brand-known is site-wide and monthly. Wikidata is a lookup. No per-engine "does the model know the business" probe per topic, and no entity actions beyond a sentence (Organization sameAs, review-site profiles, consistent NAP). | M |
| 9 | **Readiness findings are never fixed** | `Growth_Metrics.js:112-143` | Key pages get scores and action lines. No refresh is queued from a readiness failure, except the decay action (an action line, not a target). | S (queue a refresh target) |
| 10 | **Target rows are owned by one writer** | `Growth_Plan.js:187-198` | Every run rewrites every existing target of the site. Any row a new algorithm adds is marked `skipped` the next week ("no longer lost"). This blocks a second writer (§6). | S (origin column + one guard) |
| 11 | **Fan-out and market scope** | `_ai_w2e3.js` (site market only), W2-E3 §10 | Fan-out searches are read only in the site's own market. Stale-market questions were fixed by focus, but the fan-out SERP is not per question market. | S |
| 12 | **The question set is measurement-driven, not opportunity-driven** | `_ai_focus.js` | The panel follows the client's focus. No step asks which NEW questions are cheapest to win (AI-answer database questions where we already rank on the fan-out searches). | M |
| 13 | **Bing / IndexNow outcome not linked to citations** | `Growth_Metrics.js:64-76` | The crawl is measured; citation after crawl is not. | S |

## 6. Blast radius (the new algorithm must be additive)

Owner rule: there are live users, and nothing else in production may break. Below, every building block a new AI-ranking algorithm would touch, and every other feature that shares it.

### 6.1 Kits (inlined at build time; a change ships into every consumer node)

| Kit | Inlined into (v5/code) | Other features that share it |
|---|---|---|
| `_ai_panel.js` (AIP) | AI_Plan, AI_Requests, AI_Metrics, AI_Report, AI_Vis_Rows, AI_Asking_State, AI_Chunk_Handoff, AI_Extra*, AI_Prompt_*, AI_Run_Resume, AI_Save_*, Pilot_Plan, Pulse_Plan, Prompt_Rows, Prompt_Jobs, Sentiment_Jobs | AI Visibility Tracker, AI Pulse, Repeat Pilot, Site Admin panel edits. **Cost formula mirrored in `app/shared/src/cost.ts` against golden cases**: any price change breaks app credits. |
| `_ai_focus.js` | AI_Metrics, AI_Plan, Prompt_Rows, Prompt_Jobs, Pulse_Plan | **App mirror `app/shared/src/ai-focus.generated.js` + parity test** (`ai_focus_app.py`); app panel warnings (`aiFocus.ts:26`). |
| `_ai_measure.js` (AVX) | AI_Metrics, Admin_Action, Pilot_Metrics, Sentiment_Jobs | impact_json, sov_json, ci_json, alert rules read by the app; Site Admin alert-rule validation. |
| `_ai_entities.js` | Parse_AI_Answers, AI_Metrics, AI_Plan, AI_Cache_Rows, Apply_Analysis, Analyst_Jobs, Prompt_Rows, Pulse_Plan, Pulse_Metrics, Pilot_Plan, AI_Extras | Every answer row of both trackers; `ai_brands:` cache read by Earned_Media. |
| `_ai_answer_data.js` | Parse_AI_Answers, AI_Metrics, AI_Report, Analyst_Jobs, Apply_Analysis, Prompt_Jobs | seo_ai_answers columns shown in the app drill-down. |
| `_ai_stats.js` | Parse_AI_Answers, AI_Metrics, Pulse_Metrics, Pilot_Metrics, Apply_Analysis, Sentiment_Jobs | Every rate and alert threshold (pulse alerts, gaps' MIN_Q_SAMPLES). |
| `_ai_w2e3.js` | AI_Extras, AI_Extra_Requests, AI_Plan, AI_Extras_State, AI_Prompt_State, AI_Report, AI_Vis_Rows | fanout_gap_json, demand, persona, imports; app panels. |
| `_fit_gate.js` (FITR) | 20 nodes incl. Cadence_Plan, Growth_Plan, AI_Plan, Pulse_Plan, Prompt_Rows, Ladder_Plan, Ladder_Pool, Rank_Keywords, Brief_Context, Content_QA, Build_Keyword_Strategy, Tracker_Plan, Site_Plan, Cycle_Plan, Assess_Response | **Keyword Check, ladders, page writer, rank tracker, cadence**; app mirror via `fit_gate_app.py`. Never change it for this work; call it. |
| `_site_model.js` (SM) | ~50 nodes across every workflow | Everything. Read-only use only. |
| `_monitor_sites.js` | AI_Plan, Pulse_Plan, Growth_Plan, BL_Plan, LB_Plan, Audit_Candidates, Pilot_Plan | Which sites run and their settings, for five workflows. Adding a settings field is safe; changing defaults is not. |
| `_outreach_kit.js` (OK) / `_drafts.js` | Earned_Media, LB_Assemble, LB_Draft_QA, LB_Page_Requests, LB_Second_Requests, Parse_Backlinks; DRAFTS also AI_Metrics, Growth_Metrics, Outreach_Jobs, Prospect_Rows | Link Builder, Backlink Monitor outreach. |
| `_serp_cache.js` (SC) | many paths | One SERP reading per search per day, shared by research, ladders, rank tracker and fan-out. Reuse it; do not fork it. |
| `_cycle.js` | Cycle dispatcher | Every scheduled job of every site; mirrored in `app/shared/src/cycles.ts` (harness CY1, build section 140). |

### 6.2 Data Tables

| Table | Writers | Readers | Shape-change risk |
|---|---|---|---|
| `seo_ai_targets` | Growth_Plan (rewrites ALL rows of a site each run, `Growth_Plan.js:187-198`), AI_Target_Marks / AI_Target_Settle (main workflow + Cadence) | Cadence_Plan:127, `_ai_measure.js:290`, `_page_watch.js:217`, app `data.ts`, `cadence.ts:786-845`, `ai-growth.tsx` TargetsPanel | **High.** `status` values (queued / writing / written / won / skipped / set_aside), `kind` (answer / refresh), `target_id` format `ait_<site>_<prompt_id>` and `page_type` are read by four features. Adding a column is safe; changing a value is not. |
| `seo_ai_visibility` (`gaps_json`, `pages_json`, `fanout_gap_json`, `impact_json`, ...) | AI_Vis_Rows, AI_Extras | Growth_Plan, AI_Report, Site Tracker (build_site_tracker.py), app `data.ts`, `ai-detail.ts`, `ai-compare.ts` | **High** for existing JSON keys; adding a new `*_json` column is safe. |
| `seo_ai_answers` | Parse_AI_Answers (weekly + pulse) | AI_Metrics, Growth_Plan, Earned_Media, app drill-down | Medium; 35-day retention (`build_monitors.py:476`) limits any learning window on raw answers (units_json in visibility rows is the long-term record). |
| `seo_ai_pages`, `seo_ai_growth` | Growth_Metrics | Growth_Plan, app `toGrowth` | Medium (app parses `submitted_json`, `earned_json`, `actions_json`, `targets_json`). |
| `seo_link_prospects` | Earned_Media (`ai_source`), Backlink Monitor, LB | LB_Assemble, app link building + AI page | **High.** Upsert key `(site_id, prospect_domain, type)` (`build_monitors.py:907`, Save Growth Prospects); `type` labels in `app/shared/src/outreach.ts:36` and `LB_Doc.js:15`; status values are app statuses. |
| `seo_content_log` | main workflow, Cadence, published mode | 7 builders (api, ladder_extras, index_coverage, monitors, site_tracker, v4) + app | **High.** `source` values `ai_answer` / `ai_refresh` drive the AI quota (`Cadence_Plan.js:424-425`), the app's "written this month" and impact. |
| `seo_monitors` | app Site Admin, Track my site | `_monitor_sites.js`, Cadence_Plan | Low for a NEW column (via `ladder_common.py` + `sync_tables.py`); defaults of existing columns must not change. |

### 6.3 Workflows and the dispatcher

- **AI Growth (`SEOagentAIGrow1`).**
  - Shared with nothing else, but its outputs feed the Cadence and the Link Builder in the same cycle, and the app.
  - It runs in the cycle and on demand, with `dry_run` support (`build_monitors.py` Any Bing Submit / Any IndexNow guards).
- **Cycle dispatcher.**
  - Adding a NEW job changes `JOBS` (`_cycle.js:29-36`) AND `app/shared/src/cycles.ts`, and with them the app's pipeline UI, autopilot rows, billing labels and SCHEDULED_STAGES (`app/shared/src/constants.ts:320,434-502`).
  - That is a shape change. Avoid it.
- **Content Cadence.**
  - Mirrored line for line in `app/server/src/services/cadence.ts`; CLAUDE.md requires `Cadence_Plan.js` and `cadence.ts` to change together.
  - Any new candidate source the cadence must write is a two-sided change.

### 6.4 Callbacks, report stages, app renderers

- **Stage `ai_growth`.** "Build Growth Callback" strips the table rows and sends the summary (`build_monitors.py`, Build Growth Callback).
  - Renderers: `app/web/src/components/reports/ReportView.tsx`, `meta.tsx`, `ReportSummaryLine.tsx`.
  - Labels: `app/shared/src/constants.ts:341`, `billing.ts:275`.
  - A NEW key in the payload is additive. Renaming or removing `targets`, `earned`, `actions` or `submitted` is a shape change.
- **Stage `ai_visibility`.**
  - The callback fields are built by `AIX.callbackFields` (`_ai_w2e3.js:316`) and parsed by `app/shared/src/ai-detail.ts:442-460`.
  - The same rule applies: add, never rename.
- **New stages.** A new callback stage needs app constants, billing labels, a renderer and delivery rules. Avoid it in the first release.

### 6.5 App recommendations and site tasks

- **Recommendations.** `ai:*` ids in `recommendations.ts:201-219, 375-394` are keyed strings. Users' dismissals and skips are stored against them, so renaming an id resurfaces a dismissed item.
- **Site tasks.**
  - Kinds `indexnow` and `ai_crawlers` (`siteTasks.ts:772-777`) are tied to recommendations.
  - A new kind (for example `ai:<cause>`) needs the shared task contract (`app/docs/SITE_TASKS.md`) and the daily check jobs.

### 6.6 Safest seams (recommendation)

1. **A new pure kit beside the old ones.**
   - Name it `v5/code/_ai_rank.js` (`AIR`): diagnosis per question, candidate actions, scores, expected lift, and a learning prior from past `impact_json`.
   - No node access, no network, no clock (`_cycle.js` pattern), so the harness can replay any week.
   - It CALLS FITR, SM, AVX, AAD and SC; it never edits them.
2. **One new node in AI Growth, on a side branch after `Growth Plan`.**
   - Name it `AI Rank Plan`.
   - It reads only what Growth Plan already loaded (`$('Load AI Answers')`, `$('Load AI Visibility')`, `$('Load AI Targets')`, the content log, query history), plus optional new loads.
   - Its output goes ONLY to a new table, `seo_ai_rank_plans`: one row per site x run with `diagnosis_json`, `candidates_json`, `chosen_json`, `would_do_json`, `mode` and the rule version.
   - The node is `onError: continueRegularOutput` and is linked so that `Growth Metrics` does not depend on it. Its own Save node reads exact columns (the Data Table upsert auto-maps every input field).
3. **A per-site gate.**
   - A new `seo_monitors.ai_rank_mode` column: `''` / `off` (default) | `shadow` | `on`.
   - Added in `ladder_common.py` MONITORS_COLS, applied with `sync_tables.py`, and read through `_monitor_sites.js` as a new settings field.
   - An empty value means off, so a deploy changes nothing for existing sites (the same rule `ai_focus_mode` and `ai_fanout_check` follow, `_monitor_sites.js:66-75`).
4. **Shadow mode first.**
   - In `shadow`, AIR computes and logs its diagnosis and choices at $0, from stored data only: answers, `retrieved_json`, `fanout_json`, `fanout_gap_json` when present, Search Console query history, the SERP cache.
   - It writes nothing that the cadence, the Link Builder or the app reads.
   - Each week it also logs what the OLD logic chose (Growth Plan's targets and earned list), so the two can be compared and later scored with AVX.impact on the old logic's real actions.
   - The harness gets a scenario that replays recorded weeks of techand.ai and devaicon.com through AIR.
5. **`on` mode reuses existing shapes.**
   - AIR's chosen targets are written INTO `seo_ai_targets` with the existing `status` / `kind` / `page_type` values and a NEW column `origin` (`growth` | `ai_rank`).
   - `Growth_Plan.js:187` gets one guard: rows with `origin = ai_rank` are left to AIR, which fixes gap 10. This is the only edit to old logic, and it is a no-op while no such rows exist.
   - Earned-media choices are written as `ai_source` prospect rows with the existing columns. The Cadence, the Link Builder and the app then work unchanged.
6. **Money.**
   - Any paid call AIR adds (for example fan-out SERP reads) goes through the run ledger reservation already on AI Growth's main path (`ladder_common.ledger_mainline`), with `_dfs_retry.js`, no node-level retry on paid nodes (`retry_lint.py`) and the SC cache.
   - Shadow mode should add no paid call at all.
7. **No new cycle job, no new callback stage, no new app recommendation id in the first release.** Shadow output is read through the n8n Data Table API by the team, or later by an admin-only app view.

**Spots where a change WOULD force a shape change** (avoid them, or plan both sides):
- `seo_ai_targets` `status` / `kind` / `target_id` values: Cadence_Plan, `cadence.ts`, AI_Target_Marks / Settle, `_ai_measure`, the app panel.
- `gaps_json` keys: Growth_Plan, AI_Report, the app.
- `seo_content_log.source` values: the AI quota, app counts, impact.
- `seo_link_prospects` `type` values and the upsert key: LB, app labels.
- `_cycle.js` JOBS order or members, which must match `app/shared/src/cycles.ts`.
- `AIP.cost`: app `cost.ts` golden cases and credits.
- `_ai_focus.js` rules: the app generated mirror and its parity test.
- `_fit_gate.js`: the app mirror and 20 engine nodes.
- The `ai_growth` / `ai_visibility` callback keys and the app renderers.
- Any default of an existing `seo_monitors` column.

## 7. Building blocks a new algorithm should sit on

- **Data already stored per answer** (`seo_ai_answers`):
  - mentioned, cited, rank, competitors and sources;
  - `cited_urls` / `cited_json`;
  - `retrieved_json` (ChatGPT);
  - `fanout_json`;
  - the answer text (35 days).
- **Long-term record.** Units in `seo_ai_visibility.units_json` (`AVX.packUnits`, `_ai_measure.js:308`), which `history()` reads over 60 days.
- **Kits:**
  - AIP (panel, cost);
  - AVF (focus);
  - AVX (prop / ci / sov / impact / bootstrap / rng / hash);
  - AIE (entities, roles);
  - AAD (answer data);
  - AIX (fan-out gap, `targetPage`, `gscOf`);
  - FITR (fit gate);
  - SM (site model, `siteUrl`, services, facts);
  - SC (one SERP reading per day);
  - `_reach.js` (difficulty the site can win);
  - `_change_test.js` (control-based change test);
  - `_impact.js` (impact weighting);
  - `_lineage.js` (every number says its basis);
  - `_gone.js` (dead URLs);
  - `_outreach_kit.js` (prospect gates, `pickTarget`);
  - `_drafts.js`;
  - `_ai_access_kit.js` (robots);
  - `_readiness.js`.
- **Tables to reuse:**
  - `seo_ai_targets` and `seo_link_prospects` (as action sinks);
  - `seo_query_history` (Search Console queries);
  - `seo_pages` (inventory, `http_status`);
  - `seo_cache` (keys `serp:`, `ai_brands:`, `indexnow:`);
  - `seo_run_ledger` (reservation and settle);
  - `seo_monitors` (per-site settings).
- **Cost guards:**
  - `dfs_budget_usd` / `ai_budget_usd` ($15 a day) and `dfs_balance_floor_usd`;
  - the run guard (`_run_guard.js`);
  - `_dfs_retry.js`;
  - task-id dedupe in settles.
- **Harness patterns:**
  - `harness/scenarios_v5.js` with `run('Node', input, { code: ... })` over `harness/code_v4/`;
  - fixtures from recorded executions (`fixtures*.js`, `.json.gz`);
  - pure kits tested directly (`ai_panel_cases.js`);
  - contract JSONs shared with the app (`cycles_contract.json`, `ai_panel_cost_cases.json`).
- **Lints that must keep passing:**
  - `gate_lint.py`: every read of stored rungs is gated;
  - `lineage_lint.py`: every number carries its basis;
  - `retry_lint.py`: one retry rule; no node retry on paid nodes;
  - `state_lint.py`: every `writing` state has a way back;
  - `url_lint.py`: no `'https://' + domain`.

## 8. Constraints (CLAUDE.md and memory)

- **n8n Code sandbox:**
  - no `URL` constructor: parse hosts with a regex, as `Growth_Plan.js:33-35` does;
  - `Object.defineProperty` / `defineProperties` / `setPrototypeOf` are no-ops and there is no `structuredClone` (this crashed production AI visibility on 2026-10-25); the harness mimics this;
  - no `$env`;
  - an inline `//` comment swallows the rest of a one-line edit.
- **Data Table columns.** Add them in `ladder_common.py`, rebuild, then `sync_tables.py`. Ensure nodes never add a column to an existing table.
  - Upsert and insert nodes auto-map every input field, so feed exact columns.
  - Create nodes output the table object, so read upstream nodes explicitly afterwards.
  - The 1 GiB Data Table cap is unchecked.
- **Generated workflows.** `workflows/*.json` are generated; never hand-edit them.
  - Edit `v5/code` and `v5/prompts`, wire in `build_monitors.py` / `build_v4.py`, run `python3 build_v4.py` and check the exit code (anchored patches assert).
  - The build refuses a missing `n8n/.env` (worktrees).
- **Harness.** It must end with `0 failed`. Run it in a fresh copy chowned to `node`, in a throwaway n8n container (the laptop n8n stays stopped).
- **n8n behaviour:**
  - Sub-workflows called by Execute Workflow must be published.
  - An AI Agent node outputs only `{output}`, so read context with `$('Node').first().json`.
  - HTTP text responses arrive in `data`, not `body`.
- **Deploy rules:**
  - merge origin/main and node-diff production before `deploy_engine.py --apply`;
  - not on a Monday between 07:00 and 12:00 New York (`apply_env.py` refuses);
  - every n8n restart drops a due fire;
  - backup before an API deploy;
  - the web goes through a PR, and merging needs the owner.
- **Marketing and tutorials.** A customer-facing change also needs the marketing capability and changelog entries and a row in `TUTORIALS_BACKLOG.md`. No filming during the revamp.
- **Shadow mode avoids both.** Nothing customer-facing changes until `on` is offered.
