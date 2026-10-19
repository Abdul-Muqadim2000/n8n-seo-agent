import { describe, expect, it } from 'vitest';
import { creditsFor, type AdminRunRow } from '@seo/shared';
import { bookLines, creditOrUsd } from '@/pages/admin/_components/units';
import { book } from './adminFixtures';
import {
  actionLabel,
  aggregateByMode,
  axisUsd,
  balanceAfter,
  credits,
  cumulative,
  detailText,
  estimatedShare,
  marginPct,
  modeLabel,
  money,
  parsePeriod,
  ratioLabel,
  signedCredits,
  signedMoney,
  sumSplits,
  withPeriod,
  workedExample,
} from '../src/pages/admin/lib';

// The platform admin panel (/admin, 2026-10-18): the rules it derives itself — the period in the URL, money and credit figures, the
// cost-by-mode roll-up and the settings' worked example.

describe('period in the URL', () => {
  it('reads every contract period and falls back to this month', () => {
    for (const p of ['month', 'last_month', '7d', '30d', '90d', 'all']) expect(parsePeriod(p)).toBe(p);
    for (const p of [null, undefined, '', 'week', 'ALL', '7']) expect(parsePeriod(p)).toBe('month');
  });
  it('keeps the default out of the URL and appends to an existing query', () => {
    expect(withPeriod('/admin/users', 'month')).toBe('/admin/users');
    expect(withPeriod('/admin/users', '30d')).toBe('/admin/users?period=30d');
    expect(withPeriod('/admin/runs?orgId=x', 'all')).toBe('/admin/runs?orgId=x&period=all');
  });
});

describe('money', () => {
  it('shows 4 decimals under $1 so cents of a run stay visible', () => {
    expect(money(0.0042)).toBe('$0.0042');
    expect(money(0.8)).toBe('$0.8000');
    expect(money(0)).toBe('$0.00');
    expect(money(12.5)).toBe('$12.50');
  });
  it('separates thousands and uses a real minus for losses', () => {
    expect(money(12345.678)).toBe('$12,345.68');
    expect(money(-3.5)).toBe('−$3.50');
    expect(money(-0.00001)).toBe('$0.0000');
  });
  it('never turns a missing figure into $0', () => {
    expect(money(null)).toBe('–');
    expect(money(Number.NaN)).toBe('–');
  });
  it('signs changes', () => {
    expect(signedMoney(2)).toBe('+$2.00');
    expect(signedMoney(-2)).toBe('−$2.00');
    expect(money(1.5, { digits: 0 })).toBe('$2');
  });
});

describe('credits and ratios', () => {
  it('formats credits with up to 2 decimals', () => {
    expect(credits(1234.567)).toBe('1,234.57');
    expect(credits(-50)).toBe('−50');
    expect(signedCredits(24)).toBe('+24');
    expect(credits(null)).toBe('–');
  });
  it('says "no revenue" rather than inventing a margin percentage', () => {
    expect(marginPct(null)).toBe('no revenue');
    expect(marginPct(42.04)).toBe('42%');
    expect(marginPct(-12.5)).toBe('−12.5%');
  });
  it('shows a ratio only when both sides exist', () => {
    expect(ratioLabel(1.0412)).toBe('1.04×');
    expect(ratioLabel(null)).toBe('–');
  });
  it('previews the balance after a grant, an adjustment and a refund', () => {
    expect(balanceAfter(10, 'grant', 90)).toBe(100);
    expect(balanceAfter(10, 'adjust', -15)).toBe(-5);
    expect(balanceAfter(10, 'refund', 2.5)).toBe(12.5);
    expect(balanceAfter(10, 'grant', Number.NaN)).toBe(10);
  });
});

