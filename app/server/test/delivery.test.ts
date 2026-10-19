import { describe, expect, it } from 'vitest';
import { AUTOMATIONS, SCHEDULES, type AutomationInfo, type CycleJobRow, type CycleRow } from '@seo/shared';
import { CYCLE_JOB_MISSED_HOURS, SCHEDULE_GRACE_MINUTES, STUCK_MINUTES, TARGET_PCT, alertDelivery, cycleWeek, deliveryReport, onDemandWeek, scheduleState, scheduledTimes, scheduledWeek, weekStart, weeksBack } from '../src/services/delivery';

// G21 (2026-10-13, system review FIX_PLAN G21): the delivery rate, did what should have run, run, and did it reach the customer?
// Nothing measured either before this. The arithmetic is tested on its own: a week where every schedule fired and every run was
// delivered, and a week where the Mac slept through a Monday (D25a) so three schedules left no execution behind.

const TZ = 'America/New_York';
const MONDAY = (iso: string) => new Date(iso);
const auto = (over: Partial<AutomationInfo>): AutomationInfo =>
  ({
    id: 'site_tracker',
    title: 'Weekly site report',
    summary: '',
    cadence: '',
    schedule: { kind: 'weekly', weekday: 1, hour: 9, minute: 0 },
    workflow: 'SEOagentSiteTrk1',
    stage: 'site_tracker',
    settingsTab: 'tracking',
    ...over,
  }) as AutomationInfo;

const WEEKLY = auto({});
const DAILY = auto({ id: 'ai_pulse', title: 'AI pulse', workflow: 'SEOagentAIPulse1', stage: 'ai_pulse', schedule: { kind: 'daily', weekdays: [0, 2, 3, 4, 5, 6], hour: 6, minute: 30 } });
const MONTHLY = auto({ id: 'audit', title: 'Technical audit', workflow: 'SEOagentAuditSc1', stage: 'site_audit', schedule: { kind: 'monthly', day: 1, hour: 6, minute: 0 } });

const run = (over: Partial<Parameters<typeof onDemandWeek>[0][number]>) =>
  ({ mode: 'keyword', status: 'completed', createdAt: MONDAY('2026-10-13T12:00:00Z'), completedAt: MONDAY('2026-10-13T12:10:00Z'), reportCount: 1, ...over });

