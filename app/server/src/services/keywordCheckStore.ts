import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { KEYWORD_CHECK } from '@seo/shared';
import { db, schema } from '../db';
import type { KeywordCheckRow, OrgRow, SiteRow, UserRow } from '../db/schema';
import { HttpError } from '../lib/errors';
import { config } from '../config';
import { budgetRefusal, dayStart, lockCompany, orgSpendSince, platformSpendSince } from './spend';

// The keyword_checks rows (keywordChecks.ts decides; this file only reads and writes the database).

/** The stored answer of the same website, keyword and country since `since` (newest), or null. */
export async function findRecentCheck(siteId: string, keyword: string, country: string, since: Date): Promise<KeywordCheckRow | null> {
  const row = await db.query.keywordChecks.findFirst({
    where: and(
      eq(schema.keywordChecks.siteId, siteId),
      eq(schema.keywordChecks.keyword, keyword),
      eq(schema.keywordChecks.country, country),
      eq(schema.keywordChecks.status, 'done'),
      gte(schema.keywordChecks.createdAt, since),
    ),
    orderBy: desc(schema.keywordChecks.createdAt),
  });
  return row ?? null;
}

/** A check of the same website and keyword started less than a minute ago and still going. */
async function runningCheck(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], siteId: string, keyword: string): Promise<boolean> {
  const rows = await tx
    .select({ id: schema.keywordChecks.id })
    .from(schema.keywordChecks)
    .where(
      and(
        eq(schema.keywordChecks.siteId, siteId),
        eq(schema.keywordChecks.keyword, keyword),
        eq(schema.keywordChecks.status, 'pending'),
        gte(schema.keywordChecks.createdAt, new Date(Date.now() - KEYWORD_CHECK.timeoutMs - 15_000)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Whether a new check may start (pure): the same keyword is being checked → 409; the company's daily limit (every check started today,
 * UTC, failed ones included) → 429; then the monthly budget (402) and the platform's daily ceiling (429) with the check's estimate.
 */
export function checkRefusal(o: { keyword: string; running: boolean; today: number; spent: number; budget: number; platformToday: number; platformDaily: number }): HttpError | null {
  if (o.running) return new HttpError(409, `“${o.keyword}” is being checked right now. Its answer appears in a few seconds.`, 'check_running');
  if (o.today >= KEYWORD_CHECK.perCompanyPerDay)
    return new HttpError(
      429,
      `Your company has used today's ${KEYWORD_CHECK.perCompanyPerDay} keyword checks. Try again tomorrow, or pick one of the recommended keywords (they are free).`,
      'check_limit',
    );
  return budgetRefusal({ what: 'This keyword check', estimated: KEYWORD_CHECK.estimateUsd, spent: o.spent, budget: o.budget, platformToday: o.platformToday, platformDaily: o.platformDaily });
}

/**
 * Reserves a check under the company's lock (checkRefusal on the current counts and spend), then a 'pending' row holding the
 * estimate in the budget until the answer arrives. Returns its id.
 */
export async function reserveCheck(o: { org: OrgRow; site: SiteRow; user: UserRow; keyword: string; country: string }): Promise<string> {
  return db.transaction(async (tx) => {
    await lockCompany(tx, o.org.id);
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.keywordChecks)
      .where(and(eq(schema.keywordChecks.orgId, o.org.id), gte(schema.keywordChecks.createdAt, dayStart())));
    const refusal = checkRefusal({
      keyword: o.keyword,
      running: await runningCheck(tx, o.site.id, o.keyword),
      today: Number(n),
      spent: (await orgSpendSince(tx, o.org.id)).total,
      budget: o.org.monthlyBudgetUsd,
      platformToday: await platformSpendSince(tx, dayStart()),
      platformDaily: config.platformDailySpendUsd,
    });
    if (refusal) throw refusal;
    const [row] = await tx
      .insert(schema.keywordChecks)
      .values({ orgId: o.org.id, siteId: o.site.id, userId: o.user.id, keyword: o.keyword, country: o.country, status: 'pending', costUsd: KEYWORD_CHECK.estimateUsd })
      .returning({ id: schema.keywordChecks.id });
    return row.id;
  });
}

/** The engine's answer and its reported cost. */
export async function finishCheck(id: string, result: Record<string, unknown>, costUsd: number): Promise<KeywordCheckRow> {
  const [row] = await db.update(schema.keywordChecks).set({ status: 'done', result, costUsd }).where(eq(schema.keywordChecks.id, id)).returning();
  return row;
}

/** No answer: removed when the engine never worked on it (nothing to count), else kept as failed (counted in the daily limit, free). */
export async function dropCheck(id: string, reachedEngine: boolean): Promise<void> {
  if (!reachedEngine) await db.delete(schema.keywordChecks).where(eq(schema.keywordChecks.id, id));
  else await db.update(schema.keywordChecks).set({ status: 'failed', costUsd: 0 }).where(eq(schema.keywordChecks.id, id));
}

/** The website's answered checks of the last `days` days (newest first): topic fit for auto-start. */
export async function recentChecks(siteId: string, days: number): Promise<KeywordCheckRow[]> {
  return db.query.keywordChecks.findMany({
    where: and(eq(schema.keywordChecks.siteId, siteId), inArray(schema.keywordChecks.status, ['done']), gte(schema.keywordChecks.createdAt, new Date(Date.now() - days * 864e5))),
    orderBy: desc(schema.keywordChecks.createdAt),
    limit: 200,
  });
}
