# R5 - DataForSEO capability probe for competitor analysis + advanced keyword research (KI, 2026-11-08)

Scope: every DataForSEO endpoint a competitor-analysis (A1-A10) and advanced-keyword-research (B2-B10) capability would use: path,
mode, request fields that matter, response fields with types, limits, price, freshness, caveats; which ones the engine already calls;
a cost model for one typical run; the shapes that need ONE live call before code ships.

Method: 123 sandbox calls (`https://sandbox.dataforseo.com/v3/`, $0, same credentials, from a throwaway `node:22-bookworm-slim`
container, credentials loaded with `env_settings.load_env()` and passed by env var, never printed; the probe script refuses any other
host). **No live (paid) call was made for sections 0-12** (19 live calls followed on 2026-11-08: §13). Prices from dataforseo.com/pricing/* and request fields from docs.dataforseo.com, both read
2026-11-08. Real live shapes and real billed costs come from the harness fixtures already in the repo (`harness/fixtures_live/*`,
recorded 2026-10-02 .. 2026-10-17). Trimmed samples: `r5_shapes/` (sandbox = `<group>_<endpoint>.json`, real live =
`LIVE_*.json`, each with `_source`). `r5_shapes/labs_available_filters.json` is the full map of filterable field paths and types for
every Labs endpoint (free GET `dataforseo_labs/available_filters`): use it, never guess a filter path.

## 0. Findings that change how we build

1. **The sandbox ignores unknown top-level fields but validates the values of known ones.** A field named `bogus_field_xyz` was
   accepted (20000) on Labs, SERP, Backlinks, Keywords Data and AI endpoints. But it refused (40501) out-of-range values of real fields:
   `limit` 1001, too many `keywords`/`targets`/`pages`, unknown `item_types` values, unknown filter paths, a 9th filter, unknown
   `order_by` paths, `depth` 5 on related_keywords, `people_also_ask_click_depth` 5, `intersection_mode` "bogus", bad
   `historical_serp_mode`, unknown `page_type`, unknown `location_code`, wrong nested `targets` item shape on llm_mentions.
   Consequence: **a misspelled field name passes the sandbox and is silently dropped (or refused live, as Claude's
   `web_search_country_iso_code` was, CLAUDE.md)**; a wrong filter path or limit is caught for free. Test filter / order_by paths in the
   sandbox; confirm every NEW field name against the docs page and one live call.
2. **Prices are 1.2x the long-standing list** (Labs $0.012 + $0.00012/row, Backlinks and Content Analysis $0.024 + $0.000036/row).
   Real billed costs in the fixtures match to the 6th decimal (backlinks 5 rows = $0.02418, 1 row = $0.024036).
3. **Every row returned is billed** on Labs / Backlinks / Content Analysis / LLM Mentions / AI keyword volume. `limit` and `filters`
   are the cost controls; `total_count` is free. Google Ads, Trends, Clickstream volume, SERP, Autocomplete are per task.
4. **`load_async_ai_overview` was not surcharged live.** (**CORRECTED 2026-11-08, see §13 C1: it is +$0.002 when the overview is asynchronous.**) Pricing page: "+1 base price". Fixtures: depth 10 + aio = $0.002
   (`aio.json`), depth 30 + aio = $0.006 (`fa3_live.json.gz`, 2026-10-17), i.e. depth only. Model it as possible (+$0.002 per SERP)
   and confirm on the ledger.
5. **Cheapest traffic potential (B5)**: `bulk_traffic_estimation` takes up to 1,000 targets **including page URLs** in one call
   ($0.012 + $0.00012 per target): the #1 URL of 100 keywords costs ~$0.024, vs ~$1.21 with one `ranked_keywords` per URL. The
   B1-8 open question ("does a Labs endpoint take a URL target?", BENCH_AREA1) is answered yes by the docs for both
   `ranked_keywords` and `bulk_traffic_estimation`. Needs one live call (section 10).
6. **"Untapped" (2+ competitors rank, you do not) is one call**: Labs `page_intersection` with `pages` = up to 20 competitor
   wildcards `https://comp.com/*`, `exclude_pages` = `https://you.com/*`, `intersection_mode: "union"`; each row carries
   `intersection_result["1".."N"]` (null where that competitor does not rank), so N-of-M is a client-side count. Labs
   `domain_intersection` is strictly 2 domains (`target1`, `target2`).
7. **UAE coverage is thin in Labs**: `locations_and_languages` says 2784/en holds 53.8M keywords but only **1.30M SERPs** (UK 31.9M,
   2784/ar 41.5M keywords). Ranked-keyword and gap data for small UAE B2B sites will be sparse; plan for "not in the index" as a
   normal answer, not an error (R3/R4 to quantify from production).
8. **No community question source**: DataForSEO has no Reddit / Quora question API. What exists: SERP items
   `discussions_and_forums` and `people_also_ask`, Content Analysis `page_type: ["message-boards"]` (citations, not questions),
   SERP with `site:reddit.com` (x5 price). `business_data/social_media/reddit` answered 50304 "temporarily unavailable" in the sandbox
   and its docs page is 404: treat as gone.
9. **AI prompt volume is modelled, not measured**: `ai_keyword_data` "calculated using statistical data from questions in the People
   Also Ask element" (docs). LLM Mentions `ai_search_volume` per stored question comes from DataForSEO's own database (pricing page:
   "more than 280M real prompts and answers", ChatGPT US-English only, Google AI Overviews elsewhere). Label both "modelled by
   DataForSEO" (owner rule: prompt volume only from a real named source).

## 1. Common contract (all endpoints)

- `POST https://api.dataforseo.com/v3/<path>` with body `[ {task} ]`, Basic auth. **Live endpoints accept one task per call.**
- Envelope: `{version, status_code, status_message, time, cost, tasks_count, tasks_error, tasks:[{id, status_code, status_message,
  time, cost, result_count, path:[...], data:{echo of request + api/function/se}, result:[...]}]}`. HTTP 200 even on task errors:
  read `tasks[0].status_code` (20000 ok, 20100 task created, 40501 invalid field, 40400 not found, 40402 invalid path, 50000 / 50304
  server side). The engine's in-200 rule already lives in `v5/code/_dfs_retry.js` (retry on any task error, `NOT_CHECKED` after).
- **Never let n8n's node-level retry re-send a paid call** (retry_lint, 2026-10-21): 58 nodes could re-bill.
- `tasks[0].cost` is the billed amount: the engine's ledger settles from it (`_cost_cal.js`); keep doing that, never price from tables
  when the response carries `cost`. `appendix/user_data` is the free balance read (all monitors call it).
- Results never cost to read again for task-based (standard) modes; live is single POST.
- Rate: up to 10,000 calls/min per docs, 30 simultaneous live calls on Labs/AI; **Google Ads live: 12
  requests/min per account**.
- `include_clickstream_data: true` doubles the price on Labs endpoints that support it; it adds `clickstream_keyword_info`,
  `keyword_info_normalized_with_clickstream`, `clickstream_etv`. Sandbox returns these blocks even when not asked: do not read them
  unless requested.
- Locations: `location_code` (2784 UAE, 2840 US, 2826 UK, 682 SA). Free lists: `dataforseo_labs/locations_and_languages` (Labs),
  `serp/google/locations`, `keywords_data/google_ads/locations`.

### Filter / order_by syntax (Labs, Backlinks, Content Analysis, LLM Mentions)
`filters: [["keyword_info.search_volume", ">", 10], "and", ["keyword_properties.keyword_difficulty", "<", 50]]`; nested groups allowed
(`[[a], "or", [b]]`); **max 8 conditions** (9 refused in sandbox). Operators: `regex not_regex < <= > >= = <> in not_in match not_match
ilike not_ilike like not_like` (`%` wildcard for like/ilike). `order_by: ["keyword_info.search_volume,desc"]`, max 3 rules. Paths are
relative to the item (`keyword_data.` prefix on ranked_keywords / domain_intersection / page_intersection, none on keyword_ideas).
Backlinks domain_intersection prefixes the target number: `"1.rank,desc"`. Sandbox validates paths: test them there.

### The shared `keyword_data` block (Labs; under `items[]` directly on ideas/suggestions/keywords_for_site/top_searches/keyword_overview, under `items[].keyword_data` on related/ranked/intersections)
```
keyword str, location_code int, language_code str,
keyword_info { search_volume int|null, cpc float|null, competition float 0-1, competition_level "LOW|MEDIUM|HIGH",
  low_top_of_page_bid float, high_top_of_page_bid float, categories [int], last_updated_time "YYYY-MM-DD hh:mm:ss +00:00",
  monthly_searches [{year, month, search_volume}] (12), search_volume_trend {monthly, quarterly, yearly} (percent ints) },
keyword_properties { core_keyword str|null, synonym_clustering_algorithm "text_processing"|..., keyword_difficulty int 0-100|null,
  detected_language str, is_another_language bool, words_count int (ideas/suggestions/site/top_searches only) },
serp_info { check_url, serp_item_types [str], se_results_count int, last_updated_time, previous_updated_time }   (only with include_serp_info, except ranked/intersection where serp facts sit on ranked_serp_element)
avg_backlinks_info { backlinks, dofollow, referring_pages, referring_domains, referring_main_domains, rank, main_domain_rank, last_updated_time }  (floats: averages of the top 10)
search_intent_info { main_intent "informational|navigational|commercial|transactional", foreign_intent [str]|null, last_updated_time }
```
Real sample: `r5_shapes/labs_ranked_keywords.json`. Note `search_intent_info` here has **no probability**; the `search_intent`
endpoint gives `probability` (the B3 "confidence"). `core_keyword` + `ignore_synonyms: true` is DataForSEO's own near-duplicate
collapse (text processing, not SERP): useful pre-filter before B4, never a substitute for SERP clustering.

## 2. What the engine already calls (live-validated request fields)

| Endpoint | Where (file / node) | Fields sent today | Real live shape in repo |
|---|---|---|---|
| labs/google/competitors_domain | `build_v4.py` node *Find Competitors* (+Retry), main workflow | target, location_code, language_code, limit 20, exclude_top_domains | none raw (processed: `fixtures_live/fb_full_767.json`) |
| labs/google/ranked_keywords | *Ranked Keywords* (main); `v5/code/Competitor_Keyword_Requests.js:37`, `Ladder_Requests.js:22`, `Assess_Requests.js:11`, `_reach.js:208` | target, limit 10-500, order_by `keyword_data.keyword_info.search_volume,desc`, filters `ranked_serp_element.serp_item.rank_group <= N`, `keyword_data.keyword = x` | processed in `r_a1_*`, `fa3_live` |
| labs/google/domain_rank_overview | *Domain Overview*, *Site Authority*; `_reach.js:210` | target, location, language | - |
| labs/google/keyword_ideas | *Keyword Ideas* (main); `Research_Requests.js:17`, `Ladder_Requests.js:19`, `Competitor_Keyword_Requests.js:40` | keywords <=20, limit 300-600, include_serp_info, ignore_synonyms, closely_variants | processed |
| labs/google/keyword_suggestions | `Research_Requests.js:20`, `Ladder_Requests.js:15` | keyword, limit 300-500, include_serp_info, order_by | processed |
| labs/google/related_keywords | `Research_Requests.js:22`, `Ladder_Requests.js:17` | keyword, depth 2, limit 200-300, include_serp_info | processed |
| labs/google/keyword_overview | *Keyword Data* (+Retry); `Assess_Requests.js:10` | keywords [1] | - |
| serp/google/organic/live/advanced | *SERP Top 10*, *Candidate SERP*, *Run Ladder Cluster SERP*, *Facts SERP*, *Regulatory SERP*, *AI SERP*, *Fallback SERP*; `Discovery_Requests.js:24`, `AI_Rank_Requests.js`, Rank Tracker | keyword, depth 10/30/50, load_async_ai_overview | `fixtures_live/aio.json` -> `r5_shapes/LIVE_serp_organic_advanced_aio.json`; `fa3_live`, `r_fa1_ladder770` (20 SERPs) |
| serp/google/ai_mode/live/advanced | `AI_Requests.js` (AI Visibility) | keyword, location, language | `aimode.json` -> `LIVE_serp_ai_mode.json` |
| keywords_data/google_trends/explore/live | `v5/code/Trends_Requests.js:12` (Site Tracker) | keywords [1], type web, time_range past_12_months, item_types graph+queries_list | - |
| ai_optimization/ai_keyword_data/keywords_search_volume/live | *AI Demand* (main); `Discovery_Requests.js:26` | keywords <=100, location, language | sandbox `fixtures_live/sandbox_v49.json` |
| ai_optimization/llm_mentions/{search_mentions, top_mentioned_domains, top_mentioned_pages, top_mentioned_brands, target_metrics, multi_target_metrics, historical, timeseries_new_lost} | `AI_Requests.js` (AI Visibility), `_ai_w2e3.js`, `Discovery_Requests.js:17` | target [{domain}/{keyword}], platform, order_by ai_search_volume | `mentions_search.json`, `top_domains.json` (old paths, live) |
| ai_optimization/{chat_gpt,claude,gemini,perplexity}/llm_responses, chat_gpt + gemini llm_scraper | `AI_Requests.js`, `AI_Rank_Calls.js` | user_prompt, model_name, web_search | `r_claude.json`, `r_gemini.json`, `r_perplexity.json`, `scraper.json` |
| backlinks/domain_intersection | *Backlink Gap* (main), `Gap_Requests.js:15` | targets {1..N}, exclude_targets, limit 30, intersection_mode partial | `gap_partial.json` -> `LIVE_backlinks_domain_intersection_partial.json` |
| backlinks/{summary, backlinks, referring_domains, anchors, domain_pages, timeseries_summary} | `BL_Requests.js`, `LB_DFS_Requests.js` | see file | `bl_*.json` |
| backlinks/bulk_ranks, bulk_spam_score | `Authority_Requests.js:16-17` | targets <= 1000 | - |
| content_analysis/search | Backlink Monitor (mentions) | keyword, search_mode, limit | `ca_search.json`, `ca_domain.json` |
| on_page/task_post, summary, pages | *Start Crawl*, *Get Crawl Summary*, *Get Crawled Pages* (audit) | - | - |
| domain_analytics/whois/overview | *DataForSEO Whois* (full report) | - | - |
| business_data/google/my_business_info | GBP check | - | `gbp.json` |

Not called anywhere today (new for KI): serp_competitors, Labs domain_intersection, page_intersection, relevant_pages,
keywords_for_site, bulk_keyword_difficulty, search_intent, historical_keyword_data, bulk_traffic_estimation, historical_rank_overview,
historical_serps, top_searches, categories_for_domain, subdomains, Google Ads volume endpoints, DataForSEO Trends, Clickstream,
autocomplete, backlinks competitors / bulk_referring_domains / page_intersection, on_page content_parsing / instant_pages.

## 3. DataForSEO Labs (Google) - competitor side
All: `dataforseo_labs/google/<name>/live`, live only, ~2 s, **$0.012 per task + $0.00012 per returned row** unless stated; `limit`
max 1000 (1001 refused in sandbox), `offset` (docs: up to 10,000; beyond that `offset_token` where offered); data refreshed with the
Labs database (keyword metrics monthly; ranked keywords "updated weekly" per docs; read `last_updated_time`).

**competitors_domain** (A1). Req: `target` (domain, no scheme/www), `location_code`, `language_code`, `item_types` [organic, paid,
featured_snippet, local_pack] (default organic+paid), `intersecting_domains` [<=20], `exclude_top_domains` bool (drops wikipedia,
pinterest, amazon, google, facebook, wordpress, medium, quora, reddit, youtube, ebay, uol, instagram, olx, twitter, linkedin,
slideshare; we want platforms TAGGED not dropped, so call with false and tag them ourselves, or call twice), `max_rank_group` (default
100; set 20 to ignore deep noise), `ignore_synonyms`, filters, order_by (default `metrics.organic.count,desc`), limit.
Resp item: `domain` str, `avg_position` float, `sum_position` int, `intersections` int (shared keywords), `full_domain_metrics.{organic,
paid,featured_snippet,local_pack}` (competitor's whole profile: `pos_1, pos_2_3 .. pos_91_100, etv, count, estimated_paid_traffic_cost,
is_new, is_up, is_down, is_lost, clickstream_etv`), `metrics.*` (shared keywords, **target's** numbers), `competitor_metrics.*`
(present in sandbox, not in docs: confirm live). Shape `r5_shapes/labs_competitors_domain.json`.

**serp_competitors** (A1 from seeds). Req: `keywords` [<=200, 201 refused], location, language, `include_subdomains` (default true),
`item_types`, filters/order_by (default `rating,desc`), limit. Resp item: `domain`, `avg_position`, `median_position`, `rating`
(= sum(100 - position)), `etv`, `keywords_count`, `visibility` (1..0.1 for pos 1-10, 0.05 for 11-20), `relevant_serp_items`,
`keywords_positions {"<keyword>": [int]}`. Positions come from the Labs SERP store, not a fresh SERP. Price: rows = domains returned.

**domain_intersection** (A3, 2 domains only). Req: `target1`, `target2`, location, language, `intersections` (true = both rank in the
same SERP; **false = target1 ranks and target2 does not**, so the "missing" list is `target1=competitor, target2=you,
intersections:false`), `item_types` [organic, paid, featured_snippet, local_pack] (`ai_overview_reference` refused here in sandbox,
accepted on ranked_keywords), `include_serp_info`, `include_clickstream_data`, filters, order_by (default
`keyword_data.keyword_info.search_volume,desc`), limit. Returns nothing above 10M intersecting keywords. Resp item:
`keyword_data{...}`, `first_domain_serp_element` / `second_domain_serp_element` (organic element: `type, rank_group, rank_absolute,
position, domain, url, relative_url, main_domain, title, description, etv, estimated_paid_traffic_cost, clickstream_etv,
rank_changes{previous_rank_absolute,is_new,is_up,is_down}, backlinks_info{...}, rank_info{page_rank, main_domain_rank}`).

**page_intersection** (A3 untapped / A4 / A10, up to 20 sites). Req: `pages` {"1": "https://comp1.com/*", .. "20"} (absolute URL,
`*` only after a slash; docs also show `_`: confirm live), `exclude_pages` [<=10], `intersection_mode` "union" | "intersect"
(default intersect, union when exclude_pages set), `item_types` incl. `ai_overview_reference`, `include_subdomains` (true),
`include_serp_info`, `ignore_synonyms`, filters (address by page number), order_by, limit. Resp item: `keyword_data{...}`,
`intersection_result {"1": serp_element|null, "2": ...}`. 21 pages refused, 20 accepted. Shape `labs_page_intersection.json`.

**ranked_keywords** (A2/A10, own site, TP). Req: `target` (domain, subdomain **or page URL** with https://), location, language,
`item_types` [organic, paid, featured_snippet, local_pack, ai_overview_reference], `load_rank_absolute`, `historical_serp_mode`
live|lost|all, `ignore_synonyms`, `include_clickstream_data`, filters (`ranked_serp_element.serp_item.rank_group`, `.etv`, `.url`,
`keyword_data.keyword_info.search_volume` ...), order_by (default rank_group asc), limit <=1000. Resp: top-level `metrics` /
`metrics_absolute` (`organic`, `paid`, `featured_snippet`, `local_pack`, `ai_overview_reference` distribution, etv, count),
`total_count`, items `{keyword_data{...}, ranked_serp_element{serp_item{type, rank_group, rank_absolute, url, relative_url, etv,
rank_changes, backlinks_info, rank_info, ...}, check_url, serp_item_types, se_results_count, keyword_difficulty, is_lost,
last_updated_time, previous_updated_time}}`.

**relevant_pages** (A5 top pages). Req: target (domain), location, language, item_types, `historical_serp_mode`, ignore_synonyms,
filters, order_by (default `metrics.organic.count,desc`; use `metrics.organic.etv,desc`), limit. Resp item: `page_address`,
`metrics.{organic,paid,...}` (etv, count, pos buckets). No `exclude_pages`.

**domain_rank_overview** (A2 size). Req: target, location, language. Resp: one item `metrics.organic/paid` (pos buckets, etv, count,
is_new/up/down/lost). Engine uses it for reach.

**bulk_traffic_estimation** (A1 size, B5 TP). Req: `targets` [<=1000 domains, subdomains or pages], location, language,
item_types, ignore_synonyms. Resp item: `target`, `metrics.organic{etv, count}`, `paid{etv,count}`. Priced at the standard rate
(the pricing page lists only `historical_bulk_traffic_estimation` and `domain_metrics_by_categories` as $0.12 + $0.0012/domain):
confirm `cost` on one live call.

**historical_rank_overview** (A2 trend, optional): `target`; items per month `{year, month, metrics}`; **$0.12 + $0.0012/item**.
**historical_bulk_traffic_estimation**: same price class. **subdomains**: `items[].subdomain, metrics`. **categories_for_domain**:
`items[].categories [int], metrics` (topic profile; category codes from `keywords_data/google_ads/categories`).
**domain_whois_overview**: Labs WHOIS list (filters on domain metrics), not per-domain lookup.

## 4. DataForSEO Labs (Google) - keyword side

**keyword_ideas** (B2 broad). Category-based: returns terms in the same product categories as the seeds (need not contain them).
Req: `keywords` [<=200], location, language, `closely_variants` (true = phrase match), `ignore_synonyms`, `include_serp_info`,
`include_clickstream_data`, limit (default 700, max 1000), offset (<=10,000) / `offset_token`, filters, order_by (default
`relevance,desc`; relevance cannot be filtered). Items = keyword_data block.

**keyword_suggestions** (B2 long tail). Full-text: every result contains the seed words (any order). Req: `keyword`,
`include_seed_keyword`, `exact_match`, `ignore_synonyms`, `include_serp_info`, limit (100 default), offset/offset_token, filters,
order_by. Resp adds `seed_keyword`, `seed_keyword_data`.

**related_keywords** (B2 "searches related to" graph). Req: `keyword`, `depth` 0-4 (5 refused; max rows ~8 / 72 / 584 / 4,680 by
depth), `include_seed_keyword`, `replace_with_core_keyword`, `ignore_synonyms`, `include_serp_info`, limit, filters, order_by. Resp
item: `keyword_data{...}`, `depth` int, `related_keywords` [str] (the edges: free cluster hints).

**keywords_for_site** (B2 from the site itself): req `target` domain; items = keyword_data block. **top_searches**: biggest keywords of a
location (filters); items = keyword_data. **keywords_for_categories**: `category_codes` [int].

**keyword_overview** (B3 enrichment of keywords from GSC / autocomplete / PAA). Req: `keywords` [<=700, 701 refused], location,
language, `include_serp_info`, `include_clickstream_data`. Items = keyword_data block + `search_partners`. One call enriches 700.

**bulk_keyword_difficulty** (B5 KD only). Req: `keywords` [<=1000], location, language. Resp: `items[{keyword, keyword_difficulty}]`.
KD = log 0-100 "chance of top 10", mainly the link profiles of the top 10. Already inside keyword_data, so call only for keywords
that came back without it.

**search_intent** (B3 intent + confidence). Req: `keywords` [<=1000]. Docs list **no language field** (we sent `language_code`; the
sandbox silently ignored it). Resp: `items[{keyword, keyword_intent{label, probability float}, secondary_keyword_intents [{label,
probability}]|null}]`, labels informational / navigational / commercial / transactional. Price per keyword row.

**historical_keyword_data** (B3 multi-year trend): `keywords` [<=700]; items `{keyword, history[{year, month, keyword_info{...}}]}`;
history since **August 2021**; Google revisions back-filled.

**historical_serps** (cheap SERP snapshots, see B4 alternative): req `keyword`, location, language, `date_from`/`date_to`; items =
past SERP snapshots `{datetime, check_url, item_types, se_results_count, items[serp elements]}`; priced **$0.00012 per SERP**
returned. Sandbox snapshot was 2026-05-14 old: freshness is the question (section 10).

There is **no Labs bulk_search_volume** endpoint (`dataforseo_labs/google/bulk_search_volume` = 40402 Invalid Path, without
`/google` = 40400). Volume in bulk = keyword_overview (Labs) or Google Ads search_volume or Clickstream bulk.

## 5. Keywords Data API

**google_ads/search_volume** (`keywords_data/google_ads/search_volume/live` or `task_post` + `tasks_ready`/`task_get`). Req: `keywords`
[<=1000; 80 chars, 10 words each; no emoji], location, language, `search_partners`, `date_from` (<=4 years back) / `date_to` (<= last
full month), `include_adult_keywords`, `sort_by`. Result is a flat list (no `items`): `{keyword, spell, location_code, language_code,
search_partners, competition "LOW|MEDIUM|HIGH"|null, competition_index 0-100|null, search_volume int|null, low_top_of_page_bid,
high_top_of_page_bid, cpc, monthly_searches[{year, month, search_volume}]}`. **Price per task, not per keyword: live $0.09,
standard $0.06 (1-3 h), up to 1,000 keywords**. 12 requests/min live.
Caveats: Google Ads **groups close variants** ("combined search volume values for groups of similar keywords": plurals, word order,
misspellings get the same number; submit near-duplicates in separate tasks if the split matters); volumes are **Keyword Planner's
rounded steps** (live data shows 210, 480, 880 in `fb_full_767.json`: never present them as exact); `null` for some groups; current
month never included; 4 years history.
**google_ads/keywords_for_keywords**: `keywords` [<=20, 21 refused]; same row shape + `keyword_annotations.concepts`; up to ~700-2,000
rows for one task price. **google_ads/keywords_for_site**: `target` domain or URL; same rows (1,969 in sandbox); one task price. Both
are the cheapest broad discovery per keyword but carry Ads-only data (no KD, no SERP, no intent).
**google_ads/ad_traffic_by_keywords**: `keywords`, `bid`, `match`; `{impressions, ctr, average_cpc, cost, clicks}` (PPC planning, not
needed).

**google_trends/explore** (`keywords_data/google_trends/explore/live`). Req: `keywords` [<=5, 6 refused], location, language, `type`
(web, news, youtube, images, froogle), `time_range` (past_hour .. past_5_years) or `date_from`/`date_to`, `item_types`
[google_trends_graph, google_trends_map, google_trends_topics_list, google_trends_queries_list] (**topics_list / queries_list only
with ONE keyword**: sandbox refused queries_list with 2). Resp items: graph `{type, keywords, data[{date_from, date_to, timestamp,
missing_data, values[int]}], averages[]}`, queries list (related + rising queries: B2 source). **Live $0.011, standard $0.0027 per
task** (up to 32 s live).
**dataforseo_trends/explore** (DataForSEO's own index, faster/cheaper): `keywords` [<=5], location, `type`; items `{type, keywords,
data[{date_from,date_to,timestamp,values}], averages}`; **$0.0012/task**; `subregion_interests` / `demography` $0.0024, `merged_data`
$0.006. Enough for "is it rising" when Labs `search_volume_trend` is not.

**clickstream_data** (`keywords_data/clickstream_data/...`): `dataforseo_search_volume/live` and `global_search_volume/live` ($0.18 per
task, <=1,000 keywords; global returns `country_distribution[{country_iso_code, search_volume, percentage}]`), `bulk_search_volume/live`
($0.012 + $0.00012/row). Clickstream-derived volumes: a second opinion on Ads buckets, not needed for v1.

## 6. SERP API

**google/organic/live/advanced** (B2 PAA/related, B4 clustering, B5 weakness signals). Req: `keyword` (<=700 chars), location,
language, `device` desktop|mobile, `os`, `depth` (default 10, max 200; billed per 10, rounded up; refund when fewer exist),
`people_also_ask_click_depth` 1-4 (5 refused; **+$0.00015 per click**; expands nested questions), `load_async_ai_overview` (see
finding 4), `group_organic_results`, `calculate_rectangles` (+1 base), `target`, `search_param`, `max_crawl_pages`. **Price: live
$0.002, priority $0.0012, standard queue $0.0006 per 10 results** (standard ~5 min avg, 45 min target; free GET). Search operators
(site:, intitle:) x5. Location/device do not change price.
Resp: `{keyword, check_url, datetime, item_types[], se_results_count, items_count, pages_count, refinement_chips, items[]}`; item
`type` values include organic, paid, featured_snippet, people_also_ask, related_searches, people_also_search, ai_overview,
discussions_and_forums, perspectives, local_pack, video, short_videos, top_stories, knowledge_graph, images, shopping,
popular_products, answer_box, questions_and_answers, find_results_on (full list in docs). Real live elements
(`LIVE_serp_organic_advanced_aio.json`):
- organic: `rank_group, rank_absolute, page, position, domain, title, url, breadcrumb, website_name, description, is_featured_snippet,
  is_video, is_image, timestamp (date shown), highlighted[], links[], faq, about_this_result, rating, price, amp_version`.
- people_also_ask: `items[{type "people_also_ask_element", title (the question), seed_question, expanded_element[{type
  "people_also_ask_expanded_element" (url, domain, title, description, timestamp, featured_title) | "people_also_ask_ai_overview_
  expanded_element" (items, references, asynchronous_ai_overview)}]}]`. Live 2026-10 for UAE: the answer was an AI overview with
  `asynchronous_ai_overview: true` and `items: null`, so the PAA answer URL is often absent.
- related_searches: `items: [str]` (8 in the live sample).
- ai_overview: `asynchronous_ai_overview bool, markdown, items[{type "ai_overview_element", text, markdown, links[{title,url,domain}],
  references[{type "ai_overview_reference", source, domain, url, title, text}]}]`.
- discussions_and_forums: `items[{type, title, url, domain, source, description, timestamp, posts_count}]` (docs); perspectives:
  `items[{type, title, description, url, domain, date, source, timestamp}]`.
`serp/google/organic/live/regular` has the same price and only organic/paid (no PAA): always use advanced.

**google/autocomplete/live/advanced** (B2). Req: `keyword`, location, language, `cursor_pointer` (>=0; default end of keyword;
sandbox refused -1), `client` (chrome, chrome-omni, gws-wiz, gws-wiz-serp, safari, firefox, psy-ab, toolbar, youtube, gws-wiz-local,
img, products-cc). Resp items `{type "autocomplete", rank_group, rank_absolute, relevance (chrome clients only), suggestion,
suggestion_type, search_query_url, thumbnail_url (gws-wiz*), highlighted}`. **$0.002 live / $0.0006 standard per request.** No
volume: enrich with keyword_overview.

**google/ai_mode/live/advanced**: `$0.004` live (fixture); one `ai_overview` item with references. Engine uses it for AI visibility.

## 7. Backlinks API (live only, $0.024 per task + $0.000036 per row, no minimum stated on the pricing page; the account already has it)

**domain_intersection** (A6). Req: `targets` {"1".."20"} (21 refused), `exclude_targets` [<=10] (you), `intersection_mode` all |
partial (partial = linking to at least one / some; count `domain_intersection` keys for 2+), `limit` <=1000, `internal_list_limit`,
`backlinks_status_type` live|lost|all, `include_subdomains`, `include_indirect_links`, `exclude_internal_backlinks`, `rank_scale`
one_hundred|one_thousand, filters, order_by `"1.rank,desc"`. Resp item: `domain_intersection {"1": {target, rank, backlinks,
first_seen, lost_date, backlinks_spam_score, referring_domains, referring_pages, referring_links_tld{}, referring_links_types{},
referring_links_attributes{}, ...} | null}`, `summary.intersections_count`. Live shape `LIVE_backlinks_domain_intersection_partial.json`.
**competitors** (A1 link-side competitors): req `target`, `main_domain`, `exclude_large_domains` (default true), `exclude_internal_
backlinks`, limit, filters, order_by, rank_scale; resp `{type "backlinks_competitors", target, rank, intersections}`.
**referring_domains**: per domain `{domain, rank, backlinks, first_seen, lost_date, backlinks_spam_score, referring_pages, ...}`.
**bulk_ranks**: `targets` [<=1000 domains or URLs], `rank_scale`; resp `{target, rank}` (1,001 refused). **bulk_referring_domains**:
`{target, referring_domains, referring_main_domains, ...}`. **page_intersection**: same as domain_intersection with URLs.
For SERP "domain strength vs top 10" (B5): one `bulk_ranks` call for every distinct domain in the clustered SERPs (<=1000).

## 8. AI Optimization API

**ai_keyword_data/keywords_search_volume/live** (B9 AI demand). Req: `keywords` [<=1000, 250 chars], location, language. Resp:
`items[{keyword, ai_search_volume int, ai_monthly_searches[{year, month, ai_search_volume}]}]` (field is `ai_monthly_searches`, not
`monthly_searches`). **$0.01 per task + $0.0001 per row.** Modelled from PAA statistics; zeros may mean "no data". The sandbox
accepted 2784/ar: whether live has non-zero UAE values is a live check (engine's *AI Demand* already calls it; R3 can read prod).

**llm_mentions/*** (A8 competitor share in AI answers; live, **$0.10 per task + $0.001 per row**, ChatGPT data = 2840/en only, `platform`
google = AI Overviews). Paths (current): `search_mentions` (old `search` still answers, docs say replaced), `top_mentioned_domains`
(old `top_domains` still answers in sandbox; use the new one with `platform`), `top_mentioned_pages`, `top_mentioned_brands`,
`target_metrics`, `multi_target_metrics` (targets item shape `{key, target:[...]}`; a bare array was refused), `aggregated_metrics`,
`cross_aggregated_metrics` (`{aggregation_key, target:[...]}`), `historical`, `timeseries_new_lost`, `*_lite` variants same price.
search_mentions req: `target` [<=10 entities: `{domain, search_filter include|exclude, search_scope any|sources|search_results,
include_subdomains}` or `{keyword, search_filter, search_scope any|question|answer|brand_entities|fan_out_queries, match_type
word_match|partial_match}`], `platform`, location, language, filters, order_by (`ai_search_volume,desc`), limit <=1000, offset <=9000,
`search_after_token`. Item: `platform, model_name, question, answer, sources[{source_name, title, domain, url, rank|position,
publication_date, snippet, markdown, thumbnail}], search_results[...], ai_search_volume, monthly_searches, first_response_at,
last_response_at, brand_entities[{title, category, position}], fan_out_queries[str], is_web_search_based`. The stored questions
themselves are a B9 source of real buyer questions (US-English only for ChatGPT).

**llm_responses** (`chat_gpt|claude|gemini|perplexity/llm_responses/live`): live $0.0006 + the model's own token price (observed
$0.023 Claude, $0.029 ChatGPT, $0.034 Gemini, $0.006 Perplexity in fixtures); `models` list is a free GET. **llm_scraper**
(chat_gpt, gemini `.../llm_scraper/live/advanced`): $0.004 live / $0.0012 standard per result. Already used by AI Visibility / AIR;
KI reuses the AI panel, it does not need new calls.

## 9. Content Analysis, On-Page
**content_analysis/search/live** ($0.024 + $0.000036/row): `keyword`, `keyword_fields` (title, main_title, previous_title, snippet),
`page_type` [ecommerce, news, blogs, message-boards, organization] ("reddit" refused), `search_mode` as_is|one_per_domain, filters,
order_by, limit <=1000, rank_scale. Item: `url, domain, main_domain, url_rank, domain_rank, spam_score, fetch_time, country, language,
page_types, content_info{title, snippet, author, date_published, sentiment_connotations, connotation_types, text_category,
content_quality_score, semantic_location, rating}`. Mentions, not questions; sandbox returned German ecommerce for a UAE query:
coverage for our markets is unproven. `summary/live` gives counts by type / sentiment.
**on_page/content_parsing/live** and **on_page/instant_pages** ($0.00015 per page; +$0.00135 with `enable_javascript`, $0.0051 with
browser rendering): A7 page benchmark of the top 5 (headings, word count, schema, links, dates) and A1 homepage classification, if the
Jina reader is not used. Shapes `op_content_parsing.json`, `op_instant_pages.json`.

## 10. Cost model: one run, 1 site, 5 competitors, 300 candidate keywords, 100 keywords clustered by SERP

Cheapest correct combination (live mode unless noted; rows = billed rows; Labs = $0.012 + $0.00012 x rows):

| Step (module) | Calls | Rows | Cost |
|---|---|---|---|
| A1 competitors_domain (site, limit 20, exclude_top_domains false, max_rank_group 20) | 1 | 20 | $0.0144 |
| A1 serp_competitors (<=200 seeds: tracked + GSC top + own ranked, limit 30) | 1 | 30 | $0.0156 |
| A1 size: bulk_traffic_estimation (20 candidates) + backlinks bulk_ranks (20) | 2 | 20 + 20 | $0.0144 + $0.0247 |
| A2/A10 own ranked_keywords (limit 500, rank_group <= 30) | 1 | 500 | $0.072 |
| A2/A10 5 x competitor ranked_keywords (limit 300, rank_group <= 20, volume > 10) | 5 | 1,500 | $0.24 |
| A3 untapped/missing: page_intersection union, 5 competitor wildcards, exclude you (limit 500) | 1 | 500 | $0.072 |
| A3 shared/weak/strong: client-side join of the ranked lists above | 0 | - | $0 |
| A5 relevant_pages 5 x limit 20 (order etv desc) | 5 | 100 | $0.072 |
| A6 backlinks domain_intersection partial, 5 targets, exclude you, limit 300 | 1 | 300 | $0.0348 |
| B2 keyword_ideas (20 seeds, limit 300) + 3 x suggestions (limit 200) + 2 x related depth 2 (limit 150) | 6 | 1,200 | $0.216 |
| B2 autocomplete 10 seeds (standard queue $0.0006; live $0.002) | 10 | - | $0.006 / $0.02 |
| B2 Trends rising queries: google_trends explore 5 heads x 1 keyword (standard) | 5 | - | $0.0135 |
| B3 keyword_overview for candidates without Labs data (GSC / autocomplete / PAA, ~100) | 1 | 100 | $0.024 |
| B3 search_intent (300, gives probability) | 1 | 300 | $0.048 |
| B9 ai_keyword_data (300) | 1 | 300 | $0.04 |
| B4 SERP for 100 keywords, depth 10, PAA in the same call (standard queue $0.0006; live $0.002; + possible aio $0.002) | 100 | - | $0.06 / $0.20 (+$0.20) |
| B5 TP: bulk_traffic_estimation of the 100 #1 URLs | 1 | 100 | $0.024 |
| B5 strength: bulk_ranks of distinct top-10 domains (~600) | 1 | 600 | $0.0456 |
| **Total** | ~143 | | **~$1.04 with standard-queue SERPs, ~$1.19 live, ~$1.39 if aio is surcharged** |

Cheaper / dearer levers: historical_serps instead of live SERPs for clustering would be ~100 x $0.00012 x snapshots (~$0.01-0.05) if
the latest snapshot is recent enough (unproven; UAE has only 1.3M stored SERPs, many keywords will have none). Raising competitor
ranked_keywords to limit 1000 adds $0.42. `include_clickstream_data` doubles every Labs line. Google Ads `keywords_for_site` /
`keywords_for_keywords` give ~1,000-2,000 Ads rows for $0.09 a task but without KD / SERP / intent. llm_mentions for A8 is $0.10+ per
call and US-English only for ChatGPT: reuse the AI panel. Cache TTLs (owner note) cut repeat runs to ~$0: ranked keywords 7 d,
volume 30 d, SERP 24 h; DataForSEO itself refreshes keyword metrics monthly, so a shorter volume TTL buys nothing.
Reference: today's discovery run is ~$0.27-0.34 and a full report ~$0.55 (BENCH_AREA1, `_cost_cal.js`).

## 11. Live calls needed before code ships (one each; MADE 2026-11-08, answers and corrections in §13)

1. `bulk_traffic_estimation` with **page URL** targets: shape and `cost` (standard $0.012 + row, or the $0.12 exception?).
2. `page_intersection` union with `https://comp.com/*` wildcards + `exclude_pages`: wildcard char (`*` vs `_`), `intersection_result`
   null entries, `total_count` for reconciliation (acceptance "A3 counts reconcile with provider totals").
3. `domain_intersection` with `intersections: false`: `second_domain_serp_element` null/absent, and whether `ai_overview_reference`
   is really refused live.
4. `competitors_domain`: `competitor_metrics` presence (undocumented) and behaviour of `max_rank_group` for a small UAE site.
5. `serp_competitors` on 2784/en: `keywords_positions` keyed by keyword, coverage for B2B seeds.
6. `historical_serps` for 3 UAE keywords: newest `datetime`, number of snapshots billed, `cost` (decides B4 source).
7. `search_intent` for Arabic and English keywords without a language field: language handling, refusal or silent English.
8. SERP organic advanced with `people_also_ask_click_depth: 2` and `load_async_ai_overview: true` on a UAE keyword: billed cost
   (aio surcharge or not, $0.00015/click) and the `people_also_ask_expanded_element` fields when the answer is a page.
9. `serp/google/autocomplete/live/advanced` 2784/en with `client: "gws-wiz-serp"`: item shape and `cost`.
10. `content_analysis/search` with `page_type: ["message-boards"]` on a UAE B2B keyword: do reddit.com / quora.com appear at all.
11. `ai_keyword_data` 2784/en: non-zero values or zeros (can be read from production *AI Demand* outputs instead: R3).
12. `google_trends/explore` single keyword with `google_trends_queries_list`: the list item fields (sandbox returned only the graph).
13. `ranked_keywords` with a **page URL** target: top-level `metrics.organic.etv` per URL (the TP fallback if 1 fails).

Endpoints whose live shape is already proven by the engine or a fixture (no new check): competitors_domain (basic), ranked_keywords,
domain_rank_overview, keyword_ideas / suggestions / related, keyword_overview, SERP organic advanced (aio, PAA, related),
ai_mode, ai_keyword_data (request), llm_mentions (new paths), llm_responses, backlinks domain_intersection partial, referring_domains,
bulk_ranks, content_analysis search.

## 12. Caveats list for engineers

- Read `tasks[0].status_code`, not HTTP status; 40501 names the bad field; 40402 = bad path; sandbox 20000 proves nothing about field
  names.
- `limit` max 1000 everywhere probed (1001 refused); keywords: serp_competitors 200, keyword_ideas 200, keyword_overview 700,
  historical_keyword_data 700, bulk_keyword_difficulty / search_intent / ai_keyword_data / Google Ads volume 1000, google_ads
  keywords_for_keywords 20, Trends 5; targets: bulk_traffic_estimation 1000, bulk_ranks 1000, backlinks / Labs page intersection 20,
  exclude 10; filters 8; order_by 3.
- Deprecated paths still answering: `llm_mentions/search` -> `search_mentions`, `llm_mentions/top_domains` -> `top_mentioned_domains`
  (with `platform`). Use the new ones; the old live fixtures are kept only as shapes.
- Labs positions and `etv` are DataForSEO's model on its stored SERPs (weekly-monthly), not today's Google: label "modelled, fetched
  <last_updated_time>". `etv` = volume x CTR curve.
- Google Ads volumes are buckets and close-variant groups; never show two variants' identical numbers as independent demand.
- `exclude_top_domains: true` hides reddit / quora / youtube / wikipedia / linkedin: the A1 spec wants them tagged, so do not use it
  on the discovery call (the engine's *Find Competitors* sets it true today).
- Domain fields want bare hosts (no scheme, no www); page fields want absolute URLs; parse hosts with a regex (no `URL` in the n8n
  sandbox).
- Every paid node: no node-level retry (retry_lint), ledger reserve before, settle from `cost` after (INVARIANTS rule 3, R17).

## 13. Live confirmations (2026-11-08)

Method: 19 POSTs to `https://api.dataforseo.com/v3/` (live, paid) on 2026-11-07 20:06-20:10 UTC (2026-11-08 PKT) from a throwaway
`node:22-bookworm-slim` container, credentials loaded with `env_settings.load_env()` and passed by env var, never printed or written;
each body validated in the sandbox first ($0); a hard cap of $0.40 on the summed `tasks[0].cost`; no retries. 13 approved items plus
5 cheap diagnostics where the first answer was ambiguous (marked "diag") and one free refusal. Market UAE English (2784/en).
**Balance $33.201983 before, $33.001467 after = $0.200516, exactly the sum of the `cost` fields** (no other spend in that window).
Trimmed real responses: `r5_shapes/LIVE_KI_*.json` (arrays cut to 3, `offset_token` redacted because it is base64 of the request
including the account id).

### 13.0 Two findings that change more than the KI build

- **L-1 (High, production too): live SERP organic results now come back wrapped in Google's click redirect.** Both live
  `serp/google/organic/live/advanced` calls (2 of 2, 2784/en, 2026-11-07) return every `organic` and `local_pack` item with
  `domain: "google.com"`, `url: "https://google.com/goto?url=CAES..."` (opaque token, not decodable), `main_domain: null`,
  `relative_url: null`, and `links[].url` wrapped the same way. The real host survives only in `breadcrumb` (`"https://sqitconsulting.com
  › microsoft-dynamics-365"`; for social results it is `"3 reactions · 1 month ago"`) and sometimes `website_name` (a host or a brand
  name: `"sqitconsulting.com"`, `"Blueflame Labs"`, `"Facebook · TechMantra GULF DMCC"`); local_pack items keep only `title` and `cid`.
  The full result URL is gone. `ai_overview.references[]` still carry real `domain` / `url`. The 2026-10-02 fixture (`aio.json`) had
  real domains; the facts search saw goto URLs from 2026-10-29 (`_sources.js` FU-SV); R3 found google.com as "top competitor" on
  devaicon's 11-04 discovery and the 11-05/06 rank readings: the same cause. Labs data (stored SERPs: page_intersection, ranked_keywords,
  historical_serps) is NOT affected. Not verified in the engine, but by reading: `_rank_serp.js:98` finds our own result with
  `bare(o.domain) || hostOf(o.url)` (so it would read "google.com" and never find the client), `Ladder_Clusters.js:77` clusters on
  `x.url || x.domain` (every goto token is unique, so no two keywords would ever share a URL), and competitor picking would count
  google.com. **Every SERP reader must recover the host from `breadcrumb` (regex `^https?://([^/\s›]+)`), then `website_name` when it is a
  host, else mark the result "host unknown"; clustering must compare host + breadcrumb path, never `url`.** Worth a production check of
  `seo_rank_history` since late October before the KI build.
- **L-2 (High for A1): Labs has no data for techand.ai in UAE.** `competitors_domain` techand.ai returned `items: null`,
  `total_count: null` with and without `max_rank_group` (both billed $0.012), and `bulk_traffic_estimation` gives
  `https://www.techand.ai/` `count 0, etv 0`, although Search Console shows thousands of impressions. A1 cannot start from
  `competitors_domain` for our clients; it must start from `serp_competitors` on keywords Labs holds, or from live SERPs (with L-1's
  host recovery). Empty answers are billed the task base.

### 13.1 Per item

| # | Call (file) | Question | Answer | Cost |
|---|---|---|---|---|
| 1 | `bulk_traffic_estimation`, 3 page URLs (`LIVE_KI_labs_bulk_traffic_estimation_pages.json`) | Page URLs accepted? Price class? | **Yes**, absolute `https://` page URLs accepted; items `{se_type, target (echo), metrics{organic{etv float, count int}, paid null, local_pack null, featured_snippet null}}`; a page with nothing returns `etv 0, count 0` (still a billed row). Items come back in a different order than sent: join on `target`. **Standard Labs price**: $0.012 + 3 x $0.00012 = $0.01236 (not the $0.12 historical class). | $0.01236 |
| 2 | `page_intersection` union, `https://www.dynamicssquare.com/*` + `https://www.intwo.cloud/*`, `exclude_pages` `https://www.techand.ai/*` (`LIVE_KI_labs_page_intersection_union.json`) | Wildcard, null entries, totals | `*` after a slash works live (the `_` form was not needed). `total_count` 29 at the top of `result[0]`; items `{se_type, keyword_data{...}, intersection_result{"1": serp_element or null, "2": ...}}`: **null where that page set does not rank** (union: 2 of 3 rows had one null). Rows include deep positions (rank_group 82): filter with `["intersection_result.$page.rank_group", "<=", 20]` style paths (`labs_available_filters.json` lists `intersection_result.$page.*`). Noise to expect: intwo's customer-story pages rank for customer names ("al nasr contracting company llc"). | $0.01236 |
| 3 | `domain_intersection` `intersections:false` (`LIVE_KI_labs_domain_intersection_false.json`) | `second_domain_serp_element` null? `ai_overview_reference` refused live? | **`ai_overview_reference` is refused live too**: 40501 "Invalid Field: 'item_types'", cost 0. Re-sent with `item_types ["organic"]`: `total_count` 27; `second_domain_serp_element` is **present and `null`** on every row (key exists). Use `first_domain_serp_element.rank_group` to cut deep rows. | $0 + $0.01236 |
| 4 | `competitors_domain` techand.ai (max_rank_group 20; diag without it); diag dynamicssquare.com limit 1 (`LIVE_KI_labs_competitors_domain.json`) | `competitor_metrics` live? `max_rank_group` on a small site | techand.ai: `items: null`, `total_count: null` both ways (L-2). dynamicssquare.com: `total_count` 72; item keys `se_type, domain, avg_position, sum_position, intersections, full_domain_metrics, metrics, competitor_metrics` - **`competitor_metrics` exists live** (same `organic/paid/...` bucket shape as `metrics`). The first row is the target itself (`intersections` 8 = its own count; `metrics` == `competitor_metrics` on that row): skip `domain == target`. Billing: $0.012 with 0 rows, $0.01212 with 1. | $0.012 + $0.012 + $0.01212 |
| 5 | `serp_competitors` 3 B2B seeds (`dynamics 365 partner uae`, `microsoft dynamics partner dubai`, `erp partner dubai`); diag `erp software uae` (`LIVE_KI_labs_serp_competitors.json`) | `keywords_positions` keyed by keyword; coverage | The 3 Dynamics/partner seeds: `items: null`, `total_count: null` (no stored SERP for any; billed $0.012). `erp software uae`: `total_count` 63, items `{domain (with www.), avg_position, median_position, rating, etv, keywords_count, visibility, relevant_serp_items, keywords_positions{"erp software uae": [1, 15]}}`: **keyed by keyword, value = every position of that domain** (local pack and organic, rank_absolute-like), so `avg_position` 8 with `median_position` 1 is normal. Coverage for long B2B seeds is poor: send many seeds, expect most to be absent. | $0.012 + $0.01236 |
| 6 | `historical_serps` `erp software uae`, `date_from` 2026-05-01 (`LIVE_KI_labs_historical_serps.json`) | Freshness, snapshots, price | 2 snapshots since 2026-05-01: **2026-06-03 and 2026-08-26 (newest 73 days old)**; each a full deep page (`items_count` 113 / 98: local_pack + ~100 organic, PAA, related), real domains (no goto). **Billed $0.00012 per snapshot, no task base** ($0.00024). Too stale and too sparse to replace live SERPs for B4 clustering of current results; usable as a cheap "what ranked this summer" fallback and immune to L-1. | $0.00024 |
| 7 | `search_intent`, 1 English + 2 Arabic keywords, `location_code` sent, no language (`LIVE_KI_labs_search_intent.json`) | Arabic handling | No refusal; **`location_code` silently dropped** (absent from the `data` echo; the endpoint takes `keywords` only). Arabic keywords get labels: `شريك مايكروسوفت دايناميكس في الإمارات` commercial 0.604, `برنامج محاسبة` commercial 0.605 + secondary informational 0.3046; English `dynamics 365 partner uae` commercial 0.837. Items `{keyword, keyword_intent{label, probability float}, secondary_keyword_intents [{label, probability}] or null}`; no language field in the response. Arabic probabilities are lower: treat < 0.65 as "unsure". $0.012 + $0.00012/keyword. | $0.01236 |
| 8 | SERP organic advanced, `people_also_ask_click_depth` 2 + `load_async_ai_overview` true: `dynamics 365 partner uae`; diag `erp software uae` (`LIVE_KI_serp_organic_advanced_paa_aio.json`) | aio surcharge, click price, expanded fields | **CORRECTION C1 (finding 4): the aio surcharge is real when Google serves the overview asynchronously.** `dynamics 365 partner uae`: `ai_overview` with `asynchronous_ai_overview: true`, 4 items, 3 references, no PAA: **$0.004** = $0.002 + $0.002. `erp software uae`: no AI overview, PAA of 9 questions (4 + 5 from 2 clicks, `seed_question` names the parent): **$0.0023** = $0.002 + 2 x $0.00015. The 2026-10-02 fixture was $0.002 because its overview was inline (`asynchronous_ai_overview: false`). **Every PAA answer was `people_also_ask_ai_overview_expanded_element` with `asynchronous_ai_overview: true`, `items` empty, no references**: no answer URL, no `people_also_ask_expanded_element` seen (2 of 2 UAE SERPs): PAA gives questions only. Plus L-1. The SERP `datetime` is the call time (fresh). | $0.004 + $0.0023 |
| 9 | autocomplete `dynamics 365 partner`, `client gws-wiz-serp` (`LIVE_KI_serp_autocomplete.json`) | Shape, cost | $0.002 per request. `result[0]` `{keyword, type "autocomplete", se_domain, location_code, language_code, check_url (gl=AE), datetime, item_types, se_results_count 0, items_count 10}`; items `{type, rank_group, rank_absolute, relevance null, suggestion, suggestion_type null, search_query_url, thumbnail_url null, highlighted}`. **Suggestions are not localised** despite gl=AE: "partners uk", "in usa", "in houston", "australia", "new york", only one "in dubai". Drop suggestions naming another country/city before use; no volume (enrich with keyword_overview). | $0.002 |
| 10 | `content_analysis/search` `dynamics 365`, `page_type ["message-boards"]`, filter `main_domain in [reddit.com, quora.com]`; diag same with `search_mode one_per_domain`, limit 10 (`LIVE_KI_content_analysis_search_message_boards.json`) | Reddit / Quora coverage | **Reddit and Quora: `total_count` 0** (filter path `main_domain` exists in the item, so the zero is real). Unfiltered: 2,268 message-board pages, first 10 domains math.answers.com, egpet.net, techcommunity.microsoft.com, baarez.com, capterra.in, capterra.mx, compararsoftware.com.br, teletechdigital.com, blitzhandel24.nl, b2bstore.com: vendor forums and review sites, mostly US / other countries, none UAE. **Content Analysis is not a community-question source**; finding 8 stands and is now measured. **An empty result is billed the base + 1 row** ($0.024036). | $0.024036 + $0.02436 |
| 11 | `ai_keyword_data` 2784/en, 3 keywords (`LIVE_KI_ai_keyword_data_search_volume.json`) | Zeros or values in UAE | Real small values: `erp software uae` 3 (12 months 0..7), `dynamics 365 partner uae` 0 (1 in Nov/Dec 2025), `open edx hosting` 0 for all 12 months. Shape as documented (`ai_search_volume`, `ai_monthly_searches[{year, month, ai_search_volume}]`). Zeros are common for B2B: show "too little AI demand to measure", never "no AI demand". $0.01 + 3 x $0.0001. | $0.0103 |
| 12 | `google_trends/explore` `["dynamics 365"]`, 2784, past_12_months, graph + queries_list (`LIVE_KI_google_trends_explore_queries_list.json`) | queries_list fields | Two items. Graph: 53 weekly points `{date_from, date_to, timestamp, missing_data, values[int]}`, `averages: []` for one keyword. **queries_list: `{position, type "google_trends_queries_list", title null, keywords, data{top[{query, value int 0-100}], rising[{query, value int}]}}`**; `rising` value is percent growth (108600 = Google's "Breakout"), 10 top and 1 rising here. $0.011 live as listed. | $0.011 |
| 13 | `ranked_keywords` target = page URL `https://www.dynamicssquare.com/products/microsoft-dynamics-365/` (`LIVE_KI_labs_ranked_keywords_page.json`) | Per-URL metrics | Page URL accepted; top-level `metrics.organic` per URL (`etv` 8.102, `count` 3, pos buckets, `is_new/up/down/lost`, plus `ai_overview_reference: null` key) **equal to bulk_traffic_estimation's figure for the same URL** (8.102 / 3): item 1 is the cheaper TP source, this is the fallback with keyword detail. Each row's `ranked_serp_element.last_updated_time` varied from 2026-07-21 to 2026-10-07: Labs positions can be 1-4 months old. | $0.01236 |

### 13.2 Corrections to earlier sections (marked)

- **C1 (section 0 finding 4, section 6, section 10)**: `load_async_ai_overview` IS surcharged (+$0.002, one base price) when the
  overview is asynchronous and gets loaded; not when it is inline or absent. Model +$0.002 on the share of SERPs with an async overview
  (1 of 2 today); the "~$1.39 if aio is surcharged" line of section 10 is the realistic upper bound.
- **C2 (section 6 organic element, section 1 "real live elements")**: organic `domain` / `url` / `main_domain` / `relative_url` /
  `links[].url` can no longer be trusted on live SERPs (L-1). The field list is right; their content is a redirect.
- **C3 (section 3 competitors_domain)**: `competitor_metrics` is present live (not only in the sandbox). The first row is the target
  itself. A small UAE site can have no Labs data at all (L-2).
- **C4 (section 3 page_intersection)**: the wildcard is `*` (confirmed live); filter paths are `intersection_result.$page.<field>`.
- **C5 (section 3 domain_intersection)**: `ai_overview_reference` is refused live as well as in the sandbox (free 40501);
  `second_domain_serp_element` is a present key with value `null` when `intersections: false`.
- **C6 (section 3 bulk_traffic_estimation, section 0 finding 5)**: standard Labs price confirmed live ($0.012 + $0.00012/target).
- **C7 (section 4 historical_serps)**: price is $0.00012 per snapshot with no task base; UAE snapshots are ~quarterly (newest 73 days).
- **C8 (section 4 search_intent)**: `location_code` is dropped silently, like `language_code`; Arabic is labelled.
- **C9 (section 6 autocomplete)**: with `gws-wiz-serp`, `relevance`, `suggestion_type` and `thumbnail_url` are null; suggestions are
  not country-filtered.
- **C10 (section 6 people_also_ask)**: in UAE PAA answers are AI-overview placeholders with no URL (2 of 2 SERPs); do not plan on PAA
  answer URLs as competitor pages.
- **C11 (billing, section 0 finding 3)**: Labs empty answers cost the task base ($0.012); Content Analysis empty answers cost base + 1 row.

### 13.3 What the KI workflow must do differently

1. Recover SERP hosts from `breadcrumb` / `website_name` (L-1) in one shared kit used by every SERP reader; cluster on host + path.
2. A1: do not rely on `competitors_domain` for the client (L-2); use `serp_competitors` over many seeds + live SERP hosts; call
   `competitors_domain` on the *competitors* (they have data) and skip the self row.
3. Cut deep rows in intersections with `intersection_result.$page.rank_group <= 20` / `first_domain_serp_element.rank_group <= 20`.
4. B5 traffic potential: `bulk_traffic_estimation` with page URLs (standard price), join on `target`.
5. B3: `search_intent` takes `keywords` only; Arabic works; treat probability < 0.65 as unsure.
6. B2: autocomplete needs a country/city filter; Trends `rising` values are percent (Breakout = very large number).
7. No community-question source from DataForSEO (Content Analysis has no Reddit / Quora); PAA = questions only.
8. Budget the aio surcharge on async overviews; label Labs positions with their `last_updated_time` (up to 4 months old).
