# KI design: competitor analysis + buyer keyword research (2026-11-08)

Inputs: R1 engine audit, R2 app audit, R3 production outputs, R4 market + methods, R5 DataForSEO shapes and prices, the owner's
material (`OWNER_MATERIAL.md`, used as material, corrected where R4 found it wrong). Every section names the evidence it rests on.

## 0. The decision in one screen

1. **Two new capabilities**, each with its own page, credit price and run, usable without the pipeline:
   **Competitors** (mode `competitors`) and **Keyword research** (mode `keyword_research`). They run in ONE new engine workflow
   (`SEOagentKIntel1`, "Keyword Intelligence"), reached through the existing API front door, so the app's run lifecycle (quote,
   lock, ledger, callback, watcher, refund) is reused unchanged and the 800-node main workflow is not touched.
2. **One stored picture per site and market**: the competitor set (`seo_ki_competitors`), the keyword universe with sources, labels,
   clusters, scores and verdicts (`seo_ki_keywords`), gaps with their action (`seo_ki_gaps`), and one row per run (`seo_ki_runs`).
   Every number carries `basis` (measured / provider_estimate / modelled / inferred), `source` and `fetched_at`.
3. **The method is R4 section 6**, not the owner's additive score: competitors from the client's own service x market results pages
   (domain overlap only for sites with >= 50 ranked keywords), every domain classified (direct, adjacent, principal, directory, list,
   platform, government, job board, media), one head-based clustering rule (3 shared of the top 10), intent and stage from what ranks,
   a gated multiplicative opportunity score with a printed range, and one verdict vocabulary: **Go / Takes a few months / Hard for your
   site now**. The owner's own example shows why: with the additive formula "dynamics 365 jobs dubai" (60) beats "business central
   partner abu dhabi" (59.5); with the gated one the jobs query is 0 and the partner query 43 (R4 6.4).
