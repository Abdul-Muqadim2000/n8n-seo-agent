// Search Console queries of one period with filters, and a per-query trend across periods in a dialog.
import { useMemo, useState } from 'react';
import { ArrowRight, Star } from 'lucide-react';
import { compactNumber, type QueryChange, type QueryPoint } from '@seo/shared';
import { fmtDate } from '@/lib/utils';
import { ChartCard, TimeSeriesChart } from '@/components/charts';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Delta, ExternalLink, KeyValue } from '@/components/ui/misc';
import { Dialog } from '@/components/ui/overlay';
import { DataTable, type Column } from '@/components/ui/table';
import { FilterChips, useSitePage } from './kit';
import { ratioPct, sortByDate, urlPath } from './format';
import { PositionMove, plotAvgPos } from './positions';

type QFilter = 'all' | 'striking' | 'top10' | 'new' | 'lost' | 'tracked';

const isNew = (q: QueryPoint) => q.prevImpressions === 0 && q.impressions > 0;
const isLost = (q: QueryPoint) => q.impressions === 0 && q.prevImpressions > 0;
const isStriking = (q: QueryPoint) => q.impressions > 0 && q.position >= 4 && q.position <= 20;

/** Average-position change for Search Console rows (0 = no impressions in that period, not a position). */
export function GscMove({ prev, cur }: { prev: number; cur: number }) {
  if (cur > 0 && !(prev > 0)) return <Badge tone="accent">New</Badge>;
  if (!(cur > 0) && prev > 0) return <Badge>No impressions</Badge>;
  if (!(cur > 0)) return <span className="text-xs text-ink-3">–</span>;
  return <PositionMove prev={prev} cur={cur} digits={1} />;
}

/** Live Google position from the weekly check (0 = not in the top 50, -1 = not checked). */
export function LivePos({ p }: { p: number }) {
  if (p > 0) return <span className="font-medium">{p}</span>;
  if (p === 0) return <span className="text-ink-3">&gt;50</span>;
  return (
    <span className="text-ink-3" title="Not checked live this week">
      –
    </span>
  );
}

