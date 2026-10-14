# The four rules, and making the build enforce them

**2026-10-15.** Written after 81 defects across four rounds, because the owner asked a fair question: are we going back and forth?

Partly, yes — and this document is the answer. The rounds converge (26 → 18 → 16 → 12 defects, and the *kind* moved from wrong
advice to bookkeeping), but the same handful of mistakes kept arriving in new places, because each fix repaired the instance we had
seen rather than the class it belonged to.

| First fix | Came back as | What was actually wrong |
|---|---|---|
| R8 — rung word targets | R22 — a rung still carried 0 | the main page was fixed, not the rule |
| R4 — the competitor gate | R21 — a rival on a subdomain | hosts were matched literally |
| R3 — an unknown `fit` | R26 — a confident label with no data | one field was fixed, not the principle |
| R9 — the run ledger | R17 — the reserve ran last | the code was right, the wiring was not |
| R28 — settlement | R31, R32, R33 | one of four paths was fixed |

**Two fixes have never come back: the ledger-ordering proof and the secret scanner.** Both are enforced by the build — they walk
the generated workflows and fail the build when the rule is broken, so no future change can quietly undo them. Everything below
copies that pattern.

---

## Rule 1 — a number we report is measured, or it says what it is

**~19 defects**, including the worst of them: a High finding on 45 of 47 pages from a field Google no longer answers (R10); an
impact basis of 22,860 impressions for a site that had 5,295 (R10); "no page of yours answers this search" beside the page that
ranks #6.2 for it (R12); 19,579 citing AI answers from a four-character name match (R14); "winnable 68" from two SERP calls that
both failed (R18/R23); a health score chained across unlike report types (R20); a crawl settled at the price quoted for 200 pages
when 47 were crawled (R32).

**The rule.** Every figure that reaches a customer carries one of three states: **measured** (and what measured it), **modelled**
(and from what), or **not available** (and why). A figure may never be derived from a sample whose size changed, from a field the
source no longer populates, or from a call that failed. Where the system cannot answer, it says so — that is a complete answer, and
the leaders are better than us mostly because they refuse more often.

**How to enforce it mechanically.** A lint over the report builders: every value that reaches a delivered report must come from a
structure carrying a `basis`/`source` (the `_lineage.js` shape) or be registered in an explicit allow-list of self-evident values.
A build-time check that no finding is emitted with an empty evidence string, no delta is computed across differing `report_type` or
differing sample sizes, and no score is emitted when its inputs carry `unavailable`. The harness already proves instances; the lint
proves the class.

## Rule 2 — a gate runs on the way in **and** on the way out

**~16 defects**: link-farm pages ranked as best links (D3), a competitor's brand planned as a rung (D8, and again as R16 because
the stored rows were never revisited), stored hosts that stayed wrong (P2-3), a prospect on a rival's subdomain (R21), a rung
planned before the gate existed (R16), pages promised but never written (R1/R15).

**The rule.** Any gate — the fit gate, the competitor gate, the spam gate, the quality gate — must be applied **where data is
written and where it is read**. Stored data predates every gate we will ever write, so a read path that trusts storage is a gate
that does not exist. Identity comparisons reduce to the registrable domain before matching, always.

**How to enforce it mechanically.** A build-time assertion that each gate kit is inlined in both its write-path and its read-path
nodes (the list of pairs is short and known), and a harness scenario per gate that feeds it a *stored* row written before the gate
existed. R16's fix did this for one gate; the others need the same.

## Rule 3 — an external call that fails says so, loudly, once

**~12 defects**: 17% of AI requests failing silently (D19), an in-200 retry rule that matched one error code so a ladder was built
on a SERP nobody saw (R18), 31 of 45 URL inspections failing while the diff called the survivors an improvement (R19), a retired
Google field read as a negative answer (R10), alerts that were raised and never delivered (R5, R6, B-A7).

**The rule.** Every external call retries once on a transient failure — including a failure carried *inside* an HTTP 200, which is
how DataForSEO reports most of them — and a call that still fails marks its evidence `unavailable`. Nothing downstream may score,
rank or advise from `unavailable` evidence. A failure that reaches no human is not handled.

**How to enforce it mechanically.** `retry_lint.py` already enforces 3 tries / 5 s on every external HTTP node; extend it to
require the in-200 gate (`_dfs_retry.js`) on every node that talks to DataForSEO, and to fail when a scoring node's inputs can
include `unavailable` without a guard. The alert path needs the delivery receipt its own rows now carry.

## Rule 4 — nothing is promised until it exists, and nothing exists until it is delivered

**~8 defects**: a page delivered with 50 placeholders (D10) and again with 12 after its own gate failed twice (R11); a ladder row
claiming a page nobody wrote (R1); a masked figure shipped without telling the owner (R25); 23 reports that reached the app and no
human (B-R1); an alert recorded as sent that was never sent (R6/R30).

**The rule.** A record says a thing exists only when the thing exists — proven by the artefact, not by the run having started. A
delivery is complete when something outside the system acknowledges it. A quality gate that fails is a refusal, not a label.

**How to enforce it mechanically.** The state machine is small enough to assert: `planned → writing → written → published` may only
advance on evidence (a content-log row, a live URL, a delivery receipt), and the build can check that no node writes a forward
state without reading that evidence first. The delivery path gets the same receipt treatment the ops alerts now have.

---

## What this means for the plan

1. **The defect register is empty, and chasing a fifth round of instances is the wrong next move.** The next live run will find
   defects — it always has — but the way to reduce them is to make the build refuse the class, not to wait and patch.
2. **Four lints, roughly one session each**, in this order: Rule 3 (extend `retry_lint.py` — the cheapest and it covers the three
   High defects of the last round), Rule 1 (the lineage lint — it covers the most defects), Rule 2 (gate pairs), Rule 4 (the state
   machine). Each is a build-time check in the style of the ordering proof: it fails the build, it cannot be forgotten, and it
   costs nothing per run.
3. **Then the benchmark programme continues** (11 areas left), with the lints in place so a new feature cannot reintroduce an old
   class.
4. **None of this reaches 8/10 on its own.** `PATH_TO_8.md` §1 still holds: without the owner's items the ceiling is 7.46 against
   the 7.5 needed, and three areas are capped at 7.5 for 2026 because five criteria are anchored on the outcomes of pages that are
   still unpublished.
