# Alaventra on Google Cloud — runbook

One Spot **e2-medium** VM (2 shared vCPU, 4 GiB) in **me-central1 (Doha)**, project **`alaventra-prod`**, address **34.18.208.219**
(`alaventra-ip`). It runs the API server, the SEO engine (n8n) and their Postgres. The web front end goes to **Vercel**. The budget is
about **$21 a month** (§9). Every script is a dry run unless you pass `--apply`.

```
browser ─► app.<domain> (Vercel: static build + app/middleware.ts)
             │ /api/*  ─────────────────────────► api.<domain>  ┐
             │ big uploads (VITE_API_ORIGIN) ───► api.<domain>  │ Caddy (HTTPS) on the VM ─► app server ─► Postgres (app)
CI / tools ─────────────────────────────────────► hooks.<domain>/webhook/* ─► n8n ─► Postgres (n8n)
you (editor) ─ IAP SSH tunnel ─► 127.0.0.1:5678 (n8n editor + API; never public)        n8n ─► app: http://host.docker.internal:4000 (inside the VM)
```

Files (all in `deploy/gcp/`):

| File | What it does |
|---|---|
| `bootstrap.sh` | creates or finds everything in GCP. Idempotent. Reuses the project, the IP and the budget made by hand |
| `load_secrets.sh` | `n8n/.env`, `app/.env` and the generated production values → 3 Secret Manager secrets |
| `startup.sh` | VM boot: data disk, swap, Docker, secrets, repository, backup timer, `docker compose up` |
| `compose.prod.yml`, `caddy/`, `postgres/` | the stack, with its memory limits and the reason for each |
| `deploy_engine.py` + `tunnel.sh` | the engine's workflows onto the VM's n8n through its public API over IAP |
| `migrate_data.py` + `migrate_data.md` | the local n8n and the app database → the VM, with row counts |
| `backup.sh` / `restore.sh` | nightly `pg_dump` → bucket / back again |
| `resize.sh` | another machine type, one command |
| `gcloud-docker.sh` | gcloud in Docker with your login (the default for every script; `GCLOUD=gcloud` uses a local SDK) |

## 1. Domain and DNS

Until a domain is chosen, the stack runs on **`34-18-208-219.sslip.io`**. sslip.io resolves `api.34-18-208-219.sslip.io` to
34.18.208.219, and Caddy gets real Let's Encrypt certificates for it. Moving to a real domain changes **one value** (`DOMAIN`):

1. DNS at your registrar (TTL 300 while you switch):

   | Name | Type | Value |
   |---|---|---|
   | `api` | A | 34.18.208.219 |
   | `hooks` | A | 34.18.208.219 |
   | `app` | CNAME | `cname.vercel-dns.com` (Vercel shows the exact target when you add the domain), **or** A 34.18.208.219 while `APP_FRONTEND=caddy` |
   | `@` / `www` | as Vercel asks | the marketing site is the same Vercel build |
   | `portal` (only for white-label, §7) | A | 34.18.208.219 |
2. `deploy/gcp/load_secrets.sh --domain example.com --apply`, then restart the stack (§3). Caddy gets the new certificates on its own.
3. Change the uptime checks: `DOMAIN=example.com deploy/gcp/bootstrap.sh --apply`. This adds checks for the new names; delete the
   two old checks in Monitoring → Uptime checks.
4. Change everything that names the old address: Vercel `API_ORIGIN` / `VITE_API_ORIGIN` / `PRIMARY_HOSTS` (§6), the Google OAuth
   redirect URIs (§6), and the SSO / SCIM settings that customers copied (§6).

## 2. Create the infrastructure

Already done on 2026-10-18 (the orchestrator ran it). The steps, for a rebuild:

1. `deploy/gcp/load_secrets.sh --reuse-local-n8n-key` (dry run). It lists key **names** only and never shows a value. Then run it
   again with `--apply`.
   - `--reuse-local-n8n-key` is required. The migrated credentials and n8n's own signing keys only open with the local instance key
     (`migrate_data.md` §2).
   - It keeps passwords already stored: a regenerated database password would lock the app and n8n out of their databases.
