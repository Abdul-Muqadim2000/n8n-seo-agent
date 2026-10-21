import { describe, expect, it, vi } from 'vitest';
import { adminCreditSchema, creditsFor, platformSettingsSchema } from '@seo/shared';

// The admin panel's pure rules: credits, periods, CSV, and how an engine ledger row is attributed and priced.

vi.hoisted(() => {
  process.env.LOG_LEVEL = 'silent';
  process.env.PLATFORM_ADMIN_EMAILS = 'boss@admin.test';
});
vi.mock('../src/db', async () => ({ db: {}, schema: await import('../src/db/schema') }));
vi.mock('../src/n8n/client', () => ({ rows: vi.fn(async () => []) }));

const { periodRange, daysOf, inRange } = await import('../src/services/admin/period');
const { csvCell, toCsv, moneyOf, toSplit } = await import('../src/services/admin/reports');
const { attributeLedgerRow, engineCost, isAppKeywordCheckRow, splitAppRun, splitKeywordCheck } = await import('../src/services/admin/costSync');
const { balanceSpend } = await import('../src/services/admin/bills');

describe('creditsFor', () => {
  it('cost × markup ÷ credit value, two decimals, never negative', () => {
    expect(creditsFor(1, { creditValueUsd: 0.1, markup: 3 })).toBe(30);
    expect(creditsFor(0.0333, { creditValueUsd: 0.1, markup: 3 })).toBe(1);
    expect(creditsFor(0.012345, { creditValueUsd: 0.1, markup: 3 })).toBe(0.37);
    expect(creditsFor(0, { creditValueUsd: 0.1, markup: 3 })).toBe(0);
    expect(creditsFor(-2, { creditValueUsd: 0.1, markup: 3 })).toBe(0);
    expect(creditsFor(Number.NaN, { creditValueUsd: 0.1, markup: 3 })).toBe(0);
    expect(creditsFor(5, { creditValueUsd: 0, markup: 3 })).toBe(0);
  });
  it('the credit and settings bodies refuse what makes no sense', () => {
    expect(adminCreditSchema.safeParse({ kind: 'grant', credits: 10, paidUsd: 5 }).success).toBe(true);
    expect(adminCreditSchema.safeParse({ kind: 'grant', credits: -10 }).success).toBe(false);
    expect(adminCreditSchema.safeParse({ kind: 'adjust', credits: 0 }).success).toBe(false);
    expect(adminCreditSchema.safeParse({ kind: 'adjust', credits: -5 }).success).toBe(true);
    expect(adminCreditSchema.safeParse({ kind: 'refund', credits: 5, paidUsd: 1 }).success).toBe(false);
    expect(platformSettingsSchema.safeParse({ creditValueUsd: 0.1, markup: 0.5, signupCredits: 0, enforceForNewCompanies: false }).success).toBe(false);
  });
});

