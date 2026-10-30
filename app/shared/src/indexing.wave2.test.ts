import { describe, expect, it } from 'vitest';
import {
  askGoogleStatus,
  buildIndexingData,
  INDEX_CANONICAL_PARENT,
  INDEX_LINKED_WAITING,
  INDEX_UTILITY_GROUP,
  INDEX_UTILITY_SEGMENTS,
  INDEXING_LINKS_KEY,
  indexingCauseReadings,
  indexingLinksReading,
  indexingPageFixed,
  indexPageOf,
  indexRunOf,
  indexSitemapState,
  isJobPosting,
  isUtilityPage,
  pageLinksTo,
  type IndexingFetch,
  type IndexingLinksReading,
} from './indexing';
import { deriveSiteTasks, linkPairsOf, siteTaskKindOfKey, siteTaskPayload, type SiteTaskInputs, type StoredSiteTask } from './site-tasks';
import { guideById, guideForNeedsYou, guideForRecommendation, guideText, INDEXING_GUIDE } from './guides';
import { monitorsBody, siteAdminMonitorsBody } from './payload';
import { monitorSettingsSchema } from './schemas';
import { AUDIT_ACTIONS } from './identity';
import type { IndexPageRow, IndexRunRow } from './tables';

// Index coverage wave 2 (n8n/seo-agent/docs/indexing-2026-10-29/DESIGN_WAVE2.md §3), app half, on devaicon-shaped rows (anonymised as
// novaand-demo.com): pages the website already links to wait for Google (no link suggestions, no step); pages that need a link are ONE step
// with pairs we check; a canonical to a parent page outside the sitemap is the canonical step with its own words and check; policy pages
// are fine to leave out; "I asked Google" and what follows; the sitemap switch, Google's access and the submissions.

const D = 'novaand-demo.com';
const U = (p: string) => `https://${D}${p}`;
const RUN = '2026-10-30T06:00:00.000Z';
const settings = { on: true, dailyCap: 300 };
const page = (o: Partial<IndexPageRow>): Partial<IndexPageRow> => ({ lane: 'existing', state: 'not_indexed', inspect_at: RUN, ...o });

describe('utility pages (DESIGN_WAVE2 §2.4)', () => {
  it('whole segments, any case; /security only as the whole path; job postings under /careers or /jobs', () => {
    for (const p of ['/privacy', '/legal/terms', '/Cookies', '/en/privacy-policy', '/account/settings', '/security', '/thank-you']) expect(isUtilityPage(U(p)), p).toBe(true);
    for (const p of ['/services/security', '/blog/search-engine-tips', '/privacy-first-design-x', '/capabilities/data', '/']) expect(isUtilityPage(U(p)), p).toBe(false);
    expect(isJobPosting(U('/careers/frontend-engineer'))).toBe(true);
    expect(isJobPosting(U('/careers'))).toBe(false);
    expect(isJobPosting(U('/jobs/1'))).toBe(true);
    expect(INDEX_UTILITY_SEGMENTS).toHaveLength(24);
  });
  it('the engine\'s policy pages (low_value, leave_out) are "Policy and utility pages: fine to leave out"; the engine\'s action is kept', () => {
    const d = buildIndexingData({ rows: [page({ url: U('/privacy'), cause: 'low_value', action: 'leave_out', state: 'excluded' }), page({ url: U('/cookies'), cause: 'low_value', action: 'leave_out', state: 'excluded' }), page({ url: U('/tag/x'), cause: 'low_value', action: 'leave_out', state: 'excluded' })], runs: [{ run_at: RUN, known: 3, inspected: 3 }], events: [], impacts: [], settings });
    expect(d.groups.find((x) => x.cause === 'utility')).toMatchObject({ action: 'leave_out', count: 2, label: INDEX_UTILITY_GROUP.label, guide: null, taskKey: null });
    expect(d.groups.find((x) => x.cause === 'low_value')).toMatchObject({ count: 1 });
    expect(d.totals.needYou).toBe(0);
    // an older engine row that asked to improve /privacy keeps its action (the page's counts are the engine's) but is marked a utility page,
    // so the page never offers "Improve this page" for it (the web test holds that)
    expect(indexPageOf(page({ url: U('/privacy'), cause: 'crawled_not_indexed', action: 'quality' }))).toMatchObject({ action: 'quality', utility: true });
  });
  it('a utility page is never a page to link from, and never one to ask Google about', () => {
    const p = indexPageOf(page({ url: U('/capabilities/data'), cause: 'unknown_to_google', action: 'links', ask_google: true, link_from: JSON.stringify([{ url: U('/cookies'), title: 'Cookies' }, { url: U('/insights/data-sovereignty'), title: 'Data sovereignty' }]) }));
    expect(p.linkFrom.map((l) => l.url)).toEqual([U('/insights/data-sovereignty')]);
    expect(indexPageOf(page({ url: U('/cookies'), cause: 'unknown_to_google', action: 'wait', ask_google: true })).askGoogle).toBe(false);
    expect(indexPageOf(page({ url: U('/careers/dev'), cause: 'unknown_to_google', action: 'wait', ask_google: true })).askGoogle).toBe(false);
  });
});

