# SERP-GOTO: production data repair (2026-11-08 19:21-19:50 UTC; owner approved 2026-11-09 local)

What was changed on production after the SERP-GOTO fix (`SERP_GOTO.md`, live since 2026-11-07 22:20 UTC; the Rank Tracker on production
was checked before the repair: it carries the SU kit, `poisonedRow`, `unreadWeeks` and the three Unread Alert nodes). Carries out the
proposal of `SERP_GOTO.md` section 7. Every write went through the n8n public API (Data Table rows) over `deploy/gcp/tunnel.sh`; the app
database was only read. No code changed, no deploy.

## 1. Backup (before any write)

`sudo bash backup.sh` on the VM, 2026-11-08 19:21:18 UTC:
`gs://alaventra-prod-backups/pg/2026-11-08/n8n-2026-11-08T192118Z.dump` (524 MB) and `.../app-2026-11-08T192118Z.dump` (14 MB).

## 2. Affected set, re-derived on current production (read-only, 19:26 UTC)

| Data | Doc (2026-11-08) | Now | Rule used |
|---|---|---|---|
| `seo_cache` `serp:*` rows holding bare redirects | 107 | **107** (location UAE 82, Pakistan 25; 38 keyed to a site: techand 18, devaicon 20, all 2026-11-06); 85 clean rows left, none newer than 2026-10-27 | the engine's `SU.poisoned`: an organic / local-pack item whose url is a Google redirect and not marked `url_exact: false` (all 107 also contain `google.com/goto`) |
| `seo_rank_history` readings with redirect urls in the stored top list | 21 | **21**: techand 157-169 (12 at 0, row 162 mobile #16 with a real techand url), devaicon 223-229, 231 (all 0) | `RS.poisonedRow` |
| `seo_query_history` live-check rows at 0 since 10-30 | 16 | **14** to change; **2 kept** (see below) | the source of each row's `serp_position` (the newest rank reading of that keyword at or before it, as Site Plan takes it) is poisoned |
| google.com as a stored competitor | `seo_monitors`, ladder, strategy | none in `seo_monitors`, `seo_sites`, `seo_ladders` (the ladder rows hold no competitors), `seo_ladder_settings`; **in `competitors_json` of all 21 poisoned rank rows** (`above`, `competitors`, `shares`) | domain equal to google.com (www. stripped) |
| `seo_ai_rank_sources` redirect source | 1 | **1** (id 2, devaicon, `google.com/goto`) | url is a Google redirect. Kept: 4 rows on `google.com/maps/place` and `google.com/searchviewer` (real Google pages cited by AI answers) |
| app reports | 5 Rank Tracker + strategy + ladder | all present: techand `eabfca21`, `707e7953` (9 "not in top 50"), `c5dd7e0e` (3), devaicon `c9b0982d`, `4738c27c`, strategy `a918573a`, ladder `b31ff813`; site reports `4785c83e` / `3a69ed4f` hold neither text | read only |

**Deviation from the doc, on purpose:** the doc counted 16 query rows "since 10-30". Two of them (devaicon 2879 "ai in industrial
automation", 2880 "ai automation services pakistan", checked 2026-10-30 01:18Z) predate the first goto reading (2026-10-30 09:29Z) and
come from clean Rank Tracker readings at 0 of the same morning (rows 155 / 156: ten real urls each). They are true readings and were
not changed.

## 3. Changes applied (19:32-19:35 UTC; every write touched exactly one row, read back after)

| Table | Change | Rows |
|---|---|---|
| `seo_cache` | deleted the poisoned `serp:*` rows (the next run reads those searches again; the fixed engine refused them anyway) | 107 |
| `seo_rank_history` | `position` 0 -> **-1** ("could not be told", never a drop, a "lost" or a chart point); `snapshot_json` gained `ur` (redirect items in the stored top), `mo: 1` (a hidden result may be ours: the wording "could not be told: a result Google hid may be yours") and `repair` (what was done). The stored top list was kept, so `poisonedRow` stays true and the row is still never a baseline nor part of an unread streak (`unreadWeeks` drops poisoned rows before counting, so no week-2 ops alert can come from these rows). Not `st` (settled = "not found among the results we could read" would be wrong: the pages were there) | 20 |
| `seo_rank_history` | google.com removed from `competitors_json` `above`, `competitors` (pass 1) and `shares` (pass 2); other entries and their numbers untouched. Row 162 keeps its real #16 | 21 |
| `seo_query_history` | `serp_position` 0 -> -1 (the Site Tracker's "not checked") | 14 |
| `seo_ai_rank_sources` | deleted the redirect source row (id 2) | 1 |
| `seo_cycle_jobs` | rows 44 (techand) and 117 (devaicon) `rank_tracker` of the CURRENT cycles re-opened (`refused`, attempts 1) so the Cycle Dispatcher re-ran them (section 5). `seo_cycles` not written | 2 |

App reports: the app has no "superseded" flag or note on a report (`reports` table: stage / status / title / summary / payload only),
so the 5 Rank Tracker reports and the strategy / ladder reports were **left as they are** (client history is not deleted). The corrected
Rank Tracker reports from the re-run (section 5) are the newest in each account, and the Rankings pages read the repaired Data Tables
directly.

## 4. Before-images (private, 700)

`~/seo-agent-secrets/serp-goto-2026-11-08/repair/`:
`before_2026-11-08T193201Z.json` (every changed / deleted row in full: 107 cache, 21 rank, 14 query, 1 AI source, plus the plan),
`before_pass2_shares_2026-11-08T193450Z.json` (the 21 `competitors_json` values before pass 2), `before_jobs.json` (job rows 44 / 117
and both `seo_cycles` rows), `apply_log_2026-11-08T193201Z.json`, `raw/` (full table reads of 19:26 UTC). Restore: PATCH the saved
values back by id, re-insert deleted rows from the before-image (or `pg_restore` the tables from the backup above).
Script: session scratchpad `rep/repair.py` (dry run by default; a second dry run after the apply planned 0 changes).

## 5. The Rank Tracker re-run

Mechanism: the RUN_NOW.md one (private, `ai-ranking-2026-11-05/`). The Rank Tracker has only an Execute Workflow trigger, so job rows
44 / 117 (`rank_tracker` of the current cycles `cyc:site_techand-ai:2026-11-05` / `cyc:site_devaicon-com:2026-11-06`) were set to
`refused`, attempts 1 at 19:35:17 UTC; the dispatcher's 19:38 sweep started both (it read "2 start(s), 0 job(s) in flight, 0 run(s)
holding the run guard"). Executions **11721** (techand, 19:38:07-19:38:42) and **11722** (devaicon, 19:38:33-19:38:58), both
`success`; job rows back to `done` with the new run ids, ledger rows settled. `seo_cycles` unchanged (techand next 2026-11-12T01:00Z,
devaicon 2026-11-13T01:00Z), so the weekly schedule did not move.

New readings (15 desktop rows, ids 233-247; the Tracker Plan did not ask for mobile this time). Every results page was fully
readable: 6-10 stored results per keyword, all with their site recovered (`x: 1`), **0 bare redirects, 0 unresolved, no `mo` / `st`,
no google.com** in any competitor list (one real Google result: `play.google.com` at #7 for devaicon's "ai app development", a Google
Play app listing). 15 new `serp:*` cache rows, all normalised (`url_exact` / `url_recovered`). No ops alert written.

techand.ai (Search Console average position, week to 2026-11-02, in brackets):

| Keyword | 10-29 (last clean) | 11-05 (false) | 11-08 (corrected) | |
|---|---|---|---|---|
| is microsoft dynamics 365 an erp system | #28 | "not in top 50" | **#29** (techand.ai/insights/...) | [GSC 31.3] |
| dynamics 365 erp system | #22 | "not in top 50" | **#28** | [GSC 31.4] |
| ms 365 erp | #39 | "not in top 50; the whole results page moved" | **not in the top 50**: 45 organic results read, every site known, none techand's | [GSC 25.5, 8 impressions] |
| microsoft dynamics erp | 0 | 0 | 0 (46 results read) | [GSC 44.9] |
| crm for customers, what is a crm company, best crm software for customer service, crm service module, crm service provider | (none) | 0 | 0 | |

devaicon.com: all 6 keywords 0 (not in the top 50) on fully readable pages, as on the last clean reading (10-30) for the two that
had one. Its 11-06 "not in top 50" lines were therefore true; only the google.com competitor was wrong.

New app reports (the newest in each account; the old ones stay as history): techand `89275e04` (ladder "dynamics 365 erp system":
drops "ms 365 erp #39 -> not in top 50" and "dynamics 365 erp system #22 -> #28", each "the whole results page moved that week (8 of
the top 9 places changed), so this is not necessarily about your page"), `036b3284` (watched keywords: the #22 -> #28 move),
`974135ac` (ladder "crm service provider", 0 drops); devaicon `1193c46c`, `82aee626` (0 drops). The "page moved" wording was checked
by site against the 10-29 reading: 1 of 9 sites in the same place for "ms 365 erp", 0 of 9 for "dynamics 365 erp system", so it is
true and not an artefact of comparing exact with approximate addresses.

**Finding for the owner:** the corrected reading confirms only part of the doc's "Search Console says techand still ranks ~25-45".
Of the three false drops, one is unchanged (#28 -> #29), one moved six places inside the top 50 (#22 -> #28), and "ms 365 erp" is not
in this one UAE desktop reading's top 45 although Search Console averaged #25.5 over 8 impressions the week before. The 11-05 report
was invalid either way (those readings could not see any site behind Google's links); the client note (`CLIENT_NOTES.md`) says exactly
this and does not claim "nothing dropped".

## 6. Spend

DataForSEO **$0.16** measured (ledger: techand $0.10, devaicon $0.06; the doc estimated ~$0.05: these are depth-50 readings),
Claude $0. Balance $32.60 before the re-run (it was $32.77 at 19:22; the difference is another session's two "Competitors" runs, not
this repair), about $32.43 after. The repair writes and the backup cost nothing.

Concurrent work seen on production during the repair (not touched): another session ran app "Competitors" runs for both sites at
19:22 (reports `ki_competitors` failed) and again at 19:44 UTC.

## 7. Not done, and why

- **App reports not marked**: no superseded flag exists (section 3). A "corrected" banner on old reports would be a product change
  (owner).
- **The two ladders built on goto readings** (devaicon `lad_mw28vc20jc4w` "agentic ai development in uae", techand `lad_mw0goinsniv1`
  "crm service provider"): not re-planned. Their rows hold no competitor or cluster data to fix; a re-plan rewrites rungs that already
  have published / writing pages, which is an owner decision. Their rung readings are repaired like the rest.
- **devaicon keyword strategy `a918573a` and the 8 content briefs since 11-04** (made while competitor pages could not be read): not
  re-run (paid Claude runs, owner decision). The briefs' pages are written; a refresh can be queued per page if the owner wants.
- **AI answers with goto citations** (10 rows in `seo_ai_answers`): left. They are history of what the AI said; the Parse AI Answers
  filter already dropped goto citations from every count.
- **Site Tracker** not re-run: its next weekly run (techand Thu 2026-11-12, devaicon Fri 2026-11-13) reads the new rank rows.
- **Client messages**: drafted in `CLIENT_NOTES.md`, not sent.

## 8. State at pause (2026-11-08 ~19:55 UTC) and next step

Every production batch above is complete (no half-applied change; job rows 44 / 117 are back to `done`). Nothing is running from this
repair; the tunnel used was another session's (this repair started none that stayed open). Next step: the owner reviews and sends the
drafts in `CLIENT_NOTES.md` (update techand's three lines first if sent after the 2026-11-12 weekly reading), then decides the open
items of section 7. Nothing else is needed to finish the repair.
