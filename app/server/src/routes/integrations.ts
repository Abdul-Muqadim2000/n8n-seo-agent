import type { FastifyInstance, FastifyRequest } from 'fastify';
import { isUuid, orgAccess } from '../auth/access';
import { audit } from '../services/audit';
import { notFound } from '../lib/errors';
import { connectedTrackers, connectTracker, createIssue, listIssues, refreshIssues, testTracker } from '../services/issueTrackers';
import { createEndpoint, deleteEndpoint, listEndpoints, listWebhookDeliveries, redeliver, rotateSecret, testEndpoint, updateEndpoint } from '../services/webhooks';
import { deleteIntegration, integrationOf, integrationsOverview } from '../services/integrations';
import { connectExport, listExportRuns, runExport, testExport, updateExport } from '../services/exports';

/**
 * G4 (2026-10-17), Company settings -> Integrations (app/docs/INTEGRATIONS.md). Session routes; every one needs the admin role
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
    const v = await connectTracker(a.org, a.user, req.body);
    await audit(req, a.org.id, { action: 'integration.connected', target: { type: 'integration', id: v.id, label: v.name }, details: { kind: v.kind, target: v.config.projectName ?? v.config.teamName ?? null } });
    return v;
  });
  app.post('/api/orgs/:orgId/integrations/:id/test', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    const row = await integrationOf(a.org.id, p.id);
    return row.kind === 's3' || row.kind === 'bigquery' ? testExport(a.org.id, row.id) : testTracker(a.org.id, row.id);
  });
  app.post('/api/orgs/:orgId/integrations/exports', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'admin');
    const v = await connectExport(a.org, a.user, req.body);
    await audit(req, a.org.id, { action: 'integration.connected', target: { type: 'integration', id: v.id, label: v.name }, details: { kind: v.kind, tables: v.config.tables, schedule: v.config.schedule } });
    return v;
  });
  app.patch('/api/orgs/:orgId/integrations/:id', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    const v = await updateExport(a.org.id, p.id, req.body);
    await audit(req, a.org.id, { action: 'integration.changed', target: { type: 'integration', id: v.id, label: v.name }, details: { tables: v.config.tables, schedule: v.config.schedule, hour: v.config.hour } });
    return v;
  });
  app.post('/api/orgs/:orgId/integrations/:id/run', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    const r = await runExport(a.org.id, p.id, 'manual');
    await audit(req, a.org.id, { action: 'integration.export_started', target: { type: 'integration', id: r.integrationId }, outcome: r.status === 'failed' ? 'failure' : 'success', details: { status: r.status, rows: r.tables.reduce((n, t) => n + t.rows, 0) } });
    return r;
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
    const row = await integrationOf(a.org.id, p.id);
    const r = await deleteIntegration(a.org.id, row.id);
    await audit(req, a.org.id, { action: 'integration.disconnected', target: { type: 'integration', id: row.id, label: row.name }, details: { kind: row.kind } });
    return r;
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
    const r = await createIssue(a, req.body);
    if (!r.existing) await audit(req, a.org.id, { action: 'issue.created', target: { type: 'issue', id: r.issue.id, label: r.issue.remoteKey }, details: { kind: r.issue.kind, source: r.issue.sourceKey } });
    return r;
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
    const r = await createEndpoint(a.org, a.user, req.body);
    await audit(req, a.org.id, { action: 'integration.webhook_added', target: { type: 'webhook', id: r.endpoint.id, label: r.endpoint.name }, details: { format: r.endpoint.format, host: r.endpoint.urlHost, events: r.endpoint.events } });
    return r;
  });
  app.patch('/api/orgs/:orgId/webhooks/:id', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    const v = await updateEndpoint(a.org.id, p.id, req.body);
    await audit(req, a.org.id, { action: 'integration.webhook_changed', target: { type: 'webhook', id: v.id, label: v.name }, details: { enabled: v.enabled, events: v.events } });
    return v;
  });
  app.delete('/api/orgs/:orgId/webhooks/:id', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    const r = await deleteEndpoint(a.org.id, p.id);
    await audit(req, a.org.id, { action: 'integration.webhook_removed', target: { type: 'webhook', id: String(p.id) } });
    return r;
  });
  app.post('/api/orgs/:orgId/webhooks/:id/test', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    return testEndpoint(a.org, p.id);
  });
  app.post('/api/orgs/:orgId/webhooks/:id/rotate-secret', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    const r = await rotateSecret(a.org.id, p.id);
    await audit(req, a.org.id, { action: 'integration.webhook_secret_rotated', target: { type: 'webhook', id: r.endpoint.id, label: r.endpoint.name } });
    return r;
  });
  app.post('/api/orgs/:orgId/webhook-deliveries/:id/redeliver', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    return redeliver(a.org.id, p.id);
  });
}
