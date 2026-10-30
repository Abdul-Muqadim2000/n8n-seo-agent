# WAVE 0.5: targeted paid re-check, blind-judged (2026-10-30)

Anonymised summary of the Wave 0.5 re-check. Sites: **client A** (UAE Microsoft Dynamics partner), **client B** (UAE AI and software
agency), **own site** (our product site). Quotes are short snippets with names removed. Full evidence (page texts, executions, judge files,
the blind key) stays in the run's local folder and is never committed.

- Builds: **AFTER** = Wave 0 + follow-ups (`fed34d3c`, judged in `BEFORE_AFTER.md`); **W05** = Wave 0.5 (`1e705b72`: W05-A grade,
  W05-B holds and page targets, W05-C content and final version).
- Run on the isolated `alvrun-*` stack rebuilt on `1e705b72` from the same start snapshots, driven through the app as a client would,
  same request bodies as AFTER. Nothing published, no e-mail, dispatcher `plan_only`, AI pulse off. Production was not touched and
  nothing was deployed.
- Keywords re-run: **K1** (client A, service page), **K3** (client A, comparison guide), **K4** (client A, service page), **K6** (client B,
  guide). Finals ("Accept all", then "Make the final version") for K1, K4 and K6.

## How it was judged

- Two blind Claude judges (an expert editor, an SEO strategist), **one session each, all 13 pages together** under random ids: W05
  delivered 4 + final 3, AFTER delivered 4 + final 2 (AFTER K1 and K4 had no final: Accept all was refused). Build, version, our grade,
  status and questions were hidden; one SERP file per keyword held every reading in random order.
- Rubric as in `BEFORE_AFTER.md` (R5 six dimensions, caps, R3 checklists, partial credit for a regulated date deferred to a linked official
  source, `Updated [publication date]` treated as a blinding artefact). Neither judge applied a 59 blocker cap this time, so the editor's
  total is used as is. Judge mean = (editor + strategist) / 2; ready = the strategist's call.
- **Only same-session numbers are compared.** This session scored the AFTER pages 0.5-6.5 points lower than the earlier session did (K4 -6.5, K1 -4.0, the rest under 1). n = 4
  keywords and the SERPs moved between runs: a difference under about 5 points on one page is noise.

## Headline

1. **Pages held, did not rise.** Judges' mean, delivered **AFTER 73.0 -> W05 73.4 (+0.4)**: K4 **+5.0**, K6 **+3.0**, K3 -0.5 (same),
   **K1 -6.0**. K1's fall is a pre-existing bug (section 3.1), not Wave 0.5 code, but it is a quality drop a client would have received.
2. **K6 recovered** its Wave 0 loss (back to the BEFORE level, 77.0 in the earlier session): 74.5 -> 77.5 (strategist 76 -> 81), no padding headings, 6 questions instead of 20. New gap: it now
   cites **no outside source at all** (both judges, top problem).
3. **Holds and page targets now right on all three checks**: K3 not held (best comparison of the set, judged 79.5); K4 written on its own
   new address, not on another service page; K1 held as a duplicate, the client told the page exists and offered "Improve the existing
   page" first.
4. **Accept all works** (200 on K1, K4, K6; AFTER refused K1 and K4) and **Finalize barely hurts**: same-session delta **-0.5** (AFTER -1.0
   here, -1.8 in the earlier session). Two small faults remain: a sentence whose "it" lost its referent (K4) and a doubled invitation (K6).
5. **Our grade swung back to generous**: signed error **+17.1** on the 4 delivered pages (AFTER, same 4 pages, same session: -5.0; offline
   replay predicted +1.6). Ready agreement with the strategist **3 of 4** (AFTER 1 of 4). The worst case: K1 graded **79 "Ready, and
   stronger with your input"** with fit 20/20 after a third of the page had been deleted.
6. **Two HIGH defects surfaced**, both older than Wave 0 and therefore also in production: the verdict-exclusion matcher deleted six core
   sections of K1, and a complete K4 page failed as "cut off" because it ended on a bare call-to-action line.
7. Spend **about $5.41 of the $10 stop** (upper bound $5.66). Judges and report $0.

## Per keyword

Ours = our grade (status). Judges = judge mean (editor / strategist). Ready = strategist (editor in brackets where it differs).

