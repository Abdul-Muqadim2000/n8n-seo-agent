import type { FastifyInstance } from 'fastify';
import { clientSafePayload, isClientRole, type Role } from '@seo/shared';
import { requireVerified, siteAccess } from '../auth/access';
import { notFound } from '../lib/errors';
import { aiData, alertsData, backlinksData, contentData, rankingsData, searchData, settingsData, technicalData } from '../services/data';
import { requestRecheck } from '../services/pageWatch';
import { ladderDetailData, pipelineData } from '../services/pipeline';
import { loadBundle, overviewData, recommend } from '../services/recommendations';

type P = { orgId: string; siteId: string };

/** Dashboards: n8n Data Tables of a verified domain only (the tables are keyed by domain, not by company). */
export async function dataRoutes(app: FastifyInstance) {
  const guard = async (req: Parameters<typeof siteAccess>[0], min: Role = 'viewer') => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, min);
    requireVerified(a.site);
    return a;
  };
  // G5 (WHITE_LABEL.md §4): the dashboards of the client portal, open to client people, without a cost figure in them
  const portal = (req: Parameters<typeof siteAccess>[0]) => guard(req, 'client_viewer');
  const shown = <T,>(role: Role, data: T): T => (isClientRole(role) ? clientSafePayload(data) : data);

  app.get('/api/orgs/:orgId/sites/:siteId/data/overview', async (req) => {
    const a = await portal(req);
    return shown(a.role, await overviewData(a.org, a.site));
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/search', async (req) => {
    const a = await portal(req);
    return shown(a.role, await searchData(a.org, a.site));
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/rankings', async (req) => {
    const a = await portal(req);
    return shown(a.role, await rankingsData(a.site));
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/content', async (req) => {
    const a = await guard(req);
    return contentData(a.org, a.site);
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/technical', async (req) => {
    const a = await portal(req);
    const auditId = (req.query as { auditId?: string }).auditId;
    return shown(a.role, await technicalData(a.org, a.site, auditId && auditId.length < 80 ? auditId : undefined));
  });
  // G11 (2026-10-13, FIX_PLAN): "I fixed this" on a technical finding. The engine's daily key-page watch judges that one finding again on
  // the website's key pages the next morning and writes the answer back on the finding row, days instead of waiting for the next monthly
  // audit. Nothing is claimed here: the app only records the request.
  app.post('/api/orgs/:orgId/sites/:siteId/technical/findings/recheck', { config: { rateLimit: { max: 60, timeWindow: '10 minutes' } } }, async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(a.site);
    const b = (req.body ?? {}) as { auditId?: unknown; findingKey?: unknown };
    return requestRecheck(a.site.domain, String(b.auditId ?? ''), String(b.findingKey ?? ''));
  });

  app.get('/api/orgs/:orgId/sites/:siteId/data/ai', async (req) => {
    const a = await portal(req);
    return shown(a.role, await aiData(a.org, a.site));
  });
  app.get('/api/orgs/:orgId/sites/:siteId/data/backlinks', async (req) => {
    const a = await portal(req);
    return shown(a.role, await backlinksData(a.org, a.site));
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
    const a = await portal(req);
    return shown(a.role, recommend(a.site, await loadBundle(a.org, a.site)));
  });
}
