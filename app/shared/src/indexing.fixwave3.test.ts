import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import wave2 from './__fixtures__/index-coverage-wave2.json';
import { buildIndexingData, indexingCauseReadings, indexingNoteText, indexPageOf, pageCanonicalOf } from './indexing';
import { deriveSiteTasks, siteTaskPayload, type SiteTaskCheck, type SiteTaskInputs, type StoredSiteTask } from './site-tasks';
import { guideById } from './guides';
import type { IndexPageRow, IndexRunRow } from './tables';

// Index coverage, fix wave 3 (n8n/seo-agent/docs/indexing-2026-10-29/REVIEW_3.md R1, R5, R9, X17). Every case fails on ix/app 7777e17d.

const D = 'example.com';
const U = (p: string) => `https://${D}${p}`;
const S = { on: true, dailyCap: 300 };
const page = (url: string, o: Partial<IndexPageRow> = {}): Partial<IndexPageRow> => ({ site_id: 'site_example-com', domain: D, url: U(url), lane: 'existing', state: 'excluded', in_sitemap: true, ...o });
const stored = (o: Partial<StoredSiteTask> = {}): StoredSiteTask => ({ key: 'indexing:noindex', kind: 'indexing', payload: { cause: 'noindex', urls: [U('/s')], total: 1 }, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: '2026-10-01T00:00:00.000Z', ...o });
const inputs = (causes: ReturnType<typeof indexingCauseReadings>, runAt = '2026-11-05T10:15:00.000Z'): SiteTaskInputs => ({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt, causes } });
const own = (at: string, ok = true, by: SiteTaskCheck['by'] = 'daily'): SiteTaskCheck => ({ at, ok, by, message: ok ? 'These pages open without a noindex instruction.' : 'The noindex is still there.' });

// the engine's N3 row (IX.fixState): Google crawled on 2026-11-04 after the fix we saw, still reads noindex; inspected 2026-11-05 10:15
const failedRow = page('/s', {
  cause: 'noindex', action: 'site_fix', fix_seen_at: '', fix_failed_at: '2026-11-04T09:00:00.000Z', inspect_at: '2026-11-05T10:15:00.000Z', last_crawl: '2026-11-04T09:00:00.000Z',
  note: 'Google read this page again on 2026-11-04, after the change we saw on your site, and still sees the same problem. It may only be shown to Google\'s crawler.',
});

