// KC1-KC5 (KW-COMP 2026-10-21, K6 / A-24 / RV-6 / RV-14): one answer to "who is a competitor" on research, the ladder and the full report.
//   KC1  the kit's classifier: naukrigulf / indeed / bayt / glassdoor / clutch / g2 / upwork / help.ardoq.com / difc.com / google.com /
//        abcmoney.co.uk are never a business, each with its kind; a business is a business; Arabic titles do not crash it
//   KC2  the kit's scoring: a business on 4 of 6 results pages (#8 each) beats one seen once at #1; declared competitors stay first;
//        no results page -> the declared ones only, said plainly
//   KC3  discovery (Competitor Keyword Requests): the results page of 10-21 (job board, help subdomain, free zone, search engine) gives
//        no such competitor and the pool is only pulled from businesses, each with its evidence
//   KC4  full report (Pick Competitors): a job board with 50 shared keywords and help.ardoq.com are passed over with their kind; the
//        business that ranks on all three results pages comes first with its evidence
//   KC5  ladder (Ladder Clusters): the rung results pages give the ladder's competitors by overlap, with the excluded sites and their kind
// Called from scenarios_v5.js just before the report (one appended line).
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const kit = async (fn, args) => (await run('_competitors_kit', [{ json: { fn, args } }], { code: '_competitors_kit' }))[0].json.out;
  const org = (rank, domain, title, path) => ({ type: 'organic', rank_group: rank, rank_absolute: rank, domain, url: 'https://' + domain + (path || '/'), title: title || 'ERP and AI consulting in Dubai', description: '' });
  const serpRes = (items, id) => ({ status_code: 20000, tasks: [{ id: id || 'task-' + Math.random().toString(36).slice(2), status_code: 20000, status_message: 'Ok.', cost: 0.002, result: [{ items, se_results_count: 1000 }] }] });

  await guard('KC1 competitor kit: the kind of a domain', async () => {
    reset(); const SN = 'KC1 KW-COMP: job boards, directories, marketplaces, review sites, help subdomains, free zones and search engines are never competitors, each with its kind';
    begin(SN); const check = mkCheck(SN);
    const want = { 'naukrigulf.com': 'job', 'indeed.com': 'job', 'ae.indeed.com': 'job', 'bayt.com': 'job', 'glassdoor.com': 'job', 'clutch.co': 'directory', 'g2.com': 'review',
      'upwork.com': 'marketplace', 'help.ardoq.com': 'help', 'difc.com': 'gov', 'difc.ae': 'gov', 'meydanfz.ae': 'gov', 'tax.gov.ae': 'gov', 'google.com': 'search', 'google.ae': 'search',
      'abcmoney.co.uk': 'media', 'khaleejtimes.com': 'media', 'linkedin.com': 'social', 'reddit.com': 'qa', 'usaii.org': 'education', 'techand.ai': 'you', 'www.techand.ai': 'you',
      'hamtinfotech.com': 'business', 'ingoude.ae': 'business', 'blog.evolvxai.com': 'business', 'connect.acme-erp.com': 'business' };
    const got = {};
    for (const d of Object.keys(want)) got[d] = (await kit('kindOf', [d, 'https://' + d + '/', 'ERP implementation partner', '', 'techand.ai'])).kind;
    const wrong = Object.keys(want).filter(d => got[d] !== want[d]);
    check('KC1 every domain has its kind (' + Object.keys(want).length + ' cases)', !wrong.length, J(wrong.map(d => [d, got[d], 'want ' + want[d]])));
    const lbl = await kit('kindOf', ['help.ardoq.com', 'https://help.ardoq.com/en/articles/ai', 'AI consulting', '', 'techand.ai']);
    check('KC1 an exclusion carries a plain label', lbl.label === 'help, docs or community pages of another product' && lbl.by === 'host', J(lbl));
    // result-level kinds on an ordinary business domain: a jobs page, a list article, a course page; a vendor's own SEO title is a business
    const r = {};
    for (const [k, t, p] of [['jobs', 'ERP Consultant Jobs in UAE - 67 Vacancies', '/jobs/erp'], ['list', 'Top 10 AI Consulting Companies in Dubai (2026)', '/blog/top'],
      ['course', 'Certified AI Consultant course | Program fee', '/course'], ['vendor', 'Best ERP Software in Dubai | Elate ERP', '/'], ['vendor2', 'Leading ERP Solutions Provider in UAE', '/'],
      ['ar_job', 'وظائف مستشار ERP في دبي', '/x'], ['ar_vendor', 'حلول تخطيط موارد المؤسسات في دبي', '/'], ['ar_list', 'أفضل 10 شركات برمجيات في دبي', '/x'], ['empty', '', '']])
      r[k] = (await kit('kindOf', ['elate.ae', 'https://elate.ae' + p, t, '', 'techand.ai'])).kind;
    check('KC1 a jobs / list / course result is not evidence; a vendor title is a business; Arabic titles are read, not crashed on',
      r.jobs === 'job' && r.list === 'list' && r.course === 'education' && r.vendor === 'business' && r.vendor2 === 'business' && r.ar_job === 'job' && r.ar_vendor === 'business' && r.ar_list === 'list' && r.empty === 'business', J(r));
  });

  await guard('KC2 competitor kit: overlap beats a single top spot; declared first; no results page said plainly', async () => {
    reset(); const SN = 'KC2 KW-COMP: a business on 4 of 6 of your results pages beats one seen once at #1; declared competitors stay first; with no results page only the declared ones, said plainly';
    begin(SN); const check = mkCheck(SN);
    const KW = ['ai consulting dubai', 'erp implementation uae', 'dynamics 365 partner uae', 'business central partner dubai', 'e invoicing uae', 'ai consultant'];
    const serps = KW.map((kw, i) => ({ keyword: kw, items: [
      org(1, i === 0 ? 'onceatone.ae' : 'filler' + i + '.com', i === 0 ? 'AI consulting in Dubai' : 'Filler'),
      org(2, 'naukrigulf.com', 'ERP Consultant Jobs in UAE'), org(3, 'help.ardoq.com', 'AI in Ardoq'),
      ...(i < 4 ? [org(8, 'steady-erp.ae', 'ERP and AI partner in UAE')] : []), org(9, 'difc.com', 'DIFC'), org(10, 'www.techand.ai', 'Tech&') ] }));
    const sel = await kit('select', [{ serps, declared: ['declaredrival.com'], own_domain: 'techand.ai', n: 3 }]);
    console.log('   picked ->', sel.picked.map(p => p.domain + ' [' + p.evidence + ']').join(' | '));
    check('KC2 the declared competitor is first', sel.picked[0] && sel.picked[0].domain === 'declaredrival.com' && sel.picked[0].source === 'declared', J(sel.picked));
    check('KC2 steady-erp.ae (4 of 6, #8) is picked with "ranks for 4 of your 6 keywords"', sel.picked[1] && sel.picked[1].domain === 'steady-erp.ae' && /ranks for 4 of your 6 keywords/.test(sel.picked[1].evidence), J(sel.picked));
    check('KC2 onceatone.ae (once, #1) is not a competitor: seen on only one of six pages', !sel.picked.some(p => p.domain === 'onceatone.ae') && sel.too_few.some(t => t.domain === 'onceatone.ae'), J({ picked: sel.picked, too_few: sel.too_few }));
    check('KC2 job board, help subdomain and free zone are excluded with their kind; the client is neither', ['naukrigulf.com:job', 'help.ardoq.com:help', 'difc.com:gov'].every(x => sel.excluded.some(e => e.domain + ':' + e.kind === x))
      && !sel.excluded.some(e => /techand/.test(e.domain)) && !sel.picked.some(p => /techand/.test(p.domain)), J(sel.excluded));
    const none = await kit('select', [{ serps: [], declared: ['declaredrival.com', 'indeed.com'], own_domain: 'techand.ai' }]);
    check('KC2 no results page: the declared business only, a declared job board refused with its kind, and the note says so plainly',
      J(none.picked.map(p => p.domain)) === '["declaredrival.com"]' && none.excluded.some(e => e.domain === 'indeed.com' && e.kind === 'job') && /No results page was read on this run, so only the competitor\(s\) you declared are used/.test(none.note), J(none));
    const nothing = await kit('select', [{ serps: [], declared: [], own_domain: 'techand.ai' }]);
    check('KC2 no results page and nothing declared: no competitor, said plainly', !nothing.picked.length && /no competitor was used/.test(nothing.note), J(nothing));
    check('KC2 customer text: no em dash, curly quote or ellipsis in the notes', ![sel.note, none.note, nothing.note, ...sel.picked.map(p => p.evidence)].some(t => /[—‘’“”…]/.test(t)), sel.note);
  });

  await guard('KC3 discovery: the competitor pull uses only businesses', async () => {
    reset(); const SN = 'KC3 KW-COMP: discovery on the 10-21 results page (job board #2, help subdomain, free zone, search engine): only businesses are pulled, each with its evidence';
    begin(SN); const check = mkCheck(SN);
    mock('Seed List', [{ json: { domain: 'techand.ai', country_iso: 'AE', location_code: 2784, language_code: 'en', primary_seed: 'ai consulting dubai', seeds: ['ai consulting dubai'], competitors: [], site_model: { competitors: [] } } }]);
    mock('Research Requests', [{ json: { kind: 'ideas', body: [{ keywords: ['ai consulting dubai'] }] } }, { json: { kind: 'serp', body: [{ keyword: 'ai consulting dubai' }] } }]);
    const page = [org(1, 'help.ardoq.com', 'AI consulting with Ardoq'), org(2, 'naukrigulf.com', 'AI Consultant Jobs in Dubai - 40 Vacancies'), org(3, 'difc.com', 'AI licence in DIFC'),
      org(4, 'google.com', 'Google Cloud AI'), org(5, 'hamtinfotech.com', 'AI consulting company in Dubai'), org(6, 'clutch.co', 'Top AI Consulting Companies in Dubai'),
      org(7, 'ingoude.ae', 'AI and ERP consulting UAE'), org(8, 'abcmoney.co.uk', 'How AI consultants help'), org(9, 'blog.evolvxai.com', 'AI consulting services Dubai')];
    const reqs = (await run('Competitor Keyword Requests', [{ json: { tasks: [{ status_code: 20000, result: [{ items: [] }] }] } }, { json: serpRes(page) }])).map(i => i.json);
    const doms = reqs.filter(r => r.kind === 'competitor').map(r => r.domain); const basis = reqs[0].competitor_basis || {};
    console.log('   competitors ->', doms.join(', '), '|', basis.note);
    check('KC3 none of help.ardoq.com, naukrigulf.com, difc.com, google.com, clutch.co, abcmoney.co.uk is pulled', !doms.some(d => /ardoq|naukrigulf|difc|google|clutch|abcmoney/.test(d)), J(doms));
    check('KC3 the three businesses are pulled, the blog subdomain as its site', J(doms) === J(['hamtinfotech.com', 'ingoude.ae', 'evolvxai.com']), J(doms));
    check('KC3 each pick says why and the passed-over sites carry their kind', basis.picked.every(p => /ranks #\d+ for "ai consulting dubai"/.test(p.how))
      && ['help.ardoq.com:help', 'naukrigulf.com:job', 'difc.com:gov', 'google.com:search', 'clutch.co:directory', 'abcmoney.co.uk:media'].every(x => basis.skipped.some(s => s.domain + ':' + s.kind === x)), J(basis));
    check('KC3 one results page is called a thin read', /one results page only/.test(basis.note), basis.note);
  });

  await guard('KC4 full report: Pick Competitors by overlap, never a job board or a help subdomain', async () => {
    reset(); const SN = 'KC4 KW-COMP: the full report passes over a job board sharing 50 keywords and help.ardoq.com, and ranks the business on all three results pages first, with its evidence';
    begin(SN); const check = mkCheck(SN);
    mock('Schema Findings', { domain: 'techand.ai', competitors: [] });
    mock('Find Competitors Answers', { tasks: [{ status_code: 20000, result: [{ items: [{ domain: 'naukrigulf.com', intersections: 50 }, { domain: 'help.ardoq.com', intersections: 30 }, { domain: 'pactsoft.ae', intersections: 2 }] }] }] });
    mock('Fallback Queries', [{ json: { query: 'dynamics 365 partner uae' } }, { json: { query: 'ai consulting dubai' } }, { json: { query: 'e invoicing uae' } }]);
    const pages = ['dynamics 365 partner uae', 'ai consulting dubai', 'e invoicing uae'].map((q, i) => serpRes([org(1, 'once-top.ae', 'Partner'), org(2, 'help.ardoq.com', 'Help'),
      org(3 + i, 'steady-erp.ae', 'ERP and AI partner'), org(6, 'glassdoor.com', 'Salaries'), org(7, 'filler' + i + '.ae', 'x')].filter((x, k) => i === 0 || k > 0)));
    const out = (await run('Pick Competitors', pages.map(p => ({ json: p })))).map(i => i.json);
    const comps = out.filter(o => !o.is_you); const you = out.find(o => o.is_you) || {};
    console.log('   competitors ->', comps.map(c => c.domain + ' [' + (c.evidence || '') + ']').join(' | '), '|', you.method);
    check('KC4 naukrigulf.com (50 shared keywords) and help.ardoq.com are not competitors', !comps.some(c => /naukrigulf|ardoq|glassdoor/.test(c.domain)), J(comps.map(c => c.domain)));
    check('KC4 steady-erp.ae (all three pages) is first, with its evidence', comps[0] && comps[0].domain === 'steady-erp.ae' && /ranks for 3 of your 3 keywords/.test(comps[0].evidence || ''), J(comps));
    check('KC4 the passed-over sites travel with their kind and the method names them', (you.competitors_excluded || []).some(e => e.domain === 'naukrigulf.com' && e.kind === 'job')
      && (you.competitors_excluded || []).some(e => e.domain === 'help.ardoq.com' && e.kind === 'help') && /Passed over: .*naukrigulf\.com \(job board\)/.test(you.method || ''), J(you));
  });

  await guard('KC5 ladder: who the ladder competes with, from its own results pages', async () => {
    reset(); const SN = 'KC5 KW-COMP: the ladder\'s rung results pages give its competitors by overlap (declared first), the job board and the free zone passed over with their kind';
    begin(SN); const check = mkCheck(SN);
    for (const k of ['Ladder Cluster Retry', 'Run Ladder Cluster SERP (Retry)']) delete store[k];
    const RUNGS = ['ai consultant dubai', 'ai consulting firm uae', 'ai consulting services dubai'];
    mock('Ladder Pool', { keyword: 'ai consulting', domain: 'techand.ai', competitors: ['declaredrival.com'],
      competitors_summary: [{ rank: 1, domain: 'naukrigulf.com', url: 'https://www.naukrigulf.com/ai-jobs', title: 'AI Jobs' }, { rank: 2, domain: 'steady-ai.ae', url: 'https://steady-ai.ae/', title: 'AI consulting UAE' }] });
    mock('Ladder Cluster Requests', RUNGS.map(k => ({ json: { keyword: k, cluster_check: true, weight: 1, volume: 50, cap: 24, candidates: 3, on_topic: 3 } })));
    const answers = RUNGS.map((k, i) => serpRes([org(1, 'naukrigulf.com', 'AI Consultant Jobs'), org(2, 'steady-ai.ae', 'AI consulting partner'), org(3, 'difc.com', 'DIFC AI licence'),
      org(4, 'u' + i + 'a.ae', 'x'), org(5, 'u' + i + 'b.ae', 'y'), org(6, 'u' + i + 'c.ae', 'z'), org(7, 'u' + i + 'd.ae', 'w')], 'lc-' + i));
    mock('Run Ladder Cluster SERP', answers.map(a => ({ json: a })));
    const cl = (await run('Ladder Clusters', answers.map(a => ({ json: a }))))[0].json.serp_clusters || {};
    const c = cl.competitors || {};
    console.log('   ladder competitors ->', (c.picked || []).map(p => p.domain + ' [' + p.evidence + ']').join(' | '), '|', c.note);
    check('KC5 the ladder carries a competitor set: declared first, then steady-ai.ae on all 4 results pages', J((c.picked || []).map(p => p.domain)) === J(['declaredrival.com', 'steady-ai.ae'])
      && /ranks for 4 of your 4 keywords/.test(((c.picked || [])[1] || {}).evidence || ''), J(c));
    check('KC5 the job board and the free zone are passed over with their kind', (c.excluded || []).some(e => e.domain === 'naukrigulf.com' && e.kind === 'job') && (c.excluded || []).some(e => e.domain === 'difc.com' && e.kind === 'gov'), J(c.excluded));
  });
};
