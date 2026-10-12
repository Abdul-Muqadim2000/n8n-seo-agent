# AI growth (v4.12, 2026-10-10) — getting named and cited in AI answers, every week

Asked for (2026-10-10): "are you sure we have the best AI search thing implemented … we need regular things to make sure we get it ranked
in AI as well; the cost might increase". v4.9 measured AI visibility at the leaders' level; it only *advised*. v4.12 adds the weekly loop
that *acts*. Built, harness-tested, deployed locally and run live on techand.ai (REVIEW §5c, 2026-10-10 rows).

## 1. Research (2026-10, three parallel studies; sources in the session log)

**What the leaders do that acts** (Gartner Market Guide for Answer Engine Visibility Tools, 9 Mar 2026; Profound, Peec, AthenaHQ,
Writesonic, Ahrefs Brand Radar / Agent A, Conductor, Semrush, Scrunch, Evertune, Goodie, Gauge, AirOps): a prioritised action queue from
citation gaps (almost all); content created for AI citation (most); earned-media targeting — the third-party pages AI cites, with outreach
(Writesonic, Peec, AthenaHQ, Profound, Ahrefs); AI-crawler access; refresh queues by citation decay (Profound, AirOps); accuracy checks
(Gartner: mandatory). **No leader** submits pages to Bing / IndexNow natively or checks Wikidata — v4.12 does both.

**What moves AI answers** (evidence strength):
| Factor | Evidence | What v4.12 does |
|---|---|---|
| Earned media / brand mentions on other sites | strong (Ahrefs 75k brands: mentions r=0.664 vs links 0.218; Toronto 2025: GPT cites 73-92% earned media; Muck Rack 2026: 84%) | the exact pages AI cites without naming you, who they name, drafts |
| Fan-out coverage (the searches AI runs before answering) | strong-moderate (Ahrefs 2026: only 38% of AIO citations from the top 10) | the writer gives each search its own section |
| Freshness | moderate-strong (Ahrefs 17M citations: 25.7% fresher; Seer 2026: 75% updated within a year) | refresh targets; a visible "Updated" date on every AI page |
| Answer first (the first ~200 characters) | moderate (ChatGPT's retriever sees ~202 characters; 44% of citations from the first 30%) | readiness check + writer + QA |
| Statistics, quotes, cited sources | moderate (GEO paper, KDD 2024: +30-41%) | readiness check; the writer cites the sources AI trusts |
| JavaScript rendering | strong (ChatGPT, Claude, Perplexity, Gemini fetchers run none) | raw-HTML check |
| Index source per engine | ChatGPT: own index + Google results; Copilot: Bing; Claude: Brave; Perplexity: own; Gemini: Google | Bing submission + IndexNow |
| Schema, llms.txt | weak / none (Ahrefs 2026: schema ±2%; 97% of llms.txt never fetched) | reported, never scored |

**Not done, on purpose**: AI-only page versions at the CDN (near cloaking), self-ranking listicles (Google's answers drop the brand
69-83% of the time), "Summarize with AI" prompt injection (Microsoft: AI recommendation poisoning), ChatGPT ads.

**Data limits found**: Bing AI Performance and Search Console's generative-AI report have **no API** (manual export only); DataForSEO's
Bing results rarely include the Copilot Search summary (0 of 10 live attempts, UAE and US) → Copilot is an opt-in engine; Brave cannot be
scraped through SearXNG (rate-limited) → a Brave API key would be needed for Claude-side rank checks (not built).

## 2. What runs

**SEO Agent — AI Growth** (`SEOagentAIGrow1`, 79 nodes; Monday 09:30 — after the AI Visibility Tracker 07:00 and the Site Tracker 09:00,
before the Content Cadence 10:00 — and on demand through *Manual Run*). Per site with AI visibility and `ai_growth` on (default on):
1. **Key pages** (`seo_ai_pages`): pages AI cited, the targets' pages, written and ladder pages, the top Search Console pages, the
   homepage; up to 12 checked a week (never-checked first, then every ~25 days), on the site's real host (www or not).
2. **AI readiness** (0-100, evidence-weighted): reachable (200, < 4 MB), indexable (no noindex, own canonical), text in the raw HTML,
   answer in the first ~200 characters after the H1 (bylines skipped), a **visible** update date ≤ 90 days (metadata-only = half),
   question headings, H2 structure, figures with linked sources, lists / tables, author, FAQ. Schema reported, weight 0.
3. **Indexing**: new / updated pages and key pages Bing has never crawled → Bing Webmaster Tools `SubmitUrlBatch` within the daily
   quota (the v4.10 key); Bing's crawl state per page (`GetUrlInfo`). **IndexNow** once the site hosts its key file (a 32-hex key per
   site in `seo_cache` `indexnow:<site>`; the report and the app give the file).
