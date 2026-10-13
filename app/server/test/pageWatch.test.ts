import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuditFindingRow, PageWatchRow } from '@seo/shared';

// G11 + G25 (2026-10-13, system review FIX_PLAN.md): the daily key-page watch as the technical page reads it, and the "I fixed this"
// request that asks the engine to judge one finding again within a day instead of at the next monthly audit.
// The n8n client is mocked: no Data Table is touched here (requestRecheck is the only call in the app that writes to seo_audit_findings).

const rows = vi.fn();
const updateRows = vi.fn();
vi.mock('../src/n8n/client', () => ({ rows: (...a: unknown[]) => rows(...a), updateRows: (...a: unknown[]) => updateRows(...a) }));

const { indexCoverage, nextWatchMessage, recheckOf, requestRecheck, watchView, WATCH_STALE_DAYS } = await import('../src/services/pageWatch');

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 864e5).toISOString();
const W = 'https://www.northwind-erp.com';
const watchRow = (over: Partial<PageWatchRow>): PageWatchRow =>
  ({
    id: 1, createdAt: iso(10), updatedAt: iso(0),
    site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', url: `${W}/`, kind: 'home', weight: 100, checked_at: iso(0),
    status: 200, location: '', noindex: false, noindex_source: '', canonical: `${W}/`, canonical_ok: true,
    title: 'Northwind ERP', title_hash: 'abcd1234', titles: 1, description: 'ERP for the UAE', h1: 'Northwind ERP', h1s: 1,
    robots_blocked: false, robots_hash: 'ffff0000', state: 'ok', changes: '', last_change_at: '', changed_count: 0, error: '',
    inspect_at: '', index_state: '', indexed: '', coverage: '', google_canonical: '', last_crawl: '', mobile: '', rich_results: '', inspect_error: '',
    ...over,
  }) as PageWatchRow;

afterEach(() => {
  rows.mockReset();
  updateRows.mockReset();
});

describe('the daily key-page watch on the technical page', () => {
  it('says what it watches, when it last ran and what changed in the last week', () => {
    const v = watchView([
      watchRow({}),
      watchRow({ url: `${W}/erp-pricing/`, kind: 'nav', noindex: true, state: 'changed', changes: 'noindex_added', last_change_at: iso(1), changed_count: 1 }),
      watchRow({ url: `${W}/about/`, kind: 'page', state: 'changed', changes: 'title_changed', last_change_at: iso(20), changed_count: 3 }),
    ])!;
    expect(v.running).toBe(true);
    expect(v.pagesWatched).toBe(3);
    expect(v.changedLast7Days).toBe(1);
    expect(v.changes[0]).toEqual({ url: `${W}/erp-pricing/`, changes: ['noindex_added'], at: expect.any(String) });
    // a change older than a week is not "this week" any more, but the page is still watched
    expect(v.pages.some((p) => p.url === `${W}/about/` && p.changes[0] === 'title_changed')).toBe(true);
  });

  it('reports the watch as not running when no row was refreshed in the last two days, instead of implying the pages are fine', () => {
    const v = watchView([watchRow({ checked_at: iso(WATCH_STALE_DAYS + 1) })])!;
    expect(v.running).toBe(false);
    expect(v.lastCheckedAt).not.toBe('');
    expect(watchView([])).toBeNull();
  });

  it('G25: counts the pages Google answered about apart from the ones nobody asked about, and never calls an uninspected page indexed', () => {
    const c = indexCoverage([
      watchRow({ inspect_at: iso(2), indexed: 'yes', index_state: 'PASS', coverage: 'Submitted and indexed', google_canonical: `${W}/`, mobile: 'pass' }),
      watchRow({ url: `${W}/about/`, inspect_at: iso(3), indexed: 'no', index_state: 'NEUTRAL', coverage: 'Crawled - currently not indexed' }),
      watchRow({ url: `${W}/erp-pricing/`, inspect_at: iso(4), indexed: 'yes', index_state: 'PASS', google_canonical: `${W}/en/erp-pricing/`, mobile: 'fail' }),
      watchRow({ url: `${W}/case-studies/x/`, inspect_at: '', indexed: '', inspect_error: '' }),
    ])!;
    expect(c).toMatchObject({ checked: 3, indexed: 2, notIndexed: 1, notChecked: 1, canonicalMismatch: 1, mobileBad: 1, quota: 2000 });
    expect(c.text).toContain('2 of 3 key pages are in Google');
    expect(c.text).toContain('1 not checked yet');
    expect(c.text).toContain('2,000 inspections a day');
    // nothing inspected at all: the sentence says so instead of claiming an index state
    const none = indexCoverage([watchRow({ indexed: '' })])!;
    expect(none.checked).toBe(0);
    expect(none.text).toContain('Nothing is claimed');
  });

  it('reads the Google view of one page without inventing one (empty answers stay empty)', () => {
    const v = watchView([watchRow({ indexed: '', mobile: '', rich_results: '', inspect_error: 'Search Console access is missing for this property: not checked.' })])!;
    expect(v.pages[0].indexed).toBeNull();
    expect(v.pages[0].mobile).toBe('');
    expect(v.pages[0].richResults).toEqual([]);
    expect(v.pages[0].inspectError).toContain('not checked');
  });
});

