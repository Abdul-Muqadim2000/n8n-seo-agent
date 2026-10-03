import { and, eq, gte, ne, sql } from 'drizzle-orm';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow } from '../db/schema';
import { HttpError } from '../lib/errors';

// A company's estimated spend: its runs (estimated cost, failed runs excluded) plus its keyword checks (pending ones at the estimate,
// done ones at the engine's reported cost, failed ones free). Used by the budget checks (runs, keyword checks), the usage endpoint,
// the platform admin list and the Pipeline's summary. The checks run inside a transaction that holds the company's advisory lock,
// so parallel requests cannot all pass the same check.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Q = typeof db | Tx;

export function monthStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function dayStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** The company's runs and keyword checks since `since` (default: this month). */
export async function orgSpendSince(q: Q, orgId: string, since = monthStart()): Promise<{ runs: number; checks: number; total: number }> {
  const [r] = await q
    .select({ total: sql<number>`coalesce(sum(${schema.runs.estimatedCostUsd}), 0)` })
    .from(schema.runs)
    .where(and(eq(schema.runs.orgId, orgId), gte(schema.runs.createdAt, since), ne(schema.runs.status, 'failed')));
  const [c] = await q
    .select({ total: sql<number>`coalesce(sum(${schema.keywordChecks.costUsd}), 0)` })
    .from(schema.keywordChecks)
    .where(and(eq(schema.keywordChecks.orgId, orgId), gte(schema.keywordChecks.createdAt, since), ne(schema.keywordChecks.status, 'failed')));
  const runs = Number(r?.total ?? 0);
  const checks = Number(c?.total ?? 0);
  return { runs, checks, total: runs + checks };
}

/** Every company together since `since` (the platform's daily ceiling). */
export async function platformSpendSince(q: Q, since: Date): Promise<number> {
  const [r] = await q
    .select({ total: sql<number>`coalesce(sum(${schema.runs.estimatedCostUsd}), 0)` })
    .from(schema.runs)
    .where(and(gte(schema.runs.createdAt, since), ne(schema.runs.status, 'failed')));
  const [c] = await q
    .select({ total: sql<number>`coalesce(sum(${schema.keywordChecks.costUsd}), 0)` })
    .from(schema.keywordChecks)
    .where(and(gte(schema.keywordChecks.createdAt, since), ne(schema.keywordChecks.status, 'failed')));
  return Number(r?.total ?? 0) + Number(c?.total ?? 0);
}

/** This month's estimated spend of the company (runs + keyword checks). */
export async function monthSpend(orgId: string): Promise<number> {
  return (await orgSpendSince(db, orgId)).total;
}

/**
 * Whether something that costs about `estimated` may start: over the company's monthly budget → 402, over the platform's daily
 * ceiling → 429, else null. `what` names it in the message ("This run", "This keyword check").
 */
export function budgetRefusal(o: { what: string; estimated: number; spent: number; budget: number; platformToday: number; platformDaily: number }): HttpError | null {
  if (o.estimated <= 0) return null;
  if (o.spent + o.estimated > o.budget)
    return new HttpError(
      402,
      `${o.what} (about $${o.estimated.toFixed(2)}) would go over your company's monthly budget ($${o.spent.toFixed(2)} of $${o.budget.toFixed(2)} used). An owner can raise the budget in Settings → Usage, or ask the platform administrator.`,
      'budget',
    );
  if (o.platformToday + o.estimated > o.platformDaily)
    return new HttpError(429, "The platform has reached today's analysis capacity. Please try again tomorrow, or ask the platform administrator.", 'platform_capacity');
  return null;
}

/** Takes the company's advisory lock for the rest of the transaction (budget checks and their insert happen under it). */
export async function lockCompany(tx: Tx, orgId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${orgId}))`);
}

/** The budget check inside a transaction that holds the company's lock: throws 402 / 429. */
export async function assertBudget(tx: Tx, org: OrgRow, estimated: number, what: string): Promise<void> {
  if (estimated <= 0) return;
  const spent = (await orgSpendSince(tx, org.id)).total;
  const platformToday = await platformSpendSince(tx, dayStart());
  const refusal = budgetRefusal({ what, estimated, spent, budget: org.monthlyBudgetUsd, platformToday, platformDaily: config.platformDailySpendUsd });
  if (refusal) throw refusal;
}
