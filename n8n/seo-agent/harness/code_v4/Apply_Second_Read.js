// ---- PF: the page pipeline's one contract, its one score and its fixes (H1, 2026-10-27; inlined through the PAGE_FIX marker) ----
// docs/content-quality-2026-10-27/R1_PIPELINE_ANALYSIS.md: the four production page runs (949, 2195, 2552, 2575) all came out "not ready
// to publish". One full-page Editor pass with no safety net made 3 of the 4 pages worse (two cut off, one regressed on keyword, coverage,
// claims and links), the Brief, the Copywriter, the Critic, the Editor and the quality check each held a different length / bracket /
// claim rule, every warning blocked, and the PDF printed the Critic's grade of the FIRST draft. R2_MARKET_RESEARCH.md: no leading tool
// blocks on SEO metrics; facts, trust and legal problems are what block. This kit is the one place those rules live:
//   PF.contract(prev)          the contract every writer prompt prints (length as a band, no brackets, the claim rule, page-type targets)
//   PF.split / PF.join         a page as its head (meta lines) + sections (s0 = H1 and introduction, s1.. = each H2); lossless
//   PF.fix(md, ctx)            the deterministic fixes, run before every quality check (no model, cannot invent anything)
//   PF.classify(qa, md, ctx)   BLOCKING (facts, trust, legal, a cut page) vs ADVISORY (length, coverage, structure, style)
//   PF.weakFigures / reviewed  W0-H (Fix 3b): a figure whose only source is weak, and the blind second read's problems, as soft blockers
//   PF.score / PF.better       ONE comparison for every candidate draft: hard blockers, then soft blockers, then advisory distance
//   PF.plan(md, cls, qa, ctx)  the section-targeted edit job: only the sections with a problem, each with its own problem list
//   PF.parseSections / merge   the editor's answer (one block per section) merged into the page, every other byte kept
//   PF.neutralize(md, cls)     the system's own neutral rewrite of whatever a fact would be needed for (delete / unlink / neutral CTA)
//   PF.deliver(...)            ready | ready_with_questions | not_ready, in plain customer words, with the client questions
//   PF.toc(md, ref)            the linked contents list kept, and following its headings, through the final version (fu-finalize-toc)
//   PF.fragment / ctaSentence / finalGuard   W05-C (2026-10-30): what is a sentence, what is an invitation to get in touch, and the final
//                              version repaired against the page it was made from (list markers, a spliced heading, a second invitation)
// Pure: no clock, no network, no n8n globals, no URL constructor, no Object.defineProperty, no structuredClone (n8n sandbox rules).
const PF = (() => {
  const S = (v) => String(v == null ? '' : v);
  const EDIT_MAX = 3;           // section-targeted editing rounds at most; the loop stops earlier as soon as a round improves nothing
  const META = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;
  const words = (t) => S(t).split(/\s+/).filter(Boolean).length;
  const plain = (s) => S(s).replace(/\[([^\[\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`>#]+/g, '').replace(/\s+/g, ' ').trim();
  const escRe = (s) => S(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // customer wording: no em / en dashes, curly quotes or the ellipsis character in anything this kit writes (owner rule, 2026-10-19)
  const clean = (s) => S(s).replace(/\s*[\u2014\u2013]\s*/g, ': ').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...').replace(/:\s*:/g, ':').trim();
  const STOP = new Set('the a an and or of for to in on with by at from about this that these those your our its it is are be how what which why when who you we they their them than then into over under more most can will does do not but any all one two also very just only such been being has have had was were'.split(' '));
  const toks = (t) => S(t).toLowerCase().split(/[^\p{L}\p{N}&]+/u).filter(w => w.length > 2 && !STOP.has(w));
  const overlap = (a, b) => { const A = [...new Set(toks(a))]; if (!A.length) return 0; const B = new Set(toks(b)); return A.filter(w => B.has(w)).length / A.length; };
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const keyOf = (u) => S(u).trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?/, '').replace(/[#?].*$/, '').replace(/\/+$/, '');
  const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with']);
  const titleCase = (k) => S(k).split(/\s+/).filter(Boolean).map((w, i) => i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : /^[a-z]{2,4}$/.test(w) && /^(erp|crm|ai|uae|ksa|gcc|vat|seo|sap|hr|it|b2b|saas|api|ms|iot|ml|pdf|faq)$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const QUESTION_KW = /^(is|are|can|does|do|what|which|how|why|when|where|who|should|will)\b/i;

  // ---------- 1. the contract ----------
  const PT_TARGETS = {
    guide: { h2: [5, 9], text: '5 to 9 H2 sections, at least 3 headings phrased as the questions readers ask with a 40-60 word answer right under each, a comparison table where options are compared, the call to action last' },
    service: { h2: [4, 8], text: '4 to 8 H2 sections: what the service covers, who it suits, how to decide, how to start; at least 2 question headings; the call to action last' },
    local: { h2: [4, 7], text: '4 to 7 H2 sections; the address, phone and service area only as the business profile gives them; the call to action last' },
    case_study: { h2: [4, 7], text: 'challenge, approach, result and what the reader can learn, every fact from the case study on file; nothing added' },
    other: { h2: [4, 9], text: '4 to 9 H2 sections, at least 3 question headings answered directly, the call to action last' }
  };
  const kindOf = (pageType, role) => { const t = S(pageType).toLowerCase(); if (S(role) === 'local') return 'local'; if (S(role) === 'case_study' || /case stud/.test(t)) return 'case_study';
    if (/service|landing|product|solution/.test(t)) return 'service'; if (/guide|blog|article|pillar|hub|how/.test(t)) return 'guide'; return 'other'; };
  const bandOf = (p) => { const LB = ((p || {}).competitor_analysis || {}).length_band || (p || {}).length_band || null;
    return LB && (LB.ok || LB.source === 'page_type') && Number(LB.low) > 0 && Number(LB.high) >= Number(LB.low)
      ? { low: Number(LB.low), high: Number(LB.high), source: LB.ok ? 'ranking_pages' : 'page_type', basis: clean(LB.basis) } : null; };
  const contract = (prev) => {
    const p = prev || {};
    const band = bandOf(p);
    const kind = kindOf(p.page_type, p.page_role);
    const biz = S((p.site_profile || {}).business_name || (p.site_description || {}).business_name || p.business_name || 'the business').trim() || 'the business';
    const length_text = band
      ? 'LENGTH: judged as a band, ' + band.low + '-' + band.high + ' words of main content' + (band.basis ? ' (' + band.basis + ')' : '') + '. Anywhere inside the band is right: aim for the brief\'s target word count, never pad to reach a number and never cut a complete answer to hit one. Length is advice, never a reason to refuse the page.'
      : 'LENGTH: aim for the brief\'s target word count; the check accepts anything from 80% to 125% of it. Never pad and never cut a complete answer to hit a number. Length is advice, never a reason to refuse the page.';
    const rules = [
      'THE PAGE CONTRACT (the brief, the writer, the reviewer, the editor and the quality check all apply these same rules)',
      length_text,
      'BRACKETS: none in the page. Never write a placeholder, a [Confirm: ...], an [Author insight: ...] or any other square-bracket note in the text (Markdown links and [Image: ...] lines are fine). When a fact is missing, write the sentence so it does not need it. A question for ' + biz + ' goes in the brief\'s questions_for_client list, never into the page.',
      'CLAIMS: say what ' + biz + ' does, offers, has done, holds or guarantees only when the business facts, the author profile, the case studies or its own pages state it. Write methods, steps and checklists as advice to the reader ("a sound migration starts with an inventory of ..."), never as "we do" or "our process". The call to action invites the reader to get in touch the way the facts say; it never promises a deliverable, a timeline, a price or a result that is not on file.',
      'NEVER: invented testimonials, reviews, quotes, client names, results, guarantees, certifications, team details or numbers about the business. A figure about the world is quoted exactly as a cited source states it, and the source is a page this run read.',
      'PAGE TYPE (' + (S(p.page_type) || kind) + '): ' + PT_TARGETS[kind].text + '.',
      'WHAT BLOCKS PUBLISHING: an unsupported statement about the business, a figure its source does not state, a market, adoption, cost or compliance figure whose only source is a vendor or agency blog, a bracket in the text, a dead link, a wrong brand name, copied text, a fake testimonial or guarantee, a page cut off before its end. Everything else (length, term coverage, headings, tables, readability) is advice.'
    ];
    return { version: 1, band, kind, h2_range: PT_TARGETS[kind].h2, business: biz, length_text, text: rules.join('\n') };
  };

  // ---------- 2. the page as sections ----------
  const split = (md) => {
    const src = S(md); const lines = src.split('\n'); const starts = []; let off = 0;
    for (const l of lines) { starts.push(off); off += l.length + 1; }
    let i = 0; while (i < lines.length && (META.test(lines[i].trim()) || !lines[i].trim())) i++;
    const headEnd = i < lines.length ? starts[i] : src.length;
    const cuts = [headEnd]; let fence = false;
    for (let k = i; k < lines.length; k++) {
      if (/^\s*(```|~~~)/.test(lines[k])) { fence = !fence; continue; }
      if (!fence && /^## /.test(lines[k]) && starts[k] !== cuts[cuts.length - 1]) cuts.push(starts[k]);
    }
    const parts = [];
    for (let c = 0; c < cuts.length; c++) { const a = cuts[c], b = c + 1 < cuts.length ? cuts[c + 1] : src.length; const text = src.slice(a, b);
      parts.push({ id: 's' + c, start: a, end: b, heading: c === 0 ? plain((text.match(/^# .*$/m) || [''])[0].replace(/^#\s*/, '')) : plain(text.split('\n')[0].replace(/^#+\s*/, '')), text }); }
    return { head: src.slice(0, headEnd), parts };
  };
  const join = (sp) => sp.head + sp.parts.map(p => p.text).join('');
  const partAt = (sp, at) => { const hl = sp.head.length; if (at < hl) return null; return sp.parts.find(p => at >= p.start && at < p.end) || sp.parts[sp.parts.length - 1] || null; };
  const isCta = (sp, part) => !!part && part === sp.parts[sp.parts.length - 1] && part.id !== 's0';

  // ---------- 3. sentences: find, remove, keep the page well formed ----------
  // link targets are shadowed so a full stop inside a URL never ends a sentence (the same trick as Content QA §3)
  const shadow = (t) => S(t).replace(/\]\(([^)\s]+)\)/g, (m) => '](' + 'x'.repeat(Math.max(0, m.length - 3)) + ')');
  const isEnd = (g, i) => { const c = g[i]; if (c === '\n' || c === '|') return true; if (c === '!' || c === '?') return true;
    if (c === '.') return !(/\d/.test(g[i - 1] || '') && /\d/.test(g[i + 1] || '')) && (i + 1 >= g.length || /[\s)*_"']/.test(g[i + 1])); return false; };
  const span = (md, at, len) => {
    const g = shadow(md); let a = at, b = at + len;
    while (a > 0 && !isEnd(g, a - 1)) a--;
    while (a < at && /[ \t]/.test(md[a])) a++;
    // H3 (2026-10-28): a span that already ends on a sentence end (the sentence passed with its full stop) stops there; it used to run on and
    // take the NEXT sentence with it
    while (b < g.length && !isEnd(g, b) && !(b > at && /[.!?]/.test(g[b - 1]) && isEnd(g, b - 1))) b++;
    if (b < g.length && /[.!?]/.test(g[b])) { b++; while (b < g.length && /[)*_"']/.test(g[b])) b++; }
    while (b < g.length && /[ \t]/.test(md[b])) b++;
    return [a, b];
  };
  const LIST_ONLY = /^\s*(?:[-*+]|\d{1,3}[.)]|>)?\s*(?:\*\*|__)?\s*(?:\*\*|__)?\s*$/;
  const tidy = (md) => {
    let out = S(md).split('\n').filter((l, i, a) => !(l.trim() && LIST_ONLY.test(l) && !/^\s*$/.test(l))).join('\n');
    // a heading (H2-H4) left with nothing under it before the next heading of its level or higher is removed with its section
    const lines = out.split('\n'); const keep = new Array(lines.length).fill(true);
    for (let i = 0; i < lines.length; i++) { const m = lines[i].match(/^(#{2,4})\s/); if (!m) continue; const lvl = m[1].length; let j = i + 1, body = false;
      for (; j < lines.length; j++) { const h = lines[j].match(/^(#{1,6})\s/); if (h && h[1].length <= lvl) break; if (h) { body = true; break; } if (lines[j].trim() && !/^\[Image:/i.test(lines[j].trim())) { body = true; break; } }
      if (!body) keep[i] = false; }
    out = lines.filter((l, i) => keep[i]).join('\n');
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2');
  };
  // remove what sits at [at, at+len): a whole sentence in prose, a table row (never the header row), only the text in a heading
  const removeAt = (md, at, len) => {
    const src = S(md); const ls = src.lastIndexOf('\n', at - 1) + 1; let le = src.indexOf('\n', at + len); if (le < 0) le = src.length;
    const line = src.slice(ls, le);
    // W0-A (2026-10-29, page-quality PLAN Fix 1): a meta line is never edited by a sentence removal. Removing only the span left
    // "Meta Description:" empty (3299) and a reader then took the next line ("Slug: ...") as its value; PF.meta owns the meta lines
    if (META.test(line.trim())) return src;
    if (/^#{1,6}\s/.test(line)) return src.slice(0, at) + src.slice(at + len);
    if (/^\s*\|/.test(line)) {
      const next = src.slice(le + 1, (src.indexOf('\n', le + 1) + 1 || src.length + 1) - 1);
      if (/^\s*\|?\s*:?-{2,}/.test(next)) return src.slice(0, at) + src.slice(at + len);   // a header cell: the token only
      return src.slice(0, ls) + src.slice(Math.min(src.length, le + 1));
    }
    const [a, b] = span(src, at, len);
    return src.slice(0, a) + src.slice(b);
  };
  const removeText = (md, text) => { const t = S(text); if (!t) return { md, done: false }; const at = S(md).indexOf(t); if (at < 0) return { md, done: false }; return { md: removeAt(md, at, t.length), done: true }; };
  // W0-E (2026-10-29, page-quality PLAN Fix 5.3, R4 G15): where a removed statement stood, read BEFORE it goes: its section, the sentence
  // before it and the sentence after it on its own line, else (a sentence alone on its line) the last sentence of the line above. A later
  // "yes" from the client puts it back at this anchor and nowhere else; the page carries no guessed "neutral" sentence for it (3299 q5
  // matched an unrelated checklist item by word overlap and Finalize replaced that item with the confirmed claim)
  const sentencesOf = (t) => S(t).split(/(?<=[.!?]["')*_]*)\s+/).map(x => x.trim()).filter(Boolean);
  const LEAD = /^\s*(?:[-*+]|\d{1,3}[.)]|>)?\s*/;
  const anchorAt = (md, at, len) => {
    const src = S(md); const sp = split(src); const part = partAt(sp, at);
    const ls = src.lastIndexOf('\n', at - 1) + 1; let le = src.indexOf('\n', at + len); if (le < 0) le = src.length;
    const [a, b] = span(src, at, len);
    const lead = (src.slice(ls, Math.max(ls, a)).match(LEAD) || [''])[0].length;
    const pre = src.slice(ls + lead, Math.max(ls + lead, a)).trim(); const post = src.slice(Math.min(b, le), le).trim();
    const xs = sentencesOf(pre); const before = xs.length ? xs[xs.length - 1] : ''; const after = sentencesOf(post)[0] || '';
    let line_before = '';
    if (!before && !after) { const ok = (x) => x && !/^#{1,6}\s/.test(x) && !/^!\[/.test(x) && !/^\s*\|?\s*:?-{2,}/.test(x) && !META.test(x);
      const above = src.slice(part ? part.start : 0, ls).split('\n').map(x => x.trim()).filter(ok); const ys = sentencesOf((above[above.length - 1] || '').replace(LEAD, '')); line_before = ys.length ? ys[ys.length - 1] : ''; }
    return { section: part ? part.heading : '', section_id: part ? part.id : '', before: before.slice(0, 400), after: after.slice(0, 400), line_before: line_before.slice(0, 400) }; };
  // the sentence that holds a link to the business's own site keeps its link as a neutral next step; any other sentence goes
  const ownLinkIn = (sentence, domain) => { const d = S(domain).toLowerCase().replace(/^www\./, ''); if (!d) return null;
    for (const m of S(sentence).matchAll(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) { const h = hostOf(m[2]); if (h === d || h.endsWith('.' + d)) return { anchor: m[1], url: m[2] }; } return null; };
  const neutralSentence = (md, sentence, domain, rewrite) => {
    const src = S(md); const wrapped = '[Confirm: ' + sentence + ']';
    let at = src.indexOf(wrapped), len = wrapped.length; if (at < 0) { at = src.indexOf(sentence); len = S(sentence).length; }
    if (at < 0) return { md: src, done: false, how: '' };
    // W0-A: neither the call-to-action nor the reworded path (nor the removal) ever touches a meta line (PF.meta owns them)
    { const ls = src.lastIndexOf('\n', at - 1) + 1; let le = src.indexOf('\n', at); if (le < 0) le = src.length; if (META.test(src.slice(ls, le).trim())) return { md: src, done: false, how: 'meta' }; }
    const link = ownLinkIn(sentence, domain);
    if (link) { const line = 'Next step: [' + link.anchor.replace(/^\s+|\s+$/g, '') + '](' + link.url + ').'; return { md: src.slice(0, at) + line + src.slice(at + len), done: true, how: 'cta', text: line }; }
    // H2's neutral wording (CL.neutral): a method in the business's voice kept as advice to the reader; a stance or a client fact goes
    const rw = rewrite || {}; const nt = S(rw.neutral).trim();
    if (rw.action === 'reword' && nt && !/\[/.test(nt)) { return { md: src.slice(0, at) + nt + src.slice(at + len), done: true, how: 'reworded', text: nt }; }
    return { md: removeAt(src, at, len), done: true, how: 'removed', anchor: anchorAt(src, at, len) };
  };

  // ---------- 4. brackets ----------
  const BRACKET = () => /(?<![!\\])\[(\p{L}[^\[\]\n]{0,399})\](?![(:])/gu;
  const CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`/g;
  const MASK = /^(?:Price|Statistic|Number|Amount|Figure|Percentage|Timeline|Date)$/i;
  const NOT_GAP = /^(?:sic!?|x| |emphasis (?:added|mine|ours)|(?:last )?(?:updated|revised|edited|reviewed|published)\b[^\]]*\d{4}|(?:19|20)\d\d)$/i;
  // W0-A: the meta lines are read by PF.meta (a bracket there is unwrapped or the description rebuilt), never by the sentence removal
  const META_LINES = /^[ \t]*(?:Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)[ \t]*:.*$/gim;
  const bracketsIn = (md) => { const t = S(md).replace(CODE, (m) => ' '.repeat(m.length)).replace(META_LINES, (m) => ' '.repeat(m.length)); const out = [];
    for (const m of t.matchAll(BRACKET())) { const inner = m[1].trim(); if (!inner || /^image\s*:/i.test(inner) || NOT_GAP.test(inner)) continue; out.push({ token: m[0], inner, at: m.index }); }
    return out; };
  const questionFor = (inner, biz) => {
    const x = S(inner).replace(/^(?:author insight|confirm|owner)\s*:\s*/i, '').replace(/\s+/g, ' ').trim().replace(/[.;:,]+$/, '');
    if (/^author insight/i.test(inner)) return { kind: 'experience', question: 'From your own work: ' + x.charAt(0).toLowerCase() + x.slice(1) + '? One real example in a sentence or two is enough.' };
    if (/^case stud/i.test(x) || /case study/i.test(x)) return { kind: 'proof', question: 'Is there a client result you are happy to publish (with or without the client\'s name)? ' + x.replace(/^case study\s*:\s*/i, '') };
    if (/partner|certif|accredit|designation|award|iso\s?\d/i.test(x)) return { kind: 'credential', question: 'Please confirm for ' + biz + ': ' + x.charAt(0).toLowerCase() + x.slice(1) + '.' };
    if (/^date$/i.test(x)) return { kind: 'detail', question: '' };
    if (MASK.test(x) || /\b(price|fee|cost|rate|budget)\b/i.test(x)) return { kind: 'price', question: 'Do you want prices on this page? If so, give us the figure you are happy to publish.' };
    if (/\b(duration|timeline|weeks?|months?|how long)\b/i.test(x)) return { kind: 'timeline', question: 'Is there a typical timeline you are happy to publish? ' + x };
    return { kind: 'detail', question: 'Please give us this detail for the page: ' + x.charAt(0).toLowerCase() + x.slice(1) + '.' };
  };
  // a writer's [Confirm: ...] about a third party's product is research, not a client question
  const aboutBusiness = (inner, names) => { const t = S(inner).toLowerCase(); if (/\b(we|our|us|your business|the business|the client)\b/.test(t)) return true; return (names || []).some(n => n && t.includes(S(n).toLowerCase())); };

  // ---------- 5. the deterministic fixes (before every quality check) ----------
  // the keyword as the page itself writes its words ("Microsoft", "ERP"), the first word capitalised
  const caseLike = (kw, md) => S(kw).split(/\s+/).filter(Boolean).map((w, i) => {
    const forms = new Map(); for (const m of S(md).matchAll(new RegExp('(?<![\\p{L}\\p{N}])' + escRe(w) + '(?![\\p{L}\\p{N}])', 'giu'))) forms.set(m[0], (forms.get(m[0]) || 0) + 1);
    const best = [...forms.entries()].filter(([f]) => f !== f.toLowerCase()).sort((a, b) => b[1] - a[1])[0];
    const f = best ? best[0] : w; return i === 0 ? f.charAt(0).toUpperCase() + f.slice(1) : f; }).join(' ');
  const unmark = (md, marks, figures) => { let out = S(md);
    for (const s of (marks || [])) if (s) out = out.split('[Confirm: ' + s + ']').join(s);
    for (const f of (figures || [])) if (f) out = out.split('[Confirm: ' + f + ']').join(f);
    return out; };
  // ---------- 5a. the meta description (W0-A, 2026-10-29, docs/page-quality-2026-10-29/PLAN.md Fix 1; R4 D1 / D2 / G22 / G27) ----------
  // Production page run 3299: the claim check read the meta description as a statement about the business, a removal emptied the line, and
  // two readers took the next line ("Slug: ms-365-erp-uae", 20 characters) as its value: in the HTML head, Open Graph, the Service schema
  // and the final version. The meta description is search-result copy written from the brief, so it is never claim-checked; it gets
  // ONE narrow field check instead: a clause naming a price, a guarantee, a timeline or a number that neither the facts on file nor the page
  // itself carries is dropped (code, no model). A description that is missing, under 70 characters, on more than one line, starting with a
  // field label or holding a bracket is rebuilt: from the brief's meta_description when it passes the field check, else from the Quick
  // answer (then the introduction), 120-155 characters with the keyword. A description that already passes is left exactly as it is.
  const META_LABEL = /^(?:Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords|URL|Page Type)\s*:/i;
  const metaProblem = (d0) => { const d = S(d0).replace(/\s+$/, ''); const t = d.trim();
    if (!t) return 'missing'; if (/\n/.test(d)) return 'multi_line'; if (META_LABEL.test(t)) return 'label'; if (/[\[\]]/.test(t)) return 'bracket';
    if (t.length < 70) return 'short'; if (t.length > 155) return 'long'; return ''; };
  const META_PROBLEM_TEXT = { missing: 'is missing', multi_line: 'runs over more than one line', label: 'starts with a field label instead of a description',
    bracket: 'holds a bracket', short: 'is under 70 characters', long: 'is over 155 characters' };
  const F_PRICE = /(?:\b(?:aed|usd|eur|gbp|sar|qar|kwd|bhd|omr|inr|pkr|egp)\s?\d[\d,.]*|[$€£]\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:aed|usd|eur|gbp|sar|dirhams?|dollars?|riyals?)\b|\bfree of charge\b|\bat no (?:extra )?cost\b|\bno (?:hidden )?(?:fees?|charges?)\b|\bfree (?:consultation|assessment|audit|quote|demo|call|review|session|estimate)s?\b|\bdiscount\w*|\b\d+\s?% off\b)/gi;
  const F_GUAR = /\b(?:guarantee\w*|money[- ]back|refund\w*|warrant(?:y|ies)|risk[- ]free)\b/gi;
  const F_TIME = /\b(?:in|within|under)\s+(?:just\s+|only\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)(?:\s*(?:-|to)\s*\d+)?\s*(?:hours?|days?|weeks?|months?)\b|\b\d+[- ](?:hour|day|week|month)s?\b/gi;
  const F_NUM = /\d[\d,.]*\d|\d/g;
  const numKey = (n) => S(n).replace(/,/g, '').replace(/\.+$/, '');
  // the narrow field check: what a clause names must be on file (the facts, the profile) or on the page itself (whose own statements the
  // claim and figure checks hold to their sources); the clauses that name something else are dropped, the rest of the sentence is kept
  const fieldCheck = (desc, corpus) => {
    const C = S(corpus).toLowerCase(); const nums = new Set((C.match(F_NUM) || []).map(numKey));
    const backed = (m) => { const ns = S(m).match(F_NUM); if (ns) return ns.every(n => nums.has(numKey(n)));
      const ws = S(m).toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2 && !STOP.has(w)); return ws.length > 0 && ws.every(w => C.includes(w)); };
    const bad = (t) => { for (const re of [F_PRICE, F_GUAR, F_TIME, F_NUM]) for (const x of S(t).matchAll(re)) if (!backed(x[0])) return x[0]; return ''; };
    const dropped = [];
    const kept = S(desc).split(/(?<=[.!?])\s+/).filter(x => x.trim()).map(sent => { if (!bad(sent)) return sent;
      const end = (sent.match(/[.!?]$/) || [''])[0]; const body = end ? sent.slice(0, -1) : sent;
      const pieces = body.split(/(,\s+|;\s+|\s+(?:and|then|so|or|plus)\s+|\s+[-:]\s+)/); let out = '';
      for (let i = 0; i < pieces.length; i += 2) { const cl = pieces[i]; if (!cl.trim()) continue;
        if (bad(cl)) { dropped.push(cl.trim()); continue; }
        out = out ? out + (pieces[i - 1] || ', ') + cl.trim() : cl.trim().replace(/^./, (x) => x.toUpperCase()); }
      return out ? out.replace(/[\s,;:-]+$/, '') + (end || '.') : ''; }).filter(Boolean);
    return { text: kept.join(' ').replace(/\s+/g, ' ').trim(), dropped };
  };
  // a review mark the head may carry from an older round: its words stay, the mark goes
  const unwrapHead = (t) => S(t).replace(/\[(?:Confirm|Owner)\s*:\s*(?:confirm\s*[-:\u2013\u2014]\s*)?([^\[\]]*)\]/gi, '$1').replace(/\s+/g, ' ').trim();
  // a text cut to a description: whole sentences up to 155 characters, at least 120 where the text allows (then cut at a comma or a word),
  // the keyword in it
  const fitMeta = (text, kwRe, KW) => {
    let t = clean(plain(S(text).replace(/^\**\s*Quick answer:?\**\s*/i, ''))).replace(/\s+/g, ' ').trim(); if (!t) return '';
    if (kwRe && KW && !kwRe.test(t)) t = QUESTION_KW.test(KW) ? KW.replace(/\?*$/, '?') + ' ' + t : KW + ': ' + t;
    let out = ''; for (const s of t.split(/(?<=[.!?])\s+/)) { const nx = out ? out + ' ' + s : s; if (nx.length <= 155) out = nx; else break; }
    if (out.length < 120 && t.length > out.length) {
      const win = t.slice(0, 153); let at = -1;
      for (const x of win.matchAll(/,\s|;\s|\s(?:and|or|but|with|while|so|because)\s/g)) if (x.index >= 120) at = x.index;
      let cut = at >= 0 ? win.slice(0, at) : win.replace(/\s+\S*$/, '');
      if (at < 0) cut = cut.replace(/(?:\s+(?:a|an|the|and|or|but|of|to|for|in|on|with|your|our|its|their|by|at|as|from|that|which|how|what))+$/i, '');
      if (cut.length > out.length) out = cut.replace(/[\s,;:&-]+$/, '') + (/[.!?]$/.test(cut) ? '' : '.'); }
    return out; };
  const meta = (md0, ctx) => {
    const c = ctx || {}; let md = S(md0); const fixes = [];
    const re = /^Meta Description:[ \t]*(.*)$/im;
    const kw = S(c.keyword).trim();
    const kwRe = !kw ? null : c.termRe ? c.termRe(kw, 'i') : new RegExp(escRe(kw).replace(/ /g, '[\\s-]+'), 'i');
    const KW = kw ? (QUESTION_KW.test(kw) ? caseLike(kw, md) : titleCase(caseLike(kw, md))) : '';
    const bodyMd = md.split('\n').filter(l => !META.test(l.trim())).join('\n');
    const corpus = [S(c.own_text), plain(bodyMd), kw].join('\n');
    const m = md.match(re); const was = m ? m[1].trim() : '';
    let desc = was; let how = 'kept';
    if (/\[/.test(desc)) { const u = unwrapHead(desc); if (u !== desc) { desc = u; how = 'unwrapped'; } }
    if (desc && !META_LABEL.test(desc)) { const fc = fieldCheck(desc, corpus);
      if (fc.dropped.length) { desc = fc.text; how = 'field_check'; fixes.push('Took ' + fc.dropped.length + ' clause(s) out of the meta description that name a price, a guarantee, a timeline or a number that nothing on file and nothing on the page states (' + fc.dropped.slice(0, 3).map(x => '"' + x.slice(0, 60) + '"').join(', ') + ')'); } }
    if (desc.length > 155 && !/^(label|bracket|multi_line)$/.test(metaProblem(desc))) { let d2 = desc.slice(0, 155); const lastStop = Math.max(d2.lastIndexOf('. '), d2.endsWith('.') ? d2.length - 1 : -1);
      d2 = lastStop >= 100 ? d2.slice(0, lastStop + 1) : d2.replace(/\s+\S*$/, '').replace(/[\s,;:&-]+$/, '') + '.';
      desc = d2; how = 'shortened'; fixes.push('Shortened the meta description to ' + d2.length + ' characters'); }
    if (metaProblem(desc)) {
      const sp = split(md); const s0 = sp.parts[0] ? sp.parts[0].text : '';
      const qaLine = (s0.match(/^\**\s*Quick answer:?\**[ \t]*(.+)$/im) || bodyMd.match(/^\**\s*Quick answer:?\**[ \t]*(.+)$/im) || [, ''])[1];
      const intro = s0.split('\n').filter(l => l.trim() && !/^(#|!\[|\[Image|\*\*\s*Quick answer|\*[^*]+\*\s*$|>|\||[-*+]\s|\d+[.)]\s)/i.test(l.trim())).join(' ');
      const brief = (() => { const b = unwrapHead(S(c.brief_meta)); return b ? fieldCheck(b, corpus).text : ''; })();
      for (const [src, text, fit, tag] of [['the brief', brief, false, 'brief'], ['the Quick answer', qaLine, true, 'quick_answer'], ['the introduction', intro, true, 'introduction']]) {
        if (!S(text).trim()) continue; const d = fit ? fitMeta(text, kwRe, KW) : clean(S(text)).replace(/\s+/g, ' ').trim();
        if (!metaProblem(d)) { fixes.push('Wrote the meta description from ' + src + ' (' + d.length + ' characters): the draft\'s ' + (was ? META_PROBLEM_TEXT[metaProblem(desc)] || 'did not pass the field check' : 'was missing'));
          desc = d; how = tag; break; } }
    }
    if (desc !== was) {
      const line = 'Meta Description: ' + desc;
      if (m) md = md.replace(re, () => line);
      else { const lines = md.split('\n'); const ti = lines.findIndex(l => /^Title[ \t]*:/i.test(l.trim()));
        if (ti >= 0) lines.splice(ti + 1, 0, line); else lines.splice(0, 0, ...(META.test(S(lines[0]).trim()) ? [line] : [line, ''])); md = lines.join('\n'); }
    }
    const problem = metaProblem(desc);
    return { md, description: desc, how: desc === was ? 'kept' : how, problem, problem_text: problem ? 'The meta description ' + META_PROBLEM_TEXT[problem] : '', fixes };
  };
  const fix = (md0, ctx) => {
    const c = ctx || {}; let md = S(md0); const fixes = [], removed = [];
    const kw = S(c.keyword).trim();
    const kwRe = !kw ? null : c.termRe ? c.termRe(kw, 'i') : new RegExp(escRe(kw).replace(/ /g, '[\\s-]+'), 'i');
    // a. the quality check's own [Confirm: ...] marks of an earlier round are taken off (the next check judges the words themselves); a
    //    writer's own [Confirm: ...] note is not one of them and goes with the brackets below
    const before = md;
    md = unmark(md, c.qa_marks, c.qa_figure_marks);
    if (md !== before) fixes.push('Took the review marks of the last check off the text (the next check reads the words themselves)');
    // b. brackets: none in the page. Each one goes, with the sentence that needs it; what only the client knows becomes a question
    const names = c.names || [];
    for (let guard = 0; guard < 60; guard++) {
      const bs = bracketsIn(md); if (!bs.length) break; const b = bs[0];
      const q = questionFor(b.inner, c.business || 'your business');
      const research = /^(confirm|owner)\s*:/i.test(b.inner) && !aboutBusiness(b.inner, names);
      const ls = md.lastIndexOf('\n', b.at - 1) + 1; let le = md.indexOf('\n', b.at); if (le < 0) le = md.length;
      const line = md.slice(ls, le);
      const alone = line.replace(b.token, '').replace(/^\s*(?:[-*+]|\d{1,3}[.)]|>)?\s*/, '').replace(/[*_\s.:;,]+/g, '') === '';
      const sentence = plain(md.slice(...span(md, b.at, b.token.length)));
      md = alone ? md.slice(0, ls) + md.slice(Math.min(md.length, le + 1)) : removeAt(md, b.at, b.token.length);
      removed.push({ token: b.token, sentence: alone ? '' : sentence, kind: research ? 'research' : q.kind, question: research || MASK.test(b.inner) && !/price/i.test(b.inner) ? '' : q.question, research: research ? b.inner.replace(/^(confirm|owner)\s*:\s*/i, '') : '' });
    }
    if (removed.length) fixes.push('Took ' + removed.length + ' bracket(s) out of the text with the words that needed them (' + removed.slice(0, 3).map(r => r.token.slice(0, 60)).join(', ') + (removed.length > 3 ? ' and ' + (removed.length - 3) + ' more' : '') + '): a page carries no brackets; what only you know is asked as a question instead');
    // c. meta lines
    const metaRe = (l) => new RegExp('^(' + l + '):[ \\t]*(.*)$', 'im');
    // W0-A: the sentence removal never edits a meta line (bracketsIn does not read them), so a review mark left in the title is unwrapped here
    { const t0 = md.match(metaRe('Title')); if (t0 && /[\[\]]/.test(t0[2])) { const t1 = unwrapHead(t0[2]).replace(/\[[^\[\]]*\]/g, '').replace(/\s+/g, ' ').trim(); if (t1 && t1 !== t0[2].trim()) { md = md.replace(metaRe('Title'), () => 'Title: ' + t1); fixes.push('Took the review mark off the meta title'); } } }
    const tm = md.match(metaRe('Title')); let title = tm ? tm[2].trim() : '';
    const KW = kw ? (QUESTION_KW.test(kw) ? caseLike(kw, md) : titleCase(caseLike(kw, md))) : '';
    if (title && kwRe && !kwRe.test(title)) { const t2 = KW + ': ' + title; title = t2.length <= 60 ? t2 : KW + (c.business && (KW.length + 3 + S(c.business).length) <= 60 ? ' | ' + c.business : '');
      md = md.replace(metaRe('Title'), 'Title: ' + title); fixes.push('Put the keyword at the start of the meta title'); }
    if (title.length > 60) { const parts = title.split(/\s+[|\-:]\s+/); let t2 = parts[0]; for (const p of parts.slice(1)) { if ((t2 + ' | ' + p).length <= 60) t2 += ' | ' + p; else break; }
      if (t2.length > 60 || (kwRe && !kwRe.test(t2))) { t2 = title.slice(0, 60).replace(/\s+\S*$/, '').replace(/[\s|:,;&-]+$/, ''); }
      if (t2 && t2.length <= 60 && (!kwRe || kwRe.test(t2))) { md = md.replace(metaRe('Title'), 'Title: ' + t2); fixes.push('Shortened the meta title to ' + t2.length + ' characters'); title = t2; } }
    // W0-A: the meta description by its one rule (PF.meta: the field check, the length, a rebuild from the brief or the Quick answer)
    { const MD = meta(md, c); md = MD.md; fixes.push(...MD.fixes); }
    const sm = md.match(metaRe('Slug'));
    if (sm && !c.planned_slug) { const s0 = sm[2].trim(); const s1 = s0.toLowerCase().replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (s1 && s1 !== s0.replace(/^\/+|\/+$/g, '')) { md = md.replace(metaRe('Slug'), 'Slug: ' + s1); fixes.push('Wrote the slug as lowercase words joined by hyphens (' + s1 + ')'); } }
    // d. the keyword in the H1 and, for a question keyword, as the first words of the introduction
    const h1m = md.match(/^# (.+)$/m);
    if (h1m && kwRe && !kwRe.test(h1m[1])) {
      const q = QUESTION_KW.test(kw); const h = q ? KW.replace(/\?*$/, '?') : (KW + ': ' + h1m[1]).length <= 90 ? KW + ': ' + h1m[1] : '';
      if (h) { md = md.replace(/^# .+$/m, '# ' + h); fixes.push('Put the keyword in the H1'); }
    }
    {
      const sp = split(md); const s0 = sp.parts[0];
      if (s0 && kwRe && QUESTION_KW.test(kw)) { const body = s0.text.replace(/^# .*$/m, ''); const first = plain(body).split(/\s+/).slice(0, 100).join(' ');
        if (!kwRe.test(first)) { const lines = s0.text.split('\n'); const pi = lines.findIndex((l, i) => i > 0 && l.trim() && !/^(#|!\[|\[Image|\*\*\s*Quick answer)/i.test(l.trim()));
          if (pi > 0) { lines[pi] = KW.replace(/\?*$/, '?') + ' ' + lines[pi].trim(); s0.text = lines.join('\n'); md = join(sp); fixes.push('Opened the introduction with the question the page answers, so the keyword is in its first 100 words'); } } }
    }
    // e. the Quick answer within the first 120 words under the H1 (60 for an AI answer target)
    {
      const limit = c.ai_target ? 60 : 120; const sp = split(md); const s0 = sp.parts[0];
      if (s0) { const lines = s0.text.split('\n'); const qi = lines.findIndex(l => /^\**\s*Quick answer:?\**/i.test(l.trim()));
        if (qi > 0) { const beforeQ = plain(lines.slice(1, qi).filter(l => !/^#/.test(l)).join(' ')); const n = words(beforeQ);
          if (n > limit) { const qa = lines.splice(qi, 1)[0]; let pi = lines.findIndex((l, i) => i > 0 && l.trim() && !/^(#|!\[|\[Image)/i.test(l.trim())); let pe = pi; while (pe >= 0 && pe < lines.length && lines[pe].trim()) pe++;
            if (pi > 0) { lines.splice(pe, 0, '', qa, ''); s0.text = lines.join('\n'); md = join(sp); fixes.push('Moved the Quick answer up to right after the first paragraph (it came after ' + n + ' words)'); } } } }
    }
    // f. a snippet question from the brief becomes the heading it already nearly is
    for (const st of (c.snippet_targets || [])) { const qn = plain(st && st.question).replace(/\?*$/, '?'); if (!qn || qn.length < 8) continue;
      if (new RegExp('^#{2,3}\\s*' + escRe(qn.replace(/\?$/, '')), 'im').test(md)) continue;
      const heads = [...md.matchAll(/^(#{2,3})\s+(.+)$/gm)].map(m => ({ lvl: m[1], text: m[2], at: m.index, full: m[0] }));
      const best = heads.map(h => ({ h, s: Math.min(overlap(qn, h.text), overlap(h.text, qn)) })).filter(x => x.s >= 0.6).sort((a, b) => b.s - a.s)[0];
      if (best && plain(best.h.text).replace(/\?$/, '').toLowerCase() !== qn.replace(/\?$/, '').toLowerCase()) { md = md.slice(0, best.h.at) + best.h.lvl + ' ' + qn + md.slice(best.h.at + best.h.full.length); fixes.push('Phrased the heading "' + plain(best.h.text) + '" as the question the brief targets: "' + qn + '"'); } }
    // g. internal links: none in the page, and a live page of the site whose name the text already uses: link the first mention
    if (c.domain && Array.isArray(c.internal_links) && c.internal_links.length) {
      const own = [...md.matchAll(/\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g)].filter(m => m[1].startsWith('/') || hostOf(m[1]) === S(c.domain).replace(/^www\./, '') || hostOf(m[1]).endsWith('.' + S(c.domain).replace(/^www\./, ''))).length;
      if (!own) { let added = 0; const sp = split(md);
        for (const l of c.internal_links) { if (added >= 2) break; const anchor = S(l && (l.anchor || l.title)).trim(); const url = S(l && l.url).trim(); if (!anchor || anchor.length < 6 || !/^https?:\/\//.test(url)) continue;
          for (const p of sp.parts.slice(1)) { const re = new RegExp('(^|[^\\[\\w])(' + escRe(anchor) + ')(?![\\w\\]])', 'i'); const lines = p.text.split('\n'); let hit = false;
            for (let i = 1; i < lines.length && !hit; i++) { if (/^(#|\||!\[)/.test(lines[i].trim()) || /\[[^\]]*$/.test(lines[i])) continue; const m = lines[i].match(re);
              if (m && !/\]\(/.test(lines[i].slice(m.index, m.index + m[0].length + 3))) { lines[i] = lines[i].slice(0, m.index + m[1].length) + '[' + m[2] + '](' + url + ')' + lines[i].slice(m.index + m[0].length); hit = true; } }
            if (hit) { p.text = lines.join('\n'); added++; break; } } }
        if (added) { md = join(sp); fixes.push('Linked ' + added + ' mention(s) of the site\'s own live pages'); } }
    }
    // h0. H2: the legal name is not the brand: a "(legal name: ...)" note after the brand goes everywhere, and the legal name itself never
    //     stands in the title, the meta description or a heading (the display name does)
    { const before0 = md; md = md.replace(/\s*\(\s*(?:legal(?:ly)?(?: name)?|registered(?: name| as)?)\s*[:=-]?[^)\n]*\)/gi, '');
      if (c.legal_name && c.brand) md = md.replace(/^(Title:|Meta Description:|#{1,6} ).*$/gim, (line) => line.split(c.legal_name).join(S(c.brand)));
      if (md !== before0) fixes.push('Wrote the business name as "' + S(c.brand) + '" where the legal name or a "(legal name: ...)" note stood in the title, a heading or a sentence'); }
    // h. the brand as the business writes it: a wrong form outside the stored name (and outside a legal name) is corrected
    if (c.brand && (c.wrong_forms || []).length) { const brand = S(c.brand).replace(/\s*\([^)]*\)\s*$/, '').trim(); const keep = [...(c.keep_forms || []), S(c.brand)].filter(Boolean);
      let n = 0; const masked = []; let t = md; keep.sort((a, b) => b.length - a.length).forEach((k, i) => { t = t.split(k).join('\u0000' + i + '\u0000'); masked.push(k); });
      for (const w of c.wrong_forms) { if (!w || w.length < 3) continue; const re = new RegExp('(^|[^\\p{L}\\p{N}@./-])(' + escRe(w) + ')(?![\\p{L}\\p{N}@-]|\\.[a-z])', 'giu');
        t = t.replace(re, (m0, pre) => { n++; return pre + brand; }); }
      t = t.replace(/\u0000(\d+)\u0000/g, (m0, i) => masked[Number(i)]);
      if (n) { md = t; fixes.push('Wrote the business name as "' + brand + '" in ' + n + ' place(s)'); } }
    return { md: tidy(md), fixes, removed };
  };

  // ---------- 6. blocking vs advisory ----------
  const brandHits = (md, ctx) => { const c = ctx || {}; if (!c.brand || !(c.wrong_forms || []).length) return 0; let t = S(md);
    [S(c.brand), ...(c.keep_forms || [])].filter(Boolean).sort((a, b) => b.length - a.length).forEach(k => { t = t.split(k).join(' '); });
    t = t.replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, ' ').replace(/\S+@\S+/g, ' ');
    let n = 0; for (const w of c.wrong_forms) { if (!w || w.length < 3) continue; n += (t.match(new RegExp('(^|[^\\p{L}\\p{N}.@/-])' + escRe(w) + '(?![\\p{L}\\p{N}@-]|\\.[a-z])', 'giu')) || []).length; } return n; };
  // a testimonial: a quoted sentence with a person's attribution that nothing on file carries (FTC rule on fake reviews, 2024)
  const testimonials = (md, own) => { const out = []; const O = S(own).toLowerCase();
    for (const m of S(md).matchAll(/(?:^>\s*)?["\u201C]([^"\u201D\n]{25,400})["\u201D]\s*(?:[-\u2013\u2014,]\s*|\n>?\s*[-\u2013\u2014]\s*)([A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]+){0,3})(?:,\s*([^\n]{2,80}))?/gmu)) {
      const quote = m[1].trim(); if (O && O.includes(quote.toLowerCase().slice(0, 60))) continue; out.push({ quote: quote.slice(0, 200), who: m[2], text: m[0] }); }
    return out; };
  const W = (s) => clean(S(s));
  // W0-H (2026-10-29, page-quality PLAN Fix 3b, R4 G9 / G18, REVIEW_EVIDENCE H1): a market, adoption, cost or compliance figure whose ONLY
  // source is a page with no independent authority (Content QA's tier "weak": a vendor's or agency's blog, a listicle, an unknown site).
  // Run 3299 put two such figures live (a market share from an agency blog, a company count from a tracker) after the Critic called both
  // high; they weighed 0.25 of advice. Each one is now a soft blocker: the editor gets "rewrite the sentence without the number" and, if
  // the figure is still there at the end, the system's own neutral rewrite takes the sentence out. Only what the page links is judged: a
  // sentence with one strong source (official, research house, major press, vendor documentation) is fine, and a link whose tier this run
  // never measured is not guessed (advice beats a wrong block). A year, a small count ("3 steps") or a standard's number is not a figure.
  const FIGURE = /(?:\b(?:AED|USD|SAR|QAR|KWD|BHD|OMR|EGP|PKR|INR|EUR|GBP|ZAR|Dhs?)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:thousand|million|billion|trillion|mn|bn|k|m|b)\b)?|[$€£₹]\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:thousand|million|billion|trillion|mn|bn|k|m|b)\b)?|\b\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b|per cent\b)|\b\d[\d,]*(?:\.\d+)?\s?(?:thousand|million|billion|trillion|mn|bn)\b|(?<!\b(?:ISO|IEC|EN|BS|SOC|PCI|IAS|IFRS|ASC|Article|Section|Law|Decree|No\.?)\s?(?:\/IEC\s?)?)\b\d{1,3}(?:,\d{3})+\b|(?<!\b(?:ISO|IEC|EN|BS|SOC|PCI|IAS|IFRS|ASC|Article|Section|Law|Decree|No\.?)\s?(?:\/IEC\s?)?)\b(?!(?:19|20)\d{2}\b)\d{4,}\b)/i;
  const FIGURE_TOPIC = /\bmarket|\bshare\b|\bindustr|\brevenue|\bvalued?\b|\bworth\b|\bcagr\b|\bgrow|\bsize\b|\bforecast|\bspend|\bcompan(?:y|ies)\b|\bbusinesses\b|\borgani[sz]ations?\b|\bfirms?\b|\benterprises?\b|\bcustomers?\b|\busers?\b|\bclients?\b|\bsmes?\b|\badopt|\buse[sd]?\b|\busing\b|\bdeploy|\bimplement|\bcost|\bprice|\bpricing|\bfees?\b|\bbudget|\bsav(?:e|es|ed|ing|ings)\b|\broi\b|\binvest|\bfines?\b|\bpenalt|\bdeadline|\bmandat|\bvat\b|\btax|\bregulat|\blaws?\b|\blegal|\bcompl(?:y|ies|iance|iant)\b|\be-?invoic|\bthreshold|\brequire|\bauthorit|\bministry|\bdecree/i;
  // W05-C: the figure keys of a sentence (digits, separators and spacing aside) and whether the run's own check found them in a source the
  // sentence links (Content QA's verified_figures: { figure, sources: [host] }); a check that carries no such list verifies nothing
  const figKey = (t) => S(t).toLowerCase().replace(/[\s,]/g, '').replace(/percent/g, '%');
  const figKeysIn = (t) => [...S(t).matchAll(new RegExp(FIGURE.source, 'gi'))].map(m => figKey(m[0])).filter(Boolean);
  const verifiedIn = (txt, hosts, qa) => { const v = Array.isArray((qa || {}).verified_figures) ? qa.verified_figures : []; if (!v.length) return false;
    const keys = figKeysIn(txt); if (!keys.length) return false;
    return keys.every(k => v.some(x => x && figKey(x.figure) === k && (!(x.sources || []).length || (x.sources || []).some(h => hosts.includes(S(h).replace(/^www\./, '')))))); };
  // the organisation behind a host, named in the sentence (its words or a link's anchor): "vendorco.example" -> "Vendorco"
  const hostLabel = (h) => { const p = S(h).replace(/^www\./, '').split('.'); const i = p.length >= 3 && /^(?:co|com|org|net|gov|ac|edu)$/.test(p[p.length - 2]) ? p.length - 3 : p.length - 2; return S(p[Math.max(0, i)]).toLowerCase(); };
  const namesHost = (sentence, host) => { const l = hostLabel(host); if (l.length < 3) return false; return new RegExp('(^|[^a-z0-9])' + escRe(l) + '(?![a-z0-9])', 'i').test(plain(sentence).replace(/-/g, '')); };
  const weakFigures = (md, qa0, ctx) => {
    const qa = qa0 || {}; const c = ctx || {}; const tiers = new Map();
    for (const x of [].concat(qa.outbound_links || [], Array.isArray(qa.sources_cited) ? qa.sources_cited : [])) if (x && x.url && x.tier) tiers.set(keyOf(x.url), S(x.tier));
    if (!tiers.size) return [];   // no tier measured for this draft (an older check): not judged here
    const d = S(c.domain).replace(/^www\./, ''); const own = (h) => !!d && (h === d || h.endsWith('.' + d));
    const sp = split(md); const body = S(md).slice(sp.head.length); const out = []; const seen = new Set();
    for (const line of body.split('\n')) {
      const l = line.trim(); if (!l || /^#{1,6}\s/.test(l) || /^\s*\|?\s*:?-{2,}/.test(l) || /^\[Image:/i.test(l)) continue;
      for (const s of (/^\|/.test(l) ? [l] : sentencesOf(l))) {
        const links = [...s.matchAll(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map(m => ({ url: m[2], host: hostOf(m[2]) })).filter(x => !own(x.host));
        if (!links.length || !links.every(x => tiers.get(keyOf(x.url)) === 'weak')) continue;
        const txt = plain(s); const f = txt.match(FIGURE); if (!f || !FIGURE_TOPIC.test(txt)) continue;
        if (seen.has(s)) continue; seen.add(s);
        const hosts = [...new Set(links.map(x => x.host))];
        // W05-C (2026-10-30, BEFORE_AFTER K6): a figure its own linked source STATES (Content QA's verified_figures) and whose sentence
        // names who published it ("Vendorco reports ...", "([Vendorco](...))") is a SOURCED figure: advice to name who measured it,
        // never a blocker, never "rewrite without the number" (K6 round 3 turned "39% to 66%" into "rose sharply")
        const verified = verifiedIn(txt, hosts, qa); const attributed = hosts.some(h => namesHost(s, h));
        out.push({ sentence: s, figure: f[0].trim(), hosts, verified, attributed, sourced: verified && attributed }); } }
    return out; };
  // W0-H: are these words on the page? Markdown, case, punctuation and spacing aside; a quote cut with "..." needs every piece it kept.
  // A quote that cannot be found is not shown as a problem (REVIEW_EVIDENCE: the 3299 Critic called live links "not confirmed")
  const normQ = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}%$&]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const onPage = (quote, md) => { const page = normQ(md); const parts = S(quote).split(/\.{3}|\u2026/).map(normQ).filter(x => x.length >= 8);
    return parts.length > 0 && parts.every(x => page.includes(x)); };
  // W0-H: one wording for a problem the second read found; the quoted words are what Finalize looks for to know whether it is still there
  const reviewText = (r) => 'A second read of the page found a problem at "' + plain(S(r.location)).replace(/"/g, "'").slice(0, 140) + '": ' + plain(S(r.issue)).replace(/[.;:]+$/, '').slice(0, 260);
  // add the second read's gating problems to a classification (enforce mode only; in shadow mode they are reported, never counted)
  const reviewed = (cls, rr) => { const R = rr || {}; if (R.mode !== 'enforce' || !Array.isArray(R.gates) || !R.gates.length) return cls;
    const have = new Set(cls.blocking.filter(b => b.code === 'review').map(b => b.location));
    const add = R.gates.filter(g => g && g.location && !have.has(S(g.location))).map(g => ({ code: 'review', text: W(reviewText(g)), tier: 'soft', location: S(g.location), kind: S(g.kind) }));
    const blocking = cls.blocking.concat(add);
    return { ...cls, blocking, soft: blocking.filter(b => b.tier === 'soft').length }; };
  const classify = (qa0, md, ctx) => {
    const qa = qa0 || {}; const c = ctx || {}; const blocking = [], advisory = [];
    const B = (code, text, tier, extra) => blocking.push({ code, text: W(text), tier, ...(extra || {}) });
    const A = (code, text, w) => advisory.push({ code, text: W(text), w: Number(w) || 0 });
    // hard: the system cannot make these go away by itself
    if (qa.cut_off) B('cut_off', 'The page stops before its end, so it cannot be published as it is', 'hard', { weight: 10 });
    const orig = qa.originality || {};
    if (orig.passed === false) { const f = (orig.failing || orig.worst || {}); B('copied', 'Part of the text repeats another page word for word' + (f.source ? ' (' + f.source + (f.overlap_pct != null ? ', ' + f.overlap_pct + '%' : '') + ')' : ''), 'hard'); }
    const dup = Array.isArray(orig.duplicate_targets) ? orig.duplicate_targets : [];
    if (dup.length) B('duplicate_page', 'This website already has a page for the same search: ' + dup.map(x => x.url).slice(0, 2).join(', ') + '. Publish this text as an update of that page, or tell us how the new page differs', 'hard', { urls: dup.map(x => x.url) });
    const brandWarn = (qa.warnings || []).find(w => /^Brand name:/.test(S(w)));
    const bh = brandWarn ? (c.brand ? brandHits(md, c) : 1) : 0;
    if (bh) B('brand', 'The business name is written in a form you do not use (' + bh + ' place' + (bh === 1 ? '' : 's') + ')', 'hard');
    // W0-A (PLAN Fix 1.5, R4 G22): a meta description PF.meta could not repair is a publish error (it reaches the HTML head, Open Graph and
    // the schema), no longer a 0.25 advisory; the check reads it from Content QA's field rule (content_qa.meta_error)
    if (S(qa.meta_error).trim()) B('meta', S(qa.meta_error).trim() + ', and it could not be written from the brief or the Quick answer', 'hard');
    if (Number(qa.profile_placeholders) > 0) B('author_profile', 'The author box needs the author\'s details (name, job title, short bio): add them once to the business profile', 'hard');
    // soft: facts and trust. The system rewrites or removes each one itself before delivery (PF.neutralize)
    const promises = (qa.business_promises || []).concat(qa.business_claims || []).filter(p => p && p.sentence);
    for (const p of promises) B('claim', 'A statement about the business that nothing on file supports: "' + plain(p.sentence).slice(0, 160) + '"', 'soft', { sentence: p.sentence, kind: p.kind || '', rewrite: p.rewrite || null });
    for (const f of (qa.unverified_figures || [])) B('figure', 'A figure its cited source does not state: "' + S(f.figure) + '"' + ((f.sources || []).length ? ' (' + f.sources.join(', ') + ')' : ''), 'soft', { figure: S(f.figure) });
    for (const a of (qa.flagged_amounts || [])) B('figure', 'An amount no source on file states: "' + S(a.amount) + '"', 'soft', { figure: S(a.amount) });
    for (const s of (qa.unverified_statistics || [])) B('statistic', 'A number with no source: "' + S(s) + '"', 'soft', { stat: S(s) });
    const marks = new Set(promises.map(p => '[Confirm: ' + p.sentence + ']').concat((qa.unverified_figures || []).map(f => '[Confirm: ' + f.figure + ']')).concat((qa.flagged_amounts || []).map(a => '[Confirm: ' + a.amount + ']')));
    for (const b of bracketsIn(md)) { if (marks.has(b.token)) continue; B('bracket', 'A bracket left in the text: ' + b.token.slice(0, 120), 'soft', { token: b.token }); }
    for (const x of ((qa.link_check || {}).dead || [])) B('dead_link', 'A link to a missing page: ' + S(x.url), 'soft', { url: S(x.url) });
    for (const x of (qa.excluded_sections || [])) B('off_topic', 'A section about a topic the verdict said to leave out: "' + S(x.heading).replace(/^#+\s*/, '') + '"', 'soft', { heading: S(x.heading) });
    const guar = (qa.warnings || []).find(w => /^Contains a guarantee claim/.test(S(w)));
    if (guar) { const m = S(guar).match(/"([^"]{5,200})"/); B('guarantee', 'A guarantee nothing on file states' + (m ? ': "' + m[1] + '"' : ''), 'soft', { quote: m ? m[1] : '' }); }
    for (const t of testimonials(md, c.own_text)) B('testimonial', 'A testimonial nothing on file carries: "' + t.quote.slice(0, 100) + '" (' + t.who + ')', 'soft', { text: t.text });
    // W0-H (Fix 3b): a market, adoption, cost or compliance figure whose only source has no independent authority (see weakFigures)
    // W05-C: a sourced figure (its own linked source states it and the sentence names that source) is advice, never a blocker
    for (const w of weakFigures(md, qa, c)) { if (w.sourced) { A('weak_figure_named', 'A figure whose only source is the organisation that published it (' + w.hosts.join(', ') + '); it is kept as written: "' + plain(w.sentence).slice(0, 160) + '". A stronger source that states it would make it firmer', 0.1); continue; }
      B('weak_figure', 'A figure whose only source has no independent authority (' + w.hosts.join(', ') + '): "' + plain(w.sentence).slice(0, 160) + '"', 'soft', { sentence: w.sentence, figure: w.figure, hosts: w.hosts, verified: !!w.verified }); }
    // W0-H (Fix 3b): what the blind second read of the delivered page found that a reader would be misled by (PF.reviewed adds them; a
    // check that carries its own record of that read, as a later classify may, counts them the same way)
    for (const r of (((qa.critic_reread || {}).mode === 'enforce' && (qa.critic_reread || {}).gates) || [])) B('review', reviewText(r), 'soft', { location: S(r.location), kind: S(r.kind) });
    // advisory: never blocks, weighted by how far the page is from its target
    const words0 = Number(qa.main_content_words) || 0; const LB = qa.length_band || null;
    const low = LB ? Number(LB.low) : Math.round((Number(qa.target_word_count) || 0) * 0.8), high = LB ? Number(LB.high) : Math.round((Number(qa.target_word_count) || 0) * 1.25);
    if (low && words0 < low) A('length', 'The main content is ' + words0 + ' words, under the ' + low + '-' + high + ' band of the pages that rank', 4 * (low - words0) / low);
    if (high && words0 > high) A('length', 'The main content is ' + words0 + ' words, over the ' + low + '-' + high + ' band of the pages that rank', 4 * (words0 - high) / high);
    const cp = Number(qa.coverage_pct), ct = Number(qa.coverage_target_pct);
    if (ct && cp < ct) A('coverage', 'Topic coverage ' + cp + '% against ' + ct + '% for the best page that ranks (terms missing: ' + (qa.missing_terms || []).slice(0, 6).join(', ') + ')', (ct - cp) / 10);
    if ((qa.missing_subtopics || []).length) A('subtopics', 'Subtopics the best page covers and this one does not: ' + qa.missing_subtopics.slice(0, 4).join('; '), Math.min(1, 0.25 * qa.missing_subtopics.length));
    const warn = (re) => (qa.warnings || []).filter(w => re.test(S(w)));
    const ADV = [[/^Primary keyword missing from the meta title/, 'kw_title', 0.5], [/^Primary keyword missing from H1/, 'kw_h1', 0.5], [/^Primary keyword not in the first 100 words/, 'kw_first100', 0.5],
      [/^Primary keyword used only/, 'kw_count', 0.25], [/^Keyword density is high/, 'kw_density', 0.5], [/^Meta title/, 'meta_title', 0.25], [/^Meta description/, 'meta_desc', 0.25], [/^Slug should/, 'slug', 0.25],
      [/^H1 missing/, 'h1', 1], [/^Only \d+ H2 sections/, 'h2', 0.5], [/^Quick answer block missing/, 'quick_answer', 1], [/^Quick answer is/, 'quick_answer_len', 0.25], [/^Answer first|^AI target: move the Quick answer/, 'answer_first', 0.5],
      [/^Only \d+ question\(s\) answered|^Phrase at least 2|^AI target: phrase/, 'question_headings', 0.5], [/^Snippet questions/, 'snippets', 0.5], [/^AI target: give these searches/, 'fanout', 0.5],
      [/^Comparison table missing/, 'table', 0.25], [/^The call to action should be the last/, 'cta_last', 0.5], [/^Sections far below/, 'thin', 0.25], [/^No internal links/, 'internal_links', 0.5],
      [/^Filler/, 'filler', 0.25], [/^Hard to read|sentences longer than|^Passive voice/, 'style', 0.1], [/^Too generic/, 'generic', 0.25], [/^External links to sources not in the evidence plan/, 'sources', 0.25],
      [/^A source with no independent authority/, 'weak_source', 0.25], [/^Topic coverage is thin/, 'coverage', 1], [/^Originality: \d+% of this draft also appears/, 'overlap_note', 0.1], [/^Too many placeholders/, 'placeholders', 0]];
    for (const [re, code, w] of ADV) for (const x of warn(re)) A(code, S(x).replace(/\s*\(the band of[^)]*\)\)?/, ''), w);
    const hard = blocking.filter(b => b.tier === 'hard').reduce((s, b) => s + (b.weight || 1), 0);
    const soft = blocking.filter(b => b.tier === 'soft').length;
    const adv = +advisory.reduce((s, a) => s + a.w, 0).toFixed(3);
    return { blocking, advisory, hard, soft, adv, words: words0, band: low ? { low, high } : null };
  };
  const score = (cls) => ({ hard: cls.hard, soft: cls.soft, adv: cls.adv });
  // what an edit may never lose, whatever else it fixes (R1 rec. 1): the call to action, the Quick answer, the sections, the length floor
  const protect = (md, qa, ctx) => { const sp = split(md); const last = sp.parts[sp.parts.length - 1]; const c = ctx || {};
    const d = S(c.domain).replace(/^www\./, '');
    const ctaLink = !!last && last.id !== 's0' && (/\]\((\/|https?:\/\/)/.test(last.text) && (!d || [...last.text.matchAll(/\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g)].some(m => m[1].startsWith('/') || hostOf(m[1]) === d || hostOf(m[1]).endsWith('.' + d))));
    // W05-C (BEFORE_AFTER K6): the figures a linked source states (Content QA's verified_figures, in a sentence that cites a page) and
    // every figure on the page; an edit that drops a sourced figure is worse, whatever else it fixed ("rose sharply" for "39% to 66%")
    const ver = new Set((Array.isArray((qa || {}).verified_figures) ? qa.verified_figures : []).map(x => figKey(x && x.figure)).filter(Boolean));
    const figs = !ver.size ? [] : [...new Set(S(md).slice(sp.head.length).split('\n').flatMap(l => sentencesOf(l)).filter(x => /\]\(https?:\/\//.test(x)).flatMap(x => figKeysIn(plain(x))).filter(k => ver.has(k)))].slice(0, 60);
    return { cta: ctaLink, quick_answer: /^\**\s*Quick answer:?\**/im.test(md), h2: sp.parts.length - 1, words: Number((qa || {}).main_content_words) || words(md),
      figs, nums: [...new Set(figKeysIn(plain(S(md).slice(sp.head.length))))].slice(0, 400) }; };
  const lostProtected = (a, b, band) => { const out = [];
    if (b.cta && !a.cta) out.push('the call to action'); if (b.quick_answer && !a.quick_answer) out.push('the Quick answer');
    if (b.h2 >= 3 && b.h2 - a.h2 >= 2) out.push((b.h2 - a.h2) + ' sections');
    if (band && band.low && b.words >= band.low * 0.9 && a.words < band.low * 0.75) out.push('a third of its length');
    if (Array.isArray(b.figs) && b.figs.length && Array.isArray(a.nums)) { const gone = b.figs.filter(k => !a.nums.includes(k)); if (gone.length) out.push('the sourced figure' + (gone.length === 1 ? ' ' : 's ') + gone.slice(0, 3).join(', ')); }   // W05-C
    return out; };
  // ONE comparison: is candidate `a` strictly better than `b`? A lost protected property makes it worse, whatever else it fixed
  const better = (a, b) => { if (!b) return { better: true, why: 'the first draft' };
    const lost = lostProtected(a.protect || {}, b.protect || {}, (a.cls || {}).band || (b.cls || {}).band);
    if (lost.length) return { better: false, why: 'it lost ' + lost.join(', ') };
    const x = a.score, y = b.score;
    if (x.hard !== y.hard) return { better: x.hard < y.hard, why: x.hard < y.hard ? 'fewer problems the system cannot fix itself (' + x.hard + ' against ' + y.hard + ')' : 'more problems the system cannot fix itself (' + x.hard + ' against ' + y.hard + ')' };
    if (x.soft !== y.soft) return { better: x.soft < y.soft, why: (x.soft < y.soft ? 'fewer' : 'more') + ' unsupported statements, figures, brackets or links (' + x.soft + ' against ' + y.soft + ')' };
    if (x.adv < y.adv - 0.05) return { better: true, why: 'closer to the targets of the pages that rank (' + x.adv + ' against ' + y.adv + ')' };
    return { better: false, why: x.adv > y.adv + 0.05 ? 'further from the targets of the pages that rank (' + x.adv + ' against ' + y.adv + ')' : 'no better than the draft it was given' }; };

  // ---------- 7. the section-targeted edit job ----------
  const plan = (md, cls, qa0, ctx) => {
    const qa = qa0 || {}; const c = ctx || {}; const sp = split(md); const jobs = new Map();
    const add = (part, problem, weight) => { if (!part) return; const j = jobs.get(part.id) || { id: part.id, heading: part.heading, text: part.text, problems: [], weight: 0 }; const p = W(problem); if (!j.problems.includes(p)) { j.problems.push(p); j.weight += weight || 1; } jobs.set(part.id, j); };
    const at = (needle) => { const i = S(md).indexOf(S(needle)); return i < 0 ? null : partAt(sp, i); };
    const related = (text) => { const ranked = sp.parts.slice(1).filter(p => !isCta(sp, p)).map(p => ({ p, s: overlap(text, p.heading + ' ' + p.text.slice(0, 1500)) })).sort((a, b) => b.s - a.s); return ranked.length ? ranked[0].p : sp.parts[0]; };
    for (const b of cls.blocking) {
      if (b.code === 'claim') { const rw = b.rewrite || {}; add(at(b.sentence), 'Rewrite as advice to the reader or as a neutral fact about the topic, or delete it (nothing on file says the business does this; never "we do" or "our process"): "' + plain(b.sentence).slice(0, 220) + '"'
        + (rw.action === 'reword' && rw.neutral ? '. A neutral wording that works: "' + plain(rw.neutral).slice(0, 220) + '"' : rw.action === 'delete' ? '. It adds nothing the reader can use: delete it' : ''), 3); }
      else if (b.code === 'figure') add(at(b.figure), 'The figure "' + b.figure + '" is not in the source the sentence cites: quote the number one of the SOURCES YOU MAY CITE states, with that link, or rewrite the sentence without the number', 2);
      else if (b.code === 'statistic') add(at(b.stat), 'The number "' + b.stat + '" has no source: cite one of the SOURCES YOU MAY CITE that states it, or rewrite the sentence without it', 2);
      else if (b.code === 'guarantee' && b.quote) add(at(b.quote.slice(0, 40)), 'Remove the guarantee or reword it so it promises nothing: "' + b.quote + '"', 2);
      else if (b.code === 'testimonial') add(at(b.text), 'Remove this testimonial: nothing on file says a client said it', 3);
      // W0-H (Fix 3b): rewrite without the number (the reader keeps the point, not a figure nobody independent stands behind)
      else if (b.code === 'weak_figure') add(at(b.sentence), b.verified
        // W05-C: the linked page states this figure, so it is sourced: say who measured it, never make it vague
        ? 'The figure "' + b.figure + '" is stated by its linked source (' + (b.hosts || []).join(', ') + '), which has no independent authority: keep the number exactly as written and name in the sentence who measured or published it (for example "' + (hostLabel((b.hosts || [])[0]).replace(/^./, x => x.toUpperCase()) || 'The publisher') + ' reports that ..."), or cite one of the SOURCES YOU MAY CITE that is an official body, a research house or major press and states it. Never replace the number with a vague word such as "sharply", "significantly" or "many"'
        : 'The figure "' + b.figure + '" rests only on ' + (b.hosts || []).join(', ') + ', a source with no independent authority: rewrite the sentence without the number (keep the point it makes, and never put a vague word such as "sharply", "significantly" or "many" where the number was), or cite one of the SOURCES YOU MAY CITE that is an official body, a research house or major press and states it', 2);
      else if (b.code === 'copied') { const ps = ((qa.originality || {}).failing || {}).passages || []; for (const p of ps.slice(0, 3)) add(at(S(p.text).slice(0, 60)) || related(p.text), 'This passage repeats another page word for word; rewrite it in our own words, order and examples: "' + S(p.text).slice(0, 160) + '"', 3); }
    }
    // FU-SV (merge 2026-10-30): a sentence Content QA could not put in the business's own voice by itself (content_qa.voice.flags, whole
    // sentences such as "the company says it ...") goes to the editor as a problem of its section; advice to the editor, never a blocker
    for (const v of ((qa.voice || {}).flags || []).slice(0, 6)) { const sv = S(v).trim(); if (sv.length < 12) continue;
      add(at(sv), 'Say this in our own voice: keep the fact and drop the outside frame ("its website states", "the website says", "according to its site", "the company says"); write it with "we" / "our team" or as a plain statement with the business as the subject: "' + plain(sv).slice(0, 220) + '"', 1); }
    const advCodes = new Set(cls.advisory.map(a => a.code));
    // length: cut from the sections furthest over their outline target, or expand the thinnest, with a number for each
    const LB = cls.band; const w0 = cls.words; const outline = c.outline || [];
    const target = (h) => { const o = outline.find(x => x && plain(x.h2).toLowerCase() === S(h).toLowerCase()); return o ? Number(o.target_words) || 0 : 0; };
    const body = sp.parts.slice(1).filter(p => !isCta(sp, p)).map(p => ({ p, words: words(plain(p.text)), target: target(p.heading) }));
    let length_note = '';
    if (LB && w0 > LB.high) { let need = w0 - LB.high; length_note = 'The page is ' + w0 + ' words, ' + need + ' over the ' + LB.low + '-' + LB.high + ' band: the sections below carry the cut.';
      for (const x of body.sort((a, b) => ((b.words - b.target) - (a.words - a.target)) || (b.words - a.words))) { if (need <= 0) break; const cut = Math.min(need, Math.max(40, Math.round(x.words * 0.35)));
        add(x.p, 'Cut about ' + cut + ' words (this section has ' + x.words + '): take out repetition and secondary detail; keep every fact with its source, every link and every heading', 1); need -= cut; } }
    else if (LB && w0 < LB.low) { let need = LB.low - w0; length_note = 'The page is ' + w0 + ' words, ' + need + ' under the ' + LB.low + '-' + LB.high + ' band: the sections below carry the extra depth.';
      for (const x of body.sort((a, b) => (a.words - (a.target || a.words)) - (b.words - (b.target || b.words)) || a.words - b.words)) { if (need <= 0) break; const more = Math.min(need, Math.max(60, Math.round((x.target || x.words) * 0.5)));
        add(x.p, 'Add about ' + more + ' words of specific, useful detail (an example, a step, a decision rule, a trade-off); never filler and never a fact that is not on file or in the sources', 1); need -= more; } }
    const over = !!(LB && w0 > LB.high);
    if (advCodes.has('coverage')) { const by = new Map(); for (const t of (qa.missing_terms || []).slice(0, 10)) { const p = related(t); const l = by.get(p.id) || { p, terms: [] }; l.terms.push(t); by.set(p.id, l); }
      for (const l of by.values()) add(l.p, (over ? 'Work these terms into sentences this section already has (add no new sentence, the page is over its length): ' : 'Work these terms in where they belong, with substance around them: ') + l.terms.slice(0, 4).join(', '), 0.5); }
    // W05-C (2026-10-30, BEFORE_AFTER K6): a competitor's subtopic never becomes padding. K6's round 2 turned two of a competitor's
    // headings ("Why Most Customer Support is Ripe for AI Disruption", "The Strategic Importance of Automating Tier-1 and Tier-2 Support")
    // into new H3s that restated the section above them, while the same job asked for 130 words to be cut. Now: nothing is added while the
    // page is over its length band; a heading that only says why the topic matters is not a subtopic; one the page's headings already
    // cover is not missing; and a subtopic gets a paragraph inside the section, a heading only when it is a step or decision of its own.
    const RHETORIC = /^(?:why\b|the (?:strategic |growing |real )?(?:importance|role|rise|future|power|value|benefits?) of\b|(?:importance|benefits?|advantages?) of\b|introduction\b|conclusion\b|overview\b|summary\b|final thoughts\b|key takeaways\b|understanding\b|what (?:is|are) the (?:benefits|advantages)\b)|\b(?:ripe for|breakthrough|game[- ]changer|revolution\w*|transform\w* (?:the|your)|disrupt\w*|matters?\b|is changing|are changing)/i;
    const heads = sp.parts.flatMap(p => [p.heading].concat((p.text.match(/^#{3,4}\s+.+$/gm) || []).map(h => h.replace(/^#+\s+/, '')))).filter(Boolean);
    const covered = (t) => heads.some(h => overlap(t, h) >= 0.5 || overlap(h, t) >= 0.6);
    if (!over && advCodes.has('subtopics') && Number(qa.coverage_pct) < Number(qa.coverage_target_pct || 0)) for (const s of (qa.missing_subtopics || []).filter(x => !RHETORIC.test(plain(x).trim()) && !covered(x)).slice(0, 3))
      add(related(s), 'Cover this subtopic in a paragraph inside this section, in our own words, only with what it adds that the page does not already say (a heading of its own only when it is a step or a decision this section does not have): "' + s + '"', 0.5);
    const unanswered = (() => { const w = (qa.warnings || []).find(x => /^Snippet questions/.test(S(x))); return w ? S(w).replace(/^[^:]+:\s*/, '').split(' | ').map(x => x.trim()).filter(Boolean) : []; })();
    for (const q of unanswered.slice(0, 3)) add(related(q), 'Add an H3 "' + q + '" with a 40-60 word direct answer right under it', 0.75);
    const s0 = sp.parts[0];
    if (advCodes.has('quick_answer')) add(s0, 'Add a line starting with **Quick answer:** right after the introduction: 40-70 words that answer the page\'s question directly, no brackets', 1);
    if (advCodes.has('quick_answer_len')) add(s0, 'Bring the **Quick answer:** line to 40-70 words', 0.5);
    if (advCodes.has('kw_first100')) add(s0, 'Use the exact phrase "' + S(c.keyword) + '" once in the first two sentences of the introduction, naturally', 0.5);
    if (advCodes.has('question_headings')) { const flat = body.filter(x => !QUESTION_KW.test(x.p.heading)).slice(0, 2); for (const x of flat) add(x.p, 'Phrase this section\'s heading as the question a reader asks, and answer it in the 40-60 words right under it', 0.5); }
    if (advCodes.has('table') && body.length) { const p = related('compare comparison options versus choose which fits'); add(p, 'Add a small Markdown comparison table of what the reader can check for themselves (what each option covers, who it suits); no price or timeline column unless the facts state them', 0.25); }
    const filler = (qa.banned_phrases || []).map(b => b.phrase); for (const f of filler.slice(0, 6)) { const p = at(f); if (p) add(p, 'Rewrite the sentence with "' + f + '" in plain, specific words', 0.25); }
    // the Critic's review of the first draft: its high and medium problems for the sections already being edited, and its high ones anywhere
    const crit = (c.critique && Array.isArray(c.critique.problems)) ? c.critique.problems : [];
    const sourcedKeys = new Set(protect(md, qa, c).figs || []);
    for (const p of crit) { if (!p || !/high|medium/i.test(S(p.severity))) continue; const fixText = S(p.fix);
      if (/\b(placeholder|bracket|\[to confirm|confirm at|flagged for confirmation)\b/i.test(fixText + ' ' + S(p.issue))) continue;   // the contract: no brackets
      // W05-C: advice to drop a figure the run found in its own linked source is not passed on (a sourced figure is never made vague)
      if (sourcedKeys.size && /\b(?:drop|remove|delete|cut|omit|without)\b[^.]{0,40}\b(?:figure|number|statistic|stat|percentage)/i.test(fixText) && figKeysIn(plain(S(p.location) + ' ' + fixText)).some(k => sourcedKeys.has(k))) continue;
      const part = p.location ? at(plain(S(p.location)).slice(0, 40)) || (overlap(p.location, md) > 0.6 ? related(p.location) : null) : null;
      if (!part || (!jobs.has(part.id) && !/high/i.test(S(p.severity)))) continue;
      add(part, 'Reviewer: ' + S(p.issue).replace(/[.;:]+$/, '') + (fixText ? '. Suggested fix: ' + fixText : '') + ' (apply it as advice to the reader; add no claim about the business and no number that is not in the sources)', /high/i.test(S(p.severity)) ? 0.75 : 0.25); }
    const sections = [...jobs.values()].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
    const MAXS = 7; const chosen = sections.length > MAXS ? sections.slice().sort((a, b) => b.weight - a.weight).slice(0, MAXS).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))) : sections;
    return { sections: chosen.map(j => ({ id: j.id, heading: j.heading, text: j.text, problems: j.problems.slice(0, 12), cta: isCta(sp, sp.parts.find(p => p.id === j.id)) })),
      left_out: sections.length - chosen.length, length_note, page_words: w0, band: LB };
  };

  // ---------- 8. the editor's answer, merged back ----------
  const parseSections = (answer) => { const t = S(answer).replace(/\r/g, ''); const out = new Map(); const open = [];
    const re = /^=== SECTION (s\d+) ===[ \t]*\n([\s\S]*?)\n=== END \1 ===[ \t]*$/gm; let m;
    while ((m = re.exec(t))) out.set(m[1], m[2].replace(/^\n+|\s+$/g, ''));
    for (const s of t.matchAll(/^=== SECTION (s\d+) ===/gm)) if (!out.has(s[1])) open.push(s[1]);
    return { blocks: out, unfinished: open, marked: /^=== SECTION s\d+ ===/m.test(t) }; };
  // the external links the edit may use: the ones already in the page, the evidence plan, the run's facts, the verified sources
  const merge = (base, job, answer, opts) => {
    const o = opts || {}; const sp = split(base); const P = parseSections(answer); const log = { replaced: [], kept: [], unlinked: [], unfinished: P.unfinished.slice() };
    const allowed = new Set([...(o.allowed_urls || []), ...[...S(base).matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1])].map(keyOf));
    const d = S(o.domain).replace(/^www\./, '');
    for (const j of (job.sections || [])) {
      const part = sp.parts.find(p => p.id === j.id); if (!part) continue;
      let t = P.blocks.has(j.id) ? P.blocks.get(j.id) : null;
      if (t == null || !t.trim() || P.unfinished.includes(j.id)) { log.kept.push(j.id); continue; }
      if (j.id === 's0') { if (!/^# /m.test(t)) { const h1 = (part.text.match(/^# .*$/m) || [''])[0]; if (h1) t = h1 + '\n\n' + t; } }
      else if (!/^## /.test(t)) t = part.text.split('\n')[0] + '\n\n' + t;
      // guessed URLs never survive: an external link that is neither in the page already nor in the sources of this run is unlinked
      t = t.replace(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m0, a, u) => { const h = hostOf(u); if ((d && (h === d || h.endsWith('.' + d))) || allowed.has(keyOf(u))) return m0; log.unlinked.push(u); return a; });
      const trail = (part.text.match(/\s*$/) || [''])[0] || '\n\n';
      part.text = t.replace(/\s+$/, '') + (trail.includes('\n\n') ? trail : '\n\n');
      log.replaced.push(j.id);
    }
    // the page's last line keeps its ending whitespace exactly as before
    const out = join(sp);
    return { md: /\n$/.test(S(base)) || !out.endsWith('\n\n') ? out : out.replace(/\n+$/, ''), log, marked: P.marked };
  };

  // ---------- 9. the system's own neutral rewrite ----------
  const unlinkDead = (md, dead, suggestions) => { let out = S(md); const done = [];
    for (const x of (dead || [])) { const u = S(x.url); if (!u) continue; const sug = S((suggestions || {})[u] || x.suggestion || '');
      const re = new RegExp('\\[([^\\[\\]]+)\\]\\(' + escRe(u) + '\\)', 'g'); let n = 0;
      out = out.replace(re, (m0, a) => { n++; return sug && /^https?:\/\//.test(sug) ? '[' + a + '](' + sug + ')' : a; });
      if (n) done.push({ url: u, replaced_with: sug && /^https?:\/\//.test(sug) ? sug : '', count: n }); }
    return { md: out, done }; };
  const deleteSection = (md, heading) => { const sp = split(md); const h = plain(S(heading).replace(/^#+\s*/, '')).toLowerCase();
    let hit = false; sp.parts = sp.parts.filter(p => { if (p.id !== 's0' && p.heading.toLowerCase() === h) { hit = true; return false; } return true; });
    if (!hit) { const re = new RegExp('^(#{3,4})\\s+' + escRe(S(heading).replace(/^#+\s*/, '').trim()) + '\\s*$', 'm'); const src = S(md); const m = src.match(re);
      if (m) { const lvl = m[1].length; const a = m.index; const rest = src.slice(a + m[0].length); const nx = rest.search(new RegExp('^#{1,' + lvl + '}\\s', 'm')); const b = nx < 0 ? src.length : a + m[0].length + nx; return { md: src.slice(0, a) + src.slice(b), done: true }; }
      return { md, done: false }; }
    return { md: join(sp), done: true }; };
  const neutralize = (md0, cls, ctx) => {
    const c = ctx || {}; let md = S(md0); const removed = [];
    const take = (b, r) => { if (r.done) removed.push({ code: b.code, sentence: b.sentence || b.figure || b.stat || b.token || b.heading || b.url || b.quote || '', kind: b.kind || '', how: r.how || 'removed', text: r.text || '', rewrite: b.rewrite || null, ...(r.anchor ? { anchor: r.anchor } : {}) }); return r.md; };
    for (const b of cls.blocking.filter(x => x.tier === 'soft')) {
      if (b.code === 'claim') md = take(b, neutralSentence(md, b.sentence, c.domain, b.rewrite));
      else if (b.code === 'figure') { const tok = '[Confirm: ' + b.figure + ']'; const i = md.indexOf(tok) >= 0 ? md.indexOf(tok) : md.indexOf(b.figure); if (i >= 0) md = take(b, { md: removeAt(md, i, md.indexOf(tok) >= 0 ? tok.length : b.figure.length), done: true }); }
      else if (b.code === 'statistic') { const i = md.indexOf(b.stat); if (i >= 0) md = take(b, { md: removeAt(md, i, b.stat.length), done: true }); }
      else if (b.code === 'bracket') { const i = md.indexOf(b.token); if (i >= 0) md = take(b, { md: removeAt(md, i, b.token.length), done: true }); }
      else if (b.code === 'dead_link') { const r = unlinkDead(md, [{ url: b.url }], {}); md = take(b, { md: r.md, done: r.done.length > 0, how: 'unlinked' }); }
      else if (b.code === 'off_topic') md = take(b, deleteSection(md, b.heading));
      else if (b.code === 'guarantee' && b.quote) { const i = md.indexOf(b.quote.slice(0, 60)); if (i >= 0) md = take(b, { md: removeAt(md, i, Math.min(60, b.quote.length)), done: true }); }
      else if (b.code === 'testimonial') { const r = removeText(md, b.text); md = take(b, r); }
      else if (b.code === 'weak_figure') { const i = md.indexOf(b.sentence); if (i < 0) continue;
        // W05-C: a figure its linked source states is kept: the link is named after its source ("[source](https://www.x.com/..)" ->
        // "[x.com](...)"), so the sentence says who published the number; only a figure no source we read states goes with its sentence
        if (b.verified) { const hs = new Set((b.hosts || []).map(h => S(h).replace(/^www\./, '')));
          const named = b.sentence.replace(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m0, a, u) => hs.has(hostOf(u)) && !namesHost(a, hostOf(u)) ? '[' + hostOf(u) + '](' + u + ')' : m0);
          if (named !== b.sentence) { md = take(b, { md: md.slice(0, i) + named + md.slice(i + b.sentence.length), done: true, how: 'attributed', text: named }); continue; } }
        md = take(b, { md: removeAt(md, i, b.sentence.length), done: true }); }   // W0-H: the sentence goes with its number
    }
    // [Price] and other masks the quality check left go with their sentence too
    for (let g = 0; g < 40; g++) { const bs = bracketsIn(md); if (!bs.length) break; const b = bs[0]; md = removeAt(md, b.at, b.token.length); removed.push({ code: 'bracket', sentence: b.token, how: 'removed' }); }
    return { md: tidy(md), removed };
  };

  // ---------- 10. the client questions and the delivered status ----------
  // Owner decision (2026-10-28): EVERY statement about the business that nothing on file supports becomes a client question, with the
  // original specific sentence, the neutral wording the page carries until the client answers, and the choices yes (keep the specific
  // sentence) / edit (the client's own wording) / remove. Every other question that would genuinely strengthen the page (proof, numbers,
  // experience, credentials) is asked too. No limit: ranked by impact. Nothing blocks: an unanswered question leaves the page as it is.
  // Each question names the business-fact key its answer fills, so the answer is stored once and a later page never asks it again
  // (`stored` = the keys already on file), and is prefilled from the client's own pages or stored facts when they say something close.
  const CATEGORY = { proof: 'proof', experience: 'experience', credential: 'credential', deliverable: 'service', process: 'service', scope: 'service', terms: 'service',
    timeline: 'timeline', pricing: 'pricing', price: 'pricing', guarantee: 'guarantee', detail: 'detail', other: 'detail' };
  const IMPACT = { proof: 0.9, experience: 0.85, credential: 0.8, guarantee: 0.75, service: 0.7, pricing: 0.55, timeline: 0.55, detail: 0.45 };
  const slug = (t, n) => toks(plain(t)).filter(w => !/^\d+$/.test(w)).slice(0, n || 6).join('_').replace(/[^\p{L}\p{N}_&]+/gu, '').slice(0, 60) || 'item';
  const factKey = (category, text) => category + '.' + slug(text);
  // the category of a question from the brief, from its words (the brief may also name it, W0-E)
  const briefCategory = (t) => /result|case|client|outcome|project/i.test(t) ? 'proof' : /partner|certif|accredit|award|iso\b/i.test(t) ? 'credential' : /price|fee|cost/i.test(t) ? 'pricing'
    : /how long|week|month|timeline/i.test(t) ? 'timeline' : /experience|example|seen|lesson/i.test(t) ? 'experience' : 'detail';
  // W0-E (2026-10-29, page-quality PLAN Fix 5.4, R4 D6): what may be offered as an answer. 3299 offered "Deep UAE & GCC knowledge" (a
  // homepage slogan) as proof of UAE projects, "Does Microsoft Dynamics have ERP?" (a question) as the partner designations and "Dynamics 365
  // 8 min read" (blog listing chrome) twice; "Accept all" then stored them as business facts for every later page. A suggestion now has to
  // be a sentence (6 words or more, with a verb, not a question), not navigation or reading-time chrome, not from a listing page, not a
  // slogan (praise words, or the business name with no verb), and it has to answer the question's TYPE: proof names a project, client or
  // sector together with an outcome, or carries a number or a link; a credential names one (partner, certified, accredited, award, ISO...).
  // The business facts and the profile come first: the website is read only when they have nothing usable.
  const LISTING_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:insights|blog|blogs|news|articles|resources|posts|updates|knowledge|learn|library|stories|press|media|case-studies)\/?$|\/(?:category|categories|tag|tags|page|author|topics?)\/[^/]+\/?$/i;   // = SM.isListing (_site_model.js)
  const isListingUrl = (u) => /^https?:\/\//i.test(S(u)) && LISTING_PATH.test(S(u).replace(/^https?:\/\/[^\/]*/i, '').replace(/[?#].*$/, '') || '/');
  const CHROME = /\b\d+\s*(?:min(?:ute)?s?)\.?\s*read\b|\bread (?:more|time)\b|\blearn more\b|\bshare (?:this|on)\b|\bposted (?:in|on|by)\b|all rights reserved|©|\bcopyright\b|\bsubscribe\b|\bnewsletter\b|\bcookies?\b|privacy policy|terms of (?:use|service)|\b(?:previous|next) (?:post|article)\b|^(?:tags?|categor(?:y|ies)|home|menu|search)\b|\s[|•·»>]\s.*\s[|•·»>]\s/i;
  const VERB = /\b(?:is|are|was|were|be|been|am|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must)\b|\b(?:we|i|they|you|it|he|she)\s+(?!and\b|or\b)\p{L}{2,}|\b\p{L}{3,}ed\b|\b(?:deliver|implement|help|serve|build|built|provide|support|migrate|run|ran|work|hold|held|offer|complete|reduce|cut|save|increase|achieve|win|won|certify|specialise|specialize|focus|design|develop|manage|use|cover|include|launch|grow|grew|make|made|take|took|bring|brought|lead|led|know|knew|become|became|get|got|give|gave|connect|integrate|host|deploy|start|cost|charge|need|require|keep|kept|go|went|move|cover|train|operate|partner|serve|handle|plan|test|audit|replace|upgrade)(?:s|es)?\b/iu;
  const SLOGAN = /\b(?:trusted|leading|premier|world[- ]class|best[- ]in[- ]class|award[- ]winning|cutting[- ]edge|innovative|one[- ]stop|seamless|unrivall?ed|unmatched|second to none|your (?:partner|trusted)|deep (?:\p{L}+ ){0,3}(?:knowledge|expertise)|proven expertise)\b/iu;
  const CREDENTIAL = /\b(?:partner(?:ship)?|certif\w*|accredit\w*|award(?:ed|s)?|iso\s?\d+|licen[cs]\w*|member(?:ship)?|badge|designation|registered|approved|chartered|qualified|specialization|specialisation|gold|silver)\b/i;
  const PROJECT = /\b(?:project|client|customer|implementation|rollout|roll-out|migration|deployment|go-live|case|engagement|bank|retail\w*|manufactur\w*|logistic\w*|health\w*|hospital\w*|government|public sector|trading|distribut\w*|financ\w*|insur\w*|construct\w*|hospitality|real estate|education|school|oil|energy|telecom\w*|pharma\w*|airline|aviation|ngo|charity)\b/i;
  const OUTCOME = /\b(?:reduc\w*|cut|sav\w*|increas\w*|improv\w*|faster|grew|growth|went live|go(?:es)? live|delivered|completed|achiev\w*|result\w*|outcome\w*|on time|on budget|within|down from|up from|from \S+ to)\b/i;
  const prefillProblem = (t, cat, names, source) => {
    const s0 = S(t).trim(); const n = s0.split(/\s+/).filter(Boolean).length;
    if (n < 6) return 'short'; if (/\?\s*$/.test(s0)) return 'question'; if (CHROME.test(s0)) return 'chrome'; if (isListingUrl(source)) return 'listing';
    if (!VERB.test(s0)) return 'no_verb';
    if (SLOGAN.test(s0) && !/\d/.test(s0)) return 'slogan';
    if (cat === 'proof' && !/\d|https?:\/\/|www\./i.test(s0) && !(PROJECT.test(s0) && OUTCOME.test(s0))) return 'not_proof';
    if (cat === 'credential' && !CREDENTIAL.test(s0)) return 'not_credential';
    return ''; };
  // the closest thing the client's own pages or stored facts already say: a sentence sharing at least half of the question's key words
  // `docs` are { source, text } (or plain strings); `opts` { category, names }: the category is read from the question when not given
  const prefillOf = (text, docs, opts) => { const o = opts || {}; const cat = S(o.category) || briefCategory(S(text)); const names = o.names || [];
    const list = (docs || []).map(d => typeof d === 'string' ? { source: '', text: d } : (d || {}));
    const first = (d) => /business facts|profile/i.test(S(d.source)) || !S(d.source);
    for (const group of [list.filter(first), list.filter(d => !first(d))]) { let best = null;
      for (const d of group) { const body = S(d.text); if (!body.trim() || isListingUrl(d.source)) continue;
        for (const sent of body.split(/(?<=[.!?])\s+|\n+/)) { const t = plain(sent); if (t.length < 15 || t.length > 320) continue; const sc = Math.max(overlap(text, t), overlap(t, text));
          if (sc >= 0.5 && (!best || sc > best.score) && !prefillProblem(t, cat, names, d.source)) best = { prefill: t, source: S(d.source), score: +sc.toFixed(2) }; } }
      if (best) return best; }
    return null; };
  // the sentence in the delivered page that took the specific one's place (the editor's neutral rewrite), else none (left out). W0-E: only
  // inside the statement's own section when it is known (3299 q5's "neutral" was an unrelated checklist item two sections away)
  const neutralIn = (finalMd, sentence, section) => { let best = null; const h = plain(S(section)).toLowerCase();
    const part = h ? split(finalMd).parts.find(p => S(p.heading).toLowerCase() === h) : null; if (h && !part) return '';
    for (const sent of S(part ? part.text : finalMd).split(/(?<=[.!?])\s+|\n+/)) { const t = plain(sent); if (t.length < 15 || /^#/.test(sent.trim())) continue; const sc = Math.min(overlap(sentence, t), overlap(t, sentence) + 0.2);
      if (sc >= 0.45 && (!best || sc > best.score)) best = { text: t, score: sc }; }
    return best ? best.text : ''; };
  // W0-E (PLAN Fix 5.1): each question has a home in the page, its SLOT, so an answer is worked into the sentence it changes instead of the
  // section that happens to share the most words: how an engagement starts, terms and consultations -> the call to action; a credential ->
  // the sentence that names the business (the partner or "why us" section); proof -> the decision section; pricing / timeline -> their
  // section; anything else -> the section the brief named (word overlap only breaks a tie inside the slot)
  const SLOT_CTA_Q = /\b(?:consult\w*|first (?:call|meeting|session|step)|discovery call|demo\b|free of charge|book(?:ing)?\b|get in touch|contact\w*|call to action|engagements? (?:start|begin)\w*|how (?:an |the |a )?(?:engagement|project|work) (?:start|begin)s?|terms|contract\w*|payment\w*|trial)\b/i;
  const slotOf = (q) => { const x = q || {}; const given = S(x.slot).toLowerCase(); if (/^(?:cta|credential|proof|pricing|timeline|named)$/.test(given)) return given;
    const cat = S(x.category || S(x.fact_key).split('.')[0]).toLowerCase(); const t = S(x.question);
    if (cat === 'terms' || SLOT_CTA_Q.test(t)) return 'cta'; if (cat === 'credential') return 'credential'; if (cat === 'proof' || cat === 'experience') return 'proof';
    if (cat === 'pricing' || cat === 'price') return 'pricing'; if (cat === 'timeline') return 'timeline'; return 'named'; };
  const SLOT_HEAD = { cta: /\b(?:talk to|contact|get started|next steps?|book|work with|get in touch|speak|consult\w*|let'?s talk|ready to)\b/i,
    credential: /\b(?:partner|why (?:choose|us|work)|about|who we are|our (?:team|experience|credentials|approach)|credential|certif\w*|accredit\w*)\b/i,
    proof: /\b(?:choos\w*|select\w*|partner|why|compare|which|results?|case|clients?|proof|experience|track record|our work)\b/i,
    pricing: /\b(?:cost|price|pricing|budget|fee|invest\w*|how much)\b/i, timeline: /\b(?:timeline|how long|time|duration|phase|steps?|process|implementation|plan\w*|roadmap)\b/i };
  const SLOT_SENT = { cta: /\b(?:consult\w*|contact|book|call|talk|get in touch|speak|demo|next step|reach|request|start)\b/i, credential: null, proof: null, pricing: /\b(?:cost|price|fee|budget|AED|USD|\$)\b/i, timeline: /\b(?:weeks?|months?|days?|phase|timeline|go-live)\b/i };
  // the section and the host sentence of a question's slot in a page (null when the page has no place for it)
  const slotIn = (md, q, names) => { const sp = split(md); const slot = slotOf(q); const hint = S(q.question) + ' ' + S(q.text); const nm = (names || []).filter(n => S(n).length >= 3);
    const body = sp.parts.filter(p => p.id !== 's0'); const last = sp.parts.length > 1 ? sp.parts[sp.parts.length - 1] : null;
    const named = (t) => nm.some(n => S(t).toLowerCase().includes(S(n).toLowerCase()));
    const byHeading = (h) => { const x = plain(S(h)).toLowerCase(); if (!x) return null; return sp.parts.find(p => S(p.heading).toLowerCase() === x) || (x.length > 8 ? sp.parts.find(p => S(p.heading).toLowerCase().includes(x) || x.includes(S(p.heading).toLowerCase())) : null) || null; };
    let part = null;
    if (slot === 'cta') part = (last && (SLOT_HEAD.cta.test(last.heading) || SLOT_SENT.cta.test(last.text) || /\]\(/.test(last.text)) ? last : null) || body.slice().reverse().find(p => SLOT_HEAD.cta.test(p.heading)) || null;
    else if (byHeading(q.section)) part = byHeading(q.section);   // the section the brief (or the question) named
    else if (slot !== 'named') { const cands = body.filter(p => p !== last || slot === 'credential').filter(p => SLOT_HEAD[slot].test(p.heading));
      const ranked = cands.map(p => ({ p, s: (named(p.text) ? 1 : 0) + overlap(hint, p.heading + ' ' + p.text.slice(0, 1500)) })).sort((a, b) => b.s - a.s);
      part = ranked.length ? ranked[0].p : null;
      if (!part && (slot === 'credential' || slot === 'proof')) part = body.find(p => named(p.text) && p !== last) || null; }
    if (!part) return { slot, part: null, host: '' };
    // the host: the sentence of that section this answer changes (a call to action, the sentence naming the business, ...)
    const sents = []; for (const line of part.text.split('\n')) { const l = line.trim(); if (!l || /^#{1,6}\s/.test(l) || /^!\[/.test(l) || /^\s*\|/.test(l) || /^\[[^\]]+\]\([^)]+\)\.?$/.test(l)) continue;
      for (const s0 of sentencesOf(l.replace(LEAD, ''))) if (plain(s0).split(/\s+/).length >= 5) sents.push(s0); }
    const pref = slot === 'credential' || slot === 'proof' ? (t) => named(t) : SLOT_SENT[slot] ? (t) => SLOT_SENT[slot].test(t) : () => false;
    const scored = sents.map((t, i) => ({ t, i, s: (pref(t) ? 1 : 0) + overlap(hint, t) })).sort((a, b) => b.s - a.s || (slot === 'cta' ? b.i - a.i : a.i - b.i));
    const host = scored.length && scored[0].s >= 0.25 ? scored[0].t : '';   // a slot sentence, or one sharing a quarter of the question's words
    return { slot, part, host }; };
  // W0-E (PLAN Fix 5.2): an answer the editor only APPENDED: a new sentence at the end of its paragraph (or a paragraph of its own) whose
  // other sentences share under 20% of its content words. A host sentence the editor rewrote is not new (it keeps most of its old words).
  // Returns { sentence, share } or null.
  const appendedIn = (beforeText, afterText, answer) => {
    const lines = (t) => S(t).split('\n').map(l => l.trim()).filter(l => l && !/^#{1,6}\s/.test(l) && !/^!\[/.test(l) && !/^\s*\|?\s*:?-{2,}/.test(l));
    const beforeS = lines(beforeText).flatMap(l => sentencesOf(plain(l.replace(LEAD, ''))));
    const key = (x) => toks(x).join(' '); const seen = new Set(beforeS.map(key));
    let best = null;
    for (const l of lines(afterText)) { const ss = sentencesOf(plain(l.replace(LEAD, '')));
      ss.forEach((s0, i) => { const sc = overlap(answer, s0); if (sc > 0 && (!best || sc > best.sc)) best = { sc, s: s0, i, ss }; }); }
    if (!best || best.sc < 0.5 || seen.has(key(best.s))) return null;
    if (beforeS.some(b => overlap(b, best.s) >= 0.5 && overlap(best.s, b) >= 0.3)) return null;   // the host sentence, rewritten
    if (best.i !== best.ss.length - 1) return null;
    const share = overlap(best.s, best.ss.slice(0, best.i).join(' '));
    return share < 0.2 ? { sentence: best.s, share: +share.toFixed(2) } : null; };
  const QUESTION_MAX = 8;   // W05-C
  // W05-C (BEFORE_AFTER Finalize K5): a heading or a label is not a statement: "How <client> measures up" was asked as "Is this true?" and a
  // yes spliced it to the end of a paragraph. A fragment of 8 words or fewer with no full stop and no verb is never asked about
  const headingLike = (t) => { const x = plain(S(t)).trim(); return !!x && !/[.!?]["')]*$/.test(x) && x.split(/\s+/).length <= 8 && !VERB.test(x.replace(/^how\b/i, '')); };
  const questions = (o) => {
    const x = o || {}; const biz = S(x.business || 'your business'); const stored = new Set((x.stored || []).map(S));
    const out = []; const seen = new Set();
    const push = (q) => { const k = q.fact_key + '|' + S(q.original || q.question).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120);
      if (seen.has(k) || seen.has(q.fact_key + '|') || stored.has(q.fact_key)) return; seen.add(k); out.push(q); };
    // W0-A (PLAN Fix 1.6, R4 D2): a statement in the head (the meta description, the title) is search-result copy, never a client question;
    // every question says where its sentence stood
    const HEAD_WHERE = /^(?:meta|title|head)$/i; const headText = x.final_md ? plain(split(x.final_md).head) : '';
    const inHead = (c) => HEAD_WHERE.test(S(c.where)) || (!!headText && plain(c.sentence).length >= 12 && headText.includes(plain(c.sentence)));
    for (const c of (x.claims || [])) { if (!c || !c.sentence || inHead(c) || headingLike(c.sentence)) continue; const kind = S(c.kind || 'process'); const cat = CATEGORY[kind] || 'service';
      const rw = c.rewrite || {};
      // W0-E (PLAN Fix 5.3): a statement the system removed carries no neutral wording (c.neutral '') and its anchor; one with no record of
      // its removal is matched only inside its own section
      const original = clean(plain(c.sentence)); const neutral = c.neutral != null ? clean(c.neutral) : neutralIn(x.final_md, c.sentence, c.section);
      const pre = rw.suggestion ? { prefill: clean(plain(rw.suggestion)), source: 'your website or business facts' } : prefillOf(original, x.docs, { category: cat, names: x.names });
      push({ kind, category: cat, fact_key: factKey(cat, original), source: 'claim', blocks: false, action: rw.action || '', needs_client_fact: rw.needs_client_fact !== false,
        question: clean(rw.question ? rw.question : 'Is this true for ' + biz + '? "' + original + '"'),
        why: 'Nothing on file says it, so the page does not claim it' + (neutral ? ': it says "' + neutral.slice(0, 200) + '" instead' : ': it leaves it out') + '. Say yes and the specific sentence goes back in, and later pages can say it too.',
        original, neutral, in_page: neutral ? (c.how === 'cta' ? 'cta' : 'neutral') : 'left_out', section: S(c.section || ''), where: S(c.where || ''),
        ...(!neutral && c.anchor && typeof c.anchor === 'object' ? { anchor: { section: S(c.anchor.section).slice(0, 300), before: S(c.anchor.before).slice(0, 400), after: S(c.anchor.after).slice(0, 400), line_before: S(c.anchor.line_before).slice(0, 400) } } : {}),
        choices: ['yes', 'edit', 'remove'], answer_type: 'choice', prefill: pre ? pre.prefill : '', prefill_source: pre ? pre.source : '',
        impact: Math.min(1, (IMPACT[cat] || 0.6) + (c.where === 's0' || c.cta ? 0.05 : 0)) }); }
    // W0-E (PLAN Fix 5.1, REVIEW_CODE M4): a brief question is { question, section, category } (the Strategy Brief's schema since section
    // 156); a plain string (a brief stored before it) is still read, its category from its words
    const BRIEF_CATS = { proof: 'proof', credential: 'credential', terms: 'terms', pricing: 'pricing', price: 'pricing', timeline: 'timeline', experience: 'experience', detail: 'detail' };
    for (const q0 of (x.brief || [])) { const o = q0 && typeof q0 === 'object' ? q0 : { question: q0 }; const t = clean(S(o.question).trim()); if (!t) continue;
      const kind = BRIEF_CATS[S(o.category).toLowerCase().trim()] || briefCategory(t); const cat = kind === 'terms' ? 'detail' : kind; const section = clean(plain(S(o.section))).slice(0, 200);
      const pre = prefillOf(t, x.docs, { category: cat, names: x.names });
      push({ kind, category: cat, fact_key: factKey(cat, t), source: 'brief', blocks: false, question: t, why: 'The brief found that this would make the page more convincing; the page is complete without it.',
        original: '', neutral: '', in_page: 'left_out', section, where: '', slot: slotOf({ category: kind, question: t }), choices: ['answer', 'skip'], answer_type: 'text', prefill: pre ? pre.prefill : '', prefill_source: pre ? pre.source : '', impact: IMPACT[cat] || 0.5 }); }
    for (const r of (x.brackets || [])) { if (!r || !r.question) continue; const cat = CATEGORY[r.kind] || 'detail'; const pre = prefillOf(r.question, x.docs, { category: cat, names: x.names });
      push({ kind: r.kind || 'detail', category: cat, fact_key: factKey(cat, S(r.token || r.question).replace(/^\[|\]$/g, '').replace(/^(author insight|confirm|owner)\s*:\s*/i, '')), source: 'bracket', blocks: false,
        question: clean(r.question), why: 'The writer needed this and nothing on file has it, so the page was written without it.',
        original: r.sentence ? clean(r.sentence) : '', neutral: '', in_page: 'left_out', section: '', where: '', slot: slotOf({ category: cat, question: r.question }), choices: ['answer', 'skip'], answer_type: 'text',
        prefill: pre ? pre.prefill : '', prefill_source: pre ? pre.source : '', impact: IMPACT[cat] || 0.45 }); }
    out.sort((a, b) => b.impact - a.impact);
    // W05-C (2026-10-30, BEFORE_AFTER: K6 asked 20 questions, "What does a client of ... receive at this step?" 8 times): near-duplicates go
    // and the client sees the most useful QUESTION_MAX, ranked. A question left out changes nothing: its sentence keeps the general
    // wording, as an unanswered question's does, and a later page may ask it again (nothing is stored)
    const qkey = (q) => S(q.question).replace(/"[^"]*"/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const kept = []; const perStem = new Map();
    for (const q of out) {
      const stem = qkey(q) + '|' + S(q.section).toLowerCase();
      if (q.source === 'claim') { const n = perStem.get(stem) || 0; if (n >= 2) continue; perStem.set(stem, n + 1); }
      // the same ask twice: two statements that say nearly the same thing (two rounds' wordings of one checklist line), or two questions
      // from the brief with nearly the same words
      const what = (x) => S(x.original).trim() || S(x.question);
      if (kept.some(k => (q.source === 'claim') === (k.source === 'claim') && overlap(what(q), what(k)) >= 0.6 && overlap(what(k), what(q)) >= 0.6)) continue;
      kept.push(q); if (kept.length >= QUESTION_MAX) break; }
    return kept.map((q, i) => ({ id: 'q' + (i + 1), rank: i + 1, use_for_future_pages: true, ...q, impact: +q.impact.toFixed(2) }));
  };
  const ACTION = {
    cut_off: 'start the page again (the complete draft could not be kept)',
    copied: 'rewrite the passages it repeats in your own words',
    duplicate_page: 'publish it as an update of your existing page for this search, or tell us how the new page differs',
    brand: 'write the business name the way you write it where the check found another form',
    author_profile: 'add the author\'s name, job title and a short bio to the business profile once',
    meta: 'write a meta description of 120 to 155 characters that says what the page answers',
    claim: 'delete the statement or confirm it in your business facts', figure: 'take out the figure or cite the page that states it',
    statistic: 'take out the number or cite the page that states it', bracket: 'fill in or delete the bracket', dead_link: 'replace or remove the link',
    off_topic: 'delete the section', guarantee: 'delete the guarantee', testimonial: 'delete the testimonial',
    weak_figure: 'rewrite the sentence without the number, or cite an official body, a research house or major press that states it',   // W0-H
    review: 'correct or remove the words the second read quoted, or check them against a source you trust'   // W0-H
  };
  const deliver = (cls, opts) => {
    const o = opts || {};
    const blocking = cls.blocking.map(b => ({ code: b.code, text: b.text, action: ACTION[b.code] || '' }));
    const status = blocking.length ? 'not_ready' : (o.questions || []).length ? 'ready_with_questions' : 'ready';
    const label = status === 'ready' ? 'Ready to publish'
      : status === 'ready_with_questions' ? 'Ready to publish. A few answers from you would make it stronger'
        : 'Not ready to publish yet: ' + clean(blocking[0].text).replace(/^./, (x) => x.toLowerCase());
    const acts = [...new Set(blocking.map(b => b.action).filter(Boolean))];
    const next_step = status !== 'not_ready' ? '' : clean('Finish this draft by hand: ' + acts.join('; ') + '. Then publish it. You do not need a new run for these edits: a new run writes a whole new page and is charged again.');
    return { status, label, blocking, advisory: cls.advisory.map(a => ({ code: a.code, text: a.text })), next_step };
  };
  // what is still on the page of the blocking items after a deletion pass (a light re-check: a deletion can only take things away)
  const residual = (cls, md) => { const t = S(md); const left = cls.blocking.filter(b => {
      if (b.tier === 'hard') return b.code !== 'brand';
      if (b.code === 'claim') return t.includes(S(b.sentence));
      if (b.code === 'figure') return t.includes('[Confirm: ' + b.figure + ']');
      if (b.code === 'statistic') return t.includes(S(b.stat));
      if (b.code === 'bracket') return bracketsIn(t).some(x => x.token === b.token);
      if (b.code === 'dead_link') return t.includes('](' + b.url + ')');
      if (b.code === 'off_topic') return new RegExp('^#{2,4}\\s+' + escRe(S(b.heading).replace(/^#+\s*/, '').trim()) + '\\s*$', 'm').test(t);
      if (b.code === 'guarantee') return !!b.quote && t.includes(b.quote.slice(0, 60));
      if (b.code === 'testimonial') return t.includes(S(b.text));
      if (b.code === 'weak_figure') return t.includes(S(b.sentence));   // W0-H
      if (b.code === 'review') return !b.location || onPage(b.location, t);   // W0-H: still there while its quoted words are
      return true; });
    const brand = cls.blocking.find(b => b.code === 'brand');
    return { ...cls, blocking: brand ? left.concat([brand]) : left, soft: left.filter(b => b.tier === 'soft').length }; };
  // everything a node needs to know about this run to apply the fixes, from the brief item (Parse Brief)
  const ctxOf = (prev, opts) => { const p = prev || {}; const b = p.content_brief || {}; const sg = p.style_guide || {}; const o = opts || {};
    // H2 (2026-10-27): the style guide holds the display name (`brand_form`) and the legal name (`legal_name`) apart; a row stored the old
    // way ("Nova& (legal name: Novaand systems LLC)") is read as the two here too
    const form = S(sg.brand_form).trim(); const legal = S(sg.legal_name).trim() || (form.match(/\(\s*legal(?: name)?\s*[:=-]?\s*([^)]+)\)/i) || [])[1] || '';
    const short = form.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const names = [...new Set([(p.site_profile || {}).business_name, (p.site_description || {}).business_name, short, S(p.domain).split('.')[0]].map(x => S(x).trim()).filter(x => x.length >= 3))];
    const live = new Set((p.internal_link_candidates || []).filter(x => x && !x.planned).map(x => keyOf(x.url)));
    const links = (b.internal_link_suggestions || []).filter(l => l && live.has(keyOf(l.url))).map(l => ({ url: S(l.url), anchor: S(l.anchor) }))
      .concat((p.internal_link_candidates || []).filter(x => x && !x.planned && x.title).map(x => ({ url: S(x.url), anchor: S(x.title).split(/\s+[|\-]\s+/)[0] })));
    return { keyword: S(p.keyword), domain: S(p.domain).toLowerCase().replace(/^www\./, ''), business: short || names[0] || S(p.domain) || 'your business', names,
      brand: short || form, wrong_forms: (sg.wrong_forms || []).map(S).filter(w => w.length >= 3 && w.length <= 40 && !/:/.test(w)), keep_forms: [legal.trim(), form !== short ? form : ''].filter(Boolean), legal_name: legal.trim(),
      brief_meta: S(b.meta_description).trim(),   // W0-A: PF.meta rebuilds a broken description from it first
      planned_slug: !!(p.ladder_id && S(p.ladder_target_url).trim()), ai_target: !!(p.ai_target && p.ai_target.question), snippet_targets: b.snippet_targets || [], outline: b.outline || [],
      internal_links: links, own_text: S(o.own_text || [p.business_facts, p.case_facts_text, p.proof_context].filter(Boolean).join(' ')), termRe: o.termRe || null,
      critique: o.critique || null, qa_marks: o.qa_marks || [], qa_figure_marks: o.qa_figure_marks || [] }; };
  // ---------- 9. the contents list (fu-finalize-toc, 2026-10-30, docs/page-quality-2026-10-29/BASELINE.md) ----------
  // The page package (Blog Package) puts a linked contents list above the first H2: "**Contents**", then "1. [Heading](#heading-id)", the id
  // being the H2's text as its anchorOf makes it (lower case, a-z0-9 runs joined by "-", cut at 60 characters, "-2" for a repeat). Finalize
  // unlinked entries 2-8 of every linked contents list (3 of 3 finals). PF.toc(md, ref) keeps the list true to the page's headings:
  //   * an entry whose link was lost gets it back from the reference page (the page the client sent);
  //   * an entry follows its heading: a renamed heading (matched by its anchor, its text, or its place among the reference page's headings
  //     of its level) renames its entry and its anchor; an entry whose section is gone is dropped and the list renumbered;
  //   * a contents list the final version lost is put back above the first H2, as the reference page had it;
  //   * a page with no linked contents list, here or in the reference page, is returned unchanged; an entry that never had a link is kept.
  const TOC_LABEL = /^\s*(?:#{2,4}\s+)?(?:\*\*|__)?\s*(?:contents|table of contents|in this (?:guide|article|page|post)|on this page)\s*:?\s*(?:\*\*|__)?\s*:?\s*$/i;
  const TOC_ITEM = /^(\s*)(\d{1,3}[.)]|[-*+])\s+(.+)$/;
  const tocSlug = (h) => S(h).toLowerCase().replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
  const tocText = (h) => S(h).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
  const tocKey = (t) => plain(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const tocBlock = (lines) => {
    for (let i = 0; i < lines.length; i++) {
      const labelled = TOC_LABEL.test(lines[i]);
      if (!labelled && !TOC_ITEM.test(lines[i])) continue;
      let j = labelled ? i + 1 : i; if (labelled) while (j < lines.length && !lines[j].trim()) j++;
      const items = []; let k = j;
      for (; k < lines.length; k++) { const m = lines[k].match(TOC_ITEM); if (!m) break; const lk = m[3].match(/^\[([^\[\]]+)\]\(#([^)\s]*)\)(.*)$/);
        items.push({ i: k, indent: m[1], marker: m[2], text: lk ? lk[1] : m[3], anchor: lk ? lk[2] : '', rest: lk ? lk[3] : '' }); }
      const linked = items.filter(x => x.anchor).length;
      if (labelled && items.length >= 2) return { label: i, start: j, end: k, items, linked };
      if (!labelled && items.length >= 3 && linked >= Math.ceil(items.length * 0.6)) return { label: -1, start: j, end: k, items, linked };
      if (!labelled && k > i) i = k - 1; }
    return null; };
  // the headings H2-H4 with the id the page package gives an H2 (one per heading text, "-2" for another heading with the same id)
  const tocHeads = (lines, skip) => { const ids = new Map(); const used = []; const out = []; let fence = false;
    lines.forEach((raw, i) => { const l = raw.trim(); if (/^(```|~~~)/.test(l)) { fence = !fence; return; } if (fence || skip(i) || TOC_LABEL.test(l)) return;
      const m = l.match(/^(#{2,4})\s+(.+)$/); if (!m) return; const text = m[2].trim(); let id;
      if (m[1].length === 2) { if (ids.has(text)) id = ids.get(text); else { const a = tocSlug(text); let k = a, n = 2; while (used.includes(k)) k = a + '-' + (n++); ids.set(text, k); used.push(k); id = k; } }
      else id = tocSlug(text);
      out.push({ i, level: m[1].length, text, id }); });
    return out; };
  const toc = (md, ref) => {
    const src = S(md); const nl = src.includes('\r\n') ? '\r\n' : '\n'; let L = src.split(/\r?\n/); const rl = S(ref).split(/\r?\n/);
    const log = { relinked: 0, renamed: 0, dropped: 0, restored: false };
    const same = { md: src, changed: false, ...log };
    const rb = S(ref).trim() ? tocBlock(rl) : null; let b = tocBlock(L);
    if (!b) {
      if (!rb || !rb.linked) return same;
      const at = L.findIndex(l => /^##\s/.test(l.trim())); if (at < 0) return same;
      const put = rl.slice(rb.label >= 0 ? rb.label : rb.start, rb.end);
      L = L.slice(0, at).concat(at > 0 && L[at - 1].trim() ? [''] : [], put, [''], L.slice(at));
      b = tocBlock(L); if (!b) return same; log.restored = true; }
    if (!b.linked && !(rb && rb.linked)) return same;
    const heads = tocHeads(L, (i) => i === b.label || (i >= b.start && i < b.end));
    const rheads = rb ? tocHeads(rl, (i) => i === rb.label || (i >= rb.start && i < rb.end)) : [];
    const claimed = new Set(); const kept = [];
    for (const it of b.items) {
      const rIt = rb ? (rb.items.find(x => x.anchor && it.anchor && x.anchor === it.anchor) || rb.items.find(x => x.anchor && tocKey(x.text) === tocKey(it.text))) : null;
      const anchor = it.anchor || (rIt ? rIt.anchor : '');
      if (!anchor) { kept.push({ it, line: L[it.i] }); continue; }
      const rh = rheads.find(x => x.id === anchor) || rheads.find(x => tocKey(x.text) === tocKey(it.text)) || null;
      let h = heads.find(x => !claimed.has(x.i) && x.id === anchor && (!rh || x.level === rh.level)) || heads.find(x => !claimed.has(x.i) && tocKey(x.text) === tocKey(it.text))
        || (rh ? heads.find(x => !claimed.has(x.i) && tocKey(x.text) === tocKey(rh.text)) : null);
      if (!h && rh) { const was = rheads.filter(x => x.level === rh.level); const now = heads.filter(x => x.level === rh.level); const p = was.indexOf(rh);
        // renamed in place: as many headings of its level as before, and the one at its place is none of the reference page's headings
        if (was.length === now.length && now[p] && !claimed.has(now[p].i) && !rheads.some(x => tocKey(x.text) === tocKey(now[p].text))) h = now[p]; }
      if (!h) { log.dropped++; continue; }
      claimed.add(h.i);
      // the entry's words: the heading's when the entry repeated its heading (the package writes it so), else the client's own words
      const mirror = tocKey(it.text) === tocKey(rh ? rh.text : h.text) || tocKey(it.text) === tocKey(h.text);
      const words0 = mirror ? tocText(h.text) : it.text;
      if (!it.anchor) log.relinked++; else if (it.anchor !== h.id || words0 !== it.text) log.renamed++;
      kept.push({ it, line: it.indent + it.marker + ' [' + words0 + '](#' + h.id + ')' + it.rest }); }
    // numbered entries counted again, level by level
    const count = new Map();
    const lines = kept.map(({ it, line }) => { const m = it.marker.match(/^(\d{1,3})([.)])$/); if (!m) return line;
      const n = (count.get(it.indent) || 0) + 1; count.set(it.indent, n); return line.replace(/^(\s*)\d{1,3}([.)])/, '$1' + n + '$2'); });
    let out;
    if (lines.length) out = L.slice(0, b.start).concat(lines, L.slice(b.end));
    else { const from = b.label >= 0 ? b.label : b.start; let to = b.end; while (to < L.length && !L[to].trim()) to++; out = L.slice(0, from).concat(L.slice(to)); }
    const md2 = out.join(nl);
    return { md: md2, changed: md2 !== src, ...log };
  };

  // ---------- 12. the final version: deterministic checks (W05-C, 2026-10-30, BEFORE_AFTER "Finalize") ----------
  // The five Finalize splices the blind judges named on the AFTER run: a closing call to action duplicated and broken ("... ahead of your
  // appointment date. To ask them, get in touch with <client>."), a second call-to-action line before the existing one, a heading fragment
  // spliced to a paragraph end ("... MLOps monitoring. How <client> measures up"), a list item that lost its bullet, a summary sentence
  // replaced by a fragment and a dangling fragment. Each is a rule here, used by Finalize Apply and Finalize Merge.
  //   PF.fragment(t)          a line that is not a sentence: a heading or a label, or words with no verb a reader can follow
  //   PF.ctaSentence(t, nm)   an invitation to get in touch (book a consultation, contact us, talk to <the business>, start a project)
  //   PF.lineOf(md, at)       the line around a place in the page, with its list marker
  //   PF.finalGuard(ref, md, nm)  the final version against the page it was made from: list markers put back, a heading spliced into a
  //                           paragraph put back on its own line, a second invitation that only repeats the first one taken out
  const FINITE = /\b(?:is|are|was|were|be|been|am|has|have|had|do|does|did|can|could|will|would|shall|should|may|might|must|cannot|isn't|aren't|doesn't|don't|won't)\b|\b(?:we|i|you|they|it|he|she|this|that|these|those|which|who|there)\s+(?:also\s+|often\s+|usually\s+|then\s+|now\s+|still\s+|only\s+|all\s+)?\p{L}{2,}/iu;
  const IMPERATIVE = /^(?:please\s+|then\s+|first,?\s+)?(?:add|agree|ask|book|bring|build|call|check|choose|compare|confirm|contact|cover|decide|define|email|find|get|give|go|keep|let|list|look|make|map|measure|move|name|note|pick|plan|prepare|pull|put|read|record|request|review|run|see|send|set|share|speak|split|start|stop|take|talk|tell|test|track|treat|try|turn|use|visit|watch|work|write)\b/i;
  // a verb in the third person ("Each phase ends with ...", "The plan covers ..."): a closed list, because a plural noun ends in -s too
  const VERB_S = /\b(?:adds|allows|applies|asks|becomes|brings|builds|buys|calls|carries|changes|checks|comes|connects|costs|counts|covers|creates|cuts|decides|delivers|depends|ends|explains|falls|finds|fits|follows|gets|gives|goes|grows|handles|happens|helps|holds|includes|keeps|knows|launches|leads|leaves|lets|lists|lives|looks|makes|matches|matters|means|measures|meets|moves|needs|offers|opens|owns|pays|provides|puts|reads|reduces|relies|removes|replaces|reports|requires|returns|reviews|runs|saves|says|scales|sees|sells|sends|serves|sets|shows|sits|starts|stays|stops|stores|supports|takes|tells|tends|tests|tracks|turns|updates|uses|wants|works|writes)\b/i;
  // a plural subject and its verb ("Engagements start with ...", "Most teams need ..."): a word in -s, then a verb from the same closed list
  const VERB_BASE = [...new Set(VERB_S.source.replace(/^\\b\(\?:|\)\\b$/g, '').split('|').flatMap(v => [v.replace(/s$/, ''), /(?:ch|sh|ss|x|o)es$/.test(v) ? v.replace(/es$/, '') : '']).filter(v => v.length >= 3 || v === 'go'))];
  // a verb is followed by more words ("Each phase ends with ..."); a plural noun that ends a label ("... and self-reported AI leads.") is not
  const VERB_MID = new RegExp(VERB_S.source + '(?=\\s+[\\p{L}\\d])', 'iu');
  const PLURAL_VERB = new RegExp('\\b\\p{L}{3,}s\\s+(?:also\\s+|often\\s+|usually\\s+|still\\s+|only\\s+)?(?:' + VERB_BASE.join('|') + ')\\b(?=\\s+[\\p{L}\\d])', 'iu');
  const OPENER = /^(?:if|when|whenever|once|while|before|after|as|because|since|although|though|unless|until|where|whether|to|for|in|on|at|by|from|with|without|during|under|over|across|through|between|within|beyond|instead of|like|unlike|besides|for example|for instance|in short|in practice|at the same time|first|then|next|finally|however|also|today|now)\b/i;
  // the clause that carries the sentence's verb: the first one, or the one after an opening phrase ("To start, tell us ...")
  const fragment = (t) => { const x = plain(S(t)).replace(/^\s*(?:[-*+]|\d{1,3}[.)])\s+/, '').trim(); if (!x) return false;
    if (headingLike(x)) return true;
    const cl = x.replace(/[.!?:;]+["')]*$/, '').split(/,\s+|\s+[-:]\s+|;\s+/);
    const has = (c, late) => FINITE.test(c) || IMPERATIVE.test(c) || VERB_MID.test(c) || PLURAL_VERB.test(c) || (late && /\b\p{L}{3,}ed\b/u.test(c));
    if (has(cl[0], false)) return false;
    let i = 0; while (i < cl.length - 1 && OPENER.test(cl[i].trim())) { i++; if (has(cl[i], true) || IMPERATIVE.test(cl[i].trim())) return false; }
    return true; };
  const ctaSentence = (t, names) => { const x = plain(S(t)); const nm = (names || []).map(S).filter(n => n.length >= 3).map(escRe);
    const who = '(?:us|our team|our experts|our consultants' + (nm.length ? '|' + nm.join('|') : '') + ')';
    return new RegExp('\\b(?:get in touch|reach out|contact ' + who + '|book (?:a|an|your)\\s+(?:free\\s+)?(?:consultation|call|demo|meeting|session|assessment)|(?:talk|speak) (?:to|with) ' + who + '|talk (?:it |this |them )?through|start a project|request a (?:quote|demo|call|consultation|proposal)|schedule a (?:call|consultation|demo|meeting)|let\'?s talk)\\b', 'i').test(x); };
  const MARKER = /^(\s*)((?:[-*+]|\d{1,3}[.)])\s+)/;
  const lineOf = (md, at) => { const src = S(md); const ls = src.lastIndexOf('\n', at - 1) + 1; let le = src.indexOf('\n', at); if (le < 0) le = src.length;
    const line = src.slice(ls, le); const m = line.match(MARKER); return { start: ls, end: le, line, marker: m ? m[1] + m[2] : '', list: !!m }; };
  const normL = (t) => plain(S(t)).toLowerCase().replace(/[^\p{L}\p{N}%$&]+/gu, ' ').trim();
  const finalGuard = (ref, md0, names) => {
    const R = S(ref).split('\n'); let L = S(md0).split('\n'); const log = { markers: 0, headings: 0, cta: 0 };
    let fence = false; const fenced = (l) => { if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return true; } return fence; };
    // list items of the page it was made from, by their words (an item that also stands as prose there is left alone)
    const items = new Map(); const prose = new Set();
    for (const l of R) { const m = l.match(MARKER); const k = normL(l.replace(MARKER, '')); if (!k || k.length < 12) continue; if (m) items.set(k, m[1] + m[2]); else if (!/^\s*(#|\|)/.test(l)) prose.add(k); }
    fence = false;
    L = L.map(l => { if (fenced(l) || !l.trim() || MARKER.test(l) || /^\s*(#|\||>|!\[|\[Image:)/.test(l)) return l; const k = normL(l);
      if (items.has(k) && !prose.has(k)) { log.markers++; return items.get(k) + l.trim(); } return l; });
    // a heading of the page it was made from, spliced to the end of a paragraph line: back on its own line, at its level
    const heads = R.map(l => l.match(/^(#{2,4})\s+(.+?)\s*$/)).filter(Boolean).map(m => ({ level: m[1], text: m[2].trim() }));
    const headNow = new Set(L.map(l => (l.match(/^#{2,4}\s+(.+?)\s*$/) || [])[1]).filter(Boolean).map(normL));
    for (const h of heads) { if (headNow.has(normL(h.text)) || h.text.length < 6) continue;
      const i = L.findIndex(l => !/^\s*(#|\|)/.test(l) && l.trim().length > h.text.length + 10 && l.trimEnd().endsWith(' ' + h.text));
      if (i >= 0) { const body = L[i].trimEnd(); L.splice(i, 1, body.slice(0, body.length - h.text.length).trimEnd(), '', h.level + ' ' + h.text); headNow.add(normL(h.text)); log.headings++; } }
    // the call to action said twice: only when this version ADDED an invitation (a sentence the page it was made from does not have).
    // In the paragraph it joined, an older invitation with no link, no phone and no e-mail that it now repeats goes (K2: "To ask them, get
    // in touch with <client>." after the confirmed sentence); a new bare invitation in a section that already invited the reader goes (K3)
    let md = L.join('\n');
    const refSent = new Set(R.flatMap(l => sentencesOf(l.replace(MARKER, ''))).map(normL));
    const refSp = split(S(ref)); const refInv = (h) => { const p = refSp.parts.find(x => normL(x.heading) === normL(h)); return !!p && sentencesOf(p.text.replace(/\n/g, ' ')).some(x => ctaSentence(x, names)); };
    const bareInv = (x) => ctaSentence(x, names) && !/\]\(|\+?\d[\d\s-]{6,}\d|@[a-z0-9-]+\.[a-z]/i.test(x);
    const sp = split(md); let touched = false;
    for (const part of sp.parts.slice(1)) { const lines = part.text.split('\n'); let changed = false; const hadInv = refInv(part.heading);
      for (let i = 0; i < lines.length; i++) { const l = lines[i]; if (!l.trim() || /^\s*(#|\||>|!\[)/.test(l) || MARKER.test(l)) continue;
        const ss = sentencesOf(l); const fresh = ss.filter(x => ctaSentence(x, names) && !refSent.has(normL(x))); if (!fresh.length) continue;
        const old = ss.filter(x => !fresh.includes(x) && bareInv(x) && words(plain(x)) <= 14);
        const late = hadInv && !old.length ? fresh.filter(x => bareInv(x) && words(plain(x)) <= 20) : [];
        const drop = old.concat(late); if (!drop.length) continue;
        lines[i] = ss.filter(x => !drop.includes(x)).join(' '); log.cta += drop.length; changed = true; }
      if (changed) { part.text = lines.join('\n'); touched = true; } }
    if (touched) md = join(sp);
    const changed = log.markers + log.headings + log.cta > 0;
    return { md: changed ? tidy(md) : S(md0), ...log, changed }; };
  return { EDIT_MAX, contract, bandOf, kindOf, split, join, span, removeAt, removeText, tidy, neutralSentence, bracketsIn, questionFor, fix, meta, metaProblem, fieldCheck, unmark, caseLike, brandHits, testimonials,
    classify, weakFigures, reviewed, reviewText, onPage, score, protect, better, plan, parseSections, merge, unlinkDead, deleteSection, neutralize, questions, deliver, residual, ctxOf, ACTION, prefillOf, prefillProblem, neutralIn, factKey, clean, words, plain, hostOf, keyOf, overlap,
    anchorAt, slotOf, slotIn, appendedIn, sentencesOf,
    toc, tocSlug, fragment, ctaSentence, lineOf, finalGuard, headingLike, QUESTION_MAX, figKeysIn };
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
    return { KEYWORD: S(p.keyword), PAGE_TYPE: S(p.page_type || 'page'), COUNTRY: S(p.country || 'not stated'), AUDIENCE: S(b.target_audience || p.audience || 'not stated'),
      BUSINESS: S(sp.business_name || sd.business_name || p.domain || 'the business'), DOMAIN: S(p.domain),
      SITE_PAGES: own.slice(0, CFG.site_pages).join('\n') || 'none listed', FACTS: facts || 'none', SOURCES: srcs.join('\n') || 'none',
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
    return { skip: false, reason: '', mode, model: MODEL, today, body: JSON.stringify(body), prompt_chars: prompt.length }; };
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
    const problems = j.problems.filter(p => p && typeof p === 'object').slice(0, 20).map(p => {
      const severity = /^(high|medium|low)$/i.test(S(p.severity)) ? S(p.severity).toLowerCase() : 'low'; const kind = KINDS.includes(S(p.kind).toLowerCase()) ? S(p.kind).toLowerCase() : 'other';
      const location = clean(p.location).slice(0, 300); const on_page = !!location && onPage(location, md);
      const q = { severity, kind, location, issue: clean(p.issue).slice(0, 400), fix: clean(p.fix).slice(0, 400), on_page };
      const error = errorOf(q, S(pl.today)); return { ...q, error, gates: !!error }; });
    const gating = problems.filter(p => p.gates);
    // W05-A: the most damaging advice first (the high items that are not errors), as the client sees it and the grade counts it
    const advice = problems.filter(p => !p.gates && p.on_page && p.severity !== 'low').sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1)).slice(0, CFG.max_advice);
    return { status: 'checked', reason: '', mode, model: S(r.model || MODEL), usage, today: S(pl.today), score: Number.isFinite(Number(j.score)) ? Number(j.score) : null,
      problems, gates: mode === 'enforce' ? gating : [], would_block: mode === 'enforce' ? [] : gating, advice,
      not_shown: problems.filter(p => !p.on_page).length }; };
  // the delivered page with what the read found: blockers in enforce mode, advice always; the grade object is not touched here
  const apply = (qa0, rr, PFk) => {
    const qa = { ...(qa0 || {}) }; const R = rr || {}; const del = qa.delivery && typeof qa.delivery === 'object' ? { ...qa.delivery } : null;
    const record = { status: R.status, reason: R.reason || '', mode: R.mode, model: R.model, usage: R.usage || null, score: R.score == null ? null : R.score,
      gates: (R.gates || []).map(g => ({ kind: g.kind, error: g.error || '', location: g.location, issue: g.issue, fix: g.fix })),
      would_block: (R.would_block || []).map(g => ({ kind: g.kind, error: g.error || '', location: g.location, issue: g.issue, fix: g.fix })),
      advice: (R.advice || []).map(g => ({ severity: g.severity, kind: g.kind, location: g.location, issue: g.issue, fix: g.fix })), not_shown: R.not_shown || 0 };
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
// ---- grade kit (W0-C, page-quality programme 2026-10-29, docs/page-quality-2026-10-29/PLAN.md Fix 3, 2.6, 2.9; REVIEW_CODE H3 / L1 / L5;
// REVIEW_EVIDENCE H2 / H3 / M1; inlined through the GRADE marker into Content QA, Page Candidates, Apply Second Read and the Finalize
// workflow's Finalize Verdict). Production page run 3299 ("ms 365 erp") was graded 92 and its final version 100 "Ready to publish" while the
// client's expert reviewer gave it 63: the grade counted structure, term coverage, readability, specificity, filler words and LENGTH, and
// nothing a reviewer takes points off for (figures resting on an agency blog and a tracker, one label for two different lists, a keyword our
// own verdict scored 42, a page the website already had). The only part that moved 92 -> 100 was length.
//
// The interim grade, deterministic and free, on ONE scale out of 100 (a subset of the Wave 2 rubric, so nothing is thrown away):
//   structure 20       today's structure checks scaled; -3 per repetition cluster (one statement made 3+ times across sections, up to
//                      -8); -2 per label used for two different lists (up to -4); a statement made 4+ times caps structure at 50%;
//                      W06-A: -2 per IDEA restated 4+ times in 3+ places (the near-duplicate check below, up to -4), never below half
//   removed sections   W06-A: when the run's deletions (verdict exclusions) or its edits took 2+ sections or 20%+ of the words out of the
//                      page, coverage and fit are capped at 40% of their parts (the page no longer covers what its search asks), with why
//   coverage 15        today's term coverage, scaled
//   readability 10     today's readability, scaled
//   specificity 10     today's specificity
//   clean language 10  today's filler-phrase check
//   sources 15         share of the cited sentences and figures resting on an official body, a research house, major press or vendor
//                      documentation; -1/3 of the part per market, adoption, cost or compliance figure whose only source is weak; such a
//                      compliance figure caps sources at 8 of 15. Nothing to source (no figure, no citation) is "not checked" at 12 of
//                      15 (4/5): never full marks, so deleting a citation never pays (WAVE0_REVIEW M2). A sentence resting only on a weak
//                      source with no market / cost / compliance figure counts half a strong one (none while such a figure rests only
//                      on a weak source), and while nothing on the page is an
//                      unsourced or weak-only figure the part never falls below "not checked": citing a vendor or agency page is never
//                      worse than citing nothing. The digits of a phone number, opening hours, a postcode / PO box or a street, office
//                      or floor number are contact details, never a figure to source (WAVE0_REVIEW H1)
//   fit 20             half for the verdict (>= 50 full, 30-49 two fifths, < 30 none, no score full and "not checked"), half for no open
//                      duplicate page. A verdict under 50 caps fit at 40%, also after "Write it anyway"; an open duplicate caps it at 30%.
//                      The shapes of the results page are recorded (serp_shapes, Parse Analysis), no points yet
//   length 0           advice only (Google says not to aim at a word count)
// Every cap is a SHARE of its part, so a page-type weighting (Wave 2) cannot break it. Any open blocker -> total <= 59; shown as "95+" from 95.
// READY needs no blocker AND every part at or above half its maximum. Exceptions, so a page we should write is never held back:
//   * fit is waived after an explicit acknowledgement ("Write it anyway") and for pages a search score says nothing about (a page of the
//     client's keyword ladder, a case study, an AI answer page, a refresh): shown as the client's or the plan's choice, the cap kept;
//   * for runs the system started by itself (cadence, ladder, tracker), the fit floor is only recorded (shadow, owner decision D17).
// A failed floor is ADVICE in this wave: the page is "Needs work: <part>" (delivery status `needs_work`), never "Ready to publish", and
// nothing stops the client from approving and publishing it. A blocker is still the only thing that makes a page "not ready".
// The guide that ranks (production exec 949, owner priority) passes every floor: harness/scenarios_w0c.js.
// Regex and token code only (the n8n Code sandbox has no URL constructor and no-ops Object.defineProperty). No literal dash, curly quote
// or ellipsis character in this file: they are built with String.fromCharCode.
const GR = (() => {
  const VERSION = 'w0c-1';
  const S = (v) => String(v == null ? '' : v);
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const r1 = (x) => Math.round(x * 10) / 10;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const CH = (...c) => String.fromCharCode(...c);
  const RE_DASH = new RegExp('\\s*[' + CH(0x2014, 0x2013) + ']\\s*', 'g'), RE_DQ = new RegExp('[' + CH(0x201C, 0x201D) + ']', 'g'), RE_SQ = new RegExp('[' + CH(0x2018, 0x2019) + ']', 'g'), RE_ELL = new RegExp(CH(0x2026), 'g');
  const clean = (s) => S(s).replace(RE_DASH, ': ').replace(RE_DQ, '"').replace(RE_SQ, "'").replace(RE_ELL, '...').replace(/:\s*:/g, ':').trim();
  const MAX = { structure: 20, coverage: 15, readability: 10, specificity: 10, clean_language: 10, sources: 15, fit: 20, length: 0 };
  const DIMS = ['structure', 'coverage', 'readability', 'specificity', 'clean_language', 'sources', 'fit'];
  const LABEL = { structure: 'structure', coverage: 'topic coverage', readability: 'readability', specificity: 'specificity', clean_language: 'plain language', sources: 'sources', fit: 'fit with the search' };
  // caps as shares of their part (REVIEW_EVIDENCE M1): verdict under 50 -> fit 40%; open duplicate -> fit 30%; a statement made 4+ times ->
  // structure 50%; a weak-only compliance figure -> sources 8 of 15
  const SHARE = { fit_verdict: 0.4, fit_duplicate: 0.3, structure_repeat: 0.5, sources_compliance: 8 / 15, weak_figure: 1 / 3, verdict_partial: 0.4, sources_none: 0.8, weak_cite: 0.5, removed: 0.4 };
  const CFG = { sim: 0.6, min_words: 4, cluster: 3, cluster_cap: 4, blocker_cap: 59, verdict_bar: 50, display_top: 95, floor: 0.5, review_share: 0.25,
    idea: { size: 4, places: 3, shared: 3, overlap: 0.6, dice: 0.3, min_words: 3, df_share: 0.08, df_min: 6, points: 2, max_points: 4 },   // W06-A: the idea check
    removed: { sections: 2, share: 0.2 } };   // W06-A: deletions that cap coverage and fit
  const STOP = new Set(('the a an and or of for to in on with by at from about this that these those your our its it is are be how what which why when who you we they their them '
    + 'than then into over under more most can will does do not but any all one two also very just only such been being has have had was were each per may must should would '
    + 'could other some many much here there where while if so as up out own same both few no nor too yes use used using get gets make makes made need needs '
    + 'first second third new well like via within without across between before after because usually often typically').split(' '));
  const NUMW = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const stem = (w) => { let x = w; if (x.length > 5) x = x.replace(/(?:ations?|ings?|ies|ed|es|ly|s)$/, ''); else if (x.length > 3) x = x.replace(/s$/, ''); return x; };
  const plain = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const toks = (t, keep) => S(t).toLowerCase().replace(RE_SQ, '').replace(/'/g, '').split(keep ? /[^\p{L}\p{N}&_]+/u : /[^\p{L}\p{N}&]+/u).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
  const HEAD = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;
  const BYLINE = /^[*_]+\s*(?:written by|by|reviewed by|updated)\b/i;   // the italic byline line, never a sentence that starts "By 2027, ..."
  const SKIP_SECTION = /\babout the author\b|^author\b|\bsources\b|\breferences\b|\bfurther reading\b/i;
  const hostOf = (u) => { const m = S(u).match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; };
  const SOCIAL = /(^|\.)(linkedin\.com|x\.com|twitter\.com|facebook\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|wa\.me|whatsapp\.com|calendly\.com)$/;
  const maxOf = (m) => { const o = { ...MAX }; for (const k of DIMS) if (m && Number.isFinite(Number(m[k])) && Number(m[k]) >= 0) o[k] = Number(m[k]); return o; };

  // ---------- the page as sections, paragraphs, sentences, list items and table rows (head lines, byline, images, author box left out) ----------
  const units = (md0) => {
    const out = []; let section = 0, heading = '', skip = false, para = 0, qa = false;
    const lines = S(md0).replace(/\r/g, '').split('\n');
    let listId = 0, inList = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) { para++; continue; }   // a blank line between two items does not end a list (a numbered list written "1.", blank, "1.")
      if (HEAD.test(l)) continue;
      const h = l.match(/^(#{1,6})\s+(.*)$/);
      if (h) { if (h[1].length >= 2) { section++; heading = plain(h[2]); skip = SKIP_SECTION.test(heading); } para++; inList = false; out.push({ kind: 'heading', section, heading, text: plain(h[2]), level: h[1].length, line: i }); continue; }
      if (skip) continue;
      if (/^!\[/.test(l) || /^```/.test(l) || BYLINE.test(l)) continue;
      if (/^\|/.test(l)) { inList = false; if (/^\|?\s*:?-{2,}/.test(l)) continue; out.push({ kind: 'row', section, heading, para, text: l, line: i }); continue; }
      const li = l.match(/^(?:>\s*)?(?:[-*+]|\d{1,3}[.)])\s+(.*)$/);
      if (li) { if (!inList) { listId++; inList = true; } out.push({ kind: 'li', list: listId, section, heading, para, text: li[1], line: i }); continue; }
      inList = false;
      const body = l.replace(/^>\s*/, '');
      qa = /^\**\s*quick answer\b/i.test(body);
      for (const s of body.split(/(?<=[.!?]["')*_]*)\s+(?=[A-Z0-9"'(*\[])/)) if (s.trim()) out.push({ kind: 'sentence', section, heading, para, text: s.trim(), qa, line: i });
    }
    return out;
  };

  // ---------- 1. repetition: one statement made again and again ----------
  // Statements (sentences and list items under an H2 / H3, not the introduction, the Quick answer, questions, images or review notes) are
  // reduced to their content words: the keyword's and the brand's words are taken out (they are on every line of a good page) and a name
  // of several capitalised words is ONE word ("Accredited Service Provider", "Supply Chain Management"), since a product name alone says
  // nothing about WHICH point a sentence makes (without that, every sentence naming the same two products was one "cluster" on the guide
  // that ranks). Two statements in different sections with a Dice overlap of CFG.sim or more say the same thing; linked statements form a
  // cluster; a cluster of 3+ statements across 2+ sections is one point made three times. Calibrated on production pages 3299 / 3336 and
  // the guide that ranks (exec 949): none of the three has such a cluster, the pairs each page makes twice stay pairs, and one statement
  // restated in six sections is found (harness/scenarios_w0c.js). Deliberately conservative: a paraphrase is the Wave 2 judge's work.
  const repetition = (md, ctx) => {
    const c = ctx || {};
    const drop = new Set(toks([c.keyword].concat(c.brand_names || []).join(' ')).map(stem));
    const U = units(md).filter(u => (u.kind === 'sentence' || u.kind === 'li') && !u.qa && u.section > 0 && !/^\[(?:Image|Confirm|Owner)\b/i.test(u.text) && !/\?["')*_]*$/.test(u.text.trim()));
    const entity = (t) => plain(t).replace(/\b(?:The|A|An|This|That|These|Your|Our)\s+(?=[A-Z])/g, '').replace(/\b[A-Z][\w&]*(?:\s+[A-Z][\w&]*)+/g, (m) => m.replace(/\s+/g, '_'));
    const items = [];
    for (const u of U) { const set = [...new Set(toks(entity(u.text), true).map(stem).filter(w => !drop.has(w)))]; if (set.length >= CFG.min_words) items.push({ ...u, set: new Set(set), n: set.length }); }
    const parent = items.map((x, i) => i); const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const near = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]; if (a.section === b.section) continue;
      let inter = 0; for (const w of a.set) if (b.set.has(w)) inter++;
      const sim = 2 * inter / (a.n + b.n);
      if (c.debug && sim >= 0.4) near.push({ sim: Math.round(sim * 100) / 100, a: plain(a.text).slice(0, 110), b: plain(b.text).slice(0, 110) });
      if (sim >= CFG.sim) { const x = find(i), y = find(j); if (x !== y) parent[x] = y; } }
    const groups = new Map();
    items.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); });
    const clusters = [...groups.values()].filter(g => g.length >= CFG.cluster && new Set(g.map(x => x.section)).size >= 2)
      .map(g => ({ size: g.length, sections_n: new Set(g.map(x => x.section)).size, sections: [...new Set(g.map(x => x.heading))].slice(0, 8),
        sample: plain(g[0].text).slice(0, 160), members: g.slice(0, 8).map(x => plain(x.text).slice(0, 140)) })).sort((a, b) => b.size - a.size);
    return { clusters, count: clusters.length, worst: clusters.length ? clusters[0].size : 0, compared: items.length, ...(c.debug ? { near: near.sort((x, y) => y.sim - x.sim).slice(0, 25) } : {}) };
  };

  // ---------- 1b. W06-A: one IDEA restated (the near-duplicate check) ----------
  // The blind judges of the wave 0.5 re-check (WAVE05.md) took structure points off three pages for an idea restated 4 to 6 times
  // ("NetSuite for groups with subsidiaries across countries on one SaaS platform", "a gap-fit analysis before a fixed scope") that the
  // statement check above never saw: the restatements are worded differently, in a list, a table row, a takeaway and a closing rule, so no
  // two of them reach its Dice 0.6. Here every sentence, list item and table row (the Quick answer included, questions and links left out)
  // is reduced to its rarer content words: the keyword's and the brand's words and every word on more than 8% of the units (the page's
  // vocabulary, such as a product name) are taken out, and a name of several capitalised words is one word. Two units in different places
  // that share 3+ such words, 60% of the shorter one and a Dice of 0.3, say the same thing. A unit with near copies in 3+ places, 4+ units
  // in all, is one idea restated (the copies are taken by the most connected unit first, so one long chain is never one idea). Calibrated on
  // the 16 AFTER / W05 pages of the page-quality run and the guide that ranks (exec 949): it finds the ideas the judges named on two of the
  // three pages (K3, K4; K6's "launch narrow" is restated in a heading and with too few shared words), nothing on the guide that ranks, and
  // a repeated deadline, a repeated product rule and a repeated method on three AFTER pages. Deterministic and conservative: a paraphrase
  // with no shared words is the Wave 2 judge's work.
  const ideas = (md, ctx) => {
    const c = ctx || {}; const I = CFG.idea;
    const strip = (t) => plain(S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/\]\([^)]*\)?/g, ' ').replace(/https?:\/\/\S+/g, ' ').replace(/\[/g, ' ')).replace(/^quick answer:?\s*/i, '');
    const entity = (t) => strip(t).replace(/\b(?:The|A|An|This|That|These|Your|Our)\s+(?=[A-Z])/g, '').replace(/\b[A-Z][\w&]*(?:\s+[A-Z][\w&]*)+/g, (m) => m.replace(/\s+/g, '_'));
    const drop = new Set(toks([c.keyword].concat(c.brand_names || []).join(' ')).map(stem));
    const U = units(md).filter(u => (u.kind === 'sentence' || u.kind === 'li' || u.kind === 'row') && !/^\[(?:Image|Confirm|Owner)\b/i.test(u.text)
      && !(u.kind === 'li' && /^\s*\[[^\]]*\]\(#[^)]*\)\s*$/.test(u.text)) && !/\?["')*_]*$/.test(u.text.trim()));
    const items = U.map(u => ({ text: u.text, place: u.qa ? 'qa' : 's' + u.section, set: new Set(toks(entity(u.text), true).map(stem).filter(w => !drop.has(w))) }));
    const df = new Map(); for (const it of items) for (const w of it.set) df.set(w, (df.get(w) || 0) + 1);
    const cap = Math.max(I.df_min, Math.ceil(items.length * I.df_share));
    for (const it of items) { it.set = new Set([...it.set].filter(w => df.get(w) <= cap)); it.n = it.set.size; }
    const cand = items.map((it, i) => ({ ...it, i })).filter(it => it.n >= I.min_words);
    const nb = new Map(cand.map(it => [it.i, []]));
    for (let a = 0; a < cand.length; a++) for (let b = a + 1; b < cand.length; b++) {
      const x = cand[a], y = cand[b]; if (x.place === y.place) continue;
      let inter = 0; for (const w of x.set) if (y.set.has(w)) inter++;
      if (inter < I.shared || inter / Math.min(x.n, y.n) < I.overlap || 2 * inter / (x.n + y.n) < I.dice) continue;
      nb.get(x.i).push(y.i); nb.get(y.i).push(x.i); }
    const used = new Set(); const found = [];
    for (const it of cand.slice().sort((a, b) => nb.get(b.i).length - nb.get(a.i).length || a.i - b.i)) {
      if (used.has(it.i)) continue;
      const mem = [it.i].concat(nb.get(it.i).filter(j => !used.has(j)));
      const places = new Set(mem.map(j => items[j].place));
      if (mem.length >= I.size && places.size >= I.places) { mem.forEach(j => used.add(j));
        found.push({ size: mem.length, places: places.size, sample: strip(it.text).slice(0, 160), members: mem.slice(0, 8).map(j => strip(items[j].text).slice(0, 140)) }); }
    }
    found.sort((a, b) => b.size - a.size);
    return { ideas: found, count: found.length, worst: found.length ? found[0].size : 0, compared: cand.length };
  };

  // ---------- 2. one label for two different lists ("five questions" before two lists, then "use the five questions") ----------
  const listLabels = (md) => {
    const U = units(md); const LBL = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})\s+([a-z]{3,})\b/i;
    const norm = (m) => (NUMW[m[1].toLowerCase()] || Number(m[1])) + ' ' + stem(m[2].toLowerCase());
    const leads = new Map();
    for (let i = 0; i < U.length; i++) {
      const u = U[i]; if (u.kind !== 'li') continue; if (i > 0 && U[i - 1].kind === 'li' && U[i - 1].list === u.list) continue;   // the first item of a list
      const lead = i > 0 && (U[i - 1].kind === 'sentence' || U[i - 1].kind === 'heading') ? U[i - 1] : null;   // the line right before it
      const m = lead ? plain(lead.text).match(LBL) : null; if (!m) continue;
      const k = norm(m); if (!leads.has(k)) leads.set(k, { lists: new Set(), text: plain(lead.text).slice(0, 120) }); leads.get(k).lists.add(u.list); }
    const collisions = [...leads.entries()].filter(([, v]) => v.lists.size >= 2).map(([label, v]) => ({ label, lists: v.lists.size, lead: v.text }));
    return { collisions, count: collisions.length };
  };

  // ---------- 3. sources: what the cited sentences and the figures rest on ----------
  // A unit is a sentence, list item or table row that cites an outside page, names its source ("according to ..."), or carries a figure.
  // Strong: it links an official body, a research house, major press or vendor documentation (`opts.tier` = Content QA's SRC.tier: anything
  // but 'weak'), or names an official body or one of those houses; a figure with no link of its own takes its paragraph's citation. A figure
  // the business states about itself (on file: `own_text`), a year, or a standard's or a law's number is not a sourcing question. The
  // client's own pages and social profiles are not citations.
  const OFFICIAL = /\b(?:ministry|authority|federal|government|central bank|commission|council|agency|department|bureau|regulator|parliament|court|statistics|census|united nations|world bank|oecd|imf|european union|eurostat)\b/i;
  const ATTR = /\b(?:according to|as reported by|reported by|research (?:by|from)|(?:a|the) (?:study|survey|report|analysis) (?:by|from))\s+((?:the\s+)?[A-Z][\w&.'-]*(?:\s+(?:of\s+|for\s+|and\s+)?[A-Z][\w&.'-]*){0,5})/;
  const ATTR_FIG = /\b(?:data from|figures from)\s+((?:the\s+)?[A-Z][\w&.'-]*(?:\s+(?:of\s+|for\s+|and\s+)?[A-Z][\w&.'-]*){0,5})|\b((?:the\s+)?[A-Z][\w&.'-]+(?:\s+[A-Z][\w&.'-]+){0,4})(?:'s)?\s+(?:found|finds|reports?|reported|estimates?|estimated|states?|stated|counts?|counted)\b/;
  const FIG_TOPIC = /\bmarket|\bshare\b|\bindustr|\brevenue|\bvalued?\b|\bworth\b|\bcagr\b|\bgrow|\bsize\b|\bforecast|\bspend|\bcompan(?:y|ies)\b|\bbusinesses\b|\borgani[sz]ations?\b|\bfirms?\b|\benterprises?\b|\bcustomers?\b|\busers?\b|\bclients?\b|\bsmes?\b|\badopt|\buse[sd]?\b|\busing\b|\bdeploy|\bimplement|\bcost|\bprice|\bpricing|\bfees?\b|\bbudget|\bsav(?:e|es|ed|ing|ings)\b|\broi\b|\binvest|\bfines?\b|\bpenalt|\bdeadline|\bmandat|\bvat\b|\btax|\bregulat|\blaws?\b|\blegal|\bcompl(?:y|ies|iance|iant)\b|\be-?invoic|\bthreshold|\brequire|\bauthorit|\bministry|\bdecree/i;
  const COMPLIANCE = /\bfines?\b|\bpenalt|\bdeadline|\bmandat|\bvat\b|\btax|\bregulat|\blaws?\b|\blegal|\bcompl(?:y|ies|iance|iant)\b|\be-?invoic|\bthreshold|\brequire|\bauthorit|\bministry|\bdecree/i;
  const STD = /\b(?:ISO|IEC|EN|BS|SOC|PCI|IAS|IFRS|ASC|Article|Section|Law|Decree|No\.?|Resolution|Circular|Decision)\s?(?:\/IEC)?$/i;
  // H1 (WAVE0_REVIEW 2026-10-30): where a page states how to reach the business, its digits are contact details. BEFORE run K6 (the page
  // both judges rated best) had one source unit, the last four digits of the phone number in its call to action, and graded sources 0 of 15:
  // "Needs work: sources" on a guide that cites nothing it needs to. Every Local page carries a NAP block (v4.4), so every one would have.
  // The spans below are phone numbers (an international prefix, or a phone word before a run of 7+ digits with separators or a leading 0),
  // opening hours (0900-1800), a PO box / postcode / ZIP, and a street, office, suite, floor or building number. A figure inside one is
  // not a sourcing question ("P.O. Box 123456" is cut into two sentences at "P.O.", so a capital "Box" with its number counts alone, as does a
  // number in the local form 0X XXX XXXX). Each match must hold enough digits to be what it says (a phone 7+), so "call 1,200 customers" stays a figure.
  const NAP_RES = [
    [/(?:\+|\b00)\d{1,4}[\s.\-]?(?:\(\d{1,4}\)[\s.\-]?)?(?:\d{1,5}[\s.\-]?){1,5}\d{1,5}\b/g, 8],
    [/\b(?:tel|telephone|phone|call(?:\s+us)?|mobile|whatsapp|fax|toll[\s\-]?free|landline|hotline)\b[^\n.]{0,30}?(?:\(\d{1,5}\)\s?|\b0)\d[\d\s.\-]{4,}\d/gi, 7],
    [/\b(?:tel|telephone|phone|call(?:\s+us)?|mobile|whatsapp|fax|toll[\s\-]?free|landline|hotline)\b[^\n.]{0,30}?\b\d{2,5}(?:[\s.\-]\d{2,5}){1,4}\b/gi, 7],
    [/\(\+?\d{1,5}\)\s?\d[\d\s.\-]{4,}\d/g, 7],
    [/\b0\d{1,3}[\s.\-]\d{3,4}[\s.\-]?\d{3,4}\b/g, 8],
    [/\bBox\s*[:#]?\s*\d[\d\-]{1,10}/g, 3],
    [/\b(?:open(?:ing)?|hours|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b[^\n.]{0,40}?\b(?:[01]\d|2[0-3])[:.]?[0-5]\d\s*(?:-|to|until|till)\s*(?:[01]\d|2[0-3])[:.]?[0-5]\d\b/gi, 6],
    [/\b0\d[:.]?[0-5]\d\s*(?:-|to|until|till)\s*(?:[01]\d|2[0-3])[:.]?[0-5]\d\b/gi, 6],
    [/\b(?:p\.?\s?o\.?\s?box|post\s?box|postcode|post(?:al)?\s?code|zip(?:\s?code)?|pin\s?code)\s*[:#.]?\s*[A-Z]{0,2}\d[\d\s\-]{1,10}/gi, 2],
    [/,\s*[A-Z]{2}\s\d{5}(?:-\d{4})?\b/g, 5],
    [/\b(?:Office|Suite|Unit|Floor|Level|Building|Bldg|Tower|Villa|Shop|Flat|Apartment|Apt|Room|Plot|Block|Warehouse|Street|Road|Avenue)\s*(?:No\.?|Number|#)?\s*\d{1,6}[A-Za-z]?\b(?![,.]\d)/g, 1],
    [/\b\d{1,6}[A-Za-z]?,?\s+(?:[A-Z][\w'\-]*\s+){0,4}(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Lane|Ln\.?|Drive|Highway|Hwy|Square)(?=[\s,.;]|$)/g, 1]
  ];
  const napSpans = (t) => { const out = []; const s = S(t);
    for (const [re, minDigits] of NAP_RES) for (const m of s.matchAll(re)) if ((m[0].match(/\d/g) || []).length >= minDigits) out.push([m.index, m.index + m[0].length]);
    return out; };
  const strongName = (name, tier) => { const n = S(name).replace(/^the\s+/i, '').replace(/[.,;:]+$/, '').trim(); if (!n) return false; if (OFFICIAL.test(n)) return true;
    if (typeof tier !== 'function') return false; const sq = n.toLowerCase().replace(/'s$/, '').replace(/[^a-z0-9]+/g, ''); return sq.length >= 2 && tier('https://' + sq + '.com/') !== 'weak'; };
  const sources = (md, ctx, opts) => {
    const c = ctx || {}; const o = opts || {}; const M = maxOf(o.max); const tier = typeof o.tier === 'function' ? o.tier : null; const figs = typeof o.figures === 'function' ? o.figures : null;
    const d = S(c.domain).toLowerCase().replace(/^www\./, ''); const own = (h) => !!d && (h === d || h.endsWith('.' + d));
    const ownText = S(c.own_text).toLowerCase();
    const U = units(md).filter(u => u.kind !== 'heading' && !u.qa);
    const linkTier = (u) => { const h = hostOf(u); if (!h || own(h) || SOCIAL.test(h)) return null; return tier ? tier(u) : 'weak'; };
    const linksOf = (t) => [...S(t).matchAll(/\[([^\[\]]*)\]\((https?:\/\/[^)\s]+)\)/g)].map(m => ({ url: m[2], tier: linkTier(m[2]) })).filter(x => x.tier);
    const paraLinks = new Map(); for (const u of U) { const k = u.section + ':' + u.para; const ls = linksOf(u.text); if (ls.length) paraLinks.set(k, (paraLinks.get(k) || []).concat(ls)); }
    // H1: the client's own phone and address on file (own_text: Content QA adds the profile's and the site model's NAP) are theirs in any
    // spelling: the run of digits a figure sits in (spaces, dots, dashes and brackets between them) equals one on file, or the two share
    // their last 7 digits (a number written with and without its country code or trunk 0)
    const ownRuns = [...S(c.own_text).matchAll(/\+?\d[\d\s.()\-]{2,}\d/g)].map(m => m[0].replace(/\D+/g, '')).filter(x => x.length >= 4);
    const runAt = (p, x) => { let a = x.index, b = x.index + S(x.raw).length; while (a > 0 && /[\d\s.()+\-]/.test(p[a - 1])) a--; while (b < p.length && /[\d\s.()\-]/.test(p[b])) b++; return p.slice(a, b).replace(/\D+/g, ''); };
    const ownNum = (p, x) => { if (!ownRuns.length) return false; const dg = runAt(p, x); return dg.length >= 4 && ownRuns.some(o => o === dg || (o.length >= 7 && dg.length >= 7 && o.slice(-7) === dg.slice(-7))); };
    const figureIn = (p) => { if (!figs) return null; const nap = napSpans(p);
      const f = (figs(p) || []).filter(x => x && !x.year && !STD.test(p.slice(Math.max(0, x.index - 16), x.index).trim())
        && !nap.some(([a, b]) => x.index >= a && x.index < b));
      const left = f.filter(x => !(ownText && ownText.includes(S(x.raw).toLowerCase())) && !ownNum(p, x)); return left.length ? left[0] : null; };
    const list = []; let strong = 0, weakOnly = 0, weakCompliance = 0, weakCited = 0, unsourced = 0;
    for (const u of U) {
      const text = plain(u.text); if (!text) continue;
      const links = linksOf(u.text); const fig = figureIn(text);
      const am = text.match(ATTR) || (fig ? text.match(ATTR_FIG) : null); const named = am ? S(am[1] || am[2]) : '';
      if (!links.length && !fig && !named) continue;
      const ls = links.length ? links : (fig ? paraLinks.get(u.section + ':' + u.para) || [] : []);
      const isStrong = ls.some(x => x.tier !== 'weak') || (!!named && strongName(named, tier));
      const onlyWeak = !isStrong && ls.length > 0 && ls.every(x => x.tier === 'weak');
      const unit = { text: text.slice(0, 200), strong: isStrong, figure: fig ? S(fig.raw) : '', named: named.slice(0, 80), weak_only: false, compliance: false };
      if (fig && onlyWeak && FIG_TOPIC.test(text)) { unit.weak_only = true; weakOnly++; if (COMPLIANCE.test(text)) { unit.compliance = true; weakCompliance++; } }
      // M2: a sentence that rests on a weak source (no market / cost / compliance figure of its own) is cited, only not by an authority: half a
      // strong one. A figure resting on nothing at all is unsourced: no credit.
      else if (!isStrong && (ls.length || named)) { unit.weak_cite = true; weakCited++; }
      else if (!isStrong && fig) { unit.unsourced = true; unsourced++; }
      if (isStrong) strong++;
      list.push(unit);
    }
    const n = list.length; const none = M.sources * SHARE.sources_none;
    if (!n) return { units: 0, strong: 0, share: null, weak_only: 0, weak_compliance: 0, weak_cited: 0, unsourced: 0, points: r1(none), capped: false, not_checked: true,
      note: 'Sources not checked: the page cites no outside page and states no figure that needs one (4 of 5 of the part: citing an official body, a research house, major press or vendor documentation earns the rest)', list: [] };
    const share = strong / n;
    // the half credit holds while no market, cost or compliance figure rests only on a weak source: on a page that leans on weak sources for
    // its figures (3336, the expert's 63), its other weak citations are the same problem and earn nothing (PLAN 5.2 pin 2 stays <= 72)
    const half = weakOnly ? 0 : SHARE.weak_cite;
    let pts = clamp(M.sources * (strong + half * weakCited) / n - M.sources * SHARE.weak_figure * weakOnly, 0, M.sources); let capped = false; let floored = false;
    // M2: citing only weak pages is never worse than citing nothing, while no figure on the page is unsourced or weak-only (those cost the share)
    if (!weakOnly && !unsourced && pts < none) { pts = none; floored = true; }
    if (weakCompliance && pts > M.sources * SHARE.sources_compliance) { pts = M.sources * SHARE.sources_compliance; capped = true; }
    return { units: n, strong, share: Math.round(share * 100), weak_only: weakOnly, weak_compliance: weakCompliance, weak_cited: weakCited, unsourced, points: r1(pts), capped, floored,
      note: strong + ' of the ' + n + ' cited sentences and figures rest on an official body, a research house, major press or vendor documentation'
        + (weakCited ? '; ' + weakCited + ' cite' + (weakCited === 1 ? 's' : '') + ' a page with no independent authority (' + (half ? 'half credit' : 'no credit while a figure rests only on such a page') + (floored ? ', and never less than citing nothing' : '') + ')' : '')
        + (unsourced ? '; ' + unsourced + ' figure' + (unsourced === 1 ? ' has' : 's have') + ' no source' : '')
        + (weakOnly ? '; ' + weakOnly + ' market, cost or compliance figure' + (weakOnly === 1 ? ' rests' : 's rest') + ' only on a source with no independent authority' : ''),
      list: list.filter(x => !x.strong).slice(0, 8) };
  };

  // ---------- 4. fit with the search: the verdict, and the page the website already has ----------
  // fitOf(prev): from a content run's Parse Brief item (verdict_score, verdict_acknowledged, hold_exempt / the page's own fields) or from the
  // Finalize brief (prc.gating: score, verdict, verdict_acknowledged). A withheld or missing score is null: "not checked", full points.
  const fitOf = (prev) => {
    const p = prev || {}; const g = ((p.prc || {}).gating) || {};
    const withheld = p.score_withheld === true || g.score_withheld === true || /^NOT_CHECKED$/i.test(S(p.verdict || g.verdict));
    const score = withheld ? null : (num(p.verdict_score) != null ? num(p.verdict_score) : num(g.score));
    const ack = p.verdict_acknowledged === true || g.verdict_acknowledged === true || !!(p.hold_ack && typeof p.hold_ack === 'object');
    const ex0 = S(p.hold_exempt).match(/score:\s*([^;]+)/);
    const ladder = !!S(p.ladder_id) && p.ladder_rung != null && p.ladder_rung !== '';
    const caseStudy = !!S(p.case_id) || S(p.page_role) === 'case_study' || /case stud/i.test(S(p.page_type));
    const aiPage = !!(p.ai_target && typeof p.ai_target === 'object' && S(p.ai_target.question));
    const refresh = !!S(p.existing_page_url);
    const exempt = ex0 ? ex0[1].trim() : caseStudy ? 'a case study: its keyword is the case name' : aiPage ? 'a page written to be cited in AI answers'
      : refresh ? 'a refresh of a page your website already has' : ladder ? 'a page of your keyword ladder: the ladder checked its main keyword when it was planned' : '';
    const automatic = /^(cadence|ladder|tracker|casestudy|audit):/i.test(S(p.client_ip));
    return { verdict_score: score, withheld, acknowledged: ack, exempt, automatic };
  };
  const fit = (f0, dup, max) => {
    const f = f0 || {}; const sc = num(f.verdict_score); const D = dup || {}; const M = Number.isFinite(Number(max)) ? Number(max) : MAX.fit; const half = M / 2;
    const vp = sc == null || sc >= CFG.verdict_bar ? half : sc >= 30 ? half * SHARE.verdict_partial : 0;
    const dp = D.open || D.differs ? 0 : half;
    let pts = vp + dp; const caps = [];
    if (sc != null && sc < CFG.verdict_bar && pts > M * SHARE.fit_verdict) { pts = M * SHARE.fit_verdict; caps.push({ dim: 'fit', share: SHARE.fit_verdict, why: 'our verdict scored this search ' + sc + ' out of 100, under ' + CFG.verdict_bar }); }
    if ((D.open || D.differs) && pts > M * SHARE.fit_duplicate) { pts = M * SHARE.fit_duplicate; caps.push({ dim: 'fit', share: SHARE.fit_duplicate, why: D.open ? 'your website already has a page for this search' : 'published beside the page your website has for this search' }); }
    const band = sc == null ? 'not_checked' : sc >= CFG.verdict_bar ? 'full' : sc >= 30 ? 'partial' : 'none';
    const note = sc == null ? 'Fit not checked: ' + (f.withheld ? 'the verdict could not score this search' : 'no verdict score was kept with this page') + ', so fit takes its full points'
      : 'Our verdict scored this search ' + sc + ' out of 100' + (sc < CFG.verdict_bar ? (f.acknowledged ? ', and you chose to write it anyway' : f.exempt ? ' (' + f.exempt + ')' : '') : '');
    return { points: r1(pts), verdict_points: r1(vp), duplicate_points: r1(dp), band, caps, note };
  };

  // ---------- 4b. W06-A: what the run took out of the page ----------
  // rm: { sections, words, words_before, h2_before, h2_removed, h2_now, headings } (EXC.removedOf on the page run's state, plus the page's
  // H2 count now). Sections the edits lost count too (the H2s of the first draft that are neither on the page nor deleted on purpose).
  // Two sections or a fifth of the words taken out cap coverage and fit at 40% of their parts: on the live K1 page (W05 run) six core
  // sections went and the grade still read fit 20 of 20, "Ready".
  const removedCap = (rm, max) => {
    const R = rm && typeof rm === 'object' ? rm : null; if (!R) return null; const M = maxOf(max);
    const excl = Math.max(0, Number(R.sections) || 0);
    const byEdits = Number(R.h2_before) > 0 && R.h2_now != null && Number.isFinite(Number(R.h2_now)) ? Math.max(0, Number(R.h2_before) - (Number(R.h2_removed) || 0) - Number(R.h2_now)) : 0;
    const share = Number(R.words_before) > 0 && Number(R.words) > 0 ? Number(R.words) / Number(R.words_before) : 0;
    const n = excl + byEdits;
    if (n < CFG.removed.sections && share < CFG.removed.share) return null;
    const pct = Math.round(share * 100);
    const why = (excl ? excl + ' section' + (excl === 1 ? ' was' : 's were') + ' taken out as a topic the verdict said to leave out' : '')
      + (excl && byEdits ? ', and ' : '') + (byEdits ? byEdits + ' section' + (byEdits === 1 ? ' was' : 's were') + ' lost in editing' : '') + (pct ? ' (' + pct + '% of the words)' : '');
    return { limit: { coverage: M.coverage * SHARE.removed, fit: M.fit * SHARE.removed }, why: clean(why),
      note: clean('Coverage and fit are limited to ' + Math.round(SHARE.removed * 100) + '% of their points: ' + why + ', so the page no longer covers what its search asks. Write the missing sections back, or start a new page run'),
      record: { sections: excl, by_edits: byEdits, words: Number(R.words) || 0, share_pct: pct, headings: (Array.isArray(R.headings) ? R.headings : []).slice(0, 8), capped: true } }; };

  // ---------- 5. the page-local grade (Content QA) ----------
  // parts: what Content QA already measures, as fractions or on their old scales: structure_frac (0-1), coverage_ratio (0-1),
  // readability_pts (of 15), specificity_pts (of 10), clean_pts (of 10). ctx: keyword, brand_names, domain, own_text, prev (the brief item).
  // opts: tier / figures (Content QA's SRC kit), max (a page-type weighting; the default is MAX).
  const local = (parts, md, ctx, opts) => {
    const P = parts || {}; const c = ctx || {}; const o = opts || {}; const M = maxOf(o.max);
    const rep = repetition(md, c); const lab = listLabels(md); const src = sources(md, c, { ...o, max: M }); const F = fitOf(c.prev || {}); const fi = fit(F, null, M.fit);
    const caps = fi.caps.slice();
    let structure = clamp(M.structure * clamp(Number(P.structure_frac) || 0, 0, 1) - Math.min(8, 3 * rep.count) * M.structure / 20 - Math.min(4, 2 * lab.count) * M.structure / 20, 0, M.structure);
    if (rep.worst >= CFG.cluster_cap && structure > M.structure * SHARE.structure_repeat) { structure = M.structure * SHARE.structure_repeat; caps.push({ dim: 'structure', share: SHARE.structure_repeat, why: 'one statement is made ' + rep.worst + ' times' }); }
    // W06-A: an idea restated 4+ times that the statement check did not already count costs 2 points of structure (up to 4), never below
    // half the part, so it alone never turns a page into "Needs work"
    const idw = ideas(md, c); const seenRep = new Set(rep.clusters.flatMap(x => x.members || []).map(x => S(x).slice(0, 60)));
    const idNew = idw.ideas.filter(x => !x.members.some(m => seenRep.has(S(m).slice(0, 60))));
    let ideaCut = 0;
    if (idNew.length) { const want = Math.min(CFG.idea.max_points, CFG.idea.points * idNew.length) * M.structure / 20; const room = Math.max(0, structure - M.structure * CFG.floor);
      ideaCut = Math.min(want, room); structure -= ideaCut; }
    const RM = removedCap(c.removed, M);
    if (src.capped) caps.push({ dim: 'sources', share: SHARE.sources_compliance, why: 'a compliance figure rests only on a source with no independent authority' });
    const raw = { structure, coverage: M.coverage * clamp(Number(P.coverage_ratio) || 0, 0, 1), readability: M.readability * clamp((Number(P.readability_pts) || 0) / 15, 0, 1),
      specificity: M.specificity * clamp((Number(P.specificity_pts) || 0) / 10, 0, 1), clean_language: M.clean_language * clamp((Number(P.clean_pts) || 0) / 10, 0, 1), sources: src.points, fit: fi.points, length: 0 };
    if (RM) for (const k of ['coverage', 'fit']) if (raw[k] > RM.limit[k]) { raw[k] = RM.limit[k]; caps.push({ dim: k, share: SHARE.removed, why: RM.why }); }
    const breakdown = {}; for (const k of Object.keys(raw)) breakdown[k] = Math.round(raw[k]);
    const notes = [fi.note, src.note, 'Length is advice only: it carries no points'];
    if (rep.count) notes.push(rep.count + ' statement' + (rep.count === 1 ? ' is' : 's are') + ' made three or more times: ' + rep.clusters.slice(0, 3).map(x => '"' + x.sample + '" (' + x.size + ' times)').join('; '));
    if (idNew.length) notes.push(idNew.length + ' idea' + (idNew.length === 1 ? ' is' : 's are') + ' restated four or more times in different places' + (ideaCut ? ' (' + r1(ideaCut) + ' point' + (r1(ideaCut) === 1 ? '' : 's') + ' off structure)' : '') + ': '
      + idNew.slice(0, 2).map(x => '"' + x.sample.slice(0, 110) + '" (' + x.size + ' times)').join('; ') + '. Say it once where the reader decides, and point back to it');
    if (RM) notes.push(RM.note);
    if (lab.count) notes.push('The same label introduces two different lists: ' + lab.collisions.map(x => '"' + x.lead + '"').join(', '));
    return { version: VERSION, score: DIMS.reduce((s, k) => s + breakdown[k], 0), of: 100, breakdown, max: M, caps,
      items: { repetition: { count: rep.count, worst: rep.worst, clusters: rep.clusters.slice(0, 5) }, list_labels: lab.collisions,
        ideas: { count: idNew.length, points_off: r1(ideaCut), ideas: idNew.slice(0, 4) }, ...(RM ? { removed: RM.record } : {}),
        sources: { units: src.units, strong: src.strong, share: src.share, weak_only: src.weak_only, weak_compliance: src.weak_compliance, weak_cited: src.weak_cited, unsourced: src.unsourced, not_checked: !!src.not_checked, weak: src.list },
        fit: { verdict_score: F.verdict_score, band: fi.band, acknowledged: F.acknowledged, exempt: F.exempt, automatic: F.automatic, verdict_points: fi.verdict_points, duplicate_points: fi.duplicate_points } },
      notes: notes.map(clean) };
  };

  // ---------- 6. the delivered grade: blockers, the duplicate page, the floors (Page Candidates, Finalize Verdict, Apply Second Read) ----------
  // grade0: the grade object those nodes build (score / breakdown from Content QA's content_score / score_breakdown; `w0c` = Content QA's
  // grade_detail). blocking: the delivered blocking items ({ code }). o.decision: the client's duplicate-page decision (W0-B, D2).
  // A grade without `w0c` (a check from before this kit) is returned as it was, with its display.
  // W05-A (wave 0.5, 2026-10-30, BEFORE_AFTER.md): what the blind second read found that is not a factual error (an uncited contrast, a
  // figure that wants a source, a vague market figure, a law with no link, a statistics note, a repeated point) is ADVICE: it never caps
  // the total at 59 (only a blocker does), it takes points off the part it is about. Each advice item the client is shown costs 3 points
  // (high) or 1.5 (medium) of its part, at most a quarter of the part, and never below half the part: advice alone never turns a page into
  // "Needs work" (the floors judge what Content QA measured). Only an enforced read counts (shadow mode, the system's own runs and the
  // client's keyword ladder, records it and changes nothing: the guide that ranks, a ladder page, is never marked down by it).
  // o.review: the read's record (content_qa.critic_reread: { mode, status, advice: [{ severity, kind }] }); the deduction is kept on the
  // grade (review.advice) so a later cap of the same grade applies it once, from the parts before it (pre_review).
  const REVIEW_DIM = { fact: 'sources', source: 'sources', claim: 'sources', local: 'sources', repetition: 'structure', structure: 'structure', link: 'structure',
    depth: 'specificity', intent: 'fit', style: 'clean_language' };
  const REVIEW_PTS = { high: 3, medium: 1.5 };
  const reviewCut = (rv, b, M) => {
    const R = rv || {}; if (R.mode !== 'enforce' || (R.status && R.status !== 'checked')) return null;
    const items = (Array.isArray(R.advice) ? R.advice : []).filter(a => a && REVIEW_DIM[S(a.kind)] && REVIEW_PTS[S(a.severity)]).map(a => ({ kind: S(a.kind), severity: S(a.severity) }));
    if (!items.length) return null;
    const want = {}; for (const a of items) { const k = REVIEW_DIM[a.kind]; want[k] = (want[k] || 0) + REVIEW_PTS[a.severity]; }
    const cut = {}; let total = 0;
    for (const k of Object.keys(want)) { if (!M[k]) continue; const room = Math.max(0, (Number(b[k]) || 0) - M[k] * CFG.floor);
      const c = Math.floor(Math.min(want[k], M[k] * CFG.review_share, room)); if (c > 0) { cut[k] = c; total += c; } }
    const parts = Object.keys(cut).map(k => LABEL[k] + ' -' + cut[k]);
    return { mode: 'enforce', status: 'checked', advice: items, cut, total,
      note: clean('A second read of the page found ' + items.length + ' thing' + (items.length === 1 ? '' : 's') + ' to improve before publishing' + (total ? ': ' + total + ' point' + (total === 1 ? '' : 's') + ' off (' + parts.join(', ') + ')' : ', already reflected in the parts')) }; };
  const cap = (grade0, blocking, o0) => {
    const g = { ...(grade0 || {}) }; const o = o0 || {}; const W = g.w0c || o.w0c || null;
    if (!W || !g.breakdown || g.score == null) return { ...g, display: display(g.score) };
    const M = maxOf(W.max); const b = { ...(g.pre_review && typeof g.pre_review === 'object' ? g.pre_review : g.breakdown) }; const caps = (W.caps || []).slice(); const F = (W.items || {}).fit || {};
    const codes = (blocking || []).map(x => S(x && x.code)).filter(Boolean);
    const dupOpen = codes.includes('duplicate_page'); const differs = !!(o.decision && o.decision.choice === 'differs');
    if (dupOpen || differs) { const fi = fit(F, { open: dupOpen, differs }, M.fit); for (const x of fi.caps) if (!caps.some(y => y.dim === x.dim && y.share === x.share)) caps.push(x); b.fit = Math.round(fi.points); }
    // W06-A: sections the run took out of the page cap coverage and fit (from the page run's state here, or the check's own record)
    const RMc = o.removed ? removedCap(o.removed, M) : null;
    const RMrec = RMc ? RMc.record : (g.removed && g.removed.capped ? g.removed : ((W.items || {}).removed && (W.items || {}).removed.capped ? W.items.removed : null));
    if (RMc) for (const k of ['coverage', 'fit']) { const lim = Math.round(RMc.limit[k]); if ((Number(b[k]) || 0) > lim) { b[k] = lim; if (!caps.some(y => y.dim === k && y.share === SHARE.removed)) caps.push({ dim: k, share: SHARE.removed, why: RMc.why }); } }
    // W05-A: the second read's advice, off its parts (from the parts before it, so it is applied once)
    const pre = { ...b }; const rv = reviewCut(o.review !== undefined ? o.review : (g.review && Array.isArray(g.review.advice) ? g.review : null), b, M);
    if (rv) for (const k of Object.keys(rv.cut)) b[k] = (Number(b[k]) || 0) - rv.cut[k];
    let total = DIMS.reduce((s, k) => s + (Number(b[k]) || 0), 0);
    if (codes.length && total > CFG.blocker_cap) { total = CFG.blocker_cap; caps.push({ dim: 'total', to: CFG.blocker_cap, why: codes.length + ' point' + (codes.length === 1 ? '' : 's') + ' still stop' + (codes.length === 1 ? 's' : '') + ' this page' }); }
    const failing = [], waived = [], shadow = [];
    for (const k of DIMS) {
      if (!M[k] || (Number(b[k]) || 0) >= M[k] * CFG.floor) continue;
      if (k === 'fit' && !dupOpen && !differs && !RMrec && (F.acknowledged || F.exempt)) { waived.push({ dim: k, why: F.acknowledged ? 'your choice: low search demand (you chose to write it anyway)' : 'chosen by your plan: ' + F.exempt }); continue; }
      if (k === 'fit' && !dupOpen && !differs && !RMrec && F.automatic) { shadow.push({ dim: k, why: 'started automatically: recorded, not applied yet' }); continue; }
      failing.push({ dim: k, label: LABEL[k], points: Number(b[k]) || 0, max: M[k], fix: clean(FIX[k](RMrec ? { ...W, items: { ...(W.items || {}), removed: RMrec } } : W)) });
    }
    const score = Math.round(total);
    const R0 = { ...g }; delete R0.review; delete R0.pre_review;
    return { ...R0, ...(rv ? { review: rv, pre_review: pre } : {}), ...(RMrec ? { removed: RMrec } : {}), score, display: display(score), breakdown: b, max: M, scale: VERSION, caps,
      floors: { ok: failing.length === 0, failing, waived, shadow, rule: 'Ready needs no open blocker and every part at or above half its points' },
      ready: codes.length === 0 && failing.length === 0 };
  };
  const FIX = {
    structure: (W) => { const r = ((W.items || {}).repetition || {}); const l = (W.items || {}).list_labels || []; const id = ((W.items || {}).ideas || {});
      return r.count ? 'Say each point once: "' + S((r.clusters || [])[0] && r.clusters[0].sample).slice(0, 90) + '" is made ' + r.worst + ' times'
        : l.length ? 'Give each list its own label: "' + S(l[0].lead).slice(0, 90) + '" introduces two lists'
          : id.count ? 'Say each idea once: "' + S((id.ideas || [])[0] && id.ideas[0].sample).slice(0, 90) + '" is restated ' + ((id.ideas || [])[0] || {}).size + ' times' : 'Give the page its headings, Quick answer, table and links back'; },
    coverage: (W) => (((W.items || {}).removed || {}).capped ? 'Write back the sections this run took out (' + S((((W.items || {}).removed || {}).headings || []).slice(0, 3).join('; ')).slice(0, 160) + '), or start a new page run' : 'Cover the topics the pages that rank cover (the missing terms are in the advice)'),
    readability: () => 'Use shorter sentences and plainer words',
    specificity: () => 'Add concrete examples, steps or decision rules in place of general statements',
    clean_language: () => 'Rewrite the filler phrases listed in the advice in plain, specific words',
    sources: (W) => { const s = ((W.items || {}).sources || {}); return 'Cite an official body, a research house, major press or vendor documentation'
      + ((s.weak || []).length ? ' for "' + S(s.weak[0].text).slice(0, 90) + '"' + (s.weak.length > 1 ? ' and ' + (s.weak.length - 1) + ' more' : '') : ''); },
    fit: (W) => { const f = ((W.items || {}).fit || {}); if (((W.items || {}).removed || {}).capped) return 'The page lost the sections that answer its search: write them back, or start a new page run'; return f.verdict_score != null && f.verdict_score < CFG.verdict_bar ? 'Our verdict scored this search ' + f.verdict_score + ' out of 100: improve a page your website already has, or choose "Write it anyway" to keep this one' : 'Publish this text as an update of the page your website has for this search'; }
  };
  // the delivered status: a page with no blocker that fails a floor is "Needs work: <parts>", never "Ready to publish". It stays publishable
  // (nothing stops the client): the status and label change, the items say what to improve, and a not-ready page is left as it is.
  const deliver = (del0, grade) => {
    const del = { ...(del0 || {}) }; const fl = (grade || {}).floors || null;
    if (!fl || fl.ok || del.status === 'not_ready') return del;
    const parts = fl.failing.map(x => x.label);
    return { ...del, status: 'needs_work', label: clean('Needs work: ' + parts.join(', ')),
      needs_work: fl.failing.map(x => ({ code: 'needs_work', dim: x.dim, text: clean(x.label.charAt(0).toUpperCase() + x.label.slice(1) + ' scored ' + x.points + ' of ' + x.max + ', under half its points'), action: x.fix })),
      next_step: clean('Nothing stops you publishing this page, but ' + (parts.length === 1 ? 'one part is' : parts.length + ' parts are') + ' under half marks (' + parts.join(', ') + '). '
        + fl.failing.map(x => x.fix.replace(/[.\s]+$/, '')).join('. ') + '. Change it in the editor and make the final version, or approve it as it is.') };
  };
  const display = (n) => n == null || n === '' || !Number.isFinite(Number(n)) ? '' : Math.round(Number(n)) >= CFG.display_top ? CFG.display_top + '+' : String(Math.round(Number(n)));
  const basis = 'structure 20 (a statement made three or more times and one label for two lists cost points), topic coverage 15, readability 10, specificity 10, plain language 10, sources 15, fit with the search 20; length is advice only';
  return { VERSION, MAX, DIMS, LABEL, SHARE, CFG, REVIEW_DIM, REVIEW_PTS, reviewCut, units, repetition, ideas, listLabels, sources, fitOf, fit, removedCap, local, cap, deliver, display, basis };
})();
// W0-H (2026-10-29, page-quality PLAN Fix 3b; build section 158): what the blind second read found, on the delivered page. A high-severity
// problem whose quoted words are on the page and that is a factual error the page states (W05-A, wave 0.5: a count that does not match its
// list, an unsupported claim about the business, a statement its own source contradicts, a wrong or out-of-date fact or rule) is a soft
// blocker in enforce mode (runs a person started) and reported advice in shadow mode (runs the system started by itself, D17); every other
// problem it could show is advice that takes points off its part of the grade (GR.cap review, never the 59 cap); a
// refused, cut, failed or unreadable answer is "not checked", never a pass and never a block. The grade changes here only by the blocker
// cap and the advice deduction (GR.cap); the item goes on to Build Word File exactly as Page Candidates delivered it, with content_qa updated.
const it = $('Second Read Plan').first().json || {};
const plan = it.second_read && typeof it.second_read === 'object' ? it.second_read : { skip: true, reason: 'the second read was not planned' };
const resp = plan.skip ? {} : ($input.first().json || {});
const rr = RR.read(resp, String(it.output || ''), plan, PF);
const content_qa = RR.apply(it.content_qa || {}, rr, PF);
// W0-C (2026-10-29, page-quality PLAN Fix 3): a problem the second read made blocking is an open blocker like any other, so the grade takes
// the blocker cap again (GR.cap recomputes from the parts, so a grade already capped is never capped twice)
{ const D = content_qa.delivery;
  if (D && D.grade && typeof D.grade === 'object' && content_qa.grade_detail) {
    // W05-A (wave 0.5): what the read found that is not a factual error is advice and takes points off its part (enforce mode only)
    const g = GR.cap(D.grade, D.blocking || [], { w0c: content_qa.grade_detail, review: content_qa.critic_reread || null });
    content_qa.delivery = { ...D, grade: g };
    // the grade NUMBER only: the verdict fields (publishable, not_ready, label, reasons) are RR.apply's and are not touched here
    const Q = content_qa.quality; if (Q && typeof Q === 'object') Object.assign(content_qa, { quality: { ...Q, grade: g } }); } }
const out = { ...it, content_qa };
delete out.second_read;
return [{ json: out }];
