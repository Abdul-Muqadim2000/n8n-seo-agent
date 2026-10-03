// Google positions: 1 is best. Stored values follow the rank tracker: 0 = not in the top 50, -1 = the check failed (check
// again), null = never checked. Charts plot "not in the top 50" on a floor line below 50 instead of at 0.
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { formatPosition } from '@seo/shared';
import { cn } from '@/lib/utils';

export const OFF_CHART = 51;

/** Value to plot: positions as is, "not in the top 50" on the floor, failed / unknown checks as gaps. */
export function plotPos(p: number | null | undefined): number | null {
  if (p == null || !Number.isFinite(p) || p < 0) return null;
  if (p === 0) return OFF_CHART;
  return p;
}

/** Search Console average position: 0 means no impressions that day, not "position 0". */
export function plotAvgPos(p: number | null | undefined): number | null {
  if (p == null || !Number.isFinite(p) || p <= 0) return null;
  return p;
}

export const posAxis = (v: number) => (v >= OFF_CHART ? '>50' : v < 1 ? '' : String(Math.round(v)));
export const posValue = (v: number) => (v >= OFF_CHART ? 'not in top 50' : Number.isInteger(v) ? String(v) : v.toFixed(1));

/** A ranking position, ready to show. */
export const posText = formatPosition;

/** A real ranking (in the top 50). */
export const ranked = (p: number | null | undefined): p is number => p != null && p > 0;

export type Bucket = 'top3' | 'top10' | 'top20' | 'top50' | 'out' | 'unknown';
export const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'top3', label: 'Top 3' },
  { key: 'top10', label: '4–10' },
  { key: 'top20', label: '11–20' },
  { key: 'top50', label: '21–50' },
  { key: 'out', label: 'Not in top 50' },
  { key: 'unknown', label: 'Not checked yet' },
];

export function bucketOf(p: number | null | undefined): Bucket {
  if (p == null || p < 0) return 'unknown';
  if (p === 0) return 'out';
  if (p <= 3) return 'top3';
  if (p <= 10) return 'top10';
  if (p <= 20) return 'top20';
  if (p <= 50) return 'top50';
  return 'out';
}

export type Move = { kind: 'up' | 'down' | 'same' | 'entered' | 'dropped' | 'unknown'; places: number };

export function moveOf(prev: number | null | undefined, cur: number | null | undefined): Move {
  const p = prev != null && prev >= 0 ? prev : null;
  const c = cur != null && cur >= 0 ? cur : null;
  if (c == null) return { kind: 'unknown', places: 0 };
  if (p == null) return { kind: c > 0 ? 'entered' : 'unknown', places: 0 };
  if (p === 0 && c === 0) return { kind: 'same', places: 0 };
  if (p === 0) return { kind: 'entered', places: 0 };
  if (c === 0) return { kind: 'dropped', places: 0 };
  const d = p - c;
  if (Math.abs(d) < 0.05) return { kind: 'same', places: 0 };
  return { kind: d > 0 ? 'up' : 'down', places: Math.abs(d) };
}

/** Movement between two checks: arrow + text, green when the page moved up (never colour alone). */
export function PositionMove({ prev, cur, digits = 0, className, showFirst }: { prev: number | null | undefined; cur: number | null | undefined; digits?: number; className?: string; showFirst?: boolean }) {
  const m = moveOf(prev, cur);
  const base = cn('relative inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium tabular', className);
  switch (m.kind) {
    case 'up':
      return (
        <span className={cn(base, 'text-good-text')} title={`Up ${m.places.toFixed(digits)} places`}>
          <ArrowUpRight className="size-3.5" aria-hidden />+{m.places.toFixed(digits)}
          <span className="sr-only"> places up</span>
        </span>
      );
    case 'down':
      return (
        <span className={cn(base, 'text-critical-text')} title={`Down ${m.places.toFixed(digits)} places`}>
          <ArrowDownRight className="size-3.5" aria-hidden />−{m.places.toFixed(digits)}
          <span className="sr-only"> places down</span>
        </span>
      );
    case 'entered':
      return prev == null && !showFirst ? (
        <span className={cn(base, 'text-ink-3')}>first check</span>
      ) : (
        <span className={cn(base, 'text-good-text')}>
          <ArrowUpRight className="size-3.5" aria-hidden />
          entered top 50
        </span>
      );
    case 'dropped':
      return (
        <span className={cn(base, 'text-critical-text')}>
          <ArrowDownRight className="size-3.5" aria-hidden />
          left top 50
        </span>
      );
    case 'same':
      return (
        <span className={cn(base, 'text-ink-3')}>
          <Minus className="size-3.5" aria-hidden />
          no change
        </span>
      );
    default:
      return <span className={cn(base, 'text-ink-3')}>–</span>;
  }
}

/** Sorting key for positions: unranked and unknown sink to the bottom. */
export const posSort = (p: number | null | undefined): number => (p == null || p < 0 ? 999 : p === 0 ? 500 : p);
