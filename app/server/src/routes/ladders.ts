import type { FastifyInstance } from 'fastify';
import { LADDER_ID_RE, ladderOrderSchema, ladderSettingsSchema, siteAutomationSchema, type LadderCard, type SiteAutomation } from '@seo/shared';
import { requireVerified, siteAccess } from '../auth/access';
import { notFound, parse } from '../lib/errors';
import { addKeywordToLadder, deleteLadder, reorderLadders, updateLadderSettings, updateSiteAutomation } from '../services/ladderSettings';
import { mirrorAutopilotLevel } from '../services/autopilot';
import { audit } from '../services/audit';
import { invalidateForecast } from '../services/billing';
import { proposalSwapSchema } from '@seo/shared';
import { ladderCards } from '../services/pipeline';
import { checkLadderAdd, checkSettings } from '../services/consistency';
import { closeProposalsAdded } from '../services/autoStart';

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

  // Auto / Manual, Pause / Resume of one ladder -> its card as it is now
  app.patch('/api/orgs/:orgId/sites/:siteId/ladders/:ladderId', limit, async (req): Promise<LadderCard> => {
    const a = await guard(req);
    const ladderId = ladderIdOf(req);
    const body = parse(ladderSettingsSchema, req.body);
    // MKT S5 (2026-10-27): a ladder switched to Auto or resumed while the limit is full waits as Queued: said before it is saved
    await checkSettings(req, a, { setting: 'ladder', ladderId, ...(body.mode ? { mode: body.mode } : {}), ...(body.status ? { status: body.status } : {}) });
    await updateLadderSettings(a.site, ladderId, body);
    const card = (await ladderCards(a.org, a.site)).find((c) => c.id === ladderId);
    if (!card) throw notFound('Keyword ladder not found');
    return card;
  });

  // the new priority order (every ladder once) -> the cards in that order
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

  // keyword-first "Add to my ladder": one more planned page of the ladder -> the ladder's card
  app.post('/api/orgs/:orgId/sites/:siteId/ladders/:ladderId/keywords', limit, async (req): Promise<LadderCard> => {
    const a = await guard(req);
    const ladderId = ladderIdOf(req);
    const { keyword } = parse(proposalSwapSchema, req.body);
    // MKT D4 (2026-10-27): checked like a new page (another ladder's search, a live page, a search nobody can win, another market or script)
    await checkLadderAdd(req, a, keyword, ladderId);
    await addKeywordToLadder(a.site, ladderId, keyword);
    // MKT D2: the keyword of a waiting suggestion added to a ladder instead of starting its own ladder closes the suggestion
    await Promise.resolve()
      .then(() => closeProposalsAdded(a.site.id, keyword, ladderId, a.user.id))
      .catch(() => 0);
    await audit(req, a.org.id, { action: 'site.ladder_keyword_added', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { ladderId, keyword } });
    const card = (await ladderCards(a.org, a.site)).find((c) => c.id === ladderId);
    if (!card) throw notFound('Keyword ladder not found');
    return card;
  });

  // the website's defaults (the '_site' row) -> the settings as they are now. keyword-first: `autopilotLevel` (1-3) is written to the
  // engine's `_site` row (which decides) and mirrored on the website; a change is in the audit log and the forecast follows it.
  app.patch('/api/orgs/:orgId/sites/:siteId/automation', limit, async (req): Promise<SiteAutomation> => {
    const a = await guard(req);
    const body = parse(siteAutomationSchema, req.body);
    // MKT S3 / S4 / C1 (2026-10-27): a limit below what is writing, full autopilot with Manual new ladders, a lower level that stops
    // the pages of ladders we started, a level whose schedules the credits cannot pay for
    const levelBefore = (a.site.autopilotLevel === 1 || a.site.autopilotLevel === 3 ? a.site.autopilotLevel : 2) as 1 | 2 | 3;
    await checkSettings(
      req,
      a,
      { setting: 'automation', ...body },
      body.autopilotLevel != null && body.autopilotLevel !== levelBefore ? { schedule: { autopilotLevel: body.autopilotLevel }, revert: { autopilotLevel: levelBefore } } : {},
    );
    const out = await updateSiteAutomation(a.site, body, req.log);
    if (body.autopilotLevel != null && body.autopilotLevel !== a.site.autopilotLevel) {
      await mirrorAutopilotLevel(a.site, body.autopilotLevel);
      invalidateForecast(a.org.id);
      await audit(req, a.org.id, { action: 'site.autopilot_level_changed', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { before: a.site.autopilotLevel, after: body.autopilotLevel } });
      // an open keyword proposal follows the level (an announcement at 3, a suggestion below); never fails the change itself
      const level = body.autopilotLevel;
      void import('../services/autoStart').then((m) => m.relevelProposals(a.org, a.site, level, req.log)).catch((err) => req.log.warn({ err: String(err) }, 'keyword proposals not updated'));
    }
    return out;
  });
}
