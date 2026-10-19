# Plan: start on the day of setup, a 7-day cycle per website, keyword-first autopilot

Written 2026-10-19 from the handoff `SCHEDULING_KEYWORDS_HANDOFF.md`. **Status: approved by the owner on 2026-10-19, with the additions
discussed that day: three autopilot levels (§5.5), the next keyword after a win (§5.6), "tell first, then go" and the weekly "Coming up"
plan (§5.7). Implementation started (team and contracts in §14 and §15). The decisions in §11 are taken as recommended, except D8 and
D10, which are confirmed again at deploy time because they touch production and spend money.**

Research behind it: five read-only passes over the code (engine schedules, app schedules + onboarding, keyword machinery) and the market
(how SEO tools schedule per project; how content autopilots choose keywords and ask for approval), plus a check of n8n's own docs. Every
claim about our code below carries a file reference; every market claim carries the URL that was opened.

---

## 0. The plan in one screen

**Change 1: the week belongs to the website.**
- A website's first cycle starts **within five minutes of finishing setup**. After that it repeats **every 7 days on the same weekday**,
  at 06:00 in the website's own time zone.
- The seven Monday crons go away. A new **Cycle Dispatcher** reads a small schedule table every 5 minutes and starts each site's jobs
  one after the other, in today's Monday order. It is built from what we already have: Site Kickoff's job list, the catch-up's
  record-then-start rule, and the run ledger as the record of what finished.
- Daily jobs stay daily: AI Pulse skips each site's own cycle day instead of Monday. Monthly work runs on the site's monthly date, which
  is the day of the month it started.
- A missed or crashed cycle is just a due row the next sweep picks up. That removes the main reason for the Monday deploy ban and most of
  the catch-up's weekly bookkeeping.

**Change 2: no writing without a keyword the client chose (or, on full autopilot, saw announced and did not stop).**
- Onboarding asks one question, **"How much should we do on our own?"**, with three levels: 1 only my keywords, 2 my keywords + keep my
  pages healthy (default), 3 full autopilot. Details are in §5.5.
- Whatever the level, nothing is written that the client could not see first. Two days before each cycle they get a **"Coming up"** plan
  (app + e-mail), with Approve or Skip on every item. A new keyword picked by the system is **announced and starts after 2 days** unless
  changed (§5.7).
- When a ladder is won, the next queued ladder starts. When the queue is empty, the next keyword is suggested, or announced on full
  autopilot (§5.6).

The bullets below describe level 1, the strict base. Levels 2 and 3 widen what runs automatically (§5.5).
- The automatic content pipeline writes **only ladder pages**, and only for ladders the client started: they typed the keyword, or picked
  it from our recommendations.
- Everything else the cadence picks by itself today becomes a **suggestion with a price and a "Write it" button**: AI answer pages, AI
  refreshes, decay refreshes, striking-distance queries and rising trends. The Techand page came from this list.
- Onboarding gets a new step, **"Your first keyword"**. It asks in plain words what customers search for, and starts keyword research in
  the background as soon as the business step is saved, so the suggestions are ready by the time the owner reaches the step. Each
  suggestion shows plain difficulty ("Good chance", "Takes a few months", "Hard for now"), searches a month, why we suggest it, and the
  credits. The owner picks one keyword (two at most), or chooses later. Until a keyword is chosen, monitors run and nothing is written.

**Size:** about 6 to 8 working sessions. The engine is half of it; the app (onboarding, Pipeline calendar, about 60 "Monday" strings,
marketing) is the other half. Plus a paid end-to-end rehearsal (about $4) and a careful production deploy around the database reset.

---

## 1. The problem

1. **Everyone shares one Monday.** A client who sets up on Tuesday waits six days for their first weekly cycle. Production load piles up
   on Monday morning in New York, the same window in which a deploy or restart loses fires (R94: every n8n restart discards a due cron
   fire). The fixed slot is hard-coded in about 15 engine places, 8 app constants and about 60 customer-facing strings.
2. **The pipeline writes topics nobody chose.** On 2026-10-19 Techand set up "crm service provider" as a keyword *to track*, which only
   feeds rank checks. With no ladder, the Content Cadence filled the week itself and wrote "dynamics 365 finance operations partner uae"
   (an `ai_refresh`). The page failed QA and its credits were refunded. For a non-technical client this is the worst failure: money and
   trust spent on a page they did not ask for.

The code path behind it, confirmed in code:

| Step | Where |
|---|---|
| The AI quota defaults to 2 a month whenever AI growth is on, and counts as on when no monitors row exists | `v5/code/Cadence_Plan.js:57` |
| A site with **0 blog posts a week** still runs for AI pages | `Cadence_Plan.js:77` (`if (!pages && !aiQuota) continue`) |
| `opportunities` defaults to `auto` | `Cadence_Plan.js:80`; app `SITE_DEFAULTS` in `app/server/src/services/ladders.ts:68` |
| AI refresh targets pass **no fit or topic gate**; they only need a page URL not refreshed for 60 days | `Cadence_Plan.js:241` |
| AI Growth gates only ladder rungs, not the target keyword itself | `Growth_Plan.js:79-81`; `kind: refresh` comes from `pageFor()`, `:98-106` |
| Site Kickoff starts the cadence whenever `pages_per_week > 0`, ladder or not | `Kickoff_Plan.js:29` |

---

## 2. Research: our own setup

### 2.1 Schedules today

| Workflow | Trigger | Built in |
|---|---|---|
| AI Visibility | Mon 07:00 | `build_monitors.py:319-325` |
| Backlink Monitor | Mon 07:30 (first run of the UTC month = full) | `build_monitors.py:461` |
| Rank Tracker | Mon 08:00 | `build_ladder_extras.py:82` |
| Site Tracker | Mon 09:00 | `build_site_tracker.py:139` |
| AI Growth | Mon 09:30 | `build_monitors.py:605` |
| Content Cadence | Mon 10:00 | `build_site_tracker.py:452` |
| Link Builder | Mon 11:00 | `build_monitors.py:727` |
| AI Pulse | daily 06:30 except Monday (`30 6 * * 0,2-6`) | `build_monitors.py:415` |
| Page Watch | daily 05:45 | `build_site_tracker.py:608` |
| Audit Scheduler | 1st of the month 06:00 | `build_monitors.py:567` |
| Schedule Catch-up | every 15 min + on n8n start | `build_catchup.py` (reads the crons from the generated workflows) |

All times are in `GENERIC_TIMEZONE`, America/New_York.

### 2.2 What breaks when the week is per site

1. **A per-site run is treated as "on demand", and on demand changes what a run does.**
   - `_monitor_sites.js:60` sets `on_demand: !!want`. Site Kickoff passes a domain, so every run it starts is on demand.
   - On demand forces the monthly work on every run:
     - AI Visibility full run with Claude, the brand question and the market index (`AI_Plan.js:86`, `:117`);
     - Backlinks full report and link gap (`BL_Plan.js:29`, `:45`);
     - AI Growth re-audits every key page and checks Wikidata (`Growth_Plan.js:172`, `:242`);
     - Link Builder runs every monthly source (`LB_Plan.js:30`).
   - On demand also ignores switched-off jobs (`_monitor_sites.js:60`) and, in the Site Tracker, paused sites (`Site_Plan.js:57-58`).
   - Only the catch-up payload, which carries no domain, gets schedule behaviour (harness S128).
   - **We need a third kind of run: scheduled, but for one site.**
2. **The run guard is per job, not per site.**
   - `_run_guard.js:95-99` refuses `same_mode` while any other run of the same job is live, for any site. Per-site runs of the same job
     would refuse each other.
   - `too_many_open` (MAX_OPEN 3, `:19`) "skips" a scheduled run. Per site, that means the site loses its week.
3. **The Rank Tracker cannot run one site.** `Tracker_Plan.js` never reads its Manual Run input; it checks every ladder
   (`:30`, `:70-71`).
4. **Monthly rules use the UTC calendar month** (`toISOString().slice(0,7)`):
   - `AI_Plan.js:37`, `BL_Plan.js:18`, `Growth_Plan.js:26`, `LB_Plan.js:95`, `Audit_Sched_Plan.js:12`;
   - `Parse_Checkin.js:22`, `Site_Plan.js:131`, `Authority_Requests.js:11`.
   - With a Monday-only schedule this rarely mattered. With runs on every day, a run after 20:00 New York on the last day already counts
     as next month, and a first cycle on the 26th followed by one on the 2nd would pay for two full runs six days apart.
5. **No stable start date exists in the engine.**
   - `seo_sites.created_at` is rewritten on every "Track my site" re-save, and the re-save also un-pauses the site
     (`Site_Row_Track.js:5-6`).
   - The only fixed date is `seo_cache kickoff:<site_id>`.
   - The app already has one: `sites.trackingStartedAt` (`app/server/src/db/schema.ts:466`), which is kept on re-save
     (`runs.ts:267-282`).
6. **The weekly jobs depend on each other's output, in Monday's order:**
   - AI Visibility writes the question panel, which the Pulse and AI Growth read.
   - Backlinks feeds the Link Builder.
   - The Rank Tracker marks rungs set aside, which the cadence reads the same morning (`Tracker_Ladder_Marks.js:2`).
   - The Site Tracker refreshes the site model and page inventory, which AI Growth and the cadence read.
   - AI Growth writes the AI targets the cadence reads.
   - The order must survive per-site sequencing.
