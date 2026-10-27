# AI question panel that follows the client's focus: research and design (2026-10-27)

Owner's question (2026-10-27): devaicon.com (country Pakistan) typed "open edx provider" as its one tracked keyword during onboarding
(2026-10-23) and never pursued it. Its pipeline is a keyword ladder about AI automation ("ai automation solutions gcc"; page "ai in
industrial automation" published). Its AI visibility panel (10 questions, written on the setup-day cycle 2026-10-25, before the ladder
existed) is entirely about Open edX in the UAE, and the daily AI Pulse asks those questions every day. Why, should the panel follow the
ladders, and what is the best correction?

Scope: read-only on code and production. `file:line` is at HEAD `6bfb6470` (2026-10-27). Production facts come from the owner's
message and `docs/ai-visibility-2026-10-23/PROD_STATE.md`; nothing was read from production for this report (a read-only query to
confirm is given in section 6.1).

---

## 1. Summary and recommendation

**Why it happened (four causes, all in code, not a one-off accident).**

1. **The panel is written once from whatever the "topics" are on the day it is written, and a full panel is never revisited.** Topics are
   on-demand topics + ladder head terms + tracked keywords + rung keywords (`v5/code/AI_Plan.js:147`). On 2026-10-25 devaicon had no
   ladder, so the only topic was its tracked keyword "open edx provider". The Prompt Writer is started only when the panel has 2 or more
   free slots (`AI_Plan.js:156-160`); after the first write the 10-slot panel was full, so the AI-automation ladder that came later
   added a topic that no writer job ever saw.
2. **Nothing ever retires a question because the client's focus moved.** The read-path gate (FITR) that runs over stored questions is
   built with no `topics` (`_ai_panel.js:352-354` `fitInput` has heads, services, keywords as *protected* words only;
   `_fit_gate.js:632` sets `topics: null` when none are passed), so its off-topic rule never fires ("no topics on file, so topic distance
   was not judged", `_fit_gate.js:285`). Worse, the tracked keyword itself is *protected* (`_fit_gate.js:627`). Deleting a ladder
   deletes its `seo_ladders` rows (`app/server/src/services/ladderSettings.ts:255-259`) but no question; a paused ladder still counts as
   a topic because the AI workflow never loads `seo_ladder_settings` (`AI_Plan.js:82` takes every ladder row of the domain).
3. **The declared services are not a topic source.** `SM.services(site_model)` goes only into the gate's protected words
   (`AI_Plan.js:131`) and the analyst's fact sheet (`AI_Plan.js:274`), never into `topics` (`AI_Plan.js:147`). So the one keyword typed
   during onboarding outweighed everything the client said it sells.
4. **The market came from the engine's own row, not the website's country.** The writer is told the market of
   `seo_sites.location_code` (`AI_Plan.js:161`, `Prompt_Jobs.js:56`); the mismatch audit (M1/M2, `docs/mismatch-audit-2026-10-27/AUDIT.md`
   lines 167-181) shows devaicon's engine row says UAE while the app says Pakistan. Stored questions also keep their own market and add it
   to the run's markets (`AI_Plan.js:163`), so even after the country is corrected, the old UAE questions would go on being asked in the
   UAE.

And the cost: panels under 50 questions are asked **in full every pulse morning** (`_ai_panel.js:169`), so at devaicon's 10 questions
the pulse is 9 questions x 3 engines x 6 mornings a week: **$2.81 of its $5.35 a month** provider cost (169 of 321 credits at 60 credits
per dollar, `app/shared/src/billing.ts:74`), all of it on a topic it does not work on. The page it did publish ("ai in industrial
automation") had no AI question about it before or after publication, so the did-it-work measurement (`_ai_measure.js:156-194`,
treated vs control questions) can never say whether that page moved AI visibility.

**Should the panel follow the ladders? Yes, but not only the ladders.** Every leading tool structures prompts by **topics** the
customer chooses and derives prompts from the customer's **SEO keywords** (Profound: "Start with your existing SEO key phrases",
Scrunch "Convert SEO Keywords", Otterly keyword-to-prompt, Conductor topics from the customer's keyword data; section 3). None of them
documents how it keeps trends honest when prompts change; they all tell you to **archive, not delete** (Peec, Athena) and Adobe warns
that changing categories resets history. Our "no delta across different panels" rule is already ahead; what is missing is the
**follow-the-focus loop**, plus a comparability rule that survives it.

**Recommendation (one design, deterministic, cost-aware).**

- **A focus model** (new kit `_ai_focus.js`, mirrored in `app/shared`): the panel's topics are the client's chosen focus, weighted:
  active ladders (3), recently written / published pages' keywords (2), declared services (1, the stable core), tracked keywords (1, or
  0.5 "watch only" when they have had no ladder, no page and no Search Console impressions for 28 days), always in the **website's**
  market and language (from the app's country, never the engine row). Brand question: 1, fixed.
- **Quotas** per topic by largest remainder, minimum 2 questions a topic (so each topic is a readable segment), a stable core of at
  least 30% (brand + services) that is never retired automatically, and the owner's own and pinned questions untouched.
- **Reconcile every weekly run's first part** (pure diff, no paid call): topics without their quota get *proposed* questions written
  (Claude only, no DataForSEO); questions of topics that left focus are *retired* (a new status, history kept, never re-written). A new
  ladder adds its questions **in the week it starts**, so the page has a "before" baseline for did-it-work; retirements wait for the
  month boundary (the full run) and a 28-day grace period, so baselines reset at most once a month.
- **Who decides.** A swap inside the panel size the client already pays for, for a ladder the **client chose**, is applied
  automatically at every autopilot level and announced (report + "Coming up"), because it costs nothing extra and follows the client's
  own choice. Anything that **raises the monthly cost** (a bigger panel), touches **the owner's own questions**, or comes from a
  **system-announced** ladder (level 3) is a Needs-you item with Accept / Not now. This fits the keyword-first rule
  (`app/shared/src/cycles.ts:35-38`).
- **Pulse follows focus too.** New setting `ai_pulse_scope` = `focus` (default for new sites): the daily pulse asks only the questions
  of active ladder topics and pinned questions; the core and watch topics are measured weekly. Conductor sets cadence per topic for the
  same reason (a monthly topic costs about a quarter of a weekly one).
- **Comparability that survives focus changes.** Keep the 80% whole-panel rule for the headline, but add (a) a **matched-panel delta**
  on the questions asked in both weeks, always shown with its question count, and (b) **per-topic comparability**: a topic's segment is
  compared whenever *its own* questions overlap 80%, even when another topic was added. Today any swap above 20% switches off every
  segment test (`AI_Metrics.js:444,452`).
- **Warnings** go through the consistency mechanism being built for the mismatch audit (one `Warning` with Accept / Continue anyway),
  with two new codes `ai.panel_off_focus` and `ai.ladder_not_measured`; the market side stays with M7 (`ai.question_place`,
  `ai.market_drift`) and reuses its gazetteer, not a second one.

**One-off correction for devaicon.com** (section 6): first settle its market (M5: its business text says UAE / GCC, its country is
Pakistan; its ladder says GCC). With the owner's stated answer (Pakistan, AI automation only): retire the 9 Open edX questions (keep
their history), remove or demote the tracked keyword "open edx provider", correct the engine row's market (M2), and write 9 questions
on AI automation in Pakistan (7 on the ladder topic and its published page, 2 on a declared core service) + the brand question; pulse
scope focus. Provider cost: **$4.72 a month (283 credits)** against $5.35 (321) today, or $2.54 (152) with the pulse off. devaicon has
almost no history, so the new baseline costs nothing.

