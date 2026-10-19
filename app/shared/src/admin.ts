import { z } from 'zod';
import { emailField } from './schemas';
import { creditPacksSchema, DEFAULT_CREDIT_PACKS, type CreditPack, type CreditPurchaseRequest } from './billing';

// ---------- Platform admin panel (/admin, 2026-10-18) ----------
// The contract between the server (`app/server/src/routes/admin.ts`) and the web panel (`app/web/src/pages/admin/`). Internal:
// only the people in PLATFORM_ADMIN_EMAILS reach it; customers never see these figures.
//
// Money words used throughout, so nothing on screen is ambiguous:
//   cost      what a customer's operations cost US at the providers, Claude (Anthropic) and DataForSEO, attributed run by run
//   billed    what the providers actually charged the platform (Anthropic Admin cost report, DataForSEO balance movement), platform-wide
//   revenue   money a customer paid, recorded by an admin when credits are granted (`paidUsd`); there is no card billing yet
//   margin    revenue − cost
// A credit is the customer-facing unit. A run uses `cost × markup ÷ creditValueUsd` credits (PlatformSettings), so the same run
// always uses the same credits whatever the provider later bills.

/** Which window a figure covers. `month` = the calendar month to date (UTC), `last_month` = the previous calendar month. */
export const ADMIN_PERIODS = ['month', 'last_month', '7d', '30d', '90d', 'all'] as const;
export type AdminPeriod = (typeof ADMIN_PERIODS)[number];
export const adminPeriodSchema = z.enum(ADMIN_PERIODS).default('month');

/** How sure a cost figure is. `measured` = the provider's own usage figure; `estimated` = priced by the engine from text / quotes. */
export type CostCertainty = 'measured' | 'partly estimated' | 'estimated' | 'not reported';

/** One amount split by provider. `totalUsd` = claudeUsd + dataforseoUsd. */
export interface CostSplit {
  claudeUsd: number;
  dataforseoUsd: number;
  totalUsd: number;
  /** the share of `claudeUsd` that is an estimate (streaming model calls report no usage), 0..claudeUsd */
  claudeEstimatedUsd: number;
}

/**
 * Every credit movement of a company (or the platform) over a period, each with the dollars behind it, what the admin panel's
 * Credits / USD switch shows (app/docs/CREDITS.md). Credits at their list value use the credit value in force when each was used.
 */
export interface CreditBook {
  /** bought: credits of grants that recorded a payment (packs), and the payments */
  bought: number;
  boughtUsd: number;
  /** given without a payment (welcome credits, promotions, goodwill), at list value */
  free: number;
  freeListUsd: number;
  /** plan months granted (their payment is invoiced outside the panel), at list value */
  plan: number;
  planListUsd: number;
  /** used by work (net of re-pricing and failed-run returns), at list value, and what that work cost us at the providers */
  used: number;
  usedListUsd: number;
  usedCostUsd: number;
  /** autopilot / on-demand split of `used` */
  usedAutopilot: number;
  usedOnDemand: number;
  /** given back by an admin refund */
  refunded: number;
  /** expired unused */
  expired: number;
  expiredListUsd: number;
  /** admin corrections (net, signed) */
  adjusted: number;
  /** what runs would have used beyond their quotes: not charged, the cost was ours */
  absorbed: number;
  absorbedListUsd: number;
  /** the balance NOW (whatever the period), at list value, what customers can still spend, and what serving it will cost us */
  remaining: number;
  remainingListUsd: number;
  remainingCostUsd: number;
  /** the rates the dollars were worked out with */
  creditValueUsd: number;
  markup: number;
}

/** Credits for one company over a period, plus its balance now. */
export interface CreditSummary {
  /** now, whatever the period: granted − used − adjusted down, all time */
  balance: number;
  grantedInPeriod: number;
  usedInPeriod: number;
  /** true: runs are refused when the balance cannot cover them; false: credits are counted but never block a run */
  enforced: boolean;  /** the period's movements with their dollars (the Credits / USD switch) */
  book: CreditBook;
}

export interface MoneySummary {
  cost: CostSplit;
  revenueUsd: number;
  /** revenueUsd − cost.totalUsd */
  marginUsd: number;
  /** marginUsd ÷ revenueUsd × 100, null when there was no revenue */
  marginPct: number | null;
  /** credits used × creditValueUsd: what the usage is worth at list price (whether or not it was paid for) */
  listValueUsd: number;
}

// ---------- overview ----------
export interface AdminDailyPoint {
  date: string; // YYYY-MM-DD (UTC)
  claudeUsd: number;
  dataforseoUsd: number;
  revenueUsd: number;
  runs: number;
}

