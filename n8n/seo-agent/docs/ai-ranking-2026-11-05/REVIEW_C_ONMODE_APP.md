# Review C: AIR wave 2, package P6 (on-mode consumers, app, marketing)

Reviewer: independent (did not write P6). Date: 2026-11-06. Snapshot: `air/integration` at `e1987a72` (worktree `.claude/worktrees/air-review`),
P6 commits `0332aee7..d201968a`. Read-only on the code; nothing committed, pushed or deployed; no paid call; production not touched.

## 0. Summary

P6 keeps its main promise to websites that are not `on`: off, trial and kill-switch runs are byte-identical in the engine harness, the listings
checklist and the AI Growth report are unchanged for them, no migration is needed, and the old app ignores the new callback key. The problems
are all on `on` websites and in what clients see:

- The weekly memo is rendered raw to clients (engine report and app): internal ids, "AIR", statistical jargon and provider dollars reach the
  customer, past the app's customer-safe filter (RC-1).
- The cadence can rewrite one page twice in one week, and can write a new answer page for a search a page of the same run already targets
  (RC-2).
- Six of the seventeen levers ask the client for an address that nothing in the app collects, so those steps can never be marked done, while
  the guides tell the client to "add the address on the step" (RC-3).
- Any company owner or admin can switch a website to On (and buy the reserved slot) before the owner's shadow gate, from a card shown on every
  website (RC-4).
- A client's approval of a protected item is silently ignored at level 2 and 3 (RC-5).

Recommendation: fix RC-1 to RC-5 before any deploy; RC-6 to RC-9 before rollout step 3 (devaicon.com to On).

## 1. Checks I ran

| Check | Result |
|---|---|
| Engine harness, scratch copy of the snapshot in a throwaway `n8nio/n8n:2.41.4` container | **17,162 passed, 1 failed**. The failure is CY32 ("deploy_guard.mjs copied into the harness by build section 140 loads -> run build_v4.py first"): environmental, my copy was not rebuilt. Every AIR scenario (AE1 to AE5, AP*, AIRW0*) passed. |
| App, `node:22-bookworm-slim`, `npm ci`, `npm run typecheck`, `npm test` | typecheck clean; shared **1,101** passed, server **1,833** passed / 46 skipped, web **311** passed |
| Reviewer probes (scripts in my scratch space, through the real `Cadence Plan` node and the shared package) | results quoted in each finding |
| Copy scan of every added line in `app/` and `n8n/seo-agent/v5` for em dash, en dash, curly quotes, ellipsis | none (one hit is a test regex) |
| Migration | none needed: `site_tasks.kind` is `text NOT NULL` with no check constraint (`app/server/drizzle/0024_site_tasks.sql:6`) |

## 2. Findings

### RC-1 (High) The weekly memo reaches clients raw: internal ids, "AIR", statistics jargon and provider dollars

- **Where.** Engine: `n8n/seo-agent/v5/code/Growth_Report.js:42-50` (`airHtml` prints every memo part, every figure and its basis, including the
  `shadow_vs_old` part) and `:137` (the `ai_rank` callback key carries the memo). App: `app/web/src/components/reports/ai.tsx:637-668`
  (`AiRankReportBlock`) and `app/web/src/pages/site/_components/ai-rank.tsx:21-37` (`AiRankMemoView`) print `line.text` and
  `figure.value (figure.basis)`. The text comes from P2's kit, `_ai_rank_learn.js:573-621`, written for the owner's shadow review.
