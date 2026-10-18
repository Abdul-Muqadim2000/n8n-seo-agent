# SEO Agent — handover (state on 2026-10-08, v4.10; sections 1-6 describe v4.6 unless noted)

> **2026-10-14 (evening):** the **second whole-system run** is done ($3.63 of $8, 21 protocol runs, 47 executions, all `success` — `docs/system-review-2026-10-14/RESULTS.md`) and **all 12 defects it found are fixed, deployed and pushed**, with 3 more the follow-up check found (`LIVE_CHECK_R17-R30_2026-10-14.md`, $0.069). **81 defects closed across four rounds; no defect row is open.** Harness **4277 / 0 failed**, app 387 tests, smoke green, main workflow **483 nodes**, 20 published. The three High ones: the spend guard reserved *after* it spent (R17 — now on the main path in all ten workflows, with the build walking the graph to prove it), the retry rule matched one error code so a ladder was planned on a SERP that failed twice (R18 — any task error now, and an unreadable SERP scores nothing), and 31 of 45 inspections failed unretried while the diff called the smaller sample an improvement (R19). **Secret handling (R29/R30):** the alert webhook was being baked into build output this public repo tracks — the build now bakes a placeholder, `apply_env.py` substitutes the real URL outside the repo at import, an un-substituted placeholder is treated as unset, and a build-time scanner fails on webhooks, bot tokens, API keys and private keys. **Money is now what happened** (R28, R31-R33): costs counted once, a crawl priced from pages crawled, $0 runs settling $0, and a day reconciliation that caught the engine overstating itself by 103.6% on its first run. The owner's credentials were refreshed and verified live (new Google project, Search Console Full + GA4 Viewer, Slack webhook, rotated API key, new Bing/Ahrefs keys, mail moved to devaicondeveloper3@gmail.com); **rotate everything that was pasted in chat**, the service-account key first. **Next:** the benchmark programme (`docs/system-review-2026-10-14/BENCHMARK_PROGRAM.md`) — reporting and cost control first. Still the owner's: an always-on host (D25a), a CMS (G13), the first live send (G16), the panel size (G20), G17's months of data, and O1-O12.

For whoever continues this work (a new Claude Code session or a developer). Read this first, then `CLAUDE.md` (working rules) and `REVIEW.md` (design per feature: §3c ladder, §3d tracking, §3e cadence + blog package, §3f Search Console in the audit, §3g notices + check-in, §3h E-E-A-T and page types, §3i growth monitors, **§3j no repeated work**, §3m AI visibility, **§3n backlinks from every source**; §5c live-test log; §6 roadmap). Feature specs: `LADDER_FEATURE_SPEC.md`, `TRACKING_FEATURE_SPEC.md`, `MONITORS_FEATURE_SPEC.md`, `AI_VISIBILITY_SPEC.md`, **`BACKLINKS_SPEC.md`**.

