/*__PAGE_FIX__*/
/*__GRADE__*/
/*__EXCLUSIONS__*/
// H1 (2026-10-27, docs/content-quality-2026-10-27/R1 §3.1, §6 rec. 1, 2, 5, 9; R2 §6): never deliver a worse draft than one the run
// already had, and say what the client really receives. Runs after every quality check (Content QA -> Outbound Link Check -> Originality
// Check). Production: in 3 of 4 page runs the one full-page edit made the page worse (exec 949 kept its length but lost the keyword in
// the first 100 words, 4% coverage and two links, and gained 6 promises; execs 2195 and 2552 delivered half a page while a complete
// Copywriter draft existed in the same run), and nothing compared the drafts.
//   1. dead links of this draft: the live replacement the link check found, else the words without the link (a fix that cannot regress)
//   2. the draft is scored by ONE rule (PF.classify / PF.better): hard blockers (cut off, copied, a duplicate page, the brand, the author
//      box), then soft blockers (statements about the business nothing supports, figures a source does not state, brackets, dead links,
//      excluded sections, guarantees, testimonials), then the advisory distance to the targets of the pages that rank. An edit that is
//      not strictly better, or that loses the call to action, the Quick answer, sections or a third of its length, is set aside.
//   3. the next step: another SECTION-TARGETED edit (only the sections with a problem, at most PF.EDIT_MAX rounds, stopping as soon as a
//      round improves nothing), or the final version: the best draft with the system's own neutral rewrite of every soft blocker
//      (a statement nothing supports is deleted, a call to action keeps only its link), checked once more by the whole quality check.
//   4. after that last check: the delivered status (ready / ready_with_questions / not_ready), the grade OF THE DELIVERED PAGE, the
//      client questions (what only the client knows, each with what the page says without it) and the record of every candidate.
// W06-A (2026-10-30, docs/page-quality-2026-10-29/WAVE05.md 3.1): the sections Content QA lists as "a topic the verdict said to leave out"
// are decided again here on the page as it is (EXC.guard: a heading or text that names the topic, else at most one short section, never
// more than 40% of the page), every deletion and every section kept is recorded (page_fix.exclusions_removed / exclusions_kept, and the
// delivery's changes), and the delivered grade caps coverage and fit when the run took 2+ sections or a fifth of the words out (GR.cap
// `removed`). Live (W05 run, K1) six core sections went for one topic, "Dynamics GP and SL", that no heading named.
const d0 = $input.first().json || {};
const prev = $('Parse Brief').first().json || {};
let qa = { ...(d0.content_qa || {}) };
const round = Number(d0.qa_round || qa.round) || 1;
let PFI = null; try { PFI = $('Page Fix').first().json || null; } catch (e) { PFI = null; }
const state0 = round > 1 && PFI && PFI.page_fix && typeof PFI.page_fix === 'object' ? PFI.page_fix : null;
const applied = (PFI && PFI.page_fix_applied) || { fixes: [], removed: [] };
const came = state0 ? (state0.came_from || 'edit') : 'copywriter';
const edits = state0 ? Number(state0.edits) || 0 : 0;
let critique = null; try { critique = ($('Parse Critique').first().json || {}).critique || null; } catch (e) { critique = null; }
const ctx = PF.ctxOf(prev, { critique: edits === 0 ? critique : null });
let md = typeof d0.output === 'string' ? d0.output : '';
const fixes = (state0 ? state0.fixes || [] : []).concat((applied.fixes || []).map(f => 'Round ' + round + ': ' + f));
const removed = (state0 ? state0.removed || [] : []).concat((applied.removed || []).map(r => ({ ...r, round })));
// W06-A: the first draft's size (its H2s and words), so the grade can tell what the run took out of it later
const first = state0 && state0.first ? state0.first : null;
let SMX = null; try { SMX = $('Site Model').first().json.site_model || null; } catch (e) { SMX = null; }
const EXL = Array.isArray(prev.verdict_exclusions) ? prev.verdict_exclusions : EXC.fromVerdict(prev.verdict_changes, []);
const EXF = EXC.familyOf(prev, SMX);
const exRemoved0 = state0 && Array.isArray(state0.exclusions_removed) ? state0.exclusions_removed : [];
const exKept0 = state0 && Array.isArray(state0.exclusions_kept) ? state0.exclusions_kept : [];

