// Index coverage: what a finished Google core or spam update did to each website's pages (DESIGN §1.9). Seven days after an update completes,
// and once Search Console's data covers at least seven days after it, the same number of days before and after are read by page (two requests
// per update and website; at most two updates a website a run). Repeated as more days arrive, up to 28 days after; never for an update still
// rolling out.
// ---- the daily key-page watch and Google's view of those pages (G11 + G25, 2026-10-13; system review FIX_PLAN.md) ----
// G11: a monthly audit cannot see a page that went noindex on the 3rd. Every day the key pages are fetched raw and cheaply (one plain GET
// each, no JavaScript, no paid API) and compared with what we stored: HTTP status, a redirect that appeared, `noindex`, the canonical, the
// title - plus a hash of robots.txt per site. A change that matters raises an alert the same day; an unchanged page raises none.
// G11's second half: when somebody presses "I fixed this" in the app on an audit finding, that one finding is re-checked on these pages
// within a day instead of waiting for the next monthly audit (PW.recheck).
// G25: Search Console's URL Inspection API says what *Google* thinks of a page - indexed or not, which canonical it chose, when it last
// crawled it, mobile usability and rich results. Its quota is 2,000 queries a day and 600 a minute per property, so the pages rotate
// (never inspected first, then the oldest inspection) and whatever the budget does not reach is reported as "not checked", never as fine.
const PW = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  // the n8n Code sandbox has no URL constructor (live finding 2026-10-02), so hosts and paths are read with regexes
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
  const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
  const pathOf = (u) => { const p = S(u).replace(/^https?:\/\/[^\/]*/i, '').replace(/#.*$/, ''); return p || '/'; };
  // host-agnostic identity of a URL: crawls, sitemaps and canonicals disagree about www and the trailing slash
  const ukey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '') || S(u).toLowerCase();
  const same = (a, b) => !!a && !!b && ukey(a) === ukey(b);
  // the shared entity decoder, inlined (v5/code/_entities.js; build section 122 asserts the two stay identical): named, decimal and hex, one pass
  const entDecode = /*__ENT_BEGIN__*/(() => {
  const N = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', euro: '€', pound: '£', deg: '°' };
  return (s) => String(s == null ? '' : s).replace(/&(?:#[xX]([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));/g, (m, h, d, n) => {
    if (h !== undefined || d !== undefined) { const cp = h !== undefined ? parseInt(h, 16) : Number(d); if (cp === 160) return ' '; try { return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m; } catch (e) { return m; } }
    const k = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(N, k) ? N[k] : m;
  });
})()/*__ENT_END__*/;
  const strip = (s) => entDecode(S(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

  // ---- a small, stable fingerprint (FNV-1a, 32 bit): no crypto module is available in the sandbox ----
  const hash = (text) => {
    const t = S(text); let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  };

  // ---- what one raw fetch tells us about a page ----
  // `res` is an n8n HTTP Request answer with fullResponse + responseFormat text (so the body is under `data`, not `body`) and redirects NOT
  // followed: a key page that starts redirecting is itself a change worth knowing about.
  const signals = (res) => {
    const r = res || {};
    const status = n0(r.statusCode ?? r.status);
    const headers = r.headers || {};
    const hdr = (name) => { const k = Object.keys(headers).find(x => x.toLowerCase() === name); return k ? S(Array.isArray(headers[k]) ? headers[k].join(', ') : headers[k]) : ''; };
    const body = S(r.body ?? r.data);
    const failed = !status && (r.error || !body);
    if (failed) return { ok: false, error: S((r.error && (r.error.message || r.error.description)) || r.error || 'no answer').slice(0, 200), status: 0 };
    const xrobots = hdr('x-robots-tag');
    const head = body.slice(0, 200000);
    const metas = head.match(/<meta\b[^>]*>/gi) || [];
    const metaOf = (name) => {
      for (const m of metas) {
        if (!new RegExp('\\b(?:name|property)\\s*=\\s*["\']?' + name + '["\']?', 'i').test(m)) continue;
        const c = m.match(/\bcontent\s*=\s*"([^"]*)"/i) || m.match(/\bcontent\s*=\s*'([^']*)'/i) || m.match(/\bcontent\s*=\s*([^\s>]+)/i);
        if (c) return S(c[1]);
      }
      return '';
    };
    const robotsMeta = metaOf('robots') || metaOf('googlebot');
    const noindex = /\bnone\b|\bnoindex\b/i.test(robotsMeta) || /\bnone\b|\bnoindex\b/i.test(xrobots);
    const titles = (head.match(/<title[^>]*>[\s\S]*?<\/title>/gi) || []).map(t => strip(t.replace(/<\/?title[^>]*>/gi, '')));
    const canonRe = /<link\b[^>]*\brel\s*=\s*["']?canonical["']?[^>]*>/gi;
    const canons = (head.match(canonRe) || []).map(l => { const h = l.match(/\bhref\s*=\s*"([^"]*)"/i) || l.match(/\bhref\s*=\s*'([^']*)'/i); return h ? S(h[1]) : ''; }).filter(Boolean);
    const h1s = (body.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || []).map(x => strip(x).slice(0, 200)).filter(Boolean);
    return {
      ok: true, status,
      location: status >= 300 && status < 400 ? S(hdr('location')).slice(0, 500) : '',
      noindex, noindex_source: noindex ? (/\bnone\b|\bnoindex\b/i.test(robotsMeta) ? 'meta robots' : 'X-Robots-Tag header') : '',
      robots_meta: robotsMeta.slice(0, 120), canonical: (canons[0] || '').slice(0, 500), canonicals: canons.length,
      title: (titles[0] || '').slice(0, 300), titles: titles.length, description: metaOf('description').slice(0, 400),
      h1: (h1s[0] || ''), h1s: h1s.length, bytes: body.length, error: '',
    };
  };

  // ---- robots.txt: the fingerprint (seo_cache) plus the rules that decide whether a key page is crawlable ----
  const robotsRead = (res) => {
    const r = res || {}; const status = n0(r.statusCode ?? r.status); const text = S(r.body ?? r.data);
    if (!status) return { ok: false, status: 0, error: S((r.error && (r.error.message || r.error.description)) || r.error || 'no answer').slice(0, 200), hash: '', rules: [] };
    const clean = text.replace(/\r/g, '').split('\n').map(l => l.replace(/#.*$/, '').trim()).filter(Boolean).join('\n');
    const rules = []; let groups = [];
    for (const line of clean.split('\n')) {
      const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
      const field = m[1].toLowerCase(), value = S(m[2]);
      if (field === 'user-agent') { if (rules.length && rules[rules.length - 1].touched) { groups = []; } groups.push(value.toLowerCase()); rules.push({ agents: groups.slice(), touched: false }); continue; }
      if (field !== 'disallow' && field !== 'allow') continue;
      if (!rules.length) { groups = ['*']; rules.push({ agents: ['*'], touched: false }); }
      const g = rules[rules.length - 1]; g.touched = true; g.agents = groups.slice();
      (g.lines = g.lines || []).push({ allow: field === 'allow', path: value });
    }
    // which groups apply to Googlebot (its own group wins over `*`, as Google's parser does)
    const forGoogle = rules.filter(g => g.agents.some(a => a === 'googlebot'));
    const applies = (forGoogle.length ? forGoogle : rules.filter(g => g.agents.includes('*'))).flatMap(g => g.lines || []);
    const blocks = (url) => {
      if (status === 404 || status >= 500 || !applies.length) return null;   // no file, or nothing that applies: nothing is blocked by it
      const p = pathOf(url);
      let best = null;
      for (const l of applies) {
        if (!l.path) continue;                                              // `Disallow:` with no path allows everything
        const pat = l.path.replace(/\*+/g, '*');
        const rx = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
        if (!rx.test(p)) continue;
        if (!best || l.path.length > best.path.length) best = l;
      }
      return best ? !best.allow : false;
    };
    return { ok: true, status, hash: hash(clean), length: clean.length, rules: applies, blocks, error: '' };
  };

  // ---- what changed since the stored reading, and how loudly to say it ----
  // `prev` is the stored seo_page_watch row (or null for a page nobody has watched yet), `now` the signals of this run.
  const CODES = {
    page_gone: { severity: 'critical', label: 'page gone' },
    page_error: { severity: 'critical', label: 'server error' },
    noindex_added: { severity: 'critical', label: 'noindex added' },
    robots_blocked: { severity: 'critical', label: 'blocked by robots.txt' },
    page_redirects: { severity: 'high', label: 'page now redirects' },
    canonical_moved: { severity: 'high', label: 'canonical moved' },
    canonical_removed: { severity: 'high', label: 'canonical removed' },
    robots_changed: { severity: 'high', label: 'robots.txt changed' },
    title_changed: { severity: 'medium', label: 'title changed' },
    page_back: { severity: 'info', label: 'page answers again' },
    noindex_removed: { severity: 'info', label: 'noindex gone' },
  };
  const compare = (prev, now, o) => {
    const opts = o || {}; const out = [];
    const add = (code, text, from, to) => out.push({ code, severity: CODES[code].severity, label: CODES[code].label, text, from: S(from), to: S(to) });
    if (!now || now.ok === false) return out;                                 // a failed fetch is "not checked", never a change
    const first = !prev || !S(prev.checked_at);
    const was = prev || {};
    const wasStatus = n0(was.status), nowStatus = n0(now.status);
    const url = S(opts.url);
    if (!first) {
      if (wasStatus >= 200 && wasStatus < 400 && nowStatus >= 500) add('page_error', 'The page answers ' + nowStatus + ' (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      else if (wasStatus >= 200 && wasStatus < 400 && nowStatus >= 400) add('page_gone', 'The page is gone: it answers ' + nowStatus + ' (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      else if (wasStatus >= 400 && nowStatus >= 200 && nowStatus < 300) add('page_back', 'The page answers ' + nowStatus + ' again (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      if (nowStatus >= 300 && nowStatus < 400 && !(wasStatus >= 300 && wasStatus < 400)) add('page_redirects', 'The page now redirects (' + nowStatus + ' to ' + (S(now.location) || 'an address it does not name') + ')', wasStatus, nowStatus + ' ' + S(now.location));
      if (now.noindex && !was.noindex) add('noindex_added', 'The page tells search engines not to index it (' + S(now.noindex_source) + ': "' + S(now.robots_meta || 'noindex') + '")', '', S(now.noindex_source));
      if (!now.noindex && was.noindex) add('noindex_removed', 'The page no longer tells search engines to leave it out', S(was.noindex_source), '');
      // the title and the canonical are only compared between two readings of a page that was answering: the title of yesterday's 404
      // ("Not found") is not a baseline, so a page that comes back is "answers again", never "the title changed".
      const wasOk = wasStatus >= 200 && wasStatus < 300;
      if (wasOk && nowStatus >= 200 && nowStatus < 300) {
        if (S(was.canonical) && !S(now.canonical)) add('canonical_removed', 'The canonical tag is gone (it pointed at ' + S(was.canonical) + ')', S(was.canonical), '');
        else if (S(now.canonical) && S(was.canonical) && !same(now.canonical, was.canonical)) add('canonical_moved', 'The canonical now points at ' + S(now.canonical) + ' (it pointed at ' + S(was.canonical) + ')', S(was.canonical), S(now.canonical));
        if (S(was.title) && S(now.title) && S(was.title) !== S(now.title)) add('title_changed', 'The title changed to "' + S(now.title) + '" (it was "' + S(was.title) + '")', S(was.title), S(now.title));
      }
    }
    // a page we are seeing for the first time is a baseline, never a change — that includes one robots.txt already blocked before we looked
    if (!first && opts.robots_blocked === true && opts.robots_blocked_before !== true) add('robots_blocked', 'robots.txt now stops Google crawling ' + (url || 'this page'), '', 'disallowed');
    return out;
  };
  // the site's robots.txt as a change of its own (one per site, compared with the stored seo_cache fingerprint)
  const robotsChange = (prevHash, robots) => {
    if (!robots || robots.ok === false) return null;
    const before = S(prevHash);
    if (!before || before === S(robots.hash)) return null;
    return { code: 'robots_changed', severity: CODES.robots_changed.severity, label: CODES.robots_changed.label,
      text: 'robots.txt changed (' + robots.status + ', ' + n0(robots.length) + ' characters of rules). Read it before the next crawl: one wrong Disallow line can take the whole site out of Google.',
      from: before, to: S(robots.hash) };
  };
  const state = (changes, now) => (!now || now.ok === false) ? 'not_checked' : ((changes || []).some(c => c.severity !== 'info') ? 'changed' : 'ok');
  const worst = (changes) => { const order = ['critical', 'high', 'medium', 'info']; return (changes || []).map(c => c.severity).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] || ''; };

  // ---- "I fixed this": one audit finding, re-checked on the key pages we just fetched ----
  // Only what a raw fetch of the key pages can honestly answer is answered. Anything else (a crawl of the whole site, Search Console,
  // speed data) says so and waits for the audit - it never comes back "fixed" on a guess.
  const RULES = [
    { rule: 'broken_pages', re: /broken pages|do not return 200|not return 200|4xx|5xx/i, label: 'a key page that does not answer 200',
      test: (p) => n0(p.status) >= 400 },
    { rule: 'redirecting_pages', re: /internal urls that redirect|meta refresh/i, label: 'a key page that redirects',
      test: (p) => n0(p.status) >= 300 && n0(p.status) < 400 },
    { rule: 'noindex', re: /noindex|not indexable/i, label: 'a key page that asks not to be indexed', test: (p) => !!p.noindex },
    { rule: 'robots_blocked', re: /blocked by robots\.txt/i, label: 'a key page robots.txt blocks', test: (p) => p.robots_blocked === true },
    { rule: 'missing_title', re: /missing title tag/i, label: 'a key page with no title', test: (p) => n0(p.status) < 300 && !S(p.title) },
    { rule: 'multiple_titles', re: /more than one title tag/i, label: 'a key page with more than one title tag', test: (p) => n0(p.titles) > 1 },
    { rule: 'title_short', re: /title shorter than/i, label: 'a key page title under 30 characters', test: (p) => n0(p.status) < 300 && S(p.title) && S(p.title).length < 30 },
    { rule: 'title_long', re: /title longer than/i, label: 'a key page title over 60 characters', test: (p) => S(p.title).length > 60 },
    { rule: 'missing_description', re: /missing meta description/i, label: 'a key page with no meta description', test: (p) => n0(p.status) < 300 && !S(p.description) },
    { rule: 'description_short', re: /meta description shorter than/i, label: 'a key page description under 70 characters', test: (p) => n0(p.status) < 300 && S(p.description) && S(p.description).length < 70 },
    { rule: 'description_long', re: /meta description longer than/i, label: 'a key page description over 160 characters', test: (p) => S(p.description).length > 160 },
    { rule: 'missing_h1', re: /missing h1/i, label: 'a key page with no H1', test: (p) => n0(p.status) < 300 && !S(p.h1) },
    { rule: 'multiple_h1', re: /more than one h1/i, label: 'a key page with more than one H1', test: (p) => n0(p.h1s) > 1 },
    { rule: 'missing_canonical', re: /missing canonical tag/i, label: 'a key page with no canonical tag', test: (p) => n0(p.status) < 300 && !S(p.canonical) },
    { rule: 'canonical_other', re: /canonical points to a different page/i, label: 'a key page whose canonical points elsewhere',
      test: (p) => n0(p.status) < 300 && S(p.canonical) && !same(p.canonical, p.url) },
    { rule: 'http_pages', re: /served over http\b|link to http urls/i, label: 'a key page on http', test: (p) => /^http:\/\//i.test(S(p.url)) },
  ];
  const recheckRule = (finding) => {
    const text = S((finding || {}).title) || S((finding || {}).finding_key).split('|').slice(1).join('|');
    if (!text) return null;
    return RULES.find(r => r.re.test(text)) || null;
  };
  /** finding + the pages this run read -> { state: 'fixed' | 'still_open' | 'not_checked', note, checked, hits } */
  const recheck = (finding, pages) => {
    const list = (pages || []).filter(p => p && p.ok !== false && S(p.url) && S(p.kind) !== 'robots');
    const r = recheckRule(finding);
    const title = S((finding || {}).title) || S((finding || {}).finding_key);
    if (!r) return { state: 'not_checked', rule: '', checked: list.length, hits: [],
      note: 'The daily key-page watch cannot judge "' + title + '" on its own (it needs the full crawl, Search Console or speed data). The next audit decides it.' };
    if (!list.length) return { state: 'not_checked', rule: r.rule, checked: 0, hits: [],
      note: 'No key page could be read in this check, so nothing was judged. It is tried again with the next daily watch.' };
    const hits = list.filter(p => { try { return !!r.test(p); } catch (e) { return false; } }).map(p => S(p.url));
    return hits.length
      ? { state: 'still_open', rule: r.rule, checked: list.length, hits: hits.slice(0, 10),
          note: 'Still open on ' + hits.length + ' of the ' + list.length + ' key pages checked (' + r.label + '): ' + hits.slice(0, 3).join(', ') + (hits.length > 3 ? ' …' : '') + '.' }
      : { state: 'fixed', rule: r.rule, checked: list.length, hits: [],
          note: 'Fixed on the ' + list.length + ' key pages checked (no ' + r.label + ' left). The next full audit checks the rest of the site.' };
  };

  // ---- B5-8 (2026-10-15, benchmark area 5): what we already know changed, and what that orders ----
  // Ahrefs' Always-On Audit picks the next URL to re-crawl partly from IndexNow pings (ahrefs.com/blog/always-on-audit). We OPERATE
  // IndexNow for the customer (v4.12) and we write their pages ourselves, so we hold the same signal and used it for nothing: the
  // queues were ordered "oldest reading first", which puts the page we changed on Monday behind a page nobody has touched in a year.
  // Three free signals, all already stored:
  //   * seo_ai_pages.submitted_at / submitted_via  - the IndexNow and Bing submissions AI Growth makes every week
  //   * seo_content_log.published_at / started_at  - the published-page log (what the Content Cadence wrote, and when it went live)
  //   * seo_ai_targets.written_at                  - the AI answer / refresh pages
  // INVARIANTS rule 1 lives in the return value: a table that could NOT be read is `not_read` with its reason, which is not the same
  // answer as "nothing changed this week", and every consumer prints whichever of the two it got.
  const FRESH_DAYS = 7;
  const CHANGE_LABEL = { indexnow: 'submitted to IndexNow', bing: 'submitted to Bing', published: 'published', written: 'written' };
  const changedPages = (sources, o) => {
    const opts = o || {};
    const days = Math.max(1, n0(opts.days) || FRESH_DAYS);
    const nowMs = Date.parse(S(opts.now)) || Date.now();
    const cutoff = nowMs - days * 864e5;
    const map = new Map(); const sources_read = []; const not_read = [];
    for (const src of (sources || [])) {
      const name = S(src && src.name) || 'a stored table';
      if (!src || src.read === false) { not_read.push({ source: name, reason: S(src && src.reason) || 'the table could not be read in this run' }); continue; }
      let used = 0;
      for (const r of (src.rows || [])) {
        const url = S(src.url ? src.url(r) : r.url);
        const ts = Date.parse(S(src.at ? src.at(r) : r.updated_at));
        if (!/^https?:\/\//i.test(url) || !Number.isFinite(ts) || ts < cutoff || ts > nowMs + 864e5) continue;
        const kind = S(src.kind ? src.kind(r) : src.default_kind) || 'written';
        const k = ukey(url); const prev = map.get(k);
        if (!prev || ts > prev.ts) map.set(k, { url, ts, at: new Date(ts).toISOString().slice(0, 10), kind, label: CHANGE_LABEL[kind] || kind, source: name });
        used += 1;
      }
      sources_read.push({ source: name, rows: (src.rows || []).length, within_window: used });
    }
    const read = sources_read.length > 0;
    const count = map.size;
    const basis = !read
      ? 'not available: none of the recent-change signals could be read in this run (' + (not_read.map(x => x.source + ' - ' + x.reason).join('; ') || 'no source was offered') + ')'
      : count
        ? 'measured: ' + count + ' page(s) we submitted or wrote in the last ' + days + ' days, from ' + sources_read.map(x => x.source).join(' + ')
          + (not_read.length ? ' (' + not_read.map(x => x.source + ' could not be read: ' + x.reason).join('; ') + ')' : '')
        : 'measured: no page was submitted or written in the last ' + days + ' days by the signals we hold (' + sources_read.map(x => x.source).join(' + ') + ')'
          + (not_read.length ? '; ' + not_read.map(x => x.source + ' could not be read: ' + x.reason).join('; ') : '');
    return { map, read, count, window_days: days, as_of: new Date(nowMs).toISOString().slice(0, 10), sources_read, not_read, basis,
      pages: [...map.values()].sort((a, b) => b.ts - a.ts).slice(0, 25).map(p => ({ url: p.url, at: p.at, kind: p.kind, label: p.label, source: p.source })) };
  };
  /** The freshness of one URL against a changedPages() result, or null when nothing is known about it. */
  const changeOf = (changed, url) => (changed && changed.map && changed.map.get(ukey(url))) || null;
  /**
   * B5-8: puts the pages we know changed at the front of a queue and leaves the rest in the order they arrived.
   * `then` is the queue's own comparator, so the existing order survives underneath. Returns the sentence a report prints:
   * a signal that could not be read NEVER reads as "nothing changed".
   */
  const freshFirst = (list, changed, o) => {
    const opts = o || {};
    const then = typeof opts.then === 'function' ? opts.then : () => 0;
    const ts = (p) => { const c = changeOf(changed, p && p.url); return c ? c.ts : 0; };
    const ordered = (list || []).slice().sort((a, b) => (ts(b) - ts(a)) || then(a, b));
    const first = ordered.filter(p => ts(p) > 0);
    const days = (changed && changed.window_days) || FRESH_DAYS;
    const order = S(opts.order) || 'oldest reading first';
    const note = !changed ? ''
      : !changed.read ? 'The pages we know changed could not be read in this run, so the order is the usual one: ' + order + '.'
        : first.length ? first.length + ' page(s) we submitted or wrote in the last ' + days + ' days are checked first ('
            + first.slice(0, 3).map(p => { const c = changeOf(changed, p.url); return pathOf(p.url) + ' ' + c.label + ' ' + c.at; }).join(', ')
            + (first.length > 3 ? ', ...' : '') + '), because a page that has just changed is the page most likely to have changed again.'
          : 'No page was submitted or written in the last ' + days + ' days, so the order is the usual one: ' + order + '.';
    return { ordered, first, note, changed_known: !!(changed && changed.read), changed_count: first.length };
  };
  // ---- G25: URL Inspection within the quota ----
  const QUOTA_PER_DAY = 2000;        // Search Console URL Inspection API, per property (developers.google.com/webmaster-tools/limits)
  const QUOTA_PER_MINUTE = 600;      // the same page, per property
  const PER_RUN = 150;               // what one weekly Site Tracker run spends per property: 7.5% of the day's quota
  const PER_AUDIT = 100;             // what one audit spends (it also runs on demand, several times a day on a bad day)
  /**
   * Chooses which pages to inspect now: never inspected first, then the oldest inspection, importance breaking ties. Everything the
   * budget does not reach comes back under `skipped` so the report can say "not checked" instead of implying the page is fine.
   * pages: [{ url, weight, inspect_at }]; cap: how many this run may spend.
   */
  const inspectBudget = (pages, cap, o) => {
    const opts = o || {};
    const limit = Math.max(0, Math.min(n0(cap) || PER_RUN, QUOTA_PER_DAY - n0(opts.used)));
    const seen = new Set(); const list = [];
    for (const p of (pages || [])) { const k = ukey(p.url); if (!S(p.url) || seen.has(k)) continue; seen.add(k); list.push(p); }
    const ts = (p) => { const t = Date.parse(S(p.inspect_at)); return Number.isFinite(t) ? t : 0; };   // 0 = never inspected, so it goes first
    // B5-8 (2026-10-15): a page we submitted to IndexNow or wrote this week goes in front of the rotation - it is the one most likely
    // to have changed since Google last looked. Without that signal (or when it could not be read) the order is exactly what it was.
    const fresh = freshFirst(list, opts.changed || null,
      { then: (a, b) => ts(a) - ts(b) || n0(b.weight) - n0(a.weight) || S(a.url).localeCompare(S(b.url)), order: 'oldest inspection first' });
    const ordered = fresh.ordered;
    const take = ordered.slice(0, limit), skipped = ordered.slice(limit);
    return { take, skipped, limit, quota: QUOTA_PER_DAY, changed_first: fresh.changed_count, changed_known: fresh.changed_known, order_note: fresh.note,
      note: 'URL Inspection is capped at ' + QUOTA_PER_DAY + ' pages a day per Search Console property (Google\'s quota); this run asked about '
        + take.length + ' of ' + ordered.length + ' key pages, oldest inspection first'
        + (skipped.length ? ', so ' + skipped.length + ' are reported as "not checked" until the next run.' : '.')
        + (fresh.note ? ' ' + fresh.note : '') };
  };
  /** One URL Inspection answer -> what Google thinks. A permission or quota error is an error, never "not indexed". */
  const inspection = (res) => {
    const r = res || {};
    const ir = (r.inspectionResult || {});
    const idx = ir.indexStatusResult || null;
    const mob = ir.mobileUsabilityResult || null;
    const rich = ir.richResultsResult || null;
    const gErr = () => { const e = r.error; if (!e) return ''; if (typeof e === 'string') return e.slice(0, 200); const ctx = (e.context && e.context.data) || {}; const inner = (ctx.error && typeof ctx.error === 'object') ? ctx.error : null; return S((inner && inner.message) || e.message || e.description || e.status || JSON.stringify(e)).slice(0, 200); };
    const err = r.error ? gErr() : (idx ? '' : 'no inspection result');
    const quota = /quota|rate limit|RESOURCE_EXHAUSTED|429/i.test(err);
    const denied = /permission|forbidden|403|unauthor|invalid_grant/i.test(err);
    if (err) return { ok: false, error: err, error_kind: quota ? 'quota' : denied ? 'access' : 'error', indexed: null, verdict: '', coverage: '',
      robots: '', last_crawl: '', google_canonical: '', user_canonical: '', canonical_ok: null, canonical_host_only: false, mobile_usable: null, mobile_issues: [], mobile_verdict: '', mobile_note: '', rich_results: [], rich_verdict: '',
      not_checked: quota ? 'Google\'s daily URL Inspection quota for this property is used up: not checked today.' : denied ? 'Search Console access is missing for this property: not checked.' : 'The inspection failed: not checked (' + err + ').' };
    // R10 (2026-10-13, re-rating §3.11): Google retired the Mobile Usability report and the API now answers `VERDICT_UNSPECIFIED` with no
    // issue list for every page (45 of 45 live on 2026-10-13). That is NOT CHECKED. The live run read it as "not mobile-friendly" and raised
    // a High finding on 45 of 47 pages with empty evidence, ranked second of 60. Only a FAIL that names at least one issue is a real problem;
    // every other answer (unspecified, neutral, missing, a FAIL with nothing behind it) is unknown, with the reason said out loud.
    const mobVerdict = S(mob && mob.verdict).toUpperCase();
    const mobIssues = mob && Array.isArray(mob.issues) ? mob.issues.map(i => S(i.message) || S(i.issueType)).filter(Boolean).slice(0, 5) : [];
    const mobUsable = mobVerdict === 'PASS' ? true : (mobVerdict === 'FAIL' && mobIssues.length) ? false : null;
    const mobNote = mobUsable !== null ? ''
      : (mobVerdict === 'FAIL' ? 'Search Console reports a mobile problem without naming an issue, so mobile usability was not checked.'
        : mobVerdict === 'NEUTRAL' ? 'Search Console gave no mobile verdict for this page, so mobile usability was not checked.'
          : 'Search Console no longer answers mobile usability (Google retired the Mobile Usability report), so it was not checked.');
    return {
      ok: true, error: '', error_kind: '', verdict: S(idx.verdict), indexed: S(idx.verdict) === 'PASS', coverage: S(idx.coverageState),
      indexing_state: S(idx.indexingState), robots: S(idx.robotsTxtState), last_crawl: S(idx.lastCrawlTime),
      google_canonical: S(idx.googleCanonical), user_canonical: S(idx.userCanonical),
      // R59 (2026-10-16): Google choosing the SAME page on the OTHER host (https://techand.ai/x for our https://www.techand.ai/x) is a
      // canonical Google did not take — `same` is host-agnostic on purpose (crawls and sitemaps disagree about www), so it called this "same
      // as ours" and the daily watch could never see the split. The host is compared here, and a host-only difference is named.
      canonical_ok: (!S(idx.googleCanonical) || !S(idx.userCanonical)) ? null : (same(idx.googleCanonical, idx.userCanonical) && hostOf(idx.googleCanonical) === hostOf(idx.userCanonical)),
      canonical_host_only: !!S(idx.googleCanonical) && !!S(idx.userCanonical) && same(idx.googleCanonical, idx.userCanonical) && hostOf(idx.googleCanonical) !== hostOf(idx.userCanonical),
      mobile_usable: mobUsable, mobile_issues: mobIssues, mobile_verdict: mobVerdict, mobile_note: mobNote,
      rich_verdict: rich ? S(rich.verdict) : '',
      rich_results: rich && rich.detectedItems ? rich.detectedItems.map(d => S(d.richResultType)).filter(Boolean) : [],
      not_checked: '',
    };
  };
  /** The index picture over a set of inspections, with what was not checked said out loud (G25). */
  const coverage = (inspections, o) => {
    const opts = o || {};
    const list = (inspections || []).filter(Boolean);
    const ok = list.filter(i => i.ok !== false && !i.error);
    const by = {}; for (const i of ok) { const k = S(i.coverage) || S(i.verdict) || 'unknown'; by[k] = (by[k] || 0) + 1; }
    const failed = list.filter(i => i.ok === false || i.error);
    const indexed = ok.filter(i => i.indexed === true).length;
    const notIndexed = ok.filter(i => i.indexed === false);
    const canonMismatch = ok.filter(i => i.canonical_ok === false);
    const mobileBad = ok.filter(i => i.mobile_usable === false);
    const richTypes = [...new Set(ok.flatMap(i => i.rich_results || []))];
    const notChecked = n0(opts.not_checked) + failed.length;
    // R10: mobile usability is reported on its own terms — how many pages Google really answered about, and the reason when it answered about none
    const mobileChecked = ok.filter(i => i.mobile_usable !== null).length;
    const mobileNote = (ok.length && !mobileChecked)
      ? (S((ok.find(i => S(i.mobile_note)) || {}).mobile_note) || 'Search Console no longer answers mobile usability (Google retired the Mobile Usability report), so it was not checked.')
      : '';
    return { checked: ok.length, indexed, not_indexed: notIndexed.length, by_state: by, failed: failed.length, not_checked: notChecked,
      not_checked_reason: notChecked ? (S(opts.not_checked_reason) || (failed[0] && failed[0].not_checked) || 'not checked in this run') : '',
      canonical_mismatch: canonMismatch.length, mobile_bad: mobileBad.length, mobile_checked: mobileChecked,
      mobile_not_checked: ok.length - mobileChecked, mobile_note: mobileNote,
      rich_results: richTypes, quota: QUOTA_PER_DAY, quota_note: S(opts.quota_note),
      // never "fine": a page nobody inspected is counted apart from the ones Google answered about
      text: ok.length
        ? indexed + ' of ' + ok.length + ' key pages are indexed' + (notIndexed.length ? ', ' + notIndexed.length + ' are not' : '')
          + (notChecked ? ', ' + notChecked + ' were not checked' : '') + ' (Search Console URL Inspection; quota ' + QUOTA_PER_DAY + ' pages a day per property)'
        : 'No page could be inspected in Search Console' + (notChecked ? ' (' + notChecked + ' not checked: ' + (S(opts.not_checked_reason) || (failed[0] && failed[0].not_checked) || 'no access') + ')' : '') };
  };

  return { signals, robotsRead, compare, robotsChange, state, worst, recheck, recheckRule, inspectBudget, inspection, coverage, hash,
    changedPages, changeOf, freshFirst,
    CODES, RULES, QUOTA_PER_DAY, QUOTA_PER_MINUTE, PER_RUN, PER_AUDIT, FRESH_DAYS,
    helpers: { hostOf, bare, pathOf, ukey, same, strip, S, n0 } };
})();
// ---- Index coverage (2026-10-29, docs/indexing-2026-10-29/DESIGN.md): which pages Google left out, why, and what to do ----
// Pure functions only (no clock, no network, no table): every caller passes `now`, so the harness replays any day. Inlined by
// build_index_coverage.py into the nodes of SEO Agent - Index Coverage, AFTER the page-watch kit (PW): the URL Inspection answer is read with
// PW.inspection (one reading rule for every caller) and the raw page with PW.signals; the fields PW does not read (pageFetchState, crawledAs,
// referringUrls, sitemap) are read here from the same answer, so PW and its three callers are untouched.
// What this never does: claim a page "will be indexed", call "not checked" fine or not indexed, inspect more than its cap, or advise a fix
// for a page Google is right to leave out (alternates, redirects, intended noindex / robots blocks, removed pages, low-value listings).
// The n8n Code sandbox has no URL constructor and makes Object.defineProperty / setPrototypeOf no-ops: hosts and paths are read with regexes.
const IX = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const DAY = 864e5;
  const CFG = {
    cap_default: 300, cap_min: 20, cap_max: 1200,   // URL Inspection a site a day (Google: 2,000 a day per property, shared by every tool)
    quota_per_day: 2000,
    fetch_cap: 60,                                 // our own page reads a site a day (not-indexed pages only)
    sitemaps_max: 50, urls_max: 5000, pages_max: 6000,
    probe_per_site: 2,                             // inspections asked first; a quota / access answer stops the site's rest for the day
    new_days: 30, wait_days: 21, reuse_days: 3, lag_days: 3,
    new_schedule: [1, 3, 7, 14, 28],               // days after publish / first sight a new page is inspected
    recheck: [7, 14, 28],                          // a not-indexed page: 7, then 14, then every 28 days
    person_after: 4,                               // unchanged re-checks before a person is asked to look
    watch_days: 28, watch_quiet_days: 56, leave_out_days: 56, lost_recheck_days: 7, fetch_refresh_days: 7,
    freeze_max_days: 30,                           // a rollout still "open" in the feed after this many days no longer freezes anything
    impact_after_days: 7, impact_window_max: 28, impact_window_min: 7, impact_recent_days: 60, impact_min_impr: 50,
    impact_refresh_days: 7, impact_z: 1.96, impact_rel: 0.2,
    links_max: 5, dropped_max: 20, impact_pages_max: 30,
  };
  // ---- URLs: canonical host, host-agnostic keys, own host only ----
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
  const bare = (h) => S(h).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '');
  const pathOf = (u) => { const m = S(u).match(/^https?:\/\/[^\/?#]*([^?#]*)/i); return (m && m[1]) || '/'; };
  const queryOf = (u) => { const m = S(u).match(/^[^?#]*(\?[^#]*)/); return m && m[1] !== '?' ? m[1] : ''; };
  /** Host-agnostic identity: scheme, www, a trailing slash and the fragment do not make another page; the query does (a filter page is another page). */
  const key = (u) => {
    const s = S(u); if (!/^https?:\/\//i.test(s)) return '';
    const p = pathOf(s).replace(/\/+$/, '');
    return (bare(hostOf(s)) + p + queryOf(s)).toLowerCase();
  };
  const same = (a, b) => !!key(a) && key(a) === key(b);
  const decodeXml = (t) => S(t).replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
  /** The host every URL we store uses: the site model's canonical host when it is the same site (www or bare), else the bare domain. */
  const siteHost = (site) => {
    const ch = S((site || {}).canonical_host).toLowerCase().replace(/^https?:\/\//, '').replace(/[\/?#:].*$/, '');
    return ch && bare(ch) === bare((site || {}).domain) ? ch : bare((site || {}).domain);
  };
  const own = (u, site) => !!hostOf(u) && bare(hostOf(u)) === bare((site || {}).domain);
  /** The absolute URL on the site's canonical host, or '' for another host / not a page. Relative paths are resolved against the site. */
  const norm = (u, site) => {
    let s = decodeXml(u).replace(/#.*$/, '');
    if (!s) return '';
    if (/^\/\//.test(s)) s = 'https:' + s;
    if (/^\//.test(s)) s = 'https://' + siteHost(site) + s;
    if (!/^https?:\/\//i.test(s) || !own(s, site)) return '';
    const p = pathOf(s), q = queryOf(s);
    if (ASSET.test(p)) return '';
    return 'https://' + siteHost(site) + (p || '/') + q;
  };
  const ASSET = /\.(?:jpe?g|png|gif|webp|avif|svg|ico|bmp|css|js|mjs|json|xml|gz|zip|rar|7z|mp4|mov|webm|mp3|wav|woff2?|ttf|eot|txt|rss|atom)$/i;
  const depth = (u) => pathOf(u).split('/').filter(Boolean).length;

  // ---- low-value addresses: never forced into the index ----
  const LOW_VALUE = [
    /\/(?:tag|tags|category|categories|author|authors|archive|archives)(?:\/|$)/i,
    /\/page\/\d+\/?$/i,
    /\/(?:search|cart|basket|checkout|login|log-in|signin|sign-in|signup|sign-up|register|account|my-account|wp-admin|wp-login\.php|feed|rss)(?:\/|$)/i,
    /[?&](?:s|q|search|query|filter|filters|sort|orderby|order|page|paged|replytocom|add-to-cart|utm_[a-z]+|fbclid|gclid|ref|sessionid|sid)=/i,
    /\/\d{4}\/\d{2}\/?$/,   // date archives (/2025/03/)
  ];
  const isLowValue = (u) => LOW_VALUE.some(rx => rx.test(pathOf(u) + queryOf(u)));

  // ---- sitemaps: robots.txt Sitemap lines, urlset + sitemapindex, caps ----
  const robotsSitemaps = (text) => (S(text).match(/^[ \t]*sitemap[ \t]*:[ \t]*(\S+)/gim) || []).map(l => l.replace(/^[ \t]*sitemap[ \t]*:[ \t]*/i, '').trim()).filter(Boolean);
  const MOD_RX = /<((?:[A-Za-z][\w-]*:)?)lastmod\s*>([\s\S]*?)<\/\1lastmod\s*>/i;
  const firstLoc = (block) => {
    const rx = /<((?:[A-Za-z][\w-]*:)?)loc\s*>([\s\S]*?)<\/\1loc\s*>/gi; let m;
    while ((m = rx.exec(block))) { if (!/^(?:image|video|news|xhtml):$/i.test(m[1])) return decodeXml(m[2]); }
    return '';
  };
  /** One sitemap document -> { kind: 'urlset' | 'index' | 'unknown', urls: [{loc, lastmod}], sitemaps: [{loc, lastmod}] }. */
  const parseSitemap = (xml) => {
    const t = S(xml);
    const isIndex = /<(?:[A-Za-z][\w-]*:)?sitemapindex\b/i.test(t), isSet = /<(?:[A-Za-z][\w-]*:)?urlset\b/i.test(t);
    if (!isIndex && !isSet) return { kind: 'unknown', urls: [], sitemaps: [] };
    const tag = isIndex ? 'sitemap' : 'url';
    const rx = new RegExp('<((?:[A-Za-z][\\w-]*:)?)' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/\\1' + tag + '\\s*>', 'gi');
    const list = []; let m;
    while ((m = rx.exec(t))) {
      const loc = firstLoc(m[2]); if (!loc) continue;
      const lm = m[2].match(MOD_RX);
      list.push({ loc, lastmod: lm ? decodeXml(lm[2]).slice(0, 25) : '' });
    }
    return isIndex ? { kind: 'index', urls: [], sitemaps: list } : { kind: 'urlset', urls: list, sitemaps: [] };
  };
  /** The roots of one site's sitemap tree: robots.txt lines, /sitemap.xml and the sitemaps submitted in Search Console (own host only). */
  const sitemapRoots = (site, robotsText, gscPaths) => {
    const seen = new Set(), out = [];
    const add = (u, from) => { const s = decodeXml(u); if (!/^https?:\/\//i.test(s) || !own(s, site)) return; const k = key(s); if (seen.has(k)) return; seen.add(k); out.push({ url: s, from }); };
    for (const u of robotsSitemaps(robotsText)) add(u, 'robots');
    add('https://' + siteHost(site) + '/sitemap.xml', 'default');
    for (const u of (gscPaths || [])) add(u, 'gsc');
    return out;
  };
  /**
   * Accumulates one round of sitemap answers into the site's state. state: { fetched: [key], urls: [{loc, lastmod, gsc}], next: [], errors: [],
   * gsc_keys: [key of the sitemaps submitted in Search Console], read: n }. Children of an index go to `next`, bounded by sitemaps_max.
   */
  const sitemapAccept = (state, asked, res, site) => {
    const st = state; const r = res || {};
    const status = n0(r.statusCode ?? r.status); const body = S(r.body ?? r.data);
    st.fetched = st.fetched || []; st.urls = st.urls || []; st.next = st.next || []; st.errors = st.errors || []; st.read = n0(st.read);
    const k = key(asked.url); if (!st.fetched.includes(k)) st.fetched.push(k);
    if (/\.gz$/i.test(pathOf(asked.url))) { st.errors.push({ url: asked.url, error: 'compressed sitemap (.gz) not read' }); return st; }
    if (!status || status >= 400 || !body) { if (asked.from !== 'default' || status !== 404) st.errors.push({ url: asked.url, error: status ? 'answered ' + status : S((r.error && (r.error.message || r.error)) || 'no answer').slice(0, 120) }); return st; }
    const doc = parseSitemap(body);
    if (doc.kind === 'unknown') { st.errors.push({ url: asked.url, error: 'not a sitemap (no urlset / sitemapindex)' }); return st; }
    st.read++;
    const fromGsc = asked.from === 'gsc' || !!asked.gsc;
    const have = new Set(st.urls.map(x => key(x.loc)));
    for (const u of doc.urls) {
      if (st.urls.length >= CFG.urls_max) { st.capped = true; break; }
      const loc = norm(u.loc, site); if (!loc) continue;
      const kk = key(loc);
      if (have.has(kk)) { if (fromGsc) { const x = st.urls.find(y => key(y.loc) === kk); if (x) x.gsc = true; } continue; }
      have.add(kk); st.urls.push({ loc, lastmod: u.lastmod, gsc: fromGsc });
    }
    const queued = new Set(st.next.map(x => key(x.url)));
    for (const c of doc.sitemaps) {
      const cu = decodeXml(c.loc); if (!/^https?:\/\//i.test(cu) || !own(cu, site)) continue;
      const ck = key(cu); if (st.fetched.includes(ck) || queued.has(ck)) continue;
      if (st.fetched.length + st.next.length >= CFG.sitemaps_max) { st.capped_sitemaps = true; break; }
      queued.add(ck); st.next.push({ url: cu, from: fromGsc ? 'gsc' : 'child', lastmod: c.lastmod });
    }
    return st;
  };

  // ---- Search Console: what the [page, date] rows of the last 90 days say, per page ----
  const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
  /** rows: Search Analytics rows with keys [page, date]. Windows are counted back from the newest day in the data (Search Console lags ~3 days). */
  const searchEvidence = (rows, site, o) => {
    const opts = o || {};
    const list = (rows || []).filter(r => r && Array.isArray(r.keys) && r.keys.length >= 2);
    let end = ''; for (const r of list) if (S(r.keys[1]) > end) end = S(r.keys[1]);
    if (!end) end = opts.now ? isoDay(n0(opts.now) - CFG.lag_days * DAY) : '';
    const endMs = Date.parse(end + 'T00:00:00Z');
    const since = (d) => Number.isFinite(endMs) ? isoDay(endMs - (d - 1) * DAY) : '';
    const s28 = since(28), s14 = since(14), s7 = since(7);
    const by = new Map();
    for (const r of list) {
      const loc = norm(r.keys[0], site); if (!loc) continue;
      const k = key(loc); const d = S(r.keys[1]); const imp = n0(r.impressions), cl = n0(r.clicks);
      const e = by.get(k) || { url: loc, impr28: 0, clicks28: 0, impr14: 0, impr7: 0, impr_before: 0, impr90: 0, last_at: '' };
      e.impr90 += imp;
      if (d >= s28) { e.impr28 += imp; e.clicks28 += cl; }
      if (d >= s14) e.impr14 += imp; else e.impr_before += imp;
      if (d >= s7) e.impr7 += imp;
      if (imp > 0 && d > e.last_at) e.last_at = d;
      by.set(k, e);
    }
    return { by, end, rows: list.length, truncated: list.length >= n0(opts.row_limit || 25000) };
  };

  // ---- the URL Inspection answer: PW's reading plus the fields PW leaves out ----
  const readInspection = (res) => {
    const base = (typeof PW !== 'undefined') ? PW.inspection(res) : { ok: false, error: 'page-watch kit missing', error_kind: 'error' };
    const idx = (((res || {}).inspectionResult || {}).indexStatusResult) || {};
    if (!base.ok) return { ...base, page_fetch_state: '', crawled_as: '', referring_count: 0, google_sitemaps: 0 };
    return { ...base, page_fetch_state: S(idx.pageFetchState), crawled_as: S(idx.crawledAs),
      referring_count: Array.isArray(idx.referringUrls) ? idx.referringUrls.length : 0,
      google_sitemaps: Array.isArray(idx.sitemap) ? idx.sitemap.length : 0,
      link: S(((res || {}).inspectionResult || {}).inspectionResultLink) };
  };
  /** A Site Tracker reading of the same URL (seo_page_watch) within reuse_days, or null. It carries only verdict / coverage / canonical / crawl. */
  const reuseOf = (watch, now) => {
    const w = watch || null; if (!w) return null;
    const at = Date.parse(S(w.inspect_at)); if (!Number.isFinite(at) || n0(now) - at > CFG.reuse_days * DAY || S(w.inspect_error)) return null;
    if (!S(w.index_state) && !S(w.coverage)) return null;
    return { ok: true, at: new Date(at).toISOString(), verdict: S(w.index_state), indexed: S(w.index_state) === 'PASS' || S(w.indexed) === 'yes', coverage: S(w.coverage),
      indexing_state: '', robots: '', page_fetch_state: '', crawled_as: '', google_canonical: S(w.google_canonical), user_canonical: '', last_crawl: S(w.last_crawl),
      referring_count: 0, google_sitemaps: 0, reused: true };
  };
  /** The reading stored on the row (an earlier inspection), so a page fetched again without a new inspection is judged on the same answer. */
  const storedReading = (row) => {
    const r = row || {}; if (!S(r.inspect_at) || (!S(r.verdict) && !S(r.coverage))) return null;
    return { ok: true, at: S(r.inspect_at), verdict: S(r.verdict), indexed: S(r.verdict) === 'PASS', coverage: S(r.coverage), indexing_state: S(r.indexing_state),
      robots: S(r.robots_state), page_fetch_state: S(r.page_fetch_state), crawled_as: S(r.crawled_as), google_canonical: S(r.google_canonical),
      user_canonical: S(r.user_canonical), last_crawl: S(r.last_crawl), referring_count: n0(r.referring_count), google_sitemaps: n0(r.google_sitemaps), stored: true };
  };

  // ---- our own read of the page ----
  const mainWords = (html) => {
    let h = S(html);
    const pick = h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || h.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) || h.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    h = pick ? pick[1] : h;
    h = h.replace(/<(script|style|noscript|svg|template|nav|header|footer|form|iframe)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
    return (h.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  };
  /**
   * first: the answer of a GET that did NOT follow redirects; final: the answer with redirects followed (only asked when `first` was a 3xx).
   * -> { ok, http_status, final_url, noindex ('meta' | 'header' | ''), page_canonical, words, title, error }
   */
  const readFetch = (url, first, final) => {
    const f = first || {}; const st1 = n0(f.statusCode ?? f.status);
    if (!st1) return { ok: false, http_status: 0, final_url: '', noindex: '', page_canonical: '', words: 0, title: '', error: S((f.error && (f.error.message || f.error)) || 'no answer').slice(0, 160) };
    const hdrs = f.headers || {}; const loc = S(hdrs.location || hdrs.Location);
    let final_url = '';
    if (st1 >= 300 && st1 < 400 && loc) {
      const abs = /^https?:\/\//i.test(loc) ? loc : /^\/\//.test(loc) ? 'https:' + loc : /^\//.test(loc) ? (S(url).match(/^https?:\/\/[^\/?#]+/i) || [''])[0] + loc : loc;
      if (!same(abs, url)) final_url = abs;   // a www / https / trailing-slash hop is the same page, not a redirect to another page
    }
    const use = (st1 >= 300 && st1 < 400 && final && n0(final.statusCode ?? final.status)) ? final : f;
    const sig = (typeof PW !== 'undefined') ? PW.signals(use) : { ok: false };
    const status = n0(use.statusCode ?? use.status) || st1;
    const body = S(use.body ?? use.data);
    const xr = (() => { const h = use.headers || {}; const k = Object.keys(h).find(x => x.toLowerCase() === 'x-robots-tag'); return k ? S(h[k]) : ''; })();
    const noindex = sig.ok && sig.noindex ? (/\bnone\b|\bnoindex\b/i.test(xr) && !/\bnone\b|\bnoindex\b/i.test(S(sig.robots_meta)) ? 'header' : 'meta') : '';
    return { ok: true, http_status: status, final_url, noindex,
      page_canonical: S(sig.canonical).slice(0, 500), words: status >= 200 && status < 300 ? mainWords(body) : 0, title: S(sig.title).slice(0, 300), error: '' };
  };

  // ---- causes -> actions -> states ----
  const ACTION = { indexed: 'none', indexed_not_in_sitemap: 'site_fix', wait_new: 'wait', unknown_to_google: 'links', not_in_sitemap: 'site_fix',
    discovered_not_crawled: 'links', crawled_not_indexed: 'quality', noindex: 'site_fix', noindex_intended: 'leave_out', robots_blocked: 'site_fix',
    robots_intended: 'leave_out', canonical_elsewhere: 'site_fix', alternate: 'leave_out', google_chose_other: 'duplicate', duplicate_no_canonical: 'duplicate',
    not_found: 'site_fix', soft_404: 'site_fix', server_error: 'site_fix', access_denied: 'site_fix', redirect: 'site_fix', low_value: 'leave_out',
    not_checked: 'none', unclassified: 'none' };
  const CAUSES = Object.keys(ACTION);
  const EXCLUDED = ['noindex', 'noindex_intended', 'robots_blocked', 'robots_intended', 'canonical_elsewhere', 'alternate', 'google_chose_other',
    'duplicate_no_canonical', 'not_found', 'redirect', 'low_value'];
  const SOFT = ['unknown_to_google', 'not_in_sitemap', 'discovered_not_crawled', 'crawled_not_indexed', 'unclassified', 'wait_new'];
  const stateOf = (cause) => (cause === '' || cause === 'indexed' || cause === 'indexed_not_in_sitemap') ? 'indexed' : cause === 'not_checked' ? 'error' : EXCLUDED.includes(cause) ? 'excluded' : 'not_indexed';
  const normCov = (c) => S(c).toLowerCase().replace(/[‘’'"`]/g, '').replace(/[–—-]+/g, '-').replace(/\s+/g, ' ').trim();
  const covCause = (c) => {
    const s = normCov(c);
    if (!s) return '';
    if (/^submitted and indexed$|^indexed, not submitted in sitemap$|^indexed, though blocked by robots\.txt$|^url is on google/.test(s)) return 'indexed';
    if (/unknown to google/.test(s)) return 'unknown';
    if (/^discovered - currently not indexed/.test(s)) return 'discovered_not_crawled';
    if (/^crawled - currently not indexed/.test(s)) return 'crawled_not_indexed';
    if (/^alternate page with proper canonical/.test(s)) return 'alternate';
    if (/^duplicate, google chose different canonical/.test(s) || /^duplicate, submitted url not selected as canonical/.test(s)) return 'google_chose_other';
    if (/^duplicate without user-selected canonical/.test(s)) return 'duplicate_no_canonical';
    if (/^page with redirect|^redirect error/.test(s)) return 'redirect';
    if (/^not found \(404\)|^submitted url not found/.test(s)) return 'not_found';
    if (/soft 404/.test(s)) return 'soft_404';
    if (/^server error/.test(s)) return 'server_error';
    if (/noindex/.test(s)) return 'noindex';
    if (/blocked by robots\.txt/.test(s)) return 'robots';
    if (/unauthorized request \(401\)|access forbidden \(403\)|other 4xx/.test(s)) return 'access_denied';
    return 'unclassified';
  };
  const ENUM_FETCH = { NOT_FOUND: 'not_found', SOFT_404: 'soft_404', SERVER_ERROR: 'server_error', ACCESS_DENIED: 'access_denied', ACCESS_FORBIDDEN: 'access_denied',
    BLOCKED_4XX: 'access_denied', REDIRECT_ERROR: 'redirect', BLOCKED_ROBOTS_TXT: 'robots' };

  /** Lane of one page: `new` = a page we wrote, or one that appeared in the site's sitemap after we started watching it, in the last new_days. */
  const laneOf = (p, ctx) => {
    const c = ctx || {}; const now = n0(c.now);
    if (S((p._prev || {}).lane) === 'existing') return 'existing';
    const anchor = anchorOf(p, c);
    return anchor && now - anchor <= CFG.new_days * DAY ? 'new' : 'existing';
  };
  const anchorOf = (p, c) => {
    const pub = Date.parse(S(p.published_at)); if (Number.isFinite(pub) && (p.sources || '').indexOf('ours') >= 0) return pub;
    const fs = Date.parse(S(p.first_seen_at)); const since = Date.parse(S((c || {}).watch_since));
    // on the first run every page is "first seen today": only a page that appeared AFTER the site's first reading is new by sight
    if (Number.isFinite(fs) && Number.isFinite(since) && isoDay(fs) > isoDay(since) && p.in_sitemap) return fs;
    return 0;
  };

  /**
   * One cause per page. Documented enum fields first (verdict, pageFetchState, indexingState, robotsTxtState, the canonicals), the coverageState
   * string second (Google documents no values for it), our own fetch third - except that a hard fact our fetch saw TODAY (404 / 410, 5xx, 401 / 403,
   * noindex, a redirect to another page) replaces a soft reason from an older crawl ("discovered", "crawled", "unknown").
   * reading: readInspection / reuseOf / storedReading (or null); fetch: readFetch (or null); p: the merged page (in_sitemap, sources, lane, ...).
   */
  const diagnose = (p, reading, fetch, ctx) => {
    const c = ctx || {}; const now = n0(c.now);
    const srcs = S(p.sources); const ours = srcs.indexOf('ours') >= 0;
    const hadImpr = !!S(p.last_impression_at) || n0(p.impressions_28d) > 0;
    const important = !!p.in_sitemap || ours || hadImpr;
    const r = reading || null; const f = fetch && fetch.ok ? fetch : null;
    const out = (cause, extra) => ({ cause, action: actionOf(cause, p, r, f), state: stateOf(cause), merge_into: '', ...(extra || {}) });
    let cause = '';
    if (r && r.ok === false) return out('not_checked', { not_checked: S(r.not_checked) || 'the inspection failed' });
    if (r) {
      if (S(r.verdict) === 'PASS' || covCause(r.coverage) === 'indexed') cause = 'indexed';
      if (!cause && ENUM_FETCH[S(r.page_fetch_state)]) cause = ENUM_FETCH[S(r.page_fetch_state)];
      if (!cause && /^BLOCKED_BY_(META_TAG|HTTP_HEADER)$/.test(S(r.indexing_state))) cause = 'noindex';
      if (!cause && S(r.robots) === 'DISALLOWED') cause = 'robots';
      if (!cause && S(r.user_canonical) && !same(r.user_canonical, p.url)) cause = p.in_sitemap ? 'canonical_elsewhere' : 'alternate';
      if (!cause && S(r.google_canonical) && !(same(r.google_canonical, p.url) && hostOf(r.google_canonical) === hostOf(p.url))) cause = S(r.user_canonical) ? 'google_chose_other' : 'duplicate_no_canonical';
      if (!cause) { const cc = covCause(r.coverage); cause = cc === 'unknown' ? (p.in_sitemap || ours ? 'unknown_to_google' : 'not_in_sitemap') : (cc || 'unclassified'); }
    }
    // our fetch: third, or a hard fact of today over a soft reason of an older crawl
    if (f && (!cause || SOFT.includes(cause))) {
      const st = n0(f.http_status);
      const hard = (st === 404 || st === 410) ? 'not_found' : st >= 500 ? 'server_error' : (st === 401 || st === 403) ? 'access_denied'
        : S(f.final_url) ? 'redirect' : f.noindex ? 'noindex' : (S(f.page_canonical) && !same(f.page_canonical, p.url)) ? (p.in_sitemap ? 'canonical_elsewhere' : 'alternate') : '';
      if (hard) cause = hard;
    }
    if (!cause) return null;   // nothing read: the caller keeps what was stored
    // what the client meant: a block on a page nobody lists, links to or found in Google is intended
    if (cause === 'noindex' && !important) cause = 'noindex_intended';
    if (cause === 'robots') cause = important ? 'robots_blocked' : 'robots_intended';
    if (cause === 'indexed' && !p.in_sitemap && !isLowValue(p.url) && c.sitemap_read !== false && c.has_sitemap) cause = 'indexed_not_in_sitemap';
    if (stateOf(cause) !== 'indexed' && isLowValue(p.url) && (SOFT.includes(cause) || cause === 'duplicate_no_canonical' || cause === 'google_chose_other')) cause = 'low_value';
    if ((cause === 'unknown_to_google' || cause === 'discovered_not_crawled') && p.lane === 'new') {
      const a = anchorOf(p, c); if (a && now - a <= CFG.wait_days * DAY) cause = 'wait_new';
    }
    if (cause === 'indexed') cause = '';
    const merge_into = (cause === 'google_chose_other' || cause === 'duplicate_no_canonical') && r && S(r.google_canonical) ? S(r.google_canonical) : '';
    return { ...out(cause), merge_into, host_only: !!(merge_into && same(merge_into, p.url) && hostOf(merge_into) !== hostOf(p.url)) };
  };
  const actionOf = (cause, p, r, f) => {
    if (cause === 'not_found') { const linked = r && n0(r.referring_count) > 0; return (p.in_sitemap || !!S(p.last_impression_at) || n0(p.impressions_28d) > 0 || linked) ? 'site_fix' : 'leave_out'; }
    if (cause === 'redirect') return p.in_sitemap ? 'site_fix' : 'leave_out';
    return ACTION[cause] || 'none';
  };

  // ---- the client sentence: what it means and what to do (plain words; never "will be indexed", never "guaranteed") ----
  const pathLabel = (u) => { const h = hostOf(u); return h ? h + pathOf(u) : S(u); };
  const noteOf = (row, ctx) => {
    const c = ctx || {}; const cause = S(row.cause); const st = n0(row.http_status);
    const freeze = c.freeze && c.freeze.freeze;
    const T = {
      '': 'Google has this page in its index.',
      indexed_not_in_sitemap: 'Google has this page, but your sitemap does not list it. Add it to the sitemap so Google keeps finding it.',
      wait_new: 'This page is new and Google has not crawled it yet, which is normal in the first weeks. We check it again on a schedule.',
      unknown_to_google: 'Google does not know this page yet. Link to it from pages Google already has and keep it in your sitemap.',
      not_in_sitemap: 'Google does not know this page and your sitemap does not list it. Add it to the sitemap and link to it from your other pages.',
      discovered_not_crawled: 'Google has found this page but has not crawled it yet. Links from your pages that Google already has help it decide to crawl it.',
      crawled_not_indexed: freeze
        ? 'Google read this page and chose not to add it for now. Google is rolling out an update (' + S(c.freeze.title) + '), so wait until it finishes before changing this page.'
        : 'Google read this page and chose not to add it for now. That is usually about how useful the page looks next to similar pages. Improving the page is the step that helps; we suggest it one page at a time and you approve it.',
      noindex: 'The page tells search engines not to index it (' + (S(row.noindex) === 'header' ? 'in an HTTP header' : 'in a meta tag') + '). Remove the noindex if you want this page in Google.',
      noindex_intended: 'The page asks search engines not to index it, and nothing points to it, so that looks intended. Nothing to do.',
      robots_blocked: 'Your robots.txt stops Google from crawling this page. Allow it in robots.txt if you want this page in Google.',
      robots_intended: 'Your robots.txt blocks this page and nothing points to it, so that looks intended. Nothing to do.',
      canonical_elsewhere: 'Your sitemap lists this address, but the page names another address as its main version. List the main version in the sitemap instead.',
      alternate: 'This address points Google to another page as its main version. That is normal. Nothing to do.',
      google_chose_other: row.host_only
        ? 'Google keeps this page under your other address (' + pathLabel(row.merge_into) + '). Make one address of your site redirect to the other so Google keeps one.'
        : 'Google treats this page as a copy of ' + pathLabel(row.merge_into) + ' and shows that one instead. Merge the two pages, or make this one clearly different.',
      duplicate_no_canonical: 'Google sees this page as a copy of another page' + (S(row.merge_into) ? ' (' + pathLabel(row.merge_into) + ')' : '') + '. Point it to the main version with a canonical tag, or make it clearly different.',
      not_found: S(row.action) === 'site_fix'
        ? 'This address answers "not found"' + (st ? ' (' + st + ')' : '') + ', but your sitemap still lists it or people found it in Google. Redirect it to the closest live page, or take it out of the sitemap.'
        : 'This address no longer exists and nothing points to it. Nothing to do.',
      soft_404: 'Google thinks this page looks empty or like an error page. Add real content, or answer "not found" if the page is gone.',
      server_error: 'Your server answered with an error when this page was read' + (st >= 500 ? ' (' + st + ')' : '') + '. Check the server or the hosting.',
      access_denied: 'This page asks for a login or turns visitors away' + (st === 401 || st === 403 ? ' (' + st + ')' : '') + ', so Google cannot read it. Open it to everyone if you want it in Google.',
      redirect: S(row.action) === 'site_fix'
        ? 'This address redirects' + (S(row.final_url) ? ' to ' + pathLabel(row.final_url) : '') + '. List the final address in your sitemap instead.'
        : 'This address redirects to another page. That is normal. Nothing to do.',
      low_value: 'This is a listing, filter, search or account page that does not need to be in Google. Nothing to do.',
      not_checked: 'We could not check this page today' + (S(row._why) ? ' (' + S(row._why).replace(/[.:]+$/, '') + ')' : '') + '. We try again on the next run.',
      unclassified: 'Google gave a reason we do not recognise ("' + S(row.coverage).slice(0, 80) + '"). Check this address in Search Console.',
    };
    let s = Object.prototype.hasOwnProperty.call(T, cause) ? T[cause] : 'We have not checked this page yet.';
    if (S(row.state) === 'unknown') s = 'We have not checked this page with Google yet. It is in the queue.';
    if (row.needs_person) s += ' We have checked it ' + CFG.person_after + ' times with no change, so it needs a person to look at it.';
    return s.replace(/[—–]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...');
  };

  // ---- every page we know for one website ----
  /**
   * c: { site, now, stored (seo_index_pages rows), inventory (seo_pages rows), sitemap: { read, urls: [{loc, lastmod, gsc}] }, ours: [{url, published_at}],
   * search: searchEvidence() result + { read }, watch: seo_page_watch rows }. A source that could not be read this run keeps what was stored (a
   * failed sitemap read never turns pages into "not in the sitemap"; a failed Search Console read never erases impressions). The stored URL is
   * the row's identity and is kept as it is. Pages with impressions in the last 28 days of data and no reading yet are indexed by that evidence
   * (no quota spent); a stored "not indexed" reading older than the page's last impression is replaced by the same evidence.
   */
  const merge = (c) => {
    const site = c.site || {}; const now = n0(c.now); const nowIso = new Date(now).toISOString();
    const pages = new Map(); const order = [];
    // a stored row keeps its URL exactly (it is the row's key); every other source is put on the canonical host
    const get = (u, asStored) => { const loc = asStored ? (own(u, site) ? S(u) : '') : norm(u, site); if (!loc) return null; const k = key(loc); let p = pages.get(k);
      if (!p) { if (pages.size >= CFG.pages_max) return null; p = { url: loc, _src: new Set() }; pages.set(k, p); order.push(k); } return p; };
    for (const r of (c.stored || [])) { if (!r || !S(r.url)) continue; const p = get(S(r.url), true); if (!p) continue; p._prev = r; p.url = S(r.url); }
    const sm = c.sitemap || { read: false, urls: [] };
    for (const o of (c.ours || [])) { const p = get(o.url); if (p) { p._src.add('ours'); if (S(o.published_at) && (!S(p._pub) || S(o.published_at) < S(p._pub))) p._pub = S(o.published_at); } }
    for (const u of (sm.urls || [])) { const p = get(u.loc); if (!p) continue; p._src.add('sitemap'); if (u.gsc) p._src.add('gsc'); p._lastmod = S(u.lastmod) || S(p._lastmod); p._insm = true; }
    const sr = c.search || { read: false, by: new Map() };
    if (sr.by) for (const e of sr.by.values()) { if (!(e.impr90 > 0)) continue; const p = get(e.url); if (p) { p._src.add('search'); p._search = e; } }
    for (const r of (c.inventory || [])) { if (!r || !S(r.url)) continue; const p = get(r.url); if (!p) continue; p._src.add('inventory'); p._inv = r; }
    const watch = new Map(); for (const w of (c.watch || [])) if (w && S(w.url)) watch.set(key(w.url), w);
    let since = ''; for (const r of (c.stored || [])) if (S(r.first_seen_at) && (!since || S(r.first_seen_at) < since)) since = S(r.first_seen_at);
    const ctx = { now, watch_since: since || nowIso };
    const out = [];
    for (const k of order) {
      const p = pages.get(k); const prev = p._prev || {};
      const src = new Set(p._src);
      if (!sm.read) for (const x of ['sitemap', 'gsc']) if (S(prev.sources).split(',').includes(x)) src.add(x);
      if (!sr.read && S(prev.sources).split(',').includes('search')) src.add('search');
      const ev = sr.read ? (p._search || { impr28: 0, clicks28: 0, impr14: 0, impr7: 0, impr_before: 0, impr90: 0, last_at: '' }) : null;
      const inv = p._inv || {};
      const row = { ...prev, site_id: S(site.site_id), domain: bare(site.domain), url: p.url,
        sources: ['sitemap', 'gsc', 'inventory', 'ours', 'search'].filter(x => src.has(x)).join(','),
        in_sitemap: sm.read ? !!p._insm : (prev.in_sitemap === true || prev.in_sitemap === 'true'),
        sitemap_lastmod: sm.read ? S(p._lastmod) : S(prev.sitemap_lastmod),
        first_seen_at: S(prev.first_seen_at) || nowIso,
        published_at: S(p._pub) || S(prev.published_at),
        impressions_28d: ev ? ev.impr28 : n0(prev.impressions_28d), clicks_28d: ev ? ev.clicks28 : n0(prev.clicks_28d),
        last_impression_at: ev ? S(ev.last_at) : S(prev.last_impression_at),
        title: S(prev.title) || S(inv.title).slice(0, 300),
        http_status: n0(prev.http_status) || (n0(inv.http_status) >= 400 ? n0(inv.http_status) : 0),
        state: S(prev.state) || 'unknown', checks: n0(prev.checks),
        _prev: p._prev || null, _search: ev, _impr7: ev ? ev.impr7 : 0, _watch: watch.get(key(p.url)) || null };
      row.lane = laneOf(row, ctx);
      // evidence without quota: impressions in the last 28 days of data and no newer inspection saying otherwise
      if (ev && ev.impr28 > 0 && (row.state === 'unknown' || row.state === 'error' || (row.state !== 'indexed' && S(ev.last_at) > S(row.inspect_at).slice(0, 10)))) {
        row._search_flip = row.state !== 'unknown';
        Object.assign(row, { state: 'indexed', evidence: 'search', cause: (!row.in_sitemap && sm.read && (sm.urls || []).length && !isLowValue(row.url)) ? 'indexed_not_in_sitemap' : '', action: '', dropped_at: S(prev.dropped_at) });
        row.action = ACTION[row.cause] || 'none';
        row.indexed_since = S(prev.state) === 'indexed' ? (S(prev.indexed_since) || nowIso) : nowIso;
        row.next_check_at = nextCheck(row, ctx);
        row._evidence_search = true;
      }
      out.push(row);
    }
    return { pages: out, watch_since: ctx.watch_since, capped: pages.size >= CFG.pages_max };
  };

  // ---- the plan: which pages to inspect today, inside the cap ----
  const capOf = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? Math.min(CFG.cap_max, Math.max(CFG.cap_min, n)) : CFG.cap_default; };
  const ts = (v) => { const t = Date.parse(S(v)); return Number.isFinite(t) ? t : 0; };
  const isGone = (p) => S(p.cause) === 'not_found' && (n0(p.http_status) === 404 || n0(p.http_status) === 410) && !p.in_sitemap;
  /**
   * pages: merged pages (with `_prev`, `_search`, `_reuse`); o: { cap, used_today, now, stop }. Order (DESIGN §3): 1 new pages on day 1/3/7/14/28,
   * 2 indexed pages that lost every impression in the last 14 days, 3 never-inspected existing pages (sitemap first, then Search Console pages,
   * shallower first, newer lastmod first), 4 not-indexed pages due a re-check, 5 indexed pages due a watch. Returns { take, limit, backlog_left, by_bucket }.
   */
  const plan = (pages, o) => {
    const opts = o || {}; const now = n0(opts.now);
    const limit = opts.stop ? 0 : Math.max(0, Math.min(capOf(opts.cap), CFG.quota_per_day) - n0(opts.used_today));
    const due = [];
    for (const p of (pages || [])) {
      if (p._reuse || isGone(p)) continue;
      const last = ts(p.inspect_at); const next = ts(p.next_check_at);
      const state = S(p.state) || 'unknown';
      const ev = p._search || null;
      let bucket = 0;
      if (p.lane === 'new' && state !== 'indexed') {
        const a = anchorOf(p, opts); const age = a ? (now - a) / DAY : -1;
        const m = CFG.new_schedule.filter(d => d <= age).pop();
        if (m !== undefined && last < a + m * DAY) bucket = 1;
      }
      if (!bucket && state === 'indexed' && ev && opts.search_read !== false && ev.impr14 === 0 && ev.impr_before > 0 && now - last >= CFG.lost_recheck_days * DAY) bucket = 2;
      if (!bucket && state === 'unknown' && !last) bucket = 3;
      if (!bucket && (state === 'not_indexed' || state === 'excluded' || state === 'error') && (!next || next <= now)) bucket = 4;
      if (!bucket && state === 'indexed' && (!next || next <= now)) bucket = 5;
      if (bucket) due.push({ p, bucket });
    }
    const srcRank = (p) => (p.in_sitemap ? 0 : (S(p.sources).indexOf('search') >= 0 || S(p.sources).indexOf('gsc') >= 0) ? 1 : 2);
    due.sort((a, b) => a.bucket - b.bucket
      || (a.bucket === 3 ? (srcRank(a.p) - srcRank(b.p)) || (depth(a.p.url) - depth(b.p.url)) || (S(b.p.sitemap_lastmod).localeCompare(S(a.p.sitemap_lastmod))) : 0)
      || (ts(a.p.next_check_at) - ts(b.p.next_check_at)) || S(a.p.url).localeCompare(S(b.p.url)));
    const take = due.slice(0, limit).map(d => ({ ...d.p, _bucket: d.bucket }));
    const taken = new Set(take.map(p => key(p.url)));
    const backlog_left = (pages || []).filter(p => (S(p.state) || 'unknown') === 'unknown' && !p._reuse && !(p._search && p._search.impr28 > 0) && !taken.has(key(p.url))).length;
    const by_bucket = {}; for (const d of due) by_bucket[d.bucket] = (by_bucket[d.bucket] || 0) + 1;
    return { take, limit, due: due.length, backlog_left, by_bucket };
  };
  /** When the planner may inspect the page again (DESIGN §3), from the row as it is after this run. */
  const nextCheck = (row, ctx) => {
    const c = ctx || {}; const now = n0(c.now); const st = S(row.state);
    const at = (d) => new Date(now + d * DAY).toISOString();
    if (isGone(row)) return '';
    if (st === 'error') return at(1);
    if (st === 'indexed') return at(row._impr7 > 0 ? CFG.watch_quiet_days : CFG.watch_days);
    if (S(row.action) === 'leave_out') return at(CFG.leave_out_days);
    if (row.lane === 'new') {
      const a = anchorOf(row, c); const age = a ? (now - a) / DAY : 0;
      const m = CFG.new_schedule.find(d => d > age + 0.01);
      if (m !== undefined && a) return new Date(a + m * DAY).toISOString();
    }
    const k = Math.max(1, n0(row.checks));
    return at(CFG.recheck[Math.min(k, CFG.recheck.length) - 1]);
  };

  // ---- internal links for a page Google has not found / crawled: existing indexed pages on the same topic ----
  const STOP = new Set('the and for with from that this your you our are was were has have had not but all any can will into about over more most how what why when who which their them they its it is in on of to a an or as at by be we us uae www com html php htm page pages index home amp'.split(' '));
  const words = (s) => (S(s).toLowerCase().replace(/https?:\/\/[^\/]+/g, ' ').match(/[\p{L}\p{N}]+/gu) || []).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  const topicOf = (p) => [...new Set(words(S(p.title) + ' ' + pathOf(p.url).replace(/[-_\/.]+/g, ' ')))];
  /** <= links_max existing indexed pages that share topic words with the target (IDF-weighted overlap); never the page itself, never a not-indexed page. */
  const linkSuggestions = (target, pages) => {
    const cands = (pages || []).filter(q => q && S(q.state) === 'indexed' && !same(q.url, target.url) && !isLowValue(q.url));
    if (!cands.length) return [];
    const df = new Map(); for (const q of cands) for (const w of topicOf(q)) df.set(w, (df.get(w) || 0) + 1);
    const N = cands.length;
    const tw = topicOf(target);
    const scored = cands.map(q => { const qw = new Set(topicOf(q)); let s = 0; for (const w of tw) if (qw.has(w)) s += Math.log((N + 1) / (df.get(w) || 1)); return { q, s }; })
      .filter(x => x.s > 0).sort((a, b) => b.s - a.s || n0(b.q.impressions_28d) - n0(a.q.impressions_28d) || S(a.q.url).localeCompare(S(b.q.url)));
    return scored.slice(0, CFG.links_max).map(x => ({ url: x.q.url, title: S(x.q.title).slice(0, 160) }));
  };

  // ---- Google's Search Status Dashboard and the spam-policies page ----
  const kindOf = (title) => /\bcore update\b/i.test(S(title)) ? 'core' : /\bspam update\b/i.test(S(title)) ? 'spam' : 'other';
  /** incidents.json (array) -> events. Every product is kept (an indexing or crawling incident explains a drop that is not the client's fault). */
  const parseEvents = (list) => (Array.isArray(list) ? list : []).filter(x => x && S(x.id)).map(x => {
    const mru = x.most_recent_update || {}; const open = !S(x.end) || (S(mru.status) && S(mru.status) !== 'AVAILABLE');
    const title = S(x.external_desc) || 'Google Search incident';
    return { event_id: 'gssd:' + S(x.id), source: 'status_dashboard', kind: kindOf(title), title: title.slice(0, 200), started_at: S(x.begin), ended_at: open ? '' : S(x.end),
      status: open ? 'rolling_out' : 'complete', url: 'https://status.search.google.com/' + (S(x.uri) || ('incidents/' + S(x.id))),
      product: ((x.affected_products || [])[0] || {}).title || S(x.service_name), modified: S(x.modified) };
  });
  const EVENT_COLS = ['event_id', 'source', 'kind', 'title', 'started_at', 'ended_at', 'status', 'url', 'seen_at', 'updated_at'];
  /** The rows to upsert (new or changed only) and what is news today: started (a new rollout) and completed (a rollout that finished). */
  const eventRows = (parsed, stored, now) => {
    const nowIso = new Date(n0(now)).toISOString(); const by = new Map((stored || []).filter(e => e && S(e.event_id)).map(e => [S(e.event_id), e]));
    const rows = [], started = [], completed = [];
    const fresh = (iso) => { const t = ts(iso); return t && n0(now) - t <= 2 * DAY; };
    for (const e of (parsed || [])) {
      const old = by.get(e.event_id);
      const row = { event_id: e.event_id, source: e.source, kind: e.kind, title: e.title, started_at: e.started_at, ended_at: e.ended_at, status: e.status, url: e.url,
        seen_at: old ? S(old.seen_at) || nowIso : nowIso, updated_at: nowIso };
      const changed = !old || EVENT_COLS.filter(k => k !== 'seen_at' && k !== 'updated_at').some(k => S(old[k]) !== S(row[k]));
      if (changed) rows.push(row);
      if (e.kind === 'core' || e.kind === 'spam') {
        if (e.status === 'rolling_out' && (!old || S(old.status) !== 'rolling_out')) started.push(row);
        if (e.status === 'complete' && ((old && S(old.status) === 'rolling_out') || (!old && fresh(e.ended_at)))) completed.push(row);
      }
    }
    return { rows, started, completed };
  };
  /** The main text of the spam-policies page (the article, without the page chrome), its fingerprint and the "Last updated" date. */
  const policyText = (html) => {
    const h = S(html);
    const a = h.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    let t = a ? a[1] : (h.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [])[1] || '';
    t = t.replace(/<(script|style|noscript|svg|template|button|devsite-[a-z-]+)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/\b(?:Send feedback|Was this helpful\?)/g, ' ').replace(/\s+/g, ' ').trim();
    const lu = (h.match(/Last updated\s+(\d{4}-\d{2}-\d{2})/i) || [])[1] || '';
    const hash = (typeof PW !== 'undefined') ? PW.hash(t) : String(t.length);
    return { text_len: t.length, hash, last_updated: lu };
  };
  const POLICY_URL = 'https://developers.google.com/search/docs/essentials/spam-policies';
  /** A new policy_doc event when the page's main text changed (first reading = the baseline, never news). null when not read. */
  const policyEvent = (res, stored, now) => {
    const r = res || {}; const status = n0(r.statusCode ?? r.status); const body = S(r.body ?? r.data);
    if (!status || status >= 400 || !body) return { read: false, why: status ? 'answered ' + status : 'no answer', row: null, news: false };
    const fp = policyText(body);
    if (fp.text_len < 2000) return { read: false, why: 'the page text could not be found (' + fp.text_len + ' characters)', row: null, news: false };
    const mine = (stored || []).filter(e => e && S(e.source) === 'spam_policies').sort((a, b) => S(b.started_at).localeCompare(S(a.started_at)) || S(b.seen_at).localeCompare(S(a.seen_at)));
    const id = 'spam_policies:' + fp.hash;
    if (mine.some(e => S(e.event_id) === id)) return { read: true, row: null, news: false, hash: fp.hash, last_updated: fp.last_updated };
    const nowIso = new Date(n0(now)).toISOString();
    const first = !mine.length;
    const row = { event_id: id, source: 'spam_policies', kind: 'policy_doc',
      title: (first ? 'Spam policies page, first reading' : 'Google changed its spam policies page') + (fp.last_updated ? ' (last updated ' + fp.last_updated + ')' : ''),
      started_at: first && fp.last_updated ? fp.last_updated + 'T00:00:00.000Z' : nowIso, ended_at: '', status: 'changed', url: POLICY_URL, seen_at: nowIso, updated_at: nowIso };
    return { read: true, row, news: !first, hash: fp.hash, last_updated: fp.last_updated };
  };
  /** Quality suggestions are held while a core or spam update rolls out (DESIGN §4). A rollout the feed still shows open after freeze_max_days does not hold. */
  const freeze = (events, now) => {
    const open = (events || []).filter(e => e && (S(e.kind) === 'core' || S(e.kind) === 'spam') && S(e.status) === 'rolling_out'
      && ts(e.started_at) && ts(e.started_at) <= n0(now) && n0(now) - ts(e.started_at) <= CFG.freeze_max_days * DAY)
      .sort((a, b) => S(b.started_at).localeCompare(S(a.started_at)));
    if (!open.length) return { freeze: false, reason: '', title: '', event_id: '' };
    const e = open[0];
    return { freeze: true, title: S(e.title), event_id: S(e.event_id),
      reason: 'Google\'s ' + S(e.title) + ' is rolling out (since ' + S(e.started_at).slice(0, 10) + '): page improvements wait until it finishes.' };
  };

  // ---- what an update did to the site's pages ----
  /** The before / after windows of one finished update, or null while Search Console data does not cover enough days after it. */
  const impactWindows = (ev, now) => {
    const st = ts(ev && ev.started_at), en = ts(ev && ev.ended_at); if (!st || !en) return null;
    const dataEnd = Date.parse(isoDay(n0(now) - CFG.lag_days * DAY) + 'T00:00:00Z');
    const afterFrom = Date.parse(isoDay(en + DAY) + 'T00:00:00Z');
    if (n0(now) - en < CFG.impact_after_days * DAY) return null;
    const afterTo = Math.min(afterFrom + (CFG.impact_window_max - 1) * DAY, dataEnd);
    const days = Math.round((afterTo - afterFrom) / DAY) + 1;
    if (days < CFG.impact_window_min) return null;
    const beforeTo = Date.parse(isoDay(st - DAY) + 'T00:00:00Z');
    const beforeFrom = beforeTo - (days - 1) * DAY;
    return { before_from: isoDay(beforeFrom), before_to: isoDay(beforeTo), after_from: isoDay(afterFrom), after_to: isoDay(afterTo), days };
  };
  /** Finished core / spam updates of the last impact_recent_days whose comparison for this site is missing or can cover more days now. */
  const impactDue = (events, stored, siteId, now) => (events || []).filter(e => e && (S(e.kind) === 'core' || S(e.kind) === 'spam') && S(e.status) === 'complete'
      && ts(e.ended_at) && n0(now) - ts(e.ended_at) <= CFG.impact_recent_days * DAY).map(e => {
    const w = impactWindows(e, now); if (!w) return null;
    const old = (stored || []).find(x => x && S(x.site_id) === S(siteId) && S(x.event_id) === S(e.event_id));
    if (old) {
      const oldDays = Math.round((ts(old.after_to) - ts(old.after_from)) / DAY) + 1;
      if (oldDays >= CFG.impact_window_max || S(old.after_to) >= w.after_to || n0(now) - ts(old.compared_at) < CFG.impact_refresh_days * DAY) return null;
    }
    return { event: e, windows: w };
  }).filter(Boolean);
  /**
   * before / after: Search Analytics rows with keys [page] over two windows of the same length. A page is compared only with at least
   * impact_min_impr impressions over both; it dropped / gained when the impressions moved by 20%+ AND a two-sample Poisson test on equal windows
   * passes at 95% (z = (a - b) / sqrt(a + b)); everything else is stable. indexRows: the site's rows after this run (state and cause per page).
   */
  const impactCompare = (before, after, site, indexRows) => {
    const m = new Map();
    const take = (rows, side) => { for (const r of (rows || [])) { if (!r || !Array.isArray(r.keys)) continue; const loc = norm(r.keys[0], site); if (!loc) continue; const k = key(loc);
      const e = m.get(k) || { url: loc, b: { c: 0, i: 0, p: 0 }, a: { c: 0, i: 0, p: 0 } }; e[side] = { c: n0(r.clicks), i: n0(r.impressions), p: n0(r.position) }; m.set(k, e); } };
    take(before, 'b'); take(after, 'a');
    const rowsBy = new Map((indexRows || []).map(r => [key(r.url), r]));
    const out = [];
    for (const e of m.values()) {
      const bi = e.b.i, ai = e.a.i; if (bi + ai < CFG.impact_min_impr) continue;
      const z = (ai - bi) / Math.sqrt(ai + bi); const rel = (ai - bi) / Math.max(bi, 1);
      const segment = (z <= -CFG.impact_z && rel <= -CFG.impact_rel) ? 'dropped' : (z >= CFG.impact_z && rel >= CFG.impact_rel) ? 'gained' : 'stable';
      const ir = rowsBy.get(key(e.url)) || {};
      out.push({ url: e.url, before_clicks: e.b.c, after_clicks: e.a.c, before_impr: bi, after_impr: ai, before_pos: +e.b.p.toFixed(1), after_pos: +e.a.p.toFixed(1),
        segment, state: S(ir.state), cause: S(ir.cause), _d: ai - bi });
    }
    const order = { dropped: 0, gained: 1, stable: 2 };
    out.sort((a, b) => order[a.segment] - order[b.segment] || (a.segment === 'gained' ? b._d - a._d : a._d - b._d) || S(a.url).localeCompare(S(b.url)));
    const cnt = (s) => out.filter(x => x.segment === s).length;
    return { pages: out.length, dropped: cnt('dropped'), stable: cnt('stable'), gained: cnt('gained'),
      pages_json: out.slice(0, CFG.impact_pages_max).map(({ _d, ...x }) => x) };
  };
  const impactNote = (ev, cmp, w) => !cmp.pages
    ? 'Not enough Search Console data on your pages to compare before and after ' + S(ev.title) + ' (each page needs ' + CFG.impact_min_impr + '+ impressions over the two periods).'
    : S(ev.title) + ': ' + cmp.dropped + ' page(s) lost visibility, ' + cmp.gained + ' gained and ' + cmp.stable + ' held, comparing ' + w.days + ' days before with ' + w.days
      + ' days after (pages with ' + CFG.impact_min_impr + '+ impressions; a change counts only when it is 20%+ and unlikely to be chance).'
      + (cmp.dropped ? ' Only the pages that lost visibility are worth a review.' : '');

  // ---- the stored row: exact columns, changed rows only ----
  const PAGE_COLS = ['site_id', 'domain', 'url', 'lane', 'sources', 'in_sitemap', 'sitemap_lastmod', 'first_seen_at', 'published_at', 'impressions_28d', 'clicks_28d',
    'last_impression_at', 'state', 'evidence', 'cause', 'action', 'verdict', 'coverage', 'indexing_state', 'robots_state', 'page_fetch_state', 'crawled_as',
    'google_canonical', 'user_canonical', 'last_crawl', 'referring_count', 'google_sitemaps', 'inspect_at', 'fetch_at', 'http_status', 'final_url', 'noindex',
    'page_canonical', 'words', 'title', 'indexed_since', 'dropped_at', 'checks', 'next_check_at', 'needs_person', 'link_from', 'merge_into', 'note', 'updated_at'];
  const NUM = ['impressions_28d', 'clicks_28d', 'referring_count', 'google_sitemaps', 'http_status', 'words', 'checks'];
  const BOOL = ['in_sitemap', 'needs_person'];
  const rowOut = (p) => { const o = {}; for (const k of PAGE_COLS) o[k] = NUM.includes(k) ? n0(p[k]) : BOOL.includes(k) ? (p[k] === true || p[k] === 'true') : S(p[k]); return o; };
  const changed = (prev, row) => !prev || PAGE_COLS.some(k => k !== 'updated_at' && (NUM.includes(k) ? n0(prev[k]) !== n0(row[k]) : BOOL.includes(k) ? ((prev[k] === true || prev[k] === 'true') !== row[k]) : S(prev[k]) !== S(row[k])));

  // ---- the run: the site's figures, the client's report ----
  const summarize = (rows, run) => {
    const R = rows || []; const cnt = (f) => R.filter(f).length;
    const by_cause = {}, by_action = {};
    for (const r of R) { if (S(r.cause)) by_cause[r.cause] = (by_cause[r.cause] || 0) + 1; const a = S(r.action) || 'none'; by_action[a] = (by_action[a] || 0) + 1; }
    return { known: R.length, indexed: cnt(r => r.state === 'indexed'), not_indexed: cnt(r => r.state === 'not_indexed'), excluded: cnt(r => r.state === 'excluded'),
      unknown: cnt(r => r.state === 'unknown'), errors: cnt(r => r.state === 'error'), new_pages: cnt(r => r.lane === 'new'), new_indexed: cnt(r => r.lane === 'new' && r.state === 'indexed'),
      needs_person: cnt(r => r.needs_person === true), should_index: cnt(r => r.action !== 'leave_out'), by_cause, by_action,
      backlog_left: n0((run || {}).backlog_left) };
  };
  const ACTION_LABEL = { site_fix: 'Steps on your website', links: 'Help Google find these pages (internal links and sitemap)', quality: 'Pages Google read and left out',
    duplicate: 'Pages Google treats as copies', wait: 'New pages Google has not reached yet (normal)', leave_out: 'Left out on purpose or not needed (no action)', none: 'Not checked or not recognised' };
  const CAUSE_LABEL = { indexed_not_in_sitemap: 'In Google but missing from the sitemap', wait_new: 'New, not crawled yet', unknown_to_google: 'Unknown to Google',
    not_in_sitemap: 'Unknown to Google and missing from the sitemap', discovered_not_crawled: 'Found by Google, not crawled yet', crawled_not_indexed: 'Read by Google, not added',
    noindex: 'Marked noindex', noindex_intended: 'Marked noindex (intended)', robots_blocked: 'Blocked by robots.txt', robots_intended: 'Blocked by robots.txt (intended)',
    canonical_elsewhere: 'Sitemap lists a non-main address', alternate: 'Alternate address of another page', google_chose_other: 'Google chose another page as the main one',
    duplicate_no_canonical: 'Copy with no main version named', not_found: 'Not found (404 / 410)', soft_404: 'Looks empty to Google (soft 404)', server_error: 'Server error',
    access_denied: 'Login or access blocked', redirect: 'Redirects elsewhere', low_value: 'Listing / filter / account page', not_checked: 'Could not be checked', unclassified: 'Reason not recognised' };
  // the sentence for a group of pages of one cause: the per-page details (which address, which status) go on the page lines, not in the sentence
  const GROUP = { google_chose_other: 'Google treats these pages as copies of other addresses and shows those instead. Merge the copies, make each page clearly different, or (when the other address is the same page on your other host) redirect one host to the other.',
    duplicate_no_canonical: 'Google sees these pages as copies of other pages. Point each one to its main version with a canonical tag, or make it clearly different.',
    redirect: 'These addresses redirect. Your sitemap should list the final addresses instead.', server_error: 'Your server answered with an error when these pages were read. Check the server or the hosting.',
    access_denied: 'These pages ask for a login or turn visitors away, so Google cannot read them. Open them to everyone if you want them in Google.',
    noindex: 'These pages tell search engines not to index them. Remove the noindex if you want them in Google.',
    not_checked: 'We could not check these pages on the last try. We try again on the next run.', unclassified: 'Google gave a reason we do not recognise. Check these addresses in Search Console.' };
  const groupNote = (row, ctx) => GROUP[S(row.cause)] && !(S(row.cause) === 'redirect' && S(row.action) !== 'site_fix') ? GROUP[S(row.cause)] : noteOf({ cause: row.cause, action: row.action, state: row.state }, ctx).replace(/ We have checked it [\s\S]*$/, '');
  const lineOf = (r) => '  - ' + r.url + (S(r.merge_into) ? ' (Google uses ' + r.merge_into + ')' : '') + (S(r.final_url) ? ' (redirects to ' + r.final_url + ')' : '')
    + (n0(r.http_status) >= 400 ? ' (answers ' + n0(r.http_status) + ')' : '') + (r.needs_person ? ' (needs a person: checked ' + CFG.person_after + ' times with no change)' : '');
  const reportMarkdown = (site, sum, run, o) => {
    const opts = o || {}; const L = [];
    const should = n0(sum.should_index);
    L.push('# Index coverage: ' + S(site.domain));
    L.push('');
    L.push('Google has **' + sum.indexed + ' of ' + sum.known + '** known pages in its index' + (should && should !== sum.known ? ' (' + sum.indexed + ' of the ' + should + ' that should be there)' : '') + '.');
    if (sum.unknown) L.push(sum.unknown + ' page(s) are not checked yet; at up to ' + n0(run.quota_cap) + ' checks a day that takes about ' + Math.max(1, Math.ceil(sum.unknown / Math.max(1, n0(run.quota_cap)))) + ' more day(s).');
    if (sum.errors) L.push(sum.errors + ' page(s) could not be checked on the last try; they are tried again, never counted as missing.');
    if (S(run.note)) L.push(S(run.note));
    if (opts.freeze && opts.freeze.freeze) L.push('**' + opts.freeze.reason + '**');
    L.push('');
    for (const a of ['site_fix', 'links', 'quality', 'duplicate', 'wait', 'none', 'leave_out']) {
      const rows = (opts.rows || []).filter(r => r.action === a && (a !== 'none' || (S(r.cause) && r.state !== 'indexed')));
      if (!rows.length) continue;
      L.push('## ' + ACTION_LABEL[a] + ' (' + rows.length + ')');
      const causes = [...new Set(rows.map(r => r.cause))];
      for (const c of causes) {
        const cr = rows.filter(r => r.cause === c);
        L.push('- **' + (CAUSE_LABEL[c] || c) + '** (' + cr.length + '): ' + groupNote(cr[0], { freeze: opts.freeze }));
        for (const r of cr.slice(0, 5)) L.push(lineOf(r));
        if (cr.length > 5) L.push('  - and ' + (cr.length - 5) + ' more');
      }
      L.push('');
    }
    if ((opts.dropped || []).length) { L.push('## Dropped out of Google (' + opts.dropped.length + ')'); for (const d of opts.dropped) L.push('- ' + d.url + ' (' + (CAUSE_LABEL[d.cause] || d.cause || 'reason not known yet') + ')'); L.push(''); }
    if ((opts.events || []).length) { L.push('## Google updates'); for (const e of opts.events) L.push('- ' + e.title + ': ' + (e.status === 'rolling_out' ? 'rolling out since ' + S(e.started_at).slice(0, 10) : e.status === 'complete' ? 'finished ' + S(e.ended_at).slice(0, 10) : 'seen ' + S(e.started_at).slice(0, 10))); L.push(''); }
    if (opts.impact && S(opts.impact.note)) { L.push('## What the last update did'); L.push(S(opts.impact.note)); L.push(''); }
    L.push('We find which pages Google left out, why, and what to do. Google decides what it indexes; nothing here is submitted to Google or changed on your site.');
    return L.join('\n').replace(/[—–]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...');
  };

  return { CFG, key, same, norm, own, hostOf, bare, pathOf, depth, isLowValue, LOW_VALUE, robotsSitemaps, parseSitemap, sitemapRoots, sitemapAccept, searchEvidence,
    readInspection, reuseOf, storedReading, readFetch, mainWords, diagnose, covCause, stateOf, ACTION, CAUSES, laneOf, anchorOf, noteOf, plan, nextCheck, capOf, isGone,
    linkSuggestions, topicOf, kindOf, parseEvents, eventRows, policyText, policyEvent, POLICY_URL, freeze, impactWindows, impactDue, impactCompare, impactNote,
    PAGE_COLS, rowOut, changed, summarize, reportMarkdown, groupNote, isoDay, DAY, merge };
})();
const S = (v) => String(v == null ? '' : v).trim();
const now = Date.now();
const grab = (n) => { try { return $(n).all().map(i => i.json).filter(r => r && typeof r === 'object' && !r.error); } catch (e) { return []; } };
const events = (grab('Google Events')[0] || {}).events || [];
const stored = grab('Load Update Impact');
const sites = grab('Index Sites').filter(s => s.site_id && s.gsc_connected);
const diag = grab('Index Diagnose').filter(x => x.site_id && !x.failed);
const API = 'https://www.googleapis.com/webmasters/v3/sites/';
const out = [];
for (const s of sites) {
  if (!diag.some(x => x.site_id === s.site_id)) continue;
  for (const due of IX.impactDue(events, stored, s.site_id, now).slice(0, 2)) {
    const w = due.windows;
    for (const side of ['before', 'after']) out.push({ json: { site_id: s.site_id, event_id: due.event.event_id, side, windows: w,
      url: API + encodeURIComponent(s.gsc_property) + '/searchAnalytics/query',
      body: { startDate: w[side + '_from'], endDate: w[side + '_to'], dimensions: ['page'], type: 'web', dataState: 'final', rowLimit: 25000 } } });
  }
}
return out.length ? out : [{ json: { skip: true, reason: 'no update to compare' } }];
