import type { FastifyInstance } from 'fastify';
import { orgAccess } from '../auth/access';
import { createEndpoint, deleteEndpoint, listEndpoints, listWebhookDeliveries, redeliver, rotateSecret, testEndpoint, updateEndpoint } from '../services/webhooks';
import { integrationsOverview } from '../services/integrations';

/**
 * G4 (2026-10-17) — Company settings → Integrations (app/docs/INTEGRATIONS.md). Session routes; every one needs the admin role
 * (an integration sends the company's data out of the app or writes into its tools), except creating a ticket and reading its
 * state, which a member may do (it is part of acting on a finding, like "I fixed this").
 */

type P = { orgId: string; id: string };

export async function integrationRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/integrations', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    return integrationsOverview(a.org);
  });

  // ---- event webhooks (signed JSON, Slack, Teams) ----
  app.get('/api/orgs/:orgId/webhooks', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    return { items: await listEndpoints(a.org.id), deliveries: await listWebhookDeliveries(a.org.id, 50) };
  });
  app.post('/api/orgs/:orgId/webhooks', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    return createEndpoint(a.org, a.user, req.body);
  });
  app.patch('/api/orgs/:orgId/webhooks/:id', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    return updateEndpoint(a.org.id, p.id, req.body);
  });
  app.delete('/api/orgs/:orgId/webhooks/:id', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    return deleteEndpoint(a.org.id, p.id);
  });
  app.post('/api/orgs/:orgId/webhooks/:id/test', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    return testEndpoint(a.org, p.id);
  });
  app.post('/api/orgs/:orgId/webhooks/:id/rotate-secret', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    return rotateSecret(a.org.id, p.id);
  });
  app.post('/api/orgs/:orgId/webhook-deliveries/:id/redeliver', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    return redeliver(a.org.id, p.id);
  });
}
