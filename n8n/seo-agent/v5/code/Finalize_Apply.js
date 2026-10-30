/*__PAGE_FIX__*/
// H3 (2026-10-28, page review): the client's answers applied to the page, deterministically where a sentence can simply be swapped, and an edit
// job (one section in, one section out) only where a fact has to be worked into the text:
//   yes     the neutral wording (or the call-to-action line that took the sentence's place) becomes the original specific sentence
//   edit    the same, with the client's own wording
//   remove  the neutral sentence goes (and the original, if it is still there); a call-to-action line stays (the link is not the claim)
//   general the neutral wording stays (the decision is recorded by the app: never asked again)
//   skip    nothing
//   answer  (a question from the brief or the writer) the section it belongs to gets an edit job: work this confirmed fact in, as stated
// A yes / edit whose neutral wording is not in the page (left out, or the client changed that sentence) becomes an edit job for its section:
// place the sentence word for word. Sentences the client wrote themself are never changed: the editor is told to keep them, and the merge
// refuses an edit that loses one.
const P = $('Parse Brief').first().json || {};
const F = P.finalize || {};
const S = (v) => String(v == null ? '' : v);
let md = S(P.output);
const norm = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}%$€£&]+/gu, ' ').replace(/\s+/g, ' ').trim();
const META = /^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i;
// every sentence of the body with its exact place in the Markdown (headings, meta lines and table separators are not sentences)
const segments = (src) => { const out = []; let off = 0;
  for (const line of S(src).split('\n')) { const t = line.trim();
    if (t && !META.test(t) && !/^#{1,6}\s/.test(t) && !/^\s*\|?\s*:?-{2,}/.test(t)) {
      const lead = (line.match(/^\s*(?:[-*+]|\d{1,3}[.)]|>)?\s*/) || [''])[0].length; const body = line.slice(lead);
      const re = /[^.!?]+(?:[.!?]+(?=\s|$)|$)/g; let m; const shadow = body.replace(/\]\(([^)\s]+)\)/g, (x) => '](' + 'x'.repeat(Math.max(0, x.length - 3)) + ')');
      while ((m = re.exec(shadow))) { if (!m[0].trim()) continue; const a = m.index + (m[0].length - m[0].trimStart().length); const raw = body.slice(a, m.index + m[0].length).trimEnd();
        if (raw) out.push({ at: off + lead + a, len: raw.length, raw }); if (m[0].length === 0) re.lastIndex++; } }
    off += line.length + 1; }
  return out; };
const find = (src, text) => { const want = norm(text); if (!want) return null;
  const exact = S(src).indexOf(S(text).trim()); if (S(text).trim().length > 12 && exact >= 0) return { at: exact, len: S(text).trim().length, raw: S(text).trim() };
  const segs = segments(src); let best = null;
  for (const g of segs) { const n = norm(g.raw); if (!n) continue; if (n === want) return g;
    const ratio = Math.min(n.length, want.length) / Math.max(n.length, want.length);
    if (ratio >= 0.8 && (n.includes(want) || want.includes(n)) && (!best || ratio > best.ratio)) best = { ...g, ratio }; }
  // a multi-sentence neutral wording: the run of consecutive sentences that together read as it
  if (!best) for (let i = 0; i < segs.length; i++) { let joined = ''; for (let j = i; j < Math.min(segs.length, i + 4); j++) { joined = (joined + ' ' + norm(segs[j].raw)).trim();
    if (joined === want) return { at: segs[i].at, len: segs[j].at + segs[j].len - segs[i].at, raw: S(src).slice(segs[i].at, segs[j].at + segs[j].len) }; if (joined.length > want.length) break; } }
  return best; };
