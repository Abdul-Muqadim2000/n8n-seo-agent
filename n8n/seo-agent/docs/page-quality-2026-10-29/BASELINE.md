# BASELINE: the page writer before the page-quality work (build 8caf2467), 2026-10-29

Anonymised summary of the paid BEFORE run. It measures the build production runs for the page pipeline, so the improved build can be
compared on the identical test set. Full evidence (page texts, executions, judge files) stays in the run's local folder and is never
committed: it holds third-party page text. Client sites are named here as **client A** (UAE Microsoft Dynamics partner, the trigger-case
client), **client B** (UAE AI and software agency) and **own site** (our product site, client-rendered). Quotes are kept to short snippets.

Run on the isolated `alvrun-*` stack (built from 8caf2467, workflows byte-identical to the commit), driven through the app as a client
would. Nothing published, no e-mail, no alert webhook, dispatcher `plan_only`, AI pulse off. Production was not touched.

## Headline

1. **Our grade is inverted against expert judgement.** Delivered pages: ours 85-99 (mean 92.4), two blind judges 55-76.5 (mean 64.7):
   **+27.7 inflation, Spearman -0.12**. Final versions: ours 97-100 (mean 99.0), judges 49-75.5 (mean 59.6): **+39.4**. We called
   8 of 8 delivered pages and 6 of 7 finals "Ready"; the judges would publish one (K6) in each set, and K6's final is the one we
   called not ready.
2. **The Critic already agrees with the judges**: first-draft score mean 63.0, MAE 2.7 against the judges' mean, Spearman 0.67. It
   gates nothing today (PLAN §1.1 found the same on n = 1; this confirms it on 8 pages across 3 sites).
