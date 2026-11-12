import { Link } from 'react-router';
import { CHECKS_IMPROVED_REASON, gradeDisplay, type PageReviewSummary } from '@seo/shared';
import { StageBadge } from '@/components/reports/review/ReviewPanels';
import { paths } from '@/lib/paths';

/**
 * H3 (2026-10-28): where a written page's review stands, on the content board: the stage, the questions answered, the delivered grade.
 * prod 2026-11-10 (devaicon.com): once the page is live the grade is said to be of the version we delivered (the client may have changed
 * the page before publishing it; the live page's own check is shown beside it).
 */
export function reviewFacts(r: PageReviewSummary, opts: { live?: boolean } = {}): string[] {
  // client reports 2026-11-11: beside the live page's own grade, the delivered one is "version we delivered"
  const liveGraded = !!opts.live && r.liveGrade?.score != null && !!r.liveGrade?.checkedAt;
  const grade = r.grade != null ? `${liveGraded ? 'version we delivered' : opts.live ? 'grade of the version we delivered' : 'grade'} ${gradeDisplay(r.grade)}/100` : '';
  return [r.questions > 0 ? `${r.answered} of ${r.questions} ${r.questions === 1 ? 'question' : 'questions'} answered` : '', grade].filter(Boolean);
}

/** client reports 2026-11-11: the Content card's prompt for a page made before our checks improved (one free re-make) */
export const RECHECK_LINE = `${CHECKS_IMPROVED_REASON}. It is free this time.`;

export function ReviewLine({ review, orgId, live }: { review: PageReviewSummary; orgId: string; live?: boolean }) {
  const facts = reviewFacts(review, { live });
  const open = review.questions > review.answered && (review.stage === 'questions' || review.stage === 'ready' || review.stage === 'needs_work');
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
      <StageBadge stage={review.stage} />
      {facts.length > 0 && <span>{facts.join(' · ')}</span>}
      <Link to={paths.report(orgId, review.reportId) + (open ? '#questions' : '')} className="font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
        {open ? 'Answer the questions' : 'Open the page'}
      </Link>
      {review.recheck && (
        // client reports 2026-11-11: a version made before our checks improved gets one free re-make
        <span className="basis-full text-ink-2" data-testid="recheck-line">
          {RECHECK_LINE}{' '}
          <Link to={paths.report(orgId, review.reportId) + '#final-version'} className="font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
            Make it again for free
          </Link>
        </span>
      )}
    </div>
  );
}