const linksIn = (t) => [...S(t).matchAll(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g)].map(m => ({ anchor: m[1], url: m[2] }));
// the specific sentence keeps the call to action's link: the anchor words linked where they appear, else the "Next step" line is kept after it
const relink = (text, neutralRaw, cta) => { let t = S(text).trim(); if (!/[.!?]["')]*$/.test(t)) t += '.'; const keep = [];
  for (const l of linksIn(neutralRaw)) { const i = t.toLowerCase().indexOf(l.anchor.toLowerCase());
    if (i >= 0 && !/\]\(/.test(t)) t = t.slice(0, i) + '[' + t.slice(i, i + l.anchor.length) + '](' + l.url + ')' + t.slice(i + l.anchor.length); else keep.push(l); }
  return cta && keep.length ? t + '\n\nNext step: [' + keep[0].anchor + '](' + keep[0].url + ').' : t; };
const applied = [], changes = [], notes = [], tasks = new Map();
const anchor0 = (a) => (a && a.anchor && typeof a.anchor === 'object' ? a.anchor : null);
// W05-C: the page already invites the reader to get in touch (its last section, or any line linking the business's contact page)
const invites = () => { const sp0 = PF.split(md); const last = sp0.parts.length > 1 ? sp0.parts[sp0.parts.length - 1] : null;
  return !!last && PF.sentencesOf(last.text.replace(/\n+/g, ' ')).some(x => PF.ctaSentence(x, NAMES)); };
// W0-E (2026-10-29, page-quality PLAN Fix 5, R4 D6 / G15, REVIEW_CODE L2): finalize 3336 appended "At Nova&, consultation is free of charge."
// to a section about product names, wove a homepage slogan into a checklist item, placed the page's own search description into the body
// and swapped a confirmed claim into an unrelated checklist sentence. Now:
//   * an answer to a brief question goes to its SLOT (PF.slotIn: the call to action, the sentence naming the business, the decision section,
//     the section the brief named) and the editor is told which sentence to rewrite (the host), never "work this in";
//   * a statement the system removed goes back at its anchor (the sentence before / after it), deterministically, and nowhere else;
//   * a neutral wording found outside the statement's own section is not its neutral wording (old reports: neutralIn guessed it);
//   * an answer about the page's head (its search description, an old report's question) changes nothing in the body.
const NAMES = [...new Set([...(PF.ctxOf(P, {}).names || []), S((P.style_guide || {}).brand_form).replace(/\s*\([^)]*\)\s*$/, ''),
  (md.match(/^Title:.*\s\|\s*([^|\n]{2,40})$/m) || [])[1] || ''].map(x => S(x).trim()).filter(x => x.length >= 3))];
const headSet = new Set([md, S(F.delivered_markdown), S(F.input_markdown)].flatMap(t => S(t).split('\n')).map(l => l.trim()).filter(l => META.test(l)).map(l => norm(l.replace(/^[^:]*:/, ''))).filter(x => x.length > 12));
const bodyNorm = norm(PF.split(md).parts.map(p => p.text).join('\n'));
const isHead = (a) => a.source === 'claim' && (S(a.where) === 'head' || headSet.has(norm(a.original))
  || (!S(a.section).trim() && !a.anchor && a.in_page === 'left_out' && !!norm(a.original) && !bodyNorm.includes(norm(a.original))));
const partOf = (at) => PF.split(md).parts.find(p => at >= p.start && at < p.end) || null;
const sectionExists = (h) => !!norm(h) && PF.split(md).parts.some(p => norm(p.heading) === norm(h));
// the claim's neutral wording, only where the claim stood (its section, when that section is still on the page)
const neutralHit = (a, neutral) => { const h = neutral ? find(md, neutral) : null; if (!h) return null;
  if (sectionExists(a.section)) { const p = partOf(h.at); if (p && norm(p.heading) !== norm(a.section)) return null; } return h; };
// put a removed statement back where it stood: after the sentence before it, else before the sentence after it, else on its own line after
// the line above it, inside its own section only. Returns the section heading, or null when the anchor is not on the page any more
const restoreAt = (anchor, text) => { const sp = PF.split(md); const h = norm(anchor.section);
  const part = h ? sp.parts.find(p => norm(p.heading) === h) : null; if (h && !part) return null;
  const scope = part || { start: 0, text: md };
  const at = (x) => { if (!S(x).trim()) return null; const r = find(scope.text, x); return r ? { at: scope.start + r.at, len: r.len } : null; };
  let t = S(text).trim(); if (!/[.!?]["')]*$/.test(t)) t += '.';
  let r = at(anchor.before); if (r) { const e = r.at + r.len; md = md.slice(0, e) + ' ' + t + md.slice(e); return part ? part.heading : ''; }
  r = at(anchor.after); if (r) { md = md.slice(0, r.at) + t + ' ' + md.slice(r.at); return part ? part.heading : ''; }
  r = at(anchor.line_before); if (r) { let le = md.indexOf('\n', r.at + r.len); if (le < 0) le = md.length; md = md.slice(0, le) + '\n\n' + t + md.slice(le); return part ? part.heading : ''; }
  return null; };
const sectionFor = (heading, hint) => { const sp = PF.split(md); const h = norm(heading);
  let part = h ? sp.parts.find(p => norm(p.heading) === h) || sp.parts.find(p => h.length > 8 && (norm(p.heading).includes(h) || h.includes(norm(p.heading)))) : null;
  if (!part) { const body = sp.parts.slice(1).filter(p => p !== sp.parts[sp.parts.length - 1] || sp.parts.length <= 2);
    const ranked = body.map(p => ({ p, s: PF.overlap(hint, p.heading + ' ' + p.text.slice(0, 1500)) })).sort((a, b) => b.s - a.s);
    part = ranked.length && ranked[0].s > 0 ? ranked[0].p : sp.parts[0]; }
  return part; };
const task = (part, line, a, host) => { if (!part) return; const t = tasks.get(part.id) || { id: part.id, heading: part.heading, tasks: [], answers: [], must_contain: [], weave: [], hosts: [], texts: [] }; t.tasks.push(line); t.answers.push(a.id); t.texts.push(a.text);
  if (host) t.hosts.push(host);
  if (a.decision === 'yes' || a.decision === 'edit') t.must_contain.push(a.text); else t.weave.push(a.text); tasks.set(part.id, t); };

for (const a of (F.answers || [])) {
  const neutral = S(a.neutral).trim();
  if (a.decision === 'skip') { applied.push({ id: a.id, how: 'skipped', section: a.section }); continue; }
  if (a.decision === 'general') { applied.push({ id: a.id, how: 'left_general', section: a.section }); continue; }
  if (isHead(a)) { applied.push({ id: a.id, how: 'head_line', section: '' }); continue; }   // REVIEW_CODE L2: the search description is written from the page
  if (a.source !== 'claim' || a.decision === 'answer') {
    if (a.decision === 'remove') { applied.push({ id: a.id, how: 'removed', section: a.section }); continue; }   // a fact the client does not want said: nothing to add
    const slot = PF.slotIn(md, { ...a, text: a.text }, NAMES);
    const part = slot.part || sectionFor(a.section, a.question + ' ' + a.text);
    const asked = a.question ? ' (you asked: ' + a.question + ')' : '';
    task(part, slot.part && slot.host
      ? 'Rewrite this sentence so it also states the fact below, in the same place, keeping its links and everything else it says: "' + slot.host + '". The fact, confirmed by the business (state only what it says): "' + a.text + '"' + asked + '. Do not add the fact as a separate sentence.'
      : 'Work this fact from the business into the paragraph it belongs to, stating only what it says, in the business\'s own voice: "' + a.text + '"' + asked + '. Never add it as a separate sentence at the end of a paragraph or as a paragraph of its own.', a, slot.part ? slot.host : '');
    applied.push({ id: a.id, how: 'woven', section: part ? part.heading : '', slot: slot.slot }); continue; }
  // a statement about the business
  const hit = neutralHit(a, neutral);
  if (a.decision === 'remove') {
    if (hit && a.in_page !== 'cta') { const before = md; md = PF.removeAt(md, hit.at, hit.len); if (md !== before) changes.push({ section: a.section, what: 'removed at your request', before: hit.raw, after: '' }); }
    const orig = a.original ? find(md, a.original) : null; if (orig) { md = PF.removeAt(md, orig.at, orig.len); changes.push({ section: a.section, what: 'removed at your request', before: orig.raw, after: '' }); }
    applied.push({ id: a.id, how: 'removed', section: a.section }); continue; }
  // yes / edit
  const text = a.decision === 'yes' ? (a.original || a.text) : a.text;
  // W05-C (2026-10-30, BEFORE_AFTER "Finalize"): three of the five splices the judges named came from here. A line that is not a sentence
  // (a heading, a label, a list item with no verb) is never put into prose: it replaces only a list item, or goes back into the list it
  // came from, else it is reported (K5 "How <client> measures up", K7 "The fixes planned for the next cycle, each with a named owner.").
  // An invitation to get in touch is not added to a page that already invites the reader (K2, K3: a second call to action).
  const frag = PF.fragment(text); const hitLine = hit ? PF.lineOf(md, hit.at) : null;
  if (frag && !(hitLine && hitLine.list)) {
    const al = anchor0(a) && S(anchor0(a).line_before).trim() ? find(md, anchor0(a).line_before) : null; const L0 = al ? PF.lineOf(md, al.at) : null;
    if (!hit && L0 && L0.list) { const item = L0.marker + PF.plain(text).replace(/^\s*(?:[-*+]|\d{1,3}[.)])\s+/, '');
      md = md.slice(0, L0.end) + '\n' + item + md.slice(L0.end);
      changes.push({ section: a.section, what: 'your confirmed line put back in its list', before: '', after: item });
      applied.push({ id: a.id, how: a.decision === 'yes' ? 'kept_original' : 'client_wording', section: a.section }); continue; }
    notes.push('Not placed: "' + S(text).slice(0, 100) + '" reads as a heading or a list line, not a sentence, so it was not put into a paragraph' + (hit ? ' in place of a full sentence' : '') + '. Add it to the list where it belongs in the page editor, or tell us where it goes.');
    applied.push({ id: a.id, how: 'not_placed', section: a.section, why: 'a heading or a list line, not a sentence' }); continue; }
  if (!hit && PF.ctaSentence(text, NAMES) && invites()) {
    notes.push('Already on the page: your page already invites the reader to get in touch, so "' + S(text).slice(0, 100) + '" was not added as a second call to action.');
    applied.push({ id: a.id, how: 'already_covered', section: a.section }); continue; }
  if (hit) {
    let repl = relink(text, hit.raw, a.in_page === 'cta');
    // a list item keeps its marker: the neutral wording may carry the "- " the confirmed sentence does not (K6: a test-set item lost its bullet)
    const lead = (hit.raw.match(/^\s*(?:[-*+]|\d{1,3}[.)])\s+/) || [''])[0];
    if (lead && !/^\s*(?:[-*+]|\d{1,3}[.)])\s+/.test(repl)) repl = lead + repl;
    md = md.slice(0, hit.at) + repl + md.slice(hit.at + hit.len);
    changes.push({ section: a.section, what: a.decision === 'yes' ? 'your confirmed sentence restored' : 'your wording', before: hit.raw, after: repl });
    applied.push({ id: a.id, how: a.decision === 'yes' ? 'kept_original' : 'client_wording', section: a.section }); continue; }
  if (find(md, text)) { applied.push({ id: a.id, how: a.decision === 'yes' ? 'kept_original' : 'client_wording', section: a.section }); continue; }   // already there (the client typed it)
  // W0-E (Fix 5.3): a statement the system removed goes back at its anchor, with no model call; when the anchor is gone, its own section only
  const anchor = a.anchor && typeof a.anchor === 'object' ? a.anchor : null;
  if (anchor) { const where = restoreAt(anchor, text);
    if (where != null) { changes.push({ section: where || a.section, what: a.decision === 'yes' ? 'your confirmed sentence put back where it was' : 'your wording put where the sentence was', before: '', after: text });
      applied.push({ id: a.id, how: a.decision === 'yes' ? 'kept_original' : 'client_wording', section: where || a.section }); continue; } }
  const home = anchor && norm(anchor.section) ? anchor.section : a.section;
  const part = sectionExists(home) ? PF.split(md).parts.find(p => norm(p.heading) === norm(home)) : anchor ? null : sectionFor(a.section, (a.original || '') + ' ' + text);
  if (!part) { applied.push({ id: a.id, how: 'not_placed', section: home || '' }); continue; }
  task(part, 'Put this sentence into this section, word for word (it is confirmed by the business), inside the paragraph it belongs to, never as a paragraph of its own at the end: "' + text + '"', { ...a, text });
  applied.push({ id: a.id, how: 'placed', section: part.heading });
}
md = PF.tidy(md);
const sp = PF.split(md);
const keep = (F.client_sentences || []);
const sections = [...tasks.values()].map(t => { const part = sp.parts.find(p => p.id === t.id); return part ? { ...t, heading: part.heading, text: part.text,
  keep: keep.filter(k => norm(part.text).includes(norm(k))).slice(0, 20) } : null; }).filter(Boolean);
