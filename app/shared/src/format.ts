// Small formatting helpers used by the server (e-mails, titles) and the client (tiles, tables).

export function compactNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(abs >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (abs >= 1e4) return (n / 1e3).toFixed(abs >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return Math.round(n).toLocaleString('en-US');
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return '–';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** `value` is already a percentage (0-100) unless `ratio` is true (0-1). */
export function formatPercent(value: number | null | undefined, digits = 1, ratio = false): string {
  if (value == null || !Number.isFinite(value)) return '–';
  const v = ratio ? value * 100 : value;
  return v.toFixed(digits).replace(/\.0+$/, '') + '%';
}

export function formatUsd(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '–';
  return '$' + n.toFixed(digits);
}

/** Relative change in percent, null when there is no base. */
export function pctChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || !Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function titleCase(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Position for display: 0 = not in the top 50, negative = failed check, null = never checked. */
export function formatPosition(p: number | null | undefined): string {
  if (p == null) return '–';
  if (p < 0) return 'check failed';
  if (p === 0) return '>50';
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
}

export function splitList(s: string | null | undefined): string[] {
  return String(s ?? '')
    .split(/\s*,\s*|\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    const v = JSON.parse(s);
    return (v ?? fallback) as T;
  } catch {
    return fallback;
  }
}
