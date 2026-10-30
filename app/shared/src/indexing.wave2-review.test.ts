import { describe, expect, it } from 'vitest';
import {
  askGoogleStatus,
  INDEXING_LINKS_KEY,
  indexPageOf,
  indexRunOf,
  indexSitemapState,
  isUtilityPage,
  pageLinksTo,
  SITEMAP_BLOCKED,
  sitemapBlockedText,
} from './indexing';
import { deriveSiteTasks, type SiteTaskInputs } from './site-tasks';
import { guideById, guideText } from './guides';
import type { IndexPageRow, IndexRunRow } from './tables';

// Index coverage wave 2 review (n8n/seo-agent/docs/indexing-2026-10-29/REVIEW_WAVE2.md), the app's findings: W1 "we will submit it" only
// when the engine says so (`sitemaps_json.submit.will_submit`), otherwise the step and the engine's reason (`submit.blocked`); W3 the utility
// rule on the first path segment; W7 a refusal is not read-only access; W9 never "nothing more to do" for a page that needs the client;
// W10 / W11 copy; W14 the own link check (nofollow, <base href>, scripts and styles).

const D = 'novaand-demo.com';
const U = (p: string) => `https://${D}${p}`;
const RUN = '2026-10-30T06:00:00.000Z';
const run = (sm: Record<string, unknown>, at = RUN): Partial<IndexRunRow> => ({ run_at: at, known: 10, inspected: 5, sitemaps_json: JSON.stringify(sm) });
const base: SiteTaskInputs = { domain: D, indexnow: null, access: null, reclaim: null };
const none = { at: RUN, submitted: 0, errors: 0 };
/** the owner's copy rules (no em dash, curly quotes, ellipsis; never promise indexing, never "we ask Google", never that we change the site) */
const cleanCopy = (t: string) => {
  expect(t).not.toMatch(/[—–‘’“”…]|\.\.\./);
  expect(t).not.toMatch(/will be indexed|guarantee|we ask google|we request|we change your (web)?site|we fix your/i);
};

