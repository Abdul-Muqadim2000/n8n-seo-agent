# FX-A: the AIR algorithm and statistics fixes (2026-11-06)

Branch `air/fxa`, based on `77c82704`. Input: `REVIEW_A_ALGO_STATS.md` (RA-1 to RA-18). Nothing was pushed or deployed. No paid call was made, and production was not touched.

## 1. What changed, finding by finding

Every check named below is in `harness/scenarios_air_fxa.js` (FXA-1 to FXA-18, 34 checks). It runs in the full harness and on its own. The FAIL-on-old column is section 3.

| Finding | Root cause | Fix | Check | Status |
|---|---|---|---|---|
| **RA-1** (Blocker) learning never learns | `AI_Rank_Plan` passed `diagAtT0: null`, and `learnable` accepted an empty `by` | The first time verify finds the action done, the plan freezes a **t0 snapshot** in `verify_json.t0_snapshot` (`ARL.snapshotT0`). It holds the stages of the action's questions and registered controls, taken from the latest stored reading at or before t0 (within 14 days). If no such reading exists, it takes this run's reading and labels it. It also holds the answer counts before t0. `outcome` reads the stages from the snapshot. The fallback for an action verified before this fix is the reading on file at its start, never this week's. `learnable` needs `stage_moves.n > 0`. `outcome` now gets `verified: v`, so on the first run it no longer reads "not happened" with status `verified`. | FXA-1 (three checks through the plan's own code, over weeks 0, 1 and 5) | Fixed |
| **RA-2** the control arm empties after 12 weeks | No assignment date was stored. Every control fell back to the same `core_since` and rotated in the same week. Nothing refilled them, and the 2:1 pattern gave 20%. | New column `seo_ai_rank_questions.arm_since`. `ARD.assignArms`: the control target is floor(N/3) across the panel. Each stratum gets floor(n/3), and the remainder goes to the largest fractions. A control rotates only when a replacement is swapped in within its stratum: a treated question that no executed step worked on in the last two windows (`exposed`). Rotation is one per stratum per run. A registered control of an open action never rotates (`locked`). A stratum under target is refilled. | FXA-2 (52-week simulation: min 10 controls, 38 rotations, 0 lock violations; a legacy all-treated panel is refilled to 10; a first core rotates 6 in week 12) + AD4 / AD14 updated | Fixed |
| **RA-3** the DiD ignores question-level variance | The AVX bootstrap resamples answers within a single treated question | `ARL.qDid`, a **question-level t test**. Each question's change is (rate after) − (rate before). DiD = mean(treated) − mean(controls). Var = s²(1/T + 1/C), where s² is the spread of the questions' own changes (pooled; with one question, the controls' spread alone). The test uses t on T+C−2 (or C−1) degrees of freedom, with the binomial noise of the counts as a floor. One worked-on question needs at least 4 held-back questions, and any other action needs at least 3. `didOf` (the AVX path) is still exported, but no verdict uses it. | FXA-3: false "likely helped" in 200 null panels: sticky 1/10 2.5%, sticky 10% 1/10 2.5%, drift N(0,.10) 1/10 2.5%, sticky 3/10 3.5%, drift 3/10 3.5%, sticky 16/8 3.5%, independent 16/8 0.5% (was 13.5% to 19%). +25 points on 16/8 is found in 98.3%. | Fixed |
| **RA-4** controls contaminated; double learning | Page-level and community levers touched control questions. Only the action's own questions were excluded, and cells were not deduplicated across actions. | **Choice: exposure, plus an interrupted time series for the uniform site-wide steps.** Keeping a control set that a site-wide step cannot touch is impossible, because a Bing submission or an earned mention reaches every question. An **exposure ledger** in the plan records every executed (`on`) non-uniform action with its questions, from registration to the end of its window. At registration (`prereg`, which also covers this week's earlier choices) and again at outcome time, a control another step works on is left out. It is recorded in `controls_dropped`, and the registration is never edited. **L13 and L14 are targeted in effect.** They are now scope `page` and get controls, are judged by DiD, and are learnable. The uniform site-wide steps (L11, L12, L17) are judged by an **interrupted time series**: each question's change after t0 minus its own pre-trend, 2×(second half − first half of the 28 days before), t on Q−1 degrees of freedom. They are never learned. `learn` deduplicates through `claimCells`: a cell moves one action per overlapping window, the earliest t0 wins, and the rest is recorded as `learn_overlap`. | FXA-4 (the review's own case: controls c3 only; one success, not two; L13 controls; L11 ITS) | Fixed |
| **RA-5** separate caps pull every site toward 50% | `min(10,k)` and `min(10,f)` were capped separately | Rate-preserving weight: `w = min(1, 20 / (k + f))` multiplies both k and f, in `learn` and in `priorOf` | FXA-5: a 4% site gives a global mean of 0.088 (was 0.442) | Fixed |
| **RA-6** cells learned as independent trials | Each cell counted as one Bernoulli trial | One trial per action and engine group, with success (k − n·b)/n | FXA-6: 30 moved cells take site B's L08 prior from 0.060 to 0.164 (was 0.582) | Fixed |
| **RA-7** re-chosen action reuses the old registration | `prereg_json` and `created_at` were kept from any stored row | The registration is kept only by an attempt that is still open and executed (`on`). A shadow row, or an attempt that ended, is registered afresh: registration date, baseline, controls and `created_at`. `prereg.attempt` and `prereg.previous` (up to 5) keep the history. The action id is unchanged, because AIRF is frozen. | FXA-7 (shadow to on; not happened, then chosen again) | Fixed |
| **RA-8** no placebo; long windows lose their before-period | The outcome read only the 60 days of answers loaded at the end of the window | The t0 snapshot freezes the counts before t0 (the 28 days before, its two halves, and the 28 days before that) at verification. The placebo compares the 28 days before t0 with the 28 days before those, when at least 21 of those days are on file. Otherwise it uses the two halves of the 28 days before, scaled ×2 to the DiD's spacing. "Placebo not computable" is written into the verdict. L10's DiD is read from the snapshot. | FXA-8: L10 read at t0+65 days gives 34.8 points with the snapshot and none without it. A pre-trend through `AI_Rank_Plan` reads "can't tell". Short history uses the halves. | Fixed |
| **RA-9** the diagnosis is trimmed past about 20 questions | `diag_json` was trimmed first, and `diagPrev` read it | New column `seo_ai_rank_runs.stages_json`, holding the compact stages (`ARL.stagesPack`: about 25 characters per question × engine; 6,993 characters for 30 × 8). The builder never trims it. The memo's `diagPrev` and the snapshot readings come from it. | FXA-9 (the generated run-row node: diag trimmed, stages kept; the memo compares with last week) | Fixed |
| **RA-10** two sites overwrite the global row | `learn` ran per site against stale rows | `ARL.learn` runs once after the site loop over every site's outcomes. Each item gets its own site rows and the global rows of the keys it touched, which are identical. | FXA-10 (through the plan: one global row, the same in both items) | Fixed |
| **RA-11** the memo's MDE describes a test that is never run | It was a whole-panel figure, with m over 60 days and the brand included | m = answers per core question over 28 days, p = named share on the core. The memo leads with the one-question figure (51.6 points at p 0.05 for 1 vs 10). It says a single first appearance can never be shown below 40 zero-baseline controls. Then it gives a 3-question figure and the panel figure. | FXA-11 | Fixed |
| **RA-12** no multiple-testing control; two alphas | DiD 2.5%, Fisher 5% | One alpha everywhere (`ALPHA` = 0.025 one-sided), covering DiD, Fisher, ITS and the MDE's first-appearance k (ARD and ARL). `ARL.fdr` applies Benjamini-Hochberg at 0.025 over the actions judged in the last 91 days. A "likely helped" from this run that does not survive becomes "can't tell", with the reason. Stored verdicts are history. The memo states the count and the number expected by chance. | FXA-12: 50 null actions per quarter give 0.00 "likely helped" on average; 7 of 16 first appearances (p 0.033) gives "can't tell" | Fixed |
| **RA-13** SERP proxy ignores the location | The map was keyed by keyword only | The plan keeps one reading per keyword and location (`by_loc`). ARD accepts only a reading of the question's market (the question's market, otherwise the site's). A reading with no location recorded is still accepted, because it cannot be shown to belong to another market. | FXA-13: a US reading gives S1 / unknown_index; a 2784 reading gives S2 | Fixed |
| **RA-14** own pages not screened | `REFUSED` was used only in `compareOld` | `ARL.screenOwnPage` runs on keyword, question and fan-outs for every chosen L05 / L06, in shadow too. An R01 match makes it a `Comparison Page` with "honest comparison, never a self-ranked list" in the target's `reason`. An R02 match refuses the page. | FXA-14 | Fixed (writer side: see section 4) |
| **RA-15** memory answers get full near-term gain | L11 / L12 / L17 were undiscounted on no_search cells | L12 no longer acts on a no_search cell. L11 and L17 get × (1 + 60/60) / (1 + 180/60) = 0.5 there. | FXA-15: L11 0.00054, L12 no cell | Fixed |
| **RA-16** expiry before time to effect | Expiry was window + 14 from registration | `ARL.expiryDays` = max(window, days_max) + 14, stored as `prereg.expire_days`. A placement's clock starts at the pitch's send date. The plan's backstop uses the same rule and never expires an action that happened. | FXA-16 (L08 at day 50 is verified; it expires after day 104) | Fixed |
| **RA-17** two pages of one directory collapse | A first-seen candidate won | All pages of a `listing_id` merge into one L09 candidate, with every question and `page_urls`. | FXA-17 | Fixed |
| **RA-18** answer-level binomial p | Correlated answers were treated as independent | `p_binom` is removed. The answer counts are kept, with `answers_note` saying they are for reading only. | FXA-18, AL8 | Fixed |

