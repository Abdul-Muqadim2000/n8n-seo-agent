import type { FastifyInstance } from 'fastify';
import { LADDER_ID_RE, ladderOrderSchema, ladderSettingsSchema, siteAutomationSchema, type LadderCard, type SiteAutomation } from '@seo/shared';
import { requireVerified, siteAccess } from '../auth/access';
import { notFound, parse } from '../lib/errors';
import { deleteLadder, reorderLadders, updateLadderSettings, updateSiteAutomation } from '../services/ladderSettings';
import { ladderCards } from '../services/pipeline';

type P = { orgId: string; siteId: string; ladderId?: string };

/**
 * The person's controls over a website's keyword ladders and its pipeline defaults (PIPELINE_FEATURE_SPEC.md §6-7), written to
 * n8n's seo_ladder_settings. Admins of a verified website only; a ladder that is not one of the domain's is a 404.
 */
export async function ladderRoutes(app: FastifyInstance) {
  const guard = async (req: Parameters<typeof siteAccess>[0]) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    requireVerified(a.site);
    return a;
  };
  const ladderIdOf = (req: { params: unknown }) => {
    const id = String((req.params as P).ladderId ?? '');
    if (!LADDER_ID_RE.test(id)) throw notFound('Keyword ladder not found');
    return id;
  };
  const limit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

  // Auto / Manual, Pause / Resume of one ladder → its card as it is now
  app.patch('/api/orgs/:orgId/sites/:siteId/ladders/:ladderId', limit, async (req): Promise<LadderCard> => {
    const a = await guard(req);
    const ladderId = ladderIdOf(req);
    const body = parse(ladderSettingsSchema, req.body);
    await updateLadderSettings(a.site, ladderId, body);
    const card = (await ladderCards(a.org, a.site)).find((c) => c.id === ladderId);
    if (!card) throw notFound('Keyword ladder not found');
    return card;
  });

  // the new priority order (every ladder once) → the cards in that order
  app.put('/api/orgs/:orgId/sites/:siteId/ladders/order', limit, async (req): Promise<LadderCard[]> => {
    const a = await guard(req);
    const { ladderIds } = parse(ladderOrderSchema, req.body);
    await reorderLadders(a.site, ladderIds);
    return ladderCards(a.org, a.site);
  });

  // removes the ladder's pages, settings and rank checks in n8n (written pages stay in the content log and the reports)
  app.delete('/api/orgs/:orgId/sites/:siteId/ladders/:ladderId', limit, async (req, reply) => {
    const a = await guard(req);
    await deleteLadder(a.site, ladderIdOf(req));
    return reply.status(204).send();
  });

  // the website's defaults (the '_site' row) → the settings as they are now
  app.patch('/api/orgs/:orgId/sites/:siteId/automation', limit, async (req): Promise<SiteAutomation> => {
    const a = await guard(req);
    const body = parse(siteAutomationSchema, req.body);
    return updateSiteAutomation(a.site, body);
  });
}
