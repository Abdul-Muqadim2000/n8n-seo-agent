import { eq } from 'drizzle-orm';
import { refreshSessionPolicy } from '../auth/session';
import type { FastifyInstance } from 'fastify';
import { AUDIT_CSV_COLUMNS, auditCsvRow, auditQuerySchema, policyOf, securityPolicySchema, type SecurityPolicy } from '@seo/shared';
import { orgAccess, requireRecentAuth, userHasMfa } from '../auth/access';
import { db, schema } from '../db';
import { badRequest, parse } from '../lib/errors';
import { audit, auditActors, auditRowsForExport, listAudit } from '../services/audit';

/** G1: the company's security policy and its audit log. Design: app/docs/IDENTITY.md §1-3 and §6. */
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
      throw badRequest('Set up two-step verification on your own account first (Your account → Two-step verification).', { requireMfa: 'You have no second factor yet' });
    await db.update(schema.organizations).set({ securityPolicy: { ...next } }).where(eq(schema.organizations.id, a.org.id));
    const changed = (Object.keys(next) as (keyof SecurityPolicy)[]).filter((k) => next[k] !== before[k]);
    // every member's open sessions take the new strictest idle timeout at once
    if (next.idleTimeoutMinutes !== before.idleTimeoutMinutes) {
      const members = await db.select({ id: schema.memberships.userId }).from(schema.memberships).where(eq(schema.memberships.orgId, a.org.id));
      await refreshSessionPolicy(members.map((m) => m.id));
    }
    if (changed.length)
      await audit(req, a.org.id, {
        action: 'company.security_changed',
        target: { type: 'company', id: a.org.id, label: a.org.name },
        details: { before: Object.fromEntries(changed.map((k) => [k, before[k]])), after: Object.fromEntries(changed.map((k) => [k, next[k]])) },
      });
    return next;
  });

  // ------------------------------------------------------------------ audit log (owners and admins)
  app.get('/api/orgs/:orgId/audit', async (req) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'admin');
    const q = parse(auditQuerySchema, req.query ?? {});
    const page = await listAudit(a.org.id, q);
    return { ...page, actors: q.before ? undefined : await auditActors(a.org.id), retentionDays: policyOf(a.org.securityPolicy).auditRetentionDays };
  });

  app.get('/api/orgs/:orgId/audit.csv', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req, reply) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'admin');
    const { limit: _limit, ...q } = parse(auditQuerySchema, req.query ?? {});
    const lines = [AUDIT_CSV_COLUMNS.join(',')];
    for await (const e of auditRowsForExport(a.org.id, q)) lines.push(auditCsvRow(e));
    await audit(req, a.org.id, { action: 'audit.exported', target: { type: 'audit_log', label: 'Audit log' }, details: { rows: lines.length - 1, filters: q } });
    const day = new Date().toISOString().slice(0, 10);
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${a.org.slug}-audit-${day}.csv"`)
      .header('cache-control', 'no-store')
      .send(`﻿${lines.join('\r\n')}\r\n`);
  });
}
