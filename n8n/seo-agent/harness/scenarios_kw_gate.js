// KWG1-KWG7 (KW-GATE, 2026-10-21): the keyword business-fit gate as a design, not more patterns - the independent review of the keyword merges
// (scratchpad review/KW_REVIEW.md items 2, 3, 4, 5, 6, 8, 11, 12, 13, 14, 16) and the accuracy set's failures (harness/accuracy/keywords.json).
// Every check runs the GENERATED code (harness/code_v4) and failed on the code before KW-GATE:
//   KWG1  the client's own brand and topic: "peppol" for peppol.org is a topic word, not "the website itself"; a job search for the brand is a job search
//   KWG2  declared categories and other vendors: "erp software uae" / "peppol uae" / "vat registration uae" for a Business Central + e-invoicing
//         partner are in topic; "netsuite pricing", "sap implementation dubai", "tech consultant deloitte" are another company's product or firm
//   KWG3  Arabic keywords read through the glossary: AI consulting / e-invoicing in Arabic are in topic, Arabic job searches are job searches,
//         an Emirates ID renewal and a foreign-ministry attestation are government
//   KWG4  review 2 / 8 / 13: a VAT consultancy keeps its own service on a government results page; a training company keeps course searches, a
//         recruitment agency job searches; an IT firm "it company dubai", an AI firm "ai firm dubai" ("ai uae" stays too broad)
//   KWG5  review 5 / 6: a career verdict needs a job or course page; the keyword's own words in titles and questions are not evidence
//   KWG6  review 3 / 4 / 14: the full report only calls the kit: "best erp companies in dubai", "no 1 erp company in uae", "dynamics 365: business
//         central pricing" are kept there too; "ibt no 1 bpo company in middle east", "top facilities management companies uae" still refused
//   KWG7  review 11 / 12 / 16: research keeps the career demotion and note, the replacement start-with pick is fit "in"; the Keyword Check's
//         alternatives go through the gate
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const V = require('./fixtures_v5');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const NO_TELLS = /[—–“”‘’…]/;
  const SERVICES = ['AI consulting', 'AI and automation', 'Microsoft Copilot implementation', 'Dynamics 365 Finance', 'Dynamics 365 Business Central', 'Dynamics 365 Sales', 'E-invoicing compliance'];
  const BUSINESS = 'Microsoft partner in Dubai for enterprises in the UAE and GCC: AI consulting and automation, Microsoft Copilot, Dynamics 365 business applications, data and cloud';
  const T = { own_domain: 'techand.ai', competitors: [], serp_domains: [], brands: {}, protect: [...SERVICES, BUSINESS], topics: [...SERVICES, BUSINESS], topic_label: 'what this website sells' };
  const site = (domain, services, business) => ({ own_domain: domain, competitors: [], serp_domains: [], brands: {}, protect: [...services, business], topics: [...services, business], topic_label: 'what this website sells' });
  const gate = async (list, c) => (await run('_fit_gate', list.map(k => ({ json: { keyword: k, intent: '', ctx: c } })))).map(i => i.json);
  const by = (rows) => Object.fromEntries(rows.map(r => [r.keyword, r]));
  const okAll = (g, ks) => ks.every(k => g[k] && g[k].ok === true);
  const bad = (g, ks) => J(ks.filter(k => !g[k] || g[k].ok !== true).map(k => [k, g[k] && g[k].reason, g[k] && g[k].detail]));

  await guard('KWG1 own brand and topic', async () => {
    reset(); const SN = 'KWG1 KW-GATE - a domain label that is also a declared topic word ("peppol") is judged as a topic; a job search for the brand is a job search'; begin(SN); const check = mkCheck(SN);
    const P = site('peppol.org', ['Peppol network', 'Peppol membership', 'Peppol specifications', 'Peppol e-invoicing standards', 'Peppol access point certification', 'Peppol authorities'],
      'OpenPeppol, the not-for-profit association that operates and governs the Peppol network for e-invoicing and e-procurement: membership, specifications, certified service providers');
    const g = by(await gate(['what is peppol', 'peppol access point', 'peppol uae', 'peppol jobs', 'pagero login'], P));
    console.log('   gate ->', J(Object.values(g).map(r => [r.keyword, r.ok ? 'ok' : r.reason])));
    check('"what is peppol", "peppol access point", "peppol uae" are peppol.org\'s topic (were "names the website itself")', okAll(g, ['what is peppol', 'peppol access point', 'peppol uae']), bad(g, ['what is peppol', 'peppol access point', 'peppol uae']));
    check('"peppol jobs" is a job search and "pagero login" a login, not topics', g['peppol jobs'].reason === 'job search' && g['pagero login'].ok === false, J([g['peppol jobs'], g['pagero login']]));
    const a = by(await gate(['azdan careers', 'techand login'], { ...site('azdan.com', ['Oracle NetSuite implementation'], 'Oracle NetSuite partner'), own_domain: 'azdan.com' }));
    check('a careers search for the client\'s own name is a job search (was "names the website itself")', a['azdan careers'].reason === 'job search' && /looking for work/.test(a['azdan careers'].detail), J(a['azdan careers']));
  });

  await guard('KWG2 declared categories and other vendors', async () => {
    reset(); const SN = 'KWG2 KW-GATE - a category of what the client sells is in topic; another vendor\'s product or firm the client does not declare is "other brand", with that reason'; begin(SN); const check = mkCheck(SN);
    const IN = ['erp software uae', 'best erp software uae', 'erp systems in uae', 'peppol uae', 'vat registration uae', 'fta e invoicing', 'uae e invoicing mandate 2026', 'dynamics 365 vs sap business one', 'microsoft dynamics 365 partner uae'];
    const OUT = ['sap implementation dubai', 'it consultant capgemini', 'tech consultant deloitte'], OFF = ['netsuite pricing', 'odoo pricing uae', 'meta ai'];
    const g = by(await gate([...IN, ...OUT, ...OFF], T));
    console.log('   gate ->', J(Object.values(g).map(r => [r.keyword, r.ok ? 'ok' : r.reason])));
    check('category searches of what the client sells are kept (ERP for a Business Central partner, Peppol / VAT / FTA next to e-invoicing, a comparison with its own product)', okAll(g, IN), bad(g, IN));
    check('another vendor\'s product or firm that passes the topic rule (a partner or consultant word) is refused as other brand, naming it, in plain words; one that is off topic anyway keeps that reason', OUT.every(k => g[k].ok === false && g[k].reason === 'other brand' && /another company's product or firm/.test(g[k].detail) && !NO_TELLS.test(g[k].detail))
      && OFF.every(k => g[k].ok === false), J([...OUT, ...OFF].map(k => [k, g[k].reason, g[k].detail])));
    const az = by(await gate(['netsuite pricing uae', 'oracle epm consultant', 'sap business one partner uae', 'business central partner uae'], { ...site('azdan.com', ['Oracle NetSuite implementation', 'NetSuite support and managed services', 'Oracle EPM'], 'Oracle NetSuite solution provider and Oracle EPM partner in the UAE'), services: ['Oracle NetSuite implementation', 'NetSuite support and managed services', 'Oracle EPM'] }));
    check('the same vendor is the client\'s own when declared (NetSuite and Oracle for a NetSuite partner) and another company\'s when not (SAP, Business Central)',
      az['netsuite pricing uae'].ok && az['oracle epm consultant'].ok && az['sap business one partner uae'].reason === 'other brand' && az['business central partner uae'].reason === 'other brand', J(az));
  });

  await guard('KWG3 Arabic keywords', async () => {
    reset(); const SN = 'KWG3 KW-GATE - an Arabic keyword is normalised, read through a small glossary and judged by the same rules; the sentence says how it was read'; begin(SN); const check = mkCheck(SN);
    const IN = ['استشارات الذكاء الاصطناعي في دبي', 'شركة استشارات ذكاء اصطناعي', 'مايكروسوفت دايناميكس 365 الإمارات', 'الفاتورة الإلكترونية في الإمارات', 'نظام الفوترة الإلكترونية الإمارات', 'الفاتوره الالكترونيه فى الامارات'];
    const g = by(await gate([...IN, 'وظائف الذكاء الاصطناعي في دبي', 'راتب مستشار ذكاء اصطناعي', 'تجديد الهوية الإماراتية', 'تصديق الشهادات وزارة الخارجية'], T));
    console.log('   gate ->', J(Object.values(g).map(r => [r.keyword, r.ok ? 'ok' : r.reason + ': ' + r.detail])));
    check('AI consulting, Dynamics 365 and e-invoicing searches in Arabic are in topic (were 0% of their words matching), with or without hamza and ta marbuta', okAll(g, IN), bad(g, IN));
    check('Arabic job and salary searches are job searches, and the sentence says how the keyword was read', ['وظائف الذكاء الاصطناعي في دبي', 'راتب مستشار ذكاء اصطناعي'].every(k => g[k].reason === 'job search' && /read as "/.test(g[k].detail)), J([g['وظائف الذكاء الاصطناعي في دبي'], g['راتب مستشار ذكاء اصطناعي']]));
    check('an Emirates ID renewal and a foreign-ministry attestation in Arabic are government (were off topic)', g['تجديد الهوية الإماراتية'].reason === 'government' && g['تصديق الشهادات وزارة الخارجية'].reason === 'government', J([g['تجديد الهوية الإماراتية'], g['تصديق الشهادات وزارة الخارجية']]));
  });

  await guard('KWG4 review 2 8 13 sellers', async () => {
    reset(); const SN = 'KWG4 KW-GATE review 2 / 8 / 13 - a VAT consultancy, a training company, a recruitment agency and an IT firm keep their own buyer searches'; begin(SN); const check = mkCheck(SN);
    const VAT = { ...site('taxwise-advisory.ae', ['VAT registration', 'Corporate tax registration', 'VAT return filing'], 'Tax consultancy in Dubai: VAT and corporate tax registration for UAE companies'), serp: ['tax.gov.ae', 'u.ae', 'mof.gov.ae', 'ey.com', 'pwc.com'] };
    const v = (await gate(['vat registration uae', 'emirates id status'], VAT));
    check('review 2: "vat registration uae" for a VAT consultancy with tax.gov.ae / u.ae / mof.gov.ae on top is its own service (was "the results page belongs to government sites"); an ID status check is still government',
      v[0].ok === true && v[1].reason === 'government', J(v));
    const tr = (await gate(['power bi course dubai', 'excel training dubai'], site('skillbridge.ae', ['Power BI workshops', 'Corporate learning programs', 'Excel bootcamps'], 'Corporate training in Dubai')));
    const rc = (await gate(['accountant jobs in dubai'], site('staffpoint.ae', ['Manpower supply', 'Executive search', 'Employment agency'], 'Recruitment agency in Dubai')));
    const ns = (await gate(['netsuite certification course'], site('azdan.com', ['Oracle NetSuite implementation', 'NetSuite support and managed services'], 'Oracle NetSuite partner in the UAE')));
    check('review 8: a training company keeps "power bi course dubai", a recruitment agency keeps "accountant jobs in dubai"; a NetSuite partner is told "netsuite certification course" is a course search',
      tr.every(r => r.ok) && rc.every(r => r.ok) && ns[0].reason === 'job search' && /course/.test(ns[0].detail), J([tr, rc, ns]));
    const IT = site('netcore-it.ae', ['Managed IT services', 'IT support', 'Network infrastructure', 'Cybersecurity'], 'IT company in Dubai: managed IT services and IT support for SMEs');
    const it = by(await gate(['it company dubai', 'it services company uae', 'best it company uae'], IT));
    const ai = by(await gate(['best ai companies uae', 'ai firm dubai', 'ai uae', 'ai online', 'best ai apps', 'ai'], T));
    check('review 13: an IT firm keeps "it company dubai" and its kin, an AI firm "best ai companies uae" and "ai firm dubai" (were "too broad")', okAll(it, Object.keys(it)) && ai['best ai companies uae'].ok && ai['ai firm dubai'].ok, J([it, ai['best ai companies uae'], ai['ai firm dubai']]));
    check('"ai uae", "ai online", "best ai apps" and "ai" stay too broad (no seller named)', ['ai uae', 'ai online', 'best ai apps', 'ai'].every(k => ai[k].reason === 'too broad'), J(['ai uae', 'ai online', 'best ai apps', 'ai'].map(k => ai[k])));
  });

  await guard('KWG5 review 5 6 career evidence', async () => {
    reset(); const SN = 'KWG5 KW-GATE review 5 / 6 - a career verdict needs a job or course page on the results page; the keyword\'s own words in titles are not evidence'; begin(SN); const check = mkCheck(SN);
    const SF = site('cloudnine-crm.ae', ['Salesforce implementation', 'Salesforce consulting', 'CRM integration'], 'Salesforce partner in Dubai');
    const partners = ['cloudanalogy.com', 'techcronus.com', 'rolustech.com', 'nexgensis.com', 'emiratesgraphic.com'].map((d, i) => ({ domain: d, url: 'https://' + d + '/salesforce-consulting-dubai/', title: 'Salesforce Consulting Partner in Dubai ' + i }));
    const sf = (await gate(['salesforce consultant dubai'], { ...SF, career: { pages: partners, paa: ['How much does a Salesforce consultant earn in Dubai?', 'How do I become a Salesforce consultant?'],
      related: ['salesforce consultant dubai jobs', 'salesforce consultant salary dubai', 'salesforce consultant course dubai', 'salesforce consultant jobs uae', 'salesforce consultant dubai remote'] } }))[0];
    check('review 5: "salesforce consultant dubai" with an all-partner top 10 is not a job search on questions and related searches alone (scored 2, was refused)', sf.ok === true, J(sf));
    const ISO = site('certiq.ae', ['ISO 27001 consulting', 'ISO 9001 consulting', 'ISO audit support'], 'ISO consultancy in the UAE');
    const iso = (await gate(['iso 27001 certification dubai'], { ...ISO, career: { pages: ['a.ae', 'b.ae', 'c.com'].map((d) => ({ domain: d, url: 'https://' + d + '/iso-27001/', title: 'ISO 27001 Certification in Dubai | Get Certified' })),
      paa: ['How long does ISO 27001 certification take?', 'What is the cost of ISO 27001 certification in UAE?'], related: [] } }))[0];
    check('review 6: "certification" in the buyers\' titles and questions is the keyword\'s own word, not course evidence (was refused as a job search)', iso.ok === true, J(iso));
  });

  await guard('KWG6 review 3 4 14 full report only calls the kit', async () => {
    reset(); const SN = 'KWG6 KW-GATE review 3 / 4 / 14 - Analyze Keywords decides like the kit: the client\'s own industry is kept, a company\'s own name or claim and another industry\'s list are refused'; begin(SN); const check = mkCheck(SN);
    const row = (k) => ({ se_type: 'google', keyword_data: { keyword: k, keyword_info: { search_volume: 500, cpc: 2.5, competition_level: 'HIGH' }, keyword_properties: { keyword_difficulty: 12 }, search_intent_info: { main_intent: 'commercial' } },
      ranked_serp_element: { serp_item: { type: 'organic', rank_group: 4, rank_absolute: 4, url: 'https://rivalco.com/p', etv: 10 } } });
    const KEEP = ['best erp companies in dubai', 'no 1 erp company in uae', 'number 1 ai consulting company dubai', 'dynamics 365: business central pricing'];
    const REF = ['ibt no 1 bpo company in middle east', 'ibt: no 1 bpo company in middle east', 'top facilities management companies uae', 'acme #1 bpo company dubai'];
    mock('Competitor Analysis', { domain: 'techand.ai', competitors: ['rivalco.com'], business: 'Microsoft Dynamics 365, AI consulting and e-invoicing for UAE companies', services: ['Dynamics 365 Business Central', 'AI consulting', 'E-invoicing'], extra_findings: [], extra_works: [] });
    mock('KW Targets', [{ domain: 'techand.ai', is_you: true }, { domain: 'rivalco.com', is_you: false }]);
    mock('Ranked Keywords', [V.task({ target: 'techand.ai', items: [] }), V.task({ target: 'rivalco.com', items: [...KEEP, ...REF].map(row) })]);
    mock('Fallback Queries', [{ query: 'dynamics 365 uae' }, { query: 'ai consulting' }]);
    delete store['Load Site Cache'];
    const sk = (await run('Analyze Keywords', V.task({ items: [] })))[0].json.site_keywords;
    const refused = new Map((sk.refused || []).map(r => [r.keyword, r]));
    console.log('   refused ->', J([...refused.values()].map(r => [r.keyword, r.reason, r.detail])));
    check('the client\'s own industry is kept by the full report (were "another industry\'s companies (erp)" / "number 1 claim")', KEEP.every(k => !refused.has(k)), J(KEEP.filter(k => refused.has(k)).map(k => refused.get(k))));
    check('a company\'s own name before a colon or a "number 1" claim ("#1" included) is other brand, another industry\'s list is off topic, each with a plain reason',
      ['ibt no 1 bpo company in middle east', 'ibt: no 1 bpo company in middle east', 'acme #1 bpo company dubai'].every(k => refused.has(k) && refused.get(k).reason === 'other brand')
        && refused.has('top facilities management companies uae') && refused.get('top facilities management companies uae').reason === 'off topic' && [...refused.values()].every(r => !NO_TELLS.test(r.detail || '')), J([...refused.values()]));
    const kit = by(await gate([...KEEP, ...REF], site('techand.ai', ['Dynamics 365 Business Central', 'AI consulting', 'E-invoicing'], 'Microsoft Dynamics 365, AI consulting and e-invoicing for UAE companies')));
    check('the kit gives the same answers (research, ladder, Keyword Check and the full report decide alike)', KEEP.every(k => kit[k].ok) && REF.every(k => kit[k].ok === false && kit[k].reason === refused.get(k).reason), J(Object.values(kit).map(r => [r.keyword, r.ok, r.reason])));
  });

  await guard('KWG7 review 11 12 16 research order and Keyword Check alternatives', async () => {
    reset(); const SN = 'KWG7 KW-GATE review 11 / 12 / 16 - research keeps the career demotion and its note, the start-with replacement is fit "in", the Keyword Check alternatives are gated'; begin(SN); const check = mkCheck(SN);
    const D = 'techand.ai';
    const kw = (keyword, o) => ({ keyword, volume: 170, kd: 0, cpc: 13.85, intent: 'commercial', page_type: 'Service Page', opportunity: 79, competitors_in_top20: 0, serp_types: ['organic'], topic: 'ai consulting', service_fit: 'unknown', ...(o || {}) });
    const pr = [kw('ai consultant', { opportunity: 90, service_fit: 'in' }), kw('ai strategy uae', { volume: 90, opportunity: 60 }), kw('ai consulting services uae', { volume: 50, opportunity: 50, service_fit: 'in' })];
    mock('Rank Keywords', [{ json: { domain: D, country: 'United Arab Emirates', services: SERVICES, seeds: ['ai consulting'], keyword_strategy: { goal: 'leads', pool_size: 40, total_relevant: 3,
      keywords: pr, priority: pr, quick_wins: [], clusters: [], questions: [], long_tail: [], competitor_gaps: [], by_intent: { commercial: pr, transactional: [], informational: [] },
      pipeline_keyword: pr[0], refused: [], service_fit: { declared_services: SERVICES, judged_on: 'the services you listed', in: 2, unknown: 1, out: 0 } } } }]);
    mock('Priority Keywords', pr.map(p => ({ json: { keyword: p.keyword } })));
    mock('AI Demand', [{ json: {} }]);
    const serp = (keyword, pages, paa) => V.task({ keyword, datetime: '2026-10-21 14:10:46 +00:00', items: [...pages.map((p, i) => ({ type: 'organic', rank_group: i + 1, rank_absolute: i + 1, domain: p.domain, url: p.url, title: p.title })),
      { type: 'people_also_ask', items: paa.map(q => ({ title: q })) }] });
    const JOBS = [{ domain: 'ae.indeed.com', url: 'https://ae.indeed.com/q-ai-consultant-jobs.html', title: 'Ai Consultant Jobs' }, { domain: 'www.usaii.org', url: 'https://www.usaii.org/certifications/caic', title: 'Certified AI Consultant' },
      { domain: 'www.bayt.com', url: 'https://www.bayt.com/en/uae/jobs/ai-consultant-jobs/', title: 'AI Consultant Jobs in UAE' }];
    const BUY = [{ domain: 'consultancy-me.com', url: 'https://www.consultancy-me.com/industry/ai', title: 'AI consulting firms in the Middle East' }];
    const out = (await run('Build Keyword Strategy', [{ json: serp('ai consultant', JOBS, ['What is an AI consultant salary?', 'How do I become an AI consultant?']) }, { json: serp('ai strategy uae', BUY, []) }, { json: serp('ai consulting services uae', BUY, []) }]))[0].json;
    const K = out.keyword_strategy, rec = out.keyword_suggestions.recommended.map(r => r.keyword);
    console.log('   start ->', J(K.pipeline_keyword && [K.pipeline_keyword.keyword, K.pipeline_keyword.career_note]), '| recommended ->', J(rec));
    check('review 12: the replacement start-with pick is a fit "in" keyword ("ai consulting services uae"), never the "unknown" one', K.pipeline_keyword && K.pipeline_keyword.keyword === 'ai consulting services uae', J(K.pipeline_keyword && K.pipeline_keyword.keyword));
    check('review 11: the start-with pick keeps its note saying why the first pick was replaced', K.pipeline_keyword && /looking for work or training/.test(K.pipeline_keyword.career_note || ''), J(K.pipeline_keyword));
    check('review 11: the career search stays last in the recommended list although its service fit is "in"', rec[rec.length - 1] === 'ai consultant', J(rec));
    // review 16: the Keyword Check's alternatives go through the gate without the asked keyword's results page
    reset();
    const LOC = 2784, SITE = 'site_techand-ai';
    const ok = (id, cost, result) => ({ version: '0.1', status_code: 20000, status_message: 'Ok.', tasks: [{ id, status_code: 20000, status_message: 'Ok.', cost, result: [result] }] });
    mock('Assess Validate', [{ json: { ok: true, status: 200, keyword: 'ai consulting dubai', domain: D, site_id: SITE, country: 'United Arab Emirates', location_code: LOC, language_code: 'en', business: 'AI consulting and Microsoft Dynamics partner in the UAE', services: SERVICES, existing_keywords: [], caller: 'app:test' } }]);
    mock('Load Assess Cache', [{ json: { key: 'reach:' + SITE, kind: 'reach', site_id: SITE, value: JSON.stringify({ reach: 30, method: 'size', p75: null, size_reach: 30, sample: 0, top10: 20, organic_keywords: 300, location_code: LOC }), updated_at: new Date(Date.now() - 3 * 864e5).toISOString() } }]);
    const reqs = (await run('Assess Requests', [{ json: {} }])).map(i => i.json);
    const answers = reqs.map(r => r.kind === 'overview' ? ok('ov-1', 0.01, { items: [{ keyword: 'ai consulting dubai', keyword_info: { search_volume: 320, cpc: 6.5 }, keyword_properties: { keyword_difficulty: 22 }, search_intent_info: { main_intent: 'commercial' } }] })
      : r.kind === 'serp' ? ok('serp-1', 0.002, { keyword: 'ai consulting dubai', datetime: '2026-10-21 08:00:00 +00:00', items: BUY.map((p, i) => ({ type: 'organic', rank_group: i + 1, rank_absolute: i + 1, ...p })) }) : ok('x-' + r.kind, 0, { items: [] }));
    const ar = (await run('Assess Result', answers.map(j => ({ json: j }))))[0].json; mock('Assess Result', [{ json: ar }]);
    const body = (await run('Assess Response', [{ json: { output: { fit: 0, navigational: false, alternatives: 'odoo pricing uae, netsuite consultant dubai, dynamics 365 business central partner uae' } } }]))[0].json.body;
    console.log('   alternatives ->', J(body.alternatives));
    check('review 16: the model\'s alternatives pass the same gate: another vendor\'s searches are dropped, the client\'s own service is offered', !body.alternatives.includes('odoo pricing uae') && !body.alternatives.includes('netsuite consultant dubai')
      && body.alternatives.includes('dynamics 365 business central partner uae'), J(body.alternatives));
  });
};
