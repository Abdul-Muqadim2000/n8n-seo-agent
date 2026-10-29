# Code review of PLAN.md (2026-10-29)

Reviewer: skeptical senior engineer, read-only. Checked every Wave 0 anchor and the Wave 1-2 anchors that Wave 0 depends on, against HEAD
`8c0eeb46`, the generated workflows in `n8n/seo-agent/workflows/` and the saved production executions 3299 (page run) and 3336 (finalize).
No code was changed, nothing was deployed, no paid API was called. Client text is not reproduced beyond short labels.

## Summary

Most file:line citations are right, and all eight known defects have a fix. The plan's diagnosis matches the trace. Five problems would
break or block the build as written:

1. **The hold at verdict < 50 has no exemptions.** It would stop case studies, AI answer pages, refreshes and most ladder rungs.
2. **The page-run context (PRC) is not "mostly in the callback already".** Only 5 of its 15 fields are there, and no stored report has
   the rest. "Missing PRC = never Ready" would stop the final version for every page delivered before the deploy.
3. **Fix 3 puts the grade in Content QA, but Content QA cannot see what it needs.** Content QA runs before Originality Check and before
   `PF.classify`, so it cannot see the duplicate-page blocker. The content run never computes SERP page shapes. The caps also mix two
   point scales.
4. **Fix 1 rebuilds the meta only inside `PF.fix`, which Finalize never runs.** The broken stored meta is sent back into Finalize by
   the app, and a second reader with the same bug (`Build_WP_Draft.js`) is not in the plan.
5. **`Parse_Verdict.js` does not exist.** Parse Verdict, Parse Brief and Parse Analysis are v3 nodes patched inside `build_v4.py`. So
   W0-D and W0-F edit the same file in parallel, and in Wave 1 three agents patch the same node in parallel.

## Anchor check (Wave 0)

| Plan cite | Verdict | Note |
|---|---|---|
| `build_v4.py:1111-1117` Verdict Router `AVOID && !force_content` | correct | true branch -> *Build Word File* (verdict report); false -> *Need Content?* |
| `build_v4.py:843-848` Facts SERP strips country names + "statistics <year>" | correct | later re-wired by the retry gates at `:2190`, `:5342`, `:7484` |
| `Cadence_Plan.js:600` `force_content: true`; `:360` default `Service Page` | correct | |
| `_claims.js:304-305` meta line pushed as `kind: 'meta'` | correct | trace: Content QA rounds 1-2 wrapped the meta in `[Confirm: ...]`; Page Candidates run 2 emptied it via `PF.neutralSentence` -> `removeAt` |
| `_page_fix.js:119` `removeAt` on a META line removes only the span | correct | |
| `_page_fix.js:199-210` step c, `[ \t]*` | correct | |
| `Content_QA.js:154` `metaOf` `:\s*(.+)$` /im | correct | crosses the newline |
| `Content_QA.js:761-772` six components, `metaDesc.length <= 155` | correct | a 20-character "Slug: ..." passes |
| `Content_QA.js:847, 852` Service schema description = meta | correct | |
| `Blog_Package.js:13` `metaRe` `:\s*(.+)$` /gim; `:48, 214, 219, 260` | correct | |
| `Finalize_Parse_Brief.js:97-100` empty context, `target_word_count: ownWords` | correct | |
| `Finalize_Verdict.js:23-28` classifies the new QA only; `:54-66` body without files | correct | the grade object is built at `:47-48` |
| `Finalize_Apply.js:46-51, 65, 76-82`; `Finalize_Merge.js:30, 38-41` | correct | |
| `_page_fix.js:469-475` `prefillOf` (half the words, either way); `:477` `neutralIn` | correct | |
| `Page_Candidates.js:69-75`, `:117-118` | correct | grade object at `:81-84` (not cited) |
| `page-review.ts:280-283` `prefilledAnswer`, `:286-289` `factOf`, `:360-399` `finalizeBody` | correct | |
| `pageReview.ts:73` 5-minute timeout, `:524-575` `runFinalize` | correct | |
| `ReportView.tsx:55-75` downloads from `report.files` | correct | |
| `build_monitors.py:1159-1173` Finalize workflow | correct | Content QA and Originality Check asserted byte-identical to main (`:1179`) |
| `_cost_cal.js:40` Haiku 4.5 only | correct | |
| `cost.ts:72` content ai 0.8 + dfs 0.04; `billing.ts` 60 credits per dollar | correct | `quoteCredits` is at `billing.ts:66` |
| `build_v4.py:894` "the PDF uses the same grade" | off by two | the Build Word File content-score patch is `:892` |
| `Parse_Verdict.js` (§2.1, Fix 4 owner, W1-A, W1-D) | **does not exist** | see H5 |
| `KWI.serpPageTypes` counts "already in the run" (Fix 3.3) | **false** | see H3 |
| "most PRC fields already in the content callback" (§3.0) | **false** | see H2 |

