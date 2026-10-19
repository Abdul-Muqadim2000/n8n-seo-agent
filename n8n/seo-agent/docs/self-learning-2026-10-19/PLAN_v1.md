# Self-learning loop — plan v1 (2026-10-19, SUPERSEDED by PLAN.md v2; kept because REVIEW_*.md cite its sections)

**What it is.** Every week, for every client site, Alaventra checks how its own advice turned out, learns what works and what does not
*for that client*, uses it in the next runs, and says so — with the evidence, the sample size and an undo. Customer name: **"Learns
your business"**; the page and report section: **"What we learned"**.

**Why now.** Three clients were onboarded on 2026-10-18/19. Nothing today grades our advice against what happened: the only loop that
adjusts itself is the cost estimate (`_cost_cal.js`); chance bands, plan timelines, the reach rule and the QA bar of 80 are printed
"uncalibrated" (G17 open); the only client "no" we store is "Not a fit" on an outreach draft, and the engine only excludes it. If the
recording starts now, the first honest verdicts exist in 3–4 weeks; if it starts in 4 weeks, they exist in 8.

**Research behind it** (all in `research/`, every claim with the URL opened): `R1_MARKET.md` (what the leaders ship), `R2_ARCHITECTURE.md`
(memory, RAG, vectors, learning methods, enterprise controls), `R3_MEASUREMENT.md` (what can be judged how fast, small-data statistics),
`R4_CODEBASE.md` (what we already store and where a learning plugs in).

---

## 1. The decisions this plan makes (and why)

| # | Decision | Why (source) |
|---|---|---|
| D1 | **Grade the advice, not the traffic.** The core object is a *prediction ledger*: every checkable claim our advice makes is written when the advice is made, with its check date, scoring rule and evidence floor frozen. | At ~300 sessions/month a 4-week before/after test only sees changes of +40–70%; one page only a multi-fold change; split tests need ~1,000 visits/day per section (R3 §0, §2.1). Advice claims (finding true, keyword fit, indexed by week 4, reply likely, cost) are binary and fast (R3 §4). |
| D2 | **"Not judged" is a first-class result**, with a reason (too small, confounded, not applied, not published), and the coverage ("we could judge 41% of last month's advice") is shown. | Honesty is our lead: no vendor puts n or an interval beside a rate or refuses a delta across a changed panel (benchmark programme 2026-10-15; R1). |
| D3 | **Statistics for numbers, never vectors.** Beta-binomial for yes/no, gamma-Poisson / negative binomial for counts, fixed weak priors per advice type, per-site posteriors. A fitted cross-client hierarchy only from ≥ 8 tenants. | 80% of the learning is numeric (R2 §0); with 3 tenants the between-client variance cannot be estimated (R3 §3.2). |
| D4 | **No RAG for facts, rules or voice.** Corrected facts go into the business profile and the claims check (they must apply *every* time); rules and voice go into a bounded, always-injected block. | Retrieval can miss; one client's learnings are a few thousand tokens, far under Anthropic's ~200k "skip RAG" line (R2 §3.2, §0). |
| D5 | **Vectors only for similarity, in phase 3:** "the site already has a page for this" (cannibalisation), near-duplicate questions / briefs / pitches. pgvector in our Postgres, exact search per tenant, combined with full-text and the SERP-overlap clustering we already run. | The R34/R35/R36 High defects were literal matching (R2 §3.1). A separate vector DB, a memory product or a local embedding model do not fit a 4 GB VM with ~0.7 GB headroom (R2 §6.5). |
| D6 | **Learning changes bounded settings, never shared prompts, never safety gates.** A per-site, versioned, approved **policy pack** is the only channel; it re-ranks and tunes inside what the gates already allow. Shared prompt / threshold changes are proposals for staff, shipped as normal code through the harness. | Prompts are shared by every client; automatic rewriting needs 200+ examples and can delete a refusal no metric rewards (R2 §4.4); SOC2-style change control (R2 §5). |
| D7 | **Three tiers of change:** *automatic* (bounded numbers, shown, one-click undo), *approve* (anything that changes text the client sees, hides a finding type, changes outreach), *staff* (shared prompts, cross-client thresholds). Per-site switch: **Learning on / suggest only / off**. | Human-in-the-loop as the enterprise norm (R2 §5); owner decision on the default (§12). |
| D8 | **The app owns the learning state; the engine emits predictions and consumes the pack.** | Migrations, RLS, audit log, approvals and the per-company boundary already live in the app; n8n Data Tables have no RLS and a shared size cap (R2 §6.1, R4 §6). |
| D9 | **Explicit feedback is the main signal for the first months**, implicit signals second (what the client edited before publishing, what they ignored), outcomes third. | Outcomes are slow (R3 §1); labels are fast and the highest-value, lowest-risk first step (R2 §6.3). |
| D10 | **Nothing crosses clients except numeric aggregates about our own model** (e.g. "our 50–70% band came true 31% of the time"), and only with the Terms covering it; client text, keywords, URLs, examples or embeddings never. | OWASP LLM08 (embedding inversion, cross-tenant leakage) (R2 §5); calibration is a property of our model, so pooling it is legitimate (R3 §4.2). |
| D11 | **One verdict vocabulary everywhere:** *worked* · *did not work* · *no effect* · *inconclusive* · *too early* · *not crawled yet* · *confounded* · *not applied*. "No effect" (enough data, nothing moved) is never written as "inconclusive" (not enough data), and neither as "too early". | Only SearchPilot keeps "inconclusive" as a verdict; Search Atlas tells customers a dip is "completely normal"; BrightEdge / Siteimprove / Yext quote uplift with no method (R1 findings 2–3). |
| D12 | **Automatic changes never spend more, never publish or send anything outside, never change a figure or a fact.** Those always wait for a person. A rejected proposal does not come back unless its evidence at least doubles. | Google Ads auto-apply never raises budgets; Frase sends statistic edits to a human; Intercom Fin does not resurface a rejected item (R1 lessons 7, 9). |
| D13 | **Every learning declares a guardrail metric that can undo it by itself** (e.g. a folded finding type that a live re-check later proves real is unfolded and the client told). | Statsig guardrail metrics block a release (R1 lesson 8). |

