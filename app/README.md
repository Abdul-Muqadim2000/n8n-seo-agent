# Ascentra — web app (multi-company)

The web front end of Ascentra (the SEO Agent engine in n8n) and its public business site. Companies sign up (e-mail or Google),
add their websites, prove ownership, connect Search Console and GA4, give the business and E-E-A-T details the engine needs, start
weekly tracking, run every analysis from proper forms, and read the results in dashboards with recommendations. The SEO work
itself stays in the n8n workflows (`../n8n/seo-agent`); this app is the product around them.

```
 browser ──► app (Fastify + React, :4000) ──► n8n API front door  POST /webhook/seo-keyword-check   (start a run)
                 │        ▲                ──► n8n Admin API       POST /webhook/seo-site-admin      (pause, cadence, monitors, prospects, AI questions)
                 │        │                ──► n8n public API      GET  /api/v1/data-tables/…/rows   (dashboards read the stored results)
                 │        └── n8n callbacks POST /api/hooks/n8n/<company token>  (every result, every scheduled weekly report)
                 └──► Postgres (users, companies, members, invitations, websites, runs, reports, files)
```

- `shared/` — TypeScript used by both sides: the form schemas for all 13 modes (zod), the n8n request builder (`payload.ts`), the
  Data Table row types, API and dashboard types, constants (countries, page types, modes with cost and time).
- `server/` — Fastify 5 + Drizzle (Postgres). Auth (argon2id passwords, Google OAuth with PKCE, httpOnly session cookie), companies,
  roles, invitations, websites, ownership verification, runs, the callback receiver, dashboards, recommendations. `API.md` lists
  every endpoint.
- `web/` — React 19 + Vite + React Router 7 + TanStack Query + react-hook-form + Tailwind 4 + Recharts. `web/CONVENTIONS.md` is the
  page/UI guide.

## Run it

Development (hot reload, no Node needed on the host):

```bash
cd app
docker compose -f compose.dev.yml up -d      # web http://localhost:5173 · API http://localhost:4000 · Postgres 127.0.0.1:5433
docker compose -f compose.dev.yml logs -f server
```

The dev server reads the n8n secrets from `../n8n/.env` and writes account e-mails (verification, reset, invitations) to its log
instead of sending them (`SEO_SMTP_HOST: ''` in `compose.dev.yml`).

Production-like (one container serves the built React app and the API):

```bash
cd app
cp .env.example .env          # APP_URL, APP_DB_PASSWORD, Google OAuth client, PLATFORM_ADMIN_EMAILS
docker compose up -d --build  # http://localhost:4000
```

For a public deployment put it behind HTTPS (`APP_URL=https://…`, `TRUST_PROXY=true`) and set `CALLBACK_BASE_URL` to the public
https address: n8n only accepts https callback URLs outside localhost / host.docker.internal.

### n8n side (already applied with `python3 ../n8n/seo-agent/apply_env.py`)

- Build section 21 (`build_v4.py`): requests from the app carry `X-Forwarded-For: app:<company id>`; the Rate Limit keys them per
  company (40 runs/day) instead of one shared IP key. The global daily cap and the AI budget guard (`ai_budget_usd`) still apply to
  everything — raise `ai_budget_usd` when several companies use the platform.
- New workflow **SEO Agent — Admin API** (`SEOagentAdminAPI`, `build_api.py`): `POST /webhook/seo-site-admin` runs Site Admin and
  answers with its result.
- Harness scenario S23 runs the app's request bodies (`npm run export:payloads` writes `harness/fixtures_platform.json`) through the
  real Quick Validate, Normalize Input and Rate Limit code.

## Setting up sign-in and Google data

