import { describe, expect, it } from 'vitest';
import {
  buildIndexingData,
  improveStateOf,
  indexGroupCauseOf,
  indexImprovementsOf,
  indexMergePairs,
  indexMergeVerdict,
  indexPageOf,
  indexPagesPage,
  INDEXING_MERGE_KEY,
  withImprovements,
} from './indexing';
import { deriveSiteTasks, siteTaskKindOfKey, siteTaskPayload, type SiteTaskInputs } from './site-tasks';
import { guideById } from './guides';
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
  it('keeps the published rows that improve a page: at its own address (host and trailing slash ignored) or at another one', () => {
    const xs = indexImprovementsOf([logRow(), logRow({ published_url: `https://${D}/bfsi-software` }), logRow({ status: 'written' }), logRow({ existing_page_url: '' })]);
    expect(xs).toEqual([
      { url: PAGE, to: '', at: REPORTED },
      { url: `https://www.${D}/industries/bfsi/`, to: `https://${D}/bfsi-software`, at: REPORTED },
    ]);
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
  it('a separate "write it anyway" page (no existing page on the row) is no improvement: the page keeps "Improve this page"', () => {
    const rows = withImprovements([leftOut()], indexImprovementsOf([logRow({ existing_page_url: '', published_url: `https://${D}/bfsi-software` })]));
    expect(indexPageOf(rows[0]).action).toBe('quality');
  });
});

// Production 2026-11-05 (devaicon.com, content log rows 19 / 22 / 24): the three improvements were confirmed at NEW addresses after the
// publish check warned; the old pages still open (200, no redirect), so the two compete for one search.
const PROD = [
  { id: 19, keyword: 'application software development', existing_page_url: `https://${D}/capabilities/application-software-development`, published_url: `https://${D}/services/capabilities-application-software-development`, published_at: '2026-11-04T12:11:40.000Z' },
  { id: 22, keyword: 'banking & financial services technology', existing_page_url: `https://${D}/industries/bfsi`, published_url: `https://${D}/services/industries-bfsi`, published_at: '2026-11-04T12:27:05.000Z' },
  { id: 24, keyword: 'software engagement models', existing_page_url: `https://${D}/engagement-models`, published_url: `https://${D}/services/engagement-models`, published_at: '2026-11-04T12:42:18.000Z' },
].map((r) => ({ ...r, domain: D, status: 'published', publish_note: 'Marked published by you after a warning: sent at another address than the page it updates (checked 2026-11-04)' }));

describe('an improvement confirmed at another address (production rows 19 / 22 / 24)', () => {
  const imps = indexImprovementsOf(PROD);
  const olds = PROD.map((r) => leftOut({ url: r.existing_page_url, title: r.keyword }));
  const news = PROD.map((r) => leftOut({ url: r.published_url, lane: 'new', cause: 'wait_new', action: 'wait', coverage: 'URL is unknown to Google' }));

  it('each old page is "Improved version published at another address": a step on the website, never "Improve this page" or "waiting for Google"', () => {
    const rows = withImprovements([...olds, ...news], imps);
    const pages = rows.map(indexPageOf);
    for (const [i, r] of PROD.entries()) {
      const p = pages[i];
      expect(improveStateOf(rows[i])).toBe('moved');
      expect(p).toMatchObject({ state: 'not_indexed', action: 'site_fix', improvedTo: r.published_url, improvedWaiting: false, lane: 'existing' });
      expect(indexGroupCauseOf(p)).toBe('improved_elsewhere');
      expect(p.note).toContain(`went live at ${r.published_url.replace(`https://${D}`, '')}`);
      expect(p.note).toMatch(/permanent \(301\) redirect/);
    }
    // the new pages stay new pages waiting for Google
    for (const p of pages.slice(3)) expect(p).toMatchObject({ lane: 'new', action: 'wait', improvedTo: '' });
    const data = buildIndexingData({ rows, runs: [], events: [], impacts: [], settings: { on: true, dailyCap: 300 } });
    expect(data.groups.some((g) => g.action === 'quality')).toBe(false);
    expect(data.groups.find((g) => g.cause === 'improved_elsewhere')).toMatchObject({ action: 'site_fix', count: 3, taskKey: INDEXING_MERGE_KEY, guide: 'index-merge-improved' });
  });

  it('the engine\'s row of the day before (quality, or site_fix) is read the same way; once the old address redirects it is a redirect, not this step', () => {
    const [row] = withImprovements([olds[1]], imps);
    expect(indexPageOf({ ...row, action: 'quality' }).action).toBe('site_fix');
    expect(improveStateOf({ ...row, cause: 'redirect', state: 'excluded' })).toBe('');
    // Google reading the old page again does not end it: the two still compete until one of them goes
    expect(improveStateOf({ ...row, last_crawl: '2026-11-07T00:00:00Z' })).toBe('moved');
  });

  it('one step lists every pair, newest first, and is a kind of its own with the guide', () => {
    const pairs = indexMergePairs(imps);
    expect(pairs.map((p) => [p.from, p.to])).toEqual(PROD.slice().reverse().map((r) => [r.existing_page_url, r.published_url]));
    const inputs: SiteTaskInputs = { domain: D, indexnow: null, access: null, reclaim: null, merges: { pairs } };
    const [t] = deriveSiteTasks(inputs, []).filter((x) => x.key === INDEXING_MERGE_KEY);
    expect(t).toMatchObject({ kind: 'index_merge', state: 'todo', guide: 'index-merge-improved', title: 'Redirect your old pages to their improved versions' });
    expect(t.values[1]).toEqual({ label: 'Redirect /industries/bfsi to', value: `https://${D}/services/industries-bfsi` });
    expect(t.detail).not.toMatch(/[—–‘’“”…]/);
    expect(siteTaskKindOfKey(INDEXING_MERGE_KEY)).toBe('index_merge');
    expect(siteTaskPayload(inputs, [], INDEXING_MERGE_KEY)?.kind).toBe('index_merge');
    expect(guideById('index-merge-improved')?.title).toBe('Make one page of an old page and its improved version');
    // an improvement at the page's own address later wins: no pair for it any more
    expect(indexMergePairs([...imps, { url: PROD[1].existing_page_url, to: '', at: '2026-11-05T09:00:00.000Z' }]).map((p) => p.from)).not.toContain(PROD[1].existing_page_url);
  });

  it('the check: done on a permanent redirect to the improved version that opens, or when the new address is gone; not on a temporary one or with both open', () => {
    const pair = { from: PROD[1].existing_page_url, to: PROD[1].published_url };
    expect(indexMergeVerdict(pair, { status: 200 }, null, { status: 200 })).toMatchObject({ done: false, reached: true });
    expect(indexMergeVerdict(pair, { status: 302, location: pair.to }, null, null).message).toContain('temporary 302');
    expect(indexMergeVerdict(pair, { status: 301, location: pair.to }, { status: 200, finalUrl: `https://www.${D}/services/industries-bfsi/` }, null)).toMatchObject({ done: true });
    expect(indexMergeVerdict(pair, { status: 301, location: `https://${D}/` }, { status: 200, finalUrl: `https://${D}/` }, null)).toMatchObject({ done: false });
    expect(indexMergeVerdict(pair, { status: 200 }, null, { status: 404 })).toMatchObject({ done: true });
    expect(indexMergeVerdict(pair, { status: 200 }, null, { status: 301, location: pair.from })).toMatchObject({ done: true });
    expect(indexMergeVerdict(pair, null, null, null)).toMatchObject({ done: false, reached: false });
  });
});