## 000. The schedule catch-up and the mail watcher (2026-10-17 re-rating C-1 / C-16)
**Missed schedules.** `SEOagentCatchUp1` sweeps every 15 minutes (`7,22,37,52 * * * *`) and at every n8n start. A scheduled run that did
not fire stays due until its next fire (a Monday run missed on Monday is still the week's run on Thursday); it is started once it is 30
minutes late, at most two a sweep. The sweep has no execution time-out (n8n counts it in wall-clock time, so a sleeping Mac cancelled
sweep 728), never acts on a plan older than 10 minutes, and retries a fire whose start it recorded but no run followed. A run started late
says so first in its report (`ran_late`, "Ran late." box, "(ran late — due …)" in the subject). The record of every sweep is the
`seo_cache` row `catchup:last`; each started fire is `catchup:<workflow id>:<due ISO>`. This does **not** replace an always-on host
(owner item D25a): while the Mac sleeps nothing runs, the catch-up only makes the week happen once it wakes.

**Is the Search Console mail watcher listening?** The API's `active: true` on `SEOagentConsole1` does not say so: its IMAP trigger drops
when the Mac wakes without DNS, and n8n's own re-activation fails and is not retried. The catch-up sweep now ends with a watchdog that
compares the Error Handler's last record of a drop (`seo_ops_alerts`, workflow *SEO Agent — Console Alerts*, node *Mailbox Trigger*)
with the last time the watcher was (re)armed, and re-activates it through the public API (deactivate + activate) when the drop is newer,
at most every 30 minutes. After three failed re-activations in a row the sweep fails with the reason, so the Error Handler sends the ops
alert. To verify:
1. Read the `seo_cache` row `catchup:watchdog:SEOagentConsole1`: `last_verdict` `listening` or `reactivate`, `last_result` "listening
   again …" with `reactivated_at`, and `failures` 0. "not listening …" with `last_error` means n8n refused the IMAP connection.
2. Prove it end to end: send any mail to the watched mailbox (INBOX of the IMAP credential). The trigger reads every new mail, so a
   `SEO Agent — Console Alerts` execution appears within a minute or two (n8n UI → Executions); a mail that is not a Search Console
   notice ends at *Ignore*, a real one also lands in `seo_console_alerts`. No execution means it is not listening, whatever the flag says.
3. `docker logs n8n-n8n-1 | grep -i "Mailbox Trigger"`: the last line must not be "Failed to reactivate trigger node".

## 00. Start here: the 2026-10-11 system review and fix plan
Every feature was run for real on techand.ai and scored against the best tools: **5/10 overall** (≈ 7 reachable after Phases 1-4).
Work through **`docs/system-review-2026-10-11/FIX_PLAN.md`** (80 items with evidence, where to fix, the fix and an acceptance test; 6 phases
sized into sessions; the re-rating protocol). Its `README.md` gives the reading order; `RESULTS.md` has the live evidence, `SCORECARD.md`
the scores, `CRITERIA_*.md` the benchmarks. Since that test the Link Builder is on for techand.ai and the Reply Reader is published.

## 0c. Link Builder v4.13 (2026-10-11) — getting links, not only listing them
Spec, research and rules: **`LINK_BUILDER_SPEC.md`**. What changed for the user: every Monday 11:00 the **Link Builder** finds link opportunities
(journalist requests, dead links to replace, resource pages, lists that leave you out, competitors' lost links), qualifies each site, finds
the right person on its own domain, picks the page of ours and the link text, and drafts a short sequence; the web app's **Link building**
page shows them for approval and sends them **from the company's own mailbox** (company settings → Mailboxes), a few a day, reads the replies
(out-of-office, bounces, opt-outs, a person: the sequence stops; a suggested answer to send in the same thread), keeps the **listings
checklist** (where to list yourself; competitors there), redirects for old URLs and what each won link did.
- **Run on demand:** `POST /webhook/seo-link-builder` `{ domain, free_only?, callback_url?, request_id? }` (header `X-API-Key`; 202), or the
  page's "Find opportunities now" (+ free check). Free check = no Claude, no DataForSEO.
- **Mailbox:** Gmail / Workspace need an App Password (2-Step Verification); Microsoft 365 SMTP with a password goes off by default end of
  December 2026 (Graph OAuth is the next step); the postal address is required (CAN-SPAM). `MAILBOX_KEY` (app/.env) encrypts passwords.
- **Paid parts (on since the 2026-10-11 whole-system test, at the owner's request):** the **Reply Reader** (`SEOagentReplyRd1`, ≈ $0.001 a
  reply; idle until a mailbox is connected) and **the Link Builder for techand.ai** (one run ≈ $0.05-0.15).
- **Tests:** harness S30 (1717 / 0), app 213 unit tests, `app/scripts/outreach_e2e.py` 31 / 31 (GreenMail), smoke 67 / 67, Playwright;
  live free runs on techand.ai (REVIEW §5c 2026-10-11).
- `apply_env.py --except=<workflow id>` imports everything but leaves that workflow unpublished.

## 0b. Backlinks from every source v4.10 (2026-10-08) — built, tested, deployed locally

Asked for: "backlinks 6.5 — DataForSEO's backlink index is smaller than Ahrefs'; use free resources over the net as well, make it the best possible". Spec with the research, every source (used and rejected), the method, costs and open items: **`BACKLINKS_SPEC.md`**.

- **More coverage, for free:** the Backlink Monitor merges DataForSEO with **Bing Webmaster Tools** (free key), **Google's own sample** (Search Console Links export uploaded in the app — the API has no links; other tools' CSVs work too, e.g. Ahrefs Webmaster Tools, free for your own site), **GA4 referrals**, the **Common Crawl web graph** (new `linkgraph` container, monthly, 133M domains), Wikipedia, Hacker News, **GDELT news** and web search (the stack's SearXNG) into one ledger per referring site (`seo_backlinks`). Coverage is measured: per source, only-one-source, and the share of Google's sample DataForSEO sees.
- **Truth, not index lag:** every important linking page is checked by our own crawler (free): rel, placement, noindex, canonical; bot-blocked / JavaScript pages rendered through Jina. **Lost = two misses in a row, with the reason** (link removed / page gone / site gone / not seen). On techand.ai's real data DataForSEO called peppol.org (authority 598) lost; the check finds it live → no false alarm.
- **Quality:** three values per link (SEO / visits / brand), the **Link Analyst** (Claude) labels link type and relevance; "best links"; free authority from Common Crawl; optional **Ahrefs DR** (free key).
- **Prospects:** + "best X" lists naming competitors, sites that just linked to a competitor, the Common Crawl gap, mentions checked on the page; scored value × likelihood; contacts found on the prospect's pages; follow-up drafts after 7 and 14 days; won only when the link is found.
- **$0 option:** form "Depth: free sources only" / API `free_only: true` (no DataForSEO, no Claude; snapshot mode `free`, so the month's full run still happens).
- **App:** new Backlinks page (coverage, link tables with values and checks, anchors, pages, opportunities, pipeline with contacts and follow-ups), CSV upload (`POST …/backlinks/import`), report renderer, recommendations.
- **Tests:** harness S28 new, S20 / S23 updated, **1512 / 0 failed**; app 186 unit tests; the Common Crawl job against a synthetic graph with dropped connections and on the real release.
- **Costs:** ≈ $0.81 / site / month (was ≈ $0.35); free-only checks $0.
- **Keys (2026-10-08):** the free Bing Webmaster and Ahrefs DR keys are in `n8n/.env` and applied (credentials `SEOcredBingWebm`, `SEOcredAhrefsDR`); techand.ai is verified in that Bing account, which reports no inbound links yet; DR works (REVIEW §5c K2, 4 defects fixed). The two keys were pasted in chat: rotate them when convenient (Bing: Settings → API access; Ahrefs: account → API keys).
- **Next (the user):** upload techand.ai's Search Console "Latest links" export in the app; go-ahead for one paid full backlink check (≈ $0.50).

## 0. AI growth v4.12 (2026-10-10) — the weekly loop that gets you named and cited

Spec: **`AI_GROWTH_SPEC.md`**. New workflow **SEO Agent — AI Growth** (`SEOagentAIGrow1`, Monday 09:30): Bing / IndexNow submission, AI-readiness of key pages, questions to win (written by the Content Cadence as AI answer / refresh pages, or as the keyword-ladder page for the same search), earned media (the pages AI cites without you, with outreach drafts), Wikidata. Page writer: `ai_target`. App: AI growth section, settings (AI pages a month, default 2), Pipeline automation, report. Harness 1642 / 0; app 196 tests; smoke 67/67; live on techand.ai (REVIEW §5c 2026-10-10). Next for the owner: upload the IndexNow key file, fill the business profile, send the drafts.

## 0a. AI search visibility v4.9 (2026-10-08) — built, tested, deployed locally

Asked for: "make AI visibility the best in its category" (it was rated 6/10 against Semrush Enterprise / Ahrefs Brand Radar: fewer questions, less often, no revenue link). Spec with research, method, costs and open items: **`AI_VISIBILITY_SPEC.md`**.

- **More questions:** the panel holds up to 50 questions (default 20 for new sites; techand.ai keeps its 8 until raised in the app). Each question has a buyer stage, topic cluster and monthly AI search volume, and new ones are written from real questions in DataForSEO's AI-answer database and the site's Search Console queries. A monthly **market-wide index** gives your share against the competitors across the whole database.
- **More often:** a new workflow, **SEO Agent — AI Pulse** (`SEOagentAIPulse1`), runs daily 06:30 Tue–Sun. It asks the panel on ChatGPT, Gemini and Google AI Mode. Rates carry 95% ranges, changes are z-tested, and pulse alerts go out only on real changes (callback `ai_pulse`).
- **Revenue:** GA4 AI referral visits / key events / revenue per assistant and landing page, compared with organic.
- **Also:**
  - Gemini now uses the real-interface scraper ($0.004, weekly).
  - Perplexity is localised to the site's country (Claude's endpoint refuses the country field; its questions name the country).
  - ChatGPT's brand list and fan-out searches are read.
  - The **Answer Analyst** (Claude) reads brands in order, sentiment and wrong claims against the business profile.
  - **AI crawler access** is checked every week (robots.txt per bot, llms.txt, CDN block test).
  - Visibility score, stage / topic breakdown, value-ranked actions.
- **Data:** new table `seo_ai_daily`. New columns on `seo_monitors`, `seo_ai_prompts`, `seo_ai_answers` and `seo_ai_visibility`, added to live tables by the new `sync_tables.py` (run by `apply_env.py`).
- **Tests:** harness S19 rewritten + S27 new, **1332 / 0 failed**. App 175 unit tests, smoke ALL PASSED, Playwright screenshots. Free live checks of GA4 and the crawler check on techand.ai passed.
- **Costs:** about $4.32 / site / month at 8 questions, $9.40 at 20 (pulse $5.92 of it). The pulse can be switched off per site.
- **Live-tested 2026-10-08** (with the pending v4.8 test, ≈ $2.75; REVIEW §5c V1-V2, K1, L2, P1, T1, C1): every path ran end to end into the app. Fixed from it: Claude's endpoint refuses the country field; a ladder with no supporting keyword now writes its main page first; Content QA marks unsourced thresholds / fines `[Confirm: AED 50m]` (no more "[Price]m") and keeps amounts from the verified facts; AI page width on phones; pulse question count and costs.
- **Next:** the owner's decision on raising techand.ai's panel to 20 (+≈ $5/month).

## 0. The web app (v4.7, 2026-10-03)

`app/` is the product front end: companies sign up (e-mail or Google), add and verify their websites, connect Search Console / GA4, give business and E-E-A-T details, start tracking, run every mode from a form and read dashboards, recommendations, runs and reports. Read `app/README.md` (run it, security model, tests) and `app/API.md`. Dev stack: `docker compose -f app/compose.dev.yml up -d` → http://localhost:5173.

n8n changes for it (applied): build section 21 (per-company rate limit for `X-Forwarded-For: app:<company>`), workflow **SEO Agent — Admin API** (`SEOagentAdminAPI`, `POST /webhook/seo-site-admin`), harness S23. Fixed on the way: the Site Tracker never stored `seo_site_metrics` (new *Metrics Rows* node).

Since then (same day): a Pipeline page (what runs automatically per site, next blog topics, calendar), e-mail switched off (everything is shown in the app), an n8n failure watcher, and the fixes of an independent security review (ownership by the person only, GA4 ids checked against the domain, site deletion stops the engine, spend caps). techand.ai's tracking was saved from the app: its weekly results now go to the app and no e-mail address is stored in n8n for it.

**Pipeline phase 2, n8n part (v4.8, built + harness 774 node runs / 0 failed, NOT deployed — run `apply_env.py` after review):** new Data Table `seo_ladder_settings` (per-ladder Auto / Manual, priority, status, plan type; `_site` row with the website defaults), read by the Content Cadence: Auto ladders in priority order (max 2 active, the rest queued), main page waits for half the supporting pages published or the main keyword in the top 30, no more pages once Won, pile-up guard at 3 unpublished pages (`force: true` bypasses it on demand), opportunity posts Auto or listed as suggestions, Manual ladders' next pages in `awaiting_approval`; Rank Tracker callback gains `won` / `stuck`. Details REVIEW §3e "Pipeline rules", spec `PIPELINE_FEATURE_SPEC.md`.

**Pipeline phase 3, n8n part (v4.8, built + harness 1160 node runs and assertions / 0 failed, NOT deployed — run `apply_env.py` after review):** the site's **reach** (the difficulty it already wins; `seo_cache` `reach:<site_id>`, 30 days) drives the ladder (rungs relative to reach; plan type direct / short / full / none from the main keyword's difficulty for this site — direct writes the main page first, not realistic plans no pages; keywords of the site's other ladders are never planned again and a duplicate main keyword is refused; one `seo_ladder_settings` row per new ladder) and discovery (every keyword labelled "Easy for your site · Direct plan · 2-4 months", Now = easy or reachable). New synchronous workflow **SEO Agent — Keyword Check** (`SEOagentAssess`, `POST /webhook/seo-keyword-assess`, ~$0.02-0.05, ~5-15 s) for the app's keyword flow; won ladders are checked monthly by the Rank Tracker. Build section 22, `build_api.py`, REVIEW §3k, spec §5 / §9.1. Live test still to do (with the user's go-ahead, about $2.50): 3 keyword checks on techand.ai, one Direct ladder run.

**Pipeline phase 4, n8n part — publish detection (v4.8, built + harness 1227 node runs and assertions / 0 failed, NOT deployed — run `apply_env.py` after review):** the Site Tracker (Monday 09:00 and on demand) now finds written pages that went live without being reported: for each site with pages waiting (content log "started" ≤ 120 days, ladder rows "writing"; none = no request) it reads `/sitemap.xml` (index → 5 newest child sitemaps), matches host-agnostically by planned slug / keyword slug, then by `<title>` / first `<h1>` of at most 15 slug-similar pages per site, and stores a match exactly like "I published a page" (shared row builder `v5/code/_publish_rows.js`: content log, ladder row, case study). The page is inspected in Search Console in the same run; report box "We found these pages live on your site … — tracking has started"; callback `detected_published` + `publish_detection`. Plain HTTP, $0. WordPress publishing is not wanted. Build section 23 + `build_site_tracker.py`, REVIEW §3l, spec §6.5, harness S26. Live check after deployment: one on-demand Site Tracker run for techand.ai (free).

Open for the user: a Google OAuth client (sign in with Google, plus the webmasters.readonly scope for "Verify with Google"), `PLATFORM_ADMIN_EMAILS`, `ai_budget_usd` sized for several companies, a public HTTPS host for production (`APP_URL`, `CALLBACK_BASE_URL`), and saving techand.ai's tracking once from the app so the Monday reports reach its dashboards.

## 1. Where things stand

- **Live on the local n8n** (http://localhost:5678, Docker Compose in `n8n/`), all published: main workflow `SEOagentV4Full01` (362 nodes), API front door, Error Handler, Rank Tracker, Site Tracker, Content Cadence, Site Admin, Console Alerts, and since v4.5 **AI Visibility Tracker** (`SEOagentAIVisib1`), **Backlink Monitor** (`SEOagentBacklnk1`), **Audit Scheduler** (`SEOagentAuditSc1`). WordPress publisher and Test Runner stay unpublished on purpose.
- **Weekly / monthly schedule**: daily 06:30 Tue–Sun **AI Pulse** (v4.9); Monday 07:00 AI visibility (ChatGPT, Gemini, Perplexity, AI Mode, AI Overview weekly; Claude, the brand question, discovery and the market-wide index on the month's first run), 07:30 backlinks (light watch; full report on the first run of each month, link gap quarterly), 08:00 Rank Tracker (unpublished, non-ranking pages monthly), 09:00 Site Tracker (with an "AI search, backlinks and technical health" block; trends and Search Console-known keywords reused), 10:00 Content Cadence; 1st of the month 06:00 technical re-audits **only for sites that changed** (sitemap fingerprint) or after 60 days.
- **Data Tables** (22): ladders, rank history, sites, site metrics, query history, trends, cadence, content log, console alerts, check-ins, profiles, case studies, and v4.5 `seo_monitors`, `seo_ai_prompts`, `seo_ai_answers`, `seo_ai_visibility`, `seo_backlink_snapshots`, `seo_link_prospects`, `seo_audits`, `seo_audit_findings`, v4.6 `seo_cache` (sitemap fingerprints, domain ages, homepage descriptions), and v4.8 `seo_ladder_settings` (per-ladder Auto / Manual, priority, status; written by the web app, read by the Content Cadence).
- **Secrets and settings** in `n8n/.env`; `python3 seo-agent/apply_env.py` (from `n8n/`) rebuilds, writes credentials, imports, publishes and restarts. Never print or export credential values.
- **Harness**: `harness/scenarios_v5.js`, **514 node runs, 0 failed** (S0-S22); real DataForSEO responses captured 2026-10-02 in `harness/fixtures_live/`.
- **techand.ai today**: tracked; ladder "e invoicing in uae"; cadence 1 page / week; 8 stored AI buyer questions, one AI-visibility baseline (named in 0% of buyer answers, recognised by 5/5 assistants), one backlink snapshot + 10 link prospects with outreach drafts, three audits (latest 79/100); **no business profile and no monitor settings yet** (defaults: everything on, competitors detected automatically).

## 2. What each version added (short)

- **v4.4 (E-E-A-T and page types)**: business profile (author box, Person schema, reviewer), hub pages, case-study intake, local pages, video schema. REVIEW §3h.
- **v4.5 (growth monitors)**: the three monitor workflows above; on-demand form / API `ai_visibility` and `backlinks`; monitor settings per site (`seo_monitors`); every audit with crawl size / JavaScript options, brand & entity check against Google Business Profile, history + "since the last audit" diff, internal links to add and a **fix pack** (robots.txt, llms.txt, redirect map, schema, internal-links.csv; zipped); Site Admin `monitors`, `prospect`, `ai_prompts`. Fixed: **e-mail attachments** (Send Email 2.1 uses `fileAttachments`; the blog package and the Site Tracker PDF were never attached before), e-mail retries, the full report's empty link gap. REVIEW §3i, `MONITORS_FEATURE_SPEC.md`.
- **v4.6 (no repeated work)**: stored results reused where they cannot have changed, a safety net where a change could be invisible, nothing that protects rankings dropped: change-aware audits (sitemap fingerprint, 60-day safety net), rank checks for unpublished non-ranking pages monthly, trends and Search Console-known keywords reused, Gemini / Claude / brand question monthly, backlink history extended and link gap quarterly, domain ages cached with free RDAP before paid WHOIS, homepage description reused 30 days, editor pass skipped only for drafts that already pass every SEO check. REVIEW §3j.

## 3. What is verified live (2026-10-02, techand.ai)

| Path | Result |
|---|---|
| AI visibility via API | 48 requests over 6 engines in 62 s, $0.87; 0 of 41 buyer answers name techand.ai, 5/5 assistants recognise it; ClearTax leads; report + callback |
| Backlinks via API | 27 s, $0.20: important lost link (robuta.com), 5 PBN links, 9 link-gap prospects, 8 outreach drafts; report + callback |
| Audit Scheduler → technical audit (×3) | 4 min each; entity check, baseline then diff, internal links, fix pack zip; **e-mail with PDF + fix-pack.zip delivered** |
| Site Tracker on demand | Monday block with the monitor numbers; **e-mail with the PDF attached** |
| Site Admin monitors / prospect / ai_prompts | each affected 1 row (test rows removed) |
| Profile mode (v4.4) | end to end |
| v4.6 reuse (Audit Scheduler monthly path, weekly AI run, Rank Tracker, Site Tracker) | audit skipped + fingerprint stored ($0); AI weekly 28 requests **$0.12** (full run $0.87), Gemini / Claude / brand carried; 1 rank check instead of 9; all 4 trends reused |

Not yet run live: a **content run** with a stored profile (hub / case study / local / video, ~$1.20 each), the **form** paths of the new options (the API paths are verified), and two v4.6 paths that need a paid run: the full report's domain-age cache (#9 below: the first report stores the ages, a second one must look nothing up) and the homepage-description cache (#3 then #5: the second run must skip *Read Website*).

## 4. Whole-system live test (the next step, agreed with the user)

Run in this order (cheap first); every row says how to start it and what proves it works. Use one e-mail address that has runs left (6 runs per address per day; profile, published and check-in runs are free), or callbacks. Rough Claude + DataForSEO cost for the whole list: about $8-10.

| # | Mode (form option / API `mode`) | What to check | ≈ cost |
|---|---|---|---|
| 1 | Set up my business profile / `profile` (techand.ai: real author, title, credentials, bio, LinkedIn; address and phone) | "Profile saved", readiness %, schema preview | free |
| 2 | Check if my keyword is right / `verdict` | verdict page / callback, PDF | $0.20 |
| 3 | I know my keyword / `keyword` (Guide, with a video URL + transcript) | page with **byline + author box**, TOC, video embed + transcript; e-mail carries **PDF, Word, .html, .md, .meta.json** | $1.20 |
| 4 | Write a case study / `case_study` | "being written" page; later the case-study page with the snapshot box; row in `seo_case_studies` | $1.20 |
| 5 | I know my keyword, page type Local page (city Dubai) | NAP block + LocalBusiness schema from the profile; *Read Website* skipped (description reused from #3, `site_description_cached`) | $1.20 |
| 6 | Suggest keywords / `discover` (+ choose a keyword on the form) | keyword strategy PDF, choice step | $0.40 |
| 7 | Rank my site for a keyword / `ladder` (1 page) | ladder plan PDF + rows; the page run arrives separately | $1.80 |
| 8 | Audit my website (technical, 500 pages) / `audit` | report section 5c (progress, links, brand, fix pack), fix-pack.zip attached | $0.10 |
| 9 | Audit my website (full report) | full report + link gap now filled; `seo_cache` gets `age:` rows; WHOIS only for domains RDAP cannot answer | $0.90 |
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
2. Gemini and Claude now run monthly in the AI check (v4.6); switch engines off entirely with Site Admin `monitors` → `ai_engines` if wanted.
3. Security hygiene from earlier sessions: rotate the keys pasted in chat. `ai_budget_usd` is $6 per day since 2026-10-02.
4. From the 2026-10-02 ladder test: the `[Price]` masking of verified amounts is fixed (2026-10-08); remove one of the two "e invoicing in uae" ladders (`lad_mur2cjwk8gp0` from the test, or the 2026-10-01 one).

## 6. Lessons from this round (also in CLAUDE.md)

- Send Email 2.1: `fileAttachments` for files; `attachmentsUi` is silently ignored. Add retries: transient DNS failures (`EAI_AGAIN`) happen.
- An n8n AI Agent node outputs only `{output}`: read context with `$('Node')` behind it.
- DataForSEO from the Mac fails TLS (proxy): probe from inside the container. `domain_intersection` wants `intersection_mode: partial`; the linking domain is `target`.
- Name-based lookups (Google Business Profile, brand mentions, short domain labels) hit other companies: accept a match only with the site's website / phone, and set explicit brand names.
- One-line JS edits with `//` comments swallow the rest of the line; keep comments at the end of statements.
- Reuse rules (v4.6): reuse a stored result only where it cannot have changed; keep a safety net where a change could be invisible (60-day audit, monthly checks); never overwrite a stored fingerprint on a skipped run; treat a failed check (−1) as "check again", not as "does not rank".
