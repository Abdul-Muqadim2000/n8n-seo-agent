# R-ENGINE: fixes for the engine review of the AI-visibility waves (2026-10-23)

The findings are in `../REVIEW_ENGINE.md` (R-E1 to R-E14). This branch starts from `2ed297ca`. Nothing was deployed and no paid call was made.

The checks:

- **Harness: 11844 passed, 0 failed**, against 11732 before. It ran in a fresh copy of `n8n/seo-agent` without `docs/`, in `n8nio/n8n:2.41.4`.
- **Build**: `build_v4.py --no-env` exits 0.
- **App shared**: `app/shared` vitest passes 652 of 652, including `cost.aipanel.test.ts` with the regenerated golden cases.
- **`never_deploy.mjs --self-test`**: all 8 checks pass.

**Fail before, pass after.** Each new or changed scenario was also run against the base build (`2ed297ca`'s `code_v4` and wiring) with the new
scenario files (`ONLY_S`). Result: 66 assertions failed there, all of them the assertions of these fixes, and every one passes now. The
never-deploy order check fails on `2ed297ca`'s `release.mjs` and `deploy_engine.py` and passes now.

Three things were left to the parallel fixer (W2-FIX), as agreed:

- the `units_json` pruning (R-E7, 70 days);
- `deploy_manifest.json`;
- the app's cost glue.

## R-E1 (High): a measured week is never paid for again

**The run state.** *AI Metrics* now writes the `done` state with the run's identity. It merges in `AIP.baseState(p)`, which carries:

- the cycle key;
- the request id;
- the caller.

It also writes `finished_at`, and keeps the options' keys that an earlier attempt of the same run recorded (`extras`).

**When a start is refused.** `AIP.doneRun(st, { cycle, now, rerun })` in `_ai_panel.js` decides. *AI Plan* refuses to open a new run in two
cases:

- The start is a cycle job with the **same cycle key**: the dispatcher retrying the same job. This holds at any hour.
- The start is not a cycle job (on demand, a catch-up, a bare manual start) and the run finished **less than 20 hours ago**
  (`LIMITS.done_fresh_hours`).

A cycle job of another cycle (the next week) still runs. `rerun_today: true` on the trigger asks again on purpose.

**What a refused start does.** The plan item becomes `nothing_to_do` and its reason names the run and when it finished. The ledger row settles
$0, so the dispatcher sees the job as done. An on-demand caller gets a `rejected` callback with:

- `reason: 'already_measured'`;
- `stored_week`: the run id, when it finished, the answers, the named / cited rate, share of voice and score from the stored row;
- a sentence in words;
- `cost_usd: 0`.

The run's own caller is told too. Its report may never have gone out if the run died after the week was stored. The app ignores a rejection
for a request it already completed (`runOutcome`).

**Options paid twice.** The paid options are now idempotent on retry, by the same rule as F2's `asked_keys`:

1. *AI Extra Requests* gives each option request a key (`AIX.extraKey`: `f|<search>`, `p|<role>|<question>`, `d|<task>`).
2. It sends none of the keys this run already recorded (`extrasRecorded`).
3. **Extras Asking State** (new) writes the `done` row with this attempt's keys added.
4. **Save Extras State** upserts that row.
5. **AI Extras Go** (new) lets the requests through, unchanged and in order, only when the saved row came back. Otherwise nothing is paid, and
   the run's notes say why (`extras_note`).

The notes also count what an earlier attempt already sent (`resend_note`).

**Proof** (`scenarios_rengine.js`, R-E1 ×3; `scenarios_g6.js` S203; `scenarios_v5.js` week 2): this is the reviewer's probe on the techand.ai
fixture.

| Start | Before | After |
|---|---|---|
| First start of a cycle job | 35 requests, $0.14 | unchanged |
| Retry of the same cycle job | opened `…_x<exec>` and asked all 35 again | nothing to do, 0 requests |
| Same cycle job, 3 days later | | already measured |
| Next cycle | runs | runs |
| On demand, 2 h after | | `already_measured` notice with the stored week |
| Catch-up, 1 h after | | already measured |
| On demand, 21 h after | | runs |
| `rerun_today` | | runs under its own run id |

For the persona option: a second attempt sends 14 of 24 requests (10 were recorded). A record that cannot be saved means nothing is paid.

## R-E2: exact site scope

`build_monitors.py` has a new `scoped(col, scope)`. It filters with `eq` when the start names the site (or the run) and with `like '%'` only when
it names none. Every one of these filters uses it:

- the tracker's scoped loads;
- *Trim Old Answer Text*;
- *Load AI Run Answers* (`run_id`);
- the scoped `seo_ai_visibility` loads of the AI Pulse, AI Growth, the Backlink Monitor and the Link Builder.

The condition field holds an expression, which n8n resolves through `getNodeParameter('filters.conditions')`. F2.md §5 is corrected.

**Proof** (`scenarios_w2e3.js` R-E2): the generated filters are evaluated under n8n 2.41.4's own semantics (`%…%` wrapping, `_` escaped).

- The old `like site_abc-com` matched `site_abc-com-au` too. The trim now touches `site_abc-com` only, and a start that names no site still
  reaches every site.
- `like ai_20261023_abc-com` matched the run of abc.com.au the same day. The next part of a split run now reads its own run only.
- Each of the four other workflows' loads reads `site_abc-com` only.

One correction to the review: `site_myabc-com` does NOT match `%site_abc-com%`, because of the `site_` prefix. `site_abc-com-au` does.

## R-E3: persona effect paired by question

In `_ai_w2e3.js`, the change is now measured per question:

- **This run:** for each question, d = named with the role minus named without it.
- **Pooled:** for each question, the mean of d over the stored runs of 28 days that asked it on both arms. Repeating the same questions is not
  new evidence.
- **Verdict:** an exact sign test (McNemar for one run) on the questions whose d is not 0, at p < 0.05, and the range must exclude 0.
- **Range:** a seeded bootstrap of the mean d over **questions**.
- **Too few:** under 6 paired questions the verdict is "too few questions".

The per-question answers are kept in `notes_json.persona.by_q` so later weeks can pair. A stored run without them is not pooled, and the method
says so. `persona_effect_json` keeps its exact contract keys (`lo` / `hi` now come from the bootstrap). The report's pooled column gives the
number of paired questions, the runs and p.

**Proof** (`scenarios_rengine.js` R-E3; W2E3-2 updated):

| Case | Old test | New test |
|---|---|---|
| Probe: 7 of 12 vs 4 of 12, one run | | up 3 / down 0, p 0.25, no measurable difference |
| The same pattern four weeks running | 28/48 vs 16/48, z 2.46, "real" | 12 questions, up 3, p 0.25, not significant |
| 9 of 12 vs 1 of 12 | | up 8, p 0.0078, real, range above 0 |

## R-E4 and R-E9: sentiment is an early reading, priced at the measured range

**Labelling.** While `KAPPA.model` is null, `SENT.aggregate` adds `early: true` and `label: 'early reading, not validated'`, and the note opens
with "Early reading, not validated: …". These reach:

- `sentiment_json`;
- the callback's `sentiment`;
- the report heading: "How AI speaks of you, aspect by aspect (early reading, not validated)".

The objections stay in the data with `objections_note`: "phrases the reader picked out … not a finding, and no action is drawn from them". The
report prints them as quoted plain text. The bold "What would make a buyer hesitate" finding is gone. Nothing acts on them: no alert, action or
brief reads `sentiment_json.objections`.

**Price.** `sentiment_call_ai` goes from $0.012 to **$0.02** in both `AIP.FIXED` and `app/shared/src/ai-panel.ts`. The cost kit's Haiku 4.5
prices are $1/M in and $5/M out. A call reads about 6k tokens and answers 2-3k (capped at 4k), so it costs $0.016-0.026.

Two constants were added on both sides:

- `sentiment_call_worst: 0.026`;
- `sentiment_tries: 2` (the agent's retryOnFail).

The report states the cap as the bounded cost: "at most 40 calls a run, about $0.02 a call (about $0.80 at the cap; never more than $2.08,
every call at its longest answer and retried once)". The golden cases (`v5/data/ai_panel_cost_cases.json`) were regenerated with
`harness/ai_panel_cases.js` and copied to the harness and the app by the build. The app tests pass on them.

The quote change at default options is +$0.008 a call:

| Panel | Weekly run |
|---|---|
| 8 questions | $0.282 to $0.29 |
| 50 questions | Sentiment Reader $0.084 to $0.14 |
| 500 questions (cap) | Sentiment Reader $0.48 to $0.80 |

**Owner decisions, not made:**

- `accuracy/eval_sentiment_model.js` (~$0.10) was **not** run: no paid calls on this branch.
- The owner still has to accept the Sentiment Reader as a default-on cost, or switch it to an option.

**Proof** (`scenarios_rengine.js` R-E4/R-E8/R-E5; W2E2-SENT, W2E3-5 updated): end to end through Sentiment Jobs, the reader, AI Metrics, the
report and the callback. A prompt-injection-looking objection is carried as a quoted phrase and is in no action.

## R-E5: the Sentiment Reader counts in the last part's time

- **Planning.** `AIP.TIME.sentiment_call_s` is 30 and `sentiment_tail_s` is 420. *AI Plan* sizes a part that would be the run's last with the
  reader's seconds kept: min(40, calls) × 30 s. When the requests left do not fit beside them, this part is not the last, and the next part (with
  few requests) has the room. The part carries `sentiment_s` and `plan_at`, and its `size_basis` says so. The multi-site time budget subtracts
  it for a site whose run ends there.