- **Failure.** On an `on` website the client reads, in the e-mailed / stored HTML report, the app report and the AI visibility page:
  - `Question aip_... on ChatGPT: up from "not found" to ...` (`_ai_rank_learn.js:580`, the prompt id, not the question);
  - `air_site_devaicon-com_L05_1a2b3c4d (verified action on this question and engine)` (`:587`);
  - `0.08 (prior mean x engine multiplier)`, `0.12 (AIR's own model, not independent)` (`:598`), `one-sided Fisher exact test below 0.05`,
    `difference in differences, two-level bootstrap`, `S1 (stage last week)`;
  - `AIR drives the plan on this site.` (`:621`, the `shadow_vs_old` part; the app filters that part out, the engine HTML does not);
  - `Not yet: no question has been won after a verified action ($3.10 spent so far).` and the figure `spend_usd` (`:615-616`): **provider dollars**.
  `clientSafePayload` (`app/shared/src/agency.ts:677`) strips cost *keys* only; the dollars sit in `text` and in `figures[].value`, so they
  survive. Since 2026-10-19 no provider cost may reach a customer, the company's own people included (`agency.ts:665-669`).
- **Verified.** Probe through the shared package: `customerSafePayload({ ai_rank: { cost, memo } })` drops `ai_rank.cost` but keeps
  `"($3.10 spent so far)"` and `{"name":"spend_usd","value":3.1}`; `aiRankReportOf` then renders `air_site_devaicon-com_L05_1a2b3c4d (verified action)`.
  Harness AE5 only checks the em dash rule, so it passes.
- **Fix.** Do not render the owner's memo to clients. Build a client view in `Growth_Report.js` (the engine can map prompt ids to question text
  through `Load AI Prompts`, as it already does for `actions`): question texts instead of ids, no figure names, no action ids, no stage codes,
  a plain basis or none, no `shadow_vs_old` part, and cost per won question in credits (or left out) instead of dollars. In the app, render only
  that client view, and add `aiRankMemoOf` sanitising (drop figures whose name ends in `_usd`, strip `$` amounts) as a second line of defence.
- **Test.** Extend AE5 and an app test: the on-site report HTML, the callback memo and the rendered memo contain none of
  `/\baip_|\bair_[a-z]|\bAIR\b|Fisher|bootstrap|prior mean|\$\d|_usd\b|\bS[0-5]\b/`; `customerSafePayload` of an `ai_rank` payload carries no dollar amount.

### RC-2 (High) One page can be rewritten twice in one week, and the reserved page is never checked for "one search, one page"

- **Where.** `Cadence_Plan.js:588-591` (and its mirror `app/server/src/services/cadence.ts:1055-1058`): the reserved pick is de-duplicated
  against the week's picks **by keyword only**. It never goes through `uniq` (`Cadence_Plan.js:522`), so `coverOf` (D11, a live page already
  answers the search) and the URL of the week's other refreshes are never compared. `aiEligible` (`:469`) checks only the content log
  (`refreshedRecently`), not this run's picks.
- **Failure 1 (same URL twice).** An AIR L06 refresh of `/crm-implementation/` and the decay refresh of the same page are both started in the
  same run, for two different keywords: two concurrent rewrites of one page. L06 targets "the ranking page", which is exactly the page decay
  and striking-distance refreshes pick. (The level-3 v4.12 AI page had the same keyword-only check; P6 extends it to level 2 and makes it the
  normal case for AIR.)
- **Failure 2 (cannibalisation).** The shared case `air_on_reserve_level2` itself expects, in one week, the decay refresh of
  `/crm-implementation/` for "crm implementation partner uae" **and** a new AIR answer page "crm implementation partner recommendations uae".
- **Verified.** Probe P5 (case `air_on_reserve_level2`, the AIR target turned into a refresh of `https://techand.ai/crm-implementation/`): picks =
  `crm implementation cost uae [ladder]`, `crm implementation partner uae [decay] -> /crm-implementation/`, `crm consulting dubai [striking]`,
  `crm implementation services uae [ai_refresh] -> /crm-implementation/`. Probe P2 reproduces failure 2 on the unchanged case.
- **Fix.** Before `airPick` (and `aiPick`): drop a candidate whose `existing_page_url` (URL key) equals any pick's `existing_page_url` or ladder
  `target_url`; drop a new answer page when `sameSearch` matches any pick's keyword or `coverOf` finds a live page (make it a refresh of that page
  or a suggestion, as D11 does). Apply the same rule in `cadence.ts`, and change `air_on_reserve_level2`'s expectation.
