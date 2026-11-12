import { describe, expect, it } from 'vitest';
import {
  buildIndexingData,
  INDEX_ESCALATED,
  INDEX_ESCALATED_LEAD,
  INDEX_LINKED_WAITING,
  INDEX_MARKED_UTILITY_GROUP,
  INDEX_MARKED_UTILITY_NOTE,
  INDEX_TYPE_PENDING_GROUP,
  INDEX_UTILITY_GROUP,
  INDEXING_SITEMAP_DATES_KEY,
  indexEscalationSteps,
  indexingSitemapDatesReading,
  indexPageChecks,
  indexPageOf,
  indexPagesPage,
  indexPageTypeAction,
  indexRunOf,
  indexUtilityCardText,
  indexWaitingTodo,
  isIndexPageType,
  sitemapDateEntries,
  sitemapDatesGood,
  sitemapDatesMissing,
  type IndexingSitemapDatesReading,
} from './indexing';
import { deriveSiteTasks, siteTaskKindOfKey, siteTaskPayload, sitemapDatesLine, type SiteTaskInputs, type StoredSiteTask } from './site-tasks';
import { guideById, guideForNeedsYou, guideForRecommendation, guideText, INDEXING_GUIDE } from './guides';
import { AUDIT_ACTIONS } from './identity';
import type { IndexPageRow, IndexRunRow } from './tables';

// Index coverage wave 3 (n8n/seo-agent/docs/indexing-2026-10-29/DESIGN_WAVE3.md §3), the app half, on devaicon-shaped rows (anonymised as
// novaand-demo.com, the evidence of §0): 13 pages Google has not visited (2 Open edX sub-pages, 6 job pages, 3 industry pages, 2 insights),
// the policy pages left out, a sitemap with no <lastmod>. Each case describes behaviour the pre-wave-3 code did not have.

const D = 'novaand-demo.com';
const U = (p: string) => `https://${D}${p}`;
const RUN = '2026-11-12T05:15:00.000Z';
const settings = { on: true, dailyCap: 300 };
const NOW = Date.parse('2026-11-12T12:00:00.000Z');
const page = (o: Partial<IndexPageRow>): Partial<IndexPageRow> => ({ lane: 'existing', state: 'not_indexed', inspect_at: RUN, fetch_at: RUN, http_status: 200, in_sitemap: true, ...o });
const wait = (path: string, o: Partial<IndexPageRow> = {}) =>
  page({ url: U(path), cause: 'unknown_to_google', action: 'wait', linked_by: JSON.stringify([U('/')]), robots_ok: 'yes', link_depth: 1, linked_n: 3, words: 900, ...o });
const run = (o: Partial<IndexRunRow> & { dates?: Record<string, number> } = {}): Partial<IndexRunRow> => {
  const { dates, ...rest } = o;
  return { run_at: RUN, known: 40, indexed: 18, inspected: 40, ...(dates ? { sitemaps_json: JSON.stringify({ submitted: 1, read: 1, complete: true, dates }) } : {}), ...rest };
};
const NO_DATES = { urls: 40, with_lastmod: 0, distinct: 0 };
const BANNED = /[–—…‘’“”]|\.\.\.|guarantee|instant|get indexed|we ask google|delve|seamless|leverage|unlock/i;

/** devaicon.com on 2026-11-12 (DESIGN_WAVE3 §0), with the engine's wave-3 columns */
const devaicon = (): Partial<IndexPageRow>[] => [
  wait('/capabilities/open-edx-services/hosting', { priority: 1, ask_google: true, impressions_28d: 4 }),
  wait('/capabilities/open-edx-services/support', { priority: 2, ask_google: true, link_depth: 2, linked_by: JSON.stringify([U('/capabilities/open-edx-services')]), linked_n: 1 }),
  wait('/industries/professional-services', { priority: 3, ask_google: true, link_depth: 2, linked_by: JSON.stringify([U('/industries')]) }),
  wait('/industries/public-sector', { priority: 4 }),
  wait('/industries/retail', { priority: 5 }),
  wait('/insights/agentic-ai', { priority: 6, words: 240 }),
  wait('/insights/value-driven-innovation-automation', { priority: 7 }),
  ...['dev', 'qa', 'pm', 'design', 'sales', 'ops'].map((j, i) => wait(`/careers/${j}`, { priority: 8 + i, words: 200 })),
  page({ url: U('/privacy'), cause: 'low_value', action: 'leave_out', state: 'excluded', impressions_28d: 3 }),
  page({ url: U('/cookies'), cause: 'low_value', action: 'leave_out', state: 'excluded' }),
  page({ url: U('/'), cause: 'indexed', action: 'none', state: 'indexed' }),
];
const data = (rows = devaicon(), runs: Partial<IndexRunRow>[] = [run({ dates: NO_DATES })], freeze = false) =>
  buildIndexingData({ rows, runs: runs.map((r) => ({ ...r, freeze })), events: [], impacts: [], settings, now: NOW });

