# Real-credit rehearsal of a new client: 2026-10-20

The owner asked for the whole new-client process to be run once with real credits before production, and for the process and the code to
be analysed critically, so that nothing goes wrong in production. This is what was run, what it found, and what was fixed. Plan:
`SCHEDULING_KEYWORDS_PLAN.md`. Production was not touched: no deploy, no reset.

## 1. Set-up

The set-up mirrored production right after the planned reset:
- **Engine:** a fresh n8n 2.41.4 built from the production image (`n8n/deploy/Dockerfile`), on its own fresh Postgres, with a new owner and
  API key. It was deployed with the image's real release step (`seo-release`: deploy guard, the 13 credentials, 25 workflows, 23
  published, the Cycle Dispatcher included).
- **App:** an isolated app stack (fresh database, ports 4100 / 5174) running the branch's code, pointed at that engine.
- **Real external services:** DataForSEO, Anthropic, Google Search Console and GA4 for techand.ai, and Bing / IndexNow.
- **What was kept apart:** the old laptop n8n was never started, the dev stack was not touched, and engine e-mails to clients were off.
- **Test-only shortcuts:**
  - the website was marked verified in the app database (ownership proof needs the owner's own Google account or DNS);
  - the test e-mail addresses were marked verified (account e-mails are off on this stack);
  - the AI question panel was set to 8 questions to protect the DataForSEO balance, which production shares;
  - the "Coming up" preview was started once by a temporary workflow with the dispatcher's exact payload, instead of waiting until
    25 October. A preview writes nothing.

## 2. The client's path, as it ran

| Step | What happened | Result |
|---|---|---|
| Sign-up, company, website (techand.ai, UAE, Asia/Dubai), business answers with 4 services | app API | ok |
| Free keyword research at setup | engine `discover`, 3.1 min | ok, quoted 0 credits and charged 0; found defects 3 and 4 |
| Two typed keywords checked | Keyword Check, 4-7 s each, 1.64 credits each | ok; found defect 5 |
| Launch: Track (zone, services), level 2, ladder "crm service provider uae" (client typed, Auto, 1 page now) | app → engine | the cycle row was correct: anchor at tracking start, Tuesday 06:00 Dubai, monthly date the 20th, cycle 0 due now |
| Dispatcher in `plan_only`, then switched to `start` with the `cycle:mode` row (the runbook's go-live step) | sweeps every 5 min | ok; found defect 1 first |
| Cycle 0, all 8 jobs in order | AI visibility (full monthly, 2.3 min, $0.66 + $0.12), backlinks (full, $0.30), rank tracker skipped (no ladder yet), site tracker skipped, AI growth, content (level 2, no ladder: **wrote nothing**: "waiting for your first keyword … 1 suggestion waits for your OK"), Link Builder, monthly audit (crawl, 5.8 min) | every job done or skipped with its reason, each confirmed from its own ledger row; all filed as autopilot spend |
| Ladder, attempts 1 and 2 | DataForSEO live Google results answered "Internal SE Server Error" (40101) after about 27 s, twice per run | `NOT_CHECKED`, honestly reported, nothing invented; found defects 7 and 8 |
| Ladder, attempt 3 (after the fix) | results read in 9 s; GO_WITH_CHANGES, score 64, short plan, top page = the existing `/dynamics-365-crm-uae` | ok |
| First ladder page, "crm system" | 12 min, Claude $1.02 + $0.02 | written, refused by the quality check as **not ready to publish** (see §4); the report reached the app |
| Re-save tracking | Track's Site Tracker runs as its child (`parent:49`) | ok after fix 6 |
| "Coming up" for 27 Oct | `cycle_preview` → the app | budget spent 1 / room 0 (today's ladder page counted), nothing automatic, one on-topic suggestion (78 credits) |
| The client skips the suggestion "never again" | app → engine `seo_skips` | key `site_techand-ai:always:crm implementation cost uae`; the next plan no longer offers it |
| The client's views | cycle, Pipeline, Needs you | correct: "Your week starts on Tuesday", the jobs with plain reasons, Needs-you "Choose the keyword you want to be found for" |

**Real spend:** DataForSEO **$1.85**, Claude **$1.73**. The engine's own ledger ($1.846) matches the account's real movement ($2.66 →
$0.80) to within a cent. DataForSEO holds **$0.80**.

## 3. Defects found by the real run, all fixed and tested

None of these showed in the offline harness, because each needed a fresh database, a real restart, the real n8n API or a real
provider outage.

| # | Defect | Impact in production | Fix (commit) |
|---|---|---|---|
| 1 | The Cycle Dispatcher refused every sweep on a fresh engine ("seo_sites not found"): since the review fix it refuses on any failed read, and the tables did not exist yet | after the reset: an error and an ops alert every 5 minutes, no website's week runs | the dispatcher creates every table it reads; a build check proves it (16bab8c) |
| 2 | (checked, not a defect) sweeps looked "running" for ever in the database | none: n8n soft-deletes successful runs that are set not to be kept; verified in n8n's own code | none needed |
| 3 | The free setup research also started a paid keyword report on the engine's own pick | a second paid run under a run quoted free, for every new client | automatic research asks for the strategy only (818829c) |
| 4 | Research suggestions ignored what the client sells: "software development company in dubai", "it company in dubai" ranked above "crm system" for a CRM business | a non-technical owner picks a generic, off-topic keyword, which defeats keyword-first | every suggestion judged against the client's services; in first, out last with a note; "Choose for me" never picks an out one (F-REH, 77b944f) |
| 5 | The Keyword Check's topic warning repeated itself, used internal terms and told the client to add services they had already added | confusing copy at the most important choice | one plain sentence that fits the state; a declared service's category word counts as evidence (F-REH) |
| 6 | A restart left the interrupted run's reservation holding a slot for 2 h; Track's own Site Tracker was then refused (Track counted itself as "another run"); and cycle 0 skipped the Site Tracker anyway | after any deploy: capacity blocked for 2 h; a new client gets no site report for a week | the dispatcher releases dead reservations of any run; Track passes its parent id; cycle 0 skips a job only after a run of it was done (F-REH). Verified live: the ghost was released, and the Site Tracker ran as `parent:49` |
| 7 | One DataForSEO retry was not enough for the head keyword's results page during a provider outage | a client could not start a ladder on their own keyword | 3 attempts, the last one lighter, cost counted per task, and the AI Overview is labelled "not read" when the light read is used (F-SERP, 69a2071). Verified live: attempt 3 succeeded |
| 8 | A ladder refused for that outage was charged about 16 credits each time | clients pay for the provider's failure | such a run ends as failed, and the cost sync charges 0 and returns what it took (0e6b576) |
| 9 | The Pipeline's AI growth figure counted AI answer pages that level 2 only suggests | about 100 credits a month over-forecast for every level-1/2 site | the figure follows the level (ff5380e) |

Checks after all merges:
- engine harness **9635 passed, 0 failed**;
- typecheck clean in all three workspaces;
- shared **553**, server **1211** and web **125** tests passing;
- the web build passes.

## 4. Open items for the owner (decisions, not code defects)

1. **The first page was written before the business profile existed.**
   - The quality check correctly refused it as "not ready to publish": sources to add, 11 author fields to fill, two claims about being
     a Microsoft partner marked to confirm, and 4 subtopics the best competitor covers.
   - The client still paid about 62 credits for a draft.
   - Recommendation: the first page of a ladder waits until the author profile and the business facts are filled in (the onboarding
     "profile" step); the ladder plan can still run.
2. **Em dashes are still in the page quality check's customer text** ("… — not ready to publish", "— fill each one in").
   - This is the engine-wide copy sweep that is already on the list (memory: engine prompts not done yet).
   - The planner, research and gate texts are clean now.
3. **New sites default to a 50-question AI panel.**
   - The engine's own price: cycle 0's full AI-visibility run is about $3.19, and the daily pulse about $15 a month, per site.
   - This rehearsal used 8 questions, which cost $0.78 for cycle 0.
   - Decide the default before launch.
4. **DataForSEO holds $0.80, and production shares it.** Top it up before the deploy and before inviting clients back.
5. **Charging policy edge:** a verdict-only run whose results page could not be read is still charged; only the ladder case is free now.
   Decide whether the rule should cover it too.
6. **Deploy:** the plan's §10 and `deploy/gcp/RUNBOOK.md`.
   - First deploy with `deploy_engine.py --apply --create-missing`; `sync_tables.py` runs before the workflow PUTs.
   - The dispatcher arrives in `plan_only` mode.
   - The owner writes the `cycle:mode` row after one clean plan.
   - The app's migrations 0018 and 0019 run at server start.
   - D8 (the reset scope) and the exact window are the owner's.

## 5. Where the evidence is

- **Driver and readers (local scratchpad of the session):** `reh/drive.py`, `reh/peek.py`, `reh/execs.sh`.
- **The engine's final ledger and cycle state:** `reh/final_ledger.txt` and `reh/final_cycle.txt`.
- **The stopped containers' volumes are kept:** `alvreh-pgdata` (engine) and `alvreh-app_alvreh-appdb` (app).
  - Delete them with `docker volume rm` when no longer needed.
  - The temporary preview workflow lives only in that engine's database.