2. `deploy/gcp/bootstrap.sh` (dry run). Read the "would run" lines and the cost table, then run `deploy/gcp/bootstrap.sh --apply`.
   It creates, in this order:
   - a network of its own: the project's `default` network allows SSH and RDP from anywhere, and nothing of ours uses it;
   - firewall rules: 80/443 open; 22 only from IAP's range 35.235.240.0/20; 8081 only from Google's health checkers;
   - the VM's service account: reads its 3 secrets, writes logs, metrics and backups;
   - the backup bucket: 14 days, versioning, no public access;
   - the data disk with daily snapshots kept 7 days;
   - the health check, the template and a managed instance group of one Spot VM. The boot disk, data disk and IP are stateful, so
     after a preemption Google recreates the VM with the same disks and address;
   - two uptime checks with an e-mail alert to muqadim2000@gmail.com;
   - the $25 budget (found; it alerts at 50/90/100 %, it never stops anything).
3. The first boot takes about 5–10 minutes: Docker install, image pulls, building the app image. Follow it with
   `gcloud compute ssh alaventra-vm-1 --zone me-central1-a --tunnel-through-iap -- sudo journalctl -u google-startup-scripts -f`.
4. `https://api.<domain>/api/health` answers `{"ok":true,"db":true,"n8n":true}`. Until the migration, n8n has no owner or workflows.

**Data disk type.** It is `pd-balanced` 20 GB, not `pd-standard`.
- The main workflow saves its execution after every node (`saveExecutionProgress`), rewriting up to 40 MB of JSON each time.
- `pd-standard` performance scales with size: 30 GB gives about 45 write IOPS and 3.6 MiB/s.
- `pd-balanced` gives 3,000 IOPS and 140 MiB/s at any size, for $1.46 → $2.43 a month.
- For the cheaper disk, pass `DATA_TYPE=pd-standard DATA_SIZE=30` on the first `--apply` only. The disk cannot change type in place.

## 3. Day-to-day on the VM

```bash
deploy/gcp/tunnel.sh                    # n8n editor + API on http://localhost:15678 (another terminal; Ctrl-C closes)
gcloud compute ssh alaventra-vm-1 --zone me-central1-a --tunnel-through-iap      # a shell (OS Login; no public port 22)
# on the VM:
cd /mnt/data/repo/deploy/gcp
C="docker compose -p alaventra --env-file /mnt/data/secrets/prod.env -f compose.prod.yml"
sudo DATA_DIR=/mnt/data SECRETS_DIR=/mnt/data/secrets $C ps            # states + health
sudo docker stats --no-stream                                          # memory against the limits
sudo DATA_DIR=/mnt/data SECRETS_DIR=/mnt/data/secrets $C logs --tail 100 n8n
```

- **New settings:** `load_secrets.sh --apply`. Then on the VM: `sudo google_metadata_script_runner startup` (it rewrites the files and
  runs `up -d`), or reboot the VM.
- **New app code:** push to the branch the VM follows (metadata `alaventra-ref`, today `feature/seo-agent-v4.5`). Then on the VM:
  `sudo git -C /mnt/data/repo pull && sudo DATA_DIR=/mnt/data SECRETS_DIR=/mnt/data/secrets $C up -d --build app`.
- **New engine build:** `python3 deploy/gcp/deploy_engine.py --apply` with the tunnel open (§4).

## 4. The engine and its editor

- **The editor** is never public. Run `deploy/gcp/tunnel.sh` and open http://localhost:15678. Sign in with the migrated owner account,
  the same one as on the Mac.
