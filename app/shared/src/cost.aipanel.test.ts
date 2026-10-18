// G6 (2026-10-18): ONE cost table for the AI question panel. The engine's AIP.cost (n8n/seo-agent/v5/code/_ai_panel.js) wrote these golden
// cases (n8n/seo-agent/harness/ai_panel_cases.js) and runs them in harness S211; the app's estimateAiPanelCost must give the same figure
// for every one. A price or a rule changed on one side only fails here or there.
import { describe, expect, it } from 'vitest';
import { AI_PANEL_COST_CASES } from './ai-panel-cost-cases.generated';
import { AI_PANEL_FIXED, AI_PANEL_LIMITS, AI_PANEL_PRICE, AI_PANEL_PULSE_ENGINES, aiPanelSize, estimateAiPanelCost } from './ai-panel';
import { AI_ENGINE_COST, AI_PROMPTS_DEFAULT, AI_PROMPTS_MAX, estimateAiVisibilityCost } from './constants';

type In = { panel?: number; engines?: readonly string[]; pulse?: boolean; pulse_mode?: string; pulse_per_week?: number; cluster_size?: number };
const asEngine = (c: ReturnType<typeof estimateAiPanelCost>) => ({
  panel: c.panel, asked: c.asked, per_week: c.perWeek, pulse_questions_day: c.pulseQuestionsDay, executions: c.executions, analyst_jobs: c.analystJobs,
  requests: { weekly: c.requests.weekly, full: c.requests.full, pulse_day: c.requests.pulseDay },
  run: c.run, full_extra: c.fullExtra, pulse_day: c.pulseDay,
  month: { weekly: c.month.weekly, full_extra: c.month.fullExtra, pulse: c.month.pulse, total: c.month.total },
  half_width: c.halfWidth,
});

describe('estimateAiPanelCost — the engine\'s golden cases', () => {
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
