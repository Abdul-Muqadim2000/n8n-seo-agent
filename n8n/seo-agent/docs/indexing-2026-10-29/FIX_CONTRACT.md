# Fix wave 1: contract additions and decisions (2026-10-29)

Findings: REVIEW_ENGINE.md (E1-E16), REVIEW_APP.md (A1-A27), REVIEW_CROSS.md (X1-X20). Every High and Medium is fixed in this wave;
Lows are fixed unless the fixer writes why not. DESIGN.md stays the base contract; these are additive.

## New columns on `seo_index_pages` (engine writes, app reads)
| column | type | meaning |
|---|---|---|
| `fix_seen_at` | string | ISO. Set by the engine when its own fetch shows the page's site_fix cause is gone (noindex removed, 200 again, canonical self, robots allows, redirect gone / sitemap lists the final URL) while Google's last inspection still shows the old cause. Cleared when the cause changes or the problem is seen again. While set: `action` = `wait`, `note` = "Fixed on your site. Waiting for Google to read it again.", and the page is inspected again within 1-2 days (priority right after the new lane), so the reason updates in days, not 28. (X7, A5) |
| `ask_google` | boolean | The engine marks at most 5 pages per site per week where a manual "Request indexing" in Search Console is the right next step: our own new pages not indexed after 7 days, pages with `fix_seen_at`, and important existing pages (in sitemap, linked from the menu or home) that are `discovered_not_crawled` / `unknown_to_google`. Never `leave_out`, never `quality` during a freeze. The app shows "Ask Google to read it" with a guide (Search Console > URL Inspection > Request indexing), as a recommendation, never automated. (X8) |

## Decisions
1. **Run shape (X1, E6, X2, E10)**: one execution per site. The daily trigger plans the sites and starts one sub-execution per site
   (Execute Workflow, `waitForSubWorkflow: false`, staggered, at most 2 at once, like the AI Pulse's part chaining), each saving its own
   rows as it finishes. A run-wide guard: the per-property daily count is read from today's `seo_index_runs` rows **and** a reservation
   written before inspecting (so a replayed or crashed run counts what it spent); the catch-up never spends more than the cap per
   property per day. Payloads: never keep page bodies or whole sitemap XML past the node that parses them; stop fetching child sitemaps
   once the URL cap is reached; bound every list carried between nodes.
2. **Sitemap trust (E1, A1)**: `in_sitemap` is three-valued in practice: when the sitemap tree was read completely, true/false; when any
   sitemap failed or a cap was hit, a page not found keeps its previous `in_sitemap` value and no "add it to the sitemap" advice is
   given that day (`seo_index_runs.sitemaps_json` says the tree was partial). The app's own check never marks a step done from a
   sitemap it could not read completely.
3. **Our fetch vs Google (E2, A2, A16)**: Google's documented fields win. Our fetch can only *add* a hard fact when Google's reading is
   vague or old, and a bot wall / 401 / 403 / 429 / 503 / challenge page / geo redirect from our side is "could not check", never a
   cause and never a fix. The app's own check: a fix counts only on the exact positive signal for that cause (noindex: 200 HTML with the
   real page and no noindex in header or meta; server_error: 200; access_denied: 200; not_found: 200 or 301/308 to an on-site 200;
   canonical_elsewhere: canonical points to itself, or the sitemap no longer lists it **from a complete read**; robots: a real robots.txt
   (text, 200 or 404) that allows it).
4. **URL identity (E4, E5)**: the inspected URL is the site's canonical form: the host from `seo_sites.canonical_host`, or, when empty,
   the host the home page actually ends on after redirects (stored in the run); the path as the sitemap lists it; when our fetch shows a
   same-site redirect that only changes slash / case / host form, the row switches to the final URL (history kept). A URL-prefix
   Search Console property: inspect only URLs under that prefix; Google's "not part of this property" answer is an `access` error.
5. **Lanes (E3)**: a page is `new` only if we wrote it (content log) or it first appeared in a sitemap that the previous run had read
   completely. The first complete read of a site puts everything in `existing`.
6. **Drop-outs (X4)**: only pages that were indexed and are now not indexed with an action other than `leave_out` / `wait`; a redirect
   the client made on purpose, a 404 that left the sitemap, a noindex not in the sitemap are not drop-outs. First run (no history) and
   events that started before the site's first run send no same-day callback (X13).
7. **Search Analytics (X3, E8)**: page dimension without date (one row per page) with `startRow` paging until a short page, 90-day window,
   hard stop at 50,000 rows with the run note saying so; a page missing from a truncated answer keeps its stored impressions.
8. **Retention (X16, E12)**: history older than 400 days deleted by the engine run; the app's site deletion also deletes the site's
   rows in the five index tables (like it deletes ladders); rows not seen in any source for 120 days and answering 404/410 are pruned;
   when the 6,000 cap is reached the run note says so and our own pages and sitemap pages win over the rest.
9. **Freeze (A11)**: one rule everywhere: the engine's latest run `freeze` flag. The app does not compute its own.
10. **Delivery (A26)**: the weekly `index_coverage` report follows the same delivery rule as the Site Tracker's weekly report; drop-outs
   raise the same alert path as Page Watch alerts. No new channel.
11. **Missed runs (X10)**: add the daily schedule to the app's SCHEDULES / AUTOMATIONS with `since` = the time of the first
   `seo_index_runs` row of any site (so nothing before the deploy counts as missed).
12. **Copy (X14, A8, A23)**: no "checked every day" for indexed pages (we check every day which pages Google left out; each page is
   re-read on a schedule); no "Every page in Google, or a reason why not"; done steps say what we checked.