/** What a provider really billed, when the panel can read it. `null` amounts = not readable; `note` says why in a sentence. */
export interface ProviderBill {
  provider: 'anthropic' | 'dataforseo';
  /** billed in the period, platform-wide; null when the provider could not be read */
  billedUsd: number | null;
  /** cost the panel attributed to runs in the same period (sum over companies + unattributed) */
  attributedUsd: number;
  /** billedUsd ÷ attributedUsd, null when either is missing or attributed is 0 */
  ratio: number | null;
  /** DataForSEO only: the account balance now */
  balanceUsd?: number | null;
  /** when this reading was taken (ISO) */
  asOf: string | null;
  source: 'provider' | 'engine-ledger' | 'unavailable';
  note: string;
}

export interface AdminOverview {
  period: AdminPeriod;
  from: string | null; // ISO, null for 'all'
  to: string; // ISO
  users: { total: number; newInPeriod: number; activeInPeriod: number; suspended: number };
  companies: { total: number; newInPeriod: number; disabled: number; withEnforcedCredits: number };
  sites: number;
  runs: { started: number; failed: number; inFlight: number };
  money: MoneySummary;
  /** cost the engine spent on runs it could not tie to any company (deleted sites, test runs, the engine's own checks) */
  unattributed: CostSplit;
  /** the part of `unattributed` that belonged to companies since deleted, and the revenue they had paid (kept as history) */
  deletedCompanies?: { cost: CostSplit; revenueUsd: number; creditsGranted: number };
  credits: { outstanding: number; grantedInPeriod: number; usedInPeriod: number; book: CreditBook };
  daily: AdminDailyPoint[];
  bills: ProviderBill[];
  /** where the cost figures came from and how fresh they are, in one sentence each */
  sources: { engineLedger: { ok: boolean; lastSyncAt: string | null; rows: number; note: string } };
  topCompanies: AdminCompanyRow[];
}

// ---------- companies ----------
export interface AdminCompanyRow {
  id: string;
  name: string;
  slug: string;
  kind: string;
  createdAt: string;
  disabled: boolean;
  members: number;
  sites: number;
  monthlyBudgetUsd: number;
  runs: number;
  failedRuns: number;
  lastRunAt: string | null;
  credits: CreditSummary;
  money: MoneySummary;
  /** credits granted on the 1st of every month (0 = no plan) */
  planMonthlyCredits: number;
}

export interface AdminMember {
  userId: string;
  email: string;
  name: string;
  role: string;
  joinedAt: string;
  suspended: boolean;
}

export interface AdminSiteRow {
  id: string;
  domain: string;
  verified: boolean;
  trackingStatus: string;
  createdAt: string;
  cost: CostSplit;
}

export interface AdminModeCost {
  mode: string;
  runs: number;
  cost: CostSplit;
  credits: number;
}

export interface CreditEntry {
  id: string;
  createdAt: string;
  /** grant = an admin added credits; adjust = an admin corrected the balance (+/-); usage = a run used them; refund = usage given back */
  kind: 'grant' | 'adjust' | 'usage' | 'refund' | 'expire' | 'plan';
  credits: number; // signed: grants positive, usage negative
  paidUsd: number; // revenue recorded with a grant (0 for free / promotional credits and for every other kind)
  note: string;
  /** usage: the run / engine row it came from, and `creditValueUsd` = the credit value in force when it was debited (its list value
   *  never moves with a later price change) */
  ref: {
    runId?: string | null;
    engineRunId?: string | null;
    mode?: string | null;
    domain?: string | null;
    creditValueUsd?: number | null;
    /** usage: autopilot (a schedule) or on_demand (someone started it) */
    origin?: 'autopilot' | 'on_demand' | null;
    /** grant / plan: where the credits came from (billing.ts CreditSource) */
    source?: string | null;
    /** usage: credits the run would have used beyond its quote (not charged) */
    absorbed?: number | null;
    /** a paid grant: the invoice issued for it */
    invoice?: { id: string; number: string } | null;
    /** grant / refund / adjust: whether the company was told by e-mail (the addresses), or why not */
    notified?: { to: string[]; at: string } | { skipped: string } | null;
    lots?: { lotId: string; credits: number }[];
    [k: string]: unknown;
  } | null;
  actor: string | null; // admin e-mail for grant / adjust / refund
  balanceAfter: number;
}