- **Test.** Two new shared cases: AIR refresh of the decay page (one rewrite of the URL, the other a suggestion with the reason), and AIR answer
  page for a near-duplicate of a picked keyword (not written). Both in AE1 and `airCadence.test.ts`.

### RC-3 (High) Six levers can never be marked done: the address the check needs is never collected, while the guides say "add it on the step"

- **Where.** `_ai_rank_learn.js:418-419`: L11-L15 and L17 are verified only from `a.client_url` ("the client gives the URL"). Nothing writes
  `client_url` anywhere (`grep client_url` finds only that kit). The app's check of an `ai_rank` step always answers 409 "The weekly AI ranking
  check confirms this step" (`app/server/src/services/siteTasks.ts:720-721`, `:800`). Guides: `app/shared/src/guides.ts:2000` ("When it is live,
  add its address on the step") and `:1968` ("add the profile address in Link building"; the listings panel has no address input either,
  `app/web/src/pages/site/_components/links/listings.tsx`). Growth Report's own check text says "you give us the address" (`Growth_Report.js` `AIR_CHECK`).
- **Failure.** The client writes the LinkedIn article, gets the press mention, posts the disclosed answer, adds the Wikidata item: the step stays
  "to do", "I've done it, check now" refuses, and after the window plus 14 days the action expires and the step silently disappears
  (`site-tasks.ts` `aiRankDrafts` drops expired actions). The plan then learns from an "expired" action that did happen. Those steps also hold
  slots of the 8 open steps. The marketing line "each with a guide and our own check" (changelog 4.9) is not true for them.
- **Verified.** By reading: no producer of `client_url` in engine or app; the route's `engineOnly` branch throws 409 for every `ai_rank` step.
- **Fix.** Add an address field to the `ai_rank` step (payload `clientUrl`, saved by the site-task route), carry it to the engine (Site Admin or a
  small table the AI Growth run reads into `action.client_url`), and let "check now" fetch that address and look for the business name (as the
  redirect / merge checks do). Until then, do not offer L11-L15 / L17 as site tasks, and fix the two guides and the check texts.
- **Test.** App: a step of L12 with an address whose page names the client is done after "check now"; without one the step shows an address
  field. Engine: `ARL.verify` of an L12 action with `client_url` set reaches `happened: true`.

### RC-4 (High) Any company owner or admin can switch a website to On, and buy the reserved slot, before the owner's shadow gate

- **Where.** `app/web/src/pages/site/SiteSettingsPage.tsx:302` shows `AiRankingCard` on every website; `AiRankingCard.tsx` lets an owner or admin
  pick Off / Trial / On and the reserve; `app/server/src/routes/sites.ts:664` gates only the three paid readings to platform admins.
- **Failure.** DESIGN 4.4 makes `on` a per-site owner decision after four clean shadow weeks, and DESIGN 6.7 says the client-facing parts are
  "held until the owner offers `on` to clients". Once the web deploys, any client can turn On today: AI pages written on top of their pages a
  week and charged, Link Builder order changed, protect holds on their ladders, the memo of RC-1 in their reports. That is the "nothing else may
  breaks" rule's opposite: a new behaviour for live clients that the owner never switched on. Trial is also odd for a client: the card promises
  a plan "kept private", which the client can never see (the trial view is platform-admin only).
- **Verified.** By reading the card and the route; the server test "the paid readings: refused for an owner or admin" confirms only those
  three fields are gated.
- **Fix.** Until the owner opens it: render the card for platform admins only (or behind a per-company or per-site flag the platform admin sets),
  and have the route refuse `mode` / `reserve` from anyone else (403). Hide Trial from clients entirely; it is the owner's tool.
