import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { hostname } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import type { FastifyBaseLogger } from 'fastify';
import { CRAWLER_LIMITS, type IngestSource, type IngestStats } from '@seo/shared';
import { config } from '../../config';
import { sqlClient } from '../../db';
import type { LogIngestRow } from '../../db/schema';
import { HttpError } from '../../lib/errors';
import { processIngestFile } from './ingest';
import { refreshRanges } from './ranges';
import type { Dns } from './verify';

/**
 * The background side of log ingestion (app/docs/LOG_ANALYTICS.md §4): a received body is spooled to a file on this server (hashed
 * and size-checked while it streams), a `log_ingests` row is queued, and the worker on the same server processes the queue one job
 * at a time. Retention, the daily IP-list refresh and the clean-up of spool files run on timers here too (CRAWLER_JOBS=false stops
 * all of it, e.g. on a second server or in tests).
 */

const HOST = hostname();
export const spoolDir = () => config.crawlers.spoolDir;

export class TooLarge extends HttpError {
  constructor(max: number) {
    super(413, `The file is larger than ${Math.round(max / 1024 / 1024)} MB. Split it (one day or one week per file) or compress it with gzip.`, 'too_large');
  }
}

/** Streams a body to a spool file: SHA-256 and size on the way, refused past `maxBytes` (the partial file is removed). */
export async function spool(body: Readable, maxBytes: number): Promise<{ path: string; bytes: number; sha256: string }> {
  await mkdir(spoolDir(), { recursive: true, mode: 0o700 });
  const path = join(spoolDir(), `${randomUUID()}.log`);
  const hash = createHash('sha256');
  let bytes = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      bytes += chunk.length;
      if (bytes > maxBytes) return cb(new TooLarge(maxBytes));
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  try {
    await pipeline(body, meter, createWriteStream(path, { mode: 0o600 }));
  } catch (e) {
    await rm(path, { force: true });
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'The upload was interrupted before the whole file arrived. Please try again.', 'upload_interrupted');
  }
  return { path, bytes, sha256: hash.digest('hex') };
}

export interface QueueResult {
  ingest: LogIngestRow;
  duplicate: boolean;
}

/** Queues a spooled body; the same bytes already received for this website are not queued twice. */
export async function queueIngest(a: { orgId: string; siteId: string; source: IngestSource; fileName: string; createdBy: string | null; spooled: { path: string; bytes: number; sha256: string } }): Promise<QueueResult> {
  const same = await sqlClient<LogIngestRow[]>`
    select id, org_id as "orgId", site_id as "siteId", source, file_name as "fileName", status, host, spool_path as "spoolPath", bytes, sha256, format,
           stats, error, created_by as "createdBy", created_at as "createdAt", started_at as "startedAt", finished_at as "finishedAt"
    from log_ingests where site_id = ${a.siteId} and sha256 = ${a.spooled.sha256} and status <> 'failed' limit 1`;
  if (same[0]) {
    await rm(a.spooled.path, { force: true });
    return { ingest: same[0], duplicate: true };
  }
  try {
    const rows = await sqlClient<LogIngestRow[]>`
      insert into log_ingests (org_id, site_id, source, file_name, status, host, spool_path, bytes, sha256, created_by)
      values (${a.orgId}, ${a.siteId}, ${a.source}, ${a.fileName.slice(0, 200)}, 'queued', ${HOST}, ${a.spooled.path}, ${a.spooled.bytes}, ${a.spooled.sha256}, ${a.createdBy})
      returning id, org_id as "orgId", site_id as "siteId", source, file_name as "fileName", status, host, spool_path as "spoolPath", bytes, sha256, format,
                stats, error, created_by as "createdBy", created_at as "createdAt", started_at as "startedAt", finished_at as "finishedAt"`;
    kick();
    return { ingest: rows[0], duplicate: false };
  } catch (e) {
    await rm(a.spooled.path, { force: true });
    // two identical bodies at the same moment (a push retried while the first was still arriving)
    if ((e as { code?: string }).code === '23505') {
      const again = await sqlClient<LogIngestRow[]>`select id, org_id as "orgId", site_id as "siteId", source, file_name as "fileName", status, host, spool_path as "spoolPath", bytes, sha256, format, stats, error, created_by as "createdBy", created_at as "createdAt", started_at as "startedAt", finished_at as "finishedAt" from log_ingests where site_id = ${a.siteId} and sha256 = ${a.spooled.sha256} and status <> 'failed' limit 1`;
      if (again[0]) return { ingest: again[0], duplicate: true };
    }
    throw e;
  }
}

// ---------------------------------------------------------------- the worker

let running = false;
let again = false;
let log: FastifyBaseLogger | null = null;
let dnsForJobs: Dns | undefined;

/** tests: answer DNS from a table instead of the network */
export function setJobDns(d: Dns | undefined) {
  dnsForJobs = d;
}

export function kick(): void {
  if (!config.crawlers.jobs) return;
  if (running) {
    again = true;
    return;
  }
  setImmediate(() => void drain());
}

/** Processes queued jobs of this server until none is left. Resolves when idle (tests await it). */
export async function drain(): Promise<number> {
  if (running) {
    again = true;
    return 0;
  }
  running = true;
  let done = 0;
  try {
    do {
      again = false;
      for (;;) {
        const job = await claim();
        if (!job) break;
        await runJob(job);
        done++;
      }
    } while (again);
  } finally {
    running = false;
  }
  return done;
}

async function claim(): Promise<{ id: string; siteId: string; spoolPath: string } | null> {
  const rows = await sqlClient<{ id: string; site_id: string; spool_path: string }[]>`
    update log_ingests set status = 'processing', started_at = now()
    where id = (select id from log_ingests where status = 'queued' and host = ${HOST} order by created_at for update skip locked limit 1)
    returning id, site_id, spool_path`;
  return rows[0] ? { id: rows[0].id, siteId: rows[0].site_id, spoolPath: rows[0].spool_path } : null;
}

