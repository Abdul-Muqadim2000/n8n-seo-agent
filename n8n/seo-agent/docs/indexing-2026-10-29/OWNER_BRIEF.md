# Indexing & index health: the owner's brief (2026-10-29)

The owner's words (paraphrased, typos fixed): "We need to add one more feature, very carefully, since users are using this in
production; it must not affect other features (independent feature). Do full R&D and the best implementation. Check whether anything
else in the system needs to change. The issue: the new pages we write get indexed, but many customers coming to us have older pages
that are not indexed, so our system should do something to get those indexed as well. Take my document as a research start, do your
own. Survey, research, implement, then a review agent."

The owner's research document (a starting point, NOT a spec; verify every claim) proposed:
1. One engine, two intake lanes: LIVE (pipeline publishes/updates a page: check a few hours after, day 3, day 7) and BACKLOG (existing
   pages from the sitemap, crawler, Search Analytics (pages with impressions are indexed: exclude), previously published URLs).
   Quota manager: URL Inspection ~2,000/day/property; ~30% live, rest backlog ranked by value; backlog progress in the UI.
2. Decision engine by cause: noindex / robots / wrong canonical / missing from sitemap -> technical fix + resubmit; 404/5xx/redirect
   chain -> fix or redirect; orphan / "Discovered - not indexed" -> internal links, sitemap lastmod; "Crawled - not indexed" (thin) ->
   AI rewrite / expansion; duplicates -> merge with 301 or canonical; low-value page -> recommend noindex/removal, never force-index.
   Group by root cause (fix a template once, re-verify all).
3. Content module: brief, EEAT draft, automatic quality gate (uniqueness vs own site, claims, depth), side-by-side diff approval,
   publish, resubmit, re-verify.
4. Autonomy per action: Off / Approval / Auto (inspect+diagnose always auto; fixes, rewrites, merges default Approval).
5. Pipeline stage "Indexing & Verification" between On-page/Technical and Backlinks; backlinks wait for indexing; GEO measures indexed
   pages only. Tables indexing_checks / indexing_issues / content_tasks.reason=indexing; jobs; UI card with New / Existing tabs,
   counts by cause, "fix all with this cause"; weekly report lines.
6. Guardrails: backup + one-click rollback, preview for bulk, daily cap, 7-14 day cooldown per URL + max retries -> "Needs manual
   review", official signals only (sitemap resubmit; the Indexing API is for job/livestream pages only), no "guaranteed indexing".
7. Section 10 "Index Health & Policy Watch": re-inspect indexed pages weekly (dropped out -> back to the engine), per-page performance
   drops vs 28-day baseline, stale content, a versioned human-approved policy checklist, a watcher of Google's Search Status Dashboard /
   Search Central / spam policies page, a core-update freeze-wait-compare-segment-audit flow, rollback if a rewrite performs worse.
   No rewrite on rumours; pages that gained are never touched.
