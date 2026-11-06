// AIR P1 (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md 6.2, fixes/P1.md): ARD, the diagnosis kit (v5/code/_ai_rank_diag.js).
//   AD1  market: the client's keywords and the site decide, the profile country is a conflict, a spawned rung never moves it, second market, GSC
//   AD2  intent: recommendation / informational / brand from 28 days of answers; the question's own words when answers are few
//   AD3  core panel: frozen 8 weeks, never retired while it names or cites the client (extend), market-correct, proposals, comparable
//   AD4  arms: seeded, 2:1 in every stratum, stored arms never reshuffled, the next slot of a stratum, the holdout rotates after 12 weeks
//   AD5  MDE: R1 §6's table within 0.1 point, the first-appearance requirement (k)
//   AD6  stages: one case per rule of 2.B, every cell with basis and n, the two archetypes' defining facts
//   AD7  parametric share and no_search; nobody_named questions scored on citation; list_dominated
//   AD8  page classification on harness/air_page_types.json (>= 95%), rival lists kept (0.02), a 403 page names_client null
//   AD9  influence and placeability on a hand-computed case
//   AD10 the n8n sandbox (no URL, no defineProperty, no structuredClone) and speed (50 questions x 7 engines x 30 answers)
//   AD11 rollEvidence: counts older than 8 days kept, 120 days dropped, 8 KB cap, idempotent
//   AD12 gemini_api ignored by every function
//   AD13 accuracy: precision and recall per stage on the labelled cells (fixtures_air diag_cases, two seeds), sub-label and basis accuracy
//   AD15 provisional S0 / S1 with 0-3 answers (DESIGN 2.B deviation of 2026-11-06); S2-S5 still need 4; answers decide once there are 4
//   AD14 the real shapes the 2026-11-06 production replay found: a panel drifted to another country (core of 1), thin strata (no control arm)
const fs = require('fs'); const path = require('path');
module.exports = async (ctx) => {
  const { H, reset, guard, begin } = ctx;
  await guard('air diag', async () => {
    reset(); const SN = 'AD (AIR P1 2026-11-06, DESIGN.md 6.2): the diagnosis kit ARD - market, intent, core panel, arms, MDE, stages, source graph';
    begin(SN);
    const check = (label, ok, detail) => { H.results.push({ scenario: SN, node: 'assert ' + label, ok: !!ok, ms: 0, error: ok ? '' : String(detail || 'assertion failed').slice(0, 900), items: [] });
      console.log('   ' + (ok ? 'ok   ' : 'FAIL ') + label + (ok ? '' : ' -> ' + String(detail || '').slice(0, 700))); };
    const J = (x) => String(JSON.stringify(x));
    const V5 = path.join(__dirname, '..', 'v5', 'code'); const rd = (f) => fs.readFileSync(path.join(V5, f), 'utf8');
    const NOOP = new Set(['defineProperty', 'defineProperties', 'setPrototypeOf']); const SOBJ = new Proxy(Object, { get: (t, k) => NOOP.has(k) ? ((o) => o) : t[k] });
    const K = new Function('URL', 'structuredClone', 'Object', rd('_ai_rank_flags.js') + '\n' + rd('_ai_measure.js') + '\n' + rd('_ai_rank_diag.js') + '\nreturn { AIRF, AVX, ARD };')(undefined, undefined, SOBJ);
    const { AIRF, AVX, ARD } = K;
    const FX = require('./fixtures_air');
    const DAY = 864e5; const NOW = Date.parse('2026-11-02T10:00:00.000Z'); const iso = (ms) => new Date(ms).toISOString(); const ago = (d) => iso(NOW - d * DAY);

    // ---- AD1 market ----
    const siteAE = { site_id: 'site_m', domain: 'm.example', country: 'United Arab Emirates', location_code: 2784, language_code: 'en' };
    const lad = [{ head_keyword: 'custom software development uae', keyword: 'custom software development uae', chosen_by: 'client_typed' }, { head_keyword: 'erp consultants gcc', keyword: 'erp consultants gcc', chosen_by: 'client_picked' }];
    const m1 = ARD.market({ site: siteAE, ladders: lad, tracked: [], monitors: {}, profile: { country_code: 'PK' }, gscCountries: [] });
    check('AD1 market: site AE + two client keywords (UAE, GCC) win over the profile country PK, which is listed as a conflict', m1.cc === 'AE' && m1.location_code === 2784 && m1.lang === 'en' && m1.conflicts.some(c => c.source === 'profile.country_code' && /^PK/.test(c.value)) && m1.second === null, J(m1));
    const m2 = ARD.market({ site: siteAE, ladders: [...lad, { head_keyword: 'software house lahore', keyword: 'software house lahore', chosen_by: 'system' }, { head_keyword: 'custom software development uae', keyword: 'software house karachi', chosen_by: '' }], tracked: ['software house lahore'], profile: { country_code: 'PK' } });
    check('AD1 market: a rung the system spawned (and a tracked copy of it, and a legacy rung) with a PK place word does not move it', m2.cc === 'AE' && !m2.conflicts.some(c => c.source === 'keyword') && /not counted/.test(m2.basis) && m2.basis.split(';')[0] === m1.basis.split(';')[0], J(m2));
    const m3 = ARD.market({ site: siteAE, ladders: [{ head_keyword: 'erp riyadh', chosen_by: 'client_typed' }, { head_keyword: 'odoo partner jeddah', chosen_by: 'client_typed' }, { head_keyword: 'erp dubai', chosen_by: 'client_typed' }], profile: {} });
    check('AD1 market: a tie goes to the site country and the runner-up within 25% is a second market (reported, not asked)', m3.cc === 'AE' && m3.second && m3.second.cc === 'SA' && m3.second.share > 0 && m3.second.share < 1, J(m3));
    const m4 = ARD.market({ site: { country: '' }, ladders: [], profile: { country_code: 'PK' }, gscCountries: [{ country: 'are', clicks: 40 }, { country: 'pak', clicks: 5 }] });
    check('AD1 market: Search Console clicks by country (alpha-3) count 2 for the top country', m4.cc === 'AE' && m4.conflicts.some(c => /^PK/.test(c.value)), J(m4));
    const m5 = ARD.market({});
    check('AD1 market: no signal at all -> no market, said in words', m5.cc === '' && /no market signal/.test(m5.basis) && m5.location_code === 0, J(m5));
    const F = FX.make(); const T = F.tables;
    const mkOf = (A) => { const site = T.seo_sites.find(s => s.site_id === A.site_id); return ARD.market({ site, ladders: T.seo_ladders.filter(l => l.domain === A.domain), tracked: site.keywords.split(','), profile: T.seo_profiles.find(p => p.site_id === A.site_id) }); };
    const mN = mkOf(F.archetypes.nova), mA = mkOf(F.archetypes.acme);
    check('AD1 market on the archetypes: nova AE (PK profile a conflict, its system rung "software house lahore" not counted), acme SA with no conflict', mN.cc === 'AE' && mN.conflicts.some(c => /^PK/.test(c.value)) && mA.cc === 'SA' && !mA.conflicts.length, J({ mN, mA }));

    // ---- AD2 intent ----
    const ans = (k, total, comp) => Array.from({ length: total }, (_, i) => ({ prompt_id: 'q', engine: ['chatgpt', 'perplexity', 'ai_mode'][i % 3], answered: true, error: '', named: false,
      entities_json: JSON.stringify(i < k ? [{ id: 'r.example', role: comp || 'competitor', position: 1 }] : [{ id: 'gov.example', role: 'source', position: null }]) }));
    check('AD2 intent: >= 50% of answers name a business -> recommendation; fewer -> informational; the brand question -> brand',
      ARD.intentOf({ prompt_id: 'q' }, ans(4, 6)) === 'recommendation' && ARD.intentOf({ prompt_id: 'q' }, ans(3, 6)) === 'recommendation' && ARD.intentOf({ prompt_id: 'q' }, ans(2, 6)) === 'informational'
      && ARD.intentOf({ prompt_id: 'q', kind: 'brand' }, ans(6, 6)) === 'brand' && ARD.intentOf({ prompt_id: 'q' }, ans(6, 6, 'source')) === 'informational', '');
    const un = (k, total) => Array.from({ length: total }, (_, i) => ({ prompt_id: 'q', engine: 'chatgpt', named: i === 0 && k > 0, cited: false, rivals: i < k ? [{ id: 'r.example' }] : [], answered: true }));
    check('AD2 intent from AVX units (rivals arrays) the same way', ARD.intentOf({ prompt_id: 'q' }, un(5, 8)) === 'recommendation' && ARD.intentOf({ prompt_id: 'q' }, un(1, 8)) === 'informational', '');
    check('AD2 intent with fewer than 4 answers: the stored kind, else the question\'s words, else unknown', ARD.intentOf({ prompt_id: 'q', kind: 'recommend' }, ans(0, 2)) === 'recommendation' && ARD.intentOf({ prompt_id: 'q', kind: 'learn' }, []) === 'informational'
      && ARD.intentOf({ prompt_id: 'q', prompt: 'How does e-invoicing work in Saudi Arabia?' }, []) === 'informational' && ARD.intentOf({ prompt_id: 'q', prompt: 'Which agencies build apps in Doha?' }, []) === 'recommendation'
      && ARD.intentOf({ prompt_id: 'q', prompt: 'Odoo partner Riyadh' }, []) === 'recommendation' && ARD.intentOf({ prompt_id: 'q' }, []) === 'unknown', '');

    // ---- AD3 core panel ----
    const P = (id, o) => ({ prompt_id: id, site_id: 's', prompt: 'Who builds ' + id + ' software?', kind: 'recommend', keyword: id + ' software', status: 'active', market: 'AE-en', cluster: 'c' + (id.charCodeAt(1) % 2), volume: 10, created_at: ago(80), pinned: false, ...(o || {}) });
    const prompts = [P('p1'), P('p2', { volume: 300 }), P('p3'), P('p4'), P('p5'), P('p6', { market: 'PK-en' }), P('p7', { status: 'retired' }), P('pB', { kind: 'brand', prompt: 'What is M?' })];
    const units = [{ prompt_id: 'p1', engine: 'chatgpt', named: true, cited: false, at: ago(30), answered: true }, { prompt_id: 'p7', engine: 'ai_mode', named: false, cited: true, at: ago(30), answered: true },
      { prompt_id: 'pB', engine: 'chatgpt', named: true, at: ago(3), answered: true }, { prompt_id: 'p3', engine: 'gemini_api', named: true, cited: true, at: ago(3), answered: true }];
    const stored = [{ prompt_id: 'p1', core: true, core_since: ago(40), core_until: iso(NOW + 16 * DAY), arm: 'treated', stratum: '' }, { prompt_id: 'p7', core: true, core_since: ago(58), core_until: ago(2), arm: 'control' }];
    const cand = [{ keyword: 'erp support dubai', source: 'client', volume: 90 }, { keyword: 'software house lahore', source: 'gsc', volume: 400 }, { keyword: 'p2 software', source: 'client', volume: 50 }];
    const cp = ARD.corePanel({ site: { site_id: 's' }, prompts, units60: units, stored, market: { cc: 'AE', lang: 'en' }, demand: { candidates: cand }, now: NOW, cfg: { core_min: 4 } });
    const ids = cp.core.map(c => c.prompt_id);
    const e1 = cp.extend.find(x => x.prompt_id === 'p1'), e7 = cp.extend.find(x => x.prompt_id === 'p7');
    check('AD3 core: a question that named the client 30 days ago is never dropped and gets `extend` to now + 56 days; a retired one that cited it stays too',
      ids.includes('p1') && ids.includes('p7') && e1 && e1.core_until === iso(NOW + 56 * DAY) && e7 && e7.core_until === iso(NOW + 56 * DAY) && /not asked now/.test(cp.core.find(c => c.prompt_id === 'p7').reason), J(cp));
    check('AD3 core: only the site market\'s active non-brand questions join (PK question and the brand question out); core_since kept for stored ones; intent / baseline / cluster carried',
      !ids.includes('p6') && !ids.includes('pB') && ['p2', 'p3', 'p4', 'p5'].every(x => ids.includes(x)) && cp.core.find(c => c.prompt_id === 'p1').core_since === ago(40)
      && cp.core.find(c => c.prompt_id === 'p1').baseline === 'zero' && cp.core.every(c => c.intent && c.cluster !== undefined), J(cp.core));
    check('AD3 proposals carry the site market, skip another country and a keyword the panel already covers; nothing is activated',
      cp.proposed.length === 1 && cp.proposed[0].keyword === 'erp support dubai' && cp.proposed[0].market === 'AE-en' && cp.proposed[0].source === 'client' && /\?$/.test(cp.proposed[0].prompt), J(cp.proposed));
    check('AD3 comparable false when the core changed (and why says so)', cp.comparable === false && /core changed/.test(cp.why), cp.why);
    const st2 = cp.core.map(c => ({ prompt_id: c.prompt_id, core: true, core_since: c.core_since, core_until: c.core_until }));
    const cp2 = ARD.corePanel({ site: { site_id: 's' }, prompts: prompts.map(p => p.prompt_id === 'p3' ? { ...p, status: 'retired' } : p.prompt_id === 'p9' ? p : p).concat([P('p9', { volume: 9999 })]), units60: [], stored: st2, market: { cc: 'AE', lang: 'en' }, demand: {}, now: NOW + 7 * DAY, cfg: { core_max: 6, core_min: 4 } });
    check('AD3 frozen 8 weeks: a week later the same core (a question retired by the focus rules stays; a new high-demand question waits for room) and comparable is true',
      J(cp2.core.map(c => c.prompt_id).sort()) === J(ids.slice().sort()) && cp2.comparable === true && cp2.core.find(c => c.prompt_id === 'p3').core_since === cp.core.find(c => c.prompt_id === 'p3').core_since && /frozen until/.test(cp2.core.find(c => c.prompt_id === 'p3').reason), J(cp2.core));
    const cp3 = ARD.corePanel({ site: { site_id: 's' }, prompts: prompts.map(p => p.prompt_id === 'p3' ? { ...p, status: 'retired' } : p), units60: [], stored: st2, market: { cc: 'AE', lang: 'en' }, demand: {}, now: NOW + 60 * DAY, cfg: { core_min: 4 } });
    check('AD3 after its 8 weeks a retired question with no hit leaves the core; an active one is renewed with its first core_since', !cp3.core.some(c => c.prompt_id === 'p3') && cp3.core.find(c => c.prompt_id === 'p2').core_since === cp.core.find(c => c.prompt_id === 'p2').core_since && cp3.extend.some(x => x.prompt_id === 'p2'), J(cp3.core));
    const H0 = AVX.history({ rule: F.AIV_RULE, from: iso(NOW - 60 * DAY), to: F.now, vis_rows: T.seo_ai_visibility.filter(x => x.site_id === F.archetypes.acme.site_id), daily_rows: T.seo_ai_daily.filter(x => x.site_id === F.archetypes.acme.site_id) });
    const cpA = ARD.corePanel({ site: { site_id: F.archetypes.acme.site_id }, prompts: T.seo_ai_prompts.filter(p => p.site_id === F.archetypes.acme.site_id), units60: H0.units, stored: [], market: mA, demand: {}, now: NOW, cfg: {} });
    check('AD3 archetype: acme\'s winning question (focus_state watch, the one the focus rules would retire) is core because it names the client', cpA.core.some(c => c.prompt_id === 'aq1' && /named or cited/.test(c.reason)) && !cpA.core.some(c => c.prompt_id === 'aq7'), J(cpA.core.map(c => c.prompt_id + ':' + c.reason.slice(0, 30))));

    // ---- AD4 arms ----
    const core30 = Array.from({ length: 30 }, (_, i) => ({ prompt_id: 'a' + i, intent: i % 3 ? 'recommendation' : 'informational', baseline: i % 4 ? 'zero' : 'some', cluster: 'k' + (i % 6) }));
    const A1 = ARD.assignArms({ core: core30, stored: [], seed: 'seed-1', now: NOW, site_id: 's' }), A2 = ARD.assignArms({ core: core30, stored: [], seed: 'seed-1', now: NOW, site_id: 's' });
    const byS = new Map(); for (const a of A1) { const t = byS.get(a.stratum) || [0, 0]; t[0]++; if (a.arm === 'control') t[1]++; byS.set(a.stratum, t); }
    // FX-A RA-2: the control target is floor(N / 3) for the panel, shared out floor(n / 3) per stratum with the remainder to the largest fractions
    check('AD4 arms: deterministic for a seed; at most 4 clusters (the rest pooled); strata under 3 questions merged into a coarser one; each stratum holds floor(n/3) or ceil(n/3) controls; exactly 10 controls of 30 (FX-A RA-2)',
      J(A1) === J(A2) && A1.length === 30 && [...byS.values()].every(([n, c]) => c >= Math.floor(n / 3) && c <= Math.ceil(n / 3)) && [...byS.entries()].every(([k, [n]]) => n >= 3 || k === '*|*|*')
      && A1.every(a => !/\|k[45]$/.test(a.stratum) || false) && A1.filter(a => a.arm === 'control').length === 10, J([...byS.entries()]));
    const stA = A1.map(a => ({ ...a, core: true, core_since: ago(10) }));
    const A3 = ARD.assignArms({ core: core30, stored: stA, seed: 'another-seed', now: NOW, site_id: 's' });
    check('AD4 stored arms are never reshuffled (another seed, same arms and strata)', J(A3.map(a => [a.prompt_id, a.arm, a.stratum])) === J(A1.map(a => [a.prompt_id, a.arm, a.stratum])), '');
    const strat = (n) => Array.from({ length: n }, (_, i) => ({ prompt_id: 'x' + i, intent: 'recommendation', baseline: 'zero', cluster: 'k' }));
    const T3 = ARD.assignArms({ core: strat(3), stored: [], seed: 's', now: NOW }); const T3s = T3.map(a => ({ ...a, core: true }));
    const T4 = ARD.assignArms({ core: strat(4), stored: T3s, seed: 's', now: NOW }); const T2 = ARD.assignArms({ core: strat(2), stored: [], seed: 's', now: NOW });
    const T2s = T2.map(a => ({ ...a, core: true })); const T2b = ARD.assignArms({ core: strat(3), stored: T2s, seed: 's', now: NOW });
    check('AD4 a new question takes the next slot of its stratum: after T,T,C a treated one; after T,T a control one', T3.filter(a => a.arm === 'control').length === 1 && T4.find(a => a.prompt_id === 'x3').arm === 'treated' && T2.every(a => a.arm === 'treated') && T2b.find(a => a.prompt_id === 'x2').arm === 'control', J({ T3, T4, T2b }));
    const rot = ARD.assignArms({ core: strat(4), stored: T3s.map(a => a.arm === 'control' ? { ...a, assigned_at: ago(90) } : a), seed: 's', now: NOW });
    check('AD4 the holdout rotates: a control question 12 weeks old becomes treated, and the next new question refills the control arm', rot.filter(a => a.arm === 'control').length === 1 && rot.find(a => a.prompt_id === 'x3').arm === 'control' && T3s.filter(a => a.arm === 'control').every(c => rot.find(a => a.prompt_id === c.prompt_id).arm === 'treated'), J(rot));

    // ---- AD14 the real shapes the 2026-11-06 replay found (synthetic rows that mimic them; no client data) ----
    // (a) a panel that drifted to another country: the site's market comes from the client's keywords (AE), every active question is PK-en,
    //     the AE questions were retired, one retired AE question cited the client. The core held 1 question and no control.
    const Rp = (id, o) => P(id, { kind: pick14(id), cluster: ['cl one', 'cl two', 'cl three'][id.charCodeAt(id.length - 1) % 3], ...(o || {}) });
    function pick14(id) { return ['recommend', 'compare', 'choose', 'cost', 'problem'][id.charCodeAt(id.length - 1) % 5]; }
    const drift = [...Array.from({ length: 9 }, (_, i) => Rp('pk' + i, { market: 'PK-en', status: 'active' })), ...Array.from({ length: 9 }, (_, i) => Rp('ae' + i, { market: 'AE-en', status: 'retired', retired_at: ago(10) })), P('br', { kind: 'brand', market: 'AE-en' })];
    const dUnits = [{ prompt_id: 'ae3', engine: 'gemini', named: true, cited: false, at: ago(9), answered: true }, ...drift.filter(p => p.status === 'active').flatMap((p, i) => [0, 1, 2].map(d => ({ prompt_id: p.prompt_id, engine: 'chatgpt', named: false, cited: false, rivals: i % 2 ? [{ id: 'r.example' }] : [], at: ago(d * 3 + 1), answered: true })))];
    const cpD = ARD.corePanel({ site: { site_id: 'sd' }, prompts: drift, units60: dUnits, stored: [], market: { cc: 'AE', lang: 'en' }, demand: { candidates: [{ keyword: 'ai development company uae', source: 'ladder', volume: 0 }] }, now: NOW, cfg: {} });
    const armsD = ARD.assignArms({ core: cpD.core, stored: [], seed: 'sd', now: NOW, site_id: 'sd' });
    check('AD14 drifted panel: the core holds the questions that are asked (9 PK ones, labelled outside your market) plus the retired AE one that cited the client; not 1',
      cpD.core.length === 10 && cpD.core.filter(c => /outside your market/.test(c.reason)).length === 9 && cpD.core.some(c => c.prompt_id === 'ae3') && !cpD.core.some(c => c.prompt_id === 'br'), J(cpD.core.map(c => c.prompt_id + ': ' + c.reason)));
    check('AD14 drifted panel: the retired questions of the market are proposed again first (revive = their id, market AE-en), then the client keywords; and the arms hold controls',
      cpD.proposed.length === 5 && cpD.proposed.slice(0, 4).every(x => x.source === 'retired_in_market' && /^ae\d$/.test(x.revive) && x.market === 'AE-en') && armsD.filter(a => a.arm === 'control').length >= 2, J({ p: cpD.proposed, a: armsD }));
    const cpOff = ARD.corePanel({ site: { site_id: 'sd' }, prompts: drift, units60: dUnits, stored: [], market: { cc: 'AE', lang: 'en' }, demand: {}, now: NOW, cfg: { core_min: 0 } });
    check('AD14 cfg.core_min = 0 keeps DESIGN A3 to the letter (only the market\'s questions and the hit)', cpOff.core.length === 1, J(cpOff.core));
    // (b) a 13-question core spread over 7 clusters, both intents, both baselines: 10 fine strata of 1-2 questions, every arm treated before
    const wide = Array.from({ length: 13 }, (_, i) => ({ prompt_id: 'w' + i, intent: i < 11 ? 'recommendation' : 'informational', baseline: i % 3 === 0 ? 'some' : 'zero', cluster: 'cluster ' + (i % 7) }));
    const armsW = ARD.assignArms({ core: wide, stored: [], seed: 'site_w', now: NOW, site_id: 'site_w' }); const cW = armsW.filter(a => a.arm === 'control').length;
    const bySW = new Map(); for (const a of armsW) { const t = bySW.get(a.stratum) || [0, 0]; t[0]++; if (a.arm === 'control') t[1]++; bySW.set(a.stratum, t); }
    check('AD14 thin strata are merged: 13 questions over 7 clusters get ' + cW + ' controls (4 = floor(13/3), FX-A RA-2), every merged stratum floor(n/3) or ceil(n/3)', cW === 4 && [...bySW.values()].every(([n, c]) => c >= Math.floor(n / 3) && c <= Math.ceil(n / 3)), J([...bySW.entries()]));
    const armsW2 = ARD.assignArms({ core: [...wide, { prompt_id: 'w13', intent: 'recommendation', baseline: 'zero', cluster: 'cluster 3' }], stored: armsW.map(a => ({ ...a, core: true, core_since: ago(7) })), seed: 'site_w', now: NOW, site_id: 'site_w' });
    check('AD14 the merged arms are stored and kept a week later; the new question takes a slot', J(armsW2.slice(0, 13).map(a => a.arm)) === J(armsW.map(a => a.arm)) && armsW2.length === 14, J(armsW2));
    check('AD14 the real kinds (choose / cost / problem / compare) give an intent when answers are few', ARD.intentOf({ kind: 'choose' }, []) === 'recommendation' && ARD.intentOf({ kind: 'cost' }, []) === 'informational' && ARD.intentOf({ kind: 'problem' }, []) === 'informational' && ARD.intentOf({ kind: 'compare' }, []) === 'recommendation', '');

    // ---- AD5 MDE (R1 §6: m = 28, 80% power, alpha 0.05 two-sided) ----
    const R1T = [[0.02, 40, 5.0, 7.1, 6.9, 9.7], [0.02, 100, 3.2, 4.5, 4.3, 6.1], [0.10, 40, 10.7, 15.2, 14.7, 20.8], [0.10, 100, 6.8, 9.6, 9.3, 13.2], [0.10, 200, 4.8, 6.8, 6.6, 9.3], [0.30, 100, 10.4, 14.6, 14.2, 20.1]];
    const off = []; for (const [p, q, a, b, c, d] of R1T) { const x = ARD.mde({ q_t: q, q_c: q, m: 28, p, rho: 0.3 }), y = ARD.mde({ q_t: q, q_c: q, m: 28, p, rho: 0.6 });
      for (const [got, want] of [[x.prepost, a], [x.did, b], [y.prepost, c], [y.did, d]]) if (!(Math.abs(got - want) <= 0.1 + 1e-9)) off.push([p, q, got, want]); }
    check('AD5 MDE reproduces all 24 figures of R1 §6 within 0.1 point', !off.length, J(off));
    const k1 = ARD.mde({ q_t: 16, q_c: 8, m: 28, p: 0, rho: 0.3 }), k2 = ARD.mde({ q_t: 20, q_c: 10, m: 28, p: 0, rho: 0.3 });
    const C = (n, r) => { let x = 1; for (let i = 0; i < r; i++) x = x * (n - i) / (i + 1); return x; };
    // FX-A RA-12: one alpha - the first-appearance test is judged one-sided at 0.025, as the DiD's two-sided 95% range (was 0.05: k 7 / 7)
    check('AD5 first appearances (one-sided 0.025, FX-A RA-12): k = 8 for 16 / 8 (p 0.0175); for 20 / 10 k = 8 (p 0.0215), because C(20,7)/C(30,7) = 0.038 is above 0.025',
      k1.first_appearance_k === 8 && Math.abs(k1.first_appearance_p - 0.0175) < 0.001 && k2.first_appearance_k === 8 && Math.abs(k2.first_appearance_p - 0.0215) < 0.001 && C(20, 7) / C(30, 7) > 0.025 && C(20, 8) / C(30, 8) < 0.025, J({ k1, k2 }));
    const z0 = ARD.mde({ q_t: 10, q_c: 0, m: 28, p: null, rho: 0.3 });
    check('AD5 a zero / unknown baseline plans with 2%; no control arm -> no DiD and no first-appearance test, said in words', z0.p_used === 0.02 && z0.did === null && z0.prepost > 0 && z0.first_appearance_k === null && /no control/.test(z0.basis) && /2% used/.test(z0.basis), J(z0));

    // ---- AD6 stages ----
    const DC = FX.make({ diag_cases: true }).diag_cases;
    const runCase = (c) => ARD.diagnose(c.args).engines[c.engine];
    const rule = (stage, sub, basis, eng) => DC.filter(c => c.label.stage === stage && c.label.sub === (sub || '') && (!basis || c.label.basis === basis) && (!eng || c.engine === eng));
    const RULES = [['robots block', 'S0', 'blocked'], ['js_only', 'S0', 'js_only'], ['Bing not in account', 'S0', 'not_indexed', null, 'copilot'], ['Google not indexed', 'S0', 'not_indexed', null, 'ai_mode'],
      ['chatgpt retrieved, direct', 'S2', '', 'direct', 'chatgpt'], ['ai_mode proxy rank', 'S2', '', 'proxy_rank', 'ai_mode'], ['cited, not named', 'S3', ''], ['named weak', 'S4', 'weak'], ['named low in the list', 'S4', 'low_position'],
      ['negative', 'S4', 'negative'], ['wrong claim', 'S4', 'wrong'], ['won', 'S5', ''], ['unmeasured (too few)', 'unmeasured', 'too_few'], ['claude unknown_index', 'S1', '', 'unknown_index', 'claude']];
    for (const [name, stage, sub, basis, eng] of RULES) { const cs = rule(stage, sub, basis, eng); const bad = cs.filter(c => { const x = runCase(c); return x.stage !== c.label.stage || x.sub !== c.label.sub || x.basis !== c.label.basis; });
      check('AD6 stage rule "' + name + '": ' + cs.length + ' labelled cell(s), all read right', cs.length > 0 && !bad.length, J(bad.map(c => [c.id, c.engine, c.label, runCase(c)]))); }
    const c0 = DC[0]; const dAll = ARD.diagnose({ ...c0.args, engines: [...c0.args.engines, 'copilot'], units60: c0.args.units60.filter(u => u.engine !== 'copilot'), answers8: c0.args.answers8.filter(a => a.engine !== 'copilot') });
    check('AD6 an engine with no answer is unmeasured / not_asked; every cell carries stage, sub, basis, n and at most 3 evidence items', dAll.engines.copilot.stage === 'unmeasured' && dAll.engines.copilot.sub === 'not_asked'
      && DC.every(c => { const x = runCase(c); return AIRF.STAGE_LABELS.includes(x.stage) && ['direct', 'proxy_rank', 'unknown_index'].includes(x.basis) && Number.isFinite(x.n) && Array.isArray(x.evidence) && x.evidence.length <= 3; }), J(dAll.engines.copilot));
    // the archetypes, end to end from the stored shapes (units through AVX.history, the index, the SERP cache rows, the robots verdicts)
    const arche = (A, extra) => { const sid = A.site_id; const site = T.seo_sites.find(s => s.site_id === sid);
      const Hh = AVX.history({ rule: F.AIV_RULE, from: iso(NOW - 60 * DAY), to: F.now, vis_rows: T.seo_ai_visibility.filter(x => x.site_id === sid), daily_rows: T.seo_ai_daily.filter(x => x.site_id === sid) });
      const google = new Map(T.seo_index_pages.filter(x => x.site_id === sid).map(x => [AIRF.urlKey(x.url), x.state]));
      const serp = new Map(T.seo_cache.filter(r => r.kind === 'serp').map(r => { const v = JSON.parse(r.value); return [v.keyword, { results: v.items.map(i => ({ url: i.url, pos: i.rank_group })), read_at: v.at, location_code: v.location_code }]; }));
      const robots = {}; for (const b of ['OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot', 'Googlebot', 'Bingbot']) robots[b] = { allowed_root: true, rule: '' };
      const out = {}; for (const p of T.seo_ai_prompts.filter(x => x.site_id === sid)) out[p.prompt_id] = ARD.diagnose({ site, prompt: p, answers8: T.seo_ai_answers.filter(a => a.site_id === sid && Date.parse(a.checked_at) > NOW - 8 * DAY),
        units60: Hh.units, evidence: '', access: { robots, blocked_engines: [], read_at: F.now }, pages: T.seo_ai_pages.filter(x => x.site_id === sid), index: { google, bing: { in_account: A.bing_in_account, crawled: new Map() }, brave: null, cc_captures: null },
        serp, ourHosts: [A.domain], rivals: site.competitors.split(', '), now: NOW, cfg: {}, ...(extra || {}) });
      return out; };
    const DN = arche(F.archetypes.nova), DA = arche(F.archetypes.acme);
    check('AD6 archetype nova: its service questions are S0 everywhere it is measured (Google: page not indexed; ChatGPT / Perplexity / Claude: JavaScript-only page; Copilot: not in Bing)',
      ['ai_mode', 'ai_overview', 'gemini'].every(e => DN.nq1.engines[e].stage === 'S0' && DN.nq1.engines[e].sub === 'not_indexed') && ['chatgpt', 'perplexity', 'claude'].every(e => DN.nq1.engines[e].sub === 'js_only')
      && DN.nq1.engines.copilot.sub === 'not_indexed' && DN.nq1.best_stage === 'S0' && DN.nq1.list_dominated === true && DN.nq1.engines.claude.thin === true, J(DN.nq1.engines));
    check('AD6 archetype nova: a question with no page of its own (nq5) is S1, read from the results pages (proxy) and ChatGPT\'s own readings (direct); Claude unknown_index',
      DN.nq5.engines.chatgpt.stage === 'S1' && DN.nq5.engines.chatgpt.basis === 'direct' && DN.nq5.engines.ai_mode.basis === 'proxy_rank' && DN.nq5.engines.claude.basis === 'unknown_index' && DN.nq5.engines.copilot.sub === 'not_indexed', J(DN.nq5.engines));
    check('AD6 archetype acme: the winning question is S5 on ChatGPT and AI Mode (named, positions 2-3); its own page cited by Perplexity is S3; ChatGPT read the Odoo page (S2 direct)',
      DA.aq1.engines.chatgpt.stage === 'S5' && DA.aq1.engines.ai_mode.stage === 'S5' && DA.aq5.engines.perplexity.stage === 'S3' && DA.aq4.engines.chatgpt.stage === 'S2' && DA.aq4.engines.chatgpt.basis === 'direct'
      && DA.aq1.engines.ai_overview.stage === 'S1' && DA.aq1.engines.ai_overview.basis === 'proxy_rank' && DA.aq1.engines.ai_overview.our_rank && DA.aq1.engines.ai_overview.our_rank.pos > 10 && DA.aq1.first_named_at && DA.aq1.last_named_at, J({ aq1: DA.aq1.engines, aq5: DA.aq5.engines.perplexity }));
    const DNb = arche(F.archetypes.nova, { access: { robots: { 'OAI-SearchBot': { allowed_root: false, rule: 'Disallow: /' }, PerplexityBot: { allowed_root: false, rule: 'Disallow: /' } }, blocked_engines: [], read_at: F.now } });
    check('AD6 archetype nova with the week-1 robots.txt (GPTBot, OAI-SearchBot, PerplexityBot blocked): ChatGPT and Perplexity are S0 blocked with the robots line, Google engines unchanged',
      DNb.nq1.engines.chatgpt.sub === 'blocked' && DNb.nq1.engines.perplexity.sub === 'blocked' && DNb.nq1.engines.chatgpt.evidence[0].rule === 'Disallow: /' && DNb.nq1.engines.ai_mode.sub === 'not_indexed', J(DNb.nq1.engines.chatgpt));

    // ---- AD7 parametric, no_search, nobody_named, list_dominated ----
    const mkRow = (e, i, o) => ({ site_id: 's', domain: 'z.example', run_id: 'r' + i, checked_at: ago(1 + i * 0.1), prompt_id: 'pp', engine: e, answered: true, error: '', named: false, cited: false,
      cited_json: '[]', fanout_json: '', retrieved_json: '', entities_json: '[]', ...(o || {}) });
    const pr = [0, 1, 2, 3, 4].map(i => mkRow('perplexity', i, i === 4 ? { cited_json: J([{ url: 'https://top.example/best-x', host: 'top.example', role: 'source' }]) } : {}))
      .concat([0, 1, 2, 3].map(i => mkRow('chatgpt', 10 + i, { fanout_json: J(['x providers']), cited_json: J([{ url: 'https://clutch.co/ae/x', host: 'clutch.co', role: 'source' }, { url: 'https://top.example/best-x', host: 'top.example', role: 'source' }]) })));
    const dP = ARD.diagnose({ site: { domain: 'z.example' }, prompt: { prompt_id: 'pp', kind: 'learn', keyword: 'x' }, answers8: pr, units60: [], now: NOW, engines: ['perplexity', 'chatgpt'] });
    check('AD7 parametric share: answers with no citation and no search (Perplexity 4 of 5) -> no_search; ChatGPT searched -> not', dP.parametric_share.perplexity === 0.8 && dP.no_search.includes('perplexity') && dP.parametric_share.chatgpt === 0 && !dP.no_search.includes('chatgpt'), J(dP));
    check('AD7 list_dominated: 9 citations, all to a list or a directory', dP.list_dominated === true, J(dP));
    const nb = [0, 1, 2, 3, 4, 5].map(i => mkRow('gemini', i, { cited: i < 3, cited_json: J(i < 3 ? [{ url: 'https://z.example/guide', host: 'z.example', role: 'self' }, { url: 'https://vendor.example/services/x', host: 'vendor.example', role: 'source' }] : [{ url: 'https://vendor.example/services/x', host: 'vendor.example', role: 'source' }]) }));
    const dN = ARD.diagnose({ site: { domain: 'z.example' }, prompt: { prompt_id: 'pp', keyword: 'x' }, answers8: nb, units60: [], now: NOW, engines: ['gemini'] });
    check('AD7 nobody_named: an answer set that names no business is scored on citation (cited 3 of 6 -> S5); vendor pages do not make it list-dominated', dN.nobody_named === true && dN.intent === 'informational' && dN.engines.gemini.stage === 'S5' && dN.list_dominated === false, J(dN));

    // ---- AD8 page classification ----
    const PT = JSON.parse(fs.readFileSync(path.join(__dirname, 'air_page_types.json'), 'utf8')); const ctxP = PT.context;
    let okT = 0, okA = 0; const missT = [], missA = [];
    for (const c of PT.cases) { const r = ARD.classifyPage({ url: c.url, title: c.title, rivals: ctxP.rivals, ourHosts: ctxP.ourHosts }); if (r.page_type === c.page_type) okT++; else missT.push([c.url, c.page_type, r.page_type, r.why]); if (r.author_kind === c.author_kind) okA++; else missA.push([c.url, c.author_kind, r.author_kind]); }
    const accT = okT / PT.cases.length, accA = okA / PT.cases.length;
    console.log('   AD8 page type ' + okT + '/' + PT.cases.length + ' (' + (100 * accT).toFixed(1) + '%), author ' + okA + '/' + PT.cases.length + ' (' + (100 * accA).toFixed(1) + '%)');
    check('AD8 page type on the labelled set: >= 40 cases, >= 95% right (' + okT + '/' + PT.cases.length + ')', PT.cases.length >= 40 && accT >= 0.95, J(missT));
    check('AD8 author kind on the labelled set: >= 95% right (' + okA + '/' + PT.cases.length + ')', accA >= 0.95, J(missA));
    const ans8 = [{ site_id: 's', domain: 'c.example', run_id: 'r1', checked_at: ago(2), prompt_id: 'q1', engine: 'chatgpt', answered: true, error: '', cited_json: J([{ url: 'https://rival-a.example/blog/top-erp-partners', host: 'rival-a.example', role: 'source' }, { url: 'https://walled.example/news/x', host: 'walled.example', role: 'source' }, { url: 'https://ok.example/top-10-erp', host: 'ok.example', role: 'source' }]) }];
    const src = ARD.sources({ answers8: ans8, storedSources: [{ url_key: 'ok.example/top-10-erp', url: 'https://ok.example/top-10-erp', names_client: true }], fetched: [{ url: 'https://walled.example/news/x', fetch_status: 403, mentions_us: false }, { url: 'https://rival-a.example/blog/top-erp-partners', fetch_status: 200, mentions_us: false, competitors_named: ['rival-a.example'] }],
      prompts: [{ prompt_id: 'q1' }], values: {}, rivals: ['rival-a.example'], ourHosts: ['c.example'], now: NOW });
    const sR = src.find(x => x.host === 'rival-a.example'), sW = src.find(x => x.host === 'walled.example'), sO = src.find(x => x.host === 'ok.example');
    check('AD8 a rival\'s list is kept (author rival, placeability 0.02, learn only); a 403 page names_client null (never false); a stored reading carried forward when not fetched',
      sR && sR.page_type === 'listicle' && sR.author_kind === 'rival' && sR.placeability === 0.02 && sR.names_client === false && J(sR.rivals_named) === J(['rival-a.example']) && sW && sW.names_client === null && sO && sO.names_client === true && sO.placeability === 0, J(src));

    // ---- AD9 influence and placeability ----
    const r9 = (i, pid, e, urls, o) => ({ site_id: 's', domain: 'c.example', run_id: 'r' + i, checked_at: ago(3 + i * 0.01), prompt_id: pid, engine: e, answered: true, error: '', kind: pid === 'qb' ? 'brand' : 'recommend',
      cited_json: J(urls.map((u, j) => ({ url: u, host: u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''), role: /c\.example/.test(u) ? 'self' : 'source', position: j + 1 }))), ...(o || {}) });
    const X = 'https://lists.example/best-erp-partners', XW = 'https://www.lists.example/best-erp-partners/', Y = 'https://clutch.co/ae/erp';
    const A9 = [r9(1, 'q1', 'chatgpt', [X, XW]), r9(2, 'q1', 'ai_mode', [X, 'https://c.example/p']), r9(3, 'q1', 'perplexity', []), r9(4, 'q1', 'gemini', ['https://c.example/p']),
      r9(5, 'q2', 'chatgpt', [X, Y]), r9(6, 'q2', 'ai_mode', [Y]), r9(7, 'q2', 'gemini', [Y]), r9(8, 'q2', 'perplexity', []), r9(9, 'q2', 'copilot', []),
      r9(10, 'qb', 'chatgpt', [Y, X]), r9(11, 'q2', 'gemini_api', [Y, X]), r9(12, 'q1', 'chatgpt', [X], { checked_at: ago(40) })];
    const s9 = ARD.sources({ answers8: A9, fetched: [{ url: X, fetch_status: 200, mentions_us: false, contact_email: 'ed@lists.example' }], prompts: [{ prompt_id: 'q1' }, { prompt_id: 'q2' }, { prompt_id: 'qb', kind: 'brand' }], values: { q1: 2, q2: { V: 1 } }, rivals: [], ourHosts: ['c.example'], now: NOW });
    const sx = s9.find(x => x.url_key === 'lists.example/best-erp-partners'), sy = s9.find(x => x.url_key === 'clutch.co/ae/erp');
    check('AD9 influence = sum over questions V(q) x cites / answers: X = 2 x 2/4 + 1 x 1/5 = 1.2, Y = 1 x 3/5 = 0.6 (www and the trailing slash one page, a repeat in one answer counted once, the brand question, gemini_api and a 40-day-old answer left out)',
      s9.length === 2 && sx && Math.abs(sx.influence - 1.2) < 1e-9 && sx.cites_28d === 3 && J(sx.questions) === J(['q1', 'q2']) && sy && Math.abs(sy.influence - 0.6) < 1e-9 && sy.cites_28d === 3 && J(sy.engines) === J(['ai_mode', 'chatgpt', 'gemini']), J(s9));
    check('AD9 placeability: editorial list with a contact 0.15, directory 0.80; ordered by influence x placeability (Y 0.48 before X 0.18)', sx.placeability === 0.15 && sx.contact_email === 'ed@lists.example' && sy.placeability === 0.8 && s9[0] === sy && sx.from === 'answers', J(s9.map(x => [x.url_key, x.influence, x.placeability])));
    const sNo = ARD.sources({ answers8: A9, fetched: [], prompts: [{ prompt_id: 'q1' }, { prompt_id: 'q2' }], values: { q1: 2, q2: 1 }, rivals: [], ourHosts: ['c.example'], now: NOW, mentionsPages: [{ url: 'https://new.example/top-erp', title: 'Top ERP', mentions: 4 }] });
    check('AD9 no contact found: editorial list 0.05; an LLM Mentions page joins as from llm_mentions with no citation', sNo.find(x => x.url_key === 'lists.example/best-erp-partners').placeability === 0.05 && sNo.some(x => x.url_key === 'new.example/top-erp' && x.from === 'llm_mentions' && x.cites_28d === 0 && x.page_type === 'listicle'), J(sNo));

    // ---- AD10 sandbox and speed ----
    const src10 = rd('_ai_rank_diag.js');
    check('AD10 sandbox: no URL constructor, no defineProperty / setPrototypeOf / structuredClone, no build placeholder or em dash in the kit (it ran above under the shims)',
      !/new\s+URL\s*\(/.test(src10) && !/Object\.(defineProperty|defineProperties|setPrototypeOf)\s*\(|structuredClone\s*\(/.test(src10) && !/\/\*__/.test(src10) && !/[—‘’“”…]/.test(src10), '');
    const E7 = ['chatgpt', 'gemini', 'ai_mode', 'ai_overview', 'perplexity', 'claude', 'copilot']; const big = [], bigU = []; const QS = Array.from({ length: 50 }, (_, i) => ({ prompt_id: 'b' + i, keyword: 'kw ' + i, kind: 'recommend' }));
    for (const q of QS) for (const e of E7) for (let i = 0; i < 30; i++) { const at = ago(i * 0.25); const named = (i + q.prompt_id.length) % 7 === 0;
      big.push({ site_id: 's', domain: 'big.example', run_id: 'w' + i, checked_at: at, prompt_id: q.prompt_id, engine: e, answered: true, error: '', named, position: named ? 2 : null, cited: i % 9 === 0,
        cited_json: J([{ url: 'https://lists' + (i % 5) + '.example/best-' + q.prompt_id, host: 'lists' + (i % 5) + '.example', role: 'source' }, { url: 'https://clutch.co/ae/x' + (i % 3), host: 'clutch.co', role: 'source' }]),
        retrieved_json: e === 'chatgpt' ? J([{ url: 'https://big.example/p', host: 'big.example' }]) : '', fanout_json: e === 'chatgpt' ? J([q.keyword + ' uae', 'best ' + q.keyword]) : '', entities_json: J([{ id: 'r.example', role: 'competitor', position: 1 }]) });
      bigU.push({ prompt_id: q.prompt_id, engine: e, named, cited: i % 9 === 0, position: named ? 2 : null, rivals: [{ id: 'r.example' }], answered: true, at }); }
    // timed twice: the first pass is cold (every answer parsed for the first time, the JIT not warm), the second is the steady state.
    // 10,500 answers is about ten times a real site's week (20 questions, 8 days); fixes/P1.md has the figures.
    const pass = () => { const t0 = Date.now(); const outs = QS.map(q => ARD.diagnose({ site: { domain: 'big.example' }, prompt: q, answers8: big, units60: bigU, now: NOW, engines: E7 }));
      const srcBig = ARD.sources({ answers8: big, prompts: QS, values: {}, rivals: [], ourHosts: ['big.example'], now: NOW }); return { ms: Date.now() - t0, outs, srcBig }; };
    const cold = pass(), warm = pass();
    console.log('   AD10 50 questions x 7 engines x 30 answers (10,500 answers): diagnose + sources cold ' + cold.ms + ' ms, steady ' + warm.ms + ' ms');
    check('AD10 speed: 50 questions x 7 engines x 30 answers diagnosed (plus the source graph) in under 200 ms in the steady state (' + warm.ms + ' ms) and under 1 s cold (' + cold.ms + ' ms); the same result both times',
      warm.ms < 200 && cold.ms < 1000 && warm.outs.length === 50 && warm.outs.every(o => Object.keys(o.engines).length === 7) && warm.srcBig.length > 0 && J(cold.outs) === J(warm.outs) && J(cold.srcBig) === J(warm.srcBig), J([cold.ms, warm.ms]));

    // ---- AD11 rollEvidence ----
    const ev0 = (d, e, o) => ({ site_id: 's', domain: 'c.example', run_id: 'r' + d + e, checked_at: ago(d), prompt_id: 'q', engine: e, answered: true, error: '', named: true, cited: true, position: 1,
      cited_json: J([{ url: 'https://c.example/a', host: 'c.example', role: 'self' }]), fanout_json: J(['old search ' + Math.floor(d)]), ...(o || {}) });
    const evOld = ARD.rollEvidence({ stored: '', answers8: [ev0(130, 'chatgpt'), ev0(20, 'chatgpt'), ev0(20, 'ai_mode')], now: NOW - 0 * DAY, prompt_id: 'q' });
    const evNew = ARD.rollEvidence({ stored: evOld, answers8: [ev0(2, 'perplexity', { named: false })], now: NOW, prompt_id: 'q' }); const EV = JSON.parse(evNew);
    const keys = Object.keys(EV.c);
    check('AD11 counts older than 8 days are kept (20-day answers still counted), entries older than 120 days dropped, the first-named date kept', keys.some(k => /\|chatgpt$/.test(k)) && keys.some(k => /\|perplexity$/.test(k)) && !keys.some(k => k.startsWith(ago(130).slice(0, 10)))
      && EV.fn === ago(130).slice(0, 19) + '.000Z' && !Object.keys(EV.f).includes('old search 130') && Object.keys(EV.f).includes('old search 20'), J(EV));
    check('AD11 idempotent: rolling the same answers again counts nothing twice', ARD.rollEvidence({ stored: evNew, answers8: [ev0(2, 'perplexity', { named: false })], now: NOW, prompt_id: 'q' }) === evNew, '');
    const flood = []; for (let d = 0; d < 120; d++) for (const e of AIRF.ENGINES) flood.push(ev0(d + 0.5, e, { fanout_json: J(Array.from({ length: 4 }, (_, i) => 'flood query ' + d + ' ' + i + ' ' + e)) }));
    const evF = ARD.rollEvidence({ stored: '', answers8: flood, now: NOW, prompt_id: 'q' }); let okJ = true; try { JSON.parse(evF); } catch (e) { okJ = false; }
    const dF = ARD.diagnose({ site: { domain: 'c.example' }, prompt: { prompt_id: 'q' }, answers8: [], units60: [], evidence: evF, now: NOW, engines: ['chatgpt'] });
    check('AD11 capped at 8 KB (960 answers, 3,840 searches) and still valid, readable evidence (recent counts survive, the diagnosis reads them)', evF.length <= 8000 && okJ && dF.engines.chatgpt.n > 0 && dF.first_named_at !== '', evF.length);
    check('AD11 nothing stored and no answer -> ""; a stored history is returned (re-dated) when there is nothing new', ARD.rollEvidence({ stored: '', answers8: [], now: NOW }) === '' && JSON.parse(ARD.rollEvidence({ stored: evNew, answers8: [], now: NOW })).fn === EV.fn, '');

    // ---- AD12 gemini_api ignored everywhere ----
    const gRows = (o) => [0, 1, 2, 3, 4, 5].map(i => ({ site_id: 's', domain: 'c.example', run_id: 'g' + i, checked_at: ago(1 + i * 0.1), prompt_id: 'q', engine: 'gemini_api', answered: true, error: '', named: true, cited: true, position: 1,
      cited_json: J([{ url: 'https://c.example/a', host: 'c.example', role: 'self' }, { url: 'https://lists.example/best', host: 'lists.example', role: 'source' }]), fanout_json: J(['gemini api search']), entities_json: J([{ id: 'r.example', role: 'competitor', position: 2 }]), ...(o || {}) }));
    const base = DC.find(c => c.label.stage === 'S1' && c.engine === 'chatgpt');
    const dG0 = ARD.diagnose(base.args), dG1 = ARD.diagnose({ ...base.args, answers8: [...base.args.answers8, ...gRows({ prompt_id: base.args.prompt.prompt_id })], units60: [...base.args.units60, ...gRows({ prompt_id: base.args.prompt.prompt_id }).map(r => ({ prompt_id: r.prompt_id, engine: 'gemini_api', named: true, cited: true, at: r.checked_at, answered: true }))], engines: [...base.args.engines, 'gemini_api'] });
    const strip = (d) => J(d);
    check('AD12 gemini_api ignored by diagnose (no cell, the same reading with or without its rows that name and cite the client)', !('gemini_api' in dG1.engines) && strip(dG0) === strip(dG1), J(Object.keys(dG1.engines)));
    check('AD12 ... by intentOf, fanoutOf, rollEvidence and sources', ARD.intentOf({ prompt_id: 'q', kind: 'learn' }, gRows()) === 'informational' && ARD.fanoutOf({ prompt_id: 'q', answers8: gRows(), evidence: '' }).length === 0
      && ARD.rollEvidence({ stored: '', answers8: gRows(), now: NOW, prompt_id: 'q' }) === '' && ARD.sources({ answers8: gRows(), prompts: [{ prompt_id: 'q' }], ourHosts: ['c.example'], now: NOW }).length === 0, '');
    const cpG = ARD.corePanel({ prompts: [P('p1', { status: 'retired' })], units60: [{ prompt_id: 'p1', engine: 'gemini_api', named: true, at: ago(3), answered: true }], stored: [], market: { cc: 'AE' }, now: NOW });
    check('AD12 ... and by corePanel (a gemini_api answer naming the client does not keep a retired question in the core)', cpG.core.length === 0 && cpG.extend.length === 0, J(cpG));

    // ---- AD13 accuracy on the labelled cells (two seeds) ----
    const cells = [...DC, ...FX.diagCases({ seed: 'air-p1-diag-2', now: NOW })];
    const labels = AIRF.STAGE_LABELS; const tp = {}, fp = {}, fn = {}; let subOk = 0, basisOk = 0, exact = 0; const miss = [];
    for (const s of labels) { tp[s] = 0; fp[s] = 0; fn[s] = 0; }
    for (const c of cells) { const x = runCase(c); const g = c.label.stage;
      if (x.stage === g) tp[g]++; else { fp[x.stage] = (fp[x.stage] || 0) + 1; fn[g]++; miss.push([c.id, c.engine, c.label, x.stage + '/' + x.sub + '/' + x.basis, c.why]); }
      if (x.sub === c.label.sub) subOk++; if (x.basis === c.label.basis) basisOk++; if (x.stage === g && x.sub === c.label.sub && x.basis === c.label.basis) exact++; }
    const rows = labels.map(s => [s, tp[s] + fn[s], tp[s] + fp[s] ? tp[s] / (tp[s] + fp[s]) : 1, tp[s] + fn[s] ? tp[s] / (tp[s] + fn[s]) : 1]);
    console.log('   AD13 ' + cells.length + ' labelled cells: ' + rows.map(([s, n, p, r]) => s + ' n' + n + ' P' + (100 * p).toFixed(0) + ' R' + (100 * r).toFixed(0)).join(', ') + '; sub ' + (100 * subOk / cells.length).toFixed(1) + '%, basis ' + (100 * basisOk / cells.length).toFixed(1) + '%, exact ' + (100 * exact / cells.length).toFixed(1) + '%');
    for (const [s, n, p, r] of rows) check('AD13 stage ' + s + ': precision and recall >= 90% on ' + n + ' labelled cells (P ' + (100 * p).toFixed(1) + '%, R ' + (100 * r).toFixed(1) + '%)', n >= 6 && p >= 0.9 && r >= 0.9, J(miss.filter(m => m[1] === s || m[2].stage === s)));
    check('AD13 sub-label and basis right on >= 90% of the cells; boundary S0-S1 vs S2+ right on >= 95%', subOk / cells.length >= 0.9 && basisOk / cells.length >= 0.9
      && cells.filter(c => { const x = runCase(c); const lo = (s) => s === 'S0' || s === 'S1'; return c.label.stage !== 'unmeasured' && lo(x.stage) === lo(c.label.stage); }).length / cells.filter(c => c.label.stage !== 'unmeasured').length >= 0.95, J(miss));
    // ---- AD15 provisional S0 / S1 with 0-3 answers (DESIGN 2.B deviation, orchestrator 2026-11-06) ----
    const base15 = DC.find(c => c.label.stage === 'S1' && c.label.basis === 'proxy_rank' && c.engine === 'ai_mode');
    const cut = (args, e, keep) => { const ue = args.units60.filter(u => u.engine === e && u.prompt_id === args.prompt.prompt_id && Date.parse(u.at) > NOW - 28 * DAY).sort((a, b) => b.at.localeCompare(a.at)); const drop = new Set(ue.slice(keep).map(u => u.at));
      return { ...args, units60: args.units60.filter(u => !(u.engine === e && u.prompt_id === args.prompt.prompt_id && drop.has(u.at))), answers8: args.answers8.filter(a => !(a.engine === e && a.prompt_id === args.prompt.prompt_id && drop.has(a.checked_at))) }; };
    const p2 = ARD.diagnose(cut(base15.args, 'ai_mode', 2)).engines.ai_mode;
    check('AD15 two answers and a results-page reading below the top 10 -> S1 proxy_rank, provisional, the reading and the count as evidence', p2.stage === 'S1' && p2.basis === 'proxy_rank' && p2.provisional === true && p2.n === 2 && p2.evidence.some(x => x.kind === 'serp') && p2.evidence.some(x => /provisional/.test(x.what || '')), J(p2));
    const full15 = ARD.diagnose(base15.args).engines.ai_mode;
    check('AD15 with n >= 4 agreeing, the same S1 is no longer provisional', full15.stage === 'S1' && full15.provisional === false && full15.n >= 4, J(full15));
    const plus = (args, e, k, f) => { const extra = Array.from({ length: k }, (_, i) => ({ prompt_id: args.prompt.prompt_id, engine: e, named: false, cited: true, position: null, rivals: [{ id: 'rival-a.example' }], answered: true, at: ago(1 + i * 0.2) }));
      const rows = extra.map((u, i) => ({ site_id: 's', domain: 'case-co.example', run_id: 'x' + i, checked_at: u.at, prompt_id: u.prompt_id, engine: e, answered: true, error: '', named: false, cited: true,
        cited_json: J([{ url: 'https://case-co.example/services/erp-partner', host: 'case-co.example', role: 'self' }]), retrieved_json: '', fanout_json: '', entities_json: J([{ id: 'rival-a.example', role: 'competitor', position: 1 }]) }));
      return { ...args, units60: [...args.units60, ...extra], answers8: [...args.answers8, ...rows] }; };
    const p3 = ARD.diagnose(plus(cut(base15.args, 'ai_mode', 2), 'ai_mode', 2)).engines.ai_mode;
    check('AD15 provisional S1, then n >= 4 says the client is cited and not named -> S3 (the answer-based stage wins), not provisional', p3.stage === 'S3' && p3.provisional === false && p3.n === 4, J(p3));
    const pc = ARD.diagnose(plus(cut(base15.args, 'ai_mode', 1), 'ai_mode', 1)).engines.ai_mode;
    check('AD15 S2-S5 need n >= 4: two answers with a citation stay unmeasured / too_few', pc.stage === 'unmeasured' && pc.sub === 'too_few' && pc.provisional === false, J(pc));
    const s0c = DC.find(c => c.label.sub === 'js_only' && c.engine === 'chatgpt'); const s0 = ARD.diagnose(cut(s0c.args, 'chatgpt', 1)).engines.chatgpt;
    const b0c = DC.find(c => c.label.sub === 'not_indexed' && c.engine === 'copilot'); const pidB = b0c.args.prompt.prompt_id; const b0 = ARD.diagnose({ ...b0c.args, units60: b0c.args.units60.filter(u => !(u.engine === 'copilot' && u.prompt_id === pidB)), answers8: b0c.args.answers8.filter(a => !(a.engine === 'copilot' && a.prompt_id === pidB)) }).engines.copilot;
    check('AD15 S0 from the page (JavaScript-only) with 1 answer, and from Bing with 0 answers to this question (the site asks the engine) -> provisional S0', s0.stage === 'S0' && s0.sub === 'js_only' && s0.provisional === true && b0.stage === 'S0' && b0.sub === 'not_indexed' && b0.provisional === true && b0.n === 0, J({ s0, b0 }));
    const u0c = DC.find(c => c.label.stage === 'S1' && c.label.basis === 'unknown_index' && c.engine === 'chatgpt'); const u0 = ARD.diagnose(cut(u0c.args, 'chatgpt', 2)).engines.chatgpt;
    const d0c = DC.find(c => c.label.stage === 'S1' && c.label.basis === 'direct' && c.engine === 'chatgpt'); const d0 = ARD.diagnose(cut(d0c.args, 'chatgpt', 2)).engines.chatgpt;
    check('AD15 a provisional S1 needs a basis: ChatGPT\'s retrieved set without the client -> S1 direct provisional; no retrieval reading -> unmeasured', d0.stage === 'S1' && d0.basis === 'direct' && d0.provisional === true && u0.stage === 'unmeasured' && u0.sub === 'too_few', J({ d0, u0 }));
    const noCop = (args) => ({ ...args, units60: args.units60.filter(u => u.engine !== 'copilot'), answers8: args.answers8.filter(a => a.engine !== 'copilot') });
    const naD = ARD.diagnose(noCop(b0c.args)); const na = naD.engines.copilot;
    const naD2 = ARD.diagnose({ ...noCop(b0c.args), engines: b0c.args.engines.filter(e => e !== 'copilot') });
    check('AD15 an engine the site does not ask, but whose index does not hold the site (not in Bing Webmaster) -> provisional S0 with asked false, also when the caller does not list it; it never moves best_stage',
      na.stage === 'S0' && na.sub === 'not_indexed' && na.provisional === true && na.asked === false && na.n === 0 && naD2.engines.copilot && naD2.engines.copilot.sub === 'not_indexed' && naD2.best_stage === ARD.diagnose({ ...noCop(b0c.args), index: { ...b0c.args.index, bing: { in_account: null, crawled: new Map() } } }).best_stage, J(na));
    const naU = ARD.diagnose({ ...noCop(b0c.args), index: { ...b0c.args.index, bing: { in_account: null, crawled: new Map() } } });
    const naL = ARD.diagnose({ ...noCop(b0c.args), index: { ...b0c.args.index, bing: { in_account: null, crawled: new Map() } }, engines: b0c.args.engines.filter(e => e !== 'copilot') });
    check('AD15 an engine the site does not ask with no S0 finding: unmeasured / not_asked when listed, no cell when not listed', naU.engines.copilot.stage === 'unmeasured' && naU.engines.copilot.sub === 'not_asked' && naU.engines.copilot.provisional === false && !('copilot' in naL.engines), J(naU.engines.copilot));

  });
};
