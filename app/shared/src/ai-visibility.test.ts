import { describe, expect, it } from 'vitest';
import { AI_ENGINE_VALUES, AI_PAGES_DEFAULT, AI_PROMPTS_DEFAULT, AUTOMATIONS, aiPulseQuestions, estimateAiGrowthCost, estimateAiVisibilityCost, estimateMonitoringCost, MONITOR_COSTS, nextScheduledRun } from './constants';
import { buildN8nPayload, monitorsBody } from './payload';
import { monitorSettingsSchema } from './schemas';

// AI visibility v4.9 (n8n/seo-agent/AI_VISIBILITY_SPEC.md): bigger question panel, the daily AI Pulse, their cost and schedule.

describe('AI visibility settings', () => {
  it('default to 20 questions with the daily pulse on; at most 50 questions', () => {
    const d = monitorSettingsSchema.parse({});
    expect(d.aiPromptsMax).toBe(AI_PROMPTS_DEFAULT);
    expect(d.aiPulse).toBe(true);
    expect(monitorSettingsSchema.safeParse({ aiPromptsMax: 50 }).success).toBe(true);
    expect(monitorSettingsSchema.safeParse({ aiPromptsMax: 51 }).success).toBe(false);
    expect(monitorSettingsSchema.safeParse({ aiPromptsMax: 2 }).success).toBe(false);
  });
  it('reach n8n as ai_prompts_max / ai_pulse (Site Admin monitors)', () => {
    expect(monitorsBody({ aiPromptsMax: 30, aiPulse: false })).toEqual({ ai_prompts_max: 30, ai_pulse: false });
    expect(monitorsBody({ aiVisibility: true })).not.toHaveProperty('ai_pulse');
  });
});

describe('estimateAiVisibilityCost', () => {
  it('splits weekly run, monthly full run and daily pulse; the default matches MONITOR_COSTS', () => {
    const c = estimateAiVisibilityCost();
    expect(c.total).toBeCloseTo(c.weekly + c.fullRun + c.pulse, 1);
    expect(MONITOR_COSTS.aiVisibilityMonthly).toBe(c.total);
    // 19 questions (the panel of 20 without its brand question, asked monthly) x (ChatGPT + Gemini + AI Mode at $0.004) x 6 days x 4.33 weeks; Copilot is opt-in
    expect(c.pulse).toBeCloseTo(19 * 0.012 * 6 * 4.33, 1);
    expect(estimateAiVisibilityCost({ engines: [...AI_ENGINE_VALUES] }).pulse).toBeCloseTo(19 * 0.014 * 6 * 4.33, 1);
    expect(aiPulseQuestions(8)).toBe(7);
    expect(aiPulseQuestions(500)).toBe(49);
  });
  it('drops the pulse when it is off or none of its engines is chosen, and grows with the panel', () => {
    expect(estimateAiVisibilityCost({ pulse: false }).pulse).toBe(0);
    expect(estimateAiVisibilityCost({ engines: ['perplexity', 'claude'] }).pulse).toBe(0);
    expect(estimateAiVisibilityCost({ prompts: 40 }).total).toBeGreaterThan(estimateAiVisibilityCost({ prompts: 20 }).total);
    expect(estimateAiVisibilityCost({ prompts: 500 }).total).toBe(estimateAiVisibilityCost({ prompts: 50 }).total);
  });
  it('Claude only on the monthly full run', () => {
    const withClaude = estimateAiVisibilityCost({ engines: ['chatgpt', 'claude'], pulse: false });
    const without = estimateAiVisibilityCost({ engines: ['chatgpt'], pulse: false });
    expect(withClaude.weekly).toBe(without.weekly);
    expect(withClaude.fullRun - without.fullRun).toBeCloseTo(20 * 0.025, 2);
  });
  it('feeds the monitoring total', () => {
    const off = estimateMonitoringCost({ aiVisibility: false, backlinks: false, auditMonthly: false, blogsPerWeek: 0 });
    const on = estimateMonitoringCost({ aiVisibility: true, backlinks: false, auditMonthly: false, blogsPerWeek: 0, aiPrompts: 8, aiPulse: false, aiGrowth: false });
    expect(on - off).toBeCloseTo(estimateAiVisibilityCost({ prompts: 8, pulse: false }).total, 1);
  });
});

