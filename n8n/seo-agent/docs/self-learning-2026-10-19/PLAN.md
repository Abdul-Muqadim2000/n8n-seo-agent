# Self-learning loop — plan v2 (2026-10-19, after two adversarial reviews)

**What it is.** For every client site, Alaventra records what each piece of its advice claimed, checks it when it can be checked,
remembers what the client told it, and uses both in later runs. Every change carries its evidence, its sample size and an Undo, and
"too small to tell" counts as a result. It does not retrain a model or rewrite our shared prompts, and it never loosens a safety gate.

**Names by stage** (marketing only once shipped, CLAUDE.md rule): P1 **"Advice track record"**: we grade our own advice and show the
sample size. P2 **"Remembers your corrections"**. "Learns your business" stays off the marketing site until outcome-based learnings
have acted on live clients. In an enterprise security review, "learns" reads as "trains AI on your data", and we don't do that.

**Files in this folder.** `research/R1_MARKET.md` (18 vendors and 6 closed-loop systems from outside SEO, sources opened),
`R2_ARCHITECTURE.md` (memory, RAG, vectors, learning methods, enterprise controls), `R3_MEASUREMENT.md` (what can be judged, how fast,
with which test), `R4_CODEBASE.md` (what we store today). `PLAN_v1.md` is the first draft. `REVIEW_ENGINEERING.md` (32 findings,
checked against HEAD `be01d3a`) and `REVIEW_PRODUCT_STATS.md` (30 findings, arithmetic computed) review it. §15 maps every finding to
its fix here.

