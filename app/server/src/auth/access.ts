import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { roleAtLeast, type Role } from '@seo/shared';
import { config } from '../config';
import { db, schema } from '../db';
import type { OrgRow, SiteRow, UserRow } from '../db/schema';
import { forbidden, notFound, unauthorized } from '../lib/errors';

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow | null;
    sessionId: string | null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export function requireUser(req: FastifyRequest): UserRow {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function isPlatformAdmin(user: UserRow | null): boolean {
  return !!user && !!user.emailVerifiedAt && config.platformAdmins.includes(user.email.toLowerCase());
}

export interface OrgAccess {
  user: UserRow;
  org: OrgRow;
  role: Role;
}

/** The signed-in user's membership in the company, at least `min`; 404 for companies they do not belong to. */
export async function orgAccess(req: FastifyRequest, orgId: unknown, min: Role = 'viewer'): Promise<OrgAccess> {
  const user = requireUser(req);
  if (!isUuid(orgId)) throw notFound('Company not found');
  const rows = await db
    .select({ org: schema.organizations, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.organizations, eq(schema.memberships.orgId, schema.organizations.id))
    .where(and(eq(schema.memberships.orgId, orgId), eq(schema.memberships.userId, user.id)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound('Company not found');
  const role = row.role as Role;
  if (!roleAtLeast(role, min)) throw forbidden(`This needs the ${min} role or higher`);
  return { user, org: row.org, role };
}

export interface SiteAccess extends OrgAccess {
  site: SiteRow;
}

export async function siteAccess(req: FastifyRequest, orgId: unknown, siteId: unknown, min: Role = 'viewer'): Promise<SiteAccess> {
  const a = await orgAccess(req, orgId, min);
  if (!isUuid(siteId)) throw notFound('Website not found');
  const site = await db.query.sites.findFirst({ where: and(eq(schema.sites.id, siteId), eq(schema.sites.orgId, a.org.id)) });
  if (!site) throw notFound('Website not found');
  return { ...a, site };
}

/** Dashboards read the n8n Data Tables by domain, so only a company that proved it owns the domain may see them. */
export function requireVerified(site: SiteRow) {
  if (!site.verifiedAt) throw forbidden(`Verify that you own ${site.domain} to see its data and run site checks`);
}
