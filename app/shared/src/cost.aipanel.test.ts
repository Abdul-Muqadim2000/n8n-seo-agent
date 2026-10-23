// G6 (2026-10-18): ONE cost table for the AI question panel. The engine's AIP.cost (n8n/seo-agent/v5/code/_ai_panel.js) wrote these golden
// cases (n8n/seo-agent/harness/ai_panel_cases.js) and runs them in harness S211; the app's estimateAiPanelCost must give the same figure
// for every one. A price or a rule changed on one side only fails here or there.
import { describe, expect, it } from 'vitest';
import { AI_PANEL_COST_CASES } from './ai-panel-cost-cases.generated';
import {
  AI_PANEL_DEMAND_TASKS, AI_PANEL_FANOUT_MAX, AI_PANEL_FIXED, AI_PANEL_LIMITS, AI_PANEL_PERSONA, AI_PANEL_PRICE, AI_PANEL_PULSE_ALLOWED, AI_PANEL_PULSE_ENGINES, AI_PANEL_XPRICE,
  aiOnDemandRunCost, aiPanelSize, aiRunPanelOf, estimateAiPanelCost,
} from './ai-panel';
import { autopilotRows } from './autopilot';
import { AI_DEFAULT_ENGINES, AI_ENGINE_COST, AI_PROMPTS_DEFAULT, AI_PROMPTS_MAX, estimateAiVisibilityCost } from './constants';
import { AI_PANEL_VALUE, aiRunPanelOfRow, estimateRunCost, estimateRunCostParts } from './cost';

type In = { panel?: number; engines?: readonly string[]; pulse?: boolean; pulse_mode?: string; pulse_per_week?: number; cluster_size?: number };
const asEngine = (c: ReturnType<typeof estimateAiPanelCost>) => ({
  panel: c.panel, asked: c.asked, per_week: c.perWeek, pulse_questions_day: c.pulseQuestionsDay, executions: c.executions, analyst_jobs: c.analystJobs,
  requests: { weekly: c.requests.weekly, full: c.requests.full, pulse_day: c.requests.pulseDay },
  run: c.run, full_extra: c.fullExtra, pulse_day: c.pulseDay,
  month: { weekly: c.month.weekly, full_extra: c.month.fullExtra, pulse: c.month.pulse, total: c.month.total },
  half_width: c.halfWidth,
});

describe('estimateAiPanelCost, the engine\'s golden cases', () => {
  it('has the engine\'s prices, pulse engines, limits and fixed figures', () => {
    expect(AI_PANEL_PRICE).toEqual(AI_PANEL_COST_CASES.prices);
    expect([...AI_PANEL_PULSE_ENGINES]).toEqual([...AI_PANEL_COST_CASES.pulse_engines]);
    expect(AI_PANEL_FIXED).toEqual(AI_PANEL_COST_CASES.fixed);
    for (const [k, v] of Object.entries(AI_PANEL_COST_CASES.limits)) expect((AI_PANEL_LIMITS as Record<string, number>)[k]).toBe(v);
    expect(AI_ENGINE_COST).toEqual(AI_PANEL_COST_CASES.prices);
  });
  for (const cs of AI_PANEL_COST_CASES.cases) {
    const i = cs.input as In;
    it(`panel ${i.panel}${i.engines ? ' · ' + i.engines.join('+') : ''}${i.pulse === false ? ' · no pulse' : ''}${i.pulse_mode ? ' · pulse ' + i.pulse_mode : ''}${i.pulse_per_week ? ' x' + i.pulse_per_week : ''}`, () => {
      const c = estimateAiPanelCost({ panel: i.panel, engines: i.engines, pulse: i.pulse, pulseMode: i.pulse_mode, pulsePerWeek: i.pulse_per_week, clusterSize: i.cluster_size });
      expect(asEngine(c)).toEqual(cs.expect);
    });
  }
});

describe('the panel limits', () => {
  it('a new site starts at 50, an empty stored size keeps 20, a stored size is kept within 3-500', () => {
    expect(aiPanelSize(null)).toBe(50);
    expect(aiPanelSize({ siteId: 's', promptsMax: null })).toBe(20);
    expect(aiPanelSize({ siteId: 's', promptsMax: 8 })).toBe(8);
    expect(aiPanelSize({ siteId: 's', promptsMax: 900 })).toBe(500);
    expect(AI_PROMPTS_DEFAULT).toBe(50);
    expect(AI_PROMPTS_MAX).toBe(500);
  });
  it('the monthly monitor figure is the same formula', () => {
    const m = estimateAiPanelCost({ panel: 200 }).month;
    const v = estimateAiVisibilityCost({ prompts: 200 });
    expect(v).toEqual({ weekly: m.weekly, fullRun: m.fullExtra, pulse: m.pulse, total: m.total });
  });
});