7. **AI Pulse** skips Monday because Monday's weekly run already samples the panel. Its rotation (`_ai_panel.js:96-100` `pulseDay()`)
   counts six pulse mornings from a Monday anchor. For a Thursday site, the Thursday pulse would duplicate the weekly run and Monday
   would get no sample.
8. **Batch caps silently drop sites.** One execution covers all sites with `max_sites_per_run` 15 (AI, Backlinks, Link Builder, Pulse)
   or 25 (Site Tracker). Site number 16 is left out every week with no notice. Per-site runs remove this limit.
9. **Catch-up and guards are built on the shared crons.**
   - `build_catchup.py` `EXPECTED` lists ten scheduled workflows.
   - Build section 98 (`build_v4.py:9895-9910`) asserts the catch-up table equals the triggers.
   - `RG.caughtUp` keys `catchup:<wf>:<due>`.
   - The deploy guard refuses Mon 07:00-12:00 New York (`apply_env.py:20-45`, `deploy/gcp/deploy_engine.py:76-90`, self-test at
     `build_v4.py:9967-9981`).
10. **Wording:**
    - Engine: `BL_Report.js:111`, `Pulse_Metrics.js:95`, `Publish_Check.js:137`, `Parse_Checkin.js:37`, `Build_Track_Response.js:5`,
      `Growth_Report.js:30`, Track form text `build_v4.py:1265-1377`.
    - App: `AUTOMATIONS` in `app/shared/src/constants.ts:434-539` (every weekly entry `weekday: 1`), `nextScheduledRun()` (`:565`, global,
      no site input), the Pipeline payload `server/src/services/pipeline.ts` (calendar, `firstRun = dayOfMonth <= 7`, "every Monday" ×6),
      `pipeline-notices.ts`, `delivery.ts` (missed fires per global slot), and about 60 strings across site pages, onboarding and
      marketing (`WeekSchedule.tsx` is a Monday timeline).

### 2.3 Keyword machinery we can reuse

| Tool | What it gives | Cost / time | Where |
|---|---|---|---|
| **Keyword research** (`mode: discover`) | Seeds from the homepage, business and customers, plus Search Console queries; DataForSEO ideas, suggestions, related and competitors' keywords; Claude relevance screen; fit gate (own brand, navigational, government, other brands, off topic); per-keyword `difficulty_for_you`, `plan_type`, `months`, `chance`; tiers Now / Next / Later; a "start with" pick | $0.28 DataForSEO + $0.16 Claude, **2.1 min, asynchronous** (exec 764) | `build_v4.py:800-826`, `Rank_Keywords.js`, `Build_Keyword_Strategy.js` |
| **Keyword Check** (`SEOagentAssess`) | One keyword: volume, difficulty for your site, plan type, months, fit 0-2, up to 3 alternatives when it is a poor fit, an existing page or ladder that already holds the search | $0.027, **5 s, synchronous**; 30 a day per company in the app, cached 7 days | `build_api.py:306-393`, app `keywordChecks.ts:111` |
| **Ladder start** | Plan + rungs + the first 1-3 pages written at once (`pagesNow` can never be 0) | Plan $0.27, 2.6 min; each page about $0.8-1.2, 10-14 min | `Ladder_Plan.js:27, 624-650`, `Spawn_Page_Runs.js` |
| **New keyword ladder page** | Two tabs: "Recommended" (the last research report, max 12, stale after 90 days) and "Check your own" | free / check price | `app/web/src/pages/site/NewLadderPage.tsx` |

Gaps found:
- Onboarding never runs research and never asks for a ladder.
- "Recommended" is empty until somebody runs research by hand.
- The Keyword Check inlines the fit gate but never calls it (`fitGate(` has no call site there).
- A Manual ladder still writes its first `pagesNow` pages at start (its text says they wait for an OK).
- Research with "receive content" ticked writes the system's own top pick (`Spawn_Followups.js:9-19`, `chosen_by: 'system'`).
- "Choose keywords for me" (`autoStart.ts`, off by default) starts a ladder on the system's pick.
- There is no approval queue for topics: "Write it" opens a paid run at once, and an AI suggestion written that way loses its AI target
  (`WriteNowItem` carries no `aiTarget`).

---

## 3. Research: the market (October 2026)

### 3.1 How leaders schedule recurring work per project

| Tool | Weekday | First run at setup | Source |
|---|---|---|---|
| Moz Pro campaign crawl | **the day the campaign was created**, same time each week; cannot be changed | yes, on the creation day | mozdev.nodebb.com/community/q/post/250978 (staff answer, about 2021) |
| Semrush Site Audit | **user picks** (weekly, any day), time chosen by Semrush | first project launches automatically | semrush.com/kb/539-configuring-site-audit |
| Ahrefs Site Audit | **user picks** day, time and time zone | not stated | help.ahrefs.com/en/articles/9082329 |
| Semrush Position Tracking | daily; history shown as weekly points on **Wednesdays** | collects from creation | semrush.com/kb/326 |
| AccuRanker | rolling, 24 h after the last refresh | not stated | accuranker.com/keyword-rank-tracker (snippet) |
| Advanced Web Ranking | global Monday or Wednesday | n/a | snippet only |

The market uses three models: the creation day (Moz), a day the user picks (Semrush, Ahrefs, Serpstat), or a rolling interval
(AccuRanker). Apart from AWR, no documented leader runs every customer on one global day. Starting the first run at setup is common.

### 3.2 Engineering patterns for per-customer schedules

- **What mature schedulers have in common**:
  - Temporal Schedules: docs.temporal.io/schedule;
  - pg-boss: its scheduling.md;
  - Kubernetes CronJob: kubernetes.io/docs/concepts/workloads/controllers/cron-jobs;
  - Google Cloud Scheduler: docs.cloud.google.com/scheduler/docs/overview;
  - River: riverqueue.com/docs/periodic-jobs.

  Each one has the same four features: a **persisted next-fire time**, a **bounded catch-up that runs the most recent missed fire once**,
  an **overlap policy**, and an **idempotency key per occurrence**, because delivery is at least once. In-memory crons lose fires on
  restart; River documents exactly the failure we have (R94).
- **A per-record schedule in n8n** follows the pattern the n8n community recommends: a table of schedules plus one manager workflow that
  polls and starts runs (community.n8n.io/t/…/298255). Editing per-customer triggers through the API is advised against.
- **Concurrency:** `N8N_CONCURRENCY_PRODUCTION_LIMIT` does not throttle sub-workflow executions (docs.n8n.io, control-concurrency). The
  dispatcher has to cap starts itself.
- **n8n's durable scheduler** (verified on docs.n8n.io/deploy/host-n8n/configure-n8n/durable-scheduler):
  - It is available from 2.36 and on by default from 2.45. On our 2.41.4 it needs `N8N_SCHEDULER_ENABLED=true`.
  - Its "If Execution Is Missed: Run the Most Recent Missed Execution" option exists only on Schedule Trigger nodes added from 2.36 on.
    Ours are typeVersion 1.2.
  - It would make the dispatcher's own 5-minute trigger and the two daily crons survive restarts. **It is not needed for this plan**,
    because the dispatcher's state is durable anyway. I list it as a later, separate upgrade (§11, D11).
- **DST:** store intent (weekday, local time, IANA zone) and derive the UTC instant each time; never add 7 × 24 h (Jon Skeet,
  codeblog.jonskeet.uk/2019/03/27/storing-utc-is-not-a-silver-bullet). Keep local run times out of 01:00-03:00. Our catch-up kit already
  has a DST-safe `zonedToUtc` built on `Intl` (`_catchup.js`).

### 3.3 How autopilots choose keywords and ask for approval

| Pattern | Who | Source |
|---|---|---|
| URL only, autopilot by default, approval optional | SEObot, Junia, Outrank (auto-publishes "one key phrase per day"), Search Atlas OTTO ("approval mode" opt-in) | seobotai.com, junia.ai, outrank.so, searchatlas.com/otto-seo |
| Reads the site, drafts a profile and competitors **for the owner to confirm**; every content type starts in review; autonomy earned after 5 approvals at 90%+, auto-pause under 80% | **Frase** (the strongest model found) | frase.io/features/autonomy.md, docs.frase.io/feature-reference/autonomy-trust-center |
| Small first batch from a site analysis | Koala ("Analyze My Site" suggests 3 articles; drafts or auto-publish per brand) | koala.sh |
| Client supplies keywords; pilot of 5 approved articles | SEOwind | seowind.io |
| Suggested topics **and** the owner's own | BlogBuster | blogbuster.so |
| Difficulty **for your domain**, in words (Very easy … Very hard) | Semrush Personal Keyword Difficulty | semrush.com/kb/1434 |
| Up to 5 seed keywords → topics and pillar pages | Semrush Keyword Strategy Builder | semrush.com/kb/1058 |

Google's own guidance:
- Scaled content abuse covers "many pages … generated for the primary purpose of manipulating search rankings … no matter how it's
  created" (developers.google.com/search/docs/essentials/spam-policies, updated 2026-08-28).
- The helpful-content warning signs include "producing lots of content on many different topics in hopes that some of it might perform
  well" and "extensive automation to produce content on many topics" (…/creating-helpful-content, updated 2026-10-05).
- Google advises: "manually factcheck and review all AI-generated content … before publishing" (…/using-gen-ai-content, updated
  2026-10-01).

What the market says to us:
- **No URL-only autopilot gates at the keyword level.** That is the gap and our differentiator: one owner-chosen, on-topic keyword ladder
  answers the "many topics" warning sign directly.
