// CR17I1 (client report 2026-11-17, F8, build section 199): the weekly site report counts tracked keywords by the one definition the app uses
// (app/shared/src/tracked-keywords.ts): the searches checked on Google every week = the keyword ladders' keywords + the client's own list, each
// search once; written pages that are not ladder pages are followed in Search Console and counted apart. The client's report called 6 ladder
// keywords and 6 written pages "Tracked keywords" (12 rows) while the app said 0 and 7.
// Synthetic data: the Site Metrics item of the harness' own "site tracker" scenario (northwind-erp.com), saved as a fixture.
// CR17I2 (review R5 M4 / L8, FX-LADDER): Site Plan builds that list by the app's own definition (rung states, one search, written pages only).
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
  await guard('CR17I2 Site Plan tracks by the app definition (review R5 M4 / L8)', async () => {
    reset(); const SN = 'CR17I2 (review R5 M4 / L8) Site Plan: stopped, merged, archived and set-aside rungs are not tracked, two spellings of one search are one, only written pages are followed (the app\'s tracked-keywords.ts)'; begin(SN); const check = mkCheck(SN);
    const SID = 'site_northwind-erp-com', DOM = 'northwind-erp.com';
    const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
    const L = (kw, status, rung) => ({ ladder_id: 'lad_n', domain: DOM, head_keyword: 'erp software uae', keyword: kw, rung: rung || 1, status, target_url: 'https://' + DOM + '/' + kw.replace(/\s+/g, '-') });
    mock('Load Sites', items([{ site_id: SID, domain: DOM, status: 'active', keywords: 'erp uae, cloud erp', country: 'United Arab Emirates', location_code: 2784, language_code: 'en', email: '', callback_url: 'https://hooks.example.test/s' }]));
    mock('Load Ladders', items([L('erp software uae', 'planned', 4), L('erp implementation cost', 'published'), L('erp for distributors', 'stopped'), L('erp for retailers', 'merged'), L('erp for clinics', 'archived'),
      L('erp for schools', 'set_aside'), L('erp implementations costs', 'planned'), L('ERP UAE', 'planned')]));
    mock('Load Content Log', items([
      { domain: DOM, keyword: 'wms uae', status: 'published', published_url: 'https://' + DOM + '/wms-uae' },
      { domain: DOM, keyword: 'inventory software', status: 'written' },
      { domain: DOM, keyword: 'held page', status: 'held' }, { domain: DOM, keyword: 'failed page', status: 'failed' }, { domain: DOM, keyword: 'started page', status: 'started' }]));
    for (const n of ['Load Rank History', 'Load Site Metrics', 'Load Query History', 'Load Console Alerts', 'Load Monitors (Site)', 'Load Check-ins', 'Load Cycles']) mock(n, items([]));
    mock('Manual Run', [{ json: { domain: DOM } }]);
    const p = (await run('Site Plan', [{ json: {} }]))[0].json;
    const tr = (p.tracked || []);
    const kw = (src) => tr.filter(t => t.source === src).map(t => t.keyword).sort();
    console.log('   tracked ->', J(tr.map(t => [t.source, t.keyword])));
    check('M4 your list + the rungs still in play, each search once ("ERP UAE" is "erp uae", "erp implementations costs" is "erp implementation cost")',
      J(kw('site')) === J(['cloud erp', 'erp uae']) && J(kw('ladder')) === J(['erp implementation cost', 'erp software uae']), J(tr));
    check('M4 stopped, merged, archived and set-aside rungs are not tracked', !tr.some(t => /distributors|retailers|clinics|schools/.test(t.keyword)), J(tr));
    check('L8 only written or live pages are followed: a held, failed or started run wrote no page', J(kw('blog')) === J(['inventory software', 'wms uae']), J(kw('blog')));
    const app = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'app', 'shared', 'src', 'tracked-keywords.ts'), 'utf8');
    const appList = ((app.match(/UNTRACKED_RUNG_STATUSES: readonly string\[\] = \[([^\]]*)\]/) || [])[1] || '').replace(/\s/g, '');
    const code = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), 'Site_Plan.js'), 'utf8');
    const engList = ((code.match(/const UNTRACKED = \[([^\]]*)\]/) || [])[1] || '').replace(/\s/g, '');
    check('M4 the engine and the app leave out the same rung states (one list)', !!appList && appList === engList, J({ appList, engList }));
  });
};
