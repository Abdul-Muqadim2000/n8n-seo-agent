# AI search visibility: engine audit (2026-10-23)

Read-only audit of the n8n side of AI search visibility on git HEAD `3af6f7a2`. Production runs the same build (`PROD_STATE.md` §1).
Scope:
- The question panel (`_ai_panel.js`, `AI_Plan.js`, `Pulse_Plan.js`, `Prompt_Jobs.js`, `Prompt_Rows.js`, `AI_Prompt_Rows_Admin.js`, `ai_prompts.txt`).
- The requests and retries (`AI_Requests.js`, `AI_Retry_Requests.js`, `Merge_AI_Answers.js`).
- How answers are read (`Parse_AI_Answers.js`, `Apply_Analysis.js`, `answer_analyst.txt`).
- The figures (`AI_Metrics.js`, `Pulse_Metrics.js`, `_ai_stats.js`) and the report and callback (`AI_Report.js`, `Build_AI_Callback.js`).
- The split run (`AI_Chunk_Handoff.js`, `AI_Run_Resume.js`, the run guard).
- Crawler access (`AI_Access.js`, `_ai_access_kit.js`).
- The wiring in `build_monitors.py` and the generated `SEO_Agent_AI_Visibility.json` / `SEO_Agent_AI_Pulse.json`.

**Baseline.** The offline harness passed on HEAD in a throwaway `n8nio/n8n:2.41.4` container: **11008 passed, 0 failed**.

**How the findings were proved.** Every finding marked *proved* was reproduced by a small node script. Each script ran against the generated
code in `harness/code_v4/` through `harness/harness.js`, in the same container (recipe in the appendix). Nothing in the repo was changed
apart from this file.

**App side.** The app is audited separately in `APP_AUDIT.md`. §7 below lists only the contract points between the engine and the app.

Severity:
- **High**: a wrong number or wrong advice reaches a customer, or money is lost.
- **Medium**: a real defect with a narrower blast radius.
- **Low**: hygiene.

---

## Summary