describe('the columns the engine adds (DESIGN_WAVE3 §2.1), and old rows as they were', () => {
  it('reads priority, escalation, the override, robots.txt, link depth, links and IndexNow from the row', () => {
    const p = indexPageOf(wait('/x', { priority: 3, escalated_at: '2026-11-11T05:15:00Z', escalate_why: 'weak_links,bogus,not_asked', type_override: 'IMPORTANT', robots_ok: 'no', link_depth: '2', linked_n: '1', indexnow_at: '2026-11-10T05:15:00Z' }));
    expect(p).toMatchObject({ priority: 3, doFirst: true, escalatedAt: '2026-11-11T05:15:00Z', typeOverride: 'important', robotsOk: 'no', linkDepth: 2, linkedN: 1, indexnowAt: '2026-11-10T05:15:00Z' });
    // the engine's order, unknown codes dropped
    expect(p.escalateWhy).toEqual(['not_asked', 'weak_links']);
    expect(indexPageOf(wait('/y', { priority: 6 })).doFirst).toBe(false);
  });
  it('a row without the new columns reads as before: no rank, no escalation, no mark, nothing read', () => {
    const p = indexPageOf({ url: U('/old'), lane: 'existing', state: 'not_indexed', cause: 'unknown_to_google', action: 'wait', inspect_at: RUN });
    expect(p).toMatchObject({ priority: 0, doFirst: false, escalatedAt: '', escalateWhy: [], typeOverride: '', typePending: false, robotsOk: '', linkDepth: 0, linkedN: 0, indexnowAt: '', inSitemapRead: false });
    const d = buildIndexingData({ rows: [{ url: U('/old'), lane: 'existing', state: 'not_indexed', cause: 'unknown_to_google', action: 'wait', inspect_at: RUN, linked_by: JSON.stringify([U('/')]) }], runs: [run()], events: [], impacts: [], settings });
    expect(d.escalated).toEqual([]);
    expect(d.sitemapDates).toBeNull();
    // the waiting group's to-do says only what applies: nothing to ask, no dates step, no link to add
    expect(d.groups[0].todo).toMatchObject({ total: 1, matterMost: 0, askToday: 0, notFromHome: 0, sitemapDates: false });
    expect(d.groups[0].todo!.text).toBe('Google has not visited 1 page. There is nothing to do on them today: we look them up again every day and tell Bing about them.');
  });
});

