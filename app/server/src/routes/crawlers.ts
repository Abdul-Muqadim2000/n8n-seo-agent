import type { Readable } from 'node:stream';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CRAWLER_LIMITS, crawlerSettingsSchema, isLogPushKey, LOG_PUSH_KEY, type LogPushKeyCreated, type LogUploadAccepted } from '@seo/shared';
import { isUuid, requireVerified, siteAccess } from '../auth/access';
import { config } from '../config';
import { sqlClient } from '../db';
import { randomToken, safeEqual, sha256 } from '../lib/crypto';
import { badRequest, HttpError, parse } from '../lib/errors';
import { crawlerCsv, crawlerData, ingestsOf, toIngestView } from '../services/crawlers/analytics';
import { queueIngest, spool } from '../services/crawlers/jobs';
import { audit } from '../services/audit';
import { pgIso } from '../services/crawlers/pgTime';

/**
 * Gap #6 (app/docs/LOG_ANALYTICS.md): the Crawlers page's routes. Two plugins:
 *  - `crawlerRoutes`: JSON — the dashboard, the ingest history, CSV exports, retention, the push key, deleting the data;
 *  - `crawlerStreamRoutes`: raw bodies, streamed to disk without ever being held in memory — the upload from the app (session,
 *    member) and the push endpoint for Cloudflare Logpush and log drains (`POST /api/ingest/logs/:siteId`, the site's push key in
 *    `X-Alaventra-Log-Key`). Its own content-type parser hands the request stream through untouched, so a 1 GB file never meets
 *    Fastify's JSON body limit.
 */

type P = { orgId: string; siteId: string };

async function viewerSite(req: FastifyRequest) {
  const p = req.params as P;
  const a = await siteAccess(req, p.orgId, p.siteId);
  requireVerified(a.site);
  return a;
}

export async function crawlerRoutes(app: FastifyInstance) {
  const base = '/api/orgs/:orgId/sites/:siteId/crawlers';

  app.get(base, async (req) => {
    const a = await viewerSite(req);
    return crawlerData(a.site, (req.query as { days?: string }).days);
  });

  app.get(`${base}/ingests`, async (req) => {
    const a = await viewerSite(req);
    return { items: await ingestsOf(a.site.id, 50) };
  });

  app.get(`${base}/export`, { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const a = await viewerSite(req);
    const q = req.query as { kind?: string; days?: string };
    const kind = q.kind === 'pages' || q.kind === 'hits' ? q.kind : 'daily';
    const f = await crawlerCsv(a.site, kind, q.days);
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${f.name.replace(/[^\w.-]+/g, '-')}"`)
      .header('cache-control', 'no-store')
      .send(f.body);
  });

  app.put(`${base}/settings`, async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    const b = parse(crawlerSettingsSchema, req.body ?? {});
    await sqlClient`
      insert into log_sources (site_id, org_id, retention_days, updated_at) values (${a.site.id}, ${a.org.id}, ${b.retentionDays}, now())
      on conflict (site_id) do update set retention_days = excluded.retention_days, updated_at = now()`;
    await audit(req, a.org.id, { action: 'crawler.retention_changed', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { retentionDays: b.retentionDays } });
    return { retentionDays: b.retentionDays };
  });

  // a new key replaces the old one at once (the old one stops working with the next push)
  app.post(`${base}/push-key`, { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req): Promise<LogPushKeyCreated> => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    requireVerified(a.site);
    const token = LOG_PUSH_KEY.prefix + randomToken(32);
    const prefix = token.slice(0, LOG_PUSH_KEY.displayLength);
    const [row] = await sqlClient<{ push_key_created_at: Date | string }[]>`
      insert into log_sources (site_id, org_id, push_key_hash, push_key_prefix, push_key_created_at, push_key_created_by, updated_at)
      values (${a.site.id}, ${a.org.id}, ${sha256(token)}, ${prefix}, now(), ${a.user.id}, now())
      on conflict (site_id) do update set push_key_hash = excluded.push_key_hash, push_key_prefix = excluded.push_key_prefix,
        push_key_created_at = excluded.push_key_created_at, push_key_created_by = excluded.push_key_created_by, updated_at = now()
      returning push_key_created_at`;
    req.log.info({ site: a.site.id, by: a.user.id }, 'crawler log push key created');
    await audit(req, a.org.id, { action: 'crawler.push_key_created', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { prefix } });
    return { token, prefix, endpoint: `${config.appUrl}/api/ingest/logs/${a.site.id}`, header: LOG_PUSH_KEY.header, createdAt: pgIso(row.push_key_created_at) ?? new Date().toISOString() };
  });

  app.delete(`${base}/push-key`, async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    await sqlClient`update log_sources set push_key_hash = null, push_key_prefix = null, push_key_created_at = null, updated_at = now() where site_id = ${a.site.id}`;
    req.log.info({ site: a.site.id, by: a.user.id }, 'crawler log push key revoked');
    await audit(req, a.org.id, { action: 'crawler.push_key_revoked', target: { type: 'site', id: a.site.id, label: a.site.domain } });
    return { ok: true };
  });

  // the right to be forgotten, for the website: every crawler row, total and history row of it, now
  app.delete(`${base}/data`, async (req) => {
    const p = req.params as P;
    const a = await siteAccess(req, p.orgId, p.siteId, 'admin');
    const confirm = String((req.body as { confirm?: string } | null)?.confirm ?? '').trim().toLowerCase();
    if (confirm !== a.site.domain.toLowerCase()) throw badRequest(`Type ${a.site.domain} to confirm`, { confirm: `Type ${a.site.domain} to confirm` });
    const busy = await sqlClient`select 1 from log_ingests where site_id = ${a.site.id} and status in ('queued', 'processing') limit 1`;
    if (busy.length) throw new HttpError(409, 'A log file is being read for this website. Delete the data when it has finished.', 'ingest_running');
    const [h, d, pd, i] = await sqlClient.begin((tx) => [
      tx`delete from crawler_hits where site_id = ${a.site.id}`,
      tx`delete from crawler_daily where site_id = ${a.site.id}`,
      tx`delete from crawler_page_daily where site_id = ${a.site.id}`,
      tx`delete from log_ingests where site_id = ${a.site.id}`,
    ]);
    req.log.info({ site: a.site.id, by: a.user.id }, 'crawler log data deleted');
    await audit(req, a.org.id, { action: 'crawler.data_deleted', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { requests: h.count, files: i.count } });
    return { ok: true, deleted: { requests: h.count, dailyRows: d.count + pd.count, files: i.count } };
  });
}

