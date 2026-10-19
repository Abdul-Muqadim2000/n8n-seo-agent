# Self-learning plan: adversarial review (statistics, product, SEO, enterprise)

Reviewed 2026-10-19 against `PLAN.md` (v1) and `research/R1`–`R4`. The reviewer was read-only and changed only this file. Every
number marked **[computed]** was worked out for this review in Python (pure arithmetic, Beta CDF by numerical integration).

**Verdict.** The core idea is right and worth defending: grade the advice, not the traffic; keep a ledger that only grows; keep "not
judged" as its own result; numbers instead of vectors; one bounded pack per site. The rest has three problems:
1. **Several thresholds cannot work as written.** The audit fold (L1) can never trigger under the plan's own prior. The confounder
   rule marks almost every outcome window as not judged. The holdout has no statistical power with 3 clients.
2. **In two places the plan quietly overrides its own research,** both in the risky direction: auto-apply by default, and pooling
   with no minimum number of tenants.
3. **It is sized for 20 clients rather than 3.** The data it says is urgent can mostly be rebuilt later. The data that really cannot
   be rebuilt (the client's label at the time, what they saw, index state, live re-checks) needs only a small P0.

Severity: **High** = wrong numbers, harm to a client, or a legal / trust problem if shipped as written. **Medium** = should be fixed
before the phase that uses it. **Low** = tidy-up.

---

## A. Statistical validity

### 1. High — L1 can never trigger under the plan's own prior, and it mixes two different questions (§3.3 step 3, §4 L1)

**The arithmetic does not work.** §3.3 sets the prior for "finding is real" at Beta(≈10,1), with mean 0.91 and strength m ≈ 11. L1
folds a finding type after "3 labels of one type, posterior P(real) < 0.3". [computed]
- After 3 "not true" labels the posterior is Beta(10,4). Its mean is **0.71**, and P(p < 0.3) is **0.0007**. L1 does not fire.
- The posterior mean first falls below 0.3 only after **23** consecutive negative labels. P(p < 0.3) passes 0.5 only at about 23 as
  well. With discounting (finding 4), it takes longer still.
- For 3 labels to push the mean below 0.3, the prior strength must be m < 1.5, which is in effect no prior at all.
- §3.3's own cap ("~10 client labels can override it") needs m < 4.9 to reach 0.3 after 10 negatives. With Beta(10,1), 10 negatives
  reach only **0.48**.
- So the prior, the cap and the L1 floor contradict each other.

**The prior is also too confident.** It comes from `ACCURACY_SET.md` (53 offline, staff-labelled cases, with the gate tuned on
them). But the 2026-10-15 re-rating checked every audit finding on the live site and found **7 of 30 false**. That is 23/30 = 77%,
Wilson 59–88% [computed]. A prior centred on 0.91 is overconfident by the system's own most recent live evidence.

**L1 mixes two questions:**
- **"Not true"** is a *precision* failure. A false finding is a defect in a check that every client shares. Folding it for one site
  hides a bug that affects every other site. (R34–R119 were exactly this kind of defect.)
- **"Won't fix"** is a *relevance* preference. The finding is true, and the client has decided not to act. Treating "won't fix" as
  evidence that a finding is not real is wrong both statistically and for SEO.

**Fix.** Split L1 into two levers:
- **L1a — precision.** Trigger: "not true" from the client, plus an automatic live re-check within 7 days, plus staff confirmation.
  Result: a staff-tier defect ticket on the shared check. The site gets an "under review" badge, not a fold. Prior: centre it on the
  live 23/30 with strength m = 4, i.e. Beta(3.1, 0.9). Under that prior, 3 negatives give a posterior mean of 0.44, which correctly
  means "ask staff" and not "hide".
- **L1b — relevance.** A client *instruction* ("hide this type for my site"), applied once and shown with an Undo. No statistics are
  needed, because the client told us. Never offered for the never-fold list (finding 20).
- Count *distinct instances*: distinct affected URLs, or distinct audits for site-level findings. One persistent finding labelled in
  three monthly audits is one observation, not three. Site-level findings (llms.txt, robots, www consolidation) give n = 1 per
  audit, so "week 1" is impossible for them.

### 2. High — the blanket confounder rule marks almost every outcome window "not judged", and gives the system a way to excuse its misses (§3.3 step 2, §5.3)

The rule is: any window that overlaps a logged update or data break is `not_judged:confounded`. Applied to the updates listed in R3
§2.5 for the last 12 months (Dec 2025 core; Mar, May 2026 core; Mar, Jun, Aug and Sep–Oct 2026 spam; each window plus the 1 week
Google advises), the results are [computed]:
- **30% of all days** fall inside an update window.
- Only **26%** of 4-week windows, **6%** of 8-week windows and **0%** of 12-week or 26-week windows are clean.

So every refresh, rank-band, query-breadth and QA-to-outcome prediction would come out "confounded". Coverage collapses, and the
Learning status reads "Paused — Google update in progress" about a third of the time.

There is a second problem. Staff add events to `seo_events.json` by hand. One added event turns any miss inside its window into
"confounded". That is a way to excuse misses after the fact, and the register already once contained two invented updates
(2026-10-15).

**Fix:**
1. Decide per advice type what an update can confound:
   - Binary deadlines and labels (finding real, keyword fit, indexed by week 4, first impression, reply, link live, cost) are
     **never** confounded by a ranking update. They can only be confounded by a *data* break or a tracking gap.
   - Only rank and traffic outcomes can be confounded.
2. For rank and traffic outcomes, use the site's own untouched pages or the site totals in the same window as the control (a
   difference-in-differences model absorbs a site-wide shift from an update). Record "update in window" as a **flag**. Use
   `not_judged:confounded` only if the site-level series moved outside its normal negative-binomial band during the rollout, i.e.
   the update actually hit this site.
