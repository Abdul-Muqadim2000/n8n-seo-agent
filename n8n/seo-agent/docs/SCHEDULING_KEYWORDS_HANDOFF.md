# Handoff: start on the day of setup, a 7-day cycle per website, and keyword-first autopilot

Written 2026-10-19 at the end of the session that built credits. Read this first in the next session. The owner wants **full research
(our own setup + the market) and a complete plan before any building**. The plan is the first deliverable; nothing is built until the
owner approves it.

## 1. What the owner asked for (in their words, cleaned up)

1. **Work starts right away when a client sets up**, not on the next Monday. After that, the weekly work repeats **every 7 days from the
   client's own start day** — not a hard-coded Monday for everyone. Daily jobs stay daily, monthly stays monthly.
2. **Keyword-first autopilot.** Clients may be non-technical. The automatic pipeline must not write pages on topics it picked by itself.
   It needs a **keyword ladder**, whose keyword is **given by the client** — or, if the client wants, **recommended to them** (they pick
   from recommendations) — and only then does the writing start.
3. Production users are affected: plan carefully, test fully, deploy with care.

The production database will be **reset** and the current clients (Techand and others) asked to set up again — so no data migration of
existing websites is needed, but the deploy itself must still be safe.

## 2. The incident that triggered this (2026-10-19, Techand, production)

- Techand set up tracking with "crm service provider" as a *keyword to track*. That field only feeds rank checks; nothing turns it into
  content. They never started a keyword ladder (onboarding never asks for one).
- With no ladder, the Content Cadence filled the week itself (its order: ladder pages → the **AI answer page of the week** (AI growth's
  "questions to win", `ai_pages_month` default **2**) → Search Console striking-distance queries → rising Trends). It chose
  **"dynamics 365 finance operations partner uae"** (`source: ai_refresh`, a refresh of their existing D365 F&O page) — nothing to do with
  CRM. The page failed QA (`not_ready`), was never published, and its 59.56 credits were refunded.
- Lesson: the product must never write a topic the client did not choose (or approve) — especially for non-technical clients.

## 3. What exists today (verify each against the code before planning — things move)

### Schedules (engine, n8n; times in `GENERIC_TIMEZONE` = America/New_York)
| Workflow | Trigger | File / builder |
|---|---|---|
| AI Visibility `SEOagentAIVisib1` | weekly Mon 07:00 (`triggerAtDay: [1]`) | `build_monitors.py` `TRIGGER(A, 7, 0)` |
| Backlink Monitor `SEOagentBacklnk1` | weekly Mon 07:30 (first run of a month = full report) | `build_monitors.py` |
| Rank Tracker `SEOagentTracker1` | weekly Mon 08:00 | `build_ladder_extras.py:82` |
| Site Tracker `SEOagentSiteTrk1` | weekly Mon 09:00 | `build_site_tracker.py:139` |
| AI Growth `SEOagentAIGrow1` | weekly Mon 09:30 | `build_monitors.py` |
| Content Cadence `SEOagentCadence1` | weekly Mon 10:00 | `build_site_tracker.py:452` |
| Link Builder `SEOagentLinkBld1` | weekly Mon 11:00 | `build_monitors.py` |
| AI Pulse `SEOagentAIPulse1` | daily 06:30 Tue–Sun (cron `30 6 * * 0,2-6`) | `build_monitors.py:415` |
| Page Watch `SEOagentPageWch1` | daily 05:45 | `build_site_tracker.py:608` |
| Audit Scheduler `SEOagentAuditSc1` | monthly, 1st 06:00 (skips a site audited < 25 days ago) | `build_monitors.py:567` |
| Schedule Catch-up `SEOagentCatchUp1` | sweep every 15 min + on n8n start; replays missed fires | `build_catchup.py` (reads the crons FROM the generated workflows) |