### What changed from v1, in short
1. **P0 needs no engine deploy.** The app already stores every callback payload. Predictions are derived there by
   `predictionsFromReport()`, beside `summarize()`, and the same function backfills week 0 (ENG #9).
2. **The scoring rules are pre-registered**: committed and hashed before any row is scored. The ledger is append-only, enforced by a
   database trigger (PS #25, #26).
3. **Client instructions, preferences and truth claims are separate** (the old L1 could never fire: Beta(10,1) + 3 negatives gives a
   mean of 0.71, and it takes ≥ 23 to fall below 0.3; ENG #21, PS #1). Instructions apply without a test; inferred rules use e-values
   with e-BH; false findings become **staff defect tickets**, never per-site folds.
4. **Default is "suggest only"**, as the research said (PS #11). No holdout at launch (PS #3). No cross-client numbers until ≥ 5 tenants
   (PS #12).
5. **Confounders are flags, not vetoes** (blanket vetoes leave 6% of 8-week windows judgeable; PS #2), with a runtime events table
   (ENG #24).
6. **The week-4 re-evaluation is its own deliverable**, with staff gold labels and reliability data. The independent re-rating stays
   independent (PS #15).
7. **No pgvector.** Similarity ("already covered") becomes a separate cannibalisation project using `real[]` + cosine in the app
   (ENG #29, PS #29).
8. **Realistic sizing:** P0 = 3 app sessions + 2 engine sessions (ENG #32, PS #14).

---

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | **Grade the advice, not the traffic.** Core object: an append-only **prediction ledger**, one row per checkable claim, rules frozen when the claim is made. | At ~300 sessions/month a before/after test only sees +40–70% changes; split tests need ~1,000 visits/day per section (R3 §0, §2.1). Advice claims are binary and fast (R3 §4). |
| D2 | **One verdict vocabulary:** *hit · miss · no effect · inconclusive · too early · not crawled yet · not applied · dismissed as wrong · not inspected · not read · not recorded · not rendered*, plus a **confounded flag**. "Not judged" results count toward **coverage**, never toward accuracy. | Only SearchPilot publishes "inconclusive" (R1); Rule 1 lineage; ENG #16, #27. |
| D3 | **Pre-registered rules.** `app/shared/src/learning.ts` holds advice types, anchors, check offsets, scoring rules, floors, priors and reason codes. It is committed and hashed, and every ledger row stores the hash. A change applies only to new rows. | Self-grading can be gamed by choosing the check date or the floor after seeing data (PS #25, #26; R3 §3.7). |
| D4 | **Four kinds of learning, four frameworks** (§5): client **instruction** (applied, no test), site **preference** (floor, bounded, undoable, no test), **truth claim** about a shared check (staff confirmation, weak prior, defect ticket), **inferred rule** (e-values + e-BH at q = 0.10). Calibration of our model is staff-only. | A floor of 3 can never pass BH at 0.10 (min p = 0.125; ENG #23); BH is invalid for monthly re-tests (PS #4). |
| D5 | **Statistics for numbers, never vectors; no RAG for facts, rules or voice.** Corrected facts go into the business profile and the claims check; rules go into the style-guide structure every check already reads. | 80% of the learning is numeric (R2 §0); retrieval can miss a fact that must apply every time (R2 §3.2). |
| D6 | **Learning changes per-site settings only**: never shared prompts, never safety gates. Shared prompt / threshold ideas go to staff as proposals and ship as ordinary code through the harness. | Shared prompts serve every client; automatic rewriting needs 200+ examples and can delete a refusal no metric rewards (R2 §4.4). |
| D7 | **Default per site: suggest only.** A client's own instructions apply at once (with Undo). After 4 weeks of suggestions the client can switch categories to "apply automatically". | R1 lesson 7 and R2 §5 both say approval first (PS #11). |
| D8 | **Automatic changes never spend more, never publish or send outside, never change a figure or a fact, never hide a never-fold item** (§5.3). A rejected proposal stays rejected unless its evidence, counted in distinct instances without discounting, at least doubles. | Google Ads auto-apply never raises budgets; Frase routes statistic edits to a human; Intercom Fin does not resurface rejected items (R1); PS #29. |
| D9 | **Explicit labels first, a staff gold sample as the yardstick.** Implicit signals (skipped, edited) never move a setting on their own: they only trigger a question. Client labels train; staff gold labels and live re-checks evaluate. | Labels are self-selected; "ignored" mostly measures how often someone logs in (PS #9); keep evaluation separate from training (R1 lesson 9, PS #13). |
| D10 | **The app owns learning state.** P0 derives predictions from stored payloads; the engine later adds outcome capture and reads a compiled pack. | Payloads are already stored; engine deploys are the owner's and never on a Monday (ENG #9). |
| D11 | **Nothing crosses clients except numeric aggregates about our own model**, staff-only until ≥ 5 tenants and ≥ 30 observations per bucket, and never before a Terms / DPA clause exists. Text, keywords, URLs, examples and embeddings never cross clients. | R2 §5 thresholds (PS #12); OWASP LLM08. |
| D12 | **Every learning has a guardrail that can undo it, and every site has a health guardrail** that returns all its automatic learnings to "suggest" when it trips. | Statsig guardrails (R1 lesson 8); PS #13. |
| D13 | **The independent re-rating stays independent.** The track record is input to it, never a replacement. | PS #15. |

### 1.1 Where this puts us against the market (R1)

None of the 18 vendors checked documents a per-client loop where the outcome of *its own advice* changes what it recommends next for
that client. What they sell as "learning" is one of:
- brand voice or memories that people edit by hand (Jasper, Writer, HubSpot Breeze);
- global models the vendor tunes;
- thumbs up/down that go to the vendor;
- monitoring with no causal test.

Causal proof only exists as split tests on large templates (SearchPilot; Botify, about 300 pages × 10 clicks a day). Nobody puts n and
a range beside a rate. Search Atlas tells customers a dip is "completely normal".

What we take from each:
- **Google Ads:** data minimums, a "Learning" status that names its reason, auto-apply by opt-in category, undo, no auto spend increases.
- **Statsig:** data-eligibility rules and guardrails.
- **Intercom Fin:** a weekly list ranked by real demand, and a rejected item stays rejected.
- **Search Atlas:** undo for each change.
- **Frase:** a diff before applying; statistic edits go to a human.
- **Profound:** tiered approvals and version restore.
- **SearchPilot:** "inconclusive" as a verdict.

**What we can own:**
- a per-client record of our own advice, with n and a range;
- "not crawled / too early / inconclusive / no effect" kept apart;
- learned rules shown and undoable as rules;
- weeks excluded or flagged, with the reason;
- learning from edits only after approval;
- **what did not work**, listed in the client's report.

---

## 2. What can be judged, and when (say this to clients and to the owner)

| By | Judged | Not yet |
|---|---|---|
| **Week 1** | staff gold labels on ~30 findings and every keyword suggestion per client; the live re-check of each new finding at T+7 days; client instructions | anything outcome-based |
| **Week 4** (~2026-11-16) | finding precision (live re-check + gold + client labels, kept apart); keyword-fit labels; the index deadline of pages published in weeks 0–1; first impressions of those pages; outreach replies if mail is connected; cost against estimate; schedule fires, failures and deliveries | rank against the chance band; refresh → clicks; link → rank; GA4 conversions |
| **3–6 months** | time-to-index per page type (10 pages of a type at Starter's 1 page/week); first rank bands resolving | calibration claims |
| **9–18 months** | chance-band calibration (4 bands × ≥ 25 resolved = ≥ 100, counted per ladder, not per rung; ladder `months` run 2–15) | effect claims stay out of reach unless traffic grows (MDE ×2 or more at this size; R3 §3.5) |

Effect claims (refresh → clicks, striking distance → position) are **not built** in P0–P2. A control-set machine that can never reach
its floor at this traffic is cost without information (PS #13). Their predictions can still be recorded (cheap) and scored later if a
client's traffic grows.

---

## 3. The week-4 evaluation (the owner's original ask)

A deliverable in its own right, built from P0 data plus a read-only snapshot. For each client at week 4:

1. **Reliability on GCP**: scheduled fires vs expected (R94 was "never ran by itself" before the move), failed executions, catch-up
   runs, report deliveries, callbacks recorded vs runs settled in `seo_run_ledger` (§4.6).
2. **Cost**: per mode, actual vs estimate and vs credits (admin panel data).
3. **Output quality, independently checked**: finding precision from the live re-check and the staff gold sample (precision of findings
   and keyword suggestions does not depend on the client clicking); keyword fit; QA "not ready" rate and reasons.
4. **Client engagement**: logins, report views, publishes, labels given (from exposure events, §4.4).
5. **Coverage**: share of advice that could be judged, with the reasons for the rest.
6. **The written questions**, fixed now (owner decision O3), so P0 records what answers them.

Format: one report per client plus a cross-client summary. It feeds the independent re-rating; it does not replace it.

---

## 4. Architecture

```
 ENGINE (n8n)                               APP (Fastify + Postgres)                        CLIENT / STAFF
 callbacks (already stored in reports) ──►  predictionsFromReport(stage, payload)          digest: ≤ 3 one-click questions/week
   + later: idempotency key, retries          → learning_predictions (append-only,          app: feedback on findings + keywords,
   + later: live_main_text at publish           trigger-enforced, rule hash)                   done / dismiss on recommendations
 Site Tracker inspection rotation  ──────►  outcome collectors (pull, rowsComplete)      ◄── exposure events (shown / opened)
   (due predictions first, first_indexed_at)  → learning_signals (labeller role,
 GSC page×date for advised URLs ─────────►      exposure, implicit)
   → seo_page_outcomes                      weekly scoring job (persisted due time)        "Advice track record" page
                                              → verdicts, flags, coverage                  "Changed for you" / "Suggested"
 (P2) Load Policy Pack in ~8 workflows ◄──  learnings → policy_packs → seo_policy_packs    /admin: quality, gold labels,
   stamped at Run Cost (Callback) +          (activation = n8n read-back of the hash)        proposals, events, incidents
   _ledger_cb.js                            (P2) Reflector pair, typed rules only
```

### 4.1 The prediction ledger

App table **`learning_predictions`** (migration 0015). `company_id` and `site_id` are NOT NULL (a callback whose domain is not a
company site is recorded as `not_recorded`, never failing the callback; ENG #8).

| Column | Meaning |
|---|---|
| `id`, `company_id`, `site_id`, `run_id`, `request_id`, `execution_id`, `created_at` | `request_id` = the API front door's execution, `execution_id` = the working one (ENG #6) |
| `source_ref` | report id (or keyword-check id, reply id) it was derived from |
| `advice_type` | closed list (§4.2) |
| `subject_kind`, `subject_ref` | finding (`check_id` + affected URL), keyword, URL, prospect `domain|type`, `prompt_id`, `ladder_id+rung`, recommendation `kind+subject` |
| `claim` jsonb | e.g. `{metric:"real"}`, `{metric:"indexed", anchor:"published", offset_days:28}`, `{metric:"top10", p:0.6, by:"…"}` |
| `p_stated`, `band` | the stated probability or band; null for deterministic claims |
| `anchor`, `armed_at`, `check_at`, `grace_days` | anchor-based claims are **armed** when the anchor is observed (publication, fix, send) and get `check_at` once; the anchor's source and precision go in evidence (ENG #25) |
| `score_rule`, `min_evidence`, `rules_hash` | pre-registered (D3) |
| `labeller_scope` | which signals may score it: `live_check`, `gold`, `client` (kept apart) |
| `pack_version` | null until P2 |
| `origin` | `live` or `retro` (backfilled after the rule table was committed; counts like live, PS #26) |
| `verdict`, `score`, `scored_at`, `flags`, `evidence`, `shadow_verdict` | filled **once**; `flags` holds e.g. `update_in_window`; `shadow_verdict` keeps what a confounded row would have scored, so staff can see whether the flag is being abused (PS #2) |

**Integrity:** a trigger allows no UPDATE except filling the verdict fields once, plus at most one logged re-score from hit/miss to
"confounded" (never the reverse; ENG #24). No DELETE except through the erasure function. A unique key on
`(company_id, source_ref, advice_type, subject_ref)` makes replays and backfills idempotent (ENG #27).

**Completeness (anti-gaming, PS #25):** every *item* in a payload carries exactly one prediction: each finding, keyword, rung, page and
recommendation. A unit test counts items against predictions for every stage. The cost estimate is reported as a **distribution**
(actual / estimate), not a hit rate, and left out of the advice scorecard. "Not applied" is split into *dismissed as wrong* (a miss for
usefulness) and *not done yet*. "Applied" is mechanical: the publish detection found the URL, or the re-check found the fix.

### 4.2 Advice types (the closed list; ENG #10)

| Stage / path | Advice type(s) | Phase |
|---|---|---|
| `site_audit`, `full_report` | `finding_real` (per `check_id` × URL), `finding_fixed_after_fix` | P0 |
| `content` (verdict) | `keyword_fit`, `existing_page_ok` ("improve, don't add") | P0 |
| `content` (page) | `qa_publishable`, `index_by`, `first_impr_by` (anchored on publication) | P0 (content score once the engine emits it) |
| `ladder_plan` | `keyword_fit` per rung, `rank_band` (counted per ladder), `months_range` | P0 (long clock starts) |
| Keyword Check (synchronous, `keywordCheckStore.ts`) | `keyword_fit`, `rank_band` | P0, from its own service |
| `keyword_strategy` | `keyword_fit` for priority / quick-win keywords | P0 |
| `site_tracker` | Site Brief `actions` → `rec_useful`; **`watch` items → dated `watch_confirmed`** | P0 session 4 |
| `rank_tracker` | `replan_accepted` (`_replan` proposals) | P0 session 4 |
| `content_cadence` | pages chosen; recorded only (no effect claims) | P0 session 4 |
| `ai_visibility`, `ai_pulse` | `alert_real` (Holm-flagged changes), `ai_cite` scored from the weekly aggregate (pulse rows are pruned after 21 days; ENG #13) | P0 session 4 |
| `ai_growth` | `target_won` per question, `crawled_after_submit` | P0 session 4 |
| `backlinks`, `link_builder` | `prospect_reply`, `link_live`, `lost_real` | P0 session 4 |
| `published` | publish-check pass/fail confirmed | P0 session 4 |
| Reply Reader | `reply_class_ok` (the client can correct it) | P1 |
| Page Watch | alert precision, from alert rows (no callback) | P1 |

### 4.3 Signals and feedback

App table **`learning_signals`**: append-only; every label is kept, and the latest per labeller counts (PS #29). Each signal records
the **labeller role** (client / agency / Alaventra staff; staff labels are never shown as "you said"; PS #9). Reason-code lists are
versioned.

**At launch, feedback on two artifacts only**, plus recommendation state (PS #16):
- **Findings:** *not true* · *true, won't fix* · *already fixed* · *not relevant to us*.
- **Keywords / rungs:** *fits* · *not our service* · *wrong market* · *a competitor's brand* · *we already have a page for this*.
- **Recommendations:** *done* · *not now* (snooze with expiry) · *dismiss + reason*, stored on **`(site_id, kind, subject)`** with stable
  keys. Today `engine:` ids fall back to Claude's action sentence and aggregates keep one id while their content changes. Aggregates can
  be snoozed only, not dismissed. A unit test checks that a week later the same inputs give the same keys (ENG #4).

**The digest asks, the app does not nag.** At most 3 one-click questions per site per week, ranked by value of information (uncertain,
high-impact items first). Links are signed, single-use, item-scoped and expiring; production e-mail is on Brevo. The same item is never
asked about twice, and the digest backs off for 4 weeks after 3 unanswered questions. Copy: "Using our defaults until you've answered 10
(4 so far)", never "Learning needs your labels".

**Implicit signals** only ever raise a question ("You skipped 4 'internal links' recommendations — still useful?"):
- an **exposure** event when an artifact is shown or opened from the digest, so "ignored" means seen and not acted on (PS #9);
- **edits before publishing** (P0 session 6): the engine returns a bounded `live_main_text` (main content only, ≤ 60 KB) on the
  `site_tracker` / `published` callback. The app diffs it against the stored draft for the same keyword, in one direction only: the
  share of our 8-word shingles kept, plus heading / title / meta changes. `SHG` is ported to `app/shared`, with the mirror asserted by
  the build. A body under ~150 words → `not_rendered`. Template chrome is never diffed (ENG #2, PS #19).

**Staff gold labels**: a staff screen in `/admin` to label a random sample of findings and keyword suggestions per client. That gives
precision an unbiased denominator ("you marked n of N shown" stays a separate line).

### 4.4 Outcome collectors and the weekly job

- **Pull** what the engine already stores, one site at a time, through the n8n public API with `fresh: true` and a new
  **`rowsComplete()`** that returns `{rows, complete}`. Today's reader stops silently at 2,000 rows. An incomplete read scores nothing
  (`not_read`). Every read is filtered by domain and by date from the oldest due prediction (ENG #12).
- **Push** only what the engine computes and does not store: page×date rows go into the new `seo_page_outcomes`, and `live_main_text`
  rides on callbacks (ENG #13).
- **Index outcomes** (engine session 5): advised URLs go into `Inspect_Requests.js` with a third ordering key, "a prediction is due
  within 7 days". New columns `seo_page_watch.first_indexed_at` / `first_seen_unindexed_at` are written by *Inspect Rows (Site)*. No
  inspection inside [deadline − 7 d, deadline + grace] gives `not_inspected`, and a quota or access failure is never a miss (ENG #1,
  #16). The inspection rotation is the weekly Site Tracker's; Page Watch does none.
- **Page×date** (engine session 5): one request in `GSC_Requests.js` for advised URLs over the last 112 days. URLs are keyed with
  `PW.helpers.ukey`, host-agnostic, and rows go into `seo_page_outcomes` through `ladder_common.py` + `sync_tables.py` (ENG #15).
- **Weekly job**: `learning_job_runs (job, week, started_at, finished_at, status)`. An hourly tick runs the job when the week's row is
  missing and it is after Sunday 20:00 New York, and a run that died mid-way resumes. The VM is spot, and a bare timer is the R94
  failure class again (ENG #31, PS #28).
- **Callbacks** (engine session 5): an idempotency key `execution_id + stage`, an upsert in `ingestCallback`, then 3 tries / 5 s on the
  POST nodes. The weekly job reconciles settled ledger runs against stored callbacks; the difference shows as `not_recorded` (ENG #7).
  Per site, coverage first shows whether reports reach the app at all (`reportsToThisApp`; ENG #8).

### 4.5 Confounders (PS #2, ENG #24)

- Ranking updates **never** confound binary claims (finding real, keyword fit, indexed by deadline, first impression, reply, link
  live). Those can only be hit by a data break or a tracking gap.
- For rank / traffic claims an overlapping update is a **flag**. A row becomes "confounded" only if the site's own series left its
  normal negative-binomial band during the rollout, i.e. the update actually hit this site.
- These claims are scored at `check_at + grace + 14 days`, so the rollout's end date is known.
- Runtime table **`learning_events`** in the app: seeded from `v5/data/seo_events.json`, append-only, every entry with a source URL and
  an actor. Each scoring run records the table's hash, and an event entered after a row's `check_at` cannot re-mark it. The engine
  registry stays the source for charts.
- Add the two data breaks the research relies on to `seo_events.json`: AI Mode inside Web totals (June 2025) and the Generative AI
  report (2026-08-31, never summed with Web).
- **Per-site exclusions** (tracking outage, site down, migration week): set by staff or the owner, with a reason, in the audit log,
  never removed silently (R1 lesson 5).

---

## 5. What learns (levers)

### 5.1 Frameworks

| Kind | Example | Rule | Statistics |
|---|---|---|---|
| **Instruction** | "hide this finding type for my site", "not our service", "never say X", "our VAT figure is …" | applied at once, shown in "Changed for you" with Undo | none: the client told us |
| **Preference** | 3+ dismissals of one recommendation kind | floor, bounded, undoable, expires (`review_after` 90 days) | counts only; no test |
| **Truth claim** (about a shared check) | "this check is wrong here" | a client "not true" → automatic live re-check within 7 days → staff confirmation → **defect ticket on the shared check**; the site shows "under review", never a fold | prior Beta(3.1, 0.9): centred on the live 23 of 30 (2026-10-15 re-rating), strength 4. 3 negatives → mean 0.44 = "ask staff" |
| **Inferred rule** | edits show the client always replaces term X | proposed only; e-value vs the default, adopted under **e-BH at q = 0.10** over a family listed in code (all open inferred candidates across sites in the calendar month) | e-values stay valid under monthly re-testing (PS #4) |
| **Calibration** (our model) | the 50–70% band | staff-only; ≥ 25 resolved per band, counted per ladder, cluster-robust | Brier + decomposition, CORP reliability; shown to clients only at ≥ 5 tenants |

**Priors** (pre-registered in `learning.ts`, PS #7): Beta(2·p0, 2·(1−p0)) with a sourced base rate per type, e.g. reply 0.10 →
Beta(0.2, 1.8); indexed by week 4, 0.8 → Beta(1.6, 0.4); keyword fit 0.7 → Beta(1.4, 0.6); AI mention 0.05 → Beta(0.1, 1.9).
Jeffreys Beta(0.5, 0.5) where there is no base rate. **Discounting** only for rates that drift (reply, time to index, AI mention):
γ = 0.97 with the Kish effective n shown. Static properties are not discounted; they expire through `review_after` (PS #6). **Display:**
clients see raw counts with a Wilson range; posteriors drive decisions and appear only in the staff view, so one screen never shows a
range next to a contradicting status (PS #7). **Counting:** distinct instances. One persistent finding over three audits is one
observation, and site-level findings give n = 1 per audit (PS #1).

### 5.2 Lever table

| # | Lever | Kind | Floor | What changes | Where applied | First |
|---|---|---|---|---|---|---|
| L1a | finding check is wrong on this site | truth claim | 1 client "not true" + re-check + staff | defect ticket on `check_id`; "under review" badge | staff → code fix | week 1 |
| L1b | "hide this type for my site" | instruction | 1 | folded with its count ("3 hidden — show"), never for the never-fold list; unfolds when `affected_count` rises or a key page is involved | app-only display | week 1 |
| L2a | "not our service" / "wrong market" / "competitor's brand" | instruction | 1 | a **business-profile fact proposal** (approve) and the keyword excluded for this site | profile + fit gate input | week 1 |
| L2b | topic weight from accept / reject patterns | inferred | ≥ 10 labels in the cluster, ≥ 2 runs | weight in [0.5, 1.5] **absolute**, step ≤ ±0.25 a month; **exploration floor**: 1 item a month from a down-weighted topic, labelled "we still check this" (PS #10); never for declared services, `content_groups` or an approved ladder's topic, and never reorders an approved ladder's rungs | engine pack (P2) + `cadence.ts` / `keywords.ts` mirrors in the same commit | P2 |
| L3 | corrected fact | instruction | 1 | `business_facts` / claims check (approve, since it changes a figure or fact: D8) | profile | week 1 |
| L4 | writing rule | instruction or inferred | 1 instruction, or a pattern in ≥ 3 edits proposed by the Reflector | **typed** rules only: term replacement, banned phrase, preferred term, tone flag. Compiled into the **style-guide structure** (`style_*`), so `ST.check`, Content QA's term list, the Critic and the Editor all see it. Compile-time reject when it conflicts with a required term (otherwise QA oscillates to "not ready"; ENG #18). Deny-list: no rule may remove sources, author / reviewer box, schema, update date, internal links, CTA or verified figures (PS #19) | engine pack (P2) | P2 |
| L5 | recommendation usefulness | preference | 5 explicit dismissals of a kind (skips never count) | order / frequency for this site; a suppression lasts ≤ 90 days and returns if its metric worsens. Never suppressed: `content:fix:*` (QA-failed drafts), `setup:delivery`, anything that exists because a gate refused something, High severity, indexability / robots / canonical / security / manual actions, key pages (ENG #30, PS #19) | app-only (`recommendations.ts`) | P1 |
| L6 | AI question panel | preference | 4 weeks with no mention, citation or rival on any engine | a **stable core panel**; rotation only in a separate exploration segment, ≤ 1 question per 4 weeks and ≤ 10% of the panel a month, never pinned questions or questions tied to `seo_ai_targets`; each rotation is a new panel version, so the like-for-like rule still refuses deltas across it, and the report says why. Automatic only for panels ≥ 20 (ENG #26, PS #19) | engine pack (P2) | P2 |
| L7 | prospect / pitch type | preference, later bandit | 30 sends per variant (existing rule) | which opportunity sources get the weekly 10 drafts; Thompson sampling on pitch / subject / timing in P4 | engine pack (P2) | P2+ |
| L8 | the site's normal time to index | measured | per page: its deadline from week 4; per type: 10 pages | the line "pages of this type usually index in N days"; a page past its deadline → a fix task ("crawled – not indexed at week 4 is a quality signal") | app-only | per page week 4; per type 3–6 months |
| L9 | cost estimate | measured | every run | already self-correcting (`_cost_cal.js`); shown as a distribution | engine (exists) | now |
| L10 | chance bands, timelines, QA bar, reach (G17) | calibration | ≥ 100 resolved, per ladder | staff proposal → normal code change | code | 9–18 months |

### 5.3 Never

No lever may:
- loosen a refusal (brand, government, spam, unverified claims, QA "not ready", no-overlap, pile-up, the 2-active-ladder limit);
- fold or suppress an item on the never-fold list;
- make the system do less to be cheaper without scoring what it gave up;
- carry anything from one client to another;
- withhold a client's explicit instruction for a test.

"Gates run after the pack" is proved with one harness scenario per gate (a pack that up-weights a refused keyword; the refusal must
stand), not with a lint (ENG #20).

---

## 6. The policy pack (P2)

- App tables `learnings` (candidate and active, typed `structured` payload, `evidence_refs`, `strength`, `status: proposed → approved →
  active → retired | rejected`, `review_after`, `supersedes_id`) and `policy_packs` (immutable versions, one active per site).
- The engine reads **only L2b, L4, L6, L7**. L1, L5 and L8 are display decisions the app already computes, so they stay app-only
  (ENG #17).
- Engine side: a *Load Policy Pack* Data Table node in ~8 workflows (main, Keyword Check, Content Cadence, AI Visibility, AI Pulse, Link
  Builder, Backlink Monitor, Site Tracker). Multi-site schedules load all packs once and pick per site. Consumer Code nodes read
  `$('Load Policy Pack')` inside try/catch through a kit `_policy_pack.js` (`PP.num`, `PP.rules`), roughly 15–20 nodes across 6
  builders.
- **Stamp `pack_version`** at the two existing choke points, *Run Cost (Callback)* (the eleven main-workflow callbacks) and
  `_ledger_cb.js` (the monitors), instead of 18 edits (ENG #3).
- **Activation is "delivered"** (Rule 4): a pack is `active` only when the n8n `seo_policy_packs` row reads back with the same
  `content_hash`, and a learning is `applied` only once a run's callback carries that `pack_version` (ENG #30). The app's state machine
  gets its own unit tests; `state_lint` scans only n8n.
- Mirrors are proved by `build_v4.py` reading the app files (the existing `cadence.ts` pattern), not by the harness (ENG #30).

### 6.1 The Reflector (the only LLM step, P2)

- Two workflows, `SEOagentLearnRAPI` (answers 202) + `SEOagentLearnRf1` (worker), because a workflow started before the webhook answered
  runs no node.
- Ledger mode `learn_reflect` in `LEDGER_EST` and `app/shared/src/cost.ts`, in the section-55 proof list and `deploy_manifest.json`;
  ledger key `app:<company>:<site>`; run guard and rate limit (ENG #19).
- Input: **structured diffs** (term X → Y, heading removed) and capped notes the client approved, never raw text (PS #22).
- Output: typed rule proposals, each citing ≥ 1 existing evidence id, its scope from the closed list, within a length limit, with no
  gate vocabulary. Deterministic checks only; "contradicts the profile" is left to the approval step.
- The result returns on a stage that `ingestCallback` routes to `learnings` and that the delivery rules exclude. Otherwise "all stages"
  would e-mail it to the customer as a report (ENG #19).
- Cost ≈ $0.02–0.05 per site per week; who pays (credits) is an owner decision.

### 6.2 The eval gate (ENG #14, PS #28)

- **Numeric learnings:** replay in the app against the TypeScript mirrors that already exist (`keywords.ts`, `cadence.ts`) on fixtures
  in an app table `learning_eval_fixtures` (RLS). Client data never goes into `harness/`, because the repo is public. Activation needs
  no gate refusal changed and no regression metric worse. Fixtures must not be the items the learning was formed from (PS #13).
- **Prompt learnings (L3, L4):** no automatic regeneration (a page run is ≈ $0.80–1.40). Activation = approval with a before/after on
  the last brief. The next real run shows a diff against the previous page of the same type, with a one-click rollback. A paid
  regeneration is an explicit, priced, ledgered action.

### 6.3 Guardrails and incidents

- **Per learning:** `guardrail {metric, threshold, window}`, checked weekly; when it trips, the learning retires automatically with the
  reason shown. Example: a folded type unfolds when a key page becomes involved.
- **Per site:** a health guardrail on site clicks band, key-page index coverage, brand-query clicks, AI mention rate and outreach
  complaints. When it trips, every automatic learning returns to "suggest" and staff are alerted (PS #13).
- **Incident path:** staff can revert every learning of one kind across all sites in one action. Each company has a kill switch.

---

## 7. What clients see

- **"Advice track record" page** (P1), per website. A scorecard **per advice type, never blended**:
  - findings confirmed real: live re-check n/N and staff check n/N, kept apart;
  - keywords you accepted: n of N shown;
  - pages indexed by their deadline;
  - drafts published unchanged;
  - recommendations done;
  - coverage ("we could judge 41% of last month's advice, here is why not the rest").
- **Two lists** (P1/P2): **"Changed for you"** (your instructions, each with Undo) and **"Suggested — your yes needed"** (everything
  inferred). There are no tiers, modes or staff queues in the client's view (PS #18).
- **Status wording**: only on levers with a floor, e.g. "Using our defaults until you've answered 10 (4 so far)". Never "paused for a
  Google update" unless that update moved *this* site.
- **Weekly report / digest**: "What we learned this week", at most 3 items, including **what did not work**, plus the ≤ 3 questions.
- **Agency portal (migration 0013)**: the end client labels and approves through the portal; agency labels are recorded as "agency";
  all copy is white-labelled.
- **Export**: learnings with their evidence through `/api/v1` and MCP, so enterprise clients can audit us.

## 8. What staff see (`/admin`)

- Advice quality across clients: per advice type, gold vs live re-check vs client labels, coverage, not-judged reasons, the shadow
  verdicts of flagged rows.
- The gold-label screen, the proposals queue (shared-check defects from L1a, shared-prompt ideas), the events table, site exclusions,
  incidents.
- **Who audits the auditor:** every month an independent clean session (as in the re-ratings) re-derives a stratified sample of scored
  rows, which must include not-judged rows, because that is where hiding happens (PS #26).

---

## 9. Enterprise and privacy

| Requirement | How |
|---|---|
| Tenant isolation (P0) | P0 tables are written only by `ingestCallback` / services, scoped in code, with a test that company A cannot read B (run as a non-superuser role) |
| **RLS** (its own session in P1, ENG #11, PS #23) | FORCE RLS on the learning tables. Policy `company_id = current_setting('app.company_id')::uuid` **without** `missing_ok`, so a forgotten setting throws instead of returning zero rows. One `withCompany(orgId, tx => …)` helper (`set_config(…, true)` in a transaction), with a unit test that greps `services/learning/` for raw `db.` access. A second pool on `app_staff BYPASSRLS` only for `services/learning/jobs.ts` and `services/admin/`, created in `initdb.sh` **and** by a one-off step on the existing prod cluster. CI creates a NOSUPERUSER role and runs the isolation test under `SET ROLE`. The FORCE step is a hand-written SQL migration (`drizzle-kit generate --custom`) |
| Cross-client data | D11; companies get `global_learning_opt_in` (default false), used only once the clause exists |
| Retention (PS #21) | on contract end + 30 days every row of the tenant is deleted, including the n8n `seo_policy_packs` / `seo_page_outcomes` rows, and backups age out on their documented retention; only anonymous counts per type and band are kept, and only at ≥ 5 tenants. Signals 24 months; when evidence expires, its counts are snapshotted into the learning so "why" still works |
| Legal basis (PS #22) | Terms / Privacy are drafts and the 3 clients signed under them: add "we record your feedback and use it for your own service"; pooling waits for its own clause. A written answer to "do you train AI on our data?": no model training; per-tenant statistics; pooled anonymous counts only at k ≥ 5, with opt-out |
| Sub-processors | Anthropic (existing) gets a new purpose for the Reflector; list it. Residency: GCP Doha + Anthropic US, stated on the security page |
| PII | structured diffs only to the Reflector; contacts referenced by id; no free text into learnings beyond approved, capped notes |
| Approvals | owner / admin only; portal roles for agency clients; staff approvals and labels are audited |
| Audit trail | every label, approval, activation, rollback, revert, exclusion and erasure in the 0011 audit log |
| Documentation | a one-page **card per lever** (what it learns, floor, guardrail, what resets it, what it can never do), a records-of-processing entry, a light DPIA |
| Public repo | edit diffs, notes and fixtures are client data: never in `harness/`, `docs/` or commits |

## 10. What resets a learning (PS #27)

| Event | Reset | Detected by |
|---|---|---|
| new site in a company | starts from the priors; company-level instructions (facts, voice, banned terms) offered for approval, site-level ones not | site created |
| migration / canonical host change / redesign | finding folds, time-to-index baseline, edit-diff template | `_site_model` host change, CMS / fingerprint change |
| services change in the profile | topic weights; "not our service" facts re-proposed | profile diff |
| competitor list change | AI-panel rotation state, prospect-type learnings | settings diff |
| a different person labelling | nothing automatic; visible to staff | labeller id |
| multilingual sites | rules carry a language; topics per market; diff tokenizer handles Arabic / RTL; reason codes localised | page language |

---

## 11. Phases and sessions

One session ≈ one agent-day. Each ends with its checks green (app tests / typecheck / harness as applicable), one commit + push, and a
changelog / capability entry only for what customers can see. Engine sessions need **one owner deploy**, never Monday 07:00–12:00 New
York.

| # | Session | Contents | Acceptance |
|---|---|---|---|
| **P0** | **S1 Ledger core (app)** | `learning.ts` rule table + hash; migration 0015 (`learning_predictions` with trigger + unique key, `learning_signals`, `recommendation_states`); `predictionsFromReport` for `site_audit`, `full_report`, `ladder_plan`, `content`, `keyword_strategy` + keyword checks; called in `ingestCallback`, never failing it | a real callback of each stage gives one prediction per item; the trigger refuses an UPDATE; A-cannot-read-B under a non-superuser role |
| | **S2 Week-0 baseline (app)** | the same function over every stored report (`origin: retro`); per-site coverage incl. `reportsToThisApp`; Search Console access level + months of history per client; the read-only snapshot (runs, fires, failures, deliveries, cost vs credits); the week-4 questions (O3) written into the doc | each of the 3 clients has a baseline; gaps named |
| | **S3 Feedback (app + web)** | feedback on findings + keywords, recommendation states with stable keys, exposure events, the digest questions with signed links, the staff gold-label screen; changelog line | a 👎 lands as a signal with labeller role; a dismissed recommendation stays dismissed next week; a digest link records one answer and expires |
| | **S4 Remaining stages (app)** | `site_tracker` actions + `watch`, `rank_tracker` replan, `content_cadence`, `ai_visibility` / `ai_pulse`, `ai_growth`, `backlinks`, `link_builder`, `published` | item counts match for every stage |
| | **S5 Engine outcomes (engine, deploy)** | due-first ordering in *Inspect Requests* + `first_indexed_at`; `check_id` on findings + column; GSC page×date → `seo_page_outcomes`; callback idempotency key + upsert + retries; the two `seo_events.json` breaks | harness 0 failed + new scenarios; `sync_tables` adds columns; a replayed callback stores once |
| | **S6 Edit capture (engine + app)** | `live_main_text` on `published` / `site_tracker`; the app diff; `SHG` mirror | a published page edited by hand shows its kept-shingle share; a JS shell → `not_rendered` |
| **P1** | **S7 Collectors + scoring** | outcome collectors per advice type with `rowsComplete`, the weekly job with persisted due time, `learning_events`, confounder flags + shadow verdicts, the math module (Beta, Wilson, e-values, Brier / CORP for staff) | numbers reproducible from signals; unit tests on the math; a spam-update window flags but does not void binary claims |
| | **S8 RLS** | as §9 | the isolation test fails when the setting is missing (throws), passes when set |
| | **S9 Track record + staff view + week-4 pack** | client page, `/admin` quality view, the per-client week-4 evaluation; capability entry "Advice track record" | the week-4 pack for each client, independently readable |
| **P2** | S10–S15 | `learnings` + `policy_packs` + `seo_policy_packs`; `_policy_pack.js` + Load nodes in ~8 workflows + stamps; L1b, L2a, L3 first (instructions), then L5, L2b, L6, L4 typed rules; the Reflector pair; app-side eval; guardrails, incident path, kill switch; "Changed for you" / "Suggested"; capability "Remembers your corrections" | §6 acceptance: an instruction applies and Undo restores; a typed rule from 3 edits is proposed, approved, and the next draft follows it with QA passing; activation reads back the hash; rollback restores; erasure deletes every row of a company; every gate scenario's refusal stands |
| **P4** | later | Thompson sampling for outreach; exemplars by metadata; G17 recalibration proposals; a 1–2% platform holdout only at ≥ 20 tenants | — |
| **Separate** | cannibalisation | "already covered" with embeddings in `real[]` + cosine in the app, combined with SERP overlap and full text (the R34 family); no pgvector until ~50k vectors per tenant | the R34 fixture is caught |

**Calendar.** S1–S3 this week and next start the clock and backfill week 0. Staff gold labels in week 1. S4–S6 in week 2 (one engine
deploy). S7–S9 in weeks 3–4. The week-4 evaluation lands around **2026-11-16**, and P2 follows in weeks 5–8.

---

## 12. Cost

| Part | Cost |
|---|---|
| ledger, scoring, statistics | $0 (app CPU) |
| outcome capture (URL Inspection, GSC page×date) | $0 (Google APIs, inside quota) |
| Reflector (P2) | ≈ $0.02–0.05 per site per week |
| optional paid regeneration for a prompt learning | ≈ $0.80–1.40 each, explicit |
| cannibalisation embeddings (separate project) | ≈ $0.02 a month in total |

## 13. Risks

| Risk | Mitigation |
|---|---|
| clients don't answer | ≤ 3 digest questions ranked by value; staff gold sample; precision does not depend on clicks |
| learning from noise | instructions vs inferred rules; e-BH; floors in distinct instances; pre-registration |
| a learning hurts SEO or brand | never-fold list, typed rules with a deny-list, exploration floor, absolute bounds, guardrails, site health guardrail, incident revert |
| self-grading | trigger-enforced ledger, rule hash, item completeness, shadow verdicts, independent monthly re-derivation, independent re-rating |
| silent data loss | `rowsComplete`, `not_recorded` reconciliation, callback idempotency + retries, read before prune |
| cross-client leakage | per-site state, RLS, k ≥ 5, no shared text |
| engine / app drift | mirrors asserted by the build; app-only levers where the app already decides |

## 14. Owner decisions

**Before S1:**
- **O1** May Alaventra staff gold-label the 3 clients' findings and keywords in week 1 (service delivery under the current terms)? Who
  approves for managed clients?
- **O2** May clients get ≤ 3 one-click questions a week in the digest (Brevo)?
- **O3** The questions the week-4 evaluation must answer (proposed: §3 items 1–5; add yours).
- **O4** The Terms / Privacy line "we record your feedback and use it for your own service". No pooling clause yet.
- **O5** Deploy approval and timing for S5 / S6 (engine, not Monday 07:00–12:00 New York).
- **O6** Default mode "suggest only", agreed now so the UI is built for it.

**Deferred:** pooling (only at ≥ 5 tenants, with a clause), the holdout (no, for now), who pays for the Reflector, the embedding provider
for the cannibalisation project, and the customer-facing names.

---

## 15. Review disposition

Every finding of `REVIEW_ENGINEERING.md` (ENG) and `REVIEW_PRODUCT_STATS.md` (PS) was accepted. Where each fix lives:

| Finding | Fix in this plan |
|---|---|
| ENG #1 inspection is weekly in the Site Tracker; `seo_page_watch` overwrites | §4.4 index outcomes, S5 |
| ENG #2, PS #19 (diff) edit diff in the app, body only | §4.3 implicit signals, S6 |
| ENG #3 choke points for the stamp | §6 |
| ENG #4 unstable recommendation ids | §4.3 recommendations, S3 |
| ENG #5 no stable `check_id` | §4.2, S5; L1a / L1b bucket on `check_id` |
| ENG #6 `request_id` vs `execution_id` | §4.1 |
| ENG #7 lossy callbacks | §4.4 callbacks, S5 |
| ENG #8 sites not routed to the app; domain mismatch | §4.1 (`not_recorded`), §4.4 coverage |
| ENG #9 derive predictions in the app | D10, §4.1, S1–S2 |
| ENG #10 incomplete stage list; synchronous paths | §4.2 |
| ENG #11, PS #23 RLS | §9, S8 |
| ENG #12 2,000-row truncation | §4.4 `rowsComplete` |
| ENG #13 pull vs push; pruning | §4.4, §4.2 (`ai_cite` from weekly aggregate) |
| ENG #14, PS #28 (eval cost) eval gate runtime | §6.2 |
| ENG #15 page×date; φ | §4.4; φ moved to staff-only P1 (PS #8) |
| ENG #16 quota vs deadline | §4.4 `not_inspected` |
| ENG #17 pack footprint | §6 (app-only L1 / L5 / L8; ~8 workflows) |
| ENG #18 rules vs Content QA | L4 typed rules compiled into the style guide |
| ENG #19 Reflector plumbing; delivered as a report | §6.1 |
| ENG #20 lints | §5.3 (gate scenarios); `predict_lint` only when the engine emits predictions |
| ENG #21, PS #1 L1 cannot fire; two questions in one | §5.1 truth claim vs instruction; L1a / L1b |
| ENG #22 won't fix ≠ not true; never-fold | §4.3 reason codes; §5.2 L1b, L5 |
| ENG #23, PS #4 FDR | D4, §5.1 |
| ENG #24, PS #2 confounders | §4.5 |
| ENG #25 anchored deadlines | §4.1 `anchor` / `armed_at` |
| ENG #26 L6 rotation breaks deltas | L6 |
| ENG #27 not-judged codes; unique key | D2, §4.1 |
| ENG #28 stats module size | S7 is planned by collector |
| ENG #29, PS #29 (P3) pgvector | §11 "Separate" |
| ENG #30 Rule 4 / 2, public repo, mirrors, marketing | §6, L5, §9, §11 |
| ENG #31, PS #28 (job) persisted weekly job | §4.4 |
| ENG #32, PS #14 sizing; urgency | §11; S1–S2 start the clock, rebuildable data is backfilled |
| PS #3 holdout | dropped; shadow verdicts; 1–2% platform holdout at ≥ 20 tenants |
| PS #5 floors and dates | §2, §5.2 |
| PS #6 discounting | §5.1 |
| PS #7 priors; display | §5.1 |
| PS #8 φ availability | S2 records history per client; φ staff-only |
| PS #9 weights; ignored; self-selection; labeller role | D9, §4.3 |
| PS #10 states the system can never leave | L2b exploration floor, absolute bounds; L1b unfold rule |
| PS #11 default autonomy | D7 |
| PS #12 pooling with 3 tenants | D11 |
| PS #13 dropped research items | §4.5 exclusions, §6.3 site guardrail, §6.2 eval / train split, §2 effect claims dropped |
| PS #15 week-4 evaluation; independence | §3, D13, §8 |
| PS #16 client burden | §4.3 digest questions; two artifacts |
| PS #17 honest naming | header, §11 capability entries |
| PS #18 complexity | §7 two lists |
| PS #19 SEO harm from exclusions | §5.2 L1b, L2b, L4, L5, L6; §5.3 |
| PS #20 app mirrors | L2b (`cadence.ts` / `keywords.ts`), L5 app-only |
| PS #21 retention | §9 |
| PS #22 legal basis, sub-processors, PII | §9 |
| PS #24 security review items | §6.3 incident / kill switch, §7 export, §9 approvals / documentation |
| PS #25 gaming | §4.1 completeness |
| PS #26 who audits the auditor | §4.1 trigger, D3, §8 |
| PS #27 resets, portal, languages | §10, §7 portal |
| PS #29 low items | §4.3 (label revision, versioned codes), D8 (doubling unit), S2 (permissions) |
| PS #30 owner decisions before P0 | §14 |
