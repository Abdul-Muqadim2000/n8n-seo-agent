# WAVE 0.6: four fixes, offline pins and the deploy checklist (2026-10-30)

Anonymised. Sites: **client A** (UAE Microsoft Dynamics partner), **client B** (UAE AI and software agency), **own site** (our product
site). Evidence (executions, page texts, judge files, the blind keys) stays in the run's local folder and is never committed.

- Build: **W06** = Wave 0.6, `5d72a7d9` on `feature/seo-agent-v4.5` (W06-A `91b71099` exclusions + grade guards, W06-B `cb937e77`
  reliability + "Write it anyway" address, integration `42fb9c22`), then **W06-C** `df9126da` (the two open items, section 8), rebuild
  `b447c71f`. Compared with **W05** (`1e705b72`, `WAVE05.md`) and **AFTER**
  (`fed34d3c`, `BEFORE_AFTER.md`).
- **Nothing deployed. Production not touched.**

## 0. Status: the paid re-check ran, and stopped at the hold (page reader out of balance)

After the owner freed disk space, the K1 re-check ran on the isolated `alvrun-*` stack rebuilt from **`b447c71f`** (2026-10-30 12:53-13:04
UTC). The stack, the restore and the seeding were exactly as in Wave 0.5. **But the page reader account that every page read goes through
had run out of balance** (HTTP 402 "please recharge" on every read, between 10:13 and 12:56 UTC that day). With no client, competitor or
regulatory page read, K1 was held on its search score alone, and the run was stopped there on purpose: a page written without any page
read would not be comparable with W05 or AFTER and would spend about $1 for nothing. Re-probed at 13:06 UTC: still 402.

So there is **still no new judge score in this file** (no blind set was made). What is measured is offline: the recorded W05 executions
replayed through the W06 code, and the full harness. Section 9 has the run and what it found; earlier, two attempts were blocked by the
15 GB disk rule ($0).

## 1. The four fixes and their offline pins

