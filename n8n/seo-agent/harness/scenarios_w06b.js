// W06B1-W06B5 (page-quality fix wave W06-B, 2026-10-30; docs/page-quality-2026-10-29/WAVE05.md 3.2 / 3.3, "Deploy readiness" items 2 and 3).
// What the wave 0.5 paid re-check found, pinned on anonymised replays:
//   * K4 first try (exec 379): the writer twice answered a complete ~2,100-word page whose last line is the bare call to action "Book a
//     consultation"; *Draft Check (Copywriter)* read it as a sentence with no ending and failed the run (about $0.85 of Claude lost). The two
//     answers are in harness/fixtures/w06b_k4_cta_end.json (business name, domain, phone, e-mail and address replaced). The kit of the
//     deployed build reads both as cut off; the current one reads both as complete and still catches every cut version of the same ending.
//   * The same run threw inside Draft Check: its run-ledger row stayed `reserved` at $0 and the app's opening content-log row stayed
//     `started`, which the app then read as "a page ... was already written" and counted among the pages waiting. The failure path now
//     marks that row `failed`, settles the ledger with what the run spent (and teaches the calibration nothing), then stops the run.
//   * K1 "Write it anyway": the separate new page was given the existing page's own address (/ms-365-erp-uae). Parse Brief moves a new
//     page's slug off any address the website already has; a rewrite and a keyword-ladder page keep theirs.
// Called from scenarios_v5.js (one line). Every check runs the GENERATED code (harness/code_v4).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'w06b_k4_cta_end.json'), 'utf8'));
  const WD = path.join(__dirname, '..', 'workflows');
  const wf = (f) => { const w = JSON.parse(fs.readFileSync(path.join(WD, f), 'utf8')); return Array.isArray(w) ? w[0] : w; };
  const ck = async (fn, ...args) => (await run('Complete Kit', [{ json: { fn, args } }], { code: '_complete' }))[0].json.r;
  const PLAIN = /[—–…‘’“”]/;
  const BRIEF = { keyword: FX.keyword, mode: 'keyword', domain: 'northwind.example', page_type: FX.page_type, cta: FX.cta,
    content_brief: { target_word_count: FX.target_word_count, cta: FX.brief_cta, h1: 'Dynamics 365 Partner in Dubai' } };
  // the same page with another last line (the paragraph before it and the blank line kept)
  const endWith = (page, last) => page.replace(/\n[^\n]*\s*$/, '\n' + last);

  // ---------- W06B1 the K4 replay: a complete page that ends on its call to action ----------
  await guard('W06B1 cta end', async () => {
    const SN = 'W06B1 (WAVE05 3.2, K4 first try exec 379) the two complete pages that end on the bare call to action "Book a consultation" are complete: Draft Check passes the first answer at once, with or without the brief\'s CTA';
    reset(); begin(SN); const check = mkCheck(SN);
    const [a1, a2] = FX.answers;
    check('the replay is the production shape: two pages of 2,000+ words whose last line is "Book a consultation", under the H2 "Book a consultation with ..."',
      a1.split(/\s+/).length > 2000 && a2.split(/\s+/).length > 2000 && /\n\nBook a consultation$/.test(a1) && /\n\nBook a consultation$/.test(a2) && /## Book a consultation with Northwind/.test(a1), J([a1.slice(-80), a2.slice(-80)]));
    const k1 = await ck('text', a1), k2 = await ck('text', a2), k1c = await ck('text', a1, { cta: [FX.cta, FX.brief_cta] });
    check('the kit reads both answers as complete (the deployed kit read both as "the last sentence has no ending")', k1.complete === true && k2.complete === true && k1c.complete === true, J([k1, k2]));
    mock('Parse Brief', [{ json: BRIEF }]);
    const r1 = (await run('Draft Check (Copywriter)', [{ json: { output: a1 } }], { runIndex: 0 }))[0].json;
    check('Draft Check: the first answer goes on to the review unchanged (no retry, no second Copywriter call, no failed run)', r1.output === a1 && r1.llm_check.complete === true && !r1.llm_check.retry && !r1.llm_check.failed, J(r1.llm_check));
    const r2 = (await run('Draft Check (Copywriter)', [{ json: { output: a2 } }], { runIndex: 1 }))[0].json;
    check('Draft Check: the second answer is complete too', r2.output === a2 && r2.llm_check.complete === true, J(r2.llm_check));
    const ed = await ck('edit', a1, a1, { cta: [FX.cta] });
    check('an edit that keeps the same ending is complete (the Editor\'s check reads the same rule)', ed.complete === true, J(ed));
    // a button line in title case, and a link-free button made of the section's words, end a page too
    const tc = await ck('text', endWith(a1, 'Book A Consultation'));
    check('the same button in title case ends the page cleanly', tc.complete === true, J(tc));
  });

  // ---------- W06B2 the cut ones are still caught ----------
  await guard('W06B2 cuts caught', async () => {
    const SN = 'W06B2 (WAVE05 3.2) a cut page is still caught: the same call to action cut mid-word, on a dangling word, inside a number, as a long sentence, after a heading, and the same page cut at ten points';
    reset(); begin(SN); const check = mkCheck(SN);
    const a1 = FX.answers[0];
    const cases = [['Book a consult', 'mid-word'], ['Book a consultation with', 'dangling word'], ['Call +971 4 000', 'inside a number'],
      ['If you are comparing options for a Dynamics 365 partner in Dubai, book', 'a long sentence'], ['Book a consultation,', 'a comma'],
      ['Request a free audit', 'a button whose words are not on the page']];
    const out = [];
    for (const [last, why] of cases) { const r = await ck('text', endWith(a1, last), { cta: [FX.cta] }); out.push([why, r.cut_off]); }
    check('every cut version of the ending is caught', out.every(x => x[1] === true), J(out));
    const own = await ck('text', endWith(a1, 'Request a free audit'), { cta: ['Request a free audit'] });
    check('the same line IS the brief\'s call to action: complete', own.complete === true, J(own));
    const head = a1.replace(/\n\nIf you are comparing options[^\n]*\n\nBook a consultation$/, '\n\nBook a consultation');
    const h1 = await ck('text', head), h2 = await ck('text', head, { cta: ['Book a consultation'] });
    check('a short line straight under a heading is complete only when it is the brief\'s call to action', /## Book a consultation with Northwind\n\nBook a consultation$/.test(head) && h1.cut_off === true && h2.complete === true, J([h1.reasons, h2.complete, head.slice(-90)]));
    const cut = (s, frac) => { let t = s.slice(0, Math.floor(s.length * frac)); return /\s$/.test(t) ? t + 'x' : t; };
    const caught = []; for (const f of [0.31, 0.37, 0.44, 0.52, 0.58, 0.63, 0.71, 0.78, 0.86, 0.93, 0.97, 0.99]) caught.push((await ck('text', cut(a1, f), { cta: [FX.cta, FX.brief_cta] })).cut_off);
    check('the K4 page cut mid-word at twelve points (two inside its last section) is caught every time', caught.every(Boolean), J(caught));
    const reasons = (await ck('text', endWith(a1, 'Book a consult'))).reasons.join(' ');
    check('the reason stays plain words', !PLAIN.test(reasons) && reasons.length > 0, reasons);
  });

  // ---------- W06B3 a failed run: no "written" row, the ledger settled, the run stops ----------
  await guard('W06B3 failure path', async () => {
    const SN = 'W06B3 (WAVE05 3.2) a page cut twice: Draft Check hands a failed item to the failure path, the run\'s own started content-log row becomes failed, the ledger row settles what was spent (no calibration), and the run stops with the same reason';
    reset(); begin(SN); const check = mkCheck(SN);
    mock('Parse Brief', [{ json: BRIEF }]);
    const cutPage = FX.answers[0].slice(0, Math.floor(FX.answers[0].length * 0.6)).replace(/\s+\S*$/, ' implementat');
    await run('Draft Check (Copywriter)', [{ json: { output: cutPage } }], { runIndex: 0 });
    const f = (await run('Draft Check (Copywriter)', [{ json: { output: cutPage } }], { runIndex: 1 }))[0].json;
    check('second cut: a failed item (no throw inside the check), the reason kept word for word', f.llm_check.failed === true && f.llm_check.retry === false
      && /^The page could not be written in full: the writer stopped before the end of the page twice/.test(f.llm_check.error) && /Start the page again\.$/.test(f.llm_check.error), J(f.llm_check));
    const failedItem = f;
    // the run's own opening row: by request id AND keyword, only while it says `started`
    mock('Normalize Input', [{ json: { request_id: '378', keyword: FX.keyword, domain: 'northwind.example' } }]);
    mock('Load Content Log (Failed)', [
      { json: { request_id: '378', keyword: 'Dynamics 365 Partner Dubai', status: 'started', site_id: 'site_northwind-example', domain: 'northwind.example' } },
      { json: { request_id: '378', keyword: 'dynamics 365 consultant dubai', status: 'started' } },
      { json: { request_id: '378', keyword: FX.keyword, status: 'written' } }]);
    const row = (await run('Page Run Failed Row', [failedItem]))[0].json;
    check('Page Run Failed Row names this run\'s started row (its stored spelling), never the sibling page of the same request or a written page', row.request_id === '378' && row.keyword === 'Dynamics 365 Partner Dubai'
      && row.status === 'failed' && row.marked === 1 && /^page run failed: The page writer stopped before the end of the page twice/.test(row.qa_reasons), J(row));
    mock('Load Content Log (Failed)', [{ json: { request_id: '378', keyword: FX.keyword, status: 'written' } }]);
    const none = (await run('Page Run Failed Row', [failedItem]))[0].json;
    check('no started row of this run: a key that matches no row (a written page for the keyword is left as it is)', none.request_id === '__no_row__' && none.keyword === '__no_row__' && none.marked === 0, J(none));
    const W = wf('SEO_Agent_v4.json'), N = Object.fromEntries(W.nodes.map(n => [n.name, n])), C = W.connections;
    const outs = (n) => ((C[n] || {}).main || []).map(l => (l || []).map(t => t.node));
    const mk = N['Mark Page Run Failed'];
    const conds = mk.parameters.filters.conditions.map(c => [c.keyName, c.condition, c.keyValue]);
    check('Mark Page Run Failed updates seo_content_log where request id, keyword AND status started match, to failed with the reason; it can never end the run',
      mk.parameters.operation === 'update' && mk.parameters.dataTableId.value === 'seo_content_log' && J(conds) === J([['request_id', 'eq', '={{ $json.request_id }}'], ['keyword', 'eq', '={{ $json.keyword }}'], ['status', 'eq', 'started']])
      && mk.parameters.columns.value.status === '={{ $json.status }}' && mk.parameters.columns.value.qa_reasons === '={{ $json.qa_reasons }}' && mk.onError === 'continueRegularOutput' && mk.alwaysOutputData === true, J([conds, mk.parameters.columns.value]));
    check('the failure path: Draft Written? (false) -> Load Content Log (Failed) -> Page Run Failed Row -> Mark Page Run Failed -> the settle chain (DFS Balance End); Settle Run Ledger -> Stop Failed Run',
      J(outs('Draft Written? (Copywriter)')[1]) === J(['Load Content Log (Failed)']) && J(outs('Load Content Log (Failed)')) === J([['Page Run Failed Row']])
      && J(outs('Page Run Failed Row')) === J([['Mark Page Run Failed']]) && J(outs('Mark Page Run Failed')) === J([['DFS Balance End']]) && outs('Settle Run Ledger')[0].includes('Stop Failed Run')
      && N['Draft Written? (Copywriter)'].parameters.conditions.conditions[0].leftValue === '={{ !($json.llm_check && $json.llm_check.failed) }}', J([outs('Draft Written? (Copywriter)'), outs('Settle Run Ledger')]));
    // the settle: done, with the money of the run, saying first that it failed
    const LED = { run_id: 'exec-379', key: 'app:co_1', mode: 'keyword', est_usd: 1.2, created_at: new Date(Date.now() - 600000).toISOString(), status: 'reserved', settled_usd: 0,
      domain: 'northwind.example', dfs_est_usd: 0.03, dfs_usd: 0, dfs_balance: 38.2378, cost_mode: 'content|keyword' };
    mock('Run Ledger Row', [{ json: LED }]); mock('Rate Limit', [{ json: { mode: 'keyword', domain: 'northwind.example' } }]);
    mock('Load Run Ledger', [{ json: {} }]); mock('Load Run Ledger (Settle)', [{ json: { ...LED } }]);
    mock('DFS Balance End', [{ json: { tasks: [{ result: [{ money: { balance: 38.2178 } }] }] } }]);
    const s = (await run('Run Ledger Settle', [{ json: {} }]))[0].json;
    console.log('   settle ->', J({ st: s.status, f: s.run_failed, dfs: s.dfs_usd, src: s.dfs_source, basis: String(s.cost_basis).slice(0, 160) }));
    check('the ledger row settles (status done, a settle time, the account\'s DataForSEO move for this run) and says first that the run failed', s.status === 'done' && s.run_failed === true
      && s.run_failed_node === 'Draft Check (Copywriter)' && typeof s.settled_at === 'string' && s.dfs_usd === 0.02 && /^Run failed, no page written \(Draft Check \(Copywriter\)\)/.test(s.cost_basis), J(s));
    mock('Run Ledger Settle', [{ json: { ...s, ai_calls: 3, ai_usd: 0.85, ai_measured: false, dfs_measured: true, dfs_usd: 0.02, ai_models: { opus: 0.85 } } }]);
    mock('Load Cost Calibration', [{ json: {} }]);
    const cal = (await run('Cost Calibration Row', [{ json: {} }])).map(i => i.json);
    mock('Run Ledger Settle', [{ json: { ...s, run_failed: false, ai_calls: 3, ai_usd: 0.85, ai_measured: false, dfs_measured: true, dfs_usd: 0.02, ai_models: { opus: 0.85 } } }]);
    const calOk = (await run('Cost Calibration Row', [{ json: {} }])).map(i => i.json);
    check('the failed run moves neither rolling estimate (its spend stays in the month\'s per-model figure); a finished run still does', !cal.some(r => /^cost:(ai|dfs):/.test(String(r.key)))
      && cal.some(r => /opus/.test(String(r.key))) && calOk.some(r => /^cost:ai:/.test(String(r.key))) && calOk.some(r => /^cost:dfs:/.test(String(r.key))), J([cal.map(r => r.key), calOk.map(r => r.key)]));
    // the stop: the same sentence the app's failure watcher and the error handler read; a run that did not fail passes through
    let threw = null; try { await run('Stop Failed Run', [{ json: {} }], { expectError: true }); } catch (e) { threw = e; }
    const last = H.results[H.results.length - 1];
    check('Stop Failed Run ends the run with the check\'s own sentence', last && last.ok === false && /The page could not be written in full: the writer stopped before the end of the page twice/.test(last.error), J(last && last.error));
    if (last && last.ok === false) { last.ok = true; last.error = 'threw as expected: ' + String(last.error).slice(0, 90); }
    mock('Draft Check (Copywriter)', [{ json: { output: FX.answers[0], llm_check: { complete: true } } }]);
    const pass = await run('Stop Failed Run', [{ json: {} }]);
    check('a run whose page was written passes Stop Failed Run with nothing out', Array.isArray(pass) && pass.length === 0, J(pass));
    delete store['Draft Check (Copywriter)'];
    const pass2 = await run('Stop Failed Run', [{ json: {} }]);
    check('a run that never wrote a page (a report, an audit) passes it too', Array.isArray(pass2) && pass2.length === 0, J(pass2));
  });

  // ---------- W06B4 "Write it anyway": the separate new page gets its own address ----------
  await guard('W06B4 own address', async () => {
    const SN = 'W06B4 (WAVE05 3.3, K1 "ms 365 erp") after "Write it anyway" the separate new page never takes the address of the page the client chose to keep; a rewrite and a ladder page keep theirs';
    reset(); begin(SN); const check = mkCheck(SN);
    const Wb = 'https://www.novaand.example';
    const CTX = { keyword: 'ms 365 erp', domain: 'novaand.example', page_type: 'Service Page', page_role: 'standard', verdict_changes: [], competitor_analysis: {}, content_brief: {},
      hold_ack: { score: 52 }, existing_page: null, existing_page_url: '',
      existing_page_ignored: { url: Wb + '/ms-365-erp-uae', why: 'you chose "Write it anyway", so a separate new page is written and this page is read as a related page and left as it is' },
      site_urls: [Wb, Wb + '/whatwedo', Wb + '/ms-365-erp-uae', Wb + '/dynamics-365-crm-uae', Wb + '/insights/is-microsoft-dynamics-365-an-erp-system'],
      internal_link_candidates: [{ url: Wb + '/', path: '/' }, { url: Wb + '/ms-365-erp-uae', path: '/ms-365-erp-uae' }] };
    const BR = { slug: 'ms-365-erp-uae', target_word_count: 1800, h1: 'MS 365 ERP for UAE businesses', outline: [{ h2: 'What MS 365 ERP means', target_words: 900 }, { h2: 'Next step', target_words: 900 }], gaps_to_cover: [] };
    const pb = async (ctx, br) => { mock('Brief Context', [{ json: ctx }]); return (await run('Parse Brief', [{ json: { output: JSON.stringify(br || BR) } }]))[0].json; };
    const a = await pb(CTX);
    console.log('   slug ->', a.content_brief.slug, '|', (a.brief_adjustments || []).find(x => /^Slug/.test(x)));
    check('the brief\'s slug (the kept page\'s own, ms-365-erp-uae) moves to the keyword\'s own address, and the brief says why in plain words',
      a.content_brief.slug === 'ms-365-erp' && (a.brief_adjustments || []).some(x => /^Slug "ms-365-erp-uae" -> "ms-365-erp": your website already has a page at \/ms-365-erp-uae \(the page you chose to leave as it is\)/.test(x))
      && !(a.brief_adjustments || []).some(x => /^Slug/.test(x) && PLAIN.test(x)), J([a.content_brief.slug, a.brief_adjustments]));
    const b = await pb({ ...CTX, site_urls: [...CTX.site_urls, Wb + '/ms-365-erp'] });
    check('the keyword\'s own address is taken too: a free variant by page type (ms-365-erp-uae-services)', b.content_brief.slug === 'ms-365-erp-uae-services', b.content_brief.slug);
    const rw = await pb({ ...CTX, existing_page: { url: Wb + '/ms-365-erp-uae', source: 'provided' }, existing_page_url: Wb + '/ms-365-erp-uae', existing_page_ignored: null, hold_ack: null });
    check('"Improve the existing page" (a named rewrite) keeps the page\'s own address', rw.content_brief.slug === 'ms-365-erp-uae' && !(rw.brief_adjustments || []).some(x => /^Slug/.test(x)), J(rw.brief_adjustments));
    const lad = await pb({ ...CTX, ladder_id: 'lad_x', ladder_target_url: Wb + '/ms-365-erp-uae/' });
    check('a keyword-ladder page keeps the address its ladder planned (R15)', lad.content_brief.slug === 'ms-365-erp-uae', lad.content_brief.slug);
    const free = await pb(CTX, { ...BR, slug: 'ms-365-erp-guide-uae' });
    check('a new page whose slug is free keeps it', free.content_brief.slug === 'ms-365-erp-guide-uae' && !(free.brief_adjustments || []).some(x => /^Slug/.test(x)), free.content_brief.slug);
    const other = await pb({ ...CTX, hold_ack: null, existing_page_ignored: null }, { ...BR, slug: 'dynamics-365-crm-uae' });
    check('any new page that would land on another page\'s address (K4 in the AFTER run) moves off it too', other.content_brief.slug === 'ms-365-erp', other.content_brief.slug);
  });

  // ---------- W06B5 the hold copy says what each choice does ----------
  await guard('W06B5 hold copy', async () => {
    const SN = 'W06B5 (WAVE05 3.3) the hold reason for a page the website already has says what each choice does: "Improve the existing page" rewrites it at its own address, "Write it anyway" writes a separate page at a new address of its own';
    reset(); begin(SN); const check = mkCheck(SN);
    const src = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), 'Parse_Verdict.js'), 'utf8');
    check('the generated Parse Verdict carries the new sentence and not the old one', /Choose "Improve the existing page" to rewrite that page at its own address/.test(src)
      && /"Write it anyway" for a separate new page at a new address of its own; your existing page then stays as it is/.test(src) && !/This run would rewrite that page at its own address/.test(src));
  });
};
