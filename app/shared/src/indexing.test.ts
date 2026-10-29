import { describe, expect, it } from 'vitest';
import {
  buildIndexingData,
  headerNoindex,
  improveKeywordOf,
  INDEX_CAUSE_INFO,
  INDEX_CAUSES,
  INDEX_SITE_FIX_CAUSES,
  indexingCauseOfKey,
  indexingCauseReadings,
  indexingPageFixed,
  indexPagesPage,
  INDEXING_TASK_MAX_URLS,
  metaNoindex,
  pageCanonicalOf,
  rollingOutEvent,
  googleEventOf,
  samePageUrl,
  sitemapLocs,
  isSitemapIndex,
  visibleWords,
  type IndexSiteFixCause,
} from './indexing';
import { deriveSiteTasks, siteTaskCheckLine, siteTaskKindOfKey, siteTaskPayload, SITE_TASK_KINDS, type SiteTaskInputs, type StoredSiteTask } from './site-tasks';
import { GUIDE_FOR_NEEDS_YOU_KIND, guideById, guideForNeedsYou, guideForRecommendation, INDEXING_GUIDE } from './guides';
import { monitorsBody, siteAdminMonitorsBody } from './payload';
import { monitorSettingsSchema } from './schemas';
import { finishedStatus, deliveryDecision } from './report-delivery';
import { eventsFor } from './integrations';
import type { IndexPageRow } from './tables';

// Index coverage (2026-10-29, n8n/seo-agent/docs/indexing-2026-10-29/DESIGN.md): the codes the engine writes, read the one way the app
// reads them; the steps on the client's website for each cause only the client can fix; the app's own check of those steps; the guides,
// the settings body and the callback. Client text anonymised (novaand-demo.com).

const D = 'novaand-demo.com';
const U = (p: string) => `https://www.${D}${p}`;
const row = (url: string, o: Partial<IndexPageRow> = {}): Partial<IndexPageRow> => ({ site_id: 'site_novaand-demo-com', domain: D, url: U(url), lane: 'existing', state: 'not_indexed', ...o });

