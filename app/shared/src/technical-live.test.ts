import { describe, expect, it } from 'vitest';
import { indexPageOf } from './indexing';
import { ASK_GOOGLE_TRUTH, effectiveSeverity, indexFindingSeverity, isIndexFinding, liveIndexFinding, liveResolved, livePageNow, type AuditInspectedPage } from './technical-live';
import type { IndexPageRow } from './tables';

// Client report 2026-11-11 (a client's Technical health page): the "not indexed by Google" finding was the audit's reading of 28 Oct (15 of
// 23 inspected pages), shown as Open and High two weeks later. The daily index check had read the same pages every day: 8 in Google, 3
// left out on purpose, 4 still out; the client had asked Google about 10 pages and 9 were in. The figures below are that case on a made-up
// website (the repository is public).

const W = 'https://northwind-erp.com';
const AUDIT_AT = '2026-10-28T10:29:01.337Z';
// the audit's 23 inspected pages: 8 in Google then, 15 not (8 unknown, 5 discovered, 2 crawled)
const auditPages: AuditInspectedPage[] = [
  ...['/', '/careers', '/contact-us', '/capabilities/edx', '/insights/a1', '/insights/a2', '/privacy-old', '/team'].map((p) => ({ url: W + p, indexed: true, coverage: 'Submitted and indexed' })),
  ...[
    ['/insights/automation', 'URL is unknown to Google'],
    ['/industries', 'Discovered - currently not indexed'],
    ['/about', 'URL is unknown to Google'],
    ['/capabilities/infrastructure', 'URL is unknown to Google'],
    ['/capabilities/data', 'Discovered - currently not indexed'],
    ['/cookies', 'Discovered - currently not indexed'],
    ['/engagement-models', 'Crawled - currently not indexed'],
    ['/insights', 'Discovered - currently not indexed'],
    ['/privacy', 'Crawled - currently not indexed'],
    ['/security', 'Discovered - currently not indexed'],
    ['/whatwedo', 'URL is unknown to Google'],
    ['/insights/agentic', 'URL is unknown to Google'],
    ['/insights/value', 'URL is unknown to Google'],
    ['/capabilities/edx/dev', 'URL is unknown to Google'],
    ['/capabilities/edx/hosting', 'URL is unknown to Google'],
  ].map(([p, c]) => ({ url: W + p, indexed: false, coverage: c })),
];

const row = (path: string, over: Partial<IndexPageRow>): Partial<IndexPageRow> => ({ url: W + path, site_id: 'site_northwind-erp-com', domain: 'northwind-erp.com', lane: 'existing', inspect_at: '2026-11-06T10:15:00.000Z', ...over });
const indexed = (path: string, over: Partial<IndexPageRow> = {}) => row(path, { state: 'indexed', verdict: 'PASS', coverage: 'Submitted and indexed', action: 'none', ...over });
const out = (path: string, cause: string, coverage: string, over: Partial<IndexPageRow> = {}) => row(path, { state: 'not_indexed', cause, coverage, action: 'wait', ...over });
const asked = (at: string, read = '') => ({ asked_google_at: at, google_read_after_ask_at: read });