3. **Finalize made every page worse** (judges' mean -1 to -8.5, mean -5.0, on 7 of 7) while our grade rose (+7.6 mean).
4. **The rubric is not miscalibrated against ranking evidence**: the only page with ranking evidence (client A's published guide) is the
   top-scored page of all 18 (80 / 82, publishable by both). One cap looks too strict (see Controls).
5. Judges agree: mean absolute difference 4.9 points (max 11), Spearman 0.86, ready / not-ready 17 of 18.
6. Spend **$9.92 of the $30 stop** (Claude $9.63, DataForSEO $0.29).

## Test set (frozen 2026-10-29 12:20 UTC)

| K | Site (market, spelling) | Keyword | Page type |
|---|---|---|---|
| K1 | client A (UAE, British) | ms 365 erp (trigger case) | Service Page |
| K2 | client A | e-invoicing accredited service provider uae | Service Page |
| K3 | client A | business central vs netsuite | Guide |
| K4 | client A | dynamics 365 partner dubai | Service Page |
| K5 | client B (UAE, American) | custom ai development company | Service Page |
| K6 | client B | how to build an ai agent for customer support | Guide |
| K7 | own site (US, American) | ai search visibility tracking | Guide |
| K8 | own site | ai seo agent | Service Page |

Same options for all: report + content, no existing URL, site default goal and tone. Finalize = "Accept all suggestions" then "Make
the final version"; questions without a suggestion left unanswered. K8 had no suggestion, so no final version could be made.

## Our grade vs the judges

Judges: a blind expert editor and a blind SEO strategist, same rubric (R5 §3.1 six dimensions: usefulness 25, fit 20, proof 15, local
and regulatory accuracy 15, structure incl. repetition 15, ready to publish 10; R5 §3.3 caps; R3 type checklists), reading page text,
title / meta / slug, the SERP saved in each run and a dated fact pack; neither saw our grade, status, QA or questions. Both are Claude
sessions, not the external human raters of PLAN §5.1.

| K | Version | Ours (status) | Editor | Strategist | Judge mean | Ready (editor / strategist) |
|---|---|---|---|---|---|---|
| K1 | delivered | 91 (Ready) | 54 | 56 | 55.0 | no / no |
| K1 | final | 100 (ready) | 48 | 50 | 49.0 | no / no |
| K2 | delivered | 96 (Ready) | 60 | 64 | 62.0 | no / no |
| K2 | final | 97 (ready) | 52 | 56 | 54.0 | no / no |
| K3 | delivered | 85 (Ready) | 60 | 71 | 65.5 | no / yes |
| K3 | final | 100 (ready) | 56 | 67 | 61.5 | no / no |
| K4 | delivered | 92 (Ready) | 59 | 67 | 63.0 | no / no |
| K4 | final | 100 (ready) | 55 | 62 | 58.5 | no / no |
| K5 | delivered | 89 (Ready) | 69 | 65 | 67.0 | no / no |
| K5 | final | 99 (ready) | 59 | 58 | 58.5 | no / no |
| K6 | delivered | 94 (Ready) | 74 | 79 | 76.5 | yes / yes |
| K6 | final | 100 (**not ready**, cut_off) | 73 | 78 | 75.5 | yes / yes |
| K7 | delivered | 93 (Ready) | 59 | 68 | 63.5 | no / no |
| K7 | final | 97 (ready) | 57 | 64 | 60.5 | no / no |
| K8 | delivered | 99 (Ready) | 65 | 65 | 65.0 | no / no |

| Set | n | Ours | Judges | MAE | Signed | Spearman | Judges' abs(diff) |
|---|---|---|---|---|---|---|---|
| Delivered | 8 | 92.4 | 64.7 | 27.7 | +27.7 | -0.12 | 5.4 |
| Final | 7 | 99.0 | 59.6 | 39.4 | +39.4 | 0.21 | 5.3 |
| Critic (first draft) | 8 | 63.0 | 64.7 | 2.7 | -1.7 | 0.67 | - |

On this sample (LLM judges, so informal): T1, T2, T3 fail; **T7 fails on 13 of 14 "Ready" labels** (judge mean under 70).
Dimension means (editor / strategist), delivered: usefulness 18.1 / 19.5, fit 13.4 / 13.8, **proof 6.4 / 7.1**, local accuracy
8.5 / 9.5, structure 10.1 / 10.4, ready 6.1 / 6.6; after Finalize, ready falls to 3.7 / 3.9. Our own components gave full marks for
coverage, readability, specificity and clean language on all 8 pages; only length varied, and Finalize set it to 15/15. Every verdict
was GO_WITH_CHANGES at 48-62 (K2 and K5 at 48, under Fix 4's hold line); nothing was held.

## Delivered vs final

| K | Ours | Judge mean | What Finalize did |
|---|---|---|---|
| K1 | 91 -> 100 | 55.0 -> 49.0 | spliced fragments from accepted suggestions; an unsupported "free consultation" now twice |
| K2 | 96 -> 97 | 62.0 -> 54.0 | a factual "No, because ..." answer replaced by a sales line; a reading-time fragment |
| K3 | 85 -> 100 | 65.5 -> 61.5 | sales link lines in a neutral comparison; table-of-contents links stripped |
| K4 | 92 -> 100 | 63.0 -> 58.5 | a second, contradictory "Last updated" line under the byline |
| K5 | 89 -> 99 | 67.0 -> 58.5 | the same contract sentence inserted three times in a row; navigation labels as facts |
| K6 | 94 -> 100 | 76.5 -> 75.5 | nothing placed; TOC links stripped; a false `cut_off` blocker on unchanged text |
| K7 | 93 -> 97 | 63.5 -> 60.5 | the "Quick answer" label removed, an unclosed `*`; TOC links stripped |

Finalize hurt 7 of 7 (mean -5.0) while our grade rose on 6 of 7. Finalize cost $0.25 in total.

## Controls: pages we wrote that clients published

| Control | Ranking evidence (2026-10-29) | Editor | Strategist | Ready |
|---|---|---|---|---|
| client A guide (answer-first explainer, ~3,350 words, 13 mostly first-party citations) | 482 impressions in 28 days; #11 and #23 on two family queries; not top 10 for its target | 80 | 82 | yes / yes |
| client B guide (finished by hand after our run) | none yet (3 days live) | 77 | 71 | yes / yes |
| client A "ms 365 erp" service page (client-edited; the page their reviewer scored 63) | none yet; Google shows the guide for this search | 53 | 52 | no / no |

- Not miscalibrated by PLAN §5.1's test: no page with ranking evidence scores under 60, and the ranking guide outscores every BEFORE page.
- The judges are about 10 points stricter than the client's own expert on the one page both scored (52-53 vs 63; n = 1), mostly on fit
  (cannibalisation, confirmed by Google showing the guide) and ready.
- **Probably too strict**: both judges cap the ranking guide's local accuracy at 9/15 for deferring the e-invoicing dates to the
  ministry's site with a link, a behaviour the controls analysis says to keep. Wave 2 should give partial credit for an official-link
  deferral and apply the full cap only when the regulated obligation is the page's subject.
- Weak check: n = 3, all our own pages, no non-Claude top-3 contrast pages, the ranking page is not top 3, and one judge knew which
  control ranks.

## Recurring defects, ranked by pages hurt, mapped to PLAN

| Defect | Pages | PLAN | Covered |
|---|---|---|---|
| "Ready" grade blind to fit, proof, sources, accuracy, repetition | 8/8 | Fix 3, Fix 3b (blind Critic re-read), Wave 2 | yes |
| Weak, missing or misused sources (tier 5, a forum, none, a whole-market figure with no year) | 8/8 | Fix 3 sources, Fix 3b weak-only figures, W3-A | yes |
| Citations that are Google grounding redirects (`google.com/goto?url=...`) | 1/8 (all 5 links of K7) | - | **no** |
| Thin proof of the business | 7/8 | W3-C, W3-D, W3-E | yes (Wave 3) |
| Repetition (an idea 4+ times; quick answer restated as the first section) | 7/8 | Fix 3, Fix 3b prompt lines, W4-B | yes |
| Byline printed twice (byline + "Written by ... reviewed by ..." paragraph) | 3/8 | - | **no** |
| Finalize damages the page (splices, fragments, sales lines, replaced answers) | 6/7 finals | Fix 5, Fix 2 | yes |
| Finalize strips table-of-contents links | 3/3 finals with a linked TOC | - | **no** |
| Finalize breaks the quick-answer block / adds a contradictory date line | 2/7 | Fix 5 (anchors, head-line rule) | partly |
| Finalize false `cut_off` blocker on an unchanged page | 1/7 | Fix 2 does not touch this check | **no** (add a pin) |
| "Accept all" takes navigation labels, slogans, CTAs, reading time as answers and stores them as facts | 5/7 | Fix 5 rules 4-5, W3-C | yes |
| Regulatory facts missing, unsourced, or a deadline due tomorrow stated as upcoming | 5/8 | Fix 6 (merged at HEAD), W3-F | yes |
| Stale non-regulatory facts (a vendor's retired pricing model, undated user counts) | 2/8 | W3-A partly | partly |
| Fit: wrong page type for the SERP, intent gap, cannibalisation | 5/8 | Fix 4 + duplicate check (merged), W1-B, W1-C | yes (type in Wave 1) |
| Client described in the third person on its own site ("its website states ...") | 5/8 | - | **no** |
| Text-card images, truncated alt text | 5/8 | W3-E G29 (alt only) | partly |
| Length advice contradicts the ranking page's length | 6/8 | Fix 3 (length 0 points), W4-B | yes |
| Target URL taken from a different live page matched by slug only (K4); new page written onto the existing same-search URL (K1) | 2/8 | W0-D duplicate kit (IDF-weighted), W1-C | partly: verify the existing-page matcher in AFTER |
| Unsupported client claims; own product placed in its own comparison table without disclosure | 3/8 | Fix 5 variant, W4 D10 (best-X pages only) | partly |
| No downloads on the final version | 7/7 | Fix 7 | yes |
| Own site not read when it is client-rendered (0 own pages read) | 2/8 | W3-B (rendering not mentioned) | **no** |
| Keyword-first ungrammatical opening | 1/8 | Fix 3b `copywriter.txt:72` | yes |
| Spelling mixed against the site's variant | 3/8 | W3-E G28 | yes |
| Comparison with no dated prices and a table of "verify with vendor" cells | 1/8 | Wave 4 comparison type | yes |

Small additions the plan should take: resolve or drop grounding-redirect citations; one byline; keep TOC anchors through Finalize; a
Finalize pin for the cut-off check on unchanged text; first-person or neutral voice for the client's own facts; read client-rendered
own pages through the renderer the link kit already has.

## Spend

| Item | Claude | DataForSEO |
|---|---|---|
| Control SERP reads (10) | - | $0.10 |
| 8 page runs | $9.38 | $0.19 |
| 7 finalizes | $0.25 | $0 |
| Judges, this report | $0 engine | $0 |
| **Total** | **$9.63** | **$0.29** |

$9.92 of $30. A page run: mean $1.17 Claude + $0.024 DataForSEO. About $3.4 of the Claude figure is modelled thinking.

## What the AFTER run must repeat

1. Rebuild the isolated stack from the AFTER commit (the run folder's `rebuild_stack.sh <commit> after`), then restore the **seeded
   snapshots taken before the BEFORE content runs** into both databases, sync tables, verify (25 active, AI pulse off, dispatcher
   `plan_only`). Re-send the two profile bodies with author job titles from the run's `seeds/`.
2. The same frozen test set and options (K1-K8 above), the same groups and order: K1-K3, then K4-K6, then K7-K8; the pile-up warning
   answered "Write it anyway"; any other warning stops the run.
3. **Holds are new.** Expected: K1 held (own page and guide already serve the search), K2 and K5 held if their verdict stays under 50.
   Record each hold as a decision result (T11 / T13), then press "Write it anyway" once to get a comparable page. Compare page quality
   only on pages written.
4. Finalize only after a site's content runs have all started, with the same client action (Accept all, then Make the final version),
   even though Fix 5 changes what Accept all accepts.
5. Judges: the same two roles, rubric, caps, ready rule, inputs and fact pack (a changed fact gets a new dated line). **Stronger than
   BEFORE**: each judge scores the AFTER pages, the BEFORE pages and the three controls together under random ids, version hidden, so
   judge drift cancels out.
6. Not identical by nature: live SERPs, competitor pages, keyword data, the sites and model sampling. Read each verdict's SERP before
   attributing a change to the build.

Pass bar on this set (owner priority: the published pages rank, quality must not drop): judge mean up for delivered and final; no keyword
down by more than the judges' own disagreement (about 5 points); Finalize delta >= 0; "Ready" only on pages both judges would publish;
the ranking guide's qualities kept (answer first, type matching the SERP, first-party citations, local specifics, decision tables, named
people, length set by the SERP not a fixed band), and K6, the one page both judges would publish, not worse.
