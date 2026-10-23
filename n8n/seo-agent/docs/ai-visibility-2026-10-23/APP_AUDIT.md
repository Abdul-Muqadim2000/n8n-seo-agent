# AI visibility: web app audit (2026-10-23)

Scope: everything in `app/` (shared / server / web) that reads, shows, prices, exports or changes AI visibility, the AI pulse and the
question panel. Read-only audit of branch `feature/seo-agent-v4.5` at `3af6f7a2` (= production). Engine side compared against
`n8n/seo-agent/v5/code/AI_Metrics.js`, `AI_Vis_Rows.js`, `Build_AI_Callback.js`, `Pulse_Metrics.js`, `Parse_AI_Answers.js`,
`Apply_Analysis.js`, `AI_Plan.js`, `AI_Prompt_Rows_Admin.js` and the columns in `ladder_common.py`.
No customer data was read; no live call was made. Shared tests for this area run green in `node:22-bookworm-slim`
(`ai-panel.test.ts`, `ai-visibility.test.ts`, `cost.aipanel.test.ts`: 3 files, 52 tests). None of the findings below is covered by a test.

Severity: **High** = wrong money or a wrong statement on the main figures that a customer will act on; **Medium** = wrong or
misleading in a secondary place, or breaks at the panel sizes G6 sells; **Low** = polish, edge cases, dead code.

| ID | Sev | One line |
|---|---|---|
| A1 | High | Dashboard and Overview subtract the last two runs with no like-for-like check and no test: the deltas the engine refuses (changed panel, changed engines) and the untested arrows B8-1 removed are back |
| A2 | High | An on-demand AI visibility run is quoted from a fixed 8-question figure whatever the panel; the charge is capped at that quote, so a 100-500 question site's run is mostly absorbed and the credit check is meaningless |
| A3 | High | The panel manager calls questions "Tracked" and "asked from the next weekly run" that the engine never asks (beyond `ai_prompts_max`); the "N of M" counter uses the setting of the last run |
| A4 | Medium | Two separator mismatches: alerts (`' \| '`-joined) are split on commas, so alerts arrive cut into fragments; `our_urls` (space-joined) is read as one URL, so a 2-page citation renders as one broken link |
| A5 | Medium | BI export / Looker / API: rate columns documented "(0-1)" but carry 0-100 |
| A6 | Medium | The brief, "This week's AI summary", the question grid and "What to do next" come from the latest delivered report, never checked against the latest stored run, and are shown as current next to it |
| A7 | Medium | Daily pulse chart, pulse report and page copy ignore the rotating sample and partial days: different question subsets drawn as one line, "every day" stated for panels that are sampled |
| A8 | Medium | "Answers in 7 days" / "past 7 days" hard-coded; the engine counts since the previous run (`rate_period`) |
| A9 | Medium | The "Credits" a run shows (AI page, BI export) is DataForSEO cost x rate, not what the ledger charged (Claude missing, cap ignored) |
| A10 | Medium | Read limits do not hold at G6 sizes: answers capped at 3,000 unsorted (a 500 x 9-engine run stores ~4,000), prompts 1,200, `asc` + `max` reads that freeze on the oldest rows |
| A11 | Medium | `aiData()` (all answers, prompts, growth, prospects, content log) is loaded in full for the Overview, Recommendations and the `ai-segments` API; multi-MB per page view at 500 questions |
| A12 | Medium | A domain's AI history, question panel (personas, competitors, brand names) and panel size outlive a site delete and pass to the next company that verifies it, which is then billed for the old panel size |
| A13 | Medium | Panel edits (add / import / edit / pin / switch off, panel size) are not written to the company audit log |
| A14 | Low | Report renderer: citation and share-of-voice deltas without their test verdict; no reason shown when the engine refused a delta |
| A15 | Low | Server drops the engine's per-question `win` (`ci`, `enough`, `why`); the app rebuilds it |
| A16 | Low | Recommendation "AI assistants name you in X%" fires on any sample, also under the 12-answer floor |
| A17 | Low | Legacy group table and "N x vs organic" print rates with no denominator / floor |
| A18 | Low | Settings: the precision table ignores the pulse mode / mornings a week that the cost box beside it uses |
| A19 | Low | Dead `QuestionManager` with outdated copy (15 at a time, "every other day") |
| A20 | Low (verify) | Cost attribution follows `parent:` chains to depth 5; a 7-part run (500 questions x 9 engines) can bill its last part as schedule spend outside the run's quote |

