import { desc, eq, sql } from 'drizzle-orm';
import { emptyCreditBook, type CreditBook, type CreditEntry, type CreditSource } from '@seo/shared';
import { db, schema } from '../../db';
import type { CreditEntryRow, OrgRow } from '../../db/schema';
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
  /** a positive entry becomes a lot (billing: soonest-expiring first): where it came from and when it expires (default: by kind, never) */
  lot?: { source?: CreditSource; expiresAt?: Date | null };
  /** an `expire` entry: the lot it empties (it never draws on any other) */
  lotId?: string;
}

const LOT_SOURCE: Record<string, CreditSource> = { grant: 'grant', refund: 'refund', adjust: 'adjust', usage: 'refund', plan: 'plan' };

/**
 * Writes one entry and keeps the company's lots in step with it (one transaction, under the company's lock): a positive entry pays down
 * any debt first and the rest becomes a lot; a negative one draws on the lots still valid at its date, soonest-expiring first, and what
 * no lot covers becomes debt. With a `refKey` that was already used nothing is written and null comes back.
 */
export async function addCreditEntry(q: Q, e: NewCreditEntry): Promise<CreditEntryRow | null> {
  if (q === db) return db.transaction((tx) => addCreditEntry(tx, e));
  await (q as Tx).execute(sql`select pg_advisory_xact_lock(hashtext(${e.orgId}))`);
  const row = await insertEntry(q, e);
  if (row && row.credits !== 0) await applyToLots(q as Tx, row, e);
  return row;
}

async function applyToLots(tx: Tx, row: CreditEntryRow, e: NewCreditEntry): Promise<void> {
  const L = schema.creditLots;
  if (row.credits > 0) {
    // debt = what was used beyond every lot = Σ remaining − balance, measured before this entry
    const [sums] = await execRows<{ rem: number; bal: number }>(tx, sql`
      select coalesce((select sum(remaining) from ${L} where org_id = ${e.orgId}::uuid), 0)::float as rem,
             coalesce((select sum(credits) from ${schema.creditLedger} where org_id = ${e.orgId}::uuid and id <> ${row.id}::uuid), 0)::float as bal`);
    const debt = Math.max(0, r2(Number(sums?.rem ?? 0) - Number(sums?.bal ?? 0)));
    const remaining = r2(row.credits - Math.min(row.credits, debt));
    await tx.insert(L).values({
      orgId: e.orgId,
      source: e.lot?.source ?? LOT_SOURCE[row.kind] ?? 'grant',
      credits: row.credits,
      remaining,
      expiresAt: e.lot?.expiresAt ?? null,
      note: row.note,
      ledgerId: row.id,
      ...(e.at ? { createdAt: e.at } : {}),
    });
    return;
  }
  let need = r2(-row.credits);
  if (e.lotId) {
    await tx.update(L).set({ remaining: sql`greatest(0, ${L.remaining} - ${need})` }).where(eq(L.id, e.lotId));
    return;
  }
  const at = e.at ?? row.createdAt;
  const lots = await tx
    .select({ id: L.id, remaining: L.remaining })
    .from(L)
    .where(sql`${L.orgId} = ${e.orgId}::uuid and ${L.remaining} > 0 and (${L.expiresAt} is null or ${L.expiresAt} > ${at.toISOString()}::timestamptz)`)
    .orderBy(sql`${L.expiresAt} asc nulls last`, L.createdAt);
  const used: { lotId: string; credits: number }[] = [];
  for (const lot of lots) {
    if (need <= 0) break;
    const take = r2(Math.min(lot.remaining, need));
    await tx.update(L).set({ remaining: r2(lot.remaining - take) }).where(eq(L.id, lot.id));
    used.push({ lotId: lot.id, credits: take });
    need = r2(need - take);
  }
  if (used.length) await tx.update(schema.creditLedger).set({ ref: { ...((row.ref as Record<string, unknown>) ?? {}), lots: used } }).where(eq(schema.creditLedger.id, row.id));
}

