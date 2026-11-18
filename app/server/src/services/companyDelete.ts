import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { db, schema } from '../db';
import type { OrgRow } from '../db/schema';
import { stopInEngine } from '../routes/sites';

/**
 * Removes a company and everything of it (the owner's "Delete company", the platform admin's, and a person deleting their own account
 * when they are its only member). Every verified website first stops in the engine and its engine history is deleted (CR17-B: every
 * table of ladder_common.SITE_PURGE); an engine that cannot be reached is logged and the deletion goes on (stopInEngine never throws). Its cost history stays in the admin panel as unattributed cost
 * (cost_events.org_id is set null, `detached_from` keeps its name); its credit entries stay as history with org_id null.
 */
export async function deleteCompany(org: OrgRow, log: FastifyBaseLogger): Promise<void> {
  const owned = await db.query.sites.findMany({ where: eq(schema.sites.orgId, org.id) });
  for (const s of owned.filter((x) => x.verifiedAt)) await stopInEngine(s, log);
  // its costs become unattributed for good: the admin panel never ties them to a company that verifies the same domain later
  await db.update(schema.costEvents).set({ detachedFrom: org.name }).where(eq(schema.costEvents.orgId, org.id));
  await db.delete(schema.organizations).where(eq(schema.organizations.id, org.id));
}