### 1.1 Where this puts us against the market (R1)

No vendor of the 18 checked documents a per-client loop in which the outcome of *its own advice* changes what it recommends next for
that client. What is sold as "learning" is one of: brand voice / knowledge / memories a person edits by hand (Jasper, Writer, HubSpot
Breeze), global models the vendor tunes, thumbs up/down that go to the vendor's product team, or monitoring with no causal test. Causal
proof exists only as split tests on large templates (SearchPilot, Botify ~300 pages × 10 clicks/day, seoClarity) — none fits a small
client. The parts worth copying are scattered and nobody combines them:

| Copied from | What we take |
|---|---|
| Google Ads (Smart Bidding, recommendations) | hard data minimums per lever; a **"Learning" status that names its reason and what resets it**; an auto-apply queue by opt-in category; undo; auto-apply never raises spend |
| Statsig / Optimizely | data-eligibility rules, guardrail metrics that block, holdouts, variance reduction |
| Intercom Fin | a weekly list of fixes ranked by real demand; a rejected item stays rejected |
| Search Atlas (OTTO) | undo per change; changes deployed in batches |
| Frase | a diff before applying; a confidence bar the user sets; statistic edits always wait for a human |
| Profound | approvals with tiers; restore a previous version |
| SearchPilot | credible intervals; "inconclusive" as a published verdict |

**What we would own:** a per-client track record of our own advice against a control; honest small-sample verdicts with n and a range;
learning that borrows from all clients only until a client has enough of its own; learned *rules* shown and undoable as rules, not page
by page; "not crawled / too early / inconclusive / no effect" kept apart; excluded weeks (outages, core updates) and seasonal events
marked; learning from the owner's edits and rejections with approval; a changed recipe replayed through QA before it goes live; a
holdout that tests the loop itself; and **what did not work** listed in the client's report.

---

## 2. What "learning" will and will not do in the first 3–4 weeks (say this to clients)

**Will be judged within 4 weeks:** whether each audit finding was real (client label + the live re-check); whether each keyword or topic
fitted the business (client label); whether new pages were discovered and indexed by their deadline; whether each page got its first
impressions; outreach replies; what the client changed in our drafts before publishing; how far each run's cost was from its estimate;
how often a recommendation was done, ignored or dismissed.

**Will not be judged yet:** whether a page ranks (pages that reach the top 10 mostly do so in month 1, but a verdict on the *chance band*
needs ~25 resolved predictions per band — months, pooled); whether a refresh lifted clicks (needs ~80 clicks per side and a control);
a link's effect on rank (not measurable at this size); GA4 conversions (tiny counts, thresholded). These print "too small to tell"
with the reason — never a guess.

---

## 3. Architecture

