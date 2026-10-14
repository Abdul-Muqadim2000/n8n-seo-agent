# What the SEO Agent still needs from you — setup request for the dev / IT team

**Date:** 2026-10-14 · **Status of the build:** every engineering item is finished, deployed and tested. Nothing below is a bug;
each line is a credential, a file, a host or a decision that only the owner's organisation can supply. The system's rating is
measured at **6 / 10** against the best commercial tools, and the analysis in `docs/system-review-2026-10-13/PATH_TO_8.md` shows
**8 / 10 is unreachable without the items in this document** — with everything buildable done and none of these supplied, the
ceiling is 7.46 of a required 7.5.

## How to hand things over — please read first

The repository is **public**. Nothing in this list may be committed to it, and please do **not** paste secrets into a chat window.

- **Engine secrets** go in `n8n/.env` on the machine that runs the stack (template: `n8n/.env.seo.example`). After editing it:
  `cd n8n/seo-agent && python3 apply_env.py` — that rebuilds the workflows with the new settings, writes the n8n credential
  records, re-imports, publishes and restarts n8n. A plain `docker restart` does **not** reload `.env`; use
  `cd n8n && docker compose up -d n8n` if the container was already running.
- **Web-app secrets** go in `app/.env` (template: `app/.env.example`), then restart the app container.
- Values may contain spaces and `=`; do not `source` the file in a shell, and quote nothing unless the template does.
- If a secret has already been exposed anywhere, treat it as burned and rotate it rather than reusing it.

Each item below states: **what to create · where to get it · exactly where it goes · what it unblocks.** Priority 1 is free and
blocks the most.

---

## Priority 1 — free, and each one is currently holding back a measured score

### 1.1 Enable the Chrome UX Report API (no new key)

- **What:** the existing Google Cloud API key already works for PageSpeed Insights; the **Chrome UX Report API** is simply not
  enabled on its project.
- **Where:** Google Cloud Console → the project that owns the PageSpeed key → *APIs & Services → Library* → search
  "Chrome UX Report API" → **Enable**. No key change, no new variable, no cost (free quota).
- **Goes where:** nothing to paste. `SEO_PAGESPEED_API_KEY` in `n8n/.env` is already set and stays as it is.
- **Unblocks:** real field speed data (Core Web Vitals from real Chrome users) in both audit reports. Today every audit prints
  "speed data not available" plus the enabling step, which holds the technical-audit score down.

### 1.2 An alert webhook URL (Slack or Microsoft Teams)

- **What:** an **incoming webhook URL** for the channel that should receive operational alerts.
  - Slack: *Your apps → Incoming Webhooks → Add New Webhook to Workspace* → copy the `https://hooks.slack.com/services/...` URL.
  - Teams: channel → *Connectors → Incoming Webhook* → copy the URL.
- **Goes where:** `n8n/.env` → `SEO_ALERT_WEBHOOK_URL=` (currently **empty**), then run `apply_env.py`.
- **Unblocks:** alert delivery. **No operational alert has ever reached a human.** E-mail is configured but the SMTP connection
  from inside the container has been failing (see 1.3), so a webhook is the only route that does not depend on it. Until one
  alert is delivered, the delivery-rate measurement the system now computes has nothing to measure.

### 1.3 Make outbound e-mail work, or confirm we drop it

- **What:** the Gmail App Password is already in `n8n/.env` (`SEO_SMTP_PASSWORD` is set), but sending fails intermittently with DNS
  resolution errors (`EAI_AGAIN`) from inside the Docker network, and no report e-mail has been confirmed delivered recently.
  Please check: (a) the App Password is still valid for `SEO_SMTP_USER`, (b) outbound TCP **465** is permitted from the host,
  (c) the Docker daemon's DNS can resolve `smtp.gmail.com` (corporate proxy / split-horizon DNS is the usual cause), and
  (d) whether the organisation would rather send through its own relay — if so, give us host, port, user, password.
