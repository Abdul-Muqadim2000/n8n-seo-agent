import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { isPlatformAdmin } from '../../auth/access';
import { deleteUserSessions, refreshSessionPolicy } from '../../auth/session';
import { issueToken } from '../../auth/tokens';
import { config } from '../../config';
import { db, schema } from '../../db';
import type { OrgRow, UserRow } from '../../db/schema';
import { randomToken, slugify } from '../../lib/crypto';
import { badRequest, conflict, HttpError, notFound } from '../../lib/errors';
import { audit } from '../audit';
import { deleteCompany } from '../companyDelete';
import { dropAssignments } from '../agency';
import { applyNewCompanyCredits } from './credits';

// People, as the platform administrator manages them. Every refusal says what to do instead.

export const SET_PASSWORD_HOURS = 72;

const adminActor = (req: FastifyRequest) => ({ type: 'platform_admin' as const, userId: req.user?.id ?? null, label: req.user?.email ?? 'platform administrator' });

export async function userOrThrow(id: string): Promise<UserRow> {
  const u = UUID.test(id) ? await db.query.users.findFirst({ where: eq(schema.users.id, id) }) : undefined;
  if (!u) throw notFound('User not found');
  return u;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** the platform admins who keep access when `exceptId` loses theirs (verified, not suspended, on PLATFORM_ADMIN_EMAILS) */
async function otherActiveAdmins(exceptId: string): Promise<number> {
  if (!config.platformAdmins.length) return 0;
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, emailVerifiedAt: schema.users.emailVerifiedAt })
    .from(schema.users)
    .where(and(inArray(sql`lower(${schema.users.email})`, config.platformAdmins), isNull(schema.users.suspendedAt), ne(schema.users.id, exceptId)));
  return rows.filter((r) => isPlatformAdmin(r as UserRow)).length;
}