/** The raw request body as a stream (our content-type parser passes it through). */
const bodyStream = (req: FastifyRequest): Readable => ((req.body as Readable | undefined) ?? req.raw) as Readable;

const pushBucket = (req: FastifyRequest) => 'push:' + String((req.params as { siteId?: string }).siteId ?? req.ip);

export async function crawlerStreamRoutes(app: FastifyInstance) {
  // this plugin only: every body is a stream we spool ourselves
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', (_req, payload, done) => done(null, payload));

  app.post(
    '/api/orgs/:orgId/sites/:siteId/crawlers/upload',
    { config: { rateLimit: { max: CRAWLER_LIMITS.uploadsPerHour, timeWindow: '1 hour' } } },
    async (req, reply): Promise<LogUploadAccepted> => {
      const p = req.params as P;
      const a = await siteAccess(req, p.orgId, p.siteId, 'member');
      requireVerified(a.site);
      const declared = Number(req.headers['content-length'] ?? 0);
      if (declared > CRAWLER_LIMITS.uploadMaxBytes) {
        reply.header('connection', 'close');
        throw new HttpError(413, `The file is larger than ${CRAWLER_LIMITS.uploadMaxBytes / 1024 / 1024} MB. Split it or compress it with gzip.`, 'too_large');
      }
      const name = String((req.query as { name?: string }).name ?? '').replace(/[^\w.\- ()]+/g, '_').slice(0, 200) || 'access.log';
      const spooled = await spool(bodyStream(req), CRAWLER_LIMITS.uploadMaxBytes);
      if (!spooled.bytes) throw badRequest('The file is empty.', undefined, 'empty');
      // written before the job is queued: the worker starts the moment the row exists
      await audit(req, a.org.id, { action: 'crawler.log_uploaded', target: { type: 'site', id: a.site.id, label: a.site.domain }, details: { fileName: name, bytes: spooled.bytes } });
      const r = await queueIngest({ orgId: a.org.id, siteId: a.site.id, source: 'upload', fileName: name, createdBy: a.user.id, spooled });
      reply.status(r.duplicate ? 200 : 202);
      return { ingest: toIngestView(r.ingest), duplicate: r.duplicate };
    },
  );

  // Cloudflare Logpush (HTTP destination) and any NDJSON log drain. One answer for every refusal, so the endpoint tells a
  // stranger nothing about which websites exist.
  app.post('/api/ingest/logs/:siteId', { config: { rateLimit: { max: CRAWLER_LIMITS.pushesPerMinute, timeWindow: '1 minute', keyGenerator: pushBucket } } }, async (req, reply) => {
    const siteId = (req.params as { siteId: string }).siteId;
    const h = req.headers[LOG_PUSH_KEY.header.toLowerCase()];
    const auth = req.headers.authorization;
    const token = typeof h === 'string' ? h.trim() : typeof auth === 'string' && /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
    const refuse = () => {
      reply.header('connection', 'close');
      return reply.status(401).send({ error: 'This log push key is not valid for this endpoint', code: 'push_key_invalid' });
    };
    if (!isUuid(siteId) || !isLogPushKey(token)) return refuse();
    const [src] = await sqlClient<{ org_id: string; push_key_hash: string | null; verified_at: Date | null }[]>`
      select ls.org_id, ls.push_key_hash, s.verified_at from log_sources ls join sites s on s.id = ls.site_id where ls.site_id = ${siteId}`;
    if (!src?.push_key_hash || !src.verified_at || !safeEqual(sha256(token), src.push_key_hash)) return refuse();
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > CRAWLER_LIMITS.pushMaxBytes) {
      reply.header('connection', 'close');
      return reply.status(413).send({ error: `A push may be at most ${CRAWLER_LIMITS.pushMaxBytes / 1024 / 1024} MB (set max_upload_bytes lower)`, code: 'too_large' });
    }
    const spooled = await spool(bodyStream(req), CRAWLER_LIMITS.pushMaxBytes);
    await sqlClient`update log_sources set last_push_at = now() where site_id = ${siteId}`;
    if (!spooled.bytes) return reply.status(200).send({ ok: true, empty: true });
    const r = await queueIngest({ orgId: src.org_id, siteId, source: 'push', fileName: String(req.headers['content-type'] ?? '').slice(0, 60), createdBy: null, spooled });
    // 200 for a batch we already have too: a sender retrying after a timeout must stop retrying
    return reply.status(200).send({ ok: true, ingestId: r.ingest.id, duplicate: r.duplicate });
  });
}
