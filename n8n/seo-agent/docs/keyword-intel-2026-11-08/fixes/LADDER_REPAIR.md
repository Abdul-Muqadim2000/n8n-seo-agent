# Ladder repair applied on production (2026-11-10, owner-approved 2026-11-09; plan: fixes/LADDER_REPAIR_PLAN.md, safe option)

Applied after the ladder package deploy (feature/seo-agent-v4.5 4d4a3c69). Data Table API over the tunnel; every write filtered on the
row id AND its expected current status. Nothing was sent to a client, no page run and no paid call was started.

- **Backup first:** `gs://alaventra-prod-backups/pg/2026-11-10/{app,n8n}-2026-11-10T122006Z.dump`.
- **Before / after images:** `~/seo-agent-secrets/ladder-repair-2026-11-10/` (`before-image.json`, `applied.json`, `after-image.json`; 700 / 600, not in the repo).
- **n8n check before closing anything:** the main workflow's `running`, `new` and `waiting` executions were queried separately: 0, 0, 0.

## Live status of the targets (curl, redirects followed)

| Address | Result |
|---|---|
| /insights/is-microsoft-dynamics-365-an-erp-system | 200 |
| /ms-365-erp-uae | 200 |
| /dynamics-365-crm-uae | 200 (seo_pages row 152 said 404 from the 2026-10-22 probe: corrected to `http_status 200`, `status_at` now) |
| /dynamics-365-crm-uae-2 | 200 (the copy) |
| /insights/crm-for-customers | 200 |
| /dynamics-365-business-central-uae | 301 to /business-central-implementation-uae (not a repair target; seo_pages row 160 left as is) |
| devaicon /ai-automation-services-pakistan | 301 to /services/ai-automation-services-pakistan (archived ladder, no change) |
| devaicon /insights/ai-in-industrial-automation, /services/ai-development-companies, /services/ai-app-development-companies | 200 |

## What changed (18 row writes, all read back as planned)

| Ladder | Rows | Change |
|---|---|---|
| techand ERP `lad_mvjsa7995bsr` (active, priority 1) | 34, 35, 37 | stage + target_why only; status stays published; the main page stays on the ranking guide (no move, no new page) |
| | 36 "microsoft dynamics erp" | published -> **merged** (a section of the guide), with its note |
| | content log 15 / 16 | unchanged (no new status) |
| techand CRM `lad_mw0goinsniv1` | settings 14 | active -> **paused** |
| | 47 "what is a crm company" | writing -> **failed**: closed by the deployed stuck-rung watcher at 12:30:36 UTC (7,857 minutes, nothing running), seconds before the repair's own guarded write (which then matched 0 rows); the repair added `stage: info`. Content log 26 started -> failed by the same watcher. |
| | 46 "crm for customers" | note (published although our check said AVOID; owner may remove or redirect it), stage; status stays published |
| | 48, 49 | planned -> **set_aside** with their reasons, stage |
| | 50 main page | target `/dynamics-365-crm-uae-2` -> **`/dynamics-365-crm-uae`** (page_exists true), note "moved: ... not its copy -2", stage hire, target_why; stays planned (ladder paused) |
| devaicon GCC `lad_mvpd7x01f657` | settings 12 | active -> **archived** (rows 38 / 39 and their rank history kept) |
| devaicon agentic `lad_mw28vc20jc4w` | 51-54 | stage only (hire, hire, solution, solution) |
| seo_pages | 152 | stale 404 -> 200 |

Counts: ladder rows changed 15 (34-37, 46-54; 47 by the watcher plus its stage), settings 2, seo_pages 1, content log 1 (26, by the
watcher). No row deleted, no page or ranking history lost: every row keeps its `ladder_id` + `keyword`, so `seo_rank_history` stays joined.

Verified: every row reads back as planned (after-image). The app's ladder pages read these rows live, and the deployed app maps the new
states (`merged` "Part of another page", `failed` "Stopped without a result", `set_aside`, paused / archived ladders). The app log shows
the watcher's close: "stuck ladder rungs closed as failed: techand.ai lad_mw0goinsniv1 what is a crm company".

## Pending owner steps (nothing started)

1. techand ERP: optional "Write it now" on the main page (improves and retitles the guide towards "dynamics 365 erp system", about 1.4
   dollars engine cost at the usual credits). This changes rung 34's page ("is microsoft dynamics 365 an erp system", #31.3): a choice
   between the two searches. Optional commercial step through "Add to my ladder" (e.g. "microsoft dynamics erp partner").
2. techand CRM: re-plan from keyword intelligence once techand.ai is switched to KI `on` (partner clusters, main page
   `/dynamics-365-crm-uae`); then archive this ladder. Client note (owner sends it): `/insights/crm-for-customers` was published
   although our check advised against it; consider removing or redirecting it, and redirecting `/dynamics-365-crm-uae-2` to
   `/dynamics-365-crm-uae`.
3. devaicon: start a new ladder for the GCC intent from the app (it is now measured in the UAE). Client note: the two pages that talk
   about Pakistan.
