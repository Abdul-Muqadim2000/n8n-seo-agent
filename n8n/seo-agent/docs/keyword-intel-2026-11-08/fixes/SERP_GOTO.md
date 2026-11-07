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

## 10. Review fixes (2026-11-08, `../REVIEW_SERP_GOTO.md`, verdict "ship after fixes")

| Item | Fix | Where | Proof (harness unless said) |
|---|---|---|---|
| **H1** cut breadcrumbs collapsed to `~host/…` and could merge searches | `SU.key` gives a key only to an exact url or a COMPLETE slug path; a cut, label or host-only breadcrumb has none, so it neither matches nor counts toward `min_urls` | `_serp_url.js` `key` | SG7: two searches whose top 7 hold different (cut) posts of delemontechnology / brainsphereit / singleclic: no merge after the fix, no merge with the exact addresses before; two searches with the same complete pages still merge. SG6: keys only for the 4 complete slug paths of the live answer |
| **H2** the -1 rule could hide a real fall for ever | (a) host: Unicode / IDN labels, punycode TLD (`xn--mgbaam7a8h`), scheme optional; (b) -1 only when a hidden result could be ours (our domain label in its website_name / title / breadcrumb), else 0 with `unresolved: n`; (c) Tracker Plan counts the streak (`prev_unread`); the 2nd reading in a row writes ONE ops alert row to `seo_ops_alerts` (undelivered, due now) that the existing B-A7 sweep sends in the same run; the 3rd says 0 ("not found among the results we could read"); Site Tracker: a -1 after a stored -1 says 0; (d) an unpublished rung after an unreadable -1 is deferred like a 0, so no extra weekly checks | `_serp_url.js` `HOST` `crumbHost` `couldBe`, `_rank_serp.js` `hidden` `ourRank`, `Tracker_Plan.js`, `Parse_Positions.js`, `Unread_Alert_Row.js` + 3 nodes in the Rank Tracker (`build_ladder_extras.py` `_unread_alert`), `Site_SERP_Requests.js`, `Parse_Site_SERP.js` | SG1 (müller.de, xn--, en.wikipedia.org), SG3 (someone else's hidden result -> 0; ours -> -1 with `mo`), SG8 (-1, -1, then 0; one alert on the 2nd only, no `delivered` written; wiring Ensure -> Row -> IF -> Save -> Load Open Alerts; Tracker Plan defers and skips poisoned rows) |
| **M1** app mirrors | `cadence.ts` `prevReading` skips poisoned rows (`poisonedRow`, the engine's rule); `data.ts` `snapTop`: an approximate row is shown as its site (host, no link, `approximate: true`), bare redirects dropped; `RankingsPage.tsx` renders such a row without a link; shared type extended (optional fields) | `app/server/src/services/cadence.ts`, `data.ts`, `app/shared/src/data.ts`, `app/web/src/pages/site/RankingsPage.tsx` | `app/server/test/serpGoto.test.ts` (4 tests) |
| **M2** Pick Top 6 read page labels as paths | a breadcrumb is a path only when every segment is a slug (`/^[a-z0-9%._~-]+$/`); labels (`› Home › Blog`) are `url_path: 'labels'`, partial, skipped like a cut one | `_serp_url.js` `crumbPath` | SG1 (odooerp.ae is `labels`), SG5 (3 picked, odooerp and brainsphereit skipped) |
| **M3** cannibalisation said "none" when it could not see | `own_hidden` when any of our results is approximate (or a hidden result could be ours): `own_n` left out, `cannibal` says "not checked" with the reason | `_rank_serp.js` | SG3 |
| **M4** approximate addresses voted on the page type | `KWI.serpPageTypes` skips `url_exact: false`; every caller passes the flag (Assess Response, Build Keyword Strategy, Ladder Clusters, Pick Top 6's `serp_top10`) | `_kw_inputs.js`, callers | SG5 (`serp_top10` marked) |
| **L1** prototype key | `hasOwnProperty` on the social table | `_serp_url.js` | SG1 ("Constructor" unresolved) |
| **L2** `carried()` could throw / take userinfo as host | one host rule (`hostOfUrl`), userinfo refused, never throws | `_serp_url.js` | SG1 |
| **L3** local pack / featured snippet "not ours" when unknown | `ours: null` when the listings / snippet have no site | `_rank_serp.js` `features` | SG3 |
| **L4** Tracker Plan read poisoned rows | `!RS.poisonedRow(h)` on the won test and the deferral | `Tracker_Plan.js` | SG8 |
| **L5** regulatory reason | names the hidden addresses when that is why nothing was read | `Regulatory_SERP_Candidates.js` | by reading |
| **L6** guard too narrow | build section 181 now also walks every live SERP HTTP node's connections (through IF / Wait / retry copies) to the first Code node, and every node naming one, and every node reading stored `serp:` rows or `snapshot_json`; each must carry SU (two named exceptions, each with its reason). It states what it still does not see (a Code node calling DataForSEO itself, Execute Workflow hand-offs, a reader that holds the kit but ignores `url_exact`, the app) | `build_v4.py` end | build log: A 66 kit users, B 34 answer nodes, C 27 live readers, D 28 stored-reading readers |

Deploy scope after the review: the same 9 workflows, plus 3 new nodes in the Rank Tracker (`Unread Alert Row (Tracker)`, `Unread Alert? (Tracker)`, `Save Unread Alert (Tracker)`; no new column, `seo_ops_alerts` exists) and the app (API: cadence.ts / data.ts; web: RankingsPage; no migration).

Checks after the review fixes: build exit 0 (section 181: A 66, B 34, C 27, D 28); full harness in a throwaway n8nio/n8n:2.41.4 container
**17544 passed, 0 failed** (17515 at 175ff5cd; scenario SG1-SG8 now 107 checks); app typecheck clean in all three workspaces, tests shared
**1125**, server **1978** (+46 skipped, incl. the new `serpGoto.test.ts`), web **317**, with the whole repo mounted in node:22-bookworm-slim.
Not done here (owner rules for customer-facing changes): the marketing changelog line and a TUTORIALS_BACKLOG row for the Rankings page
showing a result Google hid as its site, without a link.

## 11. Re-review fixes (2026-11-08, "Re-review of 36c1882a" in `../REVIEW_SERP_GOTO.md`, verdict SHIP with N1 before deploy)

**N1 (the settled reading was a false "dropped out of the top 50").** The settled reading is no longer a 0. It **stays -1** and carries
`st: 1` in the existing `snapshot_json` (no new column), so no reader can compute a delta, a "lost" or a chart point from it: every
path already treats -1 as "could not be told" (the Tracker Report's delta, `prevReading` / `stableReading`, the app's `rankSeries`).
What changed is the wording: `SU.unreadNote` gives "could not be told: a result Google hid may be yours" (`mo`) or, once settled,
"not found among the results we could read" (`st`), and every place that reports the position says it instead of "check failed":
the Tracker Report (`posText(v, note)`, ladder rows and the customer's own keywords), the Site Tracker (Site Metrics `serp_note`,
Site Report), and the app (`rankSeries.latestNote` -> `latestNote` on ladder rungs and tracked keywords, shown under the position;
the position itself stays the last real one). The streak counts **calendar weeks** (Monday-based, UTC; this run's week not counted; a
catch-up or an app re-check in the same week is one week; a failed API read, -1 without `mo`, ends it): `SU.unreadWeeks`, used by the
Rank Tracker's plan and the Site Tracker's plan (`unread_weeks` on `serp_positions`). Week 2 raises the ops alert (Rank Tracker), week 3
onwards is settled (both trackers). The unread rules live in SU so both trackers use one copy.

**N3.** One alert row per keyword and week (`rank-unread|<domain>|<keyword>|<monday>`): a second keyword of the same site on the same day
is its own alert; a re-run in the same week finds its own row and sends nothing twice. `mode` is the execution's mode.

**N4.** `RS.pack`'s last-resort overflow object keeps `at`, `device`, `unavailable`, `ur`, `mo`, `st`, `own_hidden`.

**L6 (rest).** Guard C now also treats an HTTP node with an expression url as a live SERP node when the Code node feeding it builds SERP
endpoints (Rank Tracker, Site Tracker, Keyword Check, AI Growth, AI Visibility), plus each one's "(Retry)" copy: 19 SERP HTTP nodes,
33 live readers, all carrying SU.

Not done (Low, no client affected today): N2 (an IDN client domain stored in punycode while Google shows Unicode, or the reverse).

Proofs: harness SG8 (week 3 stays -1 with `st`, the report wording in the generated Tracker Report, weekly streak cases: two weeks, three
readings in one week = 1, a failed read ends it, this week = 0; two keywords = two alert keys; overflow keeps `mo` / `ur`; Site Tracker
settles only from week 3 and stays -1); app `serpGoto.test.ts` (latest stays the last real position with the note; settled note; a
failed check and a normal reading carry none).

Checks after the re-review fixes: build exit 0 (section 181: A 66, B 34, C 33 readers of 19 SERP HTTP nodes, D 68); full harness in a
throwaway n8nio/n8n:2.41.4 container with workflows/ in the copy **17559 passed, 0 failed** (a first run beside the app tests failed only
AD10, the AIR diagnosis speed budget, 280 ms vs 200 ms under the parallel load; untouched code, passes alone); app typecheck clean, shared
**1125**, server **1980** (+46 skipped), web **317**.
