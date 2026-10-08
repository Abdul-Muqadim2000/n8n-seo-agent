import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BarChart3, CalendarRange, FileText, Minus, MousePointerClick, Search, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { compactNumber, titleCase, type MetricsPoint, type SearchData, type TrendPoint } from '@seo/shared';
import { useSiteData } from '@/lib/queries';
import { paths } from '@/lib/paths';
import { fmtAgo, fmtDate } from '@/lib/utils';
import { ChartCard, ShareBars, Sparkline, TimeSeriesChart, type Series } from '@/components/charts';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { Delta, PageHeader, StatTile } from '@/components/ui/misc';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { DataTable, type Column } from '@/components/ui/table';
import { EngineActionList } from './_components/actions';
import { DataGate, KpiGrid, MetricSwitch, Panel, RunAnalysisMenu, SectionHeading, ToolButton, useSitePage } from './_components/kit';
import { diff, fmtRange, pct, pctChange, ratioPct, sortByDate, urlPath } from './_components/format';
import { plotAvgPos } from './_components/positions';
import { QueryChangeTable, QueryExplorer } from './_components/QueryExplorer';

export default function SearchPage() {
  const { org, site } = useSitePage();
  const q = useSiteData(org.id, site.id, 'search');
  return (
    <div>
      <PageHeader title="Search & traffic" description={`Google Search Console and Analytics for ${site.domain}: clicks, queries, landing pages and demand trends.`} actions={<RunAnalysisMenu />} />
      <DataGate q={q}>{(d) => <SearchBody d={d} refetching={q.isFetching} />}</DataGate>
    </div>
  );
}

interface Totals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}
interface Ga {
  sessions: number;
  engaged: number;
  keyEvents: number;
}