const contract = PF.contract({ ...P, page_contract: null });
const editor_prompt = !sections.length ? '' : [
  'You finalise a web page for ' + (P.domain || 'the business') + ' that has already been written and checked. The business answered questions about it. Rewrite ONLY the sections below, each one in full, and nothing else.',
  '', contract.text, '',
  'RULES FOR THIS EDIT',
  '- Keep each section\'s heading line exactly as it is (the "## ..." line; for s0 the "# ..." H1 line).',
  '- Make each task with as few changed words as possible; keep every other sentence, link, list, table and figure as it is.',
  '- A sentence marked KEEP WORD FOR WORD was written by the business: keep it exactly.',
  '- A confirmed sentence you are asked to put in must appear word for word.',
  '- A fact from the business goes INTO the sentence named for it: rewrite that sentence so it also says the fact, and keep everything else it says.',
  '- Never add a fact as a new sentence at the end of a paragraph, or as a paragraph of its own: such an edit is not used.',
  '- State only what the facts given say. Add no other claim about the business, no number, no link, no bracket.',
  '- Keep the page\'s shape: every heading on its own line, every list item a list item with its marker ("- " or "1."), every table as it is. Never join a heading or a list item to a paragraph.',
  '- Every sentence you write is a full sentence with its verb; never leave a fragment or a label at the end of a paragraph.',
  '- One call to action: the page already invites the reader to get in touch in its last section; never add a second invitation ("get in touch", "book a consultation", "contact us") anywhere.',
  '- Plain words: no em dashes, no curly quotes, no ellipsis character.',
  '- Our own voice: the page is published on the business\'s own website. Write its facts with "we" / "our team", or as a plain statement with the business as the subject; never "its website states", "the website says", "according to its site" or "the company says".',
  '- One byline: the system prints the author, the updated date and the reviewer under the H1 and the author box at the end. Never add a "Written by ..." or "Reviewed by ..." line or sentence.',
  '- A source link is the page itself, never a search engine redirect (google.com/url, google.com/goto, a Vertex AI or Bing redirect).',
  '',
  'Answer with JSON: { "sections": [ { "id": "<section id>", "text": "<the whole rewritten section in Markdown, heading line first>" } ] }, one entry per section below.',
  '',
  ...sections.map(s => ['=== SECTION ' + s.id + ' (' + (s.heading || 'introduction') + ') ===', 'TASKS:', ...s.tasks.map((t, i) => (i + 1) + '. ' + t),
    ...(s.keep.length ? ['KEEP WORD FOR WORD:', ...s.keep.map(k => '- ' + k)] : []), 'CURRENT TEXT:', s.text.trim(), '=== END ' + s.id + ' ===', ''].join('\n'))
].join('\n');
return [{ json: { ...P, output: md, finalize_apply: { applied, changes, notes, jobs: sections.map(s => ({ id: s.id, heading: s.heading, text: s.text, tasks: s.tasks, answers: s.answers, must_contain: s.must_contain, weave: s.weave, hosts: s.hosts, texts: s.texts, keep: s.keep, problems: s.tasks })) },
  needs_editor: sections.length > 0, editor_prompt } }];
