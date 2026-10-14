# Benchmark programme — take every feature to the best available standard

**Started 2026-10-14, after the second whole-system run.** The owner asked for this in plain terms: *pick everything one by one,
test it, and make it the best by comparing it to the best benchmarks available online.*

This is the programme that does it. It runs **after** the R17–R29 fix batch lands and is deployed, because benchmarking a feature
against a leader while three known defects are open in it wastes the comparison.

## The rules this programme works under

1. **`../system-review-2026-10-11/CRITERIA_*.md` stay frozen.** The re-rating compares against them; changing them mid-flight would
   make 5/10 → 6/10 → 8/10 meaningless. Fresh benchmark findings go into `BENCHMARKS_2026-10-14.md` (this folder). Where a criterion
   is genuinely out of date, the new file keeps **the old statement beside the new one with the date and the reason**, and the
   scorer keeps using the old one until the owner agrees to re-baseline.
2. **Every claim about a competitor carries a source that was actually opened** — a documentation page, a pricing page, a changelog,
   a public benchmark. A search snippet is not a source. Where a leader's behaviour cannot be verified without a paid account, the
   finding says "not verified, inferred from <source>" rather than asserting it.
3. **No feature is called "best" because its code looks good.** Each area is tested against the evidence of the live runs
   (`RESULTS.md` here and in `../system-review-2026-10-13/`) or a fresh free check, and the gap list cites what our system actually
   produced, not what it is supposed to produce.
4. **Improvements that need money, an owner decision or months of data are listed, not built** — they go to the owner with a cost,
   exactly as `PATH_TO_8.md` does.
5. The usual engineering rules: a harness scenario per change, the build green, nothing deployed by an agent, nothing pushed by an
   agent, no paid live call without the owner's budget.

## The thirteen areas, their leaders and their current scores

Scores are from `../system-review-2026-10-13/SCORECARD.md` (the 2026-10-14 run is not scored yet). "Leader" is the comparison the
rubric already names — the programme checks whether that is still the right comparison in October 2026, and says so if not.

| # | Area | Score | Leader named in the rubric | First question for the researcher |
|---|---|---|---|---|
| 1 | Keyword research & verdicts | 6 | Semrush (Personal KD) / Ahrefs | How do they compute a site-specific difficulty today, and what inputs do they use that we do not? |
| 2 | Keyword ladders / planning | 5.5 | MarketMuse / Semrush Strategy Builder | What does a modern topical-authority plan contain, and how is its order justified? |
| 3 | Content creation & QA | 6 | Surfer / Clearscope | What does their editor score, and what do they refuse to publish? |
| 4 | Content cadence / pipeline | 5.5 | Clearscope (inventory, decay) | How is decay detected and how is a refresh prioritised against new work? |
| 5 | Technical audit | 5 | Sitebulb / Ahrefs Site Audit | Which checks do they run that we do not, and how do they rank severity? |
| 6 | Rank tracking | 6 | AccuRanker / Semrush Position Tracking | Frequency, device, location, SERP features, share of voice, and what they do on a volatile day |
| 7 | Site tracking (GSC / GA4 / Trends) | 7 | SEOTesting + Looker Studio | What tests and annotations do they offer that we do not? |
| 8 | AI visibility | 7 | Profound / Semrush AI Toolkit | Panel size, engines, sampling frequency, and how they report a change honestly |
| 9 | AI growth | 6.5 | Profound Actions / AthenaHQ | What actions do they actually take, and what do they refuse to automate? |
| 10 | Backlink monitoring | 7 | Ahrefs (+ Linkody re-checks) | Index size and freshness, lost-link verification, and spam scoring |
| 11 | Link building | 6.5 | Pitchbox / Respona | Sequencing, deliverability, personalisation, reporting — and their compliance stance |
| 12 | **Reporting & app** | **4.5** | AgencyAnalytics / Semrush My Reports | Scheduled delivery, white-label, client access, data sources, and the editor |
| 13 | **Cost control & reliability** | **4.5** | Semrush / Ahrefs (server-side limits) | How credits are metered and shown, and what their uptime/alerting contract is |

**Order of work.** Areas 12 and 13 first: they are the lowest and, per `PATH_TO_8.md` §1, reporting **must** reach 8 or an overall 8
is arithmetically impossible. Then 5, 2, 4, 3 (the ones the 2026-10-14 run exposed most), then the rest.

## What each area's pass produces

For its area, one agent writes a section in `BENCHMARKS_2026-10-14.md` containing:

1. **The leader today** — who it actually is in October 2026 (the rubric's name may be stale), with sources opened.
2. **What the leader does**, feature by feature, in the customer's terms — not marketing copy, the mechanism.
3. **What we do**, from the live evidence: the execution, the report, the file we produced, with ids.
4. **The gap**, as a table: what they do · what we do · does it matter for the customer's outcome · our criterion id, if one exists.
5. **What to build**, split three ways: **(a)** in reach now, with a size estimate; **(b)** needs money or a decision, with the cost
   and who decides; **(c)** not worth it, with the reason — a deliberate "no" is a result, not a failure.
6. **One sentence** naming the single change in that area that would most improve the customer's outcome.

Then the (a) items are implemented in the usual way: grouped so no two agents touch the same files, a harness scenario each, merged
and checked one at a time, and registered in `../system-review-2026-10-11/FIX_PLAN.md` as new rows.

## What this programme must not turn into

A list of features copied from competitors' pricing pages. The rubric rewards **capability and correctness**, and the last two runs
found that the way to lose points is to state something the data does not support — a health score chained across report types, a
feasibility verdict from a SERP that errored twice, a diff that calls a smaller sample an improvement. Where a leader is better, the
usual reason is that it refuses to answer when it cannot answer well. That is the bar to copy.
