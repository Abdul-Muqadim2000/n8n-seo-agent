# Index coverage: design and contracts (2026-10-29)

Read with: `OWNER_BRIEF.md` (what was asked), `SURVEY_ENGINE.md`, `SURVEY_APP.md` (what exists), `RESEARCH.md` (what Google says,
sources dated 2026-10-29). This file is the contract the engine and the app build against. Where it and the owner's document differ,
the reason is in §9.

## 0. The problem, measured on production (2026-10-29, read-only)

Two client sites, both with Search Console connected. `seo_pages`: devaicon.com 29 sitemap pages, **19 with no Search Console
impressions** (likely never indexed); techand.ai 47 sitemap pages, 1 without impressions, and 14 known URLs answering 404. Our own new
pages are inspected by the weekly Site Tracker rotation (150 URLs a week, latest reading only). Nobody tells the client which of their
older pages Google left out, why, or what to do; nothing records history, nothing groups by cause, nothing notices a page dropping out.

## 1. What we build (one independent feature)

**Index coverage**: a new, free (Google APIs only, $0, no credits), read-only engine workflow plus an app page.

Every day, per website with Search Console connected and the feature on:
1. **Know every page.** Merge `seo_pages` (Site Tracker inventory), the full sitemap tree (robots.txt `Sitemap:` lines + `/sitemap.xml`,
   every child up to 50 sitemaps / 5,000 URLs), our own written / published pages (`seo_content_log`, `seo_ladders`), Search Console's
   submitted sitemaps (`sitemaps.list`, read-only scope) and Search Analytics pages (90 days, `page` dimension, one request).
2. **Lanes.** `new` = pages we wrote or that appeared in the site's sitemap within the last 30 days; `existing` = everything else.
3. **Evidence without spending quota.** A page with web impressions in the last 28 days was indexed then (`state=indexed`,
   `evidence=search`); no impressions proves nothing (RESEARCH §A9). A Site Tracker inspection of the same URL in the last 3 days is
   reused (`seo_page_watch.inspect_at`), not repeated.
4. **Inspect within a budget** (URL Inspection, 2,000/day/property shared by every tool; RESEARCH §A1). Our cap: `index_daily_cap`
   (default **300**, clamp 20-1,200) so the Site Tracker (150/week) and audits (100) always keep their room. Order (§3).
5. **Fetch the page ourselves** for every not-indexed page (cap 60 a site a day): status after redirects, `X-Robots-Tag`, meta robots,
   `<link rel=canonical>`, word count of the main text, `<title>`. Uses the same reading as the daily Page Watch (`_page_watch.js`).
6. **Diagnose** each page to one cause (§4) from documented enum fields first (`verdict`, `indexingState`, `robotsTxtState`,
   `pageFetchState`, canonicals), the `coverageState` string second (it is free text; RESEARCH §A4), our fetch third.
7. **Group by cause** and decide the action class: `site_fix` (a change only the client can make on their site: a Steps-on-your-website
   task, checked by us), `links` (internal links + sitemap: concrete suggestions which existing indexed pages should link to it),
   `quality` (one page at a time, an "Improve this page" suggestion the client approves; never automatic), `duplicate` (merge / canonical
   suggestion), `wait` (normal, Google has not got to it yet), `leave_out` (normal / intended / low value: no action).
8. **Re-verify** on a schedule, keep history of every state change, flag **drop-outs** (indexed -> not indexed), mark a page **needs a
   person** after 4 unchanged re-checks once its fix was done.
9. **Google updates watch** (once a day, not per site): read Google's Search Status Dashboard feed (`incidents.json`, Ranking product) and
   the spam-policies page fingerprint; store events; while a core or spam update is **rolling out**, no quality suggestion is raised
   (freeze); 7 days after it **completes** (and once data covers it) compare each site's pages before vs after (dropped / stable / gained,
   minimum-impressions filter) so the client sees what the update did, and only dropped pages get a review suggestion.
10. **Report**: the app page reads the tables directly; a weekly callback `index_coverage` (Monday, or at once when a page drops out or a
   Google update starts / completes) gives the run report and the notification.

What it never does: submit URLs to Google's Indexing API; claim a page "will be indexed"; resubmit an unchanged sitemap; rewrite,
noindex, redirect or delete anything by itself; inspect more than its cap; treat "not checked" as "fine" or "not indexed".

## 2. Engine: Data Tables (n8n, add to `ladder_common.py`, synced by `sync_tables.py`)

