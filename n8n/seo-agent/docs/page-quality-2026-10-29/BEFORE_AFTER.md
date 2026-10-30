# BEFORE / AFTER: the page writer on 8caf2467 vs fed34d3c (Wave 0 + follow-ups), 2026-10-30

Anonymised summary of the paid AFTER run and the blind re-judging of both builds. Same test set, options and path as `BASELINE.md`;
full evidence (page texts, executions, judge files, the blind key) stays in the run's local folder and is never committed. Sites:
**client A** (UAE Microsoft Dynamics partner), **client B** (UAE AI and software agency), **own site** (our product site). Quotes are
short snippets with names removed.

Run on the isolated `alvrun-*` stack rebuilt from fed34d3c on the BEFORE start snapshots, driven through the app as a client would.
Nothing published, no e-mail, dispatcher `plan_only`, AI pulse off. Production was not touched; nothing was deployed.

## How it was judged

- Two blind Claude judges (an expert editor, an SEO strategist), one session each, scored **all 31 pages together** under random ids:
  BEFORE delivered 8 + final 7, AFTER delivered 8 + final 5, and the 3 published controls. Version, build, our grade, status, QA and
  questions were hidden. Rubric as in BASELINE (R5 six dimensions, caps, R3 checklists) with its correction: a regulated date deferred to
  the official source with a link earns partial credit.
- Blinding replaced each byline date with `Updated [publication date]`. The editor counted this token as a publish blocker on every page
  (its totals capped at 59, its ready "no" on all 31), so its **raw total** (before that cap) is used, and **ready is the strategist's
  call**. Judge mean = (editor raw + strategist) / 2.
- Same-session numbers only: the BEFORE pages scored +4.2 higher here than in the BEFORE session (Spearman 0.97 between sessions), so
  absolute figures across sessions are not comparable. Judges agree within 5.9 points on average (max 12), Spearman 0.86.
