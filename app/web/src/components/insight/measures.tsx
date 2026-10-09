// Visual measures: score ring, progress bar, setup steps, distribution bar and trend chip. Colours: status tokens only when the
// colour means good / bad (always with a word or number next to it); the sequential blue ramp (seq-*) for intensity.
import { useEffect, useState, type ReactNode } from 'react';
import { Check, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconTile } from '@/components/ui/icon-tile';
import { Meter, scoreTone } from '@/components/ui/misc';
import { prefersReducedMotion } from './motion';
import { useSurface } from './surface';

export type RingTone = 'auto' | 'accent' | 'good' | 'warning' | 'critical';

const RING_FILL = {
  light: { accent: 'var(--accent)', good: 'var(--good)', warning: 'var(--warning)', critical: 'var(--critical)' },
  ink: { accent: 'var(--accent-on-ink)', good: 'var(--good)', warning: 'var(--warning)', critical: 'var(--critical-text)' },
  blue: { accent: 'var(--on-ink)', good: 'var(--on-ink)', warning: 'var(--on-ink)', critical: 'var(--on-ink)' },
} as const;
const RING_TRACK = {
  light: { accent: 'var(--accent-soft)', good: 'var(--good-soft)', warning: 'var(--warning-soft)', critical: 'var(--critical-soft)' },
  ink: { accent: 'var(--line-on-ink)', good: 'var(--line-on-ink)', warning: 'var(--line-on-ink)', critical: 'var(--line-on-ink)' },
  blue: { accent: 'color-mix(in srgb, var(--on-ink) 24%, transparent)', good: 'color-mix(in srgb, var(--on-ink) 24%, transparent)', warning: 'color-mix(in srgb, var(--on-ink) 24%, transparent)', critical: 'color-mix(in srgb, var(--on-ink) 24%, transparent)' },
} as const;

/**
 * ScoreRing: a 0–100 score (or any value against `max`) as a ring that draws itself in; `tone="auto"` colours it by the score
 * (80+ good, 60+ warning, below critical — say the grade in words next to it). Centre shows `display` (default: the rounded value).
 */
export function ScoreRing({
  value,
  max = 100,
  label,
  display,
  suffix,
  tone = 'auto',
  size = 72,
  stroke,
  valueText,
  className,
}: {
  value: number | null | undefined;
  max?: number;
  /** accessible name, e.g. "Health score" */
  label: string;
  display?: ReactNode;
  /** small text under the value, e.g. "/100" */
  suffix?: ReactNode;
  tone?: RingTone;
  size?: number;
  stroke?: number;
  /** what screen readers hear, e.g. "12.5%" (default: "80 of 100", or `display` when it is a string) */
  valueText?: string;
  className?: string;
}) {
  const surface = useSurface();
  const [drawn, setDrawn] = useState(prefersReducedMotion);
  useEffect(() => {
    if (drawn) return;
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, [drawn]);
  const has = value != null && Number.isFinite(value);
  const p = has ? Math.max(0, Math.min(1, value / max)) : 0;
  const t = tone === 'auto' ? (has && max === 100 ? scoreTone(value) : 'accent') : tone;
  const sw = stroke ?? Math.max(5, Math.round(size / 10));
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const dark = surface !== 'light';
  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={has ? value : undefined}
      aria-valuetext={has ? (valueText ?? (typeof display === 'string' ? display : `${Number(value.toFixed(1))} of ${max}`)) : 'No value yet'}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING_TRACK[surface][t]} strokeWidth={sw} />
        {has && p > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={RING_FILL[surface][t]}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={drawn ? c * (1 - p) : c}
            className="transition-[stroke-dashoffset] duration-[900ms] ease-brand"
          />
        )}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none" aria-hidden>
        <span className={cn('font-display font-semibold tracking-[-0.01em]', dark ? 'text-on-ink' : 'text-ink')} style={{ fontSize: Math.round(size * (suffix ? 0.27 : 0.25)) }}>
          {has ? (display ?? Math.round(value)) : '–'}
        </span>
        {suffix && has && <span className={cn('mt-1 text-[10px] font-medium', surface === 'blue' ? 'text-on-ink' : dark ? 'text-on-ink-2' : 'text-ink-3')}>{suffix}</span>}
      </span>
    </div>
  );
}

