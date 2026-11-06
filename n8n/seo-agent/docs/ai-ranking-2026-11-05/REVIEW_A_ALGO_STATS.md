# Review A: AIR algorithm and statistics (2026-11-06)

Independent review of the AI-ranking algorithm (AIR) at commit `77c82704` (read-only snapshot). Scope: `v5/code/_ai_rank_diag.js` (ARD),
`v5/code/_ai_rank_learn.js` (ARL), `v5/code/AI_Rank_Plan.js` (how they are called), their harness scenarios, and the intent in DESIGN.md
parts A-E, G, H, R1_EVIDENCE.md, fixes/P1.md and fixes/P2.md. Line numbers are of that snapshot (`n8n/seo-agent/...`).

Every finding below was reproduced offline in `node:22-bookworm-slim` with the kits loaded exactly as the harness loads them (the
`URL` / `structuredClone` / `Object.defineProperty` sandbox shims of `scenarios_air_learn.js`). No network, no paid call, no code changed.
The reproduction scripts are in the reviewer's scratchpad (`.../scratchpad/air/t_*.js`); each finding states its input and the output seen,
so it can be rebuilt without them. Baseline: `node harness/scenarios_air_learn.js` passes 58 / 0 on the snapshot, so none of this is caught
by the current tests.

## Counts

| Severity | Count | Findings |
|---|---|---|
| Blocker | 1 | RA-1 |
| High | 8 | RA-2 to RA-9 |
| Medium | 7 | RA-10 to RA-16 |
| Low | 2 | RA-17, RA-18 |

What was checked and found sound is listed at the end, so a later reviewer does not redo it.

---

## RA-1 (Blocker): learning never learns, eligibility verdicts never form, and every action is marked "learned" anyway

**Where.** `v5/code/AI_Rank_Plan.js:189` calls `ARL.outcome(act, { ..., diagAtT0: null, ... })`. In `_ai_rank_learn.js:469`
`m0 = diagMap(diagAtT0)` is then an empty map, so the loops at `:474` and `:477` find no starting stage for any cell. `AI_Rank_Plan.js:224`
then sets `learned_at` because `ARL.learnable` (`_ai_rank_learn.js:523-525`) only checks that `stage_moves.by` is an array, and an empty
array passes.

**Failure.** For every action of every site, in every week:
- `stage_moves` is `{ k: 0, n: 0, by: [] }`, so `ARL.learn` emits no prior row. The pooled Beta-binomial learning (DESIGN G4) never moves.
- The action still gets `learned_at`, so even after a fix it is never learned.
- Eligibility steps (L01-L04) are judged only on stage moves (`:506`). With `sn = 0` the verdict is always "can't tell", never "likely
  helped" or "no effect".
- The leading indicators LI1 / LI2 (`:496-499`) read `m0` too, so their "at t0" shares are always null.
- Brier calibration (`:552-557`) reads `stage_moves.cells`, which is always empty.

**Input that triggers it.** Reproduced with an L03 (Bing) action whose two Copilot cells moved S0 -> S1 / S2:
- `diagAtT0: null` (as production) -> verdict `cant_tell`, `by: []`, `learnable: true`, `learn()` returns 0 rows.
- The same action with the real starting stages -> verdict `likely_helped`, 2 of 2 cells moved, `learn()` returns 2 rows.

**Why the obvious fix does not work yet.** The only stored past diagnosis is `seo_ai_rank_runs.diag_json`, and RA-9 shows it is replaced by
`{"trimmed":true}` for a panel of about 20 questions or more. `seo_ai_rank_questions.stage_json` holds only the current week.

