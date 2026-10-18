# Server-log and AI-crawler analytics (gap #6, 2026-10-17)

**What it answers.** What Googlebot, Bingbot, Applebot and the AI crawlers *actually requested* on the customer's site — not what
Search Console decided, not what a robots.txt test predicts: which pages, how often, what the server answered, how fast, and which
of those "crawlers" were impostors. It is the only ground truth on crawling, and every enterprise suite has it (MARKET_BENCHMARK.md
§5 gap #6): Botify LogAnalyzer (GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, Google-Agent), Profound Agent Analytics (nine CDN /
log sources), Ahrefs Bot Analytics (Cloudflare), Conductor (CDN logs), Semrush Enterprise.

**Where it lives.** Entirely in the app server and its Postgres (`app/server/src/services/crawlers/`, `routes/crawlers.ts`); the
engine (n8n) is only *read* for the page inventory (`seo_pages`). The page is **Crawlers** in each website's sidebar.

## 1. Threat model and failure modes

| Risk | What could go wrong | What the build does |
|---|---|---|
| Spoofed crawlers | Scrapers send `User-Agent: Googlebot` / `GPTBot`; a UA-trusting report would credit them to Google / OpenAI | Identity is never taken from the user agent alone (§3). A checkable crawler whose address fails the check is **spoofed**, counted apart and left out of every other figure |
| Forged forwarding headers | A client sends `X-Forwarded-For: 66.249.66.1` to pass as Googlebot through a proxy | Only the **rightmost** forwarded entry that is not a proxy is believed — the one the proxy appended (§2.3) |
| Logs that record the proxy | Behind Cloudflare / a load balancer the log holds the edge address; every real Googlebot would look spoofed | Private ranges and Cloudflare's published edge ranges are recognised; such lines are **unchecked**, never spoofed, and a recommendation explains how to log the visitor address |
| Broken IP-list refresh | A vendor answers an empty page / error; an empty list would turn every real crawler into "spoofed" | The refresh refuses an empty, unreadable or >90 % smaller list and keeps the previous one; a dated copy ships with the code |
| DNS outage | Reverse DNS times out | "No answer" is **unchecked**, never spoofed; at most 2,000 DNS checks per ingest, one per (crawler, address), cached 24 h |
| Personal data | Access logs hold visitors' IP addresses and URLs | People's requests are counted and **dropped** (no row). No address is stored for anyone: only, for a crawler request that was *not* proved, its /24 (IPv4) or /48 (IPv6) network. Parameter **names** are kept, never values. The raw upload is deleted when its job ends (§5) |
| Push endpoint abuse | Anyone POSTs fake logs for a site | Per-site push key (`asl_` + 256 bits) in `X-Alaventra-Log-Key`; only its SHA-256 is stored; constant-time compare; one 401 for every refusal (unknown site, unverified site, wrong / revoked key); 120 pushes a minute per site; 100 MB a push |
| Cross-company access | Company B reads A's crawler data | Every route resolves the site through the company membership (404 for another company's website), dashboards need a **verified** website, the read API is scoped to the key's company |
| Double counting | Overlapping uploads (`access.log` and `access.log.1`), a Logpush retry after a timeout | Same file (SHA-256) refused per site; each stored line has a 16-byte line hash with a unique index per site (`ON CONFLICT DO NOTHING`), and a request id (Cloudflare `RayID`, Vercel `requestId`) replaces the line when present |
| A 1 GB file blocks the server | Buffering or a long synchronous parse | The body is streamed to a spool file (hashed and size-checked on the way); a background worker streams it (gunzip → readline) in batches of 2,000 lines, each batch awaiting one multi-row insert. Measured: **1,000,000 lines in 16.1 s (62,000 lines/s) with a maximum event-loop lag of 45 ms** (`test/crawlerDb.test.ts`, `CRAWLER_PERF_LINES=1000000`, throwaway Postgres 17) |
| Restart mid-ingest | A job stays "processing" for ever | On start the worker re-queues its own unfinished jobs whose spool file survived, fails the others with a plain reason |
| CSV injection | A path starting with `=` opens as a formula in a spreadsheet | Cells starting with `= + - @` are prefixed with `'` |

## 2. Ingestion

### 2.1 Upload (app)
`POST /api/orgs/:orgId/sites/:siteId/crawlers/upload?name=` — member, verified website, raw body (the web client sends the `File`
with `XMLHttpRequest` for a progress bar; `Content-Type: application/octet-stream`). The route has its own content-type parser that
hands the request stream through, so Fastify's 1 MB JSON limit never applies and nothing is held in memory. **Limit: 1 GB per file**
(compressed or not; `Content-Length` checked first, bytes counted while streaming), 20 uploads an hour per user, 20 million lines per
file (the rest is reported as not read). Answers 202 with the queued ingest, or 200 `duplicate: true` for a file already read.

