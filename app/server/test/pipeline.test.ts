import { describe, expect, it } from 'vitest';
import type { ContentLogRow, LadderRow } from '@seo/shared';
import { ladderSummaries, writtenPages } from '../src/services/pipeline';

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

  it('ladder pages being written or published count, the content log’s date wins', () => {
    const w = writtenPages([log({ keyword: 'rung two' })], [lad({ keyword: 'rung two', status: 'writing' }), lad({ keyword: 'rung three', status: 'published', target_url: 'https://x.com/r3' }), lad({ keyword: 'rung four' })], NOW);
    expect(w.map((x) => [x.keyword, x.status, x.startedAt !== ''])).toEqual([
      ['rung two', 'started', true],
      ['rung three', 'published', false],
    ]);
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
      ['refused:a', '“cleartax login” was not planned', 'run-a'],
      ['refused:b', '“E-invoicing in the UAE” was not planned', 'run-b'],
    ]);
    expect(items[1].detail).toMatch(/already have a keyword ladder/);
    expect(items[0].detail).toMatch(/not realistic/);
  });
});
