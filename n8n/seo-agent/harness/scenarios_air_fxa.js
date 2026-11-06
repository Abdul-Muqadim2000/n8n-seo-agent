// AIR FX-A (2026-11-06, docs/ai-ranking-2026-11-05/REVIEW_A_ALGO_STATS.md, fixes/FX-A.md): one check per finding RA-1 .. RA-18, each built from the
// review's own reproduction, so it fails on the code the review read (77c82704) and passes on the fix. Synthetic data only (.example hosts).
//   FXA-1  RA-1   learning learns: AI_Rank_Plan's own outcome path over three weekly runs (verify in week 1, due in week 5) freezes the stages at t0,
//                 reads a stage move and writes a prior row; with no stage at t0 on file, learned_at stays empty
//   FXA-2  RA-2   the control arm keeps its floor for 52 weeks (30 questions), rotates one at a time, never while locked, refills a legacy all-treated panel
//   FXA-3  RA-3   the question-level DiD: false "likely helped" <= 5% on correlated panels (sticky answers, period drift; 1, 3 and 16 questions); +25 points found
//   FXA-4  RA-4   exposure: a control another step works on is left out at outcome time; one move teaches one action; L13 / L14 get controls; site-wide steps: ITS
//   FXA-5  RA-5   a site's share of the pool keeps its rate (4% stays near 8%, never 44%)
//   FXA-6  RA-6   one action is one trial per engine group: 30 moved cells move another site's prior by one pseudo-outcome
//   FXA-7  RA-7   a re-chosen action is registered afresh (shadow -> on, not happened -> chosen again); attempts kept as history
//   FXA-8  RA-8   the before-period frozen at t0: a 60-day window's DiD is read; a pre-trend is caught by the placebo through the plan; short history: halves
//   FXA-9  RA-9   compact stages_json, never trimmed: a 30-question two-week memo compares with last week
//   FXA-10 RA-10  learning once per run: two sites, one key, one global row
//   FXA-11 RA-11  the memo prints the one-question figure (about 50 points) and m per 28 days
//   FXA-12 RA-12  one alpha (0.025); Benjamini-Hochberg over a quarter: 50 null actions give <= 1 "likely helped" on average
//   FXA-13 RA-13  a results page of another country is not read as the question's market
//   FXA-14 RA-14  an own page on a "best X companies" question is a comparison page (R01), an AI-only page is refused (R02)
//   FXA-15 RA-15  no_search: LinkedIn has no cell, an earned mention is halved
//   FXA-16 RA-16  expiry at the lever's longest time to effect + 14 days
//   FXA-17 RA-17  two cited pages of one directory: one candidate with both questions
//   FXA-18 RA-18  no answer-level p is stored as evidence
// Runs inside the harness (scenarios_v5.js) and on its own: node harness/scenarios_air_fxa.js
const fs = require('fs'); const path = require('path');
const V5 = path.join(__dirname, '..', 'v5', 'code'); const rdf = (f) => fs.readFileSync(path.join(V5, f), 'utf8');
const WF = path.join(__dirname, '..', 'workflows', 'SEO_Agent_AI_Growth.json');
const NOOP = new Set(['defineProperty', 'defineProperties', 'setPrototypeOf']); const SOBJ = new Proxy(Object, { get: (t, k) => NOOP.has(k) ? ((o) => o) : t[k] });
const loadKits = () => new Function('URL', 'structuredClone', 'Object', rdf('_ai_measure.js') + '\n' + rdf('_ai_rank_flags.js') + '\n' + rdf('_ai_rank_diag.js') + '\n' + rdf('_ai_rank_learn.js') + '\nreturn { AVX, AIRF, ARD, ARL };')(undefined, undefined, SOBJ);
const DAY = 864e5; const iso = (ms) => new Date(ms).toISOString(); const J = (x) => String(JSON.stringify(x));
const wfNode = (name) => { let w = JSON.parse(fs.readFileSync(WF, 'utf8')); w = Array.isArray(w) ? w[0] : w; const n = w.nodes.find(x => x.name === name); if (!n) throw new Error('node ' + name + ' not in the generated AI Growth workflow'); return n.parameters.jsCode; };

// ---- AI_Rank_Plan, the generated node, with ARD's reading scripted (diagnose, sources, core, market) and AVX.history answering a given unit list.
// Everything ARL does (candidates, choose, prereg, verify, snapshot, outcome, fdr, learn, memo) is the real kit inside the real node. ----
const OVERRIDE = `
const ARD = Object.assign({}, ARD_BASE, __OV.ard(ARD_BASE));
AVX.history = (o) => ({ units: __OV.units(o) });
`;
const planCode = (() => { let js = null; return () => { if (js) return js; js = wfNode('AI Rank Plan'); const a = 'const ARD = (() => {';
  if (js.split(a).length !== 2) throw new Error('plan: ARD kit marker not found once'); js = js.replace(a, 'const ARD_BASE = (() => {');
  const anchor = 'const AIR_CFG = '; if (js.split(anchor).length !== 2) throw new Error('plan: anchor not found'); js = js.replace(anchor, OVERRIDE + '\n' + anchor); return js; }; })();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function runPlan({ now, nodes, ov }) {
  const RealDate = Date; const PD = class extends RealDate { constructor(...a) { if (!a.length) super(now); else super(...a); } static now() { return now; } };
  const acc = (arr) => ({ all: () => arr, first: () => arr[0], last: () => arr[arr.length - 1], get json() { return arr[0] && arr[0].json; } });
  const $ = (name) => { if (!(name in nodes)) throw new Error('Referenced node "' + name + '" has no data'); return acc(nodes[name].map(j => ({ json: j }))); };
  const f = new AsyncFunction('$', '$execution', '$json', 'Date', 'URL', 'structuredClone', 'Object', '__OV', planCode());
  const out = await f($, { id: 'fxa' }, {}, PD, undefined, undefined, SOBJ, ov);
  return out.map(i => i.json);
}
const cellOf = (stage, x) => Object.assign({ stage, sub: '', basis: 'direct', n: 8, named: stage >= 'S4' ? 3 : 0, cited: stage >= 'S3' ? 3 : 0, retrieved: stage >= 'S2' ? 1 : 0, our_rank: null, evidence: [] }, x || {});
const fakeArd = (script) => () => ({
  market: () => ({ cc: 'AE', lang: 'en', location_code: 2784, second: null, conflicts: [], basis: 'scripted' }),
  corePanel: ({ prompts, now }) => ({ core: (prompts || []).filter(p => p.kind !== 'brand').map(p => ({ prompt_id: p.prompt_id, core_since: iso(now - 30 * DAY), core_until: iso(now + 26 * DAY), reason: 'scripted', intent: 'recommendation', baseline: 'zero', cluster: 'c' })), proposed: [], extend: [], comparable: true, why: 'scripted' }),
  diagnose: ({ prompt, site }) => { const st = (script.stages[site.site_id] || {})[prompt.prompt_id] || {}; const engines = {}; for (const [e, s] of Object.entries(st)) engines[e] = cellOf(s);
    return { prompt_id: prompt.prompt_id, intent: 'recommendation', engines, best_stage: 'S1', parametric_share: {}, no_search: [], list_dominated: !!script.listy, nobody_named: false, first_named_at: '', last_named_at: '', last_cited_at: '' }; },
  sources: ({ ourHosts }) => (script.sources || []).filter(s => !ourHosts.some(h => s.url.indexOf(h) >= 0) && (!s.site || ourHosts.includes(s.site))) });
const siteOf = (sid, dom, mode) => ({ site_id: sid, domain: dom, mode, run_id: 'air_x_' + sid, rank: { mode, reserve: false, fanout_n: 0, mentions: false, brave: false } });

