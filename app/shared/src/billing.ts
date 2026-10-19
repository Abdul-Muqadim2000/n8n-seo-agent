import { z } from 'zod';

// ---------- Credits: what customers see and pay (app/docs/CREDITS.md) ----------
// Customers never see what a run costs US at the providers (Claude, DataForSEO). They see credits. A credit has a list price
// (`creditValueUsd`, default $0.05) and every operation uses `cost × markup ÷ creditValueUsd` credits (markup 3 = the provider cost
// plus a 2× margin), so the same run always uses the same credits whatever the provider bills later.
//
// Two kinds of spending, shown and limited separately:
//   autopilot   the website's schedules (weekly report, AI visibility, the daily AI pulse, AI growth, backlinks, link building, the
//               monthly audit, the blog posts of the content cadence) — forecast per month from the website's settings
//   on-demand   analyses someone starts in the app or through the API, and keyword checks — each quoted before it starts, held while it
//               runs, charged at what it really used and never more than the quote; a run that fails is not charged
//
// Credits arrive in lots, each with its own expiry (a plan's monthly credits roll over one month, packs last 12 months, refunds never
// expire), and are used soonest-expiring first.

/** Where a lot of credits came from. */
export const CREDIT_SOURCES = ['plan', 'pack', 'grant', 'signup', 'refund', 'adjust', 'migrated'] as const;
export type CreditSource = (typeof CREDIT_SOURCES)[number];

export const CREDIT_SOURCE_LABEL: Record<CreditSource, string> = {
  plan: 'Monthly plan credits',
  pack: 'Credit pack',
  grant: 'Credits added',
  signup: 'Welcome credits',
  refund: 'Credits returned',
  adjust: 'Correction',
  migrated: 'Balance carried over',
};

export interface CreditLot {
  id: string;
  source: CreditSource;
  credits: number;
  remaining: number;
  /** ISO; null = never expires */
  expiresAt: string | null;
  createdAt: string;
  note: string;
}

/** A pack a customer can buy. The price is the list price of its credits less its discount. */
export interface CreditPack {
  id: string;
  credits: number;
  /** 0..50; 0 = list price (the margin stays exactly at the markup) */
  discountPct: number;
}
export interface PricedPack extends CreditPack {
  priceUsd: number;
  /** price of one credit in this pack */
  perCreditUsd: number;
}

export const creditPackSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9_-]{1,40}$/, 'Lowercase letters, digits, - and _'),
  credits: z.number().int().min(10).max(10_000_000),
  discountPct: z.number().min(0).max(50).default(0),
});
export const creditPacksSchema = z.array(creditPackSchema).min(1).max(8);

export const DEFAULT_CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', credits: 500, discountPct: 0 },
  { id: 'standard', credits: 2000, discountPct: 0 },
  { id: 'large', credits: 5000, discountPct: 0 },
  { id: 'xl', credits: 20000, discountPct: 0 },
];

export function pricePack(p: CreditPack, creditValueUsd: number): PricedPack {
  const perCredit = creditValueUsd * (1 - Math.min(50, Math.max(0, p.discountPct)) / 100);
  return { ...p, priceUsd: Math.round(p.credits * perCredit * 100) / 100, perCreditUsd: Math.round(perCredit * 10000) / 10000 };
}

/** credits per US dollar of provider cost (markup ÷ credit value): 3 ÷ 0.05 = 60 */
export function creditRate(s: { creditValueUsd: number; markup: number }): number {
  return s.creditValueUsd > 0 ? s.markup / s.creditValueUsd : 0;
}

