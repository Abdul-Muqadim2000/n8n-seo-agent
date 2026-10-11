# Scorecard — whole system against the best proven results (2026-10-11)

**Scales:** K / C criteria use 0 / 5 / 10 anchors. The 1.x–4C.x criteria use 4 = basic, 6 = mid-market, 8 = the named leader, 10 = beyond
the leaders and proven live. **D#** = defect in `RESULTS.md` §3, **run #** = `RESULTS.md` §1, **(NL)** = not live-verified (code or spec).

**How the area scores are built:** they weigh strong-evidence criteria higher (K1–K3, K8, K10, C2, C3, C14, C15, 4B.4) and are rounded to
the half point. They rate capability and correctness, not outcomes. Nothing the system wrote is live yet, techand.ai is in no tracked
top 50, it is named in 0 of 88 AI answers, and no link has been won.

## 1. Summary

| Area | Now | Compared with | Biggest gaps | After fixes |
|---|---|---|---|---|
| Keyword research & verdicts | **5** | Semrush (Personal KD) / Ahrefs | fit gate leaks (D4, D8, D22); no check against live pages (D11, D20); 2017 time-to-rank data | 7 |
| Keyword ladders / planning | **4.5** | MarketMuse / Semrush Strategy Builder | competitor-brand rung (D8); hub links to unwritten pages (D9); wrong next step (D16) | 7 |
| Content creation & QA | **5** | Surfer / Clearscope | 50 placeholders, NAP unfilled, 3,952 vs 2,100 words (D10); no originality check; QA passes it | 7.5 |
| Content cadence / pipeline | **4.5** | Clearscope (inventory, decay) | pile-up guard undercounts (D5); blind to existing pages (D11); no CMS push | 7 |
| Technical audit | **4** | Sitebulb / Ahrefs Site Audit | diff of unlike reports (D2); High false positive since 10-01 (D6, D18); harmful robots fix (D17) | 6.5 |
| Rank tracking | **3** | AccuRanker / Semrush Position Tracking | desktop, weekly, country; no SERP features / AI Overview / competitors; wrong next step (D16) | 6 |
| Site tracking (GSC / GA4 / Trends) | **5** | SEOTesting + Looker Studio | advises duplicating a live page (D11); sparse Trends % (D21); 500 rows, no brand split | 7 |
| AI visibility (incl. pulse) | **6.5** | Profound / Semrush AI Toolkit | 17% of requests errored, no retry (D19); 7 questions; no fact base; missed pulse days (D25) | 8 |
| AI growth | **5** | Profound Actions / AthenaHQ | drafts to government and competitors (D12); bare host to Bing / IndexNow (D15); second writer | 7.5 |
| Backlink monitoring | **5** | Ahrefs (+ Linkody re-checks) | PBN pages ranked best links (D3); 4 of 16 flagged; no Google-sample coverage yet | 8 |
| Link building | **6** | Pitchbox / Respona | competitor / homepage / accredited-list pitches, "techand" (D13); invented reply fact (D14); never sent live | 8 |
| Reporting & app | **4.5** | AgencyAnalytics / Semrush My Reports | no annotations; change tests for links only; no sharing; contradictory figures (D24) | 6.5 |
| Cost control & reliability | **4** | Semrush / Ahrefs (server-side limits) | guards undercount (D1); Mac-hosted schedules, one alert channel (D25); missing retries (D19, D23); RDAP unused (D7) | 8 |

**Overall: 5 / 10.** The area mean is 4.8 now and 7.2 after the fixes in §3.

## 2. Per area

### 2.1 Keyword research & verdicts: 5

