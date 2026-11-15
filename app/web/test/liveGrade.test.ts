import { describe, expect, it } from 'vitest';
import type { PageLiveGradeView, PageReviewSummary } from '@seo/shared';
import { liveCheckText, liveGradeDetail, liveGradeLines } from '../src/pages/site/_components/content-status';
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
    expect(l.grade).toBe(`Live page grade 74/100 · needs work: specificity · checked ${fmtDay('2026-11-11T10:02:00Z')}`);   // client reports 2026-11-16: the engine's reading
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

// Client reports 2026-11-16 (devaicon.com: "the version we delivered 95+/100, the live page 84, why?"): the card says whose text is live,
// where the live page lost points against the version we delivered and what to change on the website.
describe('why the live page grade differs from the version we delivered', () => {
  const g1116 = (o: Partial<PageLiveGradeView> = {}) => lg({
    score: 84, label: 'Needs work: readability', advisoryCount: 7,
    parts: [
      { dim: 'structure', label: 'structure', points: 14, max: 20, reasons: ['The main search phrase "agents uae" appears 2 times (3 or more)'], fix: '' },
      { dim: 'coverage', label: 'topic coverage', points: 15, max: 15, reasons: [], fix: '' },
      { dim: 'readability', label: 'readability', points: 3, max: 10, reasons: ['Reading ease 22.9 out of 100 (40 or more, with sentences of 22 words or fewer, scores full marks); sentences average 21.8 words; 7 sentences are over 28 words'], fix: 'Use shorter sentences and plainer words' },
      { dim: 'sources', label: 'sources', points: 12, max: 15, reasons: ['The page cites no outside source.'], fix: 'Cite an official body, a research house, major press or vendor documentation' },
    ],
    readability: { flesch: 22.9, avgSentenceWords: 21.8, longSentences: 7, longest: [{ text: 'Comprehensive operational visibility necessitates considerable integration planning across entities.', words: 41 }, { text: 'Implementation methodologies typically incorporate discovery workshops.', words: 33 }] },
    keptPct: 0, keptSentences: 0, deliveredSentences: 161,
    adjustments: [{ code: 'direct_answer', text: 'Your page opens with a direct answer (66 words) without a "Quick answer" label: we count it as the direct answer' }],
    nextStep: 'Your live page has one part under half marks (readability). Use shorter sentences and plainer words. Change it on your website, then press Re-check.',
    delivered: { score: 98, breakdown: { structure: 18, coverage: 15, readability: 10, sources: 15 }, images: 3 },
    ...o,
  });

  it('own version, the parts that lost points (most lost first, with the delivered points), the longest sentences and what was not counted', () => {
    const r = summary({ grade: 98, liveGrade: g1116() });
    const d = liveGradeDetail(r)!;
    expect(d.ownVersion).toBe('The live page reads as your own version: we found 0% of the text we delivered on it as we read it (0 of 161 sentences), so this grade is mostly of your text.');
    expect(d.parts.map((p) => p.title)).toEqual(['Readability 3 of 10 (the version we delivered: 10)', 'Structure 14 of 20 (the version we delivered: 18)', 'Sources 12 of 15 (the version we delivered: 15)']);
    expect(d.parts[0]!.fix).toBe('Use shorter sentences and plainer words');
    expect(d.parts[2]!.why).toEqual(['The page cites no outside source']);
    expect(d.longest).toEqual(['Comprehensive operational visibility necessitates considerable integration planning across entities. (41 words)', 'Implementation methodologies typically incorporate discovery workshops. (33 words)']);
    expect(d.notCounted).toHaveLength(1);
    expect(d.nextStep).toMatch(/on your website, then press Re-check\.$/);
    expect(JSON.stringify(d)).not.toMatch(tell);
    expect(JSON.stringify(d)).not.toMatch(/Flesch|Content QA|page reader|Jina|n8n|grade_only|live_parts/);
    // the delivered grade beside a live grade is its number, not "95+"
    expect(reviewFacts(r, { live: true })).toEqual(['version we delivered 98/100']);
    expect(liveGradeLines(r)!.grade).toBe(`Live page grade 84/100 · needs work: readability · checked ${fmtDay('2026-11-11T10:02:00Z')}`);
  });

  it('a page that keeps our text has no "own version" line; a grade stored before shows the grade line alone', () => {
    expect(liveGradeDetail(summary({ liveGrade: g1116({ keptPct: 94, keptSentences: 150 }) }))!.ownVersion).toBe('');
    expect(liveGradeDetail(summary({ liveGrade: lg() }))).toBeNull();
    // review L6: no share when the texts could not be compared, and why
    expect(liveGradeDetail(summary({ liveGrade: g1116({ keptPct: null, keptNote: 'the live page was read with too little text to compare it with the text we delivered' }) }))!.ownVersion)
      .toBe('We could not compare the live page with the text we delivered: the live page was read with too little text to compare it with the text we delivered.');
    expect(liveGradeDetail(summary({ liveGrade: lg({ score: null, checkedAt: null }) }))).toBeNull();
  });

  it('the publish check: one item for the image checks, and the images we made when the article has none', () => {
    const c = { at: '2026-11-13T09:29:00Z', passed: 11, total: 18, url: 'https://novaand-demo.com/x', reportId: 'p', live: true, imagesFound: 0,
      failed: ['At least 2 content images', 'Every image has alt text', 'An image alt text names the topic', 'Descriptive image file names', 'Images carry width and height', 'Modern image format (WebP / AVIF)', 'Author named (byline and Person schema)'] };
    expect(liveCheckText(c)).toMatch(/: 11 of 18 checks passed\. Not passed: images \(6 checks\); Author named \(byline and Person schema\)$/);
    expect(liveCheckText(c, { deliveredImages: 3 })).toMatch(/Not passed: images \(6 checks\); Author named \(byline and Person schema\)\. The 3 images we made for this page are ready in its report, with their alt text$/);
    const now = { ...c, passed: 11, total: 13, failed: ['Images in the article', 'Author named (byline and Person schema)'] };
    expect(liveCheckText(now, { deliveredImages: 3 })).toMatch(/Not passed: no images in the article; Author named/);
    expect(liveCheckText({ ...now, imagesFound: 2, failed: ['Images carry width and height'] }, { deliveredImages: 3 })).toMatch(/Not passed: Images carry width and height$/);
    expect(liveCheckText(c, { deliveredImages: 3 })).not.toMatch(tell);
  });
});
