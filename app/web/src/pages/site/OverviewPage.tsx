import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Activity, BellRing, Bot, CalendarDays, CheckCircle2, Clock, FileText, Gauge, LayoutDashboard, Lightbulb, Link2, MousePointerClick, PenSquare, TrendingUp } from 'lucide-react';
import { compactNumber, type OverviewData } from '@seo/shared';
import { useSiteData } from '@/lib/queries';
import { paths } from '@/lib/paths';
import { cn, fmtDate, fmtDateTime } from '@/lib/utils';
import { ChartCard, Sparkline, TimeSeriesChart, type Series } from '@/components/charts';
import { StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Delta, PageHeader, scoreTone } from '@/components/ui/misc';
import { CountUp, DistributionBar, DistributionLegend, HeroLink, HeroNextStep, HeroStat, IconTile, InfoTip, InsightItem, MetricCard, ProgressBar, ProgressSteps, ScoreRing, SEQ, Stagger, SummaryHero, type Step } from '@/components/insight';
import { DataGate, FillHeight, MetricSwitch, MiniStat, MoreLink, Panel, PriorityBadge, RunAnalysisMenu, ToolButton, useSitePage } from './_components/kit';
import { diff, fmtMonthShort, fmtRange, lastTwo, pct, pctChange, plural, sortByDate, timeAxisFormat } from './_components/format';
import { plotAvgPos, PositionMove, posText } from './_components/positions';
import { CATEGORY_META, RecommendationButton, sortRecommendations } from './_components/recommendations';
import { ReportList } from './_components/reports';

export default function OverviewPage() {
  const { org, site } = useSitePage();
  const q = useSiteData(org.id, site.id, 'overview');
  return (
    <div>
      <PageHeader
        icon={<LayoutDashboard />}
        title="Overview"
        description={`How ${site.domain} is doing in Google, in AI answers and across the web — and what to do next.`}
        actions={<RunAnalysisMenu />}
      />
      <DataGate q={q} skeleton={<OverviewSkeleton />}>
        {(d) => <Overview d={d} refetching={q.isFetching} />}
      </DataGate>
    </div>
  );
}

