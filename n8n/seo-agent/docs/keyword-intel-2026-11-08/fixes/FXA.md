# KI FX-A: the app fix round (2026-11-08, branch `ki/fxa`)

Scope: every app-side finding of `REVIEW_UX.md`, `REVIEW_CONSISTENCY.md`, `REVIEW_PERF_SAFETY.md` (app items) and `REVIEW_LOGIC.md` H9 (app
side), on top of FX-L's contract (`ki/fxl` merged: `f4872f92` first, then the branch head `e9fd4976`; the engine is the source of truth for
the shared constants). Nothing pushed from the main repo, deployed or run against production; no paid call.

## 1. Trial: private and free (CONSISTENCY H1, PERF_SAFETY H1, L2, L3, L8, L13)

ONE check, `server/src/services/ki.ts`: the run mark `input.kiTrial` (set at the start when the website's switch is Trial), the report mark
`summary.trial` (a KI callback in Trial, or ANY callback of a Trial run: a refusal at the door has stage `rejected` and no mode, L2), JS
`kiRunVisible` / `kiReportVisible`, SQL `NOT_KI_TRIAL_RUN` / `NOT_KI_TRIAL_REPORT` and `kiRunConds(user)` / `kiReportConds(user)` (none for a
platform admin). Shared twins `kiTrialRun` / `kiTrialReport` in `shared/src/ki.ts`.

| Path | Now |
|---|---|
| Quote and charge | `assertKiRunAllowed` answers `{trial}`; a Trial run is started like the free setup research: quoted 0 (cost sync caps it at 0), platform ceiling still checked; `GET .../ki` quotes 0 / 0 in Trial; the form and the run button say "free trial run" |
| Runs list, run detail | filtered in SQL before the limit (L13); detail 404 for anyone but a platform admin |
| Reports list, report, Overview "Latest reports", Pipeline, dashboards | `reportsList` hides them unless the caller passes a platform-admin `viewer`; report detail filtered in the read |
| Needs you `failedRuns`, Pipeline active runs | `ladderAppSources` never reads a Trial run |
| Delivery (each report, digests, manual "send now") | skipped, not "held", no row in the delivery log, code `trial` skipped like `interim` |
| Webhook / Slack / Teams events | `!trial` at the callback; `emitRunsFailed` ignores Trial runs |
| Share links | the one check |
| Credits | usage rows of a Trial run never form a feature row on the Credits page (and 0-credit rows are not in the activity anyway); the company's month spend leaves them out (the platform total keeps them) |
| API v1 / MCP runs and reports, warehouse exports | never, also for a platform admin's key |
| Kill switch (L3) | checked before any credit is locked: 409 `ki_paused` |
| Mode lookup (L8) | the website's own monitors row, as `kiState` |

Tests: `server/test/kiTrial.test.ts` (new, real Postgres through PGlite, every migration): the platform admin's run is quoted 0 and marked;
the client cannot start it and reads Trial as Off; the run is in no client list and its detail is 404; both reports (KI answer and a
no-mode refusal) carry `summary.trial`, are 404 / absent for the client and present for the admin, absent from the Overview reader and API
v1; delivery sends nothing and writes no log row even when forced; no Credits feature row, company spend 0, platform spend > 0, no share
link; a failed Trial run is not a Needs-you item; On is unchanged (quoted credits, listed) and the kill switch refuses before anything
starts; the `avoid` list (below) reaches the engine. Plus `kiW0.test.ts` (the `{trial}` answer, `ki_paused`, the own-row lookup) and
`kiCallbacks.test.ts` (the one mark at the callback).

## 2. Off sites see nothing new (CONSISTENCY M1, L6)

`useOrgKiVisible` (web, same cached query as `useKi` per verified website): the Delivery chooser offers `ki_competitors` / `ki_research` and
the Reports "Type" filter the two final stages only when the person sees KI on at least one website; started notices are never in the
filter. The report renderer offers no "Open ..." link to client-portal roles. Tools page: the Research goal lists the two tools only where
they are offered, so its count and cards are unchanged for Off websites.

## 3. UX Highs

- **H1** score factors: `kiKwOf` reads A1's nested `factors` (fixture shapes in `test/ki.test.tsx` now include the nested view); tip "How
  this score of 86 is made", one line per factor with high / medium / low. Browser: all six factors shown (`FXA_shots/a-kw-scoretip-1440.jpg`).
- **H2** gap filter: server-side `gap_type` (`kiKeywordQueryOf`, `kiKeywordMatches` with `kiGapTypesIndex` over the CURRENT gap rows); the web
  sends it and shows the server's rows as they are (the client-side filter `kiFilterKeywords` is gone). Browser: "6 searches match your
  filters" with 6 rows (`a-kw-gapfilter-1440.jpg`; before: "5,000 match", 0 rows).
- **H3** refused / failed: `kiStopNote` -> a calm note with the reason and the fix ("Your website is measured in United Arab Emirates. Change
  the country in Website settings, or run it again for United Arab Emirates. Nothing was charged." + "Run it for ..." prefilled + "Website
  settings"); the first-run empty state is not shown under it (`a-s-refused-*`).
- **H4** actions now: `kiActionLink` + `KiActionButton`: plan steps, gaps, topics, striking rows, listings and both heroes' next step open the
  existing tool or page with the search filled in ("Write this page", "Improve this page" with the own page, "Plan the ladder" -> New keyword
  ladder, "How to get listed" -> Link building listings, "How to get named" -> AI visibility, "Find websites to ask" -> Link building). No
  "Coming soon" anywhere; members and above only. The plan's Start route stays 501 and is not called.
- **H5** phones: `useShowAll` (3 per list on a phone, the old count wider, "Show all N"), Watchlist collapsed on a phone, gap chips one
  scrolling row, "Every search" behind "See every search (N)" on a phone, filters hidden under 20 rows (L15). Page height at 375 px: Competitors
  **12,200 -> 5,353 px**, Keyword research **16,800 -> 4,021 px** (the brief's ~4 screens is met for Keyword research; Competitors is about 6
  screens at 900 px because each competitor row carries its reason, two figures and three buttons: see section 7).

## 4. UX Mediums and Lows

Fixed: M1 (pause said as a pause, nav kept: `killed` sent on On websites), M2 + L10 (run button hidden while the lists load or fail; "again" from
the last run), M3 (secondary + "Updated today" for 7 days), M4 (drawer: cards on phones, verdict chips instead of a second sheet, data loaded
only when a drawer opens = M14 for the drawer), M5 (40 px hit area on KI tips via an invisible `::after`, `TAP` up to `md`), M7 (tools in
Research, category "Research", one line on which to pick, no "Keyword research > Keyword research"), M8 (one topic count from
`summary.keywords.headsByVerdict`; topic picker lists every loaded head A to Z), M9 ("Among your 200 best researched searches"), M10 ("Get listed"
is a real link to the listings step), M11 (CSV: plain-word headers in a stable machine order, `KI_*_CSV_COLUMNS` / `_HEADERS`, documented in
API.md; values in the page's words; gap basis per kind), M12 (verdict leads the topic row), M13 (source count with names in a tip). L1 (full
opacity credits text; axe now finds only the app shell's logo landmark, not KI), L2 (plurals), L3 (questions as questions), L4 (titles on
truncated text, short gap labels), L6 ("Software maker", "Please check: do they sell what you sell?"), L7 partly (source `gap` reworded),
L8 ("a and b"), L9 (viewers told why), L11 (topics by verdict over all rows), L12 (report: searches found first; refused report "See what
to do"), L13 ("See all N in the table" sets a striking filter), L15, L16 (confirm before On, 40 px segments).
Skipped: M6 (fewer tab stops / in-page index: the row's tips and actions are each needed; the phone collapse already shortens the tab path),
M14 for the Keywords page (one summary route = a server change across A1's contract; the four reads are cached 60 s), L5 (sticky column
styling is the shared DataTable, every table; left for a kit pass), L6 "Go" (FX-L kept the verdict word; owner K5), L7 merging the three
keyword-tool sources (the server filters by one source; merging needs a multi-source filter), L14 of UX (the KI page list styles).

## 5. Consistency Mediums / Lows

M2 one striking definition: shared `KI_STRIKING` / `KI_STRIKING_WORDS` (FX-L's), the web reads `row.striking` only, `kiQuickWin` = striking
on a search that fits; the recommendation is "N searches just off page one" and counts what its section shows; the server's `striking=1`
filter uses the same rule. M3 gate reasons: `KI_GATE_WORDS` per FX-L code (`gate_reason`), `gate_detail` never leaves the server (view and CSV
carry plain words; legacy sentences matched to a code or the general line). M4: basis `inferred` = "our reading of the results", Claude 0
in the quote (FX-L's cost rows). M5: "Hard for your website now" everywhere (FX-L's constant; marketing and changelog updated). M6: marketing
and guide copy only real behaviour (gap step = "a button that opens the tool", Solutions "the newest as they roll out", competitors tagline
"Rolling out", "Nothing starts without your click" is now true). M7: one story for the two competitor lists (line on the page with a link
to Website settings, guide Q&A; FX-L starts declared competitors as chosen). L1 icons (Swords / Telescope on report rows), L2, L3 (stage
"Competitors started"), L4 (billing labels), L5 (search-kinds chips, LOOP_MAP), L6, L8 (API.md), L9 (backlog rows), L10 ("DataForSEO Labs"
-> "our keyword data"), L12 (guide "we will look at it"), L13, L14 (form "up to a month for search volumes and the competitor set").
FX-L's contract items applied: verdict `unknown` ("Not judged yet") in every verdict-keyed map, filter, drawer chips, guide; `KI_ROW_CURRENT`
(`kiCurrentRows` in `kiData`: per market, only rows of the newest keyword_research run with status ok / partial; API.md); gap types the
engine does not produce yet (topic, page_type, ai_answer, listing, backlink) are not shown and the copy says they come later; the app
sends `avoid` (keyword checks found off-topic or navigational, AVOID verdicts; max 200) appended to the KI request body, after the form's
fields, so the payload key order, `export:payloads` and S23 are unchanged.
Skipped: L7 `kiCreditsEstimate` (unused but tested; harmless), L11 RETRYABLE (a KI run lost to a restart is closed failed and refunded, not
re-started: the TTL reuse makes a manual re-run free for what was read; decision recorded here), PERF L7 (KI prices in `/costs` for every
company: the form's fallback price reads it; nothing renders them on Off sites).

## 6. Stale rows (LOGIC H9, app side)

`kiCurrentRows` (`server/src/services/kiData.ts`), FX-L's `KI_ROW_CURRENT`: counts, lists, facets, gap index and CSV read only current rows;
a row of an unknown older run is stale once a known run wrote the table. Test: `kiRoutes.test.ts` "rows of an older keyword-research run are
neither listed nor counted".

## 7. Browser pass (reviewer's scripts, `fixes/FXA_shots/`, `fxa.mts` added for the Highs)

Same fixtures (A1 view functions), patched only for the new server answers (gap index, `killed` on On, Trial credits 0). 375 / 768 / 1024 /
1440, light + dark, both pages: horizontal scroll 0 px everywhere, one h1, no console errors; axe: 0 KI violations (only the app shell's
logo outside a landmark, pre-existing, not KI). States: empty, one row, partial, refused (note + fix, no empty state), out of credits, Off
(not available), engine error, loading. Personas: viewer / member / admin (On), platform admin Trial (banner, "free trial run"), killed
("paused for maintenance", nav kept), owner on Trial (not available, no nav).

| Check | Before (REVIEW_UX) | After |
|---|---|---|
| Score tip | 1 factor of 6, "Score out of 100 for go" | 6 factors in words, "How this score of 86 is made" |
| Gap filter "You are missing" | header 5,000, 0 rows | header 6, 6 rows, pager agrees |
| Refused run | first-run empty state | note with the reason, "Run it for United Arab Emirates", Website settings |
| Plan / gaps Start | 26 + 6 dead "Coming soon" | links to the existing tools, prefilled; 0 "Coming soon" |
| Height at 375 px | Competitors 12,200, Keywords 16,800 | 5,353 and 4,021 |
| Kill switch | "not available ... rolling out" | "paused for maintenance", links kept |
| Run button contrast (axe) | 4.31:1 | no violation |
| Tools | under "More tools" | Research, 5 tools, no "More tools" |
| Drawer at 375 | 552 px table in a 333 px box, nested filter sheet | cards and chips, table hidden |

## 8. Checks (once, `node:22-bookworm-slim`, whole worktree mounted, deps in volume `kifxa_nm`)

Typecheck shared / server / web: clean. Tests: shared **1145 passed**, server **2039 passed, 46 skipped** (real-Postgres suites gated as before;
`kiTrial.test.ts` runs on PGlite and passes), web **344 passed** (36 files). Web build OK.

## 9. Open (for the orchestrator / owner)

- Competitors at 375 px is ~6 screens; a compact phone row (reason in a tip, one "More" menu for Watch / Not a competitor) would get it to 4.
- `POST .../plan/:id/start` stays 501 (W2); the links cover it until then.
- Verdict word "Go" (UX L6) and app-wide verdict words: owner K5.
- API v1 `get_table` KI tables are raw stored rows (no current-row filter, as "rows as stored" says); add one if warehouse users ask.
