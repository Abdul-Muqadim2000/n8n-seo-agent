# Mismatch audit: where the product must warn before the user does something inconsistent (2026-10-27)

Read-only audit of `app/` (shared, server, web) and `n8n/seo-agent/` (v5/code kits, Normalize Input). Goal: every place where a user can
start, save or report something that contradicts what the system already knows, so a builder can add one warning mechanism with two
choices: **Accept** (the system's correction is applied) or **Continue anyway** (the choice is recorded).

Conventions in this file: `file:line` is at HEAD `0c241f45` (2026-10-26). "Server" means the check must run in `app/server` so the web app,
the REST API (`/api/v1/runs`) and MCP (`start_run`) all get it. Severity classes: **money** (credits spent on the wrong thing),
**market** (work measured or written for the wrong country / audience), **data** (stored data or reports become wrong), **cosmetic**.
Warning texts are customer copy: no em dashes, no curly quotes, no ellipsis character, no internal names.

---

## 1. Summary table

| # | Case | Severity | Must run in | Exists today? |
|---|---|---|---|---|
| M1 | A run (track, ladder, page, check, audit, AI, backlinks, research) sent with a country that is not the website's country | market | server `createRunWithMeta` + keyword check + web forms | **No** (the country is taken as sent) |
| M2 | The engine still measures the website in an old country (website country changed, or tracking saved with another country) | market | server: site PATCH, track, site overview / settings | **No** (no re-sync, the app never reads the engine's country) |
| M3 | A keyword ladder measured in another country than the website | market | server: ladder cards, ladder start | **No** |
| M4 | Keyword names a place outside the website's market ("ai automation solutions gcc" for Pakistan) or a market the product cannot measure (Qatar, Oman, Kuwait, Bahrain, Egypt) | market | server: run start, keyword check, add-to-ladder, proposals, watch keywords, AI questions | **No** (the fit gate treats any place word as "your market") |
| M5 | Business description / customers / facts / services name other markets than the website's country (devaicon: "UAE, GCC" vs Pakistan); also time zone, domain ending, profile address | market | server: site create / PATCH, onboarding, tracking start | **No** |
| M6 | Keyword suggestions researched in another country than the website's current country (proposals and "Choose for me" carry the old market) | market | server: recommended keywords, proposals; web NewLadderPage | **No** (web even prefers the research country) |
| M7 | AI question panel market vs website market (own market from the stale engine row, extra markets, questions naming other places, market-wide index only US English) | market | server: monitors save, AI questions add/edit, AI run | **Partial** (format check only) |
| M8 | Keyword script / language does not match the market language (Arabic or Urdu keyword on an English market; English keyword on a German market) | data | server: run start, keyword check, add-to-ladder | **Partial** (only the Keyword Check switches its results page to Arabic) |
| M9 | Competitors / brand names that cannot work (own domain via API, marketplace or social site, other-market domains, brand name too short or generic) | data | server: site PATCH, track, monitors | **Partial** (own domain refused in the web only) |
| D1 | Accepting a keyword suggestion on the Pipeline starts a second ladder and writes a page at once, one click, no cost of the whole start, no overlap with the existing ladder (techand.ai "erp & crm software" next to "dynamics 365 erp system", about 111 credits) | money | server `approveProposal` / `swapProposal` + web proposals panel | **No** |
| D2 | New ladder in the same product family as an existing ladder (word overlap is under 75%, so nothing fires) | money | server: ladder start, proposals | **No** |
| D3 | Keyword already covered by a live page of the website that is not a ladder page (Write a page, new ladder) | money | server: keyword run, ladder start | **Partial** (Keyword Check shows the match as a line, nothing asks) |
| D4 | "Add to my ladder" keyword: only an exact duplicate is refused (no overlap with other ladders, no fit gate, no live page check) | money | server `addKeywordToLadder` | **Partial** |
| D5 | "Write a page" to improve an existing page that is already the published page of another keyword / ladder | data | server: keyword run | **No** |
| D6 | The form duplicate warnings (already running, already written, ladder exists, overlaps a ladder, pile-up) are enforced only in the browser for app runs; proposals, onboarding launch and auto-start never see them | money | server `createRunWithMeta` | **Partial** (enforced for `/api/v1/runs` only) |
| D7 | Watching a keyword a ladder already tracks every week (charged twice) | money (small) | server: track | **No** |
| P1 | "I published it" with an address that is a different existing page (does not contain the keyword, existed before the page was written) | data | server: published run + web form | **No** (domain check only) |
| P2 | "I published it" for a planned refresh before the new text is live (the form prefills the old page's address) | data | server + web form | **No** (the form pre-fills the old address itself) |
| P3 | The same address reported as the published page of two keywords (two ladders) | data | server: published run | **No** |
| P4 | Reported address on a subdomain, on http, or on the other host (www vs bare) than the site's canonical host | data | server: published run, existing page fields | **Partial** (a subdomain passes the published check) |
| P5 | Reported keyword matches no written page of the website | data | server: published run | **No** |
| S1 | Pages a week set above 0 but nothing will be written (level 1-2 with no Auto keyword with pages left, all Manual, all paused, pile-up reached, credits paused, profile missing) | cosmetic / trust | server: cadence PATCH, automation PATCH, ladder PATCH | **Partial** (the forecast row says "none until you choose a keyword") |
| S2 | Pages a week above what the pile-up limit lets through | cosmetic | server: cadence + automation PATCH | **No** |
| S3 | "Keywords written at the same time" lowered below the Auto ladders already writing (some silently become Queued) | cosmetic | server: automation PATCH | **No** |
| S4 | Autopilot level vs ladder modes: level 3 with new ladders on Manual (announced ladders write nothing); lowering from 3 stops pages of ladders the system started | cosmetic / trust | server: automation PATCH | **No** |
| S5 | Ladder resumed / switched to Auto while the limit is full (it waits as Queued) | cosmetic | server: ladder PATCH | **No** (only a line on the New ladder priority card) |
| S6 | Ladder started with "pages written now" while the effective mode is Manual (priced as pages, writes none) | money / trust | server: ladder run | **No** |
| S7 | Weekly pages off while an Auto ladder still has pages to write | cosmetic | server: cadence PATCH, ladder start | **Partial** (a line in the ladder notice) |
| S8 | A page or ladder started without the author profile or business facts (page written with blanks, or first page held) | data | server: keyword and ladder runs, proposals | **Partial** (Write now dialog and Launch step only) |
| C1 | Credits: schedules switched on whose monthly use outruns the balance (the credit guard will pause the website) | money | server: monitors / cadence / level saves | **Partial** (on-demand runs are refused with 402; schedules are not warned) |
| I1 | CMS connection whose base URL or public address pattern is on another domain | data | server: CMS connection create / update | **No** (only caught after publishing) |
| I2 | Outreach mailbox on another domain than the website it sends for | data / trust | server: link settings, sequence approve | **No** |
| I3 | Uploaded backlinks file belongs to another website | data | server: backlinks import | **No** (the AI report import refuses; the link import does not) |
| I4 | GA4 property of another domain | data | server | **Yes** (hard refusal `assertGa4ForDomain`) |
| I5 | Search Console property of another domain | data | engine | **Yes / not a user action** (engine resolves the property) |
| I6 | Starting work on an unverified website | money | server | **Yes** (hard refusal `requireVerified`) |
| I7 | The added domain redirects to another domain | data | server: site create | **No** |
| B1 | A run's own "What you sell / Who buys / Business facts" differ from the website's settings (ladder and page tool forms) | cosmetic / data | server: ladder / keyword runs | **No** |

---

## 2. One mechanism (build this once, reuse everywhere)

### 2.1 What already exists and must be reused

1. **`pipelineNotices()`** `app/shared/src/pipeline-notices.ts:78-278`: a pure function over `PipelineData` that returns
   `PipelineNotice { id, tone: 'info'|'warning', title, body, short, confirm?, link?, usePlan? }` (`:21-34`). A `warning` with `confirm`
   needs a tick. Ids carry the subject (`ladder-overlap:<kw>`, `written:<kw>`, `pileup:<kw>`, `active:<runId>`).
   `usePlan` (`:33`, applied by `onUsePlan` in the web) is already an "Accept": it rewrites form fields (pageType, existingPageUrl).
2. **Web hook + UI** `app/web/src/pages/tools/_components/kit.tsx:276-287` (`usePipelineNotices`: `acked`, `toggle`, `unconfirmed`) and
   `:289-327` (`PipelineNotices`: a `Callout` per notice, the `usePlan` button, the "... anyway" `Checkbox`). `ToolShell` blocks submit while
   any warning is unticked (`kit.tsx:452-453`, "Tick the box in the warning above to start anyway."). `NewLadderPage.tsx:586,598` does the same.
3. **Server enforcement, API only** `app/server/src/services/apiRuns.ts:110-111` (`unconfirmed(notices, acknowledged)`), `:143-148`
   (notices computed on `pipelineData`), `:152-163` (`dryRun` returns `notices` + `needsAcknowledge`), `:166-175` (409 `confirm_needed`
   with `{ notices, needsAcknowledge }` unless the ids are sent in `acknowledge`). MCP `preview_run` / `start_run` use it
   (`routes/apiV1.ts:128,227-235,281`). The acknowledge list is part of the Idempotency hash (`requestHash`, `apiRuns.ts:100-101`).
4. **"Add them first / Write anyway"** `app/web/src/pages/site/_components/pipeline/WriteNowDialog.tsx` (readiness via
   `contentReadiness`, `shared/src/readiness.ts:52`): the two-button pattern the owner asked for, client side only.
5. **Hard refusals** (keep as they are, they are not "continue anyway" cases): `requireVerified` (`server/src/auth/access`), GA4
   `assertGa4ForDomain` (`server/src/services/google.ts:126-140`), existing page on the host (`server/src/services/runs.ts:220-221`),
   published page on the domain (`runs.ts:224-225`), credits 402 (`server/src/services/billing.ts:258-266`).
6. **Pure helpers to reuse**: `fitGate / fitTopic / fitEvidence / FITR` (`shared/src/fit-gate.ts`, generated from
   `n8n/seo-agent/v5/code/_fit_gate.js`, parity-tested), `keywordsOverlap / keywordTokens / ladderOverlaps` (`shared/src/ladders.ts:17-66`),
   `ladderOverlapsOf` (`shared/src/keywords.ts:359`), `checkEvidenceLines` / `toExistingPage` (`keywords.ts:203-235`),
   `urlOnDomain / urlOnHost / cleanDomain` (`shared/src/domain.ts:63-75`), `cycleNorm` / `normKeyword`, `contentReadiness`,
   `runwayDays` (`shared/src/billing.ts:126`), `activeAutoLadders` (`server/src/services/autoStart.ts:93`), `forecastPlanOf` (web).

### 2.2 Proposed contract (extends what the API already does; nothing new for API clients to learn)

- New pure module `app/shared/src/consistency.ts`:
  `consistencyWarnings(action: ConsistencyAction, input, ctx: ConsistencyCtx): Warning[]`, where
  `Warning = PipelineNotice & { code: string; severity: 'money'|'market'|'data'|'cosmetic'; accept?: { label: string; change: Change } }`.
  `id` stays `<code>:<subject>` (what `acknowledge` names), so API callers keep sending ids. `Change` is data, never code:
  - `{ kind: 'fields', set: Record<string, unknown> }`: the client rewrites the request and resends (country, keyword, existingPageUrl,
    publishedUrl, ladderMode, pagesNow). Replaces and generalises `usePlan`.
  - `{ kind: 'call', method, path, body }`: a server side effect the client calls, then resends (market re-sync, set the website's
    country, pick the draft, approve as Manual).
- `pipelineNotices()` becomes one producer inside `consistencyWarnings` (keep its ids and texts; add `code` + `severity`).
- New `app/server/src/services/consistency.ts`: builds `ConsistencyCtx` once per request (site row, `pipelineData`, the engine's
  `seo_sites` row via `siteRows('sites', domain)`, ladder rows, `seo_pages`, the latest `keyword_strategy` report, monitors, readiness,
  billing), and `assertConsistent(ctx, warnings, acknowledge)` throws the existing 409 `confirm_needed`
  `{ notices: warnings, needsAcknowledge }` for every unacknowledged `warning` (info never blocks).
- Call it from **`createRunWithMeta`** (`server/src/services/runs.ts:204`), not only from `startRunV1`, so the app route, the API, MCP,
  proposals, onboarding launch and every other start get it. Add `acknowledge?: string[]` to `CreateRunOptions`; the app route
  `POST /api/orgs/:orgId/runs` (`server/src/routes/runs.ts:56-62`) strips `acknowledge` from the body exactly like `formBodyOf`
  (`apiRuns.ts:103-108`) before `parseRunInput`. Same call from the non-run writes listed per case (site PATCH, automation PATCH,
  cadence, ladder PATCH, add-to-ladder, proposal approve / swap, CMS connection, link import, monitors, link settings, AI questions); they
  take `acknowledge` in their body too.
- **Automatic starts** (`startDueProposals`, auto research, cadence mirror) cannot acknowledge: a blocking warning of severity
  money or market turns the automatic start into a Needs-you item (kind `proposal` / new kind `check`) instead of starting.
- **Record "Continue anyway"**: store `acknowledged: string[]` on `runs.input` (it already stores `proposalId`, `autoStart`,
  `freeResearch`, `runs.ts:290`), and write one audit row `warning.overridden` (`services/audit.ts`) with `{ codes, mode or setting, values }`
  for runs and settings alike. Settings that keep a standing warning (M2, M3, M5) store the acknowledged id on the site
  (`sites.acknowledged_warnings jsonb`, new column, so the standing banner stays quiet until the facts change: the id embeds the values,
  e.g. `market.business_text:PK:AE,GCC`).
- **Web**: one component (rename `PipelineNotices` to `Warnings`) with, per warning, an **Accept** button (`accept.label`) and a
  **Continue anyway** checkbox or button (`confirm`); on a 409 `confirm_needed` from any mutation it renders `e.data.notices` in a dialog
  with the same two choices and resends with `acknowledge`. Keep live client-side warnings where the data is already loaded (fast
  feedback), but the server is the authority.

### 2.3 Data the checks need (all already readable by the server)

| Data | Where |
|---|---|
| The website's country, business, customers, facts, services, competitors, brand names, time zone | app Postgres `sites` (`server/src/db/schema`), `siteContext` `runs.ts:112-128` |
| The engine's market for the site | engine `seo_sites.country / location_code / language_code / canonical_host` (`shared/src/tables.ts:37-46`), `siteRows('sites', domain)` |
| Ladder markets and pages | `seo_ladders.country / location_code / target_url / status` (`tables.ts:10-20`); `pipelineData().ladderCards[].country` |
| Pages written / published | `pipelineData().written` (`shared/src/data.ts:1172`), content data items (`publishedUrl`, `existingPageUrl`, `requestId`) |
| Page inventory | `seo_pages` (`tables.ts:71-79`: url, title, h1, source, lastmod, `queries_json`, clicks) via `siteRows('pages', domain)` |
| Research market | latest `keyword_strategy` report `payload.country` (`server/src/services/keywordChecks.ts:198-210`) |
| AI markets | `seo_monitors.ai_markets` (`tables.ts:107-122`), `seo_ai_prompts.market` |
| Location codes and market languages | today only in the engine (`harness/code_v4/Normalize_Input.js:85-108`, COUNTRIES with `code`, `lang`); add `code` and `lang` to `shared/src/constants.ts:16-36` COUNTRIES |
| Place words per country | new: `shared/src/markets.ts` gazetteer (section 2.4); the engine's `FIT_GEO` (`_fit_gate.js:34`) is a flat set with no country attached |

### 2.4 The gazetteer (deterministic, needed by M4, M5, M7, M9)

`shared/src/markets.ts`: `placesIn(text): { iso: string[]; words: string[] }[]`, whole-word, case-insensitive, after `normalize('NFKC')`,
multi-word phrases first, Arabic names through the kit's Arabic map (`_fit_gate.js:139-140`). Minimum table:

| Key | Words |
|---|---|
| AE | uae, u.a.e, united arab emirates, emirates, emirati, dubai, abu dhabi, sharjah, ajman, fujairah, ras al khaimah, umm al quwain, al ain, .ae |
| SA | saudi, saudi arabia, ksa, riyadh, jeddah, dammam, khobar, mecca, makkah, medina, madinah, .sa |
| PK | pakistan, pakistani, lahore, karachi, islamabad, rawalpindi, faisalabad, multan, peshawar, quetta, sialkot, .pk |
| IN | india, indian, delhi, new delhi, mumbai, bangalore, bengaluru, hyderabad, chennai, pune, kolkata, .in |
| GB | uk, united kingdom, britain, england, london, manchester, birmingham, .uk |
| US | usa, united states, new york, california, texas, florida (never the bare word "us") |
| other supported | country name, demonym, capital and 3 largest cities, ccTLD, for CA AU NZ IE SG ZA DE FR ES IT NL BR MX |
| unsupported markets (cannot be measured: not in COUNTRIES) | qatar/doha (QA), oman/muscat (OM), bahrain/manama (BH), kuwait (KW), egypt/cairo (EG), jordan, lebanon |
| regions -> sets | gcc, gulf, gcc countries, middle east, mena, arab world -> {AE, SA, QA, OM, BH, KW} (+ EG, JO for mena / middle east); europe, eu -> {DE, FR, ES, IT, NL, IE}; asia (ignored: too wide) |

Rule helper: `marketMismatch(text, siteIso) = places.length > 0 && !places.some(p => p.iso.includes(siteIso))`.
Words such as "online", "near me", "global", "international", "worldwide" are not places.

---

## 3. The cases in detail

### M1. A run sent with a country that is not the website's country (root of production case 1 and 2)

- **User action / where.** Every site-bound form has its own Country select, defaulted from the website and freely editable:
  research forms `app/web/src/pages/tools/_components/forms/research.tsx:30,44,77,159,305,367`; ladder / case study / AI / backlinks
  `forms/growth.tsx:34,78,131,192,261,286,331,352`; audit `forms/site.tsx:76,112`; default comes from `siteDefaults`
  (`tools/_components/kit.tsx:65`). The keyword check on New keyword ladder has its own Select (`app/web/src/pages/site/NewLadderPage.tsx:366,411-418`)
  and the chosen ladder carries that country (`:818`, shown at `:621,862`). Tracking: `TrackingForm` shows a Country select by default
  (`app/web/src/components/site/TrackingForm.tsx:51,107-119`) on both Website settings cards ("Start weekly tracking"
  `app/web/src/pages/site/SiteSettingsPage.tsx:240-250` and "Keywords and Google Analytics" `:299-311`); `useTrackRun` sends it
  (`SiteSettingsPage.tsx:180`). API: `startRunV1` fills the country only when it is missing (`server/src/services/apiRuns.ts:131-134`), so a
  caller's other country passes. Keyword check API: `keywordChecks.ts:167` uses `input.country` first.
- **What goes wrong.** `createRunWithMeta` (`server/src/services/runs.ts:204-376`) never compares `input.country` with `site.country`;
  `buildN8nPayload` sends `input.country` (`shared/src/payload.ts:105-182,212,271,278`). For `track` the engine writes that country and
  its `location_code` into `seo_sites` (`v5/code/Site_Row_Track.js:16`), and **every scheduled job then reads the engine row**:
  Site Tracker `Site_Plan.js:160`, Rank Tracker live checks `Tracker_Plan.js:187-226` (ladder pages use the ladder row's own
  `location_code`, `:95,136`), AI visibility `AI_Plan.js:151-178` and pulse `Pulse_Plan.js:78-125` (default US 2840 when empty), Cadence
  page bodies `Cadence_Plan.js:595`, Backlinks `BL_Plan.js:66`, Link Builder `LB_Plan.js:122`, audits `Audit_Sched_Plan.js:39`. On-demand
  monitor runs override with the trigger's country only in memory (`v5/code/_monitor_sites.js:73`). A successful track updates the
  website row's keywords, GA4, competitors, brand names and time zone but **not its country** (`runs.ts:358-375`), so the app keeps
  Pakistan while the engine keeps the UAE.
- **Why devaicon got the UAE.** The onboarding paths force the website's country (`TrackingStep.tsx:25-26`, `LaunchStep.tsx:53`,
  `launch-plan.ts:17-22`), so one of two things happened: (a) the website's country was the UAE at launch on 2026-10-23 and was changed to
  Pakistan later in Business details (M2: nothing re-syncs, and the site PATCH writes no audit row, `routes/sites.ts:257-279`), or (b)
  tracking was saved in Website settings with the Country select on the UAE. Read-only confirmation for the builder:
  `select created_at, input->>'country' from runs where site_id = <devaicon> and mode = 'track' order by created_at;` and
  `sites.updated_at` vs that run.
- **Existing check.** None (the country is only validated as one of the 19 names).
- **Detection rule.** Site-bound run (every mode except `profile`, whose `country` is the address country, `payload.ts:229-231`) with
  `input.country !== site.country` and `site.country` set. Code `market.run_country`, id `market.run_country:<input iso>:<site iso>`.
  For the keyword check, same rule on `POST .../keywords/assess`. Data: `sites.country`.
- **Warning text.** Title: `This runs for <Input country>, but your website's market is <Site country>`. Body: `Rankings, search volumes
  and competitors are different in every country. Running this for <Input country> measures a market your website settings do not
  target<, and for tracking it changes where every weekly check is measured>.`
- **Accept.** `Use <Site country>`: `{ kind: 'fields', set: { country: site.country } }`.
- **Continue anyway** (`Run it for <Input country> anyway`): `runs.input.acknowledged += id` + audit `warning.overridden`. For `track`,
  continuing must also ask whether the website's country should change (it decides every schedule): make that a second warning
  `market.track_country` whose Accept is `Change my website's market to <Input country>` (`call PATCH site { country }` + M2 re-sync).
- **Severity.** market. **Runs in** server (`createRunWithMeta`, `assessKeyword`) and web (forms show it live; hide the Country select of
  `TrackingForm` or show it read-only with a link to Business details, since the website owns the country).

### M2. The engine still measures the website in an old country (drift)

- **User action / where.** Business details save: `SiteBusinessFields.tsx:128-140` -> `PATCH /api/orgs/:orgId/sites/:siteId`
  (`server/src/routes/sites.ts:257-279`). Also any `track` sent with another country (M1).
- **What goes wrong.** The PATCH re-sends only business facts to the engine (`sites.ts:268-276`, Site Admin `facts`). The engine has no
  Site Admin action for the market (`v5/code/Admin_Action.js:14-50`). So after a country change every schedule keeps the old
  `seo_sites.country/location_code`, and `TrackingConnection` (`shared/src/data.ts:72-84`, built in `server/src/services/data.ts:179-191`)
  does not even expose the engine's country, so no screen can notice.
- **Existing check.** None.
- **Detection rule.** Standing check when the website is tracked: engine `seo_sites` row of the domain exists and
  `(row.country || '') !== site.country` or `row.location_code !== code(site.country)` (needs `code` added to shared COUNTRIES). Code
  `market.engine_drift`, id `market.engine_drift:<engine iso>:<site iso>`. Before a site PATCH that changes `country` on a tracked website:
  code `market.country_change` listing what still measures in the old country (weekly report, AI questions, N ladders, the research the
  suggestions come from).
- **Warning text.** Title: `Your weekly checks still measure <Engine country>`. Body: `Your website's market is <Site country>, but the
  weekly report, rank checks, AI answers and weekly pages are still measured for <Engine country>. Update them so every check uses your
  market.` For the PATCH: `Changing your market to <New> also moves your weekly report and AI checks to <New>. Your <N> keyword ladders
  keep <Old> until you move them (their ranking history starts again).`
- **Accept.** `Measure in <Site country>`: `{ kind: 'call', method: 'POST', path: '/api/orgs/:orgId/sites/:siteId/market/sync' }`, a new
  endpoint that updates `seo_sites` (country, location_code, language_code) with `updateRows('sites', [site_id eq], ...)`
  (`server/src/n8n/client.ts:338`) and invalidates the site cache. Free (no tracker run). Ladders are a separate choice (M3).
- **Continue anyway.** Store the id on the site (`acknowledged_warnings`) + audit row; the banner stays quiet until either country changes.
- **Severity.** market. **Runs in** server (site PATCH answer, site overview / settings data), web banner on Overview, Pipeline and
  Website settings.

### M3. A ladder measured in another country than the website

- **Where.** Ladder start with another country (M1), or an old ladder after a country change. Ladder rows keep their own country
  (`LadderRow.country/location_code`, `tables.ts:10-13`); `addKeywordToLadder` even copies the ladder's country onto a new page
  (`server/src/services/ladderSettings.ts:343`). Ladder cards show the country (`web/.../pipeline/ladders.tsx:151`, `RankingsPage.tsx:461`) but
  nothing compares it.
- **Detection rule.** `ladder.country !== site.country` for any ladder not archived. Code `market.ladder_country`, id
  `market.ladder_country:<ladderId>:<ladder iso>:<site iso>`.
- **Warning text.** `Your ladder "<head>" is tracked in <Ladder country>, not in <Site country>. Its pages are written and ranked for
  <Ladder country> searchers.`
- **Accept.** `Move this ladder to <Site country>`: call a new `POST .../ladders/:ladderId/market` that updates the ladder's rows
  (country, location_code, language_code). Body adds: `Its ranking history starts again from the next weekly check.`
- **Continue anyway.** Acknowledged on the site (per ladder id) + audit.
- **Severity.** market. **Runs in** server (pipeline data, ladder PATCH), web ladder card and ladder page.

### M4. Keyword names a place outside the website's market (production case 2)

- **Where.** Typed keyword check / ladder: `NewLadderPage.tsx:360-420` -> `routes/keywords.ts:16-22` -> `assessKeyword`
  (`services/keywordChecks.ts:163-195`) -> engine SEOagentAssess; ladder start `NewLadderPage.tsx:808-833`, ladder tool `forms/growth.tsx:23-118`,
  Write a page `forms/research.tsx:69+`, onboarding first keyword `pages/onboarding/_components/KeywordStep.tsx:110`, proposal swap
  `autoStart.ts:565-595`, add-to-ladder `ladderSettings.ts:322-352`, keywords to watch `TrackingForm.tsx:121-140`, AI questions (M7).
- **What goes wrong.** The fit gate counts any place word as "in your market": `FIT_GEO` (`n8n/seo-agent/v5/code/_fit_gate.js:34`) holds uae,
  dubai, gcc, saudi, pakistan ... with no country, `FIT_REAL_GEO` (`:192`) and the category rule `cats.length >= 1 && hasPlace` returns
  ok "a category you sell (...) in your market" (`:309-315`). The engine's Keyword Check adds no market warning (`Assess_Response.js:192-211`).
  The web drops the check's `warnings` entirely (`fromCheck`, `web/.../pipeline/new-ladder.tsx:63-80`; `CheckResult`,
  `NewLadderPage.tsx:465-530`). "ai automation solutions gcc" for a Pakistan website (chosenBy `client_typed`) therefore passes everywhere.
- **Existing check.** None.
- **Detection rule.** `places = placesIn(keyword)`; `market.keyword_place` when `places.length && !places.some(p => p.iso.includes(siteIso))`
  (id `market.keyword_place:<norm keyword>:<site iso>`). Second code `market.keyword_unsupported` when every place maps only to markets
  not in COUNTRIES (Qatar, Oman, Kuwait, Bahrain, Egypt). A region that contains the site's country (gcc for a UAE site) is fine.
  Data: keyword, `sites.country` (the run's country after M1). Deterministic, no paid call; run it **before** the paid keyword check.
- **Warning text.** Title: `"<keyword>" is a search about <places>, not about <Site country>`. Body: `Your website's market is
  <Site country>. A page for "<keyword>" competes for searchers in <places>, and we measure it in <Site country>, where few people search
  it.` Unsupported: `We cannot measure rankings in <place>, so this keyword's position cannot be tracked.`
- **Accept.** Offer the keyword without the foreign place: `Use "<keyword minus place words>"` (fields: `{ keyword }`). When the site
  country has a natural word (e.g. "pakistan"), a second Accept is not allowed by the two-choice rule, so pick one: drop the place word
  (safer, keeps the topic).
- **Continue anyway** (`Keep "<keyword>"`): `runs.input.acknowledged` (or the keyword check row) + audit; for watch keywords, the
  acknowledged id on the site.
- **Severity.** market. **Runs in** server (run start, keyword check before the engine call, add-to-ladder, proposals' pick filter in
  `proposalDecision` `autoStart.ts:146-154`, track keywords) and web live.

### M5. Business text names other markets than the website's country (production case 5) and the other market signals

- **Where.** Website create / Business details (`components/site/SiteBusinessFields.tsx:35,128-140`; `routes/sites.ts:219-247,257-279`);
  onboarding Website and Business steps; Profile address (`components/site/ProfileForm.tsx:51,340-349`).
- **What goes wrong.** devaicon's business and customers say "UAE, GCC" while its country is Pakistan; nothing compares them, and every
  page brief, keyword research and AI question is then written from text about one market and measured in another.
- **Existing check.** None. `guessCountry` (`components/site/helpers.ts:44-95`, `TZ_COUNTRY`) only pre-fills a new website.
- **Detection rule.** `market.business_text`: `placesIn(business + customers + businessFacts + services + cta)`; warn when at least one
  place is named and none includes the site's ISO. Weighting: a place in `customers` or `services` counts double. Also, same code family,
  info tone: `market.timezone` (`TZ_COUNTRY[site.timezone] !== siteIso`, move `TZ_COUNTRY` to shared), `market.domain_ending`
  (ccTLD of `site.domain`, e.g. `.ae`, `.pk`, `.co.uk`, maps to another supported country), `market.profile_address`
  (`profile.address.country` set and `!== site.country`; local pages and LocalBusiness schema then name another country).
- **Warning text.** `Your description talks about <places>, but your main country is <Site country>`. Body: `We measure rankings, search
  volumes and AI answers where your customers search. If your buyers are in <best place>, choose it as your main country. If they are in
  <Site country>, update the description so pages and research speak to them.`
- **Accept.** `Make <best supported country> my main country` (fields `{ country }` on the PATCH, then M2 re-sync). Only offered when the
  most-mentioned place is one supported country; for a region (GCC) offer its supported member with the most mentions (UAE).
- **Continue anyway** (`Keep <Site country>`): acknowledged id on the site, audit row. The id embeds both sides, so a later text change
  re-checks.
- **Severity.** market. **Runs in** server (site create / PATCH, `track` start), web Business details and onboarding.
  Note for the owner: for devaicon the system cannot know which side is right; the warning makes the person choose.

### M6. Keyword suggestions researched in another country

- **Where.** `recommendedKeywords` returns the report's own `country` (`server/src/services/keywordChecks.ts:198-210`); the web picks it
  over the website's (`NewLadderPage.tsx:239` `r?.country ?? site.country`) and every chosen suggestion carries it (`:294,336`,
  `fromRecommended` `pipeline/new-ladder.tsx:46-48`). Proposals use `site.country` in `ladderBody` (`autoStart.ts:330-345`) but pick
  keywords researched for the other market (`proposalDecision` `:128-160` never compares `recommended.country`).
- **Detection rule.** `market.research_country`: latest `keyword_strategy` `payload.country` set and `!== site.country`.
- **Warning text.** `These suggestions were researched for <Report country>. Your market is now <Site country>, so their search volumes
  and chances are for the wrong country.`
- **Accept.** `Find fresh keywords for <Site country>` (call the research start used by `StartResearchButton`, `NewLadderPage.tsx:182-235`;
  free when the setup grant remains, else priced on the button).
- **Continue anyway.** Use the suggestion; the ladder runs in `site.country` (never the report's), acknowledged on the run.
- **Server rule for proposals.** `proposalDecision` returns `research` (level 3) or `none` with the reason when the report country differs,
  instead of proposing. **Severity** market. **Runs in** server (recommended, proposals), web Recommended tab and proposals panel.

### M7. AI question panel market vs website market

- **Where.** Monitors: `aiMarkets` (`shared/src/schemas.ts:107-108`, `components/site/MonitorSettingsFields.tsx:44,162`); question add / edit
  with `market` (`pages/site/_components/ai-panel.tsx:389-470`, `schemas.ts:533,545`).
- **What goes wrong.** Only the format is checked (`/^[A-Za-z]{2}([-_ ][A-Za-z]{2,3})?$/`). The engine's own market comes from the engine
  row's `location_code` (`AI_Plan.js:151-154`, `Pulse_Plan.js:78-81`; US 2840 when empty), so after M1/M2 drift the whole panel is asked in
  the old country. Questions are not checked for place words. The ChatGPT market-wide data holds US English only (CLAUDE.md: LLM
  Mentions 2840/en), so a non-US website's "market-wide index" is US data.
- **Detection rules.** `ai.market_drift` = M2 applied to the AI panel (own market != site ISO + language); `ai.question_place` = M4 on a
  question text; `ai.extra_market_same` when an extra market equals the own market (no effect, still priced? check `estimateAiPanelCost`);
  `ai.extra_market_unsupported` when the code is not one of the 19 (the engine falls back to `AIP.locationOf`); info
  `ai.market_index_us` when site ISO != US and the market-wide index is on.
- **Warning texts.** `"<question>" asks about <places>; your market is <Site country>.` / `Your AI questions are still asked in <Engine
  country>.` / `The market-wide AI share is measured on US English answers only, not in <Site country>.`
- **Accept.** Drop the place words from the question; `Measure in <Site country>` (M2 call); remove the duplicate market.
- **Continue anyway.** Acknowledged on the site; audit. **Severity** market. **Runs in** server (Site Admin `monitors` and `ai_prompts`
  routes in `routes/sites.ts`), web AI page.

### M8. Keyword script / language vs the market language

- **Where.** Same keyword entry points as M4.
- **What goes wrong.** Only the Keyword Check notices Arabic script and reads an Arabic results page (`v5/code/Assess_Validate.js:31-32`);
  ladder, page and rank runs use the country's language (`Normalize_Input.js:177-181,393-395`, English for AE / SA / PK), so an Arabic
  ladder is planned and tracked on English results. The app's overlap words (`shared/src/ladders.ts:17-28`, split on `[^a-z0-9]`) drop
  Arabic entirely, so two Arabic ladders never "overlap".
- **Detection rule.** `lang.script`: keyword contains Arabic / Urdu (`؀-ۿݐ-ݿࢠ-ࣿ`), Cyrillic, CJK or Devanagari
  and the market language (`lang` of the country) is not that script's language. Optional `lang.latin`: market language de/fr/es/it/nl/pt
  and every word of the keyword is in a short English stop/product list (low precision, info only).
- **Warning text.** `"<keyword>" is written in Arabic, but your market's searches are read in English. Rankings for it would be checked on
  the wrong results page.`
- **Accept.** none that is safe automatically; use the English keyword the check translated (`fitArabic` output, `_fit_gate.js:154-171`)
  when available: fields `{ keyword: translated }`.
- **Continue anyway.** recorded on the run. **Severity** data. **Runs in** server + web.

### M9. Competitors and brand names that cannot work

- **Where.** Competitors in Business details, Tracking and tool forms (`schemas.ts:151,264,312,443,451,559`); brand names in monitors.
- **What goes wrong.** Own domain refused only in the browser (`components/site/helpers.ts:31-38`); the server `domainList` (`schemas.ts:33`)
  accepts it through the API. Marketplaces / social / directories (linkedin.com, amazon.com, wikipedia.org, g2.com) make share of voice and
  link gaps meaningless. A short brand name ("techand", a 1-4 letter name, a word from the fit kit's generic list) matches other companies in
  AI answers (CLAUDE.md working rule).
- **Detection rules.** `data.competitor_own` (same registrable domain or subdomain): make it a hard refusal on the server.
  `data.competitor_platform`: domain in a platform list (reuse the kit's `FIT_GENERIC` social / platform words, `_fit_gate.js:42`).
  `market.competitor_other_market` (info): ccTLD of the competitor maps to another supported country. `data.brand_generic`: brand name
  length <= 4 or a `FIT_GENERIC` word.
- **Warning texts / Accept.** `<domain> is a platform many companies use, not a competitor. Remove it?` Accept: remove it. `"<name>" is
  short or common, so AI answers about other companies may be counted as yours.` Accept: `Use "<name> <domain label>"` or the full
  company name from the profile.
- **Continue anyway.** acknowledged on the site. **Severity** data. **Runs in** server (site PATCH, track, monitors).

### D1. Accepting a keyword suggestion starts a second ladder and writes a page at once (production case 3)

- **Where.** Pipeline proposals panel `app/web/src/pages/site/_components/pipeline/proposals.tsx:84-140`: `Start this ladder` / `Approve now`
  calls the mutation directly (`:90-101`), no dialog. The card shows only `about N credits a page` (`components/site/KeywordChoiceCard.tsx:76,108-110`).
  Server `POST .../keyword-proposals/:id/approve` (`server/src/routes/autopilot.ts:79-86`) -> `approveProposal`
  (`server/src/services/autoStart.ts:529-548`) -> `createRun` with `ladderBody` (`:330-345`: `pagesNow: 1`, no `ladderMode`, so the
  website default, Auto, applies and the first page is written now, `runs.ts:233-240`). Swap does a paid check and starts at once
  (`:565-595`).
- **What goes wrong.** The click spends the plan plus a page (about 111 credits on techand.ai) and creates a second ladder; nothing says
  "this starts a new ladder", what it costs in total, that the website already has an Auto ladder, or that the new keyword is in the same
  product family as "dynamics 365 erp system" (D2). `approveProposal` also does not re-check room (`startBlock`, `autoStart.ts:409-418`, is
  used only for automatic starts), and none of the form warnings (D6) run.
- **Existing check.** At proposal time only: word overlap >= 75% and heads (`proposalDecision`, `autoStart.ts:146-154`); room
  (`activeAutoLadders` vs `maxActive`).
- **Detection rule.** Always a confirmation step for approve and swap (`money.new_ladder`, warning tone): quote =
  `estimateCost(ladderBody)` with the effective mode; list existing ladders (`ladderCards` not archived); add D2 and D6 warnings and
  `startBlock` reason when the room is gone.
- **Warning text.** Title: `This starts a new keyword ladder`. Body: `"<keyword>" becomes keyword ladder number <n + 1> next to
  "<existing heads>". Starting it plans the ladder and writes its first page now: about <quote> credits. After that its pages use your
  weekly pages.`
- **Accept.** `Start it without writing a page` (fields `{ ladderMode: 'manual' }` or `pagesNow: 0` equivalent: a Manual start is quoted
  for the plan alone, `runs.ts:233-238`); this is the safe correction. **Continue anyway** = `Start and write the first page`.
- **Record.** `runs.input.acknowledged`, proposal row `note`, audit `site.keyword_proposal_decided` already exists (`autopilot.ts:84`): add
  `acknowledged`.
- **Severity.** money. **Runs in** server (approve and swap refuse with 409 `confirm_needed` without `acknowledge`) and web (dialog). Level-3
  automatic starts (`startDueProposals`) keep their 2-day announcement, which is already an explicit warning, but must also stop on D2 / M4 /
  M6 (turn into a waiting proposal).

### D2. New ladder in the same product family as an existing ladder

- **Where.** Ladder start (all paths), proposals.
- **What goes wrong.** The app's overlap is Jaccard >= 0.75 on stemmed words (`shared/src/ladders.ts:31-43`); "erp & crm software" vs
  "dynamics 365 erp system" share 1 of 6 words. The engine refuses by words (`v5/code/_ladder_dup.js`) and by 3 of the top 7 results
  (`Ladder_Plan.js:423-430`), after paying for the results pages.
- **Detection rule.** `money.same_family`: both heads match the same `FIT_FAMILIES` entry (`_fit_gate.js:179-189`: erp, e-invoicing, crm,
  vat, ai, it). Needs `FIT_FAMILIES` exported through `fit-gate.generated.js` (add it to the kit's export list, parity test covers it).
  Stronger optional rule: share of the two heads' top-7 results >= 3 when today's results page is cached (`_serp_cache.js`).
- **Warning text.** `"<new>" and your ladder "<existing>" are both about <family word> software. Their pages will compete for the same
  buyers. Add the new keyword as a page of "<existing>" instead?`
- **Accept.** `Add it to "<existing>"` (call `POST .../ladders/:ladderId/keywords`, `routes/ladders.ts:59-69`). **Continue anyway** =
  start the new ladder. **Severity** money. **Runs in** server + web.

### D3. Keyword already covered by a live page of the website

- **Where.** Write a page (`forms/research.tsx` KeywordForm), new ladder, add-to-ladder.
- **What goes wrong.** The Keyword Check returns the matched page (`existing`, `shared/src/keywords.ts:189-235`) and the web prints it as a
  sentence (`NewLadderPage.tsx:500-505`); nothing asks. The Write a page run does no check at all; `pipelineNotices` only knows pages this
  system wrote (`pipeline-notices.ts:158-207`).
- **Detection rule.** `money.page_exists`: a `seo_pages` row whose `queries_json` contains the normalised keyword with position <= 20, or
  whose title / h1 contains all the keyword's tokens (`keywordTokens`), or the check's `existingPage` with status live; and the run's
  `existingPageUrl` is empty.
- **Warning text.** `Your page <short url> already ranks for "<keyword>" (position <n>). A second page for the same search competes with it.
  Improve that page instead?`
- **Accept.** `Improve <short url> instead`: fields `{ existingPageUrl, pageType }` (exactly what `usePlan` does today, `pipeline-notices.ts:291-294`).
  **Continue anyway**: `Write a new page anyway`. **Severity** money. **Runs in** server + web.

### D4. "Add to my ladder"

- **Where.** `routes/ladders.ts:59-69` -> `addKeywordToLadder` / `ladderKeywordRow` (`server/src/services/ladderSettings.ts:322-352`).
- **What goes wrong.** Only an exact duplicate (cycleNorm) is refused (`:326-327`); no 75% overlap with other ladders' pages, no fit gate,
  no M4 / M8, no live page (D3). The new row inherits the ladder's country (`:343`).
- **Rules.** Apply M4, M8, D3, `ladder-overlap` (from `pipelineNotices`) and `fitGate(keyword, ctx)` (the cadence already builds the
  context, `server/src/services/cadence.ts:500-539`). Accept per warning as above. **Severity** money. **Runs in** server.

### D5. Improving an existing page that is the published page of another keyword

- **Where.** Write a page with "Existing page" (`forms/research.tsx` KeywordForm; host check `runs.ts:220-221`).
- **Detection rule.** `data.page_owned`: `urlKey(existingPageUrl)` equals the `publishedUrl` of a `written` item with another keyword
  (`pipelineData().written`), or a ladder row's `target_url` of another keyword / ladder.
- **Warning text.** `<short url> is the page for "<other keyword>". Rewriting it for "<keyword>" changes what it ranks for and can lose
  its current visitors.`
- **Accept.** `Write a new page instead` (fields `{ existingPageUrl: '' }`). **Continue anyway** records the retargeting. **Severity** data.

### D6. Form duplicate warnings are not enforced on the server for app runs

- **Where.** `POST /api/orgs/:orgId/runs` (`server/src/routes/runs.ts:56-62`) calls `createRun` with no notices; enforcement exists only in
  `startRunV1` (`apiRuns.ts:143-175`). Server-side starts that never see them: proposals (`autoStart.ts:536,584`), onboarding launch ladders
  (`launch-plan.ts:34-52`, sent as plain runs), auto research (`autoStart.ts:381`), free research (`services/research.ts:70`).
- **Rule.** Move the `pipelineNotices` + `unconfirmed` step into `createRunWithMeta` (section 2.2). **Severity** money.

### D7. Watching a keyword a ladder already tracks

- **Where.** TrackingForm keywords (`TrackingForm.tsx:121-140`) -> track.
- **Rule.** `money.watch_dup`: watched keyword overlaps (`keywordsOverlap`) a ladder head or page. Info: `"<keyword>" is already checked
  every week as part of your ladder "<head>". Watching it too checks it twice.` Accept: remove it. **Severity** money (small).

### P1-P5. "I published it" (production case 4; the publish check itself is another agent's work, these are the user-facing warnings)

- **Where.** `PublishedForm` (`app/web/src/pages/tools/_components/forms/site.tsx:184-262`), opened from Needs you "I published it"
  (`pipeline/home.tsx:197`), reports (`components/reports/meta.tsx:166`), AI page and actions (`AiVisibilityPage.tsx:389`,
  `site/_components/actions.tsx:98`); server domain check `runs.ts:224-225`; payload `payload.ts:199`.
- **What goes wrong today.** Only `urlOnDomain` (which also accepts any subdomain, `shared/src/domain.ts:63-69`). Choosing a refresh draft
  **pre-fills the old page's address** (`site.tsx:219`), so "ms 365 erp" / a planned refresh is reported before the new text is live; the
  same URL can be the published page of two keywords; a URL that never mentions the keyword is accepted.
- **P1 `publish.other_page`.** Rule: the URL is in `seo_pages` with a `lastmod` or first sighting older than the draft's `startedAt`, and
  the draft was not a refresh of that URL; or the URL's stored title / h1 contains none of the keyword's tokens. Text: `<short url> looks
  like an existing page about "<its title>", not the page written for "<keyword>". Check the address.` Accept: `Choose the right page`
  (fields `{ publishedUrl: '' }`, focus the field). Continue anyway is recorded and the publish check (other agent) must still verify.
- **P2 `publish.refresh_not_live`.** Rule: chosen draft has `existingPageUrl` and `urlKey(publishedUrl) === urlKey(existingPageUrl)`. Text:
  `This is the update of <short url>. Mark it published only after the new text is live on that address.` Accept: `I will report it when it
  is live` (closes the form, nothing sent). Continue anyway = `The new text is live now` (the publish check must then compare the live
  title / H1 with the written page).
- **P3 `publish.url_taken`.** Rule: `urlKey(publishedUrl)` equals another keyword's `publishedUrl` (`pipelineData().written`) or another
  ladder row's published `target_url`. Text: `<short url> is already the published page of "<other keyword>". One page should answer one
  search.` Accept: `Choose another address`. Continue anyway records both keywords on one URL (and the Rank Tracker should then know).
- **P4 `publish.host`.** Rules: host is a subdomain (`urlOnDomain && !urlOnHost`), scheme http, or host differs from the engine's
  `canonical_host` (www vs bare), or the URL carries a query or fragment. Accept: rewrite to `https://<canonical host><path>` without
  query. Same rule for every "existing page" field. Severity data.
- **P5 `publish.no_draft`.** Rule: `contentRequestId` empty and the keyword matches no written draft (`drafts`, `site.tsx:200-210`). Text:
  `We did not write a page for "<keyword>". Pick the written page you published, or continue to check another page.` Accept: pick the
  closest draft by `keywordsOverlap`.
- **Severity.** data (wrong published status poisons ladders, rank tracking and the pile-up guard). **Runs in** server (`createRunWithMeta`
  for mode `published`) + web form.

### S1. Pages a week set, but nothing will be written

- **Where.** Cadence card (`SiteSettingsPage.tsx:375-415`) -> Site Admin `cadence`; TrackingForm `blogsPerWeek`; ladder PATCH / Pause;
  automation PATCH.
- **What goes wrong.** The engine writes nothing at levels 1-2 until a client-chosen Auto ladder has pages left
  (`Cadence_Plan.js:24-60,250`), nothing for Manual ladders, nothing while `waiting >= max_waiting`, nothing while tracking or credits are
  paused, and holds a page without profile / facts. The forecast says "none until you choose a keyword" (`shared/src/autopilot.ts:57-63`)
  but the save itself does not warn.
- **Rule.** `pipeline.writes_nothing` when `pagesPerWeek > 0` and the first true of: no Auto ladder with planned pages at level 1-2
  (`forecastPlanOf(...).writing === false`); every ladder Manual / paused / won / queued; `queue.waiting.length >= automation.maxWaiting`;
  `site.trackingStatus === 'paused'` or `creditsPausedAt`; `!readiness.ready`. Body names the reason and the fix.
- **Accept** per reason: `Choose a keyword` (link), `Switch "<head>" to Auto`, `Publish the waiting pages` (link), `Add the profile`
  (link to `readiness.page`). Links are fine as Accept when the fix needs the person. **Continue anyway**: save. Severity cosmetic / trust.

### S2. Pages a week above what the pile-up limit lets through

- **Rule.** `pagesPerWeek > automation.maxWaiting - queue.waiting.length` (cadence and automation saves). Text: `Your limit stops new
  pages when <maxWaiting> wait to be published, so the weekly run writes at most <room> page(s) until you publish some.` Accept:
  `Raise the limit to <pagesPerWeek + waiting>` (fields on automation PATCH). Severity cosmetic.

### S3. "Keywords written at the same time" lowered below what is already writing

- **Where.** `pipeline/controls.tsx:226-243` -> `PATCH .../automation` (`routes/ladders.ts:73-86`).
- **Rule.** `maxActiveLadders < activeAutoLadders(ladderCards)`. Text: `<n> ladders are writing now. With a limit of <new>, "<last heads>"
  wait as Queued until one is done or paused.` Accept: `Keep the limit at <n>`. Severity cosmetic.

### S4. Autopilot level vs ladder modes

- **Rules.** `pipeline.level3_manual`: level 3 with `defaultMode === 'manual'` (an announced ladder starts Manual and writes nothing on its
  own). `pipeline.level_drop_system`: level lowered from 3 while a `system_announced` ladder has planned pages (its pages are written at
  level 3 only, `Cadence_Plan.js:26,250`). Texts: `Full autopilot starts new keywords for you, but new ladders are set to Manual, so their
  pages wait for your OK.` / `Lowering the level stops the weekly pages of "<heads>", which we started for you. Keep them by switching
  them to your own keywords.` Accept: set `defaultMode: 'auto'`; mark those ladders as chosen by the client (settings `chosen_by =
  client_picked`). Severity cosmetic / trust. **Runs in** server automation PATCH.

### S5. Ladder resumed or switched to Auto while the limit is full

- **Where.** Ladder PATCH (`routes/ladders.ts:33-41`). Rule: new state Auto + active, and `activeAutoLadders >= maxActive`. Text:
  `"<head>" waits as Queued: <maxActive> ladders already get the weekly pages.` Accept: `Make it number 1` (reorder) or raise the limit
  (pick one: reorder). Severity cosmetic.

### S6. "Pages written now" while the effective mode is Manual

- **Where.** Ladder tool form `forms/growth.tsx:40,78-96` (sends no `ladderMode`); server resolves the website default (`runs.ts:233-238`)
  and quotes the plan alone when Manual.
- **Rule.** `pagesNow >= 1` and effective mode `manual`. Text: `New ladders on <domain> are Manual, so no page is written now even though
  you chose <n>.` Accept: `Write <n> now (Auto for this ladder)` (fields `{ ladderMode: 'auto' }`, admins). Continue: start Manual.
  Severity money / trust.

### S7. Weekly pages off while an Auto ladder still has pages

- **Rule.** `pagesPerWeek === 0` and an Auto ladder has planned pages. Text: `Your ladder "<head>" has <n> pages left, but weekly pages are
  off, so it does not move.` Accept: `Write 1 page a week`. Severity cosmetic. (A line already exists in `pipeline-notices.ts:248-250` for
  new ladders only.)

### S8. Page or ladder without the author profile or business facts

- **Where.** KeywordForm, NewLadderPage, LadderForm, proposals; only `WriteNowDialog` and `LaunchStep.tsx:298-302` warn today. The server
  silently holds an Auto ladder's first page (`runs.ts:233-240`, `pagesHeld: 'profile'`) and a Write a page run is written with blanks.
- **Rule.** `content.not_ready`: `contentReadiness({ profile, businessFacts })` not ready (`shared/src/readiness.ts:52`). Text (reuse
  WriteNowDialog's): `Your author profile or business facts are missing, so the page arrives with blanks to fill.` Accept: `Add them first`
  (link to `readinessPage`). Continue: `Write anyway`. Severity data.

### C1. Schedules switched on beyond the balance

- **Where.** Monitors, pages a week, autopilot level saves. On-demand runs are already refused (`billing.ts:258-266`).
- **Rule.** After the change, `runwayDays(available, dailyBurn')` (`shared/src/billing.ts:126`) < 14 days, or the schedules' reserve exceeds
  the balance (the credit guard then pauses the website, `billing.ts:547,660-675`). Text: `With this change your credits last about <n>
  days. When they run out the website's weekly work pauses.` Accept: `Add credits` (link) or keep the old setting (pick: keep the old
  setting as the Accept, add credits as a link). Severity money.

### I1. CMS connection on another domain

- **Where.** `createConnection` / `updateConnection` (`server/src/services/cms/service.ts:149-210`): `baseUrl` and `publicUrlTemplate`
  stored unchecked; publishing later refuses to tell the engine (`:385-386`).
- **Rule.** `data.cms_domain`: WordPress / webhook `baseUrl` host, or the template's host, is not on `site.domain` (`urlOnDomain`).
- **Text.** `This connection publishes to <host>, not to <domain>. Pages sent through it will not appear on your website.` Accept:
  `Use https://<domain>` in the template. Severity data.

### I2. Outreach mailbox on another domain

- **Where.** Link settings `mailboxId` (`shared/src/schemas.ts:759`, `routes/linkBuilder.ts:217`), sequence approve (`schemas.ts:763`).
- **Rule.** `data.mailbox_domain`: mailbox address domain is not the website's registrable domain and is not a free mail provider used on
  purpose; for a company with several websites, the mailbox domain equals another website of the company. Text: `Outreach for <domain>
  would be sent from <address>, an address of <other domain>. People you write to will not connect it with <domain>.` Accept: choose the
  mailbox on <domain> when one exists. Severity data / trust.

### I3. Backlinks file for another website

- **Where.** `parseLinkImport` (`shared/src/link-import.ts:100-187`): when no target column is on the site (`:124`), rows are kept with an
  empty `to_url` (`:143`) and the referring domains are credited to this website. The AI report import refuses a file for another site
  (`shared/src/ai-import.ts:146-148`).
- **Rule.** `data.import_other_site`: a URL-like target column exists but under 20% of its hosts are on the site. Text: `This file lists
  links to <top host>, not to <domain>.` Accept: cancel the upload. Severity data.

### I7. The added domain redirects elsewhere

- **Where.** Website create (`routes/sites.ts:219-247`). Rule: one server `HEAD`/`GET` of `https://<domain>/` follows redirects to another
  registrable domain. Text: `<domain> sends visitors to <target>. Track <target> instead?` Accept: fields `{ domain: target }`. Severity data.

### B1. A run's own business text differs from the website's

- **Where.** Ladder tool `forms/growth.tsx:100-110`, KeywordForm business fields; `payload.ts:105,110,139,168` prefer the run's text.
- **Rule.** Non-empty run business / customers / facts that share under 50% of words with the website's. Info: `These pages will describe
  your business differently from your website settings.` Accept: clear the fields (use the website's). Severity cosmetic / data.

---

## 4. Order to build (by money and market impact)

1. Mechanism (2.2) inside `createRunWithMeta` + 409 handling in the web; move `pipelineNotices` server-side for app runs (D6).
2. Market family: M1, M2 (+ `market/sync` endpoint), M4 with the gazetteer, M5, M6, M3, M7.
3. Money family: D1 (proposal confirmation), D2, D3, S6, D4, C1.
4. Publish family P1-P5 (with the publish-check agent).
5. Settings family S1-S5, S7, S8; identity family I1, I2, I3, I7, M9, B1, D5, D7, M8.

Tests: each warning code gets a pure test in `shared` (`consistency.test.ts`) with the production fixtures named here (devaicon
Pakistan vs UAE; "ai automation solutions gcc"; "erp & crm software" vs "dynamics 365 erp system"; "ms 365 erp" at
/dynamics-365-business-central-uae), plus a server test that `POST /api/orgs/:orgId/runs` and `/api/v1/runs` answer 409 `confirm_needed`
for the same input and start with `acknowledge`.