---

## 2. Evidence: how the panel is built and kept today

### 2.1 Sources of a question

| Source | Where it enters | What it is used for | Evidence |
|---|---|---|---|
| On-demand `topics` ("Main services or products" on the form / API) | `asked` | first in `topics` | `AI_Plan.js:83,147` |
| Ladder head terms and rung keywords (all ladder rows of the domain, any status) | `lrowsAll` -> FITR -> `lrows` | `topics` (heads, then rungs except rung 4); also protected words of the gate | `AI_Plan.js:82,131-134,147` |
| Tracked keywords (`seo_sites.keywords`, written by a `track` run) | `s.keywords` | `topics`; protected words | `_monitor_sites.js:38`, `Site_Row_Track.js:17`, `AI_Plan.js:131,147` |
| Declared services (site model) | `SM.services(site_model)` | protected words of the gate and the analyst's fact sheet only, **not a topic** | `AI_Plan.js:131,274` |
| Homepage text | `Site Text Jobs` / `Read Site (AI)` | given to the writer as context ("to understand what the business sells") | `Prompt_Jobs.js:14-15,58`, `ai_prompts.txt:9` |
| Competitors' homepages | `offersOf` | "topic ideas only" for the writer | `Prompt_Jobs.js:17-18` |
| AI-answer database questions (LLM Mentions `search_mentions`) | `Discovery Requests` | real questions for the writer, **first 2 topics only** (4 when 100+ questions are needed); ChatGPT data only for US-English | `Discovery_Requests.js:9,14-18` |
| People Also Ask | `Discovery Requests` kind `paa` | only when 10+ questions are needed, first 6 topics | `Discovery_Requests.js:21-24` |
| Search Console long / question-shaped queries | `gsc_questions` | writer context | `AI_Plan.js:174-175` |
| Owner's own questions (add, CSV, edit, pin) | Site Admin `ai_prompts` | stored `source: custom`, asked first | `Admin_Action.js:25-36`, `web/.../ai-panel.tsx:5-7,449-491` |
| Template fallback (writer failed) | `Prompt_Rows.js:62-66` | 2 questions per topic, "in <city or country>" | |

The writer itself (`v5/prompts/ai_prompts.txt`) gets `topics`, `clusters`, `country`, `city`, `language`, persona and the context above,
and is told to write "every question about something this business sells" (`ai_prompts.txt:27`). It cannot know that the business does
not care about a topic it was handed as the only topic.

### 2.2 Lifecycle

| Event | What happens to the panel today | Evidence |
|---|---|---|
| First weekly run (setup-day cycle) | Writer jobs for `prompts_max` questions (cells market x persona), deduplicated, fit-gated, stored `active` | `AI_Plan.js:156-160`, `Prompt_Jobs.js:38-64`, `Prompt_Rows.js:48-94` |
| Later weekly runs | Writer only when `deficit >= 2` (the panel lost 2+ questions); otherwise the stored questions are asked unchanged ("stable week to week so the trend means something") | `AI_Plan.js:2,156-160` |
| A ladder starts | Its head and rungs join `topics`; nothing else. No question is written unless the panel has 2+ free slots | `AI_Plan.js:147,160` |
| A ladder is deleted | `seo_ladders` rows deleted; its questions stay active and keep being asked weekly and every pulse morning | `ladderSettings.ts:255-259`; no prompt write on that path |
| A ladder is paused / won | Still a topic (ladder settings are not loaded by the AI workflow) | `AI_Plan.js:82`; `build_monitors.py` loads no `seo_ladder_settings` |
| A tracked keyword changes | It joins / leaves `topics` and the gate's protected words; stored questions unchanged | `AI_Plan.js:131,147` |
| The website's country changes | App country is not re-sent to the engine (M2); the engine keeps measuring in the old market. Even after a re-sync, every stored question keeps its `market` and that market is added to `markets`, so old-market questions keep being asked in the old market | `AI_Plan.js:161-164,168`; AUDIT.md M1/M2 |
| The owner switches a question off | Status `off`; the next run sees a deficit and writes replacements on the current topics; an `off` or `refused` question is never re-written | `AI_Plan.js:50,121`, `Prompt_Rows.js:82-85` |
| The owner deletes a question | Tombstone; not re-suggested | `app/server/src/services/aiWave2.ts:294-302`, `ai-panel.tsx:345` |
| A question names another vendor / government service / the site itself | Refused at write time (stored `refused` with the reason) and on the read path | `Prompt_Rows.js:70-91`, `AI_Plan.js:139-145`, `Pulse_Plan.js:65-76` |
| A question is off the client's focus | **Nothing.** The read-path gate has no topics (see 1.2) | `_ai_panel.js:352-354`, `_fit_gate.js:285,632` |

### 2.3 The panel-changed rule (comparability)

- A week is compared with the previous one only when, in order: same measurement rule, same engines, same pulse engines and mode, and
  **80% of the previous week's question ids are still asked** (`AI_Metrics.js:419-445`, `_ai_panel.js:358-361`). Otherwise "Not
  compared ... a different panel, not a different result" (`AI_Metrics.js:444-447`).