- **Test.** Server: an owner's `aiRank: { mode: 'on' }` gets 403 while the feature is closed for the company; web: the card is absent for a
  non-platform admin.

### RC-5 (Medium) A client's approval of a protected item is ignored at levels 2 and 3

- **Where.** `Cadence_Plan.js:504` (`approvable`) and `:574` (`protOf` skips only `x.approved`); mirror `cadence.ts:928`, `:1026`. An item the
  level writes on its own (an automatic striking-distance or decay refresh at level 2, any active-ladder rung) is not in `approvable`, so the
  client's approval never matches it; protect then moves it to suggestions again.
- **Failure.** The protected item is shown as a suggestion "it is only suggested". The client approves it; nothing is written, the item comes
  back next week, forever while AIR renews the protect entry. P6.md claims "an item the client approved ... is written"; that holds only for
  items that were needs-OK before protect (the level-1 case the shared file tests).
- **Verified.** Probe P1: case `air_on_protect` (level 2) plus an approval row for "crm consulting dubai" (striking): picks = only the ladder page,
  `approved_items: []`, and "crm consulting dubai" is listed again in `air.protected`.
- **Fix.** Add the protected items to `approvable` (build `protectedItems` before the approval match, or match approvals against `uniq` too),
  in both files.
- **Test.** New shared case `air_on_protect_approved_level2`: the approved protected striking refresh is written; the decay one stays suggested.

### RC-6 (Medium) The honour rule writes pages the business does not sell, automatically, at level 2

- **Where.** `Cadence_Plan.js:481-490` (mirror `cadence.ts:901`): `off topic` and `too broad` are bypassed in the reserved slot.
- **Failure.** Level 2 lets the system write only refreshes of the client's existing pages in topic; the reserve now writes new pages that the
  gate calls off topic. The shared case `air_on_reserve_honours_topic` writes "erp consultancy for manufacturers" for a CRM consultancy, with the
  gate's own detail "0% of its own words match what this website sells ... Add it to your services if you do sell it". `off topic` also covers
  "a list of companies in another industry" (`_fit_gate.js:632`) and any `ctx.relevance` refusal (`:635`). A page about a service the client does
  not offer invites claims the facts cannot back and dilutes the site's topic, against the owner's "page quality must never drop" priority.
- **Verified.** Probe P4: the honoured pick, its `why` and the gate detail quoted above.
- **Fix (owner decision).** Honour `too broad` only, or honour `off topic` only when the share is above a floor or the question names a declared
  service; otherwise make the target a suggestion and list it in `refused` with `target_id` so AIR stops proposing it. At minimum, never honour
  the "another industry" variant.
- **Test.** The honours case keeps a CRM-related but broad question written; the ERP question becomes a suggestion.

### RC-7 (Medium) The Link Builder gives up to half of its weekly drafts to AIR's lowest-probability pitches, and ignores the kill switch

- **Where.** `n8n/seo-agent/v5/code/LB_Assemble.js:417` (`readyOrdered`: up to 5 AIR rows first) and `:42-43` (`AIRF.writesSinks(..., false)`: no
  kill switch).
- **Failure.** The writer budget is 10 sequences a week (`LB_Plan.js:14`). AIR's own placement probability is about 0.06 to 0.12 (P6.md §6.5)
  against 0.9 for an unlinked mention and 0.7 for a lost-link reclaim, yet 5 AIR rows are drafted ahead of them every week. On the two clients
  this replaces their best existing link work with AIR's weakest. With `air:kill = 1` (the "all sites, no deploy" rollback of DESIGN 4.5) the
  Link Builder keeps hoisting AIR rows, scoring them with AIR's probability and offering the AIR directories; for a company with automatic
  sending, AIR pitches still go out.
- **Verified.** By reading; the AE4 scenario confirms the hoist ("drafted first (at most 5)").
- **Fix.** Order by expected value (`rankv`) for every row, AIR rows included, and reserve at most 1 to 2 slots for AIR rows only when they
  beat the cut-off; read `air:kill` (one `seo_cache` row) in the Link Builder, or pass the kill flag through `LB Plan` from the monitors load.