describe('"I fixed this" (G11, criterion 1.10)', () => {
  const finding = (over: Partial<AuditFindingRow> = {}): AuditFindingRow =>
    ({ id: 1, createdAt: iso(1), updatedAt: iso(1), site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', audit_id: 'aud_1',
      audited_at: iso(1), finding_key: 'On-Page|missing meta description', category: 'On-Page', severity: 'Medium', title: 'Missing meta description',
      affected_count: 4, ...over }) as AuditFindingRow;

  it('marks the finding for the next daily watch and says when that is — the audit is not waited for', async () => {
    rows.mockResolvedValue([finding()]);
    updateRows.mockResolvedValue(true);
    const r = await requestRecheck('northwind-erp.com', 'aud_1', 'On-Page|missing meta description');
    expect(r.state).toBe('requested');
    expect(r.message).toContain('daily key-page watch');
    expect(r.message).toContain('does not wait for the next monthly audit');
    // exactly one row is touched: this website, this audit, this finding
    const [table, filters, data] = updateRows.mock.calls[0];
    expect(table).toBe('auditFindings');
    expect(filters).toEqual([
      { columnName: 'domain', condition: 'eq', value: 'northwind-erp.com' },
      { columnName: 'audit_id', condition: 'eq', value: 'aud_1' },
      { columnName: 'finding_key', condition: 'eq', value: 'On-Page|missing meta description' },
    ]);
    expect(data).toEqual({ recheck_state: 'requested', recheck_requested_at: r.requestedAt, recheck_at: '', recheck_rule: '', recheck_note: '' });
  });

  it('refuses a finding that is not stored for that audit any more, and writes nothing', async () => {
    rows.mockResolvedValue([]);
    await expect(requestRecheck('northwind-erp.com', 'aud_1', 'On-Page|gone')).rejects.toMatchObject({ statusCode: 404 });
    expect(updateRows).not.toHaveBeenCalled();
  });

  it('refuses an empty or oversized key without asking n8n anything', async () => {
    await expect(requestRecheck('northwind-erp.com', 'aud_1', '  ')).rejects.toMatchObject({ statusCode: 400 });
    await expect(requestRecheck('northwind-erp.com', '', 'On-Page|x')).rejects.toMatchObject({ statusCode: 400 });
    await expect(requestRecheck('northwind-erp.com', 'aud_1', 'x'.repeat(301))).rejects.toMatchObject({ statusCode: 400 });
    expect(rows).not.toHaveBeenCalled();
    expect(updateRows).not.toHaveBeenCalled();
  });

  it('shows the outcome the engine wrote back, and nothing when nobody asked', () => {
    expect(recheckOf(finding())).toBeNull();
    expect(recheckOf(finding({ recheck_state: 'requested', recheck_requested_at: iso(0) }))).toMatchObject({ state: 'requested' });
    expect(
      recheckOf(finding({ recheck_state: 'fixed', recheck_requested_at: iso(1), recheck_at: iso(0), recheck_rule: 'missing_description', recheck_note: 'Fixed on the 5 key pages checked (no key page with no meta description left).' })),
    ).toMatchObject({ state: 'fixed', rule: 'missing_description', note: expect.stringContaining('5 key pages') });
    expect(recheckOf(finding({ recheck_state: 'still_open', recheck_note: 'Still open on 1 of the 5 key pages checked' }))).toMatchObject({ state: 'still_open' });
    expect(recheckOf(finding({ recheck_state: 'not_checked', recheck_note: 'The daily key-page watch cannot judge this one on its own.' }))).toMatchObject({ state: 'not_checked' });
    // an unknown value is never shown as a state of its own
    expect(recheckOf(finding({ recheck_state: 'something-else' }))).toBeNull();
  });

  it('names the next watch in hours, whichever side of 05:45 UTC the request lands on', () => {
    expect(nextWatchMessage(new Date('2026-10-13T04:45:00Z'))).toContain('about 1 hour');
    expect(nextWatchMessage(new Date('2026-10-13T06:45:00Z'))).toContain('about 23 hours');
  });
});
