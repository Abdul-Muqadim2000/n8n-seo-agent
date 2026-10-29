import { describe, expect, it } from 'vitest';
import {
  buildIndexingData,
  findingAsksSameFix,
  indexInSearchLine,
  indexingCauseReadings,
  indexingPageFixed,
  indexingSitemapReading,
  indexPagesPage,
  INDEX_ACTION_INFO,
  INDEX_CAUSE_INFO,
  robotsFileState,
  updateImpactOf,
} from './indexing';
import { deriveSiteTasks, type SiteTaskInputs, type StoredSiteTask } from './site-tasks';
import { INDEX_COVERAGE_SCHEDULE, SCHEDULES } from './constants';
import { deliveryDecisionFor, DEFAULT_DELIVERY_SETTINGS } from './report-delivery';
import { eventsFor } from './integrations';
import { guideById, guideForRecommendation } from './guides';
import type { IndexPageRow } from './tables';

// Index coverage, fix wave 1 (2026-10-29, n8n/seo-agent/docs/indexing-2026-10-29/REVIEW_APP.md, REVIEW_CROSS.md, FIX_CONTRACT.md). Each
// test names the finding it closes and fails on the code before the wave. Client text anonymised (novaand-demo.com).

const D = 'novaand-demo.com';
const U = (p: string) => `https://${D}${p}`;
const S = { on: true, dailyCap: 300 };
const page = (url: string, o: Partial<IndexPageRow> = {}): Partial<IndexPageRow> => ({ site_id: 'site_novaand-demo-com', domain: D, url: U(url), lane: 'existing', state: 'not_indexed', ...o });
const f = (o: Record<string, unknown> = {}) => ({ url: U('/p'), status: 200, finalUrl: U('/p'), redirectStatus: 0, text: '<html><head><title>P</title></head><body>hi</body></html>', ...o }) as Parameters<typeof indexingPageFixed>[1];

describe('A2 / A16: a fix counts only on the exact positive signal (FIX_CONTRACT decision 3)', () => {
  it('server_error: a 403 firewall or a 404 is never "fixed"', () => {
    expect(indexingPageFixed('server_error', f({ status: 403, text: 'Forbidden' }), null)).toMatchObject({ fixed: false, unknown: true });
    expect(indexingPageFixed('server_error', f({ status: 404 }), null)).toMatchObject({ fixed: false });
    expect(indexingPageFixed('server_error', f({ status: 404 }), null).unknown).toBeUndefined();
  });
  it('access_denied: 404 and 503 are not fixes; 200 is', () => {
    expect(indexingPageFixed('access_denied', f({ status: 404 }), true).fixed).toBe(false);
    expect(indexingPageFixed('access_denied', f({ status: 503, text: '' }), true)).toMatchObject({ fixed: false, unknown: true });
    expect(indexingPageFixed('access_denied', f(), true).fixed).toBe(true);
  });
  it('canonical_elsewhere: a 404 or an empty body never "names itself"', () => {
    expect(indexingPageFixed('canonical_elsewhere', f({ status: 404, text: '' }), true).fixed).toBe(false);
    expect(indexingPageFixed('canonical_elsewhere', f({ text: '' }), true)).toMatchObject({ fixed: false, unknown: true });
  });
  it('noindex: a 200 bot challenge page is "could not tell", not a fix', () => {
    expect(indexingPageFixed('noindex', f({ text: '<html><head><title>Just a moment...</title></head></html>' }), true)).toMatchObject({ fixed: false, unknown: true });
  });
  it('not_found: a redirect to another website is not a fix', () => {
    expect(indexingPageFixed('not_found', f({ redirectStatus: 301, finalUrl: 'https://elsewhere.com/x' }), true).fixed).toBe(false);
  });
  it('A1: a page not found in a sitemap read only in part is "could not tell"', () => {
    expect(indexingPageFixed('not_in_sitemap', f(), null)).toMatchObject({ fixed: false, unknown: true });
    expect(indexingPageFixed('redirect', f({ redirectStatus: 301, finalUrl: U('/x') }), null)).toMatchObject({ fixed: false, unknown: true });
  });
  it('A16: robots.txt that answers a login, a firewall or a web page cannot be read; a 404 is no rules', () => {
    expect(robotsFileState(403, 'Forbidden')).toBe('unreadable');
    expect(robotsFileState(200, '<!doctype html><html></html>')).toBe('unreadable');
    expect(robotsFileState(200, 'User-agent: *\nDisallow: /x', 'text/plain')).toBe('rules');
    expect(robotsFileState(404, '')).toBe('none');
    expect(robotsFileState(500, '')).toBe('server_error');
  });
});