- Every weekly workflow runs **all sites at once**; sites come from `seo_sites` (+ ladders) via `v5/code/_monitor_sites.js` (paused sites
  skipped on schedule runs). Each also has a **Manual Run** entry (`{ domain | site_id, … }`) that runs ONE site — and runs it **even when
  that job is switched off for the site** (the cadence's on-demand path even for a **paused** site).
- Weekly logic keyed to the week: the cadence's week keys (`cad_<YYYYMMDD>_<site>_<n>` request ids), pile-up guard, backlinks "first run
  of the month = full", AI visibility "monthly full run" (Claude / brand question / market index once a month), catch-up slot keys
  `catchup:<wf>:<due>`, the run guard. All assume one shared Monday.
- **Site Kickoff** `SEOagentKickoff1` (built + deployed to production 2026-10-19, commits b42d47d, eefcf86):
  `POST /webhook/seo-site-kickoff` (X-API-Key) `{ domain | site_id, jobs?, force?, dry_run? }` → 202, then starts each weekly job the site
  has switched on, through its Manual Run, one after the other in Monday's order (AI visibility → backlinks full → AI growth → cadence →
  link builder). Refuses untracked / paused / already kicked off (`seo_cache` `kickoff:<site_id>`). Harness `SK1` (16 checks). **The web app
  does not call it yet** — Techand's was started by hand. It still runs the cadence even when the site has no ladder (→ §2's problem).
- Track my site already runs the Site Tracker once immediately (the main workflow calls its Manual Run).

### App (`app/`)
- Schedule shown to customers: `shared/src/constants.ts` `AUTOMATIONS` (each with a fixed `schedule`) + `nextScheduledRun()`; the Pipeline
  page's "This week", 4-week calendar and "next run" times, `pipeline-notices.ts` (manual runs vs the schedule), marketing "Monday report"
  wording.
- Onboarding (`web/src/pages/onboarding/`): company → website → verify → business → E-E-A-T profile → tracking & monitors (`TrackingStep`,
  `keywords` = keywords to TRACK, blog posts a week, monitors) → launch (`LaunchStep`).
- Keyword ladders: **New keyword ladder** flow (`web/src/pages/site/NewLadderPage.tsx`): choose a keyword (own or recommended from
  discovery), the **keyword check** ("difficulty for your site", plan type Direct / Short / Full; `POST …/keywords/assess` →
  `SEOagentAssess`), then start the ladder run. Ladder settings per ladder + `_site` defaults in `seo_ladder_settings` (Auto / Manual,
  priority, max active 2, pile-up 3; **opportunities** Auto/Manual; `autoStartLadders` = "Choose keywords for me", off;
  `AUTO_START_LADDERS` env off). Cadence mirror: `server/src/services/cadence.ts` (must change together with `v5/code/Cadence_Plan.js`).
- Credits (`app/docs/CREDITS.md`): every schedule's work is **autopilot** spend; the guard pauses a company's schedules at 0 credits;
  "keep credits for autopilot" reserve uses the per-month forecast (`shared/src/autopilot.ts`). A per-site start day changes nothing there
  but the forecast's month split (check).

## 4. Production and process rules learned the hard way

- Production: API + n8n on GCP `alaventra-prod` (VM `alaventra-vm-1`), web on Vercel (`main`). `deploy/gcp/RUNBOOK.md`.
- **Engine deploy:** `deploy/gcp/deploy_engine.py --apply` updates ALL workflows (re-arms every schedule) and refuses Mon 07:00–12:00 NY.
  For one new/changed workflow: import it alone through IAP SSH (`n8n import:workflow … --projectId=wo1WpMiHjdduGvfl`, which deactivates
  it) and activate it through n8n's API from inside the VM (key from `/mnt/data/secrets/n8n.env`, never printed). Back up first
  (`sudo bash /mnt/data/repo/deploy/gcp/backup.sh`).
- **App deploy:** VM `git fetch` the feature branch + check out the exact commit, `up -d --build app` (migrations run at start); then move
  `main` to that commit (Vercel). API first, then web. `--no-build --no-deps app` to restart with the same image.
