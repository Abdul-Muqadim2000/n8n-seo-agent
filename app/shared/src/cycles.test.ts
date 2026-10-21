import { describe, expect, it } from 'vitest';
import { autopilotMonthlyUsd, autopilotRows, firstCycleChecksUsd } from './autopilot';
import { AUTOMATIONS, MONITOR_COSTS, nextScheduledRun } from './constants';
import { cycleDateOf, cycleOverdue, cycleRequestId, cyclesBetween, intentOfRow, isCycleRequestId, isValidTimezone, monthlyPeriodKey, nextCycleAfter, readCycleIntent, upcomingCycles, zonedToUtc } from './cycle-clock';
import { AUTO_SOURCES, CYCLE_JOBS, cycleKey, cycleNorm, itemKey, skipKey, type CycleRow } from './cycles';
import { fitGate, fitLearnedBrands, fitStored, fitTopic } from './fit-gate';
import { buildN8nPayload } from './payload';
import { RUN_SCHEMAS, comingUpDecisionSchema, contentFeedbackSchema, cycleWeekdaySchema, siteAutomationSchema } from './schemas';
import { monitorSettingsSchema } from './schemas';

// The per-website cycle and keyword-first contract (SCHEDULING_KEYWORDS_PLAN.md §4, §5, §14): the clock mirrored from the engine's kit
// (v5/code/_cycle.js), DST-safe in three kinds of zone; the keys both sides compute; the fit gate ported from v5/code/_fit_gate.js; the
// forecast per level; the request fields the engine reads by their exact keys.

const iso = (t: number) => new Date(t).toISOString();

