# Deploying Alaventra

Three parts, each deployable on its own:

| Part | What it is | Where it runs | Built from |
|---|---|---|---|
| **Web** | the React app and the marketing site (static) + a routing middleware | **Vercel** | `app/` (`app/vercel.json`, `app/middleware.ts`) |
| **API** | Fastify server + its Postgres (accounts, companies, runs, reports, mailboxes, jobs) | any container host | `app/Dockerfile` → `ghcr.io/<owner>/alaventra-api` |
| **Engine** | n8n with the SEO Agent workflows baked in + its Postgres | any container host | `n8n/deploy/Dockerfile` → `ghcr.io/<owner>/alaventra-engine` |

```
browser ──► Vercel (static web)
              │  /api/*  and every request to an agency-portal domain   (app/middleware.ts, same origin: cookies stay first-party)
              ▼
            API  (alaventra-api) ── Postgres
              │  runs, site admin, keyword checks ─►  Engine (alaventra-engine) ── Postgres
              ◄──────── results: POST /api/hooks/n8n/<company token> ──┘
```

The API and the engine hosts are still being chosen; everything below is host-neutral, with the host-specific step called out.

---

## 1. GitHub (once)

**Workflows** (`.github/workflows/`):

| Workflow | Runs on | Does |
|---|---|---|
| `ci.yml` — CI | every PR and push | app typecheck + unit tests + build; the three real-Postgres suites; engine build (all asserted patches and the four invariant lints) + harness (must end `0 failed`); both images build |
| `security.yml` — Security | every PR and push, Mondays | TruffleHog secret scan (verified + unknown), CodeQL (JS/TS, Python, Actions; findings in the Security tab), dependency review on PRs (fails on high), `npm audit` of production dependencies |
| `images.yml` — Images | CI green on `main`, `v*` tags | pushes both images to GHCR tagged with the commit SHA (+ `main`, + semver on tags), with SBOM, provenance attestation and a Trivy scan |
| `deploy-web.yml` — Deploy web | PRs (preview), CI green on `main` (production) | Vercel preview with the address commented on the PR; production only after CI passed on that commit |
| `dependabot.yml` | weekly | grouped npm / Docker / Actions updates (n8n minor / major is moved by hand) |

`workflow_run` workflows (Images, the production deploy) only start once these files are on the **default branch** (`main`).

**Settings** (repository → Settings):
- **Branch protection on `main`**: require a pull request, require these checks: `app (typecheck, unit tests, build)`,
  `app (real Postgres suites)`, `engine (build + lints + harness)`, `images (build only)`, `secret scan (TruffleHog)`; no force pushes.
- **Code security**: secret scanning **with push protection**, Dependabot alerts, private vulnerability reporting (`SECURITY.md`).
- **Environments**: `production` with required reviewers (the production web deploy waits for an approval), `preview`.
- **Secrets**: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (section 2). **Variables**: `PRODUCTION_URL` (e.g. `https://alaventra.com`)
  for the post-deploy smoke check.
- Packages: after the first Images run, make `alaventra-api` / `alaventra-engine` private or public as you prefer (GHCR → package settings)
  and give the hosts a read token if private.

The repository has moved to `Abdul-Muqadim2000/n8n-seo-agent` (pushes to the old address redirect); set `origin` to the new URL.

## 2. Web on Vercel

