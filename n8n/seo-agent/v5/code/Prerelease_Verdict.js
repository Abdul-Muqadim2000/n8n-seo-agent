// ---- G27 (2026-10-13, system review FIX_PLAN.md): the pre-release verdict a CI job can read ----
// One answer for the whole release candidate: `verdict` pass / fail, `exit_code` 0 / 1 (so a job can be one line:
// `curl -s -H "X-API-Key: …" -d @release.json … | jq -e '.exit_code == 0'`), the failures with the URL and the check that failed, the
// counts, and — just as important — what could NOT be checked against a staging host, with the reason. Nothing is stored: `writes: none`.
// The checks are the daily key-page watch's own signals (G11, _page_watch.js): does the page answer, does it redirect, is it noindex,
// does robots.txt allow it, is there one canonical / title / H1 / description. On a staging host `noindex` and a robots.txt disallow are
// the deliberate guard almost every staging host carries, so they are warnings that name the live page instead of failures (pass
// `staging: false`, or point the check at `live_host`, to make them fail).
/*__PAGE_WATCH__*/
const plan = $('Prerelease Validate').all().map(i => i.json).filter(p => p && p.ok !== false && p.url);
const res = $input.all().map(i => i.json);
const S = (v) => String(v == null ? '' : v).trim();
const first = plan[0] || {};
const staging = first.staging !== false, liveHost = S(first.live_host);
const checked_at = S(first.checked_at) || new Date().toISOString();
const hostOf = PW.helpers.hostOf, bare = PW.helpers.bare, same = PW.helpers.same;
// the robots.txt of each host, read once (a missing file blocks nothing)
const robots = new Map();
plan.forEach((p, i) => { if (p.kind !== 'robots') return; robots.set(bare(p.host), PW.robotsRead(res[i] || {})); });
const pages = []; const failures = []; const warnings = []; const notChecked = [];
const CHECKS = {
  page_answers: 'the page answers 200',
  no_redirect: 'the page does not redirect',
  indexable: 'the page may be indexed (no noindex)',
  robots_allows: 'robots.txt allows this page',
  canonical: 'one canonical, pointing at the page it should',
  title: 'one title',
  h1: 'one H1',
  description: 'a meta description',
};
const note = (list, url, check, severity, detail) => list.push({ url, check, label: CHECKS[check] || check, severity, detail });
plan.forEach((p, i) => {
  if (p.kind !== 'page') return;
  const sig = PW.signals(res[i] || {});
  const url = S(p.url);
  const checks = [];
  const add = (check, state, detail, severity) => { checks.push({ check, label: CHECKS[check] || check, state, detail });
    if (state === 'fail') note(failures, url, check, severity || 'high', detail);
    else if (state === 'warn') note(warnings, url, check, severity || 'medium', detail);
    else if (state === 'not_checked') notChecked.push({ url, check, label: CHECKS[check] || check, reason: detail }); };
  if (sig.ok === false) {
    add('page_answers', 'not_checked', 'the page could not be fetched (' + (sig.error || 'no answer') + ')');
    pages.push({ url, status: 0, checked: false, error: sig.error || 'no answer', checks });
    return;
  }
  const st = Number(sig.status) || 0;
  if (st === 401 || st === 403) {
    // a staging host behind a password is not a failing page: it is a page this check could not read, and it says so
    add('page_answers', 'not_checked', 'the host asked for authentication (' + st + '): open the release candidate to this check, or run it after the login proxy');
    pages.push({ url, status: st, checked: false, error: 'authentication required (' + st + ')', checks });
    return;
  }
  if (st >= 200 && st < 300) add('page_answers', 'pass', 'answers ' + st);
  else if (st >= 300 && st < 400) { add('page_answers', 'fail', 'answers ' + st + ' and redirects to ' + (S(sig.location) || 'an address it does not name'), 'critical'); }
  else add('page_answers', 'fail', 'answers ' + st, 'critical');
  add('no_redirect', st >= 300 && st < 400 ? 'fail' : 'pass', st >= 300 && st < 400 ? 'redirects to ' + (S(sig.location) || 'an address it does not name') : 'no redirect', 'critical');
  if (st >= 200 && st < 300) {
    if (sig.noindex) add('indexable', staging ? 'warn' : 'fail', 'the page says noindex (' + S(sig.noindex_source) + ': "' + S(sig.robots_meta || 'noindex') + '")'
      + (staging ? ' — normal on a staging host, but the live page must not carry it' + (liveHost ? ' on ' + liveHost : '') : ''), staging ? 'medium' : 'critical');
    else add('indexable', 'pass', 'no noindex');
    const rb = robots.get(bare(p.host)) || null;
    const blocked = rb && rb.ok ? rb.blocks(url) : null;
    if (blocked === true) add('robots_allows', staging ? 'warn' : 'fail', 'robots.txt on ' + p.host + ' disallows this page'
      + (staging ? ' — normal on a staging host, but the live robots.txt must allow it' : ''), staging ? 'medium' : 'critical');
    else if (!rb || rb.ok === false) add('robots_allows', 'not_checked', 'robots.txt on ' + p.host + ' could not be read (' + S((rb || {}).error || 'no answer') + ')');
    else add('robots_allows', 'pass', 'robots.txt allows it');
    if (!S(sig.canonical)) add('canonical', 'fail', 'no rel=canonical');
    else if (sig.canonicals > 1) add('canonical', 'fail', sig.canonicals + ' canonical tags: Google picks one of them');
    else {
      const ch = bare(hostOf(sig.canonical));
      const trim = (x) => PW.helpers.pathOf(x).replace(/\/+$/, '') || '/';
      const samePath = trim(sig.canonical) === trim(url);   // on a staging host the canonical rightly names the LIVE host, so only the path can be compared
      if (liveHost && ch && ch !== liveHost && ch !== bare(p.host)) add('canonical', 'fail', 'the canonical points at ' + ch + ', neither the live host (' + liveHost + ') nor this one');
      else if (same(sig.canonical, url) || samePath) add('canonical', 'pass', 'canonical ' + S(sig.canonical));
      else add('canonical', 'warn', 'the canonical points at another page: ' + S(sig.canonical));
    }
    if (!S(sig.title)) add('title', 'fail', 'no <title>');
    else if (sig.titles > 1) add('title', 'warn', sig.titles + ' <title> tags');
    else add('title', 'pass', '"' + S(sig.title).slice(0, 80) + '"');
    if (!S(sig.h1)) add('h1', 'fail', 'no H1');
    else if (sig.h1s > 1) add('h1', 'warn', sig.h1s + ' H1s');
    else add('h1', 'pass', '"' + S(sig.h1).slice(0, 80) + '"');
    add('description', S(sig.description) ? 'pass' : 'warn', S(sig.description) ? S(sig.description).slice(0, 80) : 'no meta description', 'low');
  }
  pages.push({ url, status: st, checked: true, error: '', noindex: !!sig.noindex, canonical: S(sig.canonical), title: S(sig.title), h1: S(sig.h1), bytes: Number(sig.bytes) || 0, checks });
});
// ---- B5-7: `fail_on` and the `expected` list (see Prerelease_Validate.js). Without either the verdict is exactly what it was: any failure fails. ----
const SEV_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const failOn = S(first.fail_on) || 'any';
const threshold = failOn === 'any' ? 1 : (SEV_RANK[failOn] || 1);
const expectedList = Array.isArray(first.expected) ? first.expected : [];
const trimP = (x) => (PW.helpers.pathOf(x).replace(/\/+$/, '') || '/').toLowerCase();
const used = new Set(); const acceptedFailures = []; const belowThreshold = []; const failList = [];
for (const f of failures) {
  const pth = trimP(f.url);
  const ei = expectedList.findIndex(e => e.path === pth && (!e.check || e.check === f.check));
  if (ei >= 0) { used.add(ei); acceptedFailures.push({ ...f, expected_reason: S(expectedList[ei].reason) }); continue; }
  if ((SEV_RANK[f.severity] || 3) < threshold) { belowThreshold.push(f); continue; }
  failList.push(f);
}
// the page's own check list shows what was accepted, so nobody has to cross-read two arrays
for (const f of [...acceptedFailures, ...belowThreshold]) { const pg = pages.find(p => p.url === f.url); const ck = pg && pg.checks.find(c => c.check === f.check); if (ck) ck.accepted = acceptedFailures.includes(f) ? 'expected_change' : 'below_fail_on'; }
const expectedUnused = expectedList.filter((e, i) => !used.has(i)).map(e => ({ path: e.path, check: e.check, reason: e.reason, note: 'matched no failure: the change did not happen on this page, or the entry is stale' }));
// what a release candidate cannot be asked, whatever we do — said once, with the reason (never reported as "fine")
// R75 (2026-10-16): the wording follows the run. On a staging run the reasons are about a staging host; on a production check (`staging: false`)
// nothing here is about staging — the reasons say why THIS check does not ask, which is by design: it reads only the pages it is given.
const cannot = staging ? [
  { check: 'index_coverage', reason: 'Search Console can only answer for URLs Google has seen; a staging URL has never been crawled, so indexing, the canonical Google picked and the rich results are checked by the daily watch and the audit after the release' },
  { check: 'real_user_speed', reason: 'the Chrome UX Report has no real visitors for a staging host, so Core Web Vitals are measured after the release' },
  { check: 'positions', reason: 'a position exists only for a live URL' },
] : [
  { check: 'index_coverage', reason: 'this check reads only the pages it is given (by design, it asks Google nothing): indexing, the canonical Google picked and the rich results are checked by the daily page watch and the monthly audit' },
  { check: 'real_user_speed', reason: 'this check reads only the pages it is given (by design): Core Web Vitals from real visitors (the Chrome UX Report) are in the audit and the site check' },
  { check: 'positions', reason: 'this check reads only the pages it is given (by design): rankings are tracked by the weekly rank tracker, not by a release check' },
];
const counts = { pages: pages.length, pages_read: pages.filter(p => p.checked).length, checks: pages.reduce((n, p) => n + p.checks.length, 0),
  passed: pages.reduce((n, p) => n + p.checks.filter(c => c.state === 'pass').length, 0), failed: failList.length, expected_changes: acceptedFailures.length, below_threshold: belowThreshold.length, warned: warnings.length,
  not_checked: notChecked.length + cannot.length };