const today = [
  // the audit's 15, read again
  indexed('/insights/automation'),
  indexed('/industries', asked('2026-11-02T08:08:43Z', '2026-11-02T12:00:00Z')),
  indexed('/about', asked('2026-11-02T08:07:24Z', '2026-11-02T12:00:00Z')),
  indexed('/capabilities/infrastructure', asked('2026-11-02T08:07:58Z', '2026-11-02T12:00:00Z')),
  indexed('/capabilities/data', { ...asked('2026-11-10T09:58:24Z', '2026-11-10T13:00:00Z'), inspect_at: '2026-11-11T10:15:00.000Z' }),
  row('/cookies', { state: 'excluded', cause: 'low_value', action: 'leave_out', coverage: 'Discovered - currently not indexed' }),
  row('/engagement-models', { state: 'excluded', cause: 'redirect', action: 'leave_out', coverage: 'Crawled - currently not indexed' }),
  indexed('/insights', asked('2026-11-02T08:09:29Z', '2026-11-02T12:00:00Z')),
  row('/privacy', { state: 'excluded', cause: 'low_value', action: 'leave_out', coverage: 'Crawled - currently not indexed' }),
  indexed('/security'),
  indexed('/whatwedo', asked('2026-11-02T08:10:11Z', '2026-11-02T12:00:00Z')),
  out('/insights/agentic', 'unknown_to_google', 'URL is unknown to Google'),
  out('/insights/value', 'unknown_to_google', 'URL is unknown to Google'),
  out('/capabilities/edx/dev', 'unknown_to_google', 'URL is unknown to Google'),
  out('/capabilities/edx/hosting', 'unknown_to_google', 'URL is unknown to Google'),
  // other pages the client asked about
  indexed('/industries/hospitality', asked('2026-11-10T09:59:12Z', '2026-11-10T13:00:00Z')),
  indexed('/industries/manufacturing', asked('2026-11-10T09:59:54Z', '2026-11-10T13:00:00Z')),
  indexed('/industries/nonprofit', asked('2026-11-10T10:00:23Z', '2026-11-10T13:00:00Z')),
  out('/industries/professional-services', 'discovered_not_crawled', 'Discovered - currently not indexed', asked('2026-11-10T10:01:55Z')),
].map(indexPageOf);

const finding = { severity: 'High', affectedCount: 15 };
const site = { indexed: 18, shouldBe: 40, known: 46, notChecked: 0, newWaiting: 9, checkedAt: '2026-11-11T10:15:00.000Z' };

