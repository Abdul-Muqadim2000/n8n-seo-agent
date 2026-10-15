# Where the system stands, and what the re-rating must do

**Written 2026-10-15 at the close of the build session, for the session that runs the whole-system re-rating.** Everything in this
file is committed, pushed and **deployed**. Nothing is half-merged, no agent is running, the working tree is clean.

---

## 1. The state, in numbers

| | 2026-10-15 morning | now |
|---|---|---|
| Benchmark programme | 2 of 13 areas | **13 of 13** |
| Harness | 4505 passed | **5387 passed, 0 failed** |
| Main workflow | 483 nodes live (a day stale) | **668 built, 668 deployed** |
| Published workflows | 21 | **21** |
| Build-time invariant lints | 1 of 4 | **4 of 4, all failing the build** |
| Register rows | ~150 | **302** (231 closed, 71 open) |
| DataForSEO balance | $13.79 | **$13.71** — no paid call was made all day |

Twenty-one agents ran, up to four in parallel; eleven deploys. Every merge was rebuilt in the main worktree (the only place with
`n8n/.env`) and verified by **exact harness assertion count** rather than by eye.

## 2. What the build session changed, in one page

**All 13 areas benchmarked** against the leaders as they actually are in October 2026, with sources opened — not the rubric's
remembered names. Four market corrections came out of it, each recorded beside the old statement: **Adobe has closed the Semrush
acquisition**; **Respona has left outreach software** for pay-per-placement guest posts with exact-match anchors and no
`rel="sponsored"` (link spam by Google's own rules); **Postaga answers 404**; **"Profound Actions" is two product generations stale**.
Only one frozen criterion was re-baselined, on the owner's decision: **K7, from "3-4 shared top-10 URLs" to "40% shared top-7"**.

**All four INVARIANTS rules now fail the build**: rule 1 `lineage_lint.py`, rule 2 `gate_lint.py`, rule 3 `retry_lint.py`,
rule 4 `state_lint.py`. Every one found live defects on the day it landed.

**The defects that had reached customers** (all fixed and deployed): two Google updates in `v5/data/seo_events.json` that **never
happened**, one of which a report named as the cause of a real traffic fall; the AI Growth report telling customers a Bing submission
reaches **ChatGPT search** (OpenAI's crawler docs never mention Bing); "can AI read this page" scored with a **Chrome User-Agent** and
robots.txt never read; a **404 page recorded as `published`** in two tables; a draft **identical to a competitor's page** labelled
`publishable: true`; an index's **silence** recorded as a lost link with no page ever fetched; the keyword verdict printing the
**model's own JSON** as fact; the AI Overview click-loss factor **eight months stale in three files**, which moved not only printed
figures but the `pre_score` that chooses which rungs a ladder climbs; the Critic billed as a **loop that never looped**; a change
test's **method** shipped in every weekly callback while the test itself never ran; and the run ledger holding **$1.50 for a $0.15
week**.

**Five lints were themselves caught measuring less than they claimed** — an inlined kit counted as a gate, a kit's header comment
counted as lineage, `check_in200` walking only the main workflow, `state_lint`'s table list hand-written from one old instance, and
`state_lint` finding four holes in itself before merge. **The rule now recorded: a new lint's first question is what it does not look
at.**

**Three fixes landed on one of N paths and were caught the same day** (B-L4 Tracker-not-Pulse, B1-3 one file of three, B2-1 one caller
of four). That is R28's shape and it is now the first thing to check when any fix lands.

## 3. What is still open — read this before scoring

**71 open rows: 19 the owner's, 52 ours.** None of them is a known wrong number still shipping; they are depth, breadth and
owner-gated items. The ones most likely to show up in a re-rating:

- **B6-15** — `Ladder_Plan.js:220` prices the head term with **no click loss at all**, so after three corrections to that factor the
  head figure is the one number no correction has reached.
- **B5-4** — no hreflang checking anywhere in the audit (silent for single-language sites, so it may not surface on techand.ai).
- **B5-8's second half** — the daily Page Watch queue does not yet use the freshness signal (a three-node edit).
- **B-C2's remainder** — 4 of 22 Claude agents still settle a reservation, each with a reason the build proves.
- Area depth rows: B3 ×5, B5 ×4, B7 ×5, B8 ×5, B9 ×4, B6 ×3, B10 ×3, B11 ×3, B1 ×2, B4 ×1.

**Deliberate, named debt in the ratchets** (the build refuses to let any of these grow): in-200 retry **23**, gate pairs **12**,
lineage **60**, rule 4 **0**.

**The 19 owner rows, and what each blocks:**
- **D25a — an always-on host (~$20-40/month).** The "daily" AI Pulse fired at 14:51 and 10:54 UTC on consecutive days instead of its
  06:30 schedule, because the Mac sleeps. **Three criteria are capped on this whatever is built**, including 3.8 "delivery rate >= 99%,
  measured", and area 5's benchmark named it that area's single highest-value change.
- **G20** — the AI question panel 8 -> 20 (+$5.08/site/month). Area 8's ceiling.
- **G13** (a CMS, so a fix can be deployed rather than shipped as a zip), **G16** (the first live outreach send), **G17** (months of
  our own data to calibrate the chance bands), **O1-O12**, and the rest listed in `FIX_PLAN.md` §3.5.

**Five criteria score the outcomes of pages we have published, and nothing is published yet.** Those areas are capped for 2026
whatever the code does. `../system-review-2026-10-13/PATH_TO_8.md` §1 puts the ceiling without the owner's items at **7.46** against
the 7.5 needed for an overall 8. **Do not promise 8 from code.**

## 4. The baseline the re-rating is measured against

| Date | Overall | Area mean | Source |
|---|---|---|---|
| 2026-10-11 | **5/10** | 4.8 | `../system-review-2026-10-11/SCORECARD.md` |
| 2026-10-13 | **6/10** | 5.92 | `../system-review-2026-10-13/SCORECARD.md` |
| 2026-10-14 | not scored | — | `RESULTS.md` (21 runs, $3.63) |
| now | **to be measured** | — | this re-rating |

Per-area 2026-10-13 scores: keywords 6, ladders 5.5, content 6, cadence 5.5 (**the area-4 agent says the honest figure was 4** —
C15 was scored 6 while nothing could act on the decay verdict), technical audit 5, rank tracking 6, site tracking 7, AI visibility 7,
AI growth 6.5, backlinks 7, link building 6.5, reporting & app 4.5, cost & reliability 4.5.

## 5. The protocol

`../system-review-2026-10-11/FIX_PLAN.md` §5.2 is the authority. In short: **21 live runs on techand.ai covering every feature**,
written up with execution ids into a fresh `docs/system-review-2026-10-15/RESULTS.md`, then scored by an **independent** pass against
the **unchanged** `CRITERIA_*.md` — the scorer must not be the same agent that ran them, and must not read this file's opinions about
what improved. Fill `FIX_PLAN.md` §2's "after fixes" column and add a row to §6's scores history.

**Budgets.** DataForSEO **$13.71** and a run costs ~$2.50-4 of it: **the account binds before the spend guard does — top it up before
starting.** Claude spend for the rating session is authorised up to **$15**. The engine's own daily guards are $15 Claude / $15
DataForSEO (`ai_budget_usd`, `dfs_budget_usd` in *Normalize Input* CONFIG) with a $0.50 balance floor.

**Rules that do not bend.** Never send outreach e-mail to a real address. Never publish to WordPress. Never print a credential.
Never submit a URL to Bing or IndexNow for a test. Agents must not deploy, must not run `apply_env.py`, must not push, and must not
edit `CLAUDE.md` or `FIX_PLAN.md`. A worktree has no `n8n/.env`, so agents pass `SEO_BUILD_ALLOW_DEFAULTS=1` and never commit the
generated trees (`workflows/*.json`, `harness/code_v4/**`, `CHANGES_v3_to_v4.md`, the generated `harness/*.json` records); the
orchestrator rebuilds in the main worktree after every merge. New build sections go **before** section 69, which freezes node ids and
re-runs every lint and must stay last. Next free build section **88**, next harness scenario **S98**.

**What a run that fails proves.** Nothing is smoothed over: a call that fails twice marks its evidence `unavailable`, and the correct
behaviour is a refusal with a reason, not a number. **Score a refusal as a pass where the criterion asks for honesty** — that is the
behaviour the whole programme was built toward, and the research found no competitor does it.
