// ---- G27 (2026-10-13, system review FIX_PLAN.md; criterion TECH 1.8 = 0): the pre-release check ----
// The key-page checks the daily watch runs (G11, v5/code/_page_watch.js) against a STAGING host or a list of URLs, before a release goes
// live, with a verdict a CI job can read. It is a READ: it stores nothing, starts no run and touches no Data Table — a release candidate
// must never create ladder rows, content-log rows or audits for a site.
// Body: { mode?: 'prerelease', base_url?, paths?: [...], urls?: [...], live_host?, staging?, max_urls? }. `base_url` + `paths` is the
// normal shape ({ base_url: 'https://staging.example.com', paths: ['/', '/pricing'] }); `urls` takes absolute addresses instead.
// `live_host` is the address the pages will have in production: with it the canonical can be judged, and `noindex` / a robots.txt
// disallow on the staging host are read as the deliberate staging guard they usually are (a warning that names the live page), not as a
// failure. Pass `staging: false` (or point the check at the live host) to have them fail.
// B5-7 (2026-10-16, benchmark area 5; Lumar Protect blocks a build on a threshold, Sitebulb's Release Check keeps a list of planned changes):
//   `fail_on`   — 'any' (default: every failure fails the build), 'low' | 'medium' | 'high' | 'critical': only failures of that severity or
//                 above fail; the others are returned as `below_threshold` and never hidden.
//   `expected`  — the changes this release makes ON PURPOSE, so an intentional release does not fail its own check: strings "/path" (every
//                 failure on that page) or "/path:check" (one check: page_answers, no_redirect, indexable, robots_allows, canonical, title, h1,
//                 description), or objects { path | url, check?, reason? }. Matching failures come back as `expected_changes` with the reason;
//                 an entry that matched nothing is returned as `expected_unused` (the change did not happen, or the list is stale).
// The recipe for a CI job is in docs/PRERELEASE_CI.md.
/*__PAGE_WATCH__*/
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : {};
const S = (v) => String(v == null ? '' : v).trim();
const MAX = 25;
const errors = [];
const mode = S(b.mode).toLowerCase();
if (mode && mode !== 'prerelease' && mode !== 'pre-release') errors.push('mode must be "prerelease" on this endpoint (the other modes go to /webhook/seo-keyword-check)');
const absolute = (u) => /^https?:\/\/[^\s\/]+/i.test(S(u));
const hostOf = PW.helpers.hostOf, bare = PW.helpers.bare;
// a caller gives us the addresses to fetch, so internal targets are refused outright (no requests into the machine or the network)
const internal = (h) => !h || h.indexOf('.') < 0 || /^(localhost|\[?::1\]?|.*\.local|.*\.internal|.*\.localhost)$/i.test(h)
  || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h);
const base = S(b.base_url);
if (base && !absolute(base)) errors.push('base_url must be a full http(s) address, e.g. https://staging.example.com');
const paths = (Array.isArray(b.paths) ? b.paths : S(b.paths) ? S(b.paths).split(/[\s,]+/) : []).map(S).filter(Boolean);
const given = (Array.isArray(b.urls) ? b.urls : S(b.urls) ? S(b.urls).split(/[\s,]+/) : []).map(S).filter(Boolean);
const cap = Math.max(1, Math.min(MAX, Number(b.max_urls) || MAX));
const baseRoot = base ? base.replace(/\/+$/, '') : '';
const list = [];
for (const u of given) { if (!absolute(u)) { errors.push('urls: "' + u.slice(0, 80) + '" is not a full http(s) address'); continue; } list.push(u); }
for (const p of (paths.length ? paths : (base && !given.length ? ['/'] : []))) {
  if (!baseRoot) { errors.push('paths need base_url (the staging host the paths belong to)'); break; }
  list.push(baseRoot + (p.charAt(0) === '/' ? p : '/' + p));
}
const seen = new Set(); const urls = [];
for (const u of list) { const k = PW.helpers.ukey(u); if (seen.has(k)) continue; seen.add(k); urls.push(u); }
if (!urls.length && !errors.length) errors.push('give base_url (with optional paths) or urls: the pages of the release candidate to check');
if (urls.length > cap) errors.push('this check takes at most ' + cap + ' URLs in one call (' + urls.length + ' given); split the release into several calls');
for (const u of urls) if (internal(hostOf(u))) errors.push('urls: ' + hostOf(u) + ' is not a public host — the check only fetches public addresses');
const liveHost = bare(S(b.live_host));
const hosts = [...new Set(urls.map(u => hostOf(u)).filter(Boolean))];
// staging unless the caller says otherwise, or unless every URL is already on the live host
const staging = b.staging === false ? false : (b.staging === true ? true : !(liveHost && hosts.every(h => bare(h) === liveHost)));
const CHECK_IDS = ['page_answers', 'no_redirect', 'indexable', 'robots_allows', 'canonical', 'title', 'h1', 'description'];
const failOn = S(b.fail_on).toLowerCase() || 'any';
if (!['any', 'low', 'medium', 'high', 'critical'].includes(failOn)) errors.push('fail_on must be one of any, low, medium, high, critical (given "' + failOn.slice(0, 20) + '")');
const trimPath = (x) => { const p = S(x).replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').toLowerCase(); return (p.replace(/\/+$/, '') || '/'); };
const expRaw = Array.isArray(b.expected) ? b.expected : (S(b.expected) ? S(b.expected).split(/[\s,]+/) : []);
if (expRaw.length > 100) errors.push('expected takes at most 100 entries (' + expRaw.length + ' given)');
const expected = [];
for (const e of expRaw.slice(0, 100)) {
  let path = '', check = '', reason = '';
  if (e && typeof e === 'object') { path = S(e.path || e.url); check = S(e.check).toLowerCase(); reason = S(e.reason).slice(0, 200); }
  else { const m = S(e).match(/^(.*?)(?::([a-z0-9_]+))?$/i); path = m ? S(m[1]) : S(e); check = m && m[2] ? S(m[2]).toLowerCase() : ''; if (/^https?$/i.test(path) && m && m[2]) { path = S(e); check = ''; } }
  if (!path) { errors.push('expected: an entry has no path'); continue; }
  if (check && !CHECK_IDS.includes(check)) { errors.push('expected: "' + check + '" is not a check (' + CHECK_IDS.join(', ') + ')'); continue; }
  expected.push({ path: trimPath(path), check, reason });
}
if (errors.length) return [{ json: { ok: false, status: 400, verdict: 'error', exit_code: 2, error: errors.join('; '), errors, writes: 'none' } }];
const checked_at = new Date().toISOString();
const items = urls.map((url, i) => ({ json: { ok: true, kind: 'page', url, idx: i, host: hostOf(url), live_host: liveHost, staging, checked_at, pages: urls.length, request_id: $execution.id, fail_on: failOn, expected } }));
// one robots.txt per host, so "is this page allowed to be crawled" can be answered from the same fetches
hosts.forEach((h, j) => items.push({ json: { ok: true, kind: 'robots', url: 'https://' + h + '/robots.txt', idx: urls.length + j, host: h, live_host: liveHost, staging, checked_at, pages: urls.length, request_id: $execution.id, fail_on: failOn, expected } }));
return items;