| K | Site, type | Version | AFTER ours | AFTER judges | Ready | W05 ours | W05 judges | Ready | Delta |
|---|---|---|---|---|---|---|---|---|---|
| K1 | client A, Service | delivered | 59 not ready | 66.5 (66 / 67) | no | 79 ready with questions | **60.5** (59 / 62) | no | **-6.0** |
| K1 | | final | no final | - | - | 83 ready | 60.5 (59 / 62) | no | - |
| K3 | client A, Guide | delivered | 59 not ready (held, written anyway) | 80.0 (80 / 80) | yes | 95 ready with questions (not held) | 79.5 (80 / 79) | yes | -0.5 |
| K3 | | final | 59 not ready | 79.0 (79 / 79) | yes | not asked | - | - | - |
| K4 | client A, Service | delivered | 95+ Ready (another page's URL) | 71.0 (71 / 71) | no | 96 ready with questions (own URL) | **76.0** (75 / 77) | yes | **+5.0** |
| K4 | | final | no final | - | - | 96 ready | 75.0 (74 / 76) | yes (editor no) | - |
| K6 | client B, Guide | delivered | 59 not ready | 74.5 (73 / 76) | yes | 92 ready with questions | **77.5** (74 / 81) | yes | **+3.0** |
| K6 | | final | 59 not ready | 73.5 (72 / 75) | yes (editor no) | 92 ready | 77.0 (73 / 81) | yes | +3.5 |

| Set | n | Ours | Judges | Signed error | MAE | Spearman | Ready agreement (strategist) |
|---|---|---|---|---|---|---|---|
| AFTER delivered (this session) | 4 | 68.0 | 73.0 | -5.0 | 17.0 | -0.26 | 1 / 4 |
| **W05 delivered** | 4 | 90.5 | 73.4 | **+17.1** | 17.1 | 0.40 | **3 / 4** |
| W05 final | 3 | 90.3 | 70.8 | +19.5 | 19.5 | n/a (n = 3) | 2 / 3 |
| Offline replay (W05-A fix agent, the 8 AFTER second reads) | 8 | - | - | -10.9 -> **+1.6** | 15.5 -> 14.5 | not better | 2 / 8 -> **6 / 8** |

Where the grade over-rates, by part (ours vs judges, delivered): **fit** 19-20 of 20 vs 9-17 (K1: 20 vs 9-10, the SERP is explainers and
Microsoft pages); **structure** 13-20 of 20 vs 10-12 of 15 (ideas restated 4-6 times on K3, K4, K6 are not penalised); sources 8-12 of 15 vs
proof 6-10 of 15 is close. The W05-A replay measured only the second-read cap rule on AFTER pages; once that cap no longer applied, the
rest of the grade was as generous as before Wave 0. Calibration stays a Wave 2 job.

## Holds, page targets and the final version

| K | Check | Result |
|---|---|---|
| K3 | not wrongly held | **pass**: verdict 52, no second signal, not held (AFTER: held at 42, the best page of 31) |
| K4 | written on its own address | **pass**: its own new slug (AFTER: another service page's address, graded Ready). But the first try failed (3.2) |
| K1 | told the page exists, offered the update | **pass**: held as `duplicate`, choices "Improve the existing page" / "Use the recommended target" / "Write it anyway", no false "already written" after write-anyway |
| K1 | the written page | **fail**: lost six of its sections (3.1); the suggested address is still the existing page's (3.3) |
| K1 K4 K6 | Accept all makes a final | **pass**: 200 on all three, finals made, no model call ($0 each) |
| K6 | the Wave 0 regression | **pass on score** (+3.0); no padding headings, 6 questions (max 8), the 39% -> 66% figure not made vague; **new gap**: no outside source |

The finals barely change the page: K1's final equals its delivered text, K4 and K6 change one sentence. With 1-2 prefilled answers this
is expected, but the grade still moved 79 -> 83 on K1 only because answered questions count at the status re-check.

## Defects found

### 3.1 K1: the verdict-exclusion matcher deleted the page's core (HIGH, content quality, pre-existing)

- The writer produced about 2,400 words in 6 H2 sections. *Page Candidates* deleted six sections in round 1 as "a topic the verdict said
  to leave out"; all nine headings listed were for **one** topic, "Dynamics GP and SL".
- Cause: `v5/code/_exclusions.js` `EXC.match` (A-18, 2026-10-17, untouched by Waves 0 and 0.5) drops tokens shorter than 3 characters, so
  "GP" and "SL" vanish and the topic becomes the single token "dynamic". The one-word guard only applies when that word is in the page's
  own keyword, so every heading containing "Dynamics" matched.
- Effect: 1,023 body words and 3 H2s delivered (AFTER 2,734). Both judges: the intro "promises content it never delivers". Our grade said
  79 with fit 20/20, while its own coverage read 37% and its second read said "missing the body a service page needs".
- It can hit any page whose verdict excludes a topic made of short tokens ("AI vs ML", "VAT on B2B"). It is live in production today.
- Fix: match a topic that lost tokens to the length filter on its full phrase or not at all; never match on one shared token; never delete
  more than one section (or about 20% of the words) for exclusions without a second signal; cap fit and coverage in the grade when
  exclusions removed sections.

### 3.2 K4 first try: a complete page failed as "cut off" (HIGH, reliability, pre-existing)

- The writer answered twice with a complete page whose last line was the bare call to action "Book a consultation" (no full stop).
  *Draft Check* (`af818c66`, 2026-10-27) read it as a sentence with no ending, retried once, then failed the run: "The page could not be
  written in full". The client was not charged; about $0.85 of Claude was lost.
- The failed run's ledger row stayed `reserved` at $0, so the ledger under-counts failed runs.
- On "Start it again" the app said a page for the keyword "was already written ... and is waiting to be published" and counted it in the
  pile-up. False: the run had failed. W05-B fixed this for holds, not for failed runs. The retry succeeded.
- Fix: accept a final short call-to-action line (the brief's or the site's CTA, or a heading-like line under the last H2); a failed run
  leaves no "written" row; the failure path settles its ledger row with the measured spend.

### 3.3 Smaller

- **Write it anyway vs the address (K1)**: the button says a separate new page is written and the existing page stays as it is, but the
  page's suggested address is the existing page's, and the hold reason says "This run would rewrite that page at its own address". Give
  the new page its own slug, or make the copy say what happens.
- **Finalize**: K4's final turns "the partner should state how..." into "it should state how..." with no referent (editor ready flips to
  no); K6's final doubles the closing invitation.
- **K6 has no outside source**: W05-C stopped removing sourced figures, but this page was written with none; Content QA marks it "Sources
  not checked: the page cites no outside page" as advice only.
- **Thin proof of the business** on every client A page ("Microsoft partner", the address, "24/7 support"; K4: "As stated on our website,
  we offer 24/7 support"). Wave 3.
- **Fit unchanged**: K1 is a service page on an explainer SERP (fit capped by both judges). Wave 1.
- The publication-day deadline is now advice, not a blocker, and "today" is the site's own market day.
- The K1 hold check took 10 minutes (AFTER holds 3-5 minutes).

## Pass bar

| Bar | Result |
|---|---|
| Judge mean not down, delivered | **pass, flat** (+0.4) |
| No keyword down by more than about 5 | **fail** (K1 -6.0, pre-existing exclusion bug) |
| K6 recovered | **pass** (+3.0) |
| Finalize delta >= 0 | **near** (-0.5; was -1.8) |
| Holds: K3 not held, K4 own URL, K1 told + offered the update | **pass** |
| Accept all always makes a final | **pass** |
| Grade within about 5 of the judges, ready agreement >= 90% | **fail** (+17.1 signed; 3 of 4) |
| No run fails on a complete page | **fail** (K4 first try) |

## Spend

| Item | Claude | DataForSEO |
|---|---|---|
| K1 hold check | $0.10 | $0.02 |
| 4 written pages (K1, K3, K4 retry, K6) | $4.30 | $0.08 |
| K4 failed first try (ledger row left at $0; estimated, upper bound $1.10) | ~$0.85 | ~$0.02 |
| 3 finalizes, 3 profile re-sends, judges, report | $0 | $0 |
| **Total** | **~$5.25** | **$0.15** |

About **$5.41 of the $10 stop** (upper bound $5.66). The DataForSEO balance fell $0.1525 against $0.1043 in the ledger plus the failed
run's SERP read; about $0.02 is unexplained (the account is shared with production). A written page: mean $1.08 Claude.

## Deploy readiness

**Not yet, but close: one small fix wave, verified offline, then ask the owner.** Against what production runs today (the BEFORE build:
judges 68.4, our grade +23.9 over), Waves 0 + 0.5 give better pages (Wave 0 +6.1 on 8 keywords, held here on 3 of 4), honest holds,
pages on their own address, and a final version that always exists and barely changes the page. The two HIGH defects are also in
production, so deploying would not add them; but the owner's rule is that quality never drops, and a client receiving K1's page would see
a drop. Before deploying:

1. **Exclusion matcher** guard (3.1), with the K1 execution replayed offline (free) as a regression pin.
2. **Bare call-to-action ending** accepted by *Draft Check*; a failed run leaves no "written" row and settles its ledger (3.2), pinned on
   the recorded K4 first try.
3. **Write it anyway** gets its own slug or honest copy (3.3).
4. **Grade**: cap fit / coverage after exclusions, and penalise an idea restated 4+ times in structure, so a page like K1 cannot read 79
   "Ready". Full calibration stays in Wave 2.

Then: full harness once, the owner's go-ahead, deploy **API first, then engine**. A further paid run is optional (K1 again, about $1.10).

Remaining risks after that: our grade still over-rates by about 15 points (Wave 2); fit unchanged (Wave 1); thin proof of the business
(Wave 3); small Finalize faults (a lost referent, a doubled invitation); a page can be written with no outside source; n = 4 here, so
single-page differences under about 5 are noise.
