import { describe, expect, it } from 'vitest';
import { canonicalMergedByRedirect, indexingPageFixed, indexMergePairs, isSiteRoot } from './indexing';
import { countedPositions, countedReadings, dayText, markBeforePublish, pageSearchConsole, rankCheckNote } from './ladders';
import { mergedPairsOf, mergePairsOf } from './site-tasks';

// Production 2026-11-10 (devaicon.com, client reports): a merge step that asked to redirect the home page and could never be done, a canonical
// step that called a page "still to fix" after it was 301-redirected to the page it named, and a ladder that said "Not in the top 50" from a
// check taken before the page existed, with no word on how we check and without the page's own Search Console figures. Client text is
// anonymised (Nova&, novaand-demo.com).

const D = 'https://novaand-demo.com';
const page = (title: string, canonical?: string) => `<html><head><title>${title}</title>${canonical ? `<link rel="canonical" href="${canonical}">` : ''}</head><body><p>${title}</p></body></html>`;

describe('the home page is never a merge to redirect', () => {
  it('isSiteRoot: the bare host, a slash, a query; never a page below it', () => {
    for (const u of [`${D}`, `${D}/`, `${D}/?ref=x`, 'https://www.novaand-demo.com/#top']) expect(isSiteRoot(u)).toBe(true);
    for (const u of [`${D}/services`, `${D}/ai-automation-services-pakistan`, '']) expect(isSiteRoot(u)).toBe(false);
  });

  it('indexMergePairs leaves out a page planned as an update of the home page and published at its own address', () => {
    const pairs = indexMergePairs([
      { url: `${D}/`, to: `${D}/ai-automation-services-pakistan`, at: '2026-10-30T07:52:35Z' },
      { url: `${D}/industries/bfsi`, to: `${D}/services/industries-bfsi`, at: '2026-11-04T12:11:37Z' },
    ]);
    expect(pairs.map((p) => p.from)).toEqual([`${D}/industries/bfsi`]);
  });

  it('a stored step that still holds the home-page pair neither asks for it nor checks it', () => {
    const payload = { pairs: [{ from: `${D}/`, to: `${D}/ai-automation`, at: 'x' }, { from: `${D}/engagement-models`, to: `${D}/services/engagement-models`, at: 'y' }] };
    expect(mergePairsOf(payload).map((p) => p.from)).toEqual([`${D}/engagement-models`]);
  });
});

describe('the merge step keeps each pair\'s result', () => {
  const payload = { pairs: [{ from: `${D}/a`, to: `${D}/services/a`, at: '1' }, { from: `${D}/b`, to: `${D}/services/b`, at: '2' }] };

  it('per-pair results: only the done ones, dated by the check', () => {
    const lastCheck = { at: '2026-11-10T16:00:00Z', ok: false, by: 'daily' as const, message: '', pairs: [{ from: `${D}/a`, to: `${D}/services/a`, done: true }, { from: `${D}/b`, to: `${D}/services/b`, done: false }] };
    expect(mergedPairsOf({ payload, lastCheck })).toEqual([{ from: `${D}/a`, to: `${D}/services/a`, at: '2026-11-10T16:00:00Z' }]);
  });

  it('a reading from before per-pair results counts every pair only when the whole step was done', () => {
    expect(mergedPairsOf({ payload, lastCheck: { at: 'z', ok: true, by: 'you', message: '' } }).map((p) => p.from)).toEqual([`${D}/a`, `${D}/b`]);
    expect(mergedPairsOf({ payload, lastCheck: { at: 'z', ok: false, by: 'you', message: '' } })).toEqual([]);
    expect(mergedPairsOf({ payload, lastCheck: null })).toEqual([]);
    expect(mergedPairsOf(null)).toEqual([]);
  });
});

