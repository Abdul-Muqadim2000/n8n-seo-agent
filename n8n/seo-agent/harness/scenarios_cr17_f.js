// CR17F1-CR17F7 (client report 2026-11-17 C5, devaicon.com / techand.ai, build section 196): ONE competitor role (CMP.role, v5/code/_competitors.js)
// for every path that says "competitor", and ONE competitor list per site.
//   F1 the role of every host the client named, and every host of the other kits' lists (_ki.js, _rivals.js, _ai_entities.js, _link_kit.js) is
//      never a competitor by CMP (one answer, held here so the lists cannot drift)
//   F2 the Link Builder's gate replayed on the stored left-out rows (seo_link_outreach 325 / 303 / 240 / 310 / 307 / 230 and techand's three
//      Microsoft rows): none says "a competing site"; real competitors (code-brew.ae, softhat.pk, datax.pk, techgropse.ae, edly.io) stay refused
//      with the same words as before
//   F3 RV: AI-named software makers and directories are not rivals; providerOf never judges them; a SERP rival list drops platforms
//   F4 one competitor list (CMP.oneList): Site settings + chosen - not a competitor / dismissed
//   F5 AIE: SAP / Salesforce / Oracle named in an answer are platforms, not competitors; rule version c17f
//   F6 KI: each kept search carries its service; the 10 picks keep the balance on devaicon's stored heads (run 13298)
//   F7 a prospect whose AI question was retired, and never pitched, is retired (RV.retiredSource); a pitched one is not
//   + the generated workflows: CMP once per node, the KI choices read by every monitor, Site Admin's one-list chain
// The stored rows are the production rows' public parts (domains, page addresses, titles); no personal data.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const V5 = path.join(__dirname, '..', 'v5', 'code'); const rd = (f) => fs.readFileSync(path.join(V5, f), 'utf8');
  const CMP_SRC = rd('_competitors.js');
  const CMP = new Function(CMP_SRC + '\nreturn CMP;')();
  const RVK = new Function(CMP_SRC + '\n' + rd('_rivals.js').replace('/*__COMPETITORS__*/', '') + '\nreturn RV;')();
  const KIT = new Function(CMP_SRC + '\n' + rd('_link_kit.js') + '\n' + rd('_rivals.js').replace('/*__COMPETITORS__*/', '') + '\n' + rd('_outreach_kit.js').replace('/*__RIVALS__*/', '') + '\nreturn { OK, LK, RV };')();
  const DEV = ['Open edX Services', 'Custom AI Solutions', 'AI Automation', 'Custom Software Development', 'Artificial Intelligence & Machine Learning', 'Dynamics 365', 'Power Platform'];
  const TECH = ['Dynamics 365 Business Central', 'Dynamics 365 Finance & Operations', 'Dynamics 365 Sales & CRM', 'Power Platform', 'UAE e-invoicing (Peppol)', 'Copilot Studio'];
  const dev = { own_domain: 'devaicon.com', services: DEV }, tech = { own_domain: 'techand.ai', services: TECH };

  await guard('CR17F1 one role per host', async () => {
    reset(); const SN = 'CR17F1 (C5) one competitor role per host, and every kit\'s list agrees with it'; begin(SN); const check = mkCheck(SN);
    const want = [['linkedin.com', 'also_ranks'], ['clutch.co', 'listing'], ['edx.org', 'also_ranks'], ['programs.edx.org', 'also_ranks'], ['github.com', 'also_ranks'],
      ['brandmentions.pk', 'listing'], ['openedx.org', 'your_platform'], ['microsoft.com', 'your_platform'], ['sap.com', 'software'], ['salesforce.com', 'software'], ['oracle.com', 'software'],
      ['hubspot.com', 'software'], ['zapier.com', 'software'], ['make.com', 'software'], ['centralbank.ae', 'authority'], ['u.ae', 'authority'], ['bebee.com', 'also_ranks'],
      ['edly.io', 'competitor'], ['raccoongang.com', 'competitor'], ['edunext.co', 'competitor'], ['code-brew.ae', 'competitor'], ['softhat.pk', 'competitor'], ['datax.pk', 'competitor'],
      ['techgropse.ae', 'competitor'], ['competenza.ae', 'competitor'], ['devaicon.com', 'you'], ['www.devaicon.com', 'you']];
    const got = want.map(([h]) => [h, CMP.role(h, dev).role]);
    check('devaicon: every host of the report has its real role', J(got) === J(want), J(got.filter((g, i) => g[1] !== want[i][1])));
    const t = [['microsoft.com', 'your_platform'], ['learn.microsoft.com', 'your_platform'], ['adoption.microsoft.com', 'your_platform'], ['openedx.org', 'software'], ['salesforce.com', 'software'], ['sap.com', 'competitor'], ['odoo.com', 'competitor'], ['intwo.cloud', 'competitor'], ['visionet.com', 'competitor']];
    const gt = t.map(([h]) => [h, CMP.role(h, tech).role]);
    check('techand: Microsoft is the platform it builds on; SAP and Odoo make ERP, which it sells, so they compete (accuracy set T13 / T30); Salesforce is a software maker', J(gt) === J(t), J(gt));
    check('the client\'s word wins: not a competitor, chosen', CMP.role('edly.io', { ...dev, not_competitors: ['edly.io'] }).role === 'not_competitor' && CMP.role('linkedin.com', { ...dev, chosen: ['linkedin.com'] }).role === 'competitor'
      && CMP.role('sap.com', { ...dev, overrides: { 'sap.com': 'chosen' } }).role === 'competitor');
    check('partner directories are places to be listed', CMP.partnerDirectory('https://openedx.org/partners/') && CMP.partnerDirectory('https://microsoftpartners.microsoft.com/abs/gtm/agentic-erp/') && !CMP.partnerDirectory('https://edly.io/blog/open-edx-hosting/'));
    check('an agency directory page is a list page; a provider page is not', CMP.listPage('AI / Automation Agencies in Pakistan | BrandMentions', 'https://brandmentions.pk/agencies/ai-automation-agencies')
      && !CMP.listPage('AI Automation Services in Pakistan | Softhat IT Solutions', 'https://softhat.pk/ai-automation') && !CMP.listPage('Agentic AI Development Company in Dubai, UAE | TechGropse AE', 'https://techgropse.ae/agentic-ai'));
    // the other kits' host lists: every name they hold as "not a business" is never a competitor by CMP (KI, RV, AIE, LK)
    const names = (re) => { const m = String(re.source || re).match(/\(([a-z0-9|\\.\-]+)\)\\?\.\[a-z\.\]\+\$/g) || []; return m.flatMap(x => x.replace(/\)\\?\.\[a-z\.\]\+\$$/, '').replace(/^\(/, '').split('|')).map(x => x.replace(/\\\./g, '.')).filter(x => /^[a-z0-9.-]+$/.test(x)); };
    const ki = rd('_ki.js'); const lists = {};
    for (const k of ['PLATFORM_HOSTS', 'DIRECTORY_HOSTS', 'MEDIA_HOSTS']) { const m = ki.match(new RegExp('const ' + k + ' = /(.*)/;')); lists['KI ' + k] = m ? names(m[1]) : []; }
    const aie = rd('_ai_entities.js'); for (const k of ['MEDIA', 'DIRECTORY', 'RESEARCH']) { const m = aie.match(new RegExp('const ' + k + ' = /(.*?)/i;')); lists['AIE ' + k] = m ? names(m[1].split('|yellowpages')[0]) : []; }
    lists['RV NOT_RIVAL'] = names(RVK.NOT_RIVAL.source.split('|(^|\\.)(deloitte')[0]);
    const bad = []; for (const [k, arr] of Object.entries(lists)) for (const n of arr) { const h = n.includes('.') ? n + '.com' : n + '.com'; const r = CMP.role(h, dev).role; if (r === 'competitor') bad.push(k + ':' + n); }
    const total = Object.values(lists).reduce((a, x) => a + x.length, 0);
    check('every host the other kits hold as not a business is not a competitor by CMP (' + total + ' names)', total > 150 && !bad.length, J({ total, bad }));
    const princ = ki.match(/const PRINCIPALS = \[([\s\S]*?)\n  \];/); const ph = princ ? [...princ[1].matchAll(/'([a-z0-9.-]+\.[a-z]+)'/g)].map(m => m[1]) : [];
    const cph = CMP.PRINCIPALS.flatMap(p => p.hosts);
    check('CMP and KI name the same principals (the platform a client builds on)', ph.length > 20 && J(ph) === J(cph), J({ ki: ph.length, cmp: cph.length }));
  });

  await guard('CR17F2 the Link Builder gate on the stored rows', async () => {
    reset(); const SN = 'CR17F2 (C5) the Link Builder\'s competitor gate replayed on the stored left-out rows: no "competing site" for a non-competitor, real rivals still refused'; begin(SN); const check = mkCheck(SN);
    const { OK } = KIT;
    const base = (o) => ({ type: 'ai_source', competitors: [], serp_rivals: [], ai_rivals: [], topics: ['open edx provider', 'ai automation services pakistan', 'custom ai solutions uae'], terms: DEV, ...o });
    const rows = [
      ['325 linkedin', base({ domain: 'linkedin.com', url: 'https://linkedin.com/pulse/top-10-ai-automation-companies-dubai-uae-techanic-infotech-orlnf', title: 'cited for 2 question(s) on 1 engine(s)', serp_rivals: [{ domain: 'linkedin.com', position: 3, keyword: 'open edx provider' }] }), ''],
      ['303 clutch', base({ domain: 'clutch.co', url: 'https://clutch.co/pk/developers/artificial-intelligence', title: 'Top Artificial Intelligence Companies in Pakistan - Clutch', serp_rivals: [{ domain: 'clutch.co', position: 4, keyword: 'ai automation services pakistan' }] }), 'listing'],
      ['240 edx', base({ type: 'resource', domain: 'edx.org', url: 'https://www.edx.org/schools-partners', title: 'Schools and Partners - edX.org', serp_rivals: [{ domain: 'edx.org', host: 'programs.edx.org', position: 3, keyword: 'open edx provider' }] }), ''],
      ['310 github', base({ domain: 'github.com', url: 'https://github.com/overhangio/tutor-indigo', title: 'tutor-indigo - An elegant, customizable theme for Open edX', serp_rivals: [{ domain: 'github.com', position: 5, keyword: 'open edx provider' }] }), ''],
      ['307 brandmentions', base({ domain: 'brandmentions.pk', url: 'https://brandmentions.pk/agencies/ai-automation-agencies', title: 'AI / Automation Agencies in Pakistan | BrandMentions', serp_rivals: [{ domain: 'brandmentions.pk', position: 2, keyword: 'ai automation services pakistan' }] }), 'listing'],
      ['230 openedx partners', base({ domain: 'openedx.org', url: 'https://openedx.org/partners/', title: 'Partners', ai_rivals: [{ domain: 'openedx.org', why: 'a business AI recommends instead of you' }] }), 'listing'],
    ];
    const T = { terms: TECH, topics: ['dynamics 365 partner uae', 'ms 365 erp'] };
    const trows = [
      ['290 learn.microsoft', base({ ...T, domain: 'learn.microsoft.com', url: 'https://learn.microsoft.com/en-us/dynamics365/finance/localizations/mea/uae', title: 'United Arab Emirates (UAE) overview', ai_rivals: [{ domain: 'microsoft.com', why: 'sells what you sell: its page title says it sells ERP ("Agentic ERP Software Solutions")' }] }), 'your_platform'],
      ['313 adoption.microsoft', base({ ...T, domain: 'adoption.microsoft.com', url: 'https://adoption.microsoft.com/en-us/scenario-library/finance/', title: 'Using Copilot in Finance - Microsoft Adoption', ai_rivals: [{ domain: 'microsoft.com', why: 'sells what you sell' }] }), 'your_platform'],
      ['333 microsoftpartners', base({ ...T, domain: 'microsoftpartners.microsoft.com', url: 'https://microsoftpartners.microsoft.com/abs/gtm/agentic-erp/', title: 'Agentic ERP', ai_rivals: [{ domain: 'microsoft.com', why: 'sells what you sell' }] }), 'listing'],
    ];
    for (const [label, o, code] of [...rows, ...trows]) {
      const r = OK.competitorCheck(o);
      check(label + ': never "a competing site"' + (code ? ', left out as ' + code : ', judged by the other rules'), !/competing/.test(r.reason) && r.code === code && OK.sellsSame(o) === r.reason, J(r));
    }
    // the real competitors stay refused, with the words they had before (byte-identical reasons)
    const still = [
      ['code-brew.ae (AI-named business, its own list)', base({ domain: 'code-brew.ae', url: 'https://www.code-brew.ae/blog/top-ai-automation-companies-dubai', title: 'Top 10 AI Automation Companies in Dubai, UAE (2026)', ai_rivals: [{ domain: 'code-brew.ae' }] }),
        'a competing site of yours (code-brew.ae): a business AI recommends instead of you, and its own list ranks itself, not you', 'competitor_list'],
      ['edly.io (declared)', base({ type: 'resource', domain: 'edly.io', url: 'https://edly.io/blog/open-edx-hosting/', title: 'Open edX hosting', competitors: ['edly.io'] }), 'a competing site of yours (edly.io): a competitor of yours, and a competitor does not link to your page', 'competitor'],
      ['techgropse.ae (SERP rival, provider page)', base({ domain: 'techgropse.ae', url: 'https://techgropse.ae/agentic-ai-development-company', title: 'Agentic AI Development Company in Dubai, UAE | TechGropse AE', serp_rivals: [{ domain: 'techgropse.ae', position: 3, keyword: 'agentic ai development uae' }] }),
        'a competing site of yours (techgropse.ae): a site that outranks you for one of your own keywords (#3 for "agentic ai development uae"), and a competitor does not link to your page', 'competitor'],
    ];
    for (const [label, o, words, code] of still) { const r = OK.competitorCheck(o); check(label + ': still refused, same words', r.reason === words && r.code === code, J(r)); }
    const sh = OK.competitorCheck(base({ domain: 'softhat.pk', url: 'https://softhat.pk/ai-automation-services-pakistan', title: 'AI Automation Services in Pakistan | Softhat IT Solutions', ai_rivals: [{ domain: 'softhat.pk' }] }));
    const dx = OK.competitorCheck(base({ domain: 'datax.pk', url: 'https://datax.pk/ai-automation', title: 'Artificial Intelligence & Automation | DataX Technologies', ai_rivals: [{ domain: 'datax.pk' }] }));
    check('softhat.pk and datax.pk (both named by AI as businesses) still refused as competitors', sh.code === 'competitor' && /competing site of yours \(softhat\.pk\)/.test(sh.reason) && dx.code === 'competitor' && /competing site of yours \(datax\.pk\)/.test(dx.reason), J({ sh, dx }));
    check('a lost link or a listing on a directory is still asked (exempt types)', OK.competitorCheck(base({ type: 'lost', domain: 'clutch.co', url: 'https://clutch.co/profile/devaicon' })).code === ''
      && OK.competitorCheck(base({ type: 'listing', domain: 'clutch.co', url: 'https://clutch.co/pk/developers' })).code === '');
    check('every left-out word is plain (no em dash, curly quote, ellipsis) and non-competitors never say "competing"', Object.entries(CMP.LEFT_OUT).every(([k, w]) => !/[—“”…]/.test(w) && (k.startsWith('competitor') || !/compet(ing|itor of yours)/.test(w))));
  });

  await guard('CR17F3 RV follows the one role', async () => {
    reset(); const SN = 'CR17F3 (C5) RV: AI-named software makers and directories are not rivals; a SERP rival set keeps businesses only'; begin(SN); const check = mkCheck(SN);
    const vis = [{ site_id: 's1', checked_at: '2026-11-13T07:00:00Z', rival_sources_json: J([{ domain: 'centralbank.ae', kind: 'rival' }, { domain: 'erp-dubai.ae', kind: 'vendor', why: 'x' }]),
      competitors_json: J([{ domain: 'sap.com', mentions: 9 }, { domain: 'salesforce.com', mentions: 7 }, { domain: 'oracle.com', mentions: 5 }, { domain: 'g42.ai', mentions: 4 }, { domain: 'edly.io', mentions: 3 }]) }];
    const ai = RVK.aiRivals({ site_id: 's1', own: 'devaicon.com', vis_rows: vis, cache_rows: [], services: DEV }).map(x => x.domain);
    check('aiRivals: sap / salesforce / oracle / centralbank out, businesses in', J(ai) === J(['erp-dubai.ae', 'g42.ai', 'edly.io']), J(ai));
    const set = RVK.set({ own: 'devaicon.com', declared: ['competenza.ae'], ai: ['sap.com', 'edly.io'], serp: ['clutch.co', 'linkedin.com', 'raccoongang.com'], services: DEV });
    check('RV.set keeps the declared and the businesses only', J(set.entries().map(e => e.domain + ':' + e.kind)) === J(['competenza.ae:business', 'edly.io:business', 'raccoongang.com:serp']), J(set.entries()));
    check('providerOf never judges a software maker or the platform you build on', RVK.providerOf({ domain: 'microsoft.com', title: 'Agentic ERP Software Solutions', topics: ['erp software uae'], services: TECH }) === ''
      && RVK.providerOf({ domain: 'erp-dubai.ae', title: 'ERPNext Implementation Partner in UAE & Dubai', topics: ['erp software uae'], services: TECH }) !== '');
  });

  await guard('CR17F4 one competitor list', async () => {
    reset(); const SN = 'CR17F4 (C5) one competitor list per site: Site settings + the Competitors page choices - not a competitor'; begin(SN); const check = mkCheck(SN);
    const ki = ['competenza.ae', 'sisgain.ae', 'carmatec.com', 'drcsystems.com', 'growthfactors.ae'].map(d => ({ site_id: 'site_devaicon-com', comp_domain: d, status: 'chosen', status_by: 'user' }));
    const l = CMP.oneList({ site_id: 'site_devaicon-com', own_domain: 'devaicon.com', declared: '', ki_rows: ki, not_competitors: '', max: 5 });
    check('devaicon: the 5 competitors chosen on the Competitors page reach every monitor (seo_monitors.competitors was empty)', J(l.list) === J(ki.map(r => r.comp_domain)), J(l));
    const l2 = CMP.oneList({ own_domain: 'devaicon.com', declared: 'edly.io, linkedin.com', ki_rows: [...ki, { comp_domain: 'carmatec.com', status: 'dismissed', status_by: 'user' }], not_competitors: 'linkedin.com', max: 5 });
    check('declared first, a dismissed or not-a-competitor domain never in, capped at 5', J(l2.list) === J(['edly.io', 'competenza.ae', 'sisgain.ae', 'drcsystems.com', 'growthfactors.ae']), J(l2));
    const ms = rd('_monitor_sites.js'); check('the monitors read the one list (CMP.oneList over seo_monitors + the KI choices)', /CMP\.oneList\(/.test(ms) && /Load KI Competitors \(Mon\)/.test(ms));
  });

  await guard('CR17F5 AI entities', async () => {
    reset(); const SN = 'CR17F5 (C5) AI answers: SAP, Salesforce, Oracle are software makers, not competitors (entity rule c17f)'; begin(SN); const check = mkCheck(SN);
    const AIE = new Function(CMP_SRC + '\n' + rd('_ai_entities.js').replace('/*__COMPETITORS__*/', '') + '\nreturn AIE;')();
    check('the entity rule is versioned c17f (no week compared across it)', AIE.RULE === 'c17f');
    const plan = { site_id: 'site_devaicon-com', domain: 'devaicon.com', business_name: 'Devaicon', brand_names: ['Devaicon'], competitors: [], configured_competitors: [], aliases: {}, services: DEV, topics: [] };
    const D = AIE.dir(plan, {});
    const text = 'For AI automation in the UAE, look at Edly (edly.io), SAP, Salesforce and Oracle; G42 also builds custom AI. Devaicon is a smaller option.';
    const r = AIE.read({ text, cites: [{ url: 'https://edly.io/ai', host: 'edly.io' }, { url: 'https://www.sap.com/x', host: 'sap.com' }] }, D);
    const role = (id) => (r.entities.find(e => e.id === id) || {}).role;
    check('sap.com / salesforce.com / oracle.com are platforms, edly.io a competitor', role('sap.com') === 'platform' && role('salesforce.com') === 'platform' && role('oracle.com') === 'platform' && role('edly.io') === 'competitor', J(r.entities.map(e => [e.id, e.role])));
  });

  await guard('CR17F6 KI service balance', async () => {
    reset(); const SN = 'CR17F6 (C5) keyword research: each kept search carries its service; the picks keep the balance (devaicon run 13298 heads)'; begin(SN); const check = mkCheck(SN);
    const KI = new Function(rd('_fit_gate.js') + '\n' + CMP_SRC + '\n' + rd('_kw_inputs.js') + '\n' + rd('_ki.js') + '\nreturn KI;')();
    const SV = ['custom AI solutions', 'automation', 'software development', 'Artificial Intelligence & Machine Learning', 'Custom Software Development', 'Open edX Services', 'Mobile App Development', 'Managed Services', 'Enterprise Chatbots'];
    check('serviceOf: Open edX, AI, software development, generic', KI.serviceOf('open edx services company in uae', SV) === 'Open edX Services' && KI.serviceOf('custom software development company dubai', SV) === 'software development'
      && KI.serviceOf('ai automation services pakistan', SV) === 'automation' && KI.serviceOf('dubai software market', SV) === '', J(['open edx services company in uae', 'custom software development company dubai', 'ai automation services pakistan', 'dubai software market'].map(k => KI.serviceOf(k, SV))));
    const HEADS = [["software development companies in dubai", 33.6], ["software development companies in uae", 33.6], ["software development agency", 26.5], ["software companies in sharjah", 26.4], ["it companies software development", 25.9], ["custom mobile software development", 25.3], ["custom software development", 22.9], ["custom software development agencies", 21.3], ["corporate software development", 20.4], ["android software development company", 19.8], ["web software development", 19.7], ["software development companies in abu dhabi", 19.3], ["artificial intelligence software development company", 18.6], ["custom software development firms", 18.5], ["ai software development companies", 16.4], ["top 10 software companies in dubai", 16.0], ["bespoke software development services", 14.9], ["it infrastructure management services companies in uae", 14.4], ["open edx services company", 14.3], ["custom software development in dubai", 14.3], ["software development services in dubai", 13.9], ["how much does software development cost", 12.6], ["open edx services company details", 12.2], ["software development studio", 12.2], ["ai and software development", 12.2], ["governed ai vs autonomous ai customer experience productivity software", 12.2], ["custom gpt ai chatbot solutions", 12.2], ["software development and services", 12.1], ["open edx services company in uae", 12.0], ["managed it services for education", 12.0], ["agile software development services", 11.9], ["custom fintech software development", 11.9], ["microsoft enterprise systems company in dubai", 11.8], ["enterprise software development services", 11.5], ["amc in software development", 11.5], ["enterprise systems uae", 11.5], ["microsoft enterprise systems company abu dhabi", 11.4], ["custom app development in dubai", 11.3], ["nearshore software development services", 11.2], ["software development estimates", 11.1], ["software house in uae", 11.0], ["small software development companies", 10.9], ["microsoft enterprise systems company 1", 10.9], ["e learning software development company", 10.8], ["software development companies in sharjah", 10.8], ["custom computer vision software development", 10.5], ["custom real estate software development", 10.5], ["nearshore software development companies", 10.5], ["microsoft enterprise systems company 1 abu dhabi reviews", 10.2], ["erp software development company in dubai", 10.1], ["software development artificial intelligence", 10.1], ["agile software development company", 9.8], ["top mobile software development companies", 9.5], ["real estate development software systems", 9.5], ["ongoing managed it support company provider", 8.9], ["software development vs application development", 8.9], ["logistics software development companies", 8.9], ["real estate application development", 8.7], ["bespoke software development agency", 8.5], ["hire custom software development company", 8.3]];
    const clusters = HEADS.map(([k, sc], i) => ({ keyword: k, cluster_id: 'c' + i, score: sc, verdict: 'hard', page_action: 'new_page', stage: 'hire' }));
    const plain = KI.plan(clusters, [], {});
    const bal = KI.plan(clusters, [], {}, { services: SV, lead: ['custom AI solutions', 'automation'] });
    const share = (acts) => { const m = {}; for (const a of acts) { const s = KI.serviceOf(a.title.replace(/^[^"]*"|"[^"]*$/g, ''), SV) || 'generic'; m[s] = (m[s] || 0) + 1; } return m; };
    const sb = share(bal), sp = share(plain);
    check('without the balance: generic software development crowds the picks (today\'s behaviour, the client\'s complaint)', (sp['software development'] || 0) >= 5, J(sp));
    check('balanced: 10 picks, no service over 4, Open edX has a place, generic at most 2', bal.length === 10 && Object.entries(sb).every(([k, n]) => n <= (k === 'generic' ? 2 : 4)) && (sb['Open edX Services'] || 0) >= 1, J(sb));
    const lead = (sb['automation'] || 0) + (sb['custom AI solutions'] || 0) + (sb['Artificial Intelligence & Machine Learning'] || 0) + (sb['Enterprise Chatbots'] || 0);
    check('every service with a passing search has a place', ['Open edX Services', 'software development'].every(k => (sb[k] || 0) >= 1), J(sb));
    check('each pick carries its service', bal.every(a => typeof a.service === 'string'), J(bal.map(a => a.service)));
    const its = (k, n) => Array.from({ length: n }, () => ({ s: k }));
    const b2 = KI.balance([...its('a', 4), ...its('', 3), ...its('b', 3), ...its('c', 2)], { services: ['a', 'b', 'c'], lead: ['a'], n: 5, get: (x) => x.s });
    check('KI.balance: every service a place, the lead service first, no service over 40%, generic at most a fifth', J(Object.entries(b2.shares).sort()) === J(Object.entries({ a: 2, b: 1, c: 1, generic: 1 }).sort()), J(b2.shares));
    const b3 = KI.balance([...its('a', 3), ...its('b', 1), ...its('', 3)], { services: ['a', 'b'], lead: ['a'], n: 5, get: (x) => x.s });
    check('KI.balance: with too few other searches the picks are still filled, generic capped at a fifth', b3.picked.length === 5 && (b3.shares.generic || 0) === 1, J(b3.shares));
    void lead;
  });

  await guard('CR17F7 retired prospects', async () => {
    reset(); const SN = 'CR17F7 (C5) a prospect whose AI question was retired, never pitched, is retired with it'; begin(SN); const check = mkCheck(SN);
    const prompts = [{ site_id: 's', prompt: 'Which companies are the best Open edX providers in the UAE for corporate training platforms?', keyword: 'best open edx provider uae', status: 'retired', retired_at: '2026-10-27T13:11:02.000Z' },
      { site_id: 's', prompt: 'Who can host and manage an Open edX learning platform for a company in Sharjah?', keyword: 'open edx hosting sharjah', status: 'retired', retired_at: '2026-10-27T13:11:02.000Z' },
      { site_id: 's', prompt: 'Which companies offer the best AI automation services for businesses in Dubai?', keyword: 'best ai automation services dubai', status: 'active' }];
    const pr = (o) => ({ site_id: 's', type: 'ai_source', status: 'new', ...o });
    const a = RVK.retiredSource(pr({ prospect_domain: 'edunext.co', detail: 'AI cites this article 5x (gemini, chatgpt) for "Who can host and manage an Open edX learning platform for a company in Sharjah?" — "Fast, Secure & Scalable Hosting for Open edX - edunext"' }), prompts);
    const b = RVK.retiredSource(pr({ prospect_domain: 'cofounderbase.com', detail: 'AI cites this list 5x (perplexity, chatgpt) for "Which companies offer the best AI automation services for businesses in Dubai?" — "Best AI Agencies"' }), prompts);
    const c = RVK.retiredSource(pr({ prospect_domain: 'edunext.co', status: 'contacted', detail: 'AI cites this article for "Who can host and manage an Open edX learning platform for a company in Sharjah?"' }), prompts);
    const d = RVK.retiredSource(pr({ prospect_domain: 'x.com', detail: 'Cited 2x in AI answers (Claude) about best open edx provider uae — most cited page: "Open edX"' }), prompts);
    check('a retired question retires its prospect (quoted question and "about" topic); an active one or a pitched prospect does not', !!a && !b && !c && !!d, J({ a: !!a, b: !!b, c: !!c, d: !!d }));
    check('AI Metrics writes retired_at for them (the row and status kept)', /RV\.retiredSource\(old, promptsAll\)/.test(rd('AI_Metrics.js')) && /retired_at: now/.test(rd('AI_Metrics.js')));
  });

  await guard('CR17F8 generated workflows', async () => {
    reset(); const SN = 'CR17F8 (C5) the generated workflows: CMP once per node, the KI choices read by every monitor, Site Admin keeps the one list'; begin(SN); const check = mkCheck(SN);
    const W = (f) => { const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', f), 'utf8')); return Array.isArray(d) ? d[0] : d; };
    const code = (wf, n) => ((wf.nodes.find(x => x.name === n) || {}).parameters || {}).jsCode || '';
    for (const [f, ns] of [['SEO_Agent_Link_Builder.json', ['LB Plan', 'LB Assemble']], ['SEO_Agent_AI_Visibility.json', ['AI Plan', 'AI Metrics', 'Parse AI Answers']], ['SEO_Agent_AI_Growth.json', ['Growth Plan', 'Earned Media']], ['SEO_Agent_Backlink_Monitor.json', ['BL Plan']], ['SEO_Agent_Audit_Scheduler.json', ['Audit Candidates']]]) {
      const wf = W(f); for (const n of ns) { const c = code(wf, n); check(f + ' / ' + n + ': one CMP', (c.match(/const CMP = \(\(\) => \{/g) || []).length === 1 && !c.includes('/*__COMPETITORS__*/')); }
      check(f + ': reads the Competitors page choices', wf.nodes.some(x => x.name === 'Load KI Competitors (Mon)'));
    }
    const adm = W('SEO_Agent_Site_Admin.json');
    const next = (n) => ((adm.connections[n] || {}).main || []).map(o => (o || []).map(t => t.node));
    check('Site Admin: KI choice -> the KI row when there is one, else a market-less row of the client\'s own -> result', J(next('KI Competitor OK? (Admin)')) === J([['KI Row? (Admin)'], ['Admin Result']]) && J(next('KI Row? (Admin)')) === J([['Set KI Competitor'], ['KI Choice Row (Admin)']])
      && J(next('KI Choice Row (Admin)')) === J([['Save KI Choice (Admin)']]) && J(next('Save KI Choice (Admin)')) === J([['Admin Result']]) && J(next('Set KI Competitor')) === J([['Admin Result']]), J([next('KI Competitor OK? (Admin)'), next('KI Row? (Admin)'), next('KI Choice Row (Admin)')]));
    // the choice itself, run on the generated node: a domain outside the KI set gets its own row (status_by user, market ''), KI off or on
    const kc = new Function('$', code(adm, 'KI Competitor (Admin)'));
    const $ = (rows, mon, a) => (n) => ({ first: () => ({ json: n === 'Admin Action' ? a : mon }), all: () => (n === 'Load KI Competitors (Admin)' ? rows : []).map(json => ({ json })) });
    const A = (status, d, market) => ({ site_id: 'site_devaicon-com', domain: 'devaicon.com', ki_comp_domain: d, ki_status: status, ki_market: market || '', updated_at: '2026-11-18T00:00:00.000Z' });
    const o1 = kc($([], { site_id: 'site_devaicon-com' }, A('not_competitor', 'sap.com')))[0].json;
    const o2 = kc($([{ comp_domain: 'edly.io', market: 'AE-en', status: 'candidate' }], {}, A('not_competitor', 'edly.io')))[0].json;
    const five = ['a.ae', 'b.ae', 'c.ae', 'd.ae', 'e.ae'].map(d => ({ comp_domain: d, market: 'AE-en', status: 'chosen' }));
    const o3 = kc($(five, {}, A('chosen', 'f.ae')))[0].json;
    check('not a competitor for SAP (no KI row): its own row, market \'\', dismissed by the client; for edly.io (a KI row): that row, dismissed; a sixth choice refused', o1.ok && !o1.ki_row && o1.own_row && o1.own_row.market === '' && o1.own_row.status === 'dismissed' && o1.own_row.status_by === 'user'
      && o2.ok && o2.ki_row && o2.market === 'AE-en' && o2.status === 'dismissed' && !o3.ok && /at most 5/.test(o3.error), J({ o1, o2: [o2.ok, o2.ki_row, o2.market, o2.status], o3 }));
  });

  await guard('CR17F9 one decision per domain (FX-LINKS)', async () => {
    reset(); const SN = 'CR17F9 (FX-LINKS, review R2 M3 L5 L6) the client\'s latest decision on a domain wins on every row; the KI choice updates every row of the domain; the rule-change sentence names the new rule'; begin(SN); const check = mkCheck(SN);
    const T1 = '2026-11-10T00:00:00.000Z', T2 = '2026-11-12T00:00:00.000Z';
    const rowsA = [{ comp_domain: 'rival.ae', market: '', status: 'dismissed', status_by: 'user', updated_at: T1 }, { comp_domain: 'rival.ae', market: 'AE-en', status: 'chosen', status_by: 'user', updated_at: T2 }];
    const a = CMP.oneList({ own_domain: 'devaicon.com', ki_rows: rowsA });
    check('M3: an older market-less "not a competitor", then "choose" on the Competitors page: on the list, never removed', a.list.includes('rival.ae') && !a.removed.includes('rival.ae'), J(a));
    check('M3: so the role is a competitor again (it is never pitched)', CMP.role('rival.ae', { ...dev, chosen: a.chosen, not_competitors: a.removed }).role !== 'not_competitor', J(CMP.role('rival.ae', { ...dev, chosen: a.chosen, not_competitors: a.removed })));
    const rowsB = [{ comp_domain: 'rival.ae', market: '', status: 'dismissed', status_by: 'user', updated_at: T2 }, { comp_domain: 'rival.ae', market: 'AE-en', status: 'chosen', status_by: 'user', updated_at: T1 }];
    const b = CMP.oneList({ own_domain: 'devaicon.com', ki_rows: rowsB });
    check('M3: and the other way round: a later "not a competitor" removes an older choice', !b.list.includes('rival.ae') && b.removed.includes('rival.ae'), J(b));
    const c = CMP.oneList({ own_domain: 'devaicon.com', declared: ['declared.ae'], ki_rows: [{ comp_domain: 'auto.ae', market: 'AE-en', status: 'chosen', status_by: 'auto', updated_at: T1 }, { comp_domain: 'off.ae', market: 'AE-en', status: 'dismissed', status_by: 'auto', updated_at: T2 }] });
    check('M3: rows with no decision of the client keep the old rule (an automatic dismissal is not "not a competitor")', c.list.includes('declared.ae') && c.list.includes('auto.ae') && !c.removed.includes('off.ae'), J(c));
    const W = (f) => { const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', f), 'utf8')); return Array.isArray(d) ? d[0] : d; };
    const adm = W('SEO_Agent_Site_Admin.json');
    const set = adm.nodes.find(n => n.name === 'Set KI Competitor');
    check('M3: Set KI Competitor updates every row of the domain for the site (no market in its filter)', J(set.parameters.filters.conditions.map(x => x.keyName)) === J(['site_id', 'comp_domain']), J(set.parameters.filters));
    const kc = new Function('$', ((adm.nodes.find(x => x.name === 'KI Competitor (Admin)') || {}).parameters || {}).jsCode || '');
    const $ = (rows, a) => (n) => ({ first: () => ({ json: n === 'Admin Action' ? a : {} }), all: () => (n === 'Load KI Competitors (Admin)' ? rows : []).map(json => ({ json })) });
    const A = (status, d, market) => ({ site_id: 'site_devaicon-com', domain: 'devaicon.com', ki_comp_domain: d, ki_status: status, ki_market: market || '', updated_at: '2026-11-18T00:00:00.000Z' });
    const o = kc($([{ comp_domain: 'rival.ae', market: '', status: 'dismissed', status_by: 'user' }, { comp_domain: 'rival.ae', market: 'AE-en', status: 'candidate' }], A('chosen', 'rival.ae')))[0].json;
    check('M3: choosing a domain that has a market-less row and a KI row updates (both) rows, no new row', o.ok && o.ki_row === true && !o.own_row && o.rows_of_domain === 2, J(o));
    const o2 = kc($([{ comp_domain: 'two.ae', market: 'AE-en', status: 'candidate' }, { comp_domain: 'two.ae', market: 'PK-en', status: 'candidate' }], A('not_competitor', 'two.ae')))[0].json;
    check('M3: a domain in two markets, no market given: the KI rows are updated, never a stray market-less row', o2.ok && o2.ki_row === true && !o2.own_row, J(o2));
    // L6: the "new baseline" sentence names what changed between the two weeks' rules
    const src = rd('AI_Metrics.js'); const i = src.indexOf('const entRuleOf = '); const end = "join('; '); };"; const j2 = src.indexOf(end, src.indexOf('const entRuleWhy = ')) + end.length;
    const why = (now, prev) => new Function('AIE', src.slice(i, j2) + '\nreturn entRuleWhy(' + J(prev) + ');')({ RULE: now });
    check('L6: f53 -> c17f says software makers and the platform you build on are no longer competitors (not F-53\'s heading / price sentence)', /software makers and the platform you build on/.test(why('c17f', 'f53')) && !/a heading, a price/.test(why('c17f', 'f53')), why('c17f', 'f53'));
    check('L6: a week counted before F-53 names both changes; f53 itself keeps its own sentence', /a heading, a price/.test(why('c17f', '')) && /software makers/.test(why('c17f', '')) && /a heading, a price/.test(why('f53', '')) && !/software makers/.test(why('f53', '')), J([why('c17f', ''), why('f53', '')]));
  });
};
