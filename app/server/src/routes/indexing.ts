import type { FastifyInstance } from 'fastify';
import { requireVerified, siteAccess } from '../auth/access';
import { notFound } from '../lib/errors';
import { indexingData, indexingHistory, indexingPages } from '../services/indexing';

/**
 * Index coverage (2026-10-29, app/API.md "Index coverage"): the Indexing page's reads. Everybody in the company sees them (viewer and up,
 * verified websites only, not the client portal). Read only: the engine's daily index check writes every row. A read that fails answers
 * a "could not read" state for this page; it never fails another page.
 */

type P = { orgId: string; siteId: string };

const perUser = (max: number) => ({ rateLimit: { max, timeWindow: '10 minutes', keyGenerator: (req: { user?: { id: string } | null; ip: string }) => req.user?.id ?? req.ip } });

export async function indexingRoutes(app: FastifyInstance) {
  const guard = async (req: Parameters<typeof siteAccess>[0]) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'viewer');
    requireVerified(a.site);
    return a;
  };

  app.get('/api/orgs/:orgId/sites/:siteId/data/indexing', { config: perUser(120) }, async (req) => {
    const a = await guard(req);
    try {
      return await indexingData(a.site, req.log);
    } catch (err) {
      req.log.warn({ err: String((err as Error)?.message ?? err).slice(0, 200) }, 'index coverage not read');
      return { status: 'unreadable' as const, error: 'We could not read your index check just now. Nothing is lost; try again in a few minutes.' };
    }
  });

  // one page of a group's addresses: ?lane=new|existing&action=…&cause=…&dropped=1&page=1&pageSize=25
  app.get('/api/orgs/:orgId/sites/:siteId/data/indexing/pages', { config: perUser(240) }, async (req) => {
    const a = await guard(req);
    try {
      return { status: 'ok' as const, ...(await indexingPages(a.site, req.query as Record<string, unknown>)) };
    } catch (err) {
      req.log.warn({ err: String((err as Error)?.message ?? err).slice(0, 200) }, 'index coverage pages not read');
      return { status: 'unreadable' as const, items: [], total: 0, page: 1, pageSize: 25 };
    }
  });

  // what happened to one page over time: ?url=<an address on this website>
  app.get('/api/orgs/:orgId/sites/:siteId/data/indexing/history', { config: perUser(240) }, async (req) => {
    const a = await guard(req);
    const url = String((req.query as { url?: unknown }).url ?? '');
    let history;
    try {
      history = await indexingHistory(a.site, url);
    } catch (err) {
      req.log.warn({ err: String((err as Error)?.message ?? err).slice(0, 200) }, 'index coverage history not read');
      return { status: 'unreadable' as const, history: [] };
    }
    if (!history) throw notFound('That address is not a page of this website');
    return { status: 'ok' as const, history };
  });
}
