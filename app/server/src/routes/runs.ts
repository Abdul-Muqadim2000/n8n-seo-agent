import { and, desc, eq, inArray, lt, type SQL } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { MODE_IDS, parseRunInput, type Page, type ReportDetail, type Run } from '@seo/shared';
import { isUuid, orgAccess } from '../auth/access';
import { db, schema } from '../db';
import { notFound, validationError } from '../lib/errors';
import { createRun, filesFor, getRunOrThrow, reportsList, toReport, toRun } from '../services/runs';

type P = { orgId: string; runId: string; reportId: string; fileId: string };

async function runWithNames(runId: string): Promise<Run | null> {
  const rows = await db
    .select({ r: schema.runs, domain: schema.sites.domain, userName: schema.users.name })
    .from(schema.runs)
    .leftJoin(schema.sites, eq(schema.runs.siteId, schema.sites.id))
    .leftJoin(schema.users, eq(schema.runs.userId, schema.users.id))
    .where(eq(schema.runs.id, runId))
    .limit(1);
  const x = rows[0];
  return x ? toRun(x.r, { siteDomain: x.domain, userName: x.userName }) : null;
}

export async function runRoutes(app: FastifyInstance) {
  app.post('/api/orgs/:orgId/runs', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'member');
    const parsed = parseRunInput(req.body);
    if (!parsed.success) throw validationError(parsed.error);
    const run = await createRun(a, parsed.data);
    return (await runWithNames(run.id))!;
  });

  app.get('/api/orgs/:orgId/runs', async (req): Promise<Page<Run>> => {
    const a = await orgAccess(req, (req.params as P).orgId);
    const q = req.query as { siteId?: string; mode?: string; status?: string; cursor?: string; limit?: string };
    const limit = Math.min(Math.max(Number(q.limit) || 25, 1), 100);
    const conds: SQL[] = [eq(schema.runs.orgId, a.org.id)];
    if (q.siteId && isUuid(q.siteId)) conds.push(eq(schema.runs.siteId, q.siteId));
    if (q.mode && (MODE_IDS as readonly string[]).includes(q.mode)) conds.push(eq(schema.runs.mode, q.mode));
    if (q.status === 'active') conds.push(inArray(schema.runs.status, ['submitting', 'accepted', 'running']));
    else if (q.status && ['submitting', 'accepted', 'running', 'completed', 'failed'].includes(q.status)) conds.push(eq(schema.runs.status, q.status));
    if (q.cursor && !Number.isNaN(Date.parse(q.cursor))) conds.push(lt(schema.runs.createdAt, new Date(q.cursor)));
    const rows = await db
      .select({ r: schema.runs, domain: schema.sites.domain, userName: schema.users.name })
      .from(schema.runs)
      .leftJoin(schema.sites, eq(schema.runs.siteId, schema.sites.id))
      .leftJoin(schema.users, eq(schema.runs.userId, schema.users.id))
      .where(and(...conds))
      .orderBy(desc(schema.runs.createdAt))
      .limit(limit + 1);
    const items = rows.slice(0, limit).map((x) => toRun(x.r, { siteDomain: x.domain, userName: x.userName }));
    return { items, nextCursor: rows.length > limit ? rows[limit - 1].r.createdAt.toISOString() : null };
  });

  app.get('/api/orgs/:orgId/runs/:runId', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId);
    if (!isUuid(p.runId)) throw notFound('Run not found');
    await getRunOrThrow(a.org.id, p.runId);
    const [run, reports] = await Promise.all([runWithNames(p.runId), reportsList(a.org.id, { runId: p.runId, limit: 100 })]);
    return { run: run!, reports: reports.reverse() };
  });

  app.get('/api/orgs/:orgId/reports', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId);
    const q = req.query as { siteId?: string; stage?: string; limit?: string; before?: string };
    return reportsList(a.org.id, {
      siteId: q.siteId && isUuid(q.siteId) ? q.siteId : undefined,
      stages: q.stage ? q.stage.split(',').slice(0, 10) : undefined,
      limit: Number(q.limit) || 50,
      before: q.before && !Number.isNaN(Date.parse(q.before)) ? new Date(q.before) : undefined,
    });
  });

  app.get('/api/orgs/:orgId/reports/:reportId', async (req): Promise<ReportDetail> => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId);
    if (!isUuid(p.reportId)) throw notFound('Report not found');
    const row = await db.query.reports.findFirst({ where: and(eq(schema.reports.orgId, a.org.id), eq(schema.reports.id, p.reportId)) });
    if (!row) throw notFound('Report not found');
    const [files, site] = await Promise.all([filesFor([row.id]), row.siteId ? db.query.sites.findFirst({ where: eq(schema.sites.id, row.siteId) }) : Promise.resolve(undefined)]);
    return { ...toReport(row, files.get(row.id) ?? [], site?.domain ?? null), payload: row.payload };
  });

  app.get('/api/orgs/:orgId/files/:fileId', async (req, reply) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId);
    if (!isUuid(p.fileId)) throw notFound('File not found');
    const f = await db.query.files.findFirst({ where: and(eq(schema.files.orgId, a.org.id), eq(schema.files.id, p.fileId)) });
    if (!f) throw notFound('File not found');
    const download = (req.query as { download?: string }).download === '1';
    // generated files are untrusted content: shown inline only as PDF or plain text, everything else downloads; the content type
    // follows the stored kind (never n8n's MIME, which could say text/html for a .txt)
    const inline = !download && (f.kind === 'pdf' || f.kind === 'txt' || f.kind === 'md' || f.kind === 'json' || f.kind === 'csv');
    const type = f.kind === 'pdf' ? 'application/pdf' : inline ? 'text/plain; charset=utf-8' : 'application/octet-stream';
    const safeName = f.fileName.replace(/[^\w.\- ]+/g, '_');
    if (f.kind !== 'pdf') reply.header('content-security-policy', 'sandbox; default-src \'none\'');
    reply
      .header('content-type', type)
      .header('content-disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(f.fileName)}`)
      .header('cache-control', 'private, max-age=3600')
      .header('x-content-type-options', 'nosniff');
    if (f.kind === 'pdf') reply.header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; object-src 'self'; plugin-types application/pdf");
    return reply.send(f.data);
  });
}
