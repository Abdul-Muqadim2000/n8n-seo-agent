// LIVE1 (2026-11-07, docs/ai-ranking-2026-11-05/fixes/LIVE1.md): the defects of the first live `on` run of AI ranking (2026-11-06), each pinned
// on the shape production produced. Synthetic data only (.example hosts).
//   LIVE1-1  (kit checks in scenarios_air_learn.js) a refresh (L06) only with a concrete page address; here: the AI Rank Plan sink carries the
//            refresh's page into the target row (production wrote page_url '' because it read only ref.url), and a refresh that has no address
//            is refused with its reason, never stored
//   LIVE1-2  the week's AI ranking page passes the Content Cadence's freshness rules before the choice (a page refreshed or published in the
//            last 60 days is not refreshed again; a keyword written in the last 90 days is not written again), so the reserved slot can write it
//   LIVE1-3  a placement AI ranking would pitch passes the Link Builder's vetting before the choice (OK.placementVet): a list the Link Builder
//            ruled out, a site it already wrote to and a government list are refused with the reason; a contact form only is a manual step
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
// LIVE1-3: six placements on the production shapes (a list the Link Builder refused, a site already pitched, a government list, an e-mail
// contact, a contact form only, no contact yet); the fake choice takes every candidate that is not refused
const PLACE_CANDIDATES = `
ARL.candidates = ({ site }) => { const sid = site.site_id;
  const mk = (url) => { const L = ARL_BASE.LEVERS.find(l => l.id === 'L08'); const ref = { url }; return { action_id: AIRF.actionId(sid, 'L08', ref), site_id: sid, lever: 'L08', ref, questions: ['nq1'], engines: ['chatgpt'], target_stage: L.to, executor: L.executor, scope: L.scope, sink: L.sink, sink_ref: '', page_url: url, factor: 1, why: 'a list the answers cite' }; };
  return ['https://ruled-out.example/top-10-ai-firms', 'https://pitched.example/best-ai-firms', 'https://www.economy.gov.ae/ai-providers-list', 'https://mail-list.example/top-ai-dubai', 'https://form-only.example/top-ai-uae', 'https://quiet.example/ai-firms-list'].map(mk); };
ARL.choose = (scored) => ({ chosen: scored.filter(c => !c.refused).map(c => ({ action_id: c.action_id, site_id: c.site_id, lever: c.lever, executor: c.executor, scope: c.scope, ref: c.ref, questions: c.questions, engines: c.engines, target_stage: c.target_stage,
  expected: { p: 0.2, gain: 0.1, cost: 2, score: 0.05, days: 30 }, prereg: null, sink: c.sink, sink_ref: '', label: c.label || '', intent: 'mixed', keyword: '', page_url: c.page_url, why: c.why })),   // the real choose's action shape (it keeps no other field)
  deferred: [], refused: scored.filter(c => c.refused).map(c => ({ what: c.action_id, why: c.refused })) });
`;
const PLACE_ROWS = (SITE, D) => ({
  seo_link_outreach: [{ site_id: SITE, domain: D, prospect_domain: 'ruled-out.example', type: 'ai_source', status: 'not_fit', fit_reason: 'paid guest posts', page_url: 'https://ruled-out.example/top-10-ai-firms', checked_at: '2026-11-01T01:33:00.000Z', sequence_json: '', contacts_json: '[]', contact_email: '', contact_form_url: '' },
    { site_id: SITE, domain: D, prospect_domain: 'pitched.example', type: 'ai_source', status: 'drafted', fit_reason: 'topic match 55%', page_url: 'https://pitched.example/best-ai-firms', checked_at: '2026-10-25T10:00:00.000Z', sequence_json: '{"steps":[1]}', contacts_json: '[]', contact_email: 'editor@pitched.example', contact_form_url: '', drafted_at: '2026-10-25T10:00:00.000Z' }],
  seo_link_prospects: [{ site_id: SITE, domain: D, prospect_domain: 'mail-list.example', type: 'ai_source', status: 'new', origin: 'ai_growth', contact_email: 'editor@mail-list.example', contact_url: '', source_url: 'https://mail-list.example/top-ai-dubai', outreach_body: '', contacted_at: '', drafted_at: '' },
    { site_id: SITE, domain: D, prospect_domain: 'form-only.example', type: 'ai_source', status: 'new', origin: 'ai_growth', contact_email: '', contact_url: 'https://form-only.example/contact', source_url: 'https://form-only.example/top-ai-uae', outreach_body: '', contacted_at: '', drafted_at: '' }] });
