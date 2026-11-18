import { describe, expect, it } from 'vitest';
import {
  buildIndexingData,
  indexingIssueItems,
  indexingNotNeededLine,
  indexingPageFixed,
  indexingSupersedesAudit,
  indexIssueKey,
  indexPageOf,
  indexReasonGroups,
  indexReasonOf,
  indexResolvedPages,
  indexResolvedSteps,
  indexValidationLine,
  indexValidationOf,
  INDEXING_FETCHES_PAGES,
  permanentMoveLands,
} from './indexing';
import { deriveSiteTasks, SITE_TASK_NOT_NEEDED_LABEL, type SiteTaskInputs, type StoredSiteTask } from './site-tasks';
import type { IndexPageRow } from './tables';

// CR17-C (client report 2026-11-17, devaicon.com): F3 (a sitemap step on an address that now redirects closes as "not needed") and Q1 (Index
// coverage owns indexing asks: reasons as Google names them, what to do now, validation like Search Console, "Resolved recently").
const W = 'https://dev.example';
const NOW = Date.parse('2026-11-17T12:00:00Z');
const day = (d: number) => new Date(NOW - d * 864e5).toISOString();
const row = (o: Partial<IndexPageRow>): Partial<IndexPageRow> => ({ site_id: 'site_dev-example', in_sitemap: true, lane: 'existing', action: 'none', cause: '', ...o });
const fetch301 = (url: string, to: string, status = 301) => ({ url, status: 200, finalUrl: to, redirectStatus: status, text: '<html><head><title>x</title></head><body>x</body></html>' });

describe('F3: a sitemap step on an address that now redirects', () => {
  it('opens the page for both sitemap causes', () => {
    expect(INDEXING_FETCHES_PAGES.has('indexed_not_in_sitemap')).toBe(true);
    expect(INDEXING_FETCHES_PAGES.has('not_in_sitemap')).toBe(true);
  });
  it('a permanent redirect to another page of the site: not needed any more (never "add it", never "fixed by you")', () => {
    const v = indexingPageFixed('indexed_not_in_sitemap', fetch301(`${W}/capabilities/consulting-transformation`, `${W}/services/capabilities-consulting-transformation`), false);
    expect(v).toEqual({ fixed: true, notNeeded: true, why: '/capabilities/consulting-transformation now redirects to /services/capabilities-consulting-transformation, so it does not belong in your sitemap. Nothing to do.' });
    expect(indexingPageFixed('indexed_not_in_sitemap', fetch301(`${W}/a`, `${W}/b`, 308), false).notNeeded).toBe(true);
  });
  it('a temporary redirect, another website, or a page that opens: the old rule (listed in the sitemap or not)', () => {
    expect(indexingPageFixed('indexed_not_in_sitemap', fetch301(`${W}/a`, `${W}/b`, 302), false)).toEqual({ fixed: false, why: '/a is not in your sitemap yet.' });
    expect(indexingPageFixed('indexed_not_in_sitemap', fetch301(`${W}/a`, 'https://other.example/b'), false).notNeeded).toBeUndefined();
    expect(indexingPageFixed('indexed_not_in_sitemap', { url: `${W}/a`, status: 200, finalUrl: `${W}/a`, redirectStatus: 0, text: '<html><head></head></html>' }, true)).toEqual({ fixed: true, why: '/a is in your sitemap.' });
  });
  it('CR17-FX-INDEX H1: a permanent redirect into a broken page is never "not needed" (404, 5xx, noindex, home page)', () => {
    const to404 = { ...fetch301(`${W}/a`, `${W}/b`), status: 404 };
    expect(indexingPageFixed('indexed_not_in_sitemap', to404, false)).toEqual({ fixed: false, why: '/a redirects to /b, which answers 404. Point the redirect at a page that opens.' });
    expect(indexingPageFixed('not_in_sitemap', { ...to404, status: 500 }, false).fixed).toBe(false);
    const noidx = { ...fetch301(`${W}/a`, `${W}/b`), text: '<html><head><meta name="robots" content="noindex"></head><body>x</body></html>' };
    expect(indexingPageFixed('indexed_not_in_sitemap', noidx, false)).toEqual({ fixed: false, why: '/a redirects to /b, which tells Google not to index it. Point the redirect at a page Google may index.' });
    expect(indexingPageFixed('indexed_not_in_sitemap', { ...fetch301(`${W}/a`, `${W}/b`), xRobotsTag: 'noindex' }, false).notNeeded).toBeUndefined();
    expect(indexingPageFixed('indexed_not_in_sitemap', fetch301(`${W}/services/a`, `${W}/`), false)).toEqual({ fixed: false, why: '/services/a redirects to your home page. Point it at the page that replaced it.' });
    expect(permanentMoveLands(fetch301(`${W}/a`, `${W}/b`))).toBe(true);
    expect(permanentMoveLands(fetch301(`${W}/a`, `${W}/b`, 302))).toBe(false);
    expect(permanentMoveLands(to404)).toBe(false);
  });
  it('the step reads "Not needed any more" with the reason, not "Your sitemap lists these pages"', () => {
    const msg = indexingNotNeededLine(`${W}/a`, `${W}/b`);
    const inputs: SiteTaskInputs = { domain: 'dev.example', indexnow: null, access: null, reclaim: null, indexing: { runAt: day(1), causes: [{ cause: 'indexed_not_in_sitemap', total: 1, urls: [`${W}/a`], readAt: day(1), pending: 0, pendingAt: '', complete: true }] } } as unknown as SiteTaskInputs;
    const stored: StoredSiteTask[] = [{ key: 'indexing:indexed_not_in_sitemap', kind: 'indexing', payload: { cause: 'indexed_not_in_sitemap', urls: [`${W}/a`] }, lastCheck: { at: new Date(NOW).toISOString(), ok: true, by: 'you', message: msg, notNeeded: true }, doneAt: new Date(NOW).toISOString(), skippedAt: null, skippedBy: null, createdAt: day(4) } as unknown as StoredSiteTask];
    const t = deriveSiteTasks(inputs, stored).find((x) => x.key === 'indexing:indexed_not_in_sitemap')!;
    expect(t.state).toBe('done');
    expect(t.notNeeded).toBe(true);
    expect(t.detail).toBe(msg);
    expect(SITE_TASK_NOT_NEEDED_LABEL).toBe('Not needed any more');
  });
});

