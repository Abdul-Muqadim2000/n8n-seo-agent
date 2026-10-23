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
// W2-E3 (2026-10-23): the owner's engine and coverage options (WAVE2_CONTRACTS.md §4). Kept in their own list, `cases_options`, because their
// inputs carry option keys the older app test does not pass; `cases` above stays exactly what it was (every option off = the old figures).
const optionInputs = [
  { panel: 50, claude_weekly: true }, { panel: 200, claude_weekly: true }, { panel: 8, claude_weekly: true, pulse: false },
  { panel: 50, pulse_engines: 'chatgpt, gemini, ai_mode, perplexity, ai_overview' }, { panel: 200, pulse_engines: ['perplexity', 'ai_overview'] },
  { panel: 100, pulse_engines: 'claude, chatgpt_api' }, { panel: 500, pulse_engines: 'chatgpt,gemini,ai_mode,perplexity,ai_overview' },
  { panel: 50, persona_context: true, personas: 3 }, { panel: 200, persona_context: true, personas: 3 }, { panel: 8, persona_context: true, personas: 6 }, { panel: 50, persona_context: true, personas: 0 },
  { panel: 50, fanout_check: 25 }, { panel: 50, fanout_check: 50 }, { panel: 200, fanout_check: 100 }, { panel: 200, fanout_check: 900 },
  { panel: 50, demand_market: true }, { panel: 200, demand_market: true },
  { panel: 50, claude_weekly: true, pulse_engines: 'chatgpt,gemini,ai_mode,perplexity,ai_overview', persona_context: true, personas: 3, fanout_check: 50, demand_market: true },
  { panel: 200, claude_weekly: true, pulse_engines: 'chatgpt,gemini,ai_mode,perplexity,ai_overview', persona_context: true, personas: 3, fanout_check: 100, demand_market: true },
  { panel: 200, engines: ALL, claude_weekly: true, persona_context: true, personas: 4, fanout_check: 100 },
];
const pickO = (c) => ({ ...pick(c), options: c.options });
const cases_options = optionInputs.map(i => ({ input: i, expect: pickO(AIP.cost(i)) }));
const out = { generated: 'harness/ai_panel_cases.js from AIP.cost (v5/code/_ai_panel.js)', prices: AIP.PRICE, pulse_engines: AIP.PULSE_ENGINES, default_engines: AIP.DEFAULT_ENGINES, monthly_engines: AIP.MONTHLY_ENGINES,
  fixed: AIP.FIXED, limits: { min: AIP.LIMITS.min, max: AIP.LIMITS.max, default_new: AIP.LIMITS.default_new, default_stored: AIP.LIMITS.default_stored, chunk_requests: AIP.LIMITS.chunk_requests, pulse_max_requests: AIP.LIMITS.pulse_max_requests,
    full_pulse_max_panel: AIP.LIMITS.full_pulse_max_panel, target_headline: AIP.LIMITS.target_headline, target_cluster: AIP.LIMITS.target_cluster, cluster_size_guess: AIP.LIMITS.cluster_size_guess, max_run_usd: AIP.LIMITS.max_run_usd }, cases,
  // W2-E3: the option prices and constants the app mirror (app/shared/src/ai-panel.ts) must carry, and the option cases
  extra_prices: AIP.XPRICE, persona: AIP.PERSONA, fanout_max: AIP.FANOUT_MAX, demand_tasks: AIP.DEMAND_TASKS, pulse_allowed: AIP.PULSE_ALLOWED, cases_options };
const dest = process.argv[2] || path.join(__dirname, '..', 'v5', 'data', 'ai_panel_cost_cases.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
console.log('wrote', dest, cases.length, 'cases +', cases_options.length, 'option cases');