describe('already linked: wait, not "add links" (§3.1)', () => {
  const rows = [
    page({ url: U('/capabilities/cloud'), cause: 'discovered_not_crawled', action: 'wait', linked_by: JSON.stringify([U('/')]), in_sitemap: true }),
    page({ url: U('/whatwedo'), cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([U('/'), U('/about-devaicon')]) }),
    page({ url: U('/capabilities/open-edx-services/hosting'), cause: 'unknown_to_google', action: 'links', linked_by: '', link_from: JSON.stringify([{ url: U('/capabilities/open-edx-services'), title: 'Open edX services' }]) }),
  ];
  it('its own group with plain words, no step, the guide to ask Google; the link pages are one step', () => {
    const d = buildIndexingData({ rows, runs: [{ run_at: RUN, known: 3, inspected: 3 }], events: [], impacts: [], settings });
    const wait = d.groups.filter((g) => g.cause === 'linked_waiting');
    expect(wait).toHaveLength(1);
    expect(wait[0]).toMatchObject({ action: 'wait', count: 2, label: 'Google has not visited these yet', taskKey: null, guide: 'index-request-indexing' });
    expect(wait[0].youDo).toContain('links from other websites');
    const links = d.groups.find((g) => g.action === 'links')!;
    expect(links).toMatchObject({ count: 1, taskKey: INDEXING_LINKS_KEY, guide: 'index-add-internal-links' });
    // only the page that needs a link needs the client
    expect(d.totals.needYou).toBe(1);
  });
  it('reads linked_by: the list, none found, and "not read this run"', () => {
    expect(indexPageOf(page({ url: U('/x'), linked_by: JSON.stringify([U('/'), 'mailto:x']) }))).toMatchObject({ linkedBy: [U('/')], linkedRead: true });
    expect(indexPageOf(page({ url: U('/x'), linked_by: '' }))).toMatchObject({ linkedBy: [], linkedRead: true });
    expect(indexPageOf(page({ url: U('/x'), linked_by: 'unread' }))).toMatchObject({ linkedBy: [], linkedRead: false });
  });
  it('the words keep the owner copy rules and never promise indexing', () => {
    for (const t of [...Object.values(INDEX_LINKED_WAITING), ...Object.values(INDEX_CANONICAL_PARENT), ...Object.values(INDEX_UTILITY_GROUP)])
      expect(t).not.toMatch(/[–—‘’“”…!]|\.\.\.|get indexed|guarantee|we ask google|we submit/i);
  });
});