3. Make `seo_events.json` an append-only registry. Every change is reviewed and carries its source URL. Each scoring run records
   the registry hash. An event added after a row's `check_at` cannot re-mark that row.
4. Store a **shadow score** for every confounded row (what the verdict would have been) and show staff the hit rate inside versus
   outside confounded windows. Any abuse of the rule then becomes visible.

### 3. High — the holdout (1 in 5) has no power with 3 clients and it overrides the client (§3.6, §12.4)

A worked example [computed]: detect a lift in keyword-suggestion acceptance from 50% to 70% (a big effect), with α = 0.05, 80% power
and an 80/20 split.
- That needs **60 holdout + 240 treated = 300 decisions**.
- At a plausible 15 eligible decisions per site per month across 3 sites (45 a month), that is **about 7 months pooled**, and
  **never** per site.

Meanwhile, 1 in 5 decisions deliberately applies the *previous* pack. If the learning came from a client's "not our service", one
in five suggestions brings back what the client told us to drop. Clients read that as "it doesn't listen".

It also contradicts R1. Lesson 10 is a **1–2% platform** holdout for 3–6 months (Statsig), and lesson 2 is a hold-back for *effect*
measurement. Neither is a 20% per-site override.

**Fix:**
- No holdout at launch.
- Log the **shadow decision** for every decision: what the defaults or the previous pack would have chosen, and where each accepted
  item would have ranked. Staff can compare offline without withholding anything from the client.
- Never hold out an explicit client instruction.
- Reconsider a 1–2% platform holdout once there are 20 or more tenants.

### 4. Medium — FDR control (BH at q = 0.10) is applied to the wrong thing, in the wrong framework (§3.3 step 5, R3 §3.4)

- "Fixed-horizon scoring makes plain p-values valid" is true for each **prediction**, which is scored once. It is not true for a
  **rule**, which is re-tested every month as evidence accumulates. Testing the same rule repeatedly is optional continuation, i.e.
  peeking. R3 §3.4 itself says to use **e-BH** in that case.
- BH needs p-values. The levers are defined by posterior thresholds, and the plan never says what the null hypothesis is.
- The family is undefined: "all rules tested that month" changes with how many proposals the Reflector produced.
- The two frameworks give opposite answers on the same data. 0 of 3 labels real under a null of p0 = 0.9 gives an exact p = 0.001,
  which would pass BH comfortably, while the Beta(10,1) posterior barely moves (finding 1).

**Fix:**
1. A client-stated preference ("not our service", "hide this type", "never say X") is an **instruction**, not a discovery. Apply
   it with no test.
2. **Inferred** rules (from outcomes, edit patterns or ignored items) get a likelihood-ratio e-value against the default, with
   e-BH at q = 0.10. That is valid under monthly re-testing.
3. The family = every open inferred-rule candidate across all sites in the calendar month, listed in code.
4. Use one framework per lever, and document which in `learning.ts`.

### 5. Medium — the floors are below the research and the "first possible" dates are optimistic (§4)

| Lever | Plan | Research says | Corrected |
|---|---|---|---|
| L1 finding type | 3 labels, week 1 | 10 labelled per type (R3 §5) | split per finding 1; a precision claim needs ≥ 10 distinct instances; a preference needs 1 instruction |
| L2 topic fit | 3 labels in a cluster | ≥ 10 labels per site (R3 §5) | instruction ("not our service") acts at 1 label as a profile-fact proposal; an *inferred* topic weight needs ≥ 10 labels in the cluster from ≥ 2 runs |
| L5 recommendation kind | 5 of a kind | — | 5 *explicit* dismissals; ignored items never count (finding 9) |
| L8 time-to-index per page type | 10 pages, "week 2–4" | 10 pages (R3) | the floor is fine; the date is not. At Starter's 1 page a week, with the pile-up guard pausing the cadence when pages go unpublished, 10 published pages of one type per site takes **3–6+ months**. The per-page deadline check can still run from week 4. |
| L10 bands | ~25 per band, "months" | 25 per band (R3 §4.2) | 4 bands means **≥ 100 resolved** rank predictions. Ladder `months` ranges run 2–15, so resolution takes **9–18 months**. The 9 rungs of one ladder plan are one cluster, not 9 independent cases: count ladders, or use cluster-robust standard errors. At n = 25 the 95% half-width is ±0.19, so this detects only miscalibration of more than about 20 points (bands are 20 points wide). |

