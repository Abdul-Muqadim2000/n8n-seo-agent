import type { FastifyInstance, FastifyRequest } from 'fastify';
import { isUuid, orgAccess } from '../auth/access';
import { notFound } from '../lib/errors';
import { connectedTrackers, connectTracker, createIssue, listIssues, refreshIssues, testTracker } from '../services/issueTrackers';
import { createEndpoint, deleteEndpoint, listEndpoints, listWebhookDeliveries, redeliver, rotateSecret, testEndpoint, updateEndpoint } from '../services/webhooks';
import { deleteIntegration, integrationOf, integrationsOverview } from '../services/integrations';
import { connectExport, listExportRuns, runExport, testExport, updateExport } from '../services/exports';

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

  // ---- connectors (issue trackers, export destinations) ----
  app.post('/api/orgs/:orgId/integrations/trackers', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    return connectTracker(a.org, a.user, req.body);
  });
  app.post('/api/orgs/:orgId/integrations/:id/test', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    const row = await integrationOf(a.org.id, p.id);
    return row.kind === 's3' || row.kind === 'bigquery' ? testExport(a.org.id, row.id) : testTracker(a.org.id, row.id);
  });
  app.post('/api/orgs/:orgId/integrations/exports', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    return connectExport(a.org, a.user, req.body);
  });
  app.patch('/api/orgs/:orgId/integrations/:id', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    return updateExport(a.org.id, p.id, req.body);
  });
  app.post('/api/orgs/:orgId/integrations/:id/run', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    return runExport(a.org.id, p.id, 'manual');
  });
  app.get('/api/orgs/:orgId/integrations/:id/runs', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    const row = await integrationOf(a.org.id, p.id);
    return { items: await listExportRuns(a.org.id, row.id) };
  });
  app.delete('/api/orgs/:orgId/integrations/:id', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    return deleteIntegration(a.org.id, p.id);
  });

  // ---- tickets: a member may push a finding / recommendation and read its state (part of acting on it) ----
  const siteFilter = (req: FastifyRequest) => {
    const v = (req.query as { siteId?: string }).siteId;
    if (v && !isUuid(v)) throw notFound('Website not found');
    return v || null;
  };
  app.get('/api/orgs/:orgId/issues', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId);
    return { items: await listIssues(a.org.id, siteFilter(req)), trackers: await connectedTrackers(a.org.id) };
  });
  app.post('/api/orgs/:orgId/issues', { config: { rateLimit: { max: 30, timeWindow: '1 minute', keyGenerator: (req) => 'issues:' + String((req.params as P).orgId) } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'member');
    return createIssue(a, req.body);
  });
  app.post('/api/orgs/:orgId/issues/refresh', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'member');
    const site = siteFilter(req);
    const r = await refreshIssues(a.org.id, site);
    return { ...r, items: await listIssues(a.org.id, site) };
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
