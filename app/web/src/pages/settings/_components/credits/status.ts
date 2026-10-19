import { formatCredits, type BillingFeatureRow, type BillingOverview, type CreditLot, type CreditStatus } from '@seo/shared';
import type { Tone } from '@/components/ui/badge';
import { fmtDate } from '@/lib/utils';

// The words and tones of a company's credit standing (app/docs/CREDITS.md §1 "The guard"), shared by the Credits tab, the sidebar's
// balance pill and the banner across the company's pages, so the three never say different things. Pure: no React, no storage.

export const CREDIT_STATUS_LABEL: Record<CreditStatus, string> = {
  ok: 'Enough credits',
  low: 'Running low',
  critical: 'Almost out',
  empty: 'Out of credits',
  paused: 'Autopilot paused',
};

export const CREDIT_STATUS_TONE: Record<CreditStatus, Tone> = {
  ok: 'good',
  low: 'warning',
  critical: 'serious',
  empty: 'critical',
  paused: 'critical',
};

type Standing = Pick<BillingOverview, 'status' | 'enforced' | 'runwayDays' | 'runsOutOn' | 'limits' | 'month'>;

/** "about 4 days" / "about a day" / "less than a day" */
export function daysText(days: number): string {
  if (days < 1) return 'less than a day';
  const n = Math.floor(days);
  return n === 1 ? 'about a day' : `about ${n} days`;
}

/** The schedules are paused by the company's own autopilot limit (not by an empty balance). */
export function pausedByLimit(b: Pick<BillingOverview, 'status' | 'limits' | 'month'>): boolean {
  return b.status === 'paused' && b.limits.autopilotMonthly != null && b.month.autopilotUsed >= b.limits.autopilotMonthly;
}

/** The status chip's words: a company whose credits are only counted never reads "Out of credits". */
export function statusLabel(b: Pick<BillingOverview, 'status' | 'enforced' | 'limits' | 'month'>): string {
  if (b.status === 'paused' && pausedByLimit(b)) return 'Autopilot limit reached';
  if (!b.enforced && b.status !== 'paused') return 'Counted only';
  return CREDIT_STATUS_LABEL[b.status];
}

export function statusTone(b: Pick<BillingOverview, 'status' | 'enforced'>): Tone {
  if (!b.enforced && b.status !== 'paused') return 'neutral';
  return CREDIT_STATUS_TONE[b.status];
}

/**
 * The banner across the company's pages, or null when there is nothing to say. Low / critical / empty only matter when credits are
 * enforced (otherwise nothing stops); a pause matters always (the autopilot limit pauses any company).
 */
export function creditBanner(b: Standing): { tone: 'warning' | 'critical'; title: string; body: string } | null {
  if (b.status === 'paused') {
    return pausedByLimit(b)
      ? {
          tone: 'warning',
          title: 'Your websites\' automatic work is paused',
          body: `It used this month's autopilot limit of ${formatCredits(b.limits.autopilotMonthly)}. It resumes by itself on the 1st, or as soon as an owner raises the limit.`,
        }
      : {
          tone: 'critical',
          title: 'Your websites\' automatic work is paused: out of credits',
          body: 'Weekly reports, monitors and blog posts resume by themselves when credits are added.',
        };
  }
  if (!b.enforced) return null;
  if (b.status === 'empty')
    return {
      tone: 'critical',
      title: 'You are out of credits',
      body: 'New analyses cannot start, and your websites\' automatic work pauses until credits are added.',
    };
  const left = b.runwayDays != null ? daysText(b.runwayDays) : null;
  if (b.status === 'critical')
    return {
      tone: 'critical',
      title: left ? `Credits run out in ${left}` : 'Credits are almost used up',
      body: 'When they do, new analyses cannot start and your websites\' automatic work pauses until credits are added.',
    };
  if (b.status === 'low')
    return {
      tone: 'warning',
      title: 'Credits are running low',
      body: left ? `At your current use they last ${left}${b.runsOutOn ? ` and run out around ${fmtDate(b.runsOutOn)}` : ''}.` : 'Add credits so your websites\' automatic work keeps running.',
    };
  return null;
}

/** sessionStorage key of a dismissed banner: per company and per status, so a worse status shows again. */
export const bannerKey = (orgId: string, status: CreditStatus) => `alv-credit-banner:${orgId}:${status}`;

/** Usage by feature, one row per feature with its autopilot and on-demand parts, biggest first. */
export function featureTotals(rows: readonly BillingFeatureRow[]): { label: string; autopilot: number; onDemand: number; total: number; runs: number }[] {
  const by = new Map<string, { label: string; autopilot: number; onDemand: number; total: number; runs: number }>();
  for (const r of rows) {
    const cur = by.get(r.label) ?? { label: r.label, autopilot: 0, onDemand: 0, total: 0, runs: 0 };
    const c = Math.max(0, r.credits);
    if (r.origin === 'on_demand') cur.onDemand += c;
    else cur.autopilot += c;
    cur.total += c;
    cur.runs += r.runs;
    by.set(r.label, cur);
  }
  return [...by.values()].filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
}

const monthsBetween = (from: string, to: string) => {
  const a = new Date(from);
  const b = new Date(to);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
};

/**
 * How long credits last, read from the company's own lots (the overview carries no setting for it): a pack's months from its purchase
 * to its expiry, and whether plan credits run past the month they arrived in. null = no lot of that kind to read it from.
 */
export function lotTerms(lots: readonly CreditLot[]): { packMonths: number | null; planRolloverMonths: number | null } {
  const pack = lots.find((l) => l.source === 'pack' && l.expiresAt);
  const plan = lots.find((l) => l.source === 'plan' && l.expiresAt);
  return {
    packMonths: pack ? Math.max(1, monthsBetween(pack.createdAt, pack.expiresAt!)) : null,
    planRolloverMonths: plan ? Math.max(0, monthsBetween(plan.createdAt, plan.expiresAt!)) : null,
  };
}