Execution facts used below: 3299 was an app form run (`client_ip app:...`, `force_content: false`, `verdict_score: 42`,
`GO_WITH_CHANGES`). The page run already delivered `not_ready` with one blocker (`duplicate_page`) and a grade of 92 (length 7/15).
3336 received `meta.meta_description = "Slug: ms-365-erp-uae"` from the app and returned `ready` with a grade of 100, no blockers and
advice `meta_desc` and `answer_first`. It took 23 s, and its workflow `executionTimeout` is 300.

---

## High

### H1. Fix 4 (hold under 50) has no exemptions and no null rule. It would stall case studies, AI pages and ladders
- **Plan**: §2.1 value gate, Fix 4, D1.
- **What is wrong**: the hold applies to every run with `verdict_score < 50`, and "`force_content` no longer bypasses a hold". But
  `force_content` is set by more than the cadence and the ladders:
  - `Spawn_Case_Study_Run.js:7` (case studies: the keyword is the case name, so the score is near zero by design);
  - the cadence's AI page of the week (`Cadence_Plan.js:600` with `ai_target`: questions chosen for AI answers, often with no search volume);
  - `Tracker_Report.js:253` (next rung);
  - `Spawn_Page_Runs.js:28` (the rungs the client asked for when they started a ladder);
  - the app's ladder "Write now" (`app/shared/src/payload.ts:143`).
  Ladder rungs are long-tail on purpose (3299's keyword was itself a rung, scored 42). So the hold would stop the features whose value is
  not search volume, and could stop whole ladders.
  The plan also never says what happens when there is no score. `NOT_CHECKED` / `score_withheld` gives `verdict_score: null`, and in
  JavaScript `null < 50` is `true`, while `undefined < 50` is `false`. So the outcome depends on which empty value arrives.
- **Evidence**: `grep force_content v5/code/*.js`; 3299 Parse Verdict fields `verdict_score`, `score_withheld`.
- **Correction**:
  - Compute `verdict_hold` (boolean) and `hold_reason` in a patch to *Parse Verdict*. The router then reads `$json.verdict_hold`, and
    the harness can test the rule as code.
  - Exempt: page roles `case_study` and AI answer pages (`ai_target` present); refresh runs of an own URL (`existing_page_url` set); and
    ladder rungs whose ladder plan already passed the verdict of the head term (they get the Wave 1 rung floors instead).
  - A null score is "not checked": no hold, and the reason is printed.
  - For automatic sources, first run the hold in shadow mode for two cadence cycles (log `would_hold` only). Measure how many cadence
    and ladder picks it would stop, then switch it on. Free: read the last 30 production page runs' `verdict_score` by `pipeline_source`
    before W0-D starts.
  - Add these to the acceptance tests: case study, AI page and refresh are not held; a null score is not held.

### H2. The page-run context is mostly missing from the callback and from every stored report
- **Plan**: §3.0 PRC, Fix 2.
- **What is wrong**: the plan says most PRC fields are already in the content callback. 3299's *Build Webhook Response* body carries
  only `qa_blocking`, `verdict` + `score`, `meta.page_type`, `meta.originality.duplicate_targets` and `request_id`. It does not carry
  `length_band`, `coverage_target`, `terms`, `facts`, `sources_cited`, `style_guide`, `site_urls` or a `content_request_id`. The engine
  fallback ("load by `content_request_id` from `seo_content_log`") finds none of them either: `LOG_COLS` holds site, keyword, source,
  page_type, URLs, rung, status and `qa_reasons` only. Fix 2.4 then says a check Finalize cannot reproduce "cannot produce Ready on that
  basis". Every page delivered before the deploy (techand's included) has no full PRC, so every final version would fall back to "not
  checked" and could never be Ready.
- **Evidence**: callback key dump of 3299; `ladder_common.LOG_COLS`; `pageReview.ts:385` (finalize builds from `bp.meta`).
- **Correction**:
  - Split the PRC into **gating** fields and **grading** fields.
    - Gating: `qa_blocking`, `duplicate_targets`, `verdict` / `verdict_score` / acknowledged, `page_type`. These are present in every
      stored report today, so the app derives them from the stored payload with no engine change, for old and new reports alike.
    - Grading: band, terms, coverage target, facts, sources, style guide, site URLs. W0-B adds them to *Build Webhook Response* (a
      patch in `build_v4.py`, which W0-B does not own yet; add it).
  - A missing grading field becomes "not checked: <field>" in the advice. It never blocks Ready; only a missing gating field does.
  - Drop the `seo_content_log` fallback.
  - On a second finalize, the PRC comes from the **original** content report (`o.original`), not `o.base`. `finalReportPayload` must
    copy the PRC through.
  - Acceptance: an old-format payload (3299's actual keys) finalizes `not_ready` because of `qa_blocking`, not because of "not checked".

### H3. Fix 3's grade cannot see the duplicate blocker or the SERP shapes, and its scales do not match
- **Plan**: Fix 3, §2.6 keyword fit, §2.9 caps, T8.
- **What is wrong**: three separate problems.
  1. **Order.** The plan computes the score in Content QA (`:759-773`). In both workflows the order is Content QA -> (Outbound Link
     Check) -> Originality Check -> Page Candidates / Finalize Verdict. The duplicate page (`Originality_Check.js:69-79`) and every
     blocker (`PF.classify`) are known only after Content QA. So "open blocker -> <= 59" and "duplicate not an update -> fit <= 6" cannot
     be applied in Content QA. The grade object the client sees is built in `Page_Candidates.js:81-84` and `Finalize_Verdict.js:47-48`.
     Neither file is in W0-C's list, and B, E and G own them.
  2. **No SERP shapes.** `KWI.serpPageTypes` is called by the Keyword Check, Keyword Strategy and Ladder nodes only. In the content run
     (3299) the only page-type data is the Competitor Analyzer's free-text `ranking_page_types`. `_kw_inputs` is not inlined in Content QA.
  3. **Scales.** Fix 3.4 gives "fit" the 15 freed length points, but Fix 3.6 caps "fit <= 8 of 20". §2.9's structure cap "<= 10/15" is
     on the R5 scale, while the interim structure component is out of 25. With the arithmetic as written, 3336 without its duplicate
     blocker still grades about 74 (structure capped, fit about 4 of 15, everything else unchanged). So T8 (<= 70) holds only through
     Fix 2's blocker cap. A page like this with no duplicate would still look like a good page.
- **Evidence**: generated workflow order; 3299 Parse Analysis keys; 3336 breakdown structure 25 / coverage 25 / readability 15 /
  specificity 10 / clean 10 / length 15.
- **Correction**:
  - Content QA computes only the **page-local** items: repetition, list labels, weak-only figures, verdict band from `Parse Brief`.
  - The blocker and duplicate caps go in one kit function, `GR.cap(grade, cls)`, called where the grade object is built
    (`Page_Candidates.js`, `Finalize_Verdict.js`). Give W0-C those two lines and serialise it after B, E and G, or give the grade-object
    lines to W0-C alone.
  - Add a free `KWI.serpPageTypes` call to the content run on the SERP Top 10 organic list (inline `_kw_inputs` into *Parse Analysis*
    or *Merge Keyword Data*; a build patch, owned by W0-C) and carry `serp_shapes` explicitly.
  - Write the interim point table in one scale (out of 100, every cap in those units) in the plan.
  - Add a second pin: 3336 with `qa_blocking` emptied grades <= 75 and never 95+.

### H4. Fix 1's meta rebuild never reaches the final version, and the broken stored meta is sent back in
- **Plan**: Fix 1 steps 2, 4, 5; acceptance (e).
- **What is wrong**:
  - The rebuild lives in `PF.fix` step c. The Finalize workflow never calls `PF.fix`: it uses `PF.classify`, `PF.questions` and
    `PF.deliver` only.
  - The app sends `meta.meta_description` from the stored `meta.json` (`finalizeBody`, `page-review.ts:392`; `pageReview.ts:385`). For
    3299 that is `"Slug: ms-365-erp-uae"` (seen in 3336's webhook body), and `Finalize_Parse_Brief.js:84` writes it back as a head line.
  - After Fix 1.5 the label-prefixed description becomes a blocking publish error. With nothing in Finalize to rebuild it, every old
    page with a broken meta finalizes `not_ready` and cannot be fixed by the client's answers.
  - A third reader with the same newline bug, `Build_WP_Draft.js:5`, is not in the plan.
  - Acceptance (e) replays *Content QA*, but Content QA neither rebuilds the meta nor measures `meta_description_length` (that is
    *Blog Package*).
- **Evidence**: Finalize node list (no Page Fix); 3336 `body.meta`; `grep "Meta Description" v5/code`.
- **Correction**:
  - Move the meta rule into a small kit function, `PF.meta(md, ctx)`. Call it from `PF.fix` step c **and** from
    `Finalize_Parse_Brief.js` after the head is built.
  - The app's `finalizeBody` drops a description that starts with a field label or is under 70 characters.
  - Fix `Build_WP_Draft.js:5`.
  - Repair existing reports at read time in `pageReview.ts`: show "meta description missing: we will write one".
  - Guard `neutralSentence`'s `cta` and `reword` paths against META lines, not only `removeAt`.
  - Change acceptance (e) to replay the chain Page Fix -> Content QA -> Page Candidates -> Blog Package, and add a finalize test that
    starts from the 3336 body.

### H5. `Parse_Verdict.js` does not exist; parallel agents patch the same v3 nodes in `build_v4.py`
- **Plan**: §2.1, Fix 4 Where, §3.8 W0-D / W0-F, Wave 1 W1-A / W1-B / W1-C / W1-D, W3-A ("Parse Brief code").
- **What is wrong**: *Parse Verdict*, *Parse Brief*, *Parse Analysis* and *Normalize Input* are v3 export nodes changed only by
  anchored `patch()` calls in `build_v4.py` (Parse Verdict alone at `:867`, `:2774-2776`, `:3232-3234`, `:4078`, `:5457-5485`, `:5657`).
  Every change to them is a new patch anchored on text that an earlier patch produced. When two agents patch the same node in parallel,
  one of them breaks on merge. In Wave 0, D (router + Parse Verdict) and F (Facts wiring + Parse Brief / Analysis lineage) both edit
  `build_v4.py` in batch 1. In Wave 1, B (type hold), C (routing) and D (structured verdict) all touch Parse Verdict and the router in
  parallel.
- **Evidence**: `ls v5/code/Parse_Verdict.js` (missing); `grep "patch('Parse Verdict'" build_v4.py`.
- **Correction**:
  - Name the real artefact: "a new build section appended at the end of `build_v4.py` with patches to *Parse Verdict*". Or extract Parse
    Verdict to `v5/code/Parse_Verdict.js` with `setcode()` as a one-off orchestrator commit **before** Wave 0, re-anchoring the six
    patch groups. The extraction is the better long-term choice.
  - Every agent adds its own numbered section at the end, never edits an earlier section in place (the "near :840-848" wording in
    W0-F breaks this).
  - Give one agent per wave ownership of *Parse Verdict* and the router (Wave 0: W0-D; Wave 1: W1-D), and make the others depend on it.

---

## Medium

### M1. A new callback stage `verdict_hold` would leave the run open
- **Plan**: Fix 4.1, 4.3.
- **What is wrong**: keyword runs complete only on stage `content` (`app/shared/src/constants.ts:181` `finalStages: ['content']`;
  `runs.ts:700`). A new stage is not in `REPORT_STAGES` / `STAGE_LABELS` (`report-delivery.ts:193`), so the run stays "running" until the
  failure watcher, and credits never settle. Verdict-only runs already return stage `content` (`runs.ts:739`).
  `hold_ack` is a new payload field. Normalize Input matches fields fuzzily, so it also needs `npm run export:payloads` and harness S23.
  The plan names these only for W4-A.
- **Correction**: keep stage `content` and add `hold: { score, reasons, alternatives }`. The app renders a hold when `payload.hold` is
  set. Add `hold_ack` to `schemas.ts` / `payload.ts` (key order) + Normalize Input pass-through patch + S23 in W0-D's list. App test: a
  held callback completes the run and charges only the actual cost.

### M2. "Check this first" has no verdict score to show
- **Plan**: Fix 4.3.
- **What is wrong**: the Keyword Check (`Assess_Response.js:212`) returns volume, KD, intent, CPC, position, reach and plan type. It has
  no 0-100 verdict score, so showing "its score and the hold rule" would show a different number from the one that holds the page.
- **Correction**: the form says "a page is held for your OK when our verdict scores the keyword under 50" and shows the verdict score only
  in the hold report. Or add the verdict to the Keyword Check later (cost change, owner decision).

### M3. A held cadence pick would be re-picked every week
- **Plan**: Fix 4.2.
- **What is wrong**: `Content_Log_Row.js:17` skips when no page was written, so a held run leaves the cadence's `started` row as it is.
  `Cadence_Plan.js:512` counts a `started` row only while `inFlight(started_at)`. After that the keyword is a candidate again: a weekly
  loop that holds it again and spends about $0.13 each time.
- **Correction**: `Content_Log_Row.js` writes `status: 'held'` (with the score and reason in `qa_reasons`) when the run held. Both
  `Cadence_Plan.js` and `cadence.ts` treat `held` as skipped until a `hold_ack` or a re-check interval (*our choice*, e.g. 90 days), in
  the same commit. No new column is needed.

### M4. W0-E's file list misses the brief parser schema and the brief-question mapping; B and E collide in `page-review.ts`
- **Plan**: Fix 5.1, §3.8.
- **What is wrong**:
  - `questions_for_client` is fixed as `string[]` by the Strategy Brief's structured-output schema at `build_v4.py:12610`. The LLM
    output parser would reject objects. W0-E does not own `build_v4.py`.
  - `Page_Candidates.js:77` passes the brief's questions to `PF.questions` as strings.
  - In batch 2, W0-B (`finalizeBody`) and W0-E (`prefilledAnswer`, Accept all) both edit `app/shared/src/page-review.ts`.
- **Correction**: add `build_v4.py` (one appended patch to `_sb151` at `:12610`) and `Page_Candidates.js:77` to W0-E. Accept both
  string and object items for one release, because stored briefs are strings. Serialise B before E, or split the shared file's edits.

### M5. W0-C and W0-G both edit `Finalize_Verdict.js` and `build_monitors.py` in the same batch
- **Plan**: §3.8 batch 3.
- **What is wrong**: the grade object and its `basis` text ("... length") are built in `Finalize_Verdict.js:47-48`, and C must change
  them. G changes the same node's output (`files[]`). Both touch the Finalize section of `build_monitors.py`: C for the kit inlining
  (`_FIN_KITS`, `:1149`), G for new nodes.
- **Correction**: run C before G, or give G only the new nodes after *Finalize Verdict* and have it read the body rather than edit the file.

### M6. Fix 6 wiring, lineage, retry and ledger rules are not stated
- **Plan**: Fix 6, W0-F.
- **What is wrong**:
  - "Wiring near `:840-848`" edits an early section that later retry splices rewire (`:2190`, `:5342`, `:7484` rebuild Facts SERP ->
    Collect Facts).
  - A new field added at *Collect Regulatory Facts* reaches the Strategy Brief only if every code node in between carries it (Parse
    Analysis -> ... -> Parse Verdict -> Brief Context). That is the G1 class of defect the plan only lints in Wave 1.
  - SearXNG and the official-page reads are external HTTP nodes, which `retry_lint.py` requires to have 3 tries / 5 s.
  - The DataForSEO fallback must go through `dfs_gate.splice()`, join `__LEDGER_NODES` in every ledger node (as `Facts SERP (Retry)` did
    at `:2212`) and pass `gate_lint`, or the build fails or the money goes uncounted.
  - Official pages (MoF) are often PDFs or bot-walled.
- **Correction**:
  - Use a new appended section, with Collect Facts -> Regulatory Plan -> SearXNG -> Read -> Collect Regulatory Facts -> Competitor
    Analyzer.
  - The prompts and Content QA read `$('Collect Regulatory Facts').first().json` explicitly, inside try/catch.
  - State the retry and ledger rules in W0-F's brief.
  - A PDF or blocked official page yields "none could be confirmed", never a secondary source.
  - Acceptance: a build assert that the regulatory block reaches the Strategy Brief prompt.

### M7. Fix 7 underestimates the port of the page tail; the app can already make three of the five files
- **Plan**: Fix 7, W0-G.
- **What is wrong**:
  - *Build Word File* (121 KB) reads `$('Check Crawl')`, `$('Claude - Critic')`, `$('Normalize Input')`, `$('Promise Judge')` and
    `$('Load Cost Calibration')`. *Blog Package* and *Image Cards* read `$('Site Model')`. None of these nodes exists in Finalize, so the
    byte-copy approach used for Content QA does not work.
  - PDF bytes are n8n binaries on disk. The synchronous JSON response needs `this.helpers.getBinaryDataBuffer` + base64 in the body.
  - The app's `extractFiles` (`app/server/src/services/files.ts:94-96`) already turns payload `html`, `markdown` and `meta` into `.html`,
    `.md` and `.meta.json` downloads.
  - The Finalize workflow also has its own n8n `executionTimeout: 300`, besides the app's 5 minutes.
- **Correction**:
  - Wave 0: in `runFinalize`, run `extractFiles` on the final payload (HTML, Markdown, meta.json) and copy the original report's image
    file rows. No engine change.
  - Word / PDF: either a Finalize-only node that renders the final HTML through Gotenberg (`http://gotenberg:3000`, present in
    `deploy/gcp/compose.prod.yml`) and returns base64, or defer them.
  - Acceptance: the final version's report has HTML, MD, meta.json and the original images; a PDF is listed only when rendered.

### M8. Fix 2's "publish as an update of <url>" has no executor
- **Plan**: Fix 2.3, D2.
- **What is wrong**: Finalize is synchronous, buys no research and starts no run (asserted at `build_monitors.py:1181-1182`). "Turns the
  run into a refresh hand-off" names no component that starts the refresh, and no cost for it.
- **Correction**: Finalize records the decision and sets `target_url` / slug in the meta. The app offers "Rewrite as an update of <url>",
  which starts a normal keyword run with `existing_page_url`, quoted and charged as a page.

### M9. Several acceptance tests cannot run as written
- **Plan**: Fix 1 (e), Fix 5, §3.8 "replays of 3299 / 3336", §5.2 regression pin.
- **What is wrong**:
  - The harness runs Code nodes against fixtures and cannot call Claude. "The free of charge answer lands inside the CTA sentence"
    needs the Finalize Editor's answer.
  - The 3299 / 3336 replays use client text. If the fixture is git-ignored, the harness fails or skips on any other checkout (and in
    CI), which conflicts with "harness 0 failed".
  - IF-node routing ("Need Content? false") is not a Code node.
- **Correction**:
  - Fix 5: test `Finalize_Apply` (the job names the CTA host sentence) and `Finalize_Merge` (an appended standalone sentence is
    refused) with a **recorded** editor answer.
  - Commit an **anonymised** replay fixture (same structure and meta lines, rewritten sentences), as `fixtures_ctfix2_159.json.gz` does.
  - Routing: build asserts on the IF expressions plus Code-node tests on the `verdict_hold` flag (H1).

---

## Low

- **L1** (§2.9): `build_v4.py:894` should be `:892` (the Build Word File content-score patch).
- **L2** (Fix 1.6, Fix 5): old reports in production still carry a head question (3299 q4: "Is this true ... The page says: 'MS 365
  ERP explained ...'"). Finalize should ignore an answer whose `original` equals the head line, so a "yes" is never woven into the body.
- **L3** (§2.7): model ids "Haiku 5.5", the 400 on forced tool choice and the `temperature` refusal from API version 2026-10-21 are
  unverified here (`_cost_cal.js` knows `claude-haiku-4-5` only). Confirm them with the `claude-api` reference and one free
  `count_tokens` call before W2-C. Price an unknown id at `UNKNOWN` until then.
- **L4** (Wave 1): W1-B, W1-C and W1-D run in parallel on Parse Verdict and the router (see H5); W1-E correctly waits for W1-B.
- **L5** (Fix 3 acceptance): "a clean fixture still grades >= 80" needs a stated default for a fixture with no `verdict_score` (full
  fit, or "not checked").
- **L6** (Fix 6): `Collect_Facts.js` and `Parse Analysis` read upstream nodes by name. Keep *Collect Facts* as the node *Parse
  Analysis* reads, so its patch at `build_v4.py:849` still matches.
- **L7** (§8 quick fix 1): the live meta can be fixed by hand now. Also tell the client that the page-review screen will keep showing
  the broken meta until the read-time repair (H4) ships.

## The eight known defects

| # | Defect | Plan fix | Covered? |
|---|---|---|---|
| 1 | meta claim-checked, emptied, misread | Fix 1 | yes, but see H4 (Finalize path, `Build_WP_Draft.js`, acceptance) |
| 2 | meta sentence became q4 | Fix 1.6 | yes; old reports need L2 |
| 3 | Finalize dropped the blocker, graded 100 | Fix 2 + Fix 3 | yes, but see H2 and H3 |
| 4 | grade ignores repetition, fit, proof, sources | Fix 3 (interim), Wave 2 | yes, but see H3 (order, shapes, scale) |
| 5 | verdict 42 written anyway | Fix 4 | yes, but see H1, M1, M3 |
| 6 | appended fragments, slogan as proof | Fix 5 | yes, but see M4 and M9 |
| 7 | no local regulatory research | Fix 6 | yes, but see M6 |
| 8 | no downloads on the final version | Fix 7 | yes, but see M7 |

Nothing is missing from the eight. The weak sources the Critic flagged (Visionet, Landbase) are only marked down in the Wave 0 grade.
Removing them is Wave 3 (W3-A). That matches the owner's list, but the client should be told.
