// AI visibility wave 2 (W2-A, 2026-10-23): trends from the rows already stored, per engine and per competitor, with the 95% range, and
// a break wherever a run was not compared with the one before it (a changed panel or changed engines). A line is never drawn across a
// break: it stops, a numbered marker says why, and the next stretch starts on its own.
import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LineChart as LineChartIcon, Trophy } from 'lucide-react';
import { aiInRange, aiTrendRows, type AiFilter, type AiRun, type AiTrendRun, type ChartAnnotation } from '@seo/shared';
import { fmtDate, fmtDay } from '@/lib/utils';
import { AnnotationLegend, ChartCard, SERIES_COLORS, TimeSeriesChart, type Series } from '@/components/charts';
import { EmptyState } from '@/components/ui/feedback';
import { MetricSwitch } from './kit';
import { pct, timeAxisFormat } from './format';
import { ChartTitle } from './visuals';
import { engineLabel, sortEngines } from './ai';

/** The break markers of a trend (one per run that was not compared with the run before), as chart annotations. */
export function breakMarks(breaks: { at: string; reason: string }[]): ChartAnnotation[] {
  return breaks.map((b) => ({ kind: 'data_break', date: b.at.slice(0, 10), dateEnd: b.at.slice(0, 10), label: 'Not compared with the run before', detail: b.reason, url: '', tone: 'warning' }));
}

const AXIS = { fill: 'var(--ink-3)', fontSize: 12 };

/**
 * One rate over time with its 95% range as a band, broken at every run that was not compared. `values(i)` gives run i's value and range.
 */