module.exports = async (ctx) => {
  const { H, guard, begin } = ctx;
  await guard('air fx-a', async () => {
    const SN = 'AIR FX-A (2026-11-06, REVIEW_A_ALGO_STATS.md): RA-1 .. RA-18 fixed at the root, each with the review\'s own reproduction';
    begin(SN);
    const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
    const near = (a, b, t) => a != null && b != null && Math.abs(a - b) <= t;
    const { AVX, AIRF, ARD, ARL } = loadKits();
    const NOW = Date.parse('2026-11-02T10:00:00.000Z');

    // ================= FXA-1 (RA-1) + FXA-10 (RA-10): the plan's own outcome path, two sites, three weekly runs =================
    { const LIST = 'https://top-list.example/best-firms-uae'; const W0 = NOW - 35 * DAY, W1 = W0 + 7 * DAY;
      const A = { sid: 'site_aa-example', dom: 'aa.example' }, B = { sid: 'site_bb-example', dom: 'bb.example' };
      const prompts = (s) => ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].map(q => ({ prompt_id: s.sid + '_' + q, site_id: s.sid, domain: s.dom, prompt: 'Which firms in Dubai do ' + q + '?', kind: 'recommend', keyword: 'firms dubai ' + q, status: 'active', market: 'AE-en' }));
      const qid = (s, q) => s.sid + '_' + q;
      const storedQ = (s) => ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].map((q, i) => ({ site_id: s.sid, domain: s.dom, prompt_id: qid(s, q), core: true, core_since: iso(W0 - 30 * DAY), arm: i >= 4 ? 'control' : 'treated', stratum: 'recommendation|zero|c', arm_since: iso(W0 - 20 * DAY) }));
      const S1all = (s) => Object.fromEntries(['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].map(q => [qid(s, q), { chatgpt: 'S1', perplexity: 'S1' }]));
      const actionRow = (s) => ({ action_id: AIRF.actionId(s.sid, 'L08', { url: LIST }), site_id: s.sid, domain: s.dom, lever: 'L08', executor: 'approve', scope: 'page', ref: J({ url: LIST }), questions: J([qid(s, 'q1'), qid(s, 'q2')]), engines: J(['chatgpt', 'perplexity']),
        target_stage: 'S4', status: 'queued', sink: 'prospect', sink_ref: 'top-list.example', expected_json: J({ p: 0.06, gain: 0.01 }), prereg_json: J({ metric: 'named_rate', questions: [qid(s, 'q1'), qid(s, 'q2')], engines: ['chatgpt', 'perplexity'], controls: [qid(s, 'q5'), qid(s, 'q6')], window_days: 30, t0_rule: 'happened_at', projected: { p: 0.06, gain: 0.01 }, registered_at: iso(W0 - DAY), lever: 'L08', rule_version: AIRF.RULE_VERSION }),
        happened_at: '', verify_json: '', outcome_json: '', learned_at: '', mode: 'on', run_id: 'r0', created_at: iso(W0 - DAY), updated_at: iso(W0 - DAY) });
      const srcFor = (s, names, at) => ({ site: s.dom, url: LIST, url_key: AIRF.urlKey(LIST), host: 'top-list.example', page_type: 'listicle', author_kind: 'editorial', names_client: names, rivals_named: [], questions: [qid(s, 'q1'), qid(s, 'q2')], engines: ['chatgpt', 'perplexity'], cites_28d: 4, influence: 1, placeability: 0, placeability_why: 'test: not to be pitched again', contact_email: '', contact_url: '', from: 'answers', last_seen: at, checked_at: at, first_seen: iso(W0 - 60 * DAY) });
      const base = (now, script, stored) => ({ now, ov: { ard: fakeArd(script), units: () => [] }, nodes: { 'AI Rank Live': [siteOf(A.sid, A.dom, 'on'), siteOf(B.sid, B.dom, 'on')], 'Load AI Prompts': [...prompts(A), ...prompts(B)], 'Manual Run': [{}],
        'Load AI Rank Questions': [...storedQ(A), ...storedQ(B)], 'Load AI Rank Actions': stored.actions, 'Load AI Rank Runs': stored.runs, 'Load AI Rank Priors': stored.priors || [] } });
      // week 0: both sites read S1 everywhere; the run rows are what week 1 snapshots from
      const w0 = await runPlan(base(W0, { stages: { [A.sid]: S1all(A), [B.sid]: S1all(B) }, sources: [srcFor(A, false, iso(W0)), srcFor(B, false, iso(W0))] }, { actions: [actionRow(A), actionRow(B)], runs: [] }));
      const runRow = (p) => ({ site_id: p.site_id, domain: p.domain, run_id: p.run_id + '_' + p.air.checked_at, checked_at: p.air.checked_at, stages_json: J(p.air.stages), diag_json: J({ trimmed: true }) });
      const runsAfter0 = w0.map(runRow);
      // week 1: both lists now name the business (our fetch of 2 days ago): the actions happened; the stages at t0 are frozen from week 0's reading
      const t0 = W1 - 2 * DAY;
      const w1 = await runPlan(base(W1, { stages: { [A.sid]: S1all(A), [B.sid]: S1all(B) }, sources: [srcFor(A, true, iso(t0)), srcFor(B, true, iso(t0))] }, { actions: [actionRow(A), actionRow(B)], runs: runsAfter0 }));
      const rowOf = (out, s) => (out.find(x => x.site_id === s.sid).air.rows.actions || []).find(r => r.lever === 'L08');
      const a1 = rowOf(w1, A), b1 = rowOf(w1, B); const v1 = JSON.parse(a1.verify_json || '{}');
      check('FXA-1 RA-1: the first time our check finds the action done, the stages of its questions and controls are frozen in verify_json (from week 0\'s reading on file, not this week\'s)',
        a1 && a1.status === 'done' && a1.happened_at === iso(t0) && v1.t0_snapshot && /reading of/.test(v1.t0_snapshot.stages_basis) && J(Object.keys(v1.t0_snapshot.stages.q).sort()) === J([qid(A, 'q1'), qid(A, 'q2'), qid(A, 'q5'), qid(A, 'q6')].sort()),
        J({ a1: a1 && [a1.status, a1.happened_at], snap: v1.t0_snapshot }));
      // week 5: site A's two treated cells moved to S4 (named), its controls did not; site B moved nothing
      const W5 = t0 + 31 * DAY; const stA = S1all(A); stA[qid(A, 'q1')] = { chatgpt: 'S4', perplexity: 'S1' }; stA[qid(A, 'q2')] = { chatgpt: 'S4', perplexity: 'S1' };
      const keepRow = (r) => Object.assign({}, r);
      const w5 = await runPlan(base(W5, { stages: { [A.sid]: stA, [B.sid]: S1all(B) }, sources: [srcFor(A, true, iso(t0)), srcFor(B, true, iso(t0))] }, { actions: [keepRow(a1), keepRow(b1)], runs: [...runsAfter0, ...w1.map(runRow)] }));
      const oA = w5.find(x => x.site_id === A.sid).air, oB = w5.find(x => x.site_id === B.sid).air; const ocA = (oA.outcomes[0] || {}).outcome || {};
      const a5 = rowOf(w5, A); const gA = oA.priors.find(r => r.scope === 'global' && r.engine_group === 'chatgpt'), gB = oB.priors.find(r => r.scope === 'global' && r.engine_group === 'chatgpt');
      check('FXA-1 RA-1: at the end of the window the stage moves are read from the frozen stages (2 of 4 treated cells moved, controls 0 of 4: background 0) and a prior row is learned; learned_at is set',
        ocA.due === true && ocA.stage_moves && ocA.stage_moves.n === 4 && ocA.stage_moves.k === 2 && /snapshot/.test(ocA.stage_moves.stages_at_t0) && oA.priors.some(r => r.scope === A.sid && r.lever === 'L08') && a5 && !!a5.learned_at,
        J({ sm: ocA.stage_moves && [ocA.stage_moves.k, ocA.stage_moves.n, ocA.stage_moves.stages_at_t0], priors: oA.priors.map(r => r.prior_id), learned: a5 && a5.learned_at, why: ocA.why }));
      // RA-10: both sites learned the same key (L08 / S1 / chatgpt) in one run: ONE global row, the same in both items, holding both sites
      const ev = ARL.LEVERS.find(l => l.id === 'L08').prior;
      check('FXA-10 RA-10: two sites learning one key in one run give one global row, identical in both sites\' items, built from both (A 1 of 1 trial, B 0 of 1: alpha ' + (ev.mean * ev.n0 + 1).toFixed(2) + ', beta ' + ((1 - ev.mean) * ev.n0 + 1).toFixed(2) + ')',
        gA && gB && J(gA) === J(gB) && near(gA.alpha, ev.mean * ev.n0 + 1, 1e-6) && near(gA.beta, (1 - ev.mean) * ev.n0 + 1, 1e-6) && gA.n_outcomes === 2, J({ gA, gB }));
      // a done action with no stage at t0 on file (verified before snapshots existed, no reading near its start): nothing learned, learned_at stays empty
      const legacy = Object.assign(keepRow(a1), { verify_json: J({ happened: true, at: iso(t0), evidence: ['legacy'] }) });
      const w5b = await runPlan(base(W5, { stages: { [A.sid]: stA, [B.sid]: S1all(B) }, sources: [srcFor(A, true, iso(t0))] }, { actions: [legacy], runs: [] }));
      const a5b = rowOf(w5b, A); const ocB = ((w5b.find(x => x.site_id === A.sid).air.outcomes[0]) || {}).outcome || {};
      check('FXA-1 RA-1: with no stage at t0 on file the outcome reads no stage move and learned_at stays empty (an empty reading never burns it); ARL.learnable refuses n = 0',
        a5b && !a5b.learned_at && ocB.stage_moves && ocB.stage_moves.n === 0 && /none/.test(ocB.stage_moves.stages_at_t0) && w5b.find(x => x.site_id === A.sid).air.priors.length === 0
        && ARL.learnable({ action: { lever: 'L08', site_id: 's', status: 'verified' }, outcome: { due: true, verdict: 'cant_tell', stage_moves: { k: 0, n: 0, by: [] } }, happened: true }) === false, J({ a5b: a5b && a5b.learned_at, sm: ocB.stage_moves }));
      // RA-7 inside the same plan: a shadow row of the same action, registered 8 weeks ago, is chosen again once the site is on -> registered afresh
      const shadowRow = Object.assign(actionRow(A), { status: 'shadow', mode: 'shadow', prereg_json: JSON.stringify(Object.assign(JSON.parse(actionRow(A).prereg_json), { registered_at: iso(NOW - 56 * DAY) })), created_at: iso(NOW - 56 * DAY), updated_at: iso(NOW - 7 * DAY) });
      const srcP = Object.assign(srcFor(A, false, iso(NOW - DAY)), { placeability: 0.3, placeability_why: 'an editorial list', contact_email: 'ed@top-list.example' });
      const w7 = await runPlan({ now: NOW, ov: { ard: fakeArd({ stages: { [A.sid]: S1all(A) }, sources: [srcP] }), units: () => [] }, nodes: { 'AI Rank Live': [siteOf(A.sid, A.dom, 'on')], 'Load AI Prompts': prompts(A), 'Manual Run': [{}], 'Load AI Rank Questions': storedQ(A), 'Load AI Rank Actions': [shadowRow], 'Load AI Rank Runs': [] } });
      const r7 = (w7[0].air.rows.actions || []).find(r => r.action_id === shadowRow.action_id); const p7 = r7 ? JSON.parse(r7.prereg_json || '{}') : {};
      check('FXA-7 RA-7: a shadow row never carries its registration into on: the action chosen in its first on week is registered that week (and created then), so it cannot expire at once',
        r7 && r7.status === 'queued' && p7.registered_at === iso(NOW) && r7.created_at === iso(NOW) && !r7.happened_at, J({ r7: r7 && [r7.status, r7.created_at], p7: p7.registered_at, chosen: w7[0].air.chosen.map(a => a.action_id) }));
      const deadRow = Object.assign(actionRow(A), { status: 'not_happened', prereg_json: JSON.stringify(Object.assign(JSON.parse(actionRow(A).prereg_json), { registered_at: iso(NOW - 120 * DAY) })), outcome_json: J({ due: true, verdict: 'not_happened' }), created_at: iso(NOW - 120 * DAY) });
      const w8 = await runPlan({ now: NOW, ov: { ard: fakeArd({ stages: { [A.sid]: S1all(A) }, sources: [srcP] }), units: () => [] }, nodes: { 'AI Rank Live': [siteOf(A.sid, A.dom, 'on')], 'Load AI Prompts': prompts(A), 'Manual Run': [{}], 'Load AI Rank Questions': storedQ(A), 'Load AI Rank Actions': [deadRow], 'Load AI Rank Runs': [] } });
      const r8 = (w8[0].air.rows.actions || []).find(r => r.action_id === deadRow.action_id); const p8 = r8 ? JSON.parse(r8.prereg_json || '{}') : {};
      check('FXA-7 RA-7: an action that did not happen and is chosen again is a new attempt: new registration date and baseline, attempt 2, the first attempt kept as history',
        r8 && p8.registered_at === iso(NOW) && p8.attempt === 2 && (p8.previous || [])[0] && p8.previous[0].registered_at === iso(NOW - 120 * DAY) && p8.previous[0].status === 'not_happened' && !r8.outcome_json, J({ p8 }));
      const q7 = (w7[0].air.rows.questions || []).find(r => r.prompt_id === qid(A, 'q5'));
      check('FXA-2 RA-2: the question rows carry arm_since (when the question took its arm)', q7 && q7.arm === 'control' && q7.arm_since === iso(W0 - 20 * DAY), J(q7)); }

    // ================= FXA-2 (RA-2): the control arm over 52 weeks =================
    { const core = Array.from({ length: 30 }, (_, i) => ({ prompt_id: 'a' + String(i).padStart(2, '0'), intent: i % 2 ? 'recommendation' : 'informational', baseline: 'zero', cluster: 'k' + (i % 3) }));
      let stored = []; const minC = []; let lockViol = 0; const r = AVX.rng('fxa2'); const locks = new Map(); let rotations = 0;
      for (let w = 0; w <= 52; w++) { const now = NOW + w * 7 * DAY; const exposed = new Set(core.filter(() => r() < 0.15).map(c => c.prompt_id));
        const locked = new Set([...locks.entries()].filter(([, until]) => until > now).map(([q]) => q));
        const arms = ARD.assignArms({ core, stored, seed: 's', now, site_id: 's', holdout_days: 84, exposed, locked });
        const ctl = arms.filter(a => a.arm === 'control'); minC.push(ctl.length);
        for (const q of locked) if ((arms.find(a => a.prompt_id === q) || {}).arm !== 'control') lockViol++;
        const prev = new Map(stored.map(s => [s.prompt_id, s.arm])); rotations += arms.filter(a => prev.get(a.prompt_id) === 'control' && a.arm === 'treated').length;
        for (const c of ctl) if (r() < 0.2 && !locks.has(c.prompt_id)) locks.set(c.prompt_id, now + 45 * DAY);   // an action registers it as a control for 45 days
        stored = arms.map(a => ({ prompt_id: a.prompt_id, arm: a.arm, stratum: a.stratum, arm_since: a.assigned_at, core: true, core_since: iso(NOW) })); }
      check('FXA-2 RA-2: 30 core questions (2 intents x 3 clusters), stored back each week for 52 weeks: at least 10 controls every week (min ' + Math.min(...minC) + '), controls rotate (' + rotations + ' rotations), a locked control never becomes treated',
        Math.min(...minC) >= 10 && rotations >= 6 && lockViol === 0, J({ minC: [...new Set(minC)], rotations, lockViol }));
      // the production shape the review found: every arm treated after week 12, core_since the same for all -> refilled in one run
      const legacy = core.map(c => ({ prompt_id: c.prompt_id, arm: 'treated', stratum: '', core: true, core_since: iso(NOW - 100 * DAY) }));
      const re = ARD.assignArms({ core, stored: legacy, seed: 's', now: NOW, site_id: 's', exposed: new Set(['a00', 'a01']) });
      check('FXA-2 RA-2: a panel left with no control (all treated) is refilled to 10 controls in one run, never with a question a step worked on', re.filter(a => a.arm === 'control').length === 10 && !re.some(a => ['a00', 'a01'].includes(a.prompt_id) && a.arm === 'control'), J(re.filter(a => a.arm === 'control').map(a => a.prompt_id)));
      // a first core: all controls due the same week rotate one per stratum per run
      const first = ARD.assignArms({ core, stored: [], seed: 's', now: NOW, site_id: 's' }).map(a => ({ ...a, arm_since: a.assigned_at, core: true }));
      const at12 = ARD.assignArms({ core, stored: first, seed: 's', now: NOW + 84 * DAY, site_id: 's' }); const strata = new Set(first.map(a => a.stratum));
      const moved = at12.filter(a => first.find(x => x.prompt_id === a.prompt_id).arm === 'control' && a.arm === 'treated');
      check('FXA-2 RA-2: a first core\'s controls, all due in week 12, rotate one per stratum that week (' + moved.length + ' of 10, ' + strata.size + ' strata), each replaced in its stratum', moved.length === strata.size && at12.filter(a => a.arm === 'control').length === 10, J(moved)); }

    // ================= FXA-3 (RA-3): the null and the power of the question-level DiD =================
    const ENG = ['chatgpt', 'perplexity', 'ai_mode'];
    const panel = ({ seed, qt, qc, model, shift = 0.10, redraw = 0.05, lift = 0, t0 = NOW - 28 * DAY, pre = 28, post = 28, trend = 0 }) => { const r = AVX.rng(seed); const units = []; const T = [], C = [];
      for (let i = 0; i < qt + qc; i++) { const q = 'q' + i; (i < qt ? T : C).push(q); const base = 0.10 + 0.40 * r(); let u = 0; for (let k = 0; k < 12; k++) u += r(); const sh = model === 'shift' ? (u - 6) * shift : 0;
        for (const e of ENG) { let st = r() < base; for (let d = 0; d < pre + post; d++) { const at = t0 - pre * DAY + d * DAY + DAY / 2; const isPost = at > t0;
          let p = base + (isPost ? sh : 0) + (i < qt && isPost ? lift : 0) + (i < qt ? trend * (at - (t0 - pre * DAY)) / ((pre + post) * DAY) : 0); p = Math.min(0.98, Math.max(0, p));
          let named; if (model === 'sticky') { if (r() < redraw) st = r() < p; named = st; } else named = r() < p; units.push({ prompt_id: q, engine: e, named, cited: false, at: iso(at) }); } } }
      return { units, T, C, t0 }; };
    const judge = (p, lever, now) => ARL.outcome({ action_id: 'x', site_id: 's', lever: lever || 'L07', status: 'verified', happened_at: iso(p.t0), prereg: { registered_at: iso(p.t0 - DAY), metric: 'named_rate', questions: p.T, controls: p.C, engines: ENG, window_days: 28, t0_rule: 'happened_at' } }, { units60: p.units, diagNow: [], diagAtT0: [], arms: [], now: now || NOW });
    const rate = (o, NS) => { let k = 0; for (let s = 0; s < NS; s++) if (judge(panel(Object.assign({ seed: J(o) + s }, o))).verdict === 'likely_helped') k++; return k / NS; };
    { const rows = [['sticky answers (5% daily redraw), 1 / 10', { qt: 1, qc: 10, model: 'sticky' }], ['sticky, 10% redraw, 1 / 10', { qt: 1, qc: 10, model: 'sticky', redraw: 0.10 }], ['rate shifts N(0, .10) between periods, 1 / 10', { qt: 1, qc: 10, model: 'shift' }],
        ['sticky, 3 / 10', { qt: 3, qc: 10, model: 'sticky' }], ['shift .10, 3 / 10', { qt: 3, qc: 10, model: 'shift' }], ['sticky, 16 / 8', { qt: 16, qc: 8, model: 'sticky' }], ['independent, 16 / 8', { qt: 16, qc: 8, model: 'indep' }]];
      const got = rows.map(([lab, o]) => [lab, rate(o, 200)]);
      check('FXA-3 RA-3: zero lift on panels with correlated answers - false "likely helped" <= 5% of 200 panels in every row (' + got.map(([l, x]) => l + ' ' + (100 * x).toFixed(1) + '%').join('; ') + ')', got.every(([, x]) => x <= 0.05), J(got));
      const pw = rate({ qt: 16, qc: 8, model: 'indep', lift: 0.25 }, 60);
      check('FXA-3 RA-3: an injected +25 point lift on 16 / 8 questions is still found in >= 90% of 60 panels (' + (100 * pw).toFixed(1) + '%)', pw >= 0.9, pw);
      const p3 = panel({ seed: 'few', qt: 1, qc: 3, model: 'indep', lift: 0.5 }); const o3 = judge(p3);
      check('FXA-3 RA-3: one worked-on question against 3 held-back ones is not a valid comparison ("can\'t tell", at least 4 needed), whatever it moved', o3.verdict === 'cant_tell' && /at least 4 held-back/.test(o3.why), J({ v: o3.verdict, why: o3.why })); }

    // ================= FXA-4 (RA-4): exposure, one move one action, L13 / L14, site-wide =================
    { const cellS1 = (x) => Object.assign({ stage: 'S1', sub: '', basis: 'direct', n: 8, named: 0, cited: 0, retrieved: 0, our_rank: null, evidence: [] }, x || {});
      const dg = (q) => ({ prompt_id: q, intent: 'recommendation', engines: { chatgpt: cellS1(), perplexity: cellS1(), ai_mode: cellS1() }, best_stage: 'S1', parametric_share: {}, no_search: [], list_dominated: false, nobody_named: false });
      const Qs = ['q1', 'q2', 'q3', 'c1', 'c2', 'c3']; const site = { site_id: 's4', domain: 's4.example', prompts: Qs.map(q => ({ prompt_id: q, keyword: 'kw ' + q, market: 'AE-en' })), pages: [{ url: 'https://s4.example/q1', questions: 'q1' }] };
      const arms = Qs.map(q => ({ prompt_id: q, arm: q[0] === 'c' ? 'control' : 'treated', stratum: 'x' }));
      const sources = [{ url: 'https://lists.example/best', page_type: 'listicle', author_kind: 'editorial', names_client: false, questions: ['q1', 'c1', 'c2'], engines: ['chatgpt', 'perplexity'], placeability: 0.3, contact_email: 'e@lists.example' },
        { url: 'https://forum.example/t/abc/1', page_type: 'community', author_kind: 'community', names_client: false, questions: ['c3'], engines: ['perplexity'], placeability: 0.3 }];
      const cands = ARL.candidates({ site, diag: Qs.map(dg), sources, arms, now: NOW });
      const sc = cands.map(c => Object.assign({}, c, { scored: ARL.score(c, { priors: [], values: new Map(Qs.map(q => [q, { V: 1 }])), feas: new Map(Qs.map(q => [q, { F: 0.5 }])) }) }));
      const ch = ARL.choose(sc, { arms, mode: 'shadow', open_actions: [], now: NOW, units60: [], capacities: { min_efficiency: 0 } });
      const l08 = ch.chosen.find(a => a.lever === 'L08'), own = ch.chosen.find(a => ['L05', 'L06'].includes(a.lever) && a.questions[0] === 'q1');
      // at outcome time the list (an executed step, open) has worked on c1 and c2 during the own page's window: the own page's DiD controls are c3 only
      const exposure = [{ action_id: l08.action_id, lever: 'L08', questions: l08.questions, from: iso(NOW - 40 * DAY), to: '' }];
      const act = { action_id: own.action_id, site_id: 's4', lever: own.lever, status: 'verified', happened_at: iso(NOW - 30 * DAY), prereg: Object.assign({}, own.prereg, { controls: ['c1', 'c2', 'c3'], t0_rule: 'happened_at', window_days: 28 }) };
      const oc = ARL.outcome(act, { units60: [], diagNow: Qs.map(dg), diagAtT0: Qs.map(dg), arms, now: NOW, exposure });
      check('FXA-4 RA-4: the review\'s case - a list cited for q1, c1, c2 and a refresh on q1 the same week: at outcome time the refresh\'s controls are c3 only (c1, c2 left out, named in controls_dropped; the registration untouched)',
        l08 && own && J(oc.controls_used) === J(['c3']) && J(oc.controls_dropped.map(x => x.prompt_id)) === J(['c1', 'c2']) && J(act.prereg.controls) === J(['c1', 'c2', 'c3']), J({ chosen: ch.chosen.map(a => [a.lever, a.questions, a.prereg.controls]), used: oc.controls_used, dropped: oc.controls_dropped }));
      check('FXA-4 RA-4: chosen in the same week after the list, a step\'s pre-registered controls already leave out the questions the list works on', ch.chosen.filter(a => a.action_id !== l08.action_id && a.prereg.controls.length).every(a => !a.prereg.controls.some(q => l08.questions.includes(q)) || ch.chosen.indexOf(a) < ch.chosen.indexOf(l08)), J(ch.chosen.map(a => [a.lever, a.prereg.controls])));
      // one move teaches one action: two overlapping actions on the same moved cell -> one success, not two
      const mk = (id, lever, t0d) => ({ action: { action_id: id, site_id: 'sx', lever, status: 'verified', learned_at: '' }, happened: true, outcome: { due: true, verdict: 'cant_tell', t0: iso(NOW - t0d * DAY), window_days: 30,
        stage_moves: { k: 1, n: 1, b: 0, by: [{ stage: 'S1', prior_stage: 'S1', group: 'chatgpt', n: 1, k: 1, b: 0, b_basis: 'control cells, same stage and engine group (0 of 4)' }], cells: [{ prompt_id: 'q1', engine: 'chatgpt', group: 'chatgpt', from: 'S1', target: 'S4', now: 'S4', reached: true }] } } });
      const both = ARL.learn({ priors: [], outcomes: [mk('a_list', 'L08', 40), mk('a_page', 'L06', 35)], now: NOW });
      const k08 = both.find(r => r.prior_id === 'L08:S1:chatgpt:sx'), k06 = both.find(r => r.prior_id === 'L06:S1:chatgpt:sx');
      check('FXA-4 RA-4: two overlapping actions on the same moved cell add ONE success (the earlier one, L08), not two; the later one teaches nothing from it',
        k08 && near(k08.alpha - k08.prior_alpha, 1, 1e-9) && !k06, J(both.map(r => [r.prior_id, r.alpha, r.prior_alpha])));
      // L13 / L14 are targeted: they get controls and can be learned; the uniform site-wide steps are judged by the interrupted time series and never learned
      const l13 = cands.find(c => c.lever === 'L13'); const p13 = ARL.prereg(Object.assign({}, l13, { intent: 'recommendation' }), { arms, now: NOW });
      check('FXA-4 RA-4: a community answer (L13) acts on the questions its threads are cited for: scope page, controls registered (the held-back questions it does not touch), learnable; an earned mention (L11) is site-wide, not learnable',
        l13 && l13.scope === 'page' && p13.controls.length > 0 && !p13.controls.includes('c3') && ARL.SITE_WIDE.indexOf('L13') < 0 && ARL.SITE_WIDE.includes('L11')
        && ARL.learnable({ action: { lever: 'L13', site_id: 's', status: 'verified' }, outcome: { due: true, verdict: 'cant_tell', stage_moves: { k: 1, n: 2, by: [{ stage: 'S1', group: 'perplexity', n: 2, k: 1 }] } }, happened: true }) === true
        && ARL.learnable({ action: { lever: 'L11', site_id: 's', status: 'verified' }, outcome: { due: true, verdict: 'cant_tell', stage_moves: { k: 1, n: 2, by: [{ stage: 'S1', group: 'perplexity', n: 2, k: 1 }] } }, happened: true }) === false, J({ l13: l13 && [l13.scope, l13.questions], c: p13.controls }));
      const pS = panel({ seed: 'its', qt: 12, qc: 0, model: 'indep', lift: 0.3, pre: 56 }); const oS = ARL.outcome({ action_id: 'l11', site_id: 's', lever: 'L11', status: 'verified', happened_at: iso(pS.t0), prereg: { registered_at: iso(pS.t0 - DAY), metric: 'stage', questions: pS.T, controls: [], engines: ENG, window_days: 60, t0_rule: 'happened_at' } }, { units60: pS.units, diagNow: [], arms: [], now: pS.t0 + 61 * DAY });
      const pS0 = panel({ seed: 'its0', qt: 12, qc: 0, model: 'indep', lift: 0, pre: 56 }); const oS0 = ARL.outcome({ action_id: 'l11', site_id: 's', lever: 'L11', status: 'verified', happened_at: iso(pS0.t0), prereg: { registered_at: iso(pS0.t0 - DAY), metric: 'stage', questions: pS0.T, controls: [], engines: ENG, window_days: 60, t0_rule: 'happened_at' } }, { units60: pS0.units, diagNow: [], arms: [], now: pS0.t0 + 61 * DAY });
      check('FXA-4 RA-4: a site-wide step (L11) is judged by an interrupted time series against the questions\' own trend: a +30 point move reads "likely helped" with its range, no move does not; neither is learned',
        oS.primary === 'its' && oS.its && oS.its.effect > 15 && oS.verdict === 'likely_helped' && oS0.verdict !== 'likely_helped' && /own trend/.test(oS.why), J({ its: oS.its, v: oS.verdict, v0: oS0.verdict, its0: oS0.its })); }

    // ================= FXA-5 (RA-5) and FXA-6 (RA-6): pooling =================
    { const oc = (id, n, k) => ({ action: { action_id: id, site_id: 'site_one', lever: 'L06', status: 'verified', learned_at: '' }, happened: true,
        outcome: { due: true, verdict: 'cant_tell', stage_moves: { k, n, b: 0, by: [{ stage: 'S1', group: 'google', n, k, b: 0, b_basis: 'control cells, same stage and engine group (0 of 10)' }], cells: [] } } });
      const outs = Array.from({ length: 30 }, (_, i) => oc('a' + i, 10, i < 12 ? 1 : 0));   // 12 cells of 300 reached (4%)
      const g = ARL.learn({ priors: [], outcomes: outs, now: NOW }).find(r => r.scope === 'global'); const mean = g.alpha / (g.alpha + g.beta);
      const pB = ARL.priorOf({ lever: 'L06', stage: 'S1', group: 'google', priors: ARL.learn({ priors: [], outcomes: outs, now: NOW }), site_id: 'site_two' });
      check('FXA-5 RA-5: a site at 4% (12 of 300 cells, 30 actions) moves the pool toward 4%, keeping its rate: global mean ' + mean.toFixed(3) + ' between 0.04 and the evidence prior 0.25 (was 0.442), another site plans with ' + pB.mean.toFixed(3),
        mean > 0.04 && mean < 0.25 && near(mean, 0.08, 0.02) && pB.mean < 0.25, J(g)); }
    { const one = { action: { action_id: 'big', site_id: 'site_a', lever: 'L08', status: 'verified', learned_at: '' }, happened: true,
        outcome: { due: true, verdict: 'cant_tell', stage_moves: { k: 30, n: 30, b: 0, by: [{ stage: 'S1', group: 'google', n: 30, k: 30, b: 0, b_basis: 'control cells, same stage and engine group (0 of 10)' }], cells: [] } } };
      const rows = ARL.learn({ priors: [], outcomes: [one], now: NOW }); const before = ARL.priorOf({ lever: 'L08', stage: 'S1', group: 'google', priors: [], site_id: 'site_b' }).mean, after = ARL.priorOf({ lever: 'L08', stage: 'S1', group: 'google', priors: rows, site_id: 'site_b' }).mean;
      check('FXA-6 RA-6: one placement whose 30 cells all moved is one trial: site B\'s L08 prior moves ' + before.toFixed(3) + ' -> ' + after.toFixed(3) + ' (one pseudo-outcome on n0 8: about 0.164; was 0.582)', near(before, 0.06, 1e-9) && near(after, 1.48 / 9, 0.005), J(rows)); }

    // ================= FXA-8 (RA-8): the before-period frozen at t0 =================
    { // a 60-day window (L10): the outcome is read at t0 + 65 with only 60 days of answers loaded: its own before-period is gone, the snapshot keeps it
      const p = panel({ seed: 'l10', qt: 4, qc: 10, model: 'indep', lift: 0.3, t0: NOW - 65 * DAY, pre: 56, post: 65 });
      const act = { action_id: 'l10', site_id: 's', lever: 'L10', status: 'done', prereg: { registered_at: iso(p.t0 - 10 * DAY), metric: 'named_rate', questions: p.T, controls: p.C, engines: ENG, window_days: 60, t0_rule: 'happened_at' } };
      const within = (u, a, b) => { const t = Date.parse(u.at); return t > a && t <= b; };
      const atVerify = p.t0 + 5 * DAY; const snap = ARL.snapshotT0(act, { t0: p.t0, readings: [], diagNow: [], units: p.units.filter(u => within(u, atVerify - 60 * DAY, atVerify)), now: atVerify });
      const late = p.units.filter(u => within(u, NOW - 60 * DAY, NOW));
      const withSnap = ARL.outcome(Object.assign({}, act, { happened_at: iso(p.t0) }), { units60: late, diagNow: [], arms: [], now: NOW, verified: { happened: true, at: iso(p.t0), t0_snapshot: snap } });
      const noSnap = ARL.outcome(Object.assign({}, act, { happened_at: iso(p.t0) }), { units60: late, diagNow: [], arms: [], now: NOW, verified: { happened: true, at: iso(p.t0) } });
      check('FXA-8 RA-8: a 60-day window (L10) read at t0 + 65 days with 60 days of answers: the DiD is computed from the before-period frozen at verification (' + (withSnap.did && withSnap.did.effect) + ' points, verdict ' + withSnap.verdict + '); without it, it cannot be',
        withSnap.did && withSnap.did.effect != null && withSnap.verdict === 'likely_helped' && noSnap.did && noSnap.did.effect == null, J({ w: withSnap.did, n: noSnap.did && noSnap.did.why, cov: withSnap.coverage })); }
    { // the pre-trend through AI_Rank_Plan's own call: 150 days of history, treated questions climbing steadily; verified 3 days after t0, read at t0 + 31
      const T = ['t1', 't2', 't3', 't4', 't5', 't6'], C = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']; const sid = 'site_pt-example', dom = 'pt.example'; const t0 = NOW - 31 * DAY; const r = AVX.rng('pretrend');
      const units = []; for (const q of [...T, ...C]) { const base = 0.1 + 0.2 * r(); for (const e of ENG) for (let d = 0; d < 150; d++) { const at = NOW - 150 * DAY + d * DAY + DAY / 2; const p = T.includes(q) ? Math.min(0.95, base + 0.7 * d / 150) : base; units.push({ prompt_id: q, engine: e, named: r() < p, cited: false, at: iso(at) }); } }
      const prompts = [...T, ...C].map(q => ({ prompt_id: q, site_id: sid, domain: dom, prompt: 'Which firms do ' + q + '?', kind: 'recommend', keyword: 'kw ' + q, status: 'active', market: 'AE-en' }));
      const sq = [...T, ...C].map(q => ({ site_id: sid, prompt_id: q, core: true, arm: C.includes(q) ? 'control' : 'treated', stratum: 'x', arm_since: iso(NOW - 40 * DAY) }));
      const LIST = 'https://lists2.example/top'; const row = { action_id: AIRF.actionId(sid, 'L08', { url: LIST }), site_id: sid, domain: dom, lever: 'L08', executor: 'approve', scope: 'page', ref: J({ url: LIST }), questions: J(T), engines: J(ENG), status: 'queued', sink: 'prospect', mode: 'on',
        prereg_json: J({ metric: 'named_rate', questions: T, engines: ENG, controls: C, window_days: 28, t0_rule: 'happened_at', registered_at: iso(t0 - 5 * DAY), lever: 'L08' }), created_at: iso(t0 - 5 * DAY), happened_at: '', verify_json: '', outcome_json: '', learned_at: '' };
      const src = (at) => ({ site: dom, url: LIST, page_type: 'listicle', author_kind: 'editorial', names_client: true, questions: T, engines: ENG, placeability: 0, checked_at: iso(at), last_seen: iso(at) });
      const stages = { [sid]: Object.fromEntries([...T, ...C].map(q => [q, { chatgpt: 'S1', perplexity: 'S1', ai_mode: 'S1' }])) };
      const nodes = (actions) => ({ 'AI Rank Live': [siteOf(sid, dom, 'on')], 'Load AI Prompts': prompts, 'Manual Run': [{}], 'Load AI Rank Questions': sq, 'Load AI Rank Actions': actions, 'Load AI Rank Runs': [] });
      const ov = { ard: fakeArd({ stages, sources: [src(t0)] }), units: (o) => units.filter(u => u.at >= o.from && u.at < o.to) };
      const v = await runPlan({ now: t0 + 3 * DAY, ov, nodes: nodes([row]) }); const rv = v[0].air.rows.actions.find(x => x.action_id === row.action_id);
      const e = await runPlan({ now: t0 + 31 * DAY, ov, nodes: nodes([rv]) }); const oc = (e[0].air.outcomes[0] || {}).outcome || {};
      check('FXA-8 RA-8: through AI_Rank_Plan\'s own call, questions that were already climbing read "can\'t tell" (the placebo on the 28 days before t0 against the 28 before that, frozen at verification), not "likely helped"',
        oc.due && oc.did && oc.did.lo > 0 && oc.placebo && oc.placebo.effect != null && /28 before that/.test(oc.placebo.kind) && oc.verdict === 'cant_tell' && /already moving/.test(oc.why), J({ did: oc.did && [oc.did.effect, oc.did.lo], placebo: oc.placebo && [oc.placebo.effect, oc.placebo.p_one, oc.placebo.kind], v: oc.verdict, why: oc.why })); }
    { // short history: no 28 days before the before-period -> the halves of the 28 days before; said in the outcome
      const p = panel({ seed: 'short', qt: 6, qc: 8, model: 'indep', lift: 0.25 }); const o = judge(p);
      check('FXA-8 RA-8: with only the 28 days before t0 on file the placebo uses its two halves (short history), computed, never silently missing', o.placebo && o.placebo.effect != null && /halves/.test(o.placebo.kind) && o.placebo.scale === 2, J(o.placebo)); }

    // ================= FXA-9 (RA-9): compact stages, a 30-question memo against last week =================
    { const EN = ['chatgpt', 'gemini', 'ai_mode', 'ai_overview', 'perplexity', 'claude', 'copilot', 'chatgpt_api']; const big = (shift) => Array.from({ length: 30 }, (_, i) => ({ prompt_id: 'b' + i, intent: 'recommendation',
        engines: Object.fromEntries(EN.map((e, j) => [e, { stage: ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'][(i + j + shift) % 6], sub: '', basis: 'direct', n: 8, named: 2, cited: 1, retrieved: 1, our_rank: null, evidence: [{ kind: 'answer', what: 'x'.repeat(200) }] }])), best_stage: 'S1', parametric_share: {}, no_search: [], list_dominated: false, nobody_named: false }));
      const prev = big(0), cur = big(0).map((d, i) => i < 3 ? Object.assign({}, d, { engines: Object.assign({}, d.engines, { chatgpt: Object.assign({}, d.engines.chatgpt, { stage: 'S5' }) }) }) : d);
      // the run row builder, the generated node, on a plan item with this diagnosis
      const rowJs = wfNode('AI Rank Run Row'); const item = { site_id: 's9', domain: 's9.example', mode: 'shadow', run_id: 'r9', air: { diag: prev, stages: ARL.stagesPack(prev), candidates: Array.from({ length: 60 }, (_, i) => ({ id: i, why: 'y'.repeat(300) })), sources: [], memo: {}, outcomes: [], learn: [] } };
      const rows = new Function('$', '$execution', 'Date', rowJs)((n) => ({ all: () => [{ json: item }] }), { id: 'e9' }, Date).map(i => i.json);
      const rr = rows[0]; const back = ARL.stagesUnpack(rr.stages_json);
      const me = ARL.memo({ site: { site_id: 's9' }, diagNow: cur, diagPrev: back, chosen: [], open: [], outcomes: [], mode: 'shadow' }); const txt = me.parts[0].lines.map(l => l.text).join(' | ');
      check('FXA-9 RA-9: a 30-question run row trims the full diagnosis (' + String(rr.diag_json).slice(0, 30) + '...) but keeps stages_json (' + String(rr.stages_json).length + ' characters); next week\'s memo compares with it and lists the moved cells',
        /trimmed/.test(rr.diag_json) && String(rr.stages_json).length < 15000 && back.length === 30 && /last week/.test(txt) && /Question b0 on ChatGPT: up/.test(txt) && !/first reading/.test(txt), txt.slice(0, 400)); }

    // ================= FXA-11 (RA-11): the figure of the test that is run =================
    { const one = ARD.mde({ q_t: 1, q_c: 10, m: 28, p: 0.05, rho: 0.3 }); const panelM = ARD.mde({ q_t: 20, q_c: 10, m: 28, p: 0.05, rho: 0.3 });
      const me = ARL.memo({ site: { site_id: 's' }, diagNow: [], diagPrev: [], chosen: [], open: [], outcomes: [], mde: Object.assign({}, panelM, { one_question: one, page_level: ARD.mde({ q_t: 3, q_c: 10, m: 28, p: 0.05, rho: 0.3 }), page_level_q: 3 }), mode: 'shadow' });
      const det = me.parts.find(p => p.key === 'detectable').lines.map(l => l.text).join(' | ');
      const planSrc = rdf('AI_Rank_Plan.js');
      check('FXA-11 RA-11: the memo leads with the one-question figure (' + one.did + ' points, about 52) before the panel figure (' + panelM.did + '); the plan measures m over 28 days on the core and passes one_question',
        one.did > 45 && one.did < 60 && det.indexOf(String(one.did)) >= 0 && det.indexOf(String(one.did)) < det.indexOf(String(panelM.did)) && /one first appearance can never be shown/.test(det) && /28 \* DAY/.test(planSrc) && /one_question/.test(planSrc), det); }

    // ================= FXA-12 (RA-12): one alpha, the false discovery rate over a quarter =================
    { let total = 0; const REP = 6;
      for (let rep = 0; rep < REP; rep++) { const outs = []; for (let i = 0; i < 50; i++) { const qt = 1 + (i % 3); const p = panel({ seed: 'fdr' + rep + '_' + i, qt, qc: 10, model: 'sticky' }); outs.push({ action: { action_id: 'n' + rep + '_' + i }, outcome: judge(p) }); }
        ARL.fdr({ outcomes: outs, judged: [], now: NOW }); total += outs.filter(o => o.outcome.verdict === 'likely_helped').length; }
      check('FXA-12 RA-12: 50 null actions judged in one quarter give on average ' + (total / REP).toFixed(2) + ' "likely helped" after the false discovery rate (<= 1)', total / REP <= 1, total);
      const p8 = panel({ seed: 'fa8', qt: 16, qc: 8, model: 'indep' }); for (const u of p8.units) u.named = false; const app = new Set(p8.T.slice(0, 7)); for (const u of p8.units) if (app.has(u.prompt_id) && Date.parse(u.at) > p8.t0 && Date.parse(u.at) < p8.t0 + 5 * DAY) u.named = true;
      const o7 = judge(p8);
      check('FXA-12 RA-12: one alpha for every test: 7 of 16 first appearances against 0 of 8 (Fisher p 0.033) no longer reads "likely helped" (one-sided 0.025, as the DiD)', o7.primary === 'fisher' && o7.verdict === 'cant_tell' && o7.alpha === 0.025 && /0\.025 needed/.test(o7.why), J({ fa: o7.first_appearance, v: o7.verdict }));
      const me = ARL.memo({ site: { site_id: 's' }, diagNow: [], chosen: [], open: [], outcomes: [{ action: { lever: 'L07', prereg: { projected: { p: 0.3 } } }, outcome: Object.assign(judge(panel({ seed: 'm', qt: 3, qc: 10, model: 'indep' })), { fdr: { m: 12, q_value: 0.5, alpha: 0.025, basis: 'test' } }) }], mode: 'on' });
      check('FXA-12 RA-12: the memo says how many actions were judged in the quarter and how many "likely helped" chance alone would give', /12 action\(s\) were judged/.test(me.parts.find(p => p.key === 'projected_vs_real').lines.map(l => l.text).join(' ')), ''); }

    // ================= FXA-13 (RA-13): the results page of the question's market only =================
    { const FX = require('./fixtures_air'); const DC = FX.make({ diag_cases: true }).diag_cases; const c = DC.find(x => x.label.stage === 'S2' && x.label.basis === 'proxy_rank' && x.engine === 'ai_mode');
      const relabel = (loc) => { const m = new Map(); for (const [k, v] of (c.args.serp instanceof Map ? c.args.serp : new Map(Object.entries(c.args.serp || {})))) m.set(k, Object.assign({}, v, { location_code: loc })); return m; };
      const us = ARD.diagnose(Object.assign({}, c.args, { serp: relabel(2840) })).engines.ai_mode, ae = ARD.diagnose(Object.assign({}, c.args, { serp: relabel(2784) })).engines.ai_mode;
      const both = new Map([...relabel(2840).entries()].map(([k, v]) => [k, Object.assign({}, v, { by_loc: { 2840: v, 2784: Object.assign({}, v, { location_code: 2784 }) } })]));
      const usOnly = new Map([...relabel(2840).entries()].map(([k, v]) => [k, Object.assign({}, v, { by_loc: { 2840: v } })]));
      const bl = ARD.diagnose(Object.assign({}, c.args, { serp: both })).engines.ai_mode, bu = ARD.diagnose(Object.assign({}, c.args, { serp: usOnly })).engines.ai_mode;
      check('FXA-13 RA-13: a UAE question (AE-en) is not given S2 from a US results page (2840): ' + us.stage + ' / ' + us.basis + '; with the UAE reading (2784) it is S2 proxy_rank; the plan\'s per-location map picks the 2784 reading',
        c && !(us.stage === 'S2' && us.basis === 'proxy_rank') && ae.stage === 'S2' && ae.basis === 'proxy_rank' && bl.stage === 'S2' && !(bu.stage === 'S2' && bu.basis === 'proxy_rank'), J({ us, ae: [ae.stage, ae.basis], bl: [bl.stage, bl.basis], bu: [bu.stage, bu.basis] })); }

    // ================= FXA-14 (RA-14): screening own pages =================
    { const s1 = ARL.screenOwnPage({ keyword: 'best erp partners dubai', question: 'Who are the best ERP partners in Dubai?', fanouts: ['top erp companies uae'] }), s2 = ARL.screenOwnPage({ keyword: 'erp pricing', question: 'AI-only summary page for erp' }), s3 = ARL.screenOwnPage({ keyword: 'erp implementation cost' });
      const site = { site_id: 's14', domain: 's14.example', prompts: [{ prompt_id: 'q1', keyword: 'best software companies dubai', market: 'AE-en' }] };
      const d = [{ prompt_id: 'q1', intent: 'recommendation', engines: { chatgpt: { stage: 'S1', sub: '', basis: 'direct', n: 8 }, ai_mode: { stage: 'S1', sub: '', basis: 'direct', n: 8 } }, list_dominated: true, no_search: [] }];
      const planSrc = rdf('AI_Rank_Plan.js');
      check('FXA-14 RA-14: an own page for a "best X companies" question is written as an honest comparison (R01: page type Comparison Page, "never a self-ranked list" in the writer\'s brief); an AI-only page is refused (R02); a plain keyword passes; the plan screens every chosen own page before any sink',
        !s1.refused && s1.page_type === 'Comparison Page' && /never a self-ranked list/.test(s1.note) && s2.refused && s2.refused.id === 'R02' && !s3.page_type && !s3.refused
        && /screenOwnPage/.test(planSrc) && /a\.screen && a\.screen\.page_type/.test(planSrc) && ARL.candidates({ site, diag: d, sources: [], arms: [], now: NOW }).some(c => c.lever === 'L05'), J({ s1, s2, s3 })); }

    // ================= FXA-15 (RA-15): answers from memory =================
    { const d = [{ prompt_id: 'q1', intent: 'recommendation', engines: { chatgpt: { stage: 'S1', sub: '', basis: 'direct', n: 8 } }, no_search: ['chatgpt'], list_dominated: false }];
      const cs = ARL.candidates({ site: { site_id: 's', domain: 'n.example' }, diag: d, sources: [], arms: [], now: NOW }); const ctx = { priors: [], values: new Map([['q1', { V: 1 }]]), feas: new Map([['q1', { F: 0.5 }]]) };
      const l11 = cs.find(c => c.lever === 'L11'), l12 = cs.find(c => c.lever === 'L12');
      check('FXA-15 RA-15: a no-search ChatGPT cell gives LinkedIn (L12) nothing and an earned mention (L11) half its gain (0.00054, was 0.00108)', l11 && near(ARL.score(l11, ctx).gain, 0.00054, 1e-6) && (!l12 || !l12.cells.some(x => x.engine === 'chatgpt')), J({ l11: l11 && ARL.score(l11, ctx).gain, l12: l12 && l12.cells })); }

    // ================= FXA-16 (RA-16): expiry =================
    { const URL1 = 'https://lists.example/top'; const a = { action_id: 'e', site_id: 's', lever: 'L08', status: 'queued', ref: { url: URL1 }, prereg: { registered_at: iso(NOW - 50 * DAY), window_days: 30, t0_rule: 'happened_at' } };
      const v = ARL.verify(a, { sources: [{ url: URL1, names_client: true, checked_at: iso(NOW - DAY) }], now: NOW }); const v2 = ARL.verify(a, { sources: [{ url: URL1, names_client: false, checked_at: iso(NOW - DAY) }], now: NOW });
      const v3 = ARL.verify(Object.assign({}, a, { prereg: { registered_at: iso(NOW - 110 * DAY), window_days: 30 } }), { sources: [], now: NOW });
      check('FXA-16 RA-16: a list registered 50 days ago that now names the business is verified (not expired at day 44); a list still waiting at day 50 is not expired (L08 waits 90 + 14 days); at day 110 it is', v.happened === true && v2.happened === false && v2.expired === false && v3.expired === true && ARL.expiryDays('L08', {}) === 104, J({ v, v2, v3 })); }

    // ================= FXA-17 (RA-17): one directory, one candidate =================
    { const d = ['q1', 'q2'].map(q => ({ prompt_id: q, intent: 'recommendation', engines: { perplexity: { stage: 'S1', sub: '', basis: 'direct', n: 8 } }, no_search: [] }));
      const cs = ARL.candidates({ site: { site_id: 's', domain: 'd.example' }, diag: d, sources: [{ url: 'https://clutch.co/ae/it-services', page_type: 'directory', author_kind: 'platform', names_client: false, questions: ['q1'], engines: ['perplexity'], placeability: 0.8 }, { url: 'https://clutch.co/ae/developers/erp', page_type: 'directory', author_kind: 'platform', names_client: false, questions: ['q2'], engines: ['perplexity'], placeability: 0.8 }], arms: [], now: NOW });
      const l9 = cs.filter(c => c.lever === 'L09');
      check('FXA-17 RA-17: two cited pages of one directory make one L09 candidate with both questions (q1, q2) and both URLs', l9.length === 1 && J(l9[0].questions) === J(['q1', 'q2']) && (l9[0].page_urls || []).length === 2, J(l9.map(c => [c.questions, c.page_urls]))); }

    // ================= FXA-19 (FX-A2, FX-C RC-3): the client's address for L11-L15 / L17 =================
    { const REG = NOW - 10 * DAY; const act = (lever, cu) => ({ action_id: 'c_' + lever, site_id: 's', lever, status: 'queued', mode: 'on', client_url: cu, prereg: { registered_at: iso(REG), window_days: 60, t0_rule: 'happened_at' } });
      const src = (u, names, at) => ({ url: u, names_client: names, checked_at: iso(at), last_seen: iso(at), source_from: 'client' });
      const U = 'https://press.example/news/story'; const ok = ARL.verify(act('L11', U), { sources: [src(U, true, NOW - 2 * DAY)], now: NOW });
      const stale = ARL.verify(act('L11', U), { sources: [src(U, true, REG - 3 * DAY)], now: NOW }), notNamed = ARL.verify(act('L11', U), { sources: [src(U, false, NOW - DAY)], now: NOW }), none = ARL.verify(act('L12', ''), { sources: [], now: NOW });
      const unsafe = ['http://press.example/a', 'https://user:pw@press.example/a', 'https://10.0.0.7/a', 'https://[::1]/a', 'https://intranet.local/a', 'https://press.example:8443/a'].map(u => ARL.verify(act('L13', u), { sources: [src(u, true, NOW - DAY)], now: NOW }));
      const wd = ARL.verify(act('L17', 'https://www.wikidata.org/wiki/Q1234'), { sources: [src('https://www.wikidata.org/wiki/Q1234', true, NOW - DAY)], now: NOW }), notWd = ARL.verify(act('L17', U), { sources: [src(U, true, NOW - DAY)], now: NOW });
      const own = 'https://c.example/corrections'; const l15 = ARL.verify(act('L15', own), { pages: [{ url: own, status: 200, checked_at: iso(NOW - DAY) }], now: NOW }), l15old = ARL.verify(act('L15', own), { pages: [{ url: own, status: 200, checked_at: iso(REG - 5 * DAY) }], now: NOW }), l15dead = ARL.verify(act('L15', own), { pages: [{ url: own, status: 404, checked_at: iso(NOW - DAY) }], now: NOW });
      check('FXA-19 FX-A2: an earned mention (L11) is verified from the address the client pasted only when our fetch read it live after the step was asked and found the business named; a stale read, a page not naming it, or no address is not',
        ok.happened === true && ok.at === iso(NOW - 2 * DAY) && stale.happened === false && notNamed.happened === false && none.happened === false && /paste it on the step/.test(none.evidence[0]), J({ ok, stale, notNamed, none }));
      check('FXA-19 FX-A2: the address must pass the safe fetcher\'s rules: http, credentials, an IP literal (v4 or v6), a private host and an odd port are each refused, whatever the source row says; an entity step (L17) needs a Wikidata item',
        unsafe.every(v => v.happened === false && /cannot be checked/.test(v.evidence[0])) && wd.happened === true && notWd.happened === false && /Wikidata/.test(notWd.evidence[0]), J(unsafe.map(v => v.evidence[0]).concat([notWd.evidence[0]])));
      check('FXA-19 FX-A2: a correction on the client\'s own page (L15) counts only when our fetch read it HTTP 200 after the step was asked (was: any 200 row, however old)', l15.happened === true && l15old.happened === false && l15dead.happened === false, J({ l15, l15old, l15dead }));
      // through the plan: the app's address and its source row (influence 0, not cited by any answer) verify the step; the weekly run keeps both
      const sid = 'site_cu-example', dom = 'cu.example'; const prompts = ['q1', 'q2', 'q3'].map(q => ({ prompt_id: q, site_id: sid, domain: dom, prompt: 'Which firms do ' + q + '?', kind: 'recommend', keyword: 'kw ' + q, status: 'active', market: 'AE-en' }));
      const row = { action_id: AIRF.actionId(sid, 'L11', {}), site_id: sid, domain: dom, lever: 'L11', executor: 'human', scope: 'site', ref: '{}', questions: J(['q1', 'q2', 'q3']), engines: J(['chatgpt']), status: 'queued', sink: 'growth_action', mode: 'on', client_url: U,
        prereg_json: J({ metric: 'stage', questions: ['q1', 'q2', 'q3'], engines: ['chatgpt'], controls: [], window_days: 60, t0_rule: 'happened_at', registered_at: iso(REG), lever: 'L11', rule_version: AIRF.RULE_VERSION }), created_at: iso(REG), happened_at: '', verify_json: '', outcome_json: '', learned_at: '' };
      const clientSrc = { site_id: sid, domain: dom, url_key: AIRF.urlKey(U), url: U, host: 'press.example', names_client: true, first_seen: iso(NOW - 2 * DAY), last_seen: iso(NOW - 2 * DAY), checked_at: iso(NOW - 2 * DAY), source_from: 'client' };
      const out = await runPlan({ now: NOW, ov: { ard: fakeArd({ stages: { [sid]: { q1: { chatgpt: 'S1' }, q2: { chatgpt: 'S1' }, q3: { chatgpt: 'S1' } } }, sources: [] }), units: () => [] },
        nodes: { 'AI Rank Live': [siteOf(sid, dom, 'on')], 'Load AI Prompts': prompts, 'Manual Run': [{}], 'Load AI Rank Actions': [row], 'Load AI Rank Sources': [clientSrc], 'Load AI Rank Runs': [] } });
      const air = out[0].air; const r1 = air.rows.actions.find(r => r.action_id === row.action_id);
      check('FXA-19 FX-A2: through AI_Rank_Plan the step is found done from the app\'s source row (kept in the source graph although nothing cites it), the action row keeps client_url, and the weekly source rows never rewrite the client\'s row',
        r1 && r1.status === 'done' && r1.happened_at === iso(NOW - 2 * DAY) && r1.client_url === U && air.sources.some(x => x.client && x.names_client === true) && !air.rows.sources.some(r => r.url_key === AIRF.urlKey(U)), J({ r1: r1 && [r1.status, r1.happened_at, r1.client_url], v: (air.outcomes[0] || {}).verify }));
      const shadowRow = Object.assign({}, row, { lever: 'L08', action_id: AIRF.actionId(sid, 'L08', { url: 'https://lists.example/top' }), status: 'not_happened', client_url: 'https://lists.example/top' });
      const TC = require('./table_cols.json');
      check('FXA-19 FX-A2: client_url is a column of seo_ai_rank_actions (additive, last), so the upsert carries it; a chosen row keeps the stored address (never wiped)', TC.AI_RANK_ACTIONS[TC.AI_RANK_ACTIONS.length - 1] === 'client_url' && /client_url: S0\(st\.client_url\)/.test(rdf('AI_Rank_Plan.js')), J(TC.AI_RANK_ACTIONS.slice(-3))); }

    // ================= FXA-20 (FX-A2): L07 keeps the page it fixes and can be verified =================
    { const PG = 'https://c7.example/services/erp'; const d = [{ prompt_id: 'q1', intent: 'recommendation', engines: { chatgpt: { stage: 'S3', sub: '', basis: 'direct', n: 8, cited: 3, evidence: [{ kind: 'answer', url: PG }] } }, no_search: [] }];
      const cs = ARL.candidates({ site: { site_id: 's7', domain: 'c7.example', pages: [{ url: PG, questions: 'q1' }] }, diag: d, sources: [], arms: [], now: NOW }); const c7 = cs.find(c => c.lever === 'L07');
      const REG = NOW - 20 * DAY; const a = (pg) => ({ action_id: c7.action_id, site_id: 's7', lever: 'L07', status: 'queued', ref: c7.ref, prereg: { registered_at: iso(REG), window_days: 28, t0_rule: 'happened_at' } });
      const v1 = ARL.verify(a(), { pages: [{ url: PG, status: 200, checked_at: iso(NOW - DAY), updated_on: iso(NOW - 5 * DAY) }], now: NOW }), v2 = ARL.verify(a(), { pages: [{ url: PG, status: 200, checked_at: iso(NOW - DAY), updated_on: iso(REG - 30 * DAY) }], now: NOW });
      const v3 = ARL.verify(a(), { pages: [{ url: PG, status: 404, checked_at: iso(NOW - DAY), updated_on: iso(NOW - 5 * DAY) }], now: NOW });
      check('FXA-20 FX-A2: a passage fix (L07) stores the page it fixes in its ref (same action id as before), and is verified when our fetch finds that page live and updated since the step was asked; unchanged or not live is not',
        c7 && c7.ref.url === PG && c7.action_id === AIRF.actionId('s7', 'L07', { prompt_id: 'q1' }) && v1.happened === true && v2.happened === false && v3.happened === false, J({ ref: c7 && c7.ref, v1, v2, v3 })); }

    // ================= FXA-18 (RA-18) =================
    { const p = panel({ seed: 'b18', qt: 4, qc: 8, model: 'indep' }); const o = judge(p);
      check('FXA-18 RA-18: the first-appearance result stores no answer-level p (answers counted for reading only, labelled)', !('p_binom' in o.first_appearance) && /reading only/.test(o.first_appearance.answers_note), J(o.first_appearance)); }
  });
};
if (require.main === module) { const results = []; const H = { results };
  module.exports({ H, guard: async (n, fn) => { try { await fn(); } catch (e) { console.log('ABORT ' + n + ': ' + (e.stack || e)); results.push({ ok: false }); } }, begin: (s) => console.log('\n' + s) })
    .then(() => { const f = results.filter(r => !r.ok).length; console.log('\n' + (results.length - f) + ' passed, ' + f + ' failed'); process.exit(f ? 1 : 0); }); }
