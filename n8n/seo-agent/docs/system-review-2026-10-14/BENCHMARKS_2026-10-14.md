# Benchmarks — every feature against the best available standard

Written under `BENCHMARK_PROGRAM.md` in this folder. The `../system-review-2026-10-11/CRITERIA_*.md` stay **frozen**: where a
criterion is out of date, the section below keeps the old statement beside the new one with the date and the reason, and the scorer
keeps using the old one until the owner agrees to re-baseline. Every competitor claim carries a page that was opened, with the
sentence it rests on quoted; where a leader's behaviour could not be verified without a paid account, the finding says so.

One section per area. Sections are written by separate agents and merged.

---

# Area 13 — Cost control & reliability (4.5 / 10, joint-lowest)

*Written 2026-10-15. Evidence: `RESULTS.md` §0 in this folder (47 executions 535–581, $3.63),
`../system-review-2026-10-11/LIVE_CHECK_R17-R30_2026-10-14.md` (executions 582–591, $0.069),
`../system-review-2026-10-13/SCORECARD.md` §2.13 and `PATH_TO_8.md` §5.2. Criteria: Guards, 3.10, 2.14, 3.8, Ops.*

## 1. The leader today

The rubric names **Semrush / Ahrefs (server-side limits)**. That is still the right comparison for *metering*, and this pass found
it is the **only** thing they are the leader in. On three of the five things this criterion actually asks about — a published
uptime commitment, a public status page, and confirmed delivery of a failure notice — **neither of them leads**, and the leader is
outside SEO entirely.