- Complaints about the URL-only tools match our incident:
  - off-topic suggestions and cannibalisation (a Surfer Trustpilot review, via hackceleration.com/labs/review/surfer);
  - 30+ sites reported banned after bulk auto-publishing (uk.trustpilot.com/review/koala.sh).
- **What works for non-technical owners:**
  - start from the website and show a short list to confirm (Frase, Koala);
  - always allow "type your own" (BlogBuster, SEOwind);
  - difficulty for *their* site, in words (Semrush PKD);
  - a small first batch (Koala 3, SEOwind 5);
  - spend shown at the choice.
- No vendor was found asking "what do your customers search for?" literally. That wording is our suggestion, not market evidence.

---

## 4. Design, change 1: a 7-day cycle per website

### 4.1 Options compared

| | (a) Daily crons + "weekday is today" filter | (b) **Schedule table + dispatcher** (chosen) | (c) One cron per customer |
|---|---|---|---|
| Correctness | One missed day loses that day's cohort for a week, unless the filter becomes "due and not done", which needs per-site state anyway | Due-and-not-done is the rule itself; the most recent missed cycle runs once | Same loss on restart as today |
| Restarts and deploys | Still lose the in-memory fire; the catch-up still does weekly bookkeeping | A restart only delays to the next 5-minute sweep; a killed job is seen in the ledger and retried | Worst: N triggers to re-arm |
| Job order per site | Fixed times; sites that queue behind the run guard can run out of order | Each site's next job starts only after the previous one finished | Fixed times |
| Batch caps (15 / 25 sites) | Kept, still drops sites silently | Gone: one run is one site and one job | Gone |
| What the app can show | Computed guesses | The exact next run per site and job, read from the table | Computed |
| Work | Smaller in the workflows, but per-site state still needed | One new workflow + one kit + a third run kind in 7 plan nodes | Fragile, advised against |

**Chosen: (b).** It is the pattern every mature scheduler converged on (§3.2), and it reuses three parts we already trust:
- Site Kickoff's job list and its "read the site's own settings" rule;
- the catch-up's record-then-start idempotency;
- the run ledger as the record of what finished.

### 4.2 The cycle

- **Anchor:** the moment the site's tracking starts (the app's `trackingStartedAt`, sent to the engine). It is stored once and never
  rewritten by a re-save.
- **Time zone per site:** the owner's browser zone, captured in onboarding. If missing, the engine zone (America/New_York) is used.
- **Cycle 0** is due at the anchor itself: the work starts right away.
- **Cycle n ≥ 1** is due on `anchor local date + 7n days` at **06:00 local** (decision D1). It is computed with `zonedToUtc` each time,
  so a DST change never moves it. The cycle weekday is the anchor's weekday in the site's zone.
- **Cycle key:** `cyc:<site_id>:<YYYY-MM-DD>`, the local due date. One key per site per week is the idempotency key of everything in that
  cycle.
- **Missed cycles never stack up.** If the dispatcher finds a site more than 7 days overdue (a long pause, a dead host), it runs the
  **most recent** due cycle once and moves on. A cycle due less than 12 hours before the next one is skipped and recorded (the catch-up's
  `next_gap_hours` rule).
- **Paused sites** (by the owner or by the credit guard) are skipped. On resume, the overdue cycle runs once, then the normal weekday
  continues.
- **Changing the weekday** (Settings, decision D7): the next cycle moves to the next chosen weekday at least 3 days after the last cycle
  started, so two cycles never run days apart.

### 4.3 Jobs inside a cycle, in today's Monday order

| # | Job | Runs when | Notes |
|---|---|---|---|
| 1 | AI Visibility | the site has it on | writes the question panel the later jobs read |
| 2 | Backlinks | on | full when the cycle is the site's monthly cycle (§4.4), else light |
| 3 | Rank Tracker | the site has a ladder | needs a new one-site filter (§2.2 item 3) |
| 4 | Site Tracker | always, except in cycle 0 | "Track my site" already ran it at setup |
| 5 | AI Growth | AI visibility and AI growth are on | |
| 6 | Content Cadence | **a client-chosen Auto ladder has a page to write** (change 2) | otherwise skipped with the reason, which is shown in the app |
| 7 | Link Builder | on | |
| 8 | Audit | the monthly cycle, if audits are on (decision D2) | heavy crawl last |

- **Dependency rule:** a job starts only when the job before it in the same cycle is done, skipped or has given up. That gives exact
  data freshness with no fixed clock times.
- A job that gave up after 3 attempts does not block the rest of the cycle. The weekly report says which job did not run and why.

### 4.4 Monthly work, per site

- Each site gets a **monthly date**: the anchor's day of the month, clamped to 28.
- The monthly extras run in the **first cycle on or after that date** each month:
  - AI Visibility's full run (Claude, brand question, market index);
  - the Backlinks full report;
  - AI Growth's Wikidata check;
  - and the Audit, if decision D2 moves it into the cycle.
- That is exactly 12 times a year, cycle 0 included, so the credit forecast does not change.
- **The dispatcher decides and passes `monthly: true` to the job.** The jobs stop computing UTC months themselves. One rule lives in one
  place (INVARIANTS rule 2).
- Rolling rules that already work per site stay as they are: Link Builder's 25-day sources, the Rank Tracker's 28-day checks of
  unpublished and won pages, the Site Tracker's 25-day trends reuse, Backlinks' 85-day gap refresh.

### 4.5 A third kind of run: `trigger: 'cycle'`

Every weekly workflow's plan node gets the same input contract (shared through `_monitor_sites.js`, and in `Tracker_Plan.js`,
`Site_Plan.js` and `Cadence_Plan.js`):

| Input | Scheduled (cron, none left after this) | On demand (app / API) | **Cycle (new)** |
|---|---|---|---|
| Sites | all active | the one named | **the one named** |
| `on_demand` | false | true | **false** |
| Switched-off jobs and paused sites | honoured | ignored (kept on purpose for manual runs) | **honoured** |
| Monthly extras | UTC month rule | forced | **from `monthly`** |
| Ledger key | `schedule:<mode>` | `parent:<id>` | **`cycle:<cycle key>:<job>`** (autopilot spend in credits, same as `schedule:`) |
| Report | weekly | on demand | **weekly, dated by the cycle** ("week of Wed 15 Oct") |

### 4.6 The Cycle Dispatcher (new workflow `SEOagentCycleDsp`)

