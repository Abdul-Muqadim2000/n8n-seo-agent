import { describe, expect, it } from 'vitest';
import ledger from './__fixtures__/credit-ledger-client-2026-11-17.json';
import { autopilotRows } from './autopilot';
import { creditStatus, LOW_RUNWAY_DAYS } from './billing';
import { costPerOutcome, creditRunways, isOurTestEntry, measuredForecast, outcomeCostText, outcomeKindOfMode, outcomesOf, spread, type UsageEntry } from './credit-forecast';
import { monitorSettingsSchema } from './schemas';

// CR17-I (client report 2026-11-17, M2): the forecast built from the ledger. The fixture is the anonymised usage ledger of the client that
// reported it (81 entries, 2026-10-23 to 2026-11-17): its schedules charged 443.5 credits in the 30 days before the report, while the
// price-list forecast said 1,404 a month (pages at 114 credits each, two a week whatever the ladders had left, the pulse at 169).

const entries = ledger as UsageEntry[];
const NOW = new Date('2026-11-17T14:00:00Z');
const RATE = 60; // 3x markup at $0.05 a credit
// the client's settings: level 2, 2 pages a week, every monitor on, a keyword ladder (rank checks), 10 questions
const monitors = monitorSettingsSchema.parse({ aiPromptsMax: 10 });
const rows = autopilotRows(monitors, 2, { level: 2, writing: true, ranking: true });
const site = { domain: 'client.example', rows, pagesPerWeek: 2, since: '2026-10-23T09:44:16Z' };
const sum = (xs: UsageEntry[]) => Math.round(-xs.reduce((t, e) => t + e.credits, 0) * 100) / 100;
const last30 = (o: string) => entries.filter((e) => e.origin === o && Date.parse(e.at) >= NOW.getTime() - 30 * 86_400_000);

describe('the fixture is the reported ledger', () => {
  it('its schedules charged 443.5 credits in the last 30 days, and the price list says about 1,404 a month', () => {
    expect(sum(last30('autopilot'))).toBeCloseTo(443.54, 1);
    expect(Math.round(rows.reduce((t, r) => t + r.usd, 0) * RATE)).toBeGreaterThan(1300);
  });
});

describe('measuredForecast', () => {
  it('about 440 to 550 a month, not 1,404: the measured rows, and the pages the autopilot really writes', () => {
    const f = measuredForecast({ sites: [{ ...site, pagesLeft: 1 }], entries, rate: RATE, now: NOW });
    expect(f.autopilotMonthly).toBeGreaterThan(420);
    // FX-SERVER (R3 M1): each row reads its own history, so AI growth (first run 11 days ago) is its typical run x 4.3 weeks and the pulse
    // its 2 charged days over its own 13 days, not over the website's 25: about 540, still a third of the price list
    expect(f.autopilotMonthly).toBeLessThan(560);
    const page = f.sites[0].rows.find((r) => r.id === 'blog_posts')!;
    // one page was left on the ladders, but the autopilot wrote 4 in the last 30 days (approved suggestions too): about 4.8 a month
    // (its history is 25 days) at the typical charge of this website's automatic pages (52.9 to 75.3, typical about 54)
    expect(page.credits).toBeGreaterThan(4 * 50);
    expect(page.credits).toBeLessThan(5 * 60);
    expect(page.detail).toMatch(/as in the last 30 days \(1 left on your keyword ladders\), about 5\d credits each/);
    // the pulse is forecast at what it was charged (two single-site days), not at the price list
    const pulse = f.sites[0].rows.find((r) => r.id === 'ai_pulse')!;
    expect(pulse.basis).toBe('measured');
    expect(pulse.credits).toBeLessThan(30);
    expect(f.sites[0].rows.find((r) => r.id === 'ai_growth')).toMatchObject({ basis: 'per_run' });
  });

  it('pages follow the weekly pace when the ladders have more left, and nothing when none is left and none was written lately', () => {
    const many = measuredForecast({ sites: [{ ...site, pagesLeft: 50 }], entries, rate: RATE, now: NOW });
    const noRecentPage = entries.filter((e) => !(e.origin === 'autopilot' && e.mode === 'keyword'));
    const none = measuredForecast({ sites: [{ ...site, pagesLeft: 0 }], entries: noRecentPage, rate: RATE, now: NOW });
    const p = (f: typeof many) => f.sites[0].rows.find((r) => r.id === 'blog_posts')!.credits;
    expect(p(many)).toBeGreaterThan(8 * 50); // 8.66 pages a month at about 54
    expect(p(none)).toBe(0);
    expect(none.sites[0].rows.find((r) => r.id === 'blog_posts')!.detail).toBe('no page left to write on your keyword ladders');
  });

  it('our team\'s test runs (keyword research Trial, no app run) never count in the client\'s own pace', () => {
    const f = measuredForecast({ sites: [{ ...site, pagesLeft: 1 }], entries, rate: RATE, now: NOW });
    const tests = last30('on_demand').filter(isOurTestEntry);
    expect(sum(tests)).toBeCloseTo(118.47, 1);
    expect(f.onDemandMonthly).toBeCloseTo(sum(last30('on_demand')) - sum(tests), 1);
  });

  it('a row that is off forecasts nothing; a person\'s pause forecasts nothing at all', () => {
    const off = rows.map((r) => (r.id === 'ai_visibility' ? { ...r, on: false } : r));
    const f = measuredForecast({ sites: [{ ...site, rows: off, pagesLeft: 1 }], entries, rate: RATE, now: NOW });
    expect(f.sites[0].rows.find((r) => r.id === 'ai_visibility')).toMatchObject({ credits: 0, basis: 'off' });
    const paused = measuredForecast({ sites: [{ ...site, pagesLeft: 1, pausedByPerson: true }], entries, rate: RATE, now: NOW });
    expect(paused.autopilotMonthly).toBe(0);
  });

  it('a new website with no history uses the price list, one with a few runs its typical run', () => {
    const fresh = measuredForecast({ sites: [{ ...site, since: NOW.toISOString(), pagesLeft: 1 }], entries: [], rate: RATE, now: NOW });
    const ai = fresh.sites[0].rows.find((r) => r.id === 'ai_visibility')!;
    expect(ai.basis).toBe('estimate');
    expect(ai.credits).toBeCloseTo(rows.find((r) => r.id === 'ai_visibility')!.usd * RATE, 1);
    const young = measuredForecast({
      sites: [{ ...site, since: '2026-11-12T00:00:00Z', pagesLeft: 1 }],
      entries: [{ at: '2026-11-14T08:00:00Z', credits: -20, origin: 'autopilot', mode: 'ai_visibility', domain: 'client.example', runId: null, engineRunId: '1' }],
      rate: RATE,
      now: NOW,
    });
    expect(young.sites[0].rows.find((r) => r.id === 'ai_visibility')).toMatchObject({ basis: 'per_run', credits: 86.6 });
  });
});

