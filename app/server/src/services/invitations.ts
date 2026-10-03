import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import type { UserRow } from '../db/schema';

type InvitationRow = typeof schema.invitations.$inferSelect;

/** Adds the user to the invitation's company (keeps a higher existing role) and marks the invitation accepted. */
export async function acceptInvitation(inv: InvitationRow, user: UserRow): Promise<string> {
  await db.transaction(async (tx) => {
    const existing = await tx.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, inv.orgId), eq(schema.memberships.userId, user.id)) });
    if (!existing) await tx.insert(schema.memberships).values({ orgId: inv.orgId, userId: user.id, role: inv.role });
    await tx.update(schema.invitations).set({ acceptedAt: new Date() }).where(eq(schema.invitations.id, inv.id));
    // the invitation went to this address: it is confirmed
    if (!user.emailVerifiedAt) await tx.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, user.id));
  });
  return inv.orgId;
}