/** ProgressBar: a labelled Meter — label on the left, "3 of 6" on the right, the bar under them. */
export function ProgressBar({ value, max = 100, label, valueLabel, tone = 'accent', className }: { value: number; max?: number; label?: ReactNode; valueLabel?: ReactNode; tone?: 'accent' | 'good' | 'warning' | 'critical'; className?: string }) {
  const pctValue = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={className}>
      {(label || valueLabel) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span className="font-medium text-ink-2">{label}</span>
          <span className="tabular text-ink-3">{valueLabel}</span>
        </div>
      )}
      <Meter value={pctValue} tone={tone} label={typeof label === 'string' ? label : undefined} />
    </div>
  );
}

export interface Step {
  title: ReactNode;
  detail?: ReactNode;
  done: boolean;
  /** shown while the step is open */
  action?: ReactNode;
  icon?: ReactNode;
}

/** ProgressSteps: a setup checklist as numbered step cards — done steps turn green and drop their action. */
export function ProgressSteps({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <ol className={cn('grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3', className)}>
      {steps.map((s, i) => (
        <li
          key={i}
          className={cn(
            'flex items-start gap-3 rounded-xl border p-3.5 transition-[border-color,box-shadow,background-color] duration-200 ease-brand',
            s.done ? 'border-line bg-surface-2/60' : 'border-line bg-surface shadow-card hover:border-line-strong hover:shadow-raised',
          )}
        >
          <IconTile tone={s.done ? 'good' : 'blue'} size="sm">
            {s.done ? <Check strokeWidth={2.5} /> : (s.icon ?? <span className="font-display text-xs font-semibold">{i + 1}</span>)}
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm font-medium leading-snug', s.done ? 'text-ink-2' : 'text-ink')}>
              <span className="sr-only">{s.done ? 'Done: ' : 'To do: '}</span>
              {s.title}
            </p>
            {s.detail && <p className="mt-0.5 text-xs leading-snug text-ink-3">{s.detail}</p>}
            {!s.done && s.action && <div className="mt-2.5">{s.action}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The sequential blue ramp, light → strong (dark mode reverses the hex values so the last step is always the most salient). */
export const SEQ = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)', 'var(--seq-6)'] as const;

/**
 * DistributionBar: how a whole splits into ordered buckets (keyword positions, severities) as one bar with 2px gaps and a legend
 * with the counts. Colours from the blue ramp by intensity (pass `color` per segment); empty buckets keep their legend entry.
 */
export function DistributionBar({ segments, label, legend = true, format = (v: number) => v.toLocaleString('en-US'), className }: { segments: { label: string; value: number; color: string }[]; label: string; legend?: boolean; format?: (v: number) => string; className?: string }) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${label}: ${segments.map((s) => `${s.label} ${format(s.value)}`).join(', ')}`}>
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => <span key={s.label} className="h-full first:rounded-l-full last:rounded-r-full transition-[flex-grow] duration-500 ease-brand" style={{ flexGrow: s.value, flexBasis: 0, background: s.color }} />)}
      </div>
      {legend && <DistributionLegend segments={segments} format={format} className="mt-2.5" />}
    </div>
  );
}

/** DistributionLegend: the swatch + label + count list of a DistributionBar, for when the bar sits elsewhere (e.g. a MetricCard's trend slot). */
export function DistributionLegend({ segments, format = (v: number) => v.toLocaleString('en-US'), className }: { segments: { label: string; value: number; color: string }[]; format?: (v: number) => string; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs', className)} aria-hidden>
      {segments.map((s) => (
        <li key={s.label} className="inline-flex items-center gap-1.5 text-ink-3">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
          {s.label}
          <span className="font-medium tabular text-ink">{format(s.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Direction of a series (first vs last value), and whether that is good. */
export function trendOf(values: readonly (number | null | undefined)[], upIsGood = true): { direction: 'up' | 'down' | 'flat'; good: boolean | null } {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  if (v.length < 2 || v[v.length - 1] === v[0]) return { direction: 'flat', good: null };
  const up = v[v.length - 1] > v[0];
  return { direction: up ? 'up' : 'down', good: up === upIsGood };
}

/** TrendChip: a word-level trend ("Rising", "Entered the top 10") with an arrow; green / red only when it is good / bad. */
export function TrendChip({ direction, good = null, children, className }: { direction: 'up' | 'down' | 'flat'; good?: boolean | null; children: ReactNode; className?: string }) {
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const light = useSurface() === 'light';
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium',
        good == null ? (light ? 'bg-surface-2 text-ink-2' : 'bg-on-ink/10 text-on-ink') : good ? 'bg-good-soft text-good-text' : 'bg-critical-soft text-critical-text',
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}