describe('§3.1 "Google has not visited these yet" is a to-do', () => {
  it('the summary sentence has only the parts that apply, and the pages follow the engine\'s ranking with "Do first" on the top 5', () => {
    const d = data();
    const g = d.groups.find((x) => x.cause === 'linked_waiting')!;
    expect(g.count).toBe(13);
    expect(g.todo!.text).toBe('Google has not visited 13 pages. 5 matter most. Do these 3 things: ask Google to read 3 pages today; add dates to your sitemap; link 2 pages from your home page or menu.');
    expect(g.pages.map((p) => p.path).slice(0, 3)).toEqual(['/capabilities/open-edx-services/hosting', '/capabilities/open-edx-services/support', '/industries/professional-services']);
    expect(g.pages.filter((p) => p.doFirst).map((p) => p.priority)).toEqual([1, 2, 3, 4, 5]);
    // the same order when the group is paged (A19)
    expect(indexPagesPage(devaicon(), { lane: 'existing', action: 'wait', cause: 'linked_waiting', pageSize: 5 }).items.map((p) => p.priority)).toEqual([1, 2, 3, 4, 5]);
    // "nothing on these pages" is gone
    expect(INDEX_LINKED_WAITING.youDo).not.toMatch(/^Nothing/);
  });
  it('one part only: "Do this"; a sitemap with usable dates is not asked for', () => {
    const rows = [wait('/a', { ask_google: true, priority: 1 }), wait('/b', { priority: 2 })];
    const t = indexWaitingTodo(rows.map(indexPageOf), { sitemapNoDates: false, now: NOW });
    expect(t.text).toBe('Google has not visited 2 pages. 2 matter most. Do this: ask Google to read 1 page today.');
    // a page asked about two days ago waits for Google: it is not asked for again
    const asked = indexWaitingTodo([indexPageOf(wait('/a', { ask_google: true, asked_google_at: '2026-11-10T09:00:00Z' }))], { sitemapNoDates: false, now: NOW });
    expect(asked.askToday).toBe(0);
  });
  it('"What we checked": every value from the row; a value we could not read is "not checked", never a pass', () => {
    const full = indexPageChecks(indexPageOf(wait('/insights/agentic-ai', { words: 240, indexnow_at: '2026-11-10T05:15:00Z' })));
    expect(full.map((c) => [c.key, c.status, c.text])).toEqual([
      ['opens', 'ok', 'Opens (200)'],
      ['indexable', 'ok', 'Can be indexed (no noindex)'],
      ['robots', 'ok', 'robots.txt allows it'],
      ['sitemap', 'ok', 'In your sitemap'],
      ['links', 'ok', 'Linked from your home page (3 pages)'],
      ['words', 'warn', '240 words'],
      ['bing', 'ok', 'Sent to Bing 10 Nov'],
    ]);
    const unread = indexPageChecks(indexPageOf({ url: U('/z'), state: 'not_indexed', cause: 'unknown_to_google', action: 'wait', linked_by: 'unread' }));
    expect(unread.every((c) => c.status === 'unknown')).toBe(true);
    expect(unread.map((c) => c.text)).toEqual(['Opens: not checked', 'Can be indexed: not checked', 'robots.txt: not checked', 'Sitemap: not checked', 'Links to it: not checked', 'Length: not checked']);
    const failed = indexPageChecks(indexPageOf(page({ url: U('/f'), http_status: 500, noindex: 'header', robots_ok: 'no', in_sitemap: false, linked_by: '', cause: 'unknown_to_google', action: 'links' })));
    expect(failed.filter((c) => c.status === 'fail').map((c) => c.text)).toEqual(['Answers 500', 'Says noindex in the server answer', 'robots.txt blocks it', 'Not in your sitemap', 'No page of yours links to it that we found']);
    // one page linking in, not the home page: a warning; a job posting is never "short"
    expect(indexPageChecks(indexPageOf(wait('/s', { link_depth: 2, linked_n: 1, linked_by: JSON.stringify([U('/industries')]) }))).find((c) => c.key === 'links')).toMatchObject({ status: 'warn', text: 'Linked from /industries' });
    expect(indexPageChecks(indexPageOf(wait('/careers/dev', { words: 200 }))).find((c) => c.key === 'words')!.status).toBe('ok');
  });
});