describe('G21 delivery rate: the weeks', () => {
  it('a week runs Monday to Monday, UTC, and the window is the last whole weeks', () => {
    expect(weekStart(new Date('2026-10-15T23:59:00Z')).toISOString()).toBe('2026-10-12T00:00:00.000Z'); // Thursday -> its Monday
    expect(weekStart(new Date('2026-10-12T00:00:00Z')).toISOString()).toBe('2026-10-12T00:00:00.000Z'); // the Monday itself
    expect(weekStart(new Date('2026-10-11T23:00:00Z')).toISOString()).toBe('2026-10-05T00:00:00.000Z'); // Sunday belongs to the week before
    expect(weeksBack(3, new Date('2026-10-15T10:00:00Z')).map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
  });

  it('every fire of a schedule in the week is counted, on n8n\'s own clock', () => {
    const from = MONDAY('2026-10-12T00:00:00Z'), to = MONDAY('2026-10-19T00:00:00Z');
    expect(scheduledTimes(WEEKLY.schedule, TZ, from, to)).toHaveLength(1); // one Monday 09:00 New York
    expect(scheduledTimes(DAILY.schedule, TZ, from, to)).toHaveLength(6); // every day except Monday
    expect(scheduledTimes(MONTHLY.schedule, TZ, from, to)).toHaveLength(0); // the 1st is not in this week
    expect(scheduledTimes(MONTHLY.schedule, TZ, MONDAY('2026-10-26T00:00:00Z'), MONDAY('2026-11-09T00:00:00Z'))).toHaveLength(1);
  });
});

describe('G21 delivery rate: on-demand runs', () => {
  const from = MONDAY('2026-10-12T00:00:00Z'), to = MONDAY('2026-10-19T00:00:00Z'), now = MONDAY('2026-10-18T12:00:00Z');

  it('delivered means it finished AND a report reached the customer', () => {
    const c = onDemandWeek(
      [
        run({}),
        run({}),
        run({ status: 'completed', reportCount: 0 }), // finished and delivered nothing
        run({ status: 'failed', reportCount: 0 }),
      ],
      from, to, now,
    );
    expect(c).toMatchObject({ started: 4, delivered: 2, noReport: 1, failed: 1, stuck: 0, inFlight: 0, settled: 4, ratePct: 50 });
  });

  it('a run still going is left out of the rate; one older than the engine\'s timeout counts against it', () => {
    const young = run({ status: 'running', completedAt: null, reportCount: 0, createdAt: new Date(now.getTime() - (STUCK_MINUTES - 10) * 60_000) });
    const old = run({ status: 'running', completedAt: null, reportCount: 0, createdAt: new Date(now.getTime() - (STUCK_MINUTES + 10) * 60_000) });
    expect(onDemandWeek([run({}), young], from, to, now)).toMatchObject({ started: 2, inFlight: 1, settled: 1, ratePct: 100 });
    expect(onDemandWeek([run({}), old], from, to, now)).toMatchObject({ started: 2, stuck: 1, settled: 2, ratePct: 50 });
  });

  it('a week with no run has no rate at all, rather than 0% or 100%', () => {
    expect(onDemandWeek([], from, to, now)).toMatchObject({ started: 0, settled: 0, ratePct: null });
  });

  it('runs outside the week are not counted', () => {
    expect(onDemandWeek([run({ createdAt: MONDAY('2026-10-11T23:59:00Z') }), run({ createdAt: MONDAY('2026-10-19T00:00:01Z') })], from, to, now).started).toBe(0);
  });
});

describe('G21 delivery rate: missed schedules (D25a: the Mac sleeps)', () => {
  const from = MONDAY('2026-10-12T00:00:00Z'), to = MONDAY('2026-10-19T00:00:00Z'), now = MONDAY('2026-10-19T00:00:00Z');
  const fired = (at: string, status = 'success') => ({ id: at, workflowId: 'x', status, startedAt: at, mode: 'trigger' });
  // Monday 2026-10-12 09:00 New York = 13:00 UTC (EDT)
  const MON_9 = '2026-10-12T13:00:00.000Z';

  it('a week where every schedule fired and succeeded is 100% with no misses', () => {
    const r = scheduledWeek([WEEKLY], { SEOagentSiteTrk1: [fired(MON_9)] }, TZ, from, to, now);
    expect(r.missed).toEqual([]);
    expect(r.counts).toMatchObject({ started: 1, delivered: 1, failed: 0, stuck: 0, settled: 1, ratePct: 100 });
  });

  it('a fire that is late but inside the grace window still counts as having run', () => {
    const late = new Date(Date.parse(MON_9) + (SCHEDULE_GRACE_MINUTES - 5) * 60_000).toISOString();
    expect(scheduledWeek([WEEKLY], { SEOagentSiteTrk1: [fired(late)] }, TZ, from, to, now).counts.delivered).toBe(1);
  });

  it('a fire that left no execution behind is a MISSED schedule and counts against the rate, with the time it should have run', () => {
    const r = scheduledWeek([WEEKLY], { SEOagentSiteTrk1: [] }, TZ, from, to, now);
    expect(r.missed).toEqual([{ automation: 'site_tracker', title: 'Weekly site report', workflow: 'SEOagentSiteTrk1', expectedAt: MON_9 }]);
    expect(r.counts).toMatchObject({ started: 1, delivered: 0, stuck: 1, settled: 1, ratePct: 0 });
  });

  it('the machine slept through one night: three of the week\'s six daily fires are missing and the rate says so', () => {
    const days = scheduledTimes(DAILY.schedule, TZ, from, to);
    const slept = new Set([days[1].toISOString(), days[2].toISOString(), days[3].toISOString()]);
    const execs = { SEOagentAIPulse1: days.filter((d) => !slept.has(d.toISOString())).map((d) => fired(d.toISOString())) };
    const r = scheduledWeek([DAILY], execs, TZ, from, to, now);
    expect(r.missed.map((m) => m.expectedAt)).toEqual([...slept]);
    expect(r.counts).toMatchObject({ started: 6, delivered: 3, stuck: 3, settled: 6, ratePct: 50 });
  });

  it('an execution that errored is a failure, not a miss', () => {
    const r = scheduledWeek([WEEKLY], { SEOagentSiteTrk1: [fired(MON_9, 'error')] }, TZ, from, to, now);
    expect(r.missed).toEqual([]);
    expect(r.counts).toMatchObject({ started: 1, delivered: 0, failed: 1, ratePct: 0 });
  });

  it('a fire still inside its grace window is not late yet, so a fresh Monday is not reported as missed', () => {
    const justNow = new Date(Date.parse(MON_9) + 10 * 60_000);
    expect(scheduledWeek([WEEKLY], { SEOagentSiteTrk1: [] }, TZ, from, to, justNow).missed).toEqual([]);
  });
});

describe('G21 delivery rate: ops alerts and the channel that carried them (R6)', () => {
  it('counts the channel each alert went out by, and keeps pending and failed apart', () => {
    const a = alertDelivery([
      { delivered: 'email', channels: 'email,data_table' },
      { delivered: 'webhook,email', channels: 'webhook,email' },
      { delivered: 'failed', channels: 'email' },
      { delivered: 'pending', channels: 'email' },
      { delivered: 'deduped', channels: 'email' },
    ]);
    expect(a).toMatchObject({ total: 5, delivered: 2, failed: 1, pending: 1, deduped: 1, notSent: 0 });
    expect(a.byChannel).toEqual({ email: 2, webhook: 1 });
    expect(a.ratePct).toBe(50); // deduped is a deliberate non-send and is left out of the four settled rows
  });

  it('the state the re-rating found, three rows, all pending, reads 0%, not "no alerts"', () => {
    expect(alertDelivery([{ delivered: 'pending' }, { delivered: 'pending' }, { delivered: '' }])).toMatchObject({ total: 3, delivered: 0, pending: 3, ratePct: 0 });
  });

  it('no alert at all has no rate', () => {
    expect(alertDelivery([]).ratePct).toBeNull();
  });
});

describe('G21 delivery rate: the whole report', () => {
  const now = MONDAY('2026-10-18T23:00:00Z'); // the Sunday night of the week starting 2026-10-12
  const fired = (at: string, status = 'success') => ({ id: at, workflowId: 'x', status, startedAt: at, mode: 'trigger' });

  it('a clean week reaches the target; the week the Mac slept does not, and names what it missed', () => {
    const lastMonday = '2026-10-12T13:00:00.000Z', weekBefore = '2026-10-05T13:00:00.000Z';
    const report = deliveryReport({
      now,
      weeks: 2,
      automations: [WEEKLY],
      timezone: TZ,
      execs: { SEOagentSiteTrk1: [fired(weekBefore)] }, // last week's Monday never fired
      alerts: [{ delivered: 'webhook' }],
      runs: [
        run({ createdAt: MONDAY('2026-10-06T10:00:00Z') }),
        run({ createdAt: MONDAY('2026-10-13T10:00:00Z') }),
        run({ createdAt: MONDAY('2026-10-14T10:00:00Z') }),
      ],
    });
    expect(report.targetPct).toBe(TARGET_PCT);
    expect(report.weeks.map((w) => w.week)).toEqual(['2026-10-05', '2026-10-12']);
    const [clean, slept] = report.weeks;
    expect(clean).toMatchObject({ overallPct: 100, belowTarget: false, missed: [] });
    expect(clean.onDemand).toMatchObject({ started: 1, delivered: 1, ratePct: 100 });
    expect(slept.missed.map((m) => m.expectedAt)).toEqual([lastMonday]);
    // 2 runs delivered + 0 of 1 schedule = 2 of 3
    expect(slept).toMatchObject({ overallPct: 66.7, belowTarget: true });
    expect(slept.scheduled).toMatchObject({ started: 1, delivered: 0, stuck: 1, ratePct: 0 });
    expect(report.alerts).toMatchObject({ delivered: 1, ratePct: 100, byChannel: { webhook: 1 } });
    expect(report.notes).toEqual([]);
  });

  it('what could not be read is said in words instead of looking perfect', () => {
    const report = deliveryReport({ now, weeks: 1, automations: [WEEKLY], timezone: TZ, execs: {}, alerts: [], runs: [], notes: ['the engine did not answer'] });
    expect(report.notes[0]).toBe('the engine did not answer');
    expect(report.notes.join(' ')).toMatch(/unmeasured, not perfect/);
    expect(report.notes.join(' ')).toMatch(/no alert delivery rate/);
    expect(report.weeks[0].onDemand.ratePct).toBeNull();
  });
});

// R103 / R104 (2026-10-16): a schedule is not "missed" before it existed; Page Watch is the tenth schedule; only the schedule's own
// executions count as its fires; the Pipeline's "last run" is the last SCHEDULED fire, and an on-demand run is labelled as one.
describe('R103 delivery rate: schedules are counted from the day they existed, and only their own fires count', () => {
  const NOW = new Date('2026-10-15T19:14:00Z');
  const run103 = (createdAt: string) => run({ createdAt: new Date(createdAt), completedAt: new Date(createdAt) });

  it('lists ten schedules: the nine automations and the daily Page Watch (05:45 every day)', () => {
    expect(SCHEDULES).toHaveLength(10);
    expect(AUTOMATIONS).toHaveLength(9);
    const pw = SCHEDULES.find((s) => s.id === 'page_watch')!;
    expect(pw.workflow).toBe('SEOagentPageWch1');
    expect(pw.schedule).toEqual({ kind: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6], hour: 5, minute: 45 });
    expect(SCHEDULES.every((s) => !!s.since)).toBe(true);
  });

  it('week 2026-09-28: every schedule was created later, so 5 of 5 on-demand runs delivered read 100% (it read 26.3%)', () => {
    const r = deliveryReport({
      now: NOW,
      weeks: 4,
      timezone: TZ,
      execs: Object.fromEntries(SCHEDULES.map((s) => [s.workflow, []])),
      alerts: [],
      runs: ['2026-09-29T10:00:00Z', '2026-09-30T10:00:00Z', '2026-10-01T10:00:00Z', '2026-10-02T10:00:00Z', '2026-10-03T10:00:00Z'].map(run103),
    });
    const w = r.weeks.find((x) => x.week === '2026-09-28')!;
    // Rank Tracker existed from 2026-10-01 12:06, but its Monday fire of 09-28 came before that; the 1st-of-month audit fire of
    // 2026-10-01 06:00 New York came before the Audit Scheduler existed (2026-10-02)
    expect(w.scheduled).toMatchObject({ started: 0, settled: 0, ratePct: null });
    expect(w.missed).toEqual([]);
    expect(w.overallPct).toBe(100);
    expect(r.notes.join(' ')).toMatch(/counted from the day it was created/);
  });

  it('weeks before the first schedule existed have no scheduled measurement at all (unmeasured, not 0%)', () => {
    const r = deliveryReport({ now: NOW, weeks: 6, timezone: TZ, execs: Object.fromEntries(SCHEDULES.map((s) => [s.workflow, []])), alerts: [], runs: [] });
    for (const wk of ['2026-09-07', '2026-09-14', '2026-09-21']) {
      const w = r.weeks.find((x) => x.week === wk)!;
      expect(w.scheduled.started).toBe(0);
      expect(w.overallPct).toBeNull();
    }
  });

  it('Page Watch fires are counted: a day it did not run is a missed fire with its own name', () => {
    const from = new Date('2026-10-13T00:00:00Z'), to = new Date('2026-10-14T00:00:00Z');
    const pw = SCHEDULES.find((s) => s.id === 'page_watch')!;
    const r = scheduledWeek([pw], { SEOagentPageWch1: [] }, TZ, from, to, new Date('2026-10-14T12:00:00Z'));
    expect(r.missed.map((m) => m.automation)).toEqual(['page_watch']);
    // 2026-10-13 05:45 New York = 09:45 UTC, after the workflow was created (06:16 UTC)
    expect(r.missed[0].expectedAt).toBe('2026-10-13T09:45:00.000Z');
  });

  it('a Test Runner or on-demand execution near the due time does not hide a missed fire, only mode "trigger" counts', () => {
    const from = new Date('2026-10-12T00:00:00Z'), to = new Date('2026-10-19T00:00:00Z');
    const testRun = { id: 't', workflowId: 'x', status: 'success', startedAt: '2026-10-12T13:20:00.000Z', mode: 'integrated' };
    const r = scheduledWeek([WEEKLY], { SEOagentSiteTrk1: [testRun] }, TZ, from, to, new Date('2026-10-19T00:00:00Z'));
    expect(r.missed).toHaveLength(1);
    expect(r.counts).toMatchObject({ delivered: 0, stuck: 1 });
  });

  it('the workflow\'s own createdAt, when the engine reports it, is used when it is later than the built-in date', () => {
    const from = new Date('2026-10-12T00:00:00Z'), to = new Date('2026-10-19T00:00:00Z');
    const r = scheduledWeek([WEEKLY], { SEOagentSiteTrk1: [] }, TZ, from, to, new Date('2026-10-19T00:00:00Z'), { SEOagentSiteTrk1: '2026-10-13T00:00:00Z' });
    expect(r.missed).toEqual([]);
  });
});

