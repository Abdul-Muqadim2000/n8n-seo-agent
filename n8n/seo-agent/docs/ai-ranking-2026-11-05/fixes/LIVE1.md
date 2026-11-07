# LIVE1: fixes from the first live `on` run of AI ranking (2026-11-06)

Branch `air/live1`, based on `344baac9` (what production runs). **Not pushed, not deployed, no production writes.** Production was only
read (n8n public API, GET, over `deploy/gcp/tunnel.sh`; tunnel closed after). The private rows, the replay and the simulation outputs are in
`~/seo-agent-secrets/ai-ranking-2026-11-05/` (`live1/`, `data_live1/`, `replay_live1/`, `replay_live1_before/`), never in the repository.

Evidence: the operator log `RUN_NOW.md` (private). AI Growth executions 10839 / 10840, Link Builder executions 10844 / 10845.

## Commits

| Commit | Defect | What changed |
|---|---|---|
| `376067cd` | 2. Dropped targets are invisible | Cadence_Plan.js and its mirror `app/server/src/services/cadence.ts`: an AIR target the reserved slot cannot write goes into `refused` (reason `cannot be written now`, a plain detail, its `target_id`). The slot then takes the next eligible AIR target. New shared case `air_on_reserve_refresh_no_url_listed` (25 cases). |
| `a81f2497` | 1. Refresh with no page address | `_ai_rank_learn.js`: L06 is chosen only when `pageOf()` finds an address; otherwise the question gets L05, a new page. `pageOf()` also reads the Search Console page for the question's keyword or for one of the engines' searches (exact query, own host only). The L06 ref now carries the url, and the action id is unchanged. AI_Rank_Plan sink: `page_url = ref.url \|\| page_url`. A refresh with no address is refused with its reason and never stored. |
| `b9070c3f` | 4. Link Builder false positives | `_outreach_kit.js`: `sellSignals` checks for gambling words after removing the options of a form drop-down (`<select>`). `rivalOf` never treats a social or professional network as a competitor. New labelled set `harness/accuracy/prospects.json`. |
| `9981447c` | 3. Placements skip the vetting (+ the reserved slot's other blocker) | `OK.placementVet` (stored rows only, no fetch), applied by AI_Rank_Plan to every placement BEFORE `ARL.choose`. Own pages pass the cadence's freshness rules before the choice. |

## Root causes found

1. **Refresh with no address.** Production's chosen L06 did carry a `page_url`: devaicon `/ai-automation-services-pakistan`, techand `/ms-365-erp-uae`. Its `ref` held only the question, and the sink read `ref.url`, so `''` was written. Separately, `hasPage()` let L06 be chosen from stage evidence alone (a rank, a retrieved or a cited count) with no address at all. Both are fixed.
2. **Silent drop.** `aiEligible()` filtered AIR targets before the loop that lists refusals.
3. **Placements.** The out-gate refused only `author_kind` rival/client. It never read the Link Builder's stored verdicts in `seo_link_outreach`, and AIR's own prospect rows stay `new`, so the verdicts were never seen.
4. **Second blocker for the reserved slot.** With the address fixed, both refresh targets point at pages the agent published on 10-28 and 10-30. The cadence refuses a refresh within 60 days of publication (F-38), so the slot would still have written nothing. AIR now applies that rule, and the 90-day keyword rule, before it chooses. The week's own page is therefore one the cadence can write.
5. **code-brew.ae as gambling.** The matched token is `betting`, in `<option value="Fantasy &amp; Betting">` of the quote form's Industry drop-down. This was read from the page's HTML through the reader, because the site sits behind Cloudflare.
6. **linkedin.com as a competitor.** It is a SERP rival: a LinkedIn article ranked #3 for "open edx provider". The verdict came from Link Builder section 2b, the prospect not being read because `BIG` skips linkedin. That path passed no page address, so the "a SERP rival's best-X list is fair game" exemption could not apply. Note: that stored `not_fit` row stays in production until it is cleared by hand, because 2b never overturns an old verdict. AIR does not pitch platform pages anyway (see below).

## The vetting (OK.placementVet)

A placement is refused in each of these cases, and the Link Builder's own reason is quoted:

- the Link Builder's latest `not_fit` verdict on the site's page (`type ai_source`, or the same page);
- any earlier pitch to the same site: a drafted, needs_edit, sent or answered row, a sequence, or a stored draft on the prospect row ("one pitch per site");
- a mailbox, database or CDN host;
- a platform the Link Builder never reads (`OK.PLATFORM`, kept identical to `LB_Page_Requests`' `BIG`; the harness compares the two);
- a government site;
- a bare homepage;
- a competing site.

Contact preference:

| Contact on file | Effect on the score factor | Notes |
|---|---|---|
| e-mail | none | |
| none yet | x0.85 | The Link Builder looks for one when it reads the page. |
| contact form only | x0.7 | Kept, marked a manual step in the prospect row's `note`, with `contact_url` stored. |

`ARL.choose` returns its own action shape, so the vetting facts are carried back by action id. The Link Builder's own cap is unchanged: at most `AIR_PITCH_MAX` (2) AIR rows a week, by expected value, among its `ready` rows.

## Checks

| Check | Result |
|---|---|
| Build `python3 build_v4.py` | exit 0 at every commit |
| Full harness (n8nio/n8n:2.41.4, scratch copy without docs/) | **17434 passed, 0 failed** at `9981447c`; 0 failed at each step: 17427 with defects 1 + 2 (`a81f2497`; `376067cd` was tested together with it), 17429 with defect 4 (`b9070c3f`), 17434 with defect 3 (`9981447c`) |
| New tests on the OLD code (344baac9 sources, new tests) | every LIVE1 check fails (LIVE1-1 kit x2, sink x2, the cadence case, LIVE1-3 x3, LIVE1-4 x2; LIVE1-2 and the platform check added later fail by construction: no freshness screen, no `placementVet`) |
| Off / trial byte-identical | AIRG golden (every site off), AP3 shadow golden (all existing writes, report, callback, settle identical), every earlier cadence case (`cadence_levels.json` + the 24 earlier AIR cases) unchanged |
| Accuracy sets | Every existing measurement (S49 audit findings + spam labels, KWACC, CLACC, AI entities, sentiment) is line-for-line identical before and after. The new `prospects.json` set scores old rules 83.3% (gambling) / 50.0% (competitor) precision, new rules 100% / 100%, with recall 100% for both. |
| App (whole worktree mounted, node:22) | typecheck clean; shared 1125, server 1974 (46 skipped), web 317; build OK. `airCadence.test.ts` now expects 25 cases. |

`npm ci` could not reach the registry (the proxy). `node_modules` was copied from the `air-fxc` worktree, which has the same `package-lock.json`.

## Replay and simulation on the private dump ($0, 0 network)

Inputs: `data_live1` is the 11-05 dump overlaid with the production rows read on 2026-11-07 (AIR tables, targets, prospects, outreach, pages, query history, content log, monitors and the cadence tables). Run with `harness/ai_rank_replay.js` at `AT=2026-11-06T14:30Z`, once with the build before the fix (`replay_live1_before`) and once with this build (`replay_live1`).

The replay has no 11-06 answers and no fetched (P5) reads, so its question choice differs from production's. The cadence was then run through the real Cadence Plan node on the production rows (`live1/sim_out.txt`).

**Production rows as they are, new code.** Both AIR targets are now listed in `refused` ("it asks to refresh a page but names no page address") instead of being dropped.

**Targets as the fixed sink writes them from production's own choice.** The two targets become refreshes of `/ms-365-erp-uae` and `/ai-automation-services-pakistan`. The cadence still refuses both ("its page was refreshed or published in the last 60 days"), which is why the freshness screen was added.

### Per site, with the fixed build (replay choice, then the cadence)

| | techand.ai | devaicon.com |
|---|---|---|
| Own page AIR chooses | a **refresh with an address** (`/dynamics-365-cloud-migration-uae`) | a **new page** (L05, "governed vs autonomous ai agents") |
| Own pages refused by the freshness screen before the choice | 5 (pages refreshed or published in the last 60 days) | 3 (pages refreshed or published in the last 60 days) |
| Reserved slot | **writes** the AIR refresh on top of the ladder page | **writes** the AIR answer page |
| Old build's choice | `/insights/is-microsoft-dynamics-365-an-erp-system`, which the cadence refuses | `/engagement-models`, which the cadence refuses |

### Placements on production's week

| | techand.ai | devaicon.com |
|---|---|---|
| Production's 5 chosen placements, vetted now | 4 refused: 2 competitor lists ruled out 10-29, a site already pitched 10-25, a competing provider. **1 passes**: a contact form only, so a manual step. | **All 5 refused**: gambling + competing provider, paid guest posts x2, a competing provider, the LinkedIn platform page. |
| Production's list sources that are neither a rival's nor naming the client | 25: 8 refused by the vetting, 17 pass, 1 of them a form only | 61: 28 refused, **33 pass** (no contact on file yet; the Link Builder looks for one when it reads the page) |
| Replay (fixed build) | 23 placement candidates, 16 refused (7 by the vetting), **7 pass**, 5 chosen (the weekly pitch capacity), all with no contact on file yet | no placement candidate in the offline dump (its devaicon sources predate the 11-06 run) |

The Link Builder drafts at most 2 of the chosen placements a week, from those it qualifies as `ready` with an e-mail contact.

## Open items (owner)

- Deploy (engine only: AI Growth, Content Cadence, Link Builder, Backlink Monitor and main carry the changed kit) after `origin/main` is merged and production is node-diffed. Then re-run stage B / C of `RUN_NOW.md` (Content Cadence, Link Builder) for both sites.
- The API image carries the `cadence.ts` mirror, which affects the app's Pipeline preview only.
- The stored linkedin.com `not_fit` row (devaicon) predates the fix. The Link Builder never re-qualifies it, because 2b only writes refusals and `BIG` hosts are never read. Clear it by hand if wanted. AIR does not pitch it anyway (a platform page).
- Not changed, noted: Link Builder 2b passes the prospect row's `page_url` (prospect rows carry `source_url`), so a SERP rival's list read only through 2b cannot get the list exemption. That is a broader behaviour change for every site, left for a separate, tested fix.