describe('§3.2 Needs you: Google has not visited after 3 weeks', () => {
  const esc = (path: string, why: string, o: Partial<IndexPageRow> = {}) => wait(path, { escalated_at: '2026-11-11T05:15:00Z', escalate_why: why, ...o });
  it('escalated pages leave the waiting group, are listed by priority and count as needing you', () => {
    const rows = [...devaicon(), esc('/insights/old-1', 'not_asked,weak_links', { priority: 2, linked_n: 1, link_depth: 2 }), esc('/insights/old-0', 'short_page', { priority: 1, words: 180, action: 'links' })];
    const d = data(rows);
    expect(d.escalated.map((p) => p.path)).toEqual(['/insights/old-0', '/insights/old-1']);
    expect(d.groups.some((g) => g.pages.some((p) => p.escalatedAt))).toBe(false);
    expect(d.groups.find((g) => g.cause === 'linked_waiting')!.count).toBe(13);
    // one is a `links` page (already counted), the other `wait`: both need you
    expect(d.totals.needYou - data().totals.needYou).toBe(2);
    expect(INDEX_ESCALATED.label).toBe('Needs you: Google has not visited after 3 weeks');
  });
  it('each reason is a step, in order, with its guide; a short page waits for the Google update to finish, with no Improve button', () => {
    const p = indexPageOf(esc('/insights/x', 'not_asked,asked_no_visit,weak_links,short_page,not_in_sitemap,sitemap_no_dates', { linked_n: 1, link_depth: 2, words: 180 }));
    const steps = indexEscalationSteps(p, { freeze: false });
    expect(steps.map((s) => [s.code, s.guide])).toEqual([
      ['not_asked', 'index-request-indexing'],
      ['asked_no_visit', 'index-add-internal-links'],
      ['weak_links', 'index-add-internal-links'],
      ['short_page', null],
      ['not_in_sitemap', 'index-not-in-sitemap'],
      ['sitemap_no_dates', 'index-sitemap-dates'],
    ]);
    expect(steps[2].text).toBe('Only 1 page links here and your home page does not: link it from your home page or main menu.');
    expect(steps[3]).toMatchObject({ text: 'The page is short (180 words): add what a buyer needs to know.', improve: true });
    const frozen = indexEscalationSteps(p, { freeze: true }).find((s) => s.code === 'short_page')!;
    expect(frozen).toMatchObject({ improve: false });
    expect(frozen.text).toContain("after Google's update finishes");
    // every guide named exists
    for (const s of steps) if (s.guide) expect(guideById(s.guide)).toBeTruthy();
    expect(INDEX_ESCALATED_LEAD).toBe('Google has not visited this page in the 3 weeks we have watched it.');
  });
  it('a page Google visited, a page in search or a page the client left out is never escalated', () => {
    expect(indexPageOf(esc('/a', 'not_asked', { state: 'indexed', cause: 'indexed', action: 'none' })).escalatedAt).toBe('');
    expect(indexPageOf(esc('/b', 'not_asked', { type_override: 'utility' })).escalatedAt).toBe('');
    expect(indexPageOf(esc('/c', 'not_asked', { action: 'quality', cause: 'crawled_not_indexed' })).escalatedAt).toBe('');
  });
});

describe('§3.4 policy pages and the client\'s own mark', () => {
  it('the policy card names its pages, offers "This is an important page" and the sitemap tip', () => {
    const d = data();
    const g = d.groups.find((x) => x.cause === 'utility')!;
    expect(g.meaning).toBe('2 pages look like policy pages (privacy, cookies). They do not need to be in Google. If one of them should rank, press This is an important page.');
    expect(g.youDo).toContain('You may also leave them out of your sitemap; it is optional.');
    expect(INDEX_UTILITY_GROUP.label).toBe('Policy and utility pages: fine to leave out');
    expect(indexPageTypeAction(g.pages[0])).toMatchObject({ type: 'important', label: 'This is an important page' });
    expect(indexUtilityCardText([{ path: '/legal/terms-of-use' }])).toBe('1 page looks like a policy page (terms of use). It does not need to be in Google. If it should rank, press This is an important page.');
  });
  it('"Fine to leave out" on other pages not in search; nothing on pages in search, left out already, or not checked', () => {
    const d = data();
    expect(indexPageTypeAction(d.groups.find((x) => x.cause === 'linked_waiting')!.pages[0])).toMatchObject({ type: 'utility', label: 'Fine to leave out' });
    expect(indexPageTypeAction(indexPageOf(page({ url: U('/'), state: 'indexed', cause: 'indexed', action: 'none' })))).toBeNull();
    expect(indexPageTypeAction(indexPageOf(page({ url: U('/tag/x'), cause: 'low_value', action: 'leave_out', state: 'excluded' })))).toBeNull();
    expect(indexPageTypeAction(indexPageOf(page({ url: U('/n'), state: 'unknown', cause: '', action: '' })))).toBeNull();
  });
  it('marked fine to leave out: shown at once as left out on purpose, with Undo; never asked about, ranked or escalated', () => {
    const p = indexPageOf(wait('/careers/dev', { type_override: 'utility', ask_google: true, priority: 8, escalated_at: '2026-11-11T05:15:00Z', escalate_why: 'not_asked' }));
    expect(p).toMatchObject({ action: 'leave_out', cause: 'low_value', askGoogle: false, priority: 0, doFirst: false, escalatedAt: '', note: INDEX_MARKED_UTILITY_NOTE });
    expect(indexPageTypeAction(p)).toEqual({ type: '', label: 'Undo', text: 'You marked this page as fine to leave out of Google.' });
    const d = data([...devaicon(), wait('/careers/old', { type_override: 'utility' })]);
    const g = d.groups.find((x) => x.cause === 'marked_utility')!;
    expect(g).toMatchObject({ action: 'leave_out', count: 1, label: INDEX_MARKED_UTILITY_GROUP.label });
    // left out on purpose: not counted among the pages that should be in search; a page in search keeps its state
    expect(d.totals.shouldBe).toBe(data().totals.shouldBe);
    expect(indexPageOf(page({ url: U('/'), state: 'indexed', cause: 'indexed', action: 'none', type_override: 'utility' }))).toMatchObject({ state: 'indexed', action: 'none' });
  });
  it('marked important: a policy page waits for our next check, then is a normal page with Undo', () => {
    const pending = indexPageOf(page({ url: U('/privacy'), cause: 'low_value', action: 'leave_out', state: 'excluded', type_override: 'important' }));
    expect(pending).toMatchObject({ utility: false, typePending: true, action: 'wait' });
    expect(pending.note).toContain('You marked this page as important.');
    expect(indexPageTypeAction(pending)).toMatchObject({ type: '', label: 'Undo', text: 'You marked this page as important.' });
    const d = data([page({ url: U('/privacy'), cause: 'low_value', action: 'leave_out', state: 'excluded', type_override: 'important' })]);
    expect(d.groups.map((g) => g.cause)).toEqual(['type_pending']);
    expect(d.groups[0].label).toBe(INDEX_TYPE_PENDING_GROUP.label);
    // the engine's next run gave it its normal reason: a normal page, offered for Ask Google, never "fine to leave out" again
    const after = indexPageOf(page({ url: U('/privacy'), cause: 'crawled_not_indexed', action: 'quality', type_override: 'important', ask_google: true }));
    expect(after).toMatchObject({ utility: false, typePending: false, action: 'quality', askGoogle: true });
  });
  it('an undone mark waits for our next check while the engine\'s row still says the client left it out', () => {
    const p = indexPageOf(wait('/careers/dev', { cause: 'low_value', action: 'leave_out', type_override: '', note: 'You marked this page as fine to leave out of Google.' }));
    expect(p).toMatchObject({ typePending: true, action: 'wait', typeOverride: '' });
    expect(indexPageTypeAction(p)).toBeNull();
  });
  it('the three values, nothing else; the audit log names the action', () => {
    expect(['important', 'utility', ''].every(isIndexPageType)).toBe(true);
    expect([undefined, null, 'Important ', 'policy', 1].some(isIndexPageType)).toBe(false);
    expect(AUDIT_ACTIONS['indexing.page_type']).toMatchObject({ category: 'websites' });
  });
});

