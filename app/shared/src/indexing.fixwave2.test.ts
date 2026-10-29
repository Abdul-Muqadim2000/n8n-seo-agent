import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/index-coverage-techand.json';
import {
  buildIndexingData,
  headerNoindex,
  indexingCauseReadings,
  indexingPageFixed,
  indexPageOf,
  pageCanonicalOf,
  INDEX_FIXED_ON_SITE,
} from './indexing';
import { deriveSiteTasks, type SiteTaskInputs, type StoredSiteTask } from './site-tasks';
import { INDEX_COVERAGE_SCHEDULE } from './constants';
import { guideById } from './guides';
import type { IndexPageRow, IndexRunRow } from './tables';

// Index coverage, fix wave 2 (2026-10-29, n8n/seo-agent/docs/indexing-2026-10-29/REVIEW_2.md, N-app-*). Each test names the finding it
// closes and fails on the code before the wave. Client text anonymised (novaand-demo.com).

const D = 'novaand-demo.com';
const U = (p: string) => `https://${D}${p}`;
const S = { on: true, dailyCap: 300 };
const page = (url: string, o: Partial<IndexPageRow> = {}): Partial<IndexPageRow> => ({ site_id: 'site_novaand-demo-com', domain: D, url: U(url), lane: 'existing', state: 'excluded', in_sitemap: true, ...o });
const stored = (o: Partial<StoredSiteTask> = {}): StoredSiteTask => ({ key: 'indexing:noindex', kind: 'indexing', payload: { cause: 'noindex', urls: [U('/s')], total: 1 }, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: '2026-10-01T00:00:00.000Z', ...o });
const inputs = (causes: SiteTaskInputs['indexing'] extends infer X ? (X extends { causes: infer C } ? C : never) : never, runAt = '2026-11-03T10:15:00.000Z'): SiteTaskInputs => ({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt, causes } });

describe('N-app-1 (= N4): fix_seen_at set means "fixed on your site, waiting for Google", whatever the order of the stamps', () => {
  const fix = '2026-11-02T10:15:00.000Z';
  const days = {
    'day 0, inspected in the same run': '2026-11-02T10:15:00.000Z',
    'day 1, the fix newer than the inspection': '2026-10-30T00:00:00.000Z',
    'day 2, Google re-inspected and has not caught up yet': '2026-11-03T10:15:00.000Z',
  };
  for (const [name, inspect] of Object.entries(days)) {
    it(`${name}: the page waits for Google and the step is done, never "Remove the noindex"`, () => {
      const row = page('/s', { cause: 'noindex', action: 'wait', fix_seen_at: fix, inspect_at: inspect });
      const p = indexPageOf(row);
      expect(p.fixSeenAt).toBe(fix);
      expect(p.action).toBe('wait');
      const d = buildIndexingData({ rows: [row], runs: [], events: [], impacts: [], settings: S });
      expect(d.groups.map((g) => g.cause)).toEqual(['fixed_on_site']);
      const r = indexingCauseReadings([row]);
      expect(r).toMatchObject([{ cause: 'noindex', total: 0, pending: 1 }]);
      const t = deriveSiteTasks(inputs(r), [stored()])[0];
      expect(t.state).toBe('done');
      expect(t.lastCheck?.message).toContain('Fixed on your site');
      expect(t.detail).not.toMatch(/lists none of these pages/i);
    });
  }
  it('an older engine row (action site_fix with fix_seen_at) reads the same way', () => {
    const p = indexPageOf(page('/s', { cause: 'noindex', action: 'site_fix', fix_seen_at: fix, inspect_at: '2026-11-05T00:00:00.000Z' }));
    expect(p).toMatchObject({ fixSeenAt: fix, action: 'wait' });
  });
  it('the engine cleared it (Google crawled after the fix and still reads noindex): to do again, with Google\'s reading', () => {
    const row = page('/s', { cause: 'noindex', action: 'site_fix', fix_seen_at: '', inspect_at: '2026-11-05T00:00:00.000Z' });
    const t = deriveSiteTasks(inputs(indexingCauseReadings([row])), [stored()])[0];
    expect(t.state).toBe('todo');
  });
  it('a page in search is never "waiting for Google"', () => {
    expect(indexPageOf(page('/s', { state: 'indexed', cause: 'indexed', action: 'none', fix_seen_at: fix })).fixSeenAt).toBe('');
  });
});

