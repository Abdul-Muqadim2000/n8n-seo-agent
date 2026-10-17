# F-C handoff — monitors and the schedule loop (re-rating 2026-10-17, part 3)

Branch `worktree-agent-a9759c9fce4dc97fb` (fast-forwarded to `feature/seo-agent-v4.5` c7333cb first). Source only is committed: the
generated `workflows/*.json` and `harness/code_v4/` were built with `--no-env` and are NOT committed — rebuild in the main checkout.

State at checkpoint: `python3 build_v4.py --no-env` exit 0; harness **6601 passed, 0 failed** (baseline 6486); app typecheck clean in all
three workspaces, shared 327 / server 306 tests passed.

## Done (commit)
| Finding | Commit | Scenario |
|---|---|---|
| C-1 High: catch-up — slot due for its whole period, held fire started at 30 min (6 h before), no wall-clock time-out, plan older than 10 min never acted on, sweep every 15 min, claim read back (two sweeps race → one start), "starting" record no run followed is retried, cancelled runs replayed, 3 attempts; every monitor callback says `ran_late` (Callback Ledger) | f4fce08 | S126–S129 updated, SC1, SC2 |
| C-16: IMAP watchdog at the end of each sweep (Error Handler drop record vs last (re)arming → deactivate+activate via public API, 30-min spacing, alarm after 3 failures); HANDOVER.md "Is the mail watcher listening?" | 0802147 | SC3 |
| C-2 / C-8 / C-10 / C-3 / C-11 / C-14: one rival kit `v5/code/_rivals.js` (AI Metrics, Earned Media, Backlink Monitor, Link Builder); BL targets per topic, comp_new topic gate, market media; earned counts basis; dry run held by the app (`test_run`) and titled TEST RUN; quiet pulse | 97d0018 | SC4, S29/S20 updates, app tests |
| C-4: outlier reading not used as baseline (`RS.stableReading`), labels in words and defined | 89b674d | SC5 (real rank history) |
| C-6 / C-7 / C-12 / C-13 / C-15: `SM.pageStep` shared page state; fix_top reachable; stored set_aside honoured; ranking page named; one row per page; indexed planned page shown live; `GQ.otherSite` | 0ca7547 | SC6 |
| C-5 (my half): audit diff refuses to compare rendering-dependent findings across a crawl-method change; reads `seo_audits.crawl_js` (F-B adds the column; missing = unknown, not same) | this checkpoint commit | none yet (wiring only; harness passes) |

## Not done / open
- **C-9** (AI visibility comparison lists Gemini that answered 0 last time; period label "7 days" vs 1 pulse day): not started.
  Where: `v5/code/AI_Metrics.js` ~287-296 (`engSet` must require `answered > 0` on both sides) and ~429 `delta_basis`; `AI_Report.js:124`
  hard-codes "the 7 days to …" — use `pulse_basis` / `prev.checked_at`.
- **C-5 scenario**: add a harness scenario running *Audit Diff* with a previous row `crawl_js: true` and the "AI crawlers see a different
  version" finding, current `crawl_js: false` → not in `fixed`, named in `not_compared_method`.
- C-12/C-13 and part of C-7 (Rank Tracker side) are proved at generated-code level in SC6, not by running *Tracker Report*.
- Audit Scheduler and Page Watch do not carry the `ran_late` notice (no Callback Ledger there).
- Content Cadence: the pile-up count is unchanged (app mirror `cadence.ts`); only its reason text says a covered draft is not needed.
- halsimplify.com / tradeshift.com: still qualified when neither AI names them nor their title/site text claims the category.

## Live acceptance after deploy
- Catch-up: `seo_cache` `catchup:last` shows sweeps every 15 min; a fire missed while asleep is `start` within ~30-45 min of waking; the
  started run's callback has `ran_late` and "(ran late — due …)" in its subject. `catchup:watchdog:SEOagentConsole1` present.
- AI visibility: erp-dubai.ae / penieltech.com not "site (PR target)", not in `seo_link_prospects` as ai_source.
- AI Growth dry run: subject "[AI growth · TEST RUN] …"; app report held (`test_run`), titled "(test run)".
- Link Builder: erp-dubai.ae, penieltech.com, pactsoft.ae `not_fit` with reasons.
- Backlinks: marketguest.com not a prospect; prospect `target_url` per topic or home; gulfnews.com not "off topic".
- Rank Tracker "e invoicing in uae": no "9 of 9 changed" against the 10-16 19:58 reading; Site Tracker: no "techandkey com" quick win,
  one row per page, "ai consulting" draft retired in both reports.
