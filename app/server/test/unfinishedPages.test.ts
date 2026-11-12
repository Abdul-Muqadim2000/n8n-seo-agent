import { describe, expect, it } from 'vitest';
import { PAGE_IN_FLIGHT_HOURS, type ContentLogRow } from '@seo/shared';
import { CADENCE } from '../src/services/cadence';
import { runOutcome } from '../src/services/comingUp';
import { noPageRow, unfinishedPageRow } from '../src/services/ladders';
import { waitingPages, writtenPages } from '../src/services/pipeline';

// S1-05 (prod review 2026-11-12): three cadence page runs cancelled at their time limit left their content-log rows at `started`; the
// Pipeline counted them as "3 pages to publish" and the pile-up warning made the client override it. Only a written page waits; a
// `started` row older than PAGE_IN_FLIGHT_HOURS did not finish.

const NOW = Date.parse('2026-11-12T14:00:00Z');
const H = 3600_000;
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * H).toISOString();
const log = (o: Partial<ContentLogRow>) => ({ keyword: '', status: 'started', started_at: at(1), published_url: '', request_id: '', source: 'cadence', ...o }) as ContentLogRow;

describe('a page run that never finished is no page', () => {
  it('8 hours, the same figure as the engine (a writing slot, then the run)', () => {
    expect(PAGE_IN_FLIGHT_HOURS).toBe(8);
    expect(CADENCE.inFlightHours).toBe(PAGE_IN_FLIGHT_HOURS);
  });

  it('a `started` row older than 8 hours did not finish; a younger one is still being written', () => {
    expect(unfinishedPageRow(log({ started_at: at(12) }), NOW)).toBe(true);
    expect(unfinishedPageRow(log({ started_at: at(8) }), NOW)).toBe(true);
    expect(unfinishedPageRow(log({ started_at: at(7.9) }), NOW)).toBe(false);
    expect(unfinishedPageRow(log({ started_at: '' }), NOW)).toBe(true);
    expect(unfinishedPageRow(log({ status: 'written', started_at: at(48) }), NOW)).toBe(false);
    expect(noPageRow(log({ started_at: at(12) }), undefined, NOW)).toBe(true);
    expect(noPageRow(log({ started_at: at(1) }), undefined, NOW)).toBe(false);
  });

  it('only written pages wait to be published: the three cancelled runs and a page being written now are not counted', () => {
    const rows = [
      log({ keyword: 'dynamics ax dubai', request_id: 'cad_x_1', started_at: at(12.5) }),
      log({ keyword: 'business central implementation uae', request_id: 'cad_x_2', started_at: at(12.5) }),
      log({ keyword: 'erp project management uae', request_id: 'cad_x_3', started_at: at(12.5) }),
      log({ keyword: 'being written now', started_at: at(0.5) }),
      log({ keyword: 'ms 365 erp', status: 'written', started_at: at(30) }),
      log({ keyword: 'vat rules', status: 'not_ready', started_at: at(50) }),
      log({ keyword: 'live page', status: 'published', published_url: 'https://www.example.com/live', started_at: at(90) }),
    ];
    expect(waitingPages(rows, NOW).map((w) => w.keyword).sort()).toEqual(['ms 365 erp', 'vat rules']);
    // "a page for this keyword was already written" is not said about a run that never finished
    expect(writtenPages(rows, [], NOW).map((w) => w.keyword)).not.toContain('dynamics ax dubai');
    expect(writtenPages(rows, [], NOW).map((w) => w.keyword)).toContain('being written now');
  });

  it('Coming up: a page the cycle started with no result 8 hours later "could not be finished"', () => {
    const run = (hoursAgo: number) => ({
      job: null,
      report: { payload: { cycle_key: 'c', pages: [{ keyword: 'erp project management uae', source: 'ladder', request_id: 'cad_x_3' }] }, receivedAt: new Date(NOW - hoursAgo * H) },
      pageReports: [],
    });
    expect(runOutcome(run(12) as never, NOW).pages[0]!.state).toBe('failed');
    expect(runOutcome(run(1) as never, NOW).pages[0]!.state).toBe('started');
  });
});