describe('W1: "we will submit it" only when the engine says it will', () => {
  it('reads `submit.will_submit` / `submit.blocked`; an older row without them promises nothing; an unknown code is no reason', () => {
    const full = { submitted: 0, submitted_errors: 0, permission: 'siteFullUser', permission_full: true };
    expect(indexSitemapState([indexRunOf(run({ ...full, submit: { on: true, gate: 'ok', will_submit: true, blocked: '' } }))], true)).toMatchObject({ access: 'full', willSubmit: true, blocked: '' });
    // Full access and the switch on is NOT enough (the review: kill switch, no readable sitemap, another property)
    expect(indexSitemapState([indexRunOf(run(full))], true)).toMatchObject({ access: 'full', willSubmit: false, blocked: '' });
    expect(indexSitemapState([indexRunOf(run({ ...full, submit: { on: true, gate: 'ok' } }))], true).willSubmit).toBe(false);
    expect(indexSitemapState([indexRunOf(run({ ...full, submit: { on: true, will_submit: 'true' } }))], true).willSubmit).toBe(false);
    // the engine's own codes (`not_read` is the app's, from the gate)
    for (const b of SITEMAP_BLOCKED.filter((x) => x !== 'not_read'))
      expect(indexSitemapState([indexRunOf(run({ ...full, submit: { on: true, will_submit: false, blocked: b } }))], true).blocked, b).toBe(b);
    expect(indexSitemapState([indexRunOf(run({ ...full, submit: { on: true, will_submit: false, blocked: 'kill_switch' } }))], true).blocked).toBe('');
    // the switch off in the app: never "we will submit", whatever an older run said
    expect(indexSitemapState([indexRunOf(run({ ...full, submit: { on: true, will_submit: true } }))], false).willSubmit).toBe(false);
    // the NEWEST run decides (yesterday's "will submit" is not today's)
    const two = [
      indexRunOf(run({ ...full, submit: { on: true, will_submit: true } }, '2026-10-29T06:00:00.000Z')),
      indexRunOf(run({ ...full, submit: { on: true, will_submit: false, blocked: 'paused' } })),
    ];
    expect(indexSitemapState(two, true)).toMatchObject({ willSubmit: false, blocked: 'paused' });
    // a reservation row is never a reading
    expect(indexSitemapState([indexRunOf(run({ ...full, reservation: true, submit: { will_submit: true } }))], true).willSubmit).toBe(false);
  });

  it('every reason has plain words for the client; the switch off and an unknown code have none', () => {
    for (const b of SITEMAP_BLOCKED) {
      const t = sitemapBlockedText(b);
      if (b === 'switch_off') expect(t).toBe('');
      else {
        expect(t.length, b).toBeGreaterThan(30);
        cleanCopy(t);
      }
    }
    expect(sitemapBlockedText('')).toBe('');
    expect(sitemapBlockedText('not_full_access')).toMatch(/read-only access.*Full access/);
    expect(sitemapBlockedText('refused')).toMatch(/^Google refused our last submission/);
    expect(sitemapBlockedText('refused')).not.toMatch(/read-only|Full access/);
    expect(sitemapBlockedText('outside_property')).toMatch(/outside the Search Console property/);
    expect(sitemapBlockedText('unchanged')).toMatch(/nothing to submit/);
    expect(sitemapBlockedText('too_soon')).toMatch(/last 7 days/);
    expect(sitemapBlockedText('paused')).toMatch(/paused on our side/);
    expect(sitemapBlockedText('not_set_up')).toMatch(/not set up on our side/);
    expect(sitemapBlockedText('no_sitemap')).toMatch(/could not read a sitemap/);
  });

  it('the "Submit your sitemap" step: absent only when the engine will submit; otherwise present with the reason', () => {
    expect(deriveSiteTasks({ ...base, indexing: { runAt: RUN, causes: [], sitemap: none, sitemapAuto: true } }, []).map((t) => t.key)).toEqual([]);
    const [t] = deriveSiteTasks({ ...base, indexing: { runAt: RUN, causes: [], sitemap: none, sitemapAuto: false, sitemapBlocked: 'no_sitemap' } }, []);
    expect(t.key).toBe('indexing:sitemap');
    expect(t.detail).toContain('You switched on sitemap submission, but we will not submit it. We could not read a sitemap on your website');
    expect(t.guide).toBe('index-submit-sitemap');
    cleanCopy(t.detail);
    const [ro] = deriveSiteTasks({ ...base, indexing: { runAt: RUN, causes: [], sitemap: none, sitemapAuto: false, sitemapBlocked: 'not_full_access' } }, []);
    expect(ro.guide).toBe('search-console-full-access');
    expect(ro.detail).toContain('Google gives us read-only access');
    const [rf] = deriveSiteTasks({ ...base, indexing: { runAt: RUN, causes: [], sitemap: none, sitemapAuto: false, sitemapBlocked: 'refused' } }, []);
    expect(rf.detail).toContain('Google refused our last submission');
    expect(rf.detail).not.toContain('read-only');
    // the switch off: the step's own words (switch it on), no "you switched on"
    const [off] = deriveSiteTasks({ ...base, indexing: { runAt: RUN, causes: [], sitemap: none, sitemapAuto: false, sitemapBlocked: 'switch_off' } }, []);
    expect(off.detail).toContain('switch on sitemap submission in Tracking & monitors');
    expect(off.detail).not.toContain('You switched on');
  });
});

describe('W7: Google refused the submission at Full access', () => {
  it('is "refused", not read-only access', () => {
    const s = indexSitemapState([indexRunOf(run({ submitted: 0, permission: 'siteFullUser', permission_full: false, submit: { on: true, will_submit: false, blocked: 'refused' } }))], true);
    expect(s).toMatchObject({ access: 'refused', blocked: 'refused', willSubmit: false });
    expect(indexSitemapState([indexRunOf(run({ permission: 'siteOwner', submit: { on: true, will_submit: false, blocked: 'refused' } }))], true).access).toBe('refused');
    // read-only access stays read-only access
    expect(indexSitemapState([indexRunOf(run({ permission: 'siteRestrictedUser', permission_full: false, submit: { on: true, blocked: 'not_full_access' } }))], true).access).toBe('restricted');
  });
});