describe('the cycle clock (mirrors v5/code/_cycle.js)', () => {
  it('Dubai (no DST): cycle 0 at the anchor, then the anchor\'s weekday at 06:00 local, at least 3 days later, every 7 days', () => {
    // Wednesday 14 Oct 2026 12:00 in Dubai
    const intent = { anchorAt: '2026-10-14T08:00:00.000Z', tz: 'Asia/Dubai' };
    const first = upcomingCycles(intent, Date.parse('2026-10-14T08:00:00.000Z'), 3);
    expect(first.map((c) => [c.date, c.at, c.cycle0])).toEqual([
      ['2026-10-14', '2026-10-14T08:00:00.000Z', true],
      ['2026-10-21', '2026-10-21T02:00:00.000Z', false],
      ['2026-10-28', '2026-10-28T02:00:00.000Z', false],
    ]);
    expect(first[0].previewAt).toBe(''); // no "Coming up" plan before cycle 0
    expect(first[1].previewAt).toBe('2026-10-19T02:00:00.000Z');
    // once cycle 0 opened, the next is cycle 1
    expect(upcomingCycles({ ...intent, lastCycleAt: '2026-10-14T08:01:00.000Z' }, Date.parse('2026-10-15T00:00:00Z'), 1)[0].at).toBe('2026-10-21T02:00:00.000Z');
  });

  it('a website set up on a Sunday: the first cycle on its weekday is a week later (3 days at least, never two cycles days apart)', () => {
    const n = nextCycleAfter({ tz: 'UTC', weekday: 0, last: Date.parse('2026-10-18T09:00:00Z') });
    expect([n.date, iso(n.at)]).toEqual(['2026-10-25', '2026-10-25T06:00:00.000Z']);
    // a weekday changed to Monday, the day after: still at least 3 days after the last cycle started
    const m = nextCycleAfter({ tz: 'UTC', weekday: 1, last: Date.parse('2026-10-18T09:00:00Z') });
    expect(m.date).toBe('2026-10-26');
  });

  it('New York across the end of DST (1 Nov 2026): 06:00 local stays 06:00 local (10:00 then 11:00 UTC), 7 x 24 h is never added', () => {
    const intent = { anchorAt: '2026-10-14T14:00:00.000Z', tz: 'America/New_York', lastCycleAt: '2026-10-14T14:00:00.000Z' };
    expect(upcomingCycles(intent, Date.parse('2026-10-15T00:00:00Z'), 3).map((c) => c.at)).toEqual(['2026-10-21T10:00:00.000Z', '2026-10-28T10:00:00.000Z', '2026-11-04T11:00:00.000Z']);
  });

  it('London across the start of summer time (29 Mar 2026): 06:00 GMT, then 06:00 BST', () => {
    const intent = { anchorAt: '2026-03-18T12:00:00.000Z', tz: 'Europe/London', lastCycleAt: '2026-03-18T12:00:00.000Z' };
    expect(upcomingCycles(intent, Date.parse('2026-03-19T00:00:00Z'), 2).map((c) => c.at)).toEqual(['2026-03-25T06:00:00.000Z', '2026-04-01T05:00:00.000Z']);
    expect(iso(zonedToUtc('Europe/London', 2026, 3, 29, 6, 0))).toBe('2026-03-29T05:00:00.000Z');
  });

  it('long overdue (a paused website, a dead host): only the most recent missed cycle is shown, once, then the normal weekday', () => {
    const intent = { anchorAt: '2026-08-05T10:00:00.000Z', tz: 'UTC', lastCycleAt: '2026-09-02T06:00:00.000Z' };
    const u = upcomingCycles(intent, Date.parse('2026-10-20T12:00:00Z'), 2);
    expect(u.map((c) => c.at)).toEqual(['2026-10-14T06:00:00.000Z', '2026-10-21T06:00:00.000Z']);
    expect(cycleOverdue({ status: 'active', next_due_at: '2026-10-14T06:00:00.000Z' }, Date.parse('2026-10-20T12:00:00Z'))).toBe(true);
    expect(cycleOverdue({ status: 'paused', next_due_at: '2026-10-14T06:00:00.000Z' }, Date.parse('2026-10-20T12:00:00Z'))).toBe(false);
    expect(cycleOverdue({ status: 'active', next_due_at: '2026-10-20T06:00:00.000Z' }, Date.parse('2026-10-20T12:00:00Z'))).toBe(false);
  });

  it('the monthly date is the anchor\'s day (at most 28): exactly 12 monthly cycles in a year, cycle 0 included', () => {
    expect(readCycleIntent({ anchorAt: '2026-01-31T10:00:00.000Z', tz: 'UTC' })?.monthlyDay).toBe(28);
    const intent = { anchorAt: '2026-01-14T10:00:00.000Z', tz: 'UTC' };
    const year = cyclesBetween(intent, Date.parse('2026-01-14T00:00:00Z'), Date.parse('2027-01-14T00:00:00Z'));
    expect(year.length).toBe(53);
    expect(year.filter((c) => c.monthly).length).toBe(12);
    expect(year[0]).toMatchObject({ cycle0: true, monthly: true });
    expect(monthlyPeriodKey('2026-03-27', 28)).toBe('2026-02');
    expect(monthlyPeriodKey('2026-03-28', 28)).toBe('2026-03');
    expect(monthlyPeriodKey('2026-01-05', 14)).toBe('2025-12');
  });

  it('the engine\'s own next due time wins while it is on the stored weekday; a changed weekday is recomputed', () => {
    const row: Partial<CycleRow> = { anchor_at: '2026-10-14T08:00:00.000Z', tz: 'UTC', cycle_weekday: 3, last_cycle_at: '2026-10-14T08:00:00.000Z', next_due_at: '2026-10-21T06:05:00.000Z' };
    expect(upcomingCycles(intentOfRow(row), Date.parse('2026-10-15T00:00:00Z'), 1)[0].at).toBe('2026-10-21T06:05:00.000Z');
    expect(upcomingCycles(intentOfRow({ ...row, cycle_weekday: 5 }), Date.parse('2026-10-15T00:00:00Z'), 1)[0].at).toBe('2026-10-23T06:00:00.000Z');
  });

  it('reads its input defensively: an unknown zone is the engine\'s, no anchor is no cycle', () => {
    expect(isValidTimezone('Asia/Dubai')).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
    expect(readCycleIntent({ anchorAt: '2026-10-14T08:00:00Z', tz: 'Mars/Olympus' })?.tz).toBe('America/New_York');
    expect(readCycleIntent({ anchorAt: '', tz: 'UTC' })).toBeNull();
    expect(upcomingCycles({ anchorAt: 'nope', tz: 'UTC' }, Date.now())).toEqual([]);
  });

  it('keys and request ids: the cycle key, the date in it, the §14.2 request id the callbacks carry', () => {
    expect(cycleKey('site_techand-ai', '2026-10-21')).toBe('cyc:site_techand-ai:2026-10-21');
    expect(cycleDateOf('cyc:site_techand-ai:2026-10-21')).toBe('2026-10-21');
    expect(cycleDateOf('something')).toBe('');
    expect(cycleRequestId('site_techand-ai', '2026-10-21', 'content_cadence')).toBe('cyc_techand-ai_20261021_content_cadence');
    expect(isCycleRequestId('cyc_techand-ai_20261021_content_cadence')).toBe(true);
    expect(isCycleRequestId('cad_20261021_techand-ai_1')).toBe(false);
    expect(isCycleRequestId('12345')).toBe(false);
    expect(itemKey('CRM — Service, Provider!')).toBe('crm service provider');
    expect(skipKey('site_x', 'always', 'cyc:site_x:2026-10-21', 'crm')).toBe('site_x:always:crm');
    expect(skipKey('site_x', 'cycle', 'cyc:site_x:2026-10-21', 'crm')).toBe('site_x:cyc:site_x:2026-10-21:crm');
    expect(cycleNorm('')).toBe('');
  });
});

