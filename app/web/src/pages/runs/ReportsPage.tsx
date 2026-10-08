import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ArrowRight, CalendarClock, CalendarDays, FileText, Filter, RotateCcw } from 'lucide-react';
import { STAGE_LABELS, type Report } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useReports } from '@/lib/queries';
import { fmtAgo, fmtDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/misc';
import { FileChips } from '@/components/reports/files';
import { StageGlyph, stageLabel } from '@/components/reports/meta';
import { ReportSummaryLine } from '@/components/reports/ReportSummaryLine';

const LIMITS = [50, 100, 200];

const dayLabel = (iso: string) => {
  const d = parseISO(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE d MMMM yyyy');
};

export default function ReportsPage() {
  const { org, sites } = useOrgCtx();
  const [params, setParams] = useSearchParams();
  const siteId = params.get('site') ?? '';
  const stage = params.get('stage') ?? '';
  const limit = LIMITS.includes(Number(params.get('limit'))) ? Number(params.get('limit')) : LIMITS[0];
  const q = useReports(org.id, { siteId: siteId || undefined, stage: stage || undefined, limit });
  const reports = q.data ?? [];
  const filtered = !!(siteId || stage);

  const set = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'limit') next.delete('limit');
        return next;
      },
      { replace: true },
    );

  const groups = useMemo(() => {
    const out: { day: string; items: Report[] }[] = [];
    for (const r of reports) {
      const day = r.receivedAt.slice(0, 10);
      const g = out[out.length - 1];
      if (g && g.day === day) g.items.push(r);
      else out.push({ day, items: [r] });
    }
    return out;
  }, [reports]);
  const nextLimit = LIMITS.find((l) => l > limit);

  return (
    <div>
      <PageHeader icon={<FileText />} title="Reports" description="Everything the SEO engine delivered: results of your runs and the scheduled weekly and monthly reports (rank tracking, site reports, AI visibility, backlinks, audits)." />
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <span className="hidden size-9 shrink-0 items-center justify-center self-end rounded-lg bg-accent-soft text-accent-text sm:inline-flex" aria-hidden>
          <Filter className="size-4" />
        </span>
        <div className="w-full sm:w-56">
          <label htmlFor="reports-site" className="mb-1 block text-xs font-medium text-ink-3">
            Website
          </label>
          <Select id="reports-site" value={siteId} onChange={(e) => set('site', e.target.value)}>
            <option value="">All websites</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.domain}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="reports-stage" className="mb-1 block text-xs font-medium text-ink-3">
            Type
          </label>
          <Select id="reports-stage" value={stage} onChange={(e) => set('stage', e.target.value)}>
            <option value="">All types</option>
            {Object.entries(STAGE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load reports" />
        </Card>
      ) : !reports.length ? (
        <Card>
          <EmptyState
            icon={<FileText className="size-5" />}
            title={filtered ? 'No reports match these filters' : 'No reports yet'}
            description={filtered ? 'Try another website or type.' : 'Reports arrive when a run finishes and every week once tracking is on.'}
            action={!filtered && <ButtonLink to={paths.tools(org.id)}>Run an analysis</ButtonLink>}
          />
        </Card>
      ) : (
        <div className={q.isFetching ? 'space-y-6 opacity-80 transition-opacity' : 'space-y-6'}>
          {groups.map((g) => (
            <section key={g.day} aria-label={dayLabel(g.items[0].receivedAt)}>
              <h2 className="mb-2.5 flex items-center gap-2 text-xs font-medium tracking-wide text-ink-3 uppercase">
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-accent-soft text-accent-text" aria-hidden>
                  <CalendarDays className="size-3.5" />
                </span>
                {dayLabel(g.items[0].receivedAt)}
                <span className="rounded-md bg-surface-2 px-1.5 font-normal tracking-normal normal-case tabular text-ink-2">{g.items.length}</span>
              </h2>
              <Card className="divide-y divide-line overflow-hidden">
                {g.items.map((r) => (
                  <ReportRow key={r.id} report={r} />
                ))}
              </Card>
            </section>
          ))}
          <div className="flex flex-col items-center gap-2 pb-4">
            {nextLimit && reports.length >= limit ? (
              <Button variant="secondary" size="sm" loading={q.isFetching} onClick={() => set('limit', String(nextLimit))}>
                Show more
              </Button>
            ) : (
              reports.length >= LIMITS[LIMITS.length - 1] && <p className="text-xs text-ink-3">Showing the latest {reports.length}. Filter by website or type to find older reports.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportRow({ report }: { report: Report }) {
  const { org } = useOrgCtx();
  const to = paths.report(org.id, report.id);
  return (
    // the title link covers the row; the run link and the file links sit above it
    <div className="group relative flex flex-col gap-3 px-4 py-3.5 transition-colors duration-150 ease-brand hover:bg-surface-2/60 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 gap-3">
        <StageGlyph stage={report.stage} report={report} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link to={to} className="truncate font-medium text-ink transition-colors duration-150 ease-brand after:absolute after:inset-0 group-hover:text-accent-text">
              {report.title || stageLabel(report.stage, report)}
            </Link>
            <ArrowRight className="size-3.5 shrink-0 text-ink-3 opacity-0 transition-[opacity,translate] duration-200 ease-brand group-hover:translate-x-0.5 group-hover:text-accent-text group-hover:opacity-100" aria-hidden />
            {report.scheduled && (
              <Badge icon={<CalendarClock className="size-3" aria-hidden />} tone="accent">
                scheduled
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-3">
            {stageLabel(report.stage, report)}
            {report.siteDomain && ` · ${report.siteDomain}`}
            <span title={fmtDateTime(report.receivedAt)}> · {fmtAgo(report.receivedAt)}</span>
            {report.runId && (
              <>
                {' · '}
                <Link to={paths.run(org.id, report.runId)} className="relative z-[1] text-accent-text hover:underline transition-colors duration-150 ease-brand">
                  run
                </Link>
              </>
            )}
          </p>
          <ReportSummaryLine report={report} className="mt-2" />
        </div>
      </div>
      {report.files.length > 0 && (
        <div className="relative z-[1] pl-12 sm:max-w-[45%] sm:pl-0">
          <FileChips files={report.files.filter((f) => !f.field.startsWith('fix_pack.files['))} compact max={4} />
        </div>
      )}
    </div>
  );
}
