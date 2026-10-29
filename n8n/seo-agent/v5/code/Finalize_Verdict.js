/*__PAGE_FIX__*/
/*__COST_CAL__*/
// H3 (2026-10-28, page review): the answer of `POST /webhook/seo-page-finalize` (the app's FinalizeResult, app/shared/src/page-review.ts).
// The final version went through the content gate (*Content QA* + *Originality Check*, the content run's own node code). This node reads its
// verdict by the page pipeline's one rule (PF.classify) and decides:
//   - a statement about the business the SYSTEM wrote in this run (the editor, while working an answer in) that nothing on file supports is
//     rewritten or removed by the system's own neutral rewrite (PF.neutralize), and asked as a new question; nothing the client wrote or
//     confirmed is ever touched, and a statement already in the page before this run was the client's to answer (it is not re-judged here);
//   - what still blocks is shown (a bracket the client typed, a testimonial, a cut page): the client sees it, the app does not publish it live;
//   - the delivered status in plain words, the grade OF THIS VERSION, and what the editor call cost (Claude only: no search data is bought).
const d = $input.first().json || {};
const P = $('Parse Brief').first().json || {};
const A = $('Finalize Apply').first().json || {};
const M = $('Finalize Merge').first().json || {};
const S = (v) => String(v == null ? '' : v);
const F = P.finalize || {}; const FM = M.finalize_merge || {};
let qa = { ...(d.content_qa || {}) };
const norm = (t) => S(t).replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}%$€£&]+/gu, ' ').replace(/\s+/g, ' ').trim();
const marks = (qa.business_promises || []).concat(qa.business_claims || []).map(b => S(b.sentence)).filter(Boolean);
const figs = (qa.unverified_figures || []).map(f => S(f.figure)).concat((qa.flagged_amounts || []).map(a => S(a.amount)));
let md = PF.unmark(S(d.output), marks, figs);
const ctx = PF.ctxOf(P, {});
const cls = PF.classify(qa, md, ctx);
// what was on the page before the editor touched it: the client's version with the deterministic answers applied, and the request itself
const before = norm(S(A.output)) + ' ' + norm(S(F.input_markdown));
const newText = (t) => { const n = norm(t); return !!n && !before.includes(n); };
const TEXTUAL = { claim: 'sentence', figure: 'figure', statistic: 'stat', guarantee: 'quote', testimonial: 'text' };
const judged = cls.blocking.filter(b => !TEXTUAL[b.code] || newText(b[TEXTUAL[b.code]]));
const systemNew = judged.filter(b => b.tier === 'soft' && TEXTUAL[b.code]);
// PF.neutralize's own last sweep removes every bracket left in the page; a bracket the client typed is shown, never silently deleted, so the
// system's rewrite is applied here statement by statement
const N = { md, removed: [] };
for (const b of systemNew) {
  const t = S(b[TEXTUAL[b.code]]); if (!t) continue;
  const r = b.code === 'claim' ? PF.neutralSentence(N.md, t, ctx.domain, b.rewrite) : (() => { const i = N.md.indexOf(b.code === 'guarantee' ? t.slice(0, 60) : t); return i < 0 ? { md: N.md, done: false } : { md: PF.removeAt(N.md, i, b.code === 'guarantee' ? Math.min(60, t.length) : t.length), done: true, how: 'removed' }; })();
  if (r.done) { N.md = r.md; N.removed.push({ code: b.code, sentence: t, kind: b.kind || '', how: r.how || 'removed', text: r.text || '', rewrite: b.rewrite || null }); } }
N.md = PF.tidy(N.md);
md = N.md;
const finalCls = PF.residual({ ...cls, blocking: judged }, md);
// a new question for every statement the system had to take back (fact keys the website decided, or that were answered now, are never asked)
const skipKeys = new Set([...(F.stored_keys || []), ...(F.answered_keys || [])]);
const claims = N.removed.filter(r => r.code === 'claim').map(r => ({ sentence: r.sentence, kind: r.kind || 'process', rewrite: r.rewrite || null, neutral: r.how === 'reworded' || r.how === 'cta' ? r.text : '', how: r.how }));
const qs0 = claims.length ? PF.questions({ claims, brief: [], brackets: [], business: ctx.business, final_md: md, docs: [{ source: 'your business facts', text: S(P.business_facts) }], stored: [...skipKeys] }) : [];
const answeredIds = new Set((F.answers || []).map(a => a.id));
const client_questions = qs0.filter(q => !skipKeys.has(q.fact_key)).map((q, i) => ({ ...q, id: 'f' + (i + 1), rank: i + 1 })).filter(q => !answeredIds.has(q.id));
const del = PF.deliver(finalCls, { questions: client_questions });
const grade = { score: qa.content_score == null ? null : Number(qa.content_score), of: 100, breakdown: qa.score_breakdown || null,
  basis: 'measured on this final version, after your answers and the last full check (structure, readability, specificity, plain language, length)', blocking: del.blocking.length, advice: del.advisory.length };
// the answer: the Markdown the caller sent, without the meta lines it did not send
let out = md;
if (!P.had_meta) { const lines = out.split('\n'); let i = 0; while (i < lines.length && (/^(Title|Meta Description|Meta Title|Slug|Primary Keyword|Secondary Keywords)\s*:/i.test(lines[i].trim()) || !lines[i].trim())) i++; out = lines.slice(i).join('\n'); }
const changes = (FM.changes || []).concat(N.removed.map(r => ({ section: '', what: r.how === 'reworded' ? 'reworded: nothing on file supports it' : r.how === 'cta' ? 'kept only its link: nothing on file supports it' : 'removed: nothing on file supports it', before: PF.clean(S(r.sentence)).slice(0, 400), after: S(r.text || '') })));
// the cost: one Claude Sonnet call when an answer had to be worked into the text, priced by the cost kit from its characters (estimated); $0 otherwise
const call = FM.editor_ran ? CC.callCost({ node: 'Finalize Editor', model: 'claude-sonnet-5-5', calls: 1, prompt_chars: Number(FM.prompt_chars) || 0, output_chars: Number(FM.output_chars) || 0, effort: 'low', streaming: true, think_model: 'seen', max_tokens: 128000 }) : null;
const cost = { claude_usd: call ? call.usd : 0, dfs_usd: 0, estimated: !!call && !call.measured, model_calls: call ? 1 : 0, basis: call ? call.basis : 'no model call: every answer was applied without the editor' };
const body = {
  ok: true, request_id: S(P.request_id), markdown: out,
  // W0-A (PLAN Fix 1, acceptance f): the meta lines of the final version as the check read them (PF.meta rebuilt a broken description in
  // Parse Brief), so the app stores this description instead of the one it sent
  meta: { title: S((d.meta || {}).title), meta_description: S((d.meta || {}).description), slug: S((d.meta || {}).slug) },
  applied: (FM.applied || []).map(a => ({ id: a.id, how: a.how, section: S(a.section) })), sections_rewritten: FM.sections_rewritten || [], changes: changes.slice(0, 60),
  delivery_status: del.status,
  delivery: { status: del.status, label: del.label, blocking: del.blocking, advisory: del.advisory, next_step: del.next_step, grade },
  client_questions, grade, cost, notes: (FM.notes || []).slice(0, 10), content_score: grade.score,
  basis: 'the content gate of a content run (Content QA + Originality Check, the same node code) over the final version, with your answers and the sentences you wrote counted as on file; no research, no new page',
  writes: 'none'
};
return [{ json: { body, cost_usd: 0, run_cost_usd: cost.claude_usd } }];