| ID | Sev | What | Where |
|---|---|---|---|
| E1 | High | A split weekly run re-asks and re-pays the same 600 requests in every later execution when its answers were not stored. The loop is bounded only by the 6-day resume window or the account balance. | `AI_Plan.js:123,133-134`, `AI_Chunk_Handoff.js:42`, `build_monitors.py:373` |
| E2 | High | Arabic (any non-Latin) questions written by the Prompt Writer all collapse into one `prompt_id`. Only the first is stored, and later weeks overwrite its wording under the same id. | `Prompt_Rows.js:19-20,64-67` |
| E3 | High | Every non-generic site AI *cites as a source* is counted as a competitor. Cited twice, it becomes a "rival": it is removed from the PR targets and the `ai_source` prospects, and it deflates share of voice. | `Parse_AI_Answers.js:66`, `Apply_Analysis.js:31`, `AI_Metrics.js:123,142,168` |
| E4 | High | A configured competitor whose domain label is shorter than 5 letters (sap, zoho, xero, sage, odoo, deel…) is never detected by name. Its mentions are lost, share of voice is inflated, and the client's rank is overstated. | `Parse_AI_Answers.js:61` |
| E5 | High | A domain label that is a common word (payroll.ae → "payroll") becomes a brand name, so every answer about the category "names" the client at rank 1. The pulse has no Answer Analyst to undo this, and its counts are pooled into the weekly headline. | `AI_Plan.js:49`, `Pulse_Plan.js:101` |
| E6 | High | Segment share of voice counts the pulse's mentions in the numerator but no pulse competitor mentions in the denominator. The same data reads 76.5% per segment against 44.8% headline (the truth on the weekly answers is 20%). | `AI_Metrics.js:227-241` |
| E7 | Medium | "Named in" counts answers that only cited a page without naming the business. The visibility score gives such an answer 0.6 instead of the documented 0.4. | `Parse_AI_Answers.js:56`, `_ai_stats.js:8-9` |
| E8 | Medium | A cited host's domain label is located with an unbounded `indexOf` ("business" in business.com). `DOMAIN_RE` turns tech terms (ASP.NET) into businesses. Both push the client down in rank. | `Parse_AI_Answers.js:65-66` |
| E9 | Medium | Custom and edited questions get the first 5 words of the question as their "keyword". AI Overview presence and citation, AI search volume and the fit gate are measured on that fragment. | `AI_Prompt_Rows_Admin.js:23,30`, `AI_Requests.js:62-63` |
| E10 | Medium | Writer questions that name other vendors ("Zoho Books vs QuickBooks…", "Is SAP Business One worth it…") pass the panel gate, even with sap.com configured. They bias the panel and produce "Win the answer to …" actions for a rival's product. | `ai_prompts.txt:27`, `Prompt_Rows.js:63` |
| E11 | Medium | A chunk that dies (60-minute limit, crash) after paying for its requests loses all of them. The Answer Analyst (up to 36 sequential Claude jobs) sits between the paid requests and `Save AI Answers`, and a 600-request chunk has never been timed. | `build_monitors.py:368-373`, `Analyst_Jobs.js:10` |
| E12 | Medium | `Load AI Run Answers` loads every non-pulse answer row of every site for 6.2 days into every tracker execution, and `Load AI Visibility` / `Load AI Prompts` load the whole tables. Memory and execution data grow with customers × panel. | `build_monitors.py:338,346` |
| E13 | Medium | The per-engine citation alert checks only that the panel has the same *size*, not the same questions or engines (G6 says size is not enough). | `AI_Metrics.js:469` |
| E14 | Medium | Pulse rows are pooled by `checked_at > previous.checked_at` with no upper bound. A run that ends after a pulse morning (split or resumed) counts that morning, and the next week counts it again. | `AI_Plan.js:114-115` |
| E15 | Medium | `prompt_id` is a 32-bit djb2 hash, and `Save Prompts` upserts on `prompt_id` alone. A collision between two sites silently moves one site's question to the other. At about 50k stored questions the chance of at least one collision is about 25%. | `Prompt_Rows.js:19,67`, `build_monitors.py:359` |
| E16 | Medium | "AI states something wrong about you" (High alert) uses free-text dedupe against last week's issues, so a paraphrase re-fires it every week. | `AI_Metrics.js:270-271,498` |
| E17 | Low | An on-demand start that meets an open split run either does nothing with no callback ('busy') or resumes the weekly run under the weekly run's `request_id`. Either way the app's on-demand run never gets its own answer. | `AI_Plan.js:58-60,147` |
| E18 | Low | The weekly and pulse fit-gate contexts differ (ladder heads + services against question topics, no services), so one question can be refused on one path and asked on the other. | `AI_Plan.js:70-71`, `Pulse_Plan.js:68-69` |
| E19 | Low | Share of voice is z-tested as if each competitor mention were an independent trial. One answer naming 4 rivals is 4 "trials", so the SoV verdicts are over-confident. | `AI_Metrics.js:425,481` |
| E20 | Low | Re-upserting stored questions (volume refresh) blanks `fit_note` (the "switched on by the owner over the keyword rule" note) and normalises an out-of-range market to the own market. | `Prompt_Rows.js:35-38`, `AI_Plan.js:105-107` |
| E21 | Low | The "Market-wide share" tile is the share among the domain plus at most 8 competitors, not the market. | `AI_Metrics.js:333-335`, `AI_Report.js:53` |
| E22 | Low | Doc and comment drift. The cost comment says the golden cases run in "harness S200" (they run in S211). `marketsOf` says "at most 6" and slices 8. The app caps markets at 5, but stored question markets can add more, and a question beyond 8 is quietly asked in the site's own market. | `_ai_panel.js:51-55,184`, `AI_Requests.js:41` |

**What checks out:**
- The statistics kit (Wilson, two-proportion z, Holm step-down, Benjamini-Hochberg and the Kish score band) is mathematically correct. I checked it by hand against the formulas.
- Retries never node-retry a paid DataForSEO call: `Run AI Requests`, `Run AI Retries` and `Run Discovery` have `retryOnFail: false` and sit behind the in-200 gate.
- Every key of `vis_row`, the daily row and the answer row is exactly a table column (checked against `ladder_common.py`).
- The cost mirror in `app/shared/src/ai-panel.ts` matches `AIP.cost` value for value, and the golden file is byte-identical.

---

## Findings

### E1 (High): a split run whose answers were not stored re-asks and re-pays the same chunk until the run expires

**Where.**
- `AI_Plan.js:123`: `doneKeys` is rebuilt only from the rows in `seo_ai_answers` (`Load AI Run Answers`).
- `AI_Plan.js:133-134`: `reqLeft = reqTotal - doneKeys.length` and `final_expected = reqLeft <= 600`.
- `AI_Chunk_Handoff.js:42`: the state row records `asked = done_before + asked_now`, but nothing ever reads it back.
- `build_monitors.py:373`: `Save AI Answers` is `onError: continueRegularOutput`.

