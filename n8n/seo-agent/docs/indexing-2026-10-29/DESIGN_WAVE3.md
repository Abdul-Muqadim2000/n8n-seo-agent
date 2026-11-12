# Index coverage wave 3: a to-do for every left-out page (2026-11-12)

Client document (devaicon.com, "Indexing Module Upgrade: One Final Module", 2026-11-12): the Indexing page labels 13 "not visited yet"
pages and 2 policy pages "Give it time" / "Nothing to do"; asks for scan, classify, fix, verify, prioritize, a daily ask-Google to-do,
IndexNow, a 21-day escalation, an important / utility override and a weekly summary. Base contract: DESIGN.md + FIX_CONTRACT.md +
DESIGN_WAVE2.md + the improved-page addendum in RESUME.md. Everything below is additive. Production is live with paying clients.

## 0. Evidence (production, read-only, 2026-11-12)
- devaicon.com: 40 known, 18 indexed. 13 pages `wait` (existing lane, linked from the website, in the sitemap, fetch 200, no noindex,
  robots.txt allows): 2 Open edX sub-pages, 6 job pages (/careers/*), /industries/{professional-services, public-sector, retail},
  /insights/{agentic-ai, value-driven-innovation-automation}. 9 new-lane pages `wait_new`. /privacy and /cookies `low_value` leave_out.
  4 moved pages `redirect` leave_out.
- Asking Google works on this site: the client pressed "I asked Google" on 5 pages on 2026-11-02 and 5 on 2026-11-10; 9 of the 10 were
  crawled and indexed within hours. But `ask_max` = 5 NEW marks per rolling 7 days, so since 11-10 no waiting page carries the
  ask-Google mark until 11-17 (all 13 rows: ask_google = false).
- None of the 13 waiting pages was ever sent to IndexNow: AI Growth submits only its ~12 "key pages" (seo_ai_pages), weekly. The site's
  IndexNow key file is verified (seo_ai_growth.indexnow = verified).
- devaicon.com/sitemap.xml lists every page with `changefreq` / `priority` only, NO `<lastmod>` (Google ignores changefreq / priority and
  uses lastmod when it is consistently accurate: developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- The 6 job pages carry valid JobPosting structured data (owner decision noted in §6, not built).
- Google's November 2026 core update is rolling out since 2026-11-10 (seo_google_events): the existing freeze holds content advice.

## 1. Verdict on the client's 12 commands
| # | command | today | wave 3 |
|---|---|---|---|
| 1 | scan.page | built (status after redirects, X-Robots-Tag, meta robots, canonical, words, title; robots.txt via `robotsAllows`) | store our robots.txt verdict per page (`robots_ok`) so the app can show it |
| 2 | scan.links | `linked_by` from the home page + up to 10 parent pages | add `link_depth` (1 = linked from the home page, 2 = from a page the home page links, 0 = unknown) and `linked_n`; no full crawl (devaicon's menu links every page) |
| 3 | scan.sitemap | `in_sitemap`, `sitemap_lastmod` | site-level sitemap date reading + a checked site step when the sitemap has no usable dates |
| 4 | classify | 20 cause codes | unchanged; overrides (§2.4) |
| 5 | prioritize | ask-Google ranking only | `priority` 1..N on every page that should be in Google and is not; top 5 = "Do first" |
| 6 | fix.suggest | per-cause notes, link suggestions, site steps | escalation reasons with steps (§2.2) |
| 7 | queue.request | ≤ 5 new marks / 7 days, no job pages | ≤ 3 new a day, ≤ 10 new per 7 days, ≤ 5 shown at once; job pages allowed last |
| 8 | notify.indexnow | AI Growth, weekly, ~12 key pages | Index coverage sends every page that should be found, once, and again when it changes (§2.3) |
| 9 | fix.verify | site steps: "I've done it, check now" + daily check | unchanged; plus the sitemap-dates step |
| 10 | escalate | `needs_person` after 4 unchanged re-checks after a fix | 21 days with no Google visit -> "Needs you" with the likely reasons (§2.2) |
| 11 | mark.important / mark.utility | none | `type_override` written by the app (§2.4) |
| 12 | report.weekly | Monday callback `index_coverage` | adds waiting / escalated / asked / read after asking / sent to Bing |

Not adopted (and why):
- "Remove policy pages from the sitemap" as a task: listing them is harmless; shown as an optional tip, no step.
- "A utility page with impressions is not a utility page": /privacy has 3 impressions in 28 days, which is noise. The override covers a real
  case.
- A rules table in a database: the wording already lives in one catalogue on each side (`_index_kit.js` notes, `shared/src/indexing.ts`
  groups); a table adds a failure mode and no value.
- "Likely cause: duplicate" for never-visited pages: Google has not read them, so there is nothing to compare with; we name only what we
  can see (asked or not, links, length, sitemap).
- Never: the Indexing API for normal pages, automatic Request indexing (no API exists), content rewrites during an update.

## 2. Engine (`_index_kit.js`, IX_* nodes, `ladder_common.py`, harness)

### 2.1 New columns
`seo_index_pages`: `priority` number (0 = not ranked), `escalated_at` string ISO, `escalate_why` string (comma list of codes, §2.2),
`type_override` string (`important` | `utility` | '': written by the APP only, the engine reads and keeps it exactly like
`asked_google_at`), `robots_ok` string (`yes` | `no` | '' = not read), `link_depth` number, `linked_n` number, `indexnow_at` string ISO.
`seo_index_runs`: `escalated`, `asked_waiting`, `indexnow_sent` numbers; `sitemaps_json.dates` = `{ urls, with_lastmod, distinct }`
(inside the existing JSON).
All through `ladder_common.py` (+ `sync_tables.py` on deploy). The upsert keeps writing only the engine's columns plus these.

### 2.2 Escalation at 21 days
CFG `escalate_days: 21`. A page is escalated when ALL hold: state `not_indexed`; cause `unknown_to_google` or `discovered_not_crawled`;
action `wait` or `links`; Google never crawled it (`last_crawl` empty); now - anchor >= 21 days where anchor = `published_at` ||
`first_seen_at`. `escalated_at` = the first run it held (kept while it holds), '' as soon as it does not (Google crawled, indexed, left out,
other cause). The action does NOT change (no new action value: the app groups by `escalated_at`).
`escalate_why`, in this order, only the ones that apply:
- `not_asked`: no `asked_google_at`, or it is older than 28 days.
- `asked_no_visit`: asked 14+ days ago and Google still has not crawled it.
- `weak_links`: `link_depth` != 1 (not linked from the home page) or `linked_n` <= 1.
- `short_page`: 0 < words < 300 and not a job posting (during a Google update freeze the code stays; the note says to wait for the update
  before changing the text).
- `not_in_sitemap`: not in the sitemap.
- `sitemap_no_dates`: the site's sitemap has no usable dates (§2.5).
Note (one plain sentence group, no jargon): "Google has not visited this page in the 3 weeks we have watched it. " + the first reason's
step: not_asked -> "Ask Google to read it in Search Console (it is on your list today)." / asked_no_visit -> "Google did not come even after
you asked, so it does not see the page as important yet: link it from your home page or main menu, and get a link from another website." /
weak_links -> "Only <n> page(s) link here and your home page does not: link it from your home page or main menu." / short_page -> "The page
is short (<words> words): add what a buyer needs to know." (freeze: "... after Google's current update finishes.") / not_in_sitemap -> "Add
it to your sitemap." / sitemap_no_dates -> "Add the date each page last changed to your sitemap."

### 2.3 IndexNow (Bing, Yandex, Seznam, Naver, Yep: never Google)
After diagnosis, per site, when the site has an IndexNow key (seo_cache `indexnow:<site_id>`, made by AI Growth) AND the key file answers
the key (one GET of `https://<host>/<key>.txt`, body equals the key) AND the build flag `SEO_INDEXNOW` is not `off` AND not a dry run:
submit in ONE POST (`https://api.indexnow.org/indexnow`, `{host, key, keyLocation, urlList}`) the pages that (a) answer 200 in our fetch
(or were not fetched and are indexed / in the sitemap), (b) are not `leave_out`, not noindex, not redirect / not_found / gone, and (c)
were never sent (`indexnow_at` empty, and seo_ai_pages has no `submitted_at` for the URL in the last 30 days), or `sitemap_lastmod`,
`improved_at` or `fix_seen_at` is newer than `indexnow_at`. Cap 500 URLs a site a run. On 200 / 202 set `indexnow_at` = now on those rows;
any other answer: nothing recorded, one line in the run note, never an ops alert storm (at most the existing alert path once). The HTTP
node never retries a 4xx and never fails the run (onError continue). No key, unverified key: nothing sent, `indexnow_sent` = 0, the run
note says why once.

### 2.4 Overrides (`type_override`)
- `important`: the page is never treated as a utility page (`isUtility` false for it): it gets its normal cause from Google's reading, can
  be ranked, escalated and offered for "Ask Google" (value tier 1).
- `utility`: a page that is not indexed gets cause `low_value`, action `leave_out`, note "You marked this page as fine to leave out of
  Google." An indexed page stays indexed (no change). Never escalated, never offered for Ask Google; as a leave_out page it is not sent
  to IndexNow.
- '' = the rules decide (today's behaviour).

### 2.5 Sitemap dates (site level)
While reading the sitemap tree (existing rounds), count the URLs listed, how many carry `<lastmod>`, and the distinct lastmod dates
(YYYY-MM-DD). Stored in `seo_index_runs.sitemaps_json.dates`. "No usable dates" = urls >= 5 AND (with_lastmod < 50% of urls OR (urls >= 10
AND distinct <= 1)). The app owns the step (§3.3).

### 2.6 Ask Google: a daily to-do
CFG: `ask_max` 5 (marked at once), `ask_daily_new` 3 (new marks in any rolling 24 hours), `ask_window_days` 7 with `ask_window_max` 10
(new marks in the window). Job postings become eligible as the LAST value tier (after other content pages); utility pages, leave_out and
quality-during-freeze stay excluded; `type_override = important` = tier 1. A marked page keeps its mark while it qualifies (unchanged rule);
kept marks do not spend the budget (unchanged).

### 2.7 Priority
After `askGoogle`, rank every row with state != indexed and action not in {leave_out, none} (and not utility): fix seen / improved and
waiting first, then the ask value tier (important override and home-linked service / capability / product / solution / industry pages,
then articles, then other content, then job postings), then impressions_28d desc, then depth, then url. `priority` = 1..N; every other row
0. The report lists the top 5 as "do first".

### 2.8 Weekly report (callback summary + report_markdown)
`summary.waiting` (wait rows not escalated), `summary.escalated`, `summary.asked_waiting` (asked, Google has not read it yet),
`summary.read_after_ask_7d`, `summary.indexnow_sent`, `summary.do_first` (≤ 5 `{url, why}`), `summary.sitemap_dates`.
Markdown: one short block, same tone as today.

### 2.9 Harness
devaicon-shaped fixtures (the 13 rows above + the policy pages + a job page + the no-lastmod sitemap): escalation on day 20 / 21 / after a
crawl; each `escalate_why` code; freeze wording; ask-Google over 10 simulated days (3 a day, 10 a week, 5 at once, job pages last, utility
never, important override first); priority order; override kept across two runs (engine never writes it); IndexNow plan (no key, wrong key
body, dry run, never sent / already sent / lastmod newer / AI Growth sent 5 days ago, cap, 4xx records nothing); sitemap dates stats.
Every test fails on the pre-change code where it describes new behaviour.

## 3. App

### 3.1 The "Google has not visited these yet" card (wait rows, not escalated)
Replace "Nothing on these pages" with the to-do: "Google has not visited <N> pages. <M> matter most. Do these <K> things: ask Google to read
<x> pages today; <add dates to your sitemap>; <link <y> pages from your home page or menu>." (only the parts that apply; plain words). Pages
ordered by `priority`, top 5 marked "Do first". Per page a compact "What we checked" line from the row: Opens (200) / Can be indexed (no
noindex) / robots.txt allows / In your sitemap / Linked from your home page | from <path> (<n> pages) / <words> words / Sent to Bing <date>
(from `indexnow_at`) — a failed check in the warning colour, a check we could not read shown as "not checked", never as passed.
The existing "I asked Google" button and its states stay.

### 3.2 "Needs you: Google has not visited after 3 weeks" (escalated rows)
A group in the Needs-you part of the page: per page the reasons (`escalate_why`) as steps, in order, with "Show me how" guides (ask Google,
internal links, sitemap dates, add to sitemap). `short_page` during a freeze shows "after Google's update finishes" and no Improve button.

### 3.3 Sitemap dates step (Steps on your website)
New site-task key `indexing:sitemap_dates` (a site-level step like `indexing:sitemap`): raised when the newest run's
`sitemaps_json.dates` says no usable dates; the app's own check reads the sitemap (`sitemapOf`, extend `SitemapRead` with the date counts)
and marks it done when >= 90% of URLs carry lastmod and (urls < 10 or distinct > 1); the engine's next reading decides when newer (existing
rules: two misses reopen, unreachable never records). New guide `index-sitemap-dates` (what lastmod is; Google uses it only when it is
accurate; the date the main content last changed, never the build time; WordPress SEO plugins and most site builders add it; Next.js
`sitemap.ts` lastModified).

### 3.4 Policy and utility pages
Card copy: "<N> pages look like policy pages (<privacy, cookies>). They do not need to be in Google. If one of them should rank, press This
is an important page." Per page "This is an important page"; an optional tip "You may also leave them out of your sitemap; it is optional."
On every other not-indexed row a small "Fine to leave out" action; an overridden row shows "You marked this page ..." + "Undo".
Server: `POST /api/orgs/:orgId/sites/:siteId/data/indexing/page-type` `{ url, type: 'important' | 'utility' | '' }`, members and above,
rate-limited, audited, org / site scoped, same n8n write path as `asked-google`; the app shows the new state at once (overlay until the
engine's next run re-diagnoses).

### 3.5 Report renderer + Overview
`components/reports/indexing.tsx`: the new summary fields (waiting / escalated / asked / read after asking / sent to Bing / do first).

### 3.6 Marketing, tutorials
Changelog line + the index-coverage capability text (customer words: "a daily to-do for pages Google has not visited", "we tell Bing at
once", "mark a page as important"). Tutorials: one row in `~/Downloads/hiresuite-video-skills/alaventra/TUTORIALS_BACKLOG.md` (owner rule),
commit + push that repo.

## 4. Safety
Additive columns only; no app migration (overrides live in `seo_index_pages`). IndexNow behind a verified key, a build kill switch, dry
run, one POST a site a day, capped. Nothing written to Search Console; no Indexing API. Deploy: engine first (`sync_tables.py`), node-diff
production first, not on a Monday, then the API, then the web via PR to main.

## 5. Measure on devaicon.com (client's own measure)
Weekly: pages in "Google has not visited these yet" falling, "In Google search" rising from 18 of 40, pages in "Needs you" with a verified
fix. Baseline 2026-11-12: 18 indexed / 13 waiting / 9 new waiting / 0 escalated / 0 of 13 sent to Bing.

## 6. Owner decisions (not built)
- Job postings and Google's Indexing API: Google allows it ONLY for pages with JobPosting (or livestream BroadcastEvent) markup; devaicon's 6
  job pages qualify. It needs the service account as an Owner of the property and the `indexing` scope. The owner decided on 2026-10-30
  that the Indexing API is never used; this is the one case where Google permits it. Ask before building.