- n = 8 keywords; live SERPs moved between runs (the verdict's own scores moved by 0-10). A difference under about 5 points on one page is
  noise.

## Headline

1. **Pages got better.** Judges' mean, delivered **68.4 -> 74.5 (+6.1)**, up on 7 of 8 keywords; finals (5 pairs) **66.0 -> 73.4
   (+7.4)**. The gain is in proof (7.8 / 7.6 -> 9.2 / 9.2 of 15) and local and regulatory accuracy (8.6 / 9.6 -> 11.9 / 12.4 of 15).
   **Fit did not move** (15.0 -> 15.0 of 20), nor structure.
2. **K6, the one page both BEFORE judges would publish, fell 3 points** (both judges, both versions): new padding headings, one point made
   three times, a sales line inside a code section, a sourced 39% -> 66% figure turned into "rose sharply".
3. **Our grade flipped from inflated to deflated**: signed error **+23.9 -> -10.9**, MAE 23.9 -> 15.5, Spearman 0.17 -> 0.41. A
   second-read item caps the grade at 59 on 7 of 8 pages, so we call 7 of 8 **Not ready** while the strategist would publish 7 of 8.
4. **The one page we call Ready (K4, "95+") is written onto another service page's URL** (matched by slug only, empty title), and the new
   hold now exempts it as "a refresh of a page your website already has". Publishing it would replace the client's Project Operations page.
5. **Finalize still hurts, half as much**: same-session delta -3.6 (7/7 down) -> **-1.8 (5/5 down)**. Our grade no longer rises at
   Finalize. K1, K4 and K8 get no final version: "Accept all" is refused when every prefill is on an open question.
6. **Holds**: K2, K3, K5 held (42, 42, 48). K2 defensible; **K3 wrong** (its written page is the best of all 31; the verdict read the
   same keyword 52, 42, then 46); K5 borderline. K1 (expected hold) and K4 (wrong match) were not held.
7. **Controls**: the ranking guide is still **first of 31 on usefulness + fit**; on total it is 11th, losing proof, structure and ready
   points to the live-text extraction (no links, flattened tables). Control order unchanged; the client-edited service page is last of 31.
8. Spend **$11.20 of the $30 stop** (Claude $10.96, DataForSEO $0.24). Judges and report $0.

## Per keyword

Ours = our grade (status). Judges = judge mean (editor raw / strategist). Ready = strategist.

| K | Site, type | Version | BEFORE ours | BEFORE judges | Ready | AFTER ours | AFTER judges | Ready | Delta |
|---|---|---|---|---|---|---|---|---|---|
| K1 | client A, Service | delivered | 91 Ready | 60.0 (59 / 61) | yes | 59 not ready | 70.5 (69 / 72) | yes | +10.5 |
| K1 | | final | 100 ready | 57.0 (58 / 56) | no | no final | - | - | - |
| K2 | client A, Service | delivered | 96 Ready | 65.5 (61 / 70) | no | 59 not ready (held, written anyway) | 76.0 (72 / 80) | yes | +10.5 |
| K2 | | final | 97 ready | 61.0 (57 / 65) | no | 59 not ready | 74.0 (70 / 78) | no | +13.0 |
| K3 | client A, Guide | delivered | 85 Ready | 68.5 (65 / 72) | yes | 59 not ready (held, written anyway) | **80.5** (75 / 86) | yes | +12.0 |
| K3 | | final | 100 ready | 65.0 (62 / 68) | no | 59 not ready | 80.0 (74 / 86) | yes | +15.0 |
| K4 | client A, Service | delivered | 92 Ready | 68.0 (66 / 70) | yes | **95+ Ready** (wrong URL) | 77.5 (78 / 77) | yes | +9.5 |
| K4 | | final | 100 ready | 64.0 (64 / 64) | no | no final | - | - | - |
| K5 | client B, Service | delivered | 89 Ready | 70.0 (68 / 72) | yes | 59 not ready (held, written anyway) | 71.0 (70 / 72) | yes | +1.0 |
| K5 | | final | 99 ready | 62.0 (61 / 63) | no | 59 not ready | 69.5 (69 / 70) | no | +7.5 |
| K6 | client B, Guide | delivered | 94 Ready | 77.0 (71 / 83) | yes | 59 not ready | 74.0 (68 / 80) | yes | **-3.0** |
| K6 | | final | 100 not ready | 76.0 (70 / 82) | yes | 59 not ready | 73.0 (67 / 79) | yes | **-3.0** |
| K7 | own site, Guide | delivered | 93 Ready | 67.0 (64 / 70) | no | 59 not ready | 74.5 (70 / 79) | yes | +7.5 |
| K7 | | final | 97 ready | 66.0 (63 / 69) | no | 59 not ready | 70.5 (66 / 75) | no | +4.5 |
| K8 | own site, Service | delivered | 99 Ready | 71.5 (69 / 74) | yes | 59 not ready | 72.0 (71 / 73) | no | +0.5 |

| Set | n | Ours | Judges | MAE | Signed | Spearman | Ready agreement (strategist) |
|---|---|---|---|---|---|---|---|
| BEFORE delivered | 8 | 92.4 | 68.4 | 23.9 | +23.9 | 0.17 | 6 / 8 |
| AFTER delivered | 8 | 63.6 | **74.5** | 15.5 | **-10.9** | 0.41 | **2 / 8** |
| BEFORE final | 7 | 99.0 | 64.4 | 34.6 | +34.6 | 0.10 | 0 / 7 |
| AFTER final | 5 | 59.0 | **73.4** | 14.4 | -14.4 | n/a (all 59) | 3 / 5 |
| Critic first draft, BEFORE | 8 | 63.0 | 68.4 | 5.4 | -5.4 | 0.72 | - |
| Critic first draft, AFTER | 8 | 66.5 | 74.5 | 8.5 | -8.0 | -0.44 (66 on 6 of 8) | - |

## Our second-read blockers against the judges

The seven "Not ready" pages each carry a second-read blocker. The judges agree with the substance of 6 of 7, but call only one (K8, "six
engines" followed by seven names, no outside source) not ready. The rest are fix-before-publishing items given blocker weight: uncited
licence-tier and pricing contrasts on a comparison the judges rank first (K3), a data-law map with no link to the laws (K5), a vague market
figure (K6), a statistics note on a worked example (K7). On K1 and K2 the deadline blocker comes from a different "today": the run started
22:31 UTC on 29 Oct (already 30 Oct in the UAE), the page is dated 29 Oct and the second read assumed 30 Oct.

## Finalize

| K | BEFORE delta | AFTER delta | AFTER damage named by the judges |
|---|---|---|---|
| K2 | -4.5 | -2.0 | closing call to action duplicated and broken ("To ask them, get in touch with ...") |
| K3 | -3.5 | -0.5 | a redundant call-to-action line before the existing one |
| K5 | -8.0 | -1.5 | spliced heading fragment at a paragraph end ("... with MLOps monitoring. How [brand] measures up") |
| K6 | -1.0 | -1.0 | a list item lost its bullet |
| K7 | -1.0 | -4.0 | a summary sentence replaced by a fragment; a dangling fragment |
| K1, K4 | -3.0, -4.0 | no final | Accept all refused (prefills only on open questions) |
| **Mean** | **-3.6** | **-1.8** | |

Fixed at Finalize: table-of-contents links kept (all 26 in the 3 linked finals), no false `cut_off`, no grade rise, final downloads
offered. Three of five finals turn a strategist "yes" into "no".

## Holds

| K | Held? | Verdict | Judges on the written page | Correct? |
|---|---|---|---|---|
| K1 | no: quietly treated as an update of the site's existing page for this search | 52 | 70.5; fit capped (explainer SERP, the site already ranks a page) | missed: the client was not told, "improve the existing page" was not offered, and the guide Google shows was not considered |
| K2 | yes, 42; recommended "verify an ASP in 5 minutes" | 42 | 76.0, fit partial (the client is not an ASP) | defensible; the recommended target is a headline, not a search |
| K3 | yes, 42 (10 searches a month; intent labelled "navigational") | 42 then 46 (BEFORE 52) | **80.5, best of 31** | wrong: the 50 line sits inside the verdict's own noise |
| K4 | no: exempt as a refresh of an existing page | 58 | 77.5 | wrong: the "existing page" is another service page matched by slug |
| K5 | yes, 48; recommended "AI development company Dubai/UAE" | 48 then 46 | 71.0 | borderline; the slash form is not a real search |

Side effects: after "Write it anyway" the app warns falsely that a page "was already written" (the held run wrote nothing), the pile-up
notice counts held keywords (one twice), the written run re-runs the verdict and can move it, and the hold is quoted like a full page
(114 credits) while the check costs about $0.12.

## Controls

| Control | BEFORE session (editor / strategist) | This session (editor raw / strategist) | Rank of 31 by total | Usefulness + fit |
|---|---|---|---|---|
| client A guide (the page that ranks) | 80 / 82 | 71 / 74 | 11th | **40.0 of 45, 1st** |
| client B guide | 77 / 71 | 58 / 60 | 29th | - |
| client A service page, client-edited | 53 / 52 | 44 / 47 | 31st | - |

The guide's content is still the best of 31; its total loses on proof ("no working links: sources are named but not linked"), structure
(flattened tables) and ready, which are artefacts of feeding live text instead of Markdown. Next run: feed controls as Markdown with links.

## BASELINE's defects: fixed vs still present

| Defect | AFTER |
|---|---|
| Grade blind to fit, proof, sources, accuracy, repetition | fixed in direction, **over-corrected** (59 cap on 7 of 8, signed -10.9) |
| Weak / missing sources | partly fixed (proof +1.5; official or vendor-documentation links on all 4 client A pages; none on K8, vendor-only on K6) |
| Grounding-redirect citations | **fixed** |
| Thin proof of the business | open (Wave 3) |
| Repetition | partly fixed (no repeated 8-word runs on 7 pages; ideas still restated 4-6 times on K3, K4, K7, K8) |
| Byline printed twice | **fixed** |
| Finalize damages the page | partly fixed (-3.6 -> -1.8) |
| Finalize strips TOC links | **fixed** |
| Finalize false `cut_off` | **fixed** |
| Accept all takes labels and slogans as facts | partly fixed (yes / no only); prefills still poor; one page asks 20 near-duplicate questions |
| Regulatory facts missing or unsourced | mostly fixed (local accuracy +3); a repealed decision cited as current on K2; client B's data-law claims unlinked |
| Stale non-regulatory facts | open (a vendor plan price in a vendor-neutral guide) |
| Fit: page type, intent, cannibalisation | open (fit unchanged; Wave 1) |
| Client in the third person | **fixed** |
| Length advice against the ranking page | **fixed** (length carries no points) |
| Target URL matched by slug only | **open and worse** (K4 now hold-exempt and graded Ready) |
| Unsupported client claims | partly (an unsupported "free consultation" line remains on K1) |
| No downloads on the final | **fixed** |
| Client-rendered own site not read | **fixed** |
| Keyword-first ungrammatical opening | open (K2) |
| Mixed spelling | mostly fixed |
| Comparison with no dated prices | partly (the "verify with vendor" table is gone; still no dated licence prices) |

**New:** (1) wrong-URL page graded Ready and hold-exempt; (2) second-read items block publishing with no repair path, so a client gets a
page and a final that both say Not ready; (3) the second read uses a different "today" from the page date; (4) Accept all refused (400)
leaves three pages with no final; (5) false "already written" and double-counted pile-up after a hold; (6) weak recommended hold targets and
verdict noise around the 50 line; (7) an off-topic regulatory decision (input-tax recovery for government entities) inserted into two
e-invoicing sections by the facts pack; (8) the Critic's first-draft score nearly constant (66 on 6 of 8).

## Pass bar

| Bar | Result |
|---|---|
| Judge mean up, delivered and final | **pass** (+6.1, +7.4) |
| No keyword down by more than about 5 | **pass** (worst -3.0) |
| K6 not worse | **fail, small** (-3.0) |
| Finalize delta >= 0 | **fail** (-1.8) |
| "Ready" only where both judges would publish | **fail** (the only Ready is on the wrong URL) |
| The ranking guide's qualities kept | **pass on content** (answer first on 8 of 8, official citations, local accuracy up, one byline, length not graded) |

## Spend

| Item | Claude | DataForSEO |
|---|---|---|
| 3 hold checks | $0.31 | $0.07 |
| 8 written pages | $10.55 | $0.17 |
| 5 finalizes | $0.09 | $0 |
| Judges, report | $0 | $0 |
| **Total** | **$10.96** | **$0.24** |

$11.20 of $30. The DataForSEO balance difference matches the engine ledger to $0.0001. A written page: mean $1.32 Claude.

## Next

Before any deploy, then a targeted paid re-check of K1, K3, K4, K8 (about $6), then ask the owner:

1. Existing-page match: never refresh or exempt on a slug-only match with an empty title; offer "improve the existing page" as a hold
   choice (K1, K4).
2. Second-read severity: hard blockers (false client claim, count error, wrong regulatory statement) vs fix-before-publishing items that
   lower the grade without the 59 cap; an automatic repair round; the site's own time zone for "today".
3. Finalize: the five splice types as regression pins; never replace a sentence with a fragment; no 400 when only open questions have
   prefills.
4. Holds: recommended targets must be real searches; no hold inside the verdict's noise (or read it twice); reuse the held verdict; no
   false "already written"; pile-up counts written pages once; quote the check, not a page.
5. Regulatory facts pack: filter decisions by the page's subject; mark repealed decisions.

Wave 1 (fit did not move): page type and intent from the SERP, cannibalisation against the page Google already shows. Wave 2 (calibration):
these 31 judged pages plus human raters as the gold set, per-dimension grading instead of one cap, recheck the Critic; target Spearman
>= 0.6 and ready agreement >= 90%. Wave 3: business proof.

**Deploy readiness: not yet.** Page quality, the owner's priority, is up on 7 of 8 keywords. But a client would today get a wrong-URL page
labelled Ready, Not ready on pages an expert would publish with no way to clear it, a false "already written" warning and pages with no
final version.

## Wave 0.5, grade calibration (W05-A, 2026-10-30): the AFTER pages replayed offline

What changed (build section 172; `v5/code/_critic_reread.js`, `_grade.js`, `Apply_Second_Read.js`, `Second_Read_Plan.js`,
`Finalize_Parse_Brief.js`, `Finalize_Verdict.js`, `_regulatory.js`, `Regulatory_Plan.js`, `Content_QA.js`, `Blog_Package.js`; app
`shared/src/page-review.ts`):

- The second read **blocks only a factual error the page states**: a count that does not match its own list (checked on the quoted words),
  an unsupported claim about the business, a statement its own source contradicts, a fact or local rule it calls wrong or out of date
  without hedging. A deadline that only falls on the day the page is written is advice (the page is read after that day).
- Everything else it shows is **advice with a deduction on its part**: 3 points a high item, 1.5 a medium one (fact, source, claim, local
  -> sources; repetition, structure, link -> structure; depth -> specificity; style -> plain language; intent -> fit), at most a quarter of
  the part and never below half of it, so advice alone never makes a page "Needs work" and never caps it at 59. Enforce mode only: shadow
  reads (the system's own runs, the client's keyword ladder, so the guide that ranks) change nothing.
- The deduction travels to the final version (`page_run.second_read`) and Finalize Verdict keeps it while the quoted words are on the
  page: the grade does not rise at Finalize for nothing.
- **"Today" is the market day** in the website's own time zone (`REG.dayFor`, Asia/Dubai for the UAE) for the regulatory status, the
  second read (told "Today in <country>: <date>") and the page's "Updated" and schema dates. The K1 / K2 runs started 22:31 / 22:37 UTC
  on 29 October: 30 October in the UAE, the date the read assumed, while the byline said 29 October (UTC).

Replay: the recorded answers of the 8 second reads through today's code (harness W05A2, fixture `harness/fixtures/w05a_after_reads.json`,
anonymised). Judges = the blind judges' mean (editor raw / strategist) of this report; ready = the strategist.

| K | Judges (ready) | As recorded | Now | What still blocks | Advice taken off |
|---|---|---|---|---|---|
| K1 | 70.5 (yes) | 59 not ready | 92 ready | none (the same-day deadline is advice) | sources 3, structure 3 |
| K2 | 76.0 (yes) | 59 not ready | 71 ready | none (the same-day "past" date and the unlinked decisions are advice) | sources 3 |
| K3 | 80.5 (yes) | 59 not ready | 59 not ready | an unsupported claim about the business ("built on", 24/7 support) | sources 3 |
| K4 | 77.5 (yes) | 95+ ready | 88 ready | none (the wrong URL is the page matcher's fix, not this one) | fit 3, structure 5 |
| K5 | 71.0 (yes) | 59 not ready | 59 not ready | capabilities stated as the business's own, not on file | sources 3, structure 3 |
| K6 | 74.0 (yes) | 59 not ready | 91 ready | none (the vague market figure is advice) | sources 3, specificity 2 |
| K7 | 74.5 (yes) | 59 not ready | 90 ready | none (the statistics note is advice) | sources 3, specificity 1 |
| K8 | 72.0 (no) | 59 not ready | 59 not ready | "six engines" followed by seven names; features not on file | specificity 2 |

| Set | n | Ours | Judges | MAE | Signed | Spearman | Ready agreement |
|---|---|---|---|---|---|---|---|
| AFTER delivered, as recorded | 8 | 63.6 | 74.5 | 15.5 | -10.9 | 0.41 | 2 / 8 |
| **AFTER delivered, W05-A** | 8 | **76.1** | 74.5 | **14.5** | **+1.6** | -0.27 | **6 / 8** |
| AFTER final, as recorded | 5 | 59.0 | 73.4 | 14.4 | -14.4 | n/a | 3 / 5 |
| **AFTER final, W05-A** | 5 | **74.0** | 73.4 | 14.4 | **+0.6** | -0.10 | 2 / 5 |
| BEFORE delivered, today's kit, no second read | 8 | 90.5 | 68.4 | 22.1 | +22.1 | 0.23 | 7 / 8 |

Read with care:

- **Targets met**: signed error +1.6 (target +/-5), ready agreement 6 of 8 (target 6 or more). The two disagreements are K3 and K5, held
  for an unsupported claim about the business, the one kind of error the brief keeps blocking; the judges did not weigh it (they did not
  see the facts on file). Every final keeps its delivered grade (K2 71, K6 91, K7 90 on both): no rise at Finalize. On the finals the
  strategist's "no" on K2 and K7 is Finalize damage (BEFORE_AFTER "Finalize"), which this wave does not touch.
- **Not met, and not this wave's**: MAE barely moves (15.5 -> 14.5) and the rank order is worse (Spearman -0.27). The unblocked pages keep
  the deterministic parts that saturate (coverage, readability, specificity and plain language at full marks on all 8), so K1 grades 92
  against the judges' 70.5 (its fit problem, an explainer results page and the site's own ranking page, is Wave 1's), and the judges' best
  page (K3) is held by its claim. Separating pages by quality is Wave 2's per-dimension grade.
- **BEFORE pages**: nothing a BEFORE page goes through changed in this wave except its dates. Replayed through today's grade kit without a
  second read (they never had one), they grade 90.5, as high as the AFTER pages before their read (89.5 uncapped): the deterministic kit
  does not tell the two builds apart, only the second read does. Whether a BEFORE page stays below an AFTER page once it is read too can
  only be measured with its own read, so the paid re-check should read 2 or 3 BEFORE pages as well (about $0.10 each). The 3299 / 3336
  pins (W0C) and the ranking guide 949 (W0C, W0H8, RPL4, W0B9, W05A7: shadow mode, no deduction) pass unchanged.
- The replay re-uses the recorded answers. A new read is told the market day, so the same-day items should become rarer, and its answers
  vary from run to run (the reader scored 66 on 6 of 8 pages).