/** First load: the page's own shape (hero, four cards, the to-do list, chart + list). */
function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-[300px] rounded-xl" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[168px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[320px] rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[360px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
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
  const r = d.rankings;

  return (
    <Stagger className="space-y-6">
      <PausedNotice d={d} />
      <SetupChecklist d={d} />

      {/* how am I doing in Google, what changed, what to do next */}
      <SummaryHero
        tone="blue"
        eyebrow={
          L ? (
            <>
              <span className="font-mono tracking-[0.02em] uppercase">Google search</span>
              <span className="hidden sm:inline" aria-hidden>
                ·
              </span>
              <span className="basis-full sm:basis-auto">28 days to {fmtDate(L.periodEnd)}, change vs the 28 days before</span>
            </>
          ) : (
            <span className="font-mono tracking-[0.02em] uppercase">Google search</span>
          )
        }
        title={searchHeadline(L)}
        description={recsLine(d)}
        aside={recs[0] ? <NextStep d={d} /> : undefined}
        stats={
          <>
            <HeroStat
              label="Clicks from Google"
              value={L ? <CountUp value={L.clicks} format={compactNumber} /> : '–'}
              delta={L ? <Delta value={pctChange(L.clicks, L.prevClicks)} /> : undefined}
              trend={<Sparkline data={search} dataKey="clicks" />}
              hint={L ? undefined : 'Arrives with weekly tracking'}
              onClick={() => navigate(page('search'))}
            />
            <HeroStat
              label="Impressions"
              value={L ? <CountUp value={L.impressions} format={compactNumber} /> : '–'}
              delta={L ? <Delta value={pctChange(L.impressions, L.prevImpressions)} /> : undefined}
              trend={<Sparkline data={search} dataKey="impressions" />}
              hint={L ? `${plural(L.queries, 'search query', 'search queries')} · ${L.striking} close to page 1` : 'How often Google showed your pages'}
              onClick={() => navigate(page('search'))}
            />
            <HeroStat
              label="Average position"
              info="Across every query; a rise means you moved up"
              value={L && L.position > 0 ? <CountUp value={L.position} format={(v) => v.toFixed(1)} /> : '–'}
              delta={posDelta != null ? <Delta value={posDelta} suffix="" /> : undefined}
              trend={<Sparkline data={search.map((s) => ({ ...s, position: plotAvgPos(s.position) }))} dataKey="position" invert />}
              onClick={() => navigate(page('search'))}
            />
            <HeroStat
              label="Organic sessions"
              value={L && L.ga4Connected ? <CountUp value={L.sessions} format={compactNumber} /> : '–'}
              delta={L && L.ga4Connected ? <Delta value={pctChange(L.sessions, L.prevSessions)} /> : undefined}
              trend={L?.ga4Connected ? <Sparkline data={search} dataKey="sessions" /> : undefined}
              hint={L ? (L.ga4Connected ? `${pct(L.organicShare, 0)} of all sessions · ${compactNumber(L.keyEvents)} key events` : 'Google Analytics is not connected') : 'From Google Analytics 4'}
              onClick={() => navigate(page('search'))}
            />
          </>
        }
      />

      {/* site health, AI answers, links and rankings: one card each */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard
          label="Health score"
          icon={<Gauge />}
          tone={H && scoreTone(H.healthScore) !== 'accent' ? (scoreTone(H.healthScore) as 'good' | 'warning' | 'critical') : 'blue'}
          visual={H ? <ScoreRing label="Health score" value={H.healthScore} display={<CountUp value={H.healthScore} />} suffix="/100" size={68} /> : undefined}
          value="–"
          delta={H ? <Delta value={diff(H.healthScore, prevHealth?.healthScore)} suffix=" pts" digits={0} /> : undefined}
          sparkline={<Sparkline data={health} dataKey="healthScore" />}
          meta={H ? <HealthHint grade={H.grade} score={H.healthScore} critical={H.critical} high={H.high} at={H.auditedAt} /> : 'Run a technical audit to score the site'}
          onClick={() => navigate(page('technical'))}
        />
        <MetricCard
          label="Named in AI answers"
          icon={<Bot />}
          visual={A ? <ScoreRing label="Named in AI answers" value={A.mentionRate} tone="accent" display={<CountUp value={A.mentionRate} format={(v) => pct(v)} />} valueText={pct(A.mentionRate)} size={68} /> : undefined}
          value="–"
          delta={A ? <Delta value={diff(A.mentionRate, prevAi?.mentionRate)} suffix=" pts" /> : undefined}
          deltaLabel={A ? 'vs last check' : undefined}
          sparkline={<Sparkline data={ai} dataKey="mentionRate" />}
          meta={A ? `Share of voice ${pct(A.shareOfVoice)} · cited in ${pct(A.citationRate)}` : 'ChatGPT, Perplexity, Gemini, Claude and Google AI'}
          onClick={() => navigate(page('ai'))}
        />
        <MetricCard
          label={B?.unionDomains != null ? 'Referring sites' : 'Referring domains'}
          icon={<Link2 />}
          value={B ? <CountUp value={B.unionDomains ?? B.referringDomains} format={compactNumber} /> : '–'}
          delta={B && B.unionDomains == null ? <Delta value={diff(B.referringDomains, prevLinks?.referringDomains)} suffix="" digits={0} /> : undefined}
          deltaLabel={B && B.unionDomains == null ? 'vs last month' : undefined}
          sparkline={<Sparkline data={links} dataKey="referringDomains" />}
          meta={
            B
              ? B.unionDomains != null
                ? `All sources · DataForSEO ${compactNumber(B.referringDomains)} · ${B.bestLinks ?? 0} best links · spam ${B.spamScore}`
                : `${compactNumber(B.backlinks)} backlinks · spam score ${B.spamScore}`
              : 'Sites that link to you'
          }
          onClick={() => navigate(page('backlinks'))}
        />
        <MetricCard
          label="Keywords in the top 10"
          icon={<Activity />}
          info={r.keywords ? `${r.top3} in the top 3 · ${r.top10} in the top 10 · ${r.top50} in the top 50 · ${r.keywords} tracked` : undefined}
          value={r.keywords ? <CountUp value={r.top10} /> : '–'}
          deltaLabel={r.keywords ? `of ${plural(r.keywords, 'keyword')} tracked` : undefined}
          sparkline={
            r.keywords ? (
              <div className="flex h-full items-center">
                <DistributionBar label="Tracked keywords by position" segments={keywordBuckets(r)} legend={false} className="w-full" />
              </div>
            ) : undefined
          }
          meta={r.keywords ? <DistributionLegend segments={keywordBuckets(r)} /> : 'Track keywords or plan a keyword ladder'}
          onClick={() => navigate(page('rankings'))}
        />
      </div>

      {/* what to do next */}
      <Panel
        title="Top recommendations"
        icon={<Lightbulb />}
        description={d.recommendations.length ? `${plural(d.recommendations.length, 'recommendation')}, most urgent first` : undefined}
        flush
        footer={d.recommendations.length > 0 ? <MoreLink to={page('recommendations')}>All {d.recommendations.length} recommendations</MoreLink> : undefined}
      >
        {recs.length ? (
          <ul className="divide-y divide-line border-t border-line">
            {recs.map((rec) => {
              const meta = CATEGORY_META[rec.category] ?? CATEGORY_META.setup;
              return (
                <InsightItem
                  key={rec.id}
                  icon={meta.icon}
                  meta={
                    <>
                      <PriorityBadge priority={rec.priority} short />
                      <span className="text-xs text-ink-3">{meta.label}</span>
                    </>
                  }
                  title={rec.title}
                  titleAttr={rec.title}
                  clampTitle
                  description={rec.evidence ? <span className="block truncate tabular">{rec.evidence}</span> : <span className="line-clamp-1">{rec.detail}</span>}
                  detail={rec.evidence ? rec.detail : undefined}
                  detailLabel="Why it matters"
                  action={rec.action ? <RecommendationButton action={rec.action} /> : undefined}
                  actionPosition="side"
                />
              );
            })}
          </ul>
        ) : (
          <EmptyState className="py-8" icon={<Lightbulb className="size-5" />} title="Nothing urgent" description="Recommendations appear as tracking, audits and monitors report in. Check back after the next weekly run." />
        )}
      </Panel>

      {/* the chart card stretches with the movers next to it and the chart grows into the space */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SearchTrend series={search} kind={d.search.seriesKind} loading={refetching} className="lg:col-span-2" />
        <MoversCard d={d} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MiniTrend
          title="Health score"
          icon={<Gauge />}
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
          icon={<Bot />}
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
          xFormat={timeAxisFormat(ai.map((x) => x.checkedAt))}
          yFormat={(v) => `${v}%`}
          loading={refetching}
        />
        <MiniTrend
          title="Referring domains"
          icon={<Link2 />}
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
        <ContentCard d={d} className="lg:col-span-2" />
        <AlertsCard d={d} />
      </div>

      <Panel title="Latest reports" icon={<FileText />} flush footer={d.reports.length > 0 ? <MoreLink to={paths.reports(org.id)}>All reports</MoreLink> : undefined}>
        <ReportList
          orgId={org.id}
          reports={d.reports}
          limit={6}
          empty={<EmptyState className="py-8" icon={<FileText className="size-5" />} title="No reports yet" description="Weekly tracking, audits, AI visibility and backlink checks deliver their reports here, with PDF and Word downloads." />}
        />
      </Panel>
    </Stagger>
  );
}

/** Tracked keywords split by position (the counts are cumulative: top 10 includes the top 3). */
function keywordBuckets(r: OverviewData['rankings']) {
  return [
    { label: 'Top 3', value: r.top3, color: SEQ[5] },
    { label: '4–10', value: r.top10 - r.top3, color: SEQ[3] },
    { label: '11–50', value: r.top50 - r.top10, color: SEQ[1] },
    { label: 'Not ranked yet', value: Math.max(0, r.keywords - r.top50), color: 'var(--surface-3)' },
  ];
}

/** The hero's headline: how clicks from Google moved over the last 28 days. */
function searchHeadline(L: OverviewData['search']['latest']): string {
  if (!L) return 'Search data arrives with weekly tracking';
  const n = compactNumber(L.clicks);
  const ch = pctChange(L.clicks, L.prevClicks);
  if (ch == null) return `${n} ${L.clicks === 1 ? 'click' : 'clicks'} from Google in the last 28 days`;
  if (ch >= 0.5) return `Clicks from Google are up ${ch.toFixed(1)}% to ${n}`;
  if (ch <= -0.5) return `Clicks from Google are down ${Math.abs(ch).toFixed(1)}% to ${n}`;
  return `Clicks from Google are steady at ${n}`;
}

/** The hero's second line: how much is waiting for you. */
function recsLine(d: OverviewData): string {
  const n = d.recommendations.length;
  if (!n) return 'Nothing urgent. Recommendations appear as tracking, audits and monitors report in.';
  const high = d.recommendations.filter((x) => x.priority === 'high').length;
  return `${plural(n, 'recommendation is', 'recommendations are')} open${high ? `, ${high === n ? (n === 1 ? 'high priority' : 'all high priority') : `${high} of them high priority`}` : ''}.`;
}

/** The most urgent recommendation, as the hero's call to action. */
function NextStep({ d }: { d: OverviewData }) {
  const { page } = useSitePage();
  const rec = sortRecommendations(d.recommendations)[0];
  if (!rec) return null;
  const meta = CATEGORY_META[rec.category] ?? CATEGORY_META.setup;
  return (
    <HeroNextStep
      icon={meta.icon}
      eyebrow={`Next step · ${meta.label}`}
      title={rec.title}
      actions={
        <>
          {rec.action && <RecommendationButton action={rec.action} variant="secondary" />}
          <HeroLink to={page('recommendations')}>All {d.recommendations.length}</HeroLink>
        </>
      }
    />
  );
}

function HealthHint({ grade, score, critical, high, at }: { grade: string; score: number; critical: number; high: number; at: string }) {
  const t = scoreTone(score);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {grade && <StatusBadge tone={t === 'accent' ? 'neutral' : t}>{grade}</StatusBadge>}
      {critical > 0 && <StatusBadge tone="critical">{critical} critical</StatusBadge>}
      <StatusBadge tone={high > 0 ? 'serious' : 'neutral'}>{high} high-severity</StatusBadge>
      <span>{fmtDate(at)}</span>
    </span>
  );
}