describe('Q1: validation like Search Console, from the fields we store', () => {
  const base = indexPageOf(row({ url: `${W}/x`, state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links' }));
  it('not started / waiting (a fix we saw, an improvement, an ask) / failed (Google read it after and still left it out) / passed', () => {
    expect(indexValidationOf(base, NOW).state).toBe('not_started');
    expect(indexValidationOf({ ...base, askedGoogleAt: day(2) }, NOW)).toMatchObject({ state: 'waiting', label: 'Waiting for Google' });
    expect(indexValidationOf({ ...base, askedGoogleAt: day(5), googleReadAfterAskAt: day(3) }, NOW)).toMatchObject({ state: 'failed', label: 'Failed' });
    expect(indexValidationOf({ ...base, fixSeenAt: day(1) }, NOW).state).toBe('waiting');
    expect(indexValidationOf({ ...base, fixFailedAt: day(1) }, NOW).state).toBe('failed');
    expect(indexValidationOf({ ...base, improvedWaiting: true, improvedAt: day(6) }, NOW).state).toBe('waiting');
    expect(indexValidationOf({ ...base, improvedReadAt: day(1) }, NOW).state).toBe('failed');
    expect(indexValidationOf({ ...base, state: 'indexed', indexedSince: day(3) }, NOW)).toMatchObject({ state: 'passed', label: 'Passed' });
    // an ask older than 45 days is history, not a running validation
    expect(indexValidationOf({ ...base, askedGoogleAt: day(60) }, NOW).state).toBe('not_started');
  });
});

describe('Q1: the reasons as Google names them, with what to do now', () => {
  const pages = [
    row({ url: `${W}/a`, state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links', priority: 2 }),
    row({ url: `${W}/services/b`, state: 'not_indexed', cause: 'wait_new', action: 'wait', lane: 'new', priority: 5 }),
    row({ url: `${W}/c`, state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality', fix_seen_at: '' }),
    row({ url: `${W}/d`, state: 'excluded', cause: 'noindex', action: 'site_fix' }),
    row({ url: `${W}/b-old`, in_sitemap: false, state: 'excluded', cause: 'redirect', action: 'leave_out', final_url: `${W}/services/b` }),
    row({ url: `${W}/tag/x`, state: 'excluded', cause: 'low_value', action: 'leave_out' }),
    row({ url: `${W}/e`, state: 'indexed' }),
  ].map(indexPageOf);
  it('files every page Google does not have in one family (in search: none)', () => {
    expect(pages.map((p) => indexReasonOf(p))).toEqual(['not_visited', 'not_visited', 'read_left_out', 'fault', 'moved', 'left_out', null]);
  });
  it('groups them, the pages old addresses moved to first, with a plain "what to do now"', () => {
    const g = indexReasonGroups(pages, [], NOW);
    expect(g.map((x) => x.reason)).toEqual(['fault', 'read_left_out', 'not_visited', 'moved', 'left_out']);
    const nv = g.find((x) => x.reason === 'not_visited')!;
    expect(nv.pages[0].path).toBe('/services/b');
    expect(nv.doNow).toMatch(/Rewriting a page Google has not read does not help/);
    expect(g.find((x) => x.reason === 'read_left_out')!.doNow).toMatch(/Do not move it to a new address/);
    expect(g.find((x) => x.reason === 'moved')!.doNow).toMatch(/Keep the redirects for at least a year/);
    expect(indexValidationLine({ waiting: 2, failed: 0, notStarted: 1, passed: 3 })).toBe('3 passed in the last 28 days, 2 waiting for Google, 1 not started.');
  });
  it('gives the recommendations one item per address, never for a page left out on purpose or a moved address', () => {
    const items = indexingIssueItems(pages, NOW);
    expect([...items.keys()].sort()).toEqual(['dev.example/a', 'dev.example/c', 'dev.example/d', 'dev.example/services/b']);
    expect(items.get(indexIssueKey(`https://www.dev.example/a/`))!.reason).toBe('not_visited');
  });
  it('Index coverage supersedes the audit\'s not-indexed finding once it has a reading (both data shapes)', () => {
    expect(indexingSupersedesAudit({ on: true, runAt: day(1) })).toBe(true);
    expect(indexingSupersedesAudit({ on: true, runAt: null })).toBe(false);
    expect(indexingSupersedesAudit({ on: false, runAt: day(1) })).toBe(false);
    expect(indexingSupersedesAudit(null)).toBe(false);
    const d = buildIndexingData({ rows: pages.map((p) => row({ url: p.url, state: p.state, cause: p.cause, action: p.action, inspect_at: day(1) })), runs: [], events: [], impacts: [], settings: { on: true, dailyCap: 300 }, now: NOW });
    expect(indexingSupersedesAudit(d)).toBe(true);
  });
});

describe('Q1: Resolved recently', () => {
  // devaicon.com: /about asked 2 Nov, in Google 3 Nov; /industries in Google on its own; /careers dropped out again; an old move is not one
  const hist = [
    { url: `${W}/about`, at: '2026-10-20T10:00:00Z', state: 'not_indexed', cause: 'discovered_not_crawled' },
    { url: `${W}/about`, at: '2026-11-03T10:15:00Z', state: 'indexed', cause: '' },
    { url: `${W}/industries`, at: '2026-10-29T10:00:00Z', state: 'not_indexed', cause: 'unknown_to_google' },
    { url: `${W}/industries`, at: '2026-11-11T10:15:00Z', state: 'indexed', cause: '' },
    { url: `${W}/careers`, at: '2026-11-01T10:00:00Z', state: 'not_indexed', cause: 'crawled_not_indexed' },
    { url: `${W}/careers`, at: '2026-11-05T10:00:00Z', state: 'indexed', cause: '' },
    { url: `${W}/careers`, at: '2026-11-13T10:00:00Z', state: 'not_indexed', cause: 'crawled_not_indexed' },
    { url: `${W}/old`, at: '2026-09-01T10:00:00Z', state: 'not_indexed', cause: 'unknown_to_google' },
    { url: `${W}/old`, at: '2026-10-01T10:00:00Z', state: 'indexed', cause: '' },
    { url: `${W}/first`, at: '2026-11-10T10:00:00Z', state: 'indexed', cause: '' },
  ];
  it('lists the pages that went into Google in the last 28 days and are still in, with the day the client asked', () => {
    const r = indexResolvedPages(hist, { [`${W}/about`]: '2026-11-02T09:00:00Z' }, NOW);
    expect(r.map((x) => x.line)).toEqual(['/industries: in Google 11 Nov (before: google has not found it yet)', '/about: asked 2 Nov, in Google 3 Nov']);
    expect(r[1].reason).toBe('not_visited');
  });
  it('lists the indexing steps that finished, a not-needed one said so', () => {
    const s = indexResolvedSteps([
      { key: 'indexing:indexed_not_in_sitemap', doneAt: day(1), notNeeded: true, message: '/a now redirects to /b, so it does not belong in your sitemap. Nothing to do.' },
      { key: 'indexing:merge', doneAt: day(2) },
      { key: 'indexnow', doneAt: day(1) },
      { key: 'indexing:noindex', doneAt: day(40) },
    ], NOW);
    expect(s.map((x) => x.key)).toEqual(['indexing:indexed_not_in_sitemap', 'indexing:merge']);
    expect(s[0].line).toMatch(/^In search, but missing from your sitemap: not needed any more \(16 Nov\)\./);
    expect(s[1].line).toBe('Improved pages redirected to their new address: done 15 Nov.');
  });
  it('rides on the Indexing page data, and each family counts what passed', () => {
    const d = buildIndexingData({ rows: [row({ url: `${W}/x`, state: 'not_indexed', cause: 'discovered_not_crawled', action: 'links' })], runs: [], events: [], impacts: [], settings: { on: true, dailyCap: 300 }, history: hist, askedByApp: { [`${W}/about`]: '2026-11-02T09:00:00Z' }, now: NOW });
    expect(d.resolved?.length).toBe(2);
    expect(d.reasons?.find((g) => g.reason === 'not_visited')?.validation.passed).toBe(2);
  });
});
