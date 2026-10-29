/*__PAGE_FIX__*/
// H3 (2026-10-28, page review): the editor's sections merged into the page, one at a time, and only when the section is still sound:
// it holds every confirmed sentence it was asked to put in (word for word), loses none of the sentences the client wrote, and keeps its
// heading. A section the editor did not return, returned cut off, broke, or only APPENDED an answer to (W0-E), keeps the deterministic
// version; its answers are reported as not placed (never appended: W0-E, 2026-10-29). External links the editor added that the page did not
// already carry are unlinked (PF.merge). Reached with or without an editor call (Needs Editor? false).
const A = $('Finalize Apply').first().json || {};
const S = (v) => String(v == null ? '' : v);
const FAx = A.finalize_apply || { applied: [], changes: [], jobs: [] };
const base = S(A.output);
const norm = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}%$€£&]+/gu, ' ').replace(/\s+/g, ' ').trim();
let raw = null; let ran = false;
try { const e = $('Finalize Editor').first().json || {}; ran = true; raw = e.output; } catch (e) { raw = null; ran = false; }
let parsed = raw;
if (typeof parsed === 'string') { const t = parsed.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''); try { parsed = JSON.parse(t); } catch (e) { parsed = /=== SECTION s\d+ ===/.test(t) ? t : null; } }
const answer = typeof parsed === 'string' ? parsed : (parsed && Array.isArray(parsed.sections))
  ? parsed.sections.filter(x => x && /^s\d+$/.test(S(x.id)) && S(x.text).trim()).map(x => '=== SECTION ' + x.id + ' ===\n' + S(x.text).replace(/\s+$/, '') + '\n=== END ' + x.id + ' ===').join('\n') : '';
const allowed = [...base.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]);
let md = base; const rewritten = [], kept = [], changes = (FAx.changes || []).slice(), notes = [];
const applied = (FAx.applied || []).map(x => ({ ...x }));
for (const j of (FAx.jobs || [])) {
  const before = PF.split(md).parts.find(p => p.id === j.id);
  if (!answer || !before) { kept.push(j.id); continue; }
  const M = PF.merge(md, { sections: [j] }, answer, { allowed_urls: allowed, domain: A.domain });
  const after = PF.split(M.md).parts.find(p => p.id === j.id);
  const lost = !after ? ['the section'] : [
    ...(j.must_contain || []).filter(t => !norm(after.text).includes(norm(t))).map(t => 'the confirmed sentence "' + S(t).slice(0, 80) + '"'),
    ...(j.keep || []).filter(t => !norm(after.text).includes(norm(t))).map(t => 'your sentence "' + S(t).slice(0, 80) + '"'),
    // an answer worked in: most of its words are in the section now (the editor may reword it, never drop it)
    ...(j.weave || []).filter(t => PF.overlap(t, after.text) < 0.6).map(t => 'your answer "' + S(t).slice(0, 80) + '"')];
  const cut = after && PF.words(after.text) < Math.max(15, PF.words(before.text) * 0.5);
  // W0-E (PLAN Fix 5.2): an answer the editor only appended (a new sentence closing a paragraph about something else, or a paragraph of its
  // own) is not worked in: the edit is refused (3336: "At Nova&, consultation is free of charge." after a sentence about product names)
  const tacked = !after || lost.length || cut ? [] : [...(j.weave || []), ...(j.must_contain || [])].map(t => ({ t, x: PF.appendedIn(before.text, after.text, t) })).filter(y => y.x);
  if (!M.log.replaced.includes(j.id) || lost.length || cut || tacked.length) { kept.push(j.id); if (M.log.replaced.includes(j.id)) notes.push('The edit of "' + (j.heading || 'the introduction') + '" was not used: it '
    + (lost.length ? 'lost ' + lost.join(', ') : cut ? 'came back cut short' : 'added ' + tacked.map(y => 'your answer "' + S(y.t).slice(0, 80) + '"').join(', ') + ' as a separate sentence instead of working it into the text')); continue; }
  md = M.md; rewritten.push(j.id);
  changes.push({ section: j.heading || 'introduction', what: 'rewritten with your answers', before: S(before.text).trim().slice(0, 1200), after: S(after.text).trim().slice(0, 1200) });
  if (M.log.unlinked.length) notes.push('Links the edit added that the page did not carry were unlinked: ' + M.log.unlinked.slice(0, 3).join(', '));
}
// W0-E (PLAN Fix 5.2): an answer whose section kept its deterministic version is NOT appended (it used to be placed as its own paragraph at
// the end of the section): it is reported as not placed, so the client can say where it belongs
for (const j of (FAx.jobs || [])) { if (rewritten.includes(j.id)) continue;
  const texts = j.texts || [];
  (j.answers || []).forEach((id, i) => { const x = applied.find(a => a.id === id); if (!x || (x.how !== 'woven' && x.how !== 'placed')) return; const t = S(texts[i] || '');
    if (t && norm(md).includes(norm(t))) return; x.how = 'not_placed';
    notes.push('Not placed: your answer' + (t ? ' "' + t.slice(0, 80) + '"' : '') + ' did not fit a sentence of "' + (j.heading || 'the introduction') + '". Tell us where it belongs on the page.'); }); }
return [{ json: { ...A, output: md, finalize_merge: { editor_ran: ran, editor_answered: !!answer, sections_rewritten: rewritten, sections_kept: kept, notes, applied, changes,
  prompt_chars: S(A.editor_prompt).length, output_chars: typeof raw === 'string' ? raw.length : raw ? JSON.stringify(raw).length : 0 } } }];
