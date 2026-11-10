# Ladder repair plan: the four production ladders (2026-11-10, ladder package; owner approved the repair 2026-11-09)

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

## 1. techand.ai, "dynamics 365 erp system" (`lad_mvjsa7995bsr`, settings row 11, active, Auto, priority 1)

What went wrong (R3 F6): rungs 2 and 3 and the main page were all written onto the blog address
`/insights/is-microsoft-dynamics-365-an-erp-system` (rows 34, 36, 37), whose title is now the main page's ("Dynamics 365 ERP System: Right App
for UAE Firms"); QA warned three times that `/dynamics-365-business-central-uae` already serves the search; no rung was for buyers comparing
or choosing a partner.

What the results say (KI Trial, Search Console 28 days): Google shows the blog address for every ERP search of this ladder ("dynamics 365
erp system" #31.4, "dynamics 365 erp" #50.2 89 impressions, "microsoft dynamics erp" #44.9, "dynamics 365 erp services" #35.9), all stage
`solution`; the definition "is microsoft dynamics 365 an erp system" #31.3. The commercial Business Central page holds the buyer searches
("microsoft dynamics 365 business central uae" #52.7, "business central uae" #52.6, "... provider" #42.9, all `hire`). The partner search
"microsoft dynamics erp partner" (#64.1, `hire`) has no page of its own.

Decision: the blog address stays the guide (the one URL that already ranks; the solution searches "microsoft dynamics erp" is folded into it
as a section, which is what was published); the main page moves to the commercial page `/dynamics-365-business-central-uae` (improve it,
rule 1: the head is never a blog address); a commercial step is added (rule 2).

| Row | Now | Change |
|---|---|---|
| 34 rung 2 "is microsoft dynamics 365 an erp system" | published, /insights/is-microsoft-dynamics-365-an-erp-system | none (the guide; `stage: "info"`, `target_why: "the guide that already ranks for this search"`) |
| 35 rung 2 "ms 365 erp" | published, /ms-365-erp-uae | none to the row (it is live). Note for the owner: KI gates "ms 365 erp" as too broad and QA said it duplicates the Business Central page: consider a 301 to /dynamics-365-business-central-uae (client action, not ours). `stage: "solution"` |
| 36 rung 3 "microsoft dynamics erp" | published, the blog address | `status: "merged"`, `status_note: "merged: a section of /insights/is-microsoft-dynamics-365-an-erp-system, the page Google already shows for it (#44.9, Search Console 28 days); one search, one page"`, `stage: "solution"` |
| 37 rung 4 "dynamics 365 erp system" (main) | published, the blog address | `target_url: "https://www.techand.ai/dynamics-365-business-central-uae"`, `page_exists: true`, `status: "planned"`, `status_note: "moved: the main page improves your Business Central page instead of the blog guide (repair 2026-11, one search one page)"`, `stage: "solution"`, `target_why: "your page /dynamics-365-business-central-uae already answers this search, so it is improved, not written twice"` |
| new, rung 3 page 5 "microsoft dynamics erp partner" | (none) | insert: `ladder_id: "lad_mvjsa7995bsr"`, `domain: "techand.ai"`, `head_keyword: "dynamics 365 erp system"`, `rung: 3`, `page_no: 5`, `keyword: "microsoft dynamics erp partner"`, `supporting: "dynamics 365 erp services"`, `page_type: "Service Page"`, `target_url: "https://www.techand.ai/microsoft-dynamics-erp-partner"`, `page_exists: false`, `status: "planned"`, `months: "1-3"`, `start_date` = row 34's, `country: "United Arab Emirates"`, `location_code: 2784`, `language_code: "en"`, `email: ""`, `callback_url` = row 34's, `request_id: "repair-2026-11"`, `target_words: 1200`, `status_note: ""`, `chosen_by: "client_picked"`, `stage: "hire"`, `target_why: "the step for people choosing a partner, before the main page (rule 2)"` |
| content log 16 "dynamics 365 erp system" | published, published_url the blog address | `status: "moved"`, `publish_note: "the ladder's main page moved to /dynamics-365-business-central-uae (repair 2026-11); this address stays the guide"`. Without this the Content Cadence counts the main keyword as published and never writes it; even with it, the keyword was started within the cadence's 90-day window, so the main page is written with "Write it now" on the ladder page, not by the cycle. |

After: the main page is written with "Write it now" on the ladder page (a refresh of the Business Central page, about 1.4 dollars of
engine cost); the new partner rung is written by the next cycle. Tell the client (owner sends it): the blog address now carries the main page's title; its
own title "Is Microsoft Dynamics 365 an ERP system?" should come back when the Business Central page is refreshed.

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
| 47 rung 2 "what is a crm company" | writing | `status: "failed"`, `status_note: "failed: the page run stopped without a result (started 2026-11-05 01:33, nothing of it still running); nothing was written and nothing is charged for it"`, `stage: "info"` (the watcher would do this by itself once deployed; doing it by hand is the same write) |
| content log 26 "what is a crm company" | started | `status: "failed"`, `qa_reasons: "page run failed: the page run stopped without a result"` |
| 46 rung 2 "crm for customers" | published, /insights/crm-for-customers | `status_note: "published although our check advised against it (AVOID, score 30): consider removing it or redirecting it to /dynamics-365-crm-uae"`, `stage: "solution"`. Status stays `published` (the page is live). Owner note to the client. |
| 48 rung 2 "best crm software for customer service" | planned | `status: "stopped"`, `status_note: "stopped: a comparison of CRM software, not of CRM partners; the ladder is re-planned from keyword research"`, `stage: "compare"` |
| 49 rung 2 "crm service module" | planned | `status: "stopped"`, `status_note: "stopped: a product feature search, not a step towards choosing a CRM partner; the ladder is re-planned from keyword research"`, `stage: "solution"` |
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

1. Deploy the package (sync_tables.py adds `stage` / `target_why`), then wait one cycle-free hour.
2. Before-images of rows 11, 12, 14, 15 (settings) and 34-54 (ladders), content log 16, 17, 23, 26.
3. Apply 2 (pause first, it stops writes), then 1, then 3, then 4.
4. Read back every changed row; open both sites' Pipeline as a platform admin: the CRM ladder Paused with "Stopped" / "Stopped without a
   result" rows and their reasons, the ERP ladder's main page "Improves an existing page: /dynamics-365-business-central-uae", the
   devaicon GCC ladder archived.
5. Cost: nothing for the repair itself; the ERP main page refresh and the new partner rung are written by the normal cycle (about 1.4
   dollars each in engine cost, charged to the client at the usual credits).