4. **Questions to win** (`seo_ai_targets`): every lost question of the latest AI visibility run → a **new answer page**, a **refresh** of
   the page that ranks for it (matched on the keyword's distinctive words — IDF-weighted, each page refreshed once; skipped when fresh
   and ≥ 70/100) or — **one search, one page** — the planned **keyword-ladder page** for the same search, written with the AI target.
   Value = AI search volume × buyer stage × competitors named × engines lost; at most 6 queued.
5. **Earned media**: the exact third-party pages AI cited in answers that did not name the business (last 8 days, weekly + pulse),
   at most 2 per site, fetched: does it name you, which competitors, a contact; one action per kind (list: ask to be added; article:
   offer a quote / data; news: pitch; review site: profile + reviews; forum: answer as yourself, disclosed; video / social: publish;
   official: apply if you qualify, else cite it). Rows in `seo_link_prospects` (type `ai_source`, the exact page, v4.10 columns kept);
   **AI Outreach Writer** (Claude) drafts the 3 most valuable new ones a week; the Backlink Monitor finds contacts and writes follow-ups.
   A page that now names the business = **won** (alert).
   **One writer** (D12, 2026-10-12): with `link_builder` on, nothing is drafted here — the prospect row (its `detail` names the question AI
   cites them for) is the hand-over, and the Link Builder qualifies it, finds the contacts on their own domain and writes the sequence
   through its draft gate. With `link_builder` off, the Link Builder's gates still decide (`v5/code/_outreach_kit.js`): no draft to a
   government page, a competitor selling what we sell, a bare homepage, a mailbox provider, a contact database or an accredited-provider
   list we do not qualify for. The name a draft signs with comes from the site model, never from the domain label, and the prompt no longer
   tells the recipient they are cited in AI answers: it must quote their page instead.
6. **Entity** (monthly): Wikidata by name and by official website (P856).
7. Row `seo_ai_growth`; report e-mail + callback `ai_growth`; ranked actions; alerts (a key page down / noindex; a win).

**Content Cadence** (Monday 10:00): the **AI page of the week** — the most valuable queued target, `ai_pages_month` a month (default 2,
0-8), at most one a week, on top of the blog posts (a site with no blog cadence still gets it), never while the pile-up guard holds;
Manual opportunities → a suggestion. A ladder page whose search an AI target shares is written **with** that target. The target is
marked `writing`; AI Growth marks it `won` when the question is no longer lost. The app's mirror (`server/src/services/cadence.ts`)
follows the same rules (harness S29 (g) ↔ `server/test/cadence.test.ts`).

**Page writer** (main workflow): `ai_target` { question, kind, target_id, fanout, sources, competitors } accepted (sanitised) from the
cadence, the app's "Write it now" and the AI report's "Win the answer" actions; the brief plans H1 + a 40-60-word answer first, one
question-style H2 per AI search, a neutral comparison (never ranking the business first), figures from the sources AI trusts, an FAQ;
refreshes keep the URL and true facts. Content QA reports `ai_ready` (answer position, question headings, searches covered) and sends
the draft to the editor when an AI search has no section. Guides, comparison and FAQ pages and every AI page show the byline with a
visible "Updated" date.

