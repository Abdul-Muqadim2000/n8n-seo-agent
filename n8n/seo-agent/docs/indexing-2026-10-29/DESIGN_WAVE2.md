# Index coverage wave 2: right advice, every client action checked back, opt-in sitemap submission (2026-10-30)

Owner asks (2026-10-30): (1) fix the devaicon.com advice (RESUME.md "devaicon.com advice check"); (2) every action we cannot do
ourselves is recommended, the client can mark it done, and we check whether it is really done; (3) opt-in full Search Console access:
when the client gives it, we submit the sitemap ourselves; when not, a warning and the guide. Production is live with paying clients:
additive changes only, every new behaviour behind data the engine verifies, nothing written to a client's Search Console unless the
client switched it on AND Google says we have full access.

Base contract: DESIGN.md + FIX_CONTRACT.md + the fix-wave sections of ENGINE_BUILD.md / APP_BUILD.md. Everything below is additive.

## 1. What devaicon.com showed (the evidence; public site + production rows, 2026-10-30)
- The home page links, in plain HTML, to every capability page, /whatwedo, /industries (+ its 7 sub-pages), /about-devaicon, /insights
  and 4 articles, /privacy, /cookies, /security. /careers links every job page; /capabilities/open-edx-services links its 2 sub-pages.
  Yet 18 of those pages were told "add internal links" with generic sources (the same 5 pages for every target).
