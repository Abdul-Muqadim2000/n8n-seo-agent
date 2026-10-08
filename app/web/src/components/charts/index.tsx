import { createContext, useContext, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { BarChart3, Table2 } from 'lucide-react';
import { compactNumber } from '@seo/shared';
import { cn, fmtDay } from '@/lib/utils';
import { Card } from '../ui/card';
import { Segmented } from '../ui/tabs';

// Chart rules (dataviz skill): categorical colours in fixed order, never cycled (max 8; fold the rest into "Other"); one y-axis per
// chart (two measures of different scale = two charts); 2px lines, bars <= 24px with a 4px rounded data end; hairline solid grid;
// tooltip shows every series at the hovered x, values first; a legend for 2+ series; every chart has a table view.

export const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];

export interface Series {
  key: string;
  label: string;
  /** a CSS colour; defaults to the slot of the series' position */
  color?: string;
  format?: (v: number) => string;
}

type Row = Record<string, unknown>;
const colorOf = (s: Series, i: number) => s.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
const AXIS_TICK = { fill: 'var(--ink-3)', fontSize: 12, fontFamily: 'var(--type-ui)', style: { fontVariantNumeric: 'tabular-nums' } };

/** Legend hover inside a ChartCard: the hovered series stays, the others fade (pointer only; the table view carries the data). */
const FocusCtx = createContext<{ focus: string | null; setFocus: (k: string | null) => void } | null>(null);
const useSeriesFocus = () => useContext(FocusCtx)?.focus ?? null;
const dim = (focus: string | null, key: string) => (focus && focus !== key ? 0.2 : 1);

// ---------- tooltip ----------
interface TipProps {
  active?: boolean;
  payload?: readonly { value?: unknown; name?: unknown; color?: string; dataKey?: unknown; payload?: Row }[];
  label?: unknown;
}

