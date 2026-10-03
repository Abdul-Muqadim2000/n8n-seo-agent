import type { FastifyInstance } from 'fastify';
import { ingestCallback, orgByHookToken } from '../services/runs';

/** n8n → app: every callback of a company's runs and scheduled reports. The company is identified by the token in the URL. */
export async function hookRoutes(app: FastifyInstance) {
  app.post('/api/hooks/n8n/:token', { bodyLimit: 40 * 1024 * 1024, config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (req, reply) => {
    const org = await orgByHookToken((req.params as { token: string }).token);
    if (!org) return reply.status(404).send({ error: 'Unknown callback' });
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply.status(400).send({ error: 'JSON object expected' });
    const r = await ingestCallback(org, body as Record<string, unknown>);
    req.log.info({ org: org.id, stage: r.stage, run: r.runId, report: r.reportId, ...(r.ladderWon !== undefined ? { ladderWon: r.ladderWon } : {}), ...(r.prefsApplied !== undefined ? { prefsApplied: r.prefsApplied } : {}) }, 'n8n callback stored');
    return { ok: true, report_id: r.reportId };
  });
}
