// ---- C12 (2026-10-22, scorecard 2026-10-17 §3.3): LINKS TO THE NEW PAGE FROM THE SITE'S OWN LIVE PAGES (inlined through the INBOUND marker) ----
// A content run linked the new page out to the site and the ladder planned its up / down links, but no live page was ever proposed to
// link TO the new page, so a page went live as an orphan unless the owner thought of it ("add 2-3 links to this page from existing pages"
// was the whole advice). The leaders name the pages, the place and the words. This kit does that from what the run already has:
//   INB.target({ url, keyword, md, title, h1, secondary, kind })   what the new page is about (weighted words, its H2 / H3 headings)
//   INB.candidates(pages, target, { domain, gone, max })          the site's own pages that share the most SPECIFIC words with it (a word
//                                                                  most pages carry counts for little); never the target itself, a gone
//                                                                  page, a legal / contact / login page or another host; the home page only
//                                                                  when nothing else fits
//   INB.read(html)                                                 { noindex, hrefs, sections: [{ heading, text }], title }
//   INB.linksTo(hrefs, targetUrl)                                  true when the page already links to the target (host-agnostic)
//   INB.pick(cands, fetched, target, { min, max })                 3-5 verified picks: the page answered 200, is not noindex and does
//                                                                  not link to the target yet; each with the section it fits under, a
//                                                                  varied anchor (the new page's own topic words, at most one exact match)
//                                                                  and a ready sentence; every page left out keeps its reason
//   INB.checklist(res)                                             the publish-checklist line ("Add these links from your existing pages")
// Free: the pages are the site's own (inventory + one plain GET each), nothing paid. Customer text: plain words, no dashes as punctuation.
const INB = (() => {
  const S = (v) => String(v == null ? '' : v).trim();
  const keyOf = (u) => S(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const pathOf = (u) => S(u).replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/(.)\/+$/, '$1') || '/';
  const STOP = new Set(('the and for with from your our what how why who are you its into about this that these those they them their there here when which will can '
    + 'does did should would not all any each more most other some such only own same very per via use using get best top new page pages home index www com html htm php '
    + 'aspx of to in on at by an or is it we us be do as if my no so up vs').split(' '));
  const PLACES = new Set('uae dubai abu dhabi sharjah ajman emirates gcc ksa saudi qatar doha riyadh oman bahrain kuwait'.split(' '));
  const stem = (t) => t.length >= 5 ? t.replace(/(ations?|ings?|ants?|ers?)$/, '').replace(/s$/, '').replace(/e$/, '') : t;
  const words = (s) => S(s).toLowerCase().replace(/&amp;|&/g, ' and ').split(/[^a-z0-9]+/).filter(t => t.length >= 2 && !STOP.has(t) && !/^\d+$/.test(t)).map(stem);
  const decode = (s) => S(s).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)));
  const textOf = (h) => decode(S(h).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const SKIP_PATH = /\/(?:privacy|cookies?|cookie-policy|terms|legal|security|imprint|impressum|contact(?:-us)?|careers?|jobs?|login|sign-?in|sign-?up|register|cart|checkout|account|search|tags?|category|categories|author|feed|wp-admin|thank-you)(?:\/|$)|\.(?:pdf|jpe?g|png|gif|webp|svg|xml|txt|zip)$/i;
  const brandless = (title) => { const parts = S(title).split(/\s+[|]\s+|\s+[-–—]\s+/); return parts.length > 1 && parts[parts.length - 1].split(/\s+/).length <= 4 ? parts.slice(0, -1).join(' ') : S(title); };

  // what the new page is about: the keyword weighs most, then its H1 / title, then its headings and secondary keywords
  const target = (t) => {
    const md = S(t && t.md);
    const heads = [...md.matchAll(/^(#{2,3})\s+(.+)$/gm)].map(x => ({ level: x[1].length, text: S(x[2]).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '') }));
    const h1 = S((t && t.h1) || (md.match(/^#\s+(.+)$/m) || [])[1] || '');
    const W = new Map(); const add = (s, w) => { for (const x of new Set(words(s))) W.set(x, Math.max(W.get(x) || 0, w)); };
    for (const h of heads) add(h.text, 0.5);   // a heading names a part of the page, not what it is about
    for (const k of (Array.isArray(t && t.secondary) ? t.secondary : [])) add(k, 1);
    add(h1, 2); add(brandless(t && t.title), 2); add(t && t.keyword, 3);
    for (const p of PLACES) if (W.has(p)) W.set(p, 0.25);   // a place name says where, not what the page is about
    return { url: S(t && t.url), keyword: S(t && t.keyword), h1, title: S(t && t.title), kind: S(t && t.kind) || 'service', heads, weights: W };
  };

  const candidates = (pages, T, o) => {
    const opt = o || {}; const dom = S(opt.domain).toLowerCase().replace(/^www\./, '');
    const gone = new Set((Array.isArray(opt.gone) ? opt.gone : []).map(keyOf));
    const tKey = keyOf(T.url), seen = new Set(), list = [];
    for (const p of (Array.isArray(pages) ? pages : [])) {
      if (!p || !S(p.url)) continue;
      const k = keyOf(p.url), h = hostOf(p.url), path = pathOf(p.url);
      if (!k || seen.has(k) || k === tKey) continue; seen.add(k);
      if (dom && h !== dom && !h.endsWith('.' + dom)) continue;
      if (gone.has(k) || p.gone === true || [404, 410].includes(Number(p.status != null ? p.status : p.http_status))) continue;
      if (SKIP_PATH.test(path)) continue;
      const text = [brandless(p.title), S(p.h1), path.replace(/[\/_-]+/g, ' ')].join(' ');
      // a page known only from Search Console, with no title read, is often an old address that no longer answers (RV-1): it counts less
      list.push({ url: S(p.url), path, title: brandless(p.title) || S(p.h1), h1: S(p.h1), home: path === '/', known: !!(S(p.title) || S(p.h1)), toks: new Set(words(text)) });
    }
    const N = list.length || 1, df = new Map();
    for (const c of list) for (const x of c.toks) df.set(x, (df.get(x) || 0) + 1);
    const idf = (x) => Math.log((N + 1) / ((df.get(x) || 0) + 1)) + 0.3;
    for (const c of list) {
      const shared = [...c.toks].filter(x => (T.weights.get(x) || 0) > 0);
      c.score = +(shared.reduce((s, x) => s + T.weights.get(x) * idf(x), 0) * (c.known ? 1 : 0.6)).toFixed(3);
      c.shared = shared;
    }
    // the section page above a matching page lists its siblings, so it is a natural place for the link too (half the child's score)
    const byPath = new Map(list.map(c => [c.path.toLowerCase(), c]));
    for (const c of list.filter(x => x.score > 0 && !x.home)) { const up = c.path.replace(/\/[^\/]+$/, '').toLowerCase(); const P = up && byPath.get(up);
      if (P && !P.home && P.score < c.score / 2) { P.score = +(c.score / 2).toFixed(3); P.shared = c.shared; P.parent_of = c.path; } }
    const fit = list.filter(c => !c.home && c.score > 0).sort((a, b) => b.score - a.score || (b.title ? 1 : 0) - (a.title ? 1 : 0) || a.path.length - b.path.length);
    const home = list.filter(c => c.home);
    const out = fit.length ? fit : home;
    return out.slice(0, Number(opt.max) || 10).map(c => ({ url: c.url, path: c.path, title: c.title, h1: c.h1, home: c.home, score: c.score, shared: c.shared, parent_of: c.parent_of || '' }));
  };

  // a page as the reader sees it: menus, headers and footers left out of the sections (their links still count as links)
  const read = (html) => {
    const raw = S(html);
    const noindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(raw) || /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(raw);
    const hrefs = [...raw.matchAll(/<a\b[^>]*\shref=["']([^"']+)["']/gi)].map(m => decode(m[1]));
    const title = textOf((raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const body = raw.replace(/<(script|style|noscript|svg|nav|header|footer|form)\b[\s\S]*?<\/\1>/gi, ' ');
    const parts = body.split(/(<h[23]\b[^>]*>[\s\S]*?<\/h[23]>)/i);
    const sections = [];
    for (let i = 1; i < parts.length; i += 2) {
      const heading = textOf(parts[i]); const text = textOf(parts[i + 1] || '').slice(0, 1500);
      if (heading && heading.length <= 120) sections.push({ heading, text });
    }
    return { noindex, hrefs, title, sections };
  };
  const linksTo = (hrefs, targetUrl) => {
    const tk = keyOf(targetUrl), tp = pathOf(targetUrl).toLowerCase();
    return (Array.isArray(hrefs) ? hrefs : []).some(h => { const x = S(h); if (/^https?:\/\//i.test(x)) return keyOf(x) === tk;
      if (x.startsWith('/')) return pathOf(x).toLowerCase().replace(/(.)\/+$/, '$1') === tp.replace(/(.)\/+$/, '$1'); return false; });
  };

  // anchors: the new page's own section topics (2-7 words, not a question, not a call to action), then its H1, then the keyword in a phrase
  const ACR = /^(?:ai|uae|gcc|ksa|erp|crm|seo|it|hr|vat|api|saas|b2b|ml|d365|nav|gp|bi|kpi|roi|ux|ui|usa|uk|eu)$/i;
  const CTA = /\b(?:contact|talk to|get in touch|book|call us|get started|next step|faq|frequently asked|conclusion|summary|key takeaways|about the author|ready to)\b/i;
  const tidy = (s) => S(s).replace(/[*_`"]/g, '').replace(/\s+/g, ' ').replace(/^[^a-z0-9]+|[^a-z0-9)]+$/gi, '').replace(/^(?:an?|the)\s+/i, '').trim();
  const lower = (s) => s.split(' ').map((w, i) => ACR.test(w.replace(/[^a-z0-9]/gi, '')) ? w.toUpperCase() : /[A-Z].*[A-Z]/.test(w) ? w : w.toLowerCase()).join(' ');
  const anchors = (T) => {
    const out = [], seen = new Set();
    const push = (s, kind) => { const a = lower(tidy(s)); const n = a.split(/\s+/).filter(Boolean).length; const k = a.toLowerCase();
      if (!a || n < 2 || n > 7 || seen.has(k)) return; seen.add(k); out.push({ text: a, exact: k.replace(/\s+/g, ' ') === T.keyword.toLowerCase(), kind }); };
    for (const h of T.heads.filter(x => x.level === 2)) {
      if (CTA.test(h.text)) continue;
      const segs = h.text.split(/[:?]\s*|\s+[|]\s+/).map(tidy).filter(Boolean)
        .filter(sg => !/^(?:what|why|how|when|where|who|which|is|are|do|does|can|should|will)\b/i.test(sg) || /^how to\b/i.test(sg));
      const best = segs.map(sg => ({ sg, s: words(sg).reduce((t, x) => t + (T.weights.get(x) || 0), 0) })).sort((a, b) => b.s - a.s)[0];
      if (best && best.s > 0) push(best.sg, 'section');
    }
    push(S(T.h1).split(/[:|]/)[0], 'title');
    if (T.keyword) push(T.kind === 'guide' ? 'our guide to ' + T.keyword : T.keyword + ' services', 'phrase');
    if (T.keyword) push(T.keyword, 'keyword');
    return out;
  };
  const SENT = [
    (a) => 'See ' + a + ' for how we approach it.',
    (a) => 'We explain ' + a + ' in more detail on its own page.',
    (a) => 'Read more about ' + a + '.',
    (a) => 'Planning the next step? Start with ' + a + '.',
    (a) => 'Learn more about ' + a + '.'
  ];
  const pick = (cands, fetched, T, o) => {
    const opt = o || {}; const max = Math.min(5, Number(opt.max) || 5), min = Number(opt.min) || 3;
    const byKey = new Map((Array.isArray(fetched) ? fetched : []).map(f => [keyOf(f && f.url), f]));
    const pool = anchors(T); const used = new Set(); let exactUsed = false;
    const picks = [], left_out = [];
    for (const c of (Array.isArray(cands) ? cands : [])) {
      if (picks.length >= max) break;
      const f = byKey.get(keyOf(c.url));
      if (!f) { left_out.push({ url: c.url, reason: 'not checked' }); continue; }
      const st = Number(f.status) || 0;
      if (st !== 200) { left_out.push({ url: c.url, reason: st ? 'the page answered ' + st : 'the page could not be read (' + S(f.error || 'no answer').slice(0, 80) + ')' }); continue; }
      const R = read(f.html);
      if (R.noindex) { left_out.push({ url: c.url, reason: 'the page asks search engines not to index it' }); continue; }
      if (/\b404\b|not found/i.test(R.title)) { left_out.push({ url: c.url, reason: 'the page shows a "not found" page' }); continue; }
      if (linksTo(R.hrefs, T.url)) { left_out.push({ url: c.url, reason: 'the page already links to the new page' }); continue; }
      // where: the section of the source page that shares most of the new page's topic words
      const secScore = (s) => words(s.heading + ' ' + s.text).reduce((t, x) => t + (T.weights.get(x) || 0), 0);
      const sec = R.sections.map(s => ({ s, v: secScore(s) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v)[0];
      // anchor: the unused one whose words fit this page best; at most one exact-match anchor over all picks
      const pageWords = new Set(words([c.title, c.h1, sec ? sec.s.heading + ' ' + sec.s.text : ''].join(' ')));
      const choices = pool.filter(a => !used.has(a.text.toLowerCase()) && !(a.exact && exactUsed))
        .map((a, i) => ({ a, i, fit: words(a.text).filter(x => pageWords.has(x)).length })).sort((x, y) => y.fit - x.fit || x.i - y.i);
      const A = choices.length ? choices[0].a : { text: T.keyword || 'this page', exact: true, kind: 'keyword' };
      used.add(A.text.toLowerCase()); if (A.exact) exactUsed = true;
      const n = picks.length; const tpl = SENT[n % SENT.length];
      picks.push({ source_url: c.url, source_path: c.path, source_title: c.title || R.title, status: st,
        where: sec ? 'in the section "' + sec.s.heading + '"' : 'in the main text (no section headings could be read on the page)', heading: sec ? sec.s.heading : '',
        anchor: A.text, anchor_kind: A.kind, exact_match: !!A.exact, sentence: tpl(A.text), sentence_md: tpl('[' + A.text + '](' + T.url + ')'),
        shared_topics: (c.shared || []).slice(0, 6) });
    }
    const checked = (Array.isArray(cands) ? cands : []).filter(c => byKey.has(keyOf(c.url))).length;
    const basis = picks.length
      ? picks.length + ' of the ' + checked + ' closest live page(s) on the site were checked today: each answered 200 and does not link to the new page yet'
        + (picks.length < min ? '; fewer than ' + min + ' pages qualified, the others are listed with the reason' : '')
      : (checked ? 'none of the ' + checked + ' closest page(s) on the site qualified (each is listed with the reason)' : 'no page of the site shares the new page\'s topic, so no link to it is proposed');
    return { target_url: T.url, picks, left_out, checked, enough: picks.length >= min, basis };
  };
  const checklist = (res) => {
    if (!res || !(res.picks || []).length) return '';
    return 'Add these links from your existing pages ("inbound_links"): ' + res.picks.map(p => 'on ' + (p.source_title || p.source_path) + ' (' + p.source_path + ') ' + p.where + ', link "' + p.anchor + '" to the new page').join('; ');
  };
  return { target, candidates, read, linksTo, anchors, pick, checklist, keyOf, words };
})();
