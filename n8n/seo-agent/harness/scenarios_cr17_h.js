// CR17H1-CR17H5 (client report 2026-11-17, devaicon.com F1; package CR17-H, build section 198): what a client reads from the engine.
// devaicon.com's Pipeline, Steps on your website, the AI growth report and its e-mail read "Get the page indexed in Google: 6 cell(s), expected
// gain 0.0082 over (client time at an hour), typical 21 days": ARL.score wrote its arithmetic into `why` and AI Rank Plan merged the score over
// the candidate, so the arithmetic became the client's reason. Also: a lever code in a prospect note ("AI ranking placement (L08)"), a data
// provider's raw answer in the keyword research report ('500 - "{\"version\":...'), an arrow in the site report's High titles.
//   CR17H1 ARL.score: `why` is the lever's sentence for the client, the arithmetic is `score_note`; the three copies of the sentences agree
//   CR17H2 AIRC.whyPlain: every scoring line production stored (11 Nov - 17 Nov, both clients) becomes its lever's sentence
//   CR17H3 the AI growth report: an AI-ranking step and an action stored with the scoring line say the lever's sentence (html, steps, actions)
//   CR17H4 the research nodes: a provider's raw answer is a sentence, a short message is kept; the same rule in the three nodes
//   CR17H5 the generated workflows: no scoring line, no lever-coded note and no arrow in the site report's index action
// Real strings from the production snapshot of 2026-11-17 (public pages of the client's website, no personal data).
const fs = require('fs');
const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, guard, reset, begin } = ctx;
  const mkCheck = (SN) => (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
    console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
  const J = (x) => JSON.stringify(x);
  const V5 = path.join(__dirname, '..', 'v5', 'code');
  const CODE = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
  const haveV5 = fs.existsSync(path.join(V5, '_ai_rank_learn.js'));
  const rdf = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
  // the forbidden shapes (the app's CLIENT_COPY_FORBIDDEN, the ones the engine can write)
  const BAD = [/\bcell\(s\)|\b\d+\s+cells?\b/i, /\bexpected gain\b/i, /\bclient time\b/i, /\bL(?:0[1-9]|1[0-7])\b/, /→/, /\{\s*\\?"[A-Za-z_]+\\?"\s*:|\bstatus_code\b/];
  const bad = (t) => BAD.filter(r => r.test(String(t || ''))).map(String);
  const PROD_LINES = [
    'Get the page indexed in Google: 6 cell(s), expected gain 0.0082 over (client time at an hour), typical 21 days',
    'Add the site to Bing Webmaster and submit: 10 cell(s), expected gain 0.0135 over (client time at an hour), typical 10 days',
    'LinkedIn article by a named person: 55 cell(s), expected gain 0.019 over (client time at an hour), typical 21 days',
    'Earned mention (press, partner, customer case): 39 cell(s), expected gain 0.0165 over (client time at an hour), typical 60 days',
    'Cited but not named: fix the passage: 1 cell(s), expected gain 0.0032 over (client time at an hour), typical 21 days',
    'Refresh the ranking page for the searches the engines run: 5 cell(s), expected gain 0.0119 over (client time at an hour), typical 30 days',
    'Placement on an editorial list the answers cite: 4 cell(s), expected gain 0.0024 over (client time at an hour), typical 30 days',
    'AI ranking (L06): Refresh the ranking page for the searches the engines run: 5 cell(s), expected gain 0.0119 over $9.63 (client time at $25 an hour), typical 30 days',
  ];
  const LEVER_OF = ['L04', 'L03', 'L12', 'L11', 'L07', 'L06', 'L08', 'L06'];

  await guard('CR17H1 ARL.score: the client reason and the team arithmetic travel apart', async () => {
    reset(); const SN = 'CR17H1 (client report 2026-11-17, F1) ARL.score: `why` is the lever\'s sentence, the arithmetic is `score_note`'; begin(SN); const check = mkCheck(SN);
    if (!haveV5) { check('CR17H1 skipped: v5/code is not next to the harness', true); return; }
    const NOOP = new Set(['defineProperty', 'defineProperties', 'setPrototypeOf']); const SOBJ = new Proxy(Object, { get: (t, k) => NOOP.has(k) ? ((o) => o) : t[k] });
    const K = new Function('URL', 'structuredClone', 'Object', rdf(V5, '_ai_measure.js') + '\n' + rdf(V5, '_ai_rank_flags.js') + '\n' + rdf(V5, '_ai_rank_diag.js') + '\n' + rdf(V5, '_ai_rank_learn.js') + '\nreturn { AIRF, ARL };')(undefined, undefined, SOBJ);
    const AIRC = new Function(rdf(V5, '_ai_rank_client.js') + '\nreturn AIRC;')();
    const c = { action_id: 'h1', site_id: 's', lever: 'L04', factor: 1, page_url: 'https://devaicon.com/engagement-models', why: 'the page the question maps to is not in Google\'s index',
      cells: [{ prompt_id: 'q1', engine: 'ai_mode', stage: 'S0', sub: 'not_indexed' }, { prompt_id: 'q1', engine: 'ai_overview', stage: 'S0', sub: 'not_indexed' }] };
    const vals = new Map([['q1', { V: 2.0 }]]), feas = new Map([['q1', { F: 0.6, reach_w: 0.5, basis: 'reach percentile 0.5' }]]);
    const s = K.ARL.score(c, { priors: [], values: vals, feas, H: 25 });
    check('CR17H1 the score\'s why is the client sentence (no cells, no gain, no money); the arithmetic is score_note',
      s.why === AIRC.WHY.L04 && !bad(s.why).length && /cell\(s\), expected gain/.test(s.score_note) && /client time/.test(s.score_note), J({ why: s.why, note: s.score_note }));
    // what AI Rank Plan does: the score merged over the candidate, the candidate's own reason kept as reason_note
    const scored = { ...c, ...s, reason_note: c.why, scored: s };
    const ch = K.ARL.choose([scored], { mode: 'on', capacities: {}, arms: [], open_actions: [] });
    const a = (ch.chosen || [])[0] || {};
    check('CR17H1 the chosen action carries the client sentence as why, and score_note / reason_note for the team',
      a.why === AIRC.WHY.L04 && /expected gain/.test(a.score_note || '') && a.reason_note === c.why, J({ chosen: ch.chosen.length, deferred: ch.deferred, a: { why: a.why, score_note: a.score_note, reason_note: a.reason_note } }));
    const fromArl = Object.fromEntries(K.ARL.LEVERS.map(l => [l.id, l.client]));
    check('CR17H1 the sentences: ARL.LEVERS[].client equals AIRC.WHY (17 levers), and none breaks the client-copy rules (no em dash, curly quote, ellipsis, code)',
      J(fromArl) === J(AIRC.WHY) && Object.keys(AIRC.WHY).length === 17 && Object.values(AIRC.WHY).every(t => !bad(t).length && !/[—–‘’“”…]|\.\.\./.test(t)), J(Object.keys(fromArl)));
  });

  await guard('CR17H2 AIRC.whyPlain over the stored production lines', async () => {
    reset(); const SN = 'CR17H2 (F1) AIRC.whyPlain: every scoring line production stored becomes its lever\'s sentence'; begin(SN); const check = mkCheck(SN);
    if (!haveV5) { check('CR17H2 skipped: v5/code is not next to the harness', true); return; }
    const AIRC = new Function(rdf(V5, '_ai_rank_client.js') + '\nreturn AIRC;')();
    const got = PROD_LINES.map(l => AIRC.whyPlain(l));
    check('CR17H2 the lever is read from the line itself (its engine label, or "AI ranking (Lnn)")', J(PROD_LINES.map(l => AIRC.leverOfLine(l))) === J(LEVER_OF), J(PROD_LINES.map(l => AIRC.leverOfLine(l))));
    check('CR17H2 each line becomes its lever\'s sentence, with nothing internal left', got.every((t, i) => t === AIRC.WHY[LEVER_OF[i]] && !bad(t).length), J(got));
    check('CR17H2 a plain reason stays (made plain), an unknown scoring line says nothing rather than the arithmetic',
      AIRC.whyPlain('B2B answers cite LinkedIn articles by named people') === 'B2B answers cite LinkedIn articles by named people' && AIRC.whyPlain('Something: 5 cells, expected gain 0.01') === '', '');
  });

  await guard('CR17H3 the AI growth report says the lever sentence', async () => {
    reset(); const SN = 'CR17H3 (F1) the AI growth report: a step and an action stored with the scoring line read the lever\'s sentence (html, steps, actions)'; begin(SN); const check = mkCheck(SN);
    const OLD = PROD_LINES[0];
    mock('Manual Run', [{ json: { domain: 'devaicon.com' } }]);
    mock('Load AI Prompts', []); mock('Load Monitors', [{ json: { site_id: 's1', domain: 'devaicon.com', ai_rank_mode: 'on' } }]);
    // an AI ranking run whose chosen step still carries the old line (a step chosen before CR17-H, kept open since)
    mock('AI Rank Plan', [{ json: { site_id: 's1', domain: 'devaicon.com', mode: 'on', run_id: 'air_run_1', error: '', air: { checked_at: '2026-11-13T09:00:00.000Z', panel: { core: [] },
      chosen: [{ action_id: 'air_site_devaicon-com_L04_758f1a85', lever: 'L04', executor: 'human', scope: 'page', sink: 'existing', ref: { url: 'https://devaicon.com/engagement-models' }, questions: [], engines: ['ai_mode'], why: OLD }],
      deferred: [], refused: [], rows: { actions: [{ action_id: 'air_site_devaicon-com_L04_758f1a85', lever: 'L04', status: 'queued' }] }, memo: null } } }]);
    mock('Growth Metrics', [{ json: { site_id: 's1', domain: 'devaicon.com', checked_at: '2026-11-13T09:00:00.000Z', submitted: { bing: { enabled: true, in_account: true, submitted: 0, urls: [], error: '' }, indexnow: { verified: false, submitted: 0, key: 'k', key_url: '' } },
      outcome: { basis: 'none', reason: '' }, pages: [], targets: [], alerts: [], ai_pages_month: 2, robots: null, set_aside: [], refused_submissions: [], corrections: [], earned: [], earned_basis: { answers: 0, from: '', to: '', days: 0, runs: 0, pulse: 0 },
      actions: [{ priority: 2, type: 'ai_rank', action: 'Get the page indexed in Google: https://devaicon.com/engagement-models', why: OLD }, { priority: 2, type: 'pr', action: 'Get featured on azdan.com', why: 'AI answers cite it 29 times.' }] } }]);
    mock('Bing Submit Requests', [{ json: { skip: true } }]); mock('IndexNow Requests', [{ json: { skip: true } }]);
    const GR = (await run('Growth Report', [{ json: {} }]))[0].json;
    const AR = GR.ai_rank || {};
    const step = (AR.steps || [])[0] || {}; const act = (AR.actions || [])[0] || {};
    check('CR17H3 the report (html, the e-mail body and the PDF source) has no scoring line, cell count, client time or lever code', !/cell\(s\)|expected gain|client time/.test(GR.html || '') && !/\bL04\b/.test((GR.html || '').replace(/<[^>]+>/g, ' ')), (GR.html || '').match(/[^<>]{0,80}(cell\(s\)|expected gain)[^<>]{0,40}/) || '');
    check('CR17H3 the callback\'s ai_rank steps and actions carry the lever\'s sentence', /^Google has not put this page in its search results yet/.test(step.why || '') && act.why === step.why, J({ step: step.why, act: act.why }));
    check('CR17H3 the stored AI-ranking action in the week\'s list reads the sentence; other actions are untouched',
      (GR.actions || []).some(a => a.type === 'ai_rank' && /^Google has not put this page/.test(a.why)) && (GR.actions || []).some(a => a.type === 'pr' && a.why === 'AI answers cite it 29 times.'), J((GR.actions || []).map(a => [a.type, a.why])));
    delete ctx.store['Manual Run'];
  });

  await guard('CR17H4 the research nodes never pass a provider dump to the report', async () => {
    reset(); const SN = 'CR17H4 (F1) research failures: a provider\'s raw answer is a sentence, a short message is kept, one rule in three nodes'; begin(SN); const check = mkCheck(SN);
    const src = ['Collect_Research.js', 'Ladder_Pool.js', 'Build_Keyword_Strategy.js'].map(f => { const t = rdf(CODE, f); const m = t.match(/const providerError = (.*?);   \/\/ CR17-H/); return m ? m[1] : ''; });
    check('CR17H4 the three nodes carry the same rule', src.every(Boolean) && new Set(src).size === 1, J(src.map(s => s.slice(0, 40))));
    const providerError = new Function('return ' + src[0])();
    const RAW = '500 - "{\\"version\\":\\"0.1.20261103\\",\\"status_code\\":20000,\\"status_message\\":\\"Ok.\\",\\"tasks_error\\":1}"';
    check('CR17H4 a dump becomes the sentence; "Internal Server Error" (a sentence already) is kept', /^could not be read this time \(the data provider had an error\)/.test(providerError(RAW)) && providerError('Internal Server Error.') === 'Internal Server Error.' && !bad(providerError(RAW)).length, providerError(RAW));
  });

  await guard('CR17H5 the generated workflows', async () => {
    reset(); const SN = 'CR17H5 (F1) the generated code: no scoring line in a client field, no lever-coded note, no arrow in the site report\'s index action'; begin(SN); const check = mkCheck(SN);
    const plan = rdf(CODE, 'AI_Rank_Plan.js'); const metrics = rdf(CODE, 'Site_Metrics.js'); const learn = haveV5 ? rdf(V5, '_ai_rank_learn.js') : '';
    check('CR17H5 AI Rank Plan keeps the candidate\'s reason as reason_note and writes no "AI ranking placement (Lnn)" note', /reason_note: S0\(c\.why\)/.test(plan) && !/'AI ranking placement \(' \+ a\.lever/.test(plan) && /Found by AI ranking: AI answers cite this page/.test(plan), '');
    check('CR17H5 ARL.score returns the arithmetic as score_note, never as why', !haveV5 || (/score_note: L\.label \+ ': ' \+ pc\.length \+ ' cell\(s\)/.test(learn) && !/why: L\.label \+ ': ' \+ pc\.length/.test(learn)), '');
    check('CR17H5 the site report\'s index action starts with a sentence that fits a title and has no arrow', /action: 'Link to ' \+ p\.url \+ ' from 2 or 3 of your pages that are already in Google\. /.test(metrics) && !/URL inspection →/.test(metrics), '');
  });
};
