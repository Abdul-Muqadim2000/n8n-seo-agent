import { desc, eq, sql } from 'drizzle-orm';
import { creditsFor, type CreditEntry } from '@seo/shared';
import { db, schema } from '../../db';
import type { CreditEntryRow, OrgRow } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { settingsRow } from './settings';
import { execRows, tsv } from './sqlRows';

// Credits (shared/src/admin.ts): a signed ledger per company. Grants and adjustments by platform admins, one `usage` debit per settled
// cost event (services/admin/costSync.ts), refunds. The balance is the sum of the entries, all time. Enforcement is per company
// (`organizations.credits_enforced`, off by default): with it off credits are counted and never block a run.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Q = typeof db | Tx;

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function creditBalance(q: Q, orgId: string): Promise<number> {
  const [r] = await q.select({ b: sql<number>`coalesce(sum(${schema.creditLedger.credits}), 0)::float` }).from(schema.creditLedger).where(eq(schema.creditLedger.orgId, orgId));
  return r2(Number(r?.b ?? 0));
}

export interface NewCreditEntry {
  orgId: string;
  kind: CreditEntry['kind'];
  credits: number;
  paidUsd?: number;
  note?: string;
  ref?: CreditEntry['ref'];
  /** idempotency: an entry with this key is written once, ever (null = always written) */
  refKey?: string | null;
  actor?: { userId: string | null; email: string } | null;
  at?: Date;
}

/** Writes one entry; with a `refKey` that was already used nothing is written and null comes back. */
export async function addCreditEntry(q: Q, e: NewCreditEntry): Promise<CreditEntryRow | null> {
  const rows = await q
    .insert(schema.creditLedger)
    .values({
      orgId: e.orgId,
      // the name as it is now, so the entry still reads after the company is deleted (org_id then becomes null)
      orgName: sql`coalesce((select name from ${schema.organizations} where id = ${e.orgId}::uuid), '')`,
      kind: e.kind,
      credits: r2(e.credits),
      paidUsd: e.paidUsd ?? 0,
      note: e.note ?? '',
      ref: (e.ref ?? null) as Record<string, unknown> | null,
      refKey: e.refKey ?? null,
      actorUserId: e.actor?.userId ?? null,
      actorEmail: e.actor?.email ?? null,
      ...(e.at ? { createdAt: e.at } : {}),
    })
    .onConflictDoNothing({ target: schema.creditLedger.refKey, where: sql`${schema.creditLedger.refKey} is not null` })
    .returning();
  return rows[0] ?? null;
}

export const toCreditEntry = (r: CreditEntryRow, balanceAfter: number): CreditEntry => ({
  id: r.id,
  createdAt: r.createdAt.toISOString(),
  kind: r.kind as CreditEntry['kind'],
  credits: r.credits,
  paidUsd: r.paidUsd,
  note: r.note,
  ref: (r.ref as CreditEntry['ref']) ?? null,
  actor: r.actorEmail ?? null,
  balanceAfter: r2(balanceAfter),
});

/** The company's entries, newest first, each with the balance right after it. */
export async function listCreditEntries(orgId: string, limit = 200): Promise<CreditEntry[]> {
  const rows = await execRows<{ id: string; balance_after: number }>(db, sql`
    select id, sum(credits) over (order by seq rows between unbounded preceding and current row)::float as balance_after
    from ${schema.creditLedger} where org_id = ${orgId}`);
  const after = new Map(rows.map((r) => [r.id, Number(r.balance_after)]));
  const entries = await db.query.creditLedger.findMany({ where: eq(schema.creditLedger.orgId, orgId), orderBy: desc(schema.creditLedger.seq), limit });
  return entries.map((e) => toCreditEntry(e, after.get(e.id) ?? 0));
}

/**
 * What the company's in-flight work already holds, in credits: runs not failed and not yet settled into a cost event (the last 24
 * hours — a run that never reported a cost stops holding credits after a day), and keyword checks not yet settled. Each is held at
 * its best estimate (the engine's, else the app's).
 */
export async function inFlightCredits(q: Q, orgId: string, s: { creditValueUsd: number; markup: number }): Promise<number> {
  const [r] = await execRows<{ usd: number }>(q, sql`
    select (
      coalesce((select sum(case when ru.actual_cost_usd is not null and not ru.actual_cost_partial and ru.status = 'completed' then ru.actual_cost_usd
                                else coalesce(ru.engine_cost_estimate_usd, ru.estimated_cost_usd) end)
        from ${schema.runs} ru
        where ru.org_id = ${orgId} and ru.status <> 'failed' and ru.created_at > now() - interval '24 hours'
          and not exists (select 1 from ${schema.costEvents} ce where ce.run_id = ru.id)), 0)
      + coalesce((select sum(k.cost_usd) from ${schema.keywordChecks} k
        where k.org_id = ${orgId} and k.status in ('pending', 'done') and k.created_at > now() - interval '24 hours'
          and not exists (select 1 from ${schema.costEvents} ce where ce.event_key = 'kc:' || k.id::text)), 0)
    )::float as usd`);
  return creditsFor(Number(r?.usd ?? 0), s);
}