// 1. dead links: replaced by the live page the link check proposed, else unlinked (the words stay)
const lc = qa.link_check || {};
if ((lc.dead || []).length) {
  const DL = PF.unlinkDead(md, lc.dead, {});
  if (DL.done.length) {
    md = DL.md;
    qa = { ...qa, link_check: { ...lc, dead: [], dead_fixed: DL.done.map(x => ({ ...x, anchor: ((lc.dead || []).find(y => y.url === x.url) || {}).anchor || '' })) },
      warnings: (qa.warnings || []).filter(w => !/^Dead links/.test(String(w))) };
    fixes.push('Round ' + round + ': ' + DL.done.map(x => x.replaced_with ? 'replaced the dead link ' + x.url + ' with ' + x.replaced_with : 'unlinked the dead link ' + x.url + ' (its words kept)').join('; '));
  }
}

// 2. this draft, by the one rule
const cls = PF.classify(qa, md, ctx);
const cand = { round, source: came === 'copywriter' ? 'copywriter draft' : came === 'finalize' ? 'final version' : 'edit ' + edits, score: PF.score(cls), protect: PF.protect(md, qa, ctx), cls: { band: cls.band } };
const history = (state0 ? state0.history || [] : []).slice();
const prevBest = state0 && state0.best ? state0.best : null;
const sources = state0 ? state0.sources || [] : [];
const keep = (x) => ({ output: x.output, meta: x.meta, schema_blocks: x.schema_blocks, content_qa: x.content_qa, qa_round: x.qa_round, editor_rounds: x.editor_rounds, critique: x.critique, site_profile: x.site_profile });
const marksOf = (q) => ((q.business_promises || []).concat(q.business_claims || [])).map(b => String(b.sentence || '')).filter(Boolean);
// every statement about the business the check flagged in a draft that was (at some point) the best one: each becomes a client question
const claimsIn = (q, page) => { const sp = PF.split(page); return ((q.business_promises || []).concat(q.business_claims || [])).filter(b => b && b.sentence).map(b => {
  const at = String(page).indexOf(b.sentence); const part = at >= 0 ? sp.parts.find(p => at >= p.start && at < p.end) : null;
  // W0-A (PLAN Fix 1.6): a statement found in the head (the meta lines) says so, and PF.questions never asks the client about it
  return { sentence: String(b.sentence), kind: b.kind || 'process', rewrite: b.rewrite || null, section: part ? part.heading : '', where: part ? part.id : (at >= 0 && at < sp.head.length) || b.where === 'meta' ? 'head' : '', cta: !!part && part === sp.parts[sp.parts.length - 1] && part.id !== 's0', round }; }); };
const mergeClaims = (a, b) => { const k = (x) => x.sentence.toLowerCase().replace(/\s+/g, ' ').trim(); const m = new Map((a || []).map(x => [k(x), x])); for (const x of (b || [])) if (!m.has(k(x))) m.set(k(x), x); return [...m.values()]; };
const claimsSeen0 = state0 ? state0.claims_seen || [] : [];
const figsOf = (q) => (q.unverified_figures || []).map(f => String(f.figure)).concat((q.flagged_amounts || []).map(a => String(a.amount)));

