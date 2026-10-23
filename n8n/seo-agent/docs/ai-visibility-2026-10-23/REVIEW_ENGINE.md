# Engine review of the AI visibility waves (2026-10-23)

Adversarial review of `git diff 457cb609..2ed297ca -- n8n/ deploy/` on `aivis/integration` (2ed297ca). Read-only: no source edited, nothing
committed, nothing deployed, no paid call. Generated files were read only to check that they match their sources.

## What was run

- **Harness**: a copy of `n8n/seo-agent` without `docs/`, run in `n8nio/n8n:2.41.4` with the given recipe. Result: **11731 passed, 1 failed**,
  exit 1. The failure is `W2E2-SPEED`: 3055 ms against a 2000 ms bar (`run_ms` 2903). See R-E10.
- **Rebuild check**: `build_v4.py --no-env` in a scratch copy of the repo. Every AI-visibility node in `harness/code_v4` (AI_Plan, AI_Metrics,
  AI_Extras, Sentiment_Jobs, Pulse_*, Parse_AI_Answers, ...) came out byte-identical to the committed files. The only differences were in
  nodes that bake `.env` values: the BL / DR / Growth Bing and Ahrefs flags, and the EH alert channels. So the generated code matches its sources.
- **Probes**: two node scripts against `harness/code_v4`, run in the same container:
  - `probe_review.js`, for R-E1;
  - `probe2.js`, for R-E3.
- **n8n 2.41.4 source**, read inside the container, for the Data Table `like` filter (R-E2), the update operation, and the CLI commands
  `never_deploy.mjs` uses (`list:workflow --active=true --onlyId` and `unpublish:workflow` both exist).

**Blocker: none found.** On production's current state the deploy is safe:
- the AI tables are empty;
- `sync_tables.py` runs before any workflow changes;
- `seo_ai_imports` is created lazily, by the tracker's own *Ensure AI Imports Table* (before its load) or by the app;
- every options default is off;
- the dispatcher is in `plan_only`.

There is **1 High**: R-E1, a pay-twice path that this diff widens. The rest are 7 Medium and 6 Low.

---

## R-E1: High. A retry after the week is measured re-runs and re-pays the whole week. W2-E3 puts paid, slow work into that window.

**Where**
- `v5/code/_ai_panel.js:214-220`: `stateVerdict` returns `'closed'` for a `done` state.
- `v5/code/AI_Plan.js:159`: a closed state from today gets a new id, `baseId + '_x' + $execution.id`, and the whole panel is asked again.
- `build_monitors.py:505-510`: the W2-E3 chain runs **after** *Save AI Cache* has written `done`, and **before** the run ledger settles, which
  happens behind *AI Report*. That chain is Prune → Trim → Prompt State → *Run AI Extra Requests* (fan-out up to 200 results pages, persona up to
  84 ChatGPT-API answers with web search, 3 LLM Mentions tasks) → brief → report → PDF.

**Failure.** Suppose the last part dies anywhere in that window. Causes include the 60-minute execution limit, a deploy restart, or an OOM.
1. n8n marks the execution `error` or `canceled`, and its ledger row `cycle:<key>:ai_visibility` stays reserved.
2. The dispatcher (`_cycle.js` `DEAD` set, lines 266-296) treats the job as failed, releases the reservation and starts it again. It does this up
   to 3 attempts.
3. AI Plan sees the `done` state, opens a new run and pays for every question × engine again.

The options' time is modelled as 45 s per batch of 10 persona answers (`AIP.extraSeconds`). The HTTP timeout is 150 s and the in-200 retry adds a
wait and a second send. A slow ChatGPT-API day (9 batches × 150 s ≈ 22 min instead of ≈ 7) is enough to push a large last part past 60 minutes.

**Proof** (`probe_review.js`; techand.ai fixture, 8 questions, a cycle start):

```
first start: run_id ai_20261023_techand-ai prompts 8 est_dfs 0.14
retry of the same cycle job: nothing_to_do false run_id ai_20261023_techand-ai_xtest-exec prompts 8 est_dfs 0.14 chunk.going false done_keys 0
requests the retry would pay for: 35 $0.140
```

At 500 questions × 9 engines that is ≈ $27 per retry, and up to 2 retries.

