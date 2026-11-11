// Pre-launch run 2026-10-21 (B1, B2, B14): one reading of the written pages for every screen that counts them (Overview, Content, the
// ladder, Rankings). A draft the quality check refused (`not_ready`, R111) is written but never "waiting to publish": it needs the owner's edits by
// hand first (never a new run), which is what Needs you says about it. Before this the Content page counted it as waiting and offered "Publish it, then
// report its address", the Overview counted it as needing a fix, and the two screens disagreed about the same page.
import { gradeDisplay, LIVE_GRADE_STATUS_LABEL, type ContentItem, type ContentLiveCheck, type PageDeliveryStatus, type PageReviewSummary } from '@seo/shared';
import { fmtDate, fmtDay } from '@/lib/utils';

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

/** prod 2026-11-10: the "sent at another address" warning is answered once the old address redirects to the page, or when the page it
 *  "updates" is the home page (a page of its own, nothing to redirect). Any other warning stays. */
export function publishNoteSettled(item: Pick<ContentItem, 'publishNote' | 'moved' | 'ownPageFromHome'>): boolean {
  const addressOnly = /another address than the page it updates/i.test(item.publishNote ?? '');
  return addressOnly && (!!item.moved || !!item.ownPageFromHome);
}

/** prod 2026-11-10: what the newest publish check measured on the live page (at most 3 failed checks named), with its report. */
export function liveCheckText(c: ContentLiveCheck): string {
  if (!c.live) return `Live page checked ${fmtDate(c.at)}: we could not open it`;
  const failed = c.failed.slice(0, 3);
  const more = c.failed.length - failed.length;
  return `Live page checked ${fmtDate(c.at)}: ${c.passed} of ${c.total} checks passed${failed.length ? `. Not passed: ${failed.join('; ')}${more > 0 ? ` and ${more} more` : ''}` : ''}`;
}

/** What the Content card says about the grade of the live page (client reports 2026-11-11). */
export interface LiveGradeLines {
  /** the main grade line ("Live page grade 74/100 · needs work · checked 11 Nov"), or "Live page grade: checking"; '' when there is none */
  grade: string;
  tone: 'good' | 'warning' | 'critical' | 'neutral';
  /** what still stops the live page from being ready (at most 2, plain words) */
  blockers: string[];
  /** the publish check the grade belongs to ("See the check"); null when there is no grade */
  checkReportId: string | null;
  /** a failed read or a new grade being made, beside the grade shown */
  note: string;
}

const toneOf = (st: PageDeliveryStatus | ''): LiveGradeLines['tone'] => (st === 'ready' || st === 'ready_with_questions' ? 'good' : st === 'needs_work' ? 'warning' : st === 'not_ready' ? 'critical' : 'neutral');
const later = (a: string | null | undefined, b: string | null | undefined) => !!a && (!b || new Date(a).getTime() > new Date(b).getTime());

/**
 * Client reports 2026-11-11 (devaicon.com: "the card still shows the old score of the page"): the grade of the LIVE page, the engine's own
 * reading of the published page, shown as the page's grade; null when the page has no live grade, no failed read and none on the way.
 */
export function liveGradeLines(r: Pick<PageReviewSummary, 'liveGrade' | 'liveGradePending'>): LiveGradeLines | null {
  const g = r.liveGrade ?? null;
  const pending = r.liveGradePending === true;
  const graded = !!g && g.score != null && !!g.checkedAt;
  const failedNow = !!g?.readFailed && (!graded || later(g.readFailed.at, g.checkedAt));
  const failed = failedNow ? `We could not read the live page to grade it (checked ${fmtDay(g!.readFailed!.at)})` : '';
  if (!graded) {
    if (pending) return { grade: 'Live page grade: checking', tone: 'neutral', blockers: [], checkReportId: null, note: '' };
    if (failed) return { grade: '', tone: 'neutral', blockers: [], checkReportId: null, note: failed };
    return null;
  }
  const label = g!.status ? LIVE_GRADE_STATUS_LABEL[g!.status as PageDeliveryStatus] ?? '' : '';
  return {
    grade: [`Live page grade ${gradeDisplay(g!.score)}/100`, label, `checked ${fmtDay(g!.checkedAt)}`].filter(Boolean).join(' · '),
    tone: toneOf(g!.status),
    blockers: g!.blocking.map((b) => b.text.replace(/[.\s]+$/, '')).filter(Boolean).slice(0, 2),
    checkReportId: g!.publishedReportId || null,
    note: pending ? 'Checking the newest version of the live page' : failed,
  };
}