/** Weekly tracking paused: say so first. */
function PausedNotice({ d }: { d: OverviewData }) {
  const { can, page } = useSitePage();
  if (d.site.trackingStatus !== 'paused') return null;
  return (
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
  );
}

/** What is still missing for a complete picture, as a short checklist. */
function SetupChecklist({ d }: { d: OverviewData }) {
  const { can, page } = useSitePage();
  const tracking = d.site.trackingStatus;
  const steps: Step[] = [
    {
      done: tracking === 'active' || !!d.search.latest,
      title: 'Weekly tracking',
      icon: <TrendingUp />,
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
    { done: !!d.health.latest, title: 'Technical audit', icon: <Gauge />, detail: 'Crawl, health score and a fix pack.', action: <ToolButton mode="audit" size="sm">Run a technical audit</ToolButton> },
    { done: !!d.ai.latest, title: 'AI visibility baseline', icon: <Bot />, detail: 'Are you named when buyers ask AI assistants?', action: <ToolButton mode="ai_visibility" size="sm">Run the check</ToolButton> },
    { done: !!d.backlinks.latest, title: 'Backlink baseline', icon: <Link2 />, detail: 'Who links to you, lost links and link gaps.', action: <ToolButton mode="backlinks" size="sm">Run a backlink check</ToolButton> },
    { done: d.rankings.ladders > 0, title: 'A keyword to rank for', icon: <Activity />, detail: 'A ladder of pages from winnable long-tail up to the head term.', action: <ToolButton mode="ladder" size="sm">Plan a keyword ladder</ToolButton> },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done >= steps.length) return null;
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <ScoreRing label="Setup progress" value={(done / steps.length) * 100} tone="accent" display={`${done}/${steps.length}`} valueText={`${done} of ${steps.length} done`} size={56} />
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-ink">Complete the picture</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {done} of {steps.length} done. Each step fills a part of this dashboard.
          </p>
        </div>
      </div>
      <ProgressSteps steps={steps} className="mt-4" />
    </Card>
  );
}