| Crit. | Score | Evidence |
|---|---|---|
| K1 | 5 | "Reach" is a domain-level KD percentile; no back-test (code). Keyword Check ×3, ~4 s each (run 5). |
| K2 | 5 | Volume × click loss × CPC × intent × trend; honest "plan on 100–300" (run 6). No Search Console calibration. |
| K3 | 4 | Static discounts. The AI Overview state contradicts itself (D20, D26). |
| K4 | 6 | Verdict reads the live top 10 (run 4). Discovery: only 8 keywords. Page type is free text (D10). |
| K5 | 4 | Leaked "fta login" 90,500/mo (D4) and "facts erp" (D8). Business Central scored fit 1 (D22). |
| K6 | 6 | 370 keywords from 7 pulls, competitors and AI demand (run 9). No Search Console. |
| K7 | 5 | 45 LLM clusters; no SERP overlap; duplicate domains (D20). |
| K8 | 3 | Missed the existing ladder (D20) and a live 2026-08-21 article (D11). |
| K9 | 7 | GO_WITH_CHANGES 58, real risks, stable vs 55 on 10-03 (run 4). |
| K10 | 4 | Month bands; rule R6 cites 2017 (5.7%), not 2025 (1.74%); no calibration. |

**Better than the leaders:** it gives a decision (plan type, months, alternatives), not just metrics; AI demand is part of discovery;
370 keywords cost $0.22. **Gaps:** F4, F5, F14, F19, F24, F33.

### 2.2 Keyword ladders / planning: 4.5

| Crit. | Score | Evidence |
|---|---|---|
| K9 (plan) | 6 | Direct plan, main page first, honest volume (run 6). A competitor brand is planned as a rung (D8). |
| K8 | 3 | Blind to existing pages and ladders (D11, D20). |
| K10 | 4 | As in 2.1. |
| K11 | 5 | Hub with TOC / ItemList, but links twice to 3 unwritten pages, with anchors like "Facts erp" (D9). |
| K12 | 6 | Cap on concurrent ladders, priority, settings row registered. Topic radius only warns (code). |
| K13 | 4 | Won / stuck exist. Next step wrong for 2 of 3 ladders (D16). No automatic re-plan. |

**Better than the leaders:** rungs are ordered by reachable difficulty, then written and tracked; the leaders only plan. **Gaps:** F4, F5, F10, F11, F19.

### 2.3 Content creation & QA: 5

| Crit. | Score | Evidence |
|---|---|---|
| C1 | 6 | Term model, questions, stats; strong structure (run 7). No coverage vs the best competitor. |
| C2 | 5 | A real angle, but its chosen gain (cost / timeline) has no data, hence 50 placeholders (D10). No proof on file. |
| C3 | 5 | Evidence plan with URLs. A weak source is cited 3×; the critic called real Tech& stages "invented" (D22). |
| C4 | 4 | Profile features built (NL). Live: [Author Name] and NAP / org placeholders, though the homepage schema has them (D10). |
| C5 | 1 | No similarity check (code). |
| C6 | 6 | Banned phrases, specifics per section; precise critic. |
| C7 | 7 | Flesch, passive %, answer block. |
| C8 | 3 | 3,952 words vs targets of 2,100 / 3,100; recurs since 10-01 (D10). |
| C9 | 4 | 84 → editor → 91 "passed" an unpublishable page. Not validated against outcomes. |
| C10 | 7 | Title 52, meta 136. The live publish check was not run (NL). |
| C11 | 5 | Service / ItemList / Breadcrumb fit; still emits FAQPage (dead since 2026-05-07). |
| C12 | 5 | 6 real internal links; mixed hosts (D15), unwritten targets (D9). |
| C13 | 5 | Full image plan; no images produced. |

**Better than the leaders:** a complete package (HTML, Markdown, meta, schema, Open Graph) in 10.5 min for ~$0.75; it uses placeholders
instead of inventing prices. **Gaps:** F6, F11, F18, F20, F21, F33.

### 2.4 Content cadence / pipeline: 4.5

| Crit. | Score | Evidence |
|---|---|---|
| C14 | 4 | Caps, Auto / Manual. Counts 2 of 4 unpublished pages and plans 2 more for Monday (D5, run 19). |
| C15 | 5 | Decay and AI-refresh picks; rewrite of an existing URL (NL). |
| C16 | 5 | Sitemap publish detection ran (45 URLs, 4 candidates). WordPress off; `published` not run (NL). |
| C17 | 5 | Tone, banned phrases, Manual approval. No style guide; brand written "techand" (D12, D13). |
| K8 / K12 / K13 | 3 / 6 / 4 | Advises duplicating a live article (D11); otherwise as in 2.2. |