function SearchBody({ d, refetching }: { d: SearchData; refetching: boolean }) {
  const { org, can, page } = useSitePage();
  const S = d.snapshot;
  const metrics = useMemo(() => sortByDate(d.metrics, (m) => m.periodEnd), [d.metrics]);
  const M: MetricsPoint | null = metrics.length ? metrics[metrics.length - 1] : null;

  if (!S && !M && !d.queries.length && !d.trends.length) {
    return (
      <EmptyState
        icon={<Search className="size-5" />}
        title="No search data yet"
        description="Weekly tracking reads Search Console, Google Analytics, Google Trends and live rankings every Monday. The first report arrives a few minutes after you start it."
        action={
          can('admin') ? (
            <ButtonLink to={page('settings/tracking')}>Start weekly tracking</ButtonLink>
          ) : (
            <ToolButton mode="track" variant="primary">
              Start weekly tracking
            </ToolButton>
          )
        }
      />
    );
  }

  const cur: Totals | null = S?.gsc.current ?? (M ? { clicks: M.clicks, impressions: M.impressions, ctr: M.ctr, position: M.position } : null);
  const prev: Totals | null = S?.gsc.previous ?? (M ? { clicks: M.prevClicks, impressions: M.prevImpressions, ctr: M.prevCtr, position: M.prevPosition } : null);
  const gscOn = S?.gsc.connected ?? M?.gscConnected ?? d.connection.gscProperty != null;
  const gaOn = S?.ga4.connected ?? M?.ga4Connected ?? false;
  const org1: Ga | null = S?.ga4.organic ?? (M ? { sessions: M.sessions, engaged: M.engagedSessions, keyEvents: M.keyEvents } : null);
  const org0: Ga | null = S?.ga4.organicPrev ?? (M ? { sessions: M.prevSessions, engaged: M.prevEngagedSessions, keyEvents: M.prevKeyEvents } : null);
  const share = S?.ga4.organicShare ?? M?.organicShare ?? null;
  const gDaily = (S?.gsc.daily ?? []).map((r) => ({ ...r, position: plotAvgPos(r.position) }));
  const aDaily = S?.ga4.daily ?? [];
  const period = S?.period ?? (M ? { current: { start: M.periodStart, end: M.periodEnd }, previous: null } : null);
  const posDelta = cur && prev && cur.position > 0 && prev.position > 0 ? prev.position - cur.position : null;
  const alerts = M?.alerts ?? [];

  return (
    <div className="space-y-6">
      {/* context bar: period, connections, latest report */}
      <Card className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <CalendarRange className="size-4 text-ink-3" aria-hidden />
            {period ? `Last 28 days: ${fmtRange(period.current.start, period.current.end)}` : 'No period yet'}
          </span>
          {period?.previous && <span className="text-[13px] text-ink-3">compared with {fmtRange(period.previous.start, period.previous.end)}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {gscOn ? (
            <StatusBadge tone="good">Search Console{S?.gsc.property || d.connection.gscProperty ? ` · ${S?.gsc.property ?? d.connection.gscProperty}` : ''}</StatusBadge>
          ) : (
            <Link to={page('settings/verification')} title={S?.gsc.error ?? undefined}>
              <StatusBadge tone="warning">Search Console not connected — connect</StatusBadge>
            </Link>
          )}
          {gaOn ? (
            <StatusBadge tone="good">Analytics{S?.ga4.propertyId || d.connection.ga4PropertyId ? ` · ${S?.ga4.propertyId ?? d.connection.ga4PropertyId}` : ''}</StatusBadge>
          ) : (
            <Link to={page('settings/tracking')}>
              <StatusBadge tone="warning">Analytics not connected — choose a property</StatusBadge>
            </Link>
          )}
          {S && (
            <ButtonLink to={paths.report(org.id, S.reportId)} variant="ghost" size="sm" icon={<FileText className="size-4" />}>
              Weekly report · {fmtAgo(S.receivedAt)}
            </ButtonLink>
          )}
        </div>
      </Card>

      {!gscOn && S?.gsc.error && (
        <Callout tone="warning" title="Search Console is not connected yet" action={can('admin') ? <ButtonLink to={page('settings/verification')} size="sm" variant="secondary">Connect it</ButtonLink> : undefined}>
          Add the service account as a user of the Search Console property. Reported error: {S.gsc.error}
        </Callout>
      )}

      {(S?.brief?.headline || S?.brief?.summary) && (
        <Callout title={S.brief?.headline} tone="info">
          {S.brief?.summary}
        </Callout>
      )}
      {alerts.length > 0 && (
        <Callout tone="warning" title="This week’s alerts">
          <ul className="list-disc space-y-0.5 pl-4">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Callout>
      )}

      <section>
        <SectionHeading title="Google Search Console" description="Clicks and impressions from Google Search, last 28 days against the 28 days before" />
        <KpiGrid>
          <StatTile
            label="Clicks"
            icon={<MousePointerClick className="size-4" />}
            value={cur ? compactNumber(cur.clicks) : '–'}
            delta={<Delta value={S?.gsc.deltas.clicksPct ?? pctChange(cur?.clicks, prev?.clicks)} />}
            trend={<Sparkline data={gDaily} dataKey="clicks" />}
            hint={prev ? `Previously ${compactNumber(prev.clicks)}` : undefined}
          />
          <StatTile
            label="Impressions"
            value={cur ? compactNumber(cur.impressions) : '–'}
            delta={<Delta value={S?.gsc.deltas.impressionsPct ?? pctChange(cur?.impressions, prev?.impressions)} />}
            trend={<Sparkline data={gDaily} dataKey="impressions" />}
            hint={prev ? `Previously ${compactNumber(prev.impressions)}` : undefined}
          />
          <StatTile
            label="Click-through rate"
            value={cur ? ratioPct(cur.ctr, 2) : '–'}
            delta={<Delta value={S?.gsc.deltas.ctrPts ?? (cur && prev ? (cur.ctr - prev.ctr) * 100 : null)} suffix=" pts" digits={2} label={prev ? `from ${ratioPct(prev.ctr, 2)}` : undefined} />}
            hint="Share of impressions that became a click"
          />
          <StatTile
            label="Average position"
            value={cur && cur.position > 0 ? cur.position.toFixed(1) : '–'}
            delta={<Delta value={posDelta} suffix="" />}
            trend={<Sparkline data={gDaily} dataKey="position" invert />}
            hint={prev && prev.position > 0 ? `Previously ${prev.position.toFixed(1)} · a rise means you moved up` : 'A rise means you moved up'}
          />
        </KpiGrid>
      </section>

      <section>
        <SectionHeading title="Google Analytics 4 — organic search" description="Visits that came from organic search, same 28 days" />
        {gaOn && org1 ? (
          <KpiGrid>
            <StatTile label="Organic sessions" value={compactNumber(org1.sessions)} delta={<Delta value={pctChange(org1.sessions, org0?.sessions)} />} trend={<Sparkline data={aDaily} dataKey="sessions" />} hint={org0 ? `Previously ${compactNumber(org0.sessions)}` : undefined} />
            <StatTile
              label="Engaged sessions"
              value={compactNumber(org1.engaged)}
              delta={<Delta value={pctChange(org1.engaged, org0?.engaged)} />}
              trend={<Sparkline data={aDaily} dataKey="engaged" />}
              hint={`${org1.sessions ? `${pct((org1.engaged / org1.sessions) * 100, 0)} engagement rate` : 'No sessions'}${org0 ? ` · previously ${compactNumber(org0.engaged)}` : ''}`}
            />
            <StatTile label="Key events" value={compactNumber(org1.keyEvents)} delta={<Delta value={pctChange(org1.keyEvents, org0?.keyEvents)} />} trend={<Sparkline data={aDaily} dataKey="keyEvents" />} hint={`Conversions from organic visits${org0 ? ` · previously ${compactNumber(org0.keyEvents)}` : ''}`} />
            <StatTile
              label="Organic share"
              value={share != null ? pct(share, 0) : '–'}
              hint={S?.ga4.total ? `of ${compactNumber(S.ga4.total.sessions)} sessions from all channels${S.ga4.totalPrev ? ` (previously ${compactNumber(S.ga4.totalPrev.sessions)})` : ''}` : 'of all sessions'}
            />
          </KpiGrid>
        ) : (
          <Card>
            <EmptyState
              className="py-8"
              icon={<BarChart3 className="size-5" />}
              title="Google Analytics is not connected"
              description="Give the service account Viewer access to your GA4 property, then choose the property in tracking settings. Sessions, key events and landing pages appear from the next weekly report."
              action={can('admin') ? <ButtonLink to={page('settings/tracking')} variant="secondary">Choose a GA4 property</ButtonLink> : undefined}
            />
          </Card>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GscDailyChart rows={gDaily} range={period?.previous ? fmtRange(period.previous.start, period.current.end) : null} loading={refetching} />
        <GaDailyChart rows={aDaily} connected={gaOn} loading={refetching} />
      </div>

      {S && gaOn && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5 xl:items-start">
          <Panel title="Traffic by channel" description="Sessions per channel, last 28 days" className="xl:col-span-2">
            {S.ga4.channels.length ? (
              <ShareBars
                highlight="Organic Search"
                valueFormat={(v) => `${v.toFixed(0)}%`}
                items={(() => {
                  const total = S.ga4.channels.reduce((a, c) => a + c.sessions, 0) || 1;
                  return [...S.ga4.channels].sort((a, b) => b.sessions - a.sessions).map((c) => ({ label: c.channel, value: (c.sessions / total) * 100, sub: `${compactNumber(c.sessions)}` }));
                })()}
              />
            ) : (
              <p className="py-6 text-center text-sm text-ink-3">No channel data in this report.</p>
            )}
            <p className="mt-3 text-xs text-ink-3">Share of all sessions; the number after each bar is sessions. Organic search is highlighted.</p>
          </Panel>
          <Panel title="Organic landing pages" description="Where organic visitors land, with the change against the previous 28 days" className="xl:col-span-3" flush>
            <LandingTable rows={S.ga4.landing} />
          </Panel>
        </div>
      )}

      <section>
        <SectionHeading title="Queries" description="Every query Search Console reported in a weekly report, with its live Google position for tracked keywords" />
        <Card className="p-4">
          {d.queries.length ? <QueryExplorer queries={d.queries} periods={d.periods} /> : <EmptyState className="py-8" title="No query data yet" description="Queries arrive with the first weekly report once Search Console is connected." />}
        </Card>
      </section>

      {S && (
        <section>
          <SectionHeading title="What changed this week" description="Queries that gained or lost the most clicks, and queries that appeared or disappeared" />
          <Card className="px-4 pb-4">
            <Tabs defaultValue="winners">
              <TabList>
                <Tab value="winners" count={S.gsc.winners.length}>
                  Winners
                </Tab>
                <Tab value="losers" count={S.gsc.losers.length}>
                  Losers
                </Tab>
                <Tab value="new" count={S.gsc.newQueries.length}>
                  New
                </Tab>
                <Tab value="lost" count={S.gsc.lostQueries.length}>
                  Lost
                </Tab>
              </TabList>
              <TabPanel value="winners">
                <QueryChangeTable rows={S.gsc.winners} empty="No query gained clicks this period." />
              </TabPanel>
              <TabPanel value="losers">
                <QueryChangeTable rows={S.gsc.losers} empty="No query lost clicks this period." />
              </TabPanel>
              <TabPanel value="new">
                <QueryChangeTable rows={S.gsc.newQueries} empty="No new queries this period." />
              </TabPanel>
              <TabPanel value="lost">
                <QueryChangeTable rows={S.gsc.lostQueries} empty="No query disappeared this period." />
              </TabPanel>
            </Tabs>
          </Card>
        </section>
      )}

      {S && S.actions.length > 0 && (
        <Panel title="What the engine recommends" description={`From the weekly report of ${fmtDate(S.receivedAt)}`} flush icon={<Sparkles className="size-4" />}>
          <EngineActionList actions={S.actions} />
        </Panel>
      )}

      <TrendsSection trends={d.trends} />

      {metrics.length > 0 && <WeeklyHistory metrics={metrics} loading={refetching} />}
    </div>
  );
}

type GMetric = 'clicks' | 'impressions' | 'position';
function GscDailyChart({ rows, range, loading }: { rows: { date: string; clicks: number; impressions: number; position: number | null }[]; range: string | null; loading: boolean }) {
  const [m, setM] = useState<GMetric>('clicks');
  const series: Record<GMetric, Series> = {
    clicks: { key: 'clicks', label: 'Clicks' },
    impressions: { key: 'impressions', label: 'Impressions' },
    position: { key: 'position', label: 'Average position', format: (v) => v.toFixed(1) },
  };
  return (
    <ChartCard
      title="Search Console, daily"
      description={range ? `${range} — the previous and the current 28 days` : 'Daily values from the latest weekly report'}
      loading={loading}
      actions={<MetricSwitch label="Metric" value={m} onChange={setM} options={[{ value: 'clicks', label: 'Clicks' }, { value: 'impressions', label: 'Impressions' }, { value: 'position', label: 'Position' }]} />}
      table={{
        columns: [
          { key: 'date', label: 'Day', format: (v) => fmtDate(String(v)) },
          { key: 'clicks', label: 'Clicks', align: 'right' },
          { key: 'impressions', label: 'Impressions', align: 'right' },
          { key: 'position', label: 'Avg. position', align: 'right', format: (v) => (v == null ? '–' : Number(v).toFixed(1)) },
        ],
        rows: [...rows].reverse(),
      }}
    >
      {rows.length ? (
        <TimeSeriesChart data={rows} xKey="date" series={[series[m]]} area={m !== 'position'} invertY={m === 'position'} height={240} yFormat={m === 'position' ? (v) => String(Math.round(v)) : undefined} />
      ) : (
        <EmptyState className="py-10" title="No daily data yet" description="Daily clicks and impressions arrive with the weekly report once Search Console is connected." />
      )}
    </ChartCard>
  );
}

type AMetric = 'sessions' | 'keyEvents';
function GaDailyChart({ rows, connected, loading }: { rows: { date: string; sessions: number; engaged: number; keyEvents: number }[]; connected: boolean; loading: boolean }) {
  const [m, setM] = useState<AMetric>('sessions');
  const series: Series[] = m === 'sessions' ? [{ key: 'sessions', label: 'Organic sessions' }, { key: 'engaged', label: 'Engaged sessions' }] : [{ key: 'keyEvents', label: 'Key events' }];
  return (
    <ChartCard
      title="Organic visits, daily"
      description="Google Analytics 4, organic search channel"
      series={series}
      loading={loading}
      actions={<MetricSwitch label="Metric" value={m} onChange={setM} options={[{ value: 'sessions', label: 'Sessions' }, { value: 'keyEvents', label: 'Key events' }]} />}
      table={{
        columns: [
          { key: 'date', label: 'Day', format: (v) => fmtDate(String(v)) },
          { key: 'sessions', label: 'Sessions', align: 'right' },
          { key: 'engaged', label: 'Engaged', align: 'right' },
          { key: 'keyEvents', label: 'Key events', align: 'right' },
        ],
        rows: [...rows].reverse(),
      }}
    >
      {rows.length ? (
        <TimeSeriesChart data={rows} xKey="date" series={series} area={series.length === 1} height={240} />
      ) : (
        <EmptyState className="py-10" title={connected ? 'No daily data in this report' : 'Analytics is not connected'} description="Daily organic sessions appear with the weekly report once a GA4 property is connected." />
      )}
    </ChartCard>
  );
}

type Landing = NonNullable<SearchData['snapshot']>['ga4']['landing'][number];
function LandingTable({ rows }: { rows: Landing[] }) {
  const { site } = useSitePage();
  const columns: Column<Landing>[] = [
    {
      key: 'page',
      header: 'Page',
      sortValue: (r) => r.page,
      cell: (r) => (
        <a href={r.page.startsWith('/') ? `https://${site.domain}${r.page}` : r.page} target="_blank" rel="noopener noreferrer" className="block max-w-[18rem] truncate text-[13px] text-accent-text hover:underline transition-colors duration-150 ease-brand" title={r.page}>
          {urlPath(r.page) || r.page}
        </a>
      ),
    },
    { key: 'sessions', header: 'Sessions', align: 'right', sortValue: (r) => r.sessions, cell: (r) => compactNumber(r.sessions) },
    { key: 'prevSessions', header: 'Before', align: 'right', hideOnMobile: true, sortValue: (r) => r.prevSessions, cell: (r) => <span className="text-ink-2">{compactNumber(r.prevSessions)}</span> },
    { key: 'delta', header: 'Change', align: 'right', sortValue: (r) => r.delta, cell: (r) => <Delta value={r.delta} suffix="" digits={0} /> },
    { key: 'engaged', header: 'Engagement', align: 'right', hideOnMobile: true, sortValue: (r) => (r.sessions ? r.engaged / r.sessions : 0), cell: (r) => (r.sessions ? pct((r.engaged / r.sessions) * 100, 0) : '–') },
    { key: 'keyEvents', header: 'Key events', align: 'right', sortValue: (r) => r.keyEvents, cell: (r) => compactNumber(r.keyEvents) },
  ];
  return (
    <div className="px-4 pb-4">
      <DataTable rows={rows} columns={columns} rowKey={(r, i) => `${r.page}|${i}`} initialSort={{ key: 'sessions', dir: 'desc' }} dense pageSize={8} empty="No organic landing pages in this report." />
    </div>
  );
}

function directionOf(dir: string): { label: string; icon: ReactNode; tone: 'accent' | 'neutral' } {
  const s = dir.toLowerCase();
  if (s.startsWith('ris') || s === 'up') return { label: 'Rising', icon: <TrendingUp className="size-3" aria-hidden />, tone: 'accent' };
  if (s.startsWith('fall') || s === 'down') return { label: 'Falling', icon: <TrendingDown className="size-3" aria-hidden />, tone: 'neutral' };
  if (s.startsWith('stab') || s === 'flat') return { label: 'Stable', icon: <Minus className="size-3" aria-hidden />, tone: 'neutral' };
  if (s === 'sparse') return { label: 'Too little data', icon: <Minus className="size-3" aria-hidden />, tone: 'neutral' };
  return { label: titleCase(dir || 'unknown'), icon: <Minus className="size-3" aria-hidden />, tone: 'neutral' };
}

function TrendsSection({ trends }: { trends: TrendPoint[] }) {
  const { can, tool } = useSitePage();
  const latest = useMemo(() => {
    const seen = new Map<string, TrendPoint>();
    for (const t of sortByDate(trends, (x) => x.checkedAt, 'desc')) if (!seen.has(t.keyword)) seen.set(t.keyword, t);
    return [...seen.values()];
  }, [trends]);
  return (
    <section>
      <SectionHeading title="Google Trends" description="Search interest for your tracked keywords: the last 4 weeks against the 12-month average (100 = peak interest)" />
      {latest.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {latest.map((t) => {
            const dir = directionOf(t.direction);
            return (
              <Card key={t.keyword} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 text-sm font-semibold text-ink">{t.keyword}</h3>
                  <Badge tone={dir.tone} icon={dir.icon}>
                    {dir.label}
                  </Badge>
                </div>
                <div className="mt-3 flex items-end gap-4">
                  <div>
                    <div className="text-xs text-ink-3">Change</div>
                    <div className="font-display text-xl font-semibold text-ink">{t.changePct != null && Number.isFinite(t.changePct) ? `${t.changePct > 0 ? '+' : ''}${Math.round(t.changePct)}%` : '–'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-3">Interest now / avg.</div>
                    <div className="font-display text-xl font-semibold text-ink">
                      {t.latest}
                      <span className="text-sm font-normal text-ink-3"> / {t.average}</span>
                    </div>
                  </div>
                </div>
                <p className="mt-1 text-xs text-ink-3">
                  {t.peakDate ? `Peak ${fmtDate(t.peakDate)} · ` : ''}checked {fmtAgo(t.checkedAt)}
                </p>
                {t.rising.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-xs font-medium text-ink-2">Rising related searches</div>
                    <div className="flex flex-wrap gap-1">
                      {t.rising.slice(0, 6).map((r) =>
                        can('member') ? (
                          <Link key={r} to={tool('verdict', { keyword: r })} className="inline-flex h-6 items-center gap-1 rounded-md bg-accent-soft px-2 text-xs text-accent-text hover:underline transition-colors duration-150 ease-brand" title="Check this keyword">
                            <TrendingUp className="size-3" aria-hidden />
                            {r}
                          </Link>
                        ) : (
                          <Badge key={r}>{r}</Badge>
                        ),
                      )}
                    </div>
                  </div>
                )}
                {t.top.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-xs font-medium text-ink-2">Top related searches</div>
                    <div className="flex flex-wrap gap-1">
                      {t.top.slice(0, 6).map((r) => (
                        <span key={r} className="inline-flex h-6 items-center rounded-md bg-surface-2 px-2 text-xs text-ink-2">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState className="py-8" title="No trend data yet" description="Google Trends is read for your tracked keywords with the weekly report (refreshed about every 25 days)." />
        </Card>
      )}
    </section>
  );
}

type WMetric = 'clicks' | 'impressions' | 'position' | 'sessions' | 'striking';
const W_OPTIONS: { value: WMetric; label: string; series: Series }[] = [
  { value: 'clicks', label: 'Clicks', series: { key: 'clicks', label: 'Clicks' } },
  { value: 'impressions', label: 'Impressions', series: { key: 'impressions', label: 'Impressions' } },
  { value: 'position', label: 'Position', series: { key: 'position', label: 'Average position', format: (v) => v.toFixed(1) } },
  { value: 'sessions', label: 'Sessions', series: { key: 'sessions', label: 'Organic sessions' } },
  { value: 'striking', label: 'Striking', series: { key: 'striking', label: 'Queries at positions 4–20' } },
];

function WeeklyHistory({ metrics, loading }: { metrics: MetricsPoint[]; loading: boolean }) {
  const [m, setM] = useState<WMetric>('clicks');
  const opt = W_OPTIONS.find((o) => o.value === m)!;
  const rows = metrics.map((x) => ({ periodEnd: x.periodEnd, clicks: x.clicks, impressions: x.impressions, ctr: x.ctr, position: plotAvgPos(x.position), sessions: x.sessions, striking: x.striking, queries: x.queries }));
  const last = metrics[metrics.length - 1];
  const first = metrics[0];
  return (
    <ChartCard
      title="Weekly history"
      description={`${metrics.length} weekly ${metrics.length === 1 ? 'report' : 'reports'}, each a rolling 28-day total${metrics.length > 1 ? ` · clicks ${diff(last.clicks, first.clicks)! >= 0 ? 'up' : 'down'} ${compactNumber(Math.abs(diff(last.clicks, first.clicks) ?? 0))} since ${fmtDate(first.periodEnd)}` : ''}`}
      loading={loading}
      actions={<MetricSwitch label="Metric" value={m} onChange={setM} options={W_OPTIONS.map(({ value, label }) => ({ value, label }))} />}
      table={{
        columns: [
          { key: 'periodEnd', label: '28 days to', format: (v) => fmtDate(String(v)) },
          { key: 'clicks', label: 'Clicks', align: 'right' },
          { key: 'impressions', label: 'Impr.', align: 'right', format: (v) => compactNumber(Number(v)) },
          { key: 'ctr', label: 'CTR', align: 'right', format: (v) => ratioPct(Number(v)) },
          { key: 'position', label: 'Pos.', align: 'right', format: (v) => (v == null ? '–' : Number(v).toFixed(1)) },
          { key: 'sessions', label: 'Sessions', align: 'right' },
          { key: 'queries', label: 'Queries', align: 'right' },
          { key: 'striking', label: 'Striking', align: 'right' },
        ],
        rows: [...rows].reverse(),
      }}
    >
      <TimeSeriesChart data={rows} xKey="periodEnd" series={[opt.series]} area={m !== 'position'} invertY={m === 'position'} height={240} yFormat={m === 'position' ? (v) => String(Math.round(v)) : undefined} />
    </ChartCard>
  );
}
