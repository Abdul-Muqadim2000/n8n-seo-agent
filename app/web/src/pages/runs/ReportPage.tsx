import { Link, useParams } from 'react-router';
import { ArrowLeft, CalendarClock, ListChecks } from 'lucide-react';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useReport } from '@/lib/queries';
import { fmtDateTime } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { StageGlyph, stageLabel } from '@/components/reports/meta';
import { ReportView } from '@/components/reports/ReportView';

export default function ReportPage() {
  const { reportId = '' } = useParams();
  const { org } = useOrgCtx();
  const q = useReport(org.id, reportId);

  if (q.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load this report" titleAs="h1" />;

  const r = q.data;
  return (
    <div>
      <Link to={paths.reports(org.id)} className="group mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors duration-150 ease-brand hover:text-ink">
        <ArrowLeft className="size-4 transition-transform duration-200 ease-brand group-hover:-translate-x-0.5" aria-hidden /> All reports
      </Link>
      <PageHeader
        eyebrow={stageLabel(r.stage, r)}
        title={
          <span className="flex items-center gap-3">
            <StageGlyph stage={r.stage} report={r} />
            <span className="min-w-0">{r.title || stageLabel(r.stage, r)}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {r.siteDomain && (
              <>
                {r.siteId ? (
                  <Link to={paths.site(org.id, r.siteId)} className="text-accent-text hover:underline transition-colors duration-150 ease-brand">
                    {r.siteDomain}
                  </Link>
                ) : (
                  r.siteDomain
                )}
                <span className="text-ink-3">·</span>
              </>
            )}
            <span>received {fmtDateTime(r.receivedAt)}</span>
            {r.scheduled && (
              <Badge icon={<CalendarClock className="size-3" aria-hidden />} tone="accent">
                scheduled
              </Badge>
            )}
            {r.status === 'rejected' && <StatusBadge tone="critical">Rejected</StatusBadge>}
          </span>
        }
        actions={
          r.runId && (
            <ButtonLink to={paths.run(org.id, r.runId)} variant="secondary" size="sm" icon={<ListChecks className="size-4" />}>
              Open the run
            </ButtonLink>
          )
        }
      />
      <ReportView report={r} />
    </div>
  );
}
