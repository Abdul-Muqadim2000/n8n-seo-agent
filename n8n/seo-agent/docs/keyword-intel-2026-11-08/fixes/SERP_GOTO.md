# SERP-GOTO: the site behind Google's redirect links (2026-11-08, hotfix)

Branch `hotfix/serp-goto` (from `feature/seo-agent-v4.5`). **Not pushed, not deployed.** Defect L-1 of `../R5_DATAFORSEO.md` section 13.0.

## 1. The defect

DataForSEO's LIVE Google organic SERP (`serp/google/organic/live/advanced`, and `live/regular`, `live/html`, desktop or mobile,
UAE or US) answers every organic and local-pack item with `domain: "google.com"`, `url: "https://google.com/goto?url=CAES..."`
(an opaque token, not decodable), `main_domain` / `relative_url` null and `links[].url` wrapped the same way. What survives:
`breadcrumb` (`"https://www.sage.com › en-ae › erp"`, sometimes cut: `"› best-erp-sof..."`, sometimes page labels: `"› Home › Blog"`)
and sometimes `website_name` (a host, a brand, or `"Facebook · <page>"`). AI Overview references keep real urls. Labs data is clean.

Cause (outside us): Google serves `/goto` links since August 2026. DataForSEO resolved them until Google started throttling the
resolution per results page; their note of 2026-11-02 ("New GoTo URL limits and how this affects your results",
https://dataforseo.com/update/new-goto-url-limits-and-how-this-affects-your-results) says **Standard priority resolves all goto
URLs (slower), High priority and Live resolve about 50%**. Our live probes of 2026-11-08 resolved **0 of 50** organic urls on Live.

## 2. Every reader of live SERP items (before the fix)

Where the answer enters (now normalised):

| Entry point | File | What read google.com |
|---|---|---|
| every DataForSEO answer node (`<X> Answers`, 40+ nodes in 9 workflows: SERP Check, SERP Check (Site), Run Research, Run Ladder Research, Candidate / Fallback / AI / Regulatory SERP, Run Assess Requests, Run LB DFS, Run Discovery, Run AI Extra Requests, AI Rank SERP Call, ...) | `dfs_gate.py:120` (`answers_js`) | everything downstream of them |
| the shared SERP cache (stores and serves readings) | `v5/code/_serp_cache.js:69` (`reading`), `:99` (`lookup`) | compacted google.com / goto into `seo_cache serp:*` (107 production rows) |
| the rank kit (Rank Tracker, Site Tracker) | `v5/code/_rank_serp.js:52` (`read`), `:100` (`ourRank`: `isOurs(bare(o.domain) \|\| hostOf(o.url))`), `:117` (`landscape`), `:77` featured snippet owner, `:81` local pack ours | the client never found; google.com as competitor #1 |
| nodes reading a SERP node directly (main workflow) | `build_v4.py:13719` Pick Top 6 (competitor pages to read; google.com was on its skip list, so **no competitor page** was read), `v5/code/Clean_Competitor_Pages.js:124-125` (featured snippet owner, forum threads), `v5/code/Ladder_Plan.js:329` (head results page, fit rules), `v5/code/Collect_Facts.js:22` (citable facts), `v5/code/Ladder_Clusters.js:81` (clusters on `x.url`: no two keywords ever shared a url) | |

Downstream readers (fixed by the entry points, checked by reading): `v5/code/_competitors.js:116` (competitor picking, `host(it.domain \|\| it.url)`),
`Competitor_Keyword_Requests.js:21`, `Collect_Research.js:63`, `Build_Keyword_Strategy.js:58` (top domains, your position),
`Rank_Keywords.js:289`, `Assess_Result.js:33` (Keyword Check "who ranks"), `Regulatory_SERP_Candidates.js:14` (official pages to read),
`AI_Rank_Fetched.js:89` (AI ranking fan-out results), `AI_Rank_Plan.js:59` and `AI_Rank_Requests.js:111` (stored `serp:*` readings of
any date), `_ai_w2e3.js:86` (AI visibility fan-out gap), `Parse_Positions.js:14`, `Parse_Site_SERP.js:13`, `Tracker_Report.js` (drops,
"outranked since", cannibalisation, churn from stored snapshots), `LB_Page_Requests.js:13` (Link Builder), `Prompt_Jobs.js:29` (PAA only,
unaffected), `_fit_gate.js:296` (`fitSerpDomains`, no caller). Not touched: the AI answer parsers (they read AI Overview / AI mode
references, which are real urls; goto citations were already dropped by the `google|bing` filter of Parse AI Answers).

## 3. The rule (one kit: `v5/code/_serp_url.js`, `SU`)

* **Redirect**: url host `google.<tld>` with path `/goto`, `/url`, `/search/url`, `/aclk`, or Bing `/ck/a`. A normal Google result
  (`support.google.com/...`, `www.google.com/search/howsearchworks/`) is NOT a redirect and passes untouched.
* A redirect that **carries** its target (`?q=https://...`, `?url=https%3A...`) is read as that target, exactly (FU-SV's rule).
* Otherwise the **host** comes from the breadcrumb (text before the first ` › `, must look like a host), else from `website_name` when it
  is a host, else from a known social network named before ` · ` (`Facebook · X` -> facebook.com). Nothing found: **unresolved**,
  `domain: null`, `url: null`, never google.com.
* The **url** is `https://<host>/<breadcrumb segments>`: APPROXIMATE (`url_exact: false`, `url_recovered`, `relative_url`,
  `redirect_url` = the original). A cut segment drops itself and the rest: `url_partial: true`, url = the home page.
* An item that is not a redirect is returned as the **same object**: old fixtures and clean answers are byte-identical.
* Where it applies: every `<X> Answers` node (`SU.fixAnswer`), SC (`reading` stores recovered items with their flags; `lookup` refuses
  a stored reading that still holds bare redirects: "read before the 2026-11-08 fix"), RS (`read`), and the five direct readers.
  The build (section 181) fails if a node calls SU without the kit or an Answers node does not pass its answers through it.

What readers may do with an approximate url:

| Reader | Rule |
|---|---|
| own-site rank (Rank Tracker, Site Tracker, fan-out gap) | **by host**: found at its position; the page is "not identified" (`url: ''`, `page_identified: false`), never a guessed page |
| not found while a result has no site | position **-1** ("check again"): no drop, no "lost" alert, no "not in the top 50" |
| cannibalisation | only results with an exact url are pages of ours; two of ours behind redirects are not "two pages compete" |
| churn ("the whole page moved") | when either stored reading is approximate (`x: 1` in the snapshot), both are compared **by site** |
| stored readings from the broken weeks (top list holds goto urls) | never a baseline (`RS.prevReading` / `stableReading` skip them), "outranked since" refuses them, AI ranking ignores them |
| competitors / landscape / top domains | by host; unresolved items are skipped |
| clustering (Ladder Clusters, Ladder Plan head) | exact url key, or `SU.key` = `~host/path` (same result read twice -> same key; never equals an exact key). Recovered paths are approximate, so two keywords whose pages Google shows with the same breadcrumb are treated as sharing that page |
| competitor pages to read (Pick Top 6) | a full breadcrumb address is read (marked `url_exact: false`); a cut one is skipped ("only the site is known") |
| cited sources (Collect Facts, regulatory pages) | **exact url only**: an approximate result is named in `facts_unlinkable` with its site, never cited |

Measured on the live pair (same search, 2026-11-08, Live vs Standard 83 s later): 9 of 9 organic hosts recovered, positions 1-3 identical,
7 of 9 hosts present in the exact reading (SERPs move between two reads); of the 5 full breadcrumbs, 4 equal the real path (+/- trailing
slash), 1 is page labels (`odooerp.ae › Home › Blog`, real `/en/blog/top-10-...`); 4 of 9 breadcrumbs are cut.

## 4. Tests

* New harness scenario `harness/scenarios_serp_goto.js` (SG1-SG6, 78 checks) on the real live answers
  (`harness/fixtures_live/serp_goto/`: the Live goto answer and the Standard exact answer of the same search, and R5's two live L0 answers):
  hosts recovered and equal to the exact reading's, no google.com anywhere, local pack unresolved, clean answers and the 2026-10-02
  fixture byte-identical, support.google.com kept, own site at position 8 by host with the page not identified, -1 with an unresolved
  result, no false cannibalisation, churn by site, a poisoned stored reading never a baseline nor "outranked", SC stores / refuses,
  the generated SERP Check Answers, Pick Top 6 and Collect Facts nodes, the clustering key.
* Updated: `scenarios_w2e3.js`, `scenarios_rengine.js`, one RS extraction in `scenarios_v5.js` (they lift kits out of generated nodes;
  SU now comes with SC / RS).
* Full harness in a throwaway `n8nio/n8n:2.41.4` container: **17515 passed, 0 failed** (baseline before the change on this worktree:
  17433 passed, 1 failed = CY32, which needs a build; production's last recorded count 17434 / 0). Build exit 0, all lints.

## 5. What changed (deploy scope)

Code only, no wiring, no node added or removed, no Data Table column, no app change. Workflows (node-diff vs HEAD):
`SEOagentV4Full01` (38 nodes: Pick Top 6, Collect Facts, Analyze Competitor Pages, Ladder Plan, Ladder Clusters, Ladder Cluster
Requests, the SERP cache nodes, Regulatory SERP Candidates and every `<X> Answers`), `SEOagentTracker1` (8), `SEOagentSiteTrk1` (3),
`SEOagentAIGrow1` (5), `SEOagentAIVisib1` (9: the AIX fan-out kit and the SC kit text, two Answers nodes), `SEOagentAssess` (4), `SEOagentBacklnk1` (3, Answers nodes only: no-op on backlink
answers), `SEOagentLinkBld1` (1), `SEOagentCadence1` (1, the SC kit text). Deploy with `deploy/gcp/deploy_engine.py` after merging
origin/main and node-diffing production (the rule of 2026-10-30).

## 6. Production blast radius (read-only, 2026-11-08)

Raw data: `~/seo-agent-secrets/serp-goto-2026-11-08/` (700). Queries: scratchpad `hotfix/prod/q*.sql`.

* **Since when**: last clean `serp:*` reading 2026-10-27 13:10Z; first goto reading **2026-10-30 09:29Z** (devaicon); every reading since
  is goto (11-02 3/3, 11-03 21/21, 11-04 22/22, 11-05 14/14, 11-06 46/46). **107 poisoned `seo_cache` rows** (techand 82, devaicon 25),
  2,091 organic + 35 local-pack items; no breadcrumb stored, so they cannot be repaired, only read again.
* **seo_rank_history**: techand 10-25 found 5/8, 10-29 3/5, **11-05 1/14** (12 at 0); devaicon 0/10 on 11-06 (it was 0 before too).
  Search Console says techand still ranks ~25-45 on those queries.
* **Client-facing wrong outputs** (app reports, nothing e-mailed: `report_deliveries` and `webhook_deliveries` have no rows; the 16
  `seo_ops_alerts` since 11-04 are owner ops alerts, none about rankings):
  * **techand.ai Rank Tracker report of 2026-11-05 01:13** (reports `707e7953`, `c5dd7e0e`, `eabfca21`): **3 false drops**
    ("is microsoft dynamics 365 an erp system #28 -> not in top 50", "ms 365 erp #39 -> not in top 50; the whole results page moved",
    "dynamics 365 erp system #22 -> not in top 50") and **google.com as the top competitor** (5 keywords, best position 1).
  * devaicon.com Rank Tracker 2026-11-06 (`c9b0982d`, `4738c27c`): google.com in the competitor lists (no false drop: no earlier position).
  * devaicon keyword strategy 2026-11-04 (`a918573a`): google.com in `top_domains` for ~14 keywords.
  * devaicon ladder plan 2026-11-04 (`b31ff813`, ladder `lad_mw28vc20jc4w` "agentic ai development in uae"): "no other business ranked
    often enough ... passed over: google.com" (the real rivals were hidden) and clusters built on unique goto urls; techand ladder
    `lad_mw0goinsniv1` "crm service provider" created 11-03 on goto readings.
  * 8 content runs since 11-04 (techand 1, devaicon 7): brief `top10` of goto urls; competitor pages not read (Pick Top 6 skipped google.com).
  * devaicon Site Tracker 11-06: "cannot rank for 'ai development companies' (not in the top 50)" - the page really is unknown to Google.
  * AI ranking: 1 goto source row in `seo_ai_rank_sources` (devaicon); 10 goto citations in `seo_ai_answers` (ai_mode / overview).
  * No google.com in `seo_monitors`, `seo_sites`, app `sites`, `keyword_checks`, `keyword_proposals`, `ladder_rechecks`.

## 7. Proposed repair (NOT run; the owner decides)

1. Deploy this fix (engine only).
2. `seo_cache`: delete the 107 `serp:*` rows containing `google.com/goto` (the fix already refuses them today; deleting stops AI ranking
   and any reader of old rows from even looking). Cost of re-reading: one SERP per keyword on the next run, already budgeted.
3. `seo_rank_history`: set `position = -1` on the 21 rows checked since 2026-10-30 whose snapshot holds goto urls (techand ids 157-169
   except the one row that still matched, devaicon 223-229 and 231). The fix already ignores them as a baseline; the repair makes the
   dashboard charts stop showing "not in top 50" on those dates. `seo_query_history`: `serp_position = -1` on the 16 live-check rows at 0
   since 10-30.
4. Re-run the Rank Tracker for both sites after the deploy (about 24 checks, ~$0.05), then mark the 5 Rank Tracker reports above as
   superseded (or delete them) so the app shows the new reading.
5. Re-check the two ladders built on goto readings (competitors, clusters), flag devaicon's keyword strategy `a918573a` and the 8 content
   briefs as made on unreadable results pages (their pages were written without competitor pages read); remove the goto source row of
   `seo_ai_rank_sources`.
6. **Tell techand.ai** that the 2026-11-05 drops (#28 / #39 / #22 -> "not in the top 50") were a reading error on our side: Search Console
   shows those pages still ranking around 25-45; and that google.com is not a competitor.

## 8. Better source of exact urls (follow-up, not built)

Probed live (cap $0.10, spent **$0.0126**, balance $33.00 -> $32.99): Live advanced desktop, Live regular, Live advanced mobile
(organic still goto; the mobile local pack had real urls), Live advanced macOS, Live html (the HTML itself carries only `/goto?url=`
links; the cite shows `https://www.sage.com › en-ae › erp`), Live US 2840: **all goto**. **Standard priority** (`serp/google/organic/task_post`
priority 1 + `task_get/advanced`): ready in 83 s, **every organic and local-pack url exact**, and cheaper ($0.0006 vs $0.002).
The weekly paths (Rank Tracker, Site Tracker, AI ranking fan-out, ladder clusters) can afford a 1-3 minute wait: moving them to
task_post + task_get (a Wait + poll loop, or a postback) would give exact pages back; the interactive paths (Keyword Check, verdict)
stay on Live with this normaliser. This kit stays as the safety net either way.

## 9. Spend

DataForSEO live probes $0.0126 (6 Live calls at $0.002, one Standard task at $0.0006). No Claude spend. No production write.
