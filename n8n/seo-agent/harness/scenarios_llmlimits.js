// LL1-LL9 (LLM-LIMITS, 2026-10-27, docs/llm-limits-2026-10-27/LIMITS.md): production, techand.ai, 2026-10-25, Content Cadence page run
// cad_20261022_techand-ai_2 ("ms 365 erp", n8n execution 2195). The Editor (Opus 5.5, adaptive thinking, maxTokensToSample 32,768 shared by
// thinking and answer) returned 749 words that end mid-word ("Does the add-on cover gratu"); the run replaced the complete 1,804-word draft
// with it and delivered half a page. On the GENERATED code and that run's REAL texts (harness/fixtures/llm_cutoff_techand_2195.json):
// the limits of every Claude node of every workflow (and the lint, broken on purpose), the completeness kit on each kind of output (page,
// e-mail, JSON), the two guards (retry once; keep the complete draft / stop the run cleanly), Content QA's own reason for a cut page, the
// wiring, and the cost of a retry and of a raised ceiling. Called from scenarios_v5.js before the report (one line).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const F = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'llm_cutoff_techand_2195.json'), 'utf8'));
  const LL = JSON.parse(fs.readFileSync(path.join(__dirname, 'llm_limits.json'), 'utf8'));
  const WD = path.join(__dirname, '..', 'workflows');
  const wf = (f) => { const w = JSON.parse(fs.readFileSync(path.join(WD, f), 'utf8')); return Array.isArray(w) ? w[0] : w; };
  const ck = async (fn, ...args) => (await run('Complete Kit', [{ json: { fn, args } }], { code: '_complete' }))[0].json.r;
  const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
  const BRIEF = { keyword: F.keyword, mode: 'content', domain: 'techand.ai', page_type: 'Service Page', target_word_count: 1600, content_brief: { h1: 'MS 365 ERP for UAE Businesses' } };
  const NR = { ...BRIEF, output: F.needs_revision_output, content_qa: { ...F.qa_round1, length_instruction: '' } };

  // ---------- LL1 the limits on every generated workflow, and the lint broken on purpose ----------
  // the same rule as llm_limits.findings_for (the build's lint), so the offline harness can break it without Python
  const lint = (L, node) => { const o = (node.parameters || {}).options || {}, out = [], mx = Number(o.maxTokensToSample || 0), thinking = !!o.thinking || o.thinkingMode === 'adaptive' || o.thinkingMode === 'manual';
    if (!L) return ['not declared'];
    if (mx < L.think + L.head) out.push('max below thinking budget + headroom');
    if (mx !== L.max) out.push('max not the declared one');
    if (mx > LL.nonstream_max && !o.streaming) out.push('needs streaming');
    if (mx > (LL.model_max[L.model] || Infinity)) out.push('above the model maximum');
    if (thinking && !L.think) out.push('thinking with no budget');
    if (L.think && !thinking) out.push('budget declared, thinking off');
    if (thinking && o.thinkingMode === 'manual') out.push('manual budget refused by the model');
    if (thinking && String(o.effort || '') !== L.effort) out.push('effort changed');
    return out; };
  await guard('LL1 limits', async () => {
    const SN = 'LL1 (LLM-LIMITS) every Claude node of every generated workflow is declared, has room for its thinking budget AND its whole answer, streams above the SDK limit, and lost no thinking or room; the lint bites when broken on purpose';
    reset(); begin(SN); const check = mkCheck(SN);
    const decl = new Map(LL.limits.map(L => [L.workflow + '|' + L.node, L]));
    const seen = [], bad = [];
    for (const f of fs.readdirSync(WD).filter(f => f.endsWith('.json') && f !== 'SEO_Agent_v3_original_export.json')) {
      for (const n of (wf(f).nodes || [])) { if (n.type !== '@n8n/n8n-nodes-langchain.lmChatAnthropic') continue;
        seen.push(f + '|' + n.name); const L = decl.get(f + '|' + n.name); const why = lint(L, n); if (why.length) bad.push([f, n.name, why]); } }
    console.log('   Claude nodes ->', seen.length, 'declared', decl.size);
    check('every Claude node (22) across the generated workflows is declared and passes the rule', seen.length === 22 && decl.size === 22 && !bad.length && seen.every(k => decl.has(k)), J(bad));
    const page = ['Claude — Copywriter', 'Claude — Editor', 'Claude — Strategy Brief'].map(n => decl.get('SEO_Agent_v4.json|' + n));
    check('the page / brief writers get the model maximum (128,000) with 64,000 for thinking and 32,000 for the page, streaming, effort unchanged (medium)',
      page.every(L => L.max === 128000 && L.think === 64000 && L.head === 32000 && L.stream && L.effort === 'medium' && L.model === 'claude-opus-5-5'), J(page));
    check('no node lost room: every new ceiling is at least the old one, and every thinking node streams', LL.limits.every(L => !L.old || !L.old.max || L.max >= L.old.max) && LL.limits.filter(L => L.think).every(L => L.stream), J(LL.limits.map(L => [L.node, L.old && L.old.max, L.max])));
    check('the old Editor ceiling (32,768) could not hold the thinking it used in production plus a page; the new one holds the budget and the page with room to spare',
      32768 < page[1].think + page[1].head && page[1].max - page[1].think - page[1].head >= 30000, J(page[1]));
    check('the Python lint ran its self-test in the build (it bit on every broken case)', Number(LL.self_test_cases) >= 8, J(LL.self_test_cases));
    const ed = wf('SEO_Agent_v4.json').nodes.find(n => n.name === 'Claude — Editor');
    const L = decl.get('SEO_Agent_v4.json|Claude — Editor');
    check('the generated Editor passes', lint(L, ed).length === 0, J(lint(L, ed)));
    const broken = (opts) => lint(L, { ...ed, parameters: { ...ed.parameters, options: opts } });
    check('BROKEN ON PURPOSE: the production value (32,768, thinking and page sharing it) fails', broken({ maxTokensToSample: 32768, streaming: true, thinking: true, thinkingMode: 'adaptive', effort: 'medium' }).includes('max below thinking budget + headroom'));
    check('BROKEN ON PURPOSE: 128,000 without streaming fails (the SDK refuses it)', broken({ maxTokensToSample: 128000, thinking: true, thinkingMode: 'adaptive', effort: 'medium' }).includes('needs streaming'));
    check('BROKEN ON PURPOSE: lowering the thinking (effort low) to make room fails', broken({ maxTokensToSample: 128000, streaming: true, thinking: true, thinkingMode: 'adaptive', effort: 'low' }).includes('effort changed'));
    check('BROKEN ON PURPOSE: a manual thinking budget (refused by Opus 5.5) fails', broken({ maxTokensToSample: 128000, streaming: true, thinking: true, thinkingMode: 'manual', thinkingBudget: 4000, effort: 'medium' }).includes('manual budget refused by the model'));
    check('BROKEN ON PURPOSE: an undeclared Claude node fails', lint(undefined, ed).includes('not declared'));
  });

  // ---------- LL2 the kit on each kind of output ----------
  await guard('LL2 kit kinds', async () => {
    const SN = 'LL2 (LLM-LIMITS) the completeness kit on a page, an e-mail and a JSON answer: a cut one is named in plain words, a complete one passes';
    reset(); begin(SN); const check = mkCheck(SN);
    const cw = await ck('text', F.copywriter_output), ed = await ck('text', F.editor_output);
    check('PAGE: the Copywriter\'s complete 1,804-word page ends cleanly (its call-to-action link)', cw.complete === true && /contact-us\)$/.test(cw.last_line), J(cw));
    check('PAGE: the Editor\'s production answer is cut: it stops at "Does the add-on cover gratu"', ed.cut_off === true && /gratu$/.test(ed.last_line) && /stops before its end/.test(ed.reasons.join(' ')), J(ed));
    const cut = (s, frac) => { let t = s.slice(0, Math.floor(s.length * frac)); return /\s$/.test(t) ? t + 'x' : t; };
    const tries = [0.31, 0.37, 0.44, 0.52, 0.58, 0.63, 0.71, 0.78, 0.86, 0.93].map(f => cut(F.copywriter_output, f));
    const caught = []; for (const t of tries) caught.push((await ck('text', t)).cut_off);
    check('PAGE: the same page cut mid-word at ten points is caught every time', caught.every(Boolean), J(caught));
    const mail = 'Hi Sara,\n\nI read your guide to e-invoicing in the UAE. Our readiness checklist could help your readers.\n\nBest regards,\nOmar Haddad\nHead of Partnerships, Tech&';
    const mailCut = 'Hi Sara,\n\nI read your guide to e-invoicing in the UAE and wondered whether you would consider adding our checklist to the resour';
    check('E-MAIL: a signed-off e-mail is complete; one that stops mid-word is cut', (await ck('text', mail)).complete === true && (await ck('text', mailCut)).cut_off === true);
    const js = await ck('json', '{"drafts":[{"n":1,"subject":"A resource for your readers","body":"Hi Sara, I read your guide'), ok = await ck('json', '{"drafts":[{"n":1,"body":"Hi."}]}');
    check('JSON: an answer that stops inside its JSON is TRUNCATED (never an empty or partial valid answer); a whole one parses', js.complete === false && js.truncated === true && js.value === null && ok.complete === true && ok.value.drafts.length === 1, J({ js, ok }));
    const err = await ck('answer', { json: { error: 'Unterminated string in JSON at position 8191' } }, 'json'), obj = await ck('answer', { json: { output: { drafts: [] } } }, 'json');
    check('JSON: an agent item that failed its parser twice (n8n leaves { error }) is named as cut off, an object answer is complete', err.complete === false && err.truncated === true && /cut off/.test(err.reason) && obj.complete === true, J({ err, obj }));
    const allPlain = [ed.reasons, js.reason, err.reason].flat().join(' ');
    check('every reason is plain words: no em dash, no curly quote, no ellipsis character', !/[—“”‘’…]/.test(allPlain), allPlain);
  });

  // ---------- LL3 the production replay: the Copywriter guard ----------
  await guard('LL3 copywriter guard', async () => {
    const SN = 'LL3 (LLM-LIMITS, exec 2195) the Copywriter\'s complete draft goes on unchanged; a cut draft is written once more; a second cut draft stops the run with a plain reason (never delivered)';
    reset(); begin(SN); const check = mkCheck(SN);
    mock('Parse Brief', [{ json: BRIEF }]);
    const ok = (await run('Draft Check (Copywriter)', [{ json: { output: F.copywriter_output } }], { runIndex: 0 }))[0].json;
    check('the complete draft passes unchanged, the check recorded', ok.output === F.copywriter_output && ok.llm_check.complete === true && !ok.llm_check.retry, J(ok.llm_check));
    const cutDraft = F.copywriter_output.slice(0, Math.floor(F.copywriter_output.length * 0.47)).replace(/\s+\S*$/, ' implementat');
    const r1 = (await run('Draft Check (Copywriter)', [{ json: { output: cutDraft } }], { runIndex: 0 }))[0].json;
    check('a cut draft goes back to the Copywriter with the SAME brief (its prompt reads the brief), and the reason is recorded', r1.llm_check.retry === true && r1.keyword === F.keyword && r1.page_type === 'Service Page' && /stopped before the end of the page/.test(r1.llm_check.note) && r1.output === undefined, J(r1.llm_check));
    const r2 = (await run('Draft Check (Copywriter)', [{ json: { output: F.copywriter_output } }], { runIndex: 1 }))[0].json;
    check('the second answer is complete: it is used, and the note says the first one was cut', r2.output === F.copywriter_output && r2.llm_check.complete === true && /wrote the page again/.test(r2.llm_check.note), J(r2.llm_check));
    let threw = null; try { await run('Draft Check (Copywriter)', [{ json: { output: cutDraft } }], { runIndex: 1, expectError: true }); } catch (e) { threw = e; }
    const last = H.results[H.results.length - 1];
    check('cut twice: the run stops with a plain reason, no page delivered', last && last.ok === false && /could not be written in full/.test(last.error) && /No page was delivered/.test(last.error), J(last && last.error));
    if (last && last.ok === false) { last.ok = true; last.error = 'threw as expected: ' + String(last.error).slice(0, 90); }
  });

  // ---------- LL4 the production replay: the Editor guard ----------
  await guard('LL4 editor guard', async () => {
    const SN = 'LL4 (LLM-LIMITS, exec 2195) the Editor\'s 749-word cut answer never replaces the complete 1,804-word page: it edits once more, and if that is cut too the complete page from before the edit is kept with its reason';
    reset(); begin(SN); const check = mkCheck(SN);
    mock('Parse Brief', [{ json: BRIEF }]); mock('Needs Revision?', [{ json: NR }]);
    const r1 = (await run('Edit Check (Editor)', [{ json: { output: F.editor_output } }], { runIndex: 0 }))[0].json;
    check('round 1, attempt 1: the cut edit is caught (ends mid-word, 666 of 1,724 words, sections missing) and the Editor is asked again with the page it was given',
      r1.llm_check.retry === true && r1.output === F.needs_revision_output && r1.llm_check.words_after === 666 && r1.llm_check.words_before > 1700
      && r1.llm_check.reasons.some(x => /stops before its end/.test(x)) && r1.llm_check.reasons.some(x => /666 words of main text/.test(x)) && r1.llm_check.reasons.some(x => /sections/.test(x)), J(r1.llm_check));
    const r2 = (await run('Edit Check (Editor)', [{ json: { output: F.editor_output } }], { runIndex: 1 }))[0].json;
    check('attempt 2 cut again: the COMPLETE page from before the edit is delivered to the quality check, not the 749 words', r2.output === F.needs_revision_output && words(r2.output) > 1700 && r2.llm_check.kept_draft === true && !r2.llm_check.retry, J({ w: words(r2.output), c: r2.llm_check }));
    check('the reason is recorded in plain words for the owner and for ops', /stopped before the end of the page twice/.test(r2.llm_check.note) && /complete page from before that edit was kept/.test(r2.llm_check.note), r2.llm_check.note);
    // a retry that comes back complete is used
    {
      reset(); mock('Parse Brief', [{ json: BRIEF }]); mock('Needs Revision?', [{ json: NR }]);
      await run('Edit Check (Editor)', [{ json: { output: F.editor_output } }], { runIndex: 0 });
      const fixed = F.needs_revision_output.replace('Business Central or Finance and Supply Chain Management: which should I choose?', 'Business Central or Finance and Supply Chain Management: which fits your business?');
      const r3 = (await run('Edit Check (Editor)', [{ json: { output: fixed } }], { runIndex: 1 }))[0].json;
      check('a retry that returns a complete edit is used (the edit, not the old page)', r3.output === fixed && r3.output !== F.needs_revision_output && r3.llm_check.complete === true && /edited the page again/.test(r3.llm_check.note), J(r3.llm_check));
    }
    // a later round starts its own count: the previous Edit Check run of round 1 was complete, so round 2 may retry once again
    reset(); mock('Parse Brief', [{ json: BRIEF }]); mock('Needs Revision?', [{ json: NR }]);
    await run('Edit Check (Editor)', [{ json: { output: F.needs_revision_output } }], { runIndex: 0 });
    const r4 = (await run('Edit Check (Editor)', [{ json: { output: F.editor_output } }], { runIndex: 1 }))[0].json;
    check('round 2\'s first cut edit is retried (the count is per quality round), and the loop cannot run away (one retry a round)', r4.llm_check.retry === true && r4.llm_check.round_attempt === 1, J(r4.llm_check));
  });

  // ---------- LL5 a normal shorter edit still passes ----------
  await guard('LL5 shorter by design', async () => {
    const SN = 'LL5 (LLM-LIMITS) an edit that is shorter because the quality check asked for a cut, and ends cleanly, passes; the same cut without that request is caught';
    reset(); begin(SN); const check = mkCheck(SN);
    const paras = F.needs_revision_output.split('\n\n');
    // drop a third of the plain paragraphs in the middle (never headings, the meta lines or the closing call to action)
    const total = words(F.needs_revision_output); let removed = 0;
    const kept = paras.filter((p, i) => { const plainPara = !/^(#|\||-|\d+\.|\*\*Quick|Title:|\[)/.test(p.trim()) && i > 3 && i < paras.length - 3;
      if (plainPara && removed < total * 0.4) { removed += words(p); return false; } return true; });
    const shorter = kept.join('\n\n');
    mock('Parse Brief', [{ json: BRIEF }]);
    mock('Needs Revision?', [{ json: { ...NR, content_qa: { ...NR.content_qa, length_instruction: 'CUT 600 words: the main content is 1724 words against the band of 900-1300.', over_words: 600 } } }]);
    const r = (await run('Edit Check (Editor)', [{ json: { output: shorter } }], { runIndex: 0 }))[0].json;
    console.log('   shorter edit ->', words(shorter), 'of', words(F.needs_revision_output), 'words');
    check('QA asked to cut: the edit keeps under 75% of the page, ends cleanly and keeps its sections: it passes and is used', words(shorter) < 0.75 * words(F.needs_revision_output)
      && r.output === shorter && r.llm_check.complete === true && r.llm_check.cut_requested === true, J({ w: words(shorter), c: r.llm_check }));
    reset(); mock('Parse Brief', [{ json: BRIEF }]); mock('Needs Revision?', [{ json: NR }]);
    const r1 = (await run('Edit Check (Editor)', [{ json: { output: shorter } }], { runIndex: 0 }))[0].json;
    check('the same edit when NO cut was asked for is treated as cut off (it lost a third of the page)', r1.llm_check.retry === true && r1.llm_check.cut_requested === false, J(r1.llm_check));
    reset(); mock('Parse Brief', [{ json: BRIEF }]); mock('Needs Revision?', [{ json: NR }]);
    const tiny = paras.slice(0, Math.floor(paras.length * 0.4)).join('\n\n').replace(/\n*$/, '') + '\n\n[Request a scoping consultation](https://www.techand.ai/contact-us)';
    const r2 = (await run('Edit Check (Editor)', [{ json: { output: tiny } }], { runIndex: 0 }))[0].json;
    check('no cut asked for: an edit that keeps under 75% of the page is a cut-off even when its last line is clean', r2.llm_check.retry === true && r2.llm_check.reasons.some(x => /no cut was asked for/.test(x)), J(r2.llm_check));
  });

  // ---------- LL6 Content QA: a cut page is its own reason and never publishable ----------
  await guard('LL6 content qa', async () => {
    const SN = 'LL6 (LLM-LIMITS) Content QA names a cut page in plain words as its own reason ("the page is cut off at the end"), not as "short", and never marks it publishable';
    reset(); begin(SN); const check = mkCheck(SN);
    const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_ctfix2_159.json.gz'))).toString());
    const clone = (x) => JSON.parse(JSON.stringify(x));
    const mocks = () => { mock('Parse Brief', [{ json: clone(FX.parse_brief) }]); mock('Site Model', [{ json: { site_model: clone(FX.site_model) } }]); mock('Analyze Competitor Pages', [{ json: { competitors: [] } }]);
      mock('Needs Revision?', [{ json: clone(FX.needs_revision_r1) }]); };
    mocks();
    const whole = (await run('Content QA', [{ json: { output: FX.editor_output, critique: null } }], { runIndex: 1 }))[0].json.content_qa;
    check('the whole page of exec 159 is not cut off', whole.cut_off === false && !(whole.not_ready_reasons || []).some(r => /cut off/.test(r)), J({ c: whole.cut_off, r: whole.not_ready_reasons }));
    reset(); mocks();
    const half = FX.editor_output.slice(0, Math.floor(FX.editor_output.length * 0.45)).replace(/\s+\S*$/, ' implementat');
    const q = (await run('Content QA', [{ json: { output: half, critique: null } }], { runIndex: 1 }))[0].json;
    const qa = q.content_qa;
    check('the cut page: cut_off, not publishable, not ready', qa.cut_off === true && qa.publishable === false && qa.passed === false && qa.not_ready === true && qa.quality.cut_off === true, J({ c: qa.cut_off, p: qa.publishable, nr: qa.not_ready }));
    check('the first reason says the page is cut off at the end and quotes where it stops; no "main content is N words" short reason beside it',
      /^the page is cut off at the end: it stops at ".*implementat"/.test(qa.not_ready_reasons[0] || '') && !qa.not_ready_reasons.some(r => /^the main content is \d+ words against a target/.test(r)), J(qa.not_ready_reasons));
    check('the reason is plain words (no em dash, no ellipsis character)', !/[—…]/.test(qa.not_ready_reasons[0]), qa.not_ready_reasons[0]);
  });

  // ---------- LL7 the wiring and the notes ----------
  await guard('LL7 wiring', async () => {
    const SN = 'LL7 (LLM-LIMITS) the generated main workflow: the Copywriter and the Editor are followed by their check and an IF that loops back once; the notes reach the run ledger; every monitor settle names a cut answer';
    reset(); begin(SN); const check = mkCheck(SN);
    const W = wf('SEO_Agent_v4.json'), C = W.connections, N = Object.fromEntries(W.nodes.map(n => [n.name, n]));
    const outs = (n) => ((C[n] || {}).main || []).map(l => (l || []).map(t => t.node));
    check('After Count (Copywriter) -> Draft Check (Copywriter) -> Draft Complete? (Copywriter) -> [Critic] / [Copywriter]',
      J(outs('After Count (Copywriter)')) === J([['Draft Check (Copywriter)']]) && J(outs('Draft Check (Copywriter)')) === J([['Draft Complete? (Copywriter)']]) && J(outs('Draft Complete? (Copywriter)')) === J([['Critic'], ['Copywriter']]), J([outs('After Count (Copywriter)'), outs('Draft Complete? (Copywriter)')]));
    check('After Count (Editor) -> Edit Check (Editor) -> Edit Complete? (Editor) -> [Promise Candidates] / [Editor]',
      J(outs('After Count (Editor)')) === J([['Edit Check (Editor)']]) && J(outs('Edit Check (Editor)')) === J([['Edit Complete? (Editor)']]) && J(outs('Edit Complete? (Editor)')) === J([['Promise Candidates'], ['Editor']]), J(outs('Edit Complete? (Editor)')));
    const cond = (n) => N[n].parameters.conditions.conditions[0].leftValue;
    check('both IFs route on the check\'s own retry flag (a kept draft goes on, a retry goes back)', cond('Draft Complete? (Copywriter)') === '={{ !($json.llm_check && $json.llm_check.retry) }}' && cond('Edit Complete? (Editor)') === cond('Draft Complete? (Copywriter)'), cond('Edit Complete? (Editor)'));
    check('the run ledger\'s basis line names a cut answer first (ops see it on the row)', /Claude answer cut short: /.test(N['Run Ledger Settle'].parameters.jsCode) && /__llmNote \+ \(dfs_day/.test(N['Run Ledger Settle'].parameters.jsCode));
    const mon = ['SEO_Agent_AI_Visibility.json', 'SEO_Agent_Backlink_Monitor.json', 'SEO_Agent_Link_Builder.json', 'SEO_Agent_AI_Growth.json', 'SEO_Agent_Site_Tracker.json'];
    const settles = mon.map(f => wf(f).nodes.filter(n => /^Ledger Settle \(/.test(n.name)).map(n => n.parameters.jsCode)).flat();
    check('every monitor settle with a Claude agent checks each answer with the kit and writes "Claude answer incomplete" on the row', settles.length >= 5 && settles.every(s => s.includes('const CK = (() => {') && s.includes("CK.answer(a, 'json')") && s.includes('Claude answer incomplete: ')), settles.length);
  });

  // ---------- LL8 money: a raised ceiling is room, a retry is priced ----------
  await guard('LL8 cost', async () => {
    const SN = 'LL8 (LLM-LIMITS) the cost of a page call is the same at the new ceiling (the ceiling is room, not spend), and a retried call is priced as a second call, never silently';
    reset(); begin(SN); const check = mkCheck(SN);
    const kit = async (j) => (await run('Cost Kit', [{ json: j }], { code: '_cost_cal' }))[0].json;
    const CW = require('./cost_wiring.json');
    const cw = CW.ai_calls.find(c => c.node === 'Copywriter'), cr = CW.ai_calls.find(c => c.node === 'Critic');
    const base = { node: 'Copywriter', model: 'claude-opus-5-5', effort: 'medium', streaming: true, prompt_chars: 40000, output_chars: 19000, calls: 1 };
    const before = await kit({ call: 'callCost', call_spec: { ...base, max_tokens: 32768 } });
    const now = await kit({ call: 'callCost', call_spec: { ...base, max_tokens: cw.max_tokens, think_model: cw.think_model } });
    check('the Copywriter at 128,000 costs what it cost at 32,768 (its thinking price is declared, 3,277 tokens)', cw.max_tokens === 128000 && cw.think_model === 3277 && now.usd === before.usd && now.think_tokens === before.think_tokens, J({ before: before.usd, now: now.usd, t: now.think_tokens }));
    const crit = await kit({ call: 'callCost', call_spec: { node: 'Critic', model: 'claude-sonnet-5-5', effort: 'medium', streaming: cr.streaming, max_tokens: cr.max_tokens, think_model: cr.think_model, prompt_chars: 26000, output_chars: 4500, calls: 1 } });
    const critOld = await kit({ call: 'callCost', call_spec: { node: 'Critic', model: 'claude-sonnet-5-5', effort: 'medium', streaming: false, max_tokens: 16384, prompt_chars: 26000, output_chars: 4500, calls: 1 } });
    check('a Sonnet node that now streams keeps the thinking it was seen to do (no jump from the raised ceiling)', cr.streaming === true && cr.think_model === 'seen' && crit.usd === critOld.usd, J({ crit: crit.usd, old: critOld.usd }));
    const retried = await kit({ call: 'callCost', call_spec: { ...base, max_tokens: cw.max_tokens, think_model: cw.think_model, calls: 2, retries: 1 } });
    check('a retry of the page writer is priced as a second call and the basis says so', retried.calls === 2 && Math.abs(retried.usd - 2 * now.usd) < 0.0002 && /were a retry/.test(retried.basis), J({ usd: retried.usd, basis: retried.basis }));
  });
};