async function insertEntry(q: Q, e: NewCreditEntry): Promise<CreditEntryRow | null> {
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
 * What the company's in-flight on-demand work holds, in credits: runs not failed and not yet settled into a cost event (the last 24
 * hours, a run that never reported a cost stops holding credits after a day), and keyword checks not yet settled. A run is held at its
 * quote (the most it can be charged); a finished run whose cost is known at that cost, never above the quote.
 */
export async function inFlightCredits(q: Q, orgId: string, s: { creditValueUsd: number; markup: number }): Promise<number> {
  const rate = s.creditValueUsd > 0 ? s.markup / s.creditValueUsd : 0;
  const [r] = await execRows<{ c: number }>(q, sql`
    select (
      coalesce((select sum(case
          when ru.actual_cost_usd is not null and not ru.actual_cost_partial and ru.status = 'completed'
            then least(ru.actual_cost_usd * ${rate}::float, coalesce(ru.quoted_credits, ru.actual_cost_usd * ${rate}::float))
          else coalesce(ru.quoted_credits, coalesce(ru.engine_cost_estimate_usd, ru.estimated_cost_usd) * ${rate}::float) end)
        from ${schema.runs} ru
        where ru.org_id = ${orgId} and ru.status <> 'failed' and ru.created_at > now() - interval '24 hours'
          and not exists (select 1 from ${schema.costEvents} ce where ce.run_id = ru.id)), 0)
      + coalesce((select sum(k.cost_usd) * ${rate}::float from ${schema.keywordChecks} k
        where k.org_id = ${orgId} and k.status in ('pending', 'done') and k.created_at > now() - interval '24 hours'
          and not exists (select 1 from ${schema.costEvents} ce where ce.event_key = 'kc:' || k.id::text)), 0)
    )::float as c`);
  return r2(Number(r?.c ?? 0));
}

// The credit check of a run / keyword check (balance, the credits kept for the schedules, the company's own limits) is
// services/billing.ts `creditCheck` / `assertCredits`.

/**
 * A company that was just created: credit enforcement as the platform settings say for new companies, and the sign-up credits as a
 * grant (no payment). An agency's client workspace takes the enforcement setting but no sign-up credits (an agency could otherwise
 * create workspaces for free credits).
 */
export async function applyNewCompanyCredits(q: Q, org: Pick<OrgRow, 'id' | 'kind'>): Promise<void> {
  const s = await settingsRow(q);
  if (s.enforceForNewCompanies) await q.update(schema.organizations).set({ creditsEnforced: true }).where(eq(schema.organizations.id, org.id));
  if (s.signupCredits > 0 && org.kind !== 'client')
    await addCreditEntry(q, {
      orgId: org.id,
      kind: 'grant',
      credits: s.signupCredits,
      paidUsd: 0,
      note: 'Welcome credits',
      ref: { source: 'signup' },
      refKey: `signup:${org.id}`,
      lot: { source: 'signup', expiresAt: s.signupExpiryDays > 0 ? new Date(Date.now() + s.signupExpiryDays * 86_400_000) : null },
    });
}

/** credits granted / used in a window, per company. `used` = what runs used (usage debits, re-pricing included; never below 0), an
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


/**
 * The admin panel's credit book (shared/src/admin.ts `CreditBook`) per company over a window: bought / free / plan / used / refunded /
 * expired / adjusted / absorbed, each with its dollars, and the balance now. Usage is valued at the credit value stored on each debit;
 * the cost of the used work is the provider cost of the events those debits came from (each event once, re-pricing ignored), so
 * capped and failed work count at what they really cost us. The null key holds deleted companies' entries.
 */
