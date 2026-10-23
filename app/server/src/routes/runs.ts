import { and, desc, eq, inArray, lt, type SQL } from 'drizzle-orm';
import { audit } from '../services/audit';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { isClientRole, isShareToken, MODE_IDS, parseRunInput, RUN_STATUSES, SHARE, shareDays, shareRefusal, shareState, shareUrl, type Page, type ReportDetail, type Run } from '@seo/shared';
import { isUuid, orgAccess } from '../auth/access';
import { config } from '../config';
import { db, schema } from '../db';
import type { FileRow } from '../db/schema';
import { HttpError, notFound, validationError } from '../lib/errors';
import { deliverReport } from '../services/reportDelivery';
import { createRun, creditsForRuns, filesFor, getRunOrThrow, reportCredits, reportsList, runJoinedResult, toReport, toRun } from '../services/runs';
import { createShare, listShares, markOpened, revokeShare, sharedFile, sharedReport, shareByToken } from '../services/shareLinks';
import { payloadFor } from '../services/brandOf';
import { portalFile, portalFiles, shareFile } from '../services/portalDocs';
import { baseUrlFor } from '../services/portalMail';

type P = { orgId: string; runId: string; reportId: string; fileId: string; shareId: string; token: string };

/**
 * A generated file as a response. Generated files are untrusted content: shown inline only as PDF or plain text, everything else
 * downloads; the content type follows the stored kind (never n8n's MIME, which could say text/html for a .txt). The same handling is
 * used for a company's own files and for the files of a shared report (G15), one implementation, one set of headers.
 */
export function sendFile(reply: FastifyReply, f: Pick<FileRow, 'kind' | 'fileName' | 'data'>, download: boolean) {
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
}

