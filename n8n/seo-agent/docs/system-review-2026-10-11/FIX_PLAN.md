# Fix plan — system review of 2026-10-11

The working document for fixing everything the 2026-10-11 system review found, in order, and for re-rating afterwards.
Sources: `RESULTS.md` (live run, defects D1–D26), `SCORECARD.md` (scores, fixes F1–F33), the two `CRITERIA_*.md` files,
`n8n/seo-agent/LINK_BUILDER_SPEC.md` §10 and the owner discussion. File locations below were checked with grep on 2026-10-11.

## 1. How to use this

1. Start each working session with the next open session in §4 (begin with **Phase 1, session 1A**). Read its item blocks in §3, then the
   `RESULTS.md` section named in each item's evidence.
2. Follow the **Working rules in `/CLAUDE.md`** for every item. n8n: edit `v5/code/*.js` / `v5/prompts/*.txt` (wiring in `build_*.py`, table
   columns in `ladder_common.py` + `python3 sync_tables.py`), then `cd n8n/seo-agent && python3 build_v4.py` and **check the exit code**. Add a
   harness check (new scenario **S31** onwards; S29 is used twice already) and run `scenarios_v5.js` in the container until it ends `0 failed`.
   Deploy with `python3 apply_env.py` (`--except=<workflow id>` keeps a workflow unpublished). App: typecheck, `npm test` and
   `python3 app/scripts/smoke.py`, all in `node:22-bookworm-slim` (no Node on the Mac). `Cadence_Plan.js` and `app/server/src/services/cadence.ts`
   change together.
3. Commit and push each finished item on its own (path-scoped; the repo is public, so scan the diff for secrets). When a customer-visible
   capability changes, update the marketing pages (`app/web/src/marketing/`), as CLAUDE.md requires.
4. Set the item's **status** in the register (§3.1): `open` → `fixed (harness)` → `deployed` → `verified live`, or `blocked (owner)` / `won't fix`
   with a reason.
5. After each phase, run that phase's live checks (§5.1). Paid runs need the owner's explicit go-ahead (O12). Never send real outreach
   e-mail and never push to WordPress during checks.
6. After Phases 1–4 and session 6A, run the whole-system re-rating (§5.2). Record it in §2 and §6.

## 2. Baseline ratings (2026-10-11)

**Overall: 5 / 10.** The area mean is **4.8** now. SCORECARD estimates **7.2** after the fixes in its §3 (F1–F33). Scales: K / C criteria use
0 / 5 / 10 anchors. 1.x–4C.x use 4 = basic, 6 = mid-market, 8 = the named leader, 10 = beyond the leaders and proven live. Area scores
weigh the strong-evidence criteria higher (K1–K3, K8, K10, C2, C3, C14, C15, 4B.4) and are rounded to the half point. They rate capability
and correctness, not outcomes.

| # | Area | Now | Compared with | Biggest gaps (2026-10-11) | Reachable (SCORECARD estimate) | After fixes | Re-scored on |
|---|---|---|---|---|---|---|---|
| 1 | Keyword research & verdicts | **5** | Semrush (Personal KD) / Ahrefs | fit gate leaks (D4, D8, D22); no check against live pages (D11, D20); 2017 time-to-rank data | 7 | **6** | 2026-10-13 |
| 2 | Keyword ladders / planning | **4.5** | MarketMuse / Semrush Strategy Builder | competitor-brand rung (D8); hub links to unwritten pages (D9); wrong next step (D16) | 7 | **5.5** | 2026-10-13 |
| 3 | Content creation & QA | **5** | Surfer / Clearscope | 50 placeholders, NAP unfilled, 3,952 vs 2,100 words (D10); no originality check; QA passes it | 7.5 | **6** | 2026-10-13 |
| 4 | Content cadence / pipeline | **4.5** | Clearscope (inventory, decay) | pile-up guard undercounts (D5); blind to existing pages (D11); no CMS push | 7 | **5.5** | 2026-10-13 |
| 5 | Technical audit | **4** | Sitebulb / Ahrefs Site Audit | diff of unlike reports (D2); High false positive since 10-01 (D6, D18); harmful robots fix (D17) | 6.5 | **5** | 2026-10-13 |
| 6 | Rank tracking | **3** | AccuRanker / Semrush Position Tracking | desktop, weekly, country; no SERP features / AI Overview / competitors; wrong next step (D16) | 6 | **6** | 2026-10-13 |
| 7 | Site tracking (GSC / GA4 / Trends) | **5** | SEOTesting + Looker Studio | advises duplicating a live page (D11); sparse Trends % (D21); 500 rows, no brand split | 7 | **7** | 2026-10-13 |
| 8 | AI visibility (incl. pulse) | **6.5** | Profound / Semrush AI Toolkit | 17% of requests errored, no retry (D19); 7 questions; no fact base; missed pulse days (D25) | 8 | **7** | 2026-10-13 |
| 9 | AI growth | **5** | Profound Actions / AthenaHQ | drafts to government and competitors (D12); bare host to Bing / IndexNow (D15); second writer | 7.5 | **6.5** | 2026-10-13 |
| 10 | Backlink monitoring | **5** | Ahrefs (+ Linkody re-checks) | PBN pages ranked best links (D3); 4 of 16 flagged; no Google-sample coverage yet | 8 | **7** | 2026-10-13 |
| 11 | Link building | **6** | Pitchbox / Respona | competitor / homepage / accredited-list pitches, "techand" (D13); invented reply fact (D14); never sent live | 8 | **6.5** | 2026-10-13 |
| 12 | Reporting & app | **4.5** | AgencyAnalytics / Semrush My Reports | no annotations; change tests for links only; no sharing; contradictory figures (D24) | 6.5 | **4.5** | 2026-10-13 |
| 13 | Cost control & reliability | **4** | Semrush / Ahrefs (server-side limits) | guards undercount (D1); Mac-hosted schedules, one alert channel (D25); missing retries (D19, D23); RDAP unused (D7) | 8 | **4.5** | 2026-10-13 |
| | **Overall** | **5** | | area mean 4.8 | area mean 7.2 | **6** (area mean 5.92) | 2026-10-13 |

## 3. Issue register

### 3.1 Register

**ID scheme.** `D` = live defect from `RESULTS.md` §3 (D25 split into a / b / c because its three parts have different fixes). `G` = criteria
gap from `SCORECARD.md` (its fixes F15–F33, criterion rows and the "To reach 9" steps that no D-item covers). `L` = Link Builder open item.
`O` = owner decision (no code). **Areas:** KW keyword research · LAD ladders · CON content · CAD cadence · TECH technical audit · RANK rank
tracking · SITE site tracking · AIV AI visibility · AIG AI growth · BL backlinks · LB link building · REP reporting & app · OPS cost &
reliability. **Effort:** S < 2 h · M ≤ 1 day · L > 1 day. **Evidence:** exec = n8n execution id; § = `RESULTS.md` section; "SC" = `SCORECARD.md`
criterion. **SC fix** = the matching row of SCORECARD §3.

| ID | Title | Area | Type | Impact | Effort | Evidence | SC fix | Session | Status |
|---|---|---|---|---|---|---|---|---|---|
| D1 | Spend and rate guards undercount under concurrency | OPS | wrong number | High | M | static data after runs 3–21 (execs 347, 352, 354, 356 …); §3 #1 | F1 | 1A | verified live 2026-10-12 (8 ledger rows, run_number_today 1-8; limit-5 refusal = harness only) |
| D2 | Audit diff compares a technical audit with a full report | TECH | wrong number | High | S | exec 385 vs aud_mv40sm450bi (exec 370); §2.5 | F3 | 1B | verified live 2026-10-12 (execs 411/413/427: same-type diffs) |
| D3 | Backlinks ranks PBN link-farm pages as the best links | BL, LB | wrong advice | High | M | exec 368, 372; `files/backlinks-…pdf`, `disavow-candidates-…txt`; §2.7 | F2 | 1C | verified live 2026-10-12, and again in the **scheduled Monday watch** (exec 451, 16:19 UTC): 16 farm links set aside with no value, 0 lost, 0 at-risk, 0 important-lost, one low informational alert |
| D4 | Full report's keyword gap recommends government navigational queries | KW, TECH | wrong advice | High | S | exec 370; `files/full-seo-report-…`; §2.5 | F4 | 1D | verified live 2026-10-12 (40 refused with reasons; P1-4 open for §4a) |
| D5 | Pile-up guard undercounts unpublished pages | CAD | wrong number | High | S | exec 380; §2.9 | F5 | 2B | verified live 2026-10-12 — including the **real Monday cadence** (exec 448, 10:34 UTC): it paused itself with "5 written pages waiting for publication (pile-up guard, limit 3)" naming every waiting keyword and wrote nothing |
| D6 | "www and non-www not consolidated" (High) is false | TECH | wrong advice | High | S | exec 354, 370, 385; §2.5 | F7 | 1B | verified live 2026-10-12 |
| D7 | RDAP never parsed, so WHOIS is always paid | OPS | quality | High | S | exec 370 ($0.36 WHOIS); §2.5 | F12 | 1A | fixed; live WHOIS $0 via the domain-age cache — RDAP path not exercised live |
| D8 | Competitor brand ("facts erp") planned as a ladder rung | LAD, KW | wrong advice | Medium | S | exec 352, 365; `files/keyword-ladder-…`; §2.4 | F4 | 1D | verified live 2026-10-12 (ladder lad_mv4vxu3bq0kl, no brand rung) |
| D9 | Hub page links to unwritten pages; lowercase keyword anchors | LAD, CON | quality | Medium | S | exec 365; `files/erp-software-uae.html`; §2.4 | — (K11) | 2C | verified live 2026-10-12 (8 links, all live; 2 planned in meta.json; anchors title-cased) |
| D10 | Generated page is not publishable (placeholders, NAP, length) | CON | quality | High | M | exec 365; `files/erp-software-uae.{md,html,meta.json}`; §2.4 | F6 | 2E | verified live 2026-10-12 for the gates (0 body placeholders, +24.6% of target, Tech& in the schema); the author box still bracketed (P2-6), no verdict target in a Write-now run (P2-7), NAP block not exercised (local pages only) |
| D11 | System is blind to existing pages (advises a cannibalising page) | KW, LAD, CAD, SITE | wrong advice | Medium | M | exec 378, 382; 2026-10-01 ladder; §2.9 | F5 | 2D | verified live 2026-10-12 for the inventory (45 rows) and the tracker; the verdict path was blind (P2-5) and is now fixed; the ladder half still needs a live run |
| D12 | AI Growth drafts go to government sites and competitors; second writer | AIG | wrong advice | Medium | S | exec 376; `files/ai-growth-drafts-…txt`; §2.6 | F15 | 4B | partly verified live 2026-10-12: AI Growth drafts nothing new and hands over, but its report still counts stale drafts (P34-1) |
| D13 | Link Builder: "techand", competitor / homepage / accredited-list pitches, webmail prospects, listing status flips | LB | wrong advice | Medium | M | exec 372; `files/link-builder-sequences-…txt`; §2.8 | F15 | 4B | verified live 2026-10-12 (brand "Tech&"; 28 refusals incl. 4 government, 14 bare homepages, zoominfo / outlook, a competitor, an accredited list; all 9 targets on www) — but see P34-2 for the listing match |
| D14 | Reply Reader's suggested answer invents a business fact | LB | wrong advice | Medium | S | execs 357–360; `files/reply-reader-tests-…txt`; §2.8 | F9 | 1C | verified live 2026-10-12 |
| D15 | No shared canonical host (links to a 308 redirect) | CON, AIG, LB, TECH | quality | Medium | M (SC: S) | execs 365, 372, 376; audits 354 / 370 | F11 | 2B | verified live 2026-10-12 in the page (schema and links on www); residual bare-host URLs in meta.json and 17 stored ladder rows → P2-3 |
| D16 | Rank Tracker's next step is wrong for main-page-only / Direct ladders | LAD, RANK | wrong advice | Medium | S | exec 378; §2.9 | F10 | 1D | verified live 2026-10-12 |
| D17 | Fix-pack robots.txt drops /api/, /admin/, /private/ for AI bots | TECH | wrong advice | Medium | S | exec 370; `files/robots.txt` | F8 | 1B | verified live 2026-10-12 ("Changes: none needed") |
| D18 | "Duplicate meta tags" on 45/47 pages is Next.js `theme-color` | TECH | wrong advice | Low | S | exec 354, 370, 385; §2.5 | F7 | 1B | verified live 2026-10-12 |
| D19 | AI visibility: 7 of 42 requests errored with no retry; heading counted as a brand; cited URLs not normalised | AIV | wrong number | Medium | S | exec 362 / 363; `files/ai-visibility-…pdf`; §2.6 | F13, F17 | 4A | verified live 2026-10-12 (failures named per engine, rates on answered only, 8 brands all real domains, 263 cited URLs with no www / fragment / tracking) |
| D20 | Discovery: ladder overlap unflagged, contradictory AI Overview text, duplicate domains, float CPCs | KW | quality | Low | S | exec 356, 364; `files/keyword-ideas-…`; §2.3 | F14 | 3A | verified live 2026-10-12 (ladder-covered keyword flagged with its rung, AI Overview only where the live check saw one, 5 distinct domains, 21 CPCs at 2 dp) |
| D21 | Sparse Trends % ("+1,200%") quoted in the Site Tracker brief | SITE | wrong number | Low | S | exec 382; §2.9 | F14 | 3A | verified live 2026-10-12 (`change_pct: null`, "too little search data for a percentage", no "undefined days") |
| D22 | Site description reads only the homepage (fit 1 for Business Central; critic calls real stages "invented") | KW, CON | wrong number | Low | M | execs 344, 348–350, 365; §2.1, §2.4 | F4 | 2C | verified live 2026-10-12 (5 nav pages read, 28 services incl. Dynamics 365 Business Central, `services_json` filled, "business central partner uae" now fit 2) |
| D23 | Ahrefs DR not retried; sister / off-topic gap domains as prospects; `utm_source` kept | BL | quality | Low | S | exec 367 / 368; §2.7 | F17 | 4A | verified live 2026-10-12 (DR ran; 39 of 42 gap domains "not pitched: off topic"); the sister-domain half was not exercised |
| D24 | Full report: duplicate author finding, false "capped at 85", scraper queries in top queries | REP, TECH | wrong number | Low | S | exec 370; `files/full-seo-report-…` | F14 | 1B | partly verified live 2026-10-12: author once, no cap text; scraper queries still shown → P1-3 |
| D25a | Scheduled runs missed (Mac-hosted n8n) | OPS | ops | High | L | no AI Pulse run 2026-10-10 / 10-11; exec 240, 261 late | F16 | 6B–6C | open |
| D25b | Ops alerts have one channel, and it failed | OPS | ops | High | M | Error Handler e-mail ECONNREFUSED 2026-10-10 | F16 | 6A | fixed 2026-10-12 (harness S48) — every alert is recorded in the new `seo_ops_alerts` table before sending, then fans out to a webhook (`SEO_ALERT_WEBHOOK_URL`, no SMTP) **and** the e-mail in parallel; a repeat within 30 minutes is counted, not re-sent. **Owner step: put a Slack or Teams webhook URL in `n8n/.env`.** |
| D25c | Test check-in row stands in for October's Search Console check-in | OPS | ops | Low | S | `seo_console_checkins` "October check-in (test)" | F16 | 6A | fixed 2026-10-12 (harness S48) — a test check-in (form question, API `is_test`, test caller or a "(test)" note) is stored with `is_test` and never satisfies the month; a test "yes" raises no critical alert |
| D26 | Verdicts state a volatile AI Overview as fact | KW | wrong advice | Low | S | exec 347, 352, 365; §3 #25 | F14 | 1D | verified live 2026-10-12 ("seen in the check at 06:27 UTC") |
| G1 | One retry rule for every external HTTP node (incl. errors inside HTTP 200) | OPS | quality | Medium | S | §2.6, §2.7; SC 3.8 | F17 | 4A | verified live 2026-10-12 (1 of 47 AI requests failed = 2.1%; the retry gate re-sent 4 and 3 answered) |
| G2 | Stop emitting and scoring FAQPage | CON | quality | Low | S | SC C11 | F18 | 2E | verified live 2026-10-12 (no FAQPage in the delivered page) |
| G3 | Time-to-rank rule with 2025 data and a likelihood per plan | KW, LAD | wrong number | Medium | S | SC K10; criteria K10 | F19 | 1D | verified live 2026-10-12 (ladder report; the verdict shows months only) |
| G4 | Claim checks: figures against source text, weak sources, tracking parameters | CON | quality | Medium | M | exec 365 (trangotech.com ×3, `?srsltid=`); SC C3 | F20 | 2F | verified live 2026-10-12 |
| G5 | Originality / similarity check | CON | missing feature | Medium | M | SC C5 = 1 | F21 | 5 | fixed 2026-10-13 (harness S54) — `Originality Check` + `_shingle.js`: share of the draft's 8-word windows found on any single competitor or own page already fetched (no extra fetch, $0); over 15% (configurable) QA fails and the editor gets the quoted passage and page name; the page being improved is exempt; no sources → `passed: null`, never "clean". Fixtures: copied competitor paragraph 41.2% fails, same-terms draft 0% passes, own service page 29.5% caught as cannibalisation |
| G6 | Rank tracker depth: SERP features, AI Overview, competitors, mobile, SERP snapshot | RANK | missing feature | Medium | M | SC 2.2–2.6, 2.13 | F22 | 5 | fixed 2026-10-12 (harness S47, app tests) — `_rank_serp.js` from the SERP call already paid for: AI Overview (shown / cites us), snippet, People Also Ask, local pack, video, shopping; top-10 domains, who is above us, competitor positions; CTR- and feature-weighted share of voice (marked modelled); trimmed snapshot; weekly mobile check of main keywords (+ ≈ $0.13 / ladder / month); new `seo_rank_history` columns need `sync_tables.py` |
| G7 | Core Web Vitals per template from CrUX (mobile + desktop) | TECH | missing feature | Medium | S | SC 1.5 = 3 | F23 | 3B | fixed 2026-10-12 (harness S48); **not exercised live — the Chrome UX Report API is not enabled**, so both reports print "not available" with the enabling step and still score (83 / 70). Owner step pending |
| G8 | Discovery inputs: Search Console gaps, SERP-overlap clusters, more live SERP checks, GSC calibration | KW | missing feature | Medium | M | SC K2, K4, K6, K7 | F24 | 5 | fixed 2026-10-13 (harness S52, app tests) — new `_kw_inputs.js`: Search Console seeds for queries no live page answers plus striking distance (no new API call), traffic potential calibrated against measured impressions and labelled measured / modelled, SERP-overlap clusters (≥ 3 shared top-10 URLs), live SERP checks raised 8 → 16 (cap 25, + ≈ $0.016 a run). Caveats: 28-day rows scaled ×30/28 (stated in the report), the history load caps at 300 rows, and the per-check price is this repo's assumed $0.002, not invoice-verified |
| G9 | Search Console depth: paged rows, anonymised share, brand split | SITE | quality | Low | S | SC 2.7 | F25 | 3A | verified live 2026-10-12 (862 rows paged, anonymised share 30.1%, brand / non-brand split, 5 operator queries excluded) |
| G10 | AI answers checked against a fact base | AIV | quality | Medium | S | SC 4A.5 | F26 | 4A | partly verified live 2026-10-12: the fact sheet reaches the analyst, but an empty profile still yields "no claim was wrong" (P34-3) |
| G11 | Daily key-page watch and quick re-check of fixes | TECH | missing feature | Medium | M | SC 1.7, 1.10 | F27 | 5 | fixed 2026-10-13 (harness S53) — new workflow **SEO Agent — Page Watch** (`SEOagentPageWch1`, 41 nodes, daily 05:45, **$0 / site / day**): one plain GET per key page (cap 25, from the site model and `seo_pages`, no crawl) plus robots.txt, comparing status, new redirects, noindex (meta and header), canonical, title and the robots.txt hash against `seo_cache`; same-day alerts into `seo_console_alerts` and, when serious, D25b's `seo_ops_alerts` + webhook. A failed fetch is "not checked" and never overwrites a fingerprint. **"I fixed this"** in the app sets `recheck_state` and the next morning's watch answers that finding (fixed / still open / not checked). Deployed and active 2026-10-13 |
| G12 | Annotations and change tests (control group for page changes) | REP, SITE | missing feature | Medium | L | SC 3.4, 3.5, 2.12 | F28 | 5 | fixed 2026-10-13 (harness S56, app tests) — one dated registry `v5/data/seo_events.json` (7 Google updates + the Sep-2025 num=100 break) inlined everywhere; marks computed from stored rows (published pages, audits and what they cleared, registry events in the window) on the search, overview and ladder charts and in the weekly / rank e-mails, with a "not comparable" callout across a data break; `_change_test.js` generalises the control-group reading to page changes ("Likely helped" … "Can't tell", method ends "a control group narrows the alternatives: it is never proof of cause"), won-link readings bit-identical. Deploy: two `seo_link_impact` columns |
| G13 | CMS push behind Manual approval | CAD | missing feature | Medium | M | SC C16 | F29 | 5 | open |
| G14 | Response-vs-render diff | TECH | missing feature | Low | M | SC 1.4 | F30 | 5 | fixed 2026-10-13 (harness S63, build section 54) — every audit reads up to 5 key pages twice (rendered through Jina, raw response) and compares title, H1, canonical, robots meta, link count and text length; each figure names its reading, URLs compare host-agnostically, a failed reading is an unscored "not checked" with its reason, and a crawl without JavaScript never stands in for a render. **Live audit still to confirm** |
| G15 | Expiring share links | REP | missing feature | Low | M | SC 3.7 | F31 | 5 | fixed 2026-10-13 (harness S58, app migration 0004) — an expiring, revocable share link to one report and its files only (two GETs, rate-limited, 14 days by default, 1-90; the boundary is written in `app/API.md` and `app/README.md`) |
| G16 | First approved live outreach send | LB | missing feature | Medium | S | SC 4C.5, 4C.6 (not live-verified) | F32 | 5 | open |
| G17 | Calibration from 20+ live pages (timelines, reach, QA threshold) | KW, CON | missing feature | Medium | L | SC K1, K10, C9 | F33 | later | open |
| G18 | Labelled accuracy set: ≥ 95% precision for audit findings and spam labels | TECH, BL | quality | Medium | M | spot-check 5 / 7 (§2.5); SC 1.14, 4B.5 | "To reach 9" #2 | 3C | fixed 2026-10-12 (harness S49, `ACCURACY_SET.md`) — 53 audit cases over techand.ai / peppol.org / azdan.com and 34 spam cases (16 real farm referrers vs 18 genuine), every case labelled with a reason and source; the scorer fails under 95% precision, on an unlabelled finding, on recall loss or a shrinking set. **Measured: audit findings 100% precision / 100% recall, spam labels 100% / 100%** — with the honest second number **useful precision 75%** (10 of 40 true findings are not worth reporting) and best-link precision 50% (see G18-1). Thin: three healthy sites, so Critical findings are unmeasured |
| G19 | One site model that every workflow reads | all | quality | High | M | SC §4 "Incoherence"; D5, D10, D11, D15, D22 | F5 / F11; "To reach 9" #3 | 2A | verified live 2026-10-12 (canonical_host www.techand.ai, business_name Tech&, nap_json, nav_pages_json 12 entries); `services_json` empty → P2-2 |
| G20 | AI question panel of 100+ prompts | AIV | missing feature | Low | M | SC 4A.1 | "To reach 9" #4 | 5 | open |
| G21 | Delivery rate measured (≥ 99%) | OPS | ops | Medium | M | SC 3.8 | "To reach 9" #5 | 6D | fixed 2026-10-13 (app `delivery.ts`, 17 unit tests) — delivered / settled per week for app runs and the nine schedules, missed schedules (schedule clock vs n8n history, 90-minute grace), the alert rate per channel, a 99% target, and what cannot be measured said in words, on the platform admin page |
| G22 | AI Growth source titles cut at a hyphen ("E", "Best e") | AIG | quality | Low | S | exec 376; §2.6 | — | 4A | verified live 2026-10-12 (source titles whole) |
| G23 | Claude spend known only as $1.6–3.0 (streaming nodes report no usage) | OPS | wrong number | Medium | M | RESULTS spend table; SC 3.10 | — | 6E | fixed 2026-10-13 (harness S60, build section 51) — `_cost_cal.js` prices every Claude call from prompt / answer characters and the thinking budget, so the streaming nodes are counted and labelled estimated; a settled ledger row keeps `measured_usd` and `estimated_usd` apart with its basis; the per-mode estimates come from the measured runs and self-correct (rolling figure in `seo_cache`, never below the mode's recent settles); `reconcile_claude_cost.py` corrects the model factors from an owner-supplied Anthropic Console export (O-item: the export) |
| G24 | Crawl coverage figure (% of known URLs crawled) | TECH | quality | Low | S | SC 1.1 | — | 3A | verified live 2026-10-12 ("Crawled 45 of 45 known URLs (100%)") |
| G25 | URL Inspection of every key page within quota | TECH, SITE | missing feature | Medium | M | SC 1.3, 2.9 | — | 5 | fixed 2026-10-13 (harness S53) — URL Inspection with a never-inspected-then-oldest rotation inside the real quota (2,000 a day, 600 a minute per property; 150 on the weekly run, 100 in an audit): index state, Google's chosen canonical vs ours, crawl date, mobile usability, rich results; an exhausted quota or missing permission reads "not checked", never "fine" |
| G26 | Impact-weighted audit priority | TECH | quality | Medium | M | SC 1.6 | — | 3B | verified live 2026-10-12 (both reports: "Ordered by likely impact." with a quantified why-first; 27 of 50 findings ordered, cosmetics last) |
| G27 | Pre-release check (staging URL / CI) | TECH | missing feature | Low | L | SC 1.8 = 0 | — | 5 | fixed 2026-10-13 (harness S62) — synchronous `POST /webhook/seo-prerelease` (`SEOagentPreRel1`, 8 nodes, in `apply_env.py`): verdict / exit code / failures / counts for CI, staging noindex and robots as warnings, "not checked" with reasons, and no Data Table or sub-workflow node at all (asserted) |
| G28 | Statistical alert thresholds in site tracking | SITE | quality | Low | S | SC 2.11 | — | 3A | verified live 2026-10-12 (95% ranges, `statistically_real`, core-update context, one non-percentage alert); completed 2026-10-13 (harness S62) — the last fixed threshold, the position alert, needs 50 impressions in both periods (below that a move is an info "Watch" naming both counts) and `ST.tested` puts the source, periods, test and confidence on every alert |
| G29 | Lineage (source, date range, sample) on every number | REP | quality | Low | M | SC 3.11 | — | 5 | fixed 2026-10-13 (harness S56, app tests) — `_lineage.js` + `app/shared/src/lineage.ts` (one vocabulary, reusing G6 / G8 / G28 / G26 wording): source, period, sample and basis beside every figure group, as a note and a "Where these numbers come from" table, in the weekly report, AI visibility, AI growth, backlinks, link building, rank tracker, ladder plan and full report, plus the callbacks and the app's panels. A figure from a source that is not connected reads "source not recorded" with the reason, never a borrowed source. Not covered yet: the technical-audit report node, the app's technical page and the keyword-strategy report |
| G30 | Images produced, not only planned | CON | missing feature | Low | M | SC C13 | — | 5 | fixed 2026-10-13 (harness S54) — `Image Cards` → `Render Images` → `Attach Images`: cards built from the page's own headings and points, rendered to WebP by the local **Gotenberg** container (verified live: 200 OK, 11-43 KB, 0.16-0.36 s each, ≈ 1 s per run, $0); planned file names, alt text and sizes kept, listed in `meta.json`, e-mailed and in the callback; a failed render keeps the plan with its reason and never breaks the run |
| G31 | Stored style guide, applied and checked | CAD, CON | missing feature | Low | M | SC C17 | — | 5 | fixed 2026-10-13 (harness S63) — stored in `seo_profiles` (6 `style_*` columns: brand form, spelling variant, words to avoid, tone), applied in the brief / copywriter / editor prompts through `_style_guide.js` and checked in Content QA: a wrong brand name is a warning the editor must fix, the rest is advice in `style_notes`, so R11's gate is untouched. Needs `sync_tables.py` + techand.ai's guide filled |
| G32 | Topic radius as a block + automatic re-plan of stuck ladders | LAD | quality | Medium | M | SC K12, K13 | — | 5 | fixed 2026-10-13 (harness S58) — `_radius.js` draws the topic radius in the research and the ladder plan (in reach / stretch / out of reach with its evidence, shown never enforced); `_replan.js` turns a ladder stuck for `seo_monitors.stuck_weeks` (empty = 8) into a proposal marked `applied: false` |
| G33 | Coverage target against the best competitor | CON | quality | Low | S | SC C1 | — | 5 | fixed 2026-10-13 (harness S54) — *Parse Analysis* picks the **best** competitor page by term coverage (not the average) and publishes its coverage, subtopics and depth; the brief carries the target; Content QA re-measures and scores 25 coverage points against it (clamped 60-90%), warns on missing subtopics and reports coverage with its basis |
| L1 | E-mail address validation (MX check) before sending | LB | missing feature | Medium | S | owner discussion | — | 4C | fixed 2026-10-12 (harness S45, app tests); not exercised live (no mailbox connected), though all 9 recipient domains resolve MX |
| L2 | Automatic quality gate for drafted outreach e-mails | LB, AIG | missing feature | High | M | owner discussion; D12–D14 | — | 4C | verified live 2026-10-12 (6 of 6 drafts held with reasons: "needs you: [Your name]"; 79-87 words, one link each) |
| L3 | PDF report for the Link Builder | LB, REP | missing feature | Low | S | owner discussion | — | 5 | fixed 2026-10-13 (harness S58) — *LB Doc* -> Gotenberg renders the Link Builder's week as a PDF (8 pages measured locally), attached to the e-mail and carried in the callback; a renderer failure keeps the run with the HTML |
| L4 | Gmail / Microsoft 365 OAuth mailboxes | LB | missing feature | Medium | L | LINK_BUILDER_SPEC §10 | F32 (part) | 5 | fixed 2026-10-13 (app, 15 tests) — Microsoft 365 through Graph (send + read, cursor-based) and Gmail through `messages.send`, with PKCE, the refresh token sealed with `MAILBOX_KEY`, renewal 2 minutes before expiry and revoke on disconnect (Microsoft has none: the UI names where to withdraw). **Owner: `MS_OAUTH_CLIENT_ID/_SECRET/_TENANT`, `GMAIL_OAUTH_CLIENT_ID/_SECRET` in `app/.env`** or the buttons stay disabled; Gmail reply-reading needs Google's restricted-scope verification |
| L5 | Podcast and journalist-digest sources | LB | missing feature | Low | M | LINK_BUILDER_SPEC §10 | — | 5 | fixed 2026-10-13 (harness S61) — podcast shows that take guests (free directory -> the show's RSS -> its own site; refused when off topic, stale or with no contact on its own domain) and HARO / Source of Sources digests read from the connected mailbox as `digest` prospects, gated like every other prospect. **Needs a connected mailbox (O4)** before a digest arrives; Podcast Index itself is unusable from n8n (its sha1(key+secret+time) signature cannot be produced — `$env` is blocked), so the free directory is used |
| L6 | Linkable-asset ideas from competitors' most-linked pages | LB | missing feature | Low | M | LINK_BUILDER_SPEC §10 | — | 5 | fixed 2026-10-13 (harness S61) — asset ideas from competitors' most-linked pages (`domain_pages`, monthly, ≈ $0.02 a competitor), at most 4, each naming the pages and referring domains behind it, never a promise of links |
| L7 | Reply rates per subject line (A/B) | LB | missing feature | Low | S | LINK_BUILDER_SPEC §10 | — | 5 | fixed 2026-10-13 (app) — two subject styles handed out A/B/A/B, one rule in `_ab.js` + `subjectAbStats`: under 30 sends a variant shows its counts and "not enough sends yet" |
| O1 | Fill the business profile (author, reviewer, address) and add a case study | CON, LB | owner | High | — | §4; every page / draft has [Author] | — | owner track | open |
| O2 | Fill business facts and CTA for techand.ai in the app | CON, LB, AIV | owner | High | — | §4 (fields empty) | — | owner track | open |
| O3 | E-invoicing positioning: MoF accreditation, or a named accredited partner | LB, AIG, AIV | owner | High | — | §4; LINK_BUILDER_SPEC §10 | — | owner track | open |
| O4 | Connect techand.ai's mailbox, with its postal address | LB | owner | Medium | — | LINK_BUILDER_SPEC §10 | F32 (part) | owner track | open |
| O5 | Answer October's Search Console check-in | SITE | owner | Medium | — | §3 #26 (D25c) | F16 (part) | owner track | open |
| O6 | Upload the IndexNow key file to techand.ai | AIG | owner | Low | — | §2.6, §4 | — | owner track | open |
| O7 | Upload Search Console "Latest links" export in the app | BL | owner | Medium | — | SC 4B.1 | — | owner track | open |
| O8 | AI question panel size (techand.ai: 8, the pulse asks 7; 20 ≈ +$5/month) | AIV | owner | Medium | — | SC 4A.1; F26 | F26 (part) | owner track | open |
| O9 | Publishing decisions for the 4 written pages | CAD | owner | Medium | — | §4; D10, D11 | — | owner track | open |
| O10 | Fix the true audit findings on techand.ai | TECH | owner | Medium | — | §2.5, §4 | — | owner track | open |
| O11 | Test leftovers: Link Builder on, Reply Reader active, new ladder, `SEOagentTmpTest1` | OPS | owner | Low | — | §5 | — | owner track | open |
| O12 | Approve the paid live checks and the re-rating run | OPS | owner | High | — | §5 of this plan | — | owner track | open |

**Counts.** 80 items: 28 D rows (D1–D26, with D25 as a / b / c), 33 G, 7 L, 12 O. By type: wrong advice 12, wrong number 9, quality 20,
missing feature 23, ops 4, owner 12. By impact (D, G and L only): High 12, Medium 31, Low 25.

### 3.2 Live defects (D)

#### D1 · Spend and rate guards undercount under concurrency
- **Wrong:** *Rate Limit* keeps its counters in `$getWorkflowStaticData('global')`. Parallel executions read the same old value, and the last
  one to finish overwrites the others. After 8 app runs and 3 spawns the counters showed `rate.total 5`, `app:<company> 3`, `ai_budget.spent_est
  $0.67`, against about $3.0 estimated. Parallel requests can bypass the $6/day budget and the 40/day company limit.
- **Where:** node *Rate Limit* in the main workflow (a v3 node; its logic is patched in `build_v4.py` §8d ~l.892–920, §10 ~l.1061, §11
  ~l.1201, §21 ~l.1942–1956). `v5/code/Assess_Validate.js` (Keyword Check, 40/day per caller) has the same static-data counter. Columns go in
  `ladder_common.py`.
- **Fix:** replace read-modify-write with append-only reservations. Add a new Data Table `seo_run_ledger` (run_id, key, mode, est_usd,
  created_at, status, settled_usd). A Data Table insert before *Rate Limit* adds this run's row. Rate Limit then loads today's rows and
  refuses when the rows with a lower row id plus this one exceed a limit (a following node marks the row `refused`). The run ledger settles
  `settled_usd` at the end. No update is lost, and only a short check-after-insert window remains. For production (Postgres, D25a), the
  same reservation can use an advisory lock: the pattern is in `app/server/src/services/spend.ts` (`lockCompany`, `assertBudget`). The app's
  own budget check is already locked.
- **Accept:** harness: with a ledger fixture of N rows, run N + 1 over the limit is refused, and row order decides ties. Live: 8 parallel
  `describe` requests keyed `app:<test company>` (≈ $0.05) leave 8 ledger rows and a count of 8. With a temporary limit of 5, exactly 3 are
  refused.
- **Moves:** Cost & reliability, "Guards" (2), 3.10.

#### D2 · Audit diff compares unlike report types
- **Wrong:** the Audit Scheduler's technical audit (exec 385) was compared with the full report from 20 minutes earlier and said "25 fixed ·
  1 new, +12". Its "fixed" list held ranking, AI and keyword-gap findings that a technical audit never checks.
- **Where:** `v5/code/Audit_Diff.js`: `prev = audits[0]` takes the newest stored audit of any type. `v5/code/Audit_Row.js` already stores
  `report_type`. The diff is shown by *Build Full Report* (`DIFF_SECTION_JS`, `build_v4.py` ~l.1853) and the Audit Scheduler report.
- **Fix:** compare only with the latest audit of the same `report_type`, and treat a site with none as a baseline. Never mark "fixed" a
  finding in a category the current audit does not assess (keep a category list per type). Compute the score change only between audits of
  the same type.
- **Accept:** harness: history [technical, full report] plus a new technical audit compares with the technical one; a technical audit with
  only a full report stored is a baseline. Live: run the Audit Scheduler on demand after a full report.
- **Moves:** TECH 1.7, 1.10.

#### D3 · PBN link-farm pages ranked as the best links
- **Wrong:** 15 PBN pages share one path (`/all/2835/13.html`) and the anchor "High Quality Dofollow Backlinks DA 50 PA 40 Premium PBN Network
  Service …", some on casino domains. They rank above peppol.org in "best links" (SEO value 49 vs 35). Only 4 of the 16 are flagged spammy and
  the disavow file lists 4. The rest show as "at risk", and the Link Builder tracks their "impact".
- **Where:** `v5/code/Parse_Backlinks.js`: `SPAM_WORDS` ~l.24 is applied only to *new* links (`spamOf`), values come from `LK.values` ~l.108,
  `best_links` is at l.163 and the disavow list at l.183. `v5/code/_link_kit.js` `values()` ~l.150–162 caps a link only when `link_type === 'spam'`.
  Also `Link_Merge.js` (ledger), prompt `link_analyst.txt`, and the impact rows in `LB_Assemble.js` / `seo_link_impact`.
- **Fix:** run a footprint gate on the whole ledger before scoring. A cluster is (a) the same URL path or the same anchor on ≥ 3 referring
  domains, (b) anchors with PBN / DA / PA / "dofollow backlinks" / casino / betting, or (c) gambling hosts. Cluster members get `link_type spam`
  and SEO and brand value 0. They are left out of best links, at-risk alerts, important-lost and impact tracking. The whole cluster goes on the
  disavow candidates, which stay review-only.
- **Accept:** extend harness S28 (it already holds techand.ai's real link-farm links) with the 16-domain cluster from exec 368. All 16 must be
  flagged, peppol.org must be the top best link, the disavow list must hold 16, and there must be no impact rows for them. Live: a full
  backlinks check.
- **Moves:** BL 4B.4 (2), 4B.5 (3); LB 4C.9.

#### D4 · Keyword gap recommends government navigational queries
- **Wrong:** the full report recommends pages for "fta login" (90,500/mo), "fta", "emaratax", "emirates id" and "emirates id status" (exec 370).
- **Where:** node *Analyze Keywords* (v3 code inside `workflows/SEO_Agent_v4.json`, patched through `build_v4.py`):
  `keyword_gap = notWinning.filter(…)` filters nothing on intent, brand or relevance. It is shown by *Build Full Report* and *Competitor Analysis*.
- **Fix:** build one shared fit gate as a new kit, e.g. `v5/code/_fit_gate.js`, inlined the way `_reach.js` is. It refuses navigational
  intent (Labs intent), government and portal terms (login, portal, status, sign in, renew, id, ministry or authority names, SERPs owned by
  `.gov.*` hosts) and other brands (competitor domain labels, learned AI brand names `seo_cache ai_brands:`). Once G19 exists it also checks
  relevance to the site's services. Call it from Analyze Keywords, `Rank_Keywords.js` and `Ladder_Pool.js` (D8).
- **Accept:** harness: the five exec-370 keywords are refused with a reason, and "e invoicing software uae" is kept. Live: the full report's
  gap list has no navigational or government terms.
- **Moves:** KW K5 (4).

#### D5 · Pile-up guard undercounts unpublished pages
- **Wrong:** pages that the ladder writes are not in `seo_content_log`. The cadence counted 2 pages waiting while 4 were written and
  unpublished, and planned 2 more for Monday (exec 380).
- **Where:** `v5/code/Cadence_Plan.js` ~l.113–115 counts only content-log rows with status `started`. Its mirror is
  `app/server/src/services/cadence.ts` (`waitingPublish`, `maxWaiting`). Ladder page spawns are in `v5/code/Spawn_Page_Runs.js`. Ladder rows carry
  status `writing` (`v5/code/Ladder_Rows.js` l.11). The app's "Write now" also starts content runs.
- **Fix:** (1) Every content run for a site (ladder spawn, Write now, cadence) writes or updates one `seo_content_log` row in the main
  workflow, keyed site + keyword, with source ladder / app / cadence. (2) The guard counts distinct keywords from the content log *plus* ladder
  rows with status `writing` and no published URL, over 120 days. Change `cadence.ts` the same way.
- **Accept:** harness S24: 2 log rows + 2 ladder rows `writing` gives a pile-up at limit 3 and nothing is planned. The same case in
  `app/server/test/cadence.test.ts`. Live: a cadence dry run says 4 waiting and paused (pile-up).
- **Moves:** CAD C14 (4).

#### D6 · "www and non-www not consolidated" is a false positive
- **Wrong:** techand.ai answers 308 to www.techand.ai and the canonical is www, yet every audit since 2026-10-01 has a High finding. The same
  report lists the redirect under "what works", and the fix points the wrong way (exec 354, 370, 385).
- **Where:** *Build Site Issues*: `addDomain(dc.test_canonicalization === false, … 'www and non-www versions are not consolidated' …)` takes
  DataForSEO's domain check at face value. *Analyze Probes* (`build_v4.py` §5 ~l.274–310) already computes `apexToWww` (any 3xx, so 308
  counts) and `canonical_host`.
- **Fix:** raise the finding only when the host probes show both hosts serving 200 with no redirect, or a redirect whose target disagrees with
  the canonical. Never raise it from `test_canonicalization` alone. Word the fix after the observed canonical host.
- **Accept:** harness: apex 308 → www with a www canonical gives no finding; both hosts 200 gives the High finding. Live: technical audit.
- **Moves:** TECH 1.2, 1.6, 1.14.

#### D7 · RDAP results never parsed
- **Wrong:** *RDAP Lookup* returns rdap+json as a string under `data`, while `RDAP_Results.js` reads `r.events`. All 3 domains went to paid
  WHOIS ($0.36), although RDAP had their dates (exec 370).
- **Where:** `v5/code/RDAP_Results.js` (`regOf`). Check that `v5/code/Domain_Ages.js` reads RDAP the same way. Node *RDAP Lookup* is in
  `build_v4.py` §8b ~l.637 and §20 ~l.1889.
- **Fix:** parse `r.events ? r : JSON.parse(r.body ?? r.data ?? '{}')` (in a try/catch), take the registration event, and send to WHOIS only
  the domains without a date.
- **Accept:** harness: an RDAP answer as a string under `data` sends no WHOIS request. Live: a second full report costs $0 WHOIS, which also
  proves the domain-age cache (RESULTS "not run").
- **Moves:** OPS 3.10.

#### D8 · Competitor brand planned as a ladder rung
- **Wrong:** "facts erp" (FACTS ERP / facts.ae) was planned as a rung-2 blog post and written into the main page (exec 352, 365).
- **Where:** `v5/code/Ladder_Pool.js` marks only the site's own brand as navigational (l.26, l.71). Also `v5/code/Ladder_Plan.js`, prompt
  `v5/prompts/keyword_relevance.txt` (*Ladder Keyword Relevance*), and the cluster list passed to the writer in `v5/code/Brief_Context.js`.
- **Fix:** use the D4 fit gate. A keyword is another brand when one of its tokens equals a competitor or SERP domain label (facts.ae ↔ "facts")
  or a learned AI brand. When the keyword's SERP is in hand, it is also a brand query when one domain whose label is in the keyword holds ≥ 3
  of the top 5 results. Refused keywords never reach rungs or the brief.
- **Accept:** harness S25 with the exec-352 pool: "facts erp" is refused ("other brand") and the other rungs are unchanged. Live: a ladder
  plan for a new head keyword.
- **Moves:** LAD K9; KW K5.

#### D9 · Hub page links to unwritten pages
- **Wrong:** the Direct-plan main page is published first, yet it links twice each to 3 pages that do not exist. "Guides in this series" uses
  lowercase keyword strings as anchors ("Facts erp") (exec 365).
- **Where:** `v5/code/Brief_Context.js` (hub pages with a `planned` flag go to the writer's link list) and `v5/code/Blog_Package.js` l.92–96
  (series block, `cap(p.keyword)`) and l.170. Prompt `v5/prompts/copywriter.txt`.
- **Fix:** only live URLs (published or detected) become links, in the body and in the series block. Planned pages go to `meta.json` as
  "links to add when published", and the tracker or cadence reminds the owner when one goes live. Anchors use the planned page's title, or a
  title-cased keyword that keeps acronyms ("ERP").
- **Accept:** harness: a hub with 3 planned pages and 1 live page has 1 link in the HTML and Markdown and 3 in `meta.json`; no anchor is all
  lowercase. Live: a ladder page run.
- **Moves:** LAD K11; CON C12.

#### D10 · Generated page not publishable
- **Wrong:** the page holds 30 × [Price], 20 × [Timeline], [Office address], [Phone number] and "[Your Business Name]" in its schema, although
  the homepage schema has Tech&, the DAFZA address and the phone number (the fix pack's `files/localbusiness.jsonld` has them). It runs
  3,952 words against 2,100 (ladder verdict) and 3,100 (brief). QA scored it 91 and passed it (exec 365).
- **Where:**
  - `v5/code/Content_QA.js`: `bizName` l.246–247 reads only the profile and site description. The pass rule at l.303 allows ±25% of the brief
    target, so 3,844 main words against 3,100 passes. There is no placeholder gate.
  - *Parse Brief* (v3 node, patched `build_v4.py` ~l.1690) does not clamp the brief's `target_word_count`.
  - `v5/code/Parse_Analysis.js` l.13–17 clamps `recommended_word_count` (900–2,400 / 1,200–3,000), but the brief ignores it.
  - `v5/code/Ladder_Plan.js` l.128 copies `page_type: base.recommended_page`, free text from `v5/prompts/verdict.txt`.
  - `v5/prompts/strategy_brief.txt` chose the cost / timeline angle.
  - The NAP source already exists in *Entity Check* `homepage_org`, as used by `Fix_Pack.js`.
- **Fix:**
  1. Take the NAP, business name and logo from the site model (G19: profile → homepage Organization / LocalBusiness schema → GBP).
  2. Allow a cost or timeline angle only when pricing or timeline facts exist (profile, `business_facts`).
  3. *Parse Brief* clamps `target_word_count` to the analysis' recommended count ±10%, or to the ladder verdict's target when one is given.
  4. QA fails on more than 5 placeholders (not counting `[Owner: confirm …]` notes) or more than 25% over target.
  5. Normalise `page_type` to the form's fixed list and keep the free text as `page_notes`.
- **Accept:** harness: Content QA on `files/erp-software-uae.md` fails (placeholders, length), the schema of a site without a profile uses
  the homepage organisation, and the brief is clamped. Live: a ladder page has ≤ 5 placeholders, a length within ±25% of the verdict target
  and Tech&'s NAP in the schema.
- **Moves:** CON C2, C4, C8, C9.
- **Depends:** G19. Real data needs O1 / O2.

#### D11 · Blind to existing pages
- **Wrong:** the 2026-10-01 ladder planned "uae e invoicing penalties", although
  `/insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs` has been live since 2026-08-21 (AI-readiness 90, known to
  AI Growth). Today the Rank Tracker and the Site Tracker say "publish it", which would cannibalise the live page.
- **Where:**
  - `v5/code/Ladder_Plan.js` `findExisting` l.78–92 matches slug tokens by Jaccard ≥ 0.5: 3 keyword tokens in a 9-token slug give 0.33, a
    miss. It reads no titles and no Search Console pages.
  - `v5/code/Tracker_Report.js` l.39 writes "already written — publish it".
  - The Site Tracker's advice: `v5/code/Site_Metrics.js`, prompt `site_brief.txt`.
  - Publish detection: `v5/code/Detect_Published.js`.
  - AI Growth's `seo_ai_pages` already holds the page.
- **Fix:** keep a weekly page inventory in the site model (G19): sitemap URLs + title / H1 (the Site Tracker already reads sitemaps), Search
  Console page → top queries, and AI Growth's key pages, stored per site (a new table `seo_pages`, or `seo_cache` `page:` rows). A page matches
  when ≥ 75% of the keyword's tokens are in its slug or title, or when it already gets impressions for the query. Use the inventory in Ladder
  Plan (status `improve` with the real URL), discovery (D20), tracker and Site Tracker advice ("refresh the existing page") and the cadence.
- **Accept:** harness: an inventory with the real /insights URL and title maps "uae e invoicing penalties" to it, and S26's false-match pair
  still does not match. Live: a ladder plan for a keyword with a live page says `improve`, and the Site Tracker brief stops saying "publish".
- **Moves:** KW / LAD K8 (3); SITE 2.10; REP 3.3.
- **Depends:** G19.

#### D12 · AI Growth drafts to government sites and competitors
- **Wrong:** AI Growth drafted 3 messages to mof.gov.ae / tax.gov.ae (which the Link Builder correctly refuses) and drafts to orksync.com,
  suntecgroup.com and flick.network (competitors). The drafts open with "your site is cited in AI answers (Perplexity, Claude …)", quote
  nothing and sign as "techand.ai" / "Techand". finline.ae was drafted by both writers (exec 376).
- **Where:** `v5/code/Earned_Media.js` (kinds, the 3 drafts per site ~l.45+), `v5/code/AI_Outreach_Input.js`, prompt `v5/prompts/ai_outreach.txt`.
  The Link Builder's gates are in `v5/code/_outreach_kit.js` (`isGov` l.67) and `v5/code/LB_Assemble.js` ~l.70.
- **Fix:** when `link_builder` is on, AI Growth stops drafting and hands its earned-media prospects (with the cited question as evidence) to
  `seo_link_prospects` for the Link Builder's qualification and writer, so there is one writer. The Backlink Monitor already works this way.
  When it is off, apply the same `_outreach_kit.js` gates (government → apply, competitor, bare homepage, webmail / data broker). Take the
  brand from the site model. The prompt drops "AI cites you" and must quote the page.
- **Accept:** harness S29 (AI Growth) / S30: with `link_builder` on there are 0 drafts and the prospects are passed on; with it off there is
  no draft to `.gov` or to a competitor, and the signer is "Tech&". Live: an AI Growth run.
- **Moves:** AIG drafts row (2); LB 4C.2, 4C.4.
- **Depends:** D13, G19.

#### D13 · Link Builder pitches the wrong people, as "techand"
- **Wrong:** (exec 372)
  - The brand is written "techand", and targets mix the bare host and www.
  - It pitches competitors (bemea.com, sscoglobal.com) and homepages (apideck.com, technologycounter.com).
  - It asks accredited-provider lists to add Tech&, which is not accredited.
  - outlook.com and zoominfo.com are listed as broken-link prospects.
  - Listings: 12 of 16 are "unknown". The MoF list flipped from "missing" to "unknown" within one day.
- **Where:** `v5/code/LB_Plan.js` l.30 (with no profile, the brand falls back to the domain label), `v5/code/LB_Writer_Input.js` (business,
  signer), `v5/code/LB_Assemble.js` (qualification), `v5/code/_outreach_kit.js` (`pickTarget`, infrastructure lists), `v5/code/_listings.js`,
  prompt `v5/prompts/link_outreach.txt`.
- **Fix:**
  - Take the brand from the site model (profile → `og:site_name` / Organization name → description).
  - Refuse competitors: in the site's competitor list, or the prospect sells the same services (service-term overlap with the site model plus
    vendor signals).
  - Refuse bare homepages unless the prospect is a listing, and refuse webmail, data-broker and infrastructure hosts.
  - Refuse accredited / certified lists unless the profile says the site is accredited (O3).
  - Put targets on the canonical host (D15).
  - For listings, keep the last definite status with its date when a later check hits a bot wall.
- **Accept:** harness S30 with the exec-372 prospects: bemea.com / sscoglobal.com are refused as competitors, the apideck.com homepage is
  refused, outlook.com / zoominfo.com are refused, and the accredited list is refused without the fact. The signer is "Tech&". A listing that
  goes from missing to a bot wall shows "missing (checked <date>)". Live: a paid Link Builder run (≈ $0.10).
- **Moves:** LB 4C.2 (5), 4C.4, 4C.8.
- **Depends:** G19, D15.

#### D14 · Reply Reader invents a business fact
- **Wrong:** with empty facts, the suggested answer said "we're not directly accredited by the Ministry, but we work with accredited
  providers" (execs 357–360).
- **Where:** prompt `v5/prompts/reply_reader.txt` l.11 (the whole "use only this" block disappears when `facts` is empty) and l.28,
  `v5/code/Reply_Input.js`, `v5/code/Reply_Result.js`. The app's call is in `app/server/src/services/outreachJobs.ts` ~l.141 (`replyRead`); check
  which facts it sends.
- **Fix:** always include the facts block ("none on file") with the rule "a statement about the business that is not in the facts goes in
  [Owner: …]". Add a deterministic check in `Reply_Result.js`: claim words (accredited, certified, partner, ISO, years, clients, %, prices) not
  found in the facts get bracketed and set `needs_you: true`. The app sends `business_facts` and the profile facts. L2 extends this check to
  every draft.
- **Accept:** harness: the exec-357 question with empty facts gives no unbracketed accreditation claim and `needs_you` true. Live: Reply
  Reader on 4 synthetic replies (≈ $0.01).
- **Moves:** LB 4C.4.

#### D15 · No shared canonical host
- **Wrong:** ladder target URLs, internal links, Bing submissions and the IndexNow key URL use bare techand.ai, which 308-redirects. The
  audit flags "links pointing to redirects".
- **Where:**
  - `'https://' + domain` is built in `v5/code/Content_QA.js` (4×, incl. `pageUrl` and `home`), `Parse_Backlinks.js` (4×), `Ladder_Plan.js`,
    `LB_Plan.js`, `Audit_Candidates.js`, `Audit_Diff.js`, `Client_Page_Requests.js`, `GSC_Audit_Plan.js`, `Growth_Entity_Requests.js`,
    `Access_Requests.js` and `Profile_Delivery.js`.
  - AI Growth `v5/code/Growth_Plan.js` l.44 picks `site_host` by vote and feeds `Growth_IndexNow_Keys.js` / `Growth_Bing_*`.
  - *Analyze Probes* already knows `canonical_host`.
- **Fix:** resolve the canonical host once (homepage request following redirects + `rel=canonical`) and store it as
  `seo_sites.canonical_host`, a new column (`ladder_common.py` + `sync_tables.py`), inside the site model (G19). Add one helper, `siteUrl(path)`,
  and use it wherever a URL is emitted; API targets keep the bare domain.
- **Accept:** a build or harness lint finds no `'https://' + domain` outside an allow-list. Fixtures with a www canonical emit every URL on
  www (ladder `target_url`, internal links, IndexNow `keyLocation`, Bing list, Link Builder targets). Live: AI Growth and a ladder page.
- **Moves:** CON C12; AIG 4A.10; LB 4C.8.
- **Depends:** G19.

#### D16 · Rank Tracker's next step is wrong
- **Wrong:** (exec 378)
  - For "peppol uae" it says "Every rung is in the top 10: write or improve the top page". The ladder has no rungs, and the page is neither
    published nor ranking.
  - For "erp software uae" it says "work on rung 1", although the Direct plan writes the main page first.
- **Where:** `v5/code/Tracker_Report.js` l.33–40. With no rungs, `rungs.find(r => !r.reached)` is undefined, so the code falls through to
  "every rung in the top 10". The step ignores the plan type and the main page's status.
- **Fix:** derive the step from the ladder's state:
  - main page not written → write it;
  - written but not published → publish it, with a link to the page;
  - rungs only after the main page is published (the cadence's gate rule);
  - "every rung in the top 10" only when rungs exist and are all in.
- **Accept:** harness S24 / S25 with three ladders (no rungs + unpublished main page; Direct with the main page written; full plan with
  rungs) gives the expected texts. Live: a Rank Tracker run (≈ $0.06).
- **Moves:** LAD K13; RANK; REP 3.3.

#### D17 · Fix-pack robots.txt opens private paths to AI bots
- **Wrong:** the proposed robots.txt adds a group for OAI-SearchBot, ChatGPT-User, PerplexityBot and the others with only `Allow: /`. A
  crawler named in its own group ignores the `*` group, so /api/, /admin/ and /private/ are open to those bots (`files/robots.txt`, exec 370).
- **Where:** `v5/code/Fix_Pack.js` l.14–32.
- **Fix:** edit the live file. Add an AI-search group only when a current rule blocks those bots, and copy the `*` group's Disallow lines into
  it. Otherwise the result is "no change needed".
- **Accept:** harness: techand.ai's live robots.txt comes back unchanged except comments; a robots.txt that blocks the AI search bots gets a
  group with the Disallow lines copied in. Live: the full report's fix pack.
- **Moves:** TECH 1.9 (4).

#### D18 · "Duplicate meta tags" false positive
- **Wrong:** the audit flags 45 of 47 pages. The only duplicates are 3 Next.js `theme-color` tags with light / dark `media` queries.
- **Where:** *Build Site Issues* page-check map, `duplicate_meta_tags` (a DataForSEO on-page check; the node is patched in `build_v4.py` §6).
- **Fix:** verify on the raw HTML of a sample page (the probes already fetch the homepage). Count duplicate `<meta name|property>` tags,
  leaving out tags that differ by `media`. Drop the finding when none remain; otherwise name the duplicated tags.
- **Accept:** harness: a Next.js head with 3 `theme-color` tags (media) gives no finding; two `description` metas give one. Live: technical
  audit.
- **Moves:** TECH 1.6, 1.14.

#### D19 · AI visibility errors, brand miscount, URL variants
- **Wrong:** 7 of 42 requests errored: DataForSEO "Internal SE Server Error" ×5 on AI Mode and AI Overview, ChatGPT "no response" ×2. The
  heading "Tax technology and e-invoicing software" was counted as a competitor brand. Cited pages count bare host and www, and
  `#:~:text=` fragments, separately (exec 362 / 363).
