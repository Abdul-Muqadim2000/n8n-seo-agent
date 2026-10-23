# W2-FIX: the leftovers of AI visibility wave 2 (2026-10-23)

Fixer after the wave-2 merge. Base `2ed297ca` (aivis/integration, harness 11732 / 0). Branch `worktree-agent-aae635b6388ecf501`. Nothing pushed,
nothing deployed, production untouched, no paid call made.

Commits: `e9398d88` (engine), `b3dfc5d5` (app), `a8bec00c` (business site), plus this report. Generated files (`workflows/*.json`,
`harness/code_v4/**`, `harness/*_wiring.json`, `env_guard.json`, `CHANGES_v3_to_v4.md`) are not committed: rebuild after merging.

Checks: `python3 build_v4.py --no-env` exit 0 (28 generated workflows). Harness in a throwaway `n8nio/n8n:2.41.4`: **11809 passed, 0 failed**
(base 11732, +77; the new file `harness/scenarios_w2fix.js`, W2FIX-1..4, 92 results with `ONLY_S=W2FIX` incl. node runs, S23 gains the two new app fixtures). App (`node:22-bookworm-slim`, whole worktree
mounted, volume `aivis_fix_nm`): `tsc --noEmit` clean for shared, server, web; shared **687 passed**; server **1410 passed**, 46 skipped
(Postgres suites; `identity-sso` and `identity-mfa` failed once each under the full parallel run and pass alone, as noted in W2-A); web **181 passed**.

## 1. App cost glue (W2-E3 §9, and the app review's High R-A1)

R-A1: the on-demand AI quote (which is also the credit check and the charge cap) ignored the owner's options. Reviewer's case: 50 questions with
every option on, the engine reserved $4.412 while the app quoted $3.274. Three places dropped them:

| Where | Before | Now |
|---|---|---|
| `server/src/services/runs.ts aiPanelForQuote` | size + engines only | `aiRunPanelOfRow(row)` (new, `shared/src/cost.ts`): size, engines, `ai_claude_weekly`, `ai_pulse_engines`, `ai_persona_context` + `ai_personas`, `ai_fanout_check`, `ai_demand_market` (a boolean column is on only when true, as the engine reads it) |
| `shared/src/cost.ts aiPanelOfValues` | threw `options` away | keeps the known option keys |
| `shared/src/cost.ts estimateRunCostParts` | `estimateAiPanelCost({ panel, engines })` | `aiOnDemandRunCost(panel)`: the same figure as `estimateRunCost`, options in the breakdown |
| `shared/src/autopilot.ts autopilotRows`, `constants.ts estimateAiVisibilityCost` | no options | the options pass through (`aiPanelOptionsOf`), so the schedules' forecast and its credit reserve include them; absent = the figures of before |
| `web MonitorSettingsFields aiPanelCostWith` | persona test priced at 0 (no roles passed), no market trend | roles and market trend passed |
| `web tools/forms/growth.tsx` (the form's shown quote) | unchanged code, now right: `monitorsFromRow` reads `ai_demand_market` back and `aiRunPanelOf` already took the options |

Tests (`shared/src/cost.aipanel.test.ts`): the 20 `cases_options` golden cases + the option constants (21 checks, the W2-E3 template); R-A1
reproduced from a stored row with every option on (equals the golden full run for those options; with fan-out 100 the golden figure plus 50
results pages, the reviewer's $4.412, and more than $1 above the old size-and-engines quote); a row without the option columns is quoted as
before; the market trend adds $0.33 a month and nothing to the weekly run; the forecast row prices the options. The tests read the golden table,
so the Sentiment Reader price correction another agent is making (`_ai_panel.js` / `ai-panel.ts`, not touched here) moves both sides together.

**`ai_demand_market` in the website settings** ("More engine options"): a checkbox "Track how often AI names businesses in your market, month by
month", priced through the same delta line as the other options (+$0.33 a month, shown in credits), with the note that outside the US the figures
come from Google's AI answers and ChatGPT data covers US-English only. Schema `aiDemandMarket` (optional, no default: nothing is sent until set),
`monitorsBody` -> `ai_demand_market`, read back by `monitorsFromRow`, `MonitorsRow.ai_demand_market`.

## 2. The repeat pilot's door (W2-E2 open item 2)

- **Engine:** new workflow `SEOagentAIPilAPI` "SEO Agent - AI Pilot API" (`build_monitors.py` 5b2, `v5/code/Pilot_API_Validate.js`), built like the
  Link Builder API: `POST /webhook/seo-ai-pilot`, header auth (credential SEO API Key), answers 202 first, then Execute Workflow
  `SEOagentAIPilot1` (no wait). `confirm` is true only for the literal boolean `true` ("yes", 1 are refused with a 400). No schedule (asserted).
  *Pilot Report* now also sends `reason` and `can_confirm` (false when the panel holds under 3 questions, no engine fits, or the price passes $4).
- **Manifest:** `SEO_Agent_AI_Pilot.json` + `SEO_Agent_AI_Pilot_API.json` in `workflows`, `SEOagentAIPilot1` + `SEOagentAIPilAPI` in `publish` (the pilot
  is started through Execute Workflow, so it must be published in n8n 2.x). `deploy/gcp/deploy_engine.py` and `n8n/deploy/release.mjs` read the
  manifest as is. **Both are new on the remote: the first deploy needs `deploy_engine.py --apply --create-missing`** (without it the deploy fails
  naming them, by design).
- **App:** `GET /api/orgs/:orgId/sites/:siteId/ai/pilot` (the latest quote and result, read from the stored callbacks) and `POST` same path
  `{ confirm }` (`services/aiPilot.ts`). Admin and owner only (`siteAccess(..., 'admin')`), company-scoped, verified website, CSRF like every
  cookie POST, 10 an hour, a disabled company or a suspended person starts nothing, audited (`site.ai_pilot_quote` / `site.ai_pilot_run`).
  `confirm: false` sends the engine a price request and spends nothing. `confirm: true` is accepted only against the latest quote, when it
  says `can_confirm`, is under 24 hours old and has a price; then the company's money checks run under its lock (budget or platform capacity,
  then credits for the quoted price) before `confirm: true` is sent. A second pilot of the same website while one runs is refused by the
  engine's own run guard (mode `ai_pilot`). The pilot's ledger row is charged by costSync like any engine row (by the website's domain).
  Stage labels `ai_pilot_quote` "AI repeat pilot price" and `ai_pilot` "AI repeat pilot"; `ai_pilot_quote` is an interim stage, never delivered
  as a report.
- **UI:** "Repeat pilot" panel on the AI visibility page (admins only, `_components/ai-pilot.tsx`): "Get the price", waits (polls every 5 s)
  for the callback with its own request id, shows questions x repeats x engines, answers and the price in credits, then "Run the pilot for about
  N credits" behind a confirmation dialog; the last result per engine (asks per question a week, or "ask more questions instead").
- Tests: harness W2FIX-4 (wiring, 202 before the start, manifest, validator cases, the quote callback and the too-small refusal); server
  `test/aiPilot.test.ts` (8: reading the callbacks, refusals, price request spends nothing, confirmation checks credits for the quoted price then
  sends `confirm: true`, credits short or a suspended person sends nothing). Not exercised against a running n8n.

## 3. `units_json` growth (W2-E2 open item 5)

*Trim Old Units* (AI Visibility Tracker, after *Trim Old Answer Text*, before *Prompt State Rows*, so after the week's row and the run's done state
are saved): an UPDATE of `units_json` to '' only, on `seo_ai_visibility` rows with `site_id like <this site>` (every site from the cron), `checked_at`
older than 70 days and newer than 120 (a missed week is caught for seven more weeks), `executeOnce`, `continueRegularOutput`. Readers: the tracker
loads 60 days of weekly rows (28-day window, an action's 28 days before / after for actions of the last 31 days), so no read record is cut; a
blank record unpacks as "no per-answer record" and is counted in `window_28d.left_out`. Harness W2FIX-2 (filters, value, position, the 60-day
load, the unpack); W2E1-7's wiring check now accepts the new next node.

## 4. The front door's reservation (W2-E3 open item): fixed

**What was wrong.** An on-demand AI visibility check reserved, on the main workflow's front-door row, the flat `ai_visibility` estimate (shipped
$0.95 of search data + $0.14 Claude, or its rolling calibrated figure capped at 5x), while the tracker it starts asks the website's whole panel.
Effects, read from the code:
- Rate Limit's **day search-data budget** (`dfs_budget_usd`, $15 a day, counted over every ledger row of the instance, scheduled runs included)
  and its **account floor** were judged on ~$0.95. A 200-question default panel's full run is about $10.68 of which most is search data; 500
  questions far more. The tracker's own gate (`RG.gate`) checks the account balance only, never the day budget. So: **no guard refused a large
  panel on the budget, and the day budget could be overrun** by one on-demand check; on a low account the front door admitted it and the tracker
  refused it after the app had been told "accepted".
- No under-reservation of the money actually spent (the tracker reserves its full figure on its own row; the parent settles $0 as handed off, R81).

**Fix (cheap path: the app's quote through the body, capped).** The server adds `panel_quote: { dfs_usd, ai_usd, panel }` (its
`aiOnDemandRunCost` of the stored panel and options, the engine's AIP.cost formula) to every on-demand AI visibility body. Normalize Input carries
it (`panel_quote_dfs_usd`, `panel_quote_ai_usd`, `panel_quote_panel`; 0 for any other mode; at most $150) and `CC.pick` (`_cost_cal.js`) reserves
the LARGER of its table figure and the quote, at most $150 (AIP `max_run_usd`), in both Rate Limit and Run Ledger Row; the basis says "the
website's whole panel as quoted". A caller can only make the guard stricter. Without a quote (an older app, the API) nothing changes. Calibration
is untouched (a hand-off settles $0 and teaches nothing). Harness W2FIX-1 (the kit in both nodes, Normalize Input from the app's fixture, Run
Ledger Row's reservation, other modes, the cap) and S23 (the exported fixture `ai visibility with the server's quote ...`).

**Consequence the owner should know:** the $15 a day search-data budget is instance-wide. With the real figure reserved, an on-demand check of a
large panel is now refused at the front door when the day's spend plus its quote passes $15 (a 200-question default panel needs about $10 of the
$15; larger panels or option-heavy ones cannot run on demand at all under $15). The customer gets the budget refusal message at once instead of
a run that overspends. If large on-demand panels are expected, raise `dfs_budget_usd` (Normalize Input CONFIG) before deploying.

## 5. Site Admin `monitors` field names, end to end (W2-A open item)

Traced app -> engine for all seven keys:

| App (`monitorSettingsSchema` -> `monitorsBody`) | Admin API `Admin Validate` | `Admin_Action.js` | `Monitor_Row_Admin.js` | Match |
|---|---|---|---|---|
| `aiAlertRules` -> `ai_alert_rules_json` (JSON string) | passes body | validated by `AVX.validateRules`, '' / [] clears | stored as given | yes |
| `aiSovSet` -> `ai_sov_set` ('a, b') | passes | normalised (domains lowercased), '' clears | stored as given | yes |
| `aiClaudeWeekly` -> `ai_claude_weekly` | passes | passes | `b()` | yes |
| `aiPulseEngines` -> `ai_pulse_engines` | passes | passes | allowed list, fixed order | **name yes; an emptied list was sent as '' which Site Admin reads as "not given", so the last choice stuck. Fixed: sent as ' ' (clears to the default four)** |
| `aiPersonaContext` -> `ai_persona_context` | passes | passes | `b()` | yes |
| `aiFanoutCheck` -> `ai_fanout_check` | passes | passes | 0-200 | yes |
| `ai_demand_market` | | passes | `b()` | **missing on the app side. Fixed (item 1)** |

Also found: **"Track my site" dropped the five W2-E3 options** (Normalize Input copied only the older monitor keys into `monitor_input`), so they
could be set only through Site Admin. Fixed in build_v4.py section 149; `Monitor_Row_Track.js` already stored them.

The route's body is now one shared function, `siteAdminMonitorsBody` (`shared/src/payload.ts`: the ' ' clears for brand names, roles, markets and
pulse engines). Tests on both sides: `shared/src/w2fix.test.ts` (6: every key under its name and shape, untouched keys not sent, emptied lists
clear, off sends false / 0, competitors); `npm run export:payloads` now also writes `harness/fixtures_platform_admin.json` (3 bodies built by that
function: everything set, everything off / emptied over a stored row, an unrelated save that keeps them) and a "Track my site" case with the
options; harness W2FIX-3 runs them through Admin Validate, Admin Action and Monitor Row (Admin) / Normalize Input and Monitor Row (Track) and
compares the stored columns (exact column set).

## 6. Business site

`app/web/src/marketing/content/features.ts` (AI visibility benefits) and `changelog.ts` (release 4.3 extended): ranges that allow for the answers
to one question moving together; share of voice against a fixed set with "others"; 28-day rates per topic, buyer role and market; "did it work"
(before / after against untouched similar questions, "likely helped / likely hurt / can't tell", never the cause); optional checks priced before
they are switched on (Claude weekly, more assistants in the daily check, your Google rank for the searches assistants run); the one-off repeat
test, priced first and run on confirmation; a check you start is quoted for your whole panel with your options. Wave 1's like-for-like
comparisons and the per-panel quote were already in 4.2. Customer language, no internal names, no em dashes, curly quotes or "...".
**Left off the site on purpose:** sentiment by aspect (the model reader is "not yet validated", W2-E2 open item 1), the buyer-role-as-context
test and the monthly market trend (their DataForSEO fields are unverified until the owner's live checks 1, 5 and 6-8 of `live_checks_aivis.py`).

## Not done / open

- Nothing ran against a live n8n or the dev stack; the pilot's door, the panel quote and the trims are proven offline only. First deploy:
  `deploy_engine.py --apply --create-missing` (two new workflows), `sync_tables.py` as before.
- The owner decides `dfs_budget_usd` for large on-demand panels (item 4).
- The market-trend and persona settings are now exposed in the app; W2-E3 advises keeping them off until live checks 1 / 5 / 6-8 pass.
- No browser pass of the new pilot panel or the market-trend checkbox (typecheck and unit tests only).
- The pilot is charged through costSync by domain; unlike a run, its charge is not capped at the confirmed quote (the engine caps the pilot at $4).