// W2-FIX (2026-10-23, n8n/seo-agent/docs/ai-visibility-2026-10-23/fixes/W2-E3.md §9): the owner's engine and coverage options, held to the
// engine's own golden cases (`cases_options`, AIP.cost), and carried from the website's settings into the on-demand quote and its breakdown.
type InOpt = In & { claude_weekly?: boolean; pulse_engines?: string | readonly string[]; persona_context?: boolean; personas?: number; fanout_check?: number; demand_market?: boolean };
const OPT = AI_PANEL_COST_CASES as unknown as {
  extra_prices: Record<string, number>; persona: Record<string, number>; fanout_max: number; demand_tasks: number; pulse_allowed: readonly string[];
  cases_options: readonly { input: InOpt; expect: unknown }[];
};
describe('the W2-E3 options, the engine\'s golden cases', () => {
  it('has the engine\'s option prices and limits', () => {
    expect(AI_PANEL_XPRICE).toEqual(OPT.extra_prices);
    expect(AI_PANEL_PERSONA).toEqual(OPT.persona);
    expect(AI_PANEL_FANOUT_MAX).toBe(OPT.fanout_max);
    expect(AI_PANEL_DEMAND_TASKS).toBe(OPT.demand_tasks);
    expect([...AI_PANEL_PULSE_ALLOWED]).toEqual([...OPT.pulse_allowed]);
    expect(OPT.cases_options.length).toBe(20);
  });
  for (const cs of OPT.cases_options) {
    it('option case ' + JSON.stringify(cs.input), () => {
      const i = cs.input;
      const c = estimateAiPanelCost({ panel: i.panel, engines: i.engines, pulse: i.pulse, pulseMode: i.pulse_mode, pulsePerWeek: i.pulse_per_week, clusterSize: i.cluster_size,
        claudeWeekly: i.claude_weekly, pulseEngines: i.pulse_engines, personaContext: i.persona_context, personas: i.personas, fanoutCheck: i.fanout_check, demandMarket: i.demand_market });
      const o = c.options;
      expect({ ...asEngine(c), options: { claude_weekly: o.claudeWeekly, pulse_engines: o.pulseEngines,
        persona: { on: o.persona.on, roles: o.persona.roles, questions: o.persona.questions, requests_run: o.persona.requestsRun, dfs_run: o.persona.dfsRun },
        fanout: { queries: o.fanout.queries, requests_run: o.fanout.requestsRun, dfs_run: o.fanout.dfsRun },
        demand_market: { on: o.demandMarket.on, tasks: o.demandMarket.tasks, dfs_full: o.demandMarket.dfsFull }, requests_extra: o.requestsExtra } }).toEqual(cs.expect);
    });
  }
});

