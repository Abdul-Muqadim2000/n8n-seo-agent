# F1b: the numbers of AI search visibility (2026-10-23)

Fixer F1b of the 2026-10-23 fix wave (`../ENGINE_AUDIT.md`, `../APP_AUDIT.md`). Scope: rates, share of voice, position, visibility score,
deltas and alerts in `AI_Metrics.js`, `Pulse_Metrics.js`, `_ai_stats.js`, `AI_Report.js`, plus the pulse window in `AI_Plan.js` and one
field in `Pulse_Plan.js`. Base `99fdd055`. Not deployed.

Harness: **11064 passed, 0 failed** (baseline 11008). The new scenarios F1B-1 ... F1B-7 (`harness/scenarios_f1b.js`, 56 assertions) were
also run against the generated code of `99fdd055`: every one of them fails or aborts there (25 failed + 4 scenarios aborted, 0 passed).

## Measurement rule `aivis-2026-10-23`

Every figure is computed from ONE list of answers ("units": this run's answers on the weekly engines without the brand question, plus the
pooled pulse answers), read one way by the kit `AVM` in `v5/code/_ai_stats.js` (inlined into AI Metrics, Pulse Metrics, Parse, Apply):

| Figure | Definition | Sample size reported |
|---|---|---|
| named | the answer names the business in its text. Row field `named` (F1a); an older row: `mentioned && (rank > 0 \|\| !cited)` (exact for the old parser, where `mentioned` = named or cited) | answers |
| cited | the answer links one of the business's pages | answers |
| named rate (`named_rate`, and `mention_rate` from this rule on) | named answers / answers x100 | `n` = answers |
| cited rate (`citation_rate`) | cited answers / answers x100 | answers |
| position | 1-based place among the businesses the answer names (self + competitors only). Row field `position` (F1a), else `rank` | |
| avg position (`avg_position`) | mean place over the named answers with a known place; null ("too few answers") under 12 such answers | placed answers |
| named first (`first_rate`) | answers naming the business first / all answers x100; null under 12 answers | answers |
| position-weighted visibility (`pos_visibility`) | mean over answers of 100 x weight(place): 1st 1, 2nd .8, 3rd .65, 4-5th .5, lower .35, named with no known place .6, not named 0; null under 12 answers | answers |
| share of voice | your mentions / (yours + every competitor's) over the answers whose competitors were recorded. Competitors = `entities` with role `competitor` (F1a), else the `competitors` list; one key per business (`brandKey`). Range and test: ratio estimator over ANSWERS (linearised SE), never a binomial over mentions (E19) | `sov_answers` = answers naming anybody; `sov_denominator` = mentions |
| visibility score | demand-weighted mean of the per-answer score: named x weight(place) x (1 if cited else .85); cited only .4 (E7: was .6) | Kish band as before |
| competitor j | named rate, avg position, SOV (its mentions / all mentions, same answers), cited rate (entity `cited`, else its domain among the answer's sources), headline and per engine | answers |

Changes: two-proportion z for named / cited rates; z on the two runs' standard errors for share of voice, score and position
(`AVM.seChange`); under 12 on either side no verdict.

## Findings fixed

- **E6** (High) `AI_Metrics.js:255-272`: segments are built from the same units as the headline; each unit carries its own competitors
  (the pulse now stores them per answer in `detail_json`), so pulse answers count on both sides. For any one dimension the segments add
  back exactly to the headline (`sov_self` / `sov_mentions` stored in `segments_json`). Proof F1B-2: the audit's 76.5% segment vs 44.8%
  headline is now 44.8% in both, and engine / cluster / persona / market / stage each recompute to the headline.
- **E7** (Medium) `_ai_stats.js:9-12` (`answerScore`), `AVM.named`: "Named in" = named. A citation-only answer scores 0.4 (the doc was
  right, the code was wrong). `named_rate` column added; `mention_rate` holds the same figure under this rule. Pulse codes: upper case =
  named first by `position`. The question grid's `won` = named this run. Brand recognition and sentiment read `named`.
- **E13** (Medium) `AI_Metrics.js:515`: the per-engine citation alert uses `like` (same rule, engines, >= 80% question ids, size within
  20%), not the panel size alone. F1B-3: same size, 30% overlap, every engine change `tested: false` with the overlap reason.
- **E14** (Medium) `AI_Plan.js:114-122`: pulse rows pooled only in (previous row's `checked_at`, this run's start]; a split run uses its
  state's `started_at`. The window travels as `pulse_window` and is stored in `compare_json.window`; the pooled pulse run ids in
  `metrics_json.pulse_runs`. F1B-6 replays the audit's Monday-start / Tuesday-pulse case: pooled 0 times in that run, once the next week.
- **E19** (Low) `AI_Metrics.js:457-471, 528-531`: share-of-voice tests (headline and competitor alerts) on per-answer SEs; `sov_ci` is
  the ratio CI. S91's old assertion ("tested on its own denominator of mentions") was rewritten to the E19 rule.
- **E21** (Low) `AI_Report.js:58`: tile "Share among tracked rivals" (AI-answer database, you and N tracked rivals); section heading and
  lineage label renamed.
- **E18 / E20 / E22**: not in these files (Pulse_Plan / Prompt_Rows / _ai_panel fit-gate contexts, comments): left to their owners.
- Pulse share of voice: every competitor, the same definition (was top 8 of the day).

## New engine data for the app (A1, A7, A8)

`compare_json` on `seo_ai_visibility` (`AI_Metrics.js:575-608`), exactly the agreed shape; rates in percent 0-100. Not comparable when:
no previous row ("first run: this week is the baseline"), the previous row's `rule_version` differs ("measurement rule changed: this week
starts a new baseline ..."), the engine set changed, under 80% question-id overlap, or the panel size moved more than 20%. Then every
`delta` / `significant` / `p` is null (`now` / `prev` are kept for display). `significant` / `p` are also null under 12 answers a side.

Comparable (F1B-3):
```json
{"rule_version":"aivis-2026-10-23","comparable":true,"reason":null,"previous_run_id":"ai_prev","previous_at":"2026-10-16T17:01:55.672Z",
 "panel_overlap":1,"engines_same":true,"window":{"from":"2026-10-16T17:01:55.673Z","to":"2026-10-23T17:01:55.545Z","days":7},
 "metrics":{"named_rate":{"now":60,"prev":30,"delta":30,"n_now":40,"n_prev":40,"significant":true,"p":0.006934},
  "cited_rate":{"now":20,"prev":10,"delta":10,"n_now":40,"n_prev":40,"significant":false,"p":0.2113},
  "share_of_voice":{"now":37.5,"prev":30,"delta":7.5,"n_now":40,"n_prev":40,"significant":false,"p":0.200545},
  "visibility_score":{"now":45.2,"prev":30,"delta":15.2,"n_now":40,"n_prev":40,"significant":true,"p":0.029257},
  "avg_position":{"now":1.7,"prev":2,"delta":-0.3,"n_now":24,"n_prev":12,"significant":false,"p":0.085432}}}
```
Rule changed (the first week after this deploy):
```json
{"rule_version":"aivis-2026-10-23","comparable":false,"reason":"measurement rule changed: this week starts a new baseline (from 2026-10-23 \"named in\" counts the answers that name you, not the ones that only cite a page, and share of voice counts every competitor named)",
 "previous_run_id":"ai_prev","previous_at":"2026-10-16T17:01:55.741Z","panel_overlap":1,"engines_same":true,"window":{"from":"2026-10-16T17:01:55.741Z","to":"2026-10-23T17:01:55.545Z","days":7},
 "metrics":{"named_rate":{"now":50,"prev":30,"delta":null,"n_now":40,"n_prev":40,"significant":null,"p":null}, "...": "same pattern for the other four"}}
```
`avg_position`: a negative delta is an improvement. The same object is in the callback at `metrics.compare`; the full tests stay in
`metrics.tests`. The headline delta, segment tests, alerts and competitor deltas all go silent on the same verdict.

Other row fields: `rate_period` (A8, text as before, from the window), `metrics_json` (the counts the next run compares against: named /
cited k,n; sov rate/se/n; position mean/sd/n; score/half/n; per competitor sov/se/n/place; window; pulse run ids; pulse readings left
out), `competitors_json` entries gain `named_rate`, `cited_rate`, `avg_position`, `position_answers`, `sov`, `sov_answers`, `answers`,
`engines{e: {...}}` and `delta {named_rate, sov, avg_position, cited_rate, sov_significant, sov_p, why}` (null when not comparable);
`engines_json` entries gain `named_rate`, `avg_position`, `position_answers`, `first_rate`, `pos_visibility`, `sov`, `sov_answers`,
`enough`; `segments_json` gains `rule_version` and columns `sov_answers, sov_self, sov_mentions, avg_position, position_answers,
first_rate, pos_visibility` (appended; read by name).

Pulse daily row (A7, `Pulse_Metrics.js:85-97`): `rule_version`, `sample_mode` (`full` | `sample`), `questions_asked`, `engines_answered`
(comma list), `partial` (an engine asked returned nothing, or nothing came back), `avg_position`, `detail_json`
(`{v, rule_version, ents: [ids], a: [[prompt_id, engine, named 0/1, cited 0/1, position|null, [[entIdx, position|null, cited 0/1]] | null]]}`),
`readable_json` (`{enough, partial, unavailable, engines_silent, note, min}`). `mentioned` / `mention_rate` count named answers. A baseline
morning of another rule is set aside ("counted under an earlier measurement rule").

## New columns (`ladder_common.py`; `sync_tables.py` adds them on deploy)

- `seo_ai_visibility`: `rule_version` (string), `named_rate` (number), `avg_position` (number), `first_rate` (number),
  `pos_visibility` (number), `rate_period` (string), `compare_json` (string), `metrics_json` (string).
- `seo_ai_daily`: `rule_version` (string), `sample_mode` (string), `questions_asked` (number), `engines_answered` (string),
  `partial` (boolean), `avg_position` (number), `detail_json` (string), `readable_json` (string).
- None on `seo_ai_answers`: F1a owns `named` / `position` / `entities` there (and their pass-through in `Apply_Analysis.js` COLS).

## Contract with F1a

Read defensively: `named` / `position` (booleans, numbers, or the strings a Data Table returns), `entities` as an array or a JSON string;
only `role: 'competitor'` counts toward share of voice. Rows without them fall back to `mentioned` / `rank` / `competitors` as described.
**F1a must add `named`, `position`, `entities` to `Apply_Analysis.js` COLS and to the pulse's answer COLS**, or the weekly run sees the
fallback only (still correct for the old parser's output).

## Files

- `v5/code/_ai_stats.js`: `answerScore` (E7), kit `AVM` (RULE_VERSION, named, position, rivals, ratio, mean, agg, rivalAgg, seChange).
- `v5/code/AI_Metrics.js`: units, headline, per engine, competitors (+ per engine), per question, segments, score, rule check in `like`,
  tests, E13, E19, window, `compare_json`, `metrics_json`, new row fields.
- `v5/code/Pulse_Metrics.js`: per-answer reading, detail, SOV, new daily fields, rule check on the baseline.
- `v5/code/AI_Plan.js` (owned by another fixer for E1; kept minimal): the pulse window (lines 114-122), `pulse_window` on the plan,
  `previous.run_id / rule_version / stats / compare / named_rate / avg_position` (lines 170-174).
- `v5/code/Pulse_Plan.js`: `rule_version` on each baseline day (one field).
- `v5/code/AI_Report.js`: tiles (named, place, named first, position-weighted, share with answers), competitor table, E21, method and
  lineage wording.
- `build_v4.py`: the B8-1 / B8-2 build anchors moved to the new code (`changeOf(cited, samples, cPrev, nPrev)`, the two `AVM.seChange`
  share tests, `scoreBand(U,`, the rule-version guard on the pulse baseline).
- `harness/harness.js`: fixtures written before the rule (no `rule_version` key) on `Load AI Visibility`, `Load AI Daily` and hand-made
  `AI Plan` items are stamped with the current rule, and a pulse row gets the per-answer record its aggregates describe. A row that
  carries `rule_version` (even empty) is untouched, which is how F1B tests the older rule.
- `harness/scenarios_v5.js`: S19 / S27 column lists, S19 report label (E21), S91 share-of-voice test (E19). `harness/scenarios_f1b.js`.
- `AI_VISIBILITY_SPEC.md` §4 / §6: the definitions (doc corrected: share of voice was "top 8"; the 0.4 weight was right).

## Not done

- The app side (A1 / A7 / A8 readers of `compare_json`, `detail_json`, `partial`, `rate_period`): the app fixer's.
- E18, E20, E22 (other files). E3 / E4 / E5 / E8 are F1a's (they change which entities count, not how they are counted).
