# KI review: logic and statistics (independent, adversarial, 2026-11-08)

Scope: the keyword intelligence kit and worker on the frozen snapshot `1e977e8f` (`.claude/worktrees/ki-review`), against DESIGN.md,
CONTRACTS.md, R4_MARKET.md section 6 and R3_PROD_OUTPUTS.md. Read-only on code. The SERP-goto hotfix is out of scope.

Method: every claim below was reproduced by running the real kits (`_fit_gate.js`, `_competitors.js`, `_kw_inputs.js`, `_site_model.js`,
`_serp_url.js`, `_ki.js`, `_ki_io.js`, loaded in the n8n-like sandbox the harness uses) in `node:22-bookworm-slim`, on (a) hand-made
inputs and (b) the stored production rows of the private dump (`seo_sites`, `seo_query_history`), read only. Probe scripts: the session
scratchpad `ki/p1.js` .. `p10.js` (not committed). No personal data is copied here: only keywords, domains and figures already in R3.

## Verdict

**Not ready for Trial on the two production sites.** The arithmetic of the kit is clean (the score is monotone in its factors on the
harness grid, the gate zeroes what it should, determinism holds), but the inputs the worker feeds it on real data, and three rules in
the kit, reproduce most of the R3 failures it was built to fix:

- devaicon's Open edX service is cut from the service list before anything runs, so every Open edX keyword is gated (R3 "open edx
  provider", acceptance A1);
- any business that appears on a service results page is classified as a **direct** competitor, because its "topic match" is computed
  from the seed keyword itself (R3 F11, acceptance A1);
- the competitor seeds are 20 service phrases built from stored sentence fragments ("crm and project operations. we uae"); Search
  Console, tracked and ladder seeds never make the cap (R3 F2);
- Win has a constant Strength in every keyword research run, so "Go" is impossible for anything the site does not already rank for and
  every new keyword of a small site is "Hard for your site now" (R3 F3 in a new form);
- the stored AVOID verdicts are never loaded ("crm for customers" passes), provider homepages titled "Best ERP Company in Dubai" are read
  as lists (false "get onto the lists" actions), and R3's own top target `peppol access point provider uae` is gated as low fit.

The harness passes because its fixtures are cleaner than production: the E2 replay fixture replaces the stored `declared_services`
(sentence fragments, no Open edX) with an expert list that contains "Open edX development and hosting"; the stage accuracy set feeds
hand-typed page types, so `KI.pageType` is never measured; the domain set's "direct" labels are reproduced only through the seed-text
leak described in B2.

2 Blocker, 9 High, 9 Medium, 9 Low.

## Blocker

### B1. The service list on production rows: fragments kept, Open edX cut by a cap of 16
- Where: `n8n/seo-agent/v5/code/_ki_io.js:71-72` (`KIW.services`: `uniq([...declared_services, ...services_json, ...business]).slice(0, 16)`),
  `v5/code/_ki.js:136` (`KI.services`: an array is "kept as given").
- Failing input: the stored `seo_sites` rows. techand `declared_services` / `services_json` are JSON arrays of the R3 #4 fragments
  ("Microsoft Dynamics 365 consulting and implementation in the UAE and GCC: Busines", "CRM and Project Operations. We also do NAV",
  "and UAE e-invoicing (Peppol) and VAT compliance."). KI.services keeps them because the R3 #4 fix only applies to a plain string.
  devaicon's `services_json` has "Open edX Services" at index 20; the cap keeps indexes 0-15.
- Wrong answer (run on the stored rows): devaicon `open edx hosting` -> gate fail `off_topic`; `open edx provider`, `open edx development
  company`, `managed open edx` -> pass with fit 0.297 -> gated `low_fit` (< 0.35). With all 30 stored services: pass, fit 0.9 / 0.603.
  So the Open edX cluster is gated "not something you sell", openedx.org is not a principal, raccoongang / edly / edunext lose their
  topic match: R3's "open edx provider" failure and acceptance A1 recur on production data.
- Why the harness missed it: `harness/fixtures/ki_e2.json` declares `["Custom AI solutions", ..., "Open edX development and hosting", ...]`
  for devaicon and a clean list for techand; the stored rows hold fragments. KI24 builds its context from the clean
  `accuracy/ki_domains.json` client lists.