describe('R104 the Pipeline: the last SCHEDULED fire, a missed due time, and on-demand runs named as such', () => {
  // the shared-clock rule, on a weekly slot (since 2026-10-19 the weekly jobs run in each website's own cycle: cycleWeek, below)
  const RT = { ...AUTOMATIONS.find((a) => a.id === 'rank_tracker')!, schedule: { kind: 'weekly' as const, weekday: 1, hour: 8, minute: 0 } };
  // Monday 2026-10-12 08:00 New York = 12:00 UTC
  const MON = '2026-10-12T12:00:00.000Z';

  it('only an on-demand ("integrated") run on Monday at 19:48: no scheduled last run, the Monday fire is missed, the run is on demand', () => {
    const st = scheduleState(RT, [{ id: 'i', workflowId: RT.workflow, status: 'success', startedAt: '2026-10-12T19:48:00.000Z', mode: 'integrated' }], TZ, new Date('2026-10-15T19:14:00Z'), '2026-10-12T19:48:00.000Z');
    expect(st.lastScheduledAt).toBeNull();
    expect(st.missedAt).toBe(MON);
    expect(st.onDemandAt).toBe('2026-10-12T19:48:00.000Z');
    expect(st.note).toMatch(/scheduled run missed on 2026-10-12/);
    expect(st.note).toMatch(/on demand/);
  });

  it('a scheduled fire 4 hours late is a fire (late, not missed), and the data it wrote is that fire, not an on-demand run', () => {
    const st = scheduleState(RT, [{ id: 'f', workflowId: RT.workflow, status: 'success', startedAt: '2026-10-12T16:00:00.000Z', mode: 'trigger' }], TZ, new Date('2026-10-15T19:14:00Z'), '2026-10-12T16:05:00.000Z');
    expect(st.lastScheduledAt).toBe('2026-10-12T16:00:00.000Z');
    expect(st.missedAt).toBeNull();
    expect(st.onDemandAt).toBeNull();
  });

  it('no execution history from the engine: nothing is claimed either way', () => {
    const st = scheduleState(RT, undefined, TZ, new Date('2026-10-15T19:14:00Z'), '2026-10-12T19:48:00.000Z');
    expect(st).toMatchObject({ known: false, lastScheduledAt: null, missedAt: null, onDemandAt: null, note: '' });
  });
});

