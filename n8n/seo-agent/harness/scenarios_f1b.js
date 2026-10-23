// F1b (2026-10-23, docs/ai-visibility-2026-10-23/fixes/F1b.md): the numbers of AI search visibility. One reading of every answer (named /
// cited / place / competitors named), one definition of every figure for the headline, every engine, every segment and every competitor,
// the comparison every reader shares (compare_json) refused across a changed panel, engine set or measurement rule, a pulse morning in
// exactly one weekly window, and the daily row saying what the morning was. ENGINE_AUDIT.md E6 E7 E13 E14 E19 E21 + the position metric.
// Called from scenarios_v5.js. Every assertion here failed on 99fdd055 (the fields or the behaviour did not exist).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
module.exports = async (ctx) => {
  const { H, run, mock, store, guard, reset, begin } = ctx;
  const RULE = 'aivis-2026-10-23';
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 600), items: [] }); console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 450))); };
  const SID = 'site_northwind-erp-com', DOM = 'northwind-erp.com';
  const NOW = new Date().toISOString();
  const day = (n) => new Date(Date.now() - n * 864e5).toISOString();
  const prompt = (i, o) => ({ prompt_id: 'q' + i, prompt: 'Which UAE firms handle e-invoicing question ' + i + '?', kind: 'recommend', topic: 'e invoicing', keyword: 'e invoicing uae ' + i, source: 'auto', stage: i % 2 ? 'decision' : 'consideration',
    cluster: i % 2 ? 'e invoicing' : 'erp', persona: i % 3 ? 'CFO' : 'IT manager', market: 'AE-en', volume: 100 + i * 50, origin: 'writer', created_at: '2026-10-01', ...(o || {}) });
  // an answer row as Apply Analysis passes it; `named` / `position` / `entities` are F1a's fields (2026-10-23), left out for an older row
  const row = (o) => ({ site_id: SID, domain: DOM, run_id: 'ai_f1b', checked_at: NOW, prompt_id: o.pid, prompt: 'Which UAE firms handle e-invoicing question ' + String(o.pid).slice(1) + '?', kind: 'recommend', topic: 'e invoicing', engine: o.engine || 'chatgpt',
    answered: o.answered !== false, mentioned: !!(o.named || o.cited), cited: !!o.cited, rank: o.named ? (o.position || 1) : 0, our_urls: o.cited ? 'https://' + DOM + '/e-invoicing/' : '',
    competitors: (o.rivals || []).join(', '), sources: (o.sources || []).join(', '), excerpt: '', cost: 0.004, error: '', run_kind: 'weekly', sentiment: '', brands: '', issues: '', fanout: '', cited_urls: '[]',
    ...(o.newShape === false ? {} : { named: !!o.named, position: o.named ? (o.position || 1) : null,
      entities: JSON.stringify([...(o.named ? [{ id: DOM, name: 'Northwind ERP', role: 'self', position: o.position || 1, cited: !!o.cited }] : []),
        ...(o.rivals || []).map((r, k) => ({ id: r, name: r, role: 'competitor', position: (o.rivalPos || [])[k] || (k + 1 + (o.named && (o.position || 1) <= k + 1 ? 1 : 0)), cited: false })),
        ...(o.publishers || []).map(r => ({ id: r, name: r, role: 'source', position: null, cited: true }))]) }) });
  const engObj = (asked, list) => Object.fromEntries((list || ['chatgpt']).map(e => [e, { name: e, asked, answered: asked, samples: asked, mentioned: 0, cited: 0, mention_rate: 0, citation_rate: 0, errors: 0 }]));
  // a pulse reading as AI Plan hands it to AI Metrics (the per-answer record of Pulse Metrics in `detail`)
  const pulseRow = (date, units, o) => { const ents = []; const ix = (id) => { let i = ents.indexOf(id); if (i < 0) { ents.push(id); i = ents.length - 1; } return i; };
    const a = units.map(u => [u.pid, u.engine || 'chatgpt', u.named ? 1 : 0, u.cited ? 1 : 0, u.named ? (u.position || 1) : null, (u.rivals || []).map((r, k) => [ix(r), k + 2, 0])]);
    return { date, checked_at: date + 'T06:31:00.000Z', run_id: 'pulse_' + date, samples: units.length, mentioned: units.filter(u => u.named).length, cited: units.filter(u => u.cited).length, mention_rate: 0, visibility_score: 0,
      engines: { chatgpt: { answered: units.length } }, prompts: {}, competitors: {}, sources: {}, rule_version: (o && o.rule) != null ? o.rule : RULE, detail: { v: 1, rule_version: RULE, ents, a } }; };
  const plan = (o) => [{ json: { site_id: SID, domain: DOM, canonical_host: DOM, country: 'United Arab Emirates', location_code: 2784, language_code: 'en', country_iso: 'AE', email: '', callback_url: '', request_id: '',
    on_demand: false, adhoc: false, business_name: 'Northwind ERP', business_type: '', city: 'Dubai', profile: {}, services: [], business_facts: [], accreditation: '',
    brand_names: [DOM, 'Northwind ERP'], competitors: ['rival.com'], configured_competitors: ['rival.com'], aliases: {}, topics: ['e invoicing'], engines: o.engines || ['chatgpt'], prompts_max: 20, pulse: true,
    prompts: o.prompts, full_due: false, run_kind: 'weekly', monthly_engines: [], carried: null, need_prompts: false, prompts_needed: 0, need_site_text: false, gsc_questions: [],
    discovery_due: false, volume_keywords: [], index_due: false, market_due: false, market_keyword: 'e invoicing', ga4_property_id: '', pulse_rows: o.pulse_rows || [], key_paths: [], set_aside: [], set_aside_note: '',
    pulse_window: o.pulse_window || { from: day(7), to: NOW, days: 7 },
    previous: o.previous === undefined ? null : o.previous, run_id: 'ai_f1b', checked_at: NOW } }];
  const drive = async (o) => { reset(); mock('AI Plan', plan(o)); mock('Apply Analysis', o.rows.map(r => ({ json: r })));
    mock('AI Requests', [{ json: { site_id: SID, engine: 'chatgpt' } }]); mock('Run AI Requests', [{ json: {} }]);
    return (await run('AI Metrics', store['Apply Analysis']))[0].json; };
  const kitOf = (file, name) => { const src = fs.readFileSync(path.join(process.env.CODE_DIR || path.join(__dirname, 'code_v4'), file), 'utf8'); const a = src.indexOf('const ' + name + ' = (() => {'); const b = src.indexOf('\n})();', a);
    if (a < 0 || b < 0) throw new Error(name + ' not inlined in ' + file); const pre = src.slice(src.indexOf('const wilson'), src.indexOf('const BRAND_CATEGORY'));
    return new Function(pre + '\n' + src.slice(src.indexOf('const normCdf'), src.indexOf('const fmtP')) + '\nreturn { ' + name + ', answerScore, posWeight };')(); };

  // ===================================================================================================================================
  await guard('F1B-1 E7: "named in" counts the name, a citation alone is "cited"; the score weights are the documented ones', async () => {
    reset(); const SN = 'F1B-1 (E7) — a citation-only answer is cited, not named: named rate, the score (0.4, not 0.6) and an older row read the same way'; begin(SN); const check = mkCheck(SN);
    const K = kitOf('AI_Metrics.js', 'AVM');
    check('a citation-only answer (new row) is not named and scores 0.4', K.AVM.named({ named: false, mentioned: true, cited: true, rank: 0 }) === false && K.answerScore({ answered: true, named: false, mentioned: true, cited: true, rank: 0 }) === 0.4);
    check('an older row (no `named`): mentioned + cited + rank 0 is a citation alone; mentioned + rank 2 is named at place 2', K.AVM.named({ mentioned: true, cited: true, rank: 0 }) === false && K.AVM.named({ mentioned: true, cited: false, rank: 2 }) === true && K.AVM.position({ mentioned: true, rank: 2 }) === 2 && K.answerScore({ answered: true, mentioned: 'true', cited: 'true', rank: 0 }) === 0.4);
    check('named first and cited = 1, named 2nd not cited = 0.8 x 0.85, a failed answer has no score', K.answerScore({ answered: true, named: true, position: 1, cited: true }) === 1 && Math.abs(K.answerScore({ answered: true, named: true, position: 2, cited: false }) - 0.68) < 1e-9 && K.answerScore({ answered: false, named: true }) === null);
    const rows = [row({ pid: 'q0', named: true, rivals: ['rival.com'] }), row({ pid: 'q1', cited: true, rivals: ['rival.com'] }), row({ pid: 'q2', rivals: ['rival.com'] }), row({ pid: 'q3', rivals: [] })];
    const X = await drive({ prompts: [0, 1, 2, 3].map(i => prompt(i)), rows });
    const M = X.metrics;
    check('4 answers: 1 named, 2 cited-or-named; named rate 25% (it was 50%), cited 25%', M.named_rate === 25 && M.mention_rate === 25 && M.citation_rate === 25 && X.vis_row.named_rate === 25 && X.vis_row.mention_rate === 25, JSON.stringify({ n: M.named_rate, m: M.mention_rate, c: M.citation_rate }));
    check('the stored row says which rule counted it', X.vis_row.rule_version === RULE && JSON.parse(X.vis_row.metrics_json).named.k === 1 && JSON.parse(X.vis_row.metrics_json).cited.k === 1, X.vis_row.rule_version);
    const q1 = X.questions.find(q => q.prompt_id === 'q1');
    check('the cited-only question is "cited" in the grid but not won (a citation is not a recommendation)', q1.engines.chatgpt === 'cited' && q1.won === false && X.questions.find(q => q.prompt_id === 'q0').won === true, JSON.stringify(q1));
  });

  // ===================================================================================================================================
  await guard('F1B-2 E6: one share-of-voice definition for the headline and every segment', async () => {
    reset(); const SN = 'F1B-2 (E6) — weekly 1 of 4 names you, all 4 name rival.com; 12 pulse answers name you and rival.com: every segment uses the headline\'s answers on both sides and adds back to it'; begin(SN); const check = mkCheck(SN);
    const rows = [0, 1, 2, 3].map(i => row({ pid: 'q' + i, named: i === 0, rivals: ['rival.com'] }));
    const pr = [pulseRow(day(2).slice(0, 10), Array.from({ length: 12 }, (_, k) => ({ pid: 'q' + (k % 4), named: true, rivals: ['rival.com'] })))];
    const X = await drive({ prompts: [0, 1, 2, 3].map(i => prompt(i)), rows, pulse_rows: pr });
    const M = X.metrics, R = X.segments.rows;
    // 13 of you, 16 of rival.com: 13 / 29 = 44.8%. The old segment figure was 13 / (13 + 4) = 76.5%.
    check('the headline: 13 of your mentions out of 29 = 44.8%', M.share_of_voice === 44.8 && M.sov_denominator === 29 && M.sov_answers === 16, JSON.stringify({ sov: M.share_of_voice, d: M.sov_denominator, n: M.sov_answers }));
    const eng = R.find(s => s.dim === 'engine' && s.key === 'chatgpt');
    check('the engine segment carries the same 44.8% (it read 76.5%: pulse mentions on top, pulse rivals left out)', eng.sov === 44.8 && eng.sov_mentions === 29 && eng.pulse_n === 12, JSON.stringify(eng));
    for (const dim of ['engine', 'cluster', 'persona', 'market', 'stage']) { const rs = R.filter(s => s.dim === dim); const self = rs.reduce((a, s) => a + s.sov_self, 0), all = rs.reduce((a, s) => a + s.sov_mentions, 0);
      check('recomputation: the ' + dim + ' segments add back to the headline (' + rs.length + ' segment(s): sum of yours / sum of all mentions)', all === M.sov_denominator && Math.round(1000 * self / all) / 10 === M.share_of_voice && rs.reduce((a, s) => a + s.n, 0) === M.samples, JSON.stringify(rs.map(s => [s.key, s.sov_self, s.sov_mentions, s.n]))); }
    const seg = JSON.parse(X.vis_row.segments_json);
    check('the stored segments name the new columns (the app reads them by name)', ['sov_answers', 'sov_self', 'sov_mentions', 'avg_position', 'position_answers', 'first_rate', 'pos_visibility'].every(c => seg.cols.includes(c)) && seg.rule_version === RULE, JSON.stringify(seg.cols));
    // a pulse reading counted under an older rule is left out on both sides and named
    const Y = await drive({ prompts: [0, 1, 2, 3].map(i => prompt(i)), rows, pulse_rows: [pulseRow(day(2).slice(0, 10), Array.from({ length: 12 }, (_, k) => ({ pid: 'q' + (k % 4), named: true, rivals: ['rival.com'] })), { rule: '' })] });
    check('a pulse reading of an older rule is not pooled, and the report basis says so', Y.metrics.samples === 4 && Y.metrics.share_of_voice === 20 && Y.metrics.pulse_basis && /earlier measurement rule/.test(Y.metrics.pulse_basis.note), JSON.stringify(Y.metrics.pulse_basis));
  });

  // ===================================================================================================================================
  const ids10 = Array.from({ length: 10 }, (_, i) => 'q' + i);
  const prevRow = (o) => ({ run_id: 'ai_prev', rule_version: o.rule == null ? RULE : o.rule, checked_at: day(7), mention_rate: 30, samples: 40, mentioned_k: 12, prompts: 10, run_kind: 'weekly', citation_rate: 10, share_of_voice: 30, avg_rank: 2,
    visibility_score: 30, sentiment_score: null, engines: o.engines || { chatgpt: { ...engObj(40).chatgpt, cited: 4 } }, market_month: '', market: null, index: null, perception: null, traffic: null, access: null,
    competitors: [{ domain: 'rival.com', mentions: 28, share: 70, named_rate: 70, sov: 70, avg_position: 1.2, cited_rate: 0, engines: { chatgpt: { named_rate: 70, sov: 70, avg_position: 1.2, cited_rate: 0 } } }], panel: { ids: o.ids || ids10 },
    stats: { v: 1, rule_version: o.rule == null ? RULE : o.rule, named: { k: 12, n: 40 }, cited: { k: 4, n: 40 }, sov: { rate: 30, se: 5, n: 40, self: 12, mentions: 40 }, position: { mean: 2, sd: 0.5, n: 12 }, score: { score: 30, half: 6, n: 40 },
      competitors: { 'rival.com': { named: 28, n: 40, sov: 70, sov_se: 5, sov_n: 40, avg_position: 1.2, position_n: 28, cited_rate: 0 } } } });
  // W2-E2 (2026-10-23): the named answers are spread across the questions (round by round). They used to fill questions 0-5 and leave 6-9 empty -
  // perfectly clustered - which the clustered change test reads, correctly, as ten independent questions rather than forty answers (W2E2-CI).
  const weekRows = (namedK, citedK) => { const out = []; let k = 0; for (let j = 0; j < 4; j++) for (let q = 0; q < 10; q++) { out.push(row({ pid: 'q' + q, named: k < namedK, position: k % 3 === 0 ? 1 : 2, cited: k < citedK, rivals: ['rival.com'] })); k++; } return out; };
  const P10 = ids10.map((_, i) => prompt(i));
  await guard('F1B-3 compare_json: one comparison every reader shares, refused across a changed panel, engine set or rule', async () => {
    reset(); const SN = 'F1B-3 (A1 / E13) — compare_json: the exact shape; comparable on the same panel, engines and rule; refused (with the reason, no delta, no test) when 70% of the questions are new, an engine was added, or the earlier row was counted under another rule'; begin(SN); const check = mkCheck(SN);
    const X = await drive({ prompts: P10, rows: weekRows(24, 8), previous: prevRow({}) });
    const C = JSON.parse(X.vis_row.compare_json);
    console.log('   compare_json (comparable) ->', X.vis_row.compare_json);
    const KEYS = ['rule_version', 'comparable', 'reason', 'previous_run_id', 'previous_at', 'panel_overlap', 'engines_same', 'window', 'metrics'];
    const MK = ['named_rate', 'cited_rate', 'share_of_voice', 'visibility_score', 'avg_position'], FK = ['now', 'prev', 'delta', 'n_now', 'n_prev', 'significant', 'p'];
    check('the exact shape: top-level keys, window {from, to, days}, five metrics with now / prev / delta / n_now / n_prev / significant / p', JSON.stringify(Object.keys(C).sort()) === JSON.stringify(KEYS.slice().sort()) && JSON.stringify(Object.keys(C.window).sort()) === '["days","from","to"]'
      && JSON.stringify(Object.keys(C.metrics).sort()) === JSON.stringify(MK.slice().sort()) && MK.every(k => JSON.stringify(Object.keys(C.metrics[k]).sort()) === JSON.stringify(FK.slice().sort())), JSON.stringify(C));
    check('comparable: same panel (overlap 1), same engines, same rule; the previous run named', C.comparable === true && C.reason === null && C.previous_run_id === 'ai_prev' && C.panel_overlap === 1 && C.engines_same === true && C.rule_version === RULE, JSON.stringify(C).slice(0, 300));
    const nr = C.metrics.named_rate;
    check('named rate 60% vs 30% on 40 + 40 answers: delta +30, a real change with its p; units are percentages', nr.now === 60 && nr.prev === 30 && nr.delta === 30 && nr.n_now === 40 && nr.n_prev === 40 && nr.significant === true && nr.p > 0 && nr.p < 0.05 && Number.isInteger(nr.n_now), JSON.stringify(nr));
    check('share of voice and the place carry their own test (over answers); the window is stated', C.metrics.share_of_voice.significant !== null && C.metrics.share_of_voice.n_now === 40 && C.metrics.avg_position.n_now === 24 && C.window.days >= 6.9 && X.vis_row.rate_period.length > 0, JSON.stringify([C.metrics.share_of_voice, C.metrics.avg_position, C.window]));
    // a changed panel: the same SIZE, 3 of 10 questions in common
    const Y = await drive({ prompts: P10, rows: weekRows(20, 8), previous: prevRow({ ids: ['q0', 'q1', 'q2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9'] }) });
    const CY = JSON.parse(Y.vis_row.compare_json);
    check('a different panel of the same size: not comparable, the overlap and the reason, every delta / significant / p null', CY.comparable === false && CY.panel_overlap === 0.3 && /different panel/.test(CY.reason) && MK.every(k => CY.metrics[k].delta === null && CY.metrics[k].significant === null && CY.metrics[k].p === null), JSON.stringify(CY).slice(0, 400));
    // E13: the per-engine citation alert reads the same verdict (it used to check only the panel's size)
    check('E13: the per-engine citation change is not tested on that panel, with the overlap reason', Object.values(Y.metrics.engine_changes).length > 0 && Object.values(Y.metrics.engine_changes).every(c => c.tested === false && /different panel/.test(c.why)), JSON.stringify(Y.metrics.engine_changes));
    // an engine added
    const Z = await drive({ prompts: P10, engines: ['chatgpt', 'gemini'], rows: [...weekRows(20, 8), ...weekRows(20, 8).map(r => ({ ...r, engine: 'gemini' }))], previous: prevRow({}) });
    const CZ = JSON.parse(Z.vis_row.compare_json);
    check('an engine added: engines_same false, not comparable, no delta', CZ.comparable === false && CZ.engines_same === false && CZ.metrics.named_rate.delta === null && /Gemini|gemini/.test(CZ.reason), JSON.stringify(CZ).slice(0, 300));
    // the deploy of this rule: the earlier row was counted under the old one (no rule_version)
    const W = await drive({ prompts: P10, rows: weekRows(20, 8), previous: prevRow({ rule: '' }) });
    const CW = JSON.parse(W.vis_row.compare_json);
    console.log('   compare_json (rule changed) ->', W.vis_row.compare_json);
    check('an earlier row of another rule: "measurement rule changed", this week a new baseline, no delta, no headline test, no alert', CW.comparable === false && /measurement rule changed: this week starts a new baseline/.test(CW.reason) && CW.metrics.named_rate.delta === null && !W.metrics.tests && /measurement rule changed/.test(W.metrics.delta_not_compared) && !W.alerts.some(a => /dropped|gained/.test(a.text)), JSON.stringify(CW).slice(0, 300));
    const F = await drive({ prompts: P10, rows: weekRows(20, 8) });
    const CF = JSON.parse(F.vis_row.compare_json);
    check('a first run: not comparable, "first run" as the reason, prev null', CF.comparable === false && /first run/.test(CF.reason) && CF.previous_run_id === null && CF.metrics.named_rate.prev === null && CF.panel_overlap === null && CF.engines_same === null, JSON.stringify(CF).slice(0, 300));
  });

  // ===================================================================================================================================
  await guard('F1B-4 E19: share of voice is tested over answers, not mentions', async () => {
    reset(); const SN = 'F1B-4 (E19) — one answer naming four rivals is one observation: the share of voice\'s sample is the answers that named anybody, its range is wider than the binomial over mentions'; begin(SN); const check = mkCheck(SN);
    const rows = Array.from({ length: 20 }, (_, i) => row({ pid: 'q' + (i % 10), named: i < 10, rivals: i < 10 ? ['a.com'] : ['a.com', 'b.com', 'c.com', 'd.com'] }));
    const X = await drive({ prompts: P10, rows });
    const M = X.metrics;
    // 10 of yours out of 10 + 10 + 40 = 60 mentions: 16.7%, over 20 answers
    const K = kitOf('AI_Metrics.js', 'AVM');
    check('16.7% of 60 mentions over 20 answers; the range is the ratio estimator\'s over answers', M.share_of_voice === 16.7 && M.sov_answers === 20 && M.sov_denominator === 60 && M.sov_ci[1] - M.sov_ci[0] > 0, JSON.stringify({ sov: M.share_of_voice, n: M.sov_answers, ci: M.sov_ci }));
    const S = K.AVM.ratio(rows.map((r, i) => [i < 10 ? 1 : 0, i < 10 ? 2 : 4]));
    check('the kit\'s ratio: se from the answers (Cochran), wider than sqrt(p(1-p)/60) over mentions', S.n === 20 && S.rate === 16.7 && S.se > 100 * Math.sqrt(0.1667 * 0.8333 / 60), JSON.stringify(S));
  });

  // ===================================================================================================================================
  await guard('F1B-5 the place in the answers and the competitor table', async () => {
    reset(); const SN = 'F1B-5 (position, competitors) — mean place when named, share named first and position-weighted visibility per engine and segment with "too few answers" under 12; each competitor\'s named rate, place, share and cited rate, headline and per engine, with its change against a comparable run'; begin(SN); const check = mkCheck(SN);
    const X = await drive({ prompts: P10, rows: weekRows(24, 8), previous: prevRow({}) });
    const M = X.metrics;
    // 24 named answers: place 1 when k % 3 === 0 (k = 0..23: 8 of them), else 2 -> mean 1.67, named first 8 of 40, (8 x 100 + 16 x 80) / 40 = 52
    check('mean place 1.7 over 24 placed answers, named first in 20% of 40, position-weighted visibility 52 (1st = 100, 2nd = 80)', M.avg_position === 1.7 && M.position_answers === 24 && M.first_rate === 20 && M.pos_visibility === 52 && X.vis_row.avg_position === 1.7 && X.vis_row.first_rate === 20, JSON.stringify({ a: M.avg_position, n: M.position_answers, f: M.first_rate, pv: M.pos_visibility }));
    const e = X.engines.chatgpt;
    check('per engine: the same figures with their sample', e.avg_position === 1.7 && e.position_answers === 24 && e.first_rate === 20 && e.sov != null && e.sov_answers === 40, JSON.stringify(e));
    const small = X.segments.rows.find(s => s.dim === 'persona' && s.key === 'IT manager');
    check('a segment with under 12 placed answers says too few (null), with its count', small && small.position_answers < 12 && small.avg_position === null, JSON.stringify(small));
    const c = X.competitors.find(x => x.domain === 'rival.com');
    check('the competitor table: rival.com named in 100%, its place, share 62.5% (40 of 64 mentions), cited 0%, per engine', c.named_rate === 100 && c.avg_position === 1.2 && c.sov === 62.5 && c.share === 62.5 && c.cited_rate === 0 && c.engines.chatgpt && c.engines.chatgpt.named_rate === 100, JSON.stringify(c));
    check('its change against the comparable run: named +30, share -7.5 with its test (within noise over answers)', c.delta && c.delta.named_rate === 30 && c.delta.sov === -7.5 && c.delta.sov_significant === false && c.engines.chatgpt.delta && c.engines.chatgpt.delta.named_rate != null, JSON.stringify(c.delta));
    const Y = await drive({ prompts: P10, rows: weekRows(24, 8), previous: prevRow({ rule: '' }) });
    check('no competitor change across a refused comparison', Y.competitors.find(x => x.domain === 'rival.com').delta === null);
    const rep = (await run('AI Report', store['AI Metrics']))[0].json.html;
    check('the report prints the place tiles and the competitor columns', /Avg\. position/.test(rep) && /Named first/.test(rep) && /Position-weighted/.test(rep) && /<th[^>]*>Cited<\/th>/.test(rep) && /an answer naming four businesses counts once/.test(rep), rep.slice(0, 200));
  });

  // ===================================================================================================================================
  await guard('F1B-6 E14: a pulse morning belongs to exactly one weekly window', async () => {
    reset(); const SN = 'F1B-6 (E14) — a split run started Monday 06:00 whose last part runs Tuesday after the pulse: Tuesday\'s morning is not pooled into it, and next week\'s run (from Monday 06:00) pools it once'; begin(SN); const check = mkCheck(SN);
    const FX = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures_live', 'g6_live.json.gz'))).toString('utf8')); const W = FX.weekly;
    const items = (arr) => (arr && arr.length ? arr : [{}]).map(j => ({ json: j }));
    const started = day(1.3), tuesdayPulse = day(1.1), sundayPulse = day(2), prevAt = day(8.3);
    const daily = [{ site_id: 'site_techand-ai', domain: 'techand.ai', date: tuesdayPulse.slice(0, 10), checked_at: tuesdayPulse, run_id: 'pulse_tue', samples: 3, mentioned: 1, cited: 0, rule_version: RULE, detail_json: JSON.stringify({ v: 1, ents: [], a: [['x', 'chatgpt', 1, 0, 1, []], ['y', 'chatgpt', 0, 0, null, []], ['z', 'chatgpt', 0, 0, null, []]] }), engines_json: '{}', prompts_json: '{}', competitors_json: '{}', sources_json: '{}' },
      { site_id: 'site_techand-ai', domain: 'techand.ai', date: sundayPulse.slice(0, 10), checked_at: sundayPulse, run_id: 'pulse_sun', samples: 3, mentioned: 1, cited: 0, rule_version: RULE, detail_json: JSON.stringify({ v: 1, ents: [], a: [['x', 'chatgpt', 1, 0, 1, []], ['y', 'chatgpt', 0, 0, null, []], ['z', 'chatgpt', 0, 0, null, []]] }), engines_json: '{}', prompts_json: '{}', competitors_json: '{}', sources_json: '{}' }];
    const load = (o) => { mock('Load Sites', items(W['Load Sites'])); mock('Load Ladders', items(W['Load Ladders'])); mock('Load Profiles', items(W['Load Profiles'])); mock('Load Monitors', items(W['Load Monitors']));
      mock('Load AI Prompts', items(W['Load AI Prompts'])); mock('Load AI Visibility', items(o.vis)); mock('Load AI Daily', items(daily)); mock('Load Cache (AI)', items([...(W['Load Cache (AI)'] || []), ...(o.cache || [])]));
      mock('Load Query History', items([])); mock('Load AI Run Answers', items([])); if (o.trigger) mock('Manual Run', [{ json: o.trigger }]); else delete store['Manual Run'];
      delete store['Prompt Rows']; delete store['Discovery Requests']; delete store['Run Discovery']; delete store['Analyst Jobs']; delete store['Prompt Jobs']; };
    const prevVis = { ...(W['Load AI Visibility'] || [])[0], site_id: 'site_techand-ai', domain: 'techand.ai', checked_at: prevAt, run_kind: 'full', rule_version: RULE };
    reset(); load({ vis: [prevVis], trigger: { domain: 'techand.ai', site_id: 'site_techand-ai', continue_run: 'ai_split' },
      cache: [{ key: 'ai_run:site_techand-ai', kind: 'ai', site_id: 'site_techand-ai', updated_at: day(0.01), value: JSON.stringify({ run_id: 'ai_split', run_kind: 'weekly', site_id: 'site_techand-ai', domain: 'techand.ai', started_at: started, updated_at: day(0.01), chunk: 2, status: 'running', asked: 600, total: 700, spent_dfs_usd: 2.4, executions: ['e1', 'e2'] }) }] });
    const P = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('the last part of the split run pools the Sunday morning only: the window ends at the run\'s start, not at the part\'s', P.chunk && P.chunk.going && P.pulse_rows.length === 1 && P.pulse_rows[0].run_id === 'pulse_sun' && P.pulse_window.to === started && P.pulse_window.from === prevAt, JSON.stringify({ rows: P.pulse_rows.map(d => d.run_id), w: P.pulse_window, going: P.chunk && P.chunk.going }));
    reset(); load({ vis: [{ ...prevVis, checked_at: started, run_id: 'ai_split' }] });
    const P2 = (await run('AI Plan', [{ json: {} }]))[0].json;
    check('next week\'s run starts its window at that run\'s start and pools Tuesday\'s morning, once', P2.pulse_rows.length === 1 && P2.pulse_rows[0].run_id === 'pulse_tue' && P2.pulse_window.from === started && P2.pulse_rows[0].detail && P2.pulse_rows[0].rule_version === RULE, JSON.stringify({ rows: P2.pulse_rows.map(d => d.run_id), w: P2.pulse_window }));
  });

  // ===================================================================================================================================
  await guard('F1B-8 F1a handover: stored entities, one business across answers, no platform learned as a rival', async () => {
    reset(); const SN = 'F1B-8 (F1a handover) — a stored row read through entities_json; cleartax.com and cleartax.in in two answers are one competitor; an analyst brand in the role of platform stays a source, never a rival'; begin(SN); const check = mkCheck(SN);
    const stored = (o) => { const r = row(o); r.entities_json = r.entities; delete r.entities; return r; };
    const rows = [stored({ pid: 'q0', named: true, position: 2, rivals: ['cleartax.com'], sources: ['odoo.com'] }), stored({ pid: 'q1', rivals: ['cleartax.in'], sources: ['odoo.com'] }), stored({ pid: 'q2', rivals: ['cleartax.com'], sources: ['odoo.com'] })];
    reset(); mock('AI Plan', plan({ prompts: [0, 1, 2].map(i => prompt(i)) })); mock('Apply Analysis', rows.map(r => ({ json: r })));
    mock('AI Requests', [{ json: { site_id: SID, engine: 'chatgpt' } }]); mock('Run AI Requests', [{ json: {} }]);
    mock('Analyst Jobs', [{ json: { site_id: SID, ids: ['q0|chatgpt'] } }]);
    mock('Answer Analyst', [{ json: { output: JSON.stringify({ answers: [{ n: 1, brands: [{ name: 'Odoo Platform', domain: 'odoo.com', role: 'platform' }, { name: 'ClearTax', domain: 'cleartax.com', role: 'competitor' }] }] }) } }]);
    const X = (await run('AI Metrics', store['Apply Analysis']))[0].json;
    check('the stored row (entities_json, no entities array) is read: named once, at place 2', X.metrics.named_rate === 33.3 && X.metrics.avg_position === null && X.metrics.position_answers === 1, JSON.stringify({ n: X.metrics.named_rate, p: X.metrics.position_answers }));
    const ct = X.competitors.filter(c => /cleartax/.test(c.domain));
    check('cleartax.com and cleartax.in are one competitor named in all 3 answers (share 3 of 4 mentions)', ct.length === 1 && ct[0].mentions === 3 && ct[0].named_rate === 100 && X.metrics.share_of_voice === 25, JSON.stringify(ct));
    check('odoo.com, named by the analyst as a platform, is a source (a place to be listed), not a rival', X.sources.some(s => s.domain === 'odoo.com') && !(X.rival_sources || []).some(r => r.domain === 'odoo.com'), JSON.stringify({ src: X.sources.map(s => s.domain), riv: X.rival_sources }));
  });

  // ===================================================================================================================================
  await guard('F1B-7 the pulse daily row says what the morning was', async () => {
    reset(); const SN = 'F1B-7 (A7) — the daily row: rule, sample or full, questions asked, engines that answered, a partial morning when an engine returned nothing, the mean place and the per-answer record; a baseline day of another rule is set aside'; begin(SN); const check = mkCheck(SN);
    const engines = ['chatgpt', 'gemini', 'ai_mode'];
    const prompts = [0, 1, 2, 3].map(i => prompt(i));
    const prow = (pid, e, o) => ({ ...row({ pid, engine: e, ...o }), run_kind: 'pulse', run_id: 'pulse_f1b' });
    const answers = []; for (const q of prompts) { answers.push(prow(q.prompt_id, 'chatgpt', { named: q.prompt_id === 'q0', position: 2, rivals: ['rival.com'] })); answers.push(prow(q.prompt_id, 'ai_mode', { cited: true, rivals: [] })); answers.push({ ...prow(q.prompt_id, 'gemini', {}), answered: false, error: 'task error 50000' }); }
    const pplan = (base) => [{ json: { site_id: SID, domain: DOM, date: NOW.slice(0, 10), checked_at: NOW, run_id: 'pulse_f1b', email: '', callback_url: '', request_id: '', on_demand: false, pulse_engines: engines, prompts, panel_size: 20,
      sample: { mode: 'sample', per_week: 3, panel: 20, asked: 4 }, baseline: base || [], set_aside: [], brand_names: [DOM], aliases: {} } }];
    mock('AI Plan', pplan([{ date: day(1).slice(0, 10), samples: 8, mentioned: 6, engines: ['ai_mode', 'chatgpt'], panel: 4, prompts: {}, competitors: {}, rule_version: '' }]));
    mock('Parse AI Answers', answers.map(r => ({ json: r }))); mock('Merge AI Answers', [{ json: {} }]);
    const X = (await run('Pulse Metrics', store['Parse AI Answers'], { code: 'Pulse__Pulse_Metrics' }))[0].json; const D = X.daily_row;
    check('rule, sample mode, questions asked, engines that answered', D.rule_version === RULE && D.sample_mode === 'sample' && D.questions_asked === 4 && D.engines_answered === 'chatgpt, ai_mode', JSON.stringify({ r: D.rule_version, s: D.sample_mode, q: D.questions_asked, e: D.engines_answered }));
    check('Gemini returned nothing: the morning is partial', D.partial === true && /Gemini/.test(JSON.parse(D.readable_json).note), D.readable_json);
    check('named = the name in the text: 1 of 8 (the 4 citation-only answers are cited, not named)', D.mentioned === 1 && D.cited === 4 && D.mention_rate === 12.5 && D.avg_position === 2, JSON.stringify({ m: D.mentioned, c: D.cited, r: D.mention_rate, p: D.avg_position }));
    const det = JSON.parse(D.detail_json);
    check('the per-answer record the weekly run pools: 8 answers, place and competitors kept', det.rule_version === RULE && det.a.length === 8 && det.ents.includes('rival.com') && det.a.some(a => a[0] === 'q0' && a[2] === 1 && a[4] === 2 && a[5].length === 1), D.detail_json.slice(0, 300));
    check('one share-of-voice definition on the morning too: 1 of yours out of 1 + 4 rival mentions = 20%', D.share_of_voice === 20, D.share_of_voice);
    check('a baseline morning counted under the earlier rule is set aside with that reason, never pooled', X.baseline_days === 0 && X.baseline_set_aside.length === 1 && /earlier measurement rule/.test(X.baseline_set_aside[0].why), JSON.stringify(X.baseline_set_aside));
  });
};
