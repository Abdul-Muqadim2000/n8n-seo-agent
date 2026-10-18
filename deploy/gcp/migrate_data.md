# Moving the local data to the production VM

What moves: the n8n engine's state (workflows, credentials, the owner and its API key, the project, **every Data Table with all its
rows**, optionally the execution history) and the app's database (companies, users, sites, runs, reports and their files, sealed
secrets). Script: `deploy/gcp/migrate_data.py` (dry run by default). Rehearsed on 2026-10-18 against a local copy of the production
stack: identical row counts on both sides (below, §5).

## 1. What the local side is (checked read-only, 2026-10-18)

| | Local | Production |
|---|---|---|
| n8n | 2.41.4 (`docker exec n8n-n8n-1 n8n --version`), **SQLite** (`DB_TYPE` unset), 1.3 GB file, 26 workflows, 13 credentials, 36 Data Tables / 5,375 rows, 567 executions | 2.41.4, Postgres 17 (`n8n` database) |
| app | Postgres 17, container `seo-platform-dev-db-1`, database `seo`, 44 tables / 1,326 rows, 30 MB | Postgres 17 (`app` database, role `app`) |

## 2. n8n: the supported path for this version

n8n's CLI documents `export:entities` / `import:entities` for exactly this move — "export all entity types from one database type,
such as SQLite, and import them into another database type, such as Postgres"; the target "is expected to be empty prior to import,
this can be forced with the `--truncateTables` parameter"; execution history is excluded unless `--includeExecutionHistoryDataTables`
(https://docs.n8n.io/deploy/host-n8n/configure-n8n/use-the-command-line). In 2.41.4 `--includeDataTableRows` defaults to true, so the
Data Tables come with their rows (verified: the archive holds one `data_table_user_<id>` file per table).

Found while rehearsing — all handled by the script:

1. **The instance key must be the local one.** The archive is encrypted with the instance key, and n8n 2.41.4 also stores its own
   signing keys (`deployment_key`: `signing.hmac`, `signing.jwt`) encrypted with it. With any other key the imported instance does not
   start: `Deployment key 'signing.hmac' cannot be read with this instance encryption key`. That is why `load_secrets.sh` is run with
   `--reuse-local-n8n-key`. Kept key = the credentials decrypt and the existing `N8N_API_KEY` stays valid on the server.
2. **n8n pins its key in `/home/node/.n8n/config` on first start.** Changing `N8N_ENCRYPTION_KEY` later stops n8n with "Mismatching
   encryption keys". If the VM ever started with a different key, stop n8n, delete `/mnt/data/n8n/config`, start it again.
3. **The import needs the Postgres superuser** (`permission denied to set parameter "session_replication_role"` as the n8n role), and
   the tables it creates — every Data Table — then belong to `postgres`, so n8n could neither write a row nor add a column (the
   rehearsal's `sync_tables.py` answered 500 for 16 columns). `postgres/fix_owner.sql` hands them to `n8n` right after the import.
4. The import's "Total entities imported" leaves out the Data Table rows (11,271 = 16,646 exported − 5,375 rows); the row counts are
   what proves them.

## 3. The app database

`pg_dump -Fc --no-owner --no-acl` of the local database → over IAP SSH → the app is stopped → `app` is dropped and created again owned
by `app` → `pg_restore --no-owner --role=app` (every object belongs to `app`) → the app is started; its migrations find themselves
already applied (the dump carries `drizzle.__drizzle_migrations`) and add only what is newer. The sealed mailbox / CMS / two-step
secrets need the same `MAILBOX_KEY` (it travels in the `alaventra-app-env` secret).

## 4. The order on cut-over day

1. `deploy/gcp/load_secrets.sh --apply --reuse-local-n8n-key` (done 2026-10-18) — the VM has the local key.
2. Let no run be in progress locally (the Pipeline page, or n8n's Executions list). Do it outside the Monday window.
3. `python3 deploy/gcp/migrate_data.py` — dry run: versions, local counts, the plan.
4. `python3 deploy/gcp/migrate_data.py --apply` — app first, then n8n. Each half ends with `IDENTICAL` or the table-by-table difference
   (exit code 1).
5. `deploy/gcp/tunnel.sh` (another terminal) then `python3 deploy/gcp/deploy_engine.py --apply` — the current build on top of the
   imported workflows, everything in the manifest published, new Data Table columns added.
6. **Stop the local engine: `cd n8n && docker compose stop n8n`.** The imported workflows are published on the VM; with both running,
   every weekly / daily schedule fires twice (twice the spend, two reports).
7. Check: sign in at `https://app.<domain>`, open a site's dashboards (Data Tables through the app), run one free check (a check-in),
   see the report arrive (the callback goes `n8n -> host.docker.internal:4000` inside the VM).

Execution history (`--with-history`) is optional: it is most of the SQLite file, n8n prunes it after 14 days anyway, and only
`run_report.py` / `capture_runs.py` read it.

## 5. The rehearsal (2026-10-18, local, nothing real touched)

- Source: a **copy** of the SQLite file (`docker cp`, `PRAGMA quick_check` = ok) read by throwaway containers on a network-less run
  (`SOURCE_DIR`), and a read-only `pg_dump` of the dev app database.
- Target: the production compose (`compose.prod.yml`) running locally as project `alaventra-scratch` with the same memory limits.
- `MIGRATE_TARGET_LOCAL=1` runs the exact VM-side commands against that project instead of over SSH.
- Result: **app 44 tables / 1,326 rows → 44 / 1,326, IDENTICAL; n8n 36 Data Tables / 5,375 rows → 36 / 5,375, IDENTICAL**; workflows
  26 = 26, credentials 13 = 13, users 1 = 1, API keys 1 = 1, Data Table columns 714 = 714. Then `deploy_engine.py --apply` on the
  migrated instance: 23 workflows updated, 22 published, 16 new Data Table columns added (after the ownership fix).
- The rehearsal ran with a throwaway instance key, so its imported instance had to drop the copied signing keys to start — the
  finding in §2.1; production avoids it by reusing the key.
