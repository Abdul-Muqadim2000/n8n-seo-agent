import { Link, useParams } from 'react-router';
import { ArrowLeft, CalendarClock, ListChecks, Printer } from 'lucide-react';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useReport } from '@/lib/queries';
import { fmtDateTime } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/misc';
import { StageIcon, stageLabel } from '@/components/reports/meta';
import { ReportView } from '@/components/reports/ReportView';
import { SendReport } from '@/components/reports/SendReport';
import { ShareReport } from '@/components/reports/ShareReport';
import { NotWhatIWanted } from '@/components/reports/ContentFeedback';

export default function ReportPage() {
  const { reportId = '' } = useParams();
  const { org, can } = useOrgCtx();
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
      <Link data-print-hide to={paths.reports(org.id)} className="group mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors duration-150 ease-brand hover:text-ink">
        <ArrowLeft className="size-4 transition-transform duration-200 ease-brand group-hover:-translate-x-0.5" aria-hidden /> All reports
      </Link>
      <PageHeader
        icon={<StageIcon stage={r.stage} report={r} />}
        eyebrow={stageLabel(r.stage, r)}
        title={r.title || stageLabel(r.stage, r)}
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
          <span className="flex flex-wrap items-center gap-2" data-print-hide>
            {/* B-R1: push this one report to the company's own channels, if it is ready to leave the app */}
            {/* keyword-first: "Not what I wanted" on a written page (it feeds the autopilot's auto-pause) */}
            <NotWhatIWanted report={r} />
            <SendReport report={r} />
            {/* G15: an expiring, read-only link for somebody with no account (admins and owners only) */}
            <ShareReport reportId={r.id} />
            {r.runId && can('viewer') && (
              <ButtonLink to={paths.run(org.id, r.runId)} variant="secondary" size="sm" icon={<ListChecks className="size-4" />}>
                Open the run
              </ButtonLink>
            )}
            {/* G5: a printable page of the report, in a white-label portal, the PDF a client keeps (the engine's PDF names the engine) */}
            <Button variant="secondary" size="sm" icon={<Printer className="size-4" />} onClick={() => window.print()} data-print-hide>
              Save as PDF
            </Button>
          </span>
        }
      />
      <ReportView report={r} />
    </div>
  );
}
