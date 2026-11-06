// AIRW0-1..AIRW0-7 (W0 contract commit, 2026-11-06, docs/ai-ranking-2026-11-05/CONTRACTS.md): the frozen interface the AIR packages code
// against. These checks must stay green through every package: they test SHAPES and RULES, never the skeleton's empty values, so a filled
// kit passes them too. A change that breaks one is a contract change (CONTRACTS.md first).
//   AIRW0-1 AIRF: settings (all off when empty), Site Admin validation, kill switch, what each mode may do, ids
//   AIRW0-2 ARD: every export with the contract's shape, under the sandbox shims
//   AIRW0-3 ARL: the lever library, the refused list, the memo parts, every export's shape
//   AIRW0-4 tables: the five AIR tables and the new columns exactly as frozen; no SerpApi column; the writers' exclusion lists
//   AIRW0-5 fixtures: seeded and byte-identical, synthetic hosts only, exact columns, the archetypes' defining facts
//   AIRW0-6 the generated workflows: AIR's ledger name, the side branch reaches Growth Report, no Gemini grounding call, no SerpApi
//   AIRW0-7 "Track my site" and Site Admin carry the stored AIR settings (exact seo_monitors columns), empty stays empty
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, run, mock, reset, guard, begin } = ctx;
  await guard('air w0 contract', async () => {
    reset(); const SN = 'AIRW0 (W0 2026-11-06, CONTRACTS.md): the AIR contract - flags, kits, tables, fixtures, wiring, monitor rows';
    begin(SN);
    const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
    const J = (x) => String(JSON.stringify(x)); const has = (o, keys) => !!o && typeof o === 'object' && keys.every(k => k in o);
    const V5 = path.join(__dirname, '..', 'v5', 'code'); const rd = (f) => fs.readFileSync(path.join(V5, f), 'utf8');
    // the n8n sandbox: no URL, no structuredClone, Object.defineProperty / setPrototypeOf do nothing
    const NOOP = new Set(['defineProperty', 'defineProperties', 'setPrototypeOf']); const SOBJ = new Proxy(Object, { get: (t, k) => NOOP.has(k) ? ((o) => o) : t[k] });
    const K = new Function('URL', 'structuredClone', 'Object', rd('_ai_rank_flags.js') + '\n' + rd('_ai_rank_diag.js') + '\n' + rd('_ai_rank_learn.js') + '\nreturn { AIRF, ARD, ARL };')(undefined, undefined, SOBJ);
    const { AIRF, ARD, ARL } = K;
    for (const f of ['_ai_rank_flags.js', '_ai_rank_diag.js', '_ai_rank_learn.js']) check('kit ' + f + ' has no build placeholder and no em dash / curly quote', !/\/\*__/.test(rd(f)) && !/[—‘’“”…]/.test(rd(f)), f);

    // ---- AIRW0-1 AIRF ----
    const off = AIRF.settingsOf({}); const offN = AIRF.settingsOf(null);
    check('AIRW0-1 an empty / missing seo_monitors row is OFF everywhere', J(off) === J({ mode: 'off', reserve: false, fanout_n: 0, mentions: false, brave: false }) && J(offN) === J(off), J(off));
    check('AIRW0-1 modes read as stored (case-free); anything else is off', AIRF.settingsOf({ ai_rank_mode: 'shadow' }).mode === 'shadow' && AIRF.settingsOf({ ai_rank_mode: ' ON ' }).mode === 'on' && AIRF.settingsOf({ ai_rank_mode: 'yes' }).mode === 'off' && AIRF.settingsOf({ ai_rank_mode: null }).mode === 'off', '');
    check('AIRW0-1 flags and the fan-out cap (0-50, rounded)', AIRF.settingsOf({ ai_rank_reserve: 'true', ai_rank_mentions: true, ai_rank_brave: 'false', ai_rank_fanout_n: 77 }).fanout_n === 50 && AIRF.settingsOf({ ai_rank_reserve: 'true' }).reserve === true
      && AIRF.settingsOf({ ai_rank_brave: 'false' }).brave === false && AIRF.settingsOf({ ai_rank_fanout_n: '12.4' }).fanout_n === 12 && AIRF.settingsOf({ ai_rank_fanout_n: -3 }).fanout_n === 0, '');
    const v1 = AIRF.validate({ ai_rank_mode: 'Shadow', ai_rank_fanout_n: 20, ai_rank_mentions: 'yes', ai_rank_reserve: '' }); const v2 = AIRF.validate({ ai_rank_mode: 'maybe', ai_rank_fanout_n: 51, ai_rank_brave: 'perhaps' });
    check('AIRW0-1 Site Admin validation: only the given fields, normalised; "" clears; bad values are named errors', J(v1.values) === J({ ai_rank_mode: 'shadow', ai_rank_reserve: null, ai_rank_fanout_n: 20, ai_rank_mentions: true }) && !v1.errors.length
      && v2.errors.length === 3 && /off, shadow or on/.test(v2.errors[0]) && !('ai_rank_mode' in v2.values) && J(AIRF.validate({}).values) === '{}', J({ v1, v2 }));
    check('AIRW0-1 kill switch: seo_cache air:kill = 1 (or true / on / yes); any other value or key is not', AIRF.killed([{ key: 'air:kill', value: '1' }]) && AIRF.killed([{ key: 'air:kill', value: 'true' }]) && !AIRF.killed([{ key: 'air:kill', value: '0' }]) && !AIRF.killed([{ key: 'air:killx', value: '1' }]) && !AIRF.killed(null), '');
    const m = (mode) => ({ mode }); const tab = ['off', 'shadow', 'on'].map(x => [x, AIRF.runs(m(x), false), AIRF.writesSinks(m(x), false), AIRF.mayPay(m(x), false), AIRF.runs(m(x), true), AIRF.writesSinks(m(x), true)]);
    check('AIRW0-1 what a mode may do: off nothing; shadow runs (AIR tables only, nothing paid); on runs, writes sinks, may pay; the kill switch stops all', J(tab) === J([['off', false, false, false, false, false], ['shadow', true, false, false, false, false], ['on', true, true, true, false, false]]), J(tab));
    check('AIRW0-1 url_key: no scheme, no www, host lower-case, no query / fragment / trailing slash; not a URL -> ""', AIRF.urlKey('https://WWW.Example.com/a/b/?x=1#y') === 'example.com/a/b' && AIRF.urlKey('http://clutch.co/ae/developers/') === 'clutch.co/ae/developers' && AIRF.urlKey('ftp://x') === '' && AIRF.urlKey('') === '', AIRF.urlKey('https://WWW.Example.com/a/b/?x=1#y'));
    const a1 = AIRF.actionId('site_x', 'L08', { url: 'https://www.a.example/list/' }), a2 = AIRF.actionId('site_x', 'L08', { url: 'https://a.example/list' }), a3 = AIRF.actionId('site_x', 'L05', { prompt_id: 'p1' });
    check('AIRW0-1 ids: action id air_<site>_<lever>_<8 hex of the ref> (same page, same id), run id air_<yyyymmdd>_<site>, target id in the AI Growth format, prior id',
      /^air_site_x_L08_[0-9a-f]{8}$/.test(a1) && a1 === a2 && a3 !== a1 && AIRF.runId('site_x', Date.parse('2026-11-02T10:00:00Z')) === 'air_20261102_site_x' && AIRF.targetId('site_acme-erp-example', 'aq1') === 'ait_acme-erp-example_aq1'
      && AIRF.priorId('L05', 'S1', 'google') === 'L05:S1:google:global' && AIRF.refKey({}) === 's:site', J([a1, a2, a3]));
    check('AIRW0-1 vocabulary: 8 engines (gemini_api excluded), 5 engine groups, stages S0-S5 + unmeasured, 9 action statuses', AIRF.ENGINES.length === 8 && !AIRF.ENGINES.includes('gemini_api') && AIRF.EXCLUDED_ENGINES.includes('gemini_api') && !AIRF.usable('gemini_api')
      && AIRF.ENGINES.every(e => AIRF.GROUPS.includes(AIRF.GROUP_OF[e])) && AIRF.STAGE_LABELS.length === 7 && AIRF.ACTION_STATUSES.length === 9 && AIRF.RULE_VERSION === 'air-2', '');

    // ---- AIRW0-2 ARD shapes ----
    const now = Date.parse('2026-11-02T10:00:00Z');
    const mk = ARD.market({ site: {}, ladders: [], tracked: [], monitors: {}, profile: {}, gscCountries: [] });
    const cp = ARD.corePanel({ site: {}, prompts: [], units60: [], stored: [], market: mk, demand: {}, now, cfg: {} });
    const md = ARD.mde({ q_t: 16, q_c: 8, m: 28, p: 0.02, rho: 0.3 });
    const dg = ARD.diagnose({ site: {}, prompt: { prompt_id: 'p1' }, answers8: [], units60: [], evidence: '', access: {}, pages: [], index: { google: new Map(), bing: { in_account: null, crawled: new Map() }, brave: null, cc_captures: null }, serp: new Map(), now, cfg: {} });
    const cl = ARD.classifyPage({ url: 'https://clutch.co/ae/developers/dubai', title: '', host: 'clutch.co', rivals: [], ourHosts: [] });
    check('AIRW0-2 ARD exports and VERSION', ['market', 'intentOf', 'corePanel', 'assignArms', 'mde', 'fanoutOf', 'diagnose', 'classifyPage', 'sources', 'rollEvidence'].every(f => typeof ARD[f] === 'function') && ARD.VERSION === AIRF.RULE_VERSION, Object.keys(ARD).join());   // FX-A2: the kit version follows the rule (air-2)
    check('AIRW0-2 market / corePanel / mde shapes', has(mk, ['cc', 'lang', 'location_code', 'second', 'conflicts', 'basis']) && Array.isArray(mk.conflicts) && has(cp, ['core', 'proposed', 'extend', 'comparable', 'why'])
      && [cp.core, cp.proposed, cp.extend].every(Array.isArray) && has(md, ['prepost', 'did', 'n_eff_t', 'n_eff_c', 'p_used', 'first_appearance_k', 'basis']), J({ mk, cp, md }));
    check('AIRW0-2 intent vocabulary; arms, fan-out and sources are lists; evidence is a string that keeps what was stored', ['recommendation', 'informational', 'brand', 'unknown'].includes(ARD.intentOf({ prompt_id: 'p1' }, []))
      && Array.isArray(ARD.assignArms({ core: [], stored: [], seed: 's', now })) && Array.isArray(ARD.fanoutOf({ prompt_id: 'p1', answers8: [], evidence: '' })) && Array.isArray(ARD.sources({ answers8: [], storedSources: [], now }))
      && typeof ARD.rollEvidence({ stored: '{"v":1}', answers8: [], now }) === 'string' && ARD.rollEvidence({ stored: '{"v":1}', answers8: [], now }).length > 0, '');
    check('AIRW0-2 diagnose shape: prompt_id, intent, engines map, best_stage in the stage labels, parametric_share, no_search, list_dominated, nobody_named',
      has(dg, ['prompt_id', 'intent', 'engines', 'best_stage', 'parametric_share', 'no_search', 'list_dominated', 'nobody_named', 'first_named_at', 'last_named_at', 'last_cited_at']) && dg.prompt_id === 'p1' && AIRF.STAGE_LABELS.includes(dg.best_stage) && Array.isArray(dg.no_search)
      && Object.values(dg.engines).every(c => has(c, ['stage', 'sub', 'basis', 'n', 'named', 'cited', 'retrieved', 'our_rank', 'evidence'])), J(dg));
    check('AIRW0-2 classifyPage shape (page_type / author_kind in the frozen vocabularies)', has(cl, ['page_type', 'author_kind', 'why'])
      && ['listicle', 'directory', 'review', 'registry', 'community', 'news', 'video', 'social', 'encyclopedia', 'official', 'vendor_page', 'client', 'unknown'].includes(cl.page_type)
      && ['rival', 'editorial', 'client', 'platform', 'unknown'].includes(cl.author_kind), J(cl));

    // ---- AIRW0-3 ARL ----
    const SINKS = ['ai_target', 'prospect', 'listing', 'growth_action', 'site_task', 'protect', 'existing'];
    const ids = ARL.LEVERS.map(l => l.id);
    check('AIRW0-3 the lever library: L01-L17 once each, every lever with stages, executor, scope, sink and evidence from the frozen vocabularies',
      J(ids) === J(Array.from({ length: 17 }, (_, i) => 'L' + String(i + 1).padStart(2, '0'))) && ARL.LEVERS.every(l => l.label && Array.isArray(l.from) && l.from.every(s => AIRF.STAGES.includes(s)) && AIRF.STAGES.includes(l.to)
        && ['auto', 'approve', 'human'].includes(l.executor) && ['question', 'page', 'site'].includes(l.scope) && SINKS.includes(l.sink) && SINKS.includes(l.sink_wave2) && Array.isArray(l.evidence) && l.evidence.length && l.mult && typeof l.mult === 'object'), J(ids));
    check('AIRW0-3 the frozen sinks: own pages -> ai_target, placements -> prospect, directories -> listing, protect -> protect; L17 has no prior until its notability gate holds',
      ['L05', 'L06'].every(i => ARL.LEVERS.find(l => l.id === i).sink === 'ai_target') && ARL.LEVERS.find(l => l.id === 'L08').sink === 'prospect' && ARL.LEVERS.find(l => l.id === 'L09').sink === 'listing'
      && ARL.LEVERS.find(l => l.id === 'L16').sink === 'protect' && ARL.LEVERS.find(l => l.id === 'L17').prior === null, '');
    check('AIRW0-3 six refused tactics, two zero-weight hygiene items, stage values, verdicts, the seven memo parts', ARL.REFUSED.length === 6 && ARL.REFUSED.every(r => r.id && r.label && r.why) && J(ARL.ZERO_WEIGHT) === J(['schema', 'llms_txt'])
      && J(ARL.U) === J({ S0: 0, S1: 0.03, S2: 0.15, S3: 0.25, S4: 0.45, S5: 0.8 }) && J(ARL.VERDICTS) === J(['likely_helped', 'cant_tell', 'no_effect', 'not_happened', 'not_due'])
      && J(ARL.MEMO_PARTS) === J(['what_changed', 'why', 'detectable', 'actions', 'projected_vs_real', 'cost_per_win', 'shadow_vs_old']), '');
    const sc = ARL.score({}, {}); const ch = ARL.choose([], {}); const pr = ARL.prereg({}, { now }); const vf = ARL.verify({}, { now }); const oc = ARL.outcome({}, { now }); const me = ARL.memo({ site: { site_id: 's' }, mode: 'shadow' }); const co = ARL.compareOld({ chosen: [], old: {} });
    check('AIRW0-3 every ARL export with the contract shape', ['value', 'feasibility', 'priorOf', 'candidates', 'score', 'choose', 'prereg', 'verify', 'outcome', 'learn', 'memo', 'compareOld'].every(f => typeof ARL[f] === 'function')
      && has(ARL.value({}), ['V', 'demand_w', 'intent_w', 'stage_w', 'basis']) && has(ARL.feasibility({}), ['F', 'market_w', 'comp_w', 'reach_w', 'basis']) && has(ARL.priorOf({}), ['a', 'b', 'mean', 'lo90', 'hi90', 'n', 'source'])
      && Array.isArray(ARL.candidates({})) && has(sc, ['gain', 'cost', 'score', 'p_by_cell', 'days', 'why']) && has(ch, ['chosen', 'deferred', 'refused']) && [ch.chosen, ch.deferred, ch.refused].every(Array.isArray)
      && has(pr, ['metric', 'questions', 'engines', 'controls', 'window_days', 't0_rule', 'projected', 'registered_at']) && ['live_at', 'happened_at'].includes(pr.t0_rule)
      && has(vf, ['happened', 'at', 'evidence']) && [true, false, null].includes(vf.happened) && has(oc, ['due', 'stage_moves', 'did', 'placebo', 'first_appearance', 'leading', 'verdict', 'why']) && ARL.VERDICTS.includes(oc.verdict)
      && Array.isArray(ARL.learn({ priors: [], outcomes: [], now })) && has(co, ['overlap', 'gain_air', 'gain_old', 'causes', 'note']), J({ sc, ch, pr, vf, oc, co }));
    check('AIRW0-3 the memo: v, rule_version, site, mode, the seven parts in order (key, title, lines), blockers', has(me, ['v', 'rule_version', 'site_id', 'mode', 'parts', 'blockers']) && J(me.parts.map(p => p.key)) === J(ARL.MEMO_PARTS)
      && me.parts.every(p => p.title && Array.isArray(p.lines)) && me.site_id === 's' && me.mode === 'shadow' && !/[—‘’“”…]/.test(J(me)), J(me));

    // ---- AIRW0-4 tables ----
    const TC = require('./table_cols.json');
    const FROZEN = {
      AI_RANK_RUNS: ['site_id', 'domain', 'run_id', 'checked_at', 'mode', 'rule_version', 'panel_json', 'diag_json', 'sources_json', 'candidates_json', 'chosen_json', 'old_json', 'compare_json', 'memo_json', 'cost_json', 'learn_json', 'exec_id', 'error', 'stages_json'],   // FX-A RA-9: stages_json added (additive, at the end)
      AI_RANK_QUESTIONS: ['site_id', 'domain', 'prompt_id', 'question', 'intent', 'market', 'core', 'core_since', 'core_until', 'arm', 'stratum', 'value', 'demand', 'demand_basis', 'feasibility', 'stage_json', 'best_stage', 'parametric_json', 'evidence_json', 'first_named_at', 'last_named_at', 'last_cited_at', 'updated_at', 'rule_version', 'arm_since'],   // FX-A RA-2: arm_since added (additive, at the end)
      AI_RANK_ACTIONS: ['action_id', 'site_id', 'domain', 'lever', 'executor', 'scope', 'ref', 'questions', 'engines', 'target_stage', 'status', 'sink', 'sink_ref', 'expected_json', 'prereg_json', 'happened_at', 'verify_json', 'outcome_json', 'learned_at', 'mode', 'run_id', 'created_at', 'updated_at', 'client_url'],   // FX-A2: client_url added (additive, at the end; written by the app, FX-C RC-3)
      AI_RANK_SOURCES: ['site_id', 'domain', 'url_key', 'url', 'host', 'page_type', 'author_kind', 'names_client', 'rivals_named', 'questions', 'engines', 'cites_28d', 'influence', 'placeability', 'placeability_why', 'contact_email', 'contact_url', 'source_from', 'first_seen', 'last_seen', 'checked_at'],
      AI_RANK_PRIORS: ['prior_id', 'lever', 'stage', 'engine_group', 'scope', 'alpha', 'beta', 'n_outcomes', 'prior_alpha', 'prior_beta', 'source', 'updated_at', 'rule_version'] };
    check('AIRW0-4 the five AIR tables carry exactly the frozen columns (DESIGN.md 6.9)', Object.entries(FROZEN).every(([k, v]) => J(TC[k]) === J(v)), J(Object.keys(FROZEN).filter(k => J(TC[k]) !== J(FROZEN[k]))));
    const AIRM = ['ai_rank_mode', 'ai_rank_reserve', 'ai_rank_fanout_n', 'ai_rank_mentions', 'ai_rank_brave'];
    check('AIRW0-4 new columns: seo_monitors + the five AIR settings (no SerpApi / Copilot column), seo_ai_prompts + core_until, seo_ai_targets + origin / action_id / live_at, at the end',
      J(TC.MONITORS.slice(-5)) === J(AIRM) && J(TC.AIR_MONITORS) === J(AIRM) && !TC.MONITORS.some(c => /copilot|serpapi/.test(c)) && TC.AI_PROMPTS[TC.AI_PROMPTS.length - 1] === 'core_until'
      && J(TC.AI_TARGETS.slice(-3)) === J(['origin', 'action_id', 'live_at']) && J(TC.AI_PROMPTS_AIR) === J(['core_until']) && J(TC.AI_TARGETS_AIR) === J(['origin', 'action_id', 'live_at']), J({ m: TC.MONITORS.slice(-6), p: TC.AI_PROMPTS.slice(-2), t: TC.AI_TARGETS.slice(-4) }));
    const lc = fs.readFileSync(path.join(__dirname, '..', 'ladder_common.py'), 'utf8');
    check('AIRW0-4 every AIR table is a <NAME>_TABLE / <NAME>_COLS pair (sync_tables.py finds it)', ['AI_RANK_RUNS', 'AI_RANK_QUESTIONS', 'AI_RANK_ACTIONS', 'AI_RANK_SOURCES', 'AI_RANK_PRIORS'].every(k => new RegExp('\\n' + k + "_TABLE = 'seo_" + k.toLowerCase() + "'").test(lc) && new RegExp('\\n' + k + '_COLS = \\[').test(lc)), '');

    // ---- AIRW0-5 fixtures ----
    const FX = require('./fixtures_air');
    const f1 = FX.make({ seed: 'w0' }), f2 = FX.make({ seed: 'w0' }), f3 = FX.make({ seed: 'w0-other' });
    check('AIRW0-5 fixtures: same seed byte-identical, another seed differs', J(f1) === J(f2) && J(f1.tables.seo_ai_answers) !== J(f3.tables.seo_ai_answers), '');
    const urls = (J(f1).match(/https?:\/\/[^"\\\s<>]+/g) || []).map(u => u.replace(/^https?:\/\//, '').replace(/[\/?#:].*$/, '').toLowerCase());
    const emails = (J(f1).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).map(e => e.split('@')[1].toLowerCase());
    const okHost = (h) => /(^|\.)example$/.test(h) || ['clutch.co', 'g2.com', 'www.g2.com'].includes(h);
    check('AIRW0-5 fixtures: synthetic hosts only (.example, plus clutch.co / g2.com as directory hosts), in every URL and e-mail address', urls.length > 50 && urls.every(okHost) && emails.every(okHost), J([...new Set([...urls, ...emails].filter(h => !okHost(h)))]));
    const exact = { seo_monitors: 'MONITORS', seo_ai_prompts: 'AI_PROMPTS', seo_ai_answers: 'AI_ANSWERS', seo_ai_targets: 'AI_TARGETS', seo_ai_pages: 'AI_PAGES', seo_cache: 'CACHE', seo_listings: 'LISTINGS', seo_link_outreach: 'LINK_OUTREACH', seo_link_prospects: 'PROSPECT' };
    const bad = Object.entries(exact).filter(([t, k]) => !f1.tables[t].length || !f1.tables[t].every(r => J(Object.keys(r).sort()) === J(TC[k].slice().sort())));
    check('AIRW0-5 fixtures: exact table columns for ' + Object.keys(exact).length + ' tables', !bad.length, J(bad.map(([t, k]) => [t, (f1.tables[t][0] ? Object.keys(f1.tables[t][0]).filter(c => !TC[k].includes(c)).concat(TC[k].filter(c => !(c in f1.tables[t][0]))) : 'empty')])));
    const stats = fs.readFileSync(path.join(V5, '_ai_stats.js'), 'utf8').match(/RULE_VERSION = '([^']+)'/);
    check('AIRW0-5 fixtures: the AI visibility rule version is the current one', stats && stats[1] === FX.AIV_RULE, stats && stats[1]);
    const T = f1.tables; const nv = 'site_nova-ai-example', ac = 'site_acme-erp-example';
    const acmeWin = T.seo_ai_prompts.find(p => p.site_id === ac && p.prompt_id === 'aq1');
    const acmeNamed = T.seo_ai_answers.filter(a => a.site_id === ac && a.prompt_id === 'aq1' && a.named).length;
    check('AIRW0-5 archetypes: nova AE site + client ladders vs PK profile, a spawned PK rung, not in Bing, one indexed page, robots blocked then open, named only on its brand question; acme named on its winning question (focus watch, 60 days), a rung on its cited page, gemini_api rows present',
      T.seo_sites.find(s => s.site_id === nv).location_code === 2784 && T.seo_profiles.find(p => p.site_id === nv).country_code === 'PK' && T.seo_ladders.some(l => l.domain === 'nova-ai.example' && l.chosen_by === 'system' && /lahore/.test(l.keyword))
      && !f1.bing.sites.some(s => /nova-ai/.test(s)) && T.seo_index_pages.filter(r => r.site_id === nv && r.state === 'indexed').length === 1 && /Disallow/.test(f1.robots_history['nova-ai.example'][0].text) && !/Disallow/.test(f1.robots['nova-ai.example'])
      && T.seo_ai_answers.filter(a => a.site_id === nv && a.named && a.kind !== 'brand').length === 0
      && acmeWin.focus_state === 'watch' && acmeNamed >= 3 && T.seo_ladders.some(l => l.domain === 'acme-erp.example' && /\/guides\/erp-implementation-cost$/.test(l.target_url)) && T.seo_ai_answers.some(a => a.engine === 'gemini_api'),
      J({ acmeNamed }));
    check('AIRW0-5 fixtures: weekly units_json and pulse detail_json in the AVX formats; serp:* rows with an empty site id', T.seo_ai_visibility.every(r => { const u = JSON.parse(r.units_json); return u.v === 1 && Array.isArray(u.a) && Array.isArray(u.q) && u.rule_version === FX.AIV_RULE; })
      && T.seo_ai_daily.every(d => Array.isArray(JSON.parse(d.detail_json).a)) && T.seo_cache.filter(c => /^serp:/.test(c.key)).length >= 10 && T.seo_cache.filter(c => /^serp:/.test(c.key)).every(c => c.site_id === '' && c.kind === 'serp'), '');

    // ---- AIRW0-6 generated workflows ----
    const WF = path.join(__dirname, '..', 'workflows');
    let g = JSON.parse(fs.readFileSync(path.join(WF, 'SEO_Agent_AI_Growth.json'), 'utf8')); g = Array.isArray(g) ? g[0] : g;
    const settle = (g.nodes.find(n => n.name === 'Ledger Settle (Growth)') || { parameters: {} }).parameters.jsCode || '';
    check('AIRW0-6 AI Growth\'s ledger settle reads AIR\'s paid reads too (measured = Growth Metrics|AI Rank Fetched)', /const MEASURED = 'Growth Metrics\|AI Rank Fetched';/.test(settle), (settle.match(/const MEASURED = '[^']*'/) || [''])[0]);
    const reach = (from, to, out) => { const seen = new Set(); const st = (out == null ? (((g.connections[from] || {}).main) || []).flat() : ((((g.connections[from] || {}).main) || [])[out] || [])).map(c => c.node);
      while (st.length) { const x = st.pop(); if (x === to) return true; if (seen.has(x)) continue; seen.add(x); for (const br of (((g.connections[x] || {}).main) || [])) for (const c of (br || [])) st.push(c.node); } return false; };
    check('AIRW0-6 the AIR side branch: Growth Report is reached from Save AI Growth and from "Any Growth Row?" false; "Any Growth Row?" true still goes to Save AI Growth',
      reach('Save AI Growth', 'Growth Report') && reach('Any Growth Row?', 'Growth Report', 1) && ((((g.connections['Any Growth Row?'] || {}).main) || [])[0] || []).some(c => c.node === 'Save AI Growth'), '');
    const all = fs.readdirSync(WF).filter(f => f.endsWith('.json')).map(f => fs.readFileSync(path.join(WF, f), 'utf8'));
    check('AIRW0-6 no generated workflow calls Gemini grounding (generativelanguage.googleapis.com) or SerpApi (owner: not approved)', all.length > 10 && !all.some(s => /generativelanguage\.googleapis\.com/i.test(s)) && !all.some(s => /serpapi\.com/i.test(s)), '');

    // ---- AIRW0-7 the monitor writers carry the AIR settings as stored ----
    const MC = TC.MONITORS; const D = 'nova-ai.example', SITE = 'site_nova-ai-example';
    const stored = { site_id: SITE, domain: D, ai_rank_mode: 'shadow', ai_rank_reserve: true, ai_rank_fanout_n: 20, ai_rank_mentions: 'false', ai_rank_brave: '' };
    reset(); mock('Normalize Input', [{ json: { domain: D, competitors: [], monitor_input: { ai_rank_mode: 'on' }, request_id: 'r1' } }]); mock('Load Monitors (Track)', [{ json: stored }]);
    const t1 = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    mock('Load Monitors (Track)', [{ json: {} }]); const t2 = (await run('Monitor Row (Track)', [{ json: {} }]))[0].json;
    check('AIRW0-7 "Track my site" keeps the stored AIR settings (never sets them, not even when asked), empty stays null, exact seo_monitors columns',
      t1.ai_rank_mode === 'shadow' && t1.ai_rank_reserve === true && t1.ai_rank_fanout_n === 20 && t1.ai_rank_mentions === false && t1.ai_rank_brave === null && AIRM.every(k => t2[k] === null)
      && J(Object.keys(t1).sort()) === J(MC.slice().sort()), J({ t1: AIRM.map(k => t1[k]), t2: AIRM.map(k => t2[k]) }));
    reset(); mock('Admin Action', [{ json: { site_id: SITE, domain: D, monitors: { backlinks: false }, updated_at: '2026-11-02T10:00:00Z', request_id: 'r2' } }]); mock('Load Monitors (Admin)', [{ json: stored }]);
    const ad = (await run('Monitor Row (Admin)', [{ json: {} }]))[0].json;
    check('AIRW0-7 Site Admin keeps the stored AIR settings when other settings change, exact seo_monitors columns', ad.ai_rank_mode === 'shadow' && ad.ai_rank_fanout_n === 20 && ad.backlinks === false && J(Object.keys(ad).sort()) === J(MC.slice().sort()), J(AIRM.map(k => ad[k])));
  });
};