describe('A3 / A13 / X6 / A25: pages not checked, or left out for an unknown reason, are never "In search"', () => {
  const d = buildIndexingData({
    rows: [page('/', { state: 'indexed', action: 'none' }), page('/a', { state: 'error', cause: 'not_checked', action: 'none' }), page('/b', { cause: 'unclassified', action: 'none' })],
    runs: [{ run_at: '2026-10-29T09:00:00Z', known: 3, inspected: 3 }],
    events: [],
    impacts: [],
    settings: S,
  });
  it('a failed check is its own group, an unclassified reason asks the client to look in Search Console', () => {
    const g = d.groups.map((x) => [x.action, x.cause, INDEX_ACTION_INFO[x.action].label]);
    expect(g.every((x) => x[2] !== 'In search')).toBe(true);
    expect(d.groups.find((x) => x.cause === 'not_checked')?.action).toBe('retry');
    expect(d.groups.find((x) => x.cause === 'unclassified')).toMatchObject({ action: 'review', label: INDEX_CAUSE_INFO.unclassified.label });
    expect(d.totals.needYou).toBe(1);
  });
  it('A25: a failed check is not counted as checked', () => {
    expect(d.totals.checked).toBe(2);
    expect(d.totals.errors).toBe(1);
  });
});

describe('A4: a run that could not read Search Console says so and is not "checked"', () => {
  it('no page yet: status "failed" with the engine\'s note', () => {
    const d = buildIndexingData({ rows: [], runs: [{ run_at: '2026-10-29T09:00:00Z', known: 0, note: 'Search Console refused access for this property, so pages were not checked.' }], events: [], impacts: [], settings: S });
    expect(d.status).toBe('failed');
    expect(d.checkedAt).toBeNull();
    expect(d.notice).toMatchObject({ tone: 'warning', failed: true, accessLost: true });
    expect(d.notice!.text).toContain('refused access');
  });
  it('pages from an earlier check: those figures, dated by that check, with the warning', () => {
    const d = buildIndexingData({
      rows: [page('/', { state: 'indexed', action: 'none' })],
      runs: [{ run_at: '2026-10-29T09:00:00Z', known: 0, note: 'diagnosis failed: TypeError x is undefined' }, { run_at: '2026-10-28T09:00:00Z', known: 1, indexed: 1, inspected: 1 }],
      events: [],
      impacts: [],
      settings: S,
    });
    expect(d.status).toBe('ok');
    expect(d.checkedAt).toBe('2026-10-28T09:00:00Z');
    expect(d.notice?.failed).toBe(true);
    expect(d.notice?.text).not.toContain('TypeError');
  });
});

