# R2: web app audit of keywords and competitors (KI programme, 2026-11-08)

Scope: `app/web/src` (React), `app/server/src` (Fastify), `app/shared/src`, read as a customer meets them. Read-only audit; nothing run,
nothing paid. Paths are relative to `app/` unless they start with `n8n/`. Line numbers are of branch `feature/seo-agent-v4.5` at c5d4ab88.

Headline: the app already has most of the plumbing a Competitors page and an advanced Keyword research page need (run lifecycle,
credits, report renderers, DataTable, insight kit, guides, recommendations with measured/modelled labels, CSV pattern, admin-only
switch pattern). What it lacks is (a) one decision vocabulary for "should I go for this keyword" (today there are six scores and three
word scales), (b) any place where competitors are a first-class object (they are 3 domains typed in 3 forms, stored in 2 places, never
discovered), and (c) keyword data that outlives a report (no keyword table, no check history, no export).

---------------------------------------------------------------------------------------------------------------------------------

## 1. Every screen where a customer meets keywords

### 1.1 Onboarding "Your first keyword" (`web/src/pages/onboarding/_components/KeywordStep.tsx`)
- Question: "What would a customer type into Google to find a business like yours?" (:199). Up to 3 typed ideas (`MAX_IDEAS` :29), each a
  paid keyword check (`useAssessKeyword` :80, hint "about N credits (free if checked in the last few hours)" :207). Spinner "Checking
  your chances. This takes 5 to 20 seconds." (:223).
- Poor fit card (`poorFit` :43-49): "This looks outside what you sell, so we would not write for it." / "...looking for one particular
  company or website." / "This is not realistic for your website right now." + engine alternatives as chips (:430-447) or "Try a more
  specific search, for example with your service and your city." (:450).
- Good fit: `KeywordChoiceCard` (`components/site/KeywordChoiceCard.tsx`) with "Your chances: Good chance / Takes a few months / Hard for
  your website now" (`CHANCE_WORDS`, `shared/src/cycles.ts:396`), "About N people search this a month" (:21-25), "About 3-4 pages over
  2-4 months" (`PLAN_PAGES` :27), "About N credits a page", "Why we suggest it: ..." (:113). Not rated: "Chances not rated yet" (:93),
  plus "We could not rate your chances yet; the plan rates them when it starts." (KeywordStep :460). Evidence lines from
  `checkEvidenceLines` (`shared/src/keywords.ts:219-234`): matched page and "results page read earlier today, used again at no extra cost".
- Suggestions: free setup research (`useRecommendedKeywords(..., poll: true)` :81). States: running "We are finding keywords for X. This
  takes about 2 minutes" (:282), none -> "Find keywords for me" (:268-271), ready -> up to 6 cards (`MAX_SUGGESTIONS` :31), filter at
  :158 drops not_realistic, plan none and overlaps. First card badged "Our first pick" (:298).
- Then per pick Auto ("Write a page each week") / Manual ("Ask me before each page") (:327-341) and the autopilot level 1-3 with a
  monthly credit forecast (:363-378). Nothing starts here; launch step starts it.
- Research start: `BusinessStep.tsx:38-40` fires `POST .../research/start` (free once per registrable domain, `server/src/services/research.ts:13-27`,
  grant table `free_research_grants`, `SETUP_HOURS = 24` :29). Discover input forced `receiveReport: false` (:69-70).

### 1.2 Keyword check (assess)
- Route `server/src/routes/keywords.ts:17-25` `POST /api/orgs/:orgId/sites/:siteId/keywords/assess` (role member, verified site, route
  limit 20/min) and `:27-33` `GET .../keywords/recommended` (viewer, free).
- Service `server/src/services/keywordChecks.ts`: market/country/script mismatch warnings BEFORE paying (`checkWrite('keyword_check')`
  :179-183, 409 `confirm_needed`), context = ladder keywords + case-study services (:187-188), reuse window 6 h keyed by engine rules
  hash + context hash (`engineRulesVersion` :84-90 hashes the generated fit gate; `checkContextHash` :97-108; `KEYWORD_CHECK.cacheHours`
  `shared/src/keywords.ts:49`), reserve under company lock (`keywordCheckStore.ts:72-97`: 409 running, 429 at 30/day/company, budget 402,
  platform ceiling, `assertCredits`), call n8n `assessCall` (timeout 45 s), map errors to plain words (`interpretAssess` :116-139, provider
  names stripped :142), store result (`finishCheck`) or drop/fail free (`dropCheck` :106-109).
- Table `keyword_checks` (`server/src/db/schema.ts:648-673`): org, site, user, keyword, country, status, result jsonb (engine snake_case),
  cost_usd, automatic, rules_version, context_hash, created_at. Charged by the cost sync from `cost_usd` (`services/admin/costSync.ts:19`,
  :576-591), not from the engine ledger.
- Answer shape `KeywordAssessment` (`shared/src/keywords.ts:155-186`): volume, kd, intent, cpc, position(+url), reach, difficultyForYou
  (easy/reachable/hard/very_hard/not_realistic), planType (direct/short/full/none), months, stretch, fit 0/1/2/null, navigational,
  alternatives (max 5), label, warnings (max 5), existingPage, reading. Parsed tolerant by `toAssessment` :253-282.
- No list/history endpoint: the only reader of past checks is `recentChecks()` for auto-start (`keywordCheckStore.ts:112-118`).

