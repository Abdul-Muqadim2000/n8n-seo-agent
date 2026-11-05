// ---- ARL: the AI-ranking decision and learning kit (inlined by build_monitors.py through its marker, after AIRF and ARD) ----
// AIR (2026-11-06, docs/ai-ranking-2026-11-05/DESIGN.md §2.D-§2.H, interface frozen in CONTRACTS.md §3.3). OWNER: package P2.
// W0 SKELETON: the lever library and the refused list are the DESIGN.md §2.D tables (P2 owns and may correct the figures, not the ids, the
// sinks or the field names); every function has its final signature and returns the documented EMPTY shape (`unavailable: true` on object
// results), so nothing is chosen, nothing pre-registered, nothing learned until P2 replaces the bodies.
// Pure: no $(...), no network, no clock (`now` comes in). n8n sandbox rules as ARD. Needs AIRF in scope; may use AVX (impact, hash, rng).
const ARL = (() => {
  const VERSION = 'air-1';
  const WHY = 'not computed: the decision kit is a W0 skeleton';
  const S = (v) => (v == null ? '' : String(v)).trim();
  // lever: { id, label, from: [stage], to: stage (the highest it reaches), next: { from: to } (one step per from stage), sub: [S0 sub-label] (empty = any),
  //   mult: { engine: number } (an engine not listed: 1; the key '*' = every engine), prior: { mean, n0 } (null = never proposed until its gate holds),
  //   days: [min, typ, max] (null = not applicable), usd, effort_min, executor: auto | approve | human, scope: question | page | site,
  //   sink: ai_target | prospect | listing | growth_action | site_task | protect | existing, sink_wave2: the wave-2 sink when it moves, evidence: [keys] }
  const G3 = { ai_mode: 1, ai_overview: 1, gemini: 1 };
  const LEVERS = [
    { id: 'L01', label: 'Unblock AI bots in robots.txt', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['blocked'], mult: { '*': 1 }, prior: { mean: 0.90, n0: 10 }, days: [1, 2, 7], usd: 0, effort_min: 15, executor: 'human', scope: 'site', sink: 'existing', sink_wave2: 'existing', evidence: ['E11', 'E8'] },
    { id: 'L02', label: 'Content in raw HTML (server render)', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['js_only'], mult: { chatgpt: 1, perplexity: 1, claude: 1, ai_mode: 0.3, ai_overview: 0.3, gemini: 0.3 }, prior: { mean: 0.70, n0: 6 }, days: [7, 14, 45], usd: 0, effort_min: 240, executor: 'human', scope: 'page', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E23'] },
    { id: 'L03', label: 'Add the site to Bing Webmaster and submit', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['not_indexed'], mult: { copilot: 1, chatgpt: 0.2, chatgpt_api: 0.2 }, prior: { mean: 0.85, n0: 8 }, days: [2, 10, 30], usd: 0, effort_min: 20, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E13', 'R4'] },
    { id: 'L04', label: 'Get the page indexed in Google', from: ['S0'], to: 'S1', next: { S0: 'S1' }, sub: ['not_indexed'], mult: G3, prior: { mean: 0.50, n0: 6 }, days: [7, 21, 60], usd: 0, effort_min: 30, executor: 'human', scope: 'page', sink: 'existing', sink_wave2: 'existing', evidence: ['E8'] },
    { id: 'L05', label: 'Own answer page for the searches the engines run', from: ['S1'], to: 'S2', next: { S1: 'S2' }, sub: [], mult: { ai_mode: 1.2, ai_overview: 1.2, gemini: 1.2, chatgpt: 1, chatgpt_api: 1, perplexity: 1, copilot: 0.8, claude: 0.6 }, prior: { mean: 0.20, n0: 6 }, days: [14, 45, 90], usd: 0.80, effort_min: 20, executor: 'approve', scope: 'question', sink: 'ai_target', sink_wave2: 'ai_target', evidence: ['E20', 'E19', 'E24', 'E9'] },
    { id: 'L06', label: 'Refresh the ranking page for the searches the engines run', from: ['S1', 'S2'], to: 'S3', next: { S1: 'S2', S2: 'S3' }, sub: [], mult: { ai_mode: 1.2, ai_overview: 1.2, gemini: 1.2, chatgpt: 1, chatgpt_api: 1, perplexity: 1, copilot: 0.8, claude: 0.6 }, prior: { mean: 0.25, n0: 6 }, days: [7, 30, 60], usd: 0.80, effort_min: 20, executor: 'approve', scope: 'question', sink: 'ai_target', sink_wave2: 'ai_target', evidence: ['E20', 'OT2'] },
    { id: 'L07', label: 'Cited but not named: fix the passage', from: ['S3'], to: 'S4', next: { S3: 'S4' }, sub: [], mult: { '*': 1 }, prior: { mean: 0.35, n0: 5 }, days: [7, 21, 45], usd: 0, effort_min: 20, executor: 'approve', scope: 'question', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['GG1', 'E20'] },
    { id: 'L08', label: 'Placement on an editorial list the answers cite', from: ['S1', 'S2'], to: 'S4', next: { S1: 'S4', S2: 'S4' }, sub: [], mult: { ai_mode: 1.2, ai_overview: 1.2, perplexity: 1.2, chatgpt: 1, chatgpt_api: 1, claude: 0.8 }, prior: { mean: 0.06, n0: 8 }, days: [14, 30, 90], usd: 0.02, effort_min: 30, executor: 'approve', scope: 'page', sink: 'prospect', sink_wave2: 'prospect', evidence: ['E26', 'E25', 'E7', 'E20'] },
    { id: 'L09', label: 'Directory profile on a directory the answers cite', from: ['S1', 'S2'], to: 'S4', next: { S1: 'S2', S2: 'S4' }, sub: [], mult: { perplexity: 1.5, ai_mode: 1.2, ai_overview: 1.2, gemini: 1.2, chatgpt: 0.8, chatgpt_api: 0.8 }, prior: { mean: 0.08, n0: 5 }, days: [14, 45, 90], usd: 0, effort_min: 90, executor: 'human', scope: 'page', sink: 'listing', sink_wave2: 'listing', evidence: ['EX6', 'EX8', 'E31', 'R4'] },
    { id: 'L10', label: 'Registry or partner listing (eligible only)', from: ['S1'], to: 'S4', next: { S1: 'S4' }, sub: [], mult: { '*': 1 }, prior: { mean: 0.15, n0: 4 }, days: [30, 60, 120], usd: 0, effort_min: 120, executor: 'human', scope: 'page', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['R4'] },
    { id: 'L11', label: 'Earned mention (press, partner, customer case)', from: ['S1', 'S2', 'S3', 'S4'], to: 'S4', next: { S1: 'S2', S2: 'S3', S3: 'S4', S4: 'S4' }, sub: [], mult: { chatgpt: 1.2, chatgpt_api: 1.2, claude: 1.2 }, prior: { mean: 0.05, n0: 4 }, days: [30, 60, 180], usd: 0, effort_min: 240, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E18', 'E5', 'E6', 'E21'] },
    { id: 'L12', label: 'LinkedIn article by a named person', from: ['S1', 'S2'], to: 'S4', next: { S1: 'S2', S2: 'S4' }, sub: [], mult: { chatgpt: 1.2, chatgpt_api: 1.2, ai_mode: 1.2 }, prior: { mean: 0.05, n0: 4 }, days: [7, 21, 45], usd: 0, effort_min: 90, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E29'] },
    { id: 'L13', label: 'Disclosed community answer', from: ['S1'], to: 'S2', next: { S1: 'S2' }, sub: [], mult: { perplexity: 1.5, ai_overview: 1, chatgpt: 0.5, chatgpt_api: 0.5 }, prior: { mean: 0.03, n0: 3 }, days: [3, 14, 45], usd: 0, effort_min: 45, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E32', 'E6', 'E15'] },
    { id: 'L14', label: 'Video for the question', from: ['S1'], to: 'S2', next: { S1: 'S2' }, sub: [], mult: { ai_overview: 1.3, perplexity: 1.2 }, prior: { mean: 0.03, n0: 3 }, days: [14, 45, 90], usd: 0, effort_min: 300, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E9'] },
    { id: 'L15', label: 'Correction (own page or ask the source)', from: ['S4'], to: 'S5', next: { S4: 'S5' }, sub: ['wrong'], mult: { '*': 1 }, prior: { mean: 0.30, n0: 4 }, days: [14, 30, 60], usd: 0.02, effort_min: 20, executor: 'approve', scope: 'question', sink: 'existing', sink_wave2: 'existing', evidence: ['PE1'] },
    { id: 'L16', label: 'Protect a cited page; refresh it when citations decay', from: ['S5'], to: 'S5', next: { S5: 'S5' }, sub: [], mult: { '*': 1 }, prior: { mean: 0.50, n0: 4 }, days: null, usd: 0, effort_min: 0, executor: 'auto', scope: 'page', sink: 'protect', sink_wave2: 'protect', evidence: ['E33'] },
    { id: 'L17', label: 'Wikidata / Wikipedia entity', from: ['S1', 'S2', 'S3', 'S4'], to: 'S4', next: {}, sub: [], mult: { chatgpt: 1, chatgpt_api: 1, claude: 1 }, prior: null, gate: 'three independent earned mentions on file (notability, E36)', days: null, usd: 0, effort_min: 0, executor: 'human', scope: 'site', sink: 'growth_action', sink_wave2: 'site_task', evidence: ['E36', 'E35'] }
  ];
  const REFUSED = [
    { id: 'R01', label: 'Self-ranked "best X" list', why: 'the self-promoter is left out of the answers 69% to 83% of the time', evidence: ['E26'] },
    { id: 'R02', label: 'AI-only or agent-only page version without parity', why: 'near cloaking', evidence: ['AD1'] },
    { id: 'R03', label: 'Paid placement without disclosure', why: 'link spam by Google\'s own rules', evidence: ['R2'] },
    { id: 'R04', label: 'Prompt-injection text on a page', why: 'manipulates the engines; engines treat it as an attack', evidence: ['E13'] },
    { id: 'R05', label: 'Fake reviews', why: 'deceptive and against every platform\'s rules', evidence: ['R2'] },
    { id: 'R06', label: 'Astroturfed community posts', why: 'undisclosed promotion; removed and penalised by the communities', evidence: ['E41'] }
  ];
  const ZERO_WEIGHT = ['schema', 'llms_txt'];
  const U = { S0: 0, S1: 0.03, S2: 0.15, S3: 0.25, S4: 0.45, S5: 0.8 };
  const VERDICTS = ['likely_helped', 'cant_tell', 'no_effect', 'not_happened', 'not_due'];
  const value = ({ prompt, demand, intent, stage } = {}) => ({ V: 0, demand_w: 1, intent_w: 0, stage_w: 0, basis: WHY, unavailable: true });
  const feasibility = ({ prompt, market, diag, reach } = {}) => ({ F: 0, market_w: 0, comp_w: 0, reach_w: 0, basis: WHY, unavailable: true });
  const priorOf = ({ lever, stage, group, priors, site_id } = {}) => ({ a: 0, b: 0, mean: 0, lo90: 0, hi90: 0, n: 0, source: 'evidence', unavailable: true });
  const candidates = ({ site, diag, sources, arms, stored_actions, settings, now } = {}) => [];
  const score = (candidate, { priors, values, feas, weights, H } = {}) => ({ gain: 0, cost: 0, score: 0, p_by_cell: [], days: 0, why: WHY, unavailable: true });
  const choose = (scored, { capacities, arms, mode, open_actions } = {}) => ({ chosen: [], deferred: [], refused: [] });
  const prereg = (action, { arms, units60, now } = {}) => ({ metric: '', questions: [], engines: [], controls: [], window_days: 0, t0_rule: 'live_at', projected: { p: 0, gain: 0 }, registered_at: '', unavailable: true });
  const verify = (action, { contentLog, pages, index, listings, outreach, sources, robots, bing, now } = {}) => ({ happened: null, at: '', evidence: [] });
  const outcome = (action, { units60, diagNow, diagAtT0, arms, now } = {}) => ({ due: false, stage_moves: { k: 0, n: 0, b: 0 }, did: null, placebo: null,
    first_appearance: { t: { k: 0, n: 0 }, c: { k: 0, n: 0 }, p_fisher: null, p_binom: null }, leading: {}, verdict: 'not_due', why: WHY });
  const learn = ({ priors, outcomes, now } = {}) => [];   // the prior rows to upsert (new or changed only); [] = nothing learned
  // the weekly memo (2.H): the seven parts, in this order, each { title, lines: [{ text, figures: [{ name, value, basis }] }] }
  const MEMO_PARTS = ['what_changed', 'why', 'detectable', 'actions', 'projected_vs_real', 'cost_per_win', 'shadow_vs_old'];
  const MEMO_TITLES = { what_changed: 'What changed', why: 'Why', detectable: 'What we can detect', actions: 'What we did and what is waiting',
    projected_vs_real: 'Projected and real', cost_per_win: 'Cost per won question', shadow_vs_old: 'This plan and the current one' };
  const memo = ({ site, diagNow, diagPrev, chosen, open, outcomes, mde, blockers, cost, old, mode } = {}) => ({ v: 1, rule_version: AIRF.RULE_VERSION, site_id: S((site || {}).site_id),
    mode: S(mode) || 'off', parts: MEMO_PARTS.map(k => ({ key: k, title: MEMO_TITLES[k], lines: [] })), blockers: [], note: WHY, unavailable: true });
  const compareOld = ({ chosen, old } = {}) => ({ overlap: 0, gain_air: 0, gain_old: 0, causes: { air: [], old: [] }, note: WHY, unavailable: true });
  return { VERSION, LEVERS, REFUSED, ZERO_WEIGHT, U, VERDICTS, MEMO_PARTS, MEMO_TITLES, value, feasibility, priorOf, candidates, score, choose, prereg, verify, outcome, learn, memo, compareOld };
})();