async function runJob(job: { id: string; siteId: string; spoolPath: string }): Promise<void> {
  const t0 = Date.now();
  try {
    const site = await sqlClient<{ domain: string }[]>`select domain from sites where id = ${job.siteId}`;
    if (!site[0]) throw new Error('The website was deleted');
    const r = await processIngestFile({
      ingestId: job.id,
      siteId: job.siteId,
      domain: site[0].domain,
      path: job.spoolPath,
      dns: dnsForJobs,
      onProgress: async (s: IngestStats) => {
        await sqlClient`update log_ingests set stats = ${sqlClient.json(s as never)} where id = ${job.id}`;
      },
    });
    const error = r.truncated ? `Only the first ${CRAWLER_LIMITS.maxLines.toLocaleString('en-US')} lines were read. Split the file to load the rest.` : '';
    await sqlClient`update log_ingests set status = 'done', format = ${r.format}, stats = ${sqlClient.json(r.stats as never)}, error = ${error}, finished_at = now(), spool_path = '' where id = ${job.id}`;
    log?.info({ ingest: job.id, lines: r.stats.lines, bots: r.stats.bots, ms: Date.now() - t0 }, 'crawler log ingested');
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 500);
    await sqlClient`update log_ingests set status = 'failed', error = ${msg}, finished_at = now(), spool_path = '' where id = ${job.id}`.catch(() => undefined);
    log?.warn({ ingest: job.id, err: msg }, 'crawler log ingest failed');
  } finally {
    // the raw body (addresses of people included) never outlives its job
    await rm(job.spoolPath, { force: true }).catch(() => undefined);
  }
}

/** After a restart: a job this server was processing is queued again if its file survived, failed otherwise. */
export async function recover(): Promise<void> {
  const rows = await sqlClient<{ id: string; spool_path: string }[]>`select id, spool_path from log_ingests where status = 'processing' and host = ${HOST}`;
  for (const r of rows) {
    const exists = r.spool_path ? await stat(r.spool_path).then(() => true).catch(() => false) : false;
    if (exists) await sqlClient`update log_ingests set status = 'queued', started_at = null where id = ${r.id}`;
    else await sqlClient`update log_ingests set status = 'failed', error = 'The server restarted while this file was being read. Upload it again.', finished_at = now() where id = ${r.id}`;
  }
}

/** Retention: raw rows by each site's setting, totals after 400 days, history rows, and spool files nobody owns. */
export async function cleanup(): Promise<{ hits: number; rollups: number; ingests: number }> {
  const hits = await sqlClient`
    delete from crawler_hits h using (
      select s.id as site_id, coalesce(ls.retention_days, ${CRAWLER_LIMITS.defaultRetentionDays}) as days from sites s left join log_sources ls on ls.site_id = s.id
    ) r where h.site_id = r.site_id and h.at < now() - make_interval(days => r.days)`;
  const d1 = await sqlClient`delete from crawler_daily where day < current_date - ${CRAWLER_LIMITS.rollupDays}::int`;
  const d2 = await sqlClient`delete from crawler_page_daily where day < current_date - ${CRAWLER_LIMITS.rollupDays}::int`;
  const ing = await sqlClient`
    delete from log_ingests where status in ('done', 'failed') and (
      (source = 'push' and created_at < now() - make_interval(days => ${CRAWLER_LIMITS.pushHistoryDays}::int))
      or created_at < now() - make_interval(days => ${CRAWLER_LIMITS.ingestHistoryDays}::int))`;
  // spool files older than a day with no queued / processing job (a crash between spooling and queueing)
  try {
    const live = new Set((await sqlClient<{ spool_path: string }[]>`select spool_path from log_ingests where status in ('queued', 'processing')`).map((r) => r.spool_path));
    for (const f of await readdir(spoolDir())) {
      const p = join(spoolDir(), f);
      if (live.has(p)) continue;
      const s = await stat(p).catch(() => null);
      if (s && Date.now() - s.mtimeMs > 24 * 3600_000) await rm(p, { force: true });
    }
  } catch {
    /* no spool directory yet */
  }
  return { hits: hits.count, rollups: d1.count + d2.count, ingests: ing.count };
}

/** Starts the worker, retention and the IP-list refresh; returns the timers to clear on shutdown. */
export function startCrawlerJobs(logger: FastifyBaseLogger): NodeJS.Timeout[] {
  log = logger;
  if (!config.crawlers.jobs) {
    logger.info('crawler log jobs off (CRAWLER_JOBS)');
    return [];
  }
  void recover()
    .then(() => kick())
    .catch((err) => logger.warn({ err: String(err) }, 'crawler log recovery failed'));
  const refresh = () =>
    config.crawlers.refreshRanges
      ? refreshRanges()
          .then((r) => logger.info({ updated: r.updated, failed: r.failed }, 'crawler IP lists refreshed'))
          .catch((err) => logger.warn({ err: String(err) }, 'crawler IP list refresh failed'))
      : Promise.resolve();
  const tidy = () =>
    cleanup()
      .then((r) => (r.hits || r.rollups || r.ingests) && logger.info(r, 'crawler log retention applied'))
      .catch((err) => logger.warn({ err: String(err) }, 'crawler log retention failed'));
  const first = setTimeout(() => void refresh().then(tidy), 60_000);
  return [
    first,
    // the queue is also kicked on every upload / push; this sweep picks up anything a kick missed
    setInterval(() => kick(), 30_000),
    setInterval(() => void refresh(), 24 * 3600_000),
    setInterval(() => void tidy(), 6 * 3600_000),
  ];
}
