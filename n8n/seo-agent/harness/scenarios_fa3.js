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
      && basis.skipped.some(s => s.domain === 'themanifest.com' && /directory/.test(s.why)) && /passed over on that page: naukrigulf\.com — job board/.test(basis.note), JSON.stringify(basis).slice(0, 600));
    // with no declared competitors the results page alone decides, and still never a job board
    const seedNo = { ...FX.seed764, competitors: [], site_model: { competitors: [] } };
    mock('Seed List', [{ json: seedNo }]);
    const reqs2 = (await run('Competitor Keyword Requests', items(FX.rra764))).map(i => i.json);
    check('A-24: with nothing declared, the three are the first three businesses of the page (hlbhamt.com, sscoglobal.com, fit.ae) — the old pick was hlbhamt / naukrigulf / sscoglobal',
      reqs2.map(r => r.domain).join(',') === 'hlbhamt.com,sscoglobal.com,fit.ae', JSON.stringify(reqs2.map(r => r.domain)));
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