### 6. Medium — discounting by 0.97 per week is wrong for properties that do not drift (§3.3 step 3)

- The half-life is **22.8 weeks**, and the effective sample tops out at about **33 weeks' worth** of observations [computed].
- For properties that do not change from week to week (is this finding type correct for this site's stack; is this keyword our
  service), discounting slowly pulls a settled learning back to the prior with no contrary evidence. That causes the guardrail and
  expiry churn and the "Learning reset" messages nobody asked for.
- It also makes n a non-integer, which Wilson display cannot show honestly.

**Fix:**
- No discounting for static-property levers (L1, L2, L3, L11). Their expiry is `review_after`.
- Discount only rates that really drift (reply rate, time to index, AI mention), with γ = 0.97, and display the **effective n**
  (Kish) beside the raw n.

### 7. Medium — Beta(2,2) pulls rare rates toward 50%, and the page may show two numbers that disagree (§3.3 step 3)

- Under Beta(2,2), 1 reply in 8 sends has a posterior mean of 25% (the raw rate is 12.5%). 0 of 3 has a posterior mean of 29%.
- Reply rates (~5–10%), AI mention rates (~0–5%) and index-by-week-4 (~80%) are all far from 0.5.

**Fix:**
- Use type-specific weak priors with strength 2, centred on a stated, sourced base rate: Beta(2·p0, 2·(1−p0)). For example: reply
  0.10 → Beta(0.2, 1.8); indexed by week 4 0.8 → Beta(1.6, 0.4); keyword fit 0.7 → Beta(1.4, 0.6); AI mention 0.05 →
  Beta(0.1, 1.9).
- Use Jeffreys Beta(0.5, 0.5) where no base rate exists.
- Commit the priors to `learning.ts` *before* any data is scored (pre-registration).
- The client page shows raw counts with a Wilson range only. The posterior is used for decisions and shown only in the staff view.
  One screen never shows a Wilson "0–56%" next to a posterior-driven "Active".

### 8. Medium — φ from 16 months of Search Console: availability, structural breaks, and how much it matters (§3.3 step 3)

- **Is there history?** Search Console usually shows the property's past data once it is verified. Whether each of the 3 clients'
  properties is verified and shared with the service account, and at which permission level, is **not recorded anywhere** in the
  plan or the research. Check it per client in P0. A brand-new domain, or one that recently moved, has no history.
- **Structural breaks inside the window.** The 16-month window (≈ Jun 2025–Oct 2026) contains AI Mode being added to Web totals
  (Jun 2025) and the &num=100 removal (Sep 2025). Impressions are usable only after Sep 2025, which leaves about 57 weeks.
- **Detrending.** φ must be estimated on residuals after removing trend and seasonality, or the trend inflates it. With 57 weeks of
  weekly clicks the relative standard error of φ is about 19% [computed], which is adequate. Per-page φ cannot be estimated at about
  5 clicks a week, so use the site's value.
- **New domains.** Use φ = 2.5, labelled **assumed**.
- **How much it matters.** At this traffic level, effect claims (refresh → clicks) are not measurable anyway (MDE ×2 or more; R3
  §3.5). So φ matters only for the staff view. Move the gamma-Poisson work to P1, staff-only.

### 9. Medium — explicit and implicit signals are mixed with no weights; "ignored" is undefined; labels are self-selected (§3.2, D9, L5)

- **No weights.** No weight, floor or estimand is defined for combining 👍/👎, edits, done/dismiss and "ignored".
- **"Ignored" cannot be measured.** "Shown ≥ 14 days with no action" measures how often the client logs in, not how useful an item
  is. A small B2B owner who does not log in for two weeks "ignores" everything. Nothing in the plan records whether the client
  actually *saw* an item.
- **Labels are self-selected.** People click 👎 when annoyed and say nothing when satisfied, and one engaged person dominates a
  site. "Findings real 92% of 26" is the precision *among labelled findings*, which is not a random sample of findings.

