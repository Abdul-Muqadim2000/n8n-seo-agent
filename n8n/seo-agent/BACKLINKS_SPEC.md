# Backlinks v4.10: every source merged, every important link checked

Built on 2026-10-08 at the user's request: "make it the best possible, use free resources over the net as well". A comparison rated the backlink monitor **6.5/10**: "good monitoring and outreach drafts, but DataForSEO's backlink index is smaller than Ahrefs'".

This file covers the research, what v4.10 changed, every source (used and rejected), how links are checked and scored, the workflows, costs, data, the app, tests and what is still open. The v4.5 design is in `MONITORS_FEATURE_SPEC.md` §1–2; this file replaces its backlink part where the two differ.

## 1. What the leaders do (research of 2026-10-08)

| Tool | Index (vendor figures) | What makes it strong |
|---|---|---|
| Ahrefs | 35T backlink records, 286M referring domains; crawls 5M pages/min; refresh 15–30 min | Highest live-link precision in an independent test (91.7% of reported links still live, The Upper Ranks 2025); **lost reasons** (8 labels: removed, 404, noindex, redirect, not canonical…); "Best links" default filter (DR ≥ 30, traffic ≥ 500); no spam score by design |
| Semrush | 43T backlinks; ~10B pages/day | Biggest raw counts; Backlink Audit with Search Console + GA import; Link Building Tool with sending and follow-ups; won-link monitor |
| Majestic | Fresh index 185B URLs crawled / 120 days | Topical Trust Flow; link context (placement, neighbours, density) |
| Moz | 44.8T links (secondary sources) | Link tracking lists, spam score |
| Linkody / LinkChecker.pro / Pitchbox | — | Re-check every link on its page (daily / weekly), alert on removed / nofollow / noindex; Pitchbox: contacts + sequences |
| **DataForSEO** (ours) | **1.85T live backlinks, 186B live pages** (down from 2.8T in 2023); new links soon after crawl, **full cycle up to 90 days** | Rich per-link fields (`semantic_location`, `original`, `ranked_keywords_info`, `page_from_external_links`) we did not read before |

Counts are not comparable across tools (some count history, some live links only); Ahrefs' own study found 49.6% of Semrush's "live" links dead. **The defensible measure is coverage of the site's own links against Google's sample** — no public study does it per site; v4.10 does.

What earns 9–10/10: several discovery sources with a measured coverage figure; our own verification of important links with lost reasons and two-miss confirmation; a quality score with hard gates and separate SEO / referral / brand value; alerts that come with an action; gap + competitors' new links; mentions as first-class data tied to AI visibility; a scored prospect pipeline with contacts and follow-ups.

What matters (2025–2026): Google still uses links but "needs very few"; link spam is neutralised by SpamBrain, disavow only after a manual action. For AI answers, **branded web mentions** correlate far more (0.66–0.71) than backlink counts (0.22) or DR (0.27–0.33) (Ahrefs, 75k brands); referring domains predict ChatGPT citations (SE Ranking); 84% of AI citations come from earned media (Muck Rack).

Sources of these notes: the two research reports of this session (ahrefs.com/big-data, help.ahrefs.com lost reasons, theupperranks.com, semrush.com/kb 965/1090, majestic.com, dataforseo.com/apis/backlinks-api, developers.google.com spam policies, ahrefs.com/blog/ai-overview-brand-correlation, seranking.com/blog/chatgpt-citation-factors, hunter.io/the-state-of-cold-email).

## 2. What v4.10 does