const withPlace = (wf) => { const w = plumb.withFakeKits(wf); const n = w.nodes.find(x => x.name === 'AI Rank Plan'); const a = 'const AIR_CFG = ';
  n.parameters.jsCode = n.parameters.jsCode.replace(a, PLACE_CANDIDATES + '\n' + a); return w; };
// LIVE1-2: two own-page refreshes; the first one's page was published by the agent 9 days before (the cadence would refuse it), the second's not
const FRESH_CANDIDATES = `
ARL.candidates = ({ site }) => { const sid = site.site_id;
  const mk = (q, url) => { const L = ARL_BASE.LEVERS.find(l => l.id === 'L06'); const ref = { prompt_id: q, url }; return { action_id: AIRF.actionId(sid, 'L06', ref), site_id: sid, lever: 'L06', ref, questions: [q], engines: ['chatgpt'], target_stage: L.to, executor: L.executor, scope: L.scope, sink: L.sink, sink_ref: '', page_url: url, keyword: '', factor: 1, why: 'a page of the site is found but not cited' }; };
  return [mk('nq1', 'https://nova-ai.example/services/just-published'), mk('nq2', 'https://nova-ai.example/services/older-page')]; };
ARL.choose = (scored) => ({ chosen: scored.filter(c => !c.refused).slice(0, 1), deferred: [], refused: scored.filter(c => c.refused).map(c => ({ what: c.action_id, why: c.refused })) });   // one own page a week, as the real choose
ARL.screenOwnPage = () => ({ refused: null, page_type: '' });
`;
const withFresh = (wf) => { const w = plumb.withFakeKits(wf); const n = w.nodes.find(x => x.name === 'AI Rank Plan'); const a = 'const AIR_CFG = ';
  n.parameters.jsCode = n.parameters.jsCode.replace(a, FRESH_CANDIDATES + '\n' + a); return w; };
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

    // ---------------- LIVE1-2 the week's AI ranking page is one the cadence can write ----------------
    const fr = await plumb.runGrowth({ wf: withFresh(readWf('SEO_Agent_AI_Growth.json')), modes: { nova: 'on', acme: 'off' },
      tablesFn: (t, F) => { t.seo_content_log = [...(t.seo_content_log || []), { site_id: 'site_nova-ai-example', domain: 'nova-ai.example', keyword: 'custom software dubai', source: 'ladder', status: 'published', started_at: new Date(F.nowMs - 10 * 864e5).toISOString(),
        published_url: 'https://nova-ai.example/services/just-published', published_at: new Date(F.nowMs - 9 * 864e5).toISOString(), existing_page_url: '' }]; } });
    const tgF = fr.r.writes.filter(w => w.node === 'Save AI Rank Targets').flatMap(w => w.rows).filter(r => r.site_id === 'site_nova-ai-example');
    const planF = ((((fr.r.runs['AI Rank Plan'] || []).slice(-1)[0] || [[]])[0] || []).find(i => i.json && i.json.site_id === 'site_nova-ai-example') || {}).json || {};
    check('LIVE1-2 a refresh of a page the agent published 9 days ago is refused before the choice (the cadence waits 60 days), and the week\'s one AI ranking page goes to the next own page, which the reserved slot can write',
      tgF.length === 1 && tgF[0].prompt_id === 'nq2' && tgF[0].kind === 'refresh' && /older-page/.test(tgF[0].page_url) && J((planF.air || {}).refused || []).includes('refreshes a page again only after 60 days') && !fr.r.errors.length,
      J({ tg: tgF.map(t => [t.prompt_id, t.kind, t.page_url]), refused: (planF.air || {}).refused, e: fr.r.errors }).slice(0, 700));

    // ---------------- LIVE1-3 placements through the Link Builder's vetting ----------------
    const SITE = 'site_nova-ai-example', D = 'nova-ai.example';
    const pl = await plumb.runGrowth({ wf: withPlace(readWf('SEO_Agent_AI_Growth.json')), modes: { nova: 'on', acme: 'off' }, extra: PLACE_ROWS(SITE, D) });
    const pr = pl.r.writes.filter(w => w.node === 'Save AI Rank Prospects').flatMap(w => w.rows).filter(r => r.site_id === SITE);
    const plan2 = ((((pl.r.runs['AI Rank Plan'] || []).slice(-1)[0] || [[]])[0] || []).find(i => i.json && i.json.site_id === SITE) || {}).json || {};
    const ref2 = ((plan2.air || {}).refused || []);
    const refusedTxt = J(ref2);
    check('LIVE1-3 a list the Link Builder ruled out (paid guest posts), a site it already wrote to, and a government list are refused BEFORE the choice, each with the Link Builder\'s reason',
      !pr.some(r => ['ruled-out.example', 'pitched.example', 'economy.gov.ae'].includes(r.prospect_domain)) && /ruled it out[^"]*paid guest posts/.test(refusedTxt) && /already wrote to pitched\.example/.test(refusedTxt) && /government site/.test(refusedTxt) && !pl.r.errors.length,
      J({ pr: pr.map(r => r.prospect_domain), ref2, e: pl.r.errors }).slice(0, 700));
    const fo = pr.find(r => r.prospect_domain === 'form-only.example'), ml = pr.find(r => r.prospect_domain === 'mail-list.example'), qt = pr.find(r => r.prospect_domain === 'quiet.example');
    check('LIVE1-3 the slots go to the next placements: the one with an e-mail contact, a contact form only (kept, marked a manual step, its form stored) and one with no contact yet',
      !!ml && ml.contact_email === 'editor@mail-list.example' && !!fo && /manual step/.test(fo.note) && fo.contact_url === 'https://form-only.example/contact' && !!qt, J(pr.map(r => [r.prospect_domain, r.note, r.contact_email, r.contact_url])).slice(0, 700));
    const cands = (plan2.air || {}).candidates || []; const sc = (d) => { const c = cands.find(x => String((x.ref || {}).url || '').includes(d)); return c ? Number(c.factor) : null; };
    check('LIVE1-3 a reachable contact is preferred: the e-mail placement keeps its factor, no contact yet x0.85, a contact form only x0.7',
      sc('mail-list.example') === 1 && sc('quiet.example') === 0.85 && sc('form-only.example') === 0.7, J(['mail-list', 'quiet', 'form-only'].map(d => [d, sc(d + '.example')])));

    // ---------------- LIVE1-4 the labelled prospect-rule set ----------------
    const { OK, LK } = loadOK();
    { const lbp = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), 'LB_Page_Requests.js'), 'utf8'); const m = lbp.match(/const BIG = \/(.+)\/i;/);
      const v = OK.placementVet({ url: 'https://www.linkedin.com/pulse/top-10-ai-automation-companies-dubai', domain: 'www.linkedin.com', outreach: [], prospects: [] });
      check('LIVE1-3 a platform page (a LinkedIn article) is never chosen as a placement: the Link Builder never reads one (its BIG list, identical to OK.PLATFORM), so it could never be drafted',
        !!m && m[1] === OK.PLATFORM.source && /a platform page \(linkedin\.com\)/.test(v.refused), J({ big: m && m[1], kit: OK.PLATFORM.source, v })); } const SET = JSON.parse(fs.readFileSync(path.join(__dirname, 'accuracy', 'prospects.json'), 'utf8')); const C = SET.context;
    const predict = (c) => c.rule === 'gambling' ? OK.sellSignals(c.html, LK.pageFacts(c.html, {}, 'https://page.example/')).includes('gambling / CBD / essay-mill topics')
      : !!OK.sellsSame({ type: c.prospect.type, domain: c.prospect.domain, competitors: C.competitors, serp_rivals: c.prospect.serp_rivals || [], ai_rivals: c.prospect.ai_rivals || C.ai_rivals, topics: C.topics, terms: C.terms, title: c.prospect.title, url: c.prospect.url, text: '' });
    for (const rule of ['gambling', 'competitor']) { const cs = SET.cases.filter(c => c.rule === rule); const r = cs.map(c => ({ id: c.id, label: c.label, got: predict(c) }));
      const tp = r.filter(x => x.label && x.got).length, fp = r.filter(x => !x.label && x.got).length, fn = r.filter(x => x.label && !x.got).length;
      const prec = tp + fp ? tp / (tp + fp) : 1, rec = tp + fn ? tp / (tp + fn) : 1;
      console.log('   LIVE1-4 ' + rule + ': ' + cs.length + ' cases, precision ' + (100 * prec).toFixed(1) + '%, recall ' + (100 * rec).toFixed(1) + '%');
      check('LIVE1-4 accuracy/prospects.json ' + rule + ': precision and recall 100% over ' + cs.length + ' labelled cases (the live false positive included)', prec === 1 && rec === 1, J(r.filter(x => x.label !== x.got))); }
  });
};