**Fix:**
1. Implicit signals **never move a lever**. They only trigger a *question* (active learning: "You skipped 4 'internal links'
   recommendations — still useful?").
2. Record **exposure**: an event when an artifact is shown on screen or opened from an e-mail digest. "Ignored" = seen and not acted
   on.
3. Measure precision on the scorecard from a **staff random sample** plus automatic live re-checks (an unbiased denominator). Show
   client labels as "you marked n of N shown".
4. Record the labeller's role (client / agency / Alaventra staff) on every signal. Never present staff labels of a managed
   client's artifacts as "you said".

### 10. Medium — folding and down-weighting create states the system can never leave (§3.6 guardrails, L1, L2)

- **L1:** the guardrail unfolds a type "when a label proves one real", but a folded item is no longer shown, so it gets no labels.
- **L2:** the guardrail restores a topic "when the client 👍s a suggestion in it", but a down-weighted topic produces fewer
  suggestions to 👍.
- **Compounding:** "×0.5 … ×1.5 *per month*" compounds to ×0.125 after three months, which removes the topic entirely.

**Fix:**
- An **exploration floor**: one item a month from each folded type or down-weighted topic is shown, labelled "we still check this —
  still not relevant?". This gives the guardrail the labels it needs, and is a better use of the "holdout" idea than finding 3.
- Bound weights in **absolute** terms: [0.5, 1.5] in total, with a step of at most ±0.25 a month.

---

## B. Contradictions with the research, and research recommendations dropped

### 11. High — default autonomy contradicts R1 and R2 (D7, §6, §12.1)

- The plan recommends "Learning **on** (the automatic tier applies)" as the default.
- R1 lesson 7 says: "**Default to approval**; 'loosen it later' (Ahrefs, Profound)".
- R2 §5 says: "Default for new clients: everything 'approve'."

**Fix:** default every site to **suggest only**. The only things applied automatically are the client's own explicit instructions
(finding 4.1). Offer "apply automatically" per category once the site has seen 4 weeks of suggestions.

### 12. High — pooling with 3 tenants contradicts R2's minimum and is close to identifiable (D10, §3.3 step 4, §9, §12.2)

- R2 §5 says a bucket feeds a global number only with **≥ 5 contributing tenants and ≥ 30 observations**, and opt-in defaults
  **off** for enterprise.
- The plan pools calibration across all opted-in sites with no minimum number of tenants, and proposes "default on for self-serve".
- With 3 tenants, one of them typically supplies most of a bucket. An "aggregate" shown to client A is then close to client B's
  own outcomes.
- The plan follows R3 ("pooling calibration is legitimate") without saying it is overriding R2.

**Fix:**
- No cross-tenant number is shown to any client until k ≥ 5 tenants and n ≥ 30 per bucket.
- Until then, calibration is a **staff-only** quality view.
- Write the Terms / DPA clause before any cross-tenant computation; "default on" waits for that clause.

### 13. Medium — research recommendations the plan dropped

| Dropped | Source | Fix |
|---|---|---|
| Per-site **data exclusions** set by staff or owner (tracking outage, site down, migration week), never removed silently | R1 lesson 5 | a `site_exclusions` row type with a reason and an actor, in the audit log; the scoring job honours it |
| Learnings formed during an update window are marked "formed during an update" and re-checked afterwards | R2 §5 drift | add the flag and the re-check |
| **Site-level guardrails** (site clicks, key-page index coverage, brand-query clicks, AI mention rate, outreach complaints) that pause *all* automatic learnings for the site | R1 lesson 8 | one site-health guardrail. If it trips, every auto-tier learning goes back to suggest-only and staff are alerted. Today the guardrails are per learning only. |
| **Keep evaluation data apart from training data** ("ratings in Batch test do not train Fin") | R1 lesson 9 | client labels train; a staff gold sample evaluates. The eval gate's fixtures must not be the items the learning was formed from. |
| A deliberate untreated set for effect claims | R3 §3.6 | defensible to skip with 3 clients, but then **drop effect claims** (refresh → clicks, striking distance → position) from P0–P2 instead of building `control_ref` machinery that cannot reach its floor (R3 MDE ×2 or more) |
| e-BH for re-tested rules | R3 §3.4 | finding 4 |
| `companies.global_learning_opt_in` default false | R2 §6.2 | finding 12 |

---

## C. Product: scope, client burden, honesty

### 14. High — over-built for 3 clients in 3–4 weeks, and the urgency is overstated (§10, "Why now")

**P0 as written is 6–8 sessions, not "this week".** It includes:
- the first RLS in the app;
- `_predict.js` wired into about 10 callback builders across about 10 workflows, plus a new lint;
- `FeedbackControl` on 9 artifact types;
- recommendation states;
- Page Watch changes;
- a new Data Table plus a Site Tracker GSC branch;
- the publish-check diff;
- a retro backfill.

R2 §6.4 sized its P0 (signals, a reason-code UI and a collect job) at 1–2 sessions. P0–P2 together are about 15–20 sessions, plus
production deploys while live clients are on the system, and those deploys are the owner's.

**The "start now or lose 4 weeks" argument is mostly untrue.** Most of the data can be rebuilt later:
- every past prediction is in `reports.payload` (R4 §1);
- Search Console serves 16 months of page × date data at any time;
- rank, AI-answer and backlink histories are kept.

What *cannot* be rebuilt later:
- the client's label at the time;
- what was shown to them (exposure);
- URL Inspection state (current state only);
- the live re-check of a finding 7 days after the audit;
- the live page before the client edits it again.

**Fix:** P0 = the non-rebuildable capture, plus a pre-registered rule table (see the end of this file). Predictions are rebuilt
mechanically from the frozen payloads once the rule table is committed.

### 15. High — what P1 delivers is not the re-evaluation the owner asked for, and §7 would weaken the independent re-rating (§7, §10)

**At week 4 almost nothing will have resolved.** Only pages published in weeks 0–1 reach their index deadline. Rank bands take
months. Labels depend on clients clicking. The owner's ask is "re-evaluate the system with real data after 3–4 weeks", and that also
needs:
- whether the schedules **fired on GCP** (R94: before the move, the weekly loop had never once started on its own schedule);
- failed executions;
- report delivery;
- cost versus credits per client;
- client engagement (logins, views, publishes);
- independently checked output quality.

**§7 would replace the independent check with a self-report.** "This replaces most of the manual re-rating evidence" swaps the
protocol's independent check (a clean scorer session with no repo context) for the system grading itself.

**Fix:**
- Build a **week-4 evaluation pack** per client: runs, schedule fires, failures, deliveries, cost against estimate and credits, the
  findings re-checked live, staff gold labels, client labels, coverage.
- Staff label ~30 findings and every keyword suggestion per client **in week 1**, so precision numbers exist without depending on
  client clicks.
- Keep the independent scorer. The staff view is *input* to the re-rating, not a replacement for it.

### 16. Medium — client burden and the wording of the Learning status (§6)

- Thumbs on 9 artifact types, for small B2B owners who log in rarely, will produce close to zero labels.
- "Learning — 4 of 10 labels needed" makes the client responsible for the product's progress.

**Fix:**
- Ask **at most 3 questions per site per week**, in the digest e-mail, with one-click signed links (single use, scoped to the item,
  expiring). Rank them by value of information: uncertain and high-impact items first.
- Never ask about the same item twice. Back off for 4 weeks after 3 unanswered questions.
- Wording: "Using our defaults until you've answered 10 (4 so far)".
- Keep in-app thumbs on two artifacts at launch (findings, keyword suggestions) plus recommendation done / dismiss.

### 17. Medium — "Learns your business" is not an honest claim at launch (§6, §12.6, marketing rule)

- Nothing changes behaviour until P2 (weeks 3–6). The first *outcome*-based learning is months away.
- The marketing rule in CLAUDE.md is "real, shipped capabilities only".
- In an enterprise security questionnaire, "learns" reads as "trains AI on your data".

**Fix:**
- No capability entry until one learning has acted on a live client.
- P1 name: "**Advice track record**" ("we grade our own advice, with the sample size").
- P2 name: "**Remembers your corrections**".
- Only the feedback buttons and the scorecard get a changelog line, when they ship.

### 18. Medium — the control model is too complex for a small client (D7, §6)

There are three tiers, three modes, an approval queue, a staff queue, a Learning status per lever and a status that can read "Paused
— Google update" (about 30% of days, finding 2).

**Fix:** clients see two lists:
- **"Changed for you"**: their instructions, each with an Undo;
- **"Suggested — your yes needed"**: everything inferred.

The staff tier is invisible to clients. The Learning status is shown only on levers that have a floor, and never says "Paused" for
an update unless the update actually hit this site (finding 2).

---

## D. SEO risk

### 19. High — learning can hide real problems, hurt brand and quality, or break measurement; "gates run after the pack" does not cover this (§3.4, §4)

The fit, brand, spam, claims, QA, no-overlap and pile-up gates protect against bad *inclusions*. Folding, suppressing,
down-weighting and rotating are *exclusions*, and no gate guards them.

| Risk | Fix |
|---|---|
| **L1b / L5** hides real issues ("won't fix" on a noindex key page; dismissing "fix indexing") | A **never-fold / never-suppress** list: severity High; indexability; robots; canonical; security; manual actions; anything that touches a key page or a page with clicks. A folded type still shows its count ("3 hidden — show"). It unfolds automatically when `affected_count` rises or a key page becomes involved. Suppression lasts at most 90 days, and an item comes back if its metric worsens. |
| **L2** one person's 👎 run starves a money topic | Never down-weight a topic that is in the declared services / `content_groups` or that has an active, approved ladder. A topic weight applies only to *new* suggestions, never to the rungs of an approved ladder. |
| **L6** rotating AI questions | Keep a **stable core panel**. Rotation is allowed only in a separate exploration segment. Never rotate a pinned question or one tied to `seo_ai_targets` (questions to win). Each rotation is a new panel version, so the B-L4 like-for-like rule still refuses deltas across it. Cap at 2 rotations per site per month. |
| **L4** rules learned from edits strip E-E-A-T. Clients often delete sources, the author box, FAQs, the "Updated" date, schema or disclaimers, and theme or SEO-plugin changes show up in a full-page diff as client "edits". | Make writing rules a **closed, typed list** (term replacement, banned phrase, preferred term, tone flag), not free text. Deny-list any rule that removes a required element (sources, author / reviewer box, schema, update date, internal links, CTA, verified figures). Diff **only the extracted article body** against the draft, ignoring the template. Typed rules also make the "contradicts the profile / loosens a gate" check (§3.5) and the "edited back" guardrail computable. Today they cannot be computed on free text. |

### 20. Medium — interaction with ladders, cadence and the app's preview copies (§8)

- `Cadence_Plan.js` and `app/server/src/services/cadence.ts` must change together (R4 §7). If only the engine reads the pack, the
  Pipeline page shows a different queue from the one the engine writes.
- The same applies to `keywords.ts` (the reach preview) and `recommendations.ts`, which is computed in the app, so L5 applies there
  and not in n8n.

**Fix:**
- A shared `learning.ts` reader used by both the app copy and the engine kit.
- A harness scenario that compares the Pipeline queue with the engine's plan under a pack.
- Learnings never reorder or skip rungs of an approved ladder, and never override the 2-active-ladder or pile-up limits.

---

## E. Enterprise, privacy, legal

### 21. High — "predictions kept forever" keeps client data after the contract ends (§9 Privacy)

Predictions hold keywords, URLs, Search Console queries (which can contain people's names) and evidence. Keeping them "unless the
company is erased" conflicts with the usual DPA term: return or delete within 30–90 days of termination.

**Fix:**
- On termination plus 30 days, delete every row for that tenant, including the n8n Data Tables (`seo_policy_packs`,
  `seo_page_outcomes`) and the backups on their documented retention.
- Keep only anonymous counts per type and band, with no subject references, as our quality record, and only once k ≥ 5 makes them
  non-identifying.
- Signals are kept 24 months while learnings point to evidence ids. When evidence expires, snapshot its counts into the learning so
  "why" still works.

### 22. Medium — the legal basis for using feedback, sub-processors, PII (§9, D10)

- **Legal basis.** Using one client's data to improve the service for others is a purpose beyond the processor role. It needs a
  contractual right (Terms / DPA) and transparency. The Privacy and Terms pages are still drafts (RESUME), and the 3 clients signed
  up under them.
- **The enterprise questionnaire question.** "Do you train AI on customer data?" needs a written answer: no model training;
  per-tenant statistics; pooled anonymous counts only at k ≥ 5, with opt-out.
- **Sub-processor.** The Reflector sends edit diffs and client notes to Anthropic. That is an existing sub-processor, but a new
  purpose. List it.
- **PII.** "PII stripped" has no detector behind it, only regexes. Send the Reflector **structured diffs** (term X → Y, removed
  heading) and capped, approved notes, never raw text.
- **Data residency.** GCP Doha plus Anthropic US for UAE / EU clients: state it in the security page.

### 23. Medium — RLS is a real infrastructure change, not a line item (§9, P0)

- Migrations run at server start (CLAUDE.md), most likely as the table owner. FORCE RLS needs a split: an owner role that runs
  migrations and a non-owner role at runtime.
- `SET LOCAL` needs every query inside a transaction on a pooled connection.
- `/admin` and the weekly cross-company job need a BYPASSRLS staff role or a loop per company.
- n8n Data Tables have no RLS at all.

**Fix:** RLS as its own reviewed change in P1, before any pooled computation or the Reflector, with isolation tests. P0 tables are
written only by `ingestCallback`, scoped in application code, with a test that company A cannot read B.

### 24. Medium — what an enterprise security review will ask that the plan does not cover

- Who may approve a learning: owner / admin only; client roles in the agency portal (migration 0013); agency staff versus the end
  client.
- A per-company kill switch and a full export of learnings *with evidence*.
- An incident path: "a learning caused harm" → staff revert all learnings of that kind across sites in one action.
- An audit trail of staff labels and staff approvals.
- A records-of-processing entry or a light DPIA.
- A one-page **"model card" per lever**: what it learns, its floor, its guardrail, what resets it, what it can never do.

---

## F. Self-grading integrity

### 25. High — the system can make its own scorecard look better (§3.1, §5.1, §6)

**Gaming routes:**
- **Choosing what to predict.** `predict_lint` checks only that an advice stage carries *some* predictions. Easy predictions can
  stand in for hard ones.
- **Trivial hits.**
  - `cost_est` with the 1.25 headroom of `_cost_cal.js` almost always "hits".
  - A generous default `index_by` deadline always hits.
- **"Not applied" removes bad advice from the score.** Advice a client found wrong and did not act on becomes
  `not_judged:not_applied`, so bad advice raises accuracy.
- **Lost callbacks.** If a callback is not delivered, its predictions and their coverage denominator vanish without a trace.

**Fix:**
1. **Item-level completeness.** Every finding, keyword, page, rung and recommendation in a callback carries exactly one prediction.
   The harness counts items against predictions.
2. The engine writes `predictions_n` to `seo_run_ledger`. The app reconciles the counts and reports any shortfall as a coverage
   loss.
3. Cost and time to index are shown as **distributions** (actual / estimate; days to index), not hit rates. Cost is left out of the
   *advice* scorecard.
4. Split "not applied" into **dismissed as wrong** (counts as a miss for usefulness) and **not done yet**. "Applied" is defined
   mechanically and frozen per row: the publish check found the URL, or the re-check found the fix.
5. Show results **per advice type**, never as one blended accuracy.

### 26. Medium — who audits the auditor (§5.1, §7)

The 20-row monthly audit is done by the same team that builds the system.

**Fix:**
- The append-only rule is enforced by a **database trigger**: no UPDATE except the outcome fields, once; no DELETE except the
  erasure function.
- The rule table in `_predict.js` / `learning.ts` is **pre-registered** (committed, hashed and stamped on each row). Changes apply
  only to new rows.
- Retro predictions are generated mechanically from the frozen payloads *after* the rule table is committed. Then they can count,
  and they need not be excluded.
- The monthly re-derivation is done by an independent clean session, as in the re-ratings. The sample is stratified and must include
  `not_judged` rows, because that is where hiding would happen.

---

## G. Missing pieces

### 27. Medium — what resets a learning, cold start, multi-site, portal, languages

| Event | What should reset | Detection |
|---|---|---|
| New site mid-way | starts from the fixed priors. Company-level learnings (facts, voice, banned terms) are offered to the new site for approval; site-level ones (folds, topic weights, index baselines) are not. | site created |
| Site migration / canonical host change / redesign | finding folds, index-time baseline, edit-diff template baseline | `_site_model` canonical host change; CMS / fingerprint change |
| Services change in the business profile | topic weights; "not our service" facts re-proposed | profile diff |
| Competitor list change | AI-panel rotation state; prospect-type learnings | settings diff |
| A new labeller (the person changes) | nothing automatically. Labels carry the labeller id, and staff can see the change. | user id on the signal |
| Agency portal (0013) | the end client's labels and approvals go through the portal; agency staff labels are recorded as "agency"; all copy is white-labelled (no "Alaventra") | role |
| Multilingual sites | typed rules carry a language; topic clusters are per market; the article-body diff uses a tokenizer that handles Arabic / RTL; reason codes are localised | page language |

The plan names "Reset — you changed your services" but defines neither the matrix nor the detection.

### 28. Medium — operational gaps (§3.3, §8)

- **The weekly job can be missed.** "App job, so no catch-up needed" is wrong on a **spot** VM: preemption drops the Sunday job, the
  same failure class as R94. Make the job idempotent per week key and run it at start-up if the last week is missing.
- **The pack read is bigger than it looks.** Code nodes cannot read Data Tables (R4 §6, R2 §2.4). `PP.load` therefore needs a Data
  Table node, plus wiring, in about 10 workflows. That is state_lint / gate_lint work, not just a kit inlined by the builders.
- **The eval regeneration costs more than the cost table says.** "One sampled regeneration" of a page is ≈ $0.8–1.4, against the
  $0.02–0.05 in the cost table. Use a section-level regeneration, or show the approver a before/after on the last brief. The
  approver is the eval at this scale.

### 29. Low

- **Label revision.** Idempotency on (subject_ref, metric, window) conflicts with a client changing 👍 to 👎. Keep every label and
  count the latest per labeller.
- **Versions.** Version the reason-code lists.
- **Rejected rules coming back.** A rejected Reflector rule can return reworded. Typed rules make the D12 "does not come back" rule
  checkable, and "evidence at least doubles" needs a defined unit (distinct instances, without discounting).
- **P3.** pgvector "already covered" is a cannibalisation feature (the R34 family), not learning. Plan it on its own; do not couple
  it to this roadmap.
- **URL Inspection permissions.** URL Inspection and page × date pulls need the service account on each client's property. Confirm
  the permission level per client in P0.

---

## H. Ordering and owner decisions

### 30. High — decide these before P0 starts

1. **Who labels.** May Alaventra staff label the 3 clients' week-0 findings and keywords as the gold sample? This is recommended,
   and is service delivery under the current terms. For managed clients, who approves?
2. **Will clients be asked at all, and how?** The recommendation is at most 3 one-click questions a week in the digest. This needs
   the production e-mail, which is now on Brevo.
3. **What the week-4 re-evaluation must answer.** Write the questions down now, so P0 records them (finding 15).
4. **The Terms / Privacy line** for recording feedback and using it for that client's service. No pooling until there is a clause
   and k ≥ 5.
5. **Deploy approval and timing.** P0 touches the engine and the app on production with live clients. Deploys are the owner's
   (`deploy_engine.py` over the tunnel), and never in the Monday 07:00–12:00 New York window.
6. **Default mode = suggest only.** This can wait until P2, but should be agreed now so the UI is built for it.

**Defer:** pooling default (§12.2), the holdout (§12.4; answer no for now), the embedding provider (§12.5), the customer-facing name
(§12.6).

---

## Corrected numbers at a glance

| Item | Plan | Corrected |
|---|---|---|
| Audit precision prior | Beta(≈10,1), m ≈ 11 | Beta(3.1, 0.9), m = 4, centred on the live 23/30; precision failures go to staff, not to a fold |
| L1 floor | 3 labels, P(real) < 0.3 | preference: 1 instruction; precision: ≥ 10 distinct instances plus staff confirmation |
| Unknown-rate prior | Beta(2,2) | Beta(2·p0, 2·(1−p0)) with p0 sourced per type; Jeffreys if none |
| Discount | 0.97^weeks for everything | none for static properties; 0.97 for drifting rates, with effective n shown |
| Rule adoption | BH q = 0.10, "fixed horizon" | instructions: no test; inferred rules: e-values + e-BH q = 0.10, family defined in code |
| Confounding | any overlap → not judged | flag only; not judged only if the site's own series moved out of band; binary deadlines never confounded by ranking updates |
| Calibration floor | 25 per band, "months" | ≥ 25 per band (≥ 100 total), counted per ladder; 9–18 months; staff-only until k ≥ 5 |
| Holdout | 1 in 5 per site | none; log shadow decisions; 1–2% platform holdout at ≥ 20 tenants |
| Topic weight bound | ×0.5–1.5 per month | [0.5, 1.5] absolute, ±0.25 per month, exploration floor of 1 item a month |
| Pooling | all opted-in sites | k ≥ 5 tenants, n ≥ 30 per bucket (R2) |
| L8 first possible | week 2–4 | per page from week 4; per page type at 3–6+ months |

---

## The minimum viable P0 (this week, about 2–3 sessions, no behaviour change, no marketing claim)

1. **Pre-register.** Commit the rule table (`learning.ts` + `_predict.js`): advice types, check dates, score rules, floors, priors,
   reason codes. Hash it. Every later row carries the hash.
2. **Migration 0015**, scoped in application code, with an A-cannot-read-B test:
   - `learning_predictions`, append-only by trigger;
   - `learning_signals`, with labeller role and an exposure event type;
   - `recommendation_states`.

   FORCE RLS follows in P1 as its own change.
3. **Predictions for the 4 types that resolve within 4 weeks, at item level:**
   - every audit finding (`audit_finding`);
   - every suggested keyword and rung (`keyword_fit`);
   - every written or published page (`index_by`, `first_impr_by`);
   - every ladder rung's band (`rank_band`), which starts its long clock now.

   `predictions_n` goes in the run ledger; the harness counts items against predictions.
4. **Capture what cannot be rebuilt:**
   - live re-check of every new finding at T+7 days (`PW.recheck`);
   - advised URLs added to Page Watch's URL Inspection rotation;
   - the live article body saved at the first publish detection (the edit diff can be computed later);
   - exposure events for findings and keyword suggestions.
5. **Feedback on two artifacts only**, plus recommendation done / dismiss:
   - findings: *not true / true but won't fix / already fixed / not relevant to us*;
   - keywords: *fits / not our service / wrong market / competitor's brand / we already have a page*.

   Up to 3 one-click questions in the weekly digest.
6. **Week-0 snapshot per client** (read-only):
   - reports and settings;
   - Search Console access level and how many months of history exist;
   - schedule fires, failures, deliveries and cost versus credits since onboarding.

   Staff gold-label about 30 findings and every keyword suggestion per client in week 1.
7. **Rebuild predictions mechanically** from `reports.payload` since each client's onboarding, using the committed rule table.

**Not in P0:**
- the scoring job and the "What we learned" page (P1, weeks 2–3);
- `seo_page_outcomes` (Search Console can be backfilled at any time);
- RLS FORCE, pooling, the policy pack, the Reflector and the holdout;
- effect claims;
- vectors.

At week 4 this gives the owner, per client:
- the live-checked precision of findings and the precision of the staff gold labels;
- keyword-fit labels;
- the first index deadlines;
- the cost and reliability record;
- coverage.

None of it is graded by the system that produced the advice.