describe('A5 / fix_seen_at: a step fixed on the site is never reopened by Google\'s older reading', () => {
  const stored = (o: Partial<StoredSiteTask> = {}): StoredSiteTask => ({ key: 'indexing:noindex', kind: 'indexing', payload: { cause: 'noindex', urls: [U('/s')], total: 1 }, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: '2026-10-01T00:00:00.000Z', ...o });
  const inputs = (rows: Partial<IndexPageRow>[], runAt = '2026-10-29T09:15:00.000Z'): SiteTaskInputs => ({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt, causes: indexingCauseReadings(rows) } });
  it('the engine\'s weekly re-fetch (fetch_at) does not date Google\'s reading', () => {
    const own = { at: '2026-10-28T12:00:00.000Z', ok: true, by: 'you' as const, message: 'ok' };
    const t = deriveSiteTasks(inputs([page('/s', { cause: 'noindex', action: 'site_fix', inspect_at: '2026-10-20T06:00:00.000Z', fetch_at: '2026-10-29T09:15:00.000Z' })]), [stored({ lastCheck: own, doneAt: own.at })]);
    expect(t[0]).toMatchObject({ state: 'done', reopened: false });
  });
  it('every page seen fixed after Google\'s reading: done, waiting for Google, and it says so', () => {
    const rows = [page('/s', { cause: 'noindex', action: 'wait', inspect_at: '2026-10-20T06:00:00.000Z', fix_seen_at: '2026-10-29T09:15:00.000Z' })];
    const t = deriveSiteTasks(inputs(rows), [stored()])[0];
    expect(t.state).toBe('done');
    expect(t.detail).toContain('Google shows its older reading');
    // the Indexing page puts it in its own group, not under "Remove the noindex"
    const d = buildIndexingData({ rows, runs: [], events: [], impacts: [], settings: S });
    expect(d.groups.map((g) => g.cause)).toEqual(['fixed_on_site']);
  });
  it('A6: a cause read only in part never reads as done', () => {
    const rows = [page('/s', { cause: 'noindex', action: 'wait', inspect_at: '2026-10-20T06:00:00.000Z', fix_seen_at: '2026-10-29T09:15:00.000Z' })];
    const t = deriveSiteTasks({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt: '2026-10-29T09:15:00.000Z', causes: indexingCauseReadings(rows, { capped: new Set(['noindex']) }) } }, [stored()])[0];
    expect(t.state).toBe('todo');
  });
});

describe('A7 / A8: one page one ask, and a done step says what is true', () => {
  it('a not-found step whose pages are all redirect steps is not "done"; it is not a step at all', () => {
    const t = deriveSiteTasks(
      { domain: D, indexnow: null, access: null, reclaim: { receivedAt: '2026-10-29T00:00:00.000Z', items: [{ brokenUrl: U('/old'), redirectTo: U('/'), links: 4, domains: [] }] }, indexing: { runAt: '2026-10-29T09:15:00.000Z', causes: indexingCauseReadings([page('/old', { cause: 'not_found', action: 'site_fix', inspect_at: '2026-10-29T09:15:00.000Z' })]) } },
      [{ key: 'indexing:not_found', kind: 'indexing', payload: { cause: 'not_found', urls: [U('/old')], total: 1 }, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: '2026-10-01T00:00:00.000Z' }],
    );
    expect(t.find((x) => x.key === 'indexing:not_found')).toBeUndefined();
  });
  it('A8: a step our check found fixed says what we checked, never "Google can now read"', () => {
    const own = { at: '2026-10-28T12:00:00.000Z', ok: true, by: 'you' as const, message: 'ok' };
    const t = deriveSiteTasks({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt: '2026-10-27T00:00:00.000Z', causes: indexingCauseReadings([page('/x', { cause: 'access_denied', action: 'site_fix', inspect_at: '2026-10-26T00:00:00.000Z' })]) } }, [
      { key: 'indexing:access_denied', kind: 'indexing', payload: { cause: 'access_denied', urls: [U('/x')], total: 1 }, lastCheck: own, doneAt: own.at, skippedAt: null, skippedBy: null, createdAt: '2026-10-01T00:00:00.000Z' },
    ])[0];
    expect(t.state).toBe('done');
    expect(t.detail).toContain('open for everyone (200)');
    expect(t.detail).not.toContain('Google can now');
  });
});

