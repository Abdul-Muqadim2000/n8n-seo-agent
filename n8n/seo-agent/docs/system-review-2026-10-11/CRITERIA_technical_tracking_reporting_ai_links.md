# Scoring criteria: technical audits, rank & site tracking, reporting & automation, AI visibility, backlinks, link building

Research date 2026-10-11. Areas 1-3 are new web research. Area 4 summarises research already in the repo, with its original sources.
"Now" = what the product does today, from the specs, REVIEW §3d-3n and a code read of `workflows/*.json`.

**Evidence grades:** **A** = Google documentation or an independent large-sample study. **B** = a vendor study with a published
method (usually correlational). **C** = a vendor feature page or a secondary write-up. **(U)** = not confirmed at the original source.

**Scale (all criteria):** 0 = absent · 2 = manual or one-off · 4 = automated but basic · 6 = mid-market parity (SE Ranking /
Semrush standard plan) · 8 = parity with the named leader · 10 = beyond the leaders and proven on live data. Each row gives the
10-point anchor; "cap" says what limits the score.

---

## 1. Technical site audits

### (a) Best tools

| Tool | What sets it apart |
|---|---|
| Screaming Frog v24 (May 2026) | 300+ issues rated High / Medium / Low; Chromium rendering; PSI / CrUX, URL Inspection and GA4 APIs; scheduled crawls compared automatically with the changes in the e-mail; MCP server ([v24](https://www.screamingfrog.co.uk/seo-spider-24/)) C |
| Sitebulb | 300+ prioritised "Hints"; **Response vs Render** on every page ([2024 data](https://sitebulb.com/javascript-seo/2024-report/sitebulb-data/)) C |
| Semrush Site Audit | 140+ checks, Health score, CWV report, weekly schedule by default C |
| Ahrefs Site Audit | 170+ issues. **Always-on Audit**: 24/7 re-crawl prioritised by traffic, links and IndexNow. **Patches**: AI-written titles and meta descriptions deployed through a JS snippet or a Cloudflare Worker ([AOA](https://ahrefs.com/blog/always-on-audit), [Patches](https://help.ahrefs.com/en/articles/9775727-how-patches-work-in-site-audit)) C |
| Lumar | **Protect**: 350+ tests in CI/CD that can block a deploy; Monitor with custom alerts ([lumar](https://www.lumar.io/protect/)) C |
| Botify | JS crawler at up to 100 URLs/s; log analysis (Googlebot + AI bots); PageWorkers fixes at the edge C |
| Conductor (ContentKing) | 24/7 monitoring, a change log, alerts within minutes C |

**Now:**
- Crawl: DataForSEO, 200-1,000 pages, JS rendering on up to 500.
- Search Console: sitemaps, a 28-day snapshot, URL Inspection of at most 25 key pages.
- After each audit: a diff against the last one, an entity check, and a **fix pack** (robots.txt, llms.txt, redirects, schema,
  internal links).
- Schedule: monthly and change-aware (sitemap fingerprint, 60-day safety net).
- Speed: PSI mobile (lab + CrUX) on **homepages only**, in the full report.
- Notices: a Console Alerts mail watcher (IMAP credential not created yet) and a monthly Pages check-in.

### (b) Proven results

- **T1** Google: "Core Web Vitals are used by our ranking systems", yet good scores do not guarantee top rankings. A, [docs](https://developers.google.com/search/docs/appearance/page-experience).
- **T2** Thresholds: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, at the p75 of 28 days of field data. INP replaced FID on 2024-03-12. A (web.dev/articles/vitals).
- **T3** CWV is a small ranking factor:
  - AWR 2022: position-1 URLs pass CWV 19-20% of the time, positions 5-9 pass 10-11%.
  - Perficient: the correlation did not change after the rollout.
  - B, [AWR](https://advancedwebranking.com/blog/core-web-vitals-study), [Perficient](https://www.perficient.com/insights/research-hub/impact-of-core-web-vitals-on-ranking).
- **T4** Web Almanac 2025: 48% of mobile origins and 56% of desktop origins pass. Mobile LCP is the bottleneck (62% good, against 77%
  for INP and 81% for CLS). A, [almanac](https://almanac.httparchive.org/en/2025/performance).
- **T5** Crawl budget matters only for sites with 1M+ pages changing weekly, sites with 10k+ pages changing daily, or a large share of
  "Discovered – not indexed". A, [Google](https://developers.google.com/crawling/docs/crawl-budget).
- **T6** JavaScript:
  - Google renders all pages: median delay 10 s, p90 ≈ 3 h, p99 ≈ 18 h (Vercel/MERJ 2024). B, [vercel](https://vercel.com/blog/how-google-handles-javascript-throughout-the-indexing-process).
  - **No major AI crawler executes JS** (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot). B, [vercel](https://vercel.com/blog/the-rise-of-the-ai-crawler).
  - Sitebulb 2024 audits: the H1 exists only after rendering in 18.3%; JS changes the title in 8.4%; noindex appears only in the response in 4.6%. B.
- **T7** Indexing loses more than speed:
  - Onely 2023: 16% of the valuable pages of well-known sites are not indexed. B.
  - Indexing Insight (1.7M pages): 88% of not-indexed pages are left out for quality reasons, and 70-80% of "crawled – not indexed" pages had been indexed before and were removed. B, [source](https://indexinginsight.substack.com/p/new-study-the-biggest-reason-why).
- **T8** Some warnings are cosmetic:
  - 404s do not hurt the site's other URLs. A, [Google](https://support.google.com/webmasters/answer/2445990).
  - Google rewrites 61.6% of titles, and 99.9% of titles over 70 characters. B, [Zyppy 2022](https://zyppy.com/seo/google-title-rewrites/).
- **T9** Mobile-first indexing has been complete since 2024-07-05. A. URL Inspection API quota: 2,000 a day and 600 a minute per
  property. A, [limits](https://developers.google.com/webmaster-tools/limits).

### (c) Criteria

| # | Criterion | 10 = (cap) | Evidence | Now |
|---|---|---|---|---|
| 1.1 | Crawl coverage | Whole site or ≥ 100k URLs, seeded from sitemap + Search Console + links, with the % of known URLs crawled shown (cap 4 if ≤ 1k pages and no coverage figure) | leaders | 200-1,000 |
| 1.2 | Indexability | Status, redirect chains, noindex, robots, canonical vs Google's chosen canonical, soft 404, hreflang; correct on a labelled fixture set | T7, T8 | most; Google's canonical on a sample only |
| 1.3 | Google's index view | URL Inspection of every important page within quota; the Pages report trended; removals detected (cap 5: sample only) | T7, T9 | 25 pages + monthly CSV |
| 1.4 | JavaScript | Response-vs-render diff on every page **plus** a raw-HTML check, as AI crawlers see the page (cap 4: rendering without a diff) | T6 | ≤ 500 rendered; raw HTML for AI key pages |
| 1.5 | Core Web Vitals | CrUX p75 per template, mobile + desktop, trended, with a lab diagnosis; **low weight** in the score (cap 4: homepage / lab only) | T1-T4 | homepage only |
| 1.6 | Impact priority | Severity × affected clicks / revenue; index blockers first; cosmetic items never at the top (cap 5: fixed labels) | T7, T8 | fixed labels |
| 1.7 | Monitoring | Key pages checked daily or in real time; alerts on noindex / canonical / robots / title changes within hours (6 = scheduled crawl + diff) | ContentKing, AOA | monthly + diff |
| 1.8 | Pre-release QA | Staging / CI tests that block a bad deploy | Lumar | none |
| 1.9 | Fixes | Ready-to-paste fixes **plus** one-click deployment, then checked live (6 = files only) | Patches, PageWorkers | fix pack zip |
| 1.10 | Fix verification | Re-checked within days of a fix; items close themselves (cap 5: next audit only) | — | next audit |
| 1.11 | Logs / crawl budget | Log analysis (Googlebot + AI bots) where T5 applies; N/A for small sites | T5 | none |
| 1.12 | Architecture | Click depth, orphans, internal-link suggestions with anchors | — | yes |
| 1.13 | Structured data | Validated against rich-result rules and generated; not over-weighted | AI Growth §1 | generated |
| 1.14 | Measured accuracy | Precision ≥ 95% on a labelled set of sites, published. **(U)**: no public benchmark, so an internal criterion | REVIEW §3 (false duplicates) | not measured |

---

## 2. Rank tracking and site tracking

### (a) Best tools

| Tool | Highlights |
|---|---|
| Semrush Position Tracking | Daily; desktop / phone / tablet down to ZIP; SERP features incl. AI Overviews; visibility, share of voice, 20 competitors ([semrush](https://www.semrush.com/features/keyword-rank-tracker/)) C |
| Ahrefs Rank Tracker | Weekly on its page (daily on higher plans **(U)**); mobile + desktop, 190+ locations; 19 SERP features incl. AI Overviews; share of voice; "outranked" alerts ([ahrefs](https://ahrefs.com/rank-tracker/)) C |
| AccuRanker | Daily + **on-demand refresh**; local; share of voice; AI Overviews / LLM tracking; Search Console integration C |
| STAT (Moz) | Daily at enterprise scale; ZIP / neighbourhood level; SERP archive C |
| SE Ranking | Daily Google + Bing; stores a **cached SERP** as proof; AI Overviews / AI Mode C |
| Whitespark / Local Falcon | Local geo-grids of up to 225 points C |

**Now:**
- Rank Tracker: weekly, depth 50, country-level, desktop by default (no device set). No SERP-feature or AI Overview flag.
- Site Tracker:
  - Search Console: 28 days vs the previous 28 and vs the year before, top 500 rows; striking distance, CTR gaps, decay.
  - Also: URL Inspection of at most 20 pages, GA4, Trends, and publish detection.
  - Alerts at a 30% drop or a 5-place slip.

### (b) Proven results

- **R1** Google dropped `&num=100` around 10-14 Sep 2025, so a top-100 check now costs about 10 times more. 87.7% of sites saw
  desktop impressions drop and average position rise in Search Console. B/C, [reflectdigital](https://www.reflectdigital.co.uk/blog/google-removed-the-and-num-100).
  Year-over-year comparisons across that date are broken.
- **R2** Semrush (50k keywords, 2019 **(U year)**): only 13% of sites hold the same position on mobile and desktop, and 30% of desktop
  page-1 URLs fall off page 1 on mobile. B.
- **R3** AI Overviews cut clicks:
  - Position-1 CTR is **34.5%** lower (Ahrefs, Mar 2025) and **58%** lower (Dec 2025), over 300k keywords. B, [ahrefs](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/).
  - Pew 2025: people click a result 8% of the time with an AI summary vs 15% without. A.
- **R4** Search Console data has limits:
  - **46.8% of clicks fall on anonymised queries** (Ahrefs, 22B clicks, 2025). B, [ahrefs](https://ahrefs.com/blog/gsc-anonymized-queries/).
  - The API caps at 50k rows a day per search type and keeps 16 months; the BigQuery export has no row limit. A/C.
- **R5** Search Console's position is an impression-weighted average, so it never matches a single tracker reading. Show both,
  labelled. A (Help 7042828).
- **R6** No independent rank-accuracy study with a published method exists. One 2026 comparison says Semrush and AccuRanker were
  within one position of manual checks, but its method is not published **(U)**.
- **R7** Search Console added annotations and a branded-query filter in late 2025. C.

### (c) Criteria

| # | Criterion | 10 = (cap) | Evidence | Now |
|---|---|---|---|---|
| 2.1 | Frequency | Daily + on-demand + an automatic re-check after a publish / fix (5 = weekly) | leaders | weekly |
| 2.2 | Depth + proof | Top 100, or a justified top 20-50, with the SERP snapshot stored for every reading | R1, SE Ranking | depth 50 |
| 2.3 | Device | Mobile **and** desktop (cap 4: one device) | R2 | desktop |
| 2.4 | Location | Country / city / ZIP; geo-grid for local businesses (4 = country only) | Whitespark | country |
| 2.5 | SERP features + AI | Per keyword: AI Overview / AI Mode shown and cited?, snippet, PAA, local pack, video (≥ 15 types) | R3 | none |
| 2.6 | Share of voice | CTR- and feature-weighted, against competitors, trended | R3 | none (organic) |
| 2.7 | Search Console depth | All rows (paged API or BigQuery), own archive beyond 16 months, anonymised share shown, brand / non-brand split (6 = top 500 + history) | R4, R7 | top 500 + history |
| 2.8 | GA4 join | Organic + AI sessions, key events, revenue per landing page | AI Vis §1 | yes |
| 2.9 | Index status | Every tracked page inspected within 2,000 a day (5 = sample) | T9 | ≤ 20 per run |
| 2.10 | Diagnostics | Striking distance, CTR gaps, decay, cannibalisation, movers, each with an action | Semrush | all but cannibalisation **(U)** |
| 2.11 | Alerts | Statistical thresholds, Google-update context, several channels (5 = fixed %) | AI Pulse z-test | fixed 30% / 5 places |
| 2.12 | Data breaks | num=100, core updates and site changes annotated; YoY flagged across breaks | R1, R7 | none found |
| 2.13 | Competitors | 10-20 per project, with movers | Semrush / Ahrefs | AI + links only |
| 2.14 | Cost | Cost per keyword per month shown and capped | R1 | estimated in the app |

---

## 3. Reporting, automation and impact measurement

### (a) Best tools

| Tool | Highlights |
|---|---|
| AgencyAnalytics | 80+ integrations; white-label portal on a custom domain; scheduled PDFs; AI Summary C |
| Looker Studio | Free; native Search Console / GA4 connectors, templates, blending; Ahrefs / Semrush connectors C |
| Semrush My Reports | Drag-and-drop PDF (Semrush + GA + GSC + GBP); daily / weekly / monthly schedule; white-label; client portal ([semrush](https://www.semrush.com/features/my-reports)) C |
| Ahrefs Report Builder | 15+ widgets incl. AI share of voice; PDF scheduled hourly to quarterly; 50 recipients ([ahrefs](https://ahrefs.com/report-builder)) C |
| SEOTesting | Time-based tests on Search Console data (can be backdated); split tests with a control group; content decay ([seotesting](https://seotesting.com/features/)) C |
| SearchPilot | Server-side split tests on matched page buckets; neural-network counterfactual; credible intervals; "ready to test" check ([searchpilot](https://www.searchpilot.com/features)) C |

**Now:**
- E-mail + PDF + Word reports; callbacks; per-site dashboards.
- Ranked actions; every schedule shown with its next and last run; a failure watcher (about 2 minutes).
- Run estimates, company budgets and a platform cap.
- Link impact measured against a control group.
- **Not found:** white-label, share links, annotations, a generic test for an SEO change.

### (b) Proven results

- **P1** Before / after comparisons are confounded by seasonality and Google updates; measuring a change needs a control or a
  counterfactual. Method: CausalImpact (Brodersen et al., *Ann. Appl. Stat.* 2015, [arXiv](https://arxiv.org/abs/1506.00356)). A.
- **P2** Most changes do not win: even SearchPilot's most reliable test type (FAQ schema) is positive in only about 2/3 of tests. C,
  [iPullRank 2025](https://ipullrank.com/seo-week-2025-will-critchlow). The one published link-impact test shows about 10 weeks per
  position.
- **P3** Communication drives 82.6% of client retention vs under 15% for performance (AgencyAnalytics data via Synup) **(U)**. Only
  40% of link builders say their reports prove value (Citation Labs 2025).
- **P4** Revenue and organic traffic lead the success metrics; AI citations score 7/10 (1,000-respondent survey, original not found
  **(U)**). SEJ 2026 (371 SEO professionals): 77.9% expect AI answers to cut clicks. C.

### (c) Criteria

| # | Criterion | 10 = (cap) | Evidence | Now |
|---|---|---|---|---|
| 3.1 | Outcomes first | Revenue / leads from organic **and** AI, brand vs non-brand, shown before rankings (cap 4: traffic + ranks) | P4, R7 | GA4 + AI revenue; no brand split |
| 3.2 | Narrative | What changed, why (with evidence), what to do; AI text grounded in data, no invented numbers | P3 | Claude briefs on computed data |
| 3.3 | One queue | Impact × confidence × effort across audit, tracking, AI and links (5 = one list per module) | — | partly |
| 3.4 | Impact measurement | Every change dated; control group or counterfactual; graded wording; split tests for templates (6 = SEOTesting; cap 3: links only) | P1, P2 | links only |
| 3.5 | Annotations | Publishes, fixes, Google updates and data breaks marked on charts automatically | R1, R7 | none |
| 3.6 | Formats | Dashboard, scheduled PDF, Word / Slides, CSV, API / Looker connector | leaders | dashboard, PDF, Word, API |
| 3.7 | Client sharing | White-label, client portal / share links, viewer roles (0 if none) | AgencyAnalytics | viewer role |
| 3.8 | Reliability | Every automation visible; failures flagged in minutes; retries; delivery rate ≥ 99% measured | — | strong |
| 3.9 | Alert routing | Severity, de-duplication, e-mail / Slack / webhook, quiet unless something is real | AI Pulse | in-app + callbacks |
| 3.10 | Cost control | Estimate before the run, budgets, actual vs estimate reconciled, reuse of stored data | repo (Respona) | yes; reconciliation **(U)** |
| 3.11 | Lineage | Source, date range and sample size / confidence on every number | AI Vis §4 | AI yes, others partly |
| 3.12 | Integrations | GSC, GA4, GBP, Bing, CMS, ads (leaders: 80+) | AgencyAnalytics | GSC, GA4, Bing, GBP, WP (off) |

---

## 4. AI visibility, backlinks, link building (from the repo's research)

### 4A. AI visibility (AI_VISIBILITY_SPEC §1, AI_GROWTH_SPEC §1)

**Leaders:**
- Semrush: 25 prompts daily for $99; a database of 213-261M prompts.
- Ahrefs Brand Radar: about 462M prompts a month.
- Profound: 100 prompts × 3 engines daily.
- Peec: 50-350 prompts. Evertune: 100 samples per prompt.
- Gartner (2026-03): accuracy checks are mandatory.

**Evidence:**
- Answers vary: the same brand list comes back less than 1% of the time (SparkToro).
- Mentions correlate with AI visibility far more than links: r 0.664 vs 0.218 (Ahrefs, 75k brands).
- 73-92% of AI citations are earned media (Toronto 2025); 84% (Muck Rack 2026).
- Only 38% of AI Overview citations come from the top 10.
- Cited pages are 25.7% fresher; ChatGPT's retriever reads about 202 characters.
- GEO paper: +30-41%.
- Schema: ±2%; 97% of llms.txt files are never fetched.

Sources: Semrush KB 1493, ahrefs.com/blog/brand-radar-methodology, tryprofound.com/blog/is-once-a-day-enough, peec.ai,
evertune.ai/platform/methodology, ahrefs.com/blog/ai-overview-brand-correlation.

| # | 10 = |
|---|---|
| 4A.1 Panel | ≥ 100 prompts with real demand, by stage / cluster, plus a market-wide database index |
| 4A.2 Engines | ≥ 6, localised (ChatGPT UI, AI Overviews, AI Mode, Gemini, Perplexity, Copilot / Claude) |
| 4A.3 Statistics | Daily samples; Wilson ranges; alerts only beyond the noise |
| 4A.4 Metrics | Mention and citation rate, position, share of voice, sentiment, the exact cited URLs |
| 4A.5 Accuracy | Wrong claims checked against a fact base |
| 4A.6 Revenue | GA4 AI visits, key events and revenue per assistant |
| 4A.7 Fan-out | The searches AI runs, each covered by a section |
| 4A.8 Access | Robots per bot, a CDN block test, text in the raw HTML |
| 4A.9 Action loop | Actions → pages written / refreshed → earned-media outreach → "won" measured |
| 4A.10 Index sources | Bing / IndexNow submission; Wikidata entity check |

### 4B. Backlinks (BACKLINKS_SPEC §1)

**Leaders:**
- Ahrefs: 35T records; 91.7% of reported links still live (The Upper Ranks 2025); 8 lost reasons.
- Semrush 43T; Moz 44.8T; Majestic (topical flow).
- Linkody: re-checks every link on its page.
- DataForSEO: 1.85T live links, 90-day cycle.

**Evidence:**
- Ahrefs found 49.6% of Semrush's "live" links dead.
- Google "needs very few" links, and SpamBrain neutralises spam, so disavow only after a manual action.
- Mentions correlate 0.66-0.71 with AI visibility vs 0.22 for links.
- Live finding: DataForSEO called peppol.org "lost" while the link was live.

Sources: ahrefs.com/big-data, help.ahrefs.com, theupperranks.com, semrush.com/kb 965/1090, dataforseo.com/apis/backlinks-api,
Google spam policies, seranking.com/blog/chatgpt-citation-factors.

| # | 10 = |
|---|---|
| 4B.1 Coverage | Several sources merged; **% of Google's own sample (GSC Links export) found** shown per site |
| 4B.2 Live precision | Own re-check; ≥ 90% of links reported live are live |
| 4B.3 Lost | With the reason, confirmed on two misses; alert within a week |
| 4B.4 Value | Separate SEO / referral / brand values with hard gates |
| 4B.5 Spam stance | Review-only disavow; alerts on keyword-anchor spikes, not on counts |
| 4B.6 Gap | Competitor gap, competitors' new links, "best X" lists |
| 4B.7 Mentions | Unlinked mentions treated as first-class data, tied to AI visibility |

### 4C. Link building (LINK_BUILDER_SPEC §1)

**Benchmarks (reply rates; no public study of win rates exists):**
- Pitchbox × Backlinko, 12M e-mails: 8.5% reply rate; one follow-up +65.8%; a second contact at the site +93%.
- Hunter 2026, 31M e-mails: 4.5% on average, digital PR 13%; 3 messages 6.8% vs 1 message 3.3%; lists of 21-50 beat lists of 500+
  (6.2% vs 2.4%); 20-49 sends a day per mailbox.
- Instantly: 58% of replies come from the first e-mail; bounces below 2%.
- Muck Rack: 86% of journalists delete irrelevant pitches.
- Human pitches are picked 1 in 3, AI-written ones 1 in 10 (Featured / Pangram).

**Law:** CAN-SPAM; GDPR Art. 14; consent needed even B2B in Germany and under the UAE / Saudi PDPL.

**Where the leaders fall short:** out-of-office replies do not pause follow-ups; links are re-checked monthly; reports do not prove
value.

| # | 10 = |
|---|---|
| 4C.1 Sources | ≥ 6 opportunity sources, none depended on alone |
| 4C.2 Qualification | Value × likelihood; no paid / exchange links |
| 4C.3 Contacts | Found on the site's own pages; a second contact |
| 4C.4 Pitch | Personal; AI draft edited by a person |
| 4C.5 Sequence | 1 e-mail + at most 2 follow-ups; stops on a reply or out-of-office; ≤ 49 sends a day per mailbox; bounces < 2% |
| 4C.6 Sending | Customer's own mailbox with SPF / DKIM / DMARC; consent defaults per country |
| 4C.7 Verification | Link confirmed live by our own check, then monitored |
| 4C.8 Anchor / target | Brand or page-title anchors aimed at hub pages |
| 4C.9 Impact | t0 = first seen live; control group; reads at 6 / 10 / 16 weeks; never "caused" |
