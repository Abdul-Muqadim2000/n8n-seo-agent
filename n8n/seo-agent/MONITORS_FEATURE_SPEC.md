# Growth monitors (v4.5): AI search visibility, the backlink loop, scheduled technical audits

Built 2026-10-02 at the user's request ("implement it in the best way"): the three gaps found when reviewing whether the agent did "only simple SEO". The agent already *measured* AI search, technical SEO and backlinks once, inside the full report; nothing watched them over time or acted on them. These monitors close that loop.

## 1. What each monitor does

| Monitor | Workflow (id) | When | What it measures | What it hands over |
|---|---|---|---|---|
| **AI Visibility Tracker** | `SEOagentAIVisib1` | Monday 07:00 + on demand | A stable set of buyer questions per site, asked to ChatGPT (the real chatgpt.com answer), Perplexity and Google AI Mode every week, Gemini, Claude and the brand question on the month's first run (v4.6); the matching Google search checked for an AI Overview; monthly market view (LLM Mentions) | Mention rate, citation rate, share of voice vs competitors, rank in recommendation lists, brand recognition, the sources AI relies on, your cited pages, lost questions with ready API bodies, week-over-week change, alerts; Claude brief; report (e-mail + PDF + callback `ai_visibility`) |
| **Backlink Monitor** | `SEOagentBacklnk1` | Monday 07:30 (light watch) + full report on the first run of each month + on demand | Links lost and gained since the last check, important lost links, spammy new links, links to broken pages, referring domains, 12-month history (extended, not re-downloaded), unlinked brand mentions, the link gap vs competitors (refreshed every ~3 months) | Alerts, 301 suggestions for broken pages, a disavow list for review, the prospect pipeline (lost / mention / gap / reclaim / ai_source) with outreach drafts, automatic "won"; report + `prospects.csv` + callback `backlinks` |
| **Audit Scheduler** | `SEOagentAuditSc1` | 1st of the month 06:00 + on demand | Reads each site's sitemap and starts a technical audit only when the site changed, 60+ days passed, it was never audited or no dated sitemap exists (v4.6; none within 25 days; on demand always) | Each audit: report + "since the last audit" diff + brand & entity check + internal links to add + **fix pack** |

All three read the sites from `seo_sites` (Track my site) plus every ladder domain, and their settings from `seo_monitors` (defaults: everything on, 8 questions, all six engines, 200 pages, no JavaScript rendering). An on-demand run works for any domain, tracked or not.

## 2. Decisions