describe('A9 / A10 / A11 / A12 / A19: the figures', () => {
  it('A9: the hero counts the pages Google gave a reading of, and says how many are not checked yet (page and report alike)', () => {
    const rows = [page('/', { state: 'indexed', action: 'none' }), page('/a', { cause: 'discovered_not_crawled', action: 'links' }), ...Array.from({ length: 50 }, (_, i) => page(`/u${i}`, { state: 'unknown', cause: '', action: '' }))];
    const d = buildIndexingData({ rows, runs: [], events: [], impacts: [], settings: S });
    expect(d.totals.shouldBe).toBe(2);
    expect(indexInSearchLine({ indexed: d.totals.indexed, shouldBe: d.totals.shouldBe, known: d.totals.known, notChecked: d.totals.unknown + d.totals.errors })).toBe('Google has 1 of the 2 pages we checked that should be in search (50 not checked yet)');
  });
  it('A10: days to finish from the configured cap, not a run that stopped at the quota after 2 probes', () => {
    const rows = Array.from({ length: 3000 }, (_, i) => page(`/p${i}`, { state: 'unknown' }));
    const d = buildIndexingData({ rows, runs: [{ run_at: '2026-10-29T09:00:00Z', backlog_left: 3000, inspected: 2, known: 3000 }], events: [], impacts: [], settings: S });
    expect(d.totals.daysToFinish).toBe(10);
  });
  it('A11: a rollout older than the engine\'s freeze window does not freeze the page when the run says no freeze', () => {
    const d = buildIndexingData({ rows: [page('/x', { cause: 'crawled_not_indexed', action: 'quality' })], runs: [{ run_at: '2026-10-29T09:00:00Z', freeze: false, known: 1, inspected: 1 }], events: [{ event_id: 'e', kind: 'core', status: 'rolling_out', title: 'June 2026 core update', started_at: '2026-06-01' }], impacts: [], settings: S });
    expect(d.freeze.on).toBe(false);
  });
  it('A12: update impact rows are read by the engine\'s `segment`', () => {
    const i = updateImpactOf({ event_id: 'e', pages_json: JSON.stringify([{ url: U('/a'), segment: 'dropped', state: 'indexed', before_clicks: 9, after_clicks: 1 }]) });
    expect(i.rows[0].segment).toBe('dropped');
  });
  it('A19: a paged group follows the summary\'s rule (never-checked pages are not in a group)', () => {
    const rows = [page('/c', { cause: 'crawled_not_indexed', action: 'quality' }), page('/u', { state: 'unknown', cause: '', action: 'none' })];
    expect(indexPagesPage(rows, { action: 'none' }).total).toBe(0);
  });
  it('X15: the in-search pages can come as counts from the run; every figure stays the same', () => {
    const rows = [page('/', { state: 'indexed', action: 'none' }), page('/n', { lane: 'new', state: 'indexed', action: 'none' }), page('/a', { cause: 'noindex', action: 'site_fix' }), page('/m', { state: 'indexed', cause: 'indexed_not_in_sitemap', action: 'site_fix' })];
    const full = buildIndexingData({ rows, runs: [], events: [], impacts: [], settings: S });
    const slim = buildIndexingData({ rows: rows.filter((r) => r.state !== 'indexed' || r.cause === 'indexed_not_in_sitemap'), runs: [], events: [], impacts: [], settings: S, indexedCounts: { all: 3, newLane: 1 } });
    expect(slim.totals).toEqual(full.totals);
    expect(slim.lanes).toEqual(full.lanes);
  });
});

