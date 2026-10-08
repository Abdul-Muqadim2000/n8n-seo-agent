// Presentation helpers for the Search, Rankings, Technical, AI visibility and Backlinks pages (P2 redesign): chart titles with an
// icon tile, the hero eyebrow, on-dark chips inside a SummaryHero, ranked share rows and the dashboard skeleton. No data logic.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/feedback';
import { IconTile, InfoTip, type IconTileTone } from '@/components/insight';

/** A chart card title with its icon tile and (optionally) the explanation behind an info tip. */
export function ChartTitle({ icon, children, info, tone = 'blue' }: { icon: ReactNode; children: ReactNode; info?: ReactNode; tone?: IconTileTone }) {
  return (
    <span className="flex items-center gap-3">
      <IconTile size="sm" tone={tone}>
        {icon}
      </IconTile>
      <span className="flex min-w-0 items-center gap-1">
        {children}
        {info && <InfoTip label="About this chart">{info}</InfoTip>}
      </span>
    </span>
  );
}

/** SummaryHero eyebrow: a mono scope tag, then the period / context (wraps under the tag on phones). */
export function HeroEyebrow({ tag, children }: { tag: ReactNode; children?: ReactNode }) {
  return (
    <>
      <span className="font-mono tracking-[0.02em] uppercase">{tag}</span>
      {children && (
        <>
          <span className="hidden sm:inline" aria-hidden>
            ·
          </span>
          <span className="basis-full sm:basis-auto">{children}</span>
        </>
      )}
    </>
  );
}

/** A small chip inside a SummaryHero (on-dark colours): a connection, a source, a file. Optional router link. */
export function HeroChip({ icon, children, to, title, className }: { icon?: ReactNode; children: ReactNode; to?: string; title?: string; className?: string }) {
  const cls = cn(
    'inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-on-ink/10 px-2.5 text-xs font-medium text-on-ink ring-1 ring-line-on-ink [&_svg]:size-3.5 [&_svg]:shrink-0',
    to && 'transition-colors duration-150 ease-brand hover:bg-on-ink/20',
    className,
  );
  const inner = (
    <>
      {icon}
      <span className="truncate">{children}</span>
    </>
  );
  return to ? (
    <Link to={to} className={cls} title={title}>
      {inner}
    </Link>
  ) : (
    <span className={cls} title={title}>
      {inner}
    </span>
  );
}

/**
 * Ranked share rows (share of voice, competitors): rank number, name, a blue bar and the value. "You" gets the solid brand bar and a
 * chip; everyone else the lighter ramp step, so the eye lands on your own row.
 */
export function RankedBars({ items, you, valueFormat = (v: number) => `${v.toFixed(1)}%`, max, youLabel = 'You' }: { items: { label: string; value: number; sub?: ReactNode }[]; you?: string; valueFormat?: (v: number) => string; max?: number; youLabel?: string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="space-y-1">
      {items.map((it, i) => {
        const mine = it.label === you;
        return (
          <li
            key={it.label}
            className={cn(
              'grid grid-cols-[1.5rem_minmax(0,9.5rem)_1fr_auto] items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ease-brand hover:bg-surface-2/60 sm:gap-3',
              mine && 'bg-accent-soft hover:bg-accent-soft',
            )}
          >
            <span className={cn('inline-flex size-6 items-center justify-center rounded-md font-mono text-[11px] font-semibold tabular', i < 3 ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2')}>{i + 1}</span>
            <span className={cn('flex min-w-0 items-center gap-1.5', mine ? 'font-semibold text-ink' : 'text-ink-2')} title={it.label}>
              <span className="truncate">{it.label}</span>
              {mine && <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] leading-4 font-semibold text-accent-ink">{youLabel}</span>}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full transition-[width] duration-500 ease-brand" style={{ width: `${Math.max(1.5, (it.value / top) * 100)}%`, background: mine ? 'var(--seq-5)' : 'var(--seq-3)' }} />
            </span>
            <span className="text-right tabular text-ink">
              {valueFormat(it.value)}
              {it.sub != null && it.sub !== '' && <span className="ml-1 text-xs text-ink-3">{it.sub}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A labelled figure inside a card (icon tile, value, label + info tip, hint): a lighter MetricCard for panel bodies. */
export function FigureTile({ icon, tone = 'blue', label, value, hint, info, className }: { icon?: ReactNode; tone?: IconTileTone; label: string; value: ReactNode; hint?: ReactNode; info?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2.5 rounded-lg border border-line p-3 transition-colors duration-150 ease-brand hover:border-line-strong', className)}>
      {icon && (
        <IconTile tone={tone} size="sm">
          {icon}
        </IconTile>
      )}
      <div className="min-w-0">
        <div className="font-display text-xl leading-none font-semibold tracking-[-0.01em] text-ink">{value}</div>
        <div className="mt-1.5 flex items-center gap-0.5 text-xs font-medium text-ink-3">
          {label}
          {info && <InfoTip label={`About ${label.toLowerCase()}`}>{info}</InfoTip>}
        </div>
        {hint && <div className="mt-0.5 text-xs leading-snug text-ink-3">{hint}</div>}
      </div>
    </div>
  );
}

/** First load of a dashboard page: hero, metric cards, a chart row and a table (the page anatomy). */
export function DashSkeleton({ cards = 4, charts = 2 }: { cards?: number; charts?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-[280px] rounded-xl" />
      {cards > 0 && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: cards }, (_, i) => (
            <Skeleton key={i} className="h-[160px] rounded-xl" />
          ))}
        </div>
      )}
      <div className={cn('grid grid-cols-1 gap-4', charts > 1 && 'lg:grid-cols-2')}>
        {Array.from({ length: charts }, (_, i) => (
          <Skeleton key={i} className="h-[320px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[260px] rounded-xl" />
    </div>
  );
}