describe('the schedules as automations', () => {
  it('the eight weekly jobs are cycle jobs, in the contract\'s order; the audit runs in the monthly cycle only', () => {
    const cyc = AUTOMATIONS.filter((a) => a.schedule.kind === 'cycle').sort((a, b) => (a.schedule as { order: number }).order - (b.schedule as { order: number }).order);
    expect(cyc.map((a) => (a.schedule as { job: string }).job)).toEqual(CYCLE_JOBS.map((j) => j.job));
    expect(cyc.map((a) => a.workflow)).toEqual(CYCLE_JOBS.map((j) => j.workflowId));
    expect(AUTOMATIONS.find((a) => a.id === 'audit')!.schedule).toMatchObject({ kind: 'cycle', monthlyOnly: true });
    expect(AUTOMATIONS.every((a) => !/Monday/.test(a.cadence + a.summary))).toBe(true);
  });

  it('nextScheduledRun of a cycle job: the website\'s next cycle (the monthly one for the audit); none without a website', () => {
    const site = { anchorAt: '2026-10-14T08:00:00.000Z', tz: 'UTC', lastCycleAt: '2026-10-14T08:00:00.000Z' };
    const ai = AUTOMATIONS.find((a) => a.id === 'ai_visibility')!.schedule;
    const audit = AUTOMATIONS.find((a) => a.id === 'audit')!.schedule;
    expect(nextScheduledRun(ai, 'UTC', new Date('2026-10-15T00:00:00Z'), site)?.toISOString()).toBe('2026-10-21T06:00:00.000Z');
    // monthly day 14: the first cycle on or after 14 Nov is the monthly one
    expect(nextScheduledRun(audit, 'UTC', new Date('2026-10-15T00:00:00Z'), { ...site, lastMonthlyKey: '2026-10' })?.toISOString()).toBe('2026-11-18T06:00:00.000Z');
    expect(nextScheduledRun(ai, 'UTC', new Date('2026-10-15T00:00:00Z'))).toBeNull();
  });
});