describe('X5 / X8: the sitemap step and "Ask Google to read it"', () => {
  it('X5: a run that reads no submitted sitemap raises the step; the next run with one ticks it off', () => {
    const runs = [{ run_at: '2026-10-29T09:00:00Z', known: 2, inspected: 2, sitemaps_json: JSON.stringify({ submitted: 0, submitted_errors: 0, read: 1, capped: false, errors: [] }) }];
    const sm = indexingSitemapReading(runs);
    const t = deriveSiteTasks({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt: '2026-10-29T09:00:00Z', causes: [], sitemap: sm } }, []);
    expect(t[0]).toMatchObject({ key: 'indexing:sitemap', state: 'todo', guide: 'index-submit-sitemap' });
    expect(guideById('index-submit-sitemap')).toBeTruthy();
  });
  it('X8: up to 5 pages to ask Google about, never one left out on purpose, with its guide', () => {
    const rows = [page('/new', { lane: 'new', cause: 'wait_new', action: 'wait', ask_google: true }), page('/tag/x', { state: 'excluded', cause: 'low_value', action: 'leave_out', ask_google: true })];
    const d = buildIndexingData({ rows, runs: [], events: [], impacts: [], settings: S });
    expect(d.askGoogle.map((p) => p.path)).toEqual(['/new']);
    expect(guideForRecommendation('ix:ask_google')).toBe('index-request-indexing');
    expect(guideById('index-request-indexing')!.done).toContain('never send this request for you');
  });
  it('partial sitemap read in the newest run is flagged for the page', () => {
    const d = buildIndexingData({ rows: [page('/a', { cause: 'noindex', action: 'site_fix' })], runs: [{ run_at: '2026-10-29T09:00:00Z', known: 1, inspected: 1, sitemaps_json: JSON.stringify({ submitted: 1, read: 2, capped: true, errors: [] }) }], events: [], impacts: [], settings: S });
    expect(d.sitemapPartial).toBe(true);
  });
});

describe('A24 / A26 / X10', () => {
  it('A24: an audit finding stands in for an indexing step only when it asks the same fix', () => {
    expect(findingAsksSameFix('redirect', 'crawlability|redirect chains on # pages')).toBe(false);
    expect(findingAsksSameFix('redirect', 'sitemap|# redirected urls listed in the sitemap')).toBe(true);
    expect(findingAsksSameFix('noindex', 'sitemap|sitemap missing')).toBe(false);
  });
  it('A26 (FIX_CONTRACT decision 10): the index report follows the weekly site report\'s delivery rule; drop-outs raise the same alert event', () => {
    const settings = { ...DEFAULT_DELIVERY_SETTINGS, frequency: 'weekly' as const, email: { ...DEFAULT_DELIVERY_SETTINGS.email, enabled: true } };
    const ix = deliveryDecisionFor({ stage: 'index_coverage', status: 'complete', payload: {} }, settings);
    const st = deliveryDecisionFor({ stage: 'site_tracker', status: 'progress', payload: {} }, settings);
    expect(ix.deliver).toBe(st.deliver);
    const chosen = { ...settings, stages: ['site_tracker'] };
    expect(deliveryDecisionFor({ stage: 'index_coverage', status: 'complete', payload: {} }, chosen).deliver).toBe(false);
    const ev = eventsFor({ stage: 'index_coverage', status: 'complete', payload: { summary: { dropped: [{ url: U('/a'), cause: 'noindex' }] } }, report: { id: 'r', title: 't', stage: 'index_coverage', status: 'complete', receivedAt: '', scheduled: true, runId: null, websiteId: null, url: '' }, runBefore: null, runAfter: null });
    expect(ev.map((e) => e.type)).toEqual(['report.ready', 'alert.raised']);
  });
  it('X10: the daily index check is a measured schedule with no built-in start (counted from its first run row)', () => {
    expect(SCHEDULES).toContain(INDEX_COVERAGE_SCHEDULE);
    expect(INDEX_COVERAGE_SCHEDULE).toMatchObject({ workflow: 'SEOagentIndexCv1', schedule: { kind: 'daily', hour: 5, minute: 15 } });
    expect(INDEX_COVERAGE_SCHEDULE.since).toBeUndefined();
  });
});
