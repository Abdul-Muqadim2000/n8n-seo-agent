/*__COMPLETE__*/
// LLM-LIMITS (2026-10-27, docs/llm-limits-2026-10-27/LIMITS.md): is the Editor's page complete, and is it still the whole page?
// Production (techand.ai, exec 2195): the Editor answered 749 words that end mid-word ("Does the add-on cover gratu") where it was given a
// complete 1,804-word draft; the run took the cut answer as the new page and delivered half a page. The edit is now compared with the
// page it was given (*Needs Revision?* holds it), CK.edit:
//   complete                 -> on to the quality check, as before (route `ok`)
//   cut off, first attempt   -> the Editor edits the same page once more (route `retry`; priced as a retry of its model node, R57)
//   cut off, second attempt  -> the page from before this edit is kept (it is complete; it already passed everything except the points
//                               this round asked to fix, which the quality check lists again for the owner) and the reason is recorded
const nr = $('Needs Revision?').first().json || {};
const items = $input.all();
const attempt = ($runIndex || 0) + 1;
const before = typeof nr.output === 'string' ? nr.output : '';
const out0 = items.length ? (items[0].json || {}) : {};
const after = typeof out0.output === 'string' ? out0.output : '';
const qa = nr.content_qa || {};
// was the edit ASKED to cut? Then a shorter page is the point, and only a much shorter one (or one that stops mid-way) is a cut-off
const askText = [qa.length_instruction, ...(Array.isArray(qa.warnings) ? qa.warnings : []), ...(Array.isArray(qa.not_ready_reasons) ? qa.not_ready_reasons : [])].join(' ');
const cut_requested = /\b(cut|shorten|trim|too long|over the (?:band|target)|above the (?:band|target)|reduce the length)\b/i.test(askText) || Number(qa.over_words || 0) > 0;
const e = CK.edit(before, after, { cut_requested });
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
if (e.complete) {
  const note = round_attempt > 1 ? 'The editor\'s first answer stopped before the end of the page; it edited the page again and the second answer is complete.' : '';
  return items.map(i => ({ json: { ...i.json, llm_check: { node: 'Editor', kind: 'page', complete: true, attempt, round_attempt, cut_requested, note, words_before: e.words_before, words_after: e.words_after } } }));
}
const why = e.reasons.join('; ');
if (round_attempt < 2) {
  return [{ json: { ...nr, llm_check: { node: 'Editor', kind: 'page', complete: false, retry: true, attempt, round_attempt, cut_requested, reasons: e.reasons, last_line: e.last_line,
    words_before: e.words_before, words_after: e.words_after,
    note: 'The editor\'s answer stopped before the end of the page (' + why + '); it was asked to edit the page again.' } } }];
}
if (!before || !CK.text(before).complete) {
  throw new Error('The page could not be edited in full: the editor stopped before the end of the page twice (' + why + ') and there is no complete earlier version to keep. No page was delivered. Start the page again.');
}
return [{ json: { ...out0, output: before, llm_check: { node: 'Editor', kind: 'page', complete: false, kept_draft: true, attempt, round_attempt, cut_requested, reasons: e.reasons,
  last_line: e.last_line, words_before: e.words_before, words_after: e.words_after,
  note: 'The editor\'s answer stopped before the end of the page twice (' + why + '), so the complete page from before that edit was kept. The points that edit was asked to fix are listed again below.' } } }];