describe('W3: the utility rule (the engine\'s, mirrored)', () => {
  it('content pages whose path holds a utility word deeper down are not utility pages', () => {
    for (const p of ['/industries/legal', '/features/search', '/solutions/accessibility', '/services/legal/contracts', '/blog/thanks']) expect(isUtilityPage(U(p)), p).toBe(false);
    for (const p of ['/privacy', '/legal/notice', '/policies/returns', '/security', '/cookies']) expect(isUtilityPage(U(p)), p).toBe(true);
    // the page is no longer "Policy and utility pages" on the Indexing page
    expect(indexPageOf({ url: U('/industries/legal'), state: 'not_indexed', cause: 'crawled_not_indexed', action: 'quality' }).utility).toBe(false);
  });
});

describe('W9: a page that needs the client is never told "nothing more to do"', () => {
  const now = Date.parse('2026-11-20T10:00:00Z');
  it('the 14-day text', () => {
    const p = { askedGoogleAt: '2026-10-30T10:00:00Z', googleReadAfterAskAt: '' };
    expect(askGoogleStatus({ ...p, action: 'wait' }, now).text).toContain('There is nothing more to do on your side for now.');
    for (const action of ['site_fix', 'quality', 'links', 'duplicate', 'review'] as const) {
      const t = askGoogleStatus({ ...p, action }, now);
      expect(t.state).toBe('quiet');
      expect(t.text, action).not.toContain('nothing more to do');
      expect(t.text).toContain('has something to fix first');
    }
  });
  it('the engine\'s note on a page whose cause became a fix on the website', () => {
    const note = 'You asked Google on 30 Oct; Google has not read it again yet. There is nothing more to do on your side for now.';
    const row = (o: Partial<IndexPageRow>) => indexPageOf({ url: U('/capabilities/ai'), state: 'excluded', note, asked_google_at: '2026-10-30T10:00:00Z', ...o });
    expect(row({ cause: 'noindex', action: 'site_fix' }).note).toBe('You asked Google on 30 Oct; Google has not read it again yet.');
    expect(row({ cause: 'discovered_not_crawled', action: 'wait' }).note).toBe(note);
  });
});

describe('W10 / W11: copy', () => {
  it('the links step says only what we read (the home page and the related pages)', () => {
    const inputs: SiteTaskInputs = { ...base, indexing: { runAt: RUN, causes: [], links: { runAt: RUN, complete: true, targets: [{ url: U('/insights/a'), title: 'A', sources: [U('/insights')] }] } } };
    const t = deriveSiteTasks(inputs, []).find((x) => x.key === INDEXING_LINKS_KEY)!;
    expect(t.detail).not.toMatch(/no other page of your website links/);
    expect(t.detail).toContain('we did not find a link to it on the pages of your website we read (your home page and the related pages)');
    cleanCopy(t.detail);
  });
  it('the Search Console guide no longer says the service account reads "and nothing else"', () => {
    const g = guideText(guideById('search-console-access')!, { domain: D, serviceAccount: 'x@y.iam.gserviceaccount.com' });
    expect(g).not.toMatch(/reads your property and nothing else/);
    expect(g).toContain('unless you switch on sitemap submission');
  });
});