| Question | Leader | Why, and the page opened |
|---|---|---|
| Metering a run's cost before and after | **Ahrefs** | Per-call cost in the response headers, a published formula, and free test queries to develop against ([docs.ahrefs.com/api/docs/limits-consumption](https://docs.ahrefs.com/api/docs/limits-consumption.md), [.../introduction](https://docs.ahrefs.com/api/docs/introduction.md)) |
| Behaviour when the limit is hit | **Semrush** | It *degrades* rather than refusing: for a per-line report "you will get the number of lines for which you have enough API units" ([developer.semrush.com/api/basics/api-units-balance](https://developer.semrush.com/api/basics/api-units-balance/)) |
| A published uptime commitment | **PagerDuty**, not an SEO tool | A numeric notification SLA with a stated measurement boundary ([pagerduty.com/standard-service-level-agreement](https://www.pagerduty.com/standard-service-level-agreement/)). Semrush publishes an SLA only for **Kompyte**, one acquired product, and only for Dedicated Environments ([kompyte.com/sla](https://kompyte.com/sla)); I found no Ahrefs SLA at all |
| A public status page | **Nobody in this comparison** | `https://status.ahrefs.com/` answers **404**; `status.semrush.com` did not resolve from this environment (`ENOTFOUND`) — a DNS failure here is weaker evidence than a 404, so the Semrush half is "not found", not "does not exist". Both checked directly in this session, 2026-10-14 |
| Honest statement of what the guard cannot do | **AWS / Google Cloud** | Both document the gap in their own words rather than hiding it (quotes in §2.5) |

**Criterion note (frozen criteria, programme rule 1).** The Guards criterion and the area heading say "Semrush / Ahrefs
(server-side limits)". **Old statement, kept:** that comparison. **New statement, 2026-10-15, reason:** neither Semrush nor Ahrefs
publishes a status page or a general uptime SLA, so a criterion that scores "the leaders' reliability contract" against them is
scoring an absence. Reliability should be benchmarked against the operational vendors (PagerDuty's published notification SLA,
Google SRE's error budget) and metering against Semrush / Ahrefs. **The scorer keeps using the old statement** until the owner
re-baselines.

## 2. What the leaders do, mechanism by mechanism

### 2.1 One meter, for the whole service

**Ahrefs.** `cost = max(base_cost, per_row_cost * num_rows)`, where "The `base_cost` of each request is **50 units**" and the
per-row cost is "the sum of the costs of each unique field that appears in either the returned result, or in the `where` or
`order_by` parameters" — most fields 1 unit, some metrics 5 or 10. Two consequences worth copying: **a field you filter on costs
the same as a field you display** (you cannot hide a cost by not printing it), and **"Requests served from cache do not consume
units."** Free endpoints are labelled on their own pages.

**Semrush.** Two charging shapes only — "Reports that charge **per line** of data returned" and "Reports that have a fixed cost
**per request**" — plus one lever the customer controls directly: `display_limit`, documented as a way to "limit the number of
lines returned in a response to save on API units."

In both, **one meter governs everything**. There is no second currency the customer has to reason about separately.

### 2.2 The cost of the call is in the call's own answer

Ahrefs returns, on every response: `x-api-rows`, `x-api-units-cost-row`, `x-api-units-cost-total` (what it *should* cost from rows
× per-row) and — the one that matters — **`x-api-units-cost-total-actual`**, "units the request actually consumed", plus
`x-api-cache` (`hit` / `miss` / `no_cache`). A customer never has to reconcile a sum of guesses against a balance: the vendor
states, per call, what it charged.

Semrush does not do this per call, but gives a **free** balance endpoint —
`GET http://www.semrush.com/users/countapiunits.html?key=…` — explicitly described as a "free API request", so polling the meter
never costs anything.

### 2.3 What happens when the limit is hit

- Semrush API v3: **`ERROR 132 "API units balance is zero"`**; v4 returns 403; Projects and Local APIs return 403. And, for
  per-line reports, **partial delivery**: "you will get the number of lines for which you have enough API units."
- Ahrefs: rate limit "60 requests per minute by default", exceeded → **HTTP 429**, with additional "dynamic throttling based on
  system load". Units: "**API units once consumed are non-refundable**", so the docs recommend free test queries during development
  and "putting limits on API keys".
- Semrush Site Audit (the in-product limit, not the API): 100,000 / 300,000 / 1,000,000 pages a month on Pro / Guru / Business,
  20,000 / 20,000 / 100,000 in a single audit, and "Any leftover pages from your crawl budget do not roll over month to month" —
  "your limits reset on the 1st day of every month". Notably, that page says **nothing** about how a customer sees the remaining
  crawl budget or what happens when it runs out ([semrush.com/kb/338](https://www.semrush.com/kb/338-how-many-pages-can-i-crawl-in-an-audit)).

### 2.4 Attribution and audit

Per *API key*: both let you create several and watch them. Ahrefs — "Only workspace owners and admins can create and manage keys",
usage under "Account settings / Limits & usage". Semrush — the Subscription Info tab is where you "Check your limits, API units,
billing info, and payment history" ([semrush.com/kb/856](https://semrush.com/kb/856-subscription-plans-comparison)).

**Per project and per end customer is where the leaders are weaker than their reputation.** Nothing in the pages opened documents a
per-project or per-client cost breakdown that an agency could put in front of its customer; the unit of attribution is the API key
and the account. The same page also sets the plan limits the customer is told in advance: SEO 5 websites / 500 keywords tracked
daily; Starter 5 / 500 / 50 prompts / 300 AI visibility reports a day; Pro+ 15 / 1,500 / 100; Advanced 40 / 5,000 / 200;
Enterprise custom.

### 2.5 The uptime and alerting contract

- **Semrush (Kompyte only).** "a Monthly Uptime Percentage of at least 99.9% during any monthly billing cycle", credits 5% / 7% /
  9% by band, applying only to services "running in Dedicated Environments", with Semrush's own monitoring named as "the sole basis
  for resolution of any dispute". It is an SLA for one acquired product, not for the SEO platform.
- **Ahrefs.** No SLA and no status page found. Third-party monitors disagree with each other (one reports 97.193% over 90 days
  while simultaneously showing "all systems operational"), so **nothing about Ahrefs' uptime is asserted here**.
- **PagerDuty** is the honest model: "deliver the First Responder Notification within the Notification Delivery Period for 99.9% of
  the notifications", "The 'Notification Delivery Period' is five (5) minutes" — and the boundary is stated: "it is measured as the
  time it takes the Hosted Service to deliver a First Responder Notification to **Delivery Service(s)**", i.e. to the carrier, not
  to the human. PagerDuty also publishes its own failure mode: "PagerDuty depends on a delivery receipt from carriers and providers
  to confirm whether an SMS was delivered… If no delivery receipt is received, PagerDuty resends the notification" — and says the
  result is a duplicate. Escalation if nobody acts: "If no one takes action before the timeout elapses, the incident escalates to
  the next rule", default 30 minutes, repeatable up to nine times
  ([escalation-policies](https://support.pagerduty.com/main/docs/escalation-policies),
  [sms-notification-troubleshooting](https://support.pagerduty.com/main/docs/sms-notification-troubleshooting)).

### 2.6 Platform-engineering practice, which is the real benchmark here

This criterion is operational honesty, not an SEO feature. Four patterns, each from the vendor's own documentation:

| Pattern | What the documentation actually says | Source |
|---|---|---|
| A budget is a **notification**, not a brake | AWS: "AWS Budgets information is updated up to three times a day. Updates typically occur 8–12 hours after the previous update", and "You might incur additional costs or usage that exceed your budget notification threshold before AWS Budgets can notify you". GCP labels it with a Caution: "Setting an alerts-only budget doesn't automatically cap Google Cloud or Google Maps Platform usage or spending." GCP's *spend cap* budget does enforce — "the specified services are paused until you manually lift the cap" — but only "if supported for your service" | [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html), [GCP budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets) |
| **Idempotency** is a first-class API feature | Stripe: "Stripe retains keys for at least 24 hours"; a retry "return[s] the saved response, including `500` errors"; a replay is visible as `Idempotent-Replayed: true`; the same key with different parameters "produces an error"; a concurrent reuse is `409 Conflict` | [Stripe](https://docs.stripe.com/api/idempotent_requests) |
| **Dead letters** are retained and replayable | SQS: `maxReceiveCount` moves a message to a DLQ, the enqueue timestamp is **unchanged** for standard queues (so the DLQ's retention must be longer than the source's), and a documented *redrive* task puts messages back. Pub/Sub is honest about its own limit: max delivery attempts "is approximate because Pub/Sub forwards undeliverable messages on a best-effort basis" | [SQS DLQ](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html), [Pub/Sub](https://docs.cloud.google.com/pubsub/docs/handling-failures) |
| An **error budget** is arithmetic, not a feeling | "the SLO is a target percentage and the error budget is 100% minus the SLO"; 99.9% availability = **43.2 minutes a month** (8.76 h a year) | [SRE workbook](https://sre.google/workbook/implementing-slos/), [availability table](https://sre.google/sre-book/availability-table/) |

The pattern worth copying is not any one of these: it is that **all four state the gap in their own words**. AWS says you may
overspend before being told. GCP prints a Caution that its budget does not cap. Pub/Sub calls its own maximum "approximate".
PagerDuty publishes an SLA that ends at the carrier. That is the bar — a stated, bounded claim with a named failure mode.

## 3. What we do, from the live evidence

Measured tonight, with execution ids.

| Mechanism | State | Evidence |
|---|---|---|
| A reservation **before** the first paid call | **Ahead of the leaders.** All ten workflows, proven by the build walking `main` from every trigger | exec **586**: `BL Plan` +0.37 s → Ensure +0.50 → Row +0.51 → Reserve +0.54 → first outside call +0.93 s; exec **588**: `DFS Balance` +0.52 → `Run Ledger Row` +1.32 → `Reserve` +1.61 → `Rate Limit` +1.94, all before the crawl |
| Balance read before and after every run | **Ahead of the leaders.** Free `appendix/user_data`, on every scheduled run's ledger chain since R33 | rows 72–76 of 2026-10-14; readings 17:54:53, 17:55:24, 18:03:43 |
| A task counted once, by id | fixed (R28) | exec **579**'s shape summed to $0.452 for $0.092 of movement before the fix |
| A crawl priced from the pages crawled, labelled estimated | fixed (R32) | exec **588** settled the $0.0900 *quote* for 200 requested pages while 47 were crawled and the account fell **$0.031950** (+181%); the fix settles $0.0212 |
| A free run settles $0 | fixed (R31) | exec **586** settled $0.05 of Claude with **no model node** in its 89-node trace while telling the caller `cost_usd: 0` |
| Every branch prices its own Claude calls | fixed (R33) | exec **591**: settled $0.06, its node reported 4,874 / 1,306 tokens = **$0.0114**, 5.3× |
| The day reconciled against the account | built, and it caught us on its first live run | exec **591**: `dfs_day_reconciled: false` — "the account fell $0.0560 … while 4 settled run(s) report $0.1140 … (+103.6%); the account is the figure to believe" |
| Three streaming Opus nodes priced from characters | **$0.3937 of $1.2458 — 32% of the Claude figure is an estimate** | `RESULTS.md` §0 |
| An ops alert delivered | **never, not once** | all `seo_ops_alerts` rows `delivered: "pending"`; SMTP `ENOTFOUND smtp.gmail.com`; the Slack URL is now set but no failure occurred to send one (`RESULTS.md` §1, "Protocol runs not exercised") |
| Host | a Mac that restarts | D25a; the AI Pulse missed 2026-10-10 and 2026-10-11 |

### 3.1 What the customer is told *before* a run

Two different numbers, from two different tables.

- **The engine** reserves `CC.pick(...)`: self-correcting per-mode figures in `v5/code/_cost_cal.js`, recalibrated 2026-10-13 from
  the measured runs and never allowed below what the mode recently cost.
- **The app** shows `MODES[mode].costUsd` / `estimateRunCost()` in `app/shared/src/constants.ts` and `estimate.ts`, whose own
  comment dates it: *"(HANDOVER.md §4, live runs of 2026-10-02)"*.

Against the 2026-10-14 measurements the app's figure is **systematically high**, by 1.3× to 2.5×:

| Mode | App shows | Measured 2026-10-14 | Over by |
|---|---|---|---|
| Keyword ladder, 1 page | $1.80 (`0.6 + 1 × 1.2`) | $0.726 (execs 549 + 554) | **2.5×** |
| Technical audit | $0.10 | $0.032 measured / $0.090 quoted (exec 588) | 3.1× / 1.1× |
| Full SEO report | $0.90 | $0.504 (exec 566) | 1.8× |
| Backlinks, full | $0.50 | $0.378 (exec 564) | 1.3× |
| Keyword discovery + report | $0.70 | $0.546 (execs 553 + 555) | 1.3× |
| AI visibility | $0.90 | $0.890 (exec 563) | 1.0× — right |

Over-estimating is the safe direction for a bill and the wrong direction for a guard: on 2026-10-13 **two customer-facing runs were
refused at "$5.74 of $6"** on estimates, and five were refused in the first re-rating. The customer's experience of a 2.5×
over-estimate is not a pleasant surprise — it is a run that did not happen.

### 3.2 What the customer is told *afterwards*

The settled row is now genuinely good: `measured_usd` and `estimated_usd` kept apart, a `cost_basis` sentence that names which half
is which, and the day's reconciliation riding on the same line when it disagrees. Two limits remain, both recorded in
`FIX_PLAN.md` §3.13 and both structural:

1. **The balance reading is taken at *reserve* time, so a run can never reconcile its own spend.** Audit 588 compared $0.0000 with
   $0.0000 over a window that closed before it had spent anything; its +181% error only surfaced on the *next* run that took a
   reading. The last run of a day is never closed at all.
2. **Attribution is per run, not per customer or per keyword.** Criterion 2.14 asks for "cost per keyword per month shown and
   capped"; no run produces that denominator.

### 3.3 What happens when something fails at 3 a.m.

Honestly: **nothing reaches a person.** The chain is sound on paper — Error Handler → `seo_ops_alerts` row (the record of last
resort) → webhook + e-mail → `Alert Delivery` writes back which channel carried it, deduplicated within 30 minutes. But every one
of the three parts has been observed failing: SMTP cannot resolve, the webhook URL was unset until this week, and **no row has ever
reached `delivered` other than `pending`**. There is no retry of a *failed* delivery and no escalation; a run that dies at 03:00
is visible in the app's failure watcher within about two minutes **if somebody is looking at the app**. Compared with PagerDuty's
retry-on-no-receipt plus 30-minute escalation, we have one attempt per channel and then silence.

And the host stops. D25a is the ceiling: on a Mac that sleeps and restarts, a ≥ 99% delivery rate (criterion 3.8) is not merely
unmeasured, it is **not measurable** — the SRE arithmetic says a 99.9% target allows 43.2 minutes of downtime a month, and a single
missed Pulse day is 1,440 minutes.

## 4. The gap

| # | What they do | What we do | Does it matter to the customer | Criterion |
|---|---|---|---|---|
| G-13.1 | One meter governs the whole service (Semrush units, Ahrefs units) | **Two currencies, one guarded.** `ai_budget_usd` could refuse a run; DataForSEO — **$2.3876 of the $3.63** of the 2026-10-14 run, 66% — had a running total nothing refused on | **Yes.** The bigger half of the bill had no brake at all | Guards, 2.14 |
| G-13.2 | The account limit is enforced by the service (`ERROR 132`, 429) | The DataForSEO account balance was read and stored, never acted on. Hitting zero does not refuse a run — it makes the paid calls inside one start failing | **Yes.** A half-delivered report, charged for in full, at 3 a.m. | Guards |
| G-13.3 | Semrush *degrades*: "the number of lines for which you have enough API units" | We refuse the whole run | Partly — see §5(c): refusing is the right default for a report, but a crawl could be capped to fit | Guards |
| G-13.4 | `x-api-units-cost-total-actual` — the vendor states what each call charged | We sum per-task `cost` and reconcile the day against the balance. DataForSEO's crawl `cost` is a **quote**: the docs describe it only as "cost of the task, USD" and the help centre says "your account is charged for the actual number of crawled pages… the difference will be automatically refunded" | **Yes, but it is their gap, not ours** — we cannot be better than the provider's reporting; we can stop calling a quote a measurement, which R32 did | 3.10, 2.14 |
| G-13.5 | Usage visible per API key, with billing history | Per run, per mode, per day, in `seo_run_ledger`; nothing per keyword or per customer | **Yes for an agency buyer**, and 2.14 asks for it by name | 2.14 |
| G-13.6 | A published uptime number (PagerDuty 99.9% in 5 min, Kompyte 99.9%/month) | None, and on a laptop host none is possible | **Yes.** This is the single hardest cap on the area | 3.8, Ops |
| G-13.7 | Delivery is retried and escalated; PagerDuty resends when no receipt arrives | One attempt per channel, then the Data Table row. **Zero alerts ever delivered** | **Yes.** An alert nobody receives is not an alert | Ops, 3.9 |
| G-13.8 | Stripe-style idempotency: a replayed request returns the first answer, never charges twice | A repeated POST starts a second run and spends again. The app warns about "likely duplicates"; the engine does not dedupe | **Yes.** A timeout-and-retry by the app, or a webhook delivered twice, is a double charge | Guards |
| G-13.9 | AWS/GCP/Pub/Sub state what their guard cannot do | We now do this well (`cost_basis`, "ESTIMATED", "the account is the figure to believe", "not compared: the sample moved") | **Already at the bar** | 3.10 |
| G-13.10 | — | The streaming Opus nodes are said to "report no token usage". **That is not true of the API.** Anthropic documents usage on `message_delta` during a stream ("The token counts shown in the `usage` field of the `message_delta` event are *cumulative*"), and `@langchain/anthropic@1.5.6` in the running container sets `streamUsage = true` by default. The loss is in n8n: `LmChatAnthropic.node.js:555` parses `result?.llmOutput?.usage`, which a streaming run does not populate, so `N8nLlmTracing.handleLLMEnd` falls back to `tokenUsageEstimate` | **Yes** — it is 32% of the Claude figure, and it is recoverable | 3.10 |

Sources for G-13.10: [Anthropic streaming](https://platform.claude.com/docs/en/build-with-claude/streaming); the n8n side read
directly out of the running container (`/usr/local/lib/node_modules/n8n/node_modules/@n8n/n8n-nodes-langchain/dist/nodes/llms/LMChatAnthropic/LmChatAnthropic.node.js`
and `@n8n/ai-utilities/dist/*/utils/n8n-llm-tracing.js`), not inferred.

## 5. What to build

### (a) In reach now

| Item | Size | State |
|---|---|---|
| **A1. `dfs_budget_usd` — the data money guarded like the Claude money** (G-13.1) | S | **Built this pass**, build section 61, harness S71 |
| **A2. The account balance as a hard floor** (G-13.2): refuse a run the account cannot pay for while leaving `dfs_balance_floor_usd` for the scheduled checks; fail **open** when the free probe does not answer | S | **Built this pass** (same section) |
| **A3. A settled run counts what it measured** in the day's data total — it read `dfs_usd \|\| dfs_est_usd`, so a `free_only` run that spent $0 held its $0.45 against the day for ever | XS | **Built this pass** |
| **A4. One number before the run** (`run_cost_estimate_usd` + basis) from the same calibrated estimates the guard reserves | XS | **Built this pass.** The app must then *use* it — see (b)-B1, which is the reporting agent's file |
| A5. **Every run reconciles its own spend**: a second free `appendix/user_data` reading on the settle side of `ledger_mainline`, with the delta attributed to the run only when no other ledger row overlapped its window, and "not attributable (N runs overlapped)" when one did | M (one node in 10 workflows + `CC.dfsSelf`) | not built — it rewires every feeder of each settle, which is more than "small and safe" for one pass |
| A6. **Idempotency on the front door** (G-13.8): a `request_id` the API already carries, deduped against `seo_run_ledger`; a repeat inside the window returns the first run's id instead of spending again, Stripe-style | M (needs a `request_id` column → `ladder_common.py` + a `sync_tables.py` on deploy) | not built |
| A7. **Retry and escalate an undelivered alert**: a row at `pending` / `failed` older than N minutes is re-attempted on the next run of any workflow, severity raised after K attempts, `delivered` written back per channel | S–M | not built |
| A8. **Read the real token usage of the streaming nodes** (G-13.10): either a thin HTTP call that reads the final `message_delta.usage`, or a patched tokens parser. Would move 32% of the Claude figure from estimate to measurement | M–L, and it touches the three Opus nodes of the content run — the highest-value and highest-risk item here | not built |
| A9. **Page Watch has no ledger row of concurrency consequence** — it has one now (R32's companion), but it is still outside `Rate Limit`, as are all nine schedules: a monitor cannot be refused by the budget, only counted | S | not built; decide first (see (c)) |

### (b) Needs money or an owner decision

| Item | Cost | Who decides |
|---|---|---|
| **B0. D25a — an always-on host.** The ceiling. Without it criterion 3.8 ("delivery rate ≥ 99% measured") cannot be scored above 5, G21's delivery rate has nothing to measure, and every schedule-based criterion carries an asterisk. In rubric terms it costs roughly **1.0 of this area's score and a share of 3.8 everywhere else**; `PATH_TO_8.md` §5.2 prices the area at 7.0 without it and 8.0 with it | ≈ **$30/month** + a month of elapsed time | owner |
| **B1. One estimate, not two.** `app/shared/src/constants.ts` + `estimate.ts` still carry the 2026-10-02 table and are 1.3×–2.5× high; A4 now publishes the engine's calibrated figure. **`app/` is the reporting agent's file this pass**, so this is listed, not built | free | reporting agent / owner |
| **B2. `SEO_ALERT_WEBHOOK_URL`** — set in `n8n/.env`. SMTP is broken; this is the only working channel, and until it is set every alert that fires is recorded and delivered nowhere | free | owner |
| **B3. The Anthropic Console cost export**, once a month, for `reconcile_claude_cost.py` | free | owner |
| **B4. A published reliability statement** — once B0 is real: what we commit to (e.g. "a scheduled run starts within 90 minutes or you are told"), measured how, and the named failure modes. PagerDuty's shape, not Kompyte's | free, after B0 + a month of data | owner |

### (c) Deliberately not worth it

| Item | Reason |
|---|---|
| **C1. A credit / unit currency of our own.** Semrush and Ahrefs meter in units because they resell *their own* index at a margin. We resell DataForSEO and Anthropic at cost, and a synthetic unit would hide the one thing this engine does better than the leaders — telling the customer the real dollars. Keep dollars |
| **C2. Partial delivery when the budget runs out** — Semrush's "the number of lines for which you have enough API units". For a *report* this is the wrong behaviour: half an audit that reads like a whole one is exactly the dishonesty §2.6's bar exists to prevent, and R11 / R19 are the same lesson in content and in sampling. **One exception is worth doing inside A1/A2 later:** cap `max_crawl_pages` to what the remaining budget affords, since a 120-page crawl is an honest smaller sample and DataForSEO already bills per page crawled. Refuse reports, shrink crawls |
| **C3. A full dead-letter queue with redrive.** n8n's execution list plus `seo_run_ledger` plus *Release Stale Runs* already gives retention, visibility and a manual re-run at a scale of tens of runs a day. A DLQ earns its keep at thousands |
| **C4. A per-call cost header of our own invention.** The provider does not report a crawl's final charge (DataForSEO's `cost` is the creation quote and the overage "will be automatically refunded"), so any per-call "actual" we printed would be a number we made up. The pro-rata estimate labelled ESTIMATED (R32) is the honest ceiling here |
| **C5. Matching Semrush's plan limits** (100,000 pages a month and so on). Those are commercial packaging for a self-serve tool with a fixed monthly price; our constraint is a pay-as-you-go balance, and copying the shape would make the limit less true, not more |

## 6. The one change

**Buy the always-on host (D25a):** every other improvement in this area is a number we compute about ourselves, and none of them can
be *believed* while the machine that runs the schedules is a laptop that sleeps — it is the only item here that is blocked purely on
a decision, and it is what turns a careful cost ledger into a reliability record a customer could be shown.

---