- **Settings** live in Secret Manager (`alaventra-app-env` / `-prod-env` / `-n8n-env`); `load_secrets.sh --apply` would also push the
  local `app/.env` (dev values!) — add a single key by writing a new secret version from the stored one (done 2026-10-19 for
  `PLATFORM_ADMIN_EMAILS`).
- **Harness** without the laptop's n8n (stopped on purpose — never start it, its schedules would spend): copy `harness/` to a temp dir and
  run `docker run --rm --entrypoint sh -v <tmp>:/tmp/harness -w /tmp/harness -e CODE_DIR=/tmp/harness/code_v4 n8nio/n8n:2.41.4 -c 'node scenarios_v5.js'`
  (7163 passed, 0 failed on 2026-10-19). Build: `cd n8n/seo-agent && python3 build_v4.py` (check the exit code; the generated
  `app/shared/src/seo-events.generated.ts` header gets an em dash back — keep the committed version).
- App tests: Docker `node:22-bookworm-slim`, run vitest with `--pool=threads --poolOptions.threads.singleThread` (the Mac is short of
  memory; parallel workers crash). E2E: `app/scripts/credits_e2e.py` with `scripts/stub_n8n.py` against a server started from a worktree on a
  copy of the dev database (see the end of `app/docs/CREDITS.md`).
- **Another Claude session works in the same repo** (copy clean-up: no em dashes / curly quotes, "Settings > Credits", page titles
  "Page | Alaventra"; it also added invoices and contact addresses). Before editing files, coordinate (SendMessage) and pull; never commit
  its hunks; follow its copy rules in new customer text.
- The n8n API's executions list does not show **running** executions — read `execution_entity` directly before concluding a run "never
  started".

## 5. Research to do (the plan's first section)

- **Our setup, in depth:** every place that assumes Monday or a shared week (engine week keys, monthly-full logic, pile-up, catch-up slot
  keys and due-time computation, rank tracker deltas, report wording, app calendar/notices, marketing); what a per-site weekday does to
  each; load spreading across days; what happens to existing sites (none after the reset) and to a site that changes its start day;
  daylight-saving and time zones (one engine time zone vs the client's).
- **Design options for per-site weeks:** (a) daily triggers + a per-site `cycle_day` filter in `_monitor_sites.js` / `Cadence_Plan.js`
  (+ the catch-up computing due slots per site); (b) a per-site scheduler (`next_run_at` per site per job, a dispatcher every N minutes
  that starts Manual Runs) — like a job queue; (c) others. Compare: correctness, cost, failure modes (missed fires, double fires, restarts),
  observability, how the catch-up and the run guard fit, migration size, test surface.
- **Keyword-first onboarding (non-technical clients):** how the leaders do it in 2025–26 (Surfer, Semrush ContentShake / Copilot, Search
  Atlas OTTO, Writesonic, Jasper, SE Ranking, Ahrefs, Byword, Arvow/Koala-style autopilots…): do they ask for a target keyword, suggest one
  from the domain, require approval before writing? What questions does a non-technical owner understand ("what do customers search for
  to find you?")? How to recommend keywords from what we already have (keyword discovery, Search Console, the business profile, services,
  competitors) with the difficulty-for-your-site check, and how many to pick.
- **Rules to decide:** no writing without a ladder (or an approved topic)? Keep AI answer pages / opportunity posts as **suggestions**
  until approved? What the day-one kickoff runs when there is no ladder yet (monitors only?). Credits shown at each choice.

## 6. The plan to produce (deliverable for the owner)

A written plan (`n8n/seo-agent/docs/` + a short summary in chat) with: the problem; findings from both research parts with sources; the
chosen design for (1) start-on-setup + per-site 7-day cycle and (2) keyword-first onboarding / recommendations / approval; every file and
workflow touched; data changes; how credits, the catch-up, reports and the app calendar change; the test plan (harness scenarios, app
tests, an end-to-end rehearsal of a new client from sign-up to first page on a copy of the database, dry runs in production); the deploy
plan (order, backups, rollback, the Monday window); open questions for the owner. Then wait for approval.