describe('N-app-2: a cause read only in part, or a read that returns only other rows, never closes a step', () => {
  it('a capped read of a cause whose rows are all left out is an incomplete reading, not "none any more"', () => {
    const rows = Array.from({ length: 200 }, (_, i) => page(`/old${i}`, { cause: 'redirect', action: 'leave_out', impressions_28d: 1000 - i }));
    const causes = indexingCauseReadings(rows, { read: ['redirect'], capped: new Set(['redirect']) });
    expect(causes).toEqual([expect.objectContaining({ cause: 'redirect', total: 0, complete: false })]);
    const st = stored({ key: 'indexing:redirect', payload: { cause: 'redirect', urls: [U('/r')], total: 3 } });
    const t = deriveSiteTasks(inputs(causes), [st]).find((x) => x.key === 'indexing:redirect')!;
    expect(t.state).toBe('todo');
    expect(t.lastCheck).toBeNull();
  });
  it('a cause read in full with no page left to fix is done, and the sentence says only what the reading shows', () => {
    const causes = indexingCauseReadings([], { read: ['redirect'] });
    const st = stored({ key: 'indexing:redirect', payload: { cause: 'redirect', urls: [U('/r')], total: 3 } });
    const t = deriveSiteTasks(inputs(causes), [st]).find((x) => x.key === 'indexing:redirect')!;
    expect(t.state).toBe('done');
    expect(`${t.lastCheck?.message} ${t.detail}`).not.toMatch(/Google's newest reading lists none/i);
  });
});

describe('N-app-8: X-Robots-Tag is read the way Google reads it', () => {
  it('directives with a value before noindex are directives, not crawler names', () => {
    expect(headerNoindex('max-snippet:-1, noindex')).toBe(true);
    expect(headerNoindex('max-image-preview:large, noindex')).toBe(true);
    expect(headerNoindex('unavailable_after: 25 Jun 2030 15:00:00 PST, noindex')).toBe(true);
    expect(headerNoindex('max-video-preview: 0, none')).toBe(true);
  });
  it('googlebot-prefixed values and lists', () => {
    expect(headerNoindex('googlebot: noindex')).toBe(true);
    expect(headerNoindex('googlebot: nofollow, noindex')).toBe(true);
    expect(headerNoindex('otherbot: nofollow, googlebot: noindex')).toBe(true);
    expect(headerNoindex(['bingbot: noindex', 'googlebot: noindex'])).toBe(true);
  });
  it('a header for another crawler alone is not a noindex', () => {
    expect(headerNoindex('bingbot: noindex')).toBe(false);
    expect(headerNoindex('otherbot: noindex, nofollow')).toBe(false);
    expect(headerNoindex('googlebot-news: noindex')).toBe(false);
    expect(headerNoindex('max-snippet:-1')).toBe(false);
    expect(headerNoindex('index, follow')).toBe(false);
  });
});

describe('N-app-12: a relative canonical is resolved against the page address', () => {
  const html = (href: string) => `<html><head><title>P</title><link rel="canonical" href="${href}"></head><body>hi</body></html>`;
  it('relative, dot-relative and protocol-relative forms', () => {
    expect(pageCanonicalOf(html('p'), U('/blog/p'))).toBe(U('/blog/p'));
    expect(pageCanonicalOf(html('../blog/p'), U('/blog/p'))).toBe(U('/blog/p'));
    expect(pageCanonicalOf(html(`//${D}/blog/p`), U('/blog/p'))).toBe(U('/blog/p'));
    expect(pageCanonicalOf(html('/blog/p'), U('/blog/p'))).toBe(U('/blog/p'));
  });
  it('a page naming itself with a relative canonical is fixed', () => {
    const f = { url: U('/blog/p'), status: 200, finalUrl: U('/blog/p'), redirectStatus: 0, text: html('p') };
    expect(indexingPageFixed('canonical_elsewhere', f, true).fixed).toBe(true);
  });
});

describe('N-app-9: no "we ask Google" and no "every page checked every day"', () => {
  it('the shared strings', () => {
    const strings = [INDEX_FIXED_ON_SITE.weDo, INDEX_COVERAGE_SCHEDULE.summary, ...(guideById('index-coverage')?.steps ?? []).map((s) => `${s.title} ${s.body ?? ''}`)];
    for (const x of strings) expect(x).not.toMatch(/\bwe ask google|\basks google|asks it soon/i);
  });
  it('the done sentence of a step fixed on the site', () => {
    const row = page('/s', { cause: 'noindex', action: 'wait', fix_seen_at: '2026-11-02T10:15:00.000Z', inspect_at: '2026-10-30T00:00:00.000Z' });
    const t = deriveSiteTasks(inputs(indexingCauseReadings([row])), [stored()])[0];
    expect(t.detail).not.toMatch(/asks it|ask google/i);
  });
});

describe('X17: the engine fix wave\'s rows through the app (fix_seen_at newer and older, ask_google, a reservation, redirect_error)', () => {
  const rows = (fixture.rows as unknown as Partial<IndexPageRow>[]).map((r) => ({ ...r }));
  const runs = fixture.runs as unknown as Partial<IndexRunRow>[];
  const run = runs[0];
  const at = String(run.run_at);
  const later = new Date(Date.parse(at) + 86_400_000).toISOString();
  const extra: Partial<IndexPageRow>[] = [
    // the engine's day 1: re-inspected after the fix was seen (inspect_at >= fix_seen_at), Google not caught up yet
    { site_id: 'site_techand-ai', domain: 'techand.ai', url: 'https://www.techand.ai/x-fixed-1', lane: 'existing', state: 'excluded', cause: 'noindex', action: 'wait', fix_seen_at: at, inspect_at: later, ask_google: true, impressions_28d: 9 },
    { site_id: 'site_techand-ai', domain: 'techand.ai', url: 'https://www.techand.ai/x-fixed-2', lane: 'existing', state: 'excluded', cause: 'noindex', action: 'wait', fix_seen_at: at, inspect_at: at },
    { site_id: 'site_techand-ai', domain: 'techand.ai', url: 'https://www.techand.ai/x-loop', lane: 'existing', state: 'not_indexed', cause: 'redirect_error', action: 'site_fix', inspect_at: at },
  ];
  const all = [...rows, ...extra];
  const reservation: Partial<IndexRunRow> = { site_id: 'site_techand-ai', domain: 'techand.ai', run_at: later, known: 0, inspected: 0, sitemaps_json: JSON.stringify({ reservation: true }) };
  const d = buildIndexingData({ rows: all, runs: [reservation, ...runs], events: [], impacts: [], settings: S });

  it('the reservation is never the latest reading; the figures stay the finished run\'s', () => {
    expect(d.checkedAt).toBe(at);
    expect(d.notice?.title).toBe('The latest check had not finished');
  });
  it('both fixed pages wait for Google; the noindex step is done and never "lists none"', () => {
    expect(d.groups.find((g) => g.cause === 'fixed_on_site')?.count).toBe(2);
    expect(d.askGoogle.map((p) => p.path)).toContain('/x-fixed-1');
    const causes = indexingCauseReadings(all);
    const tasks = deriveSiteTasks({ domain: 'techand.ai', indexnow: null, access: null, reclaim: null, indexing: { runAt: later, causes } }, [
      { key: 'indexing:noindex', kind: 'indexing', payload: { cause: 'noindex', urls: ['https://www.techand.ai/x-fixed-1'], total: 2 }, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: '2026-10-01T00:00:00.000Z' },
    ]);
    const n = tasks.find((t) => t.key === 'indexing:noindex')!;
    expect(n.state).toBe('done');
    expect(n.lastCheck?.message).toContain('Fixed on your site');
    expect(tasks.find((t) => t.key === 'indexing:redirect_error')).toMatchObject({ state: 'todo', title: expect.any(String) });
  });
});
