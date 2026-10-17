// ---- what the site already holds for a search: its pages, its keyword ladders and its unpublished drafts (2026-10-17, re-rating A-1 /
// A-5 / A-23 / A-25; inlined by build_v4.py section 130 and build_api.py where a node asks for the OWN_COVER placeholder) ----
// The re-rating of 2026-10-17 found four paths that recommended work the site had already done or planned:
//   * the keyword report "erp system dubai" (exec 765) said "Build a Dynamics 365 Business Central / Finance & Operations ERP service
//     page" while /dynamics-365-business-central-uae and /dynamics-365-finance-and-operations-uae are live, and gave as secondary keywords
//     the slug of the first, a planned rung of the ladder "erp software uae" and a variant of the ladder "erp implementation dubai";
//   * the verdict "e invoicing software uae" (exec 760) folded five planned pages of the active ladder "e invoicing in uae" and a written
//     draft into the page it said to improve, and asked for "a penalties section" while the site has the penalties article and the rung;
//   * discovery (exec 764) led "Where to start" / "Build first" / "Now" with "erp system dubai" and "erp systems in uae", the searches the
//     ladder "erp software uae" already holds in other words;
//   * the Keyword Check (exec 750) answered "business central partner uae" with `existing: null` beside the live Business Central page.
// One question underneath all four: does something the site owns already answer this search? This kit answers it from three sources -
// the page inventory (through the caller's `matchPage`, SM.matchPage), the keyword ladders (seo_ladders + seo_ladder_settings, the rows
// the CALLER has already passed through the fit gate) and the content log's unpublished drafts - and says HOW it matched, so a report
// can name the page, the ladder or the draft instead of recommending a second one. Pure functions; the harness drives them directly.
const OWN = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'at', 'from', 'near', 'me', 'vs', 'is', 'are', 'what', 'how', 'best', 'top', 'your', 'my']);
  // the same words as _reach.js `overlapTokens` (one search, one page), so "the same search" means the same thing in every path
  const tokens = (s) => { const out = []; for (const t of S(s).toLowerCase().split(/[^a-z0-9]+/)) { if (t.length <= 1 || STOP.has(t)) continue;
    const w = t.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/[^a-z0-9]/g, ''); if (w && !out.includes(w)) out.push(w); } return out; };
  // two words people use for the same product search ("erp system dubai" = "erp software dubai"): applied to both sides, never to one
  const SYN = { system: 'software' };
  const syn = (ts) => [...new Set(ts.map(t => SYN[t] || t))];
  // places: a search for the same thing in another emirate / the country is the same TOPIC, not the same search
  const PLACES = new Set(['uae', 'dubai', 'abu', 'dhabi', 'abudhabi', 'sharjah', 'ajman', 'fujairah', 'rak', 'ra', 'khaimah', 'emirate', 'emirat', 'gcc', 'ksa', 'saudi', 'riyadh', 'jeddah', 'qatar', 'doha', 'bahrain', 'oman', 'muscat', 'kuwait', 'mena', 'middle', 'east', 'arab', 'united']);
  const noPlace = (ts) => ts.filter(t => !PLACES.has(t));
  const jacc = (a, b) => { if (!a.length || !b.length) return 0; const sb = new Set(b); const c = a.filter(t => sb.has(t)).length; return c / (a.length + b.length - c); };
  const inside = (a, b) => a.length > 0 && a.every(t => b.includes(t));
  const RANK = { same: 4, 'other words': 3, variant: 2, 'other place': 1 };
  /** how two searches relate: 'same' (75%+ the same words), 'other words' (the same once system = software), 'variant' (one is the
   *  other plus ONE word, places aside: "erp implementation partner uae" of "erp implementation dubai"), 'other place' (the same words for
   *  another place), or null */
  const relate = (a, b) => {
    const A = tokens(a), B = tokens(b); if (!A.length || !B.length) return null;
    if (jacc(A, B) >= 0.75) return 'same';
    const As = syn(A), Bs = syn(B);
    if (jacc(As, Bs) >= 0.75) return 'other words';
    const Ap = noPlace(As), Bp = noPlace(Bs);
    if (Ap.length >= 2 && Bp.length >= 2) {
      if (jacc(Ap, Bp) >= 0.75) return (As.length === Ap.length && Bs.length === Bp.length) ? 'other words' : 'other place';
      if ((inside(Bp, Ap) && Ap.length - Bp.length === 1) || (inside(Ap, Bp) && Bp.length - Ap.length === 1)) return 'variant';
    }
    return null;
  };
  const HOW = { same: 'the same search', 'other words': 'the same search in other words', variant: 'a close variant of it', 'other place': 'the same topic for another place' };
  const listOf = (v) => (Array.isArray(v) ? v : S(v).split(/[,;\n]+/)).map(x => S(x).toLowerCase()).filter(Boolean);
  const bare = (d) => S(d).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#:].*$/, '');
  /** the site's keyword ladders as one list of searches (each rung keyword, its supporting keywords and the head), archived ladders and
   *  set-aside rungs left out, each with the LADDER's status from seo_ladder_settings (paused / active) beside the row's own status.
   *  `keep(row)` is the caller's fit gate (fitStored) - a stored rung is read back through the gate it was written through. */
  const ladders = (rows, settings, o) => {
    const c = o || {}; const dom = bare(c.domain); const keep = typeof c.keep === 'function' ? c.keep : () => true;
    const st = new Map((Array.isArray(settings) ? settings : []).filter(r => r && r.ladder_id).map(r => [S(r.ladder_id), S(r.status).toLowerCase()]));
    const out = [];
    for (const r of (Array.isArray(rows) ? rows : [])) {
      if (!r || !S(r.ladder_id) || !S(r.keyword)) continue;
      if (dom && bare(r.domain) && bare(r.domain) !== dom) continue;
      const lst = st.get(S(r.ladder_id)) || '';
      if (lst === 'archived' || /^(set_aside|refused|deleted)$/i.test(S(r.status))) continue;
      if (!keep(r)) continue;
      const rung = Number(r.rung) || 0;
      out.push({ ladder_id: S(r.ladder_id), head_keyword: S(r.head_keyword).toLowerCase(), keyword: S(r.keyword).toLowerCase(), rung, part: rung === 4 ? 'head' : 'rung',
        status: S(r.status) || 'planned', ladder_status: lst || null, target_url: S(r.target_url), supporting: listOf(r.supporting).slice(0, 12) });
    }
    return out;
  };
  /** the content log's pages that exist as text but not on the site (written, not ready, started) */
  const drafts = (rows, o) => {
    const dom = bare((o || {}).domain);
    return (Array.isArray(rows) ? rows : []).filter(r => r && S(r.keyword) && (!dom || !bare(r.domain) || bare(r.domain) === dom))
      .filter(r => !/^(published|discarded|deleted|failed)$/i.test(S(r.status)))
      .map(r => ({ keyword: S(r.keyword).toLowerCase(), status: S(r.status) || 'written', ladder_id: S(r.ladder_id), url: S(r.published_url || r.existing_page_url || r.suggested_url) }));
  };
  const best = (cands) => cands.filter(x => x.rel).sort((a, b) => RANK[b.rel] - RANK[a.rel])[0] || null;
  /** the ladder entry that holds a search, with how. `o.self` = { ladder_id, keyword } of the run's own row (never a conflict with itself);
   *  `o.min` = the weakest relation that counts ('variant' by default; 'other place' to also catch the same topic elsewhere). */
  const ladderOf = (index, kw, o) => {
    const c = o || {}; const min = RANK[c.min || 'variant'];
    const self = c.self || {}; const selfKw = S(self.keyword).toLowerCase();
    const cands = [];
    for (const e of (index || [])) {
      if (self.ladder_id && e.ladder_id === S(self.ladder_id) && (e.keyword === selfKw || (e.part === 'head' && e.head_keyword === selfKw))) continue;
      for (const [k, via] of [[e.keyword, 'keyword'], ...e.supporting.map(s => [s, 'supporting'])]) {
        const rel = relate(kw, k); if (rel && RANK[rel] >= min) cands.push({ ...e, matched: k, via, rel });
      }
    }
    const b = best(cands); if (!b) return null;
    return { kind: 'ladder', ladder_id: b.ladder_id, head_keyword: b.head_keyword, keyword: b.keyword, rung: b.rung, part: b.part, status: b.status,
      ladder_status: b.ladder_status, target_url: b.target_url, matched: b.matched, via: b.via, how: HOW[b.rel], relation: b.rel };
  };
  const draftOf = (list, kw, o) => {
    const c = o || {}; const min = RANK[c.min || 'other words']; const selfKw = S(c.self_keyword).toLowerCase();
    const b = best((list || []).filter(d => d.keyword !== selfKw).map(d => ({ ...d, rel: relate(kw, d.keyword) })).filter(d => d.rel && RANK[d.rel] >= min));
    return b ? { kind: 'draft', keyword: b.keyword, status: b.status, url: b.url, ladder_id: b.ladder_id, how: HOW[b.rel], relation: b.rel } : null;
  };
  const ukey = (u) => bare(u) + S(u).toLowerCase().replace(/^https?:\/\/[^\/]+/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  /** what the site already holds for `kw`: a page (ctx.matchPage), then a ladder, then a draft - the first that answers, or null.
   *  ctx = { matchPage(kw) -> { url, title, matched_by } | null, ladders, drafts, exclude_urls: [the page this run improves], self } */
  const claim = (kw, ctx) => {
    const c = ctx || {};
    const skip = new Set((c.exclude_urls || []).filter(Boolean).map(ukey));
    const p = typeof c.matchPage === 'function' ? c.matchPage(kw) : null;
    if (p && S(p.url) && !skip.has(ukey(p.url))) return { kind: 'page', url: S(p.url), title: S(p.title), matched_by: S(p.matched_by) || 'inventory', how: 'a page of yours targets it' };
    const l = ladderOf(c.ladders, kw, { self: c.self, min: c.min_ladder });
    if (l) return l;
    return draftOf(c.drafts, kw, { self_keyword: (c.self || {}).keyword });
  };
  /** one line a customer reads: "your page /x", "your ladder "y" (rung page "z", planned)", "your draft "z" (not ready)" */
  const sayOf = (x) => {
    if (!x) return '';
    const path = (u) => S(u).replace(/^https?:\/\/[^/]+/i, '') || '/';
    if (x.kind === 'page') return 'your page ' + path(x.url) + (x.title ? ' ("' + x.title + '")' : '');
    if (x.kind === 'ladder') return 'your keyword ladder "' + x.head_keyword + '"' + (x.ladder_status === 'paused' ? ' (paused)' : '') + ' — ' + (x.part === 'head' ? 'its main page' : 'its rung ' + x.rung + ' page') + ' "' + x.keyword + '" (' + x.status + ')' + (x.via === 'supporting' ? ', which also targets "' + x.matched + '"' : '');
    return 'your draft "' + x.keyword + '" (' + x.status + ', not published yet)';
  };
  /** the site's own words that set a page / rung apart from `kw`: its tokens minus the search's, places and generic words left out */
  const GENERIC = new Set(['page', 'service', 'solution', 'software', 'company', 'compan', 'partner', 'guide', 'complete', 'tech', 'uae', 'best', 'top', 'list', 'new', 'cost', 'price']);
  const distinct = (text, kw) => { const k = new Set(syn(tokens(kw))); return syn(tokens(text)).filter(t => !k.has(t) && !PLACES.has(t) && !GENERIC.has(t) && !/^\d+$/.test(t)); };
  /** the prompt block: what the site already has on this topic, so the model never proposes it as new */
  const text = (ctx, kw, o) => {
    const c = ctx || {}; const lim = (o && o.max) || 8;
    const want = noPlace(syn(tokens(kw)));
    const near = (k) => { const t = syn(tokens(k)); return want.some(w => t.includes(w)); };
    const lines = [];
    const pages = (c.pages || []).slice(0, lim);
    if (pages.length) lines.push('Pages of the site on this topic: ' + pages.map(p => (S(p.url).replace(/^https?:\/\/[^/]+/i, '') || '/') + (p.title ? ' ("' + S(p.title).slice(0, 80) + '")' : '')).join('; '));
    const lads = new Map();
    for (const e of (c.ladders || [])) { if (!(near(e.keyword) || near(e.head_keyword) || e.supporting.some(near))) continue;
      const k = e.ladder_id; if (!lads.has(k)) lads.set(k, { head: e.head_keyword, status: e.ladder_status, rungs: [] });
      lads.get(k).rungs.push(e.keyword + ' (' + e.status + ')'); }
    for (const [, l] of [...lads.entries()].slice(0, 6)) lines.push('Keyword ladder "' + l.head + '"' + (l.status ? ' (' + l.status + ')' : '') + ' - its pages: ' + l.rungs.slice(0, 8).join(', '));
    const dr = (c.drafts || []).filter(d => near(d.keyword)).slice(0, 6);
    if (dr.length) lines.push('Pages written but not published yet: ' + dr.map(d => d.keyword + ' (' + d.status + ')').join(', '));
    return lines.join('\n');
  };
  return { tokens, relate, ladders, drafts, ladderOf, draftOf, claim, sayOf, distinct, text, HOW, PLACES, ukey };
})();
