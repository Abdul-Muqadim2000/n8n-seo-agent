// ---- FA: the client's answers to the questions on written pages, kept once per website (H3, 2026-10-28; inlined through the FACT_ANSWERS marker) ----
// The page pipeline (H1, v5/code/_page_fix.js PF.questions) asks the client about every statement nothing on file supports, keyed by a
// business-fact key (`fact_key`, e.g. "credential.microsoft_partner"). The app stores each answer ONCE on the website (app: sites.fact_answers;
// engine: seo_sites.fact_answers_json, written by Site Admin `facts`) and every later page run carries:
//   business_facts_kv   fact_key -> the text the client confirmed or wrote (decisions yes / edit / answer): the claim check reads it as on file
//   stored_fact_keys    every key the client decided, including remove and general: PF.questions never asks it again
// The same rule as the app's factsForEngine (app/shared/src/page-review.ts): the two must change together.
// Pure: no clock, no network, no URL constructor, no Object.defineProperty, no structuredClone (n8n sandbox rules).
const FA = (() => {
  const KEY = /^[\p{L}\p{N}_.&-]{1,80}$/u;
  const DECISIONS = ['yes', 'edit', 'answer', 'remove', 'general'];
  const TEXT_MAX = 600, KV_MAX = 200, KEYS_MAX = 400;
  const S = (v) => String(v == null ? '' : v);
  const clean = (t) => S(t).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  const asObj = (raw) => { let o = raw; if (typeof o === 'string') { try { o = JSON.parse(o || '{}'); } catch (e) { o = null; } }
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null; };
  // { key: { decision, text } } from the stored JSON (or an object); entries with a bad key or decision are dropped and counted
  const parse = (raw) => { const o = asObj(raw); const answers = {}; let dropped = 0; if (!o) return { answers, dropped };
    for (const [k, v] of Object.entries(o).slice(0, KEYS_MAX)) {
      const decision = v && typeof v === 'object' ? S(v.decision).toLowerCase() : 'yes';
      const text = clean(v && typeof v === 'object' ? v.text : v).slice(0, TEXT_MAX);
      if (!KEY.test(k) || !DECISIONS.includes(decision) || ((decision === 'yes' || decision === 'edit' || decision === 'answer') && !text)) { dropped++; continue; }
      answers[k] = { decision, text: decision === 'remove' || decision === 'general' ? '' : text }; }
    return { answers, dropped }; };
  // the facts a page may state, and every decided key
  const kv = (answers) => { const out = {}; for (const [k, v] of Object.entries(answers || {})) if (v && v.text && (v.decision === 'yes' || v.decision === 'edit' || v.decision === 'answer')) out[k] = v.text; return out; };
  const keys = (answers) => Object.keys(answers || {}).filter(k => KEY.test(k)).sort().slice(0, KEYS_MAX);
  // what a request carries (Normalize Input): validated and capped; a malformed value is an empty one, never an error for the whole run
  const kvIn = (raw) => { const o = asObj(raw); const out = {}; if (!o) return out; let n = 0;
    for (const [k, v] of Object.entries(o)) { if (n >= KV_MAX) break; const t = clean(v).slice(0, TEXT_MAX); if (!KEY.test(k) || !t || typeof v === 'object') continue; out[k] = t; n++; }
    return out; };
  const keysIn = (raw) => { const a = Array.isArray(raw) ? raw : typeof raw === 'string' && raw.trim() ? raw.split(/[,\n]/) : [];
    return [...new Set(a.map(x => clean(x)).filter(k => KEY.test(k)))].slice(0, KEYS_MAX); };
  // the two fields a page run spawned from a stored website row carries
  const forRun = (siteRow) => { const a = parse(siteRow && siteRow.fact_answers_json).answers; return { business_facts_kv: kv(a), stored_fact_keys: keys(a) }; };
  // the stored facts as text, one per line, for the claim corpus
  const text = (kvObj) => Object.values(kvObj || {}).map(clean).filter(Boolean).join('\n');
  return { KEY, DECISIONS, TEXT_MAX, parse, kv, keys, kvIn, keysIn, forRun, text, clean };
})();
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
    // W07-B (2026-10-31): a separate new page beside a page the client kept says so to everyone who writes or reviews it (only then)
    const apart = typeof PGA !== 'undefined' ? PGA.contractLine(PGA.of(p)) : '';
    if (apart) rules.push(apart);
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
    // i. W07-B (2026-10-31, WAVE06 section 10, K1): a separate new page written beside a page the client kept ("Write it anyway") gets a
    //    title tag and an H1 of its own (never the kept page's, word for word or nearly) and one link to the kept page where it helps the
    //    reader. The kit (_page_apart.js) is inlined where the run writes a page; a node without it (Finalize) changes nothing here.
    if (c.apart && typeof PGA !== 'undefined') { const A = PGA.fix(md, c.apart, { keyword: kw, business: c.business, brand: c.brand, brief_title: c.brief_title, brief_h1: c.brief_h1,
      title_variants: c.title_variants, split, join }); md = A.md; fixes.push(...A.fixes); }
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
    // W07-B (2026-10-31, WAVE06 section 10 finding 1): a separate new page whose title tag is still the title tag (or main heading) of the page
    // the client kept beside it competes with that page for one search; PF.fix gives it a title of its own, so this blocks only when no
    // title of its own could be written. The same main heading alone is advice.
    { const PI = qa.page_identity && typeof qa.page_identity === 'object' ? qa.page_identity : null; const sa = PI && PI.same_as ? PI.same_as : null;
      if (PI && PI.title_same) B('same_title', 'The meta title is the same as the ' + (sa && sa.field === 'h1' ? 'main heading' : 'title tag') + ' of your existing page ' + S((sa && sa.url) || PI.url) + ', so the two pages would compete for one search', 'hard');
      else if (PI && PI.h1_same) A('same_h1', 'The main heading is the same as your existing page ' + S((sa && sa.url) || PI.url) + '\'s: give this page a heading of its own', 0.5); }
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
    same_title: 'give this page a title tag of its own, different from your existing page\'s',   // W07-B
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
      critique: o.critique || null, qa_marks: o.qa_marks || [], qa_figure_marks: o.qa_figure_marks || [],
      // W07-B: the page the client kept beside this one, and the brief's own title lines to choose a title of its own from
      apart: typeof PGA !== 'undefined' ? PGA.of(p) : null, brief_title: S(b.meta_title).trim(), brief_h1: S(b.h1).trim(), title_variants: Array.isArray(b.title_variants) ? b.title_variants.map(S) : [] }; };
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
// H3 (2026-10-28, page review; docs/content-quality-2026-10-27): "Make the final version". `POST /webhook/seo-page-finalize` takes a page the
// engine already delivered (or the client's own edited version of it), the client's answers to the page's questions and the business facts,
// and returns the final page: no new research, no new full write, only the affected sections touched. The request is the app's FinalizeBody
// (app/shared/src/page-review.ts). This node plays the part *Parse Brief* plays in a content run (Content QA reads its context as
// `$('Parse Brief')`, exactly as in the Publish Check, B3-7) and it answers the caller's field errors (400).
// What the claim check treats as on file here: the business facts, the facts stored from earlier answers (business_facts_kv), the texts the
// client confirmed or wrote in THIS request (yes / edit / answer), and every sentence the client wrote in the page themself (the client is the
// source of what the client says about the client). Nothing here calls a model, fetches a page or writes a row.
const raw = $input.first().json || {};
const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : (raw && typeof raw === 'object' && raw.markdown != null ? raw : {});
const S = (v) => String(v == null ? '' : v);
const errors = [];
const LIM = { markdown_chars: 200000, answers: 400, text: 600, short: 2000, facts_chars: 5000 };
const DECISIONS = ['yes', 'edit', 'remove', 'general', 'answer', 'skip'];
const SOURCES = ['claim', 'brief', 'bracket'];
const META = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;
const clean = (t) => S(t).replace(/\s*[\u2014\u2013]\s*/g, ': ').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2026/g, '...').replace(/\s+/g, ' ').trim();