4. **What people search to buy a service** comes from evidence, not a model's guess: Search Console queries first, then People Also
   Ask, related searches and forum threads we already buy and throw away (R1 #2), autocomplete with service modifiers, Labs ideas /
   suggestions on service x market seeds, the chosen competitors' ranked keywords and the gap. A keyword with no measured volume but
   two independent sources is kept as "evidenced, volume not measured" instead of being deleted (R1 #3).
5. **Rollout per site: Off / Trial / On** (`seo_monitors.ki_mode`, set by platform admins only, as `ai_rank_mode`). Off = today
   byte-identical. Trial = runs on demand, results visible to platform admins only, nothing else reads them. On = the client sees the
   pages, and the existing paths (discovery, setup research, Keyword Check alternatives, ladder pool, cadence topic choice, AI panel
   suggestions, Link Builder backlink gap, full report, weekly report) read the stored picture. Kill switch `seo_cache ki:kill` (fails
   closed to Off behaviour).
6. **The production failures R3 found are fixed in the On path** (market check, Search Console first, services as a list, list SERPs
   get list actions not service pages, AVOID stops a ladder page, one cluster one URL, real competitors). They change what Off sites get
   only after the owner compares Trial results and says yes (same rule as AIR).

## 1. What exists and is reused (R1 section 5, R2 section 3)

| Need | Reuse | Change |
|---|---|---|
| run lifecycle | app mode registry, `schemas.ts` / `payload.ts`, quote under company lock, `seo_run_ledger` reserve + settle, run watcher `WATCHED`, callbacks, reports, refunds | 2 new modes, new workflow id in `WATCHED`, `_cost_cal.js` entries |
| site model | `_site_model.js` (services, NAP, pages, facts), `seo_sites`, `seo_pages` | services read as the confirmed list (fix of R3 #4 in the kit) |
| fit + gates | `_fit_gate.js` (fitGate, fitMarket, fitCareer, other brands, government) | used as the hard gate; KI tables join `gate_lint` pairs |
| competitors | `_competitors.js` CMP classifier, `_rivals.js`, `OK.sellsSame` | extended to the 9 classes; never drops platforms (R5 #10: `exclude_top_domains: true` hides them today) |
| results pages | `_serp_cache.js` (day cache in `seo_cache serp:*`, PAA / related / forums / AIO kept), `_serp_obs.js`, `_rank_serp.js` | read PAA / related / forums as candidates at $0 |
| clustering | `_kw_inputs.js` `serpClusters` | one head-based rule, 3 of top 10, config; ladders keep their own rule until On (B2-7 closes in the On path) |
| reach | `_reach.js` | Win model uses GSC positions first; "unknown" instead of a constant reach (R3 #3) |
| GSC | `seo_query_history`, `_gsc_queries.js`, `KWI.gscSeeds` | seeds + striking distance + measured demand |
| AI panel | `seo_ai_prompts`, `seo_ai_visibility` rivals, `_ai_entities.js` | competitor SOV view + buyer questions proposed for approval |
| backlink gap | Backlink Monitor `domain_intersection`, `seo_link_prospects` | KI gap rows of type `backlink` point at the chosen set |
| retries / money | `_dfs_retry.js` (in-200 gate, no node retry on paid multi-item nodes), task-id dedupe, `free_only` | same rules |
| UI | `SummaryHero`, `MetricCard`, `InsightItem`, `RankedBars`, `PositionPill`, `DifficultyBadge`, `KeywordChoiceCard`, `SerpPanel`, `TrafficPotential`, `DataTable` | DataTable gains column filters + CSV export |

## 2. Competitors (mode `competitors`)

Input: site (verified), market (the site's main country; a different country is refused with the consistency message, R3 #1),
optional declared competitors (kept, never auto-removed), optional seed keywords.

1. **Seeds (service x market)**: from the confirmed services list: `{service} {city|country}`, `{service} company {city}`,
   `{product} partner {country}`, `best {service} {city}`; + non-brand GSC queries with impressions (top 50, fit-gated); + tracked
   keywords; + ladder heads. Each seed passes `fitGate` (no other brands, no government, no jobs). Cap 20 seeds (config).
2. **Results pages** (measured): read the top 10 of each seed through the day cache (`serp:*`), live advanced, depth 10.
3. **Domain overlap** (provider estimate): Labs `competitors_domain` on the client domain, only when the client has >= 50 ranked
   keywords (R4 6.1 #3: fails for small sites); weight 0.5. `exclude_top_domains: false` (platforms are tagged, not hidden).
4. **AI-answer competitors** (measured): domains named or cited for service questions in the stored AI panel answers.
5. **Classify** every domain (rules first: known lists for platforms / directories / principals / government / job boards / media,
   homepage + up to 2 service pages read through the SSRF-guarded reader as untrusted text; Claude Haiku only as a tie-break with a
   confidence; < 0.6 -> "needs your review"): `direct` | `adjacent` | `principal` | `directory` | `publisher_list` | `platform` |
   `government` | `job_board` | `media`. Text fragments and search engines are never stored (R3 #9: google.com and "AED 300k-450k"
   were stored as competitors).
6. **Score** direct + adjacent only: `Comp = 0.45 SERPshare + 0.20 TopicSim + 0.15 GeoMatch + 0.20 AIshare` (weights in config),
   `SERPshare(d) = sum_k w_k x CTR(pos_dk) / sum_k w_k x CTR(1)`, `w_k` = the seed's click demand x stage weight. Size ratio is a TAG
   (`peer` / `leader` / `smaller` / `out_of_reach` when > 20x keywords and > 10x referring domains), not a score input.
7. **Output**: 10-20 rows with reasons ("in the top 10 for 9 of 14 of your service searches in the UAE"); the client picks up to 5
   (`chosen`), the rest are the watchlist; declared competitors start chosen. Directories and lists become **listing / list-placement
   actions** (Link Builder, AI growth), platforms "formats that win these searches". Stable across runs: a domain keeps its row,
   `first_seen` / `last_seen`, and leaves the set only after two runs without evidence.
8. **Profile per chosen competitor** (A2 / A5 / A10, cheap): Labs `domain_rank_overview` (keywords, estimated traffic), `ranked_keywords`
   (limit 300, ordered by etv; brand / non-brand split by the competitor's brand tokens), top pages (ranked keywords grouped by URL,
   summed etv, page type from URL + title), referring domains (Backlinks summary), publishing pace (sitemap lastmod, free). Title / H1
   use of the keyword is read only for the top 20 rows, from the day cache or the page reader.

## 3. Keyword research (mode `keyword_research`)

1. **Discover** (B2), each row keeps every source that produced it: `gsc` (queries with impressions, 90 days), `paa`, `related`,
   `forum` (from results pages already read), `autocomplete` (SERP autocomplete on service x market seeds with modifiers: company,
   partner, cost, pricing, best, vs, near me, city names), `labs_ideas` / `labs_suggestions` / `labs_related` (on the seeds),
   `competitor` (chosen set's ranked keywords), `gap` (page_intersection: >= 2 chosen competitors rank, client does not), `tracked`,
   `ladder`. No Reddit / Quora scraping (R4 6.8, R5 #7).
2. **Gate before money** (R1 #4: volume decided before fit): normalise, dedupe close variants, `fitGate` + market + career + other
   brand + government, then a pre-score that INCLUDES fit; only the top N (config 300) are enriched, only the top M (config 60) get a
   results-page read.
3. **Enrich** (B3): Labs keyword data for volume / CPC / KD / trend (provider_estimate); Google Ads search volume for rows Labs does
   not know (bucketed, labelled); Labs `search_intent` as one signal; `bulk_traffic_estimation` for the top URL's traffic (TP).
4. **Read results pages** for the top M (day cache first; cost 0 on a hit): top 10 URLs, page types, PAA, AIO present, local pack.
5. **Cluster** (B4): head-based, no chaining, sorted by click demand; join the first head with >= 3 shared top-10 URLs (config
   `T_page`), hub at >= 2 (`T_hub`); host-agnostic URL normalisation; deterministic tie-break by text. Identical top 10 never split,
   zero overlap never merged (owner acceptance).
6. **Intent and stage** (R4 6.5): page-type distribution of the top 10 first, strong words second, Labs intent third, Haiku tie-break
   last with a confidence (< 0.6 -> review list). Stages: `hire` 1.00, `compare` 0.90, `solution` 0.65, `problem` 0.50, `info` 0.30.
   Evidence shown: "7 of 10 results are company service pages, 2 directories, 1 list -> people looking to hire".
7. **Score** (B5 / B6, R4 6.4, weights and anchors in config, every factor 0..1, monotone):
   `Score = 100 x Gate x Fit x StageW x (0.40 Demand + 0.35 Win + 0.15 Value + 0.10 Gap)`;
   Demand = AIO-adjusted click demand of the cluster (GSC impressions beat provider volume; floor 0.15 when >= 2 independent sources
   and no volume); Win = `0.35 Strength + 0.25 ExistingRank + 0.20 Topical + 0.20 WeakSpots` (GSC position first; weak spots = thin,
   stale > 2 years, off-intent, low authority; UGC weak only for hire / compare intent); Value = owner value per service else CPC;
   Gap = share of chosen competitors in the top 10 (+0.5 if a competitor is cited in AI answers for it). Score printed with a range
   from the low / high ends of modelled inputs; "low confidence" when the range is > 25 points; rank by midpoint.
8. **Verdict** from Win: >= 0.60 **Go**, 0.35-0.60 **Takes a few months**, < 0.35 **Hard for your site now**; gated rows say why
   ("someone looking for a job", "another company's brand", "outside your market"). No verdict is typed by a model (R1 #7).
9. **Map to pages** (B7): `SM.matchPage` + GSC page per query: `refresh <url>` when the site already ranks or has the page, `new`
   otherwise; two site URLs with impressions for one cluster = cannibalisation flag (R3 #6).
10. **Page type follows the results page** (R3 #5): a cluster whose top 10 is >= 50% lists / directories gets the action "get on these
    lists" (+ an optional selection guide), never a service page by default.
11. **Striking distance** (B8): one definition everywhere, positions 8-20 with >= 100 impressions in 28 days (config; small sites:
    >= 30), with the page, the query and the suggested change.
12. **Buyer questions** (B9): PAA + autocomplete questions + GSC question queries per priority cluster, deduped by meaning, proposed to
    the AI panel only after approval.
13. **Plan** (B10 + beat-them plan): up to 10 ranked actions over clusters and gaps (new page, refresh page, get listed, pitch list,
    link prospect), each with why, credits and a Start button that creates the existing pipeline item (ladder, Write it, listing step,
    link prospect). Auto sites see them in "Coming up", Manual sites in "Needs you" (On mode only).

## 4. Gaps (stored in `seo_ki_gaps`, all against the chosen set, per market; R4 6.2)

Keyword gaps: `missing` (>= 2 chosen competitors top 10, client not in top 100), `untapped` (exactly 1), `weak` (client 11-100, >= 1
competitor top 10), `striking`, `strong` (defend). Beyond keywords: `topic` (cluster with >= 2 competitor ranking pages, client none),
`page_type` (competitors have pricing / comparison / city / industry / case-study page for the service, client not), `ai_answer`,
`listing`, `backlink`. Gap counts reconcile with the provider's intersection totals; when a sample is capped, the row says "sample of
N of M" (R1 #9: today two 300-row samples are joined and false gaps appear).

## 5. Monitoring (A9)

Weekly, free: tracked keywords' stored top 10 (`seo_rank_history.competitors_json`) diffed per chosen competitor (new competitor page in
the top 10 of a tracked keyword, a move of >= 5 positions on >= 3 keywords). Monthly, paid (On sites, in the site's cycle on its monthly
date): one `competitors` refresh + one `keyword_research` refresh (about $1.20 per site, R5 #12), referring-domain jump >= 10, publishing
pace > 2x. Alerts only on real changes (two readings), in the weekly report section "Competitors this week".

## 6. App

- **Competitors page** (`/o/:org/sites/:site/competitors`): summary hero (who you compete with, your share of service searches vs
  theirs), the set with class chips and reasons, pick up to 5, watchlist, "not a competitor" (sticky), per-competitor drawer (profile,
  top pages, keyword profile with sort / filter / CSV, overlap with you), gaps by type with action + credits + Start, AI share of voice
  (reusing the AI visibility component), lists and directories to join.
- **Keyword research page** (`/o/:org/sites/:site/keywords`): clusters (head, searches, stage, verdict, score with range, factors on
  hover, sources, mapped page), striking distance, buyer questions (approve to AI panel), the plan (10 actions), filters (stage, verdict,
  source, cluster, volume, gap type, brand / non-brand), CSV export, measured / estimated labels + dates on every number.
- **One verdict component** with the three words and one tone map, used on both pages (and, after the owner's yes, everywhere: R2 #2).
- Run forms with the credit price before the run; Trial view for platform admins; Off sites see a "coming soon" card nowhere (pages
  hidden in Off). Guides for every ask (CONVENTIONS rule). Marketing: two capability entries, changelog line, pricing / platform lines
  ("rolling out"). Tutorial backlog rows (owner rule 2026-10-30).
- Bug fixed for every site now (no decision change, R2 #1): the discovery form stops adding "Write the page" credits it never spends.

## 7. Money, safety, isolation

- Credits quoted before every run from `_cost_cal.js` entries `competitors` (~$0.35) and `keyword_research` (~$0.90); never above the
  quote; a repeat run with unchanged inputs inside the TTL reuses stored rows and charges 0 (cache hits cost 0 by task id).
- Cache TTLs: results pages 24 h (existing), ranked keywords 7 d, volume 30 d, backlinks 7 d, homepage text 14 d (`seo_cache ki:*`).
- Partial runs: each step settles what it spent; a failed provider step marks its section "could not be read" (never "no demand"),
  later steps continue on what exists; the callback lists the missing sections; credits for the run are capped at the quote and the
  app refunds when the run fails as a whole.
- Untrusted text: competitor pages and AI answers are data only; prompts wrap them as quoted data; no tool call or action is derived
  from their text. SSRF guard on every fetched URL (existing safe fetcher rules: no credentials, no IP literals, no private hosts).
- Roles: owner / admin / member may run; viewer cannot; verified ownership required; company isolation by domain + org on every read.
- Kill switch `seo_cache ki:kill` = 1 makes every KI read path behave as Off and every KI run refuse with a plain message.

## 8. Rollout and acceptance

Waves: W0 contracts (tables, shared types, stage shapes, flag) -> W1 kit + workflow + app server + app web in parallel worktrees ->
W2 On-mode consumers + monitoring -> independent reviews (algorithm / statistics, safety / cost / blast radius, app / UX) -> fix round
-> offline replay on the private production dump ($0) -> 13 live shape calls (~$0.25, R5 section 11) -> merge origin/main, node-diff
production, backup, deploy with both sites Off -> Trial runs for both sites (~$1.30 each) -> owner compares -> On.

Acceptance (owner's list + R3 + R4):
- A1: techand gets Dynamics partners in its direct set and no google.com / fragments; devaicon gets Open edX rivals (raccoongang.com,
  edly.io, edunext.co) for the Open edX service and UAE software firms for the UAE services; platforms tagged, not scored.
- Gaps reconcile with provider totals or say "sample of N of M".
- B4: identical top 10 never split; zero shared never merged; deterministic.
- B6: monotone in every factor; weights from config; gated rows score 0 with a reason.
- R3 regressions: techand's Peppol / PINT AE and AX / cloud-migration striking pages rank above "what is a crm company"; devaicon is
  measured in the UAE; "erp software uae" is not refused as off-service; a list SERP gets a list action; "crm for customers" (AVOID)
  never becomes a page without an explicit override.
- Credits: estimate >= charge; repeat run 0; provider killed mid-run -> partial run, finished steps kept.
- Permissions, ownership, isolation as today; Off sites byte-identical (harness golden: every existing scenario passes unchanged).

## 9. Owner decisions (defaults chosen so the build can proceed; each can be changed before On)

| # | Decision | Default |
|---|---|---|
| K1 | Plans that get the two capabilities | all plans, metered by credits (no billing plans exist yet) |
| K2 | Monthly automatic refresh for On sites | yes, in the site's cycle (~$1.20 / site / month) |
| K3 | Score formula | R4's gated multiplicative formula (the owner's additive one ranks a jobs query above the money query) |
| K4 | Clustering threshold | 3 shared of the top 10 (config; 4 available) |
| K5 | Verdict words everywhere in the app | new pages + On sites now; whole app after the owner's yes |
| K6 | Selection fixes for Off sites | after the Trial comparison, with the owner's yes |
| K7 | 13 live shape calls before code ships | yes (~$0.25) |
| K8 | Switch both production sites to On | after Trial results, with the owner's yes |

Out of scope here (owner's note 2 sequences them after this core): Zapier / Make / Sheets connectors, HubSpot, extra AI engines,
content quality score, AI-answer sentiment beyond what exists.