describe('canonical named elsewhere: a permanent redirect to that page is the fix', () => {
  const bfsi = `${D}/industries/bfsi`;
  const main = `${D}/services/industries-bfsi`;
  const redirected = (status: number, text: string, redirectStatus = 301, finalUrl = main) => ({ url: bfsi, status, finalUrl, redirectStatus, text, contentType: 'text/html' });

  it('301 to the main version that names itself: fixed, with or without a title of its own, whatever the sitemap says', () => {
    const f = redirected(200, page('BFSI', main));
    for (const own of [true, false]) for (const inSitemap of [true, false, null]) expect(indexingPageFixed('canonical_elsewhere', f, inSitemap, { ownTitle: own })).toMatchObject({ fixed: true });
    expect(indexingPageFixed('canonical_elsewhere', f, true, { ownTitle: true }).why).toBe('/industries/bfsi now redirects permanently to /services/industries-bfsi, the main version, so the two are one page.');
    // www vs bare host is the same website; 308 is permanent too; no canonical on the target is fine
    expect(canonicalMergedByRedirect(redirected(200, page('BFSI'), 308, 'https://www.novaand-demo.com/services/industries-bfsi'))?.fixed).toBe(true);
  });

  it('never for a temporary redirect, a target that names yet another page, a page that does not open, another website or a host move only', () => {
    expect(canonicalMergedByRedirect(redirected(200, page('BFSI', main), 302))).toBeNull();
    expect(canonicalMergedByRedirect(redirected(200, page('BFSI', `${D}/other`)))).toBeNull();
    expect(canonicalMergedByRedirect(redirected(404, 'not found'))).toBeNull();
    expect(canonicalMergedByRedirect(redirected(200, page('X'), 301, 'https://elsewhere.example/x'))).toBeNull();
    expect(canonicalMergedByRedirect(redirected(200, page('BFSI'), 301, 'https://www.novaand-demo.com/industries/bfsi/'))).toBeNull();
    // the cause's own rule still decides then: a page that opens and names the other page is still to fix
    expect(indexingPageFixed('canonical_elsewhere', { url: bfsi, status: 200, finalUrl: bfsi, redirectStatus: 0, text: page('BFSI', main), contentType: 'text/html' }, true, { ownTitle: true })).toMatchObject({ fixed: false });
  });
});

describe('readings taken before a page went live', () => {
  const history = [
    { checkedAt: '2026-10-30T01:13:00Z', position: 0 },
    { checkedAt: '2026-11-06T01:13:00Z', position: -1 },
    { checkedAt: '2026-11-08T19:38:00Z', position: 0 },
  ];

  it('are marked and never counted; a check that failed never counts either', () => {
    const marked = markBeforePublish(history, '2026-10-30T07:52:35Z');
    expect(marked.map((h) => !!h.beforePublish)).toEqual([true, false, false]);
    expect(countedReadings(marked).map((h) => h.checkedAt)).toEqual(['2026-11-08T19:38:00Z']);
    expect(countedPositions(marked)).toEqual({ latest: 0, previous: null, best: null });
    // no live date: nothing is marked
    expect(markBeforePublish(history, null)).toBe(history);
  });

  it('a page whose only check came before it went live is "not checked since"', () => {
    const marked = markBeforePublish([{ checkedAt: '2026-10-30T01:13:00Z', position: 7 }], '2026-10-30T07:52:35Z');
    expect(countedPositions(marked)).toEqual({ latest: null, previous: null, best: null });
  });
});

