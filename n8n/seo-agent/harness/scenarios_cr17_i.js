// CR17I1 (client report 2026-11-17, F8, build section 199): the weekly site report counts tracked keywords by the one definition the app uses
// (app/shared/src/tracked-keywords.ts): the searches checked on Google every week = the keyword ladders' keywords + the client's own list, each
// search once; written pages that are not ladder pages are followed in Search Console and counted apart. The client's report called 6 ladder
// keywords and 6 written pages "Tracked keywords" (12 rows) while the app said 0 and 7.
// Synthetic data: the Site Metrics item of the harness' own "site tracker" scenario (northwind-erp.com), saved as a fixture.
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const M = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'cr17i_site_metrics.json'), 'utf8'))[0];

  await guard('CR17I1 tracked keywords counted once, written pages apart', async () => {
    reset(); const SN = 'CR17I1 (client report 2026-11-17, F8) the weekly report counts the searches we check on Google once (ladder + your list) and the other written pages apart'; begin(SN); const check = mkCheck(SN);
    const m = JSON.parse(J(M));
    const base = m.tracked.filter(t => t.source !== 'blog');
    // the client's case: a keyword in both lists, one spelled with other spacing, a written page whose search is already a ladder keyword
    m.tracked = [
      ...base,
      { ...base.find(t => t.source === 'ladder'), source: 'site', keyword: base.find(t => t.source === 'ladder').keyword.toUpperCase() },
      { ...base[0], keyword: base[0].keyword.replace(/ /g, '  ') },
      { ...m.tracked.find(t => t.source === 'blog'), keyword: 'erp for distributors' },
      { ...m.tracked.find(t => t.source === 'blog'), keyword: 'wms uae' },
      { ...m.tracked.find(t => t.source === 'blog'), keyword: 'WMS UAE' },
      { ...m.tracked.find(t => t.source === 'blog'), keyword: base.find(t => t.source === 'ladder').keyword },
    ];
    const searches = new Set(base.map(t => t.keyword.toLowerCase())).size;
    mock('Site Metrics', [{ json: m }]);
    mock('Site Brief', [{ json: { error: 'no model in this test' } }]);
    const rep = (await run('Site Report', [{ json: {} }]))[0].json;
    const html = rep.html || '';
    const head = (html.match(/Tracked keywords: (\d+) (?:search|searches) we check on Google/) || [])[1];
    const pages = (html.match(/Your other pages: (\d+) followed in Search Console/) || [])[1];
    check('the searches checked on Google are counted once each (a keyword in both lists, another spelling: one search)', Number(head) === searches, J({ head, searches }));
    check('written pages that are not one of those searches are counted apart, each once', Number(pages) === 2, J({ pages }));
    check('the old single table that mixed both is gone', !/>Tracked keywords</.test(html), (html.match(/<h3[^>]*>[^<]*<\/h3>/g) || []).join(' | ').slice(0, 600));
    const noPages = JSON.parse(J(m)); noPages.tracked = base;
    mock('Site Metrics', [{ json: noPages }]);
    const rep2 = (await run('Site Report', [{ json: {} }]))[0].json;
    check('no written page outside the ladders: no second table', !/Your other pages/.test(rep2.html || '') && new RegExp('Tracked keywords: ' + searches + ' ').test(rep2.html || ''), '');
  });
};