- Segment (cluster / persona / market / stage) changes are tested **only when the whole panel is comparable** (`AI_Metrics.js:449-452`),
  and engine changes the same (`:543-550`).
- Consequence for a follow-the-focus loop: adding a 4-question ladder topic to a 10-question panel already breaks the 80% bar for the
  whole week, including topics whose questions did not change. This rule must be refined before the panel is allowed to move (section 4.6).

### 2.4 What decided devaicon's 10 questions

On 2026-10-25 (setup-day cycle, first run, no ladder):
- `topics = ['open edx provider']` (the tracked keyword; `AI_Plan.js:147`). No ladder rows, no on-demand topics.
- `need = 10` (panel size 10 from `seo_monitors.ai_prompts_max`, PROD_STATE.md line 63; `AI_Plan.js:156-160`).
- Market: the engine row's `location_code` (`AI_Plan.js:161`), which for devaicon is the UAE (AUDIT.md M1 "Why devaicon got the UAE";
  `city` from the profile when the own market, `Prompt_Jobs.js:56`). The writer's rule "the market named where the buyer would name it"
  (`ai_prompts.txt:27`) produced "in the UAE", "in Dubai and Abu Dhabi". The homepage text (which also mentions UAE / GCC, AUDIT.md M5)
  pushed the same way.
- Discovery and PAA, if run, searched "open edx provider" only (`Discovery_Requests.js:15,24`).
- One persona cell (no personas, panel <= 50, `Prompt_Jobs.js:41`): 1 brand + 9 Open edX questions.

After 2026-10-25 the ladder "ai automation solutions gcc" added its head and rungs to `topics`, but `deficit = 0`, so no writer job ran,
and the gate has no topics to judge the Open edX questions against. The panel will ask Open edX in the UAE for ever unless a person
switches the questions off. Even then the replacement batch would be written for `topics` that still contain "open edx provider" (the
tracked keyword) next to the ladder, and in the engine row's market.

### 2.5 The app side

- AI visibility page: the PanelManager (filters, add, CSV, edit, switch off / on, pin, bulk delete, suggestions from the AI-answer
  database) `app/web/src/pages/site/_components/ai-panel.tsx:5-7,156-373`. There is no view by "which of my ladders / services this
  question measures" and no notice when the panel and the pipeline disagree.
- Monitors settings: `aiMarkets` checked by format only (`MonitorSettingsFields.tsx:162`, AUDIT.md M7); panel size 3-500
  (`shared/src/schemas.ts:102`).
- Onboarding: the Launch step lists keywords and the AI line "on, N questions, engines, daily pulse"
  (`app/web/src/pages/onboarding/_components/LaunchStep.tsx:248-264`); it says nothing about what the questions will be about.
- Needs-you kinds today: `publish | approve | overlap | duplicate | failed | connection | pileup | keyword | proposal | recheck | level |
  profile` (`app/shared/src/data.ts:1343-1356`); none for the AI panel.
- Autopilot levels: 1 "Only my keywords", 2 "My keywords and keep my pages healthy", 3 "Full autopilot" (`app/shared/src/cycles.ts:33-38`).

### 2.6 Cost model (engine formula `AIP.cost`, `_ai_panel.js:435-466`, run in `node:22` on 2026-10-27)

Default engines (ChatGPT, Perplexity, Gemini, Claude monthly, AI Overview, AI Mode); pulse engines ChatGPT + Gemini + AI Mode ($0.012 a
question a morning); 6 pulse mornings a week, 4.33 weeks a month. Credits = provider cost x 60.

| Panel | Pulse | Weekly run | Full-run extra | Pulse a month | **Month** | Credits | Headline +/- (95%) |
|---|---|---|---|---|---|---|---|
| 8 | full | $0.29 | $0.97 | $2.18 | **$4.41** | 265 | 7.6 pts |
| 10 (devaicon today) | full | $0.35 | $1.02 | $2.81 | **$5.35** | 321 | 6.7 pts |
| 10 | off | $0.35 | $1.02 | $0 | **$2.54** | 152 | 14.0 pts |
| 10 | sample, 2 mornings a week | $0.35 | $1.02 | $0.94 | **$3.48** | 209 | 9.7 pts |
| 10 | focus scope, 7 questions | $0.35 | $1.02 | $2.18 | **$4.72** | 283 | about 7 pts on the focus topic |
| 12 (techand.ai) | full | $0.39 | $1.07 | $3.43 | **$6.19** | 371 | 6.1 pts |
| 20 | full | $0.57 | $1.27 | $5.92 | **$9.66** | 580 | 4.7 pts |

The pulse is half or more of a small panel's cost, and it is spent on whatever the panel happens to contain.

---

## 3. Research: how the leaders pick and maintain prompts (October 2026, sources opened 2026-10-27)

Earlier R&D in `docs/ai-visibility-2026-10-23/MARKET_RND.md` (rows 2, 5, 14) covered panel size, statistics and prompt volume. This
pass looked only at **how prompts are chosen, grouped, refreshed, and kept comparable**.

