// CR17D1-CR17D8 (client report 2026-11-17, devaicon.com; package CR17-D, build section 194). Synthetic data on a made-up site, shaped
// like the production evidence (INV_3 F5, INV_7 F10):
//   - robots.txt answered 404 with the site's 20 KB HTML 404 page for two days; the old watch hashed that page as "2,085 characters of rules"
//     and raised a High alert, again the next day (a new deploy id), and a High "changed" when the file came back;
//   - four 301s the client made on our own advice (Steps on your website: redirect the old address to the improved page) were High alerts;
//   - a canonical that started naming the page itself (a fix) was High; nothing ever resolved an alert;
//   - our ladder / content log / AI question / AI readiness rows kept the old 301 address, and the Rank Tracker would have called the moved
//     page "a different page of yours";
//   - the client typed /services/ai-automation-services-Pakistan (404) while the live page is lower case.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const pw = async (j) => (await run('_pw194', [{ json: j }]))[0].json;
  const mv = async (j) => (await run('_moves', [{ json: j }]))[0].json.r;
  const hashOf = async (t) => (await run('_page_watch', [{ json: { hash_text: t } }]))[0].json.hash;
  const D = 'example-agency.com', SITE = 'site_example-agency-com', W = 'https://' + D;
  const ROBOTS_TXT = 'User-agent: *\nDisallow: /api/\nDisallow: /dashboard\nDisallow: /login\nDisallow: /legacy\nDisallow: /insights/preview/\n\nSitemap: ' + W + '/sitemap.xml\n';
  // a Next.js-like 404 page whose lines, cut at '#' with the blanks dropped (the OLD robots.txt reading), make exactly 2,085 characters
  const html404 = (deploy) => { const head = '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>404: This page could not be found</title><script id="__NEXT_DATA__">{"buildId":"' + deploy + '"}</script></head>';
    const row = '<div class="nf-row">Page not found. Go back to the home page or use the menu.</div>', tail = '<body><h1>404</h1></body></html>';
    const lines = [head]; const total = () => lines.concat([tail]).join('\n').length;
    while (total() + row.length + 1 <= 2085) lines.push(row);
    lines[lines.length - 1] += 'x'.repeat(2085 - total()); lines.push(tail);
    return lines.join('\n'); };
  const oldCleanLen = (text) => String(text).replace(/\r/g, '').split('\n').map(l => l.replace(/#.*$/, '').trim()).filter(Boolean).join('\n').length;

  // ======================================================================================================================
  await guard('CR17D1 robots.txt is a state machine', async () => {
    reset(); const SN = 'CR17D1 (F5) robots.txt is a state: a 404 web page is "missing" (Medium, never "characters of rules"), the same state again says nothing, the file coming back is Info, a server error is High then Critical, a comment changes nothing'; begin(SN); const check = mkCheck(SN);
    const nf1 = html404('a1b2c3'), nf2 = html404('z9y8x7');
    check('the fixture is the production shape: the old reading turned this 404 page into 2,085 characters of "rules"', oldCleanLen(nf1) === 2085 && oldCleanLen(nf2) === 2085, oldCleanLen(nf1));
    const ok = (await pw({ robots_res: { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: ROBOTS_TXT }, block_urls: [W + '/api/x', W + '/'] })).robots;
    check('a plain robots.txt is `ok`, its rules parsed per crawler with the sitemap line, and it blocks what it says', ok.state === 'ok' && ok.hash.length === 8 && ok.facts.includes('Disallow: /api/ for every crawler') && ok.facts.some(f => /^Sitemap: /.test(f)) && J(ok.blocked) === J([true, false]), J(ok));
    const PREV = { v: 2, hash: ok.hash, state: 'ok', text: ok.text, facts: ok.facts, last_good_hash: ok.hash, last_good_at: '2026-10-26T05:45:00.000Z' };
    const m1 = await pw({ robots_res: { statusCode: 404, headers: { 'content-type': 'text/html; charset=utf-8' }, data: nf1 }, prev: PREV, block_urls: [W + '/api/x'] });
    check('a 404 that serves the HTML error page is `missing`: no fingerprint, nothing blocked (Google crawls everything)', m1.robots.state === 'missing' && m1.robots.hash === '' && m1.robots.blocked[0] === null, J(m1.robots));
    check('and it is ONE Medium alert that says what Google does and which rules stopped applying, never "characters of rules"',
      m1.robots_change && m1.robots_change.code === 'robots_missing' && m1.robots_change.severity === 'medium' && /Google then crawls everything/.test(m1.robots_change.text)
      && /Disallow \/api\//.test(m1.robots_change.text) && !/characters of rules/.test(m1.robots_change.text), J(m1.robots_change));
    const m2 = await pw({ robots_res: { statusCode: 404, headers: { 'content-type': 'text/html' }, data: nf2 }, prev: { ...PREV, hash: ok.hash, state: 'missing' } });
    check('the next day, the same 404 with a new deploy id in the page raises nothing (the state did not change)', m2.robots_change === null, J(m2.robots_change));
    const back = await pw({ robots_res: { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: ROBOTS_TXT }, prev: { ...PREV, state: 'missing' } });
    check('the file coming back with the same rules is Info "robots.txt is back with the same rules as on <date>"', back.robots_change && back.robots_change.code === 'robots_back' && back.robots_change.severity === 'info' && /same rules as on 2026-10-26/.test(back.robots_change.text), J(back.robots_change));
    const u1 = await pw({ robots_res: { statusCode: 503, data: 'Service Unavailable' }, prev: PREV });
    check('a 503 is `unreachable`: High, and the text says Google pauses crawling, then uses its last copy', u1.robots.state === 'unreachable' && u1.robots_change.severity === 'high' && /stops crawling your site for up to 12 hours/.test(u1.robots_change.text), J(u1.robots_change));
    const u2 = await pw({ robots_res: { statusCode: 503, data: '' }, prev: { ...PREV, state: 'unreachable', bad_runs: 1 } });
    const u3 = await pw({ robots_res: { statusCode: 503, data: '' }, prev: { ...PREV, state: 'unreachable', bad_runs: 2 } });
    check('a second unreachable check in a row becomes Critical once, and a third says nothing new', u2.robots_change && u2.robots_change.severity === 'critical' && u3.robots_change === null, J([u2.robots_change, u3.robots_change]));
    const t429 = await pw({ robots_res: { statusCode: 429, data: '' }, prev: PREV });
    check('429 (too many requests) is `unreachable` like a 5xx, not `missing`', t429.robots.state === 'unreachable', J(t429.robots));
    const cm = await pw({ robots_res: { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: '# new comment\n' + ROBOTS_TXT.replace('Disallow: /login', 'Disallow:   /login   # keep') }, prev: PREV });
    check('a comment or spacing change is no change at all (the PARSED rules are compared, never the bytes)', cm.robots_change === null && cm.robots.hash === ok.hash, J(cm.robots_change));
    const add = await pw({ robots_res: { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: ROBOTS_TXT.replace('Disallow: /legacy', 'Disallow: /legacy\nDisallow: /tmp/') }, prev: PREV });
    check('a real rule change is Medium with the diff in words ("Added: Disallow: /tmp/ for every crawler")', add.robots_change && add.robots_change.code === 'robots_changed' && add.robots_change.severity === 'medium' && /Added: Disallow: \/tmp\/ for every crawler/.test(add.robots_change.text), J(add.robots_change));
    const kp = await pw({ robots_res: { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: ROBOTS_TXT + 'Disallow: /services/\n' }, prev: PREV, newly_blocked: [W + '/services/x'] });
    const root = await pw({ robots_res: { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: 'User-agent: *\nDisallow: /\n' }, prev: PREV });
    check('a rule that now blocks a key page, or Disallow: / for every crawler, is High', kp.robots_change.severity === 'high' && /stops Google crawling 1 of your key pages: \/services\/x/.test(kp.robots_change.text) && root.robots_change.severity === 'high' && /whole site/.test(root.robots_change.text), J([kp.robots_change, root.robots_change]));
    const asHtml = await pw({ robots_res: { statusCode: 200, headers: { 'content-type': 'text/html' }, data: '<!DOCTYPE html><html><body>Welcome</body></html>' }, prev: PREV });
    check('a web page served as robots.txt (200, HTML) is `html`: Medium, "serve the plain text file"', asHtml.robots.state === 'html' && asHtml.robots_change.code === 'robots_html' && asHtml.robots_change.severity === 'medium', J(asHtml.robots_change));
    const chain = await pw({ robots_res: { error: { message: 'Maximum number of redirects exceeded' } }, prev: PREV });
    const fail = await pw({ robots_res: { error: { message: 'ETIMEDOUT' } }, prev: PREV });
    check('more than five redirects is `missing` (Google treats it as a 404); a timeout is "not read" and claims nothing', chain.robots.state === 'missing' && chain.robots_change.code === 'robots_missing' && fail.robots.ok === false && fail.robots_change === null, J([chain.robots_change, fail.robots]));
    const legacy = await pw({ robots_res: { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: ROBOTS_TXT }, prev: { hash: 'deadbeef', status: 200 } });
    check('a fingerprint stored by the old watch (no version) is a baseline: no "changed" alert on the first run after the deploy', legacy.robots_change === null, J(legacy.robots_change));
  });

  // ======================================================================================================================
  await guard('CR17D2 redirects are judged by where they land', async () => {
    reset(); const SN = 'CR17D2 (F5) a redirect is judged by where it lands: a 301 we asked for is Info "as Steps on your website asked", a 302 Medium, a deep page sent home or to a dead page High / Critical'; begin(SN); const check = mkCheck(SN);
    const OLD = W + '/engagement-models', NEW = W + '/services/engagement-models';
    const self = { ok: true, status: 200, canonical: NEW, noindex: false };
    const v = async (o) => (await pw({ redirect: o })).verdict;
    const a = await v({ url: OLD, status: 301, location: '/services/engagement-models', hop: self, expected: true });
    check('301 to a working, self-canonical page of the site that Steps on your website asked for: Info `page_moved`, "This is the redirect your Steps on your website asked for", and the watch moves on',
      a.verdict === 'moved' && a.code === 'page_moved' && a.severity === 'info' && /Steps on your website asked for/.test(a.text) && /watch the new address/.test(a.text) && a.to === NEW, J(a));
    const a2 = await v({ url: OLD, status: 308, location: NEW, hop: self });
    check('the same without the step is still Info, without the "asked" line (308 counts as permanent)', a2.severity === 'info' && !/asked for/.test(a2.text), J(a2));
    const b = await v({ url: OLD, status: 302, location: NEW, hop: self });
    check('302 / 307 to a working page is Medium: Google keeps the old address while a redirect is temporary', b.code === 'page_redirects' && b.severity === 'medium' && /temporarily/.test(b.text) && /permanent \(301\)/.test(b.text), J(b));
    const c = await v({ url: OLD, status: 301, location: '/', hop: { ok: true, status: 200 } });
    check('a deep page sent to the home page is High (Google treats it like a page that is gone)', c.verdict === 'home' && c.severity === 'high', J(c));
    const d = await v({ url: OLD, status: 301, location: NEW, hop: { ok: true, status: 404 } });
    check('a redirect to a page that is gone is Critical', d.verdict === 'gone' && d.severity === 'critical' && /404/.test(d.text), J(d));
    const e = await v({ url: OLD, status: 301, location: 'https://other-site.example/x', hop: null });
    check('a redirect to another website is High, judged on the address alone', e.verdict === 'offsite' && e.severity === 'high', J(e));
    const f = await v({ url: OLD, status: 301, location: NEW, hop: { ok: true, status: 200, canonical: W + '/services/other' } });
    const g = await v({ url: OLD, status: 301, location: NEW, hop: { ok: true, status: 200, canonical: NEW, noindex: true } });
    check('a move onto a page that names another main version is Medium; onto a noindex page High', f.severity === 'medium' && /main version/.test(f.text) && g.severity === 'high' && g.verdict === 'noindex', J([f, g]));
    const h = await v({ url: OLD, status: 301, location: NEW, hop: null });
    const lp = await v({ url: OLD, status: 301, location: NEW, hop: { ok: false, error: 'Maximum number of redirects exceeded' } });
    check('a target nobody could read today is Medium and said as such; a loop is High', h.verdict === 'unread' && h.severity === 'medium' && /could not be read today/.test(h.text) && lp.verdict === 'loop' && lp.severity === 'high', J([h, lp]));
    const ho = await v({ url: 'https://' + D + '/pricing', status: 308, location: 'https://www.' + D + '/pricing', hop: { ok: true, status: 200, canonical: 'https://www.' + D + '/pricing' } });
    check('a move of the host only (bare -> www) is Info "the same page on your main address"', ho.severity === 'info' && /same page on your main address/.test(ho.text), J(ho));
    // the compare of a page: the canonical that now names the page itself is a FIX; a changed title is Low, or Info when we just published it
    const P = W + '/industries/bfsi';
    const ch1 = (await pw({ compare: { prev: { checked_at: 'x', status: 200, canonical: W + '/industries', title: 'BFSI' }, now: { ok: true, status: 200, canonical: P, title: 'BFSI' }, opts: { url: P } } })).changes;
    const ch2 = (await pw({ compare: { prev: { checked_at: 'x', status: 200, canonical: P, title: 'BFSI' }, now: { ok: true, status: 200, canonical: W + '/industries', title: 'BFSI' }, opts: { url: P } } })).changes;
    const ch3 = (await pw({ compare: { prev: { checked_at: 'x', status: 200, canonical: P, title: 'Old' }, now: { ok: true, status: 200, canonical: P, title: 'New' }, opts: { url: P } } })).changes;
    const ch4 = (await pw({ compare: { prev: { checked_at: 'x', status: 200, canonical: P, title: 'Old' }, now: { ok: true, status: 200, canonical: P, title: 'New' }, opts: { url: P, own_title: true } } })).changes;
    check('a canonical that now points at the page itself is Info `canonical_fixed` ("That is right"); one that moved away from it stays High',
      ch1.length === 1 && ch1[0].code === 'canonical_fixed' && ch1[0].severity === 'info' && /That is right/.test(ch1[0].text) && ch2[0].code === 'canonical_moved' && ch2[0].severity === 'high', J([ch1, ch2]));
    check('a changed title is Low; the title of a page we just published is Info "your new title is live"', ch3[0].severity === 'low' && ch4[0].severity === 'info' && /new title is live/.test(ch4[0].text), J([ch3, ch4]));
  });

  // ======================================================================================================================
  await guard('CR17D3 one open alert per condition, resolved when it is gone', async () => {
    reset(); const SN = 'CR17D3 (F5) the alert lifecycle: one open alert per condition (same row, last_seen_at and count), resolved with the reason when the watch sees it gone, "Mark as seen" kept, good news recorded resolved'; begin(SN); const check = mkCheck(SN);
    const P = W + '/pricing', T0 = '2026-11-10T05:45:00.000Z', T1 = '2026-11-11T05:45:00.000Z', T2 = '2026-11-12T05:45:00.000Z';
    const gone = { code: 'page_gone', severity: 'critical', label: 'page gone', text: 'The page is gone: it answers 404 (it answered 200 before)', url: P, kind: 'nav' };
    const l0 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T0, changes: [gone], pages: [{ url: P, ok: true, status: 404 }], open: [] } })).lifecycle;
    const row0 = l0.rows[0];
    const COLS = ['site_id', 'domain', 'kind', 'severity', 'subject', 'summary', 'received_at', 'message_id', 'status', 'source', 'condition_key', 'last_seen_at', 'count', 'resolved_at', 'resolution', 'ack_by', 'ack_at'];
    check('day 1: one open Critical alert with its condition key, count 1, and exactly the seo_console_alerts columns', l0.rows.length === 1 && row0.status === 'new' && row0.count === 1 && /^watch:site_example-agency-com:status:[0-9a-f]{8}$/.test(row0.condition_key) && J(Object.keys(row0).sort()) === J([...COLS].sort()), J(row0));
    const seen = { ...row0, ack_by: 'owner@example.com', ack_at: '2026-11-10T09:00:00.000Z' };
    const l1 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T1, changes: [], pages: [{ url: P, ok: true, status: 404 }], open: [seen] } })).lifecycle;
    // CR17-FX-INDEX (review R1 L6): an updated row carries no ack_by / ack_at at all, so the partial upsert never overwrites a mark the app saved
    check('day 2, still 404: the SAME row (same message id) with last_seen_at and count 2, and the "Mark as seen" never written by the engine (kept as stored)', l1.rows.length === 1 && l1.rows[0].message_id === row0.message_id && l1.rows[0].count === 2 && l1.rows[0].last_seen_at === T1 && !('ack_by' in l1.rows[0]) && !('ack_at' in l1.rows[0]) && l1.rows[0].status === 'new', J(l1.rows));
    const back = { code: 'page_back', severity: 'info', label: 'page answers again', text: 'The page answers 200 again (it answered 404 before)', url: P, kind: 'nav' };
    const l2 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T2, changes: [back], pages: [{ url: P, ok: true, status: 200 }], open: [l1.rows[0]] } })).lifecycle;
    check('day 3, the page answers again: that row is resolved (resolved_at, resolution) and no extra notice row is written', l2.rows.length === 1 && l2.rows[0].message_id === row0.message_id && l2.rows[0].status === 'resolved' && l2.rows[0].resolved_at === T2 && /answers 200 again/.test(l2.rows[0].resolution), J(l2.rows));
    const l3 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T2, changes: [], pages: [{ url: P, ok: true, status: 200 }], open: [l1.rows[0]] } })).lifecycle;
    check('even without a change event, an open condition that is gone when the page is read is resolved', l3.rows.length === 1 && l3.rows[0].status === 'resolved', J(l3.rows));
    const l4 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T2, changes: [], pages: [], open: [l1.rows[0]] } })).lifecycle;
    check('a page not read today keeps its alert as it was (nothing is claimed)', l4.rows.length === 0, J(l4.rows));
    const moved = { code: 'page_moved', severity: 'info', label: 'page moved', text: 'The page moved permanently to /services/x, which works.', url: W + '/x', kind: 'nav' };
    const l5 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T2, changes: [moved], pages: [], open: [] } })).lifecycle;
    check('good news with nothing open (a move to a working page) is recorded RESOLVED: in the history, never in the open list', l5.rows.length === 1 && l5.rows[0].status === 'resolved' && l5.rows[0].severity === 'info' && l5.rows[0].resolution === 'Nothing to do.', J(l5.rows));
    // the rows written before section 194 have no condition key: it is read back from the message id
    const h = await hashOf('example-agency.com/engagement-models');
    const legacy = { site_id: SITE, domain: D, kind: 'page_watch', severity: 'high', subject: 'Page now redirects: example-agency.com/engagement-models', summary: 'x', received_at: '2026-11-07T05:45:00.000Z',
      message_id: 'watch:' + SITE + ':page_redirects:' + h + ':2026-11-07', status: 'new', source: 'page_watch' };
    const cond = (await pw({ condition_of: legacy })).condition;
    check('a row written before section 194 gets its condition from its message id (family redirect, the page hash)', cond && cond.family === 'redirect' && cond.page_hash === h && cond.legacy === true, J(cond));
    const l6 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T2, changes: [], open: [legacy],
      pages: [{ url: W + '/engagement-models', ok: true, status: 301, verdict: 'moved', moved_to: W + '/services/engagement-models' }] } })).lifecycle;
    check('so the High "now redirects" alert of a 301 that lands on a working page resolves: "now moves permanently to /services/engagement-models, which works"',
      l6.rows.length === 1 && l6.rows[0].status === 'resolved' && l6.rows[0].message_id === legacy.message_id && /now moves permanently to \/services\/engagement-models, which works/.test(l6.rows[0].resolution), J(l6.rows));
    const rs = { code: 'robots_missing', severity: 'medium', label: 'robots.txt missing', text: 'robots.txt is missing (it answers 404).', url: W + '/robots.txt', kind: 'robots' };
    const r0 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T0, changes: [rs], robots: { ok: true, state: 'missing' }, open: [] } })).lifecycle.rows[0];
    const r1 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T1, changes: [], robots: { ok: true, state: 'ok' }, open: [r0] } })).lifecycle.rows[0];
    check('robots.txt missing is one open Medium alert, resolved when the file answers again', r0.status === 'new' && r0.severity === 'medium' && r1.status === 'resolved' && /answers again/.test(r1.resolution), J([r0, r1]));
  });

  // ======================================================================================================================
  await guard('CR17D4 moves: confirm and plan', async () => {
    reset(); const SN = 'CR17D4 (F10) a move is a 301 / 308 seen on two reads to a working page of the same site, never the home page; the rows follow it, never onto a page that belongs to another search'; begin(SN); const check = mkCheck(SN);
    const OLD = W + '/ai-automation-services-pakistan', NEW = W + '/services/ai-automation-services-pakistan';
    const prev = { url: OLD, status: 301, location: '/services/ai-automation-services-pakistan' };
    const c1 = await mv({ fn: 'confirm', args: [{ url: OLD, status: 301, location: '/services/ai-automation-services-pakistan' }, prev, 'moved'] });
    const c2 = await mv({ fn: 'confirm', args: [{ url: OLD, status: 301, location: '/services/ai-automation-services-pakistan' }, { url: OLD, status: 200 }, 'moved'] });
    const c3 = await mv({ fn: 'confirm', args: [{ url: OLD, status: 301, location: '/' }, { url: OLD, status: 301, location: '/' }, 'moved'] });
    const c4 = await mv({ fn: 'confirm', args: [{ url: OLD, status: 302, location: NEW }, { url: OLD, status: 302, location: NEW }, 'moved'] });
    const c5 = await mv({ fn: 'confirm', args: [{ url: OLD, status: 301, location: 'https://other.example/x' }, { url: OLD, status: 301, location: 'https://other.example/x' }, 'moved'] });
    const c6 = await mv({ fn: 'confirm', args: [{ url: OLD, status: 301, location: NEW }, prev, 'gone'] });
    check('two reads of the same 301 to a working page: confirmed, the address as the server serves it', c1.ok === true && c1.to === NEW && c1.host_only === false, J(c1));
    check('refused: seen once, sent to the home page, temporary, another website, or a target that does not work', !c2.ok && /second read/.test(c2.reason) && !c3.ok && /home page/.test(c3.reason) && !c4.ok && !c5.ok && !c6.ok, J([c2, c3, c4, c5, c6]));
    const ladders = [{ ladder_id: 'lad_a', domain: D, keyword: 'ai automation services pakistan', target_url: OLD, status: 'published', page_exists: true },
      { ladder_id: 'lad_b', domain: D, keyword: 'engagement models', target_url: W + '/engagement-models', status: 'published', page_exists: true },
      { ladder_id: 'lad_c', domain: D, keyword: 'planned rung', target_url: OLD, status: 'planned', page_exists: false }];
    const logs = [{ site_id: SITE, domain: D, keyword: 'ai automation services pakistan', published_url: OLD, status: 'published' },
      { site_id: SITE, domain: D, keyword: 'dedicated development teams', published_url: W + '/services/engagement-models', status: 'published' }];
    const targets = [{ target_id: 'ait_1', site_id: SITE, domain: D, page_url: OLD }];
    const aiPages = [{ site_id: SITE, domain: D, url: OLD }, { site_id: SITE, domain: D, url: NEW }, { site_id: SITE, domain: D, url: W + '/engagement-models' }];
    const p = await mv({ fn: 'plan', args: [[{ from: OLD, to: NEW }, { from: W + '/engagement-models', to: W + '/services/engagement-models' }], { ladders, logs, targets, aiPages }, { domain: D, site_id: SITE }] });
    check('the published ladder rung, the content log, the AI question follow the move (old address kept as `from` for the update match); a planned rung does not',
      p.ladders.length === 1 && p.ladders[0].ladder_id === 'lad_a' && p.ladders[0].target_url === NEW && p.ladders[0].from === OLD
      && p.logs.some(l => l.keyword === 'ai automation services pakistan' && l.published_url === NEW) && p.targets.length === 1 && p.targets[0].page_url === NEW, J(p));
    check('the AI readiness row of the old address is dropped where the new one has its own, renamed where it has none', p.ai_pages_delete.length === 1 && p.ai_pages_delete[0].url === OLD && p.ai_pages_update.length === 1 && p.ai_pages_update[0].url === W + '/services/engagement-models', J([p.ai_pages_delete, p.ai_pages_update]));
    check('one search, one page: the ladder "engagement models" is refused because its new address is already the page of "dedicated development teams"',
      !p.ladders.some(l => l.ladder_id === 'lad_b') && p.refused.some(r => r.table === 'seo_ladders' && /dedicated development teams/.test(r.reason)), J(p.refused));
    const watch = [{ url: OLD, status: 301, location: '/services/ai-automation-services-pakistan' }, { url: W + '/a', moved_to: W + '/b' }, { url: W + '/b', status: 308, location: W + '/c' }];
    check('two addresses are one page across a permanent move (and a chain), never across a page that did not move',
      (await mv({ fn: 'samePage', a: OLD, b: NEW, watch })) === true && (await mv({ fn: 'samePage', a: NEW, b: OLD, watch })) === true
      && (await mv({ fn: 'finalOf', a: W + '/a', watch })) === W + '/c' && (await mv({ fn: 'samePage', a: NEW, b: W + '/services/other', watch })) === false, 'samePage');
  });

  // ======================================================================================================================
  await guard('CR17D5 the daily watch end to end', async () => {
    reset(); const SN = 'CR17D5 (F5 + F10) the daily watch on the production shape: two 301s the client made (one asked for by a site step) and a deep page sent home; the High alerts of the old watch resolve, the moves are confirmed, the rows follow, and the next day the new addresses are watched'; begin(SN); const check = mkCheck(SN);
    const HOME = W + '/', OLD1 = W + '/engagement-models', NEW1 = W + '/services/engagement-models', OLD2 = W + '/ai-automation-services-pakistan', NEW2 = W + '/services/ai-automation-services-pakistan';
    const GONE = W + '/old-offer', GUIDE = W + '/insights/guide', ROBOTS = W + '/robots.txt';
    const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
    const siteRow = { site_id: SITE, domain: D, canonical_host: D, model_updated_at: ago(1), status: 'active', nav_pages_json: J([{ url: OLD1, title: 'Engagement models' }]) };
    const pageRows = [{ site_id: SITE, url: GUIDE, title: 'Guide', source: 'sitemap', queries_json: J([{ query: 'agency guide', impressions: 40 }]) },
      { site_id: SITE, url: GONE, title: 'Offer', source: 'sitemap', queries_json: J([{ query: 'old offer', impressions: 12 }]) }];
    const ladders = [{ ladder_id: 'lad_a', domain: D, keyword: 'ai automation services pakistan', target_url: OLD2, status: 'published', page_exists: true, rung: 4 }];
    const watchRow = (url, o) => ({ id: 1, site_id: SITE, domain: D, url, kind: 'page', weight: 10, checked_at: ago(1), status: 200, location: '', noindex: false, noindex_source: '', canonical: url, canonical_ok: true,
      title: 'T ' + url.replace(W, ''), title_hash: '', titles: 1, description: '', h1: '', h1s: 1, robots_blocked: false, robots_hash: '', state: 'ok', changes: '', last_change_at: '', changed_count: 0, error: '',
      inspect_at: '', index_state: '', indexed: '', coverage: '', google_canonical: '', last_crawl: '', mobile: '', rich_results: '', inspect_error: '', moved_to: '', ...(o || {}) });
    const ok = (await pw({ robots_res: { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: ROBOTS_TXT } })).robots;
    const cache = { checked_at: ago(1), robots_v: 2, robots_state: 'ok', robots_status: 200, robots_hash: ok.hash, robots_text: ok.text, robots_facts: ok.facts, robots_last_good_hash: ok.hash, robots_last_good_at: ago(1), robots_bad_runs: 0 };
    const h1 = await hashOf('example-agency.com/engagement-models'), h2 = await hashOf('example-agency.com/ai-automation-services-pakistan'), hg = await hashOf('example-agency.com/insights/guide');
    const legacy = (code, h, day) => ({ site_id: SITE, domain: D, kind: 'page_watch', severity: code === 'page_gone' ? 'critical' : 'high', subject: code, summary: 'old', received_at: day + 'T05:45:00.000Z',
      message_id: 'watch:' + SITE + ':' + code + ':' + h + ':' + day, status: 'new', source: 'page_watch' });
    const OPEN = [legacy('page_redirects', h1, '2026-11-07'), legacy('page_redirects', h2, '2026-11-07'), legacy('page_gone', hg, '2026-11-02')];
    const loads = (watch, open) => {
      mock('Load Sites (Watch)', [{ json: siteRow }]); mock('Load Ladders (Watch)', ladders.map(json => ({ json }))); mock('Load Pages (Watch)', pageRows.map(json => ({ json })));
      mock('Load Page Watch', watch.map(json => ({ json }))); mock('Load Watch Cache', [{ json: { key: 'watch:' + SITE, kind: 'watch', site_id: SITE, value: J(cache), updated_at: ago(1) } }]);
      mock('Load Recheck Requests', [{ json: {} }]); mock('Load Ops Alerts (Watch)', [{ json: {} }]);
      mock('Load Index Pages (Watch)', [{ json: { site_id: SITE, url: OLD1, improved_to: NEW1, merge_into: '' } }]);
      mock('Load Content Log (Watch)', [{ json: { site_id: SITE, domain: D, keyword: 'ai automation services pakistan', published_url: OLD2, published_at: ago(40), status: 'published' } }]);
      mock('Load AI Targets (Watch)', [{ json: { target_id: 'ait_36', site_id: SITE, domain: D, page_url: OLD2 } }]);
      mock('Load AI Pages (Watch)', [{ json: { site_id: SITE, domain: D, url: OLD2 } }, { json: { site_id: SITE, domain: D, url: NEW2 } }, { json: { site_id: SITE, domain: D, url: OLD1 } }]);
      mock('Load Console Alerts (Watch)', open.map(json => ({ json })));
      delete store['Watch Run'];
    };
    const STORED = [watchRow(HOME), watchRow(OLD1, { kind: 'nav', status: 301, location: '/services/engagement-models', canonical: '', title: '' }),
      watchRow(OLD2, { kind: 'ladder', status: 301, location: '/services/ai-automation-services-pakistan', canonical: '', title: '' }),
      watchRow(GONE, { status: 301, location: '/', canonical: '', title: '' }), watchRow(GUIDE, { status: 404, canonical: '', title: '' })];
    loads(STORED, OPEN);
    const plan = (await run('Watch Plan', [{ json: {} }])).map(x => x.json);
    check('the plan carries the stored robots.txt state, the move Steps on your website asked for, and the 3 open alerts of the old watch',
      plan[0].kind === 'robots' && plan[0].site.robots_prev.v === 2 && plan[0].site.expected_moves.length === 1 && plan[0].site.open_alerts.length === 3, J(plan[0].site.expected_moves));
    const self = (u) => ({ statusCode: 200, headers: { 'content-type': 'text/html' }, data: '<html><head><title>T ' + u.replace(W, '') + '</title><link rel="canonical" href="' + u + '"/></head><body><h1>x</h1></body></html>' });
    mock('Fetch Watch Page', plan.map(p => p.kind === 'robots' ? { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: ROBOTS_TXT }
      : p.url === OLD1 ? { statusCode: 301, headers: { location: '/services/engagement-models' }, data: '' }
        : p.url === OLD2 ? { statusCode: 301, headers: { location: '/services/ai-automation-services-pakistan' }, data: '' }
          : p.url === GONE ? { statusCode: 301, headers: { location: '/' }, data: '' } : self(p.url)));
    await run('Watch Read', store['Fetch Watch Page']);
    const hops = (await run('Watch Hop Plan', store['Watch Read'])).map(x => x.json);
    check('one more GET per redirecting key page, to its target on the same site (three here); robots.txt answered directly so it needs none',
      hops.length === 3 && hops.every(h => h.kind === 'page') && hops.map(h => h.url).includes(NEW1) && hops.map(h => h.url).includes(NEW2) && hops.map(h => h.url).includes(HOME), J(hops));
    mock('Fetch Watch Hop', hops.map(h => self(h.url)));
    const day = (await run('Watch Compare', store['Fetch Watch Hop']))[0].json;
    const st = (u) => day.pages.find(p => p.url === u) || {};
    console.log('   cr17d5 day ->', J(day.pages.map(p => [p.url.replace(W, ''), p.status, p.verdict, p.moved_to.replace(W, '')])), J(day.changes.map(c => [c.code, c.severity])));
    check('both client 301s land on working, self-canonical pages: verdict `moved`, and (seen yesterday too) the move is confirmed', st(OLD1).verdict === 'moved' && st(OLD1).moved_to === NEW1 && st(OLD2).moved_to === NEW2, J([st(OLD1), st(OLD2)]));
    check('the deep page sent to the home page is never a move', st(GONE).verdict === 'home' && st(GONE).moved_to === '', J(st(GONE)));
    check('no High alert for a standing redirect, and nothing about robots.txt (same rules)', day.changes.filter(c => c.severity === 'high' || c.severity === 'critical').length === 0 && !day.changes.some(c => c.kind === 'robots'), J(day.changes));
    const rows = (await run('Watch Rows', store['Watch Compare'])).map(x => x.json);
    const TC = require('./table_cols.json');
    check('the watch rows carry the move (`moved_to`) and exactly the seo_page_watch columns', rows.find(r => r.url === OLD1).moved_to === NEW1 && rows.every(r => J(Object.keys(r).sort()) === J([...TC.PAGE_WATCH].sort())), J(rows.map(r => [r.url, r.moved_to])));
    const cacheRow = (await run('Watch Cache Rows', store['Watch Compare']))[0].json;
    const cv = JSON.parse(cacheRow.value);
    check('the robots.txt state and its last good copy are stored for tomorrow (version 2, rules as text and per rule)', cv.robots_v === 2 && cv.robots_state === 'ok' && cv.robots_hash === ok.hash && cv.robots_facts.length >= 5 && /disallow: \/api\//.test(cv.robots_text), cacheRow.value.slice(0, 400));
    const alerts = (await run('Watch Alerts', store['Watch Compare'])).map(x => x.json);
    const byId = (id) => alerts.find(a => a.message_id === id) || {};
    check('the three open alerts of the old watch are resolved on their own rows, each with the reason (two moves, one page that answers again)',
      byId(OPEN[0].message_id).status === 'resolved' && /moves permanently to \/services\/engagement-models/.test(byId(OPEN[0].message_id).resolution)
      && byId(OPEN[1].message_id).status === 'resolved' && byId(OPEN[2].message_id).status === 'resolved' && /answers 200 again/.test(byId(OPEN[2].message_id).resolution)
      && alerts.every(a => J(Object.keys(a).sort()) === J([...TC.CONSOLE_ALERTS].filter(c => (c !== 'ack_by' && c !== 'ack_at') || (c in a)).sort()) && Object.keys(a).length >= TC.CONSOLE_ALERTS.length - 2), J(alerts.map(a => [a.message_id.slice(-24), a.status, a.resolution])));
    const moves = (await run('Watch Moves', [{ json: {} }]))[0].json;
    check('Watch Moves: the ladder rung, the content log row and the AI question follow /ai-automation-services-pakistan to /services/...; its AI readiness row is dropped (the new address has one), the other renamed',
      moves.ladders.length === 1 && moves.ladders[0].target_url === NEW2 && moves.logs.length === 1 && moves.logs[0].published_url === NEW2 && moves.targets.length === 1 && moves.targets[0].target_id === 'ait_36'
      && moves.ai_pages_delete.length === 1 && moves.ai_pages_delete[0].url === OLD2 && moves.ai_pages_update.length === 1 && moves.ai_pages_update[0].url === NEW1, J(moves));
    const mr = (await run('Move Rows (Ladder)', [{ json: {} }])).map(x => x.json);
    const md = (await run('Move Rows (Old AI Page)', [{ json: {} }])).map(x => x.json);
    check('each table node gets exactly its own updates (the match fields and the new address)', mr.length === 1 && mr[0].ladder_id === 'lad_a' && mr[0].from === OLD2 && md.length === 1 && md[0].url === OLD2, J([mr, md]));
    // the next morning: the watch reads the new addresses, and the old ones are listed as moved
    const next = rows.map(r => ({ ...r, id: 1 }));
    loads(next, []);
    const plan2 = (await run('Watch Plan', [{ json: {} }])).map(x => x.json);
    const urls2 = plan2.map(p => p.url);
    check('the next day the watch reads /services/engagement-models and /services/ai-automation-services-pakistan instead of the old addresses',
      urls2.includes(NEW1) && urls2.includes(NEW2) && !urls2.includes(OLD1) && !urls2.includes(OLD2) && plan2[0].site.moved.length === 2, J(urls2.map(u => u.replace(W, ''))));
  });

  // ======================================================================================================================
  await guard('CR17D6 the Rank Tracker treats a moved page as one page', async () => {
    reset(); const SN = 'CR17D6 (F10) the Rank Tracker: the page Google ranks and the ladder\'s page are one page when one moved permanently to the other (no "a different page of yours")'; begin(SN); const check = mkCheck(SN);
    const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_fl_785.json.gz'))).toString());
    const loadFx = () => { for (const n of ['Tracker Plan', 'Parse Positions', 'SERP Check Answers', 'Load Ladders', 'Load History', 'Load Content Log (Tracker)', 'Load Pages (Tracker)', 'Load Monitors (Tracker)', 'Load AI Brands (Tracker)', 'Load Query History (Tracker)'])
      mock(n, (FX[n].length ? FX[n] : [{}]).map(j => ({ json: j }))); };
    loadFx(); delete store['Load Page Watch (Tracker)'];
    const pep0 = (await run('Tracker Report', store['Parse Positions'])).map(i => i.json).find(x => x.ladder_id === 'lad_muz4gf79ifhk') || {};
    const ru = 'https://www.techand.ai/insights/upgrading-your-erp-for-uae-peppol-pint-ae-compliance-a-technical-integration-guide';
    check('the recorded run (exec 785): without a move the two pages are two pages, and the step says so', /Google ranks a different page of yours/.test((pep0.next_step || {}).text || ''), (pep0.next_step || {}).text);
    const pg = ((pep0.next_step || {}).pages || [])[0] || {};
    const ours = pg.covered_by || pg.target_url;
    loadFx(); mock('Load Page Watch (Tracker)', [{ json: { site_id: 'site_techand-ai', url: ours, status: 301, location: ru, moved_to: '' } }]);
    const pep1 = (await run('Tracker Report', store['Parse Positions'])).map(i => i.json).find(x => x.ladder_id === 'lad_muz4gf79ifhk') || {};
    check('when our page moved permanently to the page Google ranks, there is no "different page of yours": it is the same page', !!ours && !/Google ranks a different page of yours/.test((pep1.next_step || {}).text || ''), J({ ours, text: (pep1.next_step || {}).text }));
  });

  // ======================================================================================================================
  await guard('CR17D7 publish check names the live address of a case-variant 404', async () => {
    reset(); const SN = 'CR17D7 (F10) "I published a page" with /services/ai-automation-services-Pakistan (404): the answer says the address with different capital letters does not exist and gives the live one'; begin(SN); const check = mkCheck(SN);
    const LIVE = 'https://devaicon-example.com/services/ai-automation-services-pakistan', TYPED = 'https://devaicon-example.com/services/ai-automation-services-Pakistan';
    const pc = async (url, logs) => { reset();
      await run('Normalize Input', { body: { mode: 'published', domain: 'devaicon-example.com', callback_url: 'https://hooks.example.com/x', request_id: 'pub-194', published_url: url, keyword: 'ai automation services pakistan' } });
      mock('Load Content Log (Published)', logs.map(json => ({ json }))); mock('Load Ladders (Published)', [{ json: {} }]); mock('Load Query History (Published)', [{ json: {} }]);
      mock('Fetch Published Page', [{ json: { statusCode: 404, headers: { 'content-type': 'text/html' }, data: '<html><title>404</title></html>' } }]);
      return (await run('Publish Check', [{ json: {} }]))[0].json; };
    const known = [{ site_id: 'site_devaicon-example-com', domain: 'devaicon-example.com', keyword: 'ai automation services pakistan', published_url: LIVE, status: 'published' }];
    const a = await pc(TYPED, known);
    check('a known page differing only in capital letters: "does not exist: your server treats capital letters as different. Your live page is /services/ai-automation-services-pakistan"',
      a.live === false && /\/services\/ai-automation-services-Pakistan does not exist: your server treats capital letters as different/.test(a.summary) && /Your live page is \/services\/ai-automation-services-pakistan/.test(a.summary), a.summary);
    const b = await pc(TYPED, []);
    check('with no known twin, an address with capital letters gets the hint to check them', /Check the capital letters/.test(b.summary), b.summary);
    const c = await pc('https://devaicon-example.com/services/missing-page', known);
    check('an ordinary 404 keeps the old sentence', /Make sure it is public/.test(c.summary) && !/capital letters/.test(c.summary), c.summary);
  });

  // ======================================================================================================================
  await guard('CR17D8 the generated wiring', async () => {
    reset(); const SN = 'CR17D8 (F5) the generated Page Watch: the key-page fetch never follows redirects, the hop follows five like Google'; begin(SN); const check = mkCheck(SN);
    const WIRE = require('./page_watch_wiring.json');
    check('wiring: Watch Read -> Watch Hop Plan -> (hop) -> Watch Compare, and Save Watch Cache -> Watch Moves', J(WIRE.connections['Watch Read']) === J([['Watch Hop Plan']]) && J(WIRE.connections['Any Watch Hops?']) === J([['Fetch Watch Hop'], ['Watch Compare']])
      && J(WIRE.connections['Save Watch Cache']) === J([['Watch Moves']]) && WIRE.fetch.follows_redirects === false && WIRE.hop.follows_redirects === true && WIRE.hop.max_redirects === 5, J(WIRE.hop));
  });

  // ======================================================================================================================
  // CR17-FX-INDEX (review R1 of the CR17 integration: M1 M2 M3 M4 L1 L2 L3 L6), on the same made-up site
  await guard('CR17FXD1 kits: verdicts, lifecycle, moves', async () => {
    reset(); const SN = 'CR17FXD1 (review R1) Page Watch re-judges a standing redirect, keeps a robots.txt block it could not read, "canonical removed" lasts while the tag is missing, a country redirect is no move, two searches never move onto one page, a chain moves to its end'; begin(SN); const check = mkCheck(SN);
    const A = W + '/a', B = W + '/b', C = W + '/c', T0 = '2026-11-10T05:45:00.000Z', T1 = '2026-11-11T05:45:00.000Z', T2 = '2026-11-12T05:45:00.000Z';
    // M1: the target breaks after the move (or under a temporary redirect)
    const gone = (await pw({ redirect: { url: A, status: 301, location: '/b', hop: { ok: true, status: 404 } } })).verdict;
    const cmp = async (pv, v) => (await pw({ compare: { prev: { checked_at: 'x', status: 301, location: '/b', redirect_verdict: pv }, now: { ok: true, status: 301, location: '/b' }, opts: { url: A, redirect: v } } })).changes;
    const m1a = await cmp('moved', gone), m1b = await cmp('', gone), m1c = await cmp('gone', gone), m1d = await cmp('moved', { ...gone, verdict: 'unread' });
    check('CR17FXD1-M1 a page that keeps redirecting is judged again: moved -> gone raises the Critical "redirects to a page that is gone"; the same verdict, a first verdict (baseline) or an unread target say nothing',
      m1a.length === 1 && m1a[0].code === 'page_redirect_bad' && m1a[0].severity === 'critical' && m1b.length === 0 && m1c.length === 0 && m1d.length === 0, J([m1a, m1b, m1c, m1d]));
    const tmp = { code: 'page_redirects', severity: 'medium', label: 'page now redirects', text: 'The page now redirects temporarily (302) to /b.', url: A, kind: 'nav' };
    const o0 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T0, changes: [tmp], pages: [{ url: A, ok: true, status: 302, verdict: 'temporary' }], open: [] } })).lifecycle.rows[0];
    const o1 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T1, changes: [{ ...m1a[0], url: A, kind: 'nav' }], pages: [{ url: A, ok: true, status: 302, verdict: 'gone' }], open: [o0] } })).lifecycle.rows[0];
    const o2 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T2, changes: [{ ...tmp, text: 'again temporary' }], pages: [{ url: A, ok: true, status: 302, verdict: 'temporary' }], open: [o1] } })).lifecycle.rows[0];
    check('CR17FXD1-M1 the open "temporary" alert takes the Critical "gone" verdict in place (same row), and falls back to Medium when the target works again',
      o1.message_id === o0.message_id && o1.severity === 'critical' && /gone/.test(o1.summary) && o2.message_id === o0.message_id && o2.severity === 'medium', J([o0.severity, o1.severity, o2.severity]));
    // M2: robots.txt not read today never resolves a real block
    const rbOpen = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T0, changes: [{ code: 'robots_blocked', severity: 'critical', label: 'blocked by robots.txt', text: 'robots.txt now stops Google crawling /a', url: A, kind: 'nav' }], pages: [{ url: A, ok: true, status: 200, robots_blocked: true }], open: [] } })).lifecycle.rows[0];
    const rbNull = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T1, changes: [], pages: [{ url: A, ok: true, status: 200, robots_blocked: null }], open: [rbOpen] } })).lifecycle.rows;
    const rbFalse = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T2, changes: [], pages: [{ url: A, ok: true, status: 200, robots_blocked: false }], open: [rbOpen] } })).lifecycle.rows;
    check('CR17FXD1-M2 a day robots.txt could not be read (null) leaves the Critical block open (nothing claimed); a real read without the block resolves it',
      rbOpen.status === 'new' && rbNull.length === 0 && rbFalse.length === 1 && rbFalse[0].status === 'resolved' && /no longer blocks/.test(rbFalse[0].resolution), J([rbNull, rbFalse]));
    // L1: canonical removed
    const crm = { code: 'canonical_removed', severity: 'low', label: 'canonical removed', text: 'The canonical tag is gone (it pointed at the page itself).', url: A, kind: 'nav' };
    const c0 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T0, changes: [crm], pages: [{ url: A, ok: true, status: 200, canonical: '' }], open: [] } })).lifecycle.rows[0];
    const c1 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T1, changes: [], pages: [{ url: A, ok: true, status: 200, canonical: '' }], open: [c0] } })).lifecycle.rows[0];
    const c2 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T2, changes: [], pages: [{ url: A, ok: true, status: 200, canonical: A }], open: [c1] } })).lifecycle.rows[0];
    const ha = await hashOf('example-agency.com/a');
    const legacyC = { ...c0, condition_key: 'watch:' + SITE + ':canonical:' + ha };
    const c3 = (await pw({ lifecycle: { site_id: SITE, domain: D, now: T1, changes: [], pages: [{ url: A, ok: true, status: 200, canonical: '' }], open: [legacyC] } })).lifecycle.rows[0];
    check('CR17FXD1-L1 "canonical removed" stays open while the tag is missing (never "now points at the page itself"), and resolves with "The canonical tag is back" (also a row stored under the old shared key)',
      /:canonical_tag:/.test(c0.condition_key) && c1.status === 'new' && c1.count === 2 && c2.status === 'resolved' && /^The canonical tag is back, pointing at the page itself/.test(c2.resolution)
      && c3.status === 'new' && /:canonical_tag:/.test(c3.condition_key), J([c1, c2.resolution, c3]));
    // L6: a new row starts with empty marks; an updated / resolved row carries none
    check('CR17FXD1-L6 the engine writes ack_by / ack_at only on a row it creates (empty); on updates and resolves it leaves them to the app',
      c0.ack_by === '' && c0.ack_at === '' && !('ack_by' in c1) && !('ack_by' in c2) && !('ack_at' in rbFalse[0]), J([Object.keys(c1)]));
    // M4: a country / language redirect
    const lv = (await pw({ redirect: { url: W + '/services/a', status: 301, location: '/ae/services/a', hop: { ok: true, status: 200 } } })).verdict;
    const lv2 = (await pw({ redirect: { url: W + '/services/a', status: 301, location: '/en/', hop: { ok: true, status: 200 } } })).verdict;
    const lc = await mv({ fn: 'confirm', args: [{ url: W + '/services/a', status: 301, location: '/ae/services/a' }, { url: W + '/services/a', status: 301, location: '/ae/services/a' }, 'moved'] });
    const lfin = await mv({ fn: 'finalOf', a: W + '/services/a', watch: [{ url: W + '/services/a', status: 301, location: '/ae/services/a' }] });
    check('CR17FXD1-M4 a redirect that only adds a country prefix (or sends a deep page to a bare locale root) is Info "a language or country version for where our server is", never a confirmed move or a known move',
      lv.verdict === 'locale' && lv.severity === 'info' && lv2.verdict === 'locale' && !lc.ok && /language or country/.test(lc.reason) && lfin === '', J([lv, lc, lfin]));
    // M3: two searches onto one address in one run
    const T = W + '/services/ai-consulting';
    const ladders = [{ ladder_id: 'lad_d', domain: D, keyword: 'ai consulting dubai', target_url: W + '/ai-consulting-dubai', status: 'published', page_exists: true },
      { ladder_id: 'lad_u', domain: D, keyword: 'ai consulting uae', target_url: W + '/ai-consulting-uae', status: 'published', page_exists: true }];
    const logs = [{ site_id: SITE, domain: D, keyword: 'ai consulting uae', published_url: W + '/ai-consulting-uae', status: 'published' }];
    const p3 = await mv({ fn: 'plan', args: [[{ from: W + '/ai-consulting-dubai', to: T }, { from: W + '/ai-consulting-uae', to: T }], { ladders, logs, targets: [], aiPages: [] }, { domain: D, site_id: SITE }] });
    check('CR17FXD1-M3 two searches\' pages moved onto ONE address the same day: the first follows, the second (ladder and content log) is refused and names the first search',
      p3.ladders.length === 1 && p3.ladders[0].ladder_id === 'lad_d' && p3.logs.length === 0 && p3.refused.filter(r => /ai consulting dubai/.test(r.reason)).length === 2, J(p3));
    // L2: a chain moves to its end, never onto an address that redirects
    const chainNow = { url: A, status: 301, location: '/b' };
    const l2a = await mv({ fn: 'confirm', args: [chainNow, chainNow, 'moved', { reads: [{ url: B, ok: true, status: 301, location: '/c' }] }] });
    const l2b = await mv({ fn: 'confirm', args: [chainNow, chainNow, 'moved', { moves: [{ url: B, moved_to: C }], reads: [{ url: C, ok: true, status: 200 }] }] });
    const l2c = await mv({ fn: 'confirm', args: [chainNow, chainNow, 'moved', { reads: [{ url: B, ok: true, status: 200 }] }] });
    check('CR17FXD1-L2 a target that redirects again is a chain not ended (refused); a target confirmed as moved is followed to its end (/c); a target that answers 200 is the move',
      !l2a.ok && /redirects again/.test(l2a.reason) && l2b.ok && l2b.to === C && l2c.ok && l2c.to === B, J([l2a, l2b, l2c]));
  });

  await guard('CR17FXD2 the watch end to end: chains, weekly move checks, carried readings', async () => {
    reset(); const SN = 'CR17FXD2 (review R1 L2 / L3 / M1 / M2) the daily watch: the target of a standing 301 is read too and a chain is not confirmed, a moved address is read again weekly and a removed redirect clears the move (rows stay), the redirect verdict and a robots.txt block are carried on a day they cannot be judged'; begin(SN); const check = mkCheck(SN);
    const HOME = W + '/', A = W + '/a', B = W + '/b', C = W + '/c', OLD = W + '/old', NEW = W + '/services/new', ROB = W + '/robots.txt';
    const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
    const row = (url, o) => ({ id: 1, site_id: SITE, domain: D, url, kind: 'page', weight: 10, checked_at: ago(1), status: 200, location: '', noindex: false, noindex_source: '', canonical: url, canonical_ok: true,
      title: 'T', title_hash: '', titles: 1, description: '', h1: '', h1s: 1, robots_blocked: false, robots_hash: '', state: 'ok', changes: '', last_change_at: '', changed_count: 0, error: '',
      inspect_at: '', index_state: '', indexed: '', coverage: '', google_canonical: '', last_crawl: '', mobile: '', rich_results: '', inspect_error: '', moved_to: '', redirect_verdict: '', ...(o || {}) });
    const siteRow = { site_id: SITE, domain: D, canonical_host: D, model_updated_at: ago(1), status: 'active', nav_pages_json: J([{ url: A, title: 'A' }, { url: OLD, title: 'Old' }]) };
    const loads = (watch) => {
      mock('Load Sites (Watch)', [{ json: siteRow }]); mock('Load Ladders (Watch)', [{ json: {} }]); mock('Load Pages (Watch)', [{ json: {} }]);
      mock('Load Page Watch', watch.map(json => ({ json }))); mock('Load Watch Cache', [{ json: {} }]); mock('Load Recheck Requests', [{ json: {} }]); mock('Load Ops Alerts (Watch)', [{ json: {} }]);
      mock('Load Index Pages (Watch)', [{ json: {} }]); mock('Load Content Log (Watch)', [{ json: {} }]); mock('Load AI Targets (Watch)', [{ json: {} }]); mock('Load AI Pages (Watch)', [{ json: {} }]);
      mock('Load Console Alerts (Watch)', [{ json: {} }]); delete store['Watch Run']; };
    const page = (u, canon) => ({ statusCode: 200, headers: { 'content-type': 'text/html' }, data: '<html><head><title>T</title>' + (canon ? '<link rel="canonical" href="' + canon + '"/>' : '') + '</head><body><h1>x</h1></body></html>' });
    const day = async (watch, answer, hopAnswer) => {
      loads(watch);
      const plan = (await run('Watch Plan', [{ json: {} }])).map(x => x.json);
      mock('Fetch Watch Page', plan.map(p => answer(p)));
      await run('Watch Read', store['Fetch Watch Page']);
      const hops = (await run('Watch Hop Plan', store['Watch Read'])).map(x => x.json);
      if (hops[0] && !hops[0].skip) mock('Fetch Watch Hop', hops.map(h => hopAnswer(h))); else delete store['Fetch Watch Hop'];
      const cmp = (await run('Watch Compare', store['Watch Read']))[0].json;
      const rows = (await run('Watch Rows', store['Watch Compare'])).map(x => x.json);
      return { plan, cmp, rows, st: (u) => cmp.pages.find(p => p.url === u) || {}, rw: (u) => rows.find(r => r.url === u) || {} };
    };
    const robotsOk = { statusCode: 200, headers: { 'content-type': 'text/plain' }, data: 'User-agent: *\nDisallow: /private/\n' };
    // L2: /a 301 -> /b (seen yesterday), /b 301 -> /c, /c answers 200 with no canonical
    const d1 = await day([row(HOME), row(A, { status: 301, location: '/b', canonical: '', redirect_verdict: 'moved' }), row(OLD)],
      (p) => p.kind === 'robots' ? robotsOk : p.url === A ? { statusCode: 301, headers: { location: '/b' }, data: '' } : p.url === B ? { statusCode: 301, headers: { location: '/c' }, data: '' } : page(p.url, p.url),
      () => page(C, ''));
    check('CR17FXD2-L2 the target of yesterday\'s 301 is read too (without following), and the chain /a -> /b -> /c is not confirmed onto /b', d1.plan.some(p => p.url === B) && d1.st(A).verdict === 'moved' && d1.st(A).moved_to === '' && d1.rw(A).redirect_verdict === 'moved', J(d1.cmp.pages.map(p => [p.url.replace(W, ''), p.status, p.verdict, p.moved_to])));
    // L3: a confirmed move read again after a week; the redirect is gone
    const movedRow = row(OLD, { status: 301, location: '/services/new', canonical: '', moved_to: NEW, redirect_verdict: 'moved', checked_at: ago(8) });
    const d2 = await day([row(HOME), movedRow, row(NEW, { checked_at: ago(1) })], (p) => p.kind === 'robots' ? robotsOk : page(p.url, p.url), () => page(NEW, NEW));
    const undone = d2.cmp.changes.find(c => c.code === 'move_undone');
    check('CR17FXD2-L3 a moved address is read again once a week; when it no longer redirects the move is cleared (watched again) and one Low notice says our rows still use the new page',
      d2.plan.some(p => p.url === OLD && p.move_check === true) && d2.plan.some(p => p.url === NEW) && d2.rw(OLD).moved_to === '' && !!undone && undone.severity === 'low' && /still use \/services\/new/.test(undone.text) && d2.cmp.moves_today.length === 0, J({ ch: d2.cmp.changes, row: d2.rw(OLD) }));
    const d3 = await day([row(HOME), movedRow, row(NEW)], (p) => p.kind === 'robots' ? robotsOk : p.url === OLD ? { statusCode: 301, headers: { location: '/services/new' }, data: '' } : page(p.url, p.url), () => ({ error: { message: 'timeout' } }));
    check('CR17FXD2-L3 still redirecting to the same page (its target unread today): the move stands, nothing is said, and the old address is not read again for a week',
      d3.rw(OLD).moved_to === NEW && !d3.cmp.changes.some(c => c.url === OLD) && d3.rw(OLD).redirect_verdict === 'moved', J({ ch: d3.cmp.changes, row: d3.rw(OLD) }));
    const recent = row(OLD, { status: 301, location: '/services/new', canonical: '', moved_to: NEW, checked_at: ago(2) });
    loads([row(HOME), recent, row(NEW)]);
    const plan4 = (await run('Watch Plan', [{ json: {} }])).map(x => x.json);
    check('CR17FXD2-L3 a move checked two days ago is not read again yet (weekly)', !plan4.some(p => p.url === OLD) && plan4.some(p => p.url === NEW), J(plan4.map(p => p.url)));
    // M2: robots.txt unreadable today: the stored block is carried
    const d5 = await day([row(HOME), row(A, { robots_blocked: true })], (p) => p.kind === 'robots' ? { error: { message: 'timeout' } } : page(p.url, p.url), () => page(A, A));
    check('CR17FXD2-M2 robots.txt not read today: the key page keeps its stored block (robots_blocked true), so tomorrow\'s good read is no "newly blocked"', d5.rw(A).robots_blocked === true && d5.st(A).robots_blocked == null, J(d5.rw(A)));
  });
};
