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
// ---- RR: the blind second read of the delivered page (W0-H, 2026-10-29; inlined through the CRITIC_REREAD marker) ----
// docs/page-quality-2026-10-29/PLAN.md Fix 3b (2.7, 2.8), REVIEW_EVIDENCE H1, R4 G14 / G18. Run 3299: the Critic (Sonnet) scored the first
// draft 66 against the expert reviewer's 63 while our code grade said 92 then 100, and its three high-severity problems weighed nothing: it
// read the FIRST draft once and gated nothing. Until the separate grade judge of Wave 2, the Critic's own quality bar (v5/prompts/critic.txt,
// QUALITY BAR + SOURCE QUALITY, inlined here by the build so the two never drift) reads the page the client RECEIVES once more:
//   * blind: no earlier review, no edit history, no score of ours, no "confirmed" labels; it does get the site's own live pages (the 3299
//     Critic, told nothing about them, called live internal links "not confirmed"), the facts on file, the sources the run verified and
//     the regulatory digest when there is one;
//   * one Sonnet 5.5 call over HTTP (the Messages API with the Anthropic credential, like the promise judge): adaptive thinking at medium
//     effort, JSON through structured outputs (output_config.format). No temperature and no forced tool: Sonnet 5.5 refuses both (400);
//   * a problem counts only when its quoted words are on the page (PF.onPage); a high-severity one of a GATING kind (fact, source, claim,
//     local: what would mislead a reader or embarrass the business) is a soft blocker; everything else is advice, shown to the client;
//   * a refused (stop_reason "refusal"), cut (max_tokens), failed or unparsable answer is "not checked", never a pass and never a block;
//   * runs the system started by itself (the cadence, a ladder's own page runs, the tracker, case-study spawns) are read in SHADOW mode
//     first, the rule of owner decision D17 for the holds: what would have blocked is logged and reported as advice, the status does not
//     change. CFG.automatic moves to 'enforce' after two cadence cycles of shadow logs and the owner's review. A page of the client's
//     keyword ladder is read in shadow mode too, also when a person started it from the app (M4, WAVE0_REVIEW 2026-10-30). Other runs a
//     person started (the app, the form, the API) are enforced. The page that ranks (exec 949, a ladder page) is therefore never held back
//     by this read.
// W05-A (wave 0.5, 2026-10-30, docs/page-quality-2026-10-29/BEFORE_AFTER.md "Our second-read blockers against the judges"): the read held 7
// of the 8 AFTER pages at "Not ready 59" while the blind strategist judge would publish 7 of 8 (signed error -10.9). Its high items were
// mostly fix-before-publishing advice given blocker weight. A problem now BLOCKS (enforce mode) only when it is a factual error the page
// states, decided from the read's own words and the page, never from its score:
//   * count: a number followed by a list of a different length on the page ("six engines: ..." and seven names), checked on the quote;
//   * claim: an unsupported statement about the business (kind "claim": what it does, offers, holds or promises, not on file);
//   * contradicted: a statement its own cited or linked source contradicts (never "contradicts nothing", never a contrast with the framing);
//   * wrong: a fact or local rule the read calls wrong, false, out of date, superseded or repealed, unhedged ("could be out of date" is advice),
//     except a date that only falls on the day the page is written: a page is read after that day, so it is advice (add a status line).
// Everything else the read found on the page (an uncited contrast, a figure that wants a source, a vague market figure, a law with no link,
// a statistics note) is ADVICE: shown to the client and taken off its part of the grade by the grade kit (GR.cap review), never the 59 cap.
// "Today" is the website's market day (Regulatory Plan's as_of, the market's time zone, Asia/Dubai for the UAE), told to the reader and used
// for the same-day rule, so a run at 22:31 UTC on 29 October reads a UAE page as written on 30 October, like the page's own date.
// Its cost is MEASURED (Anthropic reports the tokens of the answer) and joins the run's Claude figure in the ledger.
// Pure: no clock, no network, no n8n globals, no URL constructor, no Object.defineProperty, no structuredClone (n8n sandbox rules).
const RR = (() => {
  const S = (v) => String(v == null ? '' : v);
  const MODEL = 'claude-sonnet-5-5';
  const CFG = { automatic: 'shadow', max_tokens: 16000, effort: 'medium', page_chars: 60000, facts_chars: 6000, sources: 25, site_pages: 40, max_advice: 5 };
  const GATING = new Set(['fact', 'source', 'claim', 'local']);
  const KINDS = ['fact', 'source', 'claim', 'local', 'repetition', 'intent', 'depth', 'structure', 'style', 'link', 'other'];
  const AUTOMATIC = /^(cadence|ladder|tracker|casestudy|audit):/;
  const TEMPLATE = "You are a demanding editor-in-chief and SEO lead. This page is finished and about to go to the client. You did not write it, and you have not seen any earlier review of it or any of the edits that led to it. Read it once, as a careful expert reader in {{COUNTRY}} would, and report what is wrong. Quote the exact words of the page for every problem.\n\nTARGET\nKeyword: {{KEYWORD}} \u00b7 Page type: {{PAGE_TYPE}} \u00b7 Country: {{COUNTRY}} \u00b7 Audience: {{AUDIENCE}}\nBusiness: {{BUSINESS}} ({{DOMAIN}})\n\nTHE BUSINESS'S OWN LIVE PAGES (a link to one of these is confirmed: never report it as unconfirmed or unpublished)\n{{SITE_PAGES}}\n\nFACTS ON FILE (true: the business may state them, whatever wording the page uses)\n{{FACTS}}\n\nSOURCES THIS RUN READ AND VERIFIED (a figure quoted from one of these, with its link, is supported)\n{{SOURCES}}\n\nLOCAL REGULATORY FACTS FOR THIS RUN (dated, with their official source)\n{{REGULATORY}}\n\n{{BAR}}\n\nHOW TO REPORT\n- \"location\": copy 5 to 15 words EXACTLY as they appear on the page (no \"...\", no paraphrase). A problem whose words are not on the page cannot be shown to the client.\n- \"kind\", one of:\n  fact: a statement about the world (a product, a market, a process) that is wrong, out of date, or not what its linked source says;\n  source: a figure or claim whose only support is a weak source (rule 5 of SOURCE QUALITY), or a link that does not support its sentence;\n  claim: a statement about the business (what it does, offers, holds, has done or promises) that the facts on file do not support;\n  local: a local rule, deadline, regulator, tax or market fact that is wrong, out of date or stated without its status;\n  repetition: the same point made again in another section; intent: the page answers a different search or buyer than the keyword's;\n  depth: an answer too thin or generic for this reader; structure: headings, order, table, call to action; style: wording, readability, banned phrases;\n  link: an internal or external link problem; other: anything else.\n- \"severity\": high only when publishing it as it is would mislead a reader or embarrass the business (a wrong or unsupported fact, figure, claim or local rule). Everything a good editor would improve but a reader would not be misled by is medium or low.\n- Never ask for a bracket or a placeholder, never ask the page to grow past its length, and never ask for a claim about the business that the facts on file do not carry.\n\nTHE PAGE\n{{PAGE}}\n\nReturn ONLY valid JSON (no markdown, no backticks):\n{ \"score\": 0-100, \"strengths\": [\"2-4 specific strengths\"], \"problems\": [{ \"severity\": \"high | medium | low\", \"kind\": \"fact | source | claim | local | repetition | intent | depth | structure | style | link | other\", \"location\": \"the exact words from the page\", \"issue\": \"what is wrong\", \"fix\": \"exactly what to write or change\" }] }\nList at most 12 problems, most damaging first. Score 85+ only if you would publish it under your own name.\n";
  const BAR = "QUALITY BAR\n1. Specificity: examples, numbers with linked sources, decision rules, steps \u2014 not generic advice.\n2. Originality and information gain: every information-gain item is covered fully; the page says something competitors do not.\n3. Audience fit: speaks to the stated audience and answers their objections.\n4. Trust: no unsupported claims or invented numbers; external numbers carry a source link; client facts are used correctly; no bracket of any kind in the page (a missing fact is written around, never left as [Price] or [Confirm: ...]). Anything that appears in the client facts or in the facts from the client's own website above is TRUE: never call it invented, made up or unsupported, whatever wording the draft uses for it. For anything else that cannot be checked, the word is \"unverified\" \u2014 say what would verify it (a source link) or how to say it without the claim; never \"invented\", and never suggest a bracket or a placeholder as the fix.\n5. Readability and voice: plain words, varied sentence length, active voice, no filler, none of the banned phrases (delve, unlock, seamless, robust, leverage, cutting-edge, game-changer, elevate, empower, crucial, paramount, realm, embark, foster, streamline, synergy, holistic, best-in-class, world-class, state-of-the-art, top-notch, one-stop shop, \"in today's fast-paced world\", \"ever-evolving\", \"it's important to note\", \"in conclusion\", \"when it comes to\", \"a wide range of\").\n6. Search fit: matches the intent, at least three headings phrased as the questions buyers ask and answered directly in the 40-60 words under them (no \"Frequently Asked Questions\" block and no Q1:/A1: list \u2014 Google stopped showing FAQ rich results in May 2026), terms used naturally, primary keyword placed correctly without stuffing, internal links only to allowed URLs and never to a page that is not published yet.\n7. Structure: follows the outline order and target lengths, comparison table present, CTA last, meta title \u226460 and description 120-155 characters.\n\nSOURCE QUALITY \u2014 what a citation is worth, best first. Judge every external link against this list and say so in \"problems\" when the draft falls short.\n1. Primary: a government, regulator, standards body or official statistics page (.gov, .gov.<country>, .edu, europa.eu, iso.org, w3.org, peppol.org, u.ae, the WHO / OECD / World Bank / IMF / UN).\n2. Research: a named research house publishing its own data (Statista, Gartner, Forrester, IDC, McKinsey, Deloitte, PwC, KPMG, EY, BCG, Bain, Pew, Nielsen, Grand View, MarketsandMarkets).\n3. Major press: Reuters, Bloomberg, the BBC, the Financial Times, the Wall Street Journal, the New York Times, The Economist, AP, CNBC, Khaleej Times, The National, Gulf News, Zawya.\n4. Vendor documentation: a product's own documentation or release notes (Microsoft Learn, Oracle, SAP, Odoo, Zoho docs) \u2014 fine for how the product works, never for a market figure.\n5. Weak: everything else \u2014 a vendor's or agency's blog post, a listicle, an unknown site. The page may cite at most ONE page per weak domain; a second citation of the same weak domain is a high-severity problem, and so is a market or compliance figure whose only source is a weak page.\nAlso flag: a figure that does not appear in the source it links to, a link with tracking parameters (utm_*, srsltid, gclid, fbclid), and a link to a page of this site that is not published yet.";
  const SCHEMA = { type: 'object', additionalProperties: false, required: ['score', 'problems'],
    properties: { score: { type: 'integer' }, strengths: { type: 'array', items: { type: 'string' } },
      problems: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['severity', 'kind', 'location', 'issue', 'fix'],
        properties: { severity: { type: 'string', enum: ['high', 'medium', 'low'] }, kind: { type: 'string', enum: KINDS },
          location: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } } } } } };
  const clean = (s) => S(s).replace(/\s*[\u2014\u2013]\s*/g, ': ').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...').replace(/:\s*:/g, ':').trim();
  const list = (xs, n) => xs.filter(Boolean).slice(0, n);
  // ---- W05-A: which high problems are factual errors the page states (they block); everything else is advice ----
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const fmtDay = (iso) => { const m = S(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return ''; const mo = MONTHS[Number(m[2]) - 1] || ''; return Number(m[3]) + ' ' + mo.charAt(0).toUpperCase() + mo.slice(1) + ' ' + m[1]; };
  const pad2 = (n) => (Number(n) < 10 ? '0' : '') + Number(n);
  const isoDates = (t) => { const out = []; const x = S(t);
    for (const m of x.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi))
      out.push(m[3] + '-' + pad2(MONTHS.indexOf(m[2].toLowerCase()) + 1) + '-' + pad2(m[1]));
    for (const m of x.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) out.push(m[0]);
    return out; };
  const NUMW = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const plainQ = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/\s+/g, ' ').trim();
  // "six AI engines and answer surfaces: ChatGPT, Gemini, ..., AI Overviews." -> the stated number and the items the list names. Only a
  // list that ends inside the quote (a full stop or semicolon) is counted, so a quote cut mid-list is never a mismatch.
  const countMismatch = (quote) => {
    const t = plainQ(quote);
    for (const m of t.matchAll(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\s+((?:[A-Za-z][\w&'-]*\s+){0,5}?[A-Za-z][\w&'-]*)\s*:\s*([^.;:]+)[.;]/gi)) {
      const n = NUMW[m[1].toLowerCase()] || Number(m[1]); if (!(n >= 2 && n <= 30)) continue;
      const items = m[3].split(/\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/i).map(x => x.trim()).filter(x => x && x.split(/\s+/).length <= 6);
      if (items.length >= 2 && items.length !== n) return { stated: n, listed: items.length, what: m[2] }; }
    return null; };
  const WRONG = /\b(?:wrong(?:ly)?|incorrect(?:ly)?|inaccurate(?:ly)?|untrue|not true|false|out of date|outdated|superseded|repealed|revoked|withdrawn|replaced by|no longer (?:applies|apply|in force|current|valid|true|available|offered)|(?:has|have) (?:already )?(?:passed|expired|lapsed)|already passed|expired)\b/gi;
  const HEDGED = /\b(?:could|may|might|can|possibly|perhaps|likely|risks?|seems?|appears?)\s+(?:\w+\s+){0,2}$/i;
  const wrongIn = (t) => { const x = S(t); for (const m of x.matchAll(WRONG)) if (!HEDGED.test(x.slice(Math.max(0, m.index - 40), m.index))) return m[0]; return ''; };
  const CONTRA_NONE = /\bcontradicts? nothing\b|\bdoes not contradict\b|\bno contradiction\b/i;
  const SRC_CONTRA = /\bcontradict\w*\b[^.;]{0,60}\b(?:source|cited|linked|reference|official (?:text|page)|the law|the decision|the regulation)\b|\bnot what (?:the|its) (?:linked |cited )?(?:source|page|reference)\b|\b(?:source|reference)\b[^.;]{0,60}\b(?:says|states|gives|shows|reports|lists)\b[^.;]{0,60}\b(?:otherwise|the opposite|instead)\b|\bmis(?:quotes?|states?|represents?)\b/i;
  const SAME_DAY = /\b(?:today|the deadline day|day of writing|(?:is|was) (?:written|dated|published) on|the day (?:this|the) page (?:is|was) (?:written|published|dated)|on the day it is written)\b/i;
  // a date problem that is only a problem on the day the page is written (the deadline falls that day): with the market's day known, the
  // date the read talks about must be that day; without it, the read's own words must say so
  const sameDay = (p, today) => SAME_DAY.test(S(p.issue)) && (!today || isoDates(S(p.location) + ' ' + S(p.issue)).includes(today));
  const errorOf = (p, today) => {
    if (p.severity !== 'high' || !p.on_page) return '';
    if (countMismatch(p.location) && /\b(?:\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i.test(S(p.issue))) return 'count';
    if (!GATING.has(p.kind)) return '';
    if (p.kind === 'claim') return 'claim';
    const issue = S(p.issue);
    if (!CONTRA_NONE.test(issue) && SRC_CONTRA.test(issue)) return 'contradicted';
    if ((p.kind === 'fact' || p.kind === 'local') && wrongIn(issue) && !sameDay(p, today)) return 'wrong';
    return ''; };
  const ERROR_LABEL = { count: 'a count that does not match its list', claim: 'a statement about the business that nothing on file supports',
    contradicted: 'a statement its own source contradicts', wrong: 'a wrong or out-of-date statement' };
  // M4 (WAVE0_REVIEW 2026-10-30): a page of the client's keyword ladder is read in the same shadow mode wherever it was started (the app's
  // ladder "Write now" sends client_ip app:..., not ladder:...), as the hold already exempts it by ladder_id + ladder_rung: the false-positive
  // rate of this blind read is unmeasured, and the guide that ranks (exec 949) is a ladder page. It moves to enforce with the automatic runs,
  // after the owner has reviewed the first 20 second reads (D17).
  const ladderPage = (p) => !!S(p.ladder_id).trim() && p.ladder_rung != null && p.ladder_rung !== '';
  const modeOf = (prev) => { const p = prev || {}; return AUTOMATIC.test(S(p.client_ip).toLowerCase()) || ladderPage(p) ? CFG.automatic : 'enforce'; };
  // what the reader is told about the website and the run, never what we think of the page
  const context = (prev, reg, today) => {
    const p = prev || {}; const b = p.content_brief || {}; const sd = p.site_description || {}; const sp = p.site_profile || {};
    const own = [...new Set([].concat((p.internal_link_candidates || []).filter(x => x && !x.planned).map(x => S(x.url)), (p.site_urls || []).map(x => S(x && x.url ? x.url : x))).filter(u => /^https?:\/\//.test(u)))];
    const facts = list([].concat(b.client_facts || [], [p.business_facts, p.case_facts_text], sd.site_facts || sd.products_or_services || []).map(S), 80).join(' | ').slice(0, CFG.facts_chars);
    const srcs = list([].concat((b.evidence_plan || []).map(e => e && e.source_url ? S(e.fact).slice(0, 240) + ' (' + S(e.source_url) + ')' : ''),
      (p.facts || []).map(f => f && f.url ? S(f.claim || f.fact || f.text).slice(0, 240) + ' (' + S(f.url) + ')' : '')), CFG.sources);
    // W07-B (2026-10-31, WAVE06 section 10 finding 3): a separate new page beside a page the client kept says so, or the read advises the
    // kept page's slug (K1: "Use the slug ms-365-erp-uae"); only on such a page, so every other read gets the same prompt as before
    const apart = typeof PGA !== 'undefined' ? PGA.readerNote(PGA.of(p), b.slug) : '';
    return { KEYWORD: S(p.keyword), PAGE_TYPE: S(p.page_type || 'page'), COUNTRY: S(p.country || 'not stated'), AUDIENCE: S(b.target_audience || p.audience || 'not stated'),
      BUSINESS: S(sp.business_name || sd.business_name || p.domain || 'the business'), DOMAIN: S(p.domain),
      SITE_PAGES: (own.slice(0, CFG.site_pages).join('\n') || 'none listed') + (apart ? '\n\n' + apart : ''), FACTS: facts || 'none', SOURCES: srcs.join('\n') || 'none',
      REGULATORY: (today ? 'Today in ' + S(p.country || 'the market') + ': ' + fmtDay(today) + ' (the date this page is published with; it is read after that day too).\n' : '') + (S(reg).trim() || 'none for this page') }; };
  const fill = (tpl, vals) => S(tpl).replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in vals ? S(vals[k]) : m));
  // the request, or why there is none
  const plan = (item, prev, opts) => {
    const it = item || {}; const o = opts || {}; const qa = it.content_qa || {}; const md = typeof it.output === 'string' ? it.output : '';
    const mode = modeOf(prev); const today = /^\d{4}-\d{2}-\d{2}$/.test(S(o.today)) ? S(o.today) : '';
    const skip = (reason) => ({ skip: true, reason, mode, model: MODEL, today });
    if (!TEMPLATE || !BAR) return skip('the second read is not configured in this build');
    if ((prev || {}).critic_reread === false) return skip('the second read was switched off for this run');
    if (!md.trim()) return skip('no page was written');
    if (!qa.delivery || typeof qa.delivery !== 'object') return skip('the page has no delivered status to check');
    if (qa.cut_off) return skip('the page stops before its end, so a read of it would say nothing new');
    const page = md.length > CFG.page_chars ? md.slice(0, CFG.page_chars) : md;
    const prompt = fill(TEMPLATE, { ...context(prev, o.regulatory_digest, today), BAR, PAGE: page });
    const body = { model: MODEL, max_tokens: CFG.max_tokens, thinking: { type: 'adaptive' }, output_config: { effort: CFG.effort, format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: prompt }] };
    const ap = typeof PGA !== 'undefined' ? PGA.of(prev) : null;   // W07-B: the kept page, so read() can set aside advice that takes it over
    return { skip: false, reason: '', mode, model: MODEL, today, body: JSON.stringify(body), prompt_chars: prompt.length,
      ...(ap ? { apart: { url: ap.url, path: ap.path, slugs: ap.pages.map(x => x.slug).filter(Boolean), paths: ap.pages.map(x => x.path).filter(x => x.length > 1) } } : {}) }; };
  // W07-B: advice that the page take the kept page's address or slug, replace it, merge into it or redirect to it goes against the client's
  // choice (a separate page at its own address): it is set aside with that reason, never shown and never counted. Plain words here, so the
  // reader of the answer needs no other kit.
  const TAKEOVER = /\b(?:slug|url|address|path|redirect\w*|merge\w*|replac\w*|consolidat\w*|canonical\w*|second page)\b/i;
  const againstChoice = (q, apart) => { if (!apart || /^link$/i.test(S(q.kind).trim())) return false; const t = (S(q.location) + ' ' + S(q.issue) + ' ' + S(q.fix)).toLowerCase();
    const named = (apart.slugs || []).some(s => new RegExp('(^|[^\\w-])' + S(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])').test(t)) || (apart.paths || []).some(x => t.includes(S(x)));
    return named && TAKEOVER.test(S(q.issue) + ' ' + S(q.fix)); };
  // the answer: checked (with every problem, which ones gate and which are advice) or not checked (and why)
  const read = (resp, md, planned, PFk) => {
    const r = resp || {}; const pl = planned || {}; const mode = pl.mode || 'enforce';
    const usage = r.usage && typeof r.usage === 'object' ? { input_tokens: Number(r.usage.input_tokens) || 0, output_tokens: Number(r.usage.output_tokens) || 0 } : null;
    const nc = (reason) => ({ status: 'not_checked', reason, mode, model: S(r.model || pl.model || MODEL), usage, problems: [], gates: [], advice: [], would_block: [] });
    if (pl.skip) return { ...nc(S(pl.reason) || 'not run'), usage: null };
    if (r.error) { const e = r.error; return nc('the second read could not be run (' + clean(S(typeof e === 'object' ? (e.message || e.type || JSON.stringify(e)) : e)).slice(0, 160) + ')'); }
    if (S(r.stop_reason) === 'refusal') return nc('the reviewer declined to read this page' + (r.stop_details && r.stop_details.category ? ' (' + S(r.stop_details.category) + ')' : ''));
    if (S(r.stop_reason) === 'max_tokens') return nc('the review was cut off before its end');
    const texts = (Array.isArray(r.content) ? r.content : []).filter(c => c && c.type === 'text').map(c => S(c.text));
    if (!texts.length) return nc('the second read gave no answer');
    let j = null; try { j = JSON.parse(texts[texts.length - 1].trim().replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch (e) { j = null; }
    if (!j || typeof j !== 'object' || !Array.isArray(j.problems)) return nc('the second read gave an answer we could not read');
    const onPage = PFk && typeof PFk.onPage === 'function' ? PFk.onPage : () => false;
    const against = [];
    const problems = j.problems.filter(p => p && typeof p === 'object').filter(p => { if (!againstChoice(p, pl.apart)) return true;
      against.push({ severity: S(p.severity).toLowerCase(), kind: S(p.kind).toLowerCase(), location: clean(p.location).slice(0, 300), issue: clean(p.issue).slice(0, 400), fix: clean(p.fix).slice(0, 400),
        why: 'set aside: it advises taking over the existing page the client chose to keep (' + S(pl.apart.path) + ')' }); return false; }).slice(0, 20).map(p => {
      const severity = /^(high|medium|low)$/i.test(S(p.severity)) ? S(p.severity).toLowerCase() : 'low'; const kind = KINDS.includes(S(p.kind).toLowerCase()) ? S(p.kind).toLowerCase() : 'other';
      const location = clean(p.location).slice(0, 300); const on_page = !!location && onPage(location, md);
      const q = { severity, kind, location, issue: clean(p.issue).slice(0, 400), fix: clean(p.fix).slice(0, 400), on_page };
      const error = errorOf(q, S(pl.today)); return { ...q, error, gates: !!error }; });
    const gating = problems.filter(p => p.gates);
    // W05-A: the most damaging advice first (the high items that are not errors), as the client sees it and the grade counts it
    const advice = problems.filter(p => !p.gates && p.on_page && p.severity !== 'low').sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1)).slice(0, CFG.max_advice);
    return { status: 'checked', reason: '', mode, model: S(r.model || MODEL), usage, today: S(pl.today), score: Number.isFinite(Number(j.score)) ? Number(j.score) : null,
      problems, gates: mode === 'enforce' ? gating : [], would_block: mode === 'enforce' ? [] : gating, advice,
      not_shown: problems.filter(p => !p.on_page).length, ...(against.length ? { against_choice: against } : {}) }; };
  // the delivered page with what the read found: blockers in enforce mode, advice always; the grade object is not touched here
  const apply = (qa0, rr, PFk) => {
    const qa = { ...(qa0 || {}) }; const R = rr || {}; const del = qa.delivery && typeof qa.delivery === 'object' ? { ...qa.delivery } : null;
    const record = { status: R.status, reason: R.reason || '', mode: R.mode, model: R.model, usage: R.usage || null, score: R.score == null ? null : R.score,
      gates: (R.gates || []).map(g => ({ kind: g.kind, error: g.error || '', location: g.location, issue: g.issue, fix: g.fix })),
      would_block: (R.would_block || []).map(g => ({ kind: g.kind, error: g.error || '', location: g.location, issue: g.issue, fix: g.fix })),
      advice: (R.advice || []).map(g => ({ severity: g.severity, kind: g.kind, location: g.location, issue: g.issue, fix: g.fix })), not_shown: R.not_shown || 0,
      ...((R.against_choice || []).length ? { against_choice: R.against_choice } : {}) };   // W07-B: advice set aside because it takes over the page the client kept
    qa.critic_reread = record;
    if (!del || !PFk) return qa;
    const advisory = (del.advisory || []).slice();
    const adv = (g, pre) => advisory.push({ code: 'second_read', text: clean(pre + ' "' + S(g.location).slice(0, 140) + '": ' + S(g.issue).replace(/[.;:]+$/, '') + (g.fix ? '. Suggested: ' + S(g.fix).replace(/[.;:]+$/, '') : '')) });
    for (const g of (R.would_block || [])) adv(g, 'A second read of the page found (reported only while this check is new)');
    for (const g of (R.advice || [])) adv(g, g.severity === 'high' ? 'A second read of the page found something to fix before publishing at' : 'A second read of the page suggests a change at');
    if (R.status !== 'checked') advisory.push({ code: 'second_read', text: clean('Not checked by a second read: ' + S(R.reason)) });
    let out = { ...del, advisory, second_read: { status: R.status, mode: R.mode, blocking: (R.gates || []).length, reported: (R.would_block || []).length } };
    if (R.mode === 'enforce' && (R.gates || []).length) {
      const cls0 = { blocking: (del.blocking || []).map(b => ({ code: S(b.code), text: S(b.text), tier: 'carried' })), advisory };
      const cls = PFk.reviewed(cls0, R);
      const d2 = PFk.deliver(cls, { questions: del.client_questions || qa.client_questions || [] });
      const acts = new Map((del.blocking || []).map(b => [S(b.code) + '|' + S(b.text), b.action]));
      const blocking = d2.blocking.map(b => (acts.has(b.code + '|' + b.text) ? { ...b, action: acts.get(b.code + '|' + b.text) } : b));
      const grade = del.grade && typeof del.grade === 'object' ? { ...del.grade, blocking: blocking.length } : del.grade;
      out = { ...out, status: d2.status, label: d2.label, blocking, next_step: d2.next_step || del.next_step || '', grade };
      const ready = d2.status !== 'not_ready'; const reasons = ready ? [] : blocking.map(b => b.text).slice(0, 8);
      const oq = qa.quality && typeof qa.quality === 'object' ? qa.quality : {};
      Object.assign(qa, { passed: ready, publishable: ready, not_ready: !ready, quality_label: d2.label, not_ready_reasons: reasons, delivery_status: d2.status,
        quality: { ...oq, passed: ready, publishable: ready, not_ready: !ready, label: d2.label, reasons, delivery_status: d2.status, blocking, advisory: out.advisory.map(a => ({ code: a.code, text: a.text })),
          grade: grade || oq.grade, next_step: out.next_step, fix_by: ready ? '' : 'edit' } });
    } else if (qa.quality && typeof qa.quality === 'object') qa.quality = { ...qa.quality, advisory: advisory.map(a => ({ code: a.code, text: a.text })) };
    qa.delivery = out;
    return qa; };
  return { MODEL, CFG, GATING, KINDS, SCHEMA, ERROR_LABEL, modeOf, context, plan, read, apply, fill, errorOf, countMismatch, sameDay, fmtDay };
})();
// W0-H (2026-10-29, page-quality PLAN Fix 3b; build section 158): the request for the blind second read of the page the client receives
// (RR.plan, v5/code/_critic_reread.js), or why there is none. Runs once, after Page Candidates delivered the page (Finalize Page? said
// "deliver"); the delivered item passes through unchanged with `second_read` added. What the reader gets: the page, the keyword, the
// website's own live pages, the facts on file, the sources this run verified and the regulatory digest. Never the first-draft review,
// the edit history or our grade.
const it = $input.first().json || {};
let prev = {}; try { prev = $('Parse Brief').first().json || {}; } catch (e) { prev = {}; }
let ip = ''; try { ip = String(($('Normalize Input').first().json || {}).client_ip || ''); } catch (e) { ip = ''; }
let reg = '', asOf = ''; try { const r = $('Collect Regulatory Facts').first().json.regulatory; if (r && typeof r.digest === 'string') reg = r.digest; if (r && r.as_of) asOf = String(r.as_of); } catch (e) { reg = ''; }
if (!reg) reg = String(((prev.regulatory || {}).digest) || '');
// W05-A (wave 0.5): "today" is the website's market day (Regulatory Plan's as_of, in the market's time zone), the date the page carries;
// a run with no as_of falls back to the UTC day the run started
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) asOf = String(((prev.regulatory || {}).as_of) || '');
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) { const t = Date.parse(String(prev.started_at || '')); asOf = new Date(isNaN(t) ? Date.now() : t).toISOString().slice(0, 10); }
const second_read = RR.plan(it, { ...prev, client_ip: prev.client_ip || ip }, { regulatory_digest: reg, today: asOf });
return [{ json: { ...it, second_read } }];
