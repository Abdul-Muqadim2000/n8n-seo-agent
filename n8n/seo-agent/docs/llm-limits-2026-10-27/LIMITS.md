# Claude node limits and the cut-off guard (LLM-LIMITS, 2026-10-27)

## The defect

Production, techand.ai, 2026-10-25: Content Cadence page run `cad_20261022_techand-ai_2`, keyword "ms 365 erp", Service Page, n8n
execution 2195 of the main workflow.

| Step | What happened (from the execution data) |
|---|---|
| Copywriter (Opus 5.5, streaming, adaptive thinking, effort medium, maxTokensToSample 32,768) | complete 1,804-word page in 154.8 s, ending with the CTA link `[Request a scoping consultation](https://www.techand.ai/contact-us)`; counted answer 4,385 tokens (Count Answer 17,712 minus Count Prompt 13,327) |
| Content QA round 1 | asked for a revision (one unsupported claim, wording) |
| Editor (same model settings) | ran **277.9 s** and returned 749 words ending mid-word: `- **Payroll:** Does the add-on cover gratu`; counted answer about 1,992 tokens (11,230 minus 9,238); n8n's own figure is a tiktoken estimate (`tokenUsageEstimate` 1,083 out), thinking is not in it |
| Pipeline | replaced the complete draft with the cut edit; Content QA round 2 said only "main content is 666 words against a target of 900-2400"; the page was delivered "not ready to publish". The client saw half a blog. |

## Root cause, with evidence from the n8n 2.41.4 image

Read from `n8nio/n8n:2.41.4` (`@n8n/n8n-nodes-langchain` LmChatAnthropic node, `@langchain/anthropic` 1.5.6, `@anthropic-ai/sdk` 0.115.0):

1. **How thinking is configured with no budget.** `LmChatAnthropic.node.js` `supplyData`: with `thinkingMode: 'adaptive'` it sends
   `thinking: { type: 'adaptive' }`, `output_config: { effort }` and `max_tokens: options.maxTokensToSample`. There is no budget: the
   manual mode (`budget_tokens`) is the only budget n8n offers and Opus 5.5 / Sonnet 5.5 reject `budget_tokens` with a 400. Thinking and
   the visible answer share the **one** `max_tokens` ceiling; the model decides how much of it to think.
2. **A max_tokens stop is not an error.** The API ends such a stream normally with `stop_reason: "max_tokens"`. In
   `@langchain/anthropic` `chat_models.cjs` `_generate` (streaming branch) the chunks are concatenated and only
   `{ text: finalChunk.text, message: finalChunk.message }` is returned; the stop reason rides in the `message_delta` chunk's
   `additional_kwargs` (`utils/message_outputs.cjs`). The n8n agent node outputs only `{ output }`, so nothing downstream can see it.
3. **An early-ended or aborted stream is not an error either.** `@anthropic-ai/sdk` `core/streaming.js`: the iterator ends cleanly when
   the body ends (it does not require `message_stop`) and returns without throwing on an abort error. Partial text is returned as a
   success on every one of these paths.
4. **Which cause fits.** The Editor ran 1.8x longer than the Copywriter while writing less than half the visible tokens. At the rate
   that fits both runs (about 118 tokens a second), 277.9 s is about 32,800 tokens: the 32,768 ceiling, of which roughly 30,800 were
   thinking (the Editor was given the whole page plus six problems to fix "all of them"), leaving about 2,000 tokens of answer, which
   is what was counted. The same rate gives the Copywriter about 18,300 tokens (13,900 thinking + 4,400 page). A stop at the ceiling
   mid-word, with no error, at that duration, is the `max_tokens` path (1 + 2). Paths 3 are silent too, so the guard below covers them.

## The rule (owner, 2026-10-27): quality first, never shrink thinking

Every Claude node is declared once in `n8n/seo-agent/llm_limits.py`:

* `think`: the thinking budget it may use (generous, at least what it uses today). The API takes no number on these models, so it is
  enforced by the room the ceiling leaves.
* `head`: the room its own output needs (longest page / brief / e-mail / JSON plus overhead and a safety margin).
* `max` (maxTokensToSample) **>= think + head**, at most the model's documented maximum output (Opus 5.5 / Sonnet 5.5 128,000,
  Haiku 4.5 64,000).
* streaming whenever `max` > 21,333 (the SDK refuses a non-streaming request that may take more than 10 minutes:
  `60 * 60 * max / 128000 > 600`).