describe('the page figures (buildIndexingData)', () => {
  const rows = [
    row('/a', { state: 'indexed', cause: 'indexed', action: 'none', impressions_28d: 40 }),
    row('/b', { state: 'indexed', cause: 'indexed', action: 'none', lane: 'new' }),
    row('/c', { cause: 'noindex', action: 'site_fix', impressions_28d: 5, inspect_at: '2026-10-28T06:00:00Z' }),
    row('/d', { cause: 'noindex', action: 'site_fix', impressions_28d: 50, inspect_at: '2026-10-27T06:00:00Z' }),
    row('/e', { cause: 'crawled_not_indexed', action: 'quality' }),
    row('/tag/x', { state: 'excluded', cause: 'low_value', action: 'leave_out' }),
    row('/f', { state: 'unknown', cause: '', action: '' }),
    row('/g', { lane: 'new', cause: 'wait_new', action: 'wait' }),
    row('/h', { cause: 'brand_new_code', action: 'links' }),
    row('/i', { state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links', dropped_at: '2026-10-26T00:00:00Z', link_from: JSON.stringify([{ url: U('/a'), title: 'A' }, { url: 'javascript:alert(1)', title: 'bad' }]) }),
  ];
  const d = buildIndexingData({ rows, runs: [{ run_at: '2026-10-28T07:00:00Z', backlog_left: 600, inspected: 300, by_cause_json: '{"noindex":2}' }], events: [], impacts: [], settings: { on: true, dailyCap: 300 } });

  it('counts the pages that should be in search apart from those left out on purpose', () => {
    expect(d.status).toBe('ok');
    expect(d.totals.known).toBe(10);
    expect(d.totals.shouldBe).toBe(9);
    expect(d.totals.indexed).toBe(2);
    expect(d.totals.needYou).toBe(5); // 2 site fixes, 1 quality, 2 links (one an unknown code)
    expect(d.totals.unknown).toBe(1);
    expect(d.lanes.new.known).toBe(2);
    expect(d.totals.backlogLeft).toBe(600);
    expect(d.totals.daysToFinish).toBe(2);
  });

  it('groups by lane, action and cause, site fixes first, most impressions first inside a group', () => {
    expect(d.groups[0].id).toBe('existing:site_fix:noindex');
    expect(d.groups[0].count).toBe(2);
    expect(d.groups[0].pages.map((p) => p.path)).toEqual(['/d', '/c']);
    expect(d.groups[0].taskKey).toBe('indexing:noindex');
    expect(d.groups[0].guide).toBe('index-remove-noindex');
    // a page not checked yet is the backlog the hero counts, not a group; an indexed page is not a group either
    expect(d.groups.some((g) => g.pages.some((p) => p.path === '/f' || p.path === '/a'))).toBe(false);
    // a code the app does not know is "Other", never dropped
    expect(d.groups.find((g) => g.cause === 'other')?.count).toBe(1);
  });

  it('lists drop-outs and keeps only safe link suggestions', () => {
    expect(d.dropped.map((p) => p.path)).toEqual(['/i']);
    expect(d.dropped[0].linkFrom).toEqual([{ url: U('/a'), title: 'A' }]);
  });

  it('is empty before any check, and frozen while a core update rolls out', () => {
    expect(buildIndexingData({ rows: [], runs: [], events: [], impacts: [], settings: { on: true, dailyCap: 300 } }).status).toBe('empty');
    const f = buildIndexingData({ rows, runs: [], events: [{ event_id: 'e1', kind: 'core', status: 'rolling_out', title: 'October 2026 core update', started_at: '2026-10-20' }], impacts: [], settings: { on: true, dailyCap: 300 } });
    expect(f.freeze.on).toBe(true);
    expect(f.rollingOut?.title).toBe('October 2026 core update');
    expect(rollingOutEvent([googleEventOf({ event_id: 'p', kind: 'policy_doc', status: 'rolling_out' })])).toBeNull();
    expect(buildIndexingData({ rows, runs: [{ run_at: '2026-10-28', freeze: true, freeze_reason: 'Spam update' }], events: [], impacts: [], settings: { on: true, dailyCap: 300 } }).freeze).toEqual({ on: true, reason: 'Spam update' });
  });

  it('pages a group with the same order', () => {
    const many = Array.from({ length: 60 }, (_, i) => row(`/p${i}`, { cause: 'not_found', action: 'site_fix', impressions_28d: i }));
    const p2 = indexPagesPage(many, { lane: 'existing', action: 'site_fix', cause: 'not_found', page: 2, pageSize: 25 });
    expect(p2.total).toBe(60);
    expect(p2.items[0].path).toBe('/p34');
    expect(indexPagesPage(many, { cause: 'noindex' }).total).toBe(0);
  });
});

describe('the steps on the website (kind "indexing")', () => {
  const readings = indexingCauseReadings([
    ...Array.from({ length: 30 }, (_, i) => row(`/n${i}`, { cause: 'noindex', action: 'site_fix', impressions_28d: i, inspect_at: `2026-10-${String(10 + (i % 15)).padStart(2, '0')}T06:00:00Z` })),
    row('/old', { cause: 'not_found', action: 'site_fix', fetch_at: '2026-10-27T05:00:00Z' }),
    row('/gone', { cause: 'not_found', action: 'leave_out' }),
    row('/q', { cause: 'crawled_not_indexed', action: 'quality' }),
  ]);
  const inputs = (o: Partial<SiteTaskInputs> = {}): SiteTaskInputs => ({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt: '2026-10-28T07:00:00Z', causes: readings }, ...o });

  it('groups only the site fixes, by cause, 25 addresses at most, most important first', () => {
    expect(readings.map((r) => r.cause).sort()).toEqual(['noindex', 'not_found']);
    const nx = readings.find((r) => r.cause === 'noindex')!;
    expect(nx.total).toBe(30);
    expect(nx.urls).toHaveLength(INDEXING_TASK_MAX_URLS);
    expect(nx.urls[0]).toBe(U('/n29'));
    expect(nx.readAt).toBe('2026-10-24T06:00:00Z');
  });

  it('one step per cause, important when it keeps Google out, its payload capped with the count', () => {
    const tasks = deriveSiteTasks(inputs(), []);
    const nx = tasks.find((t) => t.key === 'indexing:noindex')!;
    expect(nx.kind).toBe('indexing');
    expect(nx.state).toBe('todo');
    expect(nx.severity).toBe('warning');
    expect(nx.values).toHaveLength(5);
    expect(nx.guide).toBe('index-remove-noindex');
    expect(nx.detail).toContain('30 pages');
    expect(tasks.find((t) => t.key === 'indexing:not_found')!.severity).toBe('info');
    const p = siteTaskPayload(inputs(), [], 'indexing:noindex')!;
    expect(p.kind).toBe('indexing');
    expect((p.payload.urls as string[]).length).toBe(25);
    expect(p.payload.total).toBe(30);
  });

  it('never asks twice: a broken page that is already a redirect step leaves the indexing list', () => {
    const reclaim = { receivedAt: '2026-10-20T00:00:00Z', items: [{ brokenUrl: U('/old'), redirectTo: U('/'), links: 3, domains: ['a.com'] }] };
    const tasks = deriveSiteTasks(inputs({ reclaim }), []);
    expect(tasks.some((t) => t.key.startsWith('redirect:'))).toBe(true);
    expect(tasks.some((t) => t.key === 'indexing:not_found')).toBe(false);
  });

  it('done when the newest index run no longer lists the cause (only a run after the step was stored)', () => {
    const stored: StoredSiteTask = { key: 'indexing:soft_404', kind: 'indexing', payload: { cause: 'soft_404', urls: [U('/s')], total: 1 }, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: '2026-10-25T00:00:00Z' };
    const done = deriveSiteTasks(inputs(), [stored]).find((t) => t.key === 'indexing:soft_404')!;
    expect(done.state).toBe('done');
    expect(done.lastCheck?.by).toBe('index');
    const early = deriveSiteTasks(inputs({ indexing: { runAt: '2026-10-24T00:00:00Z', causes: [] } }), [stored]).find((t) => t.key === 'indexing:soft_404')!;
    expect(early.state).toBe('todo');
    expect(early.lastCheck).toBeNull();
  });

  it('the newest reading decides: our own check after the engine last read the pages wins, a newer engine reading reopens', () => {
    const own = { at: '2026-10-28T10:00:00Z', ok: true, message: 'fixed', by: 'you' as const };
    const stored: StoredSiteTask = { key: 'indexing:noindex', kind: 'indexing', payload: {}, lastCheck: own, doneAt: own.at, skippedAt: null, skippedBy: null, createdAt: '2026-10-01T00:00:00Z' };
    expect(deriveSiteTasks(inputs(), [stored]).find((t) => t.key === 'indexing:noindex')!.state).toBe('done');
    const later = indexingCauseReadings([row('/n1', { cause: 'noindex', action: 'site_fix', inspect_at: '2026-10-29T06:00:00Z' })]);
    const t = deriveSiteTasks(inputs({ indexing: { runAt: '2026-10-29T07:00:00Z', causes: later } }), [stored]).find((x) => x.key === 'indexing:noindex')!;
    expect(t.state).toBe('todo');
    expect(t.reopened).toBe(true);
  });

  it('a key no kind makes is never read as a redirect (the old else-branch)', () => {
    expect(siteTaskKindOfKey('indexing:noindex')).toBe('indexing');
    expect(siteTaskKindOfKey('indexing:made_up')).toBeNull();
    expect(siteTaskKindOfKey('something:else')).toBeNull();
    expect(siteTaskKindOfKey('redirect:novaand-demo.com/x')).toBe('redirect');
    expect(siteTaskPayload(inputs(), [], 'something:else')).toBeNull();
    expect(siteTaskPayload(inputs(), [], 'indexing:made_up')).toBeNull();
    expect(indexingCauseOfKey('indexing:robots_blocked')).toBe('robots_blocked');
    expect(SITE_TASK_KINDS).toContain('indexing');
  });

  it('says who read it', () => {
    expect(siteTaskCheckLine({ at: '2026-10-28T00:00:00Z', ok: false, message: '', by: 'index' }, () => '28 Oct')).toBe('Daily index check on 28 Oct');
  });

  it('a website with no index check keeps its other steps as before', () => {
    const before = deriveSiteTasks({ domain: D, indexnow: null, access: null, reclaim: null }, []);
    expect(before).toEqual([]);
  });
});

describe("the app's own check of one page", () => {
  const f = (o: Partial<Parameters<typeof indexingPageFixed>[1]> = {}) => ({ url: U('/p'), status: 200, finalUrl: U('/p'), redirectStatus: 0, text: '<html><head></head><body>hi</body></html>', ...o });
  it('reads noindex in the page and in the header (not another crawler\'s)', () => {
    expect(metaNoindex('<meta name="robots" content="noindex, follow">')).toBe(true);
    expect(metaNoindex("<meta content='none' name='googlebot'>")).toBe(true);
    expect(metaNoindex('<meta name="description" content="noindex is a word">')).toBe(false);
    expect(headerNoindex('noindex')).toBe(true);
    expect(headerNoindex(['googlebot: noindex'])).toBe(true);
    expect(headerNoindex('otherbot: noindex')).toBe(false);
    expect(indexingPageFixed('noindex', f({ xRobotsTag: 'noindex' }), true).fixed).toBe(false);
    expect(indexingPageFixed('noindex', f({ text: '<meta name="robots" content="noindex">' }), true).why).toContain('robots meta tag');
    expect(indexingPageFixed('noindex', f(), true).fixed).toBe(true);
  });
  it('not found: open, a permanent redirect, or out of the sitemap; a temporary redirect is not enough', () => {
    expect(indexingPageFixed('not_found', f({ status: 404 }), true).fixed).toBe(false);
    expect(indexingPageFixed('not_found', f({ status: 404 }), false).fixed).toBe(true);
    expect(indexingPageFixed('not_found', f({ redirectStatus: 301, finalUrl: U('/new') }), true).fixed).toBe(true);
    expect(indexingPageFixed('not_found', f({ redirectStatus: 302, finalUrl: U('/new') }), true).fixed).toBe(false);
  });
  it('the other causes', () => {
    expect(indexingPageFixed('server_error', f({ status: 503 }), null).fixed).toBe(false);
    expect(indexingPageFixed('server_error', f(), null).fixed).toBe(true);
    expect(indexingPageFixed('access_denied', f({ status: 403 }), true).fixed).toBe(false);
    expect(indexingPageFixed('access_denied', f({ status: 403 }), false).fixed).toBe(true);
    expect(indexingPageFixed('soft_404', f({ status: 410 }), null).fixed).toBe(true);
    expect(indexingPageFixed('soft_404', f(), null).fixed).toBe(false);
    expect(indexingPageFixed('soft_404', f({ text: `<p>${'word '.repeat(200)}</p>` }), null).fixed).toBe(true);
    expect(indexingPageFixed('redirect', f({ redirectStatus: 301, finalUrl: U('/x') }), true).fixed).toBe(false);
    expect(indexingPageFixed('redirect', f({ redirectStatus: 301, finalUrl: U('/x') }), false).fixed).toBe(true);
    expect(indexingPageFixed('canonical_elsewhere', f({ text: `<link rel="canonical" href="${U('/other')}">` }), true).fixed).toBe(false);
    expect(indexingPageFixed('canonical_elsewhere', f({ text: '<link rel="canonical" href="/p/">' }), true).fixed).toBe(true);
    expect(indexingPageFixed('not_in_sitemap', f(), true).fixed).toBe(true);
    expect(indexingPageFixed('indexed_not_in_sitemap', f(), false).fixed).toBe(false);
  });
  it('helpers read addresses, sitemaps and words the forgiving way', () => {
    expect(pageCanonicalOf('<link href="/a" rel="canonical">', U('/b'))).toBe(U('/a'));
    expect(samePageUrl('https://novaand-demo.com/a/', U('/a'))).toBe(true);
    expect(samePageUrl(U('/a'), U('/b'))).toBe(false);
    expect(sitemapLocs('<urlset><url><loc> https://x.com/a?b=1&amp;c=2 </loc></url><url><loc><![CDATA[https://x.com/b]]></loc></url></urlset>')).toEqual(['https://x.com/a?b=1&c=2', 'https://x.com/b']);
    expect(isSitemapIndex('<?xml version="1.0"?><sitemapindex>')).toBe(true);
    expect(visibleWords('<nav>one two</nav><p>three four</p><script>var x</script>')).toBe(2);
  });
});

describe('the words and the guides', () => {
  const BANNED = /[–—‘’“”…!]|\.\.\.|get indexed|guarantee|instant/i;
  it('every cause has plain words without AI tells or promises', () => {
    for (const c of INDEX_CAUSES) for (const t of Object.values(INDEX_CAUSE_INFO[c]).filter((v) => typeof v === 'string')) expect(t, c).not.toMatch(BANNED);
  });
  it('every cause only the client can fix has a step title and a guide that exists, the same in guide-links', () => {
    for (const c of INDEX_SITE_FIX_CAUSES) {
      const info = INDEX_CAUSE_INFO[c];
      expect(info.action, c).toBe('site_fix');
      expect(info.taskTitle, c).toBeTruthy();
      expect(guideById(info.guide!), c).toBeTruthy();
      expect(INDEXING_GUIDE[c], c).toBe(info.guide);
      expect(guideForNeedsYou({ id: `task:indexing:${c}`, kind: 'site_task', severity: 'warning' })).toBe(info.guide);
      expect(guideForRecommendation(`ix:site_fix:${c}`)).toBe(info.guide);
    }
    expect(guideById('index-coverage')).toBeTruthy();
    expect(guideForRecommendation('ix:quality:crawled_not_indexed')).toBe('index-coverage');
    expect(GUIDE_FOR_NEEDS_YOU_KIND.site_task).toBeTruthy();
  });
  it('the "Improve this page" form starts from the page title, else its slug', () => {
    expect(improveKeywordOf('E-invoicing in the UAE | Nova&', U('/x'))).toBe('E-invoicing in the UAE');
    expect(improveKeywordOf('', U('/blog/peppol-guide-2026/'))).toBe('peppol guide 2026');
  });
});

describe('settings, the callback and its events', () => {
  it('sends the two fields last and only when set (old bodies are unchanged)', () => {
    expect(monitorsBody({ backlinks: true })).toEqual({ backlinks: true });
    const b = siteAdminMonitorsBody({ backlinks: true, indexWatch: false, indexDailyCap: 500 });
    expect(Object.keys(b).slice(-2)).toEqual(['index_watch', 'index_daily_cap']);
    expect(b.index_watch).toBe(false);
    expect(b.index_daily_cap).toBe(500);
    expect(monitorSettingsSchema.safeParse({ indexDailyCap: 10 }).success).toBe(false);
    expect(monitorSettingsSchema.safeParse({ indexDailyCap: 1201 }).success).toBe(false);
    expect(monitorSettingsSchema.parse({}).indexWatch).toBeUndefined();
  });
  it('the callback is a finished report (status complete) and a drop-out raises an alert', () => {
    expect(finishedStatus('index_coverage', 'complete')).toBe(true);
    expect(finishedStatus('content', 'complete')).toBe(false);
    expect(deliveryDecision({ stage: 'index_coverage', status: 'complete', payload: {} }).deliver).toBe(true);
    const ev = eventsFor({
      stage: 'index_coverage',
      status: 'complete',
      payload: { summary: { dropped: [{ url: U('/a'), at: '2026-10-28', cause: 'noindex' }] } },
      report: { id: 'r', title: 't', stage: 'index_coverage', status: 'complete', receivedAt: '2026-10-28', scheduled: true, runId: null, websiteId: 's', url: 'https://app/x' },
      runBefore: null,
      runAfter: null,
    } as never);
    expect(ev.map((e) => e.type)).toEqual(['report.ready', 'alert.raised']);
    expect(String((ev[1].data.alerts as { text: string }[])[0].text)).toContain('/a');
  });
});

// keep the type import used
export type _Cause = IndexSiteFixCause;
