// Pure helpers of the platform admin panel (/admin): the period in the URL, money / credit formatting, and the few figures the panel
// derives itself. No React here, so every rule is unit-tested (test/adminPanel.test.ts).
import { ADMIN_PERIODS, MODES, creditsFor, formatUsd, type AdminDailyPoint, type PlatformSettings, type AdminModeCost, type AdminPeriod, type AdminRunRow, type CostSplit, type ModeId } from '@seo/shared';

export const DEFAULT_PERIOD: AdminPeriod = 'month';

export const PERIOD_LABELS: Record<AdminPeriod, string> = {
  month: 'This month',
  last_month: 'Last month',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
};
/** the period selector's own labels (short enough for one segmented row) */
export const PERIOD_SHORT: Record<AdminPeriod, string> = { month: 'This month', last_month: 'Last month', '7d': '7d', '30d': '30d', '90d': '90d', all: 'All time' };

/** `?period=` from the URL; anything unknown falls back to this month. */
export function parsePeriod(v: string | null | undefined): AdminPeriod {
  return (ADMIN_PERIODS as readonly string[]).includes(v ?? '') ? (v as AdminPeriod) : DEFAULT_PERIOD;
}

/** an admin path carrying the period (left out for the default, so URLs stay short) */
export function withPeriod(path: string, period: AdminPeriod): string {
  if (period === DEFAULT_PERIOD) return path;
  return `${path}${path.includes('?') ? '&' : '?'}period=${period}`;
}

export const adminPaths = {
  overview: '/admin',
  companies: '/admin/companies',
  company: (id: string) => `/admin/companies/${id}`,
  users: '/admin/users',
  user: (id: string) => `/admin/users/${id}`,
  runs: '/admin/runs',
  costs: '/admin/costs',
  activity: '/admin/activity',
  settings: '/admin/settings',
};

const MINUS = '−';

/**
 * Dollars for the panel: 2 decimals, 4 under $1 (a run costs cents, and $0.0042 vs $0.0400 matters), thousands separated, a real minus
 * sign for losses. null / NaN = "–" (never $0.00 for a figure nobody measured).
 */
