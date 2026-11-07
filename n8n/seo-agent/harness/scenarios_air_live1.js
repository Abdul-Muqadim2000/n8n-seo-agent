// LIVE1 (2026-11-07, docs/ai-ranking-2026-11-05/fixes/LIVE1.md): the defects of the first live `on` run of AI ranking (2026-11-06), each pinned
// on the shape production produced. Synthetic data only (.example hosts).
//   LIVE1-1  (kit checks in scenarios_air_learn.js) a refresh (L06) only with a concrete page address; here: the AI Rank Plan sink carries the
//            refresh's page into the target row (production wrote page_url '' because it read only ref.url), and a refresh that has no address
//            is refused with its reason, never stored
//   LIVE1-4  the labelled prospect-rule set (accuracy/prospects.json): a form's drop-down is not the page's topic (gambling), a social or
//            professional network is never a competitor; precision and recall 100%, the old rules' misses named
const fs = require('fs'); const path = require('path');
const plumb = require('./scenarios_air_plumb');
const WF_DIR = path.join(__dirname, '..', 'workflows');
const readWf = (f) => { const w = JSON.parse(fs.readFileSync(path.join(WF_DIR, f), 'utf8')); return Array.isArray(w) ? w[0] : w; };
const J = (x) => String(JSON.stringify(x));

// the production shape: ARL chose L06 with page_url set while its ref held only the question (nq1), and an L06 with no address at all (nq2)
const LIVE_CANDIDATES = `
ARL.candidates = ({ site, diag }) => { const sid = site.site_id;
  const mk = (lever, ref, q, extra) => { const L = ARL_BASE.LEVERS.find(l => l.id === lever); return Object.assign({ action_id: AIRF.actionId(sid, lever, ref), site_id: sid, lever, ref, questions: [q], engines: ['chatgpt'], target_stage: L.to, executor: L.executor, scope: L.scope, sink: L.sink, sink_ref: '', page_url: '', why: '' }, extra || {}); };
  return [mk('L06', { prompt_id: 'nq1' }, 'nq1', { page_url: 'https://nova-ai.example/services/custom-software', why: 'a page of the site is found but not cited' }), mk('L06', { prompt_id: 'nq2' }, 'nq2', { why: 'stage evidence only' })]; };
ARL.choose = (scored) => ({ chosen: scored, deferred: [], refused: [] });
ARL.screenOwnPage = () => ({ refused: null, page_type: '' });
`;
// LIVE1-4: the outreach kit as the Link Builder runs it (generated code)
const loadOK = () => { const src = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), 'LB_Assemble.js'), 'utf8');
  const cut = src.indexOf('const CT = (() => {'); return new Function(src.slice(0, cut) + '; return { LK, RV, OK };')(); };
const withLive = (wf) => { const w = plumb.withFakeKits(wf); const n = w.nodes.find(x => x.name === 'AI Rank Plan'); const a = 'const AIR_CFG = ';
  if (n.parameters.jsCode.split(a).length !== 2) throw new Error('live1: anchor not found'); n.parameters.jsCode = n.parameters.jsCode.replace(a, LIVE_CANDIDATES + '\n' + a); return w; };

module.exports = async (ctx) => {
  const { H, guard, reset, begin } = ctx;
  await guard('air live1', async () => {
    reset(); const SN = 'LIVE1 (2026-11-07): the first live AI ranking run - refresh address, refused targets, placements through the Link Builder vetting';
    begin(SN);
    const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
    const on = await plumb.runGrowth({ wf: withLive(readWf('SEO_Agent_AI_Growth.json')), modes: { nova: 'on', acme: 'off' } });
    const tg = on.r.writes.filter(w => w.node === 'Save AI Rank Targets').flatMap(w => w.rows);
    const plan = ((on.r.runs['AI Rank Plan'] || []).slice(-1)[0] || [[]])[0] || [];
    const nova = (plan.find(i => i.json && i.json.site_id === 'site_nova-ai-example') || {}).json || {};
    const refused = ((nova.air || {}).refused || []);
    const t1 = tg.find(t => t.prompt_id === 'nq1'), t2 = tg.find(t => t.prompt_id === 'nq2');
    check('LIVE1-1 sink: a refresh chosen with its page (ref holding only the question, as production did) writes a target row of kind refresh WITH that page address',
      !!t1 && t1.kind === 'refresh' && t1.page_url === 'https://nova-ai.example/services/custom-software' && !on.r.errors.length, J({ t1, e: on.r.errors }).slice(0, 500));
    check('LIVE1-1 sink: a refresh with no page address is never stored as a target (the cadence could never write it); it is refused with a plain reason',
      !t2 && refused.some(x => /no page address/.test(String(x.why))), J({ t2, refused }).slice(0, 500));

    // ---------------- LIVE1-4 the labelled prospect-rule set ----------------
    const { OK, LK } = loadOK(); const SET = JSON.parse(fs.readFileSync(path.join(__dirname, 'accuracy', 'prospects.json'), 'utf8')); const C = SET.context;
    const predict = (c) => c.rule === 'gambling' ? OK.sellSignals(c.html, LK.pageFacts(c.html, {}, 'https://page.example/')).includes('gambling / CBD / essay-mill topics')
      : !!OK.sellsSame({ type: c.prospect.type, domain: c.prospect.domain, competitors: C.competitors, serp_rivals: c.prospect.serp_rivals || [], ai_rivals: c.prospect.ai_rivals || C.ai_rivals, topics: C.topics, terms: C.terms, title: c.prospect.title, url: c.prospect.url, text: '' });
    for (const rule of ['gambling', 'competitor']) { const cs = SET.cases.filter(c => c.rule === rule); const r = cs.map(c => ({ id: c.id, label: c.label, got: predict(c) }));
      const tp = r.filter(x => x.label && x.got).length, fp = r.filter(x => !x.label && x.got).length, fn = r.filter(x => x.label && !x.got).length;
      const prec = tp + fp ? tp / (tp + fp) : 1, rec = tp + fn ? tp / (tp + fn) : 1;
      console.log('   LIVE1-4 ' + rule + ': ' + cs.length + ' cases, precision ' + (100 * prec).toFixed(1) + '%, recall ' + (100 * rec).toFixed(1) + '%');
      check('LIVE1-4 accuracy/prospects.json ' + rule + ': precision and recall 100% over ' + cs.length + ' labelled cases (the live false positive included)', prec === 1 && rec === 1, J(r.filter(x => x.label !== x.got))); }
  });
};