```
            ENGINE (n8n)                                   APP (Fastify + Postgres)                         CLIENT / STAFF
 ┌──────────────────────────────┐   callback +       ┌──────────────────────────────────────┐
 │ every advice-emitting run    │── predictions[] ──►│ 1 ledger   learning_predictions       │
 │  _predict.js kit stamps      │                    │            (append-only, frozen rules)│
 │  claims + pack version       │                    │ 2 signals  learning_signals ◄─────────┼── 👍/👎 + reason, edits,
 │                              │                    │            (feedback, implicit,      │   done / dismiss / snooze
 │ Site Tracker / Page Watch    │── outcome rows ───►│             outcomes)                 │
 │  + outcome probes (free:     │  (Data Tables,     │ 3 grade    weekly job: score due     │
 │   URL Inspection, GSC        │   read by the app) │            predictions, confounders, │
 │   page×date, live re-check)  │                    │            posteriors, FDR           │
 │                              │                    │ 4 propose  numeric → candidate        │
 │ Learning Reflector (Claude   │◄── clusters ───────│            learnings; text → Reflector│
 │  Sonnet, ledgered): rules    │── proposals ──────►│ 5 review   tiers: auto / approve /   │──► "What we learned" page,
 │  with cited evidence ids     │                    │            staff                      │    weekly report section,
 │                              │                    │ 6 evaluate replay fixtures with the  │    approve / undo
 │ every run reads the active   │◄── seo_policy_packs│            draft pack (eval gate)    │
 │ pack (one Data Table get):   │   (one row/site)   │ 7 activate immutable pack version,   │──► /admin: advice scorecard,
 │ numbers → Code nodes,        │                    │            audit log, rollback       │    calibration, proposals,
 │ <client_learnings> → prompts │                    │                                      │    drift
 └──────────────────────────────┘                    └──────────────────────────────────────┘
```

### 3.1 The prediction ledger (heart of the feature)

New app table **`learning_predictions`** (migration `0015_learning`; `company_id`, `site_id` NOT NULL; RLS forced — §9). One row per
checkable claim, written by `ingestCallback` from a `predictions[]` array that every advice-emitting callback now carries.

| Column | Meaning |
|---|---|
| `id`, `company_id`, `site_id`, `run_id`, `request_id`, `created_at` | identity; `run_id` joins to `runs`, `request_id` to the engine execution |
| `advice_type` | closed list, §4 (e.g. `audit_finding`, `keyword_fit`, `index_by`, `first_impr_by`, `rank_band`, `reply_prob`, `cost_est`, `qa_publishable`, `ai_cite`, `rec_useful`) |
| `subject_kind`, `subject_ref` | what it is about: finding (`site_id:finding_key:audit_id`), keyword, URL, prospect (`domain|type`), prompt_id, ladder_id+rung |
| `claim` jsonb | machine-readable: `{metric:"indexed", by:"2026-11-16"}`, `{metric:"top10", by:"2027-04-19", p:0.6}`, `{metric:"real"}` |
| `p_stated`, `band` | the stated probability / band, null for deterministic claims |
| `baseline` jsonb (frozen) | the 8-week median it starts from, the data window, dispersion φ when relevant |
| `control_ref` | the matched untreated set for effect claims (§5.4) |
| `check_at`, `grace_days` (frozen) | when it is scored; grace covers Search Console's lag (3 days) |
| `score_rule`, `min_evidence` (frozen) | `binary_hit` / `brier` / `wilson_precision` / `rate_ratio_nb`; the floor below which it is "not judged" |
| `pack_version` | the policy pack that produced the advice (lineage) |
| `origin` | `live` or `retro` (backfilled from week-0 reports; never counted in accuracy until its own future check) |
| `outcome`, `verdict`, `score`, `scored_at`, `confounders`, `evidence` | filled **once**: `hit` / `miss` / `not_judged:<reason>`; evidence = the numbers, URLs and query that decided it |

**Rules** (R3 §4.3, Goodhart §3.7): the row is never updated except to fill the outcome once; the rule is frozen at creation; a failed
prediction can never be dropped; `not_judged` counts toward coverage, never toward accuracy; advice the client did not act on is
`not_judged:not_applied` (and if the outcome happened anyway, that is baseline evidence, recorded as such).

