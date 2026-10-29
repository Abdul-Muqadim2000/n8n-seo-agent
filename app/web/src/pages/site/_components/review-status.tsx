import { Link } from 'react-router';
import { gradeDisplay, type PageReviewSummary } from '@seo/shared';
import { StageBadge } from '@/components/reports/review/ReviewPanels';
import { paths } from '@/lib/paths';

/** H3 (2026-10-28): where a written page's review stands, on the content board: the stage, the questions answered, the delivered grade. */
export function reviewFacts(r: PageReviewSummary): string[] {
  return [r.questions > 0 ? `${r.answered} of ${r.questions} ${r.questions === 1 ? 'question' : 'questions'} answered` : '', r.grade != null ? `grade ${gradeDisplay(r.grade)}/100` : ''].filter(Boolean);
}

export function ReviewLine({ review, orgId }: { review: PageReviewSummary; orgId: string }) {
  const facts = reviewFacts(review);
  const open = review.questions > review.answered && (review.stage === 'questions' || review.stage === 'ready' || review.stage === 'needs_work');
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
      <StageBadge stage={review.stage} />
      {facts.length > 0 && <span>{facts.join(' · ')}</span>}
      <Link to={paths.report(orgId, review.reportId) + (open ? '#questions' : '')} className="font-medium text-accent-text hover:underline transition-colors duration-150 ease-brand">
        {open ? 'Answer the questions' : 'Open the page'}
      </Link>
    </div>
  );
}
