import type { FastifyInstance } from 'fastify';
import { orgAccess, siteAccess } from '../auth/access';
import { audit } from '../services/audit';
import {
  createConnection,
  deleteConnection,
  listConnections,
  publishReport,
  refreshReport,
  reportState,
  siteState,
  testConnection,
  updateConnection,
} from '../services/cms/service';

/**
 * G2 — CMS publishing (app/docs/CMS_PUBLISHING.md §6). Connections are website settings (admins change them, everybody in the
 * company sees them without their secrets); a page goes out as a draft from a member, live only from an owner or admin who ticked
 * the confirmation. Every route is scoped to the caller's company and the report's own website.
 */

type P = { orgId: string; siteId: string; connectionId: string; reportId: string };

const perUser = (max: number) => ({ rateLimit: { max, timeWindow: '1 minute', keyGenerator: (req: { user?: { id: string } | null; ip: string }) => req.user?.id ?? req.ip } });

export async function cmsRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/sites/:siteId/cms/connections', async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId);
    return { items: await listConnections(a.org.id, a.site.id) };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/cms/connections', { config: perUser(10) }, async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    const r = await createConnection(a, req.body, req.log);
    await audit(req, a.org.id, { action: 'cms.connected', target: { type: 'cms_connection', id: r.connection.id, label: r.connection.label }, details: { siteId: a.site.id, kind: r.connection.kind } });
    return r;
  });

  app.patch('/api/orgs/:orgId/sites/:siteId/cms/connections/:connectionId', { config: perUser(30) }, async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    const r = await updateConnection(a, p.connectionId, req.body, req.log);
    await audit(req, a.org.id, { action: 'cms.changed', target: { type: 'cms_connection', id: r.id, label: r.label }, details: { siteId: a.site.id, fields: Object.keys((req.body ?? {}) as object).filter((k) => k !== 'secret') } });
    return r;
  });

  app.delete('/api/orgs/:orgId/sites/:siteId/cms/connections/:connectionId', async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    const r = await deleteConnection(a, p.connectionId, req.log);
    await audit(req, a.org.id, { action: 'cms.removed', target: { type: 'cms_connection', id: p.connectionId }, details: { siteId: a.site.id } });
    return r;
  });

  app.post('/api/orgs/:orgId/sites/:siteId/cms/connections/:connectionId/test', { config: perUser(10) }, async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    return testConnection(a, p.connectionId, req.log);
  });

  app.get('/api/orgs/:orgId/sites/:siteId/cms/state', async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId);
    return siteState(a.org.id, a.site.id);
  });

  app.get('/api/orgs/:orgId/reports/:reportId/cms', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId);
    return reportState(a, p.reportId);
  });

  app.post('/api/orgs/:orgId/reports/:reportId/cms/publish', { config: perUser(10) }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'member');
    return publishReport(a, p.reportId, req.body, req.log);
  });

  app.post('/api/orgs/:orgId/reports/:reportId/cms/refresh', { config: perUser(20) }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'member');
    return refreshReport(a, p.reportId, req.body, req.log);
  });
}