describe('the fit gate (ported from v5/code/_fit_gate.js)', () => {
  const topics = ['CRM implementation services', 'CRM consulting for sales teams', 'CRM data migration', 'Customer support desk setup', 'Sales pipeline automation', 'CRM training and adoption'];
  it('the website itself, a competitor (unless compared), a public body, a portal task, a job search', () => {
    expect(fitGate('techand crm', { own_domain: 'techand.ai' })).toMatchObject({ ok: false, reason: 'own brand' });
    expect(fitGate('hubspot pricing', { competitors: ['hubspot.com'] })).toMatchObject({ ok: false, reason: 'other brand' });
    expect(fitGate('hubspot vs salesforce', { competitors: ['hubspot.com'] }).ok).toBe(true);
    expect(fitGate('ministry of economy', {})).toMatchObject({ ok: false, reason: 'government' });
    expect(fitGate('fta vat registration', {}).ok).toBe(true);
    expect(fitGate('crm login', {})).toMatchObject({ ok: false, reason: 'portal' });
    expect(fitGate('sales manager jobs dubai', {})).toMatchObject({ ok: false, reason: 'job search' });
    expect(fitGate('', {})).toMatchObject({ ok: false, reason: 'empty' });
  });
  it('with the website\'s topics: off topic and too broad; on topic passes (the Techand replay)', () => {
    expect(fitGate('dynamics 365 finance operations partner uae', { topics })).toMatchObject({ ok: false, reason: 'off topic' });
    expect(fitGate('office coffee machines', { topics })).toMatchObject({ ok: false, reason: 'off topic' });
    expect(fitGate('crm implementation partner uae', { topics }).ok).toBe(true);
    expect(fitGate('ai', { topics: [...topics, 'enterprise search tools', 'workflow orchestration'] })).toMatchObject({ ok: false, reason: 'too broad' });
    // too little on file: the topic bar judges nothing (no evidence, no refusal)
    expect(fitTopic('office coffee machines', ['CRM'])).toMatchObject({ ok: true, share: null });
  });
  it('a brand AI names for another company; a stored row whose page is written is kept and only flagged', () => {
    expect(fitLearnedBrands([{ key: 'ai_brands:site_x', value: JSON.stringify({ Zoho: 'zoho.com' }) }, { key: 'cost:x', value: '{}' }])).toEqual({ Zoho: 'zoho.com' });
    expect(fitGate('zoho crm setup', { brands: { Zoho: 'zoho.com' } })).toMatchObject({ ok: false, reason: 'other brand' });
    expect(fitStored({ keyword: 'crm login', status: 'published' })).toMatchObject({ ok: true, flagged: true, live: true, reason: 'portal' });
    expect(fitStored({ keyword: 'crm login', status: 'planned' })).toMatchObject({ ok: false, flagged: true, live: false });
  });
});

describe('the forecast per autopilot level (plan §5.4)', () => {
  const m = monitorSettingsSchema.parse({});
  const row = (id: string, o: Parameters<typeof autopilotRows>[2]) => autopilotRows(m, 2, o).find((r) => r.id === id)!;
  it('levels 1-2: pages only while a chosen keyword has pages left; AI answer pages are suggestions; no research refresh', () => {
    expect(row('blog_posts', { level: 2, writing: true })).toMatchObject({ on: true, usd: Math.round(2 * MONITOR_COSTS.weeksPerMonth * MONITOR_COSTS.blogPostEach * 10000) / 10000 });
    expect(row('blog_posts', { level: 1, writing: false })).toMatchObject({ on: false, usd: 0, detail: expect.stringMatching(/until you choose a keyword/) });
    expect(row('ai_growth', { level: 2 }).detail).toMatch(/suggestions you approve/);
    expect(row('research', { level: 2 })).toMatchObject({ on: false, usd: 0 });
  });
  it('level 3: pages, the AI answer pages and the research refresh are forecast; no keyword means monitors only below level 3', () => {
    expect(row('blog_posts', { level: 3, writing: false }).on).toBe(true);
    expect(row('research', { level: 3 }).on).toBe(true);
    expect(row('ai_growth', { level: 3 }).usd).toBeGreaterThan(row('ai_growth', { level: 2 }).usd);
    expect(autopilotMonthlyUsd(m, 2, { level: 3, writing: false })).toBeGreaterThan(autopilotMonthlyUsd(m, 2, { level: 2, writing: false }));
    expect(autopilotMonthlyUsd(m, 2, { level: 2, writing: false })).toBe(autopilotMonthlyUsd(m, 0, { level: 2, writing: false }));
  });
  it('AUTO_SOURCES grows with the level, ladder pages at every level', () => {
    expect(AUTO_SOURCES[1]).toEqual(['ladder']);
    expect(AUTO_SOURCES[3].length).toBeGreaterThan(AUTO_SOURCES[2].length);
  });
});