### 2.1 `seo_index_pages` (key `site_id` + `url`; upsert changed rows only)
| column | type | meaning |
|---|---|---|
| site_id, domain, url | string | url = absolute, canonical host of the site |
| lane | string | `new` \| `existing` |
| sources | string | comma list: `sitemap`, `gsc`, `inventory`, `ours`, `search` |
| in_sitemap | boolean | listed in the site's sitemap tree today |
| sitemap_lastmod | string | ISO date from the sitemap, '' |
| first_seen_at | string | ISO, when we first knew the URL |
| published_at | string | ISO, our publish / write date for `ours`, '' |
| impressions_28d, clicks_28d | number | web search, last 28 days of data |
| last_impression_at | string | last date with impressions (90-day window), '' |
| state | string | `indexed` \| `not_indexed` \| `excluded` \| `unknown` (never checked) \| `error` (last check failed) |
| evidence | string | `inspection` \| `search` \| `site_tracker` \| '' |
| cause | string | §4 code ('' when indexed) |
| action | string | §4 class: `none` \| `site_fix` \| `links` \| `quality` \| `duplicate` \| `wait` \| `leave_out` |
| verdict, coverage, indexing_state, robots_state, page_fetch_state, crawled_as | string | raw URL Inspection fields |
| google_canonical, user_canonical | string | raw |
| last_crawl | string | ISO |
| referring_count, google_sitemaps | number | `referringUrls.length`, `sitemap.length` from the inspection |
| inspect_at | string | ISO, last inspection (ours or reused) |
| fetch_at | string | ISO, our own fetch |
| http_status | number | after redirects, 0 = not fetched / no answer |
| final_url | string | where redirects ended ('' if none) |
| noindex | string | `meta` \| `header` \| '' |
| page_canonical | string | `<link rel=canonical>` we read |
| words | number | main-text words |
| title | string | |
| indexed_since | string | ISO, first time seen indexed in this streak |
| dropped_at | string | ISO, last indexed -> not indexed |
| checks | number | inspections since the cause last changed |
| next_check_at | string | ISO, when the planner may inspect again |
| needs_person | boolean | 4 unchanged re-checks after the fix window |
| link_from | string | JSON list (≤ 5) of `{url, title}` existing indexed pages suggested to link here (`links` action) |
| merge_into | string | url of the page a `duplicate` should merge into ('' if none) |
| note | string | one plain sentence for the client (what it means + what to do) |
| updated_at | string | ISO |

### 2.2 `seo_index_history` (insert only, one row per state/cause change)
`site_id, url, at, state, cause, evidence, verdict, coverage` (strings).

### 2.3 `seo_index_runs` (insert one row per site per run)
`site_id, domain, run_at, request_id` (strings); `known, indexed, not_indexed, excluded, unknown, errors, new_pages, new_indexed,
inspected, reused, fetched, quota_cap, backlog_left` (numbers); `by_cause_json` (`{cause: count}`), `by_action_json`
(`{action: count}`), `dropped_json` (≤ 20 `{url, at, cause}`), `freeze` (boolean), `freeze_reason`, `note` (strings).

### 2.4 `seo_google_events` (global, key `event_id`; upsert)
`event_id, source` (`status_dashboard` \| `spam_policies`), `kind` (`core` \| `spam` \| `policy_doc` \| `other`), `title, started_at,
ended_at, status` (`rolling_out` \| `complete` \| `changed`), `url, seen_at, updated_at`.

### 2.5 `seo_update_impact` (key `site_id` + `event_id`; upsert)
`site_id, domain, event_id, event_title, compared_at, before_from, before_to, after_from, after_to` (strings); `pages, dropped,
stable, gained` (numbers); `pages_json` (≤ 30 `{url, before_clicks, after_clicks, before_impr, after_impr, before_pos, after_pos,
segment, state, cause}`, dropped first); `note`.

### 2.6 Settings: two new `seo_monitors` columns (written by Site Admin `monitors`, validated there)
`index_watch` boolean (empty = **on**), `index_daily_cap` number (empty = 300, clamp 20-1,200).

## 3. The daily plan (per site)

Priority of inspections inside the cap (never-inspected and due pages only; `next_check_at <= now`):
1. `new` lane pages, due on day 1, 3, 7, 14, 28 after `published_at` / `first_seen_at` (then the normal rules).
2. Indexed pages that **lost** all impressions in the last 14 days while they had them before (possible drop-out).
3. `existing` pages never inspected: in sitemap first, then Search Console pages, then the rest; shallower path first; newer
   `sitemap_lastmod` first. This is the backlog; `backlog_left` = how many are still `unknown`.