The build fails (`llm_limits.check`, run at the end of `build_v4.py` over every generated workflow) on an undeclared Claude node, a
ceiling below budget + headroom, a missing stream, an effort level that differs from the table (thinking reduced), a manual budget, or
a ceiling above the model maximum. Its self-test breaks the rule eight ways on every build and requires the lint to bite each time; the
harness (LL1) breaks it again offline. Never lower a budget to pass it: raise the ceiling.

## Inventory: every Claude node, old and new

22 Claude model nodes across the generated workflows (the untouched v3 export is not linted). **18 of them were unsafe before**: every
thinking node shared one ceiling between unbounded adaptive thinking and its answer, and each old ceiling was below its thinking budget
plus output headroom. The 4 Haiku nodes have no thinking and keep their values (each already fits its output).

| Workflow | Node | Model | Output | Old max / stream | New max / stream | Thinking (effort) | Think budget + headroom |
|---|---|---|---|---|---|---|---|
| main | Claude — Copywriter | Opus 5.5 | page (Markdown, up to 2,400 words) | 32,768 / yes | 128,000 / yes | adaptive (medium, unchanged) | 64,000 + 32,000 |
| main | Claude — Editor | Opus 5.5 | the complete corrected page | 32,768 / yes | 128,000 / yes | adaptive (medium, unchanged) | 64,000 + 32,000 |
| main | Claude — Strategy Brief | Opus 5.5 | brief (JSON) | 24,576 / yes | 128,000 / yes | adaptive (medium, unchanged) | 64,000 + 32,000 |
| main | Claude — Competitor Analyzer | Sonnet 5.5 | analysis (JSON) | 16,384 / no | 128,000 / yes | adaptive (medium, unchanged) | 48,000 + 24,000 |
| main | Verdict Chat Model | Sonnet 5.5 | verdict (JSON) | 16,384 / no | 128,000 / yes | adaptive (medium, unchanged) | 48,000 + 24,000 |
| main | Anthropic Chat Model (Keyword Seeds) | Sonnet 5.5 | seeds (JSON) | 16,384 / no | 128,000 / yes | adaptive (medium, unchanged) | 48,000 + 24,000 |
| main | Claude — Content Reviewer | Sonnet 5.5 | review (JSON) | 16,384 / no | 128,000 / yes | adaptive (medium, unchanged) | 48,000 + 24,000 |
| main | Claude — Critic | Sonnet 5.5 | editorial review (JSON) | 16,384 / no | 128,000 / yes | adaptive (medium, unchanged) | 48,000 + 24,000 |
| main | Claude — Keyword Relevance | Sonnet 5.5 | labels (JSON, 80 a chunk) | 16,384 / no | 128,000 / yes | adaptive (low, unchanged) | 48,000 + 24,000 |
| main | Claude — Ladder Relevance | Sonnet 5.5 | labels (JSON) | 16,384 / no | 128,000 / yes | adaptive (low, unchanged) | 48,000 + 24,000 |
| main | Claude — Site Describer | Haiku 4.5 | description (JSON) | 4,096 / no | 4,096 / no | none | 0 + 3,000 |
| AI Visibility | Claude — Prompt Writer | Sonnet 5.5 | question panel (JSON) | 8,192 / no | 128,000 / yes | adaptive (low, unchanged) | 48,000 + 24,000 |
| AI Visibility | Claude — Answer Analyst | Sonnet 5.5 | answer analysis (JSON) | 8,192 / no | 128,000 / yes | adaptive (low, unchanged) | 48,000 + 24,000 |
| AI Visibility | Claude — AI Brief | Sonnet 5.5 | report brief (JSON) | 8,192 / no | 128,000 / yes | adaptive (low, unchanged) | 48,000 + 24,000 |
| AI Visibility | Claude — Sentiment Reader | Haiku 4.5 | labels (JSON) | 4,000 / no | 4,000 / no | none | 0 + 3,000 |
| AI Growth | Claude — AI Outreach Writer | Sonnet 5.5 | outreach e-mails (JSON) | 6,000 / no | 128,000 / yes | adaptive (low, unchanged) | 48,000 + 24,000 |
| Backlink Monitor | Claude — Link Analyst | Sonnet 5.5 | link analysis (JSON) | 8,192 / no | 128,000 / yes | adaptive (low, unchanged) | 48,000 + 24,000 |
| Backlink Monitor | Claude — Outreach Writer | Sonnet 5.5 | outreach e-mails (JSON) | 8,192 / no | 128,000 / yes | adaptive (low, unchanged) | 48,000 + 24,000 |
| Link Builder | Claude — Outreach Sequence Writer | Sonnet 5.5 | sequences (JSON, up to 10 x 3 e-mails) | 16,000 / no | 128,000 / yes | adaptive (low, unchanged) | 48,000 + 24,000 |
| Site Tracker | Claude — Site Brief | Sonnet 5.5 | report brief (JSON) | 8,192 / no | 128,000 / yes | adaptive (low, unchanged) | 48,000 + 24,000 |
| Reply Reader | Claude — Reply Reader | Haiku 4.5 | class + suggested reply (JSON) | 1,500 / no | 1,500 / no | none | 0 + 1,200 |
| Keyword Check | Claude — Keyword Fit (2 agents) | Haiku 4.5 | topic fit (short; answers within 45 s) | 1,200 / no | 1,200 / no | none | 0 + 600 |