- Fix: read the services from a confirmed list only (the site model's service pages + an owner-confirmed list), run every array item
  through the sentence splitter as well (an item ending in a cut word or starting with "and" / "We provide" is a fragment), dedupe by
  `KI.key`, and do not cap below the number of confirmed services (cap the seeds, not the fit context). Replay KI24 and KIE2 on the
  stored `seo_sites` values verbatim.

### B2. Competitor TopicSim is read from the seed keyword, so every business on a service SERP is "direct"
- Where: `v5/code/_ki.js:258` (`text = apps.map(a => a.keyword + ' ' + a.title)`), `:265` (direct when sim >= 0.5), `:268` (fallback:
  any domain with appearances and sim 0 or null is `direct`, 0.55).
- Failing input: `classifyDomain('sometravel.com', { ...techand, appearances: [{ keyword: 'dynamics 365 business central company dubai',
  position: 8, type: 'other' }] })` -> `direct`, confidence 0.7 (not "needs review"), "100% topic match with your services". A home
  automation site on devaicon's seed `best automation dubai` (title "Home Automation Dubai | Smart Homes") -> `direct` 0.8. A web design
  agency (`skytechdigital.ae`) -> `adjacent` 40% with the seed text, `direct` with topic 0 without it (the fallback).
- Effect: the seed is built from the client's own services, so the appearance text always matches them; TopicSim (0.20 of Comp) and
  the direct / adjacent class carry no information about the domain. This is R3 F11 ("generic ERP sellers of any brand") by
  construction, and it is also why the accuracy set scores well: its direct cases carry `appearances` with no title, so the label is
  reproduced from the seed words (E1.md section 4 notes `focussoftnet.com` depends on "the seed's own topic share").
- Fix: compute TopicSim from the domain's own text only (titles, snippets, homepage words, its ranked keywords), never the query it was
  found on; with no own text the class is `adjacent` + needs_review, never `direct`; a computed sim of 0 is "not a competitor" (candidate
  with reason), not `direct`. Add negative cases to `ki_domains.json` (generic sellers, off-category businesses ranking on a city word).

## High

### H1. Search Console, tracked and ladder seeds never reach the competitor run (cap filled by service phrases)
- Where: `v5/code/_ki_io.js:79-87` (`compSeeds`: request seeds, then 6 services x 3 phrasings = 18, then products, then GSC / tracked /
  ladders, then `slice(0, 20)`).
- Failing input: the stored techand and devaicon rows (with any GSC list). Result: 20 seeds, all `service`, 3-4 GSC / tracked / ladder
  seeds `dropped`. techand's seeds include `crm and project operations. we uae`, `best post-go-live and managed support dubai`,
  `gp and ax migrations company dubai`; e-invoicing (techand's largest non-brand cluster, R3 F2) is service #8 and is not a seed.
  devaicon's include `ongoing managed it support. every uae`, `best automation dubai`.
- Fix: interleave by evidence (top GSC non-brand queries first, then tracked / ladder heads, then at most 2 phrasings per service), cap
  per source, and refuse a seed that is not a plausible search (punctuation inside, > 6 words from a fragment, a single generic word).

### H2. Strength is never measured in keyword research: Win degrades to the Search Console position
- Where: `v5/code/KI_Research_Result.js:42` (`siteCtx` has no `refdomains` / `rank`; top10 items carry none), `v5/code/_ki.js:565-570`
  (unknown -> 0.5).
- Failing input: any keyword research run. A new keyword with an all-provider (on-intent) results page and no ranking: Win 0.175 ->
  "Hard for your site now"; with 4 off-intent results, 0.255 -> Hard. Without an existing rank Win can never exceed 0.575, so "Go" needs a
  current GSC position (the harness asserts this as KI13). On techand's 100 stored GSC rows: go 2, months 63, hard 13, and the bucket is
  set by the GSC position (<= 50 -> 0.5 + topical -> months; > 50 -> 0.375). On devaicon every unranked keyword is Hard.
- Effect: the verdict is a function of the client's current position plus a constant, presented as a judgement of difficulty: the
  R3 F3 complaint ("labels read as a judgement but are a default") inverted from "Reachable" to "Hard".
- Fix: pass the client's referring domains (already bought in the competitors run: `ki:<site>:rd:<client>`) and the top 10's (bulk
  referring domains for the read hosts, already priced) into `win`; when Strength is unknown, say "unknown" (a fourth verdict state or
  "not judged yet"), never Hard; widen the range by the unknown spread (see M1).

### H3. Provider homepages titled "Best X Company in Dubai" are typed as lists: false "get onto the lists" actions
- Where: `v5/code/_ki.js:275` (`LIST_T`: `best|top|leading ... (companies|...|software|solutions|services...)`), `:288`, `:253`
  (classifyDomain `publisher_list`), `:746` (pageAction list at >= 50%).
- Failing input: `pageType({ domain: 'brainsphereit.com', title: 'Best ERP Software Company in Dubai | BrainSphere' })` -> `list`;
  "Leading CRM Solutions Provider in Dubai" -> `list`. A results page of 10 provider homepages with the usual UAE titles ("Best ERP
  Company in Dubai | P1", "Top ERP Solutions Provider in UAE", "Leading ERP Software Company Dubai") -> 5 typed `list` -> stage
  `compare` -> `pageAction` = `list`, and `list_hosts` are the competitors' own sites. `classifyDomain('brainsphereit.com')` ->
  `publisher_list` (not a competitor).
- Effect: R3 F5 inverted: a hire SERP of service pages gets "get onto these lists" pointing at rival companies.
- Fix: a list needs a plural seller noun or a number ("Top 10 ...", "best ... companies / firms / agencies / partners"), not "best X
  company" / "leading X provider" (singular = a provider describing itself); a homepage URL (`/`) with a singular seller title is a
  provider. Measure `pageType` itself on labelled titles (see M8).

### H4. Stored AVOID verdicts are never loaded
- Where: `v5/code/KI_Plan.js:30` (`fitCtx` has no `avoid`), `KI_Research_Candidates.js:87`; `KI.gate` supports `ctx.avoid`
  (`_ki.js:405-407`) but no node, kit or build step passes it (grep `avoid` over `KI_*.js`, `_ki_io.js`, `build_ki.py`: none).
- Failing input: techand stored services + `crm for customers` -> gate pass, fit 0.45 -> scored, verdict "Takes a few months", eligible
  for a plan action (its page exists, so `refresh`). DESIGN 8 / R3 acceptance: "crm for customers (AVOID) never becomes a page without
  an explicit override". KI24 passes only because the test injects `avoid` itself.
- Fix: load the AVOID / "clearly low" verdicts (keyword checks, content log, ladder rungs) in KI Plan and pass them as `fitCtx.avoid`;
  add a KIE2 replay assertion on the stored rows.

### H5. The chosen competitors' brand searches pass the gate
- Where: `v5/code/KI_Plan.js:30` (`competitors: declared`, not `chosen`), feeding `KI_Research_Candidates.js:60-62` (300 ranked keywords
  per chosen competitor as candidates).
- Failing input: `KI.gate('velosio dynamics 365', techandCtx)` -> pass; `randgroup business central`, `dynamicssquare`, `intwo cloud
  dynamics 365`, `dynamics square uae` -> pass. With the chosen set in `competitors` all five fail `other_brand`.
- Effect: competitor brand queries become candidates, "untapped" gaps (one competitor ranks) and plan actions ("Write a page for
  'velosio dynamics 365'").
- Fix: `competitors: uniq([...declared, ...chosen])` in `fitCtx`, and pass the read SERP's top domains as `serp_domains` when a row
  has one.

### H6. False "missing" / "untapped" gaps: an unknown client position is treated as "not in the top 100"
- Where: `v5/code/_ki.js:778-784` (`absent = pos == null || pos > 100`), `KI_Research_Result.js:53-54` (rows without a results page use
  `labsTop`: the chosen competitors' Labs positions only, never the client's).
- Failing input: `KI.gaps({ domain: 'techand.ai' }, ['randgroup.com', 'velosio.com'], [{ keyword: 'dynamics 365 partner uae', gate:
  'pass', top10: [{ host: 'randgroup.com', pos: 3 }, { host: 'velosio.com', pos: 7 }] }])` -> `missing`, `client_position: null`.
  The same happens with a results page read at depth 10 when the client ranks 11-100 and the query is outside the top ~100 Search
  Console rows (the stored history keeps ~100 rows per window): "missing" instead of "weak". Rows from the competitors' ranked keywords
  are not filtered for the client (only page_intersection excludes it).
- Fix: "missing" only when the client is measured absent (client ranked keywords from Labs for the same keyword, or a depth-100 read);
  otherwise a separate state "your position not read" without an action; label the depth.

### H7. Search Console impressions replace volume even on page 3-6, and the demand floor is not monotone
- Where: `v5/code/_ki.js:530` (impressions win whenever > 0), `:531`, `:538-541` (floor 0.15).
- Failing inputs: `demand([{ stage: 'hire', volume: 1000, gsc_impressions: 5 }])` -> 0.041; the same row without GSC -> 0.686. Impressions
  are censored by the client's own position (a result at #50 is rarely seen), so having Search Console data lowers the score of exactly
  the "weak" keywords the client should push. Floor: `volume: 0` (the provider measured zero) with PAA + related -> 0.15 and the note
  "evidenced, volume not measured"; `volume: 5` -> 0.038, `10` -> 0.07, `30` -> 0.158. A measured zero outranks a measured 10, and is
  labelled "not measured".
- Fix: use impressions as volume only when the average position is <= 10 (else `max(impressions-scaled, provider volume)` with the basis
  of the one used); apply the floor only to `volume == null`, never to a measured 0; count PAA and related from the same results page
  as one family.

### H8. Fit by token share gates R3's own top targets
- Where: `v5/code/_ki.js:419-420` (Fit = `fitEvidence` share of the keyword's own words) with `fit_gate` 0.35 (`KI_Research_Candidates.js:89`).
- Failing input: with the CLEAN expert service list (harness `ki_domains.json` techand), `peppol access point provider uae` and
  `peppol access point service provider uae` -> fit 0.25 -> gated `low_fit` ("too far from what you sell"); `pint ae validation rules`
  0.297 -> gated. On the stored rows also `pint ae mandatory fields` (77 impressions, #33.7) and the long cost query at #8.4 (R3 section 6
  item 5) are gated. R3 section 6 item 1 names `peppol access point provider uae` as techand's first target.
- Fix: score Fit on the service-bearing tokens (a keyword that contains a declared service or product term is in topic; extra
  qualifier words must not dilute it), and never gate a query the site already ranks for in the top 20 with impressions.

### H9. Old keyword and gap rows are never superseded, and the app counts them
- Where: `n8n/seo-agent/build_ki.py:241, 244` (upsert by `kw_key` / `gap_id`, no delete, no "superseded" state), `app/server/src/services/kiData.ts:197`
  and `app/shared/src/ki-api.ts:583-602` (summary over every row of the market).
- Failing input: run 1 stores `missing` for keyword K (gap_id includes the type); run 2 finds the client at #5 and stores `strong` for K
  with a different gap_id. Both rows stay `open`; the gaps page shows K as missing and strong, and the summary counts both. Keyword rows
  of run 1 that fall out of the top N in run 2 keep their old verdict and score and are still counted in "Go / Takes a few months".
- Fix: per run, mark rows of the same site x market not written by this run as `superseded` (or delete them, keeping user-set gap
  statuses by keyword key, not gap_id), and have the app read the latest run's rows only.

## Medium

### M1. The printed range is set by constants, not by what is unmeasured
- Where: `v5/code/_ki.js:593` and `:635` (Win forced to +/- 0.15 at least), `:639` (low confidence > 25 points).
- An unknown Strength widens Win by 0.35 x 0.25 = 0.0875, below the forced 0.15, so a run with no strength data prints the same range
  as one with it. On techand's 78 scored GSC rows the ranges are 21-25 points wide and only 2 cross 25; the worker's `low_confidence` is
  in practice `!serp_read` (`KI_Research_Result.js:59`). "Score 36 (24-48)" reads as precise while 35% of Win is a default.
- Fix: propagate each factor's own range (unknown inputs at their full plausible span), drop the forced Win spread when Strength is
  measured, and calibrate the 25-point bar on the distribution (or flag by "inputs not measured" explicitly).

### M2. Striking distance: the small-site test reads the wrong total; a second definition exists
- Where: `v5/code/KI_Plan.js:39` (`siteImpr` = sum of the stored query rows), `_ki.js:722`, `_ki_io.js:33` (`small_site_impr: 2000`,
  unused, vs `small_site_total: 5000` in KI.CONFIG).
- Failing input: techand 2026-11-02: query rows sum to 4,028 impressions, the property total is 8,013 (`seo_site_metrics`, R3). KI calls
  it small, so the bar is 30 impressions instead of 100: `dynamics ax dubai` (43), `microsoft dynamics ax dubai` (32), `pdf vs e invoice
  uae` (38) are striking under KI and not under the stated definition.
- Fix: read the property total from `seo_site_metrics`; delete the `KIW.CAPS` copy.

### M3. Competitor SERP share: unread seeds in the denominator, demand not in the weights
- Where: `v5/code/KI_Comp_Result.js:70` (every seed passed, `top10: []` when missing), `_ki.js:671-672`, `:679`, `:702`.
- Failing input: 20 seeds, 1 read, `x.com` #1 on it -> `serp_share 0.05`, reason "in the top 10 for 1 of 20 of your service searches".
  The design weight `w_k = click demand x stage` is replaced by the fixed seed source weight (service 1, best 0.8, GSC 0.4-1).
- Fix: score over read seeds only and print "of N read (M not read)"; weight by the seed's measured demand and stage.

### M4. The gap factor counts competitors outside the top 10
- Where: `v5/code/_ki.js:615-616` (no position filter); rows without a results page carry Labs positions up to 20.
- Failing input: `KI.gap({ top10: [{ host: 'randgroup.com', pos: 18 }] }, ['randgroup.com'])` -> gap 1.
- Fix: filter `pos <= 10` as `gaps()` does.

### M5. Identical results pages are split when fewer than 3 addresses are keyable
- Where: `v5/code/_ki.js:501` (`min_urls` 3: such rows are their own head, never compared).
- Failing input: two keywords with the same top 10 of which 2 items have a known address (the rest goto links with no host or
  `url_partial`) -> two clusters. Acceptance B4: "identical top 10 never split".
- Fix: compare such rows on what is keyable and merge when the keyable sets are identical and non-empty, or mark both "not clustered"
  rather than heads.

### M6. Only keyword gaps exist: topic / page_type / ai_answer / listing / backlink are never produced
- Where: `v5/code/KI_Research_Result.js:94-95` (`extra` holds only `sample`); no node builds the other inputs; `KI.plan`'s gap branch
  (`_ki.js:824-837`) can never fire in production. The competitors run lists directories and lists but creates no listing gap or action.
- Fix: build at least `listing` (directory / list hosts on service SERPs that name chosen competitors, from the competitors run) and
  `topic` (clusters with >= 2 competitor ranking pages), or remove them from the contract and the UI until built.

### M7. Declared competitors are all "chosen", above the maximum, and stay chosen
- Where: `v5/code/KI_Comp_Result.js:105` (`declared ? 'chosen'`), `KI_Plan.js:24-28` (declared up to 10; `userChosen` = every row with
  status chosen, whatever `status_by`).
- Failing input: 7 declared -> 7 rows `chosen` (max 5), and KI Competitor (Admin) then refuses every new choice; a competitor removed
  from the declared list stays `chosen` (status kept by the stored-row rule).
- Fix: cap declared-chosen at `ki_max_competitors`, the rest `watch`; recompute `status_by: declared` rows from the current declared list.

### M8. The accuracy figures do not measure the risky parts
- Stage set (`harness/accuracy/ki_stage.json`): 86 cases, 48 with no results page (word rules only), and the 38 with one carry
  hand-typed page types, so `KI.pageType` (H3) is outside the measurement. Hold-out 28 cases: 27 of 28 has a Wilson 95% interval of
  82-99%; the 90% bar allows 2 misses.
- Domain set (`ki_domains.json`): hold-out 33 = 9 rejects (text fragments, caught by the host regex), 11 platforms, and 17 of the 18
  non-business hold-out hosts are named in the kit's own host lists (disclosed in E1.md); the 5 direct hold-out cases have no titles, so
  their label comes from the seed text (B2). There is no negative case (a business on a service SERP that is not a competitor).
- Replay fixture (`fixtures/ki_e2.json`): services replaced by a clean list (B1).
- Fix: label titles and URLs end to end (raw item -> pageType -> stage), add negative competitor cases, replay on stored values verbatim,
  report intervals next to the percentages.

### M9. Competitor rows outside the kept 20 / 15 are neither updated nor removed
- Where: `v5/code/KI_Comp_Result.js:115` (a domain seen this run is skipped by the miss loop) and `:123` (only the top 20 scored /
  15 unscored are written).
- Failing input: a stored candidate that ranks 21st this run: not rewritten (old score, old `last_seen`), no miss counted, never dropped.
- Fix: write a miss (or a `last_seen` update with `status: candidate`) for every seen-but-not-kept row.

## Low

- L1. `KI.key` joins a single letter before removing stop words: `what is a crm company` -> `acrm company is what`, `what is crm
  company` -> `company crm is what` (not merged); order-insensitive keys merge opposite migrations (`sap to dynamics 365 migration` =
  `dynamics 365 to sap migration`). `_ki.js:121-124`. Fix: drop stop words first; keep `to` / `from` order for migration pairs.
- L2. `value`: CPC 0 -> value 0, below an unknown CPC (0.5): knowing less scores higher. `_ki.js:607`. Treat 0 as missing for low-volume
  B2B rows or label it.
- L3. `top10_json` drops `exact` / `url_partial` (`KI_Research_Result.js:112`): any later re-cluster from stored rows keys recovered and
  partial addresses as exact.
- L4. `top10Of` types pages without the principal context (`_ki_io.js:137`): Microsoft documentation (`learn.microsoft.com`, "Business
  Central documentation") is `vendor`, not `guide`, which pushes product queries toward "solution".
- L5. Refresh targets: `page = gp[0]` (`_ki.js:745`) is the first member's Search Console page, which for techand's ERP cluster is the
  blog post `/insights/is-microsoft-dynamics-365-an-erp-system` for commercial queries (`dynamics 365 erp services`, `microsoft dynamics
  erp partner`); R3 section 7 item 6 says never point a service head at a blog URL. Choose by page type and stage, flag the blog.
- L6. Plan: dedupe is by `kind|title` (`_ki.js:838-840`), so two clusters on one URL give two "Improve your page" actions with the same
  target (probe: `dynamics 365 partner uae` and `microsoft dynamics 365 partner in uae` both -> `/partner`); a `refresh` can carry an
  empty target (`pageAction` returns refresh with `page_url: ''` when only a non-exact own result is found, `_ki.js:749`). Dedupe by
  target, drop or rephrase target-less refreshes.
- L7. `sample_note` ("sample of N of M") is attached to every keyword gap, including striking rows from Search Console
  (`KI_Research_Result.js:97`).
- L8. A missing Win is `hard` in both the kit (`_ki.js:645`) and the app mirror (`app/shared/src/ki.ts:99-104`); it should be "not judged".
- L9. The design's borderline re-read (shared == T or T-1) is a flag only (`_ki.js:504-506`); Fit's results-title term
  (`fit_title_weight`) is never used because the worker computes Fit before any results page is read (`KI_Research_Candidates.js:88`).

## Section answers

1. Scoring: monotone in each factor (harness grid, confirmed), gates correct, owner example 0 / 43 reproduced. Not honest end to end:
   the range ignores unknown Strength (M1), demand is position-censored and the floor is non-monotone (H7), Win degrades to the GSC
   position with a constant Strength (H2). AIO loss is applied by stage with an unknown-AIO midpoint; a page read without an overview is
   taken as a measured "no overview" (narrow range), acceptable. No path lets a model-typed number decide (no LLM in the worker).
2. Clustering: head-based, no chaining, deterministic ids (hash of the head key): confirmed. URL keys are host-agnostic (www, scheme,
   slash, query dropped); recovered addresses keyed by host + path, partial ones dropped. Gap: identical SERPs with < 3 keyable addresses
   split (M5); 240 of the 300 top-N rows are never read, so they never cluster and duplicates survive into the plan (L6).
3. Intent / stage: rule order is sensible, but page typing misreads the typical UAE provider title (H3) and the accuracy set does not
   test page typing (M8).
4. Competitors: google.com, fragments, own site rejected (confirmed); platforms / directories / principals tagged. Direct / adjacent
   carries no information (B2); seeds are fragments (H1, B1); the >= 50 ranked keywords gate for the client's domain overlap is
   implemented (`KI_Comp_Profile_Requests.js:16-17`); user statuses kept; declared overflow (M7); stale rows (M9).
5. Gaps: false missing (H6), stale contradicting rows (H9), only keyword types (M6), sample note honest about the intersection sample but
   attached everywhere (L7).
6. Page action / cannibalisation / striking: list rule right in principle, wrong on titles (H3); cannibalisation needs two GSC pages
   across members (single-query splits are not visible in the stored history); striking threshold reads the wrong total (M2).
7. R3 walk on the stored data: table below.
8. Plan: ranked by midpoint x kind x verdict; duplicates by URL and target-less refreshes (L6); "Start" is 501 (OPEN O3, known);
   AVOID not enforced (H4); competitor-brand actions possible (H5).

## R3 regressions on the stored data

| R3 | Would KI now get it right? |
|---|---|
| F1 wrong market (devaicon in Pakistan) | Yes. `seo_sites.country` is the UAE for both sites; a Pakistan request is refused `market_mismatch`. |
| F2 Search Console ignored | Partly. GSC rows are candidates and rank first (techand's AX / cloud migration / Peppol PINT rows lead the scored list), but GSC never seeds the competitor run (H1), and `peppol access point provider uae` plus several PINT AE rows are gated low fit (H8). |
| F3 reach is a constant | No, in a new form: Strength is a constant, verdicts follow the GSC position; devaicon gets Hard everywhere (H2). |
| F4 services mis-parsed | No on production rows: fragments kept, Open edX cut (B1). `erp software uae` now passes (yes). |
| F5 list SERPs answered with service pages | The rule exists, but provider titles are read as lists, so false list actions appear (H3). |
| F6 one URL for four searches | Flagged when two GSC pages compete; refresh can still target the blog URL for commercial queries and the plan repeats one URL (L5, L6). |
| F7 AVOID overridden | No: AVOID is never loaded (H4). |
| F8 menu labels as keywords | Yes (they are not a KI source). |
| F9 / F10 generic and informational drift | Mostly yes: `what is a crm company` is gated too broad; stage weights push info rows down. |
| F11 competitors from one generic SERP | No: 20 fragment seeds and seed-text topic match make any ranking business direct (B2, H1). google.com and fragments: fixed. |
| #9 google.com / fragments stored | Yes, rejected. |

## Fix order

B1 and B2 first (they decide every other output), then H1, H4, H5 (inputs), H2 and H7 (the numbers), H3 and H8 (typing and fit), H6 and
H9 (gaps and stale rows), then the Medium list. Re-measure with a replay on the stored `seo_sites` / `seo_query_history` values verbatim
and end-to-end labelled titles before Trial.

## Re-review of 3a990e62

Same method as above: my probe scripts (scratchpad `ki/p1.js` .. `p15.js`) re-run on the new kits in `node:22-bookworm-slim`, against
the stored production rows (`seo_sites`, `seo_query_history`, `seo_content_log`, app `keyword_checks` / `reports`), read only. The
fixer's replay (`fxl_replay/`) was read only for its inputs, not its conclusions. One difference matters: it built the `avoid` list from
content reports only, while the app also sends keyword checks (N1).

### Verdict

**Not ready for a Trial run yet, but close.** All the original Blockers are fixed, and so is every High except two new ones that the
fixes introduced. Both fire on devaicon's real data and would distort the owner's Trial comparison on its main niche and its main money
searches. Both are small fixes. After N1 and N2, a Trial on both sites is reasonable; N3 should land before On.

### Status of the original findings

| Finding | Status | Evidence on the new kits |
|---|---|---|
| B1 services | Fixed | techand 37 clean services, devaicon 32 with "Open edX Services". devaicon `open edx hosting` / `provider` / `development company` / `managed open edx` pass with fit 0.9 (were off_topic / low_fit 0.297). |
| B2 topic from seed text | Fixed | `sometravel.com` (no title) -> adjacent 0.4, needs review. Home automation site -> adjacent 0.17. brainsphereit / skytechdigital -> adjacent 0.35 (topic 0, not counted). Real partners with realistic titles -> direct 0.8: randgroup, dynamicssquare, intwo, velosio, penieltech, raccoongang, edly, edunext, carmatec. bayzat's "Top 15 CRM Software" -> publisher_list. |
| H1 seeds | Fixed | techand: 6 GSC (PINT AE / Peppol), 2 tracked, then services; e-invoicing and Peppol are seeds. devaicon: 3 GSC, `open edx services uae` / `... company dubai`. Remnants under Low. |
| H2 Strength | Mostly fixed | Referring domains are now read in the research run, and Go is reachable. Remnant in M-N4. |
| H3 list titles | Fixed | "Best ERP Software Company in Dubai", "Leading CRM Solutions Provider in Dubai" -> provider. 10 provider homepages -> stage hire, action new. "Top 10 CRM Companies" is still a list. |
| H4 AVOID | Fixed for content verdicts | `crm for customers` arrives in the app's list (`payload.verdict = AVOID`) and is gated `avoid`. But see N1. |
| H5 rival brands | Fixed, over-corrected | `velosio dynamics 365` etc. -> other_brand. But see N2. |
| H6 unknown position | Fixed | Unknown client position -> no gap row, counted in `gaps_position_unread`. |
| H7 demand | Fixed | 5 impressions at #60 with volume 1000 -> 0.686 (volume used). Measured 0 -> 0. Floor with PAA + autocomplete = 0.031, below volume 10 (0.07). PAA + related is one family. |
| H8 fit | Fixed | `peppol access point provider uae` 0.85, `pint ae validation rules` / `mandatory fields` 0.765. A query ranking at #20 or better with impressions is never low_fit. |
| H9 stale rows | Fixed in principle | Old rows are deleted and the app reads the latest run only. See N3. |
| M1 range | Fixed | The range now follows the Strength span: unknown 0.088-0.262 vs known 0.14-0.21. On techand GSC rows, 18 of 83 are low confidence. |
| M2 striking total | Fixed | Reads `seo_site_metrics` (techand 8,013 -> bar 100). Consequence: none of techand's stored rows is "striking" by the definition (`dynamics ax dubai` 43 impressions). They still rank first through their GSC position. Owner should know. |
| M3, M4, M5, M7, M9 | Fixed | Share "1 of 1 read (19 not read)". gap factor ignores #18. Identical 2-key and partial-URL pages now join. Declared competitors capped at the max. Seen rows rewritten. |
| M6 | Skipped | The app hides those gap kinds. Acceptable for Trial. |
| M8 accuracy sets | Partly | Titles and negative cases added. The replay still did not use the app's real avoid inputs (that is how N1 was missed). |
| L1, L2, L3, L5, L6, L7, L8 | Fixed | Probes: keys merged and direction kept, CPC 0 = unknown, plan dedupes by target and drops target-less refreshes. |
| L4 docs page type | Not fixed | `learn.microsoft.com` "Business Central documentation" is still `vendor`, even with the services context. Low. |
| L9 | Skipped | Agreed: no gain on today's data. |

### New findings (introduced by the fixes)

**N1 (High). The app's avoid list carries the old engine's wrong "fit 0" verdicts, so devaicon's main niche keyword is gated.**
- Where: `app/server/src/services/runs.ts:1091-1113` (`kiAvoidKeywords`: every keyword check with `fit = 0` OR `navigational = true`)
  -> `KI_Input.js:17` -> `KI_Plan.js:47` -> `fit_ctx.avoid`.
- The input: the stored `keyword_checks`. devaicon has 6 checks of `open edx provider`. Five have fit 0, one is navigational. These are
  exactly R3's wrong verdicts: fit 0 came from business text that never mentions Open edX.
- The wrong answer: `KI.gate('open edx provider')` and `'open edx providers'` both fail with reason `avoid`, worded "you or our check said
  not to write it". The rule also blocks them as seeds.
- Fix: send only explicit AVOID verdicts (content / check verdict AVOID, or a client's own "not for me"). A `fit = 0` from the pre-KI
  check is the very bug KI replaces and must not be imported. Replay with the app's real `kiAvoidKeywords` output.

**N2 (High). Exact-match-domain rivals now gate the generic money searches.**
- Where: `KI_Plan.js` (`knownRivals` = every stored direct / adjacent row, up to 60, into `fit_ctx.competitors`). It is used on seeds,
  candidates and ladder heads (FITR).
- The input: the real devaicon rival `softwarecompany.ae` (R3 section 3). It is now classified direct from its own title "Software
  Company in Dubai", so it is stored.
- The wrong answer: `software company in uae`, `software company dubai` and `custom software company dubai` all fail `other_brand` ("names
  a competitor: softwarecompany"). Any UAE exact-match domain made of service words does the same (probe with `crmsoftware.ae`,
  `businesscentral.ae`, `peppol-uae.com`: `crm software dubai`, `business central partner dubai`, `peppol uae` all gated). The real
  techand hosts tested do not trigger it. `dynamicssquare.com` only gates the brand search "dynamics square", which is right.
- Fix: a rival's label counts as a brand only when it is not made entirely of service, product, category, generic or place words (the
  same filter `fitOwnLabels` applies to the client's own domain). Keep the label check for distinctive names (velosio, randgroup, intwo).

**N3 (Medium). The supersede delete runs even when the save failed, and it drops user gap statuses.**
- Where: `build_ki.py:258-267`. `Save KI Keywords` uses `onError: continueRegularOutput` and `alwaysOutputData`, then `Drop Old KI
  Keywords` and `Drop Old KI Gaps` run unconditionally (`run_id neq` this execution).
- The wrong answer:
  - A failed upsert (for example the new `gate_detail` column not yet synced, or any table error) still deletes every earlier row. The
    site ends with no keyword or gap rows, and the run row says `ok` / `partial`.
  - A partial run (Labs discovery missing) replaces a full run's ~300 rows with its few.
  - A dismissed or started gap whose keyword is not in this run's top N is deleted, so the client's choice is lost and the gap reopens
    later. CONTRACTS section 2 says user statuses are kept.
- Fix: delete only after an `If` that checks the save returned no error item. Keep rows that have a user status (or carry them as
  `superseded`). Optionally, do not supersede a full run with a partial one that wrote fewer rows.

**N4 (Medium). An unknown Strength still produces "Hard" for an unranked keyword.**
- Where: `_ki.js:716-718`. The unknown span is +/- 0.25, not 0..1.
- The wrong answer: `win({ keyword: 'open edx hosting', stage: 'hire', top10: 10 provider pages }, { domain: 'devaicon.com' })` gives
  Win 0.175 (0.088-0.262), `strength_known: false`, verdict `hard`. With Strength 1 the Win would be 0.35, which is "Takes a few months".
  So "Hard for your website now" is still printed from a default whenever the referring-domain read fails.
- Fix: use the full 0..1 span when unknown, so such rows become `unknown`.

**Low (new or remaining)**
- GSC seeds take 1-impression queries ("autonomous customer story"), and some service seeds are single ambiguous words ("nav uae", "nlp
  uae", "crm uae"). `KIW.compSeeds` should require a minimum number of impressions and 2+ content words.
- `focussoftnet.com` (labelled direct) with the title "Best ERP Software in Dubai, UAE | Focus Softnet" -> adjacent, topic 0, while
  "ERP Software Dubai | ... | Peniel Technology" -> direct 0.8. Something in the title segmenting drops its words.
- The plan treats `unknown` like `hard` (`verdict_mult` has no `unknown` key, so it falls back to 0.4). Acceptable, but say so in the why text.
- The content-log avoid regex `\bAVOID\b` is case-insensitive (`KI_Plan.js:46`), so any QA note containing "avoid" would mark the page's
  keyword AVOID. No stored row hits this today. Match the verdict field, not free text.
- `keepRows` now keeps every stored row (`KI_Comp_Result.js:137`). Growth is bounded only by the two-miss drop.

### Before Trial

Fix N1 and N2. Replay with the app's `kiAvoidKeywords` output for both sites. Then run Trial. N3 and N4 before On.
