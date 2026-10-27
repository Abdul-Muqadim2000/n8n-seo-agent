import type { FastifyInstance } from 'fastify';
import { siteAccess, requireVerified } from '../auth/access';
import { checkSiteTask, siteTasksOf, skipSiteTask } from '../services/siteTasks';

/**
 * Steps on your website (app/docs/SITE_TASKS.md, app/API.md "Site tasks"). Everybody in the company sees them; members and above check,
 * skip and bring back a step. The step is named in the body ({ key }) because a redirect's key carries an address.
 */

type P = { orgId: string; siteId: string };

const perUser = (max: number) => ({ rateLimit: { max, timeWindow: '10 minutes', keyGenerator: (req: { user?: { id: string } | null; ip: string }) => req.user?.id ?? req.ip } });

export async function siteTaskRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/sites/:siteId/tasks', { config: perUser(120) }, async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId);
    requireVerified(a.site);
    return { tasks: await siteTasksOf(a.org, a.site, req.log) };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/tasks/check', { config: perUser(30) }, async (req) => {
    const p = req.params as P;
    return { task: await checkSiteTask(await siteAccess(req, p.orgId, p.siteId, 'member'), req, req.body) };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/tasks/skip', { config: perUser(30) }, async (req) => {
    const p = req.params as P;
    return { task: await skipSiteTask(await siteAccess(req, p.orgId, p.siteId, 'member'), req, req.body, true) };
  });

  app.post('/api/orgs/:orgId/sites/:siteId/tasks/restore', { config: perUser(30) }, async (req) => {
    const p = req.params as P;
    return { task: await skipSiteTask(await siteAccess(req, p.orgId, p.siteId, 'member'), req, req.body, false) };
  });
}