**No node's thinking, effort level or quality step was reduced.** Every ceiling is at least the old one; every effort level is the one it
had; the Critic, both Editor rounds, Content QA, the promise check and every other step are unchanged. The guard only adds a retry.

Cost: a ceiling is room, not spend. The cost kit (`v5/code/_cost_cal.js`) prices a streaming call's thinking from the call table's
`think_model` (the price each node had before: 3,277 tokens for the Copywriter and the Editor, 2,458 for the Strategy Brief, the
measured "seen" figure for the Sonnet nodes) instead of a share of the ceiling, so raising the ceiling changes no price (harness LL8).
Open item, not changed here: the timing above suggests the Opus nodes think far more than 3,277 tokens (about 14,000 for the Copywriter,
about 31,000 for this Editor call), so the modelled Claude cost of a page run is low; the monthly reconciliation
(`reconcile_claude_cost.py`) is where that should be corrected.

## The guard (deterministic, `v5/code/_complete.js`, one shared kit)

* `CK.text`: a long text ends cleanly. Cut when: the last sentence has no ending or stops on a dangling word / comma; the last list
  item is a question with no question mark, or stops while the items before it end with a full stop; a table row is open or short of
  cells; a code block is open; bold or a link is not closed; the last heading has no text. Clean endings: a sentence end, a link / CTA,
  a bracketed CTA or field, an e-mail sign-off. On the ten real pages in the harness: no false alarm; random mid-word cuts caught 97%.
* `CK.edit`: an edit of a complete page is complete and still the whole page: under 75% of the input's main-text words when no cut
  was asked for (40% when Content QA asked for a cut), or two or more sections gone, is a cut.
* `CK.json` / `CK.answer`: a JSON answer that stops inside its JSON is `truncated`, never an empty or partial valid answer; an agent
  item that failed its parser after n8n's one retry is named.

Where it runs:

| Place | On a cut answer |
|---|---|
| *Draft Check (Copywriter)* -> *Draft Complete? (Copywriter)* | write the page once more from the same brief; cut twice: the run stops with "The page could not be written in full ... No page was delivered and nothing was published." |
| *Edit Check (Editor)* -> *Edit Complete? (Editor)* | edit once more (one retry per quality round, and never a runaway loop); cut twice: the complete page from before that edit is kept, the reason recorded, and the points that round asked for are listed again |
| Content QA | a cut page is its own reason ("the page is cut off at the end: it stops at ...") instead of "short", and is never publishable |
| Run Ledger Settle (main) and every monitor's Ledger Settle | the note is written first on the row's `cost_basis` ("Claude answer cut short: ..." / "Claude answer incomplete: ...") so ops see it |
| JSON agents | n8n's structured parser refuses a cut JSON and the agent is retried once (`retryOnFail`); main workflow: a second failure stops the run; monitors: the settle names it |

A retry is a second run of the model node, so it is priced (R57: calls = the model node's runs, `retries` in the basis); nothing is
charged twice silently.

## Tests

* Build: `llm_limits.check` (22 nodes, self-test 8 cases), all INVARIANTS lints, exit 0.
* Harness `scenarios_llmlimits.js` LL1-LL8 on the generated code and the production replay
  (`harness/fixtures/llm_cutoff_techand_2195.json`, trimmed: the Copywriter draft, the cut Editor answer, the page the Editor was given).

## Deploy notes

Engine only (`deploy/gcp/deploy_engine.py` over the tunnel, the usual way; no new Data Table column). The main workflow, the five
monitors with Claude agents, the Site Tracker, Reply Reader and Keyword Check are regenerated. Every Sonnet node now streams; streaming
needs nothing on the server. The first live page run after the deploy is the live check: the run's ledger row must carry no
"Claude answer cut short" note, or, if it does, the delivered page must be complete.
