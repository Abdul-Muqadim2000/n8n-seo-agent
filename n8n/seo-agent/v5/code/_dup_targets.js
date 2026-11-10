// ---- DUP: "the site already has a page aimed at this search", one rule (page-quality W0-D, 2026-10-29; PLAN §2.1, RE M7, R4 G4) ----
// Inlined by build_v4.py into *Parse Verdict* (before the brief: a hit asks the client first) and *Originality Check* (after the copy:
// the safety net it always was; the Page Finalize and the Publish Check copy that node's code). Before this the rule lived only in the
// late check, so run 3299 paid for a brief, a copy and three editor rounds before it learned the site already had a page for the search.
// The rule: the keyword's words (3+ characters) against each inventory page's title, H1 and address. A page carrying 75% or more of them
// is a duplicate target. Since W0-D the share must ALSO hold WEIGHTED by how rare each word is on this site (a word every page carries, "dynamics"
// or "365" on a Dynamics partner's site, says less than one only a page or two carry, "system" or "erp"), so a guide asking "is
// microsoft dynamics 365 an erp system" is not the duplicate of a Business Central service page that shares the site's own product words
// (owner priority 2026-10-29: the ranking guide of exec 949 must never be held or flagged by this rule), while "microsoft dynamics erp"
// and "dynamics 365 erp system" are recognised as the guide's own searches. With every word equally rare (a small site) it is the old
// unweighted share. No URL constructor (n8n sandbox), no defineProperty.
//   targets(keyword, pages, opts) -> { targets, partial, self, keyword_words, basis }
//     opts.skip   URLs never compared (the pages this run read and compares by text, the page being improved)
//     opts.self   URLs of this run's own page (the ladder's planned address); with opts.self_aware a page at one of them is this run's own
//                 page: listed in `self`, never a duplicate of itself
//     opts.slug_self  (before the brief only) a page whose last address segment is the keyword's own slug is the keyword's own page too:
//                 the run improves it (the verdict's existing page) rather than duplicating it. Not in the late check: there, an unread
//                 page at the keyword's own address IS the clearest duplicate (harness CTF5)
//     opts.ladder a page of a keyword ladder: a page that carries only PART of the keyword's weight is the ladder's planned neighbour
//                 (the rung links up to it), listed in `partial` as advice; only a page carrying all of it is a duplicate target
//     opts.max    targets kept (3)
//     opts.market the run's market (ISO-2 or the country name, e.g. "United Arab Emirates"): a page whose title / heading / address names only
//                 places OUTSIDE that market, for a keyword that names none, is aimed at another market's search: listed in `other_market`, never
//                 a duplicate target (client report 2026-11-10: "ai automation services" for the UAE was held as the duplicate of devaicon's
//                 "AI Automation Services in Pakistan" page; "ai" has 2 letters, so the rule compared only "automation services")
const DUP = (() => {
  const S = (v) => String(v == null ? '' : v);
  // the fit gate's gazetteer (FIT_PLACES_SRC in _fit_gate.js), put here by the build (kit_src.py) so the two never drift; [] = no market check
  const PLACES_SRC = /*__FIT_PLACES_SRC__*/[];
  const PL = PLACES_SRC.flatMap(([iso, ws]) => S(ws).split('|').map(w => ({ w, iso: S(iso).split(' ') }))).sort((a, b) => b.w.split(' ').length - a.w.split(' ').length || b.w.length - a.w.length);
  const placeText = (t) => ' ' + S(t).toLowerCase().replace(/\./g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const placesIn = (t) => { let x = placeText(t); const out = [];
    for (const p of PL) { const k = ' ' + p.w + ' '; let i = x.indexOf(k); while (i >= 0) { out.push({ word: p.w, iso: p.iso }); x = x.slice(0, i) + ' | ' + x.slice(i + k.length - 1); i = x.indexOf(k); } }
    return out; };
  const marketOf = (m) => { const s0 = S(m).trim(); if (/^[A-Za-z]{2}$/.test(s0)) return s0.toUpperCase(); const ps = placesIn(s0); return ps.length && ps.every(p => p.iso.length === 1 && p.iso[0] === ps[0].iso[0]) ? ps[0].iso[0] : ''; };
  // the place words that put a page in ANOTHER market than `market` (null: same market, no place named, or the keyword itself names elsewhere)
  const otherMarket = (keyword, page, market) => { const m = marketOf(market); if (!m || !PL.length) return null;
    if (placesIn(keyword).some(p => !p.iso.includes(m))) return null;
    const pp = placesIn(S(page && page.title) + ' ' + S(page && page.h1) + ' ' + S(page && page.url).replace(/^https?:\/\/[^\/]+/i, '').replace(/[-_\/]+/g, ' '));
    if (!pp.length || pp.some(p => p.iso.includes(m))) return null;
    return [...new Set(pp.map(p => p.word))]; };
  const SHARE = 75, MAX = 3;
  // the tokenizer of SHG (_shingle.js), character for character, so the late check finds what it always found
  const norm = (t) => S(t)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/g, ' ')
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .toLowerCase().replace(/[^a-z0-9'\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = (t) => { const s = norm(t); return s ? s.split(' ') : []; };
  const toks = (t) => new Set(words(t).filter(w => w.length > 2));
  const keyOf = (u) => S(u).toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '');
  const pathKey = (u) => keyOf(u).replace(/^https?:\/\/[^\/]+/, '');
  const slugOf = (u) => { const p = pathKey(u).split('/').filter(Boolean); return p.length ? p[p.length - 1].replace(/\.[a-z]{2,5}$/, '') : ''; };
  const slugify = (k) => S(k).toLowerCase().replace(/[‘’ʼ']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // the page's words: title + H1 + address (the address with its separators as spaces, exactly as the late check always read it)
  const pageToks = (p) => toks(S(p && p.title) + ' ' + S(p && p.h1) + ' ' + S(p && p.url).replace(/[-_/]+/g, ' '));
  const targets = (keyword, pages, opts) => {
    const o = opts || {};
    const kw = toks(keyword);
    const out = { targets: [], partial: [], self: [], other_market: [], keyword_words: kw.size, basis: '' };
    if (!kw.size) { out.basis = 'the keyword has no word of 3 letters or more to compare'; return out; }
    const list = (Array.isArray(pages) ? pages : []).filter(p => p && S(p.url));
    const sets = list.map(pageToks);
    // how many of the site's pages carry each keyword word: the rarer, the more it says about a page
    const N = sets.length;
    const w = {};
    for (const t of kw) { let df = 0; for (const s of sets) if (s.has(t)) df++; w[t] = Math.log((N + 1) / (df + 1)) + 1; }
    const total = [...kw].reduce((a, t) => a + w[t], 0);
    const skip = new Set([...(o.skip || [])].map(keyOf).filter(Boolean));
    const selfP = new Set([...(o.self || [])].map(pathKey).filter(Boolean));
    const kslug = slugify(keyword);
    const max = Number(o.max) > 0 ? Number(o.max) : MAX;
    for (let i = 0; i < list.length; i++) {
      const p = list[i]; const k = keyOf(p.url);
      if (!k || skip.has(k)) continue;
      const set = sets[i]; if (!set.size) continue;
      let hit = 0, hw = 0;
      for (const t of kw) if (set.has(t)) { hit++; hw += w[t]; }
      const plain = Math.round((hit / kw.size) * 100);
      const share = Math.round((hw / total) * 100);
      // both measures must reach the bar: the weighting only ever REMOVES a match the plain share made (a page that shares only the site's
      // common words), it never adds one the late check did not make before
      if (plain < SHARE || share < SHARE) continue;
      const row = { url: S(p.url), title: S(p.title), keyword_words_shared_pct: plain, weighted_pct: share };
      const om = o.market ? otherMarket(keyword, p, o.market) : null;
      if (om) { out.other_market.push({ ...row, places: om }); continue; }
      if (o.self_aware && ((selfP.size && selfP.has(pathKey(p.url))) || (o.slug_self && kslug && slugOf(p.url) === kslug))) { out.self.push(row); continue; }
      if (o.ladder && hit < kw.size) { out.partial.push(row); continue; }
      out.targets.push(row);
      if (out.targets.length >= max) break;
    }
    out.basis = 'the keyword\'s ' + kw.size + ' word(s) of 3+ letters against the title, main heading and address of ' + N + ' page(s) of the site, '
      + 'a page carrying ' + SHARE + '% or more of those words, and of their weight when each word counts by how few of the site\'s pages carry it, is aimed at the same search';
    return out;
  };
  return { targets, words, slugify, slugOf, otherMarket, marketOf, placesIn, SHARE, MAX };
})();
