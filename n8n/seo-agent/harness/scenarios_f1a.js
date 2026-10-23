// F1a (2026-10-23, docs/ai-visibility-2026-10-23/fixes/F1a.md): WHO an AI answer names - one entity per business, its role, the client's
// position (v5/code/_ai_entities.js, inlined into Parse AI Answers weekly + pulse, Apply Analysis, Analyst Jobs, AI Cache Rows, Prompt Rows,
// AI Plan, Pulse Plan). ENGINE_AUDIT E3 E4 E5 E8 E10 E16 and the PROD_STATE.md section 5 spot-check.
//   AIENT   the labelled set accuracy/ai_entities.json (6 real answers, 32 tuning cases, 22 hold-out cases), ratcheted on its known misses
//   F1A-E*  one scenario per finding: the labelled cases that fail on the code before F1a, and node-level checks of the paths around them
const fs = require('fs');
const path = require('path');
// the measured bar (2026-10-23 on this code: all 60 cases precision 100 / recall 98.7, self 100 / 100, position 98.3; hold-out alone 100 /
// 95.8 / 100 / 100 / 95.5). Below it the build fails. KNOWN_MISSES is the ratchet: a new miss fails, and so does a known miss the code now gets
// right (remove it here, so the fix can never quietly come back undone).
const BAR = { precision: 95, recall: 95, self_named: 100, self_cited: 100, position: 95, roles: 95 };
const KNOWN_MISSES = ['H03'];   // "Payroll software options: Deel, Bayzat (bayzat.com), and Gulf Payroll Services." - a business named inline, with no website, no list item and no engine brand list, is not found (hold-out; not tuned on)
// the cases each finding is about (all tuning or real cases: the hold-out is measured, not asserted case by case)
const FINDINGS = {
  'E3 a cited source is not a competitor': ['T08', 'T09', 'T10', 'R5', 'R3'],
  'E4 short configured names are found, and only as words': ['T01', 'T02', 'T25'],
  'E5 a common-word domain label is not the brand': ['T06', 'T07'],
  'E8 a word inside a cited domain and a framework are not businesses': ['T03', 'T04', 'T05'],
  'one business counted once (subdomains, country variants, spellings, "formerly")': ['R1', 'R2', 'R4', 'T17', 'T18', 'T19', 'T32'],
  'platforms named as integration targets, or the client\'s own, are not rivals': ['R6', 'T11', 'T12', 'T13', 'T30'],
  'directories, government bodies and free zones are sources': ['T14', 'T15', 'T16'],
  'the brand written with a space, and its near misses': ['T20', 'T21', 'T22'],
  'Arabic names (with the attached prefix)': ['T23', 'T24']
};
// the kit as the build inlined it into the generated node (so these checks test the deployed code, not a copy)
const kitFrom = (file) => { const src = fs.readFileSync(file, 'utf8'); const a = src.indexOf('const AIE = (() => {'); const b = src.indexOf('\n})();', a);
  if (a < 0 || b < 0) throw new Error('the entity kit is not inlined in ' + path.basename(file)); return new Function(src.slice(a, b + 6) + '\nreturn AIE;')(); };

