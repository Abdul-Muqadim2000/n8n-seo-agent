import { describe, expect, it } from 'vitest';
import { CHANGE_TEST_METHOD, CHANGE_VERDICT_LABELS, changeTest, pageChangeTests, type PagePeriodPoint } from './change-test';

// G12 (2026-10-13, system review FIX_PLAN; criterion 3.4): a change is only ever read against a control group of the site's other
// pages, the verdicts are graded, and nothing claims a cause. These are the same rules as the engine's (_change_test.js, S56).
const CAUSAL = /\bcaused\b|\bbecause of\b|\bproves\b|\bguarantee/i;

describe('change test (G12)', () => {
  it('reads a page that beat the site\'s other pages as "likely helped", with the effect over the control group', () => {
    const r = changeTest({ weeks: 11, base: 35, now: 12, others: [1, 0.5, 1.2, -0.3, 0.8] });
    expect(r.verdict).toBe('likely_helped');
    expect(r.verdictLabel).toBe('Likely helped');
    expect(r.pageChange).toBe(23);
    expect(r.controlChange).toBe(0.8);
    expect(r.effect).toBe(22.2);
    expect(r.controlPages).toBe(5);
    expect(r.note).toContain('position 35 → 12');
  });

  it('reads a page with no impressions either side as "can\'t tell", never as "no effect"', () => {
    const r = changeTest({ weeks: 11, base: null, now: null, others: [] });
    expect(r.verdict).toBe('cant_tell');
    expect(r.note).toContain('no search impressions before or after the change');
    const own = changeTest({ weeks: 11, base: null, now: null, others: [], noData: 'no Search Console data for this website yet' });
    expect(own.note).toBe('no Search Console data for this website yet');
  });

  it('reads a page that moved no more than the rest of the site as "no clear effect yet"', () => {
    const r = changeTest({ weeks: 11, base: 20, now: 19.4, others: [1, 0.7, 1.1, 0.9] });
    expect(r.verdict).toBe('no_effect_yet');
    expect(r.verdictLabel).toBe('No clear effect yet');
  });

  it('claims nothing before six weeks, however big the move', () => {
    const r = changeTest({ weeks: 3, base: 35, now: 12, others: [1, 1, 1, 1] });
    expect(r.verdict).toBe('too_early');
    expect(r.pageChange).toBe(0);
    expect(r.note).toContain('read at 6, 10 and 16 weeks after the change');
  });

  it('can only say "possibly" with fewer than three other pages to compare with, and says why', () => {
    const r = changeTest({ weeks: 11, base: 35, now: 12, others: [1, 0.5] });
    expect(r.verdict).toBe('possibly_helped');
    expect(r.note).toContain('few other pages to compare with');
  });

  it('shares the credit when something else changed on the same page inside four weeks', () => {
    const r = changeTest({ weeks: 11, base: 35, now: 12, others: [1, 0.5, 1.2, -0.3, 0.8], joint: 1 });
    expect(r.verdict).toBe('possibly_helped');
    expect(r.note).toContain('credit shared');
  });

  it('keeps every verdict graded and never claims a cause', () => {
    expect(Object.values(CHANGE_VERDICT_LABELS)).toEqual(['Likely helped', 'Possibly helped', 'No clear effect yet', 'Too early to tell', 'Can’t tell']);
    for (const l of Object.values(CHANGE_VERDICT_LABELS)) expect(CAUSAL.test(l)).toBe(false);
    expect(CAUSAL.test(CHANGE_TEST_METHOD)).toBe(false);
    expect(CHANGE_TEST_METHOD).toContain('never proof of cause');
    expect(CHANGE_TEST_METHOD).toContain('control group');
  });
});

describe('page changes over the stored Search Console periods', () => {
  const P = (periodEnd: string, page: string, query: string, position: number, impressions = 100): PagePeriodPoint => ({ periodEnd, page, query, position, impressions, clicks: 5 });
  const points: PagePeriodPoint[] = [
    P('2026-07-20', 'https://x.ae/guide/', 'peppol uae', 35),
    P('2026-07-20', 'https://x.ae/a/', 'a', 30),
    P('2026-07-20', 'https://x.ae/b/', 'b', 20),
    P('2026-07-20', 'https://x.ae/c/', 'c', 25),
    P('2026-10-10', 'https://x.ae/guide/', 'peppol uae', 12),
    P('2026-10-10', 'https://x.ae/a/', 'a', 29),
    P('2026-10-10', 'https://x.ae/b/', 'b', 19),
    P('2026-10-10', 'https://x.ae/c/', 'c', 24),
  ];
  const now = new Date('2026-10-13T00:00:00Z');

  it('reads a page published before the first stored period against the site\'s other pages', () => {
    const [r] = pageChangeTests({ points, changes: [{ url: 'https://x.ae/guide/', t0: '2026-07-25', change: 'published', keyword: 'peppol uae' }], now });
    expect(r!.verdict).toBe('likely_helped');
    expect(r!.basePosition).toBe(35);
    expect(r!.position).toBe(12);
    expect(r!.controlChange).toBe(1);
    expect(r!.change).toBe('published');
    expect(r!.keyword).toBe('peppol uae');
  });

  it('says "can\'t tell" for a published page Search Console never reported, and "too early" for one published days ago', () => {
    const rows = pageChangeTests({
      points,
      changes: [
        { url: 'https://x.ae/nothing-yet/', t0: '2026-07-25', change: 'published' },
        { url: 'https://x.ae/brand-new/', t0: '2026-10-09', change: 'published' },
      ],
      now,
    });
    expect(rows.find((r) => r.url.includes('nothing-yet'))!.verdict).toBe('cant_tell');
    expect(rows.find((r) => r.url.includes('brand-new'))!.verdict).toBe('too_early');
  });

  it('keeps the newest change per page and reports nothing without a stored period before it', () => {
    const rows = pageChangeTests({
      points,
      changes: [
        { url: 'https://x.ae/guide/', t0: '2026-07-25', change: 'published' },
        { url: 'https://x.ae/guide/', t0: '2026-07-30', change: 'rewritten' },
      ],
      now,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.change).toBe('rewritten');
    const none = pageChangeTests({ points: [], changes: [{ url: 'https://x.ae/guide/', t0: '2026-07-25', change: 'published' }], now });
    expect(none[0]!.verdict).toBe('cant_tell');
    expect(none[0]!.note).toContain('no Search Console data for this website yet');
  });
});
