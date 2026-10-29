// W0C1-W0C8 (page-quality programme 2026-10-29, W0-C: PLAN Fix 3, 2.6, 2.9, 5.2; REVIEW_CODE H3 / L1 / L5; REVIEW_EVIDENCE H2 / H3 / M1;
// owner priority of 2026-10-29). The interim reviewer-aligned grade (v5/code/_grade.js, build section 159): one scale out of 100 with
// structure 20 (repetition and list labels cost points), coverage 15, readability 10, specificity 10, plain language 10, sources 15, fit
// 20, length advice only; caps as shares of their part; an open blocker caps the total at 59; READY needs no blocker and every part at or
// above half its points (fit waived after "Write it anyway" and for ladder pages, case studies, AI pages and refreshes; shadow for runs the
// system started); otherwise "Needs work: <part>", still publishable; "95+" from 95.
// Acceptance (PLAN Fix 3 and 5.2):
//   * pin 1: the anonymised finalize 3336 grades <= 70 and is not ready; pin 2: the same with no blocker and the verdict acknowledged
//     grades <= 72 and is not "Ready" (a floor fails); a clean well-formed page with no verdict score grades >= 80 and is Ready (fit "not
//     checked"); one statement restated in six sections costs >= 3 points; a weak-only compliance figure grades lower AND is a soft blocker;
//     verdict 42 acknowledged still caps fit at 40% (8 of 20); the capped shares are the same under two weightings; 100 shows as "95+";
//   * owner priority: the ranking guide 949 (its published version) scores at least as high as every version of the "ms 365 erp" page,
//     passes every floor, and is never pushed into "not ready" or "needs work" by the new parts;
//   * the copy check that decides the editor round is unchanged on every recorded round of 3299 (no page edited more or shortened).
// Fixtures: harness/fixtures/replay_3299.json.gz, replay_3336.json.gz, ranking_guide_949.json (anonymised). Called from scenarios_v5.js.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const show = (label, v) => console.log('   W0-C ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const PLAIN = /[—–…‘’“”]/;
  const gr = async (fn, args) => (await run('GR Kit', [{ json: { fn, args } }], { code: '_grade' }))[0].json.r;
  const pf = async (fn, args) => (await run('PF Kit', [{ json: { fn, args } }], { code: '_page_fix' }))[0].json.r;
  const F99 = R.load('replay_3299.json.gz');
  const F36 = R.load('replay_3336.json.gz');
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const CB = F99.nodes['Build Webhook Response']['0'].items[0].json;
  const BODY = F36.nodes['Finalize Webhook']['0'].items[0].json.body;
  const EDITOR = F36.nodes['Finalize Editor']['0'].items;
  const PB99 = F99.nodes['Parse Brief']['0'].items[0].json;
  const SRC = '__SRC__';
  const PARTS = { structure_frac: 1, coverage_ratio: 1, readability_pts: 15, specificity_pts: 10, clean_pts: 10 };
  const CTX = { keyword: 'erp uae', brand_names: ['Nova&'], domain: 'novaand.example', own_text: '' };
  const READY = (s) => s === 'ready' || s === 'ready_with_questions';
  const gatingOf = (p) => { const m = p.meta || {}; const o = m.originality || {};
    return { qa_blocking: Array.isArray(p.qa_blocking) ? p.qa_blocking : null, duplicate_targets: Array.isArray(o.duplicate_targets) ? o.duplicate_targets : null,
      verdict: p.verdict == null ? null : p.verdict, score: p.score == null ? null : p.score, score_withheld: p.score_withheld === true, page_type: m.page_type || '',
      verdict_acknowledged: p.verdict_acknowledged === true, copied_passages: [], content_request_id: p.request_id || '',
      length_points: (((p.qa_grade || m.grade || {}).breakdown || {}).length ?? null) }; };
  // the Finalize workflow, node by node (the content gate is the content run's own code), the Finalize Editor's answer as recorded
  const chain = async (body) => {
    reset(); delete store['Finalize Editor'];
    const pb = await run('Parse Brief', [{ json: { body, headers: {} } }], { code: 'Finalize__Parse_Brief' });
    if (!pb[0].json.ok) return { bad: pb[0].json };
    mock('Finalize Plan', pb);
    const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
    if (ap[0].json.needs_editor) mock('Finalize Editor', clone(EDITOR));
    const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
    const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
    const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
    const vd = await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' });
    return { pb: pb[0].json, qa: qa[0].json.content_qa || {}, body: vd[0].json.body };
  };
  // a clean, well-formed page: H1, Quick answer, question headings answered, a table, links to strong sources, internal link, CTA last
  const CLEAN = ['Title: ERP in the UAE: how to choose', 'Meta Description: How to choose an ERP in the UAE: the size of your company, the rules for VAT and e-invoicing, and the questions to ask a partner.', 'Slug: erp-uae', '',
    '# ERP in the UAE: how to choose', '', '**Quick answer:** Pick an ERP by the size of your company, the rules you must follow and the partner who will run it.', '',
    '## What is an ERP system?', '', 'An ERP system keeps finance, stock and orders in one place, so each team works from the same records. The [Federal Tax Authority](https://tax.gov.ae/en/taxes/vat.aspx) explains the records a VAT-registered company keeps.', '',
    '## Which ERP suits a small company?', '', 'A small company with one legal entity and simple stock needs a packaged product that a small team can run. Ask for a demo with your own invoices and a short list of reports you print every month.', '',
    '## Which ERP suits a group of companies?', '', 'A group with several legal entities needs consolidation, intercompany postings and shared services. [Microsoft documents](https://learn.microsoft.com/en-us/dynamics365/finance/) how its enterprise product handles them.', '',
    '| Need | Small company | Group |', '|---|---|---|', '| Entities | One | Several |', '| Consolidation | Simple | Built in |', '',
    '## What do e-invoicing rules ask of an ERP?', '', 'The [Ministry of Finance](https://mof.gov.ae/en/about-us/initiatives/einvoicing/) sets out the e-invoicing model and the accredited providers that send invoices for you.', '',
    '## How do you test a partner?', '', 'Ask each partner for two references in your sector and a written plan for data migration. See [our implementation service](https://www.novaand.example/erp-implementation) for how a project runs.', '',
    '## Talk to us', '', 'Book a call and bring your current list of reports.', ''].join('\n');
  const ADD = (md, sec, line) => md.replace(new RegExp('(## ' + sec + '[^\\n]*\\n\\n[^\\n]+)'), '$1 ' + line);

  // ---------- W0C1 the kit: one scale, caps as shares, floors, "95+" ----------
  await guard('W0C1 grade kit', async () => {
    const SN = 'W0C1 (W0-C, PLAN Fix 3) the grade kit: one scale out of 100, caps as shares of their part, the floors, "95+", the clean page Ready with fit not checked';
    reset(); begin(SN); const check = mkCheck(SN);
    const g0 = await gr('local', [PARTS, CLEAN, { ...CTX, prev: {} }, SRC]);
    show('clean page', { score: g0.score, breakdown: g0.breakdown, notes: g0.notes });
    check('the parts are structure 20, coverage 15, readability 10, specificity 10, plain language 10, sources 15, fit 20, length 0 (one scale out of 100)', J(g0.max) === J({ structure: 20, coverage: 15, readability: 10, specificity: 10, clean_language: 10, sources: 15, fit: 20, length: 0 })
      && Object.values(g0.max).reduce((s, x) => s + x, 0) === 100 && g0.breakdown.length === 0, J(g0.max));
    const c0 = await gr('cap', [{ score: g0.score, breakdown: g0.breakdown }, [], { w0c: g0 }]);
    check('a clean well-formed page with no verdict score grades >= 80 and is Ready, fit "not checked" with its full points (REVIEW_CODE L5)', c0.score >= 80 && c0.ready === true && c0.floors.ok
      && g0.items.fit.band === 'not_checked' && g0.breakdown.fit === 20 && /Fit not checked/.test(g0.notes[0]), J({ s: c0.score, f: c0.floors, fit: g0.items.fit }));
    const d0 = await gr('deliver', [{ status: 'ready', label: 'Ready to publish', blocking: [], advisory: [] }, c0]);
    check('its delivered status stays "ready"', d0.status === 'ready' && d0.label === 'Ready to publish', J(d0));
    check('100 and 95 show as "95+", 94 as "94", nothing as ""', (await gr('display', [100])) === '95+' && (await gr('display', [95])) === '95+' && (await gr('display', [94])) === '94' && (await gr('display', [null])) === '', '');
    // verdict 42: capped at 40% of fit, acknowledged or not; the floor waived only after "Write it anyway"
    const g42 = await gr('local', [PARTS, CLEAN, { ...CTX, prev: { verdict_score: 42 } }, SRC]);
    const g42a = await gr('local', [PARTS, CLEAN, { ...CTX, prev: { verdict_score: 42, verdict_acknowledged: true } }, SRC]);
    const c42 = await gr('cap', [{ score: g42.score, breakdown: g42.breakdown }, [], { w0c: g42 }]);
    const c42a = await gr('cap', [{ score: g42a.score, breakdown: g42a.breakdown }, [], { w0c: g42a }]);
    show('verdict 42', { plain: [g42.breakdown.fit, c42.floors], acknowledged: [g42a.breakdown.fit, c42a.floors] });
    check('verdict 42 caps fit at 8 of 20 (40%), also after "Write it anyway": an acknowledgement never changes the points (REVIEW_EVIDENCE H3)', g42.breakdown.fit === 8 && g42a.breakdown.fit === 8 && g42a.score === g42.score, J([g42.breakdown, g42a.breakdown]));
    check('not acknowledged: "Needs work: fit with the search"; acknowledged: the fit floor is waived as your choice and the page can be Ready', !c42.ready && c42.floors.failing.map(x => x.dim).join() === 'fit'
      && c42a.ready && c42a.floors.waived.some(w => w.dim === 'fit' && /your choice/.test(w.why)), J([c42.floors, c42a.floors]));
    const n42 = await gr('deliver', [{ status: 'ready', label: 'Ready to publish', blocking: [], advisory: [] }, c42]);
    check('a floor that fails is "needs_work" with what to do, never "Ready to publish", and blocks nothing', n42.status === 'needs_work' && /^Needs work: fit with the search$/.test(n42.label) && n42.blocking.length === 0
      && n42.needs_work[0].dim === 'fit' && /Write it anyway/.test(n42.needs_work[0].action) && /Nothing stops you publishing/.test(n42.next_step) && !PLAIN.test(J(n42)), J(n42));
    const nr = await gr('deliver', [{ status: 'not_ready', label: 'Not ready', blocking: [{ code: 'cut_off', text: 'x' }], advisory: [] }, c42]);
    check('a not-ready page stays not ready (the floors never soften a blocker)', nr.status === 'not_ready' && nr.label === 'Not ready', J(nr));
    // a ladder page / case study / AI page / refresh: a search score says nothing about it; a run the system started: shadow
    const ex = [['ladder page', { verdict_score: 30, ladder_id: 'lad_x', ladder_rung: 2 }], ['case study', { verdict_score: 30, case_id: 'cs1' }], ['AI answer page', { verdict_score: 30, ai_target: { question: 'what is erp' } }],
      ['refresh', { verdict_score: 30, existing_page_url: 'https://www.novaand.example/erp' }], ['W0-D exemption text', { verdict_score: 30, hold_exempt: 'score: a page of your keyword ladder' }]];
    for (const [n, p] of ex) { const g = await gr('local', [PARTS, CLEAN, { ...CTX, prev: p }, SRC]); const c = await gr('cap', [{ score: g.score, breakdown: g.breakdown }, [], { w0c: g }]);
      check(n + ': fit capped (' + g.breakdown.fit + ' of 20) but its floor waived as the plan\'s choice: Ready', g.breakdown.fit <= 8 && c.ready && c.floors.waived.some(w => w.dim === 'fit' && /chosen by your plan/.test(w.why)), J(c.floors)); }
    const gA = await gr('local', [PARTS, CLEAN, { ...CTX, prev: { verdict_score: 30, client_ip: 'cadence:site_x' } }, SRC]); const cA = await gr('cap', [{ score: gA.score, breakdown: gA.breakdown }, [], { w0c: gA }]);
    check('a run the system started (cadence): the fit floor is recorded only (shadow, D17), the page is not held at "Needs work" for it', cA.ready && cA.floors.shadow.some(s => s.dim === 'fit'), J(cA.floors));
    // blockers and the duplicate page
    const cB = await gr('cap', [{ score: g0.score, breakdown: g0.breakdown }, [{ code: 'claim' }], { w0c: g0 }]);
    check('any open blocker caps the total at 59 and the page is never Ready', cB.score === 59 && !cB.ready, J({ s: cB.score, caps: cB.caps }));
    const cD = await gr('cap', [{ score: g0.score, breakdown: g0.breakdown }, [{ code: 'duplicate_page' }], { w0c: g0 }]);
    const cDd = await gr('cap', [{ score: g0.score, breakdown: g0.breakdown }, [], { w0c: g0, decision: { choice: 'differs', reason: 'x' } }]);
    const cDu = await gr('cap', [{ score: g0.score, breakdown: g0.breakdown }, [], { w0c: g0, decision: { choice: 'update', url: 'https://www.novaand.example/erp' } }]);
    check('an open duplicate page: fit at most 30% (6 of 20); published beside it with a reason (D2): the limit kept; as an update of that page: no limit', cD.breakdown.fit === 6 && cDd.breakdown.fit === 6 && cDu.breakdown.fit === 20
      && cDd.floors.failing.some(x => x.dim === 'fit') && cDd.caps.some(c => c.dim === 'fit' && c.share === 0.3), J([cD.breakdown.fit, cDd.breakdown.fit, cDu.breakdown.fit]));
    check('an old grade (no kit detail) is returned as it was, with its display', J(await gr('cap', [{ score: 100, breakdown: { length: 15 } }, [], {}])) === J({ score: 100, breakdown: { length: 15 }, display: '95+' }), '');
    // caps are shares: the same page under two weightings keeps the same capped shares
    const WB = { structure: 15, coverage: 15, readability: 10, specificity: 10, clean_language: 10, sources: 20, fit: 20 };
    const WC = { structure: 25, coverage: 10, readability: 10, specificity: 10, clean_language: 5, sources: 10, fit: 30 };
    const REP6 = ['Business Central suits companies with a single legal entity, standard distribution processes and a small finance team.'];
    let md6 = CLEAN; for (const s of ['What is an ERP system?', 'Which ERP suits a small company?', 'Which ERP suits a group of companies?', 'What do e-invoicing rules ask of an ERP?', 'How do you test a partner?', 'Talk to us'])
      md6 = ADD(md6, s.replace(/[?]/g, '\\?'), 'Remember: Business Central suits companies with a single legal entity, standard distribution processes and a small finance team.');
    const shares = [];
    for (const W of [null, WB, WC]) { const o = W ? { __src__: true, max: W } : SRC;
      const g = await gr('local', [PARTS, md6, { ...CTX, prev: { verdict_score: 42 } }, o]); const M = g.max;
      shares.push({ fit: g.breakdown.fit, structure: g.breakdown.structure, max: M }); }
    show('capped parts under three weightings', shares.map(s => ({ fit: s.fit + ' of ' + s.max.fit, structure: s.structure + ' of ' + s.max.structure })));
    check('the capped shares are the same under the default and two page-type weightings (fit 40% for a verdict under 50, structure 50% for a statement made 4+ times; whole points, so within half a point)',
      shares.every(s => Math.abs(s.fit - 0.4 * s.max.fit) <= 0.5 && Math.abs(s.structure - 0.5 * s.max.structure) <= 0.5), J(shares));
  });

  // ---------- W0C2 directional checks: repetition, list labels, weak-only figures ----------
  await guard('W0C2 directional', async () => {
    const SN = 'W0C2 (W0-C, PLAN Fix 3 acceptance) one statement restated in six sections costs >= 3 points; one label for two lists costs points; a weak-only compliance figure grades lower and is a soft blocker';
    reset(); begin(SN); const check = mkCheck(SN);
    const base = await gr('local', [PARTS, CLEAN, { ...CTX, prev: {} }, SRC]);
    let md6 = CLEAN; for (const s of ['What is an ERP system\\?', 'Which ERP suits a small company\\?', 'Which ERP suits a group of companies\\?', 'What do e-invoicing rules ask of an ERP\\?', 'How do you test a partner\\?', 'Talk to us'])
      md6 = ADD(md6, s, 'In short, a packaged ERP fits a single entity with standard distribution processes and a small finance team.');
    const r6 = await gr('local', [PARTS, md6, { ...CTX, prev: {} }, SRC]);
    show('restated in six sections', { base: base.score, now: r6.score, structure: [base.breakdown.structure, r6.breakdown.structure], rep: r6.items.repetition });
    check('one statement restated in six sections grades at least 3 points lower than its base, and the note names it', r6.score <= base.score - 3 && r6.items.repetition.worst >= 6 && r6.notes.some(n => /made three or more times/.test(n)), J({ base: base.score, now: r6.score }));
    check('a statement made 4+ times caps structure at half', r6.breakdown.structure <= 10 && r6.caps.some(c => c.dim === 'structure'), J(r6.breakdown));
    const lab = CLEAN.replace('## How do you test a partner?\n\n', '## How do you test a partner?\n\nAsk these three questions:\n\n- Who runs the project?\n- Who owns the data?\n- What does support cost?\n\n')
      .replace('## Which ERP suits a small company?\n\n', '## Which ERP suits a small company?\n\nAnswer three questions:\n\n- How many entities?\n- How many users?\n- Which reports?\n\n');
    const rl = await gr('local', [PARTS, lab, { ...CTX, prev: {} }, SRC]);
    check('one label ("three questions") for two different lists costs structure points', rl.items.list_labels.length === 1 && rl.breakdown.structure < base.breakdown.structure, J(rl.items.list_labels));
    // a weak-only compliance figure (an agency blog alone states a fine)
    const WEAK = 'Companies that miss the e-invoicing deadline face fines of AED 5,000 per month, according to [an agency blog](https://www.agency.example/blog/uae-einvoicing-fines).';
    const mdW = ADD(CLEAN, 'What do e-invoicing rules ask of an ERP\\?', WEAK);
    const gw = await gr('local', [PARTS, mdW, { ...CTX, prev: {} }, SRC]);
    show('weak-only compliance figure', { base: [base.score, base.breakdown.sources], now: [gw.score, gw.breakdown.sources], src: gw.items.sources });
    check('the page with a weak-only compliance figure grades lower; sources lose a third (5 of 15) and stay at 8 of 15 or less', gw.score < base.score && gw.breakdown.sources <= 8 && gw.items.sources.weak_compliance === 1, J({ b: gw.breakdown, s: gw.items.sources }));
    // the same figure on a page that cites well everywhere else: a third off still leaves more than 8, so the cap is what holds it
    let mdS = mdW; for (const [sec, n] of [['What is an ERP system\\?', 1], ['Which ERP suits a small company\\?', 2], ['Which ERP suits a group of companies\\?', 3], ['How do you test a partner\\?', 4], ['Talk to us', 5], ['What is an ERP system\\?', 6], ['Which ERP suits a small company\\?', 7], ['Which ERP suits a group of companies\\?', 8], ['How do you test a partner\\?', 9]])
      mdS = ADD(mdS, sec, 'Point ' + n + ' is documented by [Microsoft](https://learn.microsoft.com/en-us/dynamics365/finance/page-' + n + ').');
    const gs = await gr('local', [PARTS, mdS, { ...CTX, prev: {} }, SRC]);
    check('on a page that otherwise cites well, the weak-only compliance figure caps sources at 8 of 15', gs.breakdown.sources === 8 && gs.caps.some(c => c.dim === 'sources'), J({ b: gs.breakdown.sources, s: gs.items.sources.share }));
    const cls = await pf('classify', [{ outbound_links: [{ url: 'https://www.agency.example/blog/uae-einvoicing-fines', tier: 'weak' }, { url: 'https://mof.gov.ae/en/about-us/initiatives/einvoicing/', tier: 'primary' }], main_content_words: 300 }, mdW, { domain: 'novaand.example', keyword: 'erp uae' }]);
    check('and the same sentence is a soft blocker with a rewrite action (W0-H PF.classify weak_figure)', cls.blocking.some(b => b.code === 'weak_figure' && b.tier === 'soft' && /AED 5,000/.test(b.figure || b.text)), J(cls.blocking));
    check('nothing to source (no figure, no citation) is full points, said so', (await gr('sources', ['# A\n\n## B\n\nPlain words only here.', CTX, SRC])).points === 15, '');
    check('a figure the business states about itself (on file) is not a sourcing question', (await gr('sources', ['## B\n\nWe have served 1,200 clients since 2005.', { ...CTX, own_text: 'We have served 1,200 clients.' }, SRC])).units === 0, '');
    check('a standard\'s number is not a figure', (await gr('sources', ['## B\n\nWe hold ISO 27001 certification for our hosting.', CTX, SRC])).units === 0, '');
  });

  // ---------- W0C3 page run 3299 on the new grade; the copy check that decides the editor round is unchanged ----------
  let pc99 = null; const versions = [];
  await guard('W0C3 replay 3299', async () => {
    const SN = 'W0C3 (W0-C) page run 3299 on the new grade: every round re-graded, the copy check (editor round, "passed") unchanged, the delivered page capped by its duplicate blocker';
    reset(); begin(SN); const check = mkCheck(SN);
    for (const rec of F99.runs['Content QA']) {
      const r = await R.replay(F99, 'Content QA', rec.run); const q = r.first.content_qa || {}; const q0 = r.recordedFirst.content_qa || {};
      versions.push({ v: '3299 Content QA #' + rec.run, score: q.content_score });
      show('3299 Content QA #' + rec.run, { grade: q.content_score, breakdown: q.score_breakdown, copy: q.copy_score, recorded: q0.content_score, sources: q.grade_detail.items.sources, rep: q.grade_detail.items.repetition.count, labels: q.grade_detail.items.list_labels.length });
      check('#' + rec.run + ': the editor round and "passed" decide exactly as recorded (passed_copy, editor_needed, passed, not_ready)', ['passed_copy', 'editor_needed', 'passed', 'not_ready'].every(k => q[k] === q0[k]), J(['passed_copy', 'editor_needed', 'passed', 'not_ready'].map(k => [k, q[k], q0[k]])));
      check('#' + rec.run + ': the copy check is the old six parts (its length part as recorded)', q.copy_breakdown && q.copy_breakdown.length === (q0.score_breakdown || {}).length && Math.abs(q.copy_score - q0.content_score) <= 3, J({ copy: q.copy_score, rec: q0.content_score, cb: q.copy_breakdown, rb: q0.score_breakdown }));
      check('#' + rec.run + ': the grade is on the new scale, never 100, with sources and fit in it (verdict 42: fit 8 of 20; the agency-blog and tracker figures: sources under half)', q.content_score <= 80 && q.score_breakdown.fit === 8 && q.score_breakdown.sources < 7.5 && q.score_breakdown.length === 0, J(q.score_breakdown));
    }
    // the delivered page: Content QA #2 (new) -> the recorded Outbound Link Check output with the new grade -> Originality Check #2 -> Page Candidates #2
    const cq = (await R.replay(F99, 'Content QA', 2)).first.content_qa;
    const ocIn = clone(F99.runs['Originality Check'][2].input); const pick = (q) => ({ content_score: q.content_score, score_breakdown: q.score_breakdown, grade_detail: q.grade_detail, copy_score: q.copy_score, copy_breakdown: q.copy_breakdown });
    ocIn[0].json.content_qa = { ...ocIn[0].json.content_qa, ...pick(cq) };
    const oc = await R.replay(F99, 'Originality Check', 2, { input: ocIn });
    const pc = await R.replay(F99, 'Page Candidates', 2, { input: oc.out });
    pc99 = pc.first; const d = pc99.content_qa.delivery; const g = d.grade;
    versions.push({ v: '3299 delivered (Page Candidates #2)', score: g.score });
    show('3299 delivered', { status: d.status, blocking: d.blocking.map(b => b.code), grade: g.score, display: g.display, breakdown: g.breakdown, floors: g.floors.failing.map(x => x.dim), caps: g.caps.map(c => c.dim + ':' + (c.share || c.to)) });
    check('not ready because of the page the website already has; the grade at most 59 (an open blocker), fit at most 30% (6 of 20)', d.status === 'not_ready' && d.blocking.some(b => b.code === 'duplicate_page') && g.score <= 59 && g.breakdown.fit <= 6 && !g.ready, J({ s: g.score, b: g.breakdown }));
    check('the grade carries its floors (sources under half) and its display, and the basis names the new parts', g.floors.failing.some(x => x.dim === 'sources') && g.display === String(g.score) && /sources 15, fit with the search 20; length is advice only/.test(g.basis), J(g.floors));
    check('the same grade in content_qa.quality (what the report copies)', J(pc99.content_qa.quality.grade) === J(g), '');
    check('what the client reads is plain (no em dash, curly quote or ellipsis character)', !PLAIN.test(J(g)) && !PLAIN.test(J(d.label)), '');
  });

  // ---------- W0C4 the Word / PDF report and the second read print and keep the same grade ----------
  await guard('W0C4 report and second read', async () => {
    const SN = 'W0C4 (W0-C, PLAN 2.9) the Word / PDF report prints the grade the client sees ("95+", the parts out of their maxima, length advice only); a blocker the second read adds caps the grade again; the results page shapes are recorded';
    reset(); begin(SN); const check = mkCheck(SN);
    const N = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_v4.json'), 'utf8')).flatMap(w => w.nodes).map(n => [n.name, n]));
    const bw = N['Build Word File'].parameters.jsCode;
    check('the content-score row reads the delivered grade with its maxima, "95+" and "length is advice only"', /const g = \(qa\.delivery && qa\.delivery\.grade/.test(bw) && /'; length is advice only\)'/.test(bw) && /'95\+'/.test(bw) && !/length ' \+ qa\.score_breakdown\.length \+ '\/15/.test(bw));
    const pa = N['Parse Analysis'].parameters.jsCode; const p6 = N['Pick Top 6'].parameters.jsCode;
    check('Pick Top 6 keeps the top-10 organic results (address, title) on its first item; Parse Analysis records serp_shapes with no points', /serp_top10: __top10/.test(p6) && /KWI\.serpPageTypes\(t10/.test(pa) && /serp_shapes: __serp_shapes,/.test(pa) && /points: 0/.test(pa));
    // Pick Top 6 on a results page: the first item carries the ten results
    mock('Prepare Keyword Run', [{ json: { domain: 'novaand.example' } }]);
    const items = Array.from({ length: 12 }, (_, i) => ({ type: 'organic', rank_group: i + 1, url: 'https://site' + i + '.example/' + (i % 2 ? 'blog/erp-guide' : 'services/erp'), domain: 'site' + i + '.example', title: i % 2 ? 'What is ERP? A guide' : 'ERP implementation services' }));
    const top = await run('Pick Top 6', [{ json: { tasks: [{ result: [{ items }] }] } }]);
    check('the first competitor item carries the top ten results, the others do not repeat them', (top[0].json.serp_top10 || []).length === 10 && !('serp_top10' in top[1].json), J(top[0].json.serp_top10 && top[0].json.serp_top10.length));
    // the second read adds a blocker to a page with none: the grade is capped again
    const gd = await gr('local', [PARTS, CLEAN, { ...CTX, prev: {} }, SRC]);
    const g0 = await gr('cap', [{ score: gd.score, breakdown: gd.breakdown, of: 100 }, [], { w0c: gd }]);
    const item = { output: CLEAN, content_qa: { grade_detail: gd, content_score: gd.score, score_breakdown: gd.breakdown, delivery: { status: 'ready', label: 'Ready to publish', blocking: [], advisory: [], client_questions: [], grade: g0, next_step: '' }, quality: { grade: g0 } } };
    const loc = 'Ministry of Finance sets out the e-invoicing model';
    mock('Second Read Plan', [{ json: { ...clone(item), second_read: { skip: false, mode: 'enforce', model: 'claude-sonnet-5-5' } } }]);
    const resp = { id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: 'end_turn', usage: { input_tokens: 9000, output_tokens: 900 },
      content: [{ type: 'text', text: J({ score: 60, strengths: [], problems: [{ severity: 'high', kind: 'fact', location: loc, issue: 'the model is described wrongly', fix: 'check it' }] }) }] };
    const ap = (await run('Apply Second Read', [{ json: resp }]))[0].json.content_qa;
    show('second read', { status: ap.delivery.status, grade: ap.delivery.grade.score, before: g0.score });
    check('a blocker the second read adds caps the grade at 59, in the delivery and in quality', ap.delivery.status === 'not_ready' && ap.delivery.grade.score <= 59 && g0.score > 59 && ap.quality.grade.score === ap.delivery.grade.score, J({ s: ap.delivery.status, g: ap.delivery.grade.score }));
  });

  // ---------- W0C5 the acceptance pins on finalize 3336 (PLAN 5.2, T8) ----------
  let pin1 = null, pin2 = null;
  await guard('W0C5 3336 pins', async () => {
    const SN = 'W0C5 (W0-C, PLAN 5.2 / T8) finalize 3336: <= 70 and not ready; with no blocker and the verdict acknowledged <= 72 and not "Ready" (a floor fails); never 100';
    reset(); begin(SN); const check = mkCheck(SN);
    const r1 = await chain({ ...clone(BODY), page_run: gatingOf(CB) }); const b1 = r1.body; pin1 = b1.grade;
    versions.push({ v: '3336 final (page run of 3299)', score: b1.grade.score });
    show('pin 1', { status: b1.delivery_status, blocking: b1.delivery.blocking.map(x => x.code), grade: b1.grade.score, breakdown: b1.grade.breakdown, floors: b1.grade.floors && b1.grade.floors.failing.map(x => x.dim) });
    check('pin 1: the final version grades <= 70 and is not ready (production: "Ready" at 100)', b1.grade.score <= 70 && b1.delivery_status === 'not_ready' && b1.content_score === b1.grade.score, J({ s: b1.grade.score, st: b1.delivery_status }));
    const r0 = await chain(clone(BODY)); const b0 = r0.body;
    versions.push({ v: '3336 final (as the app sent it)', score: b0.grade.score });
    check('pin 1, exactly as the app sent it (old format, no page run): not ready, <= 59', b0.grade.score <= 59 && b0.delivery_status === 'not_ready', J({ s: b0.grade.score, st: b0.delivery_status }));
    const ack = { ...gatingOf(CB), qa_blocking: [], duplicate_targets: [], verdict_acknowledged: true };
    const r2 = await chain({ ...clone(BODY), page_run: ack }); const b2 = r2.body; pin2 = b2.grade;
    versions.push({ v: '3336 final (no blocker, acknowledged)', score: b2.grade.score });
    show('pin 2', { status: b2.delivery_status, label: b2.delivery.label, grade: b2.grade.score, display: b2.grade.display, breakdown: b2.grade.breakdown, floors: b2.grade.floors, needs_work: b2.delivery.needs_work });
    check('pin 2: with the blockers emptied and the verdict acknowledged it grades <= 72, never "95+"', b2.grade.score <= 72 && b2.grade.display !== '95+', J({ s: b2.grade.score }));
    check('pin 2: not "Ready": "Needs work" because a floor fails (sources: two figures on an agency blog and a tracker)', !READY(b2.delivery_status) && b2.delivery_status === 'needs_work' && b2.grade.floors.failing.some(x => x.dim === 'sources')
      && /^Needs work: /.test(b2.delivery.label) && (b2.delivery.needs_work || []).length >= 1, J({ st: b2.delivery_status, f: b2.grade.floors }));
    check('pin 2: the acknowledgement keeps fit at 8 of 20 and waives only its floor ("your choice")', b2.grade.breakdown.fit === 8 && b2.grade.floors.waived.some(w => w.dim === 'fit'), J(b2.grade.floors));
    check('pin 2: "Needs work" stops nothing: no blocking point, the app may approve and publish it', b2.delivery.blocking.length === 0, J(b2.delivery.blocking));
    const r3 = await chain({ ...clone(BODY), page_run: { ...ack, verdict_acknowledged: false } }); const b3 = r3.body;
    check('without the acknowledgement: "Needs work" on fit and sources', b3.delivery_status === 'needs_work' && ['fit', 'sources'].every(k => b3.grade.floors.failing.some(x => x.dim === k)), J(b3.grade.floors));
    check('what the client reads is plain', !PLAIN.test(J(b2.delivery)) && !PLAIN.test(J(b2.grade)), '');
  });

  // ---------- W0C6-W0C7 the guide that ranks (owner priority) ----------
  await guard('W0C6 ranking guide 949 in the content run', async () => {
    const SN = 'W0C6 (owner priority 2026-10-29) the published guide that ranks (exec 949) through the content run\'s check: passes every floor, scores at least as high as every version of the "ms 365 erp" page';
    reset(); begin(SN); const check = mkCheck(SN);
    const rec = F99.runs['Content QA'][2];
    const asGuide = async (verdictScore) => {
      const pb = clone(PB99);
      Object.assign(pb, { keyword: G.keyword, page_type: 'Guide', recommended_page: 'Guide', page_role: G.brief.page_role || 'standard', pipeline_source: 'ladder', force_content: true,
        ladder_id: G.brief.ladder_id, ladder_rung: G.ladder_rung, ladder_target_url: G.published_url, existing_page_url: '', secondary_keywords: [], verdict_score: verdictScore,
        length_band: { ok: true, source: 'serp', low: 1800, high: 3000, median: 2898, target_word_count: 2900, sample: 5, kind: 'guide' } });
      pb.content_brief = { ...(pb.content_brief || {}), target_word_count: 2900, secondary_keywords: [] };
      const input = clone(rec.input); input[0].json = { ...input[0].json, ...pb, output: G.live_markdown, qa_round: 1 };
      const pfx = clone(F99.nodes['Page Fix']['2'].items); pfx[0].json.output = G.live_markdown;
      return (await R.replay(F99, 'Content QA', 2, { input, mocks: { 'Parse Brief': [pb], 'Page Fix': pfx, 'Promise Candidates': null }, runIndex: 0 })).first.content_qa;
    };
    const q = await asGuide(null);   // as stored: the guide's verdict score was never kept
    const c = await gr('cap', [{ score: q.content_score, breakdown: q.score_breakdown }, [], { w0c: q.grade_detail }]);
    const d = await gr('deliver', [{ status: 'ready', label: 'Ready to publish', blocking: [], advisory: [] }, c]);
    show('949 guide', { grade: q.content_score, display: c.display, breakdown: q.score_breakdown, sources: q.grade_detail.items.sources, rep: q.grade_detail.items.repetition, labels: q.grade_detail.items.list_labels, copy: q.copy_score });
    check('the guide passes every floor and keeps "Ready" (not "needs work", not "not ready")', c.floors.ok && c.ready && d.status === 'ready', J(c.floors));
    check('no repetition cluster and no list-label collision on the guide (its pairs stay pairs)', q.grade_detail.items.repetition.count === 0 && q.grade_detail.items.list_labels.length === 0, J(q.grade_detail.items.repetition));
    check('its sources are strong (Microsoft documentation, the tax authority, the ministry): at least 12 of 15', q.score_breakdown.sources >= 12, J(q.grade_detail.items.sources));
    const bar = Math.max(...versions.map(v => Number(v.score) || 0));
    show('every version of the ms 365 erp page', versions);
    check('it scores at least as high as EVERY version of the ms 365 erp page (' + versions.length + ' versions, highest ' + bar + ')', q.content_score >= bar && versions.length >= 6, J({ guide: q.content_score, versions }));
    const q42 = await asGuide(42);   // the 3299 run's verdict on the guide's page (RPL4's context): a ladder page, so its fit floor is the plan's choice
    const c42 = await gr('cap', [{ score: q42.content_score, breakdown: q42.score_breakdown }, [], { w0c: q42.grade_detail }]);
    check('with 3299\'s verdict 42 on it (a ladder page): fit capped, floor waived as the plan\'s choice, still Ready and above every ms 365 erp version', c42.ready && c42.floors.waived.some(w => w.dim === 'fit') && q42.content_score >= bar, J({ s: q42.content_score, f: c42.floors }));
    check('the copy check decides the guide\'s editor round as before (copy score kept, length part included)', q.copy_breakdown && q.copy_breakdown.length > 0 && typeof q.copy_score === 'number', J(q.copy_breakdown));
  });
  await guard('W0C7 ranking guide 949 through the final version', async () => {
    const SN = 'W0C7 (owner priority 2026-10-29) the guide that ranks through the final version: not held back by any new part, a grade above every version of the ms 365 erp page, shown as "95+" at most';
    reset(); begin(SN); const check = mkCheck(SN);
    const lines = G.live_markdown.replace(/\s+$/, '').split('\n'); let lastOk = lines.length - 1;
    while (lastOk > 0 && !/[.!?]["')\]*_]*$|\]\([^()\s]*\)$/.test(lines[lastOk].trim())) lastOk--;
    const trimmed = lines.slice(0, lastOk + 1).join('\n') + '\n';
    const gate = { qa_blocking: [], duplicate_targets: [], verdict: null, score: null, score_withheld: false, page_type: 'Guide', verdict_acknowledged: false, copied_passages: [], content_request_id: 'exec-949' };
    const body = { mode: 'finalize', request_id: 'app-fin-949', domain: 'novaand.example', site_id: 'site_novaand-example', keyword: G.keyword, country: 'United Arab Emirates', page_type: 'Guide',
      markdown: trimmed, delivered_markdown: trimmed, client_edited: false, meta: { title: '', meta_description: '', slug: '', h1: '' }, answers: [], page_run: gate,
      business_facts: BODY.business_facts, business_facts_kv: clone(BODY.business_facts_kv), stored_fact_keys: clone(BODY.stored_fact_keys), content_request_id: 'exec-949' };
    const b = (await chain(body)).body;
    const bar = Math.max(...versions.map(v => Number(v.score) || 0), pin1 ? pin1.score : 0, pin2 ? pin2.score : 0);
    show('949 guide final', { status: b.delivery_status, grade: b.grade.score, display: b.grade.display, breakdown: b.grade.breakdown, floors: b.grade.floors });
    check('ready to publish: no blocker, every floor passed (never "Needs work" for the new parts)', READY(b.delivery_status) && b.grade.floors.ok && b.grade.ready, J({ st: b.delivery_status, f: b.grade.floors, bl: b.delivery.blocking }));
    check('its grade is above every version of the ms 365 erp page (' + bar + ') and shown as "95+" at most', b.grade.score >= bar && (b.grade.score < 95 || b.grade.display === '95+'), J({ g: b.grade.score, bar }));
  });

  // ---------- W0C8 the build wiring ----------
  await guard('W0C8 wiring', async () => {
    const SN = 'W0C8 (W0-C) the grade kit is inlined where the grade object is built, in both workflows, and the editor round stays on the copy check';
    reset(); begin(SN); const check = mkCheck(SN);
    const nodesOf = (f) => Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', f), 'utf8')).flatMap(w => w.nodes).map(n => [n.name, n.parameters.jsCode || '']));
    const M = nodesOf('SEO_Agent_v4.json'); const FN = nodesOf('SEO_Agent_Page_Finalize.json'); const PC = nodesOf('SEO_Agent_Publish_Check.json');
    for (const [w, n] of [['main', 'Content QA'], ['main', 'Page Candidates'], ['main', 'Apply Second Read'], ['finalize', 'Content QA'], ['finalize', 'Finalize Verdict'], ['publish check', 'Content QA']]) {
      const js = (w === 'main' ? M : w === 'finalize' ? FN : PC)[n] || '';
      check(w + ' / ' + n + ': the grade kit inlined once, no marker left', (js.match(/const GR = \(\(\) => \{/g) || []).length === 1 && !/\/\*__GRADE__\*\//.test(js), w + ' ' + n);
    }
    check('Content QA decides the editor round and "passed" on the copy check, never on the new grade', /copy_score >= 80 && lenOk/.test(M['Content QA']) && /!\(copy_score >= 90 && crit\.score/.test(M['Content QA']) && !/content_score >= 80 && lenOk/.test(M['Content QA']));
    check('Page Candidates and Finalize Verdict build the grade with GR.cap and the status with GR.deliver', /const grade = GR\.cap\(/.test(M['Page Candidates']) && /GR\.deliver\(del0, grade\)/.test(M['Page Candidates'])
      && /const grade = GR\.cap\(/.test(FN['Finalize Verdict']) && /GR\.deliver\(del, grade\)/.test(FN['Finalize Verdict']));
  });
};
