import { count, eq } from 'drizzle-orm';
import type { Me, OrgSummary } from '@seo/shared';
import { orgSummaries } from './agency';
import { isPlatformAdmin } from '../auth/access';
import { toUser } from '../auth/session';
import { db, schema } from '../db';
import type { UserRow } from '../db/schema';

/** `portalOrgId`: on an agency's portal host only that agency and its client workspaces are listed (G5) */
export async function buildMe(user: UserRow, portalOrgId: string | null = null): Promise<Me> {
  const orgs: OrgSummary[] = await orgSummaries(user.id, portalOrgId);
  const keys = await db.select({ n: count() }).from(schema.webauthnCredentials).where(eq(schema.webauthnCredentials.userId, user.id));
  return { user: toUser(user, Number(keys[0]?.n ?? 0)), orgs, platformAdmin: isPlatformAdmin(user) };
}