- All 7 /industries/* pages carry `<link rel=canonical href="https://devaicon.com/industries">` with their own titles ("Banking &
  Financial Services Technology", ...) and are not in the sitemap: Google is told they are copies. We knew only /industries/bfsi and
  called it "alternate, fine to leave out".
- "Ask Google" chose /about-devaicon, /cookies, /insights, /security, /industries before the capability pages.
- /privacy (crawled, not indexed) got "Improve this page".

## 2. Engine (SEOagentIndexCv1, `_index_kit.js`, IX_* nodes)

### 2.1 The site's own links (read once per site per run, free)
- Fetch the home page (the site's canonical home URL) and, for each not-indexed page whose parent path exists on the site (`/a/b` ->
  `/a`), that parent page: at most 10 parent pages a run, own host only, same strict URL rules and bounded reads as the page fetch.
- Parse `<a href>` internal links (same registrable domain, resolved against the page URL, no fragments, query kept only if the page
  itself has one). Result per site: `linkedBy: Map(url -> [source urls])`.
- New column `seo_index_pages.linked_by` (string, JSON list of up to 3 source URLs that link to this page today; '' = none found;
  'unread' when the home page could not be read this run, so nothing is concluded).
- Pages linked from the home page or a parent that are not in the inventory are added (source `home`), capped by the existing 6,000
  rule; they are planned and inspected like any existing page (this is how the 6 other /industries/* pages are found).

### 2.2 Causes and actions (changes only)
- `unknown_to_google` / `discovered_not_crawled` with `linked_by` non-empty and not 'unread': action **`wait`** (cause kept), `link_from`
  empty, note: "Already linked from your website (<first source path>) and listed in your sitemap. Google has not visited it yet, which is
  common for a young website. What helps: links from other websites to your site, and asking Google to read your most important pages."
  (drop "and listed in your sitemap" when it is not). Only pages with NO internal link found keep action `links` with suggestions.
- Link suggestions (`link_from`) for `links` pages: sources must be indexed, must not already link to the target, must not be utility
  pages (§2.4), need a real topic overlap (IDF-weighted, a minimum score; no fallback to generic pages: an empty list is better than a
  wrong one) and at most 3.
- **Canonical to another page with its own title**: when our fetch of a page (any lane, in sitemap or linked from the home page / a parent)
  finds `<link rel=canonical>` pointing to ANOTHER page of the site, and the page's `<title>` differs from that target's title (normalised,
  after removing the site name suffix; known target title from the inventory or our fetch), the cause is **`canonical_elsewhere`** with
  action **`site_fix`** even when the page is not in the sitemap; note: "This page tells Google it is a copy of <target path>, so Google
  shows that page instead. If this page should be found on its own, point its canonical tag to itself and add it to your sitemap." Pages
  whose title equals the target's (real duplicates, pagination, tracking variants) stay `alternate` / leave_out.
  Our fetch must therefore also read pages Google calls "Alternate page with proper canonical tag" or has never seen, within the existing
  60-fetch cap, linked-from-home pages first.
- **Utility pages** (§2.4) that are not indexed: cause `low_value`, action `leave_out`, note "Policy and utility pages do not need to be in
  Google." Never `quality` ("Improve this page"), never `ask_google`.

### 2.3 Ask Google (still manual: there is NO API for Request indexing; never automated)
- `ask_google` (≤ 5 newly marked per site per 7 days, unchanged cap) ranks candidates by value: (1) pages linked from the home page whose
  path or title marks a service / product / capability / solution / industry page, (2) articles (`/insights/`, `/blog/`, `/news/`,
  `/guides/`, dated paths), (3) other content pages; never utility pages, never job postings, never `leave_out`, never `quality` during a
  freeze. Ties: impressions, then shallower path.
- **Check back**: new column `asked_google_at` (string ISO) written by the APP when the client says "I asked Google" for a page. The
  engine, when `asked_google_at` is newer than the page's `inspect_at`, re-inspects that page within 2 days (priority right after the new
  lane, inside the cap). Result, written by the engine:
  - Google's `last_crawl` is after `asked_google_at` -> new column `google_read_after_ask_at` = last_crawl; `ask_google` cleared; the
    page's state / cause updated from that reading; note "Google read it again on <date>." (+ the new outcome).
  - 14 days after `asked_google_at` with no newer crawl: note "You asked Google on <date>; Google has not read it again yet. There is
    nothing more to do on your side for now."; the page can be offered again after 28 days.

### 2.4 Utility pages (one shared list, engine + app)
Path segments (case-insensitive, whole segment): privacy, privacy-policy, cookies, cookie-policy, terms, terms-of-service,
terms-and-conditions, legal, imprint, impressum, disclaimer, security (only as a top-level single segment), accessibility, sitemap,
login, signin, sign-in, register, signup, account, cart, checkout, search, thank-you, thanks. Job postings: a page under `/careers/` or
`/jobs/` with a further segment (the listing page /careers itself is a normal page).

### 2.5 Opt-in sitemap submission (writes to the client's Search Console ONLY when both gates pass)
- New `seo_monitors` column `index_sitemap_submit` (boolean, empty = **off**). Written by Site Admin `monitors` (validated like
  `index_watch`).
- Permission: the run already reads `permissionLevel` (`gsc_permission`); store it in `seo_index_runs.sitemaps_json.permission`.
  Full access = `siteOwner` or `siteFullUser`.
- Gate: `index_sitemap_submit` true AND permission full AND the property covers the sitemap URL AND the kill switch is not set (env
  `SEO_SITEMAP_SUBMIT` != 'off', baked at build like the other flags, default on; the per-site switch stays the primary control).
- When: (a) the sitemap we read (robots.txt line, else /sitemap.xml) is not in Search Console's list -> submit it; (b) it is listed with
  errors and its content fingerprint changed since our last submission -> resubmit; (c) its content fingerprint changed (URLs added or
  removed) since Search Console's `lastSubmitted` and our last submission is older than 7 days -> resubmit. Never an unchanged resubmit
  (Google: it does nothing). At most one submission per sitemap per 7 days, at most 3 sitemaps per site per run.
- How: a separate credential **`SEOcredGoogleSvcW`** (same service account key, scope `https://www.googleapis.com/auth/webmasters`),
  used by ONE HTTP node only (`PUT https://www.googleapis.com/webmasters/v3/sites/{site}/sitemaps/{feedpath}`); no retry on a 4xx; the
  read-only credential stays on every other node. Added to `sync_credentials.py` (fixed id), created by `deploy_engine.py --credentials`
  from the existing `SEO_GOOGLE_SA_*` settings.
- Record + check back: `seo_index_runs.sitemaps_json.submissions` = [{path, at, status, reason}]; the next run reads `sitemaps.list`:
  `lastSubmitted >= at` -> "Submitted on <date>"; `lastDownloaded` after it -> "Google read your sitemap on <date>". A 403 -> permission
  recorded as not full, the app shows the warning; no retry until the permission reads full again.
- Never: the Indexing API; URL submission of any kind; resubmitting an unchanged sitemap; submitting for a site whose switch is off.

## 3. App

### 3.1 Wording and groups
- The "Google knows it but has not read it yet" / "unknown to Google" groups split by action: `links` -> today's "Add links from these
  pages" (with the suggestions); `wait` (already linked) -> "Google has not visited these yet", what it means (already linked from your
  site, young sites are visited slowly), what helps (links from other websites; ask Google for your most important pages), no
  suggestions, no step.
- `canonical_elsewhere` site_fix rows not in the sitemap: the existing `indexing:canonical_elsewhere` site task, its guide extended
  ("point the canonical tag to the page itself, then add it to your sitemap"); the own check: canonical self -> fixed.
- `low_value` utility pages: "Policy and utility pages: fine to leave out" (leave_out group).

### 3.2 Every client action has "I did it" + our check
- **Add internal links** (`links` pages): a new site-task kind **`indexing:links`**, one per site, listing up to 10 (target, suggested
  source) pairs. "I've done it, check now" + the daily check fetch the source pages (own host, safe fetcher, ≤ 10) and look for an `<a
  href>` to the target (resolved, host-agnostic within the site). Done when every listed pair has its link, or the engine's newest reading
  shows the target `linked_by` non-empty / indexed. Partial: "3 of 5 links found". Existing site-task rules apply (two misses reopen,
  unreachable never records, 45 s cap, engine reading decides when newer).
- **Ask Google**: each listed page gets "I asked Google" (member+, rate-limited, audited) which writes `asked_google_at` on that page's
  `seo_index_pages` row through the same n8n Data Table write path the app already uses; the page then shows "Waiting for Google to read it
  again" until the engine writes `google_read_after_ask_at` ("Google read it again on <date>") or the 14-day note. The guide stays.
- **Sitemap**: Tracking & monitors gets "Let Alaventra submit your sitemap to Google" (off by default; Site Admin `monitors` field
  `index_sitemap_submit`). Next to it the access Google reports for us (from the latest run's `permission`): full -> "We can submit
  your sitemap"; restricted / read-only -> a warning "Google gives us read-only access, so we cannot submit your sitemap. Give us Full
  access in Search Console, or submit it yourself" + the guide (new guide: grant Full access to the service account); never checked yet ->
  "We will know after the next daily check". The Indexing page shows the submission history and Google's read date. The existing
  `indexing:sitemap` step stays for sites with the switch off (or without full access) and is ticked by the engine's reading.
- Copy everywhere the app promises read-only access (setup guide "Nothing is ever changed, submitted or removed in your account",
  connection screens, marketing security / FAQ): "We only read your Search Console, unless you switch on sitemap submission, which lets us
  submit your sitemap and nothing else."

## 4. Tests and safety
- Engine harness: devaicon-shaped fixtures (home page HTML with the links above, the 7 industry pages with canonical -> /industries,
  the job pages under /careers, /privacy crawled-not-indexed): every row's expected cause / action / note; link suggestions never generic;
  ask_google order; utility pages; asked_google_at loop over simulated days; sitemap gate (switch off / restricted / full / unchanged
  fingerprint / errors + changed / 7-day spacing / 403); the write credential used by exactly one node; no other workflow changes.
- App tests per new behaviour; the site-task kind `indexing:links` follows every SITE_TASKS.md rule; the new write path is member+,
  org/site-scoped, audited; copy rules.
- Deploy: engine first (`sync_tables.py` adds `linked_by`, `asked_google_at`, `google_read_after_ask_at`, `seo_monitors.index_sitemap_submit`;
  `deploy_engine.py --credentials` creates `SEOcredGoogleSvcW`), then the API, then the web; no app migration expected. The first live
  sitemap submission happens only after the owner switches it on for one site.
- Tutorials: a row in the tutorials backlog (owner rule), no filming.