const fail = failList.length > 0;
// a run that could read nothing is NOT a pass: CI would take exit code 0 as "the release is fine" when in truth nothing was checked
const blind = !fail && counts.pages > 0 && counts.pages_read === 0;
const verdict = fail ? 'fail' : blind ? 'not_checked' : 'pass';
const extraNote = (acceptedFailures.length ? ', ' + acceptedFailures.length + ' expected change(s) accepted' : '') + (belowThreshold.length ? ', ' + belowThreshold.length + ' below fail_on=' + failOn : '');
const summary = fail
  ? counts.failed + ' check(s) failed on ' + [...new Set(failList.map(f => f.url))].length + ' of ' + counts.pages + ' page(s): ' + failList.slice(0, 3).map(f => f.label + ' (' + f.url + ')').join('; ') + extraNote
  : blind
    ? 'none of the ' + counts.pages + ' page(s) could be read, so nothing was checked: ' + (notChecked.map(n => n.reason)[0] || 'no answer')
    : counts.pages_read + ' of ' + counts.pages + ' page(s) read, ' + counts.passed + ' check(s) passed'
      + (counts.warned ? ', ' + counts.warned + ' warning(s)' : '') + extraNote + (counts.not_checked ? ', ' + counts.not_checked + ' not checked' : '');
return [{ json: { status: 200, body: {
  ok: !fail && !blind, verdict, exit_code: fail ? 1 : blind ? 2 : 0, summary, checked_at, request_id: S(first.request_id),
  staging, live_host: liveHost, writes: 'none', fail_on: failOn, counts, failures: failList, expected_changes: acceptedFailures, below_threshold: belowThreshold, expected_unused: expectedUnused, warnings,
  not_checked: [...notChecked, ...cannot.map(c => ({ url: '', check: c.check, label: c.check, reason: c.reason }))],
  pages, checks_run: Object.keys(CHECKS),
} } }];
