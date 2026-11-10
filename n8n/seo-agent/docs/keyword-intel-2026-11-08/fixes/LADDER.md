# Ladder package (2026-11-09 / 11-10, branch `ladder/package`, owner-approved; not pushed by this agent, not deployed)

Asked: one search cluster one URL (plan and write and publish time), rungs that step towards the head, a market lock, AVOID stops a rung,
stuck rungs closed, KI clusters as the rung source for sites switched On, the app ladder detail, a repair plan for the four production
ladders. Built on feature/seo-agent-v4.5 (db137b1c, then merged cf25c09c..293c40c3: IF-BRANCH lint section 182, SERP repair, KI trial).

## 1. One kit: `v5/code/_ladder_rules.js` (LRU), shared with the app

Pure (no clock, table or network; `fitPlaces` from the fit gate for the market rule only). Generated unchanged into
`app/shared/src/ladder-rules.generated.js` (+ `.d.ts`) by `ladder_rules_app.py` (called from build_v4.py section 183);
`app/shared/src/ladder-rules.parity.test.ts` fails when the generated copy is stale. API: `urlKey`, `pathOf`, `isBlog`, `copyOf`,
`sameSearch`, `ownerOf`, `plannedUrl`, `headTarget`, `oneUrl`, `stageOf`, `isCommercial`, `isDefinitional`, `definitionalOk`, `market`,
`marketRefusal`, `verdictStop`, `stuck`, `rungState`, `kiPool`.

## 2. The rules, where each is enforced

