import { describe, expect, it } from 'vitest';
import type { ContentLogRow, LadderRow } from '@seo/shared';
import { failedPageRequests, failedPageRow, ladderSummaries, waitingPages, writtenPages } from '../src/services/pipeline';
import { failedPageFilters, failedPageReason } from '../src/services/runs';

const log = (o: Partial<ContentLogRow>) => ({ keyword: '', status: 'started', started_at: '2026-10-01T10:00:00Z', published_url: '', request_id: '', source: 'app', ...o }) as ContentLogRow;
const lad = (o: Partial<LadderRow>) => ({ ladder_id: 'l1', head_keyword: 'e invoicing', keyword: '', status: 'planned', rung: 1, page_no: 1, page_type: 'Service Page', target_url: '', ...o }) as LadderRow;
const NOW = Date.parse('2026-10-03T12:00:00Z');

describe('pipeline: pages already written', () => {
  it('one entry per keyword; a published page with its address wins over a newer draft', () => {
    const w = writtenPages(
      [
        log({ keyword: 'Peppol UAE', status: 'published', started_at: '2026-08-01T10:00:00Z', published_url: 'https://techand.ai/peppol' }),
        log({ keyword: 'peppol uae', status: 'started', started_at: '2026-10-02T10:00:00Z' }),
        log({ keyword: 'vat rules', request_id: 'cad_2026-09-29_techand-ai_1' }),
      ],
      [],
      NOW,
    );
    expect(w.map((x) => [x.keyword, x.status, x.source])).toEqual([
      ['vat rules', 'started', 'cadence'],
      ['Peppol UAE', 'published', 'app'],
    ]);
  });

  it('old unpublished drafts drop out after 180 days; published pages stay', () => {
    const w = writtenPages([log({ keyword: 'old draft', started_at: '2026-01-01T00:00:00Z' }), log({ keyword: 'old page', status: 'published', started_at: '2025-01-01T00:00:00Z', published_url: 'https://x.com/a' })], [], NOW);
    expect(w.map((x) => x.keyword)).toEqual(['old page']);
  });

  it('ladder pages being written or published count, the content log\'s date wins', () => {
    const w = writtenPages([log({ keyword: 'rung two' })], [lad({ keyword: 'rung two', status: 'writing' }), lad({ keyword: 'rung three', status: 'published', target_url: 'https://x.com/r3' }), lad({ keyword: 'rung four' })], NOW);
    expect(w.map((x) => [x.keyword, x.status, x.startedAt !== ''])).toEqual([
      ['rung two', 'started', true],
      ['rung three', 'published', false],
    ]);
  });
});

describe('W05-B (2026-10-30): a keyword held for the client\'s OK wrote nothing', () => {
  // the AFTER run: K3 was held (row `held`), the client chose "Write it anyway", and the form then warned that a page "was already written"
  // and listed the keyword twice among the pages waiting to be published
  const HELD = log({ keyword: 'business central vs netsuite', status: 'held', request_id: '358', started_at: '2026-10-02T22:31:00Z' });
  const WRITTEN = log({ keyword: 'business central vs netsuite', status: 'written', request_id: '364', started_at: '2026-10-02T22:37:00Z' });
  it('a held keyword is not "a page already written"', () => {
    expect(writtenPages([HELD], [], NOW)).toEqual([]);
    expect(writtenPages([HELD, log({ keyword: 'vat rules', status: 'written' })], [], NOW).map((x) => x.keyword)).toEqual(['vat rules']);
  });
  it('a held keyword does not wait to be published', () => {
    expect(waitingPages([HELD], NOW)).toEqual([]);
  });
  it('a keyword written after its hold waits once, not twice', () => {
    const w = waitingPages([HELD, WRITTEN, log({ keyword: 'Business Central vs NetSuite', status: 'started', started_at: '2026-10-02T22:36:00Z' }), log({ keyword: 'vat rules', status: 'written' })], NOW);
    expect(w.map((x) => x.keyword)).toEqual(['vat rules', 'business central vs netsuite']);
  });
});