export interface AdminCompanyDetail extends AdminCompanyRow {
  members_: AdminMember[];
  sites_: AdminSiteRow[];
  byMode: AdminModeCost[];
  daily: AdminDailyPoint[];
  recentRuns: AdminRunRow[];
  creditEntries: CreditEntry[];
}

// ---------- users ----------
export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerified: boolean;
  mfa: boolean;
  hasPassword: boolean;
  google: boolean;
  suspended: boolean;
  platformAdmin: boolean;
  activeSessions: number;
  companies: { id: string; name: string; role: string }[];
  /** cost of runs this person started in the period (runs started by schedules belong to the company, not a person) */
  cost: CostSplit;
  runs: number;
}

// ---------- runs ----------
export interface AdminRunRow {
  id: string;
  orgId: string;
  orgName: string;
  siteDomain: string | null;
  userEmail: string | null;
  mode: string;
  title: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
  /** null when the run has not settled yet */
  cost: CostSplit | null;
  certainty: CostCertainty;
  credits: number | null;
  /** 'app' = started in the app or the API; 'schedule' = a weekly / daily automation of the engine */
  origin: 'app' | 'schedule';
}

export interface AdminRunsPage {
  rows: AdminRunRow[];
  total: number;
  nextCursor: string | null;
}

// ---------- settings + activity ----------
export interface PlatformSettings {
  /** list price of one credit, USD */
  creditValueUsd: number;
  /** credits a run uses = cost × markup ÷ creditValueUsd */
  markup: number;
  /** credits a newly created company starts with (0 = none) */
  signupCredits: number;
  /** whether a newly created company has credit enforcement on */
  enforceForNewCompanies: boolean;
  /** the packs customers can ask for (billing.ts) */
  creditPacks: CreditPack[];
  /** months a bought pack's credits last */
  packExpiryMonths: number;
  /** a plan's unused monthly credits stay one more month (else they expire at the end of their month) */
  planRollover: boolean;
  /** days welcome credits last (0 = they never expire) */
  signupExpiryDays: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface AdminActivityRow {
  id: string;
  at: string;
  actor: string;
  action: string; // e.g. 'credits.granted', 'user.suspended', 'user.created', 'settings.changed'
  target: { type: string; id: string | null; label: string };
  details: Record<string, unknown>;
}

// ---------- request bodies ----------
export const adminListQuerySchema = z.object({
  period: adminPeriodSchema,
  q: z.string().trim().max(200).optional(),
});

export const adminRunsQuerySchema = z.object({
  period: adminPeriodSchema,
  q: z.string().trim().max(200).optional(),
  orgId: z.string().uuid().optional(),
  status: z.enum(['all', 'failed', 'running', 'done']).default('all'),
  origin: z.enum(['all', 'app', 'schedule']).default('all'),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const ADMIN_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;

export const adminCreateUserSchema = z.object({
  email: emailField,
  name: z.string().trim().min(1, 'Enter a name').max(120),
  /** add the person to this company with this role; or create a new company with `newCompanyName` */
  orgId: z.string().uuid().optional(),
  newCompanyName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ADMIN_ROLES).default('member'),
  /** mark the address verified (the admin vouches for it); otherwise the person confirms it on first sign-in */
  markVerified: z.boolean().default(true),
});
/** the answer to a create: the person sets their own password through this link (no password is ever chosen for them) */
export interface AdminCreatedUser {
  user: AdminUserRow;
  setPasswordUrl: string;
  expiresInHours: number;
}

export const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  suspended: z.boolean().optional(),
  markVerified: z.literal(true).optional(),
});

export const adminMembershipSchema = z.object({
  orgId: z.string().uuid(),
  role: z.enum(ADMIN_ROLES),
});

export const adminCreditSchema = z
  .object({
    kind: z.enum(['grant', 'adjust', 'refund']),
    /** grant / refund: positive; adjust: positive or negative, never 0 */
    credits: z.number().finite().min(-1_000_000).max(1_000_000),
    paidUsd: z.number().finite().min(0).max(1_000_000).default(0),
    note: z.string().trim().max(500).default(''),
    /** grant: how long the credits last, 'pack' = the pack expiry (12 months), 'never', or a number of days */
    expires: z.union([z.enum(['pack', 'never']), z.number().int().min(1).max(3650)]).default('pack'),
    /** fulfils this purchase request (the customer's "Buy credits") */
    requestId: z.string().uuid().optional(),
    /** e-mail the company's owners and admins about the credits (a paid grant: with its invoice). An invoice is issued either way. */
    notify: z.boolean().default(true),
  })
  .refine((b) => b.credits !== 0, { message: 'Enter a number of credits', path: ['credits'] })
  .refine((b) => b.kind === 'adjust' || b.credits > 0, { message: 'Must be more than 0', path: ['credits'] })
  .refine((b) => b.kind === 'grant' || b.paidUsd === 0, { message: 'Only a grant records a payment', path: ['paidUsd'] });