---

## Findings

### A1 (High): deltas across changed panels, and untested arrows, on the dashboard and the Overview

**Where**
- `app/web/src/pages/site/AiVisibilityPage.tsx:52` (`lastTwo(runs)`), `:78` (`mentionDelta = diff(L.mentionRate, P?.mentionRate)`),
  `:105` + `:315-320` (the page's H1: "You're named in X% of AI answers, down Y pts"), `:115`, `:123`, `:130`, `:160`, `:178` (arrows on
  named, share of voice, cited, score, AI Overview shown).
- `app/web/src/pages/site/OverviewPage.tsx:164` (same subtraction on the Overview tile).
- Engine: `AI_Metrics.js:375-385` (`like`: refuses a delta when engines differ, panel size differs, or under 80% of question ids are
  shared) and `:422-430` (B8-1: every headline delta carries its own test, `delta.tests`). None of this is stored in
  `seo_ai_visibility`; the app only gets `panel_json.overlap_with_previous`, which it shows in small text in the segments panel
  (`ai-panel.tsx` "too few for a week-on-week change, so none is shown") while the hero above it prints the change anyway.

**Scenario.** The owner follows `AI_PANEL_SCALE_HANDOFF.md` §4: panel 8 -> 100, "Check now". Run P: 8 questions, 7.6% named.
Run L: 99 questions, 3.1% named. The page H1 reads "You're named in 3.1% of AI answers, down 4.5 pts", the Overview tile shows a red
-4.5, and "AI visibility score" shows a drop. The engine's own report for the same run says "Not compared with ...: a different
panel, not a different result" (`delta_not_compared`). Same when Copilot or the ChatGPT API is switched on, or a CSV import replaces
most questions. Separately, on a comparable week the citation, share-of-voice, score and AI-Overview arrows are plain subtractions:
the engine tests each (`delta.tests`), the app prints them as if real.

**Fix.**
1. Engine: store the comparison on the row: new column `compare_json` on `seo_ai_visibility` (`{ comparable, why, previous_run_id,
   delta: {...}, tests: {...}, rate_period }`), add to `AI_VIS_COLS` in `ladder_common.py`, run `sync_tables.py` on deploy.
2. App (`toAiRun`): read `compare_json`; the hero, the H1, the Overview tile and the score card take `delta` and the per-figure verdict
   from it, show no arrow and the `why` sentence when `comparable` is false, and grey an arrow whose test did not clear.
3. Interim, app only (rows written before step 1): refuse the delta when `panel.overlapWithPrevious.same === false`, when the
   non-carried engine sets of L and P differ, or when `prompts` differ by more than 20%; never show an arrow without a test (a
   two-proportion z on `round(rate x samples / 100)`, the same as `_ai_stats.js`).
4. Chart: mark a panel or engine change on "Over time" as a data break (the `ChartAnnotation` machinery exists for search data).

**Acceptance.** Fixture: two `seo_ai_visibility` rows, P with 8 question ids, L with 99 (overlap 7%). `/data/ai` returns L with no
delta and a "different panel" reason; the page H1 has no "up/down"; the Overview tile has no arrow. A comparable pair whose citation
change is inside the noise shows the change greyed with "within noise". Unit tests in `server/test` for `toAiRun` + the interim rule;
a web test for `aiHeadline`.

### A2 (High): on-demand runs quoted from a fixed figure, charge capped at that quote

**Where**
- `app/shared/src/cost.ts:77` (`ai_visibility: { ai: 0.14, dfs: 0.95 ... 'exec 526' }`, an 8-question run), `cost.ts:208-211`
  (`estimateRunCost` has no panel input), `cost.ts:31-33` (says the panel cost "is not repeated in this table").