async function runWithNames(runId: string): Promise<Run | null> {
  const rows = await db
    .select({ r: schema.runs, domain: schema.sites.domain, userName: schema.users.name, keyName: schema.apiKeys.name })
    .from(schema.runs)
    .leftJoin(schema.sites, eq(schema.runs.siteId, schema.sites.id))
    .leftJoin(schema.users, eq(schema.runs.userId, schema.users.id))
    .leftJoin(schema.apiKeys, eq(schema.runs.apiKeyId, schema.apiKeys.id))
    .where(eq(schema.runs.id, runId))
    .limit(1);
  const x = rows[0];
  if (!x) return null;
  const credits = await creditsForRuns(x.r.orgId, [x.r]);
  return toRun(x.r, { siteDomain: x.domain, userName: x.userName, apiKeyName: x.keyName, credits: credits.get(x.r.id)! });
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
    else if (q.status && (RUN_STATUSES as readonly string[]).includes(q.status)) conds.push(eq(schema.runs.status, q.status));
    if (q.cursor && !Number.isNaN(Date.parse(q.cursor))) conds.push(lt(schema.runs.createdAt, new Date(q.cursor)));
    const rows = await db
      .select({ r: schema.runs, domain: schema.sites.domain, userName: schema.users.name, keyName: schema.apiKeys.name })
      .from(schema.runs)
      .leftJoin(schema.sites, eq(schema.runs.siteId, schema.sites.id))
      .leftJoin(schema.users, eq(schema.runs.userId, schema.users.id))
      .leftJoin(schema.apiKeys, eq(schema.runs.apiKeyId, schema.apiKeys.id))
      .where(and(...conds))
      .orderBy(desc(schema.runs.createdAt))
      .limit(limit + 1);
    // credits (app/docs/CREDITS.md): one ledger read for the page, not one per run
    const page = rows.slice(0, limit);
    const credits = await creditsForRuns(a.org.id, page.map((x) => x.r));
    const items = page.map((x) => toRun(x.r, { siteDomain: x.domain, userName: x.userName, apiKeyName: x.keyName, credits: credits.get(x.r.id)! }));
    return { items, nextCursor: rows.length > limit ? rows[limit - 1].r.createdAt.toISOString() : null };
  });

  app.get('/api/orgs/:orgId/runs/:runId', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId);
    if (!isUuid(p.runId)) throw notFound('Run not found');
    const row = await getRunOrThrow(a.org.id, p.runId);
    // R-A3: a check joined to the website's open run shows that run's report once it has arrived
    const [run, reports, joined] = await Promise.all([runWithNames(p.runId), reportsList(a.org.id, { runId: p.runId, limit: 100 }), runJoinedResult(a.org.id, row)]);
    return { run: run!, reports: reports.reverse(), ...(joined ? { joined } : {}) };
  });

  // G5: reports are part of the client portal (client viewers and approvers read them; files are rebranded below)
  app.get('/api/orgs/:orgId/reports', async (req) => {
    const a = await orgAccess(req, (req.params as P).orgId, 'client_viewer');
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
    const a = await orgAccess(req, p.orgId, 'client_viewer');
    if (!isUuid(p.reportId)) throw notFound('Report not found');
    const row = await db.query.reports.findFirst({ where: and(eq(schema.reports.orgId, a.org.id), eq(schema.reports.id, p.reportId)) });
    if (!row) throw notFound('Report not found');
    const [files, site] = await Promise.all([filesFor([row.id]), row.siteId ? db.query.sites.findFirst({ where: eq(schema.sites.id, row.siteId) }) : Promise.resolve(undefined)]);
    // G5: a client person gets no cost figures, and in a white-label workspace no file we cannot rebrand (the engine's PDF: the
    // portal offers the branded print view instead)
    const shown = await portalFiles(a, files.get(row.id) ?? []);
    // credits (app/docs/CREDITS.md): nobody gets the provider cost; the company's own people get the credits the work used
    const credits = isClientRole(a.role) ? null : await reportCredits(a.org.id, row);
    return { ...toReport(row, shown, site?.domain ?? null), payload: payloadFor(a.role, row.payload, credits) };
  });

  app.get('/api/orgs/:orgId/files/:fileId', async (req, reply) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'client_viewer');
    if (!isUuid(p.fileId)) throw notFound('File not found');
    const f = await db.query.files.findFirst({ where: and(eq(schema.files.orgId, a.org.id), eq(schema.files.id, p.fileId)) });
    if (!f) throw notFound('File not found');
    const branded = await portalFile(a, f);
    if (!branded) throw notFound('This file is offered as a printable page in your portal.');
    return sendFile(reply, branded, (req.query as { download?: string }).download === '1');
  });

  /**
   * B-R1: send one report now, to the channels the company set up. Admins only (it sends mail in the company's name), and it still
   * goes through the same readiness decision as an automatic delivery, "send it anyway" is not offered, because a report the run
   * marked not ready is not a report yet, whoever asks.
   */
  app.post('/api/orgs/:orgId/reports/:reportId/deliver', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.reportId)) throw notFound('Report not found');
    const res = await deliverReport(a.org.id, p.reportId, req.log, { force: true });
    return res;
  });

  // ---- G15: expiring, revocable, read-only links to ONE report, for somebody with no account ----
  // The owner's side needs the admin role (a viewer can read a report but must not hand it outside the company); the public side needs
  // nothing but the token, so both of its routes are rate-limited by IP and say the same thing for a wrong, a revoked and an expired
  // token, a guess learns nothing. GET only: there is no shared write anywhere.

  app.post('/api/orgs/:orgId/reports/:reportId/shares', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.reportId)) throw notFound('Report not found');
    const body = (req.body ?? {}) as { days?: unknown };
    if (body.days != null && body.days !== '' && !Number.isFinite(Number(body.days)))
      throw new HttpError(400, `Choose how many days the link should last (${SHARE.minDays}-${SHARE.maxDays}).`, 'validation', { days: 'Must be a number of days' });
    const { link, token } = await createShare({ org: a.org, user: a.user, reportId: p.reportId, days: body.days == null || body.days === '' ? SHARE.defaultDays : body.days });
    await audit(req, a.org.id, { action: 'share.created', target: { type: 'report', id: p.reportId, label: null }, details: { shareId: link.id, expiresAt: link.expiresAt } });
    // the token is returned exactly once: it is stored only as a hash
    return { ...link, url: shareUrl(await baseUrlFor(a.org), token), days: shareDays(body.days == null || body.days === '' ? SHARE.defaultDays : body.days) };
  });

  app.get('/api/orgs/:orgId/reports/:reportId/shares', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.reportId)) throw notFound('Report not found');
    return { items: await listShares(a.org.id, p.reportId), defaultDays: SHARE.defaultDays, maxDays: SHARE.maxDays, minDays: SHARE.minDays };
  });

  app.delete('/api/orgs/:orgId/reports/:reportId/shares/:shareId', async (req) => {
    const p = req.params as P;
    const a = await orgAccess(req, p.orgId, 'admin');
    if (!isUuid(p.reportId) || !isUuid(p.shareId)) throw notFound('Share link not found');
    const revoked = await revokeShare(a.org.id, p.reportId, p.shareId);
    await audit(req, a.org.id, { action: 'share.revoked', target: { type: 'report', id: p.reportId, label: null }, details: { shareId: p.shareId } });
    return revoked;
  });

  /** The one report behind a live link. No session, no company id in the URL: the token itself names the report. */
  app.get('/api/share/:token', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const p = req.params as P;
    const gone = () => new HttpError(404, shareRefusal('missing'), 'share_invalid');
    if (!isShareToken(p.token)) throw gone();
    const share = await shareByToken(p.token);
    const state = shareState(share);
    if (state !== 'live') throw new HttpError(404, shareRefusal(state), state === 'missing' ? 'share_invalid' : state === 'revoked' ? 'share_revoked' : 'share_expired');
    const report = await sharedReport(share!);
    if (!report) throw gone();
    await markOpened(share!.id);
    return { report };
  });

  /** One file of that report. The file must belong to the shared report, so a file id from anywhere else is a 404. */
  app.get('/api/share/:token/files/:fileId', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const p = req.params as P;
    const gone = () => new HttpError(404, shareRefusal('missing'), 'share_invalid');
    if (!isShareToken(p.token) || !isUuid(p.fileId)) throw gone();
    const share = await shareByToken(p.token);
    if (shareState(share) !== 'live') throw gone();
    const raw = await sharedFile(share!, p.fileId);
    // G5: a white-label client workspace's shared files carry the agency's name, never ours
    const f = raw ? await shareFile(share!.orgId, raw) : null;
    if (!f) throw gone();
    await markOpened(share!.id);
    return sendFile(reply, f, (req.query as { download?: string }).download === '1');
  });
}