export function money(v: number | null | undefined, opts: { digits?: number } = {}): string {
  if (v == null || !Number.isFinite(v)) return '–';
  const abs = Math.abs(v);
  const digits = opts.digits ?? (abs > 0 && abs < 1 ? 4 : 2);
  // formatUsd's digits, with thousands separators (formatUsd itself has none)
  const s = abs >= 1000 ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}` : formatUsd(abs, digits);
  return v < 0 && Number(abs.toFixed(digits)) !== 0 ? MINUS + s : s;
}

/** money with a sign either way ("+$12.00", "−$3.50") — for changes and ledger amounts */
export function signedMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–';
  return v > 0 ? `+${money(v)}` : money(v);
}

/** Credits: up to 2 decimals, thousands separated. */
export function credits(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–';
  const s = Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return v < 0 && s !== '0' ? MINUS + s : s;
}

export function signedCredits(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '–';
  return v > 0 ? `+${credits(v)}` : credits(v);
}

/** "42.5%", or "no revenue" when the margin has no base */
export function marginPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'no revenue';
  const s = Math.abs(v).toFixed(1).replace(/\.0$/, '');
  return `${v < 0 && s !== '0' ? MINUS : ''}${s}%`;
}

/** billed ÷ attributed, "1.04×"; "–" when either side is missing */
export function ratioLabel(r: number | null | undefined): string {
  return r == null || !Number.isFinite(r) ? '–' : `${r.toFixed(2)}×`;
}

/** the share of Claude cost that is an estimate (0..1), null when there was no Claude cost */
export function estimatedShare(c: CostSplit | null | undefined): number | null {
  if (!c || !(c.claudeUsd > 0)) return null;
  return Math.max(0, Math.min(1, c.claudeEstimatedUsd / c.claudeUsd));
}

export function sumSplits(list: (CostSplit | null | undefined)[]): CostSplit {
  const out: CostSplit = { claudeUsd: 0, dataforseoUsd: 0, totalUsd: 0, claudeEstimatedUsd: 0 };
  for (const c of list) {
    if (!c) continue;
    out.claudeUsd += c.claudeUsd;
    out.dataforseoUsd += c.dataforseoUsd;
    out.totalUsd += c.totalUsd;
    out.claudeEstimatedUsd += c.claudeEstimatedUsd;
  }
  return out;
}

/** a mode id in words ("Write a page"), the raw id when it is not one of the app's modes (engine schedules) */
export function modeLabel(mode: string): string {
  return MODES[mode as ModeId]?.title ?? mode.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Cost by mode from a list of runs (the Costs page has no platform-wide endpoint for it): runs not settled yet are counted, not priced. */
export function aggregateByMode(rows: AdminRunRow[]): AdminModeCost[] {
  const by = new Map<string, AdminModeCost>();
  for (const r of rows) {
    const m = by.get(r.mode) ?? { mode: r.mode, runs: 0, cost: { claudeUsd: 0, dataforseoUsd: 0, totalUsd: 0, claudeEstimatedUsd: 0 }, credits: 0 };
    m.runs += 1;
    if (r.cost) m.cost = sumSplits([m.cost, r.cost]);
    m.credits += r.credits ?? 0;
    by.set(r.mode, m);
  }
  return [...by.values()].sort((a, b) => b.cost.totalUsd - a.cost.totalUsd || b.runs - a.runs);
}

/** "credits.granted" → "Credits granted", "user.sessions_revoked" → "User sessions revoked" */
export function actionLabel(action: string): string {
  const s = action.replace(/[._-]+/g, ' ').trim().toLowerCase();
  return s ? s[0]!.toUpperCase() + s.slice(1) : action;
}

/** A detail value of an activity row as short text (objects as compact JSON). */
export function detailText(v: unknown): string {
  if (v == null) return '–';
  if (typeof v === 'string') return v || '–';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Initials of a company or person for the row tile. */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

/** The y-axis of a money chart: cents when the scale is small, compact above. */
export function axisUsd(v: number): string {
  if (!Number.isFinite(v) || v === 0) return '$0';
  const a = Math.abs(v);
  if (a < 10) return `$${v.toFixed(2)}`; // one look on a small scale: $0.45, $0.90, $1.35
  if (a < 1000) return `$${Math.round(v)}`;
  return `$${(v / 1000).toFixed(a < 10000 ? 1 : 0).replace(/\.0$/, '')}K`;
}

/** What a credit preview says before a grant / adjust / refund is confirmed. */
export function balanceAfter(balance: number, kind: 'grant' | 'adjust' | 'refund', amount: number): number {
  if (!Number.isFinite(amount)) return balance;
  return Math.round((balance + (kind === 'adjust' ? amount : Math.abs(amount))) * 100) / 100;
}

/** The worked example under the pricing settings: what one run of a given cost uses and earns at these settings. */
export function workedExample(costUsd: number, s: Pick<PlatformSettings, 'creditValueUsd' | 'markup'>) {
  const used = creditsFor(costUsd, s);
  const listUsd = used * s.creditValueUsd;
  return { credits: used, listUsd, marginUsd: listUsd - costUsd, marginPct: listUsd > 0 ? ((listUsd - costUsd) / listUsd) * 100 : null };
}


/** Running totals of the daily points (cost by provider and revenue add up day by day; runs too), rounded to 4 decimals. */
export function cumulative(daily: AdminDailyPoint[]): AdminDailyPoint[] {
  let c = 0;
  let d = 0;
  let r = 0;
  let n = 0;
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  return daily.map((p) => {
    c += p.claudeUsd;
    d += p.dataforseoUsd;
    r += p.revenueUsd;
    n += p.runs;
    return { date: p.date, claudeUsd: r4(c), dataforseoUsd: r4(d), revenueUsd: r4(r), runs: n };
  });
}
