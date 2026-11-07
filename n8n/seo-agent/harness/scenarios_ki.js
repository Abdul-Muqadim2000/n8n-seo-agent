// KI E1 (keyword intelligence kit, 2026-11-08, docs/keyword-intel-2026-11-08/CONTRACTS.md section 6, DESIGN.md section 8, fixes/E1.md):
// the pure kit v5/code/_ki.js (KI), loaded the way the KI worker inlines it (after _fit_gate.js, _competitors.js, _kw_inputs.js, _site_model.js)
// in a sandbox like n8n's (no URL, no structuredClone, Object.defineProperty a no-op).
//   KI1  load, sandbox, ASCII, no clock / random                      KI14 value and gap factors
//   KI2  norm / key / services (R3 #4: a service is never split)      KI15 score: the formula, the owner's example (jobs 0, partner 43), monotone, config, range
//   KI3  hosts and urls (recovered, partial, null domain, goto)       KI16 verdict + the parity fixture (words, thresholds, stage weights)
//   KI4  classifyDomain (9 classes, rejects, bases)                   KI17 scoreCompetitors (SERPshare by hand, platforms tagged, size tag)
//   KI5  pageType                                                     KI18 pageAction (list / refresh / new, cannibalisation)
//   KI6  stage + intent (evidence, review, provider label)            KI19 striking distance
//   KI7  gate (career, other_market, other_brand, government, avoid)  KI20 gaps (keyword and beyond-keyword types, sample note)
//   KI8  fit                                                          KI21 plan (<= 10, ranked, plain ASCII words, credits)
//   KI9  mergeCandidates (variants, sources, families)                KI22 readable (fails closed) + label
//   KI10 prescore (fit is in it)                                      KI23 accuracy sets (hold-out >= 90%)
//   KI11 cluster (owner acceptance: identical never split, zero never merged, no chaining, deterministic)
//   KI12 demand (GSC first, floor, AIO)   KI13 win                    KI24 R3 golden regressions   KI25 inputs never mutated
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, reset, guard, begin } = ctx;
  await guard('ki kit', async () => {
    reset(); const SN = 'KI (E1 2026-11-08, CONTRACTS.md section 6): the keyword-intelligence kit KI - classes, stage, clusters, score, gaps, plan';
    begin(SN);
    const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
    const J = (x) => String(JSON.stringify(x));
    const ROOT = path.join(__dirname, '..'); const V5 = path.join(ROOT, 'v5', 'code'); const rd = (f) => fs.readFileSync(path.join(V5, f), 'utf8');
    const NOOP = new Set(['defineProperty', 'defineProperties', 'setPrototypeOf']); const SOBJ = new Proxy(Object, { get: (t, k) => NOOP.has(k) ? ((o) => o) : t[k] });
    const SRC = rd('_ki.js');
    const K = new Function('URL', 'structuredClone', 'Object', rd('_fit_gate.js') + '\n' + rd('_competitors.js') + '\n' + rd('_kw_inputs.js') + '\n' + rd('_site_model.js') + '\n' + SRC + '\nreturn { KI, CMP, SM };')(undefined, undefined, SOBJ);
    const { KI, SM } = K;
    const ACC = path.join(__dirname, 'accuracy'); const DOM = JSON.parse(fs.readFileSync(path.join(ACC, 'ki_domains.json'), 'utf8')); const STG = JSON.parse(fs.readFileSync(path.join(ACC, 'ki_stage.json'), 'utf8'));
    const PAR = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'ki_parity.json'), 'utf8'));
    const T = DOM.clients['techand.ai'], V = DOM.clients['devaicon.com'];
    const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);
    const strip = (js) => js.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map(l => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');

    // ---- KI1 load, sandbox, words ----
    check('KI1 the kit loads after the kits it calls, in the n8n sandbox (no URL, no structuredClone, defineProperty a no-op), and says its rule version',
      KI && KI.VERSION === 'ki-1' && KI.CONFIG.rule_version === 'ki-1' && typeof KI.score === 'function', J(KI && KI.VERSION));
    const code = strip(SRC);
    check('KI1 pure and deterministic: no URL constructor, no clock, no random, no network, no table access in the kit\'s code',
      !/new URL\(|\bURL\(|Date\.now\(|new Date\(\)|Math\.random|\$\(|fetch\(|this\.helpers|\$input|\$json/.test(code), (code.match(/new URL\(|Date\.now\(|new Date\(\)|Math\.random|\$\(|fetch\(|this\.helpers/) || [''])[0]);
    check('KI1 the kit is plain ASCII (no em dashes, curly quotes or ellipsis characters anywhere in it)', /^[\x00-\x7f]*$/.test(SRC), (SRC.match(/[^\x00-\x7f]/) || [''])[0]);
    const exps = ['VERSION', 'CONFIG', 'norm', 'key', 'classifyDomain', 'scoreCompetitors', 'sizeTag', 'mergeCandidates', 'prescore', 'pageType', 'stage', 'cluster', 'demand', 'win', 'score', 'verdict', 'gaps', 'pageAction', 'plan', 'readable', 'label'];
    check('KI1 every function of CONTRACTS section 6 is exported', exps.every(k => KI[k] != null), J(exps.filter(k => KI[k] == null)));

    // ---- KI2 norm / key / services ----
    check('KI2 norm: lower case, punctuation and & to words, one space', KI.norm('  ERP & CRM  Software!! ') === 'erp and crm software' && KI.norm('Dynamics-365 (UAE)') === 'dynamics 365 uae', J([KI.norm('  ERP & CRM  Software!! '), KI.norm('Dynamics-365 (UAE)')]));
    check('KI2 key: close variants share one key (order, plural, stop words, "e invoicing" = "einvoicing", "&" = "and"), different searches do not',
      KI.key('E-invoicing in the UAE') === KI.key('uae einvoicing') && KI.key('erp & crm software') === KI.key('erp and crm softwares') && KI.key('erp software uae') === KI.key('uae erp software')
      && KI.key('erp software uae') !== KI.key('crm software uae') && KI.key('the') !== '', J([KI.key('E-invoicing in the UAE'), KI.key('uae einvoicing'), KI.key('erp & crm software')]));
    const s1 = KI.services('Microsoft Dynamics 365 consulting and implementation in the UAE and GCC: Business Central, F&O, and UAE e-invoicing (Peppol) and VAT compliance.');
    // FX-L B1 (REVIEW_LOGIC B1): a sentence becomes its clean service phrases - never a fragment ("GCC: Business"), never one 120-character "service"
    check('KI2 services (FX-L B1): a sentence becomes clean phrases: the product names and services in it, the market tail and "and" dropped, no fragment', J(s1) === J(['Microsoft Dynamics 365 consulting', 'Microsoft Dynamics 365 implementation', 'Business Central', 'F&O', 'e-invoicing', 'VAT compliance', 'Peppol']), J(s1));
    check('KI2 services: array items are cleaned the same way ("GP and AX migrations" -> both migrations), a JSON array string is parsed, a one-line short list is split, single letters are not services',
      J(KI.services(['NAV, GP and AX migrations', 'Power BI'])) === J(['NAV', 'GP migrations', 'AX migrations', 'Power BI']) && J(KI.services('["Open edX hosting","AI automation"]')) === J(['Open edX hosting', 'AI automation'])
      && J(KI.services('erp, crm, peppol e-invoicing')) === J(['erp', 'crm', 'peppol e-invoicing']) && J(KI.services('a\nb; c')) === J([]) && KI.services('').length === 0, J([KI.services(['NAV, GP and AX migrations', 'Power BI']), KI.services('a\nb; c')]));

    // ---- KI3 hosts and urls ----
    check('KI3 validHost: a registrable host survives (scheme, www, path, port dropped); text fragments, IP literals and single words do not',
      KI.validHost('https://www.Dynamicssquare.com/products/x?y=1') === 'dynamicssquare.com' && KI.validHost('AED 300k-450k') === '' && KI.validHost('AED 300k\u2013450k') === '' && KI.validHost('Phase 1') === ''
      && KI.validHost('10.0.0.1') === '' && KI.validHost('Milestones') === '' && KI.validHost('ravenlabs.com.au') === 'ravenlabs.com.au', J([KI.validHost('AED 300k-450k'), KI.validHost('10.0.0.1')]));
    const recovered = { domain: 'sqitconsulting.com', url: 'https://sqitconsulting.com/microsoft-dynamics-365', url_exact: false, url_recovered: 'breadcrumb', redirect_url: 'https://google.com/goto?url=CAES1' };
    const exact = { domain: 'www.sqitconsulting.com', url: 'https://www.sqitconsulting.com/microsoft-dynamics-365/' };
    check('KI3 urlKey: an approximate (recovered) url and the exact url of the same page share the key (host + path tokens); a partial one and a null domain have none',
      KI.urlKey(recovered) === KI.urlKey(exact) && KI.urlKey(exact) === 'sqitconsulting.com/microsoft-dynamics-365' && KI.urlKey({ ...recovered, url_partial: true }) === null
      && KI.urlKey({ domain: null, url: null, url_exact: false }) === null, J([KI.urlKey(recovered), KI.urlKey(exact)]));
    check('KI3 hostOf: a Google redirect still saying google.com is "host unknown" (never google.com), a recovered item gives its host, a null domain is skipped',
      KI.hostOf({ domain: 'google.com', url: 'https://google.com/goto?url=CAESXg' }) === null && KI.hostOf(recovered) === 'sqitconsulting.com' && KI.hostOf({ domain: null, url_exact: false }) === null
      && KI.hostOf({ domain: 'support.google.com', url: 'https://support.google.com/webmasters/answer/1' }) === 'support.google.com', '');

    // ---- KI4 classifyDomain ----
    const cd = (h, extra) => KI.classifyDomain(h, { ...T, ...(extra || {}) });
    const rej = ['google.com', 'www.google.ae', 'bing.com', 'AED 300k-450k', 'Phase 1', 'Testing', 'techand.ai', 'www.techand.ai'].map(h => cd(h));
    check('KI4 never stored: search engines, text fragments ("AED 300k-450k", "Phase 1", "Testing", R3 #9) and the site itself',
      rej.every(k => k.store === false && k.class === null) && rej[0].reject === 'search_engine' && rej[3].reject === 'fragment' && rej[6].reject === 'own_site', J(rej.map(k => [k.host, k.reject])));
    const dirs = ['clutch.co', 'goodfirms.co', 'g2.com', 'designrush.com', 'capterra.com', 'themanifest.com', 'topdevelopers.co'].map(h => cd(h).class);
    check('KI4 directories by name (Clutch, GoodFirms, G2, DesignRush, Capterra, The Manifest, TopDevelopers)', dirs.every(x => x === 'directory'), J(dirs));
    const pr = ['microsoft.com', 'learn.microsoft.com', 'community.dynamics.com', 'dynamics.microsoft.com'].map(h => cd(h));
    check('KI4 principals: the vendor of a product the client resells (microsoft.com, learn / community / dynamics subdomains for a Dynamics partner), from the services list',
      pr.every(k => k.class === 'principal' && k.basis === 'rule') && KI.classifyDomain('openedx.org', V).class === 'principal' && KI.classifyDomain('openedx.org', { ...T }).class !== 'principal', J(pr.map(k => k.class)));
    const misc = { 'indeed.com': 'job_board', 'naukrigulf.com': 'job_board', 'tax.gov.ae': 'government', 'centralbank.ae': 'government', 'dmcc.ae': 'government', 'khaleejtimes.com': 'media', 'erpresearch.com': 'media',
      'youtube.com': 'platform', 'en.wikipedia.org': 'platform', 'reddit.com': 'platform', 'linkedin.com': 'platform', 'quora.com': 'platform', 'sap.com': 'platform', 'zapier.com': 'platform' };
    const mg = Object.fromEntries(Object.keys(misc).map(h => [h, cd(h).class]));
    check('KI4 job boards, government / regulators, media, platforms and other vendors by rule', Object.entries(misc).every(([h, c]) => mg[h] === c), J(Object.entries(misc).filter(([h, c]) => mg[h] !== c).map(([h]) => [h, mg[h]])));
    check('KI4 a partner on a country domain whose name contains a vendor word is a business, not the platform (dynamics.ae is DBS, a UAE partner)',
      ['direct', 'adjacent'].includes(cd('dynamics.ae', { appearances: [{ keyword: 'ms 365 erp', position: 1, type: 'provider' }] }).class), J(cd('dynamics.ae', { appearances: [{ keyword: 'ms 365 erp', position: 1, type: 'provider' }] })));
    const dec = cd('acme-dynamics.com', { declared: ['acme-dynamics.com'] }), usr = cd('randgroup.com', { user: { 'randgroup.com': 'adjacent' } });
    const llm1 = cd('unknownfirm.com', { llm: { class: 'adjacent', confidence: 0.5 } }), nollm = cd('unknownfirm.com');
    check('KI4 bases: declared -> direct (declared), the user\'s class is final (user), an LLM answer only when passed (llm, < 0.6 = needs review), otherwise rule / page',
      dec.class === 'direct' && dec.basis === 'declared' && usr.class === 'adjacent' && usr.basis === 'user' && llm1.basis === 'llm' && llm1.needs_review === true && nollm.basis !== 'llm',
      J([dec.basis, usr.basis, llm1, nollm.basis]));
    const geo = cd('ravenlabs.com.au', { appearances: [{ keyword: 'ms 365 erp', position: 4, type: 'guide' }] }), lst = cd('listsite.com', { appearances: [{ keyword: 'crm service provider in uae', position: 3, type: 'list' }, { keyword: 'erp software uae', position: 2, type: 'list' }] });
    check('KI4 page signals: another market\'s ccTLD -> adjacent; a business whose every result read is a list -> publisher_list', geo.class === 'adjacent' && lst.class === 'publisher_list', J([geo, lst]));

    // ---- KI5 pageType ----
    const pt = (o) => KI.pageType(o, T);
    const ptc = [
      [{ domain: 'www.youtube.com', url: 'https://www.youtube.com/watch?v=x', title: 'Dynamics 365 overview' }, 'video'],
      [{ domain: 'www.goodfirms.co', url: 'https://www.goodfirms.co/implementation-services/crm-consulting/dubai', title: 'Top CRM Companies in Dubai - 2026 Reviews' }, 'list'],
      [{ domain: 'clutch.co', url: 'https://clutch.co/pk/developers/artificial-intelligence', title: 'Artificial Intelligence developers' }, 'directory'],
      [{ domain: 'www.bayzat.com', url: 'https://www.bayzat.com/blog/crm-softwares-dubai/', title: '10 Best CRM Softwares in Dubai, UAE' }, 'list'],
      [{ domain: 'www.visionet.com', url: 'https://www.visionet.com/article/what-is-a-microsoft-dynamics-365-erp', title: 'A guide to what a Microsoft Dynamics 365 ERP system is' }, 'guide'],
      [{ domain: 'www.intwo.cloud', url: 'https://www.intwo.cloud/microsoft-dynamics-erp/', title: 'Microsoft Dynamics 365 ERP Implementation Services - Intwo' }, 'provider'],
      [{ domain: 'learn.microsoft.com', url: 'https://learn.microsoft.com/en-us/dynamics365/finance/', title: 'Dynamics 365 Finance documentation' }, 'vendor'],
      [{ domain: 'www.hubspot.com', url: 'https://www.hubspot.com/products/crm', title: 'Free CRM Software' }, 'vendor'],
      [{ domain: 'www.reddit.com', url: 'https://www.reddit.com/r/Dynamics365/comments/x', title: 'Switching to D365' }, 'forum'],
      [{ domain: 'ae.indeed.com', url: 'https://ae.indeed.com/q-dynamics-365-jobs.html', title: 'Dynamics 365 Jobs in Dubai' }, 'job_board'],
      [{ domain: 'tax.gov.ae', url: 'https://tax.gov.ae/en/e-invoicing', title: 'E-invoicing' }, 'government'],
      [{ domain: 'www.khaleejtimes.com', url: 'https://www.khaleejtimes.com/business/e-invoicing-uae', title: 'UAE e-invoicing rollout' }, 'news'],
      [{ domain: 'dynamics.ae', url: 'https://dynamics.ae/', title: 'DBS' }, 'provider'],
    ];
    const ptg = ptc.map(([o, w]) => [w, pt(o)]);
    check('KI5 pageType: video, publisher list (by title, wherever published), directory, guide, provider service page, vendor product page, forum, job board, government, news',
      ptg.every(([w, g]) => w === g), J(ptg.filter(([w, g]) => w !== g)));
    check('KI5 pageType: no host -> null (a goto item still on google.com, a null domain); KI.PAGE_TYPES is the vocabulary',
      pt({ domain: 'google.com', url: 'https://google.com/goto?url=x', title: 'x' }) === null && pt({ domain: null, url: null, url_exact: false }) === null && KI.PAGE_TYPES.includes('list'), '');

    // ---- KI6 stage ----
    const hireTop = ['provider', 'provider', 'provider', 'directory', 'provider', 'provider', 'directory', 'list', 'provider', 'provider'].map((t, i) => ({ type: t, pos: i + 1 }));
    const s6 = KI.stage(hireTop, 'dynamics 365 partner uae', null, T);
    check('KI6 stage from what ranks: 7 company service pages, 2 directories, 1 list -> people looking to hire, with the evidence in plain words',
      s6.stage === 'hire' && s6.intent === 'commercial' && /10 results read: 7 company service pages, 2 directories, 1 list -> people looking to hire/.test(s6.evidence) && !s6.needs_review && s6.by === 'serp', J(s6));
    const listTop = Array.from({ length: 10 }, (_, i) => ({ type: i < 6 ? 'list' : 'provider', pos: i + 1 }));
    const guideTop = Array.from({ length: 10 }, (_, i) => ({ type: i < 8 ? 'guide' : 'provider', pos: i + 1 }));
    const st6 = [KI.stage(listTop, 'erp software uae', null, T).stage, KI.stage(guideTop, 'ai in industrial automation', null, V).stage, KI.stage(guideTop, 'erp integration', null, T),
      KI.stage([], 'what is erp', null, T).stage, KI.stage([], 'best erp software dubai', null, T).stage, KI.stage([], 'e-invoicing deadline uae', null, T).stage, KI.stage(hireTop, 'dynamics 365 pricing', null, T).stage];
    check('KI6 lists -> compare; guides -> info, or solution when a product is named (intent informational); strong words override what ranks (what is / best / deadline / pricing)',
      st6[0] === 'compare' && st6[1] === 'info' && st6[2].stage === 'solution' && st6[2].intent === 'informational' && st6[3] === 'info' && st6[4] === 'compare' && st6[5] === 'problem' && st6[6] === 'compare', J(st6));
    const lb = [KI.stage([], 'zzqx', 'commercial', T), KI.stage([], 'zzqx', { label: 'informational', probability: 0.5 }, T), KI.stage([], 'zzqx', null, T), KI.stage([], 'portal login zzqx', 'navigational', T)];
    check('KI6 the provider\'s intent label is the last signal (under 0.65 it is unsure and asks for review); no evidence -> info with needs_review; navigational kept',
      lb[0].stage === 'solution' && lb[0].by === 'labs' && lb[1].needs_review === true && lb[2].stage === 'info' && lb[2].needs_review === true && lb[2].by === 'default' && lb[3].intent === 'navigational', J(lb.map(x => [x.stage, x.by, x.confidence, x.intent])));
    check('KI6 stage weights are the config\'s (hire 1.00, compare 0.90, solution 0.65, problem 0.50, info 0.30)',
      J(KI.CONFIG.stage_weights) === J({ hire: 1, compare: 0.9, solution: 0.65, problem: 0.5, info: 0.3 }), J(KI.CONFIG.stage_weights));

    // ---- KI7 gate ----
    const g7 = { jobs: KI.gate('dynamics 365 jobs dubai', T), pk: KI.gate('ai automation services pakistan', V), partner: KI.gate('business central partner abu dhabi', T),
      brand: KI.gate('cleartax pricing', { ...T, competitors: ['cleartax.com'] }), gov: KI.gate('emirates id status', T), avoid: KI.gate('crm for customers', { ...T, avoid: ['crm for customers'] }),
      erp: KI.gate('erp software uae', T), uae: KI.gate('software development company in uae', V), dubai: KI.gate('custom software development company dubai', V) };
    check('KI7 gate: jobs -> career, another country -> other_market, a competitor\'s brand -> other_brand, a public body -> government, a stored AVOID -> avoid (each with its words)',
      g7.jobs.reason === 'career' && g7.pk.reason === 'other_market' && g7.brand.reason === 'other_brand' && g7.gov.reason === 'government' && g7.avoid.reason === 'avoid'
      && [g7.jobs, g7.pk, g7.brand, g7.gov, g7.avoid].every(g => g.gate === 'fail' && g.text && /^[\x20-\x7e]*$/.test(g.text + g.detail)), J(g7));
    check('KI7 gate passes the money searches: "business central partner abu dhabi", "erp software uae" for techand (R3: never off-service), UAE searches for devaicon (R3 F1: measured in the UAE)',
      g7.partner.gate === 'pass' && g7.erp.gate === 'pass' && g7.uae.gate === 'pass' && g7.dubai.gate === 'pass', J([g7.partner, g7.erp, g7.uae, g7.dubai]));
    check('KI7 the gate fails closed without the fit-gate kit', (() => { const K2 = new Function('URL', 'structuredClone', 'Object', SRC + '\nreturn KI;')(undefined, undefined, SOBJ); const g = K2.gate('erp software uae', T); return g.gate === 'fail'; })(), '');

    // ---- KI8 fit ----
    const f8 = [KI.fit('business central partner abu dhabi', T), KI.fit('crm for customers', T), KI.fit('erp software', T), KI.fit('open edx hosting', V), KI.fit('zzqx', { own_domain: 'x.com', market: 'AE', services: [] })];
    check('KI8 fit: the service phrase in the market is 1; a partial match is lower; no place in a one-market site x0.9; nothing on file -> the modelled middle, flagged; always 0..1 with a range',
      f8[0].fit === 1 && f8[1].fit < f8[0].fit && near(f8[2].fit, 0.9, 0.11) && f8[3].fit >= 0.8 && near(f8[4].fit, 0.5 * KI.CONFIG.fit_no_place, 0.001) && f8[4].unknown === true && f8.every(f => f.low <= f.fit && f.fit <= f.high && f.high <= 1 && f.low >= 0), J(f8));

    // ---- KI9 mergeCandidates ----
    const mc = KI.mergeCandidates({ labs_ideas: [{ keyword: 'ERP Software UAE', search_volume: 480, cpc: 13.98, keyword_difficulty: 3 }, { keyword: 'erp system dubai', search_volume: 320 }],
      labs_related: ['uae erp software'], gsc: [{ query: 'erp software uae', impressions: 40, clicks: 1, position: 31.2, page: 'https://www.techand.ai/x' }],
      autocomplete: ['erp software in uae'], seed: ['erp software uae'], nonsense: ['x'] });
    const e9 = mc.find(r => r.kw_key === KI.key('erp software uae'));
    check('KI9 merge: close variants become one row with every source (fetched, deduped), provider volume / CPC / KD kept with its basis, Search Console fields from gsc only',
      mc.length === 2 && e9 && e9.source_count === 5 && e9.volume === 480 && e9.volume_basis === 'provider_estimate' && e9.cpc === 13.98 && e9.kd === 3 && e9.gsc_impressions === 40 && e9.gsc_position === 31.2
      && J(e9.families.slice().sort()) === J(['autocomplete', 'gsc', 'labs']) && e9.keyword === 'erp software uae', J(e9));
    check('KI9 merge is deterministic (sorted by kw_key; any source order gives the same rows) and ignores unknown sources',
      J(KI.mergeCandidates([{ source: 'gsc', rows: [{ query: 'b c', impressions: 3 }] }, { source: 'paa', rows: ['a b'] }])) === J(KI.mergeCandidates([{ source: 'paa', rows: ['a b'] }, { source: 'gsc', rows: [{ query: 'b c', impressions: 3 }] }])) && !mc.some(r => r.sources.some(s => s.source === 'nonsense')), '');

    // ---- KI10 prescore ----
    const p10 = [KI.prescore({ keyword: 'erp software uae', fit: 1, stage: 'compare', volume: 100, families: ['labs'] }), KI.prescore({ keyword: 'erp software uae', fit: 0.4, stage: 'compare', volume: 100, families: ['labs'] }),
      KI.prescore({ keyword: 'x', gate: 'fail', fit: 1, volume: 9999 }), KI.prescore({ keyword: 'business central partner abu dhabi', fit: 1, stage: 'hire', volume: null, gsc_impressions: 12, families: ['gsc', 'paa'] })];
    check('KI10 prescore has fit in it (R1 #4): the same volume ranks lower with less fit; gated = 0; a measured low-volume buyer search is not cut', p10[0] > p10[1] && p10[2] === 0 && p10[3] > p10[1], J(p10));

    // ---- KI11 cluster ----
    const U = (h, n) => Array.from({ length: n }, (_, i) => ({ url: 'https://' + h + '/p' + i, pos: i + 1 }));
    const same = U('a.com', 10);
    const rowsC = [
      { keyword: 'erp software uae', volume: 480, top10: same }, { keyword: 'erp software in uae', volume: 90, top10: same.map(x => ({ ...x, url: x.url.replace('https://', 'https://www.') + '/' })) },
      { keyword: 'erp uae', volume: 300, top10: [...U('a.com', 3), ...U('z.com', 7)] }, { keyword: 'zero overlap', volume: 1000, top10: U('q.com', 10) },
      { keyword: 'hub two', volume: 50, top10: [...U('a.com', 2), ...U('w.com', 8)] }, { keyword: 'thin', volume: 5, top10: U('a.com', 2) } ];
    const c11 = KI.cluster(rowsC);
    const by = Object.fromEntries(c11.map(r => [r.keyword, r]));
    check('KI11 identical top 10 (written with and without www / slash) are one cluster; 3 shared joins at T_page; zero shared is never merged; 2 shared is a hub link, not a merge',
      by['erp software in uae'].cluster_id === by['erp software uae'].cluster_id && by['erp uae'].cluster_id === by['erp software uae'].cluster_id && by['zero overlap'].cluster_id !== by['erp software uae'].cluster_id
      && by['hub two'].cluster_id !== by['erp software uae'].cluster_id && by['hub two'].hub_id === by['erp software uae'].cluster_id && by['erp uae'].borderline === true, J(c11.map(r => [r.keyword, r.cluster_id, r.is_head, r.hub_id, r.shared_with_head])));
    check('KI11 the head is the strongest by click demand; sizes and cluster demand add up; a row with too few known results is its own head, never compared',
      by['erp software uae'].is_head && !by['erp uae'].is_head && by['erp software uae'].cluster_size === 3 && by['thin'].is_head && by['thin'].compared === false && by['zero overlap'].cluster_size === 1, J(by['erp software uae']));
    // no chaining: B shares 3 with head A, C shares 3 with B and 0 with A -> C is NOT in A's cluster
    const chain = KI.cluster([{ keyword: 'aaa', volume: 900, top10: [...U('x.com', 3), ...U('a.com', 7)] }, { keyword: 'bbb', volume: 500, top10: [...U('x.com', 3), ...U('y.com', 3), ...U('b.com', 4)] },
      { keyword: 'ccc', volume: 100, top10: [...U('y.com', 3), ...U('c.com', 7)] }]);
    check('KI11 no chaining: a member never recruits (C shares 3 with member B and 0 with head A -> its own cluster)', chain[1].cluster_id === chain[0].cluster_id && chain[2].cluster_id !== chain[0].cluster_id, J(chain.map(r => [r.keyword, r.cluster_id])));
    // determinism: every permutation gives the same ids per keyword; identical lists are never split whatever the order
    const perms = [[0, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 0], [3, 1, 5, 0, 2, 4], [2, 0, 4, 1, 5, 3]];
    const ids = perms.map(p => J(Object.fromEntries(KI.cluster(p.map(i => rowsC[i])).map(r => [r.keyword, r.cluster_id])).toString()));
    const sortedIds = perms.map(p => { const o = Object.fromEntries(KI.cluster(p.map(i => rowsC[i])).map(r => [r.keyword, r.cluster_id])); return J(Object.keys(o).sort().map(k => o[k])); });
    check('KI11 deterministic: four input orders give the same cluster id for every keyword', new Set(sortedIds).size === 1, J(sortedIds));
    let split = 0; for (let n = 0; n < 40; n++) { const base = U('s' + n + '.com', 10); const tw = [{ keyword: 'k' + n + ' a', volume: (n * 7) % 13, top10: base }, { keyword: 'k' + n + ' b', volume: (n * 5) % 11, top10: base.slice().reverse() },
      { keyword: 'k' + n + ' c', volume: 100, top10: [...base.slice(0, 3), ...U('o' + n + '.com', 7)] }]; const r = KI.cluster(n % 2 ? tw : tw.slice().reverse()); if (r.find(x => / a$/.test(x.keyword)).cluster_id !== r.find(x => / b$/.test(x.keyword)).cluster_id) split++; }
    check('KI11 owner acceptance over 40 generated cases: identical top 10s are never split (any order, any demand, a third keyword sharing 3 with them)', split === 0, split + ' split');
    let merged = 0; for (let n = 0; n < 40; n++) { const r = KI.cluster([{ keyword: 'm' + n, volume: n, top10: U('m' + n + '.com', 10) }, { keyword: 'n' + n, volume: 40 - n, top10: U('n' + n + '.com', 10) }]); if (r[0].cluster_id === r[1].cluster_id) merged++; }
    check('KI11 owner acceptance over 40 generated cases: zero shared results are never merged', merged === 0, merged + ' merged');
    const t4 = KI.cluster(rowsC, KI.cfg({ cluster: { t_page: 4 } }));
    check('KI11 the threshold is config (T_page 4: the 3-shared keyword becomes its own head)', t4.find(r => r.keyword === 'erp uae').is_head === true, J(t4.map(r => [r.keyword, r.is_head])));
    const rec = KI.cluster([{ keyword: 'r1', volume: 10, top10: [recovered, { domain: 'b.com', url: 'https://b.com/x', url_exact: false }, { domain: 'c.com', url: 'https://c.com/y' }, { domain: null, url: null, url_exact: false }] },
      { keyword: 'r2', volume: 5, top10: [exact, { domain: 'b.com', url: 'https://www.b.com/x/' }, { domain: 'c.com', url: 'https://c.com/y?ref=1' }] },
      { keyword: 'r3', volume: 4, top10: [{ domain: 'b.com', url: 'https://b.com/', url_exact: false, url_partial: true }, { domain: 'c.com', url: 'https://c.com/', url_exact: false, url_partial: true }, { domain: 'd.com', url: 'https://d.com/z' }, { domain: 'sqitconsulting.com', url: 'https://sqitconsulting.com/', url_exact: false, url_partial: true }] }]);
    check('KI11 recovered hosts (SERP-goto): an approximate url clusters with the same page read exactly; partial urls and null domains are never counted as shared',
      rec[1].cluster_id === rec[0].cluster_id && rec[2].cluster_id !== rec[0].cluster_id && rec[2].compared === false, J(rec.map(r => [r.keyword, r.cluster_id, r.compared])));

    // ---- KI12 demand ----
    const d12 = [KI.demand([{ volume: 100, stage: 'hire' }]), KI.demand([{ volume: 100, gsc_impressions: 280, stage: 'hire' }]), KI.demand([{ volume: null, sources: [{ source: 'gsc' }, { source: 'paa' }] }]),
      KI.demand([{ volume: null, sources: [{ source: 'labs_ideas' }, { source: 'labs_related' }, { source: 'labs_suggestions' }] }]), KI.demand([{ volume: 1000, stage: 'info', aio: true }]), KI.demand([{ volume: 1000, stage: 'info', aio: false }]),
      KI.demand([{ volume: 10, stage: 'hire' }]), KI.demand([{ volume: 1000, stage: 'hire' }])];
    check('KI12 demand (FX-L H7): Search Console impressions beat provider volume on page 1-2; no volume + 2 independent sources -> a floor BELOW a measured 10 ("evidenced, volume not measured"); three Labs endpoints are ONE source',
      d12[1].clicks > d12[0].clicks && /Search Console/.test(d12[1].note) && d12[2].demand > 0 && d12[2].demand < d12[6].demand && d12[2].floor && /evidenced, volume not measured/.test(d12[2].note) && d12[3].demand === 0 && !d12[3].floor, J(d12.slice(0, 4)));
    check('KI12 demand: an AI answer on the page lowers it (stage loss), more volume never lowers it, always 0..1 with low <= demand <= high',
      d12[4].demand < d12[5].demand && d12[6].demand <= d12[0].demand && d12[0].demand <= d12[7].demand && d12.every(d => d.demand >= 0 && d.demand <= 1 && d.low <= d.demand + 1e-9 && d.demand <= d.high + 1e-9), J(d12.map(d => [d.demand, d.low, d.high])));

    // ---- KI13 win ----
    const w13 = (row, site) => KI.win({ keyword: 'dynamics ax dubai', stage: 'hire', ...row }, { domain: 'techand.ai', ...(site || {}) });
    const ranks = [w13({ gsc_position: 8.4 }).existing_rank, w13({ gsc_position: 14.7 }).existing_rank, w13({ gsc_position: 40 }).existing_rank, w13({}).existing_rank, w13({ gsc_position: 2.9 }).existing_rank];
    check('KI13 ExistingRank from Search Console first: 1.0 to #10, 0.8 to #20, 0.5 to #50, 0 none', J(ranks) === J([1, 0.8, 0.5, 0, 1]), J(ranks));
    const own = w13({ top10: [{ host: 'www.techand.ai', url: 'https://techand.ai/x', url_exact: false, pos: 6 }] });
    check('KI13 the client found on the results page by host only (a recovered url still counts)', own.position === 6 && own.existing_rank === 1, J(own));
    const best = w13({ topical: 1, top10: Array.from({ length: 10 }, (_, i) => ({ host: 'f' + i + '.com', type: 'forum', pos: i + 1 })) });
    check('KI13 with no ranking and an unmeasured strength the Win can never reach Go (max 0.575 < 0.60), and says the strength is not measured', best.win < 0.6 && best.strength_known === false && /not measured/.test(best.parts.join(' ')), J(best));
    const sA = w13({}, { refdomains: 100 }), sB = w13({ top10_refdomains_median: 10 }, { refdomains: 100 }), sC = w13({ top10_refdomains_median: 1000 }, { refdomains: 100 });
    check('KI13 Strength: 10x the median of the top 10 -> 1, a tenth -> 0 (log ratio), unknown -> 0.5 with a wide range', near(sB.strength, 1, 0.03) && near(sC.strength, 0, 0.03) && near(sA.strength, 0.5) && sA.high - sA.low > sB.high - sB.low - 1e-9, J([sA.strength, sB.strength, sC.strength]));
    const wsH = w13({ top10: [{ host: 'r.com', type: 'forum', pos: 1 }, { host: 'p.com', type: 'provider', pos: 2 }] }).weak_spots, wsI = KI.win({ keyword: 'what is erp', stage: 'info', top10: [{ host: 'r.com', type: 'forum', pos: 1 }, { host: 'g.com', type: 'guide', pos: 2 }] }, {}).weak_spots;
    check('KI13 WeakSpots: a forum result is a weak spot for a hire / compare search, not for an informational one; off-intent pages count', wsH === 0.5 && wsI === 0.5, J([wsH, wsI]));
    const tq = KI.win({ keyword: 'dynamics ax dubai' }, { queries: [{ query: 'microsoft dynamics ax dubai', impressions: 30, position: 14 }, { query: 'dynamics ax abu dhabi', impressions: 5, position: 13 }, { query: 'peppol uae', impressions: 99, position: 20 }] });
    check('KI13 Topical: the site\'s own ranking queries on the topic (2 of the reference 5 = 0.4)', near(tq.topical, 0.4), J(tq));

    // ---- KI14 value / gap ----
    const v14 = [KI.value({ keyword: 'x', cpc: 15 }).value, KI.value({ keyword: 'x', cpc: 0 }).value, KI.value({ keyword: 'x' }), KI.value({ keyword: 'open edx hosting uae', cpc: 1 }, { service_values: { 'open edx hosting': 0.9 } })];
    check('KI14 Value: CPC on a log scale ($15 = 1), missing CPC = 0.5 modelled with a range, the owner\'s value for the service wins', near(v14[0], 1) && v14[1] === 0.5 && v14[2].value === 0.5 && v14[2].basis === 'modelled' && v14[3].value === 0.9 && v14[3].basis === 'measured', J(v14));
    const top14 = [{ host: 'randgroup.com', pos: 1 }, { host: 'www.velosio.com', pos: 3 }, { host: 'other.com', pos: 4 }, { domain: null, url_exact: false }];
    const g14 = [KI.gap({ top10: top14 }, ['randgroup.com', 'velosio.com', 'dynamicssquare.com', 'intwo.cloud']), KI.gap({ top10: top14, ai_cited: ['intwo.cloud'] }, ['randgroup.com', 'velosio.com', 'dynamicssquare.com', 'intwo.cloud']), KI.gap({ top10: top14 }, [])];
    check('KI14 Gap: the share of the chosen competitors in the top 10 (2 of 4 = 0.5), +0.5 when one is cited in AI answers, 0 with no chosen set', g14[0].gap === 0.5 && g14[1].gap === 1 && g14[2].gap === 0, J(g14));

    // ---- KI15 score ----
    const partner = { gate: 'pass', fit: 1, stage: 'hire', demand: 0.15, win: 0.55, value: 0.8, gap: 0.6 };
    const ps = KI.score(partner), js = KI.score({ ...partner, gate: 'fail', gate_reason: 'career', demand: 1, win: 0.8, fit: 0.2 });
    check('KI15 the owner\'s example (R4 6.4): the jobs query is gated to 0 with its reason; the partner query (fit 1, hire, demand floor 0.15, win 0.55, value 0.8, gap 0.6) scores 43',
      js.score === 0 && js.low === 0 && js.high === 0 && js.reason === 'career' && Math.round(ps.score) === 43 && near(ps.score, 43.25, 0.06), J([ps, js]));
    const gj = KI.gate('dynamics 365 jobs dubai', T), gp = KI.gate('business central partner abu dhabi', T);
    check('KI15 ...and through the real gate on techand.ai: the jobs query fails (career), the partner query passes', gj.gate === 'fail' && KI.score({ ...partner, gate: gj.gate, gate_reason: gj.reason }).score === 0 && gp.gate === 'pass', J([gj, gp]));
    check('KI15 the formula: 100 x Gate x Fit x StageW x (0.40 D + 0.35 W + 0.15 V + 0.10 G)', near(KI.score({ gate: 'pass', fit: 0.8, stage: 'compare', demand: 0.5, win: 0.4, value: 0.3, gap: 0.2 }).score, r1(100 * 0.8 * 0.9 * (0.2 + 0.14 + 0.045 + 0.02)), 0.051), J(KI.score({ gate: 'pass', fit: 0.8, stage: 'compare', demand: 0.5, win: 0.4, value: 0.3, gap: 0.2 })));
    function r1(x) { return Math.round(x * 10) / 10; }
    let mono = 0, checks = 0; const grid = [0, 0.2, 0.36, 0.5, 0.7, 1];
    for (const f of ['fit', 'demand', 'win', 'value', 'gap']) for (const base of [{ fit: 0.6, demand: 0.3, win: 0.4, value: 0.5, gap: 0.2 }, { fit: 1, demand: 0.9, win: 0.9, value: 0.1, gap: 1 }, { fit: 0.4, demand: 0, win: 0, value: 0, gap: 0 }])
      for (const st of ['hire', 'compare', 'solution', 'problem', 'info']) { let prev = -1; for (const x of grid) { const s = KI.score({ gate: 'pass', stage: st, ...base, [f]: x }).score; checks++; if (s < prev - 1e-9) mono++; prev = s; } }
    const stOrder = ['info', 'problem', 'solution', 'compare', 'hire'].map(st => KI.score({ ...partner, stage: st }).score);
    check('KI15 monotone: non-decreasing in every factor (' + checks + ' grid points over fit / demand / win / value / gap x 5 stages) and in the stage weight', mono === 0 && stOrder.every((s, i) => i === 0 || s >= stOrder[i - 1]), mono + ' violations; ' + J(stOrder));
    const heavy = KI.cfg({ score_weights: { demand: 0.8, win: 0.1, value: 0.05, gap: 0.05 } });
    check('KI15 weights come from the config (a run\'s config_json changes the score; KI.cfg merges a JSON string too)',
      KI.score(partner, heavy).score !== ps.score && near(KI.score(partner, heavy).score, 100 * (0.8 * 0.15 + 0.1 * 0.55 + 0.05 * 0.8 + 0.05 * 0.6), 0.051) && KI.cfg('{"verdict":{"go":0.9}}').verdict.go === 0.9 && KI.cfg('{"verdict":{"go":0.9}}').verdict.months === 0.35, J(KI.score(partner, heavy)));
    check('KI15 range: low <= score <= high, rank by the midpoint, "low confidence" when the range is over 25 points; a Fit under 0.35 is gated (low_fit)',
      ps.low <= ps.score && ps.score <= ps.high && near(ps.mid, (ps.low + ps.high) / 2, 0.051) && typeof ps.low_confidence === 'boolean'
      && KI.score({ ...partner, demand: { demand: 0.5, low: 0.05, high: 1 }, value: { value: 0.5, low: 0, high: 1 } }).low_confidence === true && KI.score({ ...partner, fit: 0.3 }).score === 0 && KI.score({ ...partner, fit: 0.3 }).reason === 'low_fit', J(ps));

    // ---- KI16 verdict + parity ----
    check('KI16 verdict: every boundary case of the parity fixture', PAR.cases.every(c => KI.verdict(c.row) === c.verdict), J(PAR.cases.map(c => [c.name, KI.verdict(c.row)])));
    check('KI16 parity: rule version, verdict words, Win thresholds and stage weights equal the fixture the app tests against (app/shared/src/ki.parity.test.ts)',
      PAR.rule_version === KI.VERSION && J(PAR.verdicts) === J(KI.VERDICT_WORDS) && PAR.thresholds.go === KI.CONFIG.verdict.go && PAR.thresholds.months === KI.CONFIG.verdict.months && J(PAR.stage_weights) === J(KI.CONFIG.stage_weights), J(PAR));
    check('KI16 parity (E1 additions): score and Win weights, competitor weights, cluster thresholds, gate reasons and the score cases',
      J(PAR.score_weights) === J(KI.CONFIG.score_weights) && J(PAR.win_weights) === J(KI.CONFIG.win_weights) && J(PAR.comp_weights) === J(KI.CONFIG.comp_weights) && PAR.cluster.t_page === KI.CONFIG.cluster.t_page && PAR.cluster.t_hub === KI.CONFIG.cluster.t_hub
      && (PAR.score_cases || []).length >= 3 && PAR.score_cases.every(c => near(KI.score(c.row).score, c.score, 0.051)) && J(Object.keys(KI.GATE_TEXT).sort()) === J(PAR.gate_reasons.slice().sort()), J(PAR.score_cases && PAR.score_cases.map(c => KI.score(c.row).score)));

    // ---- KI17 scoreCompetitors ----
    const seeds = [
      { keyword: 'dynamics 365 partner uae', demand: 2, stage: 'hire', top10: [{ domain: 'www.randgroup.com', url: 'https://www.randgroup.com/a', pos: 1 }, { domain: 'clutch.co', url: 'https://clutch.co/x', pos: 2 }, { domain: 'google.com', url: 'https://google.com/goto?url=1', pos: 3 }, { domain: 'velosio.com', url: 'https://velosio.com/b', pos: 4 }, { domain: null, url_exact: false, pos: 5 }, { domain: 'www.techand.ai', url: 'https://techand.ai/', pos: 6 }] },
      { keyword: 'business central partner dubai', demand: 1, stage: 'hire', top10: [{ domain: 'velosio.com', url: 'https://velosio.com/c', pos: 1 }, { domain: 'youtube.com', url: 'https://youtube.com/watch?v=1', pos: 2 }, { domain: 'randgroup.com', url: 'https://randgroup.com/d', pos: 3 }] },
      { keyword: 'erp software uae', demand: 1, stage: 'compare', top10: [{ domain: 'goodfirms.co', url: 'https://goodfirms.co/z', pos: 1 }, { domain: 'velosio.com', url: 'https://velosio.com/e', pos: 2 }] } ];
    const sc = KI.scoreCompetitors([], seeds, { ...KI.cfg({}), ctx: T, client: { keywords: 40, refdomains: 30 } });
    const row = (d) => sc.find(r => r.comp_domain === d);
    const ctr = KI.CONFIG.ctr; const den = (2 * 1 + 1 * 1 + 1 * 0.9) * ctr[0];
    const ssRand = (2 * 1 * ctr[0] + 1 * 1 * ctr[2]) / den;
    check('KI17 SERPshare by hand: sum of demand x stage weight x CTR(position) over the max (randgroup ' + ssRand.toFixed(3) + ')', row('randgroup.com') && near(row('randgroup.com').serp_share, ssRand, 0.001), J(row('randgroup.com')));
    check('KI17 no row for google.com, the site itself or an item with no host; directories and platforms get rows but are not scored (tagged, never hidden)',
      !row('google.com') && !row('techand.ai') && sc.every(r => r.comp_domain) && row('clutch.co').class === 'directory' && row('clutch.co').scored === false && row('clutch.co').score === null && row('youtube.com').scored === false, J(sc.map(r => [r.comp_domain, r.class, r.scored])));
    check('KI17 a scored competitor: score with a range, reasons in plain words ("in the top 10 for 3 of 3 of your service searches"), evidence (seed, position, url), sorted scored first',
      row('velosio.com').scored && row('velosio.com').score_low <= row('velosio.com').score && row('velosio.com').score <= row('velosio.com').score_high && /in the top 10 for 3 of 3 of your service searches/.test(row('velosio.com').reasons[0])
      && row('velosio.com').evidence.length === 3 && sc[0].scored && sc.findIndex(r => !r.scored) > sc.findIndex(r => r.scored), J(row('velosio.com')));
    const cw = KI.scoreCompetitors([{ domain: 'velosio.com', class: 'direct', topic_sim: 1, geo_match: 1, ai_share: 1 }], seeds, KI.cfg({}))[0];
    check('KI17 Comp = 0.45 SERPshare + 0.20 TopicSim + 0.15 GeoMatch + 0.20 AIshare (x100)', near(cw.score, 45 * cw.serp_share + 20 + 15 + 20, 0.1), J(cw));
    const solo = KI.scoreCompetitors([{ domain: 'onlyonce.com', class: 'direct' }, { domain: 'mine.com', class: 'direct', declared: true }], [...seeds, { keyword: 'k4', top10: [{ domain: 'onlyonce.com', url: 'https://onlyonce.com/', pos: 1 }] }], KI.cfg({}));
    check('KI17 with 3+ seeds read a scored competitor must be seen on 2 (one appearance is a candidate, not scored); a declared one is kept and chosen', solo[0].comp_domain === 'mine.com' && solo[0].status === 'chosen' && solo.find(r => r.comp_domain === 'onlyonce.com').scored === false, J(solo));
    const sz = [KI.sizeTag({ keywords: 40, refdomains: 30 }, { keywords: 5000, refdomains: 900 }), KI.sizeTag({ keywords: 40, refdomains: 30 }, { keywords: 200, refdomains: 50 }), KI.sizeTag({ keywords: 40, refdomains: 30 }, { keywords: 50, refdomains: 25 }),
      KI.sizeTag({ keywords: 400, refdomains: 300 }, { keywords: 50, refdomains: 20 }), KI.sizeTag({}, {})];
    check('KI17 size is a TAG (out_of_reach > 20x keywords and > 10x referring domains, leader, peer, smaller, unknown), not a score input', J(sz) === J(['out_of_reach', 'leader', 'peer', 'smaller', 'unknown']), J(sz));
    check('KI17 deterministic: the same seeds in another order give the same rows', J(KI.scoreCompetitors([], seeds.slice().reverse(), { ...KI.cfg({}), ctx: T }).map(r => [r.comp_domain, r.score])) === J(sc.map(r => [r.comp_domain, r.score])), '');

    // ---- KI18 pageAction ----
    const listSerp = { keyword: 'crm service provider in uae', top10: ['list', 'list', 'directory', 'list', 'provider', 'list', 'vendor', 'list', 'provider', 'directory'].map((t, i) => ({ host: 'h' + i + '.com', type: t, pos: i + 1 })) };
    const pa = [KI.pageAction(listSerp, { domain: 'techand.ai', pages: [{ url: 'https://www.techand.ai/dynamics-365-crm-uae', title: 'CRM service provider in the UAE | Dynamics 365 CRM' }] }),
      KI.pageAction({ keyword: 'dynamics ax dubai', gsc_page: 'https://www.techand.ai/dynamics-ax-upgrade', top10: hireTop.map((x, i) => ({ ...x, host: 'p' + i + '.com' })) }, { domain: 'techand.ai' }),
      KI.pageAction({ keyword: 'dynamics 365 crm uae', top10: hireTop.map((x, i) => ({ ...x, host: 'p' + i + '.com' })) }, { domain: 'techand.ai', pages: [{ url: 'https://www.techand.ai/dynamics-365-crm-uae', title: '' }] }),
      KI.pageAction({ keyword: 'open edx hosting', top10: hireTop.map((x, i) => ({ ...x, host: 'p' + i + '.com' })) }, { domain: 'devaicon.com', pages: [] }),
      KI.pageAction({ keyword: 'x', members: [{ keyword: 'x', gsc_page: 'https://a.com/1' }, { keyword: 'x b', gsc_page: 'https://a.com/2' }] }, { domain: 'a.com' }),
      KI.pageAction({ keyword: 'x', gate: 'fail' }, {})];
    check('KI18 a results page that is >= 50% lists / directories gets the list action (R3 #5), even when the site has a page (kept in page_url)', pa[0].action === 'list' && pa[0].list_hosts.length === 7 && /dynamics-365-crm-uae/.test(pa[0].page_url), J(pa[0]));
    check('KI18 refresh when the site ranks (Search Console page) or has a matching page; new otherwise; two ranking pages = cannibalisation; gated = none',
      pa[1].action === 'refresh' && /dynamics-ax-upgrade/.test(pa[1].page_url) && pa[2].action === 'refresh' && /dynamics-365-crm-uae/.test(pa[2].page_url) && pa[3].action === 'new' && pa[4].cannibal.length === 2 && pa[5].action === 'none', J(pa.slice(1)));
    if (SM && SM.from) { const model = SM.from({ domain: 'techand.ai' }, { pages: [{ url: 'https://www.techand.ai/dynamics-365-cloud-migration-uae', title: 'Dynamics 365 Cloud Migration UAE', source: 'sitemap' }] });
      const pm = KI.pageAction({ keyword: 'dynamics 365 cloud migration uae', top10: hireTop.map((x, i) => ({ ...x, host: 'p' + i + '.com' })) }, { domain: 'techand.ai', model });
      check('KI18 with a site model the page match is the shared SM.matchPage', pm.action === 'refresh' && /cloud-migration/.test(pm.page_url), J(pm)); }

    // ---- KI19 striking ----
    const sk = [KI.striking({ gsc_position: 8.4, gsc_impressions: 120 }), KI.striking({ gsc_position: 21, gsc_impressions: 500 }), KI.striking({ gsc_position: 12, gsc_impressions: 40 }), KI.striking({ gsc_position: 12, gsc_impressions: 40 }, { total_impressions: 1200 }), KI.striking({ gsc_position: 5, gsc_impressions: 900 })];
    check('KI19 striking distance, one definition: Search Console 8-20 with >= 100 impressions in 28 days (>= 30 on a small site)', J(sk) === J([true, false, false, true, false]), J(sk));

    // ---- KI20 gaps ----
    const cl20 = { site_id: 'site_techand-ai', domain: 'techand.ai', market: 'AE-en', run_id: 'r1', now: '2026-11-08T00:00:00.000Z' };
    const ch20 = ['randgroup.com', 'velosio.com', 'intwo.cloud'];
    const kr = [
      { keyword: 'missing one', sources: [{ source: 'gap' }], top10: [{ host: 'randgroup.com', pos: 1 }, { host: 'velosio.com', pos: 4 }] },
      { keyword: 'untapped one', sources: [{ source: 'gap' }], top10: [{ host: 'intwo.cloud', pos: 2 }] },
      { keyword: 'weak one', gsc_position: 35, top10: [{ host: 'velosio.com', pos: 2 }], page_url: 'https://techand.ai/w' },
      { keyword: 'striking one', gsc_position: 9, gsc_impressions: 300, gsc_page: 'https://techand.ai/s', top10: [{ host: 'velosio.com', pos: 2 }] },
      { keyword: 'strong one', top10: [{ host: 'techand.ai', pos: 2 }, { host: 'randgroup.com', pos: 3 }] },
      { keyword: 'list one', sources: [{ source: 'gap' }], page_action: 'list', top10: [{ host: 'randgroup.com', pos: 1 }, { host: 'velosio.com', pos: 2 }] },
      { keyword: 'gated one', gate: 'fail', top10: [{ host: 'randgroup.com', pos: 1 }, { host: 'velosio.com', pos: 2 }] } ];
    const ex20 = { sample: { n: 300, m: 1240 }, listings: [{ domain: 'goodfirms.co', keyword: 'crm consulting dubai', lists_competitors: ['velosio.com'], lists_client: false }],
      backlinks: [{ domain: 'peppol.org', links_to: ['randgroup.com', 'velosio.com'], links_client: false }, { domain: 'one.com', links_to: ['randgroup.com'], links_client: false }],
      ai_answers: [{ question: 'Who is the best Dynamics partner in Dubai?', keyword: 'best dynamics partner dubai', competitors: ['intwo.cloud'], client_named: false }],
      topics: [{ keyword: 'dynamics ax upgrade', competitor_pages: 2, client_page: false, competitors: ['randgroup.com', 'velosio.com'] }], page_types: [{ service: 'business central', type: 'pricing', competitors: ['velosio.com'], client_has: false }] };
    const gp20 = KI.gaps(cl20, ch20, kr, ex20); const gt = Object.fromEntries(gp20.map(g => [g.keyword || g.action_target, g]));
    check('KI20 keyword gaps against the chosen set: missing (2+ in top 10, client absent), untapped (1), weak (client 11-100), striking, strong (defend); a gated row has none',
      gt['missing one'].type === 'missing' && gt['untapped one'].type === 'untapped' && gt['weak one'].type === 'weak' && gt['weak one'].action === 'refresh' && gt['striking one'].type === 'striking' && gt['striking one'].action === 'refresh'
      && gt['strong one'].type === 'strong' && gt['strong one'].action === 'defend' && !gt['gated one'] && gt['list one'].action === 'list', J(gp20.map(g => [g.type, g.keyword, g.action])));
    check('KI20 beyond keywords: listing, backlink (2+ competitors only), ai_answer, topic, page_type; each with its action and credits',
      gp20.some(g => g.type === 'listing' && g.action === 'list' && g.action_target === 'goodfirms.co') && gp20.filter(g => g.type === 'backlink').length === 1 && gp20.some(g => g.type === 'ai_answer' && g.action === 'pitch')
      && gp20.some(g => g.type === 'topic' && g.action === 'new_page' && g.credits === 114) && gp20.some(g => g.type === 'page_type' && g.action_target === 'pricing'), J(gp20.map(g => [g.type, g.action, g.credits])));
    check('KI20 stored shape: the contract columns, JSON columns as strings, "sample of 300 of 1240" when capped, deterministic ids',
      gp20.every(g => J(Object.keys(g)) === J(['gap_id', 'site_id', 'domain', 'market', 'type', 'keyword', 'cluster_id', 'competitor_domains_json', 'client_position', 'evidence_json', 'sample_note', 'action', 'action_target', 'credits', 'status', 'run_id', 'created_at', 'updated_at'])
        && typeof g.competitor_domains_json === 'string' && typeof g.evidence_json === 'string' && g.status === 'open') && gt['missing one'].sample_note === 'sample of 300 of 1240' && J(KI.gaps(cl20, ch20, kr.slice().reverse(), ex20)) === J(gp20), J(gp20[0]));

    // FX-L H6: an unknown client position is "not read", never "not in the top 100": no missing / untapped row, counted apart; a page read with
    // the client absent counts only when the site's Search Console reading is complete and has no row for the search
    const kr6 = [{ keyword: 'unread one', top10: [{ host: 'randgroup.com', pos: 3 }, { host: 'velosio.com', pos: 7 }] }, { keyword: 'read absent', serp_read: true, top10: [{ host: 'randgroup.com', pos: 3 }, { host: 'velosio.com', pos: 7 }] }];
    const g6a = KI.gaps(cl20, ch20, kr6, {}), g6b = KI.gaps({ ...cl20, gsc_complete: true }, ch20, kr6, {});
    check('KI20 (FX-L H6): an unknown client position makes no "missing" gap and is counted as not read; with a complete Search Console reading a read results page without the client is "missing"',
      g6a.length === 0 && KI.gapsUnread(cl20, ch20, kr6) === 2 && g6b.length === 1 && g6b[0].type === 'missing' && g6b[0].keyword === 'read absent' && g6b[0].sample_note === '', J([g6a, g6b.map(g => [g.type, g.keyword])]));
    check('KI20 (FX-L L7): "sample of N of M" is on the intersection rows only, never on a striking or weak row', gt['striking one'].sample_note === '' && gt['weak one'].sample_note === '' && gt['untapped one'].sample_note === 'sample of 300 of 1240', J([gt['striking one'].sample_note, gt['untapped one'].sample_note]));

    // ---- KI21 plan ----
    const heads = Array.from({ length: 14 }, (_, i) => ({ keyword: 'service ' + i + ' dubai', cluster_id: 'c' + i, score: { score: 20 + i * 3, low: 10 + i * 3, high: 30 + i * 3, mid: 20 + i * 3 }, verdict: i % 3 ? 'months' : 'go', stage: 'hire', page_action: i % 4 === 0 ? 'refresh' : 'new', page_url: i % 4 === 0 ? 'https://techand.ai/s' + i : '', cluster_size: 1 + (i % 3) }))
      .concat([{ keyword: 'gated', cluster_id: 'cg', score: 99, verdict: 'gated', page_action: 'new' }, { keyword: 'dynamics ax dubai', cluster_id: 'cs', score: { score: 30, low: 20, high: 40, mid: 30 }, verdict: 'months', stage: 'hire', page_action: 'refresh', page_url: 'https://techand.ai/ax', gsc_position: 8.4, gsc_impressions: 120, striking: true }]);
    const pl = KI.plan(heads, gp20);
    check('KI21 plan: at most 10 actions, ranked by expected value, never a gated row, each with kind, title, why, target and credits (a new page = 114 credits, the app\'s rate)',
      pl.length === 10 && pl.every((a, i) => i === 0 || a.ev <= pl[i - 1].ev) && !pl.some(a => /gated/.test(a.title)) && pl.every(a => a.action_id && a.kind && a.title && a.why && 'target' in a && typeof a.credits === 'number')
      && pl.filter(a => a.kind === 'new_page').every(a => a.credits === 114), J(pl.map(a => [a.kind, a.ev, a.title])));
    check('KI21 plain words: ASCII only, no em dash, no curly quotes, no ellipsis character; the why says position, stage and verdict',
      pl.every(a => /^[\x20-\x7e]*$/.test(a.title + a.why + a.target)) && pl.some(a => /position 8 in your Search Console/.test(a.why) && /people searching it are looking to hire/.test(a.why) && /verdict: Takes a few months/.test(a.why)), J(pl.map(a => a.why).slice(0, 3)));
    check('KI21 deterministic (same plan from shuffled inputs) and the cap is config', J(KI.plan(heads.slice().reverse(), gp20.slice().reverse())) === J(pl) && KI.plan(heads, gp20, KI.cfg({ caps: { plan: 3 } })).length === 3, '');

    // ---- KI22 readable + label ----
    const kwRow = { keyword: 'erp software uae', gate: 'pass' };
    const rd22 = [KI.readable(kwRow, { killed: false, mode: 'on' }), KI.readable(kwRow, { mode: 'on' }), KI.readable(kwRow, { killed: true, mode: 'on' }), KI.readable(kwRow, { killed: false, mode: 'trial' }), KI.readable(kwRow, { killed: false, mode: '' }),
      KI.readable({ ...kwRow, gate: 'fail' }, { killed: false, mode: 'on' }), KI.readable({ keyword: 'dynamics 365 jobs dubai', gate: 'pass' }, { killed: false, mode: 'on', fit: T }), KI.readable({ gate: '' }, { killed: false, mode: 'on' }),
      KI.readable({ comp_domain: 'randgroup.com', class: 'direct', status: 'chosen' }, { killed: false, mode: 'on' }), KI.readable({ comp_domain: 'google.com', class: 'direct' }, { killed: false, mode: 'on' }),
      KI.readable({ comp_domain: 'AED 300k-450k', class: 'direct' }, { killed: false, mode: 'on' }), KI.readable({ comp_domain: 'x.com', class: 'direct', status: 'dismissed' }, { killed: false, mode: 'on' }), KI.readable(kwRow, undefined)];
    check('KI22 readable fails closed: only On, only with the kill switch read as off; a gated row, a row the gate refuses on re-read, google.com, a fragment or a dismissed competitor is never read',
      J(rd22) === J([true, false, false, false, false, false, false, false, true, false, false, false, false]), J(rd22));
    const lab = [KI.label('measured', '', '2026-11-02T10:00:00Z'), KI.label('provider_estimate', 'DataForSEO Labs', '2026-11-08'), KI.label('modelled'), KI.label('inferred'), KI.label('guess')];
    check('KI22 label: the four bases with the app\'s words (measured + date, estimate from <source> + date, our estimate, our reading of the results); anything else "not available"',
      lab[0].text === 'measured on 2026-11-02' && lab[1].text === 'estimate from DataForSEO Labs on 2026-11-08' && lab[2].text === 'our estimate' && lab[3].text === 'our reading of the results' && lab[4].basis === 'none' && lab[4].text === 'not available', J(lab));

    // ---- KI23 accuracy sets ----
    // FX-L B2: the negative cases (a travel agency, a home automation shop, a web agency on a service results page) are never "direct"
    const negs = DOM.cases.filter(c => c.fxl_negative).map(c => [c.host, KI.classifyDomain(c.host, { ...DOM.clients[c.client], appearances: c.appearances }).class]);
    check('KI23 (FX-L B2) a business that ranks on a service search but sells something else is never "direct" (its own titles decide, never the search)', negs.length >= 3 && negs.every(([, k]) => k !== 'direct'), J(negs));
    const acc = (set, f) => { const r = { train: [0, 0], hold: [0, 0], miss: [] }; for (const c of set.cases) { const ok = f(c); const b = c.holdout ? r.hold : r.train; b[1]++; if (ok.ok) b[0]++; else r.miss.push((c.holdout ? 'HOLD ' : '') + ok.msg); } return r; };
    const ad = acc(DOM, (c) => { const k = KI.classifyDomain(c.host, { ...DOM.clients[c.client], appearances: c.appearances }); const got = k.store ? k.class : 'reject'; return { ok: got === c.class, msg: c.client + ' ' + c.host + ' ' + c.class + '->' + got }; });
    const as = acc(STG, (c) => { const s = KI.stage(c.top10 || [], c.keyword, null, STG.clients[c.client]); return { ok: s.stage === c.stage, msg: c.keyword + ' ' + c.stage + '->' + s.stage }; });
    const ai = acc(STG, (c) => { const s = KI.stage(c.top10 || [], c.keyword, null, STG.clients[c.client]); return { ok: s.intent === c.intent, msg: c.keyword + ' ' + c.intent + '->' + s.intent }; });
    const pct = (b) => b[1] ? Math.round(1000 * b[0] / b[1]) / 10 : 0;
    console.log('   KI23 domains train ' + ad.train.join('/') + ' (' + pct(ad.train) + '%) hold-out ' + ad.hold.join('/') + ' (' + pct(ad.hold) + '%); stage train ' + as.train.join('/') + ' (' + pct(as.train) + '%) hold-out ' + as.hold.join('/') + ' (' + pct(as.hold) + '%); intent hold-out ' + ai.hold.join('/') + ' (' + pct(ai.hold) + '%)');
    check('KI23 the labelled sets are real and big enough: >= 80 domains (both clients, every class, fragments and google.com), >= 60 keywords (>= 30 with a stored results page), a hold-out third',
      DOM.cases.length >= 80 && STG.cases.length >= 60 && STG.cases.filter(c => c.top10).length >= 30 && ['direct', 'adjacent', 'principal', 'directory', 'publisher_list', 'platform', 'government', 'job_board', 'media', 'reject'].every(k => DOM.cases.some(c => c.class === k))
      && DOM.cases.some(c => c.host === 'google.com') && DOM.cases.some(c => c.host === 'AED 300k-450k') && DOM.cases.filter(c => c.holdout).length >= 25 && STG.cases.filter(c => c.holdout).length >= 20, J([DOM.cases.length, STG.cases.length]));
    check('KI23 domain classes: >= 90% on the hold-out (' + pct(ad.hold) + '%)', pct(ad.hold) >= 90, ad.miss.join('; '));
    check('KI23 journey stage: >= 90% on the hold-out (' + pct(as.hold) + '%)', pct(as.hold) >= 90, as.miss.join('; '));
    check('KI23 intent: >= 90% on the hold-out (' + pct(ai.hold) + '%)', pct(ai.hold) >= 90, ai.miss.join('; '));

    // ---- KI24 R3 golden regressions ----
    const run = (r, site) => { const g = KI.gate(r.keyword, site); const f = KI.fit(r.keyword, site); const s = KI.stage(r.top10 || [], r.keyword, null, site);
      const row = { ...r, stage: s.stage }; const d = KI.demand([row]); const w = KI.win(row, { domain: site.own_domain, queries: site.queries || [] }); const v = KI.value(row, site);
      const sc2 = KI.score({ gate: g.gate, gate_reason: g.reason, fit: f, stage: s.stage, demand: d, win: w, value: v, gap: 0 }); return { g, s, sc: sc2, verdict: KI.verdict({ gate: g.gate, fit: f.fit, win: w.win }) }; };
    const Tq = { ...T, queries: [{ query: 'uae peppol pint-ae compliance', impressions: 60, position: 20.4 }, { query: 'pdf vs e-invoice uae', impressions: 80, position: 19.6 }, { query: 'peppol access point service provider uae', impressions: 40, position: 53.5 },
      { query: 'dynamics ax dubai', impressions: 60, position: 8.4 }, { query: 'microsoft dynamics ax abu dhabi', impressions: 40, position: 13.6 }, { query: 'dynamics 365 cloud migration services in uae', impressions: 50, position: 2.9 }, { query: 'd365 cloud migration uae', impressions: 40, position: 5.5 }] };
    const strikingRows = Tq.queries.filter(q => !/pdf|access point/.test(q.query)).map(q => run({ keyword: q.query, gsc_impressions: q.impressions, gsc_position: q.position, sources: [{ source: 'gsc' }] }, Tq));
    const crm = run({ keyword: 'what is a crm company', volume: 50, sources: [{ source: 'labs_ideas' }] }, Tq);
    const crmOpen = KI.score({ ...crm.sc.factors, gate: 'pass', stage: crm.s.stage, fit: Math.max(crm.sc.factors.fit, 0.9) });
    check('KI24 R3 F2: techand\'s Peppol / PINT AE, AX and cloud-migration Search Console rows outrank "what is a crm company" (gated as too broad, and even if it were not)',
      crm.sc.score === 0 && strikingRows.every(x => x.g.gate === 'pass' && x.sc.score > crm.sc.score && x.sc.score > crmOpen.score), J({ crm: [crm.g, crm.sc.score, crmOpen.score], striking: strikingRows.map(x => [x.sc.score, x.verdict]) }));
    check('KI24 R3 F4: "erp software uae" is not refused as off-service for an ERP implementation partner (services read as a list)', KI.gate('erp software uae', T).gate === 'pass' && KI.gate('erp software uae', { ...T, services: T.services.join(', ') }).gate === 'pass', J(KI.gate('erp software uae', { ...T, services: T.services.join(', ') })));
    check('KI24 R3 F5: a list results page gets the list action (crm service provider in uae, 10 of 10 lists)', KI.pageAction({ keyword: 'crm service provider in uae', top10: Array.from({ length: 10 }, (_, i) => ({ host: 'l' + i + '.com', type: 'list', pos: i + 1 })) }, { domain: 'techand.ai' }).action === 'list', '');
    const avoidRun = run({ keyword: 'crm for customers', volume: 40, top10: [{ type: 'guide', pos: 1 }, { type: 'guide', pos: 2 }, { type: 'vendor', pos: 6 }] }, T);
    const avoidGated = run({ keyword: 'crm for customers', volume: 40 }, { ...T, avoid: ['crm for customers'] });
    check('KI24 R3 F7: "crm for customers" (AVOID) is gated with a stored AVOID, and is never Go without one', avoidGated.verdict === 'gated' && avoidGated.sc.score === 0 && avoidRun.verdict !== 'go', J([avoidRun.verdict, avoidRun.sc.score, avoidGated.verdict]));
    check('KI24 R3 F1: devaicon is measured in the UAE: Pakistan searches are other_market, UAE / Dubai ones pass', KI.gate('ai automation services pakistan', V).reason === 'other_market' && KI.gate('software development company in uae', V).gate === 'pass' && KI.gate('custom software development company dubai', V).gate === 'pass', '');
    check('KI24 R3 #9 / A1: on techand\'s stored results pages, Dynamics partners are scored competitors, google.com and fragments never become rows',
      (() => { const r = KI.scoreCompetitors(['randgroup.com', 'dynamicssquare.com', 'google.com', 'AED 300k-450k', 'Milestones', 'microsoft.com'], seeds, { ...KI.cfg({}), ctx: T }); return r.length === 3 && r.find(x => x.comp_domain === 'randgroup.com').scored && r.find(x => x.comp_domain === 'microsoft.com').class === 'principal'; })(), '');

    // ---- KI25 inputs never mutated ----
    const frozen = JSON.parse(J(rowsC)); KI.cluster(rowsC); KI.gaps(cl20, ch20, kr, ex20); KI.scoreCompetitors([], seeds, KI.cfg({})); KI.plan(heads, gp20);
    check('KI25 the kit never mutates its inputs (rows, seeds, gaps)', J(frozen) === J(rowsC), '');
  });
};
