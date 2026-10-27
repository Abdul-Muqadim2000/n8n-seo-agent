/*__COMPLETE__*/
/*__PAGE_FIX__*/
// LLM-LIMITS (2026-10-27, docs/llm-limits-2026-10-27/LIMITS.md): is the Editor's page complete, and is it still the whole page?
// Production (techand.ai, exec 2195): the Editor answered 749 words that end mid-word ("Does the add-on cover gratu") where it was given a
// complete 1,804-word draft; the run took the cut answer as the new page and delivered half a page. The edit is now compared with the
// page it was given, CK.edit:
//   complete                 -> on to the quality check, as before (route `ok`)
//   cut off, first attempt   -> the Editor edits the same page once more (route `retry`; priced as a retry of its model node, R57)
//   cut off, second attempt  -> the page from before this edit is kept (it is complete; it already passed everything except the points
//                               this round asked to fix, which the quality check lists again for the owner) and the reason is recorded
// H1 (2026-10-27, docs/content-quality-2026-10-27/R1 §6 rec. 2): the Editor now edits SECTIONS. It is given only the sections with a
// problem (*Page Candidates* -> *Verified Sources*, `page_fix.edit_job`) and answers one block per section; the blocks are merged into the
// page it was given and every other byte of that page is kept (PF.merge). A block that stops before its closing line is not used (the
// section keeps its text); an external link that is neither in the page already nor among the sources of this run (the evidence plan, the
// facts, the sources *Verified Sources* fetched) is unlinked, so a guessed address never reaches the page (exec 949: two guessed links,
// both 404). An answer with no section blocks is read as a whole page, as before.
const nr = (() => { try { const v = $('Verified Sources').first().json; if (v && typeof v.output === 'string' && v.page_fix) return v; } catch (e) {}
  try { return $('Needs Revision?').first().json || {}; } catch (e) { return {}; } })();
const items = $input.all();
const attempt = ($runIndex || 0) + 1;
const before = typeof nr.output === 'string' ? nr.output : '';
const out0 = items.length ? (items[0].json || {}) : {};
const answer = typeof out0.output === 'string' ? out0.output : '';
const qa = nr.content_qa || {};
const job = (nr.page_fix || {}).edit_job || null;
const P = PF.parseSections(answer);
const sectionMode = !!(job && (job.sections || []).length && P.marked);
let after = answer, merge_log = null;
if (sectionMode) {
  const brief = nr.content_brief || {};
  const allowed = [...(brief.evidence_plan || []).map(e => e && e.source_url), ...(nr.facts || []).map(f => f && f.url), ...(((nr.page_fix || {}).sources) || []).map(v => v && v.url)].filter(Boolean);
  const M = PF.merge(before, job, answer, { allowed_urls: allowed, domain: nr.domain });
  after = M.md; merge_log = M.log;
}
// was the edit ASKED to cut? Then a shorter page is the point, and only a much shorter one (or one that stops mid-way) is a cut-off
const askText = [qa.length_instruction, job && job.length_note, ...(Array.isArray(qa.warnings) ? qa.warnings : []), ...(Array.isArray(qa.not_ready_reasons) ? qa.not_ready_reasons : [])].join(' ');
const cut_requested = /\b(cut|shorten|trim|too long|over the (?:band|target)|above the (?:band|target)|reduce the length)\b/i.test(askText) || Number(qa.over_words || 0) > 0;
const e0 = CK.edit(before, after, { cut_requested });
// in section mode a block that stopped before its closing line is a cut answer too (the section kept its text, but the edit is incomplete)
const unfinished = sectionMode && merge_log && merge_log.unfinished.length ? merge_log.unfinished : [];
const e = unfinished.length && e0.complete ? { ...e0, complete: false, cut_off: true, reasons: ['the editor\'s answer stopped inside section ' + unfinished.join(', ') + ' before its closing line'] } : e0;
// The attempt of THIS quality round (the node runs once per round, plus once per retry). A retry loops straight back through the Editor
// to this node, so this node's previous run was a retry of this round exactly when it says so. If that run cannot be read, the count is
// taken from the runs n8n recorded (Editor runs beyond one per quality round are retries) and at most ONE retry is allowed in the whole
// run: whatever happens, this loop cannot run away.
let round_attempt = 1;
if ($runIndex > 0) {
  let readPrev = false;
  try { const prevRun = $('Edit Check (Editor)').all(0, $runIndex - 1); const p = prevRun && prevRun[0] && prevRun[0].json && prevRun[0].json.llm_check;
    if (p) { readPrev = true; if (p.retry) round_attempt = (Number(p.round_attempt) || 1) + 1; } } catch (err) { readPrev = false; }
  if (!readPrev) {
    const runsOf = (n) => { try { if (typeof $node === 'undefined') return 0; const r = Number($node[n].runIndex); return Number.isFinite(r) && r >= 0 ? r + 1 : 0; } catch (err) { return 0; } };
    const editorRuns = runsOf('Editor'), qaRounds = runsOf('Content QA');
    round_attempt = editorRuns > qaRounds && qaRounds > 0 ? 2 : 1;
  }
}
// the state the next quality check and *Page Candidates* read: one more editing round done, and what it changed
const pf = (kept) => ({ ...(nr.page_fix || {}), came_from: 'edit', edits: (Number((nr.page_fix || {}).edits) || 0) + 1, edit_job: null,
  last_edit: { mode: sectionMode ? 'sections' : 'page', kept_pre_edit_page: !!kept, ...(merge_log ? { replaced: merge_log.replaced, kept: merge_log.kept, unlinked: merge_log.unlinked, unfinished: merge_log.unfinished } : {}) } });