if (came === 'finalize') {
  // ---- 4. the delivered page ----
  // a deletion pass for anything the last check still found (a deletion can only take things away; residual() re-reads the page)
  let finalMd = md; let finalCls = cls; let lastRemoved = [];
  if (cls.soft) { const N = PF.neutralize(md, cls, ctx); finalMd = N.md; lastRemoved = N.removed; finalCls = PF.residual(cls, finalMd); }
  history.push({ round, source: cand.source, hard: cand.score.hard, soft: cand.score.soft, adv: cand.score.adv, kept: true, why: 'the best draft with every unsupported statement rewritten or removed, checked again in full' });
  const allRemoved = (state0.removed_final || []).concat(lastRemoved);
  const brief = prev.content_brief || {};
  const seeds = removed.filter(r => r && r.question);
  // the neutral wording each statement got from the system (a call to action that keeps only its link, H2's advice wording) or none (left out).
  // W0-E (PLAN Fix 5.3, R4 G15): a statement the system REMOVED has no neutral wording at all (never a guessed sentence elsewhere in the
  // page), and carries the anchor where it stood, so a "yes" puts it back there
  const viaNeutral = new Map(allRemoved.filter(r => r.code === 'claim' && (r.how === 'cta' || r.how === 'reworded' || r.how === 'removed')).map(r => [String(r.sentence), { how: r.how, text: r.how === 'removed' ? '' : r.text || '', anchor: r.anchor || null }]));
  const claimsAll = mergeClaims(claimsSeen0, claimsIn(qa, md)).map(c => viaNeutral.has(c.sentence) ? { ...c, how: viaNeutral.get(c.sentence).how, neutral: viaNeutral.get(c.sentence).text, anchor: viaNeutral.get(c.sentence).anchor } : c);
  // what the client's own pages and stored facts already say (a question is prefilled from them), and the fact keys already answered
  const docs = [{ source: 'your business facts', text: [prev.business_facts, prev.case_facts_text].filter(Boolean).join('\n') },
    { source: 'your website', text: [].concat(((prev.site_description || {}).site_facts) || []).join('\n') },
    ...(prev.client_pages || []).map(p => ({ source: String((p && p.url) || 'your website'), text: String((p && p.text) || '').slice(0, 20000) }))];
  const stored = Array.isArray(prev.stored_fact_keys) ? prev.stored_fact_keys : (prev.business_facts_kv && typeof prev.business_facts_kv === 'object' ? Object.keys(prev.business_facts_kv) : []);
  // W0-E (REVIEW_CODE M4): the brief's questions are { question, section, category } objects since section 156, plain strings before it
  const briefQs = (Array.isArray(brief.questions_for_client) ? brief.questions_for_client : []).filter(q => q && (typeof q === 'string' || (typeof q === 'object' && q.question)));
  const qs = PF.questions({ claims: claimsAll, brief: briefQs, brackets: seeds, business: ctx.business, names: ctx.names, final_md: finalMd, docs, stored });
  const del0 = PF.deliver(finalCls, { questions: qs });
  const ready = del0.status !== 'not_ready';
  const deliveredFrom = (state0.best || {}).source || 'copywriter draft';
  // W0-C (PLAN Fix 3, REVIEW_CODE H3): the grade of the page you receive, on the grade kit's scale, with the caps only this node knows (an
  // open blocker: at most 59; the page the website already has: fit at most 30%) and the floors; a page with no blocker that fails a floor
  // is "Needs work: <part>" (still publishable), never "Ready to publish"
  const GD = qa.grade_detail || null;
  const removedRun = { ...EXC.removedOf(state0), h2_now: PF.split(finalMd).parts.length - 1 };   // W06-A
  const grade = GR.cap({ score: qa.content_score == null ? null : Number(qa.content_score), of: 100, breakdown: qa.score_breakdown || null,
    basis: 'measured on the page you receive, after every fix and the last full check: ' + (GD ? GR.basis : 'structure, topic coverage, readability, specificity, plain language, length'),
    blocking: del0.blocking.length, advice: del0.advisory.length, first_draft_review: critique && critique.score != null ? Number(critique.score) : null,
    first_draft_review_note: critique && critique.score != null ? 'the reviewer\'s score of the first draft, before any fix; it does not describe the page you receive' : '',
    ...(GD ? { notes: GD.notes || [] } : {}) }, del0.blocking, { w0c: GD, removed: removedRun });
  const del = GR.deliver(del0, grade);
  const delivery = { status: del.status, label: del.label, blocking: del.blocking, advisory: del.advisory, client_questions: qs, grade, next_step: del.next_step, ...(del.needs_work ? { needs_work: del.needs_work } : {}),
    delivered_from: deliveredFrom, edits, candidates: history, stop_reason: state0.stop_reason || '',
    changes: { fixes: fixes.slice(0, 40), removed: allRemoved.map(r => ({ what: r.code, text: PF.clean(String(r.sentence || '')).slice(0, 220), how: r.how || 'removed', now: r.text || '' })).slice(0, 30),
      brackets_removed: removed.filter(r => r && r.token).map(r => ({ token: r.token.slice(0, 160), question: r.question || '', research: r.research || '' })).slice(0, 20),
      // W06-A: every section taken out as a topic the verdict said to leave out (with its words and why), and every one kept with the reason
      sections_removed: ((state0.exclusions_removed || []).length ? state0.exclusions_removed : removedRun.headings.map(h => ({ heading: h, why: 'a topic the verdict said to leave out' }))).slice(0, 12), sections_kept: (state0.exclusions_kept || []).slice(0, 12) },
    sources_verified: sources.map(v => ({ url: v.url, host: v.host, tier: v.tier, figure: v.figure || '', task: v.task })).slice(0, 20),
    contract: { band: (prev.page_contract || {}).band || PF.bandOf(prev), version: (prev.page_contract || {}).version || 1 } };
  const reasons = ready ? [] : del.blocking.map(b => b.text).slice(0, 8);
  const oq = qa.quality && typeof qa.quality === 'object' ? qa.quality : {};
  const finalQa = { ...qa, passed: ready, publishable: ready, not_ready: !ready, editor_needed: false, passed_copy: ready ? true : !!qa.passed_copy,
    quality_label: del.label, not_ready_reasons: reasons, delivery_status: del.status, client_questions: qs, delivery,
    quality: { ...oq, passed: ready, publishable: ready, not_ready: !ready, label: del.label, reasons, delivery_status: del.status, client_questions: qs, blocking: del.blocking, advisory: del.advisory, grade,
      owner_edits: ready ? [] : (oq.owner_edits || []).filter(e => e && e.kind !== 'claim'), body_brackets: PF.bracketsIn(finalMd).length, claims_open: finalCls.blocking.filter(b => b.code === 'claim').length,
      next_step: del.next_step, fix_by: ready ? '' : 'edit', editor_rounds: edits,
      note: ready ? '' : 'After ' + edits + ' editing round' + (edits === 1 ? '' : 's') + ' and the system\'s own rewrite of every statement it could not support, the page still has the problem(s) above: it is delivered as a draft to finish by hand.' } };
  const page_fix = { ...state0, next: 'deliver', came_from: 'finalize', history, removed, removed_final: allRemoved, fixes, claims_seen: claimsAll, delivery_status: del.status };
  return [{ json: { ...d0, output: finalMd, content_qa: finalQa, page_fix } }];
}