- **Where:**
  - `build_monitors.py`: *Run AI Requests* at l.135 (AI Visibility) and l.185 (AI Pulse), `dfs_http`. n8n's `retryOnFail` never fires on an
    error inside an HTTP 200.
  - `v5/code/AI_Requests.js`.
  - `v5/code/Parse_AI_Answers.js`: `cleanUrl` l.15 strips only utm / srsltid.
  - `v5/code/AI_Metrics.js` (brand counting), prompt `answer_analyst.txt`.
- **Fix:**
  - Add a retry gate modelled on `build_v4.py` §25: *AI Retry Requests* re-sends once, after a pause, every task with status ≥ 40000 or no
    answer, and merges the results before *Parse AI Answers*.
  - Rates count answered requests only, and the errors are listed.
  - A brand must map to a domain or a known brand name; reject headings and generic phrases.
  - Normalise cited URLs: host, no `www.`, no fragment, no tracking parameters.
- **Accept:** harness S19 / S27: a fixture with 50000 tasks is retried, a heading is not a brand, and two URL variants make one page. Live:
  `ai_visibility` with an error rate under 5%.
- **Moves:** AIV 4A.2, 4A.4.
- **Depends:** G1.

#### D20 · Discovery inconsistencies
- **Wrong:** (exec 356 / 364)
  - The top pick "e invoicing" overlaps the existing ladder head "e invoicing in uae", with no warning.
  - A card's "why" says "AI Overview present" while its own live check found none.
  - "Who ranks now" lists duplicate domains.
  - The callback JSON has float CPCs.
- **Where:**
  - `v5/code/Build_Keyword_Strategy.js`: l.60 takes the AI Overview line from Labs `serp_types`; it also builds "Who ranks now".
  - `v5/code/Rank_Keywords.js`.
  - `v5/code/Build_Ideas_Response.js` l.5 passes `cpc: k.cpc` raw.
  - *Load Domain Ladders* exists only on the ladder path, not in discovery.
- **Fix:**
  - Load the domain's ladders in discovery and mark keywords that a ladder head or rung covers.
  - Take the AI Overview text from the live check ("seen on <date>"), or label the Labs value "historical".
  - Dedupe domains.
  - Round CPCs to 2 decimals in the callback.
- **Accept:** harness S25 / S29: with the ladder "e invoicing in uae", "e invoicing" is flagged "covered by a ladder"; with no AI Overview in
  the live check, the card does not claim one; CPCs have 2 decimals. Live: discover.
- **Moves:** KW K3, K7, K8.
- **Depends:** D4 (fit gate).

#### D21 · Sparse Trends % in the brief
- **Wrong:** the Site Tracker brief said "peppol uae up 1,200%", from a sparse series (exec 382).
- **Where:** `v5/code/Parse_Trends.js` l.14–19 (direction `sparse`, but `change_pct` is still set), `v5/code/Brief_Input.js` l.12 (passes
  `change_pct` to the AI), `Trend_Rows.js`, `Site_Report.js` l.75, prompt `site_brief.txt`.
- **Fix:** set `change_pct` to null when the series is sparse (cached rows too) and leave it out of the brief input. The prompt says "too little
  search data" instead of a percentage.
- **Accept:** harness S10: a sparse series puts no % in the brief input or the report. Live: Site Tracker.
- **Moves:** SITE 2.12; REP 3.2.

#### D22 · Site description reads only the homepage
- **Wrong:** (exec 344, 348–350, 365)
  - `describe` lists 8 services and leaves out Business Central, CRM and Power Platform.
  - The Keyword Check scored "business central partner uae" at fit 1.
  - The critic called Tech&'s real "Assess & Envision / Run & Optimise" stages "invented", because /whatwedo/ is never read.
- **Where:** main workflow *Read Website* → *Site Read OK?* → *Site Describer* (agent) → *Parse Description* → *Description Cache Row*
  (`seo_cache desc:`). Used by `v5/code/Assess_Result.js` l.28 (Keyword Check services) and the content pipeline. Prompt
  `v5/prompts/critic.txt`.
- **Fix:** read the homepage plus up to 5 nav or service pages (same-host links in the header or nav, or sitemap URLs under service folders)
  and describe from all of them. Store the services and page list in the site model. Give the critic the services list or the pages' text; a
  claim found on the site is not "invented", and anything else is "unverified".
- **Accept:** harness: a homepage + /whatwedo fixture yields Business Central among the services, and the Keyword Check gives fit 2. Live:
  describe + 3 keyword checks (≈ $0.09).
- **Moves:** KW K5; CON C3.
- **Depends:** G19.

