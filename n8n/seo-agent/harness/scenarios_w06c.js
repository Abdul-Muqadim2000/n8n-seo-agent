// W06C1-W06C5 (page-quality wave 0.6, 2026-10-30, fix agent W06-C "the two open items"; docs/page-quality-2026-10-29/WAVE06.md sections 1
// and 7; build section 178).
//   Open 1: a final version made from a page that had already lost sections could still read "Ready" (in Wave 0.5 the K1 page that lost six
//   core sections read 83 "Ready" as its final version): Finalize re-graded the page with no memory of the run. Now the content callback's
//   page_run carries `sections_removed`, the app carries it to the finalize request, and Finalize Verdict caps coverage and fit (GR.removedCap)
//   while those sections are still missing.
//   Open 2: Parse Brief (_brief_guard.js) and Brief Context matched the verdict's topics to leave out against the keyword alone; they now pass
//   the keyword family (EXC.familyOf), as Content QA does.
// Pinned here:
//   W06C1 the K1 execution replayed (fixtures/replay_w05_k1.json.gz, anonymised): the delivered check keeps its counts, the callback's page_run
//         carries sections_removed (6 sections, capped, with the reasons); a check from before W06-C sends null
//   W06C2 the K1 final version: with the field "Needs work" with the reason (never Ready); without it (an older report) as before, with
//         the advice "Not checked"
//   W06C3 sections written back lift the cap; a section the client deletes is never counted as "lost in editing"
//   W06C4 the guide that ranks (949) through the final version with the field (nothing taken out): still Ready, nothing capped
//   W06C5 the brief: Parse Brief and Brief Context keep a section / subtopic about the page's own family, and still drop a real excluded topic
// Called from scenarios_v5.js.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const CODE_DIR = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const show = (label, v) => console.log('   W06-C ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const PLAIN = /[—–…‘’“”]/;
  const READY = (s) => s === 'ready' || s === 'ready_with_questions';
  const codes = (list) => (list || []).map(x => x.code);
  const K1 = R.load('replay_w05_k1.json.gz');
  const F36 = R.load('replay_3336.json.gz');
  const F99 = R.load('replay_3299.json.gz');
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const PBK1 = K1.nodes['Parse Brief']['0'].items[0].json;
  const SMK1 = K1.nodes['Site Model']['0'].items[0].json.site_model;
  const BODY = F36.nodes['Finalize Webhook']['0'].items[0].json.body;   // client A's finalize request of 3336 (its business facts)
  const CORE = ['Which Dynamics 365 ERP fits your UAE business?', 'What drives the cost of a Dynamics 365 ERP project?', 'What a Dynamics 365 ERP engagement with Nova& covers'];
  const headsOf = (md) => (String(md || '').match(/^#{2,3} .+$/gm) || []).map(h => h.replace(/^#+\s*/, '').trim());

  // the K1 delivered check on this build (the recorded last check, through the new Page Candidates), and its callback
  let PC2 = null, CBK1 = null;
  const k1Delivered = async () => {
    if (PC2) return PC2;
    reset();
    PC2 = (await R.replay(K1, 'Page Candidates', 2)).out;
    return PC2;
  };
  const callbackOf = async (pcOut, pbItems) => {
    reset();
    mock('Parse Brief', clone(pbItems)); mock('Page Candidates', clone(pcOut));
    const del = pcOut[0].json.content_qa.delivery || {};
    const d = { request_id: 'w05-k1', keyword: PBK1.keyword, domain: 'novaand.example', verdict: 'GO_WITH_CHANGES', verdict_score: PBK1.verdict_score == null ? null : PBK1.verdict_score, score_withheld: false,
      article_markdown: pcOut[0].json.output, article_meta: { page_type: 'Service Page' }, qa_blocking: del.blocking || [], qa_advisory: del.advisory || [], run_ledger: { ai_usd: 1, dfs_usd: 0.1 } };
    return (await run('Build Webhook Response', [{ json: d }]))[0].json;
  };
  // the finalize chain (as scenarios_w0b.js), with no answers: no model call
  const chain = async (body) => {
    reset(); delete store['Finalize Editor'];
    const pb = await run('Parse Brief', [{ json: { body, headers: {} } }], { code: 'Finalize__Parse_Brief' });
    if (!pb[0].json.ok) return { bad: pb[0].json };
    mock('Finalize Plan', pb);
    const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
    if (ap[0].json.needs_editor) mock('Finalize Editor', clone(F36.nodes['Finalize Editor']['0'].items));
    const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
    const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
    const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
    const vd = await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' });
    return { pb: pb[0].json, qa: qa[0].json.content_qa || {}, body: vd[0].json.body };
  };
  // the page-run context as the app builds it (gating fields of the original report + the callback's page_run, PRC_GRADING allow-list)
  const APP_GRADING = ['length_band', 'coverage_target', 'terms', 'facts', 'sources_cited', 'style_guide', 'site_urls', 'serp_shapes', 'regulatory_facts', 'regulatory_topics', 'second_read', 'sections_removed'];
  const pageRunOf = (cb) => { const pr = cb.page_run || {}; const g = {}; for (const k of APP_GRADING) if (pr[k] !== undefined && pr[k] !== null) g[k] = clone(pr[k]);
    return { qa_blocking: clone(cb.qa_blocking || []), duplicate_targets: [], verdict: cb.verdict || null, score: cb.score == null ? null : cb.score, score_withheld: false, page_type: 'Service Page',
      verdict_acknowledged: !!PBK1.hold_ack, copied_passages: [], length_points: null, missing: [], content_request_id: 'w05-k1', ...g }; };
  const k1Body = (md, pr, o = {}) => ({ mode: 'finalize', request_id: 'app-fin-k1', domain: 'novaand.example', site_id: 'site_novaand-example', keyword: PBK1.keyword, country: 'United Arab Emirates', page_type: 'Service Page',
    markdown: md, delivered_markdown: o.delivered || md, client_edited: !!o.edited, meta: { title: '', meta_description: '', slug: '', h1: '' }, answers: [],
    business_facts: BODY.business_facts, business_facts_kv: clone(BODY.business_facts_kv), stored_fact_keys: clone(BODY.stored_fact_keys), content_request_id: 'w05-k1', page_run: pr });

  // ---------- W06C1 the callback carries what the run took out ----------
  await guard('W06C1 K1 callback', async () => {
    const SN = 'W06C1 (W06-C, WAVE06 Open 1) the K1 execution replayed: the delivered check keeps the counts its grade capped on, and the callback\'s page_run carries sections_removed (6 sections, capped, with the reasons)';
    begin(SN); const check = mkCheck(SN);
    const pc = await k1Delivered(); const del = pc[0].json.content_qa.delivery;
    show('K1 delivered (this build)', { status: del.status, grade: del.grade.score, removed: del.grade.removed, removed_run: del.changes.removed_run });
    check('the delivered check keeps its counts (delivery.changes.removed_run: 6 sections taken out, the H2s now)', del.changes.removed_run && del.changes.removed_run.sections === 6 && del.changes.removed_run.h2_now >= 1, J(del.changes.removed_run));
    CBK1 = await callbackOf(pc, K1.nodes['Parse Brief']['0'].items);
    const sr = (CBK1.page_run || {}).sections_removed;
    show('K1 page_run.sections_removed', sr);
    check('page_run.sections_removed: 6 sections, capped by the delivered grade, the H2s delivered', sr && sr.sections === 6 && sr.capped === true && sr.h2_delivered === del.changes.removed_run.h2_now, J(sr));
    check('with the reasons: each section taken out by its heading and why (the six core headings among them)', sr && sr.list.length === 6 && CORE.every(h => sr.list.some(x => x.heading === h)) && sr.list.every(x => x.why), J(sr && sr.list));
    check('in plain words (no em dash, curly quote or ellipsis character)', !PLAIN.test(J(sr)), J(sr));
    check('the callback sends page_run once, with every earlier grading field still there', ['length_band', 'terms', 'facts', 'sources_cited', 'site_urls', 'content_request_id'].every(k => k in (CBK1.page_run || {})), J(Object.keys(CBK1.page_run || {})));
    // a check from before W06-C (3299's recorded Page Candidates carries no removed_run): null, so the final version says "not checked"
    const old = await callbackOf(F99.runs['Page Candidates'][2].output, F99.nodes['Parse Brief']['0'].items);
    check('a check from before W06-C sends sections_removed null (never invented zeros)', old.page_run && old.page_run.sections_removed === null, J(old.page_run && old.page_run.sections_removed));
  });

  // ---------- W06C2 the K1 final version ----------
  await guard('W06C2 K1 final version', async () => {
    const SN = 'W06C2 (W06-C, WAVE06 Open 1) the K1 final version (Accept all on the page that lost six sections): with page_run.sections_removed "Needs work" with the reason, never Ready; without it (an older report) as before, "Not checked"';
    begin(SN); const check = mkCheck(SN);
    const pc = await k1Delivered(); if (!CBK1) CBK1 = await callbackOf(pc, K1.nodes['Parse Brief']['0'].items);
    const md = pc[0].json.output;
    const pr = pageRunOf(CBK1);
    const withF = (await chain(k1Body(md, pr))).body;
    const prOld = clone(pr); delete prOld.sections_removed;
    const oldF = (await chain(k1Body(md, prOld))).body;
    show('K1 final, with sections_removed', { status: withF.delivery_status, label: withF.delivery.label, grade: withF.grade.score, breakdown: withF.grade.breakdown, caps: (withF.grade.caps || []).map(c => c.dim + ':' + (c.share || c.to)), sr: withF.page_run.sections_removed });
    show('K1 final, older report (no field)', { status: oldF.delivery_status, label: oldF.delivery.label, grade: oldF.grade.score, breakdown: oldF.grade.breakdown, advisory: oldF.delivery.advisory.filter(a => a.code === 'not_checked').map(a => a.text.slice(0, 90)) });
    check('with the field: never Ready, "Needs work" (nothing blocks, so not "not ready")', withF.delivery_status === 'needs_work' && withF.grade.ready === false, J({ s: withF.delivery_status, b: codes(withF.delivery.blocking) }));
    check('coverage at most 6 of 15 and fit at most 8 of 20, each cap saying "6 sections were taken out"', withF.grade.breakdown.coverage <= 6 && withF.grade.breakdown.fit <= 8
      && (withF.grade.caps || []).filter(c => c.share === 0.4 && /6 sections were taken out/.test(c.why)).length === 2, J(withF.grade.caps));
    check('the reason is shown: the parts under half say what to write back, and the advice says what the run took out', (withF.delivery.needs_work || []).some(x => /Write back the sections this run took out|lost the sections/.test(x.action))
      && withF.delivery.advisory.some(a => a.code === 'sections_removed' && /6 sections were taken out/.test(a.text)), J({ nw: withF.delivery.needs_work, adv: withF.delivery.advisory.slice(0, 2) }));
    check('"Write it anyway" never waives the fit floor here', !((withF.grade.floors || {}).waived || []).some(w => w.dim === 'fit'), J(withF.grade.floors));
    check('the answer records it (6 still missing, capped)', withF.page_run.sections_removed.checked === true && withF.page_run.sections_removed.missing === 6 && withF.page_run.sections_removed.capped === true, J(withF.page_run.sections_removed));
    check('plain words in the label, the next step and the advice', !PLAIN.test(J(withF.delivery.label) + J(withF.delivery.next_step) + J(withF.delivery.advisory)), '');
    check('without the field (an older report): no cap from it, the grade as before, and the advice "Not checked: whether the page run took sections out of this page"',
      !(oldF.grade.caps || []).some(c => c.share === 0.4 && /taken out/.test(c.why || '')) && !oldF.grade.removed && oldF.page_run.sections_removed.checked === false
      && oldF.delivery.advisory.some(a => a.code === 'not_checked' && /whether the page run took sections out of this page/.test(a.text)) && (oldF.page_run.grading_missing || []).includes('sections_removed'), J({ c: oldF.grade.caps, a: oldF.delivery.advisory }));
    check('the field is what turns it: the older-report version of the same text reads ' + oldF.delivery_status + ' ' + oldF.grade.score + ', the new one needs work at a lower grade',
      withF.grade.score < oldF.grade.score && oldF.grade.breakdown.fit > withF.grade.breakdown.fit, J({ with: withF.grade.score, without: oldF.grade.score }));
  });

  // ---------- W06C3 written back, and the client's own deletions ----------
  await guard('W06C3 written back', async () => {
    const SN = 'W06C3 (W06-C) the final version lifts the cap when the missing sections are written back, and never counts a section the client deleted as "lost in editing"';
    begin(SN); const check = mkCheck(SN);
    const pc = await k1Delivered(); if (!CBK1) CBK1 = await callbackOf(pc, K1.nodes['Parse Brief']['0'].items);
    const delivered = pc[0].json.output; const pr = pageRunOf(CBK1);
    // the client pastes the six sections back: the writer's full draft (the K1 first draft, all six H2 sections) as their edited version
    const full = K1.runs['Page Candidates'][0].input[0].json.output;
    check('the K1 first draft holds the six core sections', CORE.every(h => headsOf(full).includes(h)), J(headsOf(full)));
    const back = (await chain(k1Body(full, pr, { edited: true, delivered }))).body;
    show('K1 final, sections written back', { status: back.delivery_status, grade: back.grade.score, breakdown: back.grade.breakdown, sr: back.page_run.sections_removed });
    check('written back: nothing missing, the six headings found again, no cap from it', back.page_run.sections_removed.missing === 0 && back.page_run.sections_removed.restored.length === 6
      && !(back.grade.caps || []).some(c => c.share === 0.4 && /taken out/.test(c.why || '')) && !back.grade.removed, J({ sr: back.page_run.sections_removed, caps: back.grade.caps }));
    check('... and the fit part is not held at 40% any more', back.grade.breakdown.fit > 8, J(back.grade.breakdown));
    // H2s the page run's edits lost: a synthetic record on the delivered page (7 H2s in the first draft, 2 lost in editing, none deleted on purpose)
    const h2Delivered = (delivered.match(/^## /gm) || []).length;
    const SR = { sections: 0, words: 0, words_before: 0, h2_before: h2Delivered + 2, h2_removed: 0, h2_delivered: h2Delivered, by_edits: 2, share_pct: 0, capped: true, list: [] };
    const cut = delivered.replace(/\n## [^\n]+\n[\s\S]*?(?=\n## )/, '\n');   // the client deletes one more H2 section in the editor
    check('the client\'s version has one H2 fewer', (cut.match(/^## /gm) || []).length === h2Delivered - 1, String((cut.match(/^## /gm) || []).length));
    const own = (await chain(k1Body(cut, { ...pr, sections_removed: SR }, { edited: true, delivered }))).body;
    const why = (own.grade.caps || []).filter(c => c.share === 0.4).map(c => c.why);
    show('K1 final, client deleted one more section', { status: own.delivery_status, why });
    check('a section the client deleted is never counted as lost in editing: still "2 sections were lost in editing", not 3', why.length === 2 && why.every(w => /2 sections were lost in editing/.test(w)), J(why));
    const SR2 = { ...SR, h2_before: h2Delivered + 2, by_edits: 2 };
    const added = delivered.replace(/\n(## [^\n]+\n)/, '\n## Planning the data migration\n\nMap each ledger, open item and history year to its place in the new system before any import is run.\n\n## Training the finance team\n\nTrain the key users first, then give each team its own short guide to the screens it uses every day.\n\n$1');
    const add = (await chain(k1Body(added, { ...pr, sections_removed: SR2 }, { edited: true, delivered }))).body;
    check('two H2 sections written back by the client: no "lost in editing" cap left', !(add.grade.caps || []).some(c => c.share === 0.4), J(add.grade.caps));
  });

  // ---------- W06C4 the guide that ranks ----------
  await guard('W06C4 ranking guide 949', async () => {
    const SN = 'W06C4 (owner priority) the guide that ranks (exec 949) through the final version with page_run.sections_removed (nothing taken out): still Ready, nothing capped; without the field only an advice line';
    begin(SN); const check = mkCheck(SN);
    const lines = G.live_markdown.replace(/\s+$/, '').split('\n');
    let lastOk = lines.length - 1; while (lastOk > 0 && !/[.!?]["')\]*_]*$|\]\([^()\s]*\)$/.test(lines[lastOk].trim())) lastOk--;
    const trimmed = lines.slice(0, lastOk + 1).join('\n') + '\n';   // without the live capture's author box and tag line (as W0B9)
    const h2 = (trimmed.match(/^## /gm) || []).length;
    const gate = { qa_blocking: [], duplicate_targets: [], verdict: null, score: null, score_withheld: false, page_type: 'Guide', verdict_acknowledged: false, copied_passages: [], content_request_id: 'exec-949' };
    const zero = { sections: 0, words: 0, words_before: 0, h2_before: h2, h2_removed: 0, h2_delivered: h2, by_edits: 0, share_pct: 0, capped: false, list: [] };
    const body = (pr) => ({ mode: 'finalize', request_id: 'app-fin-949', domain: 'novaand.example', site_id: 'site_novaand-example', keyword: G.keyword, country: 'United Arab Emirates', page_type: 'Guide',
      markdown: trimmed, delivered_markdown: trimmed, client_edited: false, meta: { title: '', meta_description: '', slug: '', h1: '' }, answers: [],
      business_facts: BODY.business_facts, business_facts_kv: clone(BODY.business_facts_kv), stored_fact_keys: clone(BODY.stored_fact_keys), content_request_id: 'exec-949', page_run: pr });
    const a = (await chain(body({ ...gate, sections_removed: zero }))).body;
    const b = (await chain(body(gate))).body;
    show('949 final', { with: [a.delivery_status, a.grade.score], without: [b.delivery_status, b.grade.score], sr: a.page_run.sections_removed });
    check('with the field: Ready, no cap, nothing missing', READY(a.delivery_status) && a.grade.ready === true && !(a.grade.caps || []).some(c => c.share === 0.4) && a.page_run.sections_removed.missing === 0, J({ s: a.delivery_status, f: a.grade.floors, c: a.grade.caps }));
    check('the same grade with and without the field (only the "Not checked" advice differs)', a.grade.score === b.grade.score && a.delivery_status === b.delivery_status
      && !a.delivery.advisory.some(x => /took sections out/.test(x.text)) && b.delivery.advisory.some(x => /took sections out/.test(x.text)), J({ a: a.grade.score, b: b.grade.score }));
  });

  // ---------- W06C5 the brief matches the topics to leave out against the keyword family ----------
  await guard('W06C5 brief family', async () => {
    const SN = 'W06C5 (W06-C, WAVE06 Open 2) Parse Brief and Brief Context match the verdict\'s topics to leave out against the keyword family (keyword, brief keywords, the site\'s services), as Content QA does';
    begin(SN); const check = mkCheck(SN);
    // the K1 brief as the writer gave it: its kept outline, the four core sections the W05 brief guard dropped, and two sections of its own
    // family (its secondary keyword "Dynamics 365 e-invoicing UAE", its service "Dynamics 365 Business Central")
    const OWN = ['Is Dynamics 365 ready for UAE e-invoicing?', 'Business Central implementation steps for UAE companies'];
    const outline = (PBK1.content_brief.outline || []).map(s => clone(s));
    const extra = ['Which Dynamics 365 ERP fits your UAE business?', 'What a Dynamics 365 ERP engagement with Nova& covers', 'Who a Dynamics 365 ERP project suits in the UAE and GCC', 'What drives the cost of a Dynamics 365 ERP project?']
      .concat(OWN, ['Dynamics GP and SL: what happens to older Microsoft ERPs']).map(h => ({ h2: h, target_words: 200 }));
    const brief = { ...clone(PBK1.content_brief), outline: outline.slice(0, -1).concat(extra, outline.slice(-1)),
      snippet_targets: [{ question: 'Is Dynamics 365 ready for UAE e-invoicing?' }, { question: 'Where is the Dynamics 365 login page?' }] };
    // the verdict's list, plus two topics a verdict could name that are words of the page's own family
    const EXL = clone(PBK1.verdict_exclusions).concat([{ topic: 'e-invoicing', source: 'verdict' }, { topic: 'implementation', source: 'verdict' }]);
    const ctxBC = { ...clone(PBK1), verdict_exclusions: EXL, site_model: clone(SMK1), content_brief: undefined };
    delete ctxBC.content_brief;
    reset(); mock('Brief Context', [{ json: ctxBC }]);
    const pb = (await run('Parse Brief', [{ json: { output: JSON.stringify(brief) } }]))[0].json;
    const heads = (pb.content_brief.outline || []).map(s => s.h2);
    show('Parse Brief outline', { heads, dropped: (pb.brief_adjustments || []).filter(x => /leave out/.test(x)) });
    check('the four core sections the W05 brief dropped are kept', extra.slice(0, 4).every(s => heads.includes(s.h2)), J(heads));
    check('a section about the page\'s own family is kept although a verdict topic is one of its words ("e-invoicing", "implementation")', OWN.every(h => heads.includes(h)), J(heads));
    check('a section that names an excluded topic still goes ("Dynamics GP and SL: ...")', !heads.some(h => /Dynamics GP and SL/.test(h)) && (pb.brief_adjustments || []).some(x => /Dynamics GP and SL/.test(x)), J(pb.brief_adjustments));
    const snips = (pb.content_brief.snippet_targets || []).map(t => t.question);
    check('snippet questions: the family one stays, the "Dynamics 365 login" one goes', snips.includes('Is Dynamics 365 ready for UAE e-invoicing?') && !snips.some(q => /login/.test(q)), J(snips));
    // Brief Context: the subtopics of the page to beat
    const subs = ['E-invoicing readiness in Dynamics 365', 'Business Central implementation phases', 'Dynamics 365 login and portal access', 'Four types of ERP explained'];
    const base = 'TARGET: use at least 90% of the shared terms above.';
    reset();
    mock('Site Model', [{ json: { site_model: clone(SMK1) } }]);
    mock('Parse Verdict', [{ json: { ...clone(ctxBC), coverage_target: { best: { url: 'https://www.rival.example/dynamics-365-guide' }, subtopics: subs }, coverage_digest_base: base, coverage_digest: base } }]);
    const B = (await run('Brief Context', [{ json: {} }]))[0].json;
    show('Brief Context subtopics', { kept: B.coverage_target.subtopics, excluded: (B.subtopics_excluded || []).map(x => x.subtopic + ' (' + x.topic + ')') });
    check('Brief Context keeps the subtopics of the page\'s own family and drops the excluded ones', J(B.coverage_target.subtopics) === J(subs.slice(0, 2)) && (B.subtopics_excluded || []).length === 2, J(B.subtopics_excluded));
    const src = (f) => fs.readFileSync(path.join(CODE_DIR, f + '.js'), 'utf8');
    check('the generated nodes pass the family (Parse Brief EXFB, Brief Context VEXF)', src('Parse_Brief').includes('EXC.prune(brief.outline, EXL, EXFB)') && src('Brief_Context').includes('EXC.match(st, x, VEXF)'), '');
    reset();
  });
};
