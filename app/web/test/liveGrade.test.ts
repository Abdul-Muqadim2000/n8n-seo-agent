import { describe, expect, it } from 'vitest';
import type { PageLiveGradeView, PageReviewSummary } from '@seo/shared';
import { liveGradeLines } from '../src/pages/site/_components/content-status';
import { reviewFacts } from '../src/pages/site/_components/review-status';
import { fmtDay } from '../src/lib/utils';

// Client reports 2026-11-11 (devaicon.com: "I published the pages after fixing every issue the tool listed, but the card still shows the
// old score of the page"): the Content card of a live page shows the grade of the LIVE page as its grade, the delivered one beside it.
const tell = /[—–‘’“”…]/;
const lg = (o: Partial<PageLiveGradeView> = {}): PageLiveGradeView => ({
  score: 74, status: 'needs_work', label: 'Needs work: specificity', blocking: [], advisoryCount: 3, url: 'https://novaand-demo.com/services/x', publishedReportId: 'pub1',
  checkedAt: '2026-11-11T10:02:00Z', attemptedAt: '2026-11-11T09:48:43Z', readFailed: null, ...o,
});
const summary = (o: Partial<PageReviewSummary> = {}): PageReviewSummary => ({ reportId: 'r1', stage: 'live_verified', label: 'Live, checked', questions: 0, answered: 0, grade: 59, ...o });

describe('the live page grade on the Content card', () => {
  it('the live grade is the main grade, with its status and date; the delivered grade is "version we delivered"', () => {
    const r = summary({ liveGrade: lg() });
    const l = liveGradeLines(r)!;
    expect(l.grade).toBe(`Live page grade 74/100 · needs work · checked ${fmtDay('2026-11-11T10:02:00Z')}`);
    expect(l.tone).toBe('warning');
    expect(l.blockers).toEqual([]);
    expect(l.note).toBe('');
    expect(reviewFacts(r, { live: true })).toEqual(['version we delivered 59/100']);
    // before any live grade the delivered grade keeps yesterday's wording, and a page not live is just "grade"
    expect(reviewFacts(summary(), { live: true })).toEqual(['grade of the version we delivered 59/100']);
    expect(reviewFacts(summary({ liveGrade: lg() }))).toEqual(['grade 59/100']);
    expect(liveGradeLines(summary({ liveGrade: lg({ score: 96, status: 'ready' }) }))!.grade).toBe(`Live page grade 95+/100 · ready to publish · checked ${fmtDay('2026-11-11T10:02:00Z')}`);
  });

  it('blockers: at most two in plain words, with the check they belong to', () => {
    const l = liveGradeLines(summary({ liveGrade: lg({ status: 'not_ready', score: 52, blocking: [{ code: 'bracket', text: 'A bracket is left in the text: [Price].' }, { code: 'dup', text: 'This website already has a page for the same search' }, { code: 'x', text: 'Third' }] }) }))!;
    expect(l.tone).toBe('critical');
    expect(l.blockers).toEqual(['A bracket is left in the text: [Price]', 'This website already has a page for the same search']);
    expect(l.checkReportId).toBe('pub1');
  });

  it('checking: only while a publish check is newer than the last grade', () => {
    expect(liveGradeLines(summary({ liveGradePending: true }))).toEqual({ grade: 'Live page grade: checking', tone: 'neutral', blockers: [], checkReportId: null, note: '' });
    expect(liveGradeLines(summary())).toBeNull();
    // an older grade stays on show while the newest version is graded
    const again = liveGradeLines(summary({ liveGrade: lg(), liveGradePending: true }))!;
    expect(again.grade).toMatch(/^Live page grade 74\/100/);
    expect(again.note).toBe('Checking the newest version of the live page');
  });

  it('a live page we could not read: said so with the date, the previous grade kept', () => {
    const failed = { at: '2026-11-12T08:00:00Z', publishedReportId: 'pub2', error: 'the page reader answered 403' };
    expect(liveGradeLines(summary({ liveGrade: lg({ score: null, checkedAt: null, readFailed: failed }) }))).toEqual({ grade: '', tone: 'neutral', blockers: [], checkReportId: null, note: `We could not read the live page to grade it (checked ${fmtDay(failed.at)})` });
    const kept = liveGradeLines(summary({ liveGrade: lg({ readFailed: failed }) }))!;
    expect(kept.grade).toMatch(/^Live page grade 74\/100/);
    expect(kept.note).toBe(`We could not read the live page to grade it (checked ${fmtDay(failed.at)})`);
    // the engine's own error text never reaches the card
    expect(JSON.stringify(kept)).not.toMatch(/page reader/);
    expect(JSON.stringify(kept)).not.toMatch(tell);
  });
});
