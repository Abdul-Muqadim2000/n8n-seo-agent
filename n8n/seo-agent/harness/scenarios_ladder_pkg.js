// LPK1-LPK8 (LADDER PACKAGE 2026-11-09, docs/keyword-intel-2026-11-08/fixes/LADDER.md; build_v4.py section 183): the five ladder rules and the
// keyword-intelligence pool, on the shapes production stored (techand.ai and devaicon.com seo_ladders / seo_content_log, 2026-11-08; public
// addresses only, no personal data).
//   LPK1  the kit (v5/code/_ladder_rules.js): market lock, stage, definitions, copies and blog addresses, owners, one address per search,
//         verdict stop, stuck rungs, the rung reason, the KI pool rule
//   LPK2  Ladder Duplicate (Words): a new ladder whose market contradicts the lock is refused before anything is paid; everything else passes
//         through unchanged (byte for byte)
//   LPK3  Ladder Plan golden: a plan the rules have nothing to say about is unchanged (no moved page, no added rung, nothing stopped)
//   LPK4  Ladder Plan rule 1: the main page never on a "-2" copy (the original improves) nor on a blog address
//   LPK5  Ladder Plan rules 2 + 4: a plan with no compare / hire rung takes one from its pool; a definition rung needs an informational results
//         page; a rung the site's own checks advised against is stored `stopped` (Ladder Rows) and never written
//   LPK6  Parse Verdict + Ladder Row Written: an AVOID / clearly-low verdict stops a ladder page even when the ladder started it (no shadow);
//         "Write it anyway" writes it; the row goes `stopped` with the reason; a non-ladder automatic run keeps its shadow hold
//   LPK7  Cadence Plan + Publish Candidates + publishedRows: a rung is never written or recorded on another search's address
//   LPK8  KI Pool (Ladder) / Ladder Requests / Ladder Pool: keyword intelligence is the pool only when the site is `on` (not trial) and the kill
//         switch is off, current run only; the three keyword pulls are skipped then, the ranked pull stays
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const fs = require('fs');
  const path = require('path');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const EMPTY = [{ json: {} }];
  const V5 = path.join(__dirname, '..', 'v5', 'code');
  const SRC = (f) => fs.readFileSync(path.join(V5, f), 'utf8');
  const LRU = new Function(SRC('_fit_gate.js') + '\n' + SRC('_ladder_rules.js') + '\nreturn LRU;')();
  const PR = new Function(SRC('_fit_gate.js') + '\n' + SRC('_ladder_rules.js') + '\n' + SRC('_publish_rows.js') + '\nreturn publishedRows;')();
  const T = 'https://www.techand.ai';

  // ---------- LPK1 the kit ----------
  await guard('LPK1 kit', async () => {
    reset(); const SN = 'LPK1 the ladder rules kit: market lock, stage, definitions, copies, owners, one address per search, verdict stop, stuck rungs, rung reason, KI pool'; begin(SN); const check = mkCheck(SN);
    // rule 3
    const g = LRU.market({ keyword: 'ai automation solutions gcc', site_iso: 'AE', request_iso: 'PK' });
    check('devaicon.com "ai automation solutions gcc" (sent with Pakistan) is measured in the UAE, the request does not match', g.iso === 'AE' && g.ok === false && g.named.includes('gcc') && g.country === 'United Arab Emirates', J(g));
    const pk = LRU.market({ keyword: 'ai automation services pakistan', site_iso: 'AE', request_iso: 'AE' });
    check('a keyword naming Pakistan stays in Pakistan and says so', pk.iso === 'PK' && pk.source === 'keyword' && /measured in Pakistan, not in your website's market \(United Arab Emirates\)/.test(pk.note), J(pk));
    const plain = LRU.market({ keyword: 'dynamics 365 erp system', site_iso: 'AE', request_iso: 'AE' });
    check('a keyword naming no place is the website\'s market', plain.iso === 'AE' && plain.ok && plain.source === 'site', J(plain));
    const qa = LRU.market({ keyword: 'erp software qatar', site_iso: 'AE', request_iso: 'AE' });
    check('a market we cannot measure (Qatar) keeps the website\'s, said so', qa.iso === 'AE' && qa.ok && /cannot measure/.test(qa.note), J(qa));
    const gccPk = LRU.market({ keyword: 'erp software gcc', site_iso: 'PK', request_iso: 'PK' });
    check('a GCC keyword on a Pakistan website is measured in the GCC\'s first measurable country, never Pakistan', gccPk.iso === 'AE' && gccPk.ok === false, J(gccPk));
    check('the refusal names the market to use and says nothing was planned', /start it again in United Arab Emirates/.test(LRU.marketRefusal(g, 'ai automation solutions gcc')), LRU.marketRefusal(g, 'ai automation solutions gcc'));
    // rule 2
    const st = (k) => LRU.stageOf(k, '');
    check('stages: provider / company searches are hire, best / vs compare, definitions info, products solution, deadlines problem',
      st('crm service provider') === 'hire' && st('ai development companies') === 'hire' && st('dynamics 365 partner uae') === 'hire' && st('best crm software for customer service') === 'compare'
      && st('what is a crm company') === 'info' && st('is microsoft dynamics 365 an erp system') === 'info' && st('ms 365 erp') === 'solution' && st('e invoicing penalties uae') === 'problem',
      J(['crm service provider', 'what is a crm company', 'ms 365 erp', 'best crm software for customer service', 'e invoicing penalties uae'].map(k => [k, st(k)])));
    check('a stored KI stage wins over the words', LRU.stageOf('ms 365 erp', '', 'compare') === 'compare', '');
    check('"what is a crm company" is a definition of a seller; "what is an erp system" is not', LRU.isDefinitional('what is a crm company') && !LRU.isDefinitional('what is an erp system'), '');
    check('a definition stays only on an informational results page that links up', LRU.definitionalOk({ serp_informational: true, links_up: true }) && !LRU.definitionalOk({ serp_informational: false, links_up: true }), '');
    // rule 1
    const known = [T + '/dynamics-365-crm-uae', T + '/dynamics-365-crm-uae-2', T + '/step'];
    check('"/dynamics-365-crm-uae-2" is a copy of the live /dynamics-365-crm-uae; "/step-2" only when /step exists; "-copy" always',
      LRU.copyOf(T + '/dynamics-365-crm-uae-2', known) === T + '/dynamics-365-crm-uae' && LRU.copyOf(T + '/step-2', known) === T + '/step' && LRU.copyOf(T + '/phase-2', known) === '' && !!LRU.copyOf(T + '/about-copy', known), '');
    check('review L1: /windows-11, /top-10, /ai-agents-new, /d365-v9 are not copies; /step-2 beside a /step with another title is not either',
      !LRU.copyOf(T + '/windows-11', [T + '/windows']) && !LRU.copyOf(T + '/ai-agents-new', [T + '/ai-agents']) && !LRU.copyOf(T + '/d365-v9', [T + '/d365'])
      && !LRU.copyOf(T + '/step-2', [{ url: T + '/step', title: 'Step one' }, { url: T + '/step-2', title: 'Step two' }]) && LRU.copyOf(T + '/x-2', [{ url: T + '/x', title: 'CRM UAE' }, { url: T + '/x-2', title: 'CRM UAE' }]) === T + '/x', '');
    check('review L2: a language prefix is read past (/en/blog/x is a blog address)', LRU.isBlog(T + '/en/blog/x') && !LRU.isBlog(T + '/en/services'), '');
    check('review M1: a request inside the region the keyword names is that market ("erp software gcc" sent with Saudi Arabia)', LRU.market({ keyword: 'erp software gcc', site_iso: 'AE', request_iso: 'SA' }).ok === true
      && LRU.market({ keyword: 'erp software gcc', site_iso: 'AE', request_iso: 'SA' }).iso === 'SA', J(LRU.market({ keyword: 'erp software gcc', site_iso: 'AE', request_iso: 'SA' })));
    const BL = T + '/insights/is-microsoft-dynamics-365-an-erp-system';
    check('review H5: ranksFor - the rank reading at #16 or a Search Console query at #26.5 with the keyword\'s words keeps the address; nothing = false',
      LRU.ranksFor(BL, 'dynamics 365 erp system', { rank: { position: 16, url: BL } }) && LRU.ranksFor(BL, 'dynamics 365 erp', { pages: [{ url: BL, queries: [{ query: 'dynamics 365 erp', position: 26.5, impressions: 89 }] }] })
      && !LRU.ranksFor(BL, 'dynamics 365 erp system', { rank: { position: 45, url: BL }, pages: [] }) && !LRU.ranksFor(BL, 'dynamics 365 erp system', {}), '');
    check('/insights/... is a blog address, / and /services/... are not', LRU.isBlog(T + '/insights/is-microsoft-dynamics-365-an-erp-system') && !LRU.isBlog(T + '/') && !LRU.isBlog(T + '/services/erp'), '');
    const ERP = T + '/insights/is-microsoft-dynamics-365-an-erp-system';
    const own = [{ url: ERP + '/', keyword: 'is microsoft dynamics 365 an erp system', ladder_id: 'lad_mvjsa7995bsr' }];
    check('the ERP guide\'s address (any host form) belongs to its own search, not to "microsoft dynamics erp"',
      !!LRU.ownerOf('https://techand.ai/insights/is-microsoft-dynamics-365-an-erp-system', 'microsoft dynamics erp', own) && LRU.ownerOf(ERP, 'is microsoft dynamics 365 an erp systems', own) === null, '');
    const ou = LRU.oneUrl([{ keyword: 'dynamics 365 erp system', target_url: 'https://x.ai/a' }, { keyword: 'microsoft dynamics erp', target_url: 'https://www.x.ai/a/' }, { keyword: 'dynamics 365 erp systems', target_url: 'https://x.ai/a' }], (k) => 'https://x.ai/' + k.replace(/ /g, '-'));
    check('one address per search: a different search gets its own page, the same search joins', ou.pages.length === 2 && ou.pages[1].target_url === 'https://x.ai/microsoft-dynamics-erp' && ou.pages[1].exists === false
      && (ou.pages[0].supporting || []).includes('dynamics 365 erp systems') && ou.moved.length === 2, J(ou));
    // rule 4
    const v = (o) => LRU.verdictStop(o);
    check('AVOID stops, a score under 40 stops, 55 does not, "Write it anyway" overrides', v({ verdict: 'AVOID', score: 30 }).stop && v({ verdict: 'GO', score: 38 }).stop && !v({ verdict: 'GO_WITH_CHANGES', score: 55 }).stop
      && !v({ verdict: 'AVOID', score: 30, ack: true }).stop && v({ verdict: 'AVOID', score: 30, ack: true }).overridden === true && /AVOID, score 30/.test(v({ verdict: 'AVOID', score: 30 }).reason), '');
    // rule 5
    const s = (o) => LRU.stuck({ status: 'writing', since: '2026-11-05T01:33:00Z', ...o });
    check('a rung writing 87 minutes with nothing alive is stuck; 27 minutes is not; a live run never is; an unread engine never is',
      s({ live: false, now: '2026-11-05T03:00:00Z' }).stuck && !s({ live: false, now: '2026-11-05T02:00:00Z' }).stuck && !s({ live: true, now: '2026-11-06T02:00:00Z' }).stuck && !s({ live: null, now: '2026-11-06T02:00:00Z' }).stuck
      && s({ live: false, now: '2026-11-05T03:00:00Z' }).limit === 60, J(s({ live: false, now: '2026-11-05T03:00:00Z' })));
    check('the limit is three times a longer expected time', LRU.stuck({ status: 'started', since: '2026-11-05T00:00:00Z', eta_minutes: 40, live: false, now: '2026-11-05T01:50:00Z' }).stuck === false
      && LRU.stuck({ status: 'started', since: '2026-11-05T00:00:00Z', eta_minutes: 40, live: false, now: '2026-11-05T02:01:00Z' }).stuck === true, '');
    check('a planned or published row is never stuck', !LRU.stuck({ status: 'planned', since: '2026-01-01T00:00:00Z', live: false, now: '2026-11-05T00:00:00Z' }).stuck, '');
    const rs = LRU.rungState({ status: 'stopped', status_note: 'stopped: our check advised against this page (AVOID, score 30)', target_url: T + '/insights/crm-for-customers' });
    check('the rung reason: stopped with its reason; a planned page that exists improves; a new page names its address', rs.state === 'stopped' && /AVOID, score 30/.test(rs.why)
      && LRU.rungState({ status: 'planned', page_exists: true, target_url: T + '/dynamics-365-crm-uae' }).state === 'improve' && /\/ai-app-development/.test(LRU.rungState({ status: 'planned', target_url: 'https://devaicon.com/ai-app-development' }).why), J(rs));
    // rule 6
    const runs = [{ kind: 'keyword_research', status: 'ok', market: 'AE-en', run_id: 'kr_new', finished_at: '2026-11-08T20:00:00Z' }, { kind: 'keyword_research', status: 'ok', market: 'AE-en', run_id: 'kr_old', finished_at: '2026-11-01T20:00:00Z' }];
    const row = (k, extra) => ({ keyword: k, market: 'AE-en', run_id: 'kr_new', gate: 'pass', verdict: 'months', is_head: true, ...(extra || {}) });
    const rows = [row('peppol pint uae'), row('dynamics ax dubai'), row('d365 cloud migration uae'), row('dynamics 365 finance and operations uae', { is_head: false }), row('crm for customers', { gate: 'fail', gate_reason: 'avoid' }), { ...row('old one'), run_id: 'kr_old' }];
    const kp = LRU.kiPool({ mode: 'on', killed: false, rows, runs, market: 'AE-en' });
    check('on + kill switch off + a finished run: the current run\'s heads that passed the gate, the avoid list beside', kp.used && J(kp.rows.map(r => r.keyword)) === J(['peppol pint uae', 'dynamics ax dubai', 'd365 cloud migration uae']) && J(kp.avoid) === J(['crm for customers']) && kp.run_id === 'kr_new', J(kp));
    check('trial, off, killed or an unread kill switch: not used (fails closed)', !LRU.kiPool({ mode: 'trial', killed: false, rows, runs, market: 'AE-en' }).used && !LRU.kiPool({ mode: '', killed: false, rows, runs }).used
      && !LRU.kiPool({ mode: 'on', killed: true, rows, runs, market: 'AE-en' }).used && !LRU.kiPool({ mode: 'on', killed: null, rows, runs, market: 'AE-en' }).used, '');
    check('another market\'s run, or fewer than 3 heads: not used, said so', !LRU.kiPool({ mode: 'on', killed: false, rows, runs, market: 'PK-en' }).used && /only 2 usable/.test(LRU.kiPool({ mode: 'on', killed: false, rows: rows.slice(1), runs, market: 'AE-en' }).note), '');
  });

  // ---------- LPK2 the market lock before anything is paid ----------
  await guard('LPK2 market lock', async () => {
    reset(); const SN = 'LPK2 Ladder Duplicate (Words): a new ladder sent for another market than the website\'s (or the keyword\'s) is refused before any paid step; the rest passes unchanged'; begin(SN); const check = mkCheck(SN);
    const go = async (rl, site) => { reset(); mock('Rate Limit', [{ json: rl }]); mock('Load Ladders (Dup Check)', EMPTY); mock('Load Ladder Settings (Dup Check)', EMPTY);
      mock('Load Site (Market Check)', site ? [{ json: site }] : EMPTY); return (await run('Ladder Duplicate (Words)', EMPTY))[0].json; };
    const DV = { site_id: 'site_devaicon-com', domain: 'devaicon.com', country: 'United Arab Emirates', location_code: 2784 };
    const base = { mode: 'ladder', keyword: 'ai automation solutions gcc', domain: 'devaicon.com', country: 'Pakistan', country_iso: 'PK', location_code: 2586, client_ip: 'app:org-anon' };
    const a = await go(base, DV);
    check('devaicon.com, "ai automation solutions gcc" sent with Pakistan: refused, the UAE named, nothing charged', !!a.validation_error && a.refusal && a.refusal.reason === 'market' && a.refusal.market === 'AE' && a.refusal.before_paid_steps === true
      && /start it again in United Arab Emirates/.test(a.validation_error) && /nothing was charged/.test(a.validation_error), J(a.refusal) + ' ' + a.validation_error);
    const okIn = { ...base, country: 'United Arab Emirates', country_iso: 'AE', location_code: 2784 };
    const b = await go(okIn, DV);
    check('the same keyword sent with the UAE passes unchanged (byte for byte)', J(b) === J(okIn), J(b));
    const c = await go({ ...okIn, keyword: 'ai automation services pakistan' }, DV);
    check('a keyword naming Pakistan sent with the UAE: refused, Pakistan named', c.refusal && c.refusal.market === 'PK' && /Pakistan/.test(c.validation_error), J(c.refusal));
    const d0 = { ...base, keyword: 'ai automation company' };
    const d = await go(d0, DV);
    check('a keyword naming no place sent with Pakistan for a UAE website: refused, with "confirm ... on purpose"', d.refusal && d.refusal.market === 'AE' && /on purpose/.test(d.validation_error), d.validation_error);
    const e = await go({ ...d0, market_ack: true }, DV);
    check('...and with the client\'s market_ack it passes unchanged', !e.validation_error && e.market_ack === true, J(e));
    const f = await go({ ...base, market_ack: true }, DV);
    check('market_ack never moves a GCC keyword to Pakistan', !!f.validation_error && f.refusal.reason === 'market', J(f.refusal));
    const g0 = { mode: 'ladder', keyword: 'e invoicing in uae', domain: 'techand.ai', country: 'United Arab Emirates', country_iso: 'AE', client_ip: 'app:org-anon' };
    const g = await go(g0, null);
    check('no seo_sites row yet (a new website): a UAE keyword sent with the UAE passes unchanged', J(g) === J(g0), J(g));
    const h0 = { ...base, client_ip: 'ladder:lad_mvpd7x01f657', mode: 'keyword' };
    check('a page run and every other mode pass unchanged', J(await go(h0, DV)) === J(h0) && J(await go({ ...base, mode: 'verdict' }, DV)) === J({ ...base, mode: 'verdict' }), '');
  });

  // ---------- a ladder plan through the real nodes (the pool on, as scenarios_ladder_picture.js) ----------
  const serpOf = (urls, kw, titles) => ({ status_code: 20000, tasks: [{ id: 't-' + kw.replace(/\W+/g, '-'), status_code: 20000, status_message: 'Ok.', cost: 0.002,
    result: [{ keyword: kw, items: urls.map((u, i) => ({ type: 'organic', rank_group: i + 1, url: 'https://' + u, domain: u.split('/')[0], title: (titles && titles[i]) || (kw + ' result ' + (i + 1)) })) }] }] });
  const cand = (keyword, pre_score, extra) => ({ keyword, volume: 90, kd: 0, cpc: 4, intent: 'commercial', pre_score, words: keyword.split(' ').length, traffic_potential: 12, ...(extra || {}) });
  const urlsFor = (kw) => Array.from({ length: 7 }, (_, i) => 'site' + i + '-' + kw.replace(/\W+/g, '') + '.example/' + i);
  const planOf = async (o) => {
    const F = require('./fixtures');
    mock('Start Form', F.forms.startLadder);
    const nL = await run('Normalize Input', F.forms.pageLadder);
    mock('Route Mode', nL); await run('Prepare Keyword Run', nL);
    mock('Fetch Sitemaps', [{ statusCode: 200, headers: {}, sitemap_xml: F.urlset(F.siteUrls) }]);
    const cuL = await run('Collect Site URLs', store['Fetch Sitemaps']);
    mock('Parse Analysis', { ...cuL[0].json, competitor_analysis: F.competitorAnalysis, competitors: [] });
    mock('Keyword Data', F.keywordOverview); mock('Site Authority', F.rankOverview(F.OUR));
    await run('Merge Keyword Data', store['Site Authority']);
    mock('Verdict Agent', { output: { ...F.verdictGo, expected_monthly_visits_top3: 90, time_to_rank_months: 9 } });
    const PV0 = (await run('Parse Verdict', store['Verdict Agent']))[0].json;
    const pv = { ...PV0, keyword: o.head, domain: o.domain || 'techand.ai', country: 'United Arab Emirates', country_iso: 'AE', site_urls: (o.pages || []).map(p => p.url), internal_link_candidates: [], secondary_keywords: [],
      existing_page: o.existing_page || null, keyword_data: { search_volume: 170, keyword_difficulty: o.kd == null ? 0 : o.kd, google_intent: 'commercial', cpc: 6 }, verdict: 'GO', chosen_by: 'client_typed', ladder_mode: 'auto',
      competitors_summary: [{ rank: 3, domain: 'visionet.com', url: 'https://visionet.com/d365', title: 'Dynamics 365', word_count: 1400 }, { rank: 4, domain: 'randgroup.com', url: 'https://randgroup.com/erp', title: 'ERP', word_count: 1600 }] };
    mock('Parse Verdict', pv);
    const pool = { ...pv, research: { pool_size: o.cands.length, candidates: o.cands, refused: [], failures: [] }, site_rankings: { count: 0, head: null, keywords: {}, available: false, top10: [] }, head_tokens: o.head.split(' '), head_geo: [],
      ...(o.ki_pool ? { ki_pool: o.ki_pool } : {}) };
    mock('Ladder Pool', pool);
    mock('Ladder Relevance Chunks', []); mock('Ladder Keyword Relevance', []); mock('After Count (Ladder Keyword Relevance)', []);
    const kws = o.cands.map(c => c.keyword);
    mock('Ladder Cluster Requests', kws.map((k, i) => ({ cluster_check: true, keyword: k, location_code: 2784, language_code: 'en', n: i + 1, of: kws.length,
      weight: (o.cands.find(c => c.keyword === k) || {}).pre_score || 0, volume: 90, asked: kws.length, cap: 24, cap_basis: '', candidates: kws.length, on_topic: kws.length, left_uncompared: 0 })));
    mock('Run Ladder Cluster SERP', kws.map(k => serpOf(urlsFor(k), k, (o.titles || {})[k])));
    mock('Ladder Cluster Retry', []); mock('Run Ladder Cluster SERP (Retry)', []);
    await run('Ladder Clusters', EMPTY);
    mock('Site Model', [{ json: { site_model: { domain: pv.domain, canonical_host: 'www.' + pv.domain, business_name: 'Tech&', business_facts: 'Dynamics 365 partner in Dubai since 2016, 40 consultants.', pages: (o.pages || []).map(p => ({ source: 'sitemap', queries: [], h1: '', ...p })) } } }]);
    mock('Load Site Cache', EMPTY); mock('Load Domain Ladders', EMPTY); mock('Load Domain Ladder Settings', EMPTY);
    mock('Load Content Log (Ladder)', (o.log && o.log.length) ? o.log.map(j => ({ json: j })) : EMPTY);
    mock('Load Site (Market Check)', [{ json: { site_id: 'site_' + pv.domain.replace(/[^a-z0-9]+/g, '-'), domain: pv.domain, country: 'United Arab Emirates', location_code: 2784 } }]);
    mock('Load Profile (Model)', [{ json: { site_id: 'site_techand-ai', domain: 'techand.ai', author_name: 'Omar Said', author_job_title: 'Practice lead', author_bio: 'Omar leads the Dynamics practice and has delivered more than 50 projects for companies in the Gulf.' } }]);
    mock('Ladder Titles', { page_titles: { asked: 0, read: [], failed: [], skip_reason: 'not part of this case' } });
    const out = (await run('Ladder Plan', []))[0].json;
    return out.ladder || out;
  };
  const pagesOf = (L) => (L.rungs || []).flatMap(r => r.pages || []);
  // re-review N3: the production titles of techand.ai's CRM page and its "-2" copy (seo_pages, 2026-11-08): different, and still one page
  const PAGES = [{ url: T + '/', title: 'Tech& | Microsoft Dynamics partner' }, { url: T + '/dynamics-365-crm-uae', title: 'Dynamics 365 CRM in Dubai & UAE: Sales and Service | Tech&' },
    { url: T + '/dynamics-365-crm-uae-2', title: 'Dynamics 365 CRM Services UAE | Tech' }, { url: T + '/insights/is-microsoft-dynamics-365-an-erp-system', title: 'Dynamics 365 ERP System: Right App for UAE Firms' },
    { url: T + '/dynamics-365-business-central-uae', title: 'Dynamics 365 Business Central UAE' }];

  // ---------- LPK3 golden: nothing for the rules to do ----------
  await guard('LPK3 golden', async () => {
    reset(); const SN = 'LPK3 Ladder Plan golden: a plan with a hire rung, its own addresses and no advice against it is left exactly as planned'; begin(SN); const check = mkCheck(SN);
    const L = await planOf({ head: 'dynamics 365 crm partner uae', cands: [cand('dynamics 365 crm implementation partner', 40), cand('dynamics 365 crm consultants uae', 30), cand('dynamics 365 crm pricing uae', 25)], pages: [PAGES[0]] });
    const R = L.ladder_rules || {};
    console.log('   golden ->', J({ plan: L.plan_type, pages: pagesOf(L).map(p => [p.keyword, p.stage, p.target_url]), top: [L.top.target_url, L.top.stage], rules: { hg: R.head_guard, ou: R.one_url, steps: R.steps && R.steps.added, st: R.stopped, df: R.definitional } }));
    check('a plan was made', L.planned === true && pagesOf(L).length >= 1, J({ planned: L.planned, refusal: L.refusal }));
    check('no address moved, nothing added, nothing stopped, nothing dropped as a definition', !R.head_guard && (R.one_url || []).length === 0 && !(R.steps || {}).added && (R.stopped || []).length === 0 && (R.definitional || []).length === 0, J(R));
    check('every page carries its stage and why it sits at its address', [...pagesOf(L), L.top].every(p => LRU.STAGES.includes(p.stage) && p.target_why && ['new', 'improve'].includes(p.action)), J([...pagesOf(L), L.top].map(p => [p.keyword, p.stage, p.target_why])));
    check('the market is stated: the website\'s, the UAE', L.market && L.market.iso === 'AE' && L.market.ok === true, J(L.market));
    check('the stored rows carry stage and target_why, every row planned or writing as before', (() => { mock('Attach PDF Ladder', [{ json: { ladder: L, pages_now: 1, domain: 'techand.ai', country: 'United Arab Emirates' } }]); return true; })(), '');
    const rows = (await run('Ladder Rows', EMPTY)).map(i => i.json);
    check('...Ladder Rows: one row per page, statuses planned / writing only, stage + target_why filled', rows.length === pagesOf(L).length + 1 && rows.every(r => ['planned', 'writing'].includes(r.status) && r.stage && r.target_why), J(rows.map(r => [r.keyword, r.status, r.stage])));
  });

  // ---------- LPK4 rule 1: the main page's own address ----------
  await guard('LPK4 head address', async () => {
    reset(); const SN = 'LPK4 Ladder Plan rule 1: the main page never on a "-2" copy of a live page (techand.ai CRM ladder) nor on a blog address (techand.ai ERP ladder)'; begin(SN); const check = mkCheck(SN);
    const C2 = T + '/dynamics-365-crm-uae-2';
    const L = await planOf({ head: 'crm service provider', cands: [cand('crm service provider dubai', 40), cand('best crm service provider uae', 30), cand('crm service provider pricing uae', 20)], pages: PAGES,
      existing_page: { url: C2, source: 'sitemap', title: 'Dynamics 365 CRM UAE', matched_by: 'title', confidence: 0.8, evidence: 'its title' } });
    check('the plan was made (3 keywords in the pool)', L.planned === true, J(L.refusal));
    console.log('   crm head ->', J({ url: L.top.target_url, exists: L.top.exists, guard: (L.ladder_rules || {}).head_guard }));
    check('the main page improves the original /dynamics-365-crm-uae, not its copy -2', L.top.target_url === T + '/dynamics-365-crm-uae' && L.top.exists === true && ((L.ladder_rules || {}).head_guard || {}).reason === 'copy', J(L.top));
    check('the plan says why', (L.notes || []).some(n => /main page's address: \/dynamics-365-crm-uae-2 is a copy of \/dynamics-365-crm-uae/.test(n)), J((L.notes || []).filter(n => /address/.test(n))));
    const B = T + '/insights/is-microsoft-dynamics-365-an-erp-system';
    const L2 = await planOf({ head: 'dynamics 365 erp system', cands: [cand('dynamics 365 erp implementation uae', 40), cand('dynamics 365 erp partner uae', 30), cand('dynamics 365 erp pricing uae', 20)], pages: PAGES,
      existing_page: { url: B, source: 'sitemap', title: 'Dynamics 365 ERP System: Right App for UAE Firms', matched_by: 'title', confidence: 0.9, evidence: 'its title' } });
    console.log('   erp head ->', J({ url: L2.top.target_url, exists: L2.top.exists, guard: (L2.ladder_rules || {}).head_guard }));
    check('the ERP main page leaves the blog address: a commercial page of the site or its own new page', L2.top.target_url !== B && !LRU.isBlog(L2.top.target_url) && ((L2.ladder_rules || {}).head_guard || {}).reason === 'blog', J(L2.top));
    check('no rung page shares the main page\'s address', !pagesOf(L2).some(p => LRU.urlKey(p.target_url) === LRU.urlKey(L2.top.target_url)), J(pagesOf(L2).map(p => p.target_url)));
    // review H5: the same blog address with Search Console showing it for the main keyword (techand.ai: #26.5 for "dynamics 365 erp", the head #16)
    const PQ = PAGES.map(p => p.url === B ? { ...p, queries: [{ query: 'dynamics 365 erp system', position: 26.5, impressions: 28 }] } : p);
    const L3 = await planOf({ head: 'dynamics 365 erp system', cands: [cand('dynamics 365 erp implementation uae', 40), cand('dynamics 365 erp partner uae', 30), cand('dynamics 365 erp pricing uae', 20)], pages: PQ,
      existing_page: { url: B, source: 'sitemap', title: 'Dynamics 365 ERP System: Right App for UAE Firms', matched_by: 'title', confidence: 0.9, evidence: 'its title' } });
    console.log('   erp head (ranks) ->', J({ url: L3.top.target_url, guard: (L3.ladder_rules || {}).head_guard }));
    check('review H5: a blog address that ranks for the main keyword KEEPS it (improve), never a competing new page; the plan says why',
      L3.top.target_url === B && L3.top.exists === true && ((L3.ladder_rules || {}).head_guard || {}).reason === 'ranks' && (L3.notes || []).some(n => /already ranks for "dynamics 365 erp system", so the main page improves it/.test(n)), J(L3.top));
    mock('Attach PDF Ladder', [{ json: { ladder: L2, pages_now: 1, domain: 'techand.ai', country: 'United Arab Emirates' } }]);
    const rows2 = (await run('Ladder Rows', EMPTY)).map(i => i.json);
    check('re-review N1: a main page moved off a BLOG address asks for no redirect (the article may be another rung\'s live page)',
      !/^moved from /.test((rows2.find(r => r.rung === 4) || {}).target_why || ''), J(rows2.find(r => r.rung === 4)));
    mock('Attach PDF Ladder', [{ json: { ladder: L, pages_now: 1, domain: 'techand.ai', country: 'United Arab Emirates' } }]);
    const rows1 = (await run('Ladder Rows', EMPTY)).map(i => i.json);
    check('...a main page moved off a "-2" copy does (the app turns it into the redirect step indexing:merge)',
      /^moved from https:\/\/www\.techand\.ai\/dynamics-365-crm-uae-2: /.test((rows1.find(r => r.rung === 4) || {}).target_why || ''), J(rows1.find(r => r.rung === 4)));
    check('re-review N3: the kit calls the production "-2" a copy with its real (different) titles, and with addresses only, as the cadence once did',
      LRU.copyOf(T + '/dynamics-365-crm-uae-2', PAGES) === T + '/dynamics-365-crm-uae' && LRU.copyOf(T + '/dynamics-365-crm-uae-2', PAGES.map(p => p.url)) === T + '/dynamics-365-crm-uae', '');
  });

  // ---------- LPK5 rules 2 and 4 in the plan ----------
  await guard('LPK5 steps, definitions, stops', async () => {
    reset(); const SN = 'LPK5 Ladder Plan rules 2 + 4: a commercial step before the main page, definitions only on guide results, the site\'s own AVOID stops a rung'; begin(SN); const check = mkCheck(SN);
    // the techand ERP ladder's rungs: a definition and product searches, with a partner search in the pool that lost its page to the rung limit
    const C = [cand('is microsoft dynamics 365 an erp system', 60, { intent: 'informational' }), cand('ms 365 erp', 55), cand('microsoft dynamics erp', 50), cand('dynamics 365 erp modules', 48),
      cand('dynamics 365 erp features', 46), cand('dynamics 365 erp partner uae', 10)];
    const L = await planOf({ head: 'dynamics 365 erp system', cands: C, pages: [PAGES[0]], kd: 25 });
    const R = L.ladder_rules || {};
    console.log('   steps ->', J({ plan: L.plan_type, pages: pagesOf(L).map(p => [p.keyword, p.stage]), steps: R.steps }));
    const checked = (R.steps || {}).checked;
    check('a short or full plan is checked for a commercial step (direct plans write the main page first)', L.plan_type === 'direct' ? !checked : checked === true, J({ plan: L.plan_type, steps: R.steps }));
    if (checked) {
      check('no compare / hire rung among the supporting pages, so "dynamics 365 erp partner uae" (hire) was added before the main page', ((R.steps || {}).added || {}).keyword === 'dynamics 365 erp partner uae'
        && pagesOf(L).some(p => p.keyword === 'dynamics 365 erp partner uae' && p.stage === 'hire'), J(R.steps));
      check('the plan says so', (L.notes || []).some(n => /had no page for people comparing or choosing a provider, so "dynamics 365 erp partner uae"/.test(n)), J((L.notes || []).filter(n => /comparing/.test(n))));
    }
    // review L6: a SHORT plan that already has a hire rung is left exactly as planned (no added rung, no moved address)
    const G2 = await planOf({ head: 'dynamics 365 erp system', cands: [cand('dynamics 365 erp modules', 60), cand('dynamics 365 erp partner dubai', 50), cand('dynamics 365 erp features', 40)], pages: [PAGES[0]], kd: 25 });
    const R2 = G2.ladder_rules || {};
    check('short-plan golden: commercial step already there, nothing added, no address moved', G2.plan_type !== 'direct' && (R2.steps || {}).checked === true && (R2.steps || {}).commercial_before === true && !(R2.steps || {}).added && (R2.one_url || []).length === 0 && !R2.head_guard,
      J({ plan: G2.plan_type, steps: R2.steps, ou: R2.one_url }));
    // a definition on a results page of lists, and the same on a page of guides
    const D = [cand('what is a crm company', 60, { intent: 'informational' }), cand('crm service provider dubai', 40), cand('best crm service provider uae', 30)];
    const lists = Array.from({ length: 7 }, (_, i) => 'Top ' + (10 + i) + ' CRM companies in Dubai');
    const guides = Array.from({ length: 7 }, (_, i) => 'What is a CRM company? A guide ' + i);
    const L3 = await planOf({ head: 'crm service provider', cands: D, pages: [PAGES[0]], titles: { 'what is a crm company': lists } });
    console.log('   definition (lists) ->', J({ pages: pagesOf(L3).map(p => p.keyword), df: (L3.ladder_rules || {}).definitional }));
    check('"what is a crm company" on a results page of lists is not a rung; it waits, with the reason', !pagesOf(L3).some(p => p.keyword === 'what is a crm company') && ((L3.ladder_rules || {}).definitional || []).some(x => x.keyword === 'what is a crm company')
      && (L3.later || []).some(x => x.keyword === 'what is a crm company'), J((L3.ladder_rules || {}).definitional));
    const L4 = await planOf({ head: 'crm service provider', cands: D, pages: [PAGES[0]], titles: { 'what is a crm company': guides } });
    check('...on a results page of guides it stays a rung (it links up to the main page)', pagesOf(L4).some(p => p.keyword === 'what is a crm company' && (p.links_to || []).some(l => l.role === 'top')), J(pagesOf(L4).map(p => p.keyword)));
    // the site's own AVOID (techand.ai content log, 2026-11-03: "crm for customers")
    const LOG = [{ site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'crm for customers', status: 'held', started_at: '2026-11-03T09:34:00Z', publish_note: '',
      qa_reasons: 'held for your OK: This page of your keyword ladder is stopped: our check advised against this page (AVOID, score 30)' }];
    const L5 = await planOf({ head: 'crm service provider', cands: [cand('crm for customers', 70), cand('crm service provider dubai', 40), cand('best crm service provider uae', 30)], pages: [PAGES[0]], log: LOG });
    console.log('   avoid ->', J({ pages: pagesOf(L5).map(p => p.keyword), stopped: (L5.stopped || []).map(p => [p.keyword, p.status, (p.stop || {}).reason]) }));
    check('"crm for customers" is not a page to write: it is stopped with its reason', !pagesOf(L5).some(p => p.keyword === 'crm for customers') && (L5.stopped || []).some(p => p.keyword === 'crm for customers' && p.status === 'stopped'), J(L5.stopped));
    check('...never in write_now or the link map', !(L5.write_now || []).some(w => w.keyword === 'crm for customers') && !(L5.link_map || []).some(l => /crm-for-customers/.test(l.to + l.from)), J(L5.write_now));
    mock('Attach PDF Ladder', [{ json: { ladder: L5, pages_now: 1, domain: 'techand.ai', country: 'United Arab Emirates' } }]);
    const rows = (await run('Ladder Rows', EMPTY)).map(i => i.json);
    const sr = rows.find(r => r.keyword === 'crm for customers');
    check('Ladder Rows stores it `stopped` with "stopped: ..." in status_note, so the cadence (planned rows only) never writes it', !!sr && sr.status === 'stopped' && /^stopped: /.test(sr.status_note), J(sr));
    const ru = await run('Build Ladder Response', [{ json: { ladder: L5, keyword: 'crm service provider', domain: 'techand.ai' } }]);
    check('the callback carries the stopped rung, the market and the rules', (ru[0].json.stopped || []).some(p => p.keyword === 'crm for customers' && p.reason) && ru[0].json.market && ru[0].json.ladder_rules, J(ru[0].json.stopped));
  });

  // ---------- LPK6 rule 4 at page-run time ----------
  await guard('LPK6 verdict stop', async () => {
    reset(); const SN = 'LPK6 Parse Verdict + Ladder Row Written: an AVOID or clearly-low verdict stops a ladder page started by the ladder itself; "Write it anyway" writes it; the row goes stopped'; begin(SN); const check = mkCheck(SN);
    const R = require('./replay')(H);
    const F = R.load('replay_3299.json.gz');
    const PB = F.nodes['Parse Brief']['0'].items[0].json;
    const PREV = (() => { const p = clone(PB); for (const k of ['verdict_hold', 'would_hold', 'hold', 'hold_shadow', 'hold_ack', 'verdict_acknowledged', 'duplicate_check']) delete p[k]; return p; })();
    const AGENT = { verdict: 'AVOID', score: 30, reasons: ['People searching it want a CRM product, not a partner.'], risks: [], what_must_change: [], secondary_keywords: [], recommended_page: 'Guide', expected_monthly_visits_top3: 1, time_to_rank_months: 7 };
    const LAD = { keyword: 'crm for customers', page_type: 'Guide', force_content: true, include_content: true, mode: 'keyword', ladder_id: 'lad_mw0goinsniv1', ladder_rung: 2, ladder_head: 'crm service provider',
      ladder_target_url: T + '/crm-for-customers', client_ip: 'ladder:lad_mw0goinsniv1', existing_page: null, existing_page_url: '' };
    const pv = async (over, agentOver) => { reset(); mock('Merge Keyword Data', [{ json: { ...PREV, ...LAD, ...(over || {}) } }]); mock('Load Site Cache', EMPTY);
      return (await run('Parse Verdict', [{ json: { output: { ...AGENT, ...(agentOver || {}) } } }]))[0].json; };
    const a = await pv();
    console.log('   ladder AVOID ->', J({ hold: a.verdict_hold, mode: a.hold_mode, kinds: (a.hold || {}).kinds, stop: (a.hold || {}).ladder_stop }));
    check('the ladder\'s own page run with AVOID 30: held for real (enforce, not shadow), kind ladder_stop', a.verdict_hold === true && a.hold_mode === 'enforce' && (a.hold.kinds || []).includes('ladder_stop') && a.hold.ladder_stop.band === 'avoid', J(a.hold));
    check('the reason names the ladder and says how to write it anyway', /keyword ladder "crm service provider" is stopped: our check advised against this page \(AVOID, score 30\)/.test(a.hold.reasons[0]) && /Write it anyway/.test(a.hold.reasons[0]), a.hold.reasons[0]);
    const low = await pv({}, { verdict: 'GO_WITH_CHANGES', score: 36 });
    check('review H4: a GO_WITH_CHANGES at 36 is never a stop: written as planned, recorded as a shadow hold (kind ladder_low) for the owner\'s review', low.verdict_hold === false && low.would_hold === true && low.hold_mode === 'shadow'
      && low.hold_shadow && (low.hold_shadow.kinds || []).includes('ladder_low') && !low.hold_shadow.ladder_stop, J({ h: low.verdict_hold, w: low.would_hold, m: low.hold_mode, hs: low.hold_shadow && low.hold_shadow.kinds }));
    const lowApp = await pv({ client_ip: 'app:0b1c2d3e-anon' }, { verdict: 'GO_WITH_CHANGES', score: 36 });
    check('...the same from the app\'s Write now: not held either (shadow only)', lowApp.verdict_hold === false && lowApp.hold_mode === 'shadow', J({ h: lowApp.verdict_hold, m: lowApp.hold_mode }));
    // review H3 (PROBEX): the CRM main page refreshing its own live address, GO_WITH_CHANGES 35, and then with AVOID
    const OWN = { ...LAD, keyword: 'crm service provider', ladder_rung: 4, ladder_target_url: T + '/dynamics-365-crm-uae', existing_page_url: T + '/dynamics-365-crm-uae', client_ip: 'cadence:site_techand-ai' };
    const own35 = await pv(OWN, { verdict: 'GO_WITH_CHANGES', score: 35 });
    check('review H3: the main page refreshing its own live page at 35: not held, no shadow hold', own35.verdict_hold === false && own35.hold === null && !(own35.hold_shadow && (own35.hold_shadow.kinds || []).includes('ladder_low')), J({ h: own35.verdict_hold, hs: own35.hold_shadow && own35.hold_shadow.kinds }));
    const ownAvoid = await pv(OWN, { verdict: 'AVOID', score: 30 });
    check('...and with AVOID: still not stopped (its own live page), the AVOID recorded in shadow', ownAvoid.verdict_hold === false && ownAvoid.hold_shadow && (ownAvoid.hold_shadow.kinds || []).includes('ladder_low'), J({ h: ownAvoid.verdict_hold, hs: ownAvoid.hold_shadow && ownAvoid.hold_shadow.kinds }));
    const ok = await pv({}, { verdict: 'GO_WITH_CHANGES', score: 62 });
    check('at 62 nothing stops it (the score hold still exempts ladder pages)', ok.verdict_hold === false && !(ok.hold && ok.hold.ladder_stop), J({ h: ok.verdict_hold, hs: ok.hold_shadow && ok.hold_shadow.kinds }));
    const ack = await pv({ hold_ack: { score: 30 } });
    check('"Write it anyway" (hold_ack): written, acknowledged', ack.verdict_hold === false && ack.verdict_acknowledged === true, J({ h: ack.verdict_hold, a: ack.verdict_acknowledged }));
    const cad = await pv({ ladder_id: '', ladder_rung: '', ladder_head: '', ladder_target_url: '', client_ip: 'cadence:site_techand-ai' }, { verdict: 'GO_WITH_CHANGES', score: 30 });
    check('control: a cadence page that is not a ladder page keeps its shadow hold (unchanged)', cad.verdict_hold === false && cad.hold_mode === 'shadow' && !!cad.hold_shadow, J({ h: cad.verdict_hold, m: cad.hold_mode }));
    // the row
    const rw = async (pvOut, logRow) => { reset(); mock('Normalize Input', [{ json: { ladder_id: LAD.ladder_id, keyword: LAD.keyword, client_ip: LAD.client_ip } }]); mock('Parse Verdict', [{ json: pvOut }]);
      mock('Content Log Row', [{ json: logRow }]); mock('Save Content Log (Run)', [{ json: { id: 26, keyword: LAD.keyword } }]); return (await run('Ladder Row Written', EMPTY))[0].json; };
    const r1 = await rw(a, { status: 'held', keyword: LAD.keyword });
    check('Ladder Row Written: writing -> stopped, "stopped: ..." with the reason and how to write it anyway', r1.status === 'stopped' && r1.from_status === 'writing' && /^stopped: our check advised against this page \(AVOID, score 30\)/.test(r1.status_note) && /Write it anyway/.test(r1.status_note), J(r1));
    const r2all = await (async () => { reset(); mock('Normalize Input', [{ json: { ladder_id: LAD.ladder_id, keyword: LAD.keyword, client_ip: LAD.client_ip } }]); mock('Parse Verdict', [{ json: ack }]);
      mock('Content Log Row', [{ json: { status: 'written', keyword: LAD.keyword } }]); mock('Save Content Log (Run)', [{ json: { id: 26, keyword: LAD.keyword } }]); return (await run('Ladder Row Written', EMPTY)).map(i => i.json); })();
    const r2 = r2all[0];
    check('control: a written page still goes written (unchanged)', r2.status === 'written' && r2.from_status === 'writing', J(r2));
    check('review H1: ...and a row the stuck watcher closed as failed is moved on too (a second item from failed)', r2all.length === 2 && r2all[1].from_status === 'failed' && r2all[1].status === 'written', J(r2all));
    // review M3: a ladder stop moves the row even when the content log kept an older row (no saved held row)
    reset(); mock('Normalize Input', [{ json: { ladder_id: LAD.ladder_id, keyword: LAD.keyword, client_ip: LAD.client_ip } }]); mock('Parse Verdict', [{ json: a }]);
    mock('Content Log Row', [{ json: { skip: true, reason: 'keeps its row' } }]); mock('Save Content Log (Run)', EMPTY);
    const r3 = (await run('Ladder Row Written', EMPTY))[0].json;
    check('review M3: a ladder stop with no new content-log row still sets the ladder row stopped', r3.status === 'stopped' && r3.from_status === 'writing', J(r3));
  });

  // ---------- LPK7 rule 1 at write and publish time ----------
  await guard('LPK7 write and publish', async () => {
    reset(); const SN = 'LPK7 Cadence Plan / Publish Candidates / publishedRows: a rung is never written or recorded live on another search\'s address'; begin(SN); const check = mkCheck(SN);
    const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cadence_levels.json'), 'utf8'));
    const RealDate = Date; const frozen = async (iso, fn) => { const TT = RealDate.parse(iso); class FD extends RealDate { constructor(...x) { if (x.length) super(...x); else super(TT); } static now() { return TT; } } global.Date = FD; try { return await fn(); } finally { global.Date = RealDate; } };
    const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
    const plan = async (c) => { reset(); const t = c.tables || {}; mock('Manual Run', [{ json: c.trigger || {} }]);
      for (const [k, v] of [['Load Sites', t.sites], ['Load Cadence', t.cadence], ['Load Ladders', t.ladders], ['Load Query History', t.query_history], ['Load Trends', t.trends], ['Load Content Log', t.content_log], ['Load Ladder Settings', t.ladder_settings],
        ['Load Main Keyword Ranks', t.ranks], ['Load AI Targets (Cadence)', t.ai_targets], ['Load AI Targets Writing (Cadence)', []], ['Load Monitors (Cadence)', t.monitors], ['Load Pages (Cadence)', t.pages], ['Load AI Brands (Cadence)', t.ai_brands],
        ['Load Skips (Cadence)', t.skips], ['Load Cost (Cadence)', t.cost], ['Load Cycle Jobs (Cadence)', t.cycle_jobs], ['Load Profiles (Cadence)', t.profiles]]) mock(k, items(v));
      return frozen(c.now, async () => (await run('Cadence Plan', [{ json: {} }])).map(i => i.json).filter(j => j.body)); };
    const C0 = FX.cases.find(c => c.name === 'level1_ladder_only');
    const p0 = await plan(C0);
    const lp0 = p0.find(p => p.source === 'ladder');
    check('baseline: level1_ladder_only writes the planned rung at its own address (unchanged)', !!lp0 && lp0.body.existing_page_url === '' && /crm-implementation-cost-uae/.test(lp0.body.ladder_target_url || '') && !lp0.address_note, J(lp0 && lp0.body));
    if (lp0) {
      const c1 = clone(C0); const head = c1.tables.ladders.find(l => Number(l.rung) === 4); const r1 = c1.tables.ladders.find(l => l.keyword === lp0.keyword);
      Object.assign(r1, { page_exists: true, target_url: head.target_url });   // the rung's row came to carry the main page's address (the ERP drift)
      const p1 = await plan(c1); const lp1 = p1.find(p => p.keyword === lp0.keyword);
      console.log('   drift ->', J({ existing: lp1 && lp1.body.existing_page_url, target: lp1 && lp1.body.ladder_target_url }));
      check('a rung whose row carries another search\'s live address is written as its own new page, never as a refresh of that page', !!lp1 && lp1.body.existing_page_url === '' && LRU.urlKey(lp1.body.ladder_target_url) !== LRU.urlKey(head.target_url)
        && /crm-implementation-cost-uae/.test(lp1.body.ladder_target_url), J(lp1 && lp1.body));
    }
    // publishedRows: one search, one address
    const ERP = T + '/insights/is-microsoft-dynamics-365-an-erp-system';
    const owners = [{ url: ERP, keyword: 'is microsoft dynamics 365 an erp system', ladder_id: 'lad_mvjsa7995bsr' }];
    const head = { ladder_id: 'lad_mvjsa7995bsr', keyword: 'dynamics 365 erp system', status: 'writing', page_type: 'Service Page', rung: 4 };
    const x = PR({ site_id: 'site_techand-ai', domain: 'techand.ai', keyword: head.keyword, url: ERP, live: true, log: null, ladder: head, request_id: '', now: '2026-11-09T10:00:00.000Z', owners });
    check('the main keyword reported live on the guide\'s address: the ladder row is NOT moved there, the conflict is said', x.ladder_row === null && x.url_conflict && /is already the page for "is microsoft dynamics 365 an erp system"/.test(x.url_conflict.text), J(x));
    const y = PR({ site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'is microsoft dynamics 365 an erp system', url: ERP, live: true, log: null, ladder: { ...head, keyword: 'is microsoft dynamics 365 an erp system', rung: 2 }, request_id: '', now: '2026-11-09T10:00:00.000Z', owners });
    check('the guide reported on its own address: recorded as before', y.ladder_row && y.ladder_row.status === 'published' && !y.url_conflict, J(y));
    const dm = PR({ site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'microsoft dynamics erp', url: ERP, live: true, log: { keyword: 'microsoft dynamics erp', existing_page_url: ERP, status: 'written' },
      ladder: { ...head, keyword: 'microsoft dynamics erp', rung: 3 }, request_id: '', now: '2026-11-09T10:00:00.000Z', owners });
    check('review H2: a deliberate refresh onto the guide (its content-log row names that page) is recorded: log row published, ladder row merged', dm.log_row.status === 'published' && dm.ladder_row && dm.ladder_row.status === 'merged', J(dm));
    check('...a non-deliberate one still records the content log (published), only the ladder row stays', x.log_row.status === 'published' && x.log_row.published_url === ERP, J(x.log_row));
    const z = PR({ site_id: 'site_techand-ai', domain: 'techand.ai', keyword: head.keyword, url: ERP, live: true, log: null, ladder: head, request_id: '', now: '2026-11-09T10:00:00.000Z' });
    check('control: without owners (an older caller) the row is built as before', z.ladder_row && z.ladder_row.target_url === ERP, J(z));
    // re-review N2: Detect Published never records a TITLE-only match on another search's address as this keyword's publish
    const detect = async (matched_by) => { reset();
      const cand = { key: 'dynamics 365 erp system', keyword: 'dynamics 365 erp system', source: 'ladder', log: null, ladder: head, written_at: '2026-10-29T01:28:13Z' };
      const st = { site_idx: 0, site_id: 'site_techand-ai', domain: 'techand.ai', candidates: [cand], sitemap: { ok: true }, notes: {}, inventory: [], fetches: matched_by === 'title' ? [ERP] : [],
        slug_matches: matched_by === 'slug' ? [{ key: cand.key, url: ERP, ukey: 'techand.ai/insights/is-microsoft-dynamics-365-an-erp-system', score: 95, matched_by: 'slug' }] : [],
        title_checks: matched_by === 'title' ? [{ key: cand.key, tokens: ['dynamics', '365', 'erp', 'system'], options: [{ url: ERP, ukey: 'techand.ai/insights/is-microsoft-dynamics-365-an-erp-system', slug_share: 0.6 }] }] : [] };
      mock('Match Slugs (Detect)', [{ json: { sites: [st] } }, ...(matched_by === 'title' ? [{ json: { fetch: true, url: ERP } }] : [])]);
      mock('Fetch Pages (Detect)', [{ json: { statusCode: 200, data: '<html><head><title>Dynamics 365 ERP System: Right App for UAE Firms | Tech</title></head><body><h1>Dynamics 365 ERP System</h1></body></html>' } }]);
      mock('Publish Candidates', [{ json: { site_id: 'site_techand-ai', owners } }]);
      return (await run('Detect Published', EMPTY))[0].json; };
    const dt = await detect('title');
    console.log('   detect (title on owned) ->', J({ logs: dt.log_rows.length, ladders: dt.ladder_rows.length, unmatched: dt.unmatched }));
    check('re-review N2: a title-only match of the main keyword on the guide\'s address records nothing (no content-log publish), with its note', dt.log_rows.length === 0 && dt.ladder_rows.length === 0
      && (dt.unmatched || []).some(u => u.keyword === 'dynamics 365 erp system' && /matched by its title only/.test(u.note)), J(dt));
    // Publish Candidates: the waiting main page whose "existing address" is the guide's is looked for at its own address only
    reset();
    mock('Site Plan', [{ json: { site_id: 'site_techand-ai', domain: 'techand.ai' } }]);
    mock('Site Model (Site)', EMPTY);
    mock('Load Content Log', [{ json: { site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'is microsoft dynamics 365 an erp system', status: 'published', published_url: ERP, ladder_id: 'lad_mvjsa7995bsr', started_at: '2026-10-22T17:21:56Z' } },
      { json: { site_id: 'site_techand-ai', domain: 'techand.ai', keyword: 'erp services uae', status: 'written', source: 'striking', existing_page_url: ERP, published_url: '', started_at: new Date().toISOString() } }]);
    mock('Load Ladders', [{ json: { ladder_id: 'lad_mvjsa7995bsr', domain: 'techand.ai', keyword: 'is microsoft dynamics 365 an erp system', status: 'published', target_url: ERP, page_exists: true, rung: 2 } },
      { json: { ladder_id: 'lad_mvjsa7995bsr', domain: 'techand.ai', keyword: 'dynamics 365 erp system', status: 'writing', target_url: ERP, page_exists: true, rung: 4, start_date: new Date().toISOString() } }]);
    const pc = (await run('Publish Candidates', EMPTY))[0].json;
    const hc = (pc.candidates || []).find(c => c.keyword === 'dynamics 365 erp system');
    console.log('   publish candidates ->', J(hc && { existing_url: hc.existing_url, planned: hc.planned_url, taken: hc.address_taken }));
    const cr = (pc.candidates || []).find(c => c.keyword === 'erp services uae');
    check('review H2: a cadence refresh (content log only, no ladder row) of an address a ladder page holds keeps its address to be matched on', !!cr && cr.existing_url === ERP && !cr.address_taken, J(cr));
    check('Publish Candidates: the main page is not matched on the guide\'s address (its "existing address" belongs to another search)', !!hc && hc.existing_url === '' && hc.address_taken && hc.address_taken.keyword === 'is microsoft dynamics 365 an erp system'
      && (pc.owners || []).length >= 1, J(hc));
  });

  // ---------- LPK8 rule 6: keyword intelligence as the pool ----------
  await guard('LPK8 KI pool', async () => {
    reset(); const SN = 'LPK8 KI Pool (Ladder) / Ladder Requests / Ladder Pool: KI clusters are the pool only for a website switched on (not trial), current run only; the keyword pulls are skipped then'; begin(SN); const check = mkCheck(SN);
    const SID = 'site_techand-ai';
    const runs = [{ site_id: SID, kind: 'keyword_research', status: 'ok', market: 'AE-en', run_id: 'kr_1108', finished_at: '2026-11-08T20:10:00Z' }];
    const kr = (k, extra) => ({ site_id: SID, keyword: k, market: 'AE-en', run_id: 'kr_1108', gate: 'pass', verdict: 'months', is_head: true, stage: 'solution', volume: 30, kd: 12, cpc: 5, ...(extra || {}) });
    const KROWS = [kr('peppol pint uae', { stage: 'solution', gsc_position: 19.6, gsc_page: T + '/insights/pint-ae' }), kr('dynamics ax dubai', { stage: 'hire', gsc_position: 8.4, page_action: 'refresh', page_url: T + '/dynamics-ax-upgrade' }),
      kr('d365 cloud migration uae', { stage: 'hire', gsc_position: 5.5 }), kr('dynamics 365 finance and operations uae', { stage: 'solution' }), kr('crm for customers', { gate: 'fail', gate_reason: 'avoid', verdict: 'gated' }),
      kr('randgroup dynamics', { gate: 'fail', gate_reason: 'other_brand', verdict: 'gated' }), { ...kr('older keyword'), run_id: 'kr_1101' }];
    const pool = async (mode, kill) => { reset(); mock('Parse Verdict', [{ json: { domain: 'techand.ai', keyword: 'dynamics 365 partner uae', language_code: 'en', country_iso: 'AE' } }]);
      mock('Normalize Input', [{ json: { country_iso: 'AE' } }]); mock('Load Monitors (Ladder)', [{ json: { site_id: SID, ki_mode: mode } }]);
      mock('Load KI Kill (Ladder)', kill ? [{ json: { key: 'ki:kill', value: '1' } }] : EMPTY); mock('Load KI Runs (Ladder)', runs.map(j => ({ json: j }))); mock('Load KI Keywords (Ladder)', KROWS.map(j => ({ json: j })));
      return (await run('KI Pool (Ladder)', EMPTY))[0].json.ki_pool; };
    const on = await pool('on', false);
    console.log('   ki pool on ->', J({ used: on.used, rows: on.rows.map(r => r.keyword), avoid: on.avoid, run: on.run_id }));
    check('on: the current run\'s heads that KI.readable lets through, never a gated row or an older run', on.used === true && J(on.rows.map(r => r.keyword).sort()) === J(['d365 cloud migration uae', 'dynamics 365 finance and operations uae', 'dynamics ax dubai', 'peppol pint uae']) && J(on.avoid) === J(['crm for customers']), J(on));
    const tr = await pool('trial', false);
    check('trial (both production sites today): not used, the ladder keeps its own research', tr.used === false && tr.rows.length === 0, J(tr));
    const ki = await pool('on', true);
    check('the kill switch on: not used', ki.used === false && ki.reason === 'killed', J(ki));
    // Ladder Requests: with KI on only the ranked pull is bought; otherwise the four pulls as before
    const req = async (kp) => { reset(); mock('Parse Verdict', [{ json: { domain: 'techand.ai', keyword: 'dynamics 365 partner uae', location_code: 2784, language_code: 'en', country_iso: 'AE', site_description: { products_or_services: ['ERP implementation'] }, secondary_keywords: [] } }]);
      mock('KI Pool (Ladder)', [{ json: { ki_pool: kp } }]); return (await run('Ladder Requests', EMPTY)).map(i => i.json.kind); };
    const k1 = await req(on), k0 = await req(tr);
    check('KI on: Ladder Requests buys only the ranked pull (the reach); trial: suggestions, related, ideas and ranked as before', J(k1) === J(['ranked']) && J(k0) === J(['suggestions', 'related', 'ideas', 'ranked']), J({ on: k1, trial: k0 }));
    // Ladder Pool: the KI heads are the candidates, with their Search Console positions
    const V = require('./fixtures_v5');
    reset();
    mock('Parse Verdict', [{ json: { keyword: 'dynamics 365 partner uae', domain: 'techand.ai', country: 'United Arab Emirates', location_code: 2784, language_code: 'en', goal: 'leads', business: 'Microsoft Dynamics 365 partner in the UAE', services: ['ERP implementation'],
      site_description: { business_description: 'Microsoft Dynamics 365 partner in the UAE', products_or_services: ['Dynamics 365', 'ERP implementation', 'Peppol e-invoicing'] }, competitors: [], competitors_summary: [] } }]);
    mock('Normalize Input', [{ json: { country_iso: 'AE' } }]);
    mock('Ladder Requests', [{ json: { kind: 'ranked', label: 'keywords techand.ai ranks for', domain: 'techand.ai', body: [{ target: 'techand.ai' }] } }]);
    mock('KI Pool (Ladder)', [{ json: { ki_pool: on } }]);
    mock('Load Site Cache', EMPTY);
    const lp = (await run('Ladder Pool', [V.task({ target: 'techand.ai', items: [] })]))[0].json;
    const cands = lp.research.candidates.map(c => c.keyword);
    console.log('   ladder pool (KI) ->', J({ cands, ki: lp.ki_pool && lp.ki_pool.used, rank: lp.site_rankings && lp.site_rankings.keywords['dynamics ax dubai'] }));
    check('the candidates are the KI heads (the ranked pull answered nothing, and that is not a failure here)', lp.ki_pool.used === true && cands.includes('dynamics ax dubai') && cands.includes('peppol pint uae') && !cands.includes('crm for customers') && !cands.includes('older keyword'), J(cands));
    check('a head\'s Search Console position becomes the site\'s ranking for it (striking distance stays visible to the plan)', ((lp.site_rankings || {}).keywords || {})['dynamics ax dubai'] && lp.site_rankings.keywords['dynamics ax dubai'].position === 8, J(lp.site_rankings));
    check('the KI stage travels with the candidate', (lp.research.candidates.find(c => c.keyword === 'dynamics ax dubai') || {}).stage === 'hire', '');
  });
};
