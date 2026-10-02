# SEO Agent — handover (state on 2026-10-02, v4.5)

For whoever continues this work (a new Claude Code session or a developer). Read this first, then `CLAUDE.md` (working rules) and `REVIEW.md` (design per feature: §3c ladder, §3d tracking, §3e cadence + blog package, §3f Search Console in the audit, §3g notices + check-in, §3h E-E-A-T and page types, **§3i growth monitors**; §5c live-test log; §6 roadmap). Feature specs: `LADDER_FEATURE_SPEC.md`, `TRACKING_FEATURE_SPEC.md`, `MONITORS_FEATURE_SPEC.md`.

## 1. Where things stand

- **Live on the local n8n** (http://localhost:5678, Docker Compose in `n8n/`), all published: main workflow `SEOagentV4Full01` (345 nodes), API front door, Error Handler, Rank Tracker, Site Tracker, Content Cadence, Site Admin, Console Alerts, and since v4.5 **AI Visibility Tracker** (`SEOagentAIVisib1`), **Backlink Monitor** (`SEOagentBacklnk1`), **Audit Scheduler** (`SEOagentAuditSc1`). WordPress publisher and Test Runner stay unpublished on purpose.
- **Weekly / monthly schedule**: Monday 07:00 AI visibility, 07:30 backlinks (light watch; full report on the first run of each month), 08:00 Rank Tracker, 09:00 Site Tracker (now with an "AI search, backlinks and technical health" block), 10:00 Content Cadence; 1st of the month 06:00 technical re-audits.
- **Data Tables** (20): ladders, rank history, sites, site metrics, query history, trends, cadence, content log, console alerts, check-ins, profiles, case studies, and v4.5 `seo_monitors`, `seo_ai_prompts`, `seo_ai_answers`, `seo_ai_visibility`, `seo_backlink_snapshots`, `seo_link_prospects`, `seo_audits`, `seo_audit_findings`.
- **Secrets and settings** in `n8n/.env`; `python3 seo-agent/apply_env.py` (from `n8n/`) rebuilds, writes credentials, imports, publishes and restarts. Never print or export credential values.
- **Harness**: `harness/scenarios_v5.js`, **467 node runs, 0 failed** (S0-S22); real DataForSEO responses captured 2026-10-02 in `harness/fixtures_live/`.
- **techand.ai today**: tracked; ladder "e invoicing in uae"; cadence 1 page / week; 8 stored AI buyer questions, one AI-visibility baseline (named in 0% of buyer answers, recognised by 5/5 assistants), one backlink snapshot + 10 link prospects with outreach drafts, three audits (latest 79/100); **no business profile and no monitor settings yet** (defaults: everything on, competitors detected automatically).

## 2. What each version added (short)

- **v4.4 (E-E-A-T and page types)**: business profile (author box, Person schema, reviewer), hub pages, case-study intake, local pages, video schema. REVIEW §3h.
- **v4.5 (growth monitors)**: the three monitor workflows above; on-demand form / API `ai_visibility` and `backlinks`; monitor settings per site (`seo_monitors`); every audit with crawl size / JavaScript options, brand & entity check against Google Business Profile, history + "since the last audit" diff, internal links to add and a **fix pack** (robots.txt, llms.txt, redirect map, schema, internal-links.csv; zipped); Site Admin `monitors`, `prospect`, `ai_prompts`. Fixed: **e-mail attachments** (Send Email 2.1 uses `fileAttachments`; the blog package and the Site Tracker PDF were never attached before), e-mail retries, the full report's empty link gap. REVIEW §3i, `MONITORS_FEATURE_SPEC.md`.

## 3. What is verified live (2026-10-02, techand.ai)

| Path | Result |
|---|---|
| AI visibility via API | 48 requests over 6 engines in 62 s, $0.87; 0 of 41 buyer answers name techand.ai, 5/5 assistants recognise it; ClearTax leads; report + callback |
| Backlinks via API | 27 s, $0.20: important lost link (robuta.com), 5 PBN links, 9 link-gap prospects, 8 outreach drafts; report + callback |
| Audit Scheduler → technical audit (×3) | 4 min each; entity check, baseline then diff, internal links, fix pack zip; **e-mail with PDF + fix-pack.zip delivered** |
| Site Tracker on demand | Monday block with the monitor numbers; **e-mail with the PDF attached** |
| Site Admin monitors / prospect / ai_prompts | each affected 1 row (test rows removed) |
| Profile mode (v4.4) | end to end |

Not yet run live: a **content run** with a stored profile (hub / case study / local / video, ~$1.20 each) and the **form** paths of the new options (the API paths are verified).

## 4. Whole-system live test (the next step, agreed with the user)

Run in this order (cheap first); every row says how to start it and what proves it works. Use one e-mail address that has runs left (6 runs per address per day; profile, published and check-in runs are free), or callbacks. Rough Claude + DataForSEO cost for the whole list: about $8-10.

| # | Mode (form option / API `mode`) | What to check | ≈ cost |
|---|---|---|---|
| 1 | Set up my business profile / `profile` (techand.ai: real author, title, credentials, bio, LinkedIn; address and phone) | "Profile saved", readiness %, schema preview | free |
| 2 | Check if my keyword is right / `verdict` | verdict page / callback, PDF | $0.20 |
| 3 | I know my keyword / `keyword` (Guide, with a video URL + transcript) | page with **byline + author box**, TOC, video embed + transcript; e-mail carries **PDF, Word, .html, .md, .meta.json** | $1.20 |
| 4 | Write a case study / `case_study` | "being written" page; later the case-study page with the snapshot box; row in `seo_case_studies` | $1.20 |
| 5 | I know my keyword, page type Local page (city Dubai) | NAP block + LocalBusiness schema from the profile | $1.20 |
| 6 | Suggest keywords / `discover` (+ choose a keyword on the form) | keyword strategy PDF, choice step | $0.40 |
| 7 | Rank my site for a keyword / `ladder` (1 page) | ladder plan PDF + rows; the page run arrives separately | $1.80 |
| 8 | Audit my website (technical, 500 pages) / `audit` | report section 5c (progress, links, brand, fix pack), fix-pack.zip attached | $0.10 |
| 9 | Audit my website (full report) | full report + link gap now filled | $1.30 |
| 10 | Check my AI visibility / `ai_visibility` (with competitors) | report: answer grid, share of voice, sources, actions | $0.90 |
| 11 | Check my backlinks / `backlinks` | report + prospects.csv (+ disavow list if spam) | $0.25 |
| 12 | Track my site / `track` (with competitors, blog posts per week) | first Site Tracker report with the monitor block; `seo_monitors` row | $0.10 |
| 13 | I published a page / `published` (a page from #3) | live checks incl. author, date, images, video | free |
| 14 | Search Console check-in / `checkin` | check-in recorded | free |
| 15 | Site Admin via Test Runner: `monitors` (competitors, `brand_names`), `prospect` (mark one contacted) | rows updated | free |
| 16 | Error path: API request without callback and e-mail | Error Handler e-mail to ops | free |

How to drive it: the form at http://localhost:5678/form/<Start Form webhookId> (basic auth from `.env`), or `POST /webhook/seo-keyword-check` with header `X-API-Key` (= `SEO_API_KEY`) and a local callback `http://localhost:5678/webhook/seo-callback`. Monitor and admin workflows can be started through the Test Runner (`POST /webhook/seo-test-run`, header = `SEO_API_KEY_TEST`; activate it with `POST /api/v1/workflows/SEOagentTestRun1/activate` and deactivate it afterwards). Watch executions with the n8n public API (`N8N_API_KEY`); the helper pattern used on 2026-10-02 is in REVIEW §5c.

## 5. Open items for the user

1. Real business profile for techand.ai (author, reviewer, address, phone) and monitor settings (competitors, `brand_names` such as "Tech&" so AI mentions are matched precisely).
2. Decide whether Gemini stays in the weekly AI check ($0.035 per question; switch engines with Site Admin `monitors` → `ai_engines`).
3. Security hygiene from earlier sessions: rotate the keys pasted in chat, and lower `ai_budget_usd` after testing.

## 6. Lessons from this round (also in CLAUDE.md)

- Send Email 2.1: `fileAttachments` for files; `attachmentsUi` is silently ignored. Add retries: transient DNS failures (`EAI_AGAIN`) happen.
- An n8n AI Agent node outputs only `{output}`: read context with `$('Node')` behind it.
- DataForSEO from the Mac fails TLS (proxy): probe from inside the container. `domain_intersection` wants `intersection_mode: partial`; the linking domain is `target`.
- Name-based lookups (Google Business Profile, brand mentions, short domain labels) hit other companies: accept a match only with the site's website / phone, and set explicit brand names.
- One-line JS edits with `//` comments swallow the rest of the line; keep comments at the end of statements.
