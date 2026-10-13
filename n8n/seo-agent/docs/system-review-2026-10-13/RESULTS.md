# Whole-system re-rating — live runs on techand.ai, 2026-10-12 and 2026-10-13

The re-rating run of the protocol in `../system-review-2026-10-11/FIX_PLAN.md` §5.2, after Phases 1–4, session 6A, G6, G7, G18 and
the P34 fixes. Real runs on the owner's site (country United Arab Emirates), **started 20:28:46 UTC and finished 20:42:01 UTC**
(13 min 15 s, 35 executions 481–515). Every API run was sent the way the web app sends it — header `X-Forwarded-For: app:<techand.ai
company>` and techand.ai's own app callback — so every report arrived in the app's `reports` table. The monitors (scheduled
workflows) were started on demand through the Test Runner. No code, workflow or prompt was changed, no temporary workflow was
created, no e-mail went to a third party and no mailbox was connected.

The deployed main workflow at run time had **437 nodes** (every P34 fix, G18-1/G18-2, G7, G26, D25b/c in; G8's three discovery nodes
were built later and are not in these runs — the live workflow was re-imported at 441 nodes on 2026-10-13 06:02 UTC, after the run).

**Spend: $0.91 — far below the $4.3 budget, because two paid runs were refused by the budget guard and three were reused from the
check 1.2 hours earlier.**

