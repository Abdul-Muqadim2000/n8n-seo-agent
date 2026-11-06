# AI ranking algorithm (AIR): design and build contracts (2026-11-06)

Status: DESIGN, nothing built. Phase 2 of the AI-ranking programme (`README.md`). Inputs: `R1_EVIDENCE.md` (keys E*, M*), `R2_LEADERS_ACTIONS.md`
(keys PF*, PE*, GG*, AO*, EX* ...), `R3_INTEGRATIONS.md`, `R4_PROD_OUTCOMES_SUMMARY.md` (+ the private full report), `R5_SYSTEM_SURVEY.md`, and the
production review findings F-08, F-37, F-38, F-53, F-81, F-85 (private). Paths are relative to `n8n/seo-agent/` unless they start with `app/`.
Client data: only the two domain names and aggregate counts appear here. The repo is public.

Name used throughout: **AIR** (the AI-ranking algorithm). Kits: `ARD` (diagnosis), `ARL` (decision and learning).

---

## 1. Summary for the owner

**What went wrong.** In 11 days of production, techand.ai was named in 8 of 471 non-brand AI answers and devaicon.com in 1 of 248. Every
engine knows both companies when asked by name. They are not named when a buyer asks "who are the best providers", because:

1. The engines cannot find them. AI assistants that search the web only name what they retrieve. devaicon.com is close to invisible in
   Google, absent from Bing's account, has one page in Brave and none in Common Crawl. techand.ai is findable but ranks 20 to 50 for the
   searches the assistants run.
2. The answers are built from lists and directories ("top 10 companies in ...", Clutch-type directories, a national registry). Neither
   client is on any of them, and our system threw most of these pages away.
3. Our question set kept changing (it even retired the one question techand.ai was winning) and was too small to show any change.
4. The system promised pages it never wrote (0 of 20 AI targets written) and could not send any outreach (no mailbox connected).

**What the market sells, and why it is not enough.** The leaders (Profound, Peec, Gauge, AirOps, Semrush/Adobe, Conductor) mostly
sell content rewrites plus a list of "opportunities". The best controlled study of content rewriting found it worked in 3 of 54 settings
(E1). No leader checks whether a question is lost because the company is not found, not cited, or cited but not named. No leader uses
control questions to prove that an action worked.

**What AIR does.** Every week, for every tracked question and every AI engine, AIR:

1. **Finds where the client is stuck**, as one of six stages: cannot be read (blocked, not indexed), not found for the searches the engine
   runs, found but not cited, cited but not named, named but weakly or wrongly, or won.
2. **Maps the pages the answers are built from**: which lists, directories, reviews, forums and news pages the engines cite, who wrote
   them, whether they name the client, and whether the client can realistically get onto them.
3. **Picks the few actions most likely to move each question to the next stage**, using published evidence as the starting point and
   our own measured results as they come in. It picks retrieval and placement first for companies that are not yet found, and content
   polish only once a page is already being read.
4. **Does the work through the rails we already have** (page writer, Link Builder, listings checklist, "Steps on your website"), and asks
   the client only for the steps a person must do, with a date and a check.
5. **Checks that the action really happened** (page live and indexed, listing found, the list now names the client) before it counts.
6. **Measures the effect against control questions** the action did not touch, says plainly what size of change the panel can detect,
   and learns which actions work for which kind of question and engine, across all clients.

**Safety.** Nothing changes for any website until we switch it on, one website at a time, with one setting (`off`, `shadow`, `on`).
`shadow` computes and records AIR's plan next to the current logic for $0 and changes nothing a client sees. Existing tables only get new
columns, nothing is renamed or removed. Rolling back is one setting, or one global switch.

**Cost.** Shadow: $0. On, free parts only: $0 extra provider cost, plus about $1.60 a month per site if you let AI pages be written on top
of keyword pages. With the paid data you may approve: up to about $4.30 a month per site (section 5).

**Plan.** Build in two waves of parallel work (6 packages). Wave 1 gives shadow mode on production data; wave 2 gives `on`, the extra data
sources and the client-facing steps. devaicon.com and techand.ai run in shadow for 4 weekly cycles, then `on` one after the other if
the shadow passes the gates in section 7. Decisions needed from you are in section 8.

**Honest expectation.** These are small, young, regional brands. No published technique has a proven durable effect across engines (E2).
What AIR can promise: the client gets findable and listed where the answers are built, every action is checked, and every claimed win is
measured against controls. First measurable movement is expected in leading indicators (found for the searches, listed on cited pages) in
4 to 8 weeks; named-in-answer gains are expected later and may stay below what 2 sites can prove statistically within 12 weeks.

---

## 2. The algorithm

### 2.0 Where AIR sits and what it reads

