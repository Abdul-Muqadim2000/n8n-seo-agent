import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { policyOf, securityPolicySchema, type SecurityPolicy } from '@seo/shared';
import { orgAccess, requireRecentAuth, userHasMfa } from '../auth/access';
import { db, schema } from '../db';
import { badRequest, parse } from '../lib/errors';

/** G1: the company's security policy (two-step requirement, idle timeout, audit retention). Design: app/docs/IDENTITY.md §1-3. */
export async function securityRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/security', async (req): Promise<SecurityPolicy> => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId);
    return policyOf(a.org.securityPolicy);
  });

  app.put('/api/orgs/:orgId/security', async (req) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'admin');
    await requireRecentAuth(req);
    const next = parse(securityPolicySchema, req.body);
    const before = policyOf(a.org.securityPolicy);
    // whoever switches the requirement on must already meet it, or they would lock themselves out with their next request
    if (next.requireMfa && !before.requireMfa && !(await userHasMfa(a.user)))
      throw badRequest('Set up two-step verification on your own account first (Your account → Security).', { requireMfa: 'You have no second factor yet' });
    await db.update(schema.organizations).set({ securityPolicy: { ...next } }).where(eq(schema.organizations.id, a.org.id));
    return next;
  });
}