The behaviour itself is older than this diff: the short brief / report / PDF tail already sat in this window. With every option off, this diff
only adds the Trim update and the Prompt State update. With any option on, it adds minutes of paid network calls.

**Fix** (any one of these closes it; the first is cheapest):
- In AI Plan, refuse a new run when the stored state is `done` and its `cycle.key` equals the incoming `cycle_key`, or for an on-demand start
  when `started_at` is today. Answer `nothing_to_do` with "already measured", so the ledger settles $0 and the job is `done`.
- Or settle the cycle's ledger row, or write a `measured` marker the dispatcher reads, right after *Save AI Visibility*.
- Or run the extras before the `done` state, with their keys recorded in `asked_keys` like the weekly requests.

---

## R-E2: Medium. `site_id like <scope>` is a CONTAINS match in n8n, not an exact one. The F2 / W2-E3 scoping relies on the wrong semantics.

**Where**
- `build_monitors.py:355`: `SITE_SCOPE` / `RUN_SCOPE`, used by every scoped load of the tracker.
- The scoped `seo_ai_visibility` loads of the Pulse, AI Growth, Backlink Monitor and Link Builder (`vis_scoped`).
- `Trim Old Answer Text` (`:456`), an UPDATE.

**Proof.** n8n `dist/modules/data-table/data-table.service.js:425-434`:

```js
if (['like','ilike'].includes(filter.condition)) { ... const valueWithWildcards = transformedValue.includes('%') ? transformedValue : `%${transformedValue}%`;
```