- `app/web/src/pages/tools/_components/forms/growth.tsx:274` (`estimateCost('ai_visibility', v)` shown on the form).
- `app/server/src/services/runs.ts:250-267` (budget / credits checked and `quotedCredits` stored from that estimate).
- `app/server/src/services/admin/costSync.ts:606-620` (every usage debit of a run is capped at its quote; the rest is `absorbed`).
- Engine: an on-demand run is a full run (`AI_Plan.js:91`, `full_due = ... on_demand`), every engine incl. Claude on the whole panel.

**Scenario.** A site at 100 questions (default engines) clicks "Run an AI visibility check" (the page button, the Tools form, the
runs API or the MCP run tool). The form shows about $1.09 worth of credits; the credit check passes on that; the engine spends
roughly the handoff's "measured cost of that run ≈ $5.58" (§4 step 3), and $15+ at 200 questions / all engines. Cost sync charges
the quote and records the rest as absorbed. A workspace with 2 credits left can start a run that costs the platform $15. The
reverse holds for a 3-question panel (over-quoted).

**Fix.** Quote `ai_visibility` (and the `ai_visibility` run tool / API estimate) from the site's own panel:
`estimateAiPanelCost({ panel, engines, pulse, pulseMode, pulsePerWeek }).run.full.usd` (+ the brief), read from the website's monitor
settings on the server (`settingsData` / `monitorsFromRow`), never from the client. Keep `cost.ts` as the fallback when no monitors
row exists. Show "priced for your N-question panel on K engines" on the form.

**Acceptance.** Server test: a site whose monitors row says 100 questions gets `quotedCredits` = credits of
`estimateAiPanelCost({panel:100}).run.full.usd` (the golden-case value), not of $1.09; a workspace with fewer credits is refused
before submitting. `cost.aipanel.test.ts` gains a case tying the run quote to `run.full`.

### A3 (High): "Tracked" questions the engine never asks