**Better than the leaders:** the cadence is fed by ladders and AI questions ("one search, one page": 3 of 7 matched), with a scale-safety
stance that Koala and Byword lack. **Gaps:** F5, F29.

### 2.5 Technical audit: 4

| Crit. | Score | Evidence |
|---|---|---|
| 1.1 | 4 | 200–1,000 pages, no coverage figure (cap 4). |
| 1.2 | 5 | www / non-www marked High although false, in every audit since 10-01 (D6). |
| 1.3 | 5 | 25-page sample, 15 not indexed: a useful finding (run 14). |
| 1.4 | 4 | Rendering without a diff. |
| 1.5 | 3 | PSI on the homepage only. |
| 1.6 | 4 | Fixed labels; false positives at High (D6, D18). |
| 1.7 | 3 | Monthly. The diff says "25 fixed, +12" against a full report (D2). |
| 1.8 | 0 | None. |
| 1.9 | 4 | Fix pack. robots.txt drops /api/ and /admin/ (D17); JSON-LD has placeholders. |
| 1.10 | 3 | Verified only through the broken diff. |
| 1.11 | n/a | Small site; no log analysis. |
| 1.12 | 7 | Orphan /whatwedo/* found, true. |
| 1.13 | 5 | "No Service schema" true; generated blocks carry placeholders. |
| 1.14 | 3 | Spot-check precision 5 / 7 (RESULTS 2.5). |

**Better than the leaders:** index sample, entity check, AI crawler access and an executive summary in one report; no crawl when the sitemap
is unchanged. **Gaps:** F3, F7, F8, F23, F27, F30.

### 2.6 Rank tracking: 3

| Crit. | Score | Evidence |
|---|---|---|
| 2.1 / 2.2 | 5 / 5 | Weekly, depth 50, 6 checks for $0.06 (run 18). No SERP snapshot. |
| 2.3 / 2.4 | 3 / 4 | Desktop only; country only. |
| 2.5 / 2.6 / 2.13 | 1 / 1 / 1 | No SERP features, AI Overview flags, share of voice or competitor positions. |
| 2.14 | 6 | Cost known; monthly deferral for unpublished pages. |

**Better than the leaders:** each rank comes with a ladder action, when that action is right. **Gaps:** F10, F22.

### 2.7 Site tracking: 5

| Crit. | Score | Evidence |
|---|---|---|
| 2.7 | 6 | Top 500 rows plus history. No brand split; scraper queries listed (D24). |
| 2.8 | 7 | GA4 live: 82 of 292 sessions organic; AI visits measured. |
| 2.9 | 5 | At most 20 URL inspections. |
| 2.10 | 5 | Striking distance, decay. Advises a cannibalising page (D11). |
| 2.11 / 2.12 | 5 / 2 | Fixed thresholds. No data-break notes; "+1,200%" from a sparse series (D21). |

**Better than the leaders:** Search Console, GA4, Trends, publish detection and a brief in one 41-second, $0.03 run. **Gaps:** F5, F14, F25, F28.

### 2.8 AI visibility (incl. pulse): 6.5

| Crit. | Score | Evidence |
|---|---|---|
| 4A.1 | 5 | Up to 50 questions + market index; techand.ai asks 7. |
| 4A.2 | 6 | 6 engines (+ Copilot). Claude 7/7. 7 of 42 requests errored, no retry (D19). |
| 4A.3 | 8 | Daily samples, Wilson ranges, z-tested alert (odoo.com, real; run 16). 2 pulse days missed (D25). |
| 4A.4 | 6 | Full metric set. A heading counted as a brand; URLs not normalised (D19). |
| 4A.5 | 5 | "No wrong claims", but there is no business profile to check against. |
| 4A.6 | 8 | GA4 AI visits / events / revenue ran live. |
| 4A.8 | 8 | Crawler access 8/8 with a CDN test (run 12). |

**Better than the leaders:** rigour few of them publish, and revenue tied to answers, at $4–9 per site per month vs $99–399.
**Gaps:** F13, F16, F17, F26.

### 2.9 AI growth: 5

| Crit. | Score | Evidence |
|---|---|---|
| Readiness (spec §2) | 7 | 12 pages scored on raw HTML (avg 75); schema weight 0. Titles cut at hyphens. |
| 4A.7 | 6 | One section per AI search; 3 of 7 targets go to ladder pages (run 17). Not checked on a live page (NL). |
| 4A.9 | 5 | Queue → cadence → drafts → "won". No win yet. |
| 4A.10 | 6 | Bing submission works, but on the bare host (D15). IndexNow file not uploaded. Wikidata checked. |
| Drafts (4C.2 / 4C.4) | 2 | Sent to mof.gov.ae / tax.gov.ae and competitors; AI jargon; no quote; signed "techand.ai" (D12). |

**Better than the leaders:** Bing, IndexNow and Wikidata, which no leader does natively. **Gaps:** F11, F15.

### 2.10 Backlink monitoring: 5

| Crit. | Score | Evidence |
|---|---|---|
| 4B.1 | 6 | DataForSEO 16 + Common Crawl 1 + GA4 3. No Search Console upload yet, so no coverage figure. |
| 4B.2 | 8 | Our own check kept peppol.org live although DataForSEO dropped it (run 13). |
| 4B.3 | 7 | No false "lost". No real loss seen (NL for reasons). |
| 4B.4 | 2 | 15 PBN pages above peppol.org, SEO value 49 vs 35 (D3). |
| 4B.5 | 3 | Disavow is review-only, but 4 of 16 identical PBN domains are flagged (D3). |
| 4B.6 | 6 | 5 "best X" lists, a government gap; sister and off-topic prospects (D23). |
| 4B.7 | 6 | Mentions / GDELT (NL). |

**Better than the leaders:** a live re-check beat the index on the best link; the ledger merges several sources, GA4 referrals included.
**Gaps:** F2, F17, and the owner's Search Console links upload.

### 2.11 Link building: 6

| Crit. | Score | Evidence |
|---|---|---|
| 4C.1 | 8 | 6+ sources; 22 qualified in 1.7 min (run 15). |
| 4C.2 | 5 | Refused spam and government sites. Pitched competitors, homepages, accredited lists, outlook.com and zoominfo.com (D13). |
| 4C.3 | 7 | Contacts are on each prospect's own domain. |
| 4C.4 | 6 | Quotes their page, 85–100 words, one link. Says "techand" (D13); a suggested reply invents accreditation (D14). |
| 4C.5 | 7 | Sequence rules pass 31/31 on GreenMail (NL). Reply classes 4/4. |
| 4C.6 | 5 | Mailbox with SPF / DKIM / DMARC and a consent gate; none connected, no OAuth (NL). |
| 4C.7 | 8 | Reply check found the peppol.org link at once (run 11). |
| 4C.8 | 6 | Brand / title anchors; mixed hosts (D15). |
| 4C.9 | 6 | Control-group impact (NL); it tracks PBN links (D3). |

**Better than the leaders:** sequences pause for out-of-office replies, links are checked when the reply comes in, impact is measured
against a control group, and bot-walled listings show as "unknown". **Gaps:** F2, F9, F11, F15, F32.

### 2.12 Reporting & app: 4.5

| Crit. | Score | Evidence |
|---|---|---|
| 3.1 / 3.2 | 6 / 6 | Organic and AI revenue; sharp summary. False "capped at 85" (D24); sparse % (D21). |
| 3.3 | 5 | Modules contradict each other (D11, D12, D16). |
| 3.4 / 3.5 | 3 / 0 | Impact measured for links only; no annotations. |
| 3.6 | 7 | All 20 reports reached the app (PDF, Word, HTML, CSV, API). |
| 3.7 | 2 | Viewer role only. |
| 3.9 / 3.11 / 3.12 | 5 / 5 / 5 | In-app plus callbacks; ranges only on AI numbers; 5 integrations. |

The UI was not exercised: there was no owner session (NL). **Better than the leaders:** every schedule shows its next and last run, and
every report shows its cost. **Gaps:** F14, F28, F31.

### 2.13 Cost control & reliability: 4

| Crit. | Score | Evidence |
|---|---|---|
| Guards | 2 | `rate.total 5` after 11 runs; spend recorded as $0.67 vs ~$3.0, because static data races (D1). |
| 3.10 | 4 | Estimates and caches work, but RDAP is unused, so $0.36 WHOIS was paid (D7). Claude spend is known only as $1.6–3.0. |
| 2.14 | 6 | DataForSEO ledgers $2.87 vs $2.69 measured. |
| 3.8 | 5 | 21 runs, 0 failed; failure watcher. No retries in AI visibility or the Ahrefs call (D19, D23). |
| Ops | 3 | Mac-hosted, missed pulses, ops e-mail ECONNREFUSED with no second channel, test row in production (D25). |

**Better than the leaders:** a cost estimate before every run, and stored data reused. **Gaps:** F1, F12, F16, F17.

## 3. Prioritised fix list

Effort: S < 2 h · M ≤ 1 day · L > 1 day.

**A. Correctness: wrong advice or wrong numbers**

| # | Fix | Impact / effort | Moves | Concrete fix |
|---|---|---|---|---|
| F1 | Guards (D1) | High / M | Cost | Atomic counters in Postgres or Redis: reserve the estimate at start, settle on callback. |
| F2 | PBN as best links (D3) | High / M | Backlinks, links | Footprint gate before scoring: same path or anchor on ≥ 3 domains, "PBN / DA / PA" anchors, casino hosts → value 0, excluded, the whole cluster on the disavow list. |
| F3 | Audit diff (D2) | High / S | Technical | Compare only with the same audit type; never mark ranking, AI or keyword findings "fixed". |
| F4 | Fit gate (D4, D8, D22) | High / S | Keywords, ladders | One gate for discovery, rungs and the gap list: refuse government portals ("login", "status") and other brands; describe the site from its nav pages too. |
| F5 | Page inventory (D11, D5) | High / M | K8, ladders, cadence, tracking | Weekly inventory of sitemap titles and GSC page → query pairs. Ladder pages log to `seo_content_log`. Check before planning, advising and pile-up counts. |
| F6 | Publishable page (D10) | High / M | Content | NAP / schema from the homepage schema; cost angle only with pricing facts; QA fails > 5 placeholders or > 25% over length; page type from a fixed list. |
| F7 | False positives (D6, D18) | High / S | Technical | A redirect to www with a matching canonical counts as consolidated; ignore metas that differ by `media`; add regression fixtures. |
| F8 | robots fix (D17) | High / S | Technical | Edit the live file; change only the blocked AI-bot groups. |
| F9 | Reply facts (D14) | Medium / S | Links | Use only facts on file; otherwise "[Owner: …]". |
| F10 | Next step (D16) | Medium / S | Ladders, rank | Derive it from ladder state (Direct plan / no rungs → publish the main page). |
| F11 | Canonical host (D15) | Medium / S | Content, AI growth, links | Resolve it once into `seo_sites`; use it everywhere. |
| F12 | RDAP (D7) | Medium / S | Cost | `JSON.parse(r.body ?? r.data)`; fall back to WHOIS only when there is no date. |
| F13 | AI errors (D19) | Medium / S | AI visibility | 2 retries with backoff; a brand must map to a domain; normalise cited URLs. |
| F14 | Small inconsistencies (D20, D21, D24, D26) | Low / S | Keywords, reporting | No % on sparse series; AI Overview "seen on <date>"; dedupe domains; round CPCs; fix report texts. |

**B. Quality gaps**

| # | Fix | Impact / effort | Moves | Concrete fix |
|---|---|---|---|---|
| F15 | One outreach writer (D12, D13) | Medium / M | AI growth, links | AI Growth's prospects go through the Link Builder's gates. Refuse competitors, bare homepages, webmail and data brokers, and accredited lists for unaccredited sites. Brand from `og:site_name`. |
| F16 | Operations (D25) | High / M (host L) | Reliability | Always-on host (queue mode), a second alert channel, delete the test check-in. |
| F17 | Retries (D19, D23) | Medium / S | Reliability | The main workflow's retry rule in every HTTP node. |
| F18 | FAQPage (C11) | Low / S | Content | Stop emitting and scoring it. |
| F19 | Timelines (K10) | Medium / S | Keywords, ladders | Rule R6 with the 2025 rates, as a probability per plan. |
| F20 | Claim checks (C3) | Medium / M | Content | Match each figure to its source text; reject weak sources; strip tracking parameters. |
| F21 | Originality (C5) | Medium / M | Content | Shingle overlap against competitor and own pages; fail above 15%. |
| F22 | Tracker depth (2.3, 2.5, 2.13) | Medium / M | Rank | From the same SERP: AI Overview / snippet / PAA / local flags and competitor positions; add mobile. |
| F23 | CWV (1.5) | Medium / S | Technical | Free CrUX API, p75 per template, mobile + desktop. |
| F24 | Discovery inputs (K6, K7) | Medium / M | Keywords | Search Console gaps into discovery; SERP-overlap clusters. |
| F25 | GSC depth (2.7) | Low / S | Site tracking | Brand split, anonymised share, paged rows. |
| F26 | Panel and facts (4A.1, 4A.5) | Medium / S (owner) | AI visibility | 20 questions; a business profile to check answers against. |

**C. Feature gaps**

| # | Fix | Impact / effort | Moves | Concrete fix |
|---|---|---|---|---|
| F27 | Watch and verify (1.7, 1.10) | Medium / M | Technical | Daily key-page checks for noindex / canonical / title changes; re-check fixes within days. |
| F28 | Annotations, change tests (3.4, 3.5, 2.12) | Medium / L | Reporting | Mark publishes, fixes and updates automatically; use the control-group method for page changes. |
| F29 | CMS push (C16) | Medium / M | Cadence | WordPress drafts behind Manual approval. |
| F30 | Render diff (1.4) | Low / M | Technical | Compare title, H1, canonical and links in the response and the render. |
| F31 | Sharing (3.7) | Low / M | Reporting | Expiring share links. |
| F32 | Live sending (4C.6) | Medium / L | Links | Connect techand.ai's mailbox and send one approved sequence; add OAuth. |
| F33 | Calibration (K10, C9) | Medium / L | Keywords, content | Re-fit timelines and the QA threshold from 20+ live pages. |

## 4. Overall rating: 5 / 10

The breadth is real: 13 areas ran end to end for about $4.3. Some methods beat the leaders: z-tested AI alerts with ranges, a live re-check
of the strongest link, out-of-office handling, verdicts that decide. Against the best tool in each area, though, most criteria sit at
mid-market level or below. Three things hold the score down:

- **Wrong advice and wrong numbers:** D1–D4, D6, D17.
- **Incoherence:** the features share no canonical host, page inventory, written-page log or business facts.
- **No outcome evidence yet.**

**To reach 9:**
1. Fix F1–F17, then run the whole system on 3+ sites with no defect that gives wrong advice.
2. Publish ≥ 95% precision for audit findings and spam labels, measured on a labelled set.
3. Build one site model that every workflow reads.
4. Reach leader parity on depth (F22, F23, F27, F28, a panel of 100+ prompts, plagiarism checks, sharing).
5. Run in production with measured delivery of ≥ 99%.
6. Prove outcomes against a control group: pages ranking, links won, AI mentions gained (F33).

Steps 1–3 reach about 7. Steps 4–6 take months, because outcomes take time to show.
