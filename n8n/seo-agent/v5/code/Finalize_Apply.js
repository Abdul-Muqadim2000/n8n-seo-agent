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
const applied = [], changes = [], tasks = new Map();
const sectionFor = (heading, hint) => { const sp = PF.split(md); const h = norm(heading);
  let part = h ? sp.parts.find(p => norm(p.heading) === h) || sp.parts.find(p => h.length > 8 && (norm(p.heading).includes(h) || h.includes(norm(p.heading)))) : null;
  if (!part) { const body = sp.parts.slice(1).filter(p => p !== sp.parts[sp.parts.length - 1] || sp.parts.length <= 2);
    const ranked = body.map(p => ({ p, s: PF.overlap(hint, p.heading + ' ' + p.text.slice(0, 1500)) })).sort((a, b) => b.s - a.s);
    part = ranked.length && ranked[0].s > 0 ? ranked[0].p : sp.parts[0]; }
  return part; };
const task = (part, line, a) => { if (!part) return; const t = tasks.get(part.id) || { id: part.id, heading: part.heading, tasks: [], answers: [], must_contain: [], weave: [] }; t.tasks.push(line); t.answers.push(a.id);
  if (a.decision === 'yes' || a.decision === 'edit') t.must_contain.push(a.text); else t.weave.push(a.text); tasks.set(part.id, t); };

for (const a of (F.answers || [])) {
  const neutral = S(a.neutral).trim();
  if (a.decision === 'skip') { applied.push({ id: a.id, how: 'skipped', section: a.section }); continue; }
  if (a.decision === 'general') { applied.push({ id: a.id, how: 'left_general', section: a.section }); continue; }
  if (a.source !== 'claim' || a.decision === 'answer') {
    if (a.decision === 'remove') { applied.push({ id: a.id, how: 'removed', section: a.section }); continue; }   // a fact the client does not want said: nothing to add
    const part = sectionFor(a.section, a.question + ' ' + a.text);
    task(part, 'Work in this fact from the business, stating only what it says, in the business\'s own voice where it fits: "' + a.text + '"' + (a.question ? ' (you asked: ' + a.question + ')' : ''), a);
    applied.push({ id: a.id, how: 'woven', section: part ? part.heading : '' }); continue; }
  // a statement about the business
  const hit = neutral ? find(md, neutral) : null;
  if (a.decision === 'remove') {
    if (hit && a.in_page !== 'cta') { const before = md; md = PF.removeAt(md, hit.at, hit.len); if (md !== before) changes.push({ section: a.section, what: 'removed at your request', before: hit.raw, after: '' }); }
    const orig = a.original ? find(md, a.original) : null; if (orig) { md = PF.removeAt(md, orig.at, orig.len); changes.push({ section: a.section, what: 'removed at your request', before: orig.raw, after: '' }); }
    applied.push({ id: a.id, how: 'removed', section: a.section }); continue; }
  // yes / edit
  const text = a.decision === 'yes' ? (a.original || a.text) : a.text;
  if (hit) {
    const repl = relink(text, hit.raw, a.in_page === 'cta');
    md = md.slice(0, hit.at) + repl + md.slice(hit.at + hit.len);
    changes.push({ section: a.section, what: a.decision === 'yes' ? 'your confirmed sentence restored' : 'your wording', before: hit.raw, after: repl });
    applied.push({ id: a.id, how: a.decision === 'yes' ? 'kept_original' : 'client_wording', section: a.section }); continue; }
  if (find(md, text)) { applied.push({ id: a.id, how: a.decision === 'yes' ? 'kept_original' : 'client_wording', section: a.section }); continue; }   // already there (the client typed it)
  const part = sectionFor(a.section, (a.original || '') + ' ' + text);
  task(part, 'Put this sentence into this section where it fits best, word for word (it is confirmed by the business): "' + text + '"', { ...a, text });
  applied.push({ id: a.id, how: 'placed', section: part ? part.heading : a.section });
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
  '- State only what the facts given say. Add no other claim about the business, no number, no link, no bracket.',
  '- Plain words: no em dashes, no curly quotes, no ellipsis character.',
  '',
  'Answer with JSON: { "sections": [ { "id": "<section id>", "text": "<the whole rewritten section in Markdown, heading line first>" } ] }, one entry per section below.',
  '',
  ...sections.map(s => ['=== SECTION ' + s.id + ' (' + (s.heading || 'introduction') + ') ===', 'TASKS:', ...s.tasks.map((t, i) => (i + 1) + '. ' + t),
    ...(s.keep.length ? ['KEEP WORD FOR WORD:', ...s.keep.map(k => '- ' + k)] : []), 'CURRENT TEXT:', s.text.trim(), '=== END ' + s.id + ' ===', ''].join('\n'))
].join('\n');
return [{ json: { ...P, output: md, finalize_apply: { applied, changes, jobs: sections.map(s => ({ id: s.id, heading: s.heading, text: s.text, tasks: s.tasks, answers: s.answers, must_contain: s.must_contain, weave: s.weave, keep: s.keep, problems: s.tasks })) },
  needs_editor: sections.length > 0, editor_prompt } }];