- **Goes where:** `n8n/.env` → `SEO_SMTP_HOST`, `SEO_SMTP_USER`, `SEO_SMTP_PASSWORD` (and `SEO_MAIL_FROM` must be an address the
  relay is allowed to send as).
- **Unblocks:** every report e-mail and the error-handler alerts. The same Gmail App Password is used for `SEO_IMAP_PASSWORD`
  (already set), which powers the Search Console notification-mail watcher.

### 1.4 Upload the IndexNow key file to the website root

- **What:** a plain text file served at **`https://www.techand.ai/e474f67e21841570c3de6d7624391652.txt`** whose only content is
  the string `e474f67e21841570c3de6d7624391652`.
- **Where:** the web team / CMS. The app can also show and re-check it: *AI visibility → IndexNow → Check the file*.
- **Unblocks:** instant submission of new and changed pages to Bing and other IndexNow engines. Submissions cannot start at all
  until the file answers.

### 1.5 Export Search Console's "Latest links" and upload it in the app

- **What:** Google Search Console → the techand.ai property → *Links* → **Export external links** (CSV).
- **Where:** upload it in the web app: *Backlinks → Import*. Any backlink CSV works (Ahrefs Webmaster Tools too).
- **Unblocks:** the coverage figure of our link index against Google's own sample — a criterion scored on having it.

### 1.6 Rotate two secrets that were exposed

- **What:** `SEO_API_KEY` (the `X-API-Key` for `/webhook/seo-keyword-check`) and the **app hook token** for the techand.ai
  company. Both appeared once in local tool output during development. Also recommended, because they were pasted into a chat
  earlier in the project: the Google service-account key (`devai-seo@techand-site.iam.gserviceaccount.com`), the Bing Webmaster
  key and the Ahrefs key.
- **Goes where:** `SEO_API_KEY` in `n8n/.env` (any long random string; then `apply_env.py`). The hook token is rotated in the app.
  A service-account key is rotated in Google Cloud IAM → Service accounts → Keys (create new, update `n8n/.env`, delete old).
- **Unblocks:** nothing — this is hygiene on a public repository, and it should be done regardless of everything else.

---

## Priority 2 — decisions with a small recurring cost, each worth a measured half point or more

### 2.1 An always-on host for the stack *(the single largest structural gap)*

- **What:** the automation currently runs on a Mac that sleeps, so scheduled runs are missed — the system now measures and
  reports those misses honestly, and the criterion cannot pass until the schedules are reliable.
- **Specification:** a small always-on Linux server — **2 vCPU, 4 GB RAM, 40 GB disk** is enough — with **Docker** and
  **Docker Compose**, outbound HTTPS, and a **hostname with TLS** (a subdomain such as `seo.techand.ai` pointing at it). Roughly
  **$10–30 / month** at any provider. A production overlay already exists in `n8n/seo-agent/production/` (Postgres, Redis, queue
  mode, workers); we do the migration.
- **Goes where:** the host itself, plus `app/.env` → `CALLBACK_BASE_URL=https://<the public app URL>` (currently missing, so it
  falls back to `http://host.docker.internal:4000`, which only works on a developer machine).
- **Unblocks:** reliable schedules, the ≥ 99% delivery-rate target, and one month of elapsed schedule history for the
  measurement. **This item needs a month of calendar time after it is provisioned**, so it is the one to start first.

### 2.2 The CMS, for publishing pages automatically

- **What:** a decision plus credentials. WordPress support is already built (a sub-workflow, currently inactive), so it is the
  fastest path. If the site is not WordPress, tell us what it is (Webflow, HubSpot, Contentful, Sanity, custom API) and we build
  that connector.
- **For WordPress:** the site URL, a **user with publish rights**, and an **Application Password** for that user
  (WordPress admin → Users → the user → *Application Passwords* → add).
- **Goes where:** `n8n/.env` → `SEO_WORDPRESS_URL`, `SEO_WORDPRESS_USER`, `SEO_WORDPRESS_APP_PASSWORD` (all three currently
  **empty**), then `apply_env.py`.
