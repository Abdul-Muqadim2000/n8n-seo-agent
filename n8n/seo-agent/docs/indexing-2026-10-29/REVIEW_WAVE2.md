# Index coverage wave 2: independent adversarial review (2026-10-30)

Scope: `git diff 35c24b03..9c488ce6` on `feature/indexing` (engine `SEOagentIndexCv1` + kit, Site Admin, schema, app shared / server / web,
marketing). Contract: DESIGN_WAVE2.md on top of DESIGN.md / FIX_CONTRACT.md. Read-only on the source: every probe ran on copies in the
session scratchpad (kit extracted from the generated `harness/code_v4/Index_Diagnose.js`, the app's shared module in a copy, a throwaway
`n8nio/n8n:2.41.4` with its own data directory). No deploy, no production access, no paid API, no Search Console call. Public reads only:
devaicon.com (home, /robots.txt, /sitemap.xml, /industries, /industries/{bfsi,retail,nonprofit}, /careers, /careers/data-engineer, /privacy,
/security, /about-devaicon, the capability pages and articles for their titles) and www.techand.ai (home, robots.txt, sitemap.xml).

Severity: High = a write to a client's Search Console it should not make, wrong client advice, tenancy / security, or a regression;
Medium; Low. "Suspected" = shown by reading the code path only, not by running it.

## Findings

### W1 (High, opt-in sites only) The app hides the "Submit your sitemap" step and promises a submission the engine will not make
- Where: `n8n/seo-agent/v5/code/_index_kit.js:1431` (`permission_full = FULL_ACCESS.includes(perm) && !denied`, computed before and
  independent of the gate), `app/server/src/services/siteTasks.ts:189` (`sitemapAuto = submitOn && access === 'full'`),
  `app/shared/src/site-tasks.ts:268` (step suppressed when `sitemapAuto`), `app/web/src/pages/site/IndexingPage.tsx:277` and the text below
  it ("We will submit it on the next daily check; there is nothing to do on your side."). The app never reads `sitemaps_json.submit.gate`
  or `submit.skipped` (`runSitemapsOf`, `app/shared/src/indexing.ts`, parses only permission / permission_full / submissions / list).
- Scenario: switch on, Google reports `siteFullUser`, Search Console lists no sitemap, and the engine cannot submit because (a) the kill
  switch `SEO_SITEMAP_SUBMIT=off` is baked, (b) robots.txt names no sitemap and `/sitemap.xml` is not one (common: `/sitemap_index.xml`
  not named in robots.txt), or (c) the property is a URL-prefix property on the other host (`https://www.x.com/` while the sitemap is on
  `x.com`). The client gets no step and is told every day that we will submit it, forever. Using the kill switch therefore makes the app lie
  to every opted-in client.
- Verified: probe of `IX.submitPlan` (scratchpad `rv_probe/p6.js`): kill switch -> `gate kill_switch, permission_full true, submit 0`;
  no readable sitemap -> `gate ok, permission_full true, submit 0, skipped "no sitemap read today"`; URL-prefix www vs bare sitemap ->
  `permission_full true, skipped "outside the Search Console property"`. Code reading of the three app sites above.
