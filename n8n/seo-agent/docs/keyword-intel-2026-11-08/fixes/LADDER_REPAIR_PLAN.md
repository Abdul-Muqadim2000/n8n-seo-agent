# Ladder repair plan: the four production ladders (2026-11-10, ladder package; owner approved the repair 2026-11-09; section 1 rewritten to the safe option after REVIEW_LADDER.md)

Not executed. The orchestrator applies it **after** the ladder package is deployed (so the new statuses `stopped` / `failed` / `merged` and
the columns `stage` / `target_why` exist: `sync_tables.py` adds the two columns). Every operation is a row update or insert on production
Data Tables through the n8n public API (over `deploy/gcp/tunnel.sh`), or a Site Admin call. Read the row first, write only the fields named,
keep a before-image of every row in `~/seo-agent-secrets/` (never in the repo).

Evidence read for this plan (read-only, 2026-11-10): `seo_ladders` / `seo_ladder_settings` / `seo_pages` live (tunnel), the 2026-11-08
dump (`seo_content_log`, `app_runs`, ladder plan reports), and the KI keyword-research Trial rows of 2026-11-08 19:47 (`seo_ki_keywords`,
both sites `trial`; 207 techand rows, 100 devaicon rows; 56 of 60 / 51 of 60 results pages unread, so most verdicts are `unknown`: the
rows are used here for their Search Console positions, stages and the page Google shows, not for their scores).

## 0. How to apply

```
# table ids by name (never print the API key)
GET /api/v1/data-tables?limit=250            -> id of seo_ladders, seo_ladder_settings, seo_content_log
# one row update (n8n public API)
PATCH /api/v1/data-tables/<id>/rows/update
  { "filter": { "type": "and", "filters": [ { "columnName": "id", "condition": "eq", "value": <row id> } ] },
    "data": { ... the fields below ... } }
# one insert
POST /api/v1/data-tables/<id>/rows   { "data": [ { ... } ] }
```
Before any write: `GET .../rows?filter=` the row by id and check `status` / `target_url` still equal the "now" column below; if not, stop
and re-plan that row (a weekly run moved it). Check the live pages named as targets answer 200 (`curl -sI`; `seo_pages.http_status` holds a
stale 404 from one probe of 2026-10-22 for several of them, R3 F12). Do it on a Tuesday-Thursday, not during a site's cycle hour.

## 1. techand.ai, "dynamics 365 erp system" (`lad_mvjsa7995bsr`, settings row 11, active, Auto, priority 1) - the SAFE option (orchestrator, after REVIEW_LADDER.md)

What went wrong (R3 F6): rungs 2 and 3 and the main page were written onto the blog address
`/insights/is-microsoft-dynamics-365-an-erp-system` (rows 34, 36, 37); no rung was for buyers choosing a partner.

Why the head stays where it is: that blog address is the page that ranks for the cluster (Rank Tracker #16 for "dynamics 365 erp system"
on 2026-11-05; Search Console #26.5 "dynamics 365 erp", #31.4 "dynamics 365 erp system", #44.9 "microsoft dynamics erp"). Moving the head
would leave it for a page that competes with it (review H5; the package now keeps a ranking address by itself, `LRU.ranksFor`). Moving it
onto `/dynamics-365-business-central-uae` would hand the Business Central page a second search (rule 1 in reverse). So: no new competing
page, no move. The page is improved and retitled towards the buying search; `/ms-365-erp-uae` stays its own rung; rung 3 is a section of
the guide.

First: re-check every target's live status (`curl -sI`, follow nothing; `seo_pages.http_status` holds stale 404s from one probe of
2026-10-22): `/insights/is-microsoft-dynamics-365-an-erp-system`, `/ms-365-erp-uae`. If one does not answer 200, stop and re-plan this
section. Where `seo_pages.http_status` says 404 for a page that answers 200, set that row's `http_status: 200`, `status_at: <now>` (same
table, update by `url`), so `SM.isGone` no longer hides it from matching.