type Metric = 'clicks' | 'impressions' | 'position' | 'sessions';
const METRICS: { value: Metric; label: string; series: Series }[] = [
  { value: 'clicks', label: 'Clicks', series: { key: 'clicks', label: 'Clicks' } },
  { value: 'impressions', label: 'Impressions', series: { key: 'impressions', label: 'Impressions' } },
  { value: 'position', label: 'Position', series: { key: 'position', label: 'Average position', format: (v) => v.toFixed(1) } },
  { value: 'sessions', label: 'Sessions', series: { key: 'sessions', label: 'Organic sessions' } },
];

/** A chart card title with its icon tile and (optionally) the explanation behind an info tip. */
function ChartTitle({ icon, children, info }: { icon: ReactNode; children: ReactNode; info?: ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <IconTile size="sm">{icon}</IconTile>
      <span className="flex min-w-0 items-center gap-1">
        {children}
        {info && <InfoTip label="About this chart">{info}</InfoTip>}
      </span>
    </span>
  );
}

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
      title={
        <ChartTitle
          icon={<TrendingUp />}
          info={last ? (kind === 'daily' ? `Daily Search Console values (${fmtRange(first.periodEnd, last.periodEnd)}); the weekly history starts with the next tracker run` : `Rolling 28-day totals, one point per weekly report (${fmtRange(first.periodEnd, last.periodEnd)})`) : 'Rolling 28-day totals from Search Console and Analytics'}
        >
          Search performance
        </ChartTitle>
      }
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
  icon,
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
  icon: ReactNode;
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
      title={<ChartTitle icon={icon}>{title}</ChartTitle>}
      series={empty ? undefined : series}
      loading={loading}
      footer={more}
      table={{
        columns: [{ key: xKey, label: 'Date', format: (v) => (xKey === 'month' ? fmtMonthShort(v) : xFormat && xFormat(v).includes(':') ? fmtDateTime(String(v)) : fmtDate(String(v))) }, ...series.map((s) => ({ key: s.key, label: s.label, align: 'right' as const, format: (v: unknown) => (s.format ? s.format(Number(v)) : compactNumber(Number(v))) }))],
        rows: [...data].reverse(),
      }}
    >
      {empty ? (
        <EmptyState className="py-8" icon={<span className="[&_svg]:size-5">{icon}</span>} title={emptyText} action={emptyAction} />
      ) : (
        <TimeSeriesChart data={data} xKey={xKey} series={series} height={170} yDomain={yDomain} yFormat={yFormat} xFormat={xFormat} area={series.length === 1} />
      )}
    </ChartCard>
  );
}

