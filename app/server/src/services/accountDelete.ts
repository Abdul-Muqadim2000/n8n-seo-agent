import { count, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { AccountDeletionCompany, AccountDeletionPlan } from '@seo/shared';
import { isPlatformAdmin } from '../auth/access';
import { db, schema } from '../db';
import type { OrgRow, UserRow } from '../db/schema';
import { audit, type AuditActor } from './audit';
import { deleteCompany } from './companyDelete';

// CR17-B (client report 2026-11-17, C1): ONE way an account is deleted, used by the platform administrator (services/admin/users.ts
// deleteUser) and by the person themselves (DELETE /api/me). The rules:
//   - refused while the person is the only owner of a company that has other members (make another member owner, or delete the company)
//   - a company the person owns and is the ONLY member of is deleted with the account (the self-service path), or kept without members (the admin's
//     choice), through the company delete service, so its websites stop in the engine and their engine history is deleted too
//   - an agency with client workspaces is never deleted this way (its client workspaces go first)
//   - the person's other memberships go with the account; each of those companies keeps an audit entry of it

const lite = (o: OrgRow): AccountDeletionCompany => ({ id: o.id, name: o.name, slug: o.slug });

/** What deleting this account would do and what stands in the way, read before anything changes. */
export async function planAccountDeletion(user: UserRow): Promise<{ plan: AccountDeletionPlan; sole: OrgRow[] }> {
  const mine = await db
    .select({ org: schema.organizations, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(eq(schema.memberships.userId, user.id));
  const soleOwnerOf: AccountDeletionCompany[] = [];
  const sole: OrgRow[] = [];
  for (const { org, role } of mine) {
    // only companies the person OWNS can be theirs alone (a client workspace whose one member is a client approver is the agency's)
    if (role !== 'owner') continue;
    const [c] = await db
      .select({ members: sql<number>`count(*)::int`, owners: sql<number>`count(*) filter (where ${schema.memberships.role} = 'owner')::int` })
      .from(schema.memberships)
      .where(eq(schema.memberships.orgId, org.id));
    if (Number(c.members) <= 1) sole.push(org);
    else if (Number(c.owners) <= 1) soleOwnerOf.push(lite(org));
  }
  const agencyWithClients: AccountDeletionCompany[] = [];
  for (const org of sole)
    if (org.kind === 'agency' && (await db.query.organizations.findFirst({ where: eq(schema.organizations.parentOrgId, org.id), columns: { id: true } }))) agencyWithClients.push(lite(org));
  const siteCounts = sole.length
    ? await db.select({ orgId: schema.sites.orgId, n: count() }).from(schema.sites).where(inArray(schema.sites.orgId, sole.map((o) => o.id))).groupBy(schema.sites.orgId)
    : [];
  const soleIds = new Set(sole.map((o) => o.id));
  const platformAdmin = isPlatformAdmin(user);
  const plan: AccountDeletionPlan = {
    canDelete: !soleOwnerOf.length && !agencyWithClients.length && !platformAdmin,
    soleOwnerOf,
    agencyWithClients,
    deletes: sole.map((o) => ({ ...lite(o), websites: Number(siteCounts.find((s) => s.orgId === o.id)?.n ?? 0) })),
    leaves: mine.filter((m) => !soleIds.has(m.org.id)).map((m) => lite(m.org)),
    platformAdmin,
  };
  return { plan, sole };
}

export interface DeleteAccountOptions {
  /** the companies the person is the only member of: deleted with the account, or kept without members */
  soleCompanies: 'delete' | 'keep';
  /** who did it, as the remaining companies' audit logs show it */
  actor: AuditActor;
  /** 'self': the person deleted their own account ("Left the company"); 'admin': a platform administrator removed them */
  by: 'self' | 'admin';
}

/**
 * Deletes the account. The caller has checked the refusals (planAccountDeletion's soleOwnerOf / agencyWithClients and its own rules:
 * step-up, typed confirmation, the last platform admin). Returns the companies deleted and kept.
 */
export async function deleteAccount(req: FastifyRequest, target: UserRow, sole: OrgRow[], o: DeleteAccountOptions): Promise<{ deletedCompanies: AccountDeletionCompany[]; keptCompanies: AccountDeletionCompany[] }> {
  if (o.soleCompanies === 'delete') for (const org of sole) await deleteCompany(org, req.log);
  // the person's memberships elsewhere go with the account (cascade); their audit history in each company stays
  const others = await db.select({ orgId: schema.memberships.orgId, role: schema.memberships.role }).from(schema.memberships).where(eq(schema.memberships.userId, target.id));
  for (const m of others) {
    if (o.by === 'self') await audit(req, m.orgId, { action: 'team.left', actor: o.actor, target: { type: 'user', id: target.id, label: target.email }, details: { role: m.role, accountDeleted: true } });
    else await audit(req, m.orgId, { action: 'team.removed', actor: o.actor, target: { type: 'user', id: target.id, label: target.email }, details: { by: 'platform administrator', accountDeleted: true } });
  }
  await db.delete(schema.users).where(eq(schema.users.id, target.id));
  const list = sole.map(lite);
  return { deletedCompanies: o.soleCompanies === 'delete' ? list : [], keptCompanies: o.soleCompanies === 'keep' ? list : [] };
}