if (e.complete) {
  const note = round_attempt > 1 ? 'The editor\'s first answer stopped before the end of the page; it edited the page again and the second answer is complete.' : '';
  return items.map(i => ({ json: { ...i.json, output: after, page_fix: pf(false), llm_check: { node: 'Editor', kind: sectionMode ? 'sections' : 'page', complete: true, attempt, round_attempt, cut_requested, note, words_before: e.words_before, words_after: e.words_after } } }));
}
const why = e.reasons.join('; ');
if (round_attempt < 2) {
  return [{ json: { ...nr, llm_check: { node: 'Editor', kind: sectionMode ? 'sections' : 'page', complete: false, retry: true, attempt, round_attempt, cut_requested, reasons: e.reasons, last_line: e.last_line,
    words_before: e.words_before, words_after: e.words_after,
    note: 'The editor\'s answer stopped before the end of the page (' + why + '); it was asked to edit the page again.' } } }];
}
// second cut: in section mode the sections that came back complete are kept (the others keep their text) when the merged page is itself
// complete; otherwise the page from before this edit
const keepMerged = sectionMode && merge_log && merge_log.replaced.length > 0 && e0.complete;
if (!keepMerged && (!before || !CK.text(before).complete)) {
  throw new Error('The page could not be edited in full: the editor stopped before the end of the page twice (' + why + ') and there is no complete earlier version to keep. No page was delivered. Start the page again.');
}
return [{ json: { ...out0, output: keepMerged ? after : before, page_fix: pf(!keepMerged), llm_check: { node: 'Editor', kind: sectionMode ? 'sections' : 'page', complete: false, kept_draft: !keepMerged, attempt, round_attempt, cut_requested, reasons: e.reasons,
  last_line: e.last_line, words_before: e.words_before, words_after: e.words_after,
  note: keepMerged ? 'The editor\'s answer stopped inside a section twice (' + why + '): the sections it finished were used and the others kept their text.'
    : 'The editor\'s answer stopped before the end of the page twice (' + why + '), so the complete page from before that edit was kept. The points that edit was asked to fix are listed again below.' } } }];
