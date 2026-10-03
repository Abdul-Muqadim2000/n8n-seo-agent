import { useEffect, useMemo, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, CheckCircle2, CircleDot, ExternalLink as ExternalIcon, Loader2, Play, RotateCcw, XCircle } from 'lucide-react';
import { formatUsd, MODES, type Report, type Run } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useReport, useRun } from '@/lib/queries';
import { cn, fmtDateTime } from '@/lib/utils';
import { RunStatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { KeyValue, PageHeader } from '@/components/ui/misc';
import { ReportView } from '@/components/reports/ReportView';
import { ReportSummaryLine } from '@/components/reports/ReportSummaryLine';
import { ModeIcon, StageGlyph, stageLabel } from '@/components/reports/meta';
import { fmtMinutes, inputRows, isActive, minutesBetween, retryPrefill, RunProgress, useNow } from '@/components/reports/run';

const NOTICE_STAGES = new Set(['case_study_started', 'ai_visibility_started', 'backlinks_started', 'site_tracker_setup']);

/** Reports that are still due after the run's final stage (ladder pages, discover follow-ups). */
function pendingFollowUps(run: Run, reports: Report[]): string[] {
  const input = run.input as Record<string, unknown>;
  const content = reports.filter((r) => r.stage === 'content').length;
  const out: string[] = [];
  if (run.mode === 'ladder' && reports.some((r) => r.stage === 'ladder_plan')) {
    const n = typeof input.pagesNow === 'number' ? input.pagesNow : 1;
    if (content < n) out.push(`${n - content} page${n - content === 1 ? '' : 's'} from the ladder (about 10-15 minutes each)`);
  }
  if (run.mode === 'discover' && reports.some((r) => r.stage === 'keyword_strategy')) {
    if ((input.receiveReport === true || input.receiveContent === true) && !content) out.push(input.receiveContent === true ? 'the page for the best keyword' : 'the keyword report for the best keyword');
    if ((input.siteAudit === true || input.fullReport === true) && !reports.some((r) => r.stage === 'site_audit' || r.stage === 'full_report')) out.push(input.fullReport === true ? 'the full SEO report' : 'the technical audit');
  }
  return out;
}

export default function RunDetailPage() {
  const { runId = '' } = useParams();
  const { org, can } = useOrgCtx();
  const q = useRun(org.id, runId);
  const [params, setParams] = useSearchParams();
  const now = useNow(10_000);

  const run = q.data?.run;
  const reports = useMemo(() => [...(q.data?.reports ?? [])].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)), [q.data?.reports]);
  const followUps = run && run.status === 'completed' ? pendingFollowUps(run, reports) : [];
  const recent = run?.completedAt ? Date.now() - new Date(run.completedAt).getTime() < 3 * 3600_000 : false;
  const waitingMore = followUps.length > 0 && recent;
  const { refetch } = q;
  useEffect(() => {
    if (!waitingMore) return;
    const t = setInterval(() => void refetch(), 30_000);
    return () => clearInterval(t);
  }, [waitingMore, refetch]);

  const selectedId = useMemo(() => {
    const wanted = params.get('report');
    if (wanted && reports.some((r) => r.id === wanted)) return wanted;
    if (!run || !reports.length) return undefined;
    const finals = reports.filter((r) => MODES[run.mode]?.finalStages.includes(r.stage) || r.stage === 'rejected');
    const pick = finals[finals.length - 1] ?? [...reports].reverse().find((r) => !NOTICE_STAGES.has(r.stage)) ?? reports[reports.length - 1];
    return pick.id;
  }, [params, reports, run]);
  const detail = useReport(org.id, selectedId);

  if (q.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (q.isError || !run) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load this run" />;

  const info = MODES[run.mode];
  const active = isActive(run.status);
  const prefill = retryPrefill(run.input as Record<string, unknown>);
  const select = (id: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('report', id);
        return next;
      },
      { replace: true },
    );
  const selected = reports.find((r) => r.id === selectedId) ?? null;
  const duration = minutesBetween(run.createdAt, run.completedAt ?? (active ? now : null));

  return (
    <div>
      <Link to={paths.runs(org.id)} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> All runs
      </Link>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <ModeIcon mode={run.mode} className="size-3.5" />
            {info?.title ?? run.mode}
          </span>
        }
        title={run.title}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <RunStatusBadge status={run.status} />
            {run.siteDomain && <span>{run.siteDomain}</span>}
            <span className="text-ink-3">·</span>
            <span>
              {run.userName ? `${run.userName}, ` : ''}
              {fmtDateTime(run.createdAt)}
            </span>
          </span>
        }
        actions={
          can('member') &&
          !active && (
            <ButtonLink to={paths.tool(org.id, run.mode, { siteId: run.siteId, prefill })} variant={run.status === 'failed' ? 'primary' : 'secondary'} icon={run.status === 'failed' ? <RotateCcw className="size-4" /> : <Play className="size-4" />}>
              {run.status === 'failed' ? 'Try again' : 'Run again'}
            </ButtonLink>
          )
        }
      />

      <div className="space-y-5">
        {run.status === 'failed' && (
          <Callout
            tone="critical"
            title="The run did not complete"
            action={
              can('member') && (
                <ButtonLink to={paths.tool(org.id, run.mode, { siteId: run.siteId, prefill })} variant="secondary" size="sm" icon={<RotateCcw className="size-4" />}>
                  Try again
                </ButtonLink>
              )
            }
          >
            {run.error || 'The SEO engine rejected the request without a reason.'}
            <span className="mt-1 block text-xs text-ink-3">“Try again” opens the form with the same values so you can adjust them first.</span>
          </Callout>
        )}

        {active && <RunProgress run={run} now={now} />}

        {waitingMore && (
          <Callout tone="info" title="More reports are on the way">
            Still to come: {followUps.join(' and ')}. They appear in the timeline as they arrive.
          </Callout>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <CardHeader title="Timeline" description={reports.length ? `${reports.length} report${reports.length === 1 ? '' : 's'} received; select one to read it below` : 'Reports appear here as the SEO engine sends them'} />
            <CardBody>
              <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-px before:bg-line">
                <TimelineEvent icon={<CircleDot className="size-3.5 text-ink-3" aria-hidden />} title="Started" time={run.createdAt} sub={run.userName ? `by ${run.userName}` : undefined} />
                {run.acceptedAt && <TimelineEvent icon={<CircleDot className="size-3.5 text-accent-text" aria-hidden />} title="Accepted by the SEO engine" time={run.acceptedAt} />}
                {reports.map((r) => (
                  <li key={r.id} className="relative">
                    <button
                      type="button"
                      onClick={() => select(r.id)}
                      aria-current={r.id === selectedId ? 'true' : undefined}
                      className={cn('flex w-full items-start gap-3 rounded-lg px-0 py-2 pr-2 text-left transition-colors hover:bg-surface-2', r.id === selectedId && 'bg-accent-soft hover:bg-accent-soft')}
                    >
                      <span className="relative z-10 ml-px">
                        <StageGlyph stage={r.stage} size="sm" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="text-sm font-medium text-ink">{r.title || stageLabel(r.stage)}</span>
                          <span className="text-xs tabular text-ink-3">{fmtDateTime(r.receivedAt)}</span>
                        </span>
                        <span className="block text-xs text-ink-3">{stageLabel(r.stage)}</span>
                        <ReportSummaryLine report={r} className="mt-1" />
                      </span>
                    </button>
                  </li>
                ))}
                {active && <TimelineEvent icon={<Loader2 className="size-3.5 animate-spin text-accent-text" aria-hidden />} title="Waiting for results" sub="This page refreshes by itself" />}
                {run.status === 'completed' && run.completedAt && <TimelineEvent icon={<CheckCircle2 className="size-3.5 text-good-text" aria-hidden />} title="Completed" time={run.completedAt} sub={duration != null ? `after ${fmtMinutes(duration)}` : undefined} />}
                {run.status === 'failed' && <TimelineEvent icon={<XCircle className="size-3.5 text-critical-text" aria-hidden />} title="Failed" time={run.completedAt} />}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-5">
              <KeyValue
                items={[
                  {
                    label: 'Website',
                    value: run.siteId && run.siteDomain ? (
                      <Link to={paths.site(org.id, run.siteId)} className="text-accent-text hover:underline">
                        {run.siteDomain}
                      </Link>
                    ) : (
                      'None (research only)'
                    ),
                  },
                  { label: 'Estimated cost', value: <span className="tabular">{formatUsd(run.estimatedCostUsd)}</span> },
                  ...(run.actualCostUsd != null ? [{ label: 'Data cost measured', value: <span className="tabular">{formatUsd(run.actualCostUsd, 3)} <span className="text-xs text-ink-3">(DataForSEO; AI usage not itemised)</span></span> }] : []),
                  { label: active ? 'Expected time' : 'Duration', value: active ? `about ${run.etaMinutes} min` : fmtMinutes(duration) },
                  ...(run.requestId ? [{ label: 'Reference', value: <code className="text-xs text-ink-3">{run.requestId}</code> }] : []),
                ]}
              />
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Submitted</h3>
                <KeyValue items={inputRows(run.input as Record<string, unknown>)} />
              </div>
            </CardBody>
          </Card>
        </div>

        {selected && (
          <section aria-label="Selected report" className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
              <div className="flex min-w-0 items-center gap-3">
                <StageGlyph stage={selected.stage} />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight text-ink">{selected.title || stageLabel(selected.stage)}</h2>
                  <p className="text-[13px] text-ink-3">
                    {stageLabel(selected.stage)} · {fmtDateTime(selected.receivedAt)}
                  </p>
                </div>
              </div>
              <ButtonLink to={paths.report(org.id, selected.id)} variant="secondary" size="sm" icon={<ExternalIcon className="size-4" />}>
                Open as a page
              </ButtonLink>
            </div>
            {detail.isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : detail.isError || !detail.data ? (
              <ErrorState error={detail.error} onRetry={() => detail.refetch()} title="Could not load this report" />
            ) : (
              <ReportView report={detail.data} />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function TimelineEvent({ icon, title, time, sub }: { icon: ReactNode; title: string; time?: string | null; sub?: string }) {
  return (
    <li className="relative flex items-start gap-3 py-2">
      <span className="relative z-10 ml-px flex size-7 shrink-0 items-center justify-center rounded-md bg-surface">{icon}</span>
      <span className="min-w-0 flex-1 pt-1">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-sm text-ink-2">{title}</span>
          {time && <span className="text-xs tabular text-ink-3">{fmtDateTime(time)}</span>}
        </span>
        {sub && <span className="block text-xs text-ink-3">{sub}</span>}
      </span>
    </li>
  );
}
