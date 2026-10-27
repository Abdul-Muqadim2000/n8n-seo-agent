/*__COVERAGE__*/
/*__PAGE_FIX__*/
// H1 (2026-10-27, docs/content-quality-2026-10-27/R1 §6 rec. 2): the deterministic fixes, in front of EVERY quality check. Code only, no
// model, so it cannot invent anything and costs nothing: the keyword in the meta title, the H1 and (for a question keyword) the first
// words of the introduction; the meta title and description inside their lengths; the slug's form; the Quick answer moved up to the first
// screen; a snippet question from the brief as the heading it nearly is; the first mention of a live page of the site linked; the brand
// as the business writes it; and no bracket left in the page (the sentence that needed it goes, and what only the client knows becomes a
// question for them, never a [Confirm: ...] in the text). It reads the draft of this round: the Copywriter's (from *Refresh Sources*), an
// edit merged by *Edit Check (Editor)*, or the final version *Page Candidates* hands back for its last check.
const inItem = $input.first().json || {};
const prev = $('Parse Brief').first().json || {};
const state = inItem.page_fix && typeof inItem.page_fix === 'object' ? inItem.page_fix : null;
const raw = typeof inItem.output === 'string' ? inItem.output : JSON.stringify(inItem.output || '');
const ctx = PF.ctxOf(prev, { termRe: CVG.termRe, qa_marks: state ? state.qa_marks || [] : [], qa_figure_marks: state ? state.qa_figure_marks || [] : [] });
const F = PF.fix(raw, ctx);
const page_fix_applied = { came_from: state ? (state.came_from || 'edit') : 'copywriter', fixes: F.fixes, removed: F.removed, words_before: PF.words(raw), words_after: PF.words(F.md) };
return [{ json: { ...inItem, output: F.md, page_fix_applied } }];