1. New Vercel project from this repository, **Root Directory `app`**. `app/vercel.json` sets the rest (Vite, `npm ci`, build
   `@seo/web`, output `web/dist`, SPA fallback, security headers matching the API's helmet CSP, immutable `/assets/*`) and turns
   Vercel's own Git deployments **off** — GitHub Actions deploys, after CI.
2. Environment variables (Production and Preview separately):
   - `API_ORIGIN` — the API's https origin, e.g. `https://api.alaventra.com` (Preview can point at a staging API). Unset: `/api` answers 503.
   - `PRIMARY_HOSTS` — our own hosts, comma-separated (`alaventra.com,www.alaventra.com`). Any other host is an agency portal and is
     proxied whole to the API, which serves the portal's own page shell. Leave unset until portal domains are added to the Vercel
     project. `*.vercel.app` always counts as ours.
3. `npx vercel link` in `app/` once → `app/.vercel/project.json` holds `orgId` / `projectId` → GitHub secrets `VERCEL_ORG_ID` /
   `VERCEL_PROJECT_ID`; a token from Vercel → Account → Tokens → `VERCEL_TOKEN`. (`.vercel/` is not committed.)
4. Domains: add the production domain in Vercel; for white-label portals each agency domain is added to the project too.

## 3. API (any container host)

Image `ghcr.io/<owner>/alaventra-api:<commit sha>`. Listens on `$PORT` (default 4000); health `GET /api/health` (503 when the database
is down). Database migrations run at start. Run **one** instance (the mailbox sender, inbox reader, crawler and portal jobs run in
it; a second instance needs `LINK_BUILDER_JOBS=false`, `CRAWLER_JOBS=false`, `PORTAL_JOBS=false`).

Settings — locally some came from `n8n/.env`; on a host all are plain environment variables (secrets in the host's secret store):

| Setting | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the host's Postgres; managed Postgres needs TLS: append `?sslmode=require` |
| `APP_URL` | the public web address (the Vercel domain), e.g. `https://alaventra.com` — links in e-mails, the Google sign-in redirect, cookies |
| `TRUST_PROXY` | `2` behind Vercel + the host's router (client address from `X-Forwarded-For`, host from `X-Forwarded-Host`) |
| `CALLBACK_BASE_URL` | the API's own https address the engine posts results to (its host URL, or the web domain) |
| `N8N_BASE_URL` | the engine's https address |
| `N8N_API_KEY` | an n8n API key created in the engine (Settings → n8n API) |
| `SEO_API_KEY` | the engine's API caller secret (same value as its "SEO API Key" credential) |
| `N8N_PROJECT_ID` | the engine project holding the Data Tables (n8n → project URL) |
| `MAILBOX_KEY`, `IDENTITY_KEY` | `openssl rand -hex 32` each; never change them afterwards |
| `SEO_BRAND`, `SEO_MAIL_FROM`, `SEO_SMTP_*`, `SEO_GOOGLE_SA_EMAIL`, `SEO_GOOGLE_SA_PRIVATE_KEY` | as in `n8n/.env` |
| `GOOGLE_OAUTH_*`, `GMAIL_OAUTH_*`, `MS_OAUTH_*`, `PLATFORM_ADMIN_EMAILS`, budgets, `ALLOW_SIGNUP`, e-mail switches | as in `app/.env.example` |

`GOOGLE_OAUTH` redirect URIs become `https://<web domain>/api/auth/google/callback` (it goes through Vercel). Disk is not needed except
`LOG_SPOOL_DIR` for uploaded crawler logs (point it at a volume if the host has one).

## 4. Engine (any container host)

Image `ghcr.io/<owner>/alaventra-engine:<commit sha>`: n8n `2.41.4` (same as the local stack), the workflows of `deploy_manifest.json`,
Code nodes in n8n's own task runner, one container. It maps the usual host conventions itself: `PORT` → n8n's port (plus a loopback
on 5678, which the workflows call), `DATABASE_URL` → n8n's Postgres settings with TLS.

**Release step** — run `seo-release` (the image's command) as the host's release / pre-deploy command, against the same database:
it imports the credentials and the workflows and publishes them; the new web process picks them up when it starts. It refuses
Monday 07:00–12:00 New York (the weekly runs; `SEO_DEPLOY_FORCE_MONDAY=true` overrides, the Schedule Catch-up then restarts what was
missed) and fails the release if any workflow does not publish, so the previous release keeps running.

| Setting | Value |
|---|---|
| `N8N_ENCRYPTION_KEY` | **required**, a long random string, the same for the release step and the web process; never change it (it encrypts every credential) |
| `DATABASE_URL` (or `DB_TYPE=postgresdb` + `DB_POSTGRESDB_*`) | the engine's Postgres |
| `WEBHOOK_URL`, `N8N_EDITOR_BASE_URL` | the engine's public https address, e.g. `https://engine.alaventra.com/` |
| `SEO_CREDENTIALS_B64` | release step: `python3 n8n/seo-agent/sync_credentials.py --out creds.json` locally, `base64 < creds.json`, store as a secret, delete the file |
| `SEO_ALERT_WEBHOOK_URL` | release step, optional: the ops alert webhook (substituted at import, never in the image) |
| `SEO_PUBLISH_CONSOLE_ALERTS` | `true` once the IMAP credential exists |
| `SEO_HOLD_WORKFLOWS` | optional ids imported but not published (e.g. `SEOagentReplyRd1`) |

Run **one** always-on instance: the weekly and daily schedules live in it (two instances would run them twice; a host that sleeps
skips them — no free / "eco" tier). After an upgrade with new Data Table columns, run
`N8N_PUBLIC_URL=https://<engine> N8N_API_KEY=… python3 n8n/seo-agent/sync_tables.py`.

**Not in the single container yet** (they are separate services in `n8n/compose.override.yml`): Gotenberg — reports fall back to
the Word/HTML file instead of PDF; SearXNG — the free web-search link sources are skipped; the Common Crawl `linkgraph` job. Each
can run as its own service; the workflows still name them by their compose host names, so that needs a build setting first.

**First start**: open the engine's address and create the owner account straight away — until then **anyone who opens `/setup`
can claim the instance**. Then Settings → n8n API → create the key for the API (`N8N_API_KEY`).

## 5. First deploy, in order

1. Engine: database, settings, release step with `SEO_CREDENTIALS_B64`, web process → owner account → API key.
2. API: database, settings (with the engine's address and keys) → `GET /api/health` shows `db: true, n8n: true`.
3. Vercel: `API_ORIGIN` → production deploy → sign up, add a website, run a free check-in; the result comes back as a report.
4. Point every site's callbacks at the new API: in the app, save tracking once per website.