// ---- 2b. keep the better of this draft and the best one so far ----
const cmp = PF.better(cand, prevBest);
history.push({ round, source: cand.source, hard: cand.score.hard, soft: cand.score.soft, adv: cand.score.adv, kept: cmp.better, why: cmp.why });
const best = cmp.better ? { ...keep({ ...d0, output: md, content_qa: qa }), score: cand.score, protect: cand.protect, cls: cand.cls, round, source: cand.source } : prevBest;
const bestCls = cmp.better ? cls : PF.classify(best.content_qa || {}, best.output || '', ctx);
if (!cmp.better) fixes.push('Round ' + round + ': the ' + cand.source + ' was set aside (' + cmp.why + '); the ' + best.source + ' is kept');

// ---- 3. the next step ----
const bq = best.content_qa || {};
const qa_marks = marksOf(bq), qa_figure_marks = figsOf(bq);
let base = PF.unmark(best.output || '', qa_marks, qa_figure_marks);
// W06-A: the flagged sections decided again on this page (never more than the budget allows), each deletion and each kept section recorded
const exRemoved = exRemoved0.slice(), exKept = exKept0.slice();
const EXG = EXC.guard(base, bq.excluded_sections || [], EXL, EXF);
for (const x of EXG.remove) { const r = PF.deleteSection(base, x.heading); if (r.done) { base = r.md; if (!exRemoved.some(y => y.heading === x.heading)) exRemoved.push({ heading: x.heading, topic: x.topic, level: x.level, words: x.words, share_pct: x.share_pct, why: x.signal, round });
  fixes.push('Round ' + round + ': removed the section "' + String(x.heading).replace(/^#+\s*/, '') + '" (a topic the verdict said to leave out: "' + x.topic + '", ' + x.signal + ')'); } }
for (const x of EXG.keep) if (!exKept.some(y => y.heading === x.heading)) { exKept.push({ heading: x.heading, topic: x.topic, words: x.words, why: x.why, round });
  fixes.push('Round ' + round + ': kept the section "' + String(x.heading).replace(/^#+\s*/, '') + '" (' + x.why + ')'); }
// a section the budget kept is no longer a blocker: the editor is not asked to delete it, and the final version does not delete it either
const keptH = new Set(EXG.keep.map(x => String(x.heading).toLowerCase()));
if (keptH.size) { bestCls.blocking = bestCls.blocking.filter(b => !(b.code === 'off_topic' && keptH.has(String(b.heading || '').replace(/^#+\s*/, '').trim().toLowerCase())));
  bestCls.soft = bestCls.blocking.filter(b => b.tier === 'soft').length; }
const job = PF.plan(base, bestCls, bq, { ...ctx, critique: edits === 0 ? critique : null });
const worth = job.sections.length > 0 && (bestCls.blocking.length > 0 || bestCls.adv >= 0.5);
const stop_reason = edits >= PF.EDIT_MAX ? 'all ' + PF.EDIT_MAX + ' editing rounds were used'
  : (came === 'edit' && !cmp.better) ? 'the last edit did not improve the page, so the editing stopped'
    : !worth ? 'nothing is left that an edit can improve' : '';
const claims_seen = cmp.better ? mergeClaims(claimsSeen0, claimsIn(qa, md)) : claimsSeen0;
// W06 integration (2026-10-30): the first draft's H2 sections that carry text of their own. A section that held only a bracketed prompt
// for the author ("## Building the business case" + "[Author insight: ...]") is emptied by the bracket fix and dropped; that is no lost
// content, so it is not counted among the sections "lost in editing" that cap coverage and fit (GR.removedCap). Replay 2552 (PFX6).
const contentH2 = (m) => PF.split(m).parts.slice(1).filter(p => String(p.text || '').replace(/^#{2,6}\s.*$/gm, ' ')
  .replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/\[[^\[\]]*\]/g, ' ').split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length >= 5).length;
const common = { v: 1, round, edits, history, best, sources, claims_seen, searched: state0 ? state0.searched || [] : [], removed, fixes, qa_marks, qa_figure_marks, contract_version: (prev.page_contract || {}).version || 1,
  first: first || { h2: contentH2(md), words: Number((cand.protect || {}).words) || 0 }, exclusions_removed: exRemoved, exclusions_kept: exKept };   // W06-A
if (!stop_reason) {
  const page_fix = { ...common, next: 'edit', came_from: 'edit', edit_job: job };
  return [{ json: { ...d0, ...keep(best), output: base, content_qa: bq, page_fix } }];
}
// the final version: the system's own neutral rewrite of every soft blocker, then the whole quality check once more
const N = PF.neutralize(base, bestCls, ctx);
const page_fix = { ...common, next: 'finalize', came_from: 'finalize', stop_reason, removed_final: N.removed, edit_job: null };
return [{ json: { ...d0, ...keep(best), output: N.md, content_qa: bq, page_fix } }];
