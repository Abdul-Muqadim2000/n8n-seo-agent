import { eq } from 'drizzle-orm';
import { clientSafePayload, effectiveBrand, isClientRole, type PortalBrand, type Role } from '@seo/shared';
import { db, schema } from '../db';
import type { OrgRow } from '../db/schema';

/**
 * G5: the small reads every client-facing path needs (whose brand, which agency, what a client person may see of a payload), kept
 * apart from services/agency.ts so the share page, the file route and the mailer do not load the agency's spend and overview code.
 */

export async function orgById(id: string | null | undefined): Promise<OrgRow | null> {
  if (!id) return null;
  return (await db.query.organizations.findFirst({ where: eq(schema.organizations.id, id) })) ?? null;
}

/** the agency of a client workspace (null for anything else) */
export async function agencyOf(org: Pick<OrgRow, 'kind' | 'parentOrgId'>): Promise<OrgRow | null> {
  return org.kind === 'client' ? orgById(org.parentOrgId) : null;
}

/** the brand a client-facing surface of this company uses: a client workspace's agency brand with its overrides, an agency's own */
export async function brandForOrg(org: OrgRow | null): Promise<PortalBrand | null> {
  if (!org) return null;
  if (org.kind === 'client') {
    const agency = await agencyOf(org);
    return agency ? effectiveBrand({ name: agency.name, branding: agency.branding }, { branding: org.branding }) : null;
  }
  if (org.kind === 'agency') return effectiveBrand({ name: org.name, branding: org.branding });
  return null;
}

/** a report payload as a client person gets it: no cost, ledger or budget figures */
export function payloadFor(role: Role, payload: Record<string, unknown>): Record<string, unknown> {
  return isClientRole(role) ? clientSafePayload(payload) : payload;
}