describe('W14: the own link check', () => {
  const T = U('/insights/agentic-ai');
  const at = (body: string, from = U('/insights')) => pageLinksTo(`<html><head><title>x</title></head><body>${body}</body></html>`, from, T);
  it('a nofollow link does not count; any other rel does', () => {
    expect(at('<a rel="nofollow" href="/insights/agentic-ai">x</a>')).toBe(false);
    expect(at('<a href="/insights/agentic-ai" rel="noopener nofollow">x</a>')).toBe(false);
    expect(at("<a href='/insights/agentic-ai' rel=NOFOLLOW>x</a>")).toBe(false);
    expect(at('<a href="/insights/agentic-ai" rel="noopener">x</a>')).toBe(true);
    expect(at('<a rel="nofollow" href="/other">x</a><a href="/insights/agentic-ai">y</a>')).toBe(true);
  });
  it('relative links resolve against <base href>', () => {
    expect(at('<a href="agentic-ai">x</a>', U('/blog/post'))).toBe(false);
    expect(pageLinksTo('<html><head><base href="/insights/"></head><body><a href="agentic-ai">x</a></body></html>', U('/blog/post'), T)).toBe(true);
    expect(pageLinksTo(`<html><head><base href="https://www.${D}/insights/"></head><body><a href="agentic-ai">x</a></body></html>`, U('/blog/post'), T)).toBe(true);
    // a base elsewhere: the relative link is not ours
    expect(pageLinksTo('<html><head><base href="https://cdn.example.org/insights/"></head><body><a href="agentic-ai">x</a></body></html>', U('/insights/x'), T)).toBe(false);
  });
  it('nothing inside <script> or <style> counts', () => {
    expect(at('<script>var s = \'<a href="/insights/agentic-ai">x</a>\';</script>')).toBe(false);
    expect(at('<script type="text/template"><a href="/insights/agentic-ai">x</a></script>')).toBe(false);
    expect(at('<style>/* <a href="/insights/agentic-ai"> */</style>')).toBe(false);
    expect(at('<script>var a = 1;</script><a href="/insights/agentic-ai">x</a>')).toBe(true);
    // an unclosed script swallows the rest of the page, as a browser would
    expect(at('<script>var s = "<a href=\'/insights/agentic-ai\'>";')).toBe(false);
  });
});

describe('the engine\'s review-fix contract (ENGINE_BUILD "Wave 2 review fixes")', () => {
  it('blocked \'\' while Google\'s access or the sitemap list could not be read today: "could not read", never a promise', () => {
    for (const gate of ['not_checked', 'list_not_read']) {
      const s = indexSitemapState([indexRunOf(run({ submitted: null, permission: 'siteFullUser', permission_full: true, submit: { on: true, gate, will_submit: false, blocked: '' } }))], true);
      expect(s, gate).toMatchObject({ willSubmit: false, blocked: 'not_read' });
    }
    expect(sitemapBlockedText('not_read')).toMatch(/^We could not read your Search Console today/);
    cleanCopy(sitemapBlockedText('not_read'));
    // nothing due (listed, unchanged): no reason and no promise
    expect(indexSitemapState([indexRunOf(run({ submitted: 1, permission: 'siteFullUser', submit: { on: true, gate: 'ok', will_submit: false, blocked: '' } }))], true)).toMatchObject({ willSubmit: false, blocked: '' });
  });
  it('a 403 keeps permission_full true with blocked refused: Google refused it, not read-only access', () => {
    const s = indexSitemapState([indexRunOf(run({ submitted: 0, permission: 'siteFullUser', permission_full: true, submit: { on: true, gate: 'denied_before', will_submit: false, blocked: 'refused' } }))], true);
    expect(s).toMatchObject({ access: 'refused', blocked: 'refused' });
  });
  it('a pending attempt is never shown as done; not_set_up is not submitted', () => {
    const s = indexSitemapState(
      [indexRunOf(run({ permission: 'siteFullUser', submissions: [
        { path: U('/sitemap.xml'), at: '2026-10-30T06:05:00Z', status: 'pending', reason: 'not_listed', http_status: 0 },
        { path: U('/news.xml'), at: '2026-10-30T06:05:00Z', status: 'not_set_up', reason: 'not_listed' },
      ] }))],
      true,
    );
    expect(s.submissions.map((x) => [x.path, x.status])).toEqual([[U('/sitemap.xml'), 'pending'], [U('/news.xml'), 'error']]);
  });
  it('/policies (the directory page) and /policies/cookies are utility pages; /en/cookie-policy is not', () => {
    expect(isUtilityPage(U('/policies'))).toBe(true);
    expect(isUtilityPage(U('/policies/cookies'))).toBe(true);
    expect(isUtilityPage(U('/en/cookie-policy'))).toBe(false);
  });
  it('linked_by \'unread\' (an unread parent too): nothing concluded, the page is not a page that needs a link because of it', () => {
    const p = indexPageOf({ url: U('/careers/data-engineer'), state: 'not_indexed', cause: 'unknown_to_google', action: 'wait', linked_by: 'unread' });
    expect(p).toMatchObject({ linkedRead: false, linkedBy: [], action: 'wait' });
  });
});