- **ChatGPT through the LLM scraper**, not the API model: the scraper returns what chatgpt.com users see (with its sources) for $0.004; Perplexity (sonar), Gemini (3.5 Flash with Google grounding) and Claude (Haiku 4.5 with web search) through LLM Responses. Models are in `AI_Requests.js` CONFIG.
- **Stable questions**: written once by Claude from the site's topics (ladder head + rungs + tracked keywords + "Main services" on the on-demand form; the homepage is read when nothing is known), stored in `seo_ai_prompts`, topped up only when 2+ are missing. Custom questions through Site Admin `ai_prompts`. The trend only means something when the questions stay the same.
- **The brand question** ("what is <brand>?") measures recognition only; rates and share of voice use the buyer questions (live finding: all five of techand.ai's first-run mentions came from it).
- **Competitors**: configured ones plus businesses AI names in 2+ answers (detected automatically and kept). Sources are classified official / platform / media / directory / consultancy / site; each kind gets its own action ("be listed on", "publish where AI looks", "pitch an expert comment", "get listed", "get featured").
- **One prospect pipeline**: the AI tracker writes the sites AI cites as `ai_source` prospects into `seo_link_prospects`; the Backlink Monitor adds lost / mention / gap / reclaim prospects, drafts outreach for up to 8 new ones a month, and marks prospects "won" when they start linking. Statuses survive every run; Site Admin `prospect` sets contacted / won / rejected / ignored.
- **Light vs full backlink runs**: weekly light runs (3 requests) e-mail only when an important link was lost (authority ≥150, or ≥80 and followed) or spam arrived; the full report once a month.
- **No repeated work (v4.6)**: Gemini, Claude and the brand question once a month (carried and marked "monthly" in between; headline rates use the weekly engines so weeks compare like with like); the backlink history is extended with the new months and the link gap refreshed quarterly (stored gap prospects shown in between); the Audit Scheduler compares a sitemap fingerprint (`seo_cache`) and skips unchanged sites up to 60 days. REVIEW §3j.
- **Disavow is review-only**: Google ignores most spam itself; the file is for a manual action or a paid-link pattern the owner did not create.
- **Audit history**: every audit is stored (`seo_audits`, `seo_audit_findings`, finding key = category + title with numbers ignored), so the next audit lists fixed / new / still-open findings and the score change, whether it was scheduled or manual.
- **Fix pack** (every audit): robots.txt (rules kept, sitemap line, AI search crawlers allowed, training crawlers left as they were, "Disallow: /" for everyone removed), llms.txt (site summary + key pages by section), redirect map for broken pages (CSV + nginx + Apache), Organization / LocalBusiness / WebSite schema (business profile, Google Business Profile, homepage sameAs), internal-links.csv, README; zipped for the e-mail, text in the callback.
- **Brand & entity check** (every audit): Google Business Profile looked up by business name + city (DataForSEO Business Data, $0.0054): website, phone, name, claimed; homepage Organization schema and its sameAs; profile vs schema phone. Findings in AI Search Readiness.
- **Crawl options**: 200 / 500 / 1000 pages; JavaScript rendering up to 500 pages (form fields, API `crawl_pages` / `crawl_js`, monitor settings `audit_pages` / `audit_js`); the crawl may poll up to 50 minutes for big crawls.

## 3. Costs (DataForSEO, measured 2026-10-02)

| Item | Cost |
|---|---|
| ChatGPT scraper / Perplexity / Gemini / Claude / AI Mode / AI Overview | $0.004 / $0.006 / $0.035 / $0.023-0.025 / $0.004 / $0.002 per question |
| LLM Mentions market view | $0.10 + $0.001 per row, monthly |
| AI visibility run, 8 questions × 6 engines | **$0.87 measured** for techand.ai (first run of the month); weekly runs on the core engines **$0.12 measured** (v4.6) → about $1.25 per site per month (was $3.50) |
| Backlinks request | $0.024 + $0.000036 per row; light run ≈ $0.07, full run ≈ **$0.20 measured** |
| Technical audit (200 pages) | ≈ $0.09 (crawl) + $0.0054 GBP lookup |
| Claude | prompt writer ~$0.02 once per site; AI brief ~$0.03 per run; outreach drafts ~$0.03 per month |

`AI_Requests.js` caps a run at 500 requests / $12. Gemini and Claude (the expensive engines) run monthly since v4.6 (`AI_Plan.js` CONFIG `monthly_engines`); switch engines off per site with Site Admin `monitors` (`ai_engines`).

## 4. Data Tables (created on first use)

`seo_monitors` (settings), `seo_ai_prompts`, `seo_ai_answers` (one row per question × engine per run), `seo_ai_visibility` (one row per site per run), `seo_backlink_snapshots`, `seo_link_prospects`, `seo_audits`, `seo_audit_findings`, and since v4.6 `seo_cache` (sitemap fingerprints, domain ages, homepage descriptions). Columns: `ladder_common.py`.

## 5. Operating it

- **Form**: "Check my AI visibility" and "Check my backlinks" (domain, country, competitors, main services, e-mail) start a run at once; "Track my site" takes competitors; "Audit my website" takes pages to crawl and JavaScript rendering.
- **API**: `mode: ai_visibility` / `backlinks` (`domain`, `country`, optional `competitors`, `topics`) → `stage: ai_visibility_started` / `backlinks_started`, then the report; `mode: track` takes `competitors` and `monitors`; `mode: audit` takes `crawl_pages`, `crawl_js`.
- **Site Admin** (`SEOagentSiteAdm1`): `monitors` (settings), `prospect` (pipeline status / note), `ai_prompts` (`add` / `remove` questions).
- **Monday report** (Site Tracker): a block with the latest AI visibility, backlink and audit numbers; the Site Brief sees them.

## 6. Also fixed while building this

- **E-mail attachments**: Send Email 2.1 has `attachments` (inline) and `fileAttachments` (files); the agent used `attachmentsUi`, which this node version ignores — so the blog package (HTML / Markdown / meta.json) and the Site Tracker's PDF were never attached. Every e-mail now uses `fileAttachments`, and retries 3 times (a transient DNS failure `EAI_AGAIN smtp.gmail.com` lost two e-mails in the live test).
- **Full report link gap was always empty**: DataForSEO's `domain_intersection` puts the linking domain in `target`, not `domain`.

## 7. Testing

Harness S19 (AI visibility on real engine responses captured live: plan, prompts, 48 requests, parsing per engine, metrics, rows, report, second week, ad hoc, fallbacks), S20 (backlinks on real responses: full run, gap, reclaim, mentions, outreach, won, light run, Labs competitors), S21 (audit: crawl options, entity check, history + diff over two audits, fix pack files, report, attachments, scheduler), S22 (intake, track settings, Site Admin), S10 (Monday block); v4.6 reuse checks in S19-S21. 514 node runs, 0 failed. Live runs: see REVIEW §5c.