/** A credit figure for people: whole credits from 10 up, one decimal below, "<0.1" for a sliver, "0" for nothing. */
export function formatCredits(n: number | null | undefined, opts: { unit?: boolean; signed?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return '–';
  const abs = Math.abs(n);
  let s: string;
  if (abs === 0) s = '0';
  else if (abs < 0.1) s = '<0.1';
  else if (abs < 10) s = (Math.round(abs * 10) / 10).toString();
  else s = Math.round(abs).toLocaleString('en-US');
  const sign = n < 0 && s !== '0' ? '−' : opts.signed && n > 0 ? '+' : '';
  const unit = opts.unit === false ? '' : s === '1' ? ' credit' : ' credits';
  return sign + s + unit;
}

// ---------- the company's own limits ----------
export const creditLimitsSchema = z.object({
  /** most credits on-demand analyses may use in a calendar month; null = no limit of its own */
  onDemandMonthly: z.number().int().min(0).max(10_000_000).nullable().default(null),
  /** most credits the schedules may use in a calendar month; when reached they pause until the 1st; null = no limit */
  autopilotMonthly: z.number().int().min(0).max(10_000_000).nullable().default(null),
  /** on-demand analyses may not use the credits the schedules still need this month */
  reserveForAutopilot: z.boolean().default(true),
});
export type CreditLimits = z.infer<typeof creditLimitsSchema>;
export const DEFAULT_CREDIT_LIMITS: CreditLimits = creditLimitsSchema.parse({});

export function creditLimitsOf(v: unknown): CreditLimits {
  const r = creditLimitsSchema.safeParse(v ?? {});
  return r.success ? r.data : DEFAULT_CREDIT_LIMITS;
}

// ---------- status ----------
/** ok · low (lasts under a week) · critical (under 3 days) · empty (nothing left) · paused (schedules paused for credits) */
export type CreditStatus = 'ok' | 'low' | 'critical' | 'empty' | 'paused';
export const LOW_RUNWAY_DAYS = 7;
export const CRITICAL_RUNWAY_DAYS = 3;

/** How a balance stands, from what is available and the daily burn (credits a day). */
export function creditStatus(available: number, dailyBurn: number, paused = false): CreditStatus {
  if (paused) return 'paused';
  if (available <= 0) return 'empty';
  if (dailyBurn <= 0) return 'ok';
  const days = available / dailyBurn;
  return days < CRITICAL_RUNWAY_DAYS ? 'critical' : days < LOW_RUNWAY_DAYS ? 'low' : 'ok';
}

/** Days the balance lasts at the burn, null when nothing is being used. */
export function runwayDays(available: number, dailyBurn: number): number | null {
  if (!(dailyBurn > 0)) return null;
  return Math.max(0, Math.floor((available / dailyBurn) * 10) / 10);
}

export type CreditOrigin = 'autopilot' | 'on_demand';

// ---------- what the Credits page reads ----------
export interface BillingSiteRow {
  siteId: string;
  domain: string;
  /** what this website's schedules are forecast to use a month, from its settings */
  forecastMonthly: number;
  /** what they used this calendar month */
  usedThisMonth: number;
  /** schedules paused (by anybody) */
  paused: boolean;
  /** paused because credits ran out or the autopilot limit was reached — resumed automatically */
  pausedForCredits: boolean;
}

export interface BillingFeatureRow {
  key: string;
  label: string;
  origin: CreditOrigin;
  credits: number;
  runs: number;
}

export interface CreditPurchaseRequest {
  id: string;
  packId: string;
  credits: number;
  priceUsd: number;
  status: 'pending' | 'fulfilled' | 'cancelled';
  note: string;
  requestedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface BillingOverview {
  enforced: boolean;
  /** all lots together, minus anything used beyond them */
  balance: number;
  /** held by analyses still running (at their quote) */
  held: number;
  /** what the schedules still need this month (0 when the company does not reserve for them) */
  reservedForAutopilot: number;
  /** balance − held: what can be spent now (on-demand also leaves `reservedForAutopilot`) */
  available: number;
  /** what an on-demand analysis may use right now, all rules applied (limit, reserve, balance) */
  onDemandAvailable: number;
  status: CreditStatus;
  /** credits used a day: the schedules' forecast plus the last 30 days' on-demand average */
  dailyBurn: number;
  runwayDays: number | null;
  /** ISO date the balance runs out at the burn, null when it does not */
  runsOutOn: string | null;
  month: {
    /** YYYY-MM */
    month: string;
    autopilotUsed: number;
    onDemandUsed: number;
    autopilotForecast: number;
    /** the plan's monthly credits, null without a plan */
    planMonthly: number | null;
    /** ISO date the next plan credits arrive */
    planRenewsOn: string | null;
  };
  limits: CreditLimits;
  sites: BillingSiteRow[];
  byFeature: BillingFeatureRow[];
  daily: { date: string; autopilot: number; onDemand: number }[];
  lots: CreditLot[];
  /** credits expiring in the next 30 days, and the first date */
  expiringSoon: { credits: number; on: string } | null;
  packs: PricedPack[];
  requests: CreditPurchaseRequest[];
  creditValueUsd: number;
  /** how payment works today: 'request' = a request the Alaventra team confirms and invoices */
  checkout: 'request';
}

export interface CreditActivityRow {
  id: string;
  at: string;
  kind: 'usage' | 'refund' | 'grant' | 'adjust' | 'expire' | 'plan' | 'pack';
  /** signed: added positive, used negative */
  credits: number;
  origin: CreditOrigin | null;
  /** what it was, in words ("AI visibility · example.com", "Credit pack (2,000 credits)") */
  title: string;
  domain: string | null;
  runId: string | null;
  balanceAfter: number;
}

export interface CreditActivityPage {
  rows: CreditActivityRow[];
  nextCursor: string | null;
}

export const creditActivityQuerySchema = z.object({
  origin: z.enum(['all', 'autopilot', 'on_demand', 'account']).default('all'),
  cursor: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const creditPurchaseSchema = z.object({
  packId: z.string().trim().min(1).max(40),
  note: z.string().trim().max(500).default(''),
});

/** The words for an operation in the credit activity and breakdowns (engine modes and app modes). */
const FEATURE_LABEL: Record<string, string> = {
  keyword: 'Keyword report / page',
  content: 'Written page',
  verdict: 'Keyword verdict',
  discover: 'Keyword discovery',
  ladder: 'Keyword ladder',
  audit: 'Site audit',
  full: 'Full SEO report',
  site_audit: 'Technical audit',
  ai_visibility: 'AI visibility',
  ai_pulse: 'Daily AI pulse',
  ai_growth: 'AI growth',
  backlinks: 'Backlinks',
  link_builder: 'Link building',
  track: 'Weekly site report',
  site_tracker: 'Weekly site report',
  rank_tracker: 'Rank tracking',
  cadence: 'Blog posts',
  content_cadence: 'Blog posts',
  keyword_check: 'Keyword check',
  assess: 'Keyword check',
  describe: 'Reading your homepage',
  report: 'Keyword report',
  published: 'Publish check',
  case_study: 'Case study',
  page_watch: 'Page watch',
};
export function featureLabel(mode: string | null | undefined): string {
  const m = String(mode ?? '').trim();
  if (!m) return 'Analysis';
  return FEATURE_LABEL[m] ?? m.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Payload of the 402 an analysis gets when credits stop it (`HttpError.extra`). */
export interface CreditRefusal {
  creditsNeeded: number;
  creditsAvailable: number;
  /** which rule refused it */
  reason: 'balance' | 'reserve' | 'on_demand_limit';
}