- **Triggers:**
  - a Schedule Trigger every 5 minutes (offset from the catch-up's minutes);
  - n8n's Instance Started event;
  - a Manual entry with `dry_run` / `plan_only` and, in the harness only, `now`.
- **Reads:** `seo_cycles`, `seo_cycle_jobs`, `seo_sites`, `seo_monitors`, `seo_ladder_settings`, `seo_cadence`, ladders, the ledger's
  rows of the last 2 days, and the n8n executions of runs it started (the catch-up's API credential).
- **Decides:** a pure kit `v5/code/_cycle.js` (CYC), harness-replayable like `_catchup.js`, with no clock, network or table access of its
  own. For each site:
  1. the current cycle key;
  2. the next job;
  3. one verdict per job: `start`, `wait` (dependency), `running`, `done`, `skipped` (with the reason), `refused_retry`, `failed_retry`
     or `gave_up`.
- **Starts:**
  - at most 2 jobs per sweep, and never more than 2 dispatcher jobs in flight;
  - never into a refusal it can see (RG `max_open`), with sites ordered by how overdue they are;
  - **record first, then start**: the `seo_cycle_jobs` row is written as `starting` before an Execute Workflow call with
    `waitForSubWorkflow: false`, the catch-up's proven pattern;
  - the claim is read back, so two racing sweeps start a job once.
- **Learns the outcome from the ledger row** `cycle:<key>:<job>`:
  - settled or handed off means **done**;
  - `refused` for capacity (`too_many_open`, `same_mode`) means retry next sweep without spending an attempt;
  - a reservation past the 2-hour stale rule, or an execution n8n reports `crashed` / `canceled`, means failed: retry, 3 attempts, then
    `gave_up` with an alert through the ops alert path.
- **Why not one long execution per site** (Kickoff's `waitForSubWorkflow: true`): a restart kills the parent and its child, and nobody
  resumes it. A sweep over durable state resumes by construction. The cost is up to 5 minutes between jobs: a full cycle of 7 jobs takes
  about 40-60 minutes per site.
- **Capacity:** about 15-25 minutes of runtime per site per cycle, plus written pages (10-14 min each, run by the main workflow under its
  own Rate Limit). With 2 jobs in flight that is roughly 8 sites an hour, about 190 a day, spread over the week by start day. Plenty for
  launch. Queue-mode workers (`production/`) raise it later.

### 4.7 Site Kickoff becomes "start the cycle"

- `POST /webhook/seo-site-kickoff` keeps its URL and its refusals (not tracked, paused, already started unless `force`).
- Instead of starting the jobs itself, it **writes the site's `seo_cycles` row** with `anchor_at`, `tz` and cycle 0 due now, plus
  `skip_jobs` (what the app already ran today).
- The dispatcher starts the jobs within 5 minutes.
- **Safety net:** a tracked, active site with no `seo_cycles` row is adopted by the dispatcher at the next sweep (anchor = now), and the
  adoption is logged. A failed call from the app can therefore only delay the start, never lose it.
- ~~The app calls it right after the `track` run is accepted~~ (superseded 2026-10-19, E4): **"Track my site" writes the row itself**, after
  the `seo_sites` row is saved, with the same builder (`CYC.cycleRow`): `anchor_at` = the request's `tracking_started_at` (the kickoff's
  window, else now), `tz` = its `timezone` (else the engine zone), `skip_jobs` = `site_tracker`. An existing row keeps its anchor, weekday,
  due times and status; only an empty zone (or the engine zone of an adopted row) is filled. The kickoff stays for `force` and ops; the app
  does not call it. A domain with ladders and no `seo_sites` row is adopted as a **rank-tracking-only** cycle (only `rank_tracker` runs)
  until "Track my site" makes it the normal cycle, same anchor.
- The Launch step's own audit and AI-visibility runs are **removed**: cycle 0 runs them, with the scheduled semantics, so nothing runs
  twice and nothing is forced to "full" by accident.

### 4.8 What changes in the other moving parts

- **Run guard** (`_run_guard.js`): `same_mode` compares mode **and domain** for cycle and on-demand runs. It still compares mode alone for
  the two daily batch jobs, so the guard's rule 1 keeps its meaning. A cycle refusal says "retried by the dispatcher", not "skipped".
- **AI Pulse:**
  - the cron becomes every day 06:30;
  - each site is skipped on its own cycle day (read from `seo_cycles`);
  - `pulseDay()` counts the six non-cycle days since the site's anchor, so the rotation still covers each question as before;
  - the report text "of the six pulse mornings" stays true.
- **Page Watch:** unchanged.
- **Catch-up:** keeps the AI Pulse, Page Watch and (if D2 keeps it on the 1st) the Audit Scheduler. The seven weekly workflows lose their
  Schedule Trigger and leave its list. `RG.caughtUp` stays for those three. Build section 98's assertions change accordingly, and a new
  assertion says **no weekly workflow keeps a Schedule Trigger**, so a forgotten Monday cron fails the build.
- **Deploy guard:** "refuse Mon 07:00-12:00" becomes "refuse while a dispatcher job is in flight or due in the next 15 minutes, unless
  `--force`". The guard reads `seo_cycle_jobs` through the n8n API from inside the VM; both copies change (`apply_env.py`,
  `deploy/gcp/deploy_engine.py`). A deploy that does kill a job only costs a retry (§4.6).
- **Month keys:** monthly decisions inside the jobs come from the dispatcher. The remaining UTC-month uses (check-in reminder, pitches per
  page per month, cost calibration) become the site's time-zone month through one helper in the kit.
- **Wording:** "every Monday" becomes "every Wednesday" (the site's day), or "every week" where no site is known. Weekly reports are dated
  by their cycle.

---

## 5. Design, change 2: keyword-first autopilot

### 5.1 The rules

1. **R-K1. The automatic pipeline writes only ladder pages, for ladders the client chose.**
   - A ladder carries `chosen_by`: `client_typed`, `client_picked` or `system`. It is stored on its `seo_ladder_settings` row and set by
     the app.
   - A ladder started through the public API counts as `client_typed`: the API caller is the client.
   - The cadence writes ladder pages only when `chosen_by` starts with `client_` and the ladder is Auto and active.
   - This is enforced in the engine (`Cadence_Plan.js`) **and** in the app's mirror (`server/src/services/cadence.ts`). The two change
     together and are held to each other by shared fixtures (§9).
2. **R-K2. No ladder, no writing.**
   - A site without a client-chosen ladder gets a cadence status of "Waiting for your first keyword", and the cycle's cadence job is
     skipped with that reason.
   - The weekly report, the Pipeline and Overview show it as the one **Needs you** item: "Choose the keyword you want to be found for".
3. **R-K3. Everything else depends on the autopilot level (§5.5).** At level 1 it is a suggestion, never written automatically. This
   covers AI answer pages, AI refreshes, decay refreshes, striking-distance queries and rising trends.
   - The setting `opportunities: auto` is removed. The engine reads any stored `auto` as suggest.
   - `ai_pages_month` no longer spends: it becomes how many AI suggestions a month are offered (decision D4).
   - Each suggestion shows why, the page it would change, and the credits.
   - Its buttons are **Write it** (one approved run) and, where it fits, **Add to my ladder** or **Start a ladder for this**.
   - A ladder page that matches an AI target still carries that target (`Cadence_Plan.js` ladder merge). That one is the client's own
     keyword and stays.
4. **R-K4. Suggestions pass the fit gate first.**
   - The same `FITR` read gate the rungs use (own brand, other brand, government, off topic against the site's services and ladders)
     runs on AI targets in `Growth_Plan.js` and on every suggestion in the cadence.
   - The Techand topic would then have been shown as a suggestion at most, never written.
   - The Keyword Check finally calls the deterministic fit gate it already inlines.
5. **R-K5. Approved writing is one click with a price.**
   - "Write it" opens the existing Write-now dialog with the credits, and now **carries the suggestion's AI target and source**
     (`WriteNowItem` gains `aiTarget`, `source`), so an approved AI answer page is written as one.
6. **R-K6. The system never starts a ladder silently.**
   - At levels 1 and 2 it only suggests the next keyword.
   - At level 3 it announces the keyword and starts after 2 days unless the client changes or skips it (§5.7).
   - "Choose keywords for me" (`autoStart.ts`) becomes exactly that announcement flow.
   - Research no longer writes its own top pick when "receive content" is ticked; the app removes that option.
7. **R-K7. One cycle, one budget.**
   - Pages a ladder start writes at once count against the current cycle's `pages_per_week`. A day-one ladder with 1 page plus 1 post a
     week therefore writes 1 page on day one, not 2.
   - A Manual ladder's start writes nothing until "Write it" (its text already promises this; the code does not do it yet).

### 5.2 Onboarding for non-technical owners

The steps today are company → website → verify → business → E-E-A-T profile → tracking & monitors → launch. Changes:

1. **Business step:** one new question in plain words, "What do you sell? List your main services or products". It is stored as the
   site's services (today only a case study supplies them), and it feeds both the fit gate and the research.
   - **On save, keyword research starts in the background** (`mode: discover`, receive content off). It needs about 2 minutes, while the
     owner does the profile and tracking steps. Its cost is decision D3.
2. **New step "Your first keyword"**, before Tracking:
   - **Question:** "What would a customer type into Google to find a business like yours?" A text box for up to 3 ideas, each checked
     with the Keyword Check (5 s), plus **"Suggest keywords for me"**, which is the default view while research is still running and shows
     a progress line.
   - **Cards (max 6):**
     - **Keyword.**
     - **Searches:** "About 320 people search this a month".
     - **Your chances**, mapped from `difficulty_for_you`: easy → "Good chance", reachable → "Takes a few months", hard → "Hard for your
       website now". Not realistic is not shown, or appears only as the alternative of a typed keyword.
     - **Why we suggest it:** "You offer CRM implementation; 3 competitors rank for it".
     - **The plan:** "About 5 pages over 3-6 months".
     - **Price:** "about 60 credits a page".
   - A typed keyword that is a poor fit or not realistic shows the check's own alternatives.
   - **Pick one keyword** (recommended), at most two (`max_active` 2).
   - **"I'll choose later"** is allowed: monitors run, nothing is written, and the Needs-you item stays.
   - **How writing works for this keyword:**
     - **"Write a page each week"** (Auto) is the default, because choosing the keyword *is* the approval for its ladder.
     - **"Ask me before each page"** (Manual) is the alternative.
     - The weekday is named: "Your pages are written every Wednesday".
3. **Tracking step:** the keywords field is renamed **"Other keywords to watch (we check your position, we don't write for them)"**, and
   the chosen ladder keyword is added to it. That removes the Techand confusion. "Blog posts a week" becomes **"Pages a week for your
   keyword"** (0-3), with the monthly credits.
4. **Launch step:**
   - It shows "Today: your first checks (about N credits) and the first page for "<keyword>" (about N credits). Then every Wednesday: …
     about N credits a month."
   - On launch, the app:
     1. sends `track`;
     2. calls the kickoff with the time zone and `trackingStartedAt`;
     3. if a keyword was chosen, starts the ladder (`pagesNow` 1, `chosen_by` set).
   - The two extra runs disappear (§4.7).

**Why research starts in the background:** it is asynchronous (2.1 min) and the app cannot wait on it. Started at the business step, it
is ready about when the owner reaches "Your first keyword". If it is not ready, the step says so and the owner can type a keyword (5 s
check) or choose later. When research lands, a Needs-you item and the Pipeline both offer the suggestions.

### 5.3 After onboarding

- **New keyword ladder** (`NewLadderPage.tsx`) keeps its two tabs. "Recommended" runs research automatically when there is none or it is
  older than 90 days, instead of only linking to the form.
- **Pipeline:**
  - "Opportunity posts" becomes **Suggestions**, with the new buttons;
  - "Needs you" leads with the keyword question while there is no ladder;
  - when a ladder is won or has no pages left: "Your ladder for X is done. Choose your next keyword", with fresh suggestions;
  - the calendar shows the site's own cycle days.
- **Recommendations page:** the striking-distance, trend and decay items keep their manual buttons (the client initiates them, so they
  are allowed). They gain "Add to my ladder" where a ladder's topic matches, and a new item proposes **keyword research** when there are
  no ladders.

### 5.4 Credits

- **Forecast** (`shared/src/autopilot.ts`):
  - the blog row counts pages only while a client-chosen Auto ladder has pages left;
  - the `ai_growth` row drops the AI pages, which are now suggestions;
  - the month split stays weeks × 4.33.
  - A site with no keyword therefore forecasts monitors only, which is honest.
- **Credit guard:** unchanged. It pauses the site through Site Admin, and the dispatcher honours the pause.
- **Shown at each choice:**
  - the Keyword Check price (about 2 credits; free from the 7-day cache);
  - research (decision D3);
  - the ladder plan (about 16 credits) and each page (about 50-70);
  - weekly pages per month;
  - "Write it" on a suggestion;
  - the launch summary.

  These are figures at today's 3× markup and $0.05 a credit; they come from `shared/src/cost.ts` at run time, never typed in.

### 5.5 Three autopilot levels (owner decision D13, 2026-10-19)

Onboarding asks **"How much should we do on our own?"**. The answer is stored per website in the `_site` row of `seo_ladder_settings` as
`autopilot_level`, and it can be changed any time in Website settings.

| Level | Written automatically | Waits for the client's OK |
|---|---|---|
| **1. Only my keywords** | ladder pages of ladders the client chose | everything else, in the weekly "Coming up" plan |
| **2. My keywords + keep my pages healthy** (default) | ladder pages; plus refreshes of the client's **existing** pages that lose traffic (`decay`), strengthening existing pages at positions 4-20 (`striking` with a page), and AI refreshes of existing pages (`ai_refresh`). Each one only when its keyword passes the topic gate against the site's ladders and services ("in topic") | new topics (`trend`, `ai_answer`, `striking` without a page) and new keywords |
| **3. Full autopilot** | everything of level 2, plus new topics (fit-gated), AI answer pages (`ai_pages_month`), and new ladders on keywords the system picked from research, **announced 2 days before they start** | nothing, but every item can be skipped in "Coming up", and every new keyword can be changed before it starts |

Rules for every level:
- **Levels 1 and 2 write nothing until the client has chosen at least one ladder** (any status except archived: a won ladder still
  tells us their topics). Level 3 needs no ladder: the system announces one (§5.7) and may keep existing pages healthy meanwhile.
  **An approval is the client's choice** (2026-10-19, E4): an item the client approved in "Coming up" for this cycle (`seo_skips`
  `approve`) is written even while the site waits for its first keyword. Skips still beat approvals, `pages_per_week` still bounds it, and
  the pile-up guard still holds it; what was approved and not written is listed with the reason (`approved_not_written`).
- **The fit gate always runs** (own brand, other brands, government, off topic, too broad). At level 3 it is the only filter, so it runs
  on every source.
- **`pages_per_week` bounds everything automatic.** 0 means nothing is written at any level (today a site with 0 still got AI pages). At
  level 3 the AI pages come on top, by `ai_pages_month`, as they do today.
- **Auto-pause on rejections.** Every written page gets a "Not what I wanted" button. If 2 of the last 5 automatic pages that were not
  ladder pages are rejected, the level drops to 1, and the client is told why and how to raise it again.
- **Upgrade nudge, never an automatic switch.** After 5 approved or published pages at level 1, a Needs-you card offers level 2.
- **Spending:** the forecast for the chosen level is shown before it is confirmed; the company's existing autopilot limit (credit
  guard, `autopilot_limit`) still caps the month.
- **Level 3 and the Techand case.** At level 3 the Techand D365 refresh could still have been written, because D365 is on the client's
  own site and passes the topic gate. That is acceptable only because the client chose full autopilot. The fault on 2026-10-19 was
  choosing for them without asking.

### 5.6 The next keyword after a win

- A client can start several ladders. `max_active` (2) run at once and the rest wait as **queued** (this exists in `Cadence_Plan.js`).
- A ladder that is **won** (top 3 in 4 checks in a row) or has no pages left makes room. The highest-priority queued ladder becomes
  active at the next cycle (exists).
- **New: a fresh check on activation.** A queued ladder planned more than 60 days ago gets a Keyword Check (5 s) when it becomes active.
  If the verdict fell (not realistic now, or a fit of 0), it pauses with a Needs-you item instead of writing on stale results.
- **New: when the queue is empty**, the app proposes the next keyword from research (research is re-run when older than 90 days):
  - levels 1 and 2: a suggestion with **Start this ladder** / **Show me others** / **Not now**;
  - level 3: an announcement that starts after 2 days (§5.7).

### 5.7 "Tell first, then go" and the weekly "Coming up" plan

**New keywords at level 3** (an app table `keyword_proposals`):
- The card shows the keyword, monthly searches, the plain difficulty, why we chose it, the plan (pages, months) and the credits per
  page.
- Buttons: **Approve now** (starts at once, `chosen_by: client_picked`), **Pick a different one** (the other suggestions, or a typed
  keyword checked in 5 s), **Skip** (never proposed again, and the next one is announced).
- With no answer, it starts after **2 days** (`start_at`, decision D14) as `chosen_by: system_announced`.
- **On day one in onboarding** the step says "We'll start with X", with Change. There is no waiting time, because the client is on the
  screen.
- An e-mail goes out for each announcement (decision D15).

**"Coming up", two days before every cycle, at every level:**
- The dispatcher runs the cadence in **preview mode** 48 h before each site's cycle (job `preview`, not in cycle 0). It plans exactly what
  the cycle would write, writes nothing, and sends a `cycle_preview` callback.
- The app shows it on the Pipeline and Overview ("Coming up on Wednesday") and e-mails it once a week.
- Each item says why it was chosen, gives the credits, and is marked automatic (with **Skip**) or needs-OK (with **Approve** /
  **Skip**).
- Skips and approvals are written by the app to the Data Table `seo_skips`. The real cycle's cadence honours them: a skipped item is not
  written; an approved needs-OK item is written as part of the cycle, within `pages_per_week`.

---

## 6. Files and workflows touched

### Engine (`n8n/seo-agent/`)

| File | Change |
|---|---|
| `v5/code/_cycle.js` (new) | the pure cycle kit: anchor, due times (DST-safe, reusing `CU.zonedToUtc` / `parts`), cycle key, monthly date, the job order and dependency rule, the verdict per job, the most-recent-only catch-up, start capacity, the deploy-window question |
| `build_cycle.py` (new) | the Cycle Dispatcher workflow: triggers, loads, plan, record-then-start, read-back, result rows, report; harness code files; called from `build_v4.py` |
| `v5/code/Kickoff_Plan.js`, `Kickoff_Validate.js`, `build_monitors.py` (Kickoff) | the kickoff writes the `seo_cycles` row (anchor, tz, skip_jobs) instead of starting jobs |
| `v5/code/_monitor_sites.js` | `trigger: 'cycle'`: one site, `on_demand` false, settings and pause honoured, `monthly` and `cycle_key` passed through |
| `AI_Plan.js`, `BL_Plan.js`, `Growth_Plan.js`, `LB_Plan.js`, `Audit_Sched_Plan.js` | monthly extras from `monthly` on cycle runs; UTC month keys moved to the kit helper |
| `Tracker_Plan.js` | a Manual Run input for one site (new); cycle semantics |
| `Site_Plan.js`, `Site_Row_Track.js` | cycle semantics; a re-save no longer un-pauses a site paused by its owner or the credit guard |
| `Cadence_Plan.js` | keyword-first (R-K1 to R-K4, R-K7): ladder-only writing, `chosen_by`, suggestions-only with the fit gate, pages counted per cycle, "waiting for your first keyword" |
| `Growth_Plan.js` | fit gate on AI target keywords (R-K4) |
| `build_api.py` (Assess) | call `fitGate` (R-K4) |
| `Ladder_Plan.js` / `Spawn_Page_Runs.js` | a Manual ladder writes nothing at start; the cycle budget (R-K7) |
| `Spawn_Followups.js` | no automatic page on research's own pick when the request came from the app (R-K6) |
| `_run_guard.js`, `ladder_common.py` (`LEDGER_RESUME_JS`) | per-domain twin rule; ledger key `cycle:<key>:<job>`; a refusal wording that the dispatcher retries |
| `Monitor_Ledger_Row.js` | the `cycle:` key and the cycle's request id |
| `Pulse_Plan.js`, `_ai_panel.js` (`pulseDay`), `build_monitors.py:415` | daily cron; skip the site's cycle day; rotation from the anchor |
| `build_monitors.py`, `build_site_tracker.py`, `build_ladder_extras.py` | remove the seven weekly Schedule Triggers; sticky notes |
| `build_catchup.py` (`EXPECTED`), `build_v4.py` section 98 | three schedules left; the new "no weekly cron" assertion |
| `apply_env.py`, `deploy/gcp/deploy_engine.py`, `build_v4.py:9967-9981` | the new deploy guard and its self-test |
| `ladder_common.py` | the new tables' columns; `seo_ladder_settings.chosen_by`; `seo_sites.services` already exists as `services_json` |
| wording | `BL_Report.js:111`, `Pulse_Metrics.js:95`, `Publish_Check.js:137`, `Parse_Checkin.js:37`, `Build_Track_Response.js:5`, `Growth_Report.js:30`, `Cadence_Note.js`, `Cadence_Status.js`, `build_v4.py:1265-1377`; reports dated by cycle |
| `harness/scenarios_v5.js` (+ `scenarios_g6.js`) | new CY and KF scenarios; S19, S20, S28, S48, S74, S84, S96, S126-S129, SC1, S146, SK1, S205 and the cadence scenarios updated |

### App (`app/`)

| File | Change |
|---|---|
| `shared/src/constants.ts` | `AUTOMATIONS` weekly entries become `{kind: 'cycle', job order}`; `nextScheduledRun(s, tz, from, site?)` takes the site's cycle (anchor, tz) and stays pure; `MODES.track.delivers` and `AI_PAGES_DEFAULT` wording |
| `shared/src/pipeline-notices.ts` | per-site next run; the "Monday" text; suggestion notices |
| `shared/src/autopilot.ts` | the forecast rules of §5.4 |
| `shared/src/schemas.ts`, `payload.ts` | `timezone` and `services` on the site; `chosenBy` on ladder starts; kickoff body. Keep the key order (Normalize Input matches fields fuzzily) and run `npm run export:payloads` + harness S23 |
| `server/src/db/schema.ts` + migration | `sites.timezone`, `sites.services`, `sites.cycle_weekday` (mirror for the UI); `ladder_settings`-side `chosen_by` if mirrored |
| `server/src/services/runs.ts` | after `track`: call the kickoff; ladder starts carry `chosen_by` |
| `server/src/services/pipeline.ts`, `delivery.ts` | the calendar, "This week", missed runs and delivery rate from the site's cycle (read `seo_cycles` / `seo_cycle_jobs` through the n8n Data Table API, which the dashboards already use) |
| `server/src/services/cadence.ts` (+ `test/cadence.test.ts`) | the mirror of R-K1 to R-K4, R-K7 |
| `server/src/services/autoStart.ts`, `config.ts`, `index.ts` | removed or turned into a notice (D5) |
| `server/src/services/recommendations.ts` | "Start keyword research" when there are no ladders; "Add to my ladder" |
| `server/src/services/ladderSettings.ts`, `ladders.ts` (`SITE_DEFAULTS`) | `opportunities` removed / suggest; `chosen_by` written to `_site` and per-ladder rows |
| `web/src/pages/onboarding/*` | the services question, background research, the new "Your first keyword" step (`wizard.ts` step list), Tracking relabelled, Launch summary and calls |
| `web/src/pages/site/NewLadderPage.tsx`, `_components/pipeline/*`, `WriteNowDialog.tsx` | research on demand, Suggestions, Needs you, the site's calendar, `aiTarget` on Write-now |
| about 60 strings (list in the app inventory, §2.2 item 10) | "Monday" becomes the site's day or "each week" |
| `web/src/marketing/*` | `WeekSchedule.tsx` becomes "your week starts the day you sign up"; `features.ts`, `pricing.ts`, `solutions.ts`, `HowItWorksPage.tsx`, `HomePage.tsx`, `AutoManual.tsx`, `screens.tsx`, the diagrams; a changelog entry; customer language only, no em dashes or curly quotes |
| new test `shared` copy lint | fails on "Monday" in customer copy except the mailbox sending window |

---

## 7. Data changes

New Data Tables (engine). Columns go in `ladder_common.py`, and `sync_tables.py` creates them in production.

```
seo_cycles        one row per site (upsert by site_id)
  site_id, domain, anchor_at (ISO UTC), tz (IANA), cycle_weekday (0-6, in tz), local_time ('06:00'),
  monthly_day (1-28), next_due_at (ISO UTC), current_key, status (active | paused | off),
  skip_jobs (cycle 0 only), last_cycle_at, last_monthly_key, adopted (bool), updated_at

seo_cycle_jobs    one row per site × cycle × job (upsert by key = cyc:<site>:<date>:<job>)
  key, site_id, cycle_key, job, workflow_id, status (starting | running | done | skipped | refused | failed | gave_up),
  attempts, run_id, ledger_key, monthly (bool), reason, started_at, finished_at, updated_at
```

- `seo_cycle_jobs` keeps 120 days; older rows are deleted by the dispatcher.
- `seo_ladder_settings` gains `chosen_by`.
- App Postgres gains `sites.timezone`, `sites.services`, `sites.cycle_weekday` (one migration).
- **No migration of existing websites:** the reset gives every site a fresh anchor when it sets up again.
- The engine still adopts a tracked site without a cycle row (§4.7), which also covers the owner's own test sites.

---

## 8. How credits, the catch-up, reports and the app calendar change

| Area | Today | After |
|---|---|---|
| Credits | autopilot = `schedule:<mode>` ledger rows | the same autopilot bucket, through `cycle:` rows; forecast per §5.4; guard unchanged |
| Catch-up | ten schedules, weekly slots | three schedules (pulse, page watch, audit if kept on the 1st); weekly catch-up is the dispatcher's own due rule |
| Run guard | twin = same job anywhere | twin = same job on the same site (cycle and on-demand runs) |
| Reports | "every Monday", UTC month | dated by cycle ("Week of Wed 15 Oct"); monthly = the site's monthly cycle |
| App calendar | `nextScheduledRun` of a global Monday slot | the site's own days from `seo_cycles` (exact next due) and `seo_cycle_jobs` (last runs, missed, gave up) |
| Delivery rate (platform admin) | missed global slots | missed site cycles (`gave_up`, overdue > 24 h) |
| Company digests (`report-delivery.ts`) | a company weekday, default Monday | unchanged; a company with several sites keeps one digest day (decision D9) |

---

## 9. Test plan

**Harness** (in a throwaway container, never the laptop's n8n; must end with `0 failed`):
- **CY1-CY12, the cycle kit:**
  - anchor and due times in America/New_York, Europe/London (both DST changes) and Asia/Dubai (no DST);
  - cycle 0 at the anchor, no second cycle on day one;
  - 7-day spacing across DST;
  - more than 7 days overdue → the most recent cycle runs once;
  - the 12-hour gap rule; pause and resume; changing the weekday;
  - monthly date clamped to 28, month boundaries, exactly 12 monthly cycles a year;
  - job order and dependencies;
  - a capacity refusal retried without spending an attempt; a crashed run retried, then gave up after 3;
  - two racing sweeps start one job;
  - the start cap; adoption of a site with no row;
  - the deploy-window answer.
- **CY13-CY20, the wired dispatcher:** generated nodes run on fixtures (record-then-start, read-back, ledger outcome, report), plus build
  assertions: no weekly Schedule Trigger left, catch-up list of three, every weekly workflow has a Manual entry that reads `trigger`.
- **Cycle semantics** in each plan node, one scenario each: one site, `on_demand` false, off switches and pause honoured, `monthly`
  honoured, ledger key `cycle:`; the Rank Tracker's new one-site input.
- **Run guard:** two sites' AI Visibility both allowed; the same site twice refused; daily batch rule unchanged.
- **AI Pulse:** a Thursday site is skipped on Thursday and sampled on Monday; rotation coverage over 4 weeks equals today's.
- **KF1-KF12, keyword-first:**
  - no ladder → nothing written, status "waiting for your first keyword", kickoff and cycle skip the cadence;
  - a `system` ladder is not written;
  - a stored `opportunities: auto` writes nothing;
  - AI targets are suggestions only and fit-gated (**the Techand replay**: a CRM site, a D365 refresh target, no ladder → no run, one
    suggestion or a refusal with its reason);
  - the day-one ladder page counts against the cycle;
  - a Manual ladder writes nothing at start;
  - research with receive-content from the app writes nothing;
  - the Keyword Check refuses a competitor brand deterministically.
- **Updated:** S19, S20, S28, S48, S74, S84, S96, S126-S129, SC1, S146, SK1, S205 and the cadence scenarios.

**App** (vitest single-thread in `node:22-bookworm-slim`, typecheck of all three workspaces):
- `nextScheduledRun` per site and across DST;
- `cadence.ts` against **the same fixtures as the harness's KF scenarios**: one JSON file both suites read, so the mirror cannot drift;
- the forecast;
- notices;
- pipeline calendar and delivery from cycle rows;
- onboarding (`web/test/onboardingTracking.test.tsx` extended: services, keyword step, choose later, launch bodies, kickoff call, no extra
  audit or AI runs);
- `autoStart` removal;
- the "Monday" copy lint.

Tests that change on purpose:
- `server/test/cadence.test.ts` 169, 212-236, 297-322;
- `ai-visibility.test.ts` 59-65, 88-91;
- `delivery.test.ts`;
- `ladders.test.ts` Monday texts.

**Integration on the dev stack:** `app/scripts/smoke.py`, plus a stubbed-engine run of onboarding → kickoff (`scripts/stub_n8n.py`).

**Browser pass** (Playwright image, 1440 and 375, light and dark):
- onboarding with suggestions, a typed keyword with a poor fit, "choose later";
- Pipeline with Needs you, Suggestions and the site's calendar;
- marketing pages.

**End-to-end rehearsal of a new client** (paid, about $4, decision D10):
- on a **fresh, isolated n8n** (new volume, the new workflows only, no old schedules) and a copy of the dev database;
- sign-up → website → verify → business (research starts) → keyword step (suggestions arrive, one picked) → launch;
- cycle 0 runs every job in order;
- the ladder writes its first page;
- the dispatcher's time-travel dry run shows cycle 1 due seven days later at 06:00 local.

**In production, before inviting clients:**
- the dispatcher in `plan_only` for one sweep (its report lists what it would start);
- then the owner's own test site through one real cycle (monitors only, no keyword chosen: also proves R-K2);
- then a keyword and one written page.

---

## 10. Deploy plan (production users)

The reset makes data migration unnecessary, but the deploy touches every weekly workflow, the app's onboarding and its database, so the
order matters.

0. **Before:**
   - all harness, app and browser checks green;
   - the rehearsal done;
   - this branch committed and pushed path-scoped, with the diff scanned for secrets (public repo);
   - the other Claude session told which files are changing (it edits copy in the same repo).
1. **Announce and freeze:**
   - the owner tells current clients about the reset and the re-setup;
   - pause every site (Site Admin `pause`) so no old Monday run starts during the window;
   - choose a day that is **not Monday 07:00-12:00 New York**: the old guard still applies to the old workflows being replaced.
2. **Back up** on the VM (`sudo bash /mnt/data/repo/deploy/gcp/backup.sh`):
   - n8n database and Data Tables;
   - app Postgres;
   - Secret Manager versions noted.
3. **Reset (the owner's step):**
   - app database;
   - the engine's `seo_*` Data Tables and n8n executions (decision D8: which ones exactly).
4. **Engine:**
   - `deploy/gcp/deploy_engine.py --apply` at the approved commit (all workflows, including the new dispatcher, which is imported
     **inactive**);
   - `sync_tables.py` creates `seo_cycles` / `seo_cycle_jobs` and `chosen_by`;
   - check: no weekly workflow has a schedule; the catch-up lists three; the Site Kickoff answers 400 on a bad body.
5. **Dispatcher on, in `plan_only`:** activate it and read one sweep's report (nothing to start, since there are no sites).
6. **App API:** on the VM, check out the exact commit and run `up -d --build app` (migration runs at start). Check `/api` health and one
   sign-up. **Then web:** move `main` to that commit so Vercel deploys it.
7. **Live checks:** the owner's test site through onboarding (§9 production steps); watch `seo_cycle_jobs` fill in order; credits debited
   as autopilot.
8. **Open the door:** switch the dispatcher from `plan_only` to start, and invite clients.

**Rollback:**
- **Engine:** `deploy_engine.py --apply` at the previous commit. It restores the Monday crons, and the new tables are ignored by the old
  code.
- **App:** check out the previous commit on the VM and `up -d --build app`; move `main` back for Vercel. The new columns stay (additive
  migration) and are harmless.
- Because the reset happens first, rolling back never mixes old data with new code.

---

## 11. Decisions for the owner (my recommendation first)

**Taken on 2026-10-19:**
- D1-D7, D9, D11 and D12 as recommended, adjusted by D13. D4 and D12 now depend on the level: AI answer pages run automatically at level
  3 only, and decay refreshes of the client's own pages in topic run automatically from level 2. D5 becomes the level-3 announcement
  flow.
- **D13:** three autopilot levels, default level 2 (§5.5).
- **D14:** a 2-day waiting time before an announced keyword starts.
- **D15:** one weekly "Coming up" e-mail, plus one e-mail per announced keyword.
- **D8 (reset scope) and D10 (the paid rehearsal) are asked again at deploy time.**

| # | Question | Recommendation | Why |
|---|---|---|---|
| D1 | Time of day of each cycle | **06:00 in the website's time zone** (owner's browser zone, captured in onboarding) | Reports land in the client's morning; outside the DST hours. Alternatives: the time of setup, or 07:00 New York for everyone |
| D2 | The monthly audit | **Day one, then on the site's monthly date, inside the cycle** | A new client sees technical issues at once. Keeping the 1st for everyone works too, but a client who starts on the 2nd waits a month |
| D3 | Who pays for the background research in onboarding (about $0.44, about 26 credits) | **Free once per website at setup** | It is the step that makes keyword-first work; charging before the client has seen value is friction. Alternative: charge credits and show it |
| D4 | AI answer pages | **Suggestions only; `ai_pages_month` = how many AI suggestions a month (default 2)** | Same rule as every other non-ladder topic. Alternative: let a client opt in to "write AI answer pages for my ladder's topic" |
| D5 | "Choose keywords for me" | **Remove; replace with "suggest my next keyword when a ladder is done"** | A system-started ladder is exactly what change 2 forbids |
| D6 | How many keywords at the start | **One recommended, two allowed** | Small first batch (Koala 3 articles, SEOwind 5 pilot); `max_active` is already 2 |
| D7 | Can a client change their weekday | **Yes, in Website settings, next cycle at least 3 days after the last** | Cheap with the table; matches Semrush / Ahrefs |
| D8 | Reset scope | **App database + engine `seo_*` Data Tables + n8n executions; keep workflows, credentials, `seo_cache` cost calibration rows** | A clean start without losing calibration. Your call on what else to keep |
| D9 | Company report digests (Monday by default) | **Leave as the company's own choice** | A company with several sites needs one digest day |
| D10 | The paid rehearsal (about $4) and the production test site (about $2 more with one page) | **Yes** | The only way to see the whole new client path for real |
| D11 | Turn on n8n's durable scheduler (`N8N_SCHEDULER_ENABLED=true`) or upgrade to 2.45+ | **Later, as its own change, after this ships** | Not needed for this plan; it also changes trigger behaviour on restart (a reported startup burst), so test it alone |
| D12 | Refreshes of the client's own pages that lose traffic | **Suggestion only, like the rest** (an opt-in "always refresh my pages losing traffic" can come later) | They are the client's pages, but the Techand page was exactly a refresh nobody asked for |

---

## 12. Phases and size

| Phase | Content | Sessions |
|---|---|---|
| P1 | `_cycle.js` + its harness (CY1-CY12); `build_cycle.py` dispatcher; kickoff rewrite | 1.5 |
| P2 | cycle semantics in the 7 plan nodes, Rank Tracker one-site input, run guard per domain, pulse per site, catch-up / section 98, deploy guard, wording, existing scenarios updated | 1.5 |
| P3 | keyword-first in the engine (Cadence, Growth fit gate, Assess fit gate, Manual ladder start, research follow-up, `chosen_by`) + KF scenarios + shared fixtures | 1 |
| P4 | app shared + server: schedule per site, forecast, cadence mirror, kickoff call, pipeline / delivery from cycle rows, recommendations, autoStart, migration | 1.5 |
| P5 | app web: onboarding (services, background research, keyword step, launch), Pipeline Suggestions / Needs you / calendar, Write-now `aiTarget`, every "Monday" string, marketing + changelog, copy lint | 1.5 |
| P6 | checks, browser pass, paid rehearsal, then the production deploy of §10 | 1 |

- Phases follow the "small agents, test once" rule: build and harness once per batch.
- One functionality per commit, pushed before the next.
- P1-P3 and P4-P5 can run as two parallel tracks in worktrees, rebuilt in the main worktree after each merge (the B-F5 rule).

## 13. Risks and how the plan answers them

| Risk | Answer |
|---|---|
| The dispatcher itself stops (n8n down) | Its state is durable; the next sweep after n8n is back starts what is due (most recent cycle once). Instance Started also sweeps. The platform admin page shows overdue cycles |
| A sweep starts a job twice | Record-then-start with read-back of the claim; the ledger key `cycle:<key>:<job>` is unique per job and cycle; the run guard refuses a twin on the same site |
| Many sign-ups on one day | Capped starts (2 in flight), ordered by how overdue; the cycle of a late site simply runs later that day |
| The engine and app mirrors of the cadence drift | One shared fixture file both suites run |
| A forgotten Monday cron or string | Build assertion (no weekly Schedule Trigger) and the app copy lint |
| Clients without a keyword get nothing written and churn | The Needs-you item everywhere, suggestions ready at onboarding, and the weekly report's first line asks for the keyword |
| A per-site cycle multiplies small fixed costs (tables loaded per run) | Loads are Data Table reads, free; external calls are per site already. Measured in the rehearsal |

---

## 14. Contracts between the engine and the app (fixed before the agents start)

The code half of this contract is committed in `app/shared/src/cycles.ts` (types, job order, levels, keys) and in `ladder_common.py`
(`CYCLES_*`, `CYCLE_JOBS_*`, `SKIPS_*`, `seo_ladder_settings.chosen_by` / `autopilot_level`; `seo_sites.declared_services` is added by E3 together with `SM.toRow`, because
the weekly row must carry exactly the table's columns, harness S35 / S46). The engine
mirrors the constants in `v5/code/_cycle.js` and `Cadence_Plan.js`.

### 14.1 Data Tables

| Table | Written by | Read by | Notes |
|---|---|---|---|
| `seo_cycles` | "Track my site", Site Kickoff (`force` / ops), Cycle Dispatcher (one builder, `CYC.cycleRow` / `newCycleRow`) | dispatcher, AI Pulse, the app (calendar), the deploy guard | one row per site; `next_preview_at` = `next_due_at` − 48 h |
| `seo_cycle_jobs` | dispatcher (record-then-start, then outcome) | dispatcher, the app (last runs, missed, gave up), the deploy guard | key `<cycle_key>:<job>`; 120 days kept |
| `seo_skips` | **the app** (n8n public API, like `seo_ladder_settings`) | Content Cadence (real and preview runs) | key `<site_id>:<cycle_key or always>:<item_key>` |
| `seo_ladder_settings` | the app (as today) and the ladder run | Content Cadence | `chosen_by` on ladder rows, `autopilot_level` on the `_site` row |
| `seo_sites.declared_services` | Track my site | site model (`SM`), fit gate, research | merged into services, never overwritten by the Site Tracker |

### 14.2 A cycle run (dispatcher → each job's Manual Run)

```
{ trigger: 'cycle', domain, site_id, cycle_key: 'cyc:<site_id>:<YYYY-MM-DD>', job, monthly: true|false,
  scheduled_for: '<ISO UTC due time>', request_id: 'cyc_<site_id without site_>_<YYYYMMDD>_<job>',
  light: !monthly            (backlinks only)
  preview: true              (content_cadence, the 'preview' job only) }
```
- Scheduled semantics for one site: `on_demand` false, switched-off jobs and pauses honoured, monthly extras only when `monthly`.
- Ledger row key `cycle:<cycle_key>:<job>`, mode as today. The callback of a cycle run carries `trigger: 'cycle'`, `cycle_key` and
  `cycle_date` (the local date).

### 14.3 Site Kickoff (rewritten)

`POST /webhook/seo-site-kickoff` (X-API-Key)
`{ domain | site_id, anchor_at?, tz?, skip_jobs?: [job], jobs?: [job], force?, dry_run? }` → `202 { ok, status: 'accepted',
stage: 'site_kickoff_started', site_id, cycle_key, next_due_at }`.
- It upserts the `seo_cycles` row (`anchor_at` defaults to now, `tz` to the engine zone; an unknown zone gets 400), with cycle 0 due now.
- `skip_jobs` holds what the app already ran. The refusals are as today.

### 14.4 Callback stage `cycle_preview` (the preview job, 48 h before a cycle)

`CyclePreview` in `cycles.ts`: `site_id, domain, cycle_key, scheduled_for, level, pages_per_week, waiting_for_keyword, paused_reason,
items[], suggestions[]`.
- Each item: `item_key, keyword, source, page_type, existing_page_url, ladder_id, rung, why, auto, est_usd, ai_target`.
- Status `progress`; nothing is written and nothing is charged beyond the run's own small cost.
- The `content_cadence` callback of the real cycle gains the same `suggestions[]` (with `ai_target`), plus `level`,
  `waiting_for_keyword` and `cycle_key`.

### 14.5 Runs from the app

- `mode: 'ladder'` gains `chosen_by`. A ladder started in Manual mode writes nothing at start.
- `mode: 'track'` gains `timezone` and `services`.
- `mode: 'discover'` from the app never sets "receive content".
- Keep the payload key order (Normalize Input's fuzzy matching), then `npm run export:payloads` and harness S23.

### 14.6 App API (A1 builds it, A2 uses it)

| Endpoint | Purpose |
|---|---|
| `GET /api/orgs/:orgId/sites/:siteId/cycle` | `{ timezone, weekday, localTime, anchorAt, nextDueAt, nextPreviewAt, monthlyDay, current: { cycleKey, jobs: CycleJobRow[] }, recent: [...] }` |
| `PATCH /api/orgs/:orgId/sites/:siteId/cycle` | `{ weekday }` (next cycle at least 3 days after the last one started) |
| `GET /api/orgs/:orgId/sites/:siteId/coming-up` | the latest `cycle_preview` plus the client's decisions on it |
| `POST /api/orgs/:orgId/sites/:siteId/coming-up/decisions` | `{ itemKey, decision: 'skip' \| 'approve', scope: 'cycle' \| 'always' }` → `seo_skips` |
| `PATCH /api/orgs/:orgId/sites/:siteId/automation` | gains `autopilotLevel: 1 \| 2 \| 3` → the `_site` row |
| `GET /api/orgs/:orgId/sites/:siteId/keyword-proposals` | the pending and recent proposals |
| `POST …/keyword-proposals/:id/approve`, `/skip`, `/swap { keyword }` | the level-3 announcement, and suggestions at levels 1-2 |
| `POST /api/orgs/:orgId/sites/:siteId/research/start` | background research during onboarding (free once per website at setup, D3) |
| `GET …/keywords/recommended` | gains `status: 'none' \| 'running' \| 'ready'` and `startedAt`, for the onboarding poll |
| `POST /api/orgs/:orgId/reports/:reportId/feedback` | `{ verdict: 'reject', reason? }` ("Not what I wanted"; drives the auto-pause) |
| `POST /api/orgs/:orgId/runs` | `ladder` gains `chosenBy`; `track` gains `timezone`, `services`; after `track` is accepted the server calls the kickoff |

App Postgres (A1's migration):
- `sites`: `timezone`, `services`, `cycle_weekday`, `autopilot_level`.
- New tables:
  - `keyword_proposals` (`id, site_id, keyword, details jsonb, status pending|approved|swapped|skipped|started|expired, start_at,
    created_at, decided_at, decided_by`);
  - `cycle_previews` (`site_id, cycle_key, scheduled_for, body jsonb, received_at`);
  - `content_feedback` (`site_id, report_id, keyword, verdict, reason, by, created_at`).

---

## 15. The implementation team

Rules for every agent:
- Work in its own git worktree from the contract commit. Read `CLAUDE.md`, this plan and its own brief.
- Change only the files its brief owns. Shared files are listed with the part each agent may touch.
- **Engine agents:**
  - build with `python3 build_v4.py --no-env` (a worktree has no `n8n/.env`) and check the exit code;
  - run the harness in a throwaway container (`n8nio/n8n:2.41.4`, the command in the handoff §4); it must end with `0 failed`;
  - **never start the laptop's n8n**, never deploy, never call a paid API;
  - commit sources and scenarios only. `workflows/*.json` and `harness/code_v4/` are rebuilt and committed by the orchestrator in the
    main worktree after each merge (B-F5).
- **App agents:**
  - run the typecheck of all three workspaces and the vitest suites single-threaded in `node:22-bookworm-slim`;
  - follow the copy rules: no em dashes, curly quotes or "…", customer language, Alaventra tokens only.
- Commit in small, path-scoped commits with the attribution line. **No push:** the orchestrator merges, rebuilds, tests and pushes.
- End with a report: what was built, file list, test counts, anything left or found elsewhere ("NEEDS-ELSEWHERE").

| Agent | Wave | Owns | Shared, only this part |
|---|---|---|---|
| **E1 Cycle core** | 1 | `v5/code/_cycle.js` (new), `build_cycle.py` (new), `v5/code/Cycle_*.js` (new), `Kickoff_Plan.js`, `Kickoff_Validate.js`, the deploy guard in `apply_env.py` + `deploy/gcp/deploy_engine.py`, harness CY scenarios (new file `harness/scenarios_cycle.js`, required from `scenarios_v5.js`) | `build_monitors.py`: the Kickoff block only; `build_v4.py`: calling `build_cycle.py` + a new section for the dispatcher wiring + the deploy-guard self-test |
| **E2 Cycle semantics** | 1 | `_monitor_sites.js`, `AI_Plan.js`, `BL_Plan.js`, `LB_Plan.js`, `Audit_Sched_Plan.js`, `Audit_Candidates.js`, `Site_Plan.js`, `Tracker_Plan.js`, `_site_time.js` (new: the website's time-zone month and day keys), `_catchup.js` (`lateRun` for cycle runs only), the Callback Ledger nodes, `Monitor_Ledger_Row.js`, `_run_guard.js`, `Pulse_Plan.js`, `_ai_panel.js` (`pulseDay`), `build_catchup.py`, the engine wording list of §2.2 item 10, existing scenarios that encode Monday | `Growth_Plan.js`: the monthly / entity / UTC-month parts only; `build_monitors.py`, `build_site_tracker.py`, `build_ladder_extras.py`: the Schedule Trigger nodes, the Pulse cron, Manual Run inputs, sticky notes; `ladder_common.py`: `LEDGER_RESUME_JS` and `_schedule_of`; `build_v4.py`: section 98 + the "no weekly cron" assertion |
| **E3 Keyword-first engine** | 1 | `Cadence_Plan.js`, `Cadence_Note.js`, `Cadence_Status.js`, `Ladder_Plan.js` (Manual start, `chosen_by`), `Spawn_Page_Runs.js`, `Ladder_Settings_Rows.js`, `Spawn_Followups.js`, `Assess_*` (fit gate), `_site_model.js` (declared services), `Site_Row_Track.js` (declared services, and a re-save no longer un-pauses a paused site), `ladder_common.py` `SITES_COLS` (`declared_services`), harness KF scenarios (new file `harness/scenarios_keyword_first.js`), the shared fixture `harness/fixtures/cadence_levels.json` | `Growth_Plan.js`: the fit gate on targets only; `build_site_tracker.py`: the cadence's new loads (Load Skips) and the preview callback path; `build_api.py`: Assess; `build_v4.py`: Track's `declared_services` + Normalize Input fields `timezone` / `services` / `chosen_by` |
| **A1 App server + shared** | 2 | `app/server/**` (routes, services, migration, tests), `app/shared/src/{constants,autopilot,pipeline-notices,payload,schemas,keywords,ladders}.ts` + their tests, `app/server/src/services/cadence.ts` (mirror; tests read the shared fixture) | `app/shared/src/cycles.ts`: additions only |
| **A2 App web + marketing** | 2 | `app/web/src/**` (onboarding, Pipeline, settings, WriteNow, content feedback, every "Monday" string), `app/web/src/marketing/**` + changelog, `app/web/test/**`, the copy lint (`app/shared/src/appCopy.test.ts` extension) | none; uses A1's API by the §14.6 contract |

- **Split jobs:** a job counts as done when the ledger row with key `cycle:<cycle_key>:<job>` is settled. A job that runs in several
  executions (AI Visibility's continuation runs) settles that key only in its final execution; earlier ones use
  `cycle:<cycle_key>:<job>:part<n>`.
- **Merge order:** E3, E1, E2 (wave 1), then A1, A2 (wave 2). Each merge is rebuilt in the main worktree with `.env`, run through the
  full harness, the app checks run, then committed and pushed.
- **Wave 3 (orchestrator):** the integrated build, the full harness and app suites, the browser pass, this plan's status. The paid
  rehearsal and the production deploy wait for the owner's yes (D8, D10).