### 2.2 Push (Cloudflare Logpush, log drains)
`POST /api/ingest/logs/:siteId` with header `X-Alaventra-Log-Key: asl_…` (or `Authorization: Bearer asl_…`). No session, no CSRF
header (like the n8n callback route; a cross-site form cannot set the header). Body: gzip or plain NDJSON, or a JSON array (Vercel's
"JSON" format) — gzip is detected from the bytes, so `Content-Encoding` does not matter. **Limit 100 MB a push.** Always answers 200
for an accepted or already-received batch (a sender retrying after a timeout must stop retrying), 401 for any refusal, 413 above the
limit.

- **Cloudflare Logpush** (HTTP destination, Enterprise plan, https://developers.cloudflare.com/logs/logpush/logpush-job/enable-destinations/http/):
  `destination_conf = <endpoint>?header_X-Alaventra-Log-Key=<key>` — Cloudflare turns every `header_*` URL parameter into a request
  header. Dataset `http_requests`; fields `ClientIP, ClientRequestHost, ClientRequestMethod, ClientRequestURI, ClientRequestUserAgent,
  EdgeStartTimestamp, EdgeResponseStatus, EdgeResponseBytes, OriginResponseDurationMs, RayID`; timestamps RFC3339 (Unix and UnixNano
  are read too); `max_upload_bytes` ≤ 100 MB. Cloudflare validates the destination with a gzipped `{"content":"tests"}`: accepted and
  skipped.
- **Vercel** drains (https://vercel.com/docs/drains/using-drains): Custom endpoint, Custom headers `X-Alaventra-Log-Key: <key>`,
  NDJSON or JSON; the request lives in `proxy.*` (https://vercel.com/docs/drains/reference/logs); build / function lines without a
  `proxy` are skipped; `requestId` collapses several lines of one request.
- **Fastly** HTTPS logging (https://www.fastly.com/documentation/guides/integrations/logging-endpoints/log-streaming-https/) with a
  custom header and the JSON log format given in the guide.
- **Akamai DataStream 2** custom HTTPS (https://techdocs.akamai.com/datastream2/docs/stream-custom-https): `reqTimeSec, cliIP,
  reqMethod, reqPath, queryStr, statusCode, totalBytes, UA` (URL-encoded, decoded), `reqHost`, `turnAroundTimeMSec`.
- Anything else that POSTs JSON lines with the header: the parser recognises the usual names (§2.3).

The push key is created (or replaced — the old one stops at once) and switched off by an **admin** on the Crawlers page and shown
**once**; only `sha256(key)` and a display prefix (`asl_` + 8 characters) are stored in `log_sources`.

### 2.3 Formats (`services/crawlers/parse.ts`, detected from the first 20 lines)
- **combined / common** (Apache, Nginx): optional leading vhost (`%v:%p`), CLF time with offset, quoted request line, status, bytes,
  referer, user agent; trailing extras — a quoted forwarded-for list, and the request time (`0.123` = seconds, Nginx `$request_time`;
  an integer = microseconds, Apache `%D`).
- **W3C extended** (IIS, CloudFront standard logs): columns from `#Fields:`; spaces or tabs; `+` in the user agent is a space;
  `time-taken` ms (IIS) or seconds with decimals (CloudFront); CRLF endings.
- **JSON lines**: Cloudflare, Vercel, Akamai, Fastly, Nginx `escape=json`, and a generic `{ timestamp|time|@timestamp, ip|client_ip|
  remote_addr, method, path|uri|url|request, status, bytes, user_agent, request_time|response_time_ms|duration_ms }`. Times in s / ms /
  µs / ns by magnitude, ISO, or CLF.
- **The visitor's address**: the remote address unless it is private or Cloudflare's; then the rightmost forwarded entry that is
  not a proxy. Anything else is **proxied** (unchecked).
- Unreadable lines (no time, no request line, a TLS handshake sent to port 80, a cut-off JSON line) are counted with up to five line
  numbers and reasons — never the line itself, which may hold an address.
- Only the site's own hosts count (`domain` and `www.domain`); a host-less line (most server logs) is the site's; other hosts are
  counted as "for other hosts" and dropped. Subdomains are not included (the engine's site model is one host).

## 3. Who is really who (`shared/src/crawlers.ts` registry, `services/crawlers/verify.ts`)

Order of checks for a request whose user agent names a crawler:
1. On the vendor's **published IP list** → **verified**.
2. Not on it, and the vendor documents **forward-confirmed reverse DNS** (Google, Bing, Apple, Amazon, Yandex): the PTR name must end
   in the vendor's domain **and** resolve back to the same address → verified; otherwise **spoofed** ("no such name" is an answer).
3. A vendor with a list and no DNS rule, address not on the list → **spoofed**.
4. A vendor that publishes no way to check → **claimed, not verified** (Meta-ExternalAgent / -Fetcher, Bytespider, DuckDuckBot, SEO
   tools, any other "bot").
5. No address, a private or CDN address, DNS that did not answer, or the per-ingest DNS budget spent → **unchecked**.

| Crawler | Kind | Proof | Source (vendor's own) |
|---|---|---|---|
| Googlebot (+ -Image / -Video / -News), Google-InspectionTool, GoogleOther | search | IP list + DNS (`.googlebot.com`, `.google.com`) | https://developers.google.com/static/search/apis/ipranges/googlebot.json · https://developers.google.com/search/docs/crawling-indexing/verifying-googlebot |
| AdsBot / Mediapartners / Storebot-Google | other | IP list + DNS | https://developers.google.com/static/search/apis/ipranges/special-crawlers.json |
| Google-Agent | AI fetch for a person | IP list | https://developers.google.com/static/search/apis/ipranges/user-triggered-agents.json (list dated 2026-03-03) |
| Bingbot | search | IP list + DNS (`.search.msn.com`) | https://www.bing.com/toolbox/bingbot.json |
| Applebot | search | IP list + DNS (`.applebot.apple.com`) | https://search.developer.apple.com/applebot.json · https://support.apple.com/en-us/119829 |
| GPTBot / OAI-SearchBot / ChatGPT-User | training / AI search / for a person | IP list each | https://openai.com/gptbot.json · https://openai.com/searchbot.json · https://openai.com/chatgpt-user.json · https://platform.openai.com/docs/bots |
| ClaudeBot / Claude-SearchBot / Claude-User | training / AI search / for a person | IP list (one for all three) | https://claude.com/crawling/bots.json, named in https://support.claude.com/en/articles/8896518 |
| PerplexityBot / Perplexity-User | AI search / for a person | IP list each | https://www.perplexity.com/perplexitybot.json · https://www.perplexity.com/perplexity-user.json · https://docs.perplexity.ai/guides/bots |
| Amazonbot | training | IP list (JSON inside the page) + DNS (`.crawl.amazonbot.amazon`) | https://developer.amazon.com/amazonbot/ip-addresses/ · https://developer.amazon.com/amazonbot |
| CCBot (Common Crawl) | training | IP list | https://index.commoncrawl.org/ccbot.json |
| Meta-ExternalAgent / Meta-ExternalFetcher | training / for a person | **claimed** — Meta publishes no list (https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/) | – |
| Bytespider | training | **claimed** — ByteDance publishes nothing | – |
| YandexBot | search | DNS | https://yandex.com/support/webmaster/robot-workings/check-yandex-robots.html |
| Cloudflare edge (not a crawler) | – | marks a logged proxy address | https://www.cloudflare.com/ips-v4 · https://www.cloudflare.com/ips-v6 |

**Google-Extended and Applebot-Extended are robots.txt tokens, not fetchers**: they switch AI use of pages on or off, while the
fetching is done by Google's / Apple's usual crawlers. No log line ever says Google-Extended, so it cannot be counted; the page says so.

**The lists.** A dated copy is in `server/src/services/crawlers/ranges.snapshot.json` (fetched 2026-10-17, regenerate with
`python3 app/scripts/refresh_bot_ranges.py`, run in a container: the Mac's Python has no corporate CA). The server refreshes every
list once a day into `bot_ip_ranges` (`BOT_RANGES_REFRESH=true`), keeps the previous list on any doubt (§1), and shows each list's
publication date and last error on the page. Bing's list is dated 2024-01-03 by Microsoft; DNS covers what it lacks.

## 4. Data model (migration `0009_crawler_logs`)

| Table | Row | Kept |
|---|---|---|
| `log_sources` | one per website: `retention_days` (7 / 30 / 90, default 30), push key hash + prefix + creator + date, `last_push_at` | with the website |
| `log_ingests` | one per upload / push: source, file name, status (queued → processing → done / failed), server `host` + `spool_path` while queued, bytes, SHA-256 (unique per site unless failed), format, `stats` (lines, malformed, other host, people, crawler requests, duplicates, verified / spoofed / claimed / unchecked, proxy addresses, first / last time, sample reasons), error | uploads 90 days, pushes 7 days |
| `crawler_hits` | one per crawler request: time, crawler key, verification, method, path, parameter names, kind (page / asset / robots / sitemap), status, bytes, ms, network (unproved only), line hash | `retention_days` |
| `crawler_daily` | per site × UTC day × crawler × verification: requests, 2xx / 3xx / 4xx / 5xx, refused (401 / 403 / 429), parameter URLs, assets, bytes, ms sum / count | 400 days |
| `crawler_page_daily` | per site × day × crawler × path, spoofed left out: requests, verified requests, 3xx / 4xx / 5xx, parameter URLs, last status | 400 days |
| `bot_ip_ranges` | one per vendor list: prefixes, the vendor's creation time, fetched / checked at, last error | – |

The rollups are **additive**: each batch adds the rows it actually inserted (after de-duplication), so an ingest never re-reads old
rows and retention of raw rows never changes a total. Every site row cascades on website delete.

## 5. Privacy and retention
Kept: crawler requests only — time, path, parameter names, status, size, answer time, which crawler, whether it was proved, and for an
unproved one its network. Not kept: any request from a person (counted, then dropped), any full IP address, query values, referrers,
cookies. The uploaded / pushed body waits in a spool file (`LOG_SPOOL_DIR`, mode 0600) only until its job ends — success or failure —
and orphans older than a day are removed by the retention job. Retention per website (7 / 30 / 90 days) for raw rows, 400 days for daily
totals. **Delete all log data** (admin, the domain typed to confirm) removes every row of the website at once. The worker, retention
(every 6 h) and the list refresh (daily) are switched off with `CRAWLER_JOBS=false`.

## 6. What the page and the API show (`services/crawlers/analytics.ts`)
Window 7 / 30 / 90 days (UTC). Per crawler: requests (not spoofed) with verified / claimed / unchecked, spoofed, distinct paths,
3xx / 4xx / 5xx, parameter URLs, assets, average answer time, last seen, how it is proved. Per day: requests by kind (search, AI
training, AI search, AI fetches for a person, SEO tools, other) and impostors as their own series. **Coverage** against the engine's
weekly page inventory (`seo_pages`, read by `site_id`): pages Googlebot fetched / did not (most clicked first, with the last fetch even
before the window), pages no AI crawler read, and 200-answering pages Googlebot fetched that the inventory lacks. **Crawl budget**:
Googlebot's share on redirects, 4xx, 5xx and parameter URLs, the worst URLs, and the parameter names it followed. **New pages**:
first Googlebot / AI fetch inside the window, shown only once the logs reach back at least three days before (otherwise "new" would
mean "first day of data"). **AI fetches for a person** (ChatGPT-User, Claude-User, Perplexity-User, Google-Agent, Meta-ExternalFetcher):
the pages people asked about. **Impostors** with their top networks. **AI crawlers refused** (401 / 403 / 429).
Recommendations (most urgent first) link to Technical health (audit: redirects, errors, internal links, sitemap) or AI visibility
(weekly crawler access, AI readiness) or the log setup. CSV exports: daily totals, per page and crawler, every stored request.

API: `app/API.md` → "Crawlers". Read API: `GET /api/v1/websites/:websiteId/crawlers?days=` and the MCP tool `get_crawler_activity`.

## 7. Settings (`app/.env`)
`CRAWLER_JOBS` (default true), `LOG_SPOOL_DIR` (default `<tmp>/alaventra-logs`; must be local disk of the server that receives the
upload — the worker claims only jobs of its own host), `BOT_RANGES_REFRESH` (default true; outbound HTTPS to the vendors above).
No secret is added: push keys are stored as hashes.

## 8. Deliberately not built
- **Pulling logs** (S3 / GCS buckets, Cloudflare Logpull, Akamai / Fastly pull APIs): every one needs the customer's cloud credentials
  in the app. Push and upload cover the same sources without holding them; a bucket reader is the natural next step if an owner asks.
- **Multi-server spool**: the spool is local; behind several app servers an upload must reach the server that owns its job (sticky
  routing) or the spool must move to shared storage. One server today.
- **Blocking**: the page tells the owner what to block; it does not change robots.txt or a firewall.
- **Subdomains**: only the site's host and `www.` are counted.
- **Percentiles** of answer time: averages only (the rollups hold sums), raw rows would allow p95 within retention.
- **Matching an AI fetch to the question asked**: logs do not carry the prompt.

## 9. Tests
`shared/src/crawlers.test.ts` (31: registry, user agents of every vendor incl. a Cubot phone that is not a bot, path rules),
`server/test/crawlerParse.test.ts` (21: every format from the fixtures in `server/test/fixtures/logs/`, forged forwarding, IPv6 and
IPv4-mapped addresses, gzip, malformed lines, DNS verification with a table-driven resolver), `server/test/crawlerDb.test.ts` (12,
against a throwaway Postgres: upload → worker → counts, duplicates, isolation / roles / CSRF / unverified, Logpush gzip + test file +
retry + revoke, Vercel array, broken gzip, CSV + injection, read API + MCP, retention, delete, IP-list refresh guard, restart recovery,
large-file lag), `web/test/crawlers.test.tsx` (4 renders: empty, full, viewer, guides).
Run the DB tests: `TEST_DATABASE_URL=… DATABASE_URL=… CRAWLER_JOBS=false npx vitest run test/crawlerDb.test.ts` (in `server/`).