describe('an on-demand AI visibility quote carries the website\'s options (W2-FIX)', () => {
  const stored = { aiPromptsMax: 200, aiEngines: [...AI_DEFAULT_ENGINES] as string[], aiClaudeWeekly: true, aiPersonaContext: true, aiPersonas: 'CFO, IT manager, Procurement', aiFanoutCheck: 100, aiDemandMarket: true };
  const plainFull = () => estimateAiPanelCost({ panel: 200, engines: AI_DEFAULT_ENGINES }).run.full;
  it('aiRunPanelOf keeps the options and the quote is the engine\'s full run with them', () => {
    const p = aiRunPanelOf(stored);
    expect(p.options).toEqual({ claudeWeekly: true, personaContext: true, personas: 3, fanoutCheck: 100, demandMarket: true });
    const full = estimateAiPanelCost({ panel: 200, engines: AI_DEFAULT_ENGINES, claudeWeekly: true, personaContext: true, personas: 3, fanoutCheck: 100, demandMarket: true }).run.full;
    expect(aiOnDemandRunCost(p)).toEqual(full);
    expect(full.usd).toBeGreaterThan(plainFull().usd);
  });
  it('estimateRunCost and its breakdown give the same figure, options included, split into Claude and data money', () => {
    const p = aiRunPanelOf(stored);
    const v = { [AI_PANEL_VALUE]: p };
    const full = aiOnDemandRunCost(p);
    const parts = estimateRunCostParts('ai_visibility', v);
    expect(estimateRunCost('ai_visibility', v)).toBeCloseTo(full.usd, 2);
    expect(parts.usd).toBeCloseTo(full.usd, 2);
    expect(parts.dfs).toBeCloseTo(full.dfs, 2);
    expect(parts.ai).toBeCloseTo(full.ai, 2);
    // without the options the breakdown is the panel's plain full run (what it showed before), so the options really are in it
    const plain = estimateRunCostParts('ai_visibility', { [AI_PANEL_VALUE]: { panel: 200, engines: [...AI_DEFAULT_ENGINES] } });
    expect(plain.dfs).toBeCloseTo(plainFull().dfs, 2);
    expect(parts.dfs).toBeGreaterThan(plain.dfs);
  });
  it('a website that sets no option is quoted exactly as before', () => {
    const p = aiRunPanelOf({ aiPromptsMax: 50, aiEngines: [...AI_DEFAULT_ENGINES] });
    expect(p.options).toBeUndefined();
    expect(estimateRunCostParts('ai_visibility', { [AI_PANEL_VALUE]: p }).usd).toBeCloseTo(estimateAiPanelCost({ panel: 50, engines: AI_DEFAULT_ENGINES }).run.full.usd, 2);
  });
  it('the monthly market trend adds its three tasks ($0.33) to the month, nothing to the weekly run', () => {
    const a = estimateAiPanelCost({ panel: 50 }), b = estimateAiPanelCost({ panel: 50, demandMarket: true });
    expect(b.run.weekly).toEqual(a.run.weekly);
    expect(Math.round((b.month.total - a.month.total) * 100) / 100).toBe(0.33);
  });
  it('the schedules\' forecast prices the options too (absent = the figures of before)', () => {
    const base = { aiVisibility: true, aiEngines: [...AI_DEFAULT_ENGINES], aiPromptsMax: 50, aiPulse: true, aiPulseMode: 'auto' as const, aiPulsePerWeek: 0, aiGrowth: false, aiPagesPerMonth: 0, backlinks: false, linkBuilder: false, auditMonthly: false, auditPages: 200 };
    const row = (m: Parameters<typeof autopilotRows>[0]) => autopilotRows(m, 0).find((r) => r.id === 'ai_visibility')!.usd;
    const v = estimateAiVisibilityCost({ prompts: 50 });
    expect(row(base)).toBeCloseTo(v.weekly + v.fullRun, 3);
    expect(row({ ...base, aiDemandMarket: true, aiFanoutCheck: 50 })).toBeGreaterThan(row(base));
  });
});

// App review R-A1 (2026-10-23): the on-demand quote (also the credit check and the charge cap) ignored the owner's options: 50 questions with
// every option on, the engine reserved $4.412 while the app quoted $3.274. The quote is now AIP.cost's full run with the row's options and roles.
describe('R-A1: the stored monitors row with every option on is quoted as the engine reserves it', () => {
  const row = { ai_prompts_max: 50, ai_engines: '', ai_claude_weekly: true, ai_pulse_engines: 'chatgpt, gemini, ai_mode, perplexity, ai_overview', ai_persona_context: true, ai_personas: 'CFO, IT manager, Procurement', ai_fanout_check: 50, ai_demand_market: true };
  const golden = OPT.cases_options.find((c) => c.input.panel === 50 && c.input.claude_weekly && c.input.demand_market && c.input.persona_context)!;
  const goldenFull = (golden.expect as { run: { full: { dfs: number; ai: number; usd: number } } }).run.full;
  it('equals the engine\'s golden full run for those options (the quote, its breakdown and the panel read from the row)', () => {
    const p = aiRunPanelOfRow(row);
    expect(aiOnDemandRunCost(p)).toEqual(goldenFull);
    expect(estimateRunCost('ai_visibility', { [AI_PANEL_VALUE]: p })).toBeCloseTo(goldenFull.usd, 2);
    const parts = estimateRunCostParts('ai_visibility', { [AI_PANEL_VALUE]: p });
    expect(parts.dfs).toBeCloseTo(goldenFull.dfs, 2);
    expect(parts.ai).toBeCloseTo(goldenFull.ai, 2);
  });
  it('the reviewer\'s case (fan-out 100): the golden figure plus 50 more results pages, far above the old size-and-engines quote', () => {
    const p = aiRunPanelOfRow({ ...row, ai_fanout_check: 100 });
    const q = aiOnDemandRunCost(p);
    const old = estimateAiPanelCost({ panel: 50, engines: AI_DEFAULT_ENGINES }).run.full;
    expect(q.usd).toBeCloseTo(goldenFull.usd + 50 * AI_PANEL_XPRICE.fanout_serp, 4);
    expect(estimateRunCost('ai_visibility', { [AI_PANEL_VALUE]: p })).toBeCloseTo(q.usd, 2);
    expect(q.usd - old.usd).toBeGreaterThan(1);
  });
  it('a row without the option columns (before the engine stored them) is quoted as before', () => {
    expect(aiRunPanelOfRow({ ai_prompts_max: 50, ai_engines: '' })).toEqual(aiRunPanelOf({ aiPromptsMax: 50, aiEngines: [] }));
    expect(aiRunPanelOfRow(null)).toEqual(aiRunPanelOf(null));
  });
});
