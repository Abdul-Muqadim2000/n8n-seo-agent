// W2-E3 (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/WAVE2_CONTRACTS.md §2-§5, fixes/W2-E3.md): coverage and demand at the leaders'
// level, plus wave 1's operational leftovers. Every scenario here fails on the code before W2-E3 (its nodes, kit, columns and options did not
// exist) and passes after it. Called from scenarios_v5.js after scenarios_f2.js; reads only the generated code (code_v4), the golden cost table
// and the generated wiring (w2e3_wiring.json).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'g6_live.json.gz'))).toString('utf8'));
  const W = FX.weekly;
  const TC = JSON.parse(fs.readFileSync(path.join(__dirname, 'table_cols.json'), 'utf8'));
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 600), items: [] }); console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 450))); };
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
  const kitOf = (file, name) => { const src = fs.readFileSync(path.join(CD, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' not inlined in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const AIP = kitOf('AI_Requests.js', 'AIP');
  // several kits from one generated node, in the order the node inlines them (AIX reads AIP and SC at call time)
  const kitsOf = (file, names) => { const src = fs.readFileSync(path.join(CD, file), 'utf8'); const parts = names.map(nm => { const a = src.indexOf('const ' + nm + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(nm + ' not inlined in ' + file); return src.slice(a, b + 6); }); return new Function(parts.join('\n') + '\nreturn { ' + names.join(', ') + ' };')(); };
  let AIX = null; try { AIX = kitsOf('AI_Extras.js', ['AIP', 'SC', 'AIX']).AIX; } catch (e) { console.log('   (W2-E3 kit not generated: ' + String(e.message).slice(0, 120) + ')'); }   // before W2-E3 there is no kit: each scenario then fails on its own
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const SITE = 'site_techand-ai';
  const PANEL = Array.from({ length: 15 }, (_, i) => ({ prompt_id: 'w3_' + String(i).padStart(2, '0'), prompt: 'Which e-invoicing provider in the UAE suits a company of ' + (10 + i) + ' people?', kind: 'recommend',
    topic: i % 2 ? 'e-invoicing' : 'peppol', keyword: i % 2 ? 'e-invoicing provider uae' : 'peppol access point uae', cluster: i % 2 ? 'e-invoicing' : 'peppol', stage: 'decision', volume: i === 0 ? 320 : null, persona: '', market: 'AE-en', keyword_source: 'writer' }));
  // one plan item of a run whose LAST part runs here (what AI Plan emits for it), with the options it is given
  const plan0 = (o) => ({ site_id: SITE, domain: 'techand.ai', run_id: 'ai_20261026_techand-ai', checked_at: day(0.05), location_code: 2784, language_code: 'en', country: 'United Arab Emirates', country_iso: 'AE',
    business_name: 'Tech&', brand_names: ['Techand', 'Tech&'], competitors: ['cleartax.com'], configured_competitors: ['cleartax.com'], aliases: {}, services: ['e-invoicing'], topics: ['e-invoicing uae'], market_keyword: 'e-invoicing uae',
    full_due: false, prompts: PANEL, set_aside: [], ceiling_dfs_usd: 20, chunk: { no: 2, final_expected: true, executions: ['901', '902'], lost_note: '', unanalysed_note: '' },
    options: { claude_weekly: false, pulse_engines: '', persona_context: false, personas: 0, fanout_check: 0, demand_market: false }, persona_roles: [], ...(o || {}) });
  const ansRow = (pid, engine, fan, extra) => ({ site_id: SITE, domain: 'techand.ai', run_id: 'ai_20261026_techand-ai', prompt_id: pid, prompt: 'q ' + pid, kind: 'recommend', engine, answered: true, cited: false, our_urls: '', fanout: (fan || []).join(' | '), ...(extra || {}) });
  const serp = (kw, organic, o) => ({ status_code: 20000, tasks: [{ id: 'task-' + kw.replace(/\W+/g, '-'), status_code: (o && o.code) || 20000, status_message: (o && o.msg) || 'Ok.', cost: (o && o.code && o.code !== 20000) ? 0 : 0.002,
    data: { keyword: kw, location_code: 2784, language_code: 'en', depth: 10 },
    result: (o && o.code && o.code !== 20000) ? null : [{ keyword: kw, datetime: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' +00:00', items: organic.map((d, i) => ({ type: 'organic', rank_group: i + 1, rank_absolute: i + 1, domain: d, url: 'https://' + d + '/page-' + (i + 1), title: 'T ' + d })) }] }] });
  const llm = (text, cost) => ({ status_code: 20000, tasks: [{ id: 'llm-' + Math.random().toString(36).slice(2), status_code: 20000, status_message: 'Ok.', cost: cost == null ? 0.012 : cost, result: [{ items: [{ sections: [{ text, annotations: [] }] }] }] }] });
  const clearRun = () => { for (const n of ['AI Plan', 'AI Metrics', 'Apply Analysis', 'Parse AI Answers', 'Load AI Run Answers', 'Load SERP Cache (AI)', 'Load Query History', 'Load Pages (AI)', 'Load Cache (AI)', 'Load AI Visibility', 'AI Extra Requests',
    'Run AI Extra Requests', 'Run AI Extra Requests Answers', 'AI Vis Rows', 'Load AI Imports', 'Load AI Prompts', 'Prompt Rows', 'Discovery Requests', 'Run Discovery', 'Run Discovery Answers', 'AI Requests', 'Run AI Requests', 'Merge AI Answers', 'Load AI Daily']) delete store[n]; };
  const stage = (p, rows, more) => { clearRun(); mock('AI Plan', [{ json: p }]); mock('AI Metrics', [{ json: { site_id: SITE, domain: 'techand.ai', vis_row: { site_id: SITE, domain: 'techand.ai', run_id: p.run_id, checked_at: p.checked_at, cost_usd: 0.5 }, questions: PANEL } }]);
    mock('Apply Analysis', items(rows)); mock('Load AI Run Answers', items([])); for (const [k, v] of Object.entries(more || {})) mock(k, items(v)); };

  // ===================================================================================================================================
  await guard('W2E3-1 fan-out ranking gap', async () => {
    reset(); const SN = 'W2E3-1 (gap 4) — the searches AI ran, ranked by how often, checked on Google\'s top 10: our rank, the page that should rank, who ranks, cited or not; "ranks top 3, not cited" flagged; a reading of today is reused for nothing; a failed page is "not read"';
    begin(SN); const check = mkCheck(SN);
    const rows = [
      ansRow('w3_00', 'chatgpt', ['e-invoicing software uae', 'peppol access point uae']), ansRow('w3_01', 'gemini', ['e-invoicing software UAE', 'fta e-invoicing deadline']),
      ansRow('w3_02', 'perplexity', ['e-invoicing software uae', 'peppol access point uae'], { cited: true, our_urls: 'https://www.techand.ai/peppol' }), ansRow('w3_03', 'chatgpt', ['fta e-invoicing deadline']),
      ansRow('w3_04', 'ai_mode', ['vat return software'], { fanout_json: JSON.stringify(['vat return software', 'e-invoicing software uae']), fanout: '' }), ansRow('w3_05', 'chatgpt', [], { answered: false })];
    // the deadline search was read earlier today by another path of this site (the shared results-page cache)
    const SCk = kitOf('AI_Extra_Requests.js', 'SC');
    const cached = SCk.row(SCk.reading(serp('fta e-invoicing deadline', ['tax.gov.ae', 'techand.ai', 'cleartax.com']), { keyword: 'fta e-invoicing deadline', location_code: 2784, language_code: 'en', depth: 10 }, { now: new Date().toISOString() }), SITE);
    stage(plan0({ options: { ...plan0().options, fanout_check: 4 } }), rows, { 'Load SERP Cache (AI)': [cached],
      'Load Query History': [{ site_id: SITE, query: 'e-invoicing software uae', impressions: 840, clicks: 12, position: 4.2, checked_at: day(3), period_end: day(4) }],
      'Load Pages (AI)': [{ site_id: SITE, url: 'https://www.techand.ai/e-invoicing-software', title: 'E-invoicing software for the UAE', http_status: 200 }, { site_id: SITE, url: 'https://www.techand.ai/peppol', title: 'Peppol access point', http_status: 200 }] });
    const reqs = (await run('AI Extra Requests', [{ json: {} }])).map(i => i.json);
    const xp = (reqs[0].extras_plan || {})[SITE] || {};
    check('the run\'s fan-out searches are deduplicated across engines and case, most frequent first (W2-E1\'s fanout_json read when present)', xp.top && xp.top.distinct === 4 && xp.top.top[0].query.toLowerCase() === 'e-invoicing software uae' && xp.top.top[0].freq === 4 && xp.top.top[0].engines.join() === 'ai_mode,chatgpt,gemini,perplexity', JSON.stringify(xp.top));
    check('only the searches not read today are asked: 3 of 4 (the deadline search was read earlier today), Google top 10, the site\'s market, $0.002 each', reqs.length === 3 && reqs.every(r => r.kind === 'fanout' && /serp\/google\/organic\/live\/advanced$/.test(r.endpoint) && r.body[0].depth === 10 && r.body[0].location_code === 2784 && r.est_cost === 0.002) && !reqs.some(r => /deadline/.test(r.query)), JSON.stringify(reqs.map(r => [r.query, r.body])));
    // Google's answers: we rank #2 for the top search and no answer that ran it... cites us? one did (w3_02). The peppol search: we rank #1, the answer that ran it cited us. vat: a task error twice.
    const byQ = { 'e-invoicing software uae': serp('e-invoicing software uae', ['cleartax.com', 'www.techand.ai', 'edicom.com']), 'peppol access point uae': serp('peppol access point uae', ['www.techand.ai', 'peppol.org']), 'vat return software': serp('vat return software', [], { code: 40101, msg: 'Internal Error' }) };
    mock('Run AI Extra Requests', reqs.map(r => ({ json: byQ[r.query] })));
    const x = (await run('AI Extras', [{ json: {} }])).map(i => i.json)[0];
    const G = x.fanout_gap || {}; const q = (s) => (G.queries || []).find(z => z.query.toLowerCase() === s) || {};
    check('our rank and page from Google\'s top 10 (host-agnostic: www. counts), the domains that rank, the Search Console row of the same search', q('e-invoicing software uae').our_rank === 2 && /techand\.ai\/page-2$/.test(q('e-invoicing software uae').our_url) && q('e-invoicing software uae').top_domains[0] === 'cleartax.com' && q('e-invoicing software uae').gsc && q('e-invoicing software uae').gsc.impressions === 840, JSON.stringify(q('e-invoicing software uae')));
    check('the page that should rank comes from the page inventory', /e-invoicing-software$/.test(q('e-invoicing software uae').target_url || ''), q('e-invoicing software uae').target_url);
    check('"cited" = an answer that ran the search cited one of our pages (w3_02 cited us and ran both searches)', q('e-invoicing software uae').cited === true && q('peppol access point uae').cited === true && q('fta e-invoicing deadline').cited === false, JSON.stringify(G.queries.map(z => [z.query, z.cited])));
    check('ranks top 3 but not cited is flagged on its own: the deadline search (#2, read earlier today, no answer cited us)', q('fta e-invoicing deadline').flag === 'ranks_not_cited' && G.ranks_not_cited.includes(q('fta e-invoicing deadline').query) && /reading of today/.test(q('fta e-invoicing deadline').read), JSON.stringify(q('fta e-invoicing deadline')));
    check('a results page that failed twice is "not read", never "not in the top 10"', q('vat return software').flag === 'not_read' && q('vat return software').our_rank === null && G.not_read_n === 1 && G.checked_n === 3, JSON.stringify(q('vat return software')));
    check('money: each task once by its id (2 read x $0.002; the failed task cost nothing), on the item the ledger settle reads, and added to the stored row', x.cost_usd === 0.004 && G.cost_usd === 0.004 && x.vis_update.cost_usd === 0.504 && JSON.parse(x.vis_update.fanout_gap_json).queries.length === 4, JSON.stringify({ c: x.cost_usd, g: G.cost_usd, v: x.vis_update.cost_usd }));
    check('the pages read now are stored for every other path today (seo_cache serp:, exact columns); the failed one is not', x.cache_rows.length === 2 && x.cache_rows.every(r => Object.keys(r).sort().join() === [...TC.CACHE].sort().join() && /^serp:/.test(r.key)), JSON.stringify(x.cache_rows.map(r => r.key)));
    const ev = (await run('Extras Vis Rows', [{ json: {} }])).map(i => i.json);
    check('the row update carries only seo_ai_visibility columns', ev.length === 1 && Object.keys(ev[0]).every(k => TC.AI_VIS.includes(k)) && 'fanout_gap_json' in ev[0], JSON.stringify(Object.keys(ev[0])));
    // off (the default): nothing is asked
    stage(plan0(), rows, {});
    const off = (await run('AI Extra Requests', [{ json: {} }])).map(i => i.json);
    check('with every option off (the default) nothing is asked and nothing is paid', off.length === 1 && off[0].skip === true, JSON.stringify(off[0]).slice(0, 200));
    // the run's money ceiling holds
    stage(plan0({ ceiling_dfs_usd: 0.501, options: { ...plan0().options, fanout_check: 4 } }), rows, {});
    const ce = (await run('AI Extra Requests', [{ json: {} }])).map(i => i.json);
    check('F2\'s money ceiling: options that would pass it are not asked, and the run\'s notes say so', ce[0].skip === true && /ceiling of \$0\.50/.test(ce[0].extras_plan[SITE].ceiling_note), JSON.stringify(ce[0]).slice(0, 300));
  });

  // ===================================================================================================================================
  await guard('W2E3-2 persona effect', async () => {
    reset(); const SN = 'W2E3-2 (gap 7) — personas as context on the ChatGPT API: the same 12 questions per role and once without (one shared control), named rates tested per role, pooled over 28 days, labelled "API answers"';
    begin(SN); const check = mkCheck(SN);
    const p = plan0({ options: { ...plan0().options, persona_context: true, personas: 2 }, persona_roles: ['CFO', 'IT manager'] });
    stage(p, [], {});
    const reqs = (await run('AI Extra Requests', [{ json: {} }])).map(i => i.json);
    const ctl = reqs.filter(r => r.arm === 'without'), cfo = reqs.filter(r => r.role === 'CFO'), it = reqs.filter(r => r.role === 'IT manager');
    check('12 questions x (2 roles + 1 control) = 36 requests on the ChatGPT API with web search, the site\'s country', reqs.length === 36 && ctl.length === 12 && cfo.length === 12 && it.length === 12 && reqs.every(r => /chat_gpt\/llm_responses\/live$/.test(r.endpoint) && r.body[0].model_name === 'gpt-5.4-mini' && r.body[0].web_search === true && r.body[0].web_search_country_iso_code === 'AE'), reqs.length + ' ' + JSON.stringify(reqs[0].body));
    check('the role is sent as the asker\'s context (system_message), the control sends none; the same questions on every arm', cfo.every(r => /a CFO at a business in United Arab Emirates/.test(r.body[0].system_message)) && ctl.every(r => !('system_message' in r.body[0])) && cfo.map(r => r.prompt_id).join() === ctl.map(r => r.prompt_id).join(), JSON.stringify(cfo[0].body[0]));
    check('the sub-panel spreads over the topic clusters', new Set(ctl.map(r => PANEL.find(q => q.prompt_id === r.prompt_id).cluster)).size === 2, ctl.map(r => r.prompt_id).join());
    // answers: the control names Tech& in 1 of 12, the CFO arm in 9 of 12, the IT arm in 2 of 12
    const said = (n) => (i) => i < n ? 'For a company your size, Tech& is a good fit for e-invoicing.' : 'Look at ClearTax and EDICOM for e-invoicing in the UAE.';
    const ans = reqs.map((r) => { const i = (r.arm === 'without' ? ctl : r.role === 'CFO' ? cfo : it).indexOf(r); return llm(r.arm === 'without' ? said(1)(i) : r.role === 'CFO' ? said(9)(i) : said(2)(i)); });
    mock('Run AI Extra Requests', ans.map(a => ({ json: a })));
    mock('Load AI Visibility', [{ json: { site_id: SITE, run_id: 'ai_20261019_techand-ai', checked_at: day(7), notes_json: JSON.stringify({ persona: { roles: [{ role: 'CFO', n: 12, k: 8 }], control: { n: 12, k: 1 } } }) } }]);
    const x = (await run('AI Extras', [{ json: {} }])).map(i => i.json)[0];
    const P = x.persona || {}; const R = (role) => (P.roles || []).find(r => r.role === role) || {};
    check('labelled "API answers", ChatGPT API, 12 questions, control named in 1 of 12', P.label === 'API answers' && P.engine === 'chatgpt_api' && P.questions === 12 && P.control.n === 12 && P.control.k === 1, JSON.stringify(P.control));
    check('CFO: 9 of 12 against 1 of 12 is a real difference (two-proportion test, |z| >= 1.96)', R('CFO').k === 9 && R('CFO').n === 12 && R('CFO').z >= 1.96 && R('CFO').verdict === 'named more often with this role', JSON.stringify(R('CFO')));
    check('IT manager: 2 of 12 against 1 of 12 is printed as "no measurable difference", not hidden', R('IT manager').verdict === 'no measurable difference' && R('IT manager').delta === 8.3, JSON.stringify(R('IT manager')));
    check('pooled over the stored runs of the last 28 days (this run + last week\'s: 24 answers a side)', R('CFO').pooled.runs === 2 && R('CFO').pooled.n === 24 && R('CFO').pooled.k === 17 && R('CFO').pooled.control_n === 24, JSON.stringify(R('CFO').pooled));
    check('the persona block is kept in the run\'s notes (notes_json.persona) for next week\'s pooling, and priced: 36 x $0.012', JSON.parse(x.vis_update.notes_json).persona.roles.length === 2 && x.cost_usd === 0.432, JSON.stringify({ c: x.cost_usd }));
    // W2-A's contract addition: persona_effect_json, exactly [{role, with:{rate, n}, without:{rate, n}, delta, lo, hi, significant}] (the 28-day pooled figures)
    const PE = JSON.parse(x.vis_update.persona_effect_json || 'null') || [];
    const pe = (role) => PE.find(r => r.role === role) || {};
    check('persona_effect_json: one entry per role, exactly the contract\'s keys, rates 0-100, the 95% interval of the change; CFO real (interval above 0), IT manager not', PE.length === 2
      && PE.every(r => Object.keys(r).sort().join() === 'delta,hi,lo,role,significant,with,without' && Object.keys(r.with).sort().join() === 'n,rate' && Object.keys(r.without).sort().join() === 'n,rate')
      && pe('CFO').with.n === 24 && pe('CFO').with.rate === 70.8 && pe('CFO').without.n === 24 && pe('CFO').significant === true && pe('CFO').lo > 0 && pe('CFO').hi > pe('CFO').lo && pe('IT manager').significant === false && pe('IT manager').lo < 0, JSON.stringify(PE));
    check('the run\'s own figures carry the same interval (Newcombe) and the verdict follows it', R('CFO').lo > 0 && R('CFO').significant === true && R('IT manager').significant === false, JSON.stringify([R('CFO').lo, R('CFO').hi, R('IT manager').lo]));
    check('every column of the row update is a seo_ai_visibility column', Object.keys(x.vis_update).every(k => TC.AI_VIS.includes(k)), JSON.stringify(Object.keys(x.vis_update)));
    const W2X = AIX;
    const esc = (s) => String(s); const n = (v) => String(v);
    const html = W2X.reportHtml({ persona: P }, { h3: (t) => '<h3>' + t + '</h3>', p_: (t) => '<p>' + t + '</p>', table: (h, r) => '<table>' + h.join('|') + r.map(x => x.join('|')).join('') + '</table>', esc, n });
    check('the report\'s block says "API answers" in its heading', /API answers/.test(html) && /no measurable difference/.test(html), html.slice(0, 300));
    const none = W2X.personaRequests(p, { persona_context: true, personas: [] });
    check('no buyer roles set: nothing is asked', none.length === 0, '');
  });

  // ===================================================================================================================================
  await guard('W2E3-3 demand range + imports + bookkeeping', async () => {
    reset(); const SN = 'W2E3-3 (gaps 9 / 10, F2 / F3 leftovers) — demand as a range of named proxies with their dates (US-English said for other markets), the owner\'s uploaded AI reports (Copilot ground truth), the execution ids and the run\'s notes, all written with the row';
    begin(SN); const check = mkCheck(SN);
    const p = plan0({ prompts: PANEL.map((q, i) => i === 1 ? { ...q, market_fallback: true } : q), chunk: { ...plan0().chunk, lost_note: '4 request(s) of this run were paid for in a part that stopped', unanalysed_note: '' } });
    stage(p, [], {
      'Load AI Prompts': PANEL.map(q => ({ ...q, site_id: SITE, updated_at: '2026-10-20T08:00:00.000Z' })),
      'Load Query History': [{ site_id: SITE, query: 'which e-invoicing provider in the uae suits a company', impressions: 280, checked_at: day(2), period_end: day(3) }, { site_id: 'site_other', query: 'which e-invoicing provider in the uae suits a company', impressions: 99999, checked_at: day(2) }],
      'Load AI Imports': [
        { site_id: SITE, domain: 'techand.ai', source: 'bing_ai', day: day(5).slice(0, 10), url: 'https://www.techand.ai/peppol', query: 'peppol access point uae', impressions: 120, citations: 7, clicks: 2, file_name: 'bing-ai-performance.csv', imported_at: day(1), import_id: 'imp1' },
        { site_id: SITE, domain: 'techand.ai', source: 'bing_ai', day: day(6).slice(0, 10), url: 'https://www.techand.ai/', query: 'tech& uae', impressions: 30, citations: 3, clicks: 0, file_name: 'bing-ai-performance.csv', imported_at: day(1), import_id: 'imp1' },
        { site_id: SITE, domain: 'techand.ai', source: 'gsc_ai', day: day(4).slice(0, 10), url: 'https://www.techand.ai/e-invoicing-software', query: 'which e-invoicing provider in the uae suits a company', impressions: 56, citations: 0, clicks: 3, file_name: 'gsc-ai.csv', imported_at: day(1), import_id: 'imp2' },
        { site_id: SITE, domain: 'techand.ai', source: 'bing_ai', day: day(60).slice(0, 10), url: 'https://www.techand.ai/old', query: 'old', impressions: 5000, citations: 900, clicks: 1, file_name: 'old.csv', imported_at: day(59), import_id: 'imp0' },
        { site_id: 'site_other', domain: 'other.ae', source: 'bing_ai', day: day(5).slice(0, 10), url: 'https://other.ae/', query: 'x', impressions: 777, citations: 77, clicks: 7, file_name: 'x.csv', imported_at: day(1), import_id: 'imp9' }],
      'Discovery Requests': [{ site_id: SITE, kind: 'discover', topic: 'e-invoicing', platform: 'google' }],
      'Run Discovery': [{ status_code: 20000, tasks: [{ id: 'd1', status_code: 20000, cost: 0.14, result: [{ items: [{ question: 'Which e-invoicing provider in the UAE suits a company of 14 people?', ai_search_volume: 410, platform: 'google' }] }] }] }] });
    const vr = (await run('AI Vis Rows', [{ json: {} }])).map(i => i.json)[0];
    const D = JSON.parse(vr.demand_json || 'null') || {}; const I = JSON.parse(vr.imports_json || 'null') || {}; const N = JSON.parse(vr.notes_json || 'null') || {};
    const d0 = (D.questions || []).find(q => q.prompt_id === 'w3_00') || {}, d4 = (D.questions || []).find(q => q.prompt_id === 'w3_04') || {};
    check('every proxy names its source and date: the AI keyword volume of the question\'s search phrase (stored row\'s date)', d0.proxies && d0.proxies.some(x => x.source === 'ai_keyword_volume' && x.value === 320 && x.as_of === '2026-10-20' && /AI searches a month/.test(x.note)), JSON.stringify(d0));
    check('the AI-answer database\'s own question volume, matched by meaning, said to be Google AI Overview data and that ChatGPT data is US-English only', d4.proxies && d4.proxies.some(x => x.source === 'llm_mentions_question' && x.value === 410 && /Google AI Overview/.test(x.note) && /US-English only/.test(x.note)), JSON.stringify(d4));
    check('Search Console impressions of matching question queries (this site only), scaled to a month and called a floor; the uploaded AI Mode report too', d4.proxies.some(x => x.source === 'search_console_impressions' && x.value === 300) && d4.proxies.some(x => x.source === 'search_console_ai_upload' && x.value === 60) && /floor/.test(D.note), JSON.stringify(d4.proxies));
    check('the range spans the proxies a question has (lo 60, hi 410); a question with none has no range, never 0', d4.lo === 60 && d4.hi === 410 && !(D.questions || []).some(q => q.prompt_id === 'w3_14' && !q.proxies.length), JSON.stringify([d4.lo, d4.hi]));
    check('the market note says the ChatGPT part of the database is US-English only for this market', /US-English only/.test(D.note), D.note);
    check('the owner\'s uploads for the last 28 days, this site only: Bing AI Performance 2 rows / 10 citations, Search Console AI 1 row; older and other sites\' rows left out', I.sources && I.sources.bing_ai.rows === 2 && I.sources.bing_ai.citations === 10 && I.sources.gsc_ai.rows === 1 && I.sources.gsc_ai.clicks === 3, JSON.stringify(I.sources && I.sources.bing_ai));
    check('a Bing file is the Copilot figure\'s ground truth, named as the owner\'s export with its date', I.copilot && I.copilot.citations === 10 && /^from Bing Webmaster \(your export of \d{4}-\d{2}-\d{2}\)$/.test(I.copilot.label), JSON.stringify(I.copilot));
    check('exec_ids: the execution ids of the run\'s parts, this one last (F3 engine side #4)', vr.exec_ids === '901,902,test-exec', vr.exec_ids);
    check('notes_json: the lost note, the unanalysed note and the questions asked outside their market (F2 "For F1b")', /paid for in a part that stopped/.test(N.lost_note) && N.unanalysed_note === '' && N.market_fallback_n === 1, JSON.stringify(N));
    check('every column written is a seo_ai_visibility column', Object.keys(vr).every(k => TC.AI_VIS.includes(k)), JSON.stringify(Object.keys(vr).filter(k => !TC.AI_VIS.includes(k))));
    // the monthly market trend (ai_demand_market, the full run only): 3 LLM Mentions tasks, Google AI Overview data outside US-English
    const W2X = AIX;
    const pm = plan0({ full_due: true });
    check('the trend is not asked unless the owner turned it on, and only on the month\'s full run', W2X.demandRequests(pm, { demand_market: false }, new Date().toISOString()).length === 0 && W2X.demandRequests(plan0(), { demand_market: true }, new Date().toISOString()).length === 0, '');
    const dr = W2X.demandRequests(pm, { demand_market: true }, '2026-10-23T08:00:00.000Z');
    check('3 tasks: historical and new / lost for the domain, the top brands for the main topic; platform google for AE (chat_gpt is US-English only); new / lost by month from 6 months back', dr.length === 3 && dr.every(r => r.body[0].platform === 'google' && r.est_cost === 0.11) && dr[1].body[0].date_from === '2026-04-01' && dr[1].body[0].group_range === 'month' && dr[2].body[0].target[0].keyword === 'e-invoicing uae', JSON.stringify(dr.map(r => r.body[0])));
    check('a US-English site reads the ChatGPT answers', W2X.demandRequests({ ...pm, location_code: 2840 }, { demand_market: true }, '2026-10-23T08:00:00.000Z').every(r => r.body[0].platform === 'chat_gpt'), '');
    const mk = W2X.marketOf(pm, [
      { q: dr[0], r: { tasks: [{ status_code: 20000, cost: 0.106, result: [{ items: [{ year: 2026, month: 8, metrics: { mentions: 40, ai_search_volume: 900 } }, { year: 2026, month: 9, metrics: { mentions: 55, ai_search_volume: 1200 } }] }] }] } },
      { q: dr[1], r: { tasks: [{ status_code: 20000, cost: 0.106, result: [{ items: [{ date: '2026-09-01', new_mentions: 12, lost_mentions: 4, new_ai_search_volume: 300, lost_ai_search_volume: 90 }] }] }] } },
      { q: dr[2], r: { tasks: [{ status_code: 40501, status_message: "Invalid Field: 'limit'." }] } }], '2026-10-23T08:00:00.000Z');
    check('the trend in order, a failed task named with its reason (never an empty leaderboard read as "no brands")', mk.historical.map(r => r.month).join() === '2026-08,2026-09' && mk.new_lost[0].new_mentions === 12 && mk.top_brands.length === 0 && /top_brands: Invalid Field/.test(mk.errors[0]) && /US-English only/.test(mk.note), JSON.stringify(mk));
  });

  // ===================================================================================================================================
  await guard('W2E3-4 asked state', async () => {
    reset(); const SN = 'W2E3-4 (F3 engine side #2) — each question\'s asked state: the run that last asked it, when, how often in 28 days (weekly runs + pulse mornings), the run whose gate refused it; only changed rows, only those columns';
    begin(SN); const check = mkCheck(SN);
    const p = plan0({ set_aside: [{ prompt_id: 'w3_09', dropped: true, why: 'names a competitor' }] });
    clearRun(); mock('AI Plan', [{ json: p }]);
    mock('Apply Analysis', items([ansRow('w3_00', 'chatgpt', []), ansRow('w3_01', 'gemini', [], { answered: false, error: 'Internal Error' })]));
    mock('Load AI Run Answers', items([{ ...ansRow('w3_02', 'perplexity', []), answered: 'true' }, { ...ansRow('w3_03', 'chatgpt', []), run_id: 'ai_20261019_techand-ai' }]));
    mock('Load AI Prompts', items([
      { site_id: SITE, prompt_id: 'w3_00', prompt: 'a', last_asked_run: 'ai_20261019_techand-ai', last_asked_at: day(7), asked_n_28d: 4, refused_at_run: '' },
      { site_id: SITE, prompt_id: 'w3_01', prompt: 'b' }, { site_id: SITE, prompt_id: 'w3_02', prompt: 'c' },
      { site_id: SITE, prompt_id: 'w3_08', prompt: 'not asked, unchanged', last_asked_run: '', last_asked_at: '', asked_n_28d: 0, refused_at_run: '' },
      { site_id: SITE, prompt_id: 'w3_09', prompt: 'refused' }]));
    mock('Load AI Visibility', items([{ site_id: SITE, run_id: 'ai_20261019_techand-ai', checked_at: day(7), panel_json: JSON.stringify({ ids: ['w3_00', 'w3_09'] }) }, { site_id: SITE, run_id: 'ai_20260901_techand-ai', checked_at: day(52), panel_json: JSON.stringify({ ids: ['w3_00'] }) }]));
    mock('Load AI Daily', items([{ site_id: SITE, date: day(2).slice(0, 10), checked_at: day(2), prompts_json: JSON.stringify({ w3_00: { chatgpt: 'm' }, w3_02: { gemini: 'a' } }) }, { site_id: SITE, date: day(3).slice(0, 10), checked_at: day(3), prompts_json: JSON.stringify({ w3_00: { chatgpt: 'a' } }) }]));
    const rows = (await run('Prompt State Rows', [{ json: {} }])).map(i => i.json);
    const by = (id) => rows.find(r => r.prompt_id === id) || null;
    check('asked this run (an answer row of this run, even a failed one): last_asked_run / last_asked_at set', by('w3_00').last_asked_run === p.run_id && by('w3_00').last_asked_at === p.checked_at && by('w3_01').last_asked_run === p.run_id && by('w3_02').last_asked_run === p.run_id, JSON.stringify(rows));
    check('asked_n_28d = this run + weekly runs in 28 days whose panel held it + pulse mornings in 28 days (w3_00: 1 + 1 + 2 = 4, the 52-day-old run left out)', by('w3_00').asked_n_28d === 4 && by('w3_02').asked_n_28d === 2, JSON.stringify([by('w3_00'), by('w3_02')]));
    check('a question the fit gate set aside this run carries the run as refused_at_run; a question with no change is not written', by('w3_09') && by('w3_09').refused_at_run === p.run_id && by('w3_08') === null, JSON.stringify([by('w3_09'), by('w3_08')]));
    check('each row carries the keys and exactly the four asked-state columns (the update node touches nothing else)', rows.every(r => Object.keys(r).sort().join() === ['site_id', 'prompt_id', ...TC.AI_PROMPTS_STATE].sort().join()) && TC.AI_PROMPTS_STATE.every(c => TC.AI_PROMPTS.includes(c)), JSON.stringify(Object.keys(rows[0])));
  });

  // ===================================================================================================================================
  await guard('W2E3-5 options in the plan, requests, pulse and cost', async () => {
    reset(); const SN = 'W2E3-5 (gap 5, F3 engine side #3) — Claude weekly, the pulse\'s engines, the options priced in AIP.cost (golden cases_options) and reserved by the plan at the panel the app quotes; with every option off nothing changes';
    begin(SN); const check = mkCheck(SN);
    const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai_panel_cost_cases.json'), 'utf8'));
    const pick = (c) => ({ panel: c.panel, asked: c.asked, per_week: c.per_week, pulse_questions_day: c.pulse_questions_day, executions: c.executions, analyst_jobs: c.analyst_jobs, requests: c.requests, run: c.run, full_extra: c.full_extra, pulse_day: c.pulse_day, month: c.month, half_width: c.half_width, options: c.options });
    const bad = (G.cases_options || []).filter(cs => JSON.stringify(pick(AIP.cost(cs.input))) !== JSON.stringify(cs.expect));
    check('every option case of the golden table (' + (G.cases_options || []).length + ', copied to app/shared) through the generated AIP.cost', (G.cases_options || []).length >= 20 && !bad.length, JSON.stringify(bad.slice(0, 1)));
    check('the option prices and limits in the table are the kit\'s', JSON.stringify(G.extra_prices) === JSON.stringify(AIP.XPRICE) && JSON.stringify(G.persona) === JSON.stringify(AIP.PERSONA) && G.fanout_max === AIP.FANOUT_MAX && JSON.stringify(G.pulse_allowed) === JSON.stringify(AIP.PULSE_ALLOWED), '');
    const base = AIP.cost({ panel: 50 }), allOff = AIP.cost({ panel: 50, claude_weekly: false, pulse_engines: '', persona_context: false, personas: 3, fanout_check: 0, demand_market: false });
    check('every option off = exactly the old figures (no default changes cost)', JSON.stringify({ ...base, options: null }) === JSON.stringify({ ...allOff, options: null }), JSON.stringify([base.month, allOff.month]));
    const cw = AIP.cost({ panel: 50, claude_weekly: true });
    check('Claude weekly: Claude in every weekly run (+49 x $0.025 a week), the full run adds only the brand question on it', Math.abs(cw.run.weekly.dfs - base.run.weekly.dfs - 49 * 0.025) < 1e-9 && cw.weekly_engines.includes('claude') && cw.full_extra.dfs < base.full_extra.dfs, JSON.stringify([cw.run.weekly, base.run.weekly, cw.full_extra, base.full_extra]));
    check('the pulse engines: the owner\'s list (Perplexity and the AI Overview allowed; an engine the site has off or an unknown one is ignored); empty = the default four', AIP.pulseEnginesOf(AIP.DEFAULT_ENGINES, 'perplexity, AI Overview, claude, bogus').join() === 'perplexity,ai_overview' && AIP.pulseEnginesOf(AIP.DEFAULT_ENGINES, '').join() === 'chatgpt,gemini,ai_mode' && AIP.pulseEnginesOf(['chatgpt'], 'perplexity').join() === 'chatgpt', '');
    check('the persona test is (roles + 1) x 12 ChatGPT API answers a weekly run; the fan-out check N results pages; the trend 3 tasks on the full run', AIP.cost({ panel: 50, persona_context: true, personas: 3 }).options.persona.requests_run === 48 && AIP.cost({ panel: 50, fanout_check: 50 }).options.fanout.dfs_run === 0.1 && AIP.cost({ panel: 50, demand_market: true }).full_extra.dfs === r(base.full_extra.dfs + 0.33), '');
    function r(x) { return Math.round(x * 10000) / 10000; }
    // W2-E2's Sentiment Reader (Claude Haiku): the run's answers x 50% named (stated, conservative), 20 a call at ~$0.012, at most 40 calls a run
    const s50 = AIP.cost({ panel: 50 }), s500 = AIP.cost({ panel: 500, engines: AIP.ENGINES });
    check('the Sentiment Reader is priced on every weekly run: 50 q x 5 weekly engines = 245 answers, 123 named, 7 calls, $0.084 in the weekly Claude money; 40 calls at most', s50.sentiment.named === 123 && s50.sentiment.calls === 7 && s50.sentiment.ai === 0.084
      && Math.abs(s50.run.weekly.ai - (Math.max(AIP.FIXED.weekly_ai_min, AIP.FIXED.brief_ai + s50.analyst_jobs * AIP.FIXED.analyst_job_ai) + 0.084)) < 1e-9 && s500.sentiment.calls === 40 && s500.sentiment.ai === 0.48 && AIP.FIXED.sentiment_named_rate === 0.5, JSON.stringify([s50.sentiment, s500.sentiment]));
    check('the golden table carries the reader\'s figures (the app is held to them)', G.fixed.sentiment_calls_max === 40 && G.fixed.sentiment_call_ai === 0.012 && G.cases.find(c => c.input.panel === 50 && Object.keys(c.input).length === 1).expect.run.weekly.ai === s50.run.weekly.ai, JSON.stringify(G.fixed));
    check('the buyer roles may be given as a count or as the roles themselves (the app passes its ai_personas): the same price', JSON.stringify(AIP.cost({ panel: 50, persona_context: true, personas: 'CFO, IT manager' }).options) === JSON.stringify(AIP.cost({ panel: 50, persona_context: true, personas: 2 }).options) && AIP.cost({ panel: 50, persona_context: true, personas: ['CFO'] }).options.persona.roles === 1, '');
    // the plan: Claude weekly asked on a weekly run; on-demand reserved at the configured panel size (the app's quote), with the options
    const loadWeekly = (o) => { for (const k of Object.keys(store)) delete store[k];
      mock('Load Sites', items(W['Load Sites'])); mock('Load Ladders', items(W['Load Ladders'])); mock('Load Profiles', items(W['Load Profiles']));
      mock('Load Monitors', items([{ ...W['Load Monitors'][0], ...(o.monitors || {}) }])); mock('Load AI Prompts', items(o.prompts || W['Load AI Prompts']));
      mock('Load AI Visibility', items((W['Load AI Visibility'] || []).map((r0, i, a) => ({ ...r0, checked_at: day(2 + a.length - i), run_kind: i === a.length - 1 ? 'full' : r0.run_kind }))));
      mock('Load AI Daily', items([])); mock('Load Cache (AI)', items(W['Load Cache (AI)'] || [])); mock('Load Query History', items([])); mock('Load AI Run Answers', items([]));
      if (o.trigger) mock('Manual Run', [{ json: o.trigger }]); };
    const prompts9 = W['Load AI Prompts'].slice(0, 8);
    loadWeekly({ monitors: { ai_prompts_max: 9, ai_claude_weekly: true }, prompts: prompts9, trigger: { domain: 'techand.ai', site_id: SITE, trigger: 'cycle', cycle_key: 'c1', job: 'ai_visibility', monthly: false } });
    const pw = (await run('AI Plan', [{ json: {} }]))[0].json;
    const rqw = (await run('AI Requests', [{ json: {} }])).map(i => i.json);
    check('Claude weekly: a weekly (not full) run asks Claude for every question; without the option it does not', !pw.full_due && pw.monthly_engines.length === 0 && rqw.filter(r => r.engine === 'claude').length === prompts9.filter(q => q.kind !== 'brand').length && rqw.filter(r => r.engine === 'claude').length > 0, JSON.stringify({ full: pw.full_due, monthly: pw.monthly_engines, claude: rqw.filter(r => r.engine === 'claude').length }));
    loadWeekly({ monitors: { ai_prompts_max: 9 }, prompts: prompts9, trigger: { domain: 'techand.ai', site_id: SITE, trigger: 'cycle', cycle_key: 'c1', job: 'ai_visibility', monthly: false } });
    const pw0 = (await run('AI Plan', [{ json: {} }]))[0].json; const rq0 = (await run('AI Requests', [{ json: {} }])).map(i => i.json);
    check('(the default is unchanged: Claude only on the month\'s full run)', pw0.monthly_engines.join() === 'claude' && rq0.filter(r => r.engine === 'claude').length === 0, JSON.stringify(pw0.monthly_engines));
    // F3 engine side #3: the stored panel is one question short of the size (8 stored, size 9: the writer does not top up one question), so the old
    // plan priced 8 questions while the app quoted 9. The first part now reserves the panel the site is set to, options included.
    loadWeekly({ monitors: { ai_prompts_max: 9, ai_fanout_check: 25, ai_persona_context: true, ai_personas: 'CFO, IT manager' }, prompts: prompts9, trigger: { ...W['Manual Run'][0], topics: [] } });
    const pd = (await run('AI Plan', [{ json: {} }]))[0].json;
    const quote = AIP.cost({ panel: 9, engines: AIP.DEFAULT_ENGINES, fanout_check: 25, persona_context: true, personas: 2 }).run.full;
    check('on demand: the reservation is the full run of the panel the site is set to (9, the app\'s aiOnDemandRunUsd), the options priced in', pd.on_demand && pd.need_prompts === false && pd.run_cost_est.dfs === quote.dfs && pd.est_dfs_usd === quote.dfs && pd.cost_model.options.fanout.queries === 25 && pd.cost_model.options.persona.roles === 2, JSON.stringify({ est: pd.est_dfs_usd, quote: quote.dfs, need: pd.prompts_needed }));
    check('the part keeps time for the options (extra_s), so the last part still fits its 40 minutes; none kept with every option off', pd.chunk.extra_s > 0 && /kept for the fan-out check/.test(pd.chunk.size_basis) && pw0.chunk.extra_s === 0, JSON.stringify({ x: pd.chunk.extra_s, basis: pd.chunk.size_basis }));
    // the pulse: the owner adds Perplexity and the AI Overview; a derived search phrase is never asked of the AI Overview
    for (const k of Object.keys(store)) delete store[k];
    const PF = FX.pulse || {};
    for (const [k, v] of Object.entries(PF)) if (/^Load /.test(k)) mock(k, items(v));
    mock('Load Monitors', items([{ ...((PF['Load Monitors'] || W['Load Monitors'])[0]), ai_pulse_engines: 'chatgpt, perplexity, ai_overview' }]));
    mock('Load AI Prompts', items(W['Load AI Prompts'].map((q, i) => ({ ...q, keyword_source: i === 0 ? 'derived' : 'writer' }))));
    mock('Load Cycles', items([])); mock('Manual Run', [{ json: { domain: 'techand.ai', site_id: SITE } }]);
    const pp = (await run('AI Plan', [{ json: {} }], { code: 'Pulse__AI_Plan' }))[0].json;
    check('the pulse asks the owner\'s engines (ChatGPT, Perplexity, the AI Overview) and prices that morning with them', (pp.pulse_engines || []).join() === 'chatgpt,perplexity,ai_overview' && pp.cost_model.pulse_day.dfs > 0, JSON.stringify({ e: pp.pulse_engines, reason: pp.reason }));
    const rqp = (await run('AI Requests', [{ json: {} }], { code: 'Pulse__AI_Requests' })).map(i => i.json);
    check('the pulse\'s AI Overview is asked for real search phrases only (F2 E9: the derived one is not)', rqp.some(r => r.engine === 'perplexity') && rqp.some(r => r.engine === 'ai_overview') && !rqp.some(r => r.engine === 'ai_overview' && r.prompt_id === W['Load AI Prompts'][0].prompt_id), JSON.stringify(rqp.filter(r => r.engine === 'ai_overview').map(r => r.prompt_id)));
    // the owner's settings: Site Admin keeps what it is not given and holds each to its range
    const MC = TC.MONITORS;
    await run('Admin Action', { body: { action: 'monitors', domain: 'techand.ai', ai_claude_weekly: true, ai_pulse_engines: 'Perplexity, ai-overview, claude', ai_fanout_check: 900 } });
    mock('Load Monitors (Admin)', [{ json: { site_id: SITE, domain: 'techand.ai', ai_persona_context: true, ai_demand_market: false } }]);
    const am = (await run('Monitor Row (Admin)', store['Load Monitors (Admin)']))[0].json;
    check('Site Admin monitors: exact columns; Claude weekly on, the pulse engines kept to the allowed list, the fan-out check held to 200, the stored persona flag kept', Object.keys(am).length === MC.length && MC.every(c => c in am) && am.ai_claude_weekly === true && am.ai_pulse_engines === 'perplexity, ai_overview' && am.ai_fanout_check === 200 && am.ai_persona_context === true && am.ai_demand_market === false, JSON.stringify(am));
  });

  // ===================================================================================================================================
  await guard('W2E3-6 the generated wiring', async () => {
    reset(); const SN = 'W2E3-6 — the generated workflows: the options run after the week is stored, their call is gated and in the ledger, the asked state and the row are UPDATED (never inserted), the imports and today\'s results pages are read per site, and the pulse / AI Growth / Backlink Monitor / Link Builder read seo_ai_visibility per site and window';
    begin(SN); const check = mkCheck(SN);
    const WR = JSON.parse(fs.readFileSync(path.join(__dirname, 'w2e3_wiring.json'), 'utf8'));
    const T = WR['SEO_Agent_AI_Visibility.json']; const C = T.connections;
    const reach = (from, to, stop) => { const seen = new Set([from]); const q = [from]; while (q.length) { const n = q.shift(); if (n === to) return true; for (const l of ((C[n] || {}).main || [])) for (const t of (l || [])) if (!seen.has(t.node) && t.node !== stop) { seen.add(t.node); q.push(t.node); } } return false; };
    check('the options\' call is reached only after the row and the run\'s done state are saved (Save AI Visibility, Save AI Cache)', reach('Save AI Visibility', 'Run AI Extra Requests') && reach('Save AI Cache', 'Run AI Extra Requests') && !reach('Run AI Extra Requests', 'Save AI Visibility') && !reach('AI Metrics', 'Run AI Extra Requests', 'Prune Old Answers'), '');
    check('the call is behind the in-200 gate and its money is in the run\'s ledger settle', !!C['Run AI Extra Requests Retry Plan'] && reach('Run AI Extra Requests', 'Run AI Extra Requests Answers') && /AI Extras/.test(T.settle_measured), T.settle_measured);
    check('the asked state and the row are UPDATES (no insert of a partial row), each mapping only the columns it carries', T.dt['Save Prompt State'].operation === 'update' && T.dt['Save Prompt State'].mapping === 'autoMapInputData' && T.dt['Save Prompt State'].table === 'seo_ai_prompts'
      && T.dt['Update AI Visibility (Extras)'].operation === 'update' && T.dt['Update AI Visibility (Extras)'].table === 'seo_ai_visibility' && JSON.stringify(T.dt['Update AI Visibility (Extras)'].filters).includes('run_id'), JSON.stringify([T.dt['Save Prompt State'], T.dt['Update AI Visibility (Extras)']]));
    const cond = (d) => ((d && d.filters && d.filters.conditions) || []).map(c => c.keyName + ' ' + c.condition).join(', ');
    check('the uploads and today\'s results pages are read for the started site only', /site_id like/.test(cond(T.dt['Load AI Imports'])) && /day gte/.test(cond(T.dt['Load AI Imports'])) && /kind eq, site_id like, updated_at gte/.test(cond(T.dt['Load SERP Cache (AI)'])), cond(T.dt['Load AI Imports']) + ' | ' + cond(T.dt['Load SERP Cache (AI)']));
    for (const [f, n] of [['SEO_Agent_AI_Pulse.json', 'Load AI Visibility'], ['SEO_Agent_AI_Growth.json', 'Load AI Visibility'], ['SEO_Agent_Backlink_Monitor.json', 'Load AI Visibility (BL)'], ['SEO_Agent_Link_Builder.json', 'Load AI Visibility (LB)']]) {
      const d = (WR[f] || { dt: {} }).dt[n];
      check(f.replace(/^SEO_Agent_|\.json$/g, '') + ': ' + n + ' reads one site and a window (F2 "Not fixed")', d && cond(d) === 'site_id like, checked_at gte', cond(d)); }
    // the pulse's scope: its cron has no Manual Run, so the expression must read '%' then, and the site when a start names one
    const pexpr = (((WR['SEO_Agent_AI_Pulse.json'].dt['Load AI Visibility'] || {}).filters || {}).conditions || [])[0].keyValue;
    const evalScope = (mr) => { const $ = (nm) => ({ isExecuted: !!mr, first: () => ({ json: mr || {} }) }); return new Function('$', 'return ' + pexpr.replace(/^=\{\{\s*/, '').replace(/\s*\}\}$/, ''))($); };
    check('the pulse\'s scope: the cron reads every site (\'%\'), an on-demand start its site', evalScope(null) === '%' && evalScope({ domain: 'https://www.TechAnd.ai/' }) === 'site_techand-ai', JSON.stringify([evalScope(null), evalScope({ domain: 'https://www.TechAnd.ai/' })]));
  });
};