| Gap | v4.5 | v4.10 |
|---|---|---|
| **Index smaller than Ahrefs'** | DataForSEO only | **Every source merged per referring site** (ledger `seo_backlinks`): DataForSEO + **Bing Webmaster Tools** + **Google's own sample** (Search Console Links export, uploaded in the app) + **GA4 referrals** (links that send visits) + the **Common Crawl web graph** (133M domains, 2.1B domain links, monthly) + Wikipedia + Hacker News + **GDELT news** + web search (the stack's SearXNG). Other tools' exports can be uploaded too: **Ahrefs Webmaster Tools is free for your own site**. Coverage is measured: share of the union each source sees, sites only one source sees, and **% of Google's sample DataForSEO sees** |
| **Stale data** (90-day index cycle) | DataForSEO's lost / new | **Our own link check** of the linking pages (free): found / missing / gone / bot-blocked / JavaScript-only, rel, placement, noindex, canonical, outbound links, the text around the link. Bot-blocked and JS pages that matter are rendered (Jina, HTML). **Lost = two misses in a row** (or one miss of a link DataForSEO also calls lost), with the reason: link removed, page gone, site gone, not seen for 4 months. A bot challenge is never "lost" |
| Quality | DataForSEO rank + spam | **Three values per link** (0–100): **SEO** (authority, relevance, linking-page traffic, placement, editorial integrity incl. DataForSEO `original`, cleanliness, anchor; hard gates: lost, noindex, canonical elsewhere, nofollow/ugc/sponsored as hints), **referral** (GA4 visits + key events), **brand** (earned media, AI-cited sources). **Link Analyst** (Claude) labels the link type (editorial, press, list, directory, profile, partner, forum, guest post, sponsored, scraper, spam) and relevance. "Best links" = SEO value 50+. Free authority: Common Crawl harmonic-centrality rank; optional **Ahrefs Domain Rating** (free API key) |
| Prospects | lost / mention / gap / reclaim / ai_source | + **"best X" list pages** that name competitors and not you, **sites that just linked to a competitor** (DataForSEO, since the last full run), the **Common Crawl gap** (monthly, free) next to DataForSEO's quarterly gap; mentions **checked on the page** (named, no link). **Score = value × likelihood** (mention 0.9, reclaim 1, lost 0.7, competitor's new link 0.55, list 0.5, gap 0.4). **Contacts** found on the prospect's own pages (mailto, schema.org, text; WHOIS is useless after GDPR). **Follow-ups**: 1 after 7 days, 2 after 14 (one e-mail + two follow-ups doubles replies; more does worse). **Won** only when the link is found |
| Alerts | important lost (DataForSEO), spam | Lost **with the reason** (checked twice; a dead linking site is a low note, nothing to do), valuable link turned nofollow / noindex, missed once (low, checked again), possible negative-SEO pattern (10+ new off-topic keyword anchors), referring sites (all sources) −10%, reclaim |
| Cost option | — | **Free sources only** (`free_only`, form "Depth: Free sources only ($0)"): no DataForSEO, no Claude |

