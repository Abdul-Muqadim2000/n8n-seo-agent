# KI review: customer UX / UI and responsiveness (2026-11-08)

Independent review of the two new pages (Competitors, Keyword research), their run forms, guides, report renderers and the platform-admin
Off / Trial / On switch. Frozen snapshot `.claude/worktrees/ki-review` at **1e977e8f**. Read-only on code.

## How it was checked

- Web app built from the snapshot (`node:22-bookworm-slim`, deps in the named volume `kirev_ux_nm`, `vite build`), `dist` served through
  Playwright 1.55 (`mcr.microsoft.com/playwright:v1.55.0-noble`) with every `/api` call answered from fixtures.
- Fixtures are engine table rows (`shared/src/ki.ts` row types) passed through the server's own view functions in `shared/src/ki-api.ts`
  (`kiKeywordView`, `kiCompetitorView`, `kiGapView`, `kiRunView`, `kiSummaryOf`, `kiKeywordQueryOf` / `kiKeywordMatches` /
  `kiKeywordComparator` / `kiPage`), so every answer has the exact shape the A1 server sends (not the builder's hand-written shapes).
- Sites: an ERP / Dynamics 365 partner in the UAE with **5,000 searches**, 13 competitor rows, 30 gaps, a 5-step plan, AI share data and
  very long names (a 160-character search, a 52-character domain); a software agency with an Open edX niche (US, 143 searches, partial
  research run); an empty site (0 rows); a 1-row site; a refused run (market mismatch); a run that failed for credits; a Trial site; an Off
  site; a kill-switched site. Personas: owner, admin, member, viewer, platform admin.
- 4 widths (375, 768, 1024, 1440) x light / dark on both pages; axe-core 4.10 (WCAG 2 A/AA + best practice) at 375 and 1440 both themes;
  keyboard-only runs (choose up to 5, drawer, drawer CSV, filters, questions); loading, error (502 from the engine read), empty, partial,
  refused, out of credits, Off, Trial, kill switch; forms incl. a 402 "no credits" submit; Website settings switch; the four report kinds;
  JS chunks and API calls per page view.
- The builder's `render_check.mjs` was read but not trusted; its fixtures used the wrong shape for the score factors (see H1), which is
  why its pass did not see H1.
- Scripts: `REVIEW_UX_shots/scripts/` (fixtures.mts, harness.mts, matrix.mts, interact.mts, fix2.mts, run.sh). Screenshots:
  `REVIEW_UX_shots/` (37 files, 2.2 MB).

## Verdict

**Good bones, not yet the easiest in the market: do not switch a client to On before the five High items are fixed.**

What already works well: the pages look and behave like the rest of the app (same SummaryHero / Panel / InsightItem kit, tokens only,
Alaventra Blue the only accent, no gradients, correct dark mode); no horizontal page scroll at any width or theme; one h1 and a clean
heading order (h1 > h2 hero > h3 panels > h4 subsections); visible focus on every focused control; the drawer moves focus to Close,
Escape closes it and focus returns to the Details button; a nested sheet closes on its own with Escape; the answer to "who are my
competitors" is the hero headline, one click from the sidebar; empty states say what the run does, how long it takes and what it
costs; the partial-run and out-of-credits notes are calm and honest; viewer / member / admin / Trial gating is right (Off and
Trial-for-clients see nothing, Trial shows the banner to platform admins only, the switch is invisible to owners); a 402 at submit shows
"Not enough credits ... Open Credits"; no em dashes, curly quotes or stock AI phrases in the new copy; axe finds a single contrast
failure. The new chunks are small (CompetitorsPage 17 KB, KeywordsPage 22 KB, shared KI bits 6 KB, drawer 6 KB lazy).

What stops it: the score's "what makes up this score" is empty in production shapes (H1), one filter shows wrong results (H2), a
refused run is invisible on the page (H3), every "Start" on the plan and on 25 gaps is dead and the hero's next step cannot be clicked
(H4), and on a phone the pages are 12,000 to 17,000 px long (H5).

Clicks a non-technical owner needs (KI On, runs done): "who are my competitors" = 1 click (sidebar) and the hero answers it.
"What should I write next" = 1 click to read it ("First step: ..."), but acting on it from the page is impossible today: Start is
disabled, so the owner must find the matching tool, retype the keyword and submit (5+ clicks and typing). First time ever: 3 clicks
(page, run button, submit) plus a 6 or 12 minute wait, then the report's "Open ..." button.

## Findings

Format: id. what (screen, size, theme) - file:line - fix.

### High

**H1. "What makes up this score" lists one factor out of six (all scores, both pages, every size).** The A1 server sends the factors
nested (`factors: {fit, demand, win, value, gap}`, `shared/src/ki-api.ts:435`); the web reader looks for top-level `fit` / `demand` /
`win` / `value` / `gap` and finds none, so the tooltip shows only "How ready to buy the searcher is 100" plus "The range is wide". The
design's "factors on hover" promise and the guide's "Tap the question mark beside a score to see what it is made of" are broken, and the
first line reads "Score out of 100 for go". Shot: `i-kw-scoretip-1440.jpg`.
- `app/web/src/lib/ki.ts:354` (reader), `app/web/src/pages/site/_components/ki/common.tsx:116` (copy).
- Fix: read `o.factors?.fit ?? pick(o,'fit')` (same for each), add a test with the A1 view shape; title line "How this score of 86 is
  made" and one sentence per factor in plain words ("Fits what you sell: high").

**H2. The "Gap" filter of Every search shows wrong results (Keywords, 1440 / 768 / 375).** It is applied in the browser to the 50 rows
of the current server page only. Choosing "Competitors rank, you are missing" shows "No search matches these filters" while the header
says "5,000 searches match your filters" and the pager "1-50 of 5,000, Page 1 of 100"; paging on shows a few rows per page at random.
This is the filter an owner uses to answer "what should I write next". Shot: `i-kw-gapfilter-1440.jpg`.
- `app/web/src/pages/site/KeywordsPage.tsx:401, 413-418, 443`; `app/web/src/lib/ki.ts:424`.
- Fix: either add `gap_type` to the server query (A1 `kiKeywordMatches`, join on `seo_ki_gaps` by kw_key) or hide the Gap filter until
  it exists. Never show a client-filtered page under a server total.

**H3. A refused run is invisible on the pages (Competitors and Keywords, all sizes).** After a run refused for "market mismatch" the
page shows the first-time empty state ("Find out who you really compete with ... 21 credits") with no word about the refusal or what to
change. `KiRunNotes` covers paused, out of credits, partial and failed, not `refused`. The owner will run the same refused run again;
the reason lives only in a report they may not open. Shots: `s-refused-competitors-1440.jpg`, `s-refused-keywords-375.jpg`.
- `app/web/src/pages/site/_components/ki/common.tsx:50-92`.
- Fix: a calm Callout for `status === 'refused'` with `kiRefusalText(run.reason)` and the one action that fixes it (for market mismatch:
  "Run it for United Arab Emirates", linking the form with the market prefilled).

**H4. The plan and the gaps cannot be acted on from the page (both pages, all sizes).** Every plan step and every gap row carries a
disabled "Start" plus "Coming soon" (26 on the ERP Competitors page, 6 on Keywords), and the hero "Next step" box (both pages) has no
button. The page answers "what should I do next" and then offers no way to do it; 26 dead controls are also noise on every visit.
Known W2 dependency, but the interim fix is cheap. Shots: `m-competitors-1440-light.jpg`, `m-keywords-1440-light.jpg`.
- `app/web/src/pages/site/_components/ki/common.tsx:166-184`; `CompetitorsPage.tsx:160-164, 362, 392`; `KeywordsPage.tsx:177, 258, 274`.
- Fix: until `plan_start` exists, make Start a link to the existing tool with the fields prefilled (`paths.tool(org, 'keyword'|'ladder',
  {siteId, prefill:{keyword}})` for new_page / write / ladder; the guide for list / pitch / link), labelled "Write this page" / "Plan the
  ladder" / "How to get listed"; give the hero next step the same button. Drop the per-row "Coming soon".

**H5. On a phone the pages are 12,200 px (Competitors) and 16,800 px (Keywords) long at 375 (about 15 and 20 screens).** Everything is
expanded: 25 gaps, 12 topics, 10 striking, 15 questions, 50 search cards, three competitor sections. The answer and the first actions
drown; the CSV-level detail sits inline. Shots: `m-competitors-375-light-full.jpg`, `m-keywords-375-light-full.jpg`.
- `CompetitorsPage.tsx:365` (`slice(0, 25)`), `KeywordsPage.tsx:184, 296, 355`, table page size 50 (`lib/ki.ts:412`).
- Fix: show 5 per panel with "Show all N" (gaps: top 5 by value, grouped by kind); Every search 20 rows on phones; put "Every search"
  behind a "See every search" disclosure on phones.

### Medium

**M1. Kill switch reads as "not available ... rolling out to selected websites. Ask us" (both pages, platform admin and clients).** The
server sends `visible:false` while killed, so the pages bail out before the "Paused for maintenance" note can show (that note is dead
code), the sidebar items vanish for every On client, and a client who used the page yesterday is told it is "rolling out".
`CompetitorsPage.tsx:69`, `KeywordsPage.tsx:88`, `common.tsx:54-62, 134-147`. Fix: send `killed` to everyone on an On site and keep the
page with the stored results plus the paused note; Off keeps the not-available page. Shot: `p-padmin-s-killed-keywords.jpg`.

**M2. While the data cannot be read, the header offers a paid first run.** During the engine-read error (502, about 7 s of retries,
then "Could not load this / Try again") the header button reads "Find my competitors (21 credits)" / "Research my keywords" because the
rows are empty, inviting a paid run for data that exists. `CompetitorsPage.tsx:64`, `KeywordsPage.tsx:83`. Fix: hide the run button
while the list query is pending or in error; base "again" on `o.lastRuns[kind]`, not on the rows. Shots: `s-error-competitors-1440.jpg`,
`i-error-comp-1440.jpg`.

**M3. The paid re-run is the most prominent button on every visit (both pages, all sizes).** "Check my competitors again (21 credits)"
is the primary blue button above the answer even when the reading is from today. Fix: secondary style plus "Updated today" when the last
run is under 7 days old; primary only for the first run.

**M4. The drawer's search table is not built for phones (375).** It scrolls sideways inside a 333 px box (table 552 px), the sticky
first column wraps each search into 4 lines and the verdict and volume columns are off-screen; its "Filters" button opens a second
full-screen sheet holding one select. `pages/site/_components/ki/CompetitorDrawer.tsx:138-152`, `components/ui/table.tsx:177-185`.
Fix: pass `mobileCard` (search, their place, your place, verdict) and render a single-filter table as chips, not a sheet. Shots:
`i-drawer-375-table.jpg`, `i-drawer-375-nested-filter.jpg`.

**M5. Info tips are 20 x 20 px and carry every "what this means" (375, 768).** About 40 to 60 per page on the KI pages; at 768 every
small button is 28 to 32 px because `TAP` applies below 640 px only. `components/insight/disclosure.tsx:28`, `common.tsx:19`. Fix: a
40 px hit area around the 20 px icon (padding or `::after`), and `TAP` up to `md` (touch tablets).

**M6. Keyboard reach is long.** 22 Tab presses from the h1 to the first "Choose" (each competitor row has 5 stops: two info tips,
Details, two actions); 72 to the first filter of Every search; no in-page skip links. Fix: one "What these numbers mean" tip per row
instead of two; a short in-page index ("Your plan, Topics, Every search") of anchor links under the hero.

**M7. The two tools sit under "More tools: Everything else" at the bottom of Run an analysis**, not in "Research" next to Keyword
discovery and Keyword verdict; and "Keyword discovery" (39 credits) beside "Keyword research" (57 credits) is two names for the same idea
to an owner. The tool form breadcrumb reads "Keyword research > Keyword research", and the autopilot list already has a "Keyword
research refresh" that means discovery. `app/web/src/pages/tools/ToolsPage.tsx:39`, `shared/src/constants.ts:348`,
`shared/src/autopilot.ts:119`. Fix: add both to the Research goal; one sentence on each card saying which to pick; rename the old
category or the autopilot line. Shot: `t-tools-more-1440.jpg`.

**M8. Two different topic counts on one screen, and the topic filter offers 60 of them.** Hero "grouped into 219 topics", Topics panel
"179 topics", "167 more topics in the table below (filter by topic)" while the Topic select lists 60. `KeywordsPage.tsx:155-156, 182,
216, 398`. Fix: one count from the summary; a searchable topic picker (or the server's facet list) instead of the first 60 heads.

**M9. Overlap counts are labelled "measured" but come from the 200 best searches only.** The drawer's "You both rank / Only they rank /
Only you rank" are computed from the 200-row keyword read, so on a 5,000-search site they undercount silently. `CompetitorsPage.tsx:42,
53`, `CompetitorDrawer.tsx:33-38, 127`. Fix: compute on the server over all rows, or say "among your 200 best searches".

**M10. "Get listed" looks like a button and does nothing (Lists and directories to join).** It is an accent Badge; there is no link
to the directory, no guide, no step. `CompetitorsPage.tsx:199`. Fix: a real button opening the directory's "add your company" page or
a short guide, and a "Done, I am listed" mark.

**M11. The CSV downloads speak engine.** The page CSVs (server) have headers like `kd`, `cpc`, `gsc_position`, `gate`, `cluster_id`,
`is_head`, `serp_read_at`, `class_basis`, `status_by`, `serp_share` and values like `fail`, `new_page`, `candidate`, `llm`; the gap CSV
hard-codes `basis: measured`. The drawer CSV (browser) has plain headers, so the two disagree. `shared/src/ki-api.ts:640-663`. Fix:
plain headers and labels (the ones the page shows), raw columns at the end or in an "all columns" export for enterprise teams.

**M12. The verdict is the smallest thing in a topic row (1440, 1024).** It sits in the action slot at the far right, about 900 px from
the topic name, as a 20 px badge, while the row is led by "Ready to hire" / "25 searches" chips. `KeywordsPage.tsx:212`. Fix: verdict
first among the meta chips (or in front of the title), size md; keep the reason under it.

**M13. Every search rows are about 100 px tall at 1440** because "Where from" wraps to 4-5 lines ("Your Search Console, Your
competitors rank for it"); a 50-row page is about 5,000 px. `KeywordsPage.tsx:435`. Fix: show the source count with the names in a tip,
or one primary source.

**M14. The Competitors page fetches 200 keyword rows (233 KB of JSON for the ERP site) on every view** only for the drawer, before
anyone opens it; the Keywords page makes 7 KI requests (overview, 4 keyword reads, gaps, latest report + report; about 330 KB
uncompressed). `CompetitorsPage.tsx:53`, `KeywordsPage.tsx:64-72`. Fix: load the drawer's searches when the drawer opens (per competitor
`?competitor=`), and one summary route for heads / striking / questions / plan.

### Low

- **L1** Contrast: "(21 credits)" / "(54 credits)" in the run button is `opacity-80` on blue, 4.31:1 (AA needs 4.5) - axe, all themes and
  sizes. `common.tsx:34`. Fix: full opacity or `font-medium` at 14 px.
- **L2** Plurals: "We found 1 searches ... grouped into 1 topics" (1-row site). `KeywordsPage.tsx:168`. Shot `s-one-row-keywords-1440.jpg`.
- **L3** Buyer questions are shown lower case without "?" ("how much does dynamics 365 business central cost in dubai") although
  `kiQuestionText` exists. `KeywordsPage.tsx:359`.
- **L4** Truncation without a title: "Your page: gulfdynamics-partners.ae/services/dynamics-365-fi..." (375, Just off page one) and the
  "Your page" column (1440); the Gap select cuts "Competitors rank, yo". `KeywordsPage.tsx:300, 382, 436`. Fix: `title` on truncated
  text, wider select or shorter labels.
- **L5** Sticky first column: body cells lose the row divider and the header cell is lighter than its row (`bg-surface-2` vs
  `bg-surface-2/70`). `components/ui/table.tsx:239, 284`. Shot `kw1440-light-3.jpg`.
- **L6** Word choices: "Go" alone as a verdict and a hero stat label ("Go 73") reads oddly to an owner ("Go for it" or "Win soon");
  "Software maker or principal" (principal is jargon); "Close competitor" vs "Direct competitor" is not explained on the page;
  "Please check: are they like you?" has no hint that Choose / Not a competitor is the answer; "keyword universe" in the tool card.
  `shared/src/ki.ts:88, 125-126`, `shared/src/constants.ts:333`, `CompetitorsPage.tsx:277`.
- **L7** Source labels "Keyword ideas", "Keyword suggestions", "Related keywords" are provider products that mean the same thing to an
  owner; "Competitors rank, you do not" (source) and "Competitors rank, you are missing" (gap) sit in two filters side by side.
  `shared/src/ki.ts:158-172`. Fix: one "Google keyword tools" label; distinct wording.
- **L8** Partial note joins parts with a comma only: "We could not read search volumes, your Search Console searches this time."
  `lib/ki.ts:583`. Fix: "search volumes and your Search Console searches".
- **L9** Viewers see disabled question checkboxes with no reason (members get one). `KeywordsPage.tsx:352`.
- **L10** The run button label flips from "Research my keywords" to "... again" when the lists arrive (loading). Same fix as M2.
- **L11** Hero "Go / Takes a few months" counts fall back to the 200 heads read when the run counts lack them (undercount on big sites).
  `KeywordsPage.tsx:152`.
- **L12** Report renderer: the stats take the first four labels with values, so "Searches found 5,000" is dropped for "Steps in the
  plan"; a refused report has no next action (no "Run it again for ..."). `components/reports/ki.tsx:15, 23, 35`.
- **L13** "Just off page one 227" in the hero, 10 in the panel, no "see all" (link to the table with a striking filter).
- **L14** The Competitors page mixes three list styles for long lists (InsightItem rows for 25 gaps, Badge clouds, a DataTable in the
  drawer) where Rankings and AI visibility use a DataTable with sort and search for long lists. Consistency, and it would also fix H5 for
  gaps.
- **L15** Filters for a 1-row result: seven selects above a single row (1-row site). Hide filters under about 20 rows.
- **L16** Website settings switch (platform admins): fine and clear; the segmented control is 32 px tall at 375 and there is no
  confirmation before switching a client website to On (only an info line). Shot `g2-settings-padmin-375.jpg`.

### Checked and fine (no finding)

Horizontal scroll 0 px at 375 / 768 / 1024 / 1440 light and dark (the only element past the edge is the hero's decorative image, clipped).
axe: no violations besides L1 and the app shell's logo outside a landmark (not KI). Headings in order on both pages. Focus visible on
every Tab stop checked (0 without a ring). Choose up to 5: the 6th Choose is disabled with "You follow 5 already"; toasts in plain words;
"Not a competitor" and "Put back on the watchlist" work; the 409 text is plain. Drawer: lazy chunk (6 KB), focus in, Escape out, focus
back, CSV downloads the filtered rows with plain headers. Questions: Space ticks, "Add 2 to my AI questions" says what happens and that
nothing is charged; members are told it takes an admin. Trial banner and Trial note in the form for platform admins only; Off / Trial
for clients show nothing in the nav and the tool link says "This tool does not exist". Out of credits: page note with "Open Credits", and
the 402 at submit shows "Not enough credits ... Open Credits". Forms show credits and time before the run and the "nothing changed, no
charge" note. Guides: plain, no AI tells; the score step depends on H1. Dark mode: contrast and tones hold. Every number on the lists
carries a tip with "How we know: measured / estimate from ... / our estimate" and a date (except the hero stats, which rely on the
eyebrow's "Updated" date: acceptable). Jargon KD, SERP, etv, cluster, intent never reaches the screens (it does reach the CSVs, M11).

## Top 5 changes for ease of use

1. **Make every next step clickable now** (H4): plan steps, gap rows and the hero's next step link to the existing tool with the keyword
   prefilled ("Write this page", "Plan the ladder", "How to get listed"). That turns "what should I write next" into one click.
2. **Cut each panel to 5 with "Show all"** and collapse Every search on phones (H5, M13, L14): the page becomes the answer plus a few
   actions, not a 20-screen report.
3. **Fix the two wrong-data paths** (H1 score factors, H2 gap filter, M8 topic counts, M9 overlap basis): an owner who once sees a
   number contradicted on the same screen stops trusting the page.
4. **Say what happened to the last run, always** (H3 refused, M1 paused, M2 read error, M3 re-run prominence): one status line under the
   hero ("Updated today", "Last run stopped: choose United Arab Emirates", "Paused for maintenance: results below are kept") and the paid
   button only when a run is due.
5. **Put both tools where people look and make phones and tablets touch-friendly** (M7, M4, M5): Research group with one line on which
   to pick, mobile cards in the drawer, 40 px hit areas on the info tips and small buttons up to 1024 px.

## Second pass on 3a990e62

Same method, rebuilt from the frozen snapshot at **3a990e62** (`vite build`, deps in `kirev_ux_nm`) and driven with Playwright 1.55.
The fixtures were updated to the new contract and still go through the server's own view functions in `shared/src/ki-api.ts`:
- gate codes `gate_reason` plus `gate_detail`, so the view gives plain words;
- `win: null` rows read "Not judged yet";
- `gap_type` is filtered on the server through `kiGapTypesIndex`;
- `killed` is sent on On websites;
- Trial quotes 0 credits;
- `striking` is set from the engine rule (100 impressions);
- plan actions with `cluster_id`;
- real UUID site ids (the run forms check for them).

The checks:
- 375 / 768 / 1024 / 1440 px, light and dark, axe at 375 and 1440;
- 9 states and 5 personas;
- every prefilled link on both pages followed to its landing page, with the form values read back (27 links);
- the Website settings switch, the tools page and the reports.

Scripts are in `REVIEW_UX_shots/scripts/` (`pass2.mts`, `check4.mts`, `check5.mts`; `fixtures.mts` / `harness.mts` are now the pass-2
versions). Screenshots are in `REVIEW_UX_shots/pass2/` (22 files, 1.5 MB).

### Verdict

**Ready for a client to see, in Trial now and in On after one small count fix (N1). No High is left.** All five Highs are fixed or
fixed enough:
- H5 is partly fixed: Competitors is still about 6 screens at 375 px.

The answer and the next action are now one or two taps away, and every action button lands on the right tool with the right values.
No horizontal scroll at any width or theme, one h1, no console errors. axe finds 0 KI violations; the only one left is the app shell's
logo outside a landmark, at 375 px only.

Clicks:
- **Who are my competitors:** 1 click (sidebar). The hero headline names them.
- **Act on "what should I write next":** 3 clicks.
  1. Sidebar: Keyword research.
  2. Hero "Next step": "Improve this page" or "Write this page".
  3. "Write a page" opens with "Pre-filled for you". Website, country, keyword and (for Improve) the own page address are filled in, and the 114-credit price shows before the run. Submit.

  Before, there was no way to act from the page.
- **First time ever:** unchanged. Run button, form, submit, a 6 or 12 minute wait, then "Open ...".

Prefilled links followed (27):
- **Write this page:** lands on "Write a page" with the keyword (and own page address for Improve).
- **Improve this page / Refresh this page:** same form, with the keyword and the page address.
- **Plan the ladder:** "New keyword ladder" with the keyword and United Arab Emirates.
- **How to get listed:** Link building.
- **Run it for United Arab Emirates** (refused run): the Keyword research / Competitors form with the country set.

Not verifiable with these fixtures (the target pages need their own data, which my fixtures do not carry):
- "How to get named" (AI visibility page);
- whether `#listings` scrolls to the listings section.

### Pass-1 findings: status

| Id | Status | Evidence (pass 2) |
|---|---|---|
| H1 score factors | **fixed** | "How this score of 86 is made", 6 factors in words (`x-kw-scoretip-1440.jpg`) |
| H2 gap filter | **fixed** | "Against competitors: You are missing" gives "10 searches match your filters" and 10 rows; counts agree (`x-kw-gapfilter-1440.jpg`) |
| H3 refused run | **fixed** | Note "The last run did not start: it was for another country" + "Run it for United Arab Emirates" (prefilled) + Website settings; no first-run empty state under it (`s-refused-keywords-375.jpg`) |
| H4 dead Start | **fixed** | 0 "Coming soon" on both pages; plan, gaps, topics, striking, listings and both heroes link to the tools (see above) |
| H5 phone length | **partly** | At 375: Keywords 16,800 -> **4,024 px**; Competitors 12,200 -> **5,353 px** (about 6 screens). "See every search" opens 50 cards (13,194 px) |
| M1 kill switch | **fixed** | "Competitors is paused for maintenance. It is back shortly, with your results as they were"; nav items kept |
| M2 paid run during error | **fixed** | No run button while loading or in error; "Could not load this / Try again" |
| M3 re-run prominence | **fixed** | Secondary button + "Updated today" |
| M4 drawer on phones | **fixed** | 15 cards, table hidden, no nested sheet, verdict chips (`x-drawer-375-dark.jpg`) |
| M5 tap targets | **partly** | KI tips have a 40 px hit area (`KI_TIP`, `::after` inset 10 px). Still 20 px: the shared hero / panel "About ..." tips. At 768 px buttons are still 32 px (`TAP` applies below `md`, so a portrait tablet is not covered) |
| M6 keyboard reach | **not fixed, worse** | 24 Tab presses to the first Choose (was 22); **115** to the first filter on Keywords (was 72), because of the new action buttons |
| M7 tools placement | **fixed** | Both tools in Research; no "More tools"; the form says when to pick it over Keyword discovery |
| M8 topic counts | **fixed** | "183 topics" in both hero and panel; topic picker lists all 183, A to Z |
| M9 overlap basis | **fixed** | "Among your 200 best researched searches." |
| M10 Get listed | **fixed** | Real link "How to get listed" to Link building (anchor scroll unverified, N9) |
| M11 CSV words | **fixed** (code) | `KI_*_CSV_HEADERS` plain words, values in page words (the CSV route is mocked in the browser, so checked in `shared/src/ki-api.ts`) |
| M12 verdict place | **fixed** | Verdict leads the topic row |
| M13 "Where from" wrap | **fixed** | "2 sources" with the names in a tip |
| M14 eager reads | **partly** | Drawer data loads on open; Keywords still makes 7 KI reads (skipped by FX-A) |
| L1 contrast | fixed | axe clean |
| L2 plurals | fixed | "1 search ... 1 topic" |
| L3 questions | fixed | Shown as questions; acronyms lose their case ("Vat compliant ...?") |
| L4 truncation | fixed | No untitled truncation found at 375 |
| L5 sticky column | not fixed | Skipped (shared DataTable) |
| L6 words | partly | "Software maker", new "needs review" wording; "Go" kept (owner K5) |
| L7 source labels | partly | `gap` reworded; the three keyword-tool labels remain |
| L8 partial note | partly | Fixed on the page ("search volumes and your Search Console searches"); the **report** renderer still says "search volumes, your Search Console searches" |
| L9 viewer reason | fixed | Viewer sees why the question boxes are off |
| L10 label flip | fixed | No button while loading |
| L11 hero counts | fixed | From `headsByVerdict` |
| L12 report | fixed | "Searches found" first; refused report has "See what to do". "5000" is not formatted ("5,000") |
| L13 striking see-all | fixed | "See all 211 in the table" |
| L14 list styles | not fixed | Skipped |
| L15 filters on tiny lists | not rechecked | FX-A says hidden under 20 rows |
| L16 confirm before On | fixed | Inline "The owner agreed: show <domain> both pages from now on"; Save disabled until ticked |

Trial and personas:
- **Platform admin on Trial:** the banner shows, the run buttons say "(free trial run)", and the form says "Trial run is our team's check: it costs the client company no credits."
- **Owner on Trial:** sees "not available", with no nav items.
- **Viewer:** no action buttons.
- **Member:** actions shown; the questions panel says adding takes the admin role.
- **Admin:** "Add to my AI questions" shown.

### New problems

- **N1 (Medium): two gap counts on one screen.** The Competitors hero says "Gaps to act on 30"; the panel below says "21 places where
  the competitors you follow are found and you are not". The hero counts every open gap from the server summary, including the kinds the
  page now hides (listing, page_type, ai_answer, backlink); the panel shows only the keyword kinds. This is the kind of contradiction M8
  was about.
  - Where: `CompetitorsPage.tsx` hero `gapsOpen` (`o.summary.gaps.open`).
  - Fix: count only `KI_KEYWORD_GAP_TYPES` in the summary, or on the page.
- **N2 (Low): a "Not for you" topic row gives two reasons.** The verdict badge shows the general "This search does not fit what you
  sell." because no reason is passed, and the specific reason sits under it ("People searching this are looking for a job.").
  - Where: `KeywordsPage.tsx:210, 230`.
  - Fix: pass `head.gateReason` to `KiVerdict` and drop the separate line.
- **N3 (Low): "Not judged yet" rows still show a score with a range** ("Not judged yet ... 55, likely 39 to 71"). This reads as a
  judgement.
  - Fix: show "-" or "score not ready" for `unknown`.
- **N4 (Low): factor words have no direction.** "Competitors already there: high" does not say whether high helps or hurts.
  - Fix: one word per factor such as "helps" / "holds you back", or invert the wording.
- **N5 (Low): the refused note is ambiguous.** "Your website is measured in United Arab Emirates. Change the country in Website
  settings, or run it again for United Arab Emirates" can read as "change your website's market".
  - Fix: "The last run asked for another country. Run it for United Arab Emirates." Keep Website settings as a secondary link.
- **N6 (Low): viewers see the Website settings link.** The line about the two competitor lists links to Website settings, which
  viewers cannot change.
- **N7 (Low, unverified): "How to get listed" may not reach the listings.** It goes to `links#listings`. The `#listings` section renders
  after its data arrives, so the browser probably does not scroll to it.
  - Fix: scroll on mount when `location.hash` is set.
- **N8 (Low): "Searches found" counts "Not for you" searches.** Its tip says "Every search we kept because it fits what you sell", but
  the 5,000 includes the gated ones (pre-existing). Fix: change the number or the tip.
- **N9 (Low): "See every search" on a phone opens 50 cards (13,194 px).**
  - Fix: 20 rows per page on phones.

### Top changes left, in order

1. **N1:** one gap count.
2. **M6:** Keywords needs 115 Tab presses to reach the filters. Add a short in-page index under the hero ("Your plan, Topics, Just off
   page one, Every search") as anchor links, and one tip per competitor row instead of two.
3. **Competitors at 375 px:** about 6 screens. A compact phone row would get it to about 4: the reason in a tip, one "More" menu for
   Watch / Not a competitor.
4. **N2-N4:** verdict wording polish ("Not judged yet" without a score, factor direction, one reason per gated row).
5. **M5 rest:** 40 px hit area on the shared hero / panel tips, and `TAP` up to `lg` for portrait tablets.
