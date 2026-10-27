import type { FastifyInstance } from 'fastify';
import { orgAccess, siteAccess } from '../auth/access';
import { acceptPrefilled, approve, deleteFact, deleteVersion, getFacts, getReview, putAnswers, putFact, putVersion, startFinalize } from '../services/pageReview';

/**
 * H3 (2026-10-28): the review of a written page (services/pageReview.ts, app/API.md "Page review"). Everybody in the company reads it;
 * members and above answer, edit, ask for the final version and approve; the website's business details are changed by members and above.
 */

type P = { orgId: string; reportId: string; siteId: string; factKey: string };

const perUser = (max: number) => ({ rateLimit: { max, timeWindow: '1 minute', keyGenerator: (req: { user?: { id: string } | null; ip: string }) => req.user?.id ?? req.ip } });

export async function pageReviewRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/reports/:reportId/review', async (req) => {
    const p = req.params as P;
    return getReview(await orgAccess(req, p.orgId), p.reportId);
  });

  app.put('/api/orgs/:orgId/reports/:reportId/review/answers', { config: perUser(60) }, async (req) => {
    const p = req.params as P;
    return putAnswers(await orgAccess(req, p.orgId, 'member'), req, p.reportId, req.body);
  });

  app.post('/api/orgs/:orgId/reports/:reportId/review/accept-prefilled', { config: perUser(20) }, async (req) => {
    const p = req.params as P;
    return acceptPrefilled(await orgAccess(req, p.orgId, 'member'), req, p.reportId);
  });

  app.put('/api/orgs/:orgId/reports/:reportId/review/version', { config: perUser(30), bodyLimit: 2 * 1024 * 1024 }, async (req) => {
    const p = req.params as P;
    return putVersion(await orgAccess(req, p.orgId, 'member'), req, p.reportId, req.body);
  });

  app.delete('/api/orgs/:orgId/reports/:reportId/review/version', { config: perUser(30) }, async (req) => {
    const p = req.params as P;
    return deleteVersion(await orgAccess(req, p.orgId, 'member'), req, p.reportId);
  });

  app.post('/api/orgs/:orgId/reports/:reportId/review/finalize', { config: perUser(6) }, async (req) => {
    const p = req.params as P;
    return startFinalize(await orgAccess(req, p.orgId, 'member'), req, p.reportId);
  });

  app.post('/api/orgs/:orgId/reports/:reportId/review/approve', { config: perUser(20) }, async (req) => {
    const p = req.params as P;
    return approve(await orgAccess(req, p.orgId, 'member'), req, p.reportId, req.body);
  });

  app.get('/api/orgs/:orgId/sites/:siteId/facts', async (req) => {
    const p = req.params as P;
    return getFacts(await siteAccess(req, p.orgId, p.siteId));
  });

  app.put('/api/orgs/:orgId/sites/:siteId/facts/:factKey', { config: perUser(60) }, async (req) => {
    const p = req.params as P;
    return putFact(await siteAccess(req, p.orgId, p.siteId, 'member'), req, p.factKey, req.body);
  });

  app.delete('/api/orgs/:orgId/sites/:siteId/facts/:factKey', { config: perUser(60) }, async (req) => {
    const p = req.params as P;
    return deleteFact(await siteAccess(req, p.orgId, p.siteId, 'member'), req, p.factKey);
  });
}
