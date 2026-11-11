import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexPageOf, type AuditPoint, type Finding, type IndexingData } from '@seo/shared';

// Client report 2026-11-11: the technical page's "not indexed by Google" finding reads the daily index check (services/technicalLive.ts).
// The reads are mocked: no Data Table and no database is touched here.

const indexPageRows = vi.fn();
const indexingData = vi.fn();
const dbRows = vi.fn();
vi.mock('../src/services/indexing', () => ({ indexPageRows: (...a: unknown[]) => indexPageRows(...a), indexingData: (...a: unknown[]) => indexingData(...a) }));
vi.mock('../src/db', () => {
  const chain = { select: () => chain, from: () => chain, where: () => chain, orderBy: () => chain, limit: () => dbRows() };
  return { db: chain, schema: { reports: { payload: 'payload', orgId: 'org_id', siteId: 'site_id', stage: 'stage', receivedAt: 'received_at' } } };
});

const { inspectedPagesOf, liveTechnical } = await import('../src/services/technicalLive');

const W = 'https://northwind-erp.com';
const site = { domain: 'northwind-erp.com', id: '00000000-0000-0000-0000-000000000001', orgId: '00000000-0000-0000-0000-000000000002' };
const audit = (id: string, at: string): AuditPoint => ({ auditId: id, auditedAt: at, reportType: 'site_audit', healthScore: 90, grade: 'Good', pagesCrawled: 30, findings: 2, critical: 0, high: 1, medium: 0, low: 1, scheduled: false });
const f = (title: string, over: Partial<Finding> = {}): Finding => ({ key: `Crawlability & Indexing|${title.toLowerCase()}`, category: 'Crawlability & Indexing', severity: 'High', title, affectedCount: 2, previousCount: 3, status: 'open', impact: 10, impactBasis: 'Google has not indexed these pages', recheck: null, ...over });
const totals = { status: 'ok', checkedAt: '2026-11-11T10:15:00Z', totals: { indexed: 3, shouldBe: 4, known: 5, unknown: 0 }, lanes: { new: { shouldBe: 0, indexed: 0 } } } as unknown as IndexingData;

afterEach(() => {
  indexPageRows.mockReset();
  indexingData.mockReset();
  dbRows.mockReset();
});

describe('the live "not indexed by Google" finding', () => {
  it('reads the audit\'s inspected pages from its report defensively', () => {
    expect(inspectedPagesOf([{ url: `${W}/a`, indexed: false, coverage: 'URL is unknown to Google' }, { url: 'nope' }, null, { url: `${W}/b`, indexed: true }])).toEqual([
      { url: `${W}/a`, indexed: false, coverage: 'URL is unknown to Google' },
      { url: `${W}/b`, indexed: true, coverage: '' },
    ]);
    expect(inspectedPagesOf(undefined)).toEqual([]);
    expect(inspectedPagesOf('not json')).toEqual([]);
  });

  it('puts the daily index check on the newest audit\'s finding only, and leaves every other finding alone', async () => {
    indexPageRows.mockResolvedValue([
      { url: `${W}/a`, state: 'indexed', inspect_at: '2026-11-10T10:15:00Z', asked_google_at: '2026-11-02T08:00:00Z', google_read_after_ask_at: '2026-11-03T08:00:00Z' },
      { url: `${W}/b`, state: 'not_indexed', cause: 'unknown_to_google', action: 'wait', inspect_at: '2026-11-11T10:15:00Z' },
    ]);
    indexingData.mockResolvedValue(totals);
    dbRows.mockResolvedValue([{ pages: [{ url: `${W}/`, indexed: true }, { url: `${W}/a`, indexed: false, coverage: 'URL is unknown to Google' }, { url: `${W}/b`, indexed: false, coverage: 'URL is unknown to Google' }] }]);
    const sel = audit('aud_2', '2026-10-28T10:29:01Z');
    const findings = [f('A large share of important pages is not indexed by Google'), f('Indexable pages missing from the sitemap', { severity: 'Low' })];
    const r = await liveTechnical(site, sel, 'aud_2', findings, [{ key: findings[0].key, checked: 3, sampleUrls: [] }]);
    expect(r.findings[0].live?.state).toBe('improving');
    expect(r.findings[0].live?.now).toMatchObject({ indexed: 1, notIndexed: 1 });
    expect(r.findings[0].live?.asked).toMatchObject({ pages: 1, inGoogle: 1 });
    expect(r.findings[1].live).toBeUndefined();
    expect(r.indexPages.map((p) => p.url)).toEqual([`${W}/a`, `${W}/b`]);
    // an older audit is history: it keeps its own reading (the pages are still read for the watch tile)
    const old = await liveTechnical(site, audit('aud_1', '2026-10-26T12:18:05Z'), 'aud_2', findings, []);
    expect(old.findings[0].live).toBeUndefined();
    expect(indexingData).toHaveBeenCalledTimes(1);
  });

  it('a failed read keeps the audit\'s finding as it was (never throws)', async () => {
    indexPageRows.mockRejectedValue(new Error('n8n down'));
    indexingData.mockRejectedValue(new Error('n8n down'));
    dbRows.mockRejectedValue(new Error('db down'));
    const findings = [f('A large share of important pages is not indexed by Google')];
    const r = await liveTechnical(site, audit('aud_2', '2026-10-28T10:29:01Z'), 'aud_2', findings, [], { warn: () => {} });
    expect(r.findings[0].live).toBeUndefined();
    expect(r.indexPages).toEqual([]);
  });

  it('the unread-on-purpose states stay honest: a row Google never answered is not "in Google"', () => {
    expect(indexPageOf({ url: `${W}/x`, state: 'unknown' }).state).toBe('unknown');
  });
});