describe('a canonical to another page outside the sitemap (§2.2 / §3.1)', () => {
  const ind = (slug: string, inSitemap: boolean) => page({ url: U(`/industries/${slug}`), cause: 'canonical_elsewhere', action: 'site_fix', in_sitemap: inSitemap, page_canonical: U('/industries') });
  it('is part of the canonical step, in a group of its own words', () => {
    const d = buildIndexingData({ rows: [ind('bfsi', false), ind('retail', false), ind('copy-in-sitemap', true)], runs: [{ run_at: RUN, known: 3, inspected: 3 }], events: [], impacts: [], settings });
    expect(d.groups.find((g) => g.cause === 'canonical_parent')).toMatchObject({ count: 2, taskKey: 'indexing:canonical_elsewhere', label: INDEX_CANONICAL_PARENT.label, guide: 'index-canonical-sitemap' });
    expect(d.groups.find((g) => g.cause === 'canonical_elsewhere')).toMatchObject({ count: 1, taskKey: 'indexing:canonical_elsewhere' });
  });
  it('a page in the sitemap with the engine\'s own-title note is one too (the engine stores no flag, contract 3)', () => {
    const inMap = { ...ind('retail', true), note: 'This page tells Google it is a copy of /industries, so Google shows that page instead.' };
    const [r] = indexingCauseReadings([inMap, ind('copy-in-sitemap', true)]);
    expect(r.ownTitle).toEqual([U('/industries/retail')]);
    const d = buildIndexingData({ rows: [inMap, ind('copy-in-sitemap', true)], runs: [{ run_at: RUN, known: 2, inspected: 2 }], events: [], impacts: [], settings });
    expect(d.groups.find((g) => g.cause === 'canonical_parent')?.count).toBe(1);
  });
  it('the reading names the pages outside the sitemap (an empty in_sitemap says nothing)', () => {
    const [r] = indexingCauseReadings([ind('bfsi', false), ind('copy-in-sitemap', true), { ...ind('unknown', true), in_sitemap: '' as never }]);
    expect(r.ownTitle).toEqual([U('/industries/bfsi')]);
  });
  it('the step speaks of pages with a title of their own, and asks to point the canonical to the page itself', () => {
    const [r] = indexingCauseReadings([ind('bfsi', false), ind('retail', false)]);
    const [t] = deriveSiteTasks({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt: RUN, causes: [r] } }, []);
    expect(t).toMatchObject({ key: 'indexing:canonical_elsewhere', title: INDEX_CANONICAL_PARENT.taskTitle });
    expect(t.detail).toContain('point its canonical tag to the page itself, and add it to your sitemap if it is not there');
  });
  it('our check: not in the sitemap is where it started, never the fix; a canonical naming itself is', () => {
    const f = (canon: string): IndexingFetch => ({ url: U('/industries/bfsi'), status: 200, finalUrl: U('/industries/bfsi'), redirectStatus: 0, text: `<html><head><title>Banking</title><link rel="canonical" href="${canon}"></head><body>x</body></html>` });
    expect(indexingPageFixed('canonical_elsewhere', f(U('/industries')), false, { ownTitle: true })).toMatchObject({ fixed: false });
    expect(indexingPageFixed('canonical_elsewhere', f(U('/industries')), false, { ownTitle: true }).why).toContain('/industries as the main version');
    expect(indexingPageFixed('canonical_elsewhere', f(U('/industries/bfsi')), false, { ownTitle: true })).toMatchObject({ fixed: true });
    // a page that is IN the sitemap keeps the old rule (leaving the sitemap is a fix for a real copy)
    expect(indexingPageFixed('canonical_elsewhere', f(U('/industries')), false)).toMatchObject({ fixed: true });
  });
});

