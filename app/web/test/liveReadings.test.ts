import { describe, expect, it } from 'vitest';
import type { PageReviewSummary } from '@seo/shared';
import { liveCheckText, publishNoteSettled } from '../src/pages/site/_components/content-status';
import { reviewFacts } from '../src/pages/site/_components/review-status';
import { BEFORE_PUBLISH_NOTE, pageGscText, trafficHint } from '../src/pages/site/_components/pipeline/rank-notes';
import { fmtDate } from '../src/lib/utils';

// Production 2026-11-10 (devaicon.com): the Content card's grade is of the version we delivered, so a live page says so and shows what the
// publish check measured on the live page; the "sent at another address" warning gives way to "Moved" once the old address redirects; the
// ladder's traffic and pages say where their Search Console figures come from.
const tell = /[—–‘’“”…]/;

describe('the Content card of a live page', () => {
  it('the grade is of the version we delivered once the page is live', () => {
    const r = { grade: 82, questions: 0, answered: 0 } as unknown as PageReviewSummary;
    expect(reviewFacts(r)).toEqual(['grade 82/100']);
    expect(reviewFacts(r, { live: true })).toEqual(['grade of the version we delivered 82/100']);
  });

  it('the live check: passed of total and at most 3 failed checks by name', () => {
    const c = { at: '2026-11-10T10:03:31Z', passed: 9, total: 16, failed: ['Title tag uses the keyword', 'At least 2 content images', 'Every image has alt text', 'Descriptive image file names'], url: 'https://novaand-demo.com/x', reportId: 'r', live: true };
    expect(liveCheckText(c)).toBe(`Live page checked ${fmtDate(c.at)}: 9 of 16 checks passed. Not passed: Title tag uses the keyword; At least 2 content images; Every image has alt text and 1 more`);
    expect(liveCheckText({ ...c, passed: 16, failed: [] })).toBe(`Live page checked ${fmtDate(c.at)}: 16 of 16 checks passed`);
    expect(liveCheckText({ ...c, live: false })).toBe(`Live page checked ${fmtDate(c.at)}: we could not open it`);
    expect(liveCheckText(c)).not.toMatch(tell);
  });

  it('the address warning is settled by a confirmed redirect or a page of its own; any other warning stays', () => {
    const note = 'Marked published by you after a warning: sent at another address than the page it updates (checked 2026-11-04)';
    expect(publishNoteSettled({ publishNote: note, moved: { from: 'https://novaand-demo.com/a', at: '2026-11-10' } })).toBe(true);
    expect(publishNoteSettled({ publishNote: note, ownPageFromHome: true })).toBe(true);
    expect(publishNoteSettled({ publishNote: note })).toBe(false);
    expect(publishNoteSettled({ publishNote: 'Marked published by you after a warning: the live page does not look like the draft', moved: { from: 'x', at: 'y' } })).toBe(false);
  });
});

describe('the ladder\'s Search Console lines', () => {
  it('traffic says when it counts the pages\' own figures', () => {
    const t = (basis?: 'queries' | 'pages' | 'mixed') => trafficHint({ traffic: { points: [], clicks28d: 1, impressions28d: 11, basis } });
    expect(t('pages')).toBe('11 times shown on Google (impressions), Search Console, all searches and places, last 28 days');
    expect(t('mixed')).toBe(t('pages'));
    expect(t('queries')).toBe('11 times shown on Google (impressions), from Search Console');
    expect(t()).toBe(t('queries'));
  });

  it('a page\'s own figures in one line; nothing when not measured', () => {
    expect(pageGscText({ impressions: 10, clicks: 1, position: 4.7, measuredAt: '', urls: [] })).toBe('10 times shown, 1 click, about #4.7 on average (Search Console, all searches and places, last 28 days)');
    expect(pageGscText({ impressions: 1, clicks: 0, position: null, measuredAt: '', urls: [] })).toBe('1 time shown, 0 clicks (Search Console, all searches and places, last 28 days)');
    expect(pageGscText(null)).toBe('');
    expect(BEFORE_PUBLISH_NOTE).not.toMatch(tell);
  });
});
