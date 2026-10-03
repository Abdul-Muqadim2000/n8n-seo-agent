# Pipeline and keyword ladders — feature spec (v4.8, 2026-10-03)

Status (2026-10-03): **all four phases built, tested and deployed** on the local stack (app + n8n). Harness 1227 runs, 0 failed;
app 168 unit tests, smoke test ALL PASSED (63 checks). **Not yet verified live with paid calls**: the keyword check (~$0.05 each),
a ladder run with the new plan types and settings (~$1.80), publish detection on a Site Tracker run (~$0.03-0.10). App extras
beyond the spec: `keyword_checks` table (7-day cache, 30 a day per company, counted in the budget), ladder preferences applied when
the plan arrives (admin only), "Choose keywords for me" behind `AUTO_START_LADDERS` (off by default), a Needs-you item for refused
plans. WordPress is not wanted for now. `Cadence_Plan.js` and the app's `server/src/services/cadence.ts` (a rule-for-rule port used
for "This week" and the cards' next step) must change together.
Covers the requests of 2026-10-03: a Pipeline page that shows several keyword ladders per
website with their flow and results; every step available both **automatically and by hand**, so someone without SEO knowledge
can use it; keyword choice where the system recommends and the person may pick their own; ladders that start with what is easy
for *this* site and go straight to the main keyword when it is already easy; and the SEO safety rules discussed (no overlap, stay
on topic, steady pace).

## 1. Words used in the app

| Word | Meaning |
|---|---|
| **Website** | One verified domain of a company. |
| **Pipeline** | Everything that runs automatically for one website: its keyword ladders plus the always-on part. One per website. |
| **Keyword ladder** | The plan to rank for one main keyword: pages from easy to hard, each with its own keyword, linked together. Many per website. (n8n: `seo_ladders`, one row per page.) |
| **Main keyword / main page** | The keyword the ladder is for, and its page (n8n: head keyword, rung 4, "top page"). |
| **Rung** | A difficulty level inside a ladder (1 = easiest). |
| **Always on** | Opportunity posts (Search Console queries close to page one, rising Google Trends searches) and monitoring (AI visibility, backlinks, audit, weekly report). |
| **Auto / Manual** | Per ladder and per always-on item: the system does the next step itself, or prepares it and waits for one click. |
| **Needs you** | The list of things only a person can do (publish a page, approve a step, fix a connection). |

"Campaign" is not used.

## 2. SEO rules the system follows