export function RangeTrendChart({ runs, values, label, height = 240 }: { runs: readonly AiTrendRun[]; values: (i: number) => { value: number | null; band: [number, number] | null }; label: string; height?: number }) {
  const { rows, breaks } = useMemo(() => {
    const idx = new Map(runs.map((r, i) => [r.runId + r.checkedAt, i]));
    return aiTrendRows(runs, (r) => {
      const v = values(idx.get(r.runId + r.checkedAt) ?? 0);
      return { value: v.value, band: v.band ?? null };
    });
  }, [runs, values]);
  if (!rows.some((r) => typeof r.value === 'number')) return <p className="py-6 text-center text-[13px] text-ink-3">No rate to draw yet: under 12 answers a run shows no rate.</p>;
  const marks = breakMarks(breaks);
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="checkedAt" tickFormatter={(v) => (v ? fmtDay(String(v)) : '')} tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--axis)' }} tickMargin={8} minTickGap={24} />
          <YAxis tickFormatter={(v: number) => `${v}%`} tick={AXIS} tickLine={false} axisLine={false} width={44} domain={[0, 'auto']} allowDecimals={false} />
          <Tooltip
            content={({ active, payload }) => {
              const row = active && payload?.length ? (payload[0].payload as Record<string, unknown>) : null;
              if (!row || row.gap) return null;
              const band = row.band as [number, number] | null;
              return (
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-overlay dark:bg-surface-2">
                  <p className="font-medium text-ink-2">{fmtDate(String(row.checkedAt))}</p>
                  <p className="mt-1 font-semibold tabular text-ink">
                    {label}: {typeof row.value === 'number' ? pct(row.value) : 'too few answers'}
                  </p>
                  {band && <p className="text-ink-3">95% range {pct(band[0], 0)} to {pct(band[1], 0)}</p>}
                </div>
              );
            }}
          />
          <Area dataKey="band" stroke="none" fill="var(--accent)" fillOpacity={0.14} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="value" name={label} stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
          {rows.filter((r) => r.gap).map((r, i) => (
            <ReferenceLine key={String(r.checkedAt)} x={String(r.checkedAt)} stroke="var(--warning-text)" strokeDasharray="4 3" label={{ value: String(i + 1), fill: 'var(--ink-3)', fontSize: 10, position: 'top' }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      {marks.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-ink-3">
          {breaks.map((b, i) => (
            <li key={b.at}>
              <span className="mr-1 inline-flex size-[14px] items-center justify-center rounded-full bg-warning-soft text-[9px] font-semibold text-warning-text">{i + 1}</span>
              {fmtDate(b.at)}: not compared with the run before ({b.reason})
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-ink-3">The shaded band is the 95% range: where the true rate most likely lies.</p>
    </div>
  );
}

type EngineMetric = 'named' | 'cited';

/** Per engine over time, from every stored run's engine table (engines_json), with breaks. */
export function EngineTrendPanel({ runs, filter, engineNames, className }: { runs: AiRun[]; filter: AiFilter; engineNames: Record<string, string>; className?: string }) {
  const [m, setM] = useState<EngineMetric>('named');
  const shown = runs.filter((r) => aiInRange(r.checkedAt, filter));
  const keys = sortEngines(shown.flatMap((r) => (r.engineRates ?? []).filter((e) => !e.carried).map((e) => e.key))).filter((k) => !filter.engine || k === filter.engine);
  const series: Series[] = keys.slice(0, 8).map((k, i) => ({ key: k, label: engineNames[k] ?? engineLabel(k), color: SERIES_COLORS[i], format: (v) => pct(v) }));
  const { rows, breaks } = aiTrendRows(shown, (r) => Object.fromEntries(keys.map((k) => {
    const e = r.engineRates?.find((x) => x.key === k);
    // under 12 answers an engine's rate is too noisy to draw; a carried monthly result is not a reading of this run
    const v = e && !e.carried && e.samples >= 12 ? (m === 'named' ? e.mentionRate : e.citationRate) : null;
    return [k, v];
  })));
  const marks = breakMarks(breaks);
  return (
    <ChartCard
      className={className}
      title={<ChartTitle icon={<LineChartIcon />}>Each engine over time</ChartTitle>}
      description={`${shown.length} ${shown.length === 1 ? 'run' : 'runs'} · percent of each engine's answers that ${m === 'named' ? 'name you' : 'cite a page of yours'} · an engine with under 12 answers in a run is left out of that run`}
      series={series}
      actions={<MetricSwitch label="Metric" value={m} onChange={setM} options={[{ value: 'named', label: 'Named' }, { value: 'cited', label: 'Cited' }]} />}
      table={{
        columns: [{ key: 'checkedAt', label: 'Run', format: (v) => (v ? fmtDate(String(v)) : 'not compared') }, ...keys.map((k) => ({ key: k, label: engineNames[k] ?? engineLabel(k), align: 'right' as const, format: (v: unknown) => (v == null ? '-' : pct(Number(v))) }))],
        rows: rows.filter((r) => !r.gap).reverse(),
      }}
    >
      {keys.length && rows.length ? (
        <>
          <TimeSeriesChart data={rows} xKey="checkedAt" series={series} height={250} xFormat={timeAxisFormat(rows.map((r) => String(r.checkedAt)))} yFormat={(v) => `${v}%`} yDomain={[0, 'auto']} connectNulls={false} annotations={marks} />
          <AnnotationLegend annotations={marks} data={rows} xKey="checkedAt" className="mt-2" />
        </>
      ) : (
        <EmptyState className="py-8" icon={<LineChartIcon className="size-5" />} title="No engine figures stored yet" description="Each weekly run stores every engine's rates; the lines start with the next runs." />
      )}
    </ChartCard>
  );
}

/** Share of voice per brand over time (the fixed set when the run stored one, else every brand named), with breaks. */
export function SovTrendPanel({ runs, filter, domain, className }: { runs: AiRun[]; filter: AiFilter; domain: string; className?: string }) {
  const shown = runs.filter((r) => aiInRange(r.checkedAt, filter));
  const latest = shown[shown.length - 1];
  // the brands of the latest run, largest first (seven at most, so every line keeps its own colour); you are always drawn
  const top = (latest?.sov?.brands ?? []).filter((b) => b.share != null && b.name !== domain).sort((a, b) => (b.share ?? 0) - (a.share ?? 0)).slice(0, 7);
  const keyOf = (i: number) => `b${i}`;
  const series: Series[] = [{ key: 'you', label: domain, color: SERIES_COLORS[0], format: (v) => pct(v) }, ...top.map((b, i) => ({ key: keyOf(i), label: b.name, color: SERIES_COLORS[(i + 1) % SERIES_COLORS.length], format: (v: number) => pct(v) }))];
  // a run that counts against a different basis (fixed set vs every brand) is a break too
  const withBasis = shown.map((r, i) => (i > 0 && r.sov && shown[i - 1].sov && r.sov.basis !== shown[i - 1].sov!.basis ? { ...r, compare: { ...(r.compare ?? {}), comparable: false, reason: 'share of voice counted against a different set of brands' } as AiRun['compare'] } : r));
  const { rows, breaks } = aiTrendRows(withBasis, (r) => ({
    you: r.shareOfVoice,
    ...Object.fromEntries(top.map((b, i) => [keyOf(i), r.sov?.brands.find((x) => x.id === b.id || x.name === b.name)?.share ?? null])),
  }));
  const marks = breakMarks(breaks);
  const basis = latest?.sov?.basis === 'set' ? 'against the fixed set of brands you chose' : 'against every brand the answers named';
  return (
    <ChartCard
      className={className}
      title={<ChartTitle icon={<Trophy />}>Share of voice over time</ChartTitle>}
      description={`Share of brand mentions, ${basis} · a run that asked a different panel, other engines or another brand set starts a new line`}
      series={series}
      table={{ columns: [{ key: 'checkedAt', label: 'Run', format: (v) => fmtDate(String(v)) }, ...series.map((s) => ({ key: s.key, label: s.label, align: 'right' as const, format: (v: unknown) => (v == null ? '-' : pct(Number(v))) }))], rows: rows.filter((r) => !r.gap).reverse() }}
    >
      {rows.length > 1 ? (
        <>
          <TimeSeriesChart data={rows} xKey="checkedAt" series={series} height={250} xFormat={timeAxisFormat(rows.map((r) => String(r.checkedAt)))} yFormat={(v) => `${v}%`} yDomain={[0, 'auto']} connectNulls={false} annotations={marks} />
          <AnnotationLegend annotations={marks} data={rows} xKey="checkedAt" className="mt-2" />
        </>
      ) : (
        <EmptyState className="py-8" icon={<Trophy className="size-5" />} title="One run so far" description="Share of voice over time starts with the next run." />
      )}
    </ChartCard>
  );
}