## 2. Contract changes (additive only)

- **Columns:**
  - `seo_ai_rank_runs.stages_json` (string)
  - `seo_ai_rank_questions.arm_since` (string)

  Both are at the end of `ladder_common.py`. `sync_tables.py` adds them on deploy. AIRW0-4 was updated.
- **ARL inputs:**
  - `outcome({ verified, exposure })`
  - `learn({ history })`
  - `prereg({ exposure })`
  - `choose({ exposure })`
  - `ARD.assignArms({ exposed, locked })`
- **ARL exports:** `UNIFORM`, `ALPHA`, `SITE_CAP`, `expiryDays`, `stagesPack`, `stagesUnpack`, `snapshotT0`, `qDid`, `its`, `claimCells`, `fdr`, `screenOwnPage`.
- **Outcome fields added:** `p_one`, `alpha`, `its`, `coverage`, `controls_used`, `controls_dropped`, `stage_moves.stages_at_t0`, `fdr`, `learn_overlap`. `first_appearance.p_binom` was removed.
- **Lever library:** L13 and L14 are scope `page` (they were `site`). `SITE_WIDE` is L11, L12 and L17.
- **Stored prereg fields added:** `expire_days`, `attempt`, `previous`.

## 3. Each new check fails on the old code

A scratch script (not committed) copied the kits and the generated workflow, put the old lines back (in the kit and in the `AI Rank Plan` node), and ran `scenarios_air_fxa.js`. To repeat it, apply the same reverts by hand:

