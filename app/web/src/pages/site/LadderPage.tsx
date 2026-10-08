import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileText,
  ListOrdered,
  MousePointerClick,
  PenLine,
  ScanSearch,
  SearchX,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { compactNumber, formatUsd, type LadderDetail, type LadderPage, type LadderTimelineEvent } from '@seo/shared';
import { ChartCard, Sparkline, TimeSeriesChart } from '@/components/charts';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageHeader, StatTile } from '@/components/ui/misc';
import { ApiRequestError } from '@/lib/api';
import { useOrgCtx, useSiteCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { useLadder } from '@/lib/queries';
import { cn, fmtAgo, fmtDate, fmtDay } from '@/lib/utils';
import { StageGlyph } from '@/components/reports/meta';
import { plural, sortByDate } from './_components/format';
import { PositionHistoryCard, type HistoryLine } from './_components/history';
import { ranked } from './_components/positions';
import { Climb } from './_components/pipeline/climb';
import { LadderStatusBadge, ModeChip, monthsText, PLAN_HINT, PLAN_LABEL, PositionChange, positionWords, fmtShortDay, sparkRows, validDate } from './_components/pipeline/common';
import { DeleteLadderButton, LadderModeSwitch, LadderPauseButton, MODE_HELP } from './_components/pipeline/controls';
import { WarnLine } from './_components/pipeline/home';
import { WriteNowDialog, type WriteNowItem } from './_components/pipeline/WriteNowDialog';

// One keyword ladder (PIPELINE_FEATURE_SPEC.md §4.2): the main keyword, the climb from easy pages to the main page, what happened and
// what comes next, the results on Google and in Search Console, and the ladder's reports.

export default function LadderPage() {
  const { ladderId = '' } = useParams();
  const { org } = useOrgCtx();
  const { site } = useSiteCtx();
  const q = useLadder(org.id, site.id, ladderId);
  const back = (
    <Link to={paths.site(org.id, site.id, 'pipeline')} className="group inline-flex items-center gap-1 transition-colors duration-150 ease-brand hover:text-accent-text">
      <ArrowLeft className="size-3.5 transition-transform duration-200 ease-brand group-hover:-translate-x-0.5" aria-hidden />
      Pipeline
    </Link>
  );

  if (q.data) return <Ladder ladder={q.data} back={back} />;
  if (q.isError && q.error instanceof ApiRequestError && q.error.status === 404)
    return (
      <EmptyState
        titleAs="h1"
        icon={<SearchX className="size-5" />}
        title="This keyword ladder was not found"
        description="It may have been deleted, or it belongs to another website."
        action={<ButtonLink to={paths.site(org.id, site.id, 'pipeline')}>Back to the Pipeline</ButtonLink>}
      />
    );
  if (q.isError)
    return (
      <div>
        <div className="mb-4 text-[13px] font-medium text-ink-3">{back}</div>
        <ErrorState error={q.error} onRetry={() => void q.refetch()} titleAs="h1" />
      </div>
    );
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function Ladder({ ladder: l, back }: { ladder: LadderDetail; back: ReactNode }) {
  const { can } = useOrgCtx();
  const admin = can('admin');
  const [writing, setWriting] = useState<WriteNowItem | null>(null);
  const series = sparkRows(l.headSeries);
  const meta = [
    l.country,
    // a plan without supporting pages (narrow topic: no long-tail keywords in the data) is the main page only, written first
    l.planType ? `${PLAN_LABEL[l.planType]}: ${l.pages.length > 0 && l.pages.every((p) => p.rung >= 4) ? 'the main page only for now (no supporting keywords in the data)' : PLAN_HINT[l.planType]}` : '',
    validDate(l.startDate) ? `started ${fmtDate(l.startDate)}` : '',
    monthsText(l.months) ? `expected ${monthsText(l.months)}` : '',
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={back}
        title={l.head}
        description={
          <>
            <span className="block text-ink-3">Keyword ladder · {meta.join(' · ')}</span>
            <span className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <LadderStatusBadge status={l.status} />
              {!admin && <ModeChip mode={l.mode} />}
              {l.statusText && <span className="min-w-0">{l.statusText}</span>}
            </span>
          </>
        }
        actions={
          admin && (
            <div className="flex flex-col items-start gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <LadderModeSwitch ladder={l} size="md" />
                <LadderPauseButton ladder={l} />
                <DeleteLadderButton ladder={l} />
              </div>
              <p className="text-xs text-ink-3">
                {MODE_HELP[l.mode]} Priority {l.priority}: change it on the Pipeline page.
              </p>
            </div>
          )
        }
      />
      {(l.overlaps ?? []).map((o) => (
        <WarnLine key={o.ladderId}>
          Overlap: shares {o.keywords.length === 1 ? 'a keyword' : `${o.keywords.length} keywords`} with the ladder “{o.head}” ({o.keywords.slice(0, 4).join(', ')}
          {o.keywords.length > 4 ? ', …' : ''}). Two pages for one search compete with each other.
        </WarnLine>
      ))}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Main keyword on Google"
          value={positionWords(l.headPosition)}
          delta={<PositionChange change={l.headChange} />}
          trend={series.length > 1 ? <Sparkline data={series} dataKey="p" invert /> : undefined}
          hint={l.top3 > 0 ? `${plural(l.top3, 'page')} of this ladder in the top 3` : undefined}
        />
        <StatTile label="Pages live" value={`${l.counts.published} of ${l.counts.total}`} hint={[l.counts.waiting ? `${l.counts.waiting} waiting for you to publish` : '', l.counts.writing ? `${l.counts.writing} being written` : '', l.counts.planned ? `${l.counts.planned} planned` : ''].filter(Boolean).join(' · ') || undefined} />
        <StatTile label="Pages in the top 10" value={l.top10} hint={`${l.top3} in the top 3`} />
        <StatTile
          label="Clicks, last 28 days"
          value={compactNumber(l.traffic?.clicks28d ?? 0)}
          hint={`${compactNumber(l.traffic?.impressions28d ?? 0)} times shown on Google (impressions), from Search Console`}
        />
        <StatTile
          label="Next step"
          value={<span className="block text-base font-semibold leading-snug">{l.next?.text || 'Nothing planned'}</span>}
          hint={validDate(l.next?.at) ? `${fmtShortDay(l.next.at)} · ${fmtAgo(l.next.at)}` : undefined}
        />
        <StatTile label="Cost so far" value={formatUsd(l.costSoFarUsd)} hint={`about ${formatUsd(l.monthlyCostUsd)} a month from now on${l.expectedVisitsTop3 ? ` · about ${compactNumber(l.expectedVisitsTop3)} visits a month once the main keyword is in the top 3` : ''}`} />
      </div>

      <Climb ladder={l} onWrite={setWriting} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] xl:items-start">
        <Timeline events={l.timeline ?? []} />
        <div className="min-w-0 space-y-4">
          <PositionResults ladder={l} />
          <Traffic ladder={l} />
        </div>
      </div>

      <Reports ladder={l} />

      {writing && <WriteNowDialog item={writing} onClose={() => setWriting(null)} />}
    </div>
  );
}

// ---------- timeline ----------
const EVENT_ICON: Record<LadderTimelineEvent['kind'], ReactNode> = {
  planned: <ListOrdered className="size-3.5" />,
  written: <PenLine className="size-3.5" />,
  published: <CheckCircle2 className="size-3.5" />,
  top10: <TrendingUp className="size-3.5" />,
  top3: <Trophy className="size-3.5" />,
  drop: <TrendingDown className="size-3.5" />,
  next: <CalendarClock className="size-3.5" />,
};

function Timeline({ events }: { events: LadderTimelineEvent[] }) {
  const past = sortByDate(
    events.filter((e) => !e.future),
    (e) => e.at,
  );
  const future = sortByDate(
    events.filter((e) => e.future),
    (e) => e.at,
  );
  const row = (e: LadderTimelineEvent, i: number) => (
    <li key={`${e.kind}-${e.at}-${i}`} className="relative grid grid-cols-[4.5rem_1.5rem_minmax(0,1fr)] items-start gap-x-2 py-1.5">
      <span className={cn('pt-0.5 text-xs tabular', e.future ? 'text-ink-3' : 'text-ink-2')}>{validDate(e.at) ? fmtDay(e.at) : '–'}</span>
      <span
        className={cn(
          'relative z-[1] flex size-6 items-center justify-center rounded-full border',
          e.future ? 'border-dashed border-line-strong bg-surface text-ink-3' : e.kind === 'drop' ? 'border-transparent bg-critical-soft text-critical-text' : e.kind === 'top3' || e.kind === 'top10' || e.kind === 'published' ? 'border-transparent bg-good-soft text-good-text' : 'border-transparent bg-surface-2 text-ink-2',
        )}
        aria-hidden
      >
        {EVENT_ICON[e.kind]}
      </span>
      <span className={cn('min-w-0 break-words pt-0.5 text-[13px] leading-snug', e.future ? 'text-ink-3' : 'text-ink')}>
        {e.text}
        {e.detected && (
          <Badge tone="good" icon={<ScanSearch className="size-3" aria-hidden />} className="ml-1.5 align-middle">
            Found automatically
          </Badge>
        )}
      </span>
    </li>
  );
  return (
    <Card>
      <CardHeader icon={<CalendarClock className="size-4" />} title="Timeline" description="What happened so far and what comes next on the Mondays ahead." />
      <CardBody>
        {!events.length ? (
          <p className="text-sm text-ink-3">Nothing yet: the plan, written pages, publishing and Google milestones show up here.</p>
        ) : (
          <ol className="relative before:absolute before:bottom-3 before:left-[calc(4.5rem+0.5rem+0.75rem)] before:top-3 before:w-px before:bg-line" aria-label="Timeline">
            {past.map(row)}
            <li className="relative my-1.5 grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-2" aria-label={`Today, ${fmtDate(new Date())}`}>
              <span className="text-xs font-semibold text-accent-text">Today</span>
              <span className="h-px bg-accent" aria-hidden />
            </li>
            {future.length ? future.map(row) : <li className="py-1.5 pl-[5rem] text-[13px] text-ink-3">Nothing scheduled for this ladder.</li>}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

// ---------- results ----------
/** The main keyword plus the best-placed page of each supporting rung (at most 4 lines). */
function resultLines(l: LadderDetail): HistoryLine[] {
  const lines: HistoryLine[] = [];
  const head = l.headSeries?.length ? l.headSeries : (l.pages ?? []).find((p) => p.rung >= 4)?.history ?? [];
  if (head.length) lines.push({ key: 'head', label: `Main keyword: ${l.head}`, history: head, slot: 0 });
  for (const rung of [1, 2, 3]) {
    const pages = (l.pages ?? []).filter((p) => p.rung === rung && p.history?.length && p.keyword !== l.head);
    if (!pages.length) continue;
    const best = [...pages].sort((a, b) => score(a) - score(b))[0];
    lines.push({ key: `r${rung}`, label: `Rung ${rung}: ${best.keyword}`, history: best.history, slot: rung });
  }
  return lines.slice(0, 5);
}
const score = (p: LadderPage) => (ranked(p.position) ? p.position : ranked(p.bestPosition) ? 100 + p.bestPosition : 1000 - (p.history?.length ?? 0));

function PositionResults({ ladder: l }: { ladder: LadderDetail }) {
  const lines = useMemo(() => resultLines(l), [l]);
  // every check "not in the top 50": a chart of lines on the floor says nothing
  if (!lines.some((x) => x.history.some((h) => h.position > 0))) {
    const checks = [...new Set(lines.flatMap((x) => x.history.map((h) => String(h.checkedAt).slice(0, 10))))].sort();
    return (
      <Card>
        <CardHeader icon={<TrendingUp className="size-4" />} title="Position on Google over time" />
        <EmptyState
          className="py-8"
          title={checks.length ? 'Not in the top 50 yet' : 'No Google checks yet'}
          description={
            checks.length
              ? `Checked ${checks.length === 1 ? 'once' : `on ${checks.length} days`} since ${fmtDate(checks[0])}. Pages usually need a few weeks after they go live; the easy pages show up first. The chart starts with the first page in the top 50.`
              : 'The rank check runs every Monday. Positions show up here once the ladder’s pages are checked.'
          }
        />
      </Card>
    );
  }
  return (
    <PositionHistoryCard
      title="Position on Google over time"
      description="The main keyword and the best page of each rung, per weekly check (1 = top of Google). Points on the bottom line were not in the top 50."
      lines={lines}
      height={260}
    />
  );
}

function Traffic({ ladder: l }: { ladder: LadderDetail }) {
  const points = sortByDate(l.traffic?.points ?? [], (p) => p.periodEnd);
  if (!points.length)
    return (
      <Card>
        <CardHeader icon={<MousePointerClick className="size-4" />} title="Visits from Google" />
        <EmptyState
          className="py-8"
          title="No clicks yet"
          description="Clicks and impressions of the ladder’s live pages show up here once Search Console reports them, usually a few weeks after a page is published."
        />
      </Card>
    );
  const rows = points.map((p) => ({ periodEnd: p.periodEnd, clicks: p.clicks, impressions: p.impressions }));
  const table = (key: 'clicks' | 'impressions', label: string) => ({
    columns: [
      { key: 'periodEnd', label: 'Period ending', format: (v: unknown) => fmtDate(String(v)) },
      { key, label, align: 'right' as const, format: (v: unknown) => compactNumber(Number(v)) },
    ],
    rows: [...rows].reverse(),
  });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard title="Clicks from Google" description="Visits to the ladder’s pages, per period" table={table('clicks', 'Clicks')}>
        <TimeSeriesChart data={rows} xKey="periodEnd" series={[{ key: 'clicks', label: 'Clicks' }]} height={180} area />
      </ChartCard>
      <ChartCard title="Times shown on Google" description="Impressions of the ladder’s pages, per period" table={table('impressions', 'Impressions')}>
        <TimeSeriesChart data={rows} xKey="periodEnd" series={[{ key: 'impressions', label: 'Impressions', color: 'var(--series-1)' }]} height={180} area />
      </ChartCard>
    </div>
  );
}

// ---------- reports ----------
function Reports({ ladder: l }: { ladder: LadderDetail }) {
  const { org } = useOrgCtx();
  const reports = sortByDate(l.reports ?? [], (r) => r.receivedAt, 'desc');
  return (
    <Card>
      <CardHeader icon={<FileText className="size-4" />} title="Reports of this ladder" description="The ladder plan, the pages written for it and the weekly rank checks." />
      <CardBody>
        {!reports.length ? (
          <p className="text-sm text-ink-3">No reports yet for this ladder.</p>
        ) : (
          <ul className="divide-y divide-line">
            {reports.map((r) => (
              // the title link covers the row
              <li key={r.id} className="group relative -mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg px-2 py-2.5 transition-colors duration-150 ease-brand hover:bg-surface-2/60">
                <span className="flex min-w-0 items-center gap-3">
                  <StageGlyph stage={r.stage} size="sm" report={r} />
                  <Link to={paths.report(org.id, r.id)} className="min-w-0 text-sm font-medium text-ink transition-colors duration-150 ease-brand after:absolute after:inset-0 after:rounded-lg group-hover:text-accent-text">
                    {r.title}
                  </Link>
                </span>
                <span className="text-xs text-ink-3">
                  {r.scheduled ? 'automatic · ' : ''}
                  {fmtDate(r.receivedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
