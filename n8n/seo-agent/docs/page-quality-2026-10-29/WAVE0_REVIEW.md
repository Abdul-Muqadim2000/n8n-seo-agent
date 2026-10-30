# Wave 0 review (independent, 2026-10-30)

Scope: every commit from `a40ea8d0` to `07308113` (diff against `8caf2467`), checked against PLAN.md section 3 (Fixes 1-7 and 3b), the owner
decisions D1 D2 D8 D16 D17, and above all the owner's ranking protection: nothing in this wave may hold, refuse, shorten, flatten or
down-grade a page of the kind that ranks (the guide of exec 949).

Method:
- I ran the full harness myself on the committed generated code, in a throwaway `n8nio/n8n:2.41.4` container: **13918 passed, 0 failed**.
- I read the batch 5 app logs: shared 902 / 903 (the one failure is the known `appCopy` 5 s timeout, which passed on its own re-run), server
  1526 passed / 46 skipped, web 269 passed, typecheck clean in all three workspaces, web build OK.
- I wrote two probes, kept in the session scratchpad and not committed because they hold third-party page text.
  - **Probe 1** replays Content QA on 3299's recorded input, the same way W0C6 does, for the BEFORE run's guides K3, K6 and K7, the
    contrast page K1 and the 949 guide.
  - **Probe 2** replays all seven real BEFORE finalize requests (K1-K7, executions in `run/before/K*/finalize/executions`) through
    today's Finalize chain. It runs once as the old app sent them and once with the page-run context the new app derives with
    `pageRunOf`.

The client sites are client A (UAE Dynamics partner), client B (UAE / PK AI developer) and our own site.

## 1. Verdict

Wave 0 is built as the plan specifies, with acceptance tests for every fix. The 3299 and 3336 replays pass (RPL2, RPL3). The plan's pins
hold:
- 3336 final: 59, not ready.
- 3336 with no blocker and the verdict acknowledged: 71, "Needs work: sources".
- The clean fixture: 100 and Ready.
- 3299 delivered: 59, not ready on the duplicate.

**On the 949 guide, the protection holds:**
- Never held, at any score, from the ladder, the app's "Write now" or the cadence (W0D4).
- Never its own duplicate. The late check uses the same kit and only ever removes a match (W0D6).
- Its meta description is left exactly as it is (S-META6).
- Graded 98 ("95+") in the content run and 99 Ready in the final version without the live author box (W0C6 / W0C7). Every version of the
  ms 365 erp page grades 74 at most.
- Nothing is cut: 3337 words, 8 H2, 3 tables printed (W0G4).
- No weak figure, and no block from the second read (W0H8).

**Wave 0 is not finished by its own definition.** The plan's live check has not run: a verdict-only hold, one finalize and one page run on a
regulated keyword, with a $5 cap. It is also not deployed, which is the owner's step.

There are **2 High findings**. Each one marks a guide of the ranking kind lower than before, so each needs a decision before deploy:
- **H1** is new in this wave: the client's own phone number in a call to action counts as an unsourced figure.
- **H2** is an older false "page stops before its end" blocker. It now also caps the shown grade at 59.

On the BEFORE pages, the grade still does not follow the judges. The judges' best page grades lowest and the trigger keyword's page grades
93 Ready (M1). The plan already leaves that to Wave 2, but it should be said plainly before anyone quotes the new grade.

## 2. Each fix against PLAN section 3

| Fix | Built as specified | Acceptance test | Notes |
|---|---|---|---|
| 1 Meta | yes: claim check skips meta, readers `[ \t]*`, `removeAt` / `neutralSentence` guard, `PF.meta`, field check, publish error, `where` on questions, app drop + read-time repair | S-META1..9 (a-f), app `meta-description.test.ts` | 949 meta untouched |
| 2 Blockers | yes: PRC gating + grading fields, `pageRunOf` for old reports, `Finalize_Verdict` keeps hard blockers, D2 decision | W0B1..W0B9, `pageRunFinalize.test.ts`, `duplicateDecision.test.tsx` | M3 (deploy order), L1 (vacuous bar) |
| 3 Grade | yes: `_grade.js`, one scale, caps as shares, floors, blocker cap 59, "95+", Needs work as advice | W0C1..W0C8, `page-grade.test.ts` | **H1**, H2, M1, M2 |
| 3b Causes | yes, one deliberate change: a Guide may keep up to 8 question headings (plan said at most 4), recorded in commit 682d77e1 so the 949 shape survives | W0H1..W0H8 | M4 (second read in enforce mode on app-started ladder pages), L3 |
| 4 Hold | yes: score < 50 or a duplicate, before the brief; exemptions; null score = not checked; `hold_ack`; shadow mode for automatic runs; `held` row; cadence 90-day skip | W0D1..W0D9, `hold.test.ts` (shared, server), `holdReport.test.tsx` | M5 (D1 in enforce mode), M6 (score noise), L4, L5 |
| 5 Weaving | yes: slots, host-sentence rewrite, append refused, anchors, prefill rules, Accept all only yes / no | W0E1..W0E8, app tests | TOC links still stripped (H2 note) |
| 6 Regulatory | yes: `regulators.json` AE / SA / PK, chain in front of Facts SERP, latest dated official source, amendments, status, DFS fallback gated, no node retry | W0F1..W0F9, `gate_lint` / `retry_lint` / `lineage_lint` pass in the build | L2 (brief line) |
| 7 Downloads | yes: `extractFiles` on the final payload, images copied, PDF from Gotenberg (also a Word file, ahead of plan) | W0G1..W0G5, `finalFiles.test.ts` | |