- **Unblocks:** publishing a finished page straight to the site behind a human approval, instead of handing over an HTML file.
  The reporting area **must reach 8 for an overall 8**, and its final half point depends on this item.

### 2.3 The outreach mailbox, and one approved live send

- **What:** the mailbox the link-building e-mails should be sent from, **and the company's postal address** (legally required in
  the footer of outreach e-mail in the EU/UK, and we will not send without it), **and** your explicit go-ahead for the first real
  e-mail to a real recipient.
- **Two ways to connect it:**
  - **App password** (works today): the mailbox address plus an app password, entered in the app under *Company settings →
    Mailboxes*. Nothing needs to go in a file.
  - **OAuth** (recommended, and required by Microsoft as app passwords are retired) — see 2.4.
- **Unblocks:** any sending at all. Link building is scored partly on sends and replies that have actually happened, so this
  cannot be inferred from code.

### 2.4 OAuth app registrations for mailboxes (Microsoft 365 and / or Gmail)

The redirect URI for **both** providers is: **`<your app base URL>/api/mailbox-oauth/callback`**
(for local development: `http://localhost:4000/api/mailbox-oauth/callback`).

- **Microsoft 365** — Azure Portal → *Microsoft Entra ID → App registrations → New registration* → add a **Web** redirect URI as
  above → *Certificates & secrets* → new **client secret** → *API permissions* → **Microsoft Graph, delegated**:
  **`Mail.Send`**, **`Mail.Read`**, **`offline_access`** (grant admin consent if your tenant requires it). Send us:
  **client ID, client secret, tenant ID**.
  → `app/.env`: `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_CLIENT_SECRET`, `MS_OAUTH_TENANT` (`common`, `organizations`, or your tenant id).
- **Gmail** — Google Cloud Console → *APIs & Services → Credentials → Create credentials → OAuth client ID → Web application* →
  add the same redirect URI → enable the **Gmail API** → OAuth consent screen with scope
  **`https://www.googleapis.com/auth/gmail.send`**. Send us: **client ID and client secret**.
  → `app/.env`: `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`.
  **Note:** *sending* needs only the scope above. *Reading replies* from Gmail needs `gmail.readonly`, which is a Google
  **restricted scope** and requires a security assessment before Google will approve it — weeks, and possibly a fee. Microsoft
  365 reads replies with no such process, so if reply-reading matters, prefer Microsoft.
- **Until these are supplied** the OAuth buttons in the app stay disabled, with an explanation shown to the user; app-password
  mailboxes keep working.
- `MAILBOX_KEY` in `app/.env` is already set — it encrypts stored mailbox credentials (AES-256-GCM). **Do not change or lose it**,
  or every stored mailbox credential becomes unreadable.

### 2.5 The AI question panel size

- **What:** a decision, not a credential. techand.ai is tracked against **8** buyer questions today; the leaders track 20–100+.
  Raising it to 20 costs about **$5 / month** more; a 100-prompt panel costs roughly **$25–50 / site / month**.
- **Where:** we set it; just tell us the number and the monthly ceiling you accept.
- **Unblocks:** the AI-visibility depth criterion, scored directly on panel size and frequency.

### 2.6 One Anthropic Console cost export per month

- **What:** the monthly cost report for the Anthropic (Claude) organisation. Either the **CSV download** from
  console.anthropic.com → *Cost*, or an **Admin API key** so the script can call
  `GET /v1/organizations/cost_report`. **The file is the safer option** and we recommend it — an Admin key can read
  organisation-wide billing.
- **Where:** hand over the file; we run `python3 reconcile_claude_cost.py --export <file>` (dry run by default). The script never
  calls Anthropic and never reads a key.
- **Unblocks:** reconciling estimated Claude spend against the real invoice. Three model calls stream their output and therefore
  report **no token usage at all**, so their cost is computed from characters and the thinking budget and clearly labelled as an
  estimate. One real export per month corrects the per-model factors.