- **Backstop.** *Sentiment Jobs* holds the calls to the time actually left: 60 minutes, minus the time since `plan_at`, minus the tail and the
  options' `extra_s`. With none left it makes no call. AI Metrics is told why through a marker on the first job item, never as an item of its
  own, because every item goes to the reader. The week is stored without it.
- **Proof:** 5 / 50 / 59 minutes into the execution give 20 / 5-6 / 0 jobs, with the reason. The 40-call cap costs 1,200 s of a last part's
  budget.

## R-E6: the pulse composition is part of the comparison

*AI Metrics* records the week's pulse in `panel_json.pulse`:

- `mornings`;
- `engines` (the engines that answered);
- `modes` (full / sample).

When both weeks had pulse mornings and the engines or the mode differ, `compare_json` reads `comparable: false` with the reason ("the daily
pulse asks different engines now (ChatGPT then, ChatGPT, Perplexity now) …" or "… changed how it asks"). That comparison is checked after the
rule and engine-set checks and before the panel check. A previous row without the field does not block the comparison: unknown is not
"different".

**Proof** (`scenarios_rengine.js` R-E6):

- Perplexity added to the pulse: not comparable, with the reason.
- The same engines: no pulse reason.
- From full to a rotating sample: not comparable.

## R-E7: bounded tables and loads

- **The pulse's weekly load:** 60 days to **21 days** (`PULSE_VIS_DAYS`). The pulse reads only the latest row per site, and 21 days keeps it
  through two missed weeks. A start that names a site reads that site only (R-E2). A cron morning covers every site whose pulse is on, so it
  still reads every site.
- **Updates and deletes:** n8n 2.41.4's Data Table proxy passes `returnData = true` for update and delete (`data-table-proxy.service.js`), and
  the node has no option to turn that off. So:
  - each one is followed by a Code node that collapses its answer to a count (`Trimmed (AI)`, `Trimmed (Pulse)`, `SERP Cache Pruned (AI)`);
  - the trims touch only rows not trimmed yet (`answer_text isNotEmpty`), so each run changes and returns one window's rows, not the same rows
    every week.
- **Fan-out `serp:` cache rows:** **pruned for the site after 2 days.** A reading counts only on its own day (`SC.lookup`).
  1. *Blank Old SERP Cache (AI)* blanks `value` on the site's `kind=serp` rows older than 2 days. That update answers with small rows.
  2. *Prune Old SERP Cache (AI)* deletes them. That delete also answers with small rows.

  Both run after the options' cache save and before the brief.
- **Not done:**
  - `units_json` pruning: W2-FIX's.
  - A capacity check (table bytes against `N8N_DATA_TABLES_MAX_SIZE_BYTES`): not built. It needs the n8n API's table sizes, which the workflows
    cannot read today. Left open.

## R-E8: sentiment over a sample spread across the week

`SENT.sampleOf(answers, cap, seed)` takes over when more answers name the business than the reader may read. That is the 40-call cap, or the
time left (R-E5). It:

- gives every engine its share of the cap (largest remainder);
- takes a seeded shuffle of the questions inside each engine;
- interleaves the engines across the jobs.

*Sentiment Jobs* uses it and passes `sample` on its jobs. The figures say "Claude Haiku reads a sample of n of the N answers that name you,
spread across the week's questions and engines" and "A sample: n of N … the figures describe that sample".

**Proof:** 1,000 named answers, this part's 800 first. The old cut read 0 of the earlier parts' 200. The new sample reads 157 of the 200 (about
20%), and each engine gets 400.

## R-E10: the speed gate is no longer flaky

W2E2-SPEED now does three things:

- takes the median of 3 runs;
- times a fixed CPU calibration loop (sqrt and sort) in the same process;
- passes when the work is under 2,000 ms, or under 10 calibration loops and 15 s. The intervals pass under 200 ms, or under 1 loop and 2 s.

This machine measured:

| Item | Time |
|---|---|
| The three runs | 758 / 548 / 527 ms |
| Median | 548 ms |
| Intervals | 25-28 ms |
| Calibration loop | 184 ms |
| Ratio | 2.98 loops |

The review measured 2,903 ms. W2-E2.md now records both and says not to read the 681 ms as the cost. Before-and-after does not apply: the gate's
purpose is not to fail at random.

## R-E11: never-deploy runs before anything is touched

**`deploy/gcp/deploy_engine.py`:**

- The manifest is read before the Data Table sync.
- A never_deploy id that is also in the publish set now exits before the sync, with "nothing was touched".
- The deactivation runs before the first workflow update, import or publish. The docstring says so.

**`n8n/deploy/release.mjs`:** `neverDeployPass` runs first, before the credentials, the import and the publish. A failure (a clash, a list that
cannot be read, an unpublish that failed) exits 1 before anything is imported, so "the old one keeps running" is true again.

**Proof:** `never_deploy.mjs --self-test` reads both callers' source and checks the order. It fails on `2ed297ca` and passes now. The harness
copies only `n8n/seo-agent`, so this self-test is not part of the harness count. Run it with
`node n8n/deploy/never_deploy.mjs --self-test`.

**For the owner:** `--apply` deactivates `SEOagentCallback` in production automatically. It is on never_deploy, and PROD_STATE §1 had called
that the owner's decision.

## R-E12: asked state and absent figures

**Asked state.** `AIX.promptState` takes `written`: the questions *Prompt Rows* stored in THIS execution.

- A question written and asked this run gets `last_asked_run` and `asked_n_28d`.
- A writer question refused by the gate this run gets `refused_at_run`.

*AI Prompt State* passes them in. Before, these waited a week, and a refused question never got its state.

**Absent figures.** `seo_ai_visibility.share_of_voice` is stored **null** when no business was named in any answer, and `named_rate` is stored
null when no answer came back (both were 0). These readers now handle null:

- *AI Plan*'s `previous` keeps null (it read `Number(null)` = 0);
- the SOV delta is null when either side is unmeasured;
- *Brief Input* says "not measurable";
- *Site Report* prints "not measurable".

In-memory report tiles keep the old 0 display. The app's `data.ts` `n()` reads null as 0; see the open items.

## R-E13: the Holm family is clustered throughout

The per-engine citation-drop tests and the competitor share-of-voice tests that join the Holm family are now clustered like the headline's two
tests. Their z is divided by the square root of the design effect the run measured: the cited rate's for an engine, the named rate's for a
competitor, or the earlier run's when larger.

Each test records:

- `z_unclustered`;
- `deff`;
- the change in its `why`.

`significant` also needs the clustered |z| ≥ 1.96.

**Proof** (S163, S164 updated):

- S163: ChatGPT 15/30 to 0/30 is still a real drop (z −4.47 unclustered, −2.05 at design effect 4.75), and the alert still fires.
- S164: the two marginal engine drops clear 95% only on the old unclustered z. Clustered they are further inside the noise, and Holm holds all
  three.

## R-E14: notice callbacks are not retried; deploy order

*Post Open Run / Busy / Stop Notices* now make one try. They are on `retry_lint.ALLOW` with the reason: they close the caller's request and are
not idempotent. The harness G1 check covers them, and it fails on `2ed297ca`.

Deploy order (unchanged, for the deployer): the engine first (sync_tables, then the workflows), then the app. These fixes add no Data Table
column.

## Open items and notes for others

- **App, `runs.ts` (W2-FIX):** a `rejected` callback with `reason: 'already_measured'` is recorded as `failed` with the engine's sentence. It
  should be a non-failure stage like `joined_open_run`, so the screen reads "already measured" and shows `stored_week`.
- **App web:** `SentimentPanel2` does not show `sentiment.label`. It should show "early reading, not validated" while `early` is true (the engine
  carries it in `sentiment_json`). The objections list should get the same caveat.
- **App, `data.ts`:** `n(share_of_voice)` turns the new null into 0. It should show "not measurable".
- **Sentiment model:** `accuracy/eval_sentiment_model.js` (~$0.10, a key) is still to run before the label can drop.
- **Capacity check (R-E7):** a check of table bytes against the 1 GiB cap is not built.
- **Hand-off:** these fixes regenerate `workflows/*.json` and `harness/code_v4/**` (not committed). Rebuild in the main worktree with the real
  `n8n/.env` after the merge.
