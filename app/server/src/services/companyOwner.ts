import { and, asc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../db';
import type { UserRow } from '../db/schema';

/**
 * The person the system acts for when it starts work on its own (a level-3 keyword, a research refresh, a queued-ladder re-check): the
 * company's first owner whose membership is active. A deactivated or suspended owner is never acted for (createRun would refuse a
 * suspended one anyway). null when the company has none.
 */
export async function ownerOf(orgId: string): Promise<UserRow | null> {
  const r = await db
    .select({ u: schema.users })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.role, 'owner'), isNull(schema.memberships.deactivatedAt), isNull(schema.users.suspendedAt)))
    .orderBy(asc(schema.memberships.createdAt))
    .limit(1);
  return r[0]?.u ?? null;
}