The repository then escapes only `_` and `\`.

So `site_id LIKE '%site_abc-com%'` also matches `site_abc-com-au` and `site_myabc-com`, and `run_id LIKE '%ai_20261023_abc-com%'` matches
`ai_20261023_abc-com-au`. F2.md §5 says this was "checked in the 2.41.4 source (`escapeLikeSpecials`)", but it missed the service-level wrap.

**Impact today**
- **No data leak found.** Every reader re-filters by exact `site_id` / `run_id`: AI Plan, Analyst Jobs, Sentiment Jobs, AI Metrics, AI Prompt
  State, AI Extras, AI Vis Rows, Prompt Rows, Pulse Plan.
- The one unfiltered map, `AI_Vis_Rows` → `AIX.demand` `stored` keyed by `prompt_id`, is safe, because prompt ids hash the site.
- *Trim Old Answer Text* blanks `answer_text` / `retrieved_json` on other matching sites' 35-49-day rows. That is harmless, since their own trim
  would do the same.
- The loads are not bounded to one site, which is the memory goal of E12.
- The next reader that trusts the filter will leak.

**Fix**
- Use `eq` when the start names a site, and a separate unfiltered load (or `like '%'`) only when it names none. An IF before the load, or two load
  nodes, both work.
- Correct F2.md §5.

---

## R-E3: Medium. The persona effect is called "real" purely from repeating the same 12 questions.

**Where**
- `v5/code/_ai_w2e3.js:129` (`verdictOf`, Newcombe interval for two independent proportions).
- `:138-142` (pooling the stored runs of 28 days).

**Problem.**
- The arms are the same 12 questions every run, and the same questions with and without the role.
- The pooled test treats 4 runs × 12 answers as 48 independent answers a side. That is exactly the clustering W2-E2 says inflates significance.
- API answers to the same prompt are highly repeatable.

**Proof** (`probe2.js`, generated kit). The role names the business on 3 more questions out of 12, every week:

```
one run   (7/12 vs 4/12):  {"z":1.23,"delta":25,"lo":-13.2,"hi":54.7,"significant":false,"verdict":"no measurable difference"}
pooled x4 (28/48 vs 16/48): {"z":2.46,"delta":25,"lo":5.1,"hi":42.3,"significant":true,"verdict":"named more often with this role"}
```

A paired question-level test (3 discordant questions, 0 the other way) gives p ≈ 0.25. This verdict goes to `persona_effect_json` and to the
report. The option is off by default.

**Fix**
- Test per question, paired: a McNemar / sign test on discordant questions, or `AVX.prop` / `AVX.ratio` with the question as the cluster.
- Do not pool runs of the same questions as independent samples.

---

## R-E4: Medium. Sentiment from an unmeasured classifier is published as findings.

**Where**
- `v5/code/_ai_sentiment.js:99`: `KAPPA.model: null`.
- `:113-135`.
- `v5/code/AI_Report.js:34-40`, which prints:
  - the aspect table with nets;
  - **bold "What would make a buyer hesitate"** objections;
  - the competitors' nets.

The callback carries `sentiment`. The only caveat is one sentence inside the note or method.

**Problem.**
- W2-E2's own rule: the rule reader "never makes a published figure" because its blind kappa is 0.548 < 0.7.
- The Haiku reader has **no** measured kappa (eval not run, ~$0.10), yet it makes every published figure, on every site, by default.
- The objection text is free model output from untrusted answer text (prompt injection is possible).

**Fix.** Before deploy, run `accuracy/eval_sentiment_model.js` (~$0.10) and write `KAPPA.model`. Until then, either:
- keep `sentiment_json` stored but unpublished, with the report saying "being validated"; or
- print the counts only, without objections or nets.

---

## R-E5: Medium. The Sentiment Reader (on by default) is not in the part's time budget.

**Where**
- `v5/code/_ai_panel.js:274` (`chunkPlan`), which counts analyst jobs (`aj * 30 s`) and the options' `extra_s`, but no sentiment.
- `Sentiment_Jobs.js:8` allows **40 sequential Haiku calls** in the last part.
- `build_monitors.py:441` sets `max_tokens=4000`.

At 20 passages a call (≈ 6k tokens in, ≈ 2-3k out), a call takes about 10-30 s, so 40 calls take ≈ 7-20 min. None of that is reserved.

**Failure.** A large panel's last part (requests sized to fill 40 of 60 minutes) plus the sentiment calls plus the brief / report / PDF can pass 60
minutes. Before `done`:
- the resume re-runs the last part and pays the Sentiment Reader again (up to 40 calls);
- the dispatcher burns an attempt.

No DataForSEO is paid twice here, because the keys are recorded. It also stacks with R-E1 if the overrun lands after `done`.

**Fix.** Add `ceil(named_est / 20) * 20 s` (or the measured seconds per call) to `extra_s` / the last part's budget, or cap the sentiment calls by
the time left.

---

## R-E6: Medium. Changing `ai_pulse_engines` changes the headline's engine mix, but `compare_json` still says "comparable".

**Where**
- `v5/code/AI_Metrics.js:150`: U = the weekly answers plus every pooled pulse answer.
- `:410-427`: `engSet` / `same_kind` / `like` compare the weekly engine set, the question overlap and the panel size. Pulse composition is not
  compared.

**Failure.** The owner adds Perplexity and the AI Overview to the pulse (W2-E3 §2). Perplexity goes from about 1 to about 7 samples per question
a week inside the headline named rate, share of voice and score. The next week's delta is printed and z-tested as a change in visibility, with
`comparable: true`. The same applies when `ai_pulse_mode` / `ai_pulse_per_week` move the pulse between sample and full.

**Fix.**
- Store the pulse engines and sample mode in `metrics_json` / `panel_json`.
- Mark the week "not comparable: the daily pulse asks different engines now" when they differ.

---

## R-E7: Medium. Unbounded Data Table growth against ONE global 1 GiB cap, and heavy loads.

**Where and what**
- **`units_json`** (W2-E2, `_ai_measure.js:308`): about 145 KB per weekly row at 500 × 9. `seo_ai_visibility` is never pruned (W2-E2 open
  item 5).
- **`serp:` cache rows from the fan-out check** (`AI_Extras` → `Save Extras Cache`): one row per new search, up to 20 KB each and up to 200
  searches a week per site. The fan-out searches change weekly, and nothing prunes `kind = serp` anywhere (grepped every builder).
- **W2-E1 answer rows**: about 2.5× bigger. Its own table puts a 500-question site at about 279 MB retained.

**Why this is serious.** `N8N_DATA_TABLES_MAX_SIZE_BYTES` (1 GiB in `compose.prod.yml`) covers **all** Data Tables. When it is reached:
- every insert fails, including `seo_run_ledger`, `seo_cycles` / `seo_cycle_jobs` and `seo_ops_alerts`, so the whole loop stalls, not only AI
  visibility;
- F2's `failed_store` stops AI runs only.

**Heavy loads**
- The pulse cron loads every site's 60 days of `seo_ai_visibility` rows (scope `'%'`, `build_monitors.py:542`), with all the new JSON columns,
  every morning.
- `Trim Old Answer Text` / `Trim Pulse Answer Text` (`:456`, `:564`) are UPDATE nodes that return every changed row into the execution. The
  pulse trim has no site filter.
- The tracker saves all execution data (`saveDataSuccessExecution: all`).

Fine at today's two 10-12-question sites. Not at a few large panels.

**Fix.**
- Prune `units_json` after 60 days (the longest window that reads it), and prune `serp:` rows older than 2 days.
- Add a capacity check (table bytes vs cap) that refuses or alerts before writes start failing.
- Make the pulse load the latest row per site only.

---

## R-E8: Medium. Sentiment over a biased subset once more than 800 answers name the business.

**Where.** `Sentiment_Jobs.js:14` orders the rows as this part's answers first, then the earlier parts' stored rows. `_ai_sentiment.js:113`
(`jobsOf`) takes the first 40 × 20.

**Failure.** On a split run (≥ 8 parts at 500 questions) the net, aspects, objections and rivals are measured mostly on the last part's
questions and engines. They are still reported as the week's sentiment, with a range computed as if the sample were the week. `unread_note`
only gives the count.

**Fix.** Sample the 800 evenly across questions and engines: stratified, or a seeded shuffle by question.

---

## R-E9: Low. Default cost change (Sentiment Reader): verified small and bounded, but under-estimated, and the owner never signed it.

**Model** (`_ai_panel.js:318-321`): named = weekly answers × 50%, calls = min(40, ceil(named / 20)), $0.012 a call. The cases below were
recomputed with the old and new `_ai_panel.js` (default options, prod engine set where stated):

| panel | weekly run before | after | per run | per month (quote) |
|---|---|---|---|---|
| 12 (techand.ai, 6 engines) | $0.35 | $0.374 | +$0.024 (2 calls) | +$0.10 |
| 10 (devaicon.com) | $0.31 | $0.334 | +$0.024 | +$0.11 |
| 50 (default engines) | $1.17 | $1.254 | +$0.084 (7 calls) | +$0.36 |
| 200 | $4.61 | $4.91 | +$0.30 (25 calls) | +$1.30 |
| 500 × 9 engines | $27.86 | $28.34 | +$0.48 (40 calls, cap) | +$2.07 |

**Bounded?** Yes: 40 calls per site per final part. But the per-call price is low:
- input ≈ 20 × (≤ 200-character question + ≤ 900-character passage) + prompt ≈ 6k tokens at $1/M = $0.006;
- output ≈ 2-3k tokens (capped at 4000) at $5/M = $0.010-0.020;
- so ≈ $0.016-0.027 a call, against $0.012 modelled.

The agent node also has `retryOnFail` with maxTries 2, which re-bills a call whose output fails to parse. Worst case: 40 × $0.027 × 2 ≈
$2.2 a run, per attempt. The settle measures the real figure, so only the quote and the reservation are low.

`WAVE2_CONTRACTS.md` says defaults "stay exactly as they are today (cost and behaviour)". This is a default change. Today's actual cost is about
$0, because no answer names techand.ai, but the quote moves.

**Fix.** Set `sentiment_call_ai` to about $0.02 and have the owner accept the default. Or make the reader an option (off) until R-E4 is
settled.

---

## R-E10: Low. The harness gate is flaky: the head run fails `W2E2-SPEED` (3055 ms against 2000).

`harness/scenarios_w2e2.js:85`:
- here, `run_ms` was 2903 (W2-E2.md claims 681 ms);
- the head harness is **11731 / 1**, exit 1, not 11732 / 0;
- a wall-clock bar on a shared laptop or CI runner will fail at random and block the gates;
- it also says the real cost on the e2-medium VM is several times the claim.

**Fix.** Assert the closed-form intervals separately (they took 152 ms), and loosen or ratchet the end-to-end bar, or measure CPU time.

## R-E11: Low. The never-deploy clash check runs after the import and the publish, not "before anything is touched".

**Where.** `deploy/gcp/deploy_engine.py:257` (step 5b, after step 5's publish) and `n8n/deploy/release.mjs:110` (step 4, after the import and
the publish). Both comments claim the opposite.

**Effects**
- A list failure in `release.mjs` now fails a release whose workflows are already imported and published. The message "not published: the
  release fails so the old one keeps running" is then false.
- `--apply` deactivates `SEOagentCallback` in production automatically, although PROD_STATE §1 called that the owner's decision. That is
  acceptable, but tell the owner.

**Fix.** Run the clash check first. Keep the deactivation as is.

## R-E12: Low. Asked state and zeros.

- `_ai_w2e3.js:236` (`promptState`) iterates over `Load AI Prompts` only, so a question the Prompt Writer stored in this run gets no asked state
  until next week. A writer question refused this run never gets `refused_at_run`.
- `AI_Metrics.js:177` / `:656`:
  - `share_of_voice` is stored as `0` when nobody was named (not measurable);
  - `named_rate` is stored as `0` when no answer came back;
  - the contract says an absent figure must not read as 0.

## R-E13: Low. The Holm family mixes clustered and unclustered tests.

The headline named / cited tests are now clustered (W2-E2). The per-engine citation-drop tests (`engineChange`) and the competitor share-of-voice
tests (`AVM.seChange` over answers) are still unclustered. They enter the same Holm family, so engine and competitor alerts fire more easily
than the headline.

## R-E14: Low. Notice callbacks retried, and deploy order.

**Notice callbacks**
- `Post Open Run / Busy / Stop Notices` (`build_monitors.py:425`) POST a `rejected` callback with `retryOnFail` 3.
- `retry_lint.ALLOW` keeps every other customer callback at one try, because "every POST inserts a report".
- A slow 200 followed by a retry can close or record the request twice.

**Deploy order**
- The new app sends `ai_claude_weekly`, `ai_fanout_check` and the rest through Site Admin `monitors`.
- If the app goes out before the engine, the old `Monitor_Row_Admin` drops them silently.
- So deploy the engine (sync_tables + workflows) first, then the app.

---

## Checked and found sound

- **Money**:
  - F2's record-before-pay chain (*AI Asking State* → *Save Asking State* → *AI Requests Go*), the ceiling, and `failed_store` / `blocked` are
    harness-proven.
  - `Run AI Extra Requests` is behind the in-200 gate. The gate re-points every reader to `… Answers`, and there is no node-level retry on the
    paid node.
  - The options are settled once per task id through `AI Extras`. The first part is priced at `prompts_max` (the app's quote, which includes the
    options: `aiOnDemandRunCost` passes `p.options`).
  - With every option off, `AIP.cost` is byte-identical to before except for the Sentiment Reader (R-E9).
- **Columns**: every Data Table writer emits exact `ladder_common` columns (the harness checks `table_cols.json`). The new columns reach
  production through `sync_tables.py`, which `deploy_engine.py` runs before any workflow update and treats as fatal on failure.
  `seo_ai_imports` is created by the tracker's *Ensure* node, before its load, or by the app (same 12 columns and types).
- **Stored shapes**:
  - empty-string / null `seo_monitors` fields fall back to the defaults (`_monitor_sites.js`, both Monitor Row builders);
  - `sources_json` changing from an array to `{v: 2, list}` is read correctly by the app (`data.ts:1147`, `aiLegacySourcesList`);
  - no `ai_run:*`, `ai_brands:*` or prompt rows exist in production, so the id-scheme change (`q_` 64-bit, upsert on site + prompt_id) needs no
    migration.
- **Robustness**: the new loads use `alwaysOutputData` + `continueRegularOutput`. Every new IF has a skip path. The update nodes cannot run
  without a filter, because n8n refuses an update with no condition.
- **Never-deploy**: the n8n 2.41.4 CLI has `list:workflow --active=true --onlyId` and `unpublish:workflow`. `deploy_engine.py` deactivates
  (never deletes) and reports in dry run. `SEOagentAIPilot1` is not in the manifest, so it is not deployed. Nothing else references it.
