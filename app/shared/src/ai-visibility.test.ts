import { describe, expect, it } from 'vitest';
import { AI_PROMPTS_DEFAULT, AUTOMATIONS, aiPulseQuestions, estimateAiVisibilityCost, estimateMonitoringCost, MONITOR_COSTS, nextScheduledRun } from './constants';
import { monitorsBody } from './payload';
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
    // 19 questions (the panel of 20 without its brand question, asked monthly) x (ChatGPT + Gemini + AI Mode at $0.004) x 6 days x 4.33 weeks
    expect(c.pulse).toBeCloseTo(19 * 0.012 * 6 * 4.33, 1);
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
    const on = estimateMonitoringCost({ aiVisibility: true, backlinks: false, auditMonthly: false, blogsPerWeek: 0, aiPrompts: 8, aiPulse: false });
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
