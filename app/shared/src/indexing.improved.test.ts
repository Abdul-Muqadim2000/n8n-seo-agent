import { describe, expect, it } from 'vitest';
import { buildIndexingData, improveStateOf, indexGroupCauseOf, indexImprovementsOf, indexPageOf, indexPagesPage, withImprovements } from './indexing';
import type { ContentLogRow, IndexPageRow } from './tables';

// Client report 2026-11-05 (devaicon.com): "I improved these pages (re-written by Alaventra), published them and reported them with the
// publish check, but Indexing still lists them under 'Google read it and left it out' with 'Improve this page'". The shared rule with the
// engine (`_index_kit.js` IX.improveState, harness IXI1-IXI3): Google decides again only after it reads the page, so the page is never
// called indexed by us; until Google's last crawl is newer than the improvement it is "improved, waiting for Google", then Google's reading
// decides. The app overlays the content log's improvement at once (the engine records it on its next daily run).

const D = 'devaicon.com';
const PAGE = `https://${D}/industries/bfsi`;
const REPORTED = '2026-11-04T12:09:00.000Z';
const leftOut = (o: Partial<IndexPageRow> = {}): Partial<IndexPageRow> => ({
  site_id: 'site_devaicon-com', domain: D, url: PAGE, lane: 'existing', state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality',
  coverage: 'Crawled - currently not indexed', last_crawl: '2026-10-30T08:00:00Z', inspect_at: '2026-11-02T05:20:00.000Z', in_sitemap: true, title: 'BFSI',
  note: 'Google read this page and chose not to add it for now. That is usually about how useful the page looks next to similar pages. Improving the page is the step that helps; we suggest it one page at a time and you approve it.',
  ...o,
});
const logRow = (o: Partial<ContentLogRow> = {}): Partial<ContentLogRow> => ({
  domain: D, keyword: 'banking & financial services technology', existing_page_url: `https://www.${D}/industries/bfsi/`, status: 'published',
  published_url: PAGE, published_at: REPORTED, ...o,
});

describe('improveStateOf (the engine rule IX.improveState)', () => {
  it('waits until Google reads the page after the improvement, then Google decides', () => {
    expect(improveStateOf({ state: 'not_indexed', cause: 'crawled_not_indexed', improved_at: REPORTED, last_crawl: '2026-10-30T08:00:00Z' })).toBe('waiting');
    expect(improveStateOf({ state: 'not_indexed', cause: 'crawled_not_indexed', improved_at: REPORTED, last_crawl: '' })).toBe('waiting');
    expect(improveStateOf({ state: 'not_indexed', cause: 'crawled_not_indexed', improved_at: REPORTED, last_crawl: '2026-11-07T09:00:00Z' })).toBe('read');
  });
  it('says nothing for a page in search, a reason an improvement does not answer, or no improvement', () => {
    expect(improveStateOf({ state: 'indexed', cause: '', improved_at: REPORTED })).toBe('');
    expect(improveStateOf({ state: 'excluded', cause: 'noindex', improved_at: REPORTED })).toBe('');
    expect(improveStateOf({ state: 'not_indexed', cause: 'crawled_not_indexed', improved_at: '' })).toBe('');
  });
});

describe('indexImprovementsOf / withImprovements (the content log overlay)', () => {
  it('keeps only a published row at the address it improved (host and trailing slash ignored)', () => {
    const xs = indexImprovementsOf([logRow(), logRow({ published_url: `https://${D}/bfsi-software` }), logRow({ status: 'written' }), logRow({ existing_page_url: '' })]);
    expect(xs).toEqual([{ url: PAGE, at: REPORTED }]);
  });
  it('the newest improvement wins, and a row with nothing newer is returned unchanged', () => {
    const r = leftOut({ improved_at: '2026-10-20T00:00:00.000Z' });
    expect(withImprovements([r], [{ url: PAGE, at: REPORTED }])[0].improved_at).toBe(REPORTED);
    const same = leftOut({ improved_at: '2026-11-06T00:00:00.000Z' });
    expect(withImprovements([same], [{ url: PAGE, at: REPORTED }])[0]).toBe(same);
    const other = leftOut({ url: `https://${D}/engagement-models` });
    expect(withImprovements([other], [{ url: PAGE, at: REPORTED }])[0]).toBe(other);
  });
});

describe('the Indexing page after the client improved a page Google left out', () => {
  it('before the engine ran (overlay): improved, waiting for Google; no "Improve this page"; not counted as needing the client', () => {
    const rows = withImprovements([leftOut()], indexImprovementsOf([logRow()]));
    const p = indexPageOf(rows[0]);
    expect(p.state).toBe('not_indexed');   // never called indexed by us
    expect(p.action).toBe('wait');
    expect(p.improvedWaiting).toBe(true);
    expect(p.improvedAt).toBe(REPORTED);
    expect(indexGroupCauseOf(p)).toBe('improved_waiting');
    expect(p.note).toMatch(/improved version on 2026-11-04/);
    expect(p.note).not.toMatch(/will be indexed|guarantee|Improving the page is the step/i);
    const data = buildIndexingData({ rows, runs: [], events: [], impacts: [], settings: { on: true, dailyCap: 300 } });
    const g = data.groups.find((x) => x.cause === 'improved_waiting');
    expect(g?.label).toBe('Improved, waiting for Google');
    expect(g?.pages.map((x) => x.url)).toEqual([PAGE]);
    expect(data.groups.some((x) => x.action === 'quality')).toBe(false);
    expect(data.lanes.existing.needYou).toBe(0);
    // the paged list of the group finds it too (one rule for the summary and the pages)
    expect(indexPagesPage(rows, { lane: 'existing', action: 'wait', cause: 'improved_waiting' }).items.map((x) => x.url)).toEqual([PAGE]);
  });
  it('after the engine ran: its `wait` row reads the same, with the engine\'s note', () => {
    const p = indexPageOf(leftOut({ action: 'wait', improved_at: REPORTED, note: 'You published an improved version on 2026-11-04. Google last read this page on 2026-10-30, before that, so it still shows its older reading.' }));
    expect(p.action).toBe('wait');
    expect(p.improvedWaiting).toBe(true);
    expect(p.note).toMatch(/^You published an improved version on 2026-11-04\. Google last read/);
  });
  it('Google read the improved version and still left it out: "Improve the page" again, and the row says Google read the new version', () => {
    // the engine's row of the day before still says `wait`; Google's newer crawl decides
    const p = indexPageOf(leftOut({ action: 'wait', improved_at: REPORTED, last_crawl: '2026-11-07T09:00:00Z' }));
    expect(p.action).toBe('quality');
    expect(p.improvedWaiting).toBe(false);
    expect(p.improvedReadAt).toBe('2026-11-07T09:00:00Z');
    expect(p.note).toMatch(/^Google read your improved version on 2026-11-07/);
    expect(indexGroupCauseOf(p)).toBe('crawled_not_indexed');
  });
  it('Google put it in search: it leaves the left-out groups by Google\'s own reading', () => {
    const p = indexPageOf(leftOut({ state: 'indexed', cause: '', action: 'none', improved_at: REPORTED, last_crawl: '2026-11-07T09:00:00Z' }));
    expect(p.state).toBe('indexed');
    expect(p.improvedWaiting).toBe(false);
    expect(p.improvedAt).toBe('');
  });
  it('a page improved at ANOTHER address (written anyway as a separate page) keeps "Improve this page"', () => {
    const rows = withImprovements([leftOut()], indexImprovementsOf([logRow({ published_url: `https://${D}/bfsi-software` })]));
    expect(indexPageOf(rows[0]).action).toBe('quality');
  });
});
