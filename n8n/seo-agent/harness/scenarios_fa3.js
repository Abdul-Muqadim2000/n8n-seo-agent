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
};