- **Test.** AE4: with a mention row (0.9) and five AIR rows (0.1) and a budget of 3, the mention is drafted; with the kill row, the order is
  today's.

### RC-8 (Medium) The service-firm checklist adds software marketplaces to firms that sell no software

- **Where.** `n8n/seo-agent/v5/code/_listings.js:101-102` (`siteKind` with `air`: `consultanc|consulting|outsourc|...` returns
  `['agency','saas']`) and `:70` (`ms_partner_dir` on any page text naming Microsoft or Azure).
- **Failure.** A tax, HR, accounting or management consultancy in `on` mode gets G2, Capterra, TrustRadius, SaaSHub, AlternativeTo, Product Hunt
  and AppSource as "missing" listings, and the Microsoft partner directory when a page says "we use Microsoft 365". These need a software
  product or a partner account: wrong advice in the checklist and wasted client time.
- **Verified.** Probe: `siteKind('tax consulting firm', 'corporate tax registration uae', { air: true })` = `["agency","saas"]` (off: `["agency"]`);
  added listings `g2, capterra, trustradius, saashub, alternativeto, producthunt, appsource, themanifest, sortlist, ms_partner_dir`. Same for
  "management consulting", "HR consultancy", "accounting firm".
- **Fix.** Require a software word together with the service word (`software|app|platform|erp|crm|implementation|integration|development`), and
  gate `ms_partner_dir` on partner words ("Microsoft partner", "Solutions Partner", "Dynamics 365 partner") rather than any Microsoft product.
- **Test.** Extend AE3 with the four consultancies above: on adds The Manifest / Sortlist only.

### RC-9 (Medium) An app deployed before the engine says "AI ranking saved" while nothing was stored

- **Where.** `AiRankingCard.tsx` save; production's Site Admin (`origin/main` `Monitor_Row_Admin.js`) builds an exact-column row and drops
  unknown keys; `Admin_Action.js` on `origin/main` accepts them.
- **Failure.** P6.md §5 says an older Site Admin "refuses or ignores" the setting "and the app shows the error". It ignores it and answers ok, so
  the card shows the success toast, then Off after a reload. Clients would see a broken setting from the moment the web deploys.
- **Verified.** By reading `origin/main` `Monitor_Row_Admin.js` (no `ai_rank_*` column, no unknown-key error) and the card's `onSuccess`.
- **Fix.** Show the card only when the engine has the columns (`settingsData` returns `aiRank` only when the monitors row carries the
  `ai_rank_mode` key, else `undefined`, and the card renders nothing), and re-read after save to confirm the stored mode. This also covers RC-4's
  rollout order.
- **Test.** Server: a monitors row without the AIR keys gives `aiRank: undefined`; web: no card.

### RC-10 (Low) The Pipeline mirror reads at most 50 `air` cache rows across all websites

- **Where.** `app/server/src/services/pipeline.ts:656` (`kind = air`, `max: 50`, no key filter).
- **Failure.** `seo_cache` kind `air` grows by one `air:week:<site>:<week>` row per on site per week plus monthly `air:mentions:*` and
  `air:cc:*` rows, never pruned. After about 25 weeks with two on sites, a newly-on website's protect row or a later `air:kill` row falls past
  the first 50, and the Pipeline shows a plan the engine will not run (protected pages listed as "will be written"). Each Pipeline load of an on
  site also pulls up to 50 large week rows.
- **Fix.** Two reads by key: `air:protect:<site>` and `air:kill`.
- **Test.** Unit: with 60 week rows before the protect row, the mirror still holds the protected page.

### RC-11 (Low) A retry inside the same cycle loses a page because the reserved page is counted against pages a week

