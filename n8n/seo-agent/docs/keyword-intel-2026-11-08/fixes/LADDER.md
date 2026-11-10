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
| 4 AVOID stops a rung | (after the review: AVOID only, see section 8) **Parse Verdict** HOLD: a ladder page with an explicit AVOID is held for real (enforce, also for the ladder's / cadence's own runs; ladder pages carry force_content, which is why "crm for customers" AVOID 30 was published); `hold.kinds` `ladder_stop`; `hold_ack` ("Write it anyway") writes it. **Ladder Row Written**: a held ladder page run -> row `stopped` with "stopped: <reason>" (it stayed `writing` before). **Ladder Plan**: a rung the site's own checks advised against (content log "keyword check advised against", a held run "AVOID" / "clearly under"; KI `avoid` rows when on) is stored `stopped` (Ladder Rows), never in write_now or the link map. Non-ladder automatic runs keep their shadow hold (unchanged). | State `stopped` (badge, reason, button "Write it anyway" -> `holdAck`). |
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
- Full harness (throwaway n8nio/n8n:2.41.4, n8n/seo-agent without docs + app/shared): **18460 passed, 0 failed** (LPK 447 checks incl.
  the affected older scenarios). App: typecheck clean; shared **1158 passed**; server **2044 passed / 46 skipped** (one run had
  `test/partialPatch.test.ts` fail once under load, 3 of 3 green alone, unrelated); web **344 passed**; web build OK.
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

## 8. Review fixes (REVIEW_LADDER.md, 2026-11-10; verdict "ship after fixes")

| Item | Fix |
|---|---|
| H1 watcher closed queued runs | Alive = any main-workflow execution that has not finished (n8n states other than success / error / crashed / canceled, read with no status filter: `recentExecutions`), queued (`new` / `waiting`) or with no start time always, else one that started up to 10 minutes before the rung or after; an open app run as before; n8n unreadable = never close. A late finish reconciles: Ladder Row Written emits a second update from `failed`, so the row goes `written` / `not_ready` and "Write it again" disappears. The note no longer says "nothing is charged". Only `writing` rows are read (L8). Test: a run queued 65 minutes, a run started 6 minutes before the content-log row. |
| H2 publish detection dropped rows | Detect Published always stores the content-log row; the ladder row is stored when it is `merged` (a deliberate refresh) and only left where it was otherwise (`address_notes`). Publish Candidates applies the address rule only to candidates with a ladder row: a cadence / AI refresh is matched on its page as before. |
| H3 own live page | `ladderOwnLive` = a refresh of the ladder's own address (`existing_page_url` = `ladder_target_url`) or `dup.self`. Pinned: the CRM main page refreshing `/dynamics-365-crm-uae` at 35 (not held, no shadow) and with AVOID (not stopped, recorded). |
| H4 noisy score | A ladder / cadence page is stopped ONLY on an explicit AVOID (and never on its own live page). A score under 40 is recorded as a shadow hold (`would_hold`, `hold_shadow.kinds: ladder_low`, the D17 log the owner reviews), the page is written as planned, also from the app's Write now. An AVOID-stopped page gives a Needs-you item "Stopped: our check advised against ..., a page of your keyword ladder" (summary `holdLadderStop`; the report carries Write it anyway); nothing is charged for a page that was not written, only the check, as for every hold. |
| H5 head moved off a ranking page | `LRU.ranksFor` (rank reading <= 30 on that address, or a Search Console query with every word of the keyword at <= 30 or 10+ impressions): a blog address that ranks keeps the main page (improve, retitled; plan note). Cadence Plan and cadence.ts read the Rank Tracker's last readable head position and the page's Search Console queries the same way. A move happens only when nothing ranks there, and then the main page's row carries `target_why: "moved from <old>: ..."`, which the app turns into the redirect step `indexing:merge` once the page is live (`siteTasks.ts ladderMovesOf`). |
| M1 in-region request | A request for a measurable country inside the places the keyword names is that market ("erp software gcc" sent with Saudi Arabia is measured in Saudi Arabia; the app no longer rewrites it). |
| M2 owners | Owners = ladder rows published / existing and not `merged`; content-log rows only where a page was first published (no `existing_page_url`), in Cadence Plan, cadence.ts, Publish Candidates and Publish Check. Same search keeps using the row's `supporting`. |
| M3 held ladder run, old content-log row | Ladder Row Written takes a ladder stop as its own evidence, so the row goes `stopped` even when no new content-log row was saved. |
| M4 support count | Stopped / failed / set-aside rungs are no support for the main-page gate and `merged` counts as live, in Cadence Plan, cadence.ts and ladders.ts. |
| M5 copy | The stopped line shows the row's own reason; the repair plan uses `set_aside` for CRM rows 48 / 49. |
| L1 L2 L3 | `copyOf` keeps only -copy, -old, -draft, -backup, -bak and a one-digit suffix (when the base exists and, if both titles are known, they are the same title); `isBlog` reads past a language prefix; "consulting" is a hire word. |
| L6 | Short-plan golden added (a short plan with a hire rung: nothing added, nothing moved). |
| Skipped | L4 (place words "eu" / "indian" / "jordan": the fit gate's gazetteer, shared with every caller; for the KI / fit gate owners), L5 (the rung-2 extra page is in the plan notes; the start step's quote is unchanged: the plan run itself is what is charged at start, pages are charged when written), L7 (state_lint models no ladder transitions beyond writing -> planned; stopped / failed / merged are terminal states for the cadence and only `writing` has a declared way back). |