describe('a row reads its own history, not the website\'s (FX-SERVER, review R3 M1)', () => {
  // a website tracked 60 days: the weekly site report charged 4 x 5 credits; the daily pulse was off until today
  const since = '2026-09-18T00:00:00Z';
  const reports: UsageEntry[] = [3, 10, 17, 24].map((d, i) => ({ at: new Date(NOW.getTime() - d * 86_400_000).toISOString(), credits: -5, origin: 'autopilot', mode: 'site_tracker', domain: 'client.example', runId: null, engineRunId: `e${i}` }));
  const withPulse = (on: boolean) => autopilotRows(monitorSettingsSchema.parse({ aiPromptsMax: 10, aiPulse: on }), 0, { level: 2, writing: false, ranking: false });
  const pulseOf = (f: ReturnType<typeof measuredForecast>) => f.sites[0].rows.find((r) => r.id === 'ai_pulse')!;

  it('switching on the daily pulse on a 60-day-old website is priced, not 0', () => {
    const off = measuredForecast({ sites: [{ domain: 'client.example', rows: withPulse(false), pagesPerWeek: 0, pagesLeft: 0, since }], entries: reports, rate: RATE, now: NOW });
    expect(pulseOf(off)).toMatchObject({ credits: 0, basis: 'off' });
    const rowsOn = withPulse(true);
    const on = measuredForecast({ sites: [{ domain: 'client.example', rows: rowsOn, pagesPerWeek: 0, pagesLeft: 0, since }], entries: reports, rate: RATE, now: NOW });
    const quote = Math.round(rowsOn.find((r) => r.id === 'ai_pulse')!.usd * RATE * 100) / 100;
    expect(quote).toBeGreaterThan(0);
    expect(pulseOf(on)).toMatchObject({ basis: 'estimate', credits: quote });
    expect(on.autopilotMonthly).toBeGreaterThan(off.autopilotMonthly + quote - 1);
    // the website's own report row stays measured: it has 24 days of its own history
    expect(on.sites[0].rows.find((r) => r.id === 'site_report')).toMatchObject({ basis: 'measured' });
  });

  it('a row switched back on after weeks off uses its typical run, never the 0 its off weeks charged', () => {
    const old: UsageEntry[] = [70, 64, 58].map((d, i) => ({ at: new Date(NOW.getTime() - d * 86_400_000).toISOString(), credits: -2, origin: 'autopilot', mode: 'ai_pulse', domain: 'client.example', runId: null, engineRunId: `p${i}` }));
    const rowsOn = withPulse(true);
    const stale = measuredForecast({ sites: [{ domain: 'client.example', rows: rowsOn, pagesPerWeek: 0, pagesLeft: 0, since }], entries: [...reports, ...old], rate: RATE, now: NOW });
    // without the hint the old history is measured over a window it was off in: the steady state of a row that really charged nothing
    expect(pulseOf(stale)).toMatchObject({ basis: 'measured', credits: 0 });
    const fresh = measuredForecast({ sites: [{ domain: 'client.example', rows: rowsOn, pagesPerWeek: 0, pagesLeft: 0, since, switchedOn: ['ai_pulse'] }], entries: [...reports, ...old], rate: RATE, now: NOW });
    expect(pulseOf(fresh)).toMatchObject({ basis: 'per_run' });
    expect(pulseOf(fresh).credits).toBeCloseTo(2 * 6 * 4.33, 1);
  });

  it('a row with a few days of its own history on an old website uses its typical run', () => {
    const young: UsageEntry[] = [{ at: new Date(NOW.getTime() - 3 * 86_400_000).toISOString(), credits: -20, origin: 'autopilot', mode: 'backlinks', domain: 'client.example', runId: null, engineRunId: 'b1' }];
    const rowsOn = autopilotRows(monitorSettingsSchema.parse({ aiPromptsMax: 10, backlinks: true }), 0, { level: 2, writing: false, ranking: false });
    const f = measuredForecast({ sites: [{ domain: 'client.example', rows: rowsOn, pagesPerWeek: 0, pagesLeft: 0, since }], entries: [...reports, ...young], rate: RATE, now: NOW });
    expect(f.sites[0].rows.find((r) => r.id === 'backlinks')).toMatchObject({ basis: 'per_run', credits: 86.6 });
  });
});