- **Where.** `Cadence_Plan.js:555-565` (`spend` counts every `cad_` content-log row in the window).
- **Failure.** After a crash, the retry counts the reserved page (which was on top) against `pages_per_week`: one ordinary page is dropped.
- **Verified.** Probe P3 (`air_on_reserve_level2`, ladder and AIR pages `started`): retry `spent 2, room 1`, picks only the decay refresh; the
  striking-distance refresh of the first run is lost. Same as the level-3 v4.12 page before P6.
- **Fix.** Do not `spend` content-log rows whose source is `ai_answer` / `ai_refresh` (the on-top pages), in both files.
- **Test.** The retry case writes decay and striking.

### RC-12 (Low) The trial view is unreachable for client companies the platform admin is not a member of

- **Where.** `app/server/src/routes/data.ts` `rank-shadow` uses `siteAccess` (membership) before `isPlatformAdmin`; the panel lives on the
  client's own AI visibility page.
- **Failure.** If devaicon.com and techand.ai are separate client companies, the owner cannot open the comparison DESIGN 4.4 asks him to judge
  in the app (the private `ai_rank_shadow_report.py` still works).
- **Fix.** Serve it from the platform admin panel (`routes/admin.ts`, cross-company), or let `isPlatformAdmin` pass `siteAccess` for this
  read-only route.
- **Test.** A platform admin who is not a member gets the weeks; a member who is not a platform admin gets 403.

### RC-13 (Low) Marketing announces a feature that is not live and is off by default

- **Where.** `app/web/src/marketing/content/changelog.ts:38` (4.9, dated 2026-11-06), `features.ts` (two benefits and an FAQ under AI growth),
  guided-setup count 94.
- **Failure.** The web deploys on merge to main (Vercel); the engine and the owner's switch come later. The entry says "A new opt-in setting per
  website" and "Choose Off, Trial or On in Website settings" as shipped, and "each with a guide and our own check" (false for RC-3's levers).
  CLAUDE.md allows only shipped capabilities.
- **Fix.** Hold both entries until the engine is deployed and the owner opens On to clients (RC-4), or word them as "rolling out to selected
  websites; ask us to join"; drop "each with ... our own check" until RC-3 is fixed.
- **Test.** Marketing consistency test (if any) plus a read of the rendered changelog.

### RC-14 (Low) Small things

- `app/shared/src/index.ts:61`: the site-tasks comment moved onto the `ai-rank` line (`export * from './site-tasks';` lost it). Cosmetic.
- The engine's lever labels win over the app's client words: `aiRankActionOf` uses `a.label` first, so the app shows "Own answer page for the
  searches the engines run" and "Content in raw HTML (server render)" (`Growth_Report.js` `AIR_LABEL`) instead of `AI_RANK_LEVER_LABELS`. Prefer
  the app's labels by lever.
- `aiData` returns `aiRank.cost.usd` to company people (the page shows only the basis); drop the number per the credits rule.

## 3. What I checked and found sound

- Off, trial, empty and on-plus-kill: all 66 keyword-first cadence cases byte-identical (AE2), listings off identical (AE3), report and callback
  identical for every non-on website (AE5).
- The reserve: on top of pages a week, at most one a week, inside `ai_pages_month`, held by the pile-up guard, while waiting for the first keyword,
  for a missing author profile and at 0 pages a week; the ordinary AI target becomes a suggestion. Ladders are not starved by the reserve (it is
  on top); a protected rung is skipped and the ladder's next rung is written.
- Safety refusals (own brand, other brand, government, portal, job search, navigational, other market, empty) still refuse in the reserved slot
  and are listed with `target_id`.
- Engine and mirror implement the same rules (the shared case file passes on both sides).
- Permissions: mode and reserve need the `admin` site role (members and viewers refused); paid readings are platform-admin only (403);
  the trial route is platform-admin only; every read is scoped by the site's domain through `siteRows`.
- Old app with new engine: the `ai_rank` key is ignored; no site-task row of the new kinds exists without the new app; an older app ignores
  stored rows of unknown kinds in its daily check. New app with old engine: AIR tables missing read as no data (but see RC-9).
