import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { policyOf, type Me, type OrgSummary, type Role } from '@seo/shared';
import { isPlatformAdmin } from '../auth/access';
import { toUser } from '../auth/session';
import { db, schema } from '../db';
import type { UserRow } from '../db/schema';

export async function buildMe(user: UserRow): Promise<Me> {
  const rows = await db
    .select({ org: schema.organizations, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(and(eq(schema.memberships.userId, user.id), isNull(schema.memberships.deactivatedAt)))
    .orderBy(asc(schema.organizations.name));
  const orgs: OrgSummary[] = rows.map((r) => ({
    id: r.org.id,
    name: r.org.name,
    slug: r.org.slug,
    role: r.role as Role,
    onboardingStep: r.org.onboardingStep,
    onboardedAt: r.org.onboardedAt?.toISOString() ?? null,
    requiresMfa: policyOf(r.org.securityPolicy).requireMfa,
  }));
  const keys = await db.select({ n: count() }).from(schema.webauthnCredentials).where(eq(schema.webauthnCredentials.userId, user.id));
  return { user: toUser(user, Number(keys[0]?.n ?? 0)), orgs, platformAdmin: isPlatformAdmin(user) };
}