describe('"I asked Google" and what follows (§2.3 / §3.2)', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  it('waiting, read again, and the 14-day note', () => {
    expect(askGoogleStatus({ askedGoogleAt: '', googleReadAfterAskAt: '' }, now).state).toBe('none');
    expect(askGoogleStatus({ askedGoogleAt: '2026-11-01T10:00:00Z', googleReadAfterAskAt: '' }, now)).toMatchObject({ state: 'waiting', text: 'Waiting for Google to read it again (you asked on 1 Nov).' });
    expect(askGoogleStatus({ askedGoogleAt: '2026-11-01T10:00:00Z', googleReadAfterAskAt: '2026-11-03T04:00:00Z' }, now)).toMatchObject({ state: 'read', text: 'Google read it again on 3 Nov.' });
    expect(askGoogleStatus({ askedGoogleAt: '2026-10-20T10:00:00Z', googleReadAfterAskAt: '' }, now)).toMatchObject({
      state: 'quiet',
      text: 'You asked Google on 20 Oct; Google has not read it again yet. There is nothing more to do on your side for now.',
    });
    // a read from BEFORE the ask is not a read after it
    expect(askGoogleStatus({ askedGoogleAt: '2026-11-01T10:00:00Z', googleReadAfterAskAt: '2026-10-31T00:00:00Z' }, now).state).toBe('waiting');
  });
  it('a press the engine did not keep (an overlapping run wrote the row back) reads "not recorded", and can be pressed again', () => {
    const row = page({ url: U('/capabilities/ai'), cause: 'discovered_not_crawled', action: 'wait', ask_google: true });
    const d = buildIndexingData({ rows: [row], runs: [{ run_at: RUN, known: 1, inspected: 1 }], events: [], impacts: [], settings, now, askedByApp: { [U('/capabilities/ai')]: '2026-11-01T10:00:00Z' } });
    expect(d.askGoogle[0].askNotRecorded).toBe('2026-11-01T10:00:00Z');
    expect(askGoogleStatus(d.askGoogle[0], now)).toMatchObject({ state: 'lost', text: 'You told us on 1 Nov that you asked Google, but the daily index check did not keep it. Press I asked Google again.' });
    // the row holds it: nothing lost
    const kept = buildIndexingData({ rows: [{ ...row, asked_google_at: '2026-11-01T10:00:01Z' }], runs: [{ run_at: RUN }], events: [], impacts: [], settings, now, askedByApp: { [U('/capabilities/ai')]: '2026-11-01T10:00:00Z' } });
    expect(kept.askGoogle[0].askNotRecorded).toBe('');
  });
  it('a page asked about that left the engine\'s list stays on the page with its outcome (45 days)', () => {
    const rows = [
      page({ url: U('/capabilities/ai'), cause: 'discovered_not_crawled', action: 'wait', ask_google: true, asked_google_at: '2026-11-01T10:00:00Z' }),
      page({ url: U('/capabilities/data'), state: 'indexed', cause: 'indexed', action: 'none', asked_google_at: '2026-10-25T10:00:00Z', google_read_after_ask_at: '2026-10-27T10:00:00Z' }),
      page({ url: U('/old-ask'), cause: 'discovered_not_crawled', action: 'wait', asked_google_at: '2026-08-01T10:00:00Z' }),
    ];
    const d = buildIndexingData({ rows, runs: [{ run_at: RUN, known: 3, inspected: 3 }], events: [], impacts: [], settings, now });
    expect(d.askGoogle.map((p) => p.path)).toEqual(['/capabilities/ai']);
    expect(d.askedGoogle.map((p) => p.path)).toEqual(['/capabilities/data']);
  });
});

