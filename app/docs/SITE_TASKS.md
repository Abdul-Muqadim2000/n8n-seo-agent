# Steps on your website (site tasks)

2026-10-28. Asked for by the owner after the techand.ai review: "where in the platform, during the pipeline, have we told the client to do
this, let them mark it done, then check whether it is done and set it as done or not?" The answer was: nowhere as one flow.

## 1. Survey (what existed on 2026-10-28)

Steps the client must do **on their own website** (outside the app), and what the app did with each:

| Step | Where it was asked | Checked? | Saved? | In Pipeline "Needs you"? |
|---|---|---|---|---|
| IndexNow key file | Recommendations `ai:indexnow`; a callout on the AI visibility page | "Check the file" on the AI page only (`POST …/ai/indexnow/check`) | **No**: the answer was returned and forgotten; the step stayed open until the engine's next weekly AI Growth run fetched the file itself | **No** |
| Let AI search crawlers read the site (robots.txt) | AI visibility page, crawler access panel (`AccessPanel`) | Weekly, by the engine only | n/a | **No** (and no recommendation) |
| Redirect a broken page that other sites link to | Recommendations `bl:reclaim:<url>` | Monthly, by the backlink report only | n/a | **No** |
| Publish a written page | Needs you `publish` | Yes: "I published it" runs the live publish check | Yes (content log) | Yes |
| Search Console / GA4 access | Needs you `connection:*`, Verification & Google | Yes ("Check now") | Yes | Yes |

So the first three were the gap: the client was told in one place (or not at all), could not say "done", and was never told it was done
until a weekly or monthly engine run happened to read it again. On production (techand.ai) the IndexNow file was still missing on
2026-10-28 (`https://www.techand.ai/<key>.txt` answered 404) and nothing in the Pipeline said so.

## 2. Design

One model for every step on the client's own website: **a site task**.

- **Kinds** (v1): `indexnow` (the key file), `ai_crawlers` (robots.txt blocks an AI answer crawler: ChatGPT search, Perplexity, Claude
  search, Googlebot, Bingbot …; training crawlers stay the owner's choice and are never a task), `redirect:<url>` (a broken page other
  sites link to, from the latest backlink report).
- **Each task has one check** the app runs itself, on the client's own host only (https, public addresses, size cap, the existing SSRF
  guard):
  - `indexnow`: the key file answers 200 and contains only the key.
  - `ai_crawlers`: robots.txt read with **the engine's own matcher** (`_ai_access_kit.js` ported to `shared/src/robots.ts`, same cases
    tested on both sides): every answer crawler the engine found blocked may read `/` and the key pages it was blocked from. No robots.txt
    (404) = allowed; a 5xx robots.txt = not done (crawlers treat it as "do not crawl").
  - `redirect`: the old address answers a **permanent** redirect (301 / 308) to a page on the site that answers 200, or answers 200 itself
    (the page is back). A temporary 302 / 307 is "almost": it says so and stays to do.
- **Done or to do is decided by the newest observation**: the engine's weekly / monthly reading, or the app's own check (the client's
  "I've done it, check now", or the daily background check). A step that was done and is found missing again is **reopened** and shown
  as such ("Done on 28 Oct; the check on 4 Nov found it missing again").