| Row | Now | Change |
|---|---|---|
| 34 rung 2 "is microsoft dynamics 365 an erp system" | published, the guide address | `stage: "info"`, `target_why: "the guide; the ladder's main page improves this same page towards the buying search"`. Status stays `published`. |
| 35 rung 2 "ms 365 erp" | published, /ms-365-erp-uae | `stage: "solution"`, `target_why: "its own page"`. Status stays `published`. |
| 36 rung 3 "microsoft dynamics erp" | published, the guide address | `status: "merged"`, `status_note: "merged: a section of /insights/is-microsoft-dynamics-365-an-erp-system, the page Google shows for it (#44.9, Search Console 28 days); one search cluster, one page"`, `stage: "solution"`. (After review M2 a `merged` row never owns the address, so the guide's own rungs stay its owners.) |
| 37 rung 4 "dynamics 365 erp system" (main) | published, the guide address, page_exists true | `stage: "solution"`, `target_why: "this page already ranks for \"dynamics 365 erp system\" (#16), so the main page improves it, retitled towards the buying search, instead of a second page that would compete with it"`. Status stays `published`; target unchanged. |
| content log 15 / 16 | published at the guide | unchanged (true records of what was published). No new status. |

Owner note before that optional step: retitling the guide towards "dynamics 365 erp system" changes the page of rung 34 ("is microsoft
dynamics 365 an erp system", #31.3): a choice between the two searches, and it is the owner's.

Then (owner's choice, from the app, normal credits): "Write it now" on the main page (an improvement of the guide address that retitles
it towards "dynamics 365 erp system" and adds a partner section linking to the Business Central and MS 365 ERP pages), and a new keyword
the client picks for the commercial step through the app's "Add to my ladder" (for example "microsoft dynamics erp partner", Search
Console #64.1, stage hire) only if the owner wants it. Nothing is written by the repair itself.

## 2. techand.ai, "crm service provider" (`lad_mw0goinsniv1`, settings row 14, active, Auto, priority 2)

What went wrong (R3 F7 F9): rung "crm for customers" was published although the page run's verdict said AVOID (score 30); "what is a crm
company" sat at `writing` since 2026-11-05 01:33 (content log 26 `started`, cadence `cad_20261105_techand-ai_2`; its run died); the main page
pointed at `/dynamics-365-crm-uae-2`, a copy of the live `/dynamics-365-crm-uae`; the rungs are informational or about CRM software, not about
choosing a CRM partner, and the ladder pushed near-page-one AX / Peppol work (priority 2) to "upcoming".

What the results say (KI Trial): the buyer searches of this topic are partner searches that Google answers with `/dynamics-365-crm-uae`:
"microsoft dynamics 365 partner in uae" #73.1, "dynamics 365 partner in uae" #71.2, "microsoft dynamics partner in uae" #69.8, "dynamics crm
partner in uae" #63.6 (all `hire`). Note: KI's own page action for "crm service provider" also points at the `-2` copy (a KI defect for the
orchestrator: KI.pageAction should apply LRU.headTarget, see LADDER.md section 6).

| Row | Now | Change |
|---|---|---|
| settings 14 | active, Auto, priority 2 | the app's Pause on the ladder page, or the Data Table: `status: "paused"` (the cadence writes nothing for a paused ladder; ranks are still checked). Then reorder: no change needed to row 11 (priority 1 stays). |
| 47 rung 2 "what is a crm company" | writing | `status: "failed"`, `status_note: "failed: the page run stopped without a result (started 2026-11-05 01:33, nothing of it still running); nothing was written"` (first confirm in n8n that no execution of the main workflow from 2026-11-05 is still running or queued: ask `status=running`, `status=new` and `status=waiting` separately; a list with no status leaves running executions out), `stage: "info"` (the watcher would do this by itself once deployed; doing it by hand is the same write) |
| content log 26 "what is a crm company" | started | `status: "failed"`, `qa_reasons: "page run failed: the page run stopped without a result"` |
| 46 rung 2 "crm for customers" | published, /insights/crm-for-customers | `status_note: "published although our check advised against it (AVOID, score 30): consider removing it or redirecting it to /dynamics-365-crm-uae"`, `stage: "solution"`. Status stays `published` (the page is live). Owner note to the client. |
| 48 rung 2 "best crm software for customer service" | planned | `status: "set_aside"`, `status_note: "a comparison of CRM software, not of CRM partners: not a search for this ladder; it is re-planned from keyword research"`, `stage: "compare"` (review M5: `set_aside`, not `stopped`, because no check advised against it) |
| 49 rung 2 "crm service module" | planned | `status: "set_aside"`, `status_note: "a product feature search, not a step towards choosing a CRM partner: not a search for this ladder; it is re-planned from keyword research"`, `stage: "solution"` |
| 50 rung 4 "crm service provider" (main) | planned, /dynamics-365-crm-uae-2, page_exists true | `target_url: "https://www.techand.ai/dynamics-365-crm-uae"` (check it answers 200 first), `page_exists: true`, `status_note: "moved: the main page improves /dynamics-365-crm-uae, not its copy -2"`, `stage: "hire"`. Stays `planned`; the ladder is paused. |

Re-plan later: when the owner switches techand.ai's keyword intelligence to `on`, start a new ladder from the app on the partner cluster
(for example "dynamics crm partner in uae"); its rungs then come from the KI clusters (rule 6) and the main page improves
`/dynamics-365-crm-uae`. Archive this one then (settings `status: "archived"`), so its rows stop claiming the CRM searches.

## 3. devaicon.com, "ai automation solutions gcc" (`lad_mvpd7x01f657`, settings row 12, active, Auto, priority 1)

What went wrong (R3 F1): the run was sent with Pakistan (location 2586) while the website is measured in the UAE; the main page became
"ai automation services pakistan", published by the client at `/ai-automation-services-pakistan` (content log 17), and the rung "ai in
industrial automation" (factories) is not what Devaicon sells. The AI panel questions this ladder created were already retired as another
market (2026-11-06).

Decision: **retire** (archive), do not move. Moving it to the UAE would aim a published page whose subject is Pakistan at UAE searches; the
honest move is a new ladder in the UAE with the client's original intent, which the app now starts in the UAE by itself (rule 3: "gcc" ->
AE). KI Trial for devaicon has no ai-automation head with data yet (every verdict `unknown`, 51 of 60 results pages unread).