describe('periodRange (UTC)', () => {
  const now = new Date('2026-10-18T15:30:00Z');
  it('month to date, the whole last month, rolling windows, all', () => {
    expect(periodRange('month', now)).toEqual({ period: 'month', from: new Date('2026-10-01T00:00:00Z'), to: now });
    expect(periodRange('last_month', now)).toEqual({ period: 'last_month', from: new Date('2026-09-01T00:00:00Z'), to: new Date('2026-10-01T00:00:00Z') });
    expect(periodRange('7d', now).from).toEqual(new Date('2026-10-11T15:30:00Z'));
    expect(periodRange('30d', now).from).toEqual(new Date('2026-09-18T15:30:00Z'));
    expect(periodRange('90d', now).from).toEqual(new Date('2026-07-20T15:30:00Z'));
    expect(periodRange('all', now)).toEqual({ period: 'all', from: null, to: now });
  });
  it('January: last month is December of the year before', () => {
    expect(periodRange('last_month', new Date('2027-01-05T00:00:00Z')).from).toEqual(new Date('2026-12-01T00:00:00Z'));
  });
  it('from is inclusive, to exclusive; the days of a window', () => {
    const r = periodRange('last_month', now);
    expect(inRange(r, new Date('2026-09-01T00:00:00Z'))).toBe(true);
    expect(inRange(r, new Date('2026-10-01T00:00:00Z'))).toBe(false);
    expect(daysOf(new Date('2026-10-01T00:00:00Z'), new Date('2026-10-03T12:00:00Z'))).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(daysOf(r.from!, r.to)).toHaveLength(30);
    // a window longer than the cap keeps its most recent days
    const long = daysOf(new Date('2020-01-01T00:00:00Z'), new Date('2026-10-18T12:00:00Z'), 10);
    expect(long).toEqual(['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  });
});

describe('CSV', () => {
  it('quotes, doubles quotes and defuses formulas in text cells (= + - @ tab CR), never in numbers', () => {
    expect(csvCell('Acme')).toBe('Acme');
    expect(csvCell('Acme, Inc')).toBe('"Acme, Inc"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\tx')).toBe("'\tx");
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell(-3.5)).toBe('-3.5');
    expect(csvCell(null)).toBe('');
    expect(csvCell(true)).toBe('true');
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\r\n1,x\r\n');
  });
});

describe('money', () => {
  it('margin = revenue − cost; no revenue, no percentage', () => {
    const cost = toSplit({ claude: 1, claude_est: 0.4, dfs: 0.5 });
    expect(cost).toEqual({ claudeUsd: 1, dataforseoUsd: 0.5, totalUsd: 1.5, claudeEstimatedUsd: 0.4 });
    expect(moneyOf(cost, 6, 4.5)).toEqual({ cost, revenueUsd: 6, marginUsd: 4.5, marginPct: 75, listValueUsd: 4.5 });
    expect(moneyOf(cost, 0, 0).marginPct).toBeNull();
  });
});

describe('engine ledger rows', () => {
  const ORG = '11111111-1111-4111-8111-111111111111';
  const LATE = '33333333-3333-4333-8333-333333333333';
  const verifiedAt = new Date('2026-10-01T00:00:00Z');
  const lk = {
    // the engine's own execution ids, mapped through the callbacks: never the front door's request id
    runsByExec: new Map([['main-100', { id: 'run-1', orgId: ORG, siteId: 'site-1', userId: 'user-1' }]]),
    sitesByDomain: new Map([
      ['acme.test', { id: 'site-1', orgId: ORG, verifiedAt }],
      ['late.test', { id: 'site-2', orgId: LATE, verifiedAt: new Date('2026-10-10T00:00:00Z') }],
    ]),
    sitesByEngineId: new Map([['site_acme-test', { id: 'site-1', orgId: ORG, verifiedAt }]]),
    orgs: new Map([[ORG, new Date('2026-09-01T00:00:00Z')], [LATE, new Date('2026-09-01T00:00:00Z')]]),
    stored: new Map(),
  };
  const at = '2026-10-05T12:00:00Z';
  it('a run by its execution id; a child by its parent; app:<company>; a schedule by domain or site id; else nobody', () => {
    expect(attributeLedgerRow({ run_id: 'main-100', key: `app:${ORG}`, settled_at: at }, lk)).toEqual({ orgId: ORG, siteId: 'site-1', userId: 'user-1', runId: 'run-1', origin: 'app' });
    expect(attributeLedgerRow({ run_id: '101', key: 'parent:main-100', mode: 'ai_visibility', settled_at: at }, lk).runId).toBe('run-1');
    expect(attributeLedgerRow({ run_id: '102', key: `app:${ORG}`, settled_at: at }, lk)).toMatchObject({ orgId: ORG, runId: null, origin: 'app' });
    expect(attributeLedgerRow({ run_id: '103', key: 'schedule:rank_tracker', domain: 'www.acme.test', settled_at: at }, lk)).toMatchObject({ orgId: ORG, siteId: 'site-1', origin: 'schedule' });
    expect(attributeLedgerRow({ run_id: '104', key: 'cadence:site_acme-test', settled_at: at }, lk)).toMatchObject({ orgId: ORG, origin: 'schedule' });
    expect(attributeLedgerRow({ run_id: '105', key: 'schedule:ai_pulse', domain: 'stranger.test', settled_at: at }, lk).orgId).toBeNull();
    expect(attributeLedgerRow({ run_id: '106', key: 'app:22222222-2222-4222-8222-222222222222', settled_at: at }, lk).orgId).toBeNull();
    const batch = new Map([['200', { run_id: '200', key: 'schedule:backlinks', domain: 'acme.test', settled_at: at }]]);
    expect(attributeLedgerRow({ run_id: '201', key: 'parent:200', settled_at: at }, lk, batch)).toMatchObject({ orgId: ORG, origin: 'schedule' });
  });
  // D3 (paid pre-launch run 2026-10-21): "Track my site" starts the Site Tracker as its child (`parent:<track exec>`); that run is the
  // website's first weekly site report, autopilot spend, never an on-demand charge under the Track run's quote of 0
  it('a child of a Track run is the website\'s autopilot spend (no run, schedule); a child of any other run stays that run\'s', () => {
    const withTrack = { ...lk, runsByExec: new Map<string, import('../src/services/admin/costSync').RunRef>([...lk.runsByExec, ['13', { id: 'run-track', orgId: ORG, siteId: 'site-1', userId: 'user-1', mode: 'track' }]]) };
    expect(attributeLedgerRow({ run_id: '16', key: 'parent:13', mode: 'site_tracker', settled_at: at }, withTrack)).toEqual({ orgId: ORG, siteId: 'site-1', userId: null, runId: null, origin: 'schedule' });
    // the Track run's own row is still the Track run's
    expect(attributeLedgerRow({ run_id: '13', key: `app:${ORG}`, mode: 'track', settled_at: at }, withTrack)).toMatchObject({ runId: 'run-track', origin: 'app' });
    expect(attributeLedgerRow({ run_id: '101', key: 'parent:main-100', mode: 'ai_visibility', settled_at: at }, withTrack)).toMatchObject({ runId: 'run-1', origin: 'app' });
  });
  it('a website verified after the money was spent, or a company created after it, did not cause it', () => {
    expect(attributeLedgerRow({ run_id: '300', key: 'schedule:ai_pulse', domain: 'late.test', settled_at: at }, lk).orgId).toBeNull();
    expect(attributeLedgerRow({ run_id: '301', key: 'schedule:ai_pulse', domain: 'late.test', settled_at: '2026-10-11T00:00:00Z' }, lk).orgId).toBe(LATE);
    expect(attributeLedgerRow({ run_id: '302', key: `app:${ORG}`, settled_at: '2026-08-01T00:00:00Z' }, lk).orgId).toBeNull();
  });
  it('prices a row: Claude, its estimated part, DataForSEO, certainty', () => {
    expect(engineCost({ ai_usd: 0.3, dfs_usd: 0.2, measured_usd: 0.2, estimated_usd: 0.3 })).toEqual({ claudeUsd: 0.3, claudeEstimatedUsd: 0.3, dataforseoUsd: 0.2, certainty: 'partly estimated' });
    expect(engineCost({ ai_usd: 0, dfs_usd: 0.05, measured_usd: 0.05, estimated_usd: 0 }).certainty).toBe('measured');
    expect(engineCost({ ai_usd: '', dfs_usd: null })).toMatchObject({ claudeUsd: 0, dataforseoUsd: 0, certainty: 'measured' });
    // a row settled before the engine split its money (no ai_usd / measured_usd / estimated_usd): the reservation, all of it estimated
    expect(engineCost({ settled_usd: 0.1, dfs_usd: 0.02 })).toEqual({ claudeUsd: 0.1, claudeEstimatedUsd: 0.1, dataforseoUsd: 0.02, certainty: 'estimated' });
    expect(isAppKeywordCheckRow({ mode: 'assess', key: `app:${ORG}` })).toBe(true);
    expect(isAppKeywordCheckRow({ mode: 'assess', key: 'someone@example.com' })).toBe(false);
  });
});

describe('splitting an app run', () => {
  const run = { mode: 'keyword', input: { mode: 'keyword', receiveContent: true }, actualCostUsd: 0.5, actualCostPartial: false, actualCostEstimated: true };
  it('by the run ledger of the callbacks that counted for it', () => {
    const c = splitAppRun(run, [{ stage: 'content', payload: { run_ledger: { dataforseo_usd: 0.1, ai_usd: 0.4, ai_cost: { estimated: true, measured_usd: 0.1, estimated_usd: 0.3 }, ai_cost_estimated: true } } }]);
    expect(c).toEqual({ claudeUsd: 0.4, claudeEstimatedUsd: 0.3, dataforseoUsd: 0.1, certainty: 'partly estimated' });
  });
  it('a scheduled callback that did not count for the run is left out', () => {
    const c = splitAppRun({ ...run, actualCostUsd: 0.2, actualCostEstimated: false }, [
      { stage: 'content', payload: { run_ledger: { dataforseo_usd: 0.05, ai_usd: 0.15 } } },
      { stage: 'rank_tracker', payload: { run_ledger: { dataforseo_usd: 9, ai_usd: 9 } } },
    ]);
    expect(c).toEqual({ claudeUsd: 0.15, claudeEstimatedUsd: 0, dataforseoUsd: 0.05, certainty: 'measured' });
  });
  it('search data only: all DataForSEO, the model part not reported', () => {
    expect(splitAppRun({ ...run, actualCostPartial: true }, [])).toEqual({ claudeUsd: 0, claudeEstimatedUsd: 0, dataforseoUsd: 0.5, certainty: 'not reported' });
  });
  it('no split known: by the engine cost table for the mode, labelled estimated', () => {
    const c = splitAppRun({ ...run, mode: 'audit', input: { mode: 'audit', reportType: 'full' }, actualCostUsd: 1 }, []);
    expect(c.certainty).toBe('estimated');
    expect(c.claudeUsd + c.dataforseoUsd).toBeCloseTo(1, 6);
    expect(c.claudeEstimatedUsd).toBe(c.claudeUsd);
    expect(c.dataforseoUsd).toBeGreaterThan(c.claudeUsd); // a full report is mostly search data
  });
  it('a keyword check: one Haiku call (estimated) and the rest DataForSEO', () => {
    expect(splitKeywordCheck(0.03, true)).toEqual({ claudeUsd: 0.0033, claudeEstimatedUsd: 0.0033, dataforseoUsd: 0.0267, certainty: 'partly estimated' });
    expect(splitKeywordCheck(0.05, false).certainty).toBe('estimated');
  });
});

describe('DataForSEO balance movement', () => {
  it('counts every fall between consecutive readings and ignores top-ups', () => {
    const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 0, m));
    expect(balanceSpend([{ at: at(0), balance: 10 }, { at: at(5), balance: 9.5 }, { at: at(9), balance: 59.5 }, { at: at(12), balance: 59 }, { at: at(3), balance: 9.8 }])).toBe(1);
    expect(balanceSpend([{ at: at(0), balance: 10 }])).toBe(0);
    expect(balanceSpend([{ at: at(0), balance: 0 }, { at: at(1), balance: 5 }])).toBe(0);
  });
});
