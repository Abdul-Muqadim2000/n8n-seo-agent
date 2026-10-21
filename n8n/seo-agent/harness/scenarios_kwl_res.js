// KR1-KR4 (KWL-RES 2026-10-21, live keyword test on the isolated stack, exec 111 / 125; scratchpad run/KW_LIVE_REPORT.md):
//   KR1  D1: a Search Console page the site model knows is gone (404) covers nothing: the keyword is not "already answered by a page you
//        have", the report never says "refresh" it, the live check's result on the gone address is not a position (no "Easy" from it), and
//        the card and the report say "the page that ranked for this no longer opens: redirect it, then this keyword has a head start"
//   KR2  D2: "artificial intelligence consultancy" / "artificial intelligence consulting" are the client's declared "AI consulting" (the
//        synonym map runs on both sides); a keyword about something else stays out
//   KR3  D10: a government foundation (dubaifuture.ae, and any domain whose own result names a Foundation / Authority / Council / Chamber /
//        Ministry or calls itself a government initiative) is never a competitor; a business's case study naming an authority is
//   KR4  D12 / D13: the research document has no em dash, ellipsis, "SERP", "PAA" or "DataForSEO", and a keyword that is not a fit (not one
//        of the services listed) carries no plan type or timeline
// Called from scenarios_v5.js just before the report (one appended line).
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const DOM = 'techand.ai';
  const GONE_URL = 'https://www.techand.ai/dynamics-365-finance-and-operations-uae';
  // exec 111's declared services and business line (the client "Techand Live Run")
  const SERVICES = ['AI consulting', 'AI and automation', 'Microsoft Copilot implementation', 'Dynamics 365 Finance', 'Dynamics 365 Business Central', 'Dynamics 365 Sales', 'E-invoicing compliance'];
  const BUSINESS = 'Microsoft partner in Dubai for enterprises in the UAE and GCC: AI consulting and automation, Microsoft Copilot, Dynamics 365 business applications, data and cloud';
  const cand = (keyword, volume, kd, pre, gsc) => ({ keyword, volume, kd, cpc: 4.5, intent: 'commercial', words: keyword.split(' ').length, pre_score: pre, traffic_potential: volume == null ? null : Math.round(volume * 0.3),
    competitors: [], your_position: null, your_url: '', trend_yearly: 5, serp_types: [], gsc: gsc || null, sources: ['ranked_keywords'] });
  const GSC = { page: GONE_URL, gsc_page: 'https://techand.ai/dynamics-365-finance-and-operations-uae', position: 10, impressions: 16, clicks: 0, ctr: 0, period_days: 28, period_end: '2026-10-18', kinds: ['striking'] };
  const CANDS = [cand('dynamics 365 finance and operations pricing dubai', null, null, 95, GSC), cand('artificial intelligence consultancy', 170, 5, 90),
    cand('artificial intelligence consulting', 90, 8, 85), cand('dynamics 365 business central partner uae', 140, 20, 80), cand('used car dealers dubai', 900, 10, 75)];
  const model = { domain: DOM, canonical_host: 'www.techand.ai', business_name: 'Tech&', declared_services: SERVICES, services: SERVICES, model_updated_at: '2026-10-21T18:00:00.000Z',
    pages: [{ url: GONE_URL, title: '', h1: '', source: 'gsc', http_status: 404, status_at: '2026-10-21T17:00:00.000Z', queries: [] },
      { url: 'https://www.techand.ai/whatwedo/ai-automation', title: 'AI & Automation | What We Do | Tech&', h1: 'AI & Automation', source: 'sitemap', http_status: 200, status_at: '2026-10-21T17:00:00.000Z', queries: [] }] };
  const research = async () => {
    reset();
    const base = { domain: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', goal: 'leads', seeds: ['ai consulting'], services: SERVICES, declared_services: SERVICES,
      business: BUSINESS, competitors: [], site_urls: [], research: { candidates: CANDS, pool_size: CANDS.length, competitor_domains: [], by_source: {}, failures: [] } };
    mock('Collect Research', [{ json: base }]);
    mock('Relevance Chunks', [{ json: { keywords_chunk: CANDS.map(c => ({ keyword: c.keyword })) } }]);
    mock('Load Site Cache', [{ json: {} }]); mock('Site Model', [{ json: { site_model: model } }]); delete store['Reach (Discovery)'];
    mock('Load Domain Ladders (Discovery)', [{ json: {} }]); mock('Load Ladder Settings (Discovery)', [{ json: {} }]);
    const KS = (await run('Rank Keywords', [{ json: { output: { items: CANDS.map(c => ({ keyword: c.keyword, relevance: 2, intent: 'commercial', page_type: 'Service Page', topic: c.keyword })) } } }]))[0].json;
    mock('Rank Keywords', [{ json: KS }]);
    const pk = (await run('Priority Keywords', [{ json: {} }])).map(i => i.json); mock('Priority Keywords', pk.map(json => ({ json }))); delete store['AI Demand'];
    // the live checks: the gone address still shows at #8 for its search (Google has not dropped it yet), an AI Overview everywhere
    const serp = (kw) => ({ json: { status_code: 20000, tasks: [{ status_code: 20000, result: [{ keyword: kw, datetime: '2026-10-21 18:33:00 +00:00', items: [{ type: 'ai_overview' }, { type: 'people_also_ask', items: [{ title: 'How much does it cost?' }] },
      { type: 'organic', rank_group: 1, rank_absolute: 2, domain: 'example-erp.ae', url: 'https://example-erp.ae/' + kw.replace(/\s+/g, '-'), title: kw },
      ...(kw === CANDS[0].keyword ? [{ type: 'organic', rank_group: 8, rank_absolute: 9, domain: 'www.techand.ai', url: GONE_URL, title: 'Dynamics 365 Finance and Operations UAE' }] : [])] }] }] } });
    const KSR = (await run('Build Keyword Strategy', pk.map(p => serp(p.keyword))))[0].json;
    return { KS: KS.keyword_strategy, KSR };
  };

  let R = null;
  await guard('KR1 research: a gone page covers nothing', async () => {
    const SN = 'KR1 KWL-RES D1: a page that answers 404 is not "already answered by a page you have" and its ranking makes nothing Easy (exec 111: 8 dead pages, 18 keywords, "Refresh those pages")';
    begin(SN); const check = mkCheck(SN);
    R = await research();
    const k0 = R.KS.keywords.find(k => k.keyword === CANDS[0].keyword) || {};
    check('the keyword whose Search Console page is gone has no covered_by, and carries gone_ranking with the dead address and its position',
      !k0.covered_by && k0.gone_ranking && /dynamics-365-finance-and-operations-uae$/.test(k0.gone_ranking.url) && k0.gone_ranking.position === 10, J({ covered_by: k0.covered_by, gone: k0.gone_ranking }));
    check('the research\'s covered list no longer names the gone page; gone_ranked does', !(R.KS.covered || []).some(c => /dynamics-365-finance-and-operations-uae/.test(c.url))
      && (R.KS.gone_ranked || []).some(g => g.keyword === CANDS[0].keyword) && (R.KS.gone_pages || []).length === 1, J({ covered: R.KS.covered, gone: R.KS.gone_ranked }));
    const p0 = (R.KSR.keyword_strategy.priority || []).find(k => k.keyword === CANDS[0].keyword) || {};
    check('the live check finds our gone address at #8: it is not the site\'s position, so the keyword is not upgraded to Easy', p0.live && p0.live.your_position == null && p0.live.gone_position === 8 && p0.difficulty_for_you !== 'easy',
      J({ live: p0.live && { your_position: p0.live.your_position, gone_position: p0.live.gone_position }, diff: p0.difficulty_for_you, label: p0.for_you_label }));
    check('the card says the page no longer opens and to redirect it (never "you are already at #8")', /no longer opens: redirect it to a live page, then this keyword has a head start/.test(p0.why || '') && !/already at #8/.test(p0.why || ''), p0.why);
    const html = String(R.KSR.result_html || '');
    check('the report names the keyword under "ranked by a page that no longer opens" and does not tell the client to refresh it',
      /ranked by a page that no longer opens/.test(html) && !/already answered by a page you have: "dynamics 365 finance and operations pricing dubai"/.test(html), html.slice(0, 600));
  });

  await guard('KR2 service fit reads artificial intelligence as ai', async () => {
    const SN = 'KR2 KWL-RES D2: "artificial intelligence consultancy" is the declared "AI consulting" (exec 111 judged it "not one of the services you listed")';
    begin(SN); const check = mkCheck(SN);
    const fit = (kw) => ((R && R.KS.keywords.find(k => k.keyword === kw)) || {}).service_fit;
    check('"artificial intelligence consultancy" and "artificial intelligence consulting" are in', fit('artificial intelligence consultancy') === 'in' && fit('artificial intelligence consulting') === 'in',
      J(R && R.KS.keywords.map(k => [k.keyword, k.service_fit, k.service_fit_note])));
    check('a keyword about something else ("used car dealers dubai") is still out', fit('used car dealers dubai') === 'out', fit('used car dealers dubai'));
  });

  await guard('KR3 government bodies are never competitors', async () => {
    const SN = 'KR3 KWL-RES D10: dubaifuture.ae (Dubai Future Foundation) and any body whose own result names it a foundation / authority / council / ministry are passed over as government';
    reset(); begin(SN); const check = mkCheck(SN);
    const kit = async (fn, args) => (await run('_competitors_kit', [{ json: { fn, args } }], { code: '_competitors_kit' }))[0].json.out;
    const org = (rank, domain, title, path, description) => ({ type: 'organic', rank_group: rank, rank_absolute: rank, domain, url: 'https://' + domain + (path || '/'), title, description: description || '' });
    const serps = [
      { keyword: 'ai consulting dubai', items: [org(1, 'www.dubaifuture.ae', 'Dubai Future Foundation AI training', '/ai'), org(2, 'kineticcs.com', 'AI consulting Dubai | Kinetic'), org(3, 'aifoundry-council.ae', 'Home | Emirates AI Ethics Council'), org(4, 'acme-ai.ae', 'How we helped the Roads and Transport Authority | Acme AI', '/case-study')] },
      { keyword: 'ai consulting company uae', items: [org(1, 'dubaifuture.ae', 'Programmes', '/p'), org(2, 'kineticcs.com', 'AI consulting company | Kinetic'), org(3, 'aifoundry-council.ae', 'Programmes', '/p', 'The council is a government initiative to grow AI in the UAE'), org(5, 'acme-ai.ae', 'AI consulting services | Acme AI')] },
      { keyword: 'generative ai consulting uae', items: [org(2, 'kineticcs.com', 'Generative AI | Kinetic'), org(6, 'acme-ai.ae', 'Generative AI consulting | Acme AI'), org(7, 'aifoundry-council.ae', 'Events')] }];
    const sel = await kit('select', [{ serps, own_domain: DOM, n: 5 }]);
    const picked = sel.picked.map(p => p.domain), excl = Object.fromEntries(sel.excluded.map(e => [e.domain, e.kind]));
    check('dubaifuture.ae and the council domain are excluded as government; the businesses (including the one whose case study names an authority) are picked',
      !picked.includes('dubaifuture.ae') && !picked.includes('aifoundry-council.ae') && picked.includes('kineticcs.com') && picked.includes('acme-ai.ae')
      && excl['dubaifuture.ae'] === 'gov' && excl['aifoundry-council.ae'] === 'gov', J({ picked, excluded: sel.excluded }));
  });

  await guard('KR4 the research document in plain words', async () => {
    const SN = 'KR4 KWL-RES D12 / D13: no em dash, ellipsis, "SERP", "PAA" or "DataForSEO" in the research document; a keyword that is not a fit carries no plan or timeline';
    begin(SN); const check = mkCheck(SN);
    const html = String((R && R.KSR.result_html) || '');
    const bad = ['—', '…', 'SERP', 'PAA', 'DataForSEO'].filter(w => html.includes(w));
    check('the research document has none of them', html.length > 1000 && !bad.length, J(bad.map(w => { const i = html.indexOf(w); return html.slice(Math.max(0, i - 80), i + 40); })));
    const out = ((R && R.KSR.keyword_strategy.priority) || []).find(k => k.keyword === 'used car dealers dubai');
    check('"used car dealers dubai" (not one of the services listed) has no plan type, no months and says why', !!out && (out.plan_type == null && out.months == null && /^Not a fit: /.test(out.for_you_label || '')),
      J(out && { plan_type: out.plan_type, months: out.months, label: out.for_you_label }));
  });
};
