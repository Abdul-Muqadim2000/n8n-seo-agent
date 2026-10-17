import type { FastifyInstance } from 'fastify';
import { orgAccess, siteAccess } from '../auth/access';
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
    return createConnection(a, req.body, req.log);
  });

  app.patch('/api/orgs/:orgId/sites/:siteId/cms/connections/:connectionId', { config: perUser(30) }, async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    return updateConnection(a, p.connectionId, req.body, req.log);
  });

  app.delete('/api/orgs/:orgId/sites/:siteId/cms/connections/:connectionId', async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    return deleteConnection(a, p.connectionId, req.log);
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
