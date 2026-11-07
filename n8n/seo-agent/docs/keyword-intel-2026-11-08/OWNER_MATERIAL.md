# Owner's research material (2026-11-08), condensed. Material only: it "can be totally wrong".

## Note 1: "Adding Competitor Analysis + Advanced Keyword Research"
Two standalone capabilities (own page, credit price, Auto/Manual), usable without the pipeline.

Competitor Analysis modules:
- A1 Discovery: competitors found automatically (direct / SERP / content); platforms (Wikipedia, YouTube, Reddit) tagged, not scored;
  seeds = tracked keywords + GSC top queries + domain's own ranked keywords; SERP Competitors on seeds + Competitors Domain on the domain;
  merge, dedupe, classify from homepage text, score (shared keywords, avg position, traffic, topic similarity, size ratio), flag out of reach;
  top 10-20 saved, user picks up to 5, rest = watchlist.
- A2 Profile: traffic, ranked keyword count, top pages, referring domains, brand vs non-brand, publishing pace from sitemap lastmod.
- A3 Keyword gap via Domain Intersection: missing / weak / strong / shared / untapped (2+ competitors rank, you do not); filters; verdict per
  row (Go / Takes a few months / Hard for your site now) against the user's domain.
- A4 Topic and content gap: topics competitors cover with 3+ ranking pages and you with none, with the winning page and format.
- A5 Top pages per competitor (group ranked keywords by URL, traffic, page type).
- A6 Backlink gap: domains linking to 2+ competitors, not you; to Link Builder, nothing sent.
- A7 Page benchmark: your page vs top 5 (words, headings, questions, schema, images, update date, links, entities) -> brief.
- A8 AI visibility vs competitors (reuse the AI panel; share of voice with 95% range; pages AI cites for them, not you).
- A9 Monitoring + alerts (new competitor page in top 10 for a tracked keyword, 5+ position move, 10+ new referring domains/week,
  publishing pace > 2x normal); only real changes.
- A10 Competitor keyword profile: every keyword each competitor ranks for (URL, position, volume, KD), by intent and topic, brand/non-brand,
  top 20 by traffic, how the keyword appears in title / H1 / headings, overlap with the user, verdict per keyword, sort/filter/CSV.
- Beat-them plan: up to 10 ranked actions with credits and a Start button. Competitor report PDF/Word.

Advanced Keyword Research modules:
- B2 multi-source discovery (ideas, suggestions, related, autocomplete, People Also Ask, related searches, community questions via official
  APIs only, GSC, A3 gap keywords), source kept per keyword.
- B3 enrichment: volume, CPC, 12-month trend, SERP features, intent (4 types + confidence; low confidence -> review).
- B4 SERP-overlap clustering (4+ shared top-10 URLs, threshold in config; head = highest traffic potential; pre-filter before SERP fetches).
- B5 traffic potential + difficulty for this site (top page's traffic; domain strength vs top 10 + referring domains; weakness signals:
  forums in top 5, thin pages, stale > 2 years, no answer in first lines, slow, intent mismatch).
- B6 opportunity score = 100 x (0.30 TP + 0.20 Fit + 0.20 Intent + 0.15 Reach + 0.15 Weak), factors shown, weights in config.
- B7 existing page mapping (refresh vs new; cannibalisation).
- B8 striking distance (GSC positions 8-20, 100+ impressions/28 days, suggested change).
- B9 AI-prompt keywords: buyer questions per cluster, added to the AI panel only after approval.
- B10 topic map + roadmap as a keyword ladder.

Integration: pipeline Research step gets opportunity-ranked suggestions; Plan step gets gaps in "Coming up" with reason; ladders get clusters
and site difficulty; content briefs get competitor benchmarks; Link Builder gets backlink-gap prospects; AI panel gets competitor SOV and
new buyer questions; weekly report gets a competitor section.

Controls: credit price before every run, never charge twice, cache TTLs (SERP 24h, ranked keywords 7d, volume 30d, backlinks 7d, homepage
14d), pre-filter before clustering, max 5 competitors, monitoring only for active competitors, per-company limits, per-module flags,
partial runs keep finished steps. Every number labelled measured/modelled + fetched_at. Untrusted competitor text. SSRF guard.
Acceptance: A1 expected competitors in top 20, platforms tagged; A3 counts reconcile with provider totals; B4 same top 10 never split,
no shared URLs never merged; B6 monotone, weights from config; estimate >= charge, repeat run charges 0; partial run on provider kill;
viewer cannot start; ownership required; company isolation.
Market notes (from public pages, may overstate): Semrush Keyword Gap (5 competitors, 15+ filters), Backlink Gap, clustering; Ahrefs Content
Gap, Competing Domains, Top Pages, Link Intersect, Traffic Potential, Parent Topic; SE Ranking competitor research incl. AI Overviews /
AI Mode / Gemini / Perplexity / ChatGPT; SpyFu PPC; Similarweb traffic; Keyword Insights SERP clustering. Honest: they keep bigger indexes,
history, PPC data; our edge is the decision + automation layer.

## Note 2: third-party features (sequenced AFTER the core above)
Open access layer (public API, MCP read-only by default with priced confirmation, signed webhooks, Zapier/Make/n8n, Google Sheets export),
AI-answer sentiment with review queue, prompt volume only from a real named source (never invented), in-house content quality score +
internal link suggestions, HubSpot revenue attribution (then Salesforce), more AI engines (DeepSeek, Grok, Meta AI) only with a compliant
source. Owner decisions listed there: plan gating, prompt-volume provider, CRM retention.