---

## Priority 3 — content and data decisions (no credentials, but they gate the scoring)

1. **Fill the business profile** (app → *Business profile*): author name, title, credentials, short bio, the expert reviewer, and
   the company's **street address and phone**. Add at least one case study. *Unblocks:* the author box and reviewer markup on every
   page, the AI fact check, and **six outreach drafts currently held because they would otherwise contain `[brackets]`.*
2. **Fill business facts and the call to action** (app → site settings) — they are empty today, so pages cannot quote real prices
   or timelines and the reply reader has no facts to check claims against.
3. **Decide the six written, unpublished pages.** Nothing the system has written is live yet, and **five scored criteria are
   anchored on the outcomes of our own published pages** — they cannot improve until pages are published and have a few months of
   data. This is the most time-sensitive item in the whole document. Your existing note says: do **not** publish
   "uae e invoicing penalties" (refresh the live `/insights` article instead), and publish "erp software uae" only after its
   placeholders are resolved.
4. **Fix the true findings the audit reported on techand.ai**: lorem ipsum text on `/industries`, orphaned `/whatwedo/*` pages
   with no internal links, no `Service` schema on the service pages, missing meta descriptions, and a doubled H1.
5. **Answer October's Search Console check-in** — manual actions, security issues and the Pages report cannot be read through any
   API, so the system asks a human once a month.
6. **Decide the e-invoicing position:** Tech& is not an accredited ASP. Either start MoF accreditation, or name the accredited
   partner Tech& works with and the page that says so. AI answers and outreach drafts both need a defensible claim here.
7. **Confirm the test leftovers** can stay: the Link Builder is switched on for techand.ai, the Reply Reader is published (it
   costs a fraction of a cent per reply), and the ladder `lad_mv40b6s9h5a8` ("erp software uae") exists.

---

## Explicitly *not* needed — please don't spend time on these

- **Podcast Index API key.** The variables exist in the template, but its authentication requires a `sha1(key + secret +
  timestamp)` signature that cannot be produced inside an n8n credential (environment variables are blocked on this instance), so
  the free public podcast directory is used instead. Leave `SEO_PODCASTINDEX_API_KEY` / `_SECRET` empty.
- **Any new DataForSEO, Jina, Anthropic, Bing Webmaster or Ahrefs key.** All are configured and working; the only action on them
  is the rotation in 1.6.
- **A Brave Search API key.** Optional, marginal, and nothing is scored on it.

---

## Quick reference

| Variable | File | State today | Item |
|---|---|---|---|
| `SEO_ALERT_WEBHOOK_URL` | `n8n/.env` | empty | 1.2 |
| `SEO_SMTP_PASSWORD` / relay details | `n8n/.env` | set but delivery failing | 1.3 |
| `SEO_API_KEY` | `n8n/.env` | set — **rotate** | 1.6 |
| `SEO_WORDPRESS_URL` / `_USER` / `_APP_PASSWORD` | `n8n/.env` | all empty | 2.2 |
| `MS_OAUTH_CLIENT_ID` / `_SECRET` / `_TENANT` | `app/.env` | missing | 2.4 |
| `GMAIL_OAUTH_CLIENT_ID` / `_SECRET` | `app/.env` | missing | 2.4 |
| `CALLBACK_BASE_URL` | `app/.env` | missing (dev fallback in use) | 2.1 |
| `MAILBOX_KEY` | `app/.env` | set — **do not change** | 2.4 |
| Chrome UX Report API | Google Cloud project | not enabled | 1.1 |
| IndexNow key file | website root | not uploaded | 1.4 |
| Search Console links export | app upload | not uploaded | 1.5 |
| Always-on host + TLS hostname | infrastructure | not provisioned | 2.1 |

**If you do only three things, do these:** provision the always-on host (2.1 — it needs a month of elapsed time), decide the six
written pages (3.3 — five criteria are waiting on published outcomes), and set the alert webhook (1.2 — nothing operational is
being delivered to anyone today).