export const adminCompanyUpdateSchema = z.object({
  monthlyBudgetUsd: z.number().min(0).max(100000).optional(),
  disabled: z.boolean().optional(),
  creditsEnforced: z.boolean().optional(),
  name: z.string().trim().min(2).max(120).optional(),
  /** the company's plan: credits granted on the 1st of every month (0 = no plan) */
  planMonthlyCredits: z.number().int().min(0).max(10_000_000).optional(),
});

export const platformSettingsSchema = z.object({
  creditValueUsd: z.number().min(0.001).max(1000),
  markup: z.number().min(1).max(100),
  signupCredits: z.number().min(0).max(1_000_000),
  enforceForNewCompanies: z.boolean(),
  creditPacks: creditPacksSchema.default(DEFAULT_CREDIT_PACKS),
  packExpiryMonths: z.number().int().min(1).max(60).default(12),
  planRollover: z.boolean().default(true),
  signupExpiryDays: z.number().int().min(0).max(3650).default(90),
});

export const DEFAULT_PLATFORM_SETTINGS: Omit<PlatformSettings, 'updatedAt' | 'updatedBy'> = {
  creditValueUsd: 0.05,
  markup: 3,
  signupCredits: 200,
  enforceForNewCompanies: true,
  creditPacks: DEFAULT_CREDIT_PACKS,
  packExpiryMonths: 12,
  planRollover: true,
  signupExpiryDays: 90,
};

/** Credits a run of this cost uses, at these settings (2 decimals, never negative). One formula for the server and the panel. */
export function creditsFor(costUsd: number, s: Pick<PlatformSettings, 'creditValueUsd' | 'markup'>): number {
  if (!Number.isFinite(costUsd) || costUsd <= 0 || s.creditValueUsd <= 0) return 0;
  return Math.round(((costUsd * s.markup) / s.creditValueUsd) * 100) / 100;
}

/** The answer to every sign-in of a suspended account, and to a session of one (HTTP 403 / 401, code `account_suspended`). */
export const ACCOUNT_SUSPENDED = { code: 'account_suspended', message: 'This account is suspended. Contact support.' } as const;

/** DELETE /api/admin/users/:id body: what to do with companies the person is the only member of (asked again when absent) */
export const adminDeleteUserSchema = z.object({
  soleCompanies: z.enum(['delete', 'keep']).optional(),
});

/** DELETE /api/admin/companies/:id body: the company's slug, typed to confirm */
export const adminDeleteCompanySchema = z.object({ confirm: z.string().trim().min(1, 'Type the company slug to confirm') });

export const adminActivityQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) });

/** POST /api/admin/costs/sync answer */
export interface AdminCostSyncResult {
  ok: boolean;
  ledgerReadable: boolean;
  ledgerRows: number;
  engineEvents: number;
  appEvents: number;
  keywordEvents: number;
  superseded: number;
  debits: number;
  note: string;
}

export const emptyCostSplit = (): CostSplit => ({ claudeUsd: 0, dataforseoUsd: 0, totalUsd: 0, claudeEstimatedUsd: 0 });

export const emptyCreditBook = (creditValueUsd = 0, markup = 0): CreditBook => ({
  bought: 0, boughtUsd: 0, free: 0, freeListUsd: 0, plan: 0, planListUsd: 0, used: 0, usedListUsd: 0, usedCostUsd: 0, usedAutopilot: 0, usedOnDemand: 0,
  refunded: 0, expired: 0, expiredListUsd: 0, adjusted: 0, absorbed: 0, absorbedListUsd: 0, remaining: 0, remainingListUsd: 0, remainingCostUsd: 0, creditValueUsd, markup,
});

/** two books together (the platform's total); the rates are the first's */
export function addCreditBooks(a: CreditBook, b: CreditBook): CreditBook {
  const out = { ...a };
  for (const k of Object.keys(a) as (keyof CreditBook)[]) if (k !== 'creditValueUsd' && k !== 'markup') out[k] = Math.round((a[k] + b[k]) * 10000) / 10000;
  return out;
}

/** A customer's "Buy credits" request, as the panel lists it (fulfilled with a grant that records the payment). */
export interface AdminPurchaseRequest extends CreditPurchaseRequest {
  orgId: string | null;
  orgName: string;
}