describe('the AI pulse schedule', () => {
  const pulse = AUTOMATIONS.find((a) => a.id === 'ai_pulse')!;
  it('runs every day except Monday at 06:30, in n8n’s time zone', () => {
    expect(pulse.workflow).toBe('SEOagentAIPulse1');
    // Sunday 2026-10-11 07:00 UTC -> next run Tuesday 13th 06:30 UTC (Monday is skipped)
    expect(nextScheduledRun(pulse.schedule, 'UTC', new Date('2026-10-11T07:00:00Z')).toISOString()).toBe('2026-10-13T06:30:00.000Z');
    // Saturday 05:00 -> the same day 06:30
    expect(nextScheduledRun(pulse.schedule, 'UTC', new Date('2026-10-10T05:00:00Z')).toISOString()).toBe('2026-10-10T06:30:00.000Z');
  });
});

describe('AI growth (v4.12)', () => {
  it('Copilot is an engine; settings default to the growth loop on with 2 AI pages a month (at most 8)', () => {
    expect(AI_ENGINE_VALUES).toContain('copilot');
    const d = monitorSettingsSchema.parse({});
    expect(d.aiEngines).not.toContain('copilot');
    expect(d.aiGrowth).toBe(true);
    expect(d.aiPagesPerMonth).toBe(AI_PAGES_DEFAULT);
    expect(monitorSettingsSchema.safeParse({ aiPagesPerMonth: 9 }).success).toBe(false);
    expect(monitorsBody({ aiGrowth: false, aiPagesPerMonth: 4 })).toEqual({ ai_growth: false, ai_pages_month: 4 });
  });
  it('costs: the AI pages ($1.20 each) + weekly drafts; nothing when off; added to the monitoring total', () => {
    expect(estimateAiGrowthCost().total).toBeCloseTo(2 * 1.2 + 4.33 * 0.03, 2);
    expect(estimateAiGrowthCost({ growth: false }).total).toBe(0);
    expect(estimateAiGrowthCost({ pages: 50 }).pages).toBeCloseTo(8 * 1.2, 2);
    const base = { aiVisibility: true, backlinks: false, auditMonthly: false, blogsPerWeek: 0 };
    expect(estimateMonitoringCost({ ...base, aiGrowth: true, aiPages: 2 }) - estimateMonitoringCost({ ...base, aiGrowth: false })).toBeCloseTo(estimateAiGrowthCost().total, 1);
  });
  it('the weekly AI growth automation runs Monday 09:30, after the AI check and before the content run', () => {
    const g = AUTOMATIONS.find((a) => a.id === 'ai_growth')!;
    expect(g.workflow).toBe('SEOagentAIGrow1');
    expect(g.schedule).toEqual({ kind: 'weekly', weekday: 1, hour: 9, minute: 30 });
  });
  it('a page written for an AI target reaches n8n as ai_target ({ u, t } sources)', () => {
    const body = buildN8nPayload(
      { mode: 'keyword', keyword: 'e invoicing in uae', country: 'United Arab Emirates', pageType: 'Guide', existingPageUrl: '', localArea: '', videoUrl: '', videoTranscript: '', businessFacts: '', cta: '', tone: 'Professional and direct', goal: 'leads', checkPageExists: false, receiveReport: true, receiveContent: true, emailCopy: false, business: '',
        siteId: '00000000-0000-4000-8000-000000000000', aiTarget: { question: 'Which companies help UAE businesses with e-invoicing?', kind: 'refresh', targetId: 'ait_x_1', fanout: ['a', 'b'], sources: [{ url: 'https://gulfnews.com/x', title: 'X' }], competitors: ['zoho.com'] } } as never,
      { domain: 'northwind-erp.com', country: 'United Arab Emirates', business: 'ERP partner', customers: '', goal: 'leads', tone: 'Professional and direct' } as never,
      { callbackUrl: 'https://app.example.com/api/hooks/n8n/x', email: '' },
    ) as Record<string, unknown>;
    expect(body.ai_target).toEqual({ question: 'Which companies help UAE businesses with e-invoicing?', kind: 'refresh', target_id: 'ait_x_1', fanout: ['a', 'b'], sources: [{ u: 'https://gulfnews.com/x', t: 'X' }], competitors: ['zoho.com'] });
  });
});