describe('§3.3 the sitemap dates step (indexing:sitemap_dates)', () => {
  it('the rules: the engine\'s "no usable dates" and the app\'s own "done"', () => {
    expect(sitemapDatesMissing({ urls: 40, withLastmod: 0, distinct: 0 })).toBe(true);
    expect(sitemapDatesMissing({ urls: 4, withLastmod: 0, distinct: 0 })).toBe(false);
    expect(sitemapDatesMissing({ urls: 40, withLastmod: 40, distinct: 1 })).toBe(true);
    expect(sitemapDatesMissing({ urls: 9, withLastmod: 9, distinct: 1 })).toBe(false);
    expect(sitemapDatesMissing({ urls: 40, withLastmod: 25, distinct: 6 })).toBe(false);
    expect(sitemapDatesGood({ urls: 40, withLastmod: 25, distinct: 6 })).toBe(false);
    expect(sitemapDatesGood({ urls: 40, withLastmod: 36, distinct: 6 })).toBe(true);
    expect(sitemapDatesGood({ urls: 40, withLastmod: 40, distinct: 1 })).toBe(false);
    expect(sitemapDatesGood({ urls: 8, withLastmod: 8, distinct: 1 })).toBe(true);
    expect(sitemapDatesGood({ urls: 0, withLastmod: 0, distinct: 0 })).toBe(false);
  });
  it('review M2: a sitemap the engine could not read in full, or an empty reading, decides nothing', () => {
    expect(indexRunOf(run({ dates: { urls: 0, with_lastmod: 0, distinct: 0, read: false } })).sitemaps!.dates).toBeNull();
    expect(indexRunOf(run({ dates: { urls: 40, with_lastmod: 40, distinct: 12, read: false } })).sitemaps!.dates).toBeNull();
    expect(indexRunOf(run({ dates: { urls: 0, with_lastmod: 0, distinct: 0 } })).sitemaps!.dates).toBeNull();
    // the newest run read nothing: the reading before it still decides
    const r = indexingSitemapDatesReading([run({ run_at: '2026-11-12T05:15:00.000Z', dates: { urls: 0, with_lastmod: 0, distinct: 0, read: false } }), run({ dates: NO_DATES })]);
    expect(r && r.missing).toBe(true);
  });
  it('review M1: a page the home page links is never told "your home page does not" link it', () => {
    const p = indexPageOf(wait('/industries/retail', { escalated_at: '2026-11-11T05:15:00Z', escalate_why: 'not_asked,weak_links', linked_n: 1, link_depth: 1, linked_by: JSON.stringify(['https://devaicon.com/']) }));
    const t = indexEscalationSteps(p, { freeze: false }).find((x) => x.code === 'weak_links')!.text;
    expect(t).toBe('Only your home page links here: also link it from related pages.');
    expect(t).not.toContain('does not');
  });
  it('reads `sitemaps_json.dates` from the newest run that read the website; an older row has none', () => {
    expect(indexRunOf(run({ dates: NO_DATES })).sitemaps!.dates).toEqual({ urls: 40, withLastmod: 0, distinct: 0 });
    expect(indexRunOf(run({ sitemaps_json: JSON.stringify({ submitted: 1 }) })).sitemaps!.dates).toBeNull();
    const r = indexingSitemapDatesReading([run({ run_at: '2026-11-11T05:15:00.000Z', dates: { urls: 40, with_lastmod: 40, distinct: 12 } }), run({ dates: NO_DATES })]);
    expect(r).toMatchObject({ at: RUN, urls: 40, missing: true });
    expect(data().sitemapDates).toMatchObject({ missing: true, urls: 40 });
  });
  it('lists each <url> with its day; a sitemap index is not counted', () => {
    const xml = '<urlset><url><loc>https://x.com/a</loc><lastmod>2026-11-01T10:00:00+00:00</lastmod></url><url><loc>https://x.com/b?x=1&amp;y=2</loc></url></urlset>';
    expect(sitemapDateEntries(xml)).toEqual([{ loc: 'https://x.com/a', day: '2026-11-01' }, { loc: 'https://x.com/b?x=1&y=2', day: '' }]);
    expect(sitemapDateEntries('<sitemapindex><sitemap><loc>https://x.com/s1.xml</loc><lastmod>2026-11-01</lastmod></sitemap></sitemapindex>')).toEqual([]);
  });

  const base: SiteTaskInputs = { domain: D, indexnow: null, access: null, reclaim: null };
  const reading = (o: Partial<IndexingSitemapDatesReading> = {}): IndexingSitemapDatesReading => ({ at: RUN, urls: 40, withLastmod: 0, distinct: 0, missing: true, ...o });
  const inputs = (sd: IndexingSitemapDatesReading | null): SiteTaskInputs => ({ ...base, indexing: { runAt: RUN, causes: [], sitemapDates: sd } });
  const stored = (o: Partial<StoredSiteTask> = {}): StoredSiteTask => ({ key: INDEXING_SITEMAP_DATES_KEY, kind: 'indexing', payload: { cause: 'sitemap_dates', urls: 40, withLastmod: 0, distinct: 0 }, lastCheck: null, doneAt: null, skippedAt: null, skippedBy: null, createdAt: '2026-11-12T06:00:00.000Z', ...o });

  it('raised by the engine\'s reading, with its guide and the counts; never raised from a sitemap with usable dates', () => {
    const [t] = deriveSiteTasks(inputs(reading()), []);
    expect(t).toMatchObject({ key: 'indexing:sitemap_dates', kind: 'indexing', state: 'todo', severity: 'info', guide: 'index-sitemap-dates', title: 'Add the date each page last changed to your sitemap' });
    expect(t.detail).toContain('Your sitemap lists 40 pages and gives no date for any of them.');
    expect(t.lastCheck).toMatchObject({ by: 'index', ok: false });
    expect(t.values).toEqual([{ label: 'Your sitemap', value: `https://${D}/sitemap.xml` }]);
    expect(deriveSiteTasks(inputs(reading({ withLastmod: 40, distinct: 12, missing: false })), [])).toEqual([]);
    expect(deriveSiteTasks(inputs(null), [])).toEqual([]);
    expect(siteTaskKindOfKey('indexing:sitemap_dates')).toBe('indexing');
    expect(siteTaskPayload(inputs(reading()), [], 'indexing:sitemap_dates')).toEqual({ kind: 'indexing', payload: { cause: 'sitemap_dates', urls: 40, withLastmod: 0, distinct: 0 } });
  });
  it('our own check marks it done; the engine\'s next reading decides when newer; a stored step keeps its state when nothing was read', () => {
    const ours = { at: '2026-11-12T08:00:00.000Z', ok: true, by: 'you' as const, message: 'Your sitemap lists 40 pages and gives a date for each of them.' };
    const [done] = deriveSiteTasks(inputs(reading()), [stored({ lastCheck: ours, doneAt: ours.at })]);
    expect(done.state).toBe('done');
    expect(done.detail).toContain('Your sitemap gives the date each page last changed.');
    // the next morning the engine still reads no usable dates: reopened
    const [again] = deriveSiteTasks(inputs(reading({ at: '2026-11-13T05:15:00.000Z' })), [stored({ lastCheck: ours, doneAt: ours.at })]);
    expect(again).toMatchObject({ state: 'todo', reopened: true, severity: 'warning' });
    // the engine reads usable dates after the step was stored: done by the daily index check
    const [byEngine] = deriveSiteTasks(inputs(reading({ at: '2026-11-13T05:15:00.000Z', withLastmod: 40, distinct: 9, missing: false })), [stored()]);
    expect(byEngine).toMatchObject({ state: 'done', lastCheck: { by: 'index', ok: true } });
    const [kept] = deriveSiteTasks(inputs(null), [stored()]);
    expect(kept.state).toBe('todo');
  });
  it('guides: the step, Needs you and the recommendation open "index-sitemap-dates", which says what lastmod is and never to use the build time', () => {
    expect(INDEXING_GUIDE.sitemap_dates).toBe('index-sitemap-dates');
    expect(guideForNeedsYou({ id: 'task:indexing:sitemap_dates', kind: 'site_task', severity: 'info' })).toBe('index-sitemap-dates');
    expect(guideForRecommendation('ix:site_fix:sitemap_dates')).toBe('index-sitemap-dates');
    expect(guideForRecommendation('ix:site_fix:sitemap')).toBe('index-submit-sitemap');
    const g = guideById('index-sitemap-dates')!;
    const t = guideText(g, { domain: D });
    expect(t).toMatch(/lastmod/);
    expect(t).toMatch(/only when the dates are accurate/i);
    expect(t).toMatch(/never set every page to today or to the time the site was built/i);
    expect(t).toMatch(/WordPress/);
    expect(t).toMatch(/lastModified/);
    expect(t).not.toMatch(BANNED);
  });
});

