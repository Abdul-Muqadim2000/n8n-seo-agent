import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ClipboardCheck, Rocket, ScanSearch, Search, TrendingUp, Users } from 'lucide-react';
import { formatPosition, pctChange, type ReportDetail } from '@seo/shared';
import { useOrgCtx } from '@/lib/context';
import { paths } from '@/lib/paths';
import { fmtDate } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Delta, ExternalLink, StatTile } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { Segmented, Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { ChartCard, ShareBars, Sparkline, TimeSeriesChart } from '@/components/charts';
import { ActionList, BriefCard } from './actions';
import { AlertList, Block, Empty, has, n, num, obj, objs, pct, pctRatio, SectionTitle, shortUrl, str, strs, type P } from './kit';

type Metric = 'clicks' | 'impressions' | 'position';

export function SiteTrackerReport({ report }: { report: ReportDetail }) {
  const { org, can } = useOrgCtx();
  const p = report.payload;
  const gsc = obj(p.gsc);
  const ga4 = obj(p.ga4);
  const totals = obj(gsc.totals);
  const cur = obj(totals.cur);
  const prev = obj(totals.prev);
  const deltas = obj(gsc.deltas);
  const period = obj(obj(p.period).current);
  const organic = obj(ga4.organic);
  const oCur = obj(organic.cur);
  const oPrev = obj(organic.prev);
  const daily = useMemo(() => objs(gsc.daily).map((d) => ({ date: str(d.date), clicks: num(d.clicks), impressions: num(d.impressions), position: num(d.position) })), [gsc.daily]);
  const gaDaily = useMemo(() => objs(ga4.daily).map((d) => ({ date: str(d.date), sessions: num(d.sessions), engaged: num(d.engaged), keyEvents: num(d.key_events) })), [ga4.daily]);
  const last28 = daily.slice(-28);
  const [metric, setMetric] = useState<Metric>('clicks');
  const brief = obj(p.brief);
  const console_ = obj(p.console);
  const pending = objs(p.pending_publish);
  const positionGain = num(cur.position) != null && num(prev.position) != null && num(prev.position)! > 0 ? num(prev.position)! - num(cur.position)! : null;

  return (
    <div className="space-y-5">
      {has(brief) && <BriefCard brief={brief} />}
      <AlertList alerts={objs(p.alerts)} />

      {gsc.connected === false && (
        <Callout tone="warning" title="Search Console is not connected">
          {str(gsc.error) || 'Add the service account as a Full user of the Search Console property (Settings → Users and permissions).'}{' '}
          {report.siteId && (
            <ButtonLink variant="link" to={paths.site(org.id, report.siteId, 'settings/tracking')}>
              Tracking settings
            </ButtonLink>
          )}
        </Callout>
      )}
      {ga4.connected === false && (
        <Callout tone="info" title="Google Analytics 4 is not connected">
          {strs(ga4.errors).join(' ') || 'Give the service account Viewer access to the GA4 property to see organic sessions and key events.'}
        </Callout>
      )}

      {gsc.connected !== false && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Clicks"
            value={n(cur.clicks)}
            delta={<Delta value={num(deltas.clicks_pct)} digits={0} label="vs previous 28 days" />}
            trend={<Sparkline data={last28} dataKey="clicks" />}
          />
          <StatTile label="Impressions" value={n(cur.impressions)} delta={<Delta value={num(deltas.impressions_pct)} digits={0} label="vs previous 28 days" />} trend={<Sparkline data={last28} dataKey="impressions" />} />
          <StatTile label="Click-through rate" value={pctRatio(cur.ctr, 2)} delta={<Delta value={num(deltas.ctr_pts)} suffix=" pts" digits={2} label="vs previous" />} />
          <StatTile
            label="Average position"
            value={num(cur.position)?.toFixed(1) ?? '–'}
            delta={<Delta value={positionGain} suffix="" digits={1} label={positionGain != null && positionGain >= 0 ? 'places up' : 'places'} />}
            trend={<Sparkline data={last28} dataKey="position" invert />}
          />
        </div>
      )}
      {ga4.connected !== false && has(oCur) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Organic sessions (GA4)" value={n(oCur.sessions)} delta={<Delta value={pctChange(num(oCur.sessions), num(oPrev.sessions))} digits={0} label="vs previous" />} trend={<Sparkline data={gaDaily.slice(-28)} dataKey="sessions" />} />
          <StatTile label="Engaged organic sessions" value={n(oCur.engaged)} delta={<Delta value={pctChange(num(oCur.engaged), num(oPrev.engaged))} digits={0} label="vs previous" />} />
          <StatTile label="Key events from search" value={n(oCur.key_events)} delta={<Delta value={pctChange(num(oCur.key_events), num(oPrev.key_events))} digits={0} label="vs previous" />} />
          <StatTile label="Organic share of sessions" value={pct(ga4.organic_share, 0)} hint={`${n(obj(obj(ga4.total).cur).sessions)} sessions in total`} />
        </div>
      )}

      {daily.length > 1 && (
        <ChartCard
          title="Google Search, day by day"
          description={str(period.start) ? `${fmtDate(str(period.start))} – ${fmtDate(str(period.end))}, with the 28 days before` : 'Last 8 weeks'}
          actions={
            <Segmented
              size="sm"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'clicks', label: 'Clicks' },
                { value: 'impressions', label: 'Impressions' },
                { value: 'position', label: 'Position' },
              ]}
            />
          }
          table={{
            columns: [
              { key: 'date', label: 'Date', format: (v) => fmtDate(String(v)) },
              { key: 'clicks', label: 'Clicks', align: 'right', format: (v) => n(v) },
              { key: 'impressions', label: 'Impressions', align: 'right', format: (v) => n(v) },
              { key: 'position', label: 'Position', align: 'right', format: (v) => (num(v) == null ? '–' : num(v)!.toFixed(1)) },
            ],
            rows: daily,
          }}
        >
          <TimeSeriesChart
            data={daily}
            xKey="date"
            series={[{ key: metric, label: metric === 'clicks' ? 'Clicks' : metric === 'impressions' ? 'Impressions' : 'Average position', format: metric === 'position' ? (v) => v.toFixed(1) : undefined }]}
            invertY={metric === 'position'}
            area={metric !== 'position'}
            yFormat={metric === 'position' ? (v) => v.toFixed(0) : undefined}
            height={240}
          />
        </ChartCard>
      )}

      {gsc.connected !== false && <QueryTabs gsc={gsc} />}

      <ActionList actions={objs(p.actions)} siteId={report.siteId} />

      {objs(p.detected_published).length > 0 && <FoundLive rows={objs(p.detected_published)} siteId={report.siteId} />}

      {pending.length > 0 && (
        <Block title="Written, waiting to be published" icon={<Rocket className="size-4" />}>
          <ul className="divide-y divide-line">
            {pending.map((x, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm text-ink">{str(x.keyword)}</p>
                  <p className="text-xs text-ink-3">written {num(x.days) ?? 0} days ago</p>
                </div>
                {can('member') && (
                  <ButtonLink to={paths.tool(org.id, 'published', { siteId: report.siteId, prefill: { keyword: str(x.keyword) } })} size="sm" variant="secondary">
                    I published it
                  </ButtonLink>
                )}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {objs(p.tracked).length > 0 && <TrackedKeywords rows={objs(p.tracked)} />}
      {objs(p.ladder_pages).length > 0 && <LadderPages rows={objs(p.ladder_pages)} />}

      {ga4.connected !== false && (objs(ga4.channels).length > 0 || objs(ga4.landing).length > 0) && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {objs(ga4.channels).length > 0 && (
            <Block title="Where visitors come from" description="Sessions by channel (GA4)" icon={<Users className="size-4" />}>
              <ShareBars items={objs(ga4.channels).map((c) => ({ label: str(c.channel), value: num(c.sessions) ?? 0 }))} valueFormat={(v) => n(v)} highlight="Organic Search" />
            </Block>
          )}
          {objs(ga4.landing).length > 0 && <LandingPages rows={objs(ga4.landing)} />}
        </div>
      )}

      {gaDaily.length > 1 && (
        <ChartCard
          title="Organic sessions per day"
          description="Google Analytics 4"
          table={{ columns: [{ key: 'date', label: 'Date', format: (v) => fmtDate(String(v)) }, { key: 'sessions', label: 'Sessions', align: 'right' }, { key: 'engaged', label: 'Engaged', align: 'right' }], rows: gaDaily }}
        >
          <TimeSeriesChart data={gaDaily} xKey="date" series={[{ key: 'sessions', label: 'Sessions' }]} area height={200} />
        </ChartCard>
      )}

      {objs(p.trends).length > 0 && <Trends rows={objs(p.trends)} />}

      {has(console_) && (
        <Block title="Search Console check-in" icon={<ClipboardCheck className="size-4" />}>
          {console_.checkin_due === true ? (
            <Callout
              tone="warning"
              title="This month's check-in is due"
              action={
                can('member') && (
                  <ButtonLink to={paths.tool(org.id, 'checkin', { siteId: report.siteId })} size="sm" variant="secondary">
                    Do the check-in
                  </ButtonLink>
                )
              }
            >
              Two questions and the Pages export: manual actions and security issues are not visible through the API.
            </Callout>
          ) : (
            <CheckinSummary c={obj(console_.last_checkin)} />
          )}
          {objs(console_.notices).length > 0 && (
            <div className="mt-4">
              <SectionTitle>Notices from Search Console e-mails</SectionTitle>
              <ul className="space-y-1.5 text-sm">
                {objs(console_.notices).map((x, i) => (
                  <li key={i} className="text-ink-2">
                    {str(x.subject) || str(x.text) || str(x.kind)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Block>
      )}
    </div>
  );
}

/** Written pages this week's check found live on the website by itself (Phase 4): they count as published and are tracked from now on. */
function FoundLive({ rows, siteId }: { rows: P[]; siteId: string | null }) {
  const { org } = useOrgCtx();
  const list = rows.filter((r) => str(r.keyword) && /^https?:\/\//i.test(str(r.url)));
  if (!list.length) return null;
  return (
    <Block
      title={list.length === 1 ? 'We found your page live' : `We found ${list.length} of your pages live`}
      description="Nobody had to report them: they count as published and their positions are checked every Monday from now on."
      icon={<ScanSearch className="size-4" />}
    >
      <ul className="divide-y divide-line">
        {list.map((r, i) => (
          <li key={`${str(r.url)}-${i}`} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <StatusBadge tone="good">Live</StatusBadge>
                <span className="min-w-0 break-words">“{str(r.keyword)}”</span>
              </p>
              <p className="mt-1 text-xs">
                <ExternalLink href={str(r.url)}>{shortUrl(str(r.url))}</ExternalLink>
              </p>
            </div>
            <p className="text-xs text-ink-3">
              {str(r.matched_by) === 'slug' ? 'found by its planned address' : str(r.matched_by) === 'title' ? 'found by its title' : 'found automatically'}
              {siteId && str(r.ladder_id) && (
                <>
                  {' · '}
                  <Link to={paths.ladder(org.id, siteId, str(r.ladder_id))} className="text-accent-text hover:underline">
                    its keyword ladder
                  </Link>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </Block>
  );
}

function CheckinSummary({ c }: { c: P }) {
  if (!has(c)) return <Empty>No check-in recorded yet.</Empty>;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-ink-2">Last check-in {str(c.month)}:</span>
      <StatusBadge tone={c.manual_action === true ? 'critical' : 'good'}>{c.manual_action === true ? 'Manual action' : 'No manual action'}</StatusBadge>
      <StatusBadge tone={c.security_issue === true ? 'critical' : 'good'}>{c.security_issue === true ? 'Security issue' : 'No security issue'}</StatusBadge>
      {num(c.not_indexed_total) != null && <Badge>{num(c.not_indexed_total)} not indexed</Badge>}
    </div>
  );
}

function QueryTabs({ gsc }: { gsc: P }) {
  const groups = [
    { key: 'winners', label: 'Winners', rows: objs(gsc.winners) },
    { key: 'losers', label: 'Losers', rows: objs(gsc.losers) },
    { key: 'new_queries', label: 'New', rows: objs(gsc.new_queries) },
    { key: 'lost_queries', label: 'Lost', rows: objs(gsc.lost_queries) },
    { key: 'striking', label: 'Striking distance', rows: objs(gsc.striking) },
    { key: 'ctr_gaps', label: 'Low CTR', rows: objs(gsc.ctr_gaps) },
  ];
  const pages = objs(gsc.top_pages);
  const first = groups.find((g) => g.rows.length)?.key ?? (pages.length ? 'pages' : 'winners');
  const cols: Column<P>[] = [
    {
      key: 'query',
      header: 'Query',
      sortValue: (r) => str(r.query),
      cell: (r) => (
        <div className="min-w-[160px]">
          <p className="text-ink">{str(r.query)}</p>
          {str(r.page) && <p className="truncate text-xs text-ink-3">{shortUrl(str(r.page))}</p>}
        </div>
      ),
    },
    {
      key: 'clicks',
      header: 'Clicks',
      align: 'right',
      sortValue: (r) => num(r.clicks),
      cell: (r) => (
        <span className="inline-flex flex-col items-end">
          {n(r.clicks)}
          {num(r.clicks_delta) ? <Delta value={num(r.clicks_delta)} suffix="" digits={0} /> : null}
        </span>
      ),
    },
    { key: 'impressions', header: 'Impressions', align: 'right', sortValue: (r) => num(r.impressions), cell: (r) => n(r.impressions) },
    { key: 'ctr', header: 'CTR', align: 'right', sortValue: (r) => num(r.ctr), cell: (r) => pctRatio(r.ctr), hideOnMobile: true },
    {
      key: 'position',
      header: 'Position',
      align: 'right',
      sortValue: (r) => num(r.position),
      cell: (r) => (
        <span className="inline-flex flex-col items-end">
          {num(r.position)?.toFixed(1) ?? '–'}
          {num(r.prev_position) ? <span className="text-xs text-ink-3">was {num(r.prev_position)!.toFixed(1)}</span> : null}
        </span>
      ),
    },
  ];
  const pageCols: Column<P>[] = [
    { key: 'page', header: 'Page', sortValue: (r) => str(r.page), cell: (r) => <ExternalLink href={str(r.page)} className="text-[13px]">{shortUrl(str(r.page))}</ExternalLink> },
    {
      key: 'clicks',
      header: 'Clicks',
      align: 'right',
      sortValue: (r) => num(r.clicks),
      cell: (r) => (
        <span className="inline-flex flex-col items-end">
          {n(r.clicks)}
          {num(r.clicks_delta) ? <Delta value={num(r.clicks_delta)} suffix="" digits={0} /> : null}
        </span>
      ),
    },
    { key: 'impressions', header: 'Impressions', align: 'right', sortValue: (r) => num(r.impressions), cell: (r) => n(r.impressions) },
    { key: 'ctr', header: 'CTR', align: 'right', sortValue: (r) => num(r.ctr), cell: (r) => pctRatio(r.ctr), hideOnMobile: true },
    { key: 'position', header: 'Position', align: 'right', sortValue: (r) => num(r.position), cell: (r) => num(r.position)?.toFixed(1) ?? '–' },
  ];
  return (
    <Block title="Search queries and pages" description={`${n(gsc.query_count)} queries with impressions this period`} icon={<Search className="size-4" />}>
      <Tabs defaultValue={first}>
        <TabList>
          {groups.map((g) => (
            <Tab key={g.key} value={g.key} count={g.rows.length}>
              {g.label}
            </Tab>
          ))}
          <Tab value="pages" count={pages.length}>
            Top pages
          </Tab>
        </TabList>
        {groups.map((g) => (
          <TabPanel key={g.key} value={g.key}>
            {g.rows.length ? (
              <DataTable rows={g.rows} columns={cols} rowKey={(r, i) => `${str(r.query)}-${i}`} pageSize={10} />
            ) : (
              <Empty>{g.key === 'striking' ? 'No queries between positions 4 and 20 with enough impressions this period.' : `No ${g.label.toLowerCase()} queries this period.`}</Empty>
            )}
          </TabPanel>
        ))}
        <TabPanel value="pages">
          {pages.length ? <DataTable rows={pages} columns={pageCols} rowKey={(r, i) => `${str(r.page)}-${i}`} initialSort={{ key: 'clicks', dir: 'desc' }} pageSize={10} /> : <Empty>No pages with clicks yet.</Empty>}
        </TabPanel>
      </Tabs>
    </Block>
  );
}

function TrackedKeywords({ rows }: { rows: P[] }) {
  const cols: Column<P>[] = [
    {
      key: 'keyword',
      header: 'Keyword',
      sortValue: (r) => str(r.keyword),
      cell: (r) => (
        <div>
          <p className="text-ink">{str(r.keyword)}</p>
          <p className="text-xs text-ink-3">{str(r.source) === 'ladder' ? `ladder${num(r.rung) ? ` · rung ${num(r.rung)}` : ''}` : 'tracked keyword'}</p>
        </div>
      ),
    },
    {
      key: 'serp_position',
      header: 'Google (live)',
      align: 'right',
      sortValue: (r) => {
        const v = num(r.serp_position);
        return v == null || v <= 0 ? 999 : v;
      },
      cell: (r) => formatPosition(num(r.serp_position)),
    },
    {
      key: 'gsc_position',
      header: 'Search Console',
      align: 'right',
      sortValue: (r) => num(r.gsc_position) || 999,
      cell: (r) => (num(r.gsc_position) ? num(r.gsc_position)!.toFixed(1) : '–'),
      hideOnMobile: true,
    },
    { key: 'clicks', header: 'Clicks', align: 'right', sortValue: (r) => num(r.clicks), cell: (r) => n(r.clicks) },
    { key: 'impressions', header: 'Impressions', align: 'right', sortValue: (r) => num(r.impressions), cell: (r) => n(r.impressions), hideOnMobile: true },
    {
      key: 'history',
      header: 'Last weeks',
      cell: (r) => {
        const h = (Array.isArray(r.history) ? r.history : []).map((v, i) => ({ i, v: typeof v === 'number' && v > 0 ? v : null }));
        return h.some((x) => x.v != null) ? (
          <div className="h-7 w-20">
            <Sparkline data={h} dataKey="v" invert />
          </div>
        ) : (
          <span className="text-xs text-ink-3">not ranking</span>
        );
      },
      hideOnMobile: true,
    },
  ];
  return (
    <Block title="Tracked keywords" description="Live Google position (top 50) and Search Console average" icon={<TrendingUp className="size-4" />}>
      <DataTable rows={rows} columns={cols} rowKey={(r, i) => `${str(r.keyword)}-${i}`} pageSize={15} />
    </Block>
  );
}

function LadderPages({ rows }: { rows: P[] }) {
  const cols: Column<P>[] = [
    {
      key: 'keyword',
      header: 'Page',
      sortValue: (r) => str(r.keyword),
      cell: (r) => (
        <div className="min-w-[180px]">
          <p className="text-ink">{str(r.keyword)}</p>
          <p className="truncate text-xs text-ink-3">{shortUrl(str(r.url))}</p>
        </div>
      ),
    },
    { key: 'rung', header: 'Rung', align: 'right', sortValue: (r) => num(r.rung), cell: (r) => num(r.rung) ?? '–' },
    { key: 'status', header: 'Status', sortValue: (r) => str(r.status), cell: (r) => <Badge tone={str(r.status) === 'published' ? 'good' : str(r.status) === 'writing' ? 'accent' : 'neutral'}>{str(r.status) || 'planned'}</Badge> },
    {
      key: 'indexed',
      header: 'Google index',
      cell: (r) =>
        r.indexed === true ? (
          <StatusBadge tone="good">Indexed</StatusBadge>
        ) : r.indexed === false ? (
          <StatusBadge tone="warning">{str(r.coverage) || 'Not indexed'}</StatusBadge>
        ) : (
          <span className="text-xs text-ink-3">{str(r.inspect_error) || 'not checked'}</span>
        ),
    },
  ];
  return (
    <Block title="Ladder pages" description="Publication and index status of every page in your keyword ladders">
      <DataTable rows={rows} columns={cols} rowKey={(r, i) => `${str(r.url)}-${i}`} pageSize={12} dense />
    </Block>
  );
}

function LandingPages({ rows }: { rows: P[] }) {
  const cols: Column<P>[] = [
    { key: 'page', header: 'Landing page', sortValue: (r) => str(r.page), cell: (r) => <span className="text-[13px] text-ink">{str(r.page)}</span> },
    {
      key: 'sessions',
      header: 'Sessions',
      align: 'right',
      sortValue: (r) => num(r.sessions),
      cell: (r) => (
        <span className="inline-flex flex-col items-end">
          {n(r.sessions)}
          {num(r.delta) ? <Delta value={num(r.delta)} suffix="" digits={0} /> : null}
        </span>
      ),
    },
    { key: 'engaged', header: 'Engaged', align: 'right', sortValue: (r) => num(r.engaged), cell: (r) => n(r.engaged), hideOnMobile: true },
    { key: 'key_events', header: 'Key events', align: 'right', sortValue: (r) => num(r.key_events), cell: (r) => n(r.key_events) },
  ];
  return (
    <Block title="Organic landing pages" description="Where search visitors arrive (GA4)">
      <DataTable rows={rows} columns={cols} rowKey={(r, i) => `${str(r.page)}-${i}`} initialSort={{ key: 'sessions', dir: 'desc' }} pageSize={8} dense />
    </Block>
  );
}

function Trends({ rows }: { rows: P[] }) {
  return (
    <Block title="Google Trends" description="Search interest for your main keywords (0-100, relative)">
      <ul className="divide-y divide-line">
        {rows.map((t, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-ink">{str(t.keyword)}</p>
              <p className="text-xs text-ink-3">
                {str(t.error)
                  ? `not available: ${str(t.error)}`
                  : `latest ${num(t.latest) ?? '–'} · average ${num(t.average) ?? '–'}${str(t.peak_date) ? ` · peak ${fmtDate(str(t.peak_date))}` : ''}`}
                {strs(objs(t.rising).map((x) => str(x.query))).length > 0 && ` · rising: ${objs(t.rising).map((x) => str(x.query)).join(', ')}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {str(t.direction) && <Badge tone={str(t.direction) === 'rising' ? 'good' : str(t.direction) === 'falling' ? 'warning' : 'neutral'}>{str(t.direction)}</Badge>}
              {num(t.change_pct) != null && <Delta value={num(t.change_pct)} digits={0} />}
            </div>
          </li>
        ))}
      </ul>
      {rows.some((t) => str(t.direction) === 'sparse') && <p className="mt-2 text-xs text-ink-3">“sparse” means Google has too little data for a reliable trend; treat the change as a hint.</p>}
    </Block>
  );
}