export function QueryExplorer({ queries, periods }: { queries: readonly QueryPoint[]; periods: readonly string[] }) {
  const { site } = useSitePage();
  const periodList = useMemo(() => [...new Set([...periods, ...queries.map((q) => q.periodEnd)])].filter(Boolean).sort().reverse(), [periods, queries]);
  const [period, setPeriod] = useState(periodList[0] ?? '');
  const [filter, setFilter] = useState<QFilter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const current = period || periodList[0] || '';
  const rows = useMemo(() => queries.filter((q) => q.periodEnd === current), [queries, current]);
  const counts = {
    all: rows.length,
    striking: rows.filter(isStriking).length,
    top10: rows.filter((q) => q.position > 0 && q.position <= 10).length,
    new: rows.filter(isNew).length,
    lost: rows.filter(isLost).length,
    tracked: rows.filter((q) => q.tracked).length,
  };
  const shown = rows.filter((q) =>
    filter === 'striking' ? isStriking(q) : filter === 'top10' ? q.position > 0 && q.position <= 10 : filter === 'new' ? isNew(q) : filter === 'lost' ? isLost(q) : filter === 'tracked' ? q.tracked : true,
  );

  const columns: Column<QueryPoint>[] = [
    {
      key: 'query',
      header: 'Query',
      sortValue: (r) => r.query,
      cell: (r) => (
        <span className="flex min-w-[14rem] items-center gap-1.5">
          {r.tracked && <Star className="size-3.5 shrink-0 fill-current text-accent-text" aria-label="Tracked keyword" />}
          <span className="font-medium text-ink">{r.query}</span>
        </span>
      ),
    },
    {
      key: 'clicks',
      header: 'Clicks',
      align: 'right',
      sortValue: (r) => r.clicks,
      cell: (r) => (
        <span className="inline-flex flex-col items-end">
          {compactNumber(r.clicks)}
          {r.prevClicks !== r.clicks && <Delta value={r.clicks - r.prevClicks} suffix="" digits={0} className="text-[11px]" />}
        </span>
      ),
    },
    { key: 'impressions', header: 'Impressions', align: 'right', sortValue: (r) => r.impressions, cell: (r) => compactNumber(r.impressions) },
    { key: 'ctr', header: 'CTR', align: 'right', sortValue: (r) => r.ctr, cell: (r) => ratioPct(r.ctr), hideOnMobile: true },
    { key: 'position', header: 'Avg. position', align: 'right', sortValue: (r) => (r.position > 0 ? r.position : 999), cell: (r) => (r.position > 0 ? r.position.toFixed(1) : '–') },
    { key: 'change', header: 'Change', align: 'right', sortValue: (r) => (r.position > 0 && r.prevPosition > 0 ? r.prevPosition - r.position : null), cell: (r) => <GscMove prev={r.prevPosition} cur={r.position} /> },
    { key: 'serp', header: 'Live', align: 'right', sortValue: (r) => (r.serpPosition > 0 ? r.serpPosition : 999), cell: (r) => <LivePos p={r.serpPosition} /> },
    {
      key: 'page',
      header: 'Page',
      sortValue: (r) => r.page,
      hideOnMobile: true,
      cell: (r) =>
        r.page ? (
          <span className="block max-w-[16rem] truncate text-[13px] text-ink-2" title={r.page}>
            {urlPath(r.page)}
          </span>
        ) : (
          <span className="text-ink-3">–</span>
        ),
    },
  ];

  const history = useMemo(() => (open ? sortByDate(queries.filter((q) => q.query === open), (q) => q.periodEnd) : []), [open, queries]);

  return (
    <>
      <DataTable
        rows={shown}
        columns={columns}
        rowKey={(r, i) => `${r.query}|${r.periodEnd}|${i}`}
        initialSort={{ key: 'impressions', dir: 'desc' }}
        searchable
        searchPlaceholder="Search queries"
        searchText={(r) => `${r.query} ${r.page}`}
        onRowClick={(r) => setOpen(r.query)}
        dense
        empty={rows.length ? 'No query matches this filter.' : 'No query data for this period.'}
        toolbar={
          <>
            {periodList.length > 1 && (
              <div className="w-56">
                <Select value={current} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
                  {periodList.map((p) => (
                    <option key={p} value={p}>
                      28 days to {fmtDate(p)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <FilterChips
              label="Query filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'striking', label: 'Striking distance 4–20', count: counts.striking },
                { value: 'top10', label: 'Top 10', count: counts.top10 },
                { value: 'new', label: 'New', count: counts.new },
                { value: 'lost', label: 'Lost', count: counts.lost },
                { value: 'tracked', label: 'Tracked', count: counts.tracked },
              ]}
            />
          </>
        }
      />
      <p className="mt-2 text-xs text-ink-3">
        Select a query to see its trend across weekly reports. “Live” is the position found by this week’s live Google check (tracked keywords). Star = a keyword you track.
      </p>
      {open && <QueryDialog query={open} history={history} domain={site.domain} onClose={() => setOpen(null)} />}
    </>
  );
}

function QueryDialog({ query, history, onClose }: { query: string; history: QueryPoint[]; domain: string; onClose: () => void }) {
  const { can, tool } = useSitePage();
  const last = history[history.length - 1];
  const rows = history.map((h) => ({ periodEnd: h.periodEnd, clicks: h.clicks, impressions: h.impressions, position: plotAvgPos(h.position), live: h.serpPosition > 0 ? h.serpPosition : null }));
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      wide
      title={query}
      description={last ? `${history.length} weekly ${history.length === 1 ? 'report' : 'reports'} · latest 28 days to ${fmtDate(last.periodEnd)}` : undefined}
      footer={
        can('member') && (
          <>
            <ButtonLink to={tool('verdict', { keyword: query })} variant="secondary" size="sm">
              Check the keyword
            </ButtonLink>
            <ButtonLink to={tool('keyword', { keyword: query, ...(last?.page ? { existingPageUrl: last.page } : {}) })} size="sm">
              {last?.page ? 'Improve the ranking page' : 'Write a page for it'}
              <ArrowRight className="size-3.5" aria-hidden />
            </ButtonLink>
          </>
        )
      }
    >
      {last && (
        <KeyValue
          className="mb-4"
          items={[
            { label: 'Clicks', value: `${compactNumber(last.clicks)} (previous 28 days: ${compactNumber(last.prevClicks)})` },
            { label: 'Impressions', value: `${compactNumber(last.impressions)} (previous: ${compactNumber(last.prevImpressions)})` },
            { label: 'CTR', value: ratioPct(last.ctr) },
            { label: 'Average position', value: last.position > 0 ? `${last.position.toFixed(1)}${last.prevPosition > 0 ? ` (was ${last.prevPosition.toFixed(1)})` : ''}` : 'no impressions' },
            { label: 'Live Google position', value: last.serpPosition > 0 ? String(last.serpPosition) : last.serpPosition === 0 ? 'not in the top 50' : 'not checked' },
            { label: 'Ranking page', value: last.page ? <ExternalLink href={last.page}>{urlPath(last.page)}</ExternalLink> : '–' },
          ]}
        />
      )}
      {history.length > 1 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ChartCard
            title="Average position"
            table={{ columns: [{ key: 'periodEnd', label: '28 days to', format: (v) => fmtDate(String(v)) }, { key: 'position', label: 'Position', align: 'right', format: (v) => (v == null ? '–' : Number(v).toFixed(1)) }], rows: [...rows].reverse() }}
          >
            <TimeSeriesChart data={rows} xKey="periodEnd" series={[{ key: 'position', label: 'Average position', format: (v) => v.toFixed(1) }]} invertY height={180} />
          </ChartCard>
          <ChartCard
            title="Clicks"
            table={{ columns: [{ key: 'periodEnd', label: '28 days to', format: (v) => fmtDate(String(v)) }, { key: 'clicks', label: 'Clicks', align: 'right' }, { key: 'impressions', label: 'Impressions', align: 'right' }], rows: [...rows].reverse() }}
          >
            <TimeSeriesChart data={rows} xKey="periodEnd" series={[{ key: 'clicks', label: 'Clicks' }]} area height={180} />
          </ChartCard>
        </div>
      ) : (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-2">The trend appears after the second weekly report that includes this query.</p>
      )}
    </Dialog>
  );
}

/** Winners / losers / new / lost queries of the latest weekly report. */
export function QueryChangeTable({ rows, empty }: { rows: readonly QueryChange[]; empty: string }) {
  const columns: Column<QueryChange>[] = [
    { key: 'query', header: 'Query', sortValue: (r) => r.query, cell: (r) => <span className="font-medium text-ink">{r.query}</span> },
    {
      key: 'clicks',
      header: 'Clicks',
      align: 'right',
      sortValue: (r) => r.clicks,
      cell: (r) => (
        <span className="inline-flex flex-col items-end">
          {compactNumber(r.clicks)}
          <Delta value={r.clicksDelta ?? r.clicks - r.prevClicks} suffix="" digits={0} className="text-[11px]" />
        </span>
      ),
    },
    { key: 'impressions', header: 'Impressions', align: 'right', sortValue: (r) => r.impressions, cell: (r) => `${compactNumber(r.impressions)}` },
    { key: 'position', header: 'Avg. position', align: 'right', sortValue: (r) => (r.position > 0 ? r.position : 999), cell: (r) => (r.position > 0 ? r.position.toFixed(1) : '–') },
    { key: 'move', header: 'Change', align: 'right', sortValue: (r) => r.positionDelta, cell: (r) => <GscMove prev={r.prevPosition} cur={r.position} /> },
    {
      key: 'page',
      header: 'Page',
      hideOnMobile: true,
      sortValue: (r) => r.page,
      cell: (r) => (r.page ? <span className="block max-w-[16rem] truncate text-[13px] text-ink-2" title={r.page}>{urlPath(r.page)}</span> : <span className="text-ink-3">–</span>),
    },
  ];
  return <DataTable rows={[...rows]} columns={columns} rowKey={(r, i) => `${r.query}|${i}`} dense pageSize={10} empty={empty} />;
}
