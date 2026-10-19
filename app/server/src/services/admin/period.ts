import type { AdminPeriod } from '@seo/shared';

/**
 * The one window every admin figure is computed over (UTC). `from` is inclusive, `to` exclusive; `from` null = since the beginning.
 * month = the calendar month to date, last_month = the whole previous calendar month, 7d / 30d / 90d = rolling windows ending now.
 */
export interface PeriodRange {
  period: AdminPeriod;
  from: Date | null;
  to: Date;
}

const DAY = 86_400_000;

export function periodRange(period: AdminPeriod, now: Date = new Date()): PeriodRange {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  switch (period) {
    case 'month':
      return { period, from: monthStart, to: now };
    case 'last_month':
      return { period, from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), to: monthStart };
    case '7d':
      return { period, from: new Date(now.getTime() - 7 * DAY), to: now };
    case '30d':
      return { period, from: new Date(now.getTime() - 30 * DAY), to: now };
    case '90d':
      return { period, from: new Date(now.getTime() - 90 * DAY), to: now };
    case 'all':
    default:
      return { period: 'all', from: null, to: now };
  }
}

/** true when `at` falls inside the range */
export const inRange = (r: PeriodRange, at: Date | null | undefined): boolean => !!at && (!r.from || at >= r.from) && at < r.to;

/** every UTC day (YYYY-MM-DD) from `from` to `to` (exclusive end), at most `max` days, oldest first */
export function daysOf(from: Date, to: Date, max = 400): string[] {
  const out: string[] = [];
  const end = to.getTime();
  // a window longer than `max` days keeps its most recent days
  const start = Math.max(from.getTime(), end - max * DAY);
  let d = Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth(), new Date(start).getUTCDate());
  while (d < end) {
    out.push(new Date(d).toISOString().slice(0, 10));
    d += DAY;
  }
  return out.slice(-max);
}