export async function creditBooks(from: Date | null, to: Date, s: { creditValueUsd: number; markup: number }): Promise<Map<string | null, CreditBook>> {
  const cv = s.creditValueUsd;
  const win = sql`created_at < ${tsv(to)} ${from ? sql`and created_at >= ${tsv(from)}` : sql``}`;
  const rows = await execRows<Record<string, number | string | null>>(db, sql`
    with l as (select org_id, kind, credits, paid_usd, ref, coalesce((ref->>'creditValueUsd')::float, ${cv}::float) as cv,
                 coalesce(ref->>'origin', case when ref->>'runId' is not null then 'on_demand' else 'autopilot' end) as origin
               from ${schema.creditLedger} where ${win})
    select org_id,
      coalesce(sum(credits) filter (where kind = 'grant' and paid_usd > 0), 0)::float as bought,
      coalesce(sum(paid_usd) filter (where kind = 'grant'), 0)::float as bought_usd,
      coalesce(sum(credits) filter (where kind = 'grant' and paid_usd = 0), 0)::float as free,
      coalesce(sum(credits * cv) filter (where kind = 'grant' and paid_usd = 0), 0)::float as free_list,
      coalesce(sum(credits) filter (where kind = 'plan'), 0)::float as plan,
      coalesce(sum(credits * cv) filter (where kind = 'plan'), 0)::float as plan_list,
      coalesce(-sum(credits) filter (where kind = 'usage'), 0)::float as used,
      coalesce(-sum(credits * cv) filter (where kind = 'usage'), 0)::float as used_list,
      coalesce(-sum(credits) filter (where kind = 'usage' and origin = 'autopilot'), 0)::float as used_auto,
      coalesce(-sum(credits) filter (where kind = 'usage' and origin = 'on_demand'), 0)::float as used_od,
      coalesce(sum(credits) filter (where kind = 'refund'), 0)::float as refunded,
      coalesce(-sum(credits) filter (where kind = 'expire'), 0)::float as expired,
      coalesce(-sum(credits * cv) filter (where kind = 'expire'), 0)::float as expired_list,
      coalesce(sum(credits) filter (where kind = 'adjust'), 0)::float as adjusted,
      coalesce(sum((ref->>'absorbed')::float) filter (where kind = 'usage'), 0)::float as absorbed,
      coalesce(sum((ref->>'absorbed')::float * cv) filter (where kind = 'usage'), 0)::float as absorbed_list
    from l group by org_id`);
  const costs = await execRows<{ org_id: string | null; usd: number }>(db, sql`
    select x.org_id, coalesce(sum(e.claude_usd + e.dataforseo_usd), 0)::float as usd from (
      select distinct org_id, substring(ref_key from 6) as ek from ${schema.creditLedger}
      where kind = 'usage' and ref_key ~ '^cost:(engine|run|kc):[^:]+$' and ${win}
    ) x join ${schema.costEvents} e on e.event_key = x.ek group by x.org_id`);
  const costOf = new Map(costs.map((c) => [c.org_id, Number(c.usd)]));
  const balances = await allBalances();
  const n = (v: unknown) => Number(v ?? 0);
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  const out = new Map<string | null, CreditBook>();
  const book = (org: string | null, r?: Record<string, number | string | null>): CreditBook => {
    const remaining = org ? (balances.get(org) ?? 0) : 0;
    const b = emptyCreditBook(cv, s.markup);
    if (r)
      Object.assign(b, {
        bought: r2(n(r.bought)), boughtUsd: r2(n(r.bought_usd)), free: r2(n(r.free)), freeListUsd: r4(n(r.free_list)), plan: r2(n(r.plan)), planListUsd: r4(n(r.plan_list)),
        used: r2(Math.max(0, n(r.used))), usedListUsd: r4(Math.max(0, n(r.used_list))), usedAutopilot: r2(Math.max(0, n(r.used_auto))), usedOnDemand: r2(Math.max(0, n(r.used_od))),
        refunded: r2(n(r.refunded)), expired: r2(n(r.expired)), expiredListUsd: r4(n(r.expired_list)), adjusted: r2(n(r.adjusted)),
        absorbed: r2(n(r.absorbed)), absorbedListUsd: r4(n(r.absorbed_list)),
      });
    b.usedCostUsd = r4(costOf.get(org) ?? 0);
    b.remaining = r2(remaining);
    b.remainingListUsd = r4(remaining * cv);
    b.remainingCostUsd = r4(s.markup > 0 ? (remaining * cv) / s.markup : 0);
    return b;
  };
  for (const r of rows) out.set((r.org_id as string | null) ?? null, book((r.org_id as string | null) ?? null, r));
  // a company with a balance but no movement in the window still has its remaining credits
  for (const org of balances.keys()) if (!out.has(org)) out.set(org, book(org));
  return out;
}