describe('the request fields the engine reads by their exact keys (§14.5)', () => {
  const SITE = '7a1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
  const d = { callbackUrl: 'https://app.test/hook', email: '' };
  it('track: timezone and services after the fuzzy-matched head; a stored list is sent when none is given', () => {
    const t = RUN_SCHEMAS.track.parse({ mode: 'track', siteId: SITE, country: 'United States', timezone: 'Asia/Dubai', services: ['CRM implementation'] });
    const b = buildN8nPayload(t, null, d) as Record<string, unknown>;
    expect(b).toMatchObject({ timezone: 'Asia/Dubai', services: ['CRM implementation'] });
    expect(Object.keys(b).slice(0, 8)).toEqual(['mode', 'keyword', 'country', 'domain', 'email', 'callback_url', 'business', 'customers']);
    const s = buildN8nPayload(RUN_SCHEMAS.track.parse({ mode: 'track', siteId: SITE, country: 'United States' }), { domain: 'x.com', country: 'United States', business: '', customers: '', goal: 'leads', tone: '', cta: '', businessFacts: '', competitors: [], brandNames: [], ga4PropertyId: '', timezone: 'Europe/London', services: ['A b'] }, d) as Record<string, unknown>;
    expect(s).toMatchObject({ timezone: 'Europe/London', services: ['A b'] });
    expect(RUN_SCHEMAS.track.safeParse({ mode: 'track', siteId: SITE, country: 'United States', timezone: 'Mars/Olympus' }).success).toBe(false);
  });
  it('ladder: chosen_by defaults to the person typing it; ladder_mode only when chosen', () => {
    const b = buildN8nPayload(RUN_SCHEMAS.ladder.parse({ mode: 'ladder', siteId: SITE, keyword: 'crm consulting', country: 'United States' }), null, d) as Record<string, unknown>;
    expect(b).toMatchObject({ chosen_by: 'client_typed' });
    expect(b).not.toHaveProperty('ladder_mode');
    const p = buildN8nPayload(RUN_SCHEMAS.ladder.parse({ mode: 'ladder', siteId: SITE, keyword: 'crm consulting', country: 'United States', chosenBy: 'client_picked', ladderMode: 'manual' }), null, d) as Record<string, unknown>;
    expect(p).toMatchObject({ chosen_by: 'client_picked', ladder_mode: 'manual' });
  });
  it('discover never asks for a page, whatever is sent', () => {
    const r = RUN_SCHEMAS.discover.parse({ mode: 'discover', siteId: SITE, country: 'United States', receiveContent: true });
    expect(r.receiveContent).toBe(false);
    expect((buildN8nPayload(r, null, d) as Record<string, unknown>).receive).toEqual(['Keyword Report']);
  });
  it('the new bodies: weekday, Coming up decision, feedback, the level', () => {
    expect(cycleWeekdaySchema.safeParse({ weekday: 6 }).success).toBe(true);
    expect(cycleWeekdaySchema.safeParse({ weekday: 7 }).success).toBe(false);
    expect(comingUpDecisionSchema.parse({ itemKey: 'crm', decision: 'skip' })).toEqual({ itemKey: 'crm', decision: 'skip', scope: 'cycle' });
    expect(comingUpDecisionSchema.safeParse({ itemKey: 'crm', decision: 'maybe' }).success).toBe(false);
    expect(contentFeedbackSchema.parse({ verdict: 'reject' })).toEqual({ verdict: 'reject', reason: '' });
    expect(siteAutomationSchema.safeParse({ autopilotLevel: 3 }).success).toBe(true);
    expect(siteAutomationSchema.safeParse({ autopilotLevel: 4 }).success).toBe(false);
  });
});

// D3 (paid pre-launch run 2026-10-21): the launch screen's "Today" figure left out the site report "Track my site" starts (the website's
// first weekly report, autopilot spend), so the launch total showed nothing for it
describe('the first cycle\'s checks on launch day', () => {
  const m = monitorSettingsSchema.parse({});
  it('include the first weekly site report, a week of each weekly check and the monthly audit in full; no pages, no research refresh', () => {
    const rows = autopilotRows(m, 2, { level: 3, writing: true });
    const site = rows.find((r) => r.id === 'site_report')!;
    const audit = rows.find((r) => r.id === 'audit')!;
    expect(site.on && site.usd > 0).toBe(true);
    const weekly = rows.filter((r) => r.on && !['audit', 'blog_posts', 'research'].includes(r.id)).reduce((t, r) => t + r.usd / MONITOR_COSTS.weeksPerMonth, 0);
    expect(firstCycleChecksUsd(rows)).toBeCloseTo(weekly + audit.usd, 4);
    expect(firstCycleChecksUsd(rows)).toBeGreaterThan(firstCycleChecksUsd(rows.filter((r) => r.id !== 'site_report')));
    expect(firstCycleChecksUsd(rows.map((r) => (r.id === 'blog_posts' || r.id === 'research' ? r : { ...r, on: false, usd: 0 })))).toBe(0);
  });
});