describe('R1: Google still sees the problem after the client\'s fix (fix_failed_at)', () => {
  it('the page reads as a site fix Google still sees, never "fixed on your site"', () => {
    const p = indexPageOf(failedRow);
    expect(p.fixFailedAt).toBe('2026-11-04T09:00:00.000Z');
    expect(p.fixSeenAt).toBe('');
    expect(p.action).toBe('site_fix');
    const [r] = indexingCauseReadings([failedRow]);
    expect(r).toMatchObject({ cause: 'noindex', total: 1, pending: 0, googleStillSees: 1, googleStillSeesAt: '2026-11-04T09:00:00.000Z' });
  });

  it('the app\'s own check never closes the step again, on any day, and the step says why in plain words', () => {
    const r = indexingCauseReadings([failedRow]);
    for (const check of [null, own('2026-11-05T14:00:00.000Z'), own('2026-11-06T14:00:00.000Z'), own('2026-11-07T09:00:00.000Z', true, 'you')]) {
      const t = deriveSiteTasks(inputs(r), [stored({ lastCheck: check, doneAt: check?.at ?? null })])[0];
      expect(t.state).toBe('todo');
      expect(t.severity).toBe('warning');
      expect(t.lastCheck?.by).toBe('index');
      expect(t.lastCheck?.ok).toBe(false);
      expect(t.lastCheck?.message).toMatch(/still sees the problem/);
      expect(t.detail).toMatch(/Google read one of these pages again after the change we saw on your website, and still sees the problem/);
      expect(t.detail).toMatch(/different from what a browser sees/);
      expect(t.detail).toMatch(/noindex, a block or an error sent only to Google/);
      expect(t.guide).toBe('index-remove-noindex');
      // owner copy rule: no em dash, no curly quotes, no ellipsis, no promise, never "we ask / submit / change"
      expect(t.detail).not.toMatch(/[—‘’“”…]|\.\.\.|we submit|we ask google|we change your site|will be indexed|guarantee/i);
    }
  });

  it('an engine reading kept on the row that called the step done (fixed on the site, earlier) does not close it either', () => {
    const t = deriveSiteTasks(inputs(indexingCauseReadings([failedRow])), [stored({ lastCheck: { at: '2026-11-06T00:00:00.000Z', ok: true, by: 'index', message: 'Fixed on your site.' }, doneAt: '2026-11-06T00:00:00.000Z' })])[0];
    expect(t.state).toBe('todo');
  });

  it('an own check that still finds the problem is shown as it is', () => {
    const t = deriveSiteTasks(inputs(indexingCauseReadings([failedRow])), [stored({ lastCheck: own('2026-11-06T14:00:00.000Z', false) })])[0];
    expect(t).toMatchObject({ state: 'todo', lastCheck: { by: 'daily', ok: false } });
  });

  it('the stored payload carries it, so the server\'s own check can refuse to close the step', () => {
    const r = indexingCauseReadings([failedRow]);
    expect(siteTaskPayload(inputs(r), [stored()], 'indexing:noindex')?.payload).toMatchObject({ cause: 'noindex', total: 1, googleStillSees: 1 });
    // a cause with no such page carries nothing
    const clean = indexingCauseReadings([page('/s', { cause: 'noindex', action: 'site_fix', inspect_at: '2026-11-05T10:15:00.000Z' })]);
    expect(siteTaskPayload(inputs(clean), [stored()], 'indexing:noindex')?.payload).not.toHaveProperty('googleStillSees');
  });

  it('an older engine row still filed `wait` with a newer fix_failed_at is a site fix; a sighting newer than it is a later fix, waiting again', () => {
    const older = indexPageOf(page('/s', { cause: 'noindex', action: 'wait', fix_seen_at: '2026-11-01T00:00:00.000Z', fix_failed_at: '2026-11-04T09:00:00.000Z' }));
    expect(older).toMatchObject({ action: 'site_fix', fixSeenAt: '', fixFailedAt: '2026-11-04T09:00:00.000Z' });
    const later = indexPageOf(page('/s', { cause: 'noindex', action: 'wait', fix_seen_at: '2026-11-08T00:00:00.000Z', fix_failed_at: '2026-11-04T09:00:00.000Z' }));
    expect(later).toMatchObject({ action: 'wait', fixSeenAt: '2026-11-08T00:00:00.000Z', fixFailedAt: '' });
    // a page in search carries neither
    expect(indexPageOf(page('/s', { state: 'indexed', cause: 'indexed', action: 'none', fix_failed_at: '2026-11-04T09:00:00.000Z' })).fixFailedAt).toBe('');
  });

  it('the guide of every step that can be shown only to Google explains how to see a page as Google gets it', () => {
    for (const id of ['index-remove-noindex', 'index-robots-blocked', 'index-fix-server-error', 'index-fix-access-denied', 'index-fix-not-found', 'index-fix-soft-404', 'index-fix-redirect-error', 'index-canonical-sitemap']) {
      const g = guideById(id);
      expect(g?.trouble?.some((x) => /Test live URL/.test(x.a) && /only to Google/.test(x.a)), id).toBe(true);
    }
  });
});

describe('R5: a failed run\'s note', () => {
  const note = 'We could not check this website today: inventory failed: TypeError x.y. The figures are from the last check.';
  it('never shows a fragment of an internal error, whatever dots it holds', () => {
    const t = indexingNoteText(note);
    expect(t).not.toMatch(/TypeError|x\.y|\by\.|failed:/);
    expect(t).toContain('Something went wrong on our side');
    expect(indexingNoteText('We could not check this website today: diagnosis failed: Cannot read properties of undefined (reading \'a.b.c\'). Nothing has been checked yet.')).not.toMatch(/properties|a\.b|undefined/);
  });
  it('leaves "from the last check" to the screen, which says it once', () => {
    expect(indexingNoteText(note)).not.toMatch(/last check/);
    const d = buildIndexingData({
      rows: [page('/a', { state: 'indexed', cause: 'indexed', action: 'none', inspect_at: '2026-11-01T05:00:00.000Z' })],
      runs: [
        { site_id: 'site_example-com', domain: D, run_at: '2026-11-02T05:15:00.000Z', known: 1, note, sitemaps_json: JSON.stringify({ checked: false }) },
        { site_id: 'site_example-com', domain: D, run_at: '2026-11-01T05:15:00.000Z', known: 1, indexed: 1, inspected: 1 },
      ],
      events: [],
      impacts: [],
      settings: S,
    });
    expect(d.notice?.failed).toBe(true);
    expect(d.notice?.text).not.toMatch(/TypeError|x\.y/);
    expect((d.notice?.text.match(/figures/gi) ?? []).length).toBe(1);
  });
});

