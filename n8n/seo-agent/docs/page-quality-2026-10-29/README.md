# Page quality programme (2026-10-29): index

Why we graded a client's "ms 365 erp" service page 92 then 100 "Ready to publish" while their expert reviewer gave it 63, and the plan to
make every page type we write (guides, service, location, comparison, pricing, industry, hub, case study, answer, refresh) rank faster and
pass expert review. Research and plan only: no code changed, nothing deployed, no paid API run. Trigger: techand.ai, production
executions 3299 (page run) and 3336 (finalize), 2026-10-28.

## Files

| File | What it is |
|---|---|
| `PLAN.md` | **Start here.** The build plan: diagnosis, 18 targets (gating vs reported), the 15-stage target pipeline, Wave 0 in detail (the seven owner-approved fixes plus 3b), Waves 1-6 with agents, evaluation protocol, costs and credits, risks, 17 owner decisions, what to tell techand.ai, and the review decisions (§9) |
| `R1_MARKET_LEADERS.md` | What leading products and agencies gate on (intent, information gain, proof, sources, human approval) |
| `R2_RANKING_EVIDENCE.md` | What ranks fast and gets cited in AI answers, graded evidence, 15 generator rules (§8). Note: §2.2's Workshop Digital study is one agency's own site, not its clients |
| `R3_PAGE_TYPE_PLAYBOOK.md` | Decision layer (write, refresh, merge, hold; type from the SERP) and per-type anatomy, proof minimums and checklists |
| `R4_OUR_PIPELINE_AUDIT.md` | Our pipeline traced on 3299 / 3336: defects D1-D8 and gaps G1-G31 with file:line |
| `R5_GRADING_AND_EVALS.md` | Rubric with six reviewer dimensions, caps, judge design, gold set, build gates |
| `REVIEW_CODE.md` | Skeptical code review of the plan: 5 High, 9 Medium, 7 Low (all applied) |
| `REVIEW_EVIDENCE.md` | Skeptical SEO / evidence review: 16 sources re-opened, the published page scored with our own rubric (about 43 vs 63), 7 High, 11 Medium, 4 Low (applied, a few partly; see PLAN §9) |

Related earlier work: `docs/content-quality-2026-10-27/` (R1, R2; built as H1-H3).

## Headline conclusions

1. **The page was ruined before and after the writer.** We wrote a keyword our own verdict scored 42/100 and called "a poor use of
   effort" (the router stops only on AVOID); the site already had a page for the same search; Google shows explainers, not service pages.
   Then the claim check emptied the meta description and a regex misread it as "Slug: ...", Finalize dropped the duplicate-page blocker
   and graded itself against itself, and client answers were appended as fragments beside a slogan offered as proof.
2. **Our grade measured form, not quality.** Structure, coverage, readability, specificity, clean language and length; nothing for fit,
   proof, sources, local accuracy, repetition or publish errors. The only part that moved 92 -> 100 was length. The Critic scored the first
   draft 66 against the reviewer's 63 and gated nothing.
3. **Fixing only this case is not enough.** Without the duplicate URL and with "Write it anyway", the first draft of Wave 0 would still have
   called the page Ready (83-92). So Wave 0 also removes the causes (three prompt lines that create padding and repetition, weak-only
   figures rewritten, a blind Critic re-read as an interim gate), ties Ready to per-dimension floors, and keeps the fit cap after an
   acknowledgement.
4. **What ranks fast for small and mid-authority sites** is improving pages that already earn impressions, matching the page type Google
   shows, one search per page, local primary facts with dates, real proof, and branded mentions for AI answers. Not length, not FAQ schema,
   not "LLM versions".
5. **The differentiator** is gating on proof, sources and local accuracy, and publishing our agreement with expert reviewers, which no
   leader does in public.

## Waves

| Wave | Goal | Agents |
|---|---|---|
| Pre-0 | Orchestrator: extract Parse Verdict to a code file (byte-identical build), PRC contract, free read of 30 runs, anonymised fixtures, send techand the timeline | - |
| 0 | The seven fixes: meta, blockers kept through Finalize, honest interim grade (+3b causes), hold under 50 (with exemptions, shadow mode for automatic runs) and duplicate before the brief, weaving and no slogans, regulatory facts with amendments and status, downloads | 8 |
| 1 | Decide before writing: lineage, structured verdict, SERP type rule tested on real SERPs, cannibalisation, update-vs-new with a minimal refresh, ladder floors | 5 |
| 2 | Measure like a reviewer: gold set with non-Claude pages and two external raters, full rubric with caps as shares and bands until calibrated, one reference-guided judge, live-page check | 6 |
| 3 | Research and proof like a local expert: source tiers, own-site digest, typed fact store, proof asked before writing, author pages, more regulator markets | 6 |
| 4 | Every page type: type registry (Comparison, Pricing, Industry first), per-type briefs and schema, location / volume / refresh guards | 5 |
| 5 | Publish, index, measure, refresh: CMS links, index checks, page outcomes with controls, refresh triggers with a randomised hold-back | 5 |
| 6 | Calibration, second judge seat only on evidence, drift | 1-2 |

37 agents in total, at most three or four in parallel, one functionality per commit, deploys by the owner. Paid live checks: Wave 0 <= $5,
post-Wave-2 run <= $25, post-Wave-4 run <= $20.

## Owner decisions (PLAN §7.2)

Needed now or for Wave 0: **D1** cadence takes the next candidate when its pick is held; **D2** publish over a duplicate only as an update
(or with a recorded reason, fit cap kept); **D4** regulator markets after AE / SA / PK; **D6** ask techand British or American spelling;
**D8** raise the page credit quote to measured cost (about 114 credits) and charge holds only for the check (about 9); **D16** run the
techand refresh by hand now or after Wave 1; **D17** shadow-mode length for automatic holds. Later: D3 hold thresholds, D5 fact store
shape, D7 cross-family judge, D9 two external raters and more client scores, D10-D12 and D14-D15 page types, volume caps and Arabic, D13
asynchronous Finalize.

## Next step

1. Today: send techand.ai the e-invoicing timeline and the live-page quick fixes by hand (PLAN §8), after re-reading the live page; the
   Phase 1 provider deadline is 30 October 2026.
2. Owner answers D1, D2, D8, D16 and D17.
3. Orchestrator runs the pre-Wave-0 steps (PLAN §3.0), then Wave 0 batches A, D, F -> B -> E, G -> H -> C, with the anonymised 3299 / 3336
   replays as the acceptance pins.
