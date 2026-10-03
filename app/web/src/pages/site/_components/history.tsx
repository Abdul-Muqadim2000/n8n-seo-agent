// Ranking history charts: several keywords on one inverted axis, "not in the top 50" drawn on a floor line.
import { useMemo, type ReactNode } from 'react';
import type { RankPoint } from '@seo/shared';
import { fmtDate } from '@/lib/utils';
import { ChartCard, SERIES_COLORS, TimeSeriesChart, type Series } from '@/components/charts';
import { OFF_CHART, plotPos, posAxis, posText, posValue } from './positions';

export interface HistoryLine {
  key: string;
  label: string;
  history: readonly RankPoint[];
  /** fixed colour slot (colour follows the keyword, not its place in the list) */
  slot?: number;
}

/** Rows keyed by day: { day, k0: 12, k1: 51, … } */
export function historyRows(lines: readonly HistoryLine[]) {
  const byDay = new Map<string, Record<string, unknown>>();
  lines.forEach((l, i) => {
    for (const p of l.history) {
      const day = String(p.checkedAt).slice(0, 10);
      const row = byDay.get(day) ?? { day };
      row[`k${i}`] = plotPos(p.position);
      row[`raw${i}`] = p.position;
      byDay.set(day, row);
    }
  });
  return [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
}

export function PositionHistoryChart({ lines, height = 260 }: { lines: readonly HistoryLine[]; height?: number }) {
  const rows = useMemo(() => historyRows(lines), [lines]);
  const series: Series[] = lines.map((l, i) => ({ key: `k${i}`, label: l.label, color: SERIES_COLORS[(l.slot ?? i) % SERIES_COLORS.length], format: posValue }));
  const hasDeep = rows.some((r) => lines.some((_, i) => typeof r[`k${i}`] === 'number' && (r[`k${i}`] as number) > 10));
  return (
    <TimeSeriesChart
      data={rows}
      xKey="day"
      series={series}
      height={height}
      invertY
      yDomain={[1, 'dataMax']}
      yFormat={posAxis}
      reference={hasDeep ? { y: 10, label: 'Top 10' } : undefined}
    />
  );
}

/** ChartCard with the history chart and a table view of every check. */
export function PositionHistoryCard({ title, description, lines, actions, loading, height }: { title: string; description?: string; lines: readonly HistoryLine[]; actions?: ReactNode; loading?: boolean; height?: number }) {
  const rows = useMemo(() => historyRows(lines), [lines]);
  const series: Series[] = lines.map((l, i) => ({ key: `k${i}`, label: l.label, color: SERIES_COLORS[(l.slot ?? i) % SERIES_COLORS.length] }));
  const offChart = lines.some((l) => l.history.some((h) => h.position === 0));
  return (
    <ChartCard
      title={title}
      description={description ?? `Google position per weekly check (1 = top).${offChart ? ` Points on the bottom line were not in the top ${OFF_CHART - 1}.` : ''}`}
      series={series}
      actions={actions}
      loading={loading}
      table={{
        columns: [
          { key: 'day', label: 'Checked', format: (v) => fmtDate(String(v)) },
          ...lines.map((l, i) => ({ key: `raw${i}`, label: l.label, align: 'right' as const, format: (v: unknown) => (typeof v === 'number' ? posText(v) : '–') })),
        ],
        rows: [...rows].reverse(),
      }}
    >
      <PositionHistoryChart lines={lines} height={height} />
    </ChartCard>
  );
}