function MoversCard({ d }: { d: OverviewData }) {
  const { page, can } = useSitePage();
  const r = d.rankings;
  return (
    <Panel title="Ranking movers" icon={<Activity />} description="Biggest changes since the previous weekly check" flush footer={<MoreLink to={page('rankings')}>All rankings</MoreLink>}>
      <div className="grid grid-cols-3 gap-2 px-5 pb-3">
        {(
          [
            ['Top 3', r.top3, SEQ[5]],
            ['Top 10', r.top10, SEQ[3]],
            ['Top 50', r.top50, SEQ[1]],
          ] as const
        ).map(([label, value, color]) => (
          <div key={label} className="rounded-lg bg-surface-2 px-3 py-2">
            <MiniStat
              label={
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[3px]" style={{ background: color }} aria-hidden />
                  {label}
                </span>
              }
              value={value}
            />
          </div>
        ))}
      </div>
      {r.movers.length ? (
        <ul className="divide-y divide-line border-t border-line">
          {r.movers.slice(0, 6).map((m) => (
            <li key={m.keyword} className="flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 ease-brand hover:bg-surface-2/50">
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
          className="border-t border-line py-8"
          icon={<Activity className="size-5" />}
          title={r.keywords ? 'No movement this week' : 'No keywords tracked yet'}
          description={r.keywords ? `${plural(r.keywords, 'keyword')} checked weekly; positions held steady.` : 'Plan a keyword ladder or add keywords to weekly tracking.'}
          action={!r.keywords && can('member') ? <ButtonLink to={page('pipeline/new')} size="sm">Rank for a keyword</ButtonLink> : undefined}
        />
      )}
    </Panel>
  );
}

/** One figure of the content pipeline: icon tile, value, label, the explanation behind an info tip. */
function ContentStat({ icon, tone, label, value, info, hint }: { icon: ReactNode; tone: 'blue' | 'good' | 'warning' | 'neutral'; label: string; value: ReactNode; info?: string; hint?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-line p-3 transition-colors duration-150 ease-brand hover:border-line-strong">
      <IconTile tone={tone} size="sm">
        {icon}
      </IconTile>
      <div className="min-w-0">
        <div className="font-display text-xl leading-none font-semibold tracking-[-0.01em] text-ink">{typeof value === 'number' ? <CountUp value={value} /> : value}</div>
        <div className="mt-1.5 flex items-center gap-0.5 text-xs font-medium text-ink-3">
          {label}
          {info && <InfoTip label={`About ${label.toLowerCase()}`}>{info}</InfoTip>}
        </div>
        {hint && <div className="mt-0.5 text-xs leading-snug text-ink-3">{hint}</div>}
      </div>
    </div>
  );
}

function ContentCard({ d, className }: { d: OverviewData; className?: string }) {
  const { page } = useSitePage();
  const c = d.content;
  return (
    <Panel className={className} title="Content pipeline" icon={<PenSquare />} footer={<MoreLink to={page('content')}>Content</MoreLink>}>
      {c.started > 0 && <ProgressBar className="mb-4" label="Published" value={c.published} max={c.started} valueLabel={`${c.published} of ${plural(c.started, 'page')} started`} tone={c.published >= c.started ? 'good' : 'accent'} />}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <ContentStat icon={<PenSquare />} tone="blue" label="Pages started" value={c.started} info="written by the engine" />
        <ContentStat icon={<CheckCircle2 />} tone={c.published > 0 ? 'good' : 'neutral'} label="Published" value={c.published} info="live and checked" />
        <ContentStat icon={<Clock />} tone={c.pendingPublish > 0 ? 'warning' : 'neutral'} label="Waiting to publish" value={c.pendingPublish} info={c.pendingPublish ? 'written, not live yet' : 'nothing waiting'} />
        <ContentStat icon={<CalendarDays />} tone="blue" label="Blog posts per week" value={c.pagesPerWeek || 'Off'} hint={`${plural(c.caseStudies, 'case study', 'case studies')} on file`} />
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
    <Panel
      title="Alerts & check-ins"
      icon={<BellRing />}
      info="Search Console notification mails (manual actions, security issues, indexing) are read and raised here automatically."
      footer={<MoreLink to={page('alerts')}>Alerts & check-ins</MoreLink>}
    >
      <div className={cn('flex items-center gap-4 rounded-lg p-4', a.open > 0 ? 'bg-warning-soft' : 'bg-good-soft')}>
        <span className="font-display text-4xl leading-none font-semibold tracking-[-0.01em] text-ink">
          <CountUp value={a.open} />
        </span>
        <div className="min-w-0">
          {a.open > 0 ? <StatusBadge tone="warning">Open Search Console {a.open === 1 ? 'alert' : 'alerts'}</StatusBadge> : <StatusBadge tone="good">No open alerts</StatusBadge>}
        </div>
      </div>
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
        <p className="mt-4 flex items-center gap-2.5 text-[13px] text-good-text">
          <IconTile tone="good" size="xs">
            <CheckCircle2 />
          </IconTile>
          This month’s check-in is recorded
        </p>
      )}
    </Panel>
  );
}
