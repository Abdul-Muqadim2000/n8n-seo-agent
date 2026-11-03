import { describe, expect, it, vi } from 'vitest';

// Prod 2026-11-03 (devaicon.com): the content log rows behind the Content page. A keyword started again got a second opening row and the
// engine (upsert by website + keyword) wrote its page into both, so the page was listed twice; a run whose verdict advised against the page
// ("privacy policy", AVOID) wrote no page and its opening row said `started` for days, listed as a page waiting to be published.

vi.hoisted(() => {
  process.env.N8N_BASE_URL = 'http://n8n.test';
  process.env.N8N_API_KEY = 'test-only';
  process.env.LOG_LEVEL = 'silent';
  process.env.SITE_TASK_JOBS = 'false';
  process.env.LINK_BUILDER_JOBS = 'false';
  process.env.ADMIN_COST_SYNC = 'false';
  process.env.MAILBOX_KEY = 'b'.repeat(64);
});
vi.mock('../src/db', () => ({ db: {}, schema: new Proxy({}, { get: () => new Proxy({}, { get: (_t, k) => String(k) }) }) }));

const { failedPageFilters, pageRowFor, reopenedRow, unwrittenPageReason } = await import('../src/services/runs');
const { writtenPageRows } = await import('../src/services/data');

const row = (keyword: string, status: string, started_at: string, extra: Record<string, unknown> = {}) =>
  ({ site_id: 'site_devaicon-com', domain: 'devaicon.com', keyword, status, started_at, request_id: '1', ...extra }) as never;

describe('one row per page', () => {
  it('a page run of a keyword reuses that keyword row, newest first, spelled or cased differently', () => {
    const rows = [row('banking & financial services technology', 'failed', '2026-11-02T13:37:43Z'), row('privacy policy', 'started', '2026-10-30T09:27:00Z')];
    expect(pageRowFor(rows, 'Banking & Financial Services Technology')?.started_at).toBe('2026-11-02T13:37:43Z');
    expect(pageRowFor(rows, 'cloud migration')).toBeNull();
  });

  it('a row with no page becomes the new run\'s opening row; a page that exists only takes the new request id', () => {
    const opening = { request_id: '7001', status: 'started', started_at: '2026-11-03T10:00:00Z', qa_reasons: '' };
    for (const status of ['failed', 'started', 'held', '']) expect(reopenedRow({ status, published_url: '' } as never, opening)).toEqual(opening);
    for (const status of ['written', 'not_ready', 'published']) expect(reopenedRow({ status, published_url: '' } as never, opening)).toEqual({ request_id: '7001' });
    // a live page whose row someone left `started` still keeps its state
    expect(reopenedRow({ status: 'started', published_url: 'https://devaicon.com/industries/bfsi' } as never, opening)).toEqual({ request_id: '7001' });
  });

  it('a rewrite of a live page that then fails or writes nothing never marks the page failed', () => {
    // the reopened row keeps `published`; the failure and no-page paths only close a `started` row of their own request id
    const kept = { status: 'published', published_url: 'https://devaicon.com/x', ...reopenedRow({ status: 'published', published_url: 'https://devaicon.com/x' } as never, { request_id: '7002', status: 'started' }) };
    expect(failedPageFilters({ mode: 'keyword', requestId: '7002', input: { keyword: 'x', receiveContent: true } } as never, 'devaicon.com')).toContainEqual({ columnName: 'status', condition: 'eq', value: 'started' });
    expect(kept.status).toBe('published');
  });

  it('the Content page lists a keyword once and never a row that stands for no page', () => {
    const log = [
      row('banking & financial services technology', 'not_ready', '2026-11-02T17:11:24Z', { request_id: '6661' }),
      row('banking & financial services technology', 'not_ready', '2026-11-02T17:11:20Z', { request_id: '6661' }),
      row('privacy policy', 'failed', '2026-10-30T09:27:00Z'),
      row('strategic consulting & transformation', 'published', '2026-11-02T11:39:00Z'),
    ];
    const out = writtenPageRows(log) as unknown as { keyword: string; started_at: string }[];
    expect(out.map((r) => r.keyword)).toEqual(['banking & financial services technology', 'strategic consulting & transformation']);
    expect(out[0]!.started_at).toBe('2026-11-02T17:11:24Z');
  });
});

describe('a page run that finished without a page', () => {
  const run = { mode: 'keyword' } as never;
  it('closes its row when the verdict advised against the page (the privacy policy report)', () => {
    expect(unwrittenPageReason(run, 'content', { verdict: 'AVOID', markdown: null, html: '' }, false)).toMatch(/advised against/);
    expect(unwrittenPageReason(run, 'content', { verdict: 'GO' }, false)).toMatch(/without a page/);
  });
  it('leaves a written page, a hold and other modes alone', () => {
    expect(unwrittenPageReason(run, 'content', { markdown: '# Banking\n\n' + 'x'.repeat(200) }, false)).toBeNull();
    expect(unwrittenPageReason(run, 'content', { verdict: 'AVOID' }, true)).toBeNull();
    expect(unwrittenPageReason({ mode: 'verdict' } as never, 'content', { verdict: 'AVOID' }, false)).toBeNull();
    expect(unwrittenPageReason(run, 'progress', {}, false)).toBeNull();
  });
});
