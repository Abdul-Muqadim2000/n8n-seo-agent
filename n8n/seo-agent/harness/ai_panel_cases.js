// G6 (2026-10-18): writes v5/data/ai_panel_cost_cases.json — the golden table the engine's AIP.cost (harness S211) and the app's
// estimateAiPanelCost (app/shared/src/cost.aipanel.test.ts) are both held to. Run by hand after a price or formula change, from a build:
//   node harness/ai_panel_cases.js            (reads harness/code_v4/AI_Requests.js, writes ../v5/data/ai_panel_cost_cases.json)
// then rebuild (build_monitors.py copies the table to harness/ and to app/shared/src/).
const fs = require('fs'), path = require('path');
const CD = process.env.CODE_DIR || path.join(__dirname, 'code_v4');
const src = fs.readFileSync(path.join(CD, 'AI_Requests.js'), 'utf8');
const a = src.indexOf('const AIP = (() => {'), b = src.indexOf('\n})();', a);
const AIP = new Function(src.slice(a, b + 6) + '\nreturn AIP;')();
const ALL = AIP.ENGINES, DEF = AIP.DEFAULT_ENGINES;
const inputs = [
  { panel: 8 }, { panel: 20 }, { panel: 50 }, { panel: 100 }, { panel: 200 }, { panel: 500 },
  { panel: 8, pulse: false }, { panel: 100, pulse: false }, { panel: 500, pulse: false },
  { panel: 500, engines: ALL }, { panel: 200, engines: [...DEF, 'copilot'] }, { panel: 100, engines: ['chatgpt', 'chatgpt_api', 'gemini_api'] },
  { panel: 500, pulse_mode: 'full' }, { panel: 300, pulse_mode: 'sample', pulse_per_week: 2 }, { panel: 40, pulse_mode: 'sample' },
  { panel: 3 }, { panel: 1 }, { panel: 900 }, { panel: 150, engines: ['perplexity', 'claude'] }, { panel: 250, cluster_size: 30 },
];
const pick = (c) => ({ panel: c.panel, asked: c.asked, per_week: c.per_week, pulse_questions_day: c.pulse_questions_day, executions: c.executions, analyst_jobs: c.analyst_jobs,
  requests: c.requests, run: c.run, full_extra: c.full_extra, pulse_day: c.pulse_day, month: c.month, half_width: c.half_width });
const cases = inputs.map(i => ({ input: i, expect: pick(AIP.cost(i)) }));
const out = { generated: 'harness/ai_panel_cases.js from AIP.cost (v5/code/_ai_panel.js)', prices: AIP.PRICE, pulse_engines: AIP.PULSE_ENGINES, default_engines: AIP.DEFAULT_ENGINES, monthly_engines: AIP.MONTHLY_ENGINES,
  fixed: AIP.FIXED, limits: { min: AIP.LIMITS.min, max: AIP.LIMITS.max, default_new: AIP.LIMITS.default_new, default_stored: AIP.LIMITS.default_stored, chunk_requests: AIP.LIMITS.chunk_requests, pulse_max_requests: AIP.LIMITS.pulse_max_requests,
    full_pulse_max_panel: AIP.LIMITS.full_pulse_max_panel, target_headline: AIP.LIMITS.target_headline, target_cluster: AIP.LIMITS.target_cluster, cluster_size_guess: AIP.LIMITS.cluster_size_guess, max_run_usd: AIP.LIMITS.max_run_usd }, cases };
const dest = process.argv[2] || path.join(__dirname, '..', 'v5', 'data', 'ai_panel_cost_cases.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log('wrote', dest, cases.length, 'cases');
