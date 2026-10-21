// CTX1-CTX7 (CT-FIX2, 2026-10-22): the defects of the paid page run (engine exec 159, PAGE_RUN_REPORT D1-D8 + CT_REVIEW item 7) on the
// GENERATED code and on that run's REAL data (fixtures_ctfix2_159.json.gz: Parse Brief, Site Model, the Editor's round, Needs Revision?
// after QA round 1). The promise check in two stages (Promise Candidates -> Promise Judge, Claude Haiku, MOCKED here with deterministic
// answers: the build stays offline), the reworded round-1 promise, the page-type length band, the citation re-link, one slug, the
// inbound anchors, the Word text and the judge's measured cost. Called from scenarios_v5.js before the report (one line).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const kitFrom = (file, name) => { const src = fs.readFileSync(path.join(__dirname, 'code_v4', file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' kit not found in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const CL = kitFrom('Content_QA.js', 'CL');
  // the judge kit is new: without it (the code before CT-FIX2) every scenario still runs and fails on its assertions, not on loading
  const PJ = (() => { try { return kitFrom('Content_QA.js', 'PJ'); } catch (e) { return { missing: true, k: (s) => String(s || '').replace(/\[([^\[\]]*)\]\([^)]*\)/g, '$1').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(),
    ownText: (p) => [p.business, p.business_facts, p.case_facts_text].filter(Boolean).join('\n'), captionsOf: () => [], keyOf: () => 'none', factIds: () => ({}) }; } })();
  H.results.push({ scenario: 'CTX0 CT-FIX2', node: 'assert the promise judge kit (PJ) is inlined into the generated Content QA', ok: !PJ.missing, ms: 0, error: PJ.missing ? 'not found' : '', items: [] });
  const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_ctfix2_159.json.gz'))).toString());
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const OWN = PJ.ownText(FX.parse_brief, FX.site_model);
  const NAMES = ['Tech&', 'techand'];
  const unmark = (md) => md.replace(/\[Confirm: ([^\[\]]{20,}?[.!])\]/g, '$1');
  const DRAFT2 = FX.editor_output;
  const S = {
    d1: 'We serve enterprises across the United Arab Emirates and the GCC and bring 20+ years of industry experience.',
    cta: 'To test one use case first, [book a discovery call with Tech&](https://www.techand.ai/contact-us).',
    read: 'Read [how Tech& approaches security and data protection](https://www.techand.ai/security).',
    run: 'Run & Optimize covers monitoring, model and prompt tuning, adoption and user training, based on real usage.',
    gov: 'No governance sign-off: controls are agreed in Assess & Envision.',
    cap: 'Each phase ends in a decision, so you fund the next step only once value is proven.',
    rec: 'We recommend a go/no-go review at the end of each phase, so a full build is funded only once the ROI case exists.',
    put: 'We put AI on the case, invoice, order and forecast records your teams already open every day.',
    res: 'We agree data residency and access controls during Assess & Envision, because changing them after the build forces rework.' };
  const has = (list, s) => (list || []).some(x => PJ.k(x.sentence || x) === PJ.k(s));

  await guard('CTX1 claims kit on the live page', async () => {
    const SN = 'CTX1 CT-FIX2 D1-D3: on exec 159\'s own draft and facts the rules no longer flag the true joined sentence or the two link lines, and catch the phase subject, the list item and the caption';
    reset(); begin(SN); const check = mkCheck(SN);
    const C = CL.commitments(unmark(DRAFT2), OWN, { names: NAMES, collect: true, captions: PJ.captionsOf(FX.parse_brief.content_brief) });
    check('D1: "We serve enterprises across the United Arab Emirates and the GCC and bring 20+ years ..." is supported (UAE canon + two facts)', !has(C.flags, S.d1), J(C.flags.map(f => f.sentence)));
    check('D2: the mid-page invitation and the "Read [link]" line are not promises', !has(C.flags, S.cta) && !has(C.flags, S.read), J(C.flags.map(f => f.sentence)));
    check('D3: "Run & Optimize covers ... prompt tuning ... user training" (a phase on file as the subject) is flagged', has(C.flags, S.run), J(C.flags.map(f => f.sentence)));
    check('D3: the list item "No governance sign-off: controls are agreed in Assess & Envision." under "How we close each gap:" is flagged', has(C.flags, S.gov), J(C.flags.map(f => f.sentence)));
    check('D3: the image caption repeating the go / no-go promise is flagged, as a caption', C.flags.some(f => PJ.k(f.sentence) === PJ.k(S.cap) && f.where === 'caption'), J(C.flags));
    check('the true promises stay flagged ("We put AI on ...", "We agree data residency ...")', has(C.flags, S.put) && has(C.flags, S.res));
    check('stage 1 lists more candidates than flags (the wide net) and every flag is a candidate', C.candidates.length > C.flags.length && C.flags.every(f => has(C.candidates, f.sentence)), C.candidates.length + ' / ' + C.flags.length);
    check('"we recommend ..." is a candidate for the second reader (advice in the business\'s voice), not a rule flag', C.candidates.some(c => PJ.k(c.sentence) === PJ.k(S.rec) && c.why === 'advice') && !has(C.flags, S.rec));
    check('CL.backs: a fact without the price does not back a priced sentence; the fact itself does', !CL.backs('Our fixed-price readiness assessment costs AED 25,000.', 'Assess & Envision ends with an ROI assessment.')
      && CL.backs('Tech& serves enterprises across the UAE and the GCC.', 'It serves enterprises across the UAE and the GCC in banking and retail.'));
  });

  const prevBrief = () => clone(FX.parse_brief);
  const mocks = (o) => { mock('Parse Brief', [{ json: prevBrief() }]); mock('Site Model', [{ json: { site_model: clone(FX.site_model) } }]); mock('Analyze Competitor Pages', [{ json: { competitors: [] } }]);
    mock('Needs Revision?', [{ json: clone(FX.needs_revision_r1) }]); if (o && o.pc) mock('Promise Candidates', [{ json: o.pc }]); if (o && o.judge) mock('Promise Judge', [{ json: o.judge }]); };
  let PCOUT = null;
  await guard('CTX2 Promise Candidates', async () => {
    const SN = 'CTX2 CT-FIX2: Promise Candidates builds one Haiku request per round from the draft (forced tool, closest facts, captions), the draft passing through';
    reset(); begin(SN); const check = mkCheck(SN);
    mocks();
    const r = await run('Promise Candidates', [{ json: { output: DRAFT2, critique: null } }]);
    PCOUT = r[0].json; const pj = PCOUT.promise_judge || {}; let body = {}; try { body = JSON.parse(pj.body || '{}'); } catch (e) {}
    check('the draft passes through untouched', PCOUT.output === DRAFT2);
    check('not skipped; 1-40 candidates; the key is the list\'s', !pj.skip && pj.n > 0 && pj.n <= 40 && pj.key === PJ.keyOf(pj.candidates), J({ skip: pj.skip, n: pj.n }));
    check('the request: Claude Haiku 4.5, temperature 0, the record_verdicts tool forced, the key in the message', body.model === 'claude-haiku-4-5-20251001' && body.temperature === 0 && body.tool_choice && body.tool_choice.name === 'record_verdicts'
      && JSON.stringify(body.messages || '').includes(pj.key), J({ model: body.model, tc: body.tool_choice }));
    check('the caption and QA\'s own round-1 mark (unwrapped) are candidates', pj.candidates.some(c => c.where === 'caption') && pj.candidates.some(c => PJ.k(c.sentence) === PJ.k('No data owner: we name one during business discovery.')), J(pj.candidates.map(c => c.sentence.slice(0, 50))));
    check('the closest facts travel with the candidates (F ids)', /F1: /.test(JSON.stringify(body.messages || '')) && /closest facts: F\d/.test(JSON.stringify(body.messages || '')));
  });

  const qa2 = async (o) => { mocks(o); return (await run('Content QA', [{ json: o && o.input ? o.input : { output: DRAFT2, critique: null } }], { runIndex: 1 }))[0].json; };
  await guard('CTX3 Content QA round 2 on the real path, rules only', async () => {
    const SN = 'CTX3 CT-FIX2 item 7 + D1-D3 + D5 + D6 + D8 on exec 159: the reworded round-1 promise stays a promise, the page-type band is the band, the citation is not re-linked to "source", one slug';
    reset(); begin(SN); const check = mkCheck(SN);
    const out = await qa2(); const Q = out.content_qa || {};
    const bp = Q.business_promises || [];
    check('item 7: the editor\'s reworded mark of round 1\'s go / no-go promise is a business promise again, marked, not a writer note', has(bp, S.rec) && bp.find(b => PJ.k(b.sentence) === PJ.k(S.rec)).marked === true
      && !(Q.writer_notes || []).some(n => n.token.includes('go/no-go')), J({ bp: bp.map(b => b.sentence.slice(0, 60)), notes: Q.writer_notes }));
    const ed = ((Q.quality || {}).owner_edits || []).find(e => String(e.sentence || e.token).includes('go/no-go review'));
    check('item 7: its owner edit keeps the explanation ("nothing ... says this; ... add it to your business facts")', ed && /add it to your business facts/.test(ed.text), J(ed));
    check('item 7: the carried promise is recorded with the round-1 sentence it came from', (Q.carried_promises || []).some(c => /go\/no-go decision/.test(c.was)), J(Q.carried_promises));
    check('D1 / D2: the true joined sentence and the two link lines are not promises', !has(bp, S.d1) && !has(bp, S.cta) && !has(bp, S.read), J(bp.map(b => b.sentence.slice(0, 70))));
    check('D3: the phase subject and the caption are promises; the caption is listed, not wrapped, with its own owner edit', has(bp, S.run) && bp.some(b => PJ.k(b.sentence) === PJ.k(S.cap) && b.where === 'image caption' && !b.marked)
      && ((Q.quality || {}).owner_edits || []).some(e => /change the image caption/.test(e.text)), J(bp));
    check('rules only, and the report says so', (Q.promise_check || {}).method === 'rules' && /^checked by rules only/.test((Q.promise_check || {}).note || '') && /checked by rules only/.test(JSON.stringify(Q.quality || {})), J(Q.promise_check));
    check('D8: the page-type band (1,800-3,500, under 3 same-kind pages) is the band: no cut for ' + Q.main_content_words + ' words, the band and its sample in the output',
      Q.length_band && Q.length_band.source === 'page_type' && Q.length_band.low === 1800 && Q.length_band.high === 3500 && Q.length_band.sample === 2 && !Q.length_instruction, J({ band: Q.length_band, cut: Q.length_instruction }));
    check('D5: the PwC / Forrester citation the editor dropped is not re-attached to "source" in the governance bullet', !/every \[source\]\(https:\/\/www\.pwc\.com/.test(out.output), (out.output.match(/.{40}\[source\]\(https:\/\/www\.pwc[^)]*\)/) || [''])[0]);
    check('D6: the draft\'s Slug line is the planned slug and the fix names the planned address once (/whatwedo/ai-automation)', /^Slug: ai-automation$/m.test(out.output) && (Q.auto_fixes || []).some(f => f.includes('(/whatwedo/ai-automation)')) && !(Q.auto_fixes || []).some(f => f.includes('/ai-automation/)')),
      J([(out.output.match(/^Slug:.*$/m) || [''])[0], (Q.auto_fixes || []).filter(f => /address|URL/.test(f))]));
  });

  await guard('CTX4 Content QA with the second reader (mocked answers)', async () => {
    const SN = 'CTX4 CT-FIX2: the verdicts are applied with the measured policy: a link / invitation lifted, a "supported" with a fact that does not carry it refused, a wide-net promise added; a stale or failed answer leaves the rules';
    reset(); begin(SN); const check = mkCheck(SN);
    const pj = PCOUT.promise_judge; const list = pj.candidates;
    const id = (s) => 'C' + (list.findIndex(c => PJ.k(c.sentence) === PJ.k(s)) + 1);
    const wide = list.find(c => c.why === 'wide' && !c.rule_flag);
    const v = (cid, kind, sup, missing) => ({ id: cid, kind, missing: missing || '', supported_by: sup || null, is_business_commitment: kind === 'commitment', reason: 'test' });
    const verdicts = list.map((c, i) => v('C' + (i + 1), 'commitment', 'F1'));   // default: "supported by F1", which the rules' test must refuse for the rule flags
    verdicts[list.findIndex(c => PJ.k(c.sentence) === PJ.k(S.put))] = v(id(S.put), 'pointer_to_page');
    if (wide) verdicts[list.indexOf(wide)] = v('C' + (list.indexOf(wide) + 1), 'commitment', null, 'the whole statement');
    const answer = (key, vs) => ({ model: 'claude-haiku-4-5-20251001', content: [{ type: 'tool_use', name: 'record_verdicts', input: { key, verdicts: vs } }], usage: { input_tokens: 5200, output_tokens: 1900 } });
    check('fixture: the "We put AI on ..." line and a wide-net sentence are candidates', id(S.put) !== 'C0' && !!wide, J(list.map(c => c.why)));
    let out = await qa2({ pc: PCOUT, judge: answer(pj.key, verdicts) }); let Q = out.content_qa || {}; let bp = Q.business_promises || [];
    check('two stages: method rules+model, every candidate judged', (Q.promise_check || {}).method === 'rules+model' && (Q.promise_check || {}).judged === list.length, J(Q.promise_check));
    check('lifted: a rule flag the reader calls a pointer to another page', !has(bp, S.put) && (Q.promise_check.overturned || []).some(o => PJ.k(o.sentence).startsWith(PJ.k(S.put).slice(0, 30))), J(bp.map(b => b.sentence.slice(0, 50))));
    check('refused: "supported by F1" when F1 does not carry the sentence (data residency stays a promise)', has(bp, S.res), J(bp.map(b => b.sentence.slice(0, 50))));
    check('added: a wide-net sentence the reader calls an unsupported commitment', wide && has(bp, wide.sentence) && (Q.promise_check.added || []).length >= 1, J(Q.promise_check.added));
    out = await qa2({ pc: PCOUT, judge: answer(pj.key, verdicts.concat([v('C999', 'commitment', null, 'x'), v('X1', 'commitment', null, 'x')])) });
    check('an id that is not a candidate is ignored (the reader never adds a sentence)', (out.content_qa.promise_check || {}).judged === list.length, J(out.content_qa.promise_check));
    out = await qa2({ pc: PCOUT, judge: answer('pjstale.1', verdicts) }); Q = out.content_qa || {};
    check('a stale answer (another key) is not used: rules only, "answered for another list"', Q.promise_check.method === 'rules' && /another list/.test(Q.promise_check.note), J(Q.promise_check));
    out = await qa2({ pc: PCOUT, judge: { error: { message: 'overloaded' } } }); Q = out.content_qa || {};
    check('a failed call: rules only, "could not be reached", and the promises are the rules\' own', Q.promise_check.method === 'rules' && /could not be reached/.test(Q.promise_check.note) && has(Q.business_promises, S.put), J(Q.promise_check));
  });

  await guard('CTX5 inbound anchors', async () => {
    const SN = 'CTX5 CT-FIX2 D4: no inbound anchor uses another planned ladder page\'s search ("dubai AI strategy")';
    reset(); begin(SN); const check = mkCheck(SN);
    const INB = kitFrom('Inbound_Candidates.js', 'INB');
    const md = '# AI Consulting in Dubai\n\n## Dubai AI strategy: aligning your roadmap with national priorities\n\nText.\n\n## AI governance for UAE enterprises\n\nText.\n';
    const base = { url: 'https://www.techand.ai/whatwedo/ai-automation', keyword: 'ai consulting dubai', md, title: 'AI Consulting in Dubai', secondary: [], kind: 'service' };
    const A0 = INB.anchors(INB.target(base)).map(a => a.text.toLowerCase());
    const A1 = INB.anchors(INB.target({ ...base, avoid: ['dubai ai strategy', 'best ai company in dubai'] })).map(a => a.text.toLowerCase());
    check('without the ladder\'s other searches the section anchor is "dubai ai strategy" (the live defect)', A0.includes('dubai ai strategy'), J(A0));
    check('with them it is left out, the other anchors stay', !A1.some(a => a.includes('dubai ai strategy')) && A1.includes('ai governance for uae enterprises'.toLowerCase()) || (!A1.some(a => a.includes('dubai ai strategy')) && A1.length >= 2), J(A1));
    const src = fs.readFileSync(path.join(__dirname, 'code_v4', 'Inbound_Candidates.js'), 'utf8');
    check('Inbound Candidates passes the planned pages\' keywords (content_links_to_add, ladder_links) as `avoid`', /content_links_to_add/.test(src) && /ladder_links/.test(src) && /avoid \}/.test(src));
  });

  await guard('CTX6 Word text', async () => {
    const SN = 'CTX6 CT-FIX2 D7: the Word report text has no em dash, arrow, "..." or curly quote; tags untouched';
    reset(); begin(SN); const check = mkCheck(SN);
    const src = fs.readFileSync(path.join(__dirname, 'code_v4', 'Build_Word_File.js'), 'utf8');
    const a = src.indexOf('const __plainWord = '); const b = src.indexOf('return \'>\' + x + \'<\'; });', a);
    check('the clean-up is in the generated Word builder and wraps the file body', a > 0 && b > a && src.includes("Buffer.from('\\ufeff' + __plainWord(html)"));
    const plainWord = new Function(src.slice(a, b + 'return \'>\' + x + \'<\'; });'.length) + '\nreturn __plainWord;')();
    const h = '<h1 style="a—b">ai consulting dubai — SEO Report + Page Content</h1><p>66/100 — revise</p><p>Assess & Envision → Build & Implement → Run</p><p>Top 14 AI Consulting Companies in the United Arab ...</p><p>as [Confirm: ...] for the owner</p><p>“quoted” it’s</p>';
    const o = plainWord(h);
    check('no em dash, arrow, "..." or curly quote left in the text', !/[—→…“”’]|\.\.\./.test(o.replace(/<[^>]*>/g, '')), o);
    check('the wording reads: a colon for the first dash, "to" for an arrow, the cut title without dots, the mark named', o.includes('ai consulting dubai: SEO Report') && o.includes('Assess & Envision to Build & Implement to Run') && o.includes('United Arab</p>') && o.includes('[Confirm: the sentence]'), o);
    check('attributes are untouched', o.includes('style="a—b"'));
  });

  await guard('CTX7 the judge\'s cost in the ledger', async () => {
    const SN = 'CTX7 CT-FIX2: the Promise Judge\'s reported usage is priced as MEASURED Haiku money in the run\'s Claude figure';
    reset(); begin(SN); const check = mkCheck(SN);
    const CC = kitFrom('Run_Ledger_Settle.js', 'CC');
    const r = CC.runCost([{ node: 'Promise Judge', model: 'claude-haiku-4-5-20251001', max_tokens: 4000, effort: '', streaming: false, prompt_chars: 0, output_chars: 0, usage: { promptTokens: 10400, completionTokens: 3800 }, calls: 2 }], {});
    check('two rounds, 10,400 in + 3,800 out at $1 / $5 per million = $0.0294, all measured', Math.abs(r.usd - 0.0294) < 0.0001 && Math.abs(r.measured_usd - 0.0294) < 0.0001, J({ usd: r.usd, m: r.measured_usd }));
    for (const f of ['Run_Ledger_Settle.js', 'Build_Word_File.js']) {
      const s = fs.readFileSync(path.join(__dirname, 'code_v4', f), 'utf8');
      check(f + ' sums every round of the judge\'s usage into __costCalls before pricing', s.includes("$('Promise Judge').all(0, r)") && s.indexOf("$('Promise Judge').all(0, r)") < s.indexOf('run_ledger.ai_cost = CC.runCost(__costCalls'));
    }
  });
  reset();
};
