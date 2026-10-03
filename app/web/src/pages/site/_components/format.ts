// Formatting and small data helpers shared by the site dashboard pages.
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { formatPercent, pctChange } from '@seo/shared';

/** A value that is already a percentage (0-100). */
export const pct = (v: number | null | undefined, digits = 1) => formatPercent(v, digits);
/** A ratio (0-1), e.g. Search Console CTR. */
export const ratioPct = (v: number | null | undefined, digits = 1) => formatPercent(v, digits, true);
export { pctChange };

const toDate = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = parseISO(v);
  return isValid(d) ? d : null;
};

/** "Oct 2026" for "2026-10" or a full date. */
export function fmtMonth(v: string | null | undefined): string {
  const d = toDate(v);
  return d ? format(d, 'MMM yyyy') : (v ?? '–');
}

/** "Oct '26" — compact month for chart axes. */
export function fmtMonthShort(v: unknown): string {
  const d = toDate(typeof v === 'string' ? v : null);
  return d ? format(d, "MMM ''yy") : String(v ?? '');
}

/**
 * Axis / tooltip formatter for a series of timestamps: "3 Oct", or "3 Oct, 14:05" when two points fall on the same day
 * (several audits or checks in one day would otherwise read "2 Oct 2 Oct 2 Oct").
 */
export function timeAxisFormat(values: readonly (string | null | undefined)[]): (v: unknown) => string {
  const days = values.map((v) => String(v ?? '').slice(0, 10)).filter(Boolean);
  const clash = new Set(days).size < days.length;
  return (v: unknown) => {
    const d = toDate(typeof v === 'string' ? v : null);
    if (!d) return String(v ?? '');
    return format(d, clash ? 'd MMM, HH:mm' : 'd MMM');
  };
}

/** Full date for lists, with the time when another entry shares the day. */
export function dateLabelFormat(values: readonly (string | null | undefined)[]): (v: string | null | undefined) => string {
  const days = values.map((v) => String(v ?? '').slice(0, 10)).filter(Boolean);
  const clash = new Set(days).size < days.length;
  return (v) => {
    const d = toDate(v);
    return d ? format(d, clash ? 'd MMM yyyy, HH:mm' : 'd MMM yyyy') : '–';
  };
}

/** "3 Oct – 30 Oct 2026" */
export function fmtRange(start: string | null | undefined, end: string | null | undefined): string {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return '–';
  const sameYear = a.getFullYear() === b.getFullYear();
  return `${format(a, sameYear ? 'd MMM' : 'd MMM yyyy')} – ${format(b, 'd MMM yyyy')}`;
}

export function daysSince(v: string | null | undefined): number | null {
  const d = toDate(v);
  return d ? differenceInCalendarDays(new Date(), d) : null;
}

/** Sort a copy oldest first by a date-ish string. */
export function sortByDate<T>(rows: readonly T[], get: (r: T) => string | null | undefined, dir: 'asc' | 'desc' = 'asc'): T[] {
  const t = (r: T) => {
    const d = toDate(get(r) ?? null);
    return d ? d.getTime() : 0;
  };
  return [...rows].sort((a, b) => (dir === 'asc' ? t(a) - t(b) : t(b) - t(a)));
}

/** Last and second-to-last of an ascending series. */
export function lastTwo<T>(asc: readonly T[]): [T | null, T | null] {
  return [asc.length ? asc[asc.length - 1] : null, asc.length > 1 ? asc[asc.length - 2] : null];
}

/** Absolute difference, null when either side is missing. */
export function diff(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  return cur - prev;
}

/** "/pricing" for "https://www.example.com/pricing" (the n8n sandbox rule applies here too: no URL constructor needed). */
export function urlPath(url: string | null | undefined): string {
  if (!url) return '';
  const m = /^https?:\/\/[^/]+(\/.*)?$/i.exec(url.trim());
  if (!m) return url;
  return m[1] && m[1] !== '' ? m[1] : '/';
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return '';
  const m = /^https?:\/\/([^/?#]+)/i.exec(url.trim());
  return m ? m[1].replace(/^www\./, '') : url;
}

export const isUrl = (s: string | null | undefined): s is string => !!s && /^https?:\/\//i.test(s);

/** A plural noun: plural(3, 'page') → "3 pages". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

export function uniq<T>(xs: readonly T[]): T[] {
  return [...new Set(xs)];
}

/** Count rows by a key. */
export function countBy<T>(rows: readonly T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = key(r);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