**Scenario.**
1. `Save AI Answers` fails for a chunk, for example because the Data Table size limit is reached (1 GB in prod), or because of a transient DB error or a timeout of the insert.
2. The next execution finds no stored keys and asks the same first 600 requests again. The state's `asked` stays at 600 for ever, and `final_expected` is never true.
3. The chain continues until `stateVerdict` returns `closed` at 6 days. Nothing in the run guard caps spend for a scheduled run (`_run_guard.js:12-16`); only the shared DataForSEO balance floor stops it, so one customer's broken run can drain the account for every customer.

**Proof** (`p_chain.js`, a 200-question panel, saves failing):
```
execution 1 chunk 1 final_expected false asked now 600 first key q000 | state says asked 600 of 995
execution 2 chunk 2 final_expected false asked now 600 first key q000 | state says asked 600 of 995
execution 3 chunk 3 ...  first key q000 ...
keys asked more than once: 600 | DataForSEO billed so far $9.60   (4 executions)
```

**Fix.** Two guards in `AI_Plan.js`:
- When `going` and `doneKeys.length < (st.asked - st.unavailable) * 0.9`, the earlier part's answers were not stored. Do not ask again: close the run (`status: 'failed_store'`) and raise an ops alert naming the run and the missing count.
- Independently, refuse a continuation whose `doneKeys.length` did not grow since the previous part (store `done_before` in the state and compare).

In `AI_Chunk_Handoff`, compare the number of rows `Save AI Answers` returned with the number of rows sent, and do not start the next chunk on a shortfall.

**Acceptance (offline).** Replay `p_chain.js` with `stored = []` for every part:
- Part 2 plans nothing.
- The state row is `status: failed_store`, there is no `next` start, and an ops-alert item exists.
- The S202 split run still asks 2,495 keys once.

### E2 (High): every Arabic question collapses into one prompt id

**Where.** `Prompt_Rows.js:20`: `norm = t => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ')` strips every Arabic letter. Then:
- `prompt_id = 'p_' + hash(site_id + '|' + norm(prompt))` (`:67`), so every Arabic question hashes the same.
- `have.has(norm(q.prompt))` (`:64-65`) skips every question after the first.

`AI_Prompt_Rows_Admin.js:10` does keep Arabic (`؀-ۿ`), so the same question gets different ids on the two paths.

**Scenario.** A Saudi or UAE site with an `SA-ar` / `AE-ar` market (the Gulf is the core market):
- Of the 40 questions a writer job returns, only one is stored.
- The panel never fills, so the writer runs again every week ($0.04 a job).
- The next week's first Arabic question upserts the **same id** with different wording, so the "stable panel" changes under one id and the trend compares different questions.

**Proof** (`p_arabic.js`): `writer returned 3 Arabic questions; rows stored: 1 [["p_cgw15z","active","ما هي أفضل شركات تطب"]]`.

**Fix.** Use one `norm` everywhere that keeps letters of any script: `/[^\p{L}\p{N}]+/gu`. The n8n Node runtime supports Unicode property escapes. Put it in `_ai_panel.js` and use it in Prompt_Rows, Admin and the dedupe.

**Migration.** Existing Arabic rows keep their id and their wording, but a re-hash would create new ids. Only new questions use the new norm; leave stored ids untouched.

**Acceptance.** `p_arabic.js` stores 3 rows with 3 distinct ids. An Arabic question added through Admin and the same one written by the writer get the same id.

### E3 (High): a site AI cites as a source is booked as a competitor, then as a rival, and lost as a PR target

**Where.**
- `Parse_AI_Answers.js:66` adds every cited host that is neither ours nor `GENERIC` to `named` ("businesses cited as sources").
- `Apply_Analysis.js:31` merges those parser competitors back after the Answer Analyst, which the prompt tells *not* to list publishers (`answer_analyst.txt`, brands rule).
- `AI_Metrics.js:123`: it is counted.
- `AI_Metrics.js:142`: `n >= 2` → `addRival`.
- `AI_Metrics.js:168`: it is removed from `src`, so there is no "Get featured on", no `ai_source` prospect, and AI Growth and the Link Builder read it as a rival (`rival_sources_json`).

**Scenario.** A review site, association or blog that AI cites in 2 answers (title not "Best …") is:
- shown under "Who AI recommends instead";
- removed from the PR / listing actions, which are the highest-value earned-media targets;
- counted in the share-of-voice denominator.

**Proof** (`p_sources.js`, 3 answers: erpreviewhub.com cited twice, never named; the client named once):
```
competitors table: ["erpreviewhub.com:2"]
sources (PR targets): [] | rival_sources: [{"domain":"erpreviewhub.com","citations":2,"kind":"rival"}] | prospects: []
share_of_voice 33.3   (truth: 100, no business was named instead of the client)
```

