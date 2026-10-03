import { describe, expect, it } from 'vitest';
import type { ContentLogRow, LadderRow } from '@seo/shared';
import { buildLadders, detectedPages, type LadderSchedule, type LadderSources } from '../src/services/ladders';
import { detectedFeed } from '../src/services/pipeline';

// Phase 4 (publish detection): the weekly site report lists written pages it found live on the website (`detected_published`). The
// app shows them as published ("We found your page live at …") in the ladder and the pipeline, even before n8n's own rows say so;
// missing or odd fields are ignored (the n8n part is not deployed yet).

const NOW = Date.parse('2026-10-05T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 864e5).toISOString();
const lad = (o: Partial<LadderRow>) =>
  ({ ladder_id: 'l1', head_keyword: 'e invoicing in uae', keyword: '', status: 'planned', rung: 1, page_no: 1, page_type: 'Guide', target_url: '', months: '', start_date: ago(40), country: 'United Arab Emirates', supporting: '', ...o }) as LadderRow;
const log = (o: Partial<ContentLogRow>) => ({ keyword: '', status: 'started', started_at: ago(12), published_url: '', published_at: '', request_id: '', ladder_id: '', source: 'app', ...o }) as ContentLogRow;
const src = (o: Partial<LadderSources>): LadderSources => ({ ladders: [], history: [], logs: [], queries: [], settings: [], plans: [], pageReports: [], runs: [], ...o });
const sched: LadderSchedule = { dated: [], cadenceRuns: [], rankNextAt: null };

describe('detected pages: parsing', () => {
  it('keeps keyword + web address, cleans the ladder id, ignores the rest', () => {
    const d = detectedPages(
      [
        { keyword: 'peppol uae', url: 'https://www.techand.ai/peppol-uae/', ladder_id: 'l1', matched_by: 'slug', source: 'sitemap' },
        { keyword: 'vat rules', url: 'https://techand.ai/vat-rules', ladder_id: '', matched_by: 'title' },
        { keyword: 'bad id', url: 'https://techand.ai/x', ladder_id: '../etc' },
        { keyword: '', url: 'https://techand.ai/y' },
        { keyword: 'no url', url: 'javascript:alert(1)' },
        'junk',
        null,
      ],
      ago(1),
      'rep-st',
    );
    expect(d.map((x) => [x.keyword, x.url, x.ladderId, x.matchedBy])).toEqual([
      ['peppol uae', 'https://www.techand.ai/peppol-uae/', 'l1', 'slug'],
      ['vat rules', 'https://techand.ai/vat-rules', '', 'title'],
      ['bad id', 'https://techand.ai/x', '', ''],
    ]);
    expect(d[0]).toMatchObject({ at: ago(1), reportId: 'rep-st' });
    expect(detectedPages(undefined, ago(1), 'r')).toEqual([]);
    expect(detectedPages({ keyword: 'x' }, ago(1), 'r')).toEqual([]);
  });
});

describe('detected pages: ladders and the pipeline', () => {
  const ladders = [lad({ keyword: 'peppol uae', page_no: 1 }), lad({ keyword: 'uae e invoicing penalties', page_no: 2 }), lad({ keyword: 'e invoicing in uae', rung: 4, page_no: 3 })];
  const logs = [log({ keyword: 'peppol uae', ladder_id: 'l1' }), log({ keyword: 'vat rules' })];
  const detected = detectedPages(
    [
      { keyword: 'Peppol UAE', url: 'https://www.techand.ai/peppol-uae/', ladder_id: 'l1', matched_by: 'slug' },
      { keyword: 'vat rules', url: 'https://techand.ai/vat-rules', matched_by: 'title' },
    ],
    ago(1),
    'rep-st',
  );

  it('the page counts as published at the found address, with a timeline entry that says it was found automatically', () => {
    const b = buildLadders(src({ ladders, logs, detected }), sched, { now: NOW });
    const d = b.details.get('l1')!;
    const page = d.pages.find((p) => p.keyword === 'peppol uae')!;
    expect([page.state, page.publishedUrl, page.publishedAt]).toEqual(['published', 'https://www.techand.ai/peppol-uae/', ago(1)]);
    const ev = d.timeline.find((e) => e.kind === 'published')!;
    expect(ev).toMatchObject({ detected: true, keyword: 'peppol uae', at: ago(1) });
    expect(ev.text).toBe('We found “peppol uae” live at techand.ai/peppol-uae: spotted automatically by the weekly site check');
    expect(d.counts.published).toBe(1);
    // neither the ladder page nor the other post waits to be published any more
    expect(b.waiting.map((w) => w.keyword)).toEqual([]);
  });

  it('a page n8n already marked published keeps its own date; the entry still says it was found', () => {
    const marked = [log({ keyword: 'peppol uae', ladder_id: 'l1', status: 'published', published_url: 'https://techand.ai/peppol-uae', published_at: ago(2) })];
    const d = buildLadders(src({ ladders, logs: marked, detected }), sched, { now: NOW }).details.get('l1')!;
    const page = d.pages.find((p) => p.keyword === 'peppol uae')!;
    expect([page.publishedUrl, page.publishedAt]).toEqual(['https://techand.ai/peppol-uae', ago(2)]);
    expect(d.timeline.find((e) => e.kind === 'published')?.detected).toBe(true);
  });

  it('without detections nothing changes (the published entry is the usual one)', () => {
    const marked = [log({ keyword: 'peppol uae', ladder_id: 'l1', status: 'published', published_url: 'https://techand.ai/peppol-uae', published_at: ago(2) })];
    const d = buildLadders(src({ ladders, logs: marked }), sched, { now: NOW }).details.get('l1')!;
    expect(d.timeline.find((e) => e.kind === 'published')).toMatchObject({ text: '“peppol uae” published at techand.ai/peppol-uae' });
    expect(d.timeline.find((e) => e.kind === 'published')?.detected).toBeUndefined();
  });

  it('the pipeline feed: newest first, one per address (www and slashes ignored), with the ladder’s main keyword', () => {
    const older = detectedPages([{ keyword: 'peppol uae', url: 'https://techand.ai/peppol-uae', ladder_id: 'l1' }], ago(8), 'rep-old');
    const feed = detectedFeed([...older, ...detected], [{ id: 'l1', head: 'e invoicing in uae' }]);
    expect(feed.map((f) => [f.keyword, f.head, f.reportId])).toEqual([
      ['Peppol UAE', 'e invoicing in uae', 'rep-st'],
      ['vat rules', '', 'rep-st'],
    ]);
  });
});
