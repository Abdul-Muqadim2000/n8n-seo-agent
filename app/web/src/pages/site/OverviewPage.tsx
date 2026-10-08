import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Activity, BellRing, Bot, CheckCircle2, Circle, FileText, Gauge, Lightbulb, Link2, MousePointerClick, PenSquare, TrendingUp } from 'lucide-react';
import { compactNumber, type OverviewData } from '@seo/shared';
import { useSiteData } from '@/lib/queries';
import { paths } from '@/lib/paths';
import { cn, fmtDate, fmtDateTime } from '@/lib/utils';
import { ChartCard, Sparkline, TimeSeriesChart, type Series } from '@/components/charts';
import { StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Delta, Meter, PageHeader, StatTile } from '@/components/ui/misc';
import { DataGate, FillHeight, KpiGrid, MetricSwitch, MiniStat, MoreLink, Panel, RunAnalysisMenu, ToolButton, useSitePage } from './_components/kit';
import { diff, fmtMonthShort, fmtRange, lastTwo, pct, pctChange, plural, sortByDate, timeAxisFormat } from './_components/format';
import { plotAvgPos, PositionMove, posText } from './_components/positions';
import { RecommendationRows, sortRecommendations } from './_components/recommendations';
import { ReportList } from './_components/reports';

export default function OverviewPage() {
  const { org, site } = useSitePage();
  const q = useSiteData(org.id, site.id, 'overview');
  return (
    <div>
      <PageHeader
        title="Overview"
        description={`How ${site.domain} is doing in Google, in AI answers and across the web — and what to do next.`}
        actions={<RunAnalysisMenu />}
      />
      <DataGate q={q}>{(d) => <Overview d={d} refetching={q.isFetching} />}</DataGate>
    </div>
  );
}