describe('W06-B (2026-10-30, WAVE05 3.2): a page run that failed wrote no page', () => {
  // K4 first try (n8n execution 379, request 378): the run failed, its opening row stayed `started`, and "Start it again" was told that a
  // page "was already written ... and is waiting to be published" and counted it among the waiting pages
  const K = 'dynamics 365 partner dubai';
  const FAILED_ROW = log({ keyword: K, status: 'failed', request_id: '378', started_at: '2026-10-02T09:42:00Z' });
  const STRANDED = log({ keyword: K, status: 'started', request_id: '378', started_at: '2026-10-02T09:42:00Z' });
  const failed = failedPageRequests([
    { mode: 'keyword', status: 'failed', requestId: '378' },
    { mode: 'keyword', status: 'completed', requestId: '390' },
    { mode: 'audit', status: 'failed', requestId: '377' },
  ]);
  it('collects the request ids of the failed page runs only', () => {
    expect([...failed]).toEqual(['378']);
    expect(failedPageRow(FAILED_ROW)).toBe(true);
    expect(failedPageRow(STRANDED, failed)).toBe(true);
    expect(failedPageRow(STRANDED)).toBe(false);
    expect(failedPageRow(log({ keyword: K, status: 'written', request_id: '378' }), failed)).toBe(false);
  });
  it('a failed row, or the started row of a failed run, is not "a page already written" and does not wait', () => {
    expect(writtenPages([FAILED_ROW], [], NOW)).toEqual([]);
    expect(writtenPages([STRANDED], [], NOW, failed)).toEqual([]);
    expect(waitingPages([FAILED_ROW], NOW)).toEqual([]);
    expect(waitingPages([STRANDED, log({ keyword: 'ms 365 erp', status: 'written' })], NOW, failed).map((x) => x.keyword)).toEqual(['ms 365 erp']);
  });
  it('the retry that is running, and a page written later, still count', () => {
    const retry = log({ keyword: K, status: 'started', request_id: '389', started_at: '2026-10-02T09:58:00Z' });
    expect(writtenPages([STRANDED, retry], [], NOW, failed).map((x) => [x.keyword, x.status])).toEqual([[K, 'started']]);
    const done = log({ keyword: K, status: 'written', request_id: '389', started_at: '2026-10-02T10:10:00Z' });
    expect(waitingPages([FAILED_ROW, done], NOW).map((x) => x.keyword)).toEqual([K]);
  });
  it('a ladder row the app moved to writing for the failed run is no page either, unless another row of the keyword is', () => {
    const L = lad({ keyword: K, status: 'writing' });
    expect(writtenPages([FAILED_ROW], [L], NOW)).toEqual([]);
    expect(writtenPages([STRANDED], [L], NOW, failed)).toEqual([]);
    expect(writtenPages([FAILED_ROW, log({ keyword: K, status: 'started', request_id: '389' })], [L], NOW).map((x) => x.keyword)).toEqual([K]);
    expect(writtenPages([], [L], NOW).map((x) => [x.keyword, x.status])).toEqual([[K, 'writing']]);
  });
  it('the app marks exactly the failed run\'s own started row, and only for a page run', () => {
    const run = { mode: 'keyword', requestId: '378', input: { keyword: K, receiveContent: true } } as Parameters<typeof failedPageFilters>[0];
    expect(failedPageFilters(run, 'example.com')?.map((f) => [f.columnName, f.value])).toEqual([
      ['site_id', 'site_example-com'],
      ['request_id', '378'],
      ['keyword', K],
      ['status', 'started'],
    ]);
    expect(failedPageFilters({ ...run, input: { keyword: K, receiveContent: false } } as typeof run, 'example.com')).toBeNull();
    expect(failedPageFilters({ ...run, mode: 'verdict' } as typeof run, 'example.com')).toBeNull();
    expect(failedPageFilters({ ...run, requestId: null } as typeof run, 'example.com')).toBeNull();
    expect(failedPageReason('The page could not be written in full.')).toBe('page run failed: The page could not be written in full.');
    expect(failedPageReason(null)).toMatch(/^page run failed: the run stopped before the page was written$/);
  });
});

describe('pipeline: ladders', () => {
  it('groups rows by ladder with the planned pages in order', () => {
    const l = ladderSummaries([lad({ keyword: 'b', rung: 2, page_no: 3 }), lad({ keyword: 'a', rung: 1, page_no: 1 }), lad({ keyword: 'c', status: 'published' }), lad({ ladder_id: 'l2', head_keyword: 'payroll', keyword: 'p' })]);
    expect(l.map((x) => [x.id, x.head, x.pages, x.published, x.planned.map((p) => p.keyword).join(',')])).toEqual([
      ['l1', 'e invoicing', 3, 1, 'a,b'],
      ['l2', 'payroll', 1, 0, 'p'],
    ]);
  });
});

describe('pipeline: ladder plans that planned nothing', () => {
  const rep = (id: string, head: string, ago: number, refused?: string, runId: string | null = `run-${id}`) => ({
    id,
    runId,
    stage: 'ladder_plan',
    summary: { head, ...(refused ? { refused } : { pages: 6 }) },
    receivedAt: new Date(NOW - ago * 3600_000).toISOString(),
  });
  it('the last 7 days, newest per keyword, with their reason; a later planned one clears it', async () => {
    const { refusedPlans } = await import('../src/services/pipeline');
    const items = refusedPlans(
      [
        rep('a', 'cleartax login', 2, 'not_realistic'),
        rep('b', 'E-invoicing in the UAE', 5, 'duplicate'),
        rep('c', 'odoo partner uae', 1),
        rep('d', 'odoo partner uae', 3, 'duplicate'),
        rep('e', 'old one', 24 * 8, 'duplicate'),
        { ...rep('f', 'vat software', 1), stage: 'content' },
      ],
      NOW,
    );
    expect(items.map((i) => [i.id, i.title, i.action?.runId])).toEqual([
      ['refused:a', '"cleartax login" was not planned', 'run-a'],
      ['refused:b', '"E-invoicing in the UAE" was not planned', 'run-b'],
    ]);
    expect(items[1].detail).toMatch(/already have a keyword ladder/);
    expect(items[0].detail).toMatch(/not realistic/);
  });
});