Owner decisions:
- **D1**: applied for the next cycle only. A held keyword is skipped for 90 days and later candidates are picked instead. Within the cycle
  that held it, the slot is not refilled (M5). Invisible while D17 shadow mode is on.
- **D2**: applied. Publish only as an update ("Rewrite it as an update of your page", a refresh run with `existing_page_url`) or with a
  recorded reason. The fit cap is kept and shown.
- **D8**: applied together. `cost.ts` content $1.90 = 114 credits, `HOLD_CHECK_USD` $0.15 = 9 credits, pricing examples and FAQ, the form's
  price note, and the cadence's `defaultPageUsd`. The quote does not include the second read (about $0.05, L6).
- **D16**: nothing in Wave 0 runs a refresh. Correct.
- **D17**: automatic holds and the second read run in shadow mode, reported in the callback and shown on the report. The switch to enforce
  is a code constant in two files, with no counter and no owner list of shadow holds (L4).

## 3. Findings

### H1 (High, new in Wave 0): a phone number in the call to action is graded as an unsourced figure, so "Needs work: sources" on a good guide

- **Where**: `v5/code/_grade.js:155-166` (`figureIn` takes any digit run the source kit's `SRC.figures` returns), with the escape only for
  figures found in `own_text`. That is set at `v5/code/Content_QA.js:790`, and it holds `business`, `business_facts` and `case_facts_text`
  but not the site model's or profile's NAP: phone, address and opening hours. The same kit runs in Finalize Verdict and the Publish
  Check.
- **Evidence**: minimal reproduction with the grade kit, a clean guide that cites nothing:
  - Ending "Book a call ...": 100, sources 15/15, Ready.
  - The same page ending "call the office on +971 50 xxx xxxx, Monday to Friday" (a real client number in the probe): **85, sources
    0/15, Ready false, failing `sources`**. The unit is the number's last four digits.
- **Real pages**: the BEFORE run's K6, the page both judges rated best (76.5, ready yes / yes), has exactly one source unit, its CTA phone
  line. In the content run it grades sources 0/15 and "Needs work: sources". K3 also counts its CTA phone line.
- **The phone is not in the run's business facts**: I checked K6's request body, so this is what production would do. Every Local page
  carries a verified NAP block (v4.4), so every Local page with nothing else to cite would read "Needs work".
- The 949 guide escapes only because its CTA has no phone.
- **Fix**: in `GR.sources`, drop figures inside phone numbers, opening hours, postcodes and street numbers. Use a phone or NAP pattern,
  plus the site model's `nap` and the profile's phone and address appended to `own_text` in Content QA, Finalize Verdict and the Publish
  Check. Add a W0C test: the clean fixture plus a CTA phone line stays 100 and Ready.

### H2 (High, older defect made worse by the 59 cap): a false "page stops before its end" blocker on unchanged guide text grades the final version 59

- **Where**: `v5/code/_complete.js:96 / :118`. A last line that does not end in sentence punctuation (an author-box credential line, a tag
  line) is read as a cut-off page. `_page_fix.js:430` then makes it a hard blocker, and `_grade.js:251` now caps the total at 59.
- **Evidence (Probe 2)**: K6's real finalize request, unchanged text, the judges' best page.
  - Before Wave 0: not ready, grade 100.
  - Now: not ready, **59**.
  - Its last line is the credential line of the author box ("... certified company, AWS Partner, Clutch awards; 5 years, 100+
    projects").
- W0B9 shows the same on the 949 live capture: status `not_ready`, `cut_off`, grade 59 while its author box is on the page. The scenario
  accepts this as a capture artefact. K6 shows that it is not one: the app sends text like this.
- The same replay shows the older TOC loss still present: K3, K6 and K7 each lose 7 of 8 table-of-contents links in Finalize (links 20 to
  13, 16 to 9, 21 to 14), K7 with no editor at all.
- The `fu-finalize-toc` branch exists but is not merged.
- **Fix**: before deploy, merge the two Finalize follow-ups listed in RESUME ("no false cut_off on unchanged text", "TOC links kept").
  - Finalize should not run the completeness check on text identical to `delivered_markdown`, or should end it before the author box and
    the byline (the `SKIP_SECTION` / `BYLINE` rules `_grade.js` already has).
  - Add the K6 ending, anonymised, as a fixture in W0B9 and require `delivery_status !== 'not_ready'` with the author box present.

### M1 (Medium): on the BEFORE pages the new grade still does not follow the judges

Probe 2, real finalize requests with the app's page-run context:

| Page | Ours now | Judges |
|---|---|---|
| K1 | 93 Ready | 49 |
| K2 | 71 Needs work | 54 |
| K3 | 85 Needs work | 61.5 |
| K4 | 85 Needs work | 58.5 |
| K5 | 88 Needs work | 58.5 |
| K6 | 59 not ready | 75.5 |
| K7 | 98 Ready | 60.5 |

- The best page grades lowest (H2).
- The trigger keyword's page, scored 52 by the verdict in that run with no duplicate found, is "Ready 93".
- The plan's own pins (3336) pass. The README claim "it cannot say 100 on a page like this" holds only where the duplicate or a weak-only
  figure is present.
- **Fix**: none in Wave 0. Say it in the release note and in the owner summary: the interim grade removes length and adds sources and
  fit, and calibration is Wave 2. Keep T7 open.

### M2 (Medium): the sources part rewards citing nothing over citing one vendor or agency page

- **Where**: `_grade.js:173`. A page with no unit gets full points ("Nothing to source"). A page whose only cited sentence links a review
  site or an agency gets 0/15 and "Needs work: sources" (K3 in Probe 1).
- The fix text tells the client to cite better. The cheapest way to pass is to delete the link, which is a lost link and lost evidence.
- **Fix**: score a page with no citations as neutral or "not checked" rather than full marks, or weight a weak qualitative citation at
  half a strong one. Only weak-only figures should cost the full share.

### M3 (Medium, release order): the engine before the app makes every final version "not ready, 59"

- Probe 2 with the bodies the current production app sends (no `page_run`): K1-K7 all come back `not_ready`, grade 59, blocker
  `not_checked` ("We could not read what stopped the page in its first check"). With the new app's `pageRunOf` they behave as above.
- **Fix**: in the deploy checklist, deploy the API first, then the engine. Or let `Finalize_Parse_Brief.js` derive the gating fields
  itself when `page_run` is absent, which needs the stored payload and so is harder. Add one line to `RESUME.md` §9.

### M4 (Medium): the second read is enforced on ladder pages a person starts

- **Where**: `_critic_reread.js:26 / :36`. The mode reads only `client_ip`. The hold exempts a ladder page by `ladder_id`
  (`Parse_Verdict.js:168`), but the second read does not.
- A page of the 949 kind started from the app's ladder "Write now" (`app:`) is read in enforce mode. One high `fact` / `source` / `claim` /
  `local` problem whose quote is on the page makes it `not_ready`.
- W0H8 tests this only with the first-draft critique of 949 (0 gates), not with a model read of the finished page. The false-positive rate
  of the blind read is unmeasured.
- **Fix**: treat `ladder_id` + `ladder_rung` like the automatic sources (shadow) until the first 20 second reads have been reviewed, the
  same rule D17 gives holds. Or run the second read on the BEFORE set's delivered pages (8 calls, about $0.40) and record how many blocks
  a judge agrees with.

### M5 (Medium, latent until enforce): D1 refills the held slot only in the next cycle

- **Where**: `Cadence_Plan.js:207-211`, `cadence.ts:499-500`. The hold is decided inside the page run, after the cadence has spawned its
  picks, so a held pick writes nothing that cycle. Later cycles skip it and pick the next candidate.
- The owner's D1 reads "take the next candidate that passes". In enforce mode a site loses that week's page.
- **Fix**: before switching automatic holds to enforce, either run the cheap pre-check (verdict score and DUP) in the cadence before
  spawning, or have a held cadence run spawn the next candidate of the same cycle (`item_key`, `request_id` family). Record the choice in
  the D17 switch note.

### M6 (Medium): the hold rests on one model score near the line

- K1 "ms 365 erp" scored 42 in 3299 and 52 in the BEFORE run. Two of eight BEFORE verdicts were 48 and every one was 48-62.
- A threshold at 50 on a score that moves by about 10 between runs holds and releases the same keyword at random.
- **Fix** (D3 territory): log the score with the hold (already done) and review the first 20 as the plan says. Consider a band (hold under
  45, advise 45-55) before automatic runs move to enforce.

### L1 (Low): W0B9's "grade not below 3299" check cannot fail

- `scenarios_w0b.js:223`: the bar is the 3336 final grade, itself capped at 59, so any page with any blocker equals it. The real
  protection is W0C6 / W0C7 (bar 74).
- **Fix**: use pin 2's 71 or W0C7's bar in W0B9.

### L2 (Low): the brief's regulatory line contradicts the context rule

- `strategy_brief.txt`: the REGULATORY FACTS block appends "Plan where each date above goes (the section and the sentence)" for every
  topic. The digest itself says a context topic is mentioned "only where it changes the reader's decision, once ... never add a section".
- On a guide like 949, where e-invoicing is context, the brief is pushed to place dates.
- **Fix**: append the line only when a `core` topic exists.

### L3 (Low): a weak-only figure can remove a whole sentence

The plan says "rewrite the sentence without the number". The fallback `PF.neutralize` removes the sentence when the editor does not, so a
specific sentence can disappear from a guide. It is acceptable for a market figure, but the report should name what was removed. It does,
as a fix line.

### L4 (Low): no owner list of shadow holds, and the switch to enforce is a code edit

- D17 says "review the first 20". `hold_shadow` sits only in each report payload.
- **Fix**: a platform-admin count or list (reports with `hold_shadow`), and one config value read by both `Parse_Verdict.js:158` and
  `_critic_reread.js` rather than two constants.

### L5 (Low): the Needs you item and the cadence disagree on how long a hold lasts

`pipeline.ts:346` drops the "Needs your OK" item after 30 days. The cadence skips the keyword for 90 days, so for 60 days the keyword is
neither asked about nor written.

### L6 (Low): the page quote leaves out the second read

D8 quotes $1.90 from runs 3299 and 949, which had no second read (about $0.05). The quote is a cap ("charged what it uses, never more"),
so the platform absorbs the difference. Recalibrate after the first live runs.

## 4. Ranking protection: what the 949 guide gets from each gate

| Gate | 949 result | Test |
|---|---|---|
| Hold before the brief | not held at null / 30 / 42 / 94, from ladder, app "Write now" and cadence; never its own duplicate; typed by a person, the service page sharing the site's common words is not its duplicate | W0D4 |
| Late duplicate check | never flagged (kit only removes matches) | W0D6 |
| Meta | untouched, no blocker | S-META6 |
| Grade, content run | 98 "95+", every floor passed; with verdict 42 as a ladder page 86, fit floor waived, Ready | W0C6, probe 1 |
| Grade, final version | 99 Ready without the live author box; **59 not ready with it (H2)** | W0C7, W0B9 |
| Weak figures / second read | none / no gate (shadow as ladder; recorded critique in enforce: 0 gates) | W0H8 (see M4) |
| Regulatory | topics `context`, QA `not_required`, grade unchanged | W0F8 |
| Weaving | untouched with no answers; a CTA answer goes into the CTA sentence | W0E8 |
| Downloads | printed whole: 3337 words, 8 H2, 3 tables | W0G4 |
| Length / sections / links | words, H2 and links in = out in every replay (probe 2, G949: 15 / 15 links). TOC loss not testable: the 949 capture has no TOC (H2) | probes |

The only regressions a page of this kind could suffer from Wave 0 are H1 (a phone number in the CTA) and H2 (a credential line at the
end). Both come from deterministic rules and can be fixed without touching the page.

## 5. Tutorial screens this wave changes (for the end-of-programme re-film)

- 4.1: credits on a run.
- 4.4: Write a page. The hold rule line, the "only the check" price note, and the "Written anyway" callout.
- 4.5: a held run's report.
- 5.1: Needs you, "Needs your OK".
- 6.3, 6.7 and 6.8: grade "95+", "Needs work: <part>", the duplicate-page card, Accept all on yes / no only, unplaced answers.
- 6.4: the grade in the publish check.
- 10.2: credit examples, 114 and 9.

Check 5.4 and 11.9 for the status label "Needs work".