function ChartTooltip({ active, payload, label, series, xFormat }: TipProps & { series: Series[]; xFormat?: (v: unknown) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] animate-fade-in rounded-lg border border-line bg-surface px-3 py-2.5 text-xs shadow-overlay dark:bg-surface-2">
      <div className="mb-2 border-b border-line pb-1.5 font-medium text-ink-2">{xFormat ? xFormat(label) : String(label ?? '')}</div>
      <div className="space-y-1.5">
        {payload.map((p, i) => {
          const s = series.find((x) => x.key === p.dataKey);
          const v = typeof p.value === 'number' ? p.value : Number(p.value);
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
              <span className="font-semibold tabular text-ink">{Number.isFinite(v) ? (s?.format ? s.format(v) : compactNumber(v)) : '–'}</span>
              <span className="truncate text-ink-3">{s?.label ?? String(p.name ?? '')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Legend({ series, shape = 'line' }: { series: Series[]; shape?: 'line' | 'rect' }) {
  const ctx = useContext(FocusCtx);
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-1.5" onMouseLeave={() => ctx?.setFocus(null)}>
      {series.map((s, i) => (
        <span
          key={s.key}
          onMouseEnter={() => ctx?.setFocus(s.key)}
          className={cn(
            'inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-xs text-ink-2 transition-[background-color,border-color,opacity] duration-150 ease-brand',
            ctx && 'cursor-default hover:border-line-strong hover:bg-surface-2 hover:text-ink',
            ctx?.focus && ctx.focus !== s.key && 'opacity-50',
          )}
        >
          <span className={cn('shrink-0', shape === 'line' ? 'h-0.5 w-3 rounded-full' : 'size-2.5 rounded-[3px]')} style={{ background: colorOf(s, i) }} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

// ---------- card with chart / table toggle ----------
export interface TableView {
  columns: { key: string; label: string; format?: (v: unknown, row: Row) => ReactNode; align?: 'left' | 'right' }[];
  rows: Row[];
}

export function ChartCard({
  title,
  description,
  series,
  legendShape,
  actions,
  table,
  children,
  className,
  footer,
  loading,
}: {
  title: ReactNode;
  description?: ReactNode;
  series?: Series[];
  legendShape?: 'line' | 'rect';
  actions?: ReactNode;
  table?: TableView;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  /** refetch in progress: hold the previous render at reduced opacity */
  loading?: boolean;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [focus, setFocus] = useState<string | null>(null);
  return (
    <FocusCtx.Provider value={{ focus, setFocus }}>
      <Card className={cn('flex flex-col', className)} aria-busy={loading || undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
            {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
            {table && (
              <Segmented
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: 'chart', label: <BarChart3 className="size-3.5" aria-label="Chart" /> },
                  { value: 'table', label: <Table2 className="size-3.5" aria-label="Table" /> },
                ]}
              />
            )}
          </div>
        </div>
        {series && series.length > 1 && view === 'chart' && (
          <div className="px-5 pt-3">
            <Legend series={series} shape={legendShape} />
          </div>
        )}
        <div className={cn('flex-1 px-3 pb-4 pt-3 transition-opacity duration-200 ease-brand', loading && 'opacity-60')}>
          {view === 'chart' || !table ? children : <SimpleTable view={table} />}
        </div>
        {footer && <div className="border-t border-line px-5 py-3 text-[13px] text-ink-3">{footer}</div>}
      </Card>
    </FocusCtx.Provider>
  );
}

function SimpleTable({ view }: { view: TableView }) {
  return (
    <div className="max-h-[320px] overflow-auto px-2">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-[1] bg-surface">
          <tr>
            {view.columns.map((c) => (
              <th key={c.key} className={cn('border-b border-line-strong px-2 py-2 text-xs font-medium text-ink-3', c.align === 'right' ? 'text-right' : 'text-left')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.rows.map((r, i) => (
            <tr key={i} className="border-b border-line transition-colors duration-100 last:border-0 hover:bg-surface-2/60">
              {view.columns.map((c) => (
                <td key={c.key} className={cn('px-2 py-1.5 text-ink', c.align === 'right' && 'text-right tabular')}>
                  {c.format ? c.format(r[c.key], r) : String(r[c.key] ?? '–')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- time series (line or area) ----------
export function TimeSeriesChart({
  data,
  xKey,
  series,
  height = 240,
  yFormat = compactNumber,
  xFormat = (v: unknown) => fmtDay(String(v)),
  area,
  invertY,
  yDomain,
  reference,
  referenceX,
  connectNulls = true,
}: {
  data: Row[];
  xKey: string;
  series: Series[];
  height?: number;
  yFormat?: (v: number) => string;
  xFormat?: (v: unknown) => string;
  /** a 10% wash under single-series lines */
  area?: boolean;
  /** rankings: position 1 at the top */
  invertY?: boolean;
  yDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  reference?: { y: number; label: string };
  /** a vertical marker, e.g. where the current period starts */
  referenceX?: { x: string | number; label: string };
  /** false: a missing value (failed check) breaks the line instead of bridging it */
  connectNulls?: boolean;
}) {
  const Chart = area ? AreaChart : LineChart;
  const focus = useSeriesFocus();
  const single = series.length === 1;
  // positions: rank 1 at the top, and the top tick labelled
  const domain = yDomain ?? (invertY ? ([1, 'dataMax'] as [number, 'dataMax']) : (['auto', 'auto'] as ['auto', 'auto']));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" strokeWidth={1} />
        <XAxis dataKey={xKey} tickFormatter={xFormat} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tickMargin={8} minTickGap={24} />
        <YAxis tickFormatter={(v: number) => yFormat(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={6} width={48} reversed={invertY} domain={domain} allowDecimals={false} />
        <Tooltip cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1, strokeDasharray: '3 3' }} content={(p: TipProps) => <ChartTooltip {...p} series={series} xFormat={xFormat} />} />
        {reference && <ReferenceLine y={reference.y} stroke="var(--axis)" label={{ value: reference.label, fill: 'var(--ink-3)', fontSize: 11, position: 'insideTopRight' }} />}
        {referenceX && <ReferenceLine x={referenceX.x} stroke="var(--axis)" label={{ value: referenceX.label, fill: 'var(--ink-3)', fontSize: 11, position: 'insideTopLeft' }} />}
        {series.map((s, i) =>
          area ? (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={colorOf(s, i)}
              strokeWidth={2}
              strokeOpacity={dim(focus, s.key)}
              // brand: area under the default blue line = Ascentra blue tint; a custom colour keeps its own 10% wash
              fill={single && !s.color ? 'var(--accent-soft)' : colorOf(s, i)}
              fillOpacity={single ? (s.color ? 0.1 : 0.85) : 0}
              dot={false}
              activeDot={{ r: 5, fill: colorOf(s, i), stroke: 'var(--surface)', strokeWidth: 2 }}
              connectNulls={connectNulls}
              isAnimationActive={false}
            />
          ) : (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={colorOf(s, i)}
              strokeWidth={2}
              strokeOpacity={dim(focus, s.key)}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={data.length <= 2 ? { r: 4, fill: colorOf(s, i), stroke: 'var(--surface)', strokeWidth: 2 } : false}
              activeDot={{ r: 5, fill: colorOf(s, i), stroke: 'var(--surface)', strokeWidth: 2 }}
              connectNulls={connectNulls}
              isAnimationActive={false}
            />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

// ---------- bars ----------
export function BarsChart({
  data,
  categoryKey,
  series,
  height = 240,
  horizontal,
  stacked,
  valueFormat = compactNumber,
  categoryFormat,
  categoryWidth = 120,
}: {
  data: Row[];
  categoryKey: string;
  series: Series[];
  height?: number;
  /** bars grow left to right (long category labels) */
  horizontal?: boolean;
  stacked?: boolean;
  valueFormat?: (v: number) => string;
  categoryFormat?: (v: unknown) => string;
  categoryWidth?: number;
}) {
  const last = series.length - 1;
  const fmtCat = categoryFormat ?? ((v: unknown) => String(v ?? ''));
  const focus = useSeriesFocus();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={!!horizontal} horizontal={!horizontal} stroke="var(--grid)" strokeWidth={1} />
        {horizontal ? (
          <>
            <XAxis type="number" tickFormatter={(v: number) => valueFormat(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={6} allowDecimals={false} />
            <YAxis type="category" dataKey={categoryKey} tickFormatter={fmtCat} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tickMargin={6} width={categoryWidth} interval={0} />
          </>
        ) : (
          <>
            <XAxis dataKey={categoryKey} tickFormatter={fmtCat} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tickMargin={8} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v: number) => valueFormat(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} tickMargin={6} width={48} allowDecimals={false} />
          </>
        )}
        <Tooltip cursor={{ fill: 'var(--accent-soft)', fillOpacity: 0.6 }} content={(p: TipProps) => <ChartTooltip {...p} series={series} xFormat={fmtCat} />} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={colorOf(s, i)}
            fillOpacity={dim(focus, s.key)}
            stackId={stacked ? 'a' : undefined}
            maxBarSize={24}
            radius={!stacked || i === last ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0}
            stroke={stacked ? 'var(--surface)' : undefined}
            strokeWidth={stacked ? 2 : 0}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- sparkline (stat tiles) ----------
export function Sparkline({
  data,
  dataKey,
  invert,
  color = 'var(--series-1)',
  size,
}: {
  data: Row[];
  dataKey: string;
  invert?: boolean;
  color?: string;
  /** fixed size in px, for spots that can be hidden (a table column hidden on phones measures 0 and Recharts warns) */
  size?: { width: number; height: number };
}) {
  if (data.length < 2) return null;
  return (
    <ResponsiveContainer width={size?.width ?? '100%'} height={size?.height ?? '100%'}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <YAxis hide reversed={invert} domain={['dataMin', 'dataMax']} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal share bars in plain HTML (share of voice, channel mix): label, bar, value. Readable without hover. */
export function ShareBars({ items, valueFormat = (v: number) => `${v.toFixed(1)}%`, max, highlight }: { items: { label: string; value: number; sub?: string }[]; valueFormat?: (v: number) => string; max?: number; highlight?: string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
          <span className={cn('truncate', it.label === highlight ? 'font-semibold text-ink' : 'text-ink-2')} title={it.label}>
            {it.label}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full transition-[width] duration-500 ease-brand" style={{ width: `${Math.max(1.5, (it.value / top) * 100)}%`, background: it.label === highlight ? 'var(--series-2)' : 'var(--series-1)' }} />
          </span>
          <span className="text-right tabular text-ink">
            {valueFormat(it.value)}
            {it.sub && <span className="ml-1 text-xs text-ink-3">{it.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