describe('the sitemap switch, Google\'s access and the submissions (§2.5 / §3.2)', () => {
  const run = (sm: Record<string, unknown>, at = RUN): Partial<IndexRunRow> => ({ run_at: at, known: 10, inspected: 5, sitemaps_json: JSON.stringify(sm) });
  it('Full access, read-only access, and not read yet', () => {
    expect(indexSitemapState([indexRunOf(run({ permission: 'siteFullUser' }))], true)).toMatchObject({ submitOn: true, access: 'full', accessAt: RUN });
    expect(indexSitemapState([indexRunOf(run({ permission: 'siteOwner' }))], false).access).toBe('full');
    expect(indexSitemapState([indexRunOf(run({ permission: 'siteRestrictedUser' }))], true).access).toBe('restricted');
    expect(indexSitemapState([indexRunOf(run({ submitted: 1 }))], false)).toMatchObject({ access: 'unknown', submitOn: false, submissions: [] });
    // a reservation row is never a reading
    expect(indexSitemapState([indexRunOf(run({ permission: 'siteFullUser', reservation: true }))], true).access).toBe('unknown');
  });
  it('each submission with the day Search Console lists it and the day Google read it', () => {
    const at = '2026-10-30T06:05:00Z';
    const s = indexSitemapState(
      [
        indexRunOf(run({ permission: 'siteFullUser', list: [{ path: U('/sitemap.xml'), lastSubmitted: '2026-10-30T06:05:01Z', lastDownloaded: '2026-10-31T02:00:00Z' }] }, '2026-10-31T06:00:00Z')),
        indexRunOf(run({ permission: 'siteFullUser', submissions: [{ path: U('/sitemap.xml'), at, status: 'ok', reason: '' }, { path: U('/news.xml'), at, status: '403', reason: 'Google refused: no Full access' }] })),
      ],
      true,
    );
    expect(s.submissions).toEqual([
      { path: U('/sitemap.xml'), at, status: 'ok', reason: '', listedAt: '2026-10-30T06:05:01Z', readAt: '2026-10-31T02:00:00Z' },
      { path: U('/news.xml'), at, status: 'refused', reason: '', listedAt: '', readAt: '' },
    ]);
  });
  it('the engine\'s shape (ENGINE_BUILD wave 2, contract 8): its statuses, its reason codes in words, its own read dates, permission_full, the list counts', () => {
    const at = '2026-10-30T06:05:00Z';
    const s2 = indexSitemapState(
      [indexRunOf(run({ submitted: 0, submitted_errors: 0, permission: 'siteFullUser', permission_full: true, submissions: [
        { path: U('/sitemap.xml'), at, status: 'read', reason: 'not_listed', http_status: 200, confirmed_at: '2026-10-30T06:06:00Z', read_at: '2026-10-31T01:00:00Z' },
        { path: U('/a.xml'), at: '2026-10-23T06:00:00Z', status: 'confirmed', reason: 'changed' },
        { path: U('/b.xml'), at: '2026-10-16T06:00:00Z', status: 'denied', reason: 'errors_changed', http_status: 403 },
        { path: U('/c.xml'), at: '2026-10-09T06:00:00Z', status: 'failed', reason: 'mystery_code' },
      ] }))],
      true,
    );
    expect(s2.submissions.map((x) => [x.status, x.reason, x.listedAt, x.readAt])).toEqual([
      ['ok', 'Search Console did not list your sitemap', '2026-10-30T06:06:00Z', '2026-10-31T01:00:00Z'],
      ['ok', 'your sitemap changed (pages added or removed)', '', ''],
      ['refused', 'Search Console reported errors and your sitemap has changed since', '', ''],
      ['error', '', '', ''],
    ]);
    expect(s2).toMatchObject({ access: 'full', submitted: 0, errors: 0 });
    // Full access, but a refusal still holding: the engine says not full, so we do not say "we can submit"
    expect(indexSitemapState([indexRunOf(run({ permission: 'siteFullUser', permission_full: false }))], true).access).toBe('restricted');
  });
  it('the setting is sent last and only when set; the schema takes it', () => {
    expect(monitorsBody({ backlinks: true })).toEqual({ backlinks: true });
    const b = siteAdminMonitorsBody({ backlinks: true, indexWatch: true, indexDailyCap: 300, indexSitemapSubmit: true });
    expect(Object.keys(b).slice(-3)).toEqual(['index_watch', 'index_daily_cap', 'index_sitemap_submit']);
    expect(b.index_sitemap_submit).toBe(true);
    expect(monitorSettingsSchema.parse({}).indexSitemapSubmit).toBeUndefined();
    expect(monitorSettingsSchema.parse({ indexSitemapSubmit: false }).indexSitemapSubmit).toBe(false);
  });
  it('with the switch on and Full access there is no "submit your sitemap" step; errors in a submitted one are still the client\'s', () => {
    const base: SiteTaskInputs = { domain: D, indexnow: null, access: null, reclaim: null };
    const none = { at: RUN, submitted: 0, errors: 0 };
    expect(deriveSiteTasks({ ...base, indexing: { runAt: RUN, causes: [], sitemap: none, sitemapAuto: true } }, []).map((t) => t.key)).toEqual([]);
    expect(deriveSiteTasks({ ...base, indexing: { runAt: RUN, causes: [], sitemap: none, sitemapAuto: false } }, []).map((t) => t.key)).toEqual(['indexing:sitemap']);
    expect(deriveSiteTasks({ ...base, indexing: { runAt: RUN, causes: [], sitemap: { at: RUN, submitted: 1, errors: 2 }, sitemapAuto: true } }, []).map((t) => t.key)).toEqual(['indexing:sitemap']);
    const [t] = deriveSiteTasks({ ...base, indexing: { runAt: RUN, causes: [], sitemap: none } }, []);
    expect(t.detail).toContain('switch on sitemap submission in Tracking & monitors');
  });
});

