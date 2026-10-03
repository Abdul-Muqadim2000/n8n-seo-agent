import type { FastifyInstance } from 'fastify';
import { requireVerified, siteAccess } from '../auth/access';
import { notFound } from '../lib/errors';
import { aiData, alertsData, backlinksData, contentData, rankingsData, searchData, settingsData, technicalData } from '../services/data';
import { ladderDetailData, pipelineData } from '../services/pipeline';
import { loadBundle, overviewData, recommend } from '../services/recommendations';

type P = { orgId: string; siteId: string };

/** Dashboards: n8n Data Tables of a verified domain only (the tables are keyed by domain, not by company). */
export async function dataRoutes(app: FastifyInstance) {
  const guard = async (req: Parameters<typeof siteAccess>[0]) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId);
    requireVerified(a.site);
    return a;
  };

  app.get('/api/orgs/:orgId/sites/:siteId/data/overview', async (req) => {
    const a = await guard(req);
    return overviewData(a.org, a.site);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/search', async (req) => {
    const a = await guard(req);
    return searchData(a.org, a.site);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/rankings', async (req) => {
    const a = await guard(req);
    return rankingsData(a.site);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/content', async (req) => {
    const a = await guard(req);
    return contentData(a.org, a.site);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/technical', async (req) => {
    const a = await guard(req);
    const auditId = (req.query as { auditId?: string }).auditId;
    return technicalData(a.org, a.site, auditId && auditId.length < 80 ? auditId : undefined);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/ai', async (req) => {
    const a = await guard(req);
    return aiData(a.org, a.site);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/backlinks', async (req) => {
    const a = await guard(req);
    return backlinksData(a.org, a.site);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/alerts', async (req) => {
    const a = await guard(req);
    return alertsData(a.site);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/settings', async (req) => {
    const a = await guard(req);
    return settingsData(a.org, a.site);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/pipeline', async (req) => {
    const a = await guard(req);
    return pipelineData(a.org, a.site);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/ladders/:ladderId', async (req) => {
    const a = await guard(req);
    const ladderId = String((req.params as P & { ladderId: string }).ladderId ?? '');
    if (!ladderId || ladderId.length > 80) throw notFound('Keyword ladder not found');
    return ladderDetailData(a.org, a.site, ladderId);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/recommendations', async (req) => {
    const a = await guard(req);
    return recommend(a.site, await loadBundle(a.org, a.site));
  });
}
