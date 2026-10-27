import type { FastifyInstance } from 'fastify';
import { AI_EXPORT_KINDS, aiExportFileName, aiFilterFrom, clientSafePayload, isClientRole, type AiExportKind, type Role } from '@seo/shared';
import { requireVerified, siteAccess } from '../auth/access';
import { notFound } from '../lib/errors';
import { aiAnswersPage, aiCsvStream, aiImportsOverview, aiQuestionHistory } from '../services/aiWave2';
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

  // W2-A (2026-10-23): the page gets the runs, the latest run's summary and each question's result per engine; its answers page in
  // below. The filter bar's dimensions (engine, topic, buyer role, market, stage, dates) come in the query and scope `scope`.
  app.get('/api/orgs/:orgId/sites/:siteId/data/ai', async (req) => {
    const a = await portal(req);
    const filter = aiFilterFrom(req.query as Record<string, unknown>);
    const any = Object.values(filter).some(Boolean);
    // R-A9 (review 2026-10-23): the web and this API deploy separately. A web that pages the answers (/data/ai/answers) asks for the summary
    // (`answers=summary`); a web from before that reads them here, so without the flag they are still sent (remove one release later).
    const summary = String((req.query as Record<string, unknown>).answers ?? '') === 'summary';
    return shown(a.role, await aiData(a.org, a.site, { answers: summary ? 'summary' : true, filter: any ? filter : null }));
  });
  // W2-A: one page of a run's answers (the latest, or `run`), filtered, with the filter's rates and ranges
  app.get('/api/orgs/:orgId/sites/:siteId/data/ai/answers', { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } }, async (req) => {
    const a = await portal(req);
    const q = req.query as Record<string, string | undefined>;
    return shown(a.role, await aiAnswersPage(a.site, { filter: aiFilterFrom(q), run: q.run, result: q.result, text: q.q, promptId: q.promptId, page: Number(q.page), pageSize: Number(q.pageSize) }));
  });
  // W2-A: one question across the stored runs
  app.get('/api/orgs/:orgId/sites/:siteId/data/ai/questions/:promptId', async (req) => {
    const a = await portal(req);
    const id = String((req.params as P & { promptId: string }).promptId ?? '');
    if (!id || id.length > 120) throw notFound('Question not found');
    return shown(a.role, await aiQuestionHistory(a.site, id));
  });
  // W2-A: the owner's AI report uploads so far (per source)
  app.get('/api/orgs/:orgId/sites/:siteId/data/ai/imports', async (req) => {
    const a = await guard(req);
    return { sources: await aiImportsOverview(a.site) };
  });
  // W2-A: CSV downloads, streamed, company-scoped (the site access above decided the domain); not in the client portal
  app.get('/api/orgs/:orgId/sites/:siteId/data/ai/export', { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const a = await guard(req);
    const q = req.query as Record<string, unknown>;
    const kind = (AI_EXPORT_KINDS as readonly string[]).includes(String(q.kind)) ? (String(q.kind) as AiExportKind) : null;
    if (!kind) throw notFound('Unknown download');
    const body = await aiCsvStream(a.org, a.site, kind, aiFilterFrom(q));
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${aiExportFileName(kind, a.site.domain)}"`)
      .header('cache-control', 'no-store')
      .send(body);
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
    const x = await loadBundle(a.org, a.site);
    // site tasks: a step done or skipped on the website is not recommended again; open ones carry their check button
    const tasks = a.site.verifiedAt ? await import('../services/siteTasks').then((m) => m.siteTasksOf(a.org, a.site, req.log)).catch(() => undefined) : undefined;
    return shown(a.role, recommend(a.site, x, tasks));
  });
}
