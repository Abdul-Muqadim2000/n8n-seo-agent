// AIR P3 (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md 2.J + 6.4, CONTRACTS.md, fixes/P3.md): the defects of the 2026-10-31 production review
// folded into AI ranking, and the guards the existing AI logic needs before AIR may run `on`. Synthetic data only (public repo).
//   AF1   F-08  the headline counts only the pulse answers to the run's own questions; the rest are named; the first such week is not compared
//   AF2   F-37  AI Growth never sets aside a question its own page answers; a topic refusal is judged again on the written-out search and the question
//   AF3   F-38  "not updated in 90+ days" only for a page with a known date that old; unread / undated pages say so; a page published lately is fresh
//   AF4   F-53  names that are not businesses (headings, labels, steps, dates, prices, regulators, places) are never competitors; real rivals kept
//   AF5   F-81  the "How this is measured" schedule follows the website's own cycle and its pulse setting
//   AF6   F-85  `serp:` cache rows are loaded, blanked and pruned for every site (they carry no site id)
//   AF7   Growth guard: off / shadow / no setting -> the same plan; on -> AIR's target row is left alone; back to off -> it is written again
//   AF8   Earned Media guard: the same three cases for AIR's prospect rows
//   AF9   focus: a question AIR holds in its core set (core_until in the future) is never retired; without it nothing changes
//   AF10  _ai_measure: an action's time is live_at when present
//   AF11  key pages include AIR's target pages only when on
// The Growth Plan's `on` cases run a copy of the generated node with `settings.rank` filled in (package P4 adds the field to _monitor_sites.js;
// until it lands no site can be `on`), written next to the generated code for the run and removed after.
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const CODE = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const ROOT = path.join(__dirname, '..');
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 700), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 500))); };
  const RULE = 'aivis-2026-10-23';
  const SID = 'site_northwind-erp-com', DOM = 'northwind-erp.com', WWW = 'https://www.' + DOM;
  const NOW = new Date().toISOString();
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));

  // ---- the AI visibility pieces (the F1b scenarios' shapes) ----
  const prompt = (i, o) => ({ prompt_id: 'q' + i, prompt: 'Which UAE firms handle e-invoicing question ' + i + '?', kind: 'recommend', topic: 'e invoicing', keyword: 'e invoicing uae ' + i, source: 'auto', stage: 'decision',
    cluster: 'e invoicing', persona: 'CFO', market: 'AE-en', volume: 100, origin: 'writer', created_at: '2026-10-01', ...(o || {}) });
  const row = (o) => ({ site_id: SID, domain: DOM, run_id: 'ai_af', checked_at: NOW, prompt_id: o.pid, prompt: 'q', kind: 'recommend', topic: 'e invoicing', engine: o.engine || 'chatgpt',
    answered: true, mentioned: !!o.named, cited: false, rank: o.named ? 1 : 0, our_urls: '', competitors: (o.rivals || []).join(', '), sources: '', excerpt: '', cost: 0.004, error: '', run_kind: 'weekly',
    sentiment: '', brands: '', issues: '', fanout: '', cited_urls: '[]', named: !!o.named, position: o.named ? 1 : null,
    entities: JSON.stringify([...(o.named ? [{ id: DOM, name: 'Northwind ERP', role: 'self', position: 1, cited: false }] : []), ...(o.rivals || []).map((r, k) => ({ id: r, name: r, role: 'competitor', position: k + 2, cited: false }))]) });
  const pulseRow = (date, units) => { const ents = []; const ix = (id) => { let i = ents.indexOf(id); if (i < 0) { ents.push(id); i = ents.length - 1; } return i; };
    const a = units.map(u => [u.pid, u.engine || 'chatgpt', u.named ? 1 : 0, 0, u.named ? 1 : null, (u.rivals || []).map((r, k) => [ix(r), k + 2, 0])]);
    return { date, checked_at: date + 'T06:31:00.000Z', run_id: 'pulse_' + date, samples: units.length, mentioned: units.filter(u => u.named).length, cited: 0, mention_rate: 0, visibility_score: 0,
      engines: { chatgpt: { answered: units.length } }, prompts: {}, competitors: {}, sources: {}, rule_version: RULE, detail: { v: 1, rule_version: RULE, ents, a } }; };
  const ids = (n) => Array.from({ length: n }, (_, i) => 'q' + i);
  const prevRow = (o) => ({ run_id: 'ai_prev', rule_version: RULE, checked_at: day(7), mention_rate: 25, samples: 40, mentioned_k: 10, prompts: 4, run_kind: 'weekly', citation_rate: 0, share_of_voice: 30, avg_rank: 1,
    visibility_score: 20, sentiment_score: null, engines: { chatgpt: { name: 'chatgpt', asked: 40, answered: 40, samples: 40, mentioned: 10, cited: 0, mention_rate: 25, citation_rate: 0, errors: 0 } }, market_month: '', market: null, index: null,
    perception: null, traffic: null, access: null, competitors: [], panel: { ids: ids(4) },
    stats: { v: 1, rule_version: RULE, ...(o.marker ? { headline_rule: 'f08' } : {}), named: { k: 10, n: 40 }, cited: { k: 0, n: 40 }, sov: { rate: 30, se: 5, n: 40, self: 10, mentions: 33 }, position: { mean: 1, sd: 0, n: 10 }, score: { score: 20, half: 6, n: 40 }, competitors: {} } });
  const plan = (o) => [{ json: { site_id: SID, domain: DOM, canonical_host: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', country_iso: 'AE', email: '', callback_url: '', request_id: '',
    on_demand: false, adhoc: false, business_name: 'Northwind ERP', business_type: '', city: 'Dubai', profile: {}, services: [], business_facts: [], accreditation: '',
    brand_names: [DOM, 'Northwind ERP'], competitors: ['rival.com'], configured_competitors: ['rival.com'], aliases: {}, topics: ['e invoicing'], engines: o.engines || ['chatgpt'], prompts_max: 20, pulse: o.pulse !== false,
    prompts: o.prompts, full_due: false, run_kind: 'weekly', monthly_engines: o.monthly || [], carried: null, need_prompts: false, prompts_needed: 0, need_site_text: false, gsc_questions: [],
    discovery_due: false, volume_keywords: [], index_due: false, market_due: false, market_keyword: 'e invoicing', ga4_property_id: '', pulse_rows: o.pulse_rows || [], key_paths: [], set_aside: [], set_aside_note: '',
    pulse_window: { from: day(7), to: NOW, days: 7 }, previous: o.previous === undefined ? null : o.previous, run_id: 'ai_af', checked_at: NOW, ...(o.cycle ? { cycle: o.cycle } : {}) } }];
  const drive = async (o) => { reset(); mock('AI Plan', plan(o)); mock('Apply Analysis', o.rows.map(r => ({ json: r })));
    mock('AI Requests', [{ json: { site_id: SID, engine: 'chatgpt' } }]); mock('Run AI Requests', [{ json: {} }]);
    if (o.monitors) mock('Load Monitors', o.monitors.map(m => ({ json: m }))); if (o.targets) mock('Load AI Targets (AI)', o.targets.map(t => ({ json: t })));
    return (await run('AI Metrics', store['Apply Analysis']))[0].json; };
  // four questions on the panel, ten weekly answers each; three pulse mornings with one answer per question each, plus six answers to a retired one
  const weekRows = () => { const out = []; for (let j = 0; j < 10; j++) for (let q = 0; q < 4; q++) out.push(row({ pid: 'q' + q, named: j === 0, rivals: ['rival.com'] })); return out; };
  const pulses = (withRetired) => [1, 2, 3].map(d => pulseRow(day(d).slice(0, 10), [...[0, 1, 2, 3].map(q => ({ pid: 'q' + q, named: false, rivals: ['rival.com'] })),
    ...(withRetired ? [{ pid: 'q_old', named: true, rivals: ['oldpanel-rival.com'] }, { pid: 'q_old', named: true, rivals: ['oldpanel-rival.com'] }] : [])]));

  // ===================================================================================================================================
  await guard('air AF1 F-08', async () => {
    reset(); const SN = 'AIR AF1 (F-08) - the headline counts the pulse answers to this run\'s questions only; the others are named; the first week counted so is not compared, once'; begin(SN); const check = mkCheck(SN);
    const P4 = ids(4).map((_, i) => prompt(i));
    const A = await drive({ prompts: P4, rows: weekRows(), pulse_rows: pulses(true) });
    const M = A.metrics, B = M.pulse_basis || {};
    check('12 pulse answers counted (3 mornings x 4 questions), the 6 to the retired question left out', M.pulse_samples === 12 && M.samples === 52, JSON.stringify({ pulse: M.pulse_samples, samples: M.samples }));
    check('"named in" is the run\'s own: 4 of 52 answers (the retired question\'s 6 named answers would have made it 10 of 58)', M.mentioned === 4 && M.named_rate === 7.7, JSON.stringify({ k: M.mentioned, rate: M.named_rate }));
    check('the left-out answers are named: 6 answers to 1 question, its id, in plain words', B.off_panel && B.off_panel.answers === 6 && B.off_panel.questions === 1 && B.off_panel.ids[0] === 'q_old' && /no longer on this week's panel/.test(B.note), JSON.stringify(B.off_panel || B));
    check('the rival of the old panel is not in this week\'s competitor table', !A.competitors.some(c => /oldpanel/.test(c.domain)), JSON.stringify(A.competitors.map(c => c.domain)));
    check('the headline counts the 4 buyer questions of the panel', M.headline.buyer_questions === 4 && M.headline.pulse_answers === 12, JSON.stringify(M.headline));
    const C = await drive({ prompts: P4, rows: weekRows(), pulse_rows: pulses(false) });
    check('control: with no answer off the panel every pulse answer counts and nothing is listed as left out', C.metrics.pulse_samples === 12 && !(C.metrics.pulse_basis || {}).off_panel, JSON.stringify(C.metrics.pulse_basis));
    check('the stored metrics_json says the headline was counted under the new rule; the stored rule_version is unchanged', JSON.parse(A.vis_row.metrics_json).headline_rule === 'f08' && A.vis_row.rule_version === RULE && JSON.parse(A.vis_row.compare_json).rule_version === RULE, A.vis_row.rule_version);
    const R1 = await drive({ prompts: P4, rows: weekRows(), pulse_rows: pulses(true), previous: prevRow({}) });
    check('a week that left answers out is NOT compared with a week counted the old way, and says why', R1.metrics.delta === null && /measurement rule changed/.test(R1.metrics.delta_not_compared || '') && /no longer on the panel/.test(R1.metrics.delta_not_compared || ''), String(R1.metrics.delta_not_compared));
    const R2 = await drive({ prompts: P4, rows: weekRows(), pulse_rows: pulses(true), previous: prevRow({ marker: true }) });
    check('the next week (its earlier row counted under the new rule) is compared again: the refusal happens once', R2.metrics.delta && R2.metrics.delta.mention_rate != null, JSON.stringify(R2.metrics.delta_not_compared || ''));
    const R3 = await drive({ prompts: P4, rows: weekRows(), pulse_rows: pulses(false), previous: prevRow({}) });
    check('where nothing was left out the two rules count the same answers: compared as before', R3.metrics.delta && R3.metrics.delta.mention_rate != null, JSON.stringify(R3.metrics.delta_not_compared || ''));
  });

  // ===================================================================================================================================
  // ---- the AI Growth plan, on a hand-built week ----
  const M = require('./fixtures_monitors');
  const SVC = ['Microsoft 365 migration and tenant consolidation', 'Microsoft 365 security and compliance consulting', 'Dynamics 365 Business Central implementation', 'Power BI dashboards and reporting',
    'SharePoint intranet development', 'Azure cloud infrastructure management', 'Copilot Studio agents for operations teams', 'Managed IT support for mid-sized companies'];
  const gpVis = (gaps, cited) => ({ site_id: M.SITE, domain: M.DOMAIN, run_id: 'ai_af', checked_at: day(1), gaps_json: JSON.stringify(gaps), pages_json: JSON.stringify(cited || []), competitors_json: JSON.stringify([{ domain: 'cleartax.com', mentions: 3, auto: true }]) });
  const gap = (pid, prompt, topic, o) => ({ prompt_id: pid, prompt, kind: 'recommend', topic, competitors: ['cleartax.com'], sources: [], volume: 100, stage: 'decision', cluster: topic, fanout: [], cited_urls: [], engines: { chatgpt: 'absent' }, ...(o || {}) });
  const loadGrowth = (o) => {
    mock('Load Sites', M.sites({ declared_services: JSON.stringify(o.services || SVC), canonical_host: 'www.' + M.DOMAIN }));
    mock('Load Ladders', M.ladders()); mock('Load Monitors', M.monitors({ ai_growth: true })); mock('Load Profiles', M.profiles()); mock('Load Cycles', [{ json: {} }]);
    mock('Load AI Visibility', [{ json: gpVis(o.gaps, o.cited) }]); mock('Load AI Prompts', (o.prompts || []).map(p => ({ json: { site_id: M.SITE, status: 'active', ...p } })));
    mock('Load Content Log', items(o.log || [])); mock('Load Query History', items(o.qh || [])); mock('Load AI Pages', items(o.pages || []));
    mock('Load AI Targets', items(o.targets || [])); mock('Load AI Growth', [{ json: {} }]); mock('Load AI Answers', items(o.answers || [])); mock('Load Cache (Growth)', [{ json: {} }]);
    mock('Load Link Prospects (Growth)', items(o.prospects || [])); };
  // the `on` copy of the generated Growth Plan (settings.rank set per site, as _monitor_sites.js will once P4 lands)
  const withRank = async (node, file, ranks, input) => { const src = fs.readFileSync(path.join(CODE, file + '.js'), 'utf8');
    const anchor = "const airOn = !!(s.settings && s.settings.rank && s.settings.rank.mode === 'on');"; if (src.indexOf(anchor) < 0) throw new Error('the AIR guard anchor is not in ' + file);
    const name = 'AIRFIX__' + file + '_' + Math.random().toString(36).slice(2, 8); const out = path.join(CODE, name + '.js');
    fs.writeFileSync(out, 'const __AIRFIX_RANK = ' + JSON.stringify(ranks) + ';\n' + src.replace(anchor, 'if (s.settings && !s.settings.rank && __AIRFIX_RANK[s.site_id]) s.settings.rank = __AIRFIX_RANK[s.site_id]; ' + anchor));
    try { return await run(node, input, { code: name }); } finally { try { fs.unlinkSync(out); } catch (e) {} } };
  const growth = async (o, ranks) => { loadGrowth(o); const out = ranks ? await withRank('Growth Plan', 'Growth_Plan', ranks, store['Load Cache (Growth)']) : await run('Growth Plan', store['Load Cache (Growth)']); return out[0].json; };
  const kitFrom = (file, name) => { const src = fs.readFileSync(path.join(CODE, file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' is not inlined in ' + file); return new Function(src.slice(a, b + 6) + '\nreturn ' + name + ';')(); };

  await guard('air AF2 F-37', async () => {
    reset(); const SN = 'AIR AF2 (F-37) - AI Growth never sets aside a question its own page answers, and a topic refusal is judged again on the written-out search and the full question'; begin(SN); const check = mkCheck(SN);
    // F-37 precondition: the generated fit gate (unchanged, owner decision D13) refuses the abbreviation alone and accepts it written out
    const G0 = (() => { const src = fs.readFileSync(path.join(CODE, 'Growth_Plan.js'), 'utf8'); return src; })();
    check('the shared fit gate is not changed by this package (no "ms 365" synonym in _fit_gate.js)', !/ms\[\\s-\]\?365|microsoft 365'\]/.test(fs.readFileSync(path.join(ROOT, 'v5', 'code', '_fit_gate.js'), 'utf8')) && /GROWTH_SYN/.test(G0));
    const prompts = [{ prompt_id: 'g1', prompt: 'Is MS 365 an ERP, or do I need a separate ERP system for my Dubai company?', kind: 'recommend', keyword: 'is ms 365 an erp' },
      { prompt_id: 'g2', prompt: 'Which yacht charter in Dubai is best for a team outing?', kind: 'recommend', keyword: 'yacht charter dubai' },
      { prompt_id: 'g3', prompt: 'Best yacht charter in Dubai for corporate events?', kind: 'recommend', keyword: 'yacht charter corporate dubai' }];
    const gaps = [gap('g1', prompts[0].prompt, 'ms 365 erp'), gap('g2', prompts[1].prompt, 'yacht charter'), gap('g3', prompts[2].prompt, 'yacht charter')];
    const page = WWW + '/team-events/';   // the client's page AI cited for g2 (an off-topic question the client nevertheless answers)
    const answers = [{ site_id: M.SITE, domain: M.DOMAIN, run_id: 'ai_af', checked_at: day(1), prompt_id: 'g2', prompt: prompts[1].prompt, kind: 'recommend', engine: 'chatgpt', answered: true, mentioned: false, cited: true, our_urls: 'www.' + M.DOMAIN + '/team-events/', cited_urls: '[]' }];
    const G = await growth({ gaps, prompts, answers, cited: [{ url: page, citations: 2, engines: ['chatgpt'] }] });
    const t = (pid) => G.targets.find(x => x.prompt_id === pid) || {};
    console.log('   targets ->', JSON.stringify(G.targets.map(x => [x.prompt_id, x.status, x.keyword, String(x.reason).slice(0, 140)])));
    check('"is ms 365 an erp" (too broad on its own words) is judged on the full question, abbreviation written out, and queued', t('g1').status === 'queued' && /judged on the full question \("microsoft 365 erp/.test(t('g1').reason), JSON.stringify(t('g1')));
    check('an off-topic question whose page AI cites is kept, with the gate\'s finding and the page in its reason', t('g2').status !== 'set_aside' && t('g2').page_url === page && /AI already cites your page/.test(t('g2').reason), JSON.stringify(t('g2')));
    check('the same off-topic question with no page of the client\'s is still set aside', t('g3').status === 'set_aside', JSON.stringify(t('g3')));
    check('the kept one is listed as flagged-but-kept, not counted among the set-aside questions', G.targets_set_aside.some(x => x.target_id === t('g2').target_id && x.kept === true) && !/yacht charter dubai"/.test(G.set_aside_note) && /yacht charter corporate dubai/.test(G.set_aside_note), G.set_aside_note);
  });

  await guard('air AF3 F-38', async () => {
    reset(); const SN = 'AIR AF3 (F-38) - "not updated in 90+ days" only for a page whose date is known and that old; an unread or undated page says so; a page published lately is fresh'; begin(SN); const check = mkCheck(SN);
    const qs = ['h1', 'h2', 'h3', 'h4'].map((id, k) => ({ prompt_id: id, prompt: 'Who implements Business Central question ' + k + '?', kind: 'recommend', keyword: 'business central implementation ' + ['dubai', 'abu dhabi', 'sharjah', 'uae'][k] }));
    const url = (k) => WWW + '/bc-' + k + '/';
    const answers = qs.map((q, k) => ({ site_id: M.SITE, domain: M.DOMAIN, run_id: 'ai_af', checked_at: day(1), prompt_id: q.prompt_id, prompt: q.prompt, kind: 'recommend', engine: 'chatgpt', answered: true, mentioned: false, cited: true, our_urls: 'www.' + M.DOMAIN + '/bc-' + k + '/', cited_urls: '[]' }));
    const pages = [{ site_id: M.SITE, domain: M.DOMAIN, url: url(1), kind: 'cited', checked_at: day(5), score: 50, updated_on: '' },                           // read, no date on the page
      { site_id: M.SITE, domain: M.DOMAIN, url: url(2), kind: 'cited', checked_at: day(5), score: 50, updated_on: day(200).slice(0, 10) },                      // read, 200 days old
      { site_id: M.SITE, domain: M.DOMAIN, url: url(3), kind: 'cited', checked_at: day(5), score: 50, updated_on: day(200).slice(0, 10) }];                     // 200 days on the page, published again 10 days ago
    const log = [{ site_id: M.SITE, domain: M.DOMAIN, keyword: 'bc 3', source: 'ladder', status: 'published', published_url: url(3), published_at: day(10), started_at: day(14) },
      { site_id: M.SITE, domain: M.DOMAIN, keyword: 'bc 0', source: 'ladder', status: 'published', published_url: url(0), published_at: day(10), started_at: day(14) }];   // url(0): published 10 days ago, never read
    const G = await growth({ gaps: qs.map(q => gap(q.prompt_id, q.prompt, 'business central')), prompts: qs, answers, pages, log, cited: qs.map((_, k) => ({ url: url(k), citations: 1, engines: ['chatgpt'] })) });
    const t = (k) => G.targets.find(x => x.prompt_id === 'h' + (k + 1)) || {};
    console.log('   targets ->', JSON.stringify(G.targets.map(x => [x.prompt_id, x.status, String(x.reason).slice(0, 160)])));
    check('a page published 10 days ago and not read yet: no refresh before its readiness check, no "90+ days"', t(0).status === 'skipped' && /published on/.test(t(0).reason) && !/90\+/.test(t(0).reason), JSON.stringify(t(0)));
    check('a page read with no visible date: "no visible update date", never "90+ days"', /no visible update date/.test(t(1).reason) && !/90\+/.test(t(1).reason) && t(1).status === 'queued', JSON.stringify(t(1)));
    check('a page whose date is 200 days old: "not updated in 90+ days" with that date', /not updated in 90\+ days \(last date /.test(t(2).reason) && t(2).status === 'queued', JSON.stringify(t(2)));
    check('the content log\'s publish date counts: the same page published again 10 days ago is not "90+ days"', !/90\+/.test(t(3).reason), JSON.stringify(t(3)));
    // the Content Cadence: a page the agent published in the last 60 days is left to settle like a page it refreshed
    const cad = fs.readFileSync(path.join(CODE, 'Cadence_Plan.js'), 'utf8');
    check('the Content Cadence counts a page published in the last 60 days as recently touched (no AI refresh of it)', /F-38 \(AIR P3/.test(cad) && /l\.published_url && l\.published_at && \(at - new Date\(l\.published_at\)\) < 60 \* 864e5\) refreshedRecently\.add/.test(cad));
  });

  // ===================================================================================================================================
  await guard('air AF4 F-53', async () => {
    reset(); const SN = 'AIR AF4 (F-53) - headings, table labels, plan steps, dates, prices, regulators and places are never competitors; real rivals are kept; the purge reads the same rule'; begin(SN); const check = mkCheck(SN);
    const AIE = kitFrom('Parse_AI_Answers.js', 'AIE');
    const J = JSON.parse(fs.readFileSync(path.join(__dirname, 'accuracy', 'ai_entities_junk.json'), 'utf8'));
    const bad = J.cases.filter(([n, want]) => AIE.junkName(n) !== want);
    check('the shared case file: ' + J.cases.length + ' names, junk or a business, every one as labelled (the purge script runs the same file)', !bad.length && J.cases.length >= 70, JSON.stringify(bad));
    // a labelled set of synthetic answers: every shape the production review found, and the rival lists they sit beside
    const site = { site_id: 'site_lumen-example', domain: 'lumen-erp.example', business_name: 'Lumen ERP', brand_names: ['lumen-erp.example', 'Lumen ERP'], competitors: ['rivalco.example'], configured_competitors: ['rivalco.example'], aliases: {},
      services: ['Open edX platform development', 'Dynamics 365 Business Central implementation'], topics: ['open edx development dubai', 'business central partner uae'] };
    const CASES = [
      { t: '| Factor | Cloud ERP | On-premise ERP |\n|---|---|---|\n| Initial Cost | Lower | Higher |\n| Deployment Speed | 3-6 months | 6-18 months |\n| Maintenance | Vendor | Your team |', want: [] },
      { t: '| Partner Name | Strengths |\n|---|---|\n| **Quillbyte** | Business Central partner in Dubai |\n| **Nexaro Systems** | Finance and supply chain |', want: ['Quillbyte', 'Nexaro Systems'] },
      { t: '### Phase 2: Red Flags\n* **Customization:** tailoring features to your workflow.\n* **Scalability:** how far the system grows.\n* **Partner Name:** the firm you hire.', want: [] },
      { t: 'Key dates: **30 Oct** for the ASP choice and **31 Mar 2026** for go-live. Budget **AED 20k-100k**. Ask: **Yes**.', want: [] },
      { t: 'You must register with the **FTA** and follow **TDRA** rules; offices in **Business Bay** or **Dubai Silicon Oasis** both work.', want: [] },
      { t: 'A few options in the Dubai market:\n- **Lumora** - ERP rollouts for traders.\n- **Kestrel Labs** - data and AI integration.\n- **Calder Software DMCC** - a pre-approved e-invoicing provider.', want: ['Lumora', 'Kestrel Labs', 'Calder Software DMCC'] },
      { t: 'Things to look for when choosing a partner:\n- **Industry Experience** - years in your sector.\n- **Support Model** - who answers at 2 a.m.\n- **Data Residency** - where your data lives.', want: [] },
      { t: '**1. eduVERTA** - They have migrated forty universities to Open edX.\n**2. Folia7** - They manage upgrades and hosting.\n**3. Orvane** - They\'ve built custom plugins for academies.', want: ['eduVERTA', 'Folia7', 'Orvane'] },
      { t: '* **Ravelin Partners (by Sable Group):** One of the leading Open edX service providers. [openedx.org](https://openedx.org/partners/ravelin/)', want: ['Ravelin Partners'] },
      { t: 'Open edX itself is free; **Managed Open edX** hosting and **Open edX Services** cost extra. Moodle is the other common platform.', want: [] },
      { t: 'Most firms pick **SAP S/4HANA Cloud** or **Business Central Premium**, often with **Copilot AI**.', want: ['sap.com'] },   // SAP is a business (a rival product); Business Central and Copilot are the client's own platform
      { t: 'Shortlist of partners:\n- **Zentro Technologies** - ERP rollouts across the GCC.\n- **RivalCo** - finance systems (rivalco.example).', want: ['Zentro Technologies', 'rivalco.example'] },
      { t: 'Directories to check: [clutch.co](https://clutch.co/ae/it-services) and [topdevelopers.co](https://www.topdevelopers.co/directory/erp).', want: [] },
      { t: '## Next Steps\n1. **Evaluate Industry-Specific Track Records**\n2. **Verify UAE Regulatory Expertise**\n3. **Check Official Community Standing**', want: [] }];
    let tp = 0, fp = 0, fn = 0; const misses = [];
    for (const [i, c] of CASES.entries()) {
      const D = AIE.dir({ ...site, run_id: 'af4_' + i }, {});
      const got = AIE.read({ text: c.t, cites: [], entities: [] }, D).entities.filter(e => e.role === 'competitor').map(e => String(e.id));
      const want = c.want.map(w => w.toLowerCase()); const g = got.map(x => x.toLowerCase());
      for (const x of g) { if (want.includes(x)) tp++; else { fp++; misses.push(i + ' fp ' + x); } } for (const w of want) if (!g.includes(w)) { fn++; misses.push(i + ' fn ' + w); }
    }
    const precision = tp + fp ? Math.round(1000 * tp / (tp + fp)) / 10 : 100, recall = tp + fn ? Math.round(1000 * tp / (tp + fn)) / 10 : 100;
    console.log('   F-53 set: ' + CASES.length + ' answers, tp ' + tp + ' fp ' + fp + ' fn ' + fn + ' -> precision ' + precision + '%, recall ' + recall + '%' + (misses.length ? ' | ' + misses.join('; ') : ''));
    check('precision at least 95% over the synthetic set (headings, table labels, steps, dates, prices, regulators, places, directories, platforms)', precision >= 95, misses.join('; '));
    check('every real rival is kept (recall 100% on the set)', fn === 0, misses.join('; '));
    // the item's own directory link is where it is listed, never its website (openedx.org read as the top rival)
    const D9 = AIE.dir({ ...site, run_id: 'af4_od' }, {});
    const e9 = AIE.read({ text: CASES[8].t, cites: [], entities: [] }, D9).entities;
    check('a partner directory link on the item does not make openedx.org the rival: the item is the rival, openedx.org is a platform or a source', !e9.some(e => e.id === 'openedx.org' && e.role === 'competitor') && e9.some(e => /ravelin/i.test(e.id) && e.role === 'competitor'), JSON.stringify(e9.map(e => [e.id, e.role])));
    // a stored or learned junk name is never looked for (a cache row taught "Scalability" -> a vendor's domain)
    const D10 = AIE.dir({ ...site, run_id: 'af4_book', aliases: { Scalability: 'vendor-x.example', Quillbyte: 'quillbyte.example' } }, {});
    const e10 = AIE.read({ text: 'Scalability matters, and Quillbyte scales well.', cites: [], entities: [] }, D10).entities;
    check('a learned name that is a heading is not scanned (Scalability), a learned business name still is (Quillbyte)', !e10.some(e => e.id === 'vendor-x.example') && e10.some(e => e.id === 'quillbyte.example' && e.role === 'competitor'), JSON.stringify(e10.map(e => [e.id, e.role])));
    // the purge script: dry run by default, reads the word lists from the kit (one list, two readers), the same case file
    const py = fs.readFileSync(path.join(ROOT, 'fix_ai_entities_cache.py'), 'utf8');
    check('fix_ai_entities_cache.py: dry run unless --apply, reads GEN / HEADING_WORDS / DENY from _ai_entities.js, self-tests on the same case file, touches only ai_brands: / ai_entities: rows',
      /apply = '--apply' in sys\.argv/.test(py) && /_ai_entities\.js/.test(py) && /const HEADING_WORDS = \(/.test(py) && /ai_entities_junk\.json/.test(py) && /startswith\('ai_brands:'\) or key\.startswith\('ai_entities:'\)/.test(py) && /'value': new/.test(py));
    const kit = fs.readFileSync(path.join(ROOT, 'v5', 'code', '_ai_entities.js'), 'utf8');
    check('the kit still declares the word lists the purge parses (GEN, HEADING_WORDS, STOPW, DENY)', /const GEN = new Set\(\(/.test(kit) && /const HEADING_WORDS = \(/.test(kit) && /const STOPW = new Set\(\[/.test(kit) && /const DENY = \/\^\(/.test(kit));
  });

  // ===================================================================================================================================
  await guard('air AF5 F-81', async () => {
    reset(); const SN = 'AIR AF5 (F-81) - "How this is measured" describes the website\'s own cycle day, its engines and its pulse, not the old Monday schedule'; begin(SN); const check = mkCheck(SN);
    const P4 = ids(4).map((_, i) => prompt(i));
    const html = async (o) => { await drive({ prompts: P4, rows: weekRows(), engines: ['chatgpt', 'perplexity', 'claude'], monthly: ['claude'], ...o }); return (await run('AI Report', store['AI Metrics']))[0].json.html; };
    const how = (h) => { const i = h.indexOf('How this is measured'); return h.slice(i, i + 1600); };
    const a = how(await html({ cycle: { key: 'cyc:' + SID + ':2026-11-04', date: '2026-11-04', job: 'ai_visibility', monthly: false, tz: 'Asia/Dubai', label: 'Week of Wed 4 Nov' }, monitors: [{ site_id: SID, domain: DOM, ai_pulse_engines: 'chatgpt' }] }));
    check('a Wednesday cycle: "every Wednesday (this website\'s weekly cycle day, Asia/Dubai time)", with the weekly engines and Claude monthly', /every Wednesday \(this website(&#39;|')s weekly cycle day, Asia\/Dubai time\)/.test(a) && /on chatgpt and perplexity|on ChatGPT and Perplexity/i.test(a) && /also asks (claude|Claude)/.test(a), a.slice(0, 700));
    check('the old schedule is gone ("Tuesday to Sunday", "every Monday")', !/Tuesday to Sunday/.test(a) && !/every Monday/.test(a), a.slice(0, 500));
    check('the pulse engines are the website\'s own setting (ChatGPT only here)', /daily AI Pulse asks every tracked question on chatgpt\.|daily AI Pulse asks every tracked question on ChatGPT\./i.test(a), a.slice(0, 700));
    const b = how(await html({ pulse: false }));
    check('pulse off, no cycle date: "once a week, on this website\'s own weekly cycle day" and "the daily AI Pulse is off"', /once a week, on this website(&#39;|')s own weekly cycle day/.test(b) && /AI Pulse is off for this website/.test(b), b.slice(0, 700));
  });

  // ===================================================================================================================================
  await guard('air AF6 F-85', async () => {
    reset(); const SN = 'AIR AF6 (F-85) - the AI visibility run loads, blanks and prunes the serp: cache rows of every site (they are stored with no site id)'; begin(SN); const check = mkCheck(SN);
    const WR = JSON.parse(fs.readFileSync(path.join(__dirname, 'w2e3_wiring.json'), 'utf8'))['SEO_Agent_AI_Visibility.json'];
    const conds = (n) => ((WR.dt[n] && WR.dt[n].filters && WR.dt[n].filters.conditions) || []).map(c => c.keyName);
    for (const n of ['Load SERP Cache (AI)', 'Blank Old SERP Cache (AI)', 'Prune Old SERP Cache (AI)'])
      check(n + ': kind serp and the date, no site id condition', conds(n).includes('kind') && conds(n).includes('updated_at') && !conds(n).includes('site_id'), JSON.stringify(conds(n)));
    const SC = kitFrom('AI_Extras.js', 'SC');
    const row = SC.row({ keyword: 'erp dubai', location_code: 2784, language_code: 'en', device: 'desktop', items: [] }, '');
    check('a serp: row a path stores with an empty site id is the kind those nodes match (serp) with site_id ""', !row || (row.kind === 'serp' && row.site_id === ''), JSON.stringify(row));
  });

  // ===================================================================================================================================
  await guard('air AF7 AF11 Growth guard', async () => {
    reset(); const SN = 'AIR AF7 + AF11 - AI Growth with AI ranking off / shadow / on: AIR\'s target row is left alone and its page is a key page only when on; off again writes it as an AI Growth row'; begin(SN); const check = mkCheck(SN);
    const qs = [{ prompt_id: 'r1', prompt: 'Who implements Business Central in Dubai?', kind: 'recommend', keyword: 'business central implementation dubai' }, { prompt_id: 'r2', prompt: 'Best Business Central partner in Abu Dhabi?', kind: 'recommend', keyword: 'business central partner abu dhabi' }];
    const tid = 'ait_' + M.SITE.replace(/^site_/, '') + '_r2';
    const airRow = { target_id: tid, site_id: M.SITE, domain: M.DOMAIN, prompt_id: 'r2', question: qs[1].prompt, keyword: qs[1].keyword, kind: 'answer', page_url: WWW + '/bc-abu-dhabi/', page_type: 'Guide', status: 'writing', reason: 'AI ranking', created_at: day(3), updated_at: day(3), written_at: day(2), origin: 'ai_rank', action_id: 'air_x_L05_00000000', live_at: '' };
    const o = { gaps: qs.map(q => gap(q.prompt_id, q.prompt, 'business central')), prompts: qs, targets: [airRow] };
    const none = await growth(o), off = await growth(o, { [M.SITE]: { mode: 'off' } }), shadow = await growth(o, { [M.SITE]: { mode: 'shadow' } }), on = await growth(o, { [M.SITE]: { mode: 'on' } });
    const diffAt = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(Math.max(0, i - 80), i + 80) + ' || ' + b.slice(Math.max(0, i - 80), i + 80); };
    const strip = (g) => JSON.stringify({ ...g, checked_at: '', run_id: '', indexnow_key: '', vis_checked_at: '', targets: g.targets.map(t => ({ ...t, updated_at: '', created_at: t.created_at === g.checked_at ? '' : t.created_at })) });
    check('off, shadow and no setting give the same plan (the guards are no-ops until a site is on)', strip(none) === strip(off) && strip(none) === strip(shadow) && !('air_on' in none), diffAt(strip(none), strip(off)) + ' ## ' + diffAt(strip(none), strip(shadow)));
    check('off: AIR\'s row is processed as an AI Growth row (it is in the plan, so the row writer re-writes it with origin null: the rollback)', none.targets.some(t => t.target_id === tid), JSON.stringify(none.targets.map(t => t.target_id)));
    check('on: AIR\'s row is not in the plan at all (AIR writes it), AI Growth\'s own target is', !on.targets.some(t => t.target_id === tid) && on.targets.some(t => t.prompt_id === 'r1') && on.air_on === true, JSON.stringify(on.targets.map(t => t.target_id)));
    check('AF11 on: AIR\'s target page is a key page ("AI ranking target"); off: it is not', on.key_pages.some(k => k.url === WWW + '/bc-abu-dhabi/' && /AI ranking target/.test(k.why)) && !none.key_pages.some(k => /AI ranking target/.test(k.why)), JSON.stringify(on.key_pages.map(k => k.url + ' ' + k.why)));
    // the row writer (AI Target Rows) writes the AIR columns null for every row of the plan (CONTRACTS D11): a row back from `on` is reclaimed
    mock('Growth Plan', [{ json: none }]); mock('Growth Metrics', [{ json: { site_id: M.SITE, target_rows: none.targets } }]); const tr = (await run('AI Target Rows', [{ json: none }])).map(r => r.json).filter(r => r.target_id === tid);
    check('back to off: the row is written again by AI Growth with origin, action_id and live_at null', tr.length === 1 && tr[0].origin === null && tr[0].action_id === null && tr[0].live_at === null, JSON.stringify(tr));
  });

  await guard('air AF8 Earned Media guard', async () => {
    reset(); const SN = 'AIR AF8 - Earned Media with AI ranking on leaves AIR\'s prospect rows alone; off / shadow re-writes them as AI Growth rows'; begin(SN); const check = mkCheck(SN);
    const em = (host, url, title) => ({ url, title, host, citations: 3, engines: ['chatgpt'], questions: ['Who implements Business Central in Dubai?'], kind: 'list' });
    const base = { site_id: M.SITE, domain: M.DOMAIN, business_name: 'Northwind ERP', brand_names: [M.DOMAIN, 'Northwind ERP'], competitors: ['cleartax.com'], rival_sources: [], services: ['Business Central'], topics: ['business central'],
      profile: {}, link_builder: false, accreditation: '', checked_at: NOW, corrections: [], earned: [em('lists-a.example', 'https://lists-a.example/best-bc-partners', 'Best Business Central partners in Dubai'), em('lists-b.example', 'https://lists-b.example/top-erp-firms', 'Top ERP firms in the UAE')] };
    const prospects = [{ site_id: M.SITE, domain: M.DOMAIN, prospect_domain: 'lists-b.example', type: 'ai_source', origin: 'ai_rank', status: 'new', first_seen: day(3), note: 'AI ranking: placement' }];
    const runEM = async (p) => { reset(); mock('Growth Plan', [{ json: p }]); mock('Earned Requests', [{ json: { skip: true } }]); mock('Fetch Cited Pages', [{ json: {} }]); mock('Load Link Prospects (Growth)', prospects.map(x => ({ json: x }))); mock('Load Cache (Growth)', [{ json: {} }]);
      return (await run('Earned Media', [{ json: p }]))[0].json; };
    const off = await runEM(base), on = await runEM({ ...base, air_on: true });
    check('off: both hosts become AI Growth prospect rows (AIR\'s row is re-written with origin ai_growth: the rollback)', off.prospect_rows.map(r => r.prospect_domain).sort().join() === 'lists-a.example,lists-b.example' && off.prospect_rows.every(r => r.origin === 'ai_growth'), JSON.stringify(off.prospect_rows.map(r => [r.prospect_domain, r.origin])));
    check('on: AIR\'s host is left alone (no row, no draft job), the other host is written as before', on.prospect_rows.map(r => r.prospect_domain).join() === 'lists-a.example' && !on.outreach_jobs.some(j => j.prospect_domain === 'lists-b.example'), JSON.stringify(on.prospect_rows.map(r => r.prospect_domain)));
    check('on vs off: the other host\'s row is identical', JSON.stringify(on.prospect_rows[0]) === JSON.stringify(off.prospect_rows.find(r => r.prospect_domain === 'lists-a.example')));
  });

  // ===================================================================================================================================
  await guard('air AF9 focus core_until', async () => {
    reset(); const SN = 'AIR AF9 - a question AIR holds in its core set (core_until in the future) is never retired by the focus rules; without core_until nothing changes'; begin(SN); const check = mkCheck(SN);
    const AIF = new Function(fs.readFileSync(path.join(ROOT, 'v5', 'code', '_ai_focus.js'), 'utf8') + '\nreturn AIF;')();
    const now = '2026-11-02T10:00:00.000Z';
    const q = (id, o) => ({ prompt_id: id, prompt: 'Question ' + id + ' about payroll outsourcing?', kind: 'recommend', status: 'active', source: 'auto', origin: 'writer', market: 'AE-en', created_at: '2026-08-01', focus_topic: 'payroll outsourcing', focus_source: 'service', focus_state: 'out', focus_seen_at: '2026-09-01T00:00:00.000Z', ...(o || {}) });
    const focus = { topics: [{ id: 't1', label: 'e invoicing', state: 'active', source: 'ladder', refs: ['lad_1'], terms: ['e invoicing'], weight: 1, why: 'your ladder', started_at: '2026-09-01' }] };
    const base = { focus, N: 10, now, full: true, weeks: 8, own_market: 'AE-en', markets: [], ladder_ids: ['lad_1'] };
    const plain = AIF.reconcile({ ...base, stored: [q('a1'), q('a2')] });
    const held = AIF.reconcile({ ...base, stored: [q('a1', { core_until: '2026-12-28' }), q('a2', { core_until: '2026-10-01' })] });
    check('without core_until both off-focus questions retire on the full run (as before)', plain.retire.map(r => r.prompt_id).sort().join() === 'a1,a2', JSON.stringify(plain.retire));
    check('core_until in the future keeps a1; an expired core_until (a2) retires as before', held.retire.map(r => r.prompt_id).join() === 'a2' && held.keep.includes('a1'), JSON.stringify(held.retire));
    const emptyCU = AIF.reconcile({ ...base, stored: [q('a1', { core_until: '' }), q('a2', { core_until: null })] });
    check('an empty core_until (every row today) is the same as none', JSON.stringify(emptyCU) === JSON.stringify(plain));
    const appFile = path.join(ROOT, '..', '..', 'app', 'shared', 'src', 'ai-focus.generated.js');
    if (fs.existsSync(appFile)) { const app = fs.readFileSync(appFile, 'utf8');
      check('the app mirror carries the same rule (regenerated by the build; the app parity test compares it byte for byte)', /core_until/.test(app) && app.includes('const held = (p) => { const c = t(p && p.core_until); return c > 0 && c > t(now); };')); }
    else console.log('   (the app is not beside this harness copy: app/shared/src/ai-focus.parity.test.ts holds the mirror to the kit)');
  });

  await guard('air AF10 measure live_at', async () => {
    reset(); const SN = 'AIR AF10 - "did it work" dates an AIR target from live_at, and an AI Growth target as before'; begin(SN); const check = mkCheck(SN);
    const src = fs.readFileSync(path.join(CODE, 'AI_Metrics.js'), 'utf8');
    check('the inlined measure kit reads live_at first, then written_at, then won_at', /const at = t\.live_at \|\| t\.written_at \|\| \(String\(t\.status\) === 'won' \? t\.won_at : ''\);/.test(src));
    const P4 = ids(4).map((_, i) => prompt(i));
    const W20 = day(20), L10 = day(10);
    const T = (o) => ({ target_id: 'ait_x_q1', site_id: SID, domain: DOM, prompt_id: 'q1', question: 'q', keyword: 'k', kind: 'answer', status: 'written', written_at: W20, won_at: '', ...(o || {}) });
    const actAt = (X) => { const im = JSON.parse(X.vis_row.impact_json || '[]'); const a = (Array.isArray(im) ? im : (im.actions || im.rows || [])).find(x => /ait_x_q1/.test(JSON.stringify(x))); return a ? String(a.at || a.t0 || '') : ''; };
    const X0 = await drive({ prompts: P4, rows: weekRows(), targets: [T({})] }), X1 = await drive({ prompts: P4, rows: weekRows(), targets: [T({ live_at: L10 })] }), X2 = await drive({ prompts: P4, rows: weekRows(), targets: [T({ live_at: null })] });
    console.log('   impact dates ->', JSON.stringify([actAt(X0), actAt(X1), actAt(X2)]), String(X0.vis_row.impact_json || '').slice(0, 300));
    check('no live_at (or null): the action is dated written_at, as before', actAt(X0) === W20 && actAt(X2) === W20, actAt(X0) + ' / ' + actAt(X2));
    check('live_at present: the action is dated live_at', actAt(X1) === L10, actAt(X1));
  });
};
