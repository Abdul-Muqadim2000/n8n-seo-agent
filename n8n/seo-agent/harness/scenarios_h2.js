// H2-1..H2-5 (2026-10-27, docs/content-quality-2026-10-27/R1_PIPELINE_ANALYSIS.md): the four production page runs (949, 2195, 2552, 2575).
//   H2-1  CL.neutral: a flagged sentence comes with what to do about it - reword (a method in the business's voice becomes advice to the
//         reader), delete (a stance), or ask (a deliverable, term, credential only the client can confirm: a question and the closest fact on
//         file). Additive: every flag of CL.commitments / CL.business keeps its fields and gains `rewrite`. No dash, curly quote or "…".
//   H2-2  Client Page Requests reads the site's services page (/whatwedo) on every page run, so the promise check holds sentences against the
//         phases' own text, not their titles; a site without one reads what it read before.
//   H2-3  A keyword-ladder page whose ladder planned a NEW page is never turned into a refresh of another page by the page run's sitemap
//         match: that page is read as a related page and existing_page stays empty (exec 2575 refreshed exec 949's page).
//   H2-4  The brand and the legal name: "Nova& (legal name: Novaand systems LLC)" is read as the two (style kit, intake, stored row), the
//         house style uses the brand in titles and headings, the brand check never flags the legal name or text inside it (the real
//         Content QA node), the leaked "Spelling: British English" is not a brand form.
//   H2-5  Ladder Plan never plans a page onto the page of another keyword of the site (another ladder's published or planned page): the
//         keyword gets a new page and the plan says which page it left alone; the same keyword may still improve its own page.
// Every check runs the GENERATED code (harness/code_v4) in the harness sandbox (no URL constructor, Object.defineProperty a no-op, no structuredClone).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const kit = (file, name) => { const src = fs.readFileSync(path.join(CD, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' is not inlined in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };
  const TELL = /[—–…→“”‘’]/;
  const SET = JSON.parse(fs.readFileSync(path.join(__dirname, 'accuracy', 'claims.json'), 'utf8'));
  const TFACTS = SET.sites.find(s => s.site === 'novaand-demo.com/prod-2026-10-27').facts;
  const DFACTS = SET.sites.find(s => s.site === 'corvane-demo.com/prod-2026-10-27').facts;
  const W = 'https://www.novaand-demo.com';

  await guard('H2-1 neutral rewrites', async () => {
    reset(); const SN = 'H2-1 CL.neutral — every flagged sentence says what to do: reword as advice, delete a stance, or ask the client with the closest fact on file'; begin(SN); const check = mkCheck(SN);
    const CL = kit('Content_QA.js', 'CL');
    const N = (s, kind, facts, biz) => CL.neutral(s, { kind, corpus: facts || TFACTS, business: biz || 'Nova&' });
    const steps = N('We use five steps:', 'process');
    const vat = N('In those projects, we check that every VAT code feeds the correct return figure.', 'pricing');
    const iso = N('As an ISO 27001 certified team, we give each AI service its own least-privilege account in a separate network zone, and we log every query and write.', 'credential', DFACTS, 'Corvane');
    const stance = N('When Business Central, or no new ERP at all, is enough, we say so.', 'process');
    const plan = N('You get back a scoped pilot plan, drawing on our [intelligent systems and data capabilities](https://corvane-demo.com/capabilities/intelligent-systems-data).', 'deliverable', DFACTS, 'Corvane');
    const price = N('Our fixed-price readiness assessment costs AED 25,000.', 'pricing');
    const cons = N('We use this self-check in first consultations with UAE and GCC finance leaders.', 'process');
    const roll = N('We also deliver multi-entity and global rollouts.', 'deliverable');
    console.log('   ->', J({ steps: steps.neutral, vat: vat.neutral, iso: iso.neutral, stance: stance.action, plan: [plan.action, plan.question], price: price.question, cons: cons.action, roll: roll.suggestion }));
    check('"We use five steps:" becomes "A five-step approach works well:" (advice, no client fact needed)', steps.action === 'reword' && steps.neutral === 'A five-step approach works well:' && steps.needs_client_fact === false, J(steps));
    check('an invented process step in the business\'s voice becomes an instruction to the reader', vat.action === 'reword' && vat.neutral === 'Check that every VAT code feeds the correct return figure.' && !vat.needs_client_fact, J(vat));
    check('the credential lead is dropped and the method kept as advice ("Give each AI service ... and log every query and write.")', iso.action === 'reword' && iso.neutral === 'Give each AI service its own least-privilege account in a separate network zone, and log every query and write.', J(iso));
    check('a stance with nothing to keep is deleted, no client question', stance.action === 'delete' && stance.needs_client_fact === false && !stance.neutral, J(stance));
    check('a deliverable only the client can confirm is a question naming the business and quoting the page', plan.action === 'ask' && plan.needs_client_fact === true && /^What does a client of Corvane receive at this step\? The page says: "You get back a scoped pilot plan/.test(plan.question), J(plan));
    check('a price is a question about the charge', price.action === 'ask' && /^What does Nova& charge for this, and may the page say it\?/.test(price.question), J(price));
    check('the business\'s own practice ("in first consultations") is asked, not reworded', cons.action === 'ask' && cons.needs_client_fact, J(cons));
    check('a question comes with the closest thing the client\'s own site says (the Global Rollouts phase)', roll.action === 'ask' && /Global Rollouts|rollout/i.test(roll.suggestion), J(roll));
    check('no dash, curly quote or "…" character in any wording the client reads', ![steps, vat, iso, stance, plan, price, cons, roll].some(r => TELL.test(r.neutral + r.question + r.suggestion + r.why)), J([steps, vat, iso, plan, price, roll].map(r => r.question + r.neutral)));
    // additive: the flags keep their shape
    const md = '## How we work\n\nWe deliver UAE e-invoicing (Peppol) and VAT compliance work alongside our Dynamics 365 projects. In those projects, we check that every VAT code feeds the correct return figure.\n';
    const BP = CL.commitments(md, TFACTS, { names: ['Nova&', 'novaand'] });
    const f = BP.flags.find(x => /every VAT code/.test(x.sentence)) || {};
    check('CL.commitments flags keep kind / sentence / support / where and gain `rewrite` (H1 reads it unchanged)', ['kind', 'sentence', 'support', 'where'].every(k => k in f) && f.rewrite && f.rewrite.action === 'reword', J(f));
    const BC = CL.business('## Pricing\n\nWe charge a fixed fee of AED 9,000 for every rollout.\n', TFACTS, { names: ['Nova&'] });
    check('CL.business flags gain `rewrite` too (a term is asked, never reworded)', BC.flags.length && BC.flags[0].rewrite && BC.flags[0].rewrite.action === 'ask' && BC.flags[0].trigger, J(BC.flags));
  });

  await guard('H2-2 the services page is read', async () => {
    reset(); const SN = 'H2-2 Client Page Requests — the site\'s services page (/whatwedo) is read on every page run, so the phases are known by their text'; begin(SN); const check = mkCheck(SN);
    const PAGES = ['', '/whatwedo', '/whatwedo/assess-shape', '/whatwedo/global-rollouts', '/capabilities/data', '/insights/agentic-ai'].map(p => ({ url: W + p, title: p ? p.slice(1) : 'Home', source: 'sitemap' }));
    const model = (await run('_site_model', [{ json: { site_row: { site_id: 'site_novaand-demo-com', domain: 'novaand-demo.com', canonical_host: 'www.novaand-demo.com', model_updated_at: new Date().toISOString() }, extras: { pages: PAGES } } }]))[0].json.model;
    mock('Site Model', [{ json: { site_model: model } }]);
    const CTX = { domain: 'novaand-demo.com', keyword: 'ms 365 erp', mode: 'keyword', existing_page: null, existing_page_url: '', internal_link_candidates: [{ url: W + '/insights/agentic-ai', path: '/insights/agentic-ai' }], site_urls: PAGES.map(p => p.url) };
    const reqs = (await run('Client Page Requests', [{ json: CTX }])).map(r => r.json);
    console.log('   requests ->', J(reqs.map(r => [r.kind, r.url])));
    check('the services hub /whatwedo is read as kind "services", beside the homepage and the related page', reqs.some(r => r.kind === 'services' && r.url === W + '/whatwedo') && reqs.some(r => r.kind === 'home') && reqs.length <= 4, J(reqs));
    mock('Collect Site URLs', [{ json: CTX }]);
    mock('Read Client Pages', reqs.map(r => ({ json: { page_text: 'Title: ' + r.kind + '\n\nMarkdown Content:\n' + (r.kind === 'services' ? 'Our Assess and Shape phase helps organizations define a clear path. We at Nova& begin with business discovery. '.repeat(6) : 'Nova& serves the UAE and GCC. '.repeat(20)) } })));
    const ccp = (await run('Collect Client Pages', store['Read Client Pages']))[0].json;
    check('its text reaches client_pages (what the promise check reads as the business\'s own text)', (ccp.client_pages || []).some(p => p.kind === 'services' && /business discovery/.test(p.text)), J((ccp.client_pages || []).map(p => [p.kind, p.words])));
    const m2 = (await run('_site_model', [{ json: { site_row: { site_id: 'site_x', domain: 'example-shop.com', canonical_host: 'example-shop.com', model_updated_at: new Date().toISOString() }, extras: { pages: [{ url: 'https://example-shop.com/blog/a', title: 'a', source: 'sitemap' }] } } }]))[0].json.model;
    mock('Site Model', [{ json: { site_model: m2 } }]);
    const r2 = (await run('Client Page Requests', [{ json: { domain: 'example-shop.com', keyword: 'x', internal_link_candidates: [], site_urls: [] } }])).map(r => r.json);
    check('control: a site with no services page reads what it read before', !r2.some(r => r.kind === 'services') && r2.length === 1 && r2[0].kind === 'home', J(r2));
  });

  await guard('H2-3 a ladder page planned new stays new', async () => {
    reset(); const SN = 'H2-3 Client Page Requests / Collect Client Pages — a ladder page planned as NEW is not turned into a refresh of the page the sitemap matched (exec 2575)'; begin(SN); const check = mkCheck(SN);
    const P949 = W + '/insights/is-microsoft-dynamics-365-an-erp-system';
    const model = (await run('_site_model', [{ json: { site_row: { site_id: 'site_novaand-demo-com', domain: 'novaand-demo.com', canonical_host: 'www.novaand-demo.com', model_updated_at: new Date().toISOString() }, extras: { pages: [{ url: P949, title: 'Is Microsoft Dynamics 365 an ERP System? UAE Buyer\'s Guide', source: 'sitemap' }] } } }]))[0].json.model;
    const flow = async (ctx0) => { mock('Site Model', [{ json: { site_model: model } }]); mock('Collect Site URLs', [{ json: ctx0 }]);
      const reqs = (await run('Client Page Requests', [{ json: ctx0 }])).map(r => r.json);
      mock('Read Client Pages', reqs.map(r => ({ json: { page_text: 'Title: page\n\nMarkdown Content:\n' + 'Dynamics 365 is a family of business applications for ERP and CRM. '.repeat(20) } })));
      return { reqs, ccp: (await run('Collect Client Pages', store['Read Client Pages']))[0].json }; };
    const CTX = { domain: 'novaand-demo.com', keyword: 'erp systems in uae', mode: 'keyword', ladder_id: 'lad_erp', ladder_target_url: W + '/erp-systems-in-uae', existing_page_url: '',
      existing_page: { url: P949, match: 0.6, source: 'sitemap' }, internal_link_candidates: [], site_urls: [P949] };
    const A = await flow(CTX);
    console.log('   ladder page ->', J(A.reqs.map(r => [r.kind, r.url])), '| existing_page ->', J(A.ccp.existing_page), '| ignored ->', J(A.ccp.existing_page_ignored));
    check('the matched page is read as a related page, never as the page to rewrite', A.reqs.some(r => r.url === P949 && r.kind === 'related') && !A.reqs.some(r => r.kind === 'existing'), J(A.reqs));
    check('existing_page is empty, no existing text, and the run says which page it left alone and why', A.ccp.existing_page === null && !A.ccp.existing_page_text && A.ccp.existing_page_ignored && A.ccp.existing_page_ignored.url === P949 && /planned a new page/.test(A.ccp.existing_page_ignored.why), J({ ep: A.ccp.existing_page, ig: A.ccp.existing_page_ignored }));
    const B = await flow({ ...CTX, ladder_id: '', ladder_target_url: '' });
    check('control: outside a ladder the matched page is still the existing page', B.reqs[0].kind === 'existing' && B.reqs[0].url === P949 && B.ccp.existing_page && B.ccp.existing_page.url === P949, J(B.reqs));
    const C = await flow({ ...CTX, ladder_target_url: P949 });
    check('control: a ladder page planned AS that page still refreshes it', C.reqs[0].kind === 'existing' && C.reqs[0].url === P949, J(C.reqs));
  });

  await guard('H2-4 brand and legal name', async () => {
    reset(); const SN = 'H2-4 the brand and the legal name — "Nova& (legal name: Novaand systems LLC)" is read as the two; titles use the brand; the brand check never flags the legal name'; begin(SN); const check = mkCheck(SN);
    const ST = kit('Content_QA.js', 'ST');
    const ROW = { style_brand_form: 'Nova& (legal name: Novaand systems LLC)', style_brand_wrong: 'Nova and, NovaAnd, Novaand, Nova &, Nova N, Nova&.ai, Spelling: British English', style_spelling: 'British English', style_tone: 'Plain, direct and professional.' };
    const g = ST.from(ROW, {});
    console.log('   guide ->', J({ brand: g.brand_form, legal: g.legal_name, wrong: g.wrong_forms }), '| block ->', g.prompt_block.split('\n').slice(1, 3).join(' / ').slice(0, 400));
    check('the stored value is read as the brand "Nova&" and the legal name "Novaand systems LLC"', g.brand_form === 'Nova&' && g.legal_name === 'Novaand systems LLC', J(g));
    check('the wrong forms come from the brand alone; the leaked "Spelling: British English" is not one', !g.wrong_forms.some(w => /legal|spelling/i.test(w)) && g.wrong_forms.includes('Novaand'), J(g.wrong_forms));
    check('the house style writes the brand in titles and headings and keeps the legal name for legal statements', /exactly as "Nova&" everywhere/.test(g.prompt_block) && /legal name is "Novaand systems LLC"\. Use it only where a legal statement needs it/.test(g.prompt_block) && !/\(legal name:/.test(g.prompt_block), g.prompt_block);
    check('an explicit legal name wins, and a plain brand stays as it is', ST.from({ ...ROW, style_legal_name: 'Novaand Systems L.L.C.' }).legal_name === 'Novaand Systems L.L.C.' && ST.from({ style_brand_form: 'Northwind & Co' }).legal_name === '' && ST.from({ style_brand_form: 'Acme (Dubai)' }).brand_form === 'Acme (Dubai)', '');
    const md = ['Title: ERP Systems in UAE | Nova& (legal name: Novaand systems LLC)', '', '# ERP systems in UAE', '', '## Why companies work with Nova& (legal name: Novaand systems LLC)', '',
      'Nova& is a Microsoft partner in Dubai. The company is registered as Novaand systems LLC in the Dubai Airport Freezone.', ''].join('\n');
    const c1 = ST.check(md, g);
    check('the brand check finds no wrong form inside the legal name or its "(legal name: ...)" note', !c1.errors.length && !c1.brand.length, J(c1.brand));
    check('a title or heading that carries the legal name is a style note (advice, not a blocker)', c1.legal_in_headings === 2 && c1.notes.some(n => /^Legal name: 2 title \/ heading line\(s\)/.test(n)) && !TELL.test(c1.notes.join(' ')), J(c1.notes));
    const c2 = ST.check(md + '\nNovaand helps finance teams.\n', g);
    check('control: "Novaand" in ordinary prose is still the brand written wrongly', c2.errors.length === 1 && c2.brand.some(b => b.found === 'Novaand' && b.count === 1), J(c2.brand));
    // the real Content QA node, on the exec 42 brief with this style guide
    const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_eqa_42.json.gz'))).toString());
    mock('Parse Brief', [{ json: { ...clone(FX.parse_brief), style_guide: g } }]);
    mock('Analyze Competitor Pages', [{ json: { competitors: [] } }]);
    mock('Site Model', [{ json: { site_model: { ...(FX.parse_brief.site_model || {}), domain: 'novaand-demo.com', canonical_host: 'www.novaand-demo.com' } } }]);
    const q = (await run('Content QA', [{ json: { output: md + '\nWe help UAE companies compare ERP systems.\n', critique: null } }], { runIndex: 0 }))[0].json.content_qa;
    check('Content QA (generated node): no "Brand name" warning for the legal name, the heading note is advice', !(q.warnings || []).some(w => /^Brand name/.test(w)) && (q.style_notes || []).some(n => /^Legal name:/.test(n)), J({ w: (q.warnings || []).filter(w => /Brand/.test(w)), n: q.style_notes }));
    // intake and the stored row
    delete store['Start Form'];
    const n1 = (await run('Normalize Input', { body: { mode: 'profile', domain: 'novaand-demo.com', style: { brand_form: 'Nova& (legal name: Novaand systems LLC)' }, callback_url: 'https://hooks.example.com/x', request_id: 'h2b1' } }))[0].json;
    const pi = n1.profile_input || {};
    check('intake: a brand sent the old way is stored as the two values', !n1.validation_error && pi.style_brand_form === 'Nova&' && pi.style_legal_name === 'Novaand systems LLC', J({ err: n1.validation_error, b: pi.style_brand_form, l: pi.style_legal_name }));
    const n2 = (await run('Normalize Input', { body: { mode: 'profile', domain: 'novaand-demo.com', style: { brand_form: 'Nova&', legal_name: 'Novaand Systems LLC' }, callback_url: 'https://hooks.example.com/x', request_id: 'h2b2' } }))[0].json;
    mock('Load Profile (Profile)', [{ json: { site_id: 'site_novaand-demo-com', domain: 'novaand-demo.com', business_name: 'Nova&', style_brand_form: 'Nova& (legal name: Novaand systems LLC)' } }]);
    const pr = (await run('Profile Row', store['Load Profile (Profile)']))[0].json;
    check('the stored row carries style_brand_form "Nova&" and style_legal_name (the new column)', pr.style_brand_form === 'Nova&' && pr.style_legal_name === 'Novaand Systems LLC' && (n2.profile_input || {}).style_legal_name === 'Novaand Systems LLC', J({ b: pr.style_brand_form, l: pr.style_legal_name }));
  });

  await guard('H2-5 ladder target guard', async () => {
    reset(); const SN = 'H2-5 Ladder Plan — a planned page never lands on the page of another keyword of the site (exec 2575): a new page, and the plan says why'; begin(SN); const check = mkCheck(SN);
    const F = require('./fixtures');
    const DOM = 'novaand-demo.com'; const AUTO = W + '/whatwedo/ai-automation';
    const PAGES = ['', '/whatwedo', '/capabilities', '/industries', '/whatwedo/assess-shape', '/whatwedo/ai-automation'].map(p => W + p);
    const planOf = async (others) => {
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
      const pv = { ...PV0, keyword: 'ai consultant', domain: DOM, country: 'United Arab Emirates', site_urls: PAGES, internal_link_candidates: [], secondary_keywords: [], existing_page: null,
        keyword_data: { search_volume: 170, keyword_difficulty: 0, google_intent: 'commercial', cpc: 6 }, verdict: 'GO', chosen_by: 'client_typed', ladder_mode: 'auto', competitors_summary: [] };
      mock('Parse Verdict', pv);
      const cands = ['ai consulting services uae', 'ai strategy workshop dubai', 'copilot rollout uae'].map((k, i) => ({ keyword: k, volume: 90, kd: 0, cpc: 4, intent: 'commercial', pre_score: 40 - i * 5, words: k.split(' ').length, traffic_potential: 12 }));
      mock('Ladder Pool', { ...pv, research: { pool_size: cands.length, candidates: cands, refused: [], failures: [] }, site_rankings: { count: 0, head: null, keywords: {}, available: false, top10: [] }, head_tokens: ['ai', 'consultant'], head_geo: [] });
      mock('Ladder Relevance Chunks', []); mock('Ladder Keyword Relevance', []); mock('After Count (Ladder Keyword Relevance)', []);
      mock('Ladder Cluster Requests', []); mock('Run Ladder Cluster SERP', []); mock('Ladder Cluster Retry', []); mock('Run Ladder Cluster SERP (Retry)', []);
      await run('Ladder Clusters', [{ json: {} }]);
      mock('Site Model', [{ json: { site_model: { domain: DOM, canonical_host: 'www.novaand-demo.com', business_name: 'Nova&', pages: PAGES.map(u => ({ url: u, title: u === AUTO ? 'AI Consultant in Dubai | AI Consulting & Automation' : '', h1: '', source: 'sitemap', queries: [] })) } } }]);
      mock('Load Site Cache', [{ json: {} }]); mock('Load Domain Ladders', others.length ? others.map(r => ({ json: r })) : [{ json: {} }]); mock('Load Domain Ladder Settings', [{ json: {} }]); mock('Load Content Log (Ladder)', [{ json: {} }]);
      mock('Load Profile (Model)', [{ json: { site_id: 'site_novaand-demo-com', domain: DOM } }]);
      mock('Ladder Titles', { page_titles: { asked: 0, read: [], failed: [], skip_reason: 'not part of this case' } });
      const out = (await run('Ladder Plan', []))[0].json; return out.ladder || out;
    };
    const ROW = (kw, status) => ({ ladder_id: 'lad_other', domain: DOM, head_keyword: 'ai automation services', rung: 2, page_no: 3, keyword: kw, target_url: AUTO, page_exists: true, status });
    const L0 = await planOf([]);
    console.log('   alone ->', J({ url: (L0.top || {}).target_url, status: (L0.top || {}).status }));
    check('setup: alone, the main keyword improves /whatwedo/ai-automation (its title matches)', (L0.top || {}).status === 'improve' && (L0.top || {}).target_url === AUTO, J(L0.top && [L0.top.status, L0.top.target_url]));
    const L1 = await planOf([ROW('ai automation services', 'published')]);
    const t = L1.top || {}; const tg = (L1.target_guard || [])[0] || {};
    console.log('   with another ladder\'s page ->', J({ url: t.target_url, status: t.status, left: t.not_overwritten }), '| note ->', String(tg.note || '').slice(0, 220));
    check('the page published for another keyword is not this plan\'s page: a new page at the keyword\'s own address', t.status === 'new' && t.exists === false && t.target_url === W + '/ai-consultant' && t.not_overwritten && t.not_overwritten.url === AUTO && t.not_overwritten.keyword === 'ai automation services', J(t));
    check('the plan says which page it left alone and why (target_guard and the notes)', tg.left_alone === AUTO && tg.owner_keyword === 'ai automation services' && /published/.test(tg.owner)
      && (L1.notes || []).some(n => n.startsWith('"ai consultant" gets a new page (' + W + '/ai-consultant) instead of a refresh of ' + AUTO + ': that page is already the page for "ai automation services"')) && !TELL.test(tg.note), J({ tg, notes: (L1.notes || []).filter(n => /new page/.test(n)) }));
    const L2 = await planOf([ROW('ai automation services', 'planned')]);
    check('a page another ladder only PLANNED there is protected too', (L2.top || {}).status === 'new' && /planned/.test(((L2.target_guard || [])[0] || {}).owner || ''), J(L2.target_guard));
    const L3 = await planOf([ROW('ai consultant', 'published')]);
    check('control: the same keyword in another ladder may still improve that page', (L3.top || {}).status === 'improve' && (L3.top || {}).target_url === AUTO && !(L3.target_guard || []).length, J(L3.top && [L3.top.status, L3.target_guard]));
  });
};