module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset } = ctx;
  const CODE = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mk = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 600))); };
  const { scoreEntities, SET } = require('./accuracy/score_ai_entities');

  await guard('AIENT', async () => {
    reset(); const check = mk('AIENT');
    console.log('\n=== AIENT who an AI answer names: the labelled set (6 real answers, 32 tuning, 22 hold-out), weekly and pulse parser, ratcheted ===');
    const ids = SET.cases.map(c => c.id);
    check('AIENT set: unique ids, every case labelled with named / cited / position / competitors and a reason', new Set(ids).size === ids.length && SET.cases.every(c => c.expect && typeof c.expect.named === 'boolean' && typeof c.expect.cited === 'boolean' && Array.isArray(c.expect.competitors) && 'position' in c.expect && String(c.why || '').trim()));
    check('AIENT set: the 6 real answers of PROD_STATE.md, at least 40 crafted cases, at least 20 of them a hold-out', SET.cases.filter(c => c.fixture).length === 6 && SET.cases.filter(c => !c.fixture).length >= 40 && SET.cases.filter(c => c.split === 'holdout').length >= 20, SET.cases.length);
    for (const [label, code] of [['weekly', 'Parse_AI_Answers'], ['pulse', 'Pulse__Parse_AI_Answers']]) {
      const r = await scoreEntities(H, null, { code, run_kind: label === 'pulse' ? 'pulse' : 'weekly' });
      console.log('   ' + label + ' tune ' + JSON.stringify(r.tune) + '\n   ' + label + ' holdout ' + JSON.stringify(r.holdout) + '\n   ' + label + ' all ' + JSON.stringify(r.all));
      for (const [k, v] of Object.entries(BAR)) check('AIENT ' + label + ': ' + k + ' ' + r.all[k] + '% >= ' + v + '% (all 60 cases)', r.all[k] >= v, JSON.stringify(r.all));
      const misses = r.rows.filter(x => x.fp || x.fn || !x.named || !x.cited || !x.position || x.roleErr.length);
      const fresh = misses.filter(x => !KNOWN_MISSES.includes(x.id)); const fixed = KNOWN_MISSES.filter(id => !misses.some(x => x.id === id));
      check('AIENT ' + label + ': no NEW miss (not in KNOWN_MISSES)', !fresh.length, fresh.map(x => x.id + ' ' + JSON.stringify({ fp: x.fps, fn: x.fns, got: x.got, roles: x.roleErr })).join(' | '));
      check('AIENT ' + label + ': no known miss the code now gets right (remove it from KNOWN_MISSES)', !fixed.length, fixed.join(', '));
    }
    reset();
  });

  await guard('F1A-FINDINGS', async () => {
    reset(); const check = mk('F1A-FINDINGS');
    console.log('\n=== F1A each finding on its labelled cases (they fail on the parser before F1a) ===');
    const r = await scoreEntities(H, null, {});
    for (const [label, cases] of Object.entries(FINDINGS)) {
      const bad = cases.map(id => r.rows.find(x => x.id === id)).filter(x => !x || x.fp || x.fn || !x.named || !x.cited || !x.position || x.roleErr.length);
      check(label + ' (' + cases.join(', ') + ')', !bad.length, bad.map(x => x ? x.id + ' ' + JSON.stringify({ fp: x.fps, fn: x.fns, got: x.got, roles: x.roleErr }) : 'missing case').join(' | '));
    }
    reset();
  });

  await guard('F1A-CONTRACT', async () => {
    reset(); const check = mk('F1A-CONTRACT');
    console.log('\n=== F1A the answer-row contract (named, cited, position, entities; mentioned = named or cited; rank = position) ===');
    const plan = { site_id: 'site_techand-ai', domain: 'techand.ai', business_name: 'Tech&', brand_names: ['techand.ai', 'Tech&', 'techand'], competitors: ['cleartax.com'], configured_competitors: ['cleartax.com'], aliases: { 'Thomson Reuters': 'thomsonreuters.com', Pagero: 'pagero.com' }, services: ['Dynamics 365 Finance'], topics: [], run_id: 'c1' };
    mock('AI Plan', [{ json: plan }]); mock('Load Cache (AI)', [{ json: {} }]);
    const req = (e, i) => ({ json: { site_id: plan.site_id, domain: plan.domain, run_id: 'c1', engine: e, prompt_id: 'p' + i, prompt: 'q', kind: 'recommend', topic: '', run_kind: 'weekly' } });
    const llm = (text, cites) => ({ json: { tasks: [{ status_code: 20000, cost: 0.006, result: [{ items: [{ sections: [{ text, annotations: cites || [] }] }] }] }] } });
    mock('AI Requests', [req('perplexity', 0), req('claude', 1), req('perplexity', 2)]);
    const rows = (await run('Parse AI Answers', [llm('1. **Thomson Reuters (formerly Pagero)** - https://europe.thomsonreuters.com\n2. **Tech&** - https://techand.ai'),
      llm('E-invoicing starts in 2026.', [{ url: 'https://techand.ai/blog/x', title: 'UAE e-invoicing timeline' }]), { json: { tasks: [{ status_code: 40501, status_message: 'Invalid Field' }] } }])).map(x => x.json);
    const [a, b, c] = rows;
    check('named + position: the client second after ONE Thomson Reuters (PROD_STATE SYN stored rank 4)', a.named === true && a.position === 2 && a.rank === 2 && a.mentioned === true && a.competitors === 'thomsonreuters.com', JSON.stringify({ named: a.named, position: a.position, rank: a.rank, competitors: a.competitors }));
    check('entities: in memory (array) and stored (entities_json), each { id, name, role, position, cited }', Array.isArray(a.entities) && a.entities.length === 2 && JSON.parse(a.entities_json).length === 2 && a.entities.every(e => ['id', 'name', 'role', 'position', 'cited'].every(k => k in e)) && a.entities.some(e => e.role === 'self' && e.position === 2), a.entities_json);
    check('cited only: named false, cited true, mentioned true (= named or cited), position null, rank 0', b.named === false && b.cited === true && b.mentioned === true && b.position === null && b.rank === 0, JSON.stringify({ named: b.named, cited: b.cited, mentioned: b.mentioned, position: b.position }));
    check('a failed request: nothing named, no entities', c.answered === false && c.named === false && c.position === null && c.entities_json === '' && c.error, JSON.stringify(c));
    // the Apply Analysis output is exactly the table's columns, with the contract fields
    mock('Analyst Jobs', [{ json: { skip: true } }]); mock('Answer Analyst', []);
    const ap = (await run('Apply Analysis', [{ json: {} }])).map(x => x.json);
    const COLS = JSON.parse(fs.readFileSync(path.join(__dirname, 'table_cols.json'), 'utf8')).AI_ANSWERS || null;
    check('Apply Analysis: exact seo_ai_answers columns incl. named / position / entities_json, no in-memory entities or text', ap.every(r => !('entities' in r) && !('_text' in r) && ['named', 'position', 'entities_json'].every(k => k in r)) && (!COLS || ap.every(r => Object.keys(r).length === COLS.length && COLS.every(k => k in r))), JSON.stringify(Object.keys(ap[0])));
    reset();
  });

  await guard('F1A-E5', async () => {
    reset(); const check = mk('F1A-E5');
    console.log('\n=== F1A E5 brand names: a common-word domain label is not the client (AI Plan, Pulse Plan, the parser) ===');
    for (const f of ['AI_Plan.js', 'Pulse__AI_Plan.js']) { const src = fs.readFileSync(path.join(CODE, f), 'utf8');
      check(f + ': brand names come from the kit (no bare 5-letter label rule left)', /AIE\.brandNames\(/.test(src) && !/label\.length >= 5 \? \[label\]/.test(src), f); }
    const K = kitFrom(path.join(CODE, 'AI_Plan.js'));
    const pay = K.brandNames({ domain: 'payroll.ae', business_name: 'Gulf Payroll Services' }), tech = K.brandNames({ domain: 'techand.ai', business_name: 'Tech&' });
    check('payroll.ae: "payroll" is not a brand name; the business name and the domain are', !pay.map(x => x.toLowerCase()).includes('payroll') && pay.includes('Gulf Payroll Services') && pay.includes('payroll.ae'), JSON.stringify(pay));
    check('techand.ai: "techand" still is (distinctive), with Tech&', tech.includes('techand') && tech.includes('Tech&'), JSON.stringify(tech));
    check('the pulse plan carries the business name and the services (it had neither: the pulse never knew "Tech&" nor the client\'s platforms)', /business_name: s\.business_name/.test(fs.readFileSync(path.join(CODE, 'Pulse__AI_Plan.js'), 'utf8')) && /services: AIE\.servicesOf\(s\)/.test(fs.readFileSync(path.join(CODE, 'Pulse__AI_Plan.js'), 'utf8')));
    // a plan stored before the rule (brand_names still has "payroll") is corrected in the parser too
    mock('AI Plan', [{ json: { site_id: 'site_payroll-ae', domain: 'payroll.ae', business_name: 'Gulf Payroll Services', brand_names: ['payroll.ae', 'Gulf Payroll Services', 'payroll'], competitors: [], configured_competitors: [], aliases: {}, run_id: 'e5' } }]);
    mock('AI Requests', [{ json: { site_id: 'site_payroll-ae', domain: 'payroll.ae', run_id: 'e5', engine: 'chatgpt', prompt_id: 'p', prompt: 'q', kind: 'recommend', run_kind: 'pulse' } }]); mock('Load Cache (AI)', [{ json: {} }]);
    const r = (await run('Parse AI Answers', [{ json: { tasks: [{ status_code: 20000, result: [{ markdown: 'For payroll in Dubai, most SMEs use Zoho Payroll, Bayzat or Deel.', sources: [], brand_entities: [{ title: 'Bayzat' }, { title: 'Deel' }] }] }] } }], { code: 'Pulse__Parse_AI_Answers' }))[0].json;
    check('pulse parser, old plan: "For payroll in Dubai…" does not name payroll.ae (audit proof: mentioned, rank 1)', r.named === false && r.mentioned === false && r.rank === 0 && /bayzat/i.test(r.competitors) && /Deel/.test(r.competitors) && /zoho\.com/.test(r.competitors), JSON.stringify({ named: r.named, rank: r.rank, competitors: r.competitors }));
    reset();
  });

  await guard('F1A-E3-METRICS', async () => {
    reset(); const check = mk('F1A-E3-METRICS');
    console.log('\n=== F1A E3 through AI Metrics: a review site cited twice is a PR target, not a rival; share of voice is the truth ===');
    const SID = 'site_acmeerp-ae', DOM = 'acmeerp.ae', NOW = new Date().toISOString();
    const plan = { site_id: SID, domain: DOM, canonical_host: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', country_iso: 'AE', email: '', callback_url: '', request_id: '', on_demand: false, adhoc: false,
      business_name: 'Acme ERP', business_type: '', city: 'Dubai', profile: {}, services: ['Odoo implementation'], business_facts: '', accreditation: '', brand_names: [DOM, 'Acme ERP'], competitors: [], configured_competitors: [], aliases: {},
      topics: ['odoo partner uae'], engines: ['perplexity'], prompts_max: 20, pulse: false, prompts: [0, 1, 2].map(q => ({ prompt_id: 'q' + q, prompt: 'Which Odoo partner in Dubai? ' + q, kind: 'recommend', topic: 'odoo', keyword: 'odoo partner dubai', source: 'auto', stage: 'decision', cluster: 'odoo', volume: 100 })),
      full_due: false, run_kind: 'weekly', monthly_engines: [], carried: null, need_prompts: false, prompts_needed: 0, need_site_text: false, gsc_questions: [], discovery_due: false, volume_keywords: [], index_due: false, market_due: false, market_keyword: '',
      ga4_property_id: '', pulse_rows: [], key_paths: [], set_aside: [], set_aside_note: '', previous: null, run_id: 'ai_e3', checked_at: NOW };
    mock('AI Plan', [{ json: plan }]); mock('Load Cache (AI)', [{ json: {} }]);
    mock('AI Requests', [0, 1, 2].map(q => ({ json: { site_id: SID, domain: DOM, run_id: 'ai_e3', engine: 'perplexity', prompt_id: 'q' + q, prompt: plan.prompts[q].prompt, kind: 'recommend', topic: 'odoo', run_kind: 'weekly' } })));
    const ans = (text, cites) => ({ json: { tasks: [{ status_code: 20000, cost: 0.006, result: [{ items: [{ sections: [{ text, annotations: cites }] }] }] }] } });
    const hub = (p) => ({ url: 'https://erpreviewhub.com/uae/' + p, title: 'ERP buyer\'s guide UAE ' + p });
    const parsed = await run('Parse AI Answers', [ans('Odoo projects in Dubai need a local partner.', [hub('a')]), ans('Costs vary by module count.', [hub('b')]), ans('Acme ERP is one Odoo partner in Dubai.', [])]);
    check('parser: erpreviewhub.com is a source in every answer, never a competitor', parsed.every(x => !/erpreviewhub/.test(x.json.competitors)) && parsed.slice(0, 2).every(x => JSON.parse(x.json.entities_json).some(e => e.id === 'erpreviewhub.com' && e.role === 'source')), JSON.stringify(parsed.map(x => x.json.competitors)));
    mock('Apply Analysis', parsed.map(x => { const { entities, _text, ...rest } = x.json; return { json: rest }; })); mock('Run AI Requests', [{ json: {} }]);
    const X = (await run('AI Metrics', store['Apply Analysis']))[0].json;
    console.log('   competitors ->', JSON.stringify(X.competitors), '| sources ->', JSON.stringify((X.sources || []).map(s => s.domain + ':' + s.kind)), '| rivals ->', JSON.stringify(X.rival_sources), '| sov ->', X.metrics.share_of_voice);
    check('AI Metrics: not in "who AI recommends instead", not a rival source; a source (PR target); share of voice 100 (audit proof: 33.3)', !(X.competitors || []).some(c => /erpreviewhub/.test(c.domain)) && !(X.rival_sources || []).some(r => /erpreviewhub/.test(r.domain)) && (X.sources || []).some(s => s.domain === 'erpreviewhub.com') && X.metrics.share_of_voice === 100,
      JSON.stringify({ comp: X.competitors, rivals: X.rival_sources, sov: X.metrics.share_of_voice }));
    reset();
  });

  await guard('F1A-E10', async () => {
    reset(); const check = mk('F1A-E10');
    console.log('\n=== F1A E10 the panel gate: a writer question naming another vendor is refused with the vendor named ===');
    const plan = { site_id: 'site_acmeerp-ae', domain: 'acmeerp.ae', business_name: 'Acme ERP', brand_names: ['acmeerp.ae', 'Acme ERP'], competitors: ['sap.com'], configured_competitors: ['sap.com'], aliases: { 'Bayzat': 'bayzat.com' }, services: ['Odoo implementation'], topics: ['erp software uae'],
      prompts: [], need_prompts: true, prompts_needed: 8, own_market: 'AE-en', country: 'United Arab Emirates', city: 'Dubai', fit_input: { own_domain: 'acmeerp.ae', competitors: ['sap.com'], brands: { 'Bayzat': 'bayzat.com' }, heads: ['erp software uae'], services: ['Odoo implementation'], keywords: [] } };
    mock('AI Plan', [{ json: plan }]); mock('Load Cache (AI)', [{ json: {} }]); mock('Discovery Requests', [{ json: { skip: true } }]); mock('Run Discovery', []);
    mock('Prompt Jobs', [{ json: { site_id: plan.site_id, market: 'AE-en', persona: 'owner', market_questions: ['best erp for uae distributors (900/mo; AI names Acumatica, Daftra)'] } }]);
    const Q = [['Zoho Books vs QuickBooks for VAT filing in the UAE: which is better?', 'compare', 'zoho books vs quickbooks'], ['Is SAP Business One worth it for a 50-person company in Dubai?', 'choose', 'sap business one dubai'],
      ['Is Odoo or Microsoft Dynamics 365 Business Central the better ERP for a UAE distributor?', 'compare', 'odoo vs business central'], ['Should a Dubai trading company pick Daftra for e-invoicing?', 'choose', 'daftra e invoicing'],
      ['Which ERP implementation partners in Dubai handle UAE e-invoicing for distributors?', 'recommend', 'erp implementation partner dubai'], ['How much does an Odoo implementation cost for a UAE distributor?', 'cost', 'odoo implementation cost uae']];
    mock('Prompt Writer', [{ json: { output: { prompts: Q.map(([prompt, kind, keyword]) => ({ prompt, kind, keyword, cluster: 'erp', stage: 'consideration', origin: 'writer' })) } } }]);
    const rows = (await run('Prompt Rows', [{ json: {} }])).map(x => x.json);
    const st = (q) => (rows.find(r => r.prompt === q) || {});
    console.log('   ' + rows.map(r => r.status + ': ' + r.prompt.slice(0, 60) + (r.fit_note ? ' | ' + r.fit_note.slice(r.fit_note.indexOf('was not added'), r.fit_note.indexOf('was not added') + 90) : '')).join('\n   '));
    check('the three audit questions are refused, each naming the vendor (proof: all three stored active, sap.com configured)', [Q[0][0], Q[1][0], Q[2][0]].every(q => st(q).status === 'refused' && /names (Zoho|QuickBooks|SAP|Odoo|Microsoft)/.test(st(q).fit_note || '')), JSON.stringify(rows.map(r => [r.status, r.fit_note])));
    check('a vendor the AI-answer database names for the topic (Daftra) is refused too', st(Q[3][0]).status === 'refused' && /Daftra/.test(st(Q[3][0]).fit_note), JSON.stringify(st(Q[3][0])));
    check('the client\'s own platform (Odoo, its service) and a vendor-free question are kept', st(Q[4][0]).status === 'active' && st(Q[5][0]).status === 'active', JSON.stringify([st(Q[4][0]), st(Q[5][0])]));
    reset();
  });

  await guard('F1A-E16', async () => {
    reset(); const check = mk('F1A-E16');
    console.log('\n=== F1A E16 a wrong claim reworded is the same issue: no second High alert ===');
    const K = kitFrom(path.join(CODE, 'Apply_Analysis.js'));
    check('same fact, other words: one claim', K.sameClaim('Northwind ERP is based in Abu Dhabi → Dubai', 'an Abu Dhabi company → Dubai') && K.sameClaim('Headquartered in Abu Dhabi → City: Dubai', 'Abu Dhabi-based firm → Dubai'));
    check('another fact, or another claim, is a new issue', !K.sameClaim('Northwind ERP is based in Abu Dhabi → Dubai', 'Northwind ERP sells payroll software → Odoo implementation') && !K.sameClaim('based in Abu Dhabi → Dubai', 'based in Sharjah → Dubai'));
    const prevText = 'Northwind ERP is based in Abu Dhabi → Dubai';
    const plan = { site_id: 's1', domain: 'northwind-erp.com', brand_names: ['northwind-erp.com', 'Northwind ERP'], competitors: [], configured_competitors: [], aliases: {}, previous: { perception: { issues: [{ text: prevText, new: true }] } } };
    mock('AI Plan', [{ json: plan }]);
    const pr = (id) => ({ json: { site_id: 's1', domain: 'northwind-erp.com', run_id: 'r2', prompt_id: id, engine: 'chatgpt', kind: 'recommend', answered: true, mentioned: true, named: true, cited: false, rank: 1, position: 1, entities_json: '[{"id":"northwind-erp.com","name":"Northwind ERP","role":"self","position":1,"cited":false}]', _text: 'Northwind ERP is an Abu Dhabi company.' } });
    mock('Parse AI Answers', [pr('a'), pr('b')]);
    mock('Analyst Jobs', [{ json: { site_id: 's1', ids: ['a|chatgpt', 'b|chatgpt'], facts_ok: true } }]);
    mock('Answer Analyst', [{ json: { output: { answers: [{ n: 1, brands: [{ name: 'Northwind ERP', domain: 'northwind-erp.com', role: 'competitor' }], sentiment: 'neutral', wrong: [{ claim: 'Northwind ERP is an Abu Dhabi company', correct: 'Dubai' }] },
      { n: 2, brands: [{ name: 'Northwind ERP', domain: '' }], sentiment: 'neutral', wrong: [{ claim: 'Northwind ERP is headquartered in Abu Dhabi', correct: 'Dubai' }] }] } } }]);
    const out = (await run('Apply Analysis', store['Answer Analyst'])).map(x => x.json);
    check('both rewordings are stored in last week\'s wording, so AI Metrics keys them as the issue it already reported (no "new", no High alert)', out.every(r => r.issues === prevText), JSON.stringify(out.map(r => r.issues)));
    reset();
  });

  await guard('F1A-LEARN', async () => {
    reset(); const check = mk('F1A-LEARN');
    console.log('\n=== F1A learned names point to one entity; platforms and sources leave the rival list ===');
    const plan = { site_id: 's1', domain: 'techand.ai', business_name: 'Tech&', brand_names: ['techand.ai', 'Tech&'], competitors: ['cleartax.com'], configured_competitors: ['cleartax.com'], services: ['Dynamics 365 Finance'], topics: [], aliases: {} };
    mock('AI Plan', [{ json: plan }]); mock('Load Cache (AI)', [{ json: {} }]);
    mock('AI Metrics', [{ json: { cache_rows: [{ key: 'ai_brands:s1', kind: 'ai', site_id: 's1', value: JSON.stringify({ EDICOM: 'edicomgroup.com', Edicom: 'edicom.com', Pagero: 'pagero.com', 'Thomson Reuters': 'europe.thomsonreuters.com', 'Microsoft Dynamics 365': 'microsoft.com', 'UAE ASP List': 'uaeasp.ae' }), updated_at: 'x' }] } }]);
    mock('Apply Analysis', [{ json: { site_id: 's1', entities_json: JSON.stringify([{ id: 'thomsonreuters.com', name: 'Thomson Reuters', role: 'competitor', position: 1, cited: false }, { id: 'microsoft.com', name: 'Microsoft Dynamics 365', role: 'platform', position: null, cited: false }, { id: 'uaeasp.ae', name: 'uaeasp.ae', role: 'source', position: null, cited: true }]) } }]);
    const rows = (await run('AI Cache Rows', [{ json: {} }])).map(x => x.json);
    const brands = JSON.parse((rows.find(r => r.key === 'ai_brands:s1') || {}).value || '{}'); const book = JSON.parse((rows.find(r => r.key === 'ai_entities:s1') || {}).value || '{}');
    console.log('   ai_brands ->', JSON.stringify(brands), '\n   ai_entities ->', JSON.stringify(book));
    check('EDICOM and Edicom point to ONE id (were edicomgroup.com and edicom.com: two competitors)', brands.EDICOM && brands.EDICOM === brands.Edicom, JSON.stringify(brands));
    check('a subdomain is stored as its registrable domain (europe.thomsonreuters.com -> thomsonreuters.com)', brands['Thomson Reuters'] === 'thomsonreuters.com', JSON.stringify(brands));
    check('a platform and a source this run met leave ai_brands (read as rivals by AI Metrics and the fit gate) for ai_entities, with their role', !('Microsoft Dynamics 365' in brands) && !('UAE ASP List' in brands) && book['microsoft.com'] && book['microsoft.com'].r === 'platform' && book['uaeasp.ae'] && book['uaeasp.ae'].r === 'source', JSON.stringify(book));
    // and the parser reads the book back: next run, "Microsoft Dynamics 365" in an option list is still a platform, the ASP list a source
    reset();
    mock('AI Plan', [{ json: { ...plan, aliases: brands, run_id: 'next' } }]); mock('Load Cache (AI)', [{ json: { key: 'ai_entities:s1', value: JSON.stringify(book) } }]);
    mock('AI Requests', [{ json: { site_id: 's1', domain: 'techand.ai', run_id: 'next', engine: 'perplexity', prompt_id: 'p', prompt: 'q', kind: 'recommend', run_kind: 'pulse' } }]);
    const r = (await run('Parse AI Answers', [{ json: { tasks: [{ status_code: 20000, result: [{ items: [{ sections: [{ text: 'Edicom, EDICOM Group (edicomgroup.com), Pagero (now part of Thomson Reuters) and Tech& are on the UAE ASP List.', annotations: [] }] }] }] }] } }], { code: 'Pulse__Parse_AI_Answers' }))[0].json;
    check('next run (pulse): EDICOM once, Thomson Reuters once, the client third', r.position === 3 && r.competitors.split(', ').length === 2, JSON.stringify({ position: r.position, competitors: r.competitors }));
    reset();
  });
};
