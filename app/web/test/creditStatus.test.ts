import { describe, expect, it } from 'vitest';
import { DEFAULT_CREDIT_LIMITS, type BillingFeatureRow, type BillingOverview, type CreditLot } from '@seo/shared';
import { bannerKey, creditBanner, daysText, featureTotals, lotTerms, pausedByLimit, statusLabel, statusTone } from '@/pages/settings/_components/credits/status';

// The Credits tab, the sidebar pill and the banner read a company's credit standing through one set of words (status.ts), so the
// three never disagree, and a company whose credits are only counted is never told it is "out of credits".

type Standing = Parameters<typeof creditBanner>[0];
const month: BillingOverview['month'] = { month: '2026-10', autopilotUsed: 300, onDemandUsed: 40, autopilotForecast: 1500, planMonthly: null, planRenewsOn: null };
const base: Standing = { status: 'ok', enforced: true, runwayDays: 40, runsOutOn: '2026-11-28', limits: DEFAULT_CREDIT_LIMITS, month };

describe('credit standing words', () => {
  it('ok says nothing; low names how long the balance lasts', () => {
    expect(creditBanner(base)).toBeNull();
    const low = creditBanner({ ...base, status: 'low', runwayDays: 5.4 });
    expect(low?.tone).toBe('warning');
    expect(low?.body).toContain('about 5 days');
    expect(low?.body).toContain('28 Nov 2026');
  });

  it('critical and empty are critical banners', () => {
    expect(creditBanner({ ...base, status: 'critical', runwayDays: 0.4 })?.title).toBe('Credits run out in less than a day');
    expect(creditBanner({ ...base, status: 'empty', runwayDays: 0 })).toMatchObject({ tone: 'critical', title: 'You are out of credits' });
  });

  it('credits only counted: no low / empty banner, a neutral "Counted only" chip', () => {
    const counted = { ...base, enforced: false, status: 'empty' as const };
    expect(creditBanner(counted)).toBeNull();
    expect(statusLabel(counted)).toBe('Counted only');
    expect(statusTone(counted)).toBe('neutral');
  });

  it('a pause by the autopilot limit says so and when it resumes; a pause for credits says credits resume it', () => {
    const limited = { ...base, status: 'paused' as const, limits: { ...DEFAULT_CREDIT_LIMITS, autopilotMonthly: 300 } };
    expect(pausedByLimit(limited)).toBe(true);
    expect(statusLabel(limited)).toBe('Autopilot limit reached');
    expect(creditBanner(limited)?.body).toContain('on the 1st');
    const empty = { ...base, status: 'paused' as const, enforced: false };
    expect(pausedByLimit(empty)).toBe(false);
    expect(creditBanner(empty)?.body).toContain('when credits are added');
    expect(statusTone(empty)).toBe('critical');
  });

  it('days and dismissal keys', () => {
    expect(daysText(1.2)).toBe('about a day');
    expect(daysText(12.9)).toBe('about 12 days');
    expect(bannerKey('o1', 'low')).not.toBe(bannerKey('o1', 'critical'));
  });
});

describe('usage by feature and lot terms', () => {
  it('one row per feature, autopilot and on-demand apart, biggest first', () => {
    const rows: BillingFeatureRow[] = [
      { key: 'autopilot:AI visibility', label: 'AI visibility', origin: 'autopilot', credits: 120, runs: 4 },
      { key: 'on_demand:AI visibility', label: 'AI visibility', origin: 'on_demand', credits: 30, runs: 1 },
      { key: 'on_demand:Written page', label: 'Written page', origin: 'on_demand', credits: 90, runs: 2 },
      { key: 'on_demand:Keyword check', label: 'Keyword check', origin: 'on_demand', credits: 0, runs: 0 },
    ];
    expect(featureTotals(rows)).toEqual([
      { label: 'AI visibility', autopilot: 120, onDemand: 30, total: 150, runs: 5 },
      { label: 'Written page', autopilot: 0, onDemand: 90, total: 90, runs: 2 },
    ]);
  });

  it('pack months and plan rollover come from the lots themselves', () => {
    const lot = (source: CreditLot['source'], createdAt: string, expiresAt: string | null): CreditLot => ({ id: source, source, credits: 100, remaining: 100, createdAt, expiresAt, note: '' });
    expect(lotTerms([])).toEqual({ packMonths: null, planRolloverMonths: null });
    expect(lotTerms([lot('pack', '2026-10-05T10:00:00Z', '2027-10-05T10:00:00Z'), lot('plan', '2026-10-01T00:00:00Z', '2026-11-30T23:59:59Z')])).toEqual({ packMonths: 12, planRolloverMonths: 1 });
  });
});