Real-data finding that shaped the design (techand.ai, 2026-10-02 vs 2026-10-08): DataForSEO reported **peppol.org (authority 598, the site's strongest link) as LOST**; the link check found it **live, followed, in the content** of peppol.org/members/full-members-list/. GA4 showed peppol.org sending 12 visits; a `site:peppol.org "techand.ai"` search found the page. The five "new" links DataForSEO listed were link-farm pages, gone by 2026-10-08 (two domains no longer resolve, one redirects elsewhere). Fixture: `harness/fixtures_live/page_peppol_members.html.gz`.

## 3. Sources

| Source | What | Auth / cost | Limits | When |
|---|---|---|---|---|
| DataForSEO Backlinks | summary, lost, new; full: referring domains (1,000), one link per domain with details (500), anchors, most-linked pages, broken, history, Content Analysis mentions, competitors' new links, gap (quarterly), `bulk_ranks` / `bulk_spam_score` for domains no index scored | existing credential; $0.024/request + $0.000036/row | — | weekly (3 requests) / monthly full |
| **Bing Webmaster Tools** API (JSON) | `GetUserSites` → `GetLinkCounts` (pages with inbound links, 2 pages) → `GetUrlLinks` (linking page + anchor; 15 pages full, 5 light) | free API key (`SEO_BING_WEBMASTER_API_KEY`, credential `SEOcredBingWebm`, query `apikey`). Own sites only: the key's Bing account must have the site (Search Console import = verified at once, or the owner adds the account as a user). SOAP/POX retired 31 Aug 2026; JSON is the surviving API | throttle codes 4/5; no numbers published | every run, when the key is set |
| **Search Console Links export** | "Latest links" / "More sample links" (100k rows each), "Top linking sites" (1,000) | upload in the app (`POST …/backlinks/import`); the API has no links | app keeps ≤ 5 pages per site, ≤ 20,000 rows; columns found by content (any language) | latest upload per kind |
| Other tools' CSVs | Ahrefs Webmaster Tools (free for verified sites), Semrush, Moz, Majestic exports | same upload | | |
| **GA4** Data API | referral `sessionSource` (year + 28 days: visits, engaged, key events, revenue), `pageReferrer` (origin only for most browsers) | existing service account | Google quota | every run |
| **Common Crawl web graph** (domain level) | the site's referring domains, the competitor gap, harmonic-centrality / PageRank positions | free; job `linkgraph/cc_linkgraph.py` (container `linkgraph`); streams vertices 0.9 GB + edges 8 GB + ranks 2.3 GB per release, nothing stored, resumes with HTTP Range | one pass per release (~monthly) or new targets; ~25–60 min (measured 1.5–6 MB/s) | monthly |
| Wikipedia `exturlusage` | articles citing the site (English + site language) | none; descriptive User-Agent, one request at a time | robot policy | full runs |
| Hacker News (Algolia) | stories whose URL is on the site | none | 10k/hour/IP | full runs |
| **GDELT DOC 2.0** | news articles naming the business (3 months full, 8 days light); each article is then checked for a link | none; one request every 5 s; cite gdeltproject.org (report + app do) | | every run |
| SearXNG (in the stack) | brand mentions outside the site, "best <topic> <country>" list pages, `site:<referrer> "<domain>"` to find the linking page of a domain-only referrer | none (Google CSE engine inside; Brave / DuckDuckGo blocked) | best effort | full runs (locate: every run) |
| Jina Reader | renders bot-blocked / JavaScript pages that matter (≤ 10 per run) as HTML | existing credential | | when needed |
| Ahrefs Domain Rating (free) | DR for up to 1,000 domains per request | free account API key (`SEO_AHREFS_API_KEY`, credential `SEOcredAhrefsDR`); licence: visible "Domain Rating by Ahrefs" credit linking to ahrefs.com, no competing dataset | not published | full runs, when the key is set |

**Not used, and why:** Reddit (unauthenticated JSON blocked since May 2026; OAuth needs approval + a commercial agreement); Google News RSS (personal, non-commercial use only); Cloudflare Radar ranks (CC BY-NC); Moz / Majestic / Semrush / SE Ranking APIs (no useful free tier); OpenWebSearch.eu / Marginalia / Mojeek (no link API); Common Crawl CDX index (cannot answer "who links to X"); Open PageRank and Tranco (redundant with the Common Crawl ranks and DataForSEO / Ahrefs authority); Yandex Webmaster (weak outside Russia). Candidates for later: Wayback forensics for lost links (when a link disappeared), Stack Exchange `url` search, per-company Bing OAuth.

## 4. How links are checked and scored

- **Fetch**: browser user agent, redirects followed (≤ 10), 20 s timeout, 8 at a time. Pages: links missed once, links DataForSEO reports lost, won prospects, new referrers, valuable links (SEO value ≥ 40 or visits), then the oldest checks (60 per site on light runs, 220 on full runs); mention pages (15 / 40); list pages (8); the site's 30 most-linked pages (status only).
- **Read** (`v5/code/_link_kit.js`, regex only — the sandbox has no URL/DOM): every `<a>` to the site (also through tracking redirects), rel (nofollow / ugc / sponsored), anchor (or image alt), placement from the innermost structural element by whole class tokens (content / body / sidebar / nav / footer / comment; Elementor's "elementor-widget" is not a sidebar), meta robots + `X-Robots-Tag`, canonical, outbound domains, the text around the link; bot challenges (Cloudflare, Incapsula, DataDome, PerimeterX) → blocked; client-rendered apps (scripts + root div, few words) → js.
- **Status**: found → live (miss count 0); missing / gone → missed once = at risk; second miss (or DataForSEO also says lost) = **lost** with the reason, unless a fresh source still reports the site and it has another page (then the other page is checked next); blocked / js / error → unchanged.
- **Values** (`LK.values`): SEO = 100 × (0.30 authority + 0.20 relevance + 0.15 linking-page traffic + 0.10 placement + 0.10 editorial + 0.10 clean + 0.05 anchor) × gates (lost 0, noindex 0.1, canonical elsewhere 0.3, nofollow/ugc 0.3, sponsored 0.15), capped by type (spam 0, scraper 5, comment 15, profile 35, directory 40, forum 50). Referral = 22·log10(1+visits) (+ key events). Brand = earned-media type, authority, AI-cited.
- **Coverage**: union = live + at-risk web referrers this run; per source; only-in; `dfs_sees_google` = share of the Search Console sample DataForSEO also reports; `all_see_google` = share confirmed by a second source.

## 5. Workflows and schedule

| Workflow | When | Steps |
|---|---|---|
| **Backlink Monitor** `SEOagentBacklnk1` (100 nodes) | Monday 07:30 (light; first run of the month full) + on demand (`free_only` optional) | Plan → DataForSEO → gap → free sources (Wikipedia, HN, web search) → GDELT → Bing (sites, link counts, links) → GA4 referrals → **Link Merge** → locate pages (`site:` search) → **verify** (fetch, render) → authority (bulk ranks / spam, Ahrefs DR) → **Link Analyst** → Parse → outreach (jobs by score + follow-ups, contacts, writer) → prospects → **ledger** (changed rows only) → snapshot → report + PDF + callback |
| **linkgraph** container (`compose.override.yml`) | daily 02:00 UTC check; runs once per Common Crawl graph release or when the sites / competitors change | targets from the n8n tables → stream the graph → `seo_link_graph` rows per site (link / gap / rank / summary) → state in `seo_cache` `linkgraph:state` |

On-demand runs: form "Check my backlinks" (Depth: full / free sources only) or API `mode: backlinks` (+ `free_only: true`). A free-only run stores its snapshot as mode `free`, so the month's scheduled full run still happens.

## 6. Costs per site per month

| | v4.5 | v4.10 |
|---|---|---|
| Full run (monthly) | ≈ $0.20 measured | ≈ $0.51 estimated: DataForSEO + link details / anchors / pages / competitors' new links / bulk authority ≈ $0.40, Link Analyst ≈ $0.04, outreach ≈ $0.03 |
| Light run (×3.33) | ≈ $0.07 | ≈ $0.09 (follow-up drafts, occasional bulk authority) |
| Free sources, link check, Common Crawl, GA4, Bing, Ahrefs DR | — | $0 |
| **Total** | ≈ $0.35 | **≈ $0.81** (`MONITOR_COSTS.backlinksMonthly`); free-only check $0 |

The Common Crawl job downloads ~11 GB per graph release (bandwidth only).

## 7. Data

| Table | Change |
|---|---|
| **`seo_backlinks`** (new) | the ledger: one row per site × referring site (registrable domain; platform subdomains like x.blogspot.com separate). Columns in `ladder_common.py` `LINKS_COLS`: sources, first/last seen, status / lost reason / miss count, the check (verify, rel, placement, noindex, canonical, outbound, title, context), authority / DR / Common Crawl rank, page keywords, spam, original, visits / key events, AI-cited, link type / relevance / note, SEO / referral / brand value. Upsert by `site_id` + `ref_domain`, changed rows only |
| **`seo_link_imports`** (new) | uploads: source (`gsc_latest` / `gsc_sample` / `gsc_sites` / `csv`), linking page, target, anchor, links, last crawled; the app replaces a site's rows of the same kind |
| **`seo_link_graph`** (new) | Common Crawl rows per site: kind link / gap / rank / summary, hc_pos, pr_pos, n_hosts, links_to |
| `seo_backlink_snapshots` | + `union_domains`, `best_links`, `verified_live`, `at_risk`, `confirmed_lost`, `referral_visits`, `referral_key_events`, `coverage_json`, `anchors_json`, `pages_json`, `values_json`; mode `free` for free-only runs |
| `seo_link_prospects` | + `score`, `origin`, `contact_email`, `contact_url`, `contacted_at`, `followup_step`, `followup_subject`, `followup_body`, `verified_at`; types `list`, `comp_new` |

Site Admin `prospect` stamps `contacted_at` when the status becomes contacted and takes `contact_email`.

## 8. Web app

- **Backlinks page**: tiles (referring sites from all sources with DataForSEO alone as the hint, best links, checked on the page / at risk, visits from links, spam); **Where your links come from** (per source with "only here", Google-sample coverage, source status: Bing / Search Console upload / GA4 / Common Crawl); **Add Search Console links** (CSV upload dialog, members); **Links** (Best, All with a source filter and search, Lost with reasons + at-risk note, New, Send visits, Spammy; values SEO · visits · brand, link type / rel / placement, authority + DR with the Ahrefs credit, check status); history and changes charts; anchors (kinds, keyword-anchor warning) and most-linked pages (+ reclaim); **Opportunities** (unlinked mentions checked on the page with the GDELT credit, "best of" lists, competitors' new links, gap with DataForSEO / Common Crawl source; competitors compared incl. Common Crawl counts); **Outreach pipeline** (score, contact, follow-up drafts, contact e-mail editable, mailto with the contact).
- **Form**: "Check my backlinks" → Depth: full (~$0.50) / free sources only ($0).
- **Report renderer** (`stage: backlinks`): coverage, best links (+ DR credit), wins, losses with reasons, lists, competitors' new links, gap source, checked mentions, prospects with score / contact / follow-up; the reclaim block now reads the payload's real fields (`broken_url`, `domains`, `redirect_to`; it showed nothing useful before).
- **Recommendations**: win back a confirmed lost link (with the reason), redirect a broken linked page, get onto "best of" lists, send outreach (by score), follow-ups due, upload Google's link sample.
- Server: `POST /api/orgs/:orgId/sites/:siteId/backlinks/import` (member+, 16 MB, 20/hour) using `shared/src/link-import.ts`.

## 9. Tests

- **Harness S28** (new; 1512 node runs and assertions in all, 0 failed; the Bing / Ahrefs flags are tested both on and off whatever `n8n/.env` holds): the full run on techand.ai's real DataForSEO data + the real peppol.org page — merge (5 sources on peppol.org, Teams excluded, LinkedIn social, old upload / old release ignored, Wikipedia article only, HN host check), locate, the verify plan, rendering, every check outcome, **no false alarm on peppol.org**, two-miss loss with reason, values, coverage vs Google's sample, the press release that links, checked mentions, reclaim from the 404 check, list / competitor / Common Crawl prospects, scores, contacts, follow-up 1, verified "won", ledger columns and change-only writes, snapshot, report (sections + credits), callback; the next light week (second miss confirms), DataForSEO-only with every free source down, free-only mode (no paid call, mode `free`, the next Monday still the full run), Site Admin contacted / contact e-mail, and the four defects of the live run F1 (no PDF, no competitor's own page, list-like pages only, social links nofollow). S20 updated to the new columns; S23 carries the app's free-only body.
- **App**: 186 unit tests (11 new for the CSV import: formats, languages, limits, refusals); `smoke.py`.
- **Common Crawl job**: synthetic graph with a server that cuts every file mid-way (resume), self-links, competitor links, gap ordering; then the real release `cc-main-2026-jul-aug-sep` for techand.ai vs cleartax.com / azentio.com: 65 min, a real connection drop at 6.16 GB resumed, techand.ai's one referring domain = peppol.org (the link the check confirms), ClearTax 251 / Azentio 90, 150 gap rows led by mof.gov.ae (REVIEW §5c G1).
- **Live (free)**: GA4 referral reports, SearXNG `site:` lookup, the link kit on the real peppol.org / thedocmag pages, Wikipedia / HN / GDELT / Bing endpoints from the n8n container; **F1**: a free-only check of techand.ai through the API ($0, 4.3 min): peppol.org located and confirmed live, azdan.com's "Top 20 UAE e-invoicing service providers" found naming ClearTax and Azentio but not techand.ai; four defects fixed; F2–F4 with the Common Crawl rows: three more fixed (household-name effort discount, competitors' sister domains, WHOIS / site-stats pages) (REVIEW §5c).

- **Live K2 (2026-10-08, $0)**: the two free keys in use (executions 243, 246). Found and fixed: (1) Ahrefs answers `"techand.ai/"` (trailing slash, decimals): no DR ever matched a domain — normalised in Parse Backlinks, fixture now in the live shape; (2) with DR on, press-release wires (prnewswire.co.uk, kyodonewsprwire.jp) ranked among the top gap prospects — wires are no longer prospects (`LK.isWire`), and sites on the market's own domain ending (.ae for a UAE site) get ×1.25 (consultsynergy.ae: 13th → 3rd); (3) free snapshots moved "changes since" — the next paid run would have skipped DataForSEO's new / lost links between the last paid run and the free check — and fed the DataForSEO comparison with zeros (a false "fell from 15 to 3" was possible): free checks now move neither, counts compare like with like (replayed on the live snapshots: since stays at the last DataForSEO run, 2026-10-03); (4) the report showed "Authority 0 · DR 77" and "Authority (0-1000) 0" on free runs, and "Bing 0" without a reason (app tables too): DR alone / "—" / "connected; Bing reports no links yet".

## 10. Open / next

- **Keys added 2026-10-08** (both free; REVIEW §5c K2): Bing reads techand.ai and devaicon.com (verified), but Bing reports **no inbound links** for either yet (its own crawl stats: InLinks 0; the account's history starts days ago) — the report says so. Still to confirm once Bing lists links: the `GetUrlLinks` `link` parameter form (plain URL-encoded is sent; the official sample quotes it). Ahrefs DR live: peppol.org 77, mof.gov.ae 78, cleartax.in 80, techand.ai 2.8.
- **Upload techand.ai's Search Console Links export** in the app (Backlinks → Add Search Console links) to measure DataForSEO's share of Google's sample.
- **Paid live test** (~$0.50): one full on-demand backlink check on techand.ai (DataForSEO + Link Analyst + drafts) to measure the real cost and the Link Analyst on live links.
- The link check keeps the fetched pages in the n8n execution data (up to ~40 MB for a 220-page full run); n8n prunes executions after 14 days by default.
- Later: per-company Bing OAuth (instead of one platform key), Wayback forensics ("the link disappeared between …"), reply detection (needs a mailbox), outcome reporting (links → rankings of the target pages → AI mentions).
