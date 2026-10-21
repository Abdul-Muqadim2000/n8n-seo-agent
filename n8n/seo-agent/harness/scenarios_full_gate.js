// FG1 (2026-10-21): one business-fit gate on every keyword list the full report shows (easy wins, keyword gap, striking distance,
// opportunities). The leaks of 10-17 / 10-21 (another company's brand, document attestation, finance jobs, facilities management)
// run through the GENERATED Analyze Keywords for a site that sells Dynamics 365 / AI consulting / e-invoicing: they are left out
// with a reason; the on-topic keywords stay.
const V = require('./fixtures_v5');
module.exports = async (ctx) => {
  const { H, run, mock, store } = ctx;
  const check = (label, ok, detail) => { H.results.push({ scenario: 'FG1', node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const row = (dom, [k, v, kd, intent, pos]) => ({ se_type: 'google', keyword_data: { keyword: k, keyword_info: { search_volume: v, cpc: 2.5, competition_level: 'HIGH' }, keyword_properties: { keyword_difficulty: kd }, search_intent_info: { main_intent: intent } }, ranked_serp_element: { serp_item: { type: 'organic', rank_group: pos, rank_absolute: pos, url: 'https://' + dom + '/' + k.replace(/\s+/g, '-') } } });
  const ranked = (dom, list) => V.task({ target: dom, items: list.map(l => row(dom, l)) });
  const GOOD = [['dynamics 365 business central partner uae', 320, 18, 'commercial'], ['ai consulting dubai', 480, 22, 'commercial']];
  const LEAK = [['ibt: no 1 bpo company in middle east', 900, 12, 'commercial'], ['uae document attestation', 2400, 15, 'commercial'], ['mofa document attestation', 1300, 14, 'informational'],
    ['finance jobs in uae', 5400, 10, 'commercial'], ['top facilities management companies uae', 1900, 16, 'commercial'], ['mofa attestation dubai', 1600, 13, 'informational']];
  const all = [...GOOD, ...LEAK].map(([k, v, kd, i]) => [k, v, kd, i, 4]);
  mock('Competitor Analysis', { domain: 'techand.ai', competitors: ['rivalco.com'], business: 'Microsoft Dynamics 365, AI consulting and e-invoicing for UAE companies', services: ['Dynamics 365 Business Central', 'AI consulting', 'E-invoicing'], extra_findings: [], extra_works: [] });
  mock('KW Targets', [{ domain: 'techand.ai', is_you: true }, { domain: 'rivalco.com', is_you: false }]);
  mock('Ranked Keywords', [ranked('techand.ai', [['techand', 30, 1, 'navigational', 1]]), ranked('rivalco.com', all)]);
  mock('Fallback Queries', [{ query: 'dynamics 365 uae' }, { query: 'ai consulting' }]);
  delete store['Load Site Cache'];
  const out = await run('Analyze Keywords', V.task({ items: [] }));
  const sk = out[0].json.site_keywords;
  const lists = { gap: sk.keyword_gap, easy: sk.easy_wins, opp: Object.values(sk.opportunities_by_intent).flat(), striking: sk.striking_distance };
  const shown = (l) => l.map(k => k.keyword);
  for (const [name, l] of Object.entries(lists)) {
    const leaked = shown(l).filter(k => LEAK.some(x => x[0] === k));
    check('FG1 ' + name + ': no off-business keyword', !leaked.length, leaked.join(' | '));
  }
  check('FG1 gap keeps the on-topic keywords', GOOD.every(g => shown(lists.gap).includes(g[0])), JSON.stringify(shown(lists.gap)));
  check('FG1 every leak is in refused with a reason', LEAK.every(x => sk.refused.some(r => r.keyword === x[0] && r.reason)), JSON.stringify(sk.refused.map(r => [r.keyword, r.reason])));
  check('FG1 no on-topic keyword is refused', !sk.refused.some(r => GOOD.some(g => g[0] === r.keyword)), JSON.stringify(sk.refused.filter(r => GOOD.some(g => g[0] === r.keyword))));
};
