# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub: **Security → Report a vulnerability** on this repository (private
vulnerability reporting). Do not open a public issue, pull request or discussion for a security problem.

Include what you found, where (URL, endpoint or file), how to reproduce it and what an attacker could do with it. We acknowledge
reports within 3 working days and keep you informed until the issue is fixed.

## Scope

The Alaventra web app and API (`app/`), the engine workflows and their build (`n8n/`), the container images published from this
repository, and the deployment configuration (`app/vercel.json`, `app/middleware.ts`, `.github/`).

Out of scope: findings that need a compromised account or device, missing hardening headers without a demonstrated impact,
volumetric denial of service, and reports produced only by automated scanners.

## Secrets

This repository is public. Secrets live only in the hosts' secret stores (Vercel, the API host, the engine host, GitHub Actions
secrets) and in local `.env` files that are never committed. Every push is scanned (`.github/workflows/security.yml` and the engine
build's own scanner); a secret that reached the repository is treated as leaked and rotated, never just deleted.