describe('the technical page\'s "not indexed by Google" finding follows the daily index check', () => {
  it('reads the audit\'s own 15 pages again: 8 in Google, 3 left out on purpose, 4 still out', () => {
    const live = liveIndexFinding({ finding, inspected: 23, auditedAt: AUDIT_AT, auditPages, sampleUrls: [], indexPages: today, site, domain: 'northwind-erp.com' })!;
    expect(live.now).toEqual({ indexed: 8, leftOut: 3, notIndexed: 4, notChecked: 0, of: 15 });
    expect(live.state).toBe('improving');
    // the engine's own rule, like for like: 4 still out of the 20 pages that should be in search (8 in at the audit + 8 in now + 4) = 20%
    expect(live.severity).toBe('High');
    expect(live.headline).toBe("Checked daily (11 Nov): 4 of the 15 pages this audit found outside Google are still not in Google's index; 8 are in Google now and 3 are left out on purpose.");
    expect(live.lines[0]).toBe("At the audit of 28 Oct: 15 of 23 pages inspected in Search Console were not in Google's index.");
    expect(live.pages.filter((p) => p.now === 'not_indexed').map((p) => p.path)).toEqual(['/insights/agentic', '/insights/value', '/capabilities/edx/dev', '/capabilities/edx/hosting']);
  });

  it('says what the client asked Google and what Google did since, and that asking does not index a page at once', () => {
    const live = liveIndexFinding({ finding, inspected: 23, auditedAt: AUDIT_AT, auditPages, sampleUrls: [], indexPages: today, site })!;
    expect(live.asked).toEqual({ pages: 10, inGoogle: 9, readNotIn: 0, waiting: 1, lastAskedAt: '2026-11-10T10:01:55Z' });
    expect(live.lines).toContain('You asked Google to read 10 pages again: 9 are in Google now, 1 is waiting for Google to read it (last asked 10 Nov).');
    expect(live.lines[live.lines.length - 1]).toBe(ASK_GOOGLE_TRUTH);
  });

  it('gives the website-wide figure in the Indexing page\'s own sentence, with the new pages that are still waiting', () => {
    const live = liveIndexFinding({ finding, inspected: 23, auditedAt: AUDIT_AT, auditPages, sampleUrls: [], indexPages: today, site })!;
    expect(live.site?.line).toBe('Google has 18 of the 40 pages we checked that should be in search');
    expect(live.lines).toContain('Across the website: Google has 18 of the 40 pages we checked that should be in search. 9 of the 22 still out are new pages: Google usually takes a few days to a few weeks to index a new page.');
  });

  it('is resolved when every page of the audit\'s list is in Google or left out on purpose, and is then not open any more', () => {
    const done = today.map((p) => (p.state === 'not_indexed' ? { ...p, state: 'indexed' as const, action: 'none' as const } : p));
    const live = liveIndexFinding({ finding, inspected: 23, auditedAt: AUDIT_AT, auditPages, sampleUrls: [], indexPages: done, site })!;
    expect(live.state).toBe('resolved');
    expect(live.severity).toBe('');
    expect(liveResolved({ live })).toBe(true);
    expect(live.headline).toMatch(/every page this audit found outside Google is in Google's index now, or left out on purpose/);
  });

  it('drops to Medium on the engine\'s threshold when fewer than a fifth are still out', () => {
    const fewer = today.map((p) => (p.path === '/insights/agentic' || p.path === '/insights/value' ? { ...p, state: 'indexed' as const, action: 'none' as const } : p));
    const live = liveIndexFinding({ finding, inspected: 23, auditedAt: AUDIT_AT, auditPages, sampleUrls: [], indexPages: fewer, site })!;
    expect(live.now.notIndexed).toBe(2);
    expect(live.severity).toBe('Medium');
    expect(effectiveSeverity({ severity: 'High', live })).toBe('Medium');
  });

  it('a page the daily check has not read is "not checked", never "in Google" and never resolved', () => {
    const missing = today.filter((p) => p.path !== '/capabilities/edx/hosting');
    const live = liveIndexFinding({ finding, inspected: 23, auditedAt: AUDIT_AT, auditPages, sampleUrls: [], indexPages: missing, site })!;
    expect(live.now.notChecked).toBe(1);
    expect(live.lines).toContain('1 page of that list has not been read by the daily index check yet.');
  });

  it('without the audit\'s report only the stored sample is read again, and the audit\'s severity is kept', () => {
    const live = liveIndexFinding({ finding, inspected: 23, auditedAt: AUDIT_AT, auditPages: [], sampleUrls: [`${W}/insights/automation`, `${W}/industries`, `${W}/insights/agentic`], indexPages: today, site })!;
    expect(live.state).toBe('partial');
    expect(live.severity).toBeNull();
    expect(effectiveSeverity({ severity: 'High', live })).toBe('High');
    expect(live.headline).toBe("Checked daily (11 Nov): of the 3 pages this audit stored, 2 are in Google's index now.");
  });

  it('no reading of the daily index check: nothing is claimed', () => {
    expect(liveIndexFinding({ finding, inspected: 23, auditedAt: AUDIT_AT, auditPages, sampleUrls: [], indexPages: [], site: null })).toBeNull();
  });

  it('follows the engine\'s two findings only, with its 20% rule', () => {
    expect(isIndexFinding({ title: 'A large share of important pages is not indexed by Google' })).toBe(true);
    expect(isIndexFinding({ title: 'Some sampled pages are not indexed by Google' })).toBe(true);
    expect(isIndexFinding({ title: 'Indexable pages missing from the sitemap' })).toBe(false);
    expect(indexFindingSeverity(4, 20)).toBe('High');
    expect(indexFindingSeverity(3, 20)).toBe('Medium');
    expect(indexFindingSeverity(0, 20)).toBe('');
    expect(livePageNow(undefined)).toBe('not_checked');
  });

  it('every sentence is customer copy: no em dash, no curly quote, no ellipsis character', () => {
    const live = liveIndexFinding({ finding, inspected: 23, auditedAt: AUDIT_AT, auditPages, sampleUrls: [], indexPages: today, site })!;
    for (const t of [live.headline, ...live.lines]) expect(t).not.toMatch(/[—–‘’“”…]/);
  });
});