**Sign in with Google** (optional): Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web
application; authorised redirect URI `<APP_URL>/api/auth/google/callback` (dev: `http://localhost:5173/api/auth/google/callback`).
Put the id and secret in `app/.env` (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`). Without them the button is hidden.
The same client powers **"Verify with Google"** (domain ownership): add the scope `https://www.googleapis.com/auth/webmasters.readonly`
to the OAuth consent screen (a sensitive scope: fine for test users; Google reviews it before the app is public).

**Ownership** is proven by the person, never by the engine's service account (it sees every company's properties, so its access
proves nothing about who asks): "Verify with Google" (their own Google account must be a verified *owner* of the domain in Search
Console), a DNS TXT record `seo-agent-verification=<token>`, or a meta tag on the homepage (fetched over https from public IPs only,
on the domain itself). Verifying points the domain's stored n8n delivery (site row, ladders) at the company.

**Search Console and GA4 data** use the engine's service account (`SEO_GOOGLE_SA_EMAIL`, same credential as n8n). After
verification, the company adds that e-mail as a user of its Search Console property (Full) and GA4 property (Viewer). A GA4
property id is accepted only when one of its web streams measures the site's domain (checked across every property the account
sees); the app never shows other companies' properties.

## Guided setup ("Show me how")

Everything the app asks a person to do somewhere else — add our service account to Search Console or GA4, add the DNS record or
the meta tag, export the links CSV, put the IndexNow file on the site, connect a mailbox, apply a fix pack, publish a written page,
fill the business profile — carries a **Show me how** button next to the ask. It opens a side panel with that one job: numbered
steps you tick off (kept per browser), **your own values** in copy boxes (the real DNS record, the real key file, the real service
account address), the page to open, tabs for the provider or CMS you actually use (Cloudflare / GoDaddy / Namecheap / cPanel,
WordPress / Shopify / Wix / Squarespace / Webflow), an "If it does not work" list, and **Copy all steps** / **Send to a colleague**
— the person who can edit DNS is usually not the person reading the screen. The sidebar and the onboarding header open the
searchable catalogue of all 27 guides.

Content is data in `shared/src/guides.ts` (imported as `@seo/shared/guides`), rendered by `web/src/components/guide/`. Adding an
ask without a guide is a bug: see `web/CONVENTIONS.md` → "Setup guides".

## Report delivery (B-R1)

