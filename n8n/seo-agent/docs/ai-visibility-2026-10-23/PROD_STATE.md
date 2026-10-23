# AI search visibility in production: audit of 2026-10-23

Read-only audit of the live engine (GCP `alaventra-prod`, n8n reached through `deploy/gcp/tunnel.sh`, public API `GET` only),
taken 2026-10-23 between 13:20 and 13:45 UTC. Nothing was written, started, activated or deactivated. No credential was printed.
Raw dumps stayed in the session scratchpad, not in the repo.

The production data was wiped at **2026-10-21 13:32 UTC** (LIVE_RUN_2026-10-21 §182), so every figure below starts there.

## 1. What is deployed

| Workflow | Active | Nodes (prod = HEAD) | Updated in prod (UTC) |
|---|---|---|---|
| AI Visibility Tracker `SEOagentAIVisib1` | yes | 138 = 138 | 2026-10-23 13:16 |
| AI Pulse `SEOagentAIPulse1` | yes | 74 = 74 | 2026-10-23 13:16 |
| AI Growth `SEOagentAIGrow1` | yes | 115 = 115 | 2026-10-23 13:16 |
| Schedule Catch-up `SEOagentCatchUp1` | yes | 47 = 47 | 2026-10-21 06:09 |
| Cycle Dispatcher `SEOagentCycleDsp` | yes | 63 = 63 | 2026-10-21 22:05 |
| main `SEOagentV4Full01` | yes | 761 = 761 | 2026-10-23 13:15 |

- **Production equals git HEAD (`3af6f7a2`) for every workflow.** Every node's parameters were compared with
  `n8n/seo-agent/workflows/*.json`. The only differences are the alert webhook placeholder that `deploy_engine.py` fills in at deploy
  time (R29), in the `Alert Retry Plan` nodes, the Error Handler and Page Watch. The last engine deploy was today at 13:16 UTC (commit
  `99278f41`).
- `versionId == activeVersionId` on every active workflow, so nothing is pending publication.
- **Data Table columns match `ladder_common.py` exactly** for `seo_ai_prompts` (19), `seo_ai_answers` (25), `seo_ai_visibility` (42),
  `seo_ai_daily` (19), `seo_monitors` (22), `seo_cycles` (16), `seo_cycle_jobs` (15), `seo_run_ledger` (20), `seo_cache`, and
  `seo_ai_pages` / `seo_ai_targets` / `seo_ai_growth`.
- The triggers are now:
  - **AI Visibility and AI Growth have no schedule.** They start only through Execute Workflow: from the Cycle Dispatcher, from the
    main workflow's `Start AI Visibility` (an on-demand run from the app), or from the pulse's `Resume AI Run`.
  - **AI Pulse** runs on cron `30 6 * * *` America/New_York, **every day**. The plan skips each website on its own cycle weekday,
    not on Mondays, so the old "Tue–Sun" description is out of date.
  - **Cycle Dispatcher** sweeps every 5 minutes (`3-58/5`).
  - **Catch-up** sweeps every 15 minutes (`7,22,37,52`).
- Minor: the **test callback receiver** `SEOagentCallback` is active in production. It is a webhook at path `seo-callback` with no
  authentication, carried over by the migration, although the manifest says it is never deployed. It was not probed. Deactivating it
  is the owner's call.

## 2. Execution history since the wipe

| Workflow | Executions | Detail |
|---|---|---|
| AI Visibility | **0** | never ran in production |
| AI Growth | **0** | never ran in production |
| AI Pulse | 2 (`trigger`) | 833 (2026-10-22 10:30:00 UTC) and 1230 (2026-10-23 10:30:00 UTC). Both on time (06:30 New York, EDT), both `success`, about 5 s, **$0** |
| Catch-up | 1 saved (an error) | execution 496 at 2026-10-21 13:37: the watchdog alarm "the dispatcher has written no sweep record", expected right after the wipe. It was delivered by webhook and e-mail, and it is the only row in `seo_ops_alerts`. Successful sweeps are not saved (`saveDataSuccessExecution: none`); the last one, at 13:22 UTC, recorded "AI Pulse fired on time (1230), Page Watch fired on time (1217)" |
| Cycle Dispatcher | 0 saved | successes are not saved. Its last record (`seo_cache cycle:last`, 13:28 UTC) says it is sweeping and healthy |

