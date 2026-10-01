# Keyword Ladder — feature spec

Goal: the user names the keyword they ultimately want to rank for (or picks one after discovery); the system plans the climb carefully, writes the first rungs, tracks positions over time, and moves up. Content only ranks once it is on the site, so publishing is either manual or through the optional CMS piece.

## Why a ladder, not one page
Google ranks the head term for the site with the most complete, trusted coverage of the topic. A ladder is therefore a set of pages: several specific long-tail pages (lower rungs) that link to one strong page for the head term (top rung), plus links from other sites over time. The top rung must be winnable: brand terms of other companies ("microsoft") are navigational and out of reach; the realistic top for a partner is "microsoft dynamics partner uae".

## Pieces

### 1. New mode: "Rank my site for this keyword" (ladder mode)
Inputs (form page + API `mode: "ladder"`): destination keyword, domain (required), country, business, customers, business facts, goal, tone, CTA, email and/or callback_url, option "pages to write now" (1 default, up to 3).

Pipeline (reuses existing nodes wherever possible):
1. Normalize → Rate Limit → sitemap read (existing) → client pages (existing).
2. **Destination verdict** (existing Verdict agent on the head term): feasibility; if navigational/brand-of-another-company or hopeless, propose 2-3 realistic alternative tops (already in the prompt's "what_must_change").
3. **Rung discovery**: `keyword_suggestions` (head, 500), `related_keywords` (head, depth 2), `keyword_ideas` ([head + top services]) → pool → opportunity score → AI relevance screen (reuse Relevance Chunks / Keyword Relevance / Rank Keywords) → every kept keyword must share the topic with the head term.
4. **Rung assignment** by difficulty and volume: Rung 1 (KD ≤ 25, long-tail, volume ≥ 20), Rung 2 (KD 25-45), Rung 3 (KD 45-60), Top = head term. 2-4 pages per rung, 8-12 pages total; each page = one cluster (primary + supporting keywords, page type). Internal links: every rung page links up to the top page and sideways to one sibling; the top page links down to all rungs.
5. **Site state**: `ranked_keywords` for the domain (1 call) → current positions for rung keywords; sitemap match → "exists: improve" vs "new".
6. **Ladder plan report** (PDF + Word + callback JSON): sequence with months (Rung 1: months 1-2; Rung 2: 3-5; Rung 3: 6-8; Top: 9-12, shortened when the site already ranks), traffic potential per rung, internal-link map, pages to write first, what else is needed (links, reviews, profiles).
7. **Write the first pages now**: run the existing content pipeline for the first N rung pages (N from the input; cost ~$1 per page).
8. **Register for tracking**: write the ladder to the store (see piece 3).

### 2. Choice step in discovery (form only)
After *Build Keyword Strategy*: a Form page "Choose your keyword" with the 8 priority keywords as options (label: keyword · searches/mo · difficulty · intent · page type) plus "Let the system choose for my goal". The pick replaces `pipeline_keyword`; the rest is unchanged. API callers already receive the candidates in the `keyword_strategy` callback and can send `mode: "keyword"` (or `mode: "ladder"`) with the chosen keyword.

### 3. Rank tracker (new scheduled workflow "SEO Agent — Rank Tracker")
- Store: n8n Data Table `seo_ladders` (ladder_id, domain, head_keyword, rung, keyword, page_type, target_url, status, start_date) and `seo_rank_history` (ladder_id, keyword, checked_at, position, url, serp_features). Create the tables once in the n8n UI; alternative store: a Google Sheet via the Drive/Sheets connector.
- Schedule: weekly (default) or monthly. Per active ladder: DataForSEO SERP live (depth 100) per keyword, locate the domain → position + ranking URL + features; ~$0.002 per keyword per check (12 keywords weekly ≈ $0.10/month).
- Output: progress e-mail / callback: position deltas, rungs reached (top 10 / top 3), and the recommendation: "move to rung 2: write these pages" with a one-click link (form prefilled) or, if auto-mode is on, an Execute Workflow call that generates the next rung's pages.
- Guardrails: budget per ladder, stop when the top rung holds top 3 for 4 weeks, alert on drops.

### 4. Optional: publish to the CMS
WordPress REST (n8n WordPress node): create the generated page as a **draft** with title, slug, meta (via Yoast/RankMath fields), schema block, and internal links. Other CMSs via webhook/API later. Default off; this closes the "implementation" gap in the loop.

## Decisions (confirmed 2026-10-01) and implementation notes
- Tracking cadence: **weekly** (Rank Tracker workflow, Monday 08:00; `Manual Run` trigger for on-demand checks).
- Next rung: **recommend only** — the progress e-mail/callback names the pages to write next with a form link and a ready-to-send API body; `CONFIG.ladder_auto_next_rung` is documented but not wired.
- Store: **n8n Data Tables** `seo_ladders` and `seo_rank_history`, created on first use by the workflows themselves (Data Table node, "create table, reuse existing") — no UI step.
- Pages written per ladder run: **1** by default (form dropdown / API `pages_now`, up to 3). Each page is its own execution (started through API Entry with `ladder_id`, `ladder_rung`, `ladder_head`, `ladder_links`, `force_content`), so the plan arrives in 5-8 minutes and the page(s) 8-12 minutes later.
- CMS: **WordPress off**. The sub-workflow `SEO Agent — Publish to WordPress` exists (draft post with title, slug, excerpt, HTML, JSON-LD, Yoast/RankMath meta) and is called only when `CONFIG.wordpress_publish` is true and the request carries `wordpress_url`; it needs the credential "WordPress (SEO Agent)".
- Where things live: Code in `v5/code/Ladder_*.js`, `Build_Ladder_*.js`, `Spawn_Page_Runs.js`, `Apply_Choice.js`, `Tracker_*.js`, `Parse_Positions.js`, `Build_WP_Draft.js`; wiring in `build_v4.py` section 10 and `build_ladder_extras.py`; shared table definitions in `ladder_common.py`; harness scenarios S7 (ladder), S8 (tracker), S9 (WordPress) plus the choice step inside S4.

## Decisions to confirm with the user (original list)
- Tracking cadence: weekly (recommended) or monthly.
- Auto-generate the next rung's pages automatically or recommend only (recommend-only by default).
- Store: n8n Data Tables (needs tables created once in the UI) vs Google Sheet.
- Pages written per ladder run: 1 (default) up to 3.
- CMS: WordPress draft publishing yes/no.

## Test plan
Offline: fixtures for suggestions/related/ideas around a head term; rung assignment and link map checks; tracker position parsing. Live: ladder mode on the user's domain with a mid-difficulty head term; verify the plan, the first page, the store rows, then run the tracker manually once.

## Estimate
Pieces 1-2: a day of build + harness. Piece 3: half a day plus the store setup. Piece 4: a few hours for WordPress.