AIR runs inside the existing weekly **AI Growth** workflow (`SEOagentAIGrow1`, job 5 of each website's cycle, `_cycle.js:29-36`), after
`Save AI Growth` and before `Growth Report`. No new cycle job, no new workflow, no new callback stage in the first release.

```
... Growth Metrics -> AI Page Rows -> ... -> AI Growth Row -> Save AI Growth
      -> AI Rank Gate -> Any AI Rank?  --false-->  Growth Report (unchanged)
                                  \--true--> AIR tables ensured + AIR loads -> [AIR requests, wave 2] -> AI Rank Plan
                                             -> AIR row builders -> AIR saves -> Growth Report
```

`Growth Report` already reads `$('Growth Metrics')` explicitly (`Growth_Report.js:17`), so inserting the AIR chain in front of it does not
change the report or the `ai_growth` callback. With every site `off`, the only new nodes that execute are `AI Rank Gate` and its IF.

Data AIR reads (all already stored, except the wave-2 integrations):

| Data | Source | Used for |
|---|---|---|
| Answers of the last 8 days with `named`, `cited`, `cited_json`, `retrieved_json`, `fanout_json`, `entities_json`, `answer_text` | `seo_ai_answers` (`Load AI Answers`, already loaded) | stage evidence per question x engine |
| Per-answer units of the last 60 days | `seo_ai_visibility.units_json` + `seo_ai_daily.detail_json` (`AVX.history`) | rates, arms, DiD, first appearances |
| Panel, focus, market, demand | `seo_ai_prompts`, `seo_ai_visibility.demand_json`, `seo_query_history` | core panel, value |
| Robots per bot, readiness, raw words, Bing crawl state | `seo_ai_visibility.access_json`, `seo_ai_pages`, this run's `Robots Verdicts (Growth)`, `AI Readiness` | stage S0 |
| Google index state per page | `seo_index_pages` (Index Coverage) | stage S0 / leading indicator |
| Google result pages | `seo_cache` `serp:*` rows (`_serp_cache.js`), any date, labelled with the reading date | fan-out rank proxy (S1 vs S2) |
| Cited third-party pages, fetched this run | `Earned Media` output (names us, rivals, contact) | source graph |
| Listings, outreach, prospects | `seo_listings`, `seo_link_outreach`, `seo_link_prospects` | placeability, verification |
| Content log, targets | `seo_content_log`, `seo_ai_targets` | verification (page live), old-logic comparison |
| AIR state | the five new `seo_ai_rank_*` tables (2.10) | arms, evidence history, actions, priors |

### 2.A Stable, winnable panel

**Problem (R4 cause 3 and 4).** 38 model-written questions with no demand data, a market taken from a profile field (devaicon.com moved to
Pakistan while its own keywords are UAE / GCC), 9 of 22 questions retired in 11 days (including techand.ai's only winning question), and
9 to 11 questions per client, which can only detect a jump to about one question in four.

**A1. Market.** `ARD.market()` decides the market from, in order of weight:

| Signal | Weight |
|---|---|
| Keywords the client chose (ladders with `chosen_by` client, tracked keywords), place words in them | 3 per keyword |
| `seo_sites.country` / `location_code` | 3 |
| Declared service areas (`profile.service_areas`) | 1 per area |
| Search Console clicks by country, 28 days (when stored) | 2 for the top country |
| `profile.country_code` alone | 1 |
| Ladder rungs the system spawned itself, panel questions written by the model | 0 (never a source) |

The market is the country with the highest total. A runner-up within 25% of the winner is a **second market** (reported, not asked unless
the owner adds it to `ai_markets`). Every input that disagrees is listed in `conflicts` (for devaicon.com the profile country would be
listed). Ladder keywords are read through `FITR.fitStored` first (INVARIANTS rule 2, `gate_lint.py`).

**A2. Intent class per question.** From the last 28 days of answers: `recommendation` when at least 50% of answered answers name at least
one business (role competitor or client), `informational` otherwise, `brand` for the brand question (excluded from AIR). Stored in
`seo_ai_rank_questions.intent`. Informational questions are scored on citation (a cited client URL is a win), recommendation questions on
naming.

**A3. Core set (frozen).** The core set is the questions AIR measures progress on:

- Every active non-brand question whose market equals the site market (A1), up to `core_max` = 30.
- **Never dropped while frozen**: a core question stays core for 8 weeks from `core_since` (`core_until = core_since + 56 days`).
- **Never retired at all** while it named or cited the client in the last 56 days: AIR extends `core_until` by 56 days each week this holds.
- In `on` mode AIR writes `core_until` on `seo_ai_prompts` (new column). `_ai_focus.js` is changed (package P3) so that a question whose
  `core_until` is in the future is never retired by the focus rules. With no `core_until` set anywhere, focus behaves exactly as today.
- New questions AIR wants (market-correct, from client keywords, from Search Console question queries, from LLM Mentions
  `search_mentions` when available) are written as `status: 'proposed'` rows (an existing status the app already lets the owner accept,
  `app/web/src/pages/site/_components/ai-panel.tsx:288`). AIR never activates a question by itself and never changes `ai_prompts_max`.

**A4. Comparability.** The existing rule (refuse a week-on-week delta when the panel changed, `panel_json` in `seo_ai_visibility`) is
kept unchanged. AIR adds a second, stricter reading: progress is reported only on the **core set present in both periods**, so a change
of the wider panel never hides or invents movement on the core. `compare_json` is not touched.

**A5. Demand weight.** Per question, the first available of: AI search volume (`ai_keyword_data`, stored in `seo_ai_prompts.volume`),
Search Console impressions of queries that match the question's keyword (28 days, x 12 / 28 for a monthly figure), else none.

```
demand_w(q) = 1 + log10(1 + vol(q)) / 2          (vol = 0 when unknown; basis 'no demand data' is printed)
```

**A6. Treatment and control arms.** Each core question gets an arm, stored in `seo_ai_rank_questions.arm`:

- Strata: `intent` x `baseline` (`zero` = not named or cited in 28 days, `some` otherwise) x `cluster` (from `seo_ai_prompts.cluster`; at
  most 4 clusters, the rest pooled).
- Inside each stratum, questions are ordered by `AVX.hash(site_id + '|' + prompt_id + '|' + seed)` and assigned treated, treated, control,
  treated, treated, control ... (2:1). The seed is fixed per site at first assignment (`seo_ai_rank_runs.panel_json.seed`).
- An assigned arm never changes while the question is core. A new core question gets the next slot of its stratum's pattern.
- **Question-specific levers** (own page, refresh, cited-not-named fix, correction) are never applied to control questions.
- **Page-level levers** (placement on a list, directory profile): the questions whose cited set contains the acted-on page are treated
  **by exposure** for that action, whatever their arm, and are excluded from its controls.
- **Site-wide levers** (Bing account, PR, LinkedIn, community, video) touch every question: they are judged on verification and leading
  indicators only, and their reports say "no control possible".
- After 12 weeks a control question becomes treated (the holdout rotates, owner decision 6), and new core questions refill the control arm.

**A7. Minimum detectable effect (shown every week).** With `Q_t`, `Q_c` treated and control questions, `m` answers per question per 4-week
period, baseline rate `p`, intra-question correlation `rho` (estimated from the pilot weeks, default 0.3), 80% power, alpha 0.05 two-sided:

```
n_eff(Q)   = Q * m / (1 + (m - 1) * rho)
MDE_prepost = 2.80 * sqrt( 2 * p(1-p) / n_eff(Q_t) )
MDE_DiD     = 2.80 * sqrt( 2 * p(1-p) * ( 1/n_eff(Q_t) + 1/n_eff(Q_c) ) )
p_floor     = max(p, 0.02)        (a zero baseline uses 2% for the planning figure)
```

This reproduces R1 §6 (p 0.02, Q 40 per arm, m 28, rho 0.3: 5.0 and 7.1 points). For a zero baseline AIR also prints the **first-
appearance requirement**: the smallest number `k` of first appearances that, all on treated questions, gives a one-sided Fisher exact
p below 0.05:

```
P(no first appearance on control | k appearances, Q_t treated, Q_c control) = C(Q_t, k) / C(Q_t + Q_c, k)
```

With 16 treated and 8 control questions, `k = 7` (p 0.033); with 20 and 10, `k = 6` (p 0.046). The memo says this in words: "To show
that our actions worked on questions where you were never named, we need about 7 questions to name you for the first time, all among the
questions we worked on."

**A8. Power advice.** R1 §6: questions, not repeats, buy power. AIR's memo recommends (never applies) a power-neutral panel: for example
24 questions with the pulse at 2 mornings a week instead of 20 questions with a daily pulse (cost in section 5). This is owner decision 5.

### 2.B Stage diagnosis per question x engine

**Engines.** `chatgpt`, `gemini`, `ai_mode`, `ai_overview`, `perplexity`, `claude`, `copilot`, `chatgpt_api`. `gemini_api` is excluded
from diagnosis and learning until DataForSEO confirms in writing that its Gemini API route may be stored and analysed (R3 §2.1b; owner
decision 9). Engine to retrieval index:

| Engine | Index for the retrieval proxy | Strength of the proxy |
|---|---|---|
| chatgpt | direct: `retrieved_json` (the scraper's `search_results`) | direct |
| ai_overview, ai_mode, gemini | Google (SERP cache, Index Coverage) | documented (E8, E39) |
| copilot | Bing (Bing Webmaster crawl state, wave 2: `GetQueryStats` positions) | documented (E13) |
| claude | Brave (only with a Brave key, wave 2), else `unknown` | weak: a second provider was reported in 2026 (R3) |
| perplexity | Google as a weak proxy (28.6% top-10 overlap, E40) | weak |
| chatgpt_api | none (no fan-out reading) | n/a, stage from citations only |

**Fan-out queries per question.** The union of `fanout_json` of the question's answers (ChatGPT scraper and AI Mode carry them), counted,
plus the question's own keyword. Engines without fan-out data use this union. Kept per question in `evidence_json` across weeks (2.10),
so the 35-day retention of `seo_ai_answers` does not limit it.

**Window.** Rates over 28 days of units (weekly + pulse). Answer-level evidence from the last 8 days plus the rolled `evidence_json`.
Engines asked less than weekly (Claude monthly) use 56 days and are labelled `thin`.

**Stages** (first rule that holds, top down; `n` = answered answers of that question x engine in the window):

| Stage | Rule | Sub-labels |
|---|---|---|
| `unmeasured` | `n < 4` (`n < 2` for a `thin` engine) | `not_asked`, `too_few` |
| `S0` ineligible | the engine's bots are blocked by robots.txt (`access_json`, `Robots Verdicts (Growth)`); or the client page AIR maps to the question has fewer than 150 raw-HTML words while its rendered text has at least 3x more (`seo_ai_pages.words_raw` / render diff); or the engine's index does not hold the client: Google: no page of the site is indexed for the question's topic (`seo_index_pages.state` not indexed for the mapped page, and the site has no Search Console impressions for any fan-out query); Bing: the site is not in the Bing Webmaster account (`Bing Sites (Growth)`) or the mapped page is not crawled 14 days after submission | `blocked`, `js_only`, `not_indexed` |
| `S5` won | named in at least 2 answers AND named rate at least 0.30; for `recommendation` also median position at most 3; for `informational`, cited in at least 2 answers AND cited rate at least 0.30 counts as won | |
| `S4` named, weak or wrong | named at least once but not S5; or S5 with negative sentiment or an accuracy issue on file (`issues`, `perception_json`) | `weak`, `low_position`, `negative`, `wrong` |
| `S3` cited, not named | a client URL in `cited_json` at least once, named 0 (recommendation questions only) | |
| `S2` retrieved, not cited | chatgpt: a client host in `retrieved_json` at least once; other engines: the client ranks in the top 10 of that engine's index for at least one fan-out query (proxy) | basis `direct` or `proxy_rank` |
| `S1` not retrieved | eligible and none of the above | basis `unknown_index` when the engine's index cannot be read |

Every stage carries `basis` (direct / proxy_rank / unknown_index), `n`, and up to 3 evidence items (an answer id and date, a SERP reading
date and position, a robots line). `lineage_lint.py` requires the basis.

**Additional signals per question:**

- `parametric_share`: share of answers with no fan-out query and no citation (the engine answered from memory). With
  `parametric_share >= 0.6` the question is flagged `no_search` for that engine: only long-run levers (earned mentions, LinkedIn) can
  reach it (R1 §2).
- `brand_known[engine]`: from the monthly brand question (existing, `AI_Metrics.js:626`), per engine. Not known AND `no_search` is the
  parametric "brand not known" signal.
- `nobody_named`: an informational answer naming no business; the question is scored on citation (A2).
- `list_dominated`: at least 40% of the citations for the question are pages classed `listicle` or `directory` (2.C).
- `best_stage`: the highest stage over engines, weighted by engine weight (2.E).

### 2.C Source graph

**Nodes.** Every third-party page cited for a core question in the window (`cited_json`, `cited_urls`), plus, in wave 2 with the owner's
yes, DataForSEO `llm_mentions/top_mentioned_pages` for the site's topic keywords (monthly). Stored per site and page in
`seo_ai_rank_sources` (2.10), so the graph keeps history beyond 35 days.

**Classification** (`ARD.classifyPage`, regex over host, path and title, reusing the host lists of `Growth_Plan.js:40-49`, extended):

| page_type | Rule |
|---|---|
| `listicle` | title or path has best / top N / leading / companies in / list of / vs / alternatives, not a directory host |
| `directory` | known directory hosts (clutch, goodfirms, themanifest, designrush, sortlist, upcity, the Microsoft partner directory, national business directories) or paths `/companies`, `/agencies`, `/developers`, `/directory` |
| `review` | review hosts (g2, capterra, trustpilot, trustradius ...) |
| `registry` | an official list of accredited providers (government or industry body) |
| `community` | forum hosts and `community.` / `forum.` subdomains |
| `news` | news hosts or `/news/`, `/press/` paths |
| `video`, `social`, `encyclopedia`, `official` | as `Growth_Plan.js` |
| `vendor_page` | a business page that is not a list |
| `client` | the client's own host |

**Author kind**: `rival` (host is a declared competitor, an entity with role competitor in `entities_json`, or `RV.providerOf` says it
sells the same thing), `editorial` (none of these), `client`, `platform` (directory / review / registry operator).

**Rival-written lists are kept, not thrown away** (R4 cause 2). They are used three ways and pitched in none by default:

1. **Learn the format**: when rival lists dominate a question's citations, the question's own-page lever is an honest comparison or cost
   guide that answers the fan-out queries, never a self-ranked list (E26: the self-promoter is left out 69% to 83% of the time).
2. **Learn who wins**: the businesses they name feed the competitor-set proposal (helps F-53: the competitor set becomes real businesses).
3. **Learn the searches they rank for** (SERP cache), which become fan-out queries for the client's own page.

Pitching a rival's list stays possible per page with the owner's opt-in (owner decision 8), because the existing qualification rule
(`_outreach_kit.js:173-175`, C-2) refuses it for a good reason: a rival rarely adds a competitor.

**Influence and placeability:**

```
influence(page) = sum over core questions q citing it:  V(q) * cites(page, q) / answers(q)      (28 days, all engines)
placeability(page) in [0, 1]:
  directory with self-serve profile .......... 0.80   (a person creates the profile; reviews raise its place)
  registry, client eligible ................... 0.50   (0 when the client does not meet the listing rules; the reason is printed)
  community thread (disclosed, genuine) ....... 0.30
  editorial listicle with a contact found ..... 0.15
  editorial listicle, no contact .............. 0.05
  news article ................................ 0.05
  rival listicle .............................. 0.02   (learn only unless the owner opts in)
  vendor_page, official, encyclopedia ......... 0
target_value(page) = influence(page) * placeability(page)
```

`names_client` comes from this run's `Earned Media` fetch (already done for the top 10 cited pages) and is carried forward from the last
reading; a page that answered 403 is `null` (unknown), never `false`.

### 2.D Lever library

Each lever: target stage, engine multipliers, prior (mean, pseudo-count `n0`), time to effect (min / typical / max days), cost (USD per
action), client effort (minutes), executor (`auto`, `approve` = the client approves and software executes, `human` = a person must do it;
software finds, drafts, tracks and verifies), sink (the existing rail), and evidence. Priors are deliberately modest: none of these has a
controlled study behind it (R1 §0).

| id | Lever | From -> to | Engine multipliers | Prior mean (n0) | Days | USD | Effort | Executor | Sink (wave 1 / wave 2) | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| L01 | Unblock AI bots in robots.txt | S0 blocked -> S1 | the blocked engines 1.0 | 0.90 (10) | 1/2/7 | 0 | 15 | human | existing site task `ai_crawlers` | E11, E8 |
| L02 | Content in raw HTML (server render) | S0 js_only -> S1 | chatgpt, perplexity, claude 1.0; google 0.3 | 0.70 (6) | 7/14/45 | 0 | 240 | human | growth action / site task `ai_rank` | E23 (S) |
| L03 | Add site to Bing Webmaster + submit | S0 not_indexed (copilot) -> S1 | copilot 1.0, chatgpt 0.2 | 0.85 (8) | 2/10/30 | 0 | 20 | human + auto submit (existing) | growth action / site task `ai_rank` | E13, R4 |
| L04 | Get the page indexed in Google | S0 not_indexed (google) -> S1 | google group 1.0 | 0.50 (6) | 7/21/60 | 0 | 30 | existing Index Coverage steps | link to `ix:*` items | E8 |
| L05 | Own answer page for the fan-out set (new) | S1 -> S2 | google 1.2, chatgpt 1.0, perplexity 1.0, copilot 0.8, claude 0.6 | 0.20 (6) | 14/45/90 | 0.80 | 20 | approve | `seo_ai_targets` kind `answer` | E20, E19, E24, E9 |
| L06 | Refresh the ranking page for the fan-out set | S1/S2 -> S2/S3 | as L05 | 0.25 (6) | 7/30/60 | 0.80 | 20 | approve | `seo_ai_targets` kind `refresh` | E20, OT2 |
| L07 | Cited-not-named passage fix | S3 -> S4 | all 1.0 | 0.35 (5) | 7/21/45 | 0 | 20 | approve / human | growth action / site task `ai_rank` | GG1, E20 |
| L08 | Placement on an editorial list the answers cite | S1/S2 -> S4 | ai_mode, ai_overview, perplexity 1.2; chatgpt 1.0; claude 0.8 | 0.06 per pitch (8) | 14/30/90 | 0.02 | 30 | approve (Link Builder sends from the mailbox) | `seo_link_prospects` type `ai_source` | E26, E25, E7, E20 |
| L09 | Directory profile on a directory the answers cite | S1/S2 -> S2/S4 | perplexity 1.5, google 1.2, chatgpt 0.8 | 0.08 (5) | 14/45/90 | 0 | 90 | human | `seo_listings` (gated entries) + site task `ai_rank` | EX6, EX8, E31, R4 own data |
| L10 | Registry / partner listing (eligible only) | S1 -> S4 | all 1.0 | 0.15 (4) | 30/60/120 | 0 | 120 | human | growth action / site task `ai_rank` | R4 |
| L11 | Earned mention (press, partner, customer case) | S1-S4 and `no_search` | chatgpt, claude 1.2; others 1.0 | 0.05 (4) | 30/60/180 | 0 | 240 | human | growth action / site task `ai_rank` | E18, E5, E6, E21 |
| L12 | LinkedIn article by a named person | S1/S2 -> S2/S4 | chatgpt, ai_mode 1.2 | 0.05 (4) | 7/21/45 | 0 | 90 | human | growth action / site task `ai_rank` | E29 |
| L13 | Disclosed community answer | S1 -> S2 | perplexity 1.5, ai_overview 1.0, chatgpt 0.5 | 0.03 (3) | 3/14/45 | 0 | 45 | human | growth action / site task `ai_rank` | E32, E6, E15 |
| L14 | Video for the question | S1 -> S2 | ai_overview 1.3, perplexity 1.2 | 0.03 (3) | 14/45/90 | 0 | 300 | human | growth action / site task `ai_rank` | E9 |
| L15 | Correction (own page or ask the source) | S4 wrong -> S4/S5 | all 1.0 | 0.30 (4) | 14/30/60 | 0.02 | 20 | approve | existing corrections flow | PE1 |
| L16 | Protect a cited page; refresh when citations decay | S5 hold | all 1.0 | 0.50 (4) | n/a | 0 (protect) / 0.80 (refresh) | 0 / 20 | auto / approve | `seo_cache` `air:protect:<site>` / `seo_ai_targets` refresh | E33 |
| L17 | Wikidata / Wikipedia entity | parametric | chatgpt, claude | not proposed until 3 independent earned mentions exist (notability, E36) | | | | human | growth action | E36, E35 |

**Weight 0 (never chosen, kept as hygiene in the audit fix pack):** schema markup, llms.txt (E8, M44, M45).
**Refused, with the reason printed when a client or the old logic would have done it:** self-ranked "best X" lists (E26), AI-only or
agent-only page versions without parity (AD1, near cloaking), paid placement without disclosure (link spam), prompt-injection text (E13),
fake reviews, astroturfed community posts (E41). Writer prompts are **not** changed by AIR: an AI target carries its choice only in the
existing `fanout` and `sources_json` fields (page quality must not drop; the page-quality waves own the prompts).

### 2.E Scoring and choice

**Value of a stage.** Expected named (or cited, for informational questions) rate per stage, from E20 and AO6, recalibrated monthly from
our own transitions once at least 30 cells per stage are observed:

```
U(S0) = 0     U(S1) = 0.03     U(S2) = 0.15     U(S3) = 0.25     U(S4) = 0.45     U(S5) = 0.80
```

**Question value and feasibility:**

```
V(q) = demand_w(q) * intent_w(q) * stage_w(q)
       intent_w: recommendation 1.0, informational 0.6;   stage_w (buyer stage): decision 1.0, consideration 0.8, awareness 0.6
F(q) = clamp(0.05, 1, market_w(q) * (0.5 * comp_w(q) + 0.5 * reach_w(q)))
       market_w: 1 when the question's market is the site market, 0.2 otherwise
       comp_w   = 1 / (1 + median rivals named per answer / 3)
       reach_w  = _reach.js percentile of the site against the keyword's difficulty when stored, else 0.5 (basis printed)
```

**Engine weight** `w_e` (default, owner-adjustable; replaced by the client's GA4 AI-referral split once it has at least 30 sessions):
chatgpt 0.30, ai_overview 0.15, ai_mode 0.15, gemini 0.10, perplexity 0.12, copilot 0.10, claude 0.08. Engine group for priors:
`google` (ai_overview, ai_mode, gemini), `chatgpt` (chatgpt, chatgpt_api), `perplexity`, `copilot`, `claude`.

**Probability.** `p_hat(l, s, g)` = the mean of the lever's Beta posterior for stage `s` and engine group `g` (2.G learning), times the
lever's engine multiplier for the engine, capped at 0.95.

**Expected gain of one action `a`** (a lever applied to a page, a question, or the site), over the cells (question q, engine e) it touches:

```
gain(a) = sum_{(q,e) in cells(a)}  w_e * V(q) * F(q) * p_hat(l, s_qe, g_e) * ( U(target_l) - U(s_qe) )
cost(a) = usd(a) + effort_min(a) / 60 * H + 0.5          (H = client hour value, default $25; owner decision 7)
score(a) = gain(a) / cost(a) / (1 + days_typ(a) / 60)
```

Cells already at or above the lever's target stage contribute 0. A lever only applies to a cell whose stage is in its "from" list.

**Choice** (`ARL.choose`, greedy by `score` with constraints):

| Constraint | Default |
|---|---|
| Own-page actions (L05, L06) | the content slots AIR may use: 0 in shadow; in `on`, the reserved AI slots of 2.F (at most 1 a week, `ai_pages_month` a month) |
| New placement pitches (L08) | 5 a week (inside the Link Builder's 10 drafted sequences a week) |
| New human steps (L02, L03, L07, L09-L14) | 3 a week, at most 8 open per site, never two of the same lever open on the same page |
| Paid data | inside `dfs_budget_usd` and the run ledger (section 5) |
| Control arm | no question-specific lever on a control question |
| One own page per question | yes, and one search one page with ladder pages (the existing `ladderFor` rule) |
| Minimum gain | `gain(a) >= 0.02` |
| Order of stages | for a cell at S0, only eligibility levers (L01-L04) are allowed: content cannot help a page the engine cannot read |

Every chosen action is **pre-registered** before anything is executed (`ARL.prereg`): its questions and engines, controls (2.A6), the
metric (named rate, cited rate, or the stage), the window (the lever's typical days, min 28), and the projected `p_hat` and `gain`. The
pre-registration is stored on the action row and never edited.

**Old-logic comparison (shadow and on).** Every run stores what the old logic chose (`Growth Plan` targets queued, `Earned Media` top
pages, `Growth Metrics` actions) beside AIR's choice, with: overlap, AIR's model-predicted gain of both sets (labelled "AIR's own model,
not independent"), and which R4 causes each set addresses (1 footprint, 2 cited sources, 3 panel, 5 execution, 6 blockers).

### 2.F Execution through existing rails (`on` mode only)

Nothing below happens in `shadow`. Every write uses an existing table in its current shape plus the new columns of 2.10.

| AIR action | Rail | Shape kept | Guard that keeps the old logic from undoing it |
|---|---|---|---|
| Own page (L05 answer, L06 refresh, L16 refresh) | `seo_ai_targets` row: `target_id = 'ait_' + site_id without 'site_' + '_' + prompt_id` (the existing format), `kind` answer/refresh, `status` queued, `page_type`, `fanout`, `sources_json`, `value` = AIR score scaled to the old value range, plus `origin = 'ai_rank'`, `action_id` | status / kind / page_type / target_id vocabulary unchanged | `Growth_Plan.js` leaves a row with `origin = 'ai_rank'` alone while the site is `on` (R5 gap 10); while it is not `on`, Growth reclaims the row (its exact-column writer sets `origin` to null) |
| Reserved AI slot | Content Cadence (`Cadence_Plan.js` + mirror `app/server/src/services/cadence.ts`): on an `on` site with `ai_rank_reserve` true, the top queued `origin = 'ai_rank'` target is written at levels 2 and 3, on top of `pages_per_week`, at most 1 a week, inside `ai_pages_month` | no new source value: `ai_answer` / `ai_refresh` | gated by mode + reserve; off = today's code path |
| Protect pages AI cites (R4 cause 5) | `seo_cache` key `air:protect:<site_id>`, kind `air`, value `{urls:[{url, until, why}]}`: pages cited in at least 2 answers in 28 days or the page of an S5 question | new key only | the cadence (on sites only) never rewrites a protected URL for another keyword: a ladder rung, a striking-distance or a decay refresh aimed at it becomes a suggestion with the reason "AI answers cite this page for <question>; a rewrite for another keyword could lose it" |
| Placement (L08) | `seo_link_prospects` row type `ai_source`, `origin = 'ai_rank'`, `score` = AIR score 0-100, `detail` = "cited for N questions on M engines; names X, Y" | upsert key (site_id, prospect_domain, type) unchanged | `Earned_Media.js` skips a domain whose stored row has `origin = 'ai_rank'` while the site is `on`; the Link Builder uses AIR's probability for these rows instead of the flat 0.35 (`LB_Assemble.js:34`) |
| Directory (L09) | `_listings.js` entries for service firms (The Manifest, Sortlist, GoodFirms, Clutch, DesignRush, the Microsoft partner directory, national registries) included only for `on` sites; `siteKind` returns both `agency` and `saas` for a firm that builds software for clients | listing rows unchanged | gated: off sites get the same checklist as today |
| Core questions (A3) | `seo_ai_prompts.core_until` (update of that one column by `prompt_id`); new questions as `status: 'proposed'` rows | existing statuses | `_ai_focus.js` respects `core_until` |
| Human steps (L02, L03, L07, L09-L14, L17) | wave 1: appended to this run's `seo_ai_growth.actions_json` as `{priority, type: 'ai_rank', action, why}` (the app reads exactly these four keys, `app/server/src/services/data.ts:1675`); wave 2: site task kind `ai_rank` with a daily check (app-first package) | item shape unchanged | the patch keeps every existing action and adds at most 3 |
| Bing / IndexNow | existing submission; AIR-owned target pages count as key pages (Growth Plan adds them to `key` while the site is `on`) | unchanged | n/a |
| Corrections (L15) | existing corrections flow (`Growth_Plan.js:248-268`) | unchanged | AIR only ranks them |

**Blockers.** Every human step and every missing setup item (no mailbox connected, site not in Bing Webmaster, directory profile pending,
redirect open) is listed in the memo with an owner (client / us), the date first asked, and what it blocks ("0 placement pitches can be
sent until a mailbox is connected"). A drafted pitch is never counted as progress.

### 2.G Verify, then learn

**G1. Did the action happen?** (`ARL.verify`, checked every run until it holds or the action expires at `window + 14 days`):

| Lever | Happened when |
|---|---|
| L05, L06, L16 refresh | the content log row is `published` with a live URL (HTTP 200 on our fetch) AND the page is indexed (Google: `seo_index_pages`; Bing: crawled) AND, for chatgpt-type engines, readable in raw HTML. `live_at` is written on the target row. The clock starts at `live_at`, not `written_at` (fixes R5 gap 2 for AIR actions) |
| L08 | the list page now names the client (our fetch, `names_client` true, `OK.namesUs` rules) |
| L09, L10 | the listing is found (`seo_listings.status` linked/listed) or the client gives the profile URL and our fetch confirms it; a 403 platform stays `unconfirmed` |
| L01 | robots.txt allows the bots (next `Robots Verdicts`) |
| L03 | the site appears in Bing Webmaster and the mapped page is crawled |
| L07 | the cited page's quoted passage names the client (fetch) |
| L11-L14 | the client gives the URL and our fetch finds the client's name on it |

An action that did not happen is reported as such and never enters learning.

**G2. Did it move the stage?** At the end of the pre-registered window, for each treated cell: the stage now vs at `t0`. Background rate
`b` = share of control cells (same starting stage, same engine group, same window) that advanced.

**G3. Did it cause a lift?** Three tests, all printed with their numbers and never as "caused":

1. **DiD** on the pre-registered metric, treated questions vs control questions, 28 days before and the window after: `AVX.impact`
   (`_ai_measure.js:158-193`, two-level bootstrap), called with the action's questions and AIR's controls. Verdict "likely helped" only
   when the 95% range is above 0.
2. **Placebo in time**: the same DiD with `t0' = t0 - window`; if the placebo effect is at least half the real effect with p below 0.2,
   the verdict becomes "can't tell (the questions were already moving)".
3. **First appearance** (zero baseline): one-sided Fisher exact on question counts (questions named or cited at least once after `t0`
   among treated vs control, all with zero baseline), and the binomial check on answers (`X ~ Bin(k, n_T / (n_T + n_C))`).

**Leading indicators** (move first, reported weekly per question x engine, with DiD on LI1 and LI4):

| id | Indicator |
|---|---|
| LI1 | retrievable: the client ranks in the top 10 of the engine's index for at least one fan-out query, or is retrieved directly |
| LI2 | indexed: the client page mapped to the question is indexed in the engine's index |
| LI3 | on-source: at least one page cited for the question names the client |
| LI4 | cited rate |

**G4. Learning** (`ARL.learn`, run weekly on actions whose window ended):

```
For lever l, stage s, engine group g:
  global prior:      a0 = mean_l * n0_l,  b0 = (1 - mean_l) * n0_l                     (table 2.D)
  outcome of one action: n = treated cells at stage s in group g; k = cells that reached the target stage
                         k_adj = max(0, k - n * b)                                       (b = control background rate, G2)
  global posterior:  a = a0 + sum over sites of min(10, k_adj_site),  b' = b0 + sum over sites of min(10, n_site - k_adj_site)
  site posterior:    a_site = kappa * a / (a + b') + k_adj_site,  b_site = kappa * b' / (a + b') + (n_site - k_adj_site),  kappa = min(a + b', 10)
p_hat = a_site / (a_site + b_site); its 90% Beta interval is shown beside every projection
```

The per-site cap of 10 outcomes in the global pool stops one site from teaching the whole system. Rows live in `seo_ai_rank_priors` with
`source` = evidence / pooled / site. Calibration per lever: the Brier score of projected `p_hat` against outcomes, shown monthly. Honest
limit: with two clients, the evidence priors will dominate for months; the memo says which priors have moved and by how many outcomes.

### 2.H Reporting

**Weekly memo** (`ARL.memo`, stored in `seo_ai_rank_runs.memo_json`; in `on` mode also a section of the AI Growth report and a new
additive callback key `ai_rank` in wave 2). Plain words, no em dashes, every figure with its basis (`_lineage.js`):

1. **What changed**: stage counts per engine this week vs last (core set only); each question that moved a stage, with the evidence.
2. **Why**: the action it is attributed to (only with G1 happened), or "background" when control questions moved the same way.
3. **What we can detect**: the MDE line and the first-appearance requirement (A7).
4. **What we did and what is waiting**: chosen actions with executor and state; blockers with owner and date.
5. **Projected vs real**: for each action whose window ended, projected `p_hat` and gain vs the observed stage move and DiD.
6. **Cost per won question**: AIR-attributed spend (provider USD + client minutes x H) over the last 12 weeks, divided by question x
   engine cells that reached S5 and held 2 weeks after a verified action, net of the control background rate. Shown with its `n`;
   "not yet" when there is no win.
7. **Shadow vs old** (shadow mode, owner only): both plans side by side, overlap, R4 causes addressed.

Shadow memos are exported for the owner by `ai_rank_shadow_report.py` (read-only through the n8n API, writes HTML to the private folder
`~/seo-agent-secrets/ai-ranking-2026-11-05/shadow/`, never into the repo).

### 2.I Integrations (R3 MUST), wave 2

| # | Integration | What AIR gets | Gate | Cost |
|---|---|---|---|---|
| I1 | DataForSEO `ai_optimization/llm_mentions/top_mentioned_pages/live` + `target_metrics/live` | the pages AI cites across the database for the site's topic keywords (source graph nodes `from: 'llm_mentions'`); the client's mention count month on month | `ai_rank_mentions` true AND mode `on`; monthly (`seo_cache` `air:mentions:<site>:<month>`); through `in200_gate`, no node retry, ledger; sandbox probe first | about $0.20-0.40 a site a month |
| I2 | Bing Webmaster `GetQueryStats`, `GetPageStats`, `GetQueryPageStats`, `GetCrawlIssues` (key already set) | Bing positions per query and page (copilot retrieval proxy), crawl issues (S0) | key present; shadow and on; at most 10 calls a site a week | $0 |
| I3 | SerpApi Bing Copilot API | Copilot answers with references for core questions, as AIR evidence only (not written into `seo_ai_answers`, so AI visibility figures do not change) | credential present (`SEO_SERPAPI_API_KEY`, baked as a build flag; no key = the IF is false and no node with the credential runs) AND `ai_rank_copilot` true AND mode `on` | $0.015-0.025 a search; 20 questions weekly is about $1.30-2.15 a site a month (+ plan) |
| I4 | First-party monthly export (Bing AI Performance, Search Console generative AI report) | Microsoft's and Google's own counts, through the existing upload (`seo_ai_imports`) | app site task `ai_export`, monthly (wave 2 app package) | $0 |
| I5 | Fan-out SERP reads (DataForSEO Google organic, through `_serp_cache.js`) | the client's rank for the top fan-out queries of treated questions | `ai_rank_fanout_n` > 0 AND mode `on`; cache hit = $0 | $0.002 a read; cap 20 a week, about $0.09-0.17 a month |
| I6 | Common Crawl CDX (`index.commoncrawl.org`) | site captures in the latest crawl (a training-data presence signal, S0 hint for parametric answers) | shadow and on; monthly | $0 |
| I7 | Brave Search API (SHOULD) | claude retrieval proxy | credential present (`SEO_BRAVE_API_KEY`) | free tier |

**Gemini licence caution.** AIR never calls Gemini grounding directly (its terms forbid storing or analysing grounded results, R3
§2.1b) and excludes `gemini_api` rows (DataForSEO route) from diagnosis and learning until DataForSEO answers in writing. A harness check
greps the generated workflows for `generativelanguage.googleapis.com` and fails if found.

### 2.J Existing AI defects folded in (package P3)

| Finding | Defect | Fix in this programme |
|---|---|---|
| F-08 (High) | AI headline pools pulse answers to retired questions | `AI_Plan.js:220`, `AI_Metrics.js:137-151, 532-536`: keep only pulse answers to the run's panel ids; list the rest as left out; recount questions. Bump `rule_version` so the next delta is refused once instead of comparing two counting rules |
| F-37 | AI Growth sets aside the client's best-cited question as "not a search to target" | `Growth_Plan.js`: never set aside a question whose page is the client's own published page or a page AI cited for it; judge the full question; the missing "ms 365" synonym in `_fit_gate.js` as a separate commit with the app mirror regenerated (`fit_gate_app.py`) and the parity test (owner decision 12) |
| F-38 | "Not updated in 90+ days" on pages never read or with no date | `Growth_Plan.js:144`, `Cadence_Plan.js:440`: use the content-log date, say "no visible date", count recently published pages as fresh |
| F-53 | Headings, prices, places, regulators counted as competitors | `_ai_entities.js:67, 105, 246, 261, 311`: require a business signal, refuse money / dates / headings, treat the client's platforms and directories as non-rivals; a data-only purge of the two bad cache rows (owner-run script, dry run first) |
| F-81 | Every AI report describes the old schedule | `AI_Report.js:204`: generate the method paragraph from the cycle facts |
| F-85 | `serp:*` cache rows have an empty site id, so reuse and prune never match | `build_monitors.py:399, 489, 491`: drop the site-id filter on `serp:` rows (AIR's fan-out proxy depends on this cache) |

---

## 3. Leaders matrix: how AIR exceeds each row

Bar = the best documented implementation in R2 §6 (vendor documents it; not proof that it works). "Exceed" names the mechanism and the
evidence that the mechanism matters. Rows where we do not lead say so.

| # | Capability | Best bar today | Alaventra with AIR | How we exceed it | Evidence it matters |
|---|---|---|---|---|---|
| 1 | Why a question is lost | BrightEdge (who holds the citation) + Gauge ("cited, not named" action type); nobody assigns a stage | Stage S0-S5 per question x engine, with basis and evidence, per retrieval index | The only stage diagnosis per engine; retrieval separated from citation and naming; the lever is chosen from the stage | Exposure moves mention rate 3% -> 49-58% (E20); citation odds fall from 58% at retrieval rank 1 to 14% at rank 10 (AO6) |
| 2 | Opportunity scoring | Gauge (gap x demand, method shown in a panel); Semrush/Adobe projected traffic | Published formula (2.E) with demand, feasibility, stage values, cost and time; a probability with a 90% range | Formula published and its accuracy (Brier per lever) reported monthly; nobody reports projection accuracy | Gauge compares projection with outcome (GG1) but publishes no accuracy |
| 3 | Source gap | Writesonic / BrightEdge / Yext (pages citing competitors) | Source graph with page type, author kind, placeability, influence; rival lists kept for learning | Ranks targets by influence x placeability, not by citation count; refuses to waste outreach on rival lists while learning from them | Listicles are 44-71% of cited pages (M46, E25); self-promoters are left out 69-83% (E26) |
| 4 | Owned content | Gauge 18 articles a month; Profound / AirOps agents | 1 AI page a week at most, aimed at fan-out queries where the client does not rank | **We do not lead on volume and do not try**: rewrites replicated in 3 of 54 settings (E1). We lead on targeting: a page is written only for a cell at S1/S2 whose fan-out queries it can rank for | E1, E2, E20 |
| 5 | Publishing | Gauge (CMS + pull request) | CMS publishing (built 2026-10-18); AIR clock starts at live and indexed | Equal on publishing; ahead on measuring from the real publication | R5 gap 2 |
| 6 | Outreach to cited pages | Leaders stop at the target or the draft | Link Builder sends from the client's mailbox after approval; won only when the page names the client; AIR feeds it ranked placements with probability | Send and verify, and attribute each placement to the questions it moved | E26, EX8 |
| 7 | Community / video | Writesonic thread finder | Human, disclosed steps ranked by engine (Perplexity, AI Overviews), verified by URL | Only levers with engine-specific weights and a verification step; never automated posting | E32, E15 volatility, E41 |
| 8 | Directory / review programme for service firms | Yext (locations only); nobody for B2B services | Directories chosen from the client's own citation data, profile as a verified step, review asks as approved e-mails (later) | The only B2B services directory programme, and chosen per client from evidence, not a fixed list | EX6, EX7, EX8; R4: one directory cited in 22 of 171 answers in one market |
| 9 | Corrections | Peec (own content + ask the source) | Existing correction drafts, ranked by AIR, outcome tested | Equal on the action, ahead on testing whether the correction changed the answers | PE1 |
| 10 | Technical access for answer bots | Adobe (edge pre-render, parity rule, rollback) | Stage S0 per engine (robots, raw HTML, index), fixed at the origin and verified | Fix at the origin (no cloaking risk) and verified per engine; S0 blocks content levers until fixed | E11, E23, AD1 |
| 11 | Index submission per engine | Nobody else | Bing / IndexNow (built) + Bing account step + Bing positions for the copilot proxy | Still alone; now tied to the questions the page targets and verified by retrieval | E13 |
| 12 | Entity / knowledge base | Nobody end to end | Notability gate: not proposed until 3 independent earned mentions | Honest refusal instead of a futile Wikidata push | E36 |
| 13 | Paid AI placements | Evertune Ads, Bluefish | **Not built, by decision** (owner) | Not a goal: outside organic and against "safe tactics" unless the owner asks | R2 §4 |
| 14 | Weekly proposal memo | Profound Aim (ranked opportunities, reasoning) | Memo with what changed, why (with controls), what can be detected, blockers, cost per won question | Adds the control-based "why" and the detectable effect that no memo carries | EX2 |
| 15 | Impact of an action | Gauge (actual vs projected), Adobe (re-run after 2 weeks); no controls | Verification first, then DiD vs pre-registered control questions, placebo in time, exact first-appearance test | The only one with controls, pre-registration and a placebo; refuses "win" claims that fail them | EX2: a 1.82x lift failed its placebo |
| 16 | Learning which levers work | Profound / AthenaHQ claim "self-learning", no method | Beta-binomial pooled across sites with control background subtraction, published, with intervals | Method published, per lever x stage x engine, with calibration; nobody publishes theirs | OT2: the same action +692% on ChatGPT, -37% on Gemini |
| 17 | Statistical honesty | Nobody (R2 row 17) | Ranges, refusals across changed panels (kept), plus MDE and first-appearance requirement in every memo | Tells the client what change the panel can and cannot detect | E45, R1 §6 |
| 18 | Safe tactics | Adobe parity rule only | Refused list with reasons, weight-0 hygiene items, writer prompts untouched | Refuses the tactics leaders showcase (self-ranked lists, agent-only pages) and says why | E26, EX5, AD1 |
| 19 | Approval before anything leaves | Parity across the field | Unchanged: approve each draft, nothing sent without it | Equal | |
| 20 | Cost per action and per win | Nobody | Cost per action before it runs, cost per won question after | Alone | R2 §8.8 |
| 21 | Panel stability and demand | Conductor Custom Market Index (demand-picked prompts) | Frozen core, market from the client's own keywords, demand-weighted, winning questions never retired | Demand plus a freeze rule tied to the client's own wins; nobody protects a winning question | R4 cause 3 |
| 22 | Retrievability as the lead metric | AirOps "Almost Page One" filters | LI1-LI4 per question x engine x index, weekly | The only per-engine retrievability metric tied to the engine's fan-out queries | E9, E14, E20 |

Where we still lag after AIR (closed later or not goals): content volume (row 4, by design), pull-request publishing for repo-based sites,
a community thread finder with drafts, paid placements (row 13, owner decision).

---

## 4. Safety

### 4.1 Flags and defaults

| Setting (new `seo_monitors` column) | Values | Empty / missing | Who writes it |
|---|---|---|---|
| `ai_rank_mode` | `off` / `shadow` / `on` | off | Site Admin `monitors` (`Monitor_Row_Admin.js` validates); `Monitor_Row_Track.js` (the app's "save tracking") **preserves** the stored value and never sets it |
| `ai_rank_reserve` | boolean | false | Site Admin |
| `ai_rank_fanout_n` | 0-50 fan-out SERP reads a week | 0 | Site Admin |
| `ai_rank_mentions` | boolean (LLM Mentions monthly) | false | Site Admin |
| `ai_rank_copilot` | boolean (SerpApi Copilot) | false | Site Admin |

Global kill switch: `seo_cache` row key `air:kill`, value `1` makes `AI Rank Gate` skip every site, without a deploy.

`_monitor_sites.js` exposes them as `settings.rank = { mode, reserve, fanout_n, mentions, copilot }`. Defaults of every existing column
are unchanged.

### 4.2 Shadow-mode contract

In `shadow` AIR:

- **Reads** any table listed in 2.0 and this run's node outputs.
- **Writes only** the five `seo_ai_rank_*` tables.
- **Calls nothing paid.** Free reads allowed only from wave 2: Bing Webmaster stats (I2) and Common Crawl CDX (I6), at most 10 calls a
  site a week. No Claude call.
- **Changes nothing a client or the app sees**: no row in `seo_ai_targets`, `seo_link_prospects`, `seo_ai_prompts`, `seo_listings`,
  `seo_cache`, `seo_ai_growth`; no callback key; no report change; no app screen.
- **Adds at most 30 seconds** to the AI Growth run (harness budget: 5 seconds for two synthetic sites).
- **Fails closed**: every AIR node is `onError: continueRegularOutput`; every row builder returns `{skip: true}` on an error item; the
  chain always reaches `Growth Report`; the run ledger settles as before.
- **Logs the old logic's choice** beside its own (2.E).

### 4.3 Every existing shape touched, and how compatibility is kept

| Shape | Change | Compatibility |
|---|---|---|
| `seo_monitors` | +5 columns (4.1) | `ladder_common.py` MONITORS_COLS + `sync_tables.py`; empty = off; both writers carry the fields |
| `seo_ai_targets` | +3 columns: `origin` (string), `action_id` (string), `live_at` (string) | growth's exact-column writer sets them null; `status` / `kind` / `page_type` / `target_id` vocabulary unchanged; Cadence, `_ai_measure.js`, `_page_watch.js`, app read only existing fields |
| `seo_ai_prompts` | +1 column `core_until` (string) | null everywhere = today's behaviour; `_ai_focus.js` rule change regenerated into `app/shared/src/ai-focus.generated.js` with the parity test |
| `seo_link_prospects` | no new column; new value `origin = 'ai_rank'` | the app labels by `type`; P6 checks `app/shared/src/outreach.ts` for any origin mapping and adds a label if one exists |
| `seo_ai_growth.actions_json` | items with `type: 'ai_rank'` (on only) | the app reads `{priority, type, action, why}` (`data.ts:1675`); P6 checks the web renderer's fallback for an unknown type |
| `seo_cache` | new keys `air:protect:<site>`, `air:mentions:<site>:<month>`, `air:kill`, kind `air` | new prefix only |
| `seo_listings` | new `listing_id` values for on sites | rows unchanged |
| `_ai_measure.js` | an action's time is `live_at` when present | absent = identical |
| `_fit_gate.js` (F-37 synonym) | one synonym | separate commit, app mirror regenerated, all ladder / keyword scenarios unchanged except the named case |
| `_ai_entities.js` (F-53) | stricter business test | accuracy set for entities; changes reported entity counts for every site (a bug fix) |
| AI visibility headline (F-08) | counting rule fixed, `rule_version` bumped | the existing refusal across rule versions handles the one-week break |
| AI Growth workflow | new nodes after `Save AI Growth`; ledger `measured` = `'Growth Metrics|AI Rank Fetched'` | `Growth Report` and the callback unchanged in wave 1; wave 2 adds callback key `ai_rank` (additive) |
| Content Cadence | gated branches for reserve + protect | off sites run today's path; `Cadence_Plan.js` and `cadence.ts` change together with a shared case file |
| Mirrored pairs (R5) | `_cycle.js` / `cycles.ts`: **untouched** (no new job). `_ai_panel.js` cost / `cost.ts`: **untouched** (AIR's own costs are a separate constant set with a shared contract file `harness/ai_rank_cost_cases.json`). `_ai_focus.js` and `_fit_gate.js`: regenerated mirrors with parity tests | |
| Callback stages, cycle jobs | none new | |
| App recommendation ids, site task kinds | none in wave 1; wave 2 adds `air:*` ids and kinds `ai_rank`, `ai_export` (app-first, owner gate) | new ids only, no rename |

### 4.4 Rollout per site

| Step | When (earliest) | What | Gate to the next step |
|---|---|---|---|
| 0 | after wave 1 merges | deploy engine (backup, merge origin/main, node-diff production, not Monday 07:00-12:00 New York, not in a cycle window); every site off | node-diff shows only the AI Growth workflow + P3's files changed; first weekly runs of every site produce identical outputs (golden check on production executions: target / prospect / growth rows unchanged) |
| 1 | same week | **offline replay** of the private production dump (R4 data) through the kits (section 7.2) | owner reads the replay report |
| 2 | next cycle | devaicon.com and techand.ai -> `shadow` (Site Admin `monitors`) | 4 weekly cycles with: 0 writes outside AIR tables, $0 ledger delta, 0 errors, diagnosis accuracy at least 85% on the labelled set, plan stability (top-5 Jaccard at least 0.6 week to week unless a stage changed), owner's blind preference for AIR's plan in at least 2 of 3 weeks |
| 3 | after wave 2 merges + gate | devaicon.com -> `on` (nothing to lose: named 0 times on its current panel), `ai_rank_reserve` per owner decision 3 | 2 weekly cycles with no regression on any existing metric, actions executed or blocked with a reason |
| 4 | +2 weeks | techand.ai -> `on` (its cited pages protected from the first on-run) | protected pages still cited; no ladder rewrite of a protected URL |
| 5 | per owner yes | paid features one by one (`ai_rank_mentions`, `ai_rank_fanout_n`, `ai_rank_copilot`) | spend within section 5 |
| 6 | owner decision | other sites, client-facing steps and recommendations (wave 2 app), marketing and tutorials backlog row | |

### 4.5 Rollback

1. **One site**: set `ai_rank_mode` to `shadow` or `off`. AIR stops writing sinks at once; Growth reclaims `origin = 'ai_rank'` target
   rows on its next run (its writer sets `origin` null); cadence reserve and protect stop (gated); prospect rows already written stay and
   are handled by the Link Builder as any `ai_source` row; proposed questions stay proposed; `core_until` stamps expire within 8 weeks
   (or are cleared by `ai_rank_reset.py --site <id>`, dry run by default).
2. **All sites, no deploy**: `seo_cache` `air:kill = 1`.
3. **Code**: redeploy the previous engine workflows (deploy_engine rollback); the new tables and columns stay unused and harmless.
4. **App** (wave 2): the API rollback image; new site task kinds and recommendation ids are unknown to the old app and are ignored.

---

## 5. Cost per site per month

Provider cost in USD (credits shown to clients are 60 x USD: 3x markup at $0.05 a credit).

| Mode | What runs | Provider cost |
|---|---|---|
| `off` | nothing new (the gate IF only) | $0 |
| `shadow` (wave 1) | stored data only | $0 |
| `shadow` (wave 2) | + Bing stats, Common Crawl CDX (free) | $0 |
| `on`, free parts | AIR targets inside the existing `ai_pages_month` quota, placements inside the Link Builder's weekly drafts, human steps | $0 extra provider cost |
| `on` + `ai_rank_reserve` (AI pages on top of keyword pages) | up to 2 AI pages a month at the calibrated $0.80 | about $1.60 |
| + `ai_rank_fanout_n` = 20 | fan-out SERP reads, half from cache | about $0.09-0.17 |
| + `ai_rank_mentions` | LLM Mentions 2 tasks a month | about $0.20-0.40 |
| + `ai_rank_copilot` | SerpApi Copilot, 20 questions weekly | about $1.30-2.15 (+ SerpApi plan: free 250 searches a month covers about 2 sites; Starter $25 for about 11 sites) |
| **All on** | | **about $3.2-4.3** |

Panel advice (owner decision 5, not part of AIR's cost): moving from 20 questions with a daily pulse (about $9.40 a month, AI_VISIBILITY_SPEC)
to 24 questions with the pulse 2 mornings a week costs about $5-6 a month and buys more statistical power (A8), because the weekly
engines cost about $0.087 a question a month and the full daily pulse about $0.31.

AIR's own paid calls run through the AI Growth run ledger (`measured` includes `AI Rank Fetched`), `_dfs_retry.js`, the in-200 gate, the
SERP cache and `dfs_budget_usd`; no node-level retry on paid nodes (`retry_lint.py`). The app's AI growth autopilot row adds AIR's
monthly cost when the site is `on` (wave 2, shared case file with the engine constants).

---

## 6. Work packages

### 6.0 Overview and merge order

| Wave | Package | Owner of | Model | Depends on |
|---|---|---|---|---|
| 0 | **W0 contract commit** (orchestrator, about 2 hours) | table/column definitions, skeleton files, harness stubs, two lines in `build_monitors.py` | orchestrator | none |
| 1 | **P1 Diagnosis kit** `ARD` | `v5/code/_ai_rank_diag.js`, `harness/scenarios_air_diag.js`, `harness/air_page_types.json` | Opus | W0 |
| 1 | **P2 Decision kit** `ARL` | `v5/code/_ai_rank_learn.js`, `harness/scenarios_air_learn.js`, `harness/ai_rank_cost_cases.json` | Opus | W0 (P1 by contract only) |
| 1 | **P3 Fixes and guards in existing AI logic** | the existing files listed below | Opus | W0 |
| 1 | **P4 Shadow plumbing** | `ai_rank_wiring.py`, new Code nodes, `_monitor_sites.js` field, `Monitor_Row_*`, shadow report + replay tools | Sonnet (Opus if P4 also writes the sinks; recommended Opus) | W0 (P1/P2 by contract only) |
| 2 | **P5 Integrations** | `ai_rank_requests_wiring.py`, request / parse nodes, credentials, env flags | Sonnet | wave 1 merged |
| 2 | **P6 On-mode consumers (engine + app)** | Cadence pair, `_listings.js`, `LB_Assemble.js`, `Growth_Report.js` section, all app work | Opus | wave 1 merged |

**Merge order:** W0 -> P3 -> P1 -> P2 -> P4 -> (shadow deploy possible) -> P5 -> P6 -> (on deploy). After each merge, in the main
worktree: `python3 build_v4.py` (exit code checked, `n8n/.env` present), the full harness in a throwaway `n8nio/n8n:2.41.4` container
(must end `0 failed`), the five lints, and for P3 / P6 the app suites (`npm test` in `node:22-bookworm-slim`, typecheck, build). One
functionality per commit, path-scoped, pushed before the next; diff scanned for secrets (public repo).

**Overlap matrix** (files touched by more than one package): none inside a wave. `build_monitors.py` is touched by W0 (two lines in the AI
Growth section) and P3 (lines 399, 489, 491 in the AI visibility section, distinct hunks). `Cadence_Plan.js` is touched by P3 (line 440,
F-38) in wave 1 and P6 in wave 2 (sequential). `harness/scenarios_v5.js` gets all require lines from W0.

### 6.1 W0: contract commit

Done by the orchestrator before wave 1, so no two packages edit the same file.

1. `ladder_common.py`: the new columns of 4.1 / 4.3 and the five new tables of 2.10 (names and columns exactly as below).
2. `v5/code/_ai_rank_diag.js` and `v5/code/_ai_rank_learn.js`: skeletons exporting the signatures of 6.2 / 6.3, each function returning
   the documented empty shape (`{ unavailable: true }` fields where noted). Inline markers `/*__AI_RANK_DIAG__*/`, `/*__AI_RANK_LEARN__*/`
   registered in `build_monitors.py`'s kit inliner.
3. `ai_rank_wiring.py` with `def wire(G, after_iff, after_save, end, pos)`: skeleton links `after_iff` false and `after_save` to `end`
   (the graph is identical to today). `ai_rank_requests_wiring.py` with `def wire_requests(G, src, dst, pos)`: skeleton `G.link(src, dst)`.
4. `build_monitors.py`: replace `gstep('AI Growth Row', 'Any Growth Row?', 'Save AI Growth', 'Growth Report')` by the call to
   `ai_rank_wiring.wire(G, 'Any Growth Row?', 'Save AI Growth', 'Growth Report', at(60, 3))` and the ledger's `measured='Growth Metrics'`
   by `measured='Growth Metrics|AI Rank Fetched'` (a node that did not run is skipped by `Monitor_Ledger_Settle.js:46`).
5. `harness/fixtures_air.js`: the synthetic fixture generator (6.8), seeded, two archetype sites on `.example` domains.
6. `harness/scenarios_air_{diag,learn,fix,plumb,integ,exec}.js` stubs exporting an empty async function, and six `require` lines at the
   end of `harness/scenarios_v5.js`.
7. Build, harness `0 failed`, golden check that the generated AI Growth JSON is byte-identical except the ledger `measured` string.

### 6.2 P1: Diagnosis kit (`ARD`)

**Scope.** A (market, intent, core panel, arms, MDE), B (stages), C (source graph), evidence roll-up. Pure: no node access, no network,
no clock (time comes in as `now`), n8n sandbox rules (no `URL`, no `defineProperty`, no `structuredClone`). Calls `AVX` (hash, rng, prop),
`FITR` (read-only), `SM` helpers; never edits them.

**Owns:** `v5/code/_ai_rank_diag.js`, `harness/scenarios_air_diag.js`, `harness/air_page_types.json` (labelled synthetic URLs for 2.C).
**Must not touch:** any other `v5/code` file, `ladder_common.py`, build scripts, app.

**Interface** (`const ARD = (() => { ... })();`):

```js
ARD.VERSION                         // 'air-1'
ARD.market({ site, ladders, tracked, monitors, profile, gscCountries })
  -> { cc, lang, location_code, second: { cc, share } | null, conflicts: [{ source, value }], basis: string }
ARD.intentOf(prompt, answers28)     // -> 'recommendation' | 'informational' | 'brand' | 'unknown'
ARD.corePanel({ site, prompts, units60, stored, market, demand, now, cfg })
  -> { core: [{ prompt_id, core_since, core_until, reason }], proposed: [{ prompt, keyword, market, intent, source, reason }],
       extend: [{ prompt_id, core_until, reason }], comparable: boolean, why: string }
ARD.assignArms({ core, stored, seed, now })
  -> [{ prompt_id, arm: 'treated' | 'control', stratum, assigned_at }]
ARD.mde({ q_t, q_c, m, p, rho, alpha = 0.05, power = 0.8 })
  -> { prepost, did, n_eff_t, n_eff_c, p_used, first_appearance_k, basis }
ARD.fanoutOf({ prompt_id, answers8, evidence })  -> [{ query, n, engines: [] }]
ARD.diagnose({ site, prompt, answers8, units60, evidence, access, pages, index, serp, bingStats, brave, brandKnown,
               ourHosts, rivals, engines, now, cfg })
  -> { prompt_id, intent, engines: { [engine]: { stage: 'S0'|'S1'|'S2'|'S3'|'S4'|'S5'|'unmeasured', sub, basis, n, named, cited,
       retrieved, our_rank: { query, pos, index, read_at } | null, evidence: [] } },
       best_stage, parametric_share: { [engine]: number }, no_search: [engine], list_dominated, nobody_named }
ARD.classifyPage({ url, title, host, rivals, ourHosts })   -> { page_type, author_kind, why }
ARD.sources({ answers8, storedSources, mentionsPages, fetched, prompts, values, rivals, ourHosts, now })
  -> [{ url, url_key, host, page_type, author_kind, names_client, rivals_named: [], questions: [], engines: [], cites_28d,
        influence, placeability, placeability_why, contact_email, contact_url, from: 'answers' | 'llm_mentions', last_seen }]
ARD.rollEvidence({ stored, answers8, now })  -> evidence_json string (at most 8 KB per question)
```

Inputs `index`: `{ google: Map(url_key -> state), bing: { in_account: bool|null, crawled: Map(url_key -> iso) }, brave: Map | null,
cc_captures: number | null }`. `serp`: `Map(normalised query -> { results: [{ url, pos }], read_at, location_code })` built from `serp:*`
cache rows.

**Acceptance (harness `scenarios_air_diag.js`, checks AD1-AD12):**
- AD1 market: synthetic site with `profile.country_code` PK, site country AE, two client ladders with UAE / GCC words -> `cc` AE, PK in
  `conflicts`; a spawned rung with a PK place word does not move it.
- AD2 intent: recommendation / informational / brand on fixture answers.
- AD3 core panel: a question that named the client 30 days ago is never dropped and gets `extend`; core frozen 8 weeks; proposed
  questions carry the site market; `comparable` false when the core changed.
- AD4 arms: deterministic for a seed; 2:1 inside every stratum (off by at most 1); stored arms never reshuffled; a new question takes the
  next slot.
- AD5 MDE: reproduces R1 §6 rows within 0.1 point; `first_appearance_k` = 7 for 16 / 8 and 6 for 20 / 10.
- AD6 stages: one fixture per rule of 2.B (robots block, js_only, Bing not in account, Google not indexed, chatgpt retrieved direct,
  ai_mode proxy rank, cited not named, named weak, wrong claim, won, unmeasured, claude `unknown_index`); every cell has `basis` and `n`.
- AD7 parametric share and `no_search`; `nobody_named` informational questions scored on citation.
- AD8 page classification: at least 95% correct on `air_page_types.json` (at least 40 labelled synthetic URLs); rival listicle kept with
  `author_kind` rival and placeability 0.02; a 403 page has `names_client` null.
- AD9 influence and placeability arithmetic on a hand-computed case.
- AD10 sandbox: runs under the harness's `URL` / `defineProperty` / `structuredClone` shims; 50 questions x 7 engines x 30 answers in
  under 200 ms.
- AD11 `rollEvidence` keeps counts older than 8 days, caps at 8 KB, drops entries older than 120 days.
- AD12 `gemini_api` rows ignored in every function.

### 6.3 P2: Decision kit (`ARL`)

**Scope.** D (lever library, refused list), E (score, choose, pre-register), G (verify, outcome tests, learning), H (memo, old-logic
comparison). Pure, same sandbox rules. Uses `AVX.impact` for DiD.

**Owns:** `v5/code/_ai_rank_learn.js`, `harness/scenarios_air_learn.js`, `harness/ai_rank_cost_cases.json` (AIR cost constants shared
with the app in P6). **Must not touch:** anything else.

**Interface** (`const ARL = (() => { ... })();`), consuming P1's shapes exactly as written in 6.2:

```js
ARL.LEVERS        // [{ id: 'L01'...'L17', label, from: ['S0'], to: 'S1', sub: ['blocked'], mult: { chatgpt: 1, ... }, prior: { mean, n0 },
                  //    days: [min, typ, max], usd, effort_min, executor: 'auto'|'approve'|'human', scope: 'question'|'page'|'site',
                  //    sink: 'ai_target'|'prospect'|'listing'|'growth_action'|'site_task'|'protect'|'existing', evidence: ['E20'] }]
ARL.REFUSED       // [{ id, label, why, evidence }]    ARL.ZERO_WEIGHT  // ['schema', 'llms_txt']
ARL.U             // { S0: 0, S1: 0.03, S2: 0.15, S3: 0.25, S4: 0.45, S5: 0.8 }
ARL.value({ prompt, demand, intent, stage })          -> { V, demand_w, intent_w, stage_w, basis }
ARL.feasibility({ prompt, market, diag, reach })      -> { F, market_w, comp_w, reach_w, basis }
ARL.priorOf({ lever, stage, group, priors, site_id }) -> { a, b, mean, lo90, hi90, n, source }
ARL.candidates({ site, diag: [ARD.diagnose], sources: [ARD.sources], arms, stored_actions, settings, now }) -> [candidate]
ARL.score(candidate, { priors, values, feas, weights, H }) -> { gain, cost, score, p_by_cell: [], days, why }
ARL.choose(scored, { capacities, arms, mode, open_actions }) -> { chosen: [action], deferred: [{ action, why }], refused: [{ what, why }] }
ARL.prereg(action, { arms, units60, now }) -> { metric, questions, engines, controls, window_days, t0_rule: 'live_at'|'happened_at',
                                                 projected: { p, gain }, registered_at }
ARL.verify(action, { contentLog, pages, index, listings, outreach, sources, robots, bing, now }) -> { happened: true|false|null, at, evidence }
ARL.outcome(action, { units60, diagNow, diagAtT0, arms, now }) -> { due: boolean, stage_moves: { k, n, b }, did, placebo,
                                                 first_appearance: { t: { k, n }, c: { k, n }, p_fisher, p_binom }, leading, verdict, why }
ARL.learn({ priors, outcomes, now }) -> [prior rows]              // 2.G4, per-site cap 10 in the pool
ARL.memo({ site, diagNow, diagPrev, chosen, open, outcomes, mde, blockers, cost, old, mode }) -> memo object (lineage on every figure)
ARL.compareOld({ chosen, old: { targets, earned, actions } }) -> { overlap, gain_air, gain_old, causes: { air: [], old: [] }, note }
```

`action` shape (also the `seo_ai_rank_actions` row source): `{ action_id: 'air_' + site + '_' + lever + '_' + hash(ref), site_id, lever,
executor, scope, ref: { prompt_id | url | listing_id }, questions: [], engines: [], target_stage, expected: { p, gain, cost, score, days },
prereg, sink, sink_ref }`.

**Acceptance (`scenarios_air_learn.js`, AL1-AL14):**
- AL1 library integrity: every lever has prior, stages, sink, executor and at least one evidence key; the six refused tactics present;
  zero-weight items never chosen.
- AL2 `score` equals a hand computation to 4 decimals.
- AL3 `choose` respects every constraint of 2.E (capacities, holdout, one own page per question, S0 cells only eligibility levers).
- AL4 stage-to-lever: list-dominated S1 cold-start site ranks placement + directory + Bing account above content; S3 ranks L07 first;
  S5 gets L16 protect.
- AL5 pre-registration written before any sink and unchanged by later runs.
- AL6 verify: live + indexed page -> happened; 403 directory -> null; not happened -> never in learning.
- AL7 DiD equals `AVX.impact` on the same input; the placebo flags a fixture with a pre-trend.
- AL8 Fisher: 7 of 7 first appearances on 16 treated / 8 control -> p 0.033 (to 3 decimals).
- AL9 learning: background subtraction, per-site cap, posterior and 90% interval on a hand case; priors move only on due, happened actions.
- AL10 Brier calibration per lever on a fixture.
- AL11 memo: has the seven parts of 2.H, every number carries a basis, no em dash / curly quote / ellipsis character (the copy rule).
- AL12 `compareOld` overlap and causes on a fixture.
- AL13 determinism: same input, same output.
- AL14 archetypes end to end with P1's real kit (runs after P1 merges; skipped with a note before): the cold-start archetype's top 5
  includes directory / list placement and the Bing account step and no content rewrite of the homepage; the retrievable archetype
  protects its cited informational page, gets an own-page action for informational fan-outs, and its winning question is in `extend`.

### 6.4 P3: Fixes and guards in existing AI logic

**Scope.** 2.J (F-08, F-37, F-38, F-53, F-81, F-85) and the on-mode guards: `Growth_Plan.js` (`origin = 'ai_rank'` rows left alone when
`settings.rank.mode === 'on'`; AIR-owned target pages added to key pages), `Earned_Media.js` (skip `origin = 'ai_rank'` domains when on),
`_ai_focus.js` (`core_until` respected) + regenerated app mirror, `_ai_measure.js` (`live_at` preferred). Every guard is a no-op while no
row carries the new values.

**Owns:** `v5/code/Growth_Plan.js`, `Earned_Media.js`, `_ai_focus.js`, `_ai_measure.js`, `AI_Plan.js`, `AI_Metrics.js`, `_ai_entities.js`,
`AI_Report.js`, `_fit_gate.js` (synonym commit only), `Cadence_Plan.js` (line 440 only), `build_monitors.py` lines 399 / 489 / 491,
`app/shared/src/ai-focus.generated.js` and `fit-gate.generated.js` (regenerated, never hand-edited), a purge script
`fix_ai_entities_cache.py` (dry run default), `harness/scenarios_air_fix.js`.
**Must not touch:** AIR kits, `ai_rank_*wiring.py`, `_monitor_sites.js`, `Monitor_Row_*`, `ladder_common.py`, other app files.

**Contract with P4:** P3 reads the site mode as `s.settings.rank && s.settings.rank.mode` (undefined = off; P4 adds the field). P3 reads
`origin`, `core_until`, `live_at` as possibly undefined.

**Acceptance (`scenarios_air_fix.js`, AF1-AF12):**
- AF1 F-08: retired-question pulse answers left out of the headline and listed; question count right; `rule_version` bumped and the
  next delta refused once.
- AF2 F-37: a question whose page is the client's own published or cited page is never `set_aside`; synonym commit: `fit-gate.parity`
  test green, every ladder / keyword scenario unchanged except the named case.
- AF3 F-38: unread / undated pages say "no visible date"; a page published 10 days ago is fresh.
- AF4 F-53: a synthetic labelled entity list (headings, prices, places, regulators, directories, real rivals): precision at least 95%,
  real rivals kept; purge script dry run lists exactly the matching cache rows.
- AF5 F-81: the method paragraph follows the cycle facts.
- AF6 F-85: `serp:*` rows with an empty site id are reused and pruned.
- AF7 Growth guard: mode off -> `Growth_Plan.js` output byte-identical to the pre-change code on S29 / AI Growth fixtures; mode on ->
  an `ai_rank` row is absent from growth's target rows; back to off -> growth writes the row with `origin` null.
- AF8 Earned Media guard: same three cases.
- AF9 focus: `core_until` in the future -> never retired; no `core_until` -> AI-FOCUS scenarios unchanged; `ai-focus.parity` test green.
- AF10 `_ai_measure.js`: `live_at` used when present; otherwise impact rows identical.
- AF11 key pages include AIR-owned target pages only when on.
- AF12 full harness `0 failed`; five lints; app shared tests green.

### 6.5 P4: Shadow plumbing

**Scope.** Everything that makes AIR run in the AI Growth workflow and write its tables, plus the on-mode sink row builders (written now,
exercised only when a site is on): settings field, writers that preserve it, nodes, wiring, row builders with exact columns, saves,
the shadow report and the offline replay tool.

**Owns:** `ai_rank_wiring.py` (fills `wire`), `v5/code/_monitor_sites.js` (the `settings.rank` object only), `v5/code/Monitor_Row_Admin.js`
and `Monitor_Row_Track.js` (carry / validate the five fields), new Code nodes `v5/code/AI_Rank_Gate.js`, `AI_Rank_Plan.js`,
`AI_Rank_Rows.js` (one builder per table, reading `$('AI Rank Plan')` explicitly), `ai_rank_shadow_report.py`, `ai_rank_reset.py`,
`harness/ai_rank_replay.js`, `harness/scenarios_air_plumb.js`, `harness/table_cols.json` entries for the new tables.
**Must not touch:** kits, P3's files, `build_monitors.py` (beyond what W0 did), `ladder_common.py` (beyond W0), app.

**Nodes `wire()` adds** (all `onError: continueRegularOutput`, IFs on `{{ !$json.skip && !$json.error }}`):
`AI Rank Gate` (inlines `_monitor_sites.js`; reads `air:kill`; one item per site in shadow / on: `{ site_id, domain, mode, rank }`) ->
`Any AI Rank?` (false -> `end`) -> six `Ensure AI Rank ... Table` nodes -> loads (`Load AI Rank Questions`, `Load AI Rank Actions`,
`Load AI Rank Sources`, `Load AI Rank Priors`, `Load AI Rank Runs` (84 days), `Load Index Pages (Rank)`, `Load SERP Cache (Rank)` (kind
`serp`), `Load AI Daily (Rank)` (60 days), `Load Listings (Rank)`, `Load Link Outreach (Rank)`, `Load Link Prospects (Rank)`) ->
`ai_rank_requests_wiring.wire_requests(G, 'Load Link Prospects (Rank)', 'AI Rank Plan', pos)` -> `AI Rank Plan` -> row builders and saves:

| Builder -> save | Table, operation, key | Modes |
|---|---|---|
| `AI Rank Run Row` -> `Save AI Rank Run` | `seo_ai_rank_runs` insert | shadow, on |
| `AI Rank Question Rows` -> `Save AI Rank Questions` | `seo_ai_rank_questions` upsert (`site_id`, `prompt_id`) | shadow, on |
| `AI Rank Action Rows` -> `Save AI Rank Actions` | `seo_ai_rank_actions` upsert (`action_id`) | shadow (status `shadow`), on |
| `AI Rank Source Rows` -> `Save AI Rank Sources` | `seo_ai_rank_sources` upsert (`site_id`, `url_key`) | shadow, on |
| `AI Rank Prior Rows` -> `Save AI Rank Priors` | `seo_ai_rank_priors` upsert (`prior_id`) | shadow, on |
| `AI Rank Target Rows` -> `Save AI Rank Targets` | `seo_ai_targets` upsert (`target_id`), all AI_TARGETS_COLS | on |
| `AI Rank Prospect Rows` -> `Save AI Rank Prospects` | `seo_link_prospects` upsert (`site_id`, `prospect_domain`, `type`), all PROSPECT_COLS, existing contacts / status kept from the stored row | on |
| `AI Rank Prompt Rows` -> `Save AI Rank Proposed` / `Set Core Until` | `seo_ai_prompts` insert (status `proposed`) / update `core_until` by `prompt_id` + `site_id` | on |
| `AI Rank Cache Rows` -> `Save AI Rank Cache` | `seo_cache` upsert (`key`) | on |
| `AI Rank Growth Patch` -> `Patch AI Growth Actions` | `seo_ai_growth` update `actions_json` by `site_id` + `run_id` (old items kept, at most 3 added) | on |

The last save links to `end` (`Growth Report`). In shadow, the on-only builders return `{skip: true}`.

**`AI_Rank_Plan.js` output item per site:** `{ site_id, domain, mode, run_id: 'air_' + yyyymmdd + '_' + site, air: { market, panel, diag,
sources, chosen, deferred, refused, outcomes, priors, memo, compare, cost }, error: '' }`. It reads the old logic's choice from
`$('Growth Plan')`, `$('Earned Media')`, `$('Growth Metrics')`; ladder keywords through `FITR`; never writes.

**Acceptance (`scenarios_air_plumb.js`, AP1-AP12):**
- AP1 settings: missing / empty -> off; Admin validates the five fields (bad value refused with a message); Track keeps a stored
  `ai_rank_mode` when the app saves tracking (the row is never nulled).
- AP2 **golden off**: the AI Growth replay (S29 fixtures) with every site off: every pre-existing node's output byte-identical to the
  pre-change build; only `AI Rank Gate` and `Any AI Rank?` added to the executed set; no row in any new table.
- AP3 shadow: rows only in the five AIR tables, exact columns (`table_cols.json`); 0 rows to targets / prospects / prompts / cache /
  growth; 0 paid requests; ledger settle unchanged.
- AP4 on: target rows use the existing vocabulary and id format with `origin` `ai_rank`; prospect rows type `ai_source` (editorial and
  directory pages only, never rival lists unless opted in); proposed prompts; `core_until` update touches only that column; growth patch
  keeps old items; protect cache row shape.
- AP5 isolation: `AI Rank Plan` throws -> `Growth Report` and the callback still produced, ledger settled.
- AP6 time: the AIR chain adds at most 5 s for two synthetic sites.
- AP7 the run row carries the old choice and `compare`.
- AP8 lints: `gate_lint` (ladder reads gated), `lineage_lint`, `state_lint` (every action status has an exit: `expired` after window +
  14 days), `retry_lint`, `url_lint`.
- AP9 `sync_tables.py --dry-run` against `fake_n8n_api.js` lists only new tables and new columns.
- AP10 `ai_rank_replay.js` runs on a fixture directory (`IN_DIR`, `OUT_DIR` env), no network, prints no secret, writes the memo HTML.
- AP11 node diff: only the AI Growth workflow changed among the workflows P4 builds.
- AP12 kill switch: `air:kill = 1` -> gate skips every site.

### 6.6 P5: Integrations (wave 2)

**Scope.** 2.I: I1, I2, I3, I5, I6, I7 request planning, HTTP nodes, parsers, credentials, build flags. I4 (the export site task) is P6.

**Owns:** `ai_rank_requests_wiring.py` (fills `wire_requests`), `v5/code/AI_Rank_Requests.js` (planner: what to read for each site,
respecting mode, flags, caps, cache), `v5/code/AI_Rank_Fetched.js` (parses every answer into `{ site_id, cost_usd, mentions_pages,
target_metrics, bing_stats, copilot, serp_reads, cc_captures, brave }` per site; `cost_usd` read once per gated node from `__dfs`),
`sync_credentials.py` entries (`SEOcredSerpApi01` query auth `api_key` from `SEO_SERPAPI_API_KEY`; `SEOcredBraveApi1` header
`X-Subscription-Token` from `SEO_BRAVE_API_KEY`), `env_settings.py` build flags `SERPAPI_ENABLED`, `BRAVE_ENABLED`, `n8n/.env.seo.example`
lines, `harness/fixtures_air_integ.js` (shapes from DataForSEO's free sandbox, Bing docs, SerpApi docs), `harness/scenarios_air_integ.js`.
**Must not touch:** kits (P5 hands its parsed shapes to `AI_Rank_Plan.js` through `$('AI Rank Fetched')`; P4's plan already reads that
node inside try/catch), P3 / P4 / P6 files.

**Contract:** paid DataForSEO calls through `G.in200_gate` (dfs_gate) with no node-level retry; free calls use `retry_lint.RETRY`; SERP
reads through `_serp_cache.js` and write the reading back to `seo_cache` with the site id; LLM Mentions monthly marker
`air:mentions:<site>:<yyyy-mm>`; nothing paid in shadow; Copilot results never written to `seo_ai_answers`.

**Acceptance (AI1-AI10):** planner skips every paid read in shadow and when a flag is off; LLM Mentions request bodies equal the
sandbox-confirmed shape and run monthly only; SERP cache hit costs $0, a miss one read; Bing stats parsed into a positions map; no key ->
SerpApi and Brave nodes present but never executed and the import does not fail; Common Crawl "No Captures" -> 0; the ledger settle
includes `AI Rank Fetched` cost once per task id; credentials created only when the variable is set, and no secret is printed; a grep of
every generated workflow finds no `generativelanguage.googleapis.com`; full harness `0 failed`.

Paid confirmation of new request fields happens only in the owner-approved live checks (7.3), never during the build.

### 6.7 P6: On-mode consumers (engine + app, wave 2)

**Scope.** Everything that reads AIR's on-mode output outside the AI Growth workflow, and every app change.

**Engine (owns):** `Cadence_Plan.js` (reserve + protect branches, gated; F-38 line already merged by P3), `build_site_tracker.py` (Content
Cadence: `Load AI Rank Protect (Cadence)` = `seo_cache` kind `air`), `_listings.js` (service-firm entries with `air: true`, included only
for on sites; `siteKind` mixed agency + software, gated), `LB_Assemble.js` (likelihood from `score` for `origin = 'ai_rank'` rows),
`Growth_Report.js` (AIR section when the site is on; callback key `ai_rank` = the memo summary, additive), `harness/air_cadence_cases.json`
(shared with the app), `harness/scenarios_air_exec.js`.

**App (owns):** `app/server/src/services/cadence.ts` (mirror of the reserve + protect rules, same case file), `app/shared/src/tables.ts`
(types for new columns and tables), `app/server/src/services/data.ts` (reads; an admin-only shadow view through the n8n Data Table API),
`app/shared/src/site-tasks.ts` + daily check jobs (kinds `ai_rank`: key `ai_rank:<lever>:<ref>`, payload `{ lever, ref, what, why, check }`;
`ai_export`: monthly, done when `seo_ai_imports` holds this month's `bing_ai` and `gsc_ai` rows), `app/server/src/services/recommendations.ts`
(ids `air:<lever>:<ref>`, only for on sites), `app/shared/src/autopilot.ts` (AI growth row adds AIR's monthly cost when on, from
`ai_rank_cost_cases.json`), the `ai_rank` report renderer, guides for each human step, Site Admin passthrough of the five fields for
platform admins only, marketing capability + changelog entries and a `TUTORIALS_BACKLOG.md` row, all held until the owner offers `on`
to clients.
**Must not touch:** kits, P3 / P4 / P5 files, `_cycle.js` / `cycles.ts`, `AIP` cost / `cost.ts`.

**Acceptance (AE1-AE8 + app):**
- AE1 cadence reserve: on + reserve -> the top `ai_rank` target is written at levels 2 and 3, on top, at most 1 a week, inside
  `ai_pages_month`; off -> S24 / S29 cadence scenarios byte-identical; `cadence.ts` passes the same `air_cadence_cases.json`.
- AE2 protect: a ladder rung, a striking-distance and a decay refresh aimed at a protected URL become suggestions with the reason; off ->
  identical.
- AE3 listings: on agency / mixed site gets the service-firm directories; off -> today's list exactly.
- AE4 Link Builder: `ai_rank` rows ranked by their score; other rows unchanged.
- AE5 report / callback: AIR section and `ai_rank` key only for on sites; off -> report HTML identical.
- AE6-AE8 app: typecheck, `npm test` (shared, server, web), build; new site task kinds pass the shared contract tests; an old app build
  ignores the new kinds and ids (backward compatibility test); browser pass of the AI visibility page for an off site shows no change.

### 6.8 Fixtures (public repo: synthetic only)

`harness/fixtures_air.js` (W0) generates, from a seed, two archetype sites on reserved domains:

- `nova-ai.example`: cold-start custom-software firm, market AE with a profile country that disagrees, list- and directory-dominated
  recommendation answers, not in Bing's account, one page in Google, robots fixed in week 2, 0 named.
- `acme-erp.example`: retrievable ERP partner, ranks 20-50 for commercial fan-outs, two informational pages cited in Google engines, a
  winning question the old panel would retire, a ladder rung aimed at its cited page.

Both with 10 weeks of answers on 7 engines (`retrieved_json`, `cited_json`, `fanout_json`, entities), units, pulse days, SERP cache rows,
index rows, listings, outreach rows and fetched pages. Rival and directory hosts are invented `.example` hosts plus a few public directory
hosts (clutch.co, g2.com) used only as classification inputs. No real client answer, URL, contact or competitor appears in any fixture.

### 6.9 New tables (exact columns, W0 writes them in `ladder_common.py`)

```
seo_ai_rank_runs       site_id, domain, run_id, checked_at, mode, rule_version, panel_json, diag_json, sources_json, candidates_json,
                       chosen_json, old_json, compare_json, memo_json, cost_json, learn_json, exec_id, error
seo_ai_rank_questions  site_id, domain, prompt_id, question, intent, market, core, core_since, core_until, arm, stratum, value, demand,
                       demand_basis, feasibility, stage_json, best_stage, parametric_json, evidence_json, first_named_at,
                       last_named_at, last_cited_at, updated_at, rule_version
seo_ai_rank_actions    action_id, site_id, domain, lever, executor, scope, ref, questions, engines, target_stage, status, sink,
                       sink_ref, expected_json, prereg_json, happened_at, verify_json, outcome_json, learned_at, mode, run_id,
                       created_at, updated_at
seo_ai_rank_sources    site_id, domain, url_key, url, host, page_type, author_kind, names_client, rivals_named, questions, engines,
                       cites_28d, influence, placeability, placeability_why, contact_email, contact_url, source_from, first_seen,
                       last_seen, checked_at
seo_ai_rank_priors     prior_id, lever, stage, engine_group, scope, alpha, beta, n_outcomes, prior_alpha, prior_beta, source,
                       updated_at, rule_version
```

Types: `*_json`, ids, dates and labels are strings; `core`, `names_client` booleans; `value`, `demand`, `feasibility`, `cites_28d`,
`influence`, `placeability`, `alpha`, `beta`, `n_outcomes`, `prior_alpha`, `prior_beta` numbers. Action `status`: `shadow`, `proposed`,
`queued`, `in_progress`, `done`, `verified`, `not_happened`, `expired`, `refused`; every one has an exit (`state_lint.py`). Sizes: at
most 300 action rows and 200 source rows per site (oldest `expired` / unseen-for-120-days pruned by `AI_Rank_Rows.js`); a run row at
most 60 KB.

New columns on existing tables (W0): `seo_monitors` + `ai_rank_mode`, `ai_rank_reserve`, `ai_rank_fanout_n`, `ai_rank_mentions`,
`ai_rank_copilot`; `seo_ai_targets` + `origin`, `action_id`, `live_at`; `seo_ai_prompts` + `core_until`. Applied with `sync_tables.py`.

---

## 7. Evaluation plan

### 7.1 Offline harness (synthetic, every package)

Scenarios AD, AL, AF, AP, AI, AE above, on `fixtures_air.js`. The full harness must end `0 failed` after every merge, with the five lints.
Two cross-package checks run after P4 merges: AL14 (archetype plans with the real P1 kit) and an end-to-end AI Growth replay of 10
synthetic weeks in shadow then on, asserting the R4 failure patterns are fixed on the archetypes: the winning question is never retired,
the market follows the client's keywords, the reserved AI page is written, the cited page is not rewritten by a ladder rung, rival lists
are learned from and not pitched, and the memo states the MDE.

### 7.2 Shadow run on production data

**Stage 1: offline replay (read-only, $0, no production write).** Using the R4 dump already in
`~/seo-agent-secrets/ai-ranking-2026-11-05/data/` (and a fresh GET-only dump if the owner allows, as in R4), run
`harness/ai_rank_replay.js IN_DIR=<private dump> OUT_DIR=<private>/replay` for the three recorded weeks of both sites. Outputs stay in
the private folder. Checks:

- **Diagnosis accuracy**: a labelled set of 60-80 question x engine cells (both sites, all engines), labelled by hand from the dump
  (answer text, retrieved and cited URLs, SERP readings, index rows), stored privately. Target: at least 85% exact stage, at least 95% on
  the S0-S1 vs S2-and-above boundary.
- **R4 causes covered**: devaicon.com's top 5 actions include the Bing account step and at least two directory / editorial-list
  placements from its own cited pages, and no homepage rewrite; techand.ai's plan protects its cited informational page, keeps its
  winning question in the core, and targets informational fan-outs; the market of devaicon.com resolves to its keywords' market.
- **Old vs new**, side by side, read by the owner.

**Stage 2: live shadow (production, $0, writes only the AIR tables).** Four weekly cycles for both sites (4.4 step 2), with the weekly
`ai_rank_shadow_report.py` export to the private folder, row-count diffs proving no write outside AIR tables, the ledger delta, runtime,
errors, and plan stability. A blind review in weeks 2-4: the owner (or two Claude judges, as in the page-quality waves) compares the old
and AIR plans without labels.

### 7.3 Paid live checks (each needs the owner's yes)

| Check | What it proves | Cost |
|---|---|---|
| DataForSEO sandbox probes of `top_mentioned_pages` / `target_metrics` | response shapes | $0 |
| One live LLM Mentions call per site (both endpoints) | request fields accepted live (the sandbox does not validate fields) | about $0.50 |
| 20 fan-out SERP reads per site through the cache | the retrieval proxy on real readings | about $0.08 |
| SerpApi Copilot, 20 questions per site (free plan if the owner opens one) | Copilot evidence; agreement with Bing AI Performance exports | $0 (free plan) or about $1 |
| One AIR-chosen AI page per site through the reserved slot | the on-mode execution rail end to end | about $1.60 |
| **Total** | | **about $2.2-3.2** |

### 7.4 Success metrics

Clock starts when a site goes `on` (earliest about 2026-12-07 for devaicon.com after 4 shadow cycles; techand.ai 2 weeks later).

| Week | Execution | Leading indicators | Outcomes | Learning and honesty |
|---|---|---|---|---|
| 4 | at least 60% of chosen actions done or blocked with an owner and date; devaicon.com in Bing Webmaster; at least 3 directory profiles confirmed across both sites; at least 1 AIR page per site live and indexed | LI2 (indexed) up on treated questions; diagnosis accuracy still at least 85% on a re-labelled sample | no claim expected; memo shows MDE and first-appearance `k` | 0 claims of "worked" without G1 + G3 |
| 8 | at least 75% executed; at least 2 placements on cited pages verified (names the client) | LI1 (retrievable) +15 points on treated vs control (DiD, range shown); LI3 (on-source) at least 3 cited pages naming the client | techand.ai's cited rate on protected pages not below its pre-on level; at least 1 first appearance for devaicon.com on a treated question | first prior updates shown with `n` |
| 12 | backlog of open human steps under 8 per site | LI1 and LI4 DiD ranges reported | named (or cited) rate DiD with its range on the pooled two sites, or the first-appearance test, reported whatever the result; cost per won question reported (or "no win yet") | Brier calibration per lever; the memo says which priors moved |

A failed target is reported as failed, with the reason (not executed, too early, or no effect). The programme does not move the goal
posts after the fact: every target above is pre-registered here.

---

## 8. Owner decisions needed

1. **Build go-ahead** for W0 + six packages in two waves, with the merge order of 6.0.
2. **Rollout order**: devaicon.com `on` first (nothing to lose), techand.ai 2 weeks later (cited pages to protect). Or both together.
3. **AI pages for AIR targets** (`ai_rank_reserve`): (a) on top of keyword pages, up to 2 a month, about $1.60 a site a month
   (recommended: the reports already promised them); (b) inside `pages_per_week` (cost neutral, ladders slower); (c) no reservation and
   AIR pages stay suggestions (then the reports must stop promising them).
4. **Paid data, one yes each**: LLM Mentions (about $0.40 a site a month), fan-out SERP reads (about $0.17), a SerpApi account and key
   (free 250 a month, or Starter $25), a Brave Search key (free tier).
5. **Panel size and pulse**: for example 24 questions with the pulse 2 mornings a week instead of 20 with a daily pulse (cheaper and more
   statistical power; one-time break in week-on-week comparison).
6. **Holdout**: one question in three held out from question-specific actions for 12 weeks, then rotated (needed to prove anything).
7. **Client time value** `H` for cost per action (default $25 an hour) and the cap of 3 new human steps a week per site.
8. **Rival-written lists**: learn only (default), or allow pitching chosen pages with your approval each time.
9. **Gemini API engine**: file the written question to DataForSEO about analysing `gemini/llm_responses` results; until answered AIR
   ignores that engine.
10. **Client-facing release**: when AIR's steps and recommendations appear to clients (wave 2 app), and the marketing page, changelog and
    tutorials backlog row that go with it.
11. **Client asks to send now** (they block the biggest levers whatever we build): connect a mailbox (both clients), add devaicon.com to
    Bing Webmaster, create the directory profiles the answers cite, finish the open 301 merge, declare competitors.
12. **F-37 synonym in the fit gate**: approve it as a bug fix (it also affects the Keyword Check and ladders for every site), or ship
    only the AI Growth part.
13. **Deploy windows**: engine first (not Monday 07:00-12:00 New York, not inside a cycle window), API and web after, with backups, as
    in `DEPLOY.md`; the web merge stays yours.
