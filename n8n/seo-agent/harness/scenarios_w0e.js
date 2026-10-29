// W0E1-W0E8 (page-quality programme 2026-10-29, W0-E: PLAN Fix 5; R4 D6 / G15; REVIEW_CODE M4 / M9 / L2; owner priority of 2026-10-29).
// Answers go into the sentence they change instead of being appended, and a homepage slogan is never offered as proof. Tested on the
// recorded production runs (anonymised fixtures, harness/README.md "Replay fixtures"):
//   * page run 3299 offered "Deep UAE & GCC knowledge" (a slogan) as proof of UAE projects, a question and "8 min read" chrome as answers,
//     and gave a removed claim a "neutral" sentence from an unrelated checklist item;
//   * finalize 3336 appended "At Nova&, consultation is free of charge." to a section about product names, wove the slogan into that
//     checklist item, placed the page's own search description into the body and swapped the confirmed claim into the checklist;
//   * the guide that ranks (exec 949) must come through the final version untouched when nothing is answered, and an answer to its call to
//     action must go into its call-to-action sentence.
// The Finalize Editor's answers are the one recorded in production or written here (no model call). Called from scenarios_v5.js.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const show = (label, v) => console.log('   W0-E ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const PLAIN = /[—–…‘’“”]/;
  const norm = (t) => String(t || '').replace(/!?\[([^\[\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`>#|]+/g, ' ').toLowerCase().replace(/[^\p{L}\p{N}%&]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const has = (md, t) => norm(md).includes(norm(t));
  const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
  const F99 = R.load('replay_3299.json.gz');
  const F36 = R.load('replay_3336.json.gz');
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const BODY = F36.nodes['Finalize Webhook']['0'].items[0].json.body;   // the app's finalize request of 3336 (old format)
  const EDITOR = F36.nodes['Finalize Editor']['0'].items;               // the Finalize Editor's recorded answer
  const APPLY0 = F36.nodes['Finalize Apply']['0'].items;                // what Finalize Apply produced in production (the old jobs)
  const pf = async (fn, args) => (await run('_pf', [{ json: { fn, args } }], { code: '_page_fix' }))[0].json.r;
  const CTA_H = 'Talk to Nova& about your MS 365 ERP shortlist';
  const PARTNER_H = 'How to choose a Dynamics 365 ERP partner in Dubai or Abu Dhabi';
  const CHECK_H = 'UAE readiness checklist: VAT, e-invoicing, Arabic, AED and data hosting';
  const ITEM5 = (md) => (String(md).match(/^5\. \*\*Data hosting\.\*\*.*$/m) || [''])[0];
  const ITEM5_0 = ITEM5(BODY.markdown);
  const SECTOR = 'Our sector focus is banking and financial services, trading and manufacturing.';
  const sectionText = (md, h) => { const i = String(md).indexOf('## ' + h); if (i < 0) return ''; const j = String(md).indexOf('\n## ', i + 3); return String(md).slice(i, j < 0 ? undefined : j); };
  const chain = async (body, editor, full) => {
    reset(); delete store['Finalize Editor'];
    const pb = await run('Parse Brief', [{ json: { body, headers: {} } }], { code: 'Finalize__Parse_Brief' });
    if (!pb[0].json.ok) return { bad: pb[0].json };
    mock('Finalize Plan', pb);
    const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
    const jobs = ap[0].json.finalize_apply.jobs;
    if (ap[0].json.needs_editor && editor) { const e = typeof editor === 'function' ? editor(jobs) : editor; if (e !== undefined) mock('Finalize Editor', clone(e)); }
    const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
    if (!full) return { pb: pb[0].json, ap: ap[0].json, mg: mg[0].json, jobs };
    const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
    const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
    const vd = await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' });
    return { pb: pb[0].json, ap: ap[0].json, mg: mg[0].json, jobs, qa: qa[0].json.content_qa || {}, body: vd[0].json.body };
  };
  const how = (applied) => Object.fromEntries((applied || []).map(a => [a.id, a.how]));
  const ed = (secs) => [{ json: { output: { sections: secs } } }];   // a Finalize Editor answer (the node's items)
  // page run 3299, Page Candidates run 1 (the final version planned) and run 2 (the delivered page) on the current code
  let q99 = null, pc1 = null;
  const replay99 = async () => { if (q99) return q99;
    pc1 = (await R.replay(F99, 'Page Candidates', 1, {})).first;
    const pfRec = R.nodeItems(F99, 'Page Fix', 2);
    const r2 = await R.replay(F99, 'Page Candidates', 2, { mocks: { 'Page Fix': [{ json: { ...pfRec[0].json, page_fix: pc1.page_fix } }] } });
    q99 = r2.first.content_qa.client_questions; return q99; };

  // ---------- W0E1 suggestions: never a slogan, chrome or a question, and only one that answers the question's type ----------
  await guard('W0E1 prefill rules', async () => {
    const SN = 'W0E1 (W0-E, PLAN Fix 5.4, R4 D6) a suggested answer is a sentence that answers the question\'s type: never a slogan, chrome, a question or a listing page; the business facts first';
    begin(SN); const check = mkCheck(SN); reset();
    const PROOF_Q = 'Do you have UAE ERP projects with outcomes the client has approved for publication?';
    check('the plan\'s pin: prefillOf("Do you have UAE ERP projects with outcomes...", ["Deep UAE & GCC knowledge"]) is null', (await pf('prefillOf', [PROOF_Q, ['Deep UAE & GCC knowledge']])) === null);
    check('a slogan with a verb is not proof either ("We bring deep UAE and GCC knowledge to every ERP project")', (await pf('prefillOf', [PROOF_Q, ['We bring deep UAE and GCC knowledge to every ERP project with outcomes.']])) === null);
    const DELIVERED_Q = 'Which ERP projects in the UAE have you delivered, and with what outcomes?';
    const proof = await pf('prefillOf', [DELIVERED_Q, ['We delivered ERP projects in the UAE for 12 distributors, cutting month-end close from 10 days to 4.']]);
    check('real proof (projects with a number and an outcome) is offered', proof && /12 distributors/.test(proof.prefill), J(proof));
    check('a proof sentence with no project, client or outcome and no number or link is not', (await pf('prefillOf', [DELIVERED_Q, ['Our team has delivered ERP projects in the UAE with great care.']])) === null);
    const CRED_Q = 'Which Microsoft partner designations does Nova& hold?';
    check('a question is never an answer ("Does Microsoft Dynamics have ERP?" offered for the partner designations in 3299)', (await pf('prefillOf', [CRED_Q, ['Does Microsoft Dynamics have a partner designation Nova& can hold?']])) === null);
    const cred = await pf('prefillOf', [CRED_Q, ['Nova& is a Microsoft Solutions Partner for Business Applications in the UAE.']]);
    check('a credential sentence that names one is offered', cred && /Solutions Partner/.test(cred.prefill), J(cred));
    check('a credential answer must name a credential (no partner, certified, accredited, award...)', (await pf('prefillOf', [CRED_Q, ['Nova& does hold a Microsoft desk in Dubai for every client.']])) === null);
    check('praise is a slogan, not a credential ("your trusted Microsoft partner")', (await pf('prefillOf', [CRED_Q, ['Nova& is your trusted Microsoft partner in Dubai and the wider GCC.']])) === null);
    check('reading-time chrome is never offered ("Dynamics 365 8 min read", 3299 q3 / q7)', (await pf('prefillOf', ['Which Azure region do you deploy Dynamics 365 to?', [{ source: 'https://www.novaand.example/', text: 'Azure region for Dynamics 365 deploy guide 8 min read' }]])) === null);
    check('a listing page is never a source', (await pf('prefillOf', ['Which Azure region do you deploy Dynamics 365 environments to?', [{ source: 'https://www.novaand.example/insights/', text: 'We deploy Dynamics 365 environments to the Azure UAE North region.' }]])) === null);
    const first = await pf('prefillOf', ['Which Azure region do you deploy Dynamics 365 environments to?', [{ source: 'https://www.novaand.example/cloud', text: 'We deploy Dynamics 365 environments to the Azure UAE North region by default.' }, { source: 'your business facts', text: 'We deploy Dynamics 365 environments to Azure UAE North.' }]]);
    check('the business facts come first, even when a website sentence matches better', first && first.source === 'your business facts', J(first));
    const qs = await replay99();
    const pre = Object.fromEntries(qs.map(q => [q.id, q.prefill]));
    show('3299 suggestions now', pre);
    check('replay of page run 3299: q1 (proof), q2 / q3 (credentials) and q7 (detail) have no suggestion (production: a slogan, a question and "8 min read" twice)', ['q1', 'q2', 'q3', 'q7'].every(id => qs.find(q => q.id === id) && !pre[id]), J(pre));
    check('3299: the brief questions still exist (nothing is asked less)', qs.filter(q => q.source === 'brief').length === 5, J(qs.map(q => q.id)));
  });

  // ---------- W0E2 the brief's questions as { question, section, category } ----------
  await guard('W0E2 brief question objects', async () => {
    const SN = 'W0E2 (W0-E, PLAN Fix 5.1, REVIEW_CODE M4) the Strategy Brief returns questions_for_client as { question, section, category }; a plain string (a brief stored before) still works';
    begin(SN); const check = mkCheck(SN); reset();
    const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_v4.json'), 'utf8')); const WF = Array.isArray(wf) ? wf[0] : wf;
    const sch = JSON.parse(WF.nodes.find(n => n.name === 'Parser — Strategy Brief').parameters.inputSchema).properties.questions_for_client;
    check('the parser schema takes objects with question (required), section and category', sch.type === 'array' && sch.items.type === 'object' && J(sch.items.required) === J(['question']) && ['question', 'section', 'category'].every(k => sch.items.properties[k]), J(sch));
    const prompt = WF.nodes.find(n => n.name === 'Strategy Brief').parameters.text;
    check('the Strategy Brief prompt asks for the section the answer changes and its category', /"questions_for_client": \[\{ "question":/.test(prompt) && /"section": "the exact H2/.test(prompt) && /terms \(how an engagement starts/.test(prompt));
    const qs = await pf('questions', [{ claims: [], brief: [{ question: 'What does the first consultation cover, and is it free?', section: CTA_H, category: 'terms' }, 'Is there a client result you are happy to publish?', { question: '' }, null],
      brackets: [], business: 'Nova&', final_md: '', docs: [], stored: [] }]);
    show('questions from mixed brief items', qs.map(q => ({ id: q.id, slot: q.slot, cat: q.category, kind: q.kind, section: q.section })));
    const o = qs.find(q => /consultation/.test(q.question)); const s0 = qs.find(q => /client result/.test(q.question));
    check('an object keeps its section, its category becomes the slot (terms -> the call to action)', o && o.section === CTA_H && o.slot === 'cta' && o.kind === 'terms' && o.category === 'detail' && o.source === 'brief', J(o));
    check('a string is still read: its category and slot from its words (a client result -> proof)', s0 && s0.category === 'proof' && s0.slot === 'proof' && s0.section === '', J(s0));
    check('empty and null items are skipped (two questions)', qs.length === 2, J(qs.length));
    // Page Candidates with the brief's questions as objects (the shape a new run stores): the same questions, with their sections
    await replay99();
    const PB = clone(F99.nodes['Parse Brief']['0'].items); const strs = PB[0].json.content_brief.questions_for_client;
    PB[0].json.content_brief.questions_for_client = strs.map((t, i) => ({ question: t, section: i === 1 ? CTA_H : '', category: i === 1 ? 'terms' : '' }));
    const pfRec = R.nodeItems(F99, 'Page Fix', 2);
    const r2 = await R.replay(F99, 'Page Candidates', 2, { mocks: { 'Parse Brief': PB, 'Page Fix': [{ json: { ...pfRec[0].json, page_fix: pc1.page_fix } }] } });
    const qo = r2.first.content_qa.client_questions; const q6 = qo.find(q => /first consultation/.test(q.question));
    check('3299 with object questions: the same brief questions, the consultation one carries its section and the call-to-action slot', qo.filter(q => q.source === 'brief').length === 5 && q6 && q6.section === CTA_H && q6.slot === 'cta', J(qo.map(q => [q.id, q.slot, q.section])));
  });

  // ---------- W0E3 a removed statement: no guessed neutral wording, an anchor ----------
  await guard('W0E3 removed claim anchor', async () => {
    const SN = 'W0E3 (W0-E, PLAN Fix 5.3, R4 G15) a statement the system removes carries no "neutral" sentence from elsewhere in the page, and records its anchor (where it stood)';
    begin(SN); const check = mkCheck(SN); reset();
    const qs = await replay99();
    const rm = (pc1.page_fix.removed_final || []).find(x => x.code === 'claim' && x.sentence === SECTOR);
    show('3299 removal', rm);
    check('3299 run 1: the sector claim is removed with its anchor in "How to choose a partner" (the line above it: the last service)', rm && rm.how === 'removed' && rm.anchor && rm.anchor.section === PARTNER_H && /Managed services/.test(rm.anchor.line_before), J(rm));
    const q5 = qs.find(q => q.original === SECTOR);
    check('3299 q5: no neutral wording (production: "Confirm that it meets your sector\'s data rules...", an unrelated checklist item), left out, with its anchor', q5 && q5.neutral === '' && q5.in_page === 'left_out' && q5.anchor && q5.anchor.section === PARTNER_H, J(q5));
    // the delivered run as recorded (its state has no anchors): still no guessed neutral wording
    const old = (await R.replay(F99, 'Page Candidates', 2, {})).first.content_qa.client_questions.find(q => q.original === SECTOR);
    check('replayed on the recorded state (no anchor yet): still no guessed neutral wording', old && old.neutral === '' && old.in_page === 'left_out' && !old.anchor, J(old));
    const SRC = '# T\n\nIntro line here.\n\n## A\n\nFirst sentence here. The claim sits here. Last one here.\n';
    const a = await pf('anchorAt', [SRC, SRC.indexOf('The claim'), 'The claim sits here.'.length]);
    check('PF.anchorAt reads the sentence before and after on the same line', a.section === 'A' && a.before === 'First sentence here.' && a.after === 'Last one here.' && a.line_before === '', J(a));
  });

  // ---------- W0E4 finalize 3336 as recorded (old format): slots, host sentences, the head question, the wrong neutral ----------
  await guard('W0E4 3336 slots', async () => {
    const SN = 'W0E4 (W0-E, PLAN Fix 5.1 / 5.2, REVIEW_CODE L2) finalize 3336 as the app sent it: each answer goes to its slot with the sentence to rewrite named; the search description and a wrong "neutral" sentence change nothing';
    begin(SN); const check = mkCheck(SN);
    const r = await chain(clone(BODY), EDITOR);
    const h = how(r.ap.finalize_apply.applied); const jobs = r.jobs;
    show('3336 applied', r.ap.finalize_apply.applied.map(a => [a.id, a.how, a.slot || '', a.section.slice(0, 30)]));
    show('3336 jobs', jobs.map(j => ({ id: j.id, h: j.heading.slice(0, 40), hosts: j.hosts.map(x => x.slice(0, 70)) })));
    const cta = jobs.find(j => j.heading === CTA_H);
    check('q6 ("is the consultation free of charge") goes to the call to action, and the job names its host sentence (production: appended to "Is Microsoft 365 an ERP?")', cta && cta.answers.includes('q6') && cta.hosts.length === 1 && /consultation/i.test(cta.hosts[0])
      && cta.tasks.some(t => /^Rewrite this sentence so it also states the fact below/.test(t) && t.includes(cta.hosts[0]) && /Do not add the fact as a separate sentence/.test(t)), J(cta));
    check('the CTA host sentence is in that section of the page', !!cta && sectionText(r.pb.output, CTA_H).includes(cta.hosts[0]), cta && cta.hosts[0]);
    check('no job in "Is Microsoft 365 an ERP?" or in the checklist', !jobs.some(j => /^Is Microsoft 365 an ERP/.test(j.heading) || j.heading === CHECK_H), J(jobs.map(j => j.heading)));
    check('q1 (proof) and q2 (credential) go to the partner section, to the sentence that names the business', ['q1', 'q2'].every(id => (jobs.find(j => j.answers.includes(id)) || {}).heading === PARTNER_H) && jobs.find(j => j.heading === PARTNER_H).hosts.every(x => /^Nova& is a Microsoft partner/.test(x)), J(jobs.map(j => [j.heading, j.answers])));
    check('q4 (the page\'s own search description, an old report\'s question) changes nothing in the body', h.q4 === 'head_line' && !has(r.mg.output, 'MS 365 ERP explained for UAE firms'), h.q4);
    check('q5\'s "neutral" sentence is in another section, so it is not swapped: checklist item 5 is unchanged', ITEM5(r.ap.output) === ITEM5_0 && !ITEM5(r.ap.output).includes(SECTOR) && h.q5 === 'placed' && (jobs.find(j => j.answers.includes('q5')) || {}).heading === PARTNER_H, J({ item5: ITEM5(r.ap.output), q5: h.q5 }));
    check('the editor is told to rewrite the named sentence and never to add a fact as a new sentence', /goes INTO the sentence named for it/.test(r.ap.editor_prompt) && /Never add a fact as a new sentence at the end of a paragraph/.test(r.ap.editor_prompt) && !PLAIN.test(r.ap.editor_prompt.split('CURRENT TEXT')[0]));
  });

  // ---------- W0E5 the recorded editor answer: appended answers are refused, nothing is appended ----------
  await guard('W0E5 refuse appended', async () => {
    const SN = 'W0E5 (W0-E, PLAN Fix 5.2, REVIEW_CODE M9) Finalize Merge with the Finalize Editor\'s recorded answer to 3336\'s jobs: every edit that only appended an answer is refused, and nothing is appended in its place';
    begin(SN); const check = mkCheck(SN); reset();
    mock('Finalize Apply', clone(APPLY0)); mock('Finalize Editor', clone(EDITOR));
    const out = (await run('Finalize Merge', clone(APPLY0), { code: 'Finalize__Finalize_Merge' }))[0].json;
    const fm = out.finalize_merge; const h = how(fm.applied);
    show('merge notes', fm.notes);
    check('the edit of "Is Microsoft 365 an ERP?" is refused: "At Nova&, consultation is free of charge." was a separate last sentence', !fm.sections_rewritten.includes('s1') && fm.notes.some(n => /Is Microsoft 365 an ERP/.test(n) && /as a separate sentence/.test(n)), J(fm.notes));
    check('the edit of the checklist is refused: "We bring deep UAE & GCC knowledge to this work." closed data-hosting item 5', !fm.sections_rewritten.includes('s4') && fm.notes.some(n => n.includes(CHECK_H) && /as a separate sentence/.test(n)), J(fm.notes));
    check('the search description put into "Business Central or Finance..." as its own paragraph is refused', !fm.sections_rewritten.includes('s2'), J(fm.sections_rewritten));
    check('no section was rewritten, nothing appended: the page is Finalize Apply\'s, word for word', fm.sections_rewritten.length === 0 && out.output === APPLY0[0].json.output && !/free of charge/i.test(out.output) && !/deep UAE/i.test(out.output), J(fm.sections_rewritten));
    check('each answer of a refused edit is reported not placed, with "tell us where"', ['q1', 'q2', 'q4', 'q6'].every(id => h[id] === 'not_placed') && fm.notes.filter(n => /^Not placed: your answer/.test(n) && /Tell us where it belongs/.test(n)).length === 4 && !PLAIN.test(J(fm.notes)), J(h));
  });

  // ---------- W0E6 new format: the removed claim goes back at its anchor; a host rewrite is accepted, an appended one refused ----------
  await guard('W0E6 3336 new format', async () => {
    const SN = 'W0E6 (W0-E, PLAN Fix 5.2 / 5.3) finalize 3336 with the answers in the new format: the confirmed sector claim goes back where it stood (no editor); the consultation answer rewrites the CTA sentence; an editor that appends it instead is refused';
    begin(SN); const check = mkCheck(SN);
    const qs = await replay99(); const byOrig = (t) => qs.find(q => q.original === t); const byQ = (re) => qs.find(q => re.test(q.question));
    const q5n = byOrig(SECTOR); const q6n = byQ(/first consultation/);
    const ans = (q, decision, text) => ({ id: q.id, fact_key: q.fact_key, source: q.source, decision, text, question: q.question, original: q.original, neutral: q.neutral, in_page: q.in_page, section: q.section, category: q.category, slot: q.slot || '', anchor: q.anchor || null });
    const FREE = 'The first consultation is free of charge.';
    // the gating fields the app derives from the original report (3299's stored callback; app/shared/src/page-review.ts pageRunOf)
    const CB = F99.nodes['Build Webhook Response']['0'].items[0].json;
    const page_run = { qa_blocking: CB.qa_blocking, duplicate_targets: CB.meta.originality.duplicate_targets, verdict: CB.verdict, score: CB.score, score_withheld: false, page_type: CB.meta.page_type, verdict_acknowledged: false, copied_passages: [], content_request_id: '3298' };
    const body = { ...clone(BODY), page_run, answers: [ans(q5n, 'yes', SECTOR), ans(q6n, 'answer', FREE)] };
    const r = await chain(body, (jobs) => ed(jobs.map(j => ({ id: j.id, text: j.text.replace(j.hosts[0], j.hosts[0].replace(/\.$/, '') + '; the first consultation is free of charge.') }))), true);
    const h = how(r.body.applied);
    show('new format applied', r.body.applied.map(a => [a.id, a.how]));
    const partner = sectionText(r.body.markdown, PARTNER_H);
    check('q5: the confirmed claim is back in the partner section, right after the line it followed, with no editor job of its own', h.q5 === 'kept_original' && /Managed services with 24\/7 support\n\nOur sector focus is banking/.test(partner) && !r.jobs.some(j => j.answers.includes(q5n.id)), partner.slice(-500));
    check('checklist item 5 is unchanged', ITEM5(r.body.markdown) === ITEM5_0, ITEM5(r.body.markdown));
    const ctaText = sectionText(r.body.markdown, CTA_H);
    check('q6: the CTA host sentence now says it, in its place; the section was rewritten; "woven"', h[q6n.id] === 'woven' && /consultation request, and we provide 24\/7 support; the first consultation is free of charge\./.test(ctaText) && r.body.sections_rewritten.length === 1, J({ h, rw: r.body.sections_rewritten, cta: ctaText.slice(-400) }));
    check('the duplicate page still blocks (W0-B unchanged by the weaving)', r.body.delivery_status === 'not_ready' && r.body.delivery.blocking[0].code === 'duplicate_page', J(r.body.delivery.blocking.map(b => b.code)));
    // the same answer appended as a paragraph of its own at the end of the call to action: refused, never appended by the system either
    const r2 = await chain(body, (jobs) => ed(jobs.map(j => ({ id: j.id, text: j.text.replace(/\s+$/, '') + '\n\nConsultation is free of charge at Nova&.' }))), true);
    const h2 = how(r2.body.applied);
    check('appended as its own paragraph instead: refused, reported not placed, nothing appended', h2[q6n.id] === 'not_placed' && r2.body.sections_rewritten.length === 0 && !/free of charge/i.test(r2.body.markdown)
      && r2.body.notes.some(n => /as a separate sentence/.test(n)), J({ h2, notes: r2.body.notes }));
    check('the restored claim does not depend on the editor (it is back in that run too)', h2.q5 === 'kept_original' && has(r2.body.markdown, SECTOR));
  });

  // ---------- W0E7 PF.appendedIn: what counts as appended ----------
  await guard('W0E7 appendedIn', async () => {
    const SN = 'W0E7 (W0-E, PLAN Fix 5.2) PF.appendedIn: a new last sentence of a paragraph about something else is appended; a rewritten host sentence, a sentence in the middle and one next to related text are not';
    begin(SN); const check = mkCheck(SN); reset();
    const before = '## Talk to us\n\nUse the five questions on this page, then book a consultation with Nova&. Engagements start with a consultation request.\n';
    const A = 'Consultation is free of charge';
    check('a separate last sentence about something else: appended', !!(await pf('appendedIn', ['## X\n\nAsk the vendor to map each name to an app.\n', '## X\n\nAsk the vendor to map each name to an app. At Nova&, consultation is free of charge.\n', A])));
    check('a paragraph of its own: appended', !!(await pf('appendedIn', [before, before + '\nConsultation is free of charge for every new client.\n', A])));
    check('the host sentence rewritten to say it: not appended', (await pf('appendedIn', [before, before.replace('book a consultation with Nova&.', 'book a free consultation with Nova& (it is free of charge).'), A])) === null);
    check('the last host sentence rewritten: not appended', (await pf('appendedIn', [before, before.replace('Engagements start with a consultation request.', 'Engagements start with a consultation request, and the consultation is free of charge.'), A])) === null);
    check('a new sentence in the middle of a paragraph: not appended', (await pf('appendedIn', ['## X\n\nAsk the vendor to map each name. Then compare the offers.\n', '## X\n\nAsk the vendor to map each name. Consultation is free of charge. Then compare the offers.\n', A])) === null);
    check('a new last sentence next to related text (it shares a fifth of its words): not appended', (await pf('appendedIn', [before, before.replace('Engagements start with a consultation request.', 'Engagements start with a consultation request. The consultation is free of charge.'), A])) === null);
    check('an answer the edit does not carry: nothing to judge (the merge\'s own check reports it lost)', (await pf('appendedIn', [before, before, A])) === null);
  });

  // ---------- W0E8 the guide that ranks (owner priority) ----------
  await guard('W0E8 ranking guide 949', async () => {
    const SN = 'W0E8 (owner priority 2026-10-29) the published guide that ranks (exec 949) through the final version: untouched when nothing is answered, never shortened; an answer to its call to action goes into its call-to-action sentence';
    begin(SN); const check = mkCheck(SN);
    const lines = G.live_markdown.replace(/\s+$/, '').split('\n');
    let lastOk = lines.length - 1; while (lastOk > 0 && !/[.!?]["')\]*_]*$|\]\([^()\s]*\)$/.test(lines[lastOk].trim())) lastOk--;
    const md = lines.slice(0, lastOk + 1).join('\n') + '\n';
    const gate = { qa_blocking: [], duplicate_targets: [], verdict: null, score: null, score_withheld: false, page_type: 'Guide', verdict_acknowledged: false, copied_passages: [], content_request_id: 'exec-949' };
    const base = { mode: 'finalize', request_id: 'app-fin-949', domain: 'novaand.example', site_id: 'site_novaand-example', keyword: G.keyword, country: 'United Arab Emirates', page_type: 'Guide',
      markdown: md, delivered_markdown: md, client_edited: false, meta: { title: '', meta_description: '', slug: '', h1: '' }, answers: [], business_facts: BODY.business_facts,
      business_facts_kv: {}, stored_fact_keys: [], content_request_id: 'exec-949', page_run: gate };
    const r0 = await chain(clone(base), () => { throw new Error('no editor when nothing is answered'); }, true);
    const body0 = (t) => String(t).split('\n').filter(l => !/^(Title|Meta Description|Slug|Primary Keyword):/.test(l)).join('\n').trim();
    check('nothing answered: no editor job, not a word of the guide changed', r0.jobs.length === 0 && body0(r0.mg.output) === body0(r0.pb.output) && words(body0(r0.mg.output)) === words(body0(r0.pb.output)), J({ jobs: r0.jobs.length }));
    check('nothing answered: not held back by anything W0-E adds (no not-placed note, ready)', r0.body.delivery_status !== 'not_ready' && !(r0.body.notes || []).length, J({ s: r0.body.delivery_status, b: r0.body.delivery.blocking }));
    const FREE = 'The first fit consultation is free of charge.';
    const a = { id: 'q1', fact_key: 'detail.first_consultation_free', source: 'brief', decision: 'answer', text: FREE, question: 'What does the first consultation cover, and is it free of charge?', original: '', neutral: '', in_page: 'left_out', section: '', category: 'detail', slot: 'cta', anchor: null };
    const r1 = await chain({ ...clone(base), answers: [a] }, (jobs) => ed(jobs.map(j => ({ id: j.id, text: j.text.replace(j.hosts[0], j.hosts[0].replace(/\.$/, '') + ', and that first consultation is free of charge.') }))), true);
    const job = r1.jobs[0] || {};
    show('949 CTA job', { heading: job.heading, hosts: job.hosts });
    check('the answer goes to the guide\'s own call to action ("Contact our Dubai team ... consultation") in its last section', r1.jobs.length === 1 && job.heading === 'How we assess your Dynamics 365 ERP fit' && /Contact our Dubai team/.test(job.hosts[0] || '') && /consultation/.test(job.hosts[0] || ''), J(job.hosts));
    check('the rewritten call to action is accepted, and the guide only grows by the answer (nothing shortened or flattened)', how(r1.body.applied).q1 === 'woven' && /free of charge/.test(r1.body.markdown) && words(body0(r1.body.markdown)) >= words(body0(r0.body.markdown)) && words(body0(r1.body.markdown)) <= words(body0(r0.body.markdown)) + 12, J({ before: words(body0(r0.body.markdown)), after: words(body0(r1.body.markdown)) }));
    check('the guide keeps its status and its grade with the answer worked in', r1.body.delivery_status === r0.body.delivery_status && typeof r1.body.grade.score === 'number' && r1.body.grade.score >= r0.body.grade.score - 1, J({ s0: r0.body.grade.score, s1: r1.body.grade.score }));
  });
};
