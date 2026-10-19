import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { creditActivityQuerySchema, creditLimitsSchema, creditPurchaseSchema, type BillingOverview, type CreditActivityPage, type CreditLimits, type CreditPurchaseRequest } from '@seo/shared';
import { orgAccess } from '../auth/access';
import { db, schema } from '../db';
import { notFound, parse } from '../lib/errors';
import { audit } from '../services/audit';
import { activityCsv, billingOverview, creditActivity, invalidateForecast, requestPack, requestView } from '../services/billing';

// Credits, as the customer reads and controls them (app/docs/CREDITS.md). Reading needs membership (a viewer sees the balance its
// analyses use); the company's own limits and asking for credits are an owner's / admin's decision. Client people of an agency never
// reach these (orgAccess ranks them below viewer).

export async function billingRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/billing', async (req): Promise<BillingOverview> => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId);
    return billingOverview(a.org);
  });

  app.get('/api/orgs/:orgId/billing/activity', async (req): Promise<CreditActivityPage> => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId);
    return creditActivity(a.org.id, parse(creditActivityQuerySchema, req.query ?? {}));
  });

  app.get('/api/orgs/:orgId/billing/activity.csv', async (req, reply) => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'admin');
    const q = parse(creditActivityQuerySchema, { ...(req.query as object), limit: 500 });
    const rows = [];
    let cursor: string | undefined;
    for (let i = 0; i < 40; i++) {
      const page = await creditActivity(a.org.id, { ...q, cursor, limit: 500 });
      rows.push(...page.rows);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="credits-${a.org.slug}-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(activityCsv(rows));
  });

  app.put('/api/orgs/:orgId/billing/limits', async (req): Promise<CreditLimits> => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'owner');
    const limits = parse(creditLimitsSchema, req.body ?? {});
    const before = a.org.creditLimits;
    await db.update(schema.organizations).set({ creditLimits: limits }).where(eq(schema.organizations.id, a.org.id));
    invalidateForecast(a.org.id);
    await audit(req, a.org.id, { action: 'company.credit_limits_changed', target: { type: 'company', id: a.org.id, label: a.org.name }, details: { before, after: limits } });
    return limits;
  });

  app.post('/api/orgs/:orgId/billing/requests', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req): Promise<CreditPurchaseRequest> => {
    const a = await orgAccess(req, (req.params as { orgId: string }).orgId, 'admin');
    const body = parse(creditPurchaseSchema, req.body ?? {});
    const r = await requestPack(a.org, a.user, body.packId, body.note, req.log);
    await audit(req, a.org.id, { action: 'company.credits_requested', target: { type: 'company', id: a.org.id, label: a.org.name }, details: { packId: r.packId, credits: r.credits } });
    return r;
  });

  app.delete('/api/orgs/:orgId/billing/requests/:requestId', async (req): Promise<CreditPurchaseRequest> => {
    const p = req.params as { orgId: string; requestId: string };
    const a = await orgAccess(req, p.orgId, 'admin');
    const [row] = await db
      .update(schema.creditPurchaseRequests)
      .set({ status: 'cancelled', resolvedAt: new Date(), resolvedBy: a.user.email })
      .where(and(eq(schema.creditPurchaseRequests.id, p.requestId), eq(schema.creditPurchaseRequests.orgId, a.org.id), eq(schema.creditPurchaseRequests.status, 'pending')))
      .returning()
      .catch(() => []);
    if (!row) throw notFound('No waiting request with this id.');
    return requestView(row);
  });
}
