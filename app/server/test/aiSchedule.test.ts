import { describe, expect, it, vi } from 'vitest';
import { AUTOMATIONS, nextScheduledRun, type CycleIntent } from '@seo/shared';
import { aiScheduleNextCheck, nextAiCheckOf, trackingStateOf } from '../src/services/aiSchedule';

vi.hoisted(() => {
  process.env.N8N_BASE_URL = 'http://n8n.test';
  process.env.N8N_API_KEY = 'test-only';
  process.env.LOG_LEVEL = 'silent';
  process.env.SITE_TASK_JOBS = 'false';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});
vi.mock('../src/db', () => ({ db: {}, schema: new Proxy({}, { get: () => new Proxy({}, { get: (_t, k) => String(k) }) }) }));
const { aiDecisionInputs } = await import('../src/services/data');

// CR17 review R5 L7: the AI visibility page and the Pipeline's write form showed two different "next AI check" dates. Both now read the
// schedule (aiSchedule.ts): the pulse's next run while it is on, else the weekly check's next cycle.

const NOW = Date.parse('2026-11-18T09:00:00Z');   // a Wednesday
const TZ = 'Asia/Dubai';
const intent: CycleIntent = { anchorAt: '2026-10-05T05:00:00.000Z', tz: TZ, weekday: 1, localTime: '09:00', lastCycleAt: '2026-11-17T05:00:00.000Z' };
const schedOf = (id: string) => AUTOMATIONS.find((a) => a.id === id)!.schedule;
const pulseNext = nextScheduledRun(schedOf('ai_pulse'), TZ, new Date(NOW), intent)!.toISOString();
const weeklyNext = nextScheduledRun(schedOf('ai_visibility'), TZ, new Date(NOW), intent)!.toISOString();

describe('the one next AI check (review R5 L7)', () => {
  it('reads the schedule: the daily pulse while it is on, else the weekly check in the website\'s cycle', () => {
    expect(pulseNext).not.toBe(weeklyNext);
    expect(aiScheduleNextCheck({ verified: true, tracking: 'active', tz: TZ, intent, now: NOW })).toBe(pulseNext);
    expect(aiScheduleNextCheck({ verified: true, tracking: 'active', aiVisibility: true, aiPulse: false, tz: TZ, intent, now: NOW })).toBe(weeklyNext);
  });

  it('nothing scheduled: no date (not verified, tracking paused or not started, AI visibility off)', () => {
    expect(aiScheduleNextCheck({ verified: false, tracking: 'active', tz: TZ, intent, now: NOW })).toBe('');
    expect(aiScheduleNextCheck({ verified: true, tracking: 'paused', tz: TZ, intent, now: NOW })).toBe('');
    expect(aiScheduleNextCheck({ verified: true, tracking: 'not_started', tz: TZ, intent, now: NOW })).toBe('');
    expect(aiScheduleNextCheck({ verified: true, tracking: 'active', aiVisibility: false, aiPulse: true, tz: TZ, intent, now: NOW })).toBe('');
  });

  it('the Pipeline\'s automation list and the AI page agree on the date', () => {
    const list = [
      { id: 'ai_visibility' as const, state: 'on' as const, nextRunAt: weeklyNext },
      { id: 'ai_pulse' as const, state: 'on' as const, nextRunAt: pulseNext },
    ];
    expect(nextAiCheckOf(list)).toBe(aiScheduleNextCheck({ verified: true, tracking: 'active', tz: TZ, intent, now: NOW }));
    expect(nextAiCheckOf([list[0], { ...list[1], state: 'off', nextRunAt: null }])).toBe(weeklyNext);
    expect(nextAiCheckOf([{ ...list[0], state: 'paused', nextRunAt: null }])).toBe('');
  });

  it('both screens hand the same date to the AI-question decision (aiDecisionInputs)', () => {
    const next = aiScheduleNextCheck({ verified: true, tracking: 'active', tz: TZ, intent, now: NOW });
    const page = aiDecisionInputs({ logs: [], market: 'United Arab Emirates', nextAiCheck: next, now: NOW });
    const form = aiDecisionInputs({ logs: [], market: 'United Arab Emirates', nextAiCheck: nextAiCheckOf([{ id: 'ai_pulse', state: 'on', nextRunAt: pulseNext }]), now: NOW });
    expect(page.nextAiCheck).toBe(form.nextAiCheck);
    expect(aiDecisionInputs({ logs: [], market: '' }).nextAiCheck).toBe('');
  });

  it('tracking state: a pause in the app or the engine wins; the engine row alone means tracked', () => {
    expect(trackingStateOf({ trackingStatus: 'paused' }, { tracked: true, status: 'active' })).toBe('paused');
    expect(trackingStateOf({ trackingStatus: 'active' }, { tracked: true, status: 'paused' })).toBe('paused');
    expect(trackingStateOf({ trackingStatus: 'not_started' }, { tracked: true, status: 'active' })).toBe('active');
    expect(trackingStateOf({ trackingStatus: 'active' }, { tracked: false, status: null })).toBe('active');
    expect(trackingStateOf({ trackingStatus: 'not_started' }, { tracked: false, status: null })).toBe('not_started');
  });
});