describe('the note beside the main keyword', () => {
  const after = [{ checkedAt: '2026-10-30T01:13:00Z', position: 0, beforePublish: true }, { checkedAt: '2026-11-08T19:38:00Z', position: 0 }];
  const base = { head: 'ai automation services pakistan', country: 'Pakistan', iso: 'PK', publishedAt: '2026-10-30T07:52:35Z' };

  it('says how we check: Google in the market, desktop, not signed in, the day; personal searches differ', () => {
    const note = rankCheckNote({ ...base, history: after });
    expect(note).toBe('We check Google Pakistan (google.com.pk), desktop, not signed in; last checked 8 Nov 2026. Your own searches are personalised (your place, your history, your account), so they can show something else.');
  });

  it('Search Console near the top while our check found nothing in the top 50: both in one sentence', () => {
    const note = rankCheckNote({ ...base, history: after, gsc: { impressions: 10, clicks: 1, position: 4.7, measuredAt: '2026-11-06', urls: [] } });
    expect(note).toMatch(/^Search Console shows this page at about #4\.7 on average \(10 times shown, every search and place, last 28 days\), while our check of "ai automation services pakistan" did not find it in the top 50, because .+\. We check Google Pakistan/);
    // a page Search Console sees far down, or one we found, gets only the how-we-check line
    expect(rankCheckNote({ ...base, history: after, gsc: { impressions: 3, clicks: 0, position: 34, measuredAt: '', urls: [] } })).toMatch(/^We check/);
    expect(rankCheckNote({ ...base, history: [{ checkedAt: '2026-11-08T19:38:00Z', position: 6 }], gsc: { impressions: 10, clicks: 1, position: 4.7, measuredAt: '', urls: [] } })).toMatch(/^We check/);
  });

  it('only checks from before the page went live: says they do not count; never checked: nothing', () => {
    expect(rankCheckNote({ ...base, history: [after[0]] })).toBe('Our last check, on 30 Oct 2026, was taken before the page went live on 30 Oct 2026, so it does not count; the next weekly check on Google Pakistan (google.com.pk), desktop, not signed in, is the first one that does.');
    expect(rankCheckNote({ ...base, history: [] })).toBe('');
    expect(rankCheckNote({ ...base, history: [{ checkedAt: '2026-11-06T01:13:00Z', position: -1 }] })).toBe('');
    expect(rankCheckNote({ ...base, country: '', iso: '', history: after })).toMatch(/^We check Google, desktop/);
  });

  it('plain customer copy: no em dash, curly quotes or ellipsis character', () => {
    const notes = [rankCheckNote({ ...base, history: after }), rankCheckNote({ ...base, history: after, gsc: { impressions: 1, clicks: 0, position: 10, measuredAt: '', urls: [] } }), rankCheckNote({ ...base, history: [after[0]] })];
    for (const n of notes) expect(n).not.toMatch(/[—–‘’“”…]/);
    expect(dayText('not a date')).toBe('');
  });
});

describe('a page\'s own Search Console figures', () => {
  const rows = [
    { url: `${D}/insights/ai-in-industrial-automation`, impressions: 10, clicks: 1, position: 4.7, measured_at: '2026-11-06T01:18:48Z' },
    { url: `${D}/ai-automation-services-pakistan`, impressions: 1, clicks: 0, position: 10, measured_at: '2026-11-06T01:18:48Z' },
    { url: `${D}/services/ai-automation-services-pakistan`, impressions: 3, clicks: 1, position: 6, measured_at: '2026-11-07T01:00:00Z' },
    { url: `${D}/never-measured`, impressions: 0, clicks: 0, position: 0, measured_at: '' },
  ];

  it('one address: its figures', () => {
    expect(pageSearchConsole([`https://www.novaand-demo.com/insights/ai-in-industrial-automation/`], rows)).toEqual({ impressions: 10, clicks: 1, position: 4.7, measuredAt: '2026-11-06T01:18:48Z', urls: [`${D}/insights/ai-in-industrial-automation`] });
  });

  it('an address and the one it moved to: added up, position over the impressions', () => {
    const g = pageSearchConsole([`${D}/ai-automation-services-pakistan`, `${D}/services/ai-automation-services-pakistan`], rows)!;
    expect(g).toMatchObject({ impressions: 4, clicks: 1, position: 7, measuredAt: '2026-11-07T01:00:00Z' });
    expect(g.urls).toHaveLength(2);
  });

  it('never measured or not listed: null', () => {
    expect(pageSearchConsole([`${D}/never-measured`], rows)).toBeNull();
    expect(pageSearchConsole([`${D}/unknown`], rows)).toBeNull();
    expect(pageSearchConsole([], rows)).toBeNull();
  });
});
