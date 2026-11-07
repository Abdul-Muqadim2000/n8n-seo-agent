// SERP-GOTO (2026-11-08, docs/keyword-intel-2026-11-08/fixes/SERP_GOTO.md; R5_DATAFORSEO.md 13.0 L-1): DataForSEO's live Google organic
// results carry `domain: "google.com"` and `url: https://google.com/goto?url=<opaque token>` for every organic and local-pack result since
// about 2026-10-30. One kit (v5/code/_serp_url.js, SU) recovers the host from Google's breadcrumb, wherever the answers enter.
//   SG1  the kit on the REAL live answer (fixtures_live/serp_goto, 2026-11-08): every organic host recovered, matching the hosts the same
//        search returned with exact urls from a standard-priority task 83 s later; local-pack items with no host left unresolved, never
//        google.com; a clean answer (the 2026-10-02 fixture, the standard-priority answer) is the SAME object; support.google.com is kept
//   SG2  the second real live shape (R5's two searches: "dynamics 365 partner uae", "erp software uae") - the AI Overview's references untouched
//   SG3  the rank kit: our site found at its position by host, page "not identified"; competitors real hosts; a result with no site and no
//        own result -> -1 (never "not in the top 50"); two own results behind redirects are not cannibalisation; churn by site when one
//        reading is approximate; a stored reading holding redirects is never a baseline and names nobody as "outranked"
//   SG4  the SERP cache: a fresh goto answer is stored with recovered hosts; a stored reading still holding bare redirects is refused;
//        a clean reading is stored with no new key
//   SG5  the generated nodes: the Rank Tracker's SERP Check Answers, Pick Top 6, Collect Facts
//   SG6  the clustering key: the same result read twice gives the same key, never equal to an exact url
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, reset, begin } = ctx;
  const FX = path.join(__dirname, 'fixtures_live', 'serp_goto');
  const rdj = (f) => JSON.parse(fs.readFileSync(path.join(FX, f), 'utf8'));
  const J = (x) => String(JSON.stringify(x));
  const items = (arr) => arr.map(j => ({ json: j }));
  let SN = '';
  const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 700), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 500))); };
  const su = async (fn, ...args) => (await run('_serp_url', [{ json: { fn, args } }], { code: '_serp_url' }))[0].json.r;
  const sc = async (fn, ...args) => (await run('_serp_cache', [{ json: { fn, args } }], { code: '_serp_cache' }))[0].json.r;
  const kit = async (input) => (await run('_rank_serp', [{ json: input }], { code: '_rank_serp' }))[0].json;
  const GOTO = rdj('live_goto_erp_software_uae.json'), EXACT = rdj('standard_exact_erp_software_uae.json'), KI = rdj('live_ki_paa_aio.json');
  const OLD = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'aio.json'), 'utf8'));
  const itemsOf = (a) => ((((a || {}).tasks || [])[0] || {}).result || [])[0].items || [];
  const bare = (d) => String(d || '').toLowerCase().replace(/^www\./, '');
  const isGoogle = (d) => /^(?:www\.)?google\./.test(String(d || ''));

  // ---------- SG1 ----------
  reset(); SN = 'SG1 SERP-GOTO: the kit on the real live answer of 2026-11-08'; begin(SN);
  const fixed = await su('fixAnswer', GOTO);
  const org = itemsOf(fixed).filter(x => x.type === 'organic'), lp = itemsOf(fixed).filter(x => x.type === 'local_pack');
  const realHosts = new Set(itemsOf(EXACT).filter(x => x.type === 'organic').map(x => bare(x.domain)));
  check('the live answer really is the defect: every organic and local-pack item came back as google.com with a /goto link',
    itemsOf(GOTO).filter(x => x.type === 'organic' || x.type === 'local_pack').every(x => x.domain === 'google.com' && /google\.com\/goto\?url=/.test(x.url)), J(itemsOf(GOTO).map(x => x.domain)));
  check('every organic result gets its real host back from the breadcrumb, and none is google.com',
    org.length === 9 && org.every(x => x.domain && !isGoogle(x.domain) && x.url_exact === false && x.url_recovered === 'breadcrumb' && /google\.com\/goto/.test(x.redirect_url)), J(org.map(x => [x.domain, x.url_recovered])));
  const inBoth = org.filter(x => realHosts.has(bare(x.domain))).length;
  check('the recovered hosts are the hosts the same search showed with exact urls (standard-priority task, 83 s later): at least 6 of 9, positions 1-3 identical',
    inBoth >= 6 && [1, 2, 3].every(p => bare((org.find(x => x.rank_group === p) || {}).domain) === bare((itemsOf(EXACT).find(x => x.type === 'organic' && x.rank_group === p) || {}).domain)),
    J({ inBoth, recovered: org.map(x => bare(x.domain)), real: [...realHosts] }));
  check('a full slug breadcrumb gives an approximate address (host + path); a cut one, or one made of page labels ("› Home › Blog"), only the home page, marked partial',
    org.find(x => x.rank_group === 1).url === 'https://www.sage.com/en-ae/erp' && org.find(x => x.rank_group === 1).url_partial === false && org.find(x => x.rank_group === 1).url_path === 'path'
    && org.find(x => x.rank_group === 2).url === 'https://www.brainsphereit.com/' && org.find(x => x.rank_group === 2).url_path === 'cut'
    && org.find(x => x.rank_group === 7).url === 'https://odooerp.ae/' && org.find(x => x.rank_group === 7).url_partial === true && org.find(x => x.rank_group === 7).url_path === 'labels',
    J(org.map(x => [x.rank_group, x.url, x.url_path])));
  check('a local-pack listing with no host anywhere is left unresolved (domain and url null), never counted as google.com',
    lp.length === 3 && lp.every(x => x.domain === null && x.url === null && x.url_exact === false), J(lp.map(x => [x.domain, x.url])));
  check('the answer says what was done (redirects / recovered / unresolved)', J(itemsOf(fixed) && fixed.tasks[0].result[0].serp_url) === J({ redirects: 12, recovered: 9, unresolved: 3, rule: 'SU (v5/code/_serp_url.js): host from the breadcrumb, url approximate' }), J(fixed.tasks[0].result[0].serp_url));
  check('the standard-priority answer (exact urls) and the 2026-10-02 fixture pass through byte-identical',
    J(await su('fixAnswer', EXACT)) === J(EXACT) && J(await su('fixAnswer', OLD)) === J(OLD));
  const realG = { type: 'organic', rank_group: 3, domain: 'support.google.com', url: 'https://support.google.com/webmasters/answer/7451184', title: 'Search Console Help' };
  const realG2 = { type: 'organic', rank_group: 4, domain: 'www.google.com', url: 'https://www.google.com/search/howsearchworks/', title: 'How Search works' };
  check('a real Google result (support.google.com, google.com/search/howsearchworks) is a result like any other, untouched',
    J(await su('fixItem', realG)) === J(realG) && J(await su('fixItem', realG2)) === J(realG2));
  const social = await su('fixItem', { type: 'organic', rank_group: 5, domain: 'google.com', url: 'https://google.com/goto?url=CAESabc', breadcrumb: '3 reactions · 1 month ago', website_name: 'Facebook · TechMantra GULF DMCC' });
  const named = await su('fixItem', { type: 'organic', rank_group: 6, domain: 'google.com', url: 'https://www.google.com/url?q=x', breadcrumb: null, website_name: 'acme-erp.ae' });
  const none = await su('fixItem', { type: 'organic', rank_group: 7, domain: 'google.com', url: 'https://google.com/goto?url=CAESdef', breadcrumb: 'Blueflame Labs', website_name: 'Blueflame Labs' });
  const idn = await su('fixItem', { type: 'organic', domain: 'google.com', url: 'https://google.com/goto?url=CAES1', breadcrumb: 'https://www.müller.de › shop' });
  const xn = await su('fixItem', { type: 'organic', domain: 'google.com', url: 'https://google.com/goto?url=CAES2', breadcrumb: 'https://xn--mgbh0fb.xn--mgbaam7a8h › a' });
  const noScheme = await su('fixItem', { type: 'organic', domain: 'google.com', url: 'https://google.com/goto?url=CAES3', breadcrumb: 'en.wikipedia.org › wiki › ERP' });
  check('review H2: a Unicode host, a punycode TLD (the UAE\'s) and a breadcrumb without https:// all give their host',
    idn.domain === 'www.müller.de' && xn.domain === 'xn--mgbh0fb.xn--mgbaam7a8h' && noScheme.domain === 'en.wikipedia.org' && noScheme.url_path === 'labels', J([idn.domain, xn.domain, noScheme.domain, noScheme.url_path]));
  const ctor = await su('fixItem', { type: 'organic', domain: 'google.com', url: 'https://google.com/goto?url=CAES4', breadcrumb: '', website_name: 'Constructor' });
  check('review L1: website_name "Constructor" is not a social network (no prototype key): unresolved', ctor.domain === null && ctor.url === null, J(ctor));
  let threw = ''; let odd = null; try { odd = [await su('carried', 'https://www.google.com/url?q=https://:a.b'), await su('carried', 'https://www.google.com/url?q=https://u:p@evil.example/x'), await su('carried', 'https://www.google.com/url?q=https%3A%2F%2Fwww.mof.gov.ae%2Fen')]; } catch (e) { threw = String(e); }
  check('review L2: a carried target with no host or with userinfo is no target, and nothing throws; a real one is read', !threw && odd[0] === '' && odd[1] === '' && odd[2] === 'https://www.mof.gov.ae/en', threw || J(odd));
  check('no breadcrumb host: website_name when it is a host, a named social network, else unresolved',
    named.domain === 'acme-erp.ae' && named.url_recovered === 'website_name' && named.url_partial === true && social.domain === 'facebook.com' && social.url_recovered === 'social'
    && none.domain === null && none.url === null, J([named.domain, social.domain, none.domain]));

  // ---------- SG2 ----------
  reset(); SN = 'SG2 SERP-GOTO: the second live shape (R5 L0 probe, 2026-11-07)'; begin(SN);
  const a1 = KI.calls[0].answer, a2 = KI.calls[1].answer;
  const f1 = await su('fixAnswer', a1), f2 = await su('fixAnswer', a2);
  check('"dynamics 365 partner uae": sqitconsulting.com and brightpointinfotech.com, not google.com',
    J(itemsOf(f1).filter(x => x.type === 'organic').map(x => bare(x.domain))) === J(['sqitconsulting.com', 'brightpointinfotech.com']), J(itemsOf(f1).filter(x => x.type === 'organic').map(x => x.domain)));
  check('"erp software uae": ebrsoftware.com, azdan.com, gear-up.ae at their own positions',
    J(itemsOf(f2).filter(x => x.type === 'organic').map(x => [x.rank_group, bare(x.domain)])) === J([[1, 'ebrsoftware.com'], [2, 'azdan.com'], [3, 'gear-up.ae']]), J(itemsOf(f2).filter(x => x.type === 'organic').map(x => [x.rank_group, x.domain])));
  const aio0 = itemsOf(a1).find(x => x.type === 'ai_overview'), aio1 = itemsOf(f1).find(x => x.type === 'ai_overview');
  check('the AI Overview\'s references keep their real urls (they never were redirects)', J(aio0.references) === J(aio1.references) && aio1.references.every(r => !/goto/.test(r.url)), J(aio1.references.map(r => r.url)));
  check('a redirect link inside an organic result\'s links is dropped (null), never kept as google.com',
    itemsOf(f1).filter(x => x.type === 'organic').every(x => (x.links || []).every(l => l.url === null && l.url_exact === false)), J(itemsOf(f1).filter(x => x.type === 'organic').map(x => x.links)));

  // ---------- SG3 ----------
  reset(); SN = 'SG3 SERP-GOTO: the rank kit finds the client by host and claims nothing about a page it cannot see'; begin(SN);
  const K = await kit({ serp: GOTO, domain: 'sowaanerp.ae', competitors: ['sage.com'], device: 'desktop' });
  check('our site is found at its position (8) by its host, and the page is "not identified" (no guessed url)',
    K.rank.position === 8 && K.rank.url === '' && K.rank.page_identified === false && K.rank.host === 'sowaanerp.ae', J(K.rank));
  check('page 1 and the tracked competitor are real sites; google.com appears nowhere',
    K.landscape.top.length === 9 && K.landscape.top.every(t => !isGoogle(t.domain)) && (K.landscape.competitors.find(c => c.domain === 'sage.com') || {}).position === 1
    && !/google\.com/.test(J(K.landscape.competitors)), J(K.landscape.top.map(t => t.domain)));
  check('a site not on the page, with every result traced to a site, is "not in the top 50" (0), as before',
    (await kit({ serp: GOTO, domain: 'techand.ai' })).rank.position === 0);
  const withHole = JSON.parse(J(GOTO)); itemsOf(withHole).push({ type: 'organic', rank_group: 10, rank_absolute: 13, domain: 'google.com', url: 'https://google.com/goto?url=CAESzz', breadcrumb: '', website_name: 'Some Brand' });
  const Kh = await kit({ serp: withHole, domain: 'techand.ai' });
  check('review H2: a hidden result that names someone else is not ours: "not in the top 50" stands (0) and says one result was hidden',
    Kh.rank.position === 0 && Kh.rank.unresolved === 1 && !Kh.rank.maybe_ours, J(Kh.rank));
  const withOurs = JSON.parse(J(GOTO)); itemsOf(withOurs).push({ type: 'organic', rank_group: 10, rank_absolute: 13, domain: 'google.com', url: 'https://google.com/goto?url=CAESyy', breadcrumb: '', website_name: 'Techand Software', title: 'ERP in the UAE | Tech&' });
  const Ko = await kit({ serp: withOurs, domain: 'techand.ai' });
  check('a hidden result that could be ours (our label in its name) is -1 ("check again"), counted in the snapshot (mo) for the next plan',
    Ko.rank.position === -1 && Ko.rank.maybe_ours === 1 && Ko.snapshot.mo === 1 && Ko.snapshot.ur === 1, J({ rank: Ko.rank, mo: Ko.snapshot.mo }));
  const two = JSON.parse(J(GOTO)); itemsOf(two).forEach(x => { if (x.rank_group === 3 && x.type === 'organic') x.breadcrumb = 'https://www.sowaanerp.ae › erp-software-uae'; });
  const K2 = await kit({ serp: two, domain: 'sowaanerp.ae' });
  const snap2 = K2.snapshot;
  check('two results of ours behind redirects are not "two of your pages compete", and not "none found" either (review M3): not checked, with the reason',
    Array.isArray(K2.landscape.own) && K2.landscape.own.length === 0 && snap2.own_n === undefined && snap2.own_hidden === true
    && K2.cannibal.checked === false && /redirect/.test(K2.cannibal.reason), J({ own: K2.landscape.own, n: snap2.own_n, c: K2.cannibal }));
  check('review L3: a local pack whose listings have no site is "ours: unknown" (null), never a definite no', K.features.local_pack.shown === true && K.features.local_pack.ours === null, J(K.features.local_pack));
  check('the snapshot marks approximate addresses (x: 1) and stores no google.com', snap2.top.every(t => t.x === 1) && !/google\.com/.test(J(snap2.top)), J(snap2.top.slice(0, 3)));
  const Ke = await kit({ serp: EXACT, domain: 'sowaanerp.ae' });
  check('the exact reading (standard priority) still finds the page itself, url and all', Ke.rank.position === 9 && /sowaanerp\.ae\/erp-companies-in-the-uae/.test(Ke.rank.url) && Ke.rank.page_identified === undefined, J(Ke.rank));
  const ch = (await kit({ serp: GOTO, domain: 'sowaanerp.ae', prev_snapshot: J(Ke.snapshot) })).change;
  check('an exact reading and an approximate one are compared by site (not every url "moved")',
    ch && ch.available === true && ch.changed < ch.depth, J(ch));
  // a reading stored while the redirects were read as the site (production 2026-11-05: position 0, top = google.com/goto x 10)
  const poisonedSnap = J({ at: '2026-11-05T01:12:00Z', device: 'desktop', results: 100, unavailable: false, error: '', features: [], top: Array.from({ length: 10 }, (_, i) => ({ p: i + 1, u: 'https://google.com/goto?url=CAES' + i, t: 'x' })), own_n: 0 });
  const rows = [
    { keyword: 'erp software uae', domain: 'sowaanerp.ae', device: 'desktop', checked_at: '2026-10-29T01:10:00Z', position: 9, url: 'https://www.sowaanerp.ae/erp-companies-in-the-uae/', snapshot_json: J(Ke.snapshot) },
    { keyword: 'erp software uae', domain: 'sowaanerp.ae', device: 'desktop', checked_at: '2026-11-05T01:12:00Z', position: 0, url: '', snapshot_json: poisonedSnap } ];
  const pr = await kit({ serp: GOTO, domain: 'sowaanerp.ae', history: rows, before: '2026-11-08T00:00:00Z', keyword: 'erp software uae',
    prev_for_outranked: poisonedSnap, outranked_opts: { domain: 'sowaanerp.ae', previous_position: 3, position: 8, previous_at: '2026-11-05' } });
  check('a stored reading that holds Google redirect links is never the baseline: the one before it is (#9, not "not in the top 50")',
    pr.prev && pr.prev.checked_at === '2026-10-29T01:10:00Z' && Number(pr.prev.position) === 9 && pr.poisoned_row === true, J({ prev: pr.prev && pr.prev.checked_at, poisoned: pr.poisoned_row }));
  check('and it names nobody as "outranked since" that reading', pr.outranked && pr.outranked.available === false && /redirect/.test(pr.outranked.reason), J(pr.outranked));

  // ---------- SG4 ----------
  reset(); SN = 'SG4 SERP-GOTO: the shared SERP cache stores real hosts and refuses a reading stored before the fix'; begin(SN);
  const body = { keyword: 'erp software uae', location_code: 2784, language_code: 'en', depth: 10 };
  const rdg = await sc('reading', GOTO, body, { now: '2026-11-08T10:00:00Z' });
  const ro = rdg.items.filter(x => x.type === 'organic');
  check('a fresh goto answer is stored with the recovered hosts and the approximate flags', ro.length === 9 && ro.every(x => x.domain && !isGoogle(x.domain) && x.url_exact === false && 'url_partial' in x), J(ro.slice(0, 2)));
  const lk = await sc('lookup', [{ key: rdg.key || await sc('key', body), value: J(rdg) }], body, { now: rdg.at });
  check('that stored reading is used again the same day', lk.hit === true, J(lk.why));
  const old = JSON.parse(J(rdg)); old.items = old.items.map(x => x.type === 'organic' ? { type: 'organic', rank_group: x.rank_group, rank_absolute: x.rank_absolute, url: 'https://google.com/goto?url=CAES' + x.rank_group, domain: 'google.com', title: x.title } : x);
  const lk2 = await sc('lookup', [{ key: await sc('key', body), value: J(old) }], body, { now: rdg.at });
  check('a reading stored before the fix (bare redirects, google.com) is not used: it is read again', lk2.hit === false && /redirect/.test(lk2.why), J(lk2));
  const rde = await sc('reading', EXACT, body, { now: '2026-11-08T10:00:00Z' });
  check('a clean reading is stored exactly as before: no new key on any item', !/url_exact|url_recovered|url_partial|redirect_url/.test(J(rde)), J(rde.items.slice(0, 2)));

  // ---------- SG5 ----------
  reset(); SN = 'SG5 SERP-GOTO: the generated nodes (Rank Tracker SERP Check Answers, Pick Top 6, Collect Facts)'; begin(SN);
  mock('SERP Check', [{ json: GOTO }]); mock('SERP Check Retry Plan', [{ json: { skip: true, is_retry: false } }]); mock('SERP Check (Retry)', []);
  const ans = (await run('SERP Check Answers', [{ json: { skip: true } }]))[0].json;
  check('every DataForSEO answer node gives the readers real hosts (SERP Check Answers)',
    itemsOf(ans).filter(x => x.type === 'organic').every(x => x.domain && !isGoogle(x.domain)) && ans.__dfs && ans.__dfs_cost_usd === 0.002, J(itemsOf(ans).map(x => x.domain)));
  mock('Prepare Keyword Run', [{ json: { domain: 'sowaanerp.ae', keyword: 'erp software uae' } }]); mock('Route Mode', [{ json: { domain: 'sowaanerp.ae' } }]);
  const picked = (await run('Pick Top 6', [{ json: GOTO }])).map(i => i.json);
  check('Pick Top 6 picks competitors by their real site, never google.com, skips our own site and pages whose address Google cut or showed only as labels (review M2)',
    picked.length === 3 && !picked[0].no_competitors && picked.every(p => !isGoogle(p.domain) && p.domain !== 'sowaanerp.ae' && p.url_exact === false && !/goto/.test(p.url))
    && !picked.some(p => p.domain === 'brainsphereit.com') && !picked.some(p => p.domain === 'odooerp.ae'), J(picked.map(p => [p.domain, p.url])));
  const t10 = picked[0].serp_top10 || [];
  check('review M4: the approximate addresses Pick Top 6 records for the page shapes are marked, so they do not vote on the page type', t10.length && t10.every(t => t.url_exact === false), J(t10.slice(0, 2)));
  const factsAns = JSON.parse(J(GOTO)); itemsOf(factsAns).forEach(x => { if (x.type === 'organic') x.description = 'In 2025, 64% of UAE companies moved their ERP to the cloud, according to a 2025 survey of 400 firms.'; });
  mock('Analyze Competitor Pages', [{ json: { keyword: 'erp software uae', serp_features: { people_also_ask: [] } } }]);
  const facts = (await run('Collect Facts', [{ json: factsAns }]))[0].json;
  check('Collect Facts cites no approximate address and never google.com: the results are named as unlinkable with their real site',
    facts.facts.length === 0 && facts.facts_unlinkable.length === 9 && facts.facts_unlinkable.every(u => u.site && !isGoogle(u.site)), J({ facts: facts.facts.length, un: facts.facts_unlinkable.map(u => u.site) }));

  // ---------- SG6 ----------
  reset(); SN = 'SG6 SERP-GOTO: the clustering key'; begin(SN);
  const second = await su('fixAnswer', JSON.parse(J(GOTO).replace(/CAES/g, 'CAEZ')));   // the same page read again: other tokens, same breadcrumbs
  const keysA = itemsOf(fixed).filter(x => x.type === 'organic').map(x => x.domain && x), keysB = itemsOf(second).filter(x => x.type === 'organic');
  const kA = await Promise.all(keysA.map(x => su('key', x))), kB = await Promise.all(keysB.map(x => su('key', x)));
  check('the same result read twice (different redirect tokens) gives the same key; only complete slug paths have one (review H1)',
    J(kA) === J(kB) && J(kA.filter(Boolean)) === J(['~sage.com/en-ae/erp', '~switchertechno.com/erp-software-uae', '~pactsoft.ae/best-erp-software-uae', '~sowaanerp.ae/erp-companies-in-the-uae']), J(kA));
  const kExact = await su('key', itemsOf(EXACT).find(x => x.type === 'organic' && x.rank_group === 1));
  check('an approximate key is marked (~) and never equals an exact url key', kA.filter(Boolean).every(k => k.startsWith('~')) && kExact === 'sage.com/en-ae/erp' && kA[0] === '~sage.com/en-ae/erp' && kA[0] !== kExact, J([kA[0], kExact]));

  // ---------- SG7 review H1: cut breadcrumbs never merge two searches ----------
  reset(); SN = 'SG7 SERP-GOTO review H1: two searches whose top 7 hold DIFFERENT pages of the same sites are not merged'; begin(SN);
  const lcSrc = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), 'Ladder_Clusters.js'), 'utf8');
  const cut = (src, a) => { const i = src.indexOf(a); const j = src.indexOf('\n})();', i); return i >= 0 && j > 0 ? src.slice(i, j + 6) : ''; };
  const KITS = new Function(cut(lcSrc, 'var SU = ') + '\n' + cut(lcSrc, 'const KWI = (() => {') + '\nreturn { SU, KWI };')();
  check('Ladder Clusters keys a redirect result by SU.key and leaves out one with no site (the generated node)', /SU\.exact\(x\) \? String\(x\.url \|\| x\.domain \|\| ''\) : SU\.key\(x\)/.test(lcSrc) && /!SU\.unresolved\(x\)/.test(lcSrc));
  const hosts = ['www.delemontechnology.com', 'www.brainsphereit.com', 'singleclic.com', 'www.sage.com', 'pactsoft.ae', 'gear-up.ae', 'www.azdan.com'];
  const page = (kw, tag) => ({ status_code: 20000, tasks: [{ id: 'h1-' + tag, status_code: 20000, result: [{ items: hosts.map((h, i) => ({ type: 'organic', rank_group: i + 1, domain: 'google.com',
    url: 'https://google.com/goto?url=CAES' + tag + i, breadcrumb: i < 3 ? 'https://' + h + ' › blog › ' + tag + '-erp-' + ['guide', 'list', 'top'][i] + '...' : 'https://' + h + ' › ' + tag + '-page-' + i })) }] }] });
  const exactPage = (kw, tag) => ({ status_code: 20000, tasks: [{ id: 'h1x-' + tag, status_code: 20000, result: [{ items: hosts.map((h, i) => ({ type: 'organic', rank_group: i + 1, domain: h,
    url: 'https://' + h + (i < 3 ? '/blog/' + tag + '-erp-' + ['guide', 'list', 'top'][i] + '-2026/' : '/' + tag + '-page-' + i + '/') })) }] }] });
  const urlsOf = (a) => KITS.SU.fixAnswer(a).tasks[0].result[0].items.filter(x => x.type === 'organic' && !KITS.SU.unresolved(x)).map(x => KITS.SU.exact(x) ? String(x.url || x.domain || '') : KITS.SU.key(x)).filter(Boolean);
  const opts = { top_n: 7, min_overlap: 0.4 };
  const goA = urlsOf(page('erp software uae', 'best')), goB = urlsOf(page('erp system dubai', 'top'));
  const after = KITS.KWI.serpClusters([{ keyword: 'erp software uae', urls: goA, weight: 2 }, { keyword: 'erp system dubai', urls: goB, weight: 1 }], opts);
  const before = KITS.KWI.serpClusters([{ keyword: 'erp software uae', urls: urlsOf(exactPage('a', 'best')), weight: 2 }, { keyword: 'erp system dubai', urls: urlsOf(exactPage('b', 'top')), weight: 1 }], opts);
  check('the three cut breadcrumbs on delemontechnology / brainsphereit / singleclic have no key, so they cannot count as 3 shared pages', goA.length === 4 && goB.length === 4 && !goA.some(k => goB.includes(k)), J({ goA, goB }));
  check('no merge after the fix, exactly as with the exact addresses before the redirects (no new merge)', (after.clusters || []).length === 0 && (before.clusters || []).length === 0, J({ after: after.clusters, before: before.clusters }));
  const same = KITS.KWI.serpClusters([{ keyword: 'erp software uae', urls: goA, weight: 2 }, { keyword: 'erp software in uae', urls: urlsOf(page('erp software in uae', 'best')), weight: 1 }], opts);
  check('two searches showing the SAME complete pages still merge (the key is stable across readings)', (same.clusters || []).length === 1, J(same.clusters));

  // ---------- SG8 review H2: the -1 is said twice at most, raises one ops alert, and costs no extra checks ----------
  reset(); SN = 'SG8 SERP-GOTO review H2: an unreadable position is reported twice at most, one ops alert, unpublished rungs still deferred'; begin(SN);
  const planItem = (prev) => ({ ladder_id: 'lad_t', domain: 'techand.ai', keyword: 'erp software uae', rung: 4, device: 'desktop', competitors: [], prev_unread: prev });
  const runPP = async (prev) => { mock('Tracker Plan', [{ json: planItem(prev) }]); return (await run('Parse Positions', [{ json: withOurs }]))[0].json; };
  const p0 = await runPP(0), p1 = await runPP(1), p2 = await runPP(2);
  const st = (p) => JSON.parse(p.snapshot_json || '{}').st;
  check('re-review N1: the third week stays -1 (no drop can be computed: the hidden result most likely IS ours) and is marked settled (st: 1); weeks 1-2 are not',
    p0.position === -1 && p1.position === -1 && p2.position === -1 && st(p2) === 1 && !st(p0) && !st(p1), J([p0.position, p1.position, p2.position, st(p2)]));
  const trSrc = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), 'Tracker_Report.js'), 'utf8');
  check('the Tracker Report words an unread reading as such ("not found among the results we could read"), never "check failed" or a drop',
    /const posText = \(v, note\) =>/.test(trSrc) && /unread_note: cur === -1 \? RS\.unreadNote\(it\.result\.snapshot_json\)/.test(trSrc) && !/posText\(r\.current\)/.test(trSrc)
    && (await su('unreadNote', p2.snapshot_json)) === 'not found among the results we could read' && (await su('unreadNote', p0.snapshot_json)) === 'could not be told: a result Google hid may be yours');
  const hr = (at, pos, snap) => ({ keyword: 'k', checked_at: at, position: pos, url: '', snapshot_json: J(snap) });
  const now = '2026-11-23T01:00:00Z';   // a Monday
  const wk = await su('unreadWeeks', [hr('2026-11-16T01:00:00Z', -1, { mo: 1 }), hr('2026-11-18T09:00:00Z', -1, { mo: 1 }), hr('2026-11-09T01:00:00Z', -1, { mo: 1 }), hr('2026-11-02T01:00:00Z', 7, { top: [] })], { now });
  const wkSame = await su('unreadWeeks', [hr('2026-11-16T01:00:00Z', -1, { mo: 1 }), hr('2026-11-17T01:00:00Z', -1, { mo: 1 }), hr('2026-11-19T01:00:00Z', -1, { mo: 1 })], { now });
  const wkFail = await su('unreadWeeks', [hr('2026-11-16T01:00:00Z', -1, { mo: 1 }), hr('2026-11-09T01:00:00Z', -1, { unavailable: true }), hr('2026-11-02T01:00:00Z', -1, { mo: 1 })], { now });
  const wkThis = await su('unreadWeeks', [hr('2026-11-23T00:30:00Z', -1, { mo: 1 })], { now });
  check('re-review N1: the streak counts CALENDAR WEEKS (a re-check in the same week is one), a failed read ends it, this week does not count',
    wk === 2 && wkSame === 1 && wkFail === 1 && wkThis === 0, J({ wk, wkSame, wkFail, wkThis }));
  mock('Tracker Plan', [{ json: planItem(1) }]); mock('Parse Positions', [{ json: p1 }]);
  const al = (await run('Unread Alert Row (Tracker)', [{ json: {} }]))[0].json;
  check('the second one in a row writes ONE ops alert row (undelivered, due now, so the sweep in the same run sends it); `delivered` is never written here',
    al.alert_key && /rank-unread\|techand\.ai\|/.test(al.alert_key) && al.attempts === 0 && al.next_attempt_at && !('delivered' in al) && /erp software uae/.test(al.message), J(al));
  mock('Tracker Plan', [{ json: planItem(0) }]); mock('Parse Positions', [{ json: p0 }]);
  const al0 = (await run('Unread Alert Row (Tracker)', [{ json: {} }]))[0].json;
  mock('Tracker Plan', [{ json: planItem(2) }]); mock('Parse Positions', [{ json: p2 }]);
  const al2 = (await run('Unread Alert Row (Tracker)', [{ json: {} }]))[0].json;
  check('the first one and the third one write no alert (one alert per streak)', al0.skip === true && al2.skip === true, J([al0, al2]));
  mock('Tracker Plan', [{ json: planItem(1) }, { json: { ...planItem(1), keyword: 'erp system dubai' } }]); mock('Parse Positions', [{ json: p1 }, { json: { ...p1, keyword: 'erp system dubai' } }]);
  const al3 = (await run('Unread Alert Row (Tracker)', [{ json: {} }])).map(i => i.json);
  check('re-review N3: two keywords of one site on the same day are two alert rows with their own keys (one shared key was overwritten and never sent)',
    al3.length === 2 && new Set(al3.map(x => x.alert_key)).size === 2 && al3.every(x => /\|20\d\d-\d\d-\d\d$/.test(x.alert_key)), J(al3.map(x => x.alert_key)));
  const big = await kit({ serp: withOurs, domain: 'techand.ai', max: 60 });
  const packed = JSON.parse(big.packed);
  check('re-review N4: a reading too long to store keeps the markers the next plan reads (mo, ur), so the streak, the deferral and the alert do not stop',
    packed.trimmed === 'overflow' && packed.mo === 1 && packed.ur === 1, J(packed));
  mock('Site SERP Requests', [{ json: { site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'erp software uae', competitors: [], prev_unread: 2 } }]);
  const sp = (await run('Parse Site SERP', [{ json: withOurs }]))[0].json;
  mock('Site SERP Requests', [{ json: { site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'erp software uae', competitors: [], prev_unread: 1 } }]);
  const sp1 = (await run('Parse Site SERP', [{ json: withOurs }]))[0].json;
  check('Site Tracker: settled only from the third week of unread readings, and kept -1 with the marker (never a 0)',
    sp.position === -1 && JSON.parse(sp.snapshot_json).st === 1 && sp1.position === -1 && !JSON.parse(sp1.snapshot_json).st, J([sp.position, sp1.position]));
  const tpSrc = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), 'Tracker_Plan.js'), 'utf8');
  check('Tracker Plan (generated) skips poisoned rows (review L4), defers an unpublished rung after an unreadable -1 like a 0, and counts the streak',
    /!RS\.poisonedRow\(h\)\)\.sort/.test(tpSrc) && /Number\(lastH\.position\) === 0 \|\| unreadOf\(lastH\)/.test(tpSrc) && /prev_unread: prevUnread/.test(tpSrc));
  const wfT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflows', 'SEO_Agent_Rank_Tracker.json'), 'utf8'))[0];
  const outsT = (n) => (((wfT.connections[n] || {}).main) || []).map(l => (l || []).map(t => t.node));
  check('the alert row goes through the one existing ops alert path: Ensure Ops Alerts -> Unread Alert Row -> IF -> Save -> Load Open Alerts (the sweep)',
    J(outsT('Ensure Ops Alerts (Tracker)')) === J([['Unread Alert Row (Tracker)']]) && J(outsT('Unread Alert? (Tracker)')) === J([['Save Unread Alert (Tracker)'], ['Load Open Alerts (Tracker)']])
    && J(outsT('Save Unread Alert (Tracker)')) === J([['Load Open Alerts (Tracker)']]), J([outsT('Ensure Ops Alerts (Tracker)'), outsT('Unread Alert? (Tracker)')]));
};