// 2026-10-19 (SCHEDULING_KEYWORDS_PLAN.md §8): the weekly work runs in each website's own cycle, so its side of the rate is read from the
// Cycle Dispatcher's records per website: a finished job is delivered, a job that gave up (or is still not done a day after its cycle was
// due) is missed, a cycle more than a day overdue that never opened is missed, a skipped job is not counted.
describe("2026-10-19 delivery rate: the websites' own cycles", () => {
  const from = MONDAY('2026-10-12T00:00:00Z'), to = MONDAY('2026-10-19T00:00:00Z'), now = MONDAY('2026-10-18T12:00:00Z');
  const job = (o: Partial<CycleJobRow>): CycleJobRow => ({ key: '', site_id: 'site_techand-ai', cycle_key: 'cyc:site_techand-ai:2026-10-14', job: 'ai_visibility', workflow_id: 'SEOagentAIVisib1', status: 'done', attempts: 1, run_id: '', ledger_key: '', monthly: false, reason: '', due_at: '2026-10-14T02:00:00.000Z', started_at: '', finished_at: '', updated_at: '', ...o });
  const cyc = (o: Partial<CycleRow>): CycleRow => ({ site_id: 'site_northwind-com', domain: 'northwind.com', anchor_at: '2026-10-01T10:00:00.000Z', tz: 'UTC', cycle_weekday: 3, local_time: '06:00', monthly_day: 1, next_due_at: '2026-10-15T06:00:00.000Z', next_preview_at: '', current_key: '', status: 'active', skip_jobs: '', last_cycle_at: '', last_monthly_key: '', adopted: false, updated_at: '', ...o });

  it('the weekly jobs are not counted against a shared clock any more; the daily schedules still are', () => {
    const weekly = AUTOMATIONS.filter((a) => a.schedule.kind === 'cycle');
    expect(weekly.map((a) => a.id).sort()).toEqual(['ai_growth', 'ai_visibility', 'audit', 'backlinks', 'content_cadence', 'link_builder', 'rank_tracker', 'site_tracker']);
    for (const a of weekly) expect(scheduledTimes(a.schedule, TZ, from, to)).toEqual([]);
    expect(scheduledWeek(weekly, {}, TZ, from, to, now)).toMatchObject({ missed: [], counts: { started: 0 } });
  });

  it('done is delivered, gave up is missed (with the job and the website), skipped is not counted, a job still inside its day is in flight', () => {
    const r = cycleWeek(
      [
        job({}),
        job({ job: 'backlinks', status: 'skipped' }),
        job({ job: 'rank_tracker', status: 'gave_up', due_at: '2026-10-14T02:10:00.000Z' }),
        job({ job: 'cycle', status: 'running' }),
        job({ job: 'audit', status: 'running', due_at: new Date(now.getTime() - (CYCLE_JOB_MISSED_HOURS - 1) * 3_600_000).toISOString() }),
        job({ job: 'link_builder', status: 'failed', due_at: new Date(now.getTime() - (CYCLE_JOB_MISSED_HOURS + 1) * 3_600_000).toISOString() }),
        job({ due_at: '2026-10-08T02:00:00.000Z' }), // another week
      ],
      [],
      from,
      to,
      now,
      new Map([['site_techand-ai', 'techand.ai']]),
    );
    expect(r.counts).toMatchObject({ started: 4, delivered: 1, stuck: 2, inFlight: 1, settled: 3, ratePct: 33.3 });
    expect(r.missed.map((m) => m.title)).toEqual(['Rank tracking · techand.ai', 'Link building · techand.ai']);
  });

  it('a cycle more than a day overdue that never opened is a missed cycle; a paused one and a fresh one are not', () => {
    const r = cycleWeek([], [cyc({}), cyc({ site_id: 'site_paused-com', domain: 'paused.com', status: 'paused' }), cyc({ site_id: 'site_fresh-com', domain: 'fresh.com', next_due_at: '2026-10-18T06:00:00.000Z' })], from, to, now);
    expect(r.missed).toEqual([{ automation: 'cycle', title: 'Weekly cycle · northwind.com', workflow: 'SEOagentCycleDsp', expectedAt: '2026-10-15T06:00:00.000Z' }]);
    expect(r.counts).toMatchObject({ started: 1, stuck: 1 });
  });

  it('the whole report adds the cycles to the scheduled side, and says when they could not be read', () => {
    const rep = deliveryReport({ now, weeks: 1, timezone: TZ, automations: [], execs: { x: [] }, alerts: [], runs: [], cycles: { rows: [], jobs: [job({}), job({ job: 'backlinks', status: 'gave_up' })] } });
    expect(rep.weeks[0].scheduled).toMatchObject({ started: 2, delivered: 1, stuck: 1, ratePct: 50 });
    expect(rep.weeks[0].missed).toHaveLength(1);
    const blind = deliveryReport({ now, weeks: 1, timezone: TZ, automations: [], execs: { x: [] }, alerts: [], runs: [], cycles: null });
    expect(blind.notes.join(' ')).toMatch(/weekly cycles could not be read/);
  });
});