describe('cost per outcome', () => {
  it('a written page: median and usual range from the ledger, each run once (re-prices netted), test runs left out', () => {
    const c = costPerOutcome(entries, NOW);
    const page = c.find((x) => x.kind === 'page')!;
    expect(page.count).toBeGreaterThanOrEqual(10);
    expect(page.median).toBeGreaterThan(53);
    expect(page.median).toBeLessThan(65);
    expect(page.low).toBeGreaterThanOrEqual(50);
    expect(page.high).toBeLessThanOrEqual(76);
    expect(c.find((x) => x.kind === 'ai_check')!.median).toBeGreaterThan(15);
    // the research runs left are the client's own (with an app run), never our Trial runs
    const research = c.find((x) => x.kind === 'research');
    expect(research?.count ?? 0).toBeLessThan(entries.filter((e) => e.mode === 'keyword_research').length);
    expect(outcomeCostText(page)).toMatch(/^about \d+ to \d+ credits \(typical: \d+, from your last \d+\)$/);
  });

  it('one outcome per run: a debit and its return net to nothing', () => {
    const o = outcomesOf([
      { at: '2026-11-01T00:00:00Z', credits: -10, origin: 'on_demand', mode: 'keyword', domain: 'a.example', runId: 'r1' },
      { at: '2026-11-01T00:05:00Z', credits: 10, origin: 'on_demand', mode: 'keyword', domain: 'a.example', runId: 'r1' },
    ]);
    expect(o).toHaveLength(1);
    expect(o[0].credits).toBe(0);
    expect(spread([1, 2, 3])).toEqual({ median: 2, low: 1, high: 3, count: 3 });
    expect(outcomeKindOfMode('page_finalize')).toBe('final_version');
  });
});

describe('two runways and the low-balance warning', () => {
  it('the schedules alone, and with the client\'s own analyses at last month\'s pace', () => {
    const r = creditRunways(893.58, 443.5, 600);
    expect(r.autopilotAlone).toBeCloseTo(60.4, 0);
    expect(r.withOwn).toBeCloseTo(25.7, 0);
    expect(creditRunways(100, 0, 0)).toMatchObject({ autopilotAlone: null, withOwn: null });
  });

  it('low under two weeks, so a top-up request has time to be confirmed', () => {
    expect(LOW_RUNWAY_DAYS).toBe(14);
    expect(creditStatus(130, 10)).toBe('low');
    expect(creditStatus(150, 10)).toBe('ok');
    expect(creditStatus(20, 10)).toBe('critical');
  });
});