| Vendor | How prompts are chosen | Structure | Refresh | When prompts change | Kind of evidence |
|---|---|---|---|---|---|
| **Profound** | "Start with your existing SEO key phrases, then rephrase them into natural, question-style prompts"; validate with Prompt Volumes; "Prioritize those with high AI conversation volume and actionable intent" [P1]. Manual, CSV or prompt builder [P2] | Topics and tags "by intent, funnel stage, or campaign"; personas per category, each persona runs as a separate prompt [P2][P3] | "Revisit every month: user phrasing evolves" [P1] | Removing a persona hides its data [P3]; prompts run daily "to build a consistent, comparable dataset" [P2]; no method for changed sets | Docs (vendor) |
| **Peec AI** | Guided discovery from the profile (what you sell, personas, 200 characters of context), markets, reviewed topics and a distribution; **suggestions are inactive until accepted**; defaults 20% branded, 25/50/25 intent split [E1] | "Start with 3 to 5 broad areas"; each prompt one topic; optional tags; a location per prompt [E1] | Not stated; runs daily [E1] | **Archive** keeps history, **delete** "erase[s] all historical data" [E1] | Docs (vendor) |
| **AthenaHQ** | Starter prompts from website, brand description, industry; Discover from website, Search Console, social, keyword gaps, competitors [A1] | Topics = "content pillars or product areas"; branded / non-branded label; tags across topics; "Aim for 50-100 prompts to start" [A1] | Schedules weekly (1-4 weeks) or set days; Enterprise: schedules per prompt subset [A1] | **Wording locked once a prompt has data**: "pause the prompt and create a new one"; paused prompts keep history [A1] | Docs (vendor) |
| **Conductor** | Topics suggested from "LLM models with your existing keyword data", or own; prompts generated per topic from chosen intents and personas; 5-500 prompts per topic; custom instructions ("Focus 100% on B2B topics") [C1][C2] | Topics; 10-15 business-critical categories; personas set up first ("no way to programmatically categorize prompts retroactively") [C2] | **Daily, Weekly or Monthly per topic**; "A monthly-tracked topic costs about a quarter of the equivalent weekly topic" [C2] | Not addressed [C2] | Docs (vendor) |
| **Adobe Brand Visibility (Semrush Enterprise AIO)** | Topics from business priorities; prompt sources: on-site search, FAQs, Search Console regex, LLM chatbots, Adobe's Industry Prompt Library [D1] | "A short, flat list (6-12 maximum)", intent-based, **not** brand / geographic topics (those are filters) [D1] | "Review and update prompts regularly", no frequency [D1] | "Changes to categories reset historical data" [D1] | Docs (vendor) |
| **Semrush AI Visibility Toolkit** | Manual, file import, or prompt suggestions; Prompt Research sends prompts to tracking [S1][S2] | Tags "by brand, location, or intent"; location + language per campaign [S1] | Daily [S2] | Not stated [S1] | Docs + blog (vendor) |
| **Scrunch** (Sitecore) | "Begin with the questions your customers actually ask"; **Convert SEO Keywords** turns tracked organic terms into prompts; generated prompts "fill gaps after your intentional and SEO-derived prompts" [R1] | 6-12 key topics, prompts auto-assigned; tags; personas from the website [R1][R2] | Monthly: new topics from AI Search Trends; quarterly: launches, campaigns, competitor moves; ongoing: "Archive prompts that no longer matter" [R1] | "Prompts cannot be edited directly" (archive and recreate) [R1] | Docs (vendor) |
| **Ahrefs Brand Radar (custom prompts)** | "You pick the exact questions your buyers ask"; AI generation "from competitor comparisons, pricing data, and other signals" [H1][H2] | Location per report; per-tool frequency [H1] | Daily, weekly or monthly per AI tool [H1] | Not stated | Docs + marketing |
| **Otterly** | Prompt research tool turns SEO keywords into prompts in several languages, or topics from a URL [O1] | Tags, prompts monitored as topics [O2] | Not stated | Not stated | Help center (vendor) |

**What is evidence and what is marketing.** Everything above is the vendors' own documentation of their product, which is reliable for
*what the product does* and says nothing about *whether it works better*. No vendor publishes a method for comparing trends when the
prompt set changes; Adobe's "categories reset historical data" and the universal "archive, do not delete" are the only statements, and
both are product behaviour, not method. Dataset sizes conflict between a vendor's own pages (Profound 1.3B+ vs a third party's 400M+;
Ahrefs 246M+ vs 492M), so treat them as marketing. The independent evidence that matters for us is statistical and already in
MARKET_RND §6: answers vary run to run, so a segment needs repeated samples, which is why a topic needs at least 2 questions and a
pulse.

**What the market converged on, and what we take from it.**

1. **Topics first, prompts inside topics.** 3-5 (Peec), 6-12 (Adobe, Scrunch), 10-15 (Conductor). For our panel sizes (8-20) that means
   2-5 topics.
2. **Prompts come from the customer's SEO keywords and what it sells**, then real-question data fills gaps (Profound, Scrunch,
   Conductor, Otterly). Our ladders are exactly "the SEO keywords the customer chose".
3. **Suggestions are not live until accepted** (Peec), or are generated under customer instructions (Conductor).
4. **Archive, never delete; wording locked once it has data** (Athena, Scrunch, Peec). We already keep wording (`Prompt_Rows.js:3`);
   we need an "archived / retired" state that is not the owner's "off".
5. **Cadence per topic** (Conductor, Ahrefs per tool): the daily sample belongs on what is moving.
6. **Review monthly** (Profound, Scrunch). Our reconcile runs weekly but applies retirements monthly.

Where we can lead: nobody ties the prompt set to the *pipeline state* (ladder started / page published / ladder dropped) or protects
comparability when the set moves. Both are in reach with data we already hold.

---

## 4. Design

### 4.1 Principles

- The panel measures **what the client has chosen to win**, in **the client's market**, plus a small stable core (brand + declared
  services) that never moves on its own.
- **Deterministic first**: focus, quotas, retire and propose are pure functions over stored rows; Claude only writes the wording of new
  questions inside a topic it is handed (one topic per job).
- **Never pay for a change the client did not choose**: a swap inside the paid panel size for a client-chosen ladder is automatic; any
  growth in cost is a proposal.
- **Never break a trend silently**: every change is dated, named and measured with matched-panel and per-topic deltas.

### 4.2 The focus model (new kit `v5/code/_ai_focus.js`, `AIF`; mirror `app/shared/src/ai-focus.ts`, parity-tested like the fit gate)

`AIF.focusOf({ ladders, ladderSettings, contentLog, keywords, services, gscQueries, siteMarket, now })` returns topics:

