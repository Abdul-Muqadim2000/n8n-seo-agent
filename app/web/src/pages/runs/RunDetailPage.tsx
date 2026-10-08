import { useEffect, useMemo, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Check, CheckCircle2, CircleDot, ClipboardList, Clock, Coins, ExternalLink as ExternalIcon, FileText, Flag, GitCommitVertical, Inbox, Loader2, Play, RotateCcw, Send, XCircle } from 'lucide-react';
import { formatUsd, MODES, type Report, type Run } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useReport, useRun } from '@/lib/queries';
import { cn, fmtDateTime } from '@/lib/utils';
import { RunStatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconTile, Stagger, type IconTileTone } from '@/components/insight';
import { Callout, ErrorState, Skeleton } from '@/components/ui/feedback';
import { KeyValue, PageHeader } from '@/components/ui/misc';
import { ReportView } from '@/components/reports/ReportView';
import { ReportSummaryLine } from '@/components/reports/ReportSummaryLine';
import { ModeIcon, StageGlyph, stageLabel } from '@/components/reports/meta';
import { fmtMinutes, inputRows, isActive, minutesBetween, retryPrefill, RunChip, RunProgress, useNow } from '@/components/reports/run';

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
  if (q.isError || !run) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load this run" titleAs="h1" />;

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
      <Link to={paths.runs(org.id)} className="group mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors duration-150 ease-brand hover:text-ink">
        <ArrowLeft className="size-4 transition-transform duration-200 ease-brand group-hover:-translate-x-0.5" aria-hidden /> All runs
      </Link>
      <PageHeader
        icon={<ModeIcon mode={run.mode} />}
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

      <Stagger className="space-y-5">
        <RunStages run={run} reports={reports.length} active={active} duration={duration} />

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
            <CardTitle icon={<GitCommitVertical />} title="Timeline" description={reports.length ? `${reports.length} report${reports.length === 1 ? '' : 's'} received; select one to read it below` : 'Reports appear here as the SEO engine sends them'} />
            <div className="px-5 pt-3 pb-5">
              <ol className="relative space-y-1 before:absolute before:top-5 before:bottom-5 before:left-[17px] before:w-0.5 before:rounded-full before:bg-line">
                <TimelineEvent tone="neutral" icon={<Send />} title="Started" time={run.createdAt} sub={run.userName ? `by ${run.userName}` : undefined} />
                {run.acceptedAt && <TimelineEvent tone="blue" icon={<CircleDot />} title="Accepted by the SEO engine" time={run.acceptedAt} />}
                {reports.map((r) => (
                  <li key={r.id} className="relative">
                    <button
                      type="button"
                      onClick={() => select(r.id)}
                      aria-current={r.id === selectedId ? 'true' : undefined}
                      className={cn(
                        'group/ev flex w-full cursor-pointer items-start gap-3 rounded-lg border border-transparent py-2 pr-2.5 pl-0.5 text-left transition-[background-color,border-color,box-shadow] duration-150 ease-brand hover:border-line hover:bg-surface-2/70',
                        r.id === selectedId && 'border-accent-text/25 bg-accent-soft shadow-card hover:border-accent-text/25 hover:bg-accent-soft',
                      )}
                    >
                      <span className="relative z-10 rounded-[9px] ring-4 ring-surface">
                        <StageGlyph stage={r.stage} report={r} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="text-sm font-medium text-ink group-hover/ev:text-accent-text">{r.title || stageLabel(r.stage, r)}</span>
                          <span className="text-xs tabular text-ink-3">{fmtDateTime(r.receivedAt)}</span>
                        </span>
                        <span className="block text-xs text-ink-3">{stageLabel(r.stage, r)}</span>
                        <ReportSummaryLine report={r} className="mt-1.5" />
                      </span>
                    </button>
                  </li>
                ))}
                {active && <TimelineEvent tone="solid" icon={<Loader2 className="animate-spin" />} title="Waiting for results" sub="This page refreshes by itself" />}
                {run.status === 'completed' && run.completedAt && <TimelineEvent tone="good" icon={<CheckCircle2 />} title="Completed" time={run.completedAt} sub={duration != null ? `after ${fmtMinutes(duration)}` : undefined} />}
                {run.status === 'failed' && <TimelineEvent tone="critical" icon={<XCircle />} title="Failed" time={run.completedAt} />}
              </ol>
            </div>
          </Card>

          <Card>
            <CardTitle icon={<ClipboardList />} title="Details" />
            <div className="space-y-5 px-5 pt-3 pb-5">
              <div className="flex flex-wrap gap-1.5">
                <RunChip icon={<Coins />} title="Estimated cost">
                  {formatUsd(run.estimatedCostUsd)} estimated
                </RunChip>
                <RunChip icon={<Clock />}>{active ? `about ${run.etaMinutes} min` : fmtMinutes(duration)}</RunChip>
                <RunChip icon={<FileText />} tone={reports.length ? 'accent' : 'neutral'}>
                  {reports.length} report{reports.length === 1 ? '' : 's'}
                </RunChip>
              </div>
              <KeyValue
                items={[
                  {
                    label: 'Website',
                    value: run.siteId && run.siteDomain ? (
                      <Link to={paths.site(org.id, run.siteId)} className="text-accent-text hover:underline transition-colors duration-150 ease-brand">
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
              <div className="border-t border-line pt-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-ink-3 uppercase">
                  <IconTile size="xs">
                    <Inbox />
                  </IconTile>
                  Submitted
                </h3>
                <KeyValue items={inputRows(run.input as Record<string, unknown>)} />
              </div>
            </div>
          </Card>
        </div>

        {selected && (
          <section aria-label="Selected report" className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
              <div className="flex min-w-0 items-center gap-3">
                <StageGlyph stage={selected.stage} report={selected} />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-semibold tracking-[-0.01em] text-ink">{selected.title || stageLabel(selected.stage, selected)}</h2>
                  <p className="text-[13px] text-ink-3">
                    {stageLabel(selected.stage, selected)} · {fmtDateTime(selected.receivedAt)}
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
      </Stagger>
    </div>
  );
}

function TimelineEvent({ icon, title, time, sub, tone }: { icon: ReactNode; title: string; time?: string | null; sub?: string; tone: IconTileTone }) {
  return (
    <li className="relative flex items-start gap-3 py-2 pl-0.5">
      <span className="relative z-10 rounded-[9px] ring-4 ring-surface">
        <IconTile tone={tone} size="md">
          {icon}
        </IconTile>
      </span>
      <span className="min-w-0 flex-1 pt-2">
        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className={cn('text-sm', tone === 'good' || tone === 'critical' || tone === 'solid' ? 'font-medium text-ink' : 'text-ink-2')}>{title}</span>
          {time && <span className="text-xs tabular text-ink-3">{fmtDateTime(time)}</span>}
        </span>
        {sub && <span className="block text-xs text-ink-3">{sub}</span>}
      </span>
    </li>
  );
}

/** A card header with an icon tile (the page's cards). */
function CardTitle({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className={cn('flex gap-3 px-5 pt-4', description ? 'items-start' : 'items-center')}>
      <IconTile size="sm" className={description ? 'mt-px' : undefined}>
        {icon}
      </IconTile>
      <div className="min-w-0">
        <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
      </div>
    </div>
  );
}

/**
 * The run's stages as a stepper: sent → accepted by the engine → reports → completed (or failed). Done stages turn green, the live one
 * spins; read from the run's own timestamps and status.
 */
function RunStages({ run, reports, active, duration }: { run: Run; reports: number; active: boolean; duration: number | null }) {
  const failed = run.status === 'failed';
  const done = run.status === 'completed';
  type S = { key: string; label: string; sub: string; state: 'done' | 'now' | 'todo' | 'failed'; icon: ReactNode };
  const steps: S[] = [
    { key: 'sent', label: 'Sent', sub: fmtDateTime(run.createdAt), state: 'done', icon: <Send /> },
    {
      key: 'accepted',
      label: 'Accepted',
      sub: run.acceptedAt ? fmtDateTime(run.acceptedAt) : failed ? 'not accepted' : 'waiting for the engine',
      state: run.acceptedAt ? 'done' : failed ? 'failed' : 'now',
      icon: <CircleDot />,
    },
    {
      key: 'reports',
      label: reports ? `${reports} report${reports === 1 ? '' : 's'}` : 'Reports',
      sub: reports ? 'received' : active ? 'working on it' : failed ? 'none received' : 'none yet',
      state: reports && !active ? 'done' : active && run.acceptedAt ? 'now' : failed && !reports ? 'failed' : reports ? 'now' : 'todo',
      icon: <FileText />,
    },
    {
      key: 'end',
      label: failed ? 'Failed' : 'Completed',
      sub: done || failed ? (run.completedAt ? fmtDateTime(run.completedAt) : '') + (done && duration != null ? ` · ${fmtMinutes(duration)}` : '') : `about ${run.etaMinutes} min in total`,
      state: done ? 'done' : failed ? 'failed' : 'todo',
      icon: failed ? <XCircle /> : <Flag />,
    },
  ];
  const tile = (st: S['state']): IconTileTone => (st === 'done' ? 'good' : st === 'failed' ? 'critical' : st === 'now' ? 'solid' : 'neutral');
  return (
    <Card className="p-4 sm:p-5">
      <ol className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4" aria-label="Run stages">
        {steps.map((st, i) => (
          <li key={st.key} className="relative flex min-w-0 items-start gap-2.5">
            {i < steps.length - 1 && <span className={cn('absolute top-[17px] left-11 hidden h-0.5 w-[calc(100%-3.25rem)] rounded-full sm:block', st.state === 'done' ? 'bg-good' : 'bg-line')} aria-hidden />}
            <IconTile tone={tile(st.state)} size="md" className="relative z-10 rounded-full">
              {st.state === 'now' ? <Loader2 className="animate-spin" /> : st.state === 'done' && st.key !== 'reports' ? <Check strokeWidth={2.75} /> : st.icon}
            </IconTile>
            <span className="min-w-0 pt-0.5 sm:sr-only">
              <span className="block text-sm font-medium text-ink">{st.label}</span>
              <span className="block truncate text-xs text-ink-3">{st.sub}</span>
            </span>
            <span className="sr-only">{st.state === 'done' ? 'done' : st.state === 'now' ? 'in progress' : st.state === 'failed' ? 'failed' : 'to come'}</span>
          </li>
        ))}
      </ol>
      <ol className="mt-2.5 hidden grid-cols-4 gap-x-3 sm:grid" aria-hidden>
        {steps.map((st) => (
          <li key={st.key} className="min-w-0">
            <span className={cn('block text-sm font-medium', st.state === 'todo' ? 'text-ink-3' : 'text-ink')}>{st.label}</span>
            <span className="block truncate text-xs text-ink-3">{st.sub}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