- **Stored** in a new app table `site_tasks` (one row per website × task key: the values, the last check, when it was last done, a skip).
  Nothing else is written; no existing row changes. A website with no stored row still shows its tasks (derived at read time from the
  engine's data), so every production website gets the feature the moment it is deployed.
- **Daily background check** (`SITE_TASK_JOBS`, default on): every 6 hours, each website's tasks whose last check is older than 24 hours
  are checked again, so a client on autopilot who never clicks anything still sees "Done" once they make the change, and a removed file
  is reopened within a day instead of a week.
- **Skip**: a member can skip a task ("Not for us", e.g. a redirect they do not want); it leaves the to-do list, stays visible as skipped,
  and can be restored. Every check, skip and restore by a person is written to the company's audit log.

### Rules added by the review (2026-10-28, before the first deploy)

- **Redirects read only full backlink reports.** The weekly light watch does not look for broken pages, so its silence would have marked
  every redirect step done each Monday and reopened it a day later. A page that falls below the five shown is still broken, not fixed.
- **Our own fetch of a redirect beats the backlink index**, which lags by weeks: an index "still broken" decides only when it is more than
  a week newer than our last reading.
- **A click that gets no answer records nothing** (503 "try again in a minute"); only the daily check's two-miss rule may reopen a step.
- **The safe fetcher reads hosts the way Node does**: an address with a user name or password, or an IP literal, is refused before any
  request (a regex read `good.com` in `https://good.com:x@10.0.0.5/`). This also hardens the existing ownership and IndexNow checks.
- **The robots.txt matcher has no backtracking regex** (a client's `/*a*a*a*b` must not stall the server); 4,000 random cases answer as
  the engine's regex does. The engine's own kit still uses the regex: a follow-up for the engine.
- One check is cut at 45 s, a daily tick never overlaps the previous one, websites are read longest-ago first, paused websites are not
  checked, reading the steps writes nothing unless a value changed, and the readings come from three small reads (the latest AI growth
  run, the newest AI visibility run with crawler access, the latest full backlink report), not the whole dashboard.

## 3. Where the client sees it

- **Pipeline → Needs you**: every task still to do (reopened ones marked Important); the button scrolls to the task.
- **Pipeline → "Steps on your website"** (new panel): every task, to do ones highlighted, done ones ticked with when and how they were
  confirmed, skipped ones muted; per task the values to copy, "Show me how" (the existing guide), "I've done it, check now", Skip / Restore.
- **Recommendations**: `ai:indexnow` and `bl:reclaim` disappear once their task is done; open ones carry the same check button; a new
  `ai:crawlers` recommendation for a blocked answer crawler.
- **AI visibility page**: the IndexNow callout uses the same task (its check is saved now).
- Viewers see the state; members and above check and skip.

## 4. Safety for production data

- One additive migration (`0024_site_tasks`): a new table only, foreign keys `ON DELETE CASCADE` to the company and the website. No
  backfill, no change to any existing table or engine table, no engine (n8n) change.
- The old `POST …/ai/indexnow/check` keeps its answer shape (old browser tabs keep working) and now also saves the result.
- Fetches go only to the website's own host (and `www.`), https, through `lib/netGuard`; 10 s timeout, 64 KB cap; one website at a time
  in the background job, at most 60 tasks per tick.
- `SITE_TASK_JOBS=false` stops the background check without a deploy of code.

## 5. Out of scope (v1), noted

Listings on directories (bot walls make a reliable check impossible; the Link Builder's own weekly checklist stays the source), outreach
e-mails (their proof is the link, found by the backlink monitor), audit fix-pack items (robots.txt / llms.txt / schema / redirects of the
audit: the next audit re-checks them; a later version can turn each into a task with the same machinery), e-mail notices when a task
flips.

## 6. Kind `indexing` (Index coverage, 2026-10-29)

Added with the Index coverage feature (`n8n/seo-agent/docs/indexing-2026-10-29/DESIGN.md` §6.2, `shared/src/indexing.ts`). One step per cause
only the client can fix, key `indexing:<cause>` (noindex, robots.txt block, server error, login / 403, not found, empty page, a copy listed in
the sitemap, a redirecting address in the sitemap, a page missing from the sitemap), listing up to 25 of its pages (most impressions first)
and how many there are. Every rule above holds:

- **Newest reading decides.** The engine's reading (`by: 'index'`, "Daily index check on ...") is the newest time its daily index run read
  any listed page with that cause; a run after the step was stored that lists none of its pages any more reads it as done.
- **Our own check** opens at most 10 of the listed pages on the website's own host through the safe fetcher (its opt-in header return reads
  `X-Robots-Tag`; no existing caller changed), reads the sitemap once (robots.txt `Sitemap:` lines, else `/sitemap.xml`, an index followed
  for 5 children) and robots.txt for a block with the shared matcher. Done only when every page it opened is fixed.
- **Unreachable never records**: one listed page with no answer is "the website did not answer" (503 on a click, nothing stored daily).
- 45 s cap (pages four at a time, the sitemap in parallel), one website at a time, paused websites skipped, two misses an hour apart reopen,
  skip / restore audited, a guide per cause (`index-*` in `shared/src/guides.ts`).
- **One page, one ask**: a broken page that is already a `redirect:` step (from the backlink report) is left out of the `not_found` list.
- **Budget**: see fix wave 1 below (a third of each tick is reserved for indexing steps).
- The fall-through that read any unknown key or kind as a redirect is gone: `siteTaskKindOfKey`, `siteTaskPayload`, `present`, `doneDetail`
  and `runSiteTaskCheck` are exhaustive switches (a kind added without its check does not compile; a stored row of an unknown kind reads
  nothing and records nothing).

### Fix wave 1 (2026-10-29, `n8n/seo-agent/docs/indexing-2026-10-29/FIX_CONTRACT.md`), binding for this kind

- **The exact positive signal per cause** (FIX_CONTRACT decision 3): noindex = a 200 HTML page with no noindex in the header or the page;
  server error / login = 200; not found = 200, or a 301 / 308 to a page of the same website that answers 200; canonical = the page names
  itself, or a COMPLETE sitemap read no longer lists it; robots = a real robots.txt (a text file, or a 404) that allows the pages. Anything
  else from our side (a 401 / 403 / 429 / 503 wall, a challenge page, a redirect to another website, a robots.txt that is a web page) is
  **"could not tell"**: nothing recorded daily, 409 `site_unsure` on a click.
- **A sitemap's silence counts only from a complete read** (every listed sitemap an XML list, read in full, children followed up to 12, none
  on another host, none compressed); otherwise "not listed" is "could not tell". One download per website per check round.
- **Google's reading is dated by Google's inspection**, never by the engine's weekly re-fetch, so a step our check found fixed is not
  reopened by a stale reading. Pages the engine's own fetch saw fixed after Google's reading (`fix_seen_at`) make a step **done, waiting for
  Google**, never reopened by the older reading.
- **No conclusion from a capped read**: each cause is read on its own (200 rows, sorted by impressions); a capped cause never reads as done.
- **One page, one ask**: a cause whose pages are all `redirect:` steps has no indexing step at all (never a "done").
- **`indexing:sitemap`**: Search Console lists no sitemap, or reports errors (`seo_index_runs.sitemaps_json`); only the daily index check can
  tick it off (Search Console's list is Google's), so its "check now" answers 409 `engine_reads_it` and the daily check records nothing.
- **Done says what we checked** (per cause), never "Google can now read and choose these pages".
- **Budget**: a third of each tick's checks is reserved for indexing steps; the other kinds take the rest.
- **Rollback**: before reverting the API, delete or skip the `site_tasks` rows with `kind = 'indexing'` (an older build reads them as
  redirect steps).

