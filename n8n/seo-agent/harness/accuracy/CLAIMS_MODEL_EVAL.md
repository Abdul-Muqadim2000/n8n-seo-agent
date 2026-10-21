# Promise check: rules only vs two stages (real evaluation, CT-FIX2)

Written 2026-10-22 by `harness/accuracy/eval_claims_model.js` (CT-FIX2) on the labelled set `claims.json` (180 cases, 4 fact sets: techand.ai as read on exec 42, peppol.org, azdan.com, and the fresh live page of exec 159 as its own group of 20 hold-out sentences). Model `claude-haiku-4-5-20251001` (the engine's Haiku, the same id as the Reply Reader and the Keyword Check), called directly from a `node:22-bookworm-slim` container with the key from `n8n/.env` (read through `env_settings.load_env()`, passed by environment variable, never printed). Spend cap for the whole evaluation: $0.30.

**How it is measured.** Stage 1 = the claims kit exactly as the build inlines it into the generated Content QA (`CL.commitments(..., { collect: true })`: every sentence the rules judge, plus a wide net of sentences in a section about the business, a phase or service on file as the subject, "we / our", "we recommend ...", image captions). Stage 2 = one Haiku call per page exactly as the new *Promise Judge* node sends it (`PJ.request`: the candidates, the two closest facts of each, a forced `record_verdicts` tool, temperature 0). Cases are judged in pages of up to 25 candidates per site, in file order. Rules only = the same candidates decided by the rules (also what Content QA does when the call fails). Flagged = held for the owner (`business_claims` or `business_promises`). Targets (hold-out): precision >= 95%, recall >= 90%, false flags on true sentences <= 3%.

## The answer

- **Rules only, after this change** (the CT-FIX2 rule fixes: "United Arab Emirates" = "UAE", a sentence joining two facts, a purpose clause before an invitation, "Read / See / Explore [link]", a phase on file as the subject, list items under a "we" lead-in, captions): hold-out **precision 100%, recall 87.5% (28 of 32), false flags on true sentences 0%**; the live page group 6 of 7 promises, **0 false flags** (the live run had 3 false flags and 3 misses). Recall misses the 90% target by one sentence group (`CL-A08`, `CL-R13`, `CL-R14`, `CL-L07`).
- **Haiku as a free judge made it worse.** Run 1 (all 180 cases, prompt v1, verdict trusted as given): recall fell from 94.5% to 65.8% (hold-out 59.4%), because the model called unsupported promises "supported" or "not a commitment" while its own reason said the opposite. Run 2 (prompt v2: the kind of sentence first, then what is missing, then the fact; 10 of 24 pages before the cap): precision 96.9%, recall 86.3%, false flags on true sentences 3.6%: it named facts for a price (AED 25,000) and a project count (150) that no fact carries, and called two true, rule-supported lines unsupported.
- **Shipped policy (asymmetric, verified).** The reader may lift a rule flag only from an invitation, a pointer to another page, the page's narration or a quotation, or as "supported" when the fact it names carries the sentence by the rules' own test (`CL.backs`: every number, 40% of the words); it may add a flag only where the rules judged no commitment (the wide net). Re-scored on both runs' recorded answers it decides **exactly as the rules** on all 180 cases: no gain on this set and no loss. Whether it helps on sentence shapes the rules have not met is not shown by this set, and is not claimed.
- **Honesty note.** Prompt v2 and the policy were set after reading runs 1 and 2, hold-out included. The final-policy rows below are re-scores of recorded answers, not a fresh blind run; a fresh run was not possible inside the $0.30 cap ($0.287 spent).

## Rules only (the same in every replay)

| Group | Cases | Precision | Recall | False flags: true sentences | False flags: not a claim |
|---|---|---|---|---|---|
| all cases | 180 | 100% | 94.5% (69 of 73) | 0% (0 of 56) | 0% (0 of 51) |
| dev | 101 | 100% | 100% (41 of 41) | 0% (0 of 34) | 0% (0 of 26) |
| hold-out (all) | 79 | 100% | 87.5% (28 of 32) | 0% (0 of 22) | 0% (0 of 25) |
| hold-out without the live page | 59 | 100% | 88% (22 of 25) | 0% (0 of 15) | 0% (0 of 19) |
| live page 2026-10-22 | 20 | 100% | 85.7% (6 of 7) | 0% (0 of 7) | 0% (0 of 6) |
| Arabic | 13 | 100% | 80% (4 of 5) | 0% (0 of 5) | 0% (0 of 3) |

## Two stages, shipped policy: run 1's answers (all 24 pages)

| Group | Cases | Precision | Recall | False flags: true sentences | False flags: not a claim |
|---|---|---|---|---|---|
| all cases | 180 | 100% | 94.5% (69 of 73) | 0% (0 of 56) | 0% (0 of 51) |
| dev | 101 | 100% | 100% (41 of 41) | 0% (0 of 34) | 0% (0 of 26) |
| hold-out (all) | 79 | 100% | 87.5% (28 of 32) | 0% (0 of 22) | 0% (0 of 25) |
| hold-out without the live page | 59 | 100% | 88% (22 of 25) | 0% (0 of 15) | 0% (0 of 19) |
| live page 2026-10-22 | 20 | 100% | 85.7% (6 of 7) | 0% (0 of 7) | 0% (0 of 6) |
| Arabic | 13 | 100% | 80% (4 of 5) | 0% (0 of 5) | 0% (0 of 3) |

## Two stages, shipped policy: run 2's answers (10 of 24 pages; the rest decided by the rules)

| Group | Cases | Precision | Recall | False flags: true sentences | False flags: not a claim |
|---|---|---|---|---|---|
| all cases | 180 | 100% | 94.5% (69 of 73) | 0% (0 of 56) | 0% (0 of 51) |
| dev | 101 | 100% | 100% (41 of 41) | 0% (0 of 34) | 0% (0 of 26) |
| hold-out (all) | 79 | 100% | 87.5% (28 of 32) | 0% (0 of 22) | 0% (0 of 25) |
| hold-out without the live page | 59 | 100% | 88% (22 of 25) | 0% (0 of 15) | 0% (0 of 19) |
| live page 2026-10-22 | 20 | 100% | 85.7% (6 of 7) | 0% (0 of 7) | 0% (0 of 6) |
| Arabic | 13 | 100% | 80% (4 of 5) | 0% (0 of 5) | 0% (0 of 3) |

## Run 1 as measured: prompt v1, verdict trusted as given (all 24 pages)

| Group | Cases | Precision | Recall | False flags: true sentences | False flags: not a claim |
|---|---|---|---|---|---|
| all cases | 180 | 100% | 65.8% (48 of 73) | 0% (0 of 56) | 0% (0 of 51) |
| dev | 101 | 100% | 70.7% (29 of 41) | 0% (0 of 34) | 0% (0 of 26) |
| hold-out (all) | 79 | 100% | 59.4% (19 of 32) | 0% (0 of 22) | 0% (0 of 25) |
| hold-out without the live page | 59 | 100% | 76% (19 of 25) | 0% (0 of 15) | 0% (0 of 19) |
| live page 2026-10-22 | 20 | n/a | 0% (0 of 7) | 0% (0 of 7) | 0% (0 of 6) |
| Arabic | 13 | 100% | 80% (4 of 5) | 0% (0 of 5) | 0% (0 of 3) |

## Run 2 as measured: prompt v2, verdict trusted as given (10 of 24 pages, then the spend cap)

| Group | Cases | Precision | Recall | False flags: true sentences | False flags: not a claim |
|---|---|---|---|---|---|
| all cases | 180 | 96.9% | 86.3% (63 of 73) | 3.6% (2 of 56) | 0% (0 of 51) |
| dev | 101 | 97.4% | 90.2% (37 of 41) | 2.9% (1 of 34) | 0% (0 of 26) |
| hold-out (all) | 79 | 96.3% | 81.3% (26 of 32) | 4.5% (1 of 22) | 0% (0 of 25) |
| hold-out without the live page | 59 | 95.2% | 80% (20 of 25) | 6.7% (1 of 15) | 0% (0 of 19) |
| live page 2026-10-22 | 20 | 100% | 85.7% (6 of 7) | 0% (0 of 7) | 0% (0 of 6) |
| Arabic | 13 | 100% | 80% (4 of 5) | 0% (0 of 5) | 0% (0 of 3) |

## Cost and latency per page (measured: Anthropic's reported usage)

| | Run 1 (prompt v1) | Run 2 (prompt v2) |
|---|---|---|
| Calls | 24 | 10 (11 pages left to the rules by the cap) |
| Candidates judged | 419 (17.5 a page) | 194 (19.4 a page) |
| Tokens | 61,050 in, 25,751 out | 26,495 in, 14,136 out |
| Spend | $0.1898 | $0.0972 |
| Cost a page (mean) | $0.0079 | $0.0097 |
| Cost a candidate | $0.00045 | $0.00050 |
| Latency a page (mean / max) | 9.0 s / 11.9 s | 11.1 s / 13.0 s |

**A real page in the engine:** at most 40 candidates a QA round (rule flags first, then the sentences the rules judged, then the wide net), so about **$0.02 a round and $0.04 for the usual two rounds** (Haiku 4.5 at $1 / $5 per million tokens), plus 10 to 15 seconds a round. The cost is measured from the usage in each answer and added to the run's Claude figure in the ledger (*Run Ledger Settle* and *Build Word File*, every round summed). Evaluation total: **$0.287** of the $0.30 cap.

## Where the shipped check still disagrees with the labels

- CL-A08 [hold-out] missed (label unsupported_claim, not flagged): ستحصل على دليل تشغيل ولوحات متابعة بعد الإطلاق.
- CL-R13 [hold-out] missed (label unsupported_claim, not flagged): A runbook is delivered at go-live.
- CL-R14 [hold-out] missed (label unsupported_claim, not flagged): Monitoring dashboards are included in every engagement.
- CL-L07 [hold-out] missed (label unsupported_claim, not flagged): We recommend a go/no-go review at the end of each phase, so a full build is funded only once the ROI case exists.

`CL-L07` is caught in the engine on the real path: it is QA's own round-1 promise ("Each phase ends in a go/no-go decision ...") reworded by the editor inside its mark, and Content QA now carries it as a promise in round 2 (scenario CTX3 on exec 159's data). Read alone, as here, it has no round before it.

## Files

- `claims_model_answers.json`: run 2's recorded answers (the prompt the engine ships), replayed offline by CLACC (path `model`); run 1's answers were replayed for the table above and are not kept (prompt v1 is not shipped).
- Re-score any recorded answers without spending: `REPLAY=<answers.json> OUT=<file.md> node accuracy/eval_claims_model.js`.