### 1.3 "New keyword ladder" 3-step flow (`web/src/pages/site/NewLadderPage.tsx`, `/o/:org/sites/:site/pipeline/new`, router.tsx:18)
- Step 1 Choose: "Recommended for you" cards (`KeywordCard`, `pages/site/_components/pipeline/new-ladder.tsx:156-237`) with
  `DifficultyBadge` ("Easy for your site" ... "Not realistic for your site", `components/site/keyword.tsx:18-27`, labels
  `DIFFICULTY_LABEL` shared/keywords.ts:16-22), a 5-step `DifficultyScale` (new-ladder.tsx:125-135), "Searches a month" and either "Your
  position now #N" or "Difficulty (any site) N / 100" with a Meter (:198-218), why (line-clamp 3), overlap warning "Your ladder X already
  covers this search ... One search needs one page." (:221-226). "Choose for me" (`chooseForMe` shared/keywords.ts:461-463: first easy or
  reachable, no overlap, not service-out, not career). Stale (>90 days) and other-country callouts (:303, :315). Empty state text :279-280.
- "I have a keyword in mind" -> `CheckPanel` (:375+) -> `CheckResult` (:487-562): callouts "not realistic" (critical), "looks outside your
  business" (warning), "Very hard for your website today" (info); footer "Checked just now (N credits)" / "Checked on DATE: shown again for
  free", then "Your website already wins searches up to difficulty N.", topic line, evidence lines (:519-532); alternatives "Keywords to
  check instead" each a further paid check (:534-560).
- Step 2 Review (`ReviewStep` :588+): plan in words (`PLAN_ORDER_TEXT` shared/keywords.ts:34-38), checks list (topic, credits), mode
  Auto/Manual, priority (admins), pages to write now 1-3, monthly tracking forecast computed in the component (:565-567, :621).
- Step 3 Start (`StartStep` :819+): `ladder` run with `ladderPrefs`, `pagesNow`, `chosenBy`; toast "It shows on the Pipeline in about 5-8
  minutes" (:864). "Advanced form" = the full ladder tool for experts (:104).
- Research button `StartResearchButton` (:182-232): free when `freeResearch`, else a paid `discover` run.

### 1.4 Tool forms (`web/src/pages/tools/_components/forms/research.tsx`, `/o/:org/tools/:mode`)
- `verdict` ("Keyword verdict", MODES `shared/src/constants.ts:159-170`): "We read the top 10 Google results, pull volume, difficulty and
  trend, and judge whether a page can win." (research.tsx:42). Result GO / GO WITH CHANGES / AVOID + "Opportunity score".
- `keyword` ("Write a page", :149-230): the page run; "Keyword report" option = "Competitor analysis, the verdict with reasons and risks,
  keyword data and secondary keywords (PDF and Word)" (:217).
- `discover` ("Keyword discovery", :355-395): info "About 600 keywords from several sources are scored, reviewed by AI for relevance,
  grouped into topics and checked live on Google." (:355); follow-ups: keyword report for the best keyword, **"Write the page for the best
  keyword (+N credits)"** (:386), audit none / technical / full.
- `ladder` (advanced ladder form), `track` (tracked keywords, competitors).

### 1.5 Pipeline (`web/src/pages/site/PipelinePage.tsx`, `_components/pipeline/*`)
- Needs you kinds touching keywords: `keyword` (choose one), `proposal`, `recheck`, `overlap`, `duplicate` (`shared/src/data.ts:1373`,
  guides `shared/src/guide-links.ts:10-27`).
- Proposals (`proposals.tsx`): levels 1-2 "A keyword we suggest ... nothing starts without your OK" (:50-54), level 3 announcement with a
  countdown; Start / Show me others / Not now / swap a typed keyword (checked first, 409 `keyword_not_suitable` with the check).
- Coming up (`coming-up.tsx`): two days before each cycle, items with source badge, decision badge, "Checking again" (recheck after 60
  days, `RECHECK_LINE` :231), "Waits for your profile"; Skip / Approve this week or always.
- Ladder cards and ladder page (`LadderPage.tsx`, `ladders.tsx`, `climb.tsx`): rung keywords, positions, KD per page in the ladder report.