| Source | Weight | State | Rule |
|---|---|---|---|
| Ladder, status active / writing / climbing / queued (from `seo_ladder_settings`; `chosen_by` client) | 3 | `active` | topic phrase = head keyword with place words of the site's own market kept and **other markets' place words removed** (gazetteer of AUDIT.md §2.4); rung keywords become sub-intents the writer may use |
| Ladder chosen by the system (level 3 announcement) | 3 | `active`, `proposed_by: system` | same, but its questions are proposals (4.4) |
| Ladder paused | 1 | `paused` | questions kept, weekly only, not in the pulse; retired after 56 days paused |
| Ladder won | 1 | `maintain` | 2 questions kept as a watch on the won position |
| Page written / published in the last 180 days (`seo_content_log` written or published; already loaded as `Load Content Log (AI)`, `build_monitors.py:391`) whose keyword is not a ladder head | 2 | `active` | merged into the ladder topic when `fitEvidence` says it is the same subject (devaicon's "ai in industrial automation" joins "ai automation solutions") |
| Declared service (site model `declared_services`, never the crawl's guesses) | 1 | `core` | top 2 services by Search Console impressions of matching queries, else declared order |
| Tracked keyword with a ladder, page or impressions | 1 | `active` | |
| Tracked keyword with no ladder, no page and no Search Console impressions for 28 days, while another topic is active | 0.5 | `watch` | weekly only, at most 1 question; retire-proposal after 56 days |
| Tracked keyword the fit gate refuses, or `fitEvidence` against declared services says `out` | 0 | `out` | not a topic; an `ai.panel_off_focus` warning names it |

Topics are merged when `AIF.sameTopic(a, b)` (content-word stem Jaccard >= 0.5 after place words and generic words are removed, reusing
`AIP.stems` and `fitTopicWords`), so "ai automation solutions gcc" and "ai automation solutions" are one topic.

### 4.3 Quotas

`AIF.quotas(N, topics, stored)` where N = panel size:
1. 1 brand question (fixed).
2. The owner's own and pinned questions keep their places (they are asked first today, `AI_Plan.js:141-146`); they count toward the topic
   they match, else toward "owner".
3. Core: `ceil(0.3 x (N - 1))` for `core` topics (at least 2 when N >= 8), never retired automatically.
4. The rest by weight, largest remainder, minimum 2 per `active` topic, at most `floor((N-1)/2)` topics so each is a readable segment;
   `watch` gets at most 1.
5. A topic that cannot get 2 questions (too many topics for the panel) is listed as "not measured: raise the panel size to N+2"
   (a proposal with its price, 4.4).

For devaicon (N = 10): brand 1; core 3 -> 2 after the ladder topic's minimum; ladder topic "ai automation solutions" (+ its page
"ai in industrial automation") 7; Open edX 0 (`out` or `watch`, depending on the owner's answer).

### 4.4 Reconcile, propose, retire, and who decides

Every weekly run's **first part** (`AI_Plan.js`, where `need` is computed today) calls `AIF.reconcile(stored, focus, quotas, now)`:

- `keep`: questions of in-focus topics up to quota.
- `propose`: `{ topic, count, reason }` for topics under quota. The writer writes these in the same run (Claude only, about $0.02-0.05
  a job, no DataForSEO). They are stored with `focus_topic` and status `active` or `proposed` per the table below.
- `retire`: auto-written questions of topics that left focus (ladder deleted, paused > 56 days, tracked keyword removed, `out`), or
  over quota. Applied only on the **monthly full run**, and only after the topic has been out of focus 28 days (hysteresis), except a
  deleted ladder whose questions retire at the next full run. Retired = new status `retired` with `retired_at` and `retire_reason`;
  answers and history stay; `Prompt_Rows.js:84` already never re-writes a stored question in any status.
- A question that is the **target of a did-it-work action** (`seo_ai_targets` or a published page in the last 56 days) is never retired
  before its after-window closes (`_ai_measure.js:156-194` needs both sides).

Who decides:

| Change | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| Add questions for a **client-chosen** ladder inside the current panel size (swap out over-quota auto questions) | automatic, announced | automatic, announced | automatic, announced |
| Retire auto questions of a topic the client left (ladder deleted / paused long, keyword removed) | automatic at month end, announced | same | same |
| Add questions for a **system-announced** ladder | not applicable | not applicable | automatic with the ladder's 2-day announcement (same skip) |
| Anything that **raises the monthly cost** (panel size up, a topic that does not fit) | Needs-you proposal with credits a month | same | same |
| Touch an **owner's own or pinned** question | never automatic; Needs-you "This question is about X, which you no longer work on: switch it off?" | same | same |
| Market rewrite of stored questions (the site's country changed) | Needs-you proposal (M7 `ai.market_drift` Accept); old-market questions retire, new ones written | same | same |

"Announced" = a line in the weekly AI report and in the Pipeline's "Coming up" ("Your AI questions now follow your keyword 'ai automation
solutions': 7 questions added, 9 about 'open edx provider' retired. Trends restart for these topics."), plus an audit row. Customer copy
follows the no-AI-tells rule (no em dashes, no curly quotes).

New Needs-you kind `ai_panel` (`app/shared/src/data.ts:1348`, guide in `GUIDE_FOR_NEEDS_YOU_KIND`, `guide-links.ts:10-24`): proposals with
**Accept** (Site Admin `ai_prompts` enable / retire ids, or a `monitors` size change) and **Not now** (acknowledged with the proposal's id
so it does not return until the focus changes).

### 4.5 Market and language

- The panel's own market comes from the **app's website country** (sent with every monitor run, or re-synced to the engine row by M2's
  fix), never from a stale engine row. `AI_Plan.js:161` keeps reading the engine row only after M2 guarantees it equals the app.
- A stored question whose `market` is not the own market and not one of the owner's `ai_markets` is **not** added to `markets`
  (change `AI_Plan.js:163`); it is proposed for retirement with `ai.market_drift`.
- Writer output is checked with the M7 gazetteer (`placesIn`, AUDIT.md §2.4): a question that names a place outside its market is
  refused at write time (`fit_note` "names Dubai, outside Pakistan"). Engine side: `_markets.js` generated from `shared/src/markets.ts`
  (one table, parity test, like `fit-gate.ts`). This is M7's rule `ai.question_place` applied to the writer; M7 owns the rule and the
  warning text, this design only calls it.
- Writer prompt: "Name only places in <country> (cities: <top 3>) where a buyer would name a place; never another country."

### 4.6 Comparability that survives a moving focus

Keep (existing): same rule version, same engines, same pulse composition, and the headline only when 80% of the previous ids remain
(`AI_Metrics.js:429-445`).

Add:
1. **Matched-panel delta** (`AIP.matched(nowAnswers, prevAnswers)`): named / cited rate change computed only on questions asked in both
   weeks, paired, with its question count and answer counts, tested with the existing two-proportion z-test; shown when at least 6
   common questions and 12 answers on each side, labelled "on the 7 questions asked both weeks". This is always available after a
   focus swap except a full rewrite.
2. **Per-topic comparability**: `AI_Metrics.js:452` tests a segment when *its own* question ids overlap 80% between the two weeks
   (store the ids per cluster in `segments_json`), not only when the whole panel does. A new topic starts its own baseline; an untouched
   topic keeps its trend.
3. **Panel events**: `panel_json.events = [{ at, added: {topic, n}, retired: {topic, n}, reason }]`; the report and the trend chart mark
   them (Adobe's "categories reset history" made visible instead of silent).
4. Batching: additions any week (a new ladder needs a "before" baseline), retirements once a month on the full run, so a headline
   baseline resets at most once a month plus once per new ladder.

### 4.7 Pulse cost

- New monitors column `ai_pulse_scope`: `focus` (default for sites created after the release) | `all` (default for existing sites, so a
  release never changes what an existing site measures or pays, the rule `_monitor_sites.js:20-23` already follows).
- `focus` = questions of `active` ladder topics + pinned questions. Core and watch topics are measured by the weekly run only.
- `Pulse_Plan.js:65-97`: filter `storedQ` by `focus_topic` state before `pulseSample`; `AIP.cost` takes `pulse_questions` (the scope's
  count) so the app's quote (`estimateAiPanelCost`, golden cases `v5/data/ai_panel_cost_cases.json`) and the engine stay one formula.
- The pulse composition is already part of comparability (`AI_Metrics.js:436-442`), so switching scope starts a pulse baseline and says
  so.

### 4.8 Setup day (before any ladder)

The first panel should not be built from one onboarding keyword. On the setup day: brand + declared services (core) + tracked keywords
that `fitEvidence` places `in` the declared services; size the first write to the panel but mark everything except brand + core as
`provisional`, which the reconcile replaces at the first ladder without waiting for the month boundary (no trend exists yet). For
devaicon this would have produced AI-automation questions (if its declared services say so) and at most one Open edX watch question.

### 4.9 Tie-in with the mismatch mechanism (AUDIT.md §2)

- Producer `aiPanelWarnings(ctx)` inside `consistencyWarnings` (`app/shared/src/consistency.ts`, proposed there), using the same
  `Warning` shape, ids `<code>:<subject>`, Accept as a `{ kind: 'call' }` change, Continue anyway recorded in
  `sites.acknowledged_warnings` + audit `warning.overridden`.
- New codes (this design): `ai.panel_off_focus` (standing, site: "Most of your AI questions are about <topic>, but your keywords are
  about <focus>." Accept: "Ask about <focus> instead" -> reconcile now; Continue anyway: "Keep these questions"); `ai.ladder_not_measured`
  (info at ladder start when the swap would exceed the panel: "Your AI questions do not cover <keyword> yet." Accept: "Add N questions
  (+X credits a month)").
- Reused from M7, not duplicated: `ai.question_place`, `ai.market_drift`, `ai.extra_market_*`, `ai.market_index_us`. From M4:
  `market.keyword_place` (devaicon's "gcc" in a Pakistan ladder) runs **before** the ladder becomes a focus topic; the focus model only
  strips other-market place words, it does not decide the market.
- Automatic starts cannot acknowledge (AUDIT.md §2.2), so the reconcile's own proposals are Needs-you items, never blocking warnings.

---

## 5. Build plan

| # | Change | Files | Size |
|---|---|---|---|
| 1 | Focus kit: `focusOf`, `sameTopic`, `quotas`, `reconcile`, `matched` helpers; pure, inlined by the build like `_ai_panel.js` | new `v5/code/_ai_focus.js`; `build_monitors.py` (inline marker in AI Plan, Prompt Jobs, Prompt Rows, Pulse Plan, AI Metrics) | M |
| 2 | Load ladder settings into the AI workflow and the pulse | `build_monitors.py` (one Data Table load node each) | S |
| 3 | AI Plan: topics from `AIF.focusOf` (replace `AI_Plan.js:147`), `need` from `reconcile` per topic (replace `:156-160`), retire list on the full run, markets without stale question markets (`:163`), focus + events on the plan item | `v5/code/AI_Plan.js` | M |
| 4 | Prompt Jobs: one job per topic x market x persona cell with the topic's quota; site-country place list | `v5/code/Prompt_Jobs.js`, `v5/prompts/ai_prompts.txt` | S-M |
| 5 | Prompt Rows: store `focus_topic`, `focus_source`; status `proposed` where the table in 4.4 says so; place check (M7 rule); write `retired` rows | `v5/code/Prompt_Rows.js` | S-M |
| 6 | Pulse scope | `v5/code/Pulse_Plan.js`, `_monitor_sites.js` (setting), `_ai_panel.js` `cost` (`pulse_questions`), `app/shared/src/ai-panel.ts` mirror, golden cases regenerated (`harness/ai_panel_cases.js`) | S |
| 7 | Comparability: matched delta, per-topic segment overlap, panel events | `v5/code/AI_Metrics.js`, `_ai_panel.js` (`overlap` per cluster), `AI_Report.js` lines | M |
| 8 | Columns | `ladder_common.py`: `AI_PROMPTS_COLS` + `focus_topic`, `focus_source`, `retired_at`, `retire_reason`; `MONITORS_COLS` + `ai_pulse_scope`, `ai_focus_mode`; `sync_tables.py` on deploy | S |
| 9 | Site Admin `ai_prompts`: `retire` and `accept` (proposed -> active) | `v5/code/Admin_Action.js`, `AI_Prompt_Rows_Admin.js`, `build_api.py` validation | S |
| 10 | App: focus mirror + parity test, consistency producer (codes in 4.9), Needs-you kind `ai_panel` + guide, server routes for accept / not now | `app/shared/src/ai-focus.ts`, `consistency.ts` (with the mismatch builder), `data.ts`, `guide-links.ts`, `guides.ts`, `server/src/services/pipeline.ts` (Needs-you), `routes/sites.ts` | M |
| 11 | App UI: group the PanelManager by focus topic, "Proposed" and "Retired" filters, the off-focus banner, pulse scope in monitors settings with its price, onboarding Launch line naming the topics | `web/.../ai-panel.tsx`, `MonitorSettingsFields.tsx`, `LaunchStep.tsx` | M |
| 12 | Marketing + changelog + tutorial re-capture (CLAUDE.md working rules: customer-facing change) | `app/web/src/marketing/content/features.ts`, `changelog.ts`; video-skills repo tutorials on AI visibility | S |
| 13 | One-off repair script for devaicon (dry run by default; prints what it would retire / write) | `n8n/seo-agent/fix_ai_panel_focus.py` | S |

Order: 1-2-3-5 (engine core, harness green), 7 (comparability, before anything moves in production), 4, 6, 8-9, then the app 10-11
together with the mismatch builder's `consistency.ts`, 12, 13. One commit per functionality (CLAUDE.md).

---

## 6. devaicon.com: the one-off correction

### 6.1 Confirm first (read-only)

- The engine's market: `seo_sites` row of devaicon.com (`country`, `location_code`, `language_code`) vs the app's `sites.country`.
- The panel: `seo_ai_prompts` where `domain = 'devaicon.com'` (`prompt`, `market`, `status`, `source`, `created_at`); expected 10 rows,
  `market = 'AE-en'`, `source = 'auto'`.
- The ladder: `seo_ladders` / `seo_ladder_settings` for "ai automation solutions gcc" (status, `chosen_by`).
- Declared services: `seo_sites.declared_services` / the app's Business details. **If devaicon declares Open edX among its services,
  the owner should say so**: the design would then keep 1-2 Open edX core questions; the owner's message says it does not work on it.

### 6.2 Market decision (M5 first)

devaicon's business text names UAE / GCC, its country is Pakistan, its ladder names the GCC. The panel must follow one market. With the
owner's stated answer (Pakistan): M2 re-sync of the engine row to Pakistan, M4 Accept on the ladder ("ai automation solutions" without
"gcc"), and the panel below. If the owner decides the buyers are in the UAE, set the website's country to the UAE instead and write the
same topics in the UAE (Qatar / Oman / Kuwait / Bahrain cannot be measured: not in COUNTRIES).

### 6.3 Steps

1. Retire the 9 Open edX questions (status `retired`, reason "the website no longer works on open edx provider"; until the status exists:
   switch them off through the app, which keeps their history). Keep the brand question.
2. Remove "open edx provider" from tracked keywords, or keep it as a `watch` topic with at most 1 question if the owner wants the rank
   check. (Today a tracked keyword re-enters `topics` on every write, `AI_Plan.js:147`.)
3. Write the new questions with the panel size unchanged (10), market PK-en, one writer job per topic. Illustrative set (the writer
   writes the final wording; every one passes the vendor, government and place rules):

| # | Topic (state) | Kind / stage | Question |
|---|---|---|---|
| 1 | ai automation solutions (active, ladder) | recommend / decision | Which companies in Pakistan offer AI automation solutions for mid-sized businesses? |
| 2 | ai automation solutions | choose / consideration | How do I choose an AI automation partner in Pakistan, and what should I check before signing? |
| 3 | ai automation solutions | cost / decision | How much does an AI automation project cost for a company in Pakistan? |
| 4 | ai automation solutions | compare / consideration | Custom AI automation or off-the-shelf automation tools: which suits a growing company better? |
| 5 | ai in industrial automation (active, published page; merged into the ladder topic as a sub-intent) | recommend / decision | Who are the best providers of AI for industrial automation and manufacturing in Pakistan? |
| 6 | ai in industrial automation | problem / awareness | How can factories in Lahore or Karachi use AI to cut machine downtime and defects? |
| 7 | ai in industrial automation | cost / decision | What does it cost to add AI-based quality inspection to a production line? |
| 8 | core service (declared; to confirm, e.g. AI workflow / process automation) | recommend / decision | Which firms in Pakistan build AI agents that automate back-office workflows? |
| 9 | core service | problem / awareness | How should a company start automating repetitive business processes with AI? |
| 10 | brand | brand | What is Devaicon (devaicon.com) and what does it offer? |

4. Pulse scope `focus`: questions 1-7 every pulse morning; 8-9 weekly; brand monthly.
5. Cost: weekly $0.35, full-run extra $1.02, pulse $2.18 -> **$4.72 a month, 283 credits** (today $5.35, 321). Pulse off: $2.54, 152
   credits, headline +/- 14 points. Panel 8 with focus pulse (5 focus questions): about $3.79 (227 credits). Recommendation: panel 10, focus scope.
6. Trend: devaicon's panel has existed since 2026-10-25 with at most one weekly run, so the new baseline loses nothing; the report says
   "new panel from <date>: questions now follow your keyword 'ai automation solutions'".
7. Did-it-work: questions 5-7 become the treated questions of the published page "ai in industrial automation" from the first week
   they are asked (its "before" window is short because the page is already live; the next ladder page will have a clean before window).

Until the build ships, steps 1, 2 and 4 (as "pulse off" or a smaller panel) can be done in the app by the owner; step 3 happens by
itself on the next weekly run once 9 questions are switched off (deficit 9), but **only correctly after step 2 and the M2 market
re-sync**, otherwise it writes UAE questions about Open edX and AI automation mixed.

---

## 7. Evaluation plan

### 7.1 Labelled cases (`harness/accuracy/ai_panel_focus.json`, scorer `score_ai_panel_focus.js`, like `score_keywords.js`)

Each case = a site state (country, services, tracked keywords, ladders with status and `chosen_by`, content log, GSC queries, stored
panel) and the expected result (focus topics with state, quotas, retire ids, propose counts, market). Plus a question-level set:
question text + site -> `on_focus` yes / no, `place_ok` yes / no, labelled by a person (the owner or an independent reviewer), not by the
code under test.

| Site | What it tests |
|---|---|
| **devaicon.com** (PK; tracked "open edx provider", ladder "ai automation solutions gcc", page "ai in industrial automation"; stored 10 Open edX UAE questions) | the production case: Open edX `out` / `watch`, retire 9, propose 9 in PK, "gcc" stripped, pulse = focus only |
| **techand.ai** (AE; Dynamics 365 ERP; ladder "dynamics 365 erp system"; earlier e-invoicing ladder; panel 12) | a stable site must barely move: Dynamics / ERP questions kept, "Microsoft Dynamics" allowed (own platform per services), e-invoicing kept only if its ladder or pages are live, no churn week to week |
| Synthetic A: UAE e-invoicing provider, 2 ladders, one deleted mid-timeline, one owner-pinned question on the deleted topic | retire on delete (at month end), pinned question untouched + Needs-you |
| Synthetic B: German online shop (DE-de), products, ladder on one product family, extra market AT | German wording, place words only DE/AT, shopping stage, market rewrite proposal when the country changes to AT |
| Synthetic C: new site, no ladder, 3 declared services, tracked keyword that is a competitor's brand | setup-day panel = brand + services, competitor keyword `out` with its reason |
| Synthetic D: 5 ladders on a panel of 10 | topic cap and the "raise the panel" proposal with its price |

Targets: topic precision >= 95% and recall >= 90% over the cases; question on-focus >= 95% on the labelled question set; **0** place
violations; owner / pinned questions moved automatically: **0**.

### 7.2 Offline harness (new scenarios, run in the throwaway n8n container as today)

- **Timeline simulation**: 12 weekly runs per synthetic site with events (ladder start week 2, page published week 4, ladder deleted week
  7, country change week 9), answers drawn from fixed per-topic rates. Assert: additions land the week of the ladder start; retirements
  only on full runs after 28 days; headline baseline resets <= 1 per month + 1 per new ladder; matched-panel delta available in >= 90% of
  weeks (today's rule: compute the same number for the baseline); per-topic trend unbroken for untouched topics; no question asked
  twice in one run; nothing paid twice (`done_keys`).
- **Cost**: `AIP.cost` with `pulse_questions` equals the app's `estimateAiPanelCost` on the regenerated golden cases (S211 and
  `cost.aipanel.test.ts`); a swap inside the panel never changes the monthly quote; pulse requests in the fixture = the focus count.
- **Parity**: `ai-focus.ts` vs `_ai_focus.js` on every labelled case (as `fit-gate.ts`).
- **Sandbox rules** (memory note 2026-10-25): no `Object.defineProperty`, `structuredClone`, `URL` in the kit; the harness mimics the n8n
  sandbox, keep it on.
- **Existing scenarios** S19 / S200 / S211 and the AI pilot keep passing; harness must end `0 failed`.

### 7.3 One cheap live check (owner's go-ahead; isolated stack or production)

1. Writer-only run for devaicon after the owner's step 6.2 decision: AI Plan + Prompt Jobs + Prompt Writer with `propose_only: true`
   (questions stored `proposed`, nothing asked): about **$0.03-0.06 Claude, $0 DataForSEO**. Read the 9 questions, have the owner label
   them on-focus / place-ok (target 9 of 9).
2. Accept them and let the next scheduled cycle measure (no extra spend; an on-demand run would be a full run, $1.37). Check the pulse
   the following morning asks 7 questions x 3 engines ($0.084).
3. techand.ai: run the reconcile in plan-only mode (no writer): it must propose **no** change (stability check, $0).

---

## 8. Risks and how the design handles them

| Risk | Handling |
|---|---|
| Trend churn: the panel moves every time a ladder moves | additions weekly, retirements monthly with 28-day hysteresis; stable core >= 30% never auto-retired; matched and per-topic deltas |
| A ladder abandoned for two weeks loses its baseline | paused ladders keep their questions (weekly only) for 56 days |
| Cost surprise | swaps inside the paid size only; growth is always a priced proposal; pulse scope `all` kept for existing sites |
| Owner's deliberate questions overwritten | custom and pinned questions are never touched automatically |
| The ladder keyword itself is in the wrong market (devaicon's "gcc") | M4 runs before a ladder becomes focus; the focus model only strips other-market place words |
| Declared services are wrong or empty | core falls back to Search Console query clusters with impressions, else the brand question only; an `ai.panel_off_focus` info asks for services |
| Topic matching errors merge two different subjects | `sameTopic` threshold set on the labelled cases; mis-merges counted in the scorer |
| Writer still drifts off topic | one topic per job + the topic check on output (`fitEvidence` `in` against the topic phrase and services) + the place rule; refused rows stored with reasons |
| Two agents building overlapping warnings | M7 owns market codes and the gazetteer; this design adds only the two focus codes and calls M7's rule in the writer |
| Production untouched until the owner deploys | everything above is code + harness; the devaicon repair script is dry-run by default and the deploy is the owner's |

---

## 9. Sources (opened 2026-10-27)

- [P1] Profound, Create effective prompts: https://docs.tryprofound.com/answer-engine-insights/how-tos/create-effective-prompts
- [P2] Profound, Prompt tracking: https://www.tryprofound.com/features/answer-engine-insights/prompt-tracking
- [P3] Profound, Personas: https://docs.tryprofound.com/answer-engine-insights/personas.md
- [E1] Peec AI, Setting up your prompts: https://docs.peec.ai/setting-up-your-prompts.md
- [A1] AthenaHQ, Setting up prompts: https://docs.athenahq.ai/setting-up-prompts.md
- [C1] Conductor, AI Search setup: https://www.conductor.com/docs/intelligence/ai-search-setup/ and https://support.conductor.com/en_US/learning-library/persona-prompt-generation-conductor-ai-search-performance
- [C2] Conductor, AI search performance tracking best practices: https://www.conductor.com/docs/platform/learning-center/library/ai-search-performance-tracking-best-practices.md
- [D1] Adobe Brand Visibility, best practices for topics and prompts: https://experienceleague.adobe.com/en/docs/brand-visibility/using/essentials/best-practices-topics-prompts
- [S1] Semrush, Prompt Tracking: https://www.semrush.com/kb/1503-prompt-tracking
- [S2] Semrush, LLM prompt tracking (blog): https://www.semrush.com/blog/llm-prompt-tracking/ ; AI Visibility Toolkit: https://www.semrush.com/kb/1493-ai-visibility-toolkit
- [R1] Scrunch, Prompt strategy guide: https://helpcenter.scrunchai.com/en/articles/12872036-scrunch-prompt-strategy-guide
- [R2] Scrunch, Topics vs tags: https://helpcenter.scrunchai.com/en/articles/11850681-how-to-organize-prompts-in-scrunch-topics-vs-tags ; Personas: https://helpcenter.scrunchai.com/en/articles/13676120-how-personas-are-used-within-scrunch
- [H1] Ahrefs, Set up custom prompts: https://help.ahrefs.com/articles/13192745-how-to-set-up-custom-prompts-to-track-brand-visibility-in-ai-assistants
- [H2] Ahrefs, Custom Prompts: https://www.ahrefs.com/custom-prompts
- [O1] Otterly, Relevant prompts: https://help.otterly.ai/relevant-prompts
- [O2] Otterly, Onboarding guide: https://help.otterly.ai/otterlyai-onboarding-guide
- Earlier market research with statistics sources: `n8n/seo-agent/docs/ai-visibility-2026-10-23/MARKET_RND.md`
- Market rules this design reuses: `n8n/seo-agent/docs/mismatch-audit-2026-10-27/AUDIT.md` (M1, M2, M4, M5, M7, §2)