- Schemas: `aiRankSettingsSchema` is strict and optional-only; the Site Admin body names match `AIRF.validate` exactly (no fuzzy matching on
  this path); `export:payloads` fixtures unchanged.
- `ai_export`: done only when this month's `bing_ai` and `gsc_ai` uploads exist (UTC month); "check now" reads fresh.
- Copy: no em dashes, curly quotes or ellipses in new text; no vendor or model names in the new app screens (the leaks are the memo of RC-1).

## 4. Leader claims: true / not yet

Judged from what the code at `e1987a72` actually does for an `on` website, against R2 §6 / §8 and DESIGN §3.

| Claim (R2 §8 / DESIGN §3 row) | State | Why |
|---|---|---|
| 1. Per-question stage diagnosis that drives the lever (row 1) | **Built, not yet a lead at default settings** | The stages exist (P1) and drive the lever choice. But the retrieval basis needs fan-out reads, which stay off by default (`ai_rank_fanout_n` 0, platform admin only), and the client sees the stages only as "Question aip_..." lines (RC-1). |
| 2. Impact with controls on every action (row 15) | **Not yet** | DiD, placebo and pre-registration exist in ARL, but six levers can never be verified (RC-3), so "every action" is false; L08/L09 depend on our page reads. |
| 3. Learning loop with a published method (row 16) | **Partly** | Beta-binomial priors pooled across sites with Brier scores are built. The method and its accuracy are not shown to clients or on the site; with two sites and a 12-week holdout the priors will not move for months. |
| 4. Off-site work carried through to the result (rows 3, 6) | **Partly true** | AIR placements reach the Link Builder (approval, own mailbox, "won" only when named). But they are AIR's lowest-probability pitches pushed ahead of better ones (RC-7), review asks are not built, and earned mentions cannot be verified (RC-3). |
| 5. B2B services directory and review programme (row 8) | **Not yet** | Four directories added to a fixed list, offered by business kind, not "chosen from the client's own citation data"; they are not fetched for evidence (P6.md deviation); review asks not built; the kind rule misfires on non-software consultancies (RC-8). Yext still leads on reviews. |
| 6. Indexing where each engine retrieves (row 11) | **True (unchanged)** | Bing / IndexNow submission and crawl state were already unique; P6 adds nothing here. |
| 7. Safe tactics by rule (row 18) | **True, with one regression** | The refused tactics stand; but honouring off-topic targets (RC-6) writes pages outside the client's offer, which works against the "keep Google rankings safe" half of the claim. |
| 8. Cost per won question (row 20) | **Built, shown wrongly** | Memo part 6 computes it, but in provider dollars to the client (RC-1); it must be credits. Cost per action before it runs is in the plan but not shown to clients. |
| 14. Weekly proposal memo (row 14, a gap to close vs Profound Aim) | **Not yet better** | The control-based "why" and the detectable-effect line are ahead of Profound on substance, but the client-facing text (ids, jargon) is below Aim's readable memo until RC-1 is fixed. |
| "Cited, not named" as its own action (gap list) | **True** | L07 with its passage guide and a page-read check. |
| Corrections asked of third-party sources (gap list) | **Not yet** | L15 is verified only through `client_url`, which nothing collects (RC-3). |
| Fan-out check on by default for cold-start sites (gap list) | **Not yet** | Still off by default and platform-admin only. |
| Pull-request publishing, community thread finder, content volume | **Not yet** (by design for volume) | Nothing in P6. |

**What is missing to lead, in order:** a clean client memo (RC-1); an address field and check for human steps so every action can be verified
(RC-3); evidence-chosen directories with review asks as approved e-mails (row 8); expected-value ordering in the Link Builder (RC-7); fan-out
reads on by default for cold-start sites within the approved budget; and the projection accuracy (Brier per lever) shown to the client once there
are outcomes.