- Not a deploy blocker (every site's switch is empty = off after the deploy); a blocker for switching it on for any client.

### W2 (High, regression for every client) A Google error with a non-JSON or empty body now reads as "Search Console lists no sitemap"
- Where: `n8n/seo-agent/v5/code/IX_Inventory.js:59-61` (the `{}` = "no sitemap" heuristic). `GSC Sitemaps List` has `neverError: true`
  and no `fullResponse`, so the status code is not visible.
- Scenario: Google's front end answers `sitemaps.list` with a 502 / 503 HTML page or an empty body. The heuristic accepts any object without
  `sitemap` and without an `error|message|status|code` key, so `gscSitemaps = []` -> run row `submitted: 0` -> the `indexing:sitemap` step
  "Search Console lists no sitemap for this website" appears for a client whose sitemap is submitted (switch off: every client), and an
  opted-in site gets an unneeded PUT (`reason not_listed`). Before wave 2 the same answer was `null` (nothing concluded).
- Verified: n8n 2.41.4 throwaway instance, HTTP Request 4.5 with `neverError`: an HTML 404 body comes out as
  `{ data: '<!DOCTYPE html>...' }`, an empty 502 body as `{}`; the exact expression of line 61 maps both to `[]` (`rv_probe/p3.js`). An empty
  502 is indistinguishable from Google's real empty answer without the status code: read the list with `fullResponse` and treat `{}` as
  "no sitemap" only on a 200.

### W3 (Medium) The utility list matches a segment at any depth: real content pages are told "fine to leave out"
- Where: `_index_kit.js:1242-1243` (`isUtility`: `g.some(...)`), mirrored in `app/shared/src/indexing.ts:351` (`isUtilityPage`); applied by
  `IX.refine` to every not-indexed page whatever its sitemap / home-link status.
- Scenario: `/industries/legal` (an industry page, the same shape as devaicon's /industries/*), `/features/search`, `/solutions/accessibility`,
  `/services/legal/contracts`, `/blog/thanks`: all become `low_value / leave_out` with "Policy and utility pages do not need to be in Google.",
  are never offered to ask Google, never get a step. `/security` as a top-level page of a security company is the same.
- Verified: `rv_probe/p2.js` (refine + noteOf) and the app copy (`isUtilityPage` true for the three). Not hit by devaicon.com or techand.ai
  (their only utility pages are /privacy, /cookies, /security, which are real policy pages). DESIGN §2.4 does not say "any depth"; a top-level
  (or first-segment) match, or an exemption for pages in the sitemap and linked from the home page, would avoid it.

### W4 (Medium) "Canonical to another page with its own title" fires on filter / facet variants
- Where: `_index_kit.js:1332` (`canonicalOwn`), `:1357` (`refine` rule 1). Only the title is compared; `isLowValue` is not consulted and
  `LOW_VALUE` lists `filter|sort|page|...` but not facet keys such as `color=` / `size=` / `brand=`, so such URLs are also fetched.
- Scenario: an e-commerce client whose `/products?color=red` ("Red Products | X", canonical -> /products) has impressions in Search Console:
  Google says "Alternate page with proper canonical tag", our read sees its own title, and the client gets the site step "point its canonical
  tag to itself and add it to your sitemap" for a facet page whose canonical is correct. Same for a campaign landing page canonicalised to the
  home page. DESIGN §2.2 assumed variants share the target's title.
- Verified: `rv_probe/p2.js`: `/products?color=red own=true -> canonical_elsewhere site_fix`, `/lp/spring-offer own=true -> site_fix`,
  `/products?utm_source=a` stays `alternate` (same title), `/blog/page/2` would be `site_fix` but is never fetched (isLowValue). Devaicon's 7
  industry pages are classified as intended.

### W5 (Medium) A parent page that is not read turns its children back into "add internal links"
- Where: `n8n/seo-agent/v5/code/IX_Site_Links.js:43` (only read sources enter the index; an unread parent contributes nothing),
  `_index_kit.js:835` (`linked_by` is a list or `''` whenever the HOME page was read) and `:1362` (`''` -> `links`). Only the home page has the
  `'unread'` protection; parents are capped at 10 (`parents_max`) and read without following redirects.
- Scenario: /careers answers 503 (or a 3xx) one day, or the site has more than 10 parents with not-indexed children: the job pages (or the
  children of the 11th parent, the same ones every day because the order is stable) get `linked_by ''`, action `links`, link suggestions, and
  join the `indexing:links` step, then flip back to `wait` the next day the parent answers. The exact advice wave 2 set out to remove, and a
  step that appears and is closed by the engine without the client doing anything.
- Verified: code path (suspected in a live run: the harness's day 2 covers only the home page answering 503). Fix: a page whose parent was
  planned but not read (or not planned because of the cap) should get `'unread'` (keep what was stored), not `''`.

### W6 (Medium) The sitemap checkbox in the onboarding and "Start weekly tracking" forms is silently dropped
- Where: `app/web/src/components/site/TrackingForm.tsx:221` renders `MonitorSettingsFields` (which now contains "Let Alaventra submit your
  sitemap to Google"); those forms save through `mode: 'track'` (`SiteSettingsPage.tsx:188-189`, onboarding `launch-plan.ts`), and
  `n8n/seo-agent/v5/code/Monitor_Row_Track.js:29` always writes the stored value. Only the Website settings "Growth monitors" card (Site Admin
  `monitors`) stores it.
- Scenario: a new client ticks the box during onboarding; nothing is stored, the Indexing card later says "Sitemap submission is off". Safe
  direction (no write), but the client believes it is on. The same pattern already existed for `indexWatch` / `indexDailyCap`.
- Verified: code reading; harness IXV7 itself asserts that "Track my site" carries the stored value.

### W7 (Low) A 403 at Full access is shown as "Google gives us read-only access"
- `_index_kit.js:1431` (`denied` makes `permission_full` false) -> `app/shared/src/indexing.ts:877` (`access: 'restricted'`) -> the warning
  "Google gives us read-only access ... Give us Full access". If Google refuses `sitemaps.submit` to a `siteFullUser` (RESEARCH §A says the
  required level is still unconfirmed), a client who already gave Full access is told to give Full access, for 28 days. Probe: `rv_probe/p3.js`
  ("403 before, same level" -> `denied_before`).

### W8 (Low) A missing write credential is reported to the client as Google's refusal
- `IX_Run_Rows.js:49`: any non-2xx / non-403 answer, including n8n's own "credential does not exist" error item (status 0), becomes "Google
  did not accept our sitemap submission today (...); we try again in 7 days." Verified on the throwaway n8n 2.41.4 that Index Coverage
  publishes and both triggers activate WITHOUT `SEOcredGoogleSvcW` (so the deploy order is not a blocker), and with `rv_probe/p3.js` that an
  `{ error: ... }` answer maps to `failed`.

### W9 (Low) The 14-day "nothing more to do on your side" note overrides a site step
- `_index_kit.js:742`: once `askState` is `quiet` the whole note is replaced, whatever the action. A page asked about whose cause later became
  `noindex` / `not_found` (`site_fix`) reads "There is nothing more to do on your side for now." (`rv_probe/p5.js`). The step itself still
  exists in the app; only the engine note is wrong.

### W10 (Low) Read-only promises left unchanged
- `app/web/src/pages/onboarding/_components/VerifyStep.tsx:21`: "adding our read-only service account as a user; we never change anything in
  your accounts." and `app/web/src/pages/site/SiteSettingsPage.tsx:171` "adding our read-only service account". DESIGN §3.2 asks for the new
  sentence everywhere the app promises read-only access. Everything else found by grep (guides, connection screens, Security page, FAQ,
  privacy draft, features, changelog) was rewritten; no em dash, curly quote, "...", indexing promise, "we ask Google" or "we change your site"
  in the added copy.

### W11 (Low) The links step overclaims, and the engine cannot see a link added where we asked
- `app/shared/src/site-tasks.ts:483` says "no other page of your website links to them"; the engine reads only the home page and up to 10
  parents. A link the client adds on a suggested article (not a parent) is found by our own check (step done), but the engine never sees it:
  the page stays `links` on the Indexing page with the same suggestion.

### W12 (Low) One shared rare word is a "real topic overlap"
- `_index_kit.js:52` (`link_min_score: 1.0` = one word with df 1 among ~9 candidates). On devaicon's real titles `/careers` ("Careers at
  Devaicon - Join Our Innovation Team") is the first suggestion for `/insights/value-driven-innovation-automation` (through "innovation")
  (`rv_probe/p5.js`). Not visible on devaicon today (those articles are `wait`, no suggestions), but `/careers` (a listing page) is not
  excluded as a source.

### W13 (Low, suspected) The 7-day spacing holds only on the happy path
- The reservation (`IX_Reservation.js:26`) is written BEFORE the PUT and never carries today's submission. A run that crashes after a non-2xx
  PUT (or a 2xx that Search Console does not list yet) is replayed by the watch the same day and the next day reads the reservation as `prev`:
  another PUT. Two overlapping chains on one website (catch-up + schedule) each plan from the same `prev`. Google-side harmless (a resubmit),
  but outside "at most one submission per sitemap per 7 days".

### W14 (Low) Link detection edge cases
- Both detectors count `rel="nofollow"` links (`_index_kit.js:1267`, `app/shared/src/indexing.ts:1372`): a page linked only through nofollow
  is told "Already linked" / the step is done. The app ignores `<base href>` (false "missing") and counts an `<a href>` inside a `<script>`
  string. Probe in a copy of the shared module: relative, `../`, root, absolute www vs bare, http, query, trailing slash all correct.

### Not verifiable offline (kept from the builders, still open)
- Google's real answer to `PUT .../sitemaps/{feedpath}` with no body, and which permission level it requires (`siteFullUser` or only
  `siteOwner`): the first live submission must be watched (a 411 / 403 is recorded and held, which is the safe direction).

## Checked and fine
- **The write is gated** (`rv_probe/p3.js`, every case through `IX.submitPlan` and re-checked in `IX_Sitemap_Submit_Requests.js:18-21`):
  switch off -> `off`; restricted -> `not_full_access`; kill switch -> `kill_switch`; list not read -> `list_not_read`; permission not read ->
  `not_checked`; 403 held at the same level for 28 days, lifted by `siteOwner`; URL-prefix property on the other host -> skipped; a robots.txt
  sitemap on another host is planned by `submitPlan` but refused by `IX.safe` in Submit Requests (own registrable domain only); 4 robots
  sitemaps -> 3 submitted; ours 3 days ago -> skipped, 8 days ago -> resubmitted; first reading is a baseline (`changed_at ''`: the deploy
  triggers no resubmit), a changed tree after a complete read -> `changed`, an incomplete read keeps the old fingerprint and submits nothing;
  never an unchanged resubmit. A listed sitemap is resubmitted under Search Console's own address (bare vs www).
- **One write node**: across ALL generated workflows, `SEOcredGoogleSvcW` is on exactly one node (`Submit Sitemap (Index)`) and it is the
  only PUT / PATCH / DELETE HTTP node; it is fed only by `Any Sitemap Submit?`; `neverError` + `fullResponse`, so a 4xx / 5xx is an answer
  and is never retried (the 3 tries cover only a thrown network error; a repeated PUT is idempotent). Kill switch baked `'on'` in both nodes.
  `sync_credentials.py`: fixed id, same `SEO_GOOGLE_SA_*` fields and fixed settings as the read credential, scope
  `https://www.googleapis.com/auth/webmasters` only; `deploy_engine.py --credentials --create-missing` reads the same `CREDS`. No key, token
  or private key in the diff (scan).
- **Throwaway n8n 2.41.4**: Index Coverage imports, publishes and activates both triggers with the write credential absent.
- **devaicon.com, live vs the fixtures**: the home page links 27 own pages incl. all 7 /industries/* (engine `IX.pageLinks`); /industries links
  the 7, /careers the 6 job pages, /capabilities/open-edx-services its 2 children; the 7 industry pages carry their own titles with canonical
  -> /industries (bfsi, retail, nonprofit read live); job pages and /privacy, /security are self-canonical. `IX.isUtility`: /privacy /cookies
  /security true, /careers false, /careers/data-engineer a job posting. `askValue`: /industries and /capabilities/open-edx-services class 1,
  articles 2, /about-devaicon /insights /engagement-models 3 (so "ask Google" ranks capability / industry pages first). Harness IXV1-IXV7 pass
  on these fixtures.
- **techand.ai** (www host, 48 sitemap URLs): the home page's 43 links are all in the sitemap or utility; the only utility pages are /privacy,
  /security, /cookies; parent plan /insights, /whatwedo, /capabilities.
- **"I asked Google"**: `POST .../data/indexing/asked-google` is member+ (`siteAccess(..., 'member')`), verified websites only, 30 per 10 min
  per person, audited only after a successful write; it reads the row by `site_id + url` (and the domain), refuses an indexed page (409), an
  unknown one (404), and answers 503 with nothing saved when n8n or the column is missing; the write is `PATCH rows/update` with filter
  `site_id + url` and data `{ asked_google_at }` only, never an upsert. The engine carries the column through `slimPrev` / the row spread and
  never changes it; a lost press is shown as "Not recorded" from the audit log. `askState` over 30 simulated days: waiting days 0-13, quiet
  14-27, offered again from day 28; `readAfterAsk` ignores a crawl before the ask. Turning the switch on is admin-only and audited
  (`/sites/:siteId/admin`, `siteAccess(..., 'admin')`).
- **Steps on your website `indexing:links`**: own host only for target and source, the existing safe fetcher, a page that does not answer
  records nothing (`reached: false`), a wall / challenge / off-site answer is "could not tell", partial "N of M links found", the daily tick
  shares the indexing third (`INDEX_TASK_KINDS`), new pages joining the list never count as a reopen, the engine only closes it on a complete
  read; every switch on `SiteTaskKind` is exhaustive (typecheck clean).
- **Regressions**: the 10 other workflows change only by the new column in their "Ensure Monitors Table" create schema (no upsert maps it);
  Site Admin changes `Admin Action` (validation, refusal message) and `Monitor Row (Admin)` (kept when not given); SEO Agent v4 changes
  `Monitor Row (Track)` only (carries the stored value). The removed count-based `ix:links:<cause>` recommendations are replaced by `ix:links`.
- **Suites in copies**: engine harness in Docker (`n8nio/n8n:2.41.4`) **13988 passed, 0 failed**; app (`node:22-bookworm-slim`, `TZ=UTC`,
  `npm ci`): typecheck clean in shared / server / web, shared **987 / 987** (the utility parity test included), server **1563 passed, 46
  skipped**, web **285 / 285**.

## Ready to deploy?
1. Nothing can write to a client's Search Console after the deploy: every site's switch is empty (= off), the gate and its re-check hold.
2. Fix W2 before deploying (a regression for every client: a transient Google error raises a false "submit your sitemap" step).
3. W3, W4, W5 give wrong advice to sites with those shapes (none of them devaicon.com or techand.ai); fix soon after, W5 first.
4. Before switching sitemap submission on for any client: W1 (and W6, W7); watch the first live submission (Google's answer is untested).
5. Ready to deploy once W2 is fixed; not ready to switch submission on for a client until W1 is fixed.