Company settings -> **Report delivery** (`/o/:org/settings/delivery`, owner). Finished reports are pushed out of the app instead of
waiting to be visited: `each` report as it arrives, or a `daily` / `weekly` / `monthly` summary on a chosen day and UTC hour, by
**e-mail** (figures in the message, PDF / Word / zip attached, both links) and / or to a **webhook** (JSON with a `text` line Slack,
Teams and Discord render; signed with the company's own secret, sealed under `MAILBOX_KEY`). Each report can carry its G15 share
link, so it reaches somebody with no account.

**A report the run marked not ready is never delivered** — a page that failed its quality gate (R11), a ladder the engine refused to
plan (R22 / R23), a verdict it could not check (R18), evidence it could not read, a rejected run. It keeps a `held` row with the
reason, is named in the summary that went out beside it, and stays readable in the app. "Send it now" on a report runs the same
decision; there is no override. Rules and their 41 unit tests: `shared/src/report-delivery.ts`; the service and the schedule:
`server/src/services/reportDelivery.ts` (a timer every 5 minutes sends summaries and retries failures).

E-mail delivery needs SMTP configured (`SEO_SMTP_*`); it is **not** gated on `ACCOUNT_EMAILS`, which is about verification and reset
links. Without a mail account the page says so and the webhook still works.

## Cost figures: one table (B-R3)

`shared/src/cost.ts` is the only place a per-mode price is written down, and it mirrors the engine's own calibrated defaults
(`n8n/seo-agent/v5/code/_cost_cal.js`). `MODES[].costUsd`, `estimateRunCost()` and `MONITOR_COSTS` all read it. The app's figure is a
pre-flight fallback and is labelled an estimate; **the engine's number replaces it** as soon as a run publishes one
(`run_cost_estimate_usd`), and what the run actually spent replaces both. The monthly budget and `GET .../usage` count a run the same
way, so a finished run is no longer held against the budget at the figure that was reserved for it.

## E-mail (off for now)

The platform sends no e-mail: `ENGINE_EMAILS=false` (n8n receives no address, so its "Has Email?" branches skip every report /
alert mail; saving a site's tracking also clears the e-mail stored on its n8n site and ladder rows) and `ACCOUNT_EMAILS=false`
(verification is not required, invitation links are copied from the team page, forgotten passwords get a reset link from the
platform admin page). Everything arrives in the app: Runs, Reports, the dashboards and the Pipeline page. n8n's own Error Handler
still e-mails the operator (`SEO_OPS_EMAIL`) when a workflow fails; the app marks such a run failed after 3 hours.

## Link building (v4.13)
Page **Link building** (`/o/:org/sites/:site/links`) and company settings → **Mailboxes** (`n8n/seo-agent/LINK_BUILDER_SPEC.md`). The n8n Link
Builder drafts; the app sends — from the company's own mailbox (SMTP + IMAP, app password, encrypted with `MAILBOX_KEY` in `app/.env`; without
it no mailbox can be connected), after a person approves each sequence (or automatically, owner's choice, a few a day). Jobs in the server
(`services/outreachJobs.ts`, `LINK_BUILDER_JOBS`): sender every minute (Mon-Fri window, warm-up 5 / 10 / limit, 4-9 minutes apart, footer +
opt-out, threaded follow-ups), inbox every 3 minutes (reply / out-of-office / bounce / opt-out; the Reply Reader classifies and suggests an
answer when it is published), automatic approval every 10 minutes. Tables: `mailboxes`, `outreach_sequences`, `outreach_messages`,
`suppressions` (hash + masked hint), `sites.link_settings`. Test: `python3 app/scripts/outreach_e2e.py` (GreenMail, 31 checks; `--keep FILE`
leaves the data for a browser check, `--cleanup FILE` removes it).

## AI growth (v4.12)

The AI visibility page has an **AI growth** section (`pages/site/_components/ai-growth.tsx`; data `growth` in `GET …/data/ai`, built in
`server/src/services/data.ts` from n8n's `seo_ai_growth` / `seo_ai_pages` / `seo_ai_targets` and the ai_source prospects): what the weekly
loop did (pages sent to Bing / IndexNow, key pages AI-ready, pages AI cites without you, AI pages this month), the IndexNow key file to
upload, the earned-media list with outreach drafts (copy), the questions to win ("Write it now" passes the AI target to the page form;
"Via the ladder" when a keyword-ladder page answers it) and the key pages' readiness with Bing's crawl. Settings: "AI growth (weekly)"
and "AI answer pages a month" (0-8, default 2; cost from `estimateAiGrowthCost`). The Pipeline lists the automation and the AI page of the
week (`services/cadence.ts`, same rules as n8n's `Cadence_Plan.js`); reports render `ai_growth`. Engine side: `n8n/seo-agent/AI_GROWTH_SPEC.md`.

## AI visibility (v4.9)

The AI visibility page (`pages/site/AiVisibilityPage.tsx`, panels in `_components/ai-insights.tsx`) shows, per website:
- **Tiles:** named in answers with its 95% range, the visibility score, share of voice (and market-wide share), AI visits from GA4, and pages cited.
- **Trend:** weekly runs, AI Pulse days, the score, or AI Overviews.
- **Panels:** what AI visits are worth (assistants, landing pages, conversion vs organic); how AI describes you (sentiment, words, wrong claims); can AI read your site (robots.txt per crawler, llms.txt, firewall test); visibility by buyer stage and topic; the engine table over 7 days with ranges; the question grid with this week's win rate and demand; lost questions with demand and the searches AI ran; the market-wide index; and questions worth tracking (one-click Track through Site Admin `ai_prompts`).

Monitor settings take 3–50 questions and the daily pulse, with a cost split from `estimateAiVisibilityCost` (`shared/src/constants.ts`, priced like n8n's `AI_Requests.js`). Engine side: `n8n/seo-agent/AI_VISIBILITY_SPEC.md`.

## Backlinks (v4.10)

The Backlinks page (`pages/site/BacklinksPage.tsx`) shows every referring site from every source the Backlink Monitor reads — DataForSEO, Bing Webmaster Tools, the Search Console export you upload, GA4 visits, the Common Crawl web graph, Wikipedia, Hacker News, news and web search — with what our own crawler found on the linking page:
- **Tiles:** referring sites (all sources; DataForSEO alone as the hint), best links, links checked on the page (+ at risk), visits from links, spam.
- **Where your links come from:** referring sites per source and "only here", how much of Google's own sample DataForSEO sees, the status of each free source, and **Add Search Console links** (CSV upload, `POST …/backlinks/import`, members and up; any backlink CSV works, e.g. a free Ahrefs Webmaster Tools export).
- **Links:** Best / All (source filter, search) / Lost (with the reason; "missed once" first) / New / Send visits / Spammy, each with its SEO · visits · brand value, link type, rel, placement, authority (+ Ahrefs DR with its credit) and the check.
- Anchors and most-linked pages (broken ones with the 301 to add), opportunities (unlinked mentions checked on the page, "best of" lists, competitors' new links, the gap from DataForSEO and Common Crawl), and the outreach pipeline with scores, contacts and follow-up drafts.

"Check my backlinks" has a Depth choice: the full check (~$0.50) or free sources only ($0). Engine side: `n8n/seo-agent/BACKLINKS_SPEC.md`.

## Pipeline (automation)

Each website has a Pipeline page: this week's runs, Needs you, one card per keyword ladder (in priority order), the always-on part
(opportunity posts, monitoring, the weekly capacity), every n8n schedule that runs for it (AI pulse daily 06:30 Tue–Sun — listed, not drawn in the calendar —, AI visibility Mon 07:00, backlinks 07:30,
rank tracker 08:00, site report 09:00, blog posts 10:00, technical audit 1st of the month 06:00 — on n8n's clock, `GENERIC_TIMEZONE`,
default America/New_York) with its next and last run, the posts the Content Cadence will write next (same rules as
`v5/code/Cadence_Plan.js`), a 4-week calendar and the recent automatic runs; each ladder has its own page (the climb, timeline,
results, reports). "Write now" starts a ladder page with its ladder fields and internal links, so the cadence moves on.

**Controls (Phase 2, admins; `PIPELINE_FEATURE_SPEC.md` §6-7)** — written to n8n's `seo_ladder_settings`, read by the Content Cadence
every Monday (`Cadence_Plan.js`):
- *Per keyword ladder* (card on the Pipeline page, header of the ladder page): **Auto / Manual** (Auto: its pages are written on
  Mondays in priority order; Manual: each page waits for the person's OK under Needs you, where "Write it" opens Write now with the
  ladder fields), **Pause / Resume** (no new pages, positions still checked), **Move up / Move down** on the Pipeline page (the weekly
  posts go to the ladders in this order, at most N at a time; the others wait as Queued), **Delete** on the ladder page (confirm
  dialog: removes its plan, settings and rank checks in n8n; written pages stay).
- *Pipeline settings* (dialog in the Pipeline header): default mode for new ladders, opportunity posts Auto / Manual (Manual: shown as
  suggestions with Write now), ladders written at the same time (1-5, default 2), stop writing when this many pages wait to be
  published (1-10, default 3).
- The rank tracker's `won: true` marks a ladder Won in the settings. Queued and Stuck are computed for display; the app never writes
  `stuck` (it would stop the writing in n8n).
- *What happens when* (This week, the cards' next step, the ladder timeline, Needs you) comes from `server/src/services/cadence.ts`, a
  pure mirror of `Cadence_Plan.js` run Monday by Monday: priority order, max active ladders, Manual and paused ladders skipped, won
  ladders done, the main page after half of its support is live (or the main keyword in the top 30; Direct plans main page first),
  the pile-up guard (waiting pages ≥ the limit → nothing written, shown under Needs you, also when the last cadence report said
  `paused_reason: 'pileup'`), opportunity posts only when Auto. A page waits when a content-log row of the last 120 days has any
  status but `published` — every content run writes one in n8n (v4.14, FIX_PLAN D5: the ladder's page runs, the app's "Write now",
  the cadence) — or a ladder row is still `writing` and its keyword has no published page; each keyword counts once and
  `waitingKeywords` names them. Unit tests in `server/test/cadence.test.ts` use the n8n harness's S24
  situations; it was also checked against the deployed `Cadence_Plan.js` on techand.ai's live rows.

**New keyword ladder (Phase 3, §5)** — `web/src/pages/site/NewLadderPage.tsx`, `/o/:org/sites/:site/pipeline/new` (from the Pipeline's
"New keyword ladder", its empty state, the Overview, and "Rank for this keyword" on the keyword-strategy report, which preselects the
keyword; `?keyword=&country=&tab=check`). The full ladder form stays reachable as "Advanced form".
1. *Choose*: "Recommended for you" — the keywords of the website's latest keyword strategy (`GET …/keywords/recommended`, free) as
   cards, best first, each with its difficulty for the website (Easy / Reachable / Hard / Very hard for your site), plan (Direct /
   Short ladder / Full ladder) and months, marked when a ladder already covers the search; "Choose for me" takes the first easy or
   reachable card no ladder covers; no research, or older than 90 days → "Find keywords for me" (discovery, about $0.40). "I have a
   keyword in mind" — "Check it" (`POST …/keywords/assess`, about $0.05, up to 20 s; the same keyword within 7 days is free): the same
   card; not realistic → its alternatives with "Check this one"; off-topic (`fit: 0`) → "This looks outside your business — Google
   rewards sites that stay on their topic" (a warning, not a block).
2. *Review*: the plan type and its order in plain words, expected months; the checks (duplicate / overlap notices of the ladder form
   with the tick-to-continue, topic, budget now and per month); Auto or Manual (default: the website's) and priority ("After my current
   ladders" / "Write it first") for admins; pages to write now (1-3); the business details used (read-only, link to Website settings).
3. *Start*: the `ladder` run with the website's business fields, `pagesNow`, `emailCopy: false` and `ladderPrefs` (applied when the
   plan arrives, see API.md); then the Pipeline shows "Planning your ladder …" until the plan (and the ladder's card) is there.

Keyword checks are stored in `keyword_checks` (migration `0001_keyword_checks`) and count in the company's monthly spend, the usage
page and the platform's daily ceiling, under the same per-company lock as runs (`server/src/services/spend.ts`).

**Choose keywords for me** (Pipeline settings, off by default; `_site.auto_start`): "When fewer ladders than your limit are being
written, start the next recommended keyword that is easy or reachable for your site." The server does it every 6 hours only with
`AUTO_START_LADDERS=true` (`app/.env`; keep it off in development): the rules (at most one start a week per website, never a keyword
a ladder covers or one started before, not while pages pile up, within the budget) are in API.md and `server/src/services/autoStart.ts`.

**Publish detection (Phase 4, display)**: when the weekly site report lists `detected_published`, the page counts as published in its
ladder ("We found … live at …: spotted automatically by the weekly site check" in the timeline), the Pipeline's recent activity says
"We found your page live at …", and the site-report view lists them.

**Manual runs next to the pipeline** (`shared/src/pipeline-notices.ts`, shown on the tool forms): the person can always run a
tool by hand; the form says what that means for the schedule, in terms of what n8n really does:
- *The schedule does it too* (AI visibility, backlinks, audit): next and last automatic run, and the effect of a run now. The
  schedule is never moved or cancelled; a manual AI check asks Gemini and Claude, so later runs that month reuse them; a manual
  backlink check is the month's full report, so later Mondays are light; the 1st-of-month audit skips a site audited less than
  25 days before.
- *The pipeline adapts* (a page for a keyword in the blog queue, a planned ladder page, a new ladder): the page is logged in
  `seo_content_log` and taken off the queue, a typed ladder keyword is written as that ladder page (the server attaches the ladder
  fields), a new ladder's pages join the weekly posts and the rank tracker. A queued keyword that already ranks offers
  "Improve <page> instead".
- *Likely duplicate* (the schedule is executing it right now — n8n executions with mode `trigger`; the same run already going in
  the app; a page already written or published for the keyword; a ladder for the same head term): a warning, and the run starts
  only after the person ticks "… anyway".

## Brand and business site

The product is called **Ascentra** ("Enterprise-grade autonomous SEO"); "SEO Agent" stays only as the internal name of the n8n
engine and of this repository.

- **Brand kit**: `web/brand/BRAND.md` (logo rules, colours, type, voice) and `web/brand/tokens.css` (the kit's raw values). The app's
  tokens live in `web/src/index.css` (light + dark); components use them through Tailwind classes, never hex. Ascentra Blue is the
  only accent, no gradients.
- **Logos and icons**: the supplied SVGs in `web/public/brand/` (horizontal / stacked / header / mark / wordmark in ink, blue, white),
  favicons, `site.webmanifest` and `og-image.png` in `web/public/`. Use the files as they are — never redraw, recolour or animate rays.
- **Fonts are self-hosted** (`@fontsource-variable/sora`, `geist`, `geist-mono`, imported in `web/src/main.tsx` and bundled by Vite):
  the production CSP (`server/src/app.ts`) allows fonts, scripts and styles only from the app's own origin, so a Google Fonts link
  would be blocked. The same CSP is why the business site has no external scripts, embeds or iframes; remote `https:` images are
  allowed (the marketing photos).
- **Business site routes** (public, lazy chunks that signed-in app pages never load): `/` (visitors; signed-in users go straight into
  the app), `/platform`, `/platform/<slug>` (one per capability), `/how-it-works`, `/solutions`, `/solutions/<slug>`, `/pricing`,
  `/security`, `/about`, `/contact`, `/changelog`, `/privacy`, `/terms`. An unknown slug shows the 404 page.
- **Content registries** in `web/src/marketing/content/`: `features.ts` (the capabilities: Home grid, Platform page, mega-menu,
  footer and every `/platform/<slug>` page render from it), `solutions.ts`, `pricing.ts`, `changelog.ts` (add an entry with every
  release), `site.ts` (name, e-mail addresses, navigation, integrations), `images.ts` (every photo). How to add a capability:
  `web/CONVENTIONS.md` → "Business site".
- **PLACEHOLDER — confirm before launch** (marked `// PLACEHOLDER` in the code): every price, plan limit, the annual discount and the
  billing answers in `pricing.ts`; the `@ascentra.example` e-mail addresses in `site.ts` (the contact form opens a `mailto:`);
  the Unsplash photos in `images.ts`; the privacy policy and terms in `marketing/components/company/legal.ts` (drafts for counsel).
  Copy uses capability facts only — no invented customers, logos, ratings or results.

## Security model

- **Companies are isolated**: every company route checks membership (404 for companies you do not belong to); roles
  viewer < member (start runs) < admin (websites, team, site settings) < owner (budget, delete company).
- **Domain ownership**: the n8n Data Tables are keyed by domain, not by company. Dashboards, site runs and site admin actions are
  open only for a verified website, and a domain can be verified by one company only (partial unique index). Verification:
  "Verify with Google" (the person's own Google account owns the Search Console property), a DNS TXT record
  `seo-agent-verification=<token>`, or a meta tag. The shared service account seeing a property never counts.
- **Callbacks**: n8n posts results to `/api/hooks/n8n/<token>`; the token is random per company and never stored in a report.
- **Sessions**: random 256-bit cookie (httpOnly, SameSite=Lax, Secure on https), only its SHA-256 is stored; 30 days, sliding.
  State-changing requests need `X-Requested-With: fetch` (CSRF guard). Login, sign-up and reset are rate limited.
- **Share links** (G15, `/share/:token`, details in `API.md`): an admin can hand **one report** to somebody with no account through an
  expiring link — 256-bit token, only its SHA-256 stored, 14 days by default (1-90), revocable at any time, with who created it and
  when it was last opened on record. A holder reaches that report's headline figures and *its* files (same sandboxed file handling as
  inside the app) and nothing else: no other report, no list, no dashboard, no payload, no company id, no write. A wrong, revoked or
  expired token is a rate-limited 404 with no hint.
- **Secrets** (n8n webhook key, n8n API key, SMTP, service-account key) stay on the server.
- Generated HTML (articles) is shown in a sandboxed iframe and downloaded, never served as a page of the app.
- **Spend**: each company has a monthly budget (estimated cost per run and per keyword check, checked with the insert under a per-company lock before
  n8n is called; owners may set up to `OWNER_BUDGET_MAX_USD`, platform admins more), a person may create
  `MAX_COMPANIES_PER_USER` companies, and all companies together stay under `PLATFORM_DAILY_SPEND_USD` a day. Platform admins
  (`PLATFORM_ADMIN_EMAILS`) see every company's spend and can disable a company.
- **Deleting** a website (or a company) stops the engine for the domain: its n8n site row and ladders are removed (history stays),
  so no monitor keeps spending or reporting to the old company.
- **Engine failures** show in the app within ~2 minutes: the server reads n8n's failed executions and marks the matching run
  failed with n8n's error (the 3-hour timeout stays as a safety net).
- Signing in with Google to an account whose e-mail was never confirmed drops that account's password and sessions (whoever
  created it may not own the address). Changing a password signs out the other sessions. `next` links are same-origin paths only.
- Logs: callback tokens are redacted; reset / verification links are logged only in development.

## Tests

```bash
cd app
docker run --rm -v "$PWD":/app -w /app node:22-bookworm-slim npm test          # unit tests (shared + server)
docker run --rm -v "$PWD":/app -w /app node:22-bookworm-slim npm run typecheck # shared + server + web
python3 scripts/smoke.py          # API integration test against the running dev stack (auth, roles, isolation, budget, callbacks)
# n8n contract: cd ../n8n/seo-agent/harness … scenarios_v5.js (S23 = the app's request bodies)
```

## Where to change what

| Change | Where |
|---|---|
| A form field / a new mode | `shared/src/schemas.ts` (schema), `shared/src/payload.ts` (n8n body; keep the key-order rule), `npm run export:payloads` + harness S23, the form in `web/src/pages/tools/` |
| What a dashboard shows | `server/src/services/data.ts` (shape), `shared/src/data.ts` (type), `web/src/pages/site/` |
| Recommendations | `server/src/services/recommendations.ts` |
| What the weekly posts write (the Pipeline's "This week", next steps) | `server/src/services/cadence.ts` — a mirror of n8n's `Cadence_Plan.js`: change both together (`server/test/cadence.test.ts`) |
| Ladder controls / pipeline settings | `server/src/routes/ladders.ts`, `server/src/services/ladderSettings.ts` (rows of `seo_ladder_settings`), `web/src/pages/site/_components/pipeline/controls.tsx` |
| Keyword check, recommended keywords, the new-ladder flow | `server/src/routes/keywords.ts`, `server/src/services/keywordChecks.ts` (+ `keywordCheckStore.ts`), `shared/src/keywords.ts` (words, `recommendedFromStrategy`, `chooseForMe`), `web/src/pages/site/NewLadderPage.tsx` |
| Spend and budget checks (runs + keyword checks) | `server/src/services/spend.ts` |
| "Choose keywords for me" | `server/src/services/autoStart.ts` (decision + job), timer in `server/src/index.ts` (`AUTO_START_LADDERS`) |
| A callback stage | `server/src/services/summaries.ts` (list summary), `web/src/components/reports/` (renderer), `shared/src/constants.ts` (`STAGE_LABELS`, `MODES[…].finalStages`) |
| Database | `server/src/db/schema.ts`, then `npm run db:generate` (migrations run at start) |
| A guide ("Show me how") or a new ask that needs one | `shared/src/guides.ts` (+ `guides.test.ts`), trigger with `GuideButton` from `web/src/components/guide` |
| Business site copy, a new capability, prices | `web/src/marketing/content/` (registries), pages in `web/src/marketing/pages/`; steps in `web/CONVENTIONS.md` → "Business site" |
