// G25 (2026-10-13): what Google said about each key page, stored on the page's own seo_page_watch row (exact table columns — the Data Table
// node auto-maps every field it is given). The row is what makes the rotation possible: the next weekly run inspects the pages with the
// oldest `inspect_at` first, so every key page is seen within Google's 2,000-a-day quota instead of the same 20 every week.
// A page the budget did not reach is not written at all (its stored inspection stays as it was, with its own date); a failed inspection
// keeps the last answer and records why today's attempt did not happen.
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
  // >>> LOCALE RULE (CR17-FX-INDEX, review R1 M4): ONE text in _index_kit.js, _page_watch.js and _moves.js (build_v4.py section 194 checks they are the
  // same). A same-site redirect that only adds a language / country prefix (/x -> /ae/x, / -> /en/), or sends a deep page to a bare locale root,
  // answers where OUR server sits (Doha), not what Google's crawler sees: never a move, never a cause.
  const localeRedirect = (from, to) => {
    const LOC = /^\/[a-z]{2}(?:[-_][a-z]{2,4})?(?=\/|$)/i;
    const pa = (u) => String(u == null ? '' : u).trim().replace(/^https?:\/\/[^\/?#]*/i, '').replace(/[?#].*$/, '') || '/';
    const f = pa(from), t = pa(to);
    if (!LOC.test(t) || LOC.test(f)) return false;
    if ((t.replace(LOC, '') || '/').replace(/\/+$/, '').toLowerCase() === f.replace(/\/+$/, '').toLowerCase()) return true;
    return /^\/[a-z]{2}(?:[-_][a-z]{2,4})?\/?$/i.test(t) && f !== '/';
  };
  // <<< LOCALE RULE
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

  // ---- robots.txt: a state machine that follows what Google does (client report 2026-11-17, devaicon.com F5; build section 194) ----
  // Google's robots.txt rules (developers.google.com/search/docs/crawling-indexing/robots/robots_txt): 2xx is read as served; 3xx is followed
  // up to five hops and an unresolved chain counts as a 404; 4xx (except 429) means "no robots.txt": Google crawls everything; 5xx and 429
  // mean Google stops crawling for 12 hours, then uses its last copy for up to 30 days; an HTML page served as robots.txt is parsed for rules
  // and the rest ignored. The watch used to hash whatever came back: devaicon's 404 page (20 KB of Next.js HTML) became "2,085 characters of
  // rules" and a High alert, and every new deploy id in that page raised it again. Now: a state (ok / missing / unreachable / html), the
  // PARSED rules (groups, allow / disallow lines, sitemap lines) compared as rules, and a severity that says what Google will do.
  const ROBOTS_V = 2;   // the fingerprint below is of the parsed rules; a stored fingerprint of another version is a baseline, never a change
  const robotsParse = (text) => {
    const groups = []; const sitemaps = []; let cur = null; let lastUA = false;
    for (const raw of S(text).replace(/\r/g, '').split('\n')) {
      const line = raw.replace(/#.*$/, '').trim(); if (!line) continue;
      const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) { lastUA = false; continue; }
      const field = m[1].toLowerCase(), value = S(m[2]);
      if (field === 'user-agent') { if (!cur || !lastUA) { cur = { agents: [], lines: [] }; groups.push(cur); } cur.agents.push(value.toLowerCase()); lastUA = true; continue; }
      lastUA = false;
      if (field === 'sitemap') { if (value) sitemaps.push(value); continue; }
      if (field !== 'disallow' && field !== 'allow') continue;
      if (!cur) { cur = { agents: ['*'], lines: [] }; groups.push(cur); }
      cur.lines.push({ allow: field === 'allow', path: value });
    }
    // which groups apply to Googlebot: its own group wins over `*`, and groups naming the same agent are merged (as Google's parser does)
    const forGoogle = groups.filter(g => g.agents.includes('googlebot'));
    const applies = (forGoogle.length ? forGoogle : groups.filter(g => g.agents.includes('*'))).flatMap(g => g.lines);
    const text2 = groups.map(g => 'user-agent: ' + g.agents.join(', ') + (g.lines.length ? '\n' + g.lines.map(l => (l.allow ? 'allow: ' : 'disallow: ') + l.path).join('\n') : '')).join('\n')
      + (sitemaps.length ? (groups.length ? '\n' : '') + sitemaps.map(x => 'sitemap: ' + x).join('\n') : '');
    // one line per rule, with the agents it is for: what a diff compares (a reordered file or a comment changes nothing)
    const facts = [...new Set(groups.flatMap(g => g.lines.map(l => (l.allow ? 'Allow: ' : 'Disallow: ') + (l.path || '(empty)') + ' for ' + g.agents.map(a => a === '*' ? 'every crawler' : a === 'googlebot' ? 'Googlebot' : a).join(', ')))
      .concat(sitemaps.map(x => 'Sitemap: ' + x)))];
    return { groups, sitemaps, applies, text: text2, facts, google_group: forGoogle.length ? 'googlebot' : '*' };
  };
  const isHtml = (ctype, text) => /text\/html|application\/xhtml/i.test(S(ctype)) || /^\s*(?:<!doctype html|<html[\s>]|<head[\s>])/i.test(S(text).slice(0, 400));
  const robotsRead = (res) => {
    const r = res || {}; const status = n0(r.statusCode ?? r.status); const text = S(r.body ?? r.data);
    const headers = r.headers || {};
    const ctype = S((Object.keys(headers).find(k => k.toLowerCase() === 'content-type') && headers[Object.keys(headers).find(k => k.toLowerCase() === 'content-type')]) || '');
    const errText = S((r.error && (r.error.message || r.error.description)) || r.error || '');
    const none = { groups: [], sitemaps: [], applies: [], text: '', facts: [] };
    const out = (state, p, extra) => ({ ok: true, state, status, hash: state === 'ok' || state === 'html' ? hash(p.text) : '', v: ROBOTS_V, length: p.text.length,
      rules: p.applies, groups: p.groups.slice(0, 30), sitemaps: p.sitemaps.slice(0, 20), text: p.text.slice(0, 1500), facts: p.facts.slice(0, 60), content_type: ctype.slice(0, 80),
      blocks: (url) => {
        if ((state !== 'ok' && state !== 'html') || !p.applies.length) return null;   // no file, or nothing that applies: nothing is blocked by it
        const path = pathOf(url);
        let best = null;
        for (const l of p.applies) {
          if (!l.path) continue;                                              // `Disallow:` with no path allows everything
          const pat = l.path.replace(/\*+/g, '*');
          const rx = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
          if (!rx.test(path)) continue;
          if (!best || l.path.length > best.path.length || (l.path.length === best.path.length && l.allow)) best = l;   // longest rule wins, Allow wins a tie
        }
        return best ? !best.allow : false;
      }, error: '', ...(extra || {}) });
    if (!status) {
      // a chain longer than Google's five hops is treated as a 404 by Google: "missing", not "could not be read"
      if (/redirect/i.test(errText)) return out('missing', none, { reason: 'redirect_chain', status: 0 });
      return { ok: false, state: 'not_read', status: 0, error: (errText || 'no answer').slice(0, 200), hash: '', rules: [], groups: [], sitemaps: [], text: '', facts: [], v: ROBOTS_V };
    }
    if (status >= 300 && status < 400) return { ...out('unresolved', none), ok: false, location: S((Object.keys(headers).find(k => k.toLowerCase() === 'location') && headers[Object.keys(headers).find(k => k.toLowerCase() === 'location')]) || ''), error: 'robots.txt redirects (' + status + ')' };
    if (status === 429 || status >= 500) return out('unreachable', none);
    if (status >= 400) return out('missing', none);
    if (isHtml(ctype, text)) return out('html', robotsParse(text));
    return out('ok', robotsParse(text));
  };
  const BAD_ROBOTS = ['missing', 'unreachable', 'html'];
  const prevRobots = (prev) => {
    if (typeof prev === 'string') return prev ? { v: ROBOTS_V, hash: prev, state: 'ok', text: '', facts: null } : {};
    const p = prev || {};
    const st = S(p.state) || (n0(p.status) >= 200 && n0(p.status) < 300 ? 'ok' : n0(p.status) === 429 || n0(p.status) >= 500 ? 'unreachable' : n0(p.status) >= 400 ? 'missing' : '');
    return { v: n0(p.v), hash: S(p.hash), state: st, text: S(p.text), facts: Array.isArray(p.facts) ? p.facts : null, last_good_hash: S(p.last_good_hash), last_good_at: S(p.last_good_at),
      last_good_text: S(p.last_good_text), bad_runs: n0(p.bad_runs) };
  };
  const disallowsOf = (text) => [...new Set(S(text).split('\n').filter(l => /^disallow: \S/.test(l)).map(l => l.slice(10).trim()))];
  // the whole site closed to Google, or to every crawler (`*` covers Bing and the AI search fetchers too)
  const rootBlock = (robots) => (robots.groups || []).some(g => (g.agents || []).some(a => a === '*' || a === 'googlebot') && (g.lines || []).some(l => !l.allow && l.path === '/'))
    || (robots.rules || []).some(l => !l.allow && l.path === '/');
  /**
   * The site's robots.txt as a change of its own. prev: the stored reading (seo_cache `watch:<site>`: v, hash, state, text, facts, last good
   * copy, bad_runs) or, in the older form, only a fingerprint string; robots: robotsRead() of today; o.newly_blocked: key pages the new rules
   * block that were crawlable before. -> null (nothing to say) or { code, severity, label, text, from, to, state }
   */
  const robotsChange = (prev, robots, o) => {
    const opts = o || {};
    if (!robots || robots.ok === false) return null;                       // not read, or a redirect we could not follow: no claim at all
    const P = prevRobots(prev); const now = S(robots.state) || 'ok';
    const mk = (code, severity, text) => ({ code, severity, label: CODES[code].label, text, from: P.hash || P.state, to: S(robots.hash) || now, state: now });
    if (!P.state && !P.hash) return null;                                   // the first reading is a baseline
    const legacy = P.v !== ROBOTS_V;                                          // a fingerprint of the old kind: the state compares, the rules do not
    const rulesLine = (txt) => { const d = disallowsOf(txt); return d.length ? ' (' + d.slice(0, 4).map(x => 'Disallow ' + x).join(', ') + (d.length > 4 ? ', and ' + (d.length - 4) + ' more' : '') + ')' : ''; };
    const prevText = P.text || P.last_good_text;
    if (now === 'missing') {
      if (P.state === 'missing') return null;
      const blockedNothing = !legacy && P.state === 'ok' && !disallowsOf(prevText).length;
      return mk('robots_missing', blockedNothing ? 'low' : 'medium', 'robots.txt is missing' + (robots.reason === 'redirect_chain' ? ' (it redirects more than five times, which Google treats as missing)' : ' (it answers ' + robots.status + ')')
        + '. Google then crawls everything: nothing is blocked, but your rules' + rulesLine(prevText) + ' and the Sitemap line no longer apply. Put the file back if this was not on purpose.');
    }
    if (now === 'unreachable') {
      if (P.state === 'unreachable') return P.bad_runs === 1
        ? mk('robots_unreachable', 'critical', 'robots.txt still answers ' + robots.status + ' (second check in a row). Google has paused crawling your site and uses its last copy of the file; fix the server so robots.txt answers again.')
        : null;
      return mk('robots_unreachable', 'high', 'robots.txt answers ' + robots.status + ' (a server error). While this lasts Google stops crawling your site for up to 12 hours, then uses its last copy of the file for up to 30 days. Check the server or the CDN in front of it.');
    }
    if (now === 'html') {
      if (P.state === 'html') return null;
      return mk('robots_html', 'medium', 'robots.txt answers a web page instead of a rules file. Google tries to read rules from it and ignores the rest, so your rules' + rulesLine(prevText) + ' may no longer apply. Serve the plain text file at /robots.txt.');
    }
    // now === 'ok'
    if (BAD_ROBOTS.includes(P.state)) {
      const same = P.last_good_hash && P.last_good_hash === S(robots.hash);
      if (!same && P.last_good_hash && rootBlock(robots)) return mk('robots_changed', 'high', 'robots.txt is back, but it now closes the whole site to crawlers (Disallow: /). Remove that line unless you mean to leave search.');
      return mk('robots_back', 'info', 'robots.txt is back' + (same ? ' with the same rules as on ' + (S(P.last_good_at).slice(0, 10) || 'the last good check') + '.' : P.last_good_hash ? ' with rules that differ from the last good copy: read it once.' : '.'));
    }
    if (legacy || !P.hash || P.hash === S(robots.hash)) return null;
    // a real change of the rules: say which rules, and how much it matters for Google
    const was = P.facts ? new Set(P.facts) : null; const isNow = new Set(robots.facts || []);
    const added = was ? [...isNow].filter(x => !was.has(x)) : []; const removed = was ? [...was].filter(x => !isNow.has(x)) : [];
    const blocked = (opts.newly_blocked || []).filter(Boolean);
    const severity = (blocked.length || rootBlock(robots)) ? 'high' : 'medium';
    const diff = (added.length ? ' Added: ' + added.slice(0, 5).join('; ') + (added.length > 5 ? '; and ' + (added.length - 5) + ' more' : '') + '.' : '')
      + (removed.length ? ' Removed: ' + removed.slice(0, 5).join('; ') + (removed.length > 5 ? '; and ' + (removed.length - 5) + ' more' : '') + '.' : '');
    return mk('robots_changed', severity, 'robots.txt changed.' + (diff || ' Its rules are different from the last check.')
      + (blocked.length ? ' It now stops Google crawling ' + blocked.length + ' of your key pages: ' + blocked.slice(0, 3).map(pathOf).join(', ') + (blocked.length > 3 ? ', and more' : '') + '.' : '')
      + (rootBlock(robots) && !blocked.length ? ' It closes the whole site to crawlers (Disallow: /), so Google and the AI search tools stop reading it.' : ''));
  };

  // ---- a page that started redirecting: where does it land? (build section 194) ----
  // Google: a 301 / 308 tells the indexing pipeline the target should be canonical (the old address's place moves to the new one); a 302 / 307
  // does not, and keeps the old address in search (developers.google.com/search/docs/crawling-indexing/301-redirects). So a permanent move to
  // a working page of the same site is good news (Info), a temporary one is Medium, and a redirect to a broken, unindexable or foreign page,
  // or a deep page sent to the home page (a soft 404 for Google), is High or Critical. `hop` is the target read with the redirect followed.
  const absUrl = (location, base) => {
    const l = S(location); if (!l) return '';
    if (/^https?:\/\//i.test(l)) return l;
    const origin = (S(base).match(/^(https?:\/\/[^\/?#]+)/i) || [])[1] || ''; if (!origin) return '';
    if (/^\/\//.test(l)) return (S(base).match(/^(https?:)/i) || ['', 'https:'])[1] + l;
    if (l.charAt(0) === '/') return origin + l;
    return origin + (pathOf(base).replace(/[^\/]*$/, '') || '/') + l;
  };
  const redirectVerdict = (x) => {
    const o = x || {}; const status = n0(o.status); const from = S(o.url); const to = absUrl(o.location, from);
    const hop = o.hop || null; const permanent = status === 301 || status === 308;
    const where = to ? pathOf(to) : '';
    const v = (verdict, code, severity, text) => ({ verdict, code, severity, label: CODES[code].label, text, to });
    if (!to) return v('broken', 'page_redirect_bad', 'high', 'The page now redirects (' + status + ') but does not say where to, so visitors and Google land nowhere.');
    if (bare(hostOf(to)) !== bare(hostOf(from))) return v('offsite', 'page_redirect_bad', 'high', 'The page now sends visitors to another website (' + to + '). Google drops it from your site\'s results; if this is not on purpose, remove the redirect.');
    // CR17-FX-INDEX (M4): a language / country redirect for our server's location is not a move and not a problem we can judge
    if (localeRedirect(from, to)) return v('locale', 'page_locale', 'info', 'The page sends our reader to ' + where + ', a language or country version for where our server is. Google crawls from elsewhere and may not get this redirect, so the page is not treated as moved.');
    if (pathOf(from).replace(/\/+$/, '') !== '' && where.replace(/\/+$/, '') === '') return v('home', 'page_redirect_bad', 'high', 'The page now sends visitors to your home page. Google treats a page sent to the home page like a page that is gone, so its place in search is lost. Redirect it to the page that replaced it, or keep it.');
    const hostOnly = ukey(to) === ukey(from);
    if (!hop || hop.ok === false) {
      if (hop && /redirect/i.test(S(hop.error))) return v('loop', 'page_redirect_bad', 'high', 'The page now redirects (' + status + ' to ' + where + ') and the redirects never end in a page (more than five hops or a loop).');
      return v('unread', 'page_redirects', 'medium', 'The page now redirects (' + status + ' to ' + where + '). The new address could not be read today; we check it again with the next watch.');
    }
    const hs = n0(hop.status);
    if (hs >= 400 && hs < 500) return v('gone', 'page_redirect_bad', 'critical', 'The page now redirects to ' + where + ', which is gone (' + hs + '): visitors and Google land on an error page.');
    if (hs >= 500) return v('error', 'page_redirect_bad', 'high', 'The page now redirects to ' + where + ', which answers a server error (' + hs + ').');
    if (hs >= 300) return v('loop', 'page_redirect_bad', 'high', 'The page now redirects to ' + where + ', which redirects again too many times.');
    if (hop.noindex) return v('noindex', 'page_redirect_bad', 'high', 'The page now redirects to ' + where + ', which asks search engines not to index it, so neither address can be found in Google.');
    const canonOk = !S(hop.canonical) || ukey(hop.canonical) === ukey(to);
    if (!permanent) return v('temporary', 'page_redirects', 'medium', 'The page now redirects temporarily (' + status + ') to ' + where + '. Google keeps the old address in search while a redirect is temporary; use a permanent (301) redirect if the move is final.');
    if (!canonOk) return v('canonical_elsewhere', 'page_redirects', 'medium', 'The page moved permanently to ' + where + ', but that page names ' + S(hop.canonical) + ' as its main version, so Google may show neither. Point the redirect at the main version.');
    if (hostOnly) return v('moved', 'page_moved', 'info', 'The page now opens at ' + to + ', the same page on your main address. Nothing to do.');
    return v('moved', 'page_moved', 'info', 'The page moved permanently to ' + where + ', which works' + (o.expected ? '. This is the redirect your Steps on your website asked for' : '')
      + '. Google moves the old address\'s place in search to the new one. We watch the new address from now on.');
  };

  /**
   * CR17-FX-INDEX (review R1 L3): a moved address read again (once a week) no longer redirects permanently to the page it moved to. The move is
   * cleared (the address is watched again); our rows stay on the new address, said here so a person decides. -> one change (Low).
   */
  const moveUndone = (url, movedTo, status, redirectTo) => {
    const st = n0(status); const now = (st === 301 || st === 308) && S(redirectTo) ? 'it now redirects to ' + pathOf(redirectTo)
      : st >= 300 && st < 400 ? 'it now redirects temporarily (' + st + ')' + (S(redirectTo) ? ' to ' + pathOf(redirectTo) : '') : 'it answers ' + st;
    return { code: 'move_undone', severity: 'low', label: CODES.move_undone.label, from: S(movedTo), to: st + (S(redirectTo) ? ' ' + S(redirectTo) : ''),
      text: 'This address no longer redirects permanently to ' + pathOf(movedTo) + ': ' + now + '. We watch it again from the next check. Your keyword ladder, published pages and AI questions still use ' + pathOf(movedTo) + '.' };
  };

  // ---- what changed since the stored reading, and how loudly to say it ----
  // `prev` is the stored seo_page_watch row (or null for a page nobody has watched yet), `now` the signals of this run.
  // Build section 194: the severity is what Google does with the change, not the fact that something changed - a permanent move to a working
  // page and a canonical that now names the page itself are fixes (Info), a changed title is Low (Info when it is a page we just published).
  const CODES = {
    page_gone: { severity: 'critical', label: 'page gone' },
    page_error: { severity: 'critical', label: 'server error' },
    noindex_added: { severity: 'critical', label: 'noindex added' },
    robots_blocked: { severity: 'critical', label: 'blocked by robots.txt' },
    page_redirects: { severity: 'medium', label: 'page now redirects' },
    page_redirect_bad: { severity: 'high', label: 'redirects to a page that does not work' },
    page_moved: { severity: 'info', label: 'page moved' },
    page_locale: { severity: 'info', label: 'language or country redirect' },
    move_undone: { severity: 'low', label: 'redirect removed' },
    canonical_moved: { severity: 'high', label: 'canonical moved' },
    canonical_removed: { severity: 'low', label: 'canonical removed' },
    canonical_fixed: { severity: 'info', label: 'canonical points at the page itself' },
    robots_changed: { severity: 'medium', label: 'robots.txt changed' },
    robots_missing: { severity: 'medium', label: 'robots.txt missing' },
    robots_unreachable: { severity: 'high', label: 'robots.txt unreachable' },
    robots_html: { severity: 'medium', label: 'robots.txt is a web page' },
    robots_back: { severity: 'info', label: 'robots.txt is back' },
    title_changed: { severity: 'low', label: 'title changed' },
    page_back: { severity: 'info', label: 'page answers again' },
    noindex_removed: { severity: 'info', label: 'noindex gone' },
  };
  const compare = (prev, now, o) => {
    const opts = o || {}; const out = [];
    const add = (code, text, from, to, sev) => out.push({ code, severity: sev || CODES[code].severity, label: CODES[code].label, text, from: S(from), to: S(to) });
    if (!now || now.ok === false) return out;                                 // a failed fetch is "not checked", never a change
    const first = !prev || !S(prev.checked_at);
    const was = prev || {};
    const wasStatus = n0(was.status), nowStatus = n0(now.status);
    const url = S(opts.url);
    if (!first) {
      if (wasStatus >= 200 && wasStatus < 400 && nowStatus >= 500) add('page_error', 'The page answers ' + nowStatus + ' (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      else if (wasStatus >= 200 && wasStatus < 400 && nowStatus >= 400) add('page_gone', 'The page is gone: it answers ' + nowStatus + ' (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      else if (wasStatus >= 400 && nowStatus >= 200 && nowStatus < 300) add('page_back', 'The page answers ' + nowStatus + ' again (it answered ' + wasStatus + ' before)', wasStatus, nowStatus);
      if (nowStatus >= 300 && nowStatus < 400 && !(wasStatus >= 300 && wasStatus < 400)) {
        const rv = opts.redirect || null;   // the verdict on where it lands (Watch Compare reads the target); without it: Medium, said as such
        if (rv) add(rv.code, rv.text, wasStatus, nowStatus + ' ' + S(now.location), rv.severity);
        else add('page_redirects', 'The page now redirects (' + nowStatus + ' to ' + (S(now.location) || 'an address it does not name') + '). Where it lands was not checked in this run.', wasStatus, nowStatus + ' ' + S(now.location));
      } else if (nowStatus >= 300 && nowStatus < 400 && opts.redirect) {
        // CR17-FX-INDEX (review R1 M1): a page that keeps redirecting is judged again every day by where it lands. When today's verdict differs
        // from the stored one (seo_page_watch.redirect_verdict; '' on rows before this fix = a baseline, nothing said), the change is raised:
        // a target that broke after a move (moved -> gone) is Critical the same day, a temporary redirect whose target is gone gets louder.
        // An unread target ('unread') says nothing; a target that works again closes the open alert in the lifecycle (present() is false).
        const rv = opts.redirect; const pv = S(was.redirect_verdict);
        if (pv && rv.verdict !== 'unread' && rv.verdict !== pv && rv.verdict !== 'moved' && rv.verdict !== 'locale') add(rv.code, rv.text, wasStatus + ' ' + pv, nowStatus + ' ' + S(now.location), rv.severity);
      }
      if (now.noindex && !was.noindex) add('noindex_added', 'The page tells search engines not to index it (' + S(now.noindex_source) + ': "' + S(now.robots_meta || 'noindex') + '")', '', S(now.noindex_source));
      if (!now.noindex && was.noindex) add('noindex_removed', 'The page no longer tells search engines to leave it out', S(was.noindex_source), '');
      // the title and the canonical are only compared between two readings of a page that was answering: the title of yesterday's 404
      // ("Not found") is not a baseline, so a page that comes back is "answers again", never "the title changed".
      const wasOk = wasStatus >= 200 && wasStatus < 300;
      if (wasOk && nowStatus >= 200 && nowStatus < 300) {
        const selfNow = S(now.canonical) && same(now.canonical, url || now.url || '');
        const selfWas = S(was.canonical) && same(was.canonical, url || was.url || '');
        if (S(was.canonical) && !S(now.canonical)) {
          if (selfWas) add('canonical_removed', 'The canonical tag is gone (it pointed at the page itself). Google usually still treats the page as its own main version; put the tag back to be sure.', S(was.canonical), '');
          else add('canonical_fixed', 'The canonical tag that pointed at ' + S(was.canonical) + ' is gone, so Google can index this page under its own address again.', S(was.canonical), '');
        } else if (S(now.canonical) && S(was.canonical) && !same(now.canonical, was.canonical)) {
          if (selfNow) add('canonical_fixed', 'The canonical now points at the page itself (it pointed at ' + S(was.canonical) + '). That is right: Google can index this page under its own address.', S(was.canonical), S(now.canonical));
          else add('canonical_moved', 'The canonical now points at ' + S(now.canonical) + ' (it pointed at ' + S(was.canonical) + '), so Google is asked to show that page instead of this one.', S(was.canonical), S(now.canonical));
        }
        if (S(was.title) && S(now.title) && S(was.title) !== S(now.title)) {
          if (opts.own_title) add('title_changed', 'Your new title is live: "' + S(now.title) + '" (it was "' + S(was.title) + '").', S(was.title), S(now.title), 'info');
          else add('title_changed', 'The title changed to "' + S(now.title) + '" (it was "' + S(was.title) + '").', S(was.title), S(now.title));
        }
      }
    }
    // a page we are seeing for the first time is a baseline, never a change — that includes one robots.txt already blocked before we looked
    if (!first && opts.robots_blocked === true && opts.robots_blocked_before !== true) add('robots_blocked', 'robots.txt now stops Google crawling ' + (url || 'this page'), '', 'disallowed');
    return out;
  };
  const state = (changes, now) => (!now || now.ok === false) ? 'not_checked' : ((changes || []).some(c => c.severity !== 'info') ? 'changed' : 'ok');
  const worst = (changes) => { const order = ['critical', 'high', 'medium', 'low', 'info']; return (changes || []).map(c => c.severity).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] || ''; };

  // ---- the alert lifecycle (build section 194; Conductor's model: one incident per condition, closed when the condition is gone) ----
  // Every alert names its condition: the site, the page (or robots.txt) and the family of the change. While the condition lasts there is ONE
  // open alert (last_seen_at, count), never a new row a day; when the watch reads the page and the condition is gone the alert is resolved
  // with the sentence that says why (resolved_at, resolution). A change that is good news (a page moved to a working address, a canonical
  // that now names the page) is recorded resolved at once: nothing is left for the client to do. Rows written before section 194 carry no
  // condition key; it is read back from their message id (watch:<site>:<code>:<page hash>:<day>).
  const FAMILY = { page_gone: 'status', page_error: 'status', page_back: 'status', noindex_added: 'noindex', noindex_removed: 'noindex', robots_blocked: 'robots_blocked',
    page_redirects: 'redirect', page_redirect_bad: 'redirect', page_moved: 'redirect', page_locale: 'redirect', canonical_moved: 'canonical', canonical_removed: 'canonical_tag', canonical_fixed: 'canonical',
    title_changed: 'title', move_undone: 'move', robots_missing: 'robots_state', robots_unreachable: 'robots_state', robots_html: 'robots_state', robots_back: 'robots_state', robots_changed: 'robots_rules' };
  // the codes that close their family's open alert instead of opening one
  const CLOSES = { page_back: true, noindex_removed: true, page_moved: true, canonical_fixed: true, robots_back: true };
  const conditionKey = (site_id, code, page) => 'watch:' + S(site_id) + ':' + (FAMILY[code] || code) + ':' + hash(ukey(page));
  /** The condition of a stored alert row: its own key, or read back from a message id written before section 194. */
  const conditionOf = (row) => {
    const r = row || {};
    if (S(r.condition_key)) {
      const m = S(r.condition_key).match(/^watch:(.+):([a-z_]+):([0-9a-f]{8})$/); if (!m) return null;
      // CR17-FX-INDEX (L1): a "canonical removed" row stored under the shared canonical family (its message id names the code) is its own condition
      if (m[2] === 'canonical' && /^watch:.+:canonical_removed:[0-9a-f]{8}:/.test(S(r.message_id))) return { key: 'watch:' + m[1] + ':canonical_tag:' + m[3], site_id: m[1], family: 'canonical_tag', page_hash: m[3] };
      return { key: S(r.condition_key), site_id: m[1], family: m[2], page_hash: m[3] };
    }
    const m = S(r.message_id).match(/^watch:(.+):([a-z_]+):([0-9a-f]{8}):\d{4}-\d\d-\d\d$/);
    if (!m || m[2] === 'recheck') return null;
    const family = FAMILY[m[2]] || m[2];
    return { key: 'watch:' + m[1] + ':' + family + ':' + m[3], site_id: m[1], family, page_hash: m[3], legacy: true, code: m[2] };
  };
  const isOpenRow = (r) => S((r || {}).status || 'new') !== 'resolved' && !S((r || {}).resolved_at);
  /** Is the condition of `family` still true of a page read today? null = this family cannot be judged from one reading (an event). */
  const present = (family, p, ctx) => {
    if (!p || p.ok === false) return null;
    const st = n0(p.status);
    if (family === 'status') return st >= 400;
    if (family === 'noindex') return !!p.noindex;
    // CR17-FX-INDEX (review R1 M2): robots.txt not read today or unreachable (Google keeps its last copy) cannot judge a block: unknown, kept open
    if (family === 'robots_blocked') return p.robots_blocked === true ? true : p.robots_blocked === false ? false : null;
    if (family === 'redirect') return st >= 300 && st < 400 && S((ctx || {}).verdict) !== 'moved' && S((ctx || {}).verdict) !== 'locale';
    if (family === 'canonical') return st >= 200 && st < 300 && !!S(p.canonical) && !same(p.canonical, p.url);
    // CR17-FX-INDEX (review R1 L1): "canonical removed" lasts while the page has no canonical tag
    if (family === 'canonical_tag') return st >= 200 && st < 300 ? !S(p.canonical) : null;
    // CR17-FX-INDEX (L3): a removed redirect is a notice until the address redirects permanently again
    if (family === 'move') return (st === 301 || st === 308) ? false : null;
    return null;   // title / robots rules: events, open until somebody marks them seen
  };
  const RESOLVED_TEXT = {
    status: (p) => n0(p.status) >= 300 && n0(p.status) < 400 ? 'The address no longer answers with an error: it now redirects (' + n0(p.status) + ').' : 'The page answers ' + n0(p.status) + ' again.',
    noindex: () => 'The page no longer asks search engines to leave it out.',
    robots_blocked: () => 'robots.txt no longer blocks this page.',
    redirect: (p, ctx) => n0(p.status) >= 200 && n0(p.status) < 300 ? 'The page answers at its own address again.'
      : S((ctx || {}).verdict) === 'locale' ? 'The redirect is a language or country version for where our server is, not a move.'
      : 'The page now moves permanently to ' + pathOf((ctx || {}).to || p.location) + ', which works.',
    canonical: () => 'The canonical now points at the page itself.',
    move: () => 'The address redirects permanently again.',
    canonical_tag: (p) => 'The canonical tag is back' + (same(p.canonical, p.url) ? ', pointing at the page itself.' : ', and it names ' + S(p.canonical) + ' as the main version.'),
  };
  /**
   * One run's alert rows for one site. o: { site_id, domain, now, changes, pages (Watch Compare page states with `verdict` / `moved_to`),
   * robots (today's robots state), open (stored alert rows of this site), moved ([{ from, to }] addresses the watch stopped reading because
   * they moved), ran_late (sentence or '') }. -> { rows (exact seo_console_alerts columns), resolved, updated, opened }
   */
  const lifecycle = (o) => {
    const x = o || {}; const nowIso = S(x.now) || new Date().toISOString(); const day = nowIso.slice(0, 10);
    const site_id = S(x.site_id), domain = S(x.domain);
    const openRows = (x.open || []).filter(r => r && isOpenRow(r) && S(r.source || 'page_watch') === 'page_watch');
    const byKey = new Map();
    for (const r of openRows) { const c = conditionOf(r); if (!c || c.site_id !== site_id) continue; if (!byKey.has(c.key)) byKey.set(c.key, { row: r, c }); }
    const pageByHash = new Map((x.pages || []).filter(p => p && p.ok !== false && S(p.url)).map(p => [hash(ukey(p.url)), p]));
    const movedByHash = new Map((x.moved || []).filter(m => m && S(m.from)).map(m => [hash(ukey(m.from)), m]));
    const rows = []; const out = { rows, resolved: 0, updated: 0, opened: 0 };
    const late = S(x.ran_late) ? ' Ran late: ' + S(x.ran_late) : '';
    const base = (r) => ({ site_id, domain, kind: 'page_watch', source: 'page_watch', severity: S(r.severity), subject: S(r.subject).slice(0, 200), summary: S(r.summary).slice(0, 1000),
      received_at: S(r.received_at) || nowIso, message_id: S(r.message_id).slice(0, 200), status: S(r.status) || 'new', condition_key: S(r.condition_key), last_seen_at: S(r.last_seen_at) || S(r.received_at) || nowIso,
      count: n0(r.count) || 1, resolved_at: S(r.resolved_at), resolution: S(r.resolution).slice(0, 500) });
    // CR17-FX-INDEX (review R1 L6): "Mark as seen" (ack_by / ack_at) is written by the app only. A row this run creates starts with both empty; a
    // row it updates or resolves carries neither field, so the upsert (auto-mapped, partial on update) never overwrites a mark saved while the
    // watch ran. FRESH = the columns of a new row.
    const FRESH = { ack_by: '', ack_at: '' };
    const done = new Set();
    const resolve = (k, sentence) => { const e = byKey.get(k); if (!e || done.has(k)) return; done.add(k);
      rows.push({ ...base(e.row), condition_key: k, status: 'resolved', resolved_at: nowIso, resolution: S(sentence).slice(0, 500), last_seen_at: S(e.row.last_seen_at) || S(e.row.received_at) || nowIso });
      out.resolved += 1; };
    const subjectOf = (c, page) => (S(c.label).charAt(0).toUpperCase() + S(c.label).slice(1) + ': ' + (S(page).replace(/^https?:\/\//, '') || domain)).slice(0, 200);
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    // 1. today's changes: open, update or resolve
    for (const c of (x.changes || [])) {
      const page = S(c.url); const k = conditionKey(site_id, c.code, page);
      if (done.has(k)) continue;   // one condition, one row per run
      const text = (S(c.text) + (/^robots_/.test(c.code) ? '' : ' Checked ' + nowIso.slice(0, 16).replace('T', ' ') + ' UTC by the daily key-page watch.') + late).slice(0, 1000);
      if (CLOSES[c.code] || c.severity === 'info') {
        if (byKey.has(k)) { resolve(k, S(c.text)); continue; }
        // good news with nothing open: recorded as a resolved notice, so the history shows it and nobody has to act on it
        rows.push({ ...base({}), ...FRESH, severity: 'info', subject: subjectOf(c, page), summary: text, received_at: nowIso, message_id: ('watch:' + site_id + ':' + S(c.code) + ':' + hash(ukey(page)) + ':' + day).slice(0, 200),
          status: 'resolved', condition_key: k, last_seen_at: nowIso, count: 1, resolved_at: nowIso, resolution: 'Nothing to do.' });
        out.opened += 1; continue;
      }
      if (byKey.has(k) && !done.has(k)) {
        const e = byKey.get(k); done.add(k);
        // a condition only grows louder in place; robots.txt's state is replaced by its new state (missing after unreachable is Medium again), and so
        // is where a redirect lands (CR17-FX-INDEX M1: a gone target fixed back to a temporary redirect is Medium again, never a stale Critical)
        const sev = FAMILY[c.code] === 'robots_state' || FAMILY[c.code] === 'redirect' || (order[c.severity] ?? 5) < (order[S(e.row.severity)] ?? 5) ? c.severity : S(e.row.severity);
        rows.push({ ...base(e.row), condition_key: k, severity: sev, subject: subjectOf(c, page), summary: text, last_seen_at: nowIso, count: (n0(e.row.count) || 1) + 1, status: 'new' });
        out.updated += 1; continue;
      }
      rows.push({ ...base({}), ...FRESH, severity: S(c.severity), subject: subjectOf(c, page), summary: text, received_at: nowIso,
        message_id: ('watch:' + site_id + ':' + S(c.code) + ':' + hash(ukey(page)) + ':' + day).slice(0, 200), status: 'new', condition_key: k, last_seen_at: nowIso, count: 1 });
      done.add(k); byKey.set(k, { row: rows[rows.length - 1], c: { key: k } }); out.opened += 1;
    }
    // 2. the open alerts nobody touched today: still true (seen again) or gone (resolved)
    for (const [k, e] of byKey) {
      if (done.has(k)) continue;
      const fam = e.c.family;
      if (fam === 'robots_state') {
        const rs = x.robots || null; if (!rs || rs.ok === false) continue;
        if (S(rs.state) === 'ok') { resolve(k, 'robots.txt answers again.'); continue; }
        done.add(k); rows.push({ ...base(e.row), condition_key: k, last_seen_at: nowIso, count: (n0(e.row.count) || 1) + 1, status: 'new' }); out.updated += 1; continue;
      }
      const p = pageByHash.get(e.c.page_hash);
      if (!p) {
        const mv = movedByHash.get(e.c.page_hash);
        if (mv && ['status', 'redirect', 'canonical', 'canonical_tag', 'noindex', 'robots_blocked', 'title'].includes(fam)) resolve(k, 'This address now moves permanently to ' + pathOf(mv.to) + ', which works. We watch the new address.');
        continue;   // not read today: nothing is claimed
      }
      const st3 = n0(p.status) >= 300 && n0(p.status) < 400;
      if (st3 && S(p.verdict) === 'moved' && fam !== 'redirect') { resolve(k, 'This address now moves permanently to ' + pathOf(p.moved_to || p.redirect_to) + ', which works. We watch the new address.'); continue; }
      const isNow = present(fam, p, { verdict: p.verdict, to: p.moved_to || p.redirect_to });   // null: cannot be judged today (kept open, nothing claimed)
      if (isNow === null) {
        // an event (title, robots rules) that started before section 194: it stays open until marked seen, but a title alert on a page that
        // moved away is closed with the move
        if (fam === 'title' && n0(p.status) >= 300 && n0(p.status) < 400 && S(p.verdict) === 'moved') resolve(k, 'This address now moves permanently to ' + pathOf(p.moved_to || p.redirect_to) + ', which works.');
        continue;
      }
      if (!isNow) resolve(k, (RESOLVED_TEXT[fam] || (() => 'The condition is gone.'))(p, { to: p.moved_to || p.redirect_to, verdict: p.verdict }));
      else { done.add(k); rows.push({ ...base(e.row), condition_key: k, last_seen_at: nowIso, count: (n0(e.row.count) || 1) + 1, status: 'new' }); out.updated += 1; }
    }
    return out;
  };

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

  return { signals, robotsRead, robotsParse, compare, robotsChange, redirectVerdict, moveUndone, state, worst, recheck, recheckRule, inspectBudget, inspection, coverage, hash,
    changedPages, changeOf, freshFirst, conditionKey, conditionOf, lifecycle, present,
    CODES, FAMILY, RULES, QUOTA_PER_DAY, QUOTA_PER_MINUTE, PER_RUN, PER_AUDIT, FRESH_DAYS, ROBOTS_V,
    helpers: { hostOf, bare, pathOf, ukey, same, strip, S, n0, absUrl, localeRedirect } };
})();
const insp = (() => { try { return $('Parse Inspection').all().map(i => i.json).filter(x => x && !x.skip && !x.skipped && x.url); } catch (e) { return []; } })();
const sites = $('Resolve Properties').all().map(i => i.json);
const stored = (() => { try { return $('Load Page Watch (Site)').all().map(i => i.json).filter(r => r && r.site_id && r.url); } catch (e) { return []; } })();
const S = (v) => String(v == null ? '' : v).trim();
const ukey = PW.helpers.ukey;
const rows = insp.map(x => {
  const s = sites[x.site_idx] || {};
  const prev = stored.find(r => r.site_id === x.site_id && ukey(r.url) === ukey(x.url)) || {};
  const failed = !!x.inspect_error;
  return {
    site_id: S(x.site_id) || S(s.site_id), domain: S(s.domain), url: S(x.url).slice(0, 500), kind: S(x.kind) || S(prev.kind) || 'page',
    weight: Number(prev.weight) || 0, checked_at: S(prev.checked_at), status: Number(prev.status) || 0, location: S(prev.location),
    noindex: prev.noindex === true, noindex_source: S(prev.noindex_source), canonical: S(prev.canonical), canonical_ok: prev.canonical_ok === true,
    title: S(prev.title), title_hash: S(prev.title_hash), titles: Number(prev.titles) || 0, description: S(prev.description), h1: S(prev.h1), h1s: Number(prev.h1s) || 0,
    robots_blocked: prev.robots_blocked === true, robots_hash: S(prev.robots_hash), state: S(prev.state), changes: S(prev.changes),
    last_change_at: S(prev.last_change_at), changed_count: Number(prev.changed_count) || 0, error: S(prev.error),
    // what Google said (or why we could not ask)
    inspect_at: failed ? S(prev.inspect_at) : S(x.checked_at),
    index_state: failed ? S(prev.index_state) : S(x.verdict),
    indexed: failed ? S(prev.indexed) : (x.indexed === true ? 'yes' : x.indexed === false ? 'no' : ''),
    coverage: failed ? S(prev.coverage) : S(x.coverage),
    google_canonical: failed ? S(prev.google_canonical) : S(x.google_canonical),
    last_crawl: failed ? S(prev.last_crawl) : S(x.last_crawl),
    mobile: failed ? S(prev.mobile) : (x.mobile_usable === true ? 'pass' : x.mobile_usable === false ? 'fail' : ''),
    rich_results: failed ? S(prev.rich_results) : (x.rich_results || []).join(', ').slice(0, 300),
    inspect_error: failed ? S(x.not_checked || x.inspect_error).slice(0, 300) : '',
    moved_to: S(prev.moved_to),   // build section 194: the daily watch's confirmed move, carried (this weekly writer never decides it)
    redirect_verdict: S(prev.redirect_verdict),   // CR17-FX-INDEX (M1): where the daily watch saw the redirect land, carried the same way
  };
}).filter(r => r.site_id && r.url);
return rows.length ? rows.map(r => ({ json: r })) : [{ json: { skip: true, reason: 'no inspection to store' } }];
