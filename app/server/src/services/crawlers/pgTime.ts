/**
 * The server's postgres client is drizzle's: it hands timestamps and dates back as Postgres text ("2026-10-16 06:25:01.5+00") and
 * refuses a JS Date as a parameter. Raw queries of the crawler module send ISO strings and read every time through this.
 */
export function pgDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  let s = String(v).trim().replace(' ', 'T');
  if (/[+-]\d{2}$/.test(s)) s += ':00';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
export const pgIso = (v: unknown): string | null => pgDate(v)?.toISOString() ?? null;