Repair plan section 1 rewritten to the safe option (the head stays on the ranking guide, improved and retitled; `/ms-365-erp-uae` its own
rung; rung 3 merged; no move, no new competing page, no new content-log status); sections 2-4 as the review said (CRM 48 / 49
`set_aside`, re-probe target pages and fix stale `seo_pages` 404s first).

Checks after the review fixes (sequential): build exit 0 twice, byte-identical; full harness **18494 passed, 0 failed**; app typecheck
clean; shared **1158**, server **2047 passed / 46 skipped**, web **344**; web build OK.

## 9. Re-review fixes (REVIEW_LADDER.md "Re-review of f7399da4")

| Item | Fix |
|---|---|
| H1 (regression) | n8n 2.41.4's public executions list without a status leaves running executions out (`executions.public.controller.js` `excludeRunning: query.status !== 'running'`, `execution.service.js` 457-461, read in the image). The watcher now asks `status=running`, `status=new` and `status=waiting` separately each sweep (`unfinishedExecutions` = `unfinishedVia(list)`: 3 calls per 15 minutes; any failure = "could not be asked" = nothing closed). Test with a fake API that hides running executions when no status is given, incl. the 189-minute running case. |
| N1 (High) | The "moved from" redirect step is set only for a "-2" / "-copy" copy move, never for a blog move, and never when the old address is another ladder row's page (this plan's or another ladder's) or has Search Console impressions; the app's `ladderMovesOf` also skips an old address another (not merged) ladder row holds. |
| N2 | Detect Published: on an address that belongs to another search, a TITLE-only match records nothing (unmatched, with its note); a slug match of the keyword's own address, or a deliberate refresh (merged), is recorded as before. |
| N3 | One copy rule everywhere: a one-digit suffix is a copy unless both titles are known and share under 60% of the shorter title's words (brand after "|" dropped). Production's "-2" ("Dynamics 365 CRM Services UAE \| Tech" vs "Dynamics 365 CRM in Dubai & UAE: Sales and Service \| Tech&") is a copy with titles and with addresses only. Cadence Plan and cadence.ts now pass the page titles too. LPK4 uses the production titles. |
| Lows taken | The cadence's ranking check uses the address the head's latest rank check found (as Ladder Plan does); Ladder Plan's plan-time stop reads an explicit AVOID only (no longer a held "clearly under" row). |
| Lows left | `address_notes` is not shown to the client (it is in the detection output for support); a 100-row window per status call (running / new / waiting lists are short). |

Checks after the re-review fixes (sequential): build exit 0 twice, byte-identical; full harness **18499 passed, 0 failed**; app
typecheck clean; shared **1158**, server **2048 passed / 46 skipped**, web **344**; web build OK.