if (b.mode != null && S(b.mode) !== 'finalize') errors.push('mode must be finalize');
const markdown = S(b.markdown).replace(/\r\n?/g, '\n');
if (!markdown.trim()) errors.push('markdown is required: the delivered page (or your edited version of it) as Markdown');
else if (markdown.length > LIM.markdown_chars) errors.push('markdown is longer than ' + LIM.markdown_chars + ' characters');
else if (markdown.split(/\s+/).filter(Boolean).length < 50) errors.push('markdown has fewer than 50 words: there is no page to finalise');
const delivered = S(b.delivered_markdown).replace(/\r\n?/g, '\n');
if (delivered.length > LIM.markdown_chars) errors.push('delivered_markdown is longer than ' + LIM.markdown_chars + ' characters');
const domain = S(b.domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
if (!domain) errors.push('domain is required');
else if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) errors.push('domain must be a host name such as example.com');
const meta = (b.meta && typeof b.meta === 'object' && !Array.isArray(b.meta)) ? b.meta : {};
if (b.meta != null && (typeof b.meta !== 'object' || Array.isArray(b.meta))) errors.push('meta must be an object { title, meta_description, slug, h1 }');
const h1Of = (markdown.match(/^# (.+)$/m) || [])[1] || '';
const keyword = S(b.keyword).trim().replace(/\s+/g, ' ') || S(meta.h1 || h1Of).trim().toLowerCase().slice(0, 120);
if (!keyword) errors.push('keyword is required: the search the page is written for');
else if (keyword.length > 120) errors.push('keyword is longer than 120 characters');
const facts = S(b.business_facts);
if (facts.length > LIM.facts_chars) errors.push('business_facts is longer than ' + LIM.facts_chars + ' characters');
if (b.business_facts_kv != null && (typeof b.business_facts_kv !== 'object' || Array.isArray(b.business_facts_kv))) errors.push('business_facts_kv must be an object fact_key -> text');
if (b.stored_fact_keys != null && !Array.isArray(b.stored_fact_keys)) errors.push('stored_fact_keys must be an array of fact keys');
const kv = FA.kvIn(b.business_facts_kv);
const stored = FA.keysIn(b.stored_fact_keys);

// W0-B (2026-10-29, page-quality PLAN Fix 2, REVIEW_CODE H2 / M8, owner decision D2): the PAGE-RUN CONTEXT (PRC, harness/README.md) of
// the page this final version is made from. The final version of production page 3299 (finalize 3336) was graded against itself: no
// facts, no terms, no length band, its own word count as the target, and the page run's blocker ("this website already has a page for the
// same search") never reached it, so it came back "Ready" at 100. The app now sends `page_run`, derived from the ORIGINAL report:
//   * gating fields (in every stored report): qa_blocking, duplicate_targets, verdict, score, score_withheld, page_type,
//     verdict_acknowledged, plus copied_passages (the passages the first check found repeated from another page). The two that carry a
//     block (qa_blocking, duplicate_targets) are required: without them nothing can say the page is ready. The others have the contract's
//     defaults (null / false / '') and never block, so a page whose verdict was not stored (the ranking guide of exec 949) is not held back;
//   * grading fields (page runs from W0-B on): length_band, coverage_target, terms, facts, sources_cited, style_guide, site_urls,
//     serp_shapes, regulatory_facts (+ regulatory_topics), content_request_id. A missing one is advice "not checked", never a block.
// `duplicate_decision` is the client's explicit answer to the duplicate-page blocker (D2): `update` of one of the pages the first check
// named (the final version is then the new text of that page: its address and slug), or `differs` with the reason, which is recorded
// and shown; the fit limit stays in the grade.
const LIMP = { blockers: 40, dups: 10, passages: 20, terms: 80, facts: 40, sources: 30, urls: 300, reg: 40 };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const httpUrl = (u) => /^https?:\/\/[^\s<>"]+$/i.test(S(u).trim()) ? S(u).trim().slice(0, 600) : '';
const pageKey = (u) => S(u).trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
const PRC_BLOCK = ['qa_blocking', 'duplicate_targets'];
// W06-C (2026-10-30, WAVE06 Open 1): `sections_removed` (what the page run took out of the page: sections deleted as a topic the verdict
// said to leave out, H2s the edits lost, their share of the words and why) is a grading field: a report from before it is "not checked"
const PRC_GRADING = ['length_band', 'coverage_target', 'terms', 'facts', 'sources_cited', 'style_guide', 'site_urls', 'serp_shapes', 'regulatory_facts', 'sections_removed'];
const pr = isObj(b.page_run) ? b.page_run : null;
if (b.page_run != null && !pr) errors.push('page_run must be an object (the context of the page run the page came from)');
// M3 (WAVE0_REVIEW 2026-10-30): a request with NO page_run at all comes from an app built before W0-B, so the engine can be deployed before
// the app. Its gating fields are derived here from the original report as far as the request carries it: the page type, and the page the
// report delivered (`delivered_markdown`, else this text), whose own blockers (a cut page, the meta, statements, figures, guarantees,
// testimonials, brackets, weak-only figures) this check measures again on this version (Finalize Verdict's RECHECKED codes), so
// qa_blocking starts empty and is known. What only the first check could see stays unknown: a page the website already has for the same
// search, passages copied from another page, a dead link. That is not a blocker (it made every final version "not ready, 59" until the
// app was deployed): the version is "Needs work: the first check was not read", with what to do, and never "Ready to publish" (W0B3).
// A page_run that is sent but lacks a gating field is still a block: that app knows the contract.
const legacy = b.page_run == null;
const prc = (() => {
  const g = pr || (legacy ? { qa_blocking: [], page_type: S(b.page_type).trim() } : {});
  const told = Array.isArray(g.missing) ? g.missing.map(x => S(x).trim()).filter(Boolean) : [];
  const gating_missing = [];
  const blk = Array.isArray(g.qa_blocking) && !told.includes('qa_blocking') ? g.qa_blocking.filter(isObj).slice(0, LIMP.blockers)
    .map(x => ({ code: S(x.code).trim().slice(0, 40) || 'other', text: clean(x.text).slice(0, 600), action: clean(x.action).slice(0, 300),
      ...(Array.isArray(x.urls) ? { urls: x.urls.map(httpUrl).filter(Boolean).slice(0, 5) } : {}) })) : null;
  if (!blk) gating_missing.push('qa_blocking');
  const dups = Array.isArray(g.duplicate_targets) && !told.includes('duplicate_targets') ? g.duplicate_targets.filter(isObj).map(x => ({ url: httpUrl(x.url), title: clean(x.title).slice(0, 200),
    keyword_words_shared_pct: Number.isFinite(Number(x.keyword_words_shared_pct)) ? Number(x.keyword_words_shared_pct) : null })).filter(x => x.url).slice(0, LIMP.dups) : null;
  if (!dups) gating_missing.push('duplicate_targets');
  const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const gating = { qa_blocking: blk || [], duplicate_targets: dups || [],
    verdict: S(g.verdict).trim().toUpperCase().slice(0, 30) || null, score: num(g.score), score_withheld: g.score_withheld === true,
    page_type: S(g.page_type).trim().slice(0, 60), verdict_acknowledged: g.verdict_acknowledged === true,
    copied_passages: (Array.isArray(g.copied_passages) ? g.copied_passages : []).map(x => S(x).replace(/\s+/g, ' ').trim()).filter(x => x.split(' ').length >= 6).map(x => x.slice(0, 400)).slice(0, LIMP.passages) };
  // the grading fields, each read only when it has the contract's shape
  const lb = isObj(g.length_band) && Number(g.length_band.low) > 0 && Number(g.length_band.high) >= Number(g.length_band.low)
    ? { low: Math.round(Number(g.length_band.low)), high: Math.round(Number(g.length_band.high)), source: S(g.length_band.source) || 'ranking_pages', sample: Number(g.length_band.sample) || 0,
      basis: clean(g.length_band.basis).slice(0, 400), target: Number(g.length_band.target) > 0 ? Math.round(Number(g.length_band.target)) : null } : null;
  const terms = Array.isArray(g.terms) ? g.terms.map(t => typeof t === 'string' ? { term: t } : (isObj(t) ? t : null)).filter(t => t && S(t.term).trim())
    .map(t => ({ term: S(t.term).trim().toLowerCase().slice(0, 80), min_count: Math.max(1, Math.min(20, Number(t.min_count) || 1)) })).slice(0, LIMP.terms) : null;
  const factsIn = Array.isArray(g.facts) ? g.facts.filter(isObj).map(f => ({ claim: S(f.claim).replace(/\s+/g, ' ').trim().slice(0, 600), source: S(f.source).trim().slice(0, 120),
    url: httpUrl(f.url), title: S(f.title).replace(/\s+/g, ' ').trim().slice(0, 200), ...(f.regulatory ? { regulatory: true } : {}) })).filter(f => f.claim || f.url).slice(0, LIMP.facts) : null;
  const cited = Array.isArray(g.sources_cited) ? g.sources_cited.filter(isObj).map(x => ({ anchor: S(x.anchor).replace(/\s+/g, ' ').trim().slice(0, 200), url: httpUrl(x.url),
    host: S(x.host).trim().slice(0, 120), tier: x.tier == null ? null : (typeof x.tier === 'number' ? x.tier : S(x.tier).slice(0, 30)) })).filter(x => x.url).slice(0, LIMP.sources) : null;
  const siteUrls = Array.isArray(g.site_urls) ? g.site_urls.map(httpUrl).filter(Boolean).slice(0, LIMP.urls) : null;
  const regFacts = Array.isArray(g.regulatory_facts) ? g.regulatory_facts.filter(isObj).slice(0, LIMP.reg) : null;
  const regTopics = Array.isArray(g.regulatory_topics) ? g.regulatory_topics.filter(isObj).map(t => ({ id: S(t.id).slice(0, 60), relevance: S(t.relevance).slice(0, 20) })).filter(t => t.id).slice(0, 12) : null;
  // W06-C: what the page run took out of the page (Build Webhook Response `page_run.sections_removed`), read only in the contract's shape
  const cnt = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(100000, Math.round(Number(v))) : 0);
  const SR = isObj(g.sections_removed) ? g.sections_removed : null;
  const sectionsRemoved = SR ? { sections: cnt(SR.sections), words: cnt(SR.words), words_before: cnt(SR.words_before), h2_before: cnt(SR.h2_before), h2_removed: cnt(SR.h2_removed),
    h2_delivered: cnt(SR.h2_delivered), by_edits: cnt(SR.by_edits), share_pct: Math.min(100, cnt(SR.share_pct)), capped: SR.capped === true,
    list: (Array.isArray(SR.list) ? SR.list : []).filter(isObj).map(x => ({ heading: clean(x.heading).slice(0, 200), topic: clean(x.topic).slice(0, 120), words: cnt(x.words), level: cnt(x.level), why: clean(x.why).slice(0, 200) }))
      .filter(x => x.heading).slice(0, 12) } : null;
  const grading = { length_band: lb, coverage_target: isObj(g.coverage_target) ? g.coverage_target : null, terms, facts: factsIn, sources_cited: cited, sections_removed: sectionsRemoved,
    style_guide: isObj(g.style_guide) ? g.style_guide : null, site_urls: siteUrls, serp_shapes: isObj(g.serp_shapes) ? g.serp_shapes : null,
    regulatory_facts: regFacts, regulatory_topics: regTopics,
    // W05-A (wave 0.5): the page run's second-read advice (severity, kind, the quoted words), so the final version keeps its deduction while
    // those words are still on the page and the grade never rises at Finalize for nothing; optional, never "missing" (older reports lack it)
    second_read: Array.isArray(g.second_read) ? g.second_read.filter(isObj).map(a => ({ severity: S(a.severity).toLowerCase().slice(0, 10), kind: S(a.kind).toLowerCase().slice(0, 20),
      location: S(a.location).replace(/\s+/g, ' ').trim().slice(0, 300) })).filter(a => a.location && /^(high|medium)$/.test(a.severity)).slice(0, 12) : null };
  const grading_missing = PRC_GRADING.filter(k => grading[k] == null);
  return { received: !!pr, legacy, legacy_unknown: legacy ? ['duplicate_targets', 'copied_passages', 'dead_links'] : [], gating, gating_missing, blocks_known: gating_missing.length === 0, grading, grading_missing,
    content_request_id: S(g.content_request_id || b.content_request_id).trim().slice(0, 120) };
})();
const dupUrls = [...new Set(prc.gating.duplicate_targets.map(d => d.url).concat(...prc.gating.qa_blocking.filter(x => x.code === 'duplicate_page').map(x => x.urls || [])))];
let duplicate_decision = null;
if (b.duplicate_decision != null) {
  const dd = b.duplicate_decision;
  if (!isObj(dd)) errors.push('duplicate_decision must be an object { choice: update | differs, url, reason }');
  else {
    const choice = S(dd.choice).trim().toLowerCase(); const url = httpUrl(dd.url); const reason = clean(dd.reason);
    if (!['update', 'differs'].includes(choice)) errors.push('duplicate_decision.choice must be update or differs');
    else if (choice === 'update' && !url) errors.push('duplicate_decision.url is required for update: the address of the page this text replaces');
    else if (choice === 'update' && dupUrls.length && !dupUrls.some(u => pageKey(u) === pageKey(url))) errors.push('duplicate_decision.url must be one of the pages the first check found for this search: ' + dupUrls.slice(0, 3).join(', '));
    else if (choice === 'differs' && (reason.length < 20 || reason.length > 600)) errors.push('duplicate_decision.reason must say in 20 to 600 characters how this page differs from the one your website has');
    else if (choice === 'differs' && /[<>]/.test(reason)) errors.push('duplicate_decision.reason must be plain text (no < or >)');
    else duplicate_decision = { choice, url: choice === 'update' ? url : '', reason: choice === 'differs' ? reason : '', applies: dupUrls.length > 0 };
  }
}

// the answers: each one checked, a malformed one refuses the request (the client must not get a page that silently ignored an answer)
let answers = [];
if (b.answers != null && !Array.isArray(b.answers)) errors.push('answers must be an array');
else {
  const list = Array.isArray(b.answers) ? b.answers : [];
  if (list.length > LIM.answers) errors.push('answers allows at most ' + LIM.answers + ' entries');
  const ids = new Set();
  list.slice(0, LIM.answers).forEach((a, i) => {
    if (!a || typeof a !== 'object' || Array.isArray(a)) { errors.push('answers[' + i + '] must be an object'); return; }
    const id = S(a.id).trim(); const decision = S(a.decision).trim().toLowerCase(); const source = S(a.source || 'claim').trim().toLowerCase();
    const text = clean(a.text);
    if (!id || id.length > 40) errors.push('answers[' + i + '].id is required (at most 40 characters)');
    else if (ids.has(id)) errors.push('answers[' + i + '].id "' + id + '" is given twice'); else ids.add(id);
    if (!DECISIONS.includes(decision)) errors.push('answers[' + i + '].decision must be one of ' + DECISIONS.join(', '));
    if (!SOURCES.includes(source)) errors.push('answers[' + i + '].source must be claim, brief or bracket');
    if (S(a.text).length > LIM.text) errors.push('answers[' + i + '].text is longer than ' + LIM.text + ' characters');
    if ((decision === 'yes' || decision === 'edit' || decision === 'answer') && !text) errors.push('answers[' + i + '].text is required for ' + decision);
    if (/[<>]/.test(text)) errors.push('answers[' + i + '].text must be plain text (no < or >)');
    const fk = S(a.fact_key).trim();
    if (fk && !FA.KEY.test(fk)) errors.push('answers[' + i + '].fact_key is not a valid key');
    for (const f of ['question', 'original', 'neutral', 'section']) if (S(a[f]).length > LIM.short) errors.push('answers[' + i + '].' + f + ' is longer than ' + LIM.short + ' characters');
    const inPage = S(a.in_page).trim();
    answers.push({ id, fact_key: fk, source, decision, text: text.slice(0, LIM.text), question: clean(a.question).slice(0, LIM.short), original: clean(a.original).slice(0, LIM.short),
      neutral: S(a.neutral).replace(/\s+/g, ' ').trim().slice(0, LIM.short), in_page: ['neutral', 'cta', 'left_out'].includes(inPage) ? inPage : 'left_out', section: clean(a.section).slice(0, 300),
      // W0-E (PLAN Fix 5.1 / 5.3): the question's category and slot (where its answer belongs) and, for a statement the page run removed,
      // its anchor (the sentence before / after it); all optional (older reports carry none)
      category: clean(a.category).toLowerCase().replace(/[^a-z]/g, '').slice(0, 20), slot: ['cta', 'credential', 'proof', 'pricing', 'timeline', 'named'].includes(S(a.slot)) ? S(a.slot) : '',
      anchor: a.anchor && typeof a.anchor === 'object' && !Array.isArray(a.anchor) ? { section: clean(a.anchor.section).slice(0, 300), before: S(a.anchor.before).replace(/\s+/g, ' ').trim().slice(0, 400),
        after: S(a.anchor.after).replace(/\s+/g, ' ').trim().slice(0, 400), line_before: S(a.anchor.line_before).replace(/\s+/g, ' ').trim().slice(0, 400) } : null });
  });
}

// the sentences the client wrote themself (in the edited version, not in the delivered one): on file, and never changed by the engine
const norm = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}%$€£&]+/gu, ' ').replace(/\s+/g, ' ').trim();
const sentencesOf = (md) => S(md).split('\n').filter(l => l.trim() && !META.test(l.trim()) && !/^\s*\|?\s*:?-{2,}/.test(l)).flatMap(l => l.replace(/^\s*(?:#{1,6}|[-*+]|\d{1,3}[.)]|>)\s*/, '').split(/(?<=[.!?])\s+(?=[A-Z0-9"'\[(*])/))
  .map(x => x.trim()).filter(x => norm(x).split(' ').length >= 4);
const client_edited = b.client_edited === true && !!delivered.trim();
const deliveredSet = new Set(sentencesOf(delivered).map(norm));
const deliveredAll = norm(delivered);
const client_sentences = client_edited ? sentencesOf(markdown).filter(x => { const n = norm(x); return !deliveredSet.has(n) && !deliveredAll.includes(n); }).slice(0, 300) : [];

const answerTexts = answers.filter(a => a.decision === 'yes' || a.decision === 'edit' || a.decision === 'answer').map(a => a.text).filter(Boolean);
const businessFacts = [facts.slice(0, LIM.facts_chars), FA.text(kv), answerTexts.join('\n'), client_sentences.join('\n')].filter(x => S(x).trim()).join('\n');

// the page as a content run holds it: the meta lines above the H1 (from `meta` when the Markdown has none, removed again from the answer)
const had_meta = markdown.split('\n').some(l => /^(Title|Meta Description|Slug)\s*:/i.test(l.trim()));
const head = had_meta ? '' : [meta.title ? 'Title: ' + clean(meta.title) : '', meta.meta_description ? 'Meta Description: ' + clean(meta.meta_description) : '', meta.slug ? 'Slug: ' + clean(meta.slug) : ''].filter(Boolean).join('\n');
// W0-A (2026-10-29, page-quality PLAN Fix 1.4, REVIEW_CODE H4): the app sent back the stored meta description, and for production page
// 3299 that was "Slug: ms-365-erp-uae" (finalize 3336). The final version never runs Page Fix, so the meta rule (PF.meta) runs here once
// the head is built: a description that is missing, short or a field label is written from the page's Quick answer (or introduction)
const metaFix = PF.meta((head ? head + '\n\n' : '') + markdown.replace(/^\n+/, ''), { keyword, own_text: businessFacts });
const page = metaFix.md;
const withoutMeta = page.split('\n').filter(l => !META.test(l.trim())).join('\n');
const ownWords = withoutMeta.split(/\s+/).filter(Boolean).length;
const ownLinks = [...page.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]).filter(u => { const h = (u.match(/^https?:\/\/(?:[^@\/?#]*@)?([^\/?#:]+)/i) || [])[1] || ''; const x = h.toLowerCase().replace(/^www\./, ''); return x === domain || x.endsWith('.' + domain); });
const pageType = S(b.page_type).trim() || prc.gating.page_type || 'Blog Post / Guide';

// W0-B: the length the page is judged against is the page run's band (never the page's own word count, which gave 15 of 15 by
// construction). A page written before the band was kept with it:
//   * the grade takes the length points the page run itself measured on the delivered page against the pages that rank (`length_points`,
//     from the original report's grade; Finalize Verdict puts them in), so the final version is neither flattered nor judged on a guess;
//   * a page with no such grade either is held to the usual band for its kind of page (Parse Analysis' bands), with (about) full points
//     anywhere inside it: a band read off no ranking page must not cut a long guide that ranks (the guide of exec 949 has 3,500 words);
//   and the advice says the length of the pages that rank was not checked.
const LEN = (() => {
  const lb = prc.grading.length_band;
  if (lb) { const mid = Math.round((lb.low + lb.high) / 200) * 100; const target = lb.target && lb.target >= lb.low && lb.target <= lb.high ? lb.target : Math.min(lb.high, Math.max(lb.low, mid));
    return { target, band: { ok: lb.source === 'ranking_pages', source: lb.source, low: lb.low, high: lb.high, sample: lb.sample, basis: lb.basis, target_word_count: target }, from: 'page_run' }; }
  const pts = pr && pr.length_points !== null && pr.length_points !== '' && Number.isFinite(Number(pr.length_points)) ? Math.max(0, Math.min(15, Number(pr.length_points))) : null;
  if (pts != null) return { target: Math.max(1, ownWords), band: null, from: 'first_check', points: pts };
  const pt = pageType.toLowerCase(); const isGuide = /blog|guide|article/.test(pt); const isHub = /pillar|hub/.test(pt); const isShort = /case stud|local/.test(pt);
  const lo = isHub ? 1800 : isShort ? 800 : isGuide ? 1200 : 900, hi = isHub ? 3500 : isShort ? 1800 : isGuide ? 3000 : 2400;
  const target = Math.min(hi, Math.max(lo, ownWords));
  return { target, band: { ok: false, source: 'page_type', low: lo, high: hi, sample: 0, target_word_count: target,
    basis: 'the usual length for this kind of page is used: ' + lo.toLocaleString('en-US') + '-' + hi.toLocaleString('en-US') + ' words (the length of the pages that rank was not kept with this page)' }, from: 'page_type' };
})();
const G = prc.grading;
const siteUrls = [...new Set(ownLinks.concat(G.site_urls || []))];

const ok = errors.length === 0;
return [{ json: {
  ok, errors, error: errors.join('; '),
  output: page, critique: null, had_meta,
  keyword, domain, country: S(b.country).trim(), currency: '', page_type: pageType, page_role: 'standard', article_like: false,
  business: '', business_facts: businessFacts, case_facts_text: '', business_facts_kv: kv, stored_fact_keys: stored,
  // W0-B: the page run's context (PRC grading fields) where the request carried it, else what the page itself holds
  facts: G.facts || [], term_model: [], coverage_target: G.coverage_target || null, competitors: [],
  content_brief: { target_word_count: LEN.target, outline: [], terms_to_use: G.terms || [], evidence_plan: (G.sources_cited || []).map(x => ({ source_url: x.url, claim: x.anchor, source: x.host })),
    snippet_targets: [], secondary_keywords: [], questions_for_client: [] },
  length_band: LEN.band, own_word_count: ownWords,
  internal_link_candidates: ownLinks.map(u => ({ url: u })), site_urls: siteUrls, planned_link_targets: [], hub_pages: [],
  existing_page: null, existing_page_ours: false, ladder_id: '', author: null, reviewer: null, site_profile: null, site_description: null, video: null, style_guide: G.style_guide || null,
  serp_shapes: G.serp_shapes || null, regulatory: G.regulatory_facts ? { topics: G.regulatory_topics || [...new Set(G.regulatory_facts.map(f => S(f.topic)).filter(Boolean))].map(id => ({ id, relevance: 'core' })), facts: G.regulatory_facts } : null,
  ai_target: null, qa_max_rounds: 1, originality_max_overlap_pct: 15, client_pages: [],
  request_id: S(b.request_id).slice(0, 120), content_request_id: S(prc.content_request_id || b.content_request_id).slice(0, 120), site_id: S(b.site_id).slice(0, 120),
  prc: { received: prc.received, legacy: prc.legacy, legacy_unknown: prc.legacy_unknown, gating: prc.gating, gating_missing: prc.gating_missing, blocks_known: prc.blocks_known, grading_missing: prc.grading_missing, length_from: LEN.from,
    length_points: LEN.points == null ? null : LEN.points,
    second_read: (prc.grading || {}).second_read || null,   // W05-A: the page run's second-read advice (Finalize Verdict deducts what is still on the page)
    sections_removed: (prc.grading || {}).sections_removed || null,   // W06-C: what the page run took out (Finalize Verdict caps coverage and fit while it is still missing)
    duplicate_urls: dupUrls, duplicate_decision },
  finalize: { answers, client_edited, client_sentences, delivered_markdown: delivered, input_markdown: markdown, answer_texts: answerTexts, stored_keys: stored,
    answered_keys: answers.filter(a => a.decision !== 'skip' && a.fact_key).map(a => a.fact_key),
    meta_fix: { how: metaFix.how, description: metaFix.description, problem: metaFix.problem, fixes: metaFix.fixes } }
} }];
