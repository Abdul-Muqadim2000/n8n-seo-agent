// ---- a page that moved permanently: our own rows follow it (client report 2026-11-17, devaicon.com F10; build section 194) ----
// The client moved its service pages to /services/... with permanent (301) redirects. Page Watch, Index coverage and the page inventory all
// saw the move, and nothing followed it: the ladder row, the content log, the AI question and the AI readiness row kept the old address, so
// every screen showed a page that redirects as the page that answers its search, and the Rank Tracker would have called the moved page "a
// different page of yours" once Google ranked it. One rule, used by the daily Page Watch (which writes the follow) and the Rank Tracker
// (which compares addresses):
//   * a move is a 301 or 308 seen on TWO reads (the stored reading and today's), to an address on the same site that answers 200, asks to be
//     indexed and names itself as its main version (the watch's redirect verdict says `moved`);
//   * never to the home page (Google treats a deep page sent to the home page like a page that is gone), never to another site;
//   * a move only of the host (bare -> www) changes no stored row: addresses are compared host-agnostically everywhere already;
//   * a ladder or content-log row never follows onto an address another search already owns (one search, one page): it is refused and named.
// The address is kept exactly as the server serves it (capital letters included). The n8n Code sandbox has no URL constructor: regexes only.
const MV = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase() : ''; };
  const bare = (h) => S(h).toLowerCase().replace(/^www\./, '');
  const pathOf = (u) => { const p = S(u).replace(/^https?:\/\/[^\/]*/i, '').replace(/[?#].*$/, ''); return p || '/'; };
  const ukey = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '') || S(u).toLowerCase();
  const norm = (k) => S(k).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const PERMANENT = [301, 308];
  /** A Location header made absolute against the address that sent it ('' when there is none). */
  const abs = (location, base) => {
    const l = S(location); if (!l) return '';
    if (/^https?:\/\//i.test(l)) return l;
    const origin = (S(base).match(/^(https?:\/\/[^\/?#]+)/i) || [])[1] || '';
    if (!origin) return '';
    if (/^\/\//.test(l)) return (S(base).match(/^(https?:)/i) || ['', 'https:'])[1] + l;
    if (l.charAt(0) === '/') return origin + l;
    const dir = pathOf(base).replace(/[^\/]*$/, '');
    return origin + (dir || '/') + l;
  };
  const sameSite = (a, b) => !!hostOf(a) && bare(hostOf(a)) === bare(hostOf(b));
  const isHome = (u) => pathOf(u).replace(/\/+$/, '') === '';
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
  /**
   * Is this redirect a confirmed move? `now` / `prev`: { url, status, location } (prev = the stored reading), `verdict`: the watch's redirect
   * verdict of today's target ('moved' = answers 200, indexable, its own main version). -> { ok, to, host_only, reason }
   * CR17-FX-INDEX (review R1 L2): ctx { reads: Map ukey(url) -> today's own read (no redirect followed), moves: confirmed moves (fromWatch) }:
   * the move goes to where the redirects END. A target that is itself confirmed as moved is followed to its end; a target whose own read today
   * is another redirect is a chain not yet ended: refused until that hop is confirmed too (our rows never land on an address that redirects).
   * M4: a language / country redirect for our server's location is never a move.
   */
  const confirm = (now, prev, verdict, ctx) => {
    const n = now || {}, p = prev || {}; const c = ctx || {};
    const st = Number(n.status) || 0, pst = Number(p.status) || 0;
    const to = abs(n.location, n.url);
    const no = (reason) => ({ ok: false, to, host_only: false, reason });
    if (!PERMANENT.includes(st)) return no('not a permanent redirect (' + (st || 'no answer') + ')');
    if (!to) return no('the redirect names no address');
    if (!sameSite(to, n.url)) return no('the redirect leaves the site');
    if (isHome(to) && !isHome(n.url)) return no('a deep page sent to the home page is not a move');
    if (localeRedirect(n.url, to)) return no('a language or country redirect for where our server is, not a move');
    if (S(verdict) !== 'moved') return no('the new address does not work as a page of its own yet');
    if (!PERMANENT.includes(pst) || ukey(abs(p.location, p.url || n.url)) !== ukey(to)) return no('seen once so far; a move is confirmed on the second read');
    // ctx values may be Maps (Watch Compare) or plain lists (rows: { url, moved_to } / reads: { url, status, location })
    const mvs = c.moves && typeof c.moves.get === 'function' ? c.moves : Array.isArray(c.moves) ? fromWatch(c.moves) : null;
    const end = (mvs && finalOf(to, mvs)) || to;
    if (!sameSite(end, n.url) || (isHome(end) && !isHome(n.url))) return no('the redirects end on a page that is not a move');
    const tr = !c.reads ? null : typeof c.reads.get === 'function' ? c.reads.get(ukey(end)) : (Array.isArray(c.reads) ? c.reads : []).find(x => x && ukey(x.url) === ukey(end)) || null;
    const ts = tr && tr.ok !== false ? Number(tr.status) || 0 : 0;
    if (ts >= 300 && ts < 400 && ukey(abs(tr.location, end)) !== ukey(end)) return no('the new address redirects again (to ' + pathOf(abs(tr.location, end)) + '); a move is confirmed where the redirects end');
    return { ok: true, to: end, host_only: ukey(end) === ukey(n.url), reason: '' };
  };
  /**
   * The moves known from the watch's stored rows: a confirmed `moved_to`, or a permanent redirect with its target (enough to say two
   * addresses are one page). -> Map ukey(from) -> { from, to, confirmed }
   */
  const fromWatch = (rows) => {
    const m = new Map();
    for (const r of (rows || [])) {
      const from = S(r && r.url); if (!from) continue;
      const confirmed = S(r.moved_to);
      const to = confirmed || (PERMANENT.includes(Number(r.status) || 0) ? abs(r.location, from) : '');
      if (!to || !sameSite(to, from) || ukey(to) === ukey(from)) continue;
      if (isHome(to) && !isHome(from)) continue;
      if (!confirmed && localeRedirect(from, to)) continue;   // CR17-FX-INDEX (M4): a language / country redirect is not a move
      m.set(ukey(from), { from, to, confirmed: !!confirmed });
    }
    return m;
  };
  /** Where an address ends after the known moves (up to 5 hops, as Google follows them); '' when it did not move. */
  const finalOf = (url, moves) => {
    let cur = S(url), seen = new Set(), hops = 0;
    while (moves && moves.get(ukey(cur)) && hops < 5) {
      const k = ukey(cur); if (seen.has(k)) return ''; seen.add(k);
      cur = moves.get(k).to; hops += 1;
    }
    return hops ? cur : '';
  };
  /** Two addresses are one page when they are the same address or one moved (permanently) to the other. */
  const samePage = (a, b, moves) => {
    if (!S(a) || !S(b)) return false;
    if (ukey(a) === ukey(b)) return true;
    const fa = finalOf(a, moves) || S(a), fb = finalOf(b, moves) || S(b);
    return ukey(fa) === ukey(fb);
  };
  /**
   * The stored rows that follow a set of confirmed moves on one site. `moves`: [{ from, to }] (confirmed, not host-only).
   * rows: { ladders, logs, targets, aiPages } (n8n Data Table rows). -> { ladders, logs, targets, ai_pages_update, ai_pages_delete, refused }
   * Ownership (one search, one page): the address a row moves to must not already be the page of ANOTHER search in the ladders or the content
   * log; an AI question and an AI readiness row follow the page whatever it answers (they describe the page, they do not claim it).
   */
  const plan = (moves, rows, o) => {
    const opts = o || {};
    const R = rows || {};
    const domain = bare(S(opts.domain));
    const onSite = (r) => !domain || bare(S(r.domain).replace(/^https?:\/\//, '').replace(/[\/?#].*$/, '')) === domain || S(r.site_id) === S(opts.site_id);
    const ladders = (R.ladders || []).filter(r => r && onSite(r));
    const logs = (R.logs || []).filter(r => r && onSite(r));
    const out = { ladders: [], logs: [], targets: [], ai_pages_update: [], ai_pages_delete: [], refused: [] };
    // who owns an address today: the keyword of every ladder page and published content-log page there
    // CR17-FX-INDEX (review R1 M3): plus every keyword this run already moved onto it (`claimed`), so two searches' pages moved onto ONE new
    // address the same day are treated like two days apart: the first follows, the second is refused and named
    const claimed = new Map();
    const claim = (url, kw) => { const k = ukey(url); if (!claimed.has(k)) claimed.set(k, new Set()); claimed.get(k).add(norm(kw)); };
    const owners = (url) => {
      const k = ukey(url); const set = new Set(claimed.get(k) || []);
      for (const l of ladders) if (S(l.target_url) && ukey(l.target_url) === k) set.add(norm(l.keyword));
      for (const l of logs) if (S(l.published_url) && ukey(l.published_url) === k) set.add(norm(l.keyword));
      return set;
    };
    for (const mv of (moves || [])) {
      const from = S(mv.from), to = S(mv.to);
      if (!from || !to || ukey(from) === ukey(to)) continue;
      if (!sameSite(to, from) || (isHome(to) && !isHome(from))) { out.refused.push({ table: 'all', key: from, from, to, reason: 'not a move we follow' }); continue; }
      const otherOwner = (kw) => [...owners(to)].find(x => x && x !== norm(kw)) || '';
      for (const l of ladders) {
        if (!S(l.target_url) || ukey(l.target_url) !== ukey(from)) continue;
        if (!(S(l.status) === 'published' || l.page_exists === true || l.page_exists === 'true')) continue;
        const other = otherOwner(l.keyword);
        if (other) { out.refused.push({ table: 'seo_ladders', key: S(l.ladder_id) + ' / ' + S(l.keyword), from, to, reason: 'the new address is already the page of "' + other + '"' }); continue; }
        out.ladders.push({ ladder_id: S(l.ladder_id), keyword: S(l.keyword), from: S(l.target_url), target_url: to }); claim(to, l.keyword);
      }
      for (const l of logs) {
        if (!S(l.published_url) || ukey(l.published_url) !== ukey(from)) continue;
        const other = otherOwner(l.keyword);
        if (other) { out.refused.push({ table: 'seo_content_log', key: S(l.site_id) + ' / ' + S(l.keyword), from, to, reason: 'the new address is already the page of "' + other + '"' }); continue; }
        out.logs.push({ site_id: S(l.site_id), keyword: S(l.keyword), from: S(l.published_url), published_url: to }); claim(to, l.keyword);
      }
      for (const t of (R.targets || [])) {
        if (!t || !onSite(t) || !S(t.page_url) || ukey(t.page_url) !== ukey(from)) continue;
        out.targets.push({ target_id: S(t.target_id), from: S(t.page_url), page_url: to });
      }
      const pages = (R.aiPages || []).filter(p => p && onSite(p));
      const old = pages.filter(p => ukey(p.url) === ukey(from));
      const hasNew = pages.some(p => ukey(p.url) === ukey(to));
      for (const p of old) {
        if (hasNew) out.ai_pages_delete.push({ site_id: S(p.site_id), url: S(p.url), to });
        else out.ai_pages_update.push({ site_id: S(p.site_id), from: S(p.url), url: to });
      }
    }
    return out;
  };
  return { abs, confirm, fromWatch, finalOf, samePage, plan, localeRedirect, helpers: { ukey, hostOf, bare, pathOf, sameSite, isHome, norm }, PERMANENT };
})();