| Old code put back | Checks that fail |
|---|---|
| RA-1: `diagAtT0: null`, no snapshot, `learnable` without `n > 0` | 4 FXA-1 checks, plus FXA-10 (no prior is learned, so no global row) |
| RA-2: the old `assignArms` block | 3 FXA-2 checks (min 0 controls in a week; the legacy panel is not refilled) |
| RA-3: the old AVX bootstrap DiD | FXA-3 null table (sticky 1/10 reads 16.0%) and the one-question-vs-3 check (it read "likely helped") |
| RA-4: no control exclusion, no cell claim, L13 / L14 site-wide | 3 FXA-4 checks |
| RA-5/6: cell-level trials, separate caps | FXA-5 (mean 0.442) and FXA-6 (0.060 to 0.582) |

## 4. Checks run

- **Build:** `python3 build_v4.py` exits 0.
- **Full harness** (fresh copy without `docs/`, `n8nio/n8n:2.41.4`): **16,690 passed, 0 failed** (was 16,655 at 77c82704; FXA adds 34 checks). This includes AIRG (off golden, byte-identical) and AP3 (shadow golden: every pre-existing write, report, callback, settle and outside request is identical; shadow makes no outside call).
- **Replay** on the private dump (`~/seo-agent-secrets/ai-ranking-2026-11-05/replay_fxa/before` and `after`): 6 runs, 0 errors, 0 network attempts, 0 writes outside the AIR tables.

| Site, week | Chosen before → after | Levers (after) | Arms (core) before → after | Controls registered before → after |
|---|---|---|---|---|
| devaicon 10-29 | 0 → 0 | none | 1T → 1T | 0 → 0 |
| devaicon 10-30 | 5 → 5 | L06, L08, L09, L11, L12 | 7T/3C → 7T/3C | 9 → 3 |
| devaicon 11-05 | 9 → 9 | L06, L08 ×5, L09 ×2, L12 | 7T/3C → 7T/3C | 14 → 4 |
| techand 10-29 | 8 → 8 | L06, L08 ×5, L11, L12 | 6T/2C → 6T/2C | 9 → 12 |
| techand 10-30 | 10 → 10 | L06, L08 ×5, L10, L11, L12, L16 | 6T/2C → 6T/2C | 14 → 10 |
| techand 11-05 | 9 → 9 | L06, L07, L08 ×5, L10, L12 | 9T/4C → 9T/4C | 28 → 29 |