| Row | Now | Change |
|---|---|---|
| settings 12 | active | `status: "archived"` (the Data Table row; the app writes the same field). There is no Site Admin action for a ladder's status. Archived ladders are left out of the cadence, the duplicate rule and the AI panel focus. |
| 38, 39 | published, Pakistan | none (history; both pages are live on the client's site). Owner note to the client: the two pages talk about Pakistan; if the GCC is the market, rewrite or redirect them. |

Then (owner, from the app): New keyword ladder "ai automation solutions gcc" (or "ai automation company uae"); the start step now shows "This
ladder is measured in United Arab Emirates" and sends the UAE.

## 4. devaicon.com, "agentic ai development in uae" (`lad_mw28vc20jc4w`, settings row 15, active, Auto, priority 2)

Checked against rules 1-4:
- rule 1: four different addresses (`/services/ai-development-companies`, `/services/ai-app-development-companies`, `/ai-app-development`,
  `/agentic-ai-development-in-uae`); the main page is not a blog address or a copy. OK.
- rule 2: two `hire` rungs ("ai development companies", "ai app development companies") before the main page. OK. (R3: both are list
  results pages answered by "top companies" articles; the page-type fix is outside this package.)
- rule 3: measured in the UAE (2784), the website's market, and the keyword names the UAE. OK.
- rule 4: no AVOID or held verdict for any of its keywords in the content log. OK.
- the first plan run failed and the retry succeeded: rows 51-54 come from the retry (request 8992 etc.), no duplicate rows. OK.

No change. Only `stage` for the record: 51 `hire`, 52 `hire`, 53 `solution`, 54 `solution`.

## 5. Order and checks

1. Deploy the package with the review fixes H1-H5 (sync_tables.py adds `stage` / `target_why`), then wait one cycle-free hour. Re-check every target page's live status and correct stale `seo_pages.http_status` 404s first (sections 1 and 2).
2. Before-images of rows 11, 12, 14, 15 (settings) and 34-54 (ladders), content log 16, 17, 23, 26.
3. Apply 2 (pause first, it stops writes), then 1, then 3, then 4.
4. Read back every changed row; open both sites' Pipeline as a platform admin: the CRM ladder Paused with its "Set aside" / "Stopped
   without a result" rows and their reasons, the ERP ladder's main page "Improves an existing page" on the guide address with the reason,
   rung 3 "Part of another page", the devaicon GCC ladder archived.
5. Cost: nothing for the repair itself. The ERP main page improvement is the owner's "Write it now" (about 1.4 dollars in engine cost,
   the usual credits), and only if the owner chooses it.
