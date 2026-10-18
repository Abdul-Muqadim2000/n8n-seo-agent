import { describe, expect, it } from 'vitest';
import { AI_ENGINE_VALUES, AI_PAGES_DEFAULT, AI_PROMPTS_DEFAULT, AUTOMATIONS, aiPulseQuestions, estimateAiGrowthCost, estimateAiVisibilityCost, estimateMonitoringCost, MONITOR_COSTS, nextScheduledRun } from './constants';
import { buildN8nPayload, monitorsBody } from './payload';
import { monitorSettingsSchema } from './schemas';
import { AI_MIN_QUESTION_SAMPLES, aiPrecisionTable, aiSampleRate, halfWidth95, questionWin, wilsonRange } from './ai-visibility';

// AI visibility v4.9 (n8n/seo-agent/AI_VISIBILITY_SPEC.md): bigger question panel, the daily AI Pulse, their cost and schedule.

describe('AI visibility settings', () => {
  it('default to 50 questions for a new website with the daily pulse on; at most 500 questions (G6)', () => {
    const d = monitorSettingsSchema.parse({});
    expect(d.aiPromptsMax).toBe(AI_PROMPTS_DEFAULT);
    expect(AI_PROMPTS_DEFAULT).toBe(50);
    expect(d.aiPulse).toBe(true);
    expect(monitorSettingsSchema.safeParse({ aiPromptsMax: 500 }).success).toBe(true);
    expect(monitorSettingsSchema.safeParse({ aiPromptsMax: 501 }).success).toBe(false);
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
    // 49 questions (the panel of 50 without its brand question, asked monthly) x (ChatGPT + Gemini + AI Mode at $0.004) x 6 days x 4.33 weeks; Copilot is opt-in
    expect(c.pulse).toBeCloseTo(49 * 0.012 * 6 * 4.33, 1);
    expect(estimateAiVisibilityCost({ engines: [...AI_ENGINE_VALUES] }).pulse).toBeCloseTo(49 * 0.014 * 6 * 4.33, 1);
    expect(aiPulseQuestions(8)).toBe(7);
    expect(aiPulseQuestions(500)).toBe(499);
    expect(aiPulseQuestions(900)).toBe(499);
  });
  it('drops the pulse when it is off or none of its engines is chosen, and grows with the panel', () => {
    expect(estimateAiVisibilityCost({ pulse: false }).pulse).toBe(0);
    expect(estimateAiVisibilityCost({ engines: ['perplexity', 'claude'] }).pulse).toBe(0);
    expect(estimateAiVisibilityCost({ prompts: 40 }).total).toBeGreaterThan(estimateAiVisibilityCost({ prompts: 20 }).total);
    expect(estimateAiVisibilityCost({ prompts: 900 }).total).toBe(estimateAiVisibilityCost({ prompts: 500 }).total);
    // G6: above 50 questions the pulse asks a rotating sample, so it grows slower than the panel
    expect(estimateAiVisibilityCost({ prompts: 500 }).pulse).toBeLessThan(10 * estimateAiVisibilityCost({ prompts: 50 }).pulse);
  });
  it('Claude only on the monthly full run', () => {
    const withClaude = estimateAiVisibilityCost({ engines: ['chatgpt', 'claude'], pulse: false });
    const without = estimateAiVisibilityCost({ engines: ['chatgpt'], pulse: false });
    expect(withClaude.weekly).toBe(without.weekly);
    expect(withClaude.fullRun - without.fullRun).toBeCloseTo(AI_PROMPTS_DEFAULT * 0.025, 2);
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
  // B-R3: the price of a written page comes from the one cost table now (MONITOR_COSTS.blogPostEach = modeCostUsd('keyword')),
  // so this test asks for that figure instead of repeating the 2026-10-02 $1.20 it used to hard-code.
  it('costs: the AI pages (one written page each) + weekly drafts; nothing when off; added to the monitoring total', () => {
    expect(estimateAiGrowthCost().total).toBeCloseTo(2 * MONITOR_COSTS.blogPostEach + 4.33 * 0.03, 2);
    expect(estimateAiGrowthCost({ growth: false }).total).toBe(0);
    expect(estimateAiGrowthCost({ pages: 50 }).pages).toBeCloseTo(8 * MONITOR_COSTS.blogPostEach, 2);
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

// B8-6 / B8-7 (2026-10-17, benchmark area 8): the per-question range and what each panel size and cadence buys.
describe('wilsonRange / halfWidth95 (the engine\'s _ai_stats.js formulas)', () => {
  it('matches the engine on known samples', () => {
    expect(wilsonRange(1, 4)).toEqual([4.6, 69.9]);   // harness S165's 1-of-4 brand check, as the engine printed it
    expect(wilsonRange(0, 0)).toBeNull();
    expect(wilsonRange(10, 10)![1]).toBe(100);
  });
  it('reproduces the published half-widths: about ±10 at 100 answers and ±1 at 10,000', () => {
    expect(halfWidth95(100)).toBeCloseTo(9.6, 0);
    expect(halfWidth95(10000)).toBeCloseTo(1, 0);
    expect(halfWidth95(0)).toBeNull();
    expect(halfWidth95(40, 0.1)!).toBeLessThan(halfWidth95(40)!);   // narrower away from 50%
  });
});

describe('questionWin (B8-6)', () => {
  it('uses the range and the floor the engine sent', () => {
    const w = questionWin({ winRate: 25, samples: 8, win: { ci: [7.1, 59.1], enough: true, why: '' } });
    expect(w).toMatchObject({ rate: 25, samples: 8, ci: [7.1, 59.1], enough: true });
  });
  it('rebuilds the same range from rate x samples when the server passed only the bare rate', () => {
    expect(questionWin({ winRate: 25, samples: 8 }).ci).toEqual(wilsonRange(2, 8));
  });
  it('says "too few" under the floor instead of a 0% result', () => {
    const w = questionWin({ winRate: 0, samples: 1 });
    expect(w.enough).toBe(false);
    expect(w.why).toMatch(new RegExp(`needs ${AI_MIN_QUESTION_SAMPLES}`));
    expect(questionWin({ winRate: 0, samples: AI_MIN_QUESTION_SAMPLES }).enough).toBe(true);
  });
});

describe('aiSampleRate / aiPrecisionTable (B8-7)', () => {
  it('models one answer per weekly engine and six pulse mornings per fast engine when nothing was measured', () => {
    const r = aiSampleRate();   // the six default engines: Claude is monthly, three of them are pulse engines
    expect(r).toMatchObject({ weeklyPerQuestion: 5, pulsePerQuestion: 18, basis: 'modelled' });
    expect(r.why).toMatch(/modelled/);
    expect(aiSampleRate({ pulse: false }).pulsePerQuestion).toBe(0);
  });
  it('uses the engine\'s own measured sample, and projects the pulse at the measured answer rate when it was off', () => {
    const m = aiSampleRate({ measured: { samples: 140, pulseSamples: 112, questions: 7, checkedAt: '2026-10-13T07:00:00Z' } });
    expect(m).toMatchObject({ weeklyPerQuestion: 4, pulsePerQuestion: 16, basis: 'measured', pulseBasis: 'measured' });
    expect(m.why).toMatch(/140 answers over 7 days to 7 buyer questions/);
    const named = aiSampleRate({ measured: { samples: 140, pulseSamples: 112, questions: 7, ratePeriod: 'this run on 2026-10-13 + 6 daily pulse days since 2026-10-07' } });
    expect(named.why).toMatch(/140 answers from this run on 2026-10-13 \+ 6 daily pulse days since 2026-10-07 to 7 buyer questions/);
    expect(named.why).not.toMatch(/over 7 days/);
    const off = aiSampleRate({ measured: { samples: 28, pulseSamples: 0, questions: 7 } });
    expect(off.pulseBasis).toBe('modelled');
    expect(off.pulsePerQuestion).toBeCloseTo(18 * 0.8, 1);   // 4 of 5 weekly answers came back
  });
  it('prints a half-width for every panel size and cadence, narrower with more questions and with the pulse', () => {
    const t = aiPrecisionTable({ panel: 8, pulse: true, measured: { samples: 140, pulseSamples: 112, questions: 7 } });
    expect(t.basis).toBe('measured');
    const row = (panel: number, cadence: string) => t.rows.find((x) => x.panel === panel && x.cadence === cadence)!;
    expect(row(8, 'weekly').answers).toBe(28);
    expect(row(8, 'weekly_pulse').answers).toBe(140);
    expect(row(8, 'weekly_pulse').current).toBe(true);
    expect(row(8, 'weekly').current).toBe(false);
    expect(row(8, 'weekly').headline).toBe(halfWidth95(28));
    expect(row(50, 'weekly_pulse').headline!).toBeLessThan(row(20, 'weekly_pulse').headline!);
    expect(row(20, 'weekly_pulse').headline!).toBeLessThan(row(20, 'weekly').headline!);
    expect(row(8, 'weekly').perQuestionEnough).toBe(true);   // 4 a question: just at the floor
    expect(t.rows.map((x) => x.panel)).toEqual([8, 8, 20, 20, 50, 50, 100, 100, 200, 200, 500, 500]);
    // G6: above 50 questions the pulse is a rotating sample, so a question collects fewer pulse answers — but the headline still narrows
    expect(row(500, 'weekly_pulse').answersPerQuestion).toBeLessThan(row(50, 'weekly_pulse').answersPerQuestion);
    expect(row(500, 'weekly_pulse').headline!).toBeLessThan(row(50, 'weekly_pulse').headline!);
  });
  it('a site with no pulse engine gets weekly rows only, and a panel off the list is added', () => {
    const t = aiPrecisionTable({ panel: 12, engines: ['perplexity', 'claude'], pulse: true });
    expect(t.pulseAvailable).toBe(false);
    expect(t.rows.every((x) => x.cadence === 'weekly')).toBe(true);
    expect(t.rows.find((x) => x.panel === 12)!.current).toBe(true);
    expect(t.rows.find((x) => x.panel === 12)!.perQuestionEnough).toBe(false);   // one answer a question a week
  });
});
