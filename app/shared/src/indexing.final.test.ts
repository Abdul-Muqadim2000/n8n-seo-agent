import { describe, expect, it } from 'vitest';
import { buildIndexingData, indexDayText, indexingCauseReadings } from './indexing';
import { deriveSiteTasks, type SiteTaskInputs } from './site-tasks';
import type { IndexPageRow } from './tables';

// Index coverage, final browser check (2026-10-30, n8n/seo-agent/docs/indexing-2026-10-29/APP_BUILD.md "Final browser check"): the
// wording the screenshots showed wrong. Every case fails on feature/indexing 97422c3c.

const D = 'example.com';
const U = (p: string) => `https://${D}${p}`;
const S = { on: true, dailyCap: 300 };
const row = (url: string, o: Partial<IndexPageRow> = {}): Partial<IndexPageRow> => ({ site_id: 'site_example-com', domain: D, url: U(url), lane: 'existing', state: 'not_indexed', in_sitemap: true, inspect_at: '2026-10-27T06:00:00Z', ...o });
const good = { run_at: '2026-10-28T07:00:00.000Z', known: 3, inspected: 3 };
const inputs = (rows: Partial<IndexPageRow>[]): SiteTaskInputs => ({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt: good.run_at, causes: indexingCauseReadings(rows) } });

describe('final browser check: days in words', () => {
  it('indexDayText: "29 Oct", with the time "29 Oct, 08:40 UTC", in UTC whatever the clock', () => {
    expect(indexDayText('2026-10-29T08:40:00.000Z')).toBe('29 Oct');
    expect(indexDayText('2026-10-29T08:40:00.000Z', true)).toBe('29 Oct, 08:40 UTC');
    expect(indexDayText('2026-10-31T23:30:00-02:00')).toBe('1 Nov');
    expect(indexDayText('')).toBe('an earlier day');
  });
  it('the notices of a run that did not read the website and of a check not finished name the day, never an ISO date', () => {
    const rows = [row('/a', { cause: 'noindex', action: 'site_fix' })];
    const failed = buildIndexingData({ rows, runs: [{ run_at: '2026-10-29T09:15:00Z', known: 3, sitemaps_json: JSON.stringify({ checked: false }), note: 'Search Console did not answer.' }, good], events: [], impacts: [], settings: S });
    expect(failed.notice?.text).toContain('The figures below are from the check of 28 Oct.');
    const unfinished = buildIndexingData({ rows, runs: [{ run_at: '2026-10-29T08:40:00Z', sitemaps_json: JSON.stringify({ reservation: true }) }, good], events: [], impacts: [], settings: S });
    expect(unfinished.notice?.text).toBe('The check that started 29 Oct, 08:40 UTC had not finished when this page was read, so the figures are from the check before.');
    expect(`${failed.notice?.text} ${unfinished.notice?.text}`).not.toMatch(/\d{4}-\d\d-\d\d/);
  });
});

describe('final browser check: the steps in plain sentences', () => {
  it('two pages fixed on the site: "both pages", never "all 2 pages"', () => {
    const rows = ['/a', '/b'].map((u) => row(u, { cause: 'not_found', action: 'wait', fix_seen_at: '2026-10-28T05:00:00Z' }));
    const t = deriveSiteTasks(inputs(rows), []).find((x) => x.key === 'indexing:not_found')!;
    expect(t.lastCheck?.message).toContain('we saw the change on both pages');
    expect(t.lastCheck?.message).not.toContain('all 2');
  });
  it('the count is a sentence ("It concerns 3 pages."), not a fragment after "what you do"', () => {
    const rows = ['/a', '/b', '/c'].map((u) => row(u, { cause: 'noindex', action: 'site_fix' }));
    const t = deriveSiteTasks(inputs(rows), []).find((x) => x.key === 'indexing:noindex')!;
    expect(t.detail).toContain('It concerns 3 pages.');
    expect(t.detail).not.toMatch(/\. 3 pages\./);
    const one = deriveSiteTasks(inputs([row('/a', { cause: 'noindex', action: 'site_fix' })]), []).find((x) => x.key === 'indexing:noindex')!;
    expect(one.detail).toContain('It concerns 1 page.');
  });
});