#### D23 · Backlink odds and ends
- **Wrong:** (exec 367 / 368)
  - The Ahrefs DR lookup failed on DNS (EAI_AGAIN) and was not retried.
  - clear.in (ClearTax's sister domain) and off-topic gap domains (stripe.com, weforum.org, kirkland.com …) were stored as prospects.
  - `utm_source=chatgpt.com` was kept in URLs.
- **Where:** `build_monitors.py` `get_http` l.226–233 (no `retryOnFail`; it feeds *Fetch DR*, l.254). `v5/code/Parse_Backlinks.js`: `sibling`
  l.135 compares first labels ("clear" ≠ "cleartax"), and the gap filters at l.143–145 have no topic check. `v5/code/_link_kit.js` `normUrl` l.16.
- **Fix:**
  - Give `get_http` the retry rule (G1).
  - Sister domains: also match a shared brand stem (≥ 5 characters) or a redirect to the competitor.
  - Gap prospects need the Link Builder's 25% topic match (`_outreach_kit.js`).
  - Strip `utm_*` / `srsltid` in `normUrl` and in stored URLs.
- **Accept:** harness S28: clear.in is refused as a sibling of cleartax.com, stripe.com / weforum.org / kirkland.com are refused as
  off-topic, and DR is retried after a simulated network error. Live: a full backlinks check.
- **Moves:** BL 4B.6; OPS 3.8.

#### D24 · Full report text errors
- **Wrong:** the author finding appears twice, "capped at 85" is shown while the score is 68, and scraper boolean queries are listed among
  the top queries (exec 370).
- **Where:**
  - *Build Site Issues* sets `cap_reason` whenever the High count reaches the cap rule (patched at `build_v4.py` ~l.501), even when the raw
    score is already lower.
  - Duplicate findings: *Build Site Issues* / *Build Full Report* merge the author finding from *Analyze HTML* and from the *Content
    Reviewer* agent.
  - Top queries: `v5/code/GSC_Audit_Findings.js`.
- **Fix:** show the cap message only when the cap lowered the score. Dedupe findings by normalised title or topic, keeping the higher
  severity. Leave queries with search operators (`site:`, `inurl:`, `intitle:`, quoted + AND / OR) out of the top queries, counted separately
  as "scraper queries".
- **Accept:** harness: score 68 with cap 85 shows no cap text, two author findings become one, and an operator query is excluded. Live:
  full report.
- **Moves:** REP 3.1, 3.2; TECH 1.6.

#### D25a · Scheduled runs missed
- **Wrong:** the AI Pulse schedule (06:30 New York, Tue–Sun) did not fire on 2026-10-10 or 2026-10-11. Earlier fires were late (exec 240 at
  10:48, exec 261 at 12:36 UTC), so the Mac was asleep or n8n restarted.
- **Where:** hosting (`n8n/compose.yml`; production overlay `n8n/seo-agent/production/compose.prod.yml` + `PRODUCTION.md`: Postgres, Redis,
  workers, not applied). The app's schedule list is in `app/server/src/services/pipeline.ts` (next / last run).
- **Fix:**
  - Move n8n and the app to an always-on host: production overlay, queue mode, TLS host, `CALLBACK_BASE_URL`.
  - Add a missed-run check: compare each schedule's last run with its cron, flag "missed" in the app and offer "run now".
  - Daily workflows catch up on start when today's row is missing (AI Pulse: `seo_ai_daily`).
- **Accept:** one week in which every scheduled run starts within 10 minutes of its time, and a stop / start test that produces the
  catch-up run.
- **Moves:** OPS "Ops" row (3); AIV 4A.3.

#### D25b · One ops alert channel, which failed
- **Wrong:** the Error Handler's e-mail failed on 2026-10-10 (ECONNREFUSED), and there is no other channel.
- **Where:** `workflows/SEO_Agent_Error_Handler.json` (static; sender and recipient patched in `build_v4.py` ~l.1491–1494). The app's failure
  watcher is `app/server/src/services/engineFailures.ts`.
- **Fix:** add a second channel. The Error Handler also posts to the app (a platform-admin alert, in-app) and to an optional webhook
  (Slack / Teams URL in `.env`, read at build time like the other `SEO_*` settings). The app watcher also alerts when n8n is unreachable.
  Repeated alerts are deduped.
- **Accept:** with SMTP disconnected, a forced failing test execution still produces an in-app or webhook alert within 2 minutes.
- **Moves:** OPS 3.8; REP 3.9.

#### D25c · Test check-in in production
- **Wrong:** October's Search Console check-in is still the 2026-10-02 test row ("October check-in (test)"), so the reminder will not ask the
  owner.
- **Where:** Data Table `seo_console_checkins` (public API `…/rows/delete?filter=`), `v5/code/Checkin_Intake.js` and the Site Tracker's
  reminder.
- **Fix:** delete the test row with the owner's OK, then O5. Check-ins marked as tests should not satisfy the reminder.
- **Accept:** the next Monday report shows the check-in reminder.
- **Moves:** OPS.

#### D26 · Volatile AI Overview stated as fact
- **Wrong:** the ladder plan said "no AI Overview", and the page run a few minutes later said "cites 11 domains" (exec 352, 365; verdict
  exec 347).
- **Where:** prompt `v5/prompts/verdict.txt`, the SERP digest in `v5/code/Clean_Competitor_Pages.js` (*Analyze Competitor Pages*),
  `Build_Keyword_Strategy.js`, `Build_Ladder_Report.js`.
- **Fix:** report an AI Overview as an observation with its time ("seen in the check at 15:58 UTC; AI Overviews vary between searches"), or
  as "seen in N of M checks" when there are several. A verdict must not hinge on one observation.
- **Accept:** harness: a digest with an AI Overview says "seen" with the date. Live: a verdict.
- **Moves:** KW K3.

### 3.3 Criteria gaps (G)

#### G1 · One retry rule for every external HTTP node
- **Wrong:** retries differ by builder. `get_http` (`build_monitors.py` l.226) has none, `HTTP_X` (`build_monitors.py` l.40,
  `build_site_tracker.py` l.58) allows 2 tries, and errors inside an HTTP 200 (DataForSEO 40000 / 50000) are never retried by n8n.
- **Where:** every builder (`build_v4.py` `DFS_HTTP`, `build_monitors.py`, `build_site_tracker.py`, `build_ladder_extras.py`, `build_api.py`)
  and the §25 retry gates in `build_v4.py`.
- **Fix:** every external idempotent HTTP node gets `retryOnFail`, 3 tries, 5 s apart (outreach sends excluded). The paid data paths (AI,
  SERP, backlinks) get a code-level retry gate for task errors.
- **Accept:** a lint at the end of the build lists every `httpRequest` node without a retry outside an allow-list and fails the build.
- **Moves:** OPS 3.8.

#### G2 · Stop emitting and scoring FAQPage
- **Wrong:** pages still carry FAQPage schema and QA scores an FAQ, although FAQ rich results stopped showing on 2026-05-07.
- **Where:** `v5/code/Content_QA.js` (schema §16, score), `v5/code/AI_Readiness.js`, `Publish_Check.js`, prompts `strategy_brief.txt` /
  `copywriter.txt`.
- **Fix:** stop emitting FAQPage. Keep question headings with 40–60-word answers, since AI answers still use them, without scoring an FAQ
  block.
- **Accept:** harness: no FAQPage in the schema, and the score holds without an FAQ.
- **Moves:** CON C11 (5).

#### G3 · Time-to-rank with 2025 data
- **Wrong:** rule R6 cites Ahrefs 2017 (5.7% of new pages in the top 10 within a year). The 2025 figure is 1.74%, and 40.8% of those got there
  within a month. Plans show month bands with no likelihood.
- **Where:** `v5/code/_reach.js` (`REACH_MONTHS` l.12, plan text), `n8n/seo-agent/PIPELINE_FEATURE_SPEC.md` R6, the app mirror
  `app/shared/src/keywords.ts` (reach label), and the verdict / ladder report texts.
- **Fix:** cite the 2025 figures. Show the 2025 base rate next to each plan's month range, with an "estimated chance" band per plan type that
  is clearly marked uncalibrated until G17 fits it.
- **Accept:** harness S25 strings and an app unit test for the label.
- **Moves:** KW / LAD K10 (4).

#### G4 · Claim checks
- **Wrong:** figures are not matched to their sources. A weak source (trangotech.com) is cited 3 times, and a Statista link keeps
  `?srsltid=` (exec 365).
- **Where:** `v5/code/Collect_Facts.js` (facts with URLs), `v5/code/Content_QA.js` (unsourced-number check), prompt `critic.txt`,
  `Blog_Package.js` (outbound links).
- **Fix:** look up each figure in the draft (formatting variants allowed) in the fetched text of its cited source; a figure not found is
  flagged or set as `[Confirm: …]`. Keep a source-quality list (prefer primary, government and standards sources; at most one citation per
  weak domain). Strip `utm_*`, `srsltid` and `gclid` from every link.
- **Accept:** harness: a figure missing from its source is flagged, and `srsltid` is stripped. Live: a page run.
- **Moves:** CON C3 (5).

#### G5 · Originality check
- **Where:** a new Code node after *Content QA* (e.g. `v5/code/Originality_Check.js`, wired in `build_v4.py`). It compares the draft with the
  competitor texts (*Analyze Competitor Pages*) and the site's own pages (D11 inventory).
- **Fix:** measure 8-word shingle overlap per source. QA fails above 15% against any one page, and the top overlaps are listed.
- **Accept:** harness: a draft that copies a competitor paragraph fails.
- **Moves:** CON C5 (1).

#### G6 · Rank tracker depth
- **Where:** `build_ladder_extras.py` (Rank Tracker), `v5/code/Tracker_Plan.js`, `Parse_Positions.js`, `Tracker_Report.js`. The history table
  already has a `serp_features` column.
- **Fix:** from the same SERP call, record AI Overview (shown, cites us), snippet, People Also Ask, local pack and video flags, and the top-10
  domains (competitor positions, share of voice). Store a compact SERP snapshot as proof. Add a mobile check for main keywords.
- **Accept:** harness: a SERP fixture with an AI Overview and People Also Ask stores the flags and lists competitors. Live: Rank Tracker.
- **Moves:** RANK 2.2, 2.3, 2.5, 2.6, 2.13.

#### G7 · Core Web Vitals from CrUX
- **Where:** the audit path near *Build Probes* / PageSpeed in the main workflow, plus a new `v5/code/CrUX_Requests.js`. The PageSpeed key
  (`SEOcredPageSpeed`) can serve if the CrUX API is enabled in its Google project.
- **Fix:** get p75 LCP / INP / CLS for each template (homepage, a service page, a blog post) on phone and desktop, falling back to origin data.
  Give it a low weight in the score.
- **Accept:** a harness fixture; live, a technical audit shows CrUX values per template.
- **Moves:** TECH 1.5 (3).

#### G8 · Discovery inputs
- **Where:** `v5/code/Discovery_Requests.js`, `Seed_List.js`, `Rank_Keywords.js`, `Build_Keyword_Strategy.js`; Search Console rows in
  `seo_query_history`.
- **Fix:** seed discovery with Search Console queries that have impressions but no matching page (D11 inventory) and with striking-distance
  queries. Cluster the top keywords by SERP overlap (≥ 3 shared top-10 URLs). Check the live SERP intent and page type for more than the
  current 8 priority keywords (K4). Calibrate traffic potential against Search Console where the site already ranks (K2).
- **Accept:** harness: a fixture with GSC rows adds seeds, and overlap clusters form. Live: discover.
- **Moves:** KW K2, K4, K6, K7.
- **Depends:** D11.

#### G9 · Search Console depth
- **Where:** `v5/code/GSC_Requests.js` (row limit), `Parse_GSC.js`, `Site_Metrics.js`, `Site_Report.js`; brand names from
  `seo_monitors.brand_names`.
- **Fix:** page through all rows (25k per request, within the daily cap), show the anonymised share (totals minus the sum of rows), split
  brand from non-brand, and filter operator queries (shared with D24).
- **Accept:** harness: paging, the brand split and the anonymised share. Live: Site Tracker.
- **Moves:** SITE 2.7 (6); REP 3.1.

#### G10 · AI answers checked against a fact base
- **Where:** prompt `v5/prompts/answer_analyst.txt`, `v5/code/AI_Brief_Input.js`, `AI_Metrics.js`. The data comes from `seo_profiles` and the
  app's business facts (site model).
- **Fix:** pass the Answer Analyst a fact sheet per site (profile, facts, services, accreditation status). Without a fact sheet, report "not
  checked" instead of "no wrong claims".
- **Accept:** harness: an answer that contradicts the fact sheet is flagged; with no sheet, the result is "not checked". Live: `ai_visibility`.
- **Moves:** AIV 4A.5 (5).
- **Depends:** O1, O2, O3, G19.

#### G11 · Watch and verify
- **Where:** a new daily branch in the Site Tracker (`build_site_tracker.py`) or its own workflow; `v5/code/Audit_Sched_Plan.js`; the app's
  technical page.
- **Fix:** each day, fetch the key pages raw (status, noindex, canonical, title, robots.txt hash), compare with `seo_cache` and alert on a
  change within the day. "I fixed this" in the app re-checks that finding within days.
- **Accept:** harness: a noindex change raises an alert. Live: one week of daily checks.
- **Moves:** TECH 1.7 (3), 1.10 (3).

#### G12 · Annotations and change tests
- **Where:** the app's charts (`app/web/src/pages/site/SearchPage.tsx`, `OverviewPage.tsx`, `LadderPage.tsx`) and server data
  (`app/server/src/services/data.ts`). Sources: `seo_content_log.published_at`, audit fixes, Google update dates, the num=100 break (Sep 2025).
- **Fix:** mark these events on the charts automatically. Extend the Link Builder's control-group impact (`seo_link_impact`) to page changes,
  with graded wording.
- **Accept:** app unit tests for the annotations and the impact read; Playwright screenshots.
- **Moves:** REP 3.4 (3), 3.5 (0); SITE 2.12.

#### G13 · CMS push
- **Where:** `SEOagentWordPres` (`build_ladder_extras.py`), CONFIG `wordpress_publish`, the app's pipeline approval.
- **Fix:** after Manual approval in the app, push a draft (never a published post) and store its URL; publish detection closes the loop.
  techand.ai runs on Next.js / Vercel (audit headers), so WordPress does not help this site. Consider a Markdown pull request or a
  headless-CMS target as well.
- **Accept:** a WordPress test instance receives the draft after approval. Not on a customer site during tests.
- **Moves:** CAD C16 (5); REP 3.12.

#### G14 · Response-vs-render diff
- **Where:** the audit crawl (DataForSEO on-page with JavaScript on ≤ 500 pages) plus a raw fetch. `v5/code/Render_Requests.js` (Jina render)
  can be reused.
- **Fix:** for key pages, compare raw and rendered title, H1, canonical, robots meta, link count and text length, and flag content that
  exists only after JavaScript (AI crawlers do not run it).
- **Accept:** harness: a JS-only H1 is flagged. Live: technical audit.
- **Moves:** TECH 1.4 (4).

#### G15 · Expiring share links
- **Where:** app server routes (`app/server/src/routes/runs.ts` for reports), a new share-token table (`app/server/src/db/schema.ts` +
  migration), a public read-only page in `app/web`.
- **Fix:** expiring, revocable read-only links for a report or dashboard.
- **Accept:** unit and API tests (expiry, revocation, no access to other data); a smoke check.
- **Moves:** REP 3.7 (2).

#### G16 · First approved live outreach send
- **Fix / accept:** after O4 and the owner's go-ahead, send one approved sequence from techand.ai's mailbox. Check that SPF / DKIM / DMARC
  pass and that the footer, threading, reply and out-of-office handling work, with bounces under 2%.
- **Moves:** LB 4C.5, 4C.6 (now not live-verified).
- **Depends:** O4, L1, L2, D13.

#### G17 · Calibration (later)
- **Fix:** once ≥ 20 published pages have ≥ 3 months of tracking, fit the plan-type month ranges and chances (`_reach.js`), back-test reach
  (K1), and set the QA pass threshold from outcomes (C9).
- **Moves:** KW K1, K10; CON C9.

#### G18 · Labelled accuracy set
- **Fix:** label every audit finding for techand.ai and two other sites (true / false / cosmetic), and the backlink spam labels. Store them
  as harness fixtures (`harness/fixtures_live/`, new scenario), report precision per finding type with a target of ≥ 95%, and use the set as a
  regression gate. The baseline spot-check was 5 of 7 true.
- **Moves:** TECH 1.14 (3); BL 4B.5.
- **Depends:** D6, D18.

#### G19 · One site model that every workflow reads
- **Wrong:** features share no canonical host, page inventory, written-page log or business facts, so their advice conflicts (SCORECARD §4,
  "Incoherence"; D5, D10, D11, D15, D22).
- **Where:**
  - `ladder_common.py`: new `SITES_COLS` columns or a `seo_site_model` table, then `sync_tables.py`.
  - A kit `v5/code/_site_model.js`, inlined by the builders like `_monitor_sites.js`.
  - A resolver in the Site Tracker (weekly) and in the main workflow (on demand, cached 7 days).
  - The app sends business facts and CTA (`app/server/src/n8n/client.ts`).
- **Fix:** the model holds `canonical_host`, business name, logo, NAP (profile → homepage Organization / LocalBusiness schema → GBP), services
  and nav pages (D22), the page inventory (D11), `business_facts` + `cta`, `brand_names`, competitors and accreditation status. Every workflow
  reads them through the kit.
- **Accept:** harness: unit checks of the kit, and each consuming scenario uses the model's host and name.
- **Moves:** every area's coherence; REP 3.3.

#### G20 · AI panel of 100+ prompts
- **Where:** `v5/code/AI_Plan.js`, `Prompt_Jobs.js`, `AI_Prompt_Rows_Admin.js` (maximum 50), the app's question settings, cost in
  `app/shared/src/estimate.ts`.
- **Fix:** allow 100–150 questions, and rotate the daily pulse through subsets to keep the cost bounded. Show the cost.
- **Accept:** harness S27 with 120 questions, and an estimate test.
- **Moves:** AIV 4A.1 (5).
- **Depends:** O8.

#### G21 · Delivery rate measured
- **Where:** `app/server/src/services/engineFailures.ts`, the `runs` table, platform admin.
- **Fix:** each week, show runs delivered ÷ runs started (scheduled and on demand) and missed schedules (D25a). The target is ≥ 99%.
- **Accept:** an app unit test, and the admin page shows the rate.
- **Moves:** OPS 3.8.
- **Depends:** D25a.

#### G22 · AI Growth titles cut at a hyphen
- **Where:** cited-page titles flow through `v5/code/Parse_AI_Answers.js` (`cites` → `cited_urls.t`), `Growth_Plan.js` ~l.123 and
  `Earned_Media.js`. Find the cut with exec 376's data.
- **Fix:** keep the full title, and fetch `<title>` when the title is shorter than 8 characters.
- **Accept:** harness: "E-invoicing in the UAE …" survives whole.
- **Moves:** AIG readiness row.

#### G23 · Claude spend reconciliation
- **Wrong:** the three Opus nodes stream and report no usage, so Claude's cost is known only as $1.6–3.0.
- **Where:** the run ledger (`build_v4.py` §8b, the cost-ledger code in the delivery nodes), Anthropic nodes with `streaming: true`, and the
  `EST` table in *Rate Limit*.
- **Fix:** estimate streaming calls from prompt and output characters plus the thinking budget, marked "estimated". Each month, reconcile
  against the Anthropic Console usage export (the owner downloads it) and correct the guard's estimates per model.
- **Accept:** the ledger shows estimated Claude cost on every run; one month's reconciliation is recorded.
- **Moves:** OPS 3.10.

#### G24 · Crawl coverage figure
- **Where:** *Analyze Probes* (it already has `sitemap_urls` and `crawled_urls`), *Build Site Issues*, the reports.
- **Fix:** show "crawled X of Y known URLs (sitemap ∪ Search Console pages)" and flag coverage under 90%.
- **Accept:** a harness check of the figure.
- **Moves:** TECH 1.1 (4).

#### G25 · URL Inspection coverage
- **Where:** `v5/code/Inspect_Requests.js` (Site Tracker, ≤ 20 per run), `GSC_Audit_Plan.js` (≤ 25); `seo_cache` for each URL's last inspection.
- **Fix:** rotate through every key and tracked page within the 2,000-a-day quota, oldest inspection first, and trend the index states.
- **Accept:** harness: rotation order. Live: Site Tracker.
- **Moves:** TECH 1.3; SITE 2.9.

#### G26 · Impact-weighted priority
- **Where:** *Build Site Issues* (labels), *Build Full Report* ordering, the app's `app/server/src/services/recommendations.ts`.
- **Fix:** priority = severity × the affected pages' clicks and impressions (Search Console) or key-page status. Index blockers come first,
  and cosmetic items are never at the top.
- **Accept:** harness ordering; `server/test/recommendations.test.ts`.
- **Moves:** TECH 1.6 (4); REP 3.3.

#### G27 · Pre-release check
- **Fix:** an API mode that runs the key-page checks (G11) on a staging host or URL list and returns pass / fail for CI. Low priority.
- **Moves:** TECH 1.8 (0).
- **Depends:** G11.

#### G28 · Statistical alert thresholds
- **Where:** `v5/code/Site_Metrics.js` (fixed 30% / 5 places); `v5/code/_ai_stats.js` (the z-tests the AI Pulse uses).
- **Fix:** test clicks and impressions against a baseline (Poisson / z), with minimum volumes, and add Google update dates as context.
- **Accept:** harness: a small change at low volume raises no alert; a significant drop does.
- **Moves:** SITE 2.11 (5).

#### G29 · Lineage on every number
- **Where:** `v5/code/_report_kit.js` and the report builders (`Site_Report.js`, `BL_Report.js`, *Build Full Report*, `AI_Report.js`).
- **Fix:** every number shows its source, date range and sample size in a footnote or tooltip.
- **Moves:** REP 3.11 (5).

#### G30 · Images produced
- **Where:** `v5/code/Blog_Package.js` and the image plan in the brief.
- **Fix:** produce the hero and in-body images (generated, or stock with a licence), using the alt text and file names already planned, and
  check them on the live page.
- **Moves:** CON C13 (5).

#### G31 · Stored style guide
- **Where:** a new `seo_profiles` column, or app site settings; `Content_QA.js`; the prompts.
- **Fix:** store a style guide (brand form "Tech&", spelling variant, words to avoid, tone), apply it in the prompts and check it in QA.
- **Moves:** CAD C17 (5).

#### G32 · Topic radius and re-plan
- **Where:** `v5/code/Ladder_Plan.js` / `Cadence_Plan.js` (topic warning), `Tracker_Report.js` (`stuck`).
- **Fix:** block a ladder or cadence pick outside the topic radius unless forced. A stuck ladder (8 weeks without gain) gets an automatic
  re-plan proposal.
- **Moves:** LAD K12 (6), K13 (4).

#### G33 · Coverage target against the best competitor
- **Where:** `v5/code/Parse_Analysis.js`, the coverage points in `Content_QA.js`.
- **Fix:** set the coverage target to the best competitor's term coverage, not the average, and report coverage against the best.
- **Moves:** CON C1 (6).

### 3.4 Link Builder open items (L)

#### L1 · MX check before sending
- **Where:** `app/server/src/services/mail.ts` (add `mxCheck` with `resolveMx`; `dnsCheck` already uses `resolveTxt`),
  `app/server/src/services/outreachJobs.ts` (`senderTick`, `sendManual`), contacts from n8n (`v5/code/Contact_Requests.js`).
- **Fix:** before the first e-mail to an address, check its domain's MX (A record as fallback). With none, mark the contact invalid, skip it
  and show it in the inbox. Cache results per domain.
- **Accept:** a unit test with a mocked resolver; `app/scripts/outreach_e2e.py` (GreenMail) checks that an invalid domain is never sent.
- **Moves:** LB 4C.5 (bounces < 2%).

#### L2 · Quality gate for drafted outreach e-mails
- **Where:** the Link Builder after *Outreach Sequence Writer* (`build_monitors.py` Link Builder section ~l.438–470; a new `LB_Draft_QA.js`
  using `_outreach_kit.js`); AI Growth drafts (D12); Reply Reader suggestions (D14). In the app: the approval queue
  (`app/shared/src/outreach.ts`, `LinkBuildingPage.tsx`); automatic mode refuses failing drafts.
- **Fix:** deterministic checks:
  - first e-mail ≤ 120 words, follow-ups ≤ 60;
  - one link, on the canonical host;
  - no banned phrases (SEO jargon, "cited in AI answers", hype);
  - the brand written as in the site model;
  - something quoted from their page;
  - every claim (accredited, partner, certified, numbers, clients) found in the facts or set as `[Owner: confirm …]`.

  A failing draft becomes "needs edit", with the reasons.
- **Accept:** harness S30 with the exec-372 / 376 drafts: "techand" and an unbracketed accreditation fail, and the good drafts pass. App unit
  test: auto-approve skips failing drafts.
- **Moves:** LB 4C.4 (6); AIG drafts row.
- **Depends:** D13, D14, G19.

#### L3 · Link Builder PDF report
- **Where:** `build_monitors.py`: after `L.code('LB Report', …)` (l.465) add `pdf_chain('LB', …)`, as AI (l.164) and backlinks (l.296) do. The
  callback attaches the file, and the app's renderer shows it.
- **Accept:** harness: the report HTML goes to the PDF step. Live: the Link Builder report carries a PDF.
- **Moves:** REP 3.6.

#### L4 · Gmail / Microsoft 365 OAuth mailboxes
- **Where:** `app/server/src/services/mail.ts`, the `mailboxes` table (`app/server/src/db/schema.ts` + migration),
  `app/server/src/routes/orgs.ts`, the web Mailboxes tab.
- **Fix:** Microsoft 365 through Graph OAuth (send and read) and Gmail OAuth (sending; reading replies needs Google's restricted-scope
  verification), with token refresh and revoke.
- **Moves:** LB 4C.6 (5).

#### L5 · Podcast and journalist-digest sources
- **Where:** `v5/code/LB_Source_Requests.js`, `LB_Plan.js`; the app's inbox poller (`outreachJobs.ts` `pollTick`) for digest e-mails.
- **Fix:** find podcast guest opportunities through the Podcast Index API (free key), and read journalist digests (HARO, Source of Sources)
  from the connected mailbox into requests.
- **Moves:** LB 4C.1.
- **Depends:** O4 (digests).

#### L6 · Linkable-asset ideas
- **Where:** `v5/code/LB_Plan.js` / `LB_Report.js`; DataForSEO backlinks `domain_pages` for competitors.
- **Fix:** from competitors' most-linked pages, propose asset types (data, tool, guide) for the site.
- **Moves:** LB 4C.1; BL 4B.6.

#### L7 · Subject-line A/B
- **Where:** app `outreach_messages` stats, `LinkBuildingPage.tsx`.
- **Fix:** two subject variants per batch, with the reply rate per variant and its counts. Draw no conclusion under about 30 sends each.
- **Moves:** LB 4C.5.

### 3.5 Owner decisions (O)

| ID | Decision / action | Why | Unblocks |
|---|---|---|---|
| O1 | Fill the business profile in the app (author name, title, credentials, bio, reviewer; street address, phone) and add at least one case study | Every page and draft carries [Author] / [Your name]; schema has placeholders; "no verifiable proof" in the full report | D10 live check, G10, CON C2 / C4 live test, Link Builder signer |
| O2 | Fill techand.ai's business facts and CTA in the app's site settings (empty today) | Pages cannot use real prices / timelines; the Reply Reader has no facts | D10, D14, L2, G10 |
| O3 | Decide the e-invoicing position: apply for MoF accreditation, or name the accredited partner Tech& works with (and its page) | Tech& is not an accredited ASP; AI answers, AI Growth, the Link Builder and replies depend on it | D13 (accredited lists), D12, D14, G10 |
| O4 | Connect techand.ai's mailbox (company settings → Mailboxes) with its postal address | No live sending yet | G16, L1 live, L4, L5 (digests) |
| O5 | Answer October's Search Console check-in (Pages export, manual actions, security issues) after D25c removes the test row | The reminder is silenced by test data | SITE, OPS |
| O6 | Upload the IndexNow key file to techand.ai's root | IndexNow submissions cannot start | AIG 4A.10 |
| O7 | Upload Search Console's "Latest links" export in the app (Backlinks → import) | No coverage figure against Google's sample | BL 4B.1 |
| O8 | Set the AI question panel size: techand.ai has 8 (the pulse asks 7); 20 adds about $5 a month | 7 questions is a thin panel | AIV 4A.1, G20 |
| O9 | Decide the 4 written, unpublished pages. Do **not** publish "uae e invoicing penalties": refresh the live /insights article instead. Publish "erp software uae" only after D10 (placeholders resolved), then report it with `published` | Pile-up, cannibalisation, unpublishable page | CON C10 / C16 live checks, LAD K13 |
| O10 | Fix the true audit findings on techand.ai: lorem ipsum on /industries, orphan /whatwedo/* pages, no Service schema on service pages, missing meta description and doubled brand on /power-platform-analytics-uae, HTML not cacheable | Real site problems | TECH 1.10 (fix verification), outcomes |
| O11 | Decide what stays from the test: Link Builder on for techand.ai, Reply Reader published and active (paid per reply), ladder `lad_mv40b6s9h5a8` "erp software uae"; `SEOagentTmpTest1` (inactive, older than this test) can be deleted | State left behind (RESULTS §5) | — |
| O12 | Approve the paid live checks after each phase (§5.1, about $1–2.5 each) and the whole-system re-rating (≈ $4.3, hard cap $15) | Paid runs need explicit approval | §5 |

### 3.7 Defects found by the Phase 1 live check (P1, 2026-10-12)

Evidence and texts: `LIVE_CHECK_phase1_2026-10-12.md`. All small (S); fix them first in the next session, before Phase 2.

| ID | Title | Area | Where | Fix | Status |
|---|---|---|---|---|---|
| P1-1 | `describe` / `backlinks` ledger rows never settle (stay `reserved`) | OPS | `build_v4.py` §26: *Settle Run Ledger* is wired after 5 report builders only | wire the settle node after every terminal node (describe, backlinks, ai_visibility, profile, case study, published, checkin …) or settle from the API front door's callback | fixed 2026-10-12 (harness S36 + a build-time wiring assert): every mode settles, refused rows stay refused |
| P1-2 | Link-farm pages still fill "Links lost" ("Ask the editor to restore it") and the "referring sites fell 17→4" alert | BL | `v5/code/Parse_Backlinks.js` `lost` / `reclaim` / the drop alert | apply `LK.footprints` before the lost / reclaim lists and the referring-sites drop; farm rows never count as lost | verified live 2026-10-12 (exec 451, the scheduled watch): 0 lost and no drop alert from the 16 farm links |
| P1-3 | Scraper regex misses `-site:` and lowercase `and` / `or`: 4 of 10 top queries are scraper queries | TECH, REP | `v5/code/GSC_Audit_Findings.js` l.66-67 | match operators case-insensitively, with a leading `-`, and quoted phrases; count them as scraper queries | fixed 2026-10-12 (harness S36): leading -, any-case booleans, quoted groups |
| P1-4 | Full report §4a "opportunities by intent" still lists fta login, emaratax, fta portal and other brands (character ai, google ai) | KW, REP | *Analyze Keywords* `opportunities_by_intent` (the gate is applied to the gap / easy wins only) | run the fit gate on `opportunities_by_intent` too | fixed 2026-10-12 (harness S36): fit gate on opportunities_by_intent and striking distance |
| P1-5 | Raw float CPCs in §4a of the Word file | REP | *Build Full Report* §4a | round CPCs to 2 decimals (the keyword report already does) | fixed 2026-10-12 (harness S36): CPCs rounded in §4a (the keyword report Word file still prints raw CPCs — open) |

### 3.8 Defects found by the Phase 2 live check (P2, 2026-10-12)

Evidence and texts: `LIVE_CHECK_phase2_2026-10-12.md` §3 (execution ids, artefacts in `files/phase2-live-2026-10-12/`).

| ID | Title | Area | Where | Fix | Status |
|---|---|---|---|---|---|
| P2-1 | D22's extra pages are never read: the nav list comes from the wrong node | KW, CON | `v5/code/Nav_Pages_Plan.js` reads *Clean Site Text*'s markdown links (1 entry on techand.ai) while the site model holds the real 12-entry menu from the raw HTML | take `nav_pages` from `$('Site Model').first().json.site_model.nav_pages` | fixed 2026-10-12 (harness S46) — the menu comes from the site model (12 entries), markdown links only as a fallback; 5 service pages read |
| P2-2 | The site model's `services_json` is always empty | all | the model is saved before *Site Describer* / *Parse Description* run, and nothing writes `products_or_services` back | re-save the model after the description (or feed `extras.services` into a second `SM.from`); same on the Site Tracker side | fixed 2026-10-12 (harness S46) — *Model Services Row* re-saves the model after the description; the Site Tracker loads descriptions, so `services_json` and the brief facts fill |
| P2-3 | Bare-host URLs still reach the owner (D15 residual) | CON, SITE | `v5/code/Blog_Package.js` l.157 / l.167 (on `url_lint.py`'s allow-list), `Site_Metrics.js` `computed_actions` / `ladder_pages`, and 17 stored `seo_ladders.target_url` rows | use `SM.siteUrl`, drop Blog Package from the allow-list, rewrite the stored ladder targets once | fixed 2026-10-12 (harness S46) — Blog Package emits through `SM.siteUrl` and is off the lint allow-list; `Site_Metrics.js` promises canonical URLs; **migration run 2026-10-12: 17 stored ladder rows rewritten to www.techand.ai, 0 left** |
| P2-4 | "(undefined days)" in the weekly site report | SITE, REP | `v5/code/Site_Plan.js` l.50 — an inline `//` comment swallows the `.map(…)` | move the comment to the end of the statement | fixed 2026-10-12 (harness S46) — the comment no longer swallows the `.map`; real day counts in the brief and report |
| P2-5 | `verdict` mode is blind to the page inventory | KW | `v5/code/Client_Page_Requests.js` / *Collect Client Pages* and `v5/prompts/verdict.txt` | set `existing_page` from `SM.matchPage`; a matched page means "improve this URL", never a new page | fixed 2026-10-12 (harness S46) — the verdict path sets `existing_page` from `SM.matchPage`; prompt and *Parse Verdict* force "improve that URL" |
| P2-6 | The placeholder gate does not see the author box (11 brackets, QA reported 0) | CON | `v5/code/Content_QA.js` does not count the author / reviewer box `Blog_Package.js` attaches | count them, or report `profile_placeholders` that the gate and the app show | fixed 2026-10-12 (harness S46) — QA counts the author box (`profile_placeholders`), so a page with 11 brackets fails the gate and the report shows them |
| P2-7 | A "Write now" / cadence page run has no verdict word-count target | CON, CAD | *Parse Analysis* does not run in a `force_content` run and `seo_ladders` has no word-count column | store the verdict's `recommended_word_count` on the ladder row (`ladder_common.py`), pass it from the app, clamp to it in *Parse Brief* | fixed 2026-10-12 (harness S46, app test) — `target_words` on the ladder row flows through the app / cadence / spawn into *Parse Brief*, which clamps to it (3,100 → 2,310) |

**Follow-up from G28 (2026-10-12):** on a small site (under ≈ 40 combined clicks) even a 50% drop is now only an info "Watch:" line and is not written to `seo_site_metrics.alerts`. **Fixed 2026-10-13 (harness S43):** a big but non-significant drop is now a **medium** "Watch" alert naming the counts ("Small numbers: 32 search clicks…"), never high.

**Also seen:** `settled_usd` in `seo_run_ledger` is the estimate, not a measured cost (G23 covers it); a pre-fix ladder row's free-text `page_type` still travels unchanged into the brief and the content log; Search Console reports techand.ai on the non-www host, so bare hosts inside `search_console.*` are Google's data, not ours.

### 3.9 Defects found by the accuracy set (G18, 2026-10-12)

| ID | Title | Area | Where | Fix | Status |
|---|---|---|---|---|---|
| G18-1 | A search-results page is ranked the best link (SEO value 57 vs 35 for the genuine OpenPeppol link) | BL | `v5/code/Parse_Backlinks.js` beside the footprint gate: nothing marks a SERP page of an unknown host as `scraper`, so `LK.values`' cap of 5 never applies | mark a search / query page (`?q=`, `/search`, `?s=`) of a host with no topic match as `scraper` and cap it, as the known scrapers already are; evidence in `ACCURACY_SET.md` §6 | fixed 2026-10-13 (harness S49) — `LK.isSearchPage`: an off-topic, unlabelled search page becomes `scraper` and is capped (robuta.com 57 → 5), OpenPeppol is the top best link; **best-link precision 50% → 100%** |
| G18-2 | Useful precision 75%: 10 of 40 true findings are not worth reporting (cosmetic) | TECH, REP | the audit's finding list; G26 ranks by impact but still shows everything | hide or fold cosmetic findings below a threshold into one "minor items" line, so the list a customer reads is all actionable | fixed 2026-10-13 (harness S48 / S49, app tests) — `IMP.isMinor` / `fold`: Low / Info findings that are never blockers fold into one expandable "Minor items (N)" line in both reports and the app, with the count in the action plan and callback; **useful precision 75% → 95.5%** (azdan.com 14% → 100%); nothing is deleted from the stored rows |

### 3.10 Defects found by the Phase 3 + 4 live check (P34, 2026-10-12)

Evidence and texts: `LIVE_CHECK_phase34_2026-10-12.md` (29 executions, ≈ $2.49; artefacts in `files/phase34-live-2026-10-12/`).

| ID | Title | Area | Where | Fix | Status |
|---|---|---|---|---|---|
| P34-1 | AI Growth reports stale drafts as new ("8 outreach drafts written"), one of them a tax.gov.ae pitch signed "techand.ai" | AIG, LB | `v5/code/Growth_Metrics.js` l.50 reads the stored prospect row; the same carrying in `Parse_Backlinks.js`; the app shows them as `drafted` | count only drafts written by this run; drafts made before the D12 / D13 gates are marked superseded and are not offered | fixed 2026-10-13 (harness S51, app test) — new `_drafts.js` + `drafted_at`: a draft without a stamp or written before 2026-10-12 is cleared with its reason, AI Growth counts only its own writer (`drafts_written` / `handed_over`), the app hides them; sent drafts untouched |
| P34-2 | "Tech&" matches as "tech", so SaaSHub, AlternativeTo (403 wall) and the **MoF accredited-provider list** are reported "listed" when they are not | LB | `v5/code/LB_Assemble.js` l.162, `v5/code/_listings.js` | match a whole brand token (and require a link to our host), never a prefix; a 403 stays "unknown" | fixed 2026-10-13 (harness S51) — `OK.namesUs` needs our domain or a 5+ character token (a short name only with its punctuation) plus `listingClaim`; a 403 / 4xx / 5xx stays "unknown" with the URL to open |
| P34-3 | With an empty profile the AI report still says "no claim was wrong": `min_facts: 2` is met by country + services alone | AIV | `v5/code/Analyst_Jobs.js` (`min_facts`) | require real business facts (profile or `business_facts`), not derived ones; otherwise "not checked" (G10's intent) | fixed 2026-10-13 (harness S51) — the analyst needs two owner facts including a locating one; otherwise "not checked" |
| P34-4 | The full report's backlink gap recommends reaching out to mof.gov.ae, backlinkcheckers.space and buyhighda.space | TECH, BL | *Analyze Backlinks* in `build_v4.py` — no spam / topic / government gate | apply `LK.footprints` and the Link Builder's gates to that list too | fixed 2026-10-13 (harness S51) — *Analyze Backlinks* runs `OK.noPitch` / `gapTopic` / `LK.footprints`, and Parse Backlinks stops making government hosts gap prospects |
| P34-5 | Two concurrent 200-page audits were killed at the 90-minute timeout (the n8n JS task runner went unresponsive); no watchdog, and their ledger rows stay `reserved` against the daily budget | OPS | the audit path; `seo_run_ledger` settle logic (build §26) | release a reservation that has no settle after N hours (and clear the 11 rows, $0.77, now stuck); refuse or queue a second heavy audit for the same site while one runs | fixed 2026-10-13 (harness S51) — *Release Stale Runs* with `run_stale_hours: 2`, `heavy` / `domain` on the ledger, a second heavy audit for the same site refused; **the 11 stuck rows ($0.77) were released 2026-10-13** |
| P34-6 | The AI Visibility Tracker and Backlink Monitor call the business "techand.ai": they read the name from `seo_profiles` only | AIV, BL | `v5/code/_monitor_sites.js` | read the name through the site model (`SM.name`), as D13 now does | fixed 2026-10-13 (harness S51) — `_monitor_sites.js` reads the name through `SM.name`, so the monitors say "Tech&" |

**Owner actions from this check:** enable the Chrome UX Report API for the PageSpeed key's project (then one audit shows real speed data; today both reports honestly print "not available" with the enabling step); fill techand.ai's business profile (it unblocks the 6 held outreach drafts and the AI fact check); upload the IndexNow key file. **Rotate `SEO_API_KEY`:** it appeared once in an execution's webhook headers inside a subagent's local tool output (no file carries it).

### 3.11 Defects found by the re-rating run (R, 2026-10-13)

Evidence: `../system-review-2026-10-13/RESULTS.md` §3.2. The first pass (35 executions, $0.58 DataForSEO + $0.33 Claude) covered only
16 of the protocol's 21 runs: **the engine's own daily AI budget guard refused `discover` and the ladder's page run** ($5.74 of $6) —
R1 is that refusal's own damage. The five refused runs were then re-run on 2026-10-13 (**execs 517-529, $2.88**: discovery + its
report, the ladder rung page, the full report, AI visibility, a full backlink check), which exercised the 16 items left open and
found **R10-R16**.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| R1 | A budget-refused run leaves the ladder row "writing", so the ladder plan, Rank Tracker and Cadence all report a page that does not exist | **High** | the refusal path in `build_v4.py` (*Mark Run Refused* / *Refused Input*) | for a `ladder:`-keyed run set the ladder row back to `planned` with the reason; promise the page only after the spawn is accepted; cadence / tracker / site tracker count a row as written only when `seo_content_log` says `written` | fixed 2026-10-13 (harness S57) — *Refused Ladder Row* -> *Release Ladder Row* resets the row to `planned` with the reason (`seo_ladders.status_note`); the plan says "started now"; cadence / Rank Tracker / Site Tracker (+ app `cadence.ts`) count a page written only on a `written` content-log row. Repair script `fix_phantom_pages.py` |
| R2 | A finding in a category the audit calls "not assessed" is reported "new" at every audit | Medium | *Audit Diff* in `build_v4.py` | filter current and previous findings through the same category set, and decide whether Schema belongs in a technical audit's weights | fixed 2026-10-13 (harness S57) — `Audit_Diff` filters both sides through the audit type's categories and reports `not_compared`; Schema stays out of a technical audit's weights |
| R3 | The Keyword Check's topic fit failed twice and shipped `fit: null` (on D22's own acceptance keyword), still charging $0.024 | Medium | *Claude — Keyword Fit* / *Parser — Keyword Fit* | raise `maxTokensToSample`, simplify the output schema or fall back to a plain-text parse; an unknown fit must show in the label, not only in `warnings` | fixed 2026-10-13 (harness S57) — 1,200 tokens, a three-scalar schema, a parser-free *Keyword Fit (Text)* retry, the unknown fit in the label, and the AI cost always charged |
| R4 | The Link Builder's competitor gate only reads the prospect's page, so a competitor ranked #1 for our head keyword passed as a prospect | Medium | `v5/code/_outreach_kit.js` / *LB Assemble* | refuse on the registrable domain matching the competitor list or the SERP competitors just measured, not only on page-text overlap | fixed 2026-10-13 (harness S57) — `_outreach_kit.rivalOf` refuses a declared or SERP rival by registrable domain (`LB_Plan` reads 90 days of `competitors_json`); a "best X" list still passes |
| R5 | The Error Handler cannot read a trigger-mode failure: node, message and execution are all lost | Medium | *Format Alert* in the error handler | fall back to `trigger.error` (message, description, cause) and `workflow.name` when `execution` is absent | fixed 2026-10-13 (harness S57) — *Format Alert* falls back to `trigger.error` (message / description / cause) and the workflow name |
| R6 | No ops alert has ever been delivered, and `seo_ops_alerts.delivered` is never written back | Medium | after *Email Ops* / *Send Webhook* | update the row with the result and the channel that carried it (G21 cannot be measured until then) | fixed 2026-10-13 (harness S57) — *Alert Delivery* -> *Save Alert Delivery* writes `delivered`, `channels` and notes back on the row |
| R9 | The budget guard sees only the main workflow and the Keyword Check, and counts AI spend only: the monitors spend DataForSEO money unguarded and both audits carried `est_usd: 0` | Medium | the shared ledger kit + the monitor workflows | reserve and settle a ledger row in the monitors too, and carry a DataForSEO estimate (and the measured amount on settle) beside the AI estimate | fixed 2026-10-13 (harness S57) — 9 scheduled workflows reserve and settle a ledger row, and every row carries `dfs_est_usd` / `dfs_usd` beside the AI estimate |
| R7 | The verdict and ladder still tell the owner to add FAQPage schema, which G2 removed from the pages we write | Low | `v5/prompts/verdict.txt` and the ladder feasibility prompt | ask for an FAQ *section*, not FAQPage schema | fixed 2026-10-13 (harness S57) — `verdict.txt` asks for an FAQ section, with a deterministic rewrite of any FAQPage wording |
| R8 | Rung pages carry no word-count target (`target_words: 0`), so P2-7's clamp protects only the top page | Low | the ladder plan's rung rows | set a target per rung page from its own SERP word counts | fixed 2026-10-13 (harness S57) — a rung row's `target_words` is the median length of the pages that rank for its ladder topic |

| R10 | The audit turns Google's "no data" into a High finding: 45 of 47 pages reported "not mobile-friendly" with empty evidence, ranked #2 by impact, "new" in every diff, on a basis of 22,860 impressions the site never had (5,295 measured) | **High** | the G25 URL Inspection parser (*GSC Audit Findings* in `build_v4.py`, `v5/code/_page_watch.js`) | `VERDICT_UNSPECIFIED` or a missing `mobileUsabilityResult` reads "not checked" and raises nothing (Google retired the field); cap a finding's clicks / impressions basis at the property's measured totals | fixed 2026-10-13 (harness S59) — `VERDICT_UNSPECIFIED`, a missing result and a FAIL naming no issue all read "not checked" with the reason; no non-Info finding ships with empty evidence; `_impact.js` caps every finding's clicks / impressions basis at the property's measured 28-day totals and says when it capped |
| R11 | The written page is delivered with 12 placeholders (11 × `[Price]`, 1 × `[Number]`) although Content QA failed it in both rounds; the owner is shown round 1's "6 items to review" and never told the gate failed | **High** | the QA loop and the delivery branch (*Content QA* / *Needs Revision?* / *Build Word File* in `build_v4.py`, `v5/code/Content_QA.js`) | a run that exhausts `qa_max_rounds` with `passed: false` reports the **last** round's counts, says the page did not pass and is not published-ready; the `[Price]` / `[Number]` mask leaves figures the draft itself declares illustrative | fixed 2026-10-13 (harness S59) — a run that exhausts `qa_max_rounds` still failing is "did not pass the quality check — not ready to publish" with the **last** round's counts in the Word file, `meta.json` (`publishable: false`), a `-DRAFT` file name, the e-mail, the callback and the app; the price mask spares figures in a passage the draft declares illustrative |
| R12 | Discovery prints "no page of yours answers this search" on 11 of 25 rows whose last column names the live page earning the impressions (one of them ranking #6.2) | Medium | `v5/code/_kw_inputs.js` (`gscSeeds`) | when the Search Console row names a URL on the site, use it as `answered_by` with its own label ("the page that gets the impressions does not target this search"); never print "no page answers this" for a query the site ranks for | fixed 2026-10-13 (harness S59) — a `seo_query_history` row naming a live page is answered by that page (`page_mismatch`, "the page that gets the impressions does not target this search") |
| R13 | §4a intent lists and the keyword gap still recommend other companies' brands and off-topic searches ("google ai", "meta ai", "mh enterprises uae", "mofa attestation dubai"): only the navigational class is gated | Medium | *Analyze Keywords* in `build_v4.py` | run `_fit_gate.js` over every intent bucket and the gap list: refuse another company's brand whoever owns the SERP, and refuse a keyword beyond the same 25% topic-distance bar the outreach gate uses | fixed 2026-10-13 (harness S59) — `fitTopic` (25% bar, "ai" refused as too broad) runs over every intent bucket, the easy wins, the gap and the page-2 list, with every refusal printed with its reason |
| R14 | The AI market table credits the owner with 19,579 citing answers from a 4-character name match, beside its own "0 AI answers cite you" | Medium | the market-index builder (`v5/code/_ai_stats.js` / `AI_Metrics.js`) | the owner's own row comes from a domain match; a name-only row is dropped or labelled "not matched to your website" when the name is below the brand-token bar or its mentions are orders of magnitude above the measured sample | fixed 2026-10-13 (harness S59) — `you` comes from the domain row only; a name-only row is dropped with its reason or labelled "not matched to your website" |
| R15 | A write-now ladder page ignores the ladder row's planned URL (slug `…-uae` vs the stored `target_url`) and ships `links_to_add_when_published: []` although the app sent two planned ladder links | Medium | *Parse Brief* / *Blog Package* in `build_v4.py` | for a run with a `ladder_id` keep the ladder row's slug (or write the new slug back to `seo_ladders.target_url` in the same run), and put every `planned` ladder link into `links_to_add_when_published` | fixed 2026-10-13 (harness S59) — `ladder_target_url` travels through the API body, the cadence spawn, *Parse Brief* and the package, so the page keeps the planned slug; both planned ladder links reach `links_to_add_when_published` |
| R16 | A pre-fix ladder rung that is a competitor's brand ("facts erp") is still planned and still printed in the Rank Tracker's reports | Low | a one-off cleanup of the stored ladder rows + the fit gate on the read path | clean the stored rungs as `fix_ladder_hosts.py` did for hosts, and run the fit gate where the cadence and the Rank Tracker read rungs, so a stored brand rung is dropped rather than written | fixed 2026-10-13 (harness S62) — `fitStored` runs on the read path: a stored brand / portal rung is set aside with its reason (cadence note, status note, callback, the app's `set_aside` state, the row marked, no rank check bought), a written rung is kept and flagged, and nothing is claimed without evidence. `fix_brand_rungs.py` dry run: 23 ladder rows, 0 to set aside (facts.ae is not a declared competitor and its stored check predates the SERP columns) — `--brand facts.ae` flags that row |

**Also:** the guard's refusal text shown in the app is developer language ("Raise `ai_budget_usd` in Normalize Input"); `files/tech-audit-497.html` was captured as 0 bytes; the fix pack repeats the site's own LinkedIn `sameAs`.

**Also from the completion runs:** the per-mode estimates are far from the money (`ai_visibility` reserved $0.06, cost $0.79; backlinks $0.04 for $0.37; the full report $0.25 for $0.41; the page $1.23 for $0.46) — R9 from the other side; the full report's own `dataforseo_usd` is $0.058 above the measured balance delta; the page's two word counters disagree; three Opus streaming nodes still report only `tokenUsageEstimate` (G23).

### 3.12 Defects found by the second re-rating run (R17-R29, 2026-10-14)

Evidence: `../system-review-2026-10-14/RESULTS.md` (21 protocol runs + G27 and G11, 47 executions 535-581, all `success`,
**$3.63**: DataForSEO $2.3876 measured, Claude $1.2458 of which $0.3937 is `tokenUsageEstimate` only). The run proved R2, R3, R7,
R10, R11, R12, R14, R15, G5, G7, G8, G11, G12, G14, G23-G30, G32, G33, L2, L3, L5 and G27 live for the first time. R29 is not from
that run: I found it while checking what the credential refresh had left in the working tree.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| R17 | Every monitor workflow writes its ledger row **at the end** of the run and never settles it, so the guard never sees a monitor before it spends and the measured cost is thrown away; $1.394 of the run's $2.388 (58%) is attributed to no settled row | **High** | `build_monitors.py` / `build_site_tracker.py` / `build_ladder_extras.py`: the reserve chain hangs off a node whose other branch is the whole pipeline, so n8n's v1 order runs it last | put *Ensure / Row / Reserve Run Ledger* on the **main** path before the first paid call, and wire the settle strictly after the work | fixed 2026-10-14 (harness S65, build section 55) — `ladder_common.ledger_mainline` puts Ensure / Row / Reserve on the **main** path in all nine workflows (plan → Ensure → Row → Reserve → *After Run Ledger* → the rest), and the build proves it by walking `main` from every trigger, refusing to pass *Reserve Run Ledger*, and failing if a paid node is still reachable |
| R18 | DataForSEO task errors inside HTTP 200 are not retried outside the AI path: in exec 549 both `SERP Top 10` and `Facts SERP` returned 40101, were billed, ran once, and a ladder was planned, scored "winnable 68" and written on an unchecked SERP | **High** | the main workflow's SERP / Labs nodes; the only in-200 gate is `v5/code/AI_Retry_Requests.js` | generalise the retry gate to every DataForSEO node; where a retry still fails, mark the SERP evidence `unavailable` and refuse a feasibility score that depends on it | fixed 2026-10-14 (harness S66, build section 56) — the in-200 retry rule is a shared kit (`_dfs_retry.js`) firing on **any** task error (the old test was 50000-only, which is why 40101 passed twice), 5 s apart, re-sent once; when it still fails the evidence is `unavailable` and the verdict is `NOT_CHECKED` with no score, no expected visits and no time to rank |
| R19 | 31 of 45 URL Inspection calls failed with no retry, so the audit's indexing picture rests on 14 pages — and the diff reported it as improved (`affected 4` vs 15) without saying the sample shrank from 25 to 14 | **High** | `GSC Audit Requests` / `Parse Inspection` in `build_v4.py`; `Audit_Diff` | retry a failed inspection once; carry `checked` into the finding and the diff; when the sample changes beyond a threshold, say so instead of reporting a delta | fixed 2026-10-14 (harness S66) — failed inspections are re-sent; findings carry `checked` / `checked_of` (stored in `seo_audit_findings.checked`); past 20% drift the diff prints "not compared: the sample moved" instead of a delta |
| R29 | The **Slack webhook URL is baked into generated workflow JSON and harness code that are committed to a public repository** (`Alert Channels` CFG, `EH__Alert_*`, `Watch_Ops_*`, `SEO_Agent_Error_Handler.json`, `SEO_Agent_Page_Watch.json`). Nothing has been pushed yet; the build output simply cannot be committed as it stands | **High** (secret handling) | the ops-alert build wiring that bakes `SEO_ALERT_WEBHOOK_URL` the way `SEO_MAIL_FROM` is baked | bake a placeholder and substitute the real URL at import time in `apply_env.py` (or read it at runtime from a Data Table row), so the repository never carries the secret; `SEO_MAIL_FROM` and the other non-secret settings stay as they are | fixed 2026-10-14 (harness S65) — the build bakes a placeholder and never reads the setting; `apply_env.py` substitutes the real URL into a copy outside the repo at import time; a build-time scan over `workflows/` and `harness/code_v4/` fails on Slack / Discord / Teams / Zapier webhooks, `xoxb-`, `sk-ant-`, `AIza` and private keys |
| R20 | The Site Tracker's annotation feed chains audit health across report types: "80 → 68", "24 findings gone — 68 → 80" and "80 → 80" as three same-day events, because a full report sits between two technical audits | Medium | `v5/code/_annotations.js` / `Site_Plan.js` | filter `seo_audits` by report type before computing a delta, and label an audit-type change rather than reporting it as a score move | fixed 2026-10-14 (harness S68) — `_annotations.js` + `Site_Metrics.js` compute a delta only within one `report_type`; a change of audit kind is labelled, never scored |
| R21 | R4's competitor gate misses a rival on a **subdomain**: `ae.invoiceq.com` ranks above us for "peppol uae", yet exec 561 produced a `ready` pitch asking `invoiceq.com` for a link | Medium | `v5/code/_outreach_kit.js` `rivalOf`, `LB_Plan` | reduce every `competitors_json` host to its registrable domain before matching, and treat a prospect selling the same service as a rival whether or not it is on the declared list | fixed 2026-10-14 (harness S68, build section 58) — every `competitors_json` host is reduced to its registrable domain before matching (a row cut mid-JSON is read by regex rather than emptying the list), the seen host is quoted in the reason, and a prospect whose own page sells our service is refused on that evidence alone; SERP rivals reach all four gate calls and the draft gate. deloitte.com and alaan.com are correctly refused |
| R22 | A rung row still carries `target_words: 0`, so the spawn passes `ladder_words: 0` and the clamp protects only the top page; the page shipped 2,648 words against 1,800 (+47%) after two editor rounds | Medium | `v5/code/Ladder_Plan.js` rung rows; the length clamp in the QA / editor loop | never 0: fall back to the top page's target or the competitor average; make an over-length draft an explicit editor instruction, not only a QA reason | fixed 2026-10-14 (harness S67 + S68) — a rung target falls back SERP median → the main page → the competitor analysis → a stated default, never 0, and records which; an over-length draft now reaches the editor as an instruction ("CUT N words"), not only as a QA reason |
| R23 | A whole ladder was planned, scored and written **from one keyword** (`pool_size: 1`): the single rung is "azure api management monetization" (volume 10, trend -100%) under the head "azure cloud migration dubai" — a different topic, no UAE — scored "winnable 68" although both SERP calls had failed | Medium | the ladder path in `build_v4.py`; `Ladder_Pool.js` / `Ladder_Plan.js`; `_radius.js` is not applied to rungs | refuse to emit a plan, and to spawn a page, when the pool is below a minimum or the SERP could not be checked; run the topic-radius test on each rung against the head topic | fixed 2026-10-14 (harness S67, build section 57) — a plan is refused when the pool is under 3 keywords (under 5 with no volume and no difficulty for the head) or the SERP could not be checked: the label says which, `feasibility.score` is null, `write_now` is empty so nothing is spawned, and a `data_check` block records what was missing; every rung must share half the head's meaningful words (`RAD.headFit`) |
| R24 | The audit says three different things about schema in one report: a Medium finding ranked 8th by impact, `not_assessed: ["Structured data …"]`, and `not_compared: ["Schema"]` — and Schema is in neither `category_scores` nor `weights` | Low | `Build Site Issues` / `Audit_Row.js` / the audit's category set | pick one: assess, weight and compare Schema in a technical audit, or do not emit its findings there | fixed 2026-10-14 (harness S66) — a technical audit emits **no** Schema finding (the count goes to `not_assessed`, since it has only the crawler's yes/no flag); the full report keeps Schema weighted and compared |
| R25 | A masked figure is left in the delivered body and not named to the owner ("Microsoft's highest APIM SLA (`[Statistic]`)"); the failure reasons list only the 11 profile brackets | Low | `v5/code/Content_QA.js` | list body placeholders in `reasons` whenever any remain, not only above `placeholder_max` | fixed 2026-10-14 (harness S68) — body placeholders always reach `reasons` (and the Word report and callback), so a masked figure is named to the owner; the R11 gate is untouched |
| R26 | A Keyword Check with no search data still returns a confident label: volume / kd / intent / cpc all null, yet "Reachable for your site · Short ladder · 4-8 months", chance "fair (30-50%)" — the gap R3 closed for `fit` | Low | `v5/code/Assess_Result.js` | carry "no search data" into `label`, and widen or suppress the chance band when volume and difficulty are unknown | fixed 2026-10-14 (harness S67) — `Assess_Response.js` carries "· no search data" into the label and suppresses the chance band with its reason |
| R27 | The podcast source quotes a raw HTML fragment from an unrelated page as its evidence (`"b-0"> Efficient Hiring Process …`) for a show at 29% topic match | Low | `v5/code/_podcast.js` | strip attribute fragments and quote the show's own description; raise the topic bar for a show offered to the owner | fixed 2026-10-14 (harness S68) — the quote comes from the show's own description, cleaned of attribute fragments, behind a 40% topic bar |
| R28 | The engine's own "measured" DataForSEO figures do not reconcile with the balance: window C moved $0.0520 while exec 579 alone reports $0.09 (+73%); the Keyword Check settles `dfs_usd: 0` while telling the caller $0.026 | Low-Medium | `v5/code/_cost_cal.js`; the crawl path's cost summing; `Assess_Ledger_Row.js` | count a task's cost once (a crawl is billed at creation, not per poll), settle the Keyword Check with the figure it reports, and reconcile the day's total against `appendix/user_data` | fixed 2026-10-14 (harness S65) — `CC.dfsLedger` counts a task once by id (exec 579's shape summed to $0.452 for $0.092 of movement), the Audit Scheduler reserves nothing for crawls it only spawns, the Keyword Check settles the figure it reported, and the day is reconciled against `appendix/user_data` (`seo_run_ledger.dfs_balance`) |

| R30 | The build's **"no webhook configured" variant now carries the real webhook URL**, so the skip path that protects a customer with no webhook is untested — and any checkout that builds while `.env` holds the URL gets a node that will post to the customer's Slack. Found by harness S48 during the R23 merge, not by the live run | **High** (safety) | the same ops-alert baking as R29 (`EH__Alert_*`, `Watch_Ops_*`) | with R29's placeholder: treat an unsubstituted placeholder as unset and never POST to it, and make S48 test the behaviour instead of the environment | fixed 2026-10-14 (harness S65) — an un-substituted placeholder is treated as unset, so no build can emit a node that posts to a customer's Slack; builds with and without the setting are byte-identical, and S48 now tests the behaviour instead of the environment |

**Still present from earlier rounds:** R4 (partly — R21 is its subdomain gap), R8 (partly — R22), R16 (the stored "facts erp" rung,
waiting on `fix_brand_rungs.py --apply --brand facts.ae`).

### 3.13 Defects found by the R17–R30 live check (R31-R33, 2026-10-14 evening)

Evidence: `LIVE_CHECK_R17-R30_2026-10-14.md` (5 runs, executions 582-591, **$0.069**: DataForSEO $0.055950 measured against the
account, Claude $0.0131 from reported tokens). That check proved R17, R24, R26, R29 and R30 live, R19 for the sample basis and
R28 for the Keyword Check and for the day's reconciliation; R18 and R19's retry could not fire (no DataForSEO or Search Console
call failed) and were not provoked.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| R31 | A **`free_only` monitor run settles money it never spent**: the free backlink check (exec 586) reserves $0.05 Claude + $0.45 DataForSEO and settles **$0.05 Claude** although no model node ran at all, while telling the caller `cost_usd: 0` | Low | `v5/code/Monitor_Ledger_Settle.js` (`ai_usd = row.est_usd` unconditionally); `BL Plan` does not lower the reservation for `free_only` | settle $0 when no model node ran in the run, and reserve the free figure when `free_only` is on | fixed 2026-10-14 (harness S69, build section 59) — a `free_only` site reserves nothing, and a monitor settle carries its own Claude nodes so it settles $0 with the reason when none ran; $0 is never labelled an estimate |
| R32 | **The on-page crawl's quoted cost is settled as "measured"**: audit 588 reports `dfs_usd 0.09 measured` — the price quoted at task creation for the **200 pages requested** — while 47 were crawled and the account fell **$0.031950** (+181%). R28's dedupe works (`dataforseo_tasks 1`, `tasks_repeated 0`); the amount, and the 7 poll calls' own cost, do not | Low-Medium | `v5/code/_cost_cal.js` `CC.dfsLedger` and the crawl branch's cost summing | price the crawl from the pages actually crawled (or read the task's final cost on the summary call) and count the poll endpoints; until then label it ESTIMATED, not measured | fixed 2026-10-14 (harness S69) — the crawl is priced from the pages `Check Crawl` reported (quote x crawled/requested), labelled estimated with the quote, request and pages crawled in its basis; audit 588's shape settles $0.0212 instead of $0.0900 against $0.0320 of real movement |
| R33 | **A Claude call that does report its tokens is still settled from the reservation** on every branch that does not end in one of the five report builders: `describe` (exec 591) settled $0.06 where *Claude — Site Describer* reports 4,874 / 1,306 tokens = $0.0114 (5.3×), with `ai_measured: false` and "this branch priced no model call of its own" | Low-Medium | `v5/code/Run_Ledger_Settle.js`: the Claude figure is read only from `run_ledger.ai_cost` of `ENDS`, so `describe` / `track` / `profile` / `published` / `checkin` / `case_study` never price their own calls | price every Claude node of the run from the run data, not only the report builders' | fixed 2026-10-14 (harness S69) — *Run Ledger Settle* runs the call table over its own run, so `describe` settles the $0.0114 its node reports, not its $0.06 reservation. Also: every "Nothing To Do" end now feeds a settle (the build refuses a dead end), all ten scheduled runs take the free balance reading, and Page Watch keeps a $0 row |

**Two structural limits of R28's reconciliation as deployed** (not defects of their own, recorded so they are not re-discovered):
only main-workflow runs take a balance reading (the monitors and the Keyword Check write `dfs_balance: 0`), and the reading is
taken at **reserve** time, so a run can never reconcile its own spend — the audit's +181% only surfaced on the next run that took
a reading. **Page Watch** keeps no ledger row at all (it is not one of the nine workflows `ledger_mainline` wires); it spends
nothing, but it is invisible to the guard and to the reconciliation.

### 3.14 Benchmark programme findings (B items, 2026-10-15)

Evidence: `../system-review-2026-10-14/BENCHMARKS_2026-10-14.md`, written against the leaders' own documentation with every page opened.
A1-A4 were built in the same pass (build section 61, harness S71). What follows is what is left.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B-A8 | **The streaming nodes' token usage is thrown away, not absent.** Anthropic reports usage on `message_delta` (cumulative) and `@langchain/anthropic` carries it; n8n's tracing drops it — so three Opus nodes are priced from characters and **32% of the Claude figure is an estimate**. CLAUDE.md recorded the opposite as fact until today | **High** (it is the last large estimate) | the Anthropic nodes' token parsing; `v5/code/_cost_cal.js` | read the final `message_delta.usage` (a thin HTTP call, or a patched tokens parser) and settle measured tokens; keep the estimate only as the fallback | fixed 2026-10-15 (build section 62, S72); not deployed |
| B-A7 | **An undelivered alert is never retried or escalated** — one attempt per channel, no second try, no escalation. No ops alert has ever reached a human | **High** | the alert delivery path, `seo_ops_alerts` | a row still `pending` / `failed` after N minutes is re-attempted by the next run of any workflow, severity rises after K attempts, and the row records every attempt | fixed 2026-10-15 (build section 64, S74); not deployed |
| B-A6 | **No idempotency on the front door**: a repeated POST (an app timeout-and-retry, or a webhook delivered twice) starts a second run and spends again | Medium | the API front door; `seo_run_ledger` | dedupe on the `request_id` the API already carries: a repeat inside the window returns the first run's id instead of spending | fixed 2026-10-15 (build section 63, S73); not deployed |
| B-A5 | **Only the day is reconciled, not the run**: a run cannot say what it truly cost unless it is the only one in flight | Medium | `ledger_mainline`'s settle side | a second free `appendix/user_data` reading on settle, with the delta attributed to the run only when no other ledger row was open | fixed 2026-10-15 (build section 62, S72); not deployed |
| B-A9 | **The nine schedules sit outside `Rate Limit`**, so a monitor can never be refused for concurrency however much is already running | Medium | the monitor workflows' guard path | put the scheduled runs through the same gate the API runs use | fixed 2026-10-15 (build section 64, S74); not deployed |
| B-B1 | **Two estimates disagree**: `app/shared/src/constants.ts` / `estimate.ts` still carry the 2026-10-02 table, 1.3x-2.5x high — which is why real runs were refused at "$5.74 of $6". The engine now publishes a calibrated `run_cost_estimate_usd` | Medium | the app's estimate table | the app shows the engine's figure instead of its own | fixed 2026-10-15 (app: one table, `shared/src/cost.ts`) |
| B-B4 | **No published reliability statement** — what we commit to, measured how, with the named failure modes. Needs D25a first | Low | docs + the app | after D25a: state it, measure it, show it | open (needs D25a) |

| B-R1 | **Nothing is ever delivered.** 23 reports landed in the app on 2026-10-14 (execs 535-581) and not one was e-mailed, posted or pushed anywhere; every one of the six tools benchmarked delivers the report to the customer. The engine's e-mail is deliberately off (`ENGINE_EMAILS=false`, so the app holds the reports) — the delivery has to come from the app, which now has a working mailbox and a working webhook | **High** | the app: a scheduled digest and per-run delivery, by e-mail and webhook, carrying the share link | deliver on a schedule the customer sets, with the figures and the link; never attach a report a run marked not ready | fixed 2026-10-15 (app: schedules, e-mail + signed webhook, share link, delivery log, retries) |
| B-R2 | **No client-facing branding or portal.** G15's share links exist and match or beat the only competitor that has them, but no run has ever exercised the app UI, and a client has no branded place to look | Medium | the app | white-label-lite: the company's name and logo on a shared report, and an owner-session browser pass so the UI is evidenced at all | fixed 2026-10-15 (app): a shared report carries the customer's name and logo from the business profile they already fill (`seo_profiles.business_name` / `logo_url`) — **no new column and no migration**, a correction to the benchmark's own suggestion; a missing or broken logo does not break the page; and `app/BROWSER_PASS.md` records **54 screenshots** at 1440 and 375, light and dark, on the agent's own test account |
| B-R3 | **The app's estimate disagrees with the engine's** (also B-B1): `app/shared/src/constants.ts` / `estimate.ts` carry the 2026-10-02 table, 1.3x-2.5x high, which is why runs were refused at "$5.74 of $6". The engine now publishes a calibrated `run_cost_estimate_usd` | Medium | the app | show the engine's figure, and keep one table, not two | fixed 2026-10-15 (app: one table; the engine figure is read when it arrives) |

| B-A10 | **R18's gate reaches three paths, not the class.** The in-200 retry gate (`_dfs_retry.js`) covers the SERP, facts and keyword-data calls; a ratchet added on 2026-10-15 (`retry_lint.check_in200`, `harness/in200_baseline.json`) measures the rest and **48 DataForSEO nodes across 12 workflows are outside a recorded gate** (the untouched v3 export excluded). The build now refuses a *new* ungated node, so the debt cannot grow | Medium | `retry_lint.py`, the builders' DataForSEO nodes | register R18's existing chains with `record_gate()`, then gate the remaining calls workflow by workflow, deleting each name from the baseline as it lands | fixed 2026-10-15 (build section 75, S85): **72 of 95 DataForSEO calls across all 12 workflows are inside a recorded gate**, 21 calls spliced, baseline 49 -> 23 and every remaining row carries its reason. The debt was never 49: `check_in200` ran on the **main workflow only**, so the ten `DFS Balance End` nodes B-A5 added entered ungated and were never measured — the true figure was 59, and `retry_lint.check_all` now walks every generated workflow and fails on a stale baseline row |

### 3.15 What the 2026-10-15 fix batch found (B-F items)

Four agents, two at a time. **Every one of them contradicted its brief on something load-bearing**, which is the result worth keeping:
a brief is a hypothesis, and the code is the evidence. All fixed in the same pass unless the status says otherwise.

| ID | Title | Impact | Where | Status |
|---|---|---|---|---|
| B-F1 | **The engine measured no Claude token at all — not 68%.** `@langchain/anthropic` 1.5.6 returns `llmOutput` only from `_generateNonStreaming`, and n8n's tracing reads exactly `result?.llmOutput?.tokenUsage`, so the streaming path falls back to a tiktoken estimate; and the eight non-streaming nodes' real `tokenUsage` rides the `ai_languageModel` connection, which `WorkflowDataProxy` only reads as `main`, so no Code node can read a token. The "measured" figures in the run analyses were real but came from reading executions back through the API afterwards — never available to the engine itself. CLAUDE.md asserted the opposite | **High** (every Claude figure the engine reported about itself) | the Anthropic nodes; `v5/code/_cost_cal.js` | fixed: Anthropic's free `count_tokens` counts each streaming agent's exact prompt and answer (0% -> 70.9% on those three Opus nodes, 53.7% for a whole page run). Thinking stays modelled. **Sonnet nodes are still character-priced — the remaining gap**  **Sonnet half closed 2026-10-15** (build section 76, S86): seven non-streaming agents 0% -> Site Describer 100%, Critic 78.2%, Competitor Analyzer 69.9%, Keyword/Ladder Relevance 67.7%, Content Reviewer 61.3%, Verdict Agent 60.4%, Keyword Seeds 34.9%; the remainder is thinking, billed as output and never returned, so it stays modelled and says so |
| B-F2 | **A 404 from a revoked alert webhook was recorded as a delivery.** `Post Alert Webhook` is `neverError` with no `fullResponse`, so a failed POST came back carrying no error and the row was written down as delivered — the exact Rule 4 violation the rule was written for | **High** | the alert path | fixed: delivered means 2xx, nothing else |
| B-F3 | **Page Watch posted its digest and wrote nothing back**, so every alert row it raised sat `pending` for ever — and B-A7's new sweep would have re-sent digests that had already arrived | **High** | Page Watch | fixed: `Watch Ops Delivery` + the row update |
| B-F4 | **A deduplicated request and the app disagreed about which run it was.** B-A6 answers a repeat with the FIRST run's id, but the app matched a callback to the NEWEST run row carrying that id, so the repeat row would take the result and the original wait for ever. The ordering is deliberate (weekly reports reuse the request id of the run that set tracking up) | **High** (a seam, owned by neither change) | `app/server/src/services/runs.ts`, `n8n/client.ts` | fixed: the app keeps no row for a run that never started; `repeatResolvesToOriginal`, 4 tests |
| B-F5 | **A git worktree has no `n8n/.env`** — it is gitignored, so it does not exist there, and `build_v4.py` does not fail without it: it quietly bakes defaults into ten workflows (mail identity, service account, Bing flag). Every worktree agent of the last four days was exposed | **High** (process) | the build + the worktree workflow | contained, not fixed: the generated JSON is always rebuilt in the main worktree after a merge, and HEAD is verified to carry the real values. **The build should refuse to write workflows when `.env` is absent** — open. **Verified 2026-10-15 (orchestrator):** `env_settings.load_env` returns `{}` with no error and the build exits 0 on the defaults. **And the containment is weaker than stated** — `build_api.py` generates fresh uuid4 node ids on every build, so a rebuild in the main worktree always dirties `SEO_Agent_API.json` and `SEO_Agent_Admin_API.json`; a defaults-bake cannot be told from that churn by eye (the 2026-10-15 rebuild was checked id-stripped and was semantically identical, and HEAD carries the real sender in 11 workflows and the build default in none). The fix should make node ids deterministic as well as refusing a missing `.env` |
| B-F6 | **`run_cost_estimate_usd` was computed and shipped to nobody** — it appeared in exactly two places in the generated workflows, the Rate Limit node and a sticky note, and in no callback | Medium | the callback builders | fixed: computed above the four refusals and stamped by `Run Cost (Callback)`, the chokepoint all eleven builders funnel through, carrying `modelled` + basis or `not_available` with a null amount |
| B-F7 | **`request_id` is not a caller key** — `build_api.py` sets it to `$execution.id` and overwrites whatever the caller sent, so dedupe on it was impossible as the register described it | Medium | `build_api.py` | fixed: B-A6 keys on the caller's own header, else a fingerprint of the body + client_ip |
| B-F8 | **It is ten schedules, not nine** (R32 added Page Watch; section 55's ordering proof already asserted 10). The register said nine | Low | this register | fixed in the B-A9 row's wording |
| B-F9 | **A test that pinned a configured budget.** S71 asserted the day's budget *equals $6* and matched refusal text as "$6.00 of $6", so raising the ceiling to $15 failed five assertions — it was testing the configuration, not the guard | Low | `harness/scenarios_v5.js` | fixed: it pins its own values in the fixture, and checks only that CONFIG's figures reach the guard |

**Owner items this pass confirmed:** **D25a** is the ceiling for this area — without an always-on host, criterion 3.8 ("delivery rate >= 99%, measured") cannot be scored above 5 whatever we build. The Anthropic cost export (B-B3) is still wanted. `SEO_ALERT_WEBHOOK_URL` (B-B2) **is now set** — the benchmark agent worked in a worktree whose `.env` lacked it.


**Queue verified against the code, 2026-10-15 (before the next batch started).** The owner asked whether the open items were still
real or had been closed by the four rounds of fixes. Every one was checked in the code, not in this register: **B-A10** open (48
DataForSEO nodes across 12 workflows in `harness/in200_baseline.json`, 29 of them in the main workflow; the `retry_lint.check_in200`
ratchet is in place); **B-F5** open (see its row); **the Sonnet half of B-F1** open (the counter chains are wired only to
`_STREAM62` — the three streaming Opus agents — so the eight non-streaming nodes are still character-priced); **B-R2** open
(`app/web/src/pages/share/SharedReportPage.tsx` prints `orgName` as text and carries no logo; `seo_profiles.logo_url` already exists
and can be reused; no browser-pass script in `app/scripts/`); **INVARIANTS rules 1, 2 and 4** open (only `url_lint.py` and
`retry_lint.py` exist; rule 3 is the ratchet). Baseline at the same moment: build exit 0, harness **4505 passed, 0 failed**.
**And the deploy gap is real and measured:** the running instance carries **483 nodes, updated 2026-10-14 18:49 UTC**, against **502**
built — the 19 nodes missing are the nine `Count Prompt / Count Answer / After Count` nodes (B-A8 / B-F1), `DFS Balance End` and
`Load Run Ledger (Settle)` (B-A5), `Run Cost (Callback)` (B-F6) and four sticky notes. The owner chose to deploy after the current
batch rather than before it.

**Stale evidence, not stale work (same check).** Areas 5, 2, 4 and 3 carry scores from the 2026-10-13 scorecard, which predates 21
defect fixes inside those very areas (audit R2 / R10 / R19 / R24; ladders R1 / R8 / R15 / R16 / R22 / R23; cadence R1 / R13; content
R11 / R13 / R25). The benchmark passes are therefore briefed to read the code and the 2026-10-14 run as "what we do", with that
closed list given to each agent as "already fixed — verify before raising". The external research half of each pass cannot be stale,
so no area was dropped.

**A criterion the market changed (programme rule 1).** The 2026-10-11 rubric names **AgencyAnalytics / Semrush My Reports** as the leaders for reporting. Semrush's own knowledge base (kb/1546) says the Agency Growth Kit, **Client Portal and CRM are discontinued with no replacement**, so half that comparison no longer exists. **Old statement kept:** "AgencyAnalytics / Semrush My Reports". **New, 2026-10-15:** AgencyAnalytics alone for the portal, with Looker Studio for delivery, Databox for alerting, SE Ranking for cheap client seats and SEOTesting for annotations. The frozen `CRITERIA_*.md` are unchanged and the scorer keeps using them until the owner agrees to re-baseline.

**Deliberately refused:** a credit or unit currency of our own. Semrush and Ahrefs meter in units because they resell their own index at a margin; we resell DataForSEO and Anthropic at cost, and a synthetic currency would hide the one number a customer can check. **Where we judged the leaders wrong:** refusing a report beats Semrush-style partial delivery, and on reliability neither leader is a benchmark at all — `status.ahrefs.com` returns 404 and Semrush publishes no status page, so the comparison used is PagerDuty.

### 3.16 Benchmark areas 2 and 5 (B2 / B5 items, 2026-10-15)

Evidence: `../system-review-2026-10-14/BENCH_AREA2_ladders.md` (and `BENCH_AREA5_technical_audit.md`), written against the leaders' own
documentation with every page opened. Each area's agent was briefed with the defects already closed inside it, because the 2026-10-13
scorecard predates them — see the verification note in §3.15.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B2-1 | **One reach per website decided every topic's plan.** `_reach.js` cached a single 75th-percentile difficulty per site for 30 days and measured every ladder against it: exec 494 (`lad_mv5pjt5y4aoa`, "erp implementation dubai") was planned against a reach cached on 2026-10-08 during *e-invoicing* research. The leaders personalise per topic (MarketMuse PD = KD − Topic Authority; Semrush PKD falls with thematic distance) | **High** (it sets plan type, rung bands, months and the chance band) | `v5/code/_reach.js`, `Ladder_Plan.js` | `reachTopic()` measures the reach on the ladder's own topic from the `ranked` pull the run already makes, with the same `RAD.headFit` test the rungs use; used only with 5+ on-topic top-10 keywords behind it, otherwise the site reach stays, the plan names which number it used and on what topics it was measured, and calls itself the optimistic case. Absence of on-topic wins never becomes a penalty | fixed 2026-10-15 (build section 66, S76); not deployed |
| B2-2 | **A plan never counted what the site already had on its topic**, so it could open with new pages beside live ones. MarketMuse opens from a site inventory and its effort bands start at "optimise the page you have" | Medium | `Ladder_Plan.js`, `Build_Ladder_Report.js` | `topic_authority.coverage`: pages on the topic, searches ranked for, best position, improve-vs-new split — in the notes, the callback and a report section | fixed 2026-10-15 (build section 66, S76); not deployed |
| B2-3 | **The order of the plan was unexplained** — pages are ordered by rung band then cluster opportunity and neither was printed. Semrush names its five ranking factors per page | Medium | `Ladder_Plan.js`, `Build_Ladder_Report.js`, `Build_Ladder_Response.js`, `app/web/src/components/reports/ladder.tsx` | `why` + `why_factors` per planned page, into the report, the callback and `write_now` | fixed 2026-10-15 (build section 66, S76); not deployed |
| B2-4 | **[OWNER DECIDED 2026-10-15: build it, direct route — "the best approach, cost does not matter"]** **Rung keywords are clustered by an AI topic label, not by shared results pages** (K7). `KWI.serpClusters` exists and discovery uses it, but the ladder's pulls return no per-keyword URLs, so two searches Google answers with the same pages can become two pages | Medium | `Ladder_Requests.js`, `Ladder_Pool.js`, `Ladder_Plan.js` | a `ranked_keywords` pull for the head SERP's top 3 competitor domains (≈ $0.03–0.10 a ladder), or one SERP call per rung keyword for exactness | fixed 2026-10-15 (build section 70, S80): 8 nodes on the **main** path (requests -> gate -> SERP -> in-200 retry -> clusters), top 7 at 40%, a cluster member takes its head keyword's rung, capped at 24 keywords = **$0.048 a ladder**, cost counted once by task id; a keyword whose SERP could not be read is named, never merged and never dropped |
| B2-5 | **The SERP's domain diversity never reaches the feasibility verdict** — Semrush's fifth ranking factor. The data is already in `competitors_summary`, so the build is free, but it moves a scored output | Low | `Ladder_Plan.js` feasibility | count distinct registrable domains in the head top 10 and carry it into the feasibility reasons | fixed 2026-10-15 (build section 70, S80): the head SERP's distinct registrable domains move feasibility -6 / -3 / 0, with the count measured and the rule printed. It is a **share of the results actually read**, not an absolute count - six distinct domains in a six-result SERP is an open SERP, and two existing S67 assertions caught the first version |
| B2-6 | **K7's anchor is out of date.** Keyword Insights, the source of the shared-URL convention, now compares the **top 7**, not the top 10, "because Google no longer reliably shows 10 traditional links", at a 40% default threshold | Low (rubric accuracy) | `CRITERIA_keywords_content.md` K7 — **frozen**, not edited | the new statement is recorded beside the old one in the benchmark file; re-baseline only on the owner's say-so | **done 2026-10-15**: the owner approved the re-baseline; `CRITERIA_keywords_content.md` K7 now reads "≥ 40% shared top-7 URLs" with the old statement kept in the row and a note under the title. No other criterion changed |

**Area 5 — the technical audit** (`../system-review-2026-10-14/BENCH_AREA5_technical_audit.md`, 11 sources opened). The leader
check changed the comparison: **both desktop leaders shipped an agent layer in 2026** — Sitebulb 10.0 MCP Skills led by "What To
Fix First" (2026-09-09) and Screaming Frog 24.0 MCP (2026-05-19) — so the question is no longer whose crawler is bigger but whose
judgement is better. The agent also found the frozen rubric describing Ahrefs Patches as "AI-written titles", which Ahrefs' own
documentation does not say; old and new statements are kept in the benchmark file and `CRITERIA_*.md` is untouched.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B5-1 | **Nothing read the links a crawler cannot follow.** A card, a tile or a table row that navigates from a script is not a link, and it is the usual cause of the orphan pages the crawl reports — which the audit named as a symptom and guessed at in prose. Screaming Frog v24 ships this as "Find Uncrawlable Links" | Medium | `v5/code/Render_Diff.js` | read `<a>` with no href / a `javascript:` href, and div / span / li / button / tr carrying an address in `onclick` or `data-href`, out of the HTML already fetched; report with the orphan pages they explain | fixed 2026-10-15 (build section 65, S75); not deployed |
| B5-2 | **Five symptoms, five wrong fixes, five deductions, one cause.** The crawl reads the first response (JavaScript off by default), so on a client-rendered site it reported "Missing H1 heading — add one clear H1 per page", "Thin content — expand these pages" and "Orphan pages" while the render check beside it had already proved a script writes them. Sitebulb's 2024 corpus puts "H1 only after rendering" at 18.3% of pages | **High** (wrong advice, and the score deducted twice for one cause) | `Build Site Issues` §4c (build section 65) | join the crawl-wide symptom to the rendering finding where the render check proved it on ≥ 50% of the key pages read twice: higher severity, the crawl's count, the rendering fix, both titles kept, one deduction | fixed 2026-10-15 (build section 65, S75); not deployed |
| B5-3 | **The audit never said which reading its page figures came from** — a heading a script writes was reported as missing with no word that the crawl did not render | Medium | `Build Site Issues` notes | state it in the audit's own notes, with how many key pages were read both ways | fixed 2026-10-15 (build section 65, S75); not deployed |
| B5-4 | **No hreflang check anywhere in the audit** — the string does not appear in any audit node, while Screaming Frog carries 10 hreflang issues and Semrush an International SEO report. Criterion 1.2 lists hreflang | Medium (only for multi-language sites, and a hole for those) | `Render_Diff` / `Build Site Issues` | validate the hreflang set of the key pages already read: valid codes, self-reference, `x-default`, absolute URLs, return tags among the pages held — **silent when the site declares none** | open — in reach, ~S |
| B5-5 | **The known URLs the crawl never reached are counted and never looked at.** G24 prints "crawled X of Y known URLs"; nothing says what the other Y−X are | Medium | the audit's Search Console chain | a free plain GET of up to 25 of them (status, noindex, canonical, title) so "not crawled" becomes a statement | open — in reach, ~M |
| B5-6 | **Response vs render covers 5 key pages** (criterion 1.4 caps us at 4 for it). Sitebulb compares across a crawl at template level | Medium | `Render_Diff_Targets` / `Render_Diff` | when the crawl runs **with** JavaScript it is already the rendered reading of every page: pair it with a free raw GET of up to 25 pages instead of a paid render (`fromCrawl()` is only a fallback today) | open — in reach, ~M |
| B5-7 | **The pre-release check has no CI recipe, no threshold and no "expected change" list**, so a check that exists is a check nobody runs. Lumar Protect blocks a build on a threshold; Sitebulb's Release Check runs on a schedule and posts to Slack | Medium | `build_api.py` (`SEOagentPreRel1`) + docs | a documented action / shell snippet, a `fail_on` threshold, and a planned-change list so an intentional release does not fail the build | open — in reach, ~S–M |
| B5-8 | **IndexNow and the published-page log are not fed back into what to re-check.** Ahrefs' Always-On Audit prioritises re-crawl by exactly these signals, and we already operate IndexNow for the customer | Low | Page Watch / Audit Scheduler | a page submitted or written this week goes to the front of the watch queue | open — in reach, ~S |
| B5-9 | **Continuous monitoring is bounded by the host, not the code.** The leaders alert within 30 minutes (Ahrefs) or claim no crawl delay (Conductor); our daily watch is already optimistic on a Mac that sleeps | **High** for criterion 1.7, **owner-blocked** | — | **D25a** (an always-on host) first; then raise the key-page watch frequency | open (needs D25a) |
| B5-10 | **A fix is shipped as a zip, not deployed.** Ahrefs Patches publishes a title or meta description through a JS snippet or a Cloudflare worker (titles and descriptions only; redirects, canonicals and robots meta are planned) | Medium | the fix pack | needs **G13** (a CMS) or a customer-installed worker — a product decision about what we may touch on a customer's site | open (owner, with G13) |
| B5-11 | **No read API or MCP over our own audit data.** Both desktop leaders shipped an agent layer in 2026 (Screaming Frog 24.0 May, Sitebulb 10.0 September) — the customer can ask their own crawl questions and push issues into Jira. Overlaps area 12's G-5 | Medium | the app (not the engine) | build once for the whole product, not for the audit | open — overlaps area 12 |
| B5-12 | **Impact weighting has no conversion or revenue input.** Conductor names page views, conversion rate and internal linking; we use clicks and impressions. For a lead-generation site, impressions are a weak proxy for value | Low–Medium | `v5/code/_impact.js` | take GA4 key events per page where the customer has them configured; keep clicks/impressions as the fallback and say which was used | open (needs the customer's GA4 key events) |

**Area 3 — content creation & QA** (`../system-review-2026-10-14/BENCH_AREA3_content.md`). The leader check found the rubric half
stale: Surfer and Clearscope are alive and still right for term-coverage scoring, but both repositioned to AI-search visibility
and **neither refuses anything** — nor does Ahrefs, Semrush, Frase, Jasper or Writer. The only vendor with a documented
block-before-publish is Markup AI (Acrolinx rebranded). **No tool on the market gates on verified fact; we do**, and Google's
`using-gen-ai-content` guidance (updated 2026-10-01) now calls manual fact-checking critical — so this is a lead to defend, not a
gap to close. Also corrected: this register and the briefs pointed at `_draft_qa.js` as the article gate; that file is the
**outreach e-mail** gate (L2). The article gate is `Content_QA.js` + `Originality_Check.js`.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B3-1 | **The money mask judged an amount against a narrower corpus than the figure check forty lines below it**, and ran first, rewriting the draft for good. A probe on the shipped node put three AED fines and "42%" in one sentence, every one of them verbatim in the cited `mof.gov.ae` text the run had fetched: the percentage survived, all seven currency amounts became `[Price]`. The delivered penalties page carries **43 × [Price]**, its own Fine column included, under a correct citation of the decision that states every fine — and those tokens are what put it over `PH_MAX` and had it refused | **High** (the system destroys verified figures, then refuses the page for carrying the holes it made) | `v5/code/Content_QA.js` §2b / §3 | build the source corpus once above the mask; keep an amount a source cited **in that sentence** states, naming the source; take sentence boundaries on a shadow copy with link targets blanked, so a full stop in a URL cannot cut the citation off its own sentence | fixed 2026-10-15 (build section 68, S78); not deployed |
| B3-2 | **A price verb decided a statutory subject.** The guard was `(big \|\| OTHER_WORDS) && !PRICE_WORDS` and `costs` is a price word, so "the penalty **costs** AED 5,000 per month" was erased as if it were our own pricing instead of being shown to the reviewer as `[Confirm: AED 5,000]`. `[Price]` carries no value, so the owner was told only that a `[Price]` was somewhere in the copy | **High** | `v5/code/Content_QA.js` §3 | a fine, penalty, threshold, levy, duty, violation or sanction always keeps its number as `[Confirm: …]`; every amount the mask does remove is reported with its sentence in `masked_amounts` and in the owner's `placeholder_note` | fixed 2026-10-15 (build section 68, S78); not deployed |
| B3-3 | **A gate that failed became a label.** `Originality Check` runs after `Content QA` has finalised the delivery gate and flipped only `passed`. On the last round a draft **100% identical to a competitor page** came out `publishable: true`, `not_ready: false`, `quality.label: "passed the quality check"` — the fields the `-DRAFT` file name, the package banner, `meta.json`, the callback and the app all read, while the Word report's own Originality row said EXCEEDED | **High** (a plagiarised page delivered as having passed; the exact inversion of the programme's bar) | `v5/code/Originality_Check.js` | re-decide `publishable`, `not_ready`, `quality_label`, the reasons and the nested `quality` object when the check fails; leave them untouched when it passes | fixed 2026-10-15 (build section 68, S78); not deployed |
| B3-4 | **The readability band is a constant.** `flesch >= 40 && avgSentence <= 22` scores 15 of 15 on every topic, while Ahrefs' own data puts mean FRE at 69.7 for food and 49.6 for engineering, and Semrush derives its target from the top-10 competitors. A single absolute band is wrong by construction | Medium | `Content_QA.js` §11 / §15 | compute the competitor pages' Flesch from the text `Analyze Competitor Pages` already holds and score the draft against that band, reported with its basis as coverage now is; keep it a warning, never a refusal | open — in reach, ~M, free |
| B3-5 | **The critic never reviews the edited draft.** It runs once, before the editor; round 2's `Content QA` has `critique === null`, so the critic's problems do not even enter round 2's warnings. The judgement half of the gate never sees the text that will actually be published, while Surfer and Clearscope re-score live after every edit | Medium | the content chain (`Critic` → `Parse Critique` → `Content QA`) | re-run the critic on the editor's output when a round was spent — the wiring is trivial, the cost (one Sonnet call per round, ≈ $0.02–0.05 a page) is the decision | open (owner: cost) |
| B3-6 | **Upfront intent alignment is computed only for AI-target pages.** `words_before_answer`, the question-heading count and fan-out coverage sit inside the `if (AT)` branch, so a page without an `ai_target` is never checked for whether it answers its own question early — which Surfer added to its Content Score on 2026-10-01 as half of the AI Search Score | Medium | `Content_QA.js` §14 (`ai_ready`) | lift the answer-position and question-heading checks out of the `ai_target` branch and apply them to every draft | open — in reach, ~S, free |
| B3-7 | **Nothing outside the engine can ask "is this page publishable?"** Markup AI exposes the gate as an API, an MCP and a GitHub Action whose commit status feeds branch protection, and recommends "no High severity issues" as the rule. Ours is reachable only by running a $0.80 content run | Low–Medium | the app / `build_api.py` | expose the deterministic half of the gate (everything but the Claude calls) as a read-only check over supplied markdown; overlaps area 12's read-API item | open — overlaps area 12 |
| B3-8 | **A refresh does not re-check the facts.** C3 at 10 asks for every claim "re-checked at refresh"; the figure check runs on the draft of a run, so a page rewritten through `existing_page_url` re-checks, but a page merely *refreshed* by the cadence's decay path is not re-verified against its own cited sources | Medium | the refresh path (area 4's cadence, `Content_QA` §9b) | on a refresh, re-fetch the cited sources and re-run §9b over the live page's figures; coordinate with area 4 | open (overlaps area 4) |
| B3-9 | **The content score has never been validated against an outcome.** Surfer publishes ρ = 0.28 over 1,000,000 SERP entries; ours is an unweighted sum of six sub-scores with a bar of 80 that nothing justifies | Medium, **data-blocked** | — | needs months of our own published-page outcomes (**G17**); until then, say in the report that the score is a construct, not a prediction | open (needs G17) |
| B3-10 | **No AI-content detection — and that is the decision, not an omission.** EMNLP 2026 (135,389 pairs, 13 detectors) reports false-positive rates of 0.0–100.0% on genuine human text; ACM 2026 reports 9–15% of unmodified human originals flagged and <4% of AI text flagged after a cheap humanizer; older work puts the mean FPR on non-native English at 61.3%. Surfer sells a detector and a humanizer in the same product | — | — | **deliberate no.** Keep the defensible form we already have — banned phrases, a specificity floor, the critic — i.e. AI-*sounding* prose as a style defect, never an authorship verdict, exactly as Markup AI's AI Voice agent frames it | closed — will not build |
| B3-11 | **The style guide has never run with real data.** G31 is built, injected into three prompts and checked in QA, but execution 554 carried `style_guide: null` and `style_notes: []`, so C17 cannot be scored from evidence | Medium, **owner-blocked** | — | **O1 / O2**: fill techand.ai's business profile and style guide | open (owner) |
| B3-12 | **Google's Search Console Generative AI performance report is not read.** Shipped June 2026, free, first-party — and Google's own AI optimization guide (2026-07-10) names it as the measurement to use while warning that "no third-party tool has access to our internal ranking or AI systems" | Medium | the Site Tracker / AI visibility chain | read the generative-AI performance report alongside the existing Search Console pull; overlaps areas 7 and 8 | open — overlaps areas 7 / 8 |

**Area 4 — the content cadence** (`../system-review-2026-10-14/BENCH_AREA4_cadence.md`). Clearscope is still the right leader, and
its inventory is capped at 50 pages on the $129 plan and 300 on the $399 one, against the 2,000 ours covers for free. The agent
**marked its own area down**: `SCORECARD.md` scored C15 at 6 on 2026-10-13, but the decay verdict reached no table and no queue —
it was computed in one run and printed as a priority-3 e-mail line with no `api_body`, and the cadence's sources were ladder,
striking distance, trend and AI. Honest score before 2026-10-15: **4**. Recorded here so the re-rating does not credit a gain that
was really a correction. **Deploy note: eleven new `seo_pages` columns need `sync_tables.py`**, which `apply_env.py` runs.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B4-1 | **A decaying page was a 25% fall on 10 prior clicks, in the one window that cannot tell a decay from a season.** 10 → 7 clicks is "decay" at z = −0.73; `decay_drop_pct` survived the G28 sweep that claimed to remove the last fixed threshold. The `yoy` range existed since v4.3 and was requested at `rowLimit: 1` — site totals only — so the per-page year-ago comparison both Clearscope cuts and Ahrefs' rule are built on was one free request away and never made. On techand.ai (34 clicks site-wide, exec 581) the rule cannot fire at all, and the report cannot say so | **High** (the advice is wrong, and silently) | `v5/code/_site_stats.js`, `Parse_GSC.js`, `GSC_Requests.js`, `Site_Plan.js`, `Site_Report.js`, `Brief_Input.js` | `ST.decay`: two-sample Poisson + a new free `pages_yoy` request; `seasonal` / `watch` / `too_small` reported with their reason; `visibility` vs `clickthrough` named; the report states what it tested and refused | fixed 2026-10-15 (build section 67, S77); **not deployed** |
| B4-2 | **The decay verdict lived for one run and died in an e-mail.** `seo_pages` held no metric, no history and no judgement, so nothing downstream could act on it; `decaying_pages` reached no table | **High** (precondition for every refresh) | `ladder_common.py` `PAGES_COLS`, `v5/code/Page_Inventory_Site.js`, `_site_model.js` | eleven columns on the page row, written weekly only when they changed; a silent week keeps the stored judgement with its own date | fixed 2026-10-15 (build section 67, S77); **not deployed — needs `sync_tables.py`** |
| B4-3 | **Nothing in the system ever wrote a refresh.** The cadence's four sources were ladder / striking / trend / AI; a decaying page reached the owner only as a priority-3 action with no `api_body`, while the striking action beside it shipped a one-click body. C15's 10-anchor asks for a scheduled substantive refresh | **High** (the area's largest gap) | `v5/code/Cadence_Plan.js`, `Site_Metrics.js`, `app/server/src/services/cadence.ts` | a `decay` source ranked by clicks lost, ahead of striking and trend, ≤ 2 a week, 60-day settle, never for a refused state or without a search; the decay action now carries `api_body` | fixed 2026-10-15 (build section 67, S77); **not deployed** |
| B4-4 | **A refresh is never measured.** Semrush's own guide says to wait two months and re-run the same analysis; we had no pre-refresh baseline to re-run it against | Medium | `_change_test.js`, `seo_pages` | B4-2's weekly series is the baseline; after ~8 weeks test the refreshed page against itself with the site's other pages as control, as `seo_link_impact` does for a link | open — **blocked on ~8 weeks of stored rows**, no decision needed |
| B4-5 | **No page-level history, so no peak-month view and no 12-month sparkline** — Clearscope's second decay cut, which catches a slow bleed 28-vs-28 misses | Low–Medium | `Page_Inventory_Site.js` | B4-2 accrues one row a week; a one-off backfill of ~12 free monthly requests per site would give 12 months at once | open — **owner decides** whether the backfill is worth the Site Tracker runtime |
| B4-6 | **A refresh leaves no mark on the charts**, although published pages, audit fixes and Google updates all do | Low | `v5/code/_annotations.js`, `v5/data/seo_events.json` | one more event kind | open — worthless before B4-4 |

**The build-time safety pass (B-F5 closed, INVARIANTS rule 2 landed, and the three defects the lint found).**

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B-F5 | **A worktree has no `n8n/.env` and the build did not fail without it** — it exited 0 having baked "Dev SEO", the old sender and ops address and an empty service-account e-mail into eleven workflows. Every worktree agent of the last five days was exposed, and the containment ("rebuild in main and check the diff") was useless because `build_api.py` regenerated a uuid4 per node per build | **High** (process) | `env_settings.py`, `ladder_common.py`, every builder | `env_settings.require_settings` refuses a missing file or an empty load-bearing setting and names what it wanted; `--no-env` / an environment variable opts out loudly for a deliberate offline build. `ladder_common.freeze_ids` makes every node id `uuid5(workflow:node)`, so two builds of unchanged sources are **byte-identical** (verified: same SHA-256 over `workflows/` + `code_v4/` across two runs) and a real difference can no longer hide in churn. `webhookId` untouched; nothing references a node id | fixed 2026-10-15 (build section 69, S79); not deployed |
| B-I2 | **INVARIANTS rule 2 had no enforcement**: ~16 defects came from a gate applied where data is written but not where it is read, and R16's fix did it for one gate only | **High** (a class, not an instance) | `gate_lint.py`, build section 69 | the lint walks the **generated** workflows and fails the build when a gate kit is inlined on a write path but not on the matching read path: 4 live pairs (the fit gate on `seo_ladders`, `LK.footprints` on `seo_backlinks`, `OK.sellsSame` on `seo_link_prospects` and the outreach table), 9 read paths gated, 30 on a ratchet baseline so the debt cannot grow. Proved to bite five ways: a removed `fitStored`, an ungated ladder reader, a renamed `footprints(`, a reintroduced `uuid4`, a `build_api` that stopped freezing | fixed 2026-10-15 (build section 69, S79); not deployed |
| B-G1 | **The AI question panel is built from stored ladder rungs with no gate** (*AI Plan* in both the AI Visibility Tracker and the AI Pulse, every rung but rung 4), so a competitor's brand or a government portal stored as a rung becomes a question we ask ChatGPT — and then score ourselves against. This is exactly R16's shape, which was fixed for the Rank Tracker and the Content Cadence only | **High** (it advises and scores from ungated stored data) | *AI Plan*, both workflows | apply the fit / competitor gate on the read path, as R16 did for its two | fixed 2026-10-15 (build section 71, S81) |
| B-G2 | **AI Growth turns the same ungated stored rungs into "questions to win"** — and into pages the Content Cadence then writes | **High** | *Growth Plan* | the same read-path gate | fixed 2026-10-15 (build section 71, S81) |
| B-G3 | **The Site Tracker adds every stored rung to the tracked keywords**, so a rung set aside for being a competitor's brand still buys a live rank check every week and still appears in the weekly report | Medium | *Site Plan* | the same read-path gate | fixed 2026-10-15 (build section 71, S81) |

The other nine baseline entries are reads that do not advise from the keyword or the host (settings rows, publish matching, the e-mail /
callback lookup, audit-site discovery). They stay listed rather than excused, so the next person to make one of them advise has to look
at the file. The agent's own note in `harness/gate_pairs_baseline.json` first called these three B-F6/B-F7/B-F8; those ids were already
taken by the 2026-10-15 batch, and the note has been corrected to B-G1/B-G2/B-G3.

**What the B2-4 pass found on the way (2026-10-15).** Three corrections, each against something this register or a brief asserted:

- **The ladder's spend estimate is not where the brief said.** `EST.ladder` is not in *Rate Limit* — G23 (section 51) moved both tables
  into `v5/code/_cost_cal.js`, and the ladder's *Claude* figure (0.18) was never the one to change. The new SERP calls are DataForSEO
  money: **`DFS_EST.ladder` 0.16 -> 0.21**, derived from exec 495's measured $0.1162 plus 24 x $0.002 = **$0.1642 real cost per ladder**,
  the same headroom its neighbours carry. Mirrored in `app/shared/src/cost.ts` (measured 0.231 -> 0.279), so the app and the engine still
  quote one figure (B-B1).
- **A `free_only` ladder cannot exist today.** *Normalize Input* sets `free_only` only for `mode: backlinks`, so the guard that skips the
  paid clustering is built and tested but defensive until that is widened — which also needs `keysFor` in the cost kit. Registered here
  rather than quietly assumed.
- **Two pre-existing breakages, neither found by a test:** the branch tip **did not typecheck on the server** (`runs.ts:182`, B-A6's
  `eq()` on a nullable `request_id`) — the orchestrator's own check after the area 4 merge ran the *web* project and the server *tests*,
  and neither covers that; and **`DFS Balance End` had never been seen by the in-200 ratchet**, because the lints ran at section 56 while
  that node is added at section 62. All three lints now re-run at the end of the build, which is the general fix.

**One decision left open (B2-7).** B2-6's re-baseline (top 7, 40%) is implemented **on the ladder path only**. Discovery still clusters on
3 of the top 10, so the two paths now apply different rules to the same question — the drift INVARIANTS rule 2 exists to prevent, though
here it is a threshold rather than a gate. Aligning discovery moves a second scored area and S52's fixtures, so it is the owner's call.

**B-G1..B-G3 closed, and what closing them found (2026-10-15, build section 71, S81).** One shared `FITR` (ctx / rungs / line) in
`_fit_gate.js` now serves all four read paths, and a row it sets aside is **printed with its reason** ("Not asked" / "Set aside")
rather than quietly missing from a shorter list. Four entries left the ratchet baseline for ever (AI Visibility Tracker / *AI Plan*,
AI Pulse / *AI Plan*, AI Growth / *Growth Plan*, Site Tracker / *Site Plan*): 30 -> 26, with gated read paths 9 -> 13.

Three corrections, each against something this register or the brief asserted:

- **The AI Pulse does not share *AI Plan*'s code**, although `CLAUDE.md` says the Pulse shares the AI Visibility Tracker's node code.
  Its plan node is `Pulse_Plan.js` and it reads the stored **question panel** (`seo_ai_prompts`), not ladder rungs — the lint had only
  flagged it through `_monitor_sites.js`. The stored panel is now gated in both AI workflows, which is a wider fix than B-G1 described.
- **`gate_lint.py` had a hole, and it was the dangerous kind.** Adding the shared loop to `_fit_gate.js` put the gate's own text into
  every node that merely **inlines** the kit, so *Ladder Plan* and *Rank Keywords* flipped to "gated" without gaining a gate — and the
  ratchet's rule is that an entry which gains its gate is dropped **for ever**. The lint now cuts the kit's own source out before asking
  whether a node calls the gate. The same hole existed on the **write** side, which is why *Cadence Plan* had been miscounted as a
  writer. A ratchet that can be fooled is worse than no ratchet, because it is trusted.
- **Two rows must never be gated**, found by S19 regressions: the **brand question** (the gate's first rule is that it names the website
  itself, so gating it would refuse the one question every site must ask) and a question the **owner typed themselves**. Both are kept
  and flagged.

**INVARIANTS rule 1 is enforced, and the five defects the inventory found (2026-10-15, build section 72, `lineage_lint.py`, S82).**
No new node can compose a delivered document without `_lineage.js`, hand on findings without `LN.evidenced`, subtract a stored report
figure without the `report_type` and sample guards, or show a score with no refusal path. Kits are stripped before judging — inlining
`_lineage.js` would otherwise make any node a "report builder", and `_page_watch.js` had made eleven nodes look like delta nodes. It was
broken six ways and each was caught by name. Coverage today: lineage 10/16, evidence 1/2, like-for-like 4/6, withheld 3/4, with 9 nodes
on `harness/lineage_baseline.json`. **What it does not prove is written into the baseline note**: that each individual figure inside a
passing node carries its own lineage — `LN.of()` proves the node was built to say where a number came from, never that the number beside
it did.

**Paid on the way in, not registered as debt:** `addDomain` shipped **seven** audit findings — SSL, HTTPS redirect, sitemap, robots.txt,
404, directory browsing, HTTP/2 — with literally `evidence: ''`, scored and ranked. `LN.evidenced` now runs at the sink (*Build Site
Issues*, before scoring) with held-back titles named in the notes. And the **technical site audit** gained the "Where these numbers come
from" table that the full report has carried since G29, travelling in the callback.

**A correction to this register:** its own sub-rule "no finding ships with an empty evidence string" was written as a description of R10.
It is not — R10's evidence string had words in it; what was wrong there was that Google had answered nothing, which `PW.inspection` owns.
The empty-string defect was real but lived elsewhere, in the seven findings above.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B-L4 | **AI visibility deltas are computed across panels of different sizes.** *AI Metrics* subtracts the previous run's `share_of_voice` and `visibility_score` without checking the question panel is the same size — and the panel is settable from 3 to 50, so changing it reads as a change in visibility. R19's shape on a different figure | **High** (a wrong number a customer acts on) | *AI Metrics*, AI Visibility Tracker | carry the engine set and the panel size with the figure; compute the delta only when the **engine set matches** and the panel is within R19's 20% drift, else `delta: null` with `delta_not_compared` naming both panel sizes, and the report prints "not compared" where the arrows were (an empty tile read as "no change") | fixed 2026-10-15 (build section 73, S83); not deployed |
| B-L5 | **A spam-score alert compares two unlike snapshots.** *Parse Backlinks* alerts on a 15-point move between snapshots without checking they are the same kind; a `free_only` snapshot is built from a different set of sources than a full one. R20's shape on a different figure | **High** (a false alert about a customer's backlink profile) | *Parse Backlinks*, Backlink Monitor | compare only snapshots built from the same source set and over an index whose link count did not drift >20%; a snapshot whose `mode` nobody recorded is **no longer assumed paid** — which is exactly how an unlike row got in | fixed 2026-10-15 (build section 73, S83); not deployed |
| B-L1 | **The written page package prints QA counts and readability / originality scores with no source line** — and prints them whether or not the check that produced them ran | Medium | *Blog Package* | LN on the package: content score, QA summary, coverage and originality each state source / period / sample / basis, and a check that did not run yields a **withheld** figure, not a number. Deliberately not rendered into the article — that is the customer's published page | fixed 2026-10-15 (build section 73, S83); not deployed |
| B-L2 | **The keyword strategy prints searches per month, difficulty and cost per click as facts.** They are provider estimates for a single keyword; the section says so in prose, not as lineage, and when the strategy ships on its own there is no table at all | Medium | *Build Keyword Strategy* | the G29 "Where these numbers come from" table in the strategy document and `lineage` in the callback; volume / difficulty / CPC labelled the provider's **estimate for one keyword** | fixed 2026-10-15 (build section 73, S83); not deployed |
| B-L3 | **The Word attachment carries the numbers without their sources** — *Build Word File* re-prints the figures and the lineage block does not travel into the `.doc`, so the customer who opens the attachment sees figures with no provenance | Medium | *Build Word File* | the kit, a final lineage section in the `.doc` and `lineage` in the json — one node, so the verdict, the keyword report, the written page and the audit attachment all gain it | fixed 2026-10-15 (build section 73, S83); not deployed |

The other four baseline entries are small or already covered at their sink (*Analyze Probes* delivers only through *Build Site Issues*;
three cadence / Console Alert e-mails state counts with no source line). They stay listed rather than excused.

**INVARIANTS rule 4 is enforced — all four rules now fail the build (2026-10-15, build section 74, `state_lint.py`, S84).** Unlike
rules 1, 2 and 3 it needs **no ratchet**: six classes, all fully passing (builders 2/2, delivery 15/15, promise 4/4, reversal 1/1,
stored 2/2, verdict 1/1, 0 rows on the baseline). It proves over the generated JSON that every caller of the shared published-row
builder hands it the proof and the builder refuses without it; that no Data Table node mints a forward state with an ungated path into
it; that no node records `delivered` without judging a status code; that no delivery POST is `neverError` without `fullResponse`
(B-F2's shape); that a workflow which opens a delivery record settles it (B-F3's shape); and that **no node after a verdict touches one
verdict field without setting all five** — the class B3-3 belonged to, where a copied draft was labelled publishable because the failing
gate reached a different field than the one the filename, banner, `meta.json`, callback and app read. What it does not prove is written
into its baseline note: that the row a node wrote is the row its evidence covers, and the app-side half of B-R1 is unreachable from the
engine's JSON.

It was broken ten ways and each was caught by name — and **four of those breaks exposed holes in the lint itself first**, including
`gate_lint.py`'s exact hole (evidence found in an inlined kit counting as the node's own), one proof IF upstream counting for every path,
`status_note` matching inside `status_noteX`, and a POST read through `$input` not being counted. 18 self-test cases, all caught.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B-S1 | **A page that answers 404 was recorded as published.** "I published a page" (*Publish Check*) called `publishedRows()` **unconditionally**: `live` was computed at line 34 and never reached line 127, so a URL that could not be fetched was written `status: published`, `published_url` and `page_exists: true` into `seo_content_log` **and** `seo_ladders` — while the same run told the owner it could not be fetched. Its twin *Detect Published* never had the bug. Verified in the pre-merge source by the orchestrator | **High** (the state machine's own rule, broken at the one node whose whole job is to check) | `v5/code/Publish_Check.js` | the builder refuses without the proof, and every caller hands it over; with no earlier row the claim is recorded as **reported**, never as published | fixed 2026-10-15 (build section 74, S84); not deployed |
| B-S2 | **A case study was marked published with no gate at all** — *Mark Case Study Published* wrote `published` into `seo_case_studies` on nothing but the run having reached that node | Medium | the case-study path | behind a new *Page Live? (Published)* IF | fixed 2026-10-15 (build section 74, S84); not deployed |

**All four INVARIANTS rules now enforce at build time**: rule 1 `lineage_lint.py` (ratcheted, 9 nodes), rule 2 `gate_lint.py` (ratcheted,
26), rule 3 `retry_lint.py` (ratcheted, 48 for B-A10), rule 4 `state_lint.py` (**no ratchet**). Every one of them found a live defect on
the day it landed: rule 2 found B-G1..B-G3, rule 1 found seven findings with empty evidence plus B-L4 / B-L5, rule 4 found B-S1 / B-S2.

**B-L1..B-L5 closed, and the third lint hole of the day (2026-10-15, build section 73, S83).** Baseline **9 -> 4 nodes**; coverage
lineage 10/16 -> **13/16**, like-for-like 4/6 -> **6/6**, withheld 3/4 -> **4/4**. Harness 4812.

- **The orchestrator's brief got B-L4 wrong, and the agent backed it out.** The brief said to guard the delta on the run kind. *AI
  Metrics* already excludes the monthly-only engines (`RC = R.filter(r => !MONTHLY.includes(r.engine))`) **precisely so** that a weekly
  and a monthly run are comparable, so guarding on kind suppressed a correct comparison and broke S19 week 2. What genuinely moves the
  rates is the **set of engines they were counted over**, which a stored row already records. Compared on that, plus the panel at R19's
  20% drift.
- **Two more holes in `lineage_lint.py`, the same shape as `gate_lint.py`'s and found the same day.** A kit **header comment** naming the
  call the lint looks for answered the lint's question for every node that carried the kit — `_lineage.js` opens with "LN.block() prints
  the whole list…" *above* `const LN = (() => {`, so the kit stripper never reached it, and *Site Report* was passing `lineage` on prose.
  Comments are now stripped before every check (a `//` after a colon is spared so URLs survive). And a node that **renders** lineage
  composed upstream is a use of the kit, not a gap. Guard markers are calls, never inlines.

**Three lints, three holes of the same kind, in one day** (`gate_lint` counted an inlined kit as a gate; `lineage_lint` counted a kit's
own header and then its rendered output; `state_lint` found four in itself before it was merged). The lesson is recorded here because it
will recur: **a lint that reads generated source must strip the kit — comments included — before it asks whether a node calls a kit.**

**B-A10 closed, and the fourth lint that measured less than it claimed (2026-10-15, build section 75, S85).** Harness 4845; main
workflow 519 -> **625 nodes**. Left on the ratchet with reasons, not excuses: the 12 free `DFS Balance` probes and 10 `DFS Balance End`
nodes (they fail open, `CC.dfsDay` drops a 0 reading and says so, and nothing scores on them) and `Get Crawl Summary` (already a poll
loop). **Money:** both attempts are summed with each task counted once by its id (`__dfs.cost_usd` / `__dfs_cost_usd` per item), retries
joined `__LEDGER_NODES`, and *Start Crawl* never re-sends an empty result.

Three corrections, each against something a brief or the register asserted:

- **The ratchet only measured one workflow.** `check_in200` ran on the main workflow alone, so ten nodes added the day before entered
  ungated and were invisible to it — 49 reported, 59 real. This is the **fourth** lint this week found measuring less than it claimed
  (`gate_lint` counted an inlined kit; `lineage_lint` counted a kit's header comment and then its rendered output; `state_lint` found four
  such holes in itself). The pattern is now explicit in the register: **a new lint's first question must be "what does it not look at?"**
- **`record_gate()` replaced a workflow's chain instead of extending it**, which is why section 70 had to re-pass section 56's by hand.
- **A node can name another through a helper**: *Parse Backlinks*, which prices the whole run, reads `all('Run BL Requests')`, so a naive
  `$('X')` replace would have paid for the retries and then ignored them. The splice moves argument-position names with comments stripped
  and fails by name on anything else.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B-A11 | **Three nodes still degrade silently when both attempts fail.** *Pick Competitors*, *Analyze Keywords* and *Competitor Analysis* carry on with what they have instead of marking their evidence `unavailable` — pre-existing, and now behind a retry, so it takes two failures rather than one. Everywhere else the gate's refusal was verified reaching the output (Parse Positions, Site SERP, Trends, Assess Result on a 502, Build Keyword Strategy, Collect Research, Analyze Backlinks, Merge Keyword Data, Save Task ID) | Medium | the three nodes | mark `unavailable` and refuse to advise from it, as the other nine do | fixed 2026-10-15 (build section 76, S86), **and the class with it**: `lineage_lint.py` gained check **E (refusal)** — 33 nodes in class, 14 passing, 19 on the ratchet each with its reason |

**B-R2 closed, and the four defects the first browser pass found (2026-10-15, app only).** The app UI had never been exercised by any
run; it has now been, on a test account created for the purpose — never the owner's, which was refused once before as impersonation and
stays refused. Evidence in `app/BROWSER_PASS.md`: 54 screenshots, 1440 and 375 px, light and dark, with no console errors, no failed
requests, no horizontal overflow, an `h1` on every page and no sub-AA contrast.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| BP-4 | **The dev server was serving stale code.** `tsx watch` never sees bind-mount events, so the running server could be older than the files on disk — which means **every browser check run against the dev stack before 2026-10-15 may have been looking at an older build**, including the v4.11 and v4.14 passes | **High** (it silently invalidates evidence) | `app/compose.dev.yml` | `CHOKIDAR_USEPOLLING` | fixed 2026-10-15 |
| BP-1 | **Field names were shown to clients** — a shared report printed "HealthScore" rather than a human label | Low | the share renderer | human labels | fixed 2026-10-15 |
| BP-2 | **The headline figures led with "Score delta"**, because they were rendered in jsonb key order rather than in an order a reader expects | Low | the share renderer | a stated order | fixed 2026-10-15 |
| BP-3 | A dead link had no `h1` | Low | the app | an `h1` | fixed 2026-10-15 |

**Two corrections to the register and the brief:** the area-12 benchmark said white-label needed "a migration (two columns on `orgs`)" —
it needed neither, because the customer already fills a business profile with exactly those two fields. And **`smoke.py` cannot pass in a
worktree at all**: with no `n8n/.env` the app has no n8n key, so four checks fail on "N8N_API_KEY is not configured" both before and after
any change. A committed stand-in (`app/scripts/stub_n8n.py`, started by hand, never imported by the app, never deployed) serves the Data
Table endpoints from memory so the app can be exercised without the engine.

**Not covered, stated plainly:** any engine-backed or paid path, so the dashboards were seen as empty states; settings, tools and link
building; 375-dark except the share page; Chromium only; no keyboard or screen-reader audit.

**The Sonnet half of B-F1 closed, and three corrections worth more than it (2026-10-15, build section 76, S86).** Harness 4898.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B-C1 | **The Critic has been charged as a loop since section 51 and never looped.** `_LOOPS51` listed it beside the Editor, so it was priced `qa_round` times; walking `main` in the generated workflow shows it is fed only by *After Count (Copywriter)* with no path back — it runs **once**. Every content run's Claude cost has been overstated by two extra Critic calls since then. Verified independently by the orchestrator | **High** (a number the system reports about itself, and the one the owner budgets from) | `build_v4.py` `_LOOPS51`, `_cost_cal.js` | the walk is the assertion now, not the label | fixed 2026-10-15 (build section 76, S86); not deployed |
| B-C2 | **It is 22 Claude agents, not eight.** Eight is the main workflow alone; the other 11, across seven workflows, were never character-priced at all — a monitor settles its **reservation** (`CC.aiRun`), so its Claude figure is a reservation wearing the clothes of a measurement | Medium | `harness/claude_count.json`, the monitor settle paths | the registry is generated and `_b76_checks` fails the build on a new uncounted agent; the 11 are named and their basis stated | **open** (the 11 still settle a reservation) |
| B-C3 | **`$('X').first()` returns the branch the *active* node is connected to.** *Keyword Seeds* sits on **output 1** of *Route Mode*, so section 62's counter pattern would have counted an empty branch and reported a confident zero | Medium | the counter chains | every output index is spelled out | fixed 2026-10-15 |

**The lint grew a check instead of three patches.** B-A11's three nodes (*Pick Competitors*, *Analyze Keywords*, *Competitor Analysis*)
were fixed, and `lineage_lint.py` gained **check E (refusal)**: a node that can reach `unavailable` evidence must have a refusal path.
33 nodes are in the class, 14 pass, 19 are on the ratchet with reasons. A fourth correction came out of writing it: *Analyze Backlinks*
**does** refuse, in its own vocabulary (`available: false`), and the check's first vocabulary would have flagged it — a lint that matches
one helper's spelling measures which helper a node imported, not whether it refuses.

**Area 1 — keyword research & verdicts** (`../system-review-2026-10-14/BENCH_AREA1_keywords.md`, build section 77, S87, harness
4953). Both rubric leaders stand, but on **different halves**: Semrush leads on site-specific difficulty with published bands,
Ahrefs on Traffic Potential with KD link-only by design. What was stale was **our code**, in three ways the orchestrator verified
before merging:

- **B2-1 never reached this area.** `reachTopic()` had exactly **one caller** (*Ladder Plan*), so the Keyword Check, the keyword
  report and discovery still measured against one site-wide reach — and the **verdict path had no reach at all**.
- **The verdict was copying the model's own JSON into the customer's documents.** *Parse Verdict* took
  `expected_monthly_visits_top3` and `time_to_rank_months` straight from the LLM and printed them **unlabelled** in the Word file,
  the PDF and the app's ladder card (exec 486). That is R26's class, live and unregistered, on the two figures a customer decides
  from — and it was not on the 'already fixed' list because that list covered the Keyword Check, not the verdict.
- **The AI Overview click loss was April 2025's `0.65`**, hard-coded in three files, against December 2025's measured -58% /
  -50.8% / -46.4% — so every AI Overview traffic estimate was about **1.5x too high**. A `num(null) -> 0` found on the way was
  shipping "0 visits (modelled)" as a figure.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B1-1 | **The keyword report's two headline numbers came out of the language model.** `Parse Verdict` copied `expected_monthly_visits_top3` and `time_to_rank_months` from the Verdict Agent's JSON into the Word file, the PDF and the app's ladder card with no basis of any kind (exec 486, 2026-10-13: *"`time_to_rank_months: 6` is given without a likelihood"*; exec 519's twin), while the same run computes a month range with an uncalibrated chance band (G3) and a calibrated-or-modelled traffic figure (G8) a few nodes away | **High** (the two figures a customer acts on) | `build_v4.py` §77, `Parse Verdict`, `Build Word File`, `Build Ladder Report`, `app/web/src/components/reports/ladder.tsx` | `for_you` (difficulty for this site, plan, months, chance, and which reach it used), `time_to_rank` (modelled range + chance + base rate, the model's own count kept as `model_months`) and `expected_visits` (volume through the measured click loss, basis in words); a results page that could not be read yields no visit figure; every surface prints the basis | fixed 2026-10-15 (build section 77, S87); not deployed |
| B1-2 | **The reach cache kept the number and threw away the evidence**, so every reader of a stored reach (30 days) could neither measure a topic nor say what the number rested on — exec 518 labelled 43 clusters against one *"reach 10"*, and the keyword verdict path had no reach at all | **High** (K1, the area's own criterion) | `v5/code/_reach.js`, `Reach_Discovery.js`, `Rank_Keywords.js`, `Assess_Result.js`, `Assess_Response.js`, `Build_Keyword_Strategy.js` | `reachCacheRow` stores the top-10 keywords behind the number, `reachCached` returns them, and the Keyword Check, the keyword report and discovery measure the reach on the topic asked about with the ladder's own kit and bar; below the bar the site-wide number stays and the answer names the topics it was measured on; a pre-B1-2 row says it has no evidence | fixed 2026-10-15 (build section 77, S87); not deployed |
| B1-3 | **The AI Overview click loss was the April 2025 measurement (0.65)** while the current study — Ahrefs, 300,000 keywords, December 2025 data, published 2026-02-04 — measures −58.0% at position 1, −50.8% at 2, −46.4% at 3; our estimate is for a page in the top three, so every traffic potential on an AI Overview results page was ~1.5× too generous, and the other four deductions were unsourced constants. Found while fixing it: `num(null)` is `0`, so a keyword with **no** provider volume reported *"0 visits (modelled)"* instead of "no estimate" | Medium | `v5/code/_kw_inputs.js`, `Build_Keyword_Strategy.js` | `KWI.CLICK_LOSS` carries factor + basis + source per feature (AI Overview 0.483 `measured` with the study URL, the rest `stated rule`), the note prints what was taken off and on whose authority, an absent volume yields no estimate, and the report names the study instead of printing a multiplier | fixed 2026-10-15 (build section 77, S87); not deployed |
| B1-4 | *(folded into B1-3 — the absent-volume defect found while fixing it; kept as its own line in the fix so a reader can find it)* | — | — | — | fixed 2026-10-15 |
| B1-5 | **The ten pages Google ranks were fetched and discarded** (K4): up to 16 live results pages are bought a run and only their domains, features and People Also Ask were kept, so the intent and page type that decide what we write came from the AI label alone | Medium | `v5/code/_kw_inputs.js` (`serpPageTypes`), `Build_Keyword_Strategy.js` | the shapes of the organic results are counted from the title and URL already fetched; a kind is dominant only at ≥ 50% of ≥ 4 results read; a disagreement with the planned page type is printed as a mismatch and never silently overrides the plan; a results page that was not read says so | fixed 2026-10-15 (build section 77, S87); not deployed |
| B1-6 | **Cluster traffic potential**: the SERP-overlap clusters already say which searches one page serves, so the page-level figure is their volumes through the same click-loss model — the free part of Ahrefs' Traffic Potential | Low | `Build_Keyword_Strategy.js`, `_kw_inputs.js` | sum the cluster's volumes through `featureLoss` and the top-three share, labelled modelled, beside the per-keyword figure | **open** (in reach, ~S) |
| B1-7 | **The app's keyword-report renderer shows none of the new figures** — the callback carries `for_you`, `time_to_rank` and `expected_visits` since B1-1, and the app shows the verdict, the score and the reasons only | Low | `app/web/src/components/reports/` | render the three with their basis, as the Word file does | **open** (in reach, ~S) |
| B1-8 | **No Traffic Potential of the ranking page** (Ahrefs' decision metric): we price a keyword by its own volume, not by what the page that wins it actually earns | Medium | `Priority Keywords` / `Build Keyword Strategy`, one DataForSEO Labs call per checked keyword | one `ranked_keywords`-class call against the #1 URL (**not verified that the endpoint takes a URL target — probe the sandbox first**), capped at the live-check limit | **owner decision**: ≈ $0.01 a keyword, ≈ $0.16 a discovery run |
| B1-9 | **A thematic distance for topics with no record**, so a difficulty can be personalised where evidence is absent (what Semrush's vector map does) | Low | `Rank_Keywords.js` / `_reach.js` | one Haiku call estimating the distance from the site model's services and pages | **owner decision**: ≈ $0.002–0.01 a run. **Recommended: no** — see §5(c) |

**Area 10 — backlink monitoring** (`../system-review-2026-10-14/BENCH_AREA10_backlinks.md`, build section 79, S89, harness 4981).
**Majestic, not Ahrefs, is the freshness leader** — the only vendor publishing a window (120 days) and a live date range; Linkody is
alive at $14.90 and re-checks every link every 24h. Three findings matter more than the comparison:

- **B10-4: an index's silence was recorded as a lost link, with no page ever fetched** — the same mistake that once reported
  techand.ai's strongest link dead while it was live and followed, which is the whole reason this system verifies a loss itself. The
  harness then found the other half: `[].every()` is **true**, so every row no source reported was dropped from the check queue
  entirely and never verified at all.
- **Part of the 'already fixed' list was not fixed**: D3's farm gate never reached the **anchor table**, so exec 564 printed a PBN
  anchor inside a table whose percentages excluded it. `RESULTS.md` noticed it and never gave it a number.
- **Two rubric figures cannot be verified and are no longer repeated**: the "91.7% of Ahrefs links still live" and "49.6% of
  Semrush's live links dead" studies have no independent 2025-26 source, and **DataForSEO's "90-day cycle" appears nowhere on their
  site** (they now say 1.98T live, refreshed continuously) — yet our own code comment repeats it (B10-5, open).

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B10-1 | **The report never said how fresh anything was**, while the index behind most of it only ever means "live when I last crawled" — Ahrefs states its own complete refresh "takes about two months", Majestic publishes a 120-day window and its date range, Semrush drops links undetected for six months, Linkody re-checks every 24 h. The index's own `last_seen` was parsed into the entry, stored on the row and read by nothing, and the row's `last_seen` is the maximum over every source *and our own fetch*, so it could not have answered this anyway | Medium (4B.1) | `v5/code/Link_Merge.js`, `Parse_Backlinks.js`, `BL_Report.js`; build §79 | `dfs_last_seen` kept per referring site apart from `last_seen`; `coverage.freshness` carries newest / middle / oldest for the index, our own median / oldest / never-read, and the age of the Search Console upload and the Common Crawl release; the report prints one sentence and the lineage block carries both as `reported` and `measured`. $0, no new call, no new Data Table column | fixed 2026-10-15 (build section 79, S89); not deployed |
| B10-2 | **Criterion 4B.2's own figure was computed by nobody.** The criterion is "≥ 90% of links reported live are live, by our own re-check"; the report printed *"Checked on the page 1"* over *"18 checked this run"* (exec 529, 2026-10-13) — two denominators, no rate, and no word about the other 17 — while `coverage.blocked` was computed in Parse Backlinks and shipped to nobody, the same shape as B-A6 | **High** (it is the number that says how much of the report is measurement) | `v5/code/Parse_Backlinks.js`, `BL_Report.js` | `coverage.check`: fetched / read / unread **by reason**, the share of the pages we read that still carry the link, and the same share over the links the index reports live; bot walls, JS-only pages and fetch errors count on neither side (as Linkody's own study excludes its 13% of crawl errors); **no rate at all under 5 readable checks**, with the reason printed instead | fixed 2026-10-15 (build section 79, S89); not deployed |
| B10-3 | **The anchor block was computed on two different sets, and the spam tile graded the index's number against a band nobody publishes.** A link farm's anchor ("High Quality Dofollow Backlinks DA 50 PA 40 Premium PBN Network Service", 17 referring domains, exec 564) was printed inside a table whose own percentages excluded it; the ">30% keyword anchors" instruction under it was an unsourced constant; and "Spam score 63/100 · **high**" applied our own ≥ 40 threshold to DataForSEO's 0-100, whose documentation defines the field and publishes no bands, on the same screen as 17 links our own check had already set aside | Medium | `v5/code/Parse_Backlinks.js`, `BL_Report.js` | one set for both halves (farms out, counted beside, still shown and marked "link farm, set aside"); the distribution printed against Linkody's measured population of 865,000 monitored backlinks, June 2026, named with its URL; the tile says whose 0-100 it is and over how many links, instead of grading it | fixed 2026-10-15 (build section 79, S89); not deployed |
| B10-4 | **An index's silence was recorded as a lost link, and the rows most likely to go silent were the rows guaranteed never to be checked.** 120 days with no source set `status: 'lost'`, reason `not_seen`, with no page ever fetched, no alert and no row in the lost table — it simply left the referring-site count and fed the drop alert. The other half, found by the harness while proving the first: *Verify Requests* filtered `!e.sources.every(…)` and **`[].every()` is `true`**, so any carried row no source reported this run was dropped from the check queue entirely, however valuable (`stablevendors.org` on the S28 fixture had never been re-checked once) | **High** (this area's founding mistake, in a new place) | `v5/code/Parse_Backlinks.js`, `Verify_Requests.js`, `BL_Report.js` | a silence is a loss only when our own fetch has already failed on that page; otherwise `at_risk`, value and count kept, named in the report with the reason it is not a loss, and raised to priority 850 in the check queue — above the valuable rotation, inside a light run's budget (INVARIANTS rule 2: the status one path writes is read by the other). The queue keeps rows with no source at all | fixed 2026-10-15 (build section 79, S89); not deployed |
| B10-5 | **An unverified vendor claim in our own code and in the rubric**: `Verify_Requests.js` states "DataForSEO's full cycle is up to 90 days" and CRITERIA 4B cites "1.85T live links, 90-day cycle". DataForSEO's own page now says 1.98 T live backlinks and "updated continuously in real-time", and states no cycle length. Also unverified: 4B's "91.7% of reported links still live (The Upper Ranks 2025)" and "Ahrefs found 49.6% of Semrush's live links dead" — no independent 2025-2026 liveness study was found | Low | comment in `v5/code/Verify_Requests.js`; the rubric statement is frozen and must not be edited | ask DataForSEO support for the recrawl cadence in writing, or drop the number from the comment; B10-2 makes our own liveness measurable per site, which is the figure that replaces the unverifiable one | **open** (documentation, ~S) |
| B10-6 | **No "redirected away" lost reason** (Ahrefs' 301/302 case): a linking page that now redirects somewhere that does not link back is reported as "link removed" | Low | *Fetch Linking Pages* / `LK.verify` | keep the final URL from the fetch (`fullResponse`) and report "the page now redirects to X" as its own reason | **open** (in reach, ~S) |
| B10-7 | **The lost section states no base rate**, so a customer losing two links in a quarter cannot tell whether that is normal — 52% of links die within a year (Linkody, 865,000 monitored links, June 2026) | Low | `BL_Report.js` | one sentence beside the lost table, with the study named, as B1-3 does for click loss | **open** (in reach, ~S) |
| B10-8 | **Weekly re-checks against Linkody's 24 h.** The fetches are free; what it needs is a daily schedule, the concurrency gate and a host that is always on | Medium | schedules | daily light re-check of the valuable and at-risk links | **owner decision** — $0 in API spend, but it **is** D25a |
| B10-9 | **No second index.** Majestic is the one with a published freshness rule and an API | Low | `BL Requests` | add Majestic Fresh Index as a source in the merge | **owner decision**: ≈ $50/month list (**not verified**). **Recommended: no** — see §5(c) |
| B10-10 | **Ahrefs DR only for a sample of referring sites**, though the free endpoint is already wired | Low | `DR Requests` | widen once the free tier's limits are read | **owner decision** |

**Area 6 — rank tracking** (`../system-review-2026-10-14/BENCH_AREA6_rank_tracking.md`, build section 78, S88, harness 5038).
Two findings outrank the comparison:

- **B6-4: two of the seven Google updates in `v5/data/seo_events.json` never happened** — "June 2026 core" and "September 2026
  core" — and the December 2025 and March 2026 entries were weeks out. That registry feeds the Rank Tracker, the Site Tracker's
  alerts and the app's charts, so **an invented update was given to a customer as the cause of a real fall**. Re-read from Google's
  own Search Status dashboard. It was in no register until now.
- **B1-3 did not fix the AI Overview factor everywhere.** It touched `_kw_inputs.js` only; `_rank_serp.js` still carried
  `ORGANIC_LEFT_WITH_AIO = 0.65`. Replaced with Ahrefs' December 2025 **per-position** table, because a flat factor cancels out of a
  *share* and so corrects nothing there. `Ladder_Pool.js` still carries 0.65 and is open as **B6-9**. The orchestrator reported B1-3
  as a three-file fix; it was one file, and this is the correction.

Biggest open gap in the area: **the tracker watches only ladder rungs** (B6-7).

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B6-1 | **The share of voice still cut every position by 0.65, the April 2025 AI Overview figure**, after B1-3 corrected the keyword research the same day. The current study (Ahrefs, 300,000 keywords, December 2025 data, published 2026-02-04) measures the loss **per position** — 58.0% at #1, 19.4% at #10 — and a flat factor applied to every position all but cancels out of a *share*, so an AI Overview cost the top of page 1 almost nothing in our own numbers. The same kit is inlined into the Site Tracker's SERP reading | **High** (a wrong figure, printed to the customer with its method, in two workflows) | `v5/code/_rank_serp.js` | `AIO_KEEP` per position; the pool the overview takes summed position by position; the method string carries the study, its size, its date and its URL | fixed 2026-10-15 (build section 78, S88); not deployed |
| B6-2 | **Nothing said whether the page itself moved.** Exec 570 printed *"peppol uae (not in top 50 → #47)"* and exec 505 printed its drops the same way: a page that slipped and a page pushed down by a results page rewritten under it were indistinguishable. The leaders answer with a market-wide index on other people's keywords (Semrush Sensor, AccuRanker Grump); the proof for a per-keyword answer was already in `seo_rank_history.snapshot_json` | **High** (the question the area is judged on, unanswered) | `v5/code/_rank_serp.js`, `v5/code/Tracker_Report.js` | `RS.churn` over the two stored readings, same keyword and same device; every gain and drop carries the clause; a Page movement column, a summary count, `serp_change` in the callback and a lineage row; five refusal paths with reasons instead of a zero | fixed 2026-10-15 (build section 78, S88); not deployed |
| B6-3 | **A Google update inside the window the positions are compared over was never named beside the moves.** The marks existed for the chart at the bottom of the mail, over the ladder's whole life; the drops at the top had no context (criterion 2.12) | Medium | `v5/code/Tracker_Report.js` | the oldest compared reading sets the window; updates and data breaks inside it are named with their dates and "cannot be proven from these positions"; silence when there are none | fixed 2026-10-15 (build section 78, S88); not deployed |
| B6-4 | **Two of the seven Google updates in the dated registry never happened**, and four dates were wrong. `v5/data/seo_events.json` carried a "June 2026 core update" and a "September 2026 core update" on dates Google never published, and misdated the December 2025 and March 2026 core updates by weeks. It feeds the Rank Tracker's marks, the Site Tracker's alert sentences and the app's charts, so an invented update was handed to customers as the context for a real fall | **High** (a fabricated external fact, in three products) | `v5/data/seo_events.json`; `app/shared/src/seo-events.generated.ts` and its test | re-read from Google's Search Status dashboard; names copied as Google writes them; the source and the fact that `end` is derived from Google's published duration recorded in the file; the build refuses either invented name or an entry not named as a core / spam / Discover update | fixed 2026-10-15 (build section 78, S88, S43, S56); not deployed |
| B6-5 | **The week's checks were costed for nobody** (criterion 2.14). The in-200 gate reads the provider's own cost for exactly these calls and it reached the callback; nothing printed it | Low–Medium | `v5/code/Tracker_Report.js` | print the week's cost and what a keyword costs a month at this frequency; say so plainly when the provider reported no cost | fixed 2026-10-15 (build section 78, S88); not deployed |
| B6-6 | **No cannibalisation check anywhere in the tracker** (criterion 2.10 names it; Semrush has a tab for it). Two of the site's own URLs in one stored snapshot is cannibalisation, observed, and we already store the snapshot | Medium | `v5/code/_rank_serp.js` / `Tracker_Report.js` | name both URLs and which one Google prefers today, from the reading already kept; silent when only one of the site's pages is on the page | open — in reach, ~S |
| B6-7 | **The rank tracker tracks only ladder rungs.** `Tracker Plan` reads `seo_ladders` and nothing else, so a customer who names thirty keywords in the tracking form cannot have them watched by the tracker that exists for it | **High** for the area's purpose | `v5/code/Tracker_Plan.js` | take `seo_sites.keywords` as a second source with its own cap, its own cost line and the same gates; keep the ladder series untouched | open — in reach, ~M |
| B6-8 | **A move of ±5 places is still a "drop"**, the fixed rule from v4.2. G28 gave the Site Tracker a tested threshold and left the rank tracker's alone; a drop is reported with no regard for whether anything around it moved | Medium | `v5/code/Tracker_Report.js` | report a move as the site's own only when the page around it held still, as the page moving when it did not, and not at all when the previous reading could not be compared — the measurement now exists (B6-2) | open — in reach, ~S–M |
| B6-9 | **`Ladder_Pool.js` line 61 still multiplies the CTR by 0.65** — the same April 2025 AI Overview figure B1-3 and B6-1 removed from the other two kits. It is area 2's file and this pass did not touch it | Medium | `v5/code/Ladder_Pool.js` | use the same measured per-position table (`RS.keepAt` / `KWI.CLICK_LOSS`), so one figure is corrected in one place | open — in reach, ~S (area 2's file) |
| B6-10 | **No "outranked" line.** Ahrefs sets a target URL per keyword and warns when it is outranked; our report says the number fell and not *who* took the place, although the stored snapshot names everybody above us | Low–Medium | `v5/code/Tracker_Report.js` | name the domain that moved above the target URL since the previous reading, from the two stored snapshots | open — in reach, ~S |
| B6-11 | **Country-level tracking only** (criterion 2.4 caps us at 4). Ahrefs goes country → city → ZIP across 190+ locations, Semrush targets by ZIP | Medium for any local business | the app, the ladder row, `Tracker_Plan.js` | DataForSEO sells the city location codes: the work is the onboarding question and the stored setting, not the provider | open (owner, product) |
| B6-12 | **No on-demand re-check for the customer** — AccuRanker's whole pitch, and the two biggest suites cannot do it (Semrush: "Updates are automatic and cannot be scheduled manually") | Medium | the app + the Manual Run path | a button with a rate limit, a cost rule and the caveat that a position moves over days, not minutes | open (owner, product) |
| B6-13 | **Mobile is bought for at most two keywords a ladder.** Only 13% of sites hold the same position on both devices (R2), so every rung page's reported position is one most visitors never see | Medium | `v5/code/Tracker_Plan.js` + the cost setting | a per-site setting: ≈ $0.85 a ladder a month for every tracked keyword on both devices | open (owner, per site) |
| B6-14 | **Share of voice is averaged across keywords unweighted**, so a 40% share of a search nobody makes counts as much as 4% of the head term. Ahrefs and AccuRanker both weight by volume (clicks to you ÷ clicks to the whole SERP; CTR × volume) | Medium | `v5/code/Tracker_Report.js` | weight by the site's own Search Console impressions per query (first-party and free, better than a provider estimate) — needs `seo_query_history` loaded into the tracker; say which weight was used, and say when there is none | open — in reach, ~M (owner decides the weight source) |

**Area 8 — AI visibility** (`../system-review-2026-10-14/BENCH_AREA8_ai_visibility.md`, build section 81, S91, harness 5078).
**The rubric's leader is no longer independent**: Adobe closed the Semrush acquisition (Semrush's own customer FAQ, updated
2026-04-28). Profound is still correctly named — independent, $180M Series D, 2026-09-15 — but its published self-serve tiers are
**gone** from its site, so the rubric's "$399" survives only in a third-party review and is recorded as *not verified*.

- **B8-2: B-L4 was fixed on one of two paths, on the same day it was fixed.** The like-for-like guard reached the Tracker; the
  **Pulse** pooled seven days of baseline into a 99% z-test with no check at all. Same one-of-N pattern as R28 and B1-3. Section 81
  now proves both guards' **ordering**, broken three ways on purpose.
- **B8-1: three of the four headline tiles printed an untested arrow** beside a tested one — including in the e-mail subject line.
  All four are z-tested on their own denominators with Wilson ranges, and the visibility score carries the standard error of its
  weighted mean over Kish's effective n.
- **What the research found, and it is a lead worth defending**: **no vendor puts a sample size or an interval beside a rate**
  (verified at Profound's own API level), and **none refuses a delta across a changed panel** — Profound actively rewrites stored
  history under the current configuration. With panels of 8-50 we are in the regime where samples-per-prompt dominate (Evertune:
  +/-31 at topic level for 100 prompts asked once), which is the argument for the daily Pulse.
- **G20 (panel 8 -> 20, +$5.08 / site / month) is the area's ceiling and stays the owner's decision.**

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B8-1 | **Three of the four headline tiles printed an untested arrow beside a tested one.** "Named in" has carried a 95% Wilson range and a two-proportion z-test since v4.9; "Your pages cited", "Share of voice" and the visibility score were bare subtractions in the same row, in the same type, off the same sample (exec 526: 54 answers; exec 556: 47 requests) — and the **subject line** printed the points with no word about the test. This is the one thing the area is scored on, and no competitor does it either: Profound's v2 endpoint returns three floats with no denominator, Semrush defines its change column as "the change in your brand mentions since the last update" | **High** (a change presented as a result, in the headline, on a signal that returns the same answer under 1% of the time) | `v5/code/_ai_stats.js`, `v5/code/AI_Metrics.js`, `v5/code/AI_Report.js` | one shared `changeOf` for all three rates, each on its own denominator (the share of voice on yours + the competitors' mentions, with the earlier counts read from the stored row); Wilson ranges for the citation rate and the share of voice; `scoreBand` (standard error of the weighted mean over Kish's effective n) for the visibility score, labelled modelled, with no change called inside its own band; the competitor-share alert z-tested instead of its fixed 10-point rule; the subject line says real change / within noise / not tested | fixed 2026-10-15 (build section 81, S91); not deployed |
| B8-2 | **The AI Pulse pooled seven days of baseline into a 99% z-test with no check that they measured the same thing.** B-L4 fixed exactly this class in the weekly tracker on 2026-10-15 and left the daily one — so raising techand.ai's panel from 8 questions to 20 (which G20 asks the owner to do), or switching an engine on, would have fired "a real drop, not sampling noise" every morning for a week at a site whose visibility had not moved. No vendor in the market has this guard; Profound is worse than neutral, rewriting stored history under the current configuration | **High** (a false alarm at 99% confidence, caused by our own settings change) | `v5/code/Pulse_Plan.js`, `v5/code/Pulse_Metrics.js`, `v5/code/_ai_stats.js` | the plan records each stored morning's engine set and panel size; `sameBasis` requires the same engines exactly and a comparable answer count (R19's 20% drift); every morning left out is named with its reason; with no comparable morning there is no test and the mail says so | fixed 2026-10-15 (build section 81, S91); not deployed |
| B8-3 | **A pulse morning nobody could read sent nothing, and looked exactly like a quiet one.** The pulse mails only when it has an alert, so a morning on which every request failed was silent — INVARIANTS rule 3's "a failure that reaches no human is not handled". And the weekly run pools those mornings straight into `samples` and `mentioned`, so a morning that reached two of three engines reweighted the week with nothing said | **High** (rule 3) / Medium (the weekly pooling) | `v5/code/Pulse_Metrics.js`, `v5/code/AI_Metrics.js`, `v5/code/AI_Report.js` | `readable` evidence block (asked / checked / failed / retried / `unavailable`); an unreadable morning always sends; a silent engine is a medium alert; no statistical drop from a day that could not be read; the weekly report names the pulse days pooled, which did not reach every engine, by date, and the engine that was silent. Pays `Pulse Metrics`'s `refusal` debt on the lineage ratchet | fixed 2026-10-15 (build section 81, S91); not deployed |
| B8-4 | **A per-question win rate had no sample floor and picked the actions.** With an 8-question panel a question can carry one answer, and "0%" read exactly like a question the business reliably loses — which then became a gap, a top action and a ready-to-send API body telling the owner to write a page. Evertune measures a single prompt asked once at **±44 points**, and the per-topic slice of a 100-prompt panel at ±31 | **High** (advice from one draw) | `v5/code/AI_Metrics.js`, `v5/code/AI_Report.js` | `rateOf` with `MIN_Q_SAMPLES = 4`: below the floor a question is not a gap, picks no action and ships no API body; it is listed as undecided with what it needs, and the grid prints "too few" with the reason | fixed 2026-10-15 (build section 81, S91); not deployed |
| B8-5 | **`skipped_by_cap` was written by *AI Requests* and read by nobody.** At 900 requests or $15 ($4 on the pulse) the run stops asking; every rate is then measured on what was left and the panel simply looked shorter | Low–Medium (bites at 50 questions and on the pulse cap) | `v5/code/AI_Metrics.js`, `v5/code/AI_Report.js` | counted per engine for this site, printed as "Not everything was asked", and recorded in the lineage as evidence nobody gathered | fixed 2026-10-15 (build section 81, S91); not deployed |
| B8-6 | **The app shows a per-question win rate with no range.** `win.ci` and `win.enough` now travel in the callback and the app's question grid still renders the bare percentage | Low–Medium | `app/web` AI visibility page | render the range and the "too few answers" state the engine already sends | open — in reach, ~S (app) |
| B8-7 | **Nothing tells the owner what their panel size buys.** Evertune publishes ±44 / ±9 / ±1 for 1 / 100 / 10,000 samples and Gumshoe publishes ±5pp at 95%; our settings page offers 3-50 questions with a monthly cost and no statement of the precision each buys, so G20 is a decision made blind | Medium (it is the decision that governs the whole area) | `app/web` monitor settings, `app/shared/src/ai-visibility.ts` | print the achievable 95% half-width at each panel size and cadence from the engine's own measured sample; every input exists | open — in reach, ~S |
| B8-8 | **A per-engine change is still untested.** "X no longer cites any of your pages" fires on `cited > 0` then `cited === 0` regardless of that engine's own sample — 6 Gemini answers is not evidence it stopped citing you | Medium | `v5/code/AI_Metrics.js` | run the same `changeOf` per engine with its own sample, and say "too few answers from this engine to tell" below the floor | open — in reach, ~S |
| B8-9 | **Nine alert rules fire weekly on one sample with no multiple-comparison correction.** At 95% each, a quiet week raises a false alert often. No leader corrects for this either, which is exactly where to be ahead | Medium | `v5/code/AI_Metrics.js`, `v5/code/Pulse_Metrics.js` | a Holm or Benjamini-Hochberg adjustment across the tested alerts of one run, with the adjusted threshold stated | open — in reach, ~S–M |
| B8-10 | **Brand recognition is a 2-of-5 majority rule raised as an alert.** `brand.known * 2 >= brand.answered` over at most 6 engines, with no interval, fires "Only N of M AI assistants recognise …" | Low–Medium | `v5/code/AI_Metrics.js` | report it as a count with its denominator and no verdict, or give it the same Wilson treatment as every other rate | open — in reach, ~S |
| B8-11 | **The panel is 8 questions on techand.ai and 20 by default** against Semrush 25, Ahrefs Advanced 20 and Profound's custom enterprise panels. Profound's own 2,000-portfolio simulation found panel composition matters more than resampling, and Evertune's table shows a per-topic answer is out of reach at 8 at any sampling rate | **High** for the area's ceiling | settings (`ai_prompts_max`) | 8 → 20 is +$5.08 / site / month, 50 is +$17.78 | open (**owner — this is G20**) |
| B8-12 | **Copilot is opt-in and off.** $0.002 a question, but Bing showed a summary in 0 of 10 live checks (2026-10-10), so most answers are "no summary" rather than data | Low | settings (`ai_engines`) | ≈ $1.20 / site / month at 20 questions (a pulse engine, ~30 asks a month each); worth it only if Copilot's summary rate rises | open (owner, per site) |

**Area 11 — link building** (`../system-review-2026-10-14/BENCH_AREA11_link_building.md`, ~75 URLs opened, build section 83, S93,
harness 5101). **The market moved under the rubric.** **Respona has pivoted out of outreach software** into pay-per-placement guest
posts priced by the host's Ahrefs DR, offering exact-match anchors with no mention of `rel="sponsored"` anywhere — which is link spam
by Google's own rules; **Postaga answers 404**; **Semrush has withdrawn its Link Building Tool docs**. **Pitchbox is the only valid
mechanism benchmark left**, and the comparison is now partly a compliance one, where refusing is the feature.

- **B11-2: a won link was proven once, at the reply, and never re-read** — and a page no crawler indexes never enters the ledger at
  all, so the Backlink Monitor never reached it either. A won link is re-read weekly now: one miss is `at_risk`, two are `lost`, and
  a bot wall is "not checked" and never advances the miss count.
- **B11-1: rates were printed off any sample** — 33.3% off three sends, a red "50.0% bounced" off two — beside a subject-line test
  that correctly refuses a verdict under 30. Floors are derived now.
- **B11-3: the postal address was on the first e-mail only.** CAN-SPAM is **per message**, at $53,088 each.
- **B11-4: SPF and DKIM were read once at connect and gated nothing.**

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B11-1 | **Every outreach rate was printed from whatever sample existed.** A reply rate of 33.3% off one reply in three, a win rate off one contacted site, and a red warning badge reading "50.0% bounced" off one bounce in two e-mails — the badge fires above 2%, so the first bounce in a new account raised a deliverability alarm that could not mean anything. All of it on the same screen as `subjectAbStats`, which refuses to name a better subject under 30 first e-mails per style: the discipline existed in one corner of the page and nowhere else. The bounce rate was also counted over conversations, not e-mails, which is not the denominator the 2% limit is defined on. Published reply rates differ by **6×** on denominator alone (Hunter 4.5% per e-mail, 31M; Smartlead 0.74% median per sender, 850M) | **High** (INVARIANTS rule 1; 4C.5) | `app/shared/src/outreach.ts`, `app/server/src/services/linkBuilder.ts`, `app/web/src/pages/site/LinkBuildingPage.tsx` | `outreachRate()` with derived floors — bounce **50** (one bounce in 50 *is* 2%, the limit it is judged against), reply **20** (the smallest list size the published data separates), win **25**, with Hunter's 1.3% prospect-to-backlink funnel printed beside it. Under the floor the percentage is `null` and the counts show with how many more are needed; the bounce rate counts e-mails sent | fixed 2026-10-15 (app, 5 new shared tests); not deployed |
| B11-2 | **A link won through outreach was proven once and never looked at again.** The Reply Reader fetched the page a reply named, found the link, set the prospect `won` — and nothing read that page again. A page no crawler indexes never enters `seo_backlinks`, so the Backlink Monitor's weekly re-check never reached it: the link the customer worked hardest for was the one link nobody verified twice, while "Links won" counted it for ever. Pitchbox re-checks the top 100 monthly; Respona asks the customer to notice; about a third of monitored links are gone within a year (Linkody, 865,000 links, June 2026) | **High** (4C.7, INVARIANTS rule 4) | `v5/code/LB_Page_Requests.js`, `LB_Assemble.js`, `LB_Report.js`; build §83 | `LB Page Requests` queues every won link the ledger does not carry (12 a run, oldest first, free GETs, never a page the monitor already fetches); `LB Assemble` verifies with `LK.verify` and runs the state machine — found → `live` and the miss count resets; missing/gone → a miss, **one** is `at_risk` and never a loss, **two in a row** are `lost`; blocked / JS-only / fetch error → `not_checked` with the miss count **untouched** (rule 3). Only a proven loss takes the prospect off `won`. The reading rides `checks_json`: no new column, nothing to sync. The report prints the four states apart, states the refusal rule, and puts the decay base rate beside a loss | fixed 2026-10-15 (build section 83, S93); not deployed |
| B11-3 | **The postal address went out on the first e-mail only**, so two of every three e-mails in a sequence would carry none — and a server test asserted that absence, so it was deliberate. CAN-SPAM's requirements are written per **message** ("Your message must include your valid physical postal address"), and "Each separate email in violation of the CAN-SPAM Act is subject to penalties of up to $53,088" (FTC; the figure is frozen for 2026 by the FTC notice of 15 Sept 2026) | Medium (4C.6) | `app/shared/src/outreach.ts` `footerLines` | the address rides every message; the GDPR Art. 14 source line stays first-contact-only, where Art. 14(3)(b) puts it. Both tests rewritten with the reason | fixed 2026-10-15 (app); not deployed |
| B11-4 | **SPF / DKIM / DMARC were a gate on the way in and nothing on the way out.** `dnsCheck` ran when a mailbox was connected, edited or manually tested; the answer was stored on the row, never read again, and **gated nothing at all** — a DMARC record removed or a domain moved left the mailbox sending behind a green tick from months earlier. Pitchbox monitors exactly this continuously ("all active email accounts are automatically monitored by MXRight"), and Google asks SPF **or** DKIM of *every* sender, with enforcement ramping from November 2025 | Medium (4C.6, INVARIANTS rule 2) | `app/server/src/services/mail.ts`, `outreachJobs.ts`, `linkBuilder.ts` | `mailAuthGate` re-reads the record when the stored one is over 7 days old and persists it; a From domain publishing **neither SPF nor DKIM** cannot START a conversation (follow-ups in open threads always go, and a weak SPF or missing DMARC is a note, never a refusal — DKIM is found by guessing selectors, so "unknown" alone proves nothing). The mailbox pauses with the reason; `canSend` says the same thing before anyone approves | fixed 2026-10-15 (app, 5 new server tests); not deployed |
| B11-5 | **Cost per link is promised by `LINK_BUILDER_SPEC.md` §3 and computed by nobody.** The Link Builder's ledger settle passes `measured=''`, so its DataForSEO figure is the $0.05 reservation rather than the cost of the tasks it sent (`RESULTS.md` §4 for exec 561) | Low | `build_monitors.py` §5 `L.run_ledger`, `LB_Assemble.js` | sum the `cost` of this site's own DFS tasks in `LB Assemble` and pass it as the settle's `measured` node; divide by links won over the period, refusing under a floor as B11-1 does | **open** (in reach, ~S — it is the cost pipeline area 13 owns this week) |
| B11-6 | **Sole traders are treated as individuals under PECR and our consent gate has no notion of them**, so a one-person UK consultancy is e-mailed as a corporate subscriber. The ICO: "Sole traders and some partnerships are treated as individuals" | Low (4C.6) | `app/shared/src/outreach.ts` `consentGate` | a data question before a code one — a signal in the site model for "this prospect is a person trading as a business"; until it exists, say so in the UI rather than implying the gate covers it | **open** (~S) |
| B11-7 | **The warm-up ramps on the calendar alone.** Hunter's steps up only when the previous day's limit was reached *and* the bounce rate stays under a safety threshold; ours is 5 / 10 / 30 by week whatever the bounces do | Low (4C.5) | `app/shared/src/outreach.ts` `warmupCap` | feed B11-1's bounce rate into the cap and hold the ramp while it is above the limit | **open** (~S, now unblocked) |
| B11-8 | **Saudi Arabia may need more than a consent tick.** PDPL Art. 25 requires "the prior consent of the targeted recipient"; **Art. 26 additionally requires marketing data to be "collected directly from the Data Subject"** — which a scraped address is not. SDAIA's draft amendments were out for consultation 6 Oct – 5 Nov 2026 and would require evidence of consent to be retained | Medium | consent defaults | legal review of whether a tick can cure a scraped address in KSA at all, or whether the country should be off by default | **owner decision** |
| B11-9 | **The UAE default is stricter than any text that could be read.** No official English PDPL text is published on the government portal (the legislation portal answers 403), and DLA Piper (Jan 2025) says there are "no general laws in the UAE law covering electronic marketing". Our gate asks for a consent tick for named people anyway. Whether the Executive Regulations have been issued **could not be established**: 2026 sources conflict and none cites a gazette reference | Low | consent defaults | keep the conservative default, record in the UI that it is ours and not a cited rule, and revisit when the Regulations are published | **owner decision** |
| B11-10 | **Microsoft 365 SMTP basic auth: the spec's "end of December 2026" is correct, and now confirmed first-hand.** Microsoft's revised timeline (27 Jan 2026): unchanged until then; **disabled by default for existing tenants end of December 2026**; unavailable for new tenants after; final removal announced in H2 2027. The Azure OAuth app (`MS_OAUTH_CLIENT_ID` / `_SECRET` / `_TENANT`) is the mitigation and is still unset in `app/.env` | Low | `app/.env` | a diary date: set the Azure app before December 2026, or Microsoft 365 app-password mailboxes stop | **owner decision** |

**Area 7 — site tracking** (`../system-review-2026-10-14/BENCH_AREA7_site_tracking.md`, build section 80, S90, harness 5146).

- **B7-1 (High): the change test was named in every weekly callback and never run.** Since G12 the Site Tracker has shipped
  `change_method` — the *method* of a control-group change test — while `CT.compare` was called only by the Link Builder. A method
  described to the customer and never run is rule 4 inside criterion 3.4. Each dated change now buys its own two 28-day windows (the
  report's 28-v-28 both sat *after* an older change), the control group is every other page from the same free request, clicks are
  judged by rate ratio with the control's own noise in the 95% range, position by `CT.compare`, with five refusals.
- **B7-2: every Search Console request was `type: web` only, since v4.3** — device and country are **free** first-party dimensions we
  simply never asked for. Added, with "answered with no rows" (a measured zero) kept apart from "did not answer" (unavailable).
- **B7-3: cannibalisation** is computed from query-by-page rows we have read since G9 **and thrown away since G9**.
- **What B6-4 actually cost, now confirmed**: the 2026-10-13 report's sentence *"The September 2026 core update ran 15-30
  September"* came from the invented registry entry. It was the September **spam** update, 24 September to 7 October. The registry
  is correct now (11 updates, re-read from Google's Search Status dashboard).
- **The leader contradicts itself**: SEOTesting's changelog (2026-02-17) claims statistical significance in split tests while its own
  support article says it refuses to compute one. Recorded, not relied on. And annotations were **not** this area's gap — Google
  shipped custom annotations in Search Console in November 2025 and G12 gave us ours; the gap was the **test**.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B7-1 | **The Site Tracker published the method of a test it never ran.** Since G12 it has inlined the change-test kit and shipped `CT.method` as `change_method` in every weekly callback — "each change is dated and read against a control group" — while `CT.compare` was called only by the Link Builder. Criterion 3.4 ("control group or counterfactual") is capped at 3 for links only, and the weekly report could not tell the owner whether a published page did anything. The report's own 28-v-28 cannot test an older change: both periods sit after it | **High** (INVARIANTS rule 4, in the criterion that scores impact measurement) | `v5/code/Site_Plan.js`, `GSC_Requests.js`, `Parse_GSC.js`, `_site_stats.js`, `Site_Metrics.js`, `Site_Report.js` | every dated change gets its own two windows (28 complete days after, 28 before) bought as two free whole-site page requests, so the page and the control group of every other page are measured on the same days; clicks judged with `ST.lift` (rate ratio, 95% range carrying the control group's own noise, expectation labelled modelled), position with `CT.compare`; five refusals; a Google update inside the window named, not refused | fixed 2026-10-15 (build section 80, S90); not deployed |
| B7-2 | **Search Console was asked for `type: web` and nothing else.** `device` and `country` are first-party dimensions of the same free endpoint; Looker Studio exposes both and SEOTesting filters dashboards by country. A site whose phone clicks halved while desktop held read as one flat site-wide figure | Medium–High | `v5/code/GSC_Requests.js`, `Parse_GSC.js`, `Site_Metrics.js`, `Site_Report.js` | four small free requests; each device and country tested with `ST.change`; share-of-clicks column, report table and an alert when one device falls alone; a split Google did not answer is unavailable, one it answered with no rows is a measured zero | fixed 2026-10-15 (build section 80, S90); not deployed |
| B7-3 | **No cannibalisation check** (criterion 2.10 names it; SEOTesting ships a report and Semrush a tab) although the query × page rows have been read in full since G9 and the second page thrown away | Medium | `v5/code/Parse_GSC.js`, `Site_Metrics.js`, `Site_Report.js` | a non-brand search of ≥ 50 impressions with a second page holding ≥ 10% of them, with each page's share and position, the page Google prefers and the page that ranks better when shown; brand and scraper queries excluded; one action that merges or differentiates and never asks for a third page | fixed 2026-10-15 (build section 80, S90); not deployed |
| B7-4 | **Discover and Google News are invisible.** Looker Studio's URL Impression table reads `discover` and `googleNews`; we request `type: 'web'` only, so a property with Discover traffic sees none of it | Medium for publishers, none for most B2B sites | `v5/code/GSC_Requests.js` / `Parse_GSC.js` | request the extra search types where the property has them and refuse with "this property has no Discover data" where it does not — never an empty section | open — in reach, ~S–M |
| B7-5 | **No content groups.** SEOTesting analyses Search Console performance by page or query group built with RegEx filters; a 500-page site cannot ask us "how is the blog doing against the service pages" | Medium | `v5/code/Parse_GSC.js` / `Site_Metrics.js` + the app | one regex per group over the page rows already read, reported and tested as a group with the same statistical bar | open — in reach, ~M |
| B7-6 | **Brand lives in two reports.** SEOTesting's Brand Signals puts branded Search Console clicks, GA4 direct sessions and LLM referral sessions on one chart; we compute all three and show them in two different products | Low–Medium | `v5/code/Site_Metrics.js` / `Site_Report.js` | one series set in the weekly report, with each line's own source and basis | open — in reach, ~S |
| B7-7 | **Search Console's own annotations cannot be read** (there is no annotations API — verified against the API reference), and nothing says so; meanwhile the owner's own dated notes (`seo_console_checkins.notes`, "I published a page") are not chart marks | Low | `v5/code/_annotations.js` / `Site_Metrics.js` | the owner's dated notes become marks; the report says once that Search Console's own annotations stay in Search Console | open — in reach, ~S |
| B7-8 | **The last three days are never shown.** The report reads `dataState: final` ending 3 days back, which is right for a judgement and wrong for "did the fix land"; Search Console serves preliminary data (`dataState: all`, and an `hour` dimension with `hourly_all`) and SEOTesting mails daily on every update | Low–Medium | `v5/code/GSC_Requests.js` / `Site_Report.js` | a short "since the report window" line using preliminary data, labelled in Google's own words ("still being collected and might change"), never mixed into the tested figures | open — in reach, ~S |
| B7-9 | **No bulk export to BigQuery** (criterion 2.7's "all rows (paged API or BigQuery), own archive beyond 16 months"). We page to 100,000 rows a kind and keep our own summaries; the export has no row cap and keeps data for ever | Low for sites of this size | the app + a Google Cloud project | offer it per site; it is a Google Cloud bill ("there is a free usage level") and a partition-expiry decision | open (owner, money) |
| B7-10 | **A split test the owner designs** (two comparable groups of pages, one change applied to one of them) — SEOTesting's core product, and the engine half of it is the kit built today | Medium | the app + `_site_stats.js` | a page to pick the groups, a rule that refuses a test whose groups are not comparable (the leader's own exclusions: anomalous pages, pages with no clicks on most days), and the same refusals as B7-1 | open (owner, product) |

**Area 9 — AI growth** (`../system-review-2026-10-14/BENCH_AREA9_ai_growth.md`, build section 82, S92, harness 5191). **This
completes the benchmark programme: 13 of 13 areas.** Nothing was missing here; what was wrong is that **six claims the engine made
were unsupported by its own data**.

- **B9-1: the report told customers a Bing submission reaches ChatGPT search.** OpenAI's own crawler documentation names
  OAI-SearchBot and **never mentions Bing**. The wording is sourced now, and the build fails if the phrase returns — it caught two
  live instances.
- **B9-2: 16, then 2, then 0 pages were submitted over three weeks** (2026-10-10, exec 574, exec 511) **and no run ever asked what
  became of them.** A 45-day GetUrlInfo follow-up now measures "since crawled", or says not available with the reason.
- **B9-3: "can AI read and quote this page" was answered by a Chrome User-Agent with robots.txt never read** — the score averaged
  77/100 in exec 574. robots.txt is read first now, per page, for six answer fetchers: no score when all are blocked, and no
  submission either. The build proves the gate by deleting the node.
- **B9-4: a win was one observation, and once won could never be lost.** It needs two naming answers with the count printed, and
  losing it returns the question to the queue with an alert.
- **The rubric's leader name is two generations stale**: "Profound Actions" (2025-07-10) was a *brief generator* whose own page said
  "We don't generate content for you"; the acting product since **2026-07-02** is **Aim + Agents + AI Marketer**, which drafts and
  **stages in the CMS** while keeping every approval with the marketer. AthenaHQ is alive at $295/mo and publishes only through the
  customer's own Shopify / Webflow / Framer.

| ID | Title | Impact | Where | Fix | Status |
|---|---|---|---|---|---|
| B9-1 | **The weekly report told customers a Bing submission reaches ChatGPT search** ("N page(s) sent to Bing (ChatGPT search, Copilot)", in the report, two node comments and the sticky). OpenAI's own crawler documentation says OAI-SearchBot surfaces pages in ChatGPT search and never mentions Bing; IndexNow's FAQ says a submission "does not guarantee immediate indexing" and lists six engines, Google not among them | **High** (a claim a customer plans around, with no source behind it) | `v5/code/Growth_Report.js`, `Growth_Metrics.js`, `Growth_Plan.js`, `Growth_Bing_Submit.js`, `Growth_IndexNow_Submit.js`, `build_monitors.py` sticky | say Bing and Microsoft Copilot for Bing's index, list IndexNow's engines, quote the no-guarantee sentence, and never call a notification an indexing; the build fails if the phrase returns | fixed 2026-10-15 (build section 82, S92); not deployed |
| B9-2 | **No run ever asked what became of a submitted page.** 16 pages were sent on 2026-10-10, 2 in exec 574, 0 in exec 511, and `GetUrlInfo` — free, already called for the readiness rotation — was never asked about any of them. "Pages sent" was the headline of a week's work with no outcome behind it | **High** (INVARIANTS rule 4: nothing exists until it is delivered) | `v5/code/Growth_Plan.js`, `Growth_Bing_Requests.js`, `Growth_Metrics.js`, `Growth_Report.js` | a 45-day follow-up list; `GetUrlInfo` for each, carrying why; the report states submitted / since crawled / still waiting with days / not asked, or "not available" with the reason; the run row keeps it | fixed 2026-10-15 (build section 82, S92); not deployed |
| B9-3 | **"Can AI read and quote this page?" was answered by a browser.** The key pages were fetched with a Chrome User-Agent and robots.txt was never read on this path, so a page every AI fetcher is forbidden to touch could score 90/100 (exec 574's average of 77 was computed this way) and be submitted to Bing and IndexNow on top | **High** (the area's headline figure, measured without its main input) | `v5/code/Growth_Robots_Requests.js` + `Growth_Robots.js` (new), `AI_Readiness.js`, `Growth_Bing_Submit.js`, `Growth_IndexNow_Submit.js`, `Growth_Metrics.js`, `Growth_Report.js`, `build_monitors.py` | robots.txt read first and matched per page for the six answer fetchers; no score when all are blocked (the rule quoted, a high alert, no submission), capped at 60 when some are; unreadable robots.txt is "not checked"; the build proves the node is on the main path by deleting it | fixed 2026-10-15 (build section 82, S92); not deployed |
| B9-4 | **A win was one observation, and once won it could never be lost.** A target became `won` because its question was absent from the latest gap list — which also covers a question nobody asked — and a stored `won` row survived the question being lost again, because the status expression preferred the stored value. Not one win has ever been recorded, so no customer saw it; the next one would have been unfalsifiable | **High** (4A.9's own subject) | `v5/code/Growth_Plan.js`, `Growth_Metrics.js`, `Growth_Report.js` | a win needs ≥ 2 naming answers of the last 8 days (weekly + pulse), with the count and engines in the reason, the report and the alert; a question lost again returns to the queue with both dates and a medium alert; "not asked" is its own reason | fixed 2026-10-15 (build section 82, S92); not deployed |
| B9-5 | **The refresh queue had no decay in it.** Refreshes were chosen by age (90 days) and by our own readiness score, while the leader's queue is "pages with declining citations" — and every weekly run's cited pages are already stored | Medium | `v5/code/Growth_Plan.js`, `Growth_Metrics.js` | a page cited in earlier weekly checks and in neither of the last two is raised with the counts and the date it was last cited; silent under three stored runs | fixed 2026-10-15 (build section 82, S92); not deployed |
| B9-6 | **`writing` was a promise nobody kept.** The Content Cadence marks an AI target `writing` and stamps `written_at` when it *starts* a page run; nothing ever sets `written`; and a refused or failed run leaves the row claiming work in progress for ever, so the question is never queued again — R1's class in the one table R1 did not cover | Medium–High | read path: `v5/code/Growth_Plan.js`, `Growth_Metrics.js` (done). **Write path: `build_site_tracker.py` *Mark AI Target Writing* / the cadence's refusal branch — area 4, open** | the read path believes a `writing` row only against a `seo_content_log` row for the same `request_id` that says written or published; after 14 days without one the question is queued again with the reason and a medium alert | read half fixed 2026-10-15 (build section 82, S92); **write half open (area 4)** |
| B9-7 | **A wrong claim about the business triggers no action.** Area 8 records `accuracy_issues` and the perception data; AI Growth, which already fetches the exact third-party pages the answers cited, does nothing with them. Profound traces inaccurate claims to the publisher, drafts a correction and tracks which were updated; Gartner's 2026 guide calls accuracy checks mandatory | Medium–High | `v5/code/Growth_Plan.js` (read `seo_ai_visibility.perception_json`), `Earned_Media.js` | raise a correction target per wrong claim: the claim, the true fact from the profile, and the cited pages that carry it — drafted by the Link Builder's one writer, never sent, and nothing claimed that the facts on file do not carry | open — in reach, ~M |
| B9-8 | **Readiness still fetches as a browser.** robots.txt may allow what a CDN refuses: the AI Visibility Tracker compares a browser fetch with each AI fetcher on the **homepage only**, and the key pages of this workflow are never fetched that way | Medium | `build_monitors.py` (AI Growth), `AI_Readiness.js` | fetch each key page a second time as the answer fetchers (the site is the customer's own, and area 8 already does it for the homepage); a page that answers a browser and refuses the fetchers is a high finding, not a score | open — in reach, ~S–M |
| B9-9 | **Two copies of the robots.txt matcher** — `AI_Access.js` (area 8) and `Growth_Robots.js` (this pass; area 8's file was out of this agent's scope). Two copies of a rule is how two answers start | Low | `v5/code/_ai_access_kit.js` (new), both callers | one kit, inlined in both, with the parser, the group selection and the longest-rule match in a single place | open — in reach, ~S |
| B9-10 | **Bing's own AI citation data is never mentioned to the owner.** AI Performance (public preview 11 Feb 2026) and its Topics Portfolio beta (13 Oct 2026) give real Copilot citations, grounding queries and "opportunity queries where other sites appear but yours does not", free, in the Bing account we already read — and the documented Webmaster API returns none of it | Low–Medium | `v5/code/Growth_Report.js` | name the report and what it shows, beside our own modelled question list, with the honest line that no API returns it | open — in reach, ~S |
| B9-11 | **The IndexNow key file is still missing** (O6, open since 2026-10-10): a key has been issued three times and nothing has ever been sent through IndexNow | Medium | the owner's web server | upload `https://www.techand.ai/<key>.txt`; the app's "Check the file" verifies it in one click | open (owner) |
| B9-12 | **`ai_pages_month` is 2 against a queue of 6 questions**, so at today's rate the queue takes three months to clear; each page is ≈ $1.20 | Medium | `seo_monitors.ai_pages_month` per site | an owner decision per site, with the cost stated — not a code change | open (owner) |

**A process defect this batch found (B-P1).** `isolation: "worktree"` cut both agents' worktrees from `edca460` — the last merge to
`main` — which is **47 commits behind** the branch tip: no build sections 55–66, no S67–S74, and `docs/system-review-2026-10-14/` did
not exist, so the brief's own required reading was missing. Both agents detected it independently and merged the tip before starting,
and both were verified afterwards to contain it. **Every future agent brief must open by merging the branch tip and proving it
(`git merge-base --is-ancestor <tip> HEAD`)**, and the orchestrator must check each worktree's base before trusting a report.

### 3.6 Cross-check: nothing from the inputs is lost

| SCORECARD fix | Register items | | SCORECARD fix | Register items |
|---|---|---|---|---|
| F1 Guards | D1 | | F18 FAQPage | G2 |
| F2 PBN as best links | D3 | | F19 Timelines | G3 |
| F3 Audit diff | D2 | | F20 Claim checks | G4 |
| F4 Fit gate | D4, D8, D22 | | F21 Originality | G5 |
| F5 Page inventory | D11, D5 (+ G19) | | F22 Tracker depth | G6 |
| F6 Publishable page | D10 | | F23 CWV | G7 |
| F7 False positives | D6, D18 | | F24 Discovery inputs | G8 |
| F8 robots fix | D17 | | F25 GSC depth | G9 |
| F9 Reply facts | D14 | | F26 Panel and facts | G10, O8, O1 |
| F10 Next step | D16 | | F27 Watch and verify | G11 |
| F11 Canonical host | D15 (+ G19) | | F28 Annotations, change tests | G12 |
| F12 RDAP | D7 | | F29 CMS push | G13 |
| F13 AI errors | D19 | | F30 Render diff | G14 |
| F14 Small inconsistencies | D20, D21, D24, D26 | | F31 Sharing | G15 |
| F15 One outreach writer | D12, D13 (+ L2) | | F32 Live sending | G16, O4, L4 |
| F16 Operations | D25a, D25b, D25c, O5 | | F33 Calibration | G17 |
| F17 Retries | G1, D19, D23 | | "To reach 9" #1–#6 | §5.2 (3+ sites), G18, G19, G20 / G6 / G7 / G11 / G12 / G5 / G15, G21 + D25a, G17 |

Live defects D1–D26 all appear in §3.1. RESULTS findings without a D-number are covered too: the critic's "invented" stages (D22, as
SCORECARD C3 assigns it), the weak source and `srsltid` (G4), cut titles (G22), the IndexNow file (O6), FAQPage (G2), the Claude spend
range (G23) and the owner items (O1–O3, O9–O11). Criterion rows with a stated gap and no F-number became G7 / G24–G33.

## 4. Phases

Planning basis: S ≈ 1.5 h, M ≈ 6 h, L = 2–3 sessions. A session is about 4–8 h. Each phase is a theme and may take several sessions.
Do the sessions in order: within a session, the items are listed in working order.

### Phase 1 — Correctness: wrong advice, wrong numbers, guards (4 sessions, 14 items)

| Session | Items (in order) | Notes / dependencies |
|---|---|---|
| 1A Guards and cost | D1, D7 | D1 needs a new Data Table (`ladder_common.py` + `sync_tables.py`). |
| 1B Audit correctness | D2, D6, D18, D17, D24 | All audit-side, all with harness fixtures from exec 354 / 370 / 385. |
| 1C Backlink and reply trust | D3, D14 | D3 before any impact claims are shown; D14 is the interim fix, and L2 completes it. |
| 1D Keyword and ladder advice | D4, D8, D16, D26, G3 | D4's fit gate first; D8 reuses it. |

Live checks afterwards: §5.1, Phase 1. **Done 2026-10-12** (`LIVE_CHECK_phase1_2026-10-12.md`, ≈ $1.9): 12 of 14 pass, D24 partial, D7 via the cache; new P1-1 … P1-5 (§3.7).

### Phase 2 — Shared site model and content quality (6 sessions, 9 items)

| Session | Items | Notes / dependencies |
|---|---|---|
| 2A Site model | G19 | New columns / table and the `_site_model.js` kit; resolver in the Site Tracker and the main workflow. |
| 2B Hosts and the written-page log | D15, D5 | D15 needs G19. D5 changes `Cadence_Plan.js` and `cadence.ts` together. |
| 2C Site description and hub links | D22, D9 | D22 feeds G19's services. |
| 2D Page inventory | D11 | Needs G19. Unlocks G8, and G5's own-page comparison. |
| 2E Publishable page | D10, G2 | Needs G19; the live check needs O1 / O2 (code can ship before). |
| 2F Claim checks | G4 | |

**Phase 2 live checks done 2026-10-12** (`LIVE_CHECK_phase2_2026-10-12.md`, ≈ $0.95): 7 of 9 pass; D22 reopened and D11's verdict path open; new P2-1 … P2-7 (§3.8).

### Phase 3 — Audit and tracking quality (3 sessions, 8 items)

| Session | Items | Notes / dependencies |
|---|---|---|
| 3A Small fixes | D20, D21, G9, G24, G28 | D20 needs D4; G9 shares the operator-query filter with D24. |
| 3B Speed and priority | G7, G26 | G7 needs the CrUX API enabled for the PageSpeed key's project. |
| 3C Measured accuracy | G18 | Needs D6 / D18 fixed first; label techand.ai + 2 other sites. |

### Phase 4 — Backlinks, AI and Link Builder quality (3 sessions, 9 items)

| Session | Items | Notes / dependencies |
|---|---|---|
| 4A Retries and AI data | G1, D19, D23, G22, G10 | G1 first (D19 / D23 are its live cases); G10's live check needs O1–O3. |
| 4B One outreach writer | D13, D12 | D13 first; D12 hands AI Growth's prospects to it. Both need G19 / D15. |
| 4C Outreach safety | L2, L1 | L2 extends D14's claim check to every draft. |

### Phase 5 — Feature depth (backlog in this order, about 22 sessions, 22 items)

| # | Item | Effort | Depends |
|---|---|---|---|
| 1 | G6 Rank tracker depth (SERP features, AI Overview, competitors, mobile) | M | — |
| 2 | G8 Discovery inputs | M | D11 |
| 3 | G11 Watch and verify | M | — |
| 4 | G25 URL Inspection coverage | M | — |
| 5 | G5 Originality check | M | D11 |
| 6 | G32 Topic radius block + re-plan | M | — |
| 7 | G12 Annotations and change tests | L | D5 (publish dates) |
| 8 | G13 CMS push | M | owner's CMS choice |
| 9 | G15 Share links + L3 Link Builder PDF | M + S | — |
| 10 | G16 First live send + L7 subject A/B | S + S | O4, L1, L2 |
| 11 | L4 OAuth mailboxes | L | O4 |
| 12 | L5 Podcasts / digests | M | O4 |
| 13 | L6 Linkable-asset ideas + G33 coverage target | M + S | — |
| 14 | G14 Render diff | M | — |
| 15 | G29 Lineage | M | — |
| 16 | G20 100+ prompt panel | M | O8 |
| 17 | G30 Images | M | — |
| 18 | G31 Style guide | M | — |
| 19 | G27 Pre-release check | L | G11 |
| later | G17 Calibration | L | ≥ 20 published pages with ≥ 3 months of data |

### Phase 6 — Operations (about 5 sessions, 5 items)

| Session | Items | Notes / dependencies |
|---|---|---|
| 6A Alerts and test data | D25c, D25b | Cheap, and it removes silent failures: worth pulling forward right after Phase 1 if the owner agrees. D25c needs the owner's OK; then O5. |
| 6B–6C Always-on host | D25a | Production overlay (Postgres, Redis queue mode, workers), TLS host, `CALLBACK_BASE_URL`, missed-run catch-up. D1's reservation can then move to Postgres. |
| 6D Delivery rate | G21 | Needs D25a. |
| 6E Claude cost | G23 | Needs one Anthropic Console usage export from the owner. |

**Owner track (in parallel, no code):** O12 before any paid check; O1, O2 and O3 before Phase 2's live checks; O5 after D25c; O4 before
G16 / L4 / L5; O6, O7, O8, O9, O10 and O11 any time.

**Totals:** Phases 1–4 + 6A ≈ 17 sessions (the F1–F17 set that SCORECARD says leads to about 7). Phase 5 ≈ 22 sessions. Phase 6 (rest) ≈ 4.

## 5. Re-rating protocol

### 5.1 Live checks after each phase (owner approval first)

| After | Runs (RESULTS §1 numbering) | Cost (≈) | Look for |
|---|---|---|---|
| Phase 1 | 8 parallel `describe`; technical audit (8), full report (14), Audit Scheduler on demand (21); backlinks full (13); Reply Reader ×4 (11); verdict (4); ladder for a **new** head keyword (6); Rank Tracker (18) | $2.0–2.5 | D1 ledger count 8; D2 same-type diff; no www / theme-color findings; robots keeps Disallows; WHOIS $0 (D7); no navigational gap; PBN cluster flagged; no invented facts; no brand rung; right next steps; AI Overview "seen …" |
| Phase 2 | `describe` + Keyword Check ×3 (3, 5); ladder + main page (6, 7) on a keyword that has a live page and on one that has none; Content Cadence dry run (19); Site Tracker (20) | ≈ $1.2 | Services incl. Business Central; `improve` for the existing page; ≤ 5 placeholders, Tech& NAP, length within ±25% of the verdict; links only to live pages on www; pile-up counts every written page |
| Phase 3 | technical audit + full report (8, 14); Site Tracker (20); discover + follow-up (9, 10) | ≈ $1.5 | CrUX per template; coverage figure; priority order; no sparse %; paged Search Console rows; ladder overlap flagged |
| Phase 4 **(done 2026-10-12 with Phase 3, ≈ $2.49: see `LIVE_CHECK_phase34_2026-10-12.md`)** | `ai_visibility` (12), AI Pulse (16), AI Growth (17), backlinks full (13), Link Builder paid (15), Reply Reader ×4 (11) | ≈ $1.5 | AI error rate < 5%; no heading brands; one writer; no .gov / competitor / homepage pitches; "Tech&"; draft gate verdicts; sibling / off-topic prospects gone |
| Phase 6 | one week of schedules; a forced failure with SMTP off; the delivery report | $0.1/day (pulse) | Every schedule fired; alert reached the second channel |

Record each check in a short dated note in this folder (or the next review folder) and update the item statuses.

### 5.2 Whole-system re-rating

**When:** after Phases 1–4 and session 6A (first re-rating), then after Phase 6 and the main Phase 5 items (second).

**What to run:** the 21 runs of `RESULTS.md` §1, in the same order and with the same inputs where they still make sense:
- Site Admin `monitors`; `describe`; `verdict` "e invoicing software uae"; Keyword Check ×3 ("erp software uae", "business central partner
  uae", "dynamics 365 partner uae").
- A ladder plus its main page. Use a **new** head keyword: "erp software uae" already has a ladder, so a repeat would test the duplicate
  refusal, not the plan.
- Technical audit (200 pages); discover with its follow-up keyword report; Reply Reader ×4 synthetic replies.
- `ai_visibility`; backlinks full; full SEO report; Link Builder (paid); AI Pulse; AI Growth; Rank Tracker; Content Cadence dry run; Site
  Tracker; Audit Scheduler.

Monitors start through the Test Runner, which is deactivated again afterwards. Add what RESULTS could not run, where it is now possible:
- `published` for a page that is really live;
- the October check-in, answered by the owner (O5);
- a profile write with real data (O1), then one content run that uses it;
- a second full report (domain-age cache, D7);
- the error path into the test alert channel (after D25b);
- the app UI in an owner session (Playwright, desktop + 390 px).

For "To reach 9" #1, also run the audit, keyword and backlink modes on two more sites the owner names (public data only).

**Rules (same as the baseline):**
- Budget about $4.3 for techand.ai (baseline: DataForSEO $2.69 measured, Claude ≈ $1.6–3.0) and a **hard cap of $15** for the whole test,
  with explicit owner approval (O12). Measure the DataForSEO balance from inside the n8n container before and after; never print credentials.
- Send every API run the way the app sends it (`X-Forwarded-For: app:<techand.ai company>`, the company's app callback), so every report
  lands in the app's `reports` table.
- **No real outreach e-mail.** No third party may receive anything; the Reply Reader gets synthetic replies; an approved live send (G16) is
  a separate owner decision, not part of the rating run.
- **No WordPress push.** No `published` row for a page that is not live, and no check-in with invented answers.
- Change no code, workflow or prompt during the run, and create no temporary workflows.
- Save the artefacts to `files/` with third-party contact addresses redacted. Never save the prospects CSV: the repository is public.
- Write `RESULTS.md` in a new folder, `docs/system-review-<date>/`, in the same structure (runs table with execution ids, findings by
  feature, numbered defects, owner items, state left behind).

**Scoring (same rubric):**
- Use the two `CRITERIA_*.md` files of 2026-10-11 unchanged. If a criterion must change, keep the old score next to the new one and say why.
- Use the same scales and area weighting (strong-evidence criteria K1–K3, K8, K10, C2, C3, C14, C15, 4B.4 weigh more; round to the half
  point). Rate capability and correctness, not outcomes; report outcomes (pages ranking, links won, AI mentions) separately.
- Scorer instructions, to give an independent scorer (a fresh session without the fixing context):
  > Score strictly, from evidence only. Every criterion score cites a run number, execution id, file or code location. A criterion that
  > was not exercised live is marked "(NL) not live-verified" and scored only on what code and specs show, never above what the last live
  > evidence supported. A defect seen live caps its criterion at the level the defect shows. Do not credit a fix that the live run did not
  > exercise. Compare with the named leader per area, as in the 2026-10-11 scorecard.
- Write `SCORECARD.md` in the new folder in the same structure.

**Where to record:**
- Fill the **After fixes** and **Re-scored on** columns in §2.
- Add a dated row to §6.
- Set the register status to `verified live` for every item whose acceptance check passed in the run, and reopen any that failed.

## 6. Scores history

| Date | Overall | KW | LAD | CON | CAD | TECH | RANK | SITE | AIV | AIG | BL | LB | REP | OPS | Area mean | Source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-11 | 5 | 5 | 4.5 | 5 | 4.5 | 4 | 3 | 5 | 6.5 | 5 | 5 | 6 | 4.5 | 4 | 4.8 | baseline: `RESULTS.md`, `SCORECARD.md` (this folder) |
| 2026-10-13 | 6 | 6 | 5.5 | 6 | 5.5 | 5 | 6 | 7 | 7 | 6.5 | 7 | 6.5 | 4.5 | 4.5 | 5.92 | first re-rating after Phases 1-4 + 6A + part of Phase 5 (72 items + R1-R9): `../system-review-2026-10-13/RESULTS.md` (21 runs over two passes, $0.91 + $2.88), scored independently in that folder's `SCORECARD.md` |