describe('the links step `indexing:links` (§3.2)', () => {
  const base: SiteTaskInputs = { domain: D, indexnow: null, access: null, reclaim: null };
  const target = (slug: string, sources: string[]) => page({ url: U(slug), cause: 'unknown_to_google', action: 'links', impressions_28d: 0, link_from: JSON.stringify(sources.map((x) => ({ url: U(x), title: x }))) });
  const reading = (rows: Partial<IndexPageRow>[], runAt = RUN, capped = false): IndexingLinksReading => indexingLinksReading(rows, { runAt, capped });
  const inputs = (l: IndexingLinksReading | null): SiteTaskInputs => ({ ...base, indexing: { runAt: l?.runAt ?? RUN, causes: [], links: l } });
  const stored = (o: Partial<StoredSiteTask>): StoredSiteTask => ({ key: INDEXING_LINKS_KEY, kind: 'index_links', payload: {}, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: '2026-10-30T07:00:00.000Z', ...o });

  it('reads only pages that need a link (never a utility page, never a page already linked), sources never itself or a utility page', () => {
    const r = reading([
      target('/a', ['/insights/x', '/cookies', '/a']),
      target('/privacy', ['/']),
      { ...target('/b', ['/']), linked_by: JSON.stringify([U('/')]) },
      page({ url: U('/c'), cause: 'unknown_to_google', action: 'wait' }),
    ]);
    expect(r.targets).toEqual([{ url: U('/a'), title: '', sources: [U('/insights/x')] }]);
  });
  it('one step with up to 10 pairs, values to copy, its guide; a page with no source we can suggest is not a pair', () => {
    const rows = Array.from({ length: 13 }, (_, i) => target(`/t${i}`, [`/s${i}`]));
    rows.push(target('/no-source', []));
    const [t] = deriveSiteTasks(inputs(reading(rows)), []);
    expect(t).toMatchObject({ key: INDEXING_LINKS_KEY, kind: 'index_links', state: 'todo', severity: 'info', guide: 'index-add-internal-links' });
    expect(t.values).toHaveLength(10);
    expect(t.values[0]).toEqual({ label: 'On /s0, add a link to', value: U('/t0') });
    expect(t.detail).toContain('3 more pages follow once these are done');
    expect(t.guideVars).toMatchObject({ pageUrl: U('/t0'), sourceUrl: U('/s0') });
    expect(siteTaskKindOfKey(INDEXING_LINKS_KEY)).toBe('index_links');
    expect(linkPairsOf(siteTaskPayload(inputs(reading(rows)), [], INDEXING_LINKS_KEY)!.payload)).toHaveLength(10);
  });
  it('the pairs stay as listed when the engine suggests another page; our own check decides', () => {
    const first = siteTaskPayload(inputs(reading([target('/a', ['/s1'])])), [], INDEXING_LINKS_KEY)!.payload;
    const st = stored({ payload: first, lastCheck: { at: '2026-10-30T09:00:00.000Z', ok: true, message: 'All links are in place.', by: 'you' }, doneAt: '2026-10-30T09:00:00.000Z' });
    const [t] = deriveSiteTasks(inputs(reading([target('/a', ['/s2'])], '2026-10-31T06:00:00.000Z')), [st]);
    expect(t.state).toBe('done');
    expect(linkPairsOf(siteTaskPayload(inputs(reading([target('/a', ['/s2'])], '2026-10-31T06:00:00.000Z')), [st], INDEXING_LINKS_KEY)!.payload)[0].source).toBe(U('/s1'));
  });
  it('a new page joins a done step: to do again for the new pair, never "needed again"', () => {
    const first = siteTaskPayload(inputs(reading([target('/a', ['/s1'])])), [], INDEXING_LINKS_KEY)!.payload;
    const st = stored({ payload: first, lastCheck: { at: '2026-10-30T09:00:00.000Z', ok: true, message: 'ok', by: 'you' }, doneAt: '2026-10-30T09:00:00.000Z' });
    const later = reading([target('/a', ['/s1']), target('/b', ['/s3'])], '2026-10-31T06:00:00.000Z');
    const [t] = deriveSiteTasks(inputs(later), [st]);
    expect(t).toMatchObject({ state: 'todo', reopened: false, severity: 'info' });
    expect(t.lastCheck).toMatchObject({ by: 'index', ok: false });
    expect(t.values.map((v) => v.value)).toEqual([U('/a'), U('/b')]);
    // even when our last check came after the run: the new pair is dated after it
    const st2 = stored({ payload: first, lastCheck: { at: '2026-10-31T07:00:00.000Z', ok: true, message: 'ok', by: 'daily' } });
    expect(deriveSiteTasks(inputs(later), [st2])[0].state).toBe('todo');
  });
  it('the engine closes it when no page needs a link any more (a complete read after the step was stored); a capped or missing read keeps it', () => {
    const first = siteTaskPayload(inputs(reading([target('/a', ['/s1'])])), [], INDEXING_LINKS_KEY)!.payload;
    const st = stored({ payload: first });
    const [done] = deriveSiteTasks(inputs(reading([], '2026-10-31T06:00:00.000Z')), [st]);
    expect(done).toMatchObject({ state: 'done', lastCheck: { by: 'index', ok: true } });
    expect(done.detail).toContain('no page that still needs a link');
    expect(deriveSiteTasks(inputs(reading([], '2026-10-31T06:00:00.000Z', true)), [st])[0].state).toBe('todo');
    expect(deriveSiteTasks(inputs(null), [st])[0].state).toBe('todo');
    expect(deriveSiteTasks(inputs(null), [])).toEqual([]);
  });
  it('the guide, the Needs-you and the recommendation point at the links guide', () => {
    expect(INDEXING_GUIDE.links).toBe('index-add-internal-links');
    expect(guideForNeedsYou({ id: `task:${INDEXING_LINKS_KEY}`, kind: 'site_task', severity: 'info' })).toBe('index-add-internal-links');
    expect(guideForRecommendation('ix:links')).toBe('index-add-internal-links');
  });
});