- **Lever counts:** the same on every row.
- **Arm counts:** the same (the replay starts each week with no stored AIR rows, so floor(N/3) gives the old counts here).
- **Changed:**
  - In 4 of 6 runs, the one own-page slot (L06) went to a different question, because the arm assignment chose a different control question.
  - Fewer controls are registered on devaicon. Its lists cite the control questions, so this week's placements expose them (RA-4).
  - No own page matched R01 / R02.
  - `stages_json` is 0.6 to 4 KB per run.

## 5. For other owners (files FX-A does not own)

- **AIRF (frozen, W0 / FX-B):** bump `RULE_VERSION` (`air-1` → `air-2`). The counting rules changed (one trial per action, rate-preserving weight, one alpha). Production holds no learned prior yet (shadow only), so there is nothing to migrate. A per-attempt action id is not needed: RA-7 is solved by re-registering.
- **The writer (P3 / content):** the target row carries `page_type: 'Comparison Page'` and the "never a self-ranked list" note in `reason` for R01 questions. Whether the brief reads `reason` was not checked: that needs a paid page run.
- **Found while fixing, not in the review:**
  - **L07 can never be verified.** Its ref is `{ prompt_id }`, and the actions table stores no `page_url`, so `verify` looks for an empty URL. The fix is to store the page URL in `ref` for L07 (ARL candidates / plan); it was not done here because it changes the action id.
  - **L11 to L15 and L17 wait for `client_url`.** No table or route provides it, so they never verify. P6's app flow needs to record it.
- **App (P6):** the memo has new lines (detectable part, FDR count) and new outcome fields. Nothing in `app/` read `p_binom`, `diag_json` or `stage_moves`.
- **Deploy:** `sync_tables.py` adds the two columns. Until they exist, the run row's `stages_json` and the question rows' `arm_since` are dropped by n8n, and the old fallbacks apply (`diag_json`, `core_since`).

## 6. FX-A2 (2026-11-06): the engine side of the client's address, L07, and the air-2 rule

This builds on FX-C RC-3 (`fixes/FX-C.md`). The app writes `client_url` on the `seo_ai_rank_actions` row and a `seo_ai_rank_sources` row with `names_client: true`, `source_from: 'client'`, `first_seen` / `last_seen` / `checked_at` set to now, and `url_key` from the AIRF rule. It writes them only after its own safe fetch has found the business named. This branch merged `air/integration` twice: first P6 + FX-A + FX-C, then FX-B.

| Item | Fix | Check (fails on the code before FX-A2) |
|---|---|---|
| Column | `('client_url', 'string')` is added last to `AI_RANK_ACTIONS_COLS`. `sync_tables.py` adds it on deploy. | FXA-19 (`table_cols.json`) |
| Kept on upsert | A chosen row writes `client_url: S0(st.client_url)`, so a weekly run never blanks it; a new attempt re-checks the same page. Outcome and expiry rows spread the stored row, so they keep it too. | FXA-19 (plan) |
| The client's source rows | The plan puts the site's stored `source_from: 'client'` rows back into the source graph as written, whatever their influence, so they are never cut by `sources_max`. A weekly source row never rewrites a row that only the app wrote. | FXA-19 (plan: no rewrite of that `url_key`) |
| Verification, L11-L15 and L17 | `ARL.verify` reads `client_url` and applies the safe fetcher's rules (`ARL.safeUrlWhy`): https only, no credentials, no IP literal (v4 or v6), a public host, no port other than 443, and for L17 a Wikidata item. The step is done only when the page was read after the step was asked and names the business. A correction (L15) on the client's own page counts when our fetch read it HTTP 200 after the step was asked. Before this, any HTTP 200 page row counted, however old. | FXA-19 (3 kit checks) |
| L07 | The candidate's ref is `{ prompt_id, url: <the page it fixes> }`. The action id is unchanged, because `refKey` keys on `prompt_id` first. `verify` reads the client's own page (`seo_ai_pages`): live (HTTP 200), read after the step was asked, and its visible update date after that too. Before this, it looked for an empty URL in the third-party source graph. | FXA-20 |
| air-2 (FX-B) | ARL / ARD `VERSION` = `air-2`, as AIRF. AI_Rank_Plan reads FX-B's Code node `Load AI Rank Actions` by the same name; it outputs rows, or `{}` when there are none, and `bySite` drops the empty item. The FXA fixtures register under `AIRF.RULE_VERSION`. AIRW0-2 checks that ARD.VERSION equals the rule. | AIRW0-2, FXBR |
| `ai_growth_off_paths.json` | Not regenerated. FX-A2 changes no Growth Plan or report code, and the off output is unchanged (AIRG / FXB6 pass). | full harness |

The old-code check rebuilt the AI Rank Plan node in a scratch copy from `307cd0c1`'s kit and plan: 6 of the 6 new checks fail.