/**
 * The credit check of a run / keyword check, inside the transaction that holds the company's lock (spend.ts `lockCompany`), so two
 * parallel starts cannot both spend the same credits. Nothing happens unless the company's credits are enforced.
 */
export interface CreditCheck {
  enforced: boolean;
  /** credits this work would use at its estimate */
  needed: number;
  /** balance minus what in-flight work holds */
  available: number;
  held: number;
  /** false only when enforced and the credits cannot cover it */
  enough: boolean;
}

/** Whether the company's credits cover work estimated at `estimatedUsd` (the dry run of the API answers it as is). */
export async function creditCheck(q: Q, org: Pick<OrgRow, 'id' | 'creditsEnforced'>, estimatedUsd: number): Promise<CreditCheck> {
  const s = await settingsRow(q);
  const needed = estimatedUsd > 0 ? creditsFor(estimatedUsd, s) : 0;
  const balance = await creditBalance(q, org.id);
  const held = await inFlightCredits(q, org.id, s);
  const available = r2(balance - held);
  return { enforced: org.creditsEnforced, needed, available, held, enough: !org.creditsEnforced || needed <= 0 || needed <= available };
}

export async function assertCredits(tx: Tx, org: OrgRow, estimatedUsd: number, what: string): Promise<void> {
  if (!org.creditsEnforced || !(estimatedUsd > 0)) return;
  const { needed: need, available, held, enough } = await creditCheck(tx, org, estimatedUsd);
  if (!enough)
    throw new HttpError(
      402,
      available <= 0
        ? `Your company has no credits left for ${what.toLowerCase()} (it needs about ${need} credits${held > 0 ? `; ${held} are held by work still running` : ''}). Ask the platform administrator for more credits.`
        : `Your company has no credits left for ${what.toLowerCase()}: it needs about ${need} credits and ${available} are available${held > 0 ? ` (${held} more are held by work still running)` : ''}. Ask the platform administrator for more credits.`,
      'credits',
      undefined,
      { creditsNeeded: need, creditsAvailable: available },
    );
}

/**
 * A company that was just created: credit enforcement as the platform settings say for new companies, and the sign-up credits as a
 * grant (no payment). An agency's client workspace takes the enforcement setting but no sign-up credits (an agency could otherwise
 * create workspaces for free credits).
 */
export async function applyNewCompanyCredits(q: Q, org: Pick<OrgRow, 'id' | 'kind'>): Promise<void> {
  const s = await settingsRow(q);
  if (s.enforceForNewCompanies) await q.update(schema.organizations).set({ creditsEnforced: true }).where(eq(schema.organizations.id, org.id));
  if (s.signupCredits > 0 && org.kind !== 'client')
    await addCreditEntry(q, { orgId: org.id, kind: 'grant', credits: s.signupCredits, paidUsd: 0, note: 'Sign-up credits', refKey: `signup:${org.id}` });
}

/** credits granted / used in a window, per company. `used` = what runs used (usage debits, re-pricing included; never below 0) — an
 *  admin's refund gives credits back to the balance but is not "negative usage". `listValueUsd` = each usage debit at the credit value
 *  in force when it was debited (stored on the entry), so a later price change never restates past usage; entries written before the
 *  value was stored fall back to `currentCreditValueUsd`. The null key holds the entries of deleted companies (their revenue stays in
 *  the platform's totals). */
export async function creditTotals(
  from: Date | null,
  to: Date,
  currentCreditValueUsd: number,
): Promise<Map<string | null, { granted: number; used: number; paid: number; listValueUsd: number }>> {
  const rows = await execRows<{ org_id: string | null; granted: number; used: number; paid: number; list_value: number }>(db, sql`
    select org_id,
      coalesce(sum(credits) filter (where kind = 'grant'), 0)::float as granted,
      (-coalesce(sum(credits) filter (where kind = 'usage'), 0))::float as used,
      coalesce(sum(paid_usd) filter (where kind = 'grant'), 0)::float as paid,
      (-coalesce(sum(credits * coalesce((ref->>'creditValueUsd')::float, ${currentCreditValueUsd}::float)) filter (where kind = 'usage'), 0))::float as list_value
    from ${schema.creditLedger}
    where created_at < ${tsv(to)} ${from ? sql`and created_at >= ${tsv(from)}` : sql``}
    group by org_id`);
  return new Map(
    rows.map((r) => [
      r.org_id,
      { granted: r2(Number(r.granted)), used: r2(Math.max(0, Number(r.used))), paid: Number(r.paid), listValueUsd: r2(Math.max(0, Number(r.list_value))) },
    ]),
  );
}

export async function allBalances(): Promise<Map<string, number>> {
  const rows = await execRows<{ org_id: string; b: number }>(db, sql`select org_id, sum(credits)::float as b from ${schema.creditLedger} where org_id is not null group by org_id`);
  return new Map(rows.map((r) => [r.org_id, r2(Number(r.b))]));
}