**Fix.**
1. When `verify` first finds that an action happened, snapshot the stage of each of its cells (and of its registered controls' cells) from
   this run's `diag` into `verify_json` (for example `stages_at_t0: { "q|engine": "S1" }`). Do the same for the controls, or the background
   `b` cannot be computed either.
2. Have `outcome` build `m0` from that snapshot, and use `diag_json` only as a fallback.
3. Make `learnable` require `stage_moves.n > 0`, so an empty reading never burns `learned_at`.

**Verify.** A harness case that runs `AI_Rank_Plan`'s own outcome path end to end over two weekly runs (verify in week 1, due in week 5)
with a stage move. It must produce a prior row and a non-empty `stage_moves`. A case with no snapshot must leave `learned_at` empty.

---

## RA-2 (High): the control arm empties after 12 weeks and never refills

**Where.** `_ai_rank_diag.js:231-232` (holdout rotation); `AI_Rank_Plan.js:205` writes `arm` and `stratum` but no assignment date.
`ladder_common.py:327` (`AI_RANK_QUESTIONS_COLS`) has no `assigned_at` column. So `at0` falls back to `core_since` (`:231`). That date is
the same for every question of the first core and is kept on renewal (`:165`, `:175`).

**Failure.** Every control question becomes treated in the same week. With a full core (30 questions, `core_max` 30), no new core question
joins, so no fresh slot is ever assigned "control" again. From week 12 on:
- every pre-registration has `controls: []` (`_ai_rank_learn.js:361`);
- every outcome says "no control question was registered" (`:508`);
- no non-eligibility lever can enter learning, because `b_basis` is `none` (`:533`).

DESIGN A6's "new core questions refill the control arm" does not happen with a stable panel.

**Input.** 30 core questions (2 intents x 3 clusters, zero baseline), `assignArms` run each week with the previous output as `stored`:
- weeks 0 to 11: 24 treated, 6 control;
- weeks 12, 13 and 20: 30 treated, 0 control.

(The 6-of-30 control share also shows the 2:1 pattern gives only 1 control in a stratum of 4 or 5, so the control share is 20%, not one in
three.)

**Fix.**
1. Store an `arm_since` column.
2. Rotate one control at a time, and only when a replacement control is assigned in the same stratum (a treated question that received no
   question-specific action in the last two windows). This keeps the control share at or above a floor, for example 1/3.
3. Never rotate a control that is a registered control of an action whose window is still open (see RA-4).

**Verify.** The weekly simulation above for 52 weeks must keep at least `floor(30/3)` controls in every week, and no open action's
registered control may become treated before that action's window ends.

---

## RA-3 (High): the DiD range ignores question-level variance; false "likely helped" is 13% to 19% for single-question actions

**Where.** `_ai_rank_learn.js:430-444` (`didOf`) calls `AVX.impact` (`_ai_measure.js:159-193`). The bootstrap resamples questions within
each arm, then draws each question's answers as independent binomials at that question's own rate.

**Failure.** Own page, refresh, passage fix and correction (L05, L06, L07, L15) always carry exactly one question (`ref.prompt_id`). With one
treated question, resampling questions does nothing for the treated arm. Its change from before to after varies only by binomial noise.
Two things the range leaves out:
- the question's own drift between periods (an engine changing its answer for that question);
- the correlation between answers to one question (ARD's own MDE assumes rho 0.3, R1 section 6 says the question is the unit).

R1 section 6 asks for "bootstrap intervals that resample whole queries". With one query there is nothing to resample. The harness
(`scenarios_air_learn.js:242-265`) tests only 16 treated vs 8 control questions with independent answers, which hides this.

**Input.** 1 treated question vs 10 registered controls (AVX keeps 3), 3 engines daily, 28 days before and after, no treatment effect,
`ARL.outcome` with `B = 400`, 200 seeded panels per row:

| Null model | False "likely helped" |
|---|---|
| answers independent, fixed rate per question (the harness's model), 16 / 8 | 2.0% |
| same, 1 / 10 | 2.0% |
| each question's rate shifts by N(0, 0.10) between periods, 1 / 10 | 13.5% |
| each question's rate shifts by N(0, 0.05), 1 / 10 | 4.0% |
| sticky answers (each question x engine keeps its answer, 5% daily chance to redraw), 1 / 10 | 19.0% |
| sticky answers, 10% daily redraw, 1 / 10 | 14.0% |
| sticky answers, 3 / 10 | 6.0% |
| sticky answers, 16 / 8 | 2.5% |

The nominal rate of "95% range above 0" is 2.5%.

**Fix.**
1. Estimate the variance of a question's change from the spread of the control questions' own changes (between-question variance of
   before-to-after differences) and apply it to both arms: `Var(DiD) = s2_delta x (1/T + 1/C)`, with a t reference on C - 1 degrees of
   freedom. Or use a permutation test that ranks the treated question's change among the controls' changes.
2. Say plainly that one question against 10 controls cannot reach 5%. Judge question-level levers pooled per lever across actions (and
   sites), not one action at a time.

**Verify.** Re-run the table. Every null row must stay at or below 5%, and the +25 point injected lift on 16 / 8 must still be found in
at least 90% of panels.

---

## RA-4 (High): control questions are treated by page-level and community levers, then still used as controls; overlapping actions count the same move twice

**Where.**
- Candidates: `_ai_rank_learn.js:253-269` (L08, L09, L10 from the source graph), `:270-271` (L13, L14) and `:230-232` (L02, L04) take
  every question the page or source covers, control questions included.
- The control refusal applies only to `scope === 'question'` (`:244`, `choose` `:327`).
- `prereg` (`:361`) removes from a new action's controls only the questions that action itself touches. No other action's exposure is
  checked, now or later.

**Failure.**
1. **Bias toward zero.** A list placement (L08) on a page cited for control questions c1 and c2 treats them. In the same week a refresh
   (L06) on q1 registers c1, c2, c3 as its controls. If the placement works, c1 and c2 move, the L06 DiD is pulled toward zero, and the
   stage-move background `b` rises, so L06's learning is biased low.
2. **Uneven site-wide steps.** L13 and L14 are classed site-wide, so they get no control and are not learned (`:130`). But their cells are
   only the questions whose sources are threads or videos, so they move specific control questions, not all questions equally.
3. **Double counting.** L08 and L06 both list cell q1 x engine. When learning works (RA-1), one stage move of q1 is learned as a success for
   both levers. Nothing de-duplicates cells across actions.

A uniform site-wide step (Bing, PR) affects both arms equally and does not bias the DiD. The problem is levers that are targeted in effect
but not treated as question-specific.

**Input.** Questions q1, q2, q3 treated and c1, c2, c3 control, all at S1 on three engines. A listicle with a contact cites q1, c1 and c2.
A forum thread cites c3. `candidates` + `score` + `choose` (shadow mode) give:
- `L08 (list) questions c1,c2,q1 | prereg controls c3`
- `L06 (q1) questions q1 | prereg controls c1,c2,c3`

**Fix.**
1. Keep an exposure ledger per question with action id, lever and t0.
2. A question exposed to any action whose window overlaps is dropped from every other action's controls at outcome time. Record this in the
   outcome, never by editing the pre-registration.
3. Either refuse L02, L04, L08, L09, L10, L13 and L14 cells on control questions, or (DESIGN A6) count them as exposure and exclude them
   from all controls while exposed.
4. In `learn`, give each question x engine move to at most one action per window. The earliest t0 wins; the others are marked
   "overlapping, not learned".

**Verify.** With the input above, L06's DiD controls must be `c3` only, and learning two overlapping actions on the same moved cell must
add one success, not two.

---

## RA-5 (High): capping successes and failures separately pulls every site's contribution toward 50%

**Where.** `_ai_rank_learn.js:544`: `A += Math.min(10, s.k); Bt += Math.min(10, s.f)` (also `:191` in `priorOf` and `:547`). This is the
DESIGN G4 formula, implemented as written. The design itself is wrong here.

**Failure.** Each cap is applied on its own, so the cap changes the site's rate as well as its weight. A site with 12 successes in 300
cells (4%) adds 10 successes and 10 failures (50%) to the pool. Its true rate is 4%, but it teaches every other site that the lever works
half the time.

**Input.** One site, 30 L06 outcomes of 10 cells each at S1 / google, 12 cells reached the target, `b = 0`:
- global row: alpha 11.5, beta 14.5, mean 0.442 (the evidence prior is 0.25);
- site B, with no data of its own, now plans L06 with p 0.442;
- the site's own posterior is 0.044.

**Fix.** Cap the site's total weight and keep its rate: `w = min(1, 20 / (k + f))`, then add `w x k` and `w x f`. Better still, a
hierarchical (random-effects) Beta-binomial over sites, as R1 section 6 item 6 suggests.

**Verify.** With the input above the global mean must stay between the evidence prior and 0.04 (near 0.08 with the rate-preserving cap),
never above 0.25.

---

## RA-6 (High): cells of one action are learned as independent trials; one placement on one site moves the prior of every site

**Where.** `_ai_rank_learn.js:533-535`. Each `by` group's `n` cells (question x engine) become `n` Bernoulli trials. One action touches
many correlated cells: one list update names the client on every question and engine that cites the list, and the three Google engines
(`ai_overview`, `ai_mode`, `gemini`) are one group.

**Failure.** The cap of 10 is larger than any evidence pseudo-count (`n0` is 3 to 10), so a single event dominates the pool.

**Input.**
- One L08 outcome on site A, S1 / google, 30 cells all moved, `b = 0`: site B's L08 prior moves from 0.06 (90% range 0.0002 to 0.227) to
  0.582 (0.390 to 0.763).
- With one question x 3 Google engines (3 cells, one event): 0.06 -> 0.316.

After that, L08 dominates choice on every site (score is linear in p).

**Fix.** Learn at the action level: per action and group, one trial with outcome `k_adj / n` (fractional), or count questions rather than
question x engine cells. Cap a site's total weight as in RA-5.

**Verify.** One action of 30 moved cells must move another site's prior by no more than one pseudo-outcome of weight, for example 0.06 ->
about 0.16 with `n0 = 8`.

---

## RA-7 (High): a re-chosen action reuses its first pre-registration; going from shadow to on expires actions at once

**Where.**
- `AI_Rank_Plan.js:213-217` rewrites a chosen action over the stored row with the same `action_id`. It keeps `prereg_json` and
  `created_at` from that row (`S0(st.prereg_json) || ...`).
- `action_id` is deterministic per site, lever and ref (`_ai_rank_flags.js`, `actionId`).
- `ARL.choose` treats rows in `shadow`, `expired` and `not_happened` as not open (`_ai_rank_learn.js:316-317`), so the same id is chosen
  again.
- `ARL.verify` times expiry from `registered_at` (`:378-381`).

**Failure.**
1. In shadow, a placement chosen every week since week 1 keeps week 1's registration. When the owner switches the site to `on`, the row
   becomes `queued` with a registration weeks old. The next run's verify says `expired: true`, the outcome says `not_happened`, and the row
   is closed. This happens for every long-standing shadow action at once.
2. An action closed as `expired` or `not_happened` is chosen again with the same id and the same old registration. It is closed again at
   the next run. The site is shown a step that cycles between queued and "did not happen" every other week and never gets a window.
3. Its baseline (`prereg.baseline`) and controls are those of the first registration, not of the new attempt.

**Input.** L08 action, `prereg.registered_at` 2026-09-01, window 30; site switched to `on` 2026-11-06; verify on 2026-11-13 with the list
not yet naming the client:
- `{ happened: false, expired: true, why: "not verified within the window + 14 days" }`;
- outcome `not_happened`;
- `choose` with that row stored as `not_happened` picks the same `action_id` again.

**Fix.** A new attempt must be a new registration:
- either add an attempt number to the action id;
- or keep `prereg_json` only while the stored row is in an open, non-shadow status, and register afresh otherwise.

A shadow row must never carry its registration into `on`. Keep the old attempts as history rows.

**Verify.** Shadow for 8 weeks, then on: the first `on` row must carry `registered_at` of the switch week and must not expire before
window + 14 days. A `not_happened` action chosen again must get a new `registered_at` and a new baseline.

---

## RA-8 (High): the placebo in time is almost never computable, and long windows lose their before-period

**Where.** `AI_Rank_Plan.js:116-117` builds `units60` from 60 days of history. The outcome is read once, at the first weekly run after
`t0 + window` (the row then leaves the open statuses, `AI_Rank_Plan.js:221`). The DiD needs `[t0 - 28, t0 + window]`, and the placebo
needs `[t0 - window - 28, t0]` (`_ai_rank_learn.js:491-492`). fixes/P2.md section 3 states the limit. P4 did not lift it.

**Failure.**
- The placebo needs `2 x window + 28` days, at least 84, so it is null in nearly every case. When it is computed (window 28, run lag under
  4 days), its before-period holds 0 to 4 days. DESIGN G3 test 2, the only guard against questions that were already moving, is in effect
  off.
- For windows above 32 days the DiD's own before-period is cut: L05, L09 and L14 (45 days) keep 15 days or fewer. For L10 (60 days) it is
  empty, so its DiD can never be read.
- The first-appearance test (`:445-453`) has the same before-window and the same truncation.

**Input.** 4 treated and 10 control questions, 3 engines daily, 60 days of answers, outcome at `t0 + window + lag`:

| Lever, window, lag | Before answers (treated) | Placebo |
|---|---|---|
| L08, 30, 0 | 336 | null (no answers before) |
| L07, 28, 0 | 336 | computed on 4 days before |
| L07, 28, 6 | 312 | null |
| L05, 45, 0 / 6 | 180 / 108 | null |
| L10, 60, 0 / 6 | 0 (DiD null) | null |

**Fix.** Load `max over open actions of (2 x window + 28)` days of history for the outcome step, at least 148 days for L10. Or store the
per-question before-period counts (and the placebo-period counts) in `verify_json` when the action is first verified. Report "placebo not
computable" as a reason in the verdict, not silently.

**Verify.** With 150 days of synthetic history, the AL7 pre-trend case must turn "likely helped" into "can't tell" through
`AI_Rank_Plan`'s own call, and L10's DiD must be computed.

---

## RA-9 (High): for a panel of about 20 questions or more, the stored diagnosis is trimmed, so the weekly memo always says "first reading"

**Where.** `AI_Rank_Rows.js:34` replaces `diag_json` first when the run row passes 60,000 characters, with
`{"trimmed":true,"chars":N}`. `AI_Rank_Plan.js:199` passes `P(prevRun.diag_json, [])` as `diagPrev`. `diagMap` (`_ai_rank_learn.js:425`)
turns a non-array object into an empty map, so memo part 1 (`:573`) prints "This is the first reading", part 2 has nothing to explain, and
part 6's "held 2 weeks" check (`:612`) cannot run.

**Input.** A synthetic panel through `ARD.diagnose` (8 engines, evidence, fan-out, cited pages):
- 30 questions -> `diag_json` 87,412 characters (above the limit on its own);
- 12 questions -> 35,281 characters, which leaves under 25,000 characters for the panel, candidates (up to 60), sources (up to 60),
  memo and learn columns of the same row. About 3,000 characters per question means about 20 questions fill the row on their own.

Memo with `diagPrev = {"trimmed":true}` -> "This is the first reading: there is no week before to compare with."

This also blocks the obvious RA-1 fix (reading `diagAtT0` from the run rows).

**Fix.** Store a compact stage map per run (for example `stages_json: { prompt_id: { engine: "S2" } }`, about 30 x 8 x 12 characters) in
its own column, or in `seo_ai_rank_questions` as a short weekly history. Read it for `diagPrev` (and `diagAtT0`), never the full diagnosis.

**Verify.** A 30-question two-week run must print stage counts against last week and list the moved cells.

---

## RA-10 (Medium): two sites learning the same key in one run overwrite each other's global row

**Where.** `AI_Rank_Plan.js:191` calls `ARL.learn` once per site inside the site loop, each time with `rpAll` as loaded at the start of the
run. `_ai_rank_learn.js:537-546` rebuilds the global row from those stale rows plus this site's outcomes only. Both global rows carry the
same `prior_id`, and the upsert keeps the last one.

**Input.** In one run, site A learns 6 of 6 and site B 0 of 6 on L06 / S1 / google, from empty priors:
- A's global row is 7.5 / 4.5 and B's is 1.5 / 10.5;
- learned together it would be 7.5 / 10.5;
- with B's row kept: site C plans with 0.125 instead of 0.417, and site A with 0.375 instead of 0.453.

It heals only when that key is learned again.

**Fix.** Learn once per run over every site's outcomes (move `ARL.learn` after the site loop), or emit only site rows from the loop and
rebuild every touched global row once at the end.

**Verify.** The input above, run through the plan's loop, must store a global row of 7.5 / 10.5.

---

## RA-11 (Medium): the memo's "what we can detect" describes a test that is never run

**Where.**
- `AI_Rank_Plan.js:144-148`: the MDE uses all treated vs all control questions of the panel.
- `m` is the mean number of answers per question over 60 days (`:145-146`), while the formula and basis say "per 4-week period"
  (`_ai_rank_diag.js:262`).
- `p` is the named share over every unit of 60 days, brand and non-core questions included (`:147`).
- Memo part 3 (`_ai_rank_learn.js:590-594`).

**Failure.** Every lift test is run per action, on one question for L05-L07 and L15, and on a few for L08-L10. So:
- The memo promises "a change of about 19 points can be shown" (20 treated / 10 control, m 28, p 0.05). The test actually run on a
  one-question action needs about 52 points (`ARD.mde({q_t:1, q_c:10, m:28, p:0.05})` -> did 51.6).
- The first-appearance line ("about 7 must name you for the first time") refers to the whole arm. A one-question action can never reach
  p < 0.05 unless at least 20 zero-baseline controls exist (`firstK(1, 10)` -> none; Fisher 1 of 1 vs 0 of 10 = 0.091). The core holds at
  most about 10.
- Measuring `m` over 60 days moves the figure only slightly (19.1 -> 18.7 points), but the basis string is wrong.
- Including the brand question, which names the client often, raises `p` and the MDE.

**Fix.**
1. Print the MDE for the test that is actually run: the typical action size per lever (1 question for own pages), with its first-appearance
   requirement.
2. Print separately the whole-panel figure, for a pooled lever-level test, if that test is added (see RA-3).
3. Compute `m` per 28 days and `p` over core non-brand questions.

**Verify.** For a 30-question panel the memo must show the one-question figure (about 50 points at p 0.05) beside any panel figure, and
the basis must say 28 days.

---

## RA-12 (Medium): no control of multiple testing across actions; two different alphas

**Where.** `_ai_rank_learn.js:509-519`. Each action is judged alone:
- DiD "likely helped" when the 95% range is above 0 (2.5% one-sided);
- Fisher "likely helped" at one-sided p < 0.05;
- plus LI4, a second DiD (`:500`).

The memo lists every verdict (`:604-608`) with no adjustment and no note.

**Failure.** The replay in fixes/P2.md shows 8 to 10 chosen actions a week per site, about 4 to 7 of them with a control test (own page,
passage fix, placements, directory, registry). Over 12 weeks, at the nominal 2.5%, the chance of at least one false "likely helped" per site
is about 1 - 0.975^48, about 70%. At the realistic per-test rates of RA-3 (13% to 19%) it is near certain. The Fisher test uses twice the
DiD's one-sided alpha, so the primary test depends on the baseline, not on a pre-registered rule.

**Fix.**
- Use one alpha for both tests (one-sided 0.025, or two-sided 0.05 for both).
- Control the false discovery rate across the actions judged in a quarter (Benjamini-Hochberg on the per-action p values; `didOf`
  already returns `p`).
- Say in the memo how many actions were judged and how many "likely helped" would be expected by chance.

**Verify.** 50 null actions (RA-3's sticky model, after the RA-3 fix) judged in one quarter must give on average no more than 1 "likely
helped".

---

## RA-13 (Medium): the Google ranking proxy ignores the country and the site of the results page

**Where.**
- `AI_Rank_Plan.js:54-57` builds one `serp` map keyed by keyword only. It is loaded from every site's `seo_cache serp:*` rows
  (`ai_rank_wiring.py:95`, `kind = serp`, no site filter), and the latest reading wins, whatever its `location_code`.
- `ARD.diagnose`'s `rankIn('google')` (`_ai_rank_diag.js:440-443`) never looks at the location.

The cache key itself does carry the location (`_serp_cache.js:24`), so several countries' readings of one keyword coexist.

**Failure.** A UAE question can be given S2 (proxy_rank) "ranks 3" from a US results page, or from another client's reading in another
country. That stage drives the choice between L05 and L06 (`hasPage`) and the S1 / S2 basis.

**Input.** A UAE site (`location_code 2784`), question market `AE-en`, 5 AI Mode answers that do not name the client, and a SERP entry for
the keyword read at `location_code 2840` (US) with the client at position 3: `ai_mode` is S2, basis `proxy_rank`, evidence
"serp ... pos 3".

**Fix.** Key the map by keyword and location (and language), and pass the site's market location to ARD. Accept only a reading of the
question's market. Otherwise the basis is `unknown_index`.

**Verify.** The input above must give S1 / `unknown_index`. With a 2784 reading added, it must give S2.

---

## RA-14 (Medium): AIR's own actions are never screened against the refused tactics

**Where.** `REFUSED` (`_ai_rank_learn.js:116-123`) is used only in `compareOld` (`:637-638`), on the old logic's plan. `choose` (`:323-329`)
refuses only `ZERO_WEIGHT` levers and candidates marked `refused`.

**Failure.** Take an own answer page (L05) for a recommendation question whose keyword and fan-outs are "best ... companies in <city>"
(the typical list-dominated case). It is sent to the writer as an `ai_targets` row with that keyword and those fan-outs
(`AI_Rank_Plan.js:243-246`). That is exactly the self-ranked "best X" page R01 refuses (E26: the self-promoter is left out 69% to 83% of
the time). The only guard is the `why` text and halving the chance on list-dominated questions (`:239-243`), which lowers the score but does
not stop the page. The R01 pattern matches such a keyword ("best erp partners dubai").

Whether the writer then produces a self-ranked list was not tested (it needs a paid page run). The gap proven here is that nothing in AIR
checks.

**Fix.** Before a chosen own-page action is written to the sink:
- run the R01 / R02 patterns on its keyword, question and fan-outs;
- on a match, carry an explicit page type ("honest comparison" or "cost guide") and a "no self-ranked list" instruction in the target row,
  or refuse the action with R01's reason.

**Verify.** A chosen L05 on a list-dominated "best X companies" question must either carry the non-list page type or appear in
`refused` with R01's reason.

---

## RA-15 (Medium): answers given from memory earn gain for steps that cannot reach them inside their window

**Where.** `_ai_rank_learn.js:197-198` lets L11, L12 and L17 act on `no_search` engines (`LONG_RUN`, `:132`). `score` (`:289-305`) applies no
time discount for those cells.

**Failure.** R1 section 2 says a mention earned today reaches a no-search answer only after the next training cutoff and release, 6 to 18
months, and "cannot be the near-term lever". L12's window is 21 days (`days [7, 21, 45]`) and L11's 60. Yet a no-search ChatGPT cell gives
each the same gain as a searched cell (input: one recommendation question, `no_search: ['chatgpt']`, S1, V 1, F 0.5 -> L11 gain 0.00108,
L12 gain 0.00108). This inflates the site-wide steps over the levers that can act within the window.

**Fix.** For a `no_search` cell, discount the cell's gain as if its time to effect were at least 180 days: multiply it by
`(1 + days_typ / 60) / (1 + 180 / 60)`, which is 0.5 for L11 (L17, a training-data lever, takes the same discount). Leave L12 out for
those cells, since R1 gives LinkedIn a search-citation route only.

**Verify.** The same input must give L12 zero gain on the no-search cell and L11 half its current gain there (0.00054).

---

## RA-16 (Medium): actions expire before their lever's own time to effect, so late real successes read "did not happen"

**Where.**
- Expiry is `window + 14` days from registration (`_ai_rank_learn.js:380`; `AI_Rank_Plan.js:225-228`).
- The window is `max(28, days_typ)` (`_ai_rank_learn.js:363`).
- The levers' own maxima: L08 `[14, 30, 90]`, L10 `[30, 60, 120]`, L09 `[14, 45, 90]` (`:103-105`).

**Failure.** A list that adds the client on day 50 (inside L08's 90-day range) is already `expired` at day 44, closed and never verified
again. The memo shows "did not happen" for a placement that happened, and the outcome is lost to learning and calibration. The clock also
starts at registration, not when the pitch is sent.

**Fix.** Expire at `registered_at + days_max + 14` (or from the send date for L08), and keep `window` for the outcome only.

**Verify.** An L08 registered 50 days ago whose list now names the client must be verified, not expired.

---

## RA-17 (Low): two cited pages on one directory host collapse into one candidate, and the second page's questions are dropped

**Where.** `_ai_rank_learn.js:264`: a known directory host gives `ref = { listing_id }`, so the `action_id` is the same for every page of
that host. `add` (`:219`) drops a candidate whose id was already seen. The URL sort order (`:252`) decides which page survives.

**Input.** `clutch.co/ae/it-services` cited for q1 and `clutch.co/ae/developers/erp` cited for q2 -> one L09 candidate, questions `q2` only.
q1's cells never count toward the profile's gain or its outcome.

**Fix.** Merge the cells of every page with the same `listing_id` into one candidate (a single profile serves all of them), keeping all
page URLs.

**Verify.** The input above must give one L09 candidate with questions q1 and q2.

---

## RA-18 (Low): the answer-level binomial check treats correlated answers as independent

**Where.** `_ai_rank_learn.js:452`, `p_binom = binomUpper(T.x, tot, T.m / (T.m + C.m))`, stored in `outcome_json`.

**Failure.** Answers to one question are correlated (RA-3), so this p is far too small. In AL8 it is below 0.01 where the question-level
Fisher test gives 0.033. It does not drive the verdict, but it is stored beside it and reads like stronger evidence.

**Fix.** Drop it, or label it "answers counted as independent: not a valid test", or compute it on questions.

**Verify.** `outcome_json.first_appearance` carries no unlabelled answer-level p.

---

## Checked and found sound

- **Formulas, recomputed.**
  - The Fisher one-sided tail: 7 of 16 vs 0 of 8 = 0.033054, equal to C(16,7) / C(24,7).
  - `binomUpper(3, 10, 0.2)` = 0.32220 (exact).
  - `firstK`: 7 for 20 / 10 (p 0.038). P2 rightly corrected DESIGN's 6.
  - Both MDE functions reproduce R1 section 6 (40 / 40, m 28, p 0.02 -> 5.0 and 7.1 points).
  - Beta quantiles checked against a numeric integral for a < 1 (Beta(0.09, 2.91), Beta(0.48, 7.52), Beta(0.2, 0.6)) and above 1: the CDF
    at the returned quantile is 0.0500 / 0.9500.
- **DiD unit.** For several treated questions, the AVX bootstrap does resample questions (the right unit). The defect is the
  one-question case and the missing period-level variance (RA-3), not the resampling itself.
- **Uniform site-wide steps** (Bing, PR, LinkedIn) do not bias a question-level action's DiD: they touch both arms. The leak is the
  targeted page-level and community levers (RA-4).
- **Lever choice vs R1.** Eligibility first (S0 cells take only L01-L04 or off-site levers), own pages need ranking (the `rankChance`
  scaling), lists before directories in effect size, schema and llms.txt at weight 0, L17 gated on 3 verified earned mentions. The refused
  tactics are never chosen as levers (none is in `LEVERS`). The gap is screening own-page content (RA-14).
- **Hosts.** `www.` and case are stripped in `ARD.hostOf0`, `ARL.hostOf` and `AIRF.urlKey`. Subdomains of the client count as the client.
  The client's own pages are classed before the rival test, so the client in a rival list is never a rival page.
- **Provisional S0 / S1** (P1's deviation): an unasked engine with an eligibility fact gives a provisional S0 with `asked: false` and never
  moves `best_stage`. 1-3 answers with a named client fall back to `unmeasured`, never to a provisional S1. ARL's 0.8 factor applies only
  to provisional cells.
- **Robustness.** Numbers and booleans stored as strings are read through `num` / `N` / `flag` / `parse` on the paths fed by Data Tables.
  The units come from `AVX.unpackUnits` / `pulseUnits` as real booleans. Empty panels, a prompt with no answers and a retired treated or
  control question degrade to "unmeasured" or "can't tell" without a throw.
- **Sandbox and determinism.** No `URL`, `Object.defineProperty`, `setPrototypeOf`, `structuredClone`, `Math.random` or `Date.now` in the
  kits. The only clock is `AI_Rank_Plan.js:27`, passed down as `now`. The bootstrap is seeded by action id. `choose` breaks ties by
  `action_id`.