/** an admin may not lock themselves out, nor remove the last platform admin's access */
async function guardAdminAccess(req: FastifyRequest, target: UserRow, what: 'suspend' | 'delete'): Promise<void> {
  if (req.user?.id === target.id) throw badRequest(what === 'suspend' ? 'You cannot suspend your own account.' : 'You cannot delete your own account here.');
  if (isPlatformAdmin(target) && (await otherActiveAdmins(target.id)) === 0)
    throw conflict(`${target.email} is the last platform administrator who can sign in. Add another one to PLATFORM_ADMIN_EMAILS first.`, 'last_platform_admin');
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  for (let i = 0; i < 5 && (await db.query.organizations.findFirst({ where: eq(schema.organizations.slug, slug) })); i++)
    slug = `${base}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  return slug;
}

export interface CreateUserInput {
  email: string;
  name: string;
  orgId?: string;
  newCompanyName?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  markVerified: boolean;
}

/**
 * A new person with no password: they choose one through the returned link (a password reset token, 72 hours). With `orgId` they
 * join that company in `role`; with `newCompanyName` a company is created with them as its owner (sign-up credits apply).
 */
export async function createUser(req: FastifyRequest, body: CreateUserInput): Promise<{ user: UserRow; setPasswordUrl: string; org: OrgRow | null }> {
  if (body.orgId && body.newCompanyName) throw badRequest('Choose a company or a new company name, not both.', { newCompanyName: 'Leave empty when a company is chosen' });
  if (await db.query.users.findFirst({ where: eq(schema.users.email, body.email) })) throw conflict(`An account with ${body.email} already exists.`, 'email_taken');
  let org: OrgRow | null = null;
  if (body.orgId) {
    org = (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, body.orgId) })) ?? null;
    if (!org) throw badRequest('Company not found', { orgId: 'Unknown company' });
    if (org.kind === 'client') throw badRequest('People of a client workspace are added from its agency\'s Clients page.', { orgId: 'A client workspace' });
  }
  // the slug is chosen before the transaction (a read on another connection inside it would wait on itself on a one-connection pool)
  const slug = body.newCompanyName ? await uniqueSlug(body.newCompanyName) : '';
  const created = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ email: body.email, name: body.name, emailVerifiedAt: body.markVerified ? new Date() : null })
      .returning();
    let o = org;
    if (body.newCompanyName) {
      [o] = await tx
        .insert(schema.organizations)
        .values({
          name: body.newCompanyName,
          slug,
          hookToken: randomToken(24),
          monthlyBudgetUsd: config.defaultBudgetUsd,
          onboardingStep: 'website',
          createdBy: user.id,
        })
        .returning();
      await tx.insert(schema.memberships).values({ orgId: o.id, userId: user.id, role: 'owner', provisionedBy: 'owner' });
      await applyNewCompanyCredits(tx, o);
    } else if (o) {
      await tx.insert(schema.memberships).values({ orgId: o.id, userId: user.id, role: body.role, provisionedBy: 'invite' });
    }
    return { user, org: o };
  });
  const token = await issueToken(created.user.id, 'reset_password', SET_PASSWORD_HOURS * 60);
  if (created.org) {
    if (body.newCompanyName) await audit(req, created.org.id, { action: 'company.created', actor: adminActor(req), target: { type: 'company', id: created.org.id, label: created.org.name } });
    await audit(req, created.org.id, { action: 'team.joined', actor: adminActor(req), target: { type: 'user', id: created.user.id, label: created.user.email }, details: { role: body.newCompanyName ? 'owner' : body.role, addedBy: 'platform administrator' } });
    await refreshSessionPolicy([created.user.id]);
  }
  return { user: created.user, org: created.org, setPasswordUrl: `${config.appUrl}/reset-password?token=${token}` };
}

export async function updateUser(req: FastifyRequest, target: UserRow, body: { name?: string; suspended?: boolean; markVerified?: true }): Promise<string[]> {
  const changed: string[] = [];
  const patch: Partial<typeof schema.users.$inferInsert> = {};
  if (body.name !== undefined && body.name !== target.name) {
    patch.name = body.name;
    changed.push('name');
  }
  if (body.markVerified && !target.emailVerifiedAt) {
    patch.emailVerifiedAt = new Date();
    changed.push('verified');
  }
  if (body.suspended === true && !target.suspendedAt) {
    await guardAdminAccess(req, target, 'suspend');
    patch.suspendedAt = new Date();
    changed.push('suspended');
  } else if (body.suspended === false && target.suspendedAt) {
    patch.suspendedAt = null;
    changed.push('unsuspended');
  }
  if (Object.keys(patch).length) await db.update(schema.users).set(patch).where(eq(schema.users.id, target.id));
  if (changed.includes('suspended')) await deleteUserSessions(target.id);
  return changed;
}

export interface SoleCompany {
  id: string;
  name: string;
  slug: string;
}

/**
 * Deleting a person. Refused while they are the only owner of a company that has other members (transfer it or delete the company
 * first). Companies they are the ONLY member of come back for the admin to choose (`soleCompanies: 'delete' | 'keep'`); with 'keep'
 * the company stays with no members (its data, runs and schedules untouched) for an admin to hand over.
 */
export async function deleteUser(
  req: FastifyRequest,
  target: UserRow,
  soleChoice?: 'delete' | 'keep',
): Promise<{ deletedCompanies: SoleCompany[]; keptCompanies: SoleCompany[] }> {
  await guardAdminAccess(req, target, 'delete');
  const owned = await db
    .select({ org: schema.organizations })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(and(eq(schema.memberships.userId, target.id), eq(schema.memberships.role, 'owner')));
  const blocking: SoleCompany[] = [];
  const sole: { org: OrgRow }[] = [];
  for (const { org } of owned) {
    const [c] = await db
      .select({ members: sql<number>`count(*)::int`, owners: sql<number>`count(*) filter (where ${schema.memberships.role} = 'owner')::int` })
      .from(schema.memberships)
      .where(eq(schema.memberships.orgId, org.id));
    if (Number(c.members) <= 1) sole.push({ org });
    else if (Number(c.owners) <= 1) blocking.push({ id: org.id, name: org.name, slug: org.slug });
  }
  if (blocking.length)
    throw new HttpError(
      409,
      `${target.email} is the only owner of ${blocking.map((b) => b.name).join(', ')}, which ${blocking.length > 1 ? 'have' : 'has'} other members. Make another member owner, or delete the company, first.`,
      'sole_owner',
      undefined,
      { companies: blocking },
    );
  const soleList = sole.map(({ org }) => ({ id: org.id, name: org.name, slug: org.slug }));
  if (sole.length && !soleChoice)
    throw new HttpError(
      409,
      `${target.email} is the only member of ${soleList.map((s) => s.name).join(', ')}. Choose whether to delete ${sole.length > 1 ? 'those companies' : 'that company'} too or keep ${sole.length > 1 ? 'them' : 'it'} without members.`,
      'sole_member_companies',
      undefined,
      { companies: soleList },
    );
  if (soleChoice === 'delete') {
    for (const { org } of sole) {
      if (org.kind === 'agency' && (await db.query.organizations.findFirst({ where: eq(schema.organizations.parentOrgId, org.id) })))
        throw conflict(`${org.name} is an agency with client workspaces: delete those first.`, 'agency_has_clients');
    }
    for (const { org } of sole) await deleteCompany(org, req.log);
  }
  // the person's memberships elsewhere go with the account (cascade); their audit history in each company stays
  const others = await db.select({ orgId: schema.memberships.orgId }).from(schema.memberships).where(eq(schema.memberships.userId, target.id));
  for (const o of others) await audit(req, o.orgId, { action: 'team.removed', actor: adminActor(req), target: { type: 'user', id: target.id, label: target.email }, details: { by: 'platform administrator', accountDeleted: true } });
  await db.delete(schema.users).where(eq(schema.users.id, target.id));
  return { deletedCompanies: soleChoice === 'delete' ? soleList : [], keptCompanies: soleChoice === 'keep' ? soleList : [] };
}

/** add the person to a company or change their role there; a company's last owner keeps the owner role */
export async function setMembership(req: FastifyRequest, target: UserRow, orgId: string, role: string): Promise<{ added: boolean; before: string | null }> {
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw notFound('Company not found');
  if (org.kind === 'client') throw badRequest('People of a client workspace are managed from its agency\'s Clients page.');
  const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, target.id)) });
  if (m && m.role === role) return { added: false, before: m.role };
  if (m?.role === 'owner' && role !== 'owner') await assertNotLastOwner(org, target.id);
  if (m) await db.update(schema.memberships).set({ role }).where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, target.id)));
  else await db.insert(schema.memberships).values({ orgId, userId: target.id, role, provisionedBy: 'invite' });
  await refreshSessionPolicy([target.id]);
  await audit(req, orgId, {
    action: m ? 'team.role_changed' : 'team.joined',
    actor: adminActor(req),
    target: { type: 'user', id: target.id, label: target.email },
    details: m ? { before: m.role, after: role, by: 'platform administrator' } : { role, addedBy: 'platform administrator' },
  });
  return { added: !m, before: m?.role ?? null };
}

async function assertNotLastOwner(org: OrgRow, userId: string): Promise<void> {
  const [c] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.orgId, org.id), eq(schema.memberships.role, 'owner'), ne(schema.memberships.userId, userId)));
  if (Number(c.n) === 0) throw conflict(`This is the last owner of ${org.name}. Make another member owner first, or delete the company.`, 'last_owner');
}

export async function removeMembership(req: FastifyRequest, target: UserRow, orgId: string): Promise<string> {
  const org = await db.query.organizations.findFirst({ where: eq(schema.organizations.id, orgId) });
  if (!org) throw notFound('Company not found');
  const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, target.id)) });
  if (!m) throw notFound(`${target.email} is not a member of ${org.name}`);
  if (m.role === 'owner') await assertNotLastOwner(org, target.id);
  await db.delete(schema.memberships).where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, target.id)));
  // leaving an agency ends the person's access to its clients as well (as the company's own "Remove")
  if (org.kind === 'agency') await dropAssignments(orgId, target.id);
  await refreshSessionPolicy([target.id]);
  await audit(req, orgId, { action: 'team.removed', actor: adminActor(req), target: { type: 'user', id: target.id, label: target.email }, details: { role: m.role, by: 'platform administrator' } });
  return m.role;
}
