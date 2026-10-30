// ---- PGA: a separate new page stands apart from the page the client kept (W07-B, 2026-10-31; inlined by build_v4.py section 180) ----
// docs/page-quality-2026-10-29/WAVE06.md section 10, findings 1-3 (K1 "ms 365 erp", the live re-check on the new reader key). After "Write it
// anyway" next to a page the website already has, the new page got its own address (W06-B) but:
//   1. its title tag was the existing page's title tag word for word ("MS 365 ERP in the UAE: Dynamics 365 Partner | <brand>"): two pages,
//      one title, one search, the cannibalisation the hold warns about, and no review step flagged it;
//   2. it did not link to the existing page, although the writer was told to link to it where it helps the reader;
//   3. the blind second read advised "Use the slug ms-365-erp-uae" (the existing page's), and the brief itself said "Publish this brief as a
//      replacement of that URL, not as a second page": both against the client's choice, because neither was told about it.
// This kit is the one place the rule lives. The page the client kept is `existing_page_ignored` (Collect Client Pages: its title tag and
// main heading as this run read them, else as the page inventory has them), plus, on a run the client acknowledged, the pages the duplicate
// check found aimed at the same search. Nothing here ever edits the existing page: only the new page's own lines.
//   PGA.of(prev)              the pages the new page must stand apart from, or null (a rewrite, a ladder page, an ordinary run: null)
//   PGA.same(a, b) / clash    near-equal titles and headings (the brand suffix off, word for word or 80% of the words shared)
//   PGA.fix(md, ap, o)        the new page's title tag and H1 made its own, and one link to the existing page where it helps the reader
//   PGA.check(md, ap)         what Content QA records: still the same title or H1? linked?
//   PGA.brief(brief, prev, o) the brief: its own title and H1, no line that advises replacing or taking over the kept page, the kept page
//                            offered as a link
//   PGA.contractLine(ap)      the line the page contract prints for the brief, the writer, the reviewer and the editor
//   PGA.readerNote(ap, slug)  what the blind second read is told; PGA.againstChoice(text, ap): advice to take over the kept page
// Pure: no clock, no network, no n8n globals, no URL constructor, no Object.defineProperty, no structuredClone (n8n sandbox rules).
const PGA = (() => {
  const S = (v) => String(v == null ? '' : v);
  const CFG = { near: 0.8, title_max: 60, title_min: 15, h1_max: 100, h1_min: 15, anchor_max: 90 };
  const escRe = (s) => S(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const decode = (s) => S(s).replace(/&amp;/gi, '&').replace(/&#0?39;|&apos;|&rsquo;/gi, "'").replace(/&quot;/gi, '"').replace(/&nbsp;/gi, ' ').replace(/&#x27;/gi, "'");
  const plain = (s) => decode(s).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();
  // customer wording: no em / en dashes, curly quotes or the ellipsis character in anything this kit writes (owner rule, 2026-10-19)
  const clean = (s) => S(s).replace(/\s*[\u2014\u2013]\s*/g, ': ').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...').replace(/:\s*:/g, ':').trim();
  const pathOf = (u) => S(u).trim().toLowerCase().replace(/^https?:\/\/[^\/?#]+/, '').replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const slugOf = (u) => { const p = pathOf(u).split('/').filter(Boolean); return p.length ? p[p.length - 1] : ''; };
  // a title without its brand suffix ("... | Nova&", "... - Nova&"): the part that competes in search
  const core = (t) => { const x = plain(t); const m = x.match(/^(.*\S)\s+[|\u00B7\u2022-]\s+[^|\u00B7\u2022]{1,40}$/); return m && m[1].length >= 12 ? m[1].trim() : x; };
  const suffixOf = (t) => { const x = plain(t); const m = x.match(/^.*\S\s+([|\u00B7\u2022-])\s+([^|\u00B7\u2022]{1,40})$/); return m && x.length - m[2].length - 3 >= 12 ? m[2].trim() : ''; };
  const STOP = new Set('the a an and or of for to in on with by at from about this that these those your our its it is are be how what which why when who you we they their them than then into over under more most can will does do not but any all also very just only such'.split(' '));
  const stem = (w) => (w.length > 4 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w);
  const toks = (t) => [...new Set(core(t).toLowerCase().split(/[^\p{L}\p{N}&]+/u).filter(w => w && !STOP.has(w)).map(stem))];
  const sim = (a, b) => { const A = toks(a), B = new Set(toks(b)); if (!A.length || !B.size) return 0; const n = A.filter(w => B.has(w)).length; return n / Math.max(A.length, B.size); };
  const key = (t) => core(t).toLowerCase().replace(/[^\p{L}\p{N}&]+/gu, ' ').trim();
  const same = (a, b) => !!plain(a) && !!plain(b) && (key(a) === key(b) || sim(a, b) >= CFG.near);
  // the keyword as a phrase, or every one of its words (a title may say "ERP Software in the UAE" for "erp software uae")
  const hasKw = (t, kw) => { const k = S(kw).toLowerCase().replace(/[^\p{L}\p{N}&]+/gu, ' ').trim(); if (!k) return true;
    const x = ' ' + plain(t).toLowerCase().replace(/[^\p{L}\p{N}&]+/gu, ' ').trim() + ' '; if (x.includes(' ' + k + ' ')) return true;
    const have = new Set(x.trim().split(' ').map(stem)); return k.split(' ').filter(w => !STOP.has(w)).every(w => have.has(stem(w))); };
  const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with']);
  const titleCase = (k) => S(k).split(/\s+/).filter(Boolean).map((w, i) => i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase()
    : /^(erp|crm|ai|uae|ksa|gcc|vat|seo|sap|hr|it|b2b|saas|api|ms|iot|ml|pdf|faq|d365)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // ---------- the pages the new page stands apart from ----------
  const of = (prev) => {
    const p = prev || {};
    if (p.existing_page && p.existing_page.url) return null;                       // "Improve the existing page": a rewrite at its own address
    if (S(p.existing_page_url).trim()) return null;                                 // a page the client named: a refresh
    if (S(p.ladder_id).trim() && S(p.ladder_target_url).trim()) return null;         // a keyword-ladder page: its ladder planned it (exec 949)
    const pages = []; const seen = new Set();
    const add = (url, title, h1, from, primary) => { const k = pathOf(url); if (!/^https?:\/\//i.test(S(url).trim()) || seen.has(k)) return; seen.add(k);
      pages.push({ url: S(url).trim(), path: k, slug: slugOf(url), title: clean(plain(title)), h1: clean(plain(h1)), from: S(from), primary: !!primary }); };
    const ign = p.existing_page_ignored;
    if (ign && typeof ign === 'object' && S(ign.url).trim() && !S(ign.planned_url).trim()) add(ign.url, ign.title_tag || ign.title, ign.h1, ign.identity_from || '', true);
    const dc = p.duplicate_check;
    if (p.verdict_acknowledged && dc && Array.isArray(dc.targets)) for (const t of dc.targets) if (t && t.url) add(t.url, t.title, t.h1, 'the page inventory', false);
    if (!pages.length) return null;
    const first = pages[0];
    return { url: first.url, path: first.path, slug: first.slug, title: first.title, h1: first.h1, from: first.from, pages,
      checked: pages.some(x => x.title || x.h1), new_slug: S((p.content_brief || {}).slug).replace(/^\/+|\/+$/g, '') };
  };
  // the first page whose title tag or main heading the text equals or nearly equals
  const clash = (text, ap) => { if (!ap || !plain(text)) return null;
    for (const pg of ap.pages || []) for (const f of ['title', 'h1']) if (pg[f] && same(text, pg[f])) return { page: pg, field: f, text: pg[f] };
    return null; };
  const fieldName = (f) => (f === 'title' ? 'title tag' : 'main heading');
  const pick = (cands, ap, ok) => { const tried = new Set();
    for (const c0 of cands) { const c = clean(plain(c0)).replace(/[\s|:;,-]+$/, ''); if (!c || tried.has(c.toLowerCase())) continue; tried.add(c.toLowerCase());
      if (ok(c) && !clash(c, ap)) return c; }
    return ''; };
  const afterColon = (t) => { const x = plain(t); const i = x.indexOf(':'); return i > 0 ? x.slice(i + 1).trim() : ''; };
  const firstH2 = (md) => plain((S(md).match(/^## (.+)$/m) || [])[1] || '').replace(/\?+$/, '');
  // a title of its own: the brief's variants first (the strategist wrote them for this page), then the page's own heading, then the keyword
  // with the heading's second half or the first section's heading; each kept within 60 characters, with the brand suffix when it fits
  const titleFor = (cur, ap, o) => {
    const x = o || {}; const kw = S(x.keyword); const KW = titleCase(kw); const suf = suffixOf(cur) || S(x.brand).trim();
    const base = [x.brief_title, ...(Array.isArray(x.title_variants) ? x.title_variants : []), x.h1, KW + ': ' + afterColon(x.h1), KW + ': ' + firstH2(x.md),
      KW + (S(x.business).trim() ? ' | ' + S(x.business).trim() : '')].map(S).filter(c => plain(c) && !/:\s*$/.test(plain(c)));
    const forms = []; for (const c of base) { const k = core(c); if (suf && (k + ' | ' + suf).length <= CFG.title_max) forms.push(k + ' | ' + suf); forms.push(c); forms.push(k); }
    const ok = (c) => c.length >= CFG.title_min && c.length <= CFG.title_max && hasKw(c, kw) && !same(c, cur);
    return pick(forms, ap, ok); };
  const h1For = (cur, ap, o) => {
    const x = o || {}; const kw = S(x.keyword); const KW = titleCase(kw);
    const base = [x.brief_h1, ...(Array.isArray(x.title_variants) ? x.title_variants : []).map(core), core(x.title), KW + ': ' + afterColon(x.title), KW + ': ' + firstH2(x.md)]
      .map(S).filter(c => plain(c) && !/:\s*$/.test(plain(c)));
    const ok = (c) => c.length >= CFG.h1_min && c.length <= CFG.h1_max && hasKw(c, kw) && !same(c, cur);
    return pick(base, ap, ok); };
  // the link: a descriptive anchor (the kept page's own heading, else its title without the brand, else its address in words)
  const anchorOf = (pg) => { let a = plain(pg.h1); if (a.length > CFG.anchor_max) a = a.split(':')[0].trim();
    if (!a || a.length > CFG.anchor_max) a = core(pg.title); if (!a || a.length > CFG.anchor_max) a = titleCase(S(pg.slug).replace(/[-_]+/g, ' '));
    return clean(a).replace(/[.:;,!?]+$/, ''); };
  const linksIn = (md) => [...S(md).matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1]);
  const linked = (md, pg) => { const h = hostOf(pg.url); return linksIn(md).some(u => pathOf(u) === pg.path && (!/^https?:/i.test(u) || hostOf(u) === h)); };
  const sentenceFor = (pg) => 'For more on this, see our page [' + anchorOf(pg) + '](' + pg.url + ').';
  // where it helps the reader: the section that talks most about what the kept page is about (never the introduction, the closing call to
  // action or a questions block); one new short paragraph at the end of that section, so no sentence of the page is rewritten
  const addLink = (md, pg, o) => {
    const x = o || {}; if (typeof x.split !== 'function' || typeof x.join !== 'function') return { md, added: false, why: 'no section reader' };
    const sp = x.split(md); const parts = sp.parts || [];
    const pool = parts.filter((pt, i) => i > 0 && i < parts.length - 1 && !/\b(faq|frequently asked|questions)\b/i.test(S(pt.heading)));
    const list = pool.length ? pool : parts.filter((pt, i) => i > 0 && i < parts.length - 1);
    if (!list.length) return { md, added: false, why: 'the page has no middle section to place the link in' };
    const about = S(pg.h1) + ' ' + S(pg.title) + ' ' + S(pg.slug).replace(/[-_]+/g, ' ');
    let best = list[0], bs = -1; for (const pt of list) { const s = sim(about, S(pt.heading) + ' ' + plain(S(pt.text).slice(0, 600))) + sim(S(pt.heading), about); if (s > bs + 1e-9) { bs = s; best = pt; } }
    const m = S(best.text).match(/\s*$/); const tail = m && m[0].length >= 2 ? m[0] : '\n\n';
    best.text = S(best.text).replace(/\s*$/, '') + '\n\n' + sentenceFor(pg) + tail;
    return { md: x.join(sp), added: true, section: plain(best.heading), anchor: anchorOf(pg) }; };

  // ---------- the new page's own lines ----------
  const TITLE_RE = /^Title:[ \t]*(.*)$/im;
  const H1_RE = /^# (.+)$/m;
  const fix = (md0, ap, o) => {
    const x = o || {}; let md = S(md0); const fixes = []; const out = { title: null, h1: null, link: null };
    if (!ap) return { md, fixes, ...out };
    const tm = md.match(TITLE_RE); const title = tm ? tm[1].trim() : '';
    const hm = md.match(H1_RE); const h1 = hm ? hm[1].trim() : '';
    const ctx = { ...x, md, h1, title };
    const tc = clash(title, ap);
    if (tc) { const nt = titleFor(title, ap, ctx);
      if (nt) { md = md.replace(TITLE_RE, () => 'Title: ' + nt); out.title = { from: title, to: nt, page: tc.page.url, field: tc.field };
        fixes.push(clean('Gave the meta title its own wording ("' + nt + '"): your existing page ' + tc.page.path + ' already uses "' + plain(tc.text) + '" as its ' + fieldName(tc.field) + ', and two pages with one title compete for one search')); }
      else out.title = { from: title, to: '', page: tc.page.url, field: tc.field, left: true }; }
    const hc = clash(h1, ap);
    if (hc) { const nh = h1For(h1, ap, { ...ctx, title: (md.match(TITLE_RE) || [])[1] || title });
      if (nh) { md = md.replace(H1_RE, () => '# ' + nh); out.h1 = { from: h1, to: nh, page: hc.page.url, field: hc.field };
        fixes.push(clean('Gave the main heading its own wording ("' + nh + '"): your existing page ' + hc.page.path + ' already uses "' + plain(hc.text) + '" as its ' + fieldName(hc.field))); }
      else out.h1 = { from: h1, to: '', page: hc.page.url, field: hc.field, left: true }; }
    const pg = (ap.pages || []).find(p => p.primary) || (ap.pages || [])[0];
    if (pg && !linked(md, pg)) { const r = addLink(md, pg, x);
      if (r.added) { md = r.md; out.link = { url: pg.url, anchor: r.anchor, section: r.section };
        fixes.push(clean('Linked your existing page ' + pg.path + ' once, in the section "' + r.section + '", so readers and search engines see how the two pages relate')); } }
    return { md, fixes, ...out };
  };
  const check = (md, ap) => {
    if (!ap) return null;
    const title = ((S(md).match(TITLE_RE) || [])[1] || '').trim(); const h1 = ((S(md).match(H1_RE) || [])[1] || '').trim();
    const tc = clash(title, ap), hc = clash(h1, ap); const pg = (ap.pages || []).find(p => p.primary) || (ap.pages || [])[0];
    return { url: ap.url, path: ap.path, pages: (ap.pages || []).map(p => ({ url: p.url, title: p.title, h1: p.h1, from: p.from })),
      checked: !!ap.checked, title, h1, title_same: !!tc, h1_same: !!hc, same_as: tc ? { url: tc.page.url, field: tc.field, text: tc.text } : hc ? { url: hc.page.url, field: hc.field, text: hc.text } : null,
      linked: !!(pg && linked(md, pg)),
      basis: ap.checked ? 'the title tag and main heading of ' + (ap.pages || []).filter(p => p.title || p.h1).map(p => p.path + (p.from ? ' (' + p.from + ')' : '')).join(', ')
        : 'not checked: the existing page could not be read in this run and has no title or main heading on file' };
  };

  // ---------- the brief ----------
  // advice to take over the kept page: use its address or slug, replace it, merge into it, redirect it, publish this as its replacement
  const TAKEOVER = /\b(?:slug|url|address|path|redirect\w*|merge\w*|replac\w*|consolidat\w*|canonical\w*|instead of (?:a|this) (?:second|new|separate) page|not as a (?:second|new|separate) page|second page)\b/i;
  const mentions = (text, ap) => { const t = S(text).toLowerCase();
    return (ap.pages || []).some(p => (p.slug && new RegExp('(^|[^\\w-])' + escRe(p.slug) + '(?![\\w-])').test(t)) || (p.path.length > 1 && t.includes(p.path)) || t.includes(S(p.url).toLowerCase().replace(/\/+$/, ''))); };
  const ADVICE_KEYS = ['gaps_to_cover', 'information_gain', 'audience_pain_points', 'objections', 'voice_rules', 'experience_notes', 'proof_elements', 'questions_for_client', 'meta_variants'];
  const againstChoice = (text, ap) => !!ap && mentions(text, ap) && TAKEOVER.test(S(text));
  const brief = (b, prev, o) => {
    const ap = of(prev); const adjustments = []; if (!ap || !b || typeof b !== 'object') return { ap, adjustments };
    const x = o || {}; const kw = S(x.keyword || (prev || {}).keyword);
    if (Array.isArray(b.title_variants)) { const kept = b.title_variants.filter(v => !clash(v, ap)); if (kept.length !== b.title_variants.length) { adjustments.push(clean('Took ' + (b.title_variants.length - kept.length) + ' title variant(s) off that repeat your existing page ' + ap.path + '\'s title or main heading')); b.title_variants = kept; } }
    const tc = clash(b.meta_title, ap);
    if (tc) { const nt = titleFor(S(b.meta_title), ap, { keyword: kw, brief_title: '', title_variants: b.title_variants, h1: b.h1, brand: x.brand, business: x.business, md: (b.outline || []).map(s => '## ' + S(s && s.h2)).join('\n') });
      if (nt) { adjustments.push(clean('Meta title "' + plain(b.meta_title) + '" -> "' + nt + '": your existing page ' + tc.page.path + ' already uses it as its ' + fieldName(tc.field) + ', and two pages with one title compete for one search')); b.meta_title = nt; } }
    const hc = clash(b.h1, ap);
    if (hc) { const nh = h1For(S(b.h1), ap, { keyword: kw, brief_h1: '', title_variants: b.title_variants, title: b.meta_title, md: (b.outline || []).map(s => '## ' + S(s && s.h2)).join('\n') });
      if (nh) { adjustments.push(clean('H1 "' + plain(b.h1) + '" -> "' + nh + '": your existing page ' + hc.page.path + ' already uses it as its ' + fieldName(hc.field))); b.h1 = nh; } }
    // a line of the brief that advises taking over the kept page goes (the client chose a separate page; the hold already said what it costs)
    let dropped = 0;
    // only the brief's advice lists: never the client's facts, the keywords or the terms (a fact that names the kept page stays a fact)
    for (const k of ADVICE_KEYS) { if (!Array.isArray(b[k]) || !b[k].every(v => typeof v === 'string')) continue;
      const kept = b[k].filter(v => !againstChoice(v, ap)); dropped += b[k].length - kept.length; b[k] = kept; }
    for (const k of ['unique_angle', 'information_gain', 'search_intent']) if (typeof b[k] === 'string' && againstChoice(b[k], ap)) { b[k] = S(b[k]).split(/(?<=[.!?])\s+/).filter(s => !againstChoice(s, ap)).join(' '); dropped++; }
    if (dropped) adjustments.push(clean('Took ' + dropped + ' line(s) off the brief that advised replacing or taking over your existing page ' + ap.path + ': you chose a separate new page, and that page stays as it is'));
    const pg = ap.pages.find(p => p.primary) || ap.pages[0];
    const links = Array.isArray(b.internal_link_suggestions) ? b.internal_link_suggestions : [];
    if (!links.some(l => l && pathOf(l.url) === pg.path)) { b.internal_link_suggestions = [{ anchor: anchorOf(pg), url: pg.url }, ...links];
      adjustments.push(clean('Added your existing page ' + pg.path + ' to the internal links: the new page links to it once where it helps the reader')); }
    return { ap, adjustments };
  };
  const contractLine = (ap) => !ap ? '' : clean('SEPARATE PAGE: the client chose a separate new page at its own address beside the existing page ' + ap.url
    + (ap.title ? ' (title tag "' + ap.title + '"' + (ap.h1 ? ', main heading "' + ap.h1 + '"' : '') + ')' : ap.h1 ? ' (main heading "' + ap.h1 + '")' : '')
    + ', which stays as it is. Give this page a title tag and an H1 of its own, never that page\'s; never suggest that page\'s address or slug for this page, never advise publishing this page as its replacement, merging the two or redirecting one to the other; link to that page once where it helps the reader, with a descriptive anchor.');
  const readerNote = (ap, slug) => !ap ? '' : clean('THE CLIENT\'S CHOICE: this page is a separate new page at its own address' + (S(slug).trim() ? ' (/' + S(slug).replace(/^\/+/, '') + ')' : '')
    + '. ' + ap.url + ' is the business\'s existing page on the same search, and the client chose to keep it as it is. Never suggest that this page take that page\'s address or slug, replace it, merge into it or redirect to it; a link to it is confirmed and wanted.');
  return { CFG, of, same, sim, core, clash, titleFor, h1For, anchorOf, linked, addLink, fix, check, brief, againstChoice, contractLine, readerNote, pathOf, slugOf };
})();