**Engine side:** a kit **`v5/code/_predict.js`** (`PR.make(type, subject, claim, opts)`) used by the nodes that build callbacks
(`Build_Site_Callback.js`, the audit, ladder, content, AI visibility / growth, backlinks, Link Builder and keyword-check responses). The
kit knows each advice type's default `check_at`, `score_rule` and `min_evidence` (one table in the kit, mirrored in
`app/shared/src/learning.ts` like `keywords.ts` ↔ `_reach.js`). A new lint **`predict_lint.py`** fails the build when a callback stage
listed as advice-emitting carries no `predictions` (same shape as `lineage_lint`), with a ratchet.

### 3.2 Signals

New app table **`learning_signals`** — append-only facts, idempotent on `(subject_ref, metric, window)`.

| Source | Signal | How it is captured |
|---|---|---|
| **Client, explicit** | 👍 / 👎 + a reason code from a closed list per artifact, optional note | one `FeedbackControl` component on every artifact the app shows: finding, keyword verdict / suggestion, ladder rung, page, AI question, prospect, outreach draft, recommendation, weekly brief action |
| **Client, explicit** | done / not now / dismiss (with reason) on recommendations | recommendations get a stored state for the first time (`recommendation_states`: id, state, reason, at, by) — today they are recomputed and nothing remembers a dismissal |
| **Client, implicit** | what they changed before publishing | the publish check already fetches the live page: diff it against our draft (`_shingle.js` 8-word shingles + a line diff of headings / title / meta) → `edit_ratio`, removed claims, renamed terms |
| **Client, implicit** | edits to outreach drafts before sending; which drafts were sent / left | the app's sender already holds the draft and the sent text |
| **Client, implicit** | ignored | an artifact shown for ≥ 14 days with no action (weak signal, low weight, never alone enough to act) |
| **Outcome (engine)** | index state, last crawl, Google's canonical | Page Watch's URL Inspection rotation, with every advised / written URL added to its key pages (free; quota 2,000/day/property) |
| **Outcome (engine)** | first impression date, weekly impressions / clicks / position / distinct queries per advised URL | Site Tracker: one GSC `searchAnalytics` request by `page`×`date` filtered to advised URLs (free) → new Data Table `seo_page_outcomes` (site, url, week, indexed, impressions, clicks, position, queries_n, anonymised_share) |
| **Outcome (engine)** | finding still present / fixed | the live re-check (`PW.recheck`) and the next audit's diff (`Audit_Diff.js`) |
| **Outcome (engine)** | rank vs band, AI mention / citation, link live, reply, cost | already stored: `seo_rank_history`, `seo_ai_visibility` / `seo_ai_answers`, `seo_backlinks`, `outreach_sequences.replyClass`, `seo_run_ledger` |
| **Judge (later)** | page helpfulness vs brief, tone vs style guide | one isolated Claude judge per dimension with an "unknown" exit, only where no code check exists; counted only while its agreement with owner labels (Cohen's κ, monthly sample) stays ≥ 0.6 (R2 §4.5) |
| **Context** | Google updates, data breaks, tracking gaps | `v5/data/seo_events.json` (already the one registry; staff add entries from Google's Status Dashboard weekly — §5.3) |

### 3.3 Grading and statistics (weekly job `LEARNING_JOBS`, app server)

Runs **Sunday 20:00 America/New_York** (after the week's data, before Monday's schedules; never in the Monday 07:00–12:00 window).

1. **Collect** — read the outcome Data Tables through the n8n public API the dashboards already use, plus app tables → `learning_signals`.
2. **Score** every prediction whose `check_at + grace` has passed, once. A window overlapping a logged update or data break →
   `not_judged:confounded`. Below `min_evidence` → `not_judged:too_small`. Not published / not applied → `not_judged:not_applied`.
3. **Estimate** per site × advice type (and per bucket, e.g. finding type, page type, prospect type): Beta posterior from a **fixed weak
   prior** (Beta(2,2) for unknown rates; audit "finding is real" starts from the accuracy set, Beta(≈10,1) capped so ~10 client labels can
   override it), observations discounted `0.97^weeks`. Counts use gamma-Poisson with the site's own dispersion φ measured from its 16 months
   of Search Console history. Displayed with Wilson ranges and n — the invariant we already keep.
4. **Calibrate our model (pooled, numeric only)**: Brier score with its decomposition and CORP reliability per band, across all opted-in
   sites; nothing shown below ~25 resolved predictions per band. This is the data G17 has been waiting for.
5. **False discoveries**: a learned *rule* is adopted only if it survives Benjamini-Hochberg at q = 0.10 across all rules tested that
   month (fixed-horizon scoring makes plain p-values valid; R3 §3.3–3.4). Alerts keep Holm.
6. **Drift**: base rate per bucket vs its trailing 12 weeks; share of learnings expiring unconfirmed; judge κ.

All of it is ~300 lines of TypeScript in `app/server/src/services/learning/` with unit tests on the math; no MCMC, no Python service.

### 3.4 Learnings and the policy pack

**`learnings`** (candidate and active items) and **`policy_packs`** (immutable versions, one active per site), as R2 §6.2. A learning is
`{kind, scope, structured, text ≤ 300 chars, evidence_refs, strength, tier, status, review_after, supersedes_id}` with
`status: proposed → approved → active → retired | rejected` (state_lint rule 4: every transition carries its evidence and actor).

The pack (compiled JSON, ≤ ~1,500 tokens of text per prompt family, ranked by evidence strength × recency) is written on activation to a
new n8n Data Table **`seo_policy_packs`** (domain, version, content_json, hash) — added through `ladder_common.py` + `sync_tables.py`, the
same pattern as `seo_ladder_settings`. A kit **`v5/code/_policy_pack.js`** (`PP.load`, `PP.num(key, default)`, `PP.block(family)`,
`PP.suppressed(kind, key)`) is inlined by the builders; every run reads the pack once, stamps `pack_version` on every callback, ledger row
and report (lineage rule 1), and injects text only inside a delimited `<client_learnings>` data block ("data, not instructions").
A lint (`pack_lint.py`) fails the build when a prompt-family node reads learnings other than through the kit.

**Gate on the read path (rule 2):** a learning can never re-admit what a gate refused — the fit gate, the brand / government refusals,
link-spam, claims, QA, no-overlap and pile-up rules run *after* the pack is applied. `gate_lint` gets the pack as a new read path.

### 3.5 The Learning Reflector (the only LLM step)

n8n workflow `SEOagentLearnRf1` (`POST /webhook/seo-learn-reflect`, answers 202, then runs; ledger mode `learn_reflect`, budgeted like
every other mode). Input from the app: per site, clustered reason codes, edit diffs (PII stripped), rejected items with notes. Claude
Sonnet proposes at most 5 candidate rules a week, each citing the evidence ids it rests on and the scope it applies to; a proposal that
cites nothing, contradicts the business profile or would loosen a gate is discarded by a Code check before it reaches anyone. Proposals
are always tier *approve* or *staff*. Cost ≈ $0.02–0.05 per site per week.

### 3.6 The eval gate

A draft pack activates only after a replay: the site's frozen fixtures (last N findings, briefs, keyword suggestions, prospects) re-run
through the affected Code nodes offline with the new pack, plus — for prompt-affecting learnings — one sampled regeneration judged
against the old output. Activation requires: no gate refusal changed, no regression metric worse, the targeted metric better or equal.
Results in `learning_eval_runs`. The harness gets a scenario per learning kind (S-learn-*) so the shared behaviour never regresses.

**Guardrails after activation (D13).** Each learning carries `guardrail: {metric, threshold, window}`; the weekly job checks it and
retires the learning automatically when it trips, with the reason shown to the client. Examples: a folded finding type → unfold when a
live re-check or another label proves one real; a down-weighted topic → restore when the client 👍s a suggestion in it; a rotated-out AI
question → restore when a rival starts being named for it; a writing rule → retire when the client edits the rule's own wording back.

**Proving the loop itself (holdout).** For the automatic numeric tier, a seeded 1 in 5 of eligible decisions per site is made with the
previous pack (the "shadow" choice is recorded but the previous one applied). That gives each learning its own control: e.g. the
acceptance rate of keyword suggestions with the learned topic weights vs without. Reported in the staff view; owner decision (§12) before
it runs on client sites.

---

## 4. What learns, from what, and what it changes

Ordered by when it can first act. "Floor" = minimum evidence before anything changes; below it the page says "too small to tell".

| # | Advice type | Signal | Floor | What changes (tier) | First possible |
|---|---|---|---|---|---|
| L1 | **Audit finding type is real for this site** | 👎 "not true" / "won't fix" + live re-check | 3 labels of one type, posterior P(real) < 0.3 | that finding type is *shown folded* ("hidden: you marked 3 of 3 not true — show") for this site; it is still computed and still counted in staff accuracy (auto, undo) | week 1 |
| L2 | **Keyword / topic fits the business** | 👍/👎 + reason ("not our service", "competitor's brand", "wrong market") | 3 labels in a topic cluster | topic weight in discovery, cadence and ladder suggestions (bounded ×0.5 … ×1.5 per month); "not our service" also becomes a **business-profile fact proposal** (approve) | week 1 |
| L3 | **Corrected fact** | a reason "wrong fact" + the client's correction; Answer Analyst's wrong-AI-claim findings | 1 correction | added to `business_facts` / the claims check (approve) — applied every run, never retrieved | week 1 |
| L4 | **Writing rules** | edit diffs before publishing, rejected drafts with reasons | a pattern in ≥ 3 edits (Reflector) | a rule in the `<client_learnings>` block, e.g. "say 'Peppol access point', never 'e-invoicing solution'" (approve) | week 2–3 |
| L5 | **Recommendation usefulness** | done / dismissed + reason / ignored | 5 of a kind | order and frequency of that recommendation kind for this site; "dismissed: already done elsewhere" suppresses it (auto, undo) | week 2 |
| L6 | **AI question panel** | question never yields a mention, a citation or a rival in 4 weeks; client 👎 | 4 weeks × all engines | rotated out (pinned questions never), replaced from the queue (auto, shown) | week 4 |
| L7 | **Prospect / pitch type** | reply class per prospect type, edits to drafts, "Not a fit" reasons | 30 sends per variant (our existing rule) | which opportunity sources get the weekly 10 drafts; later Thompson sampling on pitch / subject / timing (auto within bounds) | week 3+ |
| L8 | **Indexing and first impressions per page type** | URL Inspection + GSC page×date | 10 pages of a type | the site's "normal" time-to-index shown; a page past its deadline raises a fix task ("crawled – not indexed at week 4 is a quality signal") (auto, shown) | week 2–4 |
| L9 | **Cost estimates** | measured run cost | every run | already self-correcting (`_cost_cal.js`); folded into the same page | now |
| L10 | **Chance bands, plan timelines, QA bar, reach rule (G17)** | resolved rank predictions, QA → week-8 outcome | ~25 per band, ≥ 15 published pages, pooled | *staff* proposal → normal code change through the harness; recalibrated band shown beside the raw one | months |
| L11 | **"Already covered" threshold** (phase 3) | client confirms / denies "same page" | 10 confirmations | the similarity threshold for cannibalisation warnings (auto, bounded) | after P3 |

**Never learned:** anything that loosens a refusal (brand, government, spam, unverified claims, QA "not ready", no-overlap, pile-up);
anything that makes the system do *less* to be cheaper without scoring what it gave up; anything from one client applied to another.

---

## 5. Making the numbers honest

1. **Frozen rules, append-only ledger** (§3.1). The system grades itself, so it must not choose the check date after seeing data, move
   the target or drop a failure. A staff monthly audit samples 20 scored rows and re-derives them.
2. **Fixed-horizon scoring.** Each prediction is scored once at its date, so no weekly peeking problem; only the continuously watched
   alerts (pulse, decay) use always-valid methods (R3 §3.3).
3. **Confounders as dated events.** The Sep 24–Oct 7 2026 spam update overlaps the new clients' first weeks; the &num=100 break
   (Sept 2025), AI Mode inside Web totals (June 2025) and the Generative AI report (2026-08-31, never summed with Web) are data breaks.
   Staff check Google's Status Dashboard every Monday and add events to `seo_events.json` (it is already the one registry; R3 §2.5).
4. **Regression to the mean.** Selection uses an 8-week median, not one window. For effect claims (refresh → clicks, striking distance →
   position), the cadence already cannot do every eligible item; the ones it does not do *this* week are recorded as the matched control
   set (`control_ref`), chosen by a seeded draw among equal-priority items so the choice is not biased. No item is withheld on purpose
   without the owner's yes (§12).
5. **Goodhart guards.** "Indexed" is always paired with "impressed"; the QA score is checked against a human-rated sample, not only
   against itself; cost learning never stands alone.
6. **Small-data wording.** Every number shows n and its range; under the floor the sentence is the R3 §5 wording ("8 of 9 checked
   findings were real (57–98%) — too few to rate this check yet"). The copy lives in `app/shared/src/learning.ts`.

---

## 6. What the client sees

- **"What we learned" page** per website (sidebar, under Overview): *Your advice scorecard* (findings real 92% of 26 · keywords you
  accepted 7 of 9 · pages indexed by their deadline 3 of 4 · drafts published without changes 1 of 3 · recommendation done rate),
  *What we changed for you* (each learning: what, why, the evidence, since when, **Undo**), *Waiting for your yes* (approve-tier items),
  *Too early to tell* (with the reason and the date we will look again), *Coverage* ("we could judge 41% of last month's advice").
- **A "Learning" status per lever** (Google Ads' model): *Learning — 4 of 10 labels needed*, *Active since 12 Nov*, *Paused — Google
  update in progress*, *Reset — you changed your services*; each says what resets it (a changed business profile, a new competitor
  list, a site migration).
- **Weekly report**: a short "What we learned this week" block (at most 3 items + a link), in the Site Tracker report and the digest,
  including **what did not work** — no vendor lists its own misses (R1).
- **Feedback controls** on every artifact (👍/👎 + reason, one click; never a modal).
- **Setting** per website: Learning **on** (automatic tier applies, the rest waits for approval) / **suggest only** / **off** — off still
  records predictions (our own quality), it only stops changes.
- **Export**: learnings and the scorecard through the read API `/api/v1` and MCP (enterprise: they can audit us).

## 7. What staff see (`/admin`, built on the 2026-10-19 admin panel)

- **Advice quality across clients**: precision / hit rate per advice type, calibration (Brier, reliability) per band, coverage,
  not-judged reasons — the system's real report card, refreshed weekly. This replaces most of the manual re-rating evidence.
- **Proposals queue**: staff-tier learnings (shared prompt / threshold ideas with the evidence across sites) → a ticket for a normal
  code change.
- **Drift and audit**: base-rate changes, κ of the judge, the monthly 20-row re-derivation, every pack activation and rollback.

---

## 8. Where it hooks into today's system (from R4)

| Need | Existing hook |
|---|---|
| Predictions out of the engine | callback builders (`Build_Site_Callback.js`, response builders) + `ingestCallback` in `services/runs.ts` |
| Chance / content score / expected visits stored next to their ids | today only in `reports.payload` → now in `learning_predictions` |
| Index checks of advised pages | Page Watch URL Inspection rotation (`_page_watch.js`) |
| Edits before publishing | the publish check's live fetch (`Publish_Check.js`) + `_shingle.js` |
| Re-check a finding | `PW.recheck` ("I fixed this") and `Audit_Diff.js` |
| Apply numbers per site | `seo_policy_packs` read by `_policy_pack.js`, next to `_monitor_sites.js` / `seo_ladder_settings` |
| Inject text | `Brief_Context.js` output → `{{ $json.client_learnings }}` in `strategy_brief.txt`, `copywriter.txt`, `editor.txt`, `site_brief.txt` (behind an agent: `$('Node').first().json`) |
| Mirrors that must change together | `_predict.js` ↔ `app/shared/src/learning.ts`; existing `_reach.js` ↔ `keywords.ts`, `Cadence_Plan.js` ↔ `cadence.ts` |
| Schedules | app job (`LEARNING_JOBS`), not an n8n cron → no catch-up entry needed; the Reflector is webhook-started and ledgered |
| Events | `v5/data/seo_events.json` → `_annotations.js`, `_site_stats.js`, `seo-events.generated.ts` |

---

## 9. Enterprise requirements

| Requirement | How |
|---|---|
| Tenant isolation | `company_id` + `site_id` NOT NULL on every learning table; **Postgres RLS with FORCE** on the new tables (the first RLS in the app), the app sets `SET LOCAL app.company_id` per transaction; isolation tests in `server/test` |
| No leakage across clients | only numeric aggregates about our own model cross sites; never text, keywords, URLs, exemplars or embeddings; a client opted out of pooling contributes nothing at the next recompute |
| Audit trail | every learning, approval, activation, rollback and erasure in the 0011 audit log (append-only) with actor and evidence ids |
| Explainability | every output carries `pack_version`; every learning shows its evidence; every number its n and range |
| Versioning / rollback | immutable pack versions; rollback = activate the previous one; diff view |
| Change management | pack activation = proposal → eval replay → approval → activation → log (SOC2 CC8.1 shape); shared prompts only via git + CI |
| Prompt injection / poisoning | client notes, scraped pages and replies are untrusted: length-capped, PII-stripped, approved, and injected only inside the `<client_learnings>` data block |
| Privacy / GDPR | no personal data in learnings (contacts referenced by id); company erasure cascades over all learning tables and recomputes pooled numbers, logged with counts; retention: signals 24 months, predictions kept (they are our quality record) unless the company is erased |
| Expiry | every learning has `review_after` (90 days); unconfirmed → proposed for retirement |
| Cost | grading and stats $0 (app CPU); outcome probes $0 (Google APIs); Reflector ≈ $0.02–0.05 / site / week; embeddings (P3) ≈ $0.02 / month total |

---

## 10. Phases

Sized in sessions (one session ≈ one agent-day). Each phase ends with its checks, a commit and push, and a marketing / changelog entry
only for what customers can see.

| Phase | When | Build | Acceptance |
|---|---|---|---|
| **P0 — record** | this week | migration 0015 (`learning_predictions`, `learning_signals`, `recommendation_states`, RLS); `_predict.js` + `predict_lint.py`; predictions in every advice callback; `FeedbackControl` on every artifact; recommendation states; advised URLs into Page Watch; `seo_page_outcomes` from the Site Tracker; publish-check edit diff; **week-0 baseline** (a read-only snapshot of each client + retro predictions from their existing reports, `origin: retro`) | every advice type of a real run lands in the ledger with frozen rules; a 👎 on a finding lands as a signal; RLS test: company A cannot read B's rows; harness 0 failed; predict_lint bites when broken on purpose |
| **P1 — grade, read-only** | weeks 1–3 | weekly grading job, stats module, confounder handling, "What we learned" page (scorecard, too early to tell, coverage), staff advice-quality view in `/admin` | numbers reproducible from signals (unit tests on the math); a window overlapping the spam update is `not_judged:confounded`; nothing changes behaviour |
| **P2 — apply, gated** | weeks 3–6 | `learnings`, `policy_packs`, `learning_eval_runs`; `_policy_pack.js` + `pack_lint.py`; the Reflector workflow; approval + undo UI; tiers; L1, L2, L3, L5, L6, L8 live; L4 behind approval | a 👎 pattern hides a finding type for that site only and Undo restores it; a client correction becomes a fact the next page obeys; a rule from 3 edits is proposed, approved, and the next draft follows it; rollback restores the previous output; erasure deletes every learning row of a company; no gate refusal changes in the eval replay |
| **P3 — similarity** | after P2 | pgvector (compiled into the alpine image — no libc change), `content_embeddings`, `similar()` in the app (full-text + vector, reciprocal rank fusion), "already covered" check in ladder / keyword / cadence paths, panel and pitch dedupe; L11 | the 2026-10-15 R34 fixture (live "AI Consulting" page) is caught; threshold learned from confirmations |
| **P4 — choose + calibrate** | months | Thompson sampling for outreach pitch / subject / timing (existing min-30 rule); exemplars by metadata, kNN past ~50 approved items; G17 recalibration proposals from pooled bands | arms' posteriors visible; no auto-switch without the site's setting; recalibrated bands shown beside the raw ones |

**The 3–4-week re-evaluation you asked for** becomes the P1 output itself: the staff view *is* the evaluation, refreshed weekly, and
the week-0 baseline is what it is compared with.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Clients never click feedback | implicit signals (edits, ignored, done) carry weight; the weekly report asks one question at a time; nothing depends on volume to stay safe |
| Learning from noise | floors, FDR, frozen rules, confounder windows, matched controls, "too small to tell" |
| A learning hurts SEO | gates run after the pack; bounded steps; eval replay; undo; expiry |
| One client's habit leaks to others | numeric-only pooling, RLS, no shared text, per-site packs |
| Self-grading bias | append-only ledger, frozen rules, staff 20-row audit, coverage shown |
| Complexity on a 4 GB VM | stats in the app process; no new service; vectors only in P3 and exact search |
| Engine / app mirrors drift | `_predict.js` ↔ `learning.ts` checked by a harness scenario that compares the two tables |

---

## 12. Owner decisions

1. **Default per new site**: Learning *on* (auto tier applies, the rest asks) — recommended — or *suggest only*.
2. **Pooled model calibration across clients** (numeric only): add a Terms clause and default it on for self-serve, off for enterprise?
3. **Who approves approve-tier items for managed clients**: the client, Alaventra staff, or either.
4. **Matched controls**: only the natural ones (items the cadence did not reach) — recommended — or allow deliberately holding back
   1 in 3 eligible items for a cleaner measurement. Separately: may the loop's own holdout (1 in 5 automatic decisions made with the
   previous pack, §3.6) run on client sites?
5. **Embedding provider for P3** (Voyage `voyage-4-lite` recommended; a new sub-processor) and data residency for UAE / EU clients.
6. **Customer-facing name** ("Learns your business") and whether it is in every plan.