describe('our check of a link (§3.2)', () => {
  const T = U('/capabilities/data');
  const at = (html: string, from = U('/insights/x')) => pageLinksTo(html, from, T);
  it('finds the link however it is written', () => {
    expect(at('<a href="/capabilities/data">Data</a>')).toBe(true);
    expect(at('<a class="x" href="../capabilities/data/">Data</a>')).toBe(true);
    expect(at(`<a href='https://www.${D}/capabilities/data#top'>Data</a>`)).toBe(true);
    expect(at('<a href=/capabilities/data?utm=1>Data</a>')).toBe(true);
    expect(at('<A HREF="http://novaand-demo.com/capabilities/data">Data</A>')).toBe(true);
  });
  it('never a near miss, a comment, a mail link or another website', () => {
    expect(at('<a href="/capabilities/data-2">x</a>')).toBe(false);
    expect(at('<!-- <a href="/capabilities/data">x</a> -->')).toBe(false);
    expect(at('<a href="mailto:x@y.com">x</a><a href="#capabilities/data">y</a>')).toBe(false);
    expect(at('<a href="https://other.com/capabilities/data">x</a>')).toBe(false);
    expect(at('<link href="/capabilities/data">')).toBe(false);
  });
});

describe('guides and copy (§3.2)', () => {
  it('the two new guides exist with their values; the read-only promise is the new sentence', () => {
    const full = guideById('search-console-full-access')!;
    expect(full.area).toBe('google');
    expect(guideText(full, { domain: D, serviceAccount: 'reader@x.iam.gserviceaccount.com' })).toContain('reader@x.iam.gserviceaccount.com');
    expect(guideById('index-add-internal-links')).toBeTruthy();
    const access = guideText(guideById('search-console-access')!);
    expect(access).toContain('We only read your Search Console, unless you switch on sitemap submission, which lets us submit your sitemap and nothing else.');
    expect(access).not.toContain('Nothing is ever changed, submitted or removed');
    expect(guideText(guideById('index-request-indexing')!)).toContain('I asked Google');
  });
  it('"I asked Google" is a known audit action', () => {
    expect(AUDIT_ACTIONS['indexing.asked_google']).toMatchObject({ category: 'websites' });
  });
});