Both pulse runs read the sites, monitors and cycles, then stopped at `AI Plan` with *"no site has a question panel yet (the weekly AI
visibility run writes it)"*. They served 0 sites, made 0 requests and settled $0.

The schedules fire on time: the pulse at 06:30:00 New York both days, and Page Watch at 05:45 New York. Catch-up has nothing late on
record.

## 3. Data per website

There are two websites in production, and both are the owner's: **techand.ai** (added 2026-10-22 16:58 UTC) and **devaicon.com**
(added 2026-10-23 11:39 UTC). There is no other customer website.

| | techand.ai | devaicon.com |
|---|---|---|
| `seo_monitors.ai_visibility` / `ai_pulse` / `ai_growth` | on / on / on | on / on / on |
| `ai_prompts_max` (panel size) | 12 | 10 |
| `ai_engines` | chatgpt, perplexity, gemini, claude, ai_overview, ai_mode | same |
| `ai_personas` / `ai_markets` / `ai_pulse_mode` / `ai_pulse_per_week` | empty / empty / empty / null (defaults) | same |
| `seo_ai_prompts` (active / refused) | **0 / 0** | **0 / 0** |
| `seo_ai_visibility` (latest row) | **none** | **none** |
| `seo_ai_daily` | none | none |
| `seo_ai_answers` | none, so there is no per-engine failure rate | none |
| `seo_cache ai_run:*` (split runs) | none: nothing running or stuck | none |
| cycle (`seo_cycles`) | Thursday 06:00 Asia/Karachi (01:00 UTC), cycle 0 opened 2026-10-22, 0 of 8 jobs done | Friday 06:00 Asia/Karachi (01:00 UTC), cycle 0 opened 2026-10-23, 0 of 8 jobs done |

- **Every AI table is empty**: `seo_ai_prompts`, `seo_ai_answers`, `seo_ai_visibility`, `seo_ai_daily`, `seo_ai_pages`,
  `seo_ai_targets` and `seo_ai_growth` have 0 rows each.