describe('cost figures', () => {
  const split = (c: number, d: number, e = 0) => ({ claudeUsd: c, dataforseoUsd: d, totalUsd: c + d, claudeEstimatedUsd: e });
  it('names the estimated share of Claude cost, and none without Claude cost', () => {
    expect(estimatedShare(split(2, 1, 0.5))).toBe(0.25);
    expect(estimatedShare(split(0, 1))).toBeNull();
    expect(estimatedShare(null)).toBeNull();
  });
  it('adds splits field by field', () => {
    expect(sumSplits([split(1, 2, 0.5), null, split(0.25, 0)])).toEqual({ claudeUsd: 1.25, dataforseoUsd: 2, totalUsd: 3.25, claudeEstimatedUsd: 0.5 });
  });
  it('rolls runs up by mode, counting unsettled runs without pricing them, most costly first', () => {
    const run = (mode: string, cost: ReturnType<typeof split> | null, cr: number | null): AdminRunRow => ({
      id: Math.random().toString(36),
      orgId: 'o',
      orgName: 'O',
      siteDomain: null,
      userEmail: null,
      mode,
      title: '',
      status: 'completed',
      createdAt: '2026-10-18T00:00:00Z',
      completedAt: null,
      error: null,
      cost,
      certainty: 'measured',
      credits: cr,
      origin: 'app',
    });
    const out = aggregateByMode([run('verdict', split(0.1, 0.05), 4.5), run('keyword', split(0.6, 0.2), 24), run('verdict', null, null), run('keyword', split(0.1, 0), 3)]);
    expect(out.map((m) => m.mode)).toEqual(['keyword', 'verdict']);
    expect(out[0]).toMatchObject({ runs: 2, credits: 27 });
    expect(out[0]!.cost.totalUsd).toBeCloseTo(0.9);
    expect(out[1]).toMatchObject({ runs: 2, credits: 4.5 });
  });
  it('labels modes in words and keeps unknown engine modes readable', () => {
    expect(modeLabel('keyword')).toBe('Write a page');
    expect(modeLabel('ai_pulse')).toBe('Ai pulse');
  });
  it('labels a money axis in cents when the scale is small', () => {
    expect(axisUsd(0)).toBe('$0');
    expect(axisUsd(0.25)).toBe('$0.25');
    expect(axisUsd(2.5)).toBe('$2.50');
    expect(axisUsd(250)).toBe('$250');
    expect(axisUsd(12000)).toBe('$12K');
  });
});

describe('running totals for the cost chart', () => {
  it('adds cost, revenue and runs day by day without float noise', () => {
    const out = cumulative([
      { date: '2026-10-01', claudeUsd: 0.1, dataforseoUsd: 0.2, revenueUsd: 0, runs: 1 },
      { date: '2026-10-02', claudeUsd: 0.2, dataforseoUsd: 0.1, revenueUsd: 49, runs: 2 },
    ]);
    expect(out[1]).toEqual({ date: '2026-10-02', claudeUsd: 0.3, dataforseoUsd: 0.3, revenueUsd: 49, runs: 3 });
    expect(cumulative([])).toEqual([]);
  });
});

describe('settings worked example', () => {
  it('matches the one credits formula of the server', () => {
    const s = { creditValueUsd: 0.1, markup: 3 };
    const ex = workedExample(0.8, s);
    expect(ex.credits).toBe(creditsFor(0.8, s));
    expect(ex.credits).toBe(24);
    expect(ex.listUsd).toBeCloseTo(2.4);
    expect(ex.marginUsd).toBeCloseTo(1.6);
    expect(ex.marginPct).toBeCloseTo(66.67, 1);
  });
  it('has no margin percentage for a free run', () => expect(workedExample(0, { creditValueUsd: 0.1, markup: 3 }).marginPct).toBeNull());
});

describe('activity rows', () => {
  it('turns action keys into words and details into short text', () => {
    expect(actionLabel('credits.granted')).toBe('Credits granted');
    expect(actionLabel('user.sessions_revoked')).toBe('User sessions revoked');
    expect(detailText({ a: 1 })).toBe('{"a":1}');
    expect(detailText(null)).toBe('–');
    expect(detailText(false)).toBe('false');
  });
});

describe('credit book lines (the admin Credits / USD switch)', () => {
  it('every line carries its credits and the dollars that mean something for it; margin = list value of the usage less its cost', () => {
    const lines = bookLines(book({ bought: 2000, boughtUsd: 100, free: 200, used: 300, remaining: 1900 }));
    const by = (l: string) => lines.find((x) => x.label === l)!;
    expect(by('Bought')).toMatchObject({ credits: 2000, usd: [{ label: 'paid', value: 100 }] });
    expect(by('Given free').usd[0]).toMatchObject({ label: 'list value', value: 10 });
    const used = by('Used').usd;
    expect(used.map((u) => u.label)).toEqual(['at list price', 'cost us', 'margin']);
    expect(used[0].value).toBeCloseTo(15, 6);
    expect(used[1].value).toBeCloseTo(5, 6);
    expect(used[2].value).toBeCloseTo(10, 6);
    expect(by('Remaining now').usd.map((u) => u.value)).toEqual([95, 95 / 3]);
    expect(creditOrUsd('credits', 1234.5, 61.73)).toBe('1,234.5 cr');
    expect(creditOrUsd('usd', 1234.5, 61.725)).toBe('$61.73');
  });
});
