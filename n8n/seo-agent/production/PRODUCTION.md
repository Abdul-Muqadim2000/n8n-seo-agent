# Taking the SEO Agent to production

The local stack (compose.yml) is fine for building. Before customers depend on it, switch to `compose.prod.yml`:

| Local today | Production overlay | Why it matters |
|---|---|---|
| SQLite in the container volume | Postgres 16 | Concurrent long runs, no DB locks, backups with `pg_dump` |
| Single process | Main + 2 workers, Redis queue | A 20-minute audit no longer blocks form submissions; scale by adding workers |
| Auto-generated encryption key | Pinned `N8N_ENCRYPTION_KEY` | Credentials survive volume loss / re-deploys |
| `localhost` URLs | `WEBHOOK_URL=https://<host>/` | Form links, webhook URLs and Wait-node resume URLs must be public |
| No pruning config | 14-day execution retention | Full-report executions carry MBs of crawl data |
| Reports as .doc only | Gotenberg PDF service | Customer-ready PDFs |

## Migration steps (about 30 minutes)

1. `docker exec n8n-n8n-1 n8n export:workflow --all --output=/tmp/wf.json` and `n8n export:credentials --all --decrypted --output=/tmp/cred.json` (run this yourself; the decrypted file contains your API keys — delete it afterwards).
2. Copy both files out of the container, stop the old stack (`docker compose down`, the volume keeps the SQLite data as a fallback).
3. Fill `.env.prod`, start `docker compose --env-file .env.prod -f compose.prod.yml up -d`, create the owner account.
4. Import: `n8n import:credentials --input=/tmp/cred.json` then `n8n import:workflow --input=/tmp/wf.json --projectId=<your project id>`.
5. Put a TLS reverse proxy in front of 127.0.0.1:5678 and point `N8N_HOST` at it.
6. Re-activate **SEO Agent v4** and **SEO Agent — API**; run the API smoke test from REVIEW.md §5.

## Operational checklist

- Backups: nightly `pg_dump`, plus `n8n export:workflow --all` into git.
- Monitoring: `/healthz` on the main container, `/healthz/readiness` for workers; alert on the Error Handler emails.
- Cost: DataForSEO balance alerts; Anthropic usage limits per key.
- Secrets rotation: rotate the DataForSEO/Jina/Anthropic keys in n8n Credentials only (never in the workflow JSON).