| # | Rule | Why (source) | How the system applies it |
|---|---|---|---|
| R1 | **One search, one page.** | Google usually shows at most two results from one site per search ([2019 site-diversity change](https://searchengineland.com/google-search-update-aims-to-show-more-diverse-results-from-different-domain-names-317934)); two pages for one search compete. | One keyword per page, one ladder per keyword. Blocks exact and near duplicates across ladders, pages and the blog queue (§5.4). |
| R2 | **Stay on your topic.** | Google's helpful-content questions: "producing lots of content on many different topics…", "a primary purpose or focus" ([Creating helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)). | Topic check on every new ladder (§5.4); focus on a few active ladders at a time (§6.3). |
| R3 | **Steady pace, never mass production.** | [Scaled content abuse](https://developers.google.com/search/docs/essentials/spam-policies): "many pages generated for the primary purpose of manipulating search rankings", however they are made; AI content is fine when it helps people ([Google, 2023](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content)). | At most 3 new pages a week per website, shared by all ladders; every page researched, edited, QA-checked, with the E-E-A-T profile; no writing while pages pile up unpublished (§6.4). |
| R4 | **Difficulty is personal.** | The same keyword is easy for an established site and hard for a new one (Semrush's [personal keyword difficulty](https://de.semrush.com/kb/1434-how-is-personal-keyword-difficulty-calculated)). | "Difficulty for your site" from what the site already ranks for (§5.3) replaces the fixed difficulty limits. |
| R5 | **Easy pages first, main page last — unless the main keyword is already easy.** | Supporting pages first, then the hub, is the usual topic-cluster order ([e.g.](https://www.contentgrip.com/how-to-build-a-topic-cluster/)); low-competition keywords rank much faster ([Ahrefs](https://ahrefs.com/blog/how-long-does-it-take-to-rank/)). | Plan types Direct / Short ladder / Full ladder (§5.5); the main page waits until the ladder has support (§6.2). |
| R6 | **Months, not weeks.** | Only 5.7% of new pages reached the top 10 within a year; those that did took about 2-6 months ([Ahrefs](https://ahrefs.com/blog/how-long-does-it-take-to-rank/)). | Every plan shows a month range and the dashboards measure progress (pages live, positions moving), not just "rank #1". |

## 3. Today (from the code) and the gaps

- Discovery (`discover`) recommends keywords in Now / Next / Later tiers; "winnable" is a fixed difficulty ≤ 55 (`Rank_Keywords.js`). The
  n8n form has "Let the system choose"; the app's keyword-strategy report only offers **Write a page** per keyword, not **Rank for it**.
- A ladder (`ladder`, $1.80 with one page) always has rungs 1-3 + the main page, assigned by **fixed** difficulty (rung 1 ≤ 25,
  rung 2 ≤ 45, rung 3 ≤ 60; `Ladder_Plan.js`). The main page is always written last; a site that already could win the main keyword
  still waits months. Feasibility is winnable / stretch / unrealistic with alternatives.
- The Content Cadence writes ladder pages for **all** ladders interleaved by rung (`Cadence_Plan.js`), then opportunity posts. No
  priority, no pause, no manual mode per ladder; it keeps writing while pages wait unpublished.
- The rank tracker recommends the next rung (recommend-only); nothing marks a ladder as won or stuck.
- Publishing is manual ("I published it"); the WordPress draft sub-workflow exists but is off and has one shared credential.
- Duplicates: the app warns on an exact repeat of a main keyword or page keyword only. techand.ai has two ladders for
  "e invoicing in uae" (`lad_mur2cjwk8gp0` is the duplicate).
- The Pipeline page is one stream per website (growth loop, automations, mixed queue, calendar, activity).

## 4. The Pipeline page

### 4.1 Pipeline home (`/sites/:site/pipeline`)
1. **This week**: the next Monday's runs in order with what each touches ("08:00 Rank check: 2 ladders, 18 pages · 10:00 Blog post:
   'accredited service provider…' for ladder 'e invoicing in uae'"), and anything running right now.
2. **Needs you** (only when not empty): pages waiting to be published (oldest first, with days), steps waiting for approval
   (Manual ladders), overlaps / duplicates, failed runs, broken connections. Each item has one button.
3. **Keyword ladders**: one card per ladder, in priority order, with drag-to-reorder or up/down buttons (§6.3):
   - main keyword · country · **status** (icon + word: Planning, Writing, Climbing, Won, Paused, Needs you, Stuck);
   - **progress bar** of its pages: published / written, waiting / being written / planned;
   - main keyword position now, change this week, small trend line; pages in the top 10;
   - **next step** with its date ("Mon 12 Oct writes page 3" or "Waiting for you: publish 2 pages");
   - Auto / Manual chip; monthly cost; overlap warning when it shares keywords with another ladder.
   - **+ New keyword ladder** opens the keyword flow (§5).
4. **Always on**: Opportunity posts (queue, Auto/Manual) and Monitoring (AI visibility, backlinks, audit, weekly report: on/off,
   next run, last result, Run now).
5. **Weekly capacity**: "1 post a week · used by: ladder 1 → ladder 2 → opportunity posts" with a link to change it.
6. **How it works** (collapsible, replaces the growth-loop strip): one ladder's life in 6 steps with the website's own numbers.
7. Calendar (4 weeks) and recent automatic runs stay, filterable by ladder.

### 4.2 Ladder detail (`/sites/:site/pipeline/ladders/:ladderId`)
- **Header**: main keyword, country, plan type (Direct / Short / Full), started, expected months, status, Auto/Manual switch,
  Pause/Resume, More (change priority, delete).
- **Key numbers**: main keyword position · pages live x/y · pages in top 10 · clicks and impressions from the ladder's pages (28
  days, Search Console) · next step and date · cost so far.
- **The climb** (the flow, read left to right): columns Rung 1 → 2 → 3 → Main page; each page a node with its status (✓ live with
  position, ✎ written — publish it, ⟳ being written, ○ planned, ⏸ waiting for support) and lines to the main page (internal links).
  Click a node: keyword, why it is on this rung, difficulty for you, page type, URL, its run, report and files, "I published it",
  "Write now".
- **Timeline**: past (planned, pages written, published, first top-10, drops) and next (the coming Mondays for this ladder).
- **Results**: position over time — main keyword plus the best page per rung (one y-axis, inverted; table view); clicks and
  impressions of the ladder's pages per week.
- **Reports**: the ladder plan and the weekly rank reports of this ladder only.

### 4.3 Elsewhere
- Rankings page: keeps tracked keywords and a ladder summary; ladder rows link to the ladder detail (no second ladder view).
- Recommendations: "write the next rung" items open the ladder detail.
- Keyword-strategy report: each keyword gets **Rank for this keyword** (opens §5 with the keyword) next to **Write a page**.

## 5. Choosing the keyword

### 5.1 Two ways in, one result
**New keyword ladder** opens a 3-step flow:
1. **Choose the keyword**
   - *Recommended for you*: the latest discovery for the website (or "Find keywords for me", $0.40) as cards, best first, each with
     searches a month, **difficulty for your site**, plan type, expected months, why it fits your goal. **Choose for me** picks the
     first card.
   - *I have a keyword in mind*: type it → **Check it** (§5.2, ~10 s, about $0.05) → the same card. Not realistic → its
     alternatives as cards.
2. **Review the plan**: plan type and pages (§5.5), the checks (§5.4), Auto or Manual, priority (first / after the current ones),
   pages to write now (1-3), cost now and per month.
3. **Start**: the ladder run (existing `ladder` mode with the new fields); it appears on the Pipeline page at once as Planning.

### 5.2 Keyword check (new, fast) — n8n part built (v4.8)
A synchronous n8n endpoint (webhook workflow like `SEOagentAdminAPI`, `POST /webhook/seo-keyword-assess`) for one keyword:
- DataForSEO: keyword overview (volume, difficulty, intent, CPC), the website's position for it, the website's reach (§5.3, cached
  30 days in `seo_cache` as `reach:<site>`).
- One small Claude call: topic fit with the business profile (0 off-topic / 1 related / 2 core), and navigational / other-brand.
- Answer: `{ keyword, volume, kd, intent, position, reach, difficulty_for_you, plan_type, months, fit, alternatives[] }`.
- App: `POST /api/orgs/:org/sites/:site/keywords/assess` (member; counted in the budget; 30 a day per company).

**As built (workflow `SEOagentAssess`, "SEO Agent — Keyword Check", `build_api.py`, code `v5/code/Assess_*.js`, prompt `v5/prompts/keyword_fit.txt`):**
- Request: `POST /webhook/seo-keyword-assess`, header auth with the credential "SEO API Key" (as the API front door), `X-Forwarded-For: app:<company id>`
  for the per-company limit. Body `{ keyword, country, domain, business?, services?, existing_keywords? }` — keyword 2-100 characters, country =
  a name or ISO-2 code of the main workflow's country list, domain = a public hostname (the main workflow's `cleanDomain` / `domainOk`, copied in
  at build time); `services` an array (or comma text), `existing_keywords` an array (the website's ladder / page keywords: never suggested back).
- Steps: validate → load `seo_cache` (`reach:<site_id>`, `desc:<domain>`) → DataForSEO Labs in parallel: `keyword_overview` (volume, kd, intent,
  CPC), `ranked_keywords` filtered on the exact keyword (the site's position), and only without a stored reach `ranked_keywords` (top 10, 100 by
  volume) + `domain_rank_overview` → one Claude Haiku 4.5 call (400 tokens max; topic fit, navigational / other brand, alternatives; business
  context = the request, else the stored homepage description) → answer → the newly measured reach is stored after the answer.
- **200**: `{ ok: true, keyword, country, volume, kd, intent, cpc, position, reach, difficulty_for_you, plan_type, months, fit, navigational,
  alternatives, cost_usd, label, stretch, position_url, reach_info: { method, p75, size_reach, sample, top10, cached, cached_at }, business_source,
  warnings }`. `plan_type` is `direct | short | full | none` (none = not realistic), `months` a range text (`"4-8"`, `""` for none), `fit` 0 / 1 / 2
  (`null` when the Claude call failed — then `navigational` comes from DataForSEO's intent, never for the site's own brand), `alternatives` (up to 3)
  only when not realistic or `fit` 0. Example: `{ ok: true, keyword: "e invoicing software uae", country: "United Arab Emirates", volume: 480,
  kd: 38, intent: "commercial", cpc: 7.25, position: null, reach: 30, difficulty_for_you: "reachable", plan_type: "short", months: "4-8", fit: 2,
  navigational: false, alternatives: [], cost_usd: 0.042, label: "Reachable for your site · Short ladder · 4-8 months", ... }`.
- **400** `{ ok: false, error, errors: { keyword | domain | country | business | services | existing_keywords: message } }` · **429** `{ ok: false,
  error }` (40 a day per `app:<company>` caller, 400 a day in total; the app's own limit is 30) · **502** `{ ok: false, error: "DataForSEO keyword
  overview failed: …" }`. Failed reach calls do not fail the check (starting reach 10, a warning, nothing stored).
- Cost: DataForSEO ~$0.02 with a stored reach, ~$0.05 without (+ Claude ~$0.002); `cost_usd` reports the DataForSEO task costs + $0.002.
  Time: about 5-15 s (HTTP timeout 15 s per call, the calls run in parallel).

### 5.3 Difficulty for your site ("reach") — built (v4.8)
- Input: DataForSEO Labs `ranked_keywords` for the domain (keyword difficulty + position per keyword, one call) and
  `domain_rank_overview` (keywords in the top 10).
- **Reach** = the 75th-percentile difficulty of the keywords the site already ranks top 10 for (at least 5 of them); otherwise by
  size: 0-4 top-10 keywords → 10 · 5-49 → 20 · 50-499 → 35 · 500+ → 50. Ranking top 20 for the keyword itself counts as easy.
- Difficulty for your site: **Easy** (difficulty ≤ reach + 5, or already top 20) · **Reachable** (≤ reach + 20) · **Hard** (≤ reach +
  40) · **Very hard** (above) · **Not realistic** (navigational / another company's brand / verdict AVOID). Unknown difficulty counts
  as reach + 10.
- **As built:** one copy of the rules in `v5/code/_reach.js`, inlined by the build into Ladder Plan, the discovery reach nodes, Rank Keywords,
  Build Keyword Strategy and the keyword check. The 75th percentile uses linear interpolation (rounded); the size comes from
  `domain_rank_overview` (keywords in positions 1-10), else from the count in the ranking pull. Stored 30 days in `seo_cache` as
  `reach:<site_id>` with its market (`location_code`): another market or an older value is measured again; a value that could not be measured
  (both calls failed) is never stored. The ladder uses a stored reach first (so the plan matches the check the person saw), otherwise measures it
  from its own `ranked_keywords` pull (now with each keyword's difficulty) and the site authority, and stores it. "Strong site" (shorter months):
  100+ keywords in the top 10, 1,000+ ranking keywords, or already top 20 for the keyword.

### 5.4 Checks before a ladder starts
- **Duplicate**: same main keyword as a ladder → warning + "… anyway" tick (built).
- **Overlap** (new): two keywords overlap when their word sets (stemmed, stop words removed, place names kept) are equal or 75%+
  the same (Jaccard). Checked against every ladder's main and page keywords and the blog queue; shown as "overlaps with ladder X:
  pages Y, Z". In n8n, a keyword already in another ladder is never planned again (`Ladder_Plan.js` reads the website's ladders). **Built
  (v4.8):** the ladder run loads the website's `seo_ladders` rows (bare domain and `www.`) and settings; candidate and supporting keywords that
  overlap any keyword of another ladder (same rule as `app/shared/src/ladders.ts`: one-letter words and stop words out, light stem, Jaccard ≥ 0.75)
  are left out and listed (`excluded_keywords`, a note in the plan); a main keyword that overlaps another ladder's main keyword is **refused** (no
  pages, no rows, `refusal.reason: "duplicate"`); archived ladders do not count. Known limit of the shared rule: numbers of one character drop out,
  so "phase 1 …" and "phase 2 …" count as the same search.
- **Topic** (new): fit 0 → "This looks outside your business — Google rewards sites that stay on their topic" (warning, not a block).
- **Budget**: the ladder's first run and its monthly cost against the company budget (built for runs).

### 5.5 Plan types — built (v4.8)
| Difficulty for your site | Plan | Pages | Order |
|---|---|---|---|
| Easy | **Direct** | main page + 2-3 supporting pages | main page **first**, supporting pages link to it |
| Reachable | **Short ladder** | 3-5 supporting pages + main page | supporting pages, then the main page |
| Hard | **Full ladder** | 8-12 pages in rungs 1-3 + main page | rung by rung, main page last |
| Very hard | **Full ladder (stretch)** | as Full | as Full; alternatives shown first, the person confirms |
| Not realistic | none | — | alternatives only |

Rungs become **relative to reach**: rung 1 ≤ reach, rung 2 ≤ reach + 15, rung 3 ≤ reach + 30; above that "later" (replaces 25 / 45 /
60). Months: Direct 2-4, Short 4-8, Full 9-15 (shortened as today when the site is strong).

**As built:** Direct keeps up to 3 supporting pages (rung order), Short up to 5, Full the rung limits as before (4 / 4 / 3); pages beyond the plan
go to "later" (`held_back`). Direct: the main page is page 1, written first (`write_now[0]`), linking down to its supporting pages; timeline = the
main page then the supporting pages, all in months 2-4. Short: supporting pages months 1-3, main page 4-8 (not in `write_now`; the cadence's gate
holds it). Full: rungs as before, the main page in months 9-15. Strong site: direct 2-3, short 3-6, full 6-12. Not realistic (verdict AVOID,
navigational / another company's brand): `plan_type: "none"`, no rows, no page runs, the alternatives (verdict suggestions, else the best rung-3/2
pages). Very hard: full with `stretch: true`; the alternatives come first in the plan report ("Consider first"). The plan report has a new section
**"Why this plan"** (the site's reach and how it was measured, the keyword's difficulty for this site, the plan, its order and months); difficulty
labels in the report are relative to reach ("31 · easy for you").

## 6. How a ladder runs

### 6.1 Every Monday, per website
Rank check (08:00) for every page and main keyword → the Content Cadence (10:00) fills the week's slots (§6.3) → pages arrive as
reports (HTML, Markdown, meta.json, Word, PDF) → published (by the person, WordPress, or detected, §6.5) → tracked from then on.

### 6.2 Order inside a ladder
- Pages are written by rung (Direct: main page first).
- The **main page waits for support** in Short / Full ladders: it is written when half of the supporting pages are published, or
  when the main keyword already ranks top 30.
- **Won**: main keyword in the top 3 for 4 weekly checks → status Won, no more writing, tracking continues; a drop of 5+ places
  suggests a refresh. **Built (v4.8):** the Rank Tracker no longer stops a won ladder: its main keyword and published pages are checked once a
  month (failed checks skipped); a drop below the top 3 brings it back to weekly checks; `won` stays in the callback.
- **Stuck**: no published page of the ladder improves for 8 weeks → status Stuck with suggestions (backlink prospects, refresh the
  best page, internal links).

### 6.3 Several ladders together (priority, focus)
- Each ladder has a priority (1 = first). The week's slots go to the **active Auto ladders in priority order** (ladder 1 until it
  has nothing eligible — all written, or the main page waiting for support — then ladder 2), then to opportunity posts (if Auto).
- At most **2 active Auto ladders** at a time (focus, R2); more ladders wait as "Queued" and start when one is Won, fully written or
  paused.
- Pause stops writing for that ladder (tracking continues, it costs about $0.10 a month); Resume puts it back in its place; Delete
  removes its rows in n8n (built for website delete).

### 6.4 Pile-up guard
When 3 pages of a website are written but not published (and no automatic publishing is connected), the cadence writes nothing new
for that website and **Needs you** says "Publish the waiting pages to continue". It saves paying for pages nobody publishes. Write
now still works (with the existing pipeline notice).

### 6.5 Publishing
- Manual: download / copy the page, then "I published it" (built).
- **Detection** — **built (v4.8, n8n part; harness S26; not deployed)**: every Site Tracker run (Monday 09:00 and on demand) looks for
  the pages written but not published: `seo_content_log` rows "started" without a link from the last 120 days, plus `seo_ladders`
  rows "writing" (one candidate per keyword; an older log row of the same page is kept with it). **A site with none makes no request.**
  Otherwise it reads `https://<domain>/sitemap.xml` (an index: its 5 most recently changed child sitemaps, tag / category / author /
  image / video sitemaps last; at most 5 MB per file and 20,000 URLs per site) and compares every URL **host-agnostically** (www. or
  not, http or https, no query / fragment, case and trailing slash ignored; only the site's host and its subdomains):
  1. **Slug**: the URL's path equals the ladder row's planned path, or its last segment equals the planned slug or the keyword's slug
     (lowercase, words joined by "-", e.g. `e-invoicing-in-uae`). Best first: planned path, planned slug, keyword slug, fewer folders.
  2. **Title / H1**: for at most 10 pages still unmatched (newest first, keywords with 2+ significant words), the URLs whose slug holds
     ≥ 60% of the keyword's significant words (the app's word rules from `_reach.js`: stop words and one-letter words out, light stem;
     words of 5+ letters also match by prefix) are read — at most 5 per page, **15 per site and week** (100 per run), round robin so
     every page gets its best candidate read first — and a page whose `<title>` or first `<h1>` holds ≥ 80% of them matches
     ("e invoicing uae penalties" never takes a page titled "UAE e-invoicing: FTA rules": 2 of 3 words).
  - Never claimed: URLs of other pages of the site (published pages, pages that existed before) and URLs whose sitemap `lastmod` is
    before the day the page was written (one day of slack for time zones). A page that improves an **existing** URL (striking-distance
    rewrite, ladder page that already existed) matches that URL only when its `lastmod` is on or after the day it was written (no
    `lastmod` = not detectable, the person reports it). One URL per page and one page per URL: slug matches first, then the best title.
  - A match is stored exactly like "I published it" (one shared row builder, `v5/code/_publish_rows.js`, also used by the publish
    check): the content-log row gets status published, the live URL and the date (a ladder page without a log row gets one), the ladder
    row status published + `target_url` = live URL + `page_exists`, a case study its URL; the paid / live publish check is not run. The
    page is inspected in Search Console in the same run; the report says "We found these pages live on your site: … — tracking has
    started" (only when there are some); the callback (`stage: site_tracker`) carries `detected_published: [{ keyword, url, ladder_id,
    matched_by: 'slug' | 'title', source: 'content_log' | 'ladder' }]` and `publish_detection` (checked, candidates, sitemap_ok /
    sitemap_urls / sitemap_error, pages_fetched, found, still_waiting, recorded, error). A failed detection step or a failed write never
    stops the report (info / medium alert). Cost: $0 (plain HTTP; per site and week 0 requests without waiting pages, otherwise 1 sitemap
    + up to 5 child sitemaps + up to 15 pages).
- **WordPress** (optional, later; **not wanted for now**, 2026-10-03): connect per website in the app (site URL + application password, stored encrypted by the app);
  the app creates a draft (or publishes, by choice) when a page arrives. The existing single-credential n8n sub-workflow is not
  used for companies.

## 7. Auto and Manual

| Step | Auto | Manual |
|---|---|---|
| Choose a keyword | "Choose for me" picks the top recommendation (the person still confirms the start) | Pick a card or type a keyword |
| Start the next ladder | Only with **Choose keywords for me** on (off by default): when fewer than 2 Auto ladders are active, the next recommendation starts and appears in the activity feed | "New keyword ladder" |
| Write the next page | The cadence writes it on Monday | Needs you: "Next page ready: … — Write it ($1.20) / Skip" |
| Publish | WordPress (if connected) or detection | Copy / download, "I published it" |
| Climb to the next rung | Follows §6.2 | Same order, each step approved |
| Opportunity posts | Fill the free weekly slots | Shown as suggestions with Write now |
| Monitors | On: run on schedule | Off: Run now only |

- A website default (Auto for new websites) and an override per ladder and per always-on item.
- Never automatic: going over the budget, deleting, connecting accounts, overriding a duplicate warning.
- Someone with no SEO knowledge: onboarding → "Choose for me" → Auto → publishes what arrives (or connects WordPress); everything
  else shows up as plain-language results and Needs you.

## 8. Results

| Where | Numbers |
|---|---|
| Ladder card / detail | pages planned / written / waiting / published; main keyword position and weekly change; pages in top 10 / top 3; clicks and impressions of the ladder's published pages (28 days, Search Console, by page URL); expected visits at top 3 (from the plan); status; cost so far and per month |
| Pipeline home | pages published this month; keywords in the top 10 across ladders; clicks from pipeline pages; spend this month vs the budget; Needs you count |
| Always on | as today (AI visibility, backlinks, audit, weekly report dashboards) |

## 9. Changes

### 9.1 n8n
1. **`seo_ladder_settings`** (new Data Table, created on first use; columns in `ladder_common.py`): `ladder_id, site_id, domain,
   head_keyword, mode (auto|manual), priority, status (active|queued|paused|won|stuck|archived), plan_type (direct|short|full),
   reach, source (app|discovery|system), created_at, updated_at`. A ladder without a row = Auto, active, priority by start date
   (today's ladders keep working).
2. **`Cadence_Plan.js`**: read the settings; only Auto + active ladders; priority order; main-page gate (§6.2); Direct = main page
   first; pile-up guard (§6.4); opportunity posts only when Auto (new `seo_cadence` columns `opportunities`, `max_waiting`, or a
   site row in the settings table if the Data Table API cannot add columns); `dry_run` stays.
3. **`Ladder_Plan.js` / `Ladder_Pool.js`**: reach from `ranked_keywords` (already called) + `seo_cache`; relative rungs; plan type;
   exclude keywords of the website's other ladders; write the settings row; `plan_type` and `reach` in the callback. **Built (v4.8)**: new nodes
   *Ensure Ladder Table (Plan)*, *Load Domain Ladders*, *Ensure Ladder Settings Table (Ladder)*, *Load Domain Ladder Settings* before the
   research; *Reach Row / New Reach? / Save Reach (Ladder)* after the plan; *Any Ladder Rows?*, *Ladder Settings Rows*, *Any Settings Rows?*,
   *Save Ladder Settings* after the rows. The settings row (exact columns, upsert by `ladder_id`): `mode` from the `_site` row else `auto`,
   `priority` = highest priority of the site + 1 (existing ladders without a priority first get one that keeps today's order — after the
   prioritised ones, oldest first — with `mode` / `status` left empty, i.e. no override), `status: active`, `plan_type`, `reach`, `source: ladder`;
   a row the app wrote first for this `ladder_id` keeps its mode, priority, status, source and `created_at`. The `ladder_plan` callback adds
   `plan_type`, `difficulty_for_you`, `reach`, `months`, `months_range`, `stretch`, `label`, `order`, `planned`, `refusal`, `reach_info`,
   `excluded_keywords`, `settings_registered`, `settings_error` (every earlier field kept; `top_page` is `null` when nothing was planned).
4. **Discovery** (`Rank_Keywords.js`, `Build_Keyword_Strategy.js`): tiers and labels from reach; each keyword gets
   `difficulty_for_you`, `plan_type`, `months`. **Built (v4.8)**: with a domain, *Reach Requests (Discovery)* → *Measure Reach?* → *Run Reach
   Requests* → *Reach (Discovery)* → *Save Reach (Discovery)* before the research (stored reach = no call). Now = easy or reachable for the
   site (also for the pipeline keyword), a live position 1-20 makes a priority keyword easy; the report shows the reach, a "For your site" column
   and pills; the `keyword_strategy` callback carries `difficulty_for_you`, `plan_type`, `months`, `label` per keyword (priority, start_with,
   quick wins, competitor gaps) and per topic (`content_plan`), plus `reach`. Without a domain: identical to v4.7 (checked against a frozen copy).
5. **Keyword check workflow** `SEOagentAssess` (§5.2), added to `apply_env.py` import / publish lists. **Built (v4.8).**
6. **Rank tracker** (`Tracker_Report.js`): Won and Stuck flags per ladder in the callback (the app sets the status). Since v4.8 a won
   ladder is checked monthly instead of being dropped (`Tracker_Plan.js`).
7. **Site Tracker**: publish detection (§6.5). **Built (v4.8)**: nodes *Publish Candidates → Fetch Sitemap (Detect) → Sitemap Children
   (Detect) → Fetch Child Sitemaps (Detect) → Match Slugs (Detect) → Fetch Pages (Detect) → Detect Published → Save Detected (Log) /
   Mark Case Study Published (Detect) / Mark Ladder Published (Detect)* between *Any Sites?* and *GSC Sites*; *Inspect Requests*, *Site
   Metrics*, *Brief Input*, *Site Report* read the result; *Publish Check* (main workflow) uses the same row builder.
8. Harness: scenarios for each change (cadence with priority / gate / guard / manual; reach and plan types; assess; detection).

### 9.2 App server
- `GET …/data/ladders` (cards) and `GET …/data/ladders/:ladderId` (detail), built from `seo_ladders`, `seo_rank_history`,
  `seo_content_log`, `seo_query_history` (by page URL), `seo_ladder_settings`, reports.
- Built (phase 2): `PATCH …/sites/:site/ladders/:ladderId` `{ mode?, status?: active|paused }` (admin) → settings row (the app never
  writes `stuck`/`queued`, and `won` only from a rank-tracker callback with `won: true`; a row the app creates keeps mode `''` =
  website default); `PUT …/sites/:site/ladders/order` `{ ladderIds }` → priorities 1..n; `DELETE …/ladders/:ladderId` (admin) →
  ladder, settings and rank-history rows (written pages stay in the content log).
- Built (phase 2): `PATCH …/sites/:site/automation` `{ defaultMode?, opportunities?, maxActiveLadders? 1-5, maxWaiting? 1-10 }`
  (admin) → the `_site` row; `autoStartLadders` arrives with phase 3.
- `POST …/sites/:site/keywords/assess` (§5.2).
- Callbacks: `ladder_plan` stores plan type / reach; rank-tracker Won / Stuck update the settings row.
- `pipelineNotices` gains overlap and topic (shared).

### 9.3 App web
Pipeline home (§4.1), ladder detail (§4.2), the keyword flow (§5.1), Auto/Manual switches, Needs you, "Rank for this keyword" on the
strategy report, Rankings / Recommendations links (§4.3).

## 10. Phases

| Phase | What | n8n change | Live test cost |
|---|---|---|---|
| **1. See every ladder** | Pipeline home with ladder cards, This week, Needs you, Always on; ladder detail (climb, timeline, results, reports); overlap warning; "Rank for this keyword" on the strategy report; remove techand.ai's duplicate ladder | none | $0 |
| **2. Auto / Manual and focus** | settings table; cadence priority, pause, main-page gate, pile-up guard, manual approval, opportunities Auto/Manual; Won / Stuck; switches in the app | Cadence, Tracker, new table | $0 (cadence `dry_run`) |
| **3. The right keyword and the right plan** | reach, relative rungs, plan types (Direct first), cross-ladder exclusion, discovery labels, keyword check, the 3-step flow | Ladder, Discovery, new Assess workflow | about $2.50 (3 checks, 1 ladder run) |
| **4. Publishing** | publish detection (**n8n part built v4.8**, harness S26, not deployed); WordPress connection: not wanted (2026-10-03) | Site Tracker | $0 |

Each phase ends with: harness `0 failed`, unit tests, the API smoke test, a browser check (desktop + phone, light + dark), docs
(this spec, app README, API.md, HANDOVER) and the user's go-ahead before any paid live run.

## 11. Decisions to confirm

1. Words: **Pipeline** (website) and **Keyword ladder** (per keyword). *Recommended.*
2. Default for new websites: **Auto** for writing a ladder's pages; **Choose keywords for me off** (the person confirms each new
   ladder). *Recommended.*
3. At most **2** active Auto ladders at a time. *Recommended.*
4. Pile-up guard at **3** waiting pages. *Recommended.*
5. Keyword check at about **$0.05** each, counted in the budget, 30 a day. *Recommended.*
6. Publishing: build detection (Phase 4) — yes; WordPress connection — only if your clients use WordPress.
7. Delete the duplicate ladder `lad_mur2cjwk8gp0` on techand.ai in Phase 1. *Recommended.*

## 12. Test plan
Offline: shared unit tests (overlap, reach, plan type, ladder status, cadence order); harness fixtures for cadence (2 ladders with
priorities, a paused and a manual ladder, a gated main page, 3 waiting pages), Ladder_Plan with reach 10 / 35 / 55 (Direct, Short,
Full), assess, publish detection. Live (with go-ahead): keyword check on 3 techand.ai keywords, one Direct ladder run, a cadence
`dry_run`, a Site Tracker run for detection.