| Rule | Engine | App |
|---|---|---|
| 1 one search, one address | **Ladder Plan**: the main page never on a blog / insights address (`LRU.isBlog`: first folder blog, insights, articles, news, resources, guides ...; a non-blog page of the site that answers the head improves instead, else a new page) nor on a numbered / `-copy` variant of a live page (`LRU.copyOf`, host-agnostic: the original improves); then `LRU.oneUrl` over the main page and every rung page (the first keeps an address, the same search joins it, any other gets its own planned page). The existing rules stay (R34 fold, H2 target_guard, F-A1 one_page, SM.matchPage + seo_pages + GSC query match = "improve that page"). **Cadence Plan** (`addressOf`): a ladder page whose row carries another search's live address (a published / existing ladder page, a published content-log page) is written as its own new page, never a refresh of that page; the main page never onto a blog address; a copy improves the original. **Publish Candidates / Detect Published / Publish Check** (`_publish_rows.js` `owners`): a rung row is never recorded live on another search's address (`url_conflict`; Publish Check adds the check "One search, one page"); a waiting page whose "existing address" is another search's page is looked for at its own address only. | `cadence.ts` mirrors `addressOf` (Pipeline queue). |
| 2 steps to the head | Ladder Plan: every page carries `stage` (KI's stored stage when on, else `LRU.stageOf` from the words and intent: problem / solution / compare / hire / info). A short or full plan whose supporting pages hold no compare / hire page takes the strongest such keyword of its own on-topic pool as its last rung (it replaces the weakest page when the plan is at its cap); none in the pool: said in the plan. A definition of a seller ("what is a crm company") stays a rung only when its results page was read and guides lead it (it always links up); otherwise it waits in `later` with the reason. | Rung dialog "Who searches it". |
| 3 market lock | **Ladder Duplicate (Words)** (after Rate Limit, before any paid step) with the new **Load Site (Market Check)**: `LRU.market` = the website's market, or the market the keyword names (`gcc` / `uae` / `dubai` -> AE; a region -> the website's country when inside it, else its first measurable country; Qatar etc. cannot be measured -> the website's); a NEW ladder sent for another country is refused, nothing charged, with the market to use; `market_ack` (Normalize Input, exact key) lets a keyword that names no place be measured where the client chose. Ladder Plan states the market (`ladder.market`, notes). | Shared `ladderMarket`; consistency check `market.ladder_named` for a keyword naming another market than the website's (Accept: Use <market>; `market.run_country` stays quiet for it; a keyword naming the website's own market, sent elsewhere, keeps `market.run_country`); `runs.ts` sends the locked country for a keyword naming places and `market_ack` after "Continue anyway" on `market.run_country`; New keyword ladder start step: warning + the country it is measured in; ladder detail: one line when measured outside the website's market (`LadderDetail.market`). |
| 4 AVOID stops a rung | **Parse Verdict** HOLD: a ladder page with AVOID or a score under 40 is held for real (enforce, also for the ladder's / cadence's own runs; ladder pages carry force_content, which is why "crm for customers" AVOID 30 was published); `hold.kinds` `ladder_stop`; `hold_ack` ("Write it anyway") writes it. **Ladder Row Written**: a held ladder page run -> row `stopped` with "stopped: <reason>" (it stayed `writing` before). **Ladder Plan**: a rung the site's own checks advised against (content log "keyword check advised against", a held run "AVOID" / "clearly under"; KI `avoid` rows when on) is stored `stopped` (Ladder Rows), never in write_now or the link map. Non-ladder automatic runs keep their shadow hold (unchanged). | State `stopped` (badge, reason, button "Write it anyway" -> `holdAck`). |
| 5 stuck rungs | (rule in the kit `LRU.stuck`: writing / started longer than max(60, 3 x ETA) min with nothing alive) | `server/src/services/ladderWatch.ts`, every 15 min: every website's `writing` rows; alive = an open app run for the keyword, or a running main-workflow execution started after the rung (n8n API; unreadable = never close); closes the ladder row (`writing` -> `failed`, "failed: ...") and its content-log row (`started` -> `failed`). An open app run is the run watcher's (engineFailures.ts), whose failed runs get their credits back (admin/costSync.ts step 6); a page run that never settled its engine ledger row is charged nothing. State `failed` (button "Write it again"). |
| 6 KI clusters | New free loads in the ladder chain: Load Monitors / KI Kill / KI Runs / KI Keywords (Ladder) -> **KI Pool (Ladder)** (KI.readable: mode exactly `on`, kill switch off, gate pass; then `LRU.kiPool`: the latest ok / partial keyword_research run of the market, one head per cluster, >= 3 heads). Used: **Ladder Requests** buys only the ranked pull (reach), **Ladder Pool** takes the KI heads (volume, kd, cpc, intent, stage, verdict, page action / URL, Search Console position as the site's ranking). Trial / off / killed / no run / too few: the old pool, unchanged. | none (the plan carries `ladder_rules.ki_pool`). |

New row data (ladder_common LADDER_COLS, `sync_tables.py` on deploy): `seo_ladders.stage`, `seo_ladders.target_why`. New status values (no
column): `stopped`, `failed`, `merged`. The cadence writes `planned` rows only, so all three are skipped by construction; the WAITING
pile-up count (writing / written / not_ready) no longer holds a stuck rung for ever. Callback `ladder_plan` gains `ladder_rules`, `market`,
`stopped`, and per page `stage`, `target_why`, `action` (fields added, none renamed).

## 3. Workflows changed (for the node diff)

- **SEO Agent v4** (`SEOagentV4Full01`): new nodes `Load Site (Market Check)` (between Load Ladder Settings (Dup Check) and Ladder Duplicate
  (Words)), `Load Monitors (Ladder)`, `Load KI Kill (Ladder)`, `Load KI Runs (Ladder)`, `Load KI Keywords (Ladder)`, `KI Pool (Ladder)`
  (between Load Content Log (Ladder) and Ladder Requests); code changed: Ladder Duplicate (Words), Ladder Requests, Ladder Pool, Ladder
  Plan, Ladder Rows, Build Ladder Response, Parse Verdict, Ladder Row Written, Publish Check, Normalize Input (`market_ack`); every Data
  Table node on seo_ladders gains the two columns in its schema.
- **SEO Agent - Content Cadence**: Cadence Plan; seo_ladders schemas.
- **SEO Agent - Site Tracker**: Publish Candidates, Detect Published; seo_ladders schemas.
- Rank Tracker, Site Admin, Cycle Dispatcher, Monitors etc.: only the seo_ladders column schema of their Data Table nodes (two columns).

## 4. Checks (all sequential)

- `python3 build_v4.py`: exit 0; two builds byte-identical (workflows + harness/code_v4). Lints green: gate pairs (KI keywords read only
  through KI.readable in KI Pool (Ladder)), rule 4 (state_lint), IF-BRANCH (section 182), SERP-GOTO.
- Harness `scenarios_ladder_pkg.js` LPK1-LPK8 (real-shaped, public addresses only): the kit; the market lock before paid steps (devaicon GCC
  sent with Pakistan refused; every other mode and a page run byte-identical); a golden plan unchanged by the rules; the CRM `-2` head
  and the ERP blog head; the ERP commercial step; definitions on list vs guide results; the content log's AVOID stored stopped; Parse
  Verdict's ladder stop (AVOID 30, 36 clearly low, 62 not, hold_ack, a cadence non-ladder page still shadow) and Ladder Row Written; the
  cadence drift case and the baseline; publishedRows owners; Publish Candidates; KI Pool on / trial / killed, Ladder Requests and Pool.
- Full harness: see the summary (section 7).
- App: typecheck clean (shared, server, web); shared + server + web tests; web build. Two existing expectations changed on purpose (rule 3:
  a GCC ladder on a Pakistan website now also gets `market.ladder_named`): shared `consistency.test.ts` M4 devaicon case, server
  `test/consistency.test.ts` run-start cases (and the started run's country is now the UAE). Rule 1 / 4 refinements the existing harness
  showed were needed: the blog rule applies to a main page people choose a provider on (solution / compare / hire), not to a problem or
  learning search whose live answer is an article (S40 D11); a ladder page whose own address is already live (the guide that ranks, exec
  949) is never stopped for its score, only for AVOID (W0D4, the owner's 2026-10-29 priority); a rung refreshed on purpose onto another
  search's page (its content-log row names that page) is recorded `merged`, not `published` (PV5 updated).

## 5. Business pages and tutorials

Changelog 4.12 "Keyword ladders that climb the right way"; four benefit lines on the Keyword ladders capability. Tutorials backlog row
(video repo `7fca175`, pushed): 5.2 and 5.3 affected, no new tutorial.

## 6. Deviations and open items

- KI's own page action points the CRM heads at `/dynamics-365-crm-uae-2` and the ERP heads at the blog address (KI Trial 2026-11-08):
  `KI.pageAction` does not apply rule 1. With KI on, Ladder Plan's head guard and `oneUrl` still correct the ladder, but KI's Keyword
  research page and plan show those targets. Fix in `_ki.js` (`LRU.headTarget` on buyer heads) in the next KI round.
- The stuck watcher's "alive" for a cadence page run is a running main-workflow execution started after the rung (the app cannot map an
  execution to a keyword without reading its data); a long unrelated run after the rung keeps it open until that run ends. Conservative.
- Rule 2 re-plans from the plan's own pool only; it never invents an unmeasured keyword (says so when the pool has none).
- `seo_pages.http_status` still holds the one-probe 404s of 2026-10-22 for several live techand pages (R3 F12); the repair plan says to
  check 200 before pointing a head at them.
- The page-type rule (list results answered with service pages, R3 F5) is not part of this package.
- The app's ladder detail API keeps `targetUrl` and adds `action`, `why`, `stage`, `reason`; the `/api/v1` ladder rows pass the two new
  columns through only if their allow-list names them (not changed here).

## 7. Repair plan

`fixes/LADDER_REPAIR_PLAN.md` (not executed): techand ERP (main page to `/dynamics-365-business-central-uae`, rung 3 merged into the guide,
a new partner rung), techand CRM (paused, stuck rung failed, two rungs stopped, head off the `-2` copy, re-plan from KI partner clusters
when On), devaicon GCC (archived; restart in the UAE from the app), devaicon agentic (no change, rules 1-4 hold).