- **Deploying workflows** uses `python3 deploy/gcp/deploy_engine.py`. Run it from the main checkout: it builds with `n8n/.env`.
  1. **The deploy guard** (`n8n/seo-agent/deploy_guard.py`) reads `seo_cycle_jobs` / `seo_cycles` on the VM. It **refuses** while a
     Cycle Dispatcher job is *starting* (between its claim and its run's ledger row) or a website's cycle or "Coming up" preview is due
     in the next 15 minutes. A *running* job is **reported, not refused**: a restart kills it, the dispatcher sees the dead run at its
     next sweep and starts it again (one of its three attempts). The Monday 07:00–12:00 window is gone with the Monday crons.
     `--force` overrides (`--force-monday` is the same flag). Tables it cannot read refuse too.
  2. It builds.
  3. It adds new Data Table columns (`sync_tables.py`) **before** any workflow changes, and stops if that fails. `sync_tables.py`
     adds columns only; a new table (`seo_cycles`, `seo_cycle_jobs`, `seo_skips`) is created by its workflow's Ensure node the first
     time that workflow runs.
  4. It updates every workflow of `n8n/seo-agent/deploy_manifest.json` through the public API. A workflow the VM does not have
     **fails the deploy** unless you pass `--create-missing`.
  5. It publishes the manifest's set, the Cycle Dispatcher included. Referenced sub-workflows go first: the API refuses a workflow
     that calls an unpublished one.
- **Options:**
  - `--credentials` rewrites the credentials from `n8n/.env`.
  - `--create-missing` imports a workflow the VM does not have yet, using n8n's CLI over IAP SSH. The public API cannot create a
    record with a fixed id.
- **First deploy of the per-website cycle** (SCHEDULING_KEYWORDS_PLAN.md §10). The VM has neither the Cycle Dispatcher
  (`SEOagentCycleDsp`) nor the rewritten Site Kickoff yet, so:
  1. `python3 deploy/gcp/deploy_engine.py` (dry run): it lists both as missing remotely and fails, naming `--create-missing`.
  2. `python3 deploy/gcp/deploy_engine.py --apply --create-missing`: imports them, then publishes every workflow, the dispatcher
     too. **Publishing it starts nothing:** with no `seo_cache` row `cycle:mode` it sweeps in `plan_only` - it plans every
     website's cycle every 5 minutes and starts no job.
  3. Read one sweep's record: the `seo_cache` row `cycle:last` (Data Tables in the editor, or the public API). It lists every
     website, its cycle and what it *would* start (`would_start`), with the reasons.
  4. **The mode flip (the owner's step):** add the `seo_cache` row `key = cycle:mode`, `kind = cycle`, `value = {"mode":"start"}`.
     The next sweep starts jobs. To stop it again, set the value to `{"mode":"plan_only"}` (or delete the row).
  5. **The watchdog:** the Schedule Catch-up (`SEOagentCatchUp1`, every 15 minutes) raises an ops alert when the dispatcher is
     inactive, or its last sweep (`cycle:last`) is older than 20 minutes, at most once every 6 hours while it lasts. Its record is
     the `seo_cache` row `catchup:watchdog:SEOagentCycleDsp`. A dispatcher a deploy left inactive is therefore seen within 20
     minutes; re-publish it with `POST /api/v1/workflows/SEOagentCycleDsp/activate`.
- **The n8n API key** is the local `N8N_API_KEY`. It stays valid because the instance key was carried over.

**Concurrency** is limited in two places, which work together:
- **n8n: `N8N_CONCURRENCY_PRODUCTION_LIMIT=4`.**
  - At most 4 executions started by a schedule or a webhook run at once. The rest wait in n8n's FIFO queue: they are not refused,
    and the queue survives a restart (docs.n8n.io/hosting/scaling/concurrency-control/).
  - 4 = the engine gate's ceiling (`_run_guard.js`: 3 other open runs + this one), with a slot left for the app's synchronous webhooks.
  - n8n does **not** count sub-workflow executions, and every heavy analysis (audit, full report, content, ladder) is one: the API
    front door, the Audit Scheduler and the Content Cadence start the main workflow with Execute Workflow.
- **The engine's own gate** (`seo_run_ledger`) is what limits heavy runs:
  - one heavy crawl per site at a time;
  - a scheduled monitor never overlaps itself;
  - a scheduled run is skipped when 3 others are open.
- **What is still missing:** "one heavy analysis at a time across all sites, queued rather than refused" needs an engine change. A
  FIFO wait in the gate is designed in the hand-off notes and not built. Until then, 2 heavy runs can overlap. That fits in memory:
  n8n may grow from 1.2 GB into 2.4 GB with swap, and the runner from 512 MB into 1 GB.

## 5. Backups and restore

Three layers:

| Layer | What | Kept |
|---|---|---|
| Nightly logical backup | `backup.sh` at 01:30 UTC (systemd timer `alaventra-backup.timer`): `pg_dump -Fc` of both databases → `gs://alaventra-prod-backups/pg/<date>/` | 14 days in the bucket, 2 nights on the disk |
| Disk snapshots | the whole data disk at 23:00 UTC | 7 days |
| Secrets | Secret Manager | the newest 2 versions of each |

**Restore one or both databases** on the VM:

```bash
sudo bash /mnt/data/repo/deploy/gcp/restore.sh --list                        # what the bucket holds
sudo bash /mnt/data/repo/deploy/gcp/restore.sh 2026-10-19                    # dry run: which dumps, what it would stop
sudo bash /mnt/data/repo/deploy/gcp/restore.sh 2026-10-19 --yes              # both; or --only app / --only n8n
```

For each database it stops the services that use it, recreates the database owned by its role, restores and starts them again.

**Rehearsed 2026-10-18** on the local copy of this stack:
- backup: n8n 178 tables / 16,868 rows, app 44 tables / 931 rows;
- then deleted every session, every run, a whole Data Table and n8n's statistics: 16,835 and 917 rows left;
- `restore.sh <dump> --yes` for each database (4 s and 6 s);
- exact counts afterwards: **n8n 178 / 16,868, app 44 / 931 — identical to the backup.**

**Restore the whole disk** from a snapshot (a lost or corrupted disk):
1. Stop the group: `gcloud compute instance-groups managed resize alaventra-mig --size 0 --zone me-central1-a`.
2. Create a disk from the snapshot: `gcloud compute disks create alaventra-data-restored --source-snapshot <name> --type pd-balanced --zone me-central1-a`.
3. Swap it into the VM's stateful configuration:
   `gcloud compute instance-groups managed instance-configs update alaventra-mig --instance alaventra-vm-1 --stateful-disk device-name=data,source=projects/alaventra-prod/zones/me-central1-a/disks/alaventra-data-restored,auto-delete=never --zone me-central1-a`.
4. Resize the group back to 1.

## 6. Vercel, Google sign-in, SSO

The web build is set up by `app/vercel.json` + `app/middleware.ts` (see `DEPLOY.md` §2): Root Directory `app`, Vite build, SPA
fallback, security headers.

1. **Vercel → Project → Environment Variables** (Production):
   - `API_ORIGIN` = `https://api.<domain>` (the middleware proxies `/api/*` there).
   - `VITE_API_ORIGIN` = the same value, set at build time (log uploads, backlink CSVs and exports go there directly).
   - `ORIGIN_SECRET` = the value of `ORIGIN_SECRET` in the `alaventra-prod-env` secret. Read it in the console, or run
     `gcloud secrets versions access latest --secret alaventra-prod-env | grep ORIGIN_SECRET` in a private terminal. With it, Caddy
     believes the visitor address and host Vercel reports. Without it, every visitor would share Vercel's address and its sign-in rate
     limits.
   - `PRIMARY_HOSTS` = `<domain>,www.<domain>,app.<domain>`.
2. **On the VM:** `load_secrets.sh --app-frontend vercel --apply`, then restart Caddy. Caddy stops answering `app.<domain>`, which
   Vercel now owns.
   - `compose.prod.yml` already sets `APP_URL=https://app.<domain>`, `PUBLIC_API_URL`, `COOKIE_DOMAIN=<domain>` and
     `CORS_ORIGINS=https://app.<domain>`.
   - The front end is then on a different host from the API. With these settings the session cookie is shared on `<domain>` and
     direct uploads are allowed from that one origin only (`app/server/src/lib/crossOrigin.ts`, 8 tests).
   - **Limits of the Vercel proxy:**
     - A proxied request may take at most 120 s (vercel.com/docs/limits, "Proxied request timeout").
     - Vercel Functions cap request bodies at 4.5 MB (vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).
       Vercel documents no body limit for rewrites, which is why the large uploads bypass the proxy.
3. **Google OAuth client** (Google Cloud Console of the project that owns the client → Credentials). Add the authorised redirect URIs:
   - `https://app.<domain>/api/auth/google/callback` (sign-in, and "Verify with Google");
   - `https://app.<domain>/api/mailbox-oauth/callback` (Gmail mailboxes; the Microsoft 365 app registration needs the same).

   With sslip.io: `https://app.34-18-208-219.sslip.io/...`. Google accepts it, but the consent screen shows that name.
4. **SSO (companies' identity providers):** the redirect / ACS URLs are built from `APP_URL`:
   - OIDC `https://app.<domain>/api/sso/oidc/callback`;
   - SAML ACS `https://app.<domain>/api/sso/saml/<connection>/acs`.

   SCIM uses `PUBLIC_API_URL`: `https://api.<domain>/api/scim/v2`. Moving the domain means each SSO customer updates these.
5. **First checks:**
   - sign in at `https://app.<domain>`;
   - open a site's dashboards;
   - run a free check-in and see its report arrive;
   - upload a small log file on the Crawlers page (the direct path);
   - the uptime checks are green (Monitoring → Uptime).

## 7. White-label portal domains with the front end on Vercel

The portal page shell is built by the API server per host (`app/docs/WHITE_LABEL.md`), so a portal host must reach it whole. There are
two ways, and the second needs no Vercel work per agency:
- **Through Vercel:** add each agency domain to the Vercel project, and drop it from `PRIMARY_HOSTS` so the middleware proxies it whole.
  The `X-Forwarded-Host` it sets is passed on by Caddy for requests carrying the origin secret.
- **Straight to the VM (recommended):**
  1. Agencies point a CNAME at `portal.<domain>`, which is an A record to the VM.
  2. Uncomment the on-demand-TLS block in `caddy/Caddyfile`. Caddy then asks `GET /api/portal/tls-allow` before issuing a certificate.
  3. Set `PORTAL_CNAME_TARGET=portal.<domain>` in `app/.env`, then `load_secrets.sh --apply`.

## 8. Preemption and the weekly schedules

- **What it looks like:**
  - Google can stop a Spot VM at any time; it gives a 30-second notice, and preemption is more likely when the zone is busy.
  - The uptime alert e-mails within about 5 minutes.
  - The group's health check sees the VM down and recreates it with the same boot disk, data disk and IP (stateful).
  - Docker, the images and the data are already on the disks, so the stack is back in about 2–4 minutes after the VM starts.
  - If Spot capacity is short in the zone, the VM stays down until there is capacity. `resize.sh` cannot help with that.
  - Moving to standard (non-Spot) provisioning costs about $13 a month more.
- **What it costs in work:**
  - A run in progress dies. Its ledger row goes stale after 2 hours and holds nothing; the customer sees the run fail.
  - A cycle due while the VM was down starts at the dispatcher's next sweep (its own "Instance Started" door, or the 5-minute
    sweep): it is a row in `seo_cycles`, not an in-memory fire. A job the VM killed is seen dead in the run ledger and n8n's
    executions and started again (three attempts). The three daily crons left (AI Pulse, Page Watch, Index Coverage) are replayed by
    the **Schedule Catch-up** (`SEOagentCatchUp1`), which also watches the dispatcher (alert after 20 minutes without a sweep).
- **Test it:** `gcloud compute instances stop alaventra-vm-1 --zone me-central1-a`. The group repairs it; watch
  `gcloud compute instance-groups managed list-instances alaventra-mig --zone me-central1-a`.

## 9. Resize

`deploy/gcp/resize.sh e2-standard-2` (dry run), then `--apply`. It makes a template for the new type and points the group at it. The VM
restarts on the new type with its disks and address, after about 2–4 minutes of downtime. Back: `resize.sh e2-medium --apply`.

e2-standard-2 (2 vCPU, 8 GiB) costs about +$12.7 a month on Spot ($8.29 core + $4.45 RAM more).

## 10. Monthly cost

From `bootstrap.sh` (Doha list prices from the Cloud Billing catalog, 2026-10-18; 730 h):

| Item | USD | |
|---|---|---|
| VM e2-medium Spot: 1 vCPU × 730 h × $0.01135 | 8.29 | list price (e2-medium bills as 1 vCPU) |
| VM e2-medium Spot: 4 GiB × 730 h × $0.001523 | 4.45 | list price |
| boot disk pd-balanced 20 GiB × $0.1215 | 2.43 | list price |
| data disk pd-balanced 20 GiB × $0.1215 | 2.43 | list price (pd-standard 30 GiB: 1.46) |
| external IP on a Spot VM: 730 h × $0.0025 | 1.82 | list price |
| snapshots ~9 GiB × $0.03159 | 0.28 | estimate |
| backup bucket ~5 GiB × $0.023 | 0.11 | estimate |
| internet egress ~8 GiB × $0.15 | 1.20 | estimate |
| Secret Manager (3 secrets, ≤ 6 active versions), uptime checks, alerting, budget, IAP, logs < 50 GiB | 0.00 | free tier |
| **Total** | **≈ 21.0** | |

Vercel (Hobby is free; a commercial site needs Pro at $20 per member per month), DataForSEO and Anthropic are billed separately.