| # | Defect (WAVE05) | Fix | Offline pin (all on recorded runs, $0) |
|---|---|---|---|
| 1 | 3.1 HIGH, in production: the verdict-exclusion matcher dropped "GP" and "SL", matched every "Dynamics" heading and deleted six core sections of K1 (2,407 -> 1,023 words) | `_exclusions.js`: capital acronyms and tokens with a digit are topic words, matched in capitals; a topic that lost a short word matches only on its full phrase; one word of the keyword family (keyword, brief keywords, site services) never matches. A section is deleted only with a second signal (its heading names the topic, or two of its sentences do); otherwise at most one section of at most 20% of the words, never 40% of the page; every decision recorded with its reason | **W06A1-W06A3** on the anonymised K1 replay: the new check flags **0** sections (was 9); handed the recorded list of 9, Page Candidates deletes **0** and keeps all 9 with reasons; the page keeps its six H2 sections and 2,210 words (W05 delivered 1,023). **EQA4** (integration fix): the "ai" of "ai consultant" still counts as its acronym, so an excluded topic still leaves the brief |
| 2 | 3.2 HIGH, in production: a complete page ending on a bare "Book a consultation" line failed as cut off (about $0.85 lost), its ledger row stayed `reserved` at $0, and the app then said the page "was already written" | `_complete.js` accepts a final short call-to-action line (the brief's CTA, or a button made of the last section's words) after a clean paragraph; a really cut line is still caught. A page cut twice now routes to *Mark Page Run Failed* (the run's started row becomes `failed`) and the settle chain (the ledger row settles what was spent and says the run failed). The app never counts a failed run's row as written or waiting | **W06B1** on the anonymised K4 first try (both recorded answers): the deployed kit fails both, the new one passes both. **W06B2**: cut pages still caught. **W06B3**: a failed run leaves no "written" row, settles its ledger, stops with the same error. App: `pipeline.test.ts` |
| 3 | 3.3: "Write it anyway" next to an existing page promised a separate page but reused the existing page's address | *Parse Brief* moves a new page's slug off any address the website already has (a rewrite and a ladder page keep theirs); the hold copy says what each choice does ("a new address of its own") | **W06B4** (K1's existing-page address case), **W06B5** (copy); app `hold.test.ts` |
| 4 | Grade swung back to generous: K1 read 79 "Ready" with fit 20/20 after a third of the page was deleted; ideas restated 4-6 times cost nothing | `_grade.js`: two or more sections, or 20% of the words, taken out (exclusions or H2s lost in editing) cap coverage and fit at 40% with the reason, and the fit floor is then never waived (Needs work, never Ready). `GR.ideas`: an idea restated 4+ times in 3+ places costs 2 structure points, up to 4, never below half the part | **W06A4**: the W05-delivered K1 page re-grades **"Needs work" 72** (in the run: 79 ready with questions; 86 on the same replay before the fix), coverage <= 6/15 and fit <= 8/20, each cap saying "6 sections were taken out". **W06A5-W06A6**: the ranking guide (prod exec 949) unchanged, no idea penalty, Ready; K3 / K4 / K6-shaped pages keep their band. **PFX6** (integration fix): a section that held only an author prompt is no "lost" section |

Offline on the real W05 pages (the agent's replay): K3 100 -> 98, K4 100 -> 98, K6 97 unchanged, all still Ready. So the guards hit the
broken page and leave the good pages alone; they do **not** calibrate the grade on normal pages (Wave 2).

## 2. K1: judges and our grade

| K1 (client A, service page) | Words / H2 | Our grade (status) | Judges' mean (editor / strategist) | Ready (strategist) |
|---|---|---|---|---|
| AFTER (`fed34d3c`) delivered | 2,734 / - | 59 not ready | **66.5** (66 / 67) in the W05 session; 70.5 in the earlier session | no |
| W05 (`1e705b72`) delivered | 1,023 / 3 | 79 ready with questions | **60.5** (59 / 62) | no |
| W05 final | same text | 83 ready | 60.5 (59 / 62) | no |
| W05 delivered, **re-graded by W06 offline** | 1,023 / 3 (same text) | **72 Needs work** | 60.5 (the judged text) | no |
| **W06 delivered (new run, `b447c71f`)** | **not written**: held, page reader out of balance (section 9) | - | **not measured** | - |

- **Our grade vs the judges on K1**: in the W05 run +18.5 (79 vs 60.5) and a wrong "Ready"; W06 on the same text +11.5 (72 vs 60.5) and
  the right call (not ready). Still over by 11 points: the rest is the general generosity Wave 2 calibrates.
- **What a new K1 run should show** (expectation, not a measurement): the replay keeps the writer's full draft (six H2 sections, 2,210
  words after round 1) and deletes nothing, so the delivered page should look like AFTER's (judged 66.5 to 70.5) plus the Wave 0.5 gains, not
  W05's 60.5. Only the paid re-check can confirm it.
- The other three keywords were not re-run either; offline their grades moved by 0 to -2 (section 1), so on K3, K4, K6 our grade is still
  about 15 to 17 above the judges, as in Wave 0.5.

## 3. Checks

- **Engine harness, full**: **14825 passed, 0 failed**, re-run for this file at `5d72a7d9` in a throwaway `n8nio/n8n:2.41.4` container (removed after). The
  rebuild commit recorded 14827 / 0; the 2 assertions fewer sit in time-of-day or date branches (none failed). W06A1-W06A6, W06B1-W06B5,
  EQA4, PFX6 and the ranking-guide pins (RPL*, TOC6) all pass.
- App (at `5d72a7d9`, from the rebuild commit): typecheck clean; shared 908, server 1536 (46 skipped), web 270; web build OK.
- Build with the real `n8n/.env`, exit 0.

## 4. Spend

**$0.0845 of the $3 stop**: the K1 hold check only (Claude $0.0604 + DataForSEO $0.0241; the DataForSEO balance moved by exactly the
ledger's $0.0241). The two disk-blocked attempts and the harness: $0 (SPEND.md "WAVE 0.6" and "WAVE 0.6 paid re-check").

## 5. DEPLOY CHECKLIST (for the owner)

### 5.0 Before anything: production moved on (Index coverage)

Production is **not** at the base this branch was planned against any more. Since 2026-10-30 ~01:15 UTC it runs **Index coverage**
from `feature/indexing`: API on the VM at `fd32c0b4`, web at main `99718dd0` (PR #48, Vercel), engine with the new workflow
`SEOagentIndexCv1` plus changes to Site Admin, the catch-up and the main workflow's monitor row, and two columns
(`seo_monitors.index_watch` / `index_daily_cap`). **`feature/seo-agent-v4.5` does not contain it.**

1. **Merge `origin/main` into `feature/seo-agent-v4.5` first.** Dry run (2026-10-30): 3 conflicts, `app/web/src/marketing/content/changelog.ts`,
   `features.ts`, `n8n/seo-agent/harness/scenarios_v5.js`. Keep both sides; never hand-resolve generated workflow JSON: rebuild
   (`python3 build_v4.py`, exit 0), then the full harness (0 failed) and the app suites (typecheck, shared / server / web, web build).
   Without this merge the engine deploy reverts Site Admin's index settings, the catch-up entry and the monitor columns, and the API
   deploy removes the indexing routes the live web calls.
2. The VM's startup script checks out `alaventra-ref` (`feature/seo-agent-v4.5`) on every boot and rebuilds the app image only if it is
   missing. The spot VM was preempted twice on 2026-10-30. Until the merge is done and deployed, a boot that rebuilds would serve
   this branch's API without Index coverage.
3. Optional, the owner's call: the paid K1 re-check (about $1.10). The disk is no longer the block; the page reader account must be
   recharged first (section 9). **Check production's page reads before the deploy too** (section 9, finding 1).

### 5.1 What changes for clients (Waves 0, 0.5 and 0.6, all on written pages)

- **Pages**: a real search description on every page; answers worked into the sentence they change; local regulatory dates read from the
  official text; no padding headings, at most 8 questions; a sourced figure kept exactly, a vendor-only figure rewritten; one byline,
  the business's own voice; sources cited at their real address; script-rendered websites read after they load. Blind judges:
  delivered pages 68.4 -> 74.5 on 8 keywords (Wave 0), held on 3 of 4 in Wave 0.5.
- **Asking first ("Needs your OK")**: a keyword the verdict scores under 40, or under 50 with a second signal (little demand, or a page
  the website already has), waits in Needs you with "Write it anyway", the recommended search, or "Improve the existing page". Only the
  check is charged. "Write it anyway" next to an existing page writes a separate page at a new address of its own.
- **The grade**: measures what a reviewer counts (sources, fit, repetition); "95+" instead of 100; "Needs work: <part>" instead of
  "Ready" when a part is under half, or when the run removed several sections; a fresh second read where only a factual error blocks.
- **The final version**: Accept all always works; the final keeps the page's shape, its contents list, every open blocker of the first
  check; it has its own Word, PDF, HTML, Markdown and meta.json downloads.
- **Reliability**: a complete page ending on a call-to-action line is no longer failed; a failed run never shows as "already written"
  or as waiting; a failed run's cost is recorded.
- **Price**: a written page is quoted at about **114 credits** (was about 51) and a held keyword at about **9 credits** (D8, below).

### 5.2 What the deploy involves

- **App migrations**: **none** since production's 0025 (`app/server/drizzle` unchanged since `003bb9cb`). No new environment variable.
- **Data Table columns**: **none** from page quality (`ladder_common.py` unchanged since `003bb9cb`). New *values* only:
  `seo_content_log.status` `held` and `failed`. Index coverage's two columns are already on production; after the merge, the dry run
  must list no missing column.
- **Workflows**: no new workflow from page quality (Page Finalize already exists). Changed: the main workflow (`SEO_Agent_v4.json`,
  most of the change), Page Finalize (own PDF through the production Gotenberg service, own files), Site Tracker, and a schema-only
  line in the other generated workflows. After the merge the manifest also carries `SEOagentIndexCv1`, which the dry run must show
  unchanged or updated, never missing.
- **Page-quality commits since production's last page-quality-free state** (`003bb9cb`, 2026-10-28; the engine deployed 2026-10-29/30
  from `feature/indexing` contains none of them), oldest first:
  - R&D and plan `8caf2467`; pre-Wave-0 `a40ea8d0` `54c1a03b` `71e9d97c`; BEFORE run `f86fa880`.
  - Wave 0 batch 1: `ee183236` + `217fa739` (W0-A meta), `ede5a595` (W0-F regulatory), `c99343c2` + `d7c35703` (W0-D hold),
    `a1621024` (D8 price), `567fd7d1`, rebuild `ae1aacf2`.
  - Batch 2: `ee182c90` + `f2d217a4` (W0-B blockers), `5e561878` (script-rendered sites), `f28e8783` (sources, byline, voice), rebuild `3e2f0a8e`.
  - Batch 3: `9bdc9415` + `f469d03c` (W0-G final files), `078e5ea1` + `8d2430a7` (W0-E weaving), rebuild `f6c0fc27`.
  - Batch 4: `682d77e1` + `5b9f76f7` (W0-H causes), rebuild `8c92e6d7`.
  - Batch 5: `173e5fc9` (finalize contents list), `c4c0429b` + `9c9ab76a` (W0-C grade), rebuild `07308113`.
  - Follow-ups and review: `c452093a`, `cbde5f8e`, `94ab1d2d`, rebuild `7c762edf`, `fed34d3c` (review), `fa08a18a` (BEFORE/AFTER).
  - Wave 0.5: `2a28ff7c` (W05-A), `02348b50` (W05-B), `cc471ac7` (W05-C), merges, rebuild `1e705b72`, `99ddd4b0` (WAVE05).
  - Wave 0.6: `cb937e77` (W06-B), `91b71099` (W06-A), merges, `42fb9c22`, rebuild `5d72a7d9`, and this file.

### 5.3 Order (not while a cycle job is starting)

Pick a quiet window: not within 2 hours of the Index coverage run (05:15 New York = 09:15 UTC), no website cycle or "Coming up" preview
due in the next 15 minutes (the deploy guard refuses then; a *running* job is reported, and the dispatcher restarts it). Dispatcher mode
and the AI pulse settings stay as they are.

1. **Backup**: `deploy/gcp/backup.sh` (both databases to `gs://alaventra-prod-backups/pg/<date>/`). Note the file names.
2. **API first** (it understands the engine's new states: holds, `needs_work`, failed rows, final files): on the VM, a detached
   checkout of the merged `feature/seo-agent-v4.5` head in `/mnt/data/repo`, then `up -d --build app` (RUNBOOK §3). Check: healthy,
   `/api/health` ok, the Indexing route still answers 401 signed out.
3. **Web**: PR `feature/seo-agent-v4.5` -> `main` (Vercel deploys main). Only after step 2. Check the pricing page shows 114 / 9 and the
   Indexing page still loads.
4. **Engine**: open `deploy/gcp/tunnel.sh`, then from the main checkout at the same commit `python3 deploy/gcp/deploy_engine.py` (dry
   run: the deploy guard, no missing column, no missing workflow, the expected updated list), then `--apply`. `--create-missing` is not
   needed. Check: every manifest workflow published, `SEOagentIndexCv1` active, the Cycle Dispatcher active, `cycle:last` fresh.
5. **Free checks after**: one "Write a page" form shows the 114-credit quote and the hold rule line; a held keyword's Needs you card
   (if one comes up) shows the three choices; no execution error in the first hour. The first paid page run of a client is the real
   live check: read its report (grade, "Needs work" reason if any, final version files).

### 5.4 D17: shadow mode for automatic runs

- Runs the system starts by itself (the cadence / autopilot, a ladder's own page runs, the tracker, case-study and audit spawns:
  `client_ip` `cadence:` `ladder:` `tracker:` `casestudy:` `audit:`) are **not held**. Their hold is computed and logged (`would_hold`,
  `hold_shadow` in the run and its callback), the second read is advice only, and the grade's fit floor is recorded, not applied. The page
  is written as before. Runs a person starts (app, form, API) are asked.
- Rule (owner D17): two cadence cycles of shadow logs and the owner's review of the first 20 would-be holds; then switch on, unless the
  hold rate is above 40%. Switch: `CFG.automatic = 'enforce'` in `v5/code/Parse_Verdict.js` and `v5/code/_critic_reread.js` (and the
  grade's automatic fit rule in `_grade.js`), rebuild, harness, engine deploy.
- Put a reminder two cycles after the deploy date to read the `would_hold` lines.

### 5.5 D8: the credit price change

- `shared/src/cost.ts`: a written page is quoted at its measured **$1.90 = about 114 credits** (was $0.84 = 51) and never below it
  (`QUOTE_FLOOR_KEYS`); a held keyword uses only the check, **$0.15 = about 9 credits** (`HOLD_CHECK_USD`). Charges still follow usage,
  **capped at the quote**: Wave 0.5's pages measured about $1.08 of Claude each, so most pages are charged about 65 to 70 credits and the
  quote is the ceiling. The cadence's default page price is $1.90.
- Copy that changes with it: the pricing page examples ("A written page ... about 114 credits", new line "A page that waits for your OK
  before writing (only the check) ... about 9 credits"), the credits FAQ, two marketing mockups, the form's cost line. The prices on the
  pricing page are still marked placeholders for the owner to confirm (CLAUDE.md 2026-10-14).
- Clients with a monthly credit limit will see fewer pages fit inside it on the quote; the charge itself rarely reaches the quote.

### 5.6 Rollback

- **Engine** (first, if the problem is in pages): from a checkout of production's previous engine commit (`feature/indexing` `5987fe9d`),
  `python3 deploy/gcp/deploy_engine.py --apply` over the tunnel. No column to remove; `held` / `failed` content-log rows stay readable.
- **API**: detached checkout of `fd32c0b4` on the VM, `up -d --build app`. No migration to undo.
- **Web**: revert the merge commit on `main` (Vercel redeploys).
- **Data**: the backup of step 1 only if rows were damaged (`deploy/gcp/restore.sh`); page quality writes no new table.

## 6. Tutorial screens that changed (for the end-of-programme re-film)

Wave 0 list (WAVE0_REVIEW.md section 5) plus Waves 0.5 and 0.6:

- **4.1** Run an analysis: the credits on a page run (114) and on a held keyword (9).
- **4.4** Write a page for a keyword: the hold rule line, "only the check" price note, the "Written anyway" callout; no false "already
  written" warning after a hold or a failed run.
- **4.5** Follow a run and open its reports: a held run's report ("Needs your OK", the three choices and what each does).
- **5.1** Read your Pipeline: Needs you, "Needs your OK" card with "Improve the existing page" / "Use the recommended target" / "Write
  it anyway" (new address copy).
- **5.8** Write the pages Alaventra suggests: autopilot pages are checked but not held (no visible change; re-check the copy).
- **6.3, 6.7, 6.8**: grade "95+", "Needs work: <part>" (also after sections were removed), the duplicate-page card, Accept all always
  works, at most 8 questions, unplaced answers, the final version's own downloads.
- **6.4** Check any page before you publish it: the grade in the publish check.
- **10.2** Understand your credits: examples 114 and 9.
- Check **5.4** and **11.9** for the status label "Needs work".

Owner rule of 2026-10-30 (on `main`): no filming during the app revamp; this list goes into the video-skills repo's
`alaventra/TUTORIALS_BACKLOG.md` as one row when the programme is deployed.

## 7. Risks left after Wave 0.6

- The K1 fix and the grade guards are proven offline only; the paid re-check stopped at the hold because the page reader is out of
  balance (section 9).
- A run whose page reads all fail is not flagged: no ops alert, a wrong reason to the client (section 9, finding 2).
- Our grade is still about 11 to 17 points above the judges on normal pages (Wave 2 calibration).
- Fit unchanged: a service page on an explainer results page (Wave 1).
- Thin proof of the business on client A pages (Wave 3); a page can still be written with no outside source (K6).
- Small Finalize faults seen in Wave 0.5: a lost referent, a doubled invitation.
- n = 4 keywords in Wave 0.5: single-page differences under about 5 points are noise.

## 8. The two open items, closed offline (W06-C, branch `w06-open-items`)

- **A final version of a page that lost sections could read "Ready".** The content callback's `page_run` now carries `sections_removed`
  (the counts the delivered grade capped on, the share of the words, each heading taken out and why); the app carries it on its
  allow-list (`PRC_GRADING`) to the finalize request; Finalize Verdict caps coverage and fit (GR.removedCap) while those sections are
  still missing on the final version. A section written back lifts the cap; a section the client deletes is never counted as "lost in
  editing". A report from before the field keeps the old behaviour, with the advice "Not checked: whether the page run took sections
  out of this page". Pinned on the anonymised K1 replay (W06C1-W06C3): the K1 final version reads **"Needs work", 72** (coverage 6 of 15,
  fit 8 of 20, "6 sections were taken out") instead of **"Ready", 90** without the field; with the six sections pasted back it reads
  Ready, 95.
- **Two brief-building steps matched the topics to leave out against the keyword alone.** Parse Brief (`_brief_guard.js`) and Brief
  Context now pass the keyword family (`EXC.familyOf`: keyword, the brief's primary and secondary keywords, the site's services), as
  Content QA does (W06C5): K1's four core outline sections and two sections of its own family ("e-invoicing", "implementation") are kept,
  and a section that names "Dynamics GP and SL" still goes.
- The guide that ranks (949) through the final version with the field: Ready, 99, the same grade as without it (W06C4).
- Checks: build section 178; full harness **14900 passed, 0 failed**; app typecheck clean, shared 909, the server and web finalize suites
  green. No migration, no Data Table column, no new workflow. Deploy order unchanged (section 5): the API first, so the app carries the
  new field; an engine without it ignores the field, and an app without it sends none ("Not checked").

## 9. K1 live re-check (2026-10-30, `b447c71f`)

| | W05 (`1e705b72`) | W06 (`b447c71f`), this run |
|---|---|---|
| Stack | alvrun, restored from the BEFORE snapshots, re-seeded | the same: build == committed workflows, image == rebuilt, 25 active, AI pulse off, dispatcher plan_only, nothing published, no e-mail |
| Held? | yes, as a **duplicate** of client A's existing service page (score 52) | yes, but on the **score** (38, "clearly low"), not as a duplicate |
| Existing page | read and confirmed | **not confirmed**: told the client it "has no title, main heading or Search Console search on file" |
| Choices shown | Improve the existing page / Use the recommended target / Write it anyway | Use the recommended target / Write it anyway |
| Page reads | client 4/4, competitors, regulatory: all read | **every read refused, 402** (client 4/4, competitors 3/3, retry 3/3, regulatory 10/10) |
| Cost | $0.1244 | $0.0845 |

- **Judges' mean, new K1 vs W05 vs AFTER**: not measured. W05 delivered 60.5, AFTER 66.5 (same session); no new page was written, so
  there is nothing to judge and no blind set or key was made.
- **Sections kept, the new page's address, our grade vs the judges (delivered and final)**: not produced. The offline pins stand
  (sections 1, 2 and 8): the K1 replay deletes 0 sections and keeps 2,210 words; the W05 page re-grades "Needs work" 72 (judges 60.5);
  its final version reads "Needs work" 72 with the new field instead of "Ready" 90.
- **The two open items**: closed in code and offline (section 8, `df9126da`, rebuilt `b447c71f`); this run did not reach them (no page,
  no final version), so they are not proven live yet.
- **Full harness at `b447c71f`**: **14900 passed, 0 failed** (recorded with the rebuild); app typecheck clean, shared 909 / server 1536 /
  web 270, web build OK.
- **Spend**: $0.0845 of the $3 stop (section 4).

**Findings from this run**

1. **HIGH, probably in production too: the page reader account is out of balance.** Every page read fails with 402. If production uses
   the same key (not checked: out of this run's scope), every page run, hold check, publish check, AI-readiness check and link check
   there is running without reading any page. **Owner: recharge the reader account (or rotate to a funded key) and look at production's
   page runs since about 10:00 UTC on 2026-10-30.**
2. **MEDIUM: the engine degrades silently when page reads fail.** No ops alert, nothing in the client's report, and a wrong reason to the
   client ("has no title, main heading or Search Console search on file" when the page simply could not be fetched); the verdict scored
   on search data alone and held the keyword on that score. A 401 / 402 from the reader should flag the run ("pages could not be read")
   and raise an ops alert, as DataForSEO balance problems already do. Not fixed in this wave.

**To finish the re-check** (after the reader is funded): one free probe of the key; K1 as a **new** run (this run's hold was decided
without page reads; expect W05's path, held as a duplicate), "Write it anyway", collect, finalize, blind set and the two judges. About
$1.10; $2.92 of the $3 stop is left. The alvrun stack is left running and idle on `b447c71f`.

