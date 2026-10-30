// W05A1-W05A7 (wave 0.5 of the page-quality programme, 2026-10-30, fix agent W05-A "grade calibration"; docs/page-quality-2026-10-29/
// BEFORE_AFTER.md "Our second-read blockers against the judges"). The blind second read held 7 of the 8 AFTER pages at "Not ready 59" while
// the blind strategist judge would publish 7 of 8 (signed error -10.9, ready agreement 2 of 8). Now:
//   * the read BLOCKS only a factual error the page states: a count that does not match its list, an unsupported claim about the business,
//     a statement its own source contradicts, a fact or local rule it calls wrong or out of date (unhedged, and not a date that only falls
//     on the day the page is written);
//   * everything else it shows is advice that takes 3 (high) / 1.5 (medium) points off its part, at most a quarter of the part, never below
//     half of it, never the 59 cap; enforce mode only (the guide that ranks, a ladder page, is read in shadow mode and never marked down);
//   * the final version keeps that deduction while the quoted words are on it (page_run.second_read), so the grade never rises at Finalize
//     for nothing;
//   * "today" is the website's market day in its own time zone (Asia/Dubai for the UAE).
// Acceptance (the wave's brief): on the 8 AFTER pages replayed offline (harness/fixtures/w05a_after_reads.json, anonymised: the recorded
// answers of the second read, the quoted words, the grade Page Candidates delivered, the blind judges' scores) the signed error against the
// judges' mean is within +/-5 and ready agreement with the strategist is at least 6 of 8. The 3299 / 3336 pins and the ranking guide 949
// are in W0C / W0H, unchanged. Called from scenarios_v5.js.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const R = require('./replay')(H);
  const CODE_DIR = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const { REG } = require(path.join(CODE_DIR, '_regulatory_kit.js'));
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const show = (label, v) => console.log('   W05-A ' + label + ': ' + (typeof v === 'string' ? v : J(v)));
  const PLAIN = /[—–…‘’“”]/;
  const rr = async (fn, args, kit) => (await run('RR Kit', [{ json: { kit: kit || 'RR', fn, args } }], { code: '_critic_reread' }))[0].json.r;
  const gr = async (fn, args) => (await run('GR Kit', [{ json: { fn, args } }], { code: '_grade' }))[0].json.r;
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'w05a_after_reads.json'), 'utf8'));
  const answer = (problems) => ({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: 'end_turn',
    content: [{ type: 'text', text: J({ score: 66, strengths: ['clear'], problems }) }], usage: { input_tokens: 9000, output_tokens: 1500 } });
  const READY = (s) => s === 'ready' || s === 'ready_with_questions';
  const P = (today) => ({ skip: false, mode: 'enforce', model: 'claude-sonnet-5-5', today: today || '' });

  // ---------- W05A1 which problems are factual errors ----------
  await guard('W05A1 errors', async () => {
    const SN = 'W05A1 (W05-A) the second read blocks only a factual error the page states: a count that does not match its list, an unsupported claim about the business, a statement its own source contradicts, a wrong or out-of-date fact (unhedged, not a same-day date)';
    reset(); begin(SN); const check = mkCheck(SN);
    const SIX = 'Ownsite tracks six AI engines and answer surfaces: ChatGPT, Gemini, Perplexity, Claude, Copilot, Google AI Mode and AI Overviews.';
    const cm = await rr('countMismatch', [SIX]);
    check('"six ... :" followed by seven names is a count that does not match its list', cm && cm.stated === 6 && cm.listed === 7, J(cm));
    check('"five steps: a, b, c, d and e." matches; a quote cut mid-list is never a mismatch', (await rr('countMismatch', ['Follow five steps: plan, build, test, launch and review.'])) === null
      && (await rr('countMismatch', ['It tracks six AI engines: ChatGPT, Gemini, Perplexity'])) === null, '');
    const e = async (p, today) => rr('errorOf', [{ on_page: true, severity: 'high', fix: '', ...p }, today || '']);
    const cases = [
      [{ kind: 'claim', location: SIX, issue: 'Seven names are listed while the text says six.' }, 'count', 'a count error (even filed as a claim)'],
      [{ kind: 'claim', location: 'our practice is built on the product', issue: 'The facts on file do not say the practice is built on it.' }, 'claim', 'an unsupported claim about the business'],
      [{ kind: 'source', location: 'x', issue: 'The pricing contrast is uncited on the page; the only support is a weak agency blog.' }, '', 'an uncited contrast: advice'],
      [{ kind: 'local', location: 'x', issue: 'Regulatory claims are stated with no official source link and no status or date.' }, '', 'a law with no link: advice'],
      [{ kind: 'source', location: 'x', issue: 'The only market figure is stated vaguely with no number, although the verified source gives 39% to 66%.' }, '', 'a vague market figure: advice'],
      [{ kind: 'fact', location: 'x', issue: '\'Just under one in five\' is roughly right but the example treats the answers as independent. The main risk is overstated precision.' }, '', 'a statistics note: advice'],
      [{ kind: 'source', location: 'x', issue: 'Third-party capability stated with no link; it is unverified and could be out of date, and it contradicts the vendor-neutral framing.' }, '', 'hedged ("could be out of date"), a contrast with the framing: advice'],
      [{ kind: 'fact', location: 'x', issue: 'Contradicts nothing directly but the claims are stated flatly with no vendor source.' }, '', '"contradicts nothing": advice'],
      [{ kind: 'local', location: 'x', issue: 'Cabinet Decision No. 75 of 2023 was repealed in 2025; the page cites it as current.' }, 'wrong', 'a repealed decision cited as current'],
      [{ kind: 'fact', location: 'x', issue: 'The figure is wrong: the linked source says 39%, not 66%, and the page contradicts its cited source.' }, 'contradicted', 'contradicted by its own cited source'],
      [{ kind: 'fact', location: 'x', issue: 'The appointment deadline is incorrect: it is 31 July 2027 under the latest decision.' }, 'wrong', 'a wrong deadline'],
      [{ kind: 'fact', location: 'x', issue: 'The e-invoicing model is described wrongly.' }, 'wrong', 'a fact described wrongly'],
      [{ kind: 'claim', location: 'x', issue: 'Not supported.', severity: 'medium' }, '', 'a medium problem never blocks'],
      [{ kind: 'claim', location: 'x', issue: 'Not supported.', on_page: false }, '', 'words not on the page never block'],
      [{ kind: 'depth', location: 'x', issue: 'The answer is wrong for a bank.' }, '', 'a depth problem never blocks']];
    for (const [p, want, label] of cases) { const got = await e(p); check(label + ' -> ' + (want || 'advice'), got === want, J({ got, p })); }
    // the day the page is written (K1 / K2 of the AFTER run): the UAE day was 30 October while the run started 22:31 UTC on 29 October
    const SD = { kind: 'local', location: 'if you have not appointed an ASP by 30 October 2026, you are past your appointment date.',
      issue: 'The page is written on 30 October 2026, the deadline day. Saying the reader is \'past\' the date is wrong for that day.' };
    check('a deadline that only falls on the day the page is written is advice (the page is read after that day)', (await e(SD, '2026-10-30')) === '', J(await e(SD, '2026-10-30')));
    check('the same words on another day are a wrong statement (the date is not the market day)', (await e(SD, '2026-10-20')) === 'wrong', J(await e(SD, '2026-10-20')));
  });

  // ---------- W05A2 the 8 AFTER pages, replayed ----------
  const rows = []; const per = {};
  await guard('W05A2 AFTER replay', async () => {
    const SN = 'W05A2 (W05-A acceptance) the 8 delivered AFTER pages through today\'s second-read rule and grade: signed error within +/-5 of the judges\' mean, ready agreement with the strategist >= 6 of 8';
    reset(); begin(SN); const check = mkCheck(SN);
    for (const [k, X] of Object.entries(FX.pages)) {
      const qa = { content_qa: true, delivery: { status: X.delivered.status, label: X.delivered.status === 'needs_work' ? 'Needs work: sources' : 'Ready to publish', blocking: clone(X.delivered.blocking), advisory: [], client_questions: [], grade: clone(X.delivered.grade), next_step: '' },
        grade_detail: clone(X.grade_detail), quality: {} };
      const r = await rr('read', [answer(X.problems.map(p => ({ severity: p.severity, kind: p.kind, location: p.location, issue: p.issue, fix: p.fix }))), X.page, P(X.today), '__PF__']);
      const q2 = await rr('apply', [qa, r, '__PF__']);
      const D = q2.delivery; const g = await gr('cap', [D.grade, D.blocking || [], { w0c: q2.grade_detail, review: q2.critic_reread }]);
      const status = D.status;
      per[k] = { gates: r.gates.map(x => x.error), advice: r.advice.length, cut: (g.review || {}).cut || {}, score: g.score, status, recorded: X.recorded };
      rows.push({ k, ours: g.score, judge: X.judge.mean, jr: X.judge.strategist_ready === 'yes', ready: READY(status), old: X.recorded.score, oldReady: READY(X.recorded.status) });
      check(k + ': no page is at the 59 cap without a factual error, and every page with one is not ready', (g.score <= 59) === (r.gates.length > 0) && (r.gates.length > 0) === (status === 'not_ready'), J(per[k]));
      check(k + ': the advice of the read is shown, plain words', (D.advisory || []).filter(a => a.code === 'second_read').length === r.advice.length && !PLAIN.test(J(D.advisory)), J(D.advisory));
    }
    show('per page', per);
    const want = { K1: [], K2: [], K3: ['claim'], K4: [], K5: ['claim'], K6: [], K7: [], K8: ['count', 'claim'] };
    check('what still blocks: K3 and K5 an unsupported claim about the business, K8 "six engines" with seven names (and a claim); K1 / K2 (the same-day deadline, the unlinked decisions), K6 (the vague figure), K7 (the statistics note) are advice',
      Object.keys(want).every(k => J(per[k].gates) === J(want[k])), J(Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v.gates]))));
    const n = rows.length; const signed = rows.reduce((s, r) => s + r.ours - r.judge, 0) / n; const mae = rows.reduce((s, r) => s + Math.abs(r.ours - r.judge), 0) / n;
    const agree = rows.filter(r => r.ready === r.jr).length; const agreeOld = rows.filter(r => r.oldReady === r.jr).length; const signedOld = rows.reduce((s, r) => s + r.old - r.judge, 0) / n;
    show('against the judges', { ours: +(rows.reduce((s, r) => s + r.ours, 0) / n).toFixed(1), judges: +(rows.reduce((s, r) => s + r.judge, 0) / n).toFixed(1), signed: +signed.toFixed(1), mae: +mae.toFixed(1), ready_agreement: agree + '/' + n,
      recorded: { signed: +signedOld.toFixed(1), ready_agreement: agreeOld + '/' + n } });
    check('signed error within +/-5 of the judges\' mean (it was ' + signedOld.toFixed(1) + ')', Math.abs(signed) <= 5, signed.toFixed(2));
    check('ready agreement with the strategist >= 6 of 8 (it was ' + agreeOld + ' of 8)', agree >= 6, agree);
    check('the mean absolute error is lower than as recorded (15.5)', mae < 15.5, mae.toFixed(2));
    check('the one page the strategist would not publish (K8) is still not ready', !rows.find(r => r.k === 'K8').ready);
  });

  // ---------- W05A3 the grade kit's advice deduction ----------
  await guard('W05A3 advice deduction', async () => {
    const SN = 'W05A3 (W05-A) advice costs its part: 3 (high) / 1.5 (medium), at most a quarter of the part, never below half; enforce mode only; applied once; never the 59 cap';
    reset(); begin(SN); const check = mkCheck(SN);
    const X = FX.pages.K6; const W = clone(X.grade_detail); const G = clone(X.delivered.grade);
    const base = await gr('cap', [G, [], { w0c: W }]);
    const adv = (xs, mode) => ({ mode: mode || 'enforce', status: 'checked', advice: xs.map(([severity, kind]) => ({ severity, kind, location: 'x' })) });
    const one = await gr('cap', [G, [], { w0c: W, review: adv([['high', 'source']]) }]);
    check('one high source item: 3 points off sources, nothing else moves, still Ready', one.breakdown.sources === base.breakdown.sources - 3 && one.score === base.score - 3 && one.ready === base.ready && one.review.cut.sources === 3, J({ base: base.breakdown, one: one.breakdown }));
    const many = await gr('cap', [G, [], { w0c: W, review: adv([['high', 'source'], ['high', 'fact'], ['high', 'local'], ['medium', 'claim'], ['medium', 'source']]) }]);
    check('many items on one part: at most a quarter of the part (15 -> 3) and never below half', base.breakdown.sources - many.breakdown.sources <= 3 && many.breakdown.sources >= 7.5 && many.score > 59, J(many.review));
    const low = await gr('cap', [{ ...G, breakdown: { ...G.breakdown, sources: 8 } }, [], { w0c: W, review: adv([['high', 'source'], ['high', 'source']]) }]);
    check('a part already near half: the cut stops at half (8 -> 8), so advice alone never makes a page "Needs work"', low.breakdown.sources === 8 && low.floors.ok, J(low.breakdown));
    const sh = await gr('cap', [G, [], { w0c: W, review: adv([['high', 'source']], 'shadow') }]);
    const nc = await gr('cap', [G, [], { w0c: W, review: { mode: 'enforce', status: 'not_checked', advice: [] } }]);
    check('shadow mode (the system\'s own runs, the client\'s keyword ladder, the guide that ranks) and "not checked" change nothing', sh.score === base.score && nc.score === base.score && !sh.review && !nc.review, J([sh.score, nc.score, base.score]));
    const again = await gr('cap', [one, [], { w0c: W }]);
    check('a later cap of the same grade applies it once (from the parts before it)', again.score === one.score && again.breakdown.sources === one.breakdown.sources, J([one.score, again.score]));
    const kinds = await gr('cap', [G, [], { w0c: W, review: adv([['medium', 'repetition'], ['medium', 'depth'], ['medium', 'style'], ['high', 'intent'], ['medium', 'other']]) }]);
    check('each kind costs its own part (repetition -> structure, depth -> specificity, style -> plain language, intent -> fit; other -> nothing)',
      kinds.review.cut.structure === 1 && kinds.review.cut.specificity === 1 && kinds.review.cut.clean_language === 1 && kinds.review.cut.fit === 3 && Object.keys(kinds.review.cut).length === 4, J(kinds.review));
    check('the note says it in plain words', /^A second read of the page found 4 things to improve before publishing: 6 points off/.test(kinds.review.note) && !PLAIN.test(kinds.review.note), kinds.review.note);
    const blk = await gr('cap', [G, [{ code: 'review' }], { w0c: W, review: adv([['high', 'source']]) }]);
    check('a factual error still caps the total at 59', blk.score === 59 && !blk.ready, J(blk.score));
  });

  // ---------- W05A4 the final versions ----------
  await guard('W05A4 finals', async () => {
    const SN = 'W05A4 (W05-A) the final version keeps the advice deduction while the quoted words are on it (no rise at Finalize for nothing) and carries only the factual errors';
    reset(); begin(SN); const check = mkCheck(SN);
    const out = {};
    for (const [k, F] of Object.entries(FX.finals)) {
      const X = FX.pages[k];
      const r = await rr('read', [answer(X.problems), X.page, P(X.today), '__PF__']);
      const finalPage = X.problems.filter((p, i) => p.on_page && F.still_on_final[i]).map(p => p.location).join('\n\n');
      const carried = r.gates.filter(g => F.still_on_final[X.problems.findIndex(p => p.location === g.location)]).map(() => ({ code: 'review' })).concat(F.blocking_other);
      const advice = r.advice.filter(a => F.still_on_final[X.problems.findIndex(p => p.location === a.location)]);
      const g = await gr('cap', [F.grade, carried, { w0c: F.grade_detail, review: { mode: 'enforce', status: 'checked', advice } }]);
      const del = per[k] || {};
      out[k] = { final: g.score, delivered: del.score, carried: carried.map(c => c.code), judge: F.judge.mean };
      check(k + ': the final grade is not above the delivered one while the advice words are still there', g.score <= del.score, J(out[k]));
      check(k + ': only a factual error is carried as a blocker', carried.filter(c => c.code === 'review').length <= (del.gates || []).length, J(out[k]));
      void finalPage;
    }
    show('finals', out);
    const n = Object.keys(out).length; const signed = Object.values(out).reduce((s, x) => s + x.final - x.judge, 0) / n;
    show('finals against the judges', { signed: +signed.toFixed(1), as_recorded: -14.4 });
    check('finals: signed error within +/-5 of the judges (it was -14.4, every final at 59)', Math.abs(signed) <= 5, signed.toFixed(2));
  });

  // ---------- W05A5 the Finalize workflow carries the deduction ----------
  await guard('W05A5 finalize chain', async () => {
    const SN = 'W05A5 (W05-A) page_run.second_read reaches Finalize Verdict: the same final version grades lower while the advice\'s words are on it, and gets the points back once they are gone';
    reset(); begin(SN); const check = mkCheck(SN);
    const F99 = R.load('replay_3299.json.gz'); const F36 = R.load('replay_3336.json.gz');
    const CB = F99.nodes['Build Webhook Response']['0'].items[0].json;
    const BODY = F36.nodes['Finalize Webhook']['0'].items[0].json.body;
    const EDITOR = F36.nodes['Finalize Editor']['0'].items;
    const pr = (extra) => ({ qa_blocking: [], duplicate_targets: [], verdict: CB.verdict == null ? null : CB.verdict, score: CB.score == null ? null : CB.score, score_withheld: false,
      page_type: ((CB.meta || {}).page_type) || '', verdict_acknowledged: true, copied_passages: [], content_request_id: CB.request_id || '', length_points: null, ...(extra || {}) });
    const chain = async (body) => {
      reset(); delete store['Finalize Editor'];
      const pb = await run('Parse Brief', [{ json: { body, headers: {} } }], { code: 'Finalize__Parse_Brief' });
      mock('Finalize Plan', pb);
      const ap = await run('Finalize Apply', pb, { code: 'Finalize__Finalize_Apply' });
      if (ap[0].json.needs_editor) mock('Finalize Editor', clone(EDITOR));
      const mg = await run('Finalize Merge', ap, { code: 'Finalize__Finalize_Merge' });
      const qa = await run('Content QA', mg, { code: 'Finalize__Content_QA' });
      const oc = await run('Originality Check', qa, { code: 'Finalize__Originality_Check' });
      return { pb: pb[0].json, body: (await run('Finalize Verdict', oc, { code: 'Finalize__Finalize_Verdict' }))[0].json.body };
    };
    const base = await chain({ ...clone(BODY), page_run: pr() });
    const words = String(base.body.markdown).split('\n').map(x => x.trim()).find(x => x.length > 80 && !/^(#|\||-|\*|>|\[|!|Title:|Meta|Slug:|Primary|Secondary|\*\*Quick)/.test(x)) || '';
    const quote = words.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').split(/\s+/).slice(0, 10).join(' ');
    const SR = (q) => [{ severity: 'high', kind: 'source', location: q }, { severity: 'medium', kind: 'repetition', location: q }];
    const kept = await chain({ ...clone(BODY), page_run: pr({ second_read: SR(quote) }) });
    const gone = await chain({ ...clone(BODY), page_run: pr({ second_read: SR('words that the final version does not carry anywhere at all') }) });
    show('finalize', { quote, base: [base.body.grade.score, base.body.grade.breakdown], kept: [kept.body.grade.score, kept.body.grade.breakdown, kept.body.grade.review], gone: gone.body.grade.score });
    check('Parse Brief reads page_run.second_read (severity, kind, the words) into the page-run context', Array.isArray((kept.pb.prc || {}).second_read) && kept.pb.prc.second_read.length === 2 && (base.pb.prc || {}).second_read === null, J((kept.pb.prc || {}).second_read));
    check('with the words still on the final version, sources and structure lose their points (up to a quarter, never below half)', kept.body.grade.review && (kept.body.grade.breakdown.sources < base.body.grade.breakdown.sources || base.body.grade.breakdown.sources <= 8)
      && kept.body.grade.score <= base.body.grade.score, J({ k: kept.body.grade.breakdown, b: base.body.grade.breakdown }));
    check('once the words are gone the final version gets its points back', gone.body.grade.score === base.body.grade.score && !gone.body.grade.review, J([gone.body.grade.score, base.body.grade.score]));
    check('a report without page_run.second_read (older reports) is judged as before and is not "missing" anything for it', !(base.pb.prc.grading_missing || []).includes('second_read'), J(base.pb.prc.grading_missing));
  });

  // ---------- W05A6 today in the market's time zone ----------
  await guard('W05A6 market day', async () => {
    const SN = 'W05A6 (W05-A) "today" is the website\'s market day in its own time zone, for the regulatory status, the second read and the page\'s dates';
    reset(); begin(SN); const check = mkCheck(SN);
    check('22:31 UTC on 29 October is 30 October in the UAE (Asia/Dubai), as the AFTER run K1 was', REG.dayFor('2026-10-29T22:31:11Z', 'AE', null) === '2026-10-30', REG.dayFor('2026-10-29T22:31:11Z', 'AE', null));
    check('... and still 29 October in New York (summer time) and in London', REG.dayFor('2026-10-29T22:31:11Z', 'US', null) === '2026-10-29' && REG.dayFor('2026-10-29T22:31:11Z', 'GB', null) === '2026-10-29');
    check('New York in winter is UTC-5: 04:30 UTC on 10 December is still 9 December there', REG.dayFor('2026-12-10T04:30:00Z', 'US', null) === '2026-12-09');
    check('a market with no zone uses its offset, else UTC', REG.dayFor('2026-10-29T22:31:11Z', 'ZZ', { utc_offset_hours: 4 }) === '2026-10-30' && REG.dayFor('2026-10-29T22:31:11Z', 'ZZ', null) === '2026-10-29');
    const it = { output: 'Title: x\n\n# A page\n\nSome words about e-invoicing in the UAE that a reader needs to know before the deadline passes.', content_qa: { delivery: { status: 'ready', blocking: [], advisory: [] } } };
    mock('Parse Brief', [{ json: { keyword: 'e-invoicing uae', country: 'United Arab Emirates', country_iso: 'AE', domain: 'novaand.example', client_ip: 'app:c1', started_at: '2026-10-29T22:31:11.621Z', regulatory: { as_of: '2026-10-30', digest: 'REGULATORY FACTS (United Arab Emirates, as of 30 October 2026)' } } }]);
    mock('Normalize Input', [{ json: { client_ip: 'app:c1' } }]);
    delete store['Collect Regulatory Facts'];
    const pj = (await run('Second Read Plan', [{ json: it }]))[0].json.second_read;
    const prompt = pj.body ? JSON.parse(pj.body).messages[0].content : '';
    check('Second Read Plan takes the market day (30 October), not the UTC day of the run, and tells the reader', pj.today === '2026-10-30' && /Today in United Arab Emirates: 30 October 2026/.test(prompt), J({ today: pj.today, at: prompt.indexOf('Today in') }));
    mock('Parse Brief', [{ json: { keyword: 'x', country: 'United States', client_ip: 'app:c1', started_at: '2026-10-29T22:31:11.621Z' } }]);
    const pu = (await run('Second Read Plan', [{ json: it }]))[0].json.second_read;
    check('with no market day on file it falls back to the UTC day the run started', pu.today === '2026-10-29', J(pu.today));
    const bwr = fs.readFileSync(path.join(CODE_DIR, 'Build_Webhook_Response.js'), 'utf8');
    check('the callback\'s page_run carries the read\'s advice (enforce mode, checked) for the final version', /second_read: \(\(\) => \{ const R = d\.qa_second_read/.test(bwr) && /R\.mode !== 'enforce' \|\| R\.status !== 'checked'/.test(bwr));
    for (const f of ['Content_QA.js', 'Blog_Package.js']) { const s = fs.readFileSync(path.join(CODE_DIR, f), 'utf8');
      check(f + ': the page\'s dates are the market day (Regulatory Plan\'s as_of) before UTC', /regulatory[^\n]*as_of/.test(s) && /\$\('Collect Regulatory Facts'\)\.first\(\)\.json\.regulatory\.as_of/.test(s)); }
  });

  // ---------- W05A7 the guide that ranks ----------
  await guard('W05A7 ranking guide', async () => {
    const SN = 'W05A7 (W05-A, owner priority) the guide that ranks (exec 949) is a ladder page: its second read is shadow mode, so nothing it says blocks it or takes a point off it';
    reset(); begin(SN); const check = mkCheck(SN);
    const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ranking_guide_949.json'), 'utf8'));
    const md = G.live_markdown;
    const plan = await rr('plan', [{ output: md, content_qa: { delivery: { status: 'ready', blocking: [], advisory: [] } } }, { keyword: G.keyword, ladder_id: G.brief.ladder_id, ladder_rung: G.ladder_rung, client_ip: 'app:company-1' }, { today: '2026-10-30' }]);
    check('a ladder page started from the app is read in shadow mode', plan.mode === 'shadow', plan.mode);
    const quote = md.split('\n').map(x => x.trim()).find(x => x.length > 80 && !/^(#|\||-|\*|>|\[)/.test(x)).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').split(/\s+/).slice(0, 10).join(' ');
    const r = await rr('read', [answer([{ severity: 'high', kind: 'claim', location: quote, issue: 'Nothing on file supports this.', fix: 'x' }, { severity: 'high', kind: 'source', location: quote, issue: 'Uncited.', fix: 'x' }]), md, { ...plan, today: '2026-10-30' }, '__PF__']);
    const W = { version: 'w0c-1', max: { structure: 20, coverage: 15, readability: 10, specificity: 10, clean_language: 10, sources: 15, fit: 20, length: 0 }, caps: [], items: { fit: {} } };
    const g0 = { score: 90, breakdown: { structure: 18, coverage: 15, readability: 10, specificity: 9, clean_language: 10, sources: 12, fit: 16, length: 0 } };
    const a = await gr('cap', [g0, [], { w0c: W }]); const b = await gr('cap', [g0, [], { w0c: W, review: { mode: r.mode, status: r.status, advice: r.advice } }]);
    check('shadow: nothing gates (the claim is only reported) and the grade is the same', r.gates.length === 0 && r.would_block.length === 1 && b.score === a.score && !b.review, J({ gates: r.gates.length, would: r.would_block.length, a: a.score, b: b.score }));
  });
};