**Fix.** A cited host is a competitor only when one of these holds:
- (a) its brand or label is named in the answer text (word-bounded), or
- (b) the Answer Analyst listed it, or
- (c) `RV.providerOf` says its cited page sells the category.

Otherwise it stays a source. Apply the same rule in `Pulse_Metrics.js:27` (the pulse's competitor counts come from the same field).

**Acceptance.** `p_sources.js`:
- competitors `[]`, sources `["erpreviewhub.com"]`, one `ai_source` prospect, share of voice 100;
- a cited rival vendor page (title "ERP implementation partner in Dubai") is still a rival.

### E4 (High): configured competitors with short names are invisible

**Where.** `Parse_AI_Answers.js:61`: `const lab = c.split('.')[0]; ... (lab.length >= 5 ? [wordRe(lab)] : [])`.
- For sap.com, zoho.com, xero.com, sage.com, odoo.com, deel.com and wave.com, only the literal domain string or a citation counts.
- Answers name these as "SAP Business One", "Zoho Books", "Odoo". Only ChatGPT and Gemini (`brand_entities`) and the Answer Analyst (weekly, answers it reads: capped, never the pulse) can recover them.

**Proof** (`p_parse.js` A). Perplexity answer: "The most used options are Zoho Books and SAP Business One; Xero is common too. Acme ERP is a local alternative." With competitors `zoho.com, sap.com, xero.com`:
```
{"mentioned":true,"rank":1,"competitors":"","brands":"Acme ERP"}   (truth: rank 4, three competitors)
```

**Fix.**
- For a **configured** competitor (the owner named it, so it is not a guess), match its label at any length ≥ 3, word-bounded and case-sensitive on the first letter (`\bSAP\b`, `\bZoho\b`).
- Also match learned aliases.
- Keep the ≥ 5 rule only for auto-detected domains.

**Acceptance.** `p_parse.js` A gives rank 4 and competitors `zoho.com, sap.com, xero.com`. "sap" inside "asap" or "Sapient" does not match.

### E5 (High): a common-word domain label is treated as the client's brand

**Where.** `AI_Plan.js:49` and `Pulse_Plan.js:101`: `...(label.length >= 5 ? [label] : [])`, with no check that the label is distinctive. Only `wordRe` boundaries apply.
- `Apply_Analysis.js:29` undoes a false match only for answers the Answer Analyst read: weekly only, the mentioned ones first, capped.
- The pulse has no analyst, and its `mentioned` counts are pooled into the weekly headline (`AI_Metrics.js:109`) and drive the pulse's own alerts.

**Proof** (`p_label.js`). Site payroll.ae ("Gulf Payroll Services"); ChatGPT answer: "For payroll in Dubai, most SMEs use Zoho Payroll, Bayzat or Deel…":
```
{"mentioned":true,"rank":1,"brands":"Gulf Payroll Services","competitors":""}
```

**Fix.** Treat the label as a brand name only when it is not a dictionary or category word. The fit gate already has this logic, `fitWordBreak` / F-KW "a label is the website's own BRAND only when it is distinctive" (`_fit_gate.js:97-108`): reuse it. Otherwise rely on the business name and the configured `brand_names`.

**Acceptance.**
- payroll.ae: the label is not a brand, and `p_label.js` gives `mentioned: false`.
- techand.ai: "techand" is still a brand (the S201 replay is unchanged).

### E6 (High): segment share of voice mixes pulse mentions with weekly-only competitor counts

**Where.** `AI_Metrics.js:227-241`.
- `segBump` for pulse answers passes `k` (mentions) but no `comp`.
- `sov = k / (k + compN)`, where `k` includes pulse mentions and `compN` only the weekly answers' competitors.
- The headline (`:146`) adds the pulse competitor counts, so the two figures disagree on the same data. The segment table is what the app shows for every engine, cluster, persona and market.

**Proof** (`p_metrics.js`). Weekly: 1 of 4 answers names the client, all 4 name rival.com. Pulse: 12 days naming the client and rival.com:
```
headline: share_of_voice 44.8 sov_denominator 29
segment engine chatgpt n 16 k 13 pulse_n 12 sov 76.5
segment cluster erp     n 16 k 13 pulse_n 12 sov 76.5
```

**Fix.** Compute segment share of voice on weekly answers only: `k_week / (k_week + compN)`, keeping a separate `k_week`. Alternatively, store per-question competitor counts in `prompts_json` of the pulse and count them on both sides. State the basis in `sov_basis`.

**Acceptance.** `p_metrics.js`: segment `sov` is 20 (weekly-only basis) and the label says so. With no pulse rows, segment and headline agree.

### E7 (Medium): "Named in" includes citation-only answers, and the score weight is not the documented one

**Where.**
- `Parse_AI_Answers.js:56`: `mentioned = ourAt >= 0 || cited`.
- `_ai_stats.js:9`: `answerScore` gives `posWeight(0) * 1 = 0.6` to a citation-only answer. The `cited ? 0.4` branch is unreachable.
- Every report, mail subject and app tile reads `mentioned` as "Named in".
- `Apply_Analysis.js:29` keeps citation-only answers as mentioned.

**Proof** (`p_parse.js` C): `{"mentioned":true,"cited":true,"rank":0}`, `answerScore` 0.6 (comment: 0.4).

**Fix.** Split the field: `named = ourAt >= 0` and `mentioned = named || cited`, or rename the headline "Named or cited in". Make `answerScore` use `a.named`. Add a `named_rate` to the vis row. This is a deploy-safety point: it is a new column, synced with `sync_tables.py`.

**Acceptance.** A citation-only answer scores 0.4 and is not counted in `named_rate`. The headline label matches what it counts.

### E8 (Medium): false businesses ahead of the client

**Where.** `Parse_AI_Answers.js:66`: `low.indexOf(lab)` with no word boundary. `:65`: `DOMAIN_RE` matches `asp.net`, `socket.io` and similar.

**Proof** (`p_parse.js`):
- B: business.com is cited and "small **business**" appears before "Acme ERP", giving rank 2 with competitor business.com.
- D: "Build it on ASP.NET…" gives competitor asp.net and rank 2.

**Fix.**
- Use `wordRe(lab)` instead of `indexOf`.
- Keep a deny list for technology domains (`asp.net`, `node.js`-style tokens, `*.io` libraries).
- Prefer the order in `brand_entities` or the analyst's order when present.

**Acceptance.** `p_parse.js` B and D give rank 1. A real "Bayzat (bayzat.com)" mention before the client still ranks the client 2.

### E9 (Medium): custom questions are measured on a 5-word fragment

**Where.** `AI_Prompt_Rows_Admin.js:23,30`: `keyword: norm(prompt).split(' ').slice(0, 5).join(' ')`, for example "what should i check before". `AI_Requests.js:62-63` sends that fragment as the AI Overview search. It is also the volume lookup (`AI_Plan.js:109`) and the keyword the fit gate judges.

**Impact.** AI Overview presence and citation figures, and the demand weights, for every owner-imported question (the CSV import brings up to 500) are measured on nonsense queries.

**Fix.** Derive the keyword from the question's content words (`AIP.stems` order, stop words dropped, at most 6), or accept a `keyword` column in the CSV and admin API. Mark questions without a real keyword `keyword_source: 'derived'` and leave them out of AI Overview presence.

**Acceptance.** "What should I check before choosing an e-invoicing provider in the UAE?" gives a keyword like "e-invoicing provider uae choose", not "what should i check before".

### E10 (Medium): questions naming other vendors enter the panel

**Where.**
- `ai_prompts.txt:27` allows company names "if the topic itself is a product comparison".
- `market_questions` pass "AI names <brands>" to the writer (`Prompt_Jobs.js:54`).
- The fit gate keeps comparisons and ignores labels under 4 letters (`_fit_gate.js:24-29`).

**Proof** (`p_gate.js`, competitors `sap.com`): all three questions are stored `active`:
- "Zoho Books vs QuickBooks for VAT filing…"
- "Is Odoo or Microsoft Dynamics 365 Business Central the better ERP…"
- "Is SAP Business One worth it for a 50-person company…"

**Impact.**
- The client is structurally absent from these answers, which lowers its rates.
- `gaps` produces "Win the answer to 'Is SAP Business One worth it…'" with an `api_body` that writes a page about a rival's product.

**Fix.**
- Tell the writer to name no company in any question except the brand question.
- In `Prompt_Rows`, refuse a non-custom question whose wording contains a known vendor (`FIT_VENDORS`, configured competitors at any label length, learned aliases, the `brand_entities` of `market_questions`), with a `fit_note`.

**Acceptance.** `p_gate.js` refuses all three with reasons. A custom (owner) comparison question is kept and flagged.

### E11 (Medium): a dying chunk loses everything it paid for

**Where.** The weekly chain (`build_monitors.py:403-406`) runs: Run AI Requests (600 × LLM scraper or SERP; batches of 10, `timeout 150000`) → retry wait (20 s) and retries → Answer Analyst (up to 36 sequential Claude jobs, ~25 s each, `Analyst_Jobs.js:10`) → `Save AI Answers`.

**Impact.**
- The workflow and execution limit is 3600 s (`EXECUTIONS_TIMEOUT 3600`).
- A 600-request chunk at ~40-60 s per batch of 10 is 40-60 minutes **before** the analyst. No live run above ~100 questions has been timed (`AI_PANEL_SCALE_HANDOFF.md` §5 lists the 200-question run as a pending check).
- A timeout before the save throws away every paid answer, and the resume pays for them again. If the chunk is structurally too slow, every attempt times out: this is E1's loop by another path.

**Fix.**
- Save the parsed answers immediately after `Merge AI Answers` (insert), and let Apply Analysis *update* them.
- Size the chunk by time as well as by count: 300 requests, or measure `time` from DataForSEO tasks and adapt.
- Record each chunk's wall time in the state row.

**Acceptance (offline).** In the wiring, `Save AI Answers` precedes `Answer Analyst` (a build assertion). A chunk whose analyst throws still leaves its answer rows stored (harness: mock the analyst failing, then check the `Save AI Answers` input count = requests).

### E12 (Medium): unbounded loads into every execution

**Where.**
- `build_monitors.py:346`: `Load AI Run Answers` = all `run_kind != pulse` rows of the last 6.2 days, all sites.
- `:338`: `Load AI Visibility` and `Load AI Prompts` with `returnAll`, no filter, in every AI Visibility, Pulse, AI Growth and Backlink execution.

**Measured.** An answer row is ~1.5 KB (synthetic 500-question run). 15 sites × 2,495 rows is ~58 MB in node memory, and the same again in the stored execution data of every chunk (`EXECUTIONS_DATA_MAX_AGE 336`). The VM is an e2-medium with 4 GB. `seo_ai_visibility` keeps every weekly row for good (~21 KB each).

**Fix.**
- Filter `Load AI Run Answers` by `site_id`, and by `run_id` when `continue_run` is set (a cheap Code node before it emits the filter).
- Load `seo_ai_visibility` for the plan's sites and the last 60 days only, and `seo_ai_prompts` for the plan's sites.
- Do not persist large loader outputs in execution data (`saveDataSuccessExecution` minimal for the tracker), or trim them in the first Code node.

**Acceptance.** A harness wiring check that every loader of these two workflows has a `site_id` or date filter. Replaying with 20 sites' rows loaded, AI Plan gets only the target site's rows.

### E13 (Medium): the per-engine alert ignores whether the questions changed

**Where.** `AI_Metrics.js:469`: `if (!(same_panel && same_panel.comparable))`. `same_panel` is `RT.comparable(panel, panel_before)`, which compares sizes only. The overlap of panel ids and the engine set (`like`, `:381-383`) are not used.

**Scenario.** The owner imports 120 new questions and switches off 120 old ones. The size is the same, so "Gemini no longer cites any of your pages" can fire on a different panel. The headline correctly says "not compared".

**Fix.** Use `like.comparable` (same engines, ≥80% id overlap, size within 20%).

**Acceptance.** With previous `panel.ids` sharing 10% with now and the same size, `engine_changes` are all `tested: false` with the overlap reason.

### E14 (Medium): a pulse morning can be counted in two weeks

**Where.** `AI_Plan.js:114-115`: `since = prev.checked_at` and `daily.filter(d => d.checked_at > since)`, with no upper bound. A vis row's `checked_at` is the run's **start** (`:122`, `run_checked_at = st.started_at`).

**Scenario.**
1. A split run starts Monday 06:00 and its last part runs Tuesday after the 06:30 pulse (resumed by the pulse, or a long chain). The row pools Tuesday's pulse.
2. Next week, `since` is Monday 06:00, so Tuesday's pulse is pooled again.
3. Inflated samples narrow the ranges, and the duplicated day biases the rate.

**Fix.** Pool `prev.checked_at < d.checked_at <= this run's checked_at`. Alternatively, store the pooled pulse run ids in the vis row (`panel_json.pulse_ids`) and exclude them next week.

**Acceptance.** Fixture: a vis row started Monday 06:00 with a Tuesday pulse row (checked Tuesday 06:30) → this run pools 0 pulse rows, and next week's run pools it once.

### E15 (Medium): global prompt-id collisions overwrite another site's question

**Where.**
- `Prompt_Rows.js:19`: `hash` is a 32-bit djb2 → base36.
- `Save Prompts` upserts on `prompt_id` only (`build_monitors.py:359`; Admin is the same).
- The id includes `site_id`, but the key space is shared by all sites.

**Odds.** Birthday odds are ~n²/2³³: 1k questions ≈ 0.01%; 50k (100 sites × 500) ≈ 25%. A collision silently re-assigns the row (`site_id` included) to the other site.

**Fix.** Upsert on (`site_id`, `prompt_id`), and lengthen the id (two independent 32-bit hashes, or a 64-bit FNV). Keep old ids readable.

**Acceptance.** Two sites whose questions are forced to the same hash both keep their rows after `Save Prompts` (a harness replay of the upsert with keys `['site_id', 'prompt_id']`).

### E16 (Medium): wrong-claim alerts re-fire on paraphrase

**Where.** `AI_Metrics.js:269-271`: the key is the free text, lower-cased, at most 80 characters. Then `:498` raises up to 3 **high** alerts a week for `new` issues.

**Impact.** The analyst words the same wrong claim differently each week ("based in Abu Dhabi" / "an Abu Dhabi company"). The owner gets the same high alert weekly, which trains them to ignore High.

**Fix.** Key issues by the fact they contradict (the `correct` side, normalised: the fact-sheet field) plus a stem set of the claim with Jaccard ≥ 0.5 (reuse `AIP.stems`/`jaccard`). Store the keys in `perception_json.issue_keys`.

**Acceptance.** Two runs with the same contradiction worded differently raise the alert once.

### E17 (Low): an on-demand check during an open split run gets no answer of its own

**Where.**
- `AI_Plan.js:59`: `busy` → the site is skipped → the `nothing_to_do` path → no callback item (`Callback_Ledger.js:17-18` returns nothing).
- `AI_Plan.js:60,147`: `resume` → the on-demand start continues the weekly run (`run_kind` weekly, `request_id` of the weekly run, the on-demand `topics` ignored).

**Impact.** The app's on-demand run stays "running".

**Fix.** On `busy`, or when an on-demand start resumes a run, post a callback with the on-demand `request_id` and `status: 'skipped'` and the reason. Alternatively, let the resumed run's final callback carry both request ids.

**Acceptance.** A harness replay of an on-demand start against a 'running' state at +10 minutes produces a callback item with the caller's `request_id` and the reason.

### E18 to E22 (Low)

- **E18.** The fit-gate contexts differ: AI Plan passes ladder heads plus `services`; Pulse Plan passes question topics, no `services`. Build one `fit_input` in a shared helper used by both, and assert equality in the harness.
- **E19.** The share-of-voice z-test counts mentions as trials. Test per answer instead (k = answers naming the client, n = answers naming anyone), or use a bootstrap over answers.
- **E20.** `Prompt_Rows.js:35-38` re-upserts stored questions with `fit_note: ''` and the plan-normalised market. Carry `fit_note` and the stored `market` through `p.prompts`.
- **E21.** Rename the tile "Share among tracked rivals (AI-answer database)", or compute the market share from `top_mentioned_domains` totals.
- **E22.**
  - Fix the comments (S211; markets cap).
  - When a question's market is not in `markets_map`, mark the request `market_fallback: true` and name it in the report, instead of silently asking in the own market (`AI_Requests.js:41`).

---

## Cheap enterprise upgrades (data already fetched)

1. **Citation position and prominence.** AI Mode / AI Overview `references` and LLM `annotations` arrive in order. Store `cite_pos` (the first index of our URL) and `cite_share` (our references / all) per answer. "Cited first" is the metric Profound and Semrush lead with.
2. **Per-URL citation trend.** `cited_urls` and `our_urls` are stored per answer for 120 days. A weekly table of each of our URLs (answers citing it, engines, questions) with a change test costs nothing, and feeds AI Growth's refresh list.
3. **Competitor sentiment and position.** The Answer Analyst already returns `brands` in order. Have it add `sentiment` per brand (a few tokens), and report share of voice weighted by position (1st = 1, 2nd = .8, …): position-adjusted SoV per rival.
4. **Fan-out coverage.** `fanout` is stored (6 per answer). Match fan-out queries against `seo_query_history` and `seo_pages` to report "AI searched X; you rank #n / have no page". This is the most actionable gap list, and it is free.
5. **ChatGPT `brand_entities` categories.** The scraper returns entity categories. Use them to classify a named business as a vendor or a publisher (fixes E3 at the source) and to learn aliases without Claude.
6. **Source-type mix per engine.** `kindOf()` already classifies sources (media / directory / official / platform / site). Report the mix per engine ("Perplexity leans on directories: 42%") to steer PR versus listings.
7. **Answer volatility per question.** Pulse `prompts_json` holds daily codes. The share of days whose code differs from the mode is a per-question stability index. Flag unstable questions as "winnable", stable losses as "entrenched".
8. **Several owned domains.** `isOurs` checks one domain. Accept `owned_domains` (ccTLDs, product domains) from `seo_monitors`. This is a one-line change in Parse, and enterprises need it.
9. **Wrong claims → correction tasks.** Issues are stored with engines and questions. Emit `ai_target` corrections (AI Growth already has the "corrections for wrong AI claims" path) with a re-check of the exact question next pulse.

---

## Deploy-safety notes

- **In-flight split runs.** A changed request order (`want` construction, `CONFIG.order`, the AI Overview keyword dedupe, E9's keyword change) between two parts of a running run is safe for the done-keys (a set), but can create new AI Overview keys and re-ask them ($0.002 each).
  - Do **not** change `AIP.reqKey` or the `prompt_id` scheme for stored questions while any `seo_cache ai_run:*` row is `running`.
  - Deploy outside a cycle window, or run a check first: list the `ai_run:*` rows with `status: running`.
- **E2 / E15 id changes.** Only new questions should get new ids. Re-hashing stored ids breaks the trend (`panel_json.ids` overlap drops below 80%, so every delta becomes "not compared" for a week) and orphans `seo_ai_answers` history.
- **E7 adds a column.** A `named` / `named_rate` column on `seo_ai_answers` and `seo_ai_visibility` needs `sync_tables.py`; `deploy_engine.py` runs it. Old rows have no `named`, so readers must fall back to `mentioned`. The app (`data.ts toAiRun`) must tolerate a missing value.
- **E6 / E3 / E4 / E5 change the figures, not the shape.** The first week after deploy compares new-rule figures with old-rule figures. Mark that week `delta_not_compared` with a "measurement rule changed on <date>" reason. A rule version can go in `panel_json.rules_v`, and `like` can compare it. Without this, the deploy itself shows as a "real change" to customers.
- **Pulse rows stored before E6 or E14** carry no per-question competitor counts. A fix that needs them must treat old rows as "competitors not recorded", not as zero.
- **`Save AI Answers` / `Save Prompts` stay `continueRegularOutput`.** With E1 fixed the failure stops the chain; without it, keep watching the 1 GB Data Table limit in prod (`N8N_DATA_TABLES_MAX_SIZE_BYTES=1073741824`, `deploy/gcp/compose.prod.yml:167`). A 500-question site adds ~3.7 MB of weekly answers a week plus pulse answers (21 days).

---

## Engine ↔ app contract (details in `APP_AUDIT.md`)

- The app draws its own week-on-week arrows (`web/src/pages/site/AiVisibilityPage.tsx:78,115-178`, `OverviewPage.tsx:164`) by subtracting the two latest `seo_ai_visibility` rows. It never reads `delta_not_compared` or `panel_json.overlap_with_previous.same`.
  - The engine should store the comparability verdict **in the row** (`compared_with`, `not_compared_why`) so every reader shares it.
- `competitors_json[].named_only` (a name without a website) is dropped by the app (`server/src/services/data.ts:1044`).
- The pulse callback's `readable` / `today_rate` (under 12 answers there is no rate) are not read, and the pulse card hard-codes the engines and says "every day", which is wrong in rotating-sample mode.
- The cost mirror matches (`app/shared/src/ai-panel.ts` vs `_ai_panel.js`). `ai-panel-cost-cases.generated.ts` is byte-identical to `v5/data/ai_panel_cost_cases.json`.
- App limits versus engine limits:
  - competitors: app max 3, engine keeps 8;
  - markets: app 5, engine 8 once stored question markets are included.

---

## Appendix: how to reproduce the proofs

```bash
S=<scratch dir>; cp -R n8n/seo-agent/harness/. $S/h/
docker run --rm -v $S/h:/h -v $S/proofs:/p -w /h -e CODE_DIR=/h/code_v4 -e OUT_DIR=/tmp/o --entrypoint node n8nio/n8n:2.41.4 /p/<script>.js
```

Each script does `const H = require('/h/harness.js')`, mocks the referenced nodes with `H.mock(...)` and calls `H.run('<node>', input)`.

| Script | Feeds | Finding |
|---|---|---|
| `p_parse.js` | four Perplexity-shaped answers into *Parse AI Answers* | E4, E7, E8 |
| `p_label.js` | payroll.ae | E5 |
| `p_metrics.js` | a one-question plan with 12 pulse days into *AI Metrics* | E6 |
| `p_sources.js` | a publisher cited twice, through Parse and Metrics | E3 |
| `p_chain.js` | `scenarios_g6.js`'s `loadWeekly` with `Load AI Run Answers` empty, chaining AI Plan → AI Requests → AI Chunk Handoff four times | E1 |
| `p_arabic.js` and `p_gate.js` | *Prompt Rows* with a mocked Prompt Writer output | E2, E10 |

The scripts were kept in the session scratchpad, not in the repo.
