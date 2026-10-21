// KM1-KM8 (KW-MATCH, 2026-10-21): K8 and K1 of the 2026-10-17 scorecard, on the paid pre-launch run's own evidence.
//   K8: SM.matchPage needed 75% of a keyword's words in a page's slug or title, so techand.ai's live "AI & Automation | What We Do | Tech&"
//       (/whatwedo/ai-automation) did not answer "ai consultant" / "ai consulting dubai" and the ladder of 2026-10-21 (r04, "ai consultant")
//       planned a NEW main page /ai-consultant/ beside it; the same rule let "it consulting services dubai" claim an AI consulting page on
//       "consulting services dubai" alone. Now the page that is ABOUT the search (core words, IDF weights, title / H1, address, Search Console
//       searches, the client's services) is the match, with a confidence and the evidence; a weak one is "may overlap"; a gone page and a page
//       of another service never match.
//   K1: one site-wide reach ("method size, sample 0") judged every topic. reachTopic now also reads the site's own Search Console readings
//       (position <= 20, the topic's distinctive words) with the sample printed, and says when it falls back to the site-wide figure.
// Every check runs the GENERATED kits (harness/code_v4) and fails on the code before the change. Called from scenarios_v5.js (one line).
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const TELL = /[—‘’“”…]/;
  const smSrc = fs.readFileSync(path.join(CD, '_site_model.js'), 'utf8');
  const a = smSrc.indexOf('const SM = (() => {'), b = smSrc.indexOf('\n})();', a);
  const SM = new Function(smSrc.slice(a, b + 6) + '\nreturn SM;')();
  const rtSrc = fs.readFileSync(path.join(CD, '_reach_topic.js'), 'utf8');
  const RT = new Function(rtSrc.slice(0, rtSrc.lastIndexOf('return $input.all()')) + '\nreturn { reachTopic };')();
  const pageMatch = (model, kw) => typeof SM.pageMatch === 'function' ? SM.pageMatch(model, kw) : { match: SM.matchPage(model, kw), may_overlap: undefined };

  // techand.ai as served on 2026-10-21 (scratchpad/rv/live copies: titles and H1s as served) and the old addresses that answer 404
  const W = 'https://www.techand.ai';
  const LIVE = [['/', 'Tech& | Turning Technology into measurable Business Impact', 'Value Driven Innovation through Automation'], ['/capabilities', 'Capabilities | Tech&', 'Tech& Capabilities'],
    ['/capabilities/business-applications', 'Business Applications | Tech&', 'Tech& Capabilities'], ['/capabilities/cloud-services', 'Cloud Services | Tech&', 'Tech& Capabilities'],
    ['/capabilities/data', 'Data & Analytics | Tech&', 'Tech& Capabilities'], ['/contact-us', 'Contact Us | Tech&', 'Contact Tech&'], ['/industries', 'Industries We Serve | Tech&', 'Industries We Serve'],
    ['/insights', 'Insights | Tech&', 'Insights'], ['/insights/agentic-ai', 'Tech& | Enterprise Automation & Digital Transformation Solutions', ''],
    ['/insights/autonomous-ai-customer-service', 'Tech& | Enterprise Automation & Digital Transformation Solutions', ''], ['/whatwedo', 'What We Do | Tech&', 'What We Do'],
    ['/whatwedo/ai-automation', 'AI & Automation | What We Do | Tech&', 'AI & Automation'], ['/whatwedo/assess-envision', 'Assess & Envision | What We Do | Tech&', 'Assess & Envision'],
    ['/whatwedo/managed-services', 'Managed Services | What We Do | Tech&', 'Managed Services'], ['/whatwedo/global-rollouts', '', ''], ['/whywith-techand', 'Why Tech& | Tech&', 'About Tech&']];
  const GONE = [['/dynamics-365-crm-uae', 'Dynamics 365 CRM Partner in UAE'], ['/dynamics-365-finance-and-operations-uae', 'Dynamics 365 Finance and Operations Partner in UAE'],
    ['/ai-copilot-advisory-uae', 'AI Consulting & Copilot Advisory UAE']];
  const live = (o = {}) => LIVE.map(([p, t, h]) => ({ url: W + p, title: t, h1: h, source: 'sitemap', http_status: 200, status_at: '2026-10-21T10:00:00Z', ...(o[p] || {}) }));
  const gone = () => GONE.map(([p, t]) => ({ url: W + p, title: t, source: 'gsc', http_status: 404, status_at: '2026-10-21T10:00:00Z' }));
  // the services the client declared at sign-up (site_full_body.json "business"), as Track my site stores them
  const SERVICES = ['AI consulting and automation', 'Microsoft Copilot', 'Dynamics 365 business applications', 'Data and analytics', 'Cloud services'];
  const model = (pages, o = {}) => SM.withPages(SM.from({ site_id: 'site_techand-ai', domain: 'techand.ai', canonical_host: 'www.techand.ai', business_name: 'Tech&', brand_names: 'Tech&, Techand',
    declared_services: JSON.stringify(o.services === undefined ? SERVICES : o.services) }, {}), pages);

  {
    const SN = 'KM1 K8: techand.ai\'s live AI page answers "ai consulting dubai" and "ai consultant" (the r04 ladder head), with a confidence and the evidence';
    if (typeof begin === 'function') begin(SN); console.log('\n== ' + SN); const check = mkCheck(SN);
    const m = model([...live(), ...gone()]);
    const r1 = pageMatch(m, 'ai consulting dubai'), r2 = pageMatch(m, 'ai consultant');
    const noSvc = pageMatch(model([...live(), ...gone()], { services: [] }), 'ai consultant');   // the ladder's model when the client declared nothing
    check('"ai consulting dubai" -> /whatwedo/ai-automation (before: no page, a new one was planned)', r1.match && r1.match.url === W + '/whatwedo/ai-automation', J(r1));
    check('...with a confidence of at least 0.75 and the evidence in plain words (its title, the service, the words left out as too general)',
      r1.match && r1.match.confidence >= 0.75 && /its title "AI & Automation/.test(r1.match.evidence || '') && /"consulting", "dubai" left out as too general/.test(r1.match.evidence || '')
      && /your service "AI consulting and automation"/.test(r1.match.evidence || '') && !TELL.test(r1.match.evidence || ''), J(r1.match));
    check('"ai consultant" (the r04 head) -> the same page, also without declared services, never the article /insights/agentic-ai',
      r2.match && r2.match.url === W + '/whatwedo/ai-automation' && noSvc.match && noSvc.match.url === W + '/whatwedo/ai-automation' && noSvc.match.confidence >= 0.75, J([r2.match, noSvc.match]));
  }
  {
    const SN = 'KM2 K8: the AI page never answers "dynamics 365 crm", not even with stray Search Console searches on it (another service of the client)';
    if (typeof begin === 'function') begin(SN); console.log('\n== ' + SN); const check = mkCheck(SN);
    const r = pageMatch(model([...live(), ...gone()]), 'dynamics 365 crm');
    check('"dynamics 365 crm" matches nothing live: the only page about it (/dynamics-365-crm-uae) is gone', r.match === null && !(r.may_overlap && /ai-automation/.test(r.may_overlap.url)), J(r));
    const stray = live({ '/whatwedo/ai-automation': { queries: [{ query: 'ai for dynamics 365 crm', impressions: 4, position: 30 }, { query: 'dynamics 365 crm ai', impressions: 3, position: 41 }] } });
    const r2 = pageMatch(model(stray), 'dynamics 365 crm');
    check('two stray searches on the AI page do not make it the Dynamics 365 CRM page, nor a "may overlap" (before: it matched on the searches)',
      !(r2.match && /ai-automation/.test(r2.match.url)) && !(r2.may_overlap && /ai-automation/.test(r2.may_overlap.url)), J(r2));
    const x = pageMatch(model([{ url: W + '/ai-consulting-services-uae', title: 'AI Consulting Services UAE', http_status: 200 }]), 'data consulting services uae');
    check('"data consulting services uae" (the Data and analytics service) never claims the AI consulting page on "consulting services uae" (before: 3 of 4 words, a match)', x.match === null && !x.may_overlap, J(x));
  }
  {
    const SN = 'KM3 K8: a gone page (404) never matches, even with a perfect title';
    if (typeof begin === 'function') begin(SN); console.log('\n== ' + SN); const check = mkCheck(SN);
    const onlyGone = pageMatch(model(gone()), 'ai consulting uae');
    const both = pageMatch(model([...live(), ...gone()]), 'ai consulting uae');
    check('only the 404 page "AI Consulting & Copilot Advisory UAE": no match and no "may overlap"', onlyGone.match === null && !onlyGone.may_overlap, J(onlyGone));
    check('with the live site: the live AI page, not the 404 one', both.match && both.match.url === W + '/whatwedo/ai-automation', J(both.match));
  }
  {
    const SN = 'KM4 K8: a weak match is "may overlap", never the page (an article for a buying search; a generic consulting page for an IT search)';
    if (typeof begin === 'function') begin(SN); console.log('\n== ' + SN); const check = mkCheck(SN);
    const art = pageMatch(model(live().filter(p => !/whatwedo\/ai-automation/.test(p.url))), 'ai consulting dubai');
    check('without the AI service page, the article /insights/agentic-ai is "may overlap" with its note, and matchPage returns nothing',
      art.match === null && art.may_overlap && art.may_overlap.url === W + '/insights/agentic-ai' && /^may overlap: \/insights\/agentic-ai/.test(art.may_overlap.note || '')
      && art.may_overlap.confidence < 0.75 && SM.matchPage(model(live().filter(p => !/whatwedo\/ai-automation/.test(p.url))), 'ai consulting dubai') === null, J(art));
    const it = pageMatch(model([{ url: W + '/ai-consulting-services-uae', title: 'AI Consulting & Copilot Advisory Services in UAE', http_status: 200 }]), 'it consulting services dubai');
    check('"it consulting services dubai" no longer claims "AI Consulting & Copilot Advisory Services in UAE" on its generic and place words (before: 3 of 4 words, a match)',
      it.match === null, J(it));
  }
  {
    const SN = 'KM5 K8: Search Console searches of the page are evidence ("6 of its Search Console searches are about it")';
    if (typeof begin === 'function') begin(SN); console.log('\n== ' + SN); const check = mkCheck(SN);
    const Q = ['ai consultancy abu dhabi', 'ai consulting uae', 'ai consultant dubai', 'ai automation consulting', 'ai agents for enterprises', 'ai consulting firm uae'].map((q, i) => ({ query: q, impressions: 5 + i, position: 15 + i }));
    const pages = live({ '/whatwedo/ai-automation': { title: '', h1: '', queries: Q } });   // its title not read yet: the address and the searches decide
    const r = pageMatch(model(pages), 'ai consulting dubai');
    check('the page is found from its address and searches, and the evidence counts them', r.match && r.match.url === W + '/whatwedo/ai-automation' && /6 of its Search Console searches are about it/.test(r.match.evidence || ''), J(r.match));
  }
  {
    const SN = 'KM6 K1: the reach for a topic is measured on the site\'s own Search Console searches about it (top 20), with the sample printed';
    if (typeof begin === 'function') begin(SN); console.log('\n== ' + SN); const check = mkCheck(SN);
    const KD = { 'ai consulting uae': 6, 'ai consultant dubai': 12, 'ai consultancy abu dhabi': 9, 'ai consulting services dubai': 14, 'ai consultant uae': 18, 'ai consulting company': 22, 'dynamics 365 finance uae': 45, 'dynamics 365 crm uae': 50 };
    const gsc = [['ai consulting uae', 8], ['ai consultant dubai', 11], ['ai consultancy abu dhabi', 14], ['ai consulting services dubai', 19], ['ai consultant uae', 6], ['ai consulting company', 49],
      ['dynamics 365 finance uae', 4], ['dynamics 365 crm uae', 7], ['seo consultant dubai', 3]].map(([query, position]) => ({ query, position }));
    const t = RT.reachTopic([], 'ai consultant', 10, { domain: 'techand.ai', gsc, kdOf: (k) => KD[k] == null ? null : KD[k] });
    check('5 on-topic searches in the top 20 with a known difficulty: reach measured on them only (p75 of 6, 9, 12, 14, 18 = 14), not the site-wide 10 and not the Dynamics 365 ones (45, 50)',
      t.used === true && t.reach === 14 && t.sample === 5 && t.method === 'topic' && t.sources && t.sources.search_console === 5, J(t));
    check('the note prints the sample and where it came from; "seo consultant dubai" (generic word only) and the #49 search are not counted',
      /5 of your searches about "ai consultant" rank in the top 20 with a known difficulty \(5 from Search Console\)/.test(t.note) && !(t.own_rows || []).some(r => /seo|company/.test(r.keyword)) && !TELL.test(t.note), J([t.note, t.own_rows]));
  }
  {
    const SN = 'KM7 K1: under the minimum sample the site-wide reach stays and the plan says so, with the count';
    if (typeof begin === 'function') begin(SN); console.log('\n== ' + SN); const check = mkCheck(SN);
    const t = RT.reachTopic([], 'ai consultant', 10, { domain: 'techand.ai', gsc: [{ query: 'ai consultant uae', position: 6 }, { query: 'ai consulting uae', position: 9 }, { query: 'ai consulting dubai', position: 12 }], kdOf: (k) => k === 'ai consulting dubai' ? null : 8 });
    check('2 with a known difficulty (+1 without): site-wide 10, method site, "at least 5 are needed" in the note',
      t.used === false && t.reach === 10 && t.sample === 2 && t.method === 'site' && /site-wide reach \(10\), because only 2 of your searches about "ai consultant" rank in the top 20 with a known difficulty \(2 from Search Console\); 1 more rank there with no difficulty on file, and at least 5 are needed/.test(t.note), J([t.note, t.sample]));
  }
  {
    const SN = 'KM8 r04 before/after: the "ai consultant" ladder of 2026-10-21 improves /whatwedo/ai-automation; its reach falls back with the reason (Search Console has nothing on the topic in the top 20)';
    if (typeof begin === 'function') begin(SN); console.log('\n== ' + SN); const check = mkCheck(SN);
    // the non-brand Search Console searches the run's site report read (r03_site_tracker.json brand_split + new_queries), as the inventory holds them
    const R03 = [['dynamics 365 finance and operations', 22.8], ['ai-powered e-invoice compliance', 71.2], ['e-invoicing penalties', 49.1], ['ai consultancy abu dhabi', 49], ['dynamics 365 cloud migration services in uae', 5.1], ['d365 cloud migration uae', 8.8]];
    const t = RT.reachTopic(null, 'ai consultant', 10, { domain: 'techand.ai', reason_missing: 'the reach stored on 2026-10-21 was kept without the keywords behind it', gsc: R03.map(([query, position]) => ({ query, position })), kdOf: () => 0 });
    check('r04 reach: still the site-wide 10 (honest: "ai consultancy abu dhabi" ranks #49), and the note now prints the sample of 0 and the minimum',
      t.used === false && t.reach === 10 && t.sample === 0 && /only 0 of your searches about "ai consultant" rank in the top 20/.test(t.note), J(t.note));
    const r = pageMatch(model([...live(), ...gone()], { services: [] }), 'ai consultant');
    check('r04 main page: improve /whatwedo/ai-automation instead of the new /ai-consultant/ (which answers 404 on the live site)', r.match && r.match.url === W + '/whatwedo/ai-automation', J(r));
    console.log('   r04 after: main page ->', r.match && r.match.url, '| confidence', r.match && r.match.confidence, '|', r.match && r.match.evidence);
  }
};