4. Not-indexed pages due a re-check: 7, then 14, then 28 days after the last check (`checks`); after 4 unchanged checks
   `needs_person = true` and the interval stays 28 days.
5. Indexed pages (watch): every 28 days; pages with impressions in the last 7 days every 56 days (search evidence covers them).
Pages with `action = leave_out` are re-checked every 56 days only. Pages answering 404/410 in our fetch and not in the sitemap are not
inspected again (they are `excluded`, cause `not_found`).

## 4. Causes (code -> action), the client sentence is plain language

| cause | how | action |
|---|---|---|
| `indexed` | verdict PASS / coverage "Submitted and indexed" / "Indexed, not submitted in sitemap" / impressions 28d | none |
| `indexed_not_in_sitemap` | indexed but not in sitemap | site_fix (low; add to sitemap) |
| `wait_new` | new lane ≤ 21 days, discovered / unknown | wait |
| `unknown_to_google` | coverage "URL is unknown to Google", in sitemap | links |
| `not_in_sitemap` | unknown to Google and not in sitemap | site_fix |
| `discovered_not_crawled` | "Discovered - currently not indexed" | links |
| `crawled_not_indexed` | "Crawled - currently not indexed" | quality (freeze-aware) |
| `noindex` | indexingState BLOCKED_BY_META_TAG / BLOCKED_BY_HTTP_HEADER or our fetch sees noindex, and the page is in the sitemap, ours, or had impressions | site_fix |
| `noindex_intended` | same, but none of those | leave_out |
| `robots_blocked` | robotsTxtState DISALLOWED, page in sitemap / ours / had impressions | site_fix |
| `robots_intended` | same, otherwise | leave_out |
| `canonical_elsewhere` | the page's own canonical points to another URL and the page is in the sitemap | site_fix (sitemap lists a non-canonical URL) |
| `alternate` | canonical elsewhere, not in sitemap ("Alternate page with proper canonical tag") | leave_out |
| `google_chose_other` | "Duplicate, Google chose different canonical than user" | duplicate (`merge_into` = Google's canonical) |
| `duplicate_no_canonical` | "Duplicate without user-selected canonical" | duplicate |
| `not_found` | 404/410 (fetch or pageFetchState NOT_FOUND) | site_fix if in sitemap or had impressions/links (redirect or remove), else leave_out |
| `soft_404` | pageFetchState SOFT_404 | site_fix |
| `server_error` | 5xx / SERVER_ERROR | site_fix |
| `access_denied` | 401/403 / ACCESS_DENIED / ACCESS_FORBIDDEN / BLOCKED_4XX | site_fix |
| `redirect` | "Page with redirect" / fetch ends elsewhere | site_fix if in sitemap (list the final URL instead), else leave_out |
| `low_value` | URL pattern: tag / category / author archives, `/page/N`, search, cart, checkout, login, account, feed, query strings with filters | leave_out (never forced in) |
| `not_checked` | inspection failed (quota / access / error) | none (state `error`, never "not indexed") |

`quality` while a Google core or spam update is rolling out: action stays `quality` but `note` says "wait until Google's update
finishes" and the app shows no "Improve" button for it.

## 5. Callback stage `index_coverage` (POST to the app hook, like every stage)
```json
{ "stage": "index_coverage", "domain": "...", "site_id": "...", "request_id": "...", "status": "complete",
  "summary": { "known": 0, "indexed": 0, "not_indexed": 0, "excluded": 0, "unknown": 0, "backlog_left": 0,
               "new_pages": 0, "new_indexed": 0, "by_action": {}, "by_cause": {}, "dropped": [], "freeze": false,
               "freeze_reason": "", "events": [ {"title":"","kind":"","status":"","started_at":"","ended_at":""} ],
               "impact": { "event_title": "", "dropped": 0, "stable": 0, "gained": 0 } },
  "report_markdown": "...", "cost": { "usd": 0 } }
```
Sent on Mondays, or the same day when `dropped` is not empty or an event started / completed. The run ledger row settles $0.

## 6. App

1. **Indexing page** per website (`/sites/:id/indexing`, nav next to Technical health): hero (indexed X of Y known pages; Z need you;
   existing pages checked N of M, "about D days to check the rest"); tabs **New pages** / **Existing pages**; groups by action and
   cause with what it means, what we do, what you do, and the URL list (state, last checked, history on expand); **Dropped out**;
   **Google updates** (events timeline, rolling-out banner, the site's update impact); settings card (on/off, daily checks).
   Reads `seo_index_pages` (filtered by site, paged, capped), `seo_index_runs` (last 12), `seo_google_events` (last 12),
   `seo_update_impact` (last 3) through the existing n8n Data Table helper. A failure shows "could not read" and never breaks other pages.
2. **Steps on your website**: new kind `indexing` with key `indexing:<cause>` (one task per site_fix cause, payload ≤ 25 URLs + count).
   Done when the engine's newest reading of every listed URL no longer has that cause, or the app's own check (fetch ≤ 10 URLs:
   status, `X-Robots-Tag`, meta robots, canonical) finds it fixed. Two misses an hour apart reopen (existing rule). Fix the
   fall-through ternary to an exhaustive switch. `getOnce` gains an opt-in `headers` return without changing other callers. A guide
   per cause in `shared/guides.ts`. Redirect causes reuse the existing `redirect:` kind where a single URL with links is involved.
3. **Recommendations** `ix:<action>:<cause>` (grouped; one per cause), linking to the Indexing page; `quality` items carry an
   "Improve this page" button = the existing Write-a-page flow with the existing page URL (the click is the approval; normal credits).
4. **Report renderer** for `index_coverage`; run type / stage labels; it is a scheduled stage (not a paid run, 0 credits).
5. **Settings**: Indexing on/off + daily checks in the website's tracking settings, written through Site Admin `monitors`.
6. **Autonomy**: checking and diagnosing are automatic (on/off per site). Site fixes are always the client's (we can only check them).
   Improvements are **approval only** (no Auto: RESEARCH §D/§G, scaled content abuse). Merges / redirects / noindex are suggestions only.

## 7. Safety for a live product
- Independent workflow `SEOagentIndexCv1` (+ its own tables); does not modify the Site Tracker, Page Watch, audits, the cadence or the
  cycle dispatcher; it only **reads** their tables. The only shared write is two new `seo_monitors` columns (additive).
- Its own daily cron; covered by the Schedule Catch-up like the AI Pulse and Page Watch; goes through the run guard (concurrency) and the
  run ledger ($0 row); free, so no credit charge.
- Quota: its own cap well under Google's limit; quota / access errors stop that site's inspections for the day and are reported, never
  stored as "not indexed"; 150 ms between inspections (≤ 400/min < 600).
- App: additive migration only if needed (none expected: settings live in `seo_monitors`, tasks reuse `site_tasks`); every new read is
  wrapped so a failure cannot break Pipeline, Overview or Technical.
- Feature switch: `index_watch` per site, and the workflow can be left unpublished.
- Copy: never "get indexed", "guaranteed", "instant"; we "find which pages Google left out, why, and what to do", "help Google find and
  choose your pages".

## 8. Out of scope now (with reasons)
- **Sitemap submission** (`sitemaps.submit`): needs the read-write `webmasters` scope on the credential every client shares, and our guide
  promises "nothing is ever changed or submitted". Resubmitting an unchanged sitemap does nothing (RESEARCH §A6). We read `sitemaps.list`
  and raise a site task when no sitemap is submitted / it has errors. Owner decision to revisit.
- **Changing client pages through the CMS** (noindex, canonicals, redirects): the CMS connector can only create / update an article by
  slug, keeps no backup and has no rollback (SURVEY_APP §5). Steps are client tasks we verify.
- **Automatic rewrites** and pruning: approval only, one page at a time.
- **Versioned policy checklist with AI-drafted changes**: the watcher alerts on a policy-page change; the checklist versioning is a later
  phase.
- **Pipeline coupling** (backlinks wait for indexing, AI visibility only on indexed pages): would change existing features; later.

## 9. Differences from the owner's document (why)
| owner doc | here | why |
|---|---|---|
| check a few hours after publish | day 1, 3, 7, 14, 28 | inspection reads Google's stored state; indexing is never instant (RESEARCH §A3) |
| crawled-not-indexed -> AI rewrite | approval-only "Improve this page", one at a time, frozen during updates | Google calls it a site-quality judgement; mass AI expansion matches scaled content abuse (RESEARCH §B, §D, §F) |
| sitemap resubmit as the official signal | not now (§8) | unchanged resubmit does nothing; needs write scope |
| Auto mode for fixes | client-side fixes are tasks we verify | we cannot change the client's site today |
| % indexed as the KPI | indexed of the pages that should be indexed, excluding `leave_out` | Google: no healthy indexed ratio (RESEARCH §B) |
| 30% quota for live | fixed cap + lane order | simpler and safe under the shared quota |
| 2026 events list | read from the dashboard feed | owner list had two errors and omissions (RESEARCH §E) |
