/*__PAGE_FIX__*/
// H3 (2026-10-28, page review): the editor's sections merged into the page, one at a time, and only when the section is still sound:
// it holds every confirmed sentence it was asked to put in (word for word), loses none of the sentences the client wrote, and keeps its
// heading. A section the editor did not return, returned cut off, or broke, keeps the deterministic version; a confirmed sentence that could
// not be woven in is then placed as its own paragraph at the end of its section (the client's yes is never lost). External links the editor
// added that the page did not already carry are unlinked (PF.merge). Reached with or without an editor call (Needs Editor? false).
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
  if (!M.log.replaced.includes(j.id) || lost.length || cut) { kept.push(j.id); if (M.log.replaced.includes(j.id)) notes.push('The edit of "' + (j.heading || 'the introduction') + '" was not used: it ' + (lost.length ? 'lost ' + lost.join(', ') : 'came back cut short')); continue; }
  md = M.md; rewritten.push(j.id);
  changes.push({ section: j.heading || 'introduction', what: 'rewritten with your answers', before: S(before.text).trim().slice(0, 1200), after: S(after.text).trim().slice(0, 1200) });
  if (M.log.unlinked.length) notes.push('Links the edit added that the page did not carry were unlinked: ' + M.log.unlinked.slice(0, 3).join(', '));
}
// a confirmed sentence whose section kept its deterministic version: placed as its own paragraph at the end of that section
for (const j of (FAx.jobs || [])) { if (rewritten.includes(j.id)) continue;
  for (const t of (j.must_contain || [])) { if (norm(md).includes(norm(t))) continue; const sp = PF.split(md); const part = sp.parts.find(p => p.id === j.id); if (!part) continue;
    const trail = (part.text.match(/\s*$/) || [''])[0]; part.text = part.text.replace(/\s+$/, '') + '\n\n' + S(t).trim().replace(/([^.!?])$/, '$1.') + (trail.includes('\n\n') ? trail : '\n\n'); md = PF.join(sp);
    changes.push({ section: j.heading || 'introduction', what: 'your confirmed sentence added', before: '', after: S(t).trim() }); }
  for (const id of (j.answers || [])) { const x = applied.find(a => a.id === id); if (x && x.how === 'woven') x.how = 'not_placed'; } }
return [{ json: { ...A, output: md, finalize_merge: { editor_ran: ran, editor_answered: !!answer, sections_rewritten: rewritten, sections_kept: kept, notes, applied, changes,
  prompt_chars: S(A.editor_prompt).length, output_chars: typeof raw === 'string' ? raw.length : raw ? JSON.stringify(raw).length : 0 } } }];