function Overview({ d, refetching }: { d: OverviewData; refetching: boolean }) {
  const { org, page } = useSitePage();
  const navigate = useNavigate();
  const search = useMemo(() => sortByDate(d.search.series, (r) => r.periodEnd), [d.search.series]);
  const health = useMemo(() => sortByDate(d.health.series, (r) => r.auditedAt), [d.health.series]);
  const ai = useMemo(() => sortByDate(d.ai.series, (r) => r.checkedAt), [d.ai.series]);
  const links = useMemo(() => sortByDate(d.backlinks.series, (r) => r.month), [d.backlinks.series]);
  const L = d.search.latest;
  const [, prevHealth] = lastTwo(health);
  const [, prevAi] = lastTwo(ai);
  const [, prevLinks] = lastTwo(links);
  const H = d.health.latest;
  const A = d.ai.latest;
  const B = d.backlinks.latest;
  const recs = sortRecommendations(d.recommendations).slice(0, 5);
  const posDelta = L && L.position > 0 && L.prevPosition > 0 ? L.prevPosition - L.position : null;

  return (
    <div className="space-y-6">
      <SetupState d={d} />

      <KpiGrid>
        <StatTile
          label="Clicks from Google"
          icon={<MousePointerClick className="size-4" />}
          value={L ? compactNumber(L.clicks) : '–'}
          delta={L ? <Delta value={pctChange(L.clicks, L.prevClicks)} /> : undefined}
          trend={<Sparkline data={search} dataKey="clicks" />}
          hint={L ? `28 days to ${fmtDate(L.periodEnd)}, change vs the 28 days before` : 'Arrives with weekly tracking'}
          onClick={() => navigate(page('search'))}
        />
        <StatTile
          label="Impressions"
          value={L ? compactNumber(L.impressions) : '–'}
          delta={L ? <Delta value={pctChange(L.impressions, L.prevImpressions)} /> : undefined}
          trend={<Sparkline data={search} dataKey="impressions" />}
          hint={L ? `${plural(L.queries, 'search query', 'search queries')} · ${L.striking} close to page 1` : 'How often Google showed your pages'}
          onClick={() => navigate(page('search'))}
        />
        <StatTile
          label="Average position"
          value={L && L.position > 0 ? L.position.toFixed(1) : '–'}
          delta={posDelta != null ? <Delta value={posDelta} suffix="" /> : undefined}
          trend={<Sparkline data={search.map((r) => ({ ...r, position: plotAvgPos(r.position) }))} dataKey="position" invert />}
          hint="Across every query; a rise means you moved up"
          onClick={() => navigate(page('search'))}
        />
        <StatTile
          label="Organic sessions"
          value={L && L.ga4Connected ? compactNumber(L.sessions) : '–'}
          delta={L && L.ga4Connected ? <Delta value={pctChange(L.sessions, L.prevSessions)} /> : undefined}
          trend={L?.ga4Connected ? <Sparkline data={search} dataKey="sessions" /> : undefined}
          hint={L ? (L.ga4Connected ? `${pct(L.organicShare, 0)} of all sessions · ${compactNumber(L.keyEvents)} key events` : 'Google Analytics is not connected') : 'From Google Analytics 4'}
          onClick={() => navigate(page('search'))}
        />
        <StatTile
          label="Health score"
          icon={<Gauge className="size-4" />}
          value={
            H ? (
              <span>
                {H.healthScore}
                <span className="text-base font-medium text-ink-3">/100</span>
              </span>
            ) : (
              '–'
            )
          }
          delta={H ? <Delta value={diff(H.healthScore, prevHealth?.healthScore)} suffix=" pts" digits={0} /> : undefined}
          trend={<Sparkline data={health} dataKey="healthScore" />}
          hint={H ? <HealthHint grade={H.grade} critical={H.critical} high={H.high} at={H.auditedAt} /> : 'Run a technical audit to score the site'}
          onClick={() => navigate(page('technical'))}
        />
        <StatTile
          label="Named in AI answers"
          icon={<Bot className="size-4" />}
          value={A ? pct(A.mentionRate) : '–'}
          delta={A ? <Delta value={diff(A.mentionRate, prevAi?.mentionRate)} suffix=" pts" /> : undefined}
          trend={<Sparkline data={ai} dataKey="mentionRate" />}
          hint={A ? `Change vs last check · share of voice ${pct(A.shareOfVoice)} · cited in ${pct(A.citationRate)}` : 'ChatGPT, Perplexity, Gemini, Claude and Google AI'}
          onClick={() => navigate(page('ai'))}
        />
        <StatTile
          label={B?.unionDomains != null ? 'Referring sites' : 'Referring domains'}
          icon={<Link2 className="size-4" />}
          value={B ? compactNumber(B.unionDomains ?? B.referringDomains) : '–'}
          delta={B && B.unionDomains == null ? <Delta value={diff(B.referringDomains, prevLinks?.referringDomains)} suffix="" digits={0} /> : undefined}
          trend={<Sparkline data={links} dataKey="referringDomains" />}
          hint={B ? (B.unionDomains != null ? `All sources · DataForSEO ${compactNumber(B.referringDomains)} · ${B.bestLinks ?? 0} best links · spam ${B.spamScore}` : `Change vs last month · ${compactNumber(B.backlinks)} backlinks · spam score ${B.spamScore}`) : 'Sites that link to you'}
          onClick={() => navigate(page('backlinks'))}
        />
        <StatTile
          label="Keywords in the top 10"
          icon={<Activity className="size-4" />}
          value={d.rankings.keywords ? d.rankings.top10 : '–'}
          hint={d.rankings.keywords ? `${d.rankings.top3} in the top 3 · ${d.rankings.top50} in the top 50 · ${d.rankings.keywords} tracked` : 'Track keywords or plan a keyword ladder'}
          onClick={() => navigate(page('rankings'))}
        />
      </KpiGrid>

      {/* the chart card stretches with the recommendations next to it and the chart grows into the space */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SearchTrend series={search} kind={d.search.seriesKind} loading={refetching} className="lg:col-span-2" />
        <Panel
          title="Top recommendations"
          icon={<Lightbulb className="size-4" />}
          flush
          footer={d.recommendations.length > 0 ? <MoreLink to={page('recommendations')}>All {d.recommendations.length} recommendations</MoreLink> : undefined}
        >
          {recs.length ? (
            <RecommendationRows recs={recs} />
          ) : (
            <EmptyState className="py-8" title="Nothing urgent" description="Recommendations appear as tracking, audits and monitors report in. Check back after the next weekly run." />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MiniTrend
          title="Health score"
          empty={!health.length}
          emptyText="No audit yet"
          emptyAction={<ToolButton mode="audit" size="sm">Run a technical audit</ToolButton>}
          more={<MoreLink to={page('technical')}>Technical health</MoreLink>}
          series={[{ key: 'healthScore', label: 'Health score', format: (v) => `${v}/100` }]}
          data={health}
          xKey="auditedAt"
          xFormat={timeAxisFormat(health.map((h) => h.auditedAt))}
          yDomain={[0, 100]}
          loading={refetching}
        />
        <MiniTrend
          title="AI answers"
          empty={!ai.length}
          emptyText="No AI visibility check yet"
          emptyAction={<ToolButton mode="ai_visibility" size="sm">Run an AI visibility check</ToolButton>}
          more={<MoreLink to={page('ai')}>AI visibility</MoreLink>}
          series={[
            { key: 'mentionRate', label: 'Named', format: (v) => pct(v) },
            { key: 'citationRate', label: 'Cited', format: (v) => pct(v) },
            { key: 'shareOfVoice', label: 'Share of voice', format: (v) => pct(v) },
          ]}
          data={ai}
          xKey="checkedAt"
          xFormat={timeAxisFormat(ai.map((r) => r.checkedAt))}
          yFormat={(v) => `${v}%`}
          loading={refetching}
        />
        <MiniTrend
          title="Referring domains"
          empty={!links.length}
          emptyText="No backlink check yet"
          emptyAction={<ToolButton mode="backlinks" size="sm">Run a backlink check</ToolButton>}
          more={<MoreLink to={page('backlinks')}>Backlinks</MoreLink>}
          series={[{ key: 'referringDomains', label: 'Referring domains' }]}
          data={links}
          xKey="month"
          xFormat={fmtMonthShort}
          loading={refetching}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MoversCard d={d} />
        <ContentCard d={d} />
        <AlertsCard d={d} />
      </div>

      <Panel title="Latest reports" icon={<FileText className="size-4" />} flush footer={d.reports.length > 0 ? <MoreLink to={paths.reports(org.id)}>All reports</MoreLink> : undefined}>
        <ReportList
          orgId={org.id}
          reports={d.reports}
          limit={6}
          empty={<EmptyState className="py-8" title="No reports yet" description="Weekly tracking, audits, AI visibility and backlink checks deliver their reports here, with PDF and Word downloads." />}
        />
      </Panel>
    </div>
  );
}

function HealthHint({ grade, critical, high, at }: { grade: string; critical: number; high: number; at: string }) {
  return (
    <span>
      {grade ? `${grade} · ` : ''}
      {critical > 0 ? `${critical} critical, ` : ''}
      {high} high-severity · {fmtDate(at)}
    </span>
  );
}

/** What is still missing for a complete picture, as a short checklist. */
function SetupState({ d }: { d: OverviewData }) {
  const { can, page } = useSitePage();
  const tracking = d.site.trackingStatus;
  const steps: { done: boolean; title: string; detail: string; action: ReactNode }[] = [
    {
      done: tracking === 'active' || !!d.search.latest,
      title: 'Weekly tracking',
      detail: 'Search Console, Analytics, Google Trends and live rank checks every Monday.',
      action: can('admin') ? (
        <ButtonLink to={page('settings/tracking')} size="sm">
          Start weekly tracking
        </ButtonLink>
      ) : (
        <ToolButton mode="track" size="sm">
          Start weekly tracking
        </ToolButton>
      ),
    },
    { done: !!d.health.latest, title: 'Technical audit', detail: 'Crawl, health score and a fix pack.', action: <ToolButton mode="audit" size="sm">Run a technical audit</ToolButton> },
    { done: !!d.ai.latest, title: 'AI visibility baseline', detail: 'Are you named when buyers ask AI assistants?', action: <ToolButton mode="ai_visibility" size="sm">Run the check</ToolButton> },
    { done: !!d.backlinks.latest, title: 'Backlink baseline', detail: 'Who links to you, lost links and link gaps.', action: <ToolButton mode="backlinks" size="sm">Run a backlink check</ToolButton> },
    { done: d.rankings.ladders > 0, title: 'A keyword to rank for', detail: 'A ladder of pages from winnable long-tail up to the head term.', action: <ToolButton mode="ladder" size="sm">Plan a keyword ladder</ToolButton> },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <>
      {tracking === 'paused' && (
        <Callout
          tone="warning"
          title="Weekly tracking is paused"
          action={
            can('admin') ? (
              <ButtonLink to={page('settings/tracking')} size="sm" variant="secondary">
                Resume tracking
              </ButtonLink>
            ) : undefined
          }
        >
          Rankings, traffic and the weekly report stop updating until it is resumed.
        </Callout>
      )}
      {done < steps.length && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">Complete the picture</h2>
              <p className="mt-0.5 text-[13px] text-ink-3">
                {done} of {steps.length} done. Each step fills a part of this dashboard.
              </p>
            </div>
            <Meter value={(done / steps.length) * 100} className="w-40" label="Setup progress" />
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {steps.map((s) => (
              <li key={s.title} className={cn('flex items-start gap-3 rounded-lg border border-line p-3', s.done && 'bg-surface-2')}>
                {s.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good-text" aria-label="Done" /> : <Circle className="mt-0.5 size-4 shrink-0 text-ink-3" aria-label="To do" />}
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', s.done ? 'text-ink-2' : 'text-ink')}>{s.title}</p>
                  <p className="mt-0.5 text-xs leading-snug text-ink-3">{s.detail}</p>
                  {!s.done && <div className="mt-2">{s.action}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

type Metric = 'clicks' | 'impressions' | 'position' | 'sessions';
const METRICS: { value: Metric; label: string; series: Series }[] = [
  { value: 'clicks', label: 'Clicks', series: { key: 'clicks', label: 'Clicks' } },
  { value: 'impressions', label: 'Impressions', series: { key: 'impressions', label: 'Impressions' } },
  { value: 'position', label: 'Position', series: { key: 'position', label: 'Average position', format: (v) => v.toFixed(1) } },
  { value: 'sessions', label: 'Sessions', series: { key: 'sessions', label: 'Organic sessions' } },
];

function SearchTrend({ series, kind, loading, className }: { series: OverviewData['search']['series']; kind: OverviewData['search']['seriesKind']; loading: boolean; className?: string }) {
  const [metric, setMetric] = useState<Metric>('clicks');
  const { page } = useSitePage();
  const m = METRICS.find((x) => x.value === metric)!;
  const rows = series.map((r) => ({ ...r, position: plotAvgPos(r.position) }));
  const first = series[0];
  const last = series[series.length - 1];
  return (
    <ChartCard
      className={className}
      title="Search performance"
      description={last ? (kind === 'daily' ? `Daily Search Console values (${fmtRange(first.periodEnd, last.periodEnd)}); the weekly history starts with the next tracker run` : `Rolling 28-day totals, one point per weekly report (${fmtRange(first.periodEnd, last.periodEnd)})`) : 'Rolling 28-day totals from Search Console and Analytics'}
      loading={loading}
      actions={<MetricSwitch label="Metric" value={metric} onChange={setMetric} options={METRICS.map(({ value, label }) => ({ value, label }))} />}
      table={{
        columns: [
          { key: 'periodEnd', label: '28 days to', format: (v) => fmtDate(String(v)) },
          { key: 'clicks', label: 'Clicks', align: 'right', format: (v) => compactNumber(Number(v)) },
          { key: 'impressions', label: 'Impressions', align: 'right', format: (v) => compactNumber(Number(v)) },
          { key: 'position', label: 'Avg. position', align: 'right', format: (v) => (v ? Number(v).toFixed(1) : '–') },
          { key: 'sessions', label: 'Organic sessions', align: 'right', format: (v) => compactNumber(Number(v)) },
        ],
        rows: [...series].reverse(),
      }}
      footer={<MoreLink to={page('search')}>Daily data, queries and landing pages</MoreLink>}
    >
      {series.length ? (
        <FillHeight min={300}>
          {(h) => <TimeSeriesChart data={rows} xKey="periodEnd" series={[m.series]} area={metric !== 'position'} invertY={metric === 'position'} height={h} yFormat={metric === 'position' ? (v) => String(Math.round(v)) : undefined} />}
        </FillHeight>
      ) : (
        <EmptyState
          icon={<TrendingUp className="size-5" />}
          title="No search data yet"
          description="Weekly tracking reads Search Console and Google Analytics every Monday; the first report arrives a few minutes after you start it."
        />
      )}
    </ChartCard>
  );
}

function MiniTrend({
  title,
  data,
  xKey,
  series,
  empty,
  emptyText,
  emptyAction,
  more,
  yDomain,
  yFormat,
  xFormat,
  loading,
}: {
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  series: Series[];
  empty: boolean;
  emptyText: string;
  emptyAction: ReactNode;
  more: ReactNode;
  yDomain?: [number, number];
  yFormat?: (v: number) => string;
  xFormat?: (v: unknown) => string;
  loading: boolean;
}) {
  return (
    <ChartCard
      title={title}
      series={empty ? undefined : series}
      loading={loading}
      footer={more}
      table={{
        columns: [{ key: xKey, label: 'Date', format: (v) => (xKey === 'month' ? fmtMonthShort(v) : xFormat && xFormat(v).includes(':') ? fmtDateTime(String(v)) : fmtDate(String(v))) }, ...series.map((s) => ({ key: s.key, label: s.label, align: 'right' as const, format: (v: unknown) => (s.format ? s.format(Number(v)) : compactNumber(Number(v))) }))],
        rows: [...data].reverse(),
      }}
    >
      {empty ? (
        <EmptyState className="py-8" title={emptyText} action={emptyAction} />
      ) : (
        <TimeSeriesChart data={data} xKey={xKey} series={series} height={170} yDomain={yDomain} yFormat={yFormat} xFormat={xFormat} area={series.length === 1} />
      )}
    </ChartCard>
  );
}

function MoversCard({ d }: { d: OverviewData }) {
  const { page, tool, can } = useSitePage();
  const r = d.rankings;
  return (
    <Panel title="Ranking movers" icon={<Activity className="size-4" />} description="Biggest changes since the previous weekly check" flush footer={<MoreLink to={page('rankings')}>All rankings</MoreLink>}>
      <div className="grid grid-cols-3 gap-3 border-b border-line px-5 pb-3">
        <MiniStat label="Top 3" value={r.top3} />
        <MiniStat label="Top 10" value={r.top10} />
        <MiniStat label="Top 50" value={r.top50} />
      </div>
      {r.movers.length ? (
        <ul className="divide-y divide-line">
          {r.movers.slice(0, 6).map((m) => (
            <li key={m.keyword} className="flex items-center gap-3 px-5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-ink" title={m.keyword}>
                {m.keyword}
              </span>
              <span className="shrink-0 text-xs tabular text-ink-3">
                {posText(m.from)} → <span className="font-medium text-ink">{posText(m.to)}</span>
              </span>
              <PositionMove prev={m.from} cur={m.to} className="w-24 shrink-0 justify-end" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          className="py-8"
          title={r.keywords ? 'No movement this week' : 'No keywords tracked yet'}
          description={r.keywords ? `${plural(r.keywords, 'keyword')} checked weekly; positions held steady.` : 'Plan a keyword ladder or add keywords to weekly tracking.'}
          action={!r.keywords && can('member') ? <ButtonLink to={page('pipeline/new')} size="sm">Rank for a keyword</ButtonLink> : undefined}
        />
      )}
    </Panel>
  );
}

function ContentCard({ d }: { d: OverviewData }) {
  const { page } = useSitePage();
  const c = d.content;
  return (
    <Panel title="Content pipeline" icon={<PenSquare className="size-4" />} footer={<MoreLink to={page('content')}>Content</MoreLink>}>
      <div className="grid grid-cols-2 gap-4">
        <MiniStat label="Pages started" value={c.started} hint="written by the engine" />
        <MiniStat label="Published" value={c.published} hint="live and checked" />
        <MiniStat label="Waiting to publish" value={c.pendingPublish} hint={c.pendingPublish ? 'written, not live yet' : 'nothing waiting'} />
        <MiniStat label="Blog posts per week" value={c.pagesPerWeek || 'Off'} hint={`${plural(c.caseStudies, 'case study', 'case studies')} on file`} />
      </div>
      {c.pendingPublish > 0 && (
        <Callout tone="warning" className="mt-4">
          {plural(c.pendingPublish, 'page is', 'pages are')} written but not live. Nothing can rank before it is published — publish and report the URL.
        </Callout>
      )}
    </Panel>
  );
}

function AlertsCard({ d }: { d: OverviewData }) {
  const { page } = useSitePage();
  const a = d.alerts;
  return (
    <Panel title="Alerts & check-ins" icon={<BellRing className="size-4" />} footer={<MoreLink to={page('alerts')}>Alerts & check-ins</MoreLink>}>
      <div className="flex items-center gap-3">
        <span className="font-display text-3xl font-semibold tracking-[-0.01em] text-ink">{a.open}</span>
        {a.open > 0 ? <StatusBadge tone="warning">Open Search Console {a.open === 1 ? 'alert' : 'alerts'}</StatusBadge> : <StatusBadge tone="good">No open alerts</StatusBadge>}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-3">Search Console notification mails (manual actions, security issues, indexing) are read and raised here automatically.</p>
      {a.checkinDue ? (
        <Callout tone="warning" className="mt-4" title="Monthly check-in due">
          Two minutes in Search Console: manual actions, security issues and the Pages report.
          <div className="mt-2">
            <ToolButton mode="checkin" size="sm">
              Record the check-in
            </ToolButton>
          </div>
        </Callout>
      ) : (
        <p className="mt-4 flex items-center gap-1.5 text-[13px] text-good-text">
          <CheckCircle2 className="size-4" aria-hidden />
          This month’s check-in is recorded
        </p>
      )}
    </Panel>
  );
}
