/*__PAGE_FIX__*/
/*__GRADE__*/
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
const TEXTUAL = { claim: 'sentence', figure: 'figure', statistic: 'stat', guarantee: 'quote', testimonial: 'text', weak_figure: 'sentence' };   // W0-H: a weak-only figure the editor wrote in this run is the system's to remove
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
md = PF.toc(N.md, S(F.input_markdown)).md;   // fu-finalize-toc: the contents list follows the headings after the system's own rewrite
const finalCls = PF.residual({ ...cls, blocking: judged }, md);
// W0-B (2026-10-29, page-quality PLAN Fix 2, REVIEW_CODE H2 / M8, owner decision D2): the page run's blockers travel with the page. Finalize
// 3336 dropped "this website already has a page for the same search" because this check never saw it and has no list of the website's
// pages to find it again; it said "Ready" at 100. Each blocker of the page run (`prc.gating.qa_blocking`, from the ORIGINAL report) is:
//   * measured again here when this check can see it on the page itself: a cut-off page, the meta description, the author box, the
//     business name (when the style guide travelled), the unsupported statements, figures, guarantees, testimonials and brackets;
//   * kept open when this check cannot see it: the duplicate page (until the client decides: rewrite it as an update of that page, or say
//     how this page differs, recorded and shown, the fit limit kept in the grade), a passage copied from another page (until none of the
//     passages the first check found is left), a dead link (while the link is still there), a section the verdict said to leave out (while
//     its heading is still there), the business name without the style guide, and any blocker this check does not know;
//   * and when the request did not carry the page run's blockers at all, nothing can say the page is ready.
const PR = P.prc || {}; const PG = PR.gating || {}; const DEC = PR.duplicate_decision || null;
const has0 = new Set(finalCls.blocking.map(x => x.code));
const RECHECKED = new Set(['cut_off', 'meta', 'author_profile', 'claim', 'figure', 'statistic', 'guarantee', 'testimonial', 'bracket', 'weak_figure']);   // W0-H: PF.classify measures weak-only figures again
const carried = [], resolved = [];
const urlIn = (t) => (S(t).match(/https?:\/\/[^\s"<>)]+/) || [''])[0].replace(/[.,;:]+$/, '');
let dupOpen = null, decision = null;
for (const b of (PG.qa_blocking || [])) {
  const code = S(b.code) || 'other'; const keep = (x) => { if (!has0.has(code) && !carried.some(c => c.code === code && c.text === x.text)) { const c0 = { code, tier: 'hard', text: S(b.text), action: S(b.action), ...x }; c0.text = PF.clean(c0.text); carried.push(c0); } };
  if (code === 'duplicate_page') {
    const urls = (PR.duplicate_urls || []).length ? PR.duplicate_urls : (b.urls || []);
    if (DEC && DEC.applies !== false) { decision = { code, choice: DEC.choice, url: DEC.url, reason: DEC.reason, pages: urls.slice(0, 3) }; resolved.push(code); }
    else { dupOpen = { urls }; keep({ urls, text: 'This website already has a page for the same search: ' + (urls.slice(0, 2).join(', ') || 'see the first check') + '. Publish this text as an update of that page, or tell us how the new page differs',
      action: 'rewrite it as an update of that page (a new page run that keeps its address), or tell us how this page differs' }); }
  } else if (code === 'copied') {
    const ps = (PG.copied_passages || []).filter(Boolean); const page = norm(md); const left = ps.filter(p => page.includes(norm(p)));
    if (ps.length && !left.length) resolved.push(code); else keep(ps.length ? {} : { text: S(b.text) + ' (the first check found it; this check cannot compare with the other page, so it stays until you rewrite those passages in a new page run)' });
  } else if (code === 'dead_link') { const u = urlIn(b.text); if (u && md.includes('](' + u)) keep({}); else resolved.push(code); }
  else if (code === 'off_topic') { const h = (S(b.text).match(/"([^"]{3,200})"/) || [])[1] || ''; if (h && new RegExp('^#{2,4}\\s+' + h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm').test(md)) keep({}); else resolved.push(code); }
  else if (code === 'brand') { if (P.style_guide) resolved.push(code + ':rechecked'); else keep({ text: S(b.text) + ' (found by the first check; your style guide did not travel with this page, so it is not checked again here)' }); }
  else if (RECHECKED.has(code)) resolved.push(code + ':rechecked');
  // W0-H (Fix 3b): what the second read of the page run quoted stays open while those words are on the page, and is resolved once they are gone
  else if (code === 'review') { const q = (S(b.text).match(/"([^"]{8,300})"/) || [])[1] || ''; if (q && PF.onPage(q, md)) keep({}); else resolved.push(code); }
  else keep({});
}
// the request did not carry what stopped the page in its first check: this version cannot be called ready on that basis
const NAMES = { qa_blocking: 'what stopped the page in its first check', duplicate_targets: 'the pages your website already has for this search' };
if (!PR.blocks_known) carried.push({ code: 'not_checked', tier: 'hard', text: 'We could not read ' + (PR.gating_missing || ['qa_blocking']).map(k => NAMES[k] || k).join(' and ') + ', so this version cannot be called ready',
  action: 'make the final version again from the page in your content list, so its first check travels with it' });
finalCls.blocking = carried.concat(finalCls.blocking);
finalCls.hard = finalCls.blocking.filter(x => x.tier === 'hard').reduce((s0, x) => s0 + (x.weight || 1), 0);
// a new question for every statement the system had to take back (fact keys the website decided, or that were answered now, are never asked)
const skipKeys = new Set([...(F.stored_keys || []), ...(F.answered_keys || [])]);
const claims = N.removed.filter(r => r.code === 'claim').map(r => ({ sentence: r.sentence, kind: r.kind || 'process', rewrite: r.rewrite || null, neutral: r.how === 'reworded' || r.how === 'cta' ? r.text : '', how: r.how }));
const qs0 = claims.length ? PF.questions({ claims, brief: [], brackets: [], business: ctx.business, final_md: md, docs: [{ source: 'your business facts', text: S(P.business_facts) }], stored: [...skipKeys] }) : [];
const answeredIds = new Set((F.answers || []).map(a => a.id));
const client_questions = qs0.filter(q => !skipKeys.has(q.fact_key)).map((q, i) => ({ ...q, id: 'f' + (i + 1), rank: i + 1 })).filter(q => !answeredIds.has(q.id));
const del = PF.deliver(finalCls, { questions: client_questions });
// W0-B: the carried blockers keep their own action (PF.ACTION knows the codes of this run only), and the next step of an open duplicate
// says what to do, which is not "finish it by hand"
for (const x of del.blocking) { const c = carried.find(y => y.code === x.code && y.text === x.text); if (c && c.action) x.action = PF.clean(c.action); }
if (dupOpen) { const others = [...new Set(del.blocking.filter(x => x.code !== 'duplicate_page').map(x => x.action).filter(Boolean))];
  del.next_step = PF.clean('Your website already has a page for this search (' + (dupOpen.urls[0] || 'see the first check') + '): rewrite this as an update of that page, which is a new page run that keeps its address, or tell us how this page differs and make the final version again.'
    + (others.length ? ' Also: ' + others.join('; ') + '.' : '')); }
else if (!PR.blocks_known) del.next_step = PF.clean('We could not read the first check of this page, so this version is not called ready. Make the final version again from the page in your content list, so its first check travels with it.');
// W0-B: what this check could not measure because the page run's research did not travel with the page (pages written before it was kept)
const NOT_CHECKED = { length_band: 'the length of the pages that rank for this search (the usual length for this kind of page was used)', terms: 'topic coverage against the pages that rank',
  facts: 'the figures against the sources the page was written from', style_guide: 'your style guide (the business name and spelling)', site_urls: 'the links to your own pages against your full list of pages' };
if (PR.received) for (const k of Object.keys(NOT_CHECKED)) if ((PR.grading_missing || []).includes(k)) del.advisory.push({ code: 'not_checked', text: 'Not checked: ' + NOT_CHECKED[k] + '. This page was written before we kept that with it' });
if (decision) del.advisory.unshift({ code: 'duplicate_decision', text: decision.choice === 'update'
  ? 'You chose to publish this text as an update of ' + decision.url + ': publish it at that address, in place of the page there now, not as a new page'
  : 'You chose to publish this as a separate page from ' + (decision.pages[0] || 'the page your website has') + ': "' + decision.reason + '". Two pages for one search can compete with each other, so the grade keeps its limit for fit' });
// W0-B: a page written before the length band was kept with it takes the length points its page run measured against the pages that rank
// (Finalize Parse Brief `length_points`), never 15 of 15 for matching its own word count
// W0-C (2026-10-29, page-quality PLAN Fix 3): on the grade kit's scale length carries no points (advice only), so the length points the
// page run measured are no longer put back into the number; a grade from a check before the kit keeps the rule above
const GD = qa.grade_detail || null;
let score0 = qa.content_score == null ? null : Number(qa.content_score); let breakdown0 = qa.score_breakdown ? { ...qa.score_breakdown } : null;
if (!GD && PR.length_from === 'first_check' && PR.length_points != null && breakdown0 && score0 != null && Number.isFinite(Number(breakdown0.length))) {
  score0 = Math.max(0, Math.min(100, Math.round(score0 - Number(breakdown0.length) + Number(PR.length_points)))); breakdown0.length = Math.round(Number(PR.length_points)); }
// W0-C: the grade of THIS version with the caps only this node knows: a blocker still open (at most 59), the page the website already has
// (fit at most 30% while it is open, and after "this page differs" too: D2 keeps the limit), and the floors (a page with no blocker that is
// under half its points in a part is "Needs work: <part>", never "Ready to publish")
const grade = GR.cap({ score: score0, of: 100, breakdown: breakdown0,
  basis: 'measured on this final version, after your answers and the last full check (' + (GD ? GR.basis : 'structure, readability, specificity, plain language, length') + '), '
    + (PR.length_from === 'page_run' ? 'against the length band, topic terms and sources of the page run'
      : PR.length_from === 'first_check' ? (GD ? 'with the length as the first check measured it against the pages that rank, as advice only (the page run\'s research was not kept with this page)' : 'with the length as the first check measured it against the pages that rank (the page run\'s research was not kept with this page)')
        : 'against the usual length for this kind of page (the page run\'s research was not kept with this page)'),
  blocking: del.blocking.length, advice: del.advisory.length, ...(GD ? { notes: GD.notes || [] } : {}),
  // D2: a page published beside the website's page for the same search keeps the fit limit (GR.cap applies it)
  ...(decision && decision.choice === 'differs' ? { fit_cap: { kept: true, why: 'published as a separate page beside ' + (decision.pages[0] || 'a page for the same search') + ', with your reason recorded' } } : {}) },
  del.blocking, { w0c: GD, decision });
Object.assign(del, GR.deliver(del, grade));
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
  meta: { title: S((d.meta || {}).title), meta_description: S((d.meta || {}).description), slug: S((d.meta || {}).slug),
    // W0-B (D2): published as an update of the website's page for this search: its address and slug
    ...(decision && decision.choice === 'update' ? { target_url: decision.url, slug: (decision.url.replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() || S((d.meta || {}).slug)) } : {}) },
  decision, page_run: { received: !!PR.received, gating_missing: PR.gating_missing || [], grading_missing: PR.grading_missing || [], kept_open: carried.map(x => x.code), resolved },
  applied: (FM.applied || []).map(a => ({ id: a.id, how: a.how, section: S(a.section) })), sections_rewritten: FM.sections_rewritten || [], changes: changes.slice(0, 60),
  delivery_status: del.status,
  delivery: { status: del.status, label: del.label, blocking: del.blocking, advisory: del.advisory, next_step: del.next_step, grade, ...(del.needs_work ? { needs_work: del.needs_work } : {}) },
  client_questions, grade, cost, notes: (FM.notes || []).slice(0, 10), content_score: grade.score,
  basis: 'the content gate of a content run (Content QA + Originality Check, the same node code) over the final version, with your answers and the sentences you wrote counted as on file; no research, no new page',
  writes: 'none'
};
return [{ json: { body, cost_usd: 0, run_cost_usd: cost.claude_usd } }];
