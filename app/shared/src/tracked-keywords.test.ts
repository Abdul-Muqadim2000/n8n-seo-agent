import { describe, expect, it } from 'vitest';
import { trackedKeywordsLine, trackedKeywordsOf } from './tracked-keywords';

// CR17-I (client report 2026-11-17, F8): one definition of "tracked keywords". The client's case: six ladder rungs, its own list emptied on
// 2026-10-28 (the app kept "open edx provider", the engine cleared it), six written pages that are not ladder pages.

const ladder = [
  { keyword: 'ai app development', status: 'planned' },
  { keyword: 'ai automation services pakistan', status: 'published' },
  { keyword: 'agentic ai development in uae', status: 'published' },
  { keyword: 'ai in industrial automation', status: 'published' },
  { keyword: 'ai development companies', status: 'published' },
  { keyword: 'ai app development companies', status: 'published' },
];
const pages = [{ keyword: 'open edx hosting' }, { keyword: 'lms development' }, { keyword: 'ai development companies' }, { keyword: 'Open edX hosting' }];

describe('trackedKeywordsOf', () => {
  it('ladder keywords + your own list, each search once; written pages counted apart', () => {
    const none = trackedKeywordsOf({ own: [], ladder, pages });
    expect(none).toMatchObject({ total: 6, fromLadders: 6, fromYourList: 0, pagesFollowed: 2 });
    const withOwn = trackedKeywordsOf({ own: ['open edx provider'], ladder, pages });
    expect(withOwn).toMatchObject({ total: 7, fromLadders: 6, fromYourList: 1 });
    expect(withOwn.keywords.map((k) => k.source)).toEqual(['ladder', 'ladder', 'ladder', 'ladder', 'ladder', 'ladder', 'own']);
  });

  it('a search in both lists counts once (as a ladder search); spellings of one search are one search', () => {
    const t = trackedKeywordsOf({ own: ['AI development companies', 'ai  app development'], ladder });
    expect(t.total).toBe(6);
    expect(t.fromYourList).toBe(0);
  });

  it('set-aside, stopped and merged rungs, and keywords the fit gate refuses, are not checked', () => {
    const t = trackedKeywordsOf({
      own: ['facebook login'],
      ladder: [...ladder, { keyword: 'ai consulting dubai', status: 'set_aside' }, { keyword: 'chatbot uae', status: 'stopped' }],
      fits: (k) => !/login/.test(k),
    });
    expect(t.total).toBe(6);
  });

  it('the line every screen shows', () => {
    expect(trackedKeywordsLine(trackedKeywordsOf({ own: [], ladder: [] }))).toBe('No keyword checked on Google yet: Search Console queries only');
    expect(trackedKeywordsLine(trackedKeywordsOf({ own: ['open edx provider'], ladder }))).toBe('7 keywords checked on Google: 6 from your keyword ladders, 1 from your list');
  });
});
