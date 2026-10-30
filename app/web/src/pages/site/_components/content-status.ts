// Pre-launch run 2026-10-21 (B1, B2, B14): one reading of the written pages for every screen that counts them (Overview, Content, the
// ladder, Rankings). A draft the quality check refused (`not_ready`, R111) is written but never "waiting to publish": it needs the owner's edits by
// hand first (never a new run), which is what Needs you says about it. Before this the Content page counted it as waiting and offered "Publish it, then
// report its address", the Overview counted it as needing a fix, and the two screens disagreed about the same page.
import type { ContentItem } from '@seo/shared';

/** A page that is on the website (reported live, or found by the weekly report). */
export const isLiveItem = (i: Pick<ContentItem, 'status' | 'publishedUrl'>): boolean => i.status === 'published' || !!i.publishedUrl;

/** A written draft that did not pass its quality check: finished by hand (E-QA, never a re-run), never published as it is. */
export const needsFixItem = (i: Pick<ContentItem, 'status' | 'publishedUrl'>): boolean => !isLiveItem(i) && i.status === 'not_ready';

/**
 * The "I published a page" form, prefilled for one written page (2026-10-23): its keyword, the engine request id that wrote it (so the
 * check marks THIS row published even when the keyword is typed differently) and the address when one is known. A draft that needed
 * edits gets it too: it is finished outside the app, and the live check names any bracket still on the published page.
 */
export function publishPrefill(i: Pick<ContentItem, 'keyword' | 'requestId' | 'existingPageUrl' | 'publishedUrl'>): Record<string, unknown> {
  const url = i.publishedUrl || i.existingPageUrl;
  return { keyword: i.keyword, ...(/^[A-Za-z0-9:_.-]{1,120}$/.test(i.requestId ?? '') ? { contentRequestId: i.requestId } : {}), ...(url ? { publishedUrl: url } : {}) };
}

export interface ContentGroups<T> {
  live: T[];
  /** written, passed the quality check, not live yet */
  waiting: T[];
  /** written, did not pass the quality check */
  fixing: T[];
}

export function contentGroups<T extends Pick<ContentItem, 'status' | 'publishedUrl'>>(items: readonly T[]): ContentGroups<T> {
  return {
    live: items.filter(isLiveItem),
    // W0-D (2026-10-29): a `held` row was never written (it waits for the client's OK on its report), so it never waits to be published
    waiting: items.filter((i) => !isLiveItem(i) && !needsFixItem(i) && i.status !== 'held'),
    fixing: items.filter(needsFixItem),
  };
}

/** "Your written page is not live yet", "1 of 3 written pages is live", "0 of 2 written pages are live". */
export function liveLine(live: number, written: number): string {
  if (written <= 0) return 'No pages written yet';
  if (written === 1) return live >= 1 ? 'Your written page is live' : 'Your written page is not live yet';
  return `${live} of ${written} written pages ${live === 1 ? 'is' : 'are'} live`;
}