describe('R9: an empty canonical', () => {
  it('href="" and href=\'\' are no canonical, never a URL made of the page or the quotes', () => {
    for (const html of ['<link rel="canonical" href="">', "<link rel='canonical' href=''>", '<link rel="canonical" href="" />', '<link rel=canonical href="">'])
      expect(pageCanonicalOf(html, 'https://example.com/x'), html).toBe('');
    // the cases fix wave 2 fixed still resolve
    expect(pageCanonicalOf('<link rel="canonical" href="a">', 'https://example.com/x/y')).toBe('https://example.com/x/a');
    expect(pageCanonicalOf('<link rel="canonical" href=//example.com/z>', 'https://example.com/x')).toBe('https://example.com/z');
  });
});

describe('X17: the engine\'s wave 2 rows (made by its real nodes, IXW14) through the app', () => {
  it('the fixture is the engine\'s file, unchanged (when the engine tree is beside the app)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = join(here, '../../../n8n/seo-agent/docs/indexing-2026-10-29/contract_rows_wave2.json');
    if (!existsSync(src)) return;
    expect(JSON.parse(readFileSync(src, 'utf8'))).toEqual(wave2);
  });

  const rows = (wave2.pages as unknown as Partial<IndexPageRow>[]).map((r) => ({ ...r }));
  // the engine's N1 shape (`sources` may name `final`: the row lives where a listed form redirects to); the app reads the row at its address
  const finalRow: Partial<IndexPageRow> = { ...rows.find((r) => r.url?.endsWith('/loop'))!, url: 'https://www.example.com/moved', sources: 'sitemap,final', cause: 'noindex', state: 'excluded', action: 'site_fix', impressions_28d: 3 };
  const all = [...rows, finalRow];
  const run = wave2.reservation_run_row as unknown as Partial<IndexRunRow>;
  const finished: Partial<IndexRunRow> = { ...run, run_at: '2026-11-03T09:00:00.000Z', sitemaps_json: JSON.stringify({ complete: true }), note: '' };

  it('every engine field is read: fix_failed_at, ask_google_at and sources with final do not break a page', () => {
    const notTaken = indexPageOf(rows.find((r) => r.url?.endsWith('/not-taken'))!);
    expect(notTaken).toMatchObject({ action: 'site_fix', fixFailedAt: '2026-11-02T10:15:00.000Z', fixSeenAt: '' });
    const fixed = indexPageOf(rows.find((r) => r.url?.endsWith('/fixed'))!);
    expect(fixed).toMatchObject({ action: 'wait', fixFailedAt: '', fixSeenAt: '2026-11-03T10:15:00.000Z', askGoogle: true });
    expect(indexPageOf(finalRow)).toMatchObject({ url: 'https://www.example.com/moved', path: '/moved', action: 'site_fix' });
  });

  it('the page view: the reservation is not the latest reading, the Google-only page is a site fix, the fixed one waits', () => {
    const d = buildIndexingData({ rows: all, runs: [run, finished], events: [], impacts: [], settings: S });
    expect(d.checkedAt).toBe('2026-11-03T09:00:00.000Z');
    expect(d.notice?.title).toBe('The latest check had not finished');
    expect(d.groups.find((g) => g.cause === 'fixed_on_site')?.count).toBe(1);
    expect(d.groups.find((g) => g.cause === 'noindex' && g.action === 'site_fix')?.count).toBe(2);
  });

  it('the steps: noindex stays to do because Google still sees /not-taken, whatever our own check says; redirect_error is to do', () => {
    const causes = indexingCauseReadings(all);
    const noindex = causes.find((c) => c.cause === 'noindex')!;
    expect(noindex).toMatchObject({ total: 2, pending: 1, googleStillSees: 1 });
    const tasks = deriveSiteTasks({ domain: 'example.com', indexnow: null, access: null, reclaim: null, indexing: { runAt: '2026-11-03T10:15:00.000Z', causes } }, [
      stored({ payload: { cause: 'noindex', urls: ['https://www.example.com/not-taken'], total: 1 }, lastCheck: own('2026-11-04T14:00:00.000Z'), doneAt: '2026-11-04T14:00:00.000Z' }),
    ]);
    const n = tasks.find((t) => t.key === 'indexing:noindex')!;
    expect(n).toMatchObject({ state: 'todo', severity: 'warning' });
    expect(n.detail).toMatch(/still sees the problem/);
    expect(n.detail).toMatch(/We already saw 1 more fixed on your site/);
    expect(tasks.find((t) => t.key === 'indexing:redirect_error')).toMatchObject({ state: 'todo' });
  });
});