### 1.6 Rankings (`web/src/pages/site/RankingsPage.tsx`)
- Hero: keywords checked weekly, top 10, top 50, movement (:144-155); distribution bar; "Biggest moves"; ladders; "Tracked site keywords"
  table (:705-731) with Position, Change, Best, Trend, Ranking page, Search features, **Share of voice** (labelled "estimated, not
  measured clicks" :277, method line :700), Mobile, Checked.
- Keyword dialog `SerpPanel` (:644-703): results-page features with date, AI Overview cites you / not / unknown with "one observation"
  caveat, **"Above you on page 1"** with a `competitor` badge for tracked rivals (:673-685), the top N read with date and device.
- No export, no competitor column, no filter by competitor.

### 1.7 Search & traffic (`web/src/pages/site/SearchPage.tsx`, `_components/QueryExplorer.tsx`)
- Query table: Clicks, Impressions, CTR, Avg. position, Change, Live (tracked only), Page; filters All / Striking distance 4-20 / Top 10 /
  New / Lost / Tracked (QueryExplorer.tsx:17-21, :141). Query dialog actions: "Check the keyword" -> **verdict run** (paid, minutes),
  "Improve the ranking page" / "Write a page for it" (:176-182). No "track it", no "plan a ladder", no cheap keyword check.
- "Did your changes help?" impact table (SearchPage.tsx:383-417).

### 1.8 Recommendations (`server/src/services/recommendations.ts`)
- Keyword ones: `search:striking` (positions 4-20, >= 20 impressions, :238-259, impact modelled with `basis` text), `search:ctr`
  (:261-275), `search:drop` (measured, :277-292), `keyword:research` / `keyword:first` (:436-438), `content:trend` (:442), `rank:next`
  (:449), `rank:drop` (:452: "Check the ranking page and what moved above it", action = refresh page). Each recommendation can carry
  `impact`, `confidence: measured|modelled`, `effort`, `basis` (good pattern to reuse).
- No competitor or keyword-gap recommendation exists.

### 1.9 Report renderers (`web/src/components/reports/`, dispatch `ReportView.tsx:29-55`)
- `keyword_strategy` -> `strategy.tsx` `KeywordStrategyReport`: hero "Start with X" or "N keywords fit your business" (:180), stats
  "Keywords researched", "Reviewed by AI for relevance", "Relevant to your business", "Topic clusters" (:199-202); Start-with card
  (searches/month, Difficulty, Cost per click in $, Traffic potential with measured/modelled badge :58-69, live SERP: your position, AI
  Overview, "Ranking today" top domains, People also ask :225-296); tables Priority keywords / Quick wins / Searches you already appear
  for (GSC no_page, striking, answered) / Searches that share a results page (SERP clusters) / Content plan Now-Next-Later / Questions /
  AI search demand / **Competitor gaps** (:486-489). Columns (:126-160): Keyword, For your site, Volume, KD, CPC, Traffic potential,
  Opportunity, AI volume, Write/Rank buttons. InfoTip on Priority = reach text (:169-172).
- `content` (verdict and page runs) -> `content.tsx`: "Go / Go with changes / Avoid" (`VERDICT_LABEL` kit.tsx:48) + "Opportunity score"
  ring (:173, :206), Why / Risks, Keyword data (searches, Difficulty N/100 with label, CPC $, intent, ads competition, trend year/quarter,
  12-month chart :256-300), competitor backlink strength line "Pages ranking now average N referring domains and N backlinks" (:279-284),
  Secondary keywords, Existing page as raw key/value (:505-512).
- `ladder_plan` -> `ladder.tsx`: feasibility ring with GO / GO WITH CHANGES / AVOID (:239-246), head KD "Keyword difficulty, 0-100" (:118),
  "Why this plan" with "difficulty is N against your reach of N" (:294), per-page "KD N" (:438).
- `site_audit` / `full_report` -> `audit.tsx`: technical findings only; the full report's competitor and keyword sections are **PDF only**
  (comment :27; payload keys used are health, issues, diff, search_console, site_structure, entity, internal links).

### 1.10 Tracked keywords and competitors in settings
- Tracked keywords: `TrackingForm.tsx` (max 20, normalized lower case, :140-150), schema `trackInput.keywords stringList(20,100)`
  (`shared/src/schemas.ts:322+`), also `updateSiteSchema.keywords` max 20 (:178-181). Guide `keywords-to-track`.
- Competitors are entered in three places, all max 3 (`domainList(3)` schemas.ts:33, :164, :281, :329, :465, :473):
  1. Business details "More details" (`components/site/SiteBusinessFields.tsx:256-262`, hint "Used for share of voice in AI answers, the
     backlink gap and the full SEO report"), used in onboarding WebsiteStep/BusinessStep, AddSitePage and Website settings > Business.
  2. Tracking form (`TrackingForm.tsx:165-176`, hint "Compared in AI answers, backlinks and the monthly report").
  3. Monitor settings card (`SiteSettingsPage.tsx:463-513`), saved through Site Admin `monitors` with `competitors` (routes/sites.ts:670,
     `siteAdminMonitorsBody` payload.ts:88-94).
  Guide `competitors` (`shared/src/guides.ts:1690-1716`): Google your searches by hand, keep look-alikes, drop marketplaces, "Stay at three".
- Where competitors reach the engine: payloads of `audit` (payload.ts:185), `track` (:213), `ai_visibility` (:309), `backlinks` (:315),
  Site Admin monitors. NOT sent with `discover`, `verdict`, `keyword`, `ladder` (payload.ts:126-205) nor the keyword check body
  (`assessBody` keywordChecks.ts:62-74; competitors only enter its cache hash :104). Whether the engine reads `seo_monitors.competitors`
  for discovery is R1's question.

## 2. Competitor views today

| Where | What | Data source | Gaps |
|---|---|---|---|
| Strategy report "Competitor gaps" (strategy.tsx:486-489) | keywords "your competitors rank for and you do not", same columns as Priority | `payload.competitor_gaps` | no column names which competitor, its position or URL; no filters; report-bound (dies with the next report) |
| Rankings keyword dialog (RankingsPage.tsx:673-685) | domains above you on page 1, tracked ones badged | `seo_rank_history.competitors_json` (`server/src/services/data.ts:545-565`) | `SerpReading.competitors` (positions of your tracked rivals for that keyword) is computed in data.ts:565 and typed (shared/data.ts:218) but **never rendered** |
| Rankings table "Share of voice" (RankingsPage.tsx:728) | modelled share of page-1 clicks per keyword | rank history `share_of_voice` | no per-competitor SOV across keywords |
| Strategy start-with card "Ranking today" (strategy.tsx:274-287) | top domains for the one keyword | `start_with.live.top_domains` | one keyword only |
| Content report (content.tsx:279-284, :441-456) | avg referring domains / backlinks of ranking pages; topic coverage vs best competitor; originality vs competitor pages | `keyword_data.competitor_backlink_strength`, `meta.coverage` | numbers without names |
| AI visibility (`AiVisibilityPage.tsx:250-260`, `_components/ai-trends.tsx`, `ai-compare.tsx`, `ai-panels2.tsx:213`, `ai-rules.tsx:120-142`) | share of voice by brand with mentions, star = set competitor; per-competitor trends with 95% range; sentiment vs each competitor; alert rule `competitor_share` | `seo_ai_visibility` sov/compare json | mature; the best model for a Competitors page (ranges, breaks on panel change, CSV) |
| Backlinks (`BacklinksPage.tsx:616-696`, `CompetitorList` :809-840) | lists naming competitors, competitors' new links, link gap, competitor link counts incl. Common Crawl graph | `seo_backlink_snapshots`, `seo_link_graph` | empty state "Add competitors in the monitor settings" (:811) |
| Link building listings (recommendations.ts:229) | "Get listed on X: <competitors> are there and you are not" | `seo_listings` | |
| Full SEO report (audit mode `full`) | competitors, backlinks, AI in the **PDF** | engine PDF | nothing in-app (audit.tsx:27) |

There is no competitor list page, no competitor discovery, no competitor profile, no keyword gap by competitor, no top pages, no
monitoring of competitor moves outside AI and backlinks.

## 3. Run lifecycle and plumbing a new capability must use

1. **Mode registry**: `MODE_IDS` + `MODES[mode]` (`shared/src/constants.ts:117-131`, :159-306: title, summary, delivers, category
   `keywords`, `costUsd` via `modeCostUsd`, `etaMinutes`, `siteBound`, `finalStages`, `startStages`). The engine's front door must accept
   the mode (Quick Validate / Normalize Input) and harness S23 must replay it.
2. **Schema**: one zod object per mode in `RUN_SCHEMAS` + `runInputSchema` union (`shared/src/schemas.ts:479-512`), `parseRunInput`
   (:518). Server-only fields (`pagesHeld`, `chosenBy: system_announced`) are overwritten server side (`inputForRole`, runs.ts:173).
3. **Payload**: `buildN8nPayload` (`shared/src/payload.ts:122+`). KEY ORDER RULE (:3-7): `head()` (:118-120) = `mode, keyword, country,
   domain, email, callback_url, business, customers` first, empty strings included; longer keys after; exact keys only after the head
   (`services`, `chosen_by`, `hold_ack`...). Then `npm run export:payloads` -> `n8n/seo-agent/harness/fixtures_platform.json` -> harness S23.
4. **Cost and credits**: `CostKey` union + `COST_TABLE` mirror of `n8n/seo-agent/v5/code/_cost_cal.js` (`shared/src/cost.ts:41-95`),
   `costKeys(mode, v)` (:186-228), `estimateRunCost` (:271), calibration from the engine (`services/engineCost.ts`, web
   `lib/engine-cal.ts`). Quote = `quoteCredits` (`services/billing.ts:66`, same rounding as `runCredits.ts:13-16`). Under one company
   lock in `createRunWithMeta` (`services/runs.ts:246-462`): idempotency replay (:345-356), `assertBudget` / `assertPlatformCapacity`
   (`services/spend.ts:95-109`), `assertCredits` (billing.ts:295; 402 reasons on_demand_limit / balance / reserve, `docs/CREDITS.md` section 1),
   insert with `estimatedCostUsd`, `quotedCredits`. Charge = cost sync every 10 min from the engine's `seo_run_ledger` tied by
   execution id / request id (`services/admin/costSync.ts:11-48`), capped at the quote, failed run refunded once (`failed:<run id>`).
   UI: `lib/prices.ts` `PRICES.*` (one price per run, `web/test/onePrice.test.ts`), `lib/credits.ts` `quoteLabel` / `creditsLabel`,
   never `formatUsd` of a cost (CONVENTIONS "Credits, never cost"). Free once: `opts.free` (research.ts:101).
5. **Warnings before start**: `runWarnings` + `assertConsistent` (runs.ts:283-287), 409 `confirm_needed` with ids, "Continue anyway" in
   `acknowledge`, recorded by `recordOverride` (audit log). Same for the keyword check (`checkWrite('keyword_check')`).
6. **Start and watch**: `startRun` -> n8n `POST /webhook/seo-keyword-check` with `X-Forwarded-For: app:<company>`; status submitting ->
   accepted (request id = front door execution id) -> running -> done/failed. Watcher `services/engineFailures.ts` reads failed executions
   of the workflows in `WATCHED` (:15) and closes quiet runs after `runOverdueMinutes` (3x eta, min 10, `shared/src/run-watch.ts:10-16`);
   **a new workflow must be added to `WATCHED`**. 3-hour stale expiry `expireStaleRuns` (runs.ts:632).
7. **Callbacks**: `POST /api/hooks/n8n/:token` (`routes/hooks.ts`, 40 MB, 600/min) -> `ingestCallback` (runs.ts:815) -> report row +
   files, `runOutcome`, `afterCallback` (:927). New stage: `STAGE_LABELS` (constants.ts:322), `MODES.finalStages`, `SCHEDULED_STAGES`
   if a schedule sends it (:320), `summaries.ts` case (list summary, :28-234), renderer in `ReportView.tsx` RENDERERS, `callbackCostCountsForRun`.
8. **Reports**: list/detail `/o/:org/reports[/:id]`, files (PDF/Word/CSV/zip made by the engine, rendered via Gotenberg) as download
   cards (`components/reports/visuals.tsx` ReportDownloads), share link `/share/:token` (CONVENTIONS "Pages a client sees": `NAMED` keys,
   caveat, `deliveryDecision`), report delivery by e-mail / signed webhook (`services/reportDelivery.ts`).
9. **Recommendations**: `services/recommendations.ts` `add({id, category, priority, title, detail, evidence, action, secondary, taskKey,
   guideVars}, {impact, confidence, effort, basis})`; action targets `page`, `mode`+`prefill`, `report`, `href`. Guides auto via
   `GUIDE_FOR_RECOMMENDATION`.
10. **Needs you**: kinds in `shared/src/data.ts:1373`; a new kind does not compile until `GUIDE_FOR_NEEDS_YOU_KIND` names a guide
    (guide-links.ts:10). Server builds them in `services/pipeline.ts`.
11. **Site tasks**: `shared/src/site-tasks.ts` + check in `services/siteTasks.ts` for anything the client must change on their site
    (CONVENTIONS "Setup guides").
12. **Flags and per-site settings**: no generic feature-flag table. Patterns: env flag in `server/src/config.ts` (e.g. `AUTO_START_LADDERS`
    :121, :243); a shared constant (`AI_RANK_OPEN_TO_CLIENTS = false`, `shared/src/ai-rank.ts:430`) + server guard
    `aiRankMayChange` (:436-441) + `isPlatformAdmin` in the Site Admin route (routes/sites.ts:664-669); the per-site mode lives in the
    engine (`seo_monitors.ai_rank_mode` off/shadow/on, sent through Site Admin `monitors`), read-only "Off" for clients (`aiRankClientMode`
    :444). Per company: `org.creditsEnforced`, `creditLimits`, plan credits; platform settings row (`services/admin/settings.ts`).
13. **Roles and isolation**: `orgAccess` / `siteAccess(req, org, site, min)` (`server/src/auth/access.ts:49`, :132; site must belong to the
    org), `requireVerified` (:141), viewer < member (start runs, checks) < admin (settings) < owner; client portal roles
    `client_viewer` / `client_approver` with `clientSafePayload` (routes/data.ts:24-25) and `PORTAL_SITE_PAGES` (OrgLayout.tsx:74).
    n8n tables are keyed by domain, so the verified-owner rule is the isolation.
14. **Rate limits**: runs 30/min/route (routes/runs.ts:55), engine 40 runs/day/company (build section 21), keyword checks 30/day/company +
    20/min route, AI CSV 30/10 min, login etc.
15. **CSV export**: exists for AI data only among site data (`GET .../data/ai/export?kind=`, routes/data.ts:103-114, `shared/src/ai-export.ts`
    with `csvCell` formula-injection guard from `shared/src/identity.ts`), plus credits activity, audit log, agency overview, admin
    companies. Client-side `downloadText` (`web/src/lib/utils.ts`). **No keyword, ranking or competitor CSV.**
16. **Public API / MCP**: `routes/apiV1.ts` read endpoints (:306-327), `TOOLS` (:130-245): `list_modes` and `preview_run` / `start_run`
    read `MODES` and `RUN_SCHEMAS`, so a new mode appears there automatically; `get_table` enum (:219) = rank_history, site_metrics,
    audit_findings, ai_visibility, backlinks, runs (a new keyword/competitor table must be added there and in `tableRowsV1`). The keyword
    check is not an API/MCP tool.
17. **Data reads**: `server/src/n8n/client.ts` `siteRows(TableKey, domain)` over `TABLES` (`shared/src/tables.ts:423-485`); a new engine
    table needs a `TABLES` key (and a column constant when the app creates it).
18. **Guides**: `shared/src/guides.ts` (`@seo/shared/guides`, lazy), `GuideButton` from `components/guide`; rule: an ask without a guide is a
    bug; `guides.test.ts` checks copy (no dashes, no curly quotes, `CHANCE_WORDS` must appear in `choose-first-keyword`, guides.test.ts:216).
19. **Marketing**: `web/src/marketing/content/features.ts` (`keyword-research` :181-246 already claims competitors in discovery),
    `changelog.ts` newest-first, CapabilityMap `GROUPS`, CapabilityScreen `APP_PATH`, pricing/solutions lists; tutorials backlog row
    (owner rule 2026-10-30).
20. **Audit log**: every new admin write calls `audit()` with an action from `AUDIT_ACTIONS` (`shared/src/identity.ts`).

## 4. UX gaps and defects in the keyword experience (ranked by impact)

High
- **H1 Discovery form promises a page that is never written, and quotes it.** `research.tsx:386` offers "Write the page for the best
  keyword (+N credits)" and lists "The page for the best keyword" under what you get (:348); the client estimate adds a `content` key
  (`cost.ts:209`, about 114 credits); the schema silently forces `receiveContent` to false (`schemas.ts:262`, R-K6), so the server quote
  excludes it and nothing is written. False promise plus a form price that differs from the charge. Fix: remove the option.
- **H2 No single answer to "should I go for this keyword?".** A customer can see, for one keyword: "Your chances: Takes a few months"
  (CHANCE_WORDS, onboarding/proposals), "Reachable for your site" (DIFFICULTY_LABEL, new ladder, strategy, ladder report), "Go with
  changes" (verdict), "Opportunity score 64" (content.tsx:173), "Opportunity 71" (strategy column :158, no InfoTip), a feasibility ring
  (ladder.tsx:239), "KD 38" / "Difficulty (any site) 38 / 100", and an "estimated chance fair (30-50%, uncalibrated)" text. Tones also
  disagree: very_hard is `warning` in `CHANCE_TONE` (KeywordChoiceCard.tsx:18) but `serious` in `DIFFICULTY_TONE` (keyword.tsx:8);
  not_realistic warning vs critical. A non-technical client cannot reconcile these. The owner's "Go / Takes a few months / Hard for
  your site now" matches CHANCE_WORDS: make it the one verdict, everything else a factor behind an InfoTip.
- **H3 Competitors are not a real object.** Max 3, typed by hand (the guide tells the client to Google it), in three forms, stored twice:
  Postgres `sites.competitors` (Business tab PATCH, routes/sites.ts:360-425 syncs only `facts` to the engine, :421) and the engine's
  `seo_monitors.competitors` (Site Admin / track). The Monitors card shows the engine list first (SiteSettingsPage.tsx:297), the forms
  the Postgres one: editing competitors in Website settings > Business changes nothing in the engine until tracking is saved again, and
  the two lists can disagree on one screen. Hints describe three different uses (SiteBusinessFields:261, TrackingForm:171, guide). No
  discovery, no "watchlist", no platform tagging.
- **H4 Keyword data dies with the report.** Recommended keywords are re-derived from the latest `keyword_strategy` report only
  (`recommendedKeywords` keywordChecks.ts:211-225, max 12, `recommendedFromStrategy` shared/keywords.ts:399-457); there is no keyword
  table, no keyword check history screen (only `recentChecks` for auto-start), no merge across research runs, GSC queries and checks,
  no "save for later". A customer who checked 5 keywords last week cannot find them.
- **H5 Marketing says more than the app shows.** `features.ts:186,189,205` say discovery uses "your competitors", but the discover payload
  carries no competitors (payload.ts:160-175; R1 to confirm the engine side); the full report's competitor/keyword analysis is PDF only
  (audit.tsx:27); "Competitor gaps" names no competitor (strategy.tsx:486-489).

Medium
- **M1 Two "check" concepts with the same word.** "Check it" = keyword check (3 credits, seconds, difficulty for your site); "Check the
  keyword" in the query dialog = a verdict run (minutes, more credits, GO/AVOID) (QueryExplorer.tsx:176). The Search page never offers the
  cheap check or "Rank for it".
- **M2 Numbers without source, date or meaning.** "Searches a month" has no market, period or provider date anywhere outside the
  content report's "Google, <country>" (content.tsx:256); KD shown as "KD" header (strategy.tsx:155) and "Difficulty (any site)" with only a
  `title` attribute (new-ladder.tsx:211); "Opportunity" column with no explanation; CPC in $ with no currency note (country may be AED);
  "AI volume" without "monthly, from where". Traffic potential is the one figure with measured/modelled (strategy.tsx:58-69) and the
  recommendations carry `confidence` + `basis`; extend that everywhere.
- **M3 Jargon about reach.** "Your website already wins searches up to difficulty 23." (NewLadderPage.tsx:523), the Priority InfoTip
  "Easy = up to 28 ... reachable = up to 43" (strategy.tsx:169-172), "against your reach of 23" (ladder.tsx:294): a client cannot use
  a bare difficulty number. Say "sites like yours already rank for searches this hard" with an example keyword they rank for.
- **M4 Three definitions of "striking distance".** App filter and recommendation: positions 4-20 (QueryExplorer.tsx:21; recommendations.ts:238
  with >= 20 impressions); marketing FAQ: "eighth and twentieth" (features.ts:231); owner note: 8-20 with 100+ impressions. Pick one,
  shared constant.
- **M5 Plan size in three tables.** `PLAN_PAGES` 3-4 / 4-6 / 9-13 (KeywordChoiceCard.tsx:27), `PLAN_ORDER_TEXT` "up to about 12"
  (shared/keywords.ts:37), `PAGES_OF` 4 / 6 / 12 (NewLadderPage.tsx:566) plus a hard-coded `RANK_CHECK_USD = 0.015` in a component
  (:567, against the "one cost table" rule).
- **M6 Two prices for a keyword check.** Held at `KEYWORD_CHECK.estimateUsd` 0.05 (shared/keywords.ts:42, keywordCheckStore.ts:90, :93),
  shown as `PRICES.check()` = `COST_TABLE.assess` 0.04 (cost.ts:92). Both round to 3 credits today; a calibration move splits them.
- **M7 Research time contradicts itself.** "about 2 minutes" (KeywordStep.tsx:282, NewLadderPage.tsx:218, free) vs "about 10 minutes"
  (NewLadderPage.tsx:207, paid; MODES.discover.etaMinutes 10).
- **M8 Competitor positions computed but hidden.** `SerpReading.competitors` (data.ts:565) never rendered; the Rankings table cannot show
  "you #8, rival A #3, rival B #5" though the data is there.
- **M9 No export of keywords or rankings.** DataTable has search/sort/paging only (`components/ui/table.tsx:27-48`); only AI data has CSV.
- **M10 `rank:drop` gives no why.** "Check the ranking page and what moved above it" (recommendations.ts:452) while the SERP reading of who
  moved above is in the rankings data; link to the dialog or say who passed you.

Low
- **L1 Stale API.md**: `KeywordCheck` documented with `costUsd` (API.md:346, :582); the type sends `credits` (shared/keywords.ts:291,
  keywordChecks.ts:145). Recommended order documented as "easy, reachable, not rated..." (API.md:345) while the code keeps the engine's
  order (shared/keywords.ts:442-456).
- **L2 Raw keys reach customers**: `ExistingPage` renders engine keys with `_` replaced (content.tsx:505-512); `arr2str` falls back to
  `JSON.stringify` for research failures (strategy.tsx:496-498).
- **L3 Two entry points to a ladder**: Overview setup "Plan a keyword ladder" opens the expert ladder tool (`ToolButton mode="ladder"`,
  OverviewPage.tsx:465) and skips the checked 3-step flow; the empty state at :655 uses `pipeline/new`.
- **L4 Alternatives cost a check each** with no batch ("Each check uses about N credits", NewLadderPage.tsx:559) and 3 ideas max at
  onboarding; a research-style batch check of 10 candidates is missing.
- **L5 `months.replace('-', '-')`** no-op (keyword.tsx:36, strategy.tsx:82), en dash risk if the engine changes; cosmetic.
- **L6 "Reviewed by AI for relevance"** (strategy.tsx:200) explains the engine, not what it means for the client.

## 5. What a "Competitors" page and an advanced "Keyword research" page plug into

Routes and nav
- Add to `siteDataPages` (`web/src/router.tsx:14-33`), e.g. `{ path: 'competitors' }` and `{ path: 'keywords' }` (lazy page, default
  export), entries in `SITE_NAV` (`components/layout/OrgLayout.tsx:56-71`, icon per DESIGN.md) between Rankings and Content; decide
  whether they join `PORTAL_SITE_PAGES` (:74) for agency clients (then server `clientSafePayload`). Paths in `web/src/lib/paths.ts`
  (`paths.site(org, site, 'competitors')`), hooks in `web/src/lib/queries.ts` (one per endpoint, `useSiteData` pattern).
- Server: `GET /api/orgs/:orgId/sites/:siteId/data/competitors` and `.../data/keywords` in `routes/data.ts` with the existing `guard` /
  `portal` (verified, viewer or client_viewer), shape in `server/src/services/data.ts`, type in `shared/src/data.ts`. Writes (pick /
  watchlist / dismiss) through Site Admin (`routes/sites.ts:633+`, `adminActionSchema` schemas.ts:588) or a new route with `audit()`.
- Runs: new modes (e.g. `competitors`, `keyword_research`) through the full chain of section 3, or new options on `discover`. A paid
  module run must write `seo_run_ledger` rows tied to the request id so the cost sync charges it once; partial runs keep finished
  stages (callback per stage, `startStages`).
- Page anatomy (DESIGN.md): `PageHeader icon` -> notices -> `SummaryHero tone="blue"` with 2-4 `HeroStat` + `HeroNextStep` -> `MetricCard`
  row -> "What to do next" `InsightItem` list -> `ChartCard` + side list -> `DataTable` -> details in `Collapsible`. Reuse:
  `RankedBars` (share bars with a "You" row) and `HeroChip` / `FigureTile` / `DashSkeleton` (`pages/site/_components/visuals.tsx`),
  `PositionPill` / `PositionMove` / `bucketOf` (`_components/positions.tsx`), `DifficultyBadge` / `PlanBadge` (`components/site/keyword.tsx`),
  `KeywordChoiceCard`, `KeywordCard` / `DifficultyScale` (`pipeline/new-ladder.tsx`), `VolumeBar` / `KdMeter` / `ScoreMark` / `ReportHero`
  (`components/reports/visuals.tsx`), `TrafficPotential` measured/modelled badge (strategy.tsx:58), `SerpPanel` (RankingsPage.tsx:644),
  AI trends with ranges and breaks (`_components/ai-trends.tsx`, `ai-compare.tsx`), `CompetitorList` (BacklinksPage.tsx:809), `ShareBars`
  and `ChartCard` (table toggle required) from `components/charts`, `InfoTip`, `DistributionBar`, `TrendChip`, `ScoreRing`.
- Tables: `DataTable` (`components/ui/table.tsx:27`: `columns` with `sortValue`, `cell`, `align`, `hideOnMobile`; `initialSort`,
  `pageSize`, `searchable`, `searchText`). It has no column filters, no multi-select and no export: filters today are a `Segmented`
  above the table (QueryExplorer.tsx:136-145 pattern). CSV: copy the AI export route (streamed, company-scoped, `csvCell`).
- Actions per row: `WriteLink` / `RankLink` (strategy.tsx:20-50) to the page tool and `pipeline/new?keyword=&country=&tab=check`,
  `useAssessKeyword` for a check, Link Builder prospect via Site Admin `prospect` for a backlink gap, AI panel question add via
  `ai_prompts` (needs approval).
- Guides: new ids for "pick your competitors" (replace the manual-Google steps once discovery exists), "read a keyword gap", "what the
  verdict means"; `GUIDE_FOR_RECOMMENDATION` for any new recommendation ids; screen guides in `AUTOPILOT_SCREEN_GUIDES` style.
- Marketing: extend `keyword-research` in features.ts or add a `competitor-analysis` capability (slug, CapabilityMap GROUPS,
  CapabilityScreen APP_PATH, changelog entry, pricing rows), customer words only.

Tests layout and how to run (CLAUDE.md: no Node on the Mac, run in `node:22-bookworm-slim`)
- `app/shared/src/*.test.ts`: 69 files (vitest). `app/server/test/*.test.ts`: 93 files (unit + routes; `*.pg.test.ts` and a few suites
  need the real Postgres of the dev stack). `app/web/test/*.test.ts(x)`: 35 files. Last recorded counts (CLAUDE.md 2026-11-07): shared
  1125, server 1974, web 317.
- `docker run --rm -v "$PWD":/app -w /app node:22-bookworm-slim npm test` (all three workspaces) and `npm run typecheck` from `app/`;
  `npm run export:payloads` after any payload change, then harness S23; `python3 app/scripts/smoke.py` against the dev stack;
  browser pass in the Playwright image on `seo-platform-dev_default`.
- Relevant existing suites: `server/test/keywordChecks.test.ts`, `keywordFirst.test.ts`, `autoStart.test.ts`, `recommendations.test.ts`,
  `rankSerp.test.ts`, `runCredits.test.ts`, `credits.test.ts`, `costLedger.test.ts`, `runIdempotency.test.ts`, `engineFailures.test.ts`;
  `shared/src/keywords.test.ts`, `payload.test.ts`, `schemas.patch.test.ts`, `cost*.test.ts`, `guides.test.ts`, `appCopy.test.ts`,
  `fit-gate.parity.test.ts`; `web/test/keywordFirst.test.tsx`, `onePrice.test.ts`, `creditScreens.test.tsx`, `consistencyWarnings.test.tsx`.

## 6. What must not break

- Endpoints: `POST .../keywords/assess`, `GET .../keywords/recommended` (adds `status`, `startedAt`, `runId`, `freeResearch`),
  `POST .../research/start` (free-once grant semantics, 409 `research_not_free` with `credits`), `.../keyword-proposals[/:id/approve|skip|swap]`,
  `.../coming-up[/decisions]`, `.../ladders/*`, `.../automation`, `POST /api/orgs/:orgId/runs`, `/api/hooks/n8n/:token`, `/api/v1/*` and
  MCP tool names / `get_table` enum, `.../data/rankings|search|pipeline|ai/export`.
- Report stages and their renderers: `keyword_strategy` (payload keys `start_with`, `priority`, `quick_wins`, `content_plan` tiers,
  `competitor_gaps`, `search_console`, `serp_clusters`, `reach`, `summary` read by strategy.tsx and by `recommendedFromStrategy`, which
  also feeds onboarding, New ladder, "Choose for me", auto-start and proposals), `content` (verdict + page), `ladder_plan` (feasibility,
  head, `ladderPrefsOf` runs.ts:722), `full_report`. A new engine shape must stay tolerant: old reports keep rendering.
- Payload key order (payload.ts:3-7) and harness S23 (`fixtures_platform.json` from `npm run export:payloads`); never put a key
  containing `business`, `email` or `keyword` before the head; a new list must not be named `keywords` ahead of `keyword`.
- Parity tests that read `../n8n`: `shared/src/fit-gate.parity.test.ts` (reads `n8n/seo-agent/v5/code/_fit_gate.js` and
  `harness/accuracy/keywords.json`), `ai-focus.parity.test.ts`, `cost.aipanel.test.ts` / `cost.crawl.test.ts`, indexing parity suites and
  about 25 shared + 15 server suites that read engine files. Generated files `fit-gate.generated.js`, `ai-focus.generated.js`,
  `seo-events.generated.ts`, `ai-panel-cost-cases.generated.ts` come from `build_v4.py`: do not hand-edit. Changing the fit gate changes
  `engineRulesVersion` and invalidates stored keyword checks (by design).
- `cost.ts` mirrors `_cost_cal.js` value for value (new `CostKey` needs the engine `EST`/`DFS_EST` row in the same pass);
  `server/src/services/cadence.ts` mirrors `Cadence_Plan.js` (`server/test/cadence.test.ts` uses harness S24).
- Credits invariants: quote >= charge, failed run free, a free run quoted 0 stays 0, keyword checks charged from `keyword_checks.cost_usd`
  and the engine's `assess` rows keyed `app:<company>` excluded (no double count, costSync.ts:190).
- Copy guards: `guides.test.ts` (CHANCE_WORDS inside `choose-first-keyword`; no dashes, curly quotes, ellipsis), `appCopy.test.ts`,
  `onePrice.test.ts` (prices only through `lib/prices.ts`), credits-never-cost rule, brand tokens (no hex, no gradients), the
  no-AI-tells rule.
- `KeywordChoiceCard` (onboarding, proposals, coming up), `KeywordCard` (new ladder), `DifficultyBadge` (new ladder, strategy, ladder
  report) are shared: change vocabulary in one place and update the guide that quotes it.
- Engine-side assumptions the app relies on: `WATCHED` workflow ids (engineFailures.ts:15), `SCHEDULED_STAGES`, `TABLES` names,
  Site Admin `monitors` clearing a list with a single space (payload.ts:88-94), the 6-hour reuse window keyed by rules + context.
- Production: dispatcher, AIR flags and existing sites' monitor settings must be unchanged by a new page; a new monitor default must be
  off (absent key = engine default), like `index_sitemap_submit` (payload.ts:76).
