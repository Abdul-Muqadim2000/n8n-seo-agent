// Re-rating 2026-10-17, defect-fix agent F-A3 (keyword research: discover, keyword report, verdict, Keyword Check).
// Every scenario here replays the real node inputs of the live executions on techand.ai (docs/system-review-2026-10-17/parts/
// 1_keywords_content.md, execs 750 / 760 / 764 / 765), captured into fixtures_live/fa3_live.json.gz, and fails on the build of
// 2026-10-17 (efa9645). Called from scenarios_v5.js just before the report.
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'fa3_live.json.gz'))).toString('utf8'));
  const items = (arr) => (arr || []).map(j => ({ json: j }));
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 600), items: [] }); console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 450))); };
  const path0 = (u) => String(u || '').replace(/^https?:\/\/[^/]+/i, '') || '/';

  // ===================================================================================
  // SA22 / SA26 — the page Search Console reports for a query is the answer; a misspelt brand query is the brand
  // ===================================================================================
  await guard('SA22 A-22 / A-26 discover: the page Google ranks for each Search Console query, and the brand typed with a slip', async () => {
    reset(); const SN = 'SA22 A-22 A-26 — discover names the page Search Console reports for each query (word matching only as a labelled fallback), and "techandf cc" is the brand, not a seed';
    begin(SN); const check = mkCheck(SN);
    mock('Seed List', [{ json: FX.seed764 }]);
    mock('Load Query History (Discovery)', items(FX.q764));
    mock('Site Model', [{ json: { site_model: { ...FX.site_model764, pages: FX.pages764 } } }]);
    const out = (await run('Search Console Seeds (Discovery)', [{ json: {} }]))[0].json;
    const sc = out.search_console;
    const rows = [...sc.queries, ...sc.answered].filter((q, i, a) => a.findIndex(x => x.keyword === q.keyword) === i);
    const differ = rows.filter(q => q.on_site && path0((q.answered_by || {}).url) !== path0(q.page));
    console.log('   rows ->', rows.length, '| answered page differs from Search Console page ->', differ.map(q => q.keyword + ' -> ' + path0(q.answered_by.url) + ' vs ' + path0(q.page)).join(' | '));
    const pricing = rows.find(q => q.keyword === 'dynamics 365 finance and operations pricing dubai');
    check('A-22: "dynamics 365 finance and operations pricing dubai" names the F&O page Search Console reports at #9.6, not the VAT article',
      pricing && path0(pricing.answered_by.url) === '/dynamics-365-finance-and-operations-uae' && pricing.answered_by.matched_by === 'search console'
      && /you rank #9\.6 with \/dynamics-365-finance-and-operations-uae/.test(pricing.why) && !/vat-compliance/.test(pricing.why), JSON.stringify(pricing));
    check('A-22: every row whose Search Console page is a page of the site names THAT page, except a listing page (the blog index), which names the article behind it and says Google shows the listing',
      differ.every(q => /^\/insights\/?$/.test(path0(q.page)) && q.answered_by.listing && /Google shows \/insights \(a listing page\)/.test(q.why)) && differ.length <= 2,
      JSON.stringify(differ.map(q => [q.keyword, path0(q.page), path0(q.answered_by.url), q.why])));
    const fo = rows.find(q => q.keyword === 'f&o implementation uae');
    check('A-22: where another page targets the search more closely by its words, both are named — Google\'s page first',
      fo && path0(fo.answered_by.url) === '/dynamics-365-finance-and-operations-uae' && fo.answered_by.also && /rollout/.test(fo.answered_by.also.url) && /matches the words of this search more closely/.test(fo.why), JSON.stringify(fo));
    check('A-26: "techandf cc" (the brand with one slip) is counted as a brand search: not a seed, not a page-mismatch row',
      !out.gsc_seeds.includes('techandf cc') && !rows.some(q => q.keyword === 'techandf cc') && sc.dropped.brand >= 4, JSON.stringify({ seeds: out.gsc_seeds, dropped: sc.dropped }));
    // the brand test itself, both paths (discovery and the weekly report share GQ.brandTest)
    const nodeSrc = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), 'Search_Console_Seeds_Discovery_.js'), 'utf8');
    const at = nodeSrc.indexOf('const GQ = (() => {'); const end = nodeSrc.indexOf('\n})();', at);
    const GQ = new Function(nodeSrc.slice(at, end + 6) + '\nreturn GQ;')();   // the kit exactly as the build inlined it
    const BR = GQ.brandTest('techand.ai', ['Techand', 'Tech&']);
    const yes = ['techandf cc', 'techadn', 'techands uae', 'techand ai'], no = ['techandkey com', 'technology & data', 'tech and software', 'teched solutions', 'technical consulting'];
    check('A-26: one slip from a 6+ letter brand name is the brand; another word that merely starts like it is not (R89 kept)',
      yes.every(BR.is) && !no.some(BR.is), JSON.stringify({ yes: yes.map(q => [q, BR.is(q)]), no: no.map(q => [q, BR.is(q)]) }));
  });

  // ===================================================================================
  // SA24 — discover's competitors are businesses, and the report says how they were chosen
  // ===================================================================================
  await guard('SA24 A-24 discover competitors: no job board, directory or list; declared ones first; the basis printed', async () => {
    reset(); const SN = 'SA24 A-24 — discovery takes its competitors from the owner\'s declared list and the results page\'s businesses only; naukrigulf.com (a job board) and the directories are passed over with their class';
    begin(SN); const check = mkCheck(SN);
    mock('Seed List', [{ json: FX.seed764 }]);
    mock('Research Requests', items(FX.rr764));
    const reqs = (await run('Competitor Keyword Requests', items(FX.rra764))).map(i => i.json);
    const doms = reqs.map(r => r.domain); const basis = reqs[0].competitor_basis || {};
    console.log('   competitors ->', doms.join(', '), '|', basis.note);
    check('A-24: naukrigulf.com, indeed, glassdoor and the "Top 100 / Top 10" list sites are not competitors',
      !doms.some(d => /naukrigulf|indeed|glassdoor|themanifest|sortlist|clutch|techbehemoths/.test(d)), JSON.stringify(doms));
    check('A-24: the competitors the owner declared come first, then the first business on the results page (hlbhamt.com, #1)',
      doms[0] === 'cleartax.com' && doms[1] === 'azentio.com' && doms[2] === 'hlbhamt.com', JSON.stringify(doms));
    check('A-24: every competitor says how it was chosen, and the passed-over results say why (job board, directory, list)',
      basis.picked.length === 3 && basis.picked.every(p => p.how) && basis.skipped.some(s => s.domain === 'naukrigulf.com' && s.why === 'job board')
      && basis.skipped.some(s => s.domain === 'themanifest.com' && /directory/.test(s.why)) && /Passed over: .*naukrigulf\.com \(job board\)/.test(basis.note), JSON.stringify(basis).slice(0, 600));
    // with no declared competitors the results page alone decides, and still never a job board
    const seedNo = { ...FX.seed764, competitors: [], site_model: { competitors: [] } };
    mock('Seed List', [{ json: seedNo }]);
    const reqs2 = (await run('Competitor Keyword Requests', items(FX.rra764))).map(i => i.json);
    check('A-24: with nothing declared, the three are the first three businesses of the page (hlbhamt.com, sscoglobal.com, fit.ae) — the old pick was hlbhamt / naukrigulf / sscoglobal',
      reqs2.map(r => r.domain).join(',') === 'hlbhamt.com,sscoglobal.com,fit.ae', JSON.stringify(reqs2.map(r => r.domain)));
  });

  // ===================================================================================
  // SA01 — the Keyword Check sees the live page, and a paused ladder is "paused"
  // ===================================================================================
  await guard('SA01 A-1 / A-2 Keyword Check: the live Business Central page answers "business central partner uae"; a paused ladder says paused', async () => {
    reset(); const SN = 'SA01 A-1 A-2 — the Keyword Check reads the page inventory: "business central partner uae" names /dynamics-365-business-central-uae (exec 750 said existing: null), and the paused ladder of "dynamics 365 partner uae" is "paused", not "planned"';
    begin(SN); const check = mkCheck(SN);
    const ask = async (ex) => { const A = FX['as' + ex];
      for (const n of ['Assess Result', 'Load Ladders (Assess)', 'Load Content Log (Assess)']) mock(n, items(A[n]));
      mock('Load Pages (Assess)', items(FX.pages764)); mock('Load Ladder Settings (Assess)', items(FX.settings764));
      return (await run('Assess Response', items(A['Fit Parsed?'])))[0].json.body; };
    const b750 = await ask('750');
    console.log('   750 existing ->', JSON.stringify(b750.existing), '| label ->', b750.label);
    check('A-1: "business central partner uae" names the live Business Central page and tells the owner to improve it',
      b750.existing && /dynamics-365-business-central-uae/.test(b750.existing.page_url) && b750.existing.how === 'a page of yours' && /improve that page/.test(b750.existing.note)
      && /you already have a page for it/.test(b750.label), JSON.stringify(b750.existing));
    const b751 = await ask('751');
    console.log('   751 existing ->', JSON.stringify(b751.existing));
    check('A-2: the ladder lad_mv4vxu3bq0kl is paused in seo_ladder_settings and the answer says paused (the row\'s own status is kept beside it)',
      b751.existing && b751.existing.ladder_id === 'lad_mv4vxu3bq0kl' && b751.existing.ladder_status === 'paused' && b751.existing.row_status === 'planned' && /paused/.test(b751.existing.note), JSON.stringify(b751.existing));
    mock('Load Pages (Assess)', [{ json: {} }]); mock('Load Ladder Settings (Assess)', [{ json: {} }]);
    const A = FX.as750; for (const n of ['Assess Result', 'Load Ladders (Assess)', 'Load Content Log (Assess)']) mock(n, items(A[n]));
    const bNone = (await run('Assess Response', items(A['Fit Parsed?'])))[0].json.body;
    check('A-1: with no page inventory on file the answer is what it was (no page invented)', bNone.existing === null, JSON.stringify(bNone.existing));
  });

  // ===================================================================================
  // SA05 / SA23 — the verdict and the keyword report read what the site already holds before they advise
  // ===================================================================================
  const verdictRun = async (ex) => {
    mock('Prepare Keyword Run', [{ json: FX['pkr' + ex] }]);
    mock('Load Ladders (Run)', items(FX.ladders764)); mock('Load Ladder Settings (Run)', items(FX.settings764)); mock('Load Drafts (Run)', items(FX.log_before));
    const oc = (await run('Own Coverage (Run)', store['Load Drafts (Run)']))[0].json;
    mock('Merge Keyword Data', [{ json: { ...FX['mkd' + ex], own_coverage: oc.own_coverage, own_coverage_text: oc.own_coverage_text } }]);
    mock('Load Site Cache', items(FX['cache' + ex]));
    const pv = (await run('Parse Verdict', items(FX['va' + ex])))[0].json;
    return { oc, pv };
  };
  await guard('SA05 A-5 / A-6 verdict "e invoicing software uae": the ladder\'s pages stay off the page, the penalties rung is named, the threshold on the page is not asked for', async () => {
    reset(); const SN = 'SA05 A-5 A-6 — the verdict keeps the planned pages of the ladder "e invoicing in uae" and the written draft off the page it improves, names them, says the penalties topic is covered, and never asks to add the AED 50 million threshold the page states';
    begin(SN); const check = mkCheck(SN);
    const { oc, pv } = await verdictRun('760');
    console.log('   own coverage ->', oc.own_coverage_text.split('\n').map(l => l.slice(0, 140)).join(' || '));
    console.log('   secondary ->', JSON.stringify(pv.secondary_keywords), '| covered ->', JSON.stringify(pv.secondary_covered.map(c => [c.keyword, c.by, c.head_keyword || c.url])));
    console.log('   changes ->\n      ' + pv.verdict_changes.join('\n      '));
    check('A-5: the verdict prompt is told what the site already has on the topic (the ladder "e invoicing in uae" with its pages, the drafts)',
      /Keyword ladder "e invoicing in uae"/.test(oc.own_coverage_text) && /uae e invoicing penalties/.test(oc.own_coverage_text) && /uae e-invoicing deadline 2027/.test(oc.own_coverage_text), oc.own_coverage_text);
    const off = ['uae e-invoicing requirements', 'list of asp for e-invoicing in uae', 'is e-invoicing mandatory in uae', 'uae e-invoicing accredited service provider', 'uae e-invoicing deadline'];
    check('A-5: the five searches the ladder (rows 3, 4, 6, 7) and the draft 7 hold are taken off this page',
      off.every(k => !pv.secondary_keywords.some(s => s.toLowerCase() === k)) && off.every(k => pv.secondary_covered.some(c => c.keyword.toLowerCase() === k)),
      JSON.stringify({ kept: pv.secondary_keywords, covered: pv.secondary_covered.map(c => c.keyword) }));
    check('A-5: the customer reads which ladder / draft holds them (no "ladder" word anywhere live)',
      pv.verdict_changes.some(l => /^Kept off this page because the site already holds them/.test(l) && /keyword ladder "e invoicing in uae"/.test(l) && /"UAE e-invoicing deadline" \(your (keyword ladder|draft)/.test(l)), JSON.stringify(pv.verdict_changes.slice(-1)));
    check('A-5: "a penalties section" is answered with the penalties rung and its page',
      pv.verdict_changes.some(l => /penalties section/.test(l) && /The site already covers "uae e invoicing penalties"/.test(l) && /penalties-mitigation-costs/.test(l)), JSON.stringify(pv.verdict_changes.filter(l => /penalt/.test(l))));
    check('A-6: "add ... the AED 50 million threshold" no longer asks for what the page states; the line says it is already there',
      pv.verdict_changes.some(l => /PINT-AE/.test(l) && !/, and the AED 50 million threshold/.test(l) && /Already on the page, keep as it is: the AED 50 million threshold/.test(l))
      && pv.already_on_page.some(x => /AED 50 million/.test(x)), JSON.stringify(pv.verdict_changes.filter(l => /PINT/.test(l))));
    check('A-5: every secondary keyword taken off says what holds it, and the page is still the one to improve', pv.secondary_covered.every(c => c.note && c.how) && pv.existing_page_action === 'improve'
      && /^Improve the page the site already has for this search/.test(pv.verdict_changes[0] || ''), JSON.stringify({ cov: pv.secondary_covered.map(c => [c.keyword, c.note]), c0: pv.verdict_changes[0] }));
  });
  await guard('SA23 A-23 keyword report "erp system dubai": the Business Central / F&O pages and the two ERP ladders are named before "build a page"', async () => {
    reset(); const SN = 'SA23 A-23 — the keyword report names /dynamics-365-business-central-uae and /dynamics-365-finance-and-operations-uae before it says "build a ... page", and keeps the BC page\'s slug and the ERP ladders\' searches off its secondary keywords';
    begin(SN); const check = mkCheck(SN);
    const { oc, pv } = await verdictRun('765');
    console.log('   changes[0] ->', (pv.verdict_changes[0] || '').slice(0, 260));
    console.log('   secondary ->', JSON.stringify(pv.secondary_keywords), '| covered ->', JSON.stringify(pv.secondary_covered.map(c => [c.keyword, c.by, c.head_keyword || c.url])));
    const before = pv.verdict_changes.find(l => /^Before building anything new: the site already has/.test(l)) || '';
    check('A-23: before "build a ... page", the report names the live Business Central and F&O pages',
      /dynamics-365-business-central-uae/.test(before) && /dynamics-365-finance-and-operations-uae/.test(before) && pv.existing_related.length >= 2
      && pv.verdict_changes.indexOf(before) < pv.verdict_changes.findIndex(l => /\bBuild a\b/i.test(l)), JSON.stringify({ changes: pv.verdict_changes.map(l => l.slice(0, 90)), rel: pv.existing_related }));
    check('A-23: the search itself is the ladder "erp software uae"\'s rung "erp software dubai" in other words, and the report says so first',
      pv.keyword_covered && pv.keyword_covered.head_keyword === 'erp software uae' && /^This search is already planned on the site: your keyword ladder "erp software uae"/.test(pv.verdict_changes[0] || ''),
      JSON.stringify({ kc: pv.keyword_covered, c0: pv.verdict_changes[0] }));
    const cov = (k) => pv.secondary_covered.find(c => c.keyword.toLowerCase() === k);
    check('A-23: "dynamics 365 business central uae" (the live page\'s slug) is covered by that page',
      cov('dynamics 365 business central uae') && /business-central-uae/.test(cov('dynamics 365 business central uae').url), JSON.stringify(pv.secondary_covered));
    check('A-23: "erp software dubai" (rung of "erp software uae") and "erp implementation partner uae" (ladder "erp implementation dubai") are named, not folded in',
      (cov('erp software dubai') ? cov('erp software dubai').head_keyword === 'erp software uae' : (pv.keyword_covered || {}).head_keyword === 'erp software uae')
      && cov('erp implementation partner uae') && cov('erp implementation partner uae').head_keyword === 'erp implementation dubai',
      JSON.stringify(pv.secondary_covered.map(c => [c.keyword, c.head_keyword, c.url])));
    check('A-23: the prompt the verdict read carries the BC page among the pages on the topic', oc.own_coverage.pages.some(p => /business-central-uae/.test(p.url)), JSON.stringify(oc.own_coverage.pages));
  });

  // ===================================================================================
  // SA07 — the coverage target: whole terms, and never the regulator's page as the page to beat
  // ===================================================================================
  await guard('SA07 A-7 coverage target: no fragment terms, and a government page is never the page a vendor has to beat', async () => {
    reset(); const SN = 'SA07 A-7 — the term model of "e invoicing software uae" holds whole phrases ("ministry of finance", not "ministry finance" / "businesses the uae" / "features like"), and the coverage target is a business\'s page, not mof.gov.ae';
    begin(SN); const check = mkCheck(SN);
    const A = FX.a7;
    for (const n of ['Pick Top 6', 'SERP Top 10', 'Collect Site URLs', 'Collect Client Pages', 'Read Competitor Pages']) mock(n, items(A[n]));
    const acp = (await run('Analyze Competitor Pages', [{ json: {} }]))[0].json;
    const terms = (acp.term_model || []).map(t => t.term);
    console.log('   terms ->', terms.slice(0, 26).join(' | '));
    check('A-7: no phrase joins words a one- or two-letter word separated, and none ends on "like"',
      !terms.some(t => /^(businesses the uae|ministry finance|features like)$/.test(t) || / like$/.test(t)) && terms.includes('ministry of finance'), JSON.stringify(terms));
    mock('Collect Facts', [{ json: acp }]);
    const pa = (await run('Parse Analysis', items(A['After Count (Competitor Analyzer)'])))[0].json;
    const ct = pa.coverage_target || {};
    console.log('   coverage target ->', JSON.stringify({ best: ct.best && ct.best.domain, basis: ct.basis }));
    check('A-7: the page to beat is not the regulator (mof.gov.ae), and the basis says the government page was left out',
      ct.best && !/gov\./.test(ct.best.domain) && /government \/ regulator page\(s\) left out/.test(ct.basis || ''), JSON.stringify(ct.best) + ' ' + ct.basis);
  });

  // ===================================================================================
  // SA04 — describe: the pages' own titles on the canonical host, and facts that are facts
  // ===================================================================================
  await guard('SA04 A-4 describe: pages read carry their own titles on the canonical host; site_facts holds no section label, call to action or article title', async () => {
    reset(); const SN = 'SA04 A-4 — describe names /industries "Industries We Serve" (not the menu text "Banking Financial Services"), the homepage on www, no "Read more" link as a menu page, and site_facts without "What We Do" / "Insights" / the site\'s own article titles';
    begin(SN); const check = mkCheck(SN);
    const A = FX.a4;
    for (const n of ['Clean Site Text', 'Nav Pages Plan', 'Read Nav Pages']) mock(n, items(A[n]));
    mock('Site Model', [{ json: { site_model: { ...FX.site_model764, pages: FX.pages764 } } }]);
    const sp = (await run('Site Pages', [{ json: {} }]))[0].json;
    console.log('   pages read ->', sp.site_pages.map(p => p.url.replace(/^https:\/\//, '') + ' "' + p.title + '"').join(' | '));
    const t = (path) => (sp.site_pages.find(p => p.url.endsWith(path)) || {}).title;
    check('A-4: /industries and /capabilities/data are named by their own page titles, not the menu link text',
      t('/industries') === 'Industries We Serve' && t('/capabilities/data') === 'Data & Analytics', JSON.stringify(sp.site_pages));
    check('A-4: every page read is on the canonical host (www.techand.ai), the homepage included',
      sp.site_pages.every(p => /^https:\/\/www\.techand\.ai\//.test(p.url)), JSON.stringify(sp.site_pages.map(p => p.url)));
    check('A-4: a "Read more about ..." article link is not kept as a menu page', !(sp.nav_pages || []).some(n => /^read more/i.test(n.text)), JSON.stringify(sp.nav_pages));
    const bad = ['Industries We Serve', 'What We Do', 'Insights', 'Proven Track Record', 'Global Partner', 'Ready to Transform Your Business?', 'Top Peppol E-Invoicing Software Features Every UAE CFO Must Look For', 'The Financial Reporting Trap: Why D365 F&O Users Still Reach for Excel'];
    check('A-4: site_facts keeps the claims ("20+ Years", "24/7 Support") and drops section labels, calls to action and the site\'s own article titles, and counts them',
      sp.site_facts.includes('20+ Years') && sp.site_facts.includes('24/7 Support') && !bad.some(b => sp.site_facts.includes(b)) && sp.site_facts_dropped >= bad.length,
      JSON.stringify({ kept: sp.site_facts.slice(0, 12), dropped: sp.site_facts_dropped }));
  });

  // ===================================================================================
  // SA25 — discovery's first picks carry the ladder that already holds them
  // ===================================================================================
  const discover764 = async () => {
    mock('Collect Research', [{ json: FX.cr764 }]);
    mock('Relevance Chunks', [{ json: { keywords_chunk: FX.rel764.map((r, i) => ({ n: i + 1, keyword: r.keyword })) } }]);
    mock('Site Model', [{ json: { site_model: { ...FX.site_model764, pages: FX.pages764 } } }]);
    mock('Load Domain Ladders (Discovery)', items(FX.ladders764)); mock('Load Ladder Settings (Discovery)', items(FX.settings764));
    mock('Reach (Discovery)', items(FX.reach764)); mock('Load Site Cache', [{ json: {} }]);
    return (await run('Rank Keywords', [{ json: { output: { items: FX.rel764 } } }]))[0].json.keyword_strategy;
  };
  await guard('SA25 A-25 discover: "Where to start", "Build first" and "Now" never lead with a search a ladder already holds', async () => {
    reset(); const SN = 'SA25 A-25 — "erp system dubai" / "erp systems in uae" are the ladder "erp software uae"\'s searches in other words: Covered, never "Where to start"; a near topic keeps its tier with the ladder named';
    begin(SN); const check = mkCheck(SN);
    const ks = await discover764();
    const kw = (k) => ks.keywords.find(x => x.keyword === k) || {};
    console.log('   where to start ->', ks.pipeline_keyword && ks.pipeline_keyword.keyword, '| Now ->', ks.clusters.filter(c => c.tier === 'Now').map(c => c.primary_keyword).join(', '));
    check('A-25: "erp system dubai" (the live run\'s "Where to start") is covered by the ladder "erp software uae" — the same search in other words',
      (kw('erp system dubai').ladder_covered || {}).head_keyword === 'erp software uae' && /other words/.test(kw('erp system dubai').ladder_covered.how), JSON.stringify(kw('erp system dubai').ladder_covered));
    check('A-25: "erp systems in uae" (priority #5, no ladder note live) carries one now',
      !!kw('erp systems in uae').ladder_covered, JSON.stringify(kw('erp systems in uae').ladder_covered));
    const p = ks.pipeline_keyword || {};
    check('A-25: "Where to start" is a search no ladder holds, or it says which ladder it is close to',
      p.keyword && !p.ladder_covered && (!p.ladder_near || /close to your ladder/.test(p.ladder_note || '')), JSON.stringify({ k: p.keyword, c: p.ladder_covered, n: p.ladder_near, note: p.ladder_note }));
    const lead = ks.clusters.filter(c => c.tier === 'Now');
    check('A-25: no "Now" topic is a search a ladder holds; a Now topic near a ladder names it',
      lead.every(c => !c.ladder_covered && (!c.ladder_near || /close to your ladder/.test(c.tier_note || ''))) && ks.clusters.some(c => c.primary_keyword === 'erp system dubai' && c.tier === 'Covered'),
      JSON.stringify(ks.clusters.slice(0, 14).map(c => [c.tier, c.primary_keyword, c.tier_note])));
    // the relation itself, one search one page in other words / other places
    const OWNsrc = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), 'Rank_Keywords.js'), 'utf8');
    const at = OWNsrc.indexOf('const OWN = (() => {'); const OWN = at < 0 ? null : new Function(OWNsrc.slice(at, OWNsrc.indexOf('\n})();', at) + 6) + '\nreturn OWN;')();
    check('A-25: OWN.relate — system = software, another emirate is another place, one extra word is a variant, unrelated stays unrelated',
      OWN && OWN.relate('erp systems in uae', 'erp software uae') === 'other words' && OWN.relate('erp implementation uae', 'erp implementation dubai') === 'other place'
      && OWN.relate('erp implementation partner uae', 'erp implementation dubai') === 'variant' && OWN.relate('cloud solutions', 'erp software uae') === null
      && OWN.relate('uae e-invoicing deadline', 'uae e-invoicing deadline 2027') === 'same', OWN ? 'relations differ' : 'OWN kit not inlined in Rank Keywords');
  });
};
