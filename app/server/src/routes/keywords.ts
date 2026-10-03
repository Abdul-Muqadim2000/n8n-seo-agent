import type { FastifyInstance } from 'fastify';
import { keywordAssessSchema, type KeywordCheck, type RecommendedKeywords } from '@seo/shared';
import { requireVerified, siteAccess } from '../auth/access';
import { parse } from '../lib/errors';
import { assessKeyword, recommendedKeywords } from '../services/keywordChecks';

type P = { orgId: string; siteId: string };

/**
 * Choosing the main keyword of a new keyword ladder (PIPELINE_FEATURE_SPEC.md §5): the keyword check (members; paid, counted in the
 * budget, 30 a day per company, the same keyword of the last 7 days free) and the recommended keywords (everyone; free). Verified
 * websites only.
 */
export async function keywordRoutes(app: FastifyInstance) {
  app.post('/api/orgs/:orgId/sites/:siteId/keywords/assess', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req): Promise<KeywordCheck> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'member');
    requireVerified(a.site);
    const body = parse(keywordAssessSchema, req.body);
    return assessKeyword(a, body);
  });

  app.get('/api/orgs/:orgId/sites/:siteId/keywords/recommended', async (req): Promise<RecommendedKeywords> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId);
    requireVerified(a.site);
    return recommendedKeywords(a.org, a.site);
  });
}