describe('copy (owner rule): no dashes, curly quotes, "...", stock phrases or promises', () => {
  it('every new sentence', () => {
    const d = data([...devaicon(), wait('/careers/old', { type_override: 'utility' }), page({ url: U('/privacy-2'), cause: 'low_value', action: 'leave_out', state: 'excluded', type_override: 'important' })]);
    const p = indexPageOf(wait('/x', { escalated_at: RUN, escalate_why: 'not_asked,asked_no_visit,weak_links,short_page,not_in_sitemap,sitemap_no_dates', linked_n: 0, link_depth: 0, linked_by: '', words: 100 }));
    const strings = [
      ...d.groups.flatMap((g) => [g.label, g.meaning, g.weDo, g.youDo, g.todo?.text ?? '', ...g.pages.map((x) => x.note)]),
      ...Object.values(INDEX_ESCALATED),
      ...Object.values(INDEX_MARKED_UTILITY_GROUP),
      ...Object.values(INDEX_TYPE_PENDING_GROUP),
      INDEX_ESCALATED_LEAD,
      ...indexEscalationSteps(p, { freeze: false }).map((s) => s.text),
      ...indexEscalationSteps(p, { freeze: true }).map((s) => s.text),
      ...indexPageChecks(p).map((c) => c.text),
      ...[{ urls: 40, withLastmod: 0, distinct: 0 }, { urls: 40, withLastmod: 20, distinct: 3 }, { urls: 40, withLastmod: 40, distinct: 1 }, { urls: 40, withLastmod: 40, distinct: 9 }].map(sitemapDatesLine),
      ...deriveSiteTasks({ domain: D, indexnow: null, access: null, reclaim: null, indexing: { runAt: RUN, causes: [], sitemapDates: { at: RUN, urls: 40, withLastmod: 0, distinct: 0, missing: true } } }, []).flatMap((t) => [t.title, t.detail]),
    ];
    for (const x of strings) expect(x, x).not.toMatch(BANNED);
  });
});
