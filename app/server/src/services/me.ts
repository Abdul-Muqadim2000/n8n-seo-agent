import { asc, eq } from 'drizzle-orm';
import type { Me, OrgSummary, Role } from '@seo/shared';
import { isPlatformAdmin } from '../auth/access';
import { toUser } from '../auth/session';
import { db, schema } from '../db';
import type { UserRow } from '../db/schema';

export async function buildMe(user: UserRow): Promise<Me> {
  const rows = await db
    .select({ org: schema.organizations, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(eq(schema.memberships.userId, user.id))
    .orderBy(asc(schema.organizations.name));
  const orgs: OrgSummary[] = rows.map((r) => ({
    id: r.org.id,
    name: r.org.name,
    slug: r.org.slug,
    role: r.role as Role,
    onboardingStep: r.org.onboardingStep,
    onboardedAt: r.org.onboardedAt?.toISOString() ?? null,
  }));
  return { user: toUser(user), orgs, platformAdmin: isPlatformAdmin(user) };
}