- **Data Table size:** about 1.64 MB in total across 39 tables, against `N8N_DATA_TABLES_MAX_SIZE_BYTES` = 1 GiB (from
  `deploy/gcp/compose.prod.yml`; the running container's environment was not read). That is about 0.15%, the largest table being
  `seo_cache` at 0.56 MB.
- **DataForSEO balance:** $46.04 at the last ledger reading (10:30 UTC today).

## 4. Spend (`seo_run_ledger`, last 7 days)

| Mode | Runs | Estimate | Settled |
|---|---|---|---|
| ai_visibility | 0 | – | – |
| ai_pulse | 2 | $0 | $0 (DataForSEO $0, Claude $0; "this workflow has no Claude node") |

For context only (not AI visibility), the 19 ledger rows since the wipe are all `done` with nothing left unsettled. The paid ones were
two discover runs, a ladder, three keyword checks, two site tracker runs and one ladder page run. The page run
(`keyword ladder:lad_…`) was estimated at $0.80 of Claude and settled $1.14 (+43%).

## 5. Quality spot-check of stored answers

**It could not be done on production data**, because production holds no AI answer (§3). Two fallbacks were tried:

- **The isolated `alvrun` stack** (production-like, 2026-10-21): reading its database was **refused by the permission system** as a
  production read, and was not retried.
- **Real raw engine answers kept in the repo.** `harness/fixtures_live/scraper|r_gemini|r_perplexity|r_claude|aio|aimode.json` are
  real DataForSEO answers to techand.ai's questions, captured live. They were run **offline** through the current production parser
  (`Parse_AI_Answers.js` at HEAD = production), with techand.ai's real `AI Plan` (brand names, competitors and learned aliases) from
  the live run 623 captured in `r_a10_aivis623.json.gz`. Each flag was checked against the full answer text. Five synthetic edge cases
  were added and are labelled as such.

Brand flags (`mentioned` / `cited` / `rank`) on the 6 real answers (ChatGPT, Gemini, Perplexity, Claude, AI Overview, AI Mode):

- **All correct.** None of the answers names or cites techand.ai or "Tech&", and all 6 were stored as not mentioned, not cited, rank
  0. **There are no false positives and no false negatives for the brand.**
- **SYN:** Tech& placed second in a ChatGPT table with a cited link gave mentioned, cited, rank 2 and the right `our_urls`. Correct.
- **SYN:** the near-misses "technology and", "fintech and" and "Tech & Co Ltd" were not counted. Correct.
- **SYN:** techand.ai cited as a source but never named gave `mentioned = true`, `cited = true`, `rank 0`. This is by design
  (`mentioned = named || cited`), but it means the "mention rate" also counts answers that only cite the site.
- **Possible false negative (not tested live):** the business name is "Tech&". An answer that writes "Tech &" with a space would not
  match, because the brand names are `techand.ai`, `Tech&`, `Techand` and `techand`.

Competitor flags (`competitors`, `brands`) are **wrong in 5 of the 6 real answers**:

1. **One business counted two or three times.**
   - EDICOM was stored as two competitors, `edicomgroup.com` and `edicom.com`, in 4 of 6 answers.
   - ClearTax was stored as `cleartax.com` and `cleartax.in`.
   - Advintek was stored as two hosts.
   - "Thomson Reuters (formerly Pagero)" was stored as **three** competitors: `thomsonreuters.com`, `pagero.com` and
     `europe.thomsonreuters.com`.

   There are two root causes:
   - The learned aliases map spelling variants of one brand to different domains (`EDICOM` → edicomgroup.com, `Edicom` → edicom.com;
     `Pagero` → pagero.com).
   - `mergeBrands` folds names into domains, but **never folds domains that share a registrable domain** (europe.thomsonreuters.com
     vs thomsonreuters.com) or a former name.

   **This changes our rank:** with Tech& placed second right after Thomson Reuters (SYN), the stored rank was **4 instead of 2**. With
   Tech& second after a business written only one way, the rank was 2, as it should be. Share of voice and "competitors named" are
   inflated the same way.
2. **Platforms named as integration targets counted as competitors.**
   - AI Mode's "check connectivity with SAP, Oracle, Microsoft Dynamics 365, Zoho" became the competitors `oracle.com`,
     `microsoft.com` and `zoho.com`.
   - Gemini's "a Microsoft Dynamics 365 integrator" became `microsoft.com`.
   - For techand.ai, a **Microsoft Dynamics 365 partner**, the stored competitor list itself contains `microsoft.com`, so the client's
     own platform vendor is reported as a rival.
3. **Directories and cited sources counted as competitors.** `yellowpages-uae.com`, `uaeasp.ae` (an ASP directory),
   `theinvoicinghub.com` and `meydanfz.ae` (a free-zone authority) appear in `competitors` only because the answer cited them.
   Government sources (`mof.gov.ae`, `tax.gov.ae`) and the news sites were correctly left out.

Verdict: the client's own flags are reliable. The competitor lists are noisy enough that **"who AI names instead of you", share of
voice and our position in a list should not be trusted until duplicates are merged by registrable domain and alias**, and the
competitor field is limited to businesses offered as answers (not platforms mentioned in passing, and not cited directories).

## 6. What customers get today

**AI visibility has never run for anyone in production**, and as things stand it will not run until one of these happens:

- **The owner flips the dispatcher.** The Cycle Dispatcher is in **`plan_only`**: there is no `seo_cache` row `cycle:mode`, and the
  default is the safe one. Its last sweep would start "AI visibility for techand.ai" and "AI visibility for devaicon.com" now, but
  starts nothing.
  - AI visibility is the **first job of each website's cycle**. Backlinks, rank tracker, AI growth, content cadence, link builder and
    audit all wait behind it. **The whole weekly loop is stalled for both websites, not only the AI part.**
- **A user starts an on-demand AI visibility check in the app**, which goes through the main workflow's `Start AI Visibility`. None
  has been started since the wipe.

Meanwhile the **AI Pulse fires every morning, does nothing and costs $0**: no website has a question panel, so it is harmless but idle.
A customer opening the AI visibility page sees no panel, no rates and no daily series.

## 7. Deploy safety

Right now:

- **0 executions are running, waiting or queued.**
- **0 rows in `seo_cycle_jobs`**: no dispatcher job is starting or running.
- **0 `ai_run:*` split-run records**, so there is no chunked AI visibility run to resume.

A deploy now cannot interrupt any AI visibility or pulse work.

Schedules in the next 3 days (UTC; New York is on EDT until 2026-11-01):

| When (UTC) | What | Effect of a deploy at that moment |
|---|---|---|
| every 5 min at :03, :08, … | Cycle Dispatcher sweep (plan_only, writes only `cycle:last`) | none; it sweeps again 5 minutes later |
| :07 / :22 / :37 / :52 | Catch-up sweep | none; its watchdog alerts only after 20 minutes without a sweep |
| daily 09:45 | Page Watch (about 10 s) | could kill one run, which Catch-up would replay |
| daily 10:30 | AI Pulse (about 5 s while no site has a panel) | same |
| Tue 10-27 01:00 / Thu 10-29 01:00 | techand.ai "Coming up" preview / next cycle | the deploy guard holds deploys 15 minutes before |
| Wed 10-28 01:00 / Fri 10-30 01:00 | devaicon.com preview / next cycle | the deploy guard holds deploys 15 minutes before |

There is no cycle or preview due between now and Monday 2026-10-26, so the deploy guard (`deploy_guard.py`, window of 15 minutes
ahead / 10 minutes behind) would not refuse in that period. The guard cannot see on-demand runs that a user starts in the app (the
owner ran several today between 11:17 and 13:21 UTC).

**Safest window:** Saturday 2026-10-24 or Sunday 2026-10-25, **12:00–20:00 UTC**. That is clear of Page Watch and the pulse, of every
cycle or preview, and of the owner's working hours in the app. Any time Fri–Mon outside **09:40–10:40 UTC** is acceptable.

**Order of operations:** deploy the AI-visibility improvements **before** the owner adds `cycle:mode = start`. After the flip, both
websites' AI visibility runs start within 5 minutes, followed by their whole cycle. From then on a deploy can kill a running job: the
dispatcher retries it, but each retry uses one of its 3 attempts.

After 2026-11-01 (end of daylight saving time), the pulse moves to 11:30 UTC and Page Watch to 10:45 UTC.

**Stored shapes a new build must keep reading.**
- Both `seo_monitors` rows hold **empty strings** in `ai_personas`, `ai_markets` and `ai_pulse_mode`, and **null** in
  `ai_pulse_per_week` and `stuck_weeks`. They also hold booleans as booleans and `ai_engines` as a comma-separated string. A new
  build must treat `''` and `null` as defaults.
- `seo_cycles` holds `current_key: ''`, `next_preview_at: ''`, `skip_jobs: 'site_tracker'`, a numeric `cycle_weekday` and
  `tz: Asia/Karachi`.
- `seo_cache` keys in use: `cycle:last`, `catchup:*` (armed, last, watchdog), `serp:*`, `idem:*`, `cost:*`, `model:*`, `reach:*`,
  `watch:*`. There are none of `ai_run:*` / `ai_brands:*` yet.
- The AI tables are empty, so a new build has **no stored AI rows to stay compatible with**, as long as it keeps the column sets
  above. A column it adds still needs `sync_tables.py`, which `deploy_engine.py` runs before updating workflows.

## 8. What could not be read

- **Executions before 2026-10-21 13:32 UTC**, which were wiped.
- **The isolated `alvrun` stack's database**: the read was refused by the permission system and not retried.
- **The running n8n container's environment**: the table size limit was taken from `compose.prod.yml`.
- **The app API**, which needs a login. Only `GET /api/health` was read: `{"ok":true,"db":true,"n8n":{"api":true,"webhook":true}}`.