| | Amount | How it was measured |
|---|---|---|
| DataForSEO | **$0.5781** | Balance $18.865792 at 2026-10-12 20:28:46 UTC (`files/spend-before.json`) and $18.287684 at 2026-10-13 06:08 UTC, both probed with `appendix/user_data` from inside the n8n container. Nothing but the free Error Handler (exec 516) ran in between. Per step: verdict $0.0221, ladder $0.1162, the two audits $0.09 each, the three keyword checks $0.0761 (each run's own `run_ledger`), AI Pulse $0.084 (its `cost_usd`) — $0.4784 in all; the remaining **$0.0997** belongs to the Rank Tracker, Link Builder and Site Tracker, which report no cost at all (see R9). |
| Claude | **$0.33** | Reported token usage of every `Claude — …` node of the 35 executions (`files/claude-tokens.json`): **80,830 in / 20,496 out**, all Sonnet 5.5 and Haiku 4.5, × the baseline prices (Opus $4/$20, Sonnet $2/$10, Haiku $1/$5 per million). **No streaming Opus node ran** — the only content run was refused — so this figure has no hidden part, unlike the baseline's $1.6–3.0 range (G23). The guard's own estimates for the same runs total $1.07. |

## 0b. The five completion runs of 2026-10-13

**The five runs this window could not do were run a day later, after the engine's own daily budget guard reset.** The guard that
refused `discover` and the ladder's page run counts estimates per day; at **2026-10-13 06:41 UTC the ledger counted $0 of $6 used**,
so the five missing runs — `discover` with its follow-up keyword report, the ladder page the guard had refused, the full SEO report,
`ai_visibility` and a full backlink check — were sent **06:47:51 to 07:18:12 UTC** as **executions 517–529**. Nothing was changed to
make them run: no code, workflow, prompt, limit or table column, and in particular `ai_budget_usd` stays at $6. They went through the
same front door with the same app header and the same company callback, so all six reports landed in the app's `reports` table.
All 13 executions succeeded.

**Their own spend: $2.88** (hard cap $4.00, estimate ≈ $3.4).

| | Amount | How it was measured |
|---|---|---|
| DataForSEO | **$1.8761** | Balance $18.287684 at 06:46:28 UTC and $16.411543 at 07:18:12 UTC, probed with `appendix/user_data` from inside the n8n container before and after every run (`files/spend-2026-10-13.json`); nothing else ran in the window. Per run, by balance delta: `discover` + its keyword report **$0.2773**, the ladder page **$0.0221**, the full SEO report **$0.4094**, `ai_visibility` **$0.7946**, backlinks full **$0.3727**. The runs' own figures agree to the cent for the page and backlinks, and the discover pair matches exactly ($0.2552 + $0.0221); the full report reports $0.4674, **$0.058 above** what the balance moved, and `ai_visibility` reports $0.7866, $0.008 below. |
| Claude | **≈ $1.00** | `files/claude-tokens-2026-10-13.json`. Ten Sonnet 5.5 calls report real usage: **119,060 in / 32,563 out** = $0.564 at the baseline prices (Sonnet $2/$10 per million). The page run's three **Opus 5.5 streaming** nodes (Strategy Brief, Copywriter, Editor) report only `tokenUsageEstimate`, not usage — 27,365 in / 16,426 out ≈ $0.438 at Opus $4/$20 — so **this figure has an estimated part again** (G23), unlike the 2026-10-12 window where no content run happened. |

**Both windows together: $3.79** ($0.91 on 2026-10-12 + $2.88 on 2026-10-13), against the re-rating's $4.3 budget.

The guard never came close this time: the day's six ledger rows total **$2.26 of $6** in estimates, all `done` and settled. The same
rows show how far those estimates are from the money actually spent — `ai_visibility` was reserved at **$0.06** and cost **$0.79**,
backlinks at $0.04 for $0.37, the full report at $0.25 for $0.41, while the written page was reserved at $1.23 and cost about $0.46.
That is R9 measured from the other side: the guard watches an AI estimate, not the spend.

**Headline.** Every run that started finished; there was no failed execution and no bad data in a delivered report. The 2026-10-12
window is dominated by three facts:

- **The guards now work, and they bit.** The new run ledger counts reservations across concurrent runs, so the day's estimate
  ($5.74 of the $6 daily cap, mostly from the earlier Phase 3+4 check) **refused the `discover` run and the ladder's page run**
  (execs 499, 500). That is the D1 fix proven live, but it also means **discovery, the written page and the full SEO report have no
  run of their own in this set**, and `ai_visibility` and `backlinks` were not repeated either (the same evidence as
  `../system-review-2026-10-11/LIVE_CHECK_phase34_2026-10-12.md`, 1.2 h earlier).
- **The wrong-advice defects of 2026-10-11 are gone wherever this run touched them.** Of the 28 D-items, **19 were exercised: 16
  show the fixed behaviour and 3 pass in part**; 9 could not be tested in this window. Of the 20 later live defects (P1, P2, G18,
  P34), 10 are gone, 3 partly, 7 not exercised. The system now shares one site model (canonical host `www.techand.ai`, name "Tech&",
  the real DAFZA address and phone, a 45-page inventory), it tells the owner to *improve the page it already has* instead of writing
  a duplicate, it keeps the site's robots rules, it says when an AI Overview was seen instead of asserting one, and no draft leaves
  the machine without the owner.
- **The remaining weakness is bookkeeping about its own work.** A refused page run leaves the ladder row saying "writing", so three
  features then report a page that does not exist (R1); a finding in a category the audit declares "not assessed" is reported as
  "new" at every audit (R2); one of three keyword checks lost its topic fit to a parser error and shipped anyway (R3); and no ops
  alert has ever actually been delivered (R5, R6).

**Headline of the completion runs (2026-10-13).** The five runs close 15 of the 16 "not exercised" items, and almost everything the
fix plan built for them works in the open: the discovery run now seeds itself from Search Console, clusters keywords by their shared
results page and labels every traffic figure measured or modelled (G8); the written page is compared with the best competitor page
rather than the average (G33), checked for copied passages (G5) and delivered with **three real WebP images** rendered on this
machine (G30); the full report pays nothing for WHOIS (D7), keeps the site's robots rules byte for byte (D17), inspects all 45 key
pages (G25) and refuses to pitch a ministry or a link seller (P34-4); the AI visibility run now says its fact check was **"not
checked"** instead of "no claim was wrong" (P34-3) and names the business "Tech&" (P34-6, on that workflow); the backlink run sets 17
farm links aside, reports no false "lost" and puts the one real link on top (D3, P1-2, G18-1). Six new defects came with them, and
two are serious: the audit raises a **High "pages are not mobile-friendly" finding on every page out of Google's "no data" answer**
(R10), and the **written page ships with 12 placeholders although its own quality gate failed it twice** (R11).

---

## 1. Runs

All times UTC, 2026-10-12. "API" is the front door's webhook execution, "run" the execution that did the work. DataForSEO is each
run's own ledger where it writes one; the three figures marked "≈" are the $0.0997 remainder of the measured balance apportioned by
call count, because those workflows report no cost (R9). Claude is from the token counts (§0).

| # (protocol) | What | Request id | Executions (API → run) | Start–end | Duration | DataForSEO | Claude | Status |
|---|---|---|---|---|---|---|---|---|
| — | Balance before | — | — | 20:28:46 | — | — | — | $18.865792 |
| 1 | Site Admin `monitors` → `link_builder: true` | rr1013-lb-on | 481 → 482 | 20:28:46–20:28:48 | 2 s | 0 | 0 | ok (affected 1) |
| 3 | `describe` | 483 | 483 → 485 | 20:29:20–20:29:53 | 32 s | 0 | 0.012 | completed, 6 pages read, 28 services |
| 4 | `verdict` "e invoicing software uae" | 484 | 484 → 486 | 20:29:21–20:31:57 | 2.6 min | 0.0221 | 0.108 | completed, GO_WITH_CHANGES **52**, `improve` an existing URL |
| 5 | Keyword Check ×3 (`seo-keyword-assess`) | — | 487, 488, 489 | 20:29:49–20:30:13 | 5.2 / 12.9 / 6.3 s | 0.0761 | 0.013 | 200 ×3 (one with `fit: null`, R3) |
| 11 | Reply Reader ×4 (synthetic replies) | — | 490–493 | 20:30:31–20:30:45 | 1.9–5.5 s | 0 | 0.013 | 200 ×4, all four classes right |
| 6 | `ladder` "erp implementation dubai" (`pages_now` 1) | 494 | 494 → 495 | 20:31:47–20:34:08 | 2.3 min | 0.1162 | 0.115 | completed (Short plan, 5 pages, `lad_mv5pjt5y4aoa`) |
| 8 | `audit` technical, 200 pages | 496 | 496 → 497 | 20:31:56–20:35:53 | 3.9 min | 0.09 | 0 | completed, health **83 "Good"**, 30 findings |
| 9 | `discover` | 498 | 498 → 499 | 20:32:02–20:32:03 | 1.1 s | 0 | 0 | **refused** by the AI budget guard ($5.74 of $6, + $0.38) |
| 7 | → the ladder's rung-2 page (spawned) | 494 | 500 | 20:34:07–20:34:09 | 1.6 s | 0 | 0 | **refused** by the same guard (+ $1.20) |
| 16 | AI Pulse (Test Runner) | rr1013-pulse | 501 → 502 | 20:35:49–20:37:10 | 81 s | 0.084 | 0 | delivered, 21/21 answered, 1 alert |
| 18 | Rank Tracker (Test Runner) | rr1013-rank | 503 → 505 | 20:35:49–20:36:08 | 19 s | ≈ 0.03 | 0 | 5 ladder reports, 15 SERP checks (desktop + mobile) |
| 19 | Content Cadence dry run | rr1013-cadence-dry | 504 → 506 | 20:35:49–20:35:51 | 1.1 s | 0 | 0 | paused itself on the pile-up guard, wrote nothing |
| 15 | Link Builder, paid, on demand | — | 507 → 508 | 20:35:54–20:37:23 | 89 s | ≈ 0.05 | 0.069 | delivered, 15 qualified, **8 drafts all held** |
| 17 | AI Growth (Test Runner) | rr1013-growth | 509 → 511 | 20:37:01–20:37:22 | 20 s | 0 | 0 | delivered, 12 pages scored, 9 handed to the Link Builder |
| 21 | Audit Scheduler (Test Runner) → technical audit | rr1013-auditsched | 510 → 512 → 513 | 20:37:02–20:41:02 | 4.0 min | 0.09 | 0 | completed ("on demand" forces an audit), health 83 |
| 20 | Site Tracker (Test Runner) | rr1013-site | 514 → 515 | 20:41:20–20:42:01 | 40 s | ≈ 0.01 | 0 | delivered, 862 Search Console rows |
| — | Balance after | — | — | 2026-10-13 06:08 | — | — | — | $18.287684 |
| — | Error Handler (unplanned, Console Alerts IMAP trigger) | — | 516 | 2026-10-13 03:07:36–03:07:49 | 13 s | 0 | 0 | alert recorded, e-mail failed (R5, R6) |

**The completion runs of 2026-10-13** (same method, same app header and callback; all times UTC, 2026-10-13; DataForSEO measured by
balance delta per run):

| # (protocol) | What | Request id | Executions (API → run) | Start–end | Duration | DataForSEO | Claude | Status |
|---|---|---|---|---|---|---|---|---|
| — | Balance before | — | — | 06:46:28 | — | — | — | $18.287684, ledger **$0 of $6** used today |
| 9 | `discover` (with "Keyword Report") | 517 | 517 → 518 | 06:47:51–06:49:46 | 1.9 min | 0.2552 | 0.165 | completed, 662 keywords, 131 relevant |
| 10 | → the follow-up keyword report "erp systems in uae" (spawned) | 517 | 519 | 06:49:43–06:52:11 | 2.5 min | 0.0221 | 0.105 | completed, GO_WITH_CHANGES **58** |
| 7 | the ladder's rung-2 page "service industry erp software" (`lad_mv5pjt5y4aoa`, app "Write now") | 520 | 520 → 521 | 06:52:34–07:04:51 | 12.2 min | 0.0221 | 0.587 (0.438 of it estimated) | completed, 2,891 words, 3 images, **QA failed and shipped** (R11) |
| 14 | full SEO report, 200 pages | 522 | 522 → 523 | 07:05:13–07:12:06 | 6.9 min | 0.4094 | 0.049 | completed, health **70 "Needs Improvement"**, 60 findings |
| 12 | `ai_visibility` | 524 | 524 → 525 → 526 | 07:12:17–07:14:43 | 2.5 min | 0.7946 | 0.095 | completed, 8 questions × 6 engines, 1 of 47 requests failed |
| 13 | `backlinks`, full | 527 | 527 → 528 → 529 | 07:16:02–07:17:00 | 58 s | 0.3727 | 0 | completed, mode `full`, 17 farm links set aside |
| — | Balance after | — | — | 07:18:12 | — | — | — | $16.411543 (**−$1.8761**) |

**13 executions (517–529), all 13 succeeded**, none running or in error afterwards. Six callbacks reached the app
(`keyword_strategy`, `content` = the keyword report, `content` = the page, `full_report`, `ai_visibility`, `backlinks`) plus the two
`…_started` acknowledgements, with their files: the keyword-ideas Word file and PDF, the page as Word / PDF / HTML / Markdown /
`meta.json` **and three WebP images**, the full report as Word / PDF with the 7-file fix pack, and the AI-visibility and backlink PDFs.
Durations against the last comparable runs: `discover` 1.8 → 1.9 min, the keyword report 2.1 → 2.5 min, a content run 10.3 min
(2026-10-01) → 12.2 min, the full report 10.8 → 6.9 min, `ai_visibility` 2.5 min (same), backlinks 40 → 58 s.

**35 executions in the 2026-10-12 window (481–515), all 35 succeeded**, plus the unplanned Error Handler run 516 the next morning. 14 callbacks
reached the app (`site_description`, `content` = the verdict, `ladder_plan`,
`site_audit` ×2, `ai_pulse`, `rank_tracker` ×5, `link_builder`, `ai_growth`, `site_tracker`) plus **2 rejection reports** for the two
refused runs, each with the guard's text. Durations against the baseline of 2026-10-11: describe 15 s → 32 s (it now reads 6 pages),
verdict 2.4 → 2.6 min, ladder 2.3 min (same), technical audit 4.1 → 3.9 min, pulse 63 → 81 s, Rank Tracker 14 → 19 s (15 checks
instead of 6), Link Builder 1.7 min → 89 s, AI Growth 53 → 20 s, Site Tracker 41 → 40 s, Audit Scheduler 3.9 → 4.0 min.

**Not run (and why) — read this before scoring:**

| Protocol run | 2026-10-12 | Done on 2026-10-13 |
|---|---|---|
| 9 `discover` + 10 its follow-up keyword report | **refused** by the daily AI budget guard (exec 499) | **yes** — execs 518, 519 |
| 7 the ladder's page (content) | **refused** by the same guard (exec 500) | **yes** — exec 521, the same rung the guard refused |
| 14 full SEO report | not repeated in that window | **yes** — exec 523 |
| 12 `ai_visibility` | not repeated | **yes** — exec 526 |
| 13 `backlinks` (full) | not repeated | **yes** — exec 529 |
| `published`, `checkin`, `profile` write, a second full report (domain-age cache), case study / local / video pages, the app UI in an owner session | none was attempted: the first three would write false rows, the rest need a paid content run or an owner session | still not attempted (same reasons) |

With the completion runs, **every protocol run of the re-rating has live evidence of its own** except the six left out on purpose in
the last row. The error path fired by itself (exec 516) and exposed R5/R6.

---

## 2. Findings by feature

### 2.1 Site description, site model and Keyword Check (runs 3, 5)

**What it produced.** `describe` (32 s, exec 485) read the homepage **plus 5 navigation pages** (`Nav Pages Plan`, `nav_source:
"site model"`) and returned "Tech&", a Microsoft-aligned enterprise technology partner in the UAE/GCC, with **28
products/services** — including Dynamics 365 **Business Central**, Finance, Supply Chain, Copilot Studio, Fabric and Azure Synapse —
and 10 seed keywords. The one site model (G19) was reused (`site model is 0 days old`) and carried:
`canonical_host "www.techand.ai"`, `business_name "Tech&"`, the DAFZA street address with the site's own phone and public e-mail
(source `homepage_schema`), 12 nav entries and a **45-page inventory** with per-page Search Console queries.

Keyword checks (exec 487–489):

| Keyword | Volume | KD | Difficulty for the site | Plan | Chance | Fit | Cost |
|---|---|---|---|---|---|---|---|
| erp software uae | 480 | 3 | easy | Direct, 2–4 months | good (50–70%, uncalibrated) | 2 | $0.0261 |
| business central partner uae | no data | — | reachable | Short, 4–8 months | fair (30–50%) | **null** | $0.0240 |
| dynamics 365 partner uae | no data | — | reachable | Short, 4–8 months | fair (30–50%) | 2 | $0.0260 |

**Quality.** D22's first half is fixed and visible: the site description no longer misses Business Central, and the model's
`services_json` is filled (P2-2). G3 is in every answer, with the Ahrefs 2025 base rate quoted and the band marked uncalibrated.
But D22's own acceptance keyword lost its fit: the `Claude — Keyword Fit` call failed **twice** with "The AI model returned an empty
response to the Structured Output Parser", and the answer went out with `fit: null` and a warning (R3).

### 2.2 Keyword verdict (run 4)

**What it produced.** GO_WITH_CHANGES **52** for "e invoicing software uae" (58 on 2026-10-11, 55 on 2026-10-03): volume 40/mo
rising 30 → 110 (+120% quarter on quarter), CPC $13.37, KD unavailable, competitors 463–1,256 words (average 1,476).

The important change is that the verdict is no longer blind to the site (P2-5, D11):

```
existing_page       = {url: …/insights/top-peppol-e-invoicing-software-features-every-uae-cfo-must-look-for,
                       title "Peppol E-Invoicing Software Features UAE CFOs Need", match 1, matched_by "slug",
                       source "page inventory"}
existing_page_action = "improve"
verdict_changes[0]   = "Improve the page the site already has for this search …: update and expand it, keep its URL,
                        and do not publish a second page for this keyword."
```

**Spot-check against the live site:** that URL returns **200** and its `<title>` is exactly "Peppol E-Invoicing Software Features UAE
CFOs Need" — the match is real, and the page is 2,137 words, which the run read.

D26 is fixed in the same report: *"An AI Overview was seen in the check at 20:29 UTC on 2026-10-12 and cited tax.gov.ae plus several
vendors. It is one observation and varies between searches."* The `serp_digest` even instructs the writer not to state it as a fact.
16 sourced facts were collected with their source URL and the rule that an unsourced figure must be marked `[Confirm: …]` (G4).
The risks name the accreditation problem honestly ("Tech& is not shown to be an FTA-accredited ASP"). The delivered PDF (2 pages) and
Word file contain **no raw float CPCs and no `[…]` placeholders**.

*Weakness:* the verdict's change list still asks for "an FAQ with schema matching the People Also Ask questions" although G2 stopped
the page writer from emitting FAQPage (R7). `time_to_rank_months: 6` is given without a likelihood (the chance band is on the
ladder, not the verdict — FIX_PLAN already notes this for G3).

### 2.3 Keyword ladder (run 6)

**The plan** (`lad_mv5pjt5y4aoa`, "erp implementation dubai"): *Reachable for your site · Short ladder · 4–8 months*, feasibility
GO_WITH_CHANGES 68, 5 pages (4 on rung 2 plus the main page), order *"supporting pages first, then the main page once half of them
are live"*, traffic potential ~45 visits/month, `chance` fair 30–50% with the Ahrefs 2025 base rate and the word **uncalibrated**
(G3), reach 10 from a cached 2026-10-08 measurement, and a link map of up / sideways / down links.

- **D8 is fixed:** no competitor brand among the rungs ("service industry erp software", "dynamics 365 erp system", "ms dynamics
  implementation partners", "erp customer relationship management"); `refused_keywords: []`, `excluded_keywords: []`.
- **D15/P2-3 are fixed:** every `target_url`, every `links_to` and the whole link map use `https://www.techand.ai/…`.
- **P2-7 is half fixed:** the main page carries `target_words: 1900` (stored on the ladder row), but all four rung rows carry
  `target_words: 0` (R8).
- The ladder document says **"Written now: 'service industry erp software' (rung 2) — delivered separately as page content"**, and
  the page run was then refused: the owner is promised a page that never arrives (R1).
- The delivered Word file and PDF (6 pages) are clean: no placeholders, no float CPCs, the reach method and the difficulty bands
  explained in plain words.

### 2.4 Technical audit and Audit Scheduler (runs 8, 21)

**What it produced.** Health **83 "Good"** (80 on 2026-10-11), 30 findings (Critical 0, High 4, Medium 9, Low 14, Info 3), 45 of 45
known URLs crawled (G24: *"Crawled 45 of 45 known URLs (100%; sitemap 45 + 43 pages with Search Console impressions)"*),
47 pages found, category scores Crawlability 72 / On-Page 87 / Content 75 / Performance 72 / Security 97 / Images 97 /
Technical 98 / AI Search Readiness 97. The Audit Scheduler forced a second, identical audit 70 seconds after the first finished ("on demand"), which
scored 83 again.

New in this run, all visible in the delivered report:

- **G26 priority order:** *"'A large share of important pages is not indexed by Google' is first because Google cannot index or
  follow these pages, 15 of 47 crawled pages, an estimated 11 clicks and 1,615 impressions in the last 28 days, High severity —
  impact score 37.6 against 37.1 for 'HTML cannot be cached by the CDN'."* Each stored finding carries `impact` and `impact_basis`.
- **G18-2 minor fold:** *"6 minor items are folded into one line below (true, but the lowest impact: cosmetic tags, a title a
  character too long, the link count of a navigation page). Nothing is left out of the score or of the stored findings."*
- **URL Inspection (G25):** 25 key pages inspected through the Search Console API with verdict, coverage, Google's chosen canonical,
  last crawl and rich-result types (`Submitted and indexed` 10, `URL is unknown to Google` 10, `Discovered – currently not indexed`
  4, `Duplicate, Google chose different canonical` 1).
- **G7 is honestly unavailable:** *"Core Web Vitals per template (real Chrome users) — Not available: the Chrome UX Report API is
  not enabled for the Google key this agent uses"*, with the enabling step, and the score still computed.
- **P1-3 is fixed:** `scraper_queries` = 4 queries / 6 impressions, including a `-site:` chain and lowercase `and` / `or` boolean
  queries, all excluded; the top-10 query list is clean ("techand", "dynamics 365 finance and operations uae", "ai advisory", …).

**Spot-checks against the live site** (free `curl`, 2026-10-13):

| Finding | Live site | Verdict |
|---|---|---|
| Placeholder (lorem ipsum) text is live, 1 page | /industries contains 10 "Lorem ipsum" blocks ("Industry Context") | true |
| HTML cannot be cached by the CDN | `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, `x-vercel-cache: MISS` | true |
| **"www and non-www not consolidated"** (the old D6 false positive) | `https://techand.ai/` → **308** → `https://www.techand.ai/`; the report lists it under *What Works*: "One canonical host: https://techand.ai redirects (308) to https://www.techand.ai, and the canonical tags agree" | **gone** |
| **"Duplicate meta tags, 45/47 pages"** (the old D18 false positive) | *What Works*: "No duplicate meta tags on the homepage (the crawler counted tags that differ only by a media attribute, such as theme-color for light and dark)" | **gone** |
| Fix-pack robots.txt (the old D17) | *"# Changes: none needed"* and the file keeps `Disallow: /api/ /admin/ /private/` — byte-for-byte the rules the live `/robots.txt` serves | **gone** |
| Fix-pack schema | Organization / LocalBusiness / WebSite JSON-LD with "Tech&", the real DAFZA address and phone, `https://www.techand.ai/` — **no placeholders** | D15/G19 hold |

**Problems.**
- **The diff invents a "new" finding (R2).** The Audit Scheduler's audit compared itself with the *same type* five minutes earlier
  (D2's fix — its summary line reads *"0 fixed · 1 new · 26 still open (compared with the technical audit of 2026-10-12)"*, with
  `previous {audit_id aud_mv5poznfsvy, report_type site_audit}`, `days_since 0`, `score_delta 0`) — but it reported **`new: ["Structured data with errors", Medium]`**, although that exact finding is in the
  previous audit's stored rows (`finding_key "Schema|structured data with errors"`, 26 of 47 pages).
- The audit's own `not_assessed` list says "Structured data (schema) and HTML-level checks" are **not assessed** by a technical
  audit, yet a Schema finding is emitted — so it is in no category score either.
- The fix pack's `sameAs` carries `https://www.linkedin.com/company/techand.ai/`, taken from the site's own homepage schema, while
  the Link Builder's listing check found the live profile at `ae.linkedin.com/company/techanduae` in the same hour. Not our
  invention, but two features hold different answers and neither flags it.

### 2.5 AI Pulse and AI Growth (runs 16, 17)

**AI Pulse** (exec 502, $0.084): 7 tracked questions × ChatGPT / Gemini / Google AI Mode = **21 answers, 21 answered, 0 errors**
(`error_rate 0`, `retried 0`). Named in **0%** with a 95% range of 0–15.5%, pages cited 0%. One real alert, medium:
*"oracle.com appears in 10 of today's 21 AI answers and was not named in the past 4 days."* The report repeats the honest caveat
("answers vary from one ask to the next; an alert is sent only when a change is beyond that noise"). The panel is still 7 asked of a
stored 8 — owner decision O8 is open.

**AI Growth** (exec 511): 12 key pages scored, average **78/100** (78 before), `business_name "Tech&"` and `site_host
www.techand.ai` (P34-6 on this workflow), Bing in the account with **0 URLs to submit** ("nothing new to send to Bing"), IndexNow
`key_missing`, 7 questions to win (5 queued, 1 skipped, 1 mapped to the ladder keyword "accredited service provider for e invoicing
in uae" — "one search, one page"), 15 pages AI cites without naming the site, and Wikidata `found: false`.

**P34-1 is fixed and is the clearest change here:** `drafts_written: 0`, `handed_over: 9`. The report says *"15 page(s) AI cites
without naming you, 9 handed to the Link Builder (one writer): approve the pitches on the Link building page"*. The government
sources (tax.gov.ae, mof.gov.ae) are no longer pitched but get *"if Tech& qualifies for its list or registry …, apply; otherwise cite
it on your page"*. **G22 is fixed:** source titles are whole ("UAE E-Invoicing ASP List 2026: Accredited & Pre-Approved - Finline",
not "Best e").

### 2.6 Link Builder and Reply Reader (runs 15, 11)

**Link Builder** (exec 508, 89 s): 15 qualified, **25 not a fit**, 6 need a contact, 21 ready, 10 to draft, **0 drafted, 8 held,
2 refused by the writer itself**.

D13's refusal list is now explicit and quotable: 4 government pages (*"government site: you get on its lists by applying or being
accredited, not by a pitch"*), 14 bare homepages (*"only their homepage was found: a front page has no section a link could be
added to"*), `zoominfo.com` (*"a contact / company database: its pages are generated, nobody there edits them"*), `outlook.com`
(*"a mailbox provider, not a website whose editor could add a link"*), an accredited-provider list, an off-topic page at 19% match,
and one competitor (*"their page sells what you sell (56% of your service words, 'book a demo', 'our platform')"*). All 15 rows
that carry a target URL (9 `ready` + 6 `needs_contact`) point at `www.techand.ai`, and the brand is written **"Tech&"**.

**L2 (the draft gate) is the headline:** all 8 drafted sequences were **held**, each with its reasons, e.g.
`["needs you: [Owner: confirm — one-line summary of what the page covers]", "needs you: [Your name]", "the first e-mail carries 2
links (one, to your page)", "the first e-mail links to mof.gov.ae, not to your site"]`. The first e-mails are 79–100 words, personal
("Your guide … links to … and that address now returns a 404"), carry no SEO jargon, and the follow-ups come after 4 and 8 working
days. Nothing was sent; no mailbox is connected.

*Problems.*
- **The competitor gate is leaky (R4):** `flick.network` — which this very run's Rank Tracker found at **#1** for the ladder head
  "e invoicing in uae" — is a `ready` resource prospect, and `basware.com` is `needs_contact`, both passed with "topic match 65/70%",
  while `comarch.com` was refused as a competing provider. The test looks at the prospect *page*, so a competitor's guide passes.
- **The listings checklist still carries two false "listed" rows (P34-2 residual):** SaaSHub is "listed" at
  `saashub.com/tech` and AlternativeTo at `alternativeto.net/software/optimizer/`. Re-checked free on 2026-10-13: the SaaSHub URL
  **302**-redirects to `/tech-alternatives` and the AlternativeTo URL returns **403** (Cloudflare). The new gate stops a *new* false
  claim ("the platform blocks checks now" / "nothing new could be read this week") but the stale status from the pre-fix run is kept
  and reported as fact. The two listings that matter are right: MoF accredited providers **missing** (competitors on it) and
  OpenPeppol **missing**.
- The chosen target page for a Peppol/e-invoicing guide was "Dynamics 365 cloud migration in the UAE" — a 25% topic match. The hold
  reasons catch some of it, but `pickTarget` still prefers an under-linked page over a relevant one.

**Reply Reader** (execs 490–493, 1.9–5.5 s, ≈ $0.0033 each): all four synthetic replies classed correctly — a question
(`needs_you: true`), an opt-out (`unsubscribe`), an out-of-office (`out_of_office`, return date **2026-10-19** and the referral
address read correctly) and a "done, you are listed" (`says_linked`, **link check run at once**: found on
`peppol.org/members/full-members-list/`, `rel: follow`, placement `content`).

**D14 is fixed.** The reply that asks whether the business is accredited gets:
*"[Owner: confirm whether we are accredited with the Ministry of Finance or work through a partner]"* — no invented accreditation.

### 2.7 Rank Tracker (run 18)

15 SERP checks (desktop **and mobile** for the main keywords, depth 50), 5 ladder reports, nothing ranking anywhere.

**G6 is fully live:** every check returns, from the SERP it already paid for, the AI Overview (shown, whether it cites us, the
domains it cites, the time it was seen), the featured snippet, People Also Ask with the questions, local pack / video / shopping,
the top-10 domains above us with positions, the competitors' positions (cleartax.com #16 for "e invoicing in uae"), and a
**share-of-voice estimate labelled as modelled**: *"Share of voice is an estimate of the clicks page 1 offers, not measured clicks:
modelled: clicks by position from a published CTR curve (28/15/11/8/7/5/4/3.5/3/2.5%), the organic share cut to 65% when an AI
Overview is shown (Ahrefs 2025)… Not measured clicks."* Mobile is explained too ("only about 13% of sites hold the same position on
both devices").

**D16 is fixed** — the five next steps are each right for the ladder's shape:

| Ladder | Next step |
|---|---|
| e invoicing in uae | "Work on rung 1: none of its pages is in the top 10 yet…" |
| peppol uae | "The main page is live: improve the main page … it is …/insights/top-peppol-…, the page the site already has for this search" |
| erp software uae | "The main page … is written but not live yet: publish it at …/erp-software-uae/. Nothing climbs until it is published" |
| dynamics 365 partner uae | "Work on rung 2: none of its pages is in the top 10 yet…" |
| erp implementation dubai | "Work on rung 2…" |

**D11 is fixed here too:** for "uae e invoicing penalties" the step reads *"…/insights/the-cost-of-non-compliance-uae-e-invoicing-
penalties-mitigation-costs already answers this search — refresh that page, do not publish a second one"*, and the ready-to-send API
body sets `existing_page_url` to that URL. The baseline's exact defect, in the same place, now reversed.

*Problem:* the new ladder's rung-2 page is listed as *"already written — publish it"*, although its run was refused (R1).

### 2.8 Content Cadence dry run (run 19)

**D5 is fixed, and the guard is now the loudest voice in the system.** The cadence wrote nothing:

> `reason`: "6 written pages waiting for publication (pile-up guard, limit 3): "uae e invoicing penalties", "e invoicing uae fta",
> "peppol uae", "vendor invoice automation dynamics 365", "erp software uae", "service industry erp software" — publish them to
> continue"

`paused_reason: "pileup"`, `waiting_publish: 6`, `max_waiting: 3`, `pileup_forced: false`, 4 upcoming ladder topics named, the new
ladder queued with `reason: "max_active"`, and the AI page of the month identified ("best e-invoicing software uae", 0 of 2 used).
The count is honest about the pages the ladder wrote — which is exactly what the baseline got wrong — but it includes the page the
budget guard refused (R1), so the limit is reached by a page that does not exist.

### 2.9 Site Tracker (run 20)

862 Search Console rows paged (G9), 45-page inventory refreshed (18 pages with queries), publish detection ran (6 candidates, 0 live),
`alerts: []`.

The brief is accurate and now statistically careful (G28):

> "Over the last 28 days, Tech& (www.techand.ai) got 37 clicks against 15 before (+147%) and 5,275 impressions against 1,422
> (+271%); **both changes are statistically real**. Average position improved from 31.4 to 26.6, but click-through rate fell from
> 1.05% to 0.7% because new pages show at low positions."

with `significance` carrying z-scores and 95% ranges (clicks z 3.05, CI 35–349%), a core-update note ("The September 2026 core update
ran 15–30 September; check that the new gains hold") and **D21 fixed**: *"Trends for e invoicing, erp software uae and dynamics 365
partner uae have too little search data to read"* — all four tracked keywords return `direction: "sparse"`, `change_pct: null`, and
**P2-4 is fixed** (real day counts, no "(undefined days)").

Its first action is D11 again: *"Do not publish a new page for 'uae e invoicing penalties'. Put the new written text into the
existing article instead… That page already answers the search; two pages would split the signals."* Its fifth action is
**D25c fixed**: *"Complete the monthly Search Console check-in"* — the reminder fires although October's row is still the
2026-10-02 test row, because a "(test)" check-in no longer satisfies the month.

### 2.10 Guards, ledger and operations (across every run)

- **D1 is fixed, with the arithmetic visible.** Each run reserves a `seo_run_ledger` row before *Rate Limit* and settles it at the
  end. During this run the main workflow reported `run_number_today` 14 → 15 and `ai_budget_used_est_usd` 4.93 → 5.16 from the
  table, not from workflow static data. The refusal text is the proof that concurrent reservations count:
  *"The AI budget for this day is used up (estimated $5.74 of $6; this run would add about $0.38)."* Adding the ledger's own rows
  gives the same figure: the day's settled estimates **$4.878** + this window's five finished runs ($0.296) + the **$0.58 still
  reserved by the ladder run that was mid-flight** = $5.754. Without the mid-flight reservation the guard would have let both runs
  through — that is exactly the concurrency hole of D1.
- **P1-1 is fixed:** all nine rows of this run are `done` with a settled estimate — including `describe`, which never settled before —
  and the two refusals stay `refused` with `settled_usd 0`.
- **P34-5 is fixed:** exec 485 reported `ledger_stale_released: 11` — the 11 reservations stuck by the 90-minute audit timeouts
  ($0.77) were released by *Release Stale Runs* at `run_stale_hours: 2`; both audits carry `heavy: true`. The "refuse a second heavy
  audit while one runs" half was not exercised (497 and 513 did not overlap).
- **Ops alerts (D25b).** The one unplanned execution, 516 at 03:07 UTC on 2026-10-13, is an Error Handler run for the **Console
  Alerts IMAP trigger**: *"The trigger node 'Mailbox Trigger' failed at runtime and was deactivated … IMAP connection closed
  unexpectedly"*. The alert was **recorded before sending** (the D25b fix works), but it was recorded as
  `node "unknown node", message "no message", execution_id ""` because the handler cannot read a trigger-mode payload (R5), and
  then `Email Ops` failed with `getaddrinfo ENOTFOUND smtp.gmail.com`. All three rows in `seo_ops_alerts` are
  `delivered: "pending"` and `channels: "email,data_table"` — including the two from 18:34 whose e-mail Gmail **accepted** (execs
  464/465) — so no alert has a recorded delivery and no webhook channel is configured (R6).

### 2.11 Keyword discovery and its follow-up report (completion runs 9, 10 — execs 518, 519)

**What it produced.** 662 keywords from 10 data pulls, 240 screened by Claude for relevance, **131 relevant**, 43 clusters, 15 live
SERP checks, a Word file and a PDF (`files/keyword-ideas-techand-ai-2026-10-13.doc`, `files/ideas-518.txt`). "Where to start" is
*"erp systems in uae"* — 260 searches/mo, KD 6, *Easy for your site · Direct plan · 2-4 months*, chance "good (50-70%, uncalibrated)"
— and the run spawned its keyword report for exactly that keyword (exec 519, GO_WITH_CHANGES **58**).

**G8 is live and is the clearest new capability in this set.**

- **Search Console seeds.** *"10 of your own Search Console searches were used as research seeds (the 25 with impressions and no page
  of their own, and the 16 where you rank 8-20), measured in the 28 days to 2026-10-09. Left out: 9 brand searches, 0 typed by SEO
  tools, 26 under 10 impressions."* 300 stored rows were read, 108 considered, 157 duplicates dropped — **no new API call**.
- **Striking distance** is a label of its own in the table ("you rank #12.2 — striking distance"), 16 rows.
- **Traffic measured vs modelled, with the label on every number.** `from_research` = 36 keywords calibrated against measured
  impressions, 626 modelled; every card prints "Traffic potential ~195/mo (**modelled**)" and the method says *"Traffic potential is
  **calibrated** where Search Console measured that exact search on your site (its impressions and clicks over 28 days, scaled to a
  month) and **modelled** everywhere else (the provider's monthly volume, typically 50-70% off for a single keyword)"*.
- **SERP-overlap clusters.** 5 clusters at ≥ 3 shared top-10 URLs, from the 15 live checks: *"the same pages rank for 'erp software
  uae' (5 shared top-10 results), so one page can target both"*, and a section *"Google answers these searches with the same pages …
  One page per group: a second page for the same results page only splits the signals."*
- **The live-check cap is raised and priced:** `live_checks {planned: 15, cap: 16, per_topic: 4, est_cost_usd: 0.03}`, stated in the
  report ("15 keywords were checked live on Google for intent and page type (limit 16 a run, about $0.03 of search data)").

**D20 is fixed in all four of its parts.** 11 keywords are flagged as ladder-covered with the ladder, the part, the rung and the
status (*"'erp software' → ladder 'erp software uae' (part of a broader page, rung 1, planned) … Let that ladder finish"*); every AI
Overview claim is dated (*"an AI Overview was seen on 2026-10-13 (they vary between searches)"*, and per card *"seen in the check at
06:49 UTC … one observation, not a fixed feature of the query; the stored results page showed one (historical, undated)"*); "Who
ranks now" lists 5 distinct domains in every card; and **all 12 CPC values in the callback carry 2 decimals** — the payload contains
no number with more than two decimal places at all (P1-5 on this path).

**D11 holds here too:** *"7 keywords below are already answered by a page you have … Refresh those pages instead of writing new ones
— two pages for one search split the signals and neither ranks."*

**D4 holds for the lists:** `refused: []` with nothing to refuse — no competitor brand (facts.ae, sowaanerp, ClearTax, Zoho, Odoo,
SAP, Tally) and no login/portal query reaches any of the 131 keywords, and the `navigational` bucket of the opportunities by intent
is **empty**. The only brands present are the site's own stack (Microsoft, Dynamics 365).

***Problem (R12).*** The one wrong sentence is in the Search Console table: **11 of 25 rows say "no page of yours answers this
search" while the next column names the live page that earns the impressions** — including *"which dynamics 365 finance partner can
help migrate a retail business in the uae"* (16 impressions, **position 6.2**, `/dynamics-365-finance-and-operations-uae`) and
*"dynamics 365 finance and operations pricing dubai"* (**#9.6**, the same page). Both pages are in the 45-page inventory and both
return **200** on a free check. The same page is recognised two rows later ("you rank #15.4 — striking distance").

**The follow-up keyword report** (exec 519) is clean: verdict 58 with four reasons, the competitors' word counts and gaps named,
*"An AI Overview was seen at 06:50 UTC on 2026-10-13 citing vendors and directories; this is one observation, so it doesn't drive the
score"* (D26), CPC $13.61 at 2 dp, risks that name the site's own weakness ("Tech& is a Microsoft partner serving BFSI/public sector,
while the SERP is SMB-oriented local ERP vendors"), `existing_page: null` and no ladder claim. It is a report-only run, so no page,
no images and no QA.

### 2.12 The ladder's rung page, written (completion run 7 — exec 521)

The page the budget guard refused on 2026-10-12 was written through the app's **"Write now"** path exactly as the app sends it
(`ladder_id lad_mv5pjt5y4aoa`, `ladder_rung 2`, `ladder_page_no 1`, `force_content true`, `ladder_links` = the main page and one
sibling, `ladder_words 1900`). 12.2 minutes, $0.0221 of search data and about $0.59 of Claude, $0.438 of it the estimate for the
three Opus streaming nodes.

**What works, with the numbers.**

- **G30 — images are produced, not only planned.** `images_planned: 3`, `images_produced: 3`: a 1200×675 hero (20 KB) and two
  1000×600 diagrams (38 KB, 37 KB), all **WebP rendered by the local Gotenberg container**, each with its planned file name, alt
  text, caption, placement and `made_by: "generated from this page by the local renderer"`. All three arrived in the app as real
  files, are listed in `meta.images` and in the publish checklist ("save them into your media library under those exact file names"),
  and the hero is named as the Open Graph image.
- **G5 — originality is measured.** `Originality Check` compared the draft's **2,762 eight-word windows** against the 8 pages this
  run already read (6 competitors + 2 of the site), `passed: true`, highest overlap **0.1%** against the site's own Peppol article
  (one 10-word passage), threshold 15%, no extra fetch and $0.
- **G33 — the target is the best competitor, not the average.** `coverage_target` = **68% from cubesoftware.com (position 5,
  9,436 words, 30 sections)**, with the average of the 6 pages read (61%) printed next to it; QA re-measured the draft at **40% of
  the 25 shared terms** and named the 10 missing terms and 3 missing subtopics.
- **G2 — no FAQPage.** `faq_count: 0`; the schema blocks are `Service` and `BreadcrumbList` only, while 15 question headings are
  answered in the body.
- **G4 — sources are graded.** `sources_cited` carries a tier per link (3 primary: tax.gov.ae ×2, peppol.org; 3 vendor; 1 weak),
  `unverified_statistics: []` in the final round (round 1 had flagged "20+ years", "70%", "75%"), and the page contains no `utm_*`
  and no `srsltid`.
- **D15 / P2-3 — one host.** **0 bare-host URLs anywhere in the delivered payload**; `suggested_url` is
  `https://www.techand.ai/service-industry-erp-software-uae/` and the schema's `provider` is `https://www.techand.ai/#organization`.
- **D9 — links only to live pages.** All 4 internal links (`/contact-us` and two `/insights/…` articles) return **200**; neither of
  the two planned ladder URLs is in the body (both answer 308 → 404).
- **D10's identity half — the real name and NAP come from the model.** `business_name: "Tech&"`, `nap_source: "homepage_schema"`;
  the title is "Service Industry ERP Software for UAE Firms | Tech&" (51 characters) and the meta description 137.

**What fails.**

- **D10 is still broken where it matters (R11).** Content QA ran **twice** and failed **both** times: round 1
  `placeholder_count 6 / max 5, passed false`; the editor then ran and round 2 reported `placeholder_count 12`
  (**11 × `[Price]`**, 1 × `[Number]`), `passed false`, `editor_needed true` — and because `qa_max_rounds: 2` was reached the page was
  **delivered anyway**. The worked example is unusable: *"40 fee-earners at an average rate of [Price] per hour"*, *"billings of
  [Price] a week (40 × 22.5 × [Price])"*, *"[Price] of work done but not billed"*, and the proof section says *"- [Number] years of
  industry experience"*. Two owner-fill markers were added on top (`[Microsoft partner designation and certifications held by
  Tech&]`, `[typical Tech& timeline for Business Central services project]`). The owner is told only **"Quality check: 6 item(s) to
  review"** — round 1's number — and nothing says the gate failed.
- **Length.** The brief's target was **2,200 words** and the delivered page is **2,891** by QA's own count (+31%) or 2,727 by
  `meta.word_count` (+24%) — the two counters disagree. The app passed `ladder_words: 1900`, but *Parse Brief* clamped Claude's 2,400
  to 2,200 citing *"the verdict asked for about 2000, within 10%"*, so **the number that bound the page was the verdict's, not the
  ladder's**. The 1,900 itself came from the ladder's **main page**: the rung row still has `target_words: 0` (R8).
- **The ladder's own URL and links are lost (R15).** The ladder row's `target_url` is
  `https://www.techand.ai/service-industry-erp-software/` while the page's `suggested_url` adds `-uae`, and
  `meta.links_to_add_when_published` is **`[]`** although the app sent two planned ladder links.
- 7 external links point at Oracle NetSuite, SAP, Odoo and Workday — defensible on a "which ERP fits you" page, but they are the
  vendors the verdict calls competitors, and nothing flags that.

**R1's instance is resolved by this run, the defect is not.** `seo_content_log` now holds row 4 — keyword "service industry erp
software", **`status: "written"`, `request_id: 520`** — so the page the three features promised on 2026-10-12 now exists, and ladder
row 19's `status: "writing"` is from now on the correct state (written, not yet published). The defect itself stands: the refusal path
never reset the row, and `seo_content_log` rows 1 and 2 ("e invoicing uae fta", "peppol uae") are still `started` from runs that never
finished.

### 2.13 Full SEO report (completion run 14 — exec 523)

**Health 70 "Needs Improvement"** (same as 2026-10-12), 60 findings (Critical 0, High 17, Medium 21, Low 19, Info 3), audit
`aud_mv6cf3ru39g`, 6.9 minutes, $0.4094 of search data.

- **D7 is fixed and free again:** `Domain Ages` reports `whois_requests: 0`, `looked_up: 0` and all three ages from the cache
  (`techand.ai 2026-02-19`, `cleartax.com 2000-01-01`, `azentio.com 2020-11-19`, each `source: "whois, stored 2026-10-11"`) — **$0**
  where the baseline paid $0.36. The RDAP code path is still not exercised, because the cache answers first.
- **D17 is fixed, verified byte for byte:** the fix pack's `robots.txt` says *"# Changes: none needed"* and its rules are identical to
  the live `/robots.txt` fetched in the same minute (`files/fixpack-robots-523.txt`).
- **The fix pack's schema is clean (D15 / G19):** Organization / LocalBusiness / WebSite with "Tech&", the real DAFZA street address,
  the site's phone, `https://www.techand.ai/` — no placeholder.
- **G24:** *"Crawled 45 of 45 known URLs (100%; sitemap 45 + 43 pages with Search Console impressions)"*, `crawl_complete: true`.
- **G25:** **45 of 45 key pages inspected** with the quota stated (*"quota 2000 pages a day per property"*): 15 indexed, 30 not
  (21 unknown to Google, 6 discovered-not-indexed, 3 duplicate-with-another-canonical), `canonical_mismatch: []`, rich results
  ["Breadcrumbs"].
- **G26:** *"'A large share of important pages is not indexed by Google' is first because Google cannot index or follow these pages,
  30 of 47 crawled pages, an estimated 23 clicks and 3,242 impressions in the last 28 days, High severity — impact score 53.3"*, with
  the full ordering rule in the Methodology and `minor_count: 6` folded into one line (G18-2).
- **G7 is still only the fallback:** `crux.available: false`, `reason: "api_off"` for 3 templates × 2 devices (8 requests), the report
  prints the "not available" text with the enabling step, and the score is computed anyway.
- **D2 is fixed on this path too:** the diff is *"1 fixed · 1 new · 49 still open (compared with the **full SEO report** of
  2026-10-12)"*, `report_type: "full"`, `previous {audit_id aud_mv5mhvt21pp, report_type full, findings 50}`, `days_since 1`,
  `score_delta 0`. **R2 does not reproduce here:** "Structured data with errors" is stored in both audits and the diff correctly keeps
  it under `open` — the full report weights the `Schema` category, so R2's cause (a category outside the weights) needs the technical
  audit to show, and no technical audit ran in this window.
- **D24 is fixed:** exactly **one** author finding, no "capped at 85" claim anywhere (only the rule in the Methodology, at score 70),
  and *"2 scraper queries (search operators such as site: or inurl:, 4 impressions) left out of the top queries"* (P1-3).
- **P34-4 is fixed:** *"1 of 25 domains are worth a pitch. Top: uae-asp.ae. 24 are left out (e.g. mof.gov.ae — a government site: you
  get on its lists by applying or being accredited …; buydofollow.site — its own name offers links …)"*, and the closing line says
  *"a government list is joined by applying, and a site that sells links passes nothing on"*. The baseline's table of
  `buyhighda.space` / `freedofollow.website` / `relevantbacklinks.website` is gone.
- **P1-4 is fixed in its own place:** *"Navigational Keywords — No keywords with measurable search volume found for this intent."*
  and the gap table closes with *"Left out of the gap on purpose: 40 searches for government portals, logins or other companies'
  brands (e.g. runway ai — navigational, rockwell automation — navigational …)"*. Every CPC in §4a has 2 decimals (P1-5).

***Problems.***

- **A High finding invented out of "no data" (R10).** All 45 URL Inspection responses return
  `mobileUsabilityResult: {"verdict": "VERDICT_UNSPECIFIED"}` — Google retired the Mobile Usability report and the API returns no
  verdict — and the report raises **"Pages Google reports as not mobile-friendly", High, 45 of 47 pages (100%)** with **empty
  evidence** (*"/:  | /whatwedo/ai-automation:  | /whatwedo/assess-envision: "*), ranks it **second by impact (41.6)** and the diff
  presents it as the run's only **new** finding. Its impact basis claims *"about 720 clicks and 22,860 impressions in the last 28
  days"* while the whole site measured **38 clicks and 5,295 impressions** in that window.
- **The fit gate reaches only the navigational class (R13).** §4a's Informational list offers **"google ai" (40,500/mo), "character
  ai" (110,000), "meta ai" (22,200), "blackbox ai" (14,800)**, the Commercial list **"mh enterprises uae"** and "microsoft ai", and
  the Transactional list "ai image generator", "ai video generator free", "face swap ai", "magic light ai" — consumer AI-tool
  searches and other companies' brands, for a UAE enterprise Microsoft partner. The gap table keeps "attestation", "mofa attestation
  dubai" and "how to check emirates id status with passport number", and the High finding tells the owner to *"create or improve a
  dedicated page for the highest-volume, lowest-difficulty gap keywords first"*.
- The run's own `dataforseo_usd` (0.4674) is **$0.058 above** the measured balance delta (0.4094) — the crawl is charged at its
  estimate, not its cost (G23 / R9).

### 2.14 AI search visibility (completion run 12 — exec 526)

8 questions × 6 engines, **47 requests, 33 answers, 54 samples** (21 of them the pulse's), 2.5 minutes, **$0.7946**.

- **G1 / D19 are fixed, every half of them.** `errors: 1`, `error_rate: 2.1` (under 5%), `retried: 3`, `retry_answered: 2`, and the
  alert names the engine: *"1 of 47 AI requests failed (2 of 3 answered on the retry): Google AI Overview — Internal SE Server Error.
  The rates below count the 33 answers that came back."* `engines[].errors` is 0 for every other engine. The 8 counted competitors
  are all real domains (tallysolutions.com 20.5%, oracle.com 17.4%, zoho.com 16.7%, microsoft.com 14.4%, odoo.com 11.4%,
  cleartax.com 9.1%, wafeq.com 7.6%, azentio.com 3%) — no heading, no generic phrase. Of **30 cited URLs, 30 distinct, 0** carry
  `www.`, a fragment or a tracking parameter.
- **G10 / P34-3 are fixed, in the exact words the brief asked for.** With `seo_profiles` still empty the gate switched the check
  **off**: `fact_check: "no_facts"`, and the report reads *"**What AI gets wrong: not checked** — What AI says about you was not
  checked: nothing on file can judge what the answers claim — fill the business profile (city, address, phone, price range) and the
  next run checks every answer against it. Your country and the services read off your website are context, not facts to check a
  claim against."* The baseline's "no claim was wrong" is gone.
- **P34-6 is fixed on this workflow:** `business_name: "Tech&"`, `canonical_host: "www.techand.ai"`,
  `brand_names: ["techand.ai", "Tech&", "Techand", "techand"]` (no bare "tech"), and the report names "Tech&" in its actions
  (*"State whether Tech& is an accredited provider or works with one"*).
- The measurement itself: named in **0%** of 54 samples, pages cited 0%, AI Overview present on **85.7%** of the searches and citing
  the site in 0%, brand recognised by **4 of 4** assistants, **8 of 8** answer crawlers allowed, GA4 connected with 0 AI-assistant
  sessions. The accredited-provider question is named as a lost one (comarch.com, cleartax.com, edicomgroup.com win it).

***Problem (R14).*** The market-wide table credits the owner with a number from a loose name match: `index.brands[0]` is
`{key: "name:Tech&", you: true, domain: "", mentions: 19579, ai_search_volume: 16421600}`, and the delivered report prints
**`"Tech&" by name (you) | 19,579 | — | 16,421,600`** directly under its own headline *"Market-wide share 0% — 0 AI answers cite
you"*. The next row is microsoft.com with 1,897. It is the same 4-character collapse as P34-2, now in the market index.

### 2.15 Backlinks, full check (completion run 13 — exec 529)

Mode `full`, 58 seconds, **$0.3727**; ledger 20 rows, 5 live; 19 backlinks from 18 referring domains in the DataForSEO index.

- **D3 and P1-2 are fixed, and the report leads with the honest version.** `best_links: 0` as a counter with the banner *"⚠ 17
  link(s) from link farms / PBN pages set aside (no value, on the disavow candidates for review): archive-hu.com, seonix.agency,
  clifflisting.com …. Google ignores them unless you get a manual action."*, each farm row carrying its evidence (*"the same page path
  on 16 sites (/all/2835/13.html)"*, *"labelled spam by the Link Analyst"*). **`lost: []`, `at_risk: []`, `important_lost: []`,
  `rel_changed: []`** — no false "lost" alert, and the single alert is low and informational.
- **G18-1 is fixed where it can be observed:** the "Best links" table holds **one** row — `peppol.org/members/full-members-list/`,
  SEO 35 / visits 25 / brand 44, `rel: follow`, placement `content`, authority 594 · DR 77, *"✓ on the page"* — and
  `robuta.com/?q=business+impact`, the baseline's "best link", appears only as a stored `lost`/reclaim prospect with **score 0**.
- **D23 is fixed (the sister-domain half still unexercised):** `dr_enabled: true`, `dr_error: ""`; of **42 gap domains 39 are flagged
  `off_topic` with a reason** (*"off topic for you: neither its name, its page nor its country ties it to dynamics 365 partner uae"*),
  and the three on topic are mof.gov.ae (with `no_pitch` set), uae-asp.ae and nationalbonds.ae. No `utm_*` or `srsltid` in any URL,
  and no `clear.in`-style sibling in this run's data.
- **The Link-Builder hand-over holds:** with `link_builder: true` both *Outreach Jobs* and *Outreach Input* return `{skip: true}`,
  **0 of 60 prospect rows carry a draft body**, and the stale pre-fix rows say so themselves: *"the draft written for them earlier was
  withdrawn: it was written before the current outreach rules (no government portals, no competitors, no bare homepages, the business
  name from the site model)"* (P34-1's cleanup).
- Coverage is reported per source with its reason: DataForSEO 1 referring site, Bing Webmaster 0 (*"connected; Bing reports no links
  to this site yet"*), Search Console upload 0 (*"upload the Links export in the app"*), GA4 referrals 1 (*"not links:
  teams.public.onecdn.static.microsoft"*), Common Crawl 1 (release `cc-main-2026-jul-aug-sep`), social 2 (not counted).

***Problem.*** **P34-6 is only half fixed:** the payload now carries `business_name: "Tech&"`, but the delivered report never uses it
— it is headed *"Backlinks: techand.ai"* and contains **0 occurrences of "Tech&"** — and `brand_names` is still `["techand.ai"]`
alone, so mention matching for this workflow still rests on the domain. One stored prospect row also still carries the bare-host
target `https://techand.ai/` (a 2026-10-02 row, P2-3's stored residual).

---

## 3. Defect status

### 3.1 The 2026-10-11 defects (D) and the later live defects (P1, P2, G18, P34)

"Gone" means the evidence of these runs shows the fixed behaviour; "partly" means part of the item was exercised and passed while
another part failed or could not be tested; "still present" means the defect was reproduced; "not exercised" means neither window has
evidence either way. Execution ids 481–516 are the 2026-10-12 window, **517–529 the completion runs of 2026-10-13**.

**Totals over the 48 items, both windows: 39 gone, 6 partly, 1 still present, 2 not exercised** (D1–D26 + D25a/b/c: 24 gone,
3 partly, 1 still present — D10 —, 1 not exercised; P1, P2, G18, P34: 15 gone, 3 partly, 1 not exercised). Before the completion runs
the same table read 26 gone, 6 partly, 16 not exercised: **14 of the 16 unexercised items now have evidence**, and the two that
remain (D25a's missed schedules, P2-6's author box) need a week of schedules and a filled business profile, neither of which a run can
supply.

| ID | This run | Evidence |
|---|---|---|
| D1 guards undercount | **gone** | Ledger rows 32–40; `run_number_today` 14/15 and `ai_budget_used_est_usd` 4.93/5.16 read from the table; execs 499/500 refused at "$5.74 of $6", which only adds up if the mid-flight ladder reservation ($0.58) counts |
| D2 audit diff compares unlike types | **gone** (R2 unexercised on this path) | Exec 513 diff: `report_type site_audit` vs `previous site_audit`, `days_since 0`, `score_delta 0`. Exec 523: "1 fixed · 1 new · 49 still open (compared with the **full SEO report** of 2026-10-12)", `previous {aud_mv5mhvt21pp, full, 50 findings}`, `days_since 1`; the Schema finding is kept under `open` in both, because the full report weights Schema — R2 needs a technical audit |
| D3 PBN pages as best links | **gone** | Exec 529: banner "17 link(s) from link farms / PBN pages set aside (no value, on the disavow candidates for review)" with the evidence per cluster; "Best links" holds one row, peppol.org (35 / 25 / 44, DR 77, "✓ on the page") |
| D4 navigational keyword gap | **partly** (R13) | Exec 523: "Navigational Keywords — No keywords with measurable search volume found for this intent" and "Left out of the gap on purpose: 40 searches for government portals, logins or other companies' brands". But the other three intent buckets still carry other companies' brands and consumer AI searches, and the gap keeps "mofa attestation dubai" / "how to check emirates id status with passport number" (R13) |
| D5 pile-up guard undercounts | **gone** | Exec 506: "6 written pages waiting for publication (pile-up guard, limit 3)", every keyword named, nothing written |
| D6 false "www not consolidated" | **gone** | Execs 497/513 *What Works*: "One canonical host: https://techand.ai redirects (308) to https://www.techand.ai…"; live `curl` 308 |
| D7 RDAP never parsed | **gone** (cache, again) | Exec 523 `Domain Ages`: `whois_requests 0`, `looked_up 0`, three ages from `seo_cache` ("whois, stored 2026-10-11") — **$0** against the baseline's $0.36. The RDAP code path is still never reached, because the cache answers first |
| D8 competitor brand as a rung | **gone** | Exec 495: 4 generic rung keywords, `refused_keywords []`, `excluded_keywords []` |
| D9 hub links to unwritten pages | **partly** (R15) | Exec 521: all 4 internal links return 200 on a free check, neither planned ladder URL is in the body, anchors are sentence-cased phrases, not keywords. But `meta.links_to_add_when_published` is `[]` although the app sent two planned ladder links (R15) |
| D10 page not publishable | **still present** (R11) | Exec 521: Content QA failed **twice** (`placeholder_count` 6 then **12**, max 5, `passed false` both times) and the page was delivered anyway at `qa_max_rounds`; 11 × `[Price]` break the worked example's arithmetic, `[Number]` years of experience in the proof list; 2,891 words against a 2,200 target (+31%). Fixed halves: name and NAP from the model ("Tech&", `nap_source homepage_schema`), 0 bare-host URLs, no FAQPage, originality 0.1%, 3 images produced |
| D11 blind to existing pages | **gone** (R12 is the counter-case) | Exec 486 `existing_page_action "improve"` + "do not publish a second page"; exec 505 "already answers this search — refresh that page"; exec 515 action 1; exec 518 "7 keywords below are already answered by a page you have … Refresh those pages instead of writing new ones". The discovery table's own "no page of yours answers this search" contradicts it in 11 rows (R12) |
| D12 AI Growth drafts to .gov / competitors | **gone** | Exec 511 `drafts_written 0`, `handed_over 9`; government pages get "apply … or cite it" |
| D13 Link Builder pitches | **gone** (residuals R4, P34-2) | Exec 508: 25 refusals with reasons, brand "Tech&", all 15 targets on www |
| D14 Reply Reader invents a fact | **gone** | Exec 490: "[Owner: confirm whether we are accredited with the Ministry of Finance or work through a partner]" |
| D15 no shared canonical host | **gone** | Every URL in the ladder plan, the fix-pack schema, the LB targets and AI Growth is `www.techand.ai`; exec 521: **0 bare-host URLs in the whole page payload**, `suggested_url` on www; exec 523 fix-pack schema on www with the real DAFZA address. One stored 2026-10-02 prospect row still carries `https://techand.ai/` |
| D16 wrong next step | **gone** | Exec 505: five ladder-specific next steps (§2.7) |
| D17 fix-pack robots drops Disallows | **gone** | `files/robots.txt` (exec 497) and `files/fixpack-robots-523.txt` (exec 523): "# Changes: none needed" + the three Disallow rules, byte-identical to the live `/robots.txt` fetched in the same minute |
| D18 "duplicate meta tags" false positive | **gone** | Execs 497/513 *What Works* explains the `theme-color` media pair |
| D19 AI request errors, brand/URL noise | **gone** | AI Pulse 21/21, `errors 0`. Exec 526: `errors 1` of 47 = **2.1%**, `retried 3`, `retry_answered 2`, the alert names the engine ("Google AI Overview — Internal SE Server Error. The rates below count the 33 answers that came back"), `engines[].errors` 0 elsewhere; 8 competitor brands all real domains; **30 of 30** cited URLs distinct with no `www.`, fragment or tracking parameter |
| D20 discovery inconsistencies | **gone** | Exec 518: 11 keywords flagged ladder-covered with ladder, part, rung and status; every AI Overview claim dated ("seen in the check at 06:49 UTC on 2026-10-13 … one observation"); 5 distinct domains in every "Who ranks now"; all 12 CPCs at 2 dp and no number over 2 decimals anywhere in the payload |
| D21 sparse Trends percentage | **gone** | Exec 515: four keywords `direction "sparse"`, `change_pct null`, "too little search data to read" |
| D22 description reads only the homepage | **partly** | Describe side gone (6 pages, 28 services incl. Business Central, `services_json` filled). The fit side regressed in this run: the same keyword returned `fit: null` (R3) |
| D23 Ahrefs DR retry, sister/off-topic prospects | **gone** (sister half still unexercised) | Exec 529: `dr_enabled true`, `dr_error ""`; **39 of 42** gap domains flagged `off_topic` with a reason; no `utm_*` / `srsltid`; no `clear.in`-style sibling in this run's data |
| D24 full-report inconsistencies | **gone** | Exec 523: exactly one author finding, no "capped at 85" claim at score 70 (the rule only in the Methodology), "2 scraper queries … left out of the top queries". Exec 497 had already fixed the scraper half (P1-3) |
| D25a missed schedules | **not exercised / open** | No week of schedules in scope; the n8n container had restarted again before this write-up (workflow re-imported 2026-10-13 06:02 UTC) |
| D25b one ops channel | **partly** | Exec 516 recorded the alert before sending (fix works), but the message is unreadable (R5), the e-mail failed, and all 3 rows stay `delivered: pending` with no webhook channel (R6) |
| D25c test check-in satisfies the month | **gone** | Exec 515 action 5 asks for October's check-in although the 2026-10-02 "(test)" row is still the only one |
| D26 AI Overview stated as fact | **gone** | Execs 486/495: "An AI Overview was seen in the check at 20:29/20:32 UTC on 2026-10-12 … one observation" |
| P1-1 ledger rows never settle | **gone** | `seo_run_ledger` rows 32–41: every mode `done`, refusals `refused` |
| P1-2 farm pages in "links lost" | **gone** | Exec 529: `lost []`, `at_risk []`, `important_lost []`, `rel_changed []`; the 17 farm links are listed as "set aside", carry no value and raise one low informational alert |
| P1-3 scraper regex misses `-site:` / lowercase booleans | **gone** | Exec 497 `scraper_queries` 4/6 impressions incl. a `-site:` chain; clean top-10 queries |
| P1-4 §4a lists navigational brands | **gone** (R13 is the wider hole) | Exec 523: "Navigational Keywords — No keywords with measurable search volume found for this intent." The brands that remain are classed informational / commercial (R13) |
| P1-5 float CPCs in §4a | **gone** | Exec 523 §4a: 0.49, 0.07, 3.10, 10.79 …, every value at 2 dp; exec 518's callback has no number with more than 2 decimals |
| P2-1 nav list from the wrong node | **gone** | Exec 485 `Nav Pages Plan` 5 items with `nav_source "site model"`, `pages_read_count 6` |
| P2-2 `services_json` always empty | **gone** | Site model `services` = 28 entries (execs 485, 497) |
| P2-3 bare-host URLs reach the owner | **gone** | No bare host in any delivered artefact; the 5 new ladder rows are all www |
| P2-4 "(undefined days)" | **gone** | Exec 515: "waiting 11 days", "(11 days ago)"; no "undefined" in the report |
| P2-5 verdict blind to the inventory | **gone** | Exec 486 `existing_page.source "page inventory"`, action `improve` |
| P2-6 placeholder gate misses the author box | **not exercised** | Exec 521 wrote a page, but `seo_profiles` is empty, so no author box was attached (`author null`, `reviewer null`, `profile_placeholders 0`, `eeat_notes []`) — the gate had nothing to count. Needs owner item O1 |
| P2-7 no word-count target in a Write-now run | **partly** | Exec 521: the app did pass a target (`ladder_words 1900`) and *Parse Brief* did clamp ("Target length 2400 -> 2200 words"), but it clamped to **the verdict's ~2,000**, not to the ladder's 1,900 — and the 1,900 itself is the ladder's **main-page** figure, because the rung row is still `target_words: 0` (R8). The page then shipped at 2,891 words (+31%) |
| G18-1 search page ranked best link | **gone** (observed) | Exec 529: "Best links" holds only peppol.org; `robuta.com/?q=business+impact` appears solely as a stored lost/reclaim prospect with score 0 |
| G18-2 cosmetic findings reported | **gone** | Execs 497/513: `minor_count 6` folded into one line, counted in the score |
| P34-1 stale drafts counted as new | **gone** | Exec 511 `drafts_written 0`, `handed_over 9`; the report claims no drafts |
| P34-2 "Tech&" matches as "tech" | **partly** | New claims gated, but the pre-fix "listed" rows for SaaSHub (`/tech`) and AlternativeTo survive and are reported; free re-check: 302 and 403 |
| P34-3 "no claim was wrong" with an empty profile | **gone** | Exec 526: `fact_check "no_facts"`; the report says "**What AI gets wrong: not checked** … nothing on file can judge what the answers claim … Your country and the services read off your website are context, not facts to check a claim against" |
| P34-4 gap list recommends .gov / spam | **gone** | Exec 523: "1 of 25 domains are worth a pitch. Top: uae-asp.ae. 24 are left out (e.g. mof.gov.ae — a government site …; buydofollow.site — its own name offers links …)"; the baseline's buyhighda.space / freedofollow.website table is gone |
| P34-5 stale reservations, heavy audits | **gone** (half) | Exec 485 `ledger_stale_released: 11`; `heavy: true` on both audit rows. The concurrent-heavy refusal was not exercised |
| P34-6 monitors call the business "techand.ai" | **partly** | AI Growth and the Link Builder say "Tech&"; exec 526 (AI Visibility Tracker) now carries `business_name "Tech&"` with 4 brand names and uses it in the report. Exec 529 (Backlink Monitor) has the name in its payload but its **report is headed "Backlinks: techand.ai" with 0 occurrences of "Tech&"**, and `brand_names` is still `["techand.ai"]` |

**Criteria gaps with live evidence in this run:** G1 (1 retry gate, 0 of 21 pulse requests failed), G3 (chance bands with the
Ahrefs 2025 base rate, marked uncalibrated), G6 (SERP features, competitors, modelled share of voice, mobile), G9 (862 rows,
anonymised share, brand split), G18-2, G19 (the site-model kit is inlined in 9 of the 10 workflows that ran — 25 nodes of the main
workflow, 6 of the Site Tracker, 4 of AI Growth, 2 of the Rank Tracker, 1 each in the Pulse, Cadence and Link Builder; not in the
Keyword Check, which reads the stored description instead), G22, G24 (100% crawl coverage), G25 (25 URL
inspections), G26, G28 (z-tests, core-update context), L2 (8 of 8 drafts held).

**The completion runs add the criteria gaps that needed a discovery, content, report, AI or backlink run:**

| Gap | Live evidence (2026-10-13) |
|---|---|
| **G8** discovery inputs | Exec 518: 10 Search Console seeds from 300 stored rows with no new API call (of "the 25 with impressions and no page of their own, and the 16 where you rank 8-20"), 16 striking-distance rows labelled as such, 36 keywords calibrated against measured impressions against 626 modelled with the label on every number, **5 SERP-overlap clusters** at ≥ 3 shared top-10 URLs, 15 live checks of a cap of 16 (≈ $0.03). One wrong sentence: R12 |
| **G5** originality | Exec 521: 2,762 eight-word windows against 8 pages already read (6 competitors + 2 own), `passed true`, highest overlap **0.1%** (one 10-word passage on the site's own Peppol article), threshold 15%, $0 |
| **G30** images produced | Exec 521: `images_planned 3`, `images_produced 3` — 1200×675 hero (20 KB) + two 1000×600 diagrams (38 / 37 KB), all WebP from the local Gotenberg container, planned file names, alt text and captions kept, all three delivered to the app as files and named in the publish checklist |
| **G33** coverage target | Exec 521: target **68% from the best competitor page** (cubesoftware.com, position 5, 9,436 words, 30 sections), the 6-page average (61%) shown beside it, the draft re-measured at 40% of 25 shared terms with the 10 missing terms and 3 missing subtopics named — and shipped below target |
| **G2** no FAQPage | Exec 521: `faq_count 0`, schema `Service` + `BreadcrumbList` only, 15 question headings answered in the body |
| **G4** claim checks | Exec 521: `sources_cited` graded per link (3 primary, 3 vendor, 1 weak), `unverified_statistics []` in the final round, no `utm_*` / `srsltid` |
| **G9** Search Console depth | Exec 523: 28-day totals, index coverage per state, 10 top queries with 2 scraper queries excluded (on top of the Site Tracker's 862 paged rows) |
| **G24** crawl coverage | Exec 523: "Crawled 45 of 45 known URLs (100%; sitemap 45 + 43 pages with Search Console impressions)", `crawl_complete true` |
| **G25** URL Inspection | Exec 523: **45 of 45** key pages inspected with the quota stated, 15 indexed / 30 not with Google's own reason, `canonical_mismatch []`, rich results. Its mobile-usability half produced R10 |
| **G26** priority order | Exec 523: the impact sentence (53.3 against 41.6) and the full ordering rule; `minor_count 6` folded into one line (G18-2) |
| **G1** retries | Exec 526: 1 of 47 requests failed (2.1%), the retry gate re-sent 3 and 2 answered |
| **G10** fact base | Exec 526: the gate switched **off** on an empty profile — `fact_check "no_facts"` and "not checked" in the report (P34-3) |
| **G23** Claude spend | Exec 521's three Opus streaming nodes report only `tokenUsageEstimate`, so the $0.44 Opus part of this window is an estimate; the ledger settles every run at its **estimate** ($2.26) against $2.88 actually spent |

**G7 could not be exercised** — the Chrome UX Report API is still not enabled, and all three reports (execs 497, 513, 523) print the
honest "not available" with the enabling step and score anyway. **G19** is inlined in 9 of the 10 workflows that ran (not in the
Keyword Check, which reads the stored description); **L1** is still unexercised (no mailbox).

### 3.2 New defects these runs reveal

Numbered **R1–R9** from the 2026-10-12 window and **R10–R16** from the completion runs of 2026-10-13, each group ranked by impact.

#### R1–R9 (2026-10-12 window)

**High**

1. **R1. A run refused by the budget guard leaves the ladder row saying "writing", and three features then report a page that does
   not exist.**
   - *Evidence:* exec 500 was refused (`Mark Run Refused`, ledger row 40 `refused`), yet `seo_ladders` row 19 ("service industry erp
     software") is still `status: "writing"`. Consequences in the same 90 seconds: the delivered ladder plan says *"Written now:
     'service industry erp software' (rung 2) — delivered separately as page content"*; the Rank Tracker (exec 505) says
     *"'service industry erp software' (already written — publish it)"*; the Content Cadence (exec 506) counts it as one of the
     **6 written pages waiting for publication** and pauses itself on the pile-up limit. The 2026-10-01 rows "uae e invoicing
     penalties" and "e invoicing uae fta" sit the same way (`seo_content_log` has them as `started`, never `written`).
   - *Where to fix:* the refusal path in `build_v4.py` (*Mark Run Refused* / *Refused Input*) — for a `ladder:`-keyed run, set the
     ladder row back to `planned` with the reason; and the ladder report should promise the page only after the spawn is accepted.
     The cadence / tracker / site tracker should count a row as written only when `seo_content_log` says `written`.

**Medium**

2. **R2. A finding in a category the audit declares "not assessed" is reported as "new" at every audit, and never affects the score.**
   - *Evidence:* exec 513's diff lists `new: ["Structured data with errors", Schema, Medium]` five minutes after exec 497 stored that
     exact finding (`finding_key "Schema|structured data with errors"`, 26 of 47 pages, impact 15). *Audit Diff* filters the previous
     findings with `assessed = new Set(Object.keys(a.weights))`, and `Schema` is not one of the 8 weighted categories — while the
     current findings are not filtered the same way. The audit's own `not_assessed` list says "Structured data (schema) and
     HTML-level checks" are not assessed by a technical audit.
   - *Where to fix:* *Audit Diff* in `build_v4.py` — filter `cur` and `prevF` through the same category set (or drop the filter and
     keep only the report-type rule); and decide whether a Schema finding belongs in a technical audit's weights at all.
3. **R3. The Keyword Check's topic fit fails on a real keyword and the answer ships without it.**
   - *Evidence:* exec 488 ("business central partner uae"): `Parser — Keyword Fit` failed **twice** with "The AI model returned an
     empty response to the Structured Output Parser"; the 200 response carries `fit: null` and the warning "topic check unavailable",
     and $0.024 was charged. This is the exact keyword D22's acceptance test uses, where the Phase 2 check got fit 2.
   - *Where to fix:* `Claude — Keyword Fit` / `Parser — Keyword Fit` in the Keyword Check (raise `maxTokensToSample`, simplify the
     output schema, or fall back to a plain-text parse); if the fit is unknown, say so in the label rather than only in `warnings`.
4. **R4. The Link Builder's competitor gate only looks at the prospect's page, so a competitor's guide passes.**
   - *Evidence:* exec 508 — `flick.network` is a `ready` resource prospect with a drafted sequence, although this run's Rank Tracker
     found it at **#1** for the ladder head "e invoicing in uae"; `basware.com` (an e-invoicing/AP vendor whose page text says "Why
     Basware · Invoice Lifecycle Management") is `needs_contact`. `comarch.com` was refused ("their page sells what you sell, 56% of
     your service words"), so the rule exists but fires only on product pages.
   - *Where to fix:* `v5/code/_outreach_kit.js` / *LB Assemble* — refuse on the prospect's **registrable domain** matching the site's
     competitor list (`seo_monitors.competitors`) or the SERP competitors the ladder/verdict just measured, not only on page-text
     overlap. (Asking a competitor's "best X" list to add you stays legitimate; pitching their guide does not.)
5. **R5. The Error Handler cannot read a trigger-mode failure: the alert loses the node, the message and the execution.**
   - *Evidence:* exec 516 — the Error Trigger payload is `{trigger: {error: {message: "The trigger node \"Mailbox Trigger\" failed at
     runtime and was deactivated", description: "IMAP connection closed unexpectedly", …}}}` with no `execution` object, and
     *Format Alert* produced `node "unknown node"`, `message "no message"`, `execution_id ""`, subject *"Run failed at 'unknown
     node'"*. The real cause never reaches the owner or the alert row.
   - *Where to fix:* *Format Alert* in the error handler (`build_site_tracker.py` / `build_v4.py` section for `SEOagentErrHandl`) —
     fall back to `trigger.error` (message, description, cause) and to `workflow.name` when `execution` is absent.
6. **R6. No ops alert has ever been delivered, and `seo_ops_alerts.delivered` is never written back.**
   - *Evidence:* the table holds 3 rows, all `delivered: "pending"`, `channels: "email,data_table"` — including the two from
     2026-10-12 18:34 whose `Email Ops` returned `accepted: [<ops address>]` (execs 464/465). Exec 516's e-mail failed with
     `getaddrinfo ENOTFOUND smtp.gmail.com` and `SEO_ALERT_WEBHOOK_URL` is unset, so that alert reached nobody at all.
   - *Where to fix:* after *Email Ops* / *Send Webhook*, update the row with the result (and the channel that carried it); a delivery
     rate (G21) cannot be measured until then. Owner step: set `SEO_ALERT_WEBHOOK_URL`.
7. **R9. The daily budget guard sees only the main workflow and the Keyword Check, and it counts AI spend only.**
   - *Evidence:* `seo_run_ledger` has no row for execs 502, 505, 506, 508, 511 or 515, although the AI Pulse alone cost $0.084 and
     the monitors account for ≈ $0.18 of this run's $0.578 of DataForSEO. Both audit rows carry `est_usd: 0` although each audit
     spent $0.09 on the crawl — so two customer-facing runs were refused for AI estimates while the measured money went out
     unguarded. `settled_usd` is still the estimate, not a measured cost (G23).
   - *Where to fix:* reserve and settle a ledger row in the monitor workflows too (the shared ledger kit), and carry a DataForSEO
     estimate (and the measured `run_ledger.dataforseo_usd` on settle) next to the AI estimate.

**Low**

8. **R7. The verdict and the ladder still tell the owner to add FAQPage schema, which G2 removed from the pages we write.**
   - *Evidence:* exec 486 `verdict_changes[3]`: "add … an FAQ with schema matching the People Also Ask questions"; exec 495
     `what_must_change[3]`: "Add an FAQ section that mirrors the People Also Ask questions, with FAQ and Service schema".
   - *Where to fix:* `v5/prompts/verdict.txt` and the ladder feasibility prompt — ask for an FAQ *section*, not FAQPage schema.
9. **R8. Rung pages carry no word-count target.**
   - *Evidence:* `seo_ladders` rows 19–22 have `target_words: 0` while the top page (row 23) has 1,900; the spawn body for exec 500
     carried `ladder_words: 0`. P2-7's clamp therefore protects only the page the verdict measured.
   - *Where to fix:* the ladder plan's rung pages (`write_now` / rung rows) — set a target per rung page from its own SERP word
     counts, as the top page gets from the verdict.

**Also seen (not numbered).** The two audits of the same site five minutes apart stored 27 of 30 findings each (the 3 `Info` ones are
not stored) — consistent, but it is why the diff's `previous.findings` (27) differs from the report's count (30). The fix pack
repeats the site's own `sameAs` LinkedIn URL, which differs from the profile the listings check found. `files/tech-audit-497.html` is
0 bytes (an artefact-capture slip; the audit HTML is in `files/tech-audit-497.txt`). The guard's refusal text shown to the app
("Raise `ai_budget_usd` in Normalize Input when you are ready to continue") is developer language in a customer-facing report.

#### R10–R16 (the completion runs of 2026-10-13)

**High**

10. **R10. The audit turns Google's "no data" into a High finding: every page is reported as not mobile-friendly.**
    - *Evidence:* exec 523 — all **45** URL Inspection responses return `mobileUsabilityResult: {"verdict": "VERDICT_UNSPECIFIED"}`
      (`files/full-report-523-url-inspection.json`); Google retired the Mobile Usability report and the API returns no verdict at all.
      The full report nevertheless raises **"Pages Google reports as not mobile-friendly", High, 45 of 47 pages (100%)** with **empty
      evidence** (*"/:  | /whatwedo/ai-automation:  | /whatwedo/assess-envision: "* — the issue list behind each colon is blank),
      ranks it **second of 60 findings by impact (41.6)**, and the audit diff presents it as the run's only **new** finding, so it
      will re-appear as "new" against the 2026-10-12 report for ever. Its impact basis claims *"about 720 clicks and 22,860
      impressions in the last 28 days"* while the whole site measured **38 clicks and 5,295 impressions** in that period: the
      site-average-per-page is multiplied by the pages affected with no cap.
    - *Where to fix:* the URL Inspection parser added for G25 (`GSC Audit Findings` in `build_v4.py`) — `VERDICT_UNSPECIFIED`, a
      missing `mobileUsabilityResult` or `VERDICT_UNSPECIFIED` for every page must read "not checked" and raise nothing (Google's
      field is deprecated; drop it or state that Search Console no longer answers it). Separately, cap a finding's clicks /
      impressions basis at the property's measured totals.
11. **R11. The written page is delivered with 12 placeholders although its own quality gate failed it twice.**
    - *Evidence:* exec 521 (`files/page-521-content-qa.json`) — Content QA round 1: `placeholder_count 6`, `placeholder_max 5`,
      `passed false`, `editor_needed true`; the editor ran; round 2: `placeholder_count 12` (**11 × `[Price]`**, 1 × `[Number]`),
      `passed false`, `editor_needed true`, `coverage_pct 40` against `coverage_target_pct 68` — and because `qa_max_rounds: 2` was
      reached the page went out. The delivered Markdown (`files/page-521.md`) reads *"40 fee-earners at an average rate of [Price]
      per hour"*, *"billings of [Price] a week (40 × 22.5 × [Price])"*, *"| Unlogged hours | 40 × 2 hours × 46 weeks = 3,680 hours ×
      [Price] | [Price] of work done but not billed |"* and *"- [Number] years of industry experience"*, plus two owner-fill markers
      the editor added (`[Microsoft partner designation and certifications held by Tech&]`, `[typical Tech& timeline for Business
      Central services project]`). The owner is told only **"Quality check: 6 item(s) to review"** — round 1's count — and nothing in
      the callback says the gate failed. The price mask was applied to an hourly rate the draft itself labels illustrative ("All
      figures are illustrative assumptions for a hypothetical firm"), which breaks the arithmetic of the whole worked example.
    - *Where to fix:* the QA loop and the delivery branch (`Content QA` / `Needs Revision?` / `Build Word File` in `build_v4.py`) — a
      run that exhausts `qa_max_rounds` with `passed: false` must report the **last** round's counts and say the page did not pass;
      and the `[Price]` / `[Number]` mask must leave figures inside a block the draft declares illustrative (or the editor must be
      asked to remove the example rather than the numbers).

**Medium**

12. **R12. Discovery says "no page of yours answers this search" in the same row where it names the page that earns the impressions.**
    - *Evidence:* exec 518, the report's "Searches your website already appears for" table (`files/ideas-518.txt`): **11 of 25 rows**
      carry the reason *"no page of yours answers this search"* while the last column names a live page of the site — including
      *"which dynamics 365 finance partner can help migrate a retail business in the uae"* (16 impressions, **position 6.2**,
      `/dynamics-365-finance-and-operations-uae`), *"dynamics 365 finance and operations pricing dubai"* (**#9.6**, same page) and
      *"pdf vs e-invoice uae"* (#20.4, `/insights/your-current-pdf-invoices-will-be-illegal-in-the-uae-by-2027-and-how-to-fix-it`).
      All of those pages are in the 45-page inventory and all return **200**; the same page is accepted two rows later ("dynamics 365
      finance and operations for retail uae … you rank #15.4 — striking distance"). Cause: `gscSeeds` decides only with
      `SM.matchPage` (slug / title term overlap above `MATCH_MIN`, or an exact stored query) and `use_row_page` is off while the
      inventory is non-empty, so the page Search Console itself reports is ignored. It is D11's cannibalisation risk in the discovery
      path: the owner is pointed at a new page for searches an existing page already ranks for.
    - *Where to fix:* `v5/code/_kw_inputs.js` (`gscSeeds`) — when the row names a URL on the site, use it as `answered_by` with its
      own label ("the page that gets the impressions does not target this search"), and never print "no page of yours answers this
      search" for a query the site already ranks for; the report's wording in the discovery file builder follows.
13. **R13. The full report's intent lists and keyword gap still recommend other companies' brands and off-topic searches — only the
    navigational class is gated.**
    - *Evidence:* exec 523 (`files/full-report-523.txt`) — §4a Informational offers **"ai" (165,000/mo), "character ai" (110,000),
      "google ai" (40,500), "humanize ai" (40,500), "meta ai" (22,200), "blackbox ai" (14,800)**; Commercial offers **"mh enterprises
      uae"**, "microsoft ai", "flow ai", "presentation ai"; Transactional offers "ai image generator", "ai video generator free",
      "face swap ai", "magic light ai", "ai photo generator". The gap table keeps "attestation", **"mofa attestation dubai"** and
      **"how to check emirates id status with passport number"**, and the High finding says *"Create or improve a dedicated page for
      the highest-volume, lowest-difficulty gap keywords first"*. The gate works for the class it is given — "Navigational Keywords:
      No keywords with measurable search volume found for this intent" and 40 queries left out of the gap with reasons — so the hole
      is that it is applied to intent only, not to brand ownership or topic distance.
    - *Where to fix:* *Analyze Keywords* in `build_v4.py` — run `_fit_gate.js` (already used for the gap's navigational class) over
      every intent bucket and over the gap list: refuse another company's brand whoever owns the SERP, and refuse a keyword whose
      topic distance from the site's services is beyond the same 25% bar the outreach gate uses.
14. **R14. The AI visibility market table credits the owner with 19,579 citing answers from a loose name match, beside its own "0 AI
    answers cite you".**
    - *Evidence:* exec 526 — `index.brands[0] = {key: "name:Tech&", you: true, name: "Tech&", domain: "", mentions: 19579,
      share: null, ai_search_volume: 16421600}`, and the delivered report prints **`"Tech&" by name (you) | 19,579 | — |
      16,421,600`** as the first row of *"Market-wide: every AI answer in the database"*, under the headline KPI *"Market-wide share
      0% — 0 AI answers cite you"*. The next row is microsoft.com with 1,897 answers. The run's own 54 samples named the business
      **0** times, and the site has 19 backlinks: the index matched the name "Tech&" against the whole "tech" family — the same
      4-character collapse as P34-2.
    - *Where to fix:* the market-index builder (`v5/code/_ai_stats.js` / `AI_Metrics.js`) — the owner's own row must come from a
      domain match; a name-only row has to be dropped, or labelled "not matched to your website", when the name is shorter than the
      brand-token bar or its mentions are orders of magnitude above the measured sample.
15. **R15. A write-now ladder page ignores the ladder row's planned URL and drops the ladder's planned links.**
    - *Evidence:* exec 521 — the ladder row's `target_url` is `https://www.techand.ai/service-industry-erp-software/` (and the
      ladder's link map, the sibling pages' up-links and the Rank Tracker's check all use it), while the delivered page's
      `suggested_url` is `https://www.techand.ai/service-industry-erp-software-uae/` and its slug is
      `service-industry-erp-software-uae`. Nothing reconciles the two, so publishing at the suggested URL leaves every stored link
      pointing at a URL that will never exist. In the same page, `meta.links_to_add_when_published` is **`[]`** although the app sent
      two planned ladder links (`ladder_links`: the main page `role: top` and one sibling, both `planned: true`) — the Phase 2 check
      had the planned links listed in `meta.json`.
    - *Where to fix:* *Parse Brief* / *Blog Package* in `build_v4.py` — for a run with a `ladder_id`, keep the ladder row's slug (or
      write the new slug back to `seo_ladders.target_url` in the same run), and put every `planned` ladder link into
      `links_to_add_when_published` instead of discarding it.

**Low**

16. **R16. A pre-fix ladder rung that is a competitor's brand is still planned, and still in the owner's reports.**
    - *Evidence:* `seo_ladders` for `lad_mv40b6s9h5a8` (created 2026-10-11, before D8's fix) still holds rung 2 **"facts erp"** →
      `https://www.techand.ai/facts-erp/`, `status: "planned"` — facts.ae is a competing UAE ERP vendor and was D8's original
      example. The Rank Tracker's delivered report of 2026-10-12 (exec 505, `files/rank-505-reports.json`) lists it among that
      ladder's pages. D8 stops new ones; nothing revisits the stored rows, the same residual pattern as P34-2's "listed" rows and
      P2-3's stored hosts.
    - *Where to fix:* a one-off cleanup of the stored ladder rows (as `fix_ladder_hosts.py` did for hosts), plus the fit gate on the
      read path the cadence and the Rank Tracker use, so a stored brand rung is dropped rather than written.

**Also seen in the completion runs (not numbered).** The guard's per-mode estimates are far from the money: `ai_visibility` was
reserved at **$0.06** and cost **$0.79**, backlinks at $0.04 for $0.37, the full report at $0.25 for $0.41, while the page was
reserved at $1.23 and cost about $0.46 — R9 from the other side. The full report's own `dataforseo_usd` (0.4674) is $0.058 above the
measured balance delta, while the page and the backlink run match to the cent. The page's two word counters disagree (Content QA
2,891 words, `meta.word_count` 2,727). The "measured" traffic label exists in the discovery data (36 calibrated keywords) but none of
the 15 keywords actually shown carries it, so every printed traffic figure reads "modelled". The written page links out to Oracle
NetSuite, SAP, Odoo and Workday — defensible on a "which ERP fits you" page, but they are the vendors the verdict calls competitors
and nothing flags it.

---

## 4. Owner items surfaced (not defects)

- **No business profile and no business facts.** `seo_profiles` is empty for techand.ai and the entity check reports
  `profile_set: false`, so 8 outreach drafts are held on "[Your name]" / "[Owner: confirm …]", the AI fact check switched itself off
  (`fact_check: "no_facts"`, exec 526) and the written page carries no author box at all (exec 521: `author: null`) (O1, O2). This is
  the single biggest blocker in both windows: four features did everything except the one thing only the owner can supply.
- **The IndexNow key file is still missing** — `https://www.techand.ai/e474f67e21841570c3de6d7624391652.txt` returns **404** on a
  free check, so AI Growth reports `indexnow: "key_missing"` and submits nothing (O6).
- **The Chrome UX Report API is not enabled** for the PageSpeed key's project, so all three reports — the two audits and the full
  report of 2026-10-13 (exec 523: `crux.available false`, `reason "api_off"`, 8 requests) — print "not available" for Core Web Vitals
  per template with the enabling step, and G7 still has no live values.
- **`SEO_ALERT_WEBHOOK_URL` is unset** and the SMTP host could not be resolved at 03:07 UTC, so the ops alert of that run reached
  nobody (R5, R6).
- **The Console Alerts IMAP trigger fails at runtime** ("IMAP connection closed unexpectedly") and n8n deactivated and retried it;
  the Gmail app-password credential for the watcher is still the open item it has been since v4.3.
- **Six written pages wait to be published** (the cadence names them), one of which would duplicate a live article
  (…/insights/the-cost-of-non-compliance-uae-e-invoicing-penalties-mitigation-costs). Since exec 521 the sixth, "service industry erp
  software", really exists — but it is the page R11 describes, so it needs the `[Price]` / `[Number]` placeholders filled or the
  worked example removed before it can go live. The weekly cadence stays paused until the owner acts (O9).
- **October's Search Console check-in is unanswered** (the only row is the 2026-10-02 test row); the Site Tracker now asks for it
  (O5).
- **Accreditation positioning (O3)** decides the quality of several features at once: the verdict's risks, the AI questions to win,
  the MoF and OpenPeppol listings (both "missing") and the held outreach drafts all hang on whether Tech& is an accredited ASP, a
  partner of one, or neither.
- **The AI question panel is still 7 asked of 8 stored** (O8), so the pulse's 95% range stays wide (0–15.5%).
- **True audit findings to fix on the site:** lorem ipsum live on /industries (verified), **30 of 45 key pages not indexed** by
  Google (21 unknown to it, 6 discovered-not-indexed, 3 with another canonical — the full report of 2026-10-13 asked Search Console
  about all 45), 6 orphan pages, HTML not cacheable, a missing meta description and a doubled brand in one title, schema errors on
  26 pages (O10). The "not mobile-friendly" finding in the same report is **not** one of them (R10).
- **A competitor's brand is still queued as a ladder page:** rung 2 of `lad_mv40b6s9h5a8` is "facts erp" → /facts-erp/ (R16).
  Delete the row or let the owner confirm it before the cadence reaches it.
- **Rotate the app hook token and `SEO_API_KEY`.** The company's callback token appears in plain text inside the stored execution
  data of both windows, and both the token and the company id appeared once each in tool output while these documents were written
  (no file in the repository carries either; the saved artefacts are redacted).

## 5. State left behind

**Changed for the runs, left in place**
- **The Test Runner (`SEOagentTestRun1`) is inactive again** (`active: false`, verified after the completion runs). None of the five
  completion runs needed it: all five went through the API front door.
- Link Builder **on** for techand.ai (`seo_monitors.link_builder = true`, set by exec 482 — it was already on from 2026-10-11).
- The Reply Reader stays published and active; no mailbox is connected.
- 20 workflows published, the main workflow at **448 nodes** — which is the build the completion runs exercised (the 2026-10-12
  window ran on 437; see "Outside this run" below).

**Real outputs**
- A new ladder **`lad_mv5pjt5y4aoa` "erp implementation dubai"**: 5 `seo_ladders` rows (4 rung-2 + the main page) and a
  `seo_ladder_settings` row (Auto, priority 5, active). **Row 19 ("service industry erp software") is `status: "writing"` — and since
  exec 521 that is the correct state, not R1's stuck one:** `seo_content_log` row 4 now holds that keyword as **`status: "written"`,
  `request_id: 520`**, so the page the 2026-10-12 reports promised really exists (as a document, unpublished). R1 itself is unfixed —
  the refusal path never reset the row, and `seo_content_log` rows 1 and 2 ("e invoicing uae fta", "peppol uae") are still `started`
  from runs that never finished. The ladder's other four target URLs (/dynamics-365-erp-system/, /ms-dynamics-implementation-
  partners/, /erp-customer-relationship-management/, /erp-implementation-dubai/) are still unwritten and answer 308 → 404.
- **The written page itself** (exec 521, delivered to the app, nothing published): Word, PDF, HTML, Markdown, `meta.json` and **three
  WebP images** (20 / 38 / 37 KB). It carries the 12 placeholders of R11, so it is not publishable as delivered.
- 1 new `seo_audits` row from the full report (**`aud_mv6cf3ru39g`**, `report_type full`, health 70, 2026-10-13 07:11:59) with 50
  `seo_audit_findings`; the table now holds **14 audits and 487 findings**.
- 1 new `seo_ai_visibility` row (`ai_20261013_techand-ai`, 54 samples, mention rate 0, visibility score 0) with its
  `seo_ai_answers` (473 in total), and 1 new `seo_backlink_snapshots` row (id 13, mode `full`, 18 referring domains / 19 backlinks);
  `seo_backlinks` holds 20 ledger rows (5 live), `seo_link_prospects` 144.
- 2 new `seo_audits` rows (`aud_mv5poznfsvy` 20:35:49 and `aud_mv5pvm4puiu` 20:40:58, both health 83 / 27 stored findings) and 54 new
  `seo_audit_findings` rows; `seo_audits` now holds 13 audits and 437 findings.
- 15 new `seo_rank_history` rows (72 total), 1 `seo_ai_daily` row (5 total), 1 `seo_site_metrics` row (6 total), 1 `seo_ai_growth`
  row (7 total), refreshed `seo_link_outreach` (148), `seo_link_prospects` (143), `seo_listings` (16), `seo_pages` (45),
  `seo_cache` sitemap fingerprint.
- 9 new `seo_run_ledger` rows (7 `done`, 2 `refused`) and **11 pre-existing stale reservations released** ($0.77 freed) on
  2026-10-12, plus **6 more rows on 2026-10-13 (ids 42–47, all `done` and settled, $2.26 of estimates)** — 47 rows in all
  (`files/run-ledger-2026-10-13.json`).
- 16 reports in the app from the first window (14 callbacks + 2 rejections) and **8 more from the completion runs** (6 reports with
  their files + 2 `…_started` acknowledgements). `seo_pages` stays at 45 rows, `seo_content_log` at 4, `seo_query_history` at 1,397.
- 3 rows in `seo_ops_alerts`, all `delivered: pending`.

**Not changed, in either window:** no code, workflow, prompt, limit or table column — in particular `ai_budget_usd` is still $6 and
the completion runs were made possible only by the day boundary; no `apply_env.py`, no import, no `sync_tables.py`; no page
published; no profile, check-in or `published` row written; no Site Admin action; no temporary workflow; no e-mail to a third party
(the Link Builder was not re-run and nothing was approved); no Data Table row deleted or edited by hand. `SEOagentTmpTest1` no longer
exists in n8n and the Test Runner ends inactive.

**Which build each window exercised.** The 2026-10-12 window ran on the **437-node** main workflow. It was re-imported at 441 nodes
at 06:02 UTC on 2026-10-13 (G8's three discovery nodes) and the Page Watch workflow (G11 / G25) was deployed the same morning; by the
time the completion runs started the main workflow stood at **448 nodes** and carried, besides G8, the `Originality Check` (G5) and
`Image Cards` → `Render Images` → `Attach Images` (G30) nodes, which is why those gaps have live evidence for the first time.
Everything in §2.11–§2.15 and R10–R16 is from that 448-node build; §2.1–§2.10 and R1–R9 are from the 437-node one. Code merged
**after** the completion runs (G12 annotations and change tests, G29 lineage) is in neither build and has no live evidence here.

## 6. Artefacts (`files/`, git-ignored)

| Run | Files |
|---|---|
| Spend and tokens | `spend-before.json`, `claude-tokens.json`, `run-ledger-after-refusal.json`, `ops-alerts.json` |
| describe / verdict / keyword checks | `describe-run485.json`, `site-description-techand-ai.html`, `verdict-486-parse.json`, `keyword-verdict-…{pdf,doc}`, `keyword-checks.json` |
| Ladder and the refused page | `ladder-plan-495.json`, `keyword-ladder-erp-implementation-dubai-…{pdf,doc}`, `spawned-page-body-500.json` |
| Audits | `tech-audit-497-{report,diff,site-issues}.json`, `tech-audit-497.txt` (the delivered HTML), `site-audit-techand-ai-…{pdf,doc}`, `auditsched-513-{site-audit,diff}.json`, fix pack (`robots.txt`, `llms.txt`, `organization.jsonld`, `localbusiness.jsonld`, `website.jsonld`, `internal-links.csv`, `README.txt`) |
| Monitors | `pulse-502-{metrics,alerts}.json`, `pulse-502.{html,txt}`, `ai-pulse.html`, `rank-505-{Tracker_Plan,report,reports}.json`, `rank-report-505.{html,txt}`, `cadence-dry-506.json`, `growth-511-metrics.json`, `growth-report-511.{html,txt}`, `site-tracker-515-{brief,metrics}.json`, `site-report-515.{html,txt}` |
| Link building and replies | `lb-508-{assemble,draft-qa,report}.json`, `lb-report-508.{html,txt}`, `seo-listings.json`, `reply-reader-tests.json` |
| **Completion runs — spend and ledger** | `spend-2026-10-13.json` (the six balance probes and the per-run deltas), `claude-tokens-2026-10-13.json` (per node, with the three `tokenUsageEstimate` nodes marked), `run-ledger-2026-10-13.json` |
| **Completion runs — discovery** | `discover-518-strategy.json`, `callback-518-keyword-strategy.json`, `ideas-518.txt` (the delivered document as text), `keyword-ideas-techand-ai-2026-10-13.doc`, `callback-519-keyword-report.json` |
| **Completion runs — the written page** | `callback-521-page.json`, `page-521.md`, `page-521.html`, `page-521-content-qa.json` (both QA rounds), `page-521-originality.json` |
| **Completion runs — full report** | `callback-523-full-report.json`, `full-report-523.txt` (the delivered document as text), `full-report-523-url-inspection.json` (45 index / mobile verdicts — R10's evidence), `fixpack-robots-523.txt` |
| **Completion runs — AI and backlinks** | `callback-526-ai-visibility.json`, `ai-report-526.txt`, `callback-529-backlinks.json`, `bl-report-529.txt` |

Callback tokens, the company id and e-mail addresses are redacted in the saved artefacts. The prospects CSV was not saved and the
completion runs' backlink / outreach artefacts have their contact fields replaced with `<redacted>`: they hold third-party contact
data and this repository is public.
