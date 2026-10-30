// W06A1-W06A6 (page-quality wave 0.6, 2026-10-30, fix agent W06-A "exclusions and grade guards"; docs/page-quality-2026-10-29/WAVE05.md
// 3.1 and "Deploy readiness" items 1 and 4; build section 177). Live (W05 run, K1 "ms 365 erp") the verdict said to skip "Dynamics GP and
// SL"; EXC.match dropped the tokens under 3 characters, so the topic became the single word "dynamic", nine headings matched it and Page
// Candidates deleted six core sections (2,407 words -> 1,023 delivered). The grade still read 79 "Ready" with fit 20 of 20. Pinned here:
//   W06A1 the matcher: acronyms in capitals, a topic that lost a short word on its full phrase only, one word of the keyword family never
//   W06A2 the deletion budget: a second signal, else at most one short section; never 40% of the page; every decision recorded
//   W06A3 the K1 execution replayed (fixtures/replay_w05_k1.json.gz, anonymised): no core section is deleted, on the new check and on the
//         recorded old list alike
//   W06A4 the K1 page as delivered by the W05 run (1,023 words, 3 H2s): no longer "Ready" (coverage and fit capped, no fit waiver)
//   W06A5 the idea check: an idea restated 4+ times costs structure points, never below half; the guide that ranks has none
//   W06A6 the bands: the ranking guide 949 and K3 / K4-shaped pages keep their band (no new "Needs work"); wiring of the generated nodes
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
  const show = (label, v) => console.log('   W06-A ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const PLAIN = /[—–…‘’“”]/;
  const exc = async (fn, args) => (await run('EXC Kit', [{ json: { fn, args } }], { code: '_exclusions' }))[0].json.r;
  const gr = async (fn, args) => (await run('GR Kit', [{ json: { fn, args } }], { code: '_grade' }))[0].json.r;
  const READY = (s) => s === 'ready' || s === 'ready_with_questions';
  const K1 = R.load('replay_w05_k1.json.gz');
  const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
  const PBK1 = K1.nodes['Parse Brief']['0'].items[0].json;
  const SMK1 = K1.nodes['Site Model']['0'].items[0].json.site_model;
  const GPSL = { topic: 'Dynamics GP and SL', source: 'verdict' };
  // the six H2 sections the W05 run deleted, and the three H3 headings Content QA had also flagged
  const CORE = ['Which Dynamics 365 ERP fits your UAE business?', 'What drives the cost of a Dynamics 365 ERP project?', 'What a Dynamics 365 ERP engagement with Nova& covers'];
  const CORE_H3 = ['How do Teams, Outlook, Excel and Power BI connect to a Dynamics 365 ERP?', 'Is Dynamics 365 ready for UAE e-invoicing?', 'Is Dynamics 365 easy to learn?'];
  const headsOf = (md) => (String(md || '').match(/^#{2,3} .+$/gm) || []).map(h => h.replace(/^#+\s*/, '').trim());
  const wordsOf = (md) => String(md || '').split('\n').filter(l => l.trim() && !/^(Title|Meta Description|Slug)\s*:/i.test(l) && !/^#/.test(l)).join(' ').split(/\s+/).filter(Boolean).length;

  // ---------- W06A1 the matcher ----------
  await guard('W06A1 matcher', async () => {
    const SN = 'W06A1 (W06-A) the exclusions matcher: an acronym in capitals is a word of the topic, a topic that lost a short word matches on its full phrase only, one word of the keyword family never matches';
    reset(); begin(SN); const check = mkCheck(SN);
    const fam = await exc('familyOf', [PBK1, SMK1]);
    show('K1 keyword family', fam);
    check('the K1 family holds the keyword, the brief\'s secondary keywords and the site\'s services', fam.includes('ms 365 erp') && fam.some(x => /Business Central/.test(x)) && fam.length >= 8, J(fam));
    const allHeads = CORE.concat(CORE_H3, ['What are the Microsoft Dynamics 365 products?', 'Business Central vs Dynamics 365 Finance and Supply Chain Management for UAE businesses', 'How do you compare Dynamics 365 proposals like for like?']);
    const hits = [];
    for (const h of allHeads) if (await exc('match', [h, GPSL, fam])) hits.push(h);
    check('"Dynamics GP and SL" matches none of the nine headings the W05 run flagged (it matched all nine before)', hits.length === 0, J(hits));
    check('... and none with the keyword alone either (the acronyms are kept even without the family)', !(await exc('match', [CORE[0], GPSL, 'ms 365 erp'])), '');
    check('a heading that names it does match: "Moving from Dynamics GP and SL to Business Central" (phrase), "Dynamics GP support ends: what SL users do next" (every word)',
      (await exc('how', ['Moving from Dynamics GP and SL to Business Central', GPSL, fam])) === 'phrase' && (await exc('how', ['Dynamics GP support ends: what SL users do next', GPSL, fam])) === 'words', '');
    const t = async (h, topic, f) => exc('match', [h, { topic }, f || 'erp uae']);
    check('"start an IT company": "How to start an IT company in Dubai" matches, "Is it worth starting a company?" does not ("it" is not IT)',
      (await t('How to start an IT company in Dubai', 'start an IT company')) && !(await t('Is it worth it to start a company now?', 'start an IT company')), '');
    check('"AI vs ML": "AI and ML compared for support teams" matches, "Will AI replace your team?" does not', (await t('AI and ML compared for support teams', 'AI vs ML')) && !(await t('Will AI replace your team?', 'AI vs ML')), '');
    check('a lowercase "ai agents pricing" lost a short word: only its full phrase matches ("AI agents pricing in 2026" yes, "Pricing for support agents" no)',
      (await t('AI agents pricing in 2026', 'ai agents pricing')) && !(await t('Pricing for support agents', 'ai agents pricing')), '');
    check('"VAT on B2B": "VAT for B2B sales" matches, "VAT registration steps" does not', (await t('VAT for B2B sales', 'VAT on B2B')) && !(await t('VAT registration steps', 'VAT on B2B')), '');
    check('one word of the keyword family never matches, not even as a phrase ("Dynamics" on the K1 page)', !(await exc('match', ['Dynamics 365 for UAE groups', { topic: 'Dynamics' }, fam])), '');
    check('a topic made only of family words needs its full phrase ("Dynamics 365 ERP" vs "Dynamics 365 for a UAE ERP": no; "Choosing a Dynamics 365 ERP": yes)',
      !(await exc('match', ['Dynamics 365 for a UAE ERP rollout', { topic: 'Dynamics 365 ERP' }, fam])) && (await exc('match', ['Choosing a Dynamics 365 ERP partner', { topic: 'Dynamics 365 ERP' }, fam])), '');
    check('A-18 kept: the verdict\'s "Skip the consultancy-licence ... questions" still matches "How Much Is a Consultancy Licence in Dubai?"',
      (await exc('fromVerdict', [['Skip the consultancy-licence and start-an-IT-company questions, which don\'t match buyer intent'], []])).some(x => /consultancy licence/i.test(x.topic))
      && (await t('How Much Is a Consultancy Licence in Dubai?', 'consultancy licence', 'ai consultant dubai')), '');
    check('two topics that share their long words are both kept by fromVerdict ("Dynamics GP" and "Dynamics SL")', (await exc('fromVerdict', [[], ['Dynamics GP', 'Dynamics SL']])).length === 2, '');
  });

  // ---------- W06A2 the deletion budget ----------
  await guard('W06A2 budget', async () => {
    const SN = 'W06A2 (W06-A) the deletion budget: a section is deleted when its heading names the topic or its text names it twice; otherwise at most one short section; never 40% of the page; every decision recorded';
    reset(); begin(SN); const check = mkCheck(SN);
    const para = (w, n) => Array.from({ length: n }, (_, i) => w + ' ' + i).join(' ');
    const sec = (h, body) => '## ' + h + '\n\n' + body + '\n';
    const page = (secs) => ['Title: Ledger software for groups', '', '# Ledger software for groups', '', para('intro words here', 30), ''].concat(secs).join('\n');
    const L = [{ topic: 'payroll outsourcing' }];
    // three sections share both words of the topic in scattered form, none names it
    const weak3 = page([sec('Payroll and outsourcing in the ledger', para('ledger text about payroll runs and outsourcing of tasks', 20)), sec('Outsourcing the close: payroll first', para('close text', 20)),
      sec('When outsourcing payroll pays off', para('decision text', 20)), sec('Choosing a partner', para('partner text', 40)), sec('Talk to us', 'Book a call.')]);
    const d1 = await exc('decide', [weak3, L, 'ledger software']);
    show('three weak matches', { remove: d1.remove.map(x => x.heading), keep: d1.keep.map(x => x.why) });
    check('three sections that share the topic\'s words without naming it: none deleted, all three kept with the reason', d1.remove.length === 0 && d1.keep.length === 3 && d1.keep.every(x => /none of them names it/.test(x.why)), J(d1));
    const weak1 = page([sec('Outsourcing payroll, briefly', para('short text', 10)), sec('Choosing a partner', para('partner text', 60)), sec('Costs', para('cost text', 60)), sec('Talk to us', 'Book a call.')]);
    const d2 = await exc('decide', [weak1, L, 'ledger software']);
    check('one short section (under 20% of the page) without a second signal may go', d2.remove.length === 1 && d2.keep.length === 0 && d2.remove[0].share_pct <= 20, J(d2));
    const weakBig = page([sec('Outsourcing payroll in detail', para('long text', 120)), sec('Choosing a partner', para('partner text', 40)), sec('Talk to us', 'Book a call.')]);
    const d3 = await exc('decide', [weakBig, L, 'ledger software']);
    check('one section holding more than 20% of the page and not naming the topic is kept', d3.remove.length === 0 && d3.keep.length === 1 && /does not name the topic/.test(d3.keep[0].why), J(d3));
    const strong = page([sec('Payroll outsourcing for groups', para('payroll outsourcing explained', 20)), sec('Why payroll outsourcing fails', para('payroll outsourcing pitfalls', 20)),
      sec('Choosing a partner', para('partner text', 80)), sec('Talk to us', 'Book a call.')]);
    const d4 = await exc('decide', [strong, L, 'ledger software']);
    check('sections whose heading names the topic\'s full phrase are deleted, with that as the reason', d4.remove.length === 2 && d4.remove.every(x => x.signal === 'the heading names the topic'), J(d4));
    const huge = page([sec('Payroll outsourcing for groups', para('a', 80)), sec('Payroll outsourcing costs', para('b', 80)), sec('Payroll outsourcing risks', para('c', 80)), sec('Choosing a partner', para('partner text', 60))]);
    const d5 = await exc('decide', [huge, L, 'ledger software']);
    check('even named sections never take more than 40% of the page: the rest are kept with the reason', d5.words_removed <= d5.words_total * 0.4 && d5.keep.some(x => /more than 40%/.test(x.why)), J({ r: d5.words_removed, t: d5.words_total, k: d5.keep }));
    const named = page([sec('Payroll first, then outsourcing', 'Outsourcing payroll works best for groups. Clean data comes first. Payroll outsourcing needs one owner.'), sec('Choosing a partner', para('partner text', 80)), sec('Costs', para('cost text', 80))]);
    const d6 = await exc('decide', [named, L, 'ledger software']);
    check('a section whose own sentences name the topic\'s words (two sentences) has a second signal, with that reason', d6.remove.length === 1 && d6.remove[0].signal === 'the section names the topic', J(d6));
    const g1 = await exc('guard', [weak3, ['Payroll and outsourcing in the ledger', 'Choosing a partner', 'Talk to us'], L, 'ledger software']);
    check('guard: a flagged list from an older check is decided again (nothing deleted here) and every flagged heading is accounted for', g1.remove.length === 0 && g1.keep.length >= 3 && g1.keep.some(x => /closer reading/.test(x.why)), J(g1));
    const rm = await exc('removedOf', [{ fixes: ['Round 1: removed the section "A" (a topic the verdict said to leave out)', 'Round 2: removed the section "A" (a topic the verdict said to leave out)', 'Round 1: removed the section "B" (a topic the verdict said to leave out: "x", the heading names the topic)'],
      exclusions_removed: [{ heading: 'B', words: 120, level: 2 }], first: { h2: 7, words: 2400 } }]);
    check('removedOf reads the structured record and the older fix notes once each (A and B, 120 words of 2,400)', rm.sections === 2 && rm.words === 120 && rm.words_before === 2400 && rm.h2_removed === 1, J(rm));
  });

  // ---------- W06A3 the K1 execution replayed ----------
  await guard('W06A3 K1 replay', async () => {
    const SN = 'W06A3 (W06-A, WAVE05 3.1) the K1 execution (W05 run, "ms 365 erp", anonymised): no core section is deleted, on the new check and on the recorded old list alike';
    reset(); begin(SN); const check = mkCheck(SN);
    const recQ0 = K1.runs['Content QA'][0].output[0].json.content_qa;
    const recPC0 = K1.runs['Page Candidates'][0].output[0].json;
    show('recorded (W05)', { flagged: (recQ0.excluded_sections || []).length, words_after_round1: wordsOf(recPC0.output), heads_after: headsOf(recPC0.output).length });
    check('as recorded: Content QA flagged 9 sections, all for "Dynamics GP and SL", and round 1 lost the core sections', (recQ0.excluded_sections || []).length === 9 && CORE.every(h => !headsOf(recPC0.output).includes(h)), J(recQ0.excluded_sections));
    const q0 = (await R.replay(K1, 'Content QA', 0)).first;
    const cq = q0.content_qa;
    show('Content QA #0 now', { excluded: cq.excluded_sections, kept: cq.excluded_sections_kept, score: cq.content_score, copy: cq.copy_score });
    check('the new check flags no section of the K1 draft (none of its headings is about Dynamics GP or SL)', Array.isArray(cq.excluded_sections) && cq.excluded_sections.length === 0, J(cq.excluded_sections));
    check('no warning about excluded sections is left for the editor', !(cq.warnings || []).some(w => /topic the verdict said to leave out/.test(w)), J(cq.warnings));
    const recQ0b = K1.runs['Content QA'][0].output[0].json.content_qa;
    check('the copy check is otherwise unchanged (its six parts, apart from that one warning)', Math.abs(cq.copy_score - recQ0b.copy_score) <= 2, J({ now: cq.copy_score, rec: recQ0b.copy_score }));
    // the recorded old list handed to the new Page Candidates (an older check, or a matcher that goes too far): the budget holds
    const pcOld = await R.replay(K1, 'Page Candidates', 0);
    const outOld = pcOld.first.output; const pfOld = pcOld.first.page_fix || {};
    show('Page Candidates #0 on the recorded list', { heads: headsOf(outOld).length, words: wordsOf(outOld), removed: pfOld.exclusions_removed, kept: (pfOld.exclusions_kept || []).length });
    check('on the recorded list of 9: every core section stays (6 H2s and the flagged H3s); nothing is deleted without a second signal', CORE.concat(CORE_H3).every(h => headsOf(outOld).includes(h)) && (pfOld.exclusions_removed || []).length === 0, J(headsOf(outOld)));
    check('each flagged section kept is recorded with its reason, in the state and in the fix notes', (pfOld.exclusions_kept || []).length === 9 && (pfOld.exclusions_kept || []).every(x => x.why) && (pfOld.fixes || []).some(f => /kept the section/.test(f)), J(pfOld.exclusions_kept));
    check('the page keeps its length (about 2,400 words, the W05 run delivered 1,023)', wordsOf(outOld) >= 2000, String(wordsOf(outOld)));
    check('a kept section is no longer a blocker: the editor is not asked to delete it (the edit job names no excluded topic)', !/topic the verdict said to leave out|delete the section/.test(J(pfOld.edit_job || {})), J(pfOld.edit_job && pfOld.edit_job.sections && pfOld.edit_job.sections.map(x => x.problems)).slice(0, 600));
    check('the first draft\'s size is recorded for the grade (H2s and words)', pfOld.first && pfOld.first.h2 >= 6 && pfOld.first.words >= 2000, J(pfOld.first));
    // the whole round on the new code: Content QA #0 -> Originality Check #0 -> Page Candidates #0
    const ocIn0 = clone(K1.runs['Originality Check'][0].input); ocIn0[0].json = { ...ocIn0[0].json, ...q0, content_qa: { ...ocIn0[0].json.content_qa, ...cq, link_check: ocIn0[0].json.content_qa.link_check } };
    const oc = await R.replay(K1, 'Originality Check', 0, { input: ocIn0 });
    const pc = await R.replay(K1, 'Page Candidates', 0, { input: oc.out });
    check('the whole round on the new code: no section removed, the six H2 sections still there', CORE.every(h => headsOf(pc.first.output).includes(h)) && !(pc.first.page_fix.fixes || []).some(f => /removed the section/.test(f)), J(pc.first.page_fix.fixes));
    check('the record is plain (no em dash, curly quote or ellipsis character in what the client can read)', !PLAIN.test(J((pfOld.exclusions_kept || []).map(x => x.why))), '');
  });

  // ---------- W06A4 the K1 page as delivered: never "Ready" ----------
  await guard('W06A4 K1 grade', async () => {
    const SN = 'W06A4 (W06-A, WAVE05 Deploy readiness 4) the K1 page as the W05 run delivered it (1,023 words, 3 H2s after six sections were deleted): coverage and fit capped, no fit waiver, never "Ready"';
    reset(); begin(SN); const check = mkCheck(SN);
    const recPC2 = K1.runs['Page Candidates'][2].output[0].json;
    const recDel = recPC2.content_qa.delivery;
    show('recorded delivery (W05)', { status: recDel.status, grade: recDel.grade.score, breakdown: recDel.grade.breakdown, words: wordsOf(recPC2.output), h2: (recPC2.output.match(/^## /gm) || []).length });
    check('as recorded: "ready_with_questions" (86 here, 79 after the second read) with fit 20 of 20 on a page of about 1,000 words', READY(recDel.status) && recDel.grade.breakdown.fit === 20 && wordsOf(recPC2.output) < 1300, J(recDel.grade.breakdown));
    // (a) the recorded last check, re-graded by the new Page Candidates (GR.cap with what the run took out)
    const pcA = await R.replay(K1, 'Page Candidates', 2);
    const dA = pcA.first.content_qa.delivery; const gA = dA.grade;
    show('Page Candidates #2 now (recorded check)', { status: dA.status, label: dA.label, grade: gA.score, breakdown: gA.breakdown, caps: gA.caps.map(c => c.dim + ':' + (c.share || c.to)), failing: gA.floors.failing.map(x => x.dim), waived: gA.floors.waived });
    check('not "Ready": "Needs work" with topic coverage and fit under half', dA.status === 'needs_work' && !gA.ready && gA.floors.failing.some(x => x.dim === 'coverage') && gA.floors.failing.some(x => x.dim === 'fit'), J({ s: dA.status, f: gA.floors }));
    check('coverage at most 6 of 15 and fit at most 8 of 20, each cap saying why (6 sections taken out)', gA.breakdown.coverage <= 6 && gA.breakdown.fit <= 8 && gA.caps.filter(c => c.share === 0.4 && /6 sections were taken out/.test(c.why)).length === 2, J(gA.caps));
    check('"Write it anyway" does not waive the fit floor when the run took the page\'s sections out', !gA.floors.waived.some(w => w.dim === 'fit'), J(gA.floors.waived));
    check('the next step says what to do in plain words, and the delivery records what was removed', /Write back the sections this run took out|lost the sections/.test(J(dA.needs_work)) && Array.isArray(dA.changes.sections_removed) && !PLAIN.test(J(dA.label) + J(dA.next_step)), J({ nw: dA.needs_work, ch: dA.changes.sections_removed }));
    // (b) the new Content QA on that page (it reads the run's state through Page Fix) -> Originality Check -> Page Candidates
    const q2 = (await R.replay(K1, 'Content QA', 2)).first;
    const gd = q2.content_qa.grade_detail;
    show('Content QA #2 now', { score: q2.content_score || q2.content_qa.content_score, breakdown: q2.content_qa.score_breakdown, removed: gd.items.removed, notes: gd.notes.filter(n => /limited/.test(n)) });
    check('the check itself caps coverage and fit and records what was removed (6 sections)', gd.items.removed && gd.items.removed.capped && gd.items.removed.sections === 6 && q2.content_qa.score_breakdown.fit <= 8 && q2.content_qa.score_breakdown.coverage <= 6, J(gd.items.removed));
    const ocIn2 = clone(K1.runs['Originality Check'][2].input); ocIn2[0].json = { ...ocIn2[0].json, ...q2, content_qa: { ...ocIn2[0].json.content_qa, ...q2.content_qa, link_check: ocIn2[0].json.content_qa.link_check } };
    const oc = await R.replay(K1, 'Originality Check', 2, { input: ocIn2 });
    const pcB = await R.replay(K1, 'Page Candidates', 2, { input: oc.out });
    const dB = pcB.first.content_qa.delivery;
    check('through the whole chain the delivered page is "Needs work", not "Ready"', dB.status === 'needs_work' && !dB.grade.ready, J({ s: dB.status, g: dB.grade.score, b: dB.grade.breakdown }));
    // (c) one section removed is not a cap (the GP / SL section alone may go)
    const one = await gr('removedCap', [{ sections: 1, words: 150, words_before: 2400 }, null]);
    const two = await gr('removedCap', [{ sections: 1, words: 600, words_before: 2400 }, null]);
    const edits = await gr('removedCap', [{ sections: 0, h2_before: 7, h2_removed: 0, h2_now: 5 }, null]);
    check('one short section removed is no cap; a fifth of the words is; two H2s lost in editing are', one === null && two && two.record.share_pct === 25 && edits && edits.record.by_edits === 2, J({ one, two, edits }));
  });

  // ---------- W06A5 the idea check ----------
  // K3- and K4-shaped pages: neutral text with the judges' restated ideas reworded the way the W05 pages restated them (a takeaway, a table
  // row, a closing rule, a decision matrix row), plus enough other sentences that the page's own vocabulary is not counted
  const FILL = ['Start with the reports finance prints every month and the approvals it signs.', 'Ask each vendor for a demo with your own invoices, not a scripted one.',
    'Plan data migration early, because opening balances take longer than people expect.', 'Train key users before go-live and keep them in the project team.',
    'Check how the vendor handles currency revaluation at month end.', 'Agree who owns the integration with the bank before the contract is signed.',
    'Keep a short list of reports that must work on day one.', 'Write down the approval limits each manager has today.', 'Test the warehouse flows with real item codes.',
    'Budget for a support contract after go-live.', 'Ask for references from companies of your size.', 'Review the licence terms for read-only users.',
    'Decide which legacy data you archive instead of migrating.', 'Map each tax code to the new chart of accounts.', 'Name one owner for master data.',
    'Schedule the cutover outside the quarter close.', 'Freeze changes to the old system two weeks before go-live.', 'Keep the old system readable for audit for seven years.'];
  const shaped = (ideaLines) => {
    const secs = ['## How do the two products differ?', '## Which costs should you expect?', '## How long does a rollout take?', '## Which product suits your company?', '## What to ask before you sign', '## Talk to us'];
    const out = ['Title: Alpha Ledger vs Beta Suite', '', '# Alpha Ledger vs Beta Suite', '', '**Quick answer:** ' + ideaLines[0], ''];
    let f = 0;
    secs.forEach((h, i) => { out.push(h, ''); const extra = ideaLines[i + 1]; const lines = FILL.slice(f, f + 3); f = (f + 3) % FILL.length; if (extra) lines.splice(1, 0, extra); out.push(lines.join(' '), ''); });
    return out.join('\n');
  };
  const K3SHAPE = shaped(['Beta Suite fits groups adding subsidiaries across countries that want one native SaaS platform.',
    'As a rule, walk away from Alpha Ledger if you add subsidiaries across countries and want one native platform.',
    '', 'Choose Beta Suite if you are a fast-growing group with many subsidiaries across countries and want one native SaaS platform.',
    'Beta Suite runs subsidiaries across countries on one native SaaS platform.']);
  const K4SHAPE = shaped(['Run discovery and a gap-fit analysis before any fixed scope.', 'Two checks matter most: a gap-fit analysis from discovery before any fixed scope.',
    'A written scope should rest on a gap-fit analysis from discovery.', '', 'Ask for a sample gap-fit analysis from discovery before a fixed scope is signed.', 'Our first stage covers discovery, requirements and a gap-fit analysis.']);
  const PARTS = { structure_frac: 1, coverage_ratio: 1, readability_pts: 15, specificity_pts: 10, clean_pts: 10 };
  await guard('W06A5 ideas', async () => {
    const SN = 'W06A5 (W06-A, WAVE05 Deploy readiness 4) an idea restated 4+ times in 3+ places costs 2 points of structure (up to 4), never below half the part; the guide that ranks has none';
    reset(); begin(SN); const check = mkCheck(SN);
    for (const [name, md, kw] of [['K3-shaped', K3SHAPE, 'alpha ledger vs beta suite'], ['K4-shaped', K4SHAPE, 'erp partner']]) {
      const id = await gr('ideas', [md, { keyword: kw, brand_names: ['Nova&'] }]);
      const loc = await gr('local', [PARTS, md, { keyword: kw, brand_names: ['Nova&'], domain: 'novaand.example', own_text: '' }, '__SRC__']);
      show(name, { ideas: id.ideas.map(x => x.size + 'x ' + x.sample.slice(0, 60)), structure: loc.breakdown.structure, off: loc.items.ideas.points_off });
      const rep = loc.items.repetition.count;
      check(name + ': the restated idea is found (4+ times in 3+ places) and costs structure points once (the idea check, or the statement check when it already counts those sentences)',
        id.count >= 1 && id.worst >= 4 && loc.breakdown.structure < 20 && (rep ? loc.items.ideas.count === 0 : loc.items.ideas.points_off > 0), J({ id, b: loc.breakdown, rep }));
      check(name + ': the note says what to do in plain words', loc.notes.some(n => (rep ? /made three or more times/ : /restated four or more times[^]*Say it once/).test(n)) && !PLAIN.test(J(loc.notes)), J(loc.notes));
      if (!rep) check(name + ': the idea check alone keeps structure at or above half', loc.breakdown.structure >= 10, J(loc.breakdown));
    }
    const fl = await gr('local', [{ ...PARTS, structure_frac: 0.5 }, K3SHAPE, { keyword: 'alpha ledger vs beta suite', brand_names: [], domain: 'novaand.example', own_text: '' }, '__SRC__']);
    check('a page already at half its structure loses nothing more to the idea check (it alone never makes "Needs work")', fl.breakdown.structure === 10 && fl.items.ideas.points_off === 0, J(fl.breakdown));
    const g = await gr('ideas', [G.live_markdown, { keyword: G.keyword, brand_names: ['Nova&'] }]);
    check('the guide that ranks (949): no idea restated four times', g.count === 0, J(g.ideas));
    const plainPage = shaped(['Alpha Ledger and Beta Suite are both cloud ledgers for growing companies.']);
    check('a page that says each thing once has no idea restated', (await gr('ideas', [plainPage, { keyword: 'alpha ledger vs beta suite' }])).count === 0, '');
  });

  // ---------- W06A6 the bands, and the wiring ----------
  await guard('W06A6 bands and wiring', async () => {
    const SN = 'W06A6 (W06-A, owner priority) the ranking guide 949 and K3 / K4-shaped pages keep their band (no new "Needs work"); the generated nodes carry the new kits';
    reset(); begin(SN); const check = mkCheck(SN);
    for (const [name, md, kw] of [['K3-shaped', K3SHAPE, 'alpha ledger vs beta suite'], ['K4-shaped', K4SHAPE, 'erp partner'], ['949 guide', G.live_markdown, G.keyword]]) {
      const loc = await gr('local', [PARTS, md, { keyword: kw, brand_names: ['Nova&'], domain: 'novaand.example', own_text: '' }, '__SRC__']);
      const c = await gr('cap', [{ score: loc.score, breakdown: loc.breakdown }, [], { w0c: loc }]);
      const d = await gr('deliver', [{ status: 'ready_with_questions', label: 'Ready, and stronger with your input', blocking: [], advisory: [] }, c]);
      show(name + ' band', { score: c.score, structure: c.breakdown.structure, status: d.status });
      check(name + ': still "Ready" (every floor passed), the idea check at most 4 points', c.floors.ok && READY(d.status) && loc.items.ideas.points_off <= 4, J({ f: c.floors, s: d.status }));
    }
    // the guide that ranks through the content run's own check (as W0C6 does): Ready, no idea restated, no removal cap
    const F99 = R.load('replay_3299.json.gz'); const PB99 = F99.nodes['Parse Brief']['0'].items[0].json; const rec = F99.runs['Content QA'][2];
    const pb = clone(PB99);
    Object.assign(pb, { keyword: G.keyword, page_type: 'Guide', recommended_page: 'Guide', page_role: G.brief.page_role || 'standard', pipeline_source: 'ladder', force_content: true,
      ladder_id: G.brief.ladder_id, ladder_rung: G.ladder_rung, ladder_target_url: G.published_url, existing_page_url: '', secondary_keywords: [], verdict_score: null,
      length_band: { ok: true, source: 'serp', low: 1800, high: 3000, median: 2898, target_word_count: 2900, sample: 5, kind: 'guide' } });
    pb.content_brief = { ...(pb.content_brief || {}), target_word_count: 2900, secondary_keywords: [] };
    const input = clone(rec.input); input[0].json = { ...input[0].json, ...pb, output: G.live_markdown, qa_round: 1 };
    const pfx = clone(F99.nodes['Page Fix']['2'].items); pfx[0].json.output = G.live_markdown;
    const q = (await R.replay(F99, 'Content QA', 2, { input, mocks: { 'Parse Brief': [pb], 'Page Fix': pfx, 'Promise Candidates': null }, runIndex: 0 })).first.content_qa;
    const c = await gr('cap', [{ score: q.content_score, breakdown: q.score_breakdown }, [], { w0c: q.grade_detail }]);
    show('949 guide in the content run', { score: q.content_score, breakdown: q.score_breakdown, ideas: q.grade_detail.items.ideas, excluded: q.excluded_sections, kept: q.excluded_sections_kept });
    check('the guide that ranks: Ready, no idea restated, no section excluded or capped', c.ready && q.grade_detail.items.ideas.count === 0 && !q.grade_detail.items.removed && (q.excluded_sections || []).length === 0, J({ f: c.floors, i: q.grade_detail.items.ideas }));
    const src = (f) => fs.readFileSync(path.join(CODE_DIR, f + '.js'), 'utf8');
    const pc = src('Page_Candidates'), cq = src('Content_QA'), asr = src('Apply_Second_Read');
    check('Page Candidates carries the exclusions kit once and decides the flagged sections again (EXC.guard), recording removed and kept', (pc.match(/const EXC = \(\(\) => \{/g) || []).length === 1 && pc.includes('EXC.guard(base, bq.excluded_sections') && pc.includes('exclusions_kept: exKept') && !pc.includes('/*__EXCLUSIONS__*/'), '');
    check('Content QA decides with the budget and hands the run\'s removals to the grade', cq.includes('EXC.decide(md, verdict_exclusions, excFamily)') && cq.includes('removed: removed_run'), '');
    check('the three grading nodes carry the new grade kit (ideas, removedCap)', [pc, cq, asr].every(s => s.includes('const removedCap = (rm, max) =>') && s.includes('const ideas = (md, ctx) =>')), '');
  });
};