**AI visibility changes**: `cited_urls` per answer (the exact pages, with titles) → per question / per source; ai_source prospect rows
carry the most-cited page and keep the v4.10 columns (they were overwritten before); Copilot engine (opt-in, Bing results' Copilot
Search summary, $0.002); Claude localised only to the countries its endpoint accepts (AE is not one).

## 3. Costs per site per month

| Part | Cost |
|---|---|
| AI growth loop: Bing / IndexNow, page checks, cited-page fetches, Wikidata | free |
| Outreach drafts (Claude, ~3 a week) | ≈ $0.13 |
| AI answer / refresh pages (default 2 × $1.20) | $2.40 |
| **Total added** | **≈ $2.53** (0 pages: $0.13) |

With AI visibility at 8 questions: $4.32 + $2.53 = **$6.85**; at 20: $9.40 + $2.53 = $11.93. Copilot, if chosen: + $0.002 per question
weekly and daily. `estimateAiGrowthCost` in `app/shared/src/constants.ts`.

## 4. Data
New tables: `seo_ai_pages`, `seo_ai_targets`, `seo_ai_growth` (created by the workflow); new columns `seo_ai_answers.cited_urls`,
`seo_monitors.ai_growth`, `seo_monitors.ai_pages_month` (`sync_tables.py`). Cache key `indexnow:<site_id>`. Column lists in
`ladder_common.py` (the harness reads them from `harness/table_cols.json`, written by the build).

## 5. App
AI visibility page: **AI growth** section (done for you this week, IndexNow setup with the key file, pages AI cites without naming you
with drafts, questions to win with "Write it now" — "Via the ladder" when a ladder page answers it —, key-page readiness with Bing's
crawl, entity). Settings: "AI growth (weekly)" + "AI answer pages a month" with their cost row; Copilot as an engine option.
Pipeline: automation "AI growth" (Monday 09:30) and the AI page of the week in the queue ("AI answer page" / "AI refresh").
Report renderer `ai_growth`. `GET …/data/ai` → `growth`.
**Owner steps the app asks for** (Recommendations, also on the Overview): "Add one small file so new pages reach Bing the same week"
(`ai:indexnow`, until the key file answers; the AI page has Copy / Download and **Check the file** — `POST …/ai/indexnow/check` fetches
it at once, own host only), "N outreach drafts ready for pages AI cites" (`ai:outreach`, drafts with status new; each draft has Copy,
**Open in your e-mail** (the contact when found), **Mark as sent** → contacted, **Not a fit** → ignored; nothing is ever sent for the
customer), and the E-E-A-T profile item says the drafts and AI pages use it. Prospect statuses stay the app's set (new / contacted / won /
rejected / ignored).

## 6. Tests and live checks
Harness **1642, 0 failed** (S29 new: Copilot parsing, cited pages, plan, requests, readiness, earned media, rows, report, cadence,
writer input; S1: QA AI checks; S19 / S27 updated). App: 196 unit tests (84 shared + 112 server), typecheck, smoke. Live on techand.ai
(≈ $0.20): pulse with cited pages; AI Growth ×3 — 12 key pages scored 52-90 (insight articles show their date only in metadata), 16
pages sent to Bing (2 never crawled), IndexNow key issued, MoF / finline / invoiceuae / lumitech / dptc pages found with the competitors
they name, 5 drafts, Wikidata: no entity. Fixed from the live runs: report read the saved row instead of the summary, URL forms (trailing
slash), loose page matching, one regulator crowding the list, the official-list wording, AI page vs ladder page duplication, phone width.

## 7. Open
- Brave API key (optional) for Claude-side rank checks; Bing AI Performance / Search Console AI report CSV import (no APIs).
- Upload the IndexNow key file on techand.ai; fill its business profile (the drafts and pages carry [brackets] until then).
- AI-crawler analytics from server logs (techand.ai is on Vercel: log drains), not built.