**Where**
- `app/web/src/pages/site/_components/ai-panel.tsx:134` (`isTracked` = status not off / refused), `:261-262` ("{tracked} of {setting}
  questions tracked", `setting` = `d.panel.setting`, the setting stored with the LAST run), the add / import toasts ("They are asked
  from the next weekly run").
- `app/shared/src/schemas.ts:555-563` (add up to 500 at once, no check against the panel size).
- Engine `AI_Plan.js:85` + `:105`: `[...custom, ...auto].slice(0, prompts_max)`: questions past the panel size are stored `active`
  and silently not asked.

**Scenario.** Panel size 50. The owner imports a 200-row CSV: the app says "200 questions imported. They are asked from the next
weekly run" and lists 200 + the 49 automatic ones as "Tracked" ("249 of 50 questions tracked"). The weekly run asks 50. Same after
lowering the panel from 100 to 20 (80 stay "Tracked"). After raising 20 -> 100 the counter keeps saying "of 20" until the next run.

**Fix.** Read the current `ai_prompts_max` from the monitors row (it is already in `settingsData`), compute the asked set the way
`AI_Plan.js` does (pinned + custom first, then automatic, cut at the size) and label the rest "Over the panel size: not asked"; warn
before an add / import that pushes custom + pinned past the size, with the cost of raising the size instead (one formula,
`estimateAiPanelCost`). Better: have the engine write an `asked_in_run` / `queued` status so the app does not mirror the cut.

**Acceptance.** Fixture: size 50, 200 custom + 49 auto active. The manager shows 50 "Tracked", 199 "Not asked (over the panel size)";
the import dialog for 200 rows on a size-50 panel shows the warning and the monthly cost at 200.

### A4 (Medium): alerts and our cited URLs parsed with the wrong separator

**Where**
- `app/server/src/services/data.ts:906` (`alerts: splitList(r.alerts)`), `:886` (daily alerts), `:195` (same helper elsewhere),
  `app/shared/src/format.ts:47-52` (`splitList` splits on commas and new lines).
- Engine joins alerts with `' | '` (`AI_Metrics.js:529`, `Pulse_Metrics.js:79`), and alert texts contain commas, e.g.
  `AI_Metrics.js:498` "AI states something wrong about you (ChatGPT, Gemini): ...".
- `data.ts:1104` (`ourUrls: splitList(a.our_urls)`); engine `Parse_AI_Answers.js:77` joins `our_urls` with a SPACE.

**Scenario.** One run with two alerts. The "Alerts from the latest run" callout shows three or more bullets: "high: AI states something
wrong about you (ChatGPT", "Gemini): ... | medium: wafeq.com gained 12 points ...". An answer that cites two of the site's pages renders
one link whose `href` is "https://x/a https://x/b".

**Fix.** A `splitPipes()` for `alerts` (split on `\s*\|\s*`) and a whitespace split for `our_urls`; strip the `level:` prefix into a
tone (high / medium / low) instead of printing it.

**Acceptance.** `aiData` unit test with `alerts = 'high: a (x, y): z | medium: b'` -> two alerts; `our_urls = 'https://d/a https://d/b'`
-> two URLs.

### A5 (Medium): rate units in the BI export, the table API and the Looker connector

**Where** `app/shared/src/integrations.ts:554-561` documents `mention_rate`, `mention_lo/hi`, `citation_rate`, `share_of_voice` as
"(0-1)"; the engine stores percentages 0-100 (`AI_Metrics.js:48` `pct = ... /10`), `exportRow` copies them unchanged
(`integrations.ts:671-679`). The Looker connector (`integrations/looker-studio/Code.gs:134`) publishes that description.
`aio_presence` / `aio_citation_rate` say "Share of" without a unit; same 0-100.

**Scenario.** A customer's BigQuery / Looker dashboard formats `mention_rate` as a percent and shows 3,750%; or divides 37.5 by 100
twice. `share_of_voice` is also described as "against the tracked competitors" while it is against the top 8 named (configured +
found in 2+ answers).

**Fix.** Do not change the values (customers have tables built on them): correct the descriptions to "percent, 0-100", add
`rate_unit` to the table description, and if fractions are wanted add new columns (`mention_share` 0-1) rather than repurposing.

**Acceptance.** `integrations.test.ts`: every AI rate column's description says 0-100 and a fixture row exports 37.5 as 37.5.

### A6 (Medium): report-derived blocks not tied to the run they sit beside

**Where** `app/server/src/services/data.ts:999` (`latestReport(org, site, ['ai_visibility'])`) feeds `report.brief`,
`report.questions`, `report.actions`; `AiVisibilityPage.tsx:106` (hero description = `brief.headline`), `:146-151` ("This week's AI
summary"), `:107` + `:252-256` (next step / "What to do next"), `:231-237` (question grid, labelled with the report date only).

**Scenario.** The latest stored row is Monday's scheduled run; the latest report in the app is an on-demand check from three weeks ago
(scheduled reports were routed elsewhere, a callback failed, or the weekly run delivered to a stale callback). The hero shows this
week's figures with three-week-old prose and actions; the grid's "This week" win rates are three weeks old. The callback carries
`run_id`, so a match can be checked.

**Fix.** Use report blocks only when `report.payload.run_id === latest.runId` (or `checked_at` within the same run); otherwise show
them under "From the report of <date>" and drop "This week's" from the title.

**Acceptance.** Fixture with a report whose `run_id` differs from the latest row: the hero description is the run note, the summary
panel title carries the report date.

### A7 (Medium): the daily pulse shown as if every morning asked the same panel

**Where** `AiVisibilityPage.tsx:35` ("asked every day on the fast engines"), `:352-371` ("Daily" series), `data.ts:862-890`
(`aiDailySeries` ignores `sample_json`), `app/web/src/components/reports/ai.tsx:445-490` (pulse report: "asks your tracked questions
every day", no `readable.note`, no `today_rate.enough`, no `sample`). Engine: `Pulse_Metrics.js:36-45` (partial-day and floor
statements), `:102` (`sample`, `panel_size`), `AI_PANEL_SCALE_HANDOFF.md` §2.4 (above 50 questions each morning asks a rotating
stratified sample).

**Scenario.** 200 questions: each pulse morning asks ~100 different questions (3 mornings a week each). The "Daily" line jumps 6 -> 14
-> 5% from which questions were drawn, not from any change, with no range. A morning where Gemini returned nothing is drawn like a
full day. The pulse report for a 9-answer morning prints "Named today 33%" with no "too few answers".

**Fix.** Read `sample_json` (questions asked of the panel) and the day's partial flag (store `readable` in the daily row); draw the
daily series with its 95% range, hollow points for partial or under-floor days, and a 7-day pooled line as the main series; copy:
"a rotating sample of your questions each morning" above 50. Pulse report: show `readable.note`, `baseline_note`, the floor, and
"N of M questions asked today".

**Acceptance.** Fixture daily rows with `sample_json.asked` differing and one partial day: the chart table shows the asked count and
the partial marker; pulse report fixture with `samples: 9` shows "too few answers".

### A8 (Medium): "7 days" is not what the engine counted

**Where** `AiVisibilityPage.tsx:117` ("answers in 7 days"), `:242` ("over the past 7 days"), `:432` ("Answers (7 days)"),
`:403-416` (`MeasuredPrecision` passes no `ratePeriod`). Engine `AI_Metrics.js:551-555` (C-9: the headline counts this run + the pulse
days since the previous stored run; exec 776 counted one pulse day).

**Scenario.** A week was missed (n8n stopped): the run counts 13 pulse days and the page says 7 days; or the pulse is off and the
page still says "the weekly run plus the daily pulse".

**Fix.** Store `rate_period` in the row (with A1's `compare_json`) and print it; until then say "since the previous run".

**Acceptance.** Fixture with `rate_period` "this run on 2026-10-19 + 13 daily pulse days since 2026-10-05" is printed verbatim.

### A9 (Medium): "Credits" per run is not what was charged

**Where** `data.ts:905` (`credits: creditsFor(n(r.cost_usd), cs)`), `AiVisibilityPage.tsx:358` + `:383` (Credits column),
`app/server/src/services/exports.ts:76-83` (BI export `credits`). Engine `AI_Metrics.js:521` + `:528`: `cost_usd` is DataForSEO only
(the Answer Analyst / brief Claude spend is not in it). Charges come from `cost_events` (Claude + DataForSEO, capped at the quote for an
on-demand run: `costSync.ts:606-620`).

**Scenario.** A 200-question weekly run: the table shows credits for $4.61 of DataForSEO; the ledger charged DataForSEO + ~$0.63 of
Claude. An on-demand run (A2) shows credits for the full DataForSEO spend, while the customer was charged the capped quote.

**Fix.** Read the charge from the credit ledger (`ref.engineRunId` = the run's execution ids, as `reportCredits` already does), show
"charged" with its state; drop `cost_usd`-derived credits from the page and the export (`credits_charged` like the `runs` table).

**Acceptance.** Fixture run with a ledger debit of 12.4 credits and `cost_usd` worth 9.1: the page and the export show 12.4.

### A10 (Medium): read limits that break or go stale at G6 sizes

**Where** `data.ts:1012` (answers of the latest run, `max: 3000`, no sort), `:998` (prompts `max: 1200`), `:997` (runs `sortBy
checked_at:asc, max: 300`: once a domain has 300 rows, `last` is the 300th OLDEST and the page freezes), `:1000` (daily `date:asc,
max: 120` over 90 days: with on-demand pulses next to the scheduled ones, the newest days are the ones cut).

**Scenario.** 500 questions x all 9 engines = 3,992 requests a weekly run (handoff §4): the answers explorer, "Not named" counts and the
panel manager's "Latest run" column silently miss ~1,000 answers, a different 1,000 on each read. A panel that has been reworded a
lot (each reword keeps the old row `off`) plus refused rows passes 1,200 and the newest questions disappear from the manager.

**Fix.** Read newest-first (`checked_at:desc` / `date:desc`, then reverse) everywhere a `max` applies; page the answers on demand
(new endpoint `GET .../data/ai/answers?engine=&prompt=&result=&cursor=`) instead of shipping all; raise or remove the prompt cap and
filter `status` on the server.

**Acceptance.** Mocked n8n client with 301 run rows: `latest` is the newest. 4,000 answers: the answers endpoint pages through all;
the dashboard payload carries none.

### A11 (Medium): the whole AI dataset loaded for small reads

**Where** `app/server/src/services/recommendations.ts:68` (`aiData` in every `loadBundle`, used by the Overview and Recommendations),
`app/server/src/services/apiV1.ts:189` (`getAiSegments` loads `aiData` to return segments), `routes/data.ts:56-58` (the AI page
payload carries every answer and prompt; `clientSafePayload` then walks all of it for client roles).

**Scenario.** At 500 questions the `/data/ai` payload is 3-4 MB of JSON (2,500-4,000 answers with excerpts, 500+ prompts) on every
AI page view; every Overview / Recommendations load and every `ai-segments` API call reads 12-16 pages of answers from n8n (60 s
cache) and parses them.

**Fix.** Split `aiData` into `aiSummary` (rows, latest, segments, panel, daily: what Overview / Recommendations / API need) and the
paged answers endpoint of A10; prompts paged or loaded only by the panel manager.

**Acceptance.** `recommendations` / `ai-segments` tests assert no `aiAnswers` read; payload size test on a 500-question fixture
under ~300 KB.

### A12 (Medium): a domain's AI data and settings outlive its owner

**Where** `app/server/src/routes/sites.ts:226-231` (delete: `stopInEngine` -> Site Admin `delete`, which "removes the site row
(history stays)", `build_site_tracker.py:462`); dashboards read every n8n table by `domain` only (`data.ts:993-1013`). `seo_monitors`
(panel size, engines, competitors, brand names, buyer roles, markets) and `seo_ai_prompts` (incl. custom questions with personas)
are not removed.

**Scenario.** Company A tracks `example.com` with a 300-question panel and its own buyer roles and competitor list, then deletes the
website. Company B later verifies `example.com`: its AI page shows A's runs, answers and question panel (A's competitive framing),
its settings show A's 300-question / all-engine choice, and the first weekly run bills B ~$84 a month for a panel B never chose.
Verification makes B the rightful owner of the domain's public data, but A's own inputs (questions, personas, competitor list,
spend) are A's.

**Fix.** On delete or ownership change: Site Admin `delete` with `purge_inputs: true` that removes `seo_monitors` and `custom` /
pinned `seo_ai_prompts` rows (or marks them with the owning company id and filters on it); a new owner starts from the default
monitors. Decide (owner) whether measured history is kept or cut at `verifiedAt`; if kept, show runs from before the company's
`verifiedAt` under "before you verified".

**Acceptance.** Integration test: org A deletes the site, org B verifies it: B's `/data/settings` shows default monitors, B's
`/data/ai.prompts` contains no `custom` rows of A.

### A13 (Medium): panel changes are not audited

**Where** `app/server/src/routes/sites.ts:369-429`: the Site Admin route (panel edits, monitors incl. panel size and engines,
competitors) calls no `audit()`, while site add / verify / delete do (`:188`, `:262`, `:231`).

**Scenario.** An enterprise customer's 400-question panel shrinks to 50 and 120 questions are switched off; nobody can say who did it.
Enterprise buyers (SSO / SCIM customers) expect it in the audit log they can export.

**Fix.** `audit(req, orgId, { action: 'site.admin.' + a.action, target: site, details: counts + ids, not question texts })`.

**Acceptance.** Server test: an `ai_prompts` edit writes one audit row with the counts.

### A14 (Low): report renderer delta wording
`app/web/src/components/reports/ai.tsx:96` gives the "real change / within noise" verdict for "named" only; `:115-116` print the
citation and share-of-voice deltas without `delta.tests.*`; when `metrics.delta` is null the reader is not told why
(`metrics.delta_not_compared`). Fix: a verdict per figure; print `delta_not_compared`. Acceptance: report fixture with
`delta: null, delta_not_compared: '...'` shows the sentence.

### A15 (Low): engine's per-question verdict dropped
`data.ts:1121-1135` maps `questions` without `q.win` (engine `AI_Metrics.js:207`: `ci`, `enough`, `why`), so `questionWin()`
(`shared/src/ai-visibility.ts:57-67`) always rebuilds it from the rounded rate. Fix: pass `win` through. Acceptance: a question with
`win.enough: false, why: 'x'` shows "Too few" with that tooltip.

### A16 (Low): low-visibility recommendation without a floor
`app/server/src/services/recommendations.ts:323-329` raises a High recommendation when `mentionRate < 20` whatever the sample (a run
with 9 answers qualifies). Fix: require `samples >= AI_MIN_RATE_SAMPLES` and quote the range in `basis`.

### A17 (Low): figures without denominators
`app/web/src/pages/site/_components/ai-insights.tsx` `GroupsPanel` (pre-G6 fallback; "Named in" with no answer count or range) and
`AiTrafficPanel` `:53` + `:65` ("N x vs organic" from a handful of AI visits). Fix: show `samples` and the Wilson range; no ratio
under ~30 AI sessions.

### A18 (Low): settings precision table vs cost box
`app/web/src/components/site/MonitorSettingsFields.tsx:174` passes no pulse mode / mornings a week to `AiPrecisionTable`
(`shared/src/ai-visibility.ts:150-166` calls `aiPulsePerWeek` without `mode` / `perWeek`), while the cost box (`:291`) uses them: with
"full" or a fixed N the two disagree on the half-width. Fix: pass both through.

### A19 (Low): dead component
`app/web/src/pages/site/_components/ai.tsx:348-463` `QuestionManager` is unused (replaced by `PanelManager`) and states "at most 15 at
a time" and "every other day". Delete it.

### A20 (Low, to verify live): split-run attribution depth
`app/server/src/services/admin/costSync.ts:134-148` follows `parent:` keys to depth 5 within one sync batch. A run split into 7
executions (handoff §4: 500 questions x 9 engines) synced in one batch attributes its 7th part through the domain fallback (origin
`schedule`), i.e. charged in full outside the on-demand run's quote. Check on the first 7-part run; fix by resolving the chain
iteratively without a depth cap (cycle guard by a visited set).

---

## UX gap list vs the leaders

Compared with what enterprise buyers see in Profound, Peec AI, Semrush AI Visibility, Ahrefs Brand Radar, Scrunch and AthenaHQ
(capability classes common to that group, not a per-vendor feature claim). "Exists" = in the app today for a customer.

| Capability | State | What is there / what is missing |
|---|---|---|
| Per-prompt drill-down with the answer | **Partial** | Answers explorer filters by engine, question and result (`ai.tsx:200-267`). Only an excerpt of at most 520 characters around the mention is stored (`Parse_AI_Answers.js:74-78`); no full answer text, no answer history per question across runs, no side-by-side of engines for one question, no screenshot |
| Citations per answer (exact URLs) | **Partial** | `citedUrls` (third-party pages, with titles) is in the payload but never rendered in `AnswerCard`; our own cited URLs render (broken for 2+, A4); source domains as chips |
| Sources / citation domains | **Exists** | "Sources AI trusts" table (domain, kind, citations, engines, topics) for the latest run; **missing**: trend over runs, which URL of a domain, sources per competitor ("where rivals are cited and you are not") on the page (engine has `rival_sources_json`) |
| Our cited pages | **Exists** | "Your pages AI cites" (latest run); missing trend and "pages that stopped being cited" (engine has `gone_cited` in the callback only) |
| Competitor share of voice | **Partial** | Latest run bars + per-segment SoV; **missing**: SoV over time per competitor (each row's `competitors_json` is stored, only the latest is parsed), competitor drill-down (answers naming X), head-to-head per question |
| Position in answer | **Partial** | Rank badge "#n" per answer; `avgRank` read but not shown on the dashboard (report only); no distribution or trend |
| Sentiment | **Partial** | Per-answer badge, perception panel (descriptors, negatives, wrong claims); **missing**: sentiment trend, per-engine / per-competitor sentiment |
| Filters by engine / topic / persona / market | **Partial** | Segments panel by topic, buyer role, market, engine, stage (+ cross tables in the API only); panel manager filters. Missing: one global filter that scopes the hero, chart, answers and sources to a topic / role / market / engine; date-range picker |
| Per-engine trends | **Missing** | Engine table is the latest run only; `engines_json` of every run is stored but not charted |
| Visibility over time | **Exists, with defects** | Weekly / daily / score / AIO series (A1, A7: breaks unmarked, deltas across panels, no ranges on the line) |
| Exports (CSV) | **Partial** | BI export / table API of run-level rows (`ai_visibility`; units wrong, A5). **Missing**: CSV download in the UI of answers, questions (the panel), segments, sources, competitors; no export of the panel back to the import format |
| Alerts | **Partial** | Run alerts callout (garbled, A4), pulse alerts on tested changes, signed webhooks / Slack / Teams. Missing: customer-set thresholds and per-segment / per-competitor alert rules, alert history view for AI |
| Prompt management | **Partial** | Add (one per line), CSV import with a preview naming bad lines, edit / reword (history kept), pin / unpin, switch off / on, refused list with reasons, real-AI-question suggestions, persona / topic / market per question. Missing: bulk select + bulk actions, tags beyond one topic, prompt-level trend, "asked / not asked" state (A3), export, audit trail (A13), prompt volume beside every question where unknown |
| API / MCP | **Partial** | `GET /api/v1/websites/:id/ai-segments`, MCP `get_ai_visibility_segments`, table rows. Missing: answers, questions, sources and competitor-trend endpoints; write API for the panel |
| AI traffic and revenue | **Exists** | GA4 AI referrals, key events, revenue, landing pages (leaders mostly lack revenue); needs a sample floor (A17) |
| Crawler access / readiness | **Exists** | Crawler table + issues, readiness of key pages (AI growth) |
| Statistical honesty | **Exists in the engine, partial in the app** | Ranges, floors, BH-screened segment moves shown in the segments panel; undone by A1 / A7 / A8 on the main figures |

Top gaps to close first, by buyer impact: (1) a scoped global filter + per-engine and competitor SoV trends from the rows already
stored; (2) full answer text (engine change: store the answer, capped, with retention) + `citedUrls` rendered + per-question history;
(3) CSV downloads for answers / questions / sources; (4) bulk prompt actions + "not asked" state + audit trail; (5) alert rules.

---

## Deploy-safety notes

- **Tolerant readers.** `data.ts` maps every JSON column through `safeJson` / `arr` / `s` / `n`, and `aiSegmentsFromJson` reads the
  column list from the row (`cols`), so the engine adding fields or columns is ignored safely. What breaks silently instead of loudly:
  a renamed key (e.g. `cited_urls` items `{u,t}` -> `{url,title}` would render nothing), a changed separator (A4 is exactly that),
  a unit change (any rate moving to 0-1 would print 0.4% everywhere: version it as a new column, never repurpose).
- **Panel shape.** `panel_json` / `segments_json` changes are safe as long as `size`, `ids`, `overlap_with_previous`, `half_width`,
  `cols` keep their names; add a `v` bump test in `ai-panel.test.ts` for any rename.
- **Engine columns needed by the fixes** (engine side, `ladder_common.py` + `sync_tables.py`, run by `deploy_engine.py`):
  `seo_ai_visibility.compare_json` (A1, A8), optionally `seo_ai_daily.readable_json` (A7), a prompt state the engine writes for
  "asked this run" (A3). Rows written before them have empty values: every reader must treat empty as "not known" and fall back to the
  interim rules, never to "comparable".
- **No app Postgres migration** is needed for A1-A11; A12 may need one if inputs get an owning `org_id` on the app side; A13 uses the
  existing audit table.
- **Order.** App changes that only read new columns can ship before the engine; A2's quote change ships app-only (reads the monitors
  row the app already loads). Changing the BI export columns (A5) is a contract change for customers with warehouses: fix the
  descriptions now, add new columns later, announce in the changelog.
- **Data Table size.** `N8N_DATA_TABLES_MAX_SIZE_BYTES` (handoff §6) must be raised before any panel above ~150; when the table is
  full the engine's writes fail and the app keeps showing the last stored run with no staleness warning: add "last run N days ago,
  the weekly run is overdue" on the AI page when `checkedAt` is older than 8 days.
- **Payload growth.** Until A10 / A11, every panel raise makes `/data/ai` and the Overview heavier for every viewer; avoid selling
  300-500-question panels before the answers endpoint is paged.
- **Copy rule.** The AI UI components carry no em dashes or ellipsis characters, but engine alert texts shown in the app do (e.g.
  `AI_Metrics.js:497` uses an em dash): the engine-prompt cleanup in the owner's "no AI tells" rule is still open.
